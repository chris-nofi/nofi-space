#!/usr/bin/env python3
"""Direct Earthdata pulls (COG / HDF5 range reads) for the 3 Ceres Ventures farms.

Needs env EARTHDATA_TOKEN (EDL bearer token; never printed). AppEEARS rejects EDL bearer tokens
(HTTP 403 on /api/task), so this reads the files directly from LP DAAC / NSIDC cloud archives:
  HLS L30/S30 v2.0 (30 m)  -> NDVI per clear scene              -> ../raw/hls_ndvi_points.csv
  ECOSTRESS L3T JET v002 (70 m) ETdaily (mm/day) per overpass   -> ../raw/ecostress_jet_points.csv
  SMAP SPL3SMP_E v006 (9 km) AM soil moisture at Carumas        -> ../raw/smap_carumas.csv
Granules are found with NASA CMR (point + temporal); each protected URL is resolved to its signed
CloudFront/S3 redirect with the bearer token, then only the needed bytes are read.
Usage: data/.venv/bin/python data/earthdata/earthdata_cog_pull.py [hls] [ecostress] [smap]
"""
from __future__ import annotations
import concurrent.futures as cf, datetime as dt, os, sys, threading
from pathlib import Path
import numpy as np, pandas as pd, requests, rasterio
from rasterio.warp import transform

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pull_and_build import FARMS, RAW  # noqa: E402

CMR = "https://cmr.earthdata.nasa.gov/search/granules.json"
TOK = os.environ.get("EARTHDATA_TOKEN") or sys.exit("EARTHDATA_TOKEN not set")
_local = threading.local()
TODAY = dt.date.today().isoformat()


def sess():
    if not hasattr(_local, "s"):
        _local.s = requests.Session(); _local.s.headers["Authorization"] = f"Bearer {TOK}"
    return _local.s


def signed(url):
    r = sess().get(url, allow_redirects=False, timeout=60)
    if r.status_code in (301, 302, 303, 307):
        return r.headers["Location"]
    raise RuntimeError(f"no redirect ({r.status_code}) for {url.rsplit('/',1)[-1]}")


def cmr(short, ver, f, start, end, cloud=None):
    out, page = [], 1
    while True:
        p = dict(short_name=short, version=ver, point=f"{f['lon']},{f['lat']}", temporal=f"{start}T00:00:00Z,{end}T23:59:59Z",
                 page_size=2000, page_num=page)
        if cloud is not None:
            p["cloud_cover"] = f"0,{cloud}"
        e = requests.get(CMR, params=p, timeout=120).json()["feed"]["entry"]
        out += e
        if len(e) < 2000:
            return out
        page += 1


def links(g, suffix):
    return [l["href"] for l in g["links"] if l["href"].startswith("https") and l["href"].endswith(suffix)]


def sample(url, lon, lat):
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MAX_RETRY="3", GDAL_HTTP_RETRY_DELAY="2", GDAL_HTTP_TIMEOUT="60", GDAL_HTTP_CONNECTTIMEOUT="20"):
        with rasterio.open("/vsicurl/" + signed(url)) as d:
            xs, ys = transform("EPSG:4326", d.crs, [lon], [lat])
            row, col = d.index(xs[0], ys[0])
            if not (0 <= row < d.height and 0 <= col < d.width):
                return None
            v = d.read(1, window=((row, row + 1), (col, col + 1)))[0, 0]
            return None if (d.nodata is not None and v == d.nodata) else float(v)


def run(jobs, fn, workers=16, label=""):
    rows = []
    with cf.ThreadPoolExecutor(workers) as ex:
        futs = [ex.submit(fn, j) for j in jobs]
        for i, fu in enumerate(cf.as_completed(futs)):
            try:
                r = fu.result()
            except Exception:
                r = None
            if r:
                rows.append(r)
            if i % 100 == 0:
                print(f"  {label} {i}/{len(jobs)}", flush=True)
    return rows


# Fmask bits (HLS v2 user guide): 1 cloud, 2 adjacent cloud/shadow, 3 cloud shadow, 4 snow/ice, 5 water
BAD = (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5)


