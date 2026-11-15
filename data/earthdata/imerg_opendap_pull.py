#!/usr/bin/env python3
"""Pull GPM IMERG daily precipitation at the three Ceres farm points via GES DISC OPeNDAP subsets.

Does not download global daily files. Each request is a tiny netCDF of a ~1 deg box covering
Carumas, Samegua and El Algarrobal. Token is read from EARTHDATA_TOKEN and never printed.

  data/.venv/bin/python data/earthdata/imerg_opendap_pull.py late 2026-07-01 2026-10-31
  data/.venv/bin/python data/earthdata/imerg_opendap_pull.py final 2001-01-01 2025-09-30

Late Run (GPM_3IMERGDL v07) is near-real-time. Final Run (GPM_3IMERGDF v07) has ~3.5 month
latency and, as of 2026-11-14, is published in CMR only through 2025-09-30.
Writes data/raw/imerg_daily_late_v07.csv or data/raw/imerg_daily_final_v07.csv (resume-safe).
"""
from __future__ import annotations

import concurrent.futures as cf
import datetime as dt
import io
import os
import sys
import time
from pathlib import Path

import netCDF4 as nc
import numpy as np
import pandas as pd
import requests
import threading

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pull_and_build import FARMS  # noqa: E402

RAW = Path(__file__).resolve().parents[1] / "raw"
UA = {"User-Agent": "CeresVentures-SpaceApps2026/1.0"}
CMR = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"
# GES DISC Hyrax; path is year/month for both Daily Late and Daily Final v07.
OPENDAP = "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/{short}.07/{yyyy}/{mm}/{fname}.nc4"

# IMERG 0.1 deg grid (cell centres). precipitation is stored (time, lon, lat).
LATS = -89.95 + np.arange(1800) * 0.1
LONS = -179.95 + np.arange(3600) * 0.1
FILL = -9999.9
NC_LOCK = threading.Lock()  # netCDF4/HDF5 is not thread-safe
PRODUCTS = {
    "late": dict(short="GPM_3IMERGDL", out="imerg_daily_late_v07.csv", label="Late"),
    "final": dict(short="GPM_3IMERGDF", out="imerg_daily_final_v07.csv", label="Final"),
}


def token_header():
    tok = os.environ.get("EARTHDATA_TOKEN")
    if not tok:
        sys.exit("Set EARTHDATA_TOKEN first (value is never printed).")
    return {**UA, "Authorization": f"Bearer {tok}"}


def farm_index():
    idx = {}
    ilats, ilons = [], []
    for fid, f in FARMS.items():
        i = int(np.abs(LATS - f["lat"]).argmin())
        j = int(np.abs(LONS - f["lon"]).argmin())
        idx[fid] = (i, j)
        ilats.append(i)
        ilons.append(j)
    # 1-cell margin around the three farms
    return idx, min(ilons) - 1, max(ilons) + 1, min(ilats) - 1, max(ilats) + 1


