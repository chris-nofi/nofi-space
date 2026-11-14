# Ceres Ventures — System design: how it all works together + the new website

**For:** Codex and Chris's devs. **Written by:** Claude, Saturday 14 November 2026, ~05:45 Peru time (UTC-5).
**Deadline:** Sunday 15 November 2026, 23:59 Peru time.
**State:** the website, map, score, x402 API (as a Netlify Function) and Fuji contracts are **built and tested locally**.
Nothing has been deployed to Netlify or Fuji yet; that is Chris-gated (§9).

**Update ~06:10 (after the architecture reconciliation review):**
- **Evidence regenerated** (Gate B). `_note` now targets Fuji 43113 (D2 resolved). Regenerating also picked up the field-pixel
  ECOSTRESS + HLS pulls that finished at 03:01/03:31, after the 02:32 build: `fieldPixelStatus` is now **complete** for El Algarrobal
  and Samegua (their ET/NDVI moved from the bare app point to the crop). Nothing was anchored before, so no record is invalidated.
  `dataHash` agrees 12/12 across the site build, the x402 API and the attester.
- **Repo reconciliation.** `chris-nofi/nofi-space` main has PR #1's static `site/` (880024-era). This tree goes onto a new branch
  `feat/ceres-web-integration`; `site/` stays as archive and as the source of `/legacy/` until C1. Build supports both layouts.
  Root `netlify.toml` sets `base = "ceres-web"`; `ceres-web/netlify.toml` is the deployment config.

Detailed product specs this document ties together (still authoritative for copy and rules):
`mentor/farm-map-x402-plan.md` (product, score formula, map rules), `mentor/landing-page-outline-for-codex.md` (landing sections),
`mentor/ceres-challenge-alignment-implementation.md` (NASA challenge work items W1–W13).

---

## 1. One paragraph

A map of three Moquegua farms (El Algarrobal olive, Samegua alfalfa, Carumas potato). Each field gets a **Ceres Field Score**
(water, vegetation, soil, climate, erosion) computed from named NASA/partner datasets, rotation and management options the farmer can
re-rank by priority, a 12-month season strip, and a **registro verificable**: the evidence file's sha256 is anchored in
`WaterProofRegistry` on **Avalanche Fuji C-Chain (43113)**. Farmers use it free (and by voice with CERES). Insurers, lenders, co-ops and
exporters buy the same score/evidence per request through **x402**, paid in Circle test USDC. *"Running on Fuji C-Chain today. The same
contracts deploy unchanged to the NØFI L1 (880024), which gives us stablecoin gas and an oracle allowlist."*

---

## 2. Architecture

```
 NASA / partner data pulls (space-apps-2026/data/*.py)
   ECOSTRESS · HLS · SMAP · POWER · MODIS · SRTM · Sentinel-2 · CHIRPS · ERA5-Land · SoilGrids
                 │
                 ▼
 Evidence JSON, one per farm-month          space-apps-2026/avalanche/oracle/evidence/<farm>-<YYYYMM>.json
 dataHash = sha256(canonical JSON)           canonical = keys sorted recursively, no whitespace
                 │
     ┌───────────┼──────────────────────────────┬──────────────────────────────────────┐
     ▼           ▼                              ▼                                      ▼
 Website (free)          x402 oracle (paid)                   Attester (oracle key, Chris)        Verify page
 ceres-web/dist          Netlify Function /v1/*               oracle/build-attestation.mjs        /verify/<dataHash>
  /data/evidence/*.json   same evidence, inlined at build      → cast send attest(...)             raw eth_call
  field-score.mjs ◄──────── same field-score.mjs ──┐                 │                          to Fuji RPC
  (browser computes)      402 → EIP-3009 sig → 200 │                 ▼                               │
                          facilitator settles      │        WaterProofRegistry (Fuji 43113) ◄────────┘
                          USDC on Fuji ────────────┼──► proof.recordedOnChain = verify(farmId, period, dataHash)
                                                   │
                          Circle Fuji USDC 0x5425…Bc65 (domain "USD Coin" / "2")
```

