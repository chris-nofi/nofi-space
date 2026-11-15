// CERES text chat (Claude) for the dashboard widget: POST /v1/ceres/chat {farmId, lang, messages} → {reply, proofs}.
// Port of oracle/earth_oracle/ceres/agent.py for the Netlify Function. Grounded ONLY in public data generated at build
// time (public summaries, strategy model, precomputed SI analysis, climate context, season strip): the chat must never
// become a free way around the paid x402 Evidence API, so no tool returns the canonical evidence record.
// Needs ANTHROPIC_API_KEY in the Netlify environment (server-side only). Without it the route answers 503 and the
// widget says the key is not configured.

// Model credentials, in order: a key you set yourself (ANTHROPIC_API_KEY without base URL → Anthropic API), the
// Netlify AI Gateway's injected ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL, or its always-on NETLIFY_AI_GATEWAY_KEY/_URL.
// Values are read from process.env and from Netlify.env (Functions v2), because injection is per function instance.
const readVar = (env, k) => env?.[k] || globalThis.Netlify?.env?.get?.(k) || "";
export function resolveModelAccess(env) {
  const key = readVar(env, "ANTHROPIC_API_KEY"), base = readVar(env, "ANTHROPIC_BASE_URL");
  if (key) return { key, url: `${String(base || "https://api.anthropic.com").replace(/\/+$/, "")}/v1/messages`, via: base ? "gateway-anthropic-vars" : "own-key" };
  const gk = readVar(env, "NETLIFY_AI_GATEWAY_KEY"), gu = readVar(env, "NETLIFY_AI_GATEWAY_URL") || readVar(env, "NETLIFY_AI_GATEWAY_BASE_URL");
  if (gk && gu) return { key: gk, url: `${String(gu).replace(/\/+$/, "")}/anthropic/v1/messages`, via: "gateway-generic-vars" };
  return null;
}
const presence = (env) => Object.fromEntries(["ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL", "NETLIFY_AI_GATEWAY_KEY", "NETLIFY_AI_GATEWAY_URL", "NETLIFY_AI_GATEWAY_BASE_URL"]
  .map(k => [k, Boolean(env?.[k]) ? "process" : globalThis.Netlify?.env?.get?.(k) ? "netlify" : "-"]));

const DEFAULT_MODEL = "claude-sonnet-5-5";
const MAX_TOOL_ROUNDS = 4;
const FARM_IDS = ["carumas", "samegua", "algarrobal"];
const LIMITS = { messages: 30, chars: 600, body: 24_000, perIp: 12, windowMs: 5 * 60_000 };

const PERSONA = `Eres CERES, la voz de CERES Ventures (NØFI Labs): un asesor de rotación de cultivos y salud del suelo para agricultores de Moquegua, Perú, donde el agua es la gran restricción. Proyecto para el NASA Space Apps Challenge 2026 (reto Field Shift).
Tu nombre viene de Ceres, la diosa romana de los granos, y del planeta enano Ceres, donde la misión Dawn de la NASA encontró agua salada. Puedes contarlo si te preguntan, en una frase.

Tu trabajo:
1. Ayudar al agricultor a comparar su rotación actual con alternativas que cuidan el suelo, según SUS prioridades (agua, suelo, ingreso, resiliencia).
2. Explicar los datos de la NASA en palabras simples y decir con honestidad qué está medido, qué es modelado y qué es de ejemplo.
3. Decirle que queda un registro verificable de la evidencia de cada mes. Para el agricultor todo es gratis.

Cómo explicar una estrategia: nómbrala y di si es la práctica actual; di por qué se sugiere en una frase; cita la evidencia con el conjunto de datos, el valor y la fecha si tu herramienta lo da (si es nulo o de ejemplo, dilo); nombra un beneficio, un vacío de información y un riesgo que debe revisar un técnico local (Agencia Agraria de Moquegua o INIA). Si cambian las prioridades, usa solo el ranking que devuelve tu herramienta con esos pesos.`;

