#!/usr/bin/env python3
"""ISRIC SoilGrids 2.0 (250 m, NON-NASA) topsoil 0-30 cm at farm points + field pixels via the REST API.
If the pixel is null (urban/water/bare-rock mask), search rings of 250 m up to 1.5 km and report the nearest valid pixel.
Output: ../out/soilgrids.json. Units converted with the API's d_factor (clay/sand/silt %, SOC g/kg, pH, bdod g/cm3)."""
import json, math, sys, time
from pathlib import Path
import requests
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pull_and_build import FARMS, OUT, RAW  # noqa
URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
PROPS = ["clay", "sand", "silt", "soc", "phh2o", "bdod"]
DEPTHS = [("0-5cm", 5), ("5-15cm", 10), ("15-30cm", 15)]
gp = json.loads((OUT / "green_pixel_candidates.json").read_text())


def q(lat, lon):
    for i in range(5):
        r = requests.get(URL, params=[("lon", lon), ("lat", lat)] + [("property", p) for p in PROPS] + [("depth", d) for d, _ in DEPTHS] + [("value", "mean"), ("value", "uncertainty")], timeout=60)
        if r.status_code == 200:
            break
        time.sleep(5 * (i + 1))
    out = {}
    for L in r.json()["properties"]["layers"]:
        f = L["unit_measure"]["d_factor"]
        vals = {d["label"]: d["values"] for d in L["depths"]}
        if any(vals[d]["mean"] is None for d, _ in DEPTHS):
            return None
        out[L["name"]] = dict(mean_0_30=round(sum(vals[d]["mean"] / f * w for d, w in DEPTHS) / 30, 2),
                              by_depth={d: vals[d]["mean"] / f for d, _ in DEPTHS},
                              uncertainty_0_5=vals["0-5cm"].get("uncertainty"), unit=L["unit_measure"]["target_units"])
    return out


res = {}
for fid, f in FARMS.items():
    pts = {"app_point": (f["lat"], f["lon"])}
    if fid in ("samegua", "algarrobal"):
        c = gp[fid]["nearest_green_candidates"][0]; pts["field_pixel"] = (c["lat"], c["lon"])
    res[fid] = {}
    for k, (lat, lon) in pts.items():
        v, used, dist = q(lat, lon), (lat, lon), 0
        ring = 1
        while v is None and ring <= 6:
            d = ring * 250
            for ang in range(0, 360, 45):
                la = lat + d * math.cos(math.radians(ang)) / 111320; lo = lon + d * math.sin(math.radians(ang)) / (111320 * math.cos(math.radians(lat)))
                v = q(la, lo); time.sleep(1)
                if v is not None:
                    used, dist = (round(la, 5), round(lo, 5)), d; break
            ring += 1
        res[fid][k] = dict(requested=[lat, lon], used=list(used), offset_m=dist, values=v)
        print(fid, k, dist, v and {p: v[p]["mean_0_30"] for p in v}, flush=True)
        time.sleep(1)
(OUT / "soilgrids.json").write_text(json.dumps(dict(source="ISRIC SoilGrids 2.0 REST https://rest.isric.org/soilgrids/v2.0/ (NON-NASA, 250 m, modeled)",
                                                    depth="0-30 cm thickness-weighted mean of 0-5, 5-15, 15-30 cm", farms=res), indent=1))
