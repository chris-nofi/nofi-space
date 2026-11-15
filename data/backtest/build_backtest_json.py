#!/usr/bin/env python3
"""Assemble data/out/backtest_1981_2025.json (site-ready) from _hindcast_raw.json + _validation.json."""
from __future__ import annotations
import datetime as dt, json, sys
from pathlib import Path
import numpy as np, pandas as pd
from scipy import stats
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT)); sys.path.insert(0, str(ROOT / "backtest"))
from backtest import CROPS, STRATS, WRSI_FAIL, WRSI_STRESS, TAW_PER_M, KC_COVER, RDI  # noqa: E402
from pull_and_build import clean  # noqa: E402

H = json.loads((ROOT / "backtest" / "_hindcast_raw.json").read_text())
V = json.loads((ROOT / "backtest" / "_validation.json").read_text())
FARM_NAMES = {"carumas": "Carumas (highland, rainfed + community qocha, ~3,150 m)",
              "samegua": "Samegua (Pasto Grande-irrigated valley plots, ~1,560 m)",
              "algarrobal": "El Algarrobal (Osmore valley coast, irrigated olive, ~160 m)"}

def kappa(a, b):
    a = np.asarray(a, bool); b = np.asarray(b, bool); n = len(a)
    po = (a == b).mean(); pe = a.mean() * b.mean() + (1 - a.mean()) * (1 - b.mean())
    return None if pe == 1 else round(float((po - pe) / (1 - pe)), 3)

def agreement(fid, sid):
    p = {r["harvest_year"]: r for r in H["power"][fid][sid]["seasons"]}
    e = {r["harvest_year"]: r for r in H["era5"][fid][sid]["seasons"]}
    ys = sorted(set(p) & set(e))
    fa = [p[y]["any_fail"] for y in ys]; fb = [e[y]["any_fail"] for y in ys]
    wa = [p[y]["wrsi_mean"] for y in ys]; wb = [e[y]["wrsi_mean"] for y in ys]
    k = max(1, round(0.2 * len(ys)))
    def worst(d):
        kth = sorted(d[y]["wrsi_mean"] for y in ys)[k - 1]
        w = set(y for y in ys if d[y]["wrsi_mean"] <= kth)
        return w if len(w) <= 2 * k else None   # too many ties (e.g. WRSI = 100 in most seasons) -> undefined
    la, lb = worst(p), worst(e)
    if la is None or lb is None:
        return dict(n=len(ys), failure_flag_agreement_pct=round(100 * float(np.mean(np.array(fa) == np.array(fb))), 1), cohen_kappa=kappa(fa, fb),
                    power_failures=int(sum(fa)), era5_failures=int(sum(fb)), spearman_wrsi=round(float(stats.spearmanr(wa, wb)[0]), 3),
                    worst_quintile_overlap="undefined (ties at WRSI 100)")
    return dict(n=len(ys), failure_flag_agreement_pct=round(100 * float(np.mean(np.array(fa) == np.array(fb))), 1), cohen_kappa=kappa(fa, fb),
                power_failures=int(sum(fa)), era5_failures=int(sum(fb)),
                spearman_wrsi=round(float(stats.spearmanr(wa, wb)[0]), 3), worst_quintile_overlap=f"{len(la & lb)}/{max(len(la), len(lb))}",
                worst_quintile_power=sorted(la), worst_quintile_era5=sorted(lb))

def compact_strategy(fid, s):
    s = dict(s)
    rows = []
    for r in s.pop("seasons"):
        rows.append(dict(s=r["season"], y=r["harvest_year"], src=r["src"], oni=r["oni_djf"], enso=r["enso"], fail=r["any_fail"], causes=r["causes"],
                         share=r["fail_share"], wrsi=r["wrsi_mean"],
                         crops={c: dict(wrsi=v["wrsi"], rel=v["wrsi_rel"], tmin=v["tmin_fl"], rain=v["rain"], etc=v["etc"], irr=v["irr"], fail=v["fail"])
                                for c, v in r["crops"].items()}))
    allw = [r["wrsi"] for r in rows]
    s["worst_season"] = min(rows, key=lambda r: r["wrsi"])["s"]; s["worst_wrsi"] = min(allw)
    s["p10_wrsi"] = round(float(np.percentile(allw, 10)), 1)
    s["stress_seasons_wrsi_lt80"] = sum(r["wrsi"] < WRSI_STRESS for r in rows)
    s["validation_vs_era5_driven_hindcast"] = agreement(fid, s.get("_id"))
    s["seasons"] = rows
    return s

