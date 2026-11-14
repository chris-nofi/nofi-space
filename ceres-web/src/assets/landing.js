// Landing page: hero map, sourced facts, live El Algarrobal example, anchored records, ES/EN.
import { loadSite, scoreFor, band, fmt, L, esc, periodLabel } from "./data.js";
import { mountFarmMap } from "./maps.js";

const cfg = window.CERES_CONFIG ?? {};
const LS = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
let lang = LS.get("ceres.lang.landing") || "en";
let site, algScore;

// Spanish copy. English lives in the HTML (so the page reads correctly without JS).
const ES = {
  "nav.how": "Cómo funciona", "nav.map": "El mapa", "nav.data": "Datos NASA", "nav.buyers": "Para compradores", "nav.ver": "Verificable", "nav.builders": "Para desarrolladores", "nav.open": "Abrir mapa",
  "hero.eyebrow": "NASA Space Apps 2026 · Field Shift · Moquegua, Perú",
  "hero.h1": "Un mapa de las chacras de Moquegua, con puntaje de datos NASA y un registro que se puede comprobar.",
  "hero.sub": "Cada chacra recibe un puntaje de suelo y agua con datos NASA y un registro verificable. El agricultor compara opciones de rotación y salud del suelo, y puede preguntarle a CERES por voz en español, gratis. La API de pago por consulta está pensada para aseguradoras, bancos, cooperativas y agroexportadoras.",
  "hero.open": "Abrir el mapa", "hero.ceres": "Hablar con CERES", "hero.buyers": "Para compradores", "trust.pending": "pendiente",
  "prob.eyebrow": "El problema", "prob.h2": "Falta agua, el suelo está cansado y un solo cultivo carga todo el riesgo.",
  "how.eyebrow": "Cómo funciona", "how.h2": "Cuatro pasos, del satélite a una decisión que se puede comprobar.",
  "how.s1h": "Elige una chacra", "how.s1": "Abre el mapa y elige una de las chacras piloto: un olivar en la costa de Ilo, alfalfa en Samegua o papa en la zona alta de Carumas.",
  "how.s2h": "Lee su puntaje", "how.s2": "El Puntaje Ceres combina agua, vegetación, suelo, clima y erosión de conjuntos de datos NASA y aliados con nombre propio, y muestra su incertidumbre.",
  "how.s3h": "Compara opciones", "how.s3": "Mira tres o más rotaciones o formas de manejo, incluida la actual, y ordénalas según tus prioridades.",
  "how.s4h": "Guarda un registro", "how.s4": "La evidencia detrás del puntaje recibe una huella anclada en Avalanche, para que cualquiera compruebe después que no se cambió.",
  "ex.eyebrow": "Ejemplo en vivo", "ex.h2": "Olivar de El Algarrobal, calculado desde el archivo de evidencia.",
  "data.eyebrow": "Datos NASA, explicados", "data.h2": "Qué mide cada conjunto de datos y cómo lo usa el puntaje.",
  "data.eco": "Evapotranspiración real (ET) desde la estación espacial. Dividida por la ET₀ de referencia da la parte de estrés hídrico del puntaje.",
  "data.power": "Clima diario desde 1981. Alimenta la ET₀ FAO-56, la climatología de heladas y el modelo de agua 2001–2025 de cada estrategia.",
  "data.hls": "Reflectancia armonizada para el verdor NDVI en el píxel de cultivo, contrastada con Sentinel-2 de la ESA a 10 m.",
  "data.smap": "Humedad del suelo frente a su línea base 2015–2025. Hoy se usa en Carumas; es una señal regional, no una lectura de la chacra.",
  "data.srtm": "Elevación y pendiente alrededor de cada chacra. Junto con la intensidad de lluvias fuertes da un indicador relativo de erosión, no pérdida de suelo.",
  "data.other": "Historia larga de NDVI, lluvia (CHIRPS reemplaza a GPM IMERG mientras se aprueba el acceso) y series de helada donde la celda de POWER queda muy alta.",
  "data.note": "Los satélites ven un píxel de 30 m a 9 km; una chacra tiene 1–2 ha. Ceres muestra los vacíos y la confianza de cada puntaje. Apoya, no reemplaza, el criterio del agricultor. La textura y el carbono del suelo vienen de ISRIC SoilGrids, que no es un producto NASA.",
  "ver.eyebrow": "Verificable por diseño · Avalanche", "ver.h2": "Cada puntaje apunta a una evidencia que nadie puede cambiar en silencio.",
  "ver.lead": "El agricultor ve una insignia simple de «registro verificable». Por debajo, el archivo de evidencia se resume en una huella que se guarda en el contrato WaterProofRegistry, en la red de prueba Fuji C-Chain de Avalanche.",
  "ver.n1h": "Datos NASA y aliados", "ver.n1": "ECOSTRESS, HLS, SMAP, POWER, SRTM, Sentinel-2", "ver.n2h": "Oráculo Earth", "ver.n2": "un JSON de evidencia por chacra y mes",
  "ver.n3h": "Huella", "ver.n3": "sha256 del JSON canónico", "ver.n5": "cualquiera puede comprobarlo", "ver.latest": "Últimos registros anclados",
  "buy.eyebrow": "Para compradores", "buy.h2": "Consulta una chacra. Paga por consulta. Comprueba el registro.",
  "buy.lead": "El agricultor usa el mapa y CERES gratis. La API está pensada para organizaciones que necesitan una vista por chacra que puedan auditar después. Son los usuarios para los que la diseñamos; no tenemos clientes de pago en esta red de prueba.",
  "buy.c1h": "Seguro agrícola", "buy.c1": "Evaluar una parcela antes de emitir o renovar una póliza, con los mismos datos comprobables después.",
  "buy.c2h": "Crédito agrícola", "buy.c2": "Archivar la tendencia del puntaje y la práctica recomendada junto a una evaluación de crédito.",
  "buy.c3h": "Cooperativas y juntas de riego", "buy.c3": "Planificar turnos de agua y visitas de extensión con un registro compartido.",
  "buy.c4h": "Exportadores y ESG", "buy.c4": "Mostrar a un comprador de dónde viene la historia de agua y cobertura de un olivar, dato por dato.",
  "buy.cta": "Leer la API",
  "api.eyebrow": "API x402 por chacra · para desarrolladores y jurados", "api.h2": "Evidencia NASA de chacras, pago por consulta.",
  "api.lead": "x402 estándar: la primera solicitud devuelve HTTP 402 con el precio; el cliente firma una autorización EIP-3009 en USDC (el pagador no paga gas); nuestro facilitador liquida en Fuji y los datos vuelven con el recibo y la prueba del registro.",
  "api.th1": "Endpoint", "api.th2": "Precio", "api.free": "gratis", "api.pricing": "Precios de demostración en USDC de prueba de Circle (eip155:43113). No es una oferta comercial.",
  "api.try": "Probar con Core wallet",
  "ceres.eyebrow": "Asistente de voz CERES", "ceres.h2": "Pregunta en español, por voz, sin costo.",
  "ceres.p": "CERES lee la misma evidencia y explica el puntaje y las opciones en español sencillo. Funciona desde el navegador del celular; el agricultor nunca ve una billetera.",
  "ceres.cta": "Hablar con CERES", "road.h": "Hoja de ruta",
  "road.1": "Confirmar cada píxel de cultivo con su agricultor y trazar el linde real de la chacra.",
  "road.2": "Lluvia GPM IMERG cuando se apruebe el acceso; estrés por calor en el puntaje (v2).",
  "road.3": "Más valles de Moquegua, con lindes trazados junto a los agricultores.", "road.4": "Llevar el registro a la L1 de NØFI con gas en stablecoin.",
  "team.eyebrow": "Equipo", "team.lead": "líder del equipo", "team.built": "Hecho en el NASA Space Apps Challenge 2026, evento local de Moquegua.",
  "foot.attr": "Datos: NASA (ECOSTRESS, HLS, SMAP, POWER, MODIS, SRTM; GPM IMERG pendiente), ESA Copernicus Sentinel-2, ECMWF ERA5-Land, ISRIC SoilGrids, CHIRPS (UCSB CHC). Imágenes del mapa © Google.",
  "foot.nasa": "La NASA no respalda este proyecto. Solo red de prueba: no se mueve dinero real.",
  "foot.ai": "Uso de IA: el equipo usó Claude y otras herramientas de IA para escribir código, procesar datos y redactar textos; el equipo revisó los resultados. CERES usa un modelo de IA para explicar resultados; no cambia los datos.",
  "foot.verify": "Verificar un registro",
};
const EN = {};
document.querySelectorAll("[data-i]").forEach(el => { EN[el.dataset.i] = el.textContent; });
const tr = (k) => (lang === "es" ? ES[k] : EN[k]) ?? EN[k] ?? k;

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i]").forEach(el => { const v = tr(el.dataset.i); if (v) el.textContent = v; });
  document.getElementById("lang").textContent = lang === "es" ? "EN" : "ES";
  if (site) { renderFacts(); renderExample(); renderRecords(); }
}

