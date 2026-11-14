#!/usr/bin/env python3
"""Re-sample HLS NDVI and ECOSTRESS ET at the *field pixels* chosen by find_green_pixels.py (nearest HLS pixel with
NDVI >= 0.5 on a recent clear scene) for farms whose app point sits on bare ground (Samegua, El Algarrobal).
Carumas keeps its original point (HLS NDVI peaks 0.63 in March there: it is vegetated).
Outputs: ../raw/hls_ndvi_fieldpx.csv, ../raw/ecostress_jet_fieldpx.csv  (same columns as the point files + lat/lon)."""
import json, sys
from pathlib import Path
import pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parent)); sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import earthdata_cog_pull as E  # noqa
from pull_and_build import OUT, RAW  # noqa
cand = json.loads((OUT / "green_pixel_candidates.json").read_text())
FIELD = {fid: dict(lat=c["nearest_green_candidates"][0]["lat"], lon=c["nearest_green_candidates"][0]["lon"])
         for fid, c in cand.items() if fid in ("samegua", "algarrobal")}
E.FARMS = FIELD  # monkeypatch the farm list used by hls()/ecostress()
E.RAW = RAW / "_fieldpx_tmp"; E.RAW.mkdir(exist_ok=True)
what = sys.argv[1:] or ["ecostress", "hls"]
if "ecostress" in what:
    E.ecostress(start="2019-01-01")
    df = pd.read_csv(E.RAW / "ecostress_jet_points.csv"); df["lat"] = df.farm.map(lambda f: FIELD[f]["lat"]); df["lon"] = df.farm.map(lambda f: FIELD[f]["lon"])
    df.to_csv(RAW / "ecostress_jet_fieldpx.csv", index=False)
if "hls" in what:
    E.hls(start="2024-01-01", cloud=50)
    df = pd.read_csv(E.RAW / "hls_ndvi_points.csv"); df["lat"] = df.farm.map(lambda f: FIELD[f]["lat"]); df["lon"] = df.farm.map(lambda f: FIELD[f]["lon"])
    df.to_csv(RAW / "hls_ndvi_fieldpx.csv", index=False)
print("field pixels:", FIELD)