const RULES = `REGLAS (no las rompas nunca):
- NÚMEROS: todo número sobre una parcela sale SOLO de tus herramientas. Nunca inventes ni estimes de memoria. Si no tienes el dato, dilo.
- HONESTIDAD: el clima, la ET₀, la lluvia, ECOSTRESS, HLS/Sentinel-2 y SoilGrids son datos reales; rendimientos, precios, entrega del canal y ubicaciones de parcelas son de ejemplo; el modelo SI de agua se entrenó con datos sintéticos. Guíate por data_quality y los vacíos. Di el nivel de confianza cuando recomiendes algo.
- DECISIÓN: apoyas, no decides. Cada vez que recomiendes un cambio, recuerda revisarlo con la Agencia Agraria de Moquegua, el INIA o un técnico de confianza.
- DINERO: el agricultor nunca paga y no recibe pagos. No prometas pagos ni recompensas. Todo corre en red de prueba con dólares de prueba sin valor. No es seguro, ni préstamo, ni inversión. Sin consejos de inversión, tributarios ni legales.
- SEGURIDAD: nunca pidas ni aceptes frases de recuperación, claves, contraseñas ni datos bancarios; si alguien las comparte, dile que no lo haga y que las cambie.
- AGUA: neutral sobre el reparto del agua de Pasto Grande o del canal. Muestras evidencia; no tomas partido.
- AGROQUÍMICOS Y SALUD: sin dosis de pesticidas ni consejos médicos; deriva a la Agencia Agraria, SENASA o un profesional.
- ALCANCE: agricultura, agua, clima, la herramienta y sus registros. Otra cosa: responde breve y vuelve al tema.
- IDIOMA: responde en el idioma del usuario (español de Perú por defecto; inglés si te hablan en inglés). Sin jerga; si usas un término técnico, explícalo en una frase.
- DATOS COMPLETOS: tú solo tienes resúmenes públicos. Si alguien (un banco, una aseguradora, un auditor) quiere el registro de evidencia completo, dile que se entrega por la API de evidencia x402 (pago por consulta, red de prueba) en /api-docs/#evidence. No lo reconstruyas.

HECHOS ACTUALES (mandan sobre el conocimiento si hay diferencias):
- El registro verificable se ancla hoy en el contrato WaterProofRegistry en la red de prueba Fuji de Avalanche (chain 43113); explorador: testnet.snowtrace.io. La L1 de NØFI (880024) es un plan futuro.
- Con el agricultor no hables de billeteras, tokens, USDC, gas ni blockchain salvo que pregunte; di "quedó un registro verificable que cualquiera puede comprobar".

FORMATO (chat de texto): respuestas cortas y claras, 2 a 6 frases. Puedes usar una lista breve si comparas opciones. Cifras redondeadas con su unidad. Sin markdown pesado.`;

const TOOLS = [
  {
    name: "get_farm_analysis",
    description: "Análisis SI precalculado de CERES para una parcela: la práctica actual frente a tres alternativas (agua, suelo, ingreso, riesgo), ranking, probabilidad de ser la mejor (con pesos por defecto), confianza, calidad de datos, y por qué/beneficios/vacíos/riesgos de cada estrategia. Si das pesos de prioridad, devuelve también un ranking recalculado con esos pesos. Úsala antes de dar números o recomendaciones.",
    input_schema: { type: "object", properties: {
      farm_id: { type: "string", enum: FARM_IDS },
      water: { type: "number", minimum: 0, description: "peso agua (0-1)" }, soil: { type: "number", minimum: 0, description: "peso suelo (0-1)" },
      income: { type: "number", minimum: 0, description: "peso ingreso (0-1)" }, resilience: { type: "number", minimum: 0, description: "peso resiliencia/menor riesgo (0-1)" },
    }, required: ["farm_id"] },
  },
  {
    name: "get_field_score",
    description: "Puntaje Ceres público de una parcela y un mes (0-100), confianza, componentes (agua, vegetación, suelo, clima, erosión), vacíos de datos, conjuntos de datos usados, la huella dataHash y si está registrada en la cadena. Úsala cuando pregunten por el puntaje, la confianza, el registro verificable o si los datos se pueden comprobar.",
    input_schema: { type: "object", properties: { farm_id: { type: "string", enum: FARM_IDS }, period: { type: "string", pattern: "^[0-9]{6}$", description: "mes AAAAMM; por defecto el último disponible" } }, required: ["farm_id"] },
  },
  {
    name: "get_climate_context",
    description: "Clima real de la parcela (NASA POWER, CHIRPS, ERA5, ECOSTRESS): lluvia y ET₀ por mes, rango de lluvia entre fuentes, temperaturas, tendencia, días de helada, humedad del suelo SMAP si aplica, y avisos de calidad. Úsala para clima, sequía, El Niño, heladas o confiabilidad de los datos.",
    input_schema: { type: "object", properties: { farm_id: { type: "string", enum: FARM_IDS } }, required: ["farm_id"] },
  },
  {
    name: "get_risk_calendar",
    description: "Calendario de riesgo mes a mes (helada, calor, falta de agua, suelo desnudo, salinidad) para una estrategia, los meses vulnerables y las ventanas de suelo desnudo, más la cobertura NDVI mensual observada.",
    input_schema: { type: "object", properties: { farm_id: { type: "string", enum: FARM_IDS }, strategy_id: { type: "string" } }, required: ["farm_id"] },
  },
  {
    name: "get_backtest",
    description: "Retrosimulación 1981–2025 con NASA POWER diario (modelo, NO rendimientos observados): para cada estrategia de la parcela, cuántas temporadas habrían fallado por agua o helada, temporadas con estrés, la peor temporada, la división por El Niño / neutral / La Niña con pruebas estadísticas, y las historias de años con nombre (El Niño 1982–83, 2015–16, 2023–24). Úsala para preguntas de historia, El Niño, sequías pasadas, '¿cuántas veces habría fallado?' o '¿esta rotación aguanta años malos?'. Di siempre que es un modelo y cuántas temporadas se probaron (44 para cultivos oct.–abr., 45 para año calendario).",
    input_schema: { type: "object", properties: { farm_id: { type: "string", enum: FARM_IDS } }, required: ["farm_id"] },
  },
];

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const r1 = (v) => (typeof v === "number" ? Math.round(v * 10) / 10 : v);