def cmr_granules(short: str, start: dt.date, end: dt.date):
    items, after = [], None
    temporal = f"{start.isoformat()}T00:00:00Z,{end.isoformat()}T23:59:59Z"
    while True:
        headers = {**UA}
        if after:
            headers["CMR-Search-After"] = after
        r = requests.get(
            CMR,
            params={"short_name": short, "version": "07", "temporal": temporal, "page_size": 2000, "sort_key": "start_date"},
            headers=headers,
            timeout=120,
        )
        r.raise_for_status()
        batch = r.json().get("items", [])
        items.extend(batch)
        after = r.headers.get("CMR-Search-After")
        if not batch or not after or len(batch) < 2000:
            break
    out = []
    for it in items:
        ur = it["umm"].get("GranuleUR") or ""
        fname = ur.split(":", 1)[-1]
        t0 = it["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:10]
        if fname.endswith(".nc4"):
            out.append(dict(date=t0, fname=fname, short=short))
    # de-dupe by date (keep last)
    by = {g["date"]: g for g in out}
    return [by[k] for k in sorted(by)]


def extract(content: bytes, idx, lon0, lon1, lat0, lat1):
    # netCDF4 needs a seekable file; write a short-lived temp next to the output dir.
    tmp = RAW / "._imerg_subset.nc4"
    # unique name per thread
    tmp = RAW / f"._imerg_subset_{os.getpid()}_{time.time_ns()}.nc4"
    try:
        tmp.write_bytes(content)
        with NC_LOCK:
            with nc.Dataset(tmp) as ds:
                pr = ds.variables["precipitation"]
                lat = ds.variables["lat"][:]
                lon = ds.variables["lon"][:]
                data = np.array(pr[:], dtype=float)  # (time, lon, lat)
                fill = getattr(pr, "_FillValue", FILL)
        data = np.squeeze(data)
        if data.ndim != 2:
            raise ValueError(f"unexpected precip shape {data.shape}")
        # data dims: (lon, lat) after squeeze
        rows = {}
        for fid, (i_lat, j_lon) in idx.items():
            # find this cell in the subset
            yi = int(np.abs(lat - LATS[i_lat]).argmin())
            xi = int(np.abs(lon - LONS[j_lon]).argmin())
            v = float(data[xi, yi])
            if not np.isfinite(v) or v <= fill + 1 or v < -100:
                v = None
            rows[fid] = dict(mm_day=None if v is None else round(v, 3), grid_lat=round(float(lat[yi]), 2), grid_lon=round(float(lon[xi]), 2))
        return rows
    finally:
        tmp.unlink(missing_ok=True)


def fetch_one(g, idx, lon0, lon1, lat0, lat1, header, tries=4):
    yyyy, mm = g["date"][:4], g["date"][5:7]
    url = OPENDAP.format(short=g["short"], yyyy=yyyy, mm=mm, fname=g["fname"])
    url = f"{url}?precipitation[0:0][{lon0}:{lon1}][{lat0}:{lat1}]"
    last = None
    for i in range(tries):
        try:
            r = requests.get(url, headers=header, timeout=90)
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(2 * (i + 1))
                last = f"HTTP {r.status_code}"
                continue
            r.raise_for_status()
            pts = extract(r.content, idx, lon0, lon1, lat0, lat1)
            rows = []
            for fid, p in pts.items():
                rows.append(dict(date=g["date"], farm=fid, mm_day=p["mm_day"], grid_lat=p["grid_lat"], grid_lon=p["grid_lon"], granule=g["fname"]))
            return rows, None
        except Exception as e:
            last = f"{type(e).__name__}: {e}"[:200]
            time.sleep(2 * (i + 1))
    # one row per farm recording the failure so resume can retry
    return [dict(date=g["date"], farm=fid, mm_day=None, grid_lat=None, grid_lon=None, granule=g["fname"], error=last) for fid in FARMS], last


def load_done(path: Path):
    if not path.exists():
        return set()
    df = pd.read_csv(path)
    ok = df[df.mm_day.notna()] if "mm_day" in df.columns else df.iloc[0:0]
    # a date is done only if every farm has a numeric value
    counts = ok.groupby("date").farm.nunique()
    return set(counts[counts >= len(FARMS)].index.astype(str))


def append_rows(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(rows)
    header = not path.exists()
    df.to_csv(path, mode="a", header=header, index=False)


def rewrite_clean(path: Path):
    """Drop failed/duplicate rows, keep last successful row per date+farm."""
    if not path.exists():
        return
    df = pd.read_csv(path)
    if "error" in df.columns:
        good = df[df.mm_day.notna()].copy()
    else:
        good = df[df.mm_day.notna()].copy() if "mm_day" in df.columns else df
    good = good.drop_duplicates(["date", "farm"], keep="last").sort_values(["date", "farm"])
    keep = [c for c in ["date", "farm", "mm_day", "grid_lat", "grid_lon", "granule"] if c in good.columns]
    good[keep].to_csv(path, index=False)


def main():
    if len(sys.argv) < 4 or sys.argv[1] not in PRODUCTS:
        sys.exit("usage: imerg_opendap_pull.py late|final YYYY-MM-DD YYYY-MM-DD")
    kind, start, end = sys.argv[1], dt.date.fromisoformat(sys.argv[2]), dt.date.fromisoformat(sys.argv[3])
    prod = PRODUCTS[kind]
    out = RAW / prod["out"]
    header = token_header()
    idx, lon0, lon1, lat0, lat1 = farm_index()
    print(f"grid box lon[{lon0}:{lon1}] lat[{lat0}:{lat1}] farms={ {k: idx[k] for k in idx} }", flush=True)
    print(f"CMR search {prod['short']} v07 {start}..{end}", flush=True)
    granules = cmr_granules(prod["short"], start, end)
    done = load_done(out)
    todo = [g for g in granules if g["date"] not in done]
    print(f"granules {len(granules)}, already done {len(done)}, to fetch {len(todo)}", flush=True)
    if not todo:
        rewrite_clean(out)
        print("nothing to fetch; wrote", out)
        return
    ok = fail = 0
    workers = int(os.environ.get("IMERG_WORKERS", "8"))
    with cf.ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(fetch_one, g, idx, lon0, lon1, lat0, lat1, header): g for g in todo}
        for n, fut in enumerate(cf.as_completed(futs), 1):
            g = futs[fut]
            try:
                rows, err = fut.result()
            except Exception as e:
                rows, err = [], f"{type(e).__name__}: {e}"[:200]
            if rows:
                append_rows(out, rows)
            if err and all(r.get("mm_day") is None for r in rows):
                fail += 1
                print(f"FAIL {g['date']} {err}", flush=True)
            else:
                ok += 1
            if n % 25 == 0 or n == len(todo):
                print(f"progress {n}/{len(todo)} ok={ok} fail={fail}", flush=True)
    rewrite_clean(out)
    df = pd.read_csv(out)
    print("wrote", out, "rows", len(df), "dates", df.date.nunique(), "fail_dates", fail)


if __name__ == "__main__":
    main()
