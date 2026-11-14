"""CERES agent: Claude Messages API tool-use loop, streaming, shared by text and voice."""
from __future__ import annotations

import json
from collections.abc import Iterator
from dataclasses import dataclass, field

from ..config import env
from .prompt import farm_context, system_prompt
from .tools import TOOLS, run_tool

TEXT_MODEL = "claude-sonnet-5-5"   # best balance of speed and intelligence
VOICE_MODEL = "claude-haiku-5-5"   # lowest latency, for phone/voice turns
MAX_TOOL_ROUNDS = 4


@dataclass
class Turn:
    text: str = ""
    tool_calls: list[dict] = field(default_factory=list)
    model: str = ""


def clean_history(messages: list[dict]) -> list[dict]:
    """Keep only user/assistant text turns, merge consecutive roles, start with a user turn."""
    out: list[dict] = []
    for m in messages:
        role = "assistant" if m.get("role") in ("assistant", "agent") else "user" if m.get("role") == "user" else None
        content = (m.get("content") or "").strip()
        if not role or not content:
            continue
        if out and out[-1]["role"] == role:
            out[-1]["content"] += "\n" + content
        else:
            out.append({"role": role, "content": content})
    while out and out[0]["role"] == "assistant":
        out.pop(0)
    return out[-30:]


class Ceres:
    def __init__(self, client=None):
        if client is None:
            import anthropic  # lazy: tests inject a fake client

            client = anthropic.Anthropic(api_key=env("ANTHROPIC_API_KEY"))
        self.client = client
        self.text_model = env("CERES_TEXT_MODEL", TEXT_MODEL)
        self.voice_model = env("CERES_VOICE_MODEL", VOICE_MODEL)

    def _params(self, farm_id: str, lang: str, mode: str) -> dict:
        voice = mode == "voice"
        p = {
            "model": self.voice_model if voice else self.text_model,
            "max_tokens": 600 if voice else 1500,
            "system": [
                # static persona + rules + knowledge: cached across turns and calls
                {"type": "text", "text": system_prompt(mode), "cache_control": {"type": "ephemeral"}},
                {"type": "text", "text": farm_context(farm_id, lang)},
            ],
            "tools": TOOLS,
            "output_config": {"effort": "low" if voice else "medium"},
        }
        if voice:
            p["thinking"] = {"type": "disabled"}  # allowed on Haiku 5.5 at low effort; fastest first token
        return p

    def stream(self, messages: list[dict], farm_id: str = "samegua", lang: str = "es", mode: str = "text",
               trace: list | None = None) -> Iterator[str]:
        """Yield text chunks as Claude writes them; run tools between rounds."""
        history = clean_history(messages)
        if not history:
            history = [{"role": "user", "content": "Hola" if lang == "es" else "Hello"}]
        params = self._params(farm_id, lang, mode)
        for _ in range(MAX_TOOL_ROUNDS + 1):
            with self.client.messages.stream(messages=history, **params) as s:
                for chunk in s.text_stream:
                    yield chunk
                final = s.get_final_message()
            if final.stop_reason != "tool_use":
                return
            history.append({"role": "assistant", "content": [b.model_dump(exclude_none=True) if hasattr(b, "model_dump") else b for b in final.content]})
            results = []
            for b in final.content:
                if getattr(b, "type", None) == "tool_use":
                    out = run_tool(b.name, b.input)
                    if trace is not None:
                        trace.append({"name": b.name, "input": b.input, "output": json.loads(out)})
                    results.append({"type": "tool_result", "tool_use_id": b.id, "content": out})
            history.append({"role": "user", "content": results})
        yield " " + ("Necesito un momento más; pregúntame de nuevo." if lang == "es" else "I need a moment more; please ask again.")

    def reply(self, messages: list[dict], farm_id: str = "samegua", lang: str = "es", mode: str = "text") -> Turn:
        trace: list = []
        text = "".join(self.stream(messages, farm_id, lang, mode, trace=trace))
        return Turn(text=text.strip(), tool_calls=trace, model=self._params(farm_id, lang, mode)["model"])


_SINGLETON: Ceres | None = None


def get_ceres() -> Ceres:
    global _SINGLETON
    if _SINGLETON is None:
        _SINGLETON = Ceres()
    return _SINGLETON
