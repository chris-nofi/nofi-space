"""Monthly climate for a farm: NASA POWER cache when present, synthetic fallback otherwise.
Also generates Monte Carlo climate draws and applies scenario sliders."""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, replace

import numpy as np

from ..config import CACHE, DATA, load_farms
from ..et0 import monthly_et0

DAYS = np.array([31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])


@dataclass(frozen=True)
class Climate:
    tmax: np.ndarray
    tmin: np.ndarray
    rain_mm: np.ndarray      # monthly totals
    rh: np.ndarray
    u2: np.ndarray
    rs_mj: np.ndarray
    source: str              # "nasa-power" | "synthetic"

    def et0(self, lat: float, elev: float) -> np.ndarray:
        return np.array(monthly_et0(list(self.tmax), list(self.tmin), list(self.rs_mj), list(self.u2), list(self.rh), lat, elev))


def baseline_climate(farm_id: str) -> Climate:
    power = CACHE / f"{farm_id}_power.json"
    if power.exists():
        p = json.loads(power.read_text(encoding="utf-8"))
        return Climate(
            np.array(p["tmaxMonthly"]), np.array(p["tminMonthly"]),
            np.array(p["rainMmDayMonthly"]) * DAYS, np.array(p["rhMonthly"]),
            np.array(p["u2Monthly"]), np.array(p["rsMjMonthly"]), "nasa-power",
        )
    f = json.loads((DATA / "climate_fallback.json").read_text(encoding="utf-8"))["farms"][farm_id]
    return Climate(
        np.array(f["tmax"], float), np.array(f["tmin"], float), np.array(f["rainMm"], float),
        np.array(f["rh"], float), np.array(f["u2"], float), np.array(f["rsMj"], float), "synthetic",
    )


def climate_sd(farm_id: str) -> dict:
    f = json.loads((DATA / "climate_fallback.json").read_text(encoding="utf-8"))["farms"][farm_id]
    return f["sd"]


def apply_scenario(c: Climate, rain_pct: float = 0.0, temp_delta: float = 0.0) -> Climate:
    """Scenario sliders: rain change in % (−50..+50) and warming in °C (0..+3)."""
    return replace(c, tmax=c.tmax + temp_delta, tmin=c.tmin + temp_delta, rain_mm=c.rain_mm * (1 + rain_pct / 100))


def draw(c: Climate, sd: dict, rng: np.random.Generator) -> Climate:
    """One plausible year: correlated monthly anomalies (AR(1)) and a lognormal rain factor."""
    def ar1(scale: float) -> np.ndarray:
        e = rng.normal(0, scale, 12)
        out = np.empty(12)
        out[0] = e[0]
        for i in range(1, 12):
            out[i] = 0.6 * out[i - 1] + math.sqrt(1 - 0.36) * e[i]
        return out

    year_rain = rng.lognormal(-sd["rainLog"] ** 2 / 2, sd["rainLog"])
    month_rain = rng.lognormal(-0.25 ** 2 / 2, 0.25, 12)
    return replace(
        c,
        tmax=c.tmax + ar1(sd["tmax"]),
        tmin=c.tmin + ar1(sd["tmin"]),
        rain_mm=c.rain_mm * year_rain * month_rain,
        rs_mj=c.rs_mj * rng.normal(1, 0.04, 12),
    )


def farm_meta(farm_id: str):
    return load_farms()[farm_id]
