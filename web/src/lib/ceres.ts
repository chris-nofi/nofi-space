import type { Lang } from "../types";

const ORACLE = (import.meta.env.VITE_ORACLE_URL as string | undefined)?.replace(/\/$/, "");
const RETELL_KEY = import.meta.env.VITE_RETELL_PUBLIC_KEY as string | undefined;
const RETELL_AGENT = import.meta.env.VITE_RETELL_AGENT_ID as string | undefined;

export const chatEnabled = Boolean(ORACLE);
export const voiceEnabled = Boolean(RETELL_KEY && RETELL_AGENT);

export interface ChatMsg { role: "user" | "assistant"; content: string }

export async function sendChat(farmId: string, lang: Lang, messages: ChatMsg[]): Promise<string> {
  if (!ORACLE) throw new Error("oracle-not-configured");
  const r = await fetch(`${ORACLE}/v1/ceres/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ farmId, lang, messages: messages.slice(-30) }),
  });
  if (!r.ok) throw new Error(r.status === 503 ? "ceres-not-configured" : `http-${r.status}`);
  const data = (await r.json()) as { reply: string };
  return data.reply;
}

export type CallStatus = "idle" | "connecting" | "live" | "ended" | "error";

export interface VoiceCall { end: () => Promise<void> }

/** Start a Retell web call. CERES's brain runs on the oracle (custom-LLM WebSocket). */
export async function startVoiceCall(
  farmId: string,
  lang: Lang,
  onStatus: (s: CallStatus) => void,
  onTranscript: (lines: { role: string; content: string }[]) => void,
): Promise<VoiceCall> {
  if (!RETELL_KEY || !RETELL_AGENT) throw new Error("voice-not-configured");
  const { RetellClient } = await import("retell-client-js-sdk");
  const client = new RetellClient({ key: RETELL_KEY });
  onStatus("connecting");
  const session = client.createWebCall({
    agent_id: RETELL_AGENT,
    metadata: { farmId, lang },
    transcript: true,
    hooks: {
      onStatus: (s) => onStatus(s === "live" ? "live" : s === "ended" ? "ended" : "connecting"),
      onTranscript: (t) => onTranscript(t.filter((u) => "content" in u && "role" in u).map((u) => { const x = u as { role: string; content: string }; return { role: String(x.role), content: String(x.content ?? "") }; })),
      onEnd: () => onStatus("ended"),
      onError: () => onStatus("error"),
    },
  });
  return { end: () => session.end() };
}
