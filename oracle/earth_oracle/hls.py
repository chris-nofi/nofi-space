"""HLS NDVI at a farm point and the cropAlive anti-gaming rule.

HLSL30 (Landsat): red = B04, NIR = B05. HLSS30 (Sentinel-2): red = B04, NIR = B8A.
Fmask bits 1 (cloud), 2 (adjacent), 3 (shadow) are masked.
Status: written; verify on real granules (docs/CODEX_TASKS.md T2.4).
"""
from __future__ import annotations

import json
from datetime import date, timedelta

from .config import CACHE, DATA, Farm

NIR = {"HLSL30": "B05", "HLSS30": "B8A"}
RED = "B04"
SCALE = 0.0001


def ndvi(red: float, nir: float) -> float | None:
    if red is None or nir is None or (nir + red) == 0:
        return None
    return (nir - red) / (nir + red)


def crop_alive(series: list[dict], median_min: float = 0.35, floor: float = 0.2, max_gap_days: int = 60) -> bool:
    """True if median NDVI > median_min and NDVI never stays below `floor`
    for more than `max_gap_days` consecutive days. `series` = [{date, ndvi}] sorted."""
    vals = sorted(p["ndvi"] for p in series if p.get("ndvi") is not None)
    if not vals:
        return False
    med = vals[len(vals) // 2]
    if med <= median_min:
        return False
    low_start = None
    for p in series:
        d = date.fromisoformat(p["date"])
        if p["ndvi"] is not None and p["ndvi"] < floor:
            low_start = low_start or d
            if (d - low_start) > timedelta(days=max_gap_days):
                return False
        else:
            low_start = None
    return True


def _band_value(path: str, lon: float, lat: float) -> float | None:
    import rasterio
    from rasterio.warp import transform

    with rasterio.open(path) as ds:
        xs, ys = transform("EPSG:4326", ds.crs, [lon], [lat])
        row, col = ds.index(xs[0], ys[0])
        v = ds.read(1, window=((row, row + 1), (col, col + 1)))[0, 0]
        if ds.nodata is not None and v == ds.nodata:
            return None
        return float(v)


def extract(farm: Farm, start: str = "2025-01-01", end: str = "2026-10-31") -> dict:
    import earthaccess

    earthaccess.login(strategy="environment")
    out_dir = DATA / "granules" / farm.id / "hls"
    out_dir.mkdir(parents=True, exist_ok=True)
    series = []
    for sn in ("HLSL30", "HLSS30"):
        for g in earthaccess.search_data(short_name=sn, bounding_box=farm.bbox(0.005), temporal=(start, end), cloud_cover=(0, 60)):
            links = g.data_links()
            pick = {b: next((u for u in links if u.endswith(f".{b}.tif")), None) for b in (RED, NIR[sn], "Fmask")}
            if not all(pick.values()):
                continue
            files = earthaccess.download(list(pick.values()), str(out_dir))
            paths = {b: next(f for f in files if f.endswith(f".{b}.tif")) for b in pick}
            fmask = _band_value(paths["Fmask"], farm.lon, farm.lat)
            if fmask is None or (int(fmask) & 0b1110):
                continue
            r = _band_value(paths[RED], farm.lon, farm.lat)
            n = _band_value(paths[NIR[sn]], farm.lon, farm.lat)
            v = ndvi(r * SCALE if r is not None else None, n * SCALE if n is not None else None)
            d = g["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:10]
            series.append({"date": d, "ndvi": round(v, 3) if v is not None else None, "sensor": sn})
    series.sort(key=lambda p: p["date"])
    result = {"farmId": farm.id, "series": series, "cropAlive": crop_alive(series)}
    (CACHE / f"{farm.id}_hls.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result
