#!/usr/bin/env python3
"""Soil / cover / frost / erosion extension layer for the three Moquegua farms. Writes out/risk_extensions.json.
Inputs (all already on disk except the slope DEM grid, fetched once and cached):
  - out/soilgrids.json                  ISRIC SoilGrids 2.0 (NON-NASA)
  - raw/s2_ndvi_points.csv              ESA Sentinel-2 L2A 10 m NDVI, SCL-masked (partner, Earth Search STAC)
  - raw/hls_ndvi_points.csv (+ _fieldpx) NASA HLS 30 m NDVI; out/<farm>_ndvi_mod13q1.csv NASA MODIS 250 m NDVI
  - historical/<farm>_power_daily_1981_present.csv  NASA POWER daily (T2M_MIN, PRECTOTCORR)
  - raw/openmeteo_era5_land_<farm>.json  ERA5-Land daily via Open-Meteo archive API (no key) - gap fill / cross-check
  - raw/srtm_slope_grid.json            NASA SRTM GL1 30 m via OpenTopoData (5x5 grid, 30 m spacing)
Methods are written into the JSON next to each number."""
import json, math, sys, time
from pathlib import Path
import numpy as np, pandas as pd, requests
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pull_and_build import FARMS, OUT, RAW  # noqa
HIST = OUT.parent / "historical"
gp = json.loads((OUT / "green_pixel_candidates.json").read_text())
FIELD = {fid: ((gp[fid]["nearest_green_candidates"][0]["lat"], gp[fid]["nearest_green_candidates"][0]["lon"]) if fid != "carumas"
               else (FARMS[fid]["lat"], FARMS[fid]["lon"])) for fid in FARMS}
MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
BARE = 0.20  # NDVI threshold for bare / near-bare surface (bare soil typically 0.05-0.2 in arid Andes; documented)
r = lambda x, n=2: None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), n)


# ---------- slope: SRTM 30 m 5x5 grid around the field point, Horn (1981) 3x3 at centre + window mean ----------
def dem_grid():
    cache = RAW / "srtm_slope_grid.json"
    if cache.exists():
        return json.loads(cache.read_text())
    out = {}
    for fid, (lat, lon) in FIELD.items():
        dy = 30 / 111320; dx = 30 / (111320 * math.cos(math.radians(lat)))
        locs = [(lat + (2 - i) * dy, lon + (j - 2) * dx) for i in range(5) for j in range(5)]
        for k in range(5):
            j = requests.get("https://api.opentopodata.org/v1/srtm30m", params={"locations": "|".join(f"{a:.6f},{b:.6f}" for a, b in locs)}, timeout=60).json()
            if j.get("status") == "OK": break
            time.sleep(3)
        out[fid] = dict(center=[lat, lon], spacing_m=30, elev=[x["elevation"] for x in j["results"]])
        time.sleep(1.5)
    cache.write_text(json.dumps(dict(source="https://api.opentopodata.org/v1/srtm30m (NASA SRTM GL1 v3, 1 arc-second)", grids=out)))
    return json.loads(cache.read_text())


def horn(z, s=30.0):
    a, b, c, d, f, g, h, i = z[0, 0], z[0, 1], z[0, 2], z[1, 0], z[1, 2], z[2, 0], z[2, 1], z[2, 2]
    dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * s); dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * s)
    return math.degrees(math.atan(math.hypot(dzdx, dzdy)))


def slope(fid, G):
    z = np.array(G["grids"][fid]["elev"], float).reshape(5, 5)
    sl = [horn(z[i - 1:i + 2, j - 1:j + 2]) for i in range(1, 4) for j in range(1, 4)]
    return dict(center_deg=r(sl[4], 1), window_mean_deg=r(np.mean(sl), 1), window_max_deg=r(np.max(sl), 1),
                center_pct=r(100 * math.tan(math.radians(sl[4])), 1), elev_center_m=r(z[2, 2], 0),
                method="Horn (1981) 3x3 finite difference on SRTM GL1 30 m sampled on a 5x5 grid (30 m spacing) via OpenTopoData; centre = field point, window = 9 cells over 90x90 m")


