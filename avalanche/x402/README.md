# Ceres Earth oracle · x402 paywall on Avalanche Fuji C-Chain (eip155:43113)

Insurers, lenders, co-ops, exporters (and judges) pay per lookup for a **Ceres Field Score** or the full **NASA
evidence bundle** of a Moquegua field. Payment is standard **x402 v2** (HTTP 402 → `PAYMENT-REQUIRED`; client
retries with `PAYMENT-SIGNATURE`; server returns data + `PAYMENT-RESPONSE`), scheme `exact`, transfer method
**EIP-3009**, in **Circle's Fuji USDC** (`0x5425890298aed601595a70AB815c96711a31Bc65`, EIP-712 domain `"USD Coin"` / `"2"`),
settled by our **self-hosted facilitator**. The payer only signs; the facilitator pays the gas. Every paid response
carries `proof`: the Snowtrace payment tx and `recordedOnChain`, i.e. whether these exact bytes match the `dataHash`
anchored in `WaterProofRegistry`. Farmers use the map free and never see any of this.

> Running on Fuji C-Chain today. The same contracts deploy unchanged to the NØFI L1 (880024), which gives us
> stablecoin gas and an oracle allowlist. (Set `X402_CHAIN_ID=880024` + the X402TestUSDC address/domain there.)

**Testnet demo pricing. Not a commercial offer.**

| Route | Price | Returns |
|---|---|---|
| `GET /v1/field/:id/score[?period=YYYYMM]` | 0.02 USDC | `ceres-field-score.v1` JSON (score, confidence, components, gaps) + evidence `dataHash` |
| `GET /v1/field/:id/evidence[?period=YYYYMM]` | 0.05 USDC | the full evidence JSON + `dataHash` (re-hash it yourself) |
| `GET /v1/earth/:farm/:period` | 0.05 USDC | older compact shape, kept as an alias |
| `GET /v1/farms`, `GET /health` | free | what can be bought, prices, network, payTo, registry |

`:id` = `algarrobal` · `carumas` · `samegua` (`el-algarrobal` accepted as an alias). Default period = latest (202610).
Data served = `../oracle/evidence/` only. `../oracle/examples/` (PLACEHOLDER) is never loaded, and any placeholder
month would be refused with 503 rather than sold.

| File | What |
|---|---|
| `config.mjs` | Fuji (default) + NØFI chain defs, Circle USDC domain defaults, prices, env → config |
| `field-score.mjs` | `ceres-field-score.v1`, pure function of one evidence JSON. No deps; the dashboard can import the same file |
| `earth-data.mjs` | loads evidence (same canonical sha256 as `../oracle/build-attestation.mjs`) |
| `facilitator.mjs` | verify/settle for exact+EIP-3009 (mirrors coinbase/x402 `exact/facilitator/eip3009.ts` checks) |
| `facilitator-server.mjs` | facilitator as its own service: `POST /verify`, `POST /settle`, `GET /supported`, `GET /health` |
| `server.mjs` | the oracle (routes above) |
| `client.mjs` | agent/buyer client: `payAndFetch(url)` |
| `web/pagar.html` | judge page: EIP-6963 picks **Core**, switch/add Fuji, USDC balance, 402 → sign → 200, score view, Snowtrace receipt |
| `test/` | 15 tests: anvil `--chain-id 43113` with a Circle-domain mock (e2e) + score formula/snapshot |

## Tests (no keys, no network)

```bash
(cd .. && forge build) && npm ci && npm test    # 15/15
```

## Live demo on Fuji: runbook

Chris-gated: deploying, funding and running with a key are his calls. Keys are exported in a shell only, never written to files.

1. **Wallets** (three different addresses):
   - *Payer*: the demo account in Core (Testnet Mode on). Fund it with test USDC at <https://faucet.circle.com/> → Avalanche Fuji. Needs **no AVAX**.
   - *Facilitator*: fresh hot wallet holding only a little Fuji AVAX for gas.
   - *payTo*: the Ceres treasury. Must not be the payer.
2. **Registry**: from `avalanche/`:
   ```bash
   ORACLE_ADDRESS=0x<oracle> forge script script/DeployNofi.s.sol:DeployNofi --rpc-url fuji --account ceres-deployer --sender 0x<deployer>            # simulate
   ORACLE_ADDRESS=0x<oracle> forge script script/DeployNofi.s.sol:DeployNofi --rpc-url fuji --account ceres-deployer --sender 0x<deployer> --broadcast --verify
   ```
   Deploys `WaterProofRegistry` only (no test token) and registers `moquegua:carumas|samegua|algarrobal`.
3. **Anchor one month** (real ET, not a null month):
   ```bash
   node oracle/build-attestation.mjs oracle/evidence/algarrobal-202610.json --chain 43113 --registry 0x<registry>
   # then run the printed `cast send … attest(…)` with --account ceres-oracle
   ```
4. **Facilitator** (terminal 1):
   ```bash
   read -s FACILITATOR_PRIVATE_KEY && export FACILITATOR_PRIVATE_KEY
   X402_PAY_TO=0x<treasury> node facilitator-server.mjs        # GET :4021/health shows signer + AVAX balance
   ```
5. **Oracle** (terminal 2):
   ```bash
   X402_PAY_TO=0x<treasury> WATERPROOF_REGISTRY=0x<registry> X402_FACILITATOR_URL=http://127.0.0.1:4021 \
   ALLOWED_ORIGINS=https://<site> node server.mjs
   curl -i localhost:4020/v1/field/algarrobal/score              # → 402 + PAYMENT-REQUIRED
   ```
6. **HTTPS**: put the oracle behind HTTPS (a Netlify-hosted `pagar.html` cannot call `http://`). The facilitator can stay private on localhost.
7. **Judge page**: open `web/pagar.html?api=https://<oracle>` → Conectar → Cambiar a Fuji → Pagar y ver datos.

First live check, before rehearsing anything else: one paid `/v1/field/algarrobal/score` from Core on real Fuji.
That proves Core's `eth_signTypedData_v4` against Circle's domain and the facilitator's settlement in one shot.
