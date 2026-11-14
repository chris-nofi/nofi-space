# Codex build plan

Work top to bottom. Each task lists files, what to do, and how to know it's done. Stop and leave a note in `docs/STATUS.md` if a task is blocked (missing key, RPC, etc.) and move to the next one. Respect every rule in `AGENTS.md`.

---

## Phase 0 — Get it running (30 min)

### T0.1 Install and run everything on example data
- `cd web && npm install && npm run build && npm run dev`
- `cd oracle && pip install -r requirements.txt && pytest -q`
- `cd contracts && forge install foundry-rs/forge-std --no-git && forge test -vv` (10 tests in `test/WaterEscrow.t.sol`; they compile but have not been run yet)
- **Done when:** all three pass. Update `docs/STATUS.md` with the results.

---

## Phase 1 — Make the dashboard excellent (the part judges see)

### T1.1 Polish the layout ("pimp it out")
- Files: `web/src/App.tsx`, `web/src/components/*`, `web/src/styles.css`.
- Keep one screen per farm: header → farm tabs → water card → strategies → reward flow → basin signals → Sofía → sources/disclaimer.
- Improve spacing, hierarchy, empty/loading states, and transitions. Add skeleton loaders for oracle fetches.
- Mobile 390 px must look designed, not squeezed. Test 390, 768, 1280.
- **Done when:** Lighthouse accessibility ≥ 95; no horizontal scroll at 390 px; dark and light both readable.

### T1.2 Water card upgrades
- Add a toggle "Mensual / Por pasada" to show individual ECOSTRESS overpasses (dots) over the monthly bars when oracle data includes them.
- Show the headline delta vs the valley median as a pill (e.g. "+18% vs valle").
- Add an info button that explains evapotranspiration in one plain sentence (ES/EN).
- **Done when:** works on example data; overpass dots render when `etOverpasses` exists.

### T1.3 Strategy comparison
- Keep four strategies. Add a "Mis prioridades / My priorities" control (three sliders: water, soil, income) that re-ranks the list with a transparent score (show the formula in the Sources drawer).
- Keep the four detail blocks (Por qué, Evidencia, Vacíos, Riesgos) and the Agencia Agraria reminder.
- **Done when:** moving the water slider to max puts the lowest-water strategy first on every farm; current strategy is always visible and labeled.

