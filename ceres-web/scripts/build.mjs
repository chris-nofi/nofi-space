// Builds ceres-web/dist (the Netlify publish dir) and the oracle function bundle.
//   node scripts/build.mjs
// Inputs (all relative to the repo root that holds ceres-web/, space-apps-2026/ and ceres-ai/):
//   space-apps-2026/avalanche/oracle/evidence/*.json   real farm-month evidence (what the score + API use)
//   space-apps-2026/avalanche/x402/*.mjs                oracle, facilitator, field-score.v1
//   space-apps-2026/data/out/ceres-site-data.json       reconciled El Algarrobal water figures (W8)
//   space-apps-2026/data/out/risk_extensions.json       season strip (monthly S2 NDVI, frost by month)
//   ceres-ai/app.js (DB)                                strategy texts (why / evidence / gaps / risks), ES + EN
//   ceres-web/attestations.json                         anchored records (tx hashes) — fill after each attest
// Config (env, else ceres-web/.env.local, else space-apps-2026/.secrets/google-maps.env):
//   GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID, WATERPROOF_REGISTRY, X402_PAY_TO
// The Maps key ends up in dist/assets/config.js because it is a browser key (public by design, referrer-restricted).
// It is never written into src/ or any committed file.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { keccak256, toHex, toFunctionSelector } from "viem";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(WEB, "..");
// Two supported layouts: the hackathon bundle (ROOT/space-apps-2026/{avalanche,data} + ROOT/ceres-ai) and the
// chris-nofi/nofi-space repo (ROOT/{avalanche,data} + the old dashboard in ROOT/site, PR #1).
const SA = existsSync(join(ROOT, "space-apps-2026", "avalanche")) ? join(ROOT, "space-apps-2026") : ROOT;
const hasDB = (d) => existsSync(join(d, "app.js")) && /^const DB = \{/m.test(readFileSync(join(d, "app.js"), "utf8"));
const LEGACY = [join(ROOT, "ceres-ai"), join(ROOT, "site")].find(hasDB);
if (!LEGACY) throw new Error("legacy dashboard with `const DB = {` not found in ceres-ai/ or site/");
const X402 = join(SA, "avalanche", "x402");
const EVID = join(SA, "avalanche", "oracle", "evidence");
const DIST = join(WEB, "dist");
const FN_LIB = join(WEB, "netlify", "functions", "_x402");

const readJSON = (p) => JSON.parse(readFileSync(p, "utf8"));
const write = (p, s) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, s); };
const writeJSON = (p, o) => write(p, JSON.stringify(o));

