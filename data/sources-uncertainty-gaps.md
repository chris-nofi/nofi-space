# Sources, uncertainty and information gaps: Ceres Ventures, Moquegua (Peru)

Generated 2026-11-14 (America/Bogota) by `data/partner/*.py`, `data/pull_and_build.py`, `data/historical/*`, `data/earthdata/*`.
Every number in the app and in `avalanche/oracle/evidence/*.json` traces back to a file listed here. **NASA** means a NASA dataset. **Partner** means ESA/Copernicus. **NON-NASA** means another provider.

Farms and points used:
| farm | app point (lat, lon) | field point used for NDVI / soil / slope | why |
|---|---|---|---|
| Carumas (potato/fava, ~3,150 m) | -16.81, -70.69 | same | the app point is on cropland (HLS NDVI 0.33–0.63) |
| Samegua (avocado, ~1,560 m) | app point | -17.17996, -70.90147 (150 m away) | the app point is bare ground (HLS 0.05); this is the nearest HLS pixel with NDVI ≥ 0.5 |
| El Algarrobal (olive, ~110 m) | app point | -17.6155, -71.2588 (532 m away) | the app point is desert (HLS 0.06); this is the nearest green pixel. **The farmer must confirm the field location.** |

## 1. Source register

| layer | dataset | provider / label | resolution | period | access | file |
|---|---|---|---|---|---|---|
| Climate, ET0 | NASA POWER daily AG (T2M, Tmin/Tmax, RH, WS2M, ALLSKY SW, PRECTOTCORR) | NASA | 0.5° × 0.625° (MERRA-2); radiation from 1984 | 1981-01-01 → latest | no login | `historical/<farm>_power_daily_1981_present.csv` |
| Rainfall (monthly) | CHIRPS v3.0 monthly COG | NON-NASA (UCSB CHC) | 0.05° | 1981 → 2026-10 | no login | `raw/chirps_v3_monthly_points.csv` |
| Rainfall (daily, IMERG) | GPM IMERG Final Daily v07 | NASA | 0.1° | n/a | **blocked**: GES DISC returns 403 "EULA Acceptance Failure" | none |
| Temperature cross-check / gap fill | ERA5-Land daily Tmin/Tmax via Open-Meteo archive API | NON-NASA (ECMWF; labelled "ERA5 via Open-Meteo") | 0.1° | 1981 → 2026-11-07 | no key | `raw/openmeteo_era5_land_<farm>.json` |
| Daily rain (2nd series) | ERA5 daily precipitation via Open-Meteo | NON-NASA | 0.25° | 1981 → 2026-11-07 | no key | `raw/openmeteo_era5_<farm>.json` (ERA5-Land precipitation comes back null at these points) |
| NDVI 250 m | MODIS MOD13Q1 v061 via ORNL DAAC | NASA | 250 m, 16-day | 2001 → present | no login | `out/<farm>_ndvi_mod13q1.csv` |
| NDVI 30 m | HLS L30/S30 v2.0 (Fmask cloud mask) | NASA | 30 m | 2024-01 → 2026-11 | Earthdata token | `raw/hls_ndvi_points.csv`, `raw/hls_ndvi_fieldpx.csv` |
| NDVI 10 m | Sentinel-2 L2A COGs, Element84 Earth Search STAC v1 | **Partner (ESA/Copernicus)** | 10 m | 2024-01-01 → 2026-11-13 | no login | `raw/s2_ndvi_points.csv` |
| ET (actual) | ECOSTRESS L3T JET v002 | NASA | 70 m | 2024 → 2026 | Earthdata token | `raw/ecostress_jet_points.csv`, `raw/ecostress_jet_fieldpx.csv` |
| Soil moisture | SMAP L3 SPL3SMP_E v006 (Harmony subset) | NASA | 9 km | 2015 → 2026 | Earthdata token | `raw/smap_carumas.csv` |
| Elevation, slope | SRTM GL1 v3 (30 m) via OpenTopoData | NASA | 30 m | static (2000) | no key | `raw/srtm_opentopodata.json`, `raw/srtm_slope_grid.json` |
| Soil 0–30 cm | SoilGrids 2.0 REST (clay, sand, silt, SOC, pH H2O, bulk density) | **NON-NASA (ISRIC)** | 250 m | static | no key | `out/soilgrids.json` |
| Synthesis | soil + cover + frost + slope + erosion | derived | | | | `out/risk_extensions.json` → `extensions` block in every evidence JSON |

