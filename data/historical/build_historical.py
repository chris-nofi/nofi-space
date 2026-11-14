#!/usr/bin/env python3
"""Historical climate for the 3 Ceres Ventures farms (Moquegua, Peru), 1981 -> latest.

Sources (all no-login):
  NASA POWER daily, community=AG      https://power.larc.nasa.gov/api/temporal/daily/point
  CHIRPS v3.0 monthly (UCSB CHC) COGs https://data.chc.ucsb.edu/products/CHIRPS/v3.0/monthly/global/cogs/
      (run chirps3_pull.py first; the IRI v2.0 route times out on 45-yr ranges)
  Copernicus ERA5-Land (temps) and ERA5 (precip, ET0) via Open-Meteo Historical Weather API
      https://archive-api.open-meteo.com/v1/archive   (third-party redistribution; CDS itself needs a login)
Run:  data/.venv/bin/python data/historical/build_historical.py
"""
from __future__ import annotations

import datetime as dt
import io
import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests
import xarray as xr
from scipy import stats

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from pull_and_build import FARMS, RAW, clean, get, power_daily, power_df  # noqa: E402

UA = {"User-Agent": "CeresVentures-SpaceApps2026/1.0"}
C0, C1 = 1991, 2020


CHIRPS_BOX = "X/-71.35/-70.60/RANGEEDGES/Y/-17.70/-16.75/RANGEEDGES"


def _chirps_year(y, last):
    import concurrent.futures  # noqa
    p = RAW / "chirps" / f"chirps_monthly_box_{y}.nc"
    if p.exists():
        return p
    p.parent.mkdir(parents=True, exist_ok=True)
    t1 = f"Dec%20{y}" if y < last.year else f"{last.strftime('%b')}%20{y}"
    url = ("https://iridl.ldeo.columbia.edu/SOURCES/.UCSB/.CHIRPS/.v2p0/.monthly/.global/.precipitation/"
           f"{CHIRPS_BOX}/T/(Jan%20{y})/({t1})/RANGEEDGES/data.nc")
    for i in range(4):
        try:
            r = requests.get(url, headers=UA, timeout=240)
            if r.status_code == 200:
                p.write_bytes(r.content); return p
        except requests.RequestException:
            pass
        time.sleep(5 * (i + 1))
    raise RuntimeError(f"CHIRPS {y} failed")


_CH = {}


def chirps(fid, f):
    """CHIRPS v3.0 monthly at the farm point from ../raw/chirps_v3_monthly_points.csv (run chirps3_pull.py first)."""
    df = pd.read_csv(RAW / "chirps_v3_monthly_points.csv")
    s = pd.Series(df[fid].values, index=pd.to_datetime(df.month + "-01"), name="chirps_mm").sort_index()
    return s, f["lon"], f["lat"]


