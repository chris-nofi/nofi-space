# Videos: shot lists (record only when Chris says go; don't depend on a live call)

## A. NASA packet: 30 seconds, English subtitles
Only use numbers that are on screen in the current build.

| t | Screen | Voice-over / subtitle |
|---|---|---|
| 0–5 s | Overview hero "Rota mejor, cuida tu suelo" + Moquegua map | "Ceres Ventures: NASA data for Moquegua farmers, in their own language." |
| 5–10 s | Carumas → Strategies: potato → potato vs faba → oat-vetch vs tarwi | "Compare today's rotation with alternatives that build soil." |
| 10–15 s | Evidence chips (HLS NDVI · Oct 2026 · 30 m; NASA POWER ET₀) + gaps/risks boxes | "Every option shows its NASA evidence, its gaps, and risks to check locally." |
| 15–20 s | SI view: drag "Suelo" up and "Agua" down; the "Mejor para ti" tag moves | "The farmer's priorities re-rank the options. It works offline." |
| 20–25 s | Season timeline: bare months Sep–Jan, vulnerable Dec–Jan; slope 16° card | "Satellites show when the soil is bare and exposed to erosion." |
| 25–30 s | Pre-recorded CERES line + "Registro verificable" badge | "CERES supports, and does not replace, the farmer and the local agronomist." |

Captions: label CERES as "AI voice". Show the CHIRPS/IMERG note if rain appears on screen.

## B. Team1 Avalanche cut: 2–3 minutes
1. **Open the app.** El Algarrobal → drip + strip cover, 12,882 m³/ha/yr (−24.5 %) → evidence chips → "Evidencia completa vía x402" (was "Descargar evidencia (JSON)".
2. **Show the record.** "Registro verificable" → nofiscan record. The `dataHash` must match the downloaded JSON. *Needs the validator revived and the registry deployed and attested first.*
3. **x402.** Judge page or the CERES agent calls `GET /v1/earth/algarrobal/202610` → HTTP 402 → wallet **signature** (no gas) → data + payment tx link on nofiscan.
4. **Why our own L1.** One sentence: dollar gas (tUSD), allowlisted oracle writers, we set the fee. Stop there.

If the demo falls back to Fuji, say so in one sentence.