## 2. New layers: headline numbers

### Soil (NON-NASA, SoilGrids 2.0, thickness-weighted mean of 0–30 cm, field point)
| farm | clay % | sand % | silt % | SOC g/kg | pH H2O | bulk density g/cm³ | texture class |
|---|---|---|---|---|---|---|---|
| Carumas | 15.9 | 58.3 | 25.8 | 17.8 | 7.18 | 1.16 | sandy loam |
| Samegua | 13.9 | 62.3 | 23.8 | 12.6 | 7.93 | 1.27 | sandy loam |
| El Algarrobal | 14.2 | 66.5 | 19.4 | 25.7 | 7.80 | 1.31 | sandy loam |
All five points (three app points and two field pixels) returned valid pixels on the first query, so no nearest-pixel search was needed (`offset_m = 0`). Unlike the Colombian points tried earlier, nothing came back empty here. **Uncertainty:** SoilGrids is a global ML model with few Peruvian training profiles. An SOC of 25.7 g/kg at a hyper-arid coastal olive grove is implausibly high (desert soils are usually < 10 g/kg) and should be treated as unverified. pH and texture are more trustworthy.

**INIA / Peru:** INIA published "¿Qué tan fértiles son los suelos agrícolas de Moquegua?" (Quispe-Matos et al., 2026-08). It covers 2,053 georeferenced samples with pH, P, K, EC, organic matter and texture, plus an interactive map: https://repositorio.inia.gob.pe/items/53633680-5a7c-41b5-ad62-d9b4a71c3a18. **No machine-readable grid or point table could be downloaded:** the DSpace API returned non-JSON. This is the best path to replace SoilGrids. Ask INIA EEA Moquegua for the sample points near the three farms. INGEMMET also publishes 1:50,000 soil maps (Serie Q, Medio Tambo, .mpk), and IGP has an urban SUCS map for Moquegua district. Neither covers the farms at field scale.

### Cover: Sentinel-2 10 m NDVI (Partner) and bare-field months
Method: monthly median of SCL-masked S2 L2A NDVI. Kept SCL classes are 4 (vegetation), 5 (bare) and 6 (water). Dropped classes are 0–3, 7 (unclassified) and 8–11 (cloud, cirrus, snow). The period is 2024-01 → 2026-11, with HLS filling months that have no S2. **Bare = median NDVI < 0.20.** A month is **vulnerable** if it meets at least two of: bare; rainy (≥ 10 % of annual ERA5 rain, 1991–2020); frosty (≥ 5 days with Tmin < 2 °C in the preferred frost series).
Earth Search v1 COGs already have the L2A +1000 BOA offset removed. The raw DN check confirms this (Samegua red DN minimum = 1), so reflectance = DN/10000.

| farm | clear S2 obs | S2 NDVI median Jan…Dec | bare months | vulnerable months |
|---|---|---|---|---|
| Carumas | 423 / 457 | 0.19 0.39 0.55 0.48 0.35 0.27 0.23 0.21 0.18 0.17 0.17 0.17 | **Sep–Jan** (fallow before planting) | **Dec, Jan**: bare soil as the rains start (ERA5 days > 10 mm: Dec 1.3, Jan 7.5, Feb 8.8). Highest erosion window. |
| Samegua (field px) | 743 / 791 | 0.57–0.68 all year | none | none |
| El Algarrobal (field px) | 191 / 226 | 0.25–0.36 all year | none at 0.20, but values sit close to it: open olive canopy over bare inter-rows | none (no rain, no frost) |

