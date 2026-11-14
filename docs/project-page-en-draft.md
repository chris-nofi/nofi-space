# Space Apps project page: English draft (for Chris to review and paste; do not submit from here)

> Every number below is from the current build (`site/si-data.js`, `data/`, `avalanche/oracle/evidence/`). If the data is regenerated, re-check them against the app before pasting.

## Project name
CERES Ventures (by NOFI Labs)

## High-level summary
In Moquegua, Peru, almost no rain falls on the valleys. Farms live on canal water shared with towns and mining, and highland plots depend on a short rainy season.

CERES Ventures is a crop-rotation and soil-health advisor that speaks the farmer's language. For each field, it compares the current practice with three alternatives, ranks them by the farmer's own priorities and situation, and explains the result in Spanish by voice or chat. The priorities are water, soil, income and resilience; the situation covers water available, equipment, market and soil goal.

Each option shows:
- why it is suggested and its benefits
- the NASA evidence, with dataset, value and date
- information gaps
- risks to review with the local agrarian agency or INIA

The water numbers come from NASA POWER, through FAO-56 crop water. Season timelines come from HLS and Sentinel-2. The tool also covers frost risk and SRTM slope, and every uncertainty is shown. It supports, and does not replace, the farmer's judgment.

## How it works
1. **NASA data → engine.**
   - Reference evapotranspiration (ET₀, FAO-56 Penman-Monteith) is computed from NASA POWER daily data, 2001–2025. It agrees with ERA5 within ±5 %.
   - Crop water = ET₀ × FAO-56 crop coefficients ÷ irrigation efficiency.
   - Rain comes from CHIRPS v3. It stands in for GPM IMERG, whose download is pending GES DISC EULA approval, and NASA POWER and ERA5 are shown as the range.
2. **Compare at least three strategies, including the current one.**

   | Farm | Strategies |
   |---|---|
   | Carumas (rainfed potato, 3,150 m) | potato → potato; potato → faba → oat-vetch; potato → tarwi → barley; rest with trenches |
   | Samegua (irrigated alfalfa) | alfalfa; alfalfa → fodder maize → pea; barley → bean; quinoa |
   | El Algarrobal (olive, perennial) | four management strategies |
3. **Re-rank with the farmer.**
   - The score is the sum of each priority × criterion, using the engine's documented criteria. It works offline in the browser.
   - Constraints adjust it: no drip kit, no quinoa or tarwi buyer, scarce or secure water, and a soil goal (fix nitrogen, cover, organic matter, erosion).
4. **Make uncertainty visible.**
   - A Monte Carlo over climate years, crop coefficients and prices gives P10–P90 ranges and "best in N of 100 years".
   - At Carumas, rain-source disagreement is simulated: CHIRPS 230, POWER 124, ERA5 775 mm/yr. That is why its confidence is low.
5. **Seasons and risk.**
   - NDVI timeline: HLS 30 m at the Carumas field; Sentinel-2 at a provisional crop pixel for the valley farms.
   - Bare-soil months (NDVI < 0.20) and vulnerable months (bare soil + rain or frost).
   - Frost days from the temperature series that matches the field elevation.
   - SRTM slope with a relative erosion rank.
   - Soil texture, pH and organic carbon from ISRIC SoilGrids, labeled as not a NASA product.
6. **CERES.** The SI voice (Claude; Retell for phone/web calls) answers only from the engine's tools. It cites dataset, value and date, names a gap and a risk, and defers to INIA.

## Worked example: El Algarrobal (olive, 2 ha)
- Today, gravity irrigation on bare soil applies about **17,064 m³/ha/yr**: ETc 1,024 mm ÷ 0.60.
- With default priorities, the top option is **drip + strip cover: about 12,882 m³/ha/yr (−24.5 %)**, +40 soil points.
- Regulated deficit irrigation saves a similar amount of water (12,798 m³/ha/yr) but doesn't improve soil. It only wins when water is weighted at about 100 %.
- A winter legume cover across the whole grove would *raise* water use by 18.4 %, because nothing grows on this coast unless it is irrigated.
- If the farmer marks "no drip kit", the tool recommends deficit irrigation instead and says why.

