# CERES Ventures (formerly Agua Clara Moquegua) — Project Breakdown

> **Plan v2 (Sat 14 Nov):** the reward/escrow sections below are superseded. Farmers no longer receive rewards; NASA data is sold per query with x402 on the NØFI L1 and each monthly record is anchored in WaterProofRegistry. See `docs/09_PLAN_V2.md`.

NASA Space Apps Challenge 2026 · Challenge: **Field Shift: Adapting Farms with NASA Data** · Local event: **Moquegua, Perú** · Hackathon: November 14–15, 2026.

## 1. One-line pitch

A crop-rotation explorer for Moquegua's water problem: a NASA satellite measures how much water each field actually uses, the app helps the farmer compare their current rotation with three water-saving alternatives, and the people downstream who need that water pay a reward when satellite data shows it was saved.

## 2. The problem (Moquegua-specific)

- Moquegua's coast and valleys get almost no rain. Farms depend on water from the highlands, stored in reservoirs like Pasto Grande and Vizcachas, and shared with towns and mining.
- The 2016 drought cost the region about S/ 21 million and killed over half of El Algarrobal's olive plantations (ProActivo, Dec 2016).
- Water is political: Tambo valley farmers in Arequipa dispute Pasto Grande releases (ProActivo).
- People already pay to keep water upstream:
  - Midagri's Fondo Sierra Azul is building 30 qochas (highland rainwater ponds) in Carumas, Ubinas, Yunga, Ichuña and Lloque, recharging over 700,000 m³ (Agraria, June 2026).
  - EPS Ilo runs a MERESE (Peru's legal scheme where water utilities pay upstream communities for watershed services), funding qochas and infiltration trenches with the Asana and Huanuara communities (El Búho, Jan 2025).
  - Quellaveco's dialogue agreements expanded Vizcachas from 28 to 60 million m³ and committed 6.8 million m³/year to farmland (Energiminas, Apr 2024).

What's missing: a cheap, trusted way to know **which field saved how much water**, and a fast rail to reward the farmer for it.

## 3. What we build

### 3.1 The decision tool (80% of the demo)
For each farm:
1. **Water use** — monthly field evapotranspiration from NASA ECOSTRESS (70 m), compared with the valley median (irrigated) or available rain (rainfed).
2. **Basin signals** — Pasto Grande water surface (OPERA DSWx), headwater rain (GPM IMERG), long-term regional storage (GRACE-FO).
3. **Four strategies** — the existing rotation plus three alternatives, each with: water use, soil score, income, **why**, **evidence**, **gaps**, **risks**, and "revisar con la Agencia Agraria / INIA".
4. **Confidence badges** — field-measured (ECOSTRESS, HLS, SRTM) vs regional (POWER, IMERG, SMAP, GRACE-FO) vs transferred evidence.

### 3.2 The trust and reward layer (20%)
5. **Evidence pack** — the oracle computes field metrics, pins a JSON pack, signs an EIP-712 attestation.
6. **NØCHAIN** — `PlotRegistry` (hashed plot boundary only) and `WaterEscrow` (funder locks USDC; settles on a valid oracle signature).
7. **x402** — institutions (EPS MERESE teams, irrigation boards, monitoring committees, or their AI agents) pay ~$0.05 USDC per evidence pack. **Farmers never pay.**
8. **NOFI wallet** — the farmer receives USDC and cashes out to soles through Koywe (bank transfer or Peru's interoperable QR). Koywe doesn't list Avalanche, so USDC routes to Solana via LI.FI first.

### 3.3 Anti-gaming rule
Saving water by abandoning or drying out a field **never pays**. HLS NDVI must show a living crop (`cropAlive = true`) before the escrow releases funds.

## 4. Three demo farms

| Farm | Zone | Water source | Existing | Reward rule |
|---|---|---|---|---|
| Parcela Familia Quispe, **Carumas** (-16.81, -70.69, ~3,000 m) | Highland, rainfed Dec–Mar, frost | Rain + community qocha | Papa → papa | Per hectare × verified practice compliance |
| Chacra Los Ángeles, **Samegua** (-17.18, -70.90, ~1,550 m) | Middle valley, irrigated | Pasto Grande canal | Continuous alfalfa (~17,250 m³/ha/yr) | Per verified m³ saved vs own ECOSTRESS baseline |
| Olivar Santa Rosa, **El Algarrobal, Ilo** (-17.62, -71.26, ~150 m) | Hyper-arid coast | Osmore river, gravity irrigation | Olive, bare soil | Per verified m³ saved (management strategies, not rotation) |

Farm names are fictional. Coordinates are real places. Farm-level numbers in `web/src/data/farms.ts` are **example values** until the oracle replaces them.

## 5. Architecture

```
NASA data ──────────────► Earth oracle (Python, FastAPI) ──► evidence pack (JSON, IPFS CID)
 ECOSTRESS ET/ESI            power.py  et0.py                      │
 HLS NDVI                    ecostress.py hls.py dswx.py            ▼
 POWER, IMERG, SMAP          evidence.py  sign.py (EIP-712)   NØCHAIN testnet
 OPERA DSWx, GRACE-FO, SRTM  server.py (x402 gate)             PlotRegistry · WaterEscrow
                                   │                                  │
                                   ▼                                  ▼
                        Web dashboard (Vite+React)          NOFI wallet → Koywe → soles
                        x402 buyers (utility agents)
```

## 6. Repo layout

```
agua-clara/
  AGENTS.md                 Codex instructions (read first)
  README.md                 Quickstart
  docs/                     This breakdown, data sources, contracts, x402, demo script, submission, Codex tasks
  web/                      Clean dashboard (Vite + React + TypeScript), runs on mock data
  oracle/                   Python Earth oracle: NASA pulls, FAO-56 ET0, evidence, EIP-712 signing, x402-gated API
  contracts/                Foundry: PlotRegistry, WaterEscrow, MockUSDC, tests, deploy script
  .env.example              All config keys (never commit real values)
```

## 7. Team split (48 hours)

| Who | Owns | First deliverable |
|---|---|---|
| Chris (JS/Python + Claude Code / Codex) | Dashboard, Spanish/English copy, story, video, submission page | Dashboard running with real POWER numbers (hour 6) |
| Geospatial recruit (or Chris + Codex) | `oracle/`: ECOSTRESS, HLS, DSWx extraction for the 3 farms | ECOSTRESS monthly ET for Samegua (hour 12) |
| Blockchain dev 1 (Thailand, overnight) | `contracts/` on NØCHAIN testnet + Fuji fallback, relayer for sponsored gas | Contracts deployed, explorer links (hour 16) |
| Blockchain dev 2 (Thailand, overnight) | x402 on the evidence API, co-op agent script, NOFI wallet link | Agent pays 402 and gets a pack (hour 24) |

## 8. Timeline

| Hours | Milestone |
|---|---|
| 0–6 | Repo up; dashboard on mock data; POWER live for 3 farms; ET0 computed |
| 6–16 | ECOSTRESS monthly ET for 3 farms cached; contracts deployed on NØCHAIN testnet |
| 16–28 | HLS cropAlive + NDVI; DSWx for Pasto Grande; evidence pack + EIP-712 signature; settle on-chain |
| 28–36 | x402 gate + agent script; dashboard wired to oracle; Sofía summary text |
| 36–44 | Video, slides, English project page with references |
| 44–48 | Buffer, submit before the Moquegua local deadline |

**Cut lines:** if behind at hour 28, drop DSWx and GRACE-FO (keep static), drop the relayer (pay gas from a dev wallet). If behind at hour 36, keep x402 as the scripted demo only. **Never cut:** the four-strategy comparison, the evidence/gaps/risks text, the uncertainty badges, the cropAlive rule.

## 9. Judging fit

Space Apps scores Influence, Creativity, Validity, Relevance, Presentation.
- **Relevance:** existing rotation + 3 alternatives with evidence, gaps, risks — exactly what the challenge lists.
- **Validity:** water use is measured, not guessed; resolution limits are shown; anti-gaming rule; "support, not replace" reminders.
- **Influence / Local Impact:** names real Moquegua institutions already paying for water (MERESE, Sierra Azul).
- **Creativity:** closes the loop from satellite evidence to a farmer's wallet.
- **Presentation:** one clean screen per farm, Spanish UI with English toggle, subtitled video.

Keep chain/x402 to ~20 seconds of the video. Never show token prices or $NO. Label everything on testnet as "testnet / simulated funds".

## 10. Risks and honest limits

- ECOSTRESS overpasses are irregular (space station orbit): monthly composites, gaps flagged.
- POWER (~50 km), IMERG (~10 km), SMAP (9 km) and GRACE-FO (basin) are regional, not field-level — badge them.
- ECOSTRESS measures water **consumed** (evapotranspiration), not water **delivered**. Losses from leaky canals don't show up. Say so.
- In the desert, cover crops can increase water use. The Algarrobal card shows this trade-off.
- The Pasto Grande allocation is disputed. The tool shows evidence; it does not allocate water.
- Parametric payouts are regulated as insurance in Peru. Frame rewards as results-based payments (MERESE-style), not insurance.
- Funders named (EPS Ilo/Moquegua, Sierra Azul, mining commitments) are **possible** funders, not partners.

## 11. Sources

- ProActivo, drought losses: https://proactivo.com.pe/sequia-en-el-sur-moquegua-pierde-21-millones-de-soles-por-falta-de-agua/
- ProActivo, Tambo/Pasto Grande dispute: https://proactivo.com.pe/agricultores-de-tambo-moquegua-nos-esconde-agua-de-pasto-grande/
- Agraria, Sierra Azul qochas: https://agraria.pe/noticias/moquegua-gobierno-asegura-mas-de-700-mil-m-de-agua-con-30-qo-42405
- El Búho, MERESE EPS Ilo: https://elbuho.pe/?p=373160
- Energiminas, Quellaveco water: https://energiminas.com/2024/04/03/la-gestion-sostenible-del-agua-el-factor-clave-de-la-millonaria-inversion-de-anglo-american-en-quellaveco
- Koywe currencies: https://docs.koywe.com/documentation/supported-currencies-payment-methods
- Space Apps judging guide: https://www.spaceappschallenge.org/resources/judging-awards-guide/
