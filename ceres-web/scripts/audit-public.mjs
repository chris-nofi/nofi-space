// Public-asset leak audit for ceres-web/dist (the Netlify publish dir). Used as the build guard (build.mjs fails
// closed on any failure) and by test/public-boundary.test.mjs.
//
// What counts as PROTECTED (paid-only, served by the x402 Evidence API):
//   - a complete canonical evidence record (the hash preimage anchored in WaterProofRegistry), in any form:
//     JSON file, inlined JS object, canonical string or pretty JSON;
//   - any provenance identifier that only appears in those records: satellite granule IDs, Sentinel-2 item IDs,
//     HLS scene IDs (fingerprints are collected from the evidence files themselves, so no hand-kept list);
//   - the evidence "_note" provenance line, raw evidence directories, the server-only function bundle;
//   - runtime secrets (facilitator key, PEM blocks) if present in the build environment.
// Public 32-byte hashes (dataHash, farmId, tx hashes) are deliberately allowed: they are the public verification handle.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";

const TEXT = new Set([".html", ".js", ".mjs", ".json", ".css", ".txt", ".map", ".webmanifest", ".svg", ".xml", ""]);

export const canon = (v) => Array.isArray(v) ? `[${v.map(canon).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`
  : JSON.stringify(v);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p); else yield p;
  }
}

/** Provenance identifiers that exist only inside canonical evidence records. */
export function fingerprintsOf(records) {
  const fp = new Set();
  const visit = (v, key) => {
    if (Array.isArray(v)) { for (const x of v) visit(x, key); return; }
    if (v && typeof v === "object") { for (const [k, x] of Object.entries(v)) visit(x, k); return; }
    if (typeof v !== "string") return;
    if ((key === "granules" || key === "items" || key === "scene") && v.length >= 12) fp.add(v);
  };
  for (const ev of records) visit(ev);
  return fp;
}

const isCanonicalEvidence = (o) => o && typeof o === "object" && !Array.isArray(o) && "farmKey" in o && "period" in o && "indicators" in o && "engine" in o;

/**
 * @param {string} dist  publish dir
 * @param {object[]} records  canonical evidence objects (the protected set)
 * @param {{secrets?: string[]}} [opts]
 */
export function auditDist(dist, records, opts = {}) {
  const failures = [];
  const fail = (file, rule, detail) => failures.push({ file, rule, detail });
  const fps = fingerprintsOf(records);
  const notes = new Set(records.map(r => r._note).filter(s => typeof s === "string" && s.length > 20));
  const canonStrings = records.map(r => canon(r));
  const prettyStrings = records.map(r => JSON.stringify(r));
  const secrets = (opts.secrets ?? []).filter(s => s && s.length >= 16);
  let files = 0, bytes = 0;

  for (const dir of ["data/evidence", "legacy/evidence", "evidence"]) {
    if (existsSync(join(dist, dir))) fail(dir, "raw-evidence-dir", "evidence directory present in publish dir");
  }
  for (const p of walk(dist)) {
    const rel = relative(dist, p);
    if (/evidence-bundle|_x402[\\/]/.test(rel)) fail(rel, "server-bundle-in-dist", "server-only function bundle copied to public output");
    if (!TEXT.has(extname(p).toLowerCase())) continue;
    const s = readFileSync(p, "utf8");
    files++; bytes += s.length;
    if (extname(p) === ".map") fail(rel, "sourcemap", "source maps are not published");
    for (const id of fps) if (s.includes(id)) { fail(rel, "provenance-id", id); break; }
    for (const n of notes) if (s.includes(n)) { fail(rel, "evidence-note", n.slice(0, 60)); break; }
    for (let i = 0; i < records.length; i++) {
      if (s.includes(canonStrings[i]) || s.includes(prettyStrings[i])) { fail(rel, "canonical-record", `${records[i].farmKey} ${records[i].period}`); break; }
    }
    if (extname(p) === ".json") {
      try {
        const j = JSON.parse(s);
        const stack = [j];
        while (stack.length) {
          const o = stack.pop();
          if (isCanonicalEvidence(o)) { fail(rel, "canonical-shape", `${o.farmKey} ${o.period}`); break; }
          if (o && typeof o === "object") for (const v of Object.values(o)) if (v && typeof v === "object") stack.push(v);
        }
      } catch { /* not JSON: text checks above still apply */ }
    }
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s)) fail(rel, "pem-private-key", "PEM block");
    if (/FACILITATOR_PRIVATE_KEY\s*[=:]\s*["']?0x[0-9a-fA-F]{64}/.test(s)) fail(rel, "facilitator-key", "assignment found");
    for (const sec of secrets) if (s.includes(sec)) { fail(rel, "runtime-secret", "a build-env secret value appears in public output"); break; }
  }
  return { ok: failures.length === 0, filesScanned: files, bytesScanned: bytes, protectedRecords: records.length, fingerprints: fps.size, failures };
}
