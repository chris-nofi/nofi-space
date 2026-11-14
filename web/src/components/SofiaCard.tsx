import { useEffect, useState } from "react";
import type { Farm } from "../types";
import { useT } from "../i18n";

export function SofiaCard({ farm }: { farm: Farm }) {
  const { t, tl, lang } = useT();
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [farm.id, lang, supported]);

  const speak = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(tl(farm.sofia));
    const voices = window.speechSynthesis.getVoices();
    const want = lang === "es" ? ["es-PE", "es-419", "es-MX", "es"] : ["en-US", "en"];
    u.voice = want.map((w) => voices.find((v) => v.lang.startsWith(w))).find(Boolean) ?? null;
    u.lang = lang === "es" ? "es-PE" : "en-US";
    u.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };
  const stop = () => { window.speechSynthesis.cancel(); setSpeaking(false); };

  return (
    <section className="card sofia">
      <div className="avatar" aria-hidden="true" />
      <div className="sofia-body">
        <div className="sofia-head">
          <b>{t("sofia")}</b>
          {supported && (
            <button type="button" className="link-btn" onClick={speaking ? stop : speak}>
              {speaking ? t("stop") : t("listen")}
            </button>
          )}
        </div>
        <p>{tl(farm.sofia)}</p>
      </div>
    </section>
  );
}
