import { useEffect, useRef, useState } from "react";
import type { Farm } from "../types";
import { useT } from "../i18n";
import { chatEnabled, sendChat, startVoiceCall, voiceEnabled, type CallStatus, type ChatMsg, type VoiceCall } from "../lib/ceres";

/** CERES — named after the goddess of grain and the dwarf planet with briny water (NASA Dawn).
 *  Summary (read aloud in the browser), text chat (Claude via the oracle) and voice calls (Retell). */
export function CeresCard({ farm }: { farm: Farm }) {
  const { t, tl, lang } = useT();
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking, setSpeaking] = useState(false);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [call, setCall] = useState<VoiceCall | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [live, setLive] = useState<{ role: string; content: string }[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [farm.id, lang, supported]);
  useEffect(() => { setMsgs([]); setErr(null); }, [farm.id]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [msgs, busy]);
  useEffect(() => () => { void call?.end(); }, [call]);

  const speak = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(tl(farm.ceres));
    const voices = window.speechSynthesis.getVoices();
    const want = lang === "es" ? ["es-PE", "es-419", "es-MX", "es"] : ["en-US", "en"];
    u.voice = want.map((w) => voices.find((v) => v.lang.startsWith(w))).find(Boolean) ?? null;
    u.lang = lang === "es" ? "es-PE" : "en-US";
    u.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };
  const stop = () => { window.speechSynthesis.cancel(); setSpeaking(false); };

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next: ChatMsg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setDraft("");
    setBusy(true);
    setErr(null);
    try {
      const reply = await sendChat(farm.id, lang, next);
      setMsgs([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setErr(String((e as Error).message).includes("not-configured") ? t("ceresOffline") : t("ceresError"));
    } finally {
      setBusy(false);
    }
  };

  const toggleCall = async () => {
    if (call) { await call.end(); setCall(null); setCallStatus("ended"); return; }
    try {
      setLive([]);
      const c = await startVoiceCall(farm.id, lang, setCallStatus, (l) => setLive(l.slice(-4)));
      setCall(c);
    } catch {
      setCallStatus("error");
    }
  };

  const suggestions = [t("askReward"), t("askWhy"), t("askEcostress"), t("askCashOut")];

  return (
    <section className="card ceres">
      <div className="avatar" aria-hidden="true" />
      <div className="ceres-body">
        <div className="ceres-head">
          <span><b>{t("ceres")}</b> <span className="muted small">· {t("ceresRole")}</span></span>
          {supported && (
            <button type="button" className="link-btn" onClick={speaking ? stop : speak}>{speaking ? t("stop") : t("listen")}</button>
          )}
        </div>
        <p>{tl(farm.ceres)}</p>

        <div className="ceres-actions">
          <button type="button" className="btn ghost small" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? t("closeChat") : t("talkToCeres")}
          </button>
          {voiceEnabled && (
            <button type="button" className={`btn small ${call ? "danger" : "primary"}`} onClick={toggleCall}>
              {call ? t("hangUp") : t("callCeres")}
            </button>
          )}
          {callStatus !== "idle" && <span className="muted small">{t(`call_${callStatus}` as const)}</span>}
        </div>

        {call && live.length > 0 && (
          <div className="live-transcript" aria-live="polite">
            {live.map((l, i) => <p key={i} className={l.role === "agent" ? "from-ceres" : "from-user"}>{l.content}</p>)}
          </div>
        )}

        {open && (
          <div className="chat">
            <div className="chat-log" ref={logRef}>
              {msgs.length === 0 && <p className="muted small">{chatEnabled ? t("chatHint") : t("ceresOffline")}</p>}
              {msgs.map((m, i) => <p key={i} className={m.role === "assistant" ? "from-ceres" : "from-user"}>{m.content}</p>)}
              {busy && <p className="from-ceres muted">{t("thinking")}</p>}
              {err && <p className="chat-error">{err}</p>}
            </div>
            <div className="chips">
              {suggestions.map((s) => (
                <button key={s} type="button" className="chip" disabled={!chatEnabled || busy} onClick={() => ask(s)}>{s}</button>
              ))}
            </div>
            <form className="chat-input" onSubmit={(e) => { e.preventDefault(); void ask(draft); }}>
              <label htmlFor="ceres-q" className="sr-only">{t("askPlaceholder")}</label>
              <input id="ceres-q" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("askPlaceholder")} disabled={!chatEnabled || busy} maxLength={600} />
              <button type="submit" className="btn primary small" disabled={!chatEnabled || busy || !draft.trim()}>{t("send")}</button>
            </form>
            <p className="muted small">{t("ceresSafety")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
