# CERES: text chat (Claude API) + voice calls (Retell)

CERES is one brain with two channels. Both use the same system prompt, the same knowledge pack and the same tools, so the voice and the chat never disagree.

```
Dashboard "Conversar con CERES" ──► POST /v1/ceres/chat ──┐
                                                            ├─► Ceres agent (Claude Messages API, tool loop)
Phone / web call ──► Retell (speech↔text) ──► wss /v1/ceres/retell/{call_id} ┘        │
                                                                                     ▼
                                    tools: get_farm_analysis · estimate_reward · get_risk_calendar
                                                                                     ▼
                                                                SI engine (oracle/earth_oracle/si)
```

## How CERES is "trained" on this project
It isn't fine-tuned. It is **grounded**, which is more accurate and updatable by editing a file:
1. **Knowledge pack** (`oracle/earth_oracle/ceres/knowledge/*.md`, sent as the cached system prompt):
   - `01_ceres_ventures.md`: what the tool is, the three farms, the SI and CERES.
   - `02_datos_nasa.md`: each NASA dataset in plain Spanish, key terms, honest limits.
   - `03_rotaciones.md`: why rotations help, the soil score formula, the options and trade-offs per farm.
   - `04_quien_paga_y_registros.md`: **how the money works (plan v2).** The farmer never pays or sees crypto. Who pays per query (CERES agent, cooperatives, buyers) and why. The verifiable record and dataHash, WaterProofRegistry, how x402 works, the NØFI L1 facts (880024, tUSD gas, nofiscan), the NDVI < 0.20 rule, what it is *not* (no payment to farmers, insurance, loan or token), MERESE as a future user, and seed-phrase safety.
2. **Rules** (`prompt.py`):
   - Every farm number must come from a tool.
   - Never promise payment or rewards to farmers; don't talk about wallets or tokens with farmers unless asked.
   - Never ask for seed phrases or keys.
   - Stay neutral on water allocation.
   - No pesticide doses or tax advice.
   - Always remind the farmer to review with the Agencia Agraria or INIA.
   - Reply in the user's language.
3. **Live tools** (`tools.py`): `get_farm_analysis` and `get_risk_calendar` call the SI engine; `get_verified_record` fetches the monthly earth record, **paying the x402 oracle from the CERES agent wallet** when `X402_EARTH_URL` and `CERES_AGENT_PRIVATE_KEY` are set (plan v2). The chat response carries `proofs[]` with the dataHash and the payment tx link.

To teach CERES something new, add or edit a markdown file in `knowledge/`. It's picked up on restart.

## Models
| Channel | Default model | Why | Settings |
|---|---|---|---|
| Text chat | `claude-sonnet-5-5` | Best balance of speed and intelligence | effort `medium`, adaptive thinking |
| Voice | `claude-haiku-5-5` | Lowest latency, for natural phone turns | effort `low`, thinking disabled, 1–3 sentence turns |

Override with `CERES_TEXT_MODEL` / `CERES_VOICE_MODEL`. The persona + rules + knowledge block uses prompt caching (`cache_control: ephemeral`), so repeated turns cost less and start faster.

## Setup

### 1. Text chat
```bash
# .env (server only — never in web/.env)
ANTHROPIC_API_KEY=sk-ant-...
cd oracle && uvicorn earth_oracle.server:app --port 8787
# web/.env
VITE_ORACLE_URL=http://localhost:8787
```
Open the dashboard → CERES card → "Conversar con CERES".

### 2. Voice (Retell)
Retell must reach the oracle over the internet with TLS (`wss://`). For the hackathon, a tunnel works, e.g. `cloudflared tunnel --url http://localhost:8787`, which gives an https URL; use it as `wss://...`.

```bash
# .env (server only)
RETELL_API_KEY=key_...
RETELL_VOICE_ID=<a Spanish (Latin America) voice id from the Retell dashboard>
PUBLIC_WSS_URL=wss://<your-tunnel-or-domain>
cd oracle && python scripts/retell_setup.py          # prints agent_id
# web/.env
VITE_RETELL_AGENT_ID=<agent_id>
VITE_RETELL_PUBLIC_KEY=<Retell PUBLIC key, allowed for localhost + your domain>
```
Test first in the Retell dashboard (agent → Test Audio), then use "Llamar a CERES" in the dashboard. The call passes `{farmId, lang}` as metadata, so CERES knows which farm you're looking at.

**Phone number (optional):** buy or import a number in Retell and attach the same agent. Farmers can then call CERES from any phone, no app needed. That's the strongest demo for rural users.

## Protocol notes (Retell custom LLM)
- On connect the server sends `config` (`auto_reconnect`, `call_details`), then greets as `response_id: 0` in the caller's language (it waits up to 0.8 s for `call_details`).
- It answers `ping_pong` with the same timestamp.
- It streams `response` chunks for each `response_required` / `reminder_required`, and drops a reply if a newer `response_id` arrives (the caller interrupted).
- Errors never leave the caller in silence: CERES says it had a problem and asks them to repeat.

## Costs to watch
- Claude: Haiku 5.5 for voice is the cheapest model; prompt caching cuts the repeated knowledge-pack cost. A tool call adds one extra model round.
- Retell bills per call minute; check your plan before sharing a public phone number.

## Tested here
`oracle/tests/test_ceres.py` (11 tests) covers:
- the knowledge pack covers product, data, rotations and money
- the grounding and voice rules
- reward math for both rules
- the tool loop with a fake Claude client, which checks model, effort, caching, tool_result wiring and that empty fields are stripped
- voice settings
- the full Retell WebSocket handshake: config → greeting in the caller's language → ping_pong → streamed response
- the chat endpoint (503 without a key)

**Not tested here:** live calls to the Claude API and Retell. They need your keys.
