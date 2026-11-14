# Kepler: answers to Apollo's 12 science questions (Ceres Ventures, Space Apps 2026 Moquegua)

Kepler · 2026-11-14 (UTC-5). Every number below comes from a file in `/workspace/space-apps-2026/data/` that the scripts there produced from a live API response. Assumptions are marked **[ASSUMPTION]** and cited.

Farm points (from `/workspace/ceres-ai/app.js`): Carumas (−16.81, −70.69), Samegua (−17.18, −70.90), El Algarrobal (−17.62, −71.26). SRTM 30 m elevations are 3,151 m, 1,575 m and 162 m (OpenTopoData `srtm30m`).

---

### 1. POWER grid-cell elevation vs real elevation; is a lapse correction needed?
| Farm | SRTM (m) | POWER cell (m) | Δ (m) | Lapse shift at 6.5 °C/km |
|---|---|---|---|---|
| Carumas | 3,151 | 3,851 | −700 | +4.55 °C |
| Samegua | 1,575 | **3,851 (same cell as Carumas)** | −2,276 | +14.79 °C |
| El Algarrobal | 162 | 720 | −558 | +3.63 °C |
Source: `geometry.coordinates[2]` of the POWER API response; `data/out/<farm>.json → elevation`.

Checked against ERA5-Land (0.1°, cell elevations 3,136 / 1,564 / 117 m; 1991–2020 mean T2M):
- **Carumas:** POWER raw 7.15 °C, lapse-adjusted ≈ 11.7 °C, ERA5-Land 11.83 °C. **Use the lapse correction.**
- **Samegua:** POWER raw 7.15 °C, lapse-adjusted ≈ 21.9 °C, ERA5-Land 19.08 °C. A 2.3 km correction overshoots. **Use ERA5-Land temperature for Samegua**, or label POWER temperature as "highland cell, not valid for the valley".
- **El Algarrobal:** POWER raw 18.28 °C, lapse-adjusted ≈ 21.9 °C, ERA5-Land 18.94 °C. A standard lapse rate is wrong under the coastal marine inversion. **Use raw POWER.**

Frost days per year (Tmin < 0 °C) show how much this matters:
- Carumas: 154 (POWER raw, 1991–2020) vs 1.8 (ERA5-Land, 1991–2020) vs 0 (POWER lapse-adjusted, 2001–2025).
- The true value at 3,150 m is probably low but not zero: ERA5-Land's absolute minimum is −6.8 °C.
- Recommendation: present Carumas frost as a range, "~2 days/yr (ERA5-Land) up to 141 days/yr at the 3,850 m ridge (POWER)". Frost risk is real on higher plots.

### 2. Best ET₀ method with POWER inputs; expected bias; ERA5 cross-check
- **FAO-56 Penman-Monteith (PM)** is implemented in `pull_and_build.py → et0_pm()` (eqs. 6–8, 11–13, 21, 37–39; ea from T2MDEW; Rs = ALLSKY_SFC_SW_DWN; u2 = WS2M; G = 0). It is the FAO-recommended method when radiation, humidity and wind exist, and POWER provides all of them.
- Results, 2001–2025 mean (mm/yr):

| Farm | PM (POWER raw) | Hargreaves | PM (lapse-adjusted) | ERA5 FAO ET₀ (1991–2020) |
|---|---|---|---|---|
| Carumas | 1,506 | 1,202 | 1,701 | 1,549 |
| Samegua | 1,546 | 1,200 | 2,237 | 1,630 |
| El Algarrobal | 1,490 | 1,223 | 1,633 | 1,430 |

- **POWER-raw PM agrees with ERA5 within −5 % to +4 %** at all three points. Hargreaves is 18–26 % lower: it misses the strong wind/dryness effect in the high Andes and responds to temperature range only. Lapse-adjusting temperature without adjusting humidity inflates ET₀ by 10–45 %.
- **Use PM on raw POWER for ET₀**, with ERA5 as the published cross-check (±5 %).
- At El Algarrobal, POWER RH2M is 70–76 % all year (coastal stratus), which keeps winter ET₀ low (80.5 mm in Jun).