def cat(w):
    return "failure" if w < 50 else "poor" if w < 60 else "mediocre" if w < 80 else "average" if w < 95 else "good" if w < 99 else "very good"

def story(year_label, hy, oni_note):
    out = {}
    for fid, sts in H["power"].items():
        rows = {}
        for sid, st in sts.items():
            r = next((x for x in st["seasons"] if x["harvest_year"] == hy), None)
            if r:
                rows[sid] = dict(wrsi=r["wrsi_mean"], fail=r["any_fail"], causes=r["causes"], current=st["current"], recommended=st["recommended"],
                                 oni=r["oni_djf"], enso=r["enso"], season=r["season"], crops={c: v["wrsi"] for c, v in r["crops"].items()})
        out[fid] = rows
    return out

def main():
    for fid in H["power"]:
        for sid in H["power"][fid]:
            H["power"][fid][sid]["_id"] = sid
    farms = {}
    for fid, sts in H["power"].items():
        strategies = {}
        for sid, st in sts.items():
            c = compact_strategy(fid, st); c.pop("_id", None)
            strategies[sid] = c
        farms[fid] = dict(name=FARM_NAMES[fid], failure_metric=("WRSI anomaly: seasonal WRSI as % of the crop's own 1991-2020 median (POWER rain is dry-biased here and qocha water is unmeasured)"
                                                                if fid == "carumas" else "absolute WRSI: crop water use satisfied by rain + modelled irrigation allotment vs crop demand ET0×Kc"),
                          irrigation_supply=H["supply"].get(fid), strategies=strategies)
    # named-year stories (numbers pulled from the hindcast rows)
    stories = []
    s23 = story("2023-24 El Niño", 2024, "")
    def W(f, s): return s23[f][s]["wrsi"]
    stories.append(dict(id="el_nino_2023_24", title="2023–24 El Niño (ONI DJF 2023/24 = %s)" % s23["carumas"]["current"]["oni"],
        season_mapping="Carumas season 2023/24 (Nov 2023–Mar 2024); irrigated farms: calendar 2024, whose supply index uses Jan–Mar 2024 upper-basin rain. Note: DJF 2022/23 (start of the 2023 coastal El Niño) was still La Niña by ONI.",
        by_farm=s23,
        supply_index_2024=dict(samegua=H["supply"]["samegua"]["index_by_year"]["2024"], algarrobal=H["supply"]["algarrobal"]["index_by_year"]["2024"]),
        text=("Model-based hindcast, not observed yields. Carumas: POWER Nov 2023–Mar 2024 rain was near its normal (potato WRSI %.1f%% of its 1991–2020 median), so no rotation shows a water or frost failure. "
              "Irrigated valleys: the supply proxy fell to %.2f (Samegua, 2-season memory) and %.2f (El Algarrobal) of normal. Samegua: continuous alfalfa (today) falls to WRSI %.1f (%s) vs %.1f (%s) for CERES's "
              "alfalfa → forage maize → pea. El Algarrobal: gravity irrigation on bare soil reaches WRSI %.1f (%s) vs %.1f (%s) for CERES's drip + strip cover, with the same canal allotment. "
              "No strategy fails outright in 2024; the recommended strategies keep more of the crop's water demand satisfied.") % (
              s23["carumas"]["current"]["wrsi"], H["supply"]["samegua"]["index_by_year"]["2024"], H["supply"]["algarrobal"]["index_by_year"]["2024"],
              W("samegua", "current"), cat(W("samegua", "current")), W("samegua", "maiz-arveja"), cat(W("samegua", "maiz-arveja")),
              W("algarrobal", "current"), cat(W("algarrobal", "current")), W("algarrobal", "drip"), cat(W("algarrobal", "drip")))))
    s83 = story("1982-83", 1983, "")
    stories.append(dict(id="el_nino_1982_83", title="1982–83 El Niño (ONI DJF 1982/83 = %s): the worst season in the record" % s83["carumas"]["current"]["oni"],
        by_farm=s83, supply_index_1983=dict(samegua=H["supply"]["samegua"]["index_by_year"]["1983"], algarrobal=H["supply"]["algarrobal"]["index_by_year"]["1983"]),
        text=("Model-based hindcast. Nov 1982–Mar 1983 POWER rain at the highland cell was the lowest of the record; potato WRSI fell to %.1f%% of normal (water failure) and every Carumas rotation failed "
              "on water. The El Algarrobal supply proxy fell to %.2f of normal: every olive strategy fails (current WRSI %.1f, drip %.1f). Some droughts are beyond any rotation; CERES's role there is early warning and water-saving that stretches the reservoir, not a guarantee.") % (
              s83["carumas"]["current"]["wrsi"], H["supply"]["algarrobal"]["index_by_year"]["1983"], s83["algarrobal"]["current"]["wrsi"], s83["algarrobal"]["drip"]["wrsi"])))
    s16 = story("2015-16", 2016, "")
    stories.append(dict(id="el_nino_2015_16", title="2015–16 El Niño (ONI DJF 2015/16 = %s) and the 2016 El Algarrobal olive losses" % s16["carumas"]["current"]["oni"],
        by_farm=s16, supply_index_2016=dict(samegua=H["supply"]["samegua"]["index_by_year"]["2016"], algarrobal=H["supply"]["algarrobal"]["index_by_year"]["2016"]),
        reality_check="ProActivo (01/12/2016): Moquegua's regional agriculture manager reported S/ 21 M of losses and that in El Algarrobal 'se perdió más del 50 % de plantaciones de olivo' (press report, not a measured yield series).",
        text=("Model-based hindcast. The 2016 supply proxy at El Algarrobal was %.2f of normal. Gravity/bare soil drops to WRSI %.1f (edge of the stress band), cover %.1f, drip + strip cover %.1f. "
              "The hindcast flags stress, not outright failure, so it UNDER-calls the reported >50%% olive losses; the late-2016 dry spell (Sep–Dec) falls outside the Jan–Mar supply window used here. We report this as a limitation.") % (
              H["supply"]["algarrobal"]["index_by_year"]["2016"], s16["algarrobal"]["current"]["wrsi"], s16["algarrobal"]["cover"]["wrsi"], s16["algarrobal"]["drip"]["wrsi"])))
    # SMAP vs Carumas potato WRSI anomaly (2015/16-2024/25)
    ssm = pd.Series({int(k): v for k, v in V.get("smap_wrsi_hook", {}).get("ssm", {}).items()})
    pot = pd.Series({r["harvest_year"]: r["crops"]["potato"]["wrsi_rel"] for r in H["power"]["carumas"]["current"]["seasons"]})
    j = pd.concat([ssm, pot], axis=1).dropna()
    smap_wrsi = dict(n=int(len(j)), spearman_rho=round(float(stats.spearmanr(j.iloc[:, 0], j.iloc[:, 1])[0]), 3),
                     p=round(float(stats.spearmanr(j.iloc[:, 0], j.iloc[:, 1])[1]), 4)) if len(j) >= 5 else None
    V.pop("smap_wrsi_hook", None)
    V["smap"]["season_smap_vs_potato_wrsi_anomaly"] = smap_wrsi
    meta = dict(
        title="CERES 1981–2025 historical backtest, Moquegua (Field Shift)",
        label="MODEL-BASED HINDCAST, NOT OBSERVED YIELDS",
        label_es="RETROSIMULACIÓN CON MODELO, NO RENDIMIENTOS OBSERVADOS",
        generated=dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        period="1981-01-01..2025-12-31 (NASA POWER daily starts 1981-01-01)",
        seasons_note=("Seasons are labelled by harvest year. Crops whose season crosses New Year (e.g. potato Nov–Mar) have 44 complete seasons (1981/82–2024/25); "
                      "calendar-year and Jan-sown crops have 45 (1981–2025). 2025/26 is incomplete and is not counted. No season is padded."),
        base_series="NASA POWER daily (community AG) only: PRECTOTCORR, T2M_MIN/T2M_MAX, ET0 FAO-56 PM from POWER (pipeline et0_pm), GWETROOT (reported, not used for failures)",
        base_series_handling=dict(
            precip_qc="pipeline rule: drop POWER days >50 mm whose CHIRPS v3 month total <25% of that day (removed 2022-09-12/13)",
            temperature={"carumas": "POWER + 4.55 °C lapse shift (6.5 °C/km, 3,851 m cell → 3,151 m SRTM), as pipeline",
                         "samegua": "POWER + 14.79 °C lapse shift (same cell, → 1,575 m). Pipeline risk_build prefers ERA5-Land for Samegua frost; with a POWER-only base we keep the lapse-adjusted series and report ERA5-Land as validation (both give 0 frost days)",
                         "algarrobal": "raw POWER (coastal inversion), as pipeline"},
            et0="FAO-56 Penman-Monteith on raw POWER (pipeline convention for crop water). 1981–1983 lack POWER radiation: POWER Hargreaves (FAO-56 eq. 52) calibrated to POWER PM by calendar-month ratio 1984–2010",
            hargreaves_calibration_by_farm={f: H["pmeta"][f]["hargreaves_cal_ratio_by_month"] for f in H["pmeta"]}),
        validation_overlays=["ERA5 daily precipitation (0.25°) and ERA5-Land Tmin/Tmax (0.1°) via Open-Meteo archive API (ERA5-Land precipitation is null at these points, so ERA5 is used for rain)",
                             "GPM IMERG Final Run monthly v07 (GPM_3IMERGM) via GES DISC OPeNDAP, 1998-01..2025-09",
                             "SMAP L3 SPL3SMP_E v006 9 km AM soil moisture, Carumas cell, 2015-04..",
                             "CHIRPS v3 monthly (non-NASA)"],
        method=dict(
            water=("Daily FAO-56 single-layer root-zone water balance (ch. 8) per crop season, ETc = ET0 × Kc (FAO-56 Table 12), Zr and p from FAO-56 Table 22 (lower bound of Zr range), "
                   f"TAW {TAW_PER_M:.0f} mm/m (FAO-56 Table 19, sandy loam midpoints; SoilGrids texture = sandy loam at all farms). Seasonal WRSI = 100 × ΣETa/ΣETc (Frère & Popov 1979, FAO PPP 17). "
                   f"Failure: WRSI < {WRSI_FAIL:.0f}; stress: WRSI < {WRSI_STRESS:.0f} (Smith 1992 / FEWS NET categories). Carumas uses the WRSI anomaly (% of the crop's 1991–2020 median), as recommended for arid zones."),
            irrigation=("Irrigated farms: water failure = modelled supply vs crop demand, not rain. Normal-year allotment = current practice's 1991–2020 monthly gross need (ET0×Kc − effective rain)/0.60 "
                        "(alfalfa at Samegua, olive at El Algarrobal). Each year it is scaled by a supply index S = min(1, Jan–Mar POWER rain at the 3,851 m upper-basin cell / its 1991–2020 median); "
                        "Samegua averages S over 2 years (Pasto Grande reservoir), El Algarrobal uses 1 year (Osmore, run-of-river). Every strategy receives the same allotment; efficiencies gravity 0.60, "
                        f"sprinkler 0.75, drip 0.90 (Brouwer et al. 1989). Olive RDI {RDI}, cover Kc {KC_COVER} on 50% (cover) / 30% strips (drip) May–Sep, as in the pipeline. ASSUMPTION: the supply proxy is not a measured canal/turno record."),
            frost=("Frost failure: any day with Tmin ≤ the cold end of the FLOWERING critical-temperature range during the crop's peak-Kc months, or ≤ the GERMINATION value in the sowing month "
                   "(FAO 2005 Frost Protection Vol. 1, Table 4.5, after Ventskevich 1958). Frost damage (reported): Tmin ≤ warm end of the flowering range."),
            heat="Not a failure cause (no cited crop-stage threshold retrieved and lapse-adjusted Samegua Tmax runs warm vs ERA5-Land); heat days >30 °C at flowering are kept in the raw hindcast only.",
            rotations="Every phase every year: each crop of a rotation is hindcast in every season (standard rotation-trial design). Season fails if any cropped phase fails; fallow phases cannot fail. fail_share = failed phases / cropped phases.",
            enso="ONI v5 (NOAA CPC oni.ascii.txt), DJF value of the wet season that drives the crop season (DJF of the harvest year for Nov–Mar crops; DJF Dec(y-1)–Feb(y) for calendar-year crops). El Niño ≥ +0.5, La Niña ≤ −0.5, else neutral.",
            tests=("Fisher's exact test (El Niño vs other, seasons with ≥1 failure), 3-phase permutation test (20,000 shuffles of ENSO labels; statistic = range of failure rates), "
                   "Mann-Whitney U on season WRSI (El Niño vs other) and Kruskal-Wallis across 3 phases. n per phase is reported; with ~15 seasons per phase and 0–3 failures the failure tests have low power.")),
        thresholds={c: dict(name_en=v["en"], name_es=v["es"], months=v["months"], kc=v["kc"], zr_m=v["zr"], p=v["p"], tc_germination=v["tg"],
                            tc_flowering_range=list(v["tf"]), flowering_months=v["flower_months"], source=v["src"]) for c, v in CROPS.items()},
        sources=dict(
            power="NASA POWER Daily API v2, community AG, https://power.larc.nasa.gov/ (MERRA-2/GEOS, 0.5°×0.625°)",
            oni="NOAA CPC ONI v5, https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt",
            imerg="Huffman et al., GPM IMERG Final Precipitation L3 1 month 0.1° V07 (GPM_3IMERGM), GES DISC, doi:10.5067/GPM/IMERG/3B-MONTH/07",
            smap="O'Neill et al., SMAP Enhanced L3 Radiometer Global Daily 9 km EASE-Grid Soil Moisture V006 (SPL3SMP_E), NSIDC DAAC",
            era5="Hersbach et al. 2020 (ERA5); Muñoz-Sabater et al. 2021 (ERA5-Land); via Open-Meteo archive API",
            chirps="Funk et al., CHIRPS v3.0 monthly (UCSB CHC), non-NASA",
            fao56="Allen, Pereira, Raes & Smith 1998, FAO Irrigation and Drainage Paper 56, Tables 12, 19, 22; eq. 52",
            frost="Snyder & de Melo-Abreu 2005, Frost Protection: fundamentals, practice and economics, Vol. 1, FAO Environment and Natural Resources Series 10, Tables 4.4–4.5, https://www.fao.org/4/y7223e/y7223e0a.htm",
            wrsi="Frère & Popov 1979, Agrometeorological crop monitoring and forecasting, FAO Plant Production and Protection Paper 17; categories per Smith 1992 / FEWS NET (Senay & Verdin 2003)",
            efficiency="Brouwer et al. 1989, FAO Irrigation Water Management Training Manual 4",
            soil="Poggio et al. 2021, SoilGrids 2.0 (ISRIC), non-NASA: texture class only",
            press_2016="ProActivo, 01/12/2016 (olive losses in El Algarrobal), cited in kepler-answers.md Q11"),
        imerg_access=("WORKS (tested 2026-11-14 with EARTHDATA_TOKEN via GES DISC OPeNDAP): GPM_3IMERGM v07 Final monthly, 333 months 1998-01..2025-09 pulled for all 3 farm cells, 0 failures "
                      "(data/raw/imerg_monthly_final_v07.csv). Final Run ends 2025-09 in CMR; no 1981-2025 season needs IMERG Late. Used only as a validation overlay."),
        gaps=["Model-based hindcast: no observed plot yields, canal/turno deliveries or reservoir records were available; irrigation supply is a rainfall-based proxy (assumption).",
              "Crop calendars, rotation phases and Kc for quinoa/tarwi/oat-vetch are assumptions (not INIA-confirmed). No INIA Moquegua crop-threshold table was retrievable; FAO thresholds used.",
              "POWER rain at the 3,851 m cell is dry-biased (Nov–Mar 1991–2020 mean 101.5 mm vs CHIRPS 205 mm; 2001–2025 IMERG 273 mm vs POWER 100 mm), so Carumas uses WRSI anomalies; absolute WRSI fails in 44/44 potato seasons with POWER rain and 10/24 with IMERG rain.",
              "Frost: 0.5° grid Tmin cannot resolve cold-air pooling on terraces/valley floors; the lapse-adjusted POWER series has an absolute minimum of -0.2 °C at Carumas (ERA5-Land -6.8 °C), so in-season frost failures may be under-counted.",
              "Samegua and Carumas share one POWER cell; Samegua lapse-adjusted Tmax runs ~7 °C warmer than ERA5-Land, so heat is not used as a failure cause.",
              "SMAP is available for the Carumas cell only (9 km, 2015+); 10 complete seasons.",
              "ERA5-Land precipitation is null at these points via Open-Meteo, so ERA5 (0.25°) rain is used for the cross-check; ERA5 is ~7x wetter than POWER at Carumas.",
              "ENSO failure tests have low power: ~13-16 seasons per phase and 0-3 failures per strategy.",
              "1981-1983 ET0 uses calibrated POWER Hargreaves (no POWER radiation before 1984)."])
    farms_out = dict(meta=meta, farms=farms, named_years=stories, validation=dict(**V), sensitivity=H["variants"])
    (ROOT / "out" / "backtest_1981_2025.json").write_text(json.dumps(clean(farms_out), ensure_ascii=False, separators=(",", ":"), default=float, allow_nan=False))
    print("wrote", ROOT / "out" / "backtest_1981_2025.json")

if __name__ == "__main__":
    main()
