// Public/paid boundary for the website build. Runs a fresh guarded build, then checks:
//   - no canonical evidence, provenance ID or evidence directory in dist/ (the same audit the build enforces);
//   - the audit actually catches leaks (negative controls);
//   - public summaries are a strict allowlist and keep the on-chain hash of the UNMODIFIED record;
//   - old evidence URLs are routed to a 410 page; legacy bundles are sanitized;
//   - the Netlify Function wrapper serves 402 (no premium bytes) to anonymous callers.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, cpSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { auditDist, canon } from "../scripts/audit-public.mjs";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(WEB, "dist");
const EVID = join(WEB, "..", "avalanche", "oracle", "evidence");
const ATTESTED = { key: "algarrobal/202610", dataHash: "0x795d6df060ff23036afc664c2ae4955b003c37c59a98cf3eef1eacb9a54cfa84" };
const sha = (s) => "0x" + createHash("sha256").update(s).digest("hex");
const records = readdirSync(EVID).filter(f => f.endsWith(".json")).map(f => JSON.parse(readFileSync(join(EVID, f), "utf8"))).filter(r => !/PLACEHOLDER/i.test(r._note ?? ""));
const ENV = { ...process.env, GOOGLE_MAPS_API_KEY: "test-browser-key", WATERPROOF_REGISTRY: "0xa03c3472b8F5F6d6FE1dB23B241DB5A50aa3892d", X402_PAY_TO: "0x660F4Bb51B4e7AfA5E8C67ef5dFc0A42113277BD" };

before(() => { execFileSync("node", [join(WEB, "scripts", "build.mjs")], { env: ENV, stdio: "pipe" }); });

test("leak audit passes on the fresh build and scanned real content", () => {
  const r = auditDist(DIST, records);
  assert.deepEqual(r.failures, []);
  assert.ok(r.filesScanned > 30 && r.fingerprints > 100, JSON.stringify({ files: r.filesScanned, fp: r.fingerprints }));
});

test("no evidence directories or raw evidence files anywhere in dist", () => {
  for (const d of ["data/evidence", "legacy/evidence", "evidence"]) assert.ok(!existsSync(join(DIST, d)), d);
  assert.ok(!existsSync(join(DIST, "assets", "field-score.mjs")), "browser no longer needs the scoring module");
  assert.ok(!existsSync(join(DIST, "legacy", "landing-v1.html")));
});

test("negative controls: the audit flags a copied record, an inlined JS record and a lone granule ID", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ceres-audit-"));
  try {
    cpSync(DIST, tmp, { recursive: true });
    const ev = records.find(r => r.farmKey.endsWith("algarrobal") && r.period === 202610);
    writeFileSync(join(tmp, "leak.json"), JSON.stringify(ev, null, 2));
    writeFileSync(join(tmp, "leak.js"), `window.X=${canon(ev)};`);
    writeFileSync(join(tmp, "one.html"), `<p>${ev.indicators.ndvi.granules[0]}</p>`);
    const rules = new Set(auditDist(tmp, records).failures.map(f => `${f.file}:${f.rule}`));
    assert.ok([...rules].some(x => x.startsWith("leak.json:")), "copied JSON record flagged");
    assert.ok([...rules].some(x => x.startsWith("leak.js:")), "inlined JS record flagged");
    assert.ok(rules.has("one.html:provenance-id"), "single granule flagged");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("public summaries: strict allowlist, all 12 farm-months, hashes of the unmodified records", () => {
  const { schemaVersion, items } = JSON.parse(readFileSync(join(DIST, "data", "public", "summaries.json"), "utf8"));
  assert.equal(schemaVersion, "ceres-public-summary.v1");
  assert.equal(Object.keys(items).length, records.length);
  const ALLOWED = ["schemaVersion", "farm", "farmId", "period", "score", "confidence", "formulaVersion", "components", "missingComponents", "confidenceReasons", "gaps", "sources", "disclaimer", "dataHash", "onChain"];
  for (const [key, s] of Object.entries(items)) {
    assert.deepEqual(Object.keys(s).sort(), [...ALLOWED].sort(), key);
    for (const c of Object.values(s.components)) assert.deepEqual(Object.keys(c), ["value"], `${key} component exposes more than its display value`);
    for (const src of s.sources) assert.deepEqual(Object.keys(src).sort(), ["detail", "name"]);
    const rec = records.find(r => `${r.farmKey.split(":").pop()}/${r.period}` === key);
    assert.equal(s.dataHash, sha(canon(rec)), `${key} dataHash must be the hash of the full canonical record`);
  }
  assert.equal(items[ATTESTED.key].dataHash, ATTESTED.dataHash);
  assert.equal(items[ATTESTED.key].score, 58);
  assert.match(items[ATTESTED.key].onChain.tx, /^0x9bd56d2d/);
});

test("index.json has no file links, only public verification handles", () => {
  const idx = readFileSync(join(DIST, "data", "index.json"), "utf8");
  assert.ok(!/"file"\s*:/.test(idx));
  assert.ok(!/\/data\/evidence\//.test(idx));
});

test("old raw-evidence URLs are routed to a 410 explanation page", () => {
  const redirects = readFileSync(join(DIST, "_redirects"), "utf8");
  for (const p of ["/data/evidence/*", "/legacy/evidence/*", "/evidence/*"]) assert.match(redirects, new RegExp(p.replace(/[*/.]/g, "\\$&") + "\\s+/evidence-moved/\\s+410!"));
  const page = readFileSync(join(DIST, "evidence-moved", "index.html"), "utf8");
  assert.match(page, /x402/); assert.match(page, /\/verify\//);
});

test("legacy dashboard ships sanitized data: no provenance IDs, no evidence links, x402 pointer instead of download", () => {
  const si = readFileSync(join(DIST, "legacy", "si-data.js"), "utf8"), nasa = readFileSync(join(DIST, "legacy", "ceres-nasa-data.js"), "utf8");
  for (const s of [si, nasa]) {
    assert.ok(!/"granules"|"scene"|"items"|"evidence_files"/.test(s));
    assert.ok(!/evidence\/[a-z]+-\d{6}\.json/.test(s));
  }
  const app = readFileSync(join(DIST, "legacy", "app.js"), "utf8");
  assert.ok(!app.includes("Descargar evidencia (JSON)"));
  assert.ok(app.includes("/api-docs/#evidence"));
});

test("Netlify Function wrapper: anonymous premium requests get 402 and no premium bytes", async () => {
  process.env.X402_PAY_TO = ENV.X402_PAY_TO;
  delete process.env.WATERPROOF_REGISTRY; // no RPC from tests
  const fn = (await import(pathToFileURL(join(WEB, "netlify", "functions", "oracle.mjs")).href)).default;
  for (const path of ["/v1/field/algarrobal/evidence?period=202610", "/v1/field/algarrobal/score", "/v1/earth/algarrobal/202610"]) {
    const res = await fn(new Request(`https://ceres.example${path}`));
    const body = await res.text();
    assert.equal(res.status, 402, path);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.ok(!/"(indicators|evidence|granules)":\s*[{\[]/.test(body), `${path} leaked premium JSON`);
  }
  const health = await fn(new Request("https://ceres.example/health"));
  assert.equal(health.status, 200);
  assert.ok(!/PRIVATE|secret/i.test(await health.text()));
});
