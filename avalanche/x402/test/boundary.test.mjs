// Paywall boundary tests that need no chain: a stub facilitator drives every outcome so we can prove that NO
// premium bytes leave the handler unless settlement succeeded, plus hash stability and tamper detection for the
// already-attested El Algarrobal 202610 record. (The anvil e2e suite covers real signatures, replay, wrong domain.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../server.mjs";
import { loadConfig } from "../config.mjs";
import { loadEvidence, dataHashOf } from "../earth-data.mjs";

// Revision 1 of El Algarrobal 202610 (monthly rain = GPM IMERG Late; revision 0 with CHIRPS rain was 0x795d6df060…, tx 0x9bd56d2d…).
const ATTESTED = { key: "algarrobal/202610", dataHash: "0xf585dc40c8673eab49893ed253d6be41484c65f8412fab9182e9a3f82f682304" };
const evidence = loadEvidence();
const cfg = { ...loadConfig({ X402_PAY_TO: "0x660F4Bb51B4e7AfA5E8C67ef5dFc0A42113277BD" }), registry: "" }; // no registry → no RPC calls
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
const goodPayload = (nonce = "0x" + "11".repeat(32)) => b64({ x402Version: 2, accepted: { scheme: "exact", network: cfg.network, asset: cfg.asset },
  payload: { signature: "0xstub", authorization: { from: "0x00000000000000000000000000000000000000aa", to: cfg.payTo, value: cfg.prices.evidence, validAfter: "0", validBefore: "9999999999", nonce } } });

