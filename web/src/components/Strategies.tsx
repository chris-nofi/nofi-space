import type { Farm, Strategy } from "../types";
import { useT } from "../i18n";
import { baseline, fmtNum } from "../lib/calc";
import { Card, SourcesButton } from "./ui";

function WaterDelta({ farm, s }: { farm: Farm; s: Strategy }) {
  const { lang } = useT();
  if (s.current) return <span className="delta neutral">{fmtNum(s.water, lang)}</span>;
  const pct = Math.round(((s.water - baseline(farm)) / baseline(farm)) * 100);
  return <span className={`delta ${pct < 0 ? "good" : "warn"}`}>{pct > 0 ? "+" : ""}{pct}%</span>;
}

function Dots({ n }: { n: number }) {
  return (
    <span className="dots" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? "on" : ""} />)}
    </span>
  );
}

export function Strategies({ farm, selected, onSelect, onSources }: { farm: Farm; selected: string | null; onSelect: (id: string) => void; onSources: () => void }) {
  const { t, tl, lang } = useT();
  const maxWater = Math.max(...farm.strategies.map((s) => s.water));
  const unit = farm.mode === "m3" ? "m³/ha" : "mm";
  const sel = farm.strategies.find((s) => s.id === selected);

  return (
    <Card title={t("strategies")} sub={t("strategiesSub")} action={<SourcesButton onClick={onSources} />}>
      <div className="strat-list" role="radiogroup" aria-label={t("strategies")}>
        {farm.strategies.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={selected === s.id}
            className={`strat ${selected === s.id ? "selected" : ""}`}
            onClick={() => onSelect(s.id)}
          >
            <div className="strat-top">
              <span className="strat-name">{tl(s.name)}</span>
              {s.current && <span className="tag cur">{t("current")}</span>}
              {s.recommended && <span className="tag rec">{t("recommended")}</span>}
            </div>
            <div className="strat-metrics">
              <div className="metric">
                <span className="m-label">{t("water")}</span>
                <span className="track"><span className="fill water" style={{ width: `${(s.water / maxWater) * 100}%` }} /></span>
                <span className="m-val">{fmtNum(s.water, lang)} {unit} <WaterDelta farm={farm} s={s} /></span>
              </div>
              <div className="metric">
                <span className="m-label">{t("soil")}</span>
                <span className="track"><span className={`fill ${s.soil >= 60 ? "good" : "warn"}`} style={{ width: `${s.soil}%` }} /></span>
                <span className="m-val">{s.soil}/100</span>
              </div>
              <div className="metric compact">
                <span className="m-label">{t("income")}</span>
                <Dots n={s.income} />
                <span className="m-val muted">{t("mainRisk")}: {tl(s.mainRisk)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {sel && (
        <div className="detail">
          <div className="detail-grid">
            <div><h3>{t("why")}</h3><p>{tl(sel.why)}</p></div>
            <div><h3>{t("evidence")}</h3><p>{tl(sel.evidence)}</p></div>
            <div><h3>{t("gaps")}</h3><p>{tl(sel.gaps)}</p></div>
            <div><h3>{t("risks")}</h3><p>{tl(sel.risks)}</p></div>
          </div>
          <p className="review">{t("reviewLocal")}</p>
        </div>
      )}
    </Card>
  );
}
