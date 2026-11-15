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
  "hero.open": "Abrir el mapa", "hero.ceres": "Hablar con CERES", "hero.buyers": "Para compradores", "trust.imerg": "Late Run",
  "trust.pending": "pendiente",
  "prob.eyebrow": "El problema", "prob.h2": "Falta agua, el suelo está cansado y un solo cultivo carga todo el riesgo.",
  "how.eyebrow": "Cómo funciona", "how.h2": "Cuatro pasos, del satélite a una decisión que se puede comprobar.",
  "how.s1h": "Elige una chacra", "how.s1": "Abre el mapa y elige una de las chacras piloto: un olivar en la costa de Ilo, alfalfa en Samegua o papa en la zona alta de Carumas.",
  "how.s2h": "Lee su puntaje", "how.s2": "El Puntaje Ceres combina agua, vegetación, suelo, clima y erosión de conjuntos de datos NASA y aliados con nombre propio, y muestra su incertidumbre.",
  "how.s3h": "Compara opciones", "how.s3": "Mira cuatro rotaciones o formas de manejo, incluida la actual, ordénalas según tus prioridades y mira cómo le fue a cada una en 45 temporadas pasadas.",
  "how.s4h": "Pregúntale a CERES", "how.s4": "Toca «Hablar con CERES» y pregunta en voz alta, en español. Responde con los mismos datos de la NASA y te recuerda revisarlo con la Agencia Agraria o el INIA.",
  "who.eyebrow": "¿Para quién es?", "who.h2": "Gratis para el agricultor, verificable para todos.",
  "who.lead": "En El Algarrobal, CERES recomienda riego por goteo con cobertura en franjas: los mismos olivos con alrededor de una cuarta parte menos de agua. Repetido en 45 años de clima de la NASA, superó 44 de 45 temporadas, más que el riego por gravedad actual (43 de 45).",
  "who.f.h": "Agricultores", "who.f.p": "Abre el mapa en tu celular, elige tu chacra y pregúntale a CERES en voz alta. Sin cuenta, sin billetera, sin costo.", "who.f.cta": "Abrir el mapa",
  "who.a.h": "Agrónomos, Agencia Agraria e INIA", "who.a.p": "Revisa las cuatro opciones con el agricultor. Cada número indica su fuente NASA, su resolución y su confianza, y los datos de ejemplo están marcados.", "who.a.cta": "Ver el ejemplo en vivo",
  "who.b.h": "Cooperativas, aseguradoras y compradores", "who.b.p": "Compra la evidencia completa de una chacra y un mes con x402: firma en Core Wallet, paga en USDC de prueba en Avalanche Fuji y verifica el registro en la cadena.", "who.b.cta": "Para compradores",
  "ex.eyebrow": "Ejemplo en vivo", "ex.h2": "Olivar de El Algarrobal, calculado desde el archivo de evidencia.",
  "data.eyebrow": "Datos NASA, explicados", "data.h2": "Qué mide cada conjunto de datos y cómo lo usa el puntaje.",
  "data.eco": "Evapotranspiración real (ET) desde la estación espacial. Dividida por la ET₀ de referencia da la parte de estrés hídrico del puntaje.",
  "data.power": "Clima diario desde 1981. Alimenta la ET₀ FAO-56, la climatología de heladas y el modelo de agua 2001–2025 de cada estrategia.",
  "data.hls": "Reflectancia armonizada para el verdor NDVI en el píxel de cultivo, contrastada con Sentinel-2 de la ESA a 10 m.",
  "data.smap": "Humedad del suelo frente a su línea base 2015–2025. Hoy se usa en Carumas; es una señal regional, no una lectura de la chacra.",
  "data.srtm": "Elevación y pendiente alrededor de cada chacra. Junto con la intensidad de lluvias fuertes da un indicador relativo de erosión, no pérdida de suelo.",
  "data.other": "Historia larga de NDVI, lluvia de contraste (CHIRPS, junto a GPM IMERG) y series de helada donde la celda de POWER queda muy alta.",
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
  "road.2": "Lluvia GPM IMERG Final (cuando NASA publique 2026) y su climatología diaria para la erosión; estrés por calor en el puntaje (v2).",
  "road.3": "Más valles de Moquegua, con lindes trazados junto a los agricultores.", "road.4": "Llevar el registro a la L1 de NØFI con gas en stablecoin.",
  "team.eyebrow": "Equipo", "team.lead": "líder del equipo", "team.built": "Hecho en el NASA Space Apps Challenge 2026, evento local de Moquegua.",
  "foot.attr": "Datos: NASA (ECOSTRESS, HLS, SMAP, POWER, MODIS, SRTM, GPM IMERG Late), ESA Copernicus Sentinel-2, ECMWF ERA5-Land, ISRIC SoilGrids, CHIRPS (UCSB CHC). Imágenes del mapa © Google.",
  "foot.nasa": "La NASA no respalda este proyecto. Solo red de prueba: no se mueve dinero real.",
  "foot.ai": "Uso de IA: el equipo usó Claude y otras herramientas de IA para escribir código, procesar datos y redactar textos; el equipo revisó los resultados. CERES usa un modelo de IA para explicar resultados; no cambia los datos.",
  "foot.verify": "Verificar un registro",
  "nav.pricing": "Precios y acceso", "buy.cta2": "Ver precios y acceso",
  "ex.h2": "Olivar de El Algarrobal, calculado desde su registro de evidencia NASA.",
  "pr.eyebrow": "Precios y acceso", "pr.h2": "Gratis para agricultores. Diseñado para instituciones.",
  "pr.lead": "CERES mantiene accesible la información útil para el campo. Las empresas pagan por acceso API estructurado, evidencia verificable detallada e integraciones a medida.",
  "pr.get": "Qué recibes", "pr.how": "Cómo accedes", "pr.demo": "Demo red de prueba Fuji", "pr.unit": "USDC de prueba por consulta",
  "pr.tba": "Precio comercial por anunciar", "pr.try": "Probar demo x402", "pr.api.acc": "Pago por consulta x402 vía HTTPS: sin cuenta ni suscripción.",
  "pr.free.tag": "Gratis", "pr.free.aud": "Agricultores · asesores de campo · cooperativas", "pr.free.h": "Panel agrícola CERES",
  "pr.free.price": "Gratis", "pr.free.pricenote": "panel público, sin billetera ni registro",
  "pr.free.g1": "Mapa interactivo de las chacras piloto", "pr.free.g2": "Puntaje mensual con nivel de confianza y vacíos de datos",
  "pr.free.g3": "Opciones de rotación ordenadas según tus prioridades", "pr.free.g4": "Vista de temporada y comprobación gratuita del registro en cadena",
  "pr.free.acc": "Ábrelo en cualquier navegador, en español o inglés.", "pr.free.cta": "Explorar mapa gratis",
  "pr.api.aud": "Desarrolladores · fintechs · cooperativas", "pr.score.h": "API de puntuación de parcelas",
  "pr.score.g1": "Puntaje legible por máquina para cualquier chacra piloto y mes", "pr.score.g2": "Entradas por componente, pesos y razones de calidad de datos",
  "pr.score.g3": "Huella de la evidencia, prueba en cadena y recibo de pago", "pr.score.cta": "Ver API",
  "pr.ev.aud": "Aseguradoras · auditores · analistas · compradores", "pr.ev.h": "API de evidencia verificable",
  "pr.ev.g1": "El registro de evidencia canónico completo de una chacra y mes", "pr.ev.g2": "Conjuntos de datos fuente, metadatos de observación y procedencia",
  "pr.ev.g3": "El JSON exacto para recalcular su huella y compararla con la de la cadena", "pr.ev.cta": "Ver API de evidencia",
  "pr.ent.tag": "A medida", "pr.ent.aud": "Bancos · aseguradoras · plataformas agrícolas", "pr.ent.h": "Inteligencia CERES para empresas",
  "pr.ent.price": "Propuesta a medida", "pr.ent.pricenote": "definida contigo", "pr.ent.k": "En conversación", "pr.planned": "Planificado",
  "pr.ent.g1": "Integraciones privadas y exportaciones programadas", "pr.ent.g2": "Analítica de cartera sobre muchas chacras", "pr.ent.g3": "Cobertura de chacras más allá del piloto",
  "pr.ent.acc": "Cuéntanos tu caso de uso; te respondemos qué es posible hoy y qué no.", "pr.ent.cta": "Solicitar integración",
  "pr.why": "Los datos de la NASA y de otras fuentes pueden ser públicos. CERES cobra por la ingeniería, la validación, la entrega estandarizada y el análisis con valor agregado, no por ser dueño exclusivo de datos satelitales públicos.",
  "pr.disc.h": "Solo red de prueba.", "pr.disc": "Demostración en la red de prueba Fuji. Los montos son USDC de prueba, no precios comerciales. No hay pagos en producción ni contratos empresariales.",
  "pr.verified": "El flujo de pago x402 ya se completó de punta a punta en Fuji con USDC de prueba.",
  "ent.h": "Solicitar integración", "ent.p": "Para bancos, aseguradoras, plataformas agrícolas y otras instituciones. Leemos cada consulta; nada aquí es un compromiso de nivel de servicio.",
  "ent.name": "Nombre", "ent.email": "Correo de trabajo", "ent.org": "Organización", "ent.use": "Caso de uso", "ent.pick": "Elige uno",
  "ent.u1": "Seguro agrícola", "ent.u2": "Crédito agrícola", "ent.u3": "Cooperativa o junta de riego", "ent.u4": "Plataforma agrícola o producto de datos",
  "ent.u5": "Exportador, ESG o auditoría", "ent.u6": "Otro", "ent.msg": "Mensaje (opcional)",
  "ent.consent": "Acepto que CERES Ventures use estos datos para responder a esta consulta.", "ent.send": "Enviar consulta",
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
    const sup = Object.entries(site.index.supersededAttestations ?? {}).filter(([, r]) => r?.tx);
    const supTxt = sup.map(([k, r]) => `<a class="mono" href="${esc(cfg.explorer)}/tx/${esc(r.tx)}" target="_blank" rel="noopener">${esc(k)} rev ${esc(r.revision ?? 0)} ↗</a>`).join(", ");
    el.innerHTML = `<p class="muted">${sup.length
      ? (lang === "es" ? `Los registros se corrigieron con lluvia GPM IMERG; la nueva revisión aún no se ancla en Fuji. Revisión anterior anclada: ${supTxt}. Huellas actuales:` : `Records were corrected with GPM IMERG rain; the new revision is not anchored on Fuji yet. Earlier anchored revision: ${supTxt}. Current fingerprints:`)
      : (lang === "es" ? "El primer registro en Fuji está pendiente. Las huellas ya están calculadas:" : "The first Fuji record is pending. Fingerprints are already computed:")}</p>
      <table class="t"><thead><tr><th>${lang === "es" ? "Chacra" : "Field"}</th><th>${lang === "es" ? "Mes" : "Month"}</th><th>dataHash</th></tr></thead><tbody>
      ${Object.values(site.index.farms).map(f => { const p = f.periods.at(-1); return `<tr><td>${esc(f.id)}</td><td>${p.period}</td><td><a class="mono" href="/verify/${esc(p.dataHash)}">${esc(p.dataHash.slice(0, 22))}…</a></td></tr>`; }).join("")}</tbody></table>`;
    return;
  }
  el.innerHTML = `<table class="t"><thead><tr><th>${lang === "es" ? "Chacra" : "Field"}</th><th>${lang === "es" ? "Mes" : "Month"}</th><th>Block</th><th>Tx</th></tr></thead><tbody>
    ${rows.map(([k, r]) => { const [farm, period] = k.split("/"); return `<tr><td>${esc(farm)}</td><td>${esc(period)}</td><td>${esc(r.block ?? "—")}</td><td><a class="mono" href="${esc(cfg.explorer)}/tx/${esc(r.tx)}" target="_blank" rel="noopener">${esc(r.tx.slice(0, 14))}…</a></td></tr>`; }).join("")}</tbody></table>`;
}


