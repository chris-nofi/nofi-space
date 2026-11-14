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


def package(farm_id: str, period: str) -> dict:
    """What the x402 oracle serves: the record plus its hashes and the integer fields to attest."""
    rec = build_record(farm_id, period)
    return {"record": rec, "dataHash": sha256_hex(rec), "sourcesHash": sha256_hex(rec["sources"]),
            "onchain": onchain_fields(rec), "placeholder": rec["placeholder"]}


def summary(pkg: dict) -> dict:
    """Farmer-safe summary for the 'Registro verificable' view: no wallet, token or price."""
    r = pkg["record"]
    return {"farmId": r["farmId"], "period": r["period"], "dataHash": pkg["dataHash"], "placeholder": pkg["placeholder"],
            "strategy": r["values"]["strategy"], "waterSavedM3": r["values"]["waterSavedM3"],
            "datasets": [s["dataset"] for s in r["sources"] if s["used"]]}


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

