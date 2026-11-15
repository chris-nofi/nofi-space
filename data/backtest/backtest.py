#!/usr/bin/env python3
"""CERES 1981-2025 historical backtest (MODEL-BASED HINDCAST, not observed yields).

Base series: NASA POWER daily ONLY (1981-01-01 ->), same QC and same altitude/lapse handling as the pipeline.
Validation overlays (never used as base): ERA5 / ERA5-Land (Open-Meteo), GPM IMERG Final monthly v07,
SMAP L3 9 km (Carumas), CHIRPS v3 (non-NASA).
  data/.venv/bin/python data/backtest/backtest.py
Outputs: data/out/backtest_1981_2025.json, data/backtest/backtest_seasons.csv
"""
from __future__ import annotations
import datetime as dt, json, math, sys
from pathlib import Path
import numpy as np, pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pull_and_build import et0_pm, FARMS, EFF, KC_MONTHLY, clean  # noqa: E402

RAW, OUT, HIST = ROOT / "raw", ROOT / "out", ROOT / "historical"
Y0, Y1 = 1981, 2025
BASE0, BASE1 = 1991, 2020          # WMO normal used for medians / supply index
RNG = np.random.default_rng(20261114)

# ----------------------------------------------------------------------------------- crop library
# Kc: FAO-56 Table 12 (Allen et al. 1998). Zr (lower bound of range) and p: FAO-56 Table 22.
# Frost Tc: FAO Frost Protection Vol.1 (Snyder & de Melo-Abreu 2005) Table 4.5 "critical damage temperatures for
#   grain, forage and silage crops" (after Ventskevich 1958), FLOWERING column range [warm end, cold end] and
#   GERMINATION column; Table 4.4 for olive (highest freezing temperature of fresh fruit, a guide value).
# Monthly calendars are ASSUMPTIONS (same Andean/valley calendars Kepler used for the engine; not INIA-confirmed).
def kc_profile(ini, mid, end, n):
    dev = round((ini + mid) / 2, 2)
    return {3: [ini, mid, end], 4: [ini, dev, mid, end], 5: [ini, dev, mid, mid, end],
            6: [ini, dev, mid, mid, round((mid + end) / 2, 2), end]}[n]

