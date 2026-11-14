# SI engine and CERES

The Field Shift brief asks teams to **compare rotations, reveal trade-offs, understand risk and make uncertainty visible**, and to build an SI model. The engine in `oracle/earth_oracle/si/` does exactly those four things, and **CERES** speaks the result.

> **CERES** — named after Ceres, the Roman goddess of grain, and the dwarf planet where NASA's Dawn mission found briny water under the surface. Farming, space and water in one name. Rename it in one place: `AGENT_NAME` in `oracle/earth_oracle/si/__init__.py` (and `ceres` in `web/src/i18n.ts`).

## One call

```http
POST /v1/si/analyze
{ "farmId": "samegua",
  "priorities": { "water": 0.4, "soil": 0.25, "income": 0.25, "resilience": 0.1 },
  "scenario":   { "rainPct": -30, "tempDeltaC": 1.5 },
  "draws": 300, "lang": "es" }
```

Returns `compare`, `tradeoffs`, `risk`, `uncertainty`, `seasons`, `waterUse`, `dataQuality` and `voice` (CERES in Spanish and English). Full example: `docs/examples/si_analyze_samegua.json`. Runs in about 0.5 s per farm at 300 draws.

Other endpoints: `GET /v1/si/model` (model card), `POST /v1/si/train` (retrain), `POST /v1/ceres/brief` (only CERES's words, for voice clients).

## How it works

```
NASA POWER (or synthetic fallback) ──► climate (monthly) ──► FAO-56 ET0
                                          │  scenario sliders: rain %, warming °C
crops.json (Kc, traits, economics) ──┐    ▼
rotations.json (4 strategies/farm) ──┴► simulate(): water balance · yield-adjusted income
                                          · soil index · month × hazard grid
SI model (ECOSTRESS gap-fill + calibration) ──► calib factor
                                          ▼
                     Monte Carlo (300 climate + crop-model + market draws)
                                          ▼
     compare · trade-offs (weights + Pareto) · risk grid · uncertainty (p10/p50/p90, rank odds, drivers)
                                          ▼
                                 CERES narrative (es / en)
```

### Module 1 — Compare rotations
For each strategy (existing + three alternatives), an average year of the rotation is simulated month by month:
- **Water:** crop demand `ETc = Kc × ET0 × days` (FAO-56 Kc curves split 20/30/30/20 %). Irrigated farms: irrigation need `max(0, ETc − effective rain) × 10` m³/ha, capped by the canal supply (deficit if short). Rainfed: a 100 mm soil bucket fed by effective rain (USDA-SCS); cover-crop strategies with trenches get an infiltration bonus.
- **Income:** `yield × (1 − deficit share) × price − cost` per crop (Ky ≈ 1). Yields, prices and costs are **example values**.
- **Soil index (0–100):** `30 + 20·legume share(≤40 %) + 35·mean cover + 5 per extra plant family (max 15) + 5 deep roots − 10 monoculture − 4 per bare rainy month`. Transparent on purpose so an agronomist can argue with it.
- Deltas vs current: water %, soil points, income %, risk points.

### Module 2 — Reveal trade-offs
Four criteria per strategy, higher is better: **water** (least canal water, or least deficit if rainfed), **soil** (index/100), **income** (share of the best option), **resilience** (1 − risk). The farmer's priorities weight them. Output: ranked list, Pareto-optimal flags, radar values and the formula itself.

### Module 3 — Understand risk
A 12 × 5 grid per strategy, averaged over the Monte Carlo draws:

| Hazard | Rule |
|---|---|
| frost | crop in field and monthly Tmin near the crop's `frostC` (sigmoid) |
| heat | monthly Tmax near the crop's `heatC` |
| water | unmet demand > 30 % of crop demand that month |
| bare | share of exposed soil (cover < 0.5) |
| salinity | salty irrigation water (Ilo) × crop tolerance |

Peak month and hazard, year-round flag, and months above 0.4 ("vulnerable months").

### Module 4 — Make uncertainty visible
- **Monte Carlo:** each draw samples a climate year (AR(1) temperature anomalies, lognormal rain), crop-model error (Kc ±8 %, calibration ±5 %) and market (price ±20 %, yield ±12 %).
- **Outputs:** p10/p50/p90 for water, income, risk and deficit; the probability that each strategy ranks first; and **what drives the spread**, as one-at-a-time variance shares (climate vs crop model vs market).
- **Confidence:** high / medium / low from spread and rank stability, **capped at medium while any input is synthetic**. The rule is returned with the answer.

### Seasons
Bare-field windows, green-up and senescence months from HLS NDVI (or from the crop calendar when HLS isn't cached yet).

## The SI water-use model
`oracle/earth_oracle/si/model.py` predicts monthly field ET (mm/day) from harmonized features: month (sin/cos), ET0, Tmax, Tmin, rain, NDVI, elevation and an irrigated flag. Three approaches are compared under 5-fold GroupKFold by farm-year:

| Approach | Held-out MAE (mm/day) | R² | 80 % band coverage |
|---|---|---|---|
| Physics (FAO-56, Kc from NDVI) | 0.72 | 0.72 | — |
| Ridge regression | 0.62 | 0.78 | — |
| **Gradient boosting, quantile p10/p50/p90** | **0.47** | **0.85** | 0.74 (target 0.80) |

**These numbers come from SYNTHETIC training data** (physics simulation with management and ~15 % sensor noise), so the pipeline works before the first Earthdata download. Retrain on real ECOSTRESS passes with `python -m earth_oracle.cli train` once `real_dataset()` is implemented (Task T5.1). The 80 % band is slightly too narrow; recalibrate the quantiles on real data.

**How the engine uses it:**
1. Fills months without a clear ECOSTRESS pass (`waterUse.current[*].source = "si-model"`, with p10–p90).
2. Computes a calibration factor (observed ÷ physics, clipped 0.8–1.2) that scales every strategy's demand. This is the data-fusion step: physics for "what if", satellite for "what is".

## CERES
`oracle/earth_oracle/si/voice.py` builds every sentence from the analysis dict, so CERES cannot invent a number. It always says:
- current water use
- the best strategy for the farmer's priorities, with water, soil and income changes
- how often that strategy wins and the likely water range
- the riskiest month or "all year"
- confidence, and whether example climate is in use
- the reminder to review with the Agencia Agraria or INIA

The dashboard reads it aloud with the browser's speech engine. A future LLM layer may rephrase it but must keep the facts and the reminder (Task T5.3).

## Known limits
- Monthly time step: no daily frost nights or heat waves, only monthly means.
- Rotations are averaged into one year; year-to-year carry-over (nitrogen from legumes, pest build-up) is only in the soil index, not in yields.
- Yields, prices, costs and canal supply are example values.
- Synthetic climate and training data until NASA POWER and ECOSTRESS caches exist.
