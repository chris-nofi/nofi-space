"""Seasonal transitions and bare-field windows from an NDVI series.

Uses the HLS cache when present; otherwise derives a monthly NDVI curve from the
current practice's crop calendar (flagged as modeled)."""
from __future__ import annotations

import json

import numpy as np

from ..config import CACHE

BARE, GREEN = 0.25, 0.35


def _windows(mask: np.ndarray) -> list[tuple[int, int]]:
    """Contiguous True runs on a circular 12-month year → [(start, length)] (0-based months)."""
    if mask.all():
        return [(0, 12)]
    if not mask.any():
        return []
    start = int(np.argmin(mask))  # begin scanning just after a False month
    runs, i = [], 0
    while i < 12:
        m = (start + i) % 12
        if mask[m]:
            j = i
            while j < 12 and mask[(start + j) % 12]:
                j += 1
            runs.append(((start + i) % 12, j - i))
            i = j
        else:
            i += 1
    return runs


def detect(ndvi_monthly: np.ndarray) -> dict:
    nd = np.asarray(ndvi_monthly, float)
    bare = _windows(nd < BARE)
    green_up = [m for m in range(12) if nd[m - 1] < GREEN <= nd[m]]
    senescence = [m for m in range(12) if nd[m - 1] >= GREEN > nd[m]]
    return {
        "ndviMonthly": [round(float(v), 3) for v in nd],
        "bareWindows": [{"startMonth": s + 1, "months": n} for s, n in bare],
        "bareMonths": int((nd < BARE).sum()),
        "greenUpMonths": [m + 1 for m in green_up],
        "senescenceMonths": [m + 1 for m in senescence],
        "thresholds": {"bare": BARE, "green": GREEN},
    }


def observed_ndvi(farm_id: str) -> np.ndarray | None:
    """HLS 30 m from a fresh pull first; else MODIS monthly from the real package, only where the
    pixel represents the field (Kepler: not at Samegua / El Algarrobal)."""
    p = CACHE / f"{farm_id}_hls.json"
    if not p.exists():
        from ..real_data import read_input

        m = read_input(f"{farm_id}_ndvi.json")
        if m and m.get("representative") and m.get("monthly") and all(v is not None for v in m["monthly"]):
            return np.array(m["monthly"], float)
        return None
    series = json.loads(p.read_text(encoding="utf-8"))["series"]
    by_m: dict[int, list[float]] = {}
    for s in series:
        if s.get("ndvi") is not None:
            by_m.setdefault(int(s["date"][5:7]) - 1, []).append(s["ndvi"])
    if len(by_m) < 9:
        return None
    nd = np.array([np.median(by_m[m]) if m in by_m else np.nan for m in range(12)])
    # fill gaps circularly
    idx = np.arange(12)
    ok = ~np.isnan(nd)
    return np.interp(idx, np.concatenate([idx[ok] - 12, idx[ok], idx[ok] + 12]), np.tile(nd[ok], 3))
