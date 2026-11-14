# Status (handoff to Codex)

Verified before handoff, November 13, 2026:

| Check | Result |
|---|---|
| `web`: `npm run build` | Passes, zero TypeScript errors |
| `oracle`: `pytest -q` | 10 passed: FAO-56 ET0 vs Example 17 (5.72 mm/day), POWER parsing, cropAlive rule, EIP-712 sign/recover, Python digest == Solidity digest, x402 402→200 flow (demo mode), plot hash, water endpoint |
| `contracts`: compile with solc 0.8.24 | src, tests and deploy script compile cleanly |
| `contracts`: `forge test` | **Not run yet** — first thing to do (Task T0.1) |
| Live NASA POWER pull | **Not run yet** (network blocked in the build sandbox) — Task T2.1 |
| ECOSTRESS / HLS / DSWx extraction | Code written, never run against real granules — Tasks T2.2–T2.5 |
| NØCHAIN deploy | Waiting on RPC URL, chain ID and test keys from the NOFI devs — Task T3.2 |

Add new results below as tasks complete.

## SI engine (branch feat/si-engine)

| Check | Result |
|---|---|
| `oracle`: `pytest -q` | 26 passed (10 original + 16 SI) |
| SI model comparison (synthetic data, GroupKFold 5) | physics MAE 0.72 · ridge 0.62 · GBM 0.47 mm/day; GBM 80 % band coverage 0.74 |
| `web`: `npm run build` | Passes after Sofía → CERES rename |
| Real-data training | Not yet: needs ECOSTRESS + POWER + HLS caches (T5.5) |

## CERES chat + voice

| Check | Result |
|---|---|
| `oracle`: `pytest -q` | 37 passed (11 new CERES tests, Claude and Retell faked) |
| `web`: `npm run build` | Passes with CERES chat + Retell web call (retell-client-js-sdk 3.0.3) |
| Live Claude API / Retell call | Not run: needs keys (Tasks T6.1, T6.2) |

## Netlify site (site/)

| Check | Result |
|---|---|
| Imported `agua-clara-netlify-fixed.zip` unchanged | commit "Import Netlify static site" |
| Added SI view, CERES panel, config.js, bundled SI results | headless DOM click-through: 5 pages render, 4 SI tabs render, farm/lang switching, CERES panel opens; no runtime errors |
| Live oracle / Claude / Retell from the deployed site | Not run: needs HTTPS oracle URL and keys in `site/config.js` |

## Plan v2 alignment (Sat 14 Nov 2026, ~01:30 Peru, before the 09:00 start)

| Check | Result |
|---|---|
| `oracle`: `pytest -q` | **45 passed**: new `test_v2.py` covers deterministic, tamper-evident records; no coordinates or timestamps in the hash; export files; x402 buyer signs a valid EIP-3009 auth that a fake facilitator recovers; price cap; wrong network; key never echoed; CERES paid path; farmer-safe records API; admin-only package |
| `export-evidence` | 9 files (3 farms × Aug–Oct 2026), all `placeholder: true` (synthetic climate, no ECOSTRESS/HLS yet) |
| Site headless click-through | 5 pages incl. new "Registro verificable"; 3 records per farm with dataHash and "Ejemplo · no anclado" chip; SI tabs, farm/lang switch, CERES panel OK; no runtime errors; no USDC/rewards copy in farmer views |
| `avalanche/` (Apollo's contracts + x402 server) | **Not in this repo yet**: merge and reconcile the record schema |
| NØFI L1 | Not touched from here. Plan v2 §0 says validator balance 0, last block #200 |
| Nothing deployed, signed with a real key, or sent | ✔ |

## Real data (Sat 14 Nov 2026, ~02:15 Peru)

| Check | Result |
|---|---|
| `oracle`: `pytest -q` | **51 passed**: new `test_real_data.py` covers real ET₀ in the engine; El Algarrobal 17,064 / 12,798 / 20,201 / 12,882 vs Kepler 17,070 / 12,800 / 20,210 / 12,890; drip first; off-field pixels not used; Carumas rain range lowers confidence; evidence issues; climate tool |
| Kepler §9 checklist | `node --check app.js` OK; `CERES_NASA_DATA.farms` has 3 keys; El Algarrobal overview, strategy SUGERIDA, SI top rank and CERES text all say drip + strip cover, 12,882 m³/ha, −24.5 % vs 17,064; no "ECOSTRESS/HLS muestra/shows" strings; climate labeled; citations under charts; CHIRPS rain with POWER/ERA5 range; Samegua temperature from ERA5-Land; spot-check El Algarrobal Oct 2026 ET₀ = 142.9 mm |
| Site headless | 5 pages × 3 farms, no runtime errors, no illustrative-data strings |
| Not done | Retell prompt (CERES reads live tools, no static prompt to regenerate); evidence hash vs `build-attestation.mjs` unconfirmed; no signing or transactions |

## Challenge alignment (Sat 14 Nov 2026, ~03:00 Peru)
- Kepler v2 data package imported: HLS, provisional field pixels, SoilGrids, Sentinel-2, frost, slope, erosion. 12 evidence files with extensions.
- `pytest` 51 passed.
- `node site/tests/consistency.mjs`: all checks pass.
- Headless acceptance:
  - offline re-rank changes the top pick on the SI and Strategies views
  - no-drip flag works
  - CERES summary follows the re-rank
  - season timeline, soil, frost and slope cards, and glossary render
  - farmer ES has no crypto words and no "Agua Clara"
  - no runtime errors
- Status per item: `docs/11_ALIGNMENT_STATUS.md`.
