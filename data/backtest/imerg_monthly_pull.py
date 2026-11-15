#!/usr/bin/env python3
"""GPM IMERG Final Run MONTHLY v07 (GPM_3IMERGM) at the three Ceres farm points, via GES DISC OPeNDAP subsets.

Used by the 1991-2025 backtest as a rainfall VALIDATION overlay (2000-06 .. latest Final month, ~2025-09).
Monthly granules (~330) instead of ~9,000 daily ones: seasonal totals only need monthly sums.
Token is read from EARTHDATA_TOKEN and never printed or written.
  data/.venv/bin/python data/backtest/imerg_monthly_pull.py
Writes data/raw/imerg_monthly_final_v07.csv (resume-safe): month, farm, mm_month, mm_hr, grid_lat, grid_lon, granule
"""
from __future__ import annotations
import concurrent.futures as cf, os, re, sys, time, calendar
from pathlib import Path
import numpy as np, pandas as pd, requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pull_and_build import FARMS  # noqa: E402

RAW = Path(__file__).resolve().parents[1] / "raw"
OUT = RAW / "imerg_monthly_final_v07.csv"
UA = {"User-Agent": "CeresVentures-SpaceApps2026/1.0"}
CMR = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"
OPENDAP = "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGM.07/{yyyy}/{fname}"
LATS = -89.95 + np.arange(1800) * 0.1
LONS = -179.95 + np.arange(3600) * 0.1


def header():
    tok = os.environ.get("EARTHDATA_TOKEN")
    if not tok:
        sys.exit("Set EARTHDATA_TOKEN first (value is never printed).")
    return {**UA, "Authorization": f"Bearer {tok}"}


def granules():
    r = requests.get(CMR, params={"short_name": "GPM_3IMERGM", "version": "07", "page_size": 2000, "sort_key": "start_date"},
                     headers=UA, timeout=120)
    r.raise_for_status()
    out = {}
    for it in r.json()["items"]:
        fname = it["umm"]["GranuleUR"].split(":", 1)[-1]
        m = it["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:7]
        out[m] = fname
    return out


def fetch(month, fname, h):
    idx = {fid: (int(np.abs(LATS - f["lat"]).argmin()), int(np.abs(LONS - f["lon"]).argmin())) for fid, f in FARMS.items()}
    rows, last = [], None
    for fid, (i, j) in idx.items():
        url = OPENDAP.format(yyyy=month[:4], fname=fname) + f".ascii?precipitation[0:0][{j}:{j}][{i}:{i}]"
        for k in range(4):
            try:
                r = requests.get(url, headers=h, timeout=90)
                if r.status_code in (429, 500, 502, 503, 504):
                    last = f"HTTP {r.status_code}"; time.sleep(2 * (k + 1)); continue
                r.raise_for_status()
                # ASCII body: "precipitation.precipitation[0][0], 0.0123" style; take last float in body after the header line
                body = r.text.split("---------------------------------------------", 1)[-1]
                vals = re.findall(r"\]\s*,\s*(-?[0-9.eE+-]+)", body)
                v = float(vals[-1])
                y, mo = int(month[:4]), int(month[5:7])
                mmhr = None if v < -100 else v
                rows.append(dict(month=month, farm=fid, mm_hr=mmhr,
                                 mm_month=None if mmhr is None else round(mmhr * 24 * calendar.monthrange(y, mo)[1], 2),
                                 grid_lat=round(float(LATS[i]), 2), grid_lon=round(float(LONS[j]), 2), granule=fname))
                break
            except Exception as e:  # noqa: BLE001
                last = f"{type(e).__name__}: {str(e)[:150]}"; time.sleep(2 * (k + 1))
        else:
            return [], f"{month} {fid} {last}"
    return rows, None


def main():
    h = header()
    g = granules()
    done = set()
    if OUT.exists():
        d = pd.read_csv(OUT)
        c = d.dropna(subset=["mm_month"]).groupby("month").farm.nunique()
        done = set(c[c >= len(FARMS)].index)
    todo = [(m, f) for m, f in sorted(g.items()) if m not in done]
    print(f"IMERG monthly granules {len(g)} ({min(g)}..{max(g)}), to fetch {len(todo)}", flush=True)
    rows, fails = [], []
    with cf.ThreadPoolExecutor(max_workers=int(os.environ.get("IMERG_WORKERS", "6"))) as ex:
        for n, (r, err) in enumerate(ex.map(lambda mf: fetch(mf[0], mf[1], h), todo), 1):
            rows += r
            if err:
                fails.append(err); print("FAIL", err, flush=True)
            if n % 25 == 0:
                print(f"progress {n}/{len(todo)}", flush=True)
    old = pd.read_csv(OUT) if OUT.exists() else pd.DataFrame()
    df = pd.concat([old, pd.DataFrame(rows)]).drop_duplicates(["month", "farm"], keep="last").sort_values(["month", "farm"])
    df.to_csv(OUT, index=False)
    print("wrote", OUT, "months", df.month.nunique(), "fails", len(fails), flush=True)


if __name__ == "__main__":
    main()
