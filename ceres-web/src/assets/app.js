// /app — Google Maps field dashboard + field drawer (spec: mentor/farm-map-x402-plan.md §1–§3).
import { loadSite, scoreFor, band, fmt, L, esc, periodLabel, rankStrategies, verifyOnChain } from "./data.js";
import { mountFarmMap } from "./maps.js";
import { mountCeres, stopCeres } from "./ceres-chat.js";

const cfg = window.CERES_CONFIG ?? {};
const T = {
  es: {
    title: "Mapa de chacras", ceres: "Hablar con CERES", pick: "Elige una chacra en el mapa para ver su puntaje, sus opciones de rotación y su registro.",
    howTitle: "Cómo usar CERES", howSteps: ["Elige una chacra en el mapa (los puntos con número).", "Lee su puntaje de 0 a 100, calculado con datos de la NASA.", "Compara 4 opciones con tus prioridades y mira cómo le fue a cada una en 45 temporadas pasadas.", "Pregúntale a CERES en voz alta, en español."],
    whoTitle: "¿Para quién es?", who: [["Agricultores", "Gratis, sin cuenta ni billetera."], ["Agrónomos, Agencia Agraria e INIA", "Cada número muestra su fuente NASA y su confianza."], ["Cooperativas y aseguradoras", "Compran la evidencia completa por registro con x402 y la verifican en Avalanche Fuji."]],
    start: "Empezar con El Algarrobal", askTitle: "Pregúntale a CERES", scoreHint: "De 0 a 100, calculado con datos de la NASA. Más alto = chacra más sana y con menos riesgo.",
    close: "Cerrar", month: "Mes", score: "Puntaje de la parcela", of: "de 100", conf: { low: "confianza baja", medium: "confianza media" },
    why: "Por qué la confianza es baja", gaps: "Vacíos de datos", comps: { water: "Agua", vegetation: "Vegetación", soil: "Suelo*", climate: "Clima (helada)", erosion: "Erosión" },
    soilNote: "*Suelo: ISRIC SoilGrids 2.0, modelo de aprendizaje automático, no es un producto NASA. Índice interno, no es un análisis de laboratorio.",
    disclaimer: "Índice de apoyo a decisiones (anclas en borrador). No es una calificación de crédito ni de seguro, ni predice rendimiento. Apoya, no reemplaza, el criterio del agricultor.",
    strat: "Opciones de rotación y manejo", pri: "Mueve las barras según lo que más te importa: la opción nº 1 cambia al instante.", priW: "Agua", priS: "Suelo", priI: "Ingreso",
    engine: "Recomendada por el motor", current: "Actual", whyL: "Por qué", evL: "Evidencia", gapsL: "Vacíos", risksL: "Riesgos", mainRisk: "Riesgo principal",
    water: "Agua", soilIdx: "Suelo", income: "Ingreso", vsCur: "vs actual", unitM3: "m³/ha/año", unitIdx: "índice (dato de ejemplo)",
    season: "Temporada (12 meses)", bare: "suelo desnudo (NDVI < umbral)", frost: "≥5 días con helada (<2 °C)", ndvi: "verdor NDVI",
    record: "Registro verificable", anchored: "Quedó un registro verificable de este puntaje y de la evidencia. Cualquiera puede comprobar que esos datos no se cambiaron.",
    notAnchored: "Aún no anclado. La evidencia ya tiene su huella; falta guardarla en el registro.", checking: "Comprobando registro…", noReg: "Registro aún no desplegado.",
    seeRecord: "Ver registro", fingerprint: "Huella de la evidencia", full: "Análisis completo (panel anterior)",
    pixel: "píxel de cultivo (provisional; confirmar con el agricultor)", apppt: "punto de la app", judges: "Para jurados / API",
    loadErr: "No se pudieron cargar los datos.",
  },
  en: {
    title: "Field map", ceres: "Talk to CERES", pick: "Pick a field on the map to see its score, rotation options and record.",
    howTitle: "How to use CERES", howSteps: ["Pick a field on the map (the numbered pins).", "Read its 0–100 score, computed from NASA data.", "Compare 4 options with your priorities and see how each held up over 45 past seasons.", "Ask CERES out loud, in Spanish or English."],
    whoTitle: "Who it is for", who: [["Farmers", "Free, no account, no wallet."], ["Agronomists, Agencia Agraria and INIA", "Every number shows its NASA source and confidence."], ["Co-ops and insurers", "Buy the full evidence per record with x402 and verify it on Avalanche Fuji."]],
    start: "Start with El Algarrobal", askTitle: "Ask CERES", scoreHint: "0–100, computed from NASA data. Higher means a healthier field with fewer risks.",
    close: "Close", month: "Month", score: "Field score", of: "of 100", conf: { low: "low confidence", medium: "medium confidence" },
    why: "Why confidence is low", gaps: "Data gaps", comps: { water: "Water", vegetation: "Vegetation", soil: "Soil*", climate: "Climate (frost)", erosion: "Erosion" },
    soilNote: "*Soil: ISRIC SoilGrids 2.0, a machine-learning model, not a NASA product. Internal index, not a lab analysis.",
    disclaimer: "Decision-support index (draft anchors). Not a credit or insurance rating and not a yield prediction. Supports, does not replace, farmer judgment.",
    strat: "Rotation and management options", pri: "Move the sliders to what matters most to you: the #1 option updates instantly.", priW: "Water", priS: "Soil", priI: "Income",
    engine: "Engine's pick", current: "Current", whyL: "Why", evL: "Evidence", gapsL: "Gaps", risksL: "Risks", mainRisk: "Main risk",
    water: "Water", soilIdx: "Soil", income: "Income", vsCur: "vs current", unitM3: "m³/ha/yr", unitIdx: "index (example data)",
    season: "Season (12 months)", bare: "bare soil (NDVI < threshold)", frost: "≥5 frost days (<2 °C)", ndvi: "NDVI greenness",
    record: "Verifiable record", anchored: "A verifiable record of this score's evidence was saved. Anyone can check the data was not changed.",
    notAnchored: "Not anchored yet. The evidence already has its fingerprint; it still has to be written to the registry.", checking: "Checking record…", noReg: "Registry not deployed yet.",
    seeRecord: "View record", fingerprint: "Evidence fingerprint", full: "Full analysis (previous dashboard)",
    pixel: "cultivation pixel (provisional; confirm with the farmer)", apppt: "app point", judges: "For judges / API",
    loadErr: "Could not load the data.",
  },
};

