#!/usr/bin/env python3
"""Build per-farm-month evidence JSONs (schema of avalanche/oracle/examples/carumas-202610.json) from REAL data.

Inputs (all produced in this repo): data/out/<farm>_daily.csv (POWER + FAO-56 ET0), data/out/<farm>.json,
data/raw/chirps_v3_monthly_points.csv, data/raw/hls_ndvi_points.csv, data/raw/ecostress_jet_points.csv,
data/out/<farm>_ndvi_mod13q1.csv (fallback), data/out/algarrobal.json strategies_recomputed.
Output: avalanche/oracle/evidence/<farm>-<YYYYMM>.json  (never signs or sends anything).
Target chain for the attestation: Avalanche Fuji C-Chain testnet, chainId 43113 (WaterProofRegistry; build-attestation.mjs
defaults to 43113). The same schema moves unchanged to the NOFI L1 (880024) later. The evidence schema itself has no chain field.
usage: data/.venv/bin/python data/build_evidence.py 202607 202608 202609 202610
"""
import hashlib, json, sys
from pathlib import Path
import numpy as np, pandas as pd

D = Path(__file__).resolve().parent
EV = D.parent / "avalanche" / "oracle" / "evidence"
RAW, OUT = D / "raw", D / "out"
sys.path.insert(0, str(D))
from pull_and_build import FARMS, KC_MONTHLY, EFF, clean  # noqa: E402

SCRIPT_SHA = hashlib.sha256((D / "pull_and_build.py").read_bytes()).hexdigest()[:12]
PRIORITIES = {"water": 0.4, "soil": 0.25, "income": 0.25, "resilience": 0.1}
# 1-based strategy index in /workspace/ceres-ai/app.js DB.FARMS[*].strategies (example uses 2 = haba-avena)
ENGINE = {
    "carumas": dict(id=2, name="haba-avena rotation", basis="dashboard + SI fixture recommendation (not recomputed: rainfed, no irrigation water to save)"),
    "samegua": dict(id=2, name="maiz-arveja rotation", basis="dashboard + SI fixture recommendation; water saving recomputed below with ET0 x FAO-56 Kc"),
    "algarrobal": dict(id=4, name="drip + strip cover", basis="reconciled El Algarrobal method (data/fix/apply_algarrobal_fix.mjs): top of re-scored ranking"),
}
# Samegua rotation calendar (assumption, labeled): forage maize Oct-Jan, pea Apr-Jul, fallow otherwise;
# FAO-56 Table 12: maize silage Kc 0.30/1.15/0.50; fresh pea 0.50/1.15/1.10. Same gravity efficiency 0.60.
KC_SAMEGUA_ROT = [1.15, 0.80, 0, 0, 0.6, 1.0, 1.15, 1.05, 0, 0.45, 0.85, 1.15]


def load_csv(p):
    return pd.read_csv(p) if p.exists() else None


_GP = OUT / "green_pixel_candidates.json"
FIELDPX = {k: v["nearest_green_candidates"][0] for k, v in json.loads(_GP.read_text()).items()
           if k in ("samegua", "algarrobal") and v["nearest_green_candidates"]} if _GP.exists() else {}
HLS_FP = load_csv(RAW / "hls_ndvi_fieldpx.csv")
ECO_FP = load_csv(RAW / "ecostress_jet_fieldpx.csv")


def month_rows(df, col, period):
    y, m = period // 100, period % 100
    t = pd.to_datetime(df[col].str[:10])
    return df[(t.dt.year == y) & (t.dt.month == m)]


