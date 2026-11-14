# Ceres Ventures — Farm map + x402 plan

**For:** the web-app devs (frontend / data / chain / voice) and Codex. Written by Apollo, Saturday 14 November 2026, ~03:50 Peru time (UTC-5). **Updated:** Saturday 14 November 2026, ~04:15 Peru time (UTC-5).

**Changelog — 2026-11-14 ~04:15 Peru time (UTC-5):** Demo network switched to **Avalanche Fuji C-Chain (43113)** with Circle Fuji USDC. Positioning, §4.2, §6, §7, and the P0 chain tasks were rewritten so nobody keeps building against 880024 for the live demo. NØFI L1 is roadmap / stretch.

**Do not edit the app, deploy, attest, submit, register, or post from this document.** It is the product plan for the locked positioning. Chris must explicitly approve any live deploy, key creation, or Retell update.

- Challenge: NASA Space Apps 2026, "Field Shift: Adapting Farms with NASA Data". Local event: Moquegua 2026.
- **Hard deadline: Sunday 15 November 2026, 23:59 Peru time (UTC-5).**
- Chain (demo): **Avalanche Fuji C-Chain, chain id 43113** (`eip155:43113`), RPC `https://api.avax-test.network/ext/bc/C/rpc`, explorer [Snowtrace testnet](https://testnet.snowtrace.io/). Payment asset: Circle Fuji USDC `0x5425890298aed601595a70AB815c96711a31Bc65` (EIP-3009). Wallet: Core (Avalanche), Testnet Mode on.
- The **NØFI Avalanche L1 (880024, explorer https://nofiscan.io/)** is **roadmap / stretch**. Do not show nofiscan links unless 880024 is actually producing blocks. Do not claim the L1 is live.
- Related docs to keep in sync: `mentor/ceres-challenge-alignment-implementation.md`, `mentor/landing-page-outline-for-codex.md`, `mentor/ceres-team-and-project-page.md`.

---

## 0. Positioning (locked)

> A map of Moquegua farms where each field gets a NASA soil-and-water score and a verified record on Avalanche (Fuji C-Chain testnet); built to move to the NØFI L1. Insurers, banks, co-ops and agro-exporters pay per lookup through x402; farmers use it free by voice with CERES.

This is a Zip2-style B2B map/data business. **Crop-rotation recommendations and soil health stay inside the score and the field view**, because that is what the NASA challenge asks for. Avalanche is first-class: it is required to win the Team1 LatAm track. The live demo runs on **Fuji C-Chain**, not the NØFI L1.

One product, two pitches. Do not fork the codebase.

| Audience | Lead with | Keep visible, but second |
|---|---|---|
| **NASA / Space Apps** (project page, 30-s video, local NASA judging) | The map of named Moquegua fields, the Ceres Field Score, crop-rotation + soil-health decisions, named NASA/ESA datasets, uncertainty, "supports, not replaces farmer judgment" | Registro verificable as the integrity layer for each score and recommendation |
| **Team1 LatAm Avalanche** (Chris's first-priority prize) | A live x402 **402 → pay → 200** flow on a field lookup, WaterProofRegistry anchors, and Snowtrace testnet links on **Fuji C-Chain (43113)**. Team1 pitch line: *"Running on Fuji C-Chain today. The same contracts deploy unchanged to the NØFI L1 (880024), which gives us stablecoin gas and an oracle allowlist."* Do not claim the L1 is live. | The same NASA score and rotation tool as the payload those transactions protect |

Farmer-facing Spanish UI never says wallet, token, USDC, gas, faucet, or "blockchain". Use **"registro verificable"**. Judge / English / B2B mode may show chain id, contract, and Snowtrace testnet links.

**Hide only the off-challenge crypto rewards module.** Do not hide the map, the score, the badge, Snowtrace, or x402.

No invented customers, contracts, market sizes, or "we already sell to insurers." Buyer stories in §5 are **hypotheses**.

---

## 1. Product spec — the map

The map is the hero of the landing page and the core of the dashboard (`/app`). The previous schematic `map()` in `ceres-ai/app.js` is not a GIS map; replace that overview surface with this map. Clicking a field opens the field drawer (§3).

### 1.1 Stack: Google Maps JavaScript API (Chris's choice)

**Use the Google Maps JavaScript API. Do not use Leaflet or MapLibre for this product.**

| Piece | Choice |
|---|---|
| Base map | `mapTypeId: "hybrid"` (satellite + labels). Allow a control to switch to `satellite` or `roadmap`. Default is hybrid, so judges see real fields, not a street map. |
| Markers | `google.maps.marker.AdvancedMarkerElement` (library `marker`). Color or a score badge on the marker. |
| Field geometry | `google.maps.Data` layer and/or `google.maps.Polygon`. See §1.5: **we do not have cadastral polygons**. |
| Field popover | `google.maps.InfoWindow` with a short preview (name, score or "sin puntaje", crop, "Ver parcela") that opens the side drawer. |
| Score / NDVI overlay | P0: colored markers + an optional circle at each field. P1: `GoogleMapsOverlay` from `@deck.gl/google-maps`, or `google.maps.GroundOverlay` once NDVI/score tiles exist. Do not invent a raster if no tiles have been generated. |
| Side drawer | App-owned HTML/CSS panel (not only the InfoWindow). This is where rotation, evidence, and the registro badge live. |
| Cloud styling | A **Map ID** from Google Cloud Map Management, passed into `new google.maps.Map(..., { mapId })`. Required for Advanced Markers and for any cloud-based style. |

Suggested new files (do not create them from this plan until the team starts the build): `ceres-ai/map.js`, `ceres-ai/field-score.js`, `ceres-ai/field-drawer.js`, plus CSS. Load the Maps script after `config.js`.

### 1.2 Google Cloud setup (keys, billing, Map ID)

Someone on the team (Chris, or a dev he names) finishes Cloud Console setup. **Never paste the key value into a document, commit, chat, issue, screenshot, or source file.** Refer to the path and the variable name only.

A key already exists on the box, in env-file form:

- Path: `/workspace/space-apps-2026/.secrets/google-maps.env`
- Variable name: `GOOGLE_MAPS_API_KEY`
- That directory is gitignored (`space-apps-2026/.gitignore` lists `.secrets/`; `.secrets/.gitignore` ignores its contents). Keep it that way.

1. Create or pick a **Google Cloud project** (for example `ceres-ventures-maps`) if one is not already attached to this key.
2. Attach a **billing account**. The Maps JavaScript API will not serve production traffic without billing enabled.
3. Enable APIs:
   - **Maps JavaScript API** (required).
   - **Places API** and **Geocoding API** are optional. Do not enable them until a feature needs them (address search, reverse-geocoding a click). The P0 demo does not need them: the three fields are known coordinates.
4. **Restrict the existing key** (Application restriction: **HTTP referrers**), if it is not already restricted:
   - Allow `http://localhost:*/*` and `http://127.0.0.1:*/*` for local work.
   - Allow the production Netlify origin, e.g. `https://<production-domain>/*`.
   - Named deploy-preview URLs may be added one by one. Avoid a blanket `https://*.netlify.app/*` if a tighter list is possible.
   - API restriction: Maps JavaScript API only (plus Places/Geocoding only if enabled).
5. Create a **Map ID** (Cloud-based maps styling / Map Management). Use that Map ID in the browser map constructor. A second Map ID for a light landing-page style is optional. There is no Map ID in `google-maps.env` as of 14 Nov 2026; store it as `GOOGLE_MAPS_MAP_ID` in the same secrets file or in Netlify env when it exists.
6. Inject `GOOGLE_MAPS_API_KEY` (and `GOOGLE_MAPS_MAP_ID` when you have one) at **build or runtime from env**, never from a committed file:
   - **Netlify:** set a site env var with the same name, `GOOGLE_MAPS_API_KEY`, and inject it at build into a generated config that is not committed. Do not paste the value into `netlify.toml` or into this repo.
   - **Local:** source `/workspace/space-apps-2026/.secrets/google-maps.env` (or a gitignored `config.local.js`) and write the key into a build-only config.
   - `config.js` in git may contain empty placeholders (`googleMapsApiKey: ""`, `googleMapId: ""`). If the key is missing, the dashboard shows a Spanish/English empty state ("El mapa no está configurado") and still lists the three farms as cards, so a judge without the key is not looking at a blank app.
7. Content-Security-Policy in `ceres-ai/_headers` must allow `https://maps.googleapis.com`, `https://maps.gstatic.com`, and the other hostnames Google documents for the Maps JS API. Keep Google attribution visible (Maps ToS).

### 1.3 Usage and pricing (do not invent prices)

A billing account is required. Maps Platform gives a monthly credit; **do not hard-code a dollar amount or a per-load SKU price in the app or the pitch.** Before going live, Chris should read the current figures here:

- https://developers.google.com/maps/billing-and-pricing/pricing
- https://mapsplatform.google.com/pricing/

Plan the demo (three fields, a landing page, a 30-second video, and a judging-day audience) so usage stays within that monthly credit. If traffic might exceed it, add a referrer-restricted key, avoid loading the Maps script on pages that do not need it, and watch the Cloud billing budget alert. Do not claim "Google Maps is free."

### 1.4 Map UX

- Default bounds: all three Moquegua sites (Carumas, Samegua, El Algarrobal). Fit bounds with padding so markers are not under the drawer or the CERES panel.
- Farmer ES copy on the map chrome: "Mapa de chacras", "Puntaje de la parcela", "Registro verificable". No crypto terms.
- Marker states: scored (color by score band), pending/partial (from `fieldPixelStatus` or missing components), not yet attested (badge only in the drawer).
- Click marker → InfoWindow preview → "Ver parcela" opens the drawer and ` /app?farm=<id> `.
- Deep link `/app?farm=algarrobal|carumas|samegua` pans to that field and opens the drawer.
- Show **two points** when they differ: "punto de la app" and "píxel de cultivo (provisional; confirmar con el agricultor)". See §1.5.
- Mobile: drawer is a bottom sheet; map remains visible in a short pane. Must work at 360 px.
- Accessibility: keyboard can move between farms; InfoWindow and drawer are labeled; do not rely on color alone for the score (print the number).

### 1.5 Field locations (real coordinates only)

Sources: `data/out/all_farms.json` / `DB.FARMS` (app points), `data/out/green_pixel_candidates.json`, evidence `_context.fieldPixel`, and `data/out/ceres-site-data.json` (`point`, `field_pixel`). Evidence months: July–October 2026, paths under `avalanche/oracle/evidence/<farm>-202607.json` … `-202610.json`.

| Farm key | Setting | App point (DB / all_farms) | Cultivation pixel to use on the map | Notes |
|---|---|---|---|---|
| `algarrobal` | El Algarrobal, Ilo coast, perennial olive | −17.62, −71.26 | **−17.6155, −71.2588** (`fieldPixel`, 532 m from the app point; HLS NDVI 0.59 on 20 Oct 2026 scene) | App point is bare / often null NDVI. Evidence `indicators.ndvi` and some ET values are still from the app point (`fieldPixelStatus` PENDING/PARTIAL). Prefer `extensions.cover` (Sentinel-2) for vegetation. Confirm with the farmer. |
| `samegua` | Samegua valley, Pasto Grande irrigation, alfalfa | −17.18, −70.90 | **−17.17996, −70.90147** (`fieldPixel`, 150 m; HLS NDVI 0.558 on 4 Nov 2026 scene) | Same PENDING/PARTIAL warning. App-point HLS NDVI is ~0.04. Samegua shares Carumas's NASA POWER cell at 3,851 m (farm SRTM ~1,558–1,575 m, lapse ~14.8 °C). Frost in evidence already prefers ERA5-Land. |
| `carumas` | Carumas highlands, rainfed potato (Parcela Familia Quispe in the app name) | **−16.81, −70.69** | No `fieldPixel` in the evidence JSONs. Nearest green candidate is −16.80991, −70.69032 (30 m, NDVI 0.509 on 4 Nov 2026). | Use the app point as the primary marker. Optionally show the 30 m candidate as a second, labeled point. Do not silently move Carumas. |

**Polygons:** there are **no surveyed field boundaries** in the repo. Do not invent farm shapes.

P0 geometry: AdvancedMarker at the cultivation pixel (or the Carumas app point), plus an optional **30 m HLS pixel square** (`Polygon` or Data layer) around that pixel, labeled "huella del píxel HLS 30 m, no es el linde de la chacra."

P1: a farmer-confirmed polygon, only if someone on the team traces it with the farmer and records the source.

Elevation / slope already in evidence `extensions.slope` (field-pixel window) and in `CERES_NASA_DATA.farms.*.point` (app-point SRTM). Prefer evidence slope when drawing the cultivation pixel (El Algarrobal evidence slope ~8.4° mean over 90 m; the app-point slope in site-data is much steeper because that point is not the grove).

### 1.6 Overlays

- **P0:** marker color bands on the three fields (for example 0–39 / 40–59 / 60–79 / 80–100, with the number printed). Optional `Circle` radius is illustrative only, not a field area.
- **P1:** Deck.gl `GoogleMapsOverlay` or `GroundOverlay` for an NDVI or score tile of the three sites. Tiles must be generated from HLS/Sentinel-2 (cite dataset + date) and stored as static images in the site, or documented as TODO if not generated. A heatmap of three points is not a scientific surface — do not present it as one.
- **P2:** FIRMS fire history. **Not pulled.** Do not draw a fire layer until a cited FIRMS extract exists. See P2 in §8.

### 1.7 Routes (same as the landing-page spec, map-first)

- `/` — landing page; hero is this map (or a static satellite fallback if the key is missing).
- `/app` — dashboard, map is the main view.
- `/app?farm=<id>` — one field, drawer open.
- `/verify/<digest>` — record page, adapted from `avalanche/web/registro.html`, default chain **43113** (Snowtrace testnet).
- `/api-docs` — x402 API for B2B / judges.

---

## 2. The Ceres Field Score

A transparent, versioned index (**`ceres-field-score.v1`**) for the latest evidence month (default **202610**), shown on the marker and at the top of the drawer. It is a **decision-support index**, not a credit rating, not an insurance score, and not a soil-loss or yield prediction.

Do not invent component values. Use only fields that exist in the evidence JSONs, or (where this section says so) in `data/out/ceres-site-data.json` / `ceres-nasa-data.js` with an explicit source label. Missing inputs are omitted and listed as gaps.

### 2.1 Input inventory (what exists vs TODO)

| Component | Weight | Evidence fields that exist today | Gaps / TODO |
|---|---:|---|---|
| Water stress | 25% | `indicators.et_mm`, `indicators.et0_mm` (all farms; El Algarrobal **202608 and 202609 `et_mm.value` is null**, reason: no valid ECOSTRESS pixel). | **SMAP** is only in Carumas evidence `_context.soilMoisture` (`value_m3m3`, `baseline_2015_2025_m3m3`, `SMAP_SPL3SMP_E_v006`, 9 km). El Algarrobal and Samegua: **TODO**. Field-pixel ET for Algarrobal/Samegua still PENDING. |
| Vegetation | 25% | `extensions.cover.ndvi_month_median` + `n_clear_obs` (Sentinel-2 L2A, field pixel, all farms). `indicators.ndvi` (HLS/MODIS, all farms). | For Algarrobal/Samegua, `indicators.ndvi` is still the **bare app point**. Prefer Sentinel-2 cover until field-pixel HLS lands. |
| Soil | 20% | `extensions.soil`: `clay_pct`, `sand_pct`, `silt_pct`, `soc_g_kg`, `ph_h2o`, `bulk_density_g_cm3`, SoilGrids 2.0 250 m. | Always label **NON-NASA**. Machine-learning product, "uncertain in hyper-arid/irrigated valleys" (already on the evidence label). No in-situ pit. |
| Climate risk | 15% | Frost: `extensions.frost` (`this_month.days_lt0` / `days_lt2`, `clim_1991_2020_days_lt0` / `_lt2`, `preferred_series`). Rain this month: `indicators.precip_mm` (CHIRPS v3.0, substitute for IMERG). | **Heat is not in the evidence JSONs (TODO).** Annual heat-day counts exist in `data/out/<farm>.json` and `ceres-site-data.json` under `et0.site_lapse_adjusted.heat_days_tmax_gt30` / `_gt35`, but do **not** use them in v1, and do **not** use Samegua lapse-adjusted POWER for heat (same 14.8 °C problem as frost). Add heat to evidence with a preferred series (ERA5-Land at Samegua) before scoring it. |
| Erosion | 15% | `extensions.slope` (`window_mean_deg`, `center_deg`, `center_pct`). `extensions.erosion.proxy_tan_slope_x_days_gt10mm` and `proxy_tan_slope_x_p95_intensity` (POWER and ERA5 keys). | **Not soil loss.** IMERG blocked (`imerg_status`). POWER vs ERA5 can disagree sharply (Carumas days-proxy 0.171 vs 6.757). See the rule below. |

Other useful evidence fields that are **not** score inputs but belong in the drawer: `engine.recommendedStrategy`, `engine.confidence`, `engine.waterSavedM3`, `engine.priorities`, `extensions.cover.bare_this_month`, `extensions.fieldPixelStatus`.

### 2.2 Component formulas (v1)

Each component is 0–100 (higher is more favorable / lower stress). Clamp all intermediates to `[0, 1]` before multiplying by 100.

**Water (`W`).** Let `esi = et_mm.value / et0_mm.value` when both values are non-null numbers and `et0_mm.value > 0`. `W_et = 100 * clamp(esi, 0, 1)`.

- If `et_mm.value` is **null** (Algarrobal 202608, 202609), omit `W_et` and record the `reason`.
- If `et_mm.value === 0` and granules are listed (Carumas 202609), treat it as a measured near-zero ET (high stress) and flag "review: zero ET" in `gaps`.
- If Carumas `_context.soilMoisture` is present: `W_smap = 100 * clamp(value_m3m3 / baseline_2015_2025_m3m3, 0, 1)` when baseline > 0. Then `W = 0.5 * W_et + 0.5 * W_smap`. If ET is omitted, `W = W_smap` only.
- If SMAP is absent, `W = W_et` and list `smap: TODO`.
- Always note when ET/HLS still come from the bare app point.

**Vegetation (`V`).** Prefer `extensions.cover.ndvi_month_median` when `n_clear_obs > 0`. Fallback: `indicators.ndvi.value`, labeled with its `dataset`.

```
V = 100 * clamp((ndvi - 0.15) / (0.70 - 0.15), 0, 1)
```

The anchors 0.15 (sparse/bare) and 0.70 (vigorous canopy) are **draft index anchors**, not crop-specific yield thresholds. If `|S2 − HLS| > 0.15`, use the series that matches the cultivation pixel (S2 today for Algarrobal and Samegua), show both numbers in the drawer, and drop confidence one step.

**Soil (`S`).** Three equal sub-scores from `extensions.soil`, then the mean of those that exist.

```
S_texture = 100 * clamp((clay_pct + silt_pct) / 60, 0, 1)   # sand-heavy soils score lower on holding
S_soc     = 100 * clamp((soc_g_kg - 5) / (25 - 5), 0, 1)
S_ph      = 100 * max(0, 1 - abs(ph_h2o - 7.0) / 2.5)
S         = mean of available sub-scores
```

These anchors are draft and must stay visible in the drawer ("índice interno, no es un análisis de laboratorio").

**Climate (`C`) in v1 = frost only**, from the evidence `preferred_series` (do not use raw POWER at Samegua).

```
C = 100 * (1 - clamp(clim_1991_2020_days_lt0 / 60, 0, 1))
```

If climatology days_lt0 is 0, `C = 100`. Still display `this_month` days and `clim_1991_2020_days_lt2` (Carumas is 1.9) as context. CHIRPS `precip_mm` is shown in the drawer and feeds erosion, not `C`. **Heat = TODO.**

**Erosion (`E`).** Higher proxy / steeper slope → lower score. Relative, unitless, **not** t/ha.

```
E_slope = 100 * (1 - clamp(slope.window_mean_deg / 25, 0, 1))   # 25° draft "steep" anchor
```

For the rain×slope proxy, use `proxy_tan_slope_x_p95_intensity` (narrower POWER/ERA5 spread than the days proxy). Let `p` be the mean of the POWER and ERA5 values if both exist. If the larger is more than **twice** the smaller, do not average: take the **higher-risk** (larger) value, set component uncertainty to high, and show both numbers.

```
E_proxy = 100 * (1 - clamp(p / 6, 0, 1))   # 6 is a draft anchor near the high Carumas ERA5 p95
E       = 0.5 * E_slope + 0.5 * E_proxy
```

Cite CHIRPS/POWER/ERA5 as the rain substitutes and IMERG as blocked.

### 2.3 Combining, rounding, confidence

```
score = round_half_up( sum(weight_i * component_i) / sum(weights used) )
```

- Round each component to **one decimal** before the weighted sum. Round the published score to the **nearest integer**, with `.5` rounding away from zero (equivalently `floor(x + 0.5)` for positive x).
- If a component is omitted, drop its weight and renormalize the rest so used weights sum to 1. Record `weightsUsed` and `gaps`.
- **Confidence** starts at **medium** at best (satellite vs 1–2 ha chacra, SoilGrids uncertainty). Drop to **low** if any of: ET null or flagged zero; `fieldPixelStatus` PENDING/PARTIAL and water/veg still depend on the app point; SMAP missing and ET is from a bare point; erosion POWER/ERA5 diverge by >2×; `engine.confidence` is already `low`.

Formula version `ceres-field-score.v1` is part of the score JSON and of any digest. Changing anchors or weights requires `v2`.

> **Update 14 Nov ~06:10:** evidence was regenerated with the completed field-pixel ECOSTRESS/HLS pulls and the Fuji `_note`. The fixture is now **58 / medium** (water 46.3 from ET 66.1 / ET0 142.9; S2 0.273 vs field-pixel HLS 0.387 no longer diverge; no PENDING flag). The table below is the original derivation, kept for the method. Source of truth: `x402/test/field-score.test.mjs`.

### 2.4 Worked example (implementation test only) — El Algarrobal, period 202610

Inputs are from `avalanche/oracle/evidence/algarrobal-202610.json`. This score is **the reference output of this draft formula**, not a validated agronomic rating and not a number to put on the NASA project page until the team has generated it from code and reviewed it.

| Component | Calculation | Value |
|---|---|---:|
| Water | ET 67.4 / ET0 142.9 = 0.4717; no SMAP | 47.2 |
| Vegetation | S2 NDVI 0.273 (11 clear scenes); HLS app-point 0.069 ignored for the index, shown as a gap | 22.4 |
| Soil | texture 55.8, SOC 100, pH 68.0; mean | 74.6 |
| Climate | preferred frost climatology 0 days < 0 °C; heat TODO | 100.0 |
| Erosion | slope 8.4° → 66.4; p95 mean (1.544, 1.273) = 1.4085 → 76.5; mean | 71.5 |
| **Score** | 0.25×47.2 + 0.25×22.4 + 0.20×74.6 + 0.15×100.0 + 0.15×71.5 = 58.045 | **58** |
| Confidence | **low** | PENDING field-pixel ET/HLS, no SMAP, SoilGrids caveat |

Do **not** hardcode scores for Carumas or Samegua. Implement one function, snapshot its output in a unit test, and display whatever the function returns. Carumas should pick up SMAP in `_context.soilMoisture` (October 2026: 0.083 vs baseline 0.086). Samegua vegetation must use Sentinel-2 (0.626 in October), not the bare-point HLS 0.04.

### 2.5 Output schema (for the drawer and the API)

```json
{
  "formulaVersion": "ceres-field-score.v1",
  "farmKey": "moquegua:algarrobal",
  "period": 202610,
  "score": 58,
  "confidence": "low",
  "components": {
    "water": {"value": 47.2, "weight": 0.25, "inputs": {"et_mm": 67.4, "et0_mm": 142.9, "esi": 0.472, "smap": null}},
    "vegetation": {"value": 22.4, "weight": 0.25, "inputs": {"ndvi": 0.273, "dataset": "ESA Sentinel-2 L2A 10 m"}},
    "soil": {"value": 74.6, "weight": 0.20, "source": "ISRIC SoilGrids 2.0 (NON-NASA)"},
    "climate": {"value": 100.0, "weight": 0.15, "inputs": {"frost_clim_days_lt0": 0.0, "heat": "TODO"}},
    "erosion": {"value": 71.5, "weight": 0.15, "note": "unitless proxy, not soil loss"}
  },
  "gaps": ["smap TODO", "heat TODO", "fieldPixelStatus PENDING/PARTIAL", "IMERG blocked; CHIRPS/POWER/ERA5 substitutes"],
  "evidenceFile": "avalanche/oracle/evidence/algarrobal-202610.json",
  "dataHash": null,
  "anchor": {"chainId": 43113, "tx": null, "block": null, "registry": null}
}
```

`dataHash` / `anchor` stay null until the attester has run (§6).

---

## 3. The field drawer

Opens from the marker, the InfoWindow, or `/app?farm=`. Spanish farmer copy first; English available. Sections in order:

1. **Header:** farm name, crop, cultivation-pixel coordinates, score (or "sin puntaje"), confidence, period.
2. **Score breakdown:** the five components, weights, raw inputs, dataset chips (dataset · date · scale), gaps, SoilGrids "no es un producto NASA."
3. **Rotation / management strategies (challenge-required):** at least three including current. Each card: why, evidence, benefits, gaps, risks (and `mainRisk`), soil levers. Same numbers as the SI engine after W8 in the implementation doc. El Algarrobal under default priorities is **drip + strip cover**, 12,890 vs 17,070 m³/ha/yr (−24.5%), modeled from NASA POWER 2001–2025 + FAO-56, not metered; P10–P90 12,510–13,170. Carumas: haba-avena, engine confidence low. Samegua: maiz-arveja, engine confidence low. Priority sliders in the drawer must re-rank **offline** (implementation W3).
4. **Season timeline:** bare months and vulnerable seasons from `extensions.cover` + frost (implementation W4). Real HLS/S2/MODIS, not the flat synthetic NDVI.
5. **Registro verificable** badge: if attested, a check and a link to `https://testnet.snowtrace.io/tx/<hash>`. If not, "aún no anclado." Farmer text: "Quedó un registro verificable de este puntaje y de la evidencia. Cualquiera puede comprobar que esos datos no se cambiaron." No wallet button on this path. Do not link nofiscan unless 880024 is actually producing blocks (roadmap).
6. **Talk to CERES** — existing floating panel, pre-loaded with this farm's figures.

Do not show USDC amounts, faucets, or cash-out in the farmer drawer. A "For judges / API" link may appear in English/judge mode only.

---

## 4. Free vs paid tiers

### 4.1 Farmer (free)

- The map, the score, the drawer, the season timeline, and CERES voice/chat for the three pilot farms.
- Static evidence already bundled in the site (same bytes that can be hashed).
- No wallet, no payment, no account required.

CERES may, in a later wiring, pay the oracle from an operator wallet so the farmer never sees crypto (existing comment in `avalanche/x402/server.mjs`). That is an operator concern, not a farmer UX.

### 4.2 B2B / judges (x402, testnet)

The demo runs on **Avalanche Fuji C-Chain**, not the NØFI L1.

| Item | Value |
|---|---|
| Network | Avalanche Fuji C-Chain |
| Chain ID | `43113` (x402 network id `eip155:43113`) |
| RPC | `https://api.avax-test.network/ext/bc/C/rpc` |
| Explorer | [Snowtrace testnet](https://testnet.snowtrace.io/) |
| Payment asset | Circle Fuji USDC `0x5425890298aed601595a70AB815c96711a31Bc65` (EIP-3009, so **no `X402TestUSDC` deploy**) |
| Wallet | Core (Avalanche), Testnet Mode on |

**EIP-712 domain** for Circle Fuji USDC, read on-chain via `eth_call` to the Fuji RPC on 14 November 2026 (selectors `name()` `0x06fdde03` and `version()` `0x54fd4d50`; `cast` was not installed on the box, so the calls were raw JSON-RPC). Use **exactly** these strings in the payment requirements:

| Field | Value |
|---|---|
| `name` | `USD Coin` |
| `version` | `2` |
| `chainId` | `43113` |
| `verifyingContract` | `0x5425890298aed601595a70AB815c96711a31Bc65` |

**Wallet roles (three different addresses).** Facilitator and payTo are TBD by Chris. **payTo must not be the payer address.**

| Role | Address | Holds |
|---|---|---|
| **Payer** (demo wallet, Chris's Core) | `0xd53913602715d0B9b783601Ea3C4759D389be7dC` | Fuji USDC from Circle's testnet faucet. Needs no gas (EIP-3009). |
| **Facilitator** | TBD (Chris) | Fuji AVAX for gas. Submits `transferWithAuthorization`. |
| **payTo** (Ceres treasury) | TBD (Chris) | Receives the payments. Must **not** be the payer address. |

Chris may swap the payer for a dedicated demo account in Core. If so, he will send the new address. Keys stay out of the repo, chat, and docs.

Keep the existing free `GET /health` and `GET /v1/farms`. Keep `GET /v1/earth/:farm/:period` as a compatibility alias of the evidence endpoint.

New (or renamed) paid routes, all x402 v2 `exact` + EIP-3009, self-hosted facilitator, same stack as `avalanche/x402/`:

| Method | Path | What it returns | Suggested demo price |
|---|---|---|---|
| GET | `/v1/field/:id/score` | `ceres-field-score.v1` JSON for the latest (or `?period=YYYYMM`) month | **0.02 Fuji USDC** |
| GET | `/v1/field/:id/evidence` | Full evidence JSON + canonical `dataHash` + `proof` (registry verify, payment tx, explorer URL) | **0.05 Fuji USDC** (same as today's `X402_PRICE` default `50000` atomic, 6 decimals, already in `avalanche/x402/config.mjs`) |
| GET | `/v1/field/:id/history` | All available months (202607–202610 today) with per-month score + evidence hashes | **0.10 Fuji USDC** |
| GET | `/v1/region/report` | The three-farm Moquegua pack: scores, recommended strategies, hashes, gaps | **0.25 Fuji USDC** |

`:id` is `algarrobal` | `carumas` | `samegua` (the same slugs as `/v1/earth/carumas/202610`).

**These prices are demo / testnet only.** They are not a market tariff, not a mainnet price, and not a claim about willingness to pay. Label every API doc, 402 response `resource.description`, and `/api-docs` page: **"Testnet demo pricing. Not a commercial offer."**

**P0:** evidence (and/or `/v1/earth`) and `/v1/field/:id/score` must complete a live 402 → pay → 200 on Fuji (`eip155:43113`), serving **`oracle/evidence`, not `oracle/examples`.** History and region report may ship as P1 if time is short, but `/v1/farms` should list whatever is actually payable.

Paid responses include today's `proof` object (`registry`, `recordedOnChain`, `paymentTx`, `paymentTxUrl`, `registryUrl`). The payment receipt must link to the **Snowtrace testnet** tx and, when `recordedOnChain` is true, to the registry / verify URL. If the month is not yet attested, return the data after payment and set `recordedOnChain: false` honestly.

**`pagar.html` (judge page):** use EIP-6963 provider discovery and select **Core** explicitly (Core and MetaMask both inject `window.ethereum`). Add a "switch to / add Fuji" button using `wallet_switchEthereumChain` → `wallet_addEthereumChain` (chain id `0xa869` / 43113, RPC and Snowtrace as in the table above). Flow: request → **402** → Core signs EIP-3009 typed data (`eth_signTypedData_v4`, domain name `USD Coin`, version `2`) → **200** + `proof.paymentTx` Snowtrace link. The first test to run, before anything else, is that Core signs `TransferWithAuthorization` on Fuji and the facilitator settles it.

### 4.3 Who is charged, in the pitch

- Farmers: free.
- Intended later buyers (hypotheses, §5): pay per lookup.
- Judges: use `avalanche/x402/web/pagar.html` (judge mode), not the farmer FAB.

---

## 5. Buyer personas and use cases (hypotheses only)

No logos of customers, no "pipeline," no market-size numbers, no claimed contracts.

| Persona (hypothetical) | Job to be done | What they would look up | Why a verifiable record might matter |
|---|---|---|---|
| Crop insurance underwriter | Screen a named parcel before writing or renewing cover | Score, water stress, frost, NDVI history | A hash they can re-check later, same bytes as the month they priced |
| Agri-lender / credit officer | File a look-up next to a loan or input-credit review | Score trend, recommended practice, gaps | Evidence that the snapshot was not edited after the fact |
| Irrigation or producer co-op | Plan water turns or extension visits across members | Region report, bare-soil months, recommended rotations | Shared record the extensionist and the farmer can both open |
| Agro-exporter / ESG or traceability staff | Show a buyer that a grove's water and cover story is sourced | Evidence pack + registro link | Named NASA/partner datasets plus an explorer link |

Say in the pitch: "this is who we designed the API for; we do not have paying customers on this testnet."

---

## 6. On-chain design

### 6.1 What gets anchored

Reuse **`WaterProofRegistry`** (`avalanche/src/WaterProofRegistry.sol`). Do not design a second registry for the hackathon.

- Each farm-month **evidence** JSON is canonicalized and SHA-256 hashed (`dataHash`) with the existing rules in `avalanche/oracle/build-attestation.mjs` and `avalanche/x402/earth-data.mjs` (`canon()`). Farm id on chain = `keccak256(toHex(farmKey))`.
- The Ceres Field Score is a **deterministic function** of that evidence (plus the formula version). P0: verifying the evidence `dataHash` is enough; the API returns the score plus that hash plus `proof.recordedOnChain`.
- P1 (if there is time): also hash the score JSON (`scoreHash`, including `formulaVersion`) and store it in an evidence extension or a new attestation revision so a buyer can prove the published 58 was not recomputed under a quiet formula change.

`verify(farmId, period, dataHash)` stays the read path. Payment settlement already attaches `proof.paymentTx` in `server.mjs`.

Credits / `minNdviForCredit = 200` (NDVI 0.20) still affect the hidden rewards module only. El Algarrobal/Samegua app-point NDVI is below 0.20; that must not appear as a farmer-facing "failed payment." Keep rewards hidden (implementation W10).

### 6.2 Known issues (must fix before a live demo)

These are already in the implementation doc §2 and remain true, except where this section supersedes the older "retarget to 880024" notes:

1. **`build-attestation.mjs` produces NaN if `et_mm.value` is null** (`x10(null)`). El Algarrobal 202608 and 202609 are null. Fix before any on-chain write: skip the month, or encode a documented sentinel and do not claim an ET observation. Prefer attesting a month with non-null ET first (Algarrobal 202610 or a Carumas month).
2. **x402 will serve placeholders unless the load path changes.** `earth-data.mjs` `DEFAULT_DIRS` is `x402/data` then `oracle/examples` — **not** `oracle/evidence/`. `x402/data/` is empty. Point it at `oracle/evidence`. A paid 200 must return real evidence, never `placeholder: true`.
3. **`avalanche/web/registro.html` is already on Fuji** (`avalancheFuji`). **Keep it there.** Make sure links point to [Snowtrace testnet](https://testnet.snowtrace.io/). Do not retarget the demo to 880024 / nofiscan.
4. **`build-attestation.mjs` already defaults `--chain` to 43113.** **Keep that default.** Do not change it to 880024 for this demo.
5. Contracts were tested (`forge test` 26/26, `x402` `npm test` 5/5, as previously recorded) and `DeployNofi` was dry-run; **they were not the live demo deploy** when this plan was written. After the Chris-gated Fuji deploy, put the `WaterProofRegistry` address into config, never a key. The payment asset is Circle Fuji USDC (already deployed); **do not deploy `X402TestUSDC`**.
6. The NØFI L1 (880024) is **roadmap / stretch**, not on the critical path. Do not plan a validator top-up, a block #201 check, or an 11:00 go/no-go for this demo. Do not show nofiscan links unless 880024 is actually producing blocks.

### 6.3 Deploy checklist (chain owner, Chris-gated)

No private keys in the repo or this file. This plan does not authorize broadcasting deploys, funding wallets, or creating keys.

1. Point x402 config at `eip155:43113` and Circle Fuji USDC `0x5425890298aed601595a70AB815c96711a31Bc65`. Use the EIP-712 domain strings in §4.2 (`name` = `USD Coin`, `version` = `2`). Set `X402_PAY_TO` to Chris's treasury address (TBD; must differ from the payer). Facilitator address is also TBD by Chris and must hold Fuji AVAX for gas.
2. Fix the attester null-ET NaN. Keep `--chain` default **43113**.
3. Point `earth-data.mjs` `DEFAULT_DIRS` at `avalanche/oracle/evidence`.
4. **Chris-gated deploy:** `DeployNofi.s.sol` on **43113** → `WaterProofRegistry` only (no `X402TestUSDC`). Register the three farms. Attest at least one real month with non-null ET (Algarrobal 202610 or a Carumas month). Put the registry address in public config. Verify / link on Snowtrace testnet.
5. Bring up facilitator + earth oracle over **HTTPS** (the Netlify page will block `http://` as mixed content). First **real x402 payment** tx on Snowtrace before the Team1 pitch.
6. **First test to run**, before anything else: confirm **Core signs the EIP-3009 `TransferWithAuthorization` typed data** on Fuji and the facilitator settles it. That is the riskiest single step; everything after it is config.
7. Domain-restrict the Maps key and any RPC keys. No secret keys in the site folder.

Team1 pitch line, used honestly: *"Running on Fuji C-Chain today. The same contracts deploy unchanged to the NØFI L1 (880024), which gives us stablecoin gas and an oracle allowlist."* Do not claim the L1 is live.

Chris must explicitly approve contract broadcast and any funding. This plan does not authorize those actions.

---

## 7. Demo scripts

### 7.1 NASA / Space Apps — 30 seconds or less

English audio or English subtitles if spoken in Spanish. Lead with data and decisions. **No wallet, no 402 in this cut.**

1. Hybrid map of Moquegua, three named fields (0–5 s).
2. Click El Algarrobal; score breakdown visible; "low confidence / pending field pixel" is honest (5–12 s).
3. Drawer: current gravity bare soil 17,070 vs recommended drip + strip cover 12,890 m³/ha/yr, −24.5%, modeled; one evidence chip (POWER or ECOSTRESS or Sentinel-2) (12–22 s).
4. CERES says one Spanish sentence about that comparison; cut to the registro verificable badge (or "aún no anclado" if the tx is not live) (22–30 s).

If the badge is not live, do not fake a Snowtrace (or nofiscan) link. End on the comparison and "supports, does not replace, farmer judgment."

### 7.2 Team1 LatAm — about 2–3 minutes

Lead with Fuji C-Chain and a **live** 402 → pay → 200 flow. Do not claim the NØFI L1 is live.

1. Map of the three fields with scores. Judge line, verbatim: *"Running on Fuji C-Chain today. The same contracts deploy unchanged to the NØFI L1 (880024), which gives us stablecoin gas and an oracle allowlist."* (~20 s).
2. Open El Algarrobal (or Carumas if that month is the attested one). Registro verificable → **Snowtrace testnet** record. Download or show the JSON; `dataHash` matches (~40 s).
3. On the judge page (`pagar.html` / `/api-docs`): `GET /v1/field/algarrobal/score` or `/evidence` → **HTTP 402** → Core signs EIP-3009 typed data (`eth_signTypedData_v4`, domain `USD Coin` / `2`) → **200** JSON + `proof.paymentTx` link on Snowtrace testnet (~60–70 s).
4. One sentence on the business: farmers use the map and CERES free; insurers, banks, co-ops, and exporters are who the pay-per-lookup API is for (hypothesis, testnet prices) (~15 s).
5. Stop after the pitch line in beat 1. Do not invent Warp/ICM, a live L1, or nofiscan links as live unless 880024 is actually producing blocks (~15 s reserved if a judge asks about the L1).

---

## 8. Build tasks for the next ~40 hours

Priority: **P0** must be in the public demo before Sunday 15 Nov 23:59 Peru time. **P1** if the P0 slice is solid. **P2** only if ahead. Owners: frontend, data, chain, voice. The Google Maps key and billing are Chris (or a named owner) but frontend wires the empty-state.

### P0

| ID | Item | Owner | Acceptance |
|---|---|---|---|
| M1 | Restrict the existing `GOOGLE_MAPS_API_KEY` (HTTP referrers), add a Map ID, set the same var as a **Netlify env var**, inject at build, CSP | Chris + frontend | Key is read from `/workspace/space-apps-2026/.secrets/google-maps.env` locally; value never committed or pasted into docs; localhost + production referrers only; missing-key empty state still lists farms |
| M2 | Hybrid Google Map on `/` (hero) and `/app`, AdvancedMarkers, InfoWindow, fit bounds to the three sites, deep link `?farm=` | frontend | Farmer ES copy; app point vs cultivation pixel labeled; no invented polygons; works at 360 px |
| M3 | `ceres-field-score.v1` function + unit test that reproduces the El Algarrobal 202610 score **58** (low confidence) from the evidence JSON | data + frontend | Carumas/Samegua scores generated, not typed; gaps listed; heat not scored; SMAP only on Carumas |
| M4 | Field drawer: score breakdown, ≥3 strategies with why/evidence/benefits/gaps/risks, season timeline, registro badge, CERES entry | frontend | Same numbers as W8 source of truth; sliders re-rank offline; no crypto terms in farmer ES |
| M5 | Still required from the alignment doc: rebrand (W1), strategy cards (W2), offline sliders (W3), timeline (W4), provenance chips (W7), **one water figure (W8)**, hide rewards (W10) | frontend + data | El Algarrobal default winner is drip + strip cover at 12,890 vs 17,070 |
| M6 | x402 load path = `oracle/evidence`; `GET /v1/field/:id/score` and `/evidence` (alias `/v1/earth`); `pagar.html` + `/api-docs`; demo prices labeled | chain + frontend | 402 → pay → 200 returns real evidence, not `placeholder: true` |
| M7 | Fix attester null-ET NaN; keep `registro.html` and the attester default on **43113** / Snowtrace testnet | chain | Can attest a non-null ET month without NaN; badge links to Snowtrace, not nofiscan |
| M8 | Chris-gated: `DeployNofi.s.sol` on 43113 → `WaterProofRegistry` (no `X402TestUSDC`), register farms, one real attest, one real payment tx on Snowtrace; x402 asset = Circle Fuji USDC; facilitator + payTo set by Chris (payTo ≠ payer) | chain (Chris-gated) | Live Snowtrace links in the badge and the payment receipt; Core EIP-3009 sign + facilitator settle works |
| M9 | CERES copy in repo + `retell_setup.py --dry-run` only (W9); 30-s NASA path and 2–3 min Team1 rehearsal (W11 / §7) | voice + frontend + Chris | Live Retell update still gated on Chris |

### P1

| ID | Item | Owner | Acceptance |
|---|---|---|---|
| M10 | Soil panel filled from evidence `extensions.soil`, still labeled NON-NASA | frontend | No invented pits; empty state only if a farm lacked the block |
| M11 | `GET /v1/field/:id/history` and `/v1/region/report` | chain | Listed on `/v1/farms` and `/api-docs` at the demo prices |
| M12 | NDVI or score raster via Deck.gl `GoogleMapsOverlay` or `GroundOverlay`, from generated tiles with dataset + date | frontend + data | No fake heat surface over three points |
| M13 | Climate **trends** strip in the drawer from `CERES_NASA_DATA.farms.*.climate.trends` (POWER 1981–2025; show p-value; Samegua POWER cell caveat) | data + frontend | No significant trend claimed where `mann_kendall_p` is not small |
| M14 | Add heat (preferred series) and, if Harmony allows, SMAP for Algarrobal/Samegua into evidence, then bump the formula only if versioned `v1.1` / `v2` | data | Heat not applied at Samegua via 14.8 °C POWER lapse |
| M15 | Optional `scoreHash` attestation (formula version included) | chain | Documented in the API `proof` object |
| M16 | Landing-page B2B / buyers section and `/api-docs` polish | frontend | Hypotheses, no invented customers |

### P2

| ID | Item | Owner | Acceptance |
|---|---|---|---|
| M17 | FIRMS fire-history layer | data + frontend | No layer until a cited pull exists |
| M18 | Farmer-confirmed field polygons; Places or Geocoding search | frontend | Source of the polygon recorded |
| M19 | IMERG rainfall after the GES DISC EULA is accepted | data | CHIRPS label removed only when IMERG actually lands |
| M20 | Extra attested months; CERES-agent autopay; ICM/Warp only if live | chain | Never described as live if they are not |

**Cut order if you slip:** P2 FIRMS/polygons/Places → P1 raster tiles and history/region report (keep score + evidence 402) → extra attested months (keep one) → trends strip → SoilGrids typography polish. **Do not cut** the Google Map of the three fields, the score, the drawer recommendations, W8 consistency, provenance chips, offline re-rank, the registro badge, x402 on real evidence, or hide-rewards.

Suggested Saturday order (Peru time), on top of the alignment-doc schedule: morning, key + map scaffold + attester null-ET fix + x402 load path and Fuji/USDC config (no validator work); mid-day, score function + W8 numbers + drawer; afternoon, Chris-gated Fuji deploy/attest and first 402 payment (Core EIP-3009 sign first), badge wiring to Snowtrace; evening, landing hero map, B2B copy, voice dry-run; Sunday, overlays if time, video, Team1 rehearsal with the Fuji pitch line, private-window QA.

---

## 9. Out of scope

- Submitting the Space Apps project, posting, emailing organizers, or creating the official team.
- Spending on Google Cloud, broadcasting deploys, funding wallets, creating keys, or updating Retell, without Chris's explicit go.
- Inventing IMERG, SMAP for coastal farms, FIRMS, field polygons, yield, prices, customers, or market size.
- Reading or committing private keys or the Maps API key.

When a value is missing, show the gap. That is a Validity feature, not a failure.