### 3. Kc values and season calendars (defensible, with citations)
From FAO-56 Table 12 (Allen et al. 1998, https://www.fao.org/4/x0490e/x0490e0b.htm):
- Values used in the code: olive (40–60 % canopy) 0.65 / 0.70 / 0.70; alfalfa hay (averaged cutting) mid 0.95; potato 0.50 / 1.15 / 0.75 (stage lengths 25/30/45/30 d, Table 11).
- Values for the other crops (also FAO-56 Table 12, generic): maize silage 0.30 / 1.15 / 0.50; pea fresh 0.50 / 1.15 / 1.10; barley 0.30 / 1.15 / 0.25; bean dry 0.40 / 1.15 / 0.35; faba bean dry 0.50 / 1.15 / 0.30; quinoa: none in FAO-56 (use small-grain-like 0.30 / 1.10 / 0.40 **[ASSUMPTION]**, flag as low confidence); oat-vetch: average of small grain and legume **[ASSUMPTION]**; tarwi (Lupinus mutabilis): none in FAO-56, use generic legume **[ASSUMPTION]**.
- **Calendars [ASSUMPTION]:**
  - Carumas rainfed potato: planted Nov, harvested Mar (monthly Kc Nov 0.50, Dec 0.83, Jan–Feb 1.15, Mar 0.75).
  - Olive: 0.65 Jun–Sep, 0.70 otherwise (southern-hemisphere mapping).
  - Samegua rotation used for the evidence files: forage maize Oct–Jan + pea Apr–Jul + fallow.
  - These match the general Andean pattern (sow with the Dec–Mar rains) but are **not** from a Peruvian source. No INIA/MIDAGRI calendar was retrieved in this run. Ask the Agencia Agraria Moquegua to confirm.
- Effective rain uses the FAO/AGLW (CROPWAT) formula: 0.8P − 25 if P > 75 mm/month, else max(0.6P − 10, 0).
- Irrigation efficiencies: Brouwer et al. 1989 (FAO Training Manual 4): surface 60 %, sprinkler 75 %, drip 90 %.

Resulting crop water need (POWER 2001–2025):
- Carumas potato season: ETc 550 mm; effective rain (POWER) only ~18 mm, so the deficit is 531 mm. POWER under-reads rain there (see Q6), so the true deficit is smaller.
- Samegua alfalfa: ETc 1,468 mm/yr → 24,470 m³/ha/yr applied by gravity.
- El Algarrobal olive: ETc 1,024 mm/yr = 10,240 m³/ha/yr → 17,070 m³/ha/yr applied by gravity.

### 4. HLS vs MODIS at 1–2 ha plots; cloud-free coverage; "bare" thresholds
- CMR granule counts 2019-01-01 to 2026-11-13 (`data/raw/cmr_granule_counts.json`). The ≤20 % cloud filter uses scene-level cloud cover:

| Farm | HLS S30 (≤20 % cloud) | HLS L30 (≤20 % cloud) |
|---|---|---|
| Carumas | 1,198 (455) | 297 (76) |
| Samegua | 2,342 (1,009) | 537 (194) |
| El Algarrobal | 1,158 (198) | 527 (88) |

- That is roughly 5+ clear scenes a month in the valley and highlands. The coast has fewer because of winter stratus.
- **Monthly NDVI from HLS 2019–2026 is feasible.** This run read the 2024-01 → 2026-11 scenes with ≤ 50 % cloud and applied a per-pixel Fmask (cloud, adjacent, shadow, snow, water). Per-farm clear-scene counts and monthly NDVI are in `data/raw/hls_ndvi_points.csv` and `ceres-nasa-data.js → ndvi_hls` (see the HLS addendum at the end).
- **MODIS MOD13Q1** (250 m ≈ 6 ha pixel, 2001–2026, 592–593 good composites per farm): Carumas monthly NDVI 0.38–0.70 (peak Mar 0.704); Samegua 0.21–0.25; El Algarrobal 0.15–0.19.
  - The flat 0.18–0.25 values at Samegua and El Algarrobal mean the 250 m pixel is mostly bare desert or valley edge. MODIS cannot see a 1–2 ha field there. HLS 30 m is required.
  - SRTM slope at the El Algarrobal point is 30° (30 m). The point is probably on the valley wall, not the olive grove. **Move the farm points onto real fields.**
- Bare threshold: keep NDVI < 0.25 for "bare/fallow" and > 0.35 for "green" (the app's existing thresholds). They are consistent with common practice: bare soil is typically 0.1–0.2 and irrigated crops > 0.4.
  - Require ≥ 2 clear scenes in a month before calling it bare.
  - Never call a month bare when it has no clear scene.

### 5. ECOSTRESS availability and the honest claim
- Granules read directly from LP DAAC (ECO_L3T_JET v002 `ETdaily`, 70 m), 2019 → 2026-10-20 (`data/raw/ecostress_jet_points.csv`):

| Farm | Overpasses (tile reads) | Valid pixels |
|---|---|---|
| Carumas | 481 | 203 |
| Samegua | 808 | 410 |
| El Algarrobal | 720 | 299 |

  Each valid year has 8–107 valid overpasses. The rest are clouded or no-data. Some overpasses appear twice because adjacent tiles overlap.
- Mean ETdaily by month at the pixel:
  - El Algarrobal: 0.41 (Aug) to 1.86 (Dec) mm/day. The FAO-56 olive ETc there is 1.7–3.7 mm/day.
  - Samegua: 0.26 (Jul) to 1.43 (Feb) mm/day, far below irrigated alfalfa (~3.5–4.5 mm/day).
- **Honest claim:** "ECOSTRESS (70 m) at our map point shows actual ET well below what a fully irrigated olive grove / alfalfa field would use. The point is likely on mixed or desert land. We use ECOSTRESS to check plant water use once the point is moved onto the field."
- **Do not** say "ECOSTRESS shows your grove uses more than the valley average". No valley statistic was computed, and the pixel data contradicts it.
- Best product: **L3T JET (ETdaily)** for water use. L4T ESI (479–808 granules in CMR) is a stress *ratio*, useful later for "when not to cut" in deficit irrigation. ESI was not pulled in this run.

### 6. Carumas: IMERG accuracy, ≥20 mm/day threshold, SMAP at 3,000 m
- **IMERG could not be pulled:** GES DISC returns 403 "EULA Acceptance Failure" for this Earthdata account. Chris has to approve the GES DISC app once in his EDL profile.
- Rainfall from the three no-login sources disagrees widely at Carumas (1991–2020 mean):
  - CHIRPS v3: **230 mm/yr**
  - NASA POWER: 124 mm/yr
  - ERA5: 775 mm/yr
- Satellite and reanalysis rainfall in the high Andes is known to be uncertain. ERA5 is commonly reported as too wet over the Andes, but that is general literature, not verified here.
- Show rain as a range. Use CHIRPS (station-blended) for SPI. Validate against a SENAMHI station (Carumas or Ubinas) if one can be obtained.
- **≥20 mm/day threshold:** with ~230 mm/yr concentrated in Dec–Mar, daily totals ≥ 20 mm are rare. The POWER daily record (after QC) has a 1981–2025 maximum of 43 mm/day.
  - On IMERG's 0.1° grid, ≥20 mm days will be a handful per year at most.
  - Use it as an "intense rain on bare, sloped soil" flag (SRTM slope at the point: 16° at 30 m, 13° at 90 m). Don't treat it as a calibrated erosion model.
  - Recompute the count once IMERG is unlocked.
- **SMAP:** 9 km EASE-2 cells average mountain slopes and valleys, so treat SMAP as a regional anomaly signal only. Status:
  - CMR lists 2,799 SPL3SMP_E granules (2019–2026).
  - Each granule is ~620 MB, so the pipeline uses NASA Harmony variable/bbox subsetting (`data/earthdata/smap_harmony.py`). Results are in `data/raw/smap_carumas.csv` (SMAP addendum at the end).
  - Expect gaps from frozen soil, dense-vegetation flags and complex-terrain retrieval flags.

### 7. GRACE-FO for the Osmore/Tambo basin
- Not pulled in this run.
- GRACE/GRACE-FO mascons have an effective resolution of ~300 km (JPL mascons are 3° native, gridded at 0.5°). The Osmore basin (~3,500 km²) and the Tambo basin (~13,000 km²) are far smaller than one mascon.
- Present GRACE-FO **only as macro-regional context** ("southern Peruvian Andes water storage trend"), never as a basin or farm value.

### 8. Engine calibration: criteria, 40/25/25/10 weights, uncertainty sources
- The criteria (water, soil, income, resilience) are reasonable and transparent. The weights are a **value choice, not a science result**. Keep them user-adjustable (the app already does this) and show how rankings change.
- At El Algarrobal with real water numbers, **drip + strip cover wins under the defaults (0.947 vs deficit 0.824)**. It also wins unless water is weighted ~100 % (see Q9).
- Uncertainty: the old fixture's "crop model = 97 % of water variance" is from the synthetic engine and can't be checked. The missing `earth_oracle` source is not in the repo.
- What can be measured now: real interannual ET₀ variability (POWER 2001–2025) moves strategy water by only about ±3 % (drip P10–P90: 12,510–13,170 m³/ha). The dominant uncertainties are:
  1. **irrigation efficiency** (gravity 0.5 vs 0.6 changes "current" by 20 %)
  2. **Kc / canopy cover** (olive Kc 0.55–0.70 at lower cover changes ETc by about 20 %)
  3. **farm location** (the pixel issue in Q4/Q5)

  Climate variability ranks fourth. Say this in the uncertainty panel.

### 9. El Algarrobal: when does deficit beat drip + strip cover? Is a winter legume cover realistic?
- Real water numbers (m³/ha/yr, POWER ET₀ × FAO-56 Kc / FAO efficiencies):

| Strategy | m³/ha/yr | vs today |
|---|---|---|
| current (gravity) | 17,070 | — |
| deficit (RDI 75 %, gravity) | 12,800 | −25.0 % |
| cover | 20,210 | +18.4 % |
| drip + strip cover | 12,890 | −24.5 % |
| drip alone | 11,380 | −33.3 % |

- Engine water scores: deficit 1.000, drip 0.993. Drip leads on soil (0.81 vs 0.41), income (1.00 vs 0.905) and resilience (0.97 vs 0.955).
  - With soil, income and resilience weights summing to s, deficit wins only if 0.007·w_water > 0.40·w_soil + 0.095·w_income + 0.015·w_res.
  - In practice that means **water ≈ 100 % and everything else ≈ 0**. Even then the two tie within 0.7 %.
- **Recommendation: drip + strip cover (12,890 m³/ha/yr)** as the one answer everywhere. Mention "drip + regulated deficit" as the next step for maximum water saving: 0.75 × 11,380 ≈ 8,540 m³/ha/yr by the same method **[ASSUMPTION RDI 75 %]**.
- **Winter legume cover realism:** CHIRPS rainfall at the point is 26.5 mm/yr (1991–2020; Dec–Mar 2025-26 = 15 mm). POWER RH is 70–76 %, but fog-fed lomas vegetation grows on coastal hills (~200–1,000 m) facing the sea, not on an irrigated valley floor.
  - **A cover crop there will only grow if irrigated.** That is why "cover" uses more water (+18 %) and why the recommended option confines cover to drip/micro-sprinkler strips (30 % of ground, May–Sep **[ASSUMPTION]**).
  - Label the soil benefit as "agronomic expectation, not measured".

### 10. Soil data for Moquegua (SoilGrids null) and salinity labeling
- Not pulled in this run. Alternatives, in order:
  1. INIA / MIDAGRI soil studies for the Moquegua and Ilo valleys (e.g. the "Estudio de suelos" of the Proyecto Especial Regional Pasto Grande, if obtainable from the regional government).
  2. FAO HWSD v2.0 (1 km, global; coarse but never null).
  3. ISRIC WoSIS soil profile points, if any are near.
  (IGAC is Colombian and not applicable.)
- Salinity: without EC measurements, label it **"riesgo de salinidad (inferido: clima hiperárido + riego por gravedad + sin lluvia de lavado), no medido"**. The physical basis: CHIRPS ~27 mm/yr and ET₀ 1,430–1,490 mm/yr give an aridity index P/ET₀ ≈ 0.02 (hyper-arid < 0.05, UNEP).
- Recommend one field EC test via the Agencia Agraria.

### 11. REGION_FACTS sanity check (fetched today)
- **"S/ 21 M lost in the 2016 drought; over half of El Algarrobal's olives died."**
  - ProActivo, 01/12/2016: the regional agriculture manager Marco Portocarrera said S/ 21 million was lost (harvests lost plus land left uncultivated), and that in El Algarrobal "se perdió más del 50 % de plantaciones de olivo".
  - ✅ Supported. Suggested wording: "over 50 % of olive plantations were lost". The source does not say that "the trees died".
- **"700,000 m³ of highland recharge from 30 qochas (Fondo Sierra Azul, 2026)."**
  - Agraria.pe, 03/06/2026: Midagri / Fondo Sierra Azul, 30 qochas, "una recarga hídrica superior a los 700 mil metros cúbicos", more than S/ 7.5 M, more than 290 families. Only 10 qochas were finished (Ichuña, Lloque); 20 were under construction, including 7 in Carumas adding more than 167,000 m³ to the Coralaque sub-basin.
  - ✅ Supported. Add "planned; 10 of 30 delivered by June 2026".
- **"6.8 MMC/yr committed to farmland from Vizcachas (28 → 60 MMC)."**
  - Energiminas, 03/04/2024 (Anglo American): Vizcachas dam expanded from 28 to 60 MMC; "entrega de 6.8 MMC anuales para la ampliación de la frontera agrícola en Moquegua".
  - ✅ Supported. Note it is for *expanding* farmland and that the figure is the company's statement.
- MERESE / El Búho: not checked in this run.

### 12. Re-scoping feasibility tests to the three Moquegua points (replaces the Medellín tests)
| Test | Result at the Moquegua points |
|---|---|
| NASA POWER daily, AG community, no login | ✅ 1981-01-01 → 2026-11-11 (radiation from 1984). First run failed with **HTTP 422 because `EVPTRANS` is not a valid POWER parameter**; fixed |
| MODIS MOD13Q1 via ORNL web service, no login | ✅ 594 composites per farm, 2001 → 2026-10-16 |
| SRTM via OpenTopoData, no login | ✅ elevation + slope for all 3 |
| CHIRPS v3 COGs, no login | ✅ 1981-01 → 2026-10 |
| ERA5 / ERA5-Land via Open-Meteo, no login | ✅ 1981 → 2026-11 (CDS itself needs a login) |
| CMR granule search, no login | ✅ counts in Q4/Q5 |
| Earthdata token: LP DAAC (HLS, ECOSTRESS) | ✅ validated with a real ranged download (TIFF header returned); pulled |
| Earthdata token: NSIDC (SMAP) | ✅ validated (HDF5 header returned); pulled via Harmony |
| Earthdata token: GES DISC (IMERG) | ❌ 403 EULA Acceptance Failure: Chris must approve the GES DISC app |
| AppEEARS with EDL token | ❌ 403: AppEEARS needs username/password login (`appeears_submit.py` is ready) |

---

## Other findings Apollo should know
- **Spurious POWER rainfall spike on 2022-09-12/13** (260 mm and 55–70 mm/day at every point, while CHIRPS shows ~1.5–3 mm for the whole month). Without QC it made 2022 the "wettest year" at El Algarrobal (401 mm). It is now removed in all outputs and logged.
- **ENSO (Dec–Apr windows, vs 1991–2020):**
  - Carumas CHIRPS rainfall: 1982-83 El Niño 13 mm vs 204 mm normal; 2015-16 104 mm; 2023-24 170 mm. La Niña 1998-99 had 331 mm and 2010-11 289 mm.
  - So **El Niño = drier highlands, La Niña = wetter**: a strong local story for resilience.
  - The coast warms in El Niño: El Algarrobal Dec–Apr T2M anomaly +1.55 °C (1982-83), +1.31 °C (1997-98).
- **Warming:**
  - Carumas/Samegua POWER cell: +0.28 °C/decade (Sen slope 1981–2025, Mann-Kendall p < 0.001); frost days −10.4 per decade (p = 0.0001); ERA5-Land +0.34 °C/decade.
  - El Algarrobal: +0.08 °C/decade (not significant).
- **Last 12 months:**
  - El Algarrobal was +2.2 to +2.9 °C above the 2001–2020 mean from Jul to Oct 2026 (POWER).
  - Carumas Oct 2026 was +3.6 °C.
  - Worth one CERES sentence, labeled "preliminary reanalysis".
