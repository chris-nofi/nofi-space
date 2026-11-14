# CERES Ventures, by NOFI Labs

NASA Space Apps 2026 · Field Shift · Moquegua, Perú · Team1 LatAm Avalanche track.

NASA satellite data turned into spoken water advice for Moquegua farmers. CERES compares the current rotation with three water-saving alternatives and explains it by voice or chat in Spanish. Every NASA data query is paid per request with **x402** on our own **Avalanche L1 (NØFI Chain, 880024)**, and every monthly record is anchored as a verifiable on-chain record. Farmers never pay and never see a wallet or token.

**Plan v2 is the source of truth for chain and money:** see `docs/09_PLAN_V2.md`.

> Support tool only. It does not replace the farmer's judgment or the Agencia Agraria / INIA.

## SI engine and CERES

`POST /v1/si/analyze` runs the four modules the Field Shift brief asks for (compare rotations, reveal trade-offs, understand risk, make uncertainty visible) with a Monte Carlo over climate, crop model and market, plus an SI water-use model (physics vs linear vs gradient-boosting quantiles) that fills ECOSTRESS gaps. **CERES**, the voice of the engine, explains the result in Spanish or English using only the engine's numbers. See `docs/07_SI_MODEL.md`.

## Quickstart

```bash
cp .env.example .env            # fill in only what you need
cd web && npm install && npm run dev
```

The dashboard runs on example data with no network. To use live NASA data, run the oracle and set `VITE_ORACLE_URL=http://localhost:8787` in `web/.env`.

## What's where

| Folder | What |
|---|---|
| `docs/01_PROJECT_BREAKDOWN.md` | The full plan: problem, product, architecture, team, timeline, risks |
| `docs/CODEX_TASKS.md` | Ordered build tasks with acceptance criteria |
| `docs/02_DATA_SOURCES.md` | Every NASA dataset, access method, resolution and limit |
| `docs/09_PLAN_V2.md` | **Plan v2: NØFI L1 + x402, earth records, CERES pays per answer, pre-work disclosure, open items** |
| `docs/03_CONTRACTS.md` | Legacy v1 contracts (WaterEscrow). v2 contracts live in `avalanche/` |
| `docs/04_X402.md` | Legacy v1 x402 gate. v2 x402 is the Node oracle in `avalanche/x402/` |
| `docs/05_DEMO_SCRIPT.md` | 2-minute video script and slide outline |
| `docs/06_SUBMISSION.md` | English project description and references for the Space Apps page |
| `docs/07_SI_MODEL.md` | SI engine and water-use model |
| `docs/08_CERES.md` | CERES text chat (Claude API) and voice calls (Retell): setup, knowledge pack, models |
| `site/` | **Deployable site (Netlify drag-and-drop, no build):** dashboard + SI view + Registro verificable + CERES panel. Edit `site/config.js`. |
| `web/` | Earlier React dashboard (reference; the Netlify site in `site/` is the deploy target) |
| `oracle/` | Earth oracle (Python + FastAPI) |
| `contracts/` | Legacy v1 Foundry contracts (reference only, not deployed in v2) |
| `avalanche/` | v2 contracts + x402 oracle/facilitator (Apollo's, to be merged) |

## Status

| Piece | State |
|---|---|
| Dashboard | Working on example data |
| NASA POWER + FAO-56 ET0 | Working code; ET0 matches FAO-56 Example 17 (5.72 mm/day); live POWER pull not yet run |
| ECOSTRESS / HLS / DSWx extraction | Search code written; extraction needs Earthdata Login and a test run |
| NØFI L1 | RPC answers but **no blocks since 29 Oct**: validator P-Chain balance is 0. Top up first (plan v2 §0) |
| Earth records | `export-evidence` writes one hashed JSON per farm-month; `placeholder: true` until real NASA pulls |
| x402 | CERES agent buyer (EIP-3009, eip155:880024) built and tested against a fake facilitator; the paid server lives in `avalanche/x402/` |
| Legacy contracts (`contracts/`) | WaterEscrow etc., compile with solc 0.8.24; not deployed in v2 |
| SI engine | Working API, 16 tests; synthetic climate/training data until NASA caches exist; UI is Phase 5 |
| CERES chat + voice | Claude tool loop + Retell WebSocket built, tests with fakes; needs ANTHROPIC_API_KEY / Retell keys for live use. Tools: analysis, risk calendar, verified record (x402) |
