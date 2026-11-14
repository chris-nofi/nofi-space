# CONNECT-REAL-DATA.md: wiring real NASA data into Ceres Ventures

**Audience:** Claude (coding agent) working on the Ceres Ventures app in `/workspace/ceres-ai/` (deployed site: gleaming-sunflower-16cdde.netlify.app).
**Author:** Kepler (data/science agent), 2026-11-14 (UTC-5).
**Rules for you:**
- Never type a number into the UI by hand. Every number comes from a file listed below.
- Never present a modeled value as an observation. Use the `dataset` / `stat` / `reason` fields that come with each value.
- Do not sign, deploy or send any chain transaction. Do not submit anything to Space Apps.
- Keep a backup of any app file before you edit it (`cp app.js app.js.bak-YYYYMMDD-HHMM`).

---

## 0. TL;DR (do these in order)
1. Copy `data/out/ceres-nasa-data.js` into `/workspace/ceres-ai/` and add `<script src="./ceres-nasa-data.js" defer></script>` **before** `si-data.js` in `index.html`.
2. Apply the El Algarrobal fix: copy `data/patched/ceres-ai/app.js` and `data/patched/ceres-ai/si-data.js` over the originals, after backing them up. Review the diff first: `data/patched/algarrobal-fix.diff`. If someone has edited `app.js` since, re-run `node data/fix/apply_algarrobal_fix.mjs --app /workspace/ceres-ai` instead. It regenerates the patch against the current files.
3. Replace the unbacked "ECOSTRESS shows… / HLS shows…" strings (list in §4) with sentences generated from `window.CERES_NASA_DATA`.
4. Add a dataset/date/grid citation under every chart and card (strings in §7).
5. Set `dataQuality.climate` / `confidence` labels as described in §4.4. Then run the checklist in §9.

---

## 1. Farm points (single source)
Coordinates come from `/workspace/ceres-ai/app.js` `DB.FARMS`. They are **illustrative points**, not surveyed field boundaries.

| id | lat | lon | app elev (m) | SRTM 30 m elev (m) | POWER grid-cell elev (m) | SRTM slope 30 m / 90 m (°) |
|---|---|---|---|---|---|---|
| carumas | −16.81 | −70.69 | 3000 | 3151 | 3851 | 16.2 / 12.7 |
| samegua | −17.18 | −70.90 | 1550 | 1575 | **3851 (same POWER cell as Carumas)** | 4.6 / 5.2 |
| algarrobal | −17.62 | −71.26 | 150 | 162 | 720 | **30.1 / 22.6** (valley wall?) |

⚠ At the Samegua and El Algarrobal points, MODIS NDVI is ~0.17–0.25 all year and ECOSTRESS ET is low. The points probably sit on desert or mixed pixels, not on an irrigated alfalfa field or olive grove. If the team can get a real field location (a farmer, or a click on an HLS NDVI map), update `FARMS` in `data/pull_and_build.py` **and** `app.js`, then rerun (§6).

---

## 2. File inventory and schemas
All paths are relative to `/workspace/space-apps-2026/`. Dates are ISO. Units are in the column names or listed below.

