# CERES Ventures, by NOFI Labs

> **Start here (14 Nov 2026):** the website is `ceres-web/` (landing, Google Maps field dashboard, x402 API as a Netlify Function,
> record verification). Architecture, deploy steps and open tasks: [`docs/12_CERES_SYSTEM_DESIGN.md`](docs/12_CERES_SYSTEM_DESIGN.md).
> Demo chain: Avalanche Fuji C-Chain (43113). Contracts, attester and x402 oracle: `avalanche/` (`forge test`, `cd avalanche/x402 && npm test`).

NASA Space Apps 2026 · Field Shift · Moquegua, Perú · Team1 LatAm Avalanche track.

NASA satellite data turned into spoken water advice for Moquegua farmers. CERES compares the current rotation with three water-saving alternatives and explains it by voice or chat in Spanish. Every NASA data query is paid per request with **x402** on our own **Avalanche L1 (NØFI Chain, 880024)**, and every monthly record is anchored as a verifiable on-chain record. Farmers never pay and never see a wallet or token.

**Plan v2 is the source of truth for chain and money:** see `docs/09_PLAN_V2.md`. **All numbers now come from real NASA data** (Kepler's package in `data/`): see `docs/10_REAL_DATA.md`.

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

## Status (15 Nov 2026)

Live: **https://ceres-ventures.netlify.app** (submission URL; the same build is also at gleaming-sunflower-16cdde.netlify.app), built from `ceres-web/` on branch `feat/ceres-web-integration`. Read `docs/12_CERES_SYSTEM_DESIGN.md` and `docs/13b_PUBLIC_PAID_DATA_BOUNDARY.md`.

| Piece | State |
|---|---|
| Website `/` + `/app/` map | Live. Static public JSON built from real NASA/partner pulls (the browser does not call NASA at runtime) |
| Evidence (12 farm-months, Jul–Oct 2026) | ECOSTRESS, HLS/MODIS, POWER (FAO-56 ET₀), SMAP (Carumas), **GPM IMERG Late daily v07 rain** (CHIRPS v3 as cross-check), Sentinel-2 (ESA), SRTM, SoilGrids (non-NASA). IMERG Final for 2026 not yet published |
| 1981–2025 backtest | Kepler's model hindcast on NASA POWER daily (`data/out/backtest_1981_2025.json`, methods in `data/backtest_methods.md`): 44 seasons for Oct–Apr crops, 45 for calendar crops. Shown in the `/app` drawer, labelled as a model |
| CERES | Text chat + voice in the `/app` drawer (`POST /v1/ceres/chat`, Claude, public data only). Voice: browser speech, or natural voice via `/v1/ceres/voice` when `ELEVENLABS_API_KEY` is set. Retell is **not** configured |
| Fuji registry | `WaterProofRegistry` `0xa03c3472b8F5F6d6FE1dB23B241DB5A50aa3892d`. Badges use a live `eth_call verify()`; `ceres-web/attestations.json` lists the txs and the hash each one anchored |
| x402 Evidence API | Netlify Function, HTTP 402 → Fuji USDC (EIP-3009) → full canonical record + proof. Real payment proven on Fuji |
| Public/paid boundary | Canonical evidence never in `dist/`; build-time leak audit fails closed (`ceres-web/scripts/audit-public.mjs`) |
| NØFI L1 (880024) | Roadmap only; not producing blocks |
| Legacy | `site/` (archived dashboard, served at `/legacy/`), `web/` (old React app), `contracts/` (WaterEscrow, do not deploy) |