CROPS = {
 # id: name, start month, n months, Kc(ini,mid,end), Zr m, p, Tc_germ, Tc_flower(warm,cold), sources/flags
 "potato":   dict(en="potato", es="papa", m0=11, n=5, kc=KC_MONTHLY["potato"], zr=0.4, p=0.35, tg=-2, tf=(-1, -2),
                  src="Kc FAO-56 T12 (pipeline calendar Nov-Mar); Zr/p FAO-56 T22; Tc FAO 2005 T4.5 'Potato'"),
 "faba":     dict(en="faba bean", es="haba", m0=12, n=5, kc=(0.50, 1.15, 0.30), zr=0.5, p=0.45, tg=-5, tf=(-2, -3),
                  src="Kc FAO-56 T12 'faba bean dry'; Zr/p T22; Tc T4.5 'Beans' (mapping to Vicia faba is an assumption)"),
 "oatvetch": dict(en="oat-vetch", es="avena-vicia", m0=1, n=5, kc=(0.35, 1.15, 0.30), zr=1.0, p=0.55, tg=-8, tf=(-1, -2),
                  src="Kc ASSUMPTION mean of FAO-56 barley/bean; Zr/p small grains T22; Tc T4.5 'Oats' (more sensitive than 'Spring vetch')"),
 "tarwi":    dict(en="tarwi (Andean lupin)", es="tarwi", m0=11, n=6, kc=(0.40, 1.15, 0.35), zr=0.6, p=0.45, tg=-6, tf=(-3, -4),
                  src="Kc/Zr/p ASSUMPTION = FAO-56 'bean dry' (no tarwi entry); Tc T4.5 'Lupin'"),
 "barley":   dict(en="barley", es="cebada", m0=1, n=4, kc=(0.30, 1.15, 0.25), zr=1.0, p=0.55, tg=-7, tf=(-1, -2),
                  src="Kc FAO-56 T12 'barley'; Zr/p T22; Tc T4.5 'Barley'"),
 "alfalfa":  dict(en="alfalfa", es="alfalfa", m0=1, n=12, kc=KC_MONTHLY["alfalfa"], zr=1.0, p=0.55, tg=None, tf=(-2, -4),
                  src="Kc FAO-56 T12 averaged cutting 0.95 (pipeline); Zr/p T22; frost Tc ASSUMPTION (not in T4.5)", tf_assumed=True),
 "maize":    dict(en="forage maize", es="maíz chala", m0=10, n=4, kc=(0.30, 1.15, 0.50), zr=1.0, p=0.55, tg=-2, tf=(-1, -2),
                  src="Kc FAO-56 T12 'maize silage'; Zr/p T22; Tc T4.5 'Corn [maize]'"),
 "pea":      dict(en="pea", es="arveja", m0=4, n=4, kc=(0.50, 1.15, 1.10), zr=0.6, p=0.35, tg=-7, tf=(-2, -3),
                  src="Kc FAO-56 T12 'peas fresh'; Zr/p T22; Tc T4.5 'Peas'"),
 "fbarley":  dict(en="forage barley", es="cebada forrajera", m0=6, n=4, kc=(0.30, 1.15, 0.25), zr=1.0, p=0.55, tg=-7, tf=(-1, -2),
                  src="Kc FAO-56 T12 'barley'; Zr/p T22; Tc T4.5 'Barley'"),
 "bean":     dict(en="common bean", es="frijol", m0=11, n=4, kc=(0.40, 1.15, 0.35), zr=0.6, p=0.45, tg=-5, tf=(-2, -3),
                  src="Kc FAO-56 T12 'bean dry'; Zr/p T22; Tc T4.5 'Beans'"),
 "quinoa":   dict(en="quinoa", es="quinua", m0=5, n=5, kc=(0.30, 1.10, 0.40), zr=1.0, p=0.55, tg=None, tf=(-2, -4),
                  src="Kc/Zr/p ASSUMPTION (no FAO-56 entry; small-grain-like, as in kepler-answers Q3); frost Tc ASSUMPTION", tf_assumed=True),
 "olive":    dict(en="olive", es="olivo", m0=1, n=12, kc=KC_MONTHLY["olive"], zr=1.2, p=0.65, tg=None, tf=(-1.4, -1.4),
                  src="Kc FAO-56 T12 40-60% cover (pipeline); Zr/p T22; Tc FAO 2005 T4.4 'Olives, fresh' -1.4 C (fruit guide value)"),
}
for c in CROPS.values():
    if isinstance(c["kc"], tuple):
        c["kc"] = kc_profile(*c["kc"], c["n"])
    elif len(c["kc"]) == 12 and c["n"] == 5:          # potato pipeline array (Jan..Dec) -> Nov..Mar order
        c["kc"] = [c["kc"][m - 1] for m in (11, 12, 1, 2, 3)]
    c["months"] = [((c["m0"] - 1 + i) % 12) + 1 for i in range(c["n"])]
    mx = max(c["kc"]); c["flower_months"] = [m for m, k in zip(c["months"], c["kc"]) if k >= mx - 1e-9]