Key property: **one evidence file, one hash, one score function** everywhere. The map, the paid API, the registry and the verify
page can never disagree, and anyone can re-hash the JSON they bought.

---

## 3. Repo map

```
ceres-web/                      ← THE NEW WEBSITE (deploy this to Netlify)
  netlify.toml                  build = npm run build, publish = dist, functions = netlify/functions
  scripts/build.mjs             assembles dist/ + the function bundle from the folders below
  scripts/serve.mjs             local preview that behaves like Netlify (static + /v1/* function) on :8888
  attestations.json             anchored records {"<farm>/<period>": {tx, block}} + registry address — fill after each attest
  src/index.html                landing (EN default, ES toggle)       src/assets/landing.js
  src/app/index.html            map dashboard + field drawer (ES default) src/assets/app.js
  src/api-docs/index.html       x402 API docs with live /health status
  src/verify/index.html         record check, /verify/<dataHash> deep links
  src/assets/maps.js            Google Maps component (shared by landing + app)
  src/assets/data.js            data layer, offline strategy ranking, on-chain verify
  src/assets/site.css           design system (teal brand)
  netlify/functions/oracle.mjs  x402 API → createHandler() from avalanche/x402/server.mjs
  dist/                         generated (gitignored). Contains config.js with the Maps browser key.
space-apps-2026/avalanche/
  src/WaterProofRegistry.sol    registry (attest, attestWithSig, verify, latest)
  script/DeployNofi.s.sol       Fuji: registry only + registers moquegua:{carumas,samegua,algarrobal}
  oracle/evidence/              the 12 real evidence files (202607–202610 × 3 farms)
  oracle/build-attestation.mjs  evidence → Attestation tuple + cast commands (refuses null-ET months)
  x402/server.mjs               createHandler (transport-agnostic) + createApp (Node http)
  x402/facilitator.mjs          exact + EIP-3009 verify/settle (self-hosted)
  x402/field-score.mjs          ceres-field-score.v1, pure, no deps — used by API AND browser
  x402/web/pagar.html           judge page (Core via EIP-6963, add Fuji, 402 → sign → 200) → served at /pagar/
ceres-ai/                       previous dashboard (Agua Clara) → served unchanged at /legacy/ (CERES voice lives here today)
```

---

## 4. Data contract

| File (in dist) | Built from | Used by |
|---|---|---|
| `/data/evidence/<farm>-<period>.json` | `avalanche/oracle/evidence/` (placeholders refused) | score, drawer chips, verify download |
| `/data/index.json` | evidence + `attestations.json` | farm list, periods, `dataHash` per month, `farmId = keccak256(farmKey)`, `verify` selector, anchored txs |
| `/data/farms.json` | `ceres-ai/app.js` DB + evidence `_context.fieldPixel` | map markers, labels, crop, ha, elevation, region facts (sourced) |
| `/data/strategies.json` | `ceres-ai/app.js` DB texts; El Algarrobal water from `data/out/ceres-site-data.json` `strategies_recomputed` | drawer options, landing example |
| `/data/season.json` | `data/out/risk_extensions.json` | 12-month NDVI/bare/frost strip |
| `/assets/field-score.mjs` | copied from `avalanche/x402/field-score.mjs` | in-browser score (same module as the API) |
| `/assets/config.js` | env at build | Maps key + Map ID, chain, RPC, explorer, USDC, registry |

Farm ids: `algarrobal`, `carumas`, `samegua` (`el-algarrobal` accepted as an alias by the API and `/app?farm=`). Farm keys on chain:
`moquegua:<id>`. Periods: `YYYYMM`, 202607–202610, default = latest.

**Score (`ceres-field-score.v1`).** Spec in farm-map plan §2. Rounding fixed: sub-scores → 1 dp; components → 1 dp; score = weighted mean
over weights actually used → integer, half away from zero, IEEE-safe. Missing components drop out and weights renormalise. Fixture:
El Algarrobal 202610 = **58 / medium** (57.82; was 58 / low before the field-pixel data landed). Current outputs (Jul→Oct):
Algarrobal 58m/64/63/58m, Carumas 55/55/49/51, Samegua 69/78/60/62 (m = medium, rest low). Medium is the v1 ceiling.
Any change to anchors/weights = `v2` (see open decision D1).

