"""ECOSTRESS field evapotranspiration (ECO_L3T_JET) at a farm point.

Needs a free Earthdata Login (EARTHDATA_USERNAME / EARTHDATA_PASSWORD in .env).
Status: search works; the asset filter and QC handling must be verified on a real
granule (see docs/CODEX_TASKS.md T2.2).
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from .config import CACHE, DATA, Farm

SHORT_NAMES = ["ECO_L3T_JET"]  # try v003 then v002 via `version` if needed
ET_LAYER_HINT = "ETdaily"       # TODO(T2.2): confirm the exact asset/layer name in the granule links
GRANULES = DATA / "granules"


def search(farm: Farm, start: str = "2023-01-01", end: str = "2026-10-31", pad: float = 0.01):
    import earthaccess  # lazy: heavy dependency

    earthaccess.login(strategy="environment")
    results = []
    for sn in SHORT_NAMES:
        results += earthaccess.search_data(short_name=sn, bounding_box=farm.bbox(pad), temporal=(start, end))
    return results


def _granule_date(g) -> datetime:
    t = g["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"]
    return datetime.fromisoformat(t.replace("Z", "+00:00"))


def sample_point(tif: Path, lon: float, lat: float, window: int = 1) -> float | None:
    """Mean of a (2*window+1)^2 pixel box around the point; None if all nodata."""
    import numpy as np
    import rasterio
    from rasterio.warp import transform

    with rasterio.open(tif) as ds:
        xs, ys = transform("EPSG:4326", ds.crs, [lon], [lat])
        row, col = ds.index(xs[0], ys[0])
        r0, c0 = max(row - window, 0), max(col - window, 0)
        arr = ds.read(1, window=((r0, row + window + 1), (c0, col + window + 1))).astype("float64")
        if ds.nodata is not None:
            arr[arr == ds.nodata] = np.nan
        arr[(arr < 0) | (arr > 20)] = np.nan  # ET mm/day sanity range
        v = float(np.nanmean(arr)) if np.isfinite(arr).any() else None
        return v


def extract(farm: Farm, start: str = "2023-01-01", end: str = "2026-10-31") -> dict:
    import earthaccess

    granules = search(farm, start, end)
    out_dir = GRANULES / farm.id
    out_dir.mkdir(parents=True, exist_ok=True)
    overpasses = []
    for g in granules:
        links = [u for u in g.data_links() if ET_LAYER_HINT in u]
        if not links:
            continue
        files = earthaccess.download(links[:1], str(out_dir))
        if not files:
            continue
        v = sample_point(Path(files[0]), farm.lon, farm.lat)
        if v is not None:
            overpasses.append({"date": _granule_date(g).date().isoformat(), "etMmDay": round(v, 3), "granule": g["umm"]["GranuleUR"]})

    by_month: dict[int, list[float]] = defaultdict(list)
    for o in overpasses:
        by_month[int(o["date"][5:7])].append(o["etMmDay"])
    monthly = [round(sum(by_month[m]) / len(by_month[m]), 2) if by_month[m] else None for m in range(1, 13)]

    result = {
        "farmId": farm.id,
        "product": "ECO_L3T_JET",
        "overpasses": overpasses,
        "etMonthly": monthly,
        "monthsWithData": sum(1 for v in monthly if v is not None),
        "note": "Monthly mean of clear overpasses; months with no clear pass are null.",
    }
    (CACHE / f"{farm.id}_ecostress.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result