### T1.4 Map view
- Add a small MapLibre map (pinned CDN or npm) with GIBS tiles (no key) showing the three farms and Pasto Grande. Layer toggle: true color, ECOSTRESS-style heat (static image is fine for demo), DSWx water.
- GIBS WMTS: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{Layer}/default/{date}/GoogleMapsCompatible_Level{n}/{z}/{y}/{x}.jpg`
- **Done when:** map loads without API keys; clicking a farm switches the tab.

### T1.5 Telegram mini app wrapper
- Add `web/src/telegram.ts` that, if `window.Telegram?.WebApp` exists, calls `ready()`, `expand()`, and applies its theme params to CSS tokens.
- **Done when:** app renders in Telegram's in-app browser with the right theme; no errors outside Telegram.

### T1.6 Sofía voice
- Read the farm summary aloud with the Web Speech API (`speechSynthesis`, `es-PE` voice if available, else `es`). Button "Escuchar a Sofía". Stop button.
- **Done when:** works in Chrome; button hidden if the API is missing.

---

## Phase 2 — Real NASA data (the part that makes it valid)

### T2.1 NASA POWER live (no login)
- File: `oracle/earth_oracle/power.py` (already implemented), `cli.py`.
- Run `python -m earth_oracle.cli power --farm all`. Save to `oracle/data/cache/{farm}_power.json`.
- Compute monthly ET0 with `et0.py` (FAO-56 Penman-Monteith). Add a test comparing against a known value for one month.
- **Done when:** the three cache files exist and `GET /v1/farms/{id}/water` returns real `rainMonthly`, `tminMonthly`, `et0Monthly`.

### T2.2 ECOSTRESS field ET (needs Earthdata Login)
- File: `oracle/earth_oracle/ecostress.py`. Search `ECO_L3T_JET` (collection v002/v003, check which exists) for a small bbox around each farm, 2023–2026.
- Download only the `ETdaily` layer (verify the exact asset name in the granule's links; adjust the filter). Sample the pixel at the farm point (and a 3×3 mean). Skip cloud-flagged pixels using the QC layer if present.
- Aggregate to monthly mean mm/day and keep each overpass for T1.2.
- **Done when:** `oracle/data/cache/{farm}_ecostress.json` has ≥ 12 months for Samegua and El Algarrobal; the dashboard shows them instead of example data and the "Datos de ejemplo" badge disappears for that card.

### T2.3 Valley median
- Sample ECOSTRESS ET at ~30 random irrigated pixels in the same valley (mask with HLS NDVI > 0.4) and take the monthly median. Store as `refMonthly`.
- **Done when:** the orange line on the water chart comes from data.

### T2.4 HLS NDVI and cropAlive
- File: `oracle/earth_oracle/hls.py`. HLSL30 + HLSS30 at the farm point, Fmask cloud/shadow removed, 16-day max-NDVI composites.
- `cropAlive = (median NDVI over the season > 0.35) and (no 60-day window with NDVI < 0.2)`; thresholds configurable.
- **Done when:** evidence pack contains an NDVI series and `cropAlive` for each farm.

### T2.5 Reservoir water surface
- File: `oracle/earth_oracle/dswx.py`. OPERA DSWx-HLS over a Pasto Grande polygon (draw a rough polygon in `data/reservoirs.geojson`). Monthly water area (km²) for the last 24 months.
- **Done when:** basin card sparkline uses it.

### T2.6 IMERG and GRACE-FO (regional)
- IMERG Late daily → Dec–Mar headwater totals per season vs 2001–2020 mean. GRACE-FO mascon trend for a southern Peru box.
- **Done when:** basin card uses both, badged "regional".

---

## Phase 3 — Evidence, NØCHAIN, x402 (the trust layer)

### T3.1 Evidence pack + signature
- File: `oracle/earth_oracle/evidence.py`, `sign.py` (implemented). Pack = all metrics + dataset IDs + granule IDs + thresholds + code version. Hash = keccak256 of canonical JSON. Optional: pin to IPFS (web3.storage / Pinata) if a key exists, else store locally and use the hash.
- **Done when:** `POST /v1/attest/{farm}` returns `{pack, evidenceHash, attestation, signature}` and `sign.py` signature verifies in the Foundry test vector.

### T3.2 Deploy contracts to NØCHAIN testnet
- Needs `NOCHAIN_RPC_URL`, `NOCHAIN_CHAIN_ID`, `DEPLOYER_PRIVATE_KEY` from the NOFI devs.
- `forge script script/Deploy.s.sol --rpc-url $NOCHAIN_RPC_URL --broadcast`. Write addresses to `contracts/deployments/nochain-testnet.json`. Repeat on Fuji as fallback.
- **Done when:** both deployments exist and the explorer shows them.

### T3.3 End-to-end settle
- Script `oracle/scripts/e2e_settle.py`: register plot hash → funder opens offer (MockUSDC) → farmer accepts → oracle attests → anyone calls `settle`. Print explorer links.
- **Done when:** one real settle tx on NØCHAIN testnet per demo farm. Put links in `docs/STATUS.md`.

### T3.4 Sponsored gas for farmers
- Option A (fast): relayer endpoint in the oracle that submits `accept` on the farmer's behalf using an EIP-712 `AcceptOffer` signature (add `acceptWithSig` to `WaterEscrow`).
- Option B: NØCHAIN Fee Manager precompile set to near-zero fees (ask the NOFI devs).
- **Done when:** a farmer wallet with zero gas balance can accept an offer.

### T3.5 x402 production path
- Today `server.py` returns a spec-shaped 402 and, in `X402_MODE=demo`, accepts any `PAYMENT-SIGNATURE`.
- Implement `X402_MODE=facilitator`: POST the payment payload to `${X402_FACILITATOR_URL}/verify`, serve the pack, then POST `/settle`, return `PAYMENT-RESPONSE`. For NØCHAIN, self-host x402-rs pointed at the L1 chain ID; for Fuji use an Avalanche-listed facilitator.
- Update `oracle/scripts/coop_agent.py` to sign a real EIP-3009 `transferWithAuthorization` for USDC.
- **Done when:** the agent script pays on Fuji (or NØCHAIN) and receives the pack; tx visible on the explorer.

### T3.6 Wire the dashboard to the chain
- Reward flow buttons call the oracle relayer endpoints when `VITE_ORACLE_URL` is set; show explorer links. Otherwise keep the simulated flow, labeled "simulado".
- **Done when:** clicking through on a live setup produces real testnet txs.

---

## Phase 4 — Submission

### T4.1 English project page
- Fill `docs/06_SUBMISSION.md` with final links (repo, demo URL, video), and the references list with dataset DOIs.

### T4.2 Deploy the dashboard
- Netlify or Vercel static deploy of `web/dist`. Public demo works with example data even if the oracle is down.

### T4.3 Video
- Follow `docs/05_DEMO_SCRIPT.md`. Spanish audio, English subtitles, ≤ 2:00.