## Use of NASA data
| Dataset | Use | Resolution / period |
|---|---|---|
| NASA POWER daily (AG) | ET₀ (FAO-56), temperature, frost days, humidity, wind, radiation | 0.5° × 0.625°, 1981–2026 |
| ECOSTRESS L3T JET v002 | Actual evapotranspiration at each point (136–185 valid overpasses per farm) | 70 m, 2019–2026 |
| HLS v2.0 (L30/S30) | NDVI season timeline, bare months, crop check | 30 m, 2024–2026 |
| MODIS MOD13Q1 v061 | Long-term NDVI context | 250 m, 2001–2026 |
| SMAP SPL3SMP_E | Highland soil-moisture context (Carumas) | 9 km |
| SRTM GL1 | Elevation, slope, erosion indicator | 30 m |

## Space agency partner data
- **ESA Copernicus Sentinel-2 L2A**: NDVI at the provisional crop pixels. The HLS S30 granules are Sentinel-2-based. ("Contains modified Copernicus Sentinel data 2024–2026.")
- **ECMWF / Copernicus ERA5 and ERA5-Land**: ET₀ and temperature cross-checks, and Samegua temperature.
- **Other, non-NASA**:
  - CHIRPS v3 (UCSB CHC), standing in for IMERG
  - ISRIC SoilGrids 2.0 (soil)

## Honest limits (shown in the app)
- **Farm points are illustrative.** At Samegua and El Algarrobal the app point is bare ground (HLS NDVI ≈ 0.05), so the tool uses a provisional crop pixel 150 m and 532 m away. The farmer must confirm it.
- **Still example values:** yields, prices and canal delivery. The SI water-use model is trained on synthetic data.
- **Not ingested yet:** GPM IMERG, OPERA DSWx and GRACE-FO.

## Verifiable record (integrity layer)
- Each monthly evidence file (the indicators plus the recommended strategy) is hashed: sha256 over canonical JSON.
- The hash can be anchored in a WaterProofRegistry contract on NOFI's own Avalanche L1 testnet (chain 880024, explorer nofiscan.io).
- Data queries can be paid per request with the x402 standard.
- Farmers never pay and never see crypto. The app only shows "registro verificable".

## Pre-existing work
- **NØFI Avalanche L1 testnet:** built in October 2026 (chain 880024, validator, nofiscan explorer, tUSD gas).
- **Before the event:**
  - A UI scaffold dated 13 November.
  - Code scaffolds drafted with AI assistants on 13–14 November before 09:00: SI engine, CERES, contracts, x402 oracle.
- **Done during the hackathon:** the challenge-specific work (real data runs, evidence, rankings, video).

## AI use disclosure
- CERES voice and answers are SI-generated: Claude, via Retell for voice.
- The ranking is a documented formula with simulations.
- Parts of the code and text were drafted with AI assistants (Claude, Codex, Apollo) and reviewed by the team.
- No NASA data was altered.
- Farm locations are illustrative.

## Links
- Demo: TODO (Netlify URL)
- Repository: https://github.com/chris-nofi/nofi-space
- Video: TODO

## References
- Allen et al. (1998), FAO-56
- Brouwer et al. (1989), FAO Training Manual 4
- Dataset DOIs: HLS 10.5067/HLS/HLSS30.002; ECOSTRESS 10.5067/ECOSTRESS/ECO_L3T_JET.002; MODIS 10.5067/MODIS/MOD13Q1.061; SMAP 10.5067/M20OXIZHY3RJ
- Poggio et al. (2021), SoilGrids 2.0
- Hersbach et al. (2020), ERA5; Muñoz-Sabater et al. (2021), ERA5-Land
- Funk et al., CHIRPS
- ProActivo (2016 drought losses), Agraria.pe (Sierra Azul qochas, 2026), Energiminas (Vizcachas, 2024)
