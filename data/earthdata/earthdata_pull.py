#!/usr/bin/env python3
"""Earthdata-Login products for Ceres Ventures (run once a token exists).

  export EARTHDATA_TOKEN=...        # Earthdata Login user token (https://urs.earthdata.nasa.gov -> Generate Token)
  data/.venv/bin/python data/earthdata/earthdata_pull.py imerg   # GPM IMERG Final v07 monthly + recent daily, 3 farms
  data/.venv/bin/python data/earthdata/earthdata_pull.py smap    # SMAP L3 9 km AM soil moisture, Carumas, last 365 days
HLS / ECOSTRESS / SMAP time series for points are much faster via AppEEARS: see appeears_submit.py.
Writes ../raw/imerg_*.csv and ../raw/smap_carumas.csv. Never prints the token.
"""
import os, sys
from pathlib import Path
import datetime as dt
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pull_and_build import FARMS  # noqa: E402

RAW = Path(__file__).resolve().parents[1] / "raw"


def login():
    if not os.environ.get("EARTHDATA_TOKEN") and not os.environ.get("EARTHDATA_USERNAME"):
        sys.exit("Set EARTHDATA_TOKEN (or EARTHDATA_USERNAME/EARTHDATA_PASSWORD) first.")
    import earthaccess
    earthaccess.login(strategy="environment")
    return earthaccess


def point_from_h5(ea, granules, var, lat_name, lon_name, transpose_lonlat):
    import h5py
    rows = []
    files = ea.open(granules)
    for g, fh in zip(granules, files):
        with h5py.File(fh, "r") as h:
            lat = h[lat_name][:]; lon = h[lon_name][:]
            data = h[var]
            t = g["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:10]
            for fid, f in FARMS.items():
                i = int(np.abs(lat - f["lat"]).argmin()); j = int(np.abs(lon - f["lon"]).argmin())
                v = data[0, j, i] if transpose_lonlat else data[0, i, j]
                rows.append(dict(date=t, farm=fid, value=float(v)))
    return pd.DataFrame(rows)


def imerg(ea):
    # Monthly Final (mm/hr averaged over month), lon x lat ordering in V07 HDF5: precipitation[time, lon, lat]
    gm = ea.search_data(short_name="GPM_3IMERGM", version="07", temporal=("2001-01-01", dt.date.today().isoformat()))
    df = point_from_h5(ea, gm, "Grid/precipitation", "Grid/lat", "Grid/lon", transpose_lonlat=True)
    df["mm_month"] = df.value * 24 * pd.to_datetime(df.date).dt.days_in_month
    df.to_csv(RAW / "imerg_monthly_v07.csv", index=False)
    # Daily Late run for the last 120 days (Final has ~3.5-month latency)
    start = (dt.date.today() - dt.timedelta(days=120)).isoformat()
    gd = ea.search_data(short_name="GPM_3IMERGDL", version="07", temporal=(start, dt.date.today().isoformat()))
    dd = point_from_h5(ea, gd, "precipitation", "lat", "lon", transpose_lonlat=True)
    dd.rename(columns={"value": "mm_day"}).to_csv(RAW / "imerg_daily_late_v07.csv", index=False)
    print("IMERG monthly granules:", len(gm), "daily:", len(gd))


def smap(ea):
    import h5py
    f = FARMS["carumas"]
    start = (dt.date.today() - dt.timedelta(days=365)).isoformat()
    gr = ea.search_data(short_name="SPL3SMP_E", version="006", temporal=(start, dt.date.today().isoformat()))
    rows = []
    for g, fh in zip(gr, ea.open(gr)):
        with h5py.File(fh, "r") as h:
            grp = h["Soil_Moisture_Retrieval_Data_AM"]
            lat = grp["latitude"][:]; lon = grp["longitude"][:]
            d = (lat - f["lat"]) ** 2 + (lon - f["lon"]) ** 2
            i, j = np.unravel_index(np.nanargmin(np.where(lat < -900, np.inf, d)), d.shape)
            v = float(grp["soil_moisture"][i, j])
            rows.append(dict(date=g["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:10], sm_m3m3=None if v < 0 else v))
    pd.DataFrame(rows).to_csv(RAW / "smap_carumas.csv", index=False)
    print("SMAP granules:", len(gr))


if __name__ == "__main__":
    ea = login()
    what = sys.argv[1:] or ["imerg", "smap"]
    if "imerg" in what: imerg(ea)
    if "smap" in what: smap(ea)
