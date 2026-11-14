import { useT } from "../i18n";

/** Monthly bars (field ET) with a comparison line (valley median or rain). */
export function EtChart({ et, ref, dashed }: { et: number[]; ref: number[]; dashed: boolean }) {
  const { t } = useT();
  const months = t("months").split(",");
  const W = 560, H = 220, pl = 34, pr = 8, pt = 12, pb = 26;
  const max = Math.max(7, Math.ceil(Math.max(...et, ...ref) + 0.5));
  const bw = (W - pl - pr) / 12;
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / max);
  const ticks = [0, Math.round(max / 3), Math.round((2 * max) / 3), max];
  const cx = (i: number) => pl + i * bw + bw / 2;
  const line = ref.map((v, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("waterUse")}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} className="grid" />
          <text x={pl - 8} y={y(v) + 4} className="axis" textAnchor="end">{v}</text>
        </g>
      ))}
      {et.map((v, i) => (
        <g key={i}>
          <rect x={pl + i * bw + bw * 0.18} y={y(v)} width={bw * 0.64} height={Math.max(0, y(0) - y(v))} rx={4} className="bar" />
          <text x={cx(i)} y={H - 8} className="axis" textAnchor="middle">{months[i]}</text>
        </g>
      ))}
      <path d={line} className="ref-line" strokeDasharray={dashed ? "6 4" : undefined} fill="none" />
      {ref.map((v, i) => <circle key={i} cx={cx(i)} cy={y(v)} r={3} className="ref-dot" />)}
      <text x={pl} y={pt - 2} className="axis">{t("mmPerDay")}</text>
    </svg>
  );
}

export function Sparkline({ values, lo, hi, tone, label }: { values: number[]; lo: number; hi: number; tone: "water" | "ochre"; label: string }) {
  const W = 140, H = 40, p = 4;
  const pts = values.map((v, i) => [p + (i * (W - 2 * p)) / (values.length - 1), H - p - ((H - 2 * p) * (v - lo)) / (hi - lo)]);
  const d = pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} className={`spark ${tone}`}>
      <path d={`${d} L${last[0]} ${H - p} L${pts[0][0]} ${H - p} Z`} className="spark-fill" />
      <path d={d} className="spark-line" fill="none" />
      <circle cx={last[0]} cy={last[1]} r={3} className="spark-dot" />
    </svg>
  );
}

export function MiniBars({ values, label }: { values: number[]; label: string }) {
  const W = 140, H = 40, bw = W / values.length, max = 130;
  const yNormal = H - (H * 100) / max;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} className="minibars">
      <line x1={0} x2={W} y1={yNormal} y2={yNormal} className="normal" />
      {values.map((v, i) => {
        const h = (H * v) / max;
        return <rect key={i} x={i * bw + 4} y={H - h} width={bw - 8} height={h} rx={3} className={v < 85 ? "dry" : "ok"} />;
      })}
    </svg>
  );
}
