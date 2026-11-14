#!/usr/bin/env python3
"""SPI-3 / SPI-6 from CHIRPS v3 monthly (1981->latest), gamma fit per calendar month on 1991-2020 (WMO-1090)."""
import sys, json
from pathlib import Path
import pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pull_and_build as pb  # noqa
pb.BASE_Y0, pb.BASE_Y1 = 1991, 2020
HERE = Path(__file__).resolve().parent
df = pd.read_csv(pb.RAW / "chirps_v3_monthly_points.csv")
df.index = pd.to_datetime(df.month + "-01")
out = {}
for fid in pb.FARMS:
    s3, f3 = pb.spi(df[fid], 3); s6, f6 = pb.spi(df[fid], 6)
    t = pd.DataFrame(dict(chirps_mm=df[fid].round(1), spi3=s3, spi6=s6)); t.index = t.index.strftime("%Y-%m")
    t.to_csv(HERE / f"{fid}_spi_chirps.csv", index_label="month")
    out[fid] = dict(latest=t.tail(6).reset_index(names="month").to_dict("records"), flags_spi3=f3, flags_spi6=f6,
                    min_spi6=dict(month=t.spi6.idxmin(), value=float(t.spi6.min())) if t.spi6.notna().any() else None)
(HERE / "spi_chirps_summary.json").write_text(json.dumps(pb.clean(out), indent=1, allow_nan=False))
print(json.dumps(pb.clean(out), indent=0)[:3000])