function renderFacts() {
  const el = document.getElementById("facts");
  el.innerHTML = site.facts.map(f => `<div class="card"><div class="num">${esc(f.value)}</div><p>${esc(L(f, lang))}</p>
    <p class="src">${lang === "es" ? "Fuente" : "Source"}: <a href="${esc(f.href)}" target="_blank" rel="noopener">${esc(f.src)}</a></p></div>`).join("");
}

function renderExample() {
  const el = document.getElementById("exCard");
  if (!algScore) return;
  const s = algScore.score, S = site.strategies.algarrobal;
  const cur = S.list.find(x => x.current), pick = S.list.find(x => x.id === S.engine.pick);
  const pct = ((pick.water - cur.water) / cur.water) * 100;
  const comps = { water: ["Water", "Agua"], vegetation: ["Vegetation", "Vegetación"], soil: ["Soil*", "Suelo*"], climate: ["Climate (frost)", "Clima (helada)"], erosion: ["Erosion", "Erosión"] };
  const ix = lang === "es" ? 1 : 0;
  el.innerHTML = `<div class="ex"><span class="badge ${band(s.score)}">${s.score}</span><div>
      <p style="margin:0"><b>El Algarrobal · ${esc(L(site.farms.find(f => f.id === "algarrobal").crop, lang))}</b> · ${esc(periodLabel(s.period, lang))}
        <span class="pill ${s.confidence === "low" ? "low" : "med"}">${lang === "es" ? (s.confidence === "low" ? "confianza baja" : "confianza media") : `${s.confidence} confidence`}</span></p>
      <p class="muted" style="margin:.3em 0 .8em"><span class="mono">${esc(s.formulaVersion)}</span> · ${lang === "es" ? "medido en el píxel de cultivo; sin SMAP en la costa; medio es el máximo en v1" : "measured at the cultivation pixel; no SMAP on the coast; medium is the v1 ceiling"}</p>
      <div class="bars">${Object.entries(s.components).map(([k, c]) => `<div class="bar"><span>${comps[k][ix]}</span><div class="track"><div class="fill" style="width:${c.value}%"></div></div><span class="v">${fmt(c.value, 1, lang)}</span></div>`).join("")}</div>
    </div></div>
    <div class="cmp">
      <div class="card"><small class="muted">${lang === "es" ? "Hoy" : "Today"}: ${esc(L(cur.name, lang))}</small><div class="num">${fmt(cur.water, 0, lang)}</div><small class="muted">m³/ha/${lang === "es" ? "año" : "yr"}</small></div>
      <div class="card" style="border-color:var(--mint)"><small class="muted">${lang === "es" ? "Recomendado" : "Recommended"}: ${esc(L(pick.name, lang))}</small><div class="num">${fmt(pick.water, 0, lang)}</div><small class="muted">m³/ha/${lang === "es" ? "año" : "yr"} · ${fmt(pct, 1, lang)}%</small></div>
    </div>
    <dl class="kv" style="display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;font-size:.92rem">
      <dt class="muted">${lang === "es" ? "Por qué" : "Why"}</dt><dd style="margin:0">${esc(L(pick.why, lang))}</dd>
      <dt class="muted">${lang === "es" ? "Evidencia" : "Evidence"}</dt><dd style="margin:0">${esc(L(pick.evidence, lang))}</dd>
      <dt class="muted">${lang === "es" ? "Vacíos" : "Gaps"}</dt><dd style="margin:0">${esc(L(pick.gaps, lang))}</dd>
      <dt class="muted">${lang === "es" ? "Riesgos" : "Risks"}</dt><dd style="margin:0">${esc(L(pick.risks, lang))}</dd>
    </dl>
    <p class="src" style="margin-top:10px">${esc(S.waterSource)} ${lang === "es" ? "*Suelo: SoilGrids, no es un producto NASA." : "*Soil: SoilGrids, not a NASA product."}</p>
    <p><a class="btn" href="/app/?farm=algarrobal">${lang === "es" ? "Ver en el mapa" : "View in map"} →</a></p>`;
}