# Strategies: ids/names from the CERES app (data/patched/ceres-ai/app.js DB.FARMS[*].strategies). Rotations are
# evaluated "every phase every year" (each crop of the rotation is hindcast in every season), the standard design
# of rotation field trials, so the result does not depend on which phase a given year happened to fall in.
STRATS = {
 "carumas": [
  dict(id="current", en="Potato → potato", es="Papa → papa", current=True, phases=["potato"]),
  dict(id="haba-avena", en="Potato → faba bean → oat-vetch", es="Papa → haba → avena-vicia", recommended=True, phases=["potato", "faba", "oatvetch"]),
  dict(id="tarwi", en="Potato → tarwi → barley", es="Papa → tarwi → cebada", phases=["potato", "tarwi", "barley"]),
  dict(id="descanso", en="Potato → faba → fallow with trenches", es="Papa → haba → descanso con zanjas", phases=["potato", "faba", None]),
 ],
 "samegua": [
  dict(id="current", en="Continuous alfalfa", es="Alfalfa continua", current=True, phases=["alfalfa"], eff="gravity"),
  dict(id="maiz-arveja", en="Alfalfa → forage maize → pea", es="Alfalfa → maíz chala → arveja", recommended=True, phases=["alfalfa", "maize", "pea"], eff="gravity"),
  dict(id="cebada-frijol", en="Alfalfa → forage barley → bean", es="Alfalfa → cebada forrajera → frijol", phases=["alfalfa", "fbarley", "bean"], eff="gravity"),
  dict(id="quinua", en="Alfalfa 3 yrs → quinoa → alfalfa", es="Alfalfa 3 años → quinua → alfalfa", phases=["alfalfa", "alfalfa", "alfalfa", "quinoa"], eff="gravity"),
 ],
 "algarrobal": [
  dict(id="current", en="Gravity irrigation, bare soil", es="Riego por gravedad, suelo desnudo", current=True, phases=["olive"], mode="gravity"),
  dict(id="deficit", en="Deficit irrigation guided by ECOSTRESS", es="Riego deficitario guiado por ECOSTRESS", phases=["olive"], mode="rdi"),
  dict(id="cover", en="Olive + winter legume cover", es="Olivo + cobertura invernal de leguminosa", phases=["olive"], mode="cover"),
  dict(id="drip", en="Drip + strip cover", es="Goteo + cobertura en franjas", recommended=True, phases=["olive"], mode="drip"),
 ],
}
# Pipeline El Algarrobal management assumptions (pull_and_build.algarrobal_strategies)
KC_COVER, RDI, WINTER = 0.80, 0.75, {5, 6, 7, 8, 9}
TAW_PER_M = 120.0   # mm/m: FAO-56 Table 19 sandy loam, midpoints thetaFC 0.23 - thetaWP 0.11 (SoilGrids texture = sandy loam at all 3 farms)
WRSI_FAIL, WRSI_STRESS = 50.0, 80.0   # Frere & Popov 1979 (FAO PPP 17) WRSI; categories Smith 1992 / FEWS NET: <50 failure, 60-80 mediocre

# ----------------------------------------------------------------------------------- data
def shift(fid):
    return json.loads((OUT / f"{fid}.json").read_text())["elevation"]["lapse_shift_degC"]

def chirps_qc(fid, p):
    """Pipeline QC: drop POWER precip days > 50 mm whose CHIRPS v3 month total is < 25 % of that day."""
    ch = pd.read_csv(RAW / "chirps_v3_monthly_points.csv").set_index("month")[fid]
    flagged = []
    for day, v in p[p > 50].items():
        cm = ch.get(f"{day.year}-{day.month:02d}", np.nan)
        if not np.isnan(cm) and cm < 0.25 * v:
            flagged.append(str(day.date())); p.loc[day] = 0.0
    return p, flagged

def load_power(fid):
    f = FARMS[fid]
    d = pd.read_csv(HIST / f"{fid}_power_daily_1981_present.csv", parse_dates=["date"]).set_index("date")
    d = d[(d.index.year >= Y0) & (d.index.year <= Y1)]
    p, flagged = chirps_qc(fid, d.PRECTOTCORR.fillna(0.0).copy())
    meta = json.loads((OUT / f"{fid}.json").read_text())["elevation"]
    sh = meta["lapse_shift_degC"]
    # temperature handling = pipeline/risk_build: Carumas lapse-adjusted, Samegua lapse-adjusted POWER (risk_build
    # prefers ERA5-Land there; POWER-only base here, ERA5-Land reported as validation), El Algarrobal raw POWER.
    tsh = {"carumas": sh, "samegua": sh, "algarrobal": 0.0}[fid]
    x = pd.DataFrame(dict(TMAX=d.T2M_MAX, TMIN=d.T2M_MIN, TDEW=d.T2MDEW, RS=d.ALLSKY_SFC_SW_DWN, U2=d.WS2M, PS=d.PS), index=d.index)
    et0, hg = et0_pm(x, f["lat"], meta["power_grid_cell_m"])     # = pipeline ET0_PM_power_raw (crop water uses raw ET0)
    # POWER radiation starts 1984: for 1981-1983 use POWER Hargreaves (FAO-56 eq. 52) calibrated to POWER PM by
    # calendar-month ratio PM/HG over 1984-2010 (FAO-56 recommends local calibration of Hargreaves). POWER-only.
    ok = et0.notna() & (et0.index.year <= 2010)
    ratio = (et0[ok].groupby(et0[ok].index.month).sum() / hg[ok].groupby(hg[ok].index.month).sum())
    et0_fill = hg * hg.index.month.map(ratio).values
    et0_src = np.where(et0.notna(), "pm", "hg_cal")
    et0 = et0.fillna(et0_fill)
    df = pd.DataFrame(dict(P=p, ET0=et0, TMIN=d.T2M_MIN + tsh, TMAX=d.T2M_MAX + tsh, TMIN_RAW=d.T2M_MIN, GW=d.GWETROOT, ET0SRC=et0_src))
    return df, dict(qc_days_removed=flagged, temp_shift_degC=tsh, hargreaves_cal_ratio_by_month=[round(float(ratio[m]), 3) for m in range(1, 13)],
                    et0_hg_calibrated_days=int((et0_src == "hg_cal").sum()))

