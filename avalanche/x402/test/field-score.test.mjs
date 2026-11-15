// ceres-field-score.v1 against the real evidence JSONs. The El Algarrobal 202610 case is the spec's worked example
// (mentor/farm-map-x402-plan.md §2.4). The full-table snapshot catches any silent formula drift: if a number here
// changes, either the evidence changed or the formula did, and the latter requires formulaVersion v2.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fieldScore, round1, roundInt, FORMULA_VERSION } from "../field-score.mjs";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "oracle", "evidence");
const ev = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), "utf8"));

test("rounding is half-away-from-zero and immune to IEEE-754 artefacts", () => {
  assert.equal(round1(71.45), 71.5);   // 71.45*10 = 714.4999… in binary
  assert.equal(round1(66.45), 66.5);
  assert.equal(round1(0.15), 0.2);
  assert.equal(roundInt(58.5), 59);
  assert.equal(roundInt(58.045), 58);
  assert.equal(roundInt(2.5), 3);
});

test("worked example: El Algarrobal 202610 → 58, medium confidence (field pixel complete), exact components", () => {
  const r = fieldScore(ev("algarrobal-202610"));
  assert.equal(r.formulaVersion, FORMULA_VERSION);
  assert.equal(r.score, 58);
  assert.equal(r.scoreUnrounded, 57.82);
  assert.equal(r.confidence, "medium");
  assert.deepEqual(r.confidenceReasons, []);
  const v = Object.fromEntries(Object.entries(r.components).map(([k, c]) => [k, c.value]));
  assert.deepEqual(v, { water: 46.3, vegetation: 22.4, soil: 74.6, climate: 100, erosion: 71.5 });
  assert.deepEqual(r.components.soil.subScores, { texture: 55.8, soc: 100, ph: 68 });
  assert.deepEqual(r.components.erosion.subScores, { slope: 66.4, proxy: 76.5 });
  assert.equal(r.components.vegetation.inputs.series, "s2");
  assert.equal(r.components.vegetation.inputs.hls_ndvi, 0.387); // field-pixel HLS (was 0.069 at the bare app point)
  assert.ok(r.gaps.includes("smap TODO"));
  assert.ok(r.gaps.includes("heat TODO"));
  assert.ok(!r.gaps.includes("fieldPixelStatus PENDING/PARTIAL"));
});

test("null ET months omit water and renormalise the remaining weights", () => {
  const r = fieldScore(ev("algarrobal-202608"));
  assert.equal(r.components.water, undefined);
  assert.equal(Object.keys(r.weightsUsed).length, 4);
  assert.ok(Math.abs(Object.values(r.weightsUsed).reduce((a, b) => a + b, 0) - 1) < 1e-3);
  assert.ok(r.gaps.some(g => g.startsWith("ET null")));
  assert.equal(r.confidence, "low");
});

test("Carumas uses SMAP; zero ET is scored as measured and flagged for review", () => {
  const oct = fieldScore(ev("carumas-202610"));
  assert.equal(oct.components.water.inputs.smap.value_m3m3, 0.083);
  assert.equal(oct.components.water.inputs.smap.baseline_2015_2025_m3m3, 0.086);
  const sep = fieldScore(ev("carumas-202609"));
  assert.equal(sep.components.water.inputs.w_et, 0);
  assert.ok(sep.gaps.includes("review: zero ET (measured, granules listed)"));
});

test("Samegua vegetation uses Sentinel-2 (0.626); field-pixel HLS (0.568) agrees within 0.15", () => {
  const r = fieldScore(ev("samegua-202610"));
  assert.equal(r.components.vegetation.inputs.ndvi, 0.626);
  assert.equal(r.components.vegetation.inputs.series, "s2");
  assert.equal(r.components.vegetation.inputs.hls_ndvi, 0.568);
});

test("evidence targets Fuji, not 880024, and every field pixel is complete", () => {
  for (const f of readdirSync(DIR).filter(f => f.endsWith(".json"))) {
    const e = JSON.parse(readFileSync(join(DIR, f), "utf8"));
    assert.match(e._note, /43113/); assert.doesNotMatch(e._note, /880024/);
    if (e.extensions?.fieldPixelStatus) assert.equal(e.extensions.fieldPixelStatus, "complete", f);
  }
});

test("snapshot: every evidence month (score / confidence)", () => {
  const got = Object.fromEntries(readdirSync(DIR).filter(f => f.endsWith(".json")).sort().map(f => {
    const r = fieldScore(JSON.parse(readFileSync(join(DIR, f), "utf8")));
    return [f.replace(".json", ""), `${r.score}/${r.confidence}`];
  }));
  assert.deepEqual(got, {
    "algarrobal-202607": "58/medium", "algarrobal-202608": "64/low", "algarrobal-202609": "63/low", "algarrobal-202610": "58/medium",
    "carumas-202607": "55/low", "carumas-202608": "55/low", "carumas-202609": "49/low", "carumas-202610": "51/low",
    "samegua-202607": "69/low", "samegua-202608": "78/low", "samegua-202609": "60/low", "samegua-202610": "62/low",
  });
});
