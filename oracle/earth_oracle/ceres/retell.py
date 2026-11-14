"""Retell AI custom-LLM WebSocket for CERES voice calls.

Retell handles the phone/web audio, speech-to-text and text-to-speech. It connects to
  wss://<oracle-host>/v1/ceres/retell/{call_id}
and asks this server what CERES should say. Protocol: https://docs.retellai.com/api-references/llm-websocket
"""
from __future__ import annotations

import asyncio
import contextlib

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .agent import get_ceres

router = APIRouter()

GREETING = {
    "es": "Hola, soy CERES, de CERES Ventures. Puedo contarte cuánta agua usa tu parcela según los satélites de la NASA, qué rotaciones te convienen y cómo queda guardado tu registro de agua. ¿Por dónde empezamos?",
    "en": "Hi, I'm CERES, from CERES Ventures. I can tell you how much water your field uses according to NASA satellites, which rotations fit you, and how your water record is kept. Where shall we start?",
}
REMINDER = {
    "es": "(El agricultor lleva un rato en silencio. Pregúntale con amabilidad, en una frase, si sigue ahí o si quiere saber algo más.)",
    "en": "(The caller has been silent for a while. Kindly ask, in one sentence, whether they're still there or want to know more.)",
}


def transcript_to_messages(transcript: list[dict]) -> list[dict]:
    return [{"role": "assistant" if u.get("role") == "agent" else "user", "content": u.get("content", "")} for u in transcript or []]


def _context_from_call(call: dict) -> dict:
    meta = {**(call.get("retell_llm_dynamic_variables") or {}), **(call.get("metadata") or {})}
    out = {}
    if meta.get("farmId") in ("carumas", "samegua", "algarrobal"):
        out["farm"] = meta["farmId"]
    if meta.get("lang") in ("es", "en"):
        out["lang"] = meta["lang"]
    return out


@router.websocket("/v1/ceres/retell/{call_id}")
async def retell_socket(ws: WebSocket, call_id: str):
    await ws.accept()
    state = {"farm": "samegua", "lang": "es", "latest": -1}
    task: asyncio.Task | None = None
    send_lock = asyncio.Lock()

    async def send(obj: dict):
        async with send_lock:
            await ws.send_json(obj)

    await send({"response_type": "config", "config": {"auto_reconnect": True, "call_details": True}})

    async def greet(delay: float = 0.0):
        """Speak first. Wait briefly for call_details so the greeting uses the caller's language."""
        if delay:
            await asyncio.sleep(delay)
        if not state.get("greeted"):
            state["greeted"] = True
            await send({"response_type": "response", "response_id": 0, "content": GREETING[state["lang"]], "content_complete": True})

    greet_task = asyncio.create_task(greet(0.8))

    async def respond(response_id: int, transcript: list[dict], reminder: bool):
        messages = transcript_to_messages(transcript)
        if reminder:
            messages.append({"role": "user", "content": REMINDER[state["lang"]]})
        queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def produce():
            try:
                for chunk in get_ceres().stream(messages, state["farm"], state["lang"], mode="voice"):
                    if state["latest"] != response_id:
                        break  # superseded by a newer turn
                    loop.call_soon_threadsafe(queue.put_nowait, chunk)
            except Exception:  # never leave the caller in silence
                msg = "Perdona, tuve un problema. ¿Me lo repites?" if state["lang"] == "es" else "Sorry, I had a problem. Could you repeat that?"
                loop.call_soon_threadsafe(queue.put_nowait, msg)
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        worker = loop.run_in_executor(None, produce)
        while True:
            chunk = await queue.get()
            if chunk is None or state["latest"] != response_id:
                break
            await send({"response_type": "response", "response_id": response_id, "content": chunk, "content_complete": False})
        if state["latest"] == response_id:
            await send({"response_type": "response", "response_id": response_id, "content": "", "content_complete": True})
        with contextlib.suppress(Exception):
            await worker

    try:
        while True:
            msg = await ws.receive_json()
            kind = msg.get("interaction_type")
            if kind == "ping_pong":
                await send({"response_type": "ping_pong", "timestamp": msg.get("timestamp")})
            elif kind == "call_details":
                state.update(_context_from_call(msg.get("call") or {}))
                await greet()
            elif kind in ("response_required", "reminder_required"):
                state["greeted"] = True
                rid = int(msg.get("response_id", state["latest"] + 1))
                state["latest"] = rid
                if task and not task.done():
                    task.cancel()
                task = asyncio.create_task(respond(rid, msg.get("transcript", []), kind == "reminder_required"))
            # update_only: nothing to do
    except WebSocketDisconnect:
        pass
    finally:
        greet_task.cancel()
        if task and not task.done():
            task.cancel()
