AGUA CLARA • NETLIFY MANUAL DEPLOY (NOFI Space · NASA Space Apps 2026)

1. Optional: edit config.js
   - oracleUrl: HTTPS URL of the Earth oracle (enables live SI recalculation and CERES chat)
   - retellPublicKey + retellAgentId: enable "Llamar a CERES" voice calls
   Leave empty to run fully offline.
2. Drag this folder (or a ZIP of its contents) into https://app.netlify.com/drop

Works as a static site, no build step. Files:
  index.html, app.js, style.css  - the dashboard (overview, strategies, SI intelligence, evidence, rewards)
  si.js, si.css, si-data.js      - SI view: compare, trade-offs, risk, uncertainty (si-data.js = bundled engine results)
  ceres.js                       - CERES panel: summary, read-aloud, text chat (Claude via oracle), voice (Retell)
  config.js                      - public settings only. NEVER put secret API keys here.

Farm records are illustrative; climate and SI training data are synthetic until NASA data is downloaded.
Water rewards and evidence validations are DEMONSTRATION ONLY (testnet). No real transfers.
Regenerate si-data.js: cd oracle && python -m earth_oracle.cli export-site
