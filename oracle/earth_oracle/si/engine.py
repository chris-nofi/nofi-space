"""Agua Clara SI engine: one call → the four modules + seasons + the CERES narrative."""
from __future__ import annotations

import json

import numpy as np

from ..config import CACHE, load_farms
from . import AGENT_NAME
from .climate import DAYS, apply_scenario, baseline_climate, climate_sd, draw
from .library import farm_rotations, strategy_calendars
from .model import feature_rows, load as load_model, ndvi_from_cover, predict
from .seasons import detect, observed_ndvi
from .sim import HAZARDS, simulate
from .voice import narrate

DEFAULT_PRIORITIES = {"water": 0.40, "soil": 0.25, "income": 0.25, "resilience": 0.10}
CRITERIA = ["water", "soil", "income", "resilience"]


def _norm_priorities(p: dict | None) -> dict:
    p = {**DEFAULT_PRIORITIES, **(p or {})}
    p = {k: max(0.0, float(p.get(k, 0))) for k in CRITERIA}
    s = sum(p.values()) or 1.0
    return {k: v / s for k, v in p.items()}


def _criteria(water_use, deficit, soil, income, risk, rainfed: bool) -> np.ndarray:
    """Normalize per call across strategies → matrix (n_strategies × 4), higher is better."""
    water_use, deficit, soil, income, risk = map(np.asarray, (water_use, deficit, soil, income, risk))
    if rainfed:
        sec = 1 - deficit
        water = sec / sec.max() if sec.max() > 0 else np.ones_like(sec)
    else:
        water = water_use.min() / np.maximum(water_use, 1e-9)
    floor = min(0.0, float(income.min()))          # ratio to the best option, shifted if any income is negative
    top = float(income.max()) - floor
    inc = (income - floor) / top if top > 1e-9 else np.ones_like(income)
    return np.column_stack([water, soil / 100, inc, 1 - risk])


def _pareto(m: np.ndarray) -> list[bool]:
    out = []
    for i in range(len(m)):
        dominated = any(np.all(m[j] >= m[i]) and np.any(m[j] > m[i]) for j in range(len(m)) if j != i)
        out.append(not dominated)
    return out


def _q(a: np.ndarray) -> dict:
    p10, p50, p90 = np.percentile(a, [10, 50, 90])
    return {"p10": round(float(p10), 1), "p50": round(float(p50), 1), "p90": round(float(p90), 1)}


def _ecostress_monthly(farm_id: str) -> list[float | None] | None:
    p = CACHE / f"{farm_id}_ecostress.json"
    return json.loads(p.read_text(encoding="utf-8"))["etMonthly"] if p.exists() else None


