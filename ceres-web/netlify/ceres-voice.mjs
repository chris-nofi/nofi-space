// CERES voice (text → speech) for the dashboard widget: POST /v1/ceres/voice {text, lang} → audio/mpeg.
// Uses ElevenLabs when ELEVENLABS_API_KEY is set (natural, warm voice); otherwise GET reports {enabled:false} and the
// widget falls back to the best voice the visitor's browser has. The key stays server-side; text is capped and
// rate-limited because every call spends voice credits.
//   ELEVENLABS_API_KEY   required to enable server voice
//   CERES_VOICE_ID       ElevenLabs voice id (default: a soft, warm female premade voice)
//   CERES_TTS_MODEL      default eleven_multilingual_v2 (best quality, speaks Spanish natively)

export const VOICE_LIMITS = { chars: 1500, body: 8_000, perIp: 30, windowMs: 5 * 60_000 };
export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
export const DEFAULT_TTS_MODEL = "eleven_multilingual_v2";

const json = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });

function readEnv(env, name) {
  const v = env?.[name] ?? globalThis.Netlify?.env?.get?.(name);
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

/** Text as it should be spoken: no markdown, arrows, bullets or unit symbols a voice reads literally. */
export function speakable(text, lang = "es") {
  const es = lang !== "en";
  return String(text ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/0x[0-9a-f]{8,}\S*/gi, es ? "el registro" : "the record")
    .replace(/\*\*|__|`|#+\s/g, "")
    .replace(/^[ \t]*[-*•][ \t]+/gm, "")
    .replace(/\s*→\s*/g, es ? ", luego " : ", then ")
    .replace(/m³\/ha/g, es ? "metros cúbicos por hectárea" : "cubic meters per hectare")
    .replace(/(\d)\s?mm\b/g, es ? "$1 milímetros" : "$1 millimeters")
    .replace(/(\d)\s?ha\b/g, es ? "$1 hectáreas" : "$1 hectares")
    .replace(/(\d)\s?%/g, es ? "$1 por ciento" : "$1 percent")
    .replace(/\bS\/\s?(\d)/g, es ? "$1 soles" : "$1 soles")
    .replace(/\bINIA\b/g, "I N I A")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ", ")
    .replace(/([.,;:])\s*[.,]+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * @param {{env?: object, fetchImpl?: typeof fetch, now?: () => number}} o
 * @returns {(req: Request) => Promise<Response>}
 */
export function createVoiceHandler({ env = process.env, fetchImpl = fetch, now = () => Date.now() } = {}) {
  const hits = new Map();
  return async function handle(req) {
    const key = readEnv(env, "ELEVENLABS_API_KEY");
    if (req.method === "GET") return json(200, { enabled: Boolean(key), provider: key ? "elevenlabs" : "browser" });
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, { allow: "GET, POST" });
    if (!key) return json(503, { error: "voice_not_configured" });

    const ip = req.headers.get("x-nf-client-connection-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
    const t = now(), list = (hits.get(ip) ?? []).filter(x => t - x < VOICE_LIMITS.windowMs);
    if (list.length >= VOICE_LIMITS.perIp) return json(429, { error: "rate_limited" }, { "retry-after": "120" });
    list.push(t); hits.set(ip, list);

    let body;
    try {
      const raw = await req.text();
      if (raw.length > VOICE_LIMITS.body) return json(413, { error: "too_large" });
      body = JSON.parse(raw || "{}");
    } catch { return json(400, { error: "bad_json" }); }
    const lang = body.lang === "en" ? "en" : "es";
    const text = speakable(body.text, lang).slice(0, VOICE_LIMITS.chars);
    if (!text) return json(400, { error: "empty_text" });

    const voice = readEnv(env, "CERES_VOICE_ID") || DEFAULT_VOICE_ID;
    const model = readEnv(env, "CERES_TTS_MODEL") || DEFAULT_TTS_MODEL;
    if (!/^[A-Za-z0-9]{10,40}$/.test(voice)) return json(500, { error: "bad_voice_config" });
    try {
      const r = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "audio/mpeg", "xi-api-key": key },
        body: JSON.stringify({
          text,
          model_id: model,
          // language_code is only accepted by the v2.5 (flash/turbo) models; multilingual v2 detects the language.
          ...(model.includes("v2_5") ? { language_code: lang } : {}),
          voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true, speed: 0.96 },
        }),
      });
      if (!r.ok) {
        console.error("ceres voice: provider", r.status, (await r.text()).slice(0, 200));
        return json(502, { error: "voice_unavailable" });
      }
      return new Response(await r.arrayBuffer(), { status: 200, headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
    } catch (e) {
      console.error("ceres voice: fetch failed", e?.message);
      return json(502, { error: "voice_unavailable" });
    }
  };
}
