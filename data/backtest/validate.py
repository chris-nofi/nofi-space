#!/usr/bin/env python3
"""Validation overlays for the 1981-2025 backtest (never used as the base series).
POWER (as used in the hindcast) vs ERA5/ERA5-Land, GPM IMERG Final monthly v07, SMAP L3 (Carumas), CHIRPS v3.
Writes data/backtest/_validation.json"""
from __future__ import annotations
import json, sys
from pathlib import Path
import numpy as np, pandas as pd
from scipy import stats
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT)); sys.path.insert(0, str(ROOT / "backtest"))
from backtest import load_power, load_era5, FARMS, BASE0, BASE1  # noqa: E402
RAW = ROOT / "raw"

def cmp(a, b):
    j = pd.concat([a, b], axis=1).dropna()
    if len(j) < 5:
        return None
    x, y = j.iloc[:, 0], j.iloc[:, 1]
    return dict(n=int(len(j)), pearson_r=round(float(np.corrcoef(x, y)[0, 1]), 3), spearman_rho=round(float(stats.spearmanr(x, y)[0]), 3),
                bias_power_minus_ref=round(float((x - y).mean()), 2), rmse=round(float(np.sqrt(((x - y) ** 2).mean())), 2))

def quintile_agree(a, b, q=0.2):
    """Agreement on which seasons are in the driest quintile of each series (each ranked against itself)."""
    j = pd.concat([a, b], axis=1).dropna()
    if len(j) < 8:
        return None
    k = max(1, int(round(q * len(j))))
    la = set(j.iloc[:, 0].nsmallest(k).index); lb = set(j.iloc[:, 1].nsmallest(k).index)
    return dict(n_seasons=int(len(j)), k_driest=k, overlap=len(la & lb), driest_power=sorted(int(i) for i in la), driest_ref=sorted(int(i) for i in lb))

def season_sum(s, m0=11, m1=3):
    """Nov-Mar sums of a MONTHLY series, labelled by harvest year; only seasons with all 5 months present."""
    s = s.dropna(); out = {}
    for y in range(1982, 2026):
        w = s[(s.index >= pd.Timestamp(y - 1, m0, 1)) & (s.index <= pd.Timestamp(y, m1, 1))]
        out[y] = float(w.sum()) if len(w) == 5 else np.nan
    return pd.Series(out)

