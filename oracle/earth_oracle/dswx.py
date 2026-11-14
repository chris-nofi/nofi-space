"""OPERA DSWx-HLS water surface over a reservoir bounding box.

Class values: 1 = open water, 2 = partial surface water. Pixels are 30 m (900 m²).
Status: written; verify asset names (B01_WTR) on a real granule (docs/CODEX_TASKS.md T2.5).
"""
from __future__ import annotations

import json
from collections import defaultdict

from .config import CACHE, DATA, load_doc

SHORT_NAME = "OPERA_L3_DSWX-HLS_V1"
WATER_LAYER = "B01_WTR"
PIXEL_KM2 = 0.0009


def water_area_km2(tif_path: str, bbox: list[float]) -> float:
    import numpy as np
    import rasterio
    from rasterio.warp import transform_bounds
    from rasterio.windows import from_bounds

    with rasterio.open(tif_path) as ds:
        b = transform_bounds("EPSG:4326", ds.crs, *bbox)
        arr = ds.read(1, window=from_bounds(*b, transform=ds.transform))
        return float(np.isin(arr, [1, 2]).sum()) * PIXEL_KM2


def extract(reservoir_id: str = "pasto_grande", start: str = "2024-11-01", end: str = "2026-10-31") -> dict:
    import earthaccess

    res = next(r for r in load_doc()["reservoirs"] if r["id"] == reservoir_id)
    earthaccess.login(strategy="environment")
    out_dir = DATA / "granules" / reservoir_id
    out_dir.mkdir(parents=True, exist_ok=True)
    by_month: dict[str, list[float]] = defaultdict(list)
    for g in earthaccess.search_data(short_name=SHORT_NAME, bounding_box=tuple(res["bbox"]), temporal=(start, end)):
        links = [u for u in g.data_links() if WATER_LAYER in u]
        if not links:
            continue
        files = earthaccess.download(links[:1], str(out_dir))
        if files:
            month = g["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:7]
            by_month[month].append(water_area_km2(files[0], res["bbox"]))
    monthly = {m: round(max(v), 3) for m, v in sorted(by_month.items())}
    peak = max(monthly.values()) if monthly else 0
    result = {
        "reservoir": res["name"],
        "monthlyKm2": monthly,
        "pctOfMax": [round(v / peak * 100) for v in monthly.values()] if peak else [],
        "note": "Max detected water area per month; clouds and partial tiles lower some months.",
    }
    (CACHE / f"{reservoir_id}_dswx.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result