def hls(start="2024-01-01", cloud=50):
    jobs = []
    for fid, f in FARMS.items():
        for short, nir in (("HLSS30", ".B8A.tif"), ("HLSL30", ".B05.tif")):
            for g in cmr(short, "2.0", f, start, TODAY, cloud):
                fm, red, ni = links(g, ".Fmask.tif"), links(g, ".B04.tif"), links(g, nir)
                if fm and red and ni:
                    jobs.append((fid, f, short, g["title"], g["time_start"][:10], fm[0], red[0], ni[0]))
    print("HLS granules to read:", len(jobs), flush=True)

    def one(j):
        fid, f, short, gid, date, fm, red, ni = j
        try:
            q = sample(fm, f["lon"], f["lat"])
            if q is None:
                return None
            if int(q) & BAD:
                return dict(farm=fid, date=date, sensor=short, granule=gid, fmask=int(q), ndvi=None)
            r, n = sample(red, f["lon"], f["lat"]), sample(ni, f["lon"], f["lat"])
            if r is None or n is None or r <= 0 or n <= 0:
                return None
            r, n = r * 1e-4, n * 1e-4
            return dict(farm=fid, date=date, sensor=short, granule=gid, fmask=int(q), ndvi=round((n - r) / (n + r), 4))
        except Exception as e:
            return dict(farm=fid, date=date, sensor=short, granule=gid, fmask=None, ndvi=None, error=str(e)[:80])
    rows = run(jobs, one, workers=32, label="hls")
    pd.DataFrame(rows).sort_values(["farm", "date"]).to_csv(RAW / "hls_ndvi_points.csv", index=False)
    print("wrote hls_ndvi_points.csv", len(rows))


def ecostress(start="2019-01-01"):
    jobs = []
    for fid, f in FARMS.items():
        for g in cmr("ECO_L3T_JET", "002", f, start, TODAY):
            et = links(g, "_ETdaily.tif")
            if et:
                jobs.append((fid, f, g["title"], g["time_start"][:19], et[0]))
    print("ECOSTRESS JET granules to read:", len(jobs), flush=True)

    def one(j):
        fid, f, gid, t, u = j
        try:
            v = sample(u, f["lon"], f["lat"])
            return dict(farm=fid, datetime_utc=t, granule=gid, et_daily_mm=None if v is None or np.isnan(v) else round(v, 3))
        except Exception as e:
            return dict(farm=fid, datetime_utc=t, granule=gid, et_daily_mm=None, error=str(e)[:80])
    rows = run(jobs, one, label="ecostress")
    pd.DataFrame(rows).sort_values(["farm", "datetime_utc"]).to_csv(RAW / "ecostress_jet_points.csv", index=False)
    print("wrote ecostress_jet_points.csv", len(rows))


def smap(days=365):
    import fsspec, h5py
    f = FARMS["carumas"]
    start = (dt.date.today() - dt.timedelta(days=days)).isoformat()
    gs = cmr("SPL3SMP_E", "006", f, start, TODAY)
    print("SMAP granules:", len(gs), flush=True)
    # EASE-Grid 2.0 9 km: locate the row/col once from the first file's lat/lon arrays
    rc = {}

    def one(g):
        u = links(g, ".h5")[0]
        try:
            with fsspec.open(signed(u), "rb", block_size=2**20) as fh, h5py.File(fh, "r") as h:
                grp = h["Soil_Moisture_Retrieval_Data_AM"]
                if "rc" not in rc:
                    lat = h["Soil_Moisture_Retrieval_Data_AM/latitude_centroid"][:] if "latitude_centroid" in grp else grp["latitude"][:]
                    lon = grp["longitude"][:]
                    lat = np.where(lat < -900, np.nan, lat); lon = np.where(lon < -900, np.nan, lon)
                    rc["rc"] = np.unravel_index(np.nanargmin((lat - f["lat"]) ** 2 + (lon - f["lon"]) ** 2), lat.shape)
                i, j = rc["rc"]
                v = float(grp["soil_moisture"][i, j])
                pm = h["Soil_Moisture_Retrieval_Data_PM"]
                vp = float(pm["soil_moisture_pm"][i, j]) if "soil_moisture_pm" in pm else -9999
            return dict(date=g["time_start"][:10], granule=g["title"], sm_am=None if v < 0 else round(v, 4),
                        sm_pm=None if vp < 0 else round(vp, 4), row=int(i), col=int(j))
        except Exception as e:
            return dict(date=g["time_start"][:10], granule=g["title"], sm_am=None, sm_pm=None, error=str(e)[:80])
    one(gs[0])  # warm row/col
    rows = run(gs, one, workers=8, label="smap")
    pd.DataFrame(rows).sort_values("date").to_csv(RAW / "smap_carumas.csv", index=False)
    print("wrote smap_carumas.csv", len(rows))


if __name__ == "__main__":
    what = sys.argv[1:] or ["hls", "ecostress", "smap"]
    for w in what:
        globals()[w]()