# ---------- daily climate ----------
def power(fid):
    d = pd.read_csv(HIST / f"{fid}_power_daily_1981_present.csv", parse_dates=["date"]).set_index("date")
    return d.replace(-999.0, np.nan)


def era5(fid):
    """ERA5-Land daily (0.1 deg) for temperature; ERA5 (0.25 deg) daily precipitation because Open-Meteo returns
    precipitation_sum = null for the era5_land model at these points."""
    j = json.loads((RAW / f"openmeteo_era5_land_{fid}.json").read_text())["daily"]
    d = pd.DataFrame(j).assign(time=lambda x: pd.to_datetime(x.time)).set_index("time")
    e = pd.DataFrame(json.loads((RAW / f"openmeteo_era5_{fid}.json").read_text())["daily"]).assign(time=lambda x: pd.to_datetime(x.time)).set_index("time")
    d["precipitation_sum"] = pd.to_numeric(e.precipitation_sum, errors="coerce").reindex(d.index)
    d["temperature_2m_min"] = pd.to_numeric(d.temperature_2m_min, errors="coerce")
    return d


SHIFT = {f: json.loads((OUT / f"{f}.json").read_text())["elevation"]["lapse_shift_degC"] for f in FARMS}
PREF = {"carumas": "power_site_lapse", "samegua": "era5_land", "algarrobal": "power"}
PREF_WHY = {"carumas": "POWER cell is ~700 m above the farm; lapse-adjusted POWER (+6.5 C/km) matches ERA5-Land Tmax/Tmin within ~1 C (see kepler-answers Q1)",
            "samegua": "shares the Carumas POWER cell (~2,275 m above the farm); a 14.8 C lapse shift is too large to trust, so ERA5-Land (0.1 deg) is used",
            "algarrobal": "coastal inversion: raw POWER preferred; frost is absent in every series"}


def frost(fid):
    p, e = power(fid), era5(fid)
    t = p.T2M_MIN.copy(); filled = int(t.isna().sum()); t = t.fillna(e.temperature_2m_min.reindex(t.index))
    res = {}
    for lab, ser, src in [("power", t, "NASA POWER T2M_MIN raw (MERRA-2 0.5x0.625 deg cell), gaps filled from ERA5-Land"),
                          ("power_site_lapse", t + SHIFT[fid], f"NASA POWER T2M_MIN + {SHIFT[fid]} C lapse shift to SRTM farm elevation (6.5 C/km)"),
                          ("era5_land", e.temperature_2m_min, "ERA5-Land via Open-Meteo archive API (0.1 deg) - labelled 'ERA5 via Open-Meteo'")]:
        s = ser.dropna(); yrs = s.index.year
        def bym(mask, y0, y1):
            m = s[(yrs >= y0) & (yrs <= y1)]
            return [r(((m < mask) & (m.index.month == k)).groupby(m.index.year).sum().mean(), 1) for k in range(1, 13)]
        recent = {}
        for y in range(2021, s.index.year.max() + 1):
            m = s[yrs == y]
            recent[str(y)] = dict(lt0=int((m < 0).sum()), lt2=int((m < 2).sum()), n_days=int(len(m)), min_c=r(m.min(), 1))
        res[lab] = dict(source=src, clim_1991_2020_days_lt0_by_month=bym(0, 1991, 2020), clim_1991_2020_days_lt2_by_month=bym(2, 1991, 2020),
                        clim_1991_2020_days_lt0_yr=r(sum(bym(0, 1991, 2020)), 1), clim_1991_2020_days_lt2_yr=r(sum(bym(2, 1991, 2020)), 1),
                        recent_years=recent, last_date=str(s.index.max().date()))
    res["power"]["era5_gap_filled_days"] = filled
    res["preferred"] = PREF[fid]; res["preferred_reason"] = PREF_WHY[fid]
    res["note"] = "Point Tmin from gridded reanalysis; local cold-air pooling on valley floors can add frost days not seen at grid scale."
    return res


