# Data sources

| Dataset | Short name / endpoint | Resolution | Access | What we use it for | Confidence badge |
|---|---|---|---|---|---|
| **ECOSTRESS evapotranspiration** | `ECO_L3T_JET` (LP DAAC) | 70 m, irregular ISS overpasses | Earthdata Login | Field water use (mm/day → m³/ha), the core metric and the payout basis | field |
| ECOSTRESS Evaporative Stress Index | `ECO_L4T_ESI` | 70 m | Earthdata Login | Separates a skipped practice from a dry year; olive deficit-irrigation guardrail | field |
| **HLS** surface reflectance | `HLSL30`, `HLSS30` (LP DAAC) | 30 m, 2–3 days | Earthdata Login | NDVI, crop present (`cropAlive`), rotation detection | field |
| **NASA POWER** | `https://power.larc.nasa.gov/api/temporal/monthly/point` | ~0.5° | No login | Tmax, Tmin, rain, solar, RH, wind → FAO-56 reference ET0; frost months | regional |
| GPM IMERG Late | `GPM_3IMERGDL` (GES DISC) | 0.1°, daily | Earthdata Login | Dec–Mar headwater rain that fills Pasto Grande | regional |
| OPERA DSWx-HLS | `OPERA_L3_DSWX-HLS_V1` (PO.DAAC) | 30 m | Earthdata Login | Water surface of Pasto Grande, Vizcachas, qochas | field |
| SMAP | `SPL3SMP_E` (NSIDC) | 9 km daily | Earthdata Login | Highland soil moisture context (Carumas) | regional |
| GRACE/GRACE-FO mascons | `TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4` (PO.DAAC) | basin scale, monthly | Earthdata Login | Long-term regional water storage trend | regional |
| SRTM | `SRTMGL1` | 30 m | Earthdata Login | Elevation (frost, lapse rate), slope (qocha siting) | field |
| GIBS tiles | `https://gibs.earthdata.nasa.gov/wmts/...` | varies | No login | Map backgrounds and layers | — |

Not NASA:
- **SENAMHI** stations — ground truth for temperature/rain.
- **INIA / Agencia Agraria Moquegua** — varieties, yields, seed availability.
- **FAO-56** crop coefficients (Kc) — crop water demand.
- **ANA** (Autoridad Nacional del Agua) / Junta de Usuarios — water allocation context (display only).

## Key conversions
- 1 mm of water over 1 ha = 10 m³.
- Monthly m³/ha = mean ET (mm/day) × days in month × 10.
- POWER `ALLSKY_SFC_SW_DWN` monthly is in kWh/m²/day → × 3.6 = MJ/m²/day for FAO-56.

## Honest limits (show these in the Sources drawer)
- ECOSTRESS is on the space station: overpass time and frequency vary; some months have few clear passes.
- ECOSTRESS measures water consumed by soil + plants, not water delivered. Canal losses and runoff don't appear.
- POWER/IMERG/SMAP/GRACE-FO can't see one field; they describe the area around it.
- Coastal winter fog (garúa) in Ilo can affect optical passes June–September; flag low-confidence months.
- Thresholds (NDVI 0.35, etc.) are starting points to be tuned with local experts.

## Access
```python
import earthaccess
earthaccess.login(strategy="environment")   # EARTHDATA_USERNAME / EARTHDATA_PASSWORD
results = earthaccess.search_data(short_name="ECO_L3T_JET", bounding_box=(-70.95,-17.22,-70.85,-17.14), temporal=("2024-01-01","2026-10-31"))
```