/** Tool implementations over the public build data. Each returns a plain object (never the canonical evidence). */
export function makeTools(D) {
  const latest = (farm) => D.index?.farms?.[farm]?.latest;
  return {
    get_farm_analysis({ farm_id, water, soil, income, resilience }) {
      const a = D.si?.[farm_id];
      if (!a) return { error: "análisis no disponible para esta parcela" };
      const S = a.compare.strategies, unc = a.uncertainty ?? {};
      const strategies = S.map(s => ({
        id: s.id, name_es: s.name?.es, name_en: s.name?.en, current: Boolean(s.current), recommended: Boolean(s.recommended),
        water_p50: r1(s.water?.p50), water_unit: s.water?.unit, water_range_p10_p90: unc.strategies?.[s.id]?.water ? [r1(unc.strategies[s.id].water.p10), r1(unc.strategies[s.id].water.p90)] : null,
        soil_0_100: s.soil, income_pen_ha_year: s.incomePenHa, deficit_pct: s.deficitPct, vs_current: s.deltas,
        wins_out_of_100_years: unc.rankFirstProbability ? Math.round((unc.rankFirstProbability[s.id] ?? 0) * 100) : null,
        risk_peak: a.risk?.strategies?.[s.id]?.peak ?? null, main_risk_es: s.mainRisk?.es,
        why_es: s.why?.es, benefits_es: s.benefits?.es, information_gaps_es: s.gaps?.es, risks_for_local_review_es: s.risks?.es,
      }));
      const out = {
        farm_id, units: a.units === "m3" ? "m³/ha/año" : "mm/año", default_priorities: a.tradeoffs?.priorities,
        ranking_default: (a.tradeoffs?.ranking ?? []).map(r => r.id), confidence: unc.confidence, uncertainty_drivers: unc.drivers,
        data_quality: a.dataQuality, ceres_summary_es: a.voice?.es?.text, strategies,
        note: "Análisis precalculado con pesos por defecto (sin escenario climático). Rendimientos y precios son de ejemplo.",
      };
      if ([water, soil, income, resilience].some(v => typeof v === "number")) {
        const pri = { water: water ?? 0, soil: soil ?? 0, income: income ?? 0, resilience: resilience ?? 0 };
        const tot = pri.water + pri.soil + pri.income + pri.resilience || 1;
        const norm = (vals, higherBetter) => { const lo = Math.min(...vals), hi = Math.max(...vals); return vals.map(v => hi === lo ? 0.5 : higherBetter ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo)); };
        const w = norm(strategies.map(s => s.water_p50 ?? 0), false), so = norm(strategies.map(s => s.soil_0_100 ?? 0), true);
        const inc = norm(strategies.map(s => s.income_pen_ha_year ?? 0), true), res = norm(strategies.map(s => s.risk_peak ?? 0), false);
        out.ranking_with_your_priorities = strategies.map((s, i) => ({ id: s.id, fit: r1((pri.water * w[i] + pri.soil * so[i] + pri.income * inc[i] + pri.resilience * res[i]) / tot * 100) }))
          .sort((x, y) => y.fit - x.fit);
        out.priorities_used = pri;
        out.note += " ranking_with_your_priorities se recalculó con tus pesos (mismo método que los controles del mapa); las probabilidades siguen siendo con pesos por defecto.";
      }
      return out;
    },
    get_field_score({ farm_id, period }) {
      const p = Number(period ?? latest(farm_id));
      const s = D.summaries?.[`${farm_id}/${p}`];
      if (!s) return { error: `sin puntaje público para ${farm_id} ${period ?? ""}`.trim(), periods: (D.index?.farms?.[farm_id]?.periods ?? []).map(x => x.period) };
      return {
        farm_id, period: s.period, score: s.score, confidence: s.confidence, formula_version: s.formulaVersion,
        components: Object.fromEntries(Object.entries(s.components).map(([k, c]) => [k, c.value])), missing_components: s.missingComponents,
        confidence_reasons: s.confidenceReasons, gaps: s.gaps, datasets: s.sources.map(x => `${x.name}${x.detail ? ` (${x.detail})` : ""}`),
        dataHash: s.dataHash, recorded_on_chain: Boolean(s.onChain?.tx), anchor_tx: s.onChain?.tx ?? null,
        verify_url: `/verify/${s.dataHash}`, disclaimer: s.disclaimer,
        full_evidence: "El registro de evidencia completo se entrega por la API x402 (/api-docs/#evidence); aquí solo hay el resumen público.",
      };
    },
    get_climate_context({ farm_id }) {
      const c = D.climate?.[farm_id];
      if (!c) return { error: "contexto climático no disponible" };
      const pick = (o, ks) => Object.fromEntries(ks.filter(k => o && o[k] !== undefined).map(k => [k, o[k]]));
      return {
        farm_id,
        rain_mm_by_month: c.rainMonthlyMm, rain_range_mm_yr: c.rainRangeMmYr, et0_mm_day_by_month: c.et0MmDay,
        tmax_c_by_month: c.tmaxMonthly, tmin_c_by_month: c.tminMonthly, trend_t2m: c.trendT2m, frost_days_power_cell: c.frostDaysPowerCell,
        ecostress: pick(c.ecostress, ["etMonthly", "totalValid", "first", "last", "unit", "note"]),
        ndvi: pick(c.ndvi, ["monthly", "source", "note"]), smap: c.smap ?? null, provenance: c.provenance,
        warnings: [
          farm_id !== "algarrobal" ? "Carumas y Samegua comparten una celda de NASA POWER a gran altura: para Samegua se prefiere ERA5-Land en temperatura." : null,
          "GPM IMERG pendiente: la lluvia viene de CHIRPS v3 (con POWER y ERA5 como rango).",
        ].filter(Boolean),
      };
    },
    get_backtest({ farm_id }) {
      const B = D.backtest, f = B?.farms?.[farm_id];
      if (!f) return { error: "retrosimulación no disponible para esta parcela" };
      return {
        farm_id, label: B.label.es, source: B.source, seasons_note: B.seasonsNote.es, method: B.method.es,
        failure_metric: f.metric === "wrsi_anomaly" ? "anomalía de WRSI (% de la mediana 1991–2020 del cultivo)" : "WRSI absoluto (oferta modelada vs demanda)",
        strategies: Object.entries(f.strategies).map(([id, s]) => ({ id, name_es: s.name?.es, current: s.current, recommended: s.recommended,
          seasons_tested: s.seasons, range: `${s.first}–${s.last}`, seasons_failed: s.failAny, water_failures: s.failWater, frost_failures: s.failFrost,
          stress_seasons_wrsi_lt80: s.stress, worst_season: s.worstSeason, worst_wrsi: s.worstWrsi, enso: s.enso,
          tests: s.tests, failed_seasons: s.strip.filter(x => x[2]).map(x => x[0]) })),
        raw_power_tmin_without_altitude_correction: f.rawTminFrost,
        named_years: (B.namedYears ?? []).map(n => ({ title: n.title, text_es: n.text.es })),
      };
    },
    get_risk_calendar({ farm_id, strategy_id }) {
      const a = D.si?.[farm_id];
      if (!a) return { error: "análisis no disponible" };
      const sid = strategy_id ?? a.compare.strategies.find(s => s.current)?.id;
      const r = a.risk?.strategies?.[sid];
      if (!r) return { error: `estrategia desconocida; opciones: ${Object.keys(a.risk?.strategies ?? {}).join(", ")}` };
      const by_month = MONTHS.map((m, i) => { const top = (r.grid ?? []).reduce((b, h) => (!b || h.monthly[i] > b.monthly[i] ? h : b), null); return { month: m, top_hazard: top?.hazard ?? null, probability: top ? r1(top.monthly[i]) : null }; });
      const seasons = sid === "current" ? a.seasons?.observed : a.seasons?.[sid];
      const season = D.season?.[farm_id];
      return { farm_id, strategy_id: sid, peak: r.peak, vulnerable_months: r.vulnerableMonths, by_month, bare_soil_windows: seasons?.bareWindows ?? [],
        observed_ndvi_by_month_s2: season?.ndviS2 ?? null, bare_threshold_ndvi: season?.bareThreshold ?? null };
    },
  };
}

