// Ceres Field Score, formula ceres-field-score.v1 (spec: mentor/farm-map-x402-plan.md §2).
// Pure function of ONE evidence JSON. No I/O, no dependencies: the API (server.mjs) and the browser
// dashboard (ceres-ai) can import this same file, so the map and the paid API never disagree.
//
// Decision-support index, NOT a credit rating, insurance score, soil-loss or yield prediction.
// Changing any anchor or weight below requires a new formulaVersion (v2).

export const FORMULA_VERSION = "ceres-field-score.v1";

export const WEIGHTS = { water: 0.25, vegetation: 0.25, soil: 0.20, climate: 0.15, erosion: 0.15 };

// Draft index anchors (shown in the drawer, not agronomic thresholds).
export const ANCHORS = {
  ndviLow: 0.15, ndviHigh: 0.70,          // vegetation
  textureFull: 60,                          // clay+silt % for full "holding" score
  socLow: 5, socHigh: 25,                   // g/kg
  phIdeal: 7.0, phSpan: 2.5,                // pH distance at which S_ph hits 0
  frostDaysZero: 60,                        // climatology days < 0 °C at which C hits 0
  slopeSteepDeg: 25,                        // erosion slope anchor
  proxyHigh: 6,                             // erosion tan(slope) × p95 intensity anchor
  ndviSeriesGap: 0.15,                      // |S2 − HLS| above this → show both, drop confidence
  proxyDivergence: 2,                       // larger/smaller POWER vs ERA5 above this → take higher risk
};

// ── numeric helpers ─────────────────────────────────────────────────────────
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
// Round half away from zero, robust to IEEE-754 artefacts (71.45*10 = 714.4999…): normalise to 12
// significant digits first. Inputs here are ≥ 0, but the sign handling keeps it correct anyway.
const fix = (x) => Number(x.toPrecision(12));
export const round1 = (x) => Math.sign(x) * Math.floor(Math.abs(fix(x * 10)) + 0.5) / 10;
export const roundInt = (x) => Math.sign(x) * Math.floor(Math.abs(fix(x)) + 0.5);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Rounding rule (fixed for v1, matches the §2.4 worked example):
 *   every sub-score → 1 decimal; each component = mean/blend of its rounded sub-scores → 1 decimal;
 *   score = weighted mean of rounded components over the weights actually used → integer (half away from zero).
 */
