"""Tools CERES can call. Every farm number in a reply must come from one of these."""
from __future__ import annotations

import json
from datetime import date
from functools import lru_cache

from ..config import env
from ..proof import package, record_values, summary
from ..real_data import context as real_context
from ..si.engine import analyze
from ..x402_client import X402Error, fetch_paid

FARM_IDS = ["carumas", "samegua", "algarrobal"]
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
        "description": "Corre el motor SI de CERES Ventures para una parcela: compara la práctica actual con tres alternativas (agua, suelo, ingreso, riesgo), ranking según prioridades, probabilidad de que cada una sea la mejor, riesgo pico, confianza y calidad de datos. Incluye por qué se sugiere cada estrategia, beneficios, vacíos de información y riesgos a revisar con un técnico local. Úsala antes de dar cualquier número o recomendación.",
        "input_schema": {
            "type": "object",
            "properties": {"farm_id": {"type": "string", "enum": FARM_IDS}, **_priority_props},
            "required": ["farm_id"],
        },
    },
    {
        "name": "get_verified_record",
        "description": "Trae el registro verificable de datos NASA de una parcela para un mes (ET de ECOSTRESS, ET0 y lluvia de POWER, NDVI de HLS, estrategia recomendada, agua ahorrada) con su huella dataHash. CERES le compra este dato al oráculo de la Tierra por x402 (pago por consulta, en la L1 de NOFI) y el registro queda anclado en la cadena. Úsala cuando des cifras del mes, cuando pregunten si el dato es confiable o cómo se puede comprobar.",
        "input_schema": {
            "type": "object",
            "properties": {
                "farm_id": {"type": "string", "enum": FARM_IDS},
                "period": {"type": "string", "pattern": "^[0-9]{6}$", "description": "mes AAAAMM; por defecto el último mes cerrado"},
            },
            "required": ["farm_id"],
        },
    },
    {
        "name": "get_climate_context",
        "description": "Clima real de la parcela desde NASA POWER, CHIRPS y ERA5 (1981-2026): ET0 anual, rango de lluvia entre fuentes, tendencia de temperatura por década, años extremos, El Niño/La Niña, anomalías de los últimos meses, y advertencias de calidad (celda de POWER, punto fuera de la chacra). Úsala cuando pregunten por el clima, la sequía, El Niño, el calentamiento o qué tan confiables son los datos.",
        "input_schema": {"type": "object", "properties": {"farm_id": {"type": "string", "enum": FARM_IDS}}, "required": ["farm_id"]},
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
            "why_es": (s.get("why") or {}).get("es"), "benefits_es": (s.get("benefits") or {}).get("es"),
            "information_gaps_es": (s.get("gaps") or {}).get("es"), "risks_for_local_review_es": (s.get("risks") or {}).get("es"),
            "soil_levers": s.get("soilLevers"), "needs": s.get("needs"), "recommended": s.get("recommended"),
            "water_expected": s["water"].get("expected"),
        } for s in a["compare"]["strategies"]],
        "ranking": [r["id"] for r in a["tradeoffs"]["ranking"]],
        "confidence": unc["confidence"],
        "uncertainty_drivers": unc["drivers"],
        "data_quality": a["dataQuality"],
        "ceres_summary_es": a["voice"]["es"]["text"],
    }


def default_period(today: date | None = None) -> str:
    d = today or date.today()
    y, m = (d.year, d.month - 1) if d.month > 1 else (d.year - 1, 12)
    return env("CERES_DEFAULT_PERIOD") or f"{y:04d}{m:02d}"


