# Plan v2 alignment: CERES Ventures on the NØFI L1 + x402

Source of truth for chain, money model and pitch: **`avalanche-track-plan-v2-nofi-l1.md`** (prepared by Apollo, Sat 14 Nov 2026). This doc records what changed in *this* repo to match it, and what is still open. Where an older doc disagrees with this one, this one wins.

## What changed (Sat 14 Nov, before 09:00 Peru)

| Area | v1 (before) | v2 (now) |
|---|---|---|
| Name | Agua Clara Moquegua | **CERES Ventures, by NOFI Labs**. CERES is also the AI voice |
| Money model | Farmers earn USDC rewards per m³ saved (`WaterEscrow`), cash out to soles | **Farmers never pay and never see crypto.** NASA data is sold per query with x402 to the CERES agent, cooperatives and buyers/auditors; each monthly record is anchored in `WaterProofRegistry` |
| Chain | NØCHAIN / Fuji, generic | **NØFI L1, chain 880024** (own ACP-77 L1, tUSD gas, explorer nofiscan.io). Fuji 43113 only as fallback (plan §3.3) |
| Contracts | `contracts/`: PlotRegistry, WaterEscrow, MockUSDC | **`avalanche/`** (Apollo's): WaterProofRegistry, X402TestUSDC (EIP-3009). `contracts/` is now **legacy reference**, not deployed |
| x402 | Demo-mode gate on Python `/v1/evidence-pack` | **Node oracle + self-hosted facilitator** in `avalanche/x402/` serving `GET /v1/earth/{farm}/{YYYYMM}`. Python gate removed |
| Python oracle role | Signed EIP-712 attestations for escrow payouts | Builds the **earth records** the x402 oracle sells (`earth_oracle/proof.py`), runs the SI engine and CERES |
| CERES | Explained rewards, `estimate_reward` tool | Explains water, rotations and the verifiable record; tool **`get_verified_record`** buys the record via x402 when configured; never promises payments |
| Site | Recompensas page with USDC flow | **Registro verificable** page: monthly records, dataHash, status; partner section explains x402 on the NØFI L1 |

## Earth record (what gets hashed, sold and anchored)

`python -m earth_oracle.cli export-evidence --periods 202608,202609,202610 --out ../avalanche/x402/data`

One file per farm-month, `{farm}-{YYYYMM}.json`:

```json
{
  "record": {
    "schema": "ceres-ventures/earth-record@1",
    "farmId": "samegua", "plotId": "0x… (keccak of polygon+salt, no coordinates)", "period": "202610", "areaHa": 1.2,
    "values": { "etMmDay": 4.93, "etSource": "ecostress|si-model", "et0MmDay": 5.65, "rainMm": 0.0,
                "ndvi": 0.795, "ndviSource": "hls|modeled", "strategyCurrent": "current", "strategy": "maiz-arveja",
                "waterSavedM3": 1437, "waterSavedBasis": "…" },
    "sources": [ { "dataset": "NASA POWER", "id": "…", "used": false }, { "dataset": "ECOSTRESS", "id": "ECO_L3T_JET", "granules": [], "used": false }, … ],
    "engine": { "name": "earth_oracle", "version": "0.1.0", "sha256": "0x…" },
    "placeholder": true,
    "limits": [ … ]
  },
  "dataHash": "0x… sha256(canonical(record))",
  "sourcesHash": "0x… sha256(canonical(record.sources))",
  "onchain": { "period": 202610, "etMmDayX100": 493, "et0MmDayX100": 565, "rainMmX10": 0, "ndviX1000": 795, "strategy": "maiz-arveja", "waterSavedM3": 1437, "creditEligible": true },
  "placeholder": true
}
```

- **Canonical JSON** = sorted keys, no whitespace, UTF-8 (`json.dumps(sort_keys=True, separators=(",",":"), ensure_ascii=False)`). The JS side must hash the same bytes.
- **No timestamps** inside the record, so the hash is reproducible.
- **`placeholder: true`** whenever POWER, ECOSTRESS or HLS for that month is synthetic or modeled. **Never attest a placeholder record** (plan §7).
- `creditEligible` is false when NDVI < 0.20 (bare or dead field), matching the registry's credit rule.
- Water saved: irrigated farms = canal irrigation need, current minus recommended; Carumas (rainfed) = extra water kept in the basin.

**Merge check (open):** align these field names and scale factors with `avalanche/x402/earth-data.mjs` and `WaterProofRegistry.attest()` once `avalanche/` is in the repo. Keep one schema.

## CERES agent pays per answer (x402 buyer)

`earth_oracle/x402_client.py`: `GET` → `402` + `PAYMENT-REQUIRED` → signs EIP-3009 `TransferWithAuthorization` (domain from `accepted.extra`, chain from the CAIP-2 network) → retries with `PAYMENT-SIGNATURE` → reads `PAYMENT-RESPONSE`.

Safety rails:
- Only `X402_NETWORK` (default `eip155:880024`) and, if set, `X402_ASSET`.
- Hard price cap `X402_MAX_AMOUNT`, default 100000, which is 0.10 of a 6-decimal dollar.
- The key comes from `CERES_AGENT_PRIVATE_KEY` at call time. It's never logged or returned, and is testnet-only.

Turn it on by setting `X402_EARTH_URL` (the Node oracle's HTTPS URL) and `CERES_AGENT_PRIVATE_KEY` on the oracle server. `/v1/ceres/chat` then returns `proofs[]` (dataHash, placeholder, payment.txUrl), and the site shows a "Registro verificable ✔ · ver prueba" chip under the answer.

Tested in `oracle/tests/test_v2.py`:
- A fake oracle recovers the EIP-712 signer and checks payee, amount, network and nonce.
- Over-cap prices are refused, and so are wrong networks.
- The key never appears in the result.

## Endpoints in the Python oracle

| Route | Who | What |
|---|---|---|
| `GET /v1/records/{farm}?periods=…` | Site (farmer view) | Summaries: period, dataHash, placeholder, strategy, water saved. No values for sale, no prices |
| `GET /v1/records/{farm}/{YYYYMM}/package` | x402 oracle / attest script | Full package. Requires `Authorization: Bearer $ORACLE_ADMIN_TOKEN` |
| `POST /v1/ceres/chat` | Site | CERES answer + `proofs[]` |
| `POST /v1/attest/{farm}` | — | **Legacy** v1 escrow signature. Not used in v2 |

## Pre-existing work: how to declare it (plan §4)

| Item | When | Declaration |
|---|---|---|
| NØFI L1, validator, nofiscan, tUSD gas | Oct 2026 | "Infraestructura preexistente del equipo." References section |
| This repo: SI engine, CERES (Claude + Retell), site, legacy contracts, v2 alignment | Fri 13 and Sat 14 Nov, before 09:00, with AI assistants (Claude, Codex) | **AI disclosure**: "AI-drafted scaffold, reviewed and completed by the team during the hackathon." Git timestamps show it |
| `avalanche/` (WaterProofRegistry, X402TestUSDC, facilitator, pagar.html) | Fri 13 and Sat 14 Nov, before 09:00, with Apollo | Same |
| Real NASA pulls, engine runs on real data, attestations, x402 payment txs, video, pitch | During the hackathon | nofiscan timestamps |

Ask the Moquegua Local Lead and Team1 whether pre-hackathon scaffolding is OK (plan §8.1). **Deploy nothing before 09:00 Sat.**

## Still open (in order)

1. **Revive the NØFI validator** (plan §0): P-Chain balance is 0 and the last block is #200 (29 Oct). `IncreaseL1ValidatorBalanceTx` with ~5 Fuji AVAX for validationID `LRQoNTfzo87JF8N97DcM73AwtQV4ZtNU8e1vQc6p68ZmWsmbR`. Go/no-go 12:00, otherwise Fuji.
2. **Merge `avalanche/` into this repo** and reconcile the record schema (above).
3. Real NASA pulls (POWER, then AppEEARS HLS/ECOSTRESS) → `export-evidence` → records with `placeholder: false`.
4. Deploy and verify on NØFI, attest the first real record, and point `site/config.js` → `registryAddress`.
5. Node x402 oracle + facilitator over HTTPS, then set `X402_EARTH_URL` and `CERES_AGENT_PRIVATE_KEY`. First real CERES payment tx on nofiscan before 19:00 Sat.
6. `site/config.js` → `x402PayUrl` (pagar.html), so judges can pay from their own wallet.
