/* CERES — voice of the CERES Ventures SI. Floating panel on every page:
   summary · text chat (Claude via the oracle) · voice conversation (speak → CERES answers out loud) · Retell call (optional).
   Voice out: natural server voice (/v1/ceres/voice, ElevenLabs) when configured, else the warmest voice the browser has.
   Voice in: the browser's speech recognition (Chrome, Edge, Safari). Lives outside #app so app.js re-renders never wipe it. */
(() => {
  "use strict";
  const CFG = window.AGUA_CLARA_CONFIG || {};
  const ORACLE = (CFG.oracleUrl || "").replace(/\/$/, "");
  const VOICE_ON = Boolean(CFG.retellPublicKey && CFG.retellAgentId);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const CAN_TALK = Boolean(SR && ORACLE);
  const CAN_SPEAK = "speechSynthesis" in window || Boolean(ORACLE);
  const FX = window.AGUA_SI_FIXTURES || {};
  const E = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const T = (es, en) => (ctx().lang === "es" ? es : en);
  const ctx = () => window.AguaClara.ctx || { farm: "samegua", lang: "es" };
  const FARM_NAMES = { carumas: "Carumas", samegua: "Samegua", algarrobal: "El Algarrobal" };

  // speaking: null | "summary" | message index · convo: hands-free voice conversation is on · serverVoice: null unknown
  const S = { open: false, chats: {}, busy: false, err: "", call: null, callStatus: "", live: [], speaking: null, loadingVoice: false,
    shown: "", listening: false, interim: "", convo: false, serverVoice: null };
  let rec = null, player = null, unlocked = false, speakToken = 0;

  const root = document.createElement("div");
  root.id = "ceres";
  document.body.appendChild(root);

  const summary = () => {
    const c = ctx();
    const v = window.AguaClara.voice?.[c.farm] || FX[c.farm]?.voice;
    return v?.[c.lang]?.text || "";
  };

  const ICON = {
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 1 0-7 0v5A3.5 3.5 0 0 0 12 15Zm6-3.5a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.9V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.6a6 6 0 0 0 5-5.9Z" fill="currentColor"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Zm-2.5-8.8v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z" fill="currentColor"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>',
  };

  function launcher() {
    return `<button type="button" class="ceres-fab" data-ceres="toggle" aria-expanded="${S.open}" aria-controls="ceres-panel">
      <span class="ceres-orb${S.speaking !== null ? " talking" : ""}" aria-hidden="true"></span><span><b>CERES</b><small>${CAN_TALK ? T("Habla conmigo", "Talk to me") : T("Voz de la SI", "Voice of the SI")}</small></span></button>`;
  }

  function sayBtn(id, text, label) {
    if (!CAN_SPEAK || !text) return "";
    const on = S.speaking === id;
    return `<button type="button" class="ceres-say${on ? " on" : ""}" data-ceres-say="${id}" aria-label="${on ? T("Detener", "Stop") : T("Escuchar", "Listen")}">${on ? ICON.stop : ICON.play}<span>${on ? (S.loadingVoice ? T("Cargando voz…", "Loading voice…") : T("Detener", "Stop")) : (label || T("Escuchar", "Listen"))}</span></button>`;
  }

  function talkLabel() {
    if (S.listening) return T("Te escucho… habla ahora", "Listening… speak now");
    if (S.convo && S.busy) return T("CERES está pensando…", "CERES is thinking…");
    if (S.convo && S.speaking !== null) return T("CERES está hablando · toca para parar", "CERES is speaking · tap to stop");
    return T("Hablar con CERES", "Talk to CERES");
  }

  function panel() {
    if (!S.open) return "";
    const c = ctx(), log = S.chats[c.farm] || [];
    const chips = [T("¿Por qué esa rotación?", "Why that rotation?"), T("¿Cuáles son los vacíos de esa estrategia?", "What are that strategy's information gaps?"), T("¿Qué riesgos debo revisar con INIA?", "Which risks should I check with INIA?"), T("¿Qué es el NDVI?", "What is NDVI?"), T("¿Dónde está el registro verificable?", "Where is the verifiable record?")];
    const hint = !ORACLE ? T("Para conversar, conecta el oráculo en config.js. Mientras tanto, puedes escuchar el resumen.", "To chat, connect the oracle in config.js. Meanwhile you can listen to the summary.")
      : CAN_TALK ? T("Toca «Hablar con CERES» y pregúntame en voz alta, o escribe abajo. Te respondo con mi voz.", "Tap “Talk to CERES” and ask out loud, or type below. I'll answer with my voice.")
      : T("Escríbeme tu pregunta abajo. Toca «Escuchar» en cualquier respuesta para oírla.", "Type your question below. Tap “Listen” on any answer to hear it.");
    return `<section id="ceres-panel" class="ceres-panel" role="dialog" aria-label="CERES">
      <header><span class="ceres-orb${S.speaking !== null ? " talking" : ""}${S.listening ? " listening" : ""}" aria-hidden="true"></span><div><b>CERES</b><small>${T("Voz de la superinteligencia", "Voice of the superintelligence")} · ${E(FARM_NAMES[c.farm] || c.farm)}</small></div>
        <button type="button" class="ceres-x" data-ceres="close" aria-label="${T("Cerrar", "Close")}">×</button></header>
      <div class="ceres-body">
        <p class="ceres-summary">${E(summary())}</p>
        ${CAN_TALK ? `<button type="button" class="ceres-talk${S.convo ? " live" : ""}${S.listening ? " listening" : ""}" data-ceres="talk" aria-pressed="${S.convo}">
            <span class="ceres-talk-ic">${S.convo && !S.listening ? ICON.stop : ICON.mic}</span><span class="ceres-talk-tx"><b>${talkLabel()}</b><small>${S.convo ? T("Toca para terminar la conversación", "Tap to end the conversation") : T("Pregunta en voz alta · te respondo hablando", "Ask out loud · I answer out loud")}</small></span>
            ${S.listening ? '<span class="ceres-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' : ""}</button>` : ""}
        <div class="ceres-row">
          ${VOICE_ON ? `<button type="button" class="ceres-btn ${S.call ? "danger" : "primary"}" data-ceres="call">${S.call ? T("Colgar", "Hang up") : T("Llamar a CERES", "Call CERES")}</button>` : ""}
          ${sayBtn("summary", summary(), T("Escuchar resumen", "Listen to summary"))}
          <button type="button" class="ceres-btn ghost" data-ceres="analysis">${T("Ver análisis SI", "See SI analysis")}</button>
        </div>
        ${S.callStatus ? `<p class="ceres-status">${E(S.callStatus)}</p>` : ""}
        ${S.call && S.live.length ? `<div class="ceres-live">${S.live.map((l) => `<p class="${l.role === "agent" ? "c" : "u"}">${E(l.content)}</p>`).join("")}</div>` : ""}
        <div class="ceres-log" id="ceres-log" aria-live="polite">
          ${log.length ? log.map((m, i) => m.role === "assistant"
            ? `<div class="ceres-msg"><p class="c">${E(m.content)}</p><div class="ceres-msg-foot">${sayBtn(i, m.content)}${proofChips(m.proofs)}</div></div>`
            : `<p class="u">${E(m.content)}</p>`).join("") : `<p class="ceres-hint">${hint}</p>`}
          ${S.listening && S.interim ? `<p class="u interim">${E(S.interim)}…</p>` : ""}
          ${S.busy ? `<p class="c thinking">${T("Revisando los datos del satélite…", "Checking the satellite data…")}</p>` : ""}
          ${S.err ? `<p class="ceres-err">${E(S.err)}</p>` : ""}
        </div>
        <div class="ceres-chips">${chips.map((q) => `<button type="button" data-ceres-ask="${E(q)}" ${!ORACLE || S.busy ? "disabled" : ""}>${E(q)}</button>`).join("")}</div>
        <form class="ceres-form" data-ceres-form><label for="ceres-q" class="ceres-sr">${T("Tu pregunta", "Your question")}</label>
          <input id="ceres-q" maxlength="600" autocomplete="off" placeholder="${T("Escribe tu pregunta", "Type your question")}" ${!ORACLE || S.busy ? "disabled" : ""}>
          <button type="submit" class="ceres-btn primary" ${!ORACLE || S.busy ? "disabled" : ""}>${T("Enviar", "Send")}</button></form>
        <p class="ceres-safe">${T("CERES no reemplaza al técnico de la Agencia Agraria ni al INIA. Nunca pida claves ni frases de recuperación. Voz y respuestas generadas por SI.", "CERES does not replace the Agencia Agraria or INIA technician. Never share keys or recovery phrases. Voice and answers are SI-generated.")}</p>
      </div></section>`;
  }

  // Proof behind an answer: the record fingerprint and, when CERES paid the oracle via x402, the settlement tx.
  function proofChips(proofs) {
    if (!proofs || !proofs.length) return "";
    return `<div class="ceres-proofs">${proofs.map((p) => {
      const label = p.placeholder ? T("Datos de ejemplo", "Example data") : T("Registro verificable ✔", "Verifiable record ✔");
      const tx = p.payment && p.payment.txUrl;
      return tx
        ? `<a class="ceres-proof" href="${E(tx)}" target="_blank" rel="noopener noreferrer" title="${T("CERES compró este dato al oráculo con x402", "CERES bought this data from the oracle via x402")}${p.payment.roundTripMs ? ` · ${p.payment.roundTripMs} ms` : ""}">${label} · ${T("ver prueba", "view proof")}</a>`
        : `<span class="ceres-proof" title="${E(p.dataHash || "")}">${label} · ${E((p.dataHash || "").slice(0, 10))}…</span>`;
    }).join("")}</div>`;
  }

  function paint(focusInput = false) {
    const typing = document.activeElement?.id === "ceres-q" ? document.activeElement.value : null;
    root.innerHTML = launcher() + panel();
    const log = document.getElementById("ceres-log");
    if (log) log.scrollTop = log.scrollHeight;
    const inp = document.getElementById("ceres-q");
    if (inp && typing !== null && !S.busy) { inp.value = typing; inp.focus(); }
    else if (focusInput && !S.convo) inp?.focus();
  }

  async function ask(q, { voice = false } = {}) {
    const c = ctx(), text = q.trim();
    if (!text || S.busy || !ORACLE) return;
    const log = (S.chats[c.farm] = [...(S.chats[c.farm] || []), { role: "user", content: text }]);
    S.busy = true; S.err = ""; paint();
    let reply = "";
    try {
      const r = await fetch(`${ORACLE}/v1/ceres/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ farmId: c.farm, lang: c.lang, mode: voice ? "voice" : "text", messages: log.slice(-30).map(({ role, content }) => ({ role, content })) }) });
      if (!r.ok) throw new Error(r.status === 503 ? "off" : r.status === 429 ? "busy" : "http");
      const data = await r.json();
      reply = data.reply || "";
      S.chats[c.farm] = [...log, { role: "assistant", content: reply, proofs: data.proofs || [] }];
    } catch (e) {
      S.err = e.message === "off" ? T("CERES aún no tiene su clave de Claude configurada en el oráculo.", "CERES doesn't have its Claude key configured on the oracle yet.")
        : e.message === "busy" ? T("Muchas preguntas seguidas. Espera un par de minutos y vuelve a intentar.", "Lots of questions in a row. Wait a couple of minutes and try again.")
        : T("CERES no pudo responder. Intenta de nuevo.", "CERES couldn't answer. Please try again.");
      S.convo = false;
    } finally {
      S.busy = false; paint(true);
    }
    if (reply && voice && S.convo) say(reply, S.chats[c.farm].length - 1);
  }

  // ---------- voice out ----------
  // Text as it should be spoken (mirrors speakable() on the server for the browser fallback).
  function speakable(text) {
    const es = ctx().lang === "es";
    return String(text || "")
      .replace(/https?:\/\/\S+/g, "").replace(/0x[0-9a-f]{8,}\S*/gi, es ? "el registro" : "the record")
      .replace(/\*\*|__|`|#+\s/g, "").replace(/^[ \t]*[-*•][ \t]+/gm, "")
      .replace(/\s*→\s*/g, es ? ", luego " : ", then ")
      .replace(/m³\/ha/g, es ? "metros cúbicos por hectárea" : "cubic meters per hectare")
      .replace(/(\d)\s?mm\b/g, es ? "$1 milímetros" : "$1 millimeters").replace(/(\d)\s?ha\b/g, es ? "$1 hectáreas" : "$1 hectares")
      .replace(/(\d)\s?%/g, es ? "$1 por ciento" : "$1 percent").replace(/\bINIA\b/g, "I N I A")
      .replace(/\n{2,}/g, ". ").replace(/\n/g, ", ").replace(/([.,;:])\s*[.,]+/g, "$1").replace(/\s{2,}/g, " ").trim();
  }

  // Warmest voice the device offers: neural/natural voices first, then Google, then known soft female voices.
  function bestVoice() {
    const es = ctx().lang === "es", all = speechSynthesis.getVoices();
    const pool = all.filter((v) => v.lang.toLowerCase().startsWith(es ? "es" : "en"));
    const score = (v) => {
      const n = v.name.toLowerCase(), l = v.lang.toLowerCase();
      let s = 0;
      if (/natural|neural|premium|enhanced|mejorad/.test(n)) s += 60;
      if (/online/.test(n)) s += 20;
      if (/google/.test(n)) s += 25;
      if (/(dalia|paulina|m[oó]nica|elvira|sabina|helena|paloma|camila|salom[eé]|marisol|francisca|elena|valentina|ximena|luc[ií]a|isabela|renata|larissa|soledad|catalina|marina|ana\b|samantha|ava|allison|aria|jenny|emma|zoe|serena|michelle|libby)/.test(n)) s += 18;
      if (/(jorge|diego|pablo|ra[uú]l|[aá]lvaro|enrique|carlos|juan|andr[eé]s|gerardo|tom[aá]s|daniel|alex\b|fred|guy|jorge|eddy|reed|rocko|grandpa|grandma|albert|bad news|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|kathy)/.test(n)) s -= 40;
      if (es && /es-(pe|419|mx|us|co|cl|ar)/.test(l)) s += 8;
      return s;
    };
    return pool.sort((a, b) => score(b) - score(a))[0] || null;
  }

  function stopSpeaking() {
    speakToken++;
    if (player) { try { player.pause(); } catch (e) {} }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    S.speaking = null; S.loadingVoice = false;
  }

  // 0.1 s of silence as a valid WAV (built in code, no binary blob in the source).
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
    player = new Audio();
    player.src = silentWav();
    player.play().catch(() => {});
    if ("speechSynthesis" in window) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); }
  }

  async function checkServerVoice() {
    if (S.serverVoice !== null || !ORACLE) return;
    try { const r = await fetch(`${ORACLE}/v1/ceres/voice`); S.serverVoice = r.ok && (await r.json()).enabled === true; }
    catch (e) { S.serverVoice = false; }
  }

  async function say(text, id) {
    stopSpeaking();
    const token = speakToken, c = ctx();
    S.speaking = id; paint();
    const done = () => { if (token !== speakToken) return; S.speaking = null; S.loadingVoice = false; paint(); if (S.convo) setTimeout(() => S.convo && !S.busy && listen(), 250); };
    await checkServerVoice();
    if (token !== speakToken) return;
    if (S.serverVoice) {
      S.loadingVoice = true; paint();
      try {
        const r = await fetch(`${ORACLE}/v1/ceres/voice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang: c.lang }) });
        if (token !== speakToken) return;
        if (r.ok) {
          const url = URL.createObjectURL(await r.blob());
          if (token !== speakToken) return;
          player = player || new Audio();
          player.onended = () => { URL.revokeObjectURL(url); done(); };
          player.onerror = () => { URL.revokeObjectURL(url); browserSay(text, token, done); };
          player.src = url;
          S.loadingVoice = false; paint();
          await player.play();
          return;
        }
        if (r.status === 503) S.serverVoice = false;
      } catch (e) { /* fall back to the browser voice */ }
      if (token !== speakToken) return;
      S.loadingVoice = false;
    }
    browserSay(text, token, done);
  }

  // Browser fallback: sentence by sentence (Chrome cuts long utterances), slightly slower and brighter = warmer.
  function browserSay(text, token, done) {
    if (!("speechSynthesis" in window)) { done(); return; }
    const parts = speakable(text).match(/[^.!?¿¡]+[.!?]*|[¿¡][^?!]+[?!]/g) || [speakable(text)];
    const voice = bestVoice(), lang = ctx().lang === "es" ? "es-PE" : "en-US";
    speechSynthesis.cancel();
    parts.map((p) => p.trim()).filter(Boolean).forEach((p, i, arr) => {
      const u = new SpeechSynthesisUtterance(p);
      if (voice) u.voice = voice;
      u.lang = voice?.lang || lang; u.rate = 0.94; u.pitch = 1.12; u.volume = 1;
      if (i === arr.length - 1) { u.onend = done; u.onerror = done; }
      speechSynthesis.speak(u);
    });
    if (token === speakToken) paint();
  }

  // ---------- voice in ----------
  function listen() {
    if (!SR || S.listening || S.busy) return;
    stopSpeaking();
    let finalText = "", failed = "";
    rec = new SR();
    rec.lang = ctx().lang === "es" ? "es-PE" : "en-US";
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
      if (failed === "not-allowed" || failed === "service-not-allowed") S.err = T("Necesito permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones.", "I need microphone permission. Turn it on from the lock icon in the address bar.");
      else if (failed && failed !== "no-speech" && failed !== "aborted") S.err = T("No pude escucharte. Intenta otra vez o escribe tu pregunta.", "I couldn't hear you. Try again or type your question.");
      paint();
    };
    S.listening = true; S.interim = ""; S.err = ""; paint();
    try { rec.start(); } catch (e) { S.listening = false; S.convo = false; paint(); }
  }

  function endConversation() {
    S.convo = false;
    if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
    S.listening = false; S.interim = "";
    stopSpeaking(); paint();
  }

  function toggleTalk() {
    if (S.convo || S.listening) { endConversation(); return; }
    unlockAudio(); checkServerVoice();
    S.convo = true; listen();
  }

  function toggleSay(id) {
    if (S.speaking === String(id) || S.speaking === id) { S.convo = false; stopSpeaking(); paint(); return; }
    unlockAudio();
    const c = ctx();
    const text = id === "summary" ? summary() : (S.chats[c.farm] || [])[Number(id)]?.content;
    if (text) { S.convo = false; say(text, id === "summary" ? "summary" : Number(id)); }
  }

  async function toggleCall() {
    if (S.call) { try { await S.call.end(); } catch (e) {} S.call = null; S.callStatus = T("Llamada terminada", "Call ended"); paint(); return; }
    endConversation();
    S.callStatus = T("Conectando…", "Connecting…"); S.live = []; paint();
    try {
      const { RetellClient } = await import("https://cdn.jsdelivr.net/npm/retell-client-js-sdk@3.0.3/+esm");
      const client = new RetellClient({ key: CFG.retellPublicKey });
      const c = ctx();
      S.call = client.createWebCall({
        agent_id: CFG.retellAgentId,
        metadata: { farmId: c.farm, lang: c.lang },
        transcript: true,
        hooks: {
          onStatus: (st) => { S.callStatus = st === "live" ? T("En llamada con CERES", "On the call with CERES") : st === "ended" ? T("Llamada terminada", "Call ended") : T("Conectando…", "Connecting…"); if (st === "ended") S.call = null; paint(); },
          onTranscript: (t) => { S.live = t.filter((u) => "content" in u && "role" in u).slice(-4).map((u) => ({ role: u.role, content: u.content })); paint(); },
          onEnd: () => { S.call = null; S.callStatus = T("Llamada terminada", "Call ended"); paint(); },
          onError: () => { S.call = null; S.callStatus = T("No se pudo conectar la llamada.", "Couldn't connect the call."); paint(); },
        },
      });
    } catch (e) {
      S.call = null; S.callStatus = T("No se pudo conectar la llamada.", "Couldn't connect the call."); paint();
    }
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest?.('[data-action="ceres-open"]')) { S.open = true; paint(true); checkServerVoice(); return; }
    const a = e.target.closest?.("[data-ceres]")?.dataset.ceres;
    if (a === "toggle") { S.open = !S.open; if (!S.open) endConversation(); paint(S.open); checkServerVoice(); }
    else if (a === "close") { S.open = false; endConversation(); }
    else if (a === "talk") toggleTalk();
    else if (a === "call") toggleCall();
    else if (a === "analysis") { S.open = false; endConversation(); window.AguaClara.go?.("intel"); }
    const say = e.target.closest?.("[data-ceres-say]");
    if (say) toggleSay(say.dataset.ceresSay);
    const q = e.target.closest?.("[data-ceres-ask]");
    if (q) { S.convo = false; stopSpeaking(); ask(q.dataset.ceresAsk); }
  });
  document.addEventListener("submit", (e) => {
    if (!e.target.matches?.("[data-ceres-form]")) return;
    e.preventDefault();
    const inp = document.getElementById("ceres-q");
    const v = inp?.value || "";
    if (inp) inp.value = "";
    S.convo = false; stopSpeaking();
    ask(v);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.open) { S.open = false; endConversation(); } });
  if ("speechSynthesis" in window) speechSynthesis.getVoices(); // starts the async voice list load

  window.AguaClara.hooks.push((c) => {
    const k = c.farm + c.lang;
    if (k !== S.shown) { S.shown = k; if (S.convo || S.speaking !== null || S.listening) endConversation(); else paint(); }
  });
  paint();
})();
