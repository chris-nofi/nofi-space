// CERES inside the /app field drawer (task C1): text chat (POST /v1/ceres/chat) + voice conversation.
// Voice in: the browser's speech recognition (Chrome, Edge, Safari). Voice out: natural server voice (/v1/ceres/voice,
// ElevenLabs) when configured, else the warmest voice the browser has. Answers come only from the public summaries the
// chat function is grounded in; no Retell call is offered here (not configured on the live site).
import { esc } from "./data.js";

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const T = {
  es: {
    title: "CERES", sub: "Asistente de la chacra · responde en español",
    talk: "Hablar con CERES", talkSub: "Pregunta en voz alta · te respondo hablando", stopTalk: "Toca para terminar la conversación",
    listening: "Te escucho… habla ahora", thinking: "CERES está pensando…", speaking: "CERES está hablando · toca para parar",
    listen: "Escuchar", stop: "Detener", loadingVoice: "Cargando voz…", send: "Enviar", ph: "Escribe tu pregunta", q: "Tu pregunta",
    working: "Revisando los datos del satélite…", off: "CERES aún no tiene su clave configurada. Vuelve a intentar más tarde.",
    busy: "Muchas preguntas seguidas. Espera un par de minutos.", fail: "CERES no pudo responder. Intenta de nuevo.",
    mic: "Necesito permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones.", noHear: "No pude escucharte. Intenta otra vez o escribe tu pregunta.",
    chips: ["¿Por qué esa opción es la primera?", "¿Qué riesgos debo revisar con INIA?", "¿De dónde salen estos datos de la NASA?", "¿Qué significa la confianza?"],
    safe: "CERES apoya, no reemplaza, al técnico de la Agencia Agraria o del INIA. Respuestas y voz generadas por IA.",
    record: "Registro verificable", example: "Datos de ejemplo",
  },
  en: {
    title: "CERES", sub: "Field assistant · answers in Spanish or English",
    talk: "Talk to CERES", talkSub: "Ask out loud · I answer out loud", stopTalk: "Tap to end the conversation",
    listening: "Listening… speak now", thinking: "CERES is thinking…", speaking: "CERES is speaking · tap to stop",
    listen: "Listen", stop: "Stop", loadingVoice: "Loading voice…", send: "Send", ph: "Type your question", q: "Your question",
    working: "Checking the satellite data…", off: "CERES doesn't have its key configured yet. Try again later.",
    busy: "Lots of questions in a row. Wait a couple of minutes.", fail: "CERES couldn't answer. Please try again.",
    mic: "I need microphone permission. Turn it on from the lock icon in the address bar.", noHear: "I couldn't hear you. Try again or type your question.",
    chips: ["Why is that option first?", "Which risks should I check with INIA?", "Where does this NASA data come from?", "What does confidence mean?"],
    safe: "CERES supports, and does not replace, the Agencia Agraria or INIA technician. AI-generated answers and voice.",
    record: "Verifiable record", example: "Example data",
  },
};
const ICON = {
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 1 0-7 0v5A3.5 3.5 0 0 0 12 15Zm6-3.5a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.9V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.6a6 6 0 0 0 5-5.9Z" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Zm-2.5-8.8v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z" fill="currentColor"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>',
};

// One conversation per farm, kept across drawer re-renders, language switches and slider moves.
const chats = new Map();
const S = { el: null, farm: null, lang: "es", ctx: null, busy: false, err: "", listening: false, interim: "", convo: false,
  speaking: null, loadingVoice: false, serverVoice: null };
let rec = null, player = null, unlocked = false, token = 0;
const tt = () => T[S.lang];
const log = () => chats.get(S.farm) ?? [];

/**
 * Mount (or re-mount) CERES into `el` for one farm.
 * ctx(): { farmName, score, confidence, periodLabel, topOption, priorities:{water,soil,income} } — read fresh on each question.
 */
export function mountCeres(el, { farmId, lang, ctx }) {
  if (S.farm && S.farm !== farmId) endConversation(false);
  S.el = el; S.farm = farmId; S.lang = lang === "en" ? "en" : "es"; S.ctx = ctx; S.err = "";
  if (!chats.has(farmId)) chats.set(farmId, [{ role: "assistant", content: intro(ctx()), intro: true }]);
  else { const first = chats.get(farmId)[0]; if (first?.intro) first.content = intro(ctx()); }
  paint();
}

/** Stop listening/speaking (drawer closed or farm changed). */
export function stopCeres() { endConversation(false); }

