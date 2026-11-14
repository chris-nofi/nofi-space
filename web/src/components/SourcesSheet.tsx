import { useEffect, useRef } from "react";
import { SHEETS, type SheetKey } from "../data/sources";
import { useT } from "../i18n";
import { ConfBadge } from "./ui";

export function SourcesSheet({ open, onClose }: { open: SheetKey | null; onClose: () => void }) {
  const { t, tl } = useT();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const sheet = SHEETS[open];
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <aside className="sheet" role="dialog" aria-modal="true" aria-label={tl(sheet.title)} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{tl(sheet.title)}</h2>
          <button ref={closeRef} type="button" className="btn ghost small" onClick={onClose}>{t("close")}</button>
        </header>
        <p className="info">{tl(sheet.note)}</p>
        <ul className="source-list">
          {sheet.sources.map((s) => (
            <li key={s.name} className={s.nasa ? "nasa" : "other"}>
              <div className="source-top">
                <b>{s.name}</b>
                <ConfBadge c={s.confidence} />
              </div>
              <p>{tl(s.what)}</p>
              <p className="muted small">{s.resolution} · {tl(s.access)}</p>
              <a href={s.href} target="_blank" rel="noopener noreferrer">{s.nasa ? "NASA ↗" : "↗"}</a>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