**Strategies.** Ranking is offline: normalise water (lower better), soil, income across a farm's options; weight by the drawer sliders
(defaults = evidence `engine.priorities`). The **engine's pick** (from evidence) is badged separately from the user's ranking, so the two
are never confused. El Algarrobal water = reconciled W8 method (current 17,070 vs drip + strip cover 12,890 m³/ha/yr, −24.5%, modeled,
not metered). Carumas and Samegua water values are still **example data** and are labeled as such (task C4).

---

## 5. The website

| Route | What | Language |
|---|---|---|
| `/` | Landing: hero = live Google Map, sourced problem facts, how it works, live El Algarrobal example (computed), NASA data tiles, Verifiable section (flow + anchored records/fingerprints), For buyers, x402 API panel, CERES, roadmap, team, footer (attributions, AI disclosure, "NASA does not endorse this project") | EN default, ES toggle |
| `/app/` · `/app/?farm=<id>` | Full-height hybrid map + farm bar + drawer: header (pixel vs app point, month picker, PENDING/PARTIAL flag), score + bars + dataset chips + confidence reasons + gaps, options with priority sliders, season strip, registro badge (live eth_call), CERES links, judge/API link in EN only | ES default, EN toggle |
| `/pagar/` | Judge x402 page (Core wallet). Defaults to the same-origin function | ES + EN note |
| `/api-docs/` | Endpoints, prices, flow, proof fields, errors, live `/health` | EN |
| `/verify/` · `/verify/<dataHash>` | Pick farm/month or deep link; live registry check; download the evidence; re-hash instructions | ES + EN |
| `/legacy/` | Previous Agua Clara dashboard (full analysis, CERES voice via Retell) until C1 lands | ES/EN |
| `/v1/*`, `/health` | x402 API (Netlify Function) | JSON |

Rules carried from the specs: farmer copy never says wallet/token/USDC/gas/blockchain ("registro verificable"); every number has a
source chip or source line; PENDING/PARTIAL and low confidence are shown, never hidden; no invented customers, partners or polygons.

**Map (`assets/maps.js`).** Google Maps JS API, `mapTypeId: "hybrid"`, `AdvancedMarkerElement` score badges at the **cultivation pixel**
(Algarrobal −17.6155,−71.2588; Samegua −17.17996,−70.90147; Carumas stays on its app point −16.81,−70.69 with the 30 m candidate shown
as a separate labeled dot), grey dots for bare app points, a 30 m HLS pixel square ("not the field boundary"), InfoWindow → drawer
(app) or `/app/?farm=` (landing). Map ID: `GOOGLE_MAPS_MAP_ID` if set, else Google's `DEMO_MAP_ID`. Missing/invalid key or blocked
script (`gm_authFailure`, script error, 15 s timeout) → fallback cards, never a blank page. Landing mounts the map after first paint.

---

## 6. Google Maps key

- It is a **browser key**: it is visible in any page that uses it. Protection = **HTTP referrer restrictions** in Google Cloud
  (allow `https://gleaming-sunflower-16cdde.netlify.app/*`, `https://*--gleaming-sunflower-16cdde.netlify.app/*` for previews, the custom
  domain, `http://localhost:*/*`) and **API restriction** to Maps JavaScript API only. Chris: do this in Cloud Console.
- Source of the value at build, in order: env `GOOGLE_MAPS_API_KEY` → `ceres-web/.env.local` (gitignored) →
  `space-apps-2026/.secrets/google-maps.env`. It is written only into `dist/assets/config.js`. Never commit it, never paste it into docs.
- `netlify.toml` sets `SECRETS_SCAN_OMIT_KEYS=GOOGLE_MAPS_API_KEY,GOOGLE_MAPS_MAP_ID` because the key is expected in the output.
- Billing must be enabled on the Cloud project; check current pricing at https://mapsplatform.google.com/pricing/ (do not quote prices).