def main():
    res = dict(daily={}, monthly={}, seasonal={}, supply_index={}, smap={}, frost={})
    imerg = pd.read_csv(RAW / "imerg_monthly_final_v07.csv") if (RAW / "imerg_monthly_final_v07.csv").exists() else None
    chirps = pd.read_csv(RAW / "chirps_v3_monthly_points.csv"); chirps.index = pd.to_datetime(chirps.month)
    for fid in FARMS:
        p, _ = load_power(fid); e = load_era5(fid)
        res["daily"][fid] = dict(
            rain_power_vs_era5=cmp(p.P, e.P),
            tmin_power_used_vs_era5land=cmp(p.TMIN, e.TMIN), tmax_power_used_vs_era5land=cmp(p.TMAX, e.TMAX),
            tmin_power_raw_cell_vs_era5land=cmp(p.TMIN_RAW, e.TMIN), et0_power_pm_vs_era5_fao=cmp(p.ET0, e.ET0))
        pm, em = p.resample("MS").agg(dict(P="sum", TMIN="mean", TMAX="mean", ET0="sum")), e.resample("MS").agg(dict(P="sum", TMIN="mean", TMAX="mean", ET0="sum"))
        im = None
        if imerg is not None:
            im = imerg[imerg.farm == fid].assign(d=lambda x: pd.to_datetime(x.month)).set_index("d").mm_month
        ch = chirps[fid]
        res["monthly"][fid] = dict(rain_power_vs_era5=cmp(pm.P, em.P), rain_power_vs_imerg_final=cmp(pm.P, im) if im is not None else None,
                                   rain_power_vs_chirps=cmp(pm.P, ch), tmin_vs_era5land=cmp(pm.TMIN, em.TMIN), tmax_vs_era5land=cmp(pm.TMAX, em.TMAX),
                                   et0_vs_era5=cmp(pm.ET0, em.ET0))
        sp, se = season_sum(pm.P), season_sum(em.P)
        si = season_sum(im) if im is not None else None
        sc = season_sum(ch)
        res["seasonal"][fid] = dict(window="Nov-Mar rain, labelled by harvest year",
                                    power_vs_era5=cmp(sp, se), power_vs_imerg=cmp(sp, si) if si is not None else None, power_vs_chirps=cmp(sp, sc),
                                    driest_quintile_power_vs_era5=quintile_agree(sp, se), driest_quintile_power_vs_imerg=quintile_agree(sp, si) if si is not None else None,
                                    driest_quintile_power_vs_chirps=quintile_agree(sp, sc),
                                    climatology_1991_2020_mm=dict(power=round(float(sp.loc[BASE0:BASE1].mean()), 1), era5=round(float(se.loc[BASE0:BASE1].mean()), 1),
                                                                  chirps=round(float(sc.loc[BASE0:BASE1].mean()), 1)),
                                    imerg_2001_2025_mean_mm=round(float(si.loc[2001:2025].mean()), 1) if si is not None else None,
                                    power_2001_2025_mean_mm=round(float(sp.loc[2001:2025].mean()), 1))
        if fid == "carumas":
            def jfm(s):
                s = s.dropna(); g = s[s.index.month <= 3]
                c = g.groupby(g.index.year).count(); t = g.groupby(g.index.year).sum()
                return t[c == 3]
            res["supply_index"] = dict(note="Jan-Mar rain in the upper-basin cell that drives the irrigation-supply proxy",
                                       power_vs_era5=cmp(jfm(pm.P), jfm(em.P)), power_vs_imerg=cmp(jfm(pm.P), jfm(im)) if im is not None else None,
                                       power_vs_chirps=cmp(jfm(pm.P), jfm(ch)))
            sm = pd.read_csv(RAW / "smap_carumas.csv", parse_dates=["date"]).set_index("date").sm_am
            smm = sm.resample("MS").mean(); cnt = sm.resample("MS").count(); smm = smm[cnt >= 5]
            gw = p.GW.resample("MS").mean()
            ssm = {}; sgw = {}; srain = {}
            for y in range(2016, 2026):
                w = (smm.index >= pd.Timestamp(y - 1, 11, 1)) & (smm.index <= pd.Timestamp(y, 3, 1))
                if w.sum() == 5:
                    ssm[y] = smm[w].mean()
                    sgw[y] = gw[(gw.index >= pd.Timestamp(y - 1, 11, 1)) & (gw.index <= pd.Timestamp(y, 3, 1))].mean()
                    srain[y] = sp.get(y)
            ssm, sgw, srain = pd.Series(ssm), pd.Series(sgw), pd.Series(srain)
            def anom(s):
                return s.groupby(s.index.month).transform(lambda x: x - x.mean())
            res["smap"] = dict(product="SMAP L3 SPL3SMP_E v006 9 km AM, Carumas EASE-2 cell (regional signal)",
                               monthly_anom_smap_vs_power_gwetroot=cmp(anom(smm), anom(gw)),
                               monthly_anom_smap_vs_power_rain=cmp(anom(smm), anom(pm.P)),
                               season_smap_vs_power_rain=cmp(ssm, srain), season_smap_vs_power_gwetroot=cmp(ssm, sgw),
                               seasons=sorted(int(i) for i in ssm.index), season_mean_sm=dict((int(k), round(float(v), 3)) for k, v in ssm.items()))
            res["smap_wrsi_hook"] = dict(ssm=dict((int(k), float(v)) for k, v in ssm.items()))
        # frost days (Tmin < 0 C) per year, 1991-2020: used series vs ERA5-Land vs raw cell
        b = lambda s: float((s.loc[str(BASE0):str(BASE1)] < 0).groupby(s.loc[str(BASE0):str(BASE1)].index.year).sum().mean())
        res["frost"][fid] = dict(days_lt0_per_yr_power_used=round(b(p.TMIN), 1), days_lt0_per_yr_era5land=round(b(e.TMIN), 1),
                                 days_lt0_per_yr_power_raw_cell=round(b(p.TMIN_RAW), 1),
                                 abs_min_power_used=round(float(p.TMIN.min()), 1), abs_min_era5land=round(float(e.TMIN.min()), 1))
    # IMERG rain substitution (sensitivity): Carumas crops, absolute WRSI with IMERG Final monthly rain spread evenly
    # over each month's days (POWER ET0/Tmin unchanged), seasons fully inside 2001-01..2025-09.
    from backtest import run_crop, CROPS, season_end_years
    p, _ = load_power("carumas")
    im = imerg[imerg.farm == "carumas"].assign(d=lambda x: pd.to_datetime(x.month)).set_index("d").mm_month
    daily_im = pd.Series({d: im.get(pd.Timestamp(d.year, d.month, 1), np.nan) / d.days_in_month for d in p.index})
    q = p.copy(); q["P"] = daily_im.values
    sub = {}
    for cid in ("potato", "faba", "oatvetch", "tarwi", "barley"):
        rows = {}
        for y in season_end_years(cid):
            if y < 2002:
                continue
            r = run_crop(q.loc["2001-01-01":"2025-09-30"], "carumas", cid, y)
            if r:
                rp = run_crop(p, "carumas", cid, y)
                rows[y] = (r["wrsi"], rp["wrsi"])
        a = np.array(list(rows.values()))
        sub[cid] = dict(n=len(rows), median_abs_wrsi_imerg=round(float(np.median(a[:, 0])), 1), median_abs_wrsi_power=round(float(np.median(a[:, 1])), 1),
                        abs_failures_imerg=int((a[:, 0] < 50).sum()), abs_failures_power=int((a[:, 1] < 50).sum()),
                        spearman_imerg_vs_power_wrsi=round(float(stats.spearmanr(a[:, 0], a[:, 1])[0]), 3))
    res["imerg_rain_substitution_carumas"] = sub
    (ROOT / "backtest" / "_validation.json").write_text(json.dumps(res, default=float, indent=1))
    print(json.dumps({k: res[k] for k in ("seasonal", "supply_index", "smap")}, default=float)[:4000])

if __name__ == "__main__":
    main()