function intro(c) {
  const es = S.lang === "es", conf = { low: es ? "confianza baja" : "low confidence", medium: es ? "confianza media" : "medium confidence", high: es ? "confianza alta" : "high confidence" }[c.confidence] ?? c.confidence;
  const eng = c.enginePick ? (es ? ` El motor SI sugiere ${c.enginePick}, porque también pesa el déficit de agua y el riesgo.` : ` The SI engine suggests ${c.enginePick}, because it also weighs water deficit and risk.`) : "";
  return es
    ? `Hola, soy CERES. ${c.farmName} tiene ${c.score ?? "—"} de 100 en ${c.periodLabel} (${conf}). Con tus prioridades de arriba, la opción número uno es ${c.topOption}.${eng} Pregúntame por qué, qué riesgos tiene o de dónde salen los datos.`
    : `Hi, I'm CERES. ${c.farmName} scores ${c.score ?? "—"} out of 100 for ${c.periodLabel} (${conf}). With your priorities above, the number one option is ${c.topOption}.${eng} Ask me why, what its risks are, or where the data comes from.`;
}

// Minimal, safe markdown for answers: escape first, then **bold** only (the model sometimes uses it).
const md = (t) => esc(t).replace(/\*\*([^*\n]{1,120})\*\*/g, "<b>$1</b>");

function talkLabel() {
  if (S.listening) return tt().listening;
  if (S.convo && S.busy) return tt().thinking;
  if (S.convo && S.speaking !== null) return tt().speaking;
  return tt().talk;
}

function sayBtn(i, text) {
  if (!text) return "";
  const on = S.speaking === i;
  return `<button type="button" class="cc-say${on ? " on" : ""}" data-cc-say="${i}" aria-label="${on ? tt().stop : tt().listen}">${on ? ICON.stop : ICON.play}<span>${on ? (S.loadingVoice ? tt().loadingVoice : tt().stop) : tt().listen}</span></button>`;
}

function proofs(list) {
  if (!list?.length) return "";
  return list.map(p => `<span class="cc-proof" title="${esc(p.dataHash || "")}">${p.placeholder ? tt().example : tt().record + " ✓"} · ${esc((p.dataHash || "").slice(0, 10))}…</span>`).join("");
}

function paint(focus = false) {
  if (!S.el || !S.el.isConnected) return;
  const typing = document.activeElement?.id === "cc-q" ? document.activeElement.value : null;
  const msgs = log();
  S.el.innerHTML = `<div class="cc">
    <div class="cc-head"><span class="cc-orb${S.speaking !== null ? " talking" : ""}${S.listening ? " listening" : ""}" aria-hidden="true"></span><div><b>${tt().title}</b><small>${tt().sub}</small></div></div>
    ${SR ? `<button type="button" class="cc-talk${S.convo ? " live" : ""}${S.listening ? " listening" : ""}" data-cc="talk" aria-pressed="${S.convo}">
      <span class="cc-talk-ic">${S.convo && !S.listening ? ICON.stop : ICON.mic}</span><span class="cc-talk-tx"><b>${talkLabel()}</b><small>${S.convo ? tt().stopTalk : tt().talkSub}</small></span>
      ${S.listening ? '<span class="cc-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' : ""}</button>` : ""}
    <div class="cc-log" id="cc-log" aria-live="polite">
      ${msgs.map((m, i) => m.role === "assistant"
        ? `<div class="cc-msg"><p class="c">${md(m.content)}</p><div class="cc-foot">${sayBtn(i, m.content)}${proofs(m.proofs)}</div></div>`
        : `<p class="u">${esc(m.content)}</p>`).join("")}
      ${S.listening && S.interim ? `<p class="u interim">${esc(S.interim)}…</p>` : ""}
      ${S.busy ? `<p class="c thinking">${tt().working}</p>` : ""}
      ${S.err ? `<p class="cc-err">${esc(S.err)}</p>` : ""}
    </div>
    <div class="cc-chips">${tt().chips.map(q => `<button type="button" data-cc-ask="${esc(q)}" ${S.busy ? "disabled" : ""}>${esc(q)}</button>`).join("")}</div>
    <form class="cc-form" data-cc-form><label for="cc-q" class="cc-sr">${tt().q}</label>
      <input id="cc-q" maxlength="600" autocomplete="off" placeholder="${tt().ph}" ${S.busy ? "disabled" : ""}>
      <button type="submit" class="btn sm" ${S.busy ? "disabled" : ""}>${tt().send}</button></form>
    <p class="cc-safe">${tt().safe}</p>
  </div>`;
  const lg = S.el.querySelector("#cc-log");
  if (lg) lg.scrollTop = lg.scrollHeight;
  const inp = S.el.querySelector("#cc-q");
  if (inp && typing !== null && !S.busy) { inp.value = typing; inp.focus(); }
  else if (focus && !S.convo) inp?.focus({ preventScroll: true });
  wire();
}

