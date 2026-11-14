#!/usr/bin/env python3
"""CHIRPS v3.0 monthly precipitation (UCSB CHC, no login) at the 3 farm points, 1981-01 -> latest,
read pixel-by-pixel from the official Cloud-Optimized GeoTIFFs with HTTP range requests.
Source: https://data.chc.ucsb.edu/products/CHIRPS/v3.0/monthly/global/cogs/
Output: ../raw/chirps_v3_monthly_points.csv (month, carumas, samegua, algarrobal) in mm/month."""
import concurrent.futures as cf, datetime as dt, sys, time
from pathlib import Path
import pandas as pd, rasterio, requests, re
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pull_and_build import FARMS, RAW  # noqa
BASE = "https://data.chc.ucsb.edu/products/CHIRPS/v3.0/monthly/global/cogs/"
OUTF = RAW / "chirps_v3_monthly_points.csv"

def one(name):
    for i in range(5):
        try:
            with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MAX_RETRY="3", GDAL_HTTP_TIMEOUT="30", GDAL_HTTP_CONNECTTIMEOUT="15"):
                with rasterio.open("/vsicurl/" + BASE + name) as r:
                    vals = [float(v[0]) for v in r.sample([(f["lon"], f["lat"]) for f in FARMS.values()])]
            y, m = re.findall(r"(\d{4})\.(\d{2})", name)[0]
            return dict(month=f"{y}-{m}", **dict(zip(FARMS, vals)))
        except Exception:
            time.sleep(5 * (i + 1))
    return None

def main():
    names = sorted(set(re.findall(r'href="(chirps-v3\.0\.\d{4}\.\d{2}\.cog)"', requests.get(BASE, timeout=60).text)))
    done = pd.read_csv(OUTF) if OUTF.exists() else pd.DataFrame(columns=["month"])
    todo = [n for n in names if re.findall(r"(\d{4})\.(\d{2})", n)[0][0] + "-" + re.findall(r"(\d{4})\.(\d{2})", n)[0][1] not in set(done.month)]
    rows = done.to_dict("records")
    with cf.ThreadPoolExecutor(3) as ex:
        for i, r in enumerate(ex.map(one, todo)):
            if r: rows.append(r)
            if i % 10 == 0:
                print(f"chirps v3 {i}/{len(todo)}", flush=True)
                pd.DataFrame(rows).sort_values("month").to_csv(OUTF, index=False)
    pd.DataFrame(rows).sort_values("month").to_csv(OUTF, index=False)
    print("wrote", OUTF, len(rows))

if __name__ == "__main__":
    main()