/** Same cleaning as agent.py: user/assistant text only, merge consecutive roles, start with a user turn, cap length. */
export function cleanHistory(messages) {
  const out = [];
  for (const m of Array.isArray(messages) ? messages : []) {
    const role = m?.role === "assistant" || m?.role === "agent" ? "assistant" : m?.role === "user" ? "user" : null;
    const content = typeof m?.content === "string" ? m.content.trim().slice(0, LIMITS.chars) : "";
    if (!role || !content) continue;
    if (out.length && out.at(-1).role === role) out.at(-1).content += "\n" + content;
    else out.push({ role, content });
  }
  while (out.length && out[0].role === "assistant") out.shift();
  return out.slice(-LIMITS.messages);
}

function farmContext(D, farmId, lang) {
  const farms = D.farms ?? [];
  const f = farms.find(x => x.id === farmId);
  const names = farms.map(x => `${x.id} (${x.label?.es ?? x.id})`).join(", ");
  if (!f) return `Parcelas disponibles: ${names}. Pregunta al usuario cuál es la suya.`;
  return `CONTEXTO: el usuario está viendo la parcela '${f.id}' (${f.label?.es}), ${f.crop?.es ?? ""}, ${f.ha} ha, ${Math.round(f.elevation_m ?? 0)} m. Parcelas disponibles: ${names}. Idioma preferido: ${lang}. Usa tus herramientas con este farm_id salvo que el usuario hable de otra parcela.`;
}