Cross-sensor: at Carumas, HLS 30 m runs about 0.10–0.15 higher than S2 10 m and MODIS 250 m about 0.2 higher. Both average in neighbouring vegetated fields. Absolute thresholds are therefore **sensor-specific**. Only the S2 series feeds the bare-month rule.

### Frost (Tmin < 0 °C and < 2 °C, days, 1991–2020 climatology)
| farm | preferred series | why | < 0 °C d/yr | < 2 °C d/yr | worst months (< 2 °C) | raw POWER < 0 °C d/yr | ERA5-Land < 0 °C d/yr |
|---|---|---|---|---|---|---|---|
| Carumas | POWER + 4.55 °C lapse shift | POWER cell ~700 m above the farm; the lapse-adjusted series matches ERA5-Land | 0.0 | 24.3 | Jul 5.4, Aug 4.1, Jun 3.7, Sep 3.4 | 154.2 (cell at 3,851 m) | 1.7 (< 2 °C: 12.2) |
| Samegua | ERA5-Land | shares the Carumas POWER cell, which is 2,275 m higher | 0 | 0 | none | 154.2 (wrong cell) | 0 |
| El Algarrobal | raw POWER | coastal inversion | 0 | 0 | none | 0 | 0 |
Recent Carumas years (lapse-adjusted, days < 2 °C): 2021: 13, 2022: 35, 2023: 3, 2024: 10, 2025: 4, 2026 (to Nov 10): 4. Coldest Tmin 0.8 °C (2022). **Uncertainty:** grid Tmin cannot resolve cold-air pooling on valley floors, so local frost on Carumas terraces is probably under-counted. A cheap in-field Tmin logger would close this gap.

### Slope (NASA SRTM GL1 30 m, Horn 3×3 on a 5×5 grid at 30 m spacing, field point)
| farm | slope at centre ° (%) | mean over 90 × 90 m ° | max ° | elevation m |
|---|---|---|---|---|
| Carumas | 16.2 (29.1 %) | 15.9 | 18.1 | 3,151 |
| Samegua | 6.3 (11.0 %) | 5.5 | 6.7 | 1,558 |
| El Algarrobal | 7.9 (13.9 %) | 8.4 | 19.4 | 112 |
**Uncertainty:** SRTM is a 2000-era surface model. Terraces (Carumas) are smaller than 30 m and get smoothed into a single hillslope, so the real per-terrace slope is lower and the riser slope higher. At El Algarrobal the window touches the valley wall (max 19.4°).

### Erosion-risk proxy (relative, unitless, not a soil-loss estimate)
Method: `tan(mean slope over 90 m window) × (a) mean annual days > 10 mm` and `× (b) mean rain on days above the wet-day (≥ 1 mm) P95`, for 2001–2025. **IMERG was requested but is blocked** (EULA). Two substitutes are reported side by side:
| farm | POWER days > 10 mm/yr | ERA5 days > 10 mm/yr | POWER P95 intensity mm | ERA5 P95 intensity mm | proxy (a) POWER / ERA5 | proxy (b) POWER / ERA5 |
|---|---|---|---|---|---|---|
| Carumas | 0.6 | 23.7 | 11.3 | 19.0 | 0.17 / 6.76 | 3.21 / 5.42 |
| Samegua | 0.6 | 3.4 | 11.3 | 15.0 | 0.06 / 0.33 | 1.08 / 1.45 |
| El Algarrobal | 0.2 | 0.08 | 10.5 | 8.6 | 0.03 / 0.01 | 1.54 / 1.27 |
Both substitutes give the same ranking: **Carumas ≫ Samegua > El Algarrobal**, with Carumas risk concentrated in Dec–Mar. The absolute counts differ by about 40× because POWER/MERRA-2 drizzles (it spreads rain over many light days) and ERA5 is known to be too wet over the western Andes: its annual total at Carumas is ~820 mm against CHIRPS ~230 mm. The real number lies between them. IMERG (0.1°, half-hourly) would be the arbiter once the EULA is accepted.

