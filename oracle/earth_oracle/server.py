"""Earth oracle API.

GET  /health
GET  /v1/farms
GET  /v1/farms/{id}/water            → numbers the dashboard shows (from cache)
POST /v1/attest/{id}?season=2027     → evidence pack + EIP-712 signature
GET  /v1/evidence-pack?plot=&season= → x402-gated pack for institutions/agents (never farmers)
"""
from __future__ import annotations

import base64
import json
import secrets

import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import CACHE, env, load_farms
from .evidence import build_pack, evidence_hash, plot_hash
from .sign import sign_attestation

app = FastAPI(title="Agua Clara Earth oracle", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], expose_headers=["PAYMENT-REQUIRED", "PAYMENT-RESPONSE"])

FARMS = load_farms()
_PACKS: dict[str, dict] = {}  # plotId:season → signed pack (in-memory for the demo)


def _cache(name: str) -> dict | None:
    p = CACHE / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def _b64(obj: dict) -> str:
    return base64.b64encode(json.dumps(obj, separators=(",", ":")).encode()).decode()


@app.get("/health")
def health():
    return {"ok": True, "farms": list(FARMS), "x402Mode": env("X402_MODE", "demo")}


@app.get("/v1/farms")
def farms():
    return [{"id": f.id, "name": f.name, "lat": f.lat, "lon": f.lon, "areaHa": f.area_ha, "mode": f.mode, "plotId": plot_hash(f)} for f in FARMS.values()]


@app.get("/v1/farms/{farm_id}/water")
def water(farm_id: str):
    farm = FARMS.get(farm_id)
    if not farm:
        raise HTTPException(404, "unknown farm")
    power = _cache(f"{farm_id}_power.json")
    eco = _cache(f"{farm_id}_ecostress.json")
    body: dict = {"farmId": farm_id, "sources": {}}
    if power:
        body["rainYearMm"] = power["rainYearMm"]
        body["tminColdest"] = power["tminColdest"]
        body["et0Monthly"] = power["et0Monthly"]
        if farm.mode == "practice":  # rainfed: compare ET with available rain
            body["refMonthly"] = power["rainMmDayMonthly"]
            body["sources"]["ref"] = "regional"
    if eco and all(v is not None for v in eco["etMonthly"]):
        body["etMonthly"] = eco["etMonthly"]
        body["sources"]["et"] = "field"
        body["etOverpasses"] = eco["overpasses"]
    valley = _cache(f"{farm_id}_valley_median.json")
    if valley:
        body["refMonthly"] = valley["etMonthly"]
        body["sources"]["ref"] = "field"
    return body


@app.post("/v1/attest/{farm_id}")
def attest(farm_id: str, season: int = 2027, measured: float | None = None, compliance_bps: int | None = None):
    farm = FARMS.get(farm_id)
    if not farm:
        raise HTTPException(404, "unknown farm")
    key = env("ORACLE_PRIVATE_KEY")
    escrow = env("WATER_ESCROW_ADDRESS")
    chain_id = int(env("NOCHAIN_CHAIN_ID", "43113"))
    if not key or not escrow:
        raise HTTPException(503, "set ORACLE_PRIVATE_KEY and WATER_ESCROW_ADDRESS")
    pack = build_pack(farm, season, measured_value=measured, compliance_bps=compliance_bps)
    if pack["cropAlive"] is None:
        raise HTTPException(409, "no HLS data yet: cropAlive unknown, refusing to attest")
    h = evidence_hash(pack)
    att = {"plotId": pack["plotId"], "season": season, "rule": pack["rule"], "value": pack["value"], "cropAlive": pack["cropAlive"], "evidenceHash": h}
    sig = sign_attestation(att, key, chain_id, escrow)
    signed = {"pack": pack, "evidenceHash": h, "attestation": att, **sig, "chainId": chain_id, "verifyingContract": escrow}
    _PACKS[f"{pack['plotId']}:{season}"] = signed
    return signed


# ---------------- x402 ----------------

def _requirements(resource: str) -> dict:
    price = float(env("X402_PRICE_USDC", "0.05"))
    return {
        "x402Version": 2,
        "error": "payment required",
        "accepts": [{
            "scheme": "exact",
            "network": env("X402_NETWORK", f"eip155:{env('NOCHAIN_CHAIN_ID', '43113')}"),
            "asset": env("USDC_ADDRESS", "0x0000000000000000000000000000000000000000"),
            "amount": str(int(round(price * 1_000_000))),  # USDC has 6 decimals
            "payTo": env("X402_PAY_TO", "0x0000000000000000000000000000000000000000"),
            "resource": resource,
            "description": "Agua Clara signed evidence pack (one plot, one season)",
            "mimeType": "application/json",
            "maxTimeoutSeconds": 60,
        }],
    }


