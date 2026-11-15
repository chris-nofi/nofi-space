# CERES 1981–2025 backtest: methods (model-based hindcast, NOT observed yields)

Output: `data/out/backtest_1981_2025.json`, built by `data/backtest/{imerg_monthly_pull,backtest,validate,build_backtest_json}.py` (also in `data/run_all.sh`). Kepler, 2026-11-14 (UTC-5).

## 1. What it is
For each of the 3 farms and each of the 4 CERES strategies in the app (`DB.FARMS[*].strategies`), every crop season from 1981 to 2025 is replayed through a crop water balance and frost check driven by **NASA POWER daily only**. The output is whether the crop would have **failed** in the model, and from what cause (water or frost). These are modelled outcomes, not measured harvests.

## 2. Seasons: why 44 or 45, and no padding
POWER daily starts on 1981-01-01. Seasons are labelled by harvest year.
- **44 complete seasons (1981/82–2024/25):** crops whose season crosses New Year. These are potato Nov–Mar, faba Dec–Apr, tarwi Nov–Apr, forage maize Oct–Jan, and bean Nov–Feb. The 1980/81 season would need Nov–Dec 1980, which POWER does not have. The 2025/26 season is incomplete, so it is not counted.
- **45 seasons (1981–2025):** calendar-year crops (alfalfa, olive) and crops sown in the same year they are harvested (oat-vetch Jan–May, barley Jan–Apr, pea Apr–Jul, forage barley Jun–Sep, quinoa May–Sep).
- **Strategy level:** a season counts only when every cropped phase has a complete season. That gives 44 seasons for Carumas (all 4 strategies), 45 for Samegua current and quinua, 44 for Samegua maiz-arveja and cebada-frijol, and 45 for El Algarrobal.

## 3. Base series (POWER only) and how it is treated (same as the pipeline)
- **Rain:** `PRECTOTCORR`. Same QC rule as the pipeline: a day >50 mm is dropped when its CHIRPS month total is <25 % of that day. This removed 2022-09-12/13.
- **Temperature:**
  - Carumas: POWER + 4.55 °C. This is a 6.5 °C/km lapse correction from the 3,851 m grid cell down to 3,151 m (SRTM).
  - Samegua: POWER + 14.79 °C (same cell, corrected down to 1,575 m). `risk_build.py` prefers ERA5-Land for Samegua frost. Because the base here is POWER only, ERA5-Land is reported as validation instead. Both series give 0 frost days.
  - El Algarrobal: raw POWER, because the coastal inversion makes a lapse correction wrong.
- **ET0:** FAO-56 Penman-Monteith on raw POWER, using the pipeline's `et0_pm` (the pipeline's convention for crop water). POWER radiation only starts in 1984, so for 1981–1983 I use POWER Hargreaves (FAO-56 eq. 52), calibrated to PM by a calendar-month ratio fitted on 1984–2010. That covers 1,095 days per farm.
- **`GWETROOT`:** reported but not used to decide failures. It sits at 0.33–0.38 all year at these desert or puna cells.

## 4. Failure rules and thresholds (sources)
- **Water:** daily FAO-56 single-layer root-zone balance (chapter 8). Inputs:
  - ETc = ET0 × Kc, with Kc from FAO-56 Table 12.
  - Zr (lower bound of the range) and p from FAO-56 Table 22.
  - TAW = 120 mm/m, from FAO-56 Table 19 sandy-loam midpoints (θFC 0.23 − θWP 0.11). SoilGrids (non-NASA) classes all three farms as sandy loam.
  - Seasonal **WRSI** = 100·ΣETa/ΣETc (Frère & Popov 1979, FAO PPP 17). **Failure is WRSI < 50; stress is WRSI < 80** (Smith 1992 / FEWS NET categories).
  - **Carumas (rainfed plus community qocha):** POWER rain at the cell is dry-biased. The Nov–Mar 1991–2020 mean is 101.5 mm vs CHIRPS 205 mm, and IMERG 2001–2025 gives 273 mm. An absolute WRSI with POWER rain would fail 44 of 44 potato seasons, so Carumas uses the **WRSI anomaly** instead: WRSI as a % of the crop's own 1991–2020 median, failure < 50 %. WRSI anomalies are the standard choice in arid zones (FEWS NET practice).
  - **Irrigated farms:** failure here means modelled **supply < crop demand**, not low rainfall.
    - The normal-year allotment is the current practice's 1991–2020 monthly gross need, (ET0·Kc − effective rain)/0.60. That is 24,080 m³/ha/yr for Samegua alfalfa and 17,080 m³/ha/yr for El Algarrobal olive.
    - Each year the allotment is scaled by a **supply index** S = min(1, Jan–Mar POWER rain at the 3,851 m upper-basin cell ÷ its 1991–2020 median). Samegua averages S over 2 years (the Pasto Grande reservoir); El Algarrobal uses 1 year (the Osmore, run-of-river). **[ASSUMPTION: a proxy, not canal records.]**
    - Every strategy gets the same allotment.
    - Efficiencies: gravity 0.60, sprinkler 0.75, drip 0.90 (Brouwer et al. 1989).
    - The olive deficit (RDI) strategy supplies 0.75 of demand. Cover crops use Kc 0.8 May–Sep, on 50 % of the ground for "cover" and 30 % strips for "drip". These are pipeline assumptions, and the cover competes proportionally with the olive for water.