def chirps_v2_iri(fid, f):
    """(Slow; kept for reference) CHIRPS v2.0 monthly, one IRI request per year for a box covering all 3 farms (IRI is slow on long ranges)."""
    import concurrent.futures as cf
    if not _CH:
        last = dt.date.today().replace(day=1) - dt.timedelta(days=1)
        # CHIRPS final monthly lags ~3 weeks; probe the last available month by trying last year first
        years = list(range(1981, last.year + 1))
        with cf.ThreadPoolExecutor(4) as ex:
            paths = list(ex.map(lambda y: _chirps_year_safe(y, last), years))
        _CH["ds"] = xr.concat([xr.open_dataset(p, decode_times=False) for p in paths if p], dim="T")
    d = _CH["ds"].sel(X=f["lon"], Y=f["lat"], method="nearest")
    t = d["T"].values
    idx = [pd.Timestamp(1960 + int(m) // 12, int(m) % 12 + 1, 1) for m in np.floor(t)]
    return pd.Series(d["precipitation"].values.ravel(), index=idx, name="chirps_mm"), float(d["X"].values), float(d["Y"].values)


def _chirps_year_safe(y, last):
    try:
        return _chirps_year(y, last)
    except Exception:
        # latest year may not have all months yet: step back month by month
        if y == last.year:
            for m in range(last.month - 1, 0, -1):
                try:
                    return _chirps_year(y, dt.date(y, m, 1))
                except Exception:
                    continue
        return None


def openmeteo(fid, f, model, daily):
    p = RAW / f"openmeteo_{model}_{fid}.json"
    if not p.exists():
        end = (dt.date.today() - dt.timedelta(days=7)).isoformat()
        prm = dict(latitude=f["lat"], longitude=f["lon"], start_date="1981-01-01", end_date=end,
                   daily=",".join(daily), models=model, timezone="America/Lima")
        p.write_text(json.dumps(get("https://archive-api.open-meteo.com/v1/archive", prm, timeout=300).json()))
    js = json.loads(p.read_text())
    df = pd.DataFrame(js["daily"]).set_index("time")
    df.index = pd.to_datetime(df.index)
    return df, js.get("latitude"), js.get("longitude"), js.get("elevation")


def trend(series):
    s = series.dropna()
    x = s.index.values.astype(float)
    if len(s) < 10:
        return None
    lr = stats.linregress(x, s.values)
    sen = stats.theilslopes(s.values, x)
    tau = stats.kendalltau(x, s.values)
    return dict(ols_per_decade=round(lr.slope * 10, 3), ols_p=round(lr.pvalue, 4),
                sen_per_decade=round(sen[0] * 10, 3), mann_kendall_tau=round(tau.statistic, 3),
                mann_kendall_p=round(tau.pvalue, 4), years=f"{int(x[0])}-{int(x[-1])}", n=len(s))


def main():
    rows_summary = []
    allout = {}
    for fid, f in FARMS.items():
        pj = power_daily(fid, f, False)
        d = power_df(pj)
        cell = pj["geometry"]["coordinates"][2]
        last_valid = d["T2M"].last_valid_index()
        d = d.loc[:last_valid]
        d.to_csv(HERE / f"{fid}_power_daily_1981_present.csv", index_label="date")
        # QC: POWER PRECTOTCORR has isolated spurious spikes (e.g. 2022-09-12 ~260 mm at the coast). Flag any day
        # > 50 mm whose CHIRPS month total is < 25 % of that day, and exclude it from monthly/annual sums.
        ch_pre, _, _ = chirps(fid, f)
        flagged = []
        for day, v in d.PRECTOTCORR[d.PRECTOTCORR > 50].items():
            cm_ = ch_pre.get(pd.Timestamp(day.year, day.month, 1), np.nan)
            if not np.isnan(cm_) and cm_ < 0.25 * v:
                flagged.append(dict(date=str(day.date()), power_mm=round(float(v), 1), chirps_month_mm=round(float(cm_), 1)))
                d.loc[day, "PRECTOTCORR"] = np.nan
        cnt = d["T2M"].resample("MS").count()
        m = pd.DataFrame(dict(
            t2m=d.T2M.resample("MS").mean(), tmax=d.T2M_MAX.resample("MS").mean(), tmin=d.T2M_MIN.resample("MS").mean(),
            precip_mm=d.PRECTOTCORR.resample("MS").sum(min_count=1),
            frost_days_lt0=(d.T2M_MIN < 0).resample("MS").sum(), heat_days_gt30=(d.T2M_MAX > 30).resample("MS").sum(),
            tmin_abs=d.T2M_MIN.resample("MS").min(), tmax_abs=d.T2M_MAX.resample("MS").max(),
            precip_max_day=d.PRECTOTCORR.resample("MS").max()))
        m = m[cnt >= 28]
        ch, chx, chy = chirps(fid, f)
        m = m.join(ch, how="left")
        e5l, *_e5l = openmeteo(fid, f, "era5_land", ["temperature_2m_mean", "temperature_2m_max", "temperature_2m_min", "precipitation_sum"])
        e5, *_e5 = openmeteo(fid, f, "era5", ["temperature_2m_mean", "precipitation_sum", "et0_fao_evapotranspiration"])
        m["era5land_t2m"] = e5l.temperature_2m_mean.resample("MS").mean()
        m["era5land_precip_mm"] = e5l.precipitation_sum.resample("MS").sum(min_count=20)
        m["era5_t2m"] = e5.temperature_2m_mean.resample("MS").mean()
        m["era5_precip_mm"] = e5.precipitation_sum.resample("MS").sum(min_count=20)
        m["era5_et0_mm"] = e5.et0_fao_evapotranspiration.resample("MS").sum(min_count=20)
        m.round(2).to_csv(HERE / f"{fid}_monthly_1981_present.csv", index_label="month")

        full_years = m.groupby(m.index.year).size()
        full_years = full_years[full_years == 12].index
        a = m[m.index.year.isin(full_years)].groupby(lambda i: i.year).agg(
            t2m=("t2m", "mean"), tmax=("tmax", "mean"), tmin=("tmin", "mean"), precip_mm=("precip_mm", "sum"),
            chirps_mm=("chirps_mm", lambda s: s.sum(min_count=12)), frost_days_lt0=("frost_days_lt0", "sum"),
            heat_days_gt30=("heat_days_gt30", "sum"), tmin_abs=("tmin_abs", "min"), tmax_abs=("tmax_abs", "max"),
            precip_max_day=("precip_max_day", "max"), era5_precip_mm=("era5_precip_mm", lambda s: s.sum(min_count=12)),
            era5land_t2m=("era5land_t2m", "mean"))
        a.round(2).to_csv(HERE / f"{fid}_annual_1981_present.csv", index_label="year")

        cm = m[(m.index.year >= C0) & (m.index.year <= C1)]
        clim = cm.groupby(cm.index.month).mean().round(2)
        clim.to_csv(HERE / f"{fid}_climatology_1991_2020.csv", index_label="month")

        # ENSO wet-season windows (Dec-Apr) vs 1991-2020 Dec-Apr mean
        def window(y0):
            w = m[(m.index >= pd.Timestamp(y0, 12, 1)) & (m.index <= pd.Timestamp(y0 + 1, 4, 1))]
            return w
        base_w = pd.concat([window(y).assign(y=y) for y in range(C0 - 1, C1)])
        bt, bp = base_w.t2m.mean(), base_w.groupby("y").precip_mm.sum().mean()
        bch = base_w.groupby("y").chirps_mm.sum().mean()
        enso = {}
        for lab, y0 in {"1982-83 El Nino": 1982, "1997-98 El Nino": 1997, "2015-16 El Nino": 2015, "2023-24 El Nino": 2023,
                        "1998-99 La Nina": 1998, "2010-11 La Nina": 2010}.items():
            w = window(y0)
            enso[lab] = dict(dec_apr_t2m_anom=round(w.t2m.mean() - bt, 2), dec_apr_precip_mm=round(w.precip_mm.sum(), 1),
                             base_precip_mm=round(bp, 1), dec_apr_chirps_mm=round(w.chirps_mm.sum(), 1), base_chirps_mm=round(bch, 1),
                             tmax_anom=round(w.tmax.mean() - base_w.tmax.mean(), 2))

        aa = a[a.index <= 2025]
        ext = dict(
            hottest_year=dict(year=int(aa.t2m.idxmax()), t2m=round(aa.t2m.max(), 2)),
            coldest_year=dict(year=int(aa.t2m.idxmin()), t2m=round(aa.t2m.min(), 2)),
            wettest_year_power=dict(year=int(aa.precip_mm.idxmax()), mm=round(aa.precip_mm.max(), 1)),
            driest_year_power=dict(year=int(aa.precip_mm.idxmin()), mm=round(aa.precip_mm.min(), 1)),
            wettest_year_chirps=dict(year=int(aa.chirps_mm.idxmax()), mm=round(aa.chirps_mm.max(), 1)) if aa.chirps_mm.notna().any() else None,
            driest_year_chirps=dict(year=int(aa.chirps_mm.idxmin()), mm=round(aa.chirps_mm.min(), 1)) if aa.chirps_mm.notna().any() else None,
            record_tmax=dict(date=str(d.T2M_MAX.idxmax().date()), c=round(d.T2M_MAX.max(), 2)),
            record_tmin=dict(date=str(d.T2M_MIN.idxmin().date()), c=round(d.T2M_MIN.min(), 2)),
            record_daily_precip=dict(date=str(d.PRECTOTCORR.idxmax().date()), mm=round(d.PRECTOTCORR.max(), 2)),
            most_frost_days=dict(year=int(aa.frost_days_lt0.idxmax()), days=int(aa.frost_days_lt0.max())),
            mean_frost_days_per_year_1991_2020=round(float(aa.loc[C0:C1].frost_days_lt0.mean()), 1),
        )
        tr = {k: trend(aa[k]) for k in ["t2m", "tmax", "tmin", "precip_mm", "chirps_mm", "frost_days_lt0", "era5land_t2m"]}
        cross = dict(
            power_vs_chirps_precip_1991_2020_mm_yr=[round(float(aa.loc[C0:C1].precip_mm.mean()), 1), round(float(aa.loc[C0:C1].chirps_mm.mean()), 1)],
            power_vs_era5_precip_1991_2020_mm_yr=[round(float(aa.loc[C0:C1].precip_mm.mean()), 1), round(float(aa.loc[C0:C1].era5_precip_mm.mean()), 1)],
            power_vs_era5land_t2m_1991_2020=[round(float(aa.loc[C0:C1].t2m.mean()), 2), round(float(aa.loc[C0:C1].era5land_t2m.mean()), 2)],
            grid_points=dict(power_cell_elev_m=round(cell, 1), chirps_cell=[chy, chx],
                             era5land_cell=[_e5l[0], _e5l[1], _e5l[2]], era5_cell=[_e5[0], _e5[1], _e5[2]]))
        et0e = aa_et0 = m[(m.index.year >= C0) & (m.index.year <= C1)].era5_et0_mm
        out = dict(farm=fid, power_precip_qc_flagged_days=flagged,
                   era5_et0_mm_yr_1991_2020=round(float(et0e.groupby(et0e.index.year).sum(min_count=12).mean()), 1), lat=f["lat"], lon=f["lon"], period=f"{d.index.min().date()}..{last_valid.date()}",
                   climatology_1991_2020=dict(t2m_ann=round(float(clim.t2m.mean()), 2), precip_mm_yr=round(float(clim.precip_mm.sum()), 1),
                                              chirps_mm_yr=round(float(clim.chirps_mm.sum()), 1),
                                              frost_days_yr=round(float(clim.frost_days_lt0.sum()), 1)),
                   trends=tr, extremes=ext, enso_dec_apr=enso, cross_checks=cross,
                   sources=dict(power="https://power.larc.nasa.gov/api/temporal/daily/point (community=AG; radiation only from 1984)",
                                chirps="CHIRPS v3.0 monthly COGs, UCSB CHC https://data.chc.ucsb.edu/products/CHIRPS/v3.0/monthly/global/cogs/",
                                era5="https://archive-api.open-meteo.com/v1/archive models=era5,era5_land (Copernicus C3S, via Open-Meteo)"))
        (HERE / f"{fid}_historical_summary.json").write_text(json.dumps(clean(out), indent=1, default=float, allow_nan=False))
        allout[fid] = out
        c = out["climatology_1991_2020"]
        rows_summary.append(f"| {fid} | {out['period']} | {c['t2m_ann']} | {c['precip_mm_yr']} | {c['chirps_mm_yr']} | {c['frost_days_yr']} | "
                            f"{tr['t2m']['sen_per_decade']:+.2f} (p={tr['t2m']['mann_kendall_p']}) | {tr['tmin']['sen_per_decade']:+.2f} | "
                            f"{tr['precip_mm']['sen_per_decade']:+.1f} (p={tr['precip_mm']['mann_kendall_p']}) | "
                            f"{ext['hottest_year']['year']} ({ext['hottest_year']['t2m']}) | {ext['coldest_year']['year']} ({ext['coldest_year']['t2m']}) | "
                            f"{ext['wettest_year_power']['year']} ({ext['wettest_year_power']['mm']}) | {ext['record_tmin']['c']} on {ext['record_tmin']['date']} |")
        print("[ok]", fid, flush=True)
    (HERE / "historical_all.json").write_text(json.dumps(clean(allout), indent=1, default=float, allow_nan=False))
    hdr = ("| Farm | POWER period | T2M 1991-2020 (C) | POWER precip 1991-2020 (mm/yr) | CHIRPS precip 1991-2020 (mm/yr) | Frost days/yr (Tmin<0, POWER cell) | "
           "T2M trend C/decade (Sen; MK p) | Tmin trend C/decade | Precip trend mm/decade (MK p) | Hottest year | Coldest year | Wettest year POWER (mm) | Record Tmin |\n"
           "|" + "---|" * 13 + "\n")
    (HERE / "summary_table.md").write_text(hdr + "\n".join(rows_summary) + "\n")


if __name__ == "__main__":
    main()
