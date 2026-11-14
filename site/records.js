/* CERES Ventures — "Registro verificable" view (plan v2).
   Farmer side: monthly NASA records with their fingerprint (dataHash) and status. No wallet, token or price.
   Partner side: how cooperatives, buyers and the CERES agent pay per query with x402 on the NØFI L1.
   Data: GET {oracleUrl}/v1/records/{farm} when config.oracleUrl is set, else window.AGUA_SI_RECORDS. */
(() => {
  "use strict";
  const CFG = window.AGUA_CLARA_CONFIG || {};
  const ORACLE = (CFG.oracleUrl || "").replace(/\/$/, "");
  const EXPLORER = (CFG.explorerUrl || "https://nofiscan.io").replace(/\/$/, "");
  const BUNDLED = window.AGUA_SI_RECORDS || {};
  const S = { live: {}, err: "", copied: "" };
  const E = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const T = (lang, es, en) => (lang === "es" ? es : en);
  const MES = { es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"], en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] };
  const stratName = (farm, id, lang) => {
    const s = ((window.AGUA_SI_FIXTURES || {})[farm]?.compare?.strategies || []).find((x) => x.id === id);
    return s ? s.name[lang] || s.name.es : id;
  };
  const period = (p, lang) => `${MES[lang][Number(p.slice(4)) - 1]} ${p.slice(0, 4)}`;
  const short = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "—");
  const num = (n, lang) => Number(n).toLocaleString(lang === "es" ? "es-PE" : "en-US");

  async function load(farm) {
    if (!ORACLE || S.live[farm]) return;
    try {
      const r = await fetch(`${ORACLE}/v1/records/${encodeURIComponent(farm)}`);
      if (!r.ok) throw new Error(String(r.status));
      S.live[farm] = (await r.json()).records;
      S.err = "";
    } catch (e) {
      S.err = "offline";
    }
    const c = window.AguaClara.ctx;
    if (c.view === "records" && c.farm === farm) paint(c);
  }

  function rows(farm) {
    return S.live[farm] || BUNDLED[farm] || [];
  }

  function status(r, lang) {
    if (r.placeholder) return `<span class="rv-chip warn">${T(lang, "Ejemplo · no anclado", "Example · not anchored")}</span>`;
    if (CFG.registryAddress) return `<a class="rv-chip ok" href="${E(EXPLORER)}/address/${E(CFG.registryAddress)}" target="_blank" rel="noopener noreferrer">${T(lang, "Anclado ✔ · ver", "Anchored ✔ · view")}</a>`;
    return `<span class="rv-chip ok">${T(lang, "Listo para anclar", "Ready to anchor")}</span>`;
  }

  function paint(ctx) {
    const root = document.getElementById("records-root");
    if (!root) return;
    const { farm, lang } = ctx;
    const list = rows(farm);
    const last = list[list.length - 1];
    const real = last && !last.placeholder;
    const saved = list.reduce((a, r) => a + (r.waterSavedM3 || 0), 0);
    root.innerHTML = `
      <article class="card rv-hero ${real ? "ok" : "warn"}">
        <span class="rv-seal" aria-hidden="true">${real ? "✔" : "…"}</span>
        <div>
          <span class="eyeline">${T(lang, "PARA EL AGRICULTOR · GRATIS", "FOR THE FARMER · FREE")}</span>
          <h3>${real ? T(lang, "Tu registro verificable de agua está guardado", "Your verifiable water record is saved") : T(lang, "Tu registro se está preparando", "Your record is being prepared")}</h3>
          <p>${real
            ? T(lang, "Cualquiera puede comprobar que estos datos de la NASA no se cambiaron. No necesitas billetera ni pagar nada.", "Anyone can check these NASA data were not changed. You don't need a wallet or to pay anything.")
            : T(lang, "Estos meses usan datos de ejemplo. Cuando lleguen las mediciones reales de ECOSTRESS, HLS y POWER, cada mes quedará guardado con su huella.", "These months use example data. Once real ECOSTRESS, HLS and POWER measurements arrive, each month is saved with its fingerprint.")}</p>
        </div>
        <div class="rv-total"><small>${T(lang, "AGUA AHORRADA ESTIMADA", "ESTIMATED WATER SAVED")}</small><strong>${num(saved, lang)} m³</strong><small>${T(lang, `${list.length} meses`, `${list.length} months`)}</small></div>
      </article>

      <article class="card">
        <div class="card-header"><div><span class="eyeline">01 / ${T(lang, "REGISTROS MENSUALES", "MONTHLY RECORDS")}</span><h3>${T(lang, "Mes a mes, con su huella digital", "Month by month, with its fingerprint")}</h3></div></div>
        <div class="rv-table-wrap"><table class="rv-table">
          <thead><tr><th>${T(lang, "Mes", "Month")}</th><th>${T(lang, "Estrategia recomendada", "Recommended strategy")}</th><th class="n">${T(lang, "Agua ahorrada", "Water saved")}</th><th>${T(lang, "Huella (dataHash)", "Fingerprint (dataHash)")}</th><th>${T(lang, "Estado", "Status")}</th></tr></thead>
          <tbody>${list.map((r) => `<tr>
            <td>${E(period(r.period, lang))}</td>
            <td>${E(stratName(farm, r.strategy, lang))}</td>
            <td class="n">${num(r.waterSavedM3, lang)} m³</td>
            <td><button type="button" class="rv-hash" data-rv-copy="${E(r.dataHash)}" title="${E(r.dataHash)}">${E(short(r.dataHash))}<span>${S.copied === r.dataHash ? T(lang, "copiado", "copied") : T(lang, "copiar", "copy")}</span></button></td>
            <td>${status(r, lang)}</td></tr>`).join("") || `<tr><td colspan="5">${T(lang, "Sin registros todavía.", "No records yet.")}</td></tr>`}
          </tbody></table></div>
        <p class="si-note">${T(lang, "La huella es un sha256 del registro completo (valores, identificadores de los datos de la NASA y versión del motor). Si cambia un solo número, la huella cambia y el contrato dice «✘ no coincide».", "The fingerprint is a sha256 of the full record (values, NASA dataset IDs and engine version). Change one number and it no longer matches: the contract says “✘ mismatch”.")}
          ${S.err ? T(lang, " Oráculo no disponible: se muestran los registros incluidos en el sitio.", " Oracle unavailable: showing the records bundled with the site.") : ""}</p>
      </article>

      <article class="card rv-partners">
        <div class="card-header"><div><span class="eyeline">02 / ${T(lang, "PARA COOPERATIVAS, COMPRADORES Y JUECES", "FOR COOPERATIVES, BUYERS AND JUDGES")}</span><h3>${T(lang, "Pago por consulta con x402 en nuestra propia L1", "Pay per query with x402 on our own L1")}</h3></div></div>
        <ol class="rv-steps">
          <li><b>402</b><span>${T(lang, "Pides el registro de una parcela y un mes; el oráculo responde «Payment Required» con el precio.", "Request one field-month record; the oracle answers “Payment Required” with the price.")}</span></li>
          <li><b>${T(lang, "Firma", "Sign")}</b><span>${T(lang, "Tu billetera firma una autorización (EIP-3009). No envías una transacción ni pagas gas.", "Your wallet signs an authorization (EIP-3009). No transaction to send, no gas.")}</span></li>
          <li><b>200</b><span>${T(lang, "El facilitador liquida el pago en la NØFI L1 y recibes el dato con el enlace a la transacción en nofiscan.", "The facilitator settles on the NØFI L1 and you get the data plus the nofiscan transaction link.")}</span></li>
          <li><b>✔</b><span>${T(lang, "El contrato WaterProofRegistry confirma que lo que compraste es exactamente lo registrado.", "The WaterProofRegistry contract confirms what you bought is exactly what was recorded.")}</span></li>
        </ol>
        <div class="rv-facts">
          <span><small>${T(lang, "Red", "Network")}</small>NØFI Chain · ${T(lang, "Avalanche L1 testnet", "Avalanche L1 testnet")} · 880024</span>
          <span><small>${T(lang, "Gas", "Gas")}</small>${T(lang, "tUSD (dólar de prueba)", "tUSD (test dollar)")}</span>
          <span><small>${T(lang, "Precio", "Price")}</small>0.05 tUSDCx ${T(lang, "por registro", "per record")}</span>
          <span><small>${T(lang, "Explorador", "Explorer")}</small><a href="${E(EXPLORER)}" target="_blank" rel="noopener noreferrer">${E(EXPLORER.replace(/^https?:\/\//, ""))}</a></span>
        </div>
        <div class="rv-actions">
          ${CFG.x402PayUrl ? `<a class="primary-btn small" href="${E(CFG.x402PayUrl)}" target="_blank" rel="noopener noreferrer">${T(lang, "Probar el pago x402", "Try the x402 payment")}</a>` : `<span class="si-note">${T(lang, "Demo de pago x402: se activa cuando el oráculo x402 esté en línea (config.js → x402PayUrl).", "x402 payment demo: turns on once the x402 oracle is online (config.js → x402PayUrl).")}</span>`}
        </div>
        <p class="si-note">${T(lang, "Red de prueba: los dólares de prueba no tienen valor. El agricultor nunca paga ni recibe pagos en este piloto.", "Testnet: test dollars have no value. Farmers never pay or get paid in this pilot.")}</p>
      </article>`;
  }

  document.addEventListener("click", async (e) => {
    const b = e.target.closest?.("[data-rv-copy]");
    if (!b) return;
    const h = b.dataset.rvCopy;
    try { await navigator.clipboard.writeText(h); } catch (err) { /* clipboard blocked: the full hash is in the title */ }
    S.copied = h;
    paint(window.AguaClara.ctx);
  });

  window.AguaClara.hooks.push((ctx) => {
    if (ctx.view !== "records") return;
    paint(ctx);
    load(ctx.farm);
  });
})();