// Slider priorities from the /app drawer (water, soil, income), so CERES re-ranks the same way the farmer sees it.
export function priorityContext(p) {
  if (!p || typeof p !== "object") return "";
  const n = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null);
  const w = n(p.water), so = n(p.soil), inc = n(p.income);
  if (w === null || so === null || inc === null || w + so + inc === 0) return "";
  const pct = (v) => Math.round(v * 100);
  return `\nPRIORIDADES DEL USUARIO (deslizadores del panel): agua ${pct(w)}, suelo ${pct(so)}, ingreso ${pct(inc)}. Si hablas de la mejor opción, llama a get_farm_analysis con water=${w}, soil=${so}, income=${inc} y usa ranking_with_your_priorities. Si tu ranking no coincide con la opción que el panel muestra primero, dilo con claridad: el panel ordena con índices de ejemplo y el motor SI también pesa déficit hídrico y riesgo.`;
}

// Questions asked by voice are answered out loud: short, warm, spoken sentences (no lists, symbols or hashes).
const VOICE_STYLE = {
  es: "MODO VOZ: tu respuesta se leerá en voz alta. Habla como una persona cercana y cálida: 2 a 4 frases cortas, máximo unas 70 palabras, sin listas, viñetas, flechas, símbolos ni códigos o hashes. Di los números como se dicen (\"unos 126 milímetros al año\"). Si hay más detalle, ofrece contarlo con una pregunta corta al final. Mantén el recordatorio de revisarlo con la Agencia Agraria o INIA cuando des una recomendación.",
  en: "VOICE MODE: your answer will be read aloud. Speak like a warm, friendly person: 2 to 4 short sentences, about 70 words at most, no lists, bullets, arrows, symbols, codes or hashes. Say numbers the way people say them (\"about 126 millimeters a year\"). If there is more detail, offer it with a short question at the end. Keep the reminder to check with the Agencia Agraria or INIA when you recommend something.",
};

const json = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });

/**
 * @param {{data: object, env?: object, fetchImpl?: typeof fetch, now?: () => number}} o
 * @returns {(req: Request) => Promise<Response>}
 */