def load_era5(fid):
    l = pd.DataFrame(json.loads((RAW / f"openmeteo_era5_land_{fid}.json").read_text())["daily"]).assign(time=lambda x: pd.to_datetime(x.time)).set_index("time")
    e = pd.DataFrame(json.loads((RAW / f"openmeteo_era5_{fid}.json").read_text())["daily"]).assign(time=lambda x: pd.to_datetime(x.time)).set_index("time")
    df = pd.DataFrame(dict(P=e.precipitation_sum, ET0=e.et0_fao_evapotranspiration, TMIN=l.temperature_2m_min, TMAX=l.temperature_2m_max,
                           TMIN_RAW=l.temperature_2m_min, GW=np.nan))
    return df[(df.index.year >= Y0) & (df.index.year <= Y1)]

def oni_djf():
    o = pd.read_csv(RAW / "oni.ascii.txt", sep=r"\s+")
    o = o[o.SEAS == "DJF"].set_index("YR").ANOM
    return o

# ----------------------------------------------------------------------------------- models
def season_index(c, end_year):
    """Daily index of a crop season that ENDS in end_year (season label = harvest year)."""
    m0, n = c["m0"], c["n"]
    last_m = c["months"][-1]
    start_year = end_year if m0 <= last_m and n < 12 or n == 12 else end_year - 1
    if n == 12:
        start_year = end_year
    s = pd.Timestamp(start_year, m0, 1)
    e = (pd.Timestamp(end_year, last_m, 1) + pd.offsets.MonthEnd(0))
    return s, e

def kc_daily(c, idx):
    lut = dict(zip(c["months"], c["kc"]))
    return np.array([lut[m] for m in idx.month])

def bucket(P, ETc, irr, zr, p):
    """FAO-56 ch.8 single-layer root-zone water balance (daily). Starts at field capacity (WRSI convention:
    sowing with ample soil water, Frere & Popov 1979). Returns ETa array."""
    taw = TAW_PER_M * zr; raw = p * taw; dr = 0.0; eta = np.zeros_like(ETc)
    for i in range(len(ETc)):
        dr = max(dr - P[i] - irr[i], 0.0)
        ks = 1.0 if dr <= raw else max((taw - dr) / (taw - raw), 0.0)
        eta[i] = ks * ETc[i]
        dr = min(dr + eta[i], taw)
    return eta

def eff_rain(pm):
    return np.where(pm > 75, 0.8 * pm - 25, np.maximum(0.6 * pm - 10, 0))   # FAO/AGLW (CROPWAT), as pipeline

def supply_index(highland, years, memory):
    """Irrigation supply proxy (ASSUMPTION): Jan-Mar POWER rain in the upper-basin POWER cell (3,851 m, the
    Carumas/Pasto Grande cell) relative to its 1991-2020 median. memory=2 averages with the previous year
    (reservoir-regulated Pasto Grande system); memory=1 for the run-of-river Osmore at El Algarrobal."""
    jfm = highland.P[highland.index.month <= 3].groupby(highland.index.year[highland.index.month <= 3]).sum()
    med = jfm.loc[BASE0:BASE1].median()
    r = (jfm / med)
    out = {}
    for y in years:
        vals = [r.get(y)] + ([r.get(y - 1)] if memory == 2 and (y - 1) in r.index else [])
        out[y] = float(np.mean([v for v in vals if v is not None]))
    return out, jfm, med

