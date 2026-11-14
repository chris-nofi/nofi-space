"""Tools CERES can call. Every farm number in a reply must come from one of these."""
from __future__ import annotations

import json
from functools import lru_cache

from ..config import load_farms
from ..si.engine import analyze
from ..si.library import farm_rotations

FARM_IDS = ["carumas", "samegua", "algarrobal"]
RATE_PER_M3 = 0.015          # example tariff, USDC per m³ (matches dashboard and contract tests)
PRACTICE_COMPLIANCE = 0.90   # example verified compliance for the practice rule
DRAWS = 200

_priority_props = {
    "water": {"type": "number", "minimum": 0, "description": "peso de la prioridad agua (0-1)"},
    "soil": {"type": "number", "minimum": 0, "description": "peso de la prioridad suelo (0-1)"},
    "income": {"type": "number", "minimum": 0, "description": "peso de la prioridad ingreso (0-1)"},
    "resilience": {"type": "number", "minimum": 0, "description": "peso de la prioridad resiliencia/menor riesgo (0-1)"},
    "rain_pct": {"type": "number", "minimum": -60, "maximum": 60, "description": "escenario: cambio de lluvia en %"},
    "temp_delta_c": {"type": "number", "minimum": 0, "maximum": 4, "description": "escenario: calentamiento en °C"},
}

TOOLS = [
    {
        "name": "get_farm_analysis",
        "description": "Corre el motor SI de Agua Clara para una parcela: compara la práctica actual con tres alternativas (agua, suelo, ingreso, riesgo), ranking según prioridades, probabilidad de que cada una sea la mejor, riesgo pico, confianza y calidad de datos. Úsala antes de dar cualquier número o recomendación.",
        "input_schema": {
            "type": "object",
            "properties": {"farm_id": {"type": "string", "enum": FARM_IDS}, **_priority_props},
            "required": ["farm_id"],
        },
    },
    {
        "name": "estimate_reward",
        "description": "Estima la recompensa por agua (USDC, simulada en testnet) para una estrategia de una parcela, con la regla de pago, el máximo y el cálculo paso a paso. Úsala cuando pregunten cuánto pueden ganar o cómo se calcula el pago.",
        "input_schema": {
            "type": "object",
            "properties": {
                "farm_id": {"type": "string", "enum": FARM_IDS},
                "strategy_id": {"type": "string", "description": "id de la estrategia, p. ej. 'maiz-arveja', 'haba-avena', 'drip'"},
            },
            "required": ["farm_id", "strategy_id"],
        },
    },
    {
        "name": "get_risk_calendar",
        "description": "Calendario de riesgo mes a mes (helada, calor, falta de agua, suelo desnudo, salinidad) para una estrategia, más los meses en que el suelo suele quedar desnudo.",
        "input_schema": {
            "type": "object",
            "properties": {
                "farm_id": {"type": "string", "enum": FARM_IDS},
                "strategy_id": {"type": "string"},
            },
            "required": ["farm_id"],
        },
    },
]


@lru_cache(maxsize=64)
def _analysis(farm_id: str, water: float, soil: float, income: float, resilience: float, rain_pct: float, temp_delta_c: float) -> dict:
    return analyze(farm_id, {"water": water, "soil": soil, "income": income, "resilience": resilience},
                   {"rainPct": rain_pct, "tempDeltaC": temp_delta_c}, draws=DRAWS)


def _run(farm_id: str, args: dict | None = None) -> dict:
    a = args or {}
    return _analysis(farm_id, float(a.get("water", 0.4)), float(a.get("soil", 0.25)), float(a.get("income", 0.25)),
                     float(a.get("resilience", 0.10)), float(a.get("rain_pct", 0.0)), float(a.get("temp_delta_c", 0.0)))


def get_farm_analysis(farm_id: str, **kw) -> dict:
    a = _run(farm_id, kw)
    unc = a["uncertainty"]
    return {
        "farm_id": farm_id,
        "units": "m³/ha/año" if a["units"] == "m3" else "mm/año",
        "scenario": a["scenario"],
        "priorities": a["tradeoffs"]["priorities"],
        "strategies": [{
            "id": s["id"], "name_es": s["name"]["es"], "name_en": s["name"]["en"], "current": s["current"],
            "water_p50": s["water"]["p50"], "water_range_p10_p90": [unc["strategies"][s["id"]]["water"]["p10"], unc["strategies"][s["id"]]["water"]["p90"]],
            "soil_0_100": s["soil"], "income_pen_ha_year": s["incomePenHa"], "deficit_pct": s["deficitPct"],
            "vs_current": s["deltas"],
            "wins_out_of_100_years": round(unc["rankFirstProbability"][s["id"]] * 100),
            "risk_peak": a["risk"]["strategies"][s["id"]]["peak"],
        } for s in a["compare"]["strategies"]],
        "ranking": [r["id"] for r in a["tradeoffs"]["ranking"]],
        "confidence": unc["confidence"],
        "uncertainty_drivers": unc["drivers"],
        "data_quality": a["dataQuality"],
        "ceres_summary_es": a["voice"]["es"]["text"],
    }