def build(fid, period, chirps, hls, eco, smap=None):
    f = FARMS[fid]
    px = None
    if fid in FIELDPX:
        px = FIELDPX[fid]
        if HLS_FP is not None and fid in set(HLS_FP.farm): hls = HLS_FP
        if ECO_FP is not None and fid in set(ECO_FP.farm): eco = ECO_FP
    y, m = period // 100, period % 100
    days = pd.Period(f"{y}-{m:02d}").days_in_month
    daily = pd.read_csv(OUT / f"{fid}_daily.csv", parse_dates=["date"])
    md = daily[(daily.date.dt.year == y) & (daily.date.dt.month == m)]
    farm = json.loads((OUT / f"{fid}.json").read_text())
    n_et0 = int(md.ET0_PM_power_raw.notna().sum())
    # allow up to 2 missing days (POWER radiation gaps), filled with the month's mean daily ET0
    et0 = round(float(md.ET0_PM_power_raw.mean()) * days, 1) if n_et0 >= days - 2 else None
    ind = {}

    # ET (ECOSTRESS L3T JET)
    eco_m = month_rows(eco, "datetime_utc", period) if eco is not None else pd.DataFrame()
    eco_m = eco_m[eco_m.farm == fid] if len(eco_m) else eco_m
    good = eco_m[eco_m.et_daily_mm.notna()].drop_duplicates("datetime_utc") if len(eco_m) else eco_m
    if len(good):
        ind["et_mm"] = {"value": round(float(good.et_daily_mm.mean()) * days, 1), "dataset": "ECOSTRESS_L3T_JET_v002",
                        "granules": sorted(good.granule.tolist()), "scale": "70 m",
                        "stat": f"mean ETdaily of {len(good)} valid overpasses x {days} days",
                        "pixel": [px["lat"], px["lon"]] if px else [f["lat"], f["lon"]]}
    else:
        ind["et_mm"] = {"value": None, "dataset": "ECOSTRESS_L3T_JET_v002", "granules": [], "scale": "70 m",
                        "reason": f"no valid ECOSTRESS ETdaily pixel this month ({len(eco_m)} overpasses read, all cloud/nodata)" if eco is not None
                        else "ECOSTRESS not pulled yet",
                        "modeledEtc_mm": round(et0 * np.array(KC_MONTHLY[f['crop']])[m - 1], 1) if et0 else None}

    ind["et0_mm"] = {"value": et0, "dataset": "NASA POWER AG daily (FAO-56 Penman-Monteith)", "point": [f["lat"], f["lon"]],
                     "gridCellElevation_m": farm["elevation"]["power_grid_cell_m"], "farmElevation_m": farm["elevation"]["srtm30m_m"],
                     "days": n_et0, "gapFilledDays": days - n_et0}

    # Precip: IMERG blocked (GES DISC EULA not approved for this Earthdata account) -> CHIRPS v3 substitute
    ch = chirps[chirps.month == f"{y}-{m:02d}"] if chirps is not None else pd.DataFrame()
    if len(ch):
        ind["precip_mm"] = {"value": round(float(ch[fid].iloc[0]), 1), "dataset": "CHIRPS_v3.0_monthly",
                            "scale": "0.05 deg", "substituteFor": "GPM_3IMERGDF_v07",
                            "reason": "GES DISC returned 403 'EULA Acceptance Failure' for this Earthdata token"}
    else:
        ind["precip_mm"] = {"value": round(float(md.PRECTOTCORR.sum()), 1) if n_et0 >= days - 2 else None, "dataset": "NASA POWER AG daily PRECTOTCORR",
                            "scale": "0.5 x 0.625 deg (regional signal)", "substituteFor": "GPM_3IMERGDF_v07",
                            "reason": "IMERG blocked (EULA); CHIRPS month not yet published"}

    # NDVI: HLS clear-scene monthly median, else MODIS MOD13Q1
    hm = month_rows(hls, "date", period) if hls is not None else pd.DataFrame()
    hm = hm[(hm.farm == fid) & hm.ndvi.notna()] if len(hm) else hm
    if len(hm):
        ds = "HLS_S30_v2.0" if set(hm.sensor) == {"HLSS30"} else ("HLS_L30_v2.0" if set(hm.sensor) == {"HLSL30"} else "HLS_L30_S30_v2.0")
        ind["ndvi"] = {"value": round(float(hm.ndvi.median()), 3), "dataset": ds, "granules": sorted(hm.granule.tolist()),
                       "stat": f"monthly median of {len(hm)} clear 30 m scenes (Fmask)",
                       "pixel": [px["lat"], px["lon"]] if px else [f["lat"], f["lon"]]}
    else:
        mo = pd.read_csv(OUT / f"{fid}_ndvi_mod13q1.csv", parse_dates=["date"])
        mm = mo[(mo.date.dt.year == y) & (mo.date.dt.month == m)]
        ind["ndvi"] = {"value": round(float(mm.ndvi.median()), 3) if len(mm) else None, "dataset": "MOD13Q1_v061",
                       "composites": [str(x.date()) for x in mm.date], "stat": "median of 16-day composites (250 m)",
                       "substituteFor": "HLS_S30_v2.0", "reason": "no clear HLS scene this month"}

    # Engine
    e = ENGINE[fid]
    saved, note = 0, None
    if fid == "algarrobal":
        a = farm["strategies_recomputed"]["assumptions"]
        e0 = et0 if et0 else farm["indices"]["power_raw"]["et0_pm_monthly_mm"][m - 1]
        kc = KC_MONTHLY["olive"][m - 1]; pe = farm["crop_water"]["eff_rain_mm_monthly"][m - 1]
        net = max(e0 * kc - pe, 0); win = 1 if m in (5, 6, 7, 8, 9) else 0
        cur = net * 10 / EFF["gravity"]
        drip = net * 10 / EFF["drip"] + e0 * a["kc_cover"] * a["cover_fraction_strips"] * win * 10 / EFF["sprinkler"]
        saved = round((cur - drip) * f["ha"])
        note = (f"this month's POWER ET0 {e0} mm x olive Kc {kc}: gravity {round(cur)} - drip+strip {round(drip)} m3/ha "
                f"x {f['ha']} ha (same method as data/fix/apply_algarrobal_fix.mjs)")
    elif fid == "samegua":
        et0c = et0 if et0 else farm["indices"]["power_raw"]["et0_pm_monthly_mm"][m - 1]
        cur = et0c * KC_MONTHLY["alfalfa"][m - 1] * 10 / EFF["gravity"]
        rot = et0c * KC_SAMEGUA_ROT[m - 1] * 10 / EFF["gravity"]
        saved = max(0, round((cur - rot) * f["ha"]))
        note = f"(alfalfa Kc 0.95 - rotation Kc {KC_SAMEGUA_ROT[m-1]}) x ET0 {et0c} mm / 0.60 x {f['ha']} ha; Kc calendar is an assumption; ET0 from the POWER cell shared with Carumas (3851 m; within 5 % of ERA5 ET0)"
    else:
        note = "rainfed farm: no irrigation water saved; recommendation is about soil cover/erosion"
    ndv = ind["ndvi"]["value"]
    if ndv is not None and ndv < 0.20 and saved:
        note += f"; NDVI {ndv} < 0.20 -> contract anti-abandonment rule would block a credit"
    conf = "medium" if fid == "algarrobal" else "low"
    ctx = {}
    if px:
        ctx["fieldPixel"] = dict(lat=px["lat"], lon=px["lon"], basis="nearest HLS 30 m pixel with NDVI>=0.5 on a recent clear scene "
                                 "(data/out/green_pixel_candidates.json); the app point is bare ground. Confirm with the farmer.")
    if fid == "carumas" and smap is not None:
        sv = smap.dropna(subset=["sm_am"]).copy(); sv["d"] = pd.to_datetime(sv.date)
        cur_m = sv[(sv.d.dt.year == y) & (sv.d.dt.month == m)]
        base = sv[(sv.d.dt.year <= 2025) & (sv.d.dt.month == m)]
        if len(cur_m):
            ctx["soilMoisture"] = dict(value_m3m3=round(float(cur_m.sm_am.mean()), 3), n_retrievals=int(len(cur_m)),
                                       baseline_2015_2025_m3m3=round(float(base.sm_am.mean()), 3), dataset="SMAP_SPL3SMP_E_v006",
                                       scale="9 km (regional signal)", granules=sorted(cur_m.granule.str.replace("_Soil_Moisture_Retrieval_Data_AM_soil_moisture_subsetted.nc4", "", regex=False).tolist()))
    ev = {
        "_note": "REAL values from data/build_evidence.py. Nulls are explained by 'reason'. Not signed, not sent. Target: WaterProofRegistry on Avalanche Fuji C-Chain testnet (chainId 43113).",
        "_context": ctx,
        "farmKey": f"moquegua:{fid}", "period": period, "revision": 0, "indicators": ind,
        "engine": {"version": f"ceres pull_and_build.py (sha256 {SCRIPT_SHA})", "priorities": PRIORITIES,
                   "recommendedStrategyId": e["id"], "recommendedStrategy": e["name"], "waterSavedM3": saved,
                   "waterSavedBasis": note, "recommendationBasis": e["basis"], "confidence": conf},
    }
    ext = extensions(fid, y, m)
    if ext and fid != "carumas":
        fp_ok = (RAW / "hls_ndvi_fieldpx.csv").exists() and (RAW / "ecostress_jet_fieldpx.csv").exists()
        ext["fieldPixelStatus"] = "complete" if fp_ok else ("PENDING/PARTIAL: field-pixel HLS+ECOSTRESS re-sampling still running; "
                                                            "indicators.ndvi / et_mm here are from the bare app point and understate the crop. "
                                                            "extensions.cover (Sentinel-2) already uses the field pixel.")
    if ext:
        ev["extensions"] = ext
    return clean(ev)


