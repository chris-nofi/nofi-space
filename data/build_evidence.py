#!/usr/bin/env python3
"""Build per-farm-month evidence JSONs (schema of avalanche/oracle/examples/carumas-202610.json) from REAL data.

Inputs (all produced in this repo): data/out/<farm>_daily.csv (POWER + FAO-56 ET0), data/out/<farm>.json,
data/raw/chirps_v3_monthly_points.csv, data/raw/hls_ndvi_points.csv, data/raw/ecostress_jet_points.csv,
data/out/<farm>_ndvi_mod13q1.csv (fallback), data/out/algarrobal.json strategies_recomputed.
Output: avalanche/oracle/evidence/<farm>-<YYYYMM>.json  (never signs or sends anything).
Target chain for the later attestation: NOFI Avalanche L1 testnet, chainId 880024 (pass --chain 880024 to
build-attestation.mjs). The evidence schema itself has no chain field.
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


def month_rows(df, col, period):
    y, m = period // 100, period % 100
    t = pd.to_datetime(df[col].str[:10])
    return df[(t.dt.year == y) & (t.dt.month == m)]


def build(fid, period, chirps, hls, eco):
    f = FARMS[fid]
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
    good = eco_m[eco_m.et_daily_mm.notna()] if len(eco_m) else eco_m
    if len(good):
        ind["et_mm"] = {"value": round(float(good.et_daily_mm.mean()) * days, 1), "dataset": "ECOSTRESS_L3T_JET_v002",
                        "granules": sorted(good.granule.tolist()), "scale": "70 m",
                        "stat": f"mean ETdaily of {len(good)} valid overpasses x {days} days"}
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
                       "stat": f"monthly median of {len(hm)} clear 30 m scenes (Fmask)"}
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
        s = farm["strategies_recomputed"]
        saved = round((s["current"]["monthly"][m - 1] - s["drip"]["monthly"][m - 1]) * f["ha"])
        note = f"(current gravity - drip+strip) month {m} m3/ha x {f['ha']} ha; climatological ET0 2001-2025"
    elif fid == "samegua":
        et0c = farm["indices"]["power_raw"]["et0_pm_monthly_mm"][m - 1]
        cur = et0c * KC_MONTHLY["alfalfa"][m - 1] * 10 / EFF["gravity"]
        rot = et0c * KC_SAMEGUA_ROT[m - 1] * 10 / EFF["gravity"]
        saved = max(0, round((cur - rot) * f["ha"]))
        note = f"(alfalfa Kc 0.95 - rotation Kc {KC_SAMEGUA_ROT[m-1]}) x ET0 {et0c} mm / 0.60 x {f['ha']} ha; ET0 from POWER cell at 3851 m (see caveat)"
    else:
        note = "rainfed farm: no irrigation water saved; recommendation is about soil cover/erosion"
    ndv = ind["ndvi"]["value"]
    if ndv is not None and ndv < 0.20 and saved:
        note += f"; NDVI {ndv} < 0.20 -> contract anti-abandonment rule would block a credit"
    conf = "medium" if fid == "algarrobal" else "low"
    ev = {
        "_note": "REAL values from data/build_evidence.py. Nulls are explained by 'reason'. Not signed, not sent. Target: NOFI Avalanche L1 testnet chainId 880024.",
        "farmKey": f"moquegua:{fid}", "period": period, "revision": 0, "indicators": ind,
        "engine": {"version": f"ceres pull_and_build.py (sha256 {SCRIPT_SHA})", "priorities": PRIORITIES,
                   "recommendedStrategyId": e["id"], "recommendedStrategy": e["name"], "waterSavedM3": saved,
                   "waterSavedBasis": note, "recommendationBasis": e["basis"], "confidence": conf},
    }
    return clean(ev)


def main():
    periods = [int(p) for p in sys.argv[1:]] or [202607, 202608, 202609, 202610]
    EV.mkdir(parents=True, exist_ok=True)
    chirps, hls, eco = load_csv(RAW / "chirps_v3_monthly_points.csv"), load_csv(RAW / "hls_ndvi_points.csv"), load_csv(RAW / "ecostress_jet_points.csv")
    for fid in FARMS:
        for p in periods:
            ev = build(fid, p, chirps, hls, eco)
            (EV / f"{fid}-{p}.json").write_text(json.dumps(ev, indent=2, ensure_ascii=False, allow_nan=False))
            i = ev["indicators"]
            print(fid, p, {k: v["value"] for k, v in i.items()}, ev["engine"]["waterSavedM3"])


if __name__ == "__main__":
    main()
