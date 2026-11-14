/* CERES Ventures — SI view: compare · trade-offs · risk · uncertainty.
   Live from the oracle (POST /v1/si/analyze) when config.oracleUrl is set; otherwise the
   bundled engine results in si-data.js (default priorities, no scenario). */
(() => {
  "use strict";
  const CFG = window.AGUA_CLARA_CONFIG || {};
  const ORACLE = (CFG.oracleUrl || "").replace(/\/$/, "");
  const FX = window.AGUA_SI_FIXTURES || {};
  const DEFAULT_PR = { water: 40, soil: 25, income: 25, resilience: 10 };
  const S = { tab: "compare", pr: { ...DEFAULT_PR }, sc: { rainPct: 0, tempDeltaC: 0 }, sel: {}, cache: {}, pending: null, err: "", timer: 0 };
  window.AguaClara.voice = window.AguaClara.voice || {};

  const E = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const T = (lang, es, en) => (lang === "es" ? es : en);
  const num = (n, lang, d = 0) => Number(n).toLocaleString(lang === "es" ? "es-PE" : "en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const sign = (n) => (n > 0 ? "+" : "") + Math.round(n);
  const MONTHS = { es: "E F M A M J J A S O N D".split(" "), en: "J F M A M J J A S O N D".split(" ") };
  const HAZ = { frost: ["Helada", "Frost"], heat: ["Calor", "Heat"], water: ["Falta de agua", "Water shortage"], bare: ["Suelo desnudo", "Bare soil"], salinity: ["Salinidad", "Salinity"] };
  const CRIT = { water: ["Agua", "Water"], soil: ["Suelo", "Soil"], income: ["Ingreso", "Income"], resilience: ["Resiliencia", "Resilience"] };
  const isDefault = () => JSON.stringify(S.pr) === JSON.stringify(DEFAULT_PR) && S.sc.rainPct === 0 && S.sc.tempDeltaC === 0;
  const key = (farm) => `${farm}|${JSON.stringify(S.pr)}|${JSON.stringify(S.sc)}`;

  function result(farm) {
    const live = S.cache[key(farm)];
    if (live) return { data: live, source: "live" };
    if (isDefault() && FX[farm]) return { data: FX[farm], source: "bundled" };
    const anyLive = Object.entries(S.cache).filter(([k]) => k.startsWith(farm + "|")).pop();
    if (anyLive) return { data: anyLive[1], source: "stale" };
    return FX[farm] ? { data: FX[farm], source: "bundled" } : null;
  }

  async function fetchLive(ctx) {
    if (!ORACLE) return;
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
    return `<section class="card si-controls">
      <div class="si-ctl-group"><span class="eyeline">${T(L, "MIS PRIORIDADES", "MY PRIORITIES")}</span>
        ${Object.keys(CRIT).map((k) => slider(k, CRIT[k][L === "es" ? 0 : 1], S.pr[k], 0, 100, 5, "", off)).join("")}</div>
      <div class="si-ctl-group"><span class="eyeline">${T(L, "¿Y SI…?", "WHAT IF…?")}</span>
        ${slider("rainPct", T(L, "Lluvia", "Rain"), S.sc.rainPct, -50, 50, 5, "%", off)}
        ${slider("tempDeltaC", T(L, "Calentamiento", "Warming"), S.sc.tempDeltaC, 0, 3, 0.5, " °C", off)}
        ${off ? `<p class="si-note">${T(L, "Conecta el oráculo (config.js) para recalcular. Ahora ves resultados precalculados del motor SI.", "Connect the oracle (config.js) to recalculate. You're seeing precomputed SI engine results.")}</p>`
              : `<button type="button" class="text-btn" data-si-reset>${T(L, "Restablecer", "Reset")}</button>`}
      </div></section>
      <div class="si-tabs" role="tablist">${[["compare", T(L, "Comparar", "Compare")], ["tradeoffs", T(L, "Compensaciones", "Trade-offs")], ["risk", T(L, "Riesgo", "Risk")], ["uncertainty", T(L, "Incertidumbre", "Uncertainty")]]
        .map(([id, label], i) => `<button type="button" role="tab" aria-selected="${S.tab === id}" class="${S.tab === id ? "active" : ""}" data-si-tab="${id}"><span>0${i + 1}</span>${label}</button>`).join("")}</div>
      <div id="si-results" aria-live="polite"></div>`;
  }

  // ---------- modules ----------
  function header(ctx, r) {
    const L = ctx.lang, d = r.data, v = d.voice?.[L];
    const badge = { live: T(L, "EN VIVO · ORÁCULO", "LIVE · ORACLE"), bundled: T(L, "PRECALCULADO · MOTOR SI", "PRECOMPUTED · SI ENGINE"), stale: T(L, "ÚLTIMO RESULTADO", "LAST RESULT") }[r.source];
    const busy = S.pending === key(ctx.farm);
    return `<article class="card si-ceres"><div class="si-ceres-top"><span class="eyeline">CERES · ${T(L, "VOZ DE LA SI", "VOICE OF THE SI")}</span>
        <span class="si-badges"><span class="si-badge">${badge}</span><span class="si-badge conf-${d.uncertainty.confidence}">${T(L, "Confianza", "Confidence")}: ${{ high: T(L, "alta", "high"), medium: T(L, "media", "medium"), low: T(L, "baja", "low") }[d.uncertainty.confidence]}</span>${busy ? `<span class="si-badge">${T(L, "Calculando…", "Calculating…")}</span>` : ""}</span></div>
      <p>${E(v?.text || "")}</p>
      <div class="si-ceres-actions"><button type="button" class="primary-btn" data-action="ceres-open">${T(L, "Hablar con CERES", "Talk to CERES")}</button>
      <span class="si-dq">${T(L, "Clima", "Climate")}: ${d.dataQuality.climate === "synthetic" ? T(L, "de ejemplo", "example") : "NASA POWER"} · ${T(L, "Modelo", "Model")}: ${/SYNTHETIC/.test(d.dataQuality.model) ? T(L, "entrenado con datos sintéticos", "trained on synthetic data") : "ECOSTRESS"}</span></div>
      ${S.err ? `<p class="si-err">${E(S.err)}</p>` : ""}</article>`;
  }

  function compareTab(ctx, d) {
    const L = ctx.lang, top = d.tradeoffs.ranking[0].id, unit = d.units === "m3" ? "m³/ha/año" : "mm/año";
    return `<div class="si-compare">${d.compare.strategies.map((s) => {
      const w = d.uncertainty.rankFirstProbability[s.id];
      const tags = [s.current ? `<span class="si-tag cur">${T(L, "Actual", "Current")}</span>` : "", s.id === top ? `<span class="si-tag top">${T(L, "Mejor para ti", "Best for you")}</span>` : ""].join("");
      const delta = (v, suf, good) => s.current ? "" : `<em class="${good ? "good" : "warn"}">${sign(v)}${suf}</em>`;
      return `<button type="button" class="card si-strat ${S.sel[ctx.farm] === s.id ? "picked" : ""}" data-si-pick="${s.id}">
        <div class="si-strat-top"><b>${E(s.name[L])}</b>${tags}</div>
        <dl><div><dt>${T(L, "Agua", "Water")}</dt><dd>${num(s.water.p50, L)} <small>${unit}</small> ${delta(s.deltas.waterPct, "%", s.deltas.waterPct <= 0)}</dd></div>
        <div><dt>${T(L, "Suelo", "Soil")}</dt><dd>${num(s.soil, L)}/100 ${delta(s.deltas.soilPts, "", s.deltas.soilPts >= 0)}</dd></div>
        <div><dt>${T(L, "Ingreso", "Income")}</dt><dd>S/ ${num(s.incomePenHa, L)} <small>/ha</small> ${delta(s.deltas.incomePct, "%", s.deltas.incomePct >= 0)}</dd></div>
        <div><dt>${T(L, "Déficit", "Deficit")}</dt><dd>${num(s.deficitPct, L, 1)}%</dd></div></dl>
        <div class="si-wins"><span style="width:${Math.round(w * 100)}%"></span></div>
        <small class="muted">${T(L, `Mejor opción en ${Math.round(w * 100)} de 100 años simulados`, `Best option in ${Math.round(w * 100)} of 100 simulated years`)}</small></button>`;
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
        <ol class="si-rank">${d.tradeoffs.ranking.map((r) => `<li><button type="button" data-si-pick="${r.id}" class="${r.id === sel ? "picked" : ""}"><b>${name(r.id)}</b><span class="si-bar"><span style="width:${Math.round(r.score * 100)}%"></span></span><small>${num(r.score * 100, L)}${r.paretoOptimal ? ` · ${T(L, "no superada en todo", "not beaten on everything")}` : ""}</small></button></li>`).join("")}</ol>
        <p class="si-note">${T(L, "Puntaje = suma de cada prioridad × criterio (agua, suelo, ingreso, resiliencia), de 0 a 1.", "Score = sum of each priority × criterion (water, soil, income, resilience), 0 to 1.")}</p></article></div>`;
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

  function paint(ctx) {
    const box = document.getElementById("si-results");
    if (!box) return;
    const r = result(ctx.farm);
    if (!r) { box.innerHTML = `<p class="si-note">${T(ctx.lang, "Sin datos para esta parcela.", "No data for this farm.")}</p>`; return; }
    window.AguaClara.voice[ctx.farm] = r.data.voice;
    const tab = { compare: compareTab, tradeoffs: tradeoffsTab, risk: riskTab, uncertainty: uncertaintyTab }[S.tab];
    box.innerHTML = header(ctx, r) + tab(ctx, r.data);
  }

  function mount(ctx) {
    const root = document.getElementById("si-root");
    if (!root) return;
    root.innerHTML = controls(ctx);
    paint(ctx);
    if (!isDefault() || !FX[ctx.farm]) fetchLive(ctx);
  }

  // events live on document: #app is re-rendered by app.js, si-root is re-mounted by the hook
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
    if (e.target.closest?.("[data-si-reset]")) { S.pr = { ...DEFAULT_PR }; S.sc = { rainPct: 0, tempDeltaC: 0 }; mount(ctx); }
  });

  window.AguaClara.hooks.push((ctx) => { if (ctx.view === "intel") mount(ctx); });
})();
