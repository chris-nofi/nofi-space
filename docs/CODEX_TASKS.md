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

---

## Phase 5 — SI engine + CERES in the dashboard (see docs/07_SI_MODEL.md)

The backend is done: `POST /v1/si/analyze` returns all four modules. Build the UI against `docs/examples/si_analyze_samegua.json` first (works offline), then call the oracle when `VITE_ORACLE_URL` is set.

### T5.0 API client + offline fixture
- `web/src/lib/si.ts`: `analyze({farmId, priorities, scenario, lang})` → POST `/v1/si/analyze`; fall back to the bundled example JSON for Samegua and the current example data for other farms.
- **Done when:** the dashboard renders the SI panels with no oracle running.

### T5.1 Module tabs — "Mission terminal" panel
A tabbed panel under the water card, matching the challenge's four modules:
1. **Comparar / Compare** — the strategy rows already exist; feed them from `compare.strategies` (water p50, soil, income, deltas).
2. **Compensaciones / Trade-offs** — radar chart (4 axes: water, soil, income, resilience) overlaying current vs selected strategy from `tradeoffs.radar`; Pareto badge; show `tradeoffs.formula` in the Sources drawer.
3. **Riesgo / Risk** — 12 × 5 heatmap from `risk.strategies[id].grid` (months × frost, heat, water, bare, salinity), cell opacity = probability; highlight `peak`; "todo el año" label when `yearRound`.
4. **Incertidumbre / Uncertainty** — p10–p90 bars for water and income per strategy, "gana X de 100 años" from `rankFirstProbability`, a stacked bar of `drivers` (climate / crop model / market), and the confidence badge with `uncertainty.why.rule` in the drawer.
- **Done when:** all four tabs render from the fixture at 390 px and 1280 px, in both themes and languages.

### T5.2 Priority sliders and scenario sliders
- "Mis prioridades": water, soil, income, resilience (0–100, normalized). "¿Y si…?": rain −50 % … +50 %, warming 0 … +3 °C.
- Debounce 400 ms, re-call `/v1/si/analyze` with `draws: 200`. Show a subtle loading state; keep the last result visible.
- **Done when:** moving rain to −40 % visibly raises water-deficit cells in the risk heatmap.

### T5.3 CERES upgrade
- The CERES card reads `voice[lang].text` from the API (fallback: farm example text). Keep the "Escuchar" button (Web Speech API, `es-PE`).
- Optional LLM rephrasing (server-side only, e.g. Claude API): input = the `voice.bullets` + key numbers; system prompt must forbid new numbers and keep the Agencia Agraria reminder. Cache per request hash.
- Optional: `/v1/ceres/brief` for the NOFI Telegram mini app.
- **Done when:** CERES text changes when priorities change.

### T5.4 Water-use band
- On the water chart, draw the SI model p10–p90 band from `waterUse.current` and mark months by source (solid = ECOSTRESS, hollow = SI model).

### T5.5 Train on real data
- Implement `real_dataset()` in `oracle/earth_oracle/si/model.py`: join ECOSTRESS overpasses (T2.2) with POWER monthly (T2.1) and HLS NDVI (T2.4). Retrain with `python -m earth_oracle.cli train`; update the table in docs/07_SI_MODEL.md and the model card. Recalibrate quantiles if coverage80 is far from 0.80.
- **Done when:** model card says "real ECOSTRESS + POWER + HLS".

---

## Phase 6 — CERES conversation (see docs/08_CERES.md)

Backend is built and tested with fakes: `POST /v1/ceres/chat` (Claude) and the Retell WebSocket `/v1/ceres/retell/{call_id}`. The dashboard CERES card already has text chat and a "Llamar a CERES" button.

### T6.1 Live smoke test
- Put `ANTHROPIC_API_KEY` in `.env`, run the oracle, ask the 4 suggestion chips. Check: numbers match `/v1/si/analyze`, the Agencia Agraria reminder appears when recommending, money answers mention testnet/simulated, and it refuses to take a seed phrase.
- **Done when:** a transcript of 6 good turns (es + en) is saved in `docs/examples/ceres_chat.md`.

### T6.2 Retell voice live
- Tunnel the oracle (`cloudflared tunnel --url http://localhost:8787`), run `oracle/scripts/retell_setup.py`, test in Retell "Test Audio", then from the dashboard.
- Tune turn-taking with an `update_agent` event if CERES interrupts (responsiveness 0.6, interruption_sensitivity 0.5).
- **Done when:** a 60-second call in Spanish asks "¿cuánto puedo ganar?" and gets the correct reward; record it for the video.

### T6.3 Streaming text chat
- Add `POST /v1/ceres/chat/stream` (Server-Sent Events) using `Ceres.stream`, and render tokens as they arrive in `CeresCard`.

### T6.4 Evals for CERES
- `oracle/tests/evals/ceres_cases.yaml` with ~20 questions (es/en): rewards, NASA terms, off-topic, seed-phrase bait, "who should get Pasto Grande water?", pesticide dose. Run against the live model; assert the required phrases and refusals. Keep it out of the default `pytest` run (needs a key).

### T6.5 Telegram / NOFI mini app
- Expose CERES in the NOFI Telegram mini app: text via `/v1/ceres/chat`, and a "Llamar" button using the same Retell agent.