def erosion(fid, sl):
    out = {}
    tan = math.tan(math.radians(sl["window_mean_deg"]))
    for lab, ser, src in [("power", power(fid).PRECTOTCORR, "NASA POWER PRECTOTCORR daily (MERRA-2 bias-corrected; QC: 2022-09-12/13 spike not in CHIRPS)"),
                          ("era5", era5(fid).precipitation_sum, "ERA5 (0.25 deg) daily precipitation via Open-Meteo archive API (ERA5-Land precip returned null); known wet bias over the western Andes")]:
        s = ser.dropna(); s = s[(s.index.year >= 2001) & (s.index.year <= 2025)]
        if lab == "power":
            s = s[~s.index.isin(pd.to_datetime(["2022-09-12", "2022-09-13"]))]
        wet = s[s >= 1]; p95 = float(wet.quantile(0.95)) if len(wet) else float("nan")
        n10 = (s > 10).groupby(s.index.year).sum().mean(); n95 = (s > p95).groupby(s.index.year).sum().mean()
        i95 = s[s > p95].mean()
        bym = [r(((s > 10) & (s.index.month == k)).groupby(s.index.year).sum().mean(), 2) for k in range(1, 13)]
        out[lab] = dict(source=src, period="2001-2025", wet_day_p95_mm=r(p95, 1), days_gt10mm_per_yr=r(n10, 2), days_gt_p95_per_yr=r(n95, 2),
                        mean_intensity_gt_p95_mm=r(i95, 1), days_gt10mm_by_month=bym,
                        proxy_tan_slope_x_days_gt10mm=r(tan * n10, 3), proxy_tan_slope_x_p95_intensity=r(tan * (i95 if np.isfinite(i95) else 0), 3))
    out["method"] = ("Erosion-risk proxy (relative, unitless, NOT soil loss): tan(mean slope over 90x90 m SRTM window) x (a) mean annual count of days >10 mm, "
                     "(b) mean intensity on days above the wet-day (>=1 mm) 95th percentile. IMERG was the requested rain source but GES DISC returns "
                     "403 EULA Acceptance Failure for this Earthdata account; POWER and ERA5-Land daily used as substitutes and both reported.")
    out["imerg_status"] = "blocked: Earthdata account must accept the GES DISC EULA (urs.earthdata.nasa.gov > Applications > Authorized Apps / EULAs)"
    return out


