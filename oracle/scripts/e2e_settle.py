"""End-to-end settle on NØCHAIN testnet (or Fuji). Skeleton for Codex task T3.3.

Steps:
  1. farmer: PlotRegistry.register(plotHash, areaHaX100, basin)
  2. funder: MockUSDC.mint + approve; WaterEscrow.openOffer(plotId, season, rule, rate, maxPayout)
  3. farmer: WaterEscrow.accept(plotId, season)
  4. oracle: POST /v1/attest/{farm} → attestation + signature
  5. anyone: WaterEscrow.settle(att, sig) → print explorer link

Needs: pip install web3==7.6.0 ; env NOCHAIN_RPC_URL, NOCHAIN_CHAIN_ID, addresses, test keys.
ABIs: contracts/out/<Contract>.sol/<Contract>.json after `forge build`.
"""
from __future__ import annotations

raise SystemExit("TODO(T3.3): implement with web3.py using the steps in the docstring.")
