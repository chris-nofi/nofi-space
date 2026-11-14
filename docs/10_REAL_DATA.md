# Real data: what replaced the dummy numbers (Sat 14 Nov 2026)

Source: Kepler's package (`data/`, guide `data/CONNECT-REAL-DATA.md`, answers `data/kepler-answers.md`). Every number on the site, in the SI engine, in CERES and in the records now comes from those files or from the engine run on them. Nothing is hand-typed.

## Pipeline
```
data/out/ceres-site-data.json  ──► python -m earth_oracle.cli import-real ──► oracle/data/real/{farm}_{power,ecostress,ndvi,context}.json
                                                                                     │
                                         SI engine (earth_oracle/si) ◄────────────────┘
                                                     │
              python -m earth_oracle.cli export-site ▼
site/si-data.js (AGUA_SI_FIXTURES · AGUA_SI_RECORDS · AGUA_SI_CLIMATE)  +  site/ceres-nasa-data.js (Kepler bundle)
                                                     │
                             site/real-data.js rewrites DB.FARMS at load (app.js calls CeresRealData.apply(DB))
avalanche/oracle/evidence/{farm}-{YYYYMM}.json ──► proof.package() ──► records page, CERES get_verified_record, x402 package
```
Refresh after Kepler re-runs his pipeline: copy his `data/` over ours, then run `import-real`, then `export-site`, then copy `data/out/ceres-nasa-data.js` to `site/`.

## Per-farm input choices (Kepler §5, Q1–Q6)
| | ET₀ | Temperature | Rain | ECOSTRESS | NDVI |
|---|---|---|---|---|---|
| Carumas | FAO-56 PM, raw POWER 2001–2025 | POWER + lapse shift (+4.55 °C) | CHIRPS 230 mm; MC samples CHIRPS / POWER 124 / ERA5 775 | used to calibrate (representative) | MODIS 250 m used |
| Samegua | same | POWER shifted to ERA5-Land monthly means (POWER cell at 3,851 m) | CHIRPS 105 mm (POWER 124, ERA5 184) | **not used**: point likely off-field | **not used** (desert pixel) |
| El Algarrobal | same | raw POWER (coastal inversion) | CHIRPS 26.5 mm | **not used** | **not used** |

## Engine changes
- **ET₀ = the real FAO-56 values.** For drawn years and warming scenarios, they are scaled by the engine's own PM ratio.
- **Irrigated water = gross applied:** net need ÷ efficiency (surface 0.60, drip 0.90, strips 0.75; Brouwer 1989). Irrigated cover adds water through `coverKcMonthly`.
- **Supply = what the current practice applies.** There are no canal delivery records.
- **Effective rain** uses the FAO/AGLW (CROPWAT) formula, the same one as Kepler's pipeline.
- **Olive Kc** is 0.65 from June to September and 0.70 in the other months (FAO-56 Table 12). Deficit irrigation = 75 % of ETc.
- **No calibration to off-field pixels.** Calibration is 1.0 when ECOSTRESS isn't representative.
- **Rain-source uncertainty:** each Monte Carlo year picks CHIRPS, POWER or ERA5 totals. That's why Carumas confidence is low.
- **One recommendation everywhere:** `recommended` = the engine's top-ranked strategy. Static flags were removed.
- **Headline water** is `water.expected`, the run on the 2001–2025 climatology. The p10–p90 band comes from the Monte Carlo.

**Reproduces Kepler's El Algarrobal reconciliation** (`tests/test_real_data.py`):

| | Kepler | Engine |
|---|---|---|
| Gravity, bare soil | 17,070 | 17,064 |
| Deficit | 12,800 | 12,798 |
| Cover | 20,210 | 20,201 |
| Drip + strip cover | 12,890 (−24.5 %) | 12,882 (−24.5 %) |
| Ranking | drip 0.947 first | drip 0.947 first |

## Records
- `avalanche/oracle/evidence/*.json` hold the real monthly values (July to October 2026, 3 farms) and are the records.
- `dataHash` = sha256 of the canonical JSON of the whole file. **Confirm this matches `build-attestation.mjs` before attesting.**
- `attestable` is false, with reasons, when:
  - the point is likely off the field (Samegua, El Algarrobal)
  - NDVI < 0.20 (the anti-abandonment rule)
  - an indicator is null (never encode it as 0)
  - a single overpass reads 0 mm
- Months without an evidence file fall back to an engine record built from climatology, marked placeholder.

## Site
- `real-data.js` replaces:
  - `et`/`ref` with FAO-56 ETc and real ET₀
  - `rainYear` with CHIRPS, plus the source range
  - strategy water and soil with engine output, and `recommended` with the engine's top rank
  - the CERES intro with the engine narrative
  - observation sentences with sentences built from the data
- `app.js` changes:
  - Labels now say "Necesidad de agua del cultivo (ETc)", modeled.
  - The status pill reads "DATOS NASA REALES · PUNTOS ILUSTRATIVOS".
  - The illustrative reservoir card is replaced by a real rain card: CHIRPS bars, with the POWER/ERA5 range.
  - The evidence page has a new card for the ECOSTRESS/MODIS point.
  - There are citations under every chart (§7).
  - Region facts use the wording Kepler verified.
  - All the false "ECOSTRESS/HLS shows…" strings are gone.

## Still illustrative or pending
- **Farm points.** Move Samegua and El Algarrobal onto real fields, then rerun Kepler's pipeline.
- **Yields, prices, costs, canal delivery.**
- **The SI water-use model.** It is still trained on synthetic data and labeled.
- **Data sources not yet pulled:**
  - HLS 30 m (not in the package)
  - GPM IMERG (GES DISC EULA: Chris approves it once)
  - SMAP, OPERA DSWx, GRACE-FO, ECOSTRESS ESI
- **Carumas.** ECOSTRESS (~1.6 mm/day) and MODIS (green all year) suggest more water or vegetation at the pixel than CHIRPS rain allows. Confirm with a SENAMHI station.
