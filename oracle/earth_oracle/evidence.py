"""Evidence pack: every number behind a payout, hashed so the chain can anchor it."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from eth_utils import keccak

from . import __version__
from .config import CACHE, Farm
from .sign import RULE_PER_M3, RULE_PER_PRACTICE


def plot_hash(farm: Farm) -> str:
    """keccak256(polygon GeoJSON + salt). Coordinates never go on-chain."""
    payload = json.dumps({"type": "Polygon", "coordinates": [farm.polygon]}, separators=(",", ":"), sort_keys=True) + farm.salt
    return "0x" + keccak(text=payload).hex()


def canonical(obj: dict) -> bytes:
    return json.dumps(obj, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")


def evidence_hash(pack: dict) -> str:
    return "0x" + keccak(canonical(pack)).hex()


def _read(name: str) -> dict | None:
    p = CACHE / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def build_pack(farm: Farm, season: int, measured_value: float | None = None, compliance_bps: int | None = None) -> dict:
    """Assemble the evidence pack from cached NASA pulls.

    For m³ mode, `measured_value` is this season's use in m³/ha (from ECOSTRESS);
    for practice mode, `compliance_bps` comes from the HLS/DSWx checks.
    Missing pieces are recorded as such, never invented.
    """
    power = _read(f"{farm.id}_power.json")
    eco = _read(f"{farm.id}_ecostress.json")
    hls = _read(f"{farm.id}_hls.json")

    crop_alive = hls["cropAlive"] if hls else None
    if farm.mode == "m3":
        baseline = farm.raw["baseline_m3_ha_year"]
        if measured_value is None and eco and all(v is not None for v in eco["etMonthly"]):
            measured_value = sum(eco["etMonthly"]) * 30 * 10
        saved_total = max(0, round((baseline - (measured_value or baseline)) * farm.area_ha))
        rule, value = RULE_PER_M3, saved_total
    else:
        rule, value = RULE_PER_PRACTICE, int(compliance_bps or 0)

    return {
        "schema": "agua-clara/evidence-pack@1",
        "oracleVersion": __version__,
        "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "plotId": plot_hash(farm),
        "season": season,
        "areaHa": farm.area_ha,
        "rule": rule,
        "value": value,
        "cropAlive": crop_alive,
        "metrics": {
            "baselineM3HaYear": farm.raw.get("baseline_m3_ha_year"),
            "measuredM3HaSeason": round(measured_value) if measured_value else None,
            "complianceBps": compliance_bps,
        },
        "datasets": {
            "ecostress": {"product": "ECO_L3T_JET", "monthsWithData": eco["monthsWithData"] if eco else 0, "granules": [o["granule"] for o in eco["overpasses"]] if eco else []},
            "hls": {"products": ["HLSL30", "HLSS30"], "points": len(hls["series"]) if hls else 0},
            "power": {"endpoint": "temporal/monthly/point", "available": bool(power)},
        },
        "thresholds": {"ndviMedianMin": 0.35, "ndviFloor": 0.2, "maxLowDays": 60},
        "limits": [
            "ECOSTRESS measures water consumed, not delivered.",
            "POWER and IMERG are regional (not field-level).",
            "Thresholds are starting points pending local expert review.",
        ],
    }
