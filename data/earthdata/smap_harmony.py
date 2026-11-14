#!/usr/bin/env python3
"""SMAP L3 Enhanced 9 km (SPL3SMP_E v006) AM soil moisture at Carumas via NASA Harmony variable+bbox subsetting.
Full granules are ~620 MB, so we ask Harmony for only /Soil_Moisture_Retrieval_Data_AM/soil_moisture over a
0.3 deg box around Carumas, in half-year jobs, then take the EASE-2 cell nearest the farm.
Needs EARTHDATA_TOKEN. Output: ../raw/smap_carumas.csv (date, sm_am m3/m3, granule).
usage: data/.venv/bin/python data/earthdata/smap_harmony.py [start_year]
"""
import concurrent.futures as cf, datetime as dt, io, json, os, sys, time
from pathlib import Path
import re, h5py, numpy as np, pandas as pd, requests
RAW = Path(__file__).resolve().parents[1] / "raw"
TOK = os.environ.get("EARTHDATA_TOKEN") or sys.exit("EARTHDATA_TOKEN not set")
H = {"Authorization": f"Bearer {TOK}"}
CID = "C2938664763-NSIDC_CPRD"   # SPL3SMP_E v006
LAT, LON = -16.81, -70.69
BASE = f"https://harmony.earthdata.nasa.gov/{CID}/ogc-api-coverages/1.0.0/collections/parameter_vars/coverage/rangeset"
JOBS = RAW / "smap_harmony_jobs.json"


def submit(t0, t1):
    p = {"variable": "Soil_Moisture_Retrieval_Data_AM/soil_moisture", "subset": [f"lat({LAT-0.15}:{LAT+0.15})", f"lon({LON-0.15}:{LON+0.15})",
         f'time("{t0}T00:00:00Z":"{t1}T23:59:59Z")'], "maxResults": 400}
    r = requests.get(BASE, params=p, headers=H, allow_redirects=False, timeout=120)
    return r.headers["Location"].rsplit("/", 1)[-1]


def fetch(url):
    for i in range(4):
        try:
            r = requests.get(url, headers=H, allow_redirects=False, timeout=120)
            if r.status_code in (301, 302, 303, 307):
                r = requests.get(r.headers["Location"], timeout=120)
            r.raise_for_status()
            with h5py.File(io.BytesIO(r.content), "r") as h:
                g = h["Soil_Moisture_Retrieval_Data_AM"]
                sm = g["soil_moisture"][:]
                ks = list(h.keys())
                # coordinates: projected EASE-2 x/y + lat/lon if present
                lat = h["latitude"][:] if "latitude" in h else (g["latitude"][:] if "latitude" in g else None)
                lon = h["longitude"][:] if "longitude" in h else (g["longitude"][:] if "longitude" in g else None)
            if lat is not None and lat.ndim == 2:
                d = (lat - LAT) ** 2 + (lon - LON) ** 2
                i0, j0 = np.unravel_index(np.nanargmin(np.where(lat < -900, np.inf, d)), d.shape)
            else:
                i0, j0 = sm.shape[-2] // 2, sm.shape[-1] // 2
            v = float(sm.reshape(sm.shape[-2], sm.shape[-1])[i0, j0])
            valid = sm[sm > 0]
            name = url.rsplit("/", 1)[-1]
            return dict(date="-".join(re.search(r"_(\d{4})(\d{2})(\d{2})_R", name).groups()), sm_am=None if v < 0 else round(v, 4),
                        box_mean=round(float(valid.mean()), 4) if valid.size else None, n_valid_box=int(valid.size), granule=name)
        except Exception as e:
            err = str(e)[:80]; time.sleep(3 * (i + 1))
    return dict(date=None, granule=url.rsplit("/", 1)[-1], error=err)


def main():
    y0 = int(sys.argv[1]) if len(sys.argv) > 1 else 2015
    jobs = json.loads(JOBS.read_text()) if JOBS.exists() else {}
    t = dt.date(y0, 4, 1)
    while t < dt.date.today():
        t1 = min(dt.date(t.year + (t.month + 5) // 12, (t.month + 5) % 12 + 1, 1) - dt.timedelta(days=1), dt.date.today())
        k = f"{t}_{t1}"
        if k not in jobs:
            jobs[k] = submit(t.isoformat(), t1.isoformat()); print("submitted", k, flush=True)
        t = t1 + dt.timedelta(days=1)
    JOBS.write_text(json.dumps(jobs, indent=1))
    urls = []
    for k, jid in jobs.items():
        while True:
            j = requests.get(f"https://harmony.earthdata.nasa.gov/jobs/{jid}?limit=2000", headers=H, timeout=120).json()
            if j["status"] in ("successful", "complete_with_errors", "failed", "canceled"):
                break
            print(k, j["status"], j.get("progress"), flush=True); time.sleep(30)
        urls += [l["href"] for l in j["links"] if l.get("rel") == "data"]
        print(k, j["status"], "files:", len([l for l in j["links"] if l.get("rel") == "data"]), flush=True)
    with cf.ThreadPoolExecutor(16) as ex:
        rows = list(ex.map(fetch, urls))
    df = pd.DataFrame(rows).dropna(subset=["date"]).sort_values("date")
    df.to_csv(RAW / "smap_carumas.csv", index=False)
    print("wrote smap_carumas.csv", len(df), "valid", int(df.sm_am.notna().sum()))


if __name__ == "__main__":
    main()
