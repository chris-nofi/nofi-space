import { useState } from "react";
import type { Farm } from "../types";
import { useT } from "../i18n";
import { annualM3PerHa, annualMm, fmtNum, pctVsRef } from "../lib/calc";
import { EtChart } from "./Charts";
import { Card, ConfBadge, SourcesButton } from "./ui";

export function WaterCard({ farm, onSources }: { farm: Farm; onSources: () => void }) {
  const { t, tl, lang } = useT();
  const [showInfo, setShowInfo] = useState(false);
  const irrigated = farm.mode === "m3";
  const headline = irrigated ? annualM3PerHa(farm.et) : annualMm(farm.et);
  const delta = pctVsRef(farm);

  return (
    <Card title={t("waterUse")} action={<SourcesButton onClick={onSources} />} className="water">
      <div className="headline">
        <div>
          <p className="muted small">{t("yourFieldUses")}</p>
          <p className="big-num">{fmtNum(headline, lang)}</p>
          <p className="muted small">{irrigated ? t("perHaYear") : t("perSeason")}</p>
        </div>
        <div className="headline-side">
          <span className={`pill ${delta > 0 ? "warn" : "good"}`}>
            {delta > 0 ? "+" : ""}{delta}% {t("vs")} {tl(farm.refLabel).toLowerCase()}
          </span>
          <ConfBadge c={farm.confidence.water} />
        </div>
      </div>

      <EtChart et={farm.et} ref={farm.ref} dashed={irrigated} />

      <div className="legend">
        <span><i className="sw bar-sw" />{t("yourField")} · ECOSTRESS</span>
        <span><i className="sw ref-sw" />{tl(farm.refLabel)}</span>
        <button type="button" className="link-btn" aria-expanded={showInfo} onClick={() => setShowInfo((v) => !v)}>
          {lang === "es" ? "¿Qué es esto?" : "What is this?"}
        </button>
      </div>
      {showInfo && <p className="info">{t("whatIsET")}</p>}

      <dl className="facts-row">
        <div><dt>{t("rain")}</dt><dd>{fmtNum(farm.rainYear, lang)} {lang === "es" ? "mm/año" : "mm/yr"}</dd></div>
        <div><dt>{t("coldestMin")}</dt><dd>{farm.tminCold}°C</dd></div>
        <div><dt>{t("source")}</dt><dd>{tl(farm.waterSource)}</dd></div>
      </dl>
    </Card>
  );
}
