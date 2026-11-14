import type { ReactNode } from "react";
import type { Confidence } from "../types";
import { useT } from "../i18n";

export function ConfBadge({ c }: { c: Confidence }) {
  const { t } = useT();
  const label = c === "field" ? t("confField") : c === "regional" ? t("confRegional") : c === "transferred" ? t("confTransferred") : t("confExample");
  return <span className={`badge conf-${c}`}>{label}</span>;
}

export function SourcesButton({ onClick }: { onClick: () => void }) {
  const { t } = useT();
  return (
    <button type="button" className="link-btn" onClick={onClick}>
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 11v6M12 7.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      {t("sources")}
    </button>
  );
}

export function Card({ title, sub, action, children, className = "" }: { title: string; sub?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <header className="card-head">
        <div>
          <h2>{title}</h2>
          {sub && <p className="muted">{sub}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