// Enterprise inquiry → Netlify Forms (form-name "enterprise-inquiry"). Success is shown ONLY on a 2xx answer.
const FMSG = {
  en: { invalid: "Please fill in name, a valid work email, organization, use case and consent.", sending: "Sending…", ok: "Thanks. Your inquiry was received.", err: "We could not send your inquiry right now. Please try again later." },
  es: { invalid: "Completa nombre, un correo de trabajo válido, organización, caso de uso y consentimiento.", sending: "Enviando…", ok: "Gracias. Recibimos tu consulta.", err: "No pudimos enviar tu consulta ahora. Inténtalo más tarde." },
};
const entForm = document.getElementById("entForm");
entForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("entMsg"), m = FMSG[lang] ?? FMSG.en, btn = entForm.querySelector("button[type=submit]");
  const fd = new FormData(entForm);
  if (fd.get("company-website")) return; // honeypot
  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(fd.get("email") ?? ""));
  if (!entForm.checkValidity() || !okEmail) { msg.className = "formmsg err"; msg.textContent = m.invalid; entForm.querySelector(":invalid")?.focus(); return; }
  btn.disabled = true; msg.className = "formmsg"; msg.textContent = m.sending;
  try {
    const r = await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fd).toString() });
    if (!r.ok) throw new Error(String(r.status));
    entForm.reset(); msg.className = "formmsg ok"; msg.textContent = m.ok;
  } catch { msg.className = "formmsg err"; msg.textContent = m.err; }
  finally { btn.disabled = false; }
});

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
