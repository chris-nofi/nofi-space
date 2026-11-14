"""Crop library and rotation calendars."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache

from ..config import DATA


@lru_cache(maxsize=1)
def crops() -> dict:
    return json.loads((DATA / "crops.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def rotations() -> dict:
    return json.loads((DATA / "rotations.json").read_text(encoding="utf-8"))["farms"]


def crop_kc_by_month(crop_id: str, months: int) -> list[float]:
    """Kc for each month of a crop's life. Perennials use kcMonthly by calendar month
    (handled by the caller); annuals use a 4-stage FAO-56 curve split 20/30/30/20 %."""
    c = crops()["crops"][crop_id]
    ini, mid, end = c["kc"]
    out = []
    for i in range(months):
        f = (i + 0.5) / months
        if f <= 0.2:
            kc = ini
        elif f <= 0.5:
            kc = ini + (mid - ini) * (f - 0.2) / 0.3
        elif f <= 0.8:
            kc = mid
        else:
            kc = mid + (end - mid) * (f - 0.8) / 0.2
        out.append(round(kc, 3))
    return out


@dataclass
class MonthSlot:
    crop: str | None = None      # crop id or None (bare)
    kc: float = 0.0
    cover: float = 0.0           # canopy or residue cover 0-1
    residue: bool = False


@dataclass
class YearCalendar:
    weight: float
    slots: list[MonthSlot] = field(default_factory=lambda: [MonthSlot() for _ in range(12)])

    def crops_present(self) -> set[str]:
        return {s.crop for s in self.slots if s.crop}


def expand_year(year: dict) -> YearCalendar:
    """Turn {weight, segments} into 12 month slots (index 0 = January)."""
    lib = crops()["crops"]
    cal = YearCalendar(weight=float(year["weight"]))
    for seg in year["segments"]:
        c = lib[seg["crop"]]
        start = seg["start"] - 1
        n = seg["months"]
        if c.get("kcMonthly"):
            kcs = [c["kcMonthly"][(start + i) % 12] for i in range(n)]
        else:
            kcs = crop_kc_by_month(seg["crop"], n)
        for i in range(n):
            m = (start + i) % 12
            # canopy cover ramps up like Kc
            ramp = 1.0 if c.get("kcMonthly") else min(1.0, kcs[i] / max(c["kc"][1], 0.01))
            cal.slots[m] = MonthSlot(seg["crop"], kcs[i], round(c["cover"] * ramp, 3), False)
        # residue after harvest
        res_cover, res_months = c.get("residue", [0, 0])
        for j in range(res_months):
            m = (start + n + j) % 12
            if cal.slots[m].crop is None:
                cal.slots[m] = MonthSlot(None, 0.0, res_cover, True)
    return cal


def strategy_calendars(farm_id: str, strategy: dict) -> list[YearCalendar]:
    return [expand_year(y) for y in strategy["years"]]


def farm_rotations(farm_id: str) -> dict:
    return rotations()[farm_id]
