// CERES voice route (GET|POST /v1/ceres/voice) with a mocked ElevenLabs API: disabled without a key, key only in the
// server-side header, speakable text, guards, and no provider internals leaked to the browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createVoiceHandler, speakable, DEFAULT_VOICE_ID } from "../netlify/ceres-voice.mjs";

const post = (body, headers = {}) => new Request("https://ceres.example/v1/ceres/voice", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

function fakeTTS(status = 200) {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, headers: init.headers, req: JSON.parse(init.body) }); return status === 200 ? new Response(new Uint8Array([0xff, 0xfb, 0x90, 0x00]), { status }) : new Response("provider secret detail", { status }); };
  return { calls, fetchImpl };
}

test("without ELEVENLABS_API_KEY: GET says disabled (browser voice), POST 503", async () => {
  const h = createVoiceHandler({ env: {} });
  assert.deepEqual(await (await h(new Request("https://x/v1/ceres/voice"))).json(), { enabled: false, provider: "browser" });
  assert.equal((await h(post({ text: "hola" }))).status, 503);
});

test("with a key: audio/mpeg back, key only in the provider header, default warm voice, speakable text", async () => {
  const t = fakeTTS();
  const h = createVoiceHandler({ env: { ELEVENLABS_API_KEY: "el-test" }, fetchImpl: t.fetchImpl });
  assert.equal((await (await h(new Request("https://x/v1/ceres/voice"))).json()).enabled, true);
  const r = await h(post({ lang: "es", text: "Papa → haba: unos 126 mm al año, +37% de ingreso. Registro 0x795d6df060ff2303." }));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "audio/mpeg");
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(t.calls[0].headers["xi-api-key"], "el-test");
  assert.ok(t.calls[0].url.includes(`/text-to-speech/${DEFAULT_VOICE_ID}`));
  assert.equal(t.calls[0].req.model_id, "eleven_multilingual_v2");
  assert.ok(!("language_code" in t.calls[0].req), "multilingual v2 detects language");
  assert.match(t.calls[0].req.text, /luego haba/);
  assert.match(t.calls[0].req.text, /126 milímetros/);
  assert.match(t.calls[0].req.text, /37 por ciento/);
  assert.ok(!t.calls[0].req.text.includes("0x795d"), "hashes are not read aloud");
});

test("flash v2.5 model gets the language code; custom voice id is used; bad voice id is refused", async () => {
  const t = fakeTTS();
  await createVoiceHandler({ env: { ELEVENLABS_API_KEY: "k", CERES_TTS_MODEL: "eleven_flash_v2_5", CERES_VOICE_ID: "AbCdEf1234567890" }, fetchImpl: t.fetchImpl })(post({ text: "hello", lang: "en" }));
  assert.equal(t.calls[0].req.language_code, "en");
  assert.ok(t.calls[0].url.includes("/text-to-speech/AbCdEf1234567890"));
  const bad = await createVoiceHandler({ env: { ELEVENLABS_API_KEY: "k", CERES_VOICE_ID: "../../v1/user" }, fetchImpl: t.fetchImpl })(post({ text: "hola" }));
  assert.equal(bad.status, 500);
});

test("guards: empty text 400, bad JSON 400, oversized 413, wrong method 405, rate limit 429, text capped", async () => {
  const t = fakeTTS();
  let now = 0;
  const h = createVoiceHandler({ env: { ELEVENLABS_API_KEY: "k" }, fetchImpl: t.fetchImpl, now: () => now });
  assert.equal((await h(post({ text: "  " }, { "x-nf-client-connection-ip": "1" }))).status, 400);
  assert.equal((await h(new Request("https://x/v1/ceres/voice", { method: "POST", body: "{x", headers: { "x-nf-client-connection-ip": "2" } }))).status, 400);
  assert.equal((await h(new Request("https://x/v1/ceres/voice", { method: "POST", body: "x".repeat(9000), headers: { "x-nf-client-connection-ip": "3" } }))).status, 413);
  assert.equal((await h(new Request("https://x/v1/ceres/voice", { method: "PUT" }))).status, 405);
  await h(post({ text: "a ".repeat(2000) }, { "x-nf-client-connection-ip": "4" }));
  assert.ok(t.calls.at(-1).req.text.length <= 1500);
  let last;
  for (let i = 0; i < 31; i++) last = await h(post({ text: "hola" }, { "x-nf-client-connection-ip": "9" }));
  assert.equal(last.status, 429);
  now += 6 * 60_000;
  assert.equal((await h(post({ text: "hola" }, { "x-nf-client-connection-ip": "9" }))).status, 200);
});

test("provider failure → 502 without internals", async () => {
  const orig = console.error; console.error = () => {};
  try {
    const r = await createVoiceHandler({ env: { ELEVENLABS_API_KEY: "k" }, fetchImpl: fakeTTS(401).fetchImpl })(post({ text: "hola" }));
    assert.equal(r.status, 502);
    assert.deepEqual(await r.json(), { error: "voice_unavailable" });
  } finally { console.error = orig; }
});

test("speakable strips markdown, bullets and links", () => {
  const s = speakable("**Hola**\n\n- uno\n- dos\nVer https://x.y/z", "es");
  assert.ok(!/[*\-]|https/.test(s), s);
  assert.match(s, /Hola\. uno, dos, Ver/);
});
