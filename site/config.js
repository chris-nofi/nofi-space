/* CERES Ventures site config — edit before dragging the folder into Netlify.
   Leave values empty to run fully offline (bundled SI results, no chat, no calls).
   Never put secret keys here: this file is public. */
window.AGUA_CLARA_CONFIG = {
  // Earth oracle (FastAPI). Must be HTTPS when the site is on Netlify, e.g. "https://oracle.yourdomain.com"
  oracleUrl: "",
  // Retell PUBLIC key (domain-restricted, starts with "public_key_") and the agent id from oracle/scripts/retell_setup.py
  retellPublicKey: "",
  retellAgentId: "",
  // Demo chain: Avalanche Fuji C-Chain testnet (43113) + x402. Explorer for links, WaterProofRegistry address,
  // and the public URL of the x402 payment demo (avalanche/x402/web/pagar.html) once it is online.
  explorerUrl: "https://testnet.snowtrace.io",
  registryAddress: "",
  x402PayUrl: "",
};

/* Hooks so si.js and ceres.js can redraw after app.js renders (app.js replaces #app on every render). */
window.AguaClara = window.AguaClara || {
  hooks: [],
  ctx: { view: "overview", farm: "samegua", lang: "es" },
  afterRender(ctx) {
    this.ctx = ctx;
    for (const h of this.hooks) {
      try { h(ctx); } catch (e) { console.error(e); }
    }
  },
};
