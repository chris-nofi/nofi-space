# CERES Ventures — Netlify landing + existing dashboard

## What this branch contains
- `site/index.html`: new English/Spanish landing page (vanilla HTML/CSS/JS)
- `site/landing.css` and `site/landing.js`: responsive UI and evidence-driven interactions
- `site/dashboard.html`: preserved dashboard from the original `site/index.html`
- `site/dashboard-route.js`: deep-link bridge for `/app?farm=algarrobal&view=strategies&ceres=1`
- `site/verify.html`: transparent local evidence/anchor inspection
- `site/api-docs.html`: x402 documentation and configured external demo link
- `site/brand/nofi-wordmark-white.svg`: exact NØFI SVG provided by project owner, **not recreated**
- `site/_redirects`: Netlify routing to the new landing and preserved dashboard
- Existing dashboard JavaScript, CSS, evidence files, oracle and contracts are left untouched.

## Deploy on Netlify
**Recommended:** connect GitHub repo `chris-nofi/nofi-space` and deploy branch `feat/ceres-netlify-landing`.
- Base directory: blank (repo root)
- Build command: blank
- Publish directory: `site`
- No Node/npm build needed.

For Netlify manual deploy, download the branch source ZIP from GitHub, extract it, then **zip the contents of the `site/` directory** (not the repository root). Drag that site-only ZIP to Netlify Drop.

## Routes
- `/` landing page
- `/app` existing dashboard
- `/app?farm=algarrobal` selects El Algarrobal
- `/app?farm=carumas&view=intel` selects Carumas SI
- `/app?farm=samegua&ceres=1` opens CERES panel
- `/verify/<digest>?farm=algarrobal` verification inspection
- `/api-docs` x402 explainer

## Evidence contract
Landing reads `/evidence/{farm}-202610.json` with `farm` one of `algarrobal`, `carumas`, `samegua`.
The data comes from the repository's real evidence JSON (not hardcoded metrics). UI reads `indicators.et_mm.value`, `indicators.ndvi.value`, `indicators.precip_mm.value`, `engine.recommendedStrategy`, `engine.waterSavedM3`, `engine.recommendationBasis`, `extensions.fieldPixelStatus`, and `extensions.cover.bare_months`.
A record without an independently confirmed transaction **must not** be labeled anchored. Some field-pixel measurements are still pending/partial, and model water-savings units/basis need local review.

## Claude/backend integration tasks
1. Connect `window.AGUA_CLARA_CONFIG.oracleUrl` to deployed HTTPS FastAPI oracle in `site/config.js`. Keep secrets on the server.
2. Make the evidence index and farm-period selector dynamic rather than fixed to October 2026. Preserve provenance, missing/partial flags, and never invent metrics.
3. Confirm canonical `/v1/si/analyze` contract and integrate strategy reranking in the existing dashboard.
4. Configure Retell public key and agent ID (domain restricted) to enable CERES voice. `/app?...&ceres=1` opens the existing CERES widget.
5. Deploy WaterProofRegistry on NØFI Avalanche L1 testnet (chain ID 880024), then configure registry address and explorer. Verify actual receipt/logs and chain ID; a digest alone is not an anchor.
6. Connect the x402 testnet backend `avalanche/x402` to `site/config.js` `x402PayUrl`. Verify 402 -> payment -> 200 against **real evidence**, not examples. Don't expose signing keys in browser code.
7. Add confirmed team members, partner attribution, official Space Apps submission links, and any source-backed impact figures.
8. Validate bilingual copy, mobile at 360px, accessibility, and Lighthouse scores.

## Safety / honesty
- Static deployment runs with bundled evidence and dashboard, **without** claiming live oracle, voice, on-chain records or x402 settlement unless configured.
- No private keys or backend secrets in static files.
- NASA/ESA data and derived models support decisions; local agronomic validation is required.
- NASA does not endorse the project.

## Logo
The official NØFI SVG is bundled at `site/brand/nofi-wordmark-white.svg` and shown in the header only after successful load. For light backgrounds use a dark backing or CSS styling, not a recreated vector approximation.
