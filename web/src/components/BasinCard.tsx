import type { BasinSignals } from "../types";
import { useT } from "../i18n";
import { MiniBars, Sparkline } from "./Charts";
import { Card, ConfBadge, SourcesButton } from "./ui";

export function BasinCard({ basin, onSources }: { basin: BasinSignals; onSources: () => void }) {
  const { t } = useT();
  return (
    <Card title={t("basin")} sub={t("basinSub")} action={<SourcesButton onClick={onSources} />}>
      <ul className="signals">
        <li>
          <div><b>{t("reservoir")}</b><span className="muted small">OPERA DSWx · {t("last24")}</span></div>
          <Sparkline values={basin.reservoirPct} lo={30} hi={90} tone="water" label={t("reservoir")} />
        </li>
        <li>
          <div><b>{t("headRain")}</b><span className="muted small">GPM IMERG · {t("pctNormal")}</span></div>
          <MiniBars values={basin.headRainPct} label={t("headRain")} />
        </li>
        <li>
          <div><b>{t("storage")}</b><span className="muted small">GRACE-FO · {t("trend")}</span></div>
          <Sparkline values={basin.storageCm} lo={-5} hi={5} tone="ochre" label={t("storage")} />
        </li>
      </ul>
      <ConfBadge c={basin.confidence} />
    </Card>
  );
}