def monthly_need_clim(df, crop, eff, extra=None):
    """Climatological (1991-2020) monthly gross irrigation need (mm) of the CURRENT practice = normal-year allotment."""
    b = df.loc[str(BASE0):str(BASE1)]
    et0m = b.ET0.resample("MS").sum(); pm = b.P.resample("MS").sum()
    et0c = et0m.groupby(et0m.index.month).mean().values; pc = pm.groupby(pm.index.month).mean().values
    kc = np.array(KC_MONTHLY[crop]) if crop in KC_MONTHLY else None
    net = np.maximum(et0c * kc - eff_rain(pc), 0)
    return net / eff

def run_crop(df, fid, cid, end_year, mode=None, allot=None, S=None, alpha=1.0):
    c = CROPS[cid]
    s, e = season_index(c, end_year)
    if s < df.index[0] or e > df.index[-1]:
        return None
    w = df.loc[s:e]
    kc = kc_daily(c, w.index); etc = w.ET0.values * kc
    P = w.P.values; irr = np.zeros(len(w))
    extra_cover = np.zeros(len(w))
    if allot is not None:
        # allotment (mm gross per month) * supply factor of that calendar year, spread evenly over the month
        S_eff = np.array([min(1.0, S[y] ** alpha) if S.get(y) is not None else np.nan for y in w.index.year])
        gross_day = np.array([allot[m - 1] / pd.Period(f"{y}-{m:02d}").days_in_month for y, m in zip(w.index.year, w.index.month)]) * S_eff
        if fid == "algarrobal":
            winter = np.isin(w.index.month, list(WINTER))
            cover_etc = w.ET0.values * KC_COVER * winter
            need_net_olive = np.maximum(etc - 0.0, 0)  # rain ~0; bucket handles rain
            if mode == "gravity":
                req = need_net_olive / EFF["gravity"]; net = np.minimum(gross_day, req) * EFF["gravity"]
            elif mode == "rdi":
                req = RDI * need_net_olive / EFF["gravity"]; net = np.minimum(gross_day, req) * EFF["gravity"]
            elif mode == "cover":   # cover on 50 % of ground, flood-irrigated; cover competes proportionally
                creq = 0.5 * cover_etc
                req = (need_net_olive + creq) / EFF["gravity"]; got = np.minimum(gross_day, req) * EFF["gravity"]
                share = np.divide(need_net_olive, need_net_olive + creq, out=np.ones_like(req), where=(need_net_olive + creq) > 0)
                net = got * share
            elif mode == "drip":    # olive by drip (0.90); 30 % strips by micro-sprinkler (0.75); strips compete proportionally
                creq = 0.3 * cover_etc
                req_g = need_net_olive / EFF["drip"] + creq / EFF["sprinkler"]
                frac = np.divide(np.minimum(gross_day, req_g), req_g, out=np.ones_like(req_g), where=req_g > 0)
                net = need_net_olive * frac
            irr = net
        else:
            req = etc / EFF["gravity"]
            irr = np.minimum(gross_day, req) * EFF["gravity"]
    eta = bucket(P, etc, irr, c["zr"], c["p"])
    wrsi = 100.0 * eta.sum() / etc.sum() if etc.sum() > 0 else np.nan
    fm = np.isin(w.index.month, c["flower_months"]); first = w.index.month == c["months"][0]
    tmin_fl = float(w.TMIN[fm].min()); tmin_first = float(w.TMIN[first].min())
    tf_warm, tf_cold = c["tf"]
    frost_fail = bool(tmin_fl <= tf_cold or (c["tg"] is not None and tmin_first <= c["tg"]))
    frost_dmg = bool(tmin_fl <= tf_warm)
    heat_days = int((w.TMAX[fm] > 30).sum())
    return dict(wrsi=round(float(wrsi), 1), tmin_flower=round(tmin_fl, 1), frost_fail=frost_fail, frost_damage=frost_dmg,
                heat_days_gt30_flowering=heat_days, rain_mm=round(float(P.sum()), 1), etc_mm=round(float(etc.sum()), 1),
                irr_net_mm=round(float(irr.sum()), 1), et0_hg_days=int((w.get("ET0SRC", pd.Series(dtype=str)) == "hg_cal").sum()) if "ET0SRC" in w else 0)