export function createChatHandler({ data, env = process.env, fetchImpl = fetch, now = () => Date.now() }) {
  const tools = makeTools(data);
  const hits = new Map();
  const system = [
    { type: "text", text: [PERSONA, RULES, "CONOCIMIENTO:\n" + (data.knowledge ?? "")].join("\n\n"), cache_control: { type: "ephemeral" } },
  ];

  return async function handle(req) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST" } });
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, { allow: "POST" });
    const access = resolveModelAccess(env);
    if (!access) {
      console.error("ceres chat: no model credentials", JSON.stringify(presence(env)));
      return json(503, { error: "ceres_not_configured", detail: "No model credentials on this function instance (ANTHROPIC_API_KEY / Netlify AI Gateway)." });
    }
    const key = access.key;

    // Best-effort abuse guard (per function instance): the endpoint spends model credits.
    const ip = req.headers.get("x-nf-client-connection-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
    const t = now(), list = (hits.get(ip) ?? []).filter(x => t - x < LIMITS.windowMs);
    if (list.length >= LIMITS.perIp) return json(429, { error: "rate_limited", detail: "Too many questions; please wait a few minutes." }, { "retry-after": "120" });
    list.push(t); hits.set(ip, list);

    let body;
    try {
      const raw = await req.text();
      if (raw.length > LIMITS.body) return json(413, { error: "too_large" });
      body = JSON.parse(raw || "{}");
    } catch { return json(400, { error: "bad_json" }); }
    const farmId = FARM_IDS.includes(body.farmId) ? body.farmId : "samegua";
    const lang = body.lang === "en" ? "en" : "es";
    const history = cleanHistory(body.messages);
    if (!history.length) history.push({ role: "user", content: lang === "es" ? "Hola" : "Hello" });

    const params = {
      model: env.CERES_TEXT_MODEL || DEFAULT_MODEL, max_tokens: 1200, tools: TOOLS,
      system: [...system, { type: "text", text: farmContext(data, farmId, lang) + priorityContext(body.priorities) + (body.mode === "voice" ? "\n\n" + VOICE_STYLE[lang] : "") }],
    };
    const trace = [];
    try {
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const r = await fetchImpl(access.url, { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ ...params, messages: history }) });
        if (!r.ok) {
          console.error("ceres chat: model API", r.status, access.via, (await r.text()).slice(0, 200));
          return json(502, { error: "model_unavailable" });
        }
        const msg = await r.json();
        const text = (msg.content ?? []).filter(b => b.type === "text").map(b => b.text).join("").trim();
        if (msg.stop_reason !== "tool_use") return json(200, { agent: "CERES", reply: text || (lang === "es" ? "No tengo una respuesta ahora." : "I don't have an answer right now."), model: msg.model ?? params.model, toolCalls: trace.map(({ name, input }) => ({ name, input })), proofs: proofsOf(trace) });
        history.push({ role: "assistant", content: msg.content });
        const results = [];
        for (const b of msg.content ?? []) {
          if (b.type !== "tool_use") continue;
          let out;
          try {
            const fn = tools[b.name];
            out = !fn ? { error: "herramienta desconocida" } : !FARM_IDS.includes(b.input?.farm_id) ? { error: `farm_id debe ser uno de ${FARM_IDS.join(", ")}` } : fn(b.input);
          } catch (e) { out = { error: `${e?.name ?? "Error"}: ${String(e?.message ?? e).slice(0, 120)}` }; }
          trace.push({ name: b.name, input: b.input, output: out });
          results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out) });
        }
        history.push({ role: "user", content: results });
      }
      return json(200, { agent: "CERES", reply: lang === "es" ? "Necesito un momento más; pregúntame de nuevo." : "I need a moment more; please ask again.", toolCalls: [], proofs: proofsOf(trace) });
    } catch (e) {
      console.error("ceres chat:", String(e?.message ?? e).slice(0, 200));
      return json(502, { error: "model_unavailable" });
    }
  };
}

/** Proof chips for the widget: public record handles behind this answer (no payment: the agent reads public data). */
function proofsOf(trace) {
  return trace.filter(t => t.name === "get_field_score" && t.output && !t.output.error).map(t => ({
    farmId: t.output.farm_id, period: String(t.output.period), dataHash: t.output.dataHash, placeholder: false,
    recordedOnChain: t.output.recorded_on_chain, payment: null,
  }));
}
