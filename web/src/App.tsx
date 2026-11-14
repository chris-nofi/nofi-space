import { useCallback, useEffect, useState } from "react";
import { BASIN, FARMS, REGION_FACTS } from "./data/farms";
import type { SheetKey } from "./data/sources";
import { LangContext } from "./i18n";
import { loadFarm } from "./lib/api";
import type { Farm, Lang } from "./types";
import { BasinCard } from "./components/BasinCard";
import { RewardFlow, type Stage } from "./components/RewardFlow";
import { SofiaCard } from "./components/SofiaCard";
import { SourcesSheet } from "./components/SourcesSheet";
import { Strategies } from "./components/Strategies";
import { WaterCard } from "./components/WaterCard";

const L10N = {
  es: { tagline: "Agua medida desde el espacio", farms: "Parcelas", region: "El problema del agua en Moquegua", example: "Datos de ejemplo", live: "Datos NASA en vivo", disclaimer: "Herramienta de apoyo. No reemplaza el criterio del agricultor ni de la Agencia Agraria. Muestra evidencia; no decide cómo se reparte el agua." },
  en: { tagline: "Water measured from space", farms: "Farms", region: "Moquegua's water problem", example: "Example data", live: "Live NASA data", disclaimer: "A support tool. It doesn't replace the farmer's judgment or the Agencia Agraria. It shows evidence; it doesn't decide how water is allocated." },
};

export default function App() {
  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem("ac-lang") as Lang) || "es"; } catch { return "es"; }
  });
  const [farms, setFarms] = useState<Farm[]>(FARMS);
  const [farmId, setFarmId] = useState(FARMS[0].id);
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const [stage, setStageMap] = useState<Record<string, Stage>>({});
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  const [showFacts, setShowFacts] = useState(true);

  useEffect(() => { try { localStorage.setItem("ac-lang", lang); } catch { /* ignore */ } document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { Promise.all(FARMS.map(loadFarm)).then(setFarms); }, []);

  const farm = farms.find((f) => f.id === farmId)!;
  const strategyId = picked[farmId] ?? null;
  const st = stage[farmId] ?? "idle";
  const s = L10N[lang];
  const live = farm.confidence.water !== "example";
  const closeSheet = useCallback(() => setSheet(null), []);

  const select = (id: string) => {
    setPicked((p) => ({ ...p, [farmId]: id }));
    setStageMap((m) => ({ ...m, [farmId]: "idle" }));
  };

  return (
    <LangContext.Provider value={lang}>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="logo" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3c-3.5 4.6-6 8-6 11a6 6 0 0 0 12 0c0-3-2.5-6.4-6-11Z" fill="currentColor" /></svg></span>
            <div>
              <b>Agua Clara</b>
              <span className="muted small">Moquegua · {s.tagline}</span>
            </div>
          </div>
          <div className="top-actions">
            <span className={`badge ${live ? "conf-field" : "conf-example"}`}>{live ? s.live : s.example}</span>
            <div className="seg" role="group" aria-label="Idioma / Language">
              <button type="button" aria-pressed={lang === "es"} onClick={() => setLang("es")}>ES</button>
              <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
            </div>
          </div>
        </header>

        <section className="region">
          <button type="button" className="region-toggle" aria-expanded={showFacts} onClick={() => setShowFacts((v) => !v)}>
            {s.region} <span aria-hidden="true">{showFacts ? "−" : "+"}</span>
          </button>
          {showFacts && (
            <div className="facts">
              {REGION_FACTS.map((f) => (
                <a key={f.value} className="fact" href={f.href} target="_blank" rel="noopener noreferrer">
                  <b>{f.value}</b>
                  <span>{lang === "es" ? f.es : f.en}</span>
                  <span className="muted small">{f.src} ↗</span>
                </a>
              ))}
            </div>
          )}
        </section>

        <nav className="farm-tabs" aria-label={s.farms}>
          {farms.map((f) => (
            <button key={f.id} type="button" aria-pressed={f.id === farmId} onClick={() => setFarmId(f.id)}>
              <span className="tab-zone">{lang === "es" ? f.zone.es : f.zone.en}</span>
              <span className="tab-name">{(lang === "es" ? f.place.es : f.place.en).split(" · ")[0]}</span>
            </button>
          ))}
        </nav>

        <div className="farm-title">
          <h1>{farm.name}</h1>
          <p className="muted">{lang === "es" ? farm.crop.es : farm.crop.en} · {farm.ha} ha · {farm.elevation.toLocaleString()} m · {farm.lat}, {farm.lon}</p>
        </div>

        <main className="grid">
          <div className="col-main">
            <WaterCard farm={farm} onSources={() => setSheet("water")} />
            <Strategies farm={farm} selected={strategyId} onSelect={select} onSources={() => setSheet("strategies")} />
          </div>
          <div className="col-side">
            <RewardFlow farm={farm} strategyId={strategyId} stage={st} setStage={(x) => setStageMap((m) => ({ ...m, [farmId]: x }))} onSources={() => setSheet("reward")} />
            <SofiaCard farm={farm} />
            <BasinCard basin={BASIN} onSources={() => setSheet("basin")} />
          </div>
        </main>

        <footer className="foot">
          <p>{s.disclaimer}</p>
          <p className="muted small">NASA Space Apps 2026 · Field Shift · ECOSTRESS · HLS · POWER · IMERG · OPERA · GRACE-FO · SMAP · SRTM</p>
        </footer>

        <SourcesSheet open={sheet} onClose={closeSheet} />
      </div>
    </LangContext.Provider>
  );
}