## 3. Uncertainty summary (by layer)
| layer | main uncertainty | size | how it is shown |
|---|---|---|---|
| ET0 (POWER PM) | cell elevation and radiation; Samegua/Carumas share a cell | raw POWER ET0 within ±5 % of ERA5 ET0; water-use P10–P90 from year-to-year ET0 ±4–6 % | `water` P10/P50/P90 bands in `si-data.js` |
| Rainfall | sources disagree about 6× at Carumas (POWER 124, CHIRPS 230, ERA5 775 mm/yr) | very large | CHIRPS used as primary, others listed; no single "true" value |
| Frost | grid vs. valley-floor cold pooling; raw POWER at Carumas/Samegua is unusable without the lapse shift | a few days to weeks per year | three series stored, preferred one flagged |
| NDVI | sensor scale (10/30/250 m) and field-point placement | 0.1–0.2 NDVI between sensors | sensor named in every field; thresholds per sensor |
| ECOSTRESS ET | 1–3 clear overpasses per month, mean × days | ±30–50 % monthly | `stat` and granule list in evidence |
| SMAP | 9 km footprint, mostly puna/hillside | regional only | flagged "regional signal" |
| Soil | global ML model, few local profiles | SOC especially; ISRIC 0–5 cm uncertainty stored | labelled NON-NASA, unverified |
| Slope / erosion | 30 m DEM vs. terraces; substitute rain | relative ranking only | proxy named "relative, unitless" |

## 4. Information gaps and what closes each one
1. **GPM IMERG blocked** (403 EULA Acceptance Failure). Fix: log in at urs.earthdata.nasa.gov, approve the "NASA GESDISC DATA ARCHIVE" application and accept its EULA, then rerun `data/earthdata/earthdata_pull.py imerg`. This would replace CHIRPS in `precip_mm` and the substitutes in the erosion proxy.
2. **AppEEARS** rejects EDL bearer tokens and needs username/password. Not needed now: direct COG pulls replaced it.
3. **Field locations are unconfirmed** for Samegua and El Algarrobal. The green-pixel choice (150 m and 532 m from the app points) must be confirmed by the farmer or with a GPS polygon.
4. **Field-pixel HLS/ECOSTRESS: PENDING/PARTIAL** as of 2026-11-14 02:35 (UTC-5). `data/earthdata/field_pixels_pull.py` was still running (HLS ~400/1035 granules, ECOSTRESS ~800/1528). Evidence JSONs carry `extensions.fieldPixelStatus = "PENDING/PARTIAL"` and `ceres-nasa-data.js` carries `field_pixel_status`. When the run finishes, rerun `data/partner/risk_build.py && data/build_evidence.py && data/bundle_site_data.py`. Until `raw/hls_ndvi_fieldpx.csv` exists, the evidence `ndvi`/`et_mm` for Samegua and El Algarrobal use the bare app point. Those values are low (~0.05) and do not represent the crop.
5. **Soil ground truth**: INIA 2026 Moquegua fertility dataset (2,053 samples) is not downloadable; request it from INIA EEA Moquegua.
6. **Irrigation volumes and crop calendar** are not observed. The water-saved numbers are modelled (ET0 × Kc ÷ efficiency), and real meter/turno data from the Junta de Usuarios Moquegua would calibrate them.
7. **Yield / income**: no satellite data; the engine's income and soil scores are still example values.
8. **GRACE-FO** is too coarse (~300 km) for farm decisions, so it was not used.
9. **Frost microclimate**: no station near Carumas in POWER or ERA5. SENAMHI Carumas or Ubinas station data, or an on-farm logger, would close it.