- **Frost:** failure if Tmin ≤ the cold end of the crop's **flowering** critical range during its peak-Kc months, or ≤ the **germination** value in the sowing month. Source: FAO 2005, *Frost Protection* Vol. 1, Table 4.5 (after Ventskevich 1958). Values used (flowering warm/cold end; germination):

  | crop | flowering | germination |
  |---|---|---|
  | potato | −1/−2 | −2 |
  | barley, oats | −1/−2 | −7 / −8 |
  | maize | −1/−2 | −2 |
  | peas | −2/−3 | −7 |
  | beans | −2/−3 | −5 |
  | lupin | −3/−4 | −6 |

  - Olive uses −1.4 °C (Table 4.4, fruit).
  - **Assumptions:** alfalfa and quinoa (−2/−4) are not in the table. Using the Table 4.5 "Beans" row for faba bean is also a mapping assumption.
- **Heat:** not used as a failure cause. I found no cited stage threshold, and the Samegua lapse-adjusted Tmax runs about 7 °C above ERA5-Land.
- **Crop calendars and the Kc for quinoa, tarwi and oat-vetch are assumptions.** They are the same ones the engine uses, and they are not INIA-confirmed. No INIA Moquegua threshold table was retrievable.
- **Rotations:** "every phase every year". Each crop of a rotation is hindcast in every season. A season fails if any cropped phase fails; fallow cannot fail.

## 5. ENSO and tests
- **ONI:** v5 from NOAA CPC (`oni.ascii.txt`). Each season takes the **DJF** value of its wet season: DJF of the harvest year for Nov–Mar crops, and Dec(y−1)–Feb(y) for calendar-year crops. El Niño is ≥ +0.5 °C, La Niña ≤ −0.5 °C, everything else neutral.
- Seasons per phase: 15 El Niño, 13–14 neutral, 16 La Niña.
- **Tests:**
  - Fisher's exact test (El Niño vs other seasons, seasons with at least one failure).
  - A 3-phase permutation test (20,000 shuffles; the statistic is the range of failure rates across phases).
  - Mann-Whitney U on season WRSI (El Niño vs other).
  - Kruskal-Wallis on season WRSI across the 3 phases.
- **Power is low:** with 0–3 failures per strategy, the failure tests cannot reach significance. The continuous WRSI tests are more informative.

## 6. Validation overlays (never used as the base)
- **ERA5 rain (0.25°) and ERA5-Land Tmin/Tmax (0.1°), via Open-Meteo.** ERA5-Land rain is null at these points, so ERA5 rain is used for the rain comparison.
- **GPM IMERG Final monthly v07 (GPM_3IMERGM)**, 1998-01 to 2025-09. Access with `EARTHDATA_TOKEN` **works**: 333/333 months pulled with 0 failures.
- **SMAP L3 9 km**, Carumas cell, 10 complete seasons.
- **CHIRPS v3** (non-NASA).
- What is compared:
  - Daily and monthly r, bias and RMSE.
  - Nov–Mar seasonal correlations, and overlap of the driest-quintile seasons.
  - A full hindcast re-run driven by ERA5, compared for failure-flag agreement, Cohen's κ, WRSI Spearman correlation and worst-quintile overlap.
  - A Carumas re-run with IMERG rain substituted for POWER rain.
  - SMAP seasonal soil moisture vs the potato WRSI anomaly.
- All results are in `validation` in the JSON.

## 7. Why this beats a POWER-only frost/drought count
1. **Altitude.** Raw POWER Tmin at the 3,851 m cell gives 154 frost days a year and **30–39 of 44 seasons with frost failure at Carumas**. It even gives 18–44 at the 1,575 m Samegua valley. The lapse-corrected series gives 0. ERA5-Land agrees with 0 in-season frost failures, and with 1.8 days below 0 °C a year at Carumas.
2. **Irrigation logic.** For the irrigated farms, failure is judged on supply vs demand, not on rainfall.
3. **Rain bias, quantified with NASA's own IMERG.** With POWER rain, absolute WRSI fails 24/24 potato seasons in 2001–2025; with IMERG rain it fails 10/24. That is why anomalies are used.
4. **Cross-checks.** Validation against IMERG, SMAP, ERA5 and CHIRPS, with the numbers reported.
5. **Sensitivity runs:** supply elasticity 0.5, raw Tmin, and absolute WRSI for Carumas.

## 8. Limitations and gaps
- No observed yields or canal deliveries were used, and the supply index is a proxy.
- Grid Tmin can't resolve cold-air pooling. The lapse-adjusted minimum is −0.2 °C, while ERA5-Land's is −6.8 °C, so frost is probably under-counted.
- Carumas and Samegua share one POWER cell.
- SMAP is available for Carumas only.
- ERA5 is about 7× wetter than POWER at Carumas, and a hindcast driven by ERA5 flags no failures. So κ comes out as 0 even where the flags agree 93–98 %. Read the WRSI Spearman correlations (0.32–0.52) and the worst-quintile overlaps instead.
- The **2016** hindcast at El Algarrobal shows stress (current WRSI 80.0), not failure. That under-calls the >50 % olive losses ProActivo reported on 01/12/2016. The late-2016 dry spell falls outside the Jan–Mar supply window.
