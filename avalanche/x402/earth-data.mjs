// Earth oracle data source: one JSON per farm-month ("evidence bundle"). The paid response hashes to the exact
// dataHash the attester anchors in WaterProofRegistry (same canon() as ../oracle/build-attestation.mjs).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { keccak256, toHex } from "viem";

const HERE = dirname(fileURLToPath(import.meta.url));
// Order matters: the first file found for a farm-month wins.
//   1. x402/data/          optional local override (empty in the repo)
//   2. ../oracle/evidence/ REAL evidence from data/build_evidence.py  ← what the demo sells
// ../oracle/examples/ (PLACEHOLDER wiring data) is deliberately NOT loaded, so a paid 200 can never return
// synthetic numbers. Tests that want it pass it explicitly.
export const EVIDENCE_DIR = join(HERE, "..", "oracle", "evidence");
export const EXAMPLES_DIR = join(HERE, "..", "oracle", "examples");
export const DEFAULT_DIRS = [join(HERE, "data"), EVIDENCE_DIR];

// Same canonicalisation as ../oracle/build-attestation.mjs (sorted keys, no whitespace).
export const canon = (v) => Array.isArray(v) ? `[${v.map(canon).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`
  : JSON.stringify(v);

export const dataHashOf = (ev) => "0x" + createHash("sha256").update(canon(ev)).digest("hex");
export const isPlaceholder = (ev) => Boolean(ev._note && /PLACEHOLDER/i.test(ev._note));

export function loadEvidence(dirs = DEFAULT_DIRS) {
  const out = new Map();
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter(f => f.endsWith(".json")).sort()) {
      const ev = JSON.parse(readFileSync(join(d, f), "utf8"));
      if (!ev.farmKey || !ev.period) continue;
      const slug = ev.farmKey.split(":").pop();
      const key = `${slug}/${ev.period}`;
      if (!out.has(key)) out.set(key, { file: join(d, f), ev });
    }
  }
  return out;
}

/** Farm slugs present, and the latest period per slug. */
export function farmsIndex(evidence) {
  const farms = {};
  for (const [key, { ev }] of evidence) {
    const [slug] = key.split("/");
    (farms[slug] ??= { slug, farmKey: ev.farmKey, periods: [] }).periods.push(ev.period);
  }
  for (const f of Object.values(farms)) { f.periods.sort((a, b) => a - b); f.latest = f.periods.at(-1); }
  return farms;
}

/** Evidence for slug + period (or the latest period when period is omitted). */
export function pickEvidence(evidence, slug, period) {
  if (period) return evidence.get(`${slug}/${period}`) ?? null;
  const f = farmsIndex(evidence)[slug];
  return f ? evidence.get(`${slug}/${f.latest}`) : null;
}

const shortPath = (file) => file.split("/").slice(-3).join("/");

/** Compact NASA-indicator view (legacy /v1/earth shape). */
export function toResponse({ ev, file }) {
  return {
    farm: ev.farmKey,
    farmId: keccak256(toHex(ev.farmKey)),
    period: ev.period,
    indicators: ev.indicators,
    recommendation: ev.engine,
    placeholder: isPlaceholder(ev), // never hide synthetic data from judges
    evidence: { dataHash: dataHashOf(ev), file: shortPath(file) },
  };
}

/** Full evidence bundle: the exact JSON whose canonical sha256 is dataHash, so a buyer can re-hash it. */
export function toEvidenceResponse({ ev, file }) {
  return {
    farm: ev.farmKey,
    farmId: keccak256(toHex(ev.farmKey)),
    period: ev.period,
    placeholder: isPlaceholder(ev),
    dataHash: dataHashOf(ev),
    hashing: "sha256 over canonical JSON of `evidence` (keys sorted recursively, no whitespace)",
    file: shortPath(file),
    evidence: ev,
  };
}