def analyze(farm_id: str, priorities: dict | None = None, scenario: dict | None = None,
            draws: int = 300, seed: int = 42, lang: str = "es") -> dict:
    farms = load_farms()
    if farm_id not in farms:
        raise KeyError(farm_id)
    farm = farms[farm_id]
    rot = farm_rotations(farm_id)
    strategies = rot["strategies"]
    rainfed = rot["water"] == "rainfed"
    pr = _norm_priorities(priorities)
    sc = {"rainPct": 0.0, "tempDeltaC": 0.0, **(scenario or {})}
    sc["rainPct"] = float(np.clip(sc["rainPct"], -60, 60))
    sc["tempDeltaC"] = float(np.clip(sc["tempDeltaC"], 0, 4))
    supply_factor = max(0.2, 1 + rot.get("supplyRainSensitivity", 0) * sc["rainPct"] / 100)

    base = apply_scenario(baseline_climate(farm_id), sc["rainPct"], sc["tempDeltaC"])
    et0 = base.et0(farm.lat, farm.elevation_m)
    cals = {s["id"]: strategy_calendars(farm_id, s) for s in strategies}
    kw = lambda s: {"supply_factor": supply_factor, "infiltration_bonus": s.get("infiltrationBonus", 0.0)}  # noqa: E731
    cur = next(s for s in strategies if s.get("current"))

    # ---- SI model: fill ECOSTRESS gaps and calibrate the physics ----
    _, card = load_model()
    r_cur = simulate(cals[cur["id"]], base, et0, rot, **kw(cur))
    obs_ndvi = observed_ndvi(farm_id)
    ndvi = obs_ndvi if obs_ndvi is not None else ndvi_from_cover(r_cur.cover)
    pred = predict(feature_rows(farm_id, base, et0, ndvi, not rainfed))
    eco = _ecostress_monthly(farm_id)
    measured = [{
        "month": m + 1,
        "etMmDay": round(float(eco[m]), 2) if eco and eco[m] is not None else round(float(pred["p50"][m]), 2),
        "p10": round(float(pred["p10"][m]), 2), "p90": round(float(pred["p90"][m]), 2),
        "source": "ecostress" if eco and eco[m] is not None else "si-model",
    } for m in range(12)]
    physics_cur = r_cur.actual_mm / DAYS
    seen = np.array([x["etMmDay"] for x in measured])
    calib = float(np.clip(seen.sum() / max(physics_cur.sum(), 1e-9), 0.8, 1.2))

    # ---- deterministic run (shapes, monthly series) ----
    det = {s["id"]: simulate(cals[s["id"]], base, et0, rot, calib=calib, **kw(s)) for s in strategies}

    # ---- Monte Carlo ----
    rng = np.random.default_rng(seed)
    sd = climate_sd(farm_id)
    n = len(strategies)
    W, I, R, D, S = (np.zeros((n, draws)) for _ in range(5))
    H = np.zeros((n, 12, len(HAZARDS)))
    wins = np.zeros(n)
    for d in range(draws):
        c = draw(base, sd, rng)
        e = c.et0(farm.lat, farm.elevation_m)
        kc_s, cal_d = rng.normal(1, 0.08), calib * rng.normal(1, 0.05)
        price, yld = rng.lognormal(0, 0.20), rng.normal(1, 0.12)
        for i, s in enumerate(strategies):
            r = simulate(cals[s["id"]], c, e, rot, kc_scale=kc_s, calib=cal_d, price_factor=price, yield_factor=yld, **kw(s))
            W[i, d], I[i, d], R[i, d], D[i, d], S[i, d] = r.water_use, r.income_pen, r.risk_score, r.deficit_ratio, r.soil
            H[i] += r.hazard
        crit = _criteria(W[:, d], D[:, d], S[:, d], I[:, d], R[:, d], rainfed)
        wins[int(np.argmax(crit @ np.array([pr[k] for k in CRITERIA])))] += 1
    H /= draws

    # ---- module 1: compare ----
    med = {k: np.median(v, axis=1) for k, v in {"water": W, "income": I, "risk": R, "deficit": D, "soil": S}.items()}
    ci = [s["id"] for s in strategies].index(cur["id"])
    compare = []
    for i, s in enumerate(strategies):
        r = det[s["id"]]
        compare.append({
            "id": s["id"], "name": s["name"], "current": bool(s.get("current")), "recommended": bool(s.get("recommended")),
            "water": {"p50": round(float(med["water"][i]), 1), "unit": "m3/ha/yr" if not rainfed else "mm/yr"},
            "waterMonthly": [round(float(v), 1) for v in (r.need_m3 if not rainfed else r.actual_mm)],
            "deficitPct": round(float(med["deficit"][i]) * 100, 1),
            "rechargeMm": round(float(r.recharge_mm.sum()), 1),
            "soil": round(float(med["soil"][i]), 1),
            "incomePenHa": round(float(med["income"][i])),
            "nfixShare": round(r.nfix_share, 2),
            "bareMonths": round(r.bare_months, 1),
            "deltas": {
                "waterPct": round(float((med["water"][i] - med["water"][ci]) / med["water"][ci] * 100), 1) if med["water"][ci] else 0.0,
                "soilPts": round(float(med["soil"][i] - med["soil"][ci]), 1),
                "incomePct": round(float((med["income"][i] - med["income"][ci]) / abs(med["income"][ci]) * 100), 1) if med["income"][ci] else 0.0,
                "riskPts": round(float((med["risk"][i] - med["risk"][ci]) * 100), 1),
            },
        })

    # ---- module 2: trade-offs ----
    crit = _criteria(med["water"], med["deficit"], med["soil"], med["income"], med["risk"], rainfed)
    w = np.array([pr[k] for k in CRITERIA])
    scores = crit @ w
    pareto = _pareto(crit)
    order = np.argsort(-scores)
    tradeoffs = {
        "priorities": pr,
        "criteria": CRITERIA,
        "radar": {s["id"]: {k: round(float(crit[i, j]), 3) for j, k in enumerate(CRITERIA)} for i, s in enumerate(strategies)},
        "ranking": [{"id": strategies[i]["id"], "score": round(float(scores[i]), 3), "paretoOptimal": pareto[i]} for i in order],
        "formula": "score = Σ priority_k × criterion_k; water = least use (irrigated) or least deficit (rainfed), soil = index/100, income = share of the best option, resilience = 1 − risk",
    }

    # ---- module 3: risk ----
    risk = {"hazards": HAZARDS, "strategies": {}}
    for i, s in enumerate(strategies):
        grid = H[i]
        m, h = np.unravel_index(int(np.argmax(grid)), grid.shape)
        risk["strategies"][s["id"]] = {
            "grid": [{"hazard": hz, "monthly": [round(float(v), 3) for v in grid[:, j]]} for j, hz in enumerate(HAZARDS)],
            "peak": {"month": int(m) + 1, "hazard": HAZARDS[h], "value": round(float(grid[m, h]), 3),
                     "yearRound": bool((grid[:, h] >= grid[m, h] - 0.02).sum() >= 9)},
            "riskScore": round(float(med["risk"][i]), 3),
            "vulnerableMonths": [int(k) + 1 for k in np.where(grid.max(axis=1) >= 0.4)[0]],
        }

    # ---- module 4: uncertainty ----
    top = int(order[0])
    drivers = _drivers(farm_id, farm, rot, strategies[top], cals[strategies[top]["id"]], base, et0, sd, calib, supply_factor, seed)
    spread = (np.percentile(W[top], 90) - np.percentile(W[top], 10)) / max(np.median(W[top]), 1e-9)
    p_first = wins[top] / draws
    level = 2 if (spread < 0.25 and p_first >= 0.6) else 1 if (spread < 0.5 and p_first >= 0.35) else 0
    synthetic_inputs = base.source == "synthetic" or "SYNTHETIC" in card["trainingData"]
    if synthetic_inputs:
        level = min(level, 1)
    uncertainty = {
        "draws": draws,
        "strategies": {s["id"]: {"water": _q(W[i]), "incomePenHa": _q(I[i]), "riskScore": _q(R[i] * 100), "deficitPct": _q(D[i] * 100)} for i, s in enumerate(strategies)},
        "rankFirstProbability": {s["id"]: round(float(wins[i] / draws), 3) for i, s in enumerate(strategies)},
        "drivers": drivers,
        "confidence": ["low", "medium", "high"][level],
        "why": _why_conf(spread, p_first, synthetic_inputs),
    }

    # ---- seasons ----
    seasons = {"observed": {**detect(ndvi), "source": "hls" if obs_ndvi is not None else "modeled from crop calendar"}}
    for s in strategies:
        seasons[s["id"]] = detect(ndvi_from_cover(det[s["id"]].cover))

    out = {
        "farmId": farm_id,
        "units": "m3" if not rainfed else "mm",
        "scenario": sc,
        "waterUse": {"current": measured, "calibration": round(calib, 3), "note": "Monthly ET: ECOSTRESS where observed, SI-model p50 with p10–p90 band elsewhere."},
        "compare": {"strategies": compare},
        "tradeoffs": tradeoffs,
        "risk": risk,
        "uncertainty": uncertainty,
        "seasons": seasons,
        "dataQuality": {
            "climate": base.source,
            "model": card["trainingData"],
            "ecostressMonths": sum(1 for x in measured if x["source"] == "ecostress"),
            "hls": obs_ndvi is not None,
            "examplesFlag": "yields, prices and costs are example values pending Agencia Agraria data",
        },
    }
    out["voice"] = {"es": narrate(out, "es"), "en": narrate(out, "en")}
    out["agent"] = AGENT_NAME
    return out