function wire() {
  S.el.querySelector('[data-cc="talk"]')?.addEventListener("click", toggleTalk);
  S.el.querySelectorAll("[data-cc-say]").forEach(b => b.addEventListener("click", () => toggleSay(Number(b.dataset.ccSay))));
  S.el.querySelectorAll("[data-cc-ask]").forEach(b => b.addEventListener("click", () => { S.convo = false; stopSpeaking(); ask(b.dataset.ccAsk); }));
  S.el.querySelector("[data-cc-form]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const inp = S.el.querySelector("#cc-q"), v = inp?.value || "";
    if (inp) inp.value = "";
    S.convo = false; stopSpeaking(); ask(v);
  });
}

async function ask(q, { voice = false } = {}) {
  const text = q.trim(), farm = S.farm;
  if (!text || S.busy) return;
  const c = S.ctx?.() ?? {};
  chats.set(farm, [...log(), { role: "user", content: text }]);
  S.busy = true; S.err = ""; paint();
  let reply = "";
  try {
    const history = chats.get(farm).filter(m => !m.intro).slice(-30).map(({ role, content }) => ({ role, content }));
    const r = await fetch("/v1/ceres/chat", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ farmId: farm, lang: S.lang, mode: voice ? "voice" : "text", priorities: c.priorities, messages: history }) });
    if (!r.ok) throw new Error(r.status === 503 ? "off" : r.status === 429 ? "busy" : "fail");
    const data = await r.json();
    reply = data.reply || "";
    chats.set(farm, [...chats.get(farm), { role: "assistant", content: reply, proofs: data.proofs || [] }]);
  } catch (e) {
    S.err = tt()[e.message] ?? tt().fail;
    S.convo = false;
  } finally {
    S.busy = false;
    if (S.farm === farm) paint(true);
  }
  if (reply && voice && S.convo && S.farm === farm) say(reply, chats.get(farm).length - 1);
}

