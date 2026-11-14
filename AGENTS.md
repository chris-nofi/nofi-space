# AGENTS.md — instructions for Codex

You are improving **Agua Clara Moquegua**, a NASA Space Apps 2026 entry (challenge: Field Shift, local event: Moquegua, Perú). Read `docs/01_PROJECT_BREAKDOWN.md` first, then work through `docs/CODEX_TASKS.md` in order.

## What this project is
A crop-rotation explorer focused on water. NASA ECOSTRESS measures how much water each field uses; the farmer compares the existing rotation with three alternatives (evidence, gaps, risks); a satellite-verified, NØCHAIN-settled reward pays farmers for water saved; institutions buy the evidence over x402.

## Ground rules (do not break these)
1. **NASA data first.** The decision tool is the product. Chain, wallet and x402 are plumbing and must stay visually secondary.
2. **Always four strategies per farm**, including the existing one, each with `why`, `evidence`, `gaps`, `risks`. Never remove the "revisar con la Agencia Agraria / INIA" reminder or the "support, not replace" disclaimer.
3. **Label uncertainty.** Every number shows its source and a confidence level: `field` (ECOSTRESS, HLS, SRTM), `regional` (POWER, IMERG, SMAP, GRACE-FO), `transferred` (literature from elsewhere). Example values stay marked "Datos de ejemplo / Example data" until replaced by oracle output.
4. **Anti-gaming:** no payout unless `cropAlive == true` (HLS NDVI). Keep this in UI, oracle and contract.
5. **Farmers never pay** per query or per attestation. x402 is only for institutional or agent buyers.
6. **Privacy:** never put coordinates or farmer names on-chain. On-chain only `keccak256(polygon + salt)`.
7. **No token speculation.** No prices, no $NO token UI, no "investment" language. Testnet amounts are labeled "testnet / simulated".
8. **Neutral on water allocation.** The tool shows evidence; it never recommends who should get Pasto Grande water.
9. **Secrets:** never commit `.env`, private keys, seed phrases or API keys. Use `.env.example` for names only.
10. **Bilingual UI:** Spanish default, English toggle. All new UI strings go through `web/src/i18n.ts`.

## Design direction for the dashboard ("pimp it out", within these limits)
- Clean, calm, one screen per farm. Mobile-first at 390 px (it must work as a Telegram mini app), two columns from 960 px.
- Keep the existing token system in `web/src/styles.css` (water teal accent; NASA blue, desert ochre, payout green are semantic). Light and dark themes.
- Big readable numbers, short sentences, no jargon on farmer-facing text. Jargon goes in the "Fuentes / Sources" drawer.
- Charts: custom SVG components already exist; you may switch to a charting library only if it stays small and accessible.
- Motion: subtle; respect `prefers-reduced-motion`.
- Accessibility: keyboard focus visible, buttons are buttons, 4.5:1 contrast.

## Commands
```bash
# Dashboard
cd web && npm install && npm run dev        # http://localhost:5173 (mock data)
cd web && npm run build                      # must pass with zero TS errors

# Oracle
cd oracle && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest -q                                    # unit tests (offline)
python -m earth_oracle.cli power --farm samegua   # live NASA POWER pull (no login)
uvicorn earth_oracle.server:app --reload --port 8787

# Contracts
cd contracts && forge install foundry-rs/forge-std --no-git && forge test -vv   # contracts have no other dependencies
forge script script/Deploy.s.sol --rpc-url $NOCHAIN_RPC_URL --broadcast
```

## Definition of done for any task
- Builds and tests pass (`npm run build`, `pytest`, `forge test`).
- No ground rule broken.
- Docs updated if behavior changed (`docs/`).
- Demo still works end to end on mock data with no network.