def _facilitator(path: str, payment: str, reqs: dict) -> dict:
    """TODO(T3.5): confirm the facilitator request body against https://docs.x402.org."""
    url = env("X402_FACILITATOR_URL")
    if not url:
        raise HTTPException(500, "X402_FACILITATOR_URL not set")
    payload = json.loads(base64.b64decode(payment))
    r = requests.post(f"{url.rstrip('/')}/{path}", json={"x402Version": 2, "paymentPayload": payload, "paymentRequirements": reqs["accepts"][0]}, timeout=30)
    r.raise_for_status()
    return r.json()


@app.get("/v1/evidence-pack")
def evidence_pack(request: Request, plot: str, season: int = 2027):
    reqs = _requirements(str(request.url.path))
    payment = request.headers.get("PAYMENT-SIGNATURE") or request.headers.get("X-PAYMENT")
    if not payment:
        return JSONResponse(reqs, status_code=402, headers={"PAYMENT-REQUIRED": _b64(reqs)})

    mode = env("X402_MODE", "demo")
    if mode == "facilitator":
        v = _facilitator("verify", payment, reqs)
        if not v.get("isValid"):
            return JSONResponse({**reqs, "error": v.get("invalidReason", "invalid payment")}, status_code=402, headers={"PAYMENT-REQUIRED": _b64(reqs)})
        settlement = _facilitator("settle", payment, reqs)
    else:  # demo: accept any payload, clearly marked simulated
        settlement = {"success": True, "transaction": "0x" + secrets.token_hex(32), "network": reqs["accepts"][0]["network"], "simulated": True}

    signed = _PACKS.get(f"{plot}:{season}")
    if not signed:
        farm = next((f for f in FARMS.values() if plot_hash(f) == plot), None)
        if not farm:
            raise HTTPException(404, "unknown plot")
        pack = build_pack(farm, season)
        signed = {"pack": pack, "evidenceHash": evidence_hash(pack), "signature": None, "note": "unsigned: call POST /v1/attest first"}
    return JSONResponse(signed, headers={"PAYMENT-RESPONSE": _b64(settlement)})


# ---------------- SI engine + CERES ----------------
from pydantic import BaseModel, Field  # noqa: E402


class Priorities(BaseModel):
    water: float = Field(0.40, ge=0)
    soil: float = Field(0.25, ge=0)
    income: float = Field(0.25, ge=0)
    resilience: float = Field(0.10, ge=0)


class Scenario(BaseModel):
    rainPct: float = Field(0, ge=-60, le=60, description="rain change, %")
    tempDeltaC: float = Field(0, ge=0, le=4, description="warming, °C")


class AnalyzeRequest(BaseModel):
    farmId: str
    priorities: Priorities = Priorities()
    scenario: Scenario = Scenario()
    draws: int = Field(300, ge=50, le=2000)
    lang: str = Field("es", pattern="^(es|en)$")


@app.post("/v1/si/analyze")
def si_analyze(req: AnalyzeRequest):
    """All four modules (compare, trade-offs, risk, uncertainty) + seasons + CERES narrative."""
    from .si.engine import analyze

    if req.farmId not in FARMS:
        raise HTTPException(404, "unknown farm")
    return analyze(req.farmId, req.priorities.model_dump(), req.scenario.model_dump(), draws=req.draws, lang=req.lang)


@app.get("/v1/si/model")
def si_model_card():
    """Model card: training data, features, three-way comparison, limits."""
    from .si.model import load

    _, card = load()
    return card


@app.post("/v1/si/train")
def si_train():
    """Retrain the SI water-use model (uses real ECOSTRESS data when cached)."""
    from .si import model

    card = model.train(save=True)
    model._LOADED = None
    return card


@app.post("/v1/ceres/brief")
def ceres_brief(req: AnalyzeRequest):
    """Just what CERES says, for voice clients (Telegram, TTS)."""
    from .si.engine import analyze

    if req.farmId not in FARMS:
        raise HTTPException(404, "unknown farm")
    a = analyze(req.farmId, req.priorities.model_dump(), req.scenario.model_dump(), draws=min(req.draws, 300), lang=req.lang)
    return a["voice"][req.lang]


# ---------------- CERES conversation (text + Retell voice) ----------------
from .ceres.retell import router as _retell_router  # noqa: E402

app.include_router(_retell_router)


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    farmId: str = "samegua"
    lang: str = Field("es", pattern="^(es|en)$")
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)


@app.post("/v1/ceres/chat")
def ceres_chat(req: ChatRequest):
    """Text chat with CERES (Claude). The client keeps the history and sends it each turn."""
    from .ceres.agent import get_ceres

    if not env("ANTHROPIC_API_KEY"):
        raise HTTPException(503, "set ANTHROPIC_API_KEY to enable CERES chat")
    turn = get_ceres().reply([m.model_dump() for m in req.messages], req.farmId, req.lang, mode="text")
    return {"agent": "CERES", "reply": turn.text, "model": turn.model,
            "toolCalls": [{"name": t["name"], "input": t["input"]} for t in turn.tool_calls]}
