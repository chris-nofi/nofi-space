"""Simulate one strategy under one climate year: water balance, yield-adjusted income,
soil score and a month × hazard grid. Pure numpy, no I/O."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .climate import DAYS, Climate
from .library import YearCalendar, crops

HAZARDS = ["frost", "heat", "water", "bare", "salinity"]
HAZARD_WEIGHTS = {"frost": 0.25, "heat": 0.15, "water": 0.35, "bare": 0.15, "salinity": 0.10}


def effective_rain(p_mm: np.ndarray) -> np.ndarray:
    """FAO/AGLW dependable-rain formula (CROPWAT): 0.8P - 25 if P > 75 mm/month, else max(0.6P - 10, 0).
    Same formula as the real-data pipeline (data/pull_and_build.py), so engine and evidence agree."""
    p = np.asarray(p_mm, float)
    return np.where(p > 75, 0.8 * p - 25, np.maximum(0.6 * p - 10, 0.0))


def _sig(x: np.ndarray | float) -> np.ndarray:
    return 1 / (1 + np.exp(-np.asarray(x, float)))


@dataclass
class SimResult:
    etc_mm: np.ndarray        # crop water demand per month
    actual_mm: np.ndarray     # water actually consumed (ET) per month
    deficit_mm: np.ndarray    # unmet demand per month
    need_m3: np.ndarray       # irrigation need per month (m³/ha), 0 for rainfed
    recharge_mm: np.ndarray   # water left in the basin (deep percolation/runoff), rainfed
    cover: np.ndarray         # mean soil cover per month
    hazard: np.ndarray        # 12 × len(HAZARDS)
    income_pen: float         # per ha per year
    soil: float               # 0–100
    nfix_share: float
    bare_months: float

    @property
    def water_use(self) -> float:
        """Headline water number: irrigated → m³/ha/yr from the canal; rainfed → mm/yr consumed."""
        return float(self.need_m3.sum()) if self.need_m3.any() else float(self.actual_mm.sum())

    @property
    def deficit_ratio(self) -> float:
        d = self.etc_mm.sum()
        return float(self.deficit_mm.sum() / d) if d > 0 else 0.0

    @property
    def risk_score(self) -> float:
        w = np.array([HAZARD_WEIGHTS[h] for h in HAZARDS])
        return float((self.hazard * w).sum(axis=1).mean() / w.sum())


def simulate(
    cals: list[YearCalendar],
    clim: Climate,
    et0: np.ndarray,
    rot: dict,
    *,
    kc_scale: float = 1.0,
    calib: float = 1.0,
    price_factor: float = 1.0,
    yield_factor: float = 1.0,
    supply_factor: float = 1.0,
    infiltration_bonus: float = 0.0,
    efficiency: float = 1.0,
    cover_efficiency: float = 1.0,
    supply: np.ndarray | None = None,
) -> SimResult:
    """Monthly water balance. Irrigated `need_m3` is GROSS water applied at the field:
    net crop need / application efficiency (FAO Training Manual 4: surface 0.60, sprinkler 0.75,
    drip 0.90), plus any irrigated inter-row cover (crop `coverKcMonthly`) / `cover_efficiency`."""
    lib = crops()["crops"]
    bare = crops()["bare"]
    irrigated = rot["water"] == "irrigated"
    peff = effective_rain(clim.rain_mm)
    if supply is None:
        supply = np.array(rot.get("supplyM3HaMonth", [1e9] * 12), float)
    supply = np.asarray(supply, float) * supply_factor
    farm_salinity = rot.get("irrigationSalinity", "low")

    agg = {k: np.zeros(12) for k in ("etc", "act", "def", "need", "rech", "cover")}
    hazard = np.zeros((12, len(HAZARDS)))
    income = 0.0
    families: set[str] = set()
    nfix_months = crop_months = bare_months = 0.0
    wet_bare = 0.0
    max_root = 0.0

    for cal in cals:
        w = cal.weight
        storage = rot.get("soilBucketMm", 100) * 0.5
        etc = np.zeros(12)
        act = np.zeros(12)
        dfc = np.zeros(12)
        need = np.zeros(12)
        rech = np.zeros(12)
        crop_deficit: dict[str, list[float]] = {}
        for m in range(12):
            s = cal.slots[m]
            if s.crop:
                kc = s.kc * kc_scale
            else:
                kc = bare["kcWet"] if clim.rain_mm[m] > 20 else bare["kcDry"]
            etc[m] = kc * et0[m] * DAYS[m] * calib
            cover_mm = (lib[s.crop].get("coverKcMonthly") or [0.0] * 12)[m] * kc_scale * et0[m] * DAYS[m] * calib if s.crop else 0.0
            if irrigated:
                need_mm = max(0.0, etc[m] - peff[m]) if s.crop else 0.0
                need[m] = (need_mm / efficiency + cover_mm / cover_efficiency) * 10
                short_m3 = max(0.0, need[m] - supply[m])
                dfc[m] = min(need_mm, short_m3 / 10 * efficiency)
                etc[m] += cover_mm
                act[m] = etc[m] - dfc[m]
            else:
                p_in = peff[m] * (1 + (infiltration_bonus if s.cover >= 0.5 or not s.crop else 0.0))
                avail = storage + p_in
                act[m] = min(etc[m], avail)
                dfc[m] = etc[m] - act[m] if s.crop else 0.0
                storage = avail - act[m]
                cap = rot.get("soilBucketMm", 100)
                if storage > cap:
                    rech[m] = storage - cap
                    storage = cap
            if s.crop:
                crop_deficit.setdefault(s.crop, []).append(dfc[m] / etc[m] if etc[m] > 0 else 0.0)

            # hazards for this month
            c = lib.get(s.crop) if s.crop else None
            hz = hazard[m]
            if c:
                hz[0] += w * float(_sig((c["frostC"] - clim.tmin[m]) / 0.8))
                hz[1] += w * float(_sig((clim.tmax[m] - c["heatC"]) / 0.8))
                hz[2] += w * float(min(1.0, (dfc[m] / etc[m]) / 0.3 if etc[m] > 0 else 0.0))
                hz[4] += w * {"high": {"low": 0.7, "medium": 0.3, "high": 0.0}}.get(farm_salinity, {}).get(c["salinity"], 0.0)
            hz[3] += w * float(np.clip((0.5 - s.cover) / 0.5, 0, 1))  # share of exposed soil

        # per-year aggregates
        for name, arr in (("etc", etc), ("act", act), ("def", dfc), ("need", need), ("rech", rech)):
            agg[name] += w * arr
        agg["cover"] += w * np.array([sl.cover for sl in cal.slots])

        for crop_id, defs in crop_deficit.items():
            c = lib[crop_id]
            loss = min(1.0, float(np.mean(defs)))  # Ky ≈ 1 simplification
            months_share = 1.0 if c.get("perennial") or c["months"] >= 12 else 1.0
            income += w * months_share * (c["yieldT"] * yield_factor * (1 - loss) * c["pricePenT"] * price_factor - c["costPenHa"])
            families.update(c["family"].split("+"))
            max_root = max(max_root, c["rootM"])
        for sl in cal.slots:
            if sl.crop:
                crop_months += w
                if lib[sl.crop]["nfix"]:
                    nfix_months += w
            elif sl.cover < 0.3:
                bare_months += w
        for m, sl in enumerate(cal.slots):
            if not sl.crop and sl.cover < 0.3 and clim.rain_mm[m] > 30:
                wet_bare += w

    nfix_share = nfix_months / crop_months if crop_months else 0.0
    soil = soil_score(nfix_share, float(agg["cover"].mean()), len(families), max_root, wet_bare, len({c for cal in cals for c in cal.crops_present()}))
    return SimResult(agg["etc"], agg["act"], agg["def"], agg["need"], agg["rech"], agg["cover"], np.clip(hazard, 0, 1), income, soil, nfix_share, bare_months)


def soil_score(nfix_share: float, mean_cover: float, n_families: int, max_root: float, wet_bare_months: float, n_crops: int) -> float:
    """Transparent 0–100 soil-health index (documented in docs/07_SI_MODEL.md)."""
    s = 30.0
    s += 20 * min(1.0, nfix_share / 0.4)          # nitrogen fixation
    s += 35 * mean_cover                           # protection from erosion/evaporation
    s += 5 * min(3, max(0, n_families - 1))        # diversity breaks pest cycles
    s += 5 if max_root >= 1.0 else 0               # deep roots: infiltration, structure
    s -= 10 if n_crops <= 1 and n_families <= 1 else 0  # monoculture
    s -= 4 * wet_bare_months                       # bare soil in rainy months → erosion
    return float(np.clip(s, 0, 100))
