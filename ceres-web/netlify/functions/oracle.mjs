// Ceres x402 field API as a Netlify Function (same origin as the site, HTTPS for free).
//   /v1/field/:id/score · /v1/field/:id/evidence · /v1/earth/:farm/:period · /v1/farms · /health
// The code is the tested oracle from space-apps-2026/avalanche/x402, copied into ./_x402 by `npm run build`.
// Netlify environment variables (Site configuration → Environment variables), never in files:
//   X402_PAY_TO              Ceres treasury (public address, ≠ the demo payer)        required for paid routes
//   FACILITATOR_PRIVATE_KEY  hot wallet holding only a little Fuji AVAX for gas (mark as secret)   required to settle
//   WATERPROOF_REGISTRY      WaterProofRegistry on Fuji (adds proof.recordedOnChain)   optional
//   ALLOWED_ORIGINS          CORS allowlist, comma-separated                            optional (default *)
//   ANTHROPIC_API_KEY        Claude key for POST /v1/ceres/chat (CERES text chat)      optional (chat answers 503 without it)
//   CERES_TEXT_MODEL         model id for the chat                                      optional (default claude-sonnet-5-5)
//   ELEVENLABS_API_KEY       natural voice for POST /v1/ceres/voice                     optional (browser voice without it)
//   CERES_VOICE_ID           ElevenLabs voice id                                         optional
// Chain defaults to Fuji 43113 + Circle USDC; nothing else needs setting.
import { createHandler } from "./_x402/server.mjs";
import { evidenceMap } from "./_x402/evidence-bundle.mjs";
import { ceresData } from "./_x402/ceres-data.mjs";
import { createChatHandler } from "../ceres-chat.mjs";
import { createVoiceHandler } from "../ceres-voice.mjs";

let handle, chat, voice;

export default async (req) => {
  // CERES text chat for the dashboard widget (public data only; needs ANTHROPIC_API_KEY).
  const path = new URL(req.url).pathname;
  // CERES voice (text → speech). Natural voice when ELEVENLABS_API_KEY is set; the widget falls back to the browser.
  if (path === "/v1/ceres/voice") {
    voice ??= createVoiceHandler();
    return voice(req);
  }
  if (path === "/v1/ceres/chat") {
    chat ??= createChatHandler({ data: ceresData() });
    return chat(req);
  }
  handle ??= createHandler({ evidence: evidenceMap() });
  const r = await handle(req.method, req.url, Object.fromEntries(req.headers));
  return new Response(r.status === 204 ? null : r.body, { status: r.status, headers: r.headers });
};

export const config = { path: ["/v1/*", "/health"] };
