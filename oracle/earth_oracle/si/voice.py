"""CERES — the voice of the CERES Ventures SI engine.

Named after Ceres, Roman goddess of grain and the dwarf planet where NASA's Dawn mission
found briny water. CERES only says what the engine computed: every sentence is built from
the analysis dict, so it can't invent numbers. An LLM rewrite layer (Task T5.3) may make it
more conversational but must keep these facts and the review reminder.
"""
from __future__ import annotations

from . import AGENT_NAME

MONTHS = {
    "es": ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
}
HAZ = {
    "es": {"frost": "helada", "heat": "calor", "water": "falta de agua", "bare": "suelo desnudo", "salinity": "salinidad"},
    "en": {"frost": "frost", "heat": "heat", "water": "water shortage", "bare": "bare soil", "salinity": "salinity"},
}
CONF = {"es": {"high": "alta", "medium": "media", "low": "baja"}, "en": {"high": "high", "medium": "medium", "low": "low"}}


def _pct(x: float) -> str:
    n = int(round(x))
    return f"{n:+d}" if n else "0"


def _fmt(n: float, lang: str) -> str:
    s = f"{n:,.0f}"
    return s.replace(",", ".") if lang == "es" else s


def _pct1(n: float, lang: str) -> str:
    """Signed percent with one decimal (−24,5 / −24.5), '0' for zero."""
    if abs(n) < 0.05:
        return "0"
    s = f"{n:+.1f}".replace("-", "−")
    return s.replace(".", ",") if lang == "es" else s


def narrate(a: dict, lang: str = "es") -> dict:
    lang = "en" if lang == "en" else "es"
    units = a["units"]
    unit_txt = {"es": "m³ por hectárea al año" if units == "m3" else "mm al año", "en": "m³ per hectare a year" if units == "m3" else "mm a year"}[lang]
    rows = {r["id"]: r for r in a["compare"]["strategies"]}
    cur = next(r for r in rows.values() if r["current"])
    top = rows[a["tradeoffs"]["ranking"][0]["id"]]
    top_prob = a["uncertainty"]["rankFirstProbability"].get(top["id"], 0)
    unc = a["uncertainty"]["strategies"][top["id"]]
    risk_top = a["risk"]["strategies"][top["id"]]["peak"]
    conf = a["uncertainty"]["confidence"]
    synthetic = a["dataQuality"]["climate"] == "synthetic"
    name = top["name"][lang]
    w = lambda s: s["water"].get("expected", s["water"]["p50"])  # noqa: E731
    eco = a["dataQuality"].get("ecostressPoint") or {}
    rr = a["dataQuality"].get("rainRangeMmYr") or {}
    vals = [v for v in rr.values() if v]
    rain_wide = len(vals) > 1 and max(vals) >= 100 and max(vals) > 2 * min(vals)

    bullets: list[str] = []
    if lang == "es":
        bullets.append(f"Hoy, con {cur['name']['es'].lower()}, la parcela usa unos {_fmt(w(cur), lang)} {unit_txt}" + (", según el clima de NASA POWER y la lluvia CHIRPS." if not synthetic else "."))
        if top["id"] != cur["id"]:
            bullets.append(f"Con tus prioridades, la mejor opción es {name}: unos {_fmt(w(top), lang)} {unit_txt}, {_pct1(top['deltas']['waterPct'], lang)} % de agua, {_pct(top['deltas']['soilPts'])} puntos de suelo y {_pct(top['deltas']['incomePct'])}% de ingreso frente a hoy.")
        else:
            bullets.append("Con tus prioridades, tu práctica actual sigue siendo la mejor opción.")
        bullets.append(f"Gana en {round(top_prob * 100)} de cada 100 años simulados. El agua probable va de {_fmt(unc['water']['p10'], lang)} a {_fmt(unc['water']['p90'], lang)}.")
        if risk_top["value"] >= 0.3:
            when = "todo el año" if risk_top.get("yearRound") else f"en {MONTHS['es'][risk_top['month'] - 1]}"
            bullets.append(f"Ojo {when}: riesgo de {HAZ['es'][risk_top['hazard']]}.")
        if rain_wide:
            bullets.append(f"La lluvia aquí es muy incierta: CHIRPS da {_fmt(rr['chirps'], lang)} mm al año, NASA POWER {_fmt(rr.get('power') or 0, lang)} y ERA5 {_fmt(rr.get('era5') or 0, lang)}.")
        if eco and eco.get("representative") is False:
            bullets.append("El punto del mapa parece caer fuera de la chacra, así que no uso ECOSTRESS como medición de tu parcela todavía.")
        bullets.append(f"Confianza {CONF['es'][conf]}." + (" Uso clima de ejemplo hasta tener los datos de NASA POWER." if synthetic else ""))
        bullets.append("Revísalo con la Agencia Agraria o INIA antes de decidir.")
    else:
        bullets.append(f"Today, with {cur['name']['en'].lower()}, the field uses about {_fmt(w(cur), lang)} {unit_txt}" + (", based on NASA POWER climate and CHIRPS rain." if not synthetic else "."))
        if top["id"] != cur["id"]:
            bullets.append(f"With your priorities, the best option is {name}: about {_fmt(w(top), lang)} {unit_txt}, {_pct1(top['deltas']['waterPct'], lang)}% water, {_pct(top['deltas']['soilPts'])} soil points and {_pct(top['deltas']['incomePct'])}% income versus today.")
        else:
            bullets.append("With your priorities, your current practice is still the best option.")
        bullets.append(f"It wins in {round(top_prob * 100)} of 100 simulated years. Likely water use ranges from {_fmt(unc['water']['p10'], lang)} to {_fmt(unc['water']['p90'], lang)}.")
        if risk_top["value"] >= 0.3:
            when = "all year" if risk_top.get("yearRound") else f"in {MONTHS['en'][risk_top['month'] - 1]}"
            bullets.append(f"Watch out {when}: {HAZ['en'][risk_top['hazard']]} risk.")
        if rain_wide:
            bullets.append(f"Rainfall here is very uncertain: CHIRPS gives {_fmt(rr['chirps'], lang)} mm a year, NASA POWER {_fmt(rr.get('power') or 0, lang)} and ERA5 {_fmt(rr.get('era5') or 0, lang)}.")
        if eco and eco.get("representative") is False:
            bullets.append("The map point seems to fall outside the field, so I'm not using ECOSTRESS as your field's measurement yet.")
        bullets.append(f"{CONF['en'][conf].capitalize()} confidence." + (" I'm using example climate until NASA POWER data is loaded." if synthetic else ""))
        bullets.append("Review it with the Agencia Agraria or INIA before deciding.")

    return {"agent": AGENT_NAME, "lang": lang, "text": " ".join(bullets), "bullets": bullets}
