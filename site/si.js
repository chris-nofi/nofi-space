/* CERES Ventures — SI view: compare · trade-offs · risk · uncertainty. Water headline = engine run on the real 2001-2025 climatology (water.expected); bands = Monte Carlo.
   Live from the oracle (POST /v1/si/analyze) when config.oracleUrl is set; otherwise the
   bundled engine results in si-data.js (default priorities, no scenario). */
(() => {
  "use strict";
  const CFG = window.AGUA_CLARA_CONFIG || {};
  const ORACLE = (CFG.oracleUrl || "").replace(/\/$/, "");
  const FX = window.AGUA_SI_FIXTURES || {};
  const DEFAULT_PR = { water: 40, soil: 25, income: 25, resilience: 10 };
  const DEFAULT_CONS = { water: "typical", noDrip: false, noQuinoa: false, noTarwi: false, needsForage: false, soilGoal: "" };
  const S = { tab: "compare", pr: { ...DEFAULT_PR }, cons: { ...DEFAULT_CONS }, sc: { rainPct: 0, tempDeltaC: 0 }, sel: {}, cache: {}, pending: null, err: "", timer: 0 };
  window.AguaClara.voice = window.AguaClara.voice || {};

  const E = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const T = (lang, es, en) => (lang === "es" ? es : en);
  const num = (n, lang, d = 0) => Number(n).toLocaleString(lang === "es" ? "es-PE" : "en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const sign = (n) => (n > 0 ? "+" : "") + Math.round(n);
  const MONTHS = { es: "E F M A M J J A S O N D".split(" "), en: "J F M A M J J A S O N D".split(" ") };
  const HAZ = { frost: ["Helada", "Frost"], heat: ["Calor", "Heat"], water: ["Falta de agua", "Water shortage"], bare: ["Suelo desnudo", "Bare soil"], salinity: ["Salinidad", "Salinity"] };
  const CRIT = { water: ["Agua", "Water"], soil: ["Suelo", "Soil"], income: ["Ingreso", "Income"], resilience: ["Resiliencia", "Resilience"] };
  const consDefault = () => JSON.stringify(S.cons) === JSON.stringify(DEFAULT_CONS);
  const prDefault = () => JSON.stringify(S.pr) === JSON.stringify(DEFAULT_PR);
  const isDefault = () => prDefault() && consDefault() && S.sc.rainPct === 0 && S.sc.tempDeltaC === 0;
  // the engine result depends on the scenario only; priorities and constraints are re-ranked locally (offline too)
  const key = (farm) => `${farm}|${JSON.stringify(S.sc)}`;
  const scenarioDefault = () => S.sc.rainPct === 0 && S.sc.tempDeltaC === 0;

  /* Offline re-rank (Apollo W3). Uses the engine's own criteria (tradeoffs.radar, 0-1 per criterion) and formula
     score = Σ w_k × criterion_k with w = normalized priorities. Farmer constraints adjust it transparently:
     water scarce ×1.5 / secure ×0.6 on the water weight; soil goal +0.08 if the strategy has that soil lever;
     needs forage +0.05 for forage strategies; no buyer −0.15; no drip kit = not eligible as the top pick. */
  function rerank(d, lang) {
    const w = { ...S.pr };
    if (S.cons.water === "scarce") w.water *= 1.5;
    if (S.cons.water === "secure") w.water *= 0.6;
    const tot = Object.values(w).reduce((a, b) => a + b, 0) || 1;
    Object.keys(w).forEach((k) => (w[k] /= tot));
    const byId = Object.fromEntries(d.compare.strategies.map((s) => [s.id, s]));
    const rows = Object.keys(d.tradeoffs.radar).map((id) => {
      const c = d.tradeoffs.radar[id], s = byId[id] || {}, lv = s.soilLevers || [], needs = s.needs || [];
      let score = Object.keys(CRIT).reduce((a, k) => a + w[k] * (c[k] || 0), 0);
      const adj = [], flags = [];
      if (S.cons.soilGoal && lv.includes(S.cons.soilGoal)) { score += 0.08; adj.push(T(lang, "+ meta de suelo", "+ soil goal")); }
      if (S.cons.needsForage && lv.includes("forage")) { score += 0.05; adj.push(T(lang, "+ da forraje", "+ gives forage")); }
      if ((S.cons.noQuinoa && needs.includes("quinoa-buyer")) || (S.cons.noTarwi && needs.includes("tarwi-buyer"))) { score -= 0.15; adj.push(T(lang, "− sin comprador", "− no buyer")); }
      if (S.cons.noDrip && needs.includes("drip-kit")) flags.push(T(lang, "Requiere equipo de goteo que usted marcó que no tiene", "Needs a drip kit you said you don't have"));
      return { id, score: Math.round(score * 1000) / 1000, adj, flags, paretoOptimal: (d.tradeoffs.ranking.find((r) => r.id === id) || {}).paretoOptimal };
    });
    rows.sort((a, b) => (a.flags.length - b.flags.length) || (b.score - a.score));
    const top = rows[0].id;
    const out = { ...d, tradeoffs: { ...d.tradeoffs, ranking: rows, priorities: w }, compare: { ...d.compare, strategies: d.compare.strategies.map((s) => ({ ...s, recommended: s.id === top })) } };
    if (!isDefault() || !d.voice) out.voice = { ...(d.voice || {}), [lang]: { text: localVoice(out, lang) } };
    return out;
  }

  function localVoice(d, lang) {
    const st = d.compare.strategies, cur = st.find((s) => s.current), top = st.find((s) => s.recommended);
    const unit = d.units === "m3" ? T(lang, "m³ por hectárea al año", "m³ per hectare a year") : T(lang, "mm al año", "mm a year");
    const wv = (s) => num(s.water.expected ?? s.water.p50, lang);
    if (!top || top.id === cur.id) return T(lang, `Con tus prioridades, tu práctica actual (${cur.name.es}) sigue siendo la mejor opción. Revísalo con la Agencia Agraria o INIA.`, `With your priorities, your current practice (${cur.name.en}) is still the best option. Review it with the Agencia Agraria or INIA.`);
    return T(lang,
      `Con tus prioridades, la mejor opción es ${top.name.es}: unos ${wv(top)} ${unit} frente a ${wv(cur)} hoy, ${top.deltas.soilPts >= 0 ? "+" : ""}${Math.round(top.deltas.soilPts)} puntos de suelo. Es un apoyo para decidir: revísalo con la Agencia Agraria o INIA.`,
      `With your priorities, the best option is ${top.name.en}: about ${wv(top)} ${unit} versus ${wv(cur)} today, ${top.deltas.soilPts >= 0 ? "+" : ""}${Math.round(top.deltas.soilPts)} soil points. It supports your decision: review it with the Agencia Agraria or INIA.`);
  }

  function baseResult(farm) {
    const live = S.cache[key(farm)];
    if (live) return { data: live, source: "live" };
    if (scenarioDefault() && FX[farm]) return { data: FX[farm], source: prDefault() && consDefault() ? "bundled" : "local" };
    const anyLive = Object.entries(S.cache).filter(([k]) => k.startsWith(farm + "|")).pop();
    if (anyLive) return { data: anyLive[1], source: "stale" };
    return FX[farm] ? { data: FX[farm], source: "bundled" } : null;
  }

  function result(farm, lang) {
    const b = baseResult(farm);
    if (!b) return null;
    return { ...b, data: rerank(b.data, lang || (window.AguaClara.ctx || {}).lang || "es") };
  }

  async function fetchLive(ctx) {
    if (!ORACLE || scenarioDefault()) return;
    const k = key(ctx.farm);
    if (S.cache[k] || S.pending === k) return;
    S.pending = k;
    S.err = "";
    paint(ctx);
    try {
      const body = { farmId: ctx.farm, priorities: Object.fromEntries(Object.entries(S.pr).map(([a, b]) => [a, b / 100])), scenario: S.sc, draws: 200, lang: ctx.lang };
      const r = await fetch(`${ORACLE}/v1/si/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error("http " + r.status);
      S.cache[k] = await r.json();
      window.AguaClara.voice[ctx.farm] = S.cache[k].voice;
    } catch (e) {
      S.err = T(ctx.lang, "No se pudo consultar el oráculo; mostrando el último resultado.", "Couldn't reach the oracle; showing the last result.");
    } finally {
      if (S.pending === k) S.pending = null;
      const cur = window.AguaClara.ctx;
      if (cur.view === "intel") paint(cur);
    }
  }

  // ---------- controls ----------
  function slider(id, label, val, min, max, step, unit, disabled) {
    return `<label class="si-slider" for="si-${id}"><span><b>${label}</b><output id="si-${id}-out">${val}${unit}</output></span>
      <input id="si-${id}" data-si="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}" ${disabled ? "disabled" : ""}></label>`;
  }

  function controls(ctx) {
    const L = ctx.lang, off = !ORACLE;
    const sel = (id, opts) => `<select class="si-select" data-si-cons="${id}">${opts.map(([v, es, en]) => `<option value="${v}" ${S.cons[id] === v ? "selected" : ""}>${T(L, es, en)}</option>`).join("")}</select>`;
    const chk = (id, es, en) => `<label class="si-check"><input type="checkbox" data-si-cons="${id}" ${S.cons[id] ? "checked" : ""}> ${T(L, es, en)}</label>`;
    return `<section class="card si-controls si-controls-3">
      <div class="si-ctl-group"><span class="eyeline">${T(L, "MIS PRIORIDADES", "MY PRIORITIES")}</span>
        ${Object.keys(CRIT).map((k) => slider(k, CRIT[k][L === "es" ? 0 : 1], S.pr[k], 0, 100, 5, "", false)).join("")}
        <p class="si-note">${T(L, "Funciona sin conexión: el ranking se recalcula aquí mismo.", "Works offline: the ranking is recalculated right here.")}</p></div>
      <div class="si-ctl-group"><span class="eyeline">${T(L, "MI SITUACIÓN", "MY SITUATION")}</span>
        <label class="si-slider"><span><b>${T(L, "Agua disponible", "Water available")}</b></span>${sel("water", [["scarce", "Escasa", "Scarce"], ["typical", "Normal", "Typical"], ["secure", "Segura", "Secure"]])}</label>
        <label class="si-slider"><span><b>${T(L, "Lo que más quiero para mi suelo", "My main soil goal")}</b></span>${sel("soilGoal", [["", "Sin preferencia", "No preference"], ["nfix", "Fijar nitrógeno", "Fix nitrogen"], ["cover", "Cubrir el suelo", "Cover the soil"], ["organicMatter", "Más materia orgánica", "More organic matter"], ["erosion", "Frenar la erosión", "Stop erosion"]])}</label>
        ${chk("noDrip", "No tengo equipo de goteo", "I don't have a drip kit")}
        ${chk("noQuinoa", "No tengo comprador de quinua", "No quinoa buyer")}
        ${chk("noTarwi", "No tengo comprador de tarwi", "No tarwi buyer")}
        ${chk("needsForage", "Necesito forraje para mis animales", "I need forage for my animals")}
        <button type="button" class="text-btn" data-si-reset>${T(L, "Restablecer", "Reset")}</button></div>
      <div class="si-ctl-group"><span class="eyeline">${T(L, "¿Y SI…?", "WHAT IF…?")}</span>
        ${slider("rainPct", T(L, "Lluvia", "Rain"), S.sc.rainPct, -50, 50, 5, "%", off)}
        ${slider("tempDeltaC", T(L, "Calentamiento", "Warming"), S.sc.tempDeltaC, 0, 3, 0.5, " °C", off)}
        ${off ? `<p class="si-note">${T(L, "Los escenarios de lluvia y calor vuelven a correr el motor: necesitan el oráculo (config.js).", "Rain and warming scenarios re-run the engine: they need the oracle (config.js).")}</p>` : ""}
      </div></section>
      <div class="si-tabs" role="tablist">${[["compare", T(L, "Comparar", "Compare")], ["tradeoffs", T(L, "Compensaciones", "Trade-offs")], ["risk", T(L, "Riesgo", "Risk")], ["uncertainty", T(L, "Incertidumbre", "Uncertainty")]]
        .map(([id, label], i) => `<button type="button" role="tab" aria-selected="${S.tab === id}" class="${S.tab === id ? "active" : ""}" data-si-tab="${id}"><span>0${i + 1}</span>${label}</button>`).join("")}</div>
      <div id="si-results" aria-live="polite"></div>`;
  }

  // ---------- modules ----------
  function header(ctx, r) {
    const L = ctx.lang, d = r.data, v = d.voice?.[L];
    const badge = { live: T(L, "EN VIVO · ORÁCULO", "LIVE · ORACLE"), bundled: T(L, "MOTOR SI · DATOS NASA", "SI ENGINE · NASA DATA"), local: T(L, "RE-ORDENADO CON TUS PRIORIDADES", "RE-RANKED WITH YOUR PRIORITIES"), stale: T(L, "ÚLTIMO RESULTADO", "LAST RESULT") }[r.source];
    const busy = S.pending === key(ctx.farm);
    return `<article class="card si-ceres"><div class="si-ceres-top"><span class="eyeline">CERES · ${T(L, "VOZ DE LA SI", "VOICE OF THE SI")}</span>
        <span class="si-badges"><span class="si-badge">${badge}</span><span class="si-badge conf-${d.uncertainty.confidence}">${T(L, "Confianza", "Confidence")}: ${{ high: T(L, "alta", "high"), medium: T(L, "media", "medium"), low: T(L, "baja", "low") }[d.uncertainty.confidence]}</span>${busy ? `<span class="si-badge">${T(L, "Calculando…", "Calculating…")}</span>` : ""}</span></div>
      <p>${E(v?.text || "")}</p>
      <div class="si-ceres-actions"><button type="button" class="primary-btn" data-action="ceres-open">${T(L, "Hablar con CERES", "Talk to CERES")}</button>
      <span class="si-dq">${T(L, "Clima", "Climate")}: ${d.dataQuality.climate === "synthetic" ? T(L, "de ejemplo", "example") : T(L, "NASA POWER (ET₀ FAO-56) + lluvia CHIRPS", "NASA POWER (FAO-56 ET₀) + CHIRPS rain")} · ECOSTRESS: ${d.dataQuality.ecostressPoint ? (d.dataQuality.ecostressPoint.representative === false ? T(L, `${d.dataQuality.ecostressPoint.totalValid} pasadas, punto fuera de la chacra (no calibra)`, `${d.dataQuality.ecostressPoint.totalValid} overpasses, point off the field (not used to calibrate)`) : T(L, `${d.dataQuality.ecostressPoint.totalValid} pasadas, calibra el modelo`, `${d.dataQuality.ecostressPoint.totalValid} overpasses, calibrates the model`)) : T(L, "sin datos", "no data")} · ${T(L, "Modelo SI de agua", "SI water model")}: ${/SYNTHETIC/.test(d.dataQuality.model) ? T(L, "entrenado con datos sintéticos", "trained on synthetic data") : "ECOSTRESS"}</span></div>
      ${S.err ? `<p class="si-err">${E(S.err)}</p>` : ""}</article>`;
  }

  function ficha(ctx, s) {
    const db = window.CeresRealData && window.CeresRealData.db, L = ctx.lang;
    const f = db && db.FARMS.find((x) => x.id === ctx.farm), st = f && f.strategies.find((x) => x.id === s.id);
    if (!st) return "";
    const g = (o) => (o && (o[L] || o.es)) || "";
    return `<details class="si-ficha" onclick="event.stopPropagation()"><summary>${T(L, "Ver ficha", "See details")}</summary><dl>
      <dt>${T(L, "Por qué", "Why")}</dt><dd>${E(g(st.why))}</dd>${st.benefits ? `<dt>${T(L, "Beneficios", "Benefits")}</dt><dd>${E(g(st.benefits))}</dd>` : ""}
      <dt>${T(L, "Evidencia", "Evidence")}</dt><dd>${E(g(st.evidence))}</dd><dt>${T(L, "Vacíos de información", "Information gaps")}</dt><dd>${E(g(st.gaps))}</dd>
      <dt>${T(L, "Riesgos a revisar con un técnico", "Risks for local review")}</dt><dd>${E(g(st.risks))}</dd></dl></details>`;
  }

  function compareTab(ctx, d) {
    const L = ctx.lang, top = d.tradeoffs.ranking[0].id, unit = d.units === "m3" ? "m³/ha/año" : "mm/año";
    const rk = (id) => d.tradeoffs.ranking.find((r) => r.id === id) || {};
    return `<div class="si-compare">${d.compare.strategies.map((s) => {
      const w = d.uncertainty.rankFirstProbability[s.id];
      const tags = [s.current ? `<span class="si-tag cur">${T(L, "Actual", "Current")}</span>` : "", s.id === top ? `<span class="si-tag top">${T(L, "Mejor para ti", "Best for you")}</span>` : ""].join("");
      const delta = (v, suf, good) => s.current ? "" : `<em class="${good ? "good" : "warn"}">${sign(v)}${suf}</em>`;
      return `<button type="button" class="card si-strat ${S.sel[ctx.farm] === s.id ? "picked" : ""}" data-si-pick="${s.id}">
        <div class="si-strat-top"><b>${E(s.name[L])}</b>${tags}</div>
        <dl><div><dt>${T(L, "Agua", "Water")}</dt><dd>${num(s.water.expected ?? s.water.p50, L)} <small>${unit}</small> ${s.current ? "" : `<em class="${s.deltas.waterPct <= 0 ? "good" : "warn"}">${s.deltas.waterPct > 0 ? "+" : ""}${num(s.deltas.waterPct, L, 1)}%</em>`}</dd></div>
        <div><dt>${T(L, "Suelo", "Soil")}</dt><dd>${num(s.soil, L)}/100 ${delta(s.deltas.soilPts, "", s.deltas.soilPts >= 0)}</dd></div>
        <div><dt>${T(L, "Ingreso", "Income")}</dt><dd>S/ ${num(s.incomePenHa, L)} <small>/ha</small> ${delta(s.deltas.incomePct, "%", s.deltas.incomePct >= 0)}</dd></div>
        <div><dt>${T(L, "Déficit", "Deficit")}</dt><dd>${num(s.deficitPct, L, 1)}%</dd></div></dl>
        <div class="si-wins"><span style="width:${Math.round(w * 100)}%"></span></div>
        <small class="muted">${T(L, `Mejor opción en ${Math.round(w * 100)} de 100 años simulados (prioridades por defecto)`, `Best option in ${Math.round(w * 100)} of 100 simulated years (default priorities)`)}</small>
        ${(rk(s.id).flags || []).map((f) => `<span class="si-flag">${E(f)}</span>`).join("")}${(rk(s.id).adj || []).length ? `<small class="muted">${E(rk(s.id).adj.join(" · "))}</small>` : ""}
        ${ficha(ctx, s)}</button>`;
    }).join("")}</div>`;
  }

  function radar(d, ids, L) {
    const W = 300, c = W / 2, R = 108, axes = Object.keys(CRIT);
    const pt = (i, v) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / axes.length; return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v]; };
    let svg = `<svg viewBox="0 0 ${W} ${W}" class="si-radar" role="img" aria-label="radar">`;
    [0.25, 0.5, 0.75, 1].forEach((g) => { svg += `<polygon points="${axes.map((_, i) => pt(i, g).join(",")).join(" ")}" class="grid"/>`; });
    axes.forEach((k, i) => { const [x, y] = pt(i, 1.18); const [lx, ly] = pt(i, 1); svg += `<line x1="${c}" y1="${c}" x2="${lx}" y2="${ly}" class="grid"/><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">${CRIT[k][L === "es" ? 0 : 1]}</text>`; });
    ids.forEach((id, n) => { const v = d.tradeoffs.radar[id]; svg += `<polygon points="${axes.map((k, i) => pt(i, Math.max(0.02, v[k])).join(",")).join(" ")}" class="shape s${n}"/>`; });
    return svg + "</svg>";
  }

  function tradeoffsTab(ctx, d) {
    const L = ctx.lang, cur = d.compare.strategies.find((s) => s.current).id, sel = S.sel[ctx.farm] && S.sel[ctx.farm] !== cur ? S.sel[ctx.farm] : d.tradeoffs.ranking.find((r) => r.id !== cur).id;
    const name = (id) => E(d.compare.strategies.find((s) => s.id === id).name[L]);
    return `<div class="si-two"><article class="card"><span class="eyeline">${T(L, "ACTUAL VS ALTERNATIVA", "CURRENT VS ALTERNATIVE")}</span>${radar(d, [cur, sel], L)}
        <div class="si-legend"><span><i class="s0"></i>${name(cur)}</span><span><i class="s1"></i>${name(sel)}</span></div></article>
      <article class="card"><span class="eyeline">${T(L, "RANKING SEGÚN TUS PRIORIDADES", "RANKING BY YOUR PRIORITIES")}</span>
        <ol class="si-rank">${d.tradeoffs.ranking.map((r) => `<li><button type="button" data-si-pick="${r.id}" class="${r.id === sel ? "picked" : ""}"><b>${name(r.id)}</b><span class="si-bar"><span style="width:${Math.round(r.score * 100)}%"></span></span><small>${num(r.score * 100, L)}${r.paretoOptimal ? ` · ${T(L, "no superada en todo", "not beaten on everything")}` : ""}${(r.flags || []).length ? ` · ${E(r.flags[0])}` : ""}${(r.adj || []).length ? ` · ${E(r.adj.join(" "))}` : ""}</small></button></li>`).join("")}</ol>
        <p class="si-note">${T(L, "Puntaje = suma de cada prioridad × criterio (agua, suelo, ingreso, resiliencia), de 0 a 1. Ajustes por tu situación: agua escasa ×1,5 / segura ×0,6 en el peso del agua; meta de suelo +0,08; forraje +0,05; sin comprador −0,15; sin equipo de goteo = no puede ser la recomendación.", "Score = sum of each priority × criterion (water, soil, income, resilience), 0 to 1. Your situation adjusts it: scarce water ×1.5 / secure ×0.6 on the water weight; soil goal +0.08; forage +0.05; no buyer −0.15; no drip kit = can't be the recommendation.")}</p></article></div>`;
  }

  function riskTab(ctx, d) {
    const L = ctx.lang, ids = d.compare.strategies.map((s) => s.id), sel = S.sel[ctx.farm] && ids.includes(S.sel[ctx.farm]) ? S.sel[ctx.farm] : d.tradeoffs.ranking[0].id;
    const r = d.risk.strategies[sel], m = MONTHS[L];
    const pk = r.peak, when = pk.yearRound ? T(L, "todo el año", "all year") : m[pk.month - 1];
    return `<article class="card"><div class="si-chips">${d.compare.strategies.map((s) => `<button type="button" class="${s.id === sel ? "active" : ""}" data-si-pick="${s.id}">${E(s.name[L])}</button>`).join("")}</div>
      <div class="si-heat" role="table">
        <div class="row head" role="row"><span></span>${m.map((x) => `<span role="columnheader">${x}</span>`).join("")}</div>
        ${r.grid.map((h) => `<div class="row" role="row"><span role="rowheader">${HAZ[h.hazard][L === "es" ? 0 : 1]}</span>${h.monthly.map((v, i) => `<span role="cell" class="cell" style="--v:${Math.min(1, v)}" title="${HAZ[h.hazard][L === "es" ? 0 : 1]} · ${m[i]} · ${Math.round(v * 100)}%"></span>`).join("")}</div>`).join("")}
      </div>
      <p class="si-note"><b>${T(L, "Riesgo pico", "Peak risk")}:</b> ${HAZ[pk.hazard][L === "es" ? 0 : 1]} · ${when} (${Math.round(pk.value * 100)}%). ${T(L, "Color más intenso = más probable en los años simulados.", "Darker = more likely across simulated years.")}</p></article>`;
  }

  function band(q, lo, hi, cls) {
    const pos = (v) => ((v - lo) / (hi - lo || 1)) * 100;
    return `<span class="si-band ${cls}"><span class="range" style="left:${pos(q.p10)}%;width:${Math.max(1.5, pos(q.p90) - pos(q.p10))}%"></span><span class="mid" style="left:${pos(q.p50)}%"></span></span>`;
  }

  function uncertaintyTab(ctx, d) {
    const L = ctx.lang, u = d.uncertainty, S2 = d.compare.strategies, unit = d.units === "m3" ? "m³/ha" : "mm";
    const wl = Math.min(...S2.map((s) => u.strategies[s.id].water.p10)), wh = Math.max(...S2.map((s) => u.strategies[s.id].water.p90));
    const il = Math.min(...S2.map((s) => u.strategies[s.id].incomePenHa.p10)), ih = Math.max(...S2.map((s) => u.strategies[s.id].incomePenHa.p90));
    const drv = (obj) => `<span class="si-drivers">${Object.entries(obj).map(([k, v], i) => `<span class="d${i}" style="width:${Math.max(0, v * 100)}%" title="${k} ${Math.round(v * 100)}%"></span>`).join("")}</span>`;
    const dl = { climate: T(L, "clima", "climate"), "crop model": T(L, "modelo de cultivo", "crop model"), market: T(L, "mercado", "market") };
    return `<div class="si-two"><article class="card"><span class="eyeline">${T(L, "RANGO PROBABLE (P10–P90)", "LIKELY RANGE (P10–P90)")} · ${u.draws} ${T(L, "AÑOS SIMULADOS", "SIMULATED YEARS")}</span>
        <table class="si-unc"><thead><tr><th></th><th>${T(L, "Agua", "Water")} (${unit})</th><th>${T(L, "Ingreso", "Income")} (S/)</th><th>${T(L, "Gana", "Wins")}</th></tr></thead><tbody>
        ${S2.map((s) => { const q = u.strategies[s.id]; return `<tr><th>${E(s.name[L])}</th><td>${band(q.water, wl, wh, "w")}<small>${num(q.water.p10, L)}–${num(q.water.p90, L)}</small></td><td>${band(q.incomePenHa, il, ih, "i")}<small>${num(q.incomePenHa.p10, L)}–${num(q.incomePenHa.p90, L)}</small></td><td><b>${Math.round(u.rankFirstProbability[s.id] * 100)}</b>/100</td></tr>`; }).join("")}
        </tbody></table></article>
      <article class="card"><span class="eyeline">${T(L, "¿QUÉ MUEVE LA INCERTIDUMBRE?", "WHAT DRIVES THE UNCERTAINTY?")}</span>
        <p class="si-note">${T(L, "Para la mejor opción, cuánto de la variación viene de cada fuente:", "For the best option, how much of the spread comes from each source:")}</p>
        <div class="si-drv-row"><b>${T(L, "Agua", "Water")}</b>${drv(u.drivers.water)}</div>
        <div class="si-drv-row"><b>${T(L, "Ingreso", "Income")}</b>${drv(u.drivers.income)}</div>
        <div class="si-legend">${Object.keys(dl).map((k, i) => `<span><i class="d${i}"></i>${dl[k]}</span>`).join("")}</div>
        <p class="si-note"><b>${T(L, "Confianza", "Confidence")}:</b> ${T(L, "alta si la dispersión es < 25 % y gana ≥ 60 % de los años; media si < 50 % y ≥ 35 %; nunca más que media mientras haya datos de ejemplo.", "high if spread < 25 % and it wins ≥ 60 % of years; medium if < 50 % and ≥ 35 %; never above medium while example data is in use.")}</p></article></div>`;
  }

  /* W4: season timeline from real NDVI (HLS 30 m / Sentinel-2 10 m field pixel / MODIS 250 m), bare months
     (NDVI < 0.20, Sentinel-2 method) and vulnerable months (bare + rain or frost), plus simulated risk peaks. */
  const MNAME = { es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"], en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] };
  const EN_IDX = Object.fromEntries(MNAME.en.map((m, i) => [m, i]));
  function seasonBlock(ctx, d) {
    const L = ctx.lang, cl = (window.AGUA_SI_CLIMATE || {})[ctx.farm];
    if (!cl || !cl.ndvi || !cl.ndvi.monthly) return "";
    const nd = cl.ndvi, ext = cl.extensions || {}, cover = ext.cover || {};
    const thr = cover.bare_threshold_ndvi ?? 0.2;
    const bare = new Set((cover.bare_months || []).map((m) => EN_IDX[m]));
    const vul = Object.fromEntries((cover.vulnerable_months || []).map((v) => [EN_IDX[v.month], v.reasons]));
    const cur = d && d.compare.strategies.find((s) => s.current);
    const grid = cur && d.risk.strategies[cur.id] ? d.risk.strategies[cur.id].grid : [];
    const riskTop = (m) => { let best = null; for (const h of grid) if (h.hazard !== "bare" && h.monthly[m] >= 0.3 && (!best || h.monthly[m] > best.v)) best = { h: h.hazard, v: h.monthly[m] }; return best; };
    const kind = nd.pointKind === "field_pixel_provisional"
      ? T(L, `píxel de cultivo provisional (${cl.fieldPixel ? cl.fieldPixel.dist_from_app_point_m + " m del punto de la app" : ""}; confirmar con el agricultor)`, `provisional crop pixel (${cl.fieldPixel ? cl.fieldPixel.dist_from_app_point_m + " m from the app point" : ""}; confirm with the farmer)`)
      : T(L, "punto de la app", "app point");
    const hlsApp = nd.context && nd.context.hlsAppPoint && nd.pointKind === "field_pixel_provisional" ? nd.context.hlsAppPoint.monthly_mean : null;
    const cells = nd.monthly.map((v, m) => {
      const isBare = bare.has(m) || (v != null && v < thr), rk = riskTop(m), vr = vul[m];
      const title = `${MNAME[L][m]} · NDVI ${v == null ? T(L, "sin escena", "no scene") : v.toFixed(2)}${nd.nClear ? ` · ${nd.nClear[m]} ${T(L, "escenas", "scenes")}` : ""}${vr ? " · " + vr.join("; ") : ""}${rk ? " · " + T(L, "riesgo simulado: ", "simulated risk: ") + HAZ[rk.h][L === "es" ? 0 : 1] : ""}`;
      return `<div class="ss-cell ${isBare ? "bare" : ""} ${vr ? "vul" : ""}" title="${E(title)}" tabindex="0">
        <span class="ss-bar" style="--v:${v == null ? 0 : Math.min(1, v / 0.8)}"></span>
        <b>${MNAME[L][m]}</b><small>${v == null ? "—" : v.toFixed(2)}</small>
        ${isBare ? `<i class="tag bare">${T(L, "desnudo", "bare")}</i>` : ""}${vr ? `<i class="tag vul">${T(L, "vulnerable", "vulnerable")}</i>` : ""}${rk ? `<i class="tag risk">${HAZ[rk.h][L === "es" ? 0 : 1]}</i>` : ""}</div>`;
    }).join("");
    const bareList = [...bare].sort((a, b) => a - b).map((m) => MNAME[L][m]);
    const opp = bareList.length
      ? T(L, `Meses con suelo desnudo: ${bareList.join(", ")}. Son la ventana para una cobertura o abono verde${(cover.vulnerable_months || []).length ? "; los marcados «vulnerable» coinciden con lluvia y suelo desnudo (riesgo de erosión)" : ""}.`, `Bare-soil months: ${bareList.join(", ")}. They are the window for a cover crop or green manure${(cover.vulnerable_months || []).length ? "; months marked “vulnerable” combine rain and bare soil (erosion risk)" : ""}.`)
      : T(L, "No hay meses con suelo desnudo en este píxel (NDVI ≥ 0,20 todo el año).", "No bare-soil months at this pixel (NDVI ≥ 0.20 all year).");
    return `<article class="card si-season"><div class="card-header"><div><span class="eyeline">${T(L, "TEMPORADAS · SUELO DESNUDO Y MESES VULNERABLES", "SEASONS · BARE SOIL AND VULNERABLE MONTHS")}</span>
        <h3>${T(L, "El año de tu parcela visto desde el satélite", "Your field's year seen from space")}</h3></div></div>
      <div class="ss-grid">${cells}</div>
      <p class="si-note">${E(opp)}</p>
      ${hlsApp ? `<p class="si-note">${T(L, "En el punto de la app, HLS 30 m marca suelo desnudo todo el año", "At the app point, HLS 30 m reads bare ground all year")} (NDVI ${Math.min(...hlsApp).toFixed(2)}–${Math.max(...hlsApp).toFixed(2)}).</p>` : ""}
      <p class="cite">NDVI: ${E(nd.source || "")} · ${E(kind)} · ${T(L, "umbral desnudo", "bare threshold")} ${thr} · ${T(L, "riesgos: simulación del motor SI con clima NASA POWER", "risks: SI engine simulation on NASA POWER climate")}</p></article>`;
  }

  function paint(ctx) {
    const box = document.getElementById("si-results");
    if (!box) return;
    const r = result(ctx.farm, ctx.lang);
    if (!r) { box.innerHTML = `<p class="si-note">${T(ctx.lang, "Sin datos para esta parcela.", "No data for this farm.")}</p>`; return; }
    window.AguaClara.voice[ctx.farm] = r.data.voice;
    window.AguaClara.setTop?.(ctx.farm, r.data.tradeoffs.ranking[0].id);
    const tab = { compare: compareTab, tradeoffs: tradeoffsTab, risk: riskTab, uncertainty: uncertaintyTab }[S.tab];
    box.innerHTML = header(ctx, r) + seasonBlock(ctx, r.data) + tab(ctx, r.data);
  }

  function mount(ctx) {
    const root = document.getElementById("si-root");
    if (!root) return;
    root.innerHTML = controls(ctx);
    paint(ctx);
    if (!scenarioDefault() || !FX[ctx.farm]) fetchLive(ctx);
  }

  // events live on document: #app is re-rendered by app.js, si-root is re-mounted by the hook
  document.addEventListener("change", (e) => {
    const el = e.target.closest?.("[data-si-cons]");
    if (!el) return;
    S.cons[el.dataset.siCons] = el.type === "checkbox" ? el.checked : el.value;
    paint(window.AguaClara.ctx);
  });
  document.addEventListener("input", (e) => {
    const el = e.target.closest?.("[data-si]");
    if (!el) return;
    const id = el.dataset.si, v = Number(el.value);
    if (id in S.pr) S.pr[id] = v; else S.sc[id] = v;
    const out = document.getElementById(`si-${id}-out`);
    if (out) out.textContent = v + (id === "rainPct" ? "%" : id === "tempDeltaC" ? " °C" : "");
    clearTimeout(S.timer);
    S.timer = setTimeout(() => { const ctx = window.AguaClara.ctx; paint(ctx); fetchLive(ctx); }, 400);
  });
  document.addEventListener("click", (e) => {
    const ctx = window.AguaClara.ctx;
    const tab = e.target.closest?.("[data-si-tab]");
    if (tab) { S.tab = tab.dataset.siTab; mount(ctx); return; }
    const pick = e.target.closest?.("[data-si-pick]");
    if (pick) { S.sel[ctx.farm] = pick.dataset.siPick; paint(ctx); return; }
    if (e.target.closest?.("[data-si-reset]")) { S.pr = { ...DEFAULT_PR }; S.cons = { ...DEFAULT_CONS }; S.sc = { rainPct: 0, tempDeltaC: 0 }; mount(ctx); }
  });

  window.AguaClara.hooks.push((ctx) => {
    if (ctx.view === "intel") mount(ctx);
    const sr = document.getElementById("season-root");
    if (sr) sr.innerHTML = seasonBlock(ctx, FX[ctx.farm]);
  });
})();