---

## 7. x402 payments

- Network `eip155:43113`; asset Circle Fuji USDC `0x5425890298aed601595a70AB815c96711a31Bc65`; EIP-712 domain `USD Coin` / `2`;
  scheme `exact`, EIP-3009 `transferWithAuthorization`. Self-hosted facilitator (in the same function) submits and pays AVAX gas.
- Routes and testnet demo prices: `/v1/field/:id/score` 0.02, `/v1/field/:id/evidence` 0.05, `/v1/earth/:farm/:period` 0.05 (alias),
  `/v1/farms` and `/health` free. Every 402 and doc is labeled "Testnet demo pricing. Not a commercial offer."
- Paid response `proof`: `chainId`, `dataHash`, `recordedOnChain` (true / false = not anchored yet / null = no registry), `paymentTx(Url)`.
- Wallet roles: **payer** = Chris's Core demo account `0xd53913602715d0B9b783601Ea3C4759D389be7dC` (Circle faucet USDC, no AVAX needed);
  **facilitator** = fresh hot wallet with a little Fuji AVAX; **payTo** = Ceres treasury, must differ from the payer.
- `validAfter` is backdated 10 minutes (like the x402 reference client). Avalanche mines only when there is traffic; with "now − 5 s"
  the facilitator's simulation against an older latest block reverts. Regression test included.
- Without `X402_PAY_TO` the function still serves `/v1/farms` and `/health` (with `problem`) and answers paid routes with a clear 503.

---

## 8. Chain

- `WaterProofRegistry` via `DeployNofi.s.sol` on Fuji (registry only; `DEPLOY_X402_TOKEN` defaults false). Registers
  `moquegua:carumas|samegua|algarrobal` (the old `moquegua:el-algarrobal` id was a bug: attests would have reverted).
- Anchor: `node oracle/build-attestation.mjs oracle/evidence/algarrobal-202610.json --chain 43113 --registry <addr>` → run the printed
  `cast send … attest(...)` with the oracle keystore. Null-ET months refuse unless `--allow-missing` (sentinel −1).
- After anchoring, add `{"algarrobal/202610": {"tx": "0x…", "block": N}}` and `"registry"` to `ceres-web/attestations.json`, rebuild.
  The badge's live check is authoritative; the file only supplies tx links for the landing table.

---

## 9. Build, preview, deploy

```bash
cd ceres-web
npm ci && npm run build          # dist/ + netlify/functions/_x402/ ; prints what is set/missing
node scripts/serve.mjs           # http://localhost:8888 — static + function, like Netlify
```

**Netlify env vars** (Site configuration → Environment variables, on `gleaming-sunflower-16cdde`):

| Var | Needed for | Secret? |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | map (build) | no (browser key, referrer-restricted) |
| `GOOGLE_MAPS_MAP_ID` | cloud map style (optional) | no |
| `X402_PAY_TO` | paid routes | no |
| `FACILITATOR_PRIVATE_KEY` | settling payments | **yes**, mark secret; hot wallet with only Fuji AVAX |
| `WATERPROOF_REGISTRY` | proof + badge (build and function) | no |
| `ALLOWED_ORIGINS` | CORS (optional) | no |

**Deploy options** (Chris approves; production replaces the current live site):
1. **CLI, full site + API (recommended):** `npx netlify-cli login` once, then from `ceres-web/`:
   `npx netlify-cli link --id 50fa1f38-e2e8-4b7c-97bc-fd1d613720eb` → `npx netlify-cli deploy --dir dist --functions netlify/functions`
   (draft URL to review) → same with `--prod` when happy. Add `.netlify` to `.gitignore` (already there).
2. **Drag and drop `dist/`** at app.netlify.com → site → Deploys: landing, map, drawer, verify work; **`/v1/*` will not** (Drop does not
   deploy functions), so `/pagar/` needs the oracle elsewhere (`?api=https://…`).
3. **Git CD:** connect the repo, Base directory `ceres-web`. Netlify runs the build and bundles the function.

---

