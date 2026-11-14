import json

import pytest
from fastapi.testclient import TestClient

from earth_oracle.ceres import agent as agent_mod
from earth_oracle.ceres import retell as retell_mod
from earth_oracle.ceres.agent import Ceres, clean_history
from earth_oracle.ceres.prompt import knowledge_pack, system_prompt
from earth_oracle.ceres.tools import TOOLS, estimate_reward, get_farm_analysis, get_risk_calendar, run_tool


# ---------- fake Anthropic client (no network) ----------
class Block:
    def __init__(self, **kw):
        self.__dict__.update(kw)

    def model_dump(self, exclude_none=False):
        return {k: v for k, v in self.__dict__.items() if not (exclude_none and v is None)}


class FakeStream:
    def __init__(self, texts, final):
        self.texts, self.final = texts, final

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    @property
    def text_stream(self):
        return iter(self.texts)

    def get_final_message(self):
        return self.final


class FakeMessages:
    def __init__(self, script):
        self.script, self.calls = list(script), []

    def stream(self, **kw):
        self.calls.append(kw)
        texts, final = self.script.pop(0)
        return FakeStream(texts, final)


class FakeClient:
    def __init__(self, script):
        self.messages = FakeMessages(script)


def tool_then_answer():
    return [
        (["Déjame revisar. "], Block(stop_reason="tool_use", content=[
            Block(type="text", text="Déjame revisar. ", citations=None),
            Block(type="tool_use", id="t1", name="estimate_reward", input={"farm_id": "samegua", "strategy_id": "maiz-arveja"}),
        ])),
        (["Podrías ganar ", "unos 96 USDC."], Block(stop_reason="end_turn", content=[Block(type="text", text="Podrías ganar unos 96 USDC.")])),
    ]


# ---------- knowledge + prompt ----------
def test_knowledge_pack_covers_product_data_rotations_money():
    k = knowledge_pack()
    for phrase in ("ECOSTRESS", "MERESE", "nunca paga", "frase de recuperación", "No es un seguro", "x402", "NØCHAIN", "Agencia Agraria"):
        assert phrase in k, phrase


def test_system_prompt_has_grounding_and_voice_rules():
    s = system_prompt("voice")
    assert "SOLO de tus herramientas" in s and "Sin listas" in s
    assert "Nunca prometas un pago" in system_prompt("text")


# ---------- tools (real engine) ----------
def test_estimate_reward_irrigated_matches_rule():
    r = estimate_reward("samegua", "maiz-arveja")
    expected = round(r["saved_m3_total"] * r["rate_usdc_per_m3"], 2)
    assert abs(r["reward_usdc_if_met"] - expected) < 0.02 and "cropAlive" in r["condition"]


def test_estimate_reward_practice_and_current():
    r = estimate_reward("carumas", "haba-avena")
    assert r["reward_usdc_example"] == 63.0
    assert estimate_reward("samegua", "current")["reward_usdc"] == 0


def test_risk_calendar_and_analysis_shapes():
    cal = get_risk_calendar("carumas")
    assert len(cal["by_month"]) == 12
    a = get_farm_analysis("algarrobal", water=1, soil=0, income=0, resilience=0)
    assert len(a["strategies"]) == 4 and a["confidence"] in ("low", "medium", "high")


def test_run_tool_rejects_unknown_farm_and_never_raises():
    assert "error" in json.loads(run_tool("get_farm_analysis", {"farm_id": "lima"}))
    assert "error" in json.loads(run_tool("estimate_reward", {"farm_id": "samegua", "strategy_id": "nope"}))
    assert {t["name"] for t in TOOLS} == {"get_farm_analysis", "estimate_reward", "get_risk_calendar"}


# ---------- agent loop ----------
def test_agent_runs_tool_loop_and_grounds_numbers(monkeypatch):
    monkeypatch.delenv("CERES_TEXT_MODEL", raising=False)
    fake = FakeClient(tool_then_answer())
    turn = Ceres(client=fake).reply([{"role": "user", "content": "¿Cuánto puedo ganar con maíz y arveja?"}], "samegua", "es")
    assert turn.text.endswith("unos 96 USDC.")
    assert turn.tool_calls[0]["name"] == "estimate_reward" and "reward_usdc_if_met" in turn.tool_calls[0]["output"]
    first, second = fake.messages.calls
    assert first["model"] == "claude-sonnet-5-5" and first["output_config"] == {"effort": "medium"}
    assert first["system"][0]["cache_control"] == {"type": "ephemeral"}
    tool_result = second["messages"][-1]["content"][0]
    assert tool_result["type"] == "tool_result" and tool_result["tool_use_id"] == "t1"
    assert "citations" not in second["messages"][-2]["content"][0]  # None fields stripped


def test_voice_mode_uses_fast_model(monkeypatch):
    monkeypatch.delenv("CERES_VOICE_MODEL", raising=False)
    fake = FakeClient([(["Hola."], Block(stop_reason="end_turn", content=[]))])
    list(Ceres(client=fake).stream([{"role": "user", "content": "hola"}], mode="voice"))
    call = fake.messages.calls[0]
    assert call["model"] == "claude-haiku-5-5" and call["thinking"] == {"type": "disabled"} and call["output_config"] == {"effort": "low"}


def test_clean_history_normalizes_roles():
    h = clean_history([{"role": "agent", "content": "hola"}, {"role": "user", "content": "a"}, {"role": "user", "content": "b"}, {"role": "system", "content": "x"}])
    assert h == [{"role": "user", "content": "a\nb"}]


# ---------- Retell WebSocket protocol ----------
class FakeCeres:
    def stream(self, messages, farm_id, lang, mode="voice", trace=None):
        assert mode == "voice"
        yield f"[{farm_id}/{lang}] "
        yield "Tu alfalfa usa mucha agua."


def test_retell_socket_protocol(monkeypatch):
    monkeypatch.setattr(retell_mod, "get_ceres", lambda: FakeCeres())
    from earth_oracle.server import app

    with TestClient(app).websocket_connect("/v1/ceres/retell/call_123") as ws:
        assert ws.receive_json()["response_type"] == "config"
        ws.send_json({"interaction_type": "call_details", "call": {"metadata": {"farmId": "carumas", "lang": "en"}}})
        hello = ws.receive_json()
        assert hello["response_id"] == 0 and hello["content"].startswith("Hi, I'm CERES") and hello["content_complete"]
        ws.send_json({"interaction_type": "ping_pong", "timestamp": 42})
        assert ws.receive_json() == {"response_type": "ping_pong", "timestamp": 42}
        ws.send_json({"interaction_type": "response_required", "response_id": 1,
                      "transcript": [{"role": "agent", "content": "Hi"}, {"role": "user", "content": "How much water?"}]})
        chunks = []
        while True:
            m = ws.receive_json()
            assert m["response_type"] == "response" and m["response_id"] == 1
            chunks.append(m["content"])
            if m["content_complete"]:
                break
        assert "".join(chunks).startswith("[carumas/en]")


def test_chat_endpoint_requires_key_then_works(monkeypatch):
    from earth_oracle.server import app

    c = TestClient(app)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert c.post("/v1/ceres/chat", json={"messages": [{"role": "user", "content": "hola"}]}).status_code == 503
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    monkeypatch.setattr(agent_mod, "_SINGLETON", Ceres(client=FakeClient(tool_then_answer())))
    r = c.post("/v1/ceres/chat", json={"farmId": "samegua", "messages": [{"role": "user", "content": "¿Cuánto gano?"}]})
    assert r.status_code == 200 and r.json()["toolCalls"][0]["name"] == "estimate_reward"