export function fieldScore(ev) {
  if (!ev || !ev.indicators) throw new Error("fieldScore: evidence JSON with `indicators` required");
  const ind = ev.indicators, x = ev.extensions ?? {}, ctx = ev._context ?? {};
  const gaps = [];
  const lowReasons = [];
  const fps = typeof x.fieldPixelStatus === "string" ? x.fieldPixelStatus : "";
  const pixelPending = /PENDING|PARTIAL/i.test(fps);
  const components = {};

  // ── Water ────────────────────────────────────────────────────────────────
  {
    const et = num(ind.et_mm?.value), et0 = num(ind.et0_mm?.value);
    const sm = ctx.soilMoisture;
    let wEt = null, esi = null, wSmap = null;
    if (et === null) {
      gaps.push(`ET null: ${ind.et_mm?.reason ?? "no value"}`);
      lowReasons.push("ET null");
    } else if (et0 !== null && et0 > 0) {
      esi = et / et0;
      wEt = round1(100 * clamp01(esi));
      if (et === 0 && (ind.et_mm?.granules?.length ?? 0) > 0) { gaps.push("review: zero ET (measured, granules listed)"); lowReasons.push("ET zero"); }
    } else {
      gaps.push("ET0 missing or zero");
    }
    const smV = num(sm?.value_m3m3), smB = num(sm?.baseline_2015_2025_m3m3);
    if (smV !== null && smB !== null && smB > 0) wSmap = round1(100 * clamp01(smV / smB));
    else { gaps.push("smap TODO"); if (pixelPending) lowReasons.push("no SMAP and ET from bare app point"); }

    let w = null;
    if (wEt !== null && wSmap !== null) w = round1(0.5 * wEt + 0.5 * wSmap);
    else if (wSmap !== null) w = wSmap;
    else if (wEt !== null) w = wEt;
    if (w !== null) components.water = { value: w, weight: WEIGHTS.water, inputs: {
      et_mm: et, et0_mm: et0, esi: esi === null ? null : Number(esi.toFixed(3)), w_et: wEt,
      smap: wSmap === null ? null : { value_m3m3: smV, baseline_2015_2025_m3m3: smB, w_smap: wSmap, dataset: sm?.dataset ?? null, scale: sm?.scale ?? null },
      et_dataset: ind.et_mm?.dataset ?? null, et0_dataset: ind.et0_mm?.dataset ?? null } };
  }

  // ── Vegetation ───────────────────────────────────────────────────────────
  {
    const cover = x.cover;
    const s2 = num(cover?.ndvi_month_median), nClear = num(cover?.n_clear_obs) ?? 0;
    const hls = num(ind.ndvi?.value);
    let ndvi = null, dataset = null, series = null;
    if (s2 !== null && nClear > 0) { ndvi = s2; dataset = cover.dataset ?? "Sentinel-2 L2A"; series = "s2"; }
    else if (hls !== null) { ndvi = hls; dataset = ind.ndvi?.dataset ?? "HLS"; series = "hls"; }
    if (ndvi !== null) {
      const inputs = { ndvi, dataset, series, n_clear_obs: series === "s2" ? nClear : null };
      if (series === "s2" && hls !== null) {
        inputs.hls_ndvi = hls; inputs.hls_dataset = ind.ndvi?.dataset ?? null;
        if (Math.abs(s2 - hls) > ANCHORS.ndviSeriesGap) {
          gaps.push(`NDVI series disagree: Sentinel-2 ${s2} vs HLS ${hls}${pixelPending ? " (HLS from bare app point)" : ""}`);
          lowReasons.push("S2/HLS NDVI gap > 0.15");
        }
      }
      components.vegetation = { value: round1(100 * clamp01((ndvi - ANCHORS.ndviLow) / (ANCHORS.ndviHigh - ANCHORS.ndviLow))), weight: WEIGHTS.vegetation, inputs };
    } else gaps.push("NDVI missing");
  }

  // ── Soil (NON-NASA) ──────────────────────────────────────────────────────
  {
    const s = x.soil;
    if (s) {
      const sub = {};
      const clay = num(s.clay_pct), silt = num(s.silt_pct), soc = num(s.soc_g_kg), ph = num(s.ph_h2o);
      if (clay !== null && silt !== null) sub.texture = round1(100 * clamp01((clay + silt) / ANCHORS.textureFull));
      if (soc !== null) sub.soc = round1(100 * clamp01((soc - ANCHORS.socLow) / (ANCHORS.socHigh - ANCHORS.socLow)));
      if (ph !== null) sub.ph = round1(100 * Math.max(0, 1 - Math.abs(ph - ANCHORS.phIdeal) / ANCHORS.phSpan));
      const vals = Object.values(sub);
      if (vals.length) components.soil = { value: round1(mean(vals)), weight: WEIGHTS.soil, subScores: sub,
        inputs: { clay_pct: clay, silt_pct: silt, sand_pct: num(s.sand_pct), soc_g_kg: soc, ph_h2o: ph },
        source: "ISRIC SoilGrids 2.0 (NON-NASA)", note: "índice interno, no es un análisis de laboratorio" };
      else gaps.push("soil block has no usable fields");
    } else gaps.push("soil missing");
    if (components.soil) gaps.push("soil: SoilGrids 2.0 ML model, NON-NASA, uncertain in hyper-arid/irrigated valleys");
  }

  // ── Climate (v1 = frost only) ────────────────────────────────────────────
  {
    const f = x.frost;
    const clim = num(f?.clim_1991_2020_days_lt0);
    if (clim !== null) components.climate = { value: round1(100 * (1 - clamp01(clim / ANCHORS.frostDaysZero))), weight: WEIGHTS.climate,
      inputs: { frost_clim_days_lt0: clim, frost_clim_days_lt2: num(f.clim_1991_2020_days_lt2), this_month: f.this_month ?? null,
        preferred_series: f.preferred_series ?? null, heat: "TODO" }, note: "v1 scores frost only; heat not yet in evidence" };
    else gaps.push("frost missing");
    gaps.push("heat TODO");
  }

  // ── Erosion (relative proxy, NOT soil loss) ──────────────────────────────
  {
    const slope = num(x.slope?.window_mean_deg);
    const p95 = x.erosion?.proxy_tan_slope_x_p95_intensity ?? {};
    const pw = num(p95.power), e5 = num(p95.era5);
    const sub = {};
    if (slope !== null) sub.slope = round1(100 * (1 - clamp01(slope / ANCHORS.slopeSteepDeg)));
    let p = null, proxyMode = null;
    if (pw !== null && e5 !== null) {
      const hi = Math.max(pw, e5), lo = Math.min(pw, e5);
      if ((lo === 0 && hi > 0) || (lo > 0 && hi / lo > ANCHORS.proxyDivergence)) {
        p = hi; proxyMode = "higher-risk (POWER/ERA5 diverge > 2x)";
        gaps.push(`erosion proxy: POWER ${pw} vs ERA5 ${e5} diverge > 2x, higher-risk value used`);
        lowReasons.push("erosion POWER/ERA5 > 2x");
      } else { p = (pw + e5) / 2; proxyMode = "mean of POWER and ERA5"; }
    } else if (pw !== null || e5 !== null) { p = pw ?? e5; proxyMode = pw !== null ? "POWER only" : "ERA5 only"; }
    if (p !== null) sub.proxy = round1(100 * (1 - clamp01(p / ANCHORS.proxyHigh)));
    const vals = Object.values(sub);
    if (vals.length) components.erosion = { value: round1(mean(vals)), weight: WEIGHTS.erosion, subScores: sub,
      inputs: { slope_window_mean_deg: slope, p95_power: pw, p95_era5: e5, p95_used: p === null ? null : Number(p.toFixed(4)), proxy_mode: proxyMode },
      note: "unitless proxy, not soil loss" };
    else gaps.push("erosion inputs missing");
    if (x.erosion?.imerg_status) gaps.push("IMERG blocked; CHIRPS/POWER/ERA5 substitutes");
  }

  if (pixelPending) { gaps.push("fieldPixelStatus PENDING/PARTIAL"); lowReasons.push("field pixel pending"); }
  if (ev.engine?.confidence === "low") lowReasons.push("engine confidence low");

  // ── Combine ──────────────────────────────────────────────────────────────
  const used = Object.entries(components);
  const wSum = used.reduce((a, [, c]) => a + c.weight, 0);
  const raw = wSum > 0 ? used.reduce((a, [, c]) => a + c.weight * c.value, 0) / wSum : null;
  const weightsUsed = Object.fromEntries(used.map(([k, c]) => [k, Number((c.weight / wSum).toFixed(4))]));

  return {
    formulaVersion: FORMULA_VERSION,
    farmKey: ev.farmKey,
    period: ev.period,
    score: raw === null ? null : roundInt(raw),
    scoreUnrounded: raw === null ? null : Number(fix(raw).toFixed(4)),
    confidence: lowReasons.length ? "low" : "medium", // medium is the ceiling for v1
    confidenceReasons: [...new Set(lowReasons)],
    components,
    weightsUsed,
    gaps: [...new Set(gaps)],
    disclaimer: "Decision-support index (draft anchors). Not a credit rating, insurance score, soil-loss or yield prediction. Supports, does not replace, farmer judgment.",
  };
}