// ── env ──────────────────────────────────────────────────────────────────────
function parseEnvFile(p) {
  if (!existsSync(p)) return {};
  return Object.fromEntries(readFileSync(p, "utf8").split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
}
const env = { ...parseEnvFile(join(SA, ".secrets", "google-maps.env")), ...parseEnvFile(join(WEB, ".env.local")), ...process.env };

// ── canonical hash (same as oracle/build-attestation.mjs and x402/earth-data.mjs) ──
const canon = (v) => Array.isArray(v) ? `[${v.map(canon).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`
  : JSON.stringify(v);
const sha = (s) => "0x" + createHash("sha256").update(s).digest("hex");

// ── 1. static pages ─────────────────────────────────────────────────────────
rmSync(DIST, { recursive: true, force: true });
cpSync(join(WEB, "src"), DIST, { recursive: true });

// ── 2. score engine: runs HERE (build) and in the paid API. The browser receives precomputed public summaries,
//       never raw evidence. (field-score.mjs is open source in the repo; the formula is not a secret, the packaged
//       evidence delivery is what x402 sells.)
const { fieldScore } = await import(pathToFileURL(join(X402, "field-score.mjs")).href);

// ── 3. evidence (server-only) → public summaries (allowlist) + index ─────────
// Evidence source: CERES_EVIDENCE_DIR (e.g. a private checkout outside this public repo) or the repo default.
// NOTE: the default records in avalanche/oracle/evidence are ALREADY PUBLIC in Git history and past deploys; they serve
// as the demo/CI dataset. New commercial records belong in a private store (docs/13b_PUBLIC_PAID_DATA_BOUNDARY.md).
const EVID_SRC = env.CERES_EVIDENCE_DIR ? env.CERES_EVIDENCE_DIR : EVID;
if (!existsSync(EVID_SRC)) throw new Error(`evidence source not found: ${EVID_SRC} (set CERES_EVIDENCE_DIR)`);
const evidenceFiles = readdirSync(EVID_SRC).filter(f => f.endsWith(".json")).sort();
const farmsIdx = {};
const bundle = {};
for (const f of evidenceFiles) {
  const ev = readJSON(join(EVID_SRC, f));
  if (/PLACEHOLDER/i.test(ev._note ?? "")) continue;
  const id = ev.farmKey.split(":").pop();
  (farmsIdx[id] ??= { id, farmKey: ev.farmKey, farmId: keccak256(toHex(ev.farmKey)), periods: [] })
    .periods.push({ period: ev.period, dataHash: sha(canon(ev)) }); // hash of the UNMODIFIED record (on-chain preimage)
  bundle[f] = ev;
}
if (!Object.keys(bundle).length) throw new Error(`no non-placeholder evidence in ${EVID_SRC}; refusing to build a site with invented numbers`);
for (const f of Object.values(farmsIdx)) { f.periods.sort((a, b) => a.period - b.period); f.latest = f.periods.at(-1).period; }
const attestations = existsSync(join(WEB, "attestations.json")) ? readJSON(join(WEB, "attestations.json")) : { records: {} };

/** Dataset labels for the source chips (names + resolution only: no granules, pixels, items or methods). */
function sourceChips(ev) {
  const i = ev.indicators ?? {}, x = ev.extensions ?? {}, c = ev._context ?? {}, out = [];
  const add = (name, detail) => { if (name) out.push({ name, detail: detail ?? null }); };
  add(i.et_mm?.dataset, i.et_mm?.scale);
  add(i.et0_mm?.dataset?.replace(" (FAO-56 Penman-Monteith)", ""), "FAO-56");
  add(i.ndvi?.dataset, "30 m");
  if (x.cover) add("Sentinel-2 L2A (ESA)", "10 m");
  if (c.soilMoisture) add(c.soilMoisture.dataset, c.soilMoisture.scale?.split(" ")[0]);
  add(i.precip_mm?.dataset, i.precip_mm?.scale);
  if (x.slope) add("SRTM GL1", "30 m");
  if (x.soil) add("SoilGrids 2.0 (NON-NASA)", "250 m");
  return out;
}

/** ceres-public-summary.v1: an explicit ALLOWLIST built from the score output. Never a redacted copy of the record. */
function publicSummary(ev, farm, period) {
  const s = fieldScore(ev);
  const components = {};
  for (const [k, c] of Object.entries(s.components)) components[k] = { value: c.value }; // display value only; inputs/weights/subScores are paid
  const att = attestations.records?.[`${farm.id}/${ev.period}`];
  return {
    schemaVersion: "ceres-public-summary.v1",
    farm: farm.id, farmId: farm.farmId, period: ev.period,
    score: s.score, confidence: s.confidence, formulaVersion: s.formulaVersion,
    components,
    missingComponents: ["water", "vegetation", "soil", "climate", "erosion"].filter(k => !s.components[k]),
    confidenceReasons: s.confidenceReasons, // caveats stay public: scientific honesty, not a premium feature
    gaps: s.gaps,
    sources: sourceChips(ev),
    disclaimer: s.disclaimer,
    dataHash: period.dataHash,
    onChain: att?.tx ? { registry: env.WATERPROOF_REGISTRY ?? attestations.registry ?? null, tx: att.tx, block: att.block ?? null } : null,
  };
}
const summaries = {};
for (const ev of Object.values(bundle)) {
  const farm = farmsIdx[ev.farmKey.split(":").pop()];
  summaries[`${farm.id}/${ev.period}`] = publicSummary(ev, farm, farm.periods.find(p => p.period === ev.period));
}
writeJSON(join(DIST, "data", "public", "summaries.json"), { schemaVersion: "ceres-public-summary.v1", generated: new Date().toISOString(), items: summaries });
writeJSON(join(DIST, "data", "index.json"), {
  schemaVersion: "ceres-public-index.v1",
  generated: new Date().toISOString(),
  verifySelector: toFunctionSelector("verify(bytes32,uint32,bytes32)"),
  farms: farmsIdx,              // id, farmKey, farmId, latest, periods[{period, dataHash}] (no file links)
  summaries: "/data/public/summaries.json",
  attestations: attestations.records ?? {},
});

// ── 4. farms (positions, labels) ────────────────────────────────────────────
const appSrc = readFileSync(join(LEGACY, "app.js"), "utf8");
const DB = vm.runInNewContext("(" + appSrc.match(/^const DB = (\{[\s\S]*?\n\});/m)[1] + ")");
const dbFarm = Object.fromEntries(DB.FARMS.map(f => [f.id, f]));
const latestEv = (id) => bundle[`${id}-${farmsIdx[id].latest}.json`];
const PLACE = {
  algarrobal: { es: "El Algarrobal · costa de Ilo", en: "El Algarrobal · Ilo coast" },
  carumas: { es: "Carumas · zona alta", en: "Carumas · highlands" },
  samegua: { es: "Samegua · valle de Moquegua", en: "Samegua · Moquegua valley" },
};
const farms = ["algarrobal", "carumas", "samegua"].map(id => {
  const d = dbFarm[id], ev = latestEv(id), fp = ev?._context?.fieldPixel;
  const farm = {
    id, farmKey: farmsIdx[id].farmKey, label: { es: d.name, en: d.name }, place: PLACE[id], crop: d.crop, zone: d.zone,
    ha: d.ha, elevation_m: d.elevation, waterSource: d.waterSource,
    appPoint: { lat: d.lat, lon: d.lon },
    // Cultivation pixel = the map marker. Only where evidence names one; Carumas stays on its app point.
    marker: fp ? { lat: fp.lat, lon: fp.lon, kind: "field_pixel", basis: fp.basis } : { lat: d.lat, lon: d.lon, kind: "app_point" },
    fieldPixelStatus: ev?.extensions?.fieldPixelStatus ?? null,
  };
  if (id === "carumas") farm.candidate = { lat: -16.80991, lon: -70.69032, ndvi: 0.509, date: "2026-11-04",
    basis: "nearest green HLS 30 m candidate (data/out/green_pixel_candidates.json); not confirmed with the farmer" };
  return farm;
});
writeJSON(join(DIST, "data", "farms.json"), { farms, facts: DB.REGION_FACTS ?? [] });

// ── 5. strategies (texts from the dashboard DB; El Algarrobal water from the reconciled W8 method) ──
const site = readJSON(join(SA, "data", "out", "ceres-site-data.json"));
const rec = site.farms.algarrobal.strategies_recomputed;
const strategies = {};
for (const id of ["algarrobal", "carumas", "samegua"]) {
  const d = dbFarm[id], ev = latestEv(id);
  const list = d.strategies.map(s => ({
    id: s.id, current: Boolean(s.current), name: s.name, mainRisk: s.mainRisk, why: s.why, evidence: s.evidence, gaps: s.gaps, risks: s.risks,
    water: s.water, soil: s.soil, income: s.income,
  }));
  let unit = d.mode === "m3" ? "m3_ha_yr" : "index", waterSource = "example data (dashboard engine, not yet reconciled with NASA evidence)";
  let engine = null;
  if (id === "algarrobal") {
    const map = { current: "current", deficit: "deficit", cover: "cover", drip: "drip" };
    for (const s of list) if (rec[map[s.id]]) { s.water = rec[map[s.id]].m3_ha_yr; s.pctVsCurrent = rec[map[s.id]].pct_vs_current; } // monthly series not published (unused by the UI)
    unit = "m3_ha_yr";
    waterSource = "Modeled from NASA POWER 2001–2025 + FAO-56 (olive Kc, irrigation efficiencies), not metered. P10–P90 for drip + strip cover: 12,510–13,170 m³/ha/yr.";
    engine = { pick: "drip", label: ev.engine.recommendedStrategy, confidence: ev.engine.confidence, basis: ev.engine.recommendationBasis };
  } else {
    engine = { pick: d.strategies.find(s => s.recommended)?.id ?? null, label: ev.engine.recommendedStrategy, confidence: ev.engine.confidence, basis: ev.engine.recommendationBasis ?? null };
  }
  strategies[id] = { unit, waterSource, defaultPriorities: ev.engine.priorities, engine, list };
}
writeJSON(join(DIST, "data", "strategies.json"), strategies);

// ── 6. season strip ─────────────────────────────────────────────────────────
const risk = readJSON(join(SA, "data", "out", "risk_extensions.json"));
const season = {};
for (const id of ["algarrobal", "carumas", "samegua"]) {
  const r = risk.farms[id], pref = latestEv(id)?.extensions?.frost?.preferred_series ?? "power";
  const frost = r.frost?.[pref] ?? r.frost?.power ?? {};
  season[id] = {
    ndviS2: r.cover.s2_median_ndvi_by_month_2024_2026, bareThreshold: r.cover.bare_threshold_ndvi, // public season context (12 monthly medians)
    bareMonths: r.cover.bare_months, vulnerableMonths: r.cover.vulnerable_months,
    frostLt2: frost.clim_1991_2020_days_lt2_by_month ?? null, frostLt0: frost.clim_1991_2020_days_lt0_by_month ?? null, frostSeries: pref,
    source: "ESA Sentinel-2 L2A monthly median NDVI 2024–2026 (field pixel) · frost: 1991–2020 climatology, preferred series per farm",
  };
}
writeJSON(join(DIST, "data", "season.json"), season);

// ── 6b. 1981–2025 backtest (Kepler, data/out/backtest_1981_2025.json) → public ALLOWLIST summary ─────────────────
// Model-based hindcast on NASA POWER daily, not observed yields. If the file is missing the panel is simply not shown:
// no counts are ever invented here.
const BT_SRC = join(SA, "data", "out", "backtest_1981_2025.json");
let backtest = null;
if (existsSync(BT_SRC)) {
  const bt = readJSON(BT_SRC);
  // Spanish versions of the named-year stories, used only while the English source text is unchanged.
  const STORY_ES = {
    el_nino_2023_24: ["Model-based hindcast, not observed yields. Carumas: POWER Nov 2023", "Retrosimulación con modelo, no rendimientos observados. Carumas: la lluvia POWER de nov. 2023 a mar. 2024 fue casi normal (WRSI de la papa 101.4 % de su mediana 1991–2020), así que ninguna rotación muestra falla por agua ni por helada. Valles con riego: el indicador de oferta de agua bajó a 0.58 (Samegua, memoria de 2 campañas) y 0.69 (El Algarrobal) de lo normal. Samegua: la alfalfa continua (hoy) baja a WRSI 67.3 frente a 78.0 de la rotación alfalfa → maíz chala → arveja de CERES. El Algarrobal: el riego por gravedad con suelo desnudo llega a WRSI 82.0 frente a 100.0 del goteo con cobertura en franjas, con la misma dotación del canal. Ninguna estrategia falla del todo en 2024; las recomendadas mantienen cubierta más demanda de agua del cultivo."],
    el_nino_1982_83: ["Model-based hindcast. Nov 1982", "Retrosimulación con modelo. La lluvia POWER de nov. 1982 a mar. 1983 en la celda altoandina fue la más baja del registro: el WRSI de la papa cayó a 38.8 % de lo normal (falla por agua) y todas las rotaciones de Carumas fallaron por agua. El indicador de oferta de El Algarrobal cayó a 0.10 de lo normal: todas las estrategias del olivo fallan (actual WRSI 23.4, goteo 26.7). Hay sequías que ninguna rotación resuelve; ahí el papel de CERES es la alerta temprana y el ahorro de agua que estira el reservorio, no una garantía."],
    el_nino_2015_16: ["Model-based hindcast. The 2016 supply proxy", "Retrosimulación con modelo. En 2016 el indicador de oferta de El Algarrobal fue 0.72 de lo normal. Gravedad con suelo desnudo baja a WRSI 80.0 (borde de la banda de estrés), cobertura 72.3, goteo con cobertura en franjas 98.5. El modelo marca estrés, no falla total, así que SUBESTIMA las pérdidas de olivo reportadas (>50 %): la sequía de fines de 2016 (set.–dic.) cae fuera de la ventana de oferta ene.–mar. que usamos. Lo reportamos como limitación."],
  };
  const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
  const farmsBT = {};
  for (const [fid, f] of Object.entries(bt.farms ?? {})) {
    const strategiesBT = {};
    for (const [sid, s] of Object.entries(f.strategies ?? {})) {
      strategiesBT[sid] = {
        name: s.name, current: !!s.current, recommended: !!s.recommended,
        seasons: s.seasons_tested, first: s.first_season, last: s.last_season,
        failAny: s.seasons_with_any_failure, failWater: s.seasons_water_failure, failFrost: s.seasons_frost_failure,
        stress: s.stress_seasons_wrsi_lt80 ?? null, worstSeason: s.worst_season ?? null, worstWrsi: r1(s.worst_wrsi),
        enso: Object.fromEntries(Object.entries(s.enso ?? {}).map(([k, v]) => [k, { n: v.n, fail: v.seasons_with_failure, medianWrsi: r1(v.median_wrsi) }])),
        tests: { fisherP: s.tests?.fisher_p_two_sided ?? null, mannWhitneyP: s.tests?.mannwhitney_wrsi_el_nino_vs_other?.p ?? null, kruskalP: s.tests?.kruskal_wrsi_3phase?.p ?? null },
        // compact season strip: [label, WRSI, failed 0/1, ENSO phase n|o|l]
        strip: (s.seasons ?? []).map(x => [x.s, r1(x.wrsi), x.fail ? 1 : 0, x.enso === "el_nino" ? "n" : x.enso === "la_nina" ? "l" : "o"]),
      };
    }
    const raw = bt.sensitivity?.raw_power_tmin_no_lapse?.[fid] ?? null;
    farmsBT[fid] = { metric: /anomaly/i.test(f.failure_metric ?? "") ? "wrsi_anomaly" : "wrsi_abs", strategies: strategiesBT,
      rawTminFrost: raw ? Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, { seasons: v.seasons, frost: v.frost }])) : null };
  }
  backtest = {
    schemaVersion: "ceres-public-backtest.v1",
    label: { en: bt.meta?.label ?? "MODEL-BASED HINDCAST, NOT OBSERVED YIELDS", es: bt.meta?.label_es ?? "RETROSIMULACIÓN CON MODELO, NO RENDIMIENTOS OBSERVADOS" },
    source: "NASA POWER Daily (AG), 1981–2025", generated: bt.meta?.generated ?? null,
    seasonsNote: {
      en: "Seasons are labelled by harvest year. Crops whose season crosses New Year (Oct–Apr, e.g. potato Nov–Mar) have up to 44 complete seasons (1981/82–2024/25); calendar-year crops have 45 (1981–2025). 2025/26 is incomplete and not counted. No season is padded.",
      es: "Las temporadas se nombran por el año de cosecha. Los cultivos que cruzan el Año Nuevo (oct.–abr., p. ej. papa nov.–mar.) tienen hasta 44 temporadas completas (1981/82–2024/25); los de año calendario, 45 (1981–2025). 2025/26 está incompleta y no se cuenta. No se rellena ninguna temporada.",
    },
    method: {
      en: "Daily FAO-56 crop water balance (WRSI; failure < 50, stress < 80) and FAO frost thresholds, driven by NASA POWER only. Carumas uses the WRSI anomaly (POWER rain is dry-biased there); irrigated farms compare modelled canal supply with crop demand (supply index is a proxy, not canal records). Validated against GPM IMERG Final monthly (333 months), SMAP and ERA5.",
      es: "Balance hídrico diario FAO-56 (WRSI; falla < 50, estrés < 80) y umbrales de helada FAO, solo con NASA POWER. En Carumas se usa la anomalía de WRSI (la lluvia POWER es seca allí); en las chacras con riego se compara la oferta modelada del canal con la demanda del cultivo (el índice de oferta es un indicador, no registros del canal). Validado con GPM IMERG Final mensual (333 meses), SMAP y ERA5.",
    },
    farms: farmsBT,
    namedYears: (bt.named_years ?? []).map(n => ({ id: n.id, title: n.title,
      text: { en: n.text, es: STORY_ES[n.id] && String(n.text).startsWith(STORY_ES[n.id][0]) ? STORY_ES[n.id][1] : n.text } })),
  };
  writeJSON(join(DIST, "data", "public", "backtest.json"), backtest);
}