function renderRecords() {
  const el = document.getElementById("records");
  const rows = Object.entries(site.index.attestations ?? {}).filter(([, r]) => r?.tx);
  if (!rows.length) {
    el.innerHTML = `<p class="muted">${lang === "es" ? "El primer registro en Fuji está pendiente. Las huellas ya están calculadas:" : "The first Fuji record is pending. Fingerprints are already computed:"}</p>
      <table class="t"><thead><tr><th>${lang === "es" ? "Chacra" : "Field"}</th><th>${lang === "es" ? "Mes" : "Month"}</th><th>dataHash</th></tr></thead><tbody>
      ${Object.values(site.index.farms).map(f => { const p = f.periods.at(-1); return `<tr><td>${esc(f.id)}</td><td>${p.period}</td><td><a class="mono" href="/verify/${esc(p.dataHash)}">${esc(p.dataHash.slice(0, 22))}…</a></td></tr>`; }).join("")}</tbody></table>`;
    return;
  }
  el.innerHTML = `<table class="t"><thead><tr><th>${lang === "es" ? "Chacra" : "Field"}</th><th>${lang === "es" ? "Mes" : "Month"}</th><th>Block</th><th>Tx</th></tr></thead><tbody>
    ${rows.map(([k, r]) => { const [farm, period] = k.split("/"); return `<tr><td>${esc(farm)}</td><td>${esc(period)}</td><td>${esc(r.block ?? "—")}</td><td><a class="mono" href="${esc(cfg.explorer)}/tx/${esc(r.tx)}" target="_blank" rel="noopener">${esc(r.tx.slice(0, 14))}…</a></td></tr>`; }).join("")}</tbody></table>`;
}

document.getElementById("lang").addEventListener("click", () => { lang = lang === "es" ? "en" : "es"; LS.set("ceres.lang.landing", lang); applyLang(); });

(async function init() {
  try {
    site = await loadSite();
    const scores = {};
    for (const f of site.farms) {
      const sc = await scoreFor(site.index, f.id);
      scores[f.id] = { score: sc.score.score, confidence: sc.score.confidence };
      if (f.id === "algarrobal") algScore = sc;
    }
    applyLang();
    // Lazy-mount the map after first paint so the hero text is never blocked by the Maps script.
    const mount = () => mountFarmMap(document.getElementById("heroMap"), { farms: site.farms, scores, lang, cfg, onSelect: (id) => { location.href = `/app/?farm=${encodeURIComponent(id)}`; } });
    if ("requestIdleCallback" in window) requestIdleCallback(mount, { timeout: 1200 }); else setTimeout(mount, 200);
  } catch (e) {
    document.getElementById("exCard").innerHTML = `<p class="muted">Could not load data: ${esc(e.message)}</p>`;
  }
})();
