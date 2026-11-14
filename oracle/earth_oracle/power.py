"""NASA POWER monthly point data (no login) → climatology + FAO-56 ET0."""
from __future__ import annotations

import json
from statistics import mean

import requests

from .config import CACHE, Farm
from .et0 import monthly_et0

POWER_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"
PARAMS = ["T2M_MAX", "T2M_MIN", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN", "RH2M", "WS2M"]
DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def fetch_power(farm: Farm, start: int = 2015, end: int = 2025) -> dict:
    """Raw POWER JSON for the farm point. Monthly endpoint takes years."""
    params = {
        "parameters": ",".join(PARAMS),
        "community": "AG",
        "latitude": farm.lat,
        "longitude": farm.lon,
        "start": str(start),
        "end": str(end),
        "format": "JSON",
    }
    r = requests.get(POWER_URL, params=params, timeout=120)
    r.raise_for_status()
    return r.json()


def climatology(raw: dict) -> dict[str, list[float]]:
    """Average each parameter by calendar month across years, skipping fill values (-999)
    and the annual key (YYYY13)."""
    out: dict[str, list[float]] = {}
    params = raw["properties"]["parameter"]
    for name, series in params.items():
        months: list[list[float]] = [[] for _ in range(12)]
        for key, val in series.items():
            mm = int(key[-2:])
            if 1 <= mm <= 12 and val is not None and val > -900:
                months[mm - 1].append(float(val))
        out[name] = [round(mean(v), 3) if v else float("nan") for v in months]
    return out


def solar_to_mj(values: list[float], units: str) -> list[float]:
    u = units.lower()
    if "kw" in u:  # kW-hr/m^2/day → MJ/m^2/day
        return [v * 3.6 for v in values]
    return values


def summarize(farm: Farm, raw: dict) -> dict:
    clim = climatology(raw)
    units = {k: v.get("units", "") for k, v in raw.get("parameters", {}).items()}
    rs = solar_to_mj(clim["ALLSKY_SFC_SW_DWN"], units.get("ALLSKY_SFC_SW_DWN", "kW-hr/m^2/day"))
    et0 = monthly_et0(clim["T2M_MAX"], clim["T2M_MIN"], rs, clim["WS2M"], clim["RH2M"], farm.lat, farm.elevation_m)
    rain_mm_day = clim["PRECTOTCORR"]
    return {
        "farmId": farm.id,
        "source": "NASA POWER monthly, community=AG",
        "years": raw.get("header", {}).get("start", ""),
        "tmaxMonthly": clim["T2M_MAX"],
        "tminMonthly": clim["T2M_MIN"],
        "rainMmDayMonthly": rain_mm_day,
        "rainYearMm": round(sum(r * d for r, d in zip(rain_mm_day, DAYS)), 1),
        "rsMjMonthly": [round(v, 2) for v in rs],
        "rhMonthly": clim["RH2M"],
        "u2Monthly": clim["WS2M"],
        "et0Monthly": et0,
        "tminColdest": round(min(clim["T2M_MIN"]), 1),
        "note": "POWER grid is ~0.5 deg: regional, not field-level. Temperatures not lapse-rate corrected to the farm elevation yet.",
    }


def pull_and_cache(farm: Farm) -> dict:
    raw = fetch_power(farm)
    (CACHE / f"{farm.id}_power_raw.json").write_text(json.dumps(raw), encoding="utf-8")
    summary = summarize(farm, raw)
    (CACHE / f"{farm.id}_power.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary
