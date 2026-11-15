// CERES chat route (POST /v1/ceres/chat) with a mocked Claude Messages API: tool loop, grounding, guards, and the
// promise that the chat never hands out the canonical evidence the x402 Evidence API sells.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createChatHandler, makeTools, cleanHistory, resolveModelAccess } from "../netlify/ceres-chat.mjs";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(WEB, "netlify", "functions", "_x402", "ceres-data.mjs");
let data;

before(async () => {
  if (!existsSync(DATA)) execFileSync("node", [join(WEB, "scripts", "build.mjs")], { stdio: "pipe", env: { ...process.env, X402_PAY_TO: "0x660F4Bb51B4e7AfA5E8C67ef5dFc0A42113277BD" } });
  data = (await import(pathToFileURL(DATA).href)).ceresData();
});

const post = (body, headers = {}) => new Request("https://ceres.example/v1/ceres/chat", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

/** Scripted model: first asks for get_field_score + get_farm_analysis, then answers. Records every request. */
function fakeClaude() {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const req = JSON.parse(init.body); calls.push({ url, headers: init.headers, req });
    const last = req.messages.at(-1);
    if (Array.isArray(last.content) && last.content[0]?.type === "tool_result") {
      return new Response(JSON.stringify({ model: req.model, stop_reason: "end_turn", content: [{ type: "text", text: "El Algarrobal tiene 58 de 100, confianza media." }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ model: req.model, stop_reason: "tool_use", content: [
      { type: "text", text: "Déjame revisar." },
      { type: "tool_use", id: "t1", name: "get_field_score", input: { farm_id: "algarrobal", period: "202610" } },
      { type: "tool_use", id: "t2", name: "get_farm_analysis", input: { farm_id: "algarrobal", water: 0.7, soil: 0.2, income: 0.1 } },
    ] }), { status: 200 });
  };
  return { calls, fetchImpl };
}

test("without ANTHROPIC_API_KEY the route answers 503 (the widget shows 'key not configured')", async () => {
  const r = await createChatHandler({ data, env: {} })(post({ farmId: "algarrobal", lang: "es", messages: [{ role: "user", content: "hola" }] }));
  assert.equal(r.status, 503);
});

test("tool loop: grounded answer, proof chip for the anchored record, key only in the server-side header", async () => {
  const fc = fakeClaude();
  const handle = createChatHandler({ data, env: { ANTHROPIC_API_KEY: "test-key" }, fetchImpl: fc.fetchImpl });
  const r = await handle(post({ farmId: "algarrobal", lang: "es", messages: [{ role: "user", content: "¿Cómo está mi olivar?" }] }));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const j = await r.json();
  assert.match(j.reply, /58/);
  assert.deepEqual(j.toolCalls.map(t => t.name), ["get_field_score", "get_farm_analysis"]);
  assert.equal(j.proofs.length, 1);
  assert.equal(j.proofs[0].dataHash, data.index.farms.algarrobal.periods.find(p => p.period === 202610).dataHash);
  assert.equal(j.proofs[0].recordedOnChain, Boolean(data.summaries["algarrobal/202610"].onChain?.tx), "on-chain flag follows the current record, not a superseded tx");
  assert.equal(fc.calls.length, 2);
  assert.equal(fc.calls[0].headers["x-api-key"], "test-key");
  assert.ok(!JSON.stringify(j).includes("test-key"), "key never echoed to the browser");
  assert.match(fc.calls[0].req.system.map(s => s.text).join("\n"), /CONTEXTO: el usuario está viendo la parcela 'algarrobal'/);
  assert.ok(fc.calls[0].req.tools.length === 5);
});

test("tools return public data only: no canonical evidence, granules or paid score inputs", () => {
  const T = makeTools(data);
  const outs = [T.get_field_score({ farm_id: "algarrobal" }), T.get_farm_analysis({ farm_id: "samegua", water: 1 }), T.get_climate_context({ farm_id: "carumas" }), T.get_risk_calendar({ farm_id: "algarrobal" })];
  const s = JSON.stringify(outs);
  for (const bad of ["\"granules\"", "\"indicators\":{", "ECOv002_L3T_JET_47", "HLS.S30.T1", "\"weightsUsed\"", "\"inputs\":{", "\"scene\""]) assert.ok(!s.includes(bad), `tool output contains ${bad}`);
  assert.equal(outs[0].score, 58);
  assert.ok(outs[1].ranking_with_your_priorities.length === 4, "custom priorities re-rank all four strategies");
  assert.equal(outs[1].strategies.filter(x => x.current).length, 1);
  assert.match(outs[0].full_evidence, /x402/);
});

test("the chat grounding module contains no provenance IDs from the evidence records", async () => {
  const { fingerprintsOf } = await import(pathToFileURL(join(WEB, "scripts", "audit-public.mjs")).href);
  const { readdirSync, readFileSync } = await import("node:fs");
  const E = join(WEB, "..", "avalanche", "oracle", "evidence");
  const recs = readdirSync(E).filter(f => f.endsWith(".json")).map(f => JSON.parse(readFileSync(join(E, f), "utf8")));
  const blob = JSON.stringify(data);
  for (const id of fingerprintsOf(recs)) assert.ok(!blob.includes(id), id);
});

test("guards: bad JSON 400, oversized body 413, wrong method 405, per-IP rate limit 429", async () => {
  const fc = fakeClaude();
  let t = 0;
  const handle = createChatHandler({ data, env: { ANTHROPIC_API_KEY: "k" }, fetchImpl: fc.fetchImpl, now: () => t });
  assert.equal((await handle(new Request("https://x/v1/ceres/chat", { method: "POST", body: "{nope", headers: { "x-nf-client-connection-ip": "1.1.1.1" } }))).status, 400);
  assert.equal((await handle(new Request("https://x/v1/ceres/chat", { method: "POST", body: "x".repeat(30000), headers: { "x-nf-client-connection-ip": "1.1.1.2" } }))).status, 413);
  assert.equal((await handle(new Request("https://x/v1/ceres/chat", { method: "GET" }))).status, 405);
  const ip = { "x-nf-client-connection-ip": "9.9.9.9" };
  let last;
  for (let i = 0; i < 13; i++) last = await handle(post({ farmId: "samegua", messages: [{ role: "user", content: "hola" }] }, ip));
  assert.equal(last.status, 429);
  t += 6 * 60_000;
  assert.equal((await handle(post({ farmId: "samegua", messages: [{ role: "user", content: "hola" }] }, ip))).status, 200, "window resets");
});

test("history cleaning mirrors agent.py: roles merged, assistant-first dropped, length capped", () => {
  const h = cleanHistory([{ role: "assistant", content: "hi" }, { role: "user", content: "a" }, { role: "user", content: "b" }, { role: "system", content: "x" }, { role: "assistant", content: "c".repeat(900) }]);
  assert.deepEqual(h.map(m => m.role), ["user", "assistant"]);
  assert.equal(h[0].content, "a\nb");
  assert.equal(h[1].content.length, 600);
});

test("Netlify AI Gateway: requests go to ANTHROPIC_BASE_URL when it is set, else to the Anthropic API", async () => {
  for (const [env, expected] of [[{ ANTHROPIC_API_KEY: "k", ANTHROPIC_BASE_URL: "https://gw.example/anthropic/" }, "https://gw.example/anthropic/v1/messages"], [{ ANTHROPIC_API_KEY: "k" }, "https://api.anthropic.com/v1/messages"]]) {
    const fc = fakeClaude();
    await createChatHandler({ data, env, fetchImpl: fc.fetchImpl })(post({ farmId: "algarrobal", messages: [{ role: "user", content: "hola" }] }));
    assert.equal(fc.calls[0].url, expected);
  }
});

test("credential resolution: own key, gateway Anthropic vars, generic gateway vars, none", () => {
  assert.equal(resolveModelAccess({ ANTHROPIC_API_KEY: "a" }).via, "own-key");
  assert.equal(resolveModelAccess({ ANTHROPIC_API_KEY: "a", ANTHROPIC_BASE_URL: "https://g/x" }).url, "https://g/x/v1/messages");
  const g = resolveModelAccess({ NETLIFY_AI_GATEWAY_KEY: "n", NETLIFY_AI_GATEWAY_URL: "https://gw.netlify/" });
  assert.equal(g.via, "gateway-generic-vars"); assert.equal(g.key, "n");
  assert.equal(resolveModelAccess({}), null);
});

test("model API failure → 502 without internals", async () => {
  const handle = createChatHandler({ data, env: { ANTHROPIC_API_KEY: "k" }, fetchImpl: async () => new Response("upstream says secret stuff", { status: 500 }) });
  const orig = console.error; console.error = () => {};
  try {
    const r = await handle(post({ farmId: "algarrobal", messages: [{ role: "user", content: "hola" }] }));
    assert.equal(r.status, 502);
    assert.deepEqual(await r.json(), { error: "model_unavailable" });
  } finally { console.error = orig; }
});

test("slider priorities from /app reach the model as context; junk priorities are ignored", async () => {
  const { priorityContext } = await import("../netlify/ceres-chat.mjs");
  assert.match(priorityContext({ water: 0.4, soil: 0.25, income: 0.25 }), /agua 40, suelo 25, ingreso 25/);
  for (const bad of [null, "x", { water: 2, soil: 0, income: 0 }, { water: "0.4", soil: 0.2, income: 0.1 }, { water: 0, soil: 0, income: 0 }]) assert.equal(priorityContext(bad), "");
  const fc = fakeClaude();
  await createChatHandler({ data, env: { ANTHROPIC_API_KEY: "k" }, fetchImpl: fc.fetchImpl })(post({ farmId: "carumas", priorities: { water: 0.7, soil: 0.2, income: 0.1 }, mode: "voice", messages: [{ role: "user", content: "hola" }] }));
  const sys = fc.calls[0].req.system.map(s => s.text).join("\n");
  assert.match(sys, /PRIORIDADES DEL USUARIO/);
  assert.match(sys, /MODO VOZ/);
});

test("backtest tool: public 1981–2025 hindcast summary, labelled as a model, no invented counts", () => {
  const T = makeTools(data);
  const b = T.get_backtest({ farm_id: "carumas" });
  assert.match(b.label, /RETROSIMULACIÓN CON MODELO/);
  assert.equal(b.strategies.length, 4);
  for (const s of b.strategies) assert.equal(s.seasons_tested, 44);
  const cur = b.strategies.find(s => s.current);
  assert.deepEqual(cur.failed_seasons, ["1982/83", "1991/92"]);
  assert.equal(T.get_backtest({ farm_id: "algarrobal" }).strategies.find(s => s.id === "drip").seasons_failed, 1);
  assert.ok(T.get_backtest({ farm_id: "nope" }).error);
});

test("custom slider priorities give numeric fits and a sensible order (regression: risk object made every fit NaN)", () => {
  const T = makeTools(data);
  for (const f of ["algarrobal", "carumas", "samegua"]) {
    const r = T.get_farm_analysis({ farm_id: f, water: 0.4, soil: 0.25, income: 0.25 }).ranking_with_your_priorities;
    assert.equal(r.length, 4);
    for (const x of r) assert.ok(Number.isFinite(x.fit), `${f}/${x.id} fit ${x.fit}`);
    for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].fit >= r[i].fit, "sorted by fit");
  }
  assert.equal(T.get_farm_analysis({ farm_id: "algarrobal", water: 0.4, soil: 0.25, income: 0.25 }).ranking_with_your_priorities[0].id, "drip");
});