def _drivers(farm_id, farm, rot, strat, cals, base, et0, sd, calib, supply_factor, seed, m: int = 80) -> dict:
    """One-at-a-time variance shares for the top strategy: what drives the spread?"""
    rng = np.random.default_rng(seed + 1)
    kw = {"supply_factor": supply_factor, "infiltration_bonus": strat.get("infiltrationBonus", 0.0)}
    out = {}
    for src in ("climate", "crop model", "market"):
        ws, inc = [], []
        for _ in range(m):
            c, e = base, et0
            kc_s, cal_d, price, yld = 1.0, calib, 1.0, 1.0
            if src == "climate":
                c = draw(base, sd, rng)
                e = c.et0(farm.lat, farm.elevation_m)
            elif src == "crop model":
                kc_s, cal_d = rng.normal(1, 0.08), calib * rng.normal(1, 0.05)
            else:
                price, yld = rng.lognormal(0, 0.20), rng.normal(1, 0.12)
            r = simulate(cals, c, e, rot, kc_scale=kc_s, calib=cal_d, price_factor=price, yield_factor=yld, **kw)
            ws.append(r.water_use)
            inc.append(r.income_pen)
        out[src] = (float(np.var(ws)), float(np.var(inc)))
    wt = sum(v[0] for v in out.values()) or 1.0
    it = sum(v[1] for v in out.values()) or 1.0
    return {
        "water": {k: round(v[0] / wt, 3) for k, v in out.items()},
        "income": {k: round(v[1] / it, 3) for k, v in out.items()},
    }


def _why_conf(spread: float, p_first: float, synthetic: bool) -> dict:
    return {
        "waterSpreadP10toP90": round(float(spread), 3),
        "topRankProbability": round(float(p_first), 3),
        "syntheticInputs": synthetic,
        "rule": "high: spread < 25 % and wins ≥ 60 % of years; medium: spread < 50 % and wins ≥ 35 %; capped at medium while any input is synthetic",
    }
