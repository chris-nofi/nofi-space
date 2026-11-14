# Agua Clara Moquegua

NASA Space Apps 2026 · Field Shift · Moquegua, Perú.

Every drop a Moquegua field uses, measured from orbit. A crop-rotation explorer that shows each farm's real water use from NASA ECOSTRESS, compares the current rotation with three water-saving alternatives, and pays farmers a satellite-verified reward on NØCHAIN for water saved.

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
| `docs/03_CONTRACTS.md` | NØCHAIN contracts and the EIP-712 attestation |
| `docs/04_X402.md` | How the x402 evidence API works |
| `docs/05_DEMO_SCRIPT.md` | 2-minute video script and slide outline |
| `docs/06_SUBMISSION.md` | English project description and references for the Space Apps page |
| `docs/07_SI_MODEL.md` | SI engine and water-use model |
| `docs/08_CERES.md` | CERES text chat (Claude API) and voice calls (Retell): setup, knowledge pack, models |
| `site/` | **Deployable site (Netlify drag-and-drop, no build):** dashboard + SI view + CERES panel. Edit `site/config.js`. |
| `web/` | Earlier React dashboard (reference; the Netlify site in `site/` is the deploy target) |
| `oracle/` | Earth oracle (Python + FastAPI) |
| `contracts/` | Foundry contracts |

## Status

| Piece | State |
|---|---|
| Dashboard | Working on example data |
| NASA POWER + FAO-56 ET0 | Working code; ET0 matches FAO-56 Example 17 (5.72 mm/day); live POWER pull not yet run |
| ECOSTRESS / HLS / DSWx extraction | Search code written; extraction needs Earthdata Login and a test run |
| Contracts | Compile cleanly (solc 0.8.24) with 10 Foundry tests; `forge test` not yet run; deploy to NØCHAIN testnet pending RPC and chain ID |
| x402 | Demo-mode gate working; production facilitator verify/settle is a task |
| SI engine | Working API, 16 tests; synthetic climate/training data until NASA caches exist; UI is Phase 5 |
| CERES chat + voice | Claude tool loop + Retell WebSocket built, 11 tests with fakes; needs ANTHROPIC_API_KEY / Retell keys for live use |
