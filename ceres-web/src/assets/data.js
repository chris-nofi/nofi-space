// Data layer shared by the landing page and /app. Every number on the site comes from these PUBLIC files:
//   /data/index.json             farm-months, dataHash per month (public verification handle), anchored records
//   /data/public/summaries.json  ceres-public-summary.v1: score, confidence, component display values, caveats,
//                                dataset labels. Precomputed at build time from the canonical evidence.
//   /data/farms.json             positions (cultivation pixel vs app point), labels
//   /data/strategies.json        rotation / management options (texts + water figures + sources)
//   /data/season.json            12-month cover + frost strip
// The complete canonical evidence (the bytes behind each dataHash) is NOT served statically: it is sold by the
// x402 Evidence API (/v1/field/:id/evidence). The browser never needs it to render the free dashboard.

const cache = new Map();
const getJSON = (url) => {
  if (!cache.has(url)) cache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); }));
  return cache.get(url);
};

export async function loadSite() {
  const [index, farms, strategies, season] = await Promise.all([
    getJSON("/data/index.json"), getJSON("/data/farms.json"), getJSON("/data/strategies.json"), getJSON("/data/season.json"),
  ]);
  const summaries = await getJSON(index.summaries ?? "/data/public/summaries.json");
  return { index, summaries: summaries.items ?? {}, farms: farms.farms, facts: farms.facts ?? [], strategies, season };
}

/** Public summary for a farm-month (latest when period is omitted). Same field names the UI used from the score engine. */
export async function scoreFor(index, farmId, period) {
  const f = index.farms[farmId];
  if (!f) throw new Error(`unknown farm ${farmId}`);
  const meta = f.periods.find(x => x.period === Number(period ?? f.latest)) ?? f.periods.at(-1);
  const summaries = (await getJSON(index.summaries ?? "/data/public/summaries.json")).items ?? {};
  const score = summaries[`${farmId}/${meta.period}`];
  if (!score) throw new Error(`no public summary for ${farmId} ${meta.period}`);
  return { meta, farm: f, score };
}

export const band = (s) => s == null ? "na" : s < 40 ? "b0" : s < 60 ? "b1" : s < 80 ? "b2" : "b3";
export const fmt = (n, d = 0, lang = "es") => n == null || Number.isNaN(n) ? "—" : Number(n).toLocaleString(lang === "es" ? "es-PE" : "en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
export const L = (o, lang) => o == null ? "" : typeof o === "string" ? o : (o[lang] ?? o.es ?? o.en ?? "");
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const periodLabel = (p, lang = "es") => {
  const y = Math.floor(p / 100), m = p % 100;
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(lang === "es" ? "es-PE" : "en-US", { month: "short", year: "numeric", timeZone: "UTC" });
};

/** Re-rank strategies offline from user priorities (water, soil, income). Pure; no network. */
export function rankStrategies(list, pri) {
  const norm = (vals, higherBetter) => {
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return vals.map(v => hi === lo ? 0.5 : higherBetter ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo));
  };
  const w = norm(list.map(s => s.water), false), so = norm(list.map(s => s.soil), true), inc = norm(list.map(s => s.income), true);
  const tot = (pri.water + pri.soil + pri.income) || 1;
  return list.map((s, i) => ({ ...s, fit: (pri.water * w[i] + pri.soil * so[i] + pri.income * inc[i]) / tot }))
    .sort((a, b) => b.fit - a.fit);
}

/** Live check against WaterProofRegistry on Fuji via a raw eth_call (no wallet, no library). */
export async function verifyOnChain(cfg, index, farmId, period, dataHash) {
  if (!cfg.registry) return { status: "no_registry" };
  const farm = index.farms[farmId];
  const pad = (hex) => hex.replace(/^0x/, "").padStart(64, "0");
  const data = index.verifySelector + pad(farm.farmId) + pad(Number(period).toString(16)) + pad(dataHash);
  try {
    const r = await fetch(cfg.rpcUrl, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: cfg.registry, data }, "latest"] }) });
    const j = await r.json();
    if (j.error) return { status: "error", detail: j.error.message };
    return { status: BigInt(j.result) === 1n ? "anchored" : "not_anchored" };
  } catch (e) { return { status: "error", detail: String(e.message ?? e) }; }
}
