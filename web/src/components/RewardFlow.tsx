import { useState, type ReactNode } from "react";
import type { Farm } from "../types";
import { useT } from "../i18n";
import { RATE_PER_M3, baseline, eligible, fakeHash, fmtNum, maxReward, measured, reward, savedM3, short } from "../lib/calc";
import { Card, SourcesButton } from "./ui";

export type Stage = "idle" | "committed" | "verified" | "paid";

export function RewardFlow({ farm, strategyId, stage, setStage, onSources }: {
  farm: Farm; strategyId: string | null; stage: Stage; setStage: (s: Stage) => void; onSources: () => void;
}) {
  const { t, tl, lang } = useT();
  const [busy, setBusy] = useState(false);
  const s = farm.strategies.find((x) => x.id === strategyId);
  const steps: Stage[] = ["committed", "verified", "paid"];
  const idx = stage === "idle" ? -1 : steps.indexOf(stage);
  const ok = s ? eligible(farm, s) : false;

  const go = (next: Stage, delay: number) => {
    setBusy(true);
    window.setTimeout(() => { setStage(next); setBusy(false); }, delay);
  };

  let body: ReactNode;
  if (!s) body = <p className="muted">{t("pickStrategy")}</p>;
  else if (!ok) body = <p className="muted">{s.current ? t("noRewardCurrent") : t("noReward")}</p>;
  else body = (
    <>
      <dl className="kv">
        <div><dt>{t("rule")}</dt><dd>{farm.mode === "m3" ? `${RATE_PER_M3} ${t("rulePerM3")}` : `${farm.rateHa} ${t("rulePerHa")}`}</dd></div>
        <div><dt>{t("maxReward")}</dt><dd className="strong">{fmtNum(maxReward(farm, s), lang, 2)} USDC</dd></div>
        <div><dt>{t("funder")}</dt><dd>{t("funderValue")}</dd></div>
        <div><dt>Gas</dt><dd>{t("gasSponsored")}</dd></div>
      </dl>

      {(stage === "verified" || stage === "paid") && (
        <>
          {farm.mode === "m3" && (
            <div className="trio">
              <div><span className="muted small">{t("baseline")}</span><b>{fmtNum(baseline(farm), lang)}</b></div>
              <div><span className="muted small">{t("thisSeason")}</span><b>{fmtNum(measured(s), lang)}</b></div>
              <div><span className="muted small">{t("saved")}</span><b className="good-text">{fmtNum(savedM3(farm, s), lang)} m³</b></div>
            </div>
          )}
          <ul className="checks">
            {farm.checks.map((c) => (
              <li key={c.id}>
                <span className={`check ${c.result}`} aria-hidden="true">{c.result === "ok" ? "✓" : c.result === "partial" ? "½" : "×"}</span>
                <span><b>{tl(c.label)}</b><br /><span className="muted small">{tl(c.detail)}</span></span>
                {c.weight > 0 && <span className="muted small mono">{c.result === "ok" ? c.weight : c.got ?? 0}/{c.weight}</span>}
              </li>
            ))}
          </ul>
          {farm.mode === "practice" && <p className="small">{t("compliance")}: <b>{farm.compliance}%</b></p>}
        </>
      )}

      {stage === "paid" && (
        <div className="paid">
          <p className="muted small">{t("received")}</p>
          <p className="big-num good-text">+{fmtNum(reward(farm, s), lang, 2)} <span className="unit">USDC</span></p>
          <dl className="kv mono small">
            <div><dt>{t("evidencePack")}</dt><dd>ipfs://{fakeHash("ev" + farm.id + s.id).slice(2, 14)}…</dd></div>
            <div><dt>{t("settlement")}</dt><dd>{short(fakeHash("tx" + farm.id + s.id))}</dd></div>
          </dl>
        </div>
      )}

      <div className="actions">
        {stage === "idle" && <button type="button" className="btn primary" disabled={busy} onClick={() => go("committed", 600)}>{busy ? t("signing") : t("commitBtn")}</button>}
        {stage === "committed" && <button type="button" className="btn primary" disabled={busy} onClick={() => go("verified", 900)}>{busy ? t("verifying") : t("verifyBtn")}</button>}
        {stage === "verified" && <button type="button" className="btn primary" onClick={() => setStage("paid")}>{t("payBtn")}</button>}
        {stage === "paid" && (
          <>
            <button type="button" className="btn primary">{t("cashOut")}</button>
            <button type="button" className="btn ghost" onClick={() => setStage("idle")}>{t("restart")}</button>
          </>
        )}
      </div>
    </>
  );

  return (
    <Card title={t("reward")} action={<SourcesButton onClick={onSources} />} className="reward">
      <ol className="stepper" aria-label={t("reward")}>
        {[t("stepCommit"), t("stepVerify"), t("stepPaid")].map((label, i) => (
          <li key={label} className={i <= idx ? "done" : i === idx + 1 && ok ? "next" : ""}>
            <span className="step-dot">{i < idx + 1 ? "✓" : i + 1}</span>{label}
          </li>
        ))}
      </ol>
      {body}
      <p className="sim">{t("simulated")} · NØCHAIN</p>
    </Card>
  );
}