### 2.1 Browser bundle (what the app should load)
**`data/out/ceres-nasa-data.js`** sets `window.CERES_NASA_DATA`. The same content is in `data/out/ceres-site-data.json` (~35 KB).
```jsonc
{
  "generated": "2026-11-14T…",
  "sources": { "power": "…", "modis": "…", "hls": "…", "ecostress": "…", "smap": "…", "srtm": "…", "chirps": "…", "era5": "…" },
  "farms": {
    "algarrobal": {
      "point": { "lat": -17.62, "lon": -71.26, "app_js_m": 150, "srtm30m_m": 162, "power_grid_cell_m": 720.4, "lapse_shift_degC": 3.63, "slope_deg_30m": 30.1, "slope_deg_90m": 22.6 },
      "climate": {
        "period": "1984-01-01..2026-11-09",
        "climatology_2001_2025": { "t2m_monthly":[12], "tmax_monthly":[12], "tmin_monthly":[12], "precip_mm_monthly":[12], "precip_mm_yr": 50.5,
                                   "rs_mj_m2_day_monthly":[12], "rh2m_monthly":[12], "ws2m_monthly":[12] },
        "climatology_1991_2020": { "t2m_ann": 18.28, "precip_mm_yr": 51.8, "chirps_mm_yr": 26.5, "frost_days_yr": 0 },
        "trends": { "t2m": { "sen_per_decade": 0.078, "mann_kendall_p": 0.197, … }, "tmin": {…}, "precip_mm": {…}, "chirps_mm": {…}, … },
        "extremes": { "hottest_year": {"year":2023,"t2m":19.45}, … },
        "enso_dec_apr": { "1997-98 El Nino": { "dec_apr_t2m_anom": 1.31, "dec_apr_chirps_mm": 14.1, "base_chirps_mm": 18.1, … }, … },
        "cross_checks": { "power_vs_chirps_precip_1991_2020_mm_yr": [51.8, 26.5], "power_vs_era5land_t2m_1991_2020": [18.28, 18.94], … },
        "era5_et0_mm_yr_1991_2020": 1430.1,
        "last12_anomaly": [ { "month": "2026-10", "t2m": …, "t2m_anom": 2.61, "precip_mm": 3.8, "et0_mm": …, "et0_anom_mm": … }, … ]
      },
      "et0": { "power_raw": { "et0_pm_mm_yr": 1490, "et0_pm_monthly_mm":[12], "et0_pm_monthly_mm_day":[12], "et0_hargreaves_mm_yr": 1223,
                              "frost_days_tmin_lt0": 0, "heat_days_tmax_gt30": 0, "gdd_base10_per_year": 3331, "gdd_base10_monthly":[12], … },
               "site_lapse_adjusted": { …same keys… } },
      "crop_water": { "crop":"olive", "kc_monthly":[12], "etc_mm_monthly":[12], "etc_mm_yr": 1024.1, "eff_rain_mm_monthly":[12],
                      "net_irrigation_mm_yr": 1024.1, "net_irrigation_m3_ha_yr": 10241, "gross_m3_ha_yr": {"gravity":17068,"sprinkler":13654,"drip":11379} },
      "strategies_recomputed": { "current": {"m3_ha_yr":17070,"monthly":[12],"pct_vs_current":0}, "deficit": {…}, "cover": {…}, "drip": {…}, "drip_no_cover": {…}, "assumptions": {…} },
      "ndvi_modis": { "ndvi_monthly_mean":[12], "ndvi_monthly_std":[12], "evi_monthly_mean":[12], "bare_months_climatology": 12, "latest": {"date":"2026-10-16","ndvi":0.179}, "source": "…" },
      "ndvi_hls":   { "monthly_mean":[12 or null], "n_clear":[12], "total_clear": N, "first": "2024-…", "last": "2026-…", "latest": {…} },
      "et_ecostress": { "et_daily_mm_monthly_mean":[12], "n_overpasses":[12], "total_valid": N, "total_read": N, "first": "…", "last": "…" },
      "smap": { … only for carumas … },
      "qc": { "power_precip_days_removed": [ {"date":"2022-09-12","power_mm":261.5,"chirps_month_mm":1.6}, … ] },
      "evidence_files": [ "avalanche/oracle/evidence/algarrobal-202607.json", … ]
    },
    "carumas": { … }, "samegua": { … }
  }
}
```
Arrays marked `[12]` are calendar months Jan…Dec. A `null` means no valid observation that month. Show "no data", never 0.