def cover(fid):
    s2 = pd.read_csv(RAW / "s2_ndvi_points.csv"); s2 = s2[(s2.farm == fid) & s2.ndvi.notna()].copy()
    s2["date"] = pd.to_datetime(s2.date); s2 = s2[(s2.ndvi > -0.2) & (s2.ndvi <= 1)]
    hf = RAW / "hls_ndvi_fieldpx.csv"
    h = pd.read_csv(hf if hf.exists() else RAW / "hls_ndvi_points.csv"); h = h[(h.farm == fid) & h.ndvi.notna()].copy(); h["date"] = pd.to_datetime(h.date)
    mo = pd.read_csv(OUT / f"{fid}_ndvi_mod13q1.csv", parse_dates=["date"])
    def mclim(df, col="ndvi"):
        return [r(df[df.date.dt.month == k][col].median(), 3) for k in range(1, 13)]
    s2c, hc, mc = mclim(s2), mclim(h), mclim(mo[mo.date.dt.year >= 2015])
    s2n = [int((s2.date.dt.month == k).sum()) for k in range(1, 13)]
    base = [a if a is not None else b for a, b in zip(s2c, hc)]
    bare = [MON[k] for k, v in enumerate(base) if v is not None and v < BARE]
    era = era5(fid); era = era[(era.index.year >= 1991) & (era.index.year <= 2020)]
    pw = [r(era.precipitation_sum[era.index.month == k].groupby(era.index.year[era.index.month == k]).sum().mean(), 1) for k in range(1, 13)]
    fz = frost(fid); fr = fz[fz["preferred"]]["clim_1991_2020_days_lt2_by_month"]
    vul = []
    for k in range(12):
        why = []
        if base[k] is not None and base[k] < BARE: why.append("bare/sparse cover (S2 NDVI<0.20)")
        if pw[k] and pw[k] >= 0.10 * sum(x or 0 for x in pw): why.append("rainy month (>=10% of annual ERA5 rain)")
        if fr[k] and fr[k] >= 5: why.append(">=5 days Tmin<2C (preferred frost series)")
        if len(why) >= 2: vul.append(dict(month=MON[k], reasons=why))
    s2r = s2[s2.date >= "2025-11-01"].groupby(s2.date.dt.strftime("%Y-%m")).ndvi.median().round(3).to_dict()
    return dict(point=dict(lat=FIELD[fid][0], lon=FIELD[fid][1], kind="field_pixel" if fid != "carumas" else "app_point"),
                bare_threshold_ndvi=BARE, s2_median_ndvi_by_month_2024_2026=s2c, s2_obs_by_month=s2n,
                hls_median_ndvi_by_month=hc, modis_median_ndvi_by_month_2015_present=mc, bare_months=bare,
                vulnerable_months=vul, s2_last_12_months=s2r,
                method=("Monthly median of SCL-masked S2 L2A NDVI (classes 4/5/6 kept; 0-3, 7-11 dropped) 2024-01..2026-11; HLS fills months with no S2. "
                        "Bare = median NDVI < 0.20. Vulnerable = month meeting >=2 of: bare, rainy (ERA5 1991-2020 >=10% of annual), frost (>=5 d Tmin<2C, preferred series per farm)."))


G = dem_grid(); soil = json.loads((OUT / "soilgrids.json").read_text())
res = dict(generated=time.strftime("%Y-%m-%dT%H:%M:%S%z"), farms={})
for fid in FARMS:
    sl = slope(fid, G)
    sg = soil["farms"][fid].get("field_pixel", soil["farms"][fid]["app_point"])
    v = sg["values"]
    res["farms"][fid] = dict(
        soil=dict(label="NON-NASA (ISRIC SoilGrids 2.0, 250 m, machine-learning model; uncertain in hyper-arid/irrigated valleys)",
                  point=sg["used"], offset_m=sg["offset_m"], depth="0-30 cm weighted",
                  clay_pct=v["clay"]["mean_0_30"], sand_pct=v["sand"]["mean_0_30"], silt_pct=v["silt"]["mean_0_30"],
                  soc_g_kg=v["soc"]["mean_0_30"], ph_h2o=v["phh2o"]["mean_0_30"], bulk_density_g_cm3=v["bdod"]["mean_0_30"]),
        cover=cover(fid), frost=frost(fid), slope=sl, erosion=erosion(fid, sl))
    print(fid, json.dumps(dict(slope=sl["window_mean_deg"], bare=res["farms"][fid]["cover"]["bare_months"],
                                vul=[x["month"] for x in res["farms"][fid]["cover"]["vulnerable_months"]],
                                pref=res["farms"][fid]["frost"]["preferred"], lt0=res["farms"][fid]["frost"][res["farms"][fid]["frost"]["preferred"]]["clim_1991_2020_days_lt0_yr"], lt2=res["farms"][fid]["frost"][res["farms"][fid]["frost"]["preferred"]]["clim_1991_2020_days_lt2_yr"],
                                e_lt0=res["farms"][fid]["frost"]["era5_land"]["clim_1991_2020_days_lt0_yr"],
                                d10=res["farms"][fid]["erosion"]["power"]["days_gt10mm_per_yr"], d10e=res["farms"][fid]["erosion"]["era5"]["days_gt10mm_per_yr"])), flush=True)
(OUT / "risk_extensions.json").write_text(json.dumps(res, indent=1, allow_nan=False, default=float))
