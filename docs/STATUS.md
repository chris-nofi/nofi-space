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