## 10. Tests (all green 14 Nov ~05:40)

- `space-apps-2026/avalanche`: `forge test` → 26/26.
- `space-apps-2026/avalanche/x402`: `npm test` → 17/17 (incl. a guard that every evidence file targets 43113 with a complete field pixel) (anvil `--chain-id 43113`, Circle-domain mock token; score fixture + snapshot;
  replay/underpay/redirect/wrong-domain/wrong-chain rejected; idle-chain regression).
- Site browser e2e (Playwright, desktop 1280 and phone 375; Google Maps replaced by a recording stand-in because the build box cannot reach
  Google): landing markers at the right pixels, hybrid + Map ID, marker → `/app?farm=`; drawer 58/medium, 4 options, sliders re-rank
  (drip → deficit when water = 100%), Aug → 64 with missing-water note, Carumas SMAP chip, EN toggle, record "anchored" via live eth_call,
  fallback cards when Maps is blocked, `/verify/<hash>` anchored vs not, `/api-docs` live, `/pagar` 402 → sign → 200 through the
  function, no console errors, no horizontal overflow. **Not yet seen with real Google tiles**: first thing to eyeball after deploy.

---

## 11. Open decisions (Chris)

- **D1 Score v2 (now more visible).** Missing data raises the score: Algarrobal Aug/Sep (null ET) 64/63 vs 58 with data, and Samegua
  Aug (null ET at the field pixel) **78** vs 60–69 in other months, because water drops out
  and weights renormalise. Options: score missing water as 0, cap the score when a component is missing, or keep v1 and show the note
  (done). Also: crop-specific NDVI anchors (olive canopy 0.27 is normal), cap clay in texture, add heat. Any of these = `v2`.
- **D2 Evidence `_note`: resolved** (regenerated, Fuji 43113). Evidence is now frozen for anchoring; regenerate again only before the
  first attest, never after.
- **D3 Production deploy** of the new site over the current live one.

## 12. Tasks for Codex (start from this tree; do not redo built parts)

| ID | Task | Acceptance |
|---|---|---|
| C1 | CERES in `/app`: bring the Retell web call + text chat from the legacy `ceres.js` into the drawer, pre-loaded with the open farm's score and top option (today the drawer deep-links to `/legacy/?farm=<id>&ceres=1`) | Spanish voice call starts from the drawer; no crypto words; works at 360 px |
| C2 | Legacy cleanup or retirement: W1 rebrand (Agua Clara → Ceres), W8 (legacy still shows 12,500 / deficit for El Algarrobal), W10 hide rewards. Retire `/legacy/` once C1 ships | No conflicting water figure anywhere on the site |
| C3 | Reconcile Carumas and Samegua strategy water figures with NASA evidence using the El Algarrobal method; drop the "example data" label only then | Same source line style as Algarrobal |
| C4 | Live anchored-records widget: read `Attested` events from the registry on Fuji (fallback `attestations.json`) | Block, tx, farm, period, Snowtrace links |
| C5 | P1 endpoints `/v1/field/:id/history` (0.10) and `/v1/region/report` (0.25) in `avalanche/x402/server.mjs` + tests + docs | 402 → 200 in e2e |
| C6 | Lighthouse: measure `/` and `/app/` on the deployed URL; target perf ≥ 90 / a11y ≥ 95; add CSP for Maps hostnames | Report numbers honestly |
| C7 | Map polish: remount map labels on language switch; Cloud Map ID style; optional NDVI GroundOverlay only from generated tiles | No fake raster |
| C8 | Content: team members, Space Apps project link, 30-s video embed, glossary (ET, NDVI, soil moisture anomaly, frost risk, Field Score) | Chris supplies names/links |
| C9 | D1 implementation once Chris decides (`ceres-field-score.v2`, new fixture + snapshot) | Formula version visible in API + drawer |

**Hard rules:** no number without a source; no keys in the repo or docs; no nofiscan links unless 880024 produces blocks; keep the Team1
line verbatim; "NASA does not endorse this project"; testnet only; Chris approves deploys, funding, keys, Retell and submission.
