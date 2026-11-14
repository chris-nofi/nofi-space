"""Earth oracle API.

GET  /health
GET  /v1/farms
GET  /v1/farms/{id}/water            → numbers the dashboard shows (from cache)
GET  /v1/records/{id}?periods=202608,202609,202610 → farmer-safe summaries of the monthly earth records (hash + status)
GET  /v1/records/{id}/{YYYYMM}/package → full record + dataHash, for the x402 oracle/attest scripts (set ORACLE_ADMIN_TOKEN)
POST /v1/attest/{id}                 → LEGACY (WaterEscrow EIP-712, plan v1). Plan v2 attests to WaterProofRegistry.

Plan v2: the paid x402 endpoint GET /v1/earth/{farm}/{YYYYMM} is served by the Node oracle in
avalanche/x402/ (self-hosted facilitator on eip155:880024). This service builds the records it sells.
"""
from __future__ import annotations

import json

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import CACHE, env, load_farms
from .evidence import build_pack, evidence_hash, plot_hash
from .sign import sign_attestation

app = FastAPI(title="CERES Ventures Earth oracle", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], expose_headers=["PAYMENT-REQUIRED", "PAYMENT-RESPONSE"])

FARMS = load_farms()
_PACKS: dict[str, dict] = {}  # plotId:season → signed pack (in-memory for the demo)


def _cache(name: str) -> dict | None:
    p = CACHE / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


@app.get("/health")
def health():
    return {"ok": True, "farms": list(FARMS), "x402": "avalanche/x402 (Node, eip155:880024)", "x402EarthUrl": env("X402_EARTH_URL")}


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


# ---------------- earth records (plan v2) ----------------
from .proof import package as record_package, summary as record_summary  # noqa: E402


def _periods(periods: str | None) -> list[str]:
    from .cli import _periods as last_months

    ps = [p.strip() for p in (periods or ",".join(last_months(None))).split(",") if p.strip()]
    if not ps or len(ps) > 12 or not all(len(p) == 6 and p.isdigit() for p in ps):
        raise HTTPException(422, "periods must be up to 12 comma-separated YYYYMM values")
    return ps


@app.get("/v1/records/{farm_id}")
def records(farm_id: str, periods: str | None = None):
    """What the farmer screen shows: hash, status, strategy, water saved. No values for sale, no prices."""
    if farm_id not in FARMS:
        raise HTTPException(404, "unknown farm")
    out = [record_summary(record_package(farm_id, p)) for p in _periods(periods)]
    return {"farmId": farm_id, "registry": env("WATER_PROOF_REGISTRY"), "explorer": env("X402_EXPLORER_URL", "https://nofiscan.io"),
            "chainId": int(env("NOFI_CHAIN_ID", "880024")), "records": out}


@app.get("/v1/records/{farm_id}/{period}/package")
def record_full(farm_id: str, period: str, request: Request):
    """Full package for the x402 oracle and the attest script. Not public: it is what x402 sells."""
    token = env("ORACLE_ADMIN_TOKEN")
    if not token or request.headers.get("Authorization") != f"Bearer {token}":
        raise HTTPException(401, "admin token required")
    if farm_id not in FARMS:
        raise HTTPException(404, "unknown farm")
    try:
        return record_package(farm_id, period)
    except ValueError as e:
        raise HTTPException(422, str(e))


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
            "toolCalls": [{"name": t["name"], "input": t["input"]} for t in turn.tool_calls],
            "proofs": _proofs(turn.tool_calls)}


def _proofs(tool_calls: list[dict]) -> list[dict]:
    """x402 payments and record hashes behind this answer, for the 'Pagado por x402 · ver tx' chip."""
    out = []
    for t in tool_calls:
        if t["name"] != "get_verified_record":
            continue
        o = t.get("output") or {}
        if isinstance(o, str):
            try:
                o = json.loads(o)
            except ValueError:
                continue
        if o.get("error"):
            continue
        out.append({"farmId": o.get("farm_id"), "period": o.get("period"), "dataHash": o.get("dataHash"),
                    "placeholder": o.get("placeholder"), "recordedOnChain": o.get("recorded_on_chain"),
                    "payment": o.get("payment")})
    return out
