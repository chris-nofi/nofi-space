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
import { fileURLToPath } from "node:url";
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

// ── 2. shared score function (same file the API uses) ───────────────────────
cpSync(join(X402, "field-score.mjs"), join(DIST, "assets", "field-score.mjs"));

// ── 3. evidence + index ─────────────────────────────────────────────────────
const evidenceFiles = readdirSync(EVID).filter(f => f.endsWith(".json")).sort();
const farmsIdx = {};
const bundle = {};
for (const f of evidenceFiles) {
  const ev = readJSON(join(EVID, f));
  if (/PLACEHOLDER/i.test(ev._note ?? "")) continue;
  cpSync(join(EVID, f), join(DIST, "data", "evidence", f));
  const id = ev.farmKey.split(":").pop();
  (farmsIdx[id] ??= { id, farmKey: ev.farmKey, farmId: keccak256(toHex(ev.farmKey)), periods: [] })
    .periods.push({ period: ev.period, file: `/data/evidence/${f}`, dataHash: sha(canon(ev)) });
  bundle[f] = ev;
}
for (const f of Object.values(farmsIdx)) { f.periods.sort((a, b) => a.period - b.period); f.latest = f.periods.at(-1).period; }
const attestations = existsSync(join(WEB, "attestations.json")) ? readJSON(join(WEB, "attestations.json")) : { records: {} };
writeJSON(join(DIST, "data", "index.json"), {
  generated: new Date().toISOString(),
  verifySelector: toFunctionSelector("verify(bytes32,uint32,bytes32)"),
  farms: farmsIdx,
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
    for (const s of list) if (rec[map[s.id]]) { s.water = rec[map[s.id]].m3_ha_yr; s.pctVsCurrent = rec[map[s.id]].pct_vs_current; s.monthly = rec[map[s.id]].monthly; }
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
    ndviS2: r.cover.s2_median_ndvi_by_month_2024_2026, obsS2: r.cover.s2_obs_by_month, bareThreshold: r.cover.bare_threshold_ndvi,
    bareMonths: r.cover.bare_months, vulnerableMonths: r.cover.vulnerable_months,
    frostLt2: frost.clim_1991_2020_days_lt2_by_month ?? null, frostLt0: frost.clim_1991_2020_days_lt0_by_month ?? null, frostSeries: pref,
    source: "ESA Sentinel-2 L2A monthly median NDVI 2024–2026 (field pixel) · frost: 1991–2020 climatology, preferred series per farm",
  };
}
writeJSON(join(DIST, "data", "season.json"), season);

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

// ── 8. legacy dashboard (full analysis + CERES voice) under /legacy/ ────────
const LDIST = join(DIST, "legacy");
cpSync(LEGACY, LDIST, { recursive: true, filter: (p) => !/(_redirects|_headers|oracle|README\.txt|SETUP-RETELL\.md|LANDING-INTEGRATION\.md|[\/]tests)$/.test(p) });
if (existsSync(join(LEGACY, "dashboard.html"))) {
  // PR #1 layout: its dashboard uses root-absolute asset paths; serve it as /legacy/ with paths rewritten.
  cpSync(join(LDIST, "index.html"), join(LDIST, "landing-v1.html"));
  const html = readFileSync(join(LEGACY, "dashboard.html"), "utf8").replace(/(src|href)="\/(?!\/|legacy\/)/g, '$1="/legacy/');
  write(join(LDIST, "index.html"), html);
}
// Keep the legacy dashboard on the SAME evidence and NASA bundle as the new site (no stale copies).
if (existsSync(join(LDIST, "evidence"))) for (const f of evidenceFiles) cpSync(join(EVID, f), join(LDIST, "evidence", f));
if (existsSync(join(LDIST, "ceres-nasa-data.js")) && existsSync(join(SA, "data", "out", "ceres-nasa-data.js"))) cpSync(join(SA, "data", "out", "ceres-nasa-data.js"), join(LDIST, "ceres-nasa-data.js"));

// ── 9. judge page + record page from the avalanche package ──────────────────
cpSync(join(X402, "web", "pagar.html"), join(DIST, "pagar", "index.html"));

// ── 10. oracle function bundle (x402 modules + evidence inlined; no fs at runtime) ──
rmSync(FN_LIB, { recursive: true, force: true });
mkdirSync(FN_LIB, { recursive: true });
for (const f of ["config.mjs", "earth-data.mjs", "facilitator.mjs", "field-score.mjs", "server.mjs"]) cpSync(join(X402, f), join(FN_LIB, f));
write(join(FN_LIB, "evidence-bundle.mjs"),
  `// generated by ceres-web/scripts/build.mjs from space-apps-2026/avalanche/oracle/evidence — do not edit\n` +
  `const B = ${JSON.stringify(bundle)};\n` +
  `export function evidenceMap() {\n  const m = new Map();\n  for (const [file, ev] of Object.entries(B)) m.set(\`\${ev.farmKey.split(":").pop()}/\${ev.period}\`, { file: "oracle/evidence/" + file, ev });\n  return m;\n}\n`);

// ── 11. Netlify Drop compatibility: _redirects/_headers inside the publish dir (netlify.toml covers CLI/Git deploys) ──
write(join(DIST, "_redirects"), "/verify/*  /verify/index.html  200\n");
write(join(DIST, "_headers"), "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/assets/*.mjs\n  Content-Type: text/javascript; charset=utf-8\n");

const summary = { pages: ["/", "/app/", "/pagar/", "/api-docs/", "/verify/", "/legacy/"], evidence: evidenceFiles.length, mapsKey: cfg.googleMapsApiKey ? "set" : "MISSING (map shows fallback)", mapId: cfg.googleMapId || "(none: DEMO_MAP_ID used)", registry: cfg.registry || "(none yet)" };
console.log(JSON.stringify(summary, null, 2));