### 2.2 Per-farm tables (for charts or the oracle backend)
| File | Columns | Units / notes | Range |
|---|---|---|---|
| `data/out/<farm>.json` | full per-farm result (superset of the bundle's climate/et0/crop_water/ndvi_modis) | see 2.1 | POWER 1984→2026-11-09 |
| `data/out/<farm>_daily.csv` | date, ET0_PM_power_raw, ET0_HG_power_raw, TMAX_power_raw, TMIN_power_raw, ET0_PM_site_lapse, ET0_HG_site_lapse, TMAX_site_lapse, TMIN_site_lapse, PRECTOTCORR, T2M, RH2M, WS2M, ALLSKY_SFC_SW_DWN, T2MDEW, GWETROOT | mm/day, °C, %, m/s, MJ m⁻² day⁻¹; PM = FAO-56 Penman-Monteith, HG = Hargreaves | 1984-01-01 → 2026-11-09 (needs radiation, which starts in 1984) |
| `data/out/<farm>_spi.csv` | month, precip_mm, spi3, spi6 | SPI from POWER precip (fit 2001–2020) | 1984-01 → 2026-10 |
| `data/out/<farm>_ndvi_mod13q1.csv` | date, ndvi | MODIS 250 m, QA pixel_reliability 0–1 | 2001-01-01 → 2026-10-16 |
| `data/historical/<farm>_power_daily_1981_present.csv` | date, T2M, T2M_MAX, T2M_MIN, T2MDEW, PRECTOTCORR, ALLSKY_SFC_SW_DWN, CLRSKY_SFC_SW_DWN, RH2M, WS2M, PS, QV2M, EVLAND, GWETROOT | raw POWER (radiation NaN before 1984) | 1981-01-01 → 2026-11-11 |
| `data/historical/<farm>_monthly_1981_present.csv` | month, t2m, tmax, tmin, precip_mm, frost_days_lt0, heat_days_gt30, tmin_abs, tmax_abs, precip_max_day, chirps_mm, era5land_t2m, era5land_precip_mm, era5_t2m, era5_precip_mm, era5_et0_mm | POWER precip QC'd (§5) | 1981-01 → 2026-10 |
| `data/historical/<farm>_annual_1981_present.csv` | year, t2m, tmax, tmin, precip_mm, chirps_mm, frost_days_lt0, heat_days_gt30, tmin_abs, tmax_abs, precip_max_day, era5_precip_mm, era5land_t2m | full years only | 1981 → 2025 |
| `data/historical/<farm>_climatology_1991_2020.csv` | month + same as monthly | WMO normal | 1991–2020 |
| `data/historical/<farm>_spi_chirps.csv` | month, chirps_mm, spi3, spi6 | SPI from CHIRPS (fit 1991–2020); dry-season months may be NaN by design | 1981-01 → 2026-10 |
| `data/historical/<farm>_historical_summary.json` | trends, extremes, ENSO windows, cross-checks, QC | | |
| `data/historical/summary_table.md` | one-line headline per farm | | |
| `data/raw/chirps_v3_monthly_points.csv` | month, carumas, samegua, algarrobal | mm/month | 1981-01 → 2026-10 |
| `data/raw/ecostress_jet_points.csv` | farm, datetime_utc, granule, et_daily_mm, error | mm/day, 70 m; empty value = cloud/no data | 2019 → 2026-10-20 |
| `data/raw/hls_ndvi_points.csv` | farm, date, sensor (HLSS30/HLSL30), granule, fmask, ndvi | ndvi empty when Fmask flags cloud/shadow/snow/water | 2024-01 → 2026-11 (scenes ≤ 50 % cloud) |
| `data/raw/smap_carumas.csv` | date, sm_am, box_mean, n_valid_box, granule | m³/m³, 9 km EASE-2 | 2015-04 → 2026-11 (if the Harmony jobs finished, see §6.2) |
| `data/raw/cmr_granule_counts.json` | granule counts per farm and product, 2019–2026 | metadata only | |
| `avalanche/oracle/evidence/<farm>-<YYYYMM>.json` | evidence records (§8) | | 202607–202610 |

### 2.3 Headline numbers (from the files above; quote them as written)
| | Carumas | Samegua | El Algarrobal |
|---|---|---|---|
| ET₀ FAO-56 PM, POWER 2001–2025 (mm/yr) | 1,506 | 1,546 | 1,490 |
| ET₀ ERA5 1991–2020 (cross-check, mm/yr) | 1,549 | 1,630 | 1,430 |
| Rain POWER 1991–2020 (mm/yr) | 123.7 | 123.7 (same cell) | 51.8 |
| Rain CHIRPS v3 1991–2020 (mm/yr) | 230.1 | 105.3 | 26.5 |
| T2M trend 1981–2025, POWER (°C/decade, Sen; MK p) | +0.28 (p<0.001) | same cell | +0.08 (p=0.20) |
| Frost days Tmin<0 °C: POWER cell / ERA5-Land 1991–2020 | 154 / 1.8 | 154 (cell at 3,851 m) / 0 | 0 / 0 |
| Crop water need (ETc, FAO-56 Kc) | potato season 550 mm | alfalfa 1,468 mm | olive 1,024 mm = 10,240 m³/ha |

---

## 3. How to load the data in the app
### 3.1 Script tag (static site, no backend)
In `/workspace/ceres-ai/index.html`, add this line **above** `<script src="./si-data.js" defer></script>`:
```html
<script src="./ceres-nasa-data.js" defer></script>
```
Then copy the file: `cp /workspace/space-apps-2026/data/out/ceres-nasa-data.js /workspace/ceres-ai/`.

### 3.2 Access helper (put at the top of app.js, after `const DB = …`)
```js
const NASA = window.CERES_NASA_DATA || null;           // null => show "datos NASA no cargados"
const nasa = (farmId) => NASA?.farms?.[farmId] || null;
const DAYS = [31,28.25,31,30,31,30,31,31,30,31,30,31];
// monthly mm/day arrays for the existing chart(x.et, x.ref) component:
const et0Daily = (id) => nasa(id)?.et0.power_raw.et0_pm_monthly_mm_day;       // reference ET0
const etcDaily = (id) => nasa(id)?.crop_water.etc_mm_monthly.map((v,k)=>+(v/DAYS[k]).toFixed(2)); // crop ET (FAO-56)
const ecoDaily = (id) => nasa(id)?.et_ecostress?.et_daily_mm_monthly_mean;  // observed ET (may contain null)
const ndviHls  = (id) => nasa(id)?.ndvi_hls?.monthly_mean ?? nasa(id)?.ndvi_modis.ndvi_monthly_mean;
```
### 3.3 Replace synthetic fields at start-up (no hand-edited numbers)
```js
if (NASA) for (const f of DB.FARMS) {
  const n = nasa(f.id); if (!n) continue;
  f.et  = etcDaily(f.id);                       // was illustrative "et"
  f.ref = et0Daily(f.id);                       // was "valley median"
  f.refLabel = { es: "ET₀ de referencia (NASA POWER, FAO-56)", en: "Reference ET₀ (NASA POWER, FAO-56)" };
  f.rainYear = Math.round(n.climate.climatology_1991_2020.chirps_mm_yr);   // CHIRPS 1991–2020
  f.tminCold = Math.min(...n.climate.climatology_2001_2025.tmin_monthly); // POWER cell, see caveat
  f.confidence = { ...f.confidence, water: "modeled", ref: "measured" };
}
```
For the SI view (`si.js`), replace `FX[farm].seasons.observed.ndviMonthly` (currently a flat 0.458 at El Algarrobal) with `ndviHls(farm)`. Set `.source` to `"HLS v2.0 30 m (or MOD13Q1 250 m) monthly mean"` and recompute `bareMonths` with the existing threshold 0.25.

### 3.4 Oracle / CERES backend (Python)
```python
import json; d = json.load(open("/workspace/space-apps-2026/data/out/ceres-site-data.json"))
farm = d["farms"]["algarrobal"]
context = {
  "et0_mm_yr": farm["et0"]["power_raw"]["et0_pm_mm_yr"],
  "olive_need_m3_ha": farm["crop_water"]["net_irrigation_m3_ha_yr"],
  "gravity_m3_ha": farm["strategies_recomputed"]["current"]["m3_ha_yr"],
  "drip_strip_m3_ha": farm["strategies_recomputed"]["drip"]["m3_ha_yr"],
  "ecostress_overpasses": farm.get("et_ecostress", {}).get("total_valid"),
}
```
Put these values into the CERES prompt's `<<FARM_CONTEXT>>` (`oracle/scripts/retell_setup.py`), and run with `--dry-run` first. Do not run the live update without Chris's OK. It edits a live agent.

---

## 4. Synthetic or unbacked content to replace (file:line in `/workspace/ceres-ai`, as of 2026-11-13 22:40)
### 4.1 Data arrays
| Where | What it is now | Replace with |
|---|---|---|
| `app.js` FARMS[carumas] `et`/`ref` (~l.20–58) | illustrative | `etcDaily('carumas')`, `et0Daily('carumas')` |
| `app.js` FARMS[samegua] `et`/`ref` (~l.270–305) | illustrative | same (caveat: POWER cell at 3,851 m; ET₀ is within 5 % of ERA5, but temperature is not usable, see §5) |
| `app.js` FARMS[algarrobal] `et`/`ref` (l.507–534) | illustrative | **done in the patch** |
| `app.js` `rainYear` l.61 (342), l.307 (15), l.539 (5) | example | CHIRPS 1991–2020: 230 / 105 / 27 mm |
| `app.js` `BASIN.reservoirPct`, `storageCm` | "example" | keep the "example" label, or remove. No real reservoir series has been pulled (OPERA DSWx/GRACE-FO not done) |
| `si-data.js` every farm `seasons.observed.ndviMonthly` | "modeled from crop calendar" | `ndviHls(id)` |
| `si-data.js` every farm `dataQuality` | `"climate":"synthetic"` | algarrobal: done in the patch. Carumas/Samegua: their SI water numbers are still from the missing engine, so set `climate: "NASA POWER (inputs) – engine outputs not yet regenerated"` and keep confidence capped at "medium" |

### 4.2 Sentences that claim observations (rewrite or delete)
| app.js line | Current text (EN) | Status / replacement |
|---|---|---|
| 87–88 | "HLS shows bare soil about 7 months a year." (Carumas) | Use `ndvi_hls.monthly_mean`: count the months < 0.25. MODIS 2001–2026 gives **0** bare months at the Carumas pixel (lowest monthly mean 0.376). Change to the computed count. |
| 201–215 | "HLS · NDVI > 0.4 in Jan–Feb", "> 0.25 May–Sep" | Compute from `ndvi_hls` and set `result` from the data |
| 241 | "SMAP + ECOSTRESS · regional, low confidence" | OK as a label; add counts (`et_ecostress.total_valid`, `smap.total_valid`) |
| 333 | "ECOSTRESS: highest use of the three plots." (Samegua) | **False with real data**: Samegua has the lowest mean ECOSTRESS ET of the three points (0.26–1.43 mm/day by month). Delete it, or rewrite after moving the point onto a real field |
| 447, 460, 473 | HLS/ECOSTRESS checks | Generate from data, or mark "pendiente" |
| 542–543 | "ECOSTRESS shows your grove uses more than the valley average in summer." | **Replaced in the patch** with a POWER-based sentence |
| 565 | "ECOSTRESS: use above valley median Dec–Mar." | No valley median was computed. Delete it, or use "ECOSTRESS ET at this pixel: X mm/day in Dec–Mar (N overpasses)" from `et_ecostress` |
| 584, 596, 626 | strategy text naming ECOSTRESS | OK as *method* descriptions ("would be guided by…"); not observations |
| 679, 692 | "HLS · NDVI stable", "ECOSTRESS ESI · normal range" | ESI was not pulled. Remove the ESI check or mark it "pendiente" |

### 4.3 El Algarrobal fix (single source of truth)
Origin of the conflict, traced in code:
- **12,500 m³/ha/yr** = `app.js` l.549 hand-typed `water: 12500`. It also equals `annual()` (`app.js` l.812: Σ illustrative `et` [41.7 mm/day·months] × 30 × 10 = 12,510). So it is an illustrative crop-ET number, not an engine output.
- **8,068 m³/ha/yr** = `si-data.js` algarrobal `compare.strategies[current].water.p50 = 8067.6`, output of the missing `earth_oracle` engine on **synthetic** climate.
- The `recommended:true` flag sits on **deficit** in both `app.js` l.579 and `si-data.js`, but the engine's own `tradeoffs.ranking[0]` is **drip**. `si.js` and the CERES voice use the ranking; `app.js` l.800/832/836/838 use the flag.

Recomputed from real data (`data/out/algarrobal.json → strategies_recomputed`):
- ET₀ = 1,490 mm/yr (FAO-56 PM, NASA POWER daily 2001–2025)
- olive Kc 0.65–0.70 (FAO-56 Table 12) → ETc = 1,024 mm = **10,240 m³/ha/yr**
- effective rain ≈ 0

| Strategy | Formula | m³/ha/yr | vs today |
|---|---|---|---|
| current: gravity, bare soil | ETc / 0.60 | **17,070** | 0 % |
| deficit (RDI 75 % ETc, gravity) | 0.75·ETc / 0.60 | 12,800 | −25.0 % |
| cover (winter legume on 50 % of ground, gravity) | + 0.5·0.8·ET₀(May–Sep) / 0.60 | 20,210 | +18.4 % |
| **drip + strip cover (recommended)** | ETc / 0.90 + 0.3·0.8·ET₀(May–Sep) / 0.75 | **12,890** | **−24.5 %** |
| (drip, no cover; reference only) | ETc / 0.90 | 11,380 | −33.3 % |

Engine score with default weights (40/25/25/10), using the engine's soil/income/resilience criteria: **drip 0.947** > deficit 0.824 > cover 0.798 > current 0.742.

**One recommendation everywhere: "Drip + strip cover", 12,890 m³/ha/yr (−24.5 % vs 17,070 today).**
P10–P90 across 2001–2025 POWER years: 12,510–13,170.

Changes (all generated by `node data/fix/apply_algarrobal_fix.mjs`; review `data/patched/algarrobal-fix.diff`):
1. `app.js` l.579: delete `"recommended": true` from `deficit`; add `"recommended": true` to `drip` (l.639).
2. `app.js` l.549 / 580 / 610 / 640: water 12500→17070, 9800→12800, 13100→20210, 10600→12890.
3. `app.js` l.507–534: `et` = ETc mm/day, `ref` = ET₀ mm/day, `refLabel` = "Reference ET₀ (NASA POWER, FAO-56)", `rainYear` = 27 (CHIRPS 1991–2020).
4. `app.js` l.542–543: new CERES intro without the false ECOSTRESS claim. "Three alternatives to what you do today" is correct: there are 3 non-current strategies.
5. `si-data.js` algarrobal: `recommended` moves to drip; `water.p50`, `waterMonthly`, `deltas.waterPct`, `uncertainty.water` (P10/P50/P90 from real ET₀ years), `tradeoffs.radar.*.water`, `tradeoffs.ranking`, `dataQuality` and the ES/EN `voice` text all use the numbers above.
6. Afterwards, regenerate the CERES Retell prompt: `python oracle/scripts/retell_setup.py --dry-run`. Do the live update only with Chris's OK.
7. **Still to do by you:** the dashboard label for `annual()` (l.832, "Estimated annual consumption") now shows crop ET (~10,200 m³/ha). Relabel it "Crop water need (ETc)" so it isn't confused with the 17,070 m³/ha *applied* by gravity.

### 4.4 Labels
- `confidence.water`: `"modeled"` (ET₀ real × FAO-56 Kc), `confidence.ref`: `"measured"` (POWER reanalysis).
- Every coarse product gets "señal regional / regional signal": POWER (0.5°×0.625°), CHIRPS (0.05°), SMAP (9 km).

---

## 5. Known data caveats (show them in the UI or the evidence page)
1. **Carumas and Samegua share one NASA POWER grid cell (elevation 3,851 m).**
   - Carumas: lapse-adjusted POWER temperature (+4.55 °C) matches ERA5-Land within 0.1 °C (11.7 vs 11.8 °C). Use `site_lapse_adjusted` for T-based indices there.
   - Samegua: neither raw POWER (7.2 °C) nor lapse-adjusted (~22 °C) is right; ERA5-Land says 19.1 °C. Use ERA5-Land temperatures for Samegua frost/GDD, or label them clearly.
   - ET₀: raw POWER is within ±5 % of ERA5 at all three points, so use `power_raw` ET₀ everywhere.
2. **Spurious POWER precipitation spike on 2022-09-12/13** (260 + 55–70 mm/day at all points, while CHIRPS shows 1.5–3 mm for the whole month). It is removed automatically from the monthly/annual sums and logged in `qc`.
3. **POWER rain at Carumas (124 mm/yr) is about half of CHIRPS (230 mm/yr).** ERA5 (775 mm/yr) is much wetter. No station data was pulled, so show rainfall as a range: "CHIRPS 230 mm (POWER 124, ERA5 775)". Use CHIRPS for SPI.
4. **The MODIS 250 m pixel is larger than the 1–2 ha farms.** At Samegua and El Algarrobal it looks like desert or mixed cover. Prefer HLS 30 m (`ndvi_hls`).
5. **IMERG not pulled:** GES DISC returns `403 EULA Acceptance Failure` for this Earthdata account. Chris must approve the "NASA GESDISC DATA ARCHIVE" app once at https://urs.earthdata.nasa.gov/approve_app?client_id=e2WVk8Pw6weeLUKZYOxvTQ (he does this himself). Until then, CHIRPS v3 stands in and is labeled `substituteFor: GPM_3IMERGDF_v07`.

---

## 6. Re-running the pipeline
```bash
cd /workspace/space-apps-2026
bash data/run_all.sh            # everything, in the right order (≈10 min without Earthdata; SMAP Harmony ~1 h)
# or step by step:
data/.venv/bin/python data/historical/chirps3_pull.py
data/.venv/bin/python data/pull_and_build.py          # add --refresh to re-download POWER/MODIS/SRTM/CMR
data/.venv/bin/python data/historical/build_historical.py
data/.venv/bin/python data/historical/spi_chirps.py
data/.venv/bin/python data/build_evidence.py 202607 202608 202609 202610
node data/fix/apply_algarrobal_fix.mjs
data/.venv/bin/python data/bundle_site_data.py
```
Downloads are cached in `data/raw/` (delete a file to force a re-pull). The venv is `data/.venv` (uv); `run_all.sh` recreates it if missing.

**Why the first POWER pull failed with HTTP 422:** the request included `EVPTRANS`, which is not a valid POWER daily parameter (API message: "One of your parameters is incorrect: EVPTRANS"). Also note that POWER radiation starts on 1984-01-01, and the last 2–3 days are `-999` (latency). The script now uses only valid parameters, retries 429/5xx with backoff, treats `-999` as missing, drops ET₀ days without radiation, and fills at most 2 missing days per month in the evidence (`gapFilledDays`).

### 6.1 Datasets that need `EARTHDATA_TOKEN`
| Dataset | Script | Status 2026-11-14 |
|---|---|---|
| ECOSTRESS L3T JET v002 (ETdaily, 70 m) | `data/earthdata/earthdata_cog_pull.py ecostress` (CMR → signed LP DAAC URL → COG pixel read) | ✅ pulled, 2,009 overpass reads |
| HLS L30/S30 v2.0 NDVI (30 m) | `data/earthdata/earthdata_cog_pull.py hls` | ✅ see `data/raw/hls_ndvi_points.csv` |
| SMAP SPL3SMP_E v006 (Carumas) | `data/earthdata/smap_harmony.py 2015` (Harmony variable+bbox subset; full granules are 620 MB) | ⏳ see §6.2 |
| GPM IMERG (DF/DL/M v07) | `data/earthdata/earthdata_pull.py imerg` | ❌ blocked: needs GES DISC EULA approval (§5.5) |
| AppEEARS (HLS+ECOSTRESS+SMAP point request) | `data/earthdata/appeears_request.json` + `appeears_submit.py --check/--submit/--poll --download` | ❌ AppEEARS rejects EDL bearer tokens (HTTP 403). Needs `EARTHDATA_USERNAME`/`EARTHDATA_PASSWORD` env vars (or an `APPEEARS_TOKEN`). All layer names were validated live with `--check` |
The token is read from the environment and never printed. Don't write it to any file.

### 6.2 SMAP
`smap_harmony.py` submits 24 half-year Harmony jobs (IDs saved in `data/raw/smap_harmony_jobs.json`) and polls them. If it stops, rerun it: it resumes from the saved job IDs and writes `data/raw/smap_carumas.csv`. Then rerun `bundle_site_data.py`.

---

## 7. Citation strings (show under each chart/card; ES label in brackets)
- **NASA POWER:** "NASA POWER Daily v2 (community AG), 0.5°×0.625°, 1981–2026. NASA Langley Research Center. power.larc.nasa.gov" [Clima: NASA POWER]
- **ET₀:** "ET₀ FAO-56 Penman-Monteith (Allen et al. 1998) calculated from NASA POWER" [ET₀ calculada con NASA POWER]
- **Crop coefficients:** "Kc: FAO Irrigation & Drainage Paper 56, Table 12" · **Efficiencies:** "Brouwer et al. 1989, FAO Irrigation Water Management Training Manual 4 (surface 60 %, sprinkler 75 %, drip 90 %)"
- **MODIS:** "MOD13Q1 v061 NDVI, 250 m, 16-day (Didan 2021), via ORNL DAAC MODIS Web Service. doi:10.5067/MODIS/MOD13Q1.061"
- **HLS:** "Harmonized Landsat Sentinel-2 (HLS) v2.0, 30 m, NASA LP DAAC. doi:10.5067/HLS/HLSS30.002 / 10.5067/HLS/HLSL30.002"
- **ECOSTRESS:** "ECOSTRESS L3T JET v002 daily ET, 70 m, NASA JPL / LP DAAC. doi:10.5067/ECOSTRESS/ECO_L3T_JET.002"
- **SMAP:** "SMAP L3 Radiometer Global Daily 9 km EASE-Grid Soil Moisture v6 (SPL3SMP_E), NSIDC DAAC. doi:10.5067/M20OXIZHY3RJ"
- **SRTM:** "NASA SRTM GL1 30 m (2000), via OpenTopoData"
- **CHIRPS (partner):** "CHIRPS v3.0 monthly, 0.05°, UCSB Climate Hazards Center (Funk et al.)"
- **ERA5 (partner):** "Copernicus C3S ERA5 / ERA5-Land (Hersbach et al. 2020; Muñoz-Sabater et al. 2021), via Open-Meteo"
- **SI disclosure:** "Voz y respuestas de CERES generadas por SI / CERES voice and answers are SI-generated"

---

## 8. Evidence JSONs (WaterProofRegistry)
- Files: `avalanche/oracle/evidence/{carumas,samegua,algarrobal}-{202607,202608,202609,202610}.json`. Same schema as `examples/carumas-202610.json`, plus explanatory `_note`, `reason`, `stat`, `substituteFor`, `waterSavedBasis` and `recommendationBasis` fields. Those fields are hashed too.
- Target chain is now the **NØFI Avalanche L1 testnet, chainId 880024** (explorer https://nofiscan.io/). The schema has no chain field, so pass `--chain 880024` to `node oracle/build-attestation.mjs`. **No signing or transactions have been done.**
- ⚠ `build-attestation.mjs` does `x10(null) → 0`, so a missing ECOSTRESS month would go on-chain as "0 mm". Before any attestation, either skip months with `et_mm.value == null`, or change the encoder to a sentinel such as −1 and document it.
- ⚠ The cast commands that script prints still say `--rpc-url fuji`. Change them to the NØFI L1 RPC.
- Precip in the evidence is CHIRPS v3 (`substituteFor: GPM_3IMERGDF_v07`). NDVI is HLS where a clear scene exists, else MODIS (labeled). `waterSavedM3`: El Algarrobal = (gravity − drip+strip) month m³/ha × 2 ha, using the §4.3 method. Samegua = (alfalfa − rotation) × 1.2 ha, using assumed Kc calendars (labeled). Carumas = 0 (rainfed).
- El Algarrobal NDVI at the current point is < 0.20 in some months. The contract's anti-abandonment rule would block credits; fix the point (§1) before attesting.

---

## 9. Verification checklist
- [ ] `node --check app.js` passes; the site loads with no console errors; `window.CERES_NASA_DATA.farms` has 3 keys.
- [ ] El Algarrobal: the overview card, strategy list (SUGERIDA badge), SI view top rank, CERES read-aloud and Retell prompt all say **Drip + strip cover, 12,890 m³/ha/yr, −24.5 % vs 17,070**.
- [ ] `grep -n "ECOSTRESS muestra\|ECOSTRESS shows\|HLS muestra\|HLS shows" app.js` returns nothing (or only sentences built from data).
- [ ] No card shows `climate: synthetic` without a visible label.
- [ ] Every chart has a citation string from §7 with a date range.
- [ ] Rainfall cards show CHIRPS, with POWER/ERA5 as the range where they differ.
- [ ] Samegua temperature-based numbers are labeled (POWER cell mismatch) or come from ERA5-Land.
- [ ] `python data/build_evidence.py` reruns cleanly; `node oracle/build-attestation.mjs evidence/algarrobal-202610.json --chain 880024` produces a digest offline. Do **not** sign or send.
- [ ] Spot-check one value by hand, e.g. `data/out/algarrobal_daily.csv` October 2026 ET0 sum = evidence `et0_mm` (142.9).