def get_verified_record(farm_id: str, period: str | None = None) -> dict:
    """Paid path (plan v2): the CERES agent buys the record from the x402 Earth oracle.
    Local path: same record built here, clearly marked as not paid and not anchored."""
    period = period or default_period()
    url = env("X402_EARTH_URL")
    if url:
        try:
            res = fetch_paid(f"{url.rstrip('/')}/v1/earth/{farm_id}/{period}")
        except X402Error as e:
            return {"error": f"no se pudo comprar el dato: {e}", "farm_id": farm_id, "period": period}
        data = res.data
        rec = data.get("record") or data.get("evidence") or data
        proof = data.get("proof") or {}
        return {
            "farm_id": farm_id, "period": period, "values": rec.get("values", rec),
            "dataHash": data.get("dataHash") or proof.get("dataHash"),
            "placeholder": bool(data.get("placeholder", proof.get("placeholder", True))),
            "recorded_on_chain": proof.get("recordedOnChain"),
            "paid_via_x402": res.payment is not None,
            "payment": res.payment,
            "note_for_farmer": "Di solo: 'tu registro verificable de agua está guardado'. No hables de pagos, tokens ni billeteras con el agricultor.",
        }
    pkg = package(farm_id, period)
    summ = summary(pkg)
    return {
        "farm_id": farm_id, "period": period, "values": record_values(pkg), "dataHash": pkg["dataHash"],
        "datasets_used": summ["datasets"], "source": pkg.get("source"),
        "placeholder": pkg["placeholder"], "attestable": pkg.get("attestable", False), "issues": summ["issues"],
        "recorded_on_chain": False, "paid_via_x402": False, "payment": None,
        "note": "Oráculo x402 no configurado: registro leído localmente, sin pago ni anclaje en la cadena.",
        "note_for_farmer": "Datos reales de satélite y reanálisis. Si hay 'issues', dilo con sencillez (por ejemplo, que el punto del mapa debe moverse a la chacra antes de guardar el registro).",
    }


def get_climate_context(farm_id: str) -> dict:
    ctx = real_context(farm_id)
    if not ctx:
        return {"error": "datos climáticos reales no cargados (python -m earth_oracle.cli import-real)"}
    t = ctx.get("trends") or {}
    pick = lambda d, *ks: {k: d.get(k) for k in ks if isinstance(d, dict) and k in d}  # noqa: E731
    return {
        "farm_id": farm_id,
        "et0_mm_yr_power_fao56": ctx.get("et0MmYr"), "et0_mm_yr_era5_1991_2020": ctx.get("era5Et0MmYr"),
        "rain_mm_yr_by_source": ctx.get("rainRangeMmYr"),
        "climatology_1991_2020": ctx.get("climatology1991_2020"),
        "temperature_trend": pick(t.get("t2m") or {}, "sen_per_decade", "mann_kendall_p", "period"),
        "extremes": ctx.get("extremes"),
        "enso_dec_apr": ctx.get("ensoDecApr"),
        "last_months_anomaly": (ctx.get("last12") or [])[-4:],
        "temperature_rule": ctx.get("temperatureRule"),
        "point": pick(ctx.get("point") or {}, "lat", "lon", "srtm30m_m", "power_grid_cell_m", "slope_deg_30m"),
        "representative": ctx.get("representative"),
        "warnings": [w for w in [
            ctx.get("offFieldNote", {}) and (ctx.get("offFieldNote") or {}).get("es"),
            "Carumas y Samegua comparten una celda de NASA POWER a 3.851 m: la temperatura de POWER no sirve para el valle de Samegua (se usa ERA5-Land)." if farm_id in ("carumas", "samegua") else None,
            "GPM IMERG pendiente (falta aprobar el EULA de GES DISC): la lluvia viene de CHIRPS v3.",
            "Las anomalías de los últimos meses son reanálisis preliminar.",
        ] if w],
        "sources": ctx.get("sources"),
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


HANDLERS = {"get_farm_analysis": get_farm_analysis, "get_verified_record": get_verified_record, "get_climate_context": get_climate_context, "get_risk_calendar": get_risk_calendar}


def run_tool(name: str, args: dict) -> str:
    try:
        fn = HANDLERS[name]
        args = dict(args or {})
        if args.get("farm_id") not in FARM_IDS:
            return json.dumps({"error": f"farm_id debe ser uno de {FARM_IDS}"})
        return json.dumps(fn(**args), ensure_ascii=False)
    except Exception as e:  # tool errors go back to the model, never crash the call
        return json.dumps({"error": f"{type(e).__name__}: {e}"})
