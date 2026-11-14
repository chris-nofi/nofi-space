# Ceres Ventures · Water Proof (Avalanche layer)

"Registro verificable de agua": one tamper-evident record per farm per month of the NASA-derived
water indicators that CERES used, plus the engine's recommendation.

**v2 (Sat 14 Nov):** deploy target is now **Chris's NØFI L1 testnet (880024, explorer https://nofiscan.io)**, and Fuji (43113) is the fallback.
Added `src/X402TestUSDC.sol` (EIP-3009 test dollar), `script/DeployNofi.s.sol`, and `x402/` (Earth oracle behind an x402 paywall + self-hosted facilitator).
Plan: `../mentor/avalanche-track-plan-v2-nofi-l1.md`. Tests: `forge test` 26/26, `cd x402 && npm test` 5/5. **NØFI's only validator has a 0 balance, so the chain is likely halted until it's topped up (plan §0).**

Status (Sat 14 Nov 2026, ~01:00 Peru time): compiles with solc 0.8.28 (Foundry 1.9.0); **16/16 tests pass** (incl. 256-run fuzz);
off-chain EIP-712 digest (viem) == on-chain `hashAttestation()` (checked on a throwaway local anvil). **Not deployed anywhere.**

> Rules note: this scaffold was written before the hackathon's 9:00 a.m. start. Declare it in the project's
> References/AI section as pre-hackathon scaffolding written with an AI assistant, or ask the Local Lead first. See `../mentor/avalanche-track-plan.md` §7.

## Layout
```
src/WaterProofRegistry.sol        contract (no external deps)
test/WaterProofRegistry.t.sol     16 tests: access control, EIP-712 sig path, replay/tamper, corrections, credits
script/DeployFuji.s.sol           deploy + register 3 Moquegua farms (keystore signing, no keys in env)
oracle/build-attestation.mjs      evidence JSON → canonical sha256 → Attestation + EIP-712 typed data + cast commands
oracle/check-digest.mjs           local anvil cross-check (unlocked dev account, no keys)
oracle/examples/*.json            PLACEHOLDER evidence (replace with real NASA pulls)
web/registro.html                 farmer-facing verify page (Spanish, read-only by default; Core Wallet optional)
```

## Commands
```bash
forge build && forge test -vv
# local dry-run (in-memory, no RPC, no key):
ORACLE_ADDRESS=0x000000000000000000000000000000000000dEaD forge script script/DeployFuji.s.sol:DeployFuji
# off-chain digest cross-check:
anvil &  (cd oracle && npm i && node check-digest.mjs); kill %1
```

## Deploy to Fuji (team does this during the hackathon — not done here)
1. Core Wallet → enable Testnet mode → copy a fresh **deployer** address and a separate **oracle** address.
2. Fund the deployer from the Fuji faucet: https://build.avax.network/console/primary-network/faucet (Builder Hub login).
3. Import the deployer into an encrypted Foundry keystore (prompts for the key; nothing stored in plain text):
   `cast wallet import ceres-deployer --interactive`
4. Simulate, then broadcast + verify on Snowtrace (Routescan):
   ```bash
   export ORACLE_ADDRESS=0x...   # public address only
   forge script script/DeployFuji.s.sol:DeployFuji --rpc-url fuji --account ceres-deployer --sender 0xDEPLOYER
   forge script script/DeployFuji.s.sol:DeployFuji --rpc-url fuji --account ceres-deployer --sender 0xDEPLOYER --broadcast --verify
   ```
5. Open `https://testnet.snowtrace.io/address/<REGISTRY>`; put the address in `web/registro.html?registry=<REGISTRY>`.
6. Per farm-month: `node oracle/build-attestation.mjs <evidence.json> --chain 43113 --registry <REGISTRY>` → sign with
   `cast wallet sign --account ceres-oracle --data --from-file oracle/out/<stem>.typed.json` → submit with `attestWithSig`.