const LS = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const state = { lang: LS.get("ceres.lang") || "es", farm: null, period: null, pri: null, site: null, scores: {}, map: null, btStrat: null };
const $ = (s) => document.querySelector(s);
const t = () => T[state.lang];
const MONTHS = { es: ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"], en: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"] };

function applyChrome() {
  document.documentElement.lang = state.lang;
  $("#lang").textContent = state.lang === "es" ? "EN" : "ES";
  document.querySelectorAll("[data-t]").forEach(el => { el.textContent = t()[el.dataset.t]; });
  document.title = `Ceres · ${t().title}`;
}

function renderFarmbar() {
  $("#farmbar").innerHTML = state.site.farms.map(f => {
    const s = state.scores[f.id];
    return `<button type="button" data-id="${esc(f.id)}" aria-pressed="${state.farm === f.id}"><span class="badge ${band(s?.score)}">${s?.score ?? "—"}</span>${esc(L(f.place, state.lang).split(" · ")[0])}</button>`;
  }).join("");
  $("#farmbar").querySelectorAll("button").forEach(b => b.addEventListener("click", () => openFarm(b.dataset.id)));
}

async function mountMap() {
  state.map = await mountFarmMap($("#map"), {
    farms: state.site.farms, scores: state.scores, lang: state.lang, cfg, onSelect: openFarm,
    padding: () => (matchMedia("(max-width:900px)").matches ? 40 : { top: 70, left: 40, right: 40, bottom: 40 }),
  });
  if (state.farm) state.map.select?.(state.farm);
}

function sources(list) {
  return (list ?? []).map(c => `<span class="chip" title="${esc(c.name)}"><b>${esc(c.name)}</b>${c.detail ? ` ${esc(c.detail)}` : ""}</span>`).join("");
}

