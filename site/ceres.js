/* CERES — voice of the Agua Clara SI. Floating panel on every page:
   summary (read aloud in the browser) · text chat (Claude via the oracle) · voice call (Retell).
   Lives outside #app so app.js re-renders never wipe it. */
(() => {
  "use strict";
  const CFG = window.AGUA_CLARA_CONFIG || {};
  const ORACLE = (CFG.oracleUrl || "").replace(/\/$/, "");
  const VOICE_ON = Boolean(CFG.retellPublicKey && CFG.retellAgentId);
  const FX = window.AGUA_SI_FIXTURES || {};
  const E = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const T = (es, en) => (ctx().lang === "es" ? es : en);
  const ctx = () => window.AguaClara.ctx || { farm: "samegua", lang: "es" };
  const FARM_NAMES = { carumas: "Carumas", samegua: "Samegua", algarrobal: "El Algarrobal" };

  const S = { open: false, chats: {}, busy: false, err: "", call: null, callStatus: "", live: [], speaking: false, shown: "" };

  const root = document.createElement("div");
  root.id = "ceres";
  document.body.appendChild(root);

  const summary = () => {
    const c = ctx();
    const v = window.AguaClara.voice?.[c.farm] || FX[c.farm]?.voice;
    return v?.[c.lang]?.text || "";
  };

  function launcher() {
    return `<button type="button" class="ceres-fab" data-ceres="toggle" aria-expanded="${S.open}" aria-controls="ceres-panel">
      <span class="ceres-orb" aria-hidden="true"></span><span><b>CERES</b><small>${T("Voz de la SI", "Voice of the SI")}</small></span></button>`;
  }

  function panel() {
    if (!S.open) return "";
    const c = ctx(), log = S.chats[c.farm] || [];
    const chips = [T("¿Cuánto puedo ganar?", "How much could I earn?"), T("¿Por qué esa rotación?", "Why that rotation?"), T("¿Qué es ECOSTRESS?", "What is ECOSTRESS?"), T("¿Cómo cobro en soles?", "How do I cash out in soles?")];
    return `<section id="ceres-panel" class="ceres-panel" role="dialog" aria-label="CERES">
      <header><span class="ceres-orb" aria-hidden="true"></span><div><b>CERES</b><small>${T("Voz de la superinteligencia", "Voice of the superintelligence")} · ${E(FARM_NAMES[c.farm] || c.farm)}</small></div>
        <button type="button" class="ceres-x" data-ceres="close" aria-label="${T("Cerrar", "Close")}">×</button></header>
      <div class="ceres-body">
        <p class="ceres-summary">${E(summary())}</p>
        <div class="ceres-row">
          ${"speechSynthesis" in window ? `<button type="button" class="ceres-btn ghost" data-ceres="speak">${S.speaking ? T("Detener", "Stop") : T("Escuchar", "Listen")}</button>` : ""}
          ${VOICE_ON ? `<button type="button" class="ceres-btn ${S.call ? "danger" : "primary"}" data-ceres="call">${S.call ? T("Colgar", "Hang up") : T("Llamar a CERES", "Call CERES")}</button>` : ""}
          <button type="button" class="ceres-btn ghost" data-ceres="analysis">${T("Ver análisis SI", "See SI analysis")}</button>
        </div>
        ${S.callStatus ? `<p class="ceres-status">${E(S.callStatus)}</p>` : ""}
        ${S.call && S.live.length ? `<div class="ceres-live">${S.live.map((l) => `<p class="${l.role === "agent" ? "c" : "u"}">${E(l.content)}</p>`).join("")}</div>` : ""}
        <div class="ceres-log" id="ceres-log">
          ${log.length ? log.map((m) => `<p class="${m.role === "assistant" ? "c" : "u"}">${E(m.content)}</p>`).join("") : `<p class="ceres-hint">${ORACLE ? T("Pregúntame sobre tu agua, tus rotaciones o cómo se cobra la recompensa.", "Ask me about your water, your rotations or how the reward is paid.") : T("Para conversar, conecta el oráculo en config.js. Mientras tanto, puedes escuchar el resumen.", "To chat, connect the oracle in config.js. Meanwhile you can listen to the summary.")}</p>`}
          ${S.busy ? `<p class="c thinking">${T("Revisando los datos del satélite…", "Checking the satellite data…")}</p>` : ""}
          ${S.err ? `<p class="ceres-err">${E(S.err)}</p>` : ""}
        </div>
        <div class="ceres-chips">${chips.map((q) => `<button type="button" data-ceres-ask="${E(q)}" ${!ORACLE || S.busy ? "disabled" : ""}>${E(q)}</button>`).join("")}</div>
        <form class="ceres-form" data-ceres-form><label for="ceres-q" class="ceres-sr">${T("Tu pregunta", "Your question")}</label>
          <input id="ceres-q" maxlength="600" autocomplete="off" placeholder="${T("Escribe tu pregunta", "Type your question")}" ${!ORACLE || S.busy ? "disabled" : ""}>
          <button type="submit" class="ceres-btn primary" ${!ORACLE || S.busy ? "disabled" : ""}>${T("Enviar", "Send")}</button></form>
        <p class="ceres-safe">${T("CERES nunca te pedirá tu frase de recuperación ni tus claves. Recompensas simuladas en testnet.", "CERES will never ask for your recovery phrase or keys. Rewards are simulated on testnet.")}</p>
      </div></section>`;
  }

  function paint(focusInput = false) {
    root.innerHTML = launcher() + panel();
    const log = document.getElementById("ceres-log");
    if (log) log.scrollTop = log.scrollHeight;
    if (focusInput) document.getElementById("ceres-q")?.focus();
  }

  async function ask(q) {
    const c = ctx(), text = q.trim();
    if (!text || S.busy || !ORACLE) return;
    const log = (S.chats[c.farm] = [...(S.chats[c.farm] || []), { role: "user", content: text }]);
    S.busy = true; S.err = ""; paint();
    try {
      const r = await fetch(`${ORACLE}/v1/ceres/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ farmId: c.farm, lang: c.lang, messages: log.slice(-30) }) });
      if (!r.ok) throw new Error(r.status === 503 ? "off" : "http");
      const data = await r.json();
      S.chats[c.farm] = [...log, { role: "assistant", content: data.reply }];
    } catch (e) {
      S.err = e.message === "off" ? T("CERES aún no tiene su clave de Claude configurada en el oráculo.", "CERES doesn't have its Claude key configured on the oracle yet.") : T("CERES no pudo responder. Intenta de nuevo.", "CERES couldn't answer. Please try again.");
    } finally {
      S.busy = false; paint(true);
    }
  }

  function speak() {
    if (S.speaking) { speechSynthesis.cancel(); S.speaking = false; paint(); return; }
    const u = new SpeechSynthesisUtterance(summary());
    const lang = ctx().lang, voices = speechSynthesis.getVoices();
    const want = lang === "es" ? ["es-PE", "es-419", "es-MX", "es"] : ["en-US", "en"];
    u.voice = want.map((w) => voices.find((v) => v.lang.startsWith(w))).find(Boolean) || null;
    u.lang = lang === "es" ? "es-PE" : "en-US";
    u.onend = () => { S.speaking = false; paint(); };
    S.speaking = true; speechSynthesis.speak(u); paint();
  }

  async function toggleCall() {
    if (S.call) { try { await S.call.end(); } catch (e) {} S.call = null; S.callStatus = T("Llamada terminada", "Call ended"); paint(); return; }
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
    if (e.target.closest?.('[data-action="ceres-open"]')) { S.open = true; paint(true); return; }
    const a = e.target.closest?.("[data-ceres]")?.dataset.ceres;
    if (a === "toggle") { S.open = !S.open; paint(S.open); }
    else if (a === "close") { S.open = false; paint(); }
    else if (a === "speak") speak();
    else if (a === "call") toggleCall();
    else if (a === "analysis") { S.open = false; paint(); window.AguaClara.go?.("intel"); }
    const q = e.target.closest?.("[data-ceres-ask]");
    if (q) ask(q.dataset.ceresAsk);
  });
  document.addEventListener("submit", (e) => {
    if (!e.target.matches?.("[data-ceres-form]")) return;
    e.preventDefault();
    const inp = document.getElementById("ceres-q");
    ask(inp?.value || "");
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.open) { S.open = false; paint(); } });

  window.AguaClara.hooks.push((c) => {
    const k = c.farm + c.lang;
    if (k !== S.shown) { S.shown = k; if (S.speaking) { speechSynthesis.cancel(); S.speaking = false; } paint(); }
  });
  paint();
})();
