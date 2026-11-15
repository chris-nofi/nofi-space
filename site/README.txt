CERES VENTURES by NOFI Labs • ARCHIVED DASHBOARD (NASA Space Apps 2026 · Field Shift · Moquegua)

ARCHIVE: this folder is served at /legacy/ by the ceres-web build (ceres-web/scripts/build.mjs). Do not deploy it
with Netlify Drop; the live site is ceres-web/ (Git deploy, Netlify Functions). The notes below are historical.

1. Optional: edit config.js (public values only)
   - oracleUrl: HTTPS URL of the Earth oracle (live SI recalculation, CERES chat, live records)
   - retellPublicKey + retellAgentId: enable "Llamar a CERES" voice calls
   - registryAddress: WaterProofRegistry on the NØFI L1 once deployed (links records to nofiscan)
   - x402PayUrl: public URL of the x402 payment demo (avalanche/x402/web/pagar.html)
   Leave empty to run fully offline.
2. Drag this folder (or a ZIP of its contents) into https://app.netlify.com/drop

Works as a static site, no build step. Files:
  index.html, app.js, style.css  - dashboard (overview, strategies, SI intelligence, evidence, verifiable record)
  si.js, si.css, si-data.js      - SI view: compare, trade-offs, risk, uncertainty (si-data.js = bundled engine results + record summaries)
  records.js                     - "Registro verificable": monthly NASA records + dataHash; x402 explainer for partners
  ceres.js                       - CERES panel: summary, read-aloud, text chat (Claude via oracle), voice (Retell), proof chips
  config.js                      - public settings only. NEVER put secret API keys or private keys here.

At build time real-data.js and ceres-nasa-data.js replace the example values with the real NASA bundle.
Records marked "Ejemplo · no anclado" are placeholders and are not on chain. Farmers never pay. Testnet only.
Regenerate si-data.js: cd oracle && python -m earth_oracle.cli export-site