def estimate_reward(farm_id: str, strategy_id: str) -> dict:
    farm = load_farms()[farm_id]
    rot = farm_rotations(farm_id)
    a = _run(farm_id)
    rows = {s["id"]: s for s in a["compare"]["strategies"]}
    if strategy_id not in rows:
        return {"error": f"estrategia desconocida; opciones: {list(rows)}"}
    s = rows[strategy_id]
    cur = next(r for r in rows.values() if r["current"])
    if s["current"]:
        return {"strategy_id": strategy_id, "reward_usdc": 0, "why": "La práctica actual no recibe recompensa: la recompensa premia un cambio verificado."}
    note = "Simulado en testnet; tarifas de ejemplo. Ningún pago real está garantizado hasta que un financiador firme un programa."
    if rot["water"] == "irrigated":
        base, plan = cur["water"]["p50"], s["water"]["p50"]
        saved_ha = max(0.0, base - plan)
        total = saved_ha * farm.area_ha
        reward = round(total * RATE_PER_M3, 2)
        return {
            "strategy_id": strategy_id, "rule": "por m³ ahorrado frente a tu propia línea base",
            "baseline_m3_ha": round(base), "planned_m3_ha": round(plan), "saved_m3_total": round(total),
            "area_ha": farm.area_ha, "rate_usdc_per_m3": RATE_PER_M3, "reward_usdc_if_met": reward,
            "calculation": f"({round(base)} − {round(plan)}) m³/ha × {farm.area_ha} ha × {RATE_PER_M3} = {reward} USDC",
            "condition": "Solo paga si HLS confirma que el cultivo sigue vivo y la rotación cambió (cropAlive).",
            "note": note,
        }
    rate = farm.raw.get("rate_usdc_per_ha", 70)
    reward = round(rate * farm.area_ha * PRACTICE_COMPLIANCE, 2)
    return {
        "strategy_id": strategy_id, "rule": "por hectárea × cumplimiento verificado",
        "rate_usdc_per_ha": rate, "area_ha": farm.area_ha, "example_compliance": PRACTICE_COMPLIANCE,
        "reward_usdc_example": reward,
        "calculation": f"{rate} USDC/ha × {farm.area_ha} ha × {int(PRACTICE_COMPLIANCE * 100)} % = {reward} USDC",
        "checks": ["leguminosa sembrada (HLS)", "suelo cubierto en época seca (HLS)", "qocha con agua (OPERA DSWx)", "humedad retenida (SMAP/ECOSTRESS, baja confianza)"],
        "note": note,
    }


def get_risk_calendar(farm_id: str, strategy_id: str | None = None) -> dict:
    a = _run(farm_id)
    sid = strategy_id or next(s["id"] for s in a["compare"]["strategies"] if s["current"])
    r = a["risk"]["strategies"].get(sid)
    if not r:
        return {"error": f"estrategia desconocida; opciones: {list(a['risk']['strategies'])}"}
    months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
    by_month = []
    for m in range(12):
        top = max(r["grid"], key=lambda h: h["monthly"][m])
        by_month.append({"month": months[m], "top_hazard": top["hazard"], "probability": top["monthly"][m]})
    seasons = a["seasons"]["observed"] if sid == "current" else a["seasons"].get(sid, {})
    return {"strategy_id": sid, "peak": r["peak"], "vulnerable_months": r["vulnerableMonths"], "by_month": by_month,
            "bare_soil_windows": seasons.get("bareWindows", [])}


HANDLERS = {"get_farm_analysis": get_farm_analysis, "estimate_reward": estimate_reward, "get_risk_calendar": get_risk_calendar}


def run_tool(name: str, args: dict) -> str:
    try:
        fn = HANDLERS[name]
        args = dict(args or {})
        if args.get("farm_id") not in FARM_IDS:
            return json.dumps({"error": f"farm_id debe ser uno de {FARM_IDS}"})
        return json.dumps(fn(**args), ensure_ascii=False)
    except Exception as e:  # tool errors go back to the model, never crash the call
        return json.dumps({"error": f"{type(e).__name__}: {e}"})