// ---------- voice out ----------
function speakable(text) {
  const es = S.lang === "es";
  return String(text || "")
    .replace(/https?:\/\/\S+/g, "").replace(/0x[0-9a-f]{8,}\S*/gi, es ? "el registro" : "the record")
    .replace(/\*\*|__|`|#+\s/g, "").replace(/^[ \t]*[-*•][ \t]+/gm, "")
    .replace(/\s*→\s*/g, es ? ", luego " : ", then ")
    .replace(/m³\/ha(\/año|\/yr)?/g, es ? "metros cúbicos por hectárea al año" : "cubic meters per hectare per year")
    .replace(/(\d)\s?mm\b/g, es ? "$1 milímetros" : "$1 millimeters").replace(/(\d)\s?ha\b/g, es ? "$1 hectáreas" : "$1 hectares")
    .replace(/(\d)\s?%/g, es ? "$1 por ciento" : "$1 percent").replace(/\bINIA\b/g, "I N I A")
    .replace(/\n{2,}/g, ". ").replace(/\n/g, ", ").replace(/([.,;:])\s*[.,]+/g, "$1").replace(/\s{2,}/g, " ").trim();
}

function bestVoice() {
  if (!("speechSynthesis" in window)) return null;
  const es = S.lang === "es";
  const pool = speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith(es ? "es" : "en"));
  const score = (v) => {
    const n = v.name.toLowerCase(), l = v.lang.toLowerCase();
    let s = 0;
    if (/natural|neural|premium|enhanced|mejorad/.test(n)) s += 60;
    if (/online/.test(n)) s += 20;
    if (/google/.test(n)) s += 25;
    if (/(dalia|paulina|m[oó]nica|elvira|sabina|helena|paloma|camila|salom[eé]|marisol|francisca|elena|valentina|ximena|luc[ií]a|isabela|renata|soledad|catalina|marina|samantha|ava|allison|aria|jenny|emma|zoe|serena|michelle|libby)/.test(n)) s += 18;
    if (/(jorge|diego|pablo|ra[uú]l|[aá]lvaro|enrique|carlos|juan|andr[eé]s|gerardo|tom[aá]s|daniel|alex\b|fred|guy|eddy|reed|rocko|grandpa|grandma|albert|bad news|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph)/.test(n)) s -= 40;
    if (es && /es-(pe|419|mx|us|co|cl|ar)/.test(l)) s += 8;
    return s;
  };
  return pool.sort((a, b) => score(b) - score(a))[0] || null;
}

function stopSpeaking() {
  token++;
  if (player) { try { player.pause(); } catch {} }
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  S.speaking = null; S.loadingVoice = false;
}

function silentWav() {
  const n = 800, b = new ArrayBuffer(44 + n), v = new DataView(b), w = (o, t) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([b], { type: "audio/wav" }));
}

// iOS/Safari only let audio start inside a tap: prime both engines on the first tap so later replies can speak.
function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  player = new Audio(); player.src = silentWav(); player.play().catch(() => {});
  if ("speechSynthesis" in window) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); }
}

async function checkServerVoice() {
  if (S.serverVoice !== null) return;
  try { const r = await fetch("/v1/ceres/voice"); S.serverVoice = r.ok && (await r.json()).enabled === true; }
  catch { S.serverVoice = false; }
}

async function say(text, i) {
  stopSpeaking();
  const my = token;
  S.speaking = i; paint();
  const done = () => { if (my !== token) return; S.speaking = null; S.loadingVoice = false; paint(); if (S.convo) setTimeout(() => S.convo && !S.busy && listen(), 250); };
  await checkServerVoice();
  if (my !== token) return;
  if (S.serverVoice) {
    S.loadingVoice = true; paint();
    try {
      const r = await fetch("/v1/ceres/voice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, lang: S.lang }) });
      if (my !== token) return;
      if (r.ok) {
        const url = URL.createObjectURL(await r.blob());
        if (my !== token) return;
        player = player || new Audio();
        player.onended = () => { URL.revokeObjectURL(url); done(); };
        player.onerror = () => { URL.revokeObjectURL(url); browserSay(text, my, done); };
        player.src = url;
        S.loadingVoice = false; paint();
        await player.play();
        return;
      }
      if (r.status === 503) S.serverVoice = false;
    } catch { /* fall back to the browser voice */ }
    if (my !== token) return;
    S.loadingVoice = false;
  }
  browserSay(text, my, done);
}

function browserSay(text, my, done) {
  if (!("speechSynthesis" in window)) { done(); return; }
  const clean = speakable(text), parts = clean.match(/[^.!?¿¡]+[.!?]*|[¿¡][^?!]+[?!]/g) || [clean];
  const voice = bestVoice(), lang = S.lang === "es" ? "es-PE" : "en-US";
  speechSynthesis.cancel();
  parts.map(p => p.trim()).filter(Boolean).forEach((p, i, arr) => {
    const u = new SpeechSynthesisUtterance(p);
    if (voice) u.voice = voice;
    u.lang = voice?.lang || lang; u.rate = 0.94; u.pitch = 1.12;
    if (i === arr.length - 1) { u.onend = done; u.onerror = done; }
    speechSynthesis.speak(u);
  });
  if (my === token) paint();
}

// ---------- voice in ----------
function listen() {
  if (!SR || S.listening || S.busy) return;
  stopSpeaking();
  let finalText = "", failed = "";
  rec = new SR();
  rec.lang = S.lang === "es" ? "es-PE" : "en-US";
  rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    let interim = "";
    for (const r of e.results) { if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript; }
    S.interim = (finalText + " " + interim).trim(); paint();
  };
  rec.onerror = (e) => { failed = e.error; };
  rec.onend = () => {
    rec = null; S.listening = false;
    const t = (finalText || S.interim).trim(); S.interim = "";
    if (t) { ask(t, { voice: true }); return; }
    S.convo = false;
    if (failed === "not-allowed" || failed === "service-not-allowed") S.err = tt().mic;
    else if (failed && failed !== "no-speech" && failed !== "aborted") S.err = tt().noHear;
    paint();
  };
  S.listening = true; S.interim = ""; S.err = ""; paint();
  try { rec.start(); } catch { S.listening = false; S.convo = false; paint(); }
}

function endConversation(repaint = true) {
  S.convo = false;
  if (rec) { try { rec.abort(); } catch {} rec = null; }
  S.listening = false; S.interim = "";
  stopSpeaking();
  if (repaint) paint();
}

function toggleTalk() {
  if (S.convo || S.listening) { endConversation(); return; }
  unlockAudio(); checkServerVoice();
  S.convo = true; listen();
}

function toggleSay(i) {
  if (S.speaking === i) { S.convo = false; stopSpeaking(); paint(); return; }
  unlockAudio();
  const text = log()[i]?.content;
  if (text) { S.convo = false; say(text, i); }
}

if ("speechSynthesis" in window) speechSynthesis.getVoices();