/** Premium markers: anything that only a paid evidence/score body contains. */
function assertNoPremium(r) {
  const body = r.body ?? "";
  for (const marker of ["\"evidence\": {", "\"indicators\": {", "\"granules\"", "\"inputs\": {", "\"weightsUsed\"", "ECOv002_L3T", "HLS.S30.T"]) {
    assert.ok(!body.includes(marker), `status ${r.status} body leaked ${marker}`);
  }
  for (const [k, v] of Object.entries(r.headers ?? {})) {
    if (/payment-required|payment-response/i.test(k)) assert.ok(!/"(indicators|evidence|granules)":\s*[{\[]/.test(Buffer.from(String(v), "base64").toString()), `${k} leaked evidence`);
  }
}

function stubFacilitator({ verify = { isValid: true, payer: "0xaa" }, settle = { success: true, transaction: "0x" + "ab".repeat(32), network: "eip155:43113", payer: "0xaa" } } = {}) {
  const seen = new Set();
  return {
    calls: { verify: 0, settle: 0 },
    async verify(p) { this.calls.verify++; return typeof verify === "function" ? verify(p) : verify; },
    async settle(p) {
      this.calls.settle++;
      const n = p?.payload?.authorization?.nonce;
      if (seen.has(n)) return { success: false, errorReason: "invalid_exact_evm_payload_authorization_nonce_used", transaction: "" };
      const s = typeof settle === "function" ? settle(p) : settle;
      if (s.success) seen.add(n);
      return s;
    },
  };
}

const call = (handle, path, headers = {}) => handle("GET", `http://localhost${path}`, headers);

test("hash stability: the attested El Algarrobal 202610 record still hashes to its on-chain dataHash", () => {
  const item = evidence.get(ATTESTED.key);
  assert.ok(item, "evidence present");
  assert.equal(dataHashOf(item.ev), ATTESTED.dataHash);
});

test("tamper test: changing one field in purchased evidence breaks the match with the registry value", () => {
  const ev = structuredClone(evidence.get(ATTESTED.key).ev);
  ev.indicators.ndvi.value = Number((ev.indicators.ndvi.value + 0.001).toFixed(3));
  assert.notEqual(dataHashOf(ev), ATTESTED.dataHash);
  const ev2 = structuredClone(evidence.get(ATTESTED.key).ev);
  ev2.engine.waterSavedM3 += 1;
  assert.notEqual(dataHashOf(ev2), ATTESTED.dataHash);
});

test("anonymous requests to every paid route get 402 with requirements only, no-store, no premium bytes", async () => {
  const fac = stubFacilitator();
  const handle = createHandler({ cfg, evidence, facilitator: fac });
  for (const path of ["/v1/field/algarrobal/evidence?period=202610", "/v1/field/algarrobal/score", "/v1/earth/algarrobal/202610", "/v1/earth/el-algarrobal/202610", "/v1/field/samegua/evidence"]) {
    const r = await call(handle, path);
    assert.equal(r.status, 402, path);
    assert.equal(r.headers["cache-control"], "no-store");
    assertNoPremium(r);
  }
  assert.equal(fac.calls.settle, 0);
});

test("malformed, invalid and unverifiable payments fail closed (402, nothing settled, no premium bytes)", async () => {
  const fac = stubFacilitator({ verify: { isValid: false, invalidReason: "invalid_exact_evm_payload_signature" } });
  const handle = createHandler({ cfg, evidence, facilitator: fac });
  for (const sig of ["not-base64-json", b64({ x402Version: 1 }), goodPayload()]) {
    const r = await call(handle, "/v1/field/algarrobal/evidence?period=202610", { "PAYMENT-SIGNATURE": sig });
    assert.equal(r.status, 402);
    assertNoPremium(r);
  }
  assert.equal(fac.calls.settle, 0, "settle never runs when verification fails");
});

test("valid signature but settlement failure → 402, no premium bytes, no success reported", async () => {
  for (const settle of [{ success: false, errorReason: "settlement_failed", transaction: "" }, { success: false, errorReason: "transaction_reverted", transaction: "0x" + "cd".repeat(32) }]) {
    const handle = createHandler({ cfg, evidence, facilitator: stubFacilitator({ settle }) });
    const r = await call(handle, "/v1/field/algarrobal/evidence?period=202610", { "PAYMENT-SIGNATURE": goodPayload() });
    assert.equal(r.status, 402);
    assert.ok(!r.body.includes("\"success\": true"));
    assertNoPremium(r);
  }
});

test("facilitator crash → generic 500, no internals or premium bytes", async () => {
  const handle = createHandler({ cfg, evidence, facilitator: { verify: async () => { throw new Error("boom at /secret/path evidence.json"); }, settle: async () => ({}) } });
  const orig = console.error; console.error = () => {};
  try {
    const r = await call(handle, "/v1/field/algarrobal/evidence?period=202610", { "PAYMENT-SIGNATURE": goodPayload() });
    assert.equal(r.status, 500);
    assert.deepEqual(JSON.parse(r.body), { error: "internal" });
  } finally { console.error = orig; }
});

test("settled payment → 200 with the exact canonical evidence, its dataHash and receipt; replaying the same nonce fails", async () => {
  const handle = createHandler({ cfg, evidence, facilitator: stubFacilitator() });
  const sig = goodPayload("0x" + "22".repeat(32));
  const r = await call(handle, "/v1/field/algarrobal/evidence?period=202610", { "PAYMENT-SIGNATURE": sig });
  assert.equal(r.status, 200);
  assert.equal(r.headers["cache-control"], "no-store");
  const body = JSON.parse(r.body);
  assert.deepEqual(body.evidence, evidence.get(ATTESTED.key).ev, "buyer receives the unmodified record");
  assert.equal(dataHashOf(body.evidence), ATTESTED.dataHash, "buyer can recompute the on-chain value");
  assert.equal(body.dataHash, ATTESTED.dataHash);
  assert.match(body.proof.paymentTx, /^0x[0-9a-f]{64}$/);
  const replay = await call(handle, "/v1/field/algarrobal/evidence?period=202610", { "PAYMENT-SIGNATURE": sig });
  assert.equal(replay.status, 402);
  assertNoPremium(replay);
});

test("concurrent use of one authorization: exactly one request is served", async () => {
  const handle = createHandler({ cfg, evidence, facilitator: stubFacilitator() });
  const sig = goodPayload("0x" + "33".repeat(32));
  const rs = await Promise.all([1, 2, 3].map(() => call(handle, "/v1/field/algarrobal/evidence?period=202610", { "PAYMENT-SIGNATURE": sig })));
  assert.equal(rs.filter(r => r.status === 200).length, 1);
  for (const r of rs.filter(r => r.status !== 200)) assertNoPremium(r);
});

test("paid score carries the same headline as the public summary engine, plus premium breakdown", async () => {
  const handle = createHandler({ cfg, evidence, facilitator: stubFacilitator() });
  const pay = b64({ ...JSON.parse(Buffer.from(goodPayload("0x" + "44".repeat(32)), "base64").toString()) });
  const r = await call(handle, "/v1/field/algarrobal/score?period=202610", { "PAYMENT-SIGNATURE": pay });
  assert.equal(r.status, 200);
  const s = JSON.parse(r.body);
  assert.equal(s.score, 58); assert.equal(s.confidence, "medium"); assert.equal(s.formulaVersion, "ceres-field-score.v1");
  assert.ok(s.components.water.inputs && s.weightsUsed, "premium inputs and weights present only in the paid body");
});

test("free routes stay free and sanitized: /health and /v1/farms expose no evidence or secrets", async () => {
  const handle = createHandler({ cfg, evidence, facilitator: stubFacilitator() });
  for (const path of ["/health", "/v1/farms"]) {
    const r = await call(handle, path);
    assert.equal(r.status, 200);
    assertNoPremium(r);
    assert.ok(!/PRIVATE|secret|mnemonic/i.test(r.body), `${path} mentions a secret`);
  }
});