def extensions(fid, y, m):
    """Extension block (soil / cover / frost / erosion) from out/risk_extensions.json (data/partner/risk_build.py).
    Outside the required schema; hashed with the rest of the canonical JSON but not read by build-attestation.mjs."""
    f = OUT / "risk_extensions.json"
    if not f.exists():
        return None
    R = json.loads(f.read_text())["farms"][fid]; k = m - 1; MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    c, fr, er = R["cover"], R["frost"], R["erosion"]; pf = fr["preferred"]
    s2 = pd.read_csv(RAW / "s2_ndvi_points.csv"); s2 = s2[(s2.farm == fid) & s2.ndvi.notna() & s2.date.str.startswith(f"{y}-{m:02d}")]
    s2 = s2[(s2.ndvi > -0.2) & (s2.ndvi <= 1)]
    yr = fr[pf]["recent_years"].get(str(y), {})
    import pandas as _pd
    t = None
    try:
        hd = _pd.read_csv(OUT.parent / "historical" / f"{fid}_power_daily_1981_present.csv", parse_dates=["date"]).set_index("date").replace(-999.0, float("nan"))
        mm = hd[(hd.index.year == y) & (hd.index.month == m)].T2M_MIN
        sh = {"power": 0.0, "power_site_lapse": None}.get(pf)
        if pf == "power_site_lapse":
            sh = json.loads((OUT / f"{fid}.json").read_text())["elevation"]["lapse_shift_degC"]
        if sh is not None and len(mm):
            t = dict(series=pf, days_lt0=int(((mm + sh) < 0).sum()), days_lt2=int(((mm + sh) < 2).sum()), n_days=int(mm.notna().sum()))
    except Exception:
        t = None
    if t is None:
        j = json.loads((RAW / f"openmeteo_era5_land_{fid}.json").read_text())["daily"]
        e = _pd.Series(_pd.to_numeric(_pd.Series(j["temperature_2m_min"]), errors="coerce").values, index=_pd.to_datetime(j["time"]))
        mm = e[(e.index.year == y) & (e.index.month == m)].dropna()
        t = dict(series="era5_land (ERA5 via Open-Meteo)", days_lt0=int((mm < 0).sum()), days_lt2=int((mm < 2).sum()), n_days=int(len(mm)))
    return dict(
        _label="Extension block: not part of the required oracle schema. Partner/NON-NASA layers labelled per field.",
        soil=R["soil"],
        cover=dict(dataset="ESA Sentinel-2 L2A 10 m (partner; Element84 Earth Search STAC, SCL cloud mask)", point=c["point"],
                   ndvi_month_median=None if s2.empty else round(float(s2.ndvi.median()), 3), n_clear_obs=int(len(s2)),
                   items=sorted(s2.item.tolist()), ndvi_clim_this_month=c["s2_median_ndvi_by_month_2024_2026"][k],
                   bare_threshold_ndvi=c["bare_threshold_ndvi"], bare_months=c["bare_months"],
                   bare_this_month=(None if s2.empty else bool(float(s2.ndvi.median()) < c["bare_threshold_ndvi"])),
                   vulnerable_this_month=next((v["reasons"] for v in c["vulnerable_months"] if v["month"] == MON[k]), []), method=c["method"]),
        frost=dict(this_month=t, clim_1991_2020_days_lt0=fr[pf]["clim_1991_2020_days_lt0_by_month"][k],
                   clim_1991_2020_days_lt2=fr[pf]["clim_1991_2020_days_lt2_by_month"][k], preferred_series=pf,
                   preferred_reason=fr["preferred_reason"], raw_power_clim_days_lt0=fr["power"]["clim_1991_2020_days_lt0_by_month"][k],
                   era5_land_clim_days_lt0=fr["era5_land"]["clim_1991_2020_days_lt0_by_month"][k]),
        slope=R["slope"],
        erosion=dict(proxy_tan_slope_x_days_gt10mm={"power": er["power"]["proxy_tan_slope_x_days_gt10mm"], "era5": er["era5"]["proxy_tan_slope_x_days_gt10mm"]},
                     proxy_tan_slope_x_p95_intensity={"power": er["power"]["proxy_tan_slope_x_p95_intensity"], "era5": er["era5"]["proxy_tan_slope_x_p95_intensity"]},
                     clim_days_gt10mm_this_month={"power": er["power"]["days_gt10mm_by_month"][k], "era5": er["era5"]["days_gt10mm_by_month"][k]},
                     method=er["method"], imerg_status=er["imerg_status"]))


def main():
    periods = [int(p) for p in sys.argv[1:]] or [202607, 202608, 202609, 202610]
    EV.mkdir(parents=True, exist_ok=True)
    chirps, hls, eco = load_csv(RAW / "chirps_v3_monthly_points.csv"), load_csv(RAW / "hls_ndvi_points.csv"), load_csv(RAW / "ecostress_jet_points.csv")
    for fid in FARMS:
        for p in periods:
            ev = build(fid, p, chirps, hls, eco, load_csv(RAW / "smap_carumas.csv"))
            (EV / f"{fid}-{p}.json").write_text(json.dumps(ev, indent=2, ensure_ascii=False, allow_nan=False))
            i = ev["indicators"]
            print(fid, p, {k: v["value"] for k, v in i.items()}, ev["engine"]["waterSavedM3"])


if __name__ == "__main__":
    main()