// ── 7. public runtime config ────────────────────────────────────────────────
const cfg = {
  googleMapsApiKey: env.GOOGLE_MAPS_API_KEY ?? "",
  googleMapId: env.GOOGLE_MAPS_MAP_ID ?? "",
  chainId: 43113,
  chainName: "Avalanche Fuji C-Chain",
  rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
  explorer: "https://testnet.snowtrace.io",
  usdc: "0x5425890298aed601595a70AB815c96711a31Bc65",
  registry: env.WATERPROOF_REGISTRY ?? attestations.registry ?? "",
  oracleBase: env.ORACLE_BASE ?? "", // "" = same origin (Netlify Function)
  retellPublicKey: "", retellAgentId: "",
};
write(join(DIST, "assets", "config.js"), `/* generated by scripts/build.mjs — public settings only */\nwindow.CERES_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`);

// ── 8. legacy dashboard (CERES voice summary + older analysis) under /legacy/, SANITIZED ─────
// Published: the dashboard UI and its derived climatology/model outputs. NOT published: the canonical evidence
// directory, the archived landing-v1 / old api-docs / old verify pages, and any provenance identifiers (granules,
// Sentinel-2 items, HLS scenes) or evidence file links embedded in its data bundles.
const LDIST = join(DIST, "legacy");
const LEGACY_EXCLUDE = /[\/](_redirects|_headers|oracle|README\.txt|SETUP-RETELL\.md|LANDING-INTEGRATION\.md|tests|evidence|index\.html|landing\.js|landing\.css|api-docs\.html|verify\.html)$/;
cpSync(LEGACY, LDIST, { recursive: true, filter: (p) => !LEGACY_EXCLUDE.test(p) });
if (existsSync(join(LEGACY, "dashboard.html"))) {
  // PR #1 layout: its dashboard uses root-absolute asset paths; serve it as /legacy/ with paths rewritten.
  const html = readFileSync(join(LEGACY, "dashboard.html"), "utf8").replace(/(src|href)="\/(?!\/|legacy\/)/g, '$1="/legacy/');
  write(join(LDIST, "index.html"), html);
  rmSync(join(LDIST, "dashboard.html"), { force: true });
}
// Official brand pack, also under /legacy/brand/ (legacy HTML paths are rewritten to /legacy/…).
cpSync(join(WEB, "src", "assets", "brand"), join(LDIST, "brand"), { recursive: true });
if (existsSync(join(SA, "data", "out", "ceres-nasa-data.js"))) cpSync(join(SA, "data", "out", "ceres-nasa-data.js"), join(LDIST, "ceres-nasa-data.js"));
const DROP_KEYS = new Set(["granules", "items", "scene", "evidence_files"]);
const IND_KEEP = new Set(["value", "dataset", "scale", "reason", "substituteFor", "stat"]);
function sanitizeLegacy(v, key) {
  if (Array.isArray(v)) return v.map(x => sanitizeLegacy(x));
  if (!v || typeof v !== "object") return (key === "file" && typeof v === "string" && /evidence\//.test(v)) ? undefined : v;
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    if (DROP_KEYS.has(k)) continue;
    if (k === "indicators" && x && typeof x === "object") {
      out[k] = Object.fromEntries(Object.entries(x).map(([ik, iv]) => [ik, iv && typeof iv === "object" ? Object.fromEntries(Object.entries(iv).filter(([kk]) => IND_KEEP.has(kk))) : iv]));
      continue;
    }
    const y = sanitizeLegacy(x, k);
    if (y !== undefined) out[k] = y;
  }
  return out;
}
for (const f of ["si-data.js", "ceres-nasa-data.js"]) {
  const p = join(LDIST, f);
  if (!existsSync(p)) continue;
  const src = readFileSync(p, "utf8"), w = {};
  vm.runInNewContext(src, { window: w });
  const header = src.match(/^\/\*[\s\S]*?\*\//)?.[0] ?? "";
  write(p, `${header}\n/* Sanitized for the public site by ceres-web/scripts/build.mjs: provenance IDs and evidence file links removed. Complete evidence: x402 Evidence API. */\n` +
    Object.entries(w).map(([k, v]) => `window.${k} = ${JSON.stringify(sanitizeLegacy(v))};`).join("\n") + "\n");
}
// The legacy "download evidence (JSON)" link becomes a pointer to the paid Evidence API.
{
  const p = join(LDIST, "app.js"); let js = readFileSync(p, "utf8");
  const dl = `<a class="ev-dl" href="/\${E(x.latestEvidence?.file||'')}" download>\${t('Descargar evidencia (JSON)','Download evidence (JSON)')}</a>`;
  if (js.includes(dl)) js = js.replace(dl, `<a class="ev-dl" href="/api-docs/#evidence">\${t('Evidencia completa: API x402 (pago por consulta)','Complete evidence: x402 API (pay per request)')}</a>`);
  else console.warn("legacy app.js: evidence download link not found (already changed?)");
  write(p, js);
}

// ── 9. judge page + record page from the avalanche package ──────────────────
cpSync(join(X402, "web", "pagar.html"), join(DIST, "pagar", "index.html"));

// ── 10. oracle function bundle (x402 modules + evidence inlined; no fs at runtime) ──
rmSync(FN_LIB, { recursive: true, force: true });
mkdirSync(FN_LIB, { recursive: true });
for (const f of ["config.mjs", "earth-data.mjs", "facilitator.mjs", "field-score.mjs", "server.mjs"]) cpSync(join(X402, f), join(FN_LIB, f));
write(join(FN_LIB, "evidence-bundle.mjs"),
  `// generated by ceres-web/scripts/build.mjs — SERVER-ONLY demo packaging for the Netlify Function (never copied to dist/). Do not edit.\n` +
  `const B = ${JSON.stringify(bundle)};\n` +
  `export function evidenceMap() {\n  const m = new Map();\n  for (const [file, ev] of Object.entries(B)) m.set(\`\${ev.farmKey.split(":").pop()}/\${ev.period}\`, { file: "oracle/evidence/" + file, ev });\n  return m;\n}\n`);

// ── 10b. CERES chat grounding data (server-only module; built from PUBLIC data only: summaries, strategy model,
//         sanitized SI analysis and climate context, season strip, knowledge pack). Never includes canonical evidence.
{
  const w = {};
  vm.runInNewContext(readFileSync(join(LDIST, "si-data.js"), "utf8"), { window: w });
  const KNOW = join(SA, "oracle", "earth_oracle", "ceres", "knowledge");
  const knowledge = existsSync(KNOW) ? readdirSync(KNOW).filter(f => f.endsWith(".md")).sort()
    .map(f => `<documento nombre="${f.replace(/\.md$/, "")}">\n${readFileSync(join(KNOW, f), "utf8").trim()}\n</documento>`).join("\n\n") : "";
  const ceresData = { index: { farms: farmsIdx }, summaries, farms, strategies, season, backtest, si: w.AGUA_SI_FIXTURES ?? {}, climate: w.AGUA_SI_CLIMATE ?? {}, knowledge };
  const fp = (await import(pathToFileURL(join(WEB, "scripts", "audit-public.mjs")).href)).fingerprintsOf(Object.values(bundle));
  const blob = JSON.stringify(ceresData);
  for (const id of fp) if (blob.includes(id)) throw new Error(`ceres chat data would expose provenance id ${id}`);
  write(join(FN_LIB, "ceres-data.mjs"), `// generated by ceres-web/scripts/build.mjs — server-only, public-derived grounding for the CERES chat. Do not edit.\nconst D = ${blob};\nexport function ceresData() { return D; }\n`);
}
// Legacy widget config: chat goes to the same-origin function; explorer + registry are the Fuji ones.
{
  const p = join(LDIST, "config.js"); let c = readFileSync(p, "utf8");
  c = c.replace(/oracleUrl:\s*"",/, 'oracleUrl: (typeof location !== "undefined" ? location.origin : ""),')
       .replace(/explorerUrl:\s*"[^"]*",/, 'explorerUrl: "https://testnet.snowtrace.io",')
       .replace(/registryAddress:\s*"",/, `registryAddress: ${JSON.stringify(env.WATERPROOF_REGISTRY ?? attestations.registry ?? "")},`)
       .replace(/x402PayUrl:\s*"",/, 'x402PayUrl: "/pagar/",');
  write(p, c);
}

// ── 11. routing + caching. Old raw-evidence URLs answer 410 with an explanation page (never a 200 with data). ──
const GONE = ["/data/evidence/*", "/legacy/evidence/*", "/evidence/*", "/legacy/landing-v1.html", "/assets/field-score.mjs"];
write(join(DIST, "_redirects"), "/verify/*  /verify/index.html  200\n" + GONE.map(g => `${g}  /evidence-moved/  410!`).join("\n") + "\n");
write(join(DIST, "_headers"), "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/data/public/*\n  Cache-Control: public, max-age=300\n/evidence-moved/*\n  Cache-Control: no-store\n");

// ── 12. build guard: fail closed if any protected evidence reaches the publish dir ──
const { auditDist } = await import(pathToFileURL(join(WEB, "scripts", "audit-public.mjs")).href);
const audit = auditDist(DIST, Object.values(bundle), { secrets: [env.FACILITATOR_PRIVATE_KEY].filter(Boolean) });
mkdirSync(join(WEB, ".audit"), { recursive: true });
writeFileSync(join(WEB, ".audit", "public-audit.json"), JSON.stringify(audit, null, 2));
if (!audit.ok) {
  console.error("PUBLIC LEAK AUDIT FAILED:\n" + audit.failures.map(f => `  ${f.rule}  ${f.file}  ${f.detail}`).join("\n"));
  rmSync(DIST, { recursive: true, force: true });
  process.exit(1);
}

const summary = { pages: ["/", "/app/", "/pagar/", "/api-docs/", "/verify/", "/legacy/"], evidence: `${Object.keys(bundle).length} records (server-only)`, publicSummaries: Object.keys(summaries).length, leakAudit: `pass (${audit.filesScanned} files, ${audit.fingerprints} provenance fingerprints)`, mapsKey: cfg.googleMapsApiKey ? "set" : "MISSING (map shows fallback)", mapId: cfg.googleMapId || "(none: DEMO_MAP_ID used)", registry: cfg.registry || "(none yet)" };
console.log(JSON.stringify(summary, null, 2));
