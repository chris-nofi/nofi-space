# Ceres Ventures: Landing Page Spec (for Codex)

**Goal:** a single landing page that wins two audiences in 30 seconds, then sends them to the dashboard (`/workspace/ceres-ai`, current `index.html` becomes `/app`). The **hero and the dashboard core are a Google Maps hybrid map of Moquegua farms**.

- NASA Space Apps judges: Impact, Creativity, Validity, Relevance, Presentation. The challenge is "Field Shift: Adapting Farms with NASA Data".
- Team1 LatAm Avalanche judges: a live x402 pay-per-request on **Avalanche Fuji C-Chain (43113)**, with a verified record on that testnet; built to move to the NØFI L1. Pitch line: *"Running on Fuji C-Chain today. The same contracts deploy unchanged to the NØFI L1 (880024), which gives us stablecoin gas and an oracle allowlist."* Do not claim the L1 is live.

**Changelog — Saturday 14 November 2026, ~04:15 Peru time (UTC-5)**

- Demo network switched to **Avalanche Fuji C-Chain (43113)** with Circle Fuji USDC. Positioning is now "verified record on Avalanche (Fuji C-Chain testnet); built to move to the NØFI L1." Explorer is Snowtrace testnet. nofiscan is roadmap only. Dropped validator top-up, block #201, the 11:00 go/no-go, and any `X402TestUSDC` deploy. Demo prices are labeled "Testnet demo pricing. Not a commercial offer."
- (Earlier, ~03:50 Peru time) Re-centered on the locked Zip2-style positioning: each field gets a NASA soil-and-water score and a verified record; insurers, banks, co-ops and agro-exporters pay per lookup through x402; farmers use the map and CERES free. Crop-rotation and soil health stay inside the score and field view. The live chain for that record is now Fuji, per the entry above.
- The map is **Google Maps JavaScript API** (Chris's choice: satellite/hybrid, AdvancedMarkerElement, Data layer or Polygons, InfoWindow + side drawer). Not Leaflet or MapLibre.
- Added a **For buyers** section and tightened the x402 API section to the `/v1/field/...` endpoints and labeled testnet prices.
- API key: the value lives at `/workspace/space-apps-2026/.secrets/google-maps.env` as `GOOGLE_MAPS_API_KEY`. **Never paste the key into this repo, this document, or the client source.** Set the same variable name as a **Netlify env var** and inject it at build. Restrict it with **HTTP referrers** (localhost + the production domain). Full setup: `mentor/farm-map-x402-plan.md` §1.2.
- Everything else below that is still valid stays: routes, trust-strip datasets, live El Algarrobal numbers only from evidence, farmer wording, acceptance checks, AI disclosure, "NASA does not endorse this project."

**Constraints**

- Static site with vanilla HTML/CSS/JS, so it deploys on Netlify with the current `_headers` and `_redirects`.
- English by default, with an ES toggle.
- The farmer-facing wording avoids crypto terms ("registro verificable"). Chain detail appears only in the "For builders / Judges / Buyers" sections.
- Never hardcode metrics. Every number comes from `oracle/evidence/*.json` or `window.CERES_NASA_DATA`. Any example value is labeled "example data". The Ceres Field Score must come from `ceres-field-score.v1` (see the farm-map plan), not a typed constant, except the documented unit-test fixture for El Algarrobal 202610.
- Brand: teal palette from the logo, a dark hero, and the light-background logo variant for light sections.
- Google Maps ToS: keep Google attribution visible. If `GOOGLE_MAPS_API_KEY` is missing, show a static satellite/fallback image and still render the three farm cards.

## Routes

- `/` is the landing page (new `landing.html`, served as the index).
- `/app` is the dashboard (current `index.html`, moved). The main view is the Google Map.
- `/app?farm=<id>` deep-links one farm (El Algarrobal, Carumas, Samegua), pans to it, and opens the field drawer.
- `/verify/<digest>` is the record verification page (adapt `avalanche/web/registro.html`, already on Fuji; default chain **43113**, Snowtrace testnet). Do not point this page at nofiscan unless 880024 is actually producing blocks.
- `/api-docs` is the x402 field API page for buyers and judges.

## Sections (in order)

1. **Nav:** logo, How it works, The map, NASA data, For buyers, Verifiable, For builders, ES/EN toggle, and a primary CTA "Open map" / "Open dashboard" linking to `/app`.
2. **Hero (the map)**
   - Headline (draft): "A map of Moquegua farms, scored with NASA data, recorded so it can be checked."
   - Subhead: Each field gets a NASA soil-and-water score and a verifiable record. Farmers compare crop-rotation and soil-health options, and can ask CERES by voice in Spanish, at no charge. Insurers, banks, co-ops, and agro-exporters are who the pay-per-lookup API is for (testnet, not a claim of customers).
   - **Hero media:** an interactive Google Map, `mapTypeId: "hybrid"`, fitted to El Algarrobal, Carumas, and Samegua, with `AdvancedMarkerElement` score badges. Clicking a marker opens a short InfoWindow and a "View field" CTA into `/app?farm=<id>`. Use the cultivation pixels and labeling rules in `mentor/farm-map-x402-plan.md` §1.5. Do not invent field polygons.
   - CTAs: "Open map", "Talk to CERES" (the Retell web call already in `ceres.js`), and a secondary "For buyers" jump to section 9.
   - Trust strip: dataset badges for SMAP, ECOSTRESS, HLS/Landsat, MODIS, POWER, GPM/IMERG (pending), SRTM, and Sentinel-2 (ESA).
3. **The problem:** water scarcity, soil degradation and single-crop risk in Moquegua. Use 3 cards with sourced figures only, otherwise TODO.
4. **How it works (4 steps):** open the map and pick a field; read the Ceres Field Score (water, vegetation, soil, climate, erosion); compare 3 or more rotations or management strategies, including the current one, against your priorities; then get an anchored "registro verificable" for that score and recommendation.
5. **Live example (hero proof):** an El Algarrobal card read from the evidence JSON and from `ceres-field-score.v1`.
   - Score for period 202610 must be produced by the function (unit-test fixture: **58**, confidence **medium** after the field-pixel data landed 14 Nov; see `ceres-system-design.md`). Show the confidence flag, whatever it is.
   - Current rotation vs. recommended (drip plus strip cover), with water use in m³/ha/yr from evidence: 12,890 vs 17,070 (−24.5%), modeled, not metered.
   - Why it was suggested, the evidence, benefits, information gaps, and risks needing local review.
   - A "View in map" link to `/app?farm=algarrobal`.
6. **Season timeline teaser:** a 12-month strip of bare-field periods and vulnerable months (NDVI, frost days), built from the evidence `extensions` block.
7. **NASA data, explained:** one tile per dataset covering what it measures, resolution, date range, and how Ceres uses it (including how it feeds the score). Add a satellite-vs-ground note and a "supports, doesn't replace, farmer judgment" note. Link a glossary (ET, NDVI, soil moisture anomaly, frost risk, water balance, Field Score).
8. **Verifiable by design (Avalanche):** a full section, not a footnote.
   - Farmer view: "Every score and recommendation gets a tamper-proof record."
   - Judge view: a diagram of NASA data, then the Earth oracle, then the evidence digest, then `WaterProofRegistry` on **Avalanche (Fuji C-Chain testnet)**, then the [Snowtrace testnet](https://testnet.snowtrace.io/) link. Built to move to the NØFI L1.
   - A live widget showing the latest anchored records (block, tx hash, farm, period) read from the Fuji RPC or a cached JSON fallback.
   - Why an L1 (roadmap, not claimed live): the Team1 pitch line, verbatim — *"Running on Fuji C-Chain today. The same contracts deploy unchanged to the NØFI L1 (880024), which gives us stablecoin gas and an oracle allowlist."* Do not show nofiscan links unless 880024 is actually producing blocks. Do not invent Warp/ICM as live.
9. **For buyers (B2B)**
   - Headline (draft): "Look up a field. Pay per request. Check the record."
   - Hypothetical users only — crop insurance underwriting, agri-lending, co-op planning, exporter traceability and ESG. No invented customers, logos, or market numbers.
   - Farmers stay free (map + CERES). Buyers use the x402 API on Fuji testnet, paid in Circle Fuji USDC. Demo prices are labeled "Testnet demo pricing. Not a commercial offer."
   - CTA: "Read the API" → `/api-docs`.
10. **x402 field API (for builders and judges):** a "Pay-per-query NASA farm evidence" panel.
    - Endpoints: `GET /v1/field/{id}/score`, `/v1/field/{id}/evidence`, `/v1/field/{id}/history`, `/v1/region/report` (plus the existing `/v1/earth/:farm/:period` alias). Suggested testnet prices are in the farm-map plan §4.2 (0.02 / 0.05 / 0.10 / 0.25 Fuji USDC). Network `eip155:43113`. EIP-712 domain for the asset: name `USD Coin`, version `2` (read on-chain; see §4.2 of the farm-map plan). Wallet roles (payer / facilitator / payTo) are in that same table; payTo must differ from the payer.
    - A code snippet of an HTTP 402 request, then payment, then the JSON response with `proof.paymentTx` and `recordedOnChain`.
    - A "Try it" button calling the x402 demo (`avalanche/x402`) on testnet. It must serve `oracle/evidence`, not `oracle/examples`.
11. **CERES voice assistant:** a short demo clip or button. Spanish first, works on a basic phone, free for the farmer.
12. **Impact and roadmap:** pilot farms, next valleys, partners (only real ones), and a link to the open data and code. No invented partners.
13. **Team:** names and roles (TODO, Chris to supply), plus "Built at NASA Space Apps Moquegua 2026".
14. **Footer**
    - AI-use disclosure.
    - Data attributions (NASA, ESA Copernicus, ECMWF ERA5, SoilGrids/ISRIC, CHIRPS).
    - Maps attribution as required by Google.
    - Note: "NASA does not endorse this project."
    - Links to GitHub, project page and contact.

## Components and data contract

- `loadEvidence()` fetches `oracle/evidence/index.json` (or builds the farm list) and exposes `{farm, period, metrics, score, strategies[], extensions{soil, s2_ndvi, frost, slope, erosion}, digest, anchor{chain, tx, block}}`.
- Shared components with the dashboard: Google field map, ScoreBadge, StrategyCard, DatasetChip (source, date, resolution), RecordBadge, SeasonStrip, FieldDrawer.
- Show PENDING or PARTIAL flags from the evidence visibly. Never hide them.
- Maps bootstrap reads `GOOGLE_MAPS_API_KEY` and optional `GOOGLE_MAPS_MAP_ID` from build-injected config, not from a committed file.

## Acceptance criteria

- Lighthouse: performance ≥ 90 and accessibility ≥ 95, mobile-first, and it works at 360 px. If the Maps script prevents a 90 performance score, document the measured number and lazy-load the map below a static first paint; do not fake the audit.
- No number appears without a source chip, and the ES/EN toggle covers all copy.
- "Open map" lands on `/app` with the same farm selected when coming from a field card, and the visual style matches between the two.
- The record badge resolves to a real Snowtrace testnet transaction. Do not use a nofiscan link unless 880024 is actually producing blocks.
- The x402 "Try it" flow shows 402, then pay, then 200 with real evidence or score JSON.
- The hero map uses hybrid imagery, the three real coordinates, and no invented polygons. Missing key → fallback, not a broken page.
- No secrets, private keys, or the Maps API key value in the repo. Testnet only.

## 30-second demo path (for the NASA video)

Hybrid map of the three fields, then the El Algarrobal drawer (score + 12,890 vs 17,070), then sliders re-ranking the strategies, then CERES answering in Spanish, then the registro badge (Snowtrace testnet only if a real tx exists). **No wallet or 402 in the NASA 30-second cut.** The Team1 2–3 minute pitch (map + live 402 → pay → 200, opening with *"Running on Fuji C-Chain today. The same contracts deploy unchanged to the NØFI L1 (880024), which gives us stablecoin gas and an oracle allowlist."*) is in `mentor/farm-map-x402-plan.md` §7.2.
