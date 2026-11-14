"""Earth records (plan v2): one evidence JSON per farm per month.

Each record holds the values CERES uses (ET, ET0, rain, NDVI, recommended strategy, water saved),
the NASA dataset and granule IDs behind them, and the engine fingerprint. Its sha256 over canonical
JSON is the `dataHash` that WaterProofRegistry anchors on the NØFI L1, and the x402 oracle sells
exactly these bytes, so a buyer can call `verify(farmId, period, dataHash)` on what they bought.

`placeholder: true` whenever any input is synthetic or modeled. Never attest a placeholder record.
"""
from __future__ import annotations

import hashlib
import json
from functools import lru_cache
from pathlib import Path

from . import __version__
from .config import CACHE, load_farms
from .evidence import plot_hash
from .si.climate import baseline_climate
from .si.engine import analyze
from .si.library import farm_rotations, strategy_calendars
from .si.model import ndvi_from_cover
from .si.seasons import observed_ndvi
from .si.sim import simulate

SCHEMA = "ceres-ventures/earth-record@1"
ENGINE_DIR = Path(__file__).parent


def canonical(obj) -> bytes:
    """Sorted keys, no whitespace, UTF-8. Same bytes in Python and JS (JSON.stringify of a key-sorted object)."""
    return json.dumps(obj, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")


def sha256_hex(obj) -> str:
    return "0x" + hashlib.sha256(canonical(obj)).hexdigest()


@lru_cache(maxsize=1)
def engine_sha() -> str:
    """Fingerprint of the engine source (reproducible without git)."""
    h = hashlib.sha256()
    files = sorted([*ENGINE_DIR.glob("*.py"), *(ENGINE_DIR / "si").glob("*.py")])
    for p in files:
        h.update(p.name.encode())
        h.update(p.read_bytes())
    return "0x" + h.hexdigest()


def _cache(name: str) -> dict | None:
    p = CACHE / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def _parse_period(period: str) -> tuple[int, int]:
    if len(period) != 6 or not period.isdigit() or not 1 <= int(period[4:]) <= 12:
        raise ValueError("period must be YYYYMM")
    return int(period[:4]), int(period[4:])


@lru_cache(maxsize=16)
def _farm_year(farm_id: str) -> dict:
    """Engine run (default priorities) + deterministic monthly series for current vs recommended."""
    farm = load_farms()[farm_id]
    a = analyze(farm_id, draws=150)
    rot = farm_rotations(farm_id)
    strategies = {s["id"]: s for s in rot["strategies"]}
    cur = next(s for s in rot["strategies"] if s.get("current"))
    ranking = [r["id"] for r in a["tradeoffs"]["ranking"]]
    rec_id = next((r for r in ranking if r != cur["id"]), cur["id"])
    clim = baseline_climate(farm_id)
    et0 = clim.et0(farm.lat, farm.elevation_m)
    calib = a["waterUse"]["calibration"]

    def run(s):
        return simulate(strategy_calendars(farm_id, s), clim, et0, rot, calib=calib,
                        infiltration_bonus=s.get("infiltrationBonus", 0.0))

    r_cur, r_rec = run(cur), run(strategies[rec_id])
    obs = observed_ndvi(farm_id)
    return {
        "analysis": a, "rot": rot, "cur": cur, "rec": strategies[rec_id], "climate": clim, "et0": et0,
        "r_cur": r_cur, "r_rec": r_rec,
        "ndvi": obs if obs is not None else ndvi_from_cover(r_cur.cover), "ndvi_observed": obs is not None,
    }


def build_record(farm_id: str, period: str) -> dict:
    """The record that gets hashed. Deterministic: no timestamps, no random state."""
    farms = load_farms()
    if farm_id not in farms:
        raise KeyError(farm_id)
    farm = farms[farm_id]
    year, month = _parse_period(period)
    m = month - 1
    y = _farm_year(farm_id)
    wu = y["analysis"]["waterUse"]["current"][m]
    irrigated = y["rot"]["water"] == "irrigated"

    if irrigated:
        saved = (float(y["r_cur"].need_m3[m]) - float(y["r_rec"].need_m3[m])) * farm.area_ha
        basis = "canal irrigation need, current minus recommended, m³ for the whole plot"
    else:
        saved = (float(y["r_rec"].recharge_mm[m]) - float(y["r_cur"].recharge_mm[m])) * 10 * farm.area_ha
        basis = "extra water kept in the basin (infiltration/recharge), recommended minus current, m³ for the whole plot"

    eco = _cache(f"{farm_id}_ecostress.json")
    granules = [o["granule"] for o in (eco or {}).get("overpasses", []) if o["date"].startswith(f"{year:04d}-{month:02d}")]
    hls = _cache(f"{farm_id}_hls.json")
    hls_ids = [s.get("granule") or s["date"] for s in (hls or {}).get("series", []) if s["date"].startswith(f"{year:04d}-{month:02d}")]
    power_real = y["climate"].source == "nasa-power"

    sources = [
        {"dataset": "NASA POWER", "id": "POWER temporal/monthly/point (T2M_MAX, T2M_MIN, RH2M, WS2M, ALLSKY_SFC_SW_DWN, PRECTOTCORR)",
         "used": power_real, "note": None if power_real else "synthetic climatology until the POWER pull runs"},
        {"dataset": "ECOSTRESS", "id": "ECO_L3T_JET", "granules": granules, "used": wu["source"] == "ecostress"},
        {"dataset": "HLS", "id": "HLSL30/HLSS30 NDVI", "granules": hls_ids, "used": y["ndvi_observed"]},
        {"dataset": "GPM IMERG", "id": "GPM_3IMERGDL", "used": False, "note": "rain comes from POWER until the IMERG pull runs"},
    ]
    placeholder = not (power_real and wu["source"] == "ecostress" and y["ndvi_observed"])

    return {
        "schema": SCHEMA,
        "farmId": farm_id,
        "plotId": plot_hash(farm),
        "period": period,
        "areaHa": farm.area_ha,
        "values": {
            "etMmDay": round(float(wu["etMmDay"]), 2),
            "etSource": wu["source"],
            "et0MmDay": round(float(y["et0"][m]), 2),
            "rainMm": round(float(y["climate"].rain_mm[m]), 1),
            "ndvi": round(float(y["ndvi"][m]), 3),
            "ndviSource": "hls" if y["ndvi_observed"] else "modeled",
            "strategyCurrent": y["cur"]["id"],
            "strategy": y["rec"]["id"],
            "waterSavedM3": round(max(saved, 0.0)),
            "waterSavedBasis": basis,
        },
        "sources": sources,
        "engine": {"name": "earth_oracle", "version": __version__, "sha256": engine_sha()},
        "placeholder": placeholder,
        "limits": [
            "ECOSTRESS measures water consumed, not water delivered.",
            "POWER and IMERG are regional, not field-level.",
            "Yields, prices and canal supply are example values pending Agencia Agraria data.",
        ],
    }


def onchain_fields(record: dict) -> dict:
    """Integer fields for WaterProofRegistry.attest (scale factors explicit). Adapt names to the
    deployed ABI in avalanche/src/WaterProofRegistry.sol when that folder is merged."""
    v = record["values"]
    return {
        "farmId": record["farmId"],
        "period": int(record["period"]),
        "etMmDayX100": int(round(v["etMmDay"] * 100)),
        "et0MmDayX100": int(round(v["et0MmDay"] * 100)),
        "rainMmX10": int(round(v["rainMm"] * 10)),
        "ndviX1000": int(round(v["ndvi"] * 1000)),
        "strategy": v["strategy"],
        "waterSavedM3": int(v["waterSavedM3"]),
        "creditEligible": v["ndvi"] >= 0.20,  # no credit if the field is bare or dead
    }


EVIDENCE_DIR = Path(__file__).resolve().parents[2] / "avalanche" / "oracle" / "evidence"
STRATEGY_IDS = {"drip + strip cover": "drip", "deficit": "deficit", "cover": "cover", "current": "current"}


def evidence_path(farm_id: str, period: str) -> Path:
    return EVIDENCE_DIR / f"{farm_id}-{period}.json"


def evidence_issues(ev: dict) -> list[dict]:
    """Why a real evidence record must not be attested yet (Kepler §8)."""
    ind, out = ev.get("indicators", {}), []
    for k, v in ind.items():
        if v.get("value") is None:
            out.append({"code": f"{k}_missing", "es": f"{k}: sin observación válida este mes ({v.get('reason', 'sin dato')}); no se ancla como 0.",
                        "en": f"{k}: no valid observation this month ({v.get('reason', 'no data')}); never encode it as 0."})
    et = ind.get("et_mm") or {}
    if et.get("value") == 0 and "1 valid overpass" in str(et.get("stat", "")):
        out.append({"code": "et_single_zero", "es": "ECOSTRESS: una sola pasada válida este mes y marca 0 mm (probable pasada de madrugada); confirmar antes de anclar.",
                    "en": "ECOSTRESS: a single valid overpass this month reading 0 mm (likely a pre-dawn pass); confirm before attesting."})
    farm = str(ev.get("farmKey", "")).split(":")[-1]
    from .real_data import REPRESENTATIVE

    if REPRESENTATIVE.get(farm, {}).get("ecostress") is False:
        fp = (ev.get("_context") or {}).get("fieldPixel")
        where = f" ({fp['lat']}, {fp['lon']})" if fp else ""
        where_en = where
        out.append({"code": "point_off_field", "es": f"El punto de la app cae en suelo desnudo; el registro usa un píxel de cultivo provisional{where}. Confirmar la chacra con el agricultor antes de anclar.",
                    "en": f"The app point is bare ground; the record uses a provisional crop pixel{where_en}. Confirm the field with the farmer before attesting."})
    nd = (ind.get("ndvi") or {}).get("value")
    if nd is not None and nd < 0.20:
        out.append({"code": "ndvi_below_0.20", "es": f"NDVI {nd} < 0,20: la regla anti-abandono bloquearía el crédito; mover el punto a la chacra antes de anclar.",
                    "en": f"NDVI {nd} < 0.20: the anti-abandonment rule would block a credit; move the point onto the field before attesting."})
    return out


def _from_evidence(farm_id: str, period: str) -> dict | None:
    p = evidence_path(farm_id, period)
    if not p.exists():
        return None
    ev = json.loads(p.read_text(encoding="utf-8"))
    ind, eng = ev.get("indicators", {}), ev.get("engine", {})
    sources = {k: {kk: v.get(kk) for kk in ("dataset", "granules", "composites", "substituteFor", "scale") if v.get(kk) is not None} for k, v in ind.items()}
    issues = evidence_issues(ev)
    val = lambda k, scale: None if (ind.get(k) or {}).get("value") is None else int(round(ind[k]["value"] * scale))  # noqa: E731
    onchain = {
        "farmKey": ev.get("farmKey"), "period": int(ev.get("period")), "revision": ev.get("revision", 0),
        "etMmX10": val("et_mm", 10), "et0MmX10": val("et0_mm", 10), "precipMmX10": val("precip_mm", 10), "ndviX1000": val("ndvi", 1000),
        "recommendedStrategyId": eng.get("recommendedStrategyId"), "waterSavedM3": eng.get("waterSavedM3"),
        "creditEligible": not any(i["code"] == "ndvi_below_0.20" for i in issues),
        "note": "null = no observation: skip or use a documented sentinel, never 0 (CONNECT-REAL-DATA §8)",
    }
    return {"record": ev, "dataHash": sha256_hex(ev), "sourcesHash": sha256_hex(sources), "onchain": onchain,
            "placeholder": False, "source": "evidence", "issues": issues, "attestable": not issues,
            "hashNote": "sha256 over canonical JSON of the whole file; confirm it matches avalanche/oracle/build-attestation.mjs before attesting"}


def package(farm_id: str, period: str) -> dict:
    """What the x402 oracle serves. Real evidence file (avalanche/oracle/evidence) when it exists for that
    farm-month; otherwise an engine-built record from the climatology, always marked placeholder."""
    real = _from_evidence(farm_id, period)
    if real:
        return real
    rec = build_record(farm_id, period)
    return {"record": rec, "dataHash": sha256_hex(rec), "sourcesHash": sha256_hex(rec["sources"]),
            "onchain": onchain_fields(rec), "placeholder": True, "source": "engine", "attestable": False,
            "issues": [{"code": "no_month_evidence", "es": "Sin archivo de evidencia real para este mes: valores de climatología.", "en": "No real evidence file for this month: climatology values."}]}


def record_values(pkg: dict) -> dict:
    """Same shape for both record kinds, for CERES and the site."""
    r = pkg["record"]
    if pkg.get("source") != "evidence":
        return r["values"]
    ind, eng = r.get("indicators", {}), r.get("engine", {})
    g = lambda k: (ind.get(k) or {}).get("value")  # noqa: E731
    return {
        "etMm": g("et_mm"), "etDataset": (ind.get("et_mm") or {}).get("dataset"), "etStat": (ind.get("et_mm") or {}).get("stat"),
        "et0Mm": g("et0_mm"), "precipMm": g("precip_mm"), "precipDataset": (ind.get("precip_mm") or {}).get("dataset"),
        "ndvi": g("ndvi"), "ndviDataset": (ind.get("ndvi") or {}).get("dataset"),
        "strategy": STRATEGY_IDS.get(eng.get("recommendedStrategy"), str(eng.get("recommendedStrategy", "")).removesuffix(" rotation")),
        "strategyLabel": eng.get("recommendedStrategy"), "waterSavedM3": eng.get("waterSavedM3"),
        "waterSavedBasis": eng.get("waterSavedBasis"), "confidence": eng.get("confidence"),
    }


def summary(pkg: dict) -> dict:
    """Farmer-safe summary for the 'Registro verificable' view: no wallet, token or price."""
    r, v = pkg["record"], record_values(pkg)
    if pkg.get("source") == "evidence":
        datasets = sorted({x.get("dataset") for x in r.get("indicators", {}).values() if x.get("value") is not None and x.get("dataset")})
        farm, period = r.get("farmKey", "").split(":")[-1], str(r.get("period"))
    else:
        datasets = [s["dataset"] for s in r["sources"] if s["used"]]
        farm, period = r["farmId"], r["period"]
    return {"farmId": farm, "period": period, "dataHash": pkg["dataHash"], "placeholder": pkg["placeholder"],
            "source": pkg.get("source"), "attestable": pkg.get("attestable", False),
            "issues": [{"es": i["es"], "en": i["en"]} for i in pkg.get("issues", [])],
            "strategy": v.get("strategy"), "waterSavedM3": v.get("waterSavedM3"),
            "et0Mm": v.get("et0Mm"), "etMm": v.get("etMm"), "ndvi": v.get("ndvi"), "precipMm": v.get("precipMm"),
            "datasets": datasets}


def verify_bytes(record: dict, data_hash: str) -> bool:
    """Off-chain twin of WaterProofRegistry.verify: does this record hash to the anchored value?"""
    return sha256_hex(record) == data_hash.lower()


def export(out_dir: Path, periods: list[str], farm_ids: list[str] | None = None) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for fid in farm_ids or list(load_farms()):
        for p in periods:
            pkg = package(fid, p)
            path = out_dir / f"{fid}-{p}.json"
            path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            written.append(path)
    return written