function scoreSection(sc) {
  const s = sc.score, tt = t();
  const bars = Object.entries(s.components).map(([k, c]) =>
    `<div class="bar"><span>${esc(tt.comps[k] ?? k)}</span><div class="track" role="img" aria-label="${esc(tt.comps[k] ?? k)}: ${c.value} / 100"><div class="fill" style="width:${Math.max(0, Math.min(100, c.value))}%"></div></div><span class="v">${fmt(c.value, 1, state.lang)}</span></div>`).join("");
  const missing = ["water", "vegetation", "soil", "climate", "erosion"].filter(k => !s.components[k]);
  return `<section class="dsec" aria-labelledby="h-score"><h2 id="h-score">${tt.score}</h2>
    <p style="margin:-4px 0 10px"><small class="muted">${tt.scoreHint}</small></p>
    <div class="scorehead"><span class="badge ${band(s.score)}" aria-label="${tt.score} ${s.score} ${tt.of}">${s.score ?? "—"}</span>
      <div><span class="pill ${s.confidence === "low" ? "low" : "med"}">${esc(tt.conf[s.confidence] ?? s.confidence)}</span><br>
      <small>${tt.of} · <span class="mono">${esc(s.formulaVersion)}</span> · ${esc(periodLabel(s.period, state.lang))}</small></div></div>
    <div class="bars" style="margin-top:14px">${bars}</div>
    ${missing.length ? `<p class="note warnbox" style="margin-top:10px"><small>${state.lang === "es" ? "Sin dato este mes" : "No data this month"}: ${missing.map(k => esc(tt.comps[k])).join(", ")}. ${state.lang === "es" ? "Los pesos se reparten entre los demás componentes." : "Weights are spread over the other components."}</small></p>` : ""}
    <div class="chips">${sources(s.sources)}</div>
    ${s.confidenceReasons.length ? `<details class="gaps"><summary>${tt.why} (${s.confidenceReasons.length})</summary><ul>${s.confidenceReasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul></details>` : ""}
    <details class="gaps"><summary>${tt.gaps} (${s.gaps.length})</summary><ul>${s.gaps.map(g => `<li>${esc(g)}</li>`).join("")}</ul></details>
    <p><small class="dim">${tt.soilNote}</small></p><p><small class="dim">${tt.disclaimer}</small></p>
  </section>`;
}

function strategiesSection(farmId) {
  const S = state.site.strategies[farmId], tt = t();
  if (!S) return "";
  state.pri ??= { water: S.defaultPriorities.water, soil: S.defaultPriorities.soil, income: S.defaultPriorities.income };
  const ranked = rankStrategies(S.list, state.pri);
  const cur = S.list.find(s => s.current);
  const unit = S.unit === "m3_ha_yr" ? tt.unitM3 : tt.unitIdx;
  const slider = (k, label) => `<label class="slider"><span>${label}</span><input type="range" min="0" max="100" step="5" value="${Math.round(state.pri[k] * 100)}" data-k="${k}" aria-label="${label}"><span class="mono" data-v="${k}">${Math.round(state.pri[k] * 100)}</span></label>`;
  const cards = ranked.map((s, i) => {
    const pct = cur && !s.current && S.unit === "m3_ha_yr" ? ((s.water - cur.water) / cur.water) * 100 : null;
    return `<article class="strat ${i === 0 ? "top" : ""}">
      <h3><span class="rank">${i + 1}</span>${esc(L(s.name, state.lang))}
        ${s.current ? `<span class="pill">${tt.current}</span>` : ""}${S.engine?.pick === s.id ? `<span class="pill ok">${tt.engine}</span>` : ""}</h3>
      <div class="kpis"><span>${tt.water}: <b>${fmt(s.water, 0, state.lang)}</b> ${unit}${pct != null ? ` <span class="${pct <= 0 ? "" : "dim"}">(${pct > 0 ? "+" : ""}${fmt(pct, 1, state.lang)}% ${tt.vsCur})</span>` : ""}</span>
        <span>${tt.soilIdx}: <b>${s.soil}</b>/100</span><span>${tt.income}: <b>${s.income}</b>/5</span></div>
      <dl><dt>${tt.whyL}</dt><dd>${esc(L(s.why, state.lang))}</dd><dt>${tt.evL}</dt><dd>${esc(L(s.evidence, state.lang))}</dd>
        <dt>${tt.gapsL}</dt><dd>${esc(L(s.gaps, state.lang))}</dd><dt>${tt.risksL}</dt><dd>${esc(L(s.risks, state.lang))}</dd>
        <dt>${tt.mainRisk}</dt><dd>${esc(L(s.mainRisk, state.lang))}</dd></dl>
    </article>`;
  }).join("");
  return `<section class="dsec" aria-labelledby="h-strat"><h2 id="h-strat">${tt.strat}</h2>
    <p><small class="muted">${tt.pri}</small></p>
    <div class="sliders" id="sliders">${slider("water", tt.priW)}${slider("soil", tt.priS)}${slider("income", tt.priI)}</div>
    <div id="cards">${cards}</div>
    ${disagree(S, ranked)}
    <p><small class="dim">${esc(S.waterSource)}</small></p>
    ${S.engine?.confidence ? `<p><small class="dim">${state.lang === "es" ? "Confianza del motor" : "Engine confidence"}: ${esc(S.engine.confidence)}${S.engine.basis ? ` · ${esc(S.engine.basis)}` : ""}</small></p>` : ""}
  </section>`;
}

// When the slider ranking and the SI engine's pick differ, say so instead of showing two silent "winners".
function disagree(S, ranked) {
  const pick = S.engine?.pick && S.list.find(s => s.id === S.engine.pick);
  if (!pick || ranked[0]?.id === pick.id) return "";
  const a = esc(L(ranked[0].name, state.lang)), b = esc(L(pick.name, state.lang));
  return `<p class="note" style="margin:4px 0 10px"><small>${state.lang === "es"
    ? `Con tus prioridades, la nº 1 es <b>${a}</b>. El motor SI sugiere <b>${b}</b> porque también pesa el déficit hídrico y el riesgo modelados, que no salen en estas tarjetas. Las cifras de esta chacra aún son datos de ejemplo: revísalo con la Agencia Agraria o el INIA.`
    : `With your priorities, #1 is <b>${a}</b>. The SI engine suggests <b>${b}</b> because it also weighs modelled water deficit and risk, which these cards don't show. This field's figures are still example data: check with the Agencia Agraria or INIA.`}</small></p>`;
}

// 1981–2025 backtest (Kepler): a model hindcast on NASA POWER daily, labelled as such. Hidden if the file is missing.
function backtestSection(farmId) {
  const B = state.site.backtest, F = B?.farms?.[farmId], es = state.lang === "es";
  if (!F) return "";
  const S = state.site.strategies[farmId];
  const order = (S?.list ?? []).map(s => s.id).filter(id => F.strategies[id]);
  const ids = order.length ? order : Object.keys(F.strategies);
  const sel = F.strategies[state.btStrat] ? state.btStrat : (ids.find(id => F.strategies[id].recommended) ?? ids[0]);
  const s = F.strategies[sel];
  const maxN = Math.max(...ids.map(id => F.strategies[id].seasons));
  const rows = ids.map(id => {
    const x = F.strategies[id];
    return `<tr class="${id === sel ? "on" : ""}" data-bt="${esc(id)}" tabindex="0" role="button" aria-pressed="${id === sel}">
      <td>${esc(L(x.name, state.lang))}${x.current ? ` <span class="pill">${es ? "Actual" : "Current"}</span>` : ""}${x.recommended ? ` <span class="pill ok">${es ? "Motor SI" : "SI engine"}</span>` : ""}</td>
      <td class="bn"><b>${x.failAny}</b><span class="dim"> / ${x.seasons}</span></td><td class="bn">${x.stress ?? "—"}</td><td class="bn">${x.worstSeason ? `${esc(x.worstSeason)}<br><span class="dim">WRSI ${fmt(x.worstWrsi, 1, state.lang)}</span>` : "—"}</td></tr>`;
  }).join("");
  const cell = ([lab, w, fail, e]) => {
    const v = Math.max(0, Math.min(1, (w ?? 0) / 110));
    const bg = fail ? "var(--coral)" : (w ?? 0) < 80 ? "var(--amber)" : `hsl(${Math.round(150 + v * 20)} 55% ${Math.round(24 + v * 22)}%)`;
    return `<i class="${e === "n" ? "nino" : ""}" style="background:${bg}" title="${esc(lab)} · WRSI ${w ?? "—"}${fail ? (es ? " · falla" : " · failure") : ""}${e === "n" ? " · El Niño" : e === "l" ? " · La Niña" : ""}"></i>`;
  };
  const en = s.enso ?? {}, ph = (k) => en[k] ? `${es ? { el_nino: "El Niño", neutral: "neutral", la_nina: "La Niña" }[k] : { el_nino: "El Niño", neutral: "neutral", la_nina: "La Niña" }[k]}: ${en[k].fail}/${en[k].n} ${es ? "con falla" : "failed"}, WRSI ${fmt(en[k].medianWrsi, 1, state.lang)}` : "";
  const p = s.tests?.mannWhitneyP;
  const raw = F.rawTminFrost?.[sel];
  const metric = F.metric === "wrsi_anomaly" ? (es ? "WRSI como % de lo normal del cultivo (1991–2020)" : "WRSI as % of the crop's normal (1991–2020)") : (es ? "WRSI: agua del cultivo cubierta por lluvia + dotación de riego modelada" : "WRSI: crop water met by rain + modelled irrigation allotment");
  const stories = (B.namedYears ?? []).map(n => `<li><b>${esc(n.title)}</b><br>${esc(L(n.text, state.lang))}</li>`).join("");
  return `<section class="dsec" aria-labelledby="h-bt"><h2 id="h-bt">${es ? `${maxN} temporadas · 1981–2025` : `${maxN} seasons · 1981–2025`}</h2>
    <p class="bt-label">${esc(L(B.label, state.lang))}</p>
    <p class="muted" style="margin:.2em 0 10px;font-size:.88rem">${es ? "Cada opción pasada por cada temporada desde 1981 con datos diarios de NASA POWER: ¿cuántas veces habría fallado el cultivo?" : "Every option replayed through every season since 1981 with NASA POWER daily data: how often would the crop have failed?"}</p>
    <div class="bt-wrap"><table class="bt"><thead><tr><th>${es ? "Opción" : "Option"}</th><th class="bn">${es ? "Fallas" : "Failures"}</th><th class="bn">${es ? "Estrés" : "Stress"}</th><th class="bn">${es ? "Peor año" : "Worst year"}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p style="margin:12px 0 4px;font-size:.86rem"><b>${esc(L(s.name, state.lang))}</b> · ${s.first}–${s.last}</p>
    <div class="bt-strip" role="img" aria-label="${es ? "WRSI por temporada" : "WRSI by season"}">${s.strip.map(cell).join("")}</div>
    <div class="bt-axis"><span>${esc(s.first)}</span><span>${esc(s.last)}</span></div>
    <div class="legend"><span><i class="sw" style="background:var(--coral)"></i>${es ? "falla (WRSI < 50)" : "failure (WRSI < 50)"}</span><span><i class="sw" style="background:var(--amber)"></i>${es ? "estrés (< 80)" : "stress (< 80)"}</span><span><i class="sw nino"></i>El Niño</span></div>
    <p class="note" style="margin-top:10px"><small>${[ph("el_nino"), ph("neutral"), ph("la_nina")].filter(Boolean).join(" · ")}${p != null ? ` · ${es ? "WRSI El Niño vs resto" : "WRSI El Niño vs rest"}: Mann-Whitney p = ${p}` : ""}</small></p>
    ${raw && raw.frost > 0 && s.failFrost === 0 ? `<p><small class="muted">${es ? `Sin corregir la temperatura por altitud, la celda de POWER habría marcado helada en ${raw.frost} de ${raw.seasons} temporadas; corregida (y según ERA5-Land) son ${s.failFrost}.` : `Without the altitude correction, the POWER cell would flag frost in ${raw.frost} of ${raw.seasons} seasons; corrected (and per ERA5-Land) it is ${s.failFrost}.`}</small></p>` : ""}
    <details class="gaps"><summary>${es ? "Años El Niño con nombre (3)" : "Named El Niño years (3)"}</summary><ul class="bt-stories">${stories}</ul></details>
    <details class="gaps"><summary>${es ? "Método y límites" : "Method and limits"}</summary><p style="margin:.4rem 0 0"><small class="muted">${esc(metric)}. ${esc(L(B.seasonsNote, state.lang))} ${esc(L(B.method, state.lang))}</small></p></details>
    <p><small class="dim">${es ? "Fuente" : "Source"}: ${esc(B.source)}</small></p>
  </section>`;
}

function seasonSection(farmId) {
  const s = state.site.season[farmId], tt = t();
  if (!s) return "";
  const color = (v) => {
    if (v == null) return "#16323b";
    const x = Math.max(0, Math.min(1, (v - 0.05) / 0.65));
    return `hsl(${Math.round(30 + x * 130)} ${Math.round(45 + x * 20)}% ${Math.round(22 + x * 22)}%)`;
  };
  const cells = s.ndviS2.map((v, i) => {
    const bare = v != null && v < s.bareThreshold, fr = (s.frostLt2?.[i] ?? 0) >= 5;
    return `<div><div class="m ${bare ? "bare" : ""}" style="background:${color(v)}" title="${MONTHS.en[i]} · NDVI ${v ?? "—"}${fr ? ` · ${s.frostLt2[i]} d <2 °C` : ""}">${fr ? '<span class="fz" aria-hidden="true">❄</span>' : ""}</div><div class="lbl">${MONTHS[state.lang][i]}</div></div>`;
  }).join("");
  return `<section class="dsec" aria-labelledby="h-season"><h2 id="h-season">${tt.season}</h2>
    <div class="season" role="img" aria-label="${tt.season}">${cells}</div>
    <div class="legend"><span>▮ ${tt.ndvi}</span><span style="color:var(--amber)">▢ ${tt.bare} (${s.bareThreshold})</span><span>❄ ${tt.frost}</span></div>
    <p><small class="dim">${esc(s.source)}</small></p></section>`;
}

function recordSection(sc) {
  const tt = t(), key = `${sc.farm.id}/${sc.meta.period}`, att = state.site.index.attestations?.[key];
  const tx = att?.tx ? `<a href="${esc(cfg.explorer)}/tx/${esc(att.tx)}" target="_blank" rel="noopener">Snowtrace ↗</a>` : "";
  return `<section class="dsec" aria-labelledby="h-rec"><h2 id="h-rec">${tt.record}</h2>
    <div class="record"><span class="ic" id="recIc" aria-hidden="true">◌</span><div><p id="recTxt">${cfg.registry ? tt.checking : tt.noReg}</p>
      <p><small class="muted">${tt.fingerprint}: <span class="mono">${esc(sc.meta.dataHash.slice(0, 18))}…</span></small> ${tx}
      · <a href="/verify/${esc(sc.meta.dataHash)}">${tt.seeRecord}</a></p>${superseded(key)}</div></div></section>`;
}

function superseded(key) {
  const o = state.site.index.supersededAttestations?.[key];
  if (!o?.tx) return "";
  return `<p><small class="dim">${state.lang === "es"
    ? `Una revisión anterior de este mes (otra huella) quedó registrada en <a href="${esc(cfg.explorer)}/tx/${esc(o.tx)}" target="_blank" rel="noopener">Snowtrace ↗</a>. El registro se corrigió (lluvia GPM IMERG en lugar de CHIRPS); la nueva revisión aún no se ancla.`
    : `An earlier revision of this month (different fingerprint) was recorded in <a href="${esc(cfg.explorer)}/tx/${esc(o.tx)}" target="_blank" rel="noopener">Snowtrace ↗</a>. The record was corrected (GPM IMERG rain instead of CHIRPS); the new revision is not anchored yet.`}</small></p>`;
}

async function checkRecord(sc) {
  const tt = t();
  if (!cfg.registry) { $("#recIc").textContent = "◌"; $("#recTxt").textContent = tt.noReg + " " + tt.notAnchored; return; }
  const r = await verifyOnChain(cfg, state.site.index, sc.farm.id, sc.meta.period, sc.meta.dataHash);
  if (state.farm !== sc.farm.id) return;
  if (r.status === "anchored") { $("#recIc").textContent = "✓"; $("#recIc").style.color = "var(--ok)"; $("#recTxt").textContent = tt.anchored; }
  else { $("#recIc").textContent = "◌"; $("#recTxt").textContent = tt.notAnchored; }
}

// First screen of the map: how to use it and who it is for (matches the project write-up).
function emptyState() {
  const tt = t();
  return `<div class="inner onboard"><h1>${tt.howTitle}</h1>
    <ol class="howsteps">${tt.howSteps.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
    <button class="btn" type="button" data-start>${tt.start} →</button>
    <h2 style="margin-top:26px">${tt.whoTitle}</h2>
    <ul class="who">${tt.who.map(([h, b]) => `<li><b>${esc(h)}</b><span>${esc(b)}</span></li>`).join("")}</ul></div>`;
}
document.addEventListener("click", (e) => { if (e.target.closest?.("[data-start]")) openFarm("algarrobal"); });

async function renderDrawer() {
  const tt = t(), f = state.site.farms.find(x => x.id === state.farm);
  if (!f) { $("#drawer").innerHTML = emptyState(); return; }
  const sc = await scoreFor(state.site.index, f.id, state.period);
  const periods = state.site.index.farms[f.id].periods.map(p => p.period).reverse();
  const coords = `${f.marker.lat.toFixed(4)}, ${f.marker.lon.toFixed(4)}`;
  $("#drawer").innerHTML = `<div class="inner">
    <div class="dhead"><div><p class="eyebrow" style="margin:0 0 4px">${esc(L(f.place, state.lang))}</p><h1>${esc(L(f.label, state.lang))}</h1>
      <p class="muted" style="margin:.2em 0">${esc(L(f.crop, state.lang))} · ${fmt(f.ha, 1, state.lang)} ha · ${fmt(f.elevation_m, 0, state.lang)} m</p>
      <p><small class="dim">${f.marker.kind === "field_pixel" ? esc(tt.pixel) : esc(tt.apppt)}: <span class="mono">${coords}</span></small></p></div>
      <button class="close" type="button" id="close" aria-label="${tt.close}">✕</button></div>
    <label style="display:block;margin-top:10px;font-size:.85rem" class="muted">${tt.month}
      <select id="period" style="margin-left:6px;background:var(--panel);color:var(--ink);border:1px solid var(--line2);border-radius:8px;padding:5px 8px;font:inherit">
        ${periods.map(p => `<option value="${p}" ${p === sc.meta.period ? "selected" : ""}>${esc(periodLabel(p, state.lang))}</option>`).join("")}</select></label>
    ${/PENDING|PARTIAL/i.test(f.fieldPixelStatus ?? "") ? `<p class="note warnbox" style="margin-top:12px"><small>${esc(f.fieldPixelStatus)}</small></p>` : ""}
    ${scoreSection(sc)}
    ${strategiesSection(f.id)}
    <section class="dsec" id="ceres" aria-labelledby="h-ceres"><h2 id="h-ceres">${tt.askTitle}</h2><div id="ceres-chat"></div>
      <p style="margin-top:10px"><small><a href="/legacy/?farm=${esc(f.id)}">${tt.full}</a>${state.lang === "en" ? ` · <a href="/pagar/">${tt.judges} →</a> · <a href="/api-docs/">API docs</a>` : ""}</small></p></section>
    ${backtestSection(f.id)}
    ${seasonSection(f.id)}
    ${recordSection(sc)}
  </div>`;
  $("#close").addEventListener("click", () => openFarm(null));
  $("#period").addEventListener("change", (e) => { state.period = Number(e.target.value); renderDrawer(); });
  $("#sliders")?.querySelectorAll("input").forEach(inp => inp.addEventListener("input", () => {
    state.pri[inp.dataset.k] = Number(inp.value) / 100;
    $(`[data-v="${inp.dataset.k}"]`).textContent = inp.value;
    const S = state.site.strategies[f.id];
    const tmp = document.createElement("div"); tmp.innerHTML = strategiesSection(f.id);
    $("#cards").innerHTML = tmp.querySelector("#cards").innerHTML;
    void S;
    mountCeresFor(f, sc);
  }));
  mountCeresFor(f, sc);
  wireBacktest(f.id);
  checkRecord(sc);
}

function wireBacktest(farmId) {
  document.querySelectorAll("[data-bt]").forEach(tr => {
    const pick = () => {
      state.btStrat = tr.dataset.bt;
      const sec = document.getElementById("h-bt")?.closest("section");
      if (!sec) return;
      const tmp = document.createElement("div"); tmp.innerHTML = backtestSection(farmId);
      const open = sec.querySelector("details")?.open;
      sec.replaceWith(tmp.firstElementChild);
      if (open) document.getElementById("h-bt")?.closest("section")?.querySelector("details")?.setAttribute("open", "");
      wireBacktest(farmId);
    };
    tr.addEventListener("click", pick);
    tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
  });
}

// CERES in the drawer, pre-loaded with the open farm's score and the #1 option the farmer sees with their sliders.
function mountCeresFor(f, sc) {
  const el = document.getElementById("ceres-chat");
  if (!el) return;
  mountCeres(el, { farmId: f.id, lang: state.lang, ctx: () => {
    const S = state.site.strategies[f.id];
    const top = S ? rankStrategies(S.list, state.pri ?? S.defaultPriorities)[0] : null;
    return { farmName: L(f.label, state.lang), score: sc.score.score, confidence: sc.score.confidence, periodLabel: periodLabel(sc.meta.period, state.lang),
      topOption: top ? L(top.name, state.lang) : "—", enginePick: S?.engine?.pick && top?.id !== S.engine.pick ? L(S.list.find(x => x.id === S.engine.pick)?.name, state.lang) : null,
      priorities: state.pri ? { water: state.pri.water, soil: state.pri.soil, income: state.pri.income } : null };
  } });
}

function openFarm(id) {
  if (id !== state.farm) { stopCeres(); state.btStrat = null; }
  state.farm = id; state.period = null; state.pri = null;
  const url = new URL(location.href);
  if (id) url.searchParams.set("farm", id); else url.searchParams.delete("farm");
  history.replaceState(null, "", url);
  renderFarmbar();
  if (id) state.map?.select?.(id); else state.map?.fit?.();
  renderDrawer().catch(e => { $("#drawer").innerHTML = `<div class="empty">${t().loadErr} ${esc(e.message)}</div>`; });
  if (id && matchMedia("(max-width:900px)").matches) $("#drawer").scrollIntoView({ behavior: "smooth", block: "start" });
}

// Nav "Talk to CERES": open a field if none is open (El Algarrobal, the anchored one), then jump to CERES in the drawer.
document.querySelector("[data-ceres-nav]")?.addEventListener("click", async (e) => {
  e.preventDefault();
  if (!state.site) return;
  if (!state.farm) openFarm("algarrobal");
  for (let i = 0; i < 40 && !document.getElementById("ceres-chat")?.childElementCount; i++) await new Promise(r => setTimeout(r, 50));
  document.getElementById("ceres")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#lang").addEventListener("click", async () => {
  state.lang = state.lang === "es" ? "en" : "es"; LS.set("ceres.lang", state.lang);
  applyChrome(); renderFarmbar(); renderDrawer();
});

(async function init() {
  applyChrome();
  try {
    state.site = await loadSite();
    for (const f of state.site.farms) {
      const sc = await scoreFor(state.site.index, f.id);
      state.scores[f.id] = { score: sc.score.score, confidence: sc.score.confidence };
    }
  } catch (e) { $("#drawer").innerHTML = `<div class="empty">${t().loadErr} ${esc(e.message)}</div>`; return; }
  const q = new URLSearchParams(location.search).get("farm");
  const alias = { "el-algarrobal": "algarrobal" };
  state.farm = q ? (alias[q] ?? q) : null;
  renderFarmbar();
  if (state.farm) renderDrawer(); else $("#drawer").innerHTML = emptyState();
  await mountMap();
})();
