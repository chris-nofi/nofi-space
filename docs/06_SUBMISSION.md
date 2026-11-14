# Space Apps project page (English)

## Project name
CERES Ventures (by NOFI Labs)

## High-level summary (≤ 150 words)
In Moquegua, Peru, it almost never rains: farms depend on highland water shared with towns and mining. CERES Ventures turns NASA data into water advice a farmer can hear. For each field it combines ECOSTRESS water use, HLS NDVI, NASA POWER climate and GPM IMERG rain, and compares the existing rotation with three alternatives. Each option comes with its trade-offs, month-by-month risk, uncertainty ranges, evidence, data gaps and a reminder to check with local experts. CERES, an AI voice, explains the result in Spanish by phone or chat. Every monthly record is hashed and anchored on our own Avalanche L1 testnet, so nobody can inflate water savings. Cooperatives, buyers and the CERES agent itself pay per query with x402. Farmers never pay and never see crypto.

## Link to demo / repo / video
- Demo: TODO
- Repository: TODO
- Video: TODO

## Detailed description
TODO (expand from docs/01_PROJECT_BREAKDOWN.md sections 3, 9, 10).

## Use of NASA data
ECOSTRESS ET and ESI (field water use, stress), HLS (NDVI, crop present, rotation detection), NASA POWER (FAO-56 reference ET, frost), GPM IMERG (headwater rain), OPERA DSWx (reservoir and qocha water surface), SMAP (highland soil moisture), GRACE-FO (regional storage), SRTM (elevation, slope), GIBS (maps).

## Space agency partner data
TODO if used (e.g. ESA Sentinel-1 SAR for cloud/fog periods).

## References
- NASA datasets above (add DOIs from each DAAC landing page).
- FAO Irrigation and Drainage Paper 56 (Allen et al., 1998).
- ProActivo; Agraria; El Búho; Energiminas (see docs/01_PROJECT_BREAKDOWN.md §11).
- Tools: FastAPI, NumPy, scikit-learn, earthaccess, rasterio, Claude API, Retell AI, Foundry, viem, x402 (coinbase/x402 v2 spec), Avalanche L1 (Subnet-EVM, ACP-77).
- Pre-existing team infrastructure: NØFI Chain testnet (chain 880024, built Oct 2026) and nofiscan.io explorer.

## AI use disclosure
Built with AI coding assistants (Claude, Codex, Apollo). The code scaffold (SI engine, CERES, site, contracts, x402 oracle) was AI-drafted on Fri 13 and Sat 14 Nov before the start, then reviewed and completed by the team during the hackathon. CERES's voice and text answers are AI-generated (Claude via Retell) and labeled "AI voice". All data sources and outputs are listed; NASA data is not altered.
