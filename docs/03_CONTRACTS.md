# Contracts (NØCHAIN testnet, Fuji fallback)

> **Legacy (plan v1).** Superseded by `docs/09_PLAN_V2.md` and the v2 plan's pitch (§6). Kept for reference.

NØCHAIN is NOFI's Avalanche L1 (Subnet-EVM), so standard Solidity deploys unchanged.

## PlotRegistry
- `register(bytes32 plotHash, uint32 areaHaX100, bytes32 basin)` — `plotHash = keccak256(polygonGeoJSON + salt)`. The polygon and salt stay off-chain with the farmer's consent. The caller becomes the plot owner.
- `ownerOf(plotHash)`, `areaOf(plotHash)`.

## WaterEscrow
Flow:
1. **Funder** (e.g. a MERESE fund wallet) calls `openOffer(plotId, season, rule, rate, maxPayout)` and locks `maxPayout` USDC.
   - `rule = 0` PER_M3_SAVED: `rate` = USDC base units per m³ (e.g. 15000 = 0.015 USDC with 6 decimals).
   - `rule = 1` PER_PRACTICE: payout = `maxPayout × complianceBps / 10000`.
2. **Farmer** (plot owner) calls `accept(plotId, season)`. (Task T3.4 adds `acceptWithSig` for sponsored gas.)
3. **Oracle** signs an EIP-712 `Attestation`; **anyone** calls `settle(att, sig)`.
4. Contract checks: signer == oracle, offer accepted, not settled, `cropAlive == true`. Pays the farmer, refunds the remainder to the funder.

## EIP-712
Domain: `name = "AguaClara"`, `version = "1"`, `chainId`, `verifyingContract = WaterEscrow`.

```
Attestation(
  bytes32 plotId,
  uint32  season,
  uint8   rule,
  uint64  value,          // rule 0: m³ saved (whole plot); rule 1: complianceBps
  bool    cropAlive,
  bytes32 evidenceHash
)
```

The Python signer (`oracle/earth_oracle/sign.py`) uses the same types. Keep them identical.

## USDC on NØCHAIN
- Hackathon: `MockUSDC` (6 decimals, open mint, testnet only).
- Production: bridge USDC from C-Chain with Avalanche Interchain Token Transfer (ICTT): `ERC20TokenHome` on C-Chain → `ERC20TokenRemote` (or `NativeTokenRemote` if USDC is the gas token) on NØCHAIN.

## Later
- k-of-n oracle signers; later staked validators.
- Dispute window before settle.
- Fee Manager precompile for near-zero farmer fees.