def enso_phase(v):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else ("el_nino" if v >= 0.5 else "la_nina" if v <= -0.5 else "neutral")

def season_end_years(cid):
    c = CROPS[cid]
    crosses = c["n"] < 12 and c["months"][-1] < c["m0"]
    return list(range(Y0 + 1 if crosses else Y0, Y1 + 1))

# ----------------------------------------------------------------------------------- main hindcast
def hindcast(fid, df, highland, alpha=1.0, frost_raw=False, mode_abs=None):
    """Returns per-strategy per-season rows. frost_raw=True reproduces a 'POWER-cell Tmin, no lapse' variant."""
    if frost_raw:
        df = df.copy(); df["TMIN"] = df["TMIN_RAW"]
    irrigated = fid != "carumas"
    S = None; allot = None
    if irrigated:
        S, _, _ = supply_index(highland, range(Y0, Y1 + 1), 2 if fid == "samegua" else 1)
        allot = monthly_need_clim(df, "alfalfa" if fid == "samegua" else "olive", EFF["gravity"])
    crop_res = {}
    for st in STRATS[fid]:
        for cid in set(x for x in st["phases"] if x):
            key = (cid, st.get("mode"))
            if key in crop_res:
                continue
            crop_res[key] = {y: run_crop(df, fid, cid, y, st.get("mode"), allot, S, alpha) for y in season_end_years(cid)}
    # relative WRSI (anomaly) vs crop's own 1991-2020 median
    for key, rs in crop_res.items():
        med = np.median([r["wrsi"] for y, r in rs.items() if r and BASE0 <= y <= BASE1])
        for y, r in rs.items():
            if r:
                r["wrsi_rel"] = round(100 * r["wrsi"] / med, 1) if med > 0 else None
                r["wrsi_median_1991_2020"] = round(float(med), 1)
    return crop_res, S, allot

def classify(r, fid):
    """Failure rule. Irrigated farms: absolute WRSI (supply vs demand). Carumas (rainfed + unmeasured qocha water,
    POWER rain dry-biased ~2x vs CHIRPS): WRSI anomaly (relative to the crop's 1991-2020 median), failure < 50 %."""
    w = r["wrsi"] if fid != "carumas" else r["wrsi_rel"]
    water_fail = w is not None and w < WRSI_FAIL
    water_stress = w is not None and w < WRSI_STRESS
    causes = [k for k, v in (("water", water_fail), ("frost", r["frost_fail"])) if v]
    return water_fail, water_stress, causes

def fisher_and_perm(fail, phase):
    fail = np.asarray(fail, bool); phase = np.asarray(phase)
    en = phase == "el_nino"
    a = int((fail & en).sum()); b = int((~fail & en).sum()); c_ = int((fail & ~en).sum()); d = int((~fail & ~en).sum())
    try:
        orr, p2 = stats.fisher_exact([[a, b], [c_, d]])
    except ValueError:
        orr, p2 = np.nan, np.nan
    # 3-phase permutation test on the failure-rate range (max - min across phases); 20,000 shuffles
    labs = ["el_nino", "neutral", "la_nina"]
    def stat(ph):
        rates = [fail[ph == l].mean() for l in labs if (ph == l).sum() > 0]
        return max(rates) - min(rates)
    obs = stat(phase); perm = np.array([stat(RNG.permutation(phase)) for _ in range(20000)])
    p3 = float((np.sum(perm >= obs - 1e-12) + 1) / (len(perm) + 1))
    return dict(table_el_nino_vs_other=dict(el_nino_fail=a, el_nino_ok=b, other_fail=c_, other_ok=d),
                fisher_odds_ratio=None if not np.isfinite(orr) else round(float(orr), 2), fisher_p_two_sided=None if np.isnan(p2) else round(float(p2), 4),
                permutation_3phase_p=round(p3, 4), permutation_stat="range of failure rates across El Niño/neutral/La Niña, 20,000 label shuffles")

