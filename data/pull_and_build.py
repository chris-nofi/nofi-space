#!/usr/bin/env python3
"""Ceres Ventures - reproducible NASA data pull + farm-index builder.

Pulls (and caches under data/raw/) REAL data for the three MVP farms defined in
/workspace/ceres-ai/app.js (DB.FARMS lat/lon), then writes clean per-farm outputs
under data/out/ that the dashboard / SI engine / CERES prompt can load.

No-login sources used here:
  * NASA POWER (daily, monthly, climatology; community=AG)  https://power.larc.nasa.gov/api/
  * MODIS MOD13Q1 v061 NDVI/EVI via ORNL DAAC MODIS Web Service  https://modis.ornl.gov/rst/api/v1/
  * SRTM 30 m (1 arc-sec) via OpenTopoData  https://api.opentopodata.org/v1/srtm30m
  * NASA CMR granule search (metadata only)  https://cmr.earthdata.nasa.gov/search/
Earthdata-Login products (SMAP, HLS, ECOSTRESS, GPM IMERG) are in earthdata_pull.py.

Run:   data/.venv/bin/python data/pull_and_build.py [--refresh]
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import datetime as dt
import json
import math
import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from scipy import stats

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
OUT = ROOT / "out"
UA = {"User-Agent": "CeresVentures-SpaceApps2026/1.0"}

# Farm points: copied verbatim from /workspace/ceres-ai/app.js DB.FARMS (lat, lon, elevation, crop).
FARMS = {
    "carumas": dict(name="Carumas highlands (Parcela Familia Quispe)", lat=-16.81, lon=-70.69, app_elev=3000,
                    crop="potato", irrigated=False, ha=None),
    "samegua": dict(name="Samegua valley, Pasto Grande irrigation", lat=-17.18, lon=-70.90, app_elev=1550,
                    crop="alfalfa", irrigated=True, ha=1.2),
    "algarrobal": dict(name="El Algarrobal, Ilo coast", lat=-17.62, lon=-71.26, app_elev=150,
                       crop="olive", irrigated=True, ha=2.0),
}

POWER_DAILY_PARAMS = ["T2M", "T2M_MAX", "T2M_MIN", "T2MDEW", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN",
                      "CLRSKY_SFC_SW_DWN", "RH2M", "WS2M", "PS", "QV2M", "EVLAND", "GWETROOT"]
POWER_START = "19810101"
BASE_Y0, BASE_Y1 = 2001, 2020          # baseline for anomalies / SPI fitting
LAPSE = 6.5 / 1000.0                   # degC per m, standard environmental lapse rate (ICAO std atm)

# ---------------------------------------------------------------- crop assumptions (FAO-56) ---
# FAO-56 = Allen, Pereira, Raes & Smith (1998), FAO Irrigation & Drainage Paper 56, Table 12.
# https://www.fao.org/4/x0490e/x0490e0b.htm
KC_MONTHLY = {
    # Olive (40-60 % canopy cover): Kc_ini 0.65, Kc_mid 0.70, Kc_end 0.70 (FAO-56 Table 12).
    # Southern-hemisphere mapping (assumption): 0.65 in cool Jun-Sep, 0.70 Oct-May.
    "olive": [0.70, 0.70, 0.70, 0.70, 0.70, 0.65, 0.65, 0.65, 0.65, 0.70, 0.70, 0.70],
    # Alfalfa hay, averaged cutting effects: Kc_mid 0.95 (FAO-56 Table 12) - year-round perennial.
    "alfalfa": [0.95] * 12,
    # Potato: Kc_ini 0.50, mid 1.15, end 0.75 (FAO-56 Table 12); stages 25/30/45/30 d (Table 11).
    # Rainfed Andean calendar (assumption): plant Nov, harvest Mar -> Nov ini, Dec dev, Jan-Feb mid, Mar end.
    "potato": [1.15, 1.15, 0.75, 0, 0, 0, 0, 0, 0, 0, 0.50, 0.83],
}
# Field application efficiencies: Brouwer et al. 1989, FAO Irrigation Water Management
# Training Manual No. 4, Table 4 (surface 60 %, sprinkler 75 %, drip 90 %).
# https://www.fao.org/4/s8684e/s8684e07.htm
EFF = {"gravity": 0.60, "sprinkler": 0.75, "drip": 0.90}



def clean(o):
    """Recursively replace NaN/inf with None so outputs are strict JSON (loadable by JS JSON.parse)."""
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if hasattr(o, "item") and not isinstance(o, (str, bytes)):
        try:
            o = o.item()
        except Exception:
            pass
    if isinstance(o, float) and (o != o or o in (float("inf"), float("-inf"))):
        return None
    return o


def get(url, params=None, tries=5, timeout=60):
    for i in range(tries):
        try:
            r = requests.get(url, params=params, headers=UA, timeout=timeout)
            if r.status_code == 200:
                return r
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(2 * (i + 1)); continue
            r.raise_for_status()
        except requests.RequestException:
            if i == tries - 1:
                raise
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"failed {url} {params}")


def cached_json(path: Path, fetch, refresh=False):
    if path.exists() and not refresh:
        return json.loads(path.read_text())
    data = fetch()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data))
    return data


# ---------------------------------------------------------------- NASA POWER --------------
POWER = "https://power.larc.nasa.gov/api/temporal"


def power_daily(fid, f, refresh):
    end = (dt.date.today() - dt.timedelta(days=1)).strftime("%Y%m%d")
    def fetch():
        p = dict(parameters=",".join(POWER_DAILY_PARAMS), community="AG", longitude=f["lon"],
                 latitude=f["lat"], start=POWER_START, end=end, format="JSON")
        return get(f"{POWER}/daily/point", p, timeout=300).json()
    return cached_json(RAW / f"power_daily_{fid}.json", fetch, refresh)


def power_monthly(fid, f, refresh):
    def fetch():
        p = dict(parameters="T2M,T2M_MAX,T2M_MIN,PRECTOTCORR", community="AG", longitude=f["lon"],
                 latitude=f["lat"], start=1981, end=dt.date.today().year - 1, format="JSON")
        return get(f"{POWER}/monthly/point", p, timeout=300).json()
    return cached_json(RAW / f"power_monthly_{fid}.json", fetch, refresh)


def power_clim(fid, f, refresh):
    def fetch():
        p = dict(parameters="T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,RH2M,WS2M,FROST_DAYS",
                 community="AG", longitude=f["lon"], latitude=f["lat"], format="JSON")
        return get(f"{POWER}/climatology/point", p, timeout=300).json()
    return cached_json(RAW / f"power_clim_{fid}.json", fetch, refresh)


def power_df(js):
    par = js["properties"]["parameter"]
    df = pd.DataFrame(par)
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    return df.replace(-999.0, np.nan)


# ---------------------------------------------------------------- MODIS (ORNL) ------------
MODIS = "https://modis.ornl.gov/rst/api/v1/MOD13Q1"
MODIS_BANDS = ["250m_16_days_NDVI", "250m_16_days_EVI", "250m_16_days_pixel_reliability"]


def modis_subset(fid, f, refresh):
    def fetch():
        dates = get(f"{MODIS}/dates", dict(latitude=f["lat"], longitude=f["lon"])).json()["dates"]
        mdates = [d["modis_date"] for d in dates if d["calendar_date"] >= "2001-01-01"]
        chunks = [mdates[i:i + 10] for i in range(0, len(mdates), 10)]
        jobs = [(b, c) for b in MODIS_BANDS for c in chunks]
        def one(job):
            b, c = job
            p = dict(latitude=f["lat"], longitude=f["lon"], band=b, startDate=c[0], endDate=c[-1],
                     kmAboveBelow=0, kmLeftRight=0)
            js = get(f"{MODIS}/subset", p).json()
            return [dict(band=b, date=s["calendar_date"], value=s["data"][0]) for s in js["subset"]]
        rows = []
        with cf.ThreadPoolExecutor(8) as ex:
            for i, r in enumerate(ex.map(one, jobs)):
                rows += r
                if i % 20 == 0:
                    print(f"  modis {fid}: {i}/{len(jobs)}", flush=True)
        return dict(source=f"{MODIS}/subset", product="MOD13Q1 v061 250 m 16-day", pixel="single 250 m pixel at farm point",
                    rows=rows)
    return cached_json(RAW / f"modis_mod13q1_{fid}.json", fetch, refresh)


def ndvi_summary(js):
    df = pd.DataFrame(js["rows"]).pivot_table(index="date", columns="band", values="value", aggfunc="first")
    df.index = pd.to_datetime(df.index)
    rel = df["250m_16_days_pixel_reliability"]
    good = rel.isin([0, 1])  # 0 = good, 1 = marginal (MOD13 user guide)
    nd = (df["250m_16_days_NDVI"] * 1e-4).where(good)
    ev = (df["250m_16_days_EVI"] * 1e-4).where(good)
    clim = nd.groupby(nd.index.month).agg(["mean", "std", "count"]).round(3)
    recent = nd[nd.index >= nd.index.max() - pd.Timedelta(days=365)]
    rec_m = recent.groupby(recent.index.month).mean().round(3)
    annual = nd.groupby(nd.index.year).agg(["mean", "max", "min"]).round(3)
    # bare months threshold 0.25 (same threshold already used in si-data.js seasons.thresholds.bare)
    bare = int((clim["mean"] < 0.25).sum())
    return dict(
        n_composites=int(len(df)), n_good=int(good.sum()), first=str(df.index.min().date()), last=str(df.index.max().date()),
        ndvi_monthly_mean=[float(clim["mean"].get(m, np.nan)) for m in range(1, 13)],
        ndvi_monthly_std=[float(clim["std"].get(m, np.nan)) for m in range(1, 13)],
        evi_monthly_mean=[round(float(ev[ev.index.month == m].mean()), 3) for m in range(1, 13)],
        ndvi_last365_monthly={int(k): float(v) for k, v in rec_m.items()},
        ndvi_annual={int(y): dict(mean=float(r["mean"]), max=float(r["max"]), min=float(r["min"])) for y, r in annual.iterrows()},
        bare_months_climatology=bare, bare_threshold=0.25,
        latest=dict(date=str(nd.dropna().index.max().date()), ndvi=round(float(nd.dropna().iloc[-1]), 3)),
    ), nd


# ---------------------------------------------------------------- SRTM (OpenTopoData) -----
def srtm(refresh):
    def fetch():
        out = {}
        for fid, f in FARMS.items():
            pts, d = [], 1 / 3600  # 1 arc-second (~30 m) grid
            for dy in (1, 0, -1):
                for dx in (-1, 0, 1):
                    pts.append((f["lat"] + dy * d, f["lon"] + dx * d))
            for dy in (3, 0, -3):  # ~90 m ring for a smoother slope
                for dx in (-3, 0, 3):
                    pts.append((f["lat"] + dy * d, f["lon"] + dx * d))
            loc = "|".join(f"{a:.6f},{b:.6f}" for a, b in pts)
            js = get("https://api.opentopodata.org/v1/srtm30m", dict(locations=loc)).json()
            out[fid] = [r["elevation"] for r in js["results"]]
            time.sleep(1.2)  # public API limit 1 req/s
        return dict(source="https://api.opentopodata.org/v1/srtm30m (NASA SRTM GL1 30 m)", grids=out)
    return cached_json(RAW / "srtm_opentopodata.json", fetch, refresh)


def slope_deg(z9, lat, step_arcsec):
    z = np.array(z9, float).reshape(3, 3)
    dy = step_arcsec / 3600 * 111_320
    dx = dy * math.cos(math.radians(lat))
    dzdx = ((z[0, 2] + 2 * z[1, 2] + z[2, 2]) - (z[0, 0] + 2 * z[1, 0] + z[2, 0])) / (8 * dx)
    dzdy = ((z[2, 0] + 2 * z[2, 1] + z[2, 2]) - (z[0, 0] + 2 * z[0, 1] + z[0, 2])) / (8 * dy)
    return round(math.degrees(math.atan(math.hypot(dzdx, dzdy))), 1)


# ---------------------------------------------------------------- CMR granule counts ------
CMR_COLLECTIONS = {
    "ECOSTRESS_L2T_LSTE_v002": ("ECO_L2T_LSTE", "002"),
    "ECOSTRESS_L3T_JET_v002": ("ECO_L3T_JET", "002"),
    "ECOSTRESS_L4T_ESI_v002": ("ECO_L4T_ESI", "002"),
    "HLS_L30_v2.0": ("HLSL30", "2.0"),
    "HLS_S30_v2.0": ("HLSS30", "2.0"),
    "SMAP_SPL3SMP_E_v006": ("SPL3SMP_E", "006"),
    "SMAP_SPL4SMGP_v008": ("SPL4SMGP", "008"),
    "GPM_3IMERGDF_v07": ("GPM_3IMERGDF", "07"),
}


def cmr_counts(refresh):
    def fetch():
        out = {}
        for fid, f in FARMS.items():
            out[fid] = {}
            for key, (sn, ver) in CMR_COLLECTIONS.items():
                p = dict(short_name=sn, version=ver, point=f"{f['lon']},{f['lat']}",
                         temporal="2019-01-01T00:00:00Z,2026-11-13T23:59:59Z", page_size=0)
                r = get("https://cmr.earthdata.nasa.gov/search/granules.json", p)
                hits = int(r.headers.get("CMR-Hits", -1))
                low = None
                if key.startswith(("HLS", "ECOSTRESS_L2T")):
                    p2 = dict(p, cloud_cover="0,20")
                    low = int(get("https://cmr.earthdata.nasa.gov/search/granules.json", p2).headers.get("CMR-Hits", -1))
                out[fid][key] = dict(granules_2019_2026=hits, cloud_cover_le20=low)
        return dict(source="https://cmr.earthdata.nasa.gov/search/granules.json (point + temporal 2019-01-01..2026-11-13)",
                    queried=dt.datetime.now(dt.timezone.utc).isoformat(), counts=out)
    return cached_json(RAW / "cmr_granule_counts.json", fetch, refresh)


def imerg_probe():
    url = "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGDF.07/contents.html"
    try:
        r = requests.get(url, headers=UA, timeout=60, allow_redirects=False)
        return dict(url=url, status=r.status_code, location=r.headers.get("Location", "")[:120])
    except requests.RequestException as e:
        return dict(url=url, error=str(e))


# ---------------------------------------------------------------- FAO-56 ET0 --------------
def et0_pm(df, lat, elev_for_ra):
    """FAO-56 Penman-Monteith daily ET0 (mm/day), eqs. 6-8, 11-13, 21, 37-39; G=0."""
    tmax, tmin = df["TMAX"], df["TMIN"]
    tmean = (tmax + tmin) / 2
    P = df["PS"]  # kPa, POWER surface pressure
    gamma = 0.000665 * P
    es_f = lambda t: 0.6108 * np.exp(17.27 * t / (t + 237.3))
    es = (es_f(tmax) + es_f(tmin)) / 2
    ea = es_f(df["TDEW"])
    delta = 4098 * es_f(tmean) / (tmean + 237.3) ** 2
    J = df.index.day_of_year.values
    phi = math.radians(lat)
    dr = 1 + 0.033 * np.cos(2 * np.pi * J / 365)
    dec = 0.409 * np.sin(2 * np.pi * J / 365 - 1.39)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(dec), -1, 1))
    Ra = 24 * 60 / np.pi * 0.0820 * dr * (ws * np.sin(phi) * np.sin(dec) + np.cos(phi) * np.cos(dec) * np.sin(ws))
    Rs = df["RS"]
    Rso = (0.75 + 2e-5 * elev_for_ra) * Ra
    Rns = 0.77 * Rs
    ratio = np.clip(Rs / Rso, 0.3, 1.0)
    Rnl = 4.903e-9 * (((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2) * (0.34 - 0.14 * np.sqrt(ea.clip(lower=0))) * (1.35 * ratio - 0.35)
    Rn = Rns - Rnl
    u2 = df["U2"]
    et0 = (0.408 * delta * Rn + gamma * 900 / (tmean + 273) * u2 * (es - ea)) / (delta + gamma * (1 + 0.34 * u2))
    hg = 0.0023 * (tmean + 17.8) * np.sqrt((tmax - tmin).clip(lower=0)) * 0.408 * Ra  # Hargreaves (FAO-56 eq. 52)
    return et0.clip(lower=0), pd.Series(hg, index=df.index)


# ---------------------------------------------------------------- SPI ---------------------
def spi(monthly_p: pd.Series, scale: int):
    roll = monthly_p.rolling(scale).sum()
    out = pd.Series(np.nan, index=roll.index)
    flags = {}
    for m in range(1, 13):
        s = roll[roll.index.month == m].dropna()
        base = s[(s.index.year >= BASE_Y0) & (s.index.year <= BASE_Y1)]
        q = (base <= 0.1).mean()
        pos = base[base > 0.1]
        if len(pos) < 10 or base.mean() < 5:   # too dry to fit a gamma (WMO-1090 caveat for arid climates)
            flags[m] = "not computed: <10 non-zero baseline values or mean < 5 mm"
            continue
        a, loc, b = stats.gamma.fit(pos, floc=0)
        cdf = q + (1 - q) * stats.gamma.cdf(s.clip(lower=0), a, loc=0, scale=b)
        cdf = np.clip(cdf, 0.0013, 0.9987)
        out.loc[s.index] = stats.norm.ppf(cdf)
    return out.round(2), flags


# ---------------------------------------------------------------- build -------------------
def build_farm(fid, f, refresh, elev_srtm, slope30, slope90):
    pdj = power_daily(fid, f, refresh)
    cell_elev = pdj["geometry"]["coordinates"][2]
    d = power_df(pdj).dropna(subset=["T2M_MAX", "T2M_MIN", "ALLSKY_SFC_SW_DWN"])
    # QC (same rule as historical/build_historical.py): drop POWER precip days > 50 mm whose CHIRPS v3 month
    # total is < 25 % of that day (spurious spike 2022-09-12/13 at all three points).
    qc_flagged = []
    chp = RAW / "chirps_v3_monthly_points.csv"
    if chp.exists():
        ch = pd.read_csv(chp).set_index("month")[fid]
        for day, v in d.PRECTOTCORR[d.PRECTOTCORR > 50].items():
            cm = ch.get(f"{day.year}-{day.month:02d}", np.nan)
            if not np.isnan(cm) and cm < 0.25 * v:
                qc_flagged.append(dict(date=str(day.date()), power_mm=float(v), chirps_month_mm=float(cm)))
                d.loc[day, "PRECTOTCORR"] = np.nan
    shift = (cell_elev - elev_srtm) * LAPSE  # +ve -> site warmer than cell
    out_daily = pd.DataFrame(index=d.index)
    variants = {}
    for tag, sh in (("power_raw", 0.0), ("site_lapse", shift)):
        x = pd.DataFrame(dict(TMAX=d.T2M_MAX + sh, TMIN=d.T2M_MIN + sh, TDEW=d.T2MDEW + sh, RS=d.ALLSKY_SFC_SW_DWN,
                              U2=d.WS2M, PS=d.PS if tag == "power_raw" else 101.3 * ((293 - 0.0065 * elev_srtm) / 293) ** 5.26),
                         index=d.index)
        et0, hg = et0_pm(x, f["lat"], cell_elev if tag == "power_raw" else elev_srtm)
        variants[tag] = dict(et0=et0, hg=hg, tmax=x.TMAX, tmin=x.TMIN)
        out_daily[f"ET0_PM_{tag}"] = et0.round(2)
        out_daily[f"ET0_HG_{tag}"] = hg.round(2)
        out_daily[f"TMAX_{tag}"] = x.TMAX.round(2)
        out_daily[f"TMIN_{tag}"] = x.TMIN.round(2)
    out_daily["PRECTOTCORR"] = d.PRECTOTCORR
    for c in ["T2M", "RH2M", "WS2M", "ALLSKY_SFC_SW_DWN", "T2MDEW", "GWETROOT"]:
        out_daily[c] = d[c]
    OUT.mkdir(parents=True, exist_ok=True)
    out_daily.to_csv(OUT / f"{fid}_daily.csv", index_label="date")

    full = out_daily[(out_daily.index.year >= 2001) & (out_daily.index.year <= 2025)]
    mon = full.resample("MS").agg({**{c: "mean" for c in full.columns if c != "PRECTOTCORR" and not c.startswith("ET0")},
                                   "PRECTOTCORR": "sum", **{c: "sum" for c in full.columns if c.startswith("ET0")}})
    clim = mon.groupby(mon.index.month).mean()
    days = np.array([31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])

    def per_year(series_bool):
        return round(float(series_bool.groupby(series_bool.index.year).sum().mean()), 1)

    t = {}
    for tag, v in variants.items():
        tmn, tmx = v["tmin"][full.index], v["tmax"][full.index]
        tavg = (tmn + tmx) / 2
        t[tag] = dict(
            frost_days_tmin_lt0=per_year(tmn < 0), frost_days_tmin_lt_minus2=per_year(tmn < -2),
            heat_days_tmax_gt30=per_year(tmx > 30), heat_days_tmax_gt35=per_year(tmx > 35),
            gdd_base5_per_year=round(float((tavg - 5).clip(lower=0).groupby(tavg.index.year).sum().mean())),
            gdd_base10_per_year=round(float((tavg - 10).clip(lower=0).groupby(tavg.index.year).sum().mean())),
            gdd_base10_monthly=[round(float((tavg - 10).clip(lower=0)[tavg.index.month == m].sum() / 25)) for m in range(1, 13)],
            frost_days_monthly_lt0=[round(float((tmn < 0)[tmn.index.month == m].sum() / 25), 1) for m in range(1, 13)],
            tmin_abs_min=round(float(tmn.min()), 1), tmax_abs_max=round(float(tmx.max()), 1),
            et0_pm_mm_yr=round(float(clim[f"ET0_PM_{tag}"].sum())),
            et0_hargreaves_mm_yr=round(float(clim[f"ET0_HG_{tag}"].sum())),
            et0_pm_monthly_mm=[round(float(v_), 1) for v_ in clim[f"ET0_PM_{tag}"]],
            et0_pm_monthly_mm_day=[round(float(v_ / dd), 2) for v_, dd in zip(clim[f"ET0_PM_{tag}"], days)],
        )

    # Anomalies: last 12 complete months vs 2001-2020 calendar-month means.
    allmon = out_daily.resample("MS").agg({"T2M": "mean", "PRECTOTCORR": "sum", "ET0_PM_power_raw": "sum",
                                          "TMAX_power_raw": "mean", "TMIN_power_raw": "mean"})
    cnt = out_daily["T2M"].resample("MS").count()
    allmon = allmon[cnt >= 28]
    basem = allmon[(allmon.index.year >= BASE_Y0) & (allmon.index.year <= BASE_Y1)].groupby(lambda i: i.month).mean()
    last12 = allmon.iloc[-12:]
    anom = []
    for i, r in last12.iterrows():
        b = basem.loc[i.month]
        anom.append(dict(month=i.strftime("%Y-%m"), t2m=round(r.T2M, 2), t2m_anom=round(r.T2M - b.T2M, 2),
                         precip_mm=round(r.PRECTOTCORR, 1), precip_base_mm=round(b.PRECTOTCORR, 1),
                         et0_mm=round(r.ET0_PM_power_raw, 1), et0_anom_mm=round(r.ET0_PM_power_raw - b.ET0_PM_power_raw, 1)))
    yr = allmon.groupby(allmon.index.year).agg({"T2M": "mean", "PRECTOTCORR": "sum", "ET0_PM_power_raw": "sum"})
    yr = yr[allmon.groupby(allmon.index.year).size() == 12]

    sp3, f3 = spi(allmon["PRECTOTCORR"], 3)
    sp6, f6 = spi(allmon["PRECTOTCORR"], 6)
    spi_df = pd.DataFrame(dict(precip_mm=allmon.PRECTOTCORR.round(1), spi3=sp3, spi6=sp6))
    spi_df.index = spi_df.index.strftime("%Y-%m")
    spi_df.to_csv(OUT / f"{fid}_spi.csv", index_label="month")

    # POWER monthly 1981-> "then vs now"
    pm = power_df_monthly(power_monthly(fid, f, refresh))
    then = pm[(pm.index.year >= 1981) & (pm.index.year <= 1990)]
    now = pm[(pm.index.year >= 2016) & (pm.index.year <= 2025)]
    then_now = dict(t2m_1981_1990=round(float(then.T2M.mean()), 2), t2m_2016_2025=round(float(now.T2M.mean()), 2),
                    tmin_1981_1990=round(float(then.T2M_MIN.mean()), 2), tmin_2016_2025=round(float(now.T2M_MIN.mean()), 2),
                    precip_mm_yr_1981_1990=round(float(then.PRECTOTCORR.groupby(then.index.year).sum().mean()), 1),
                    precip_mm_yr_2016_2025=round(float(now.PRECTOTCORR.groupby(now.index.year).sum().mean()), 1))

    clim_js = power_clim(fid, f, refresh)

    # Crop water requirement (net & gross) with FAO-56 Kc and CROPWAT/FAO-AGLW effective rain.
    kc = np.array(KC_MONTHLY[f["crop"]])
    et0m = np.array(t["power_raw"]["et0_pm_monthly_mm"])
    pm_ = np.array([float(x) for x in clim["PRECTOTCORR"]])
    pe = np.where(pm_ > 75, 0.8 * pm_ - 25, np.maximum(0.6 * pm_ - 10, 0))  # FAO/AGLW dependable rain (CROPWAT)
    etc = et0m * kc
    irr_net = np.maximum(etc - pe, 0) * (kc > 0)
    cwr = dict(crop=f["crop"], kc_monthly=kc.tolist(), etc_mm_monthly=etc.round(1).tolist(), etc_mm_yr=round(float(etc.sum()), 1),
               eff_rain_mm_monthly=pe.round(1).tolist(), net_irrigation_mm_yr=round(float(irr_net.sum()), 1),
               net_irrigation_m3_ha_yr=round(float(irr_net.sum()) * 10),
               gross_m3_ha_yr={k: round(float(irr_net.sum()) * 10 / e) for k, e in EFF.items()})
    if not f["irrigated"]:
        cwr["note"] = "Rainfed: net 'irrigation' = seasonal crop water deficit (ETc - effective rain) during the potato season."

    return dict(
        farm_id=fid, name=f["name"], lat=f["lat"], lon=f["lon"], coords_source="/workspace/ceres-ai/app.js DB.FARMS",
        elevation=dict(app_js_m=f["app_elev"], srtm30m_m=elev_srtm, power_grid_cell_m=round(cell_elev, 1),
                       lapse_shift_degC=round(shift, 2), slope_deg_30m=slope30, slope_deg_90m=slope90),
        power=dict(source="NASA POWER Daily API v2 community=AG https://power.larc.nasa.gov/api/temporal/daily/point",
                   period=f"{out_daily.index.min().date()}..{out_daily.index.max().date()}", grid="0.5 x 0.625 deg (MERRA-2/GEOS-IT)",
                   climatology_2001_2025=dict(
                       t2m_monthly=[round(float(v), 2) for v in clim.T2M],
                       tmax_monthly=[round(float(v), 2) for v in clim.TMAX_power_raw],
                       tmin_monthly=[round(float(v), 2) for v in clim.TMIN_power_raw],
                       precip_mm_monthly=[round(float(v), 1) for v in clim.PRECTOTCORR],
                       precip_mm_yr=round(float(clim.PRECTOTCORR.sum()), 1),
                       rs_mj_m2_day_monthly=[round(float(v), 2) for v in clim.ALLSKY_SFC_SW_DWN],
                       rh2m_monthly=[round(float(v), 1) for v in clim.RH2M],
                       ws2m_monthly=[round(float(v), 2) for v in clim.WS2M]),
                   power_climatology_endpoint=dict(
                       source="https://power.larc.nasa.gov/api/temporal/climatology/point",
                       header=clim_js.get("header", {}).get("range") or clim_js.get("header", {}).get("start"),
                       ann={k: v.get("ANN") for k, v in clim_js["properties"]["parameter"].items()}),
                   annual_series={int(y): dict(t2m=round(r.T2M, 2), precip_mm=round(r.PRECTOTCORR, 1), et0_mm=round(r.ET0_PM_power_raw))
                                  for y, r in yr.iterrows()},
                   then_vs_now_power_monthly=then_now),
        indices=dict(power_raw=t["power_raw"], site_lapse_adjusted=t["site_lapse"],
                     last12_months_anomaly_vs_2001_2020=anom,
                     spi=dict(latest=spi_df.dropna(how="all", subset=["spi3", "spi6"]).tail(6).reset_index().to_dict("records"),
                              flags_spi3=f3, flags_spi6=f6, method="gamma fit on 2001-2020 per calendar month, zero-inflated (McKee 1993; WMO-1090)")),
        crop_water=cwr,
        qc=dict(power_precip_days_removed=qc_flagged),
    )


def power_df_monthly(js):
    rows = []
    for p, vals in js["properties"]["parameter"].items():
        for k, v in vals.items():
            if k[-2:] == "13":
                continue
            rows.append((p, pd.Timestamp(int(k[:4]), int(k[4:]), 1), v))
    df = pd.DataFrame(rows, columns=["p", "d", "v"]).pivot(index="d", columns="p", values="v").replace(-999.0, np.nan)
    if "PRECTOTCORR" in df:  # POWER monthly endpoint reports precipitation in mm/day -> convert to mm/month
        df["PRECTOTCORR"] = df["PRECTOTCORR"] * df.index.days_in_month
    return df


def algarrobal_strategies(farm):
    """Recompute the 4 El Algarrobal strategies from real POWER ET0 x FAO-56 Kc (assumptions labeled)."""
    cw = farm["crop_water"]
    net = np.array(cw["etc_mm_monthly"]) - np.array(cw["eff_rain_mm_monthly"])
    net = np.maximum(net, 0)
    et0m = np.array(farm["indices"]["power_raw"]["et0_pm_monthly_mm"])
    winter = np.array([0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0], float)  # May-Sep cover season (assumption)
    KC_COVER = 0.80  # seasonal-average Kc for a legume cover (assumption; FAO-56 Table 12 legumes Kc_mid 1.05-1.15, ini 0.4-0.5)
    RDI = 0.75       # regulated deficit irrigation supplies 75 % of olive ETc (assumption; FAO I&D Paper 66 olive chapter / Fereres & Soriano 2007 report 25-75 %)
    def m3(mm_monthly, eff):
        return mm_monthly * 10 / eff
    cur = m3(net, EFF["gravity"])
    defi = m3(net * RDI, EFF["gravity"])
    cover = cur + m3(et0m * KC_COVER * 0.5 * winter, EFF["gravity"])          # cover on 50 % of ground, flood-irrigated
    drip = m3(net, EFF["drip"]) + m3(et0m * KC_COVER * 0.3 * winter, EFF["sprinkler"])  # 30 % strips, micro-sprinkler
    drip_only = m3(net, EFF["drip"])
    res = {}
    for k, v in dict(current=cur, deficit=defi, cover=cover, drip=drip, drip_no_cover=drip_only).items():
        res[k] = dict(m3_ha_yr=round(float(v.sum()), -1), monthly=[round(float(x), 1) for x in v],
                      pct_vs_current=round(float((v.sum() / cur.sum() - 1) * 100), 1))
    res["assumptions"] = dict(kc_olive=KC_MONTHLY["olive"], kc_cover=KC_COVER, cover_fraction_cover=0.5, cover_fraction_strips=0.3,
                              cover_months="May-Sep", rdi_fraction=RDI, efficiencies=EFF,
                              et0="FAO-56 PM from NASA POWER daily 2001-2025 at POWER grid cell (power_raw)")
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="ignore cache and re-download")
    a = ap.parse_args()
    RAW.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
    el = srtm(a.refresh)["grids"]
    cmr = cmr_counts(a.refresh)
    summary = dict(generated=dt.datetime.now().isoformat(timespec="seconds"), farms={}, cmr=cmr, imerg_no_login_probe=imerg_probe())
    for fid, f in FARMS.items():
        z = el[fid]
        farm = build_farm(fid, f, a.refresh, z[4], slope_deg(z[:9], f["lat"], 1), slope_deg(z[9:], f["lat"], 3))
        mj = modis_subset(fid, f, a.refresh)
        nsum, nd = ndvi_summary(mj)
        nsum["source"] = "MOD13Q1 v061 via ORNL DAAC MODIS Web Service https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset (single 250 m pixel; QA pixel_reliability 0-1)"
        farm["ndvi"] = nsum
        nd.dropna().round(4).to_csv(OUT / f"{fid}_ndvi_mod13q1.csv", header=["ndvi"], index_label="date")
        if fid == "algarrobal":
            farm["strategies_recomputed"] = algarrobal_strategies(farm)
        farm["cmr_granules"] = cmr["counts"][fid]
        (OUT / f"{fid}.json").write_text(json.dumps(clean(farm), indent=1, default=float, allow_nan=False))
        summary["farms"][fid] = farm
        print(f"[ok] {fid}: POWER {farm['power']['period']}, ET0 {farm['indices']['power_raw']['et0_pm_mm_yr']} mm/yr, "
              f"P {farm['power']['climatology_2001_2025']['precip_mm_yr']} mm/yr, NDVI n={nsum['n_good']}")
    (OUT / "all_farms.json").write_text(json.dumps(clean(summary), indent=1, default=float, allow_nan=False))
    # browser bundle is written by bundle_site_data.py (data/out/ceres-nasa-data.js)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
