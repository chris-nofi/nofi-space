#!/usr/bin/env python3
"""ESA Sentinel-2 L2A 10 m NDVI (partner data) at the farm field pixels, via Element84 Earth Search STAC on AWS (no login).
Cloud mask: Scene Classification Layer (SCL) - keep classes 4 vegetation, 5 not-vegetated (bare), 6 water(flag), 7 unclassified(drop);
drop 0,1,2,3 (no data, saturated, dark/topo shadow, cloud shadow), 8,9,10 (cloud med/high, cirrus), 11 snow.
Points: Carumas = app point; Samegua/El Algarrobal = field pixel from out/green_pixel_candidates.json.
Output: ../raw/s2_ndvi_points.csv (farm, date, item, scl, ndvi, lat, lon). Period 2024-01-01 -> today, eo:cloud_cover < 60."""
import concurrent.futures as cf, datetime as dt, json, sys
from pathlib import Path
import pandas as pd, requests, rasterio
from rasterio.warp import transform
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pull_and_build import FARMS, OUT, RAW  # noqa
STAC = "https://earth-search.aws.element84.com/v1/search"
KEEP = {4, 5, 6, 7}
gp = json.loads((OUT / "green_pixel_candidates.json").read_text())
PTS = {fid: (dict(lat=gp[fid]["nearest_green_candidates"][0]["lat"], lon=gp[fid]["nearest_green_candidates"][0]["lon"])
             if fid in ("samegua", "algarrobal") else dict(lat=f["lat"], lon=f["lon"])) for fid, f in FARMS.items()}


def items(p):
    out, body = [], {"collections": ["sentinel-2-l2a"], "intersects": {"type": "Point", "coordinates": [p["lon"], p["lat"]]},
                     "datetime": f"2024-01-01T00:00:00Z/{dt.date.today()}T23:59:59Z", "limit": 200,
                     "query": {"eo:cloud_cover": {"lt": 60}}}
    url = STAC
    while url:
        j = requests.post(url, json=body, timeout=120).json()
        out += j["features"]
        nxt = [l for l in j.get("links", []) if l.get("rel") == "next"]
        if not nxt: break
        url, body = nxt[0]["href"], nxt[0].get("body", body)
    return out


def px(href, p):
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", AWS_NO_SIGN_REQUEST="YES", GDAL_HTTP_TIMEOUT="60"):
        with rasterio.open(href) as d:
            xs, ys = transform("EPSG:4326", d.crs, [p["lon"]], [p["lat"]]); r, c = d.index(xs[0], ys[0])
            return float(d.read(1, window=((r, r + 1), (c, c + 1)))[0, 0])


def one(job):
    fid, p, it = job
    try:
        a = it["assets"]; scl = int(px(a["scl"]["href"], p))
        if scl not in KEEP or scl == 7:
            return dict(farm=fid, date=it["properties"]["datetime"][:10], item=it["id"], scl=scl, ndvi=None, **p)
        # L2A processing baseline >= 04.00 (from 2022-01-25) adds a +1000 DN offset: reflectance = (DN - 1000)/10000
        # Earth Search v1 COGs: if earthsearch:boa_offset_applied is true the -1000 offset is already removed
        # (asset raster:bands offset=-0.1 then describes it); otherwise baseline >= 04.00 needs DN-1000.
        pr = it["properties"]
        off = 0 if pr.get("earthsearch:boa_offset_applied") else (1000 if pr.get("s2:processing_baseline", "00") >= "04.00" else 0)
        rdn, ndn = px(a["red"]["href"], p), px(a["nir"]["href"], p)
        red, nir = (rdn - off) / 1e4, (ndn - off) / 1e4
        nd = None if red <= 0 or nir <= 0 else round((nir - red) / (nir + red), 4)
        return dict(farm=fid, date=pr["datetime"][:10], item=it["id"], scl=scl, ndvi=nd, red_dn=rdn, nir_dn=ndn, offset=off,
                    boa_offset_applied=pr.get("earthsearch:boa_offset_applied"), **p)
    except Exception as e:
        return dict(farm=fid, date=it["properties"]["datetime"][:10], item=it["id"], scl=None, ndvi=None, error=str(e)[:80], **p)


jobs = [(fid, p, it) for fid, p in PTS.items() for it in items(p)]
print("S2 items:", len(jobs), flush=True)
rows = []
with cf.ThreadPoolExecutor(24) as ex:
    for i, r in enumerate(cf.as_completed([ex.submit(one, j) for j in jobs])):
        rows.append(r.result())
        if i % 100 == 0: print(f"  s2 {i}/{len(jobs)}", flush=True)
pd.DataFrame(rows).sort_values(["farm", "date"]).to_csv(RAW / "s2_ndvi_points.csv", index=False)
print("wrote s2_ndvi_points.csv", len(rows))