def summarize(fid, crop_res, oni):
    out = {}
    for st in STRATS[fid]:
        phases = [x for x in st["phases"] if x]
        uniq = list(dict.fromkeys(phases))
        key = lambda cid: (cid, st.get("mode"))
        # season = harvest year; strategy-level seasons only where every cropped phase has a complete season
        years = sorted(set.intersection(*[set(y for y, r in crop_res[key(c)].items() if r) for c in uniq]))
        rows = []
        for y in years:
            oni_v = float(oni.get(y, np.nan))
            crops = {}
            nfail = 0; ncrop = 0; causes_any = set()
            wvals = []
            for c in phases:   # weight by phase count (e.g. alfalfa 3 of 4 years in 'quinua')
                r = crop_res[key(c)][y]
                wf, ws, causes = classify(r, fid)
                crops[c] = dict(wrsi=r["wrsi"], wrsi_rel=r.get("wrsi_rel"), tmin_fl=r["tmin_flower"], fail=causes, stress=ws,
                                frost_dmg=r["frost_damage"], rain=r["rain_mm"], etc=r["etc_mm"], irr=r["irr_net_mm"])
                nfail += bool(causes); ncrop += 1; causes_any |= set(causes)
                wvals.append(r["wrsi"] if fid != "carumas" else r["wrsi_rel"])
            rows.append(dict(season=f"{y-1}/{str(y)[2:]}" if any(CROPS[c]["months"][-1] < CROPS[c]["m0"] for c in uniq) else str(y), harvest_year=y,
                             src="power", oni_djf=None if math.isnan(oni_v) else oni_v, enso=enso_phase(oni_v),
                             fail_share=round(nfail / ncrop, 2), any_fail=nfail > 0, causes=sorted(causes_any),
                             wrsi_mean=round(float(np.mean(wvals)), 1), crops=crops))
        # per-crop-season counts
        per_crop = {}
        for c in uniq:
            rs = {y: r for y, r in crop_res[key(c)].items() if r}
            cl = {y: classify(r, fid) for y, r in rs.items()}
            per_crop[c] = dict(seasons_tested=len(rs), first=min(rs), last=max(rs),
                               water_failures=int(sum(bool(v[0]) for v in cl.values())), frost_failures=int(sum(bool(r["frost_fail"]) for r in rs.values())),
                               both=sum(bool(v[0]) and bool(r["frost_fail"]) for v, r in zip(cl.values(), rs.values())),
                               any_failures=sum(bool(v[2]) for v in cl.values()), water_stress_seasons=int(sum(bool(v[1]) for v in cl.values())),
                               frost_damage_seasons=sum(r["frost_damage"] for r in rs.values()),
                               failure_rate=round(sum(bool(v[2]) for v in cl.values()) / len(rs), 3),
                               wrsi_abs_median=round(float(np.median([r["wrsi"] for r in rs.values()])), 1),
                               failure_metric="wrsi_rel (anomaly, % of 1991-2020 median)" if fid == "carumas" else "wrsi (absolute %)")
        ph = [r["enso"] for r in rows]; fail = [r["any_fail"] for r in rows]
        enso = {}
        for lab in ("el_nino", "neutral", "la_nina"):
            sub = [r for r in rows if r["enso"] == lab]
            enso[lab] = dict(n=len(sub), seasons_with_failure=sum(r["any_fail"] for r in sub),
                             rate=round(sum(r["any_fail"] for r in sub) / len(sub), 3) if sub else None,
                             mean_fail_share=round(float(np.mean([r["fail_share"] for r in sub])), 3) if sub else None,
                             median_wrsi=round(float(np.median([r["wrsi_mean"] for r in sub])), 1) if sub else None,
                             years=[r["harvest_year"] for r in sub])
        tests = fisher_and_perm(fail, ph)
        en_w = [r["wrsi_mean"] for r in rows if r["enso"] == "el_nino"]; ot_w = [r["wrsi_mean"] for r in rows if r["enso"] != "el_nino"]
        mw = stats.mannwhitneyu(en_w, ot_w, alternative="two-sided") if en_w and ot_w else None
        tests["mannwhitney_wrsi_el_nino_vs_other"] = dict(U=float(mw.statistic), p=round(float(mw.pvalue), 4), n_el_nino=len(en_w), n_other=len(ot_w)) if mw else None
        kw = [ [r["wrsi_mean"] for r in rows if r["enso"] == l] for l in ("el_nino", "neutral", "la_nina")]
        kw = [k for k in kw if len(k) > 1]
        if len(kw) == 3:
            k = stats.kruskal(*kw); tests["kruskal_wrsi_3phase"] = dict(H=round(float(k.statistic), 3), p=round(float(k.pvalue), 4))
        out[st["id"]] = dict(name=dict(en=st["en"], es=st["es"]), current=st.get("current", False), recommended=st.get("recommended", False),
                             phases=st["phases"], seasons_tested=len(rows), first_season=rows[0]["season"], last_season=rows[-1]["season"],
                             seasons_with_any_failure=sum(fail), seasons_failure_rate=round(sum(fail) / len(rows), 3),
                             seasons_water_failure=sum("water" in r["causes"] for r in rows), seasons_frost_failure=sum("frost" in r["causes"] for r in rows),
                             mean_fail_share=round(float(np.mean([r["fail_share"] for r in rows])), 3),
                             crop_seasons=per_crop, enso=enso, tests=tests, seasons=rows)
    return out

