#!/usr/bin/env python3
"""Find the nearest clearly vegetated HLS 30 m pixels around each farm point (one recent clear Sentinel-2 HLS scene).
Purpose: the app's illustrative points for Samegua and El Algarrobal fall on bare ground (HLS NDVI ~0.05).
This lists candidate field coordinates (NDVI >= 0.5) for the team to confirm with a farmer / map. Needs EARTHDATA_TOKEN.
Output: ../out/green_pixel_candidates.json"""
import json, sys, math
from pathlib import Path
import numpy as np, pandas as pd, rasterio
from rasterio.warp import transform
from rasterio.windows import Window
sys.path.insert(0, str(Path(__file__).resolve().parent)); sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from earthdata_cog_pull import cmr, links, signed  # noqa
from pull_and_build import FARMS, OUT  # noqa
HALF = 50  # pixels -> +-1.5 km window
res = {}
for fid, f in FARMS.items():
    gs = [g for g in cmr("HLSS30", "2.0", f, "2026-07-01", "2026-11-13", 30) if links(g, ".B8A.tif")]
    gs.sort(key=lambda g: g["time_start"], reverse=True)
    g = gs[0]
    arr = {}
    for b in ("B04", "B8A", "Fmask"):
        with rasterio.open("/vsicurl/" + signed(links(g, f".{b}.tif")[0])) as d:
            xs, ys = transform("EPSG:4326", d.crs, [f["lon"]], [f["lat"]]); r, c = d.index(xs[0], ys[0])
            w = Window(c - HALF, r - HALF, 2 * HALF + 1, 2 * HALF + 1)
            arr[b] = d.read(1, window=w, boundless=True, fill_value=0).astype(float)
            tr = d.window_transform(w); crs = d.crs
    red, nir, fm = arr["B04"] * 1e-4, arr["B8A"] * 1e-4, arr["Fmask"].astype(int)
    ok = (red > 0) & (nir > 0) & ((fm & 0b111110) == 0)
    ndvi = np.where(ok, (nir - red) / (nir + red + 1e-9), np.nan)
    rr, cc = np.where(ndvi >= 0.5)
    cands = []
    if len(rr):
        dist = np.hypot(rr - HALF, cc - HALF) * 30
        for k in np.argsort(dist)[:200]:
            x, y = tr * (cc[k] + 0.5, rr[k] + 0.5)
            lon, lat = transform(crs, "EPSG:4326", [x], [y])
            cands.append(dict(lat=round(lat[0], 5), lon=round(lon[0], 5), ndvi=round(float(ndvi[rr[k], cc[k]]), 3), dist_m=round(float(dist[k]))))
        # thin: keep candidates >= 150 m apart
        kept = []
        for cnd in cands:
            if all(math.hypot((cnd["lat"] - q["lat"]) * 111320, (cnd["lon"] - q["lon"]) * 106000) > 150 for q in kept):
                kept.append(cnd)
            if len(kept) == 5: break
        cands = kept
    res[fid] = dict(scene=g["title"], date=g["time_start"][:10], ndvi_at_point=None if np.isnan(ndvi[HALF, HALF]) else round(float(ndvi[HALF, HALF]), 3),
                    window_km=round((2 * HALF + 1) * 0.03, 2), share_pixels_ndvi_ge_0_5=round(float(np.nanmean(ndvi >= 0.5)), 3),
                    nearest_green_candidates=cands)
    print(fid, json.dumps(res[fid])[:400], flush=True)
(OUT / "green_pixel_candidates.json").write_text(json.dumps(res, indent=1))