def main():
    oni = oni_djf()
    power = {}; pmeta = {}
    for fid in FARMS:
        power[fid], pmeta[fid] = load_power(fid)
    highland = power["carumas"]   # 3,851 m POWER cell = upper Moquegua/Osmore basin
    res = {}; supply = {}; variants = {}
    for fid in FARMS:
        cr, S, allot = hindcast(fid, power[fid], highland)
        res[fid] = summarize(fid, cr, oni)
        if S:
            supply[fid] = dict(index_by_year={y: round(v, 3) for y, v in S.items()},
                               normal_year_allotment_gross_mm_month=[round(float(a), 1) for a in allot],
                               normal_year_allotment_m3_ha_yr=round(float(allot.sum()) * 10, -1))
        # sensitivity: softer supply elasticity (S^0.5)
        if fid != "carumas":
            cr2, _, _ = hindcast(fid, power[fid], highland, alpha=0.5)
            s2 = summarize(fid, cr2, oni)
            variants.setdefault("supply_elasticity_0p5", {})[fid] = {k: dict(seasons=v["seasons_tested"], any_fail=v["seasons_with_any_failure"],
                                                                         water=v["seasons_water_failure"]) for k, v in s2.items()}
        # competitor-style: raw POWER cell Tmin (no altitude correction)
        cr3, _, _ = hindcast(fid, power[fid], highland, frost_raw=True)
        s3 = summarize(fid, cr3, oni)
        variants.setdefault("raw_power_tmin_no_lapse", {})[fid] = {k: dict(seasons=v["seasons_tested"], frost=v["seasons_frost_failure"],
                                                                        any_fail=v["seasons_with_any_failure"]) for k, v in s3.items()}
    # Carumas absolute WRSI (POWER rain as-is) for transparency
    cab = {}
    for st in res["carumas"].values():
        for c, pc in st["crop_seasons"].items():
            if c in cab: continue
            vals = [r["crops"][c]["wrsi"] for r in st["seasons"] if c in r["crops"]]
            cab[c] = dict(median_abs_wrsi=round(float(np.median(vals)), 1), seasons_abs_wrsi_lt50=int(sum(v < 50 for v in vals)), n=len(vals))
    variants["carumas_absolute_wrsi_power_rain_as_is"] = cab
    # ERA5-driven alternate hindcast (validation only)
    era = {}
    for fid in FARMS:
        e = load_era5(fid)
        cr, _, _ = hindcast(fid, e, load_era5("carumas"))
        era[fid] = summarize(fid, cr, oni)
    json.dump(dict(power=res, era5=era, supply=supply, variants=variants, pmeta=pmeta), open(ROOT / "backtest" / "_hindcast_raw.json", "w"), default=float)
    print("hindcast done")

if __name__ == "__main__":
    main()
