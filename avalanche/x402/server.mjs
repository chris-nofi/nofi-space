// Ceres Earth oracle behind an x402 paywall (x402 v2 HTTP transport: PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE).
// Demo network: Avalanche Fuji C-Chain (eip155:43113), paid in Circle Fuji USDC (EIP-3009). Testnet demo pricing only.
//   GET /v1/field/:id/score[?period=YYYYMM]     → 402 until paid (0.02); then ceres-field-score.v1 JSON + evidence dataHash
//   GET /v1/field/:id/evidence[?period=YYYYMM]  → 402 until paid (0.05); then the full evidence JSON + canonical dataHash
//   GET /v1/earth/:farm/:period                  → alias of /evidence in the older compact shape (kept for compatibility)
//   GET /v1/farms                                → free index (what can be bought, prices, network)
//   GET /health                                  → free
// Who pays: a judge from Core Wallet (web/pagar.html), the CERES agent, a co-op or a buyer. Farmers use the map free.
import http from "node:http";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http as viemHttp } from "viem";
import { loadConfig } from "./config.mjs";
import { loadEvidence, toResponse, toEvidenceResponse, farmsIndex, pickEvidence, dataHashOf, isPlaceholder } from "./earth-data.mjs";
import { createFacilitator } from "./facilitator.mjs";
import { fieldScore } from "./field-score.mjs";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
const unb64 = (s) => JSON.parse(Buffer.from(s, "base64").toString("utf8"));

const PRICING_NOTE = "Testnet demo pricing. Not a commercial offer.";
// Older pages and the first deploy script used "el-algarrobal"; the evidence farmKey is "moquegua:algarrobal".
const SLUG_ALIASES = { "el-algarrobal": "algarrobal" };
const normSlug = (s) => SLUG_ALIASES[s] ?? s;

const registryAbi = [{ type: "function", name: "verify", stateMutability: "view",
  inputs: [{ name: "farmId", type: "bytes32" }, { name: "period", type: "uint32" }, { name: "dataHash", type: "bytes32" }], outputs: [{ type: "bool" }] }];

/** Remote facilitator over HTTP (x402 facilitator API), or in-process one. */
function facilitatorClient(cfg, local) {
  if (!cfg.facilitatorUrl) return local;
  const post = async (path, paymentPayload, paymentRequirements) => (await fetch(cfg.facilitatorUrl + path, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ x402Version: 2, paymentPayload, paymentRequirements }) })).json();
  return { verify: (p, r) => post("/verify", p, r), settle: (p, r) => post("/settle", p, r) };
}

export function signerFromEnv(env = process.env) {
  if (env.FACILITATOR_PRIVATE_KEY) return privateKeyToAccount(env.FACILITATOR_PRIVATE_KEY); // dedicated testnet hot wallet, runtime env only
  if (env.FACILITATOR_ADDRESS) return env.FACILITATOR_ADDRESS; // unlocked node account (anvil rehearsal only)
  return null;
}

const fmtUsd = (atomic, decimals = 6) => (Number(atomic) / 10 ** decimals).toFixed(2);

/** Why paid routes can't run yet (null = ready). Free routes still work so the site can show what is for sale. */
export function configProblem(cfg) {
  if (!cfg.payTo) return "X402_PAY_TO (Ceres treasury address) is not set";
  if (!cfg.asset) return "X402_ASSET is not set (defaults to Circle Fuji USDC on 43113)";
  if (!cfg.assetName || !cfg.assetVersion) return "EIP-712 domain unknown: set X402_ASSET_NAME and X402_ASSET_VERSION to the token's name()/version()";
  return null;
}

/**
 * Transport-agnostic oracle: (method, url, headers) → { status, headers, body }.
 * Used by the Node http server below and by the Netlify Function (ceres-web/netlify/functions/oracle.mjs).
 */
export function createHandler({ cfg = loadConfig(), evidence = loadEvidence(), facilitator, allowedOrigins = process.env.ALLOWED_ORIGINS } = {}) {
  const problem = configProblem(cfg);
  const fac = facilitatorClient(cfg, facilitator ?? createFacilitator({ chain: cfg.chain, rpcUrl: cfg.rpcUrl, account: signerFromEnv() }));
  const pub = createPublicClient({ chain: cfg.chain, transport: viemHttp(cfg.rpcUrl) });
  const prices = cfg.prices ?? { score: cfg.priceAtomic, evidence: cfg.priceAtomic };
  const origins = allowedOrigins ? String(allowedOrigins).split(",").map(s => s.trim()).filter(Boolean) : null;

  const requirementsFor = (amount) => ({
    scheme: "exact", network: cfg.network, amount, asset: cfg.asset, payTo: cfg.payTo,
    maxTimeoutSeconds: cfg.maxTimeoutSeconds,
    extra: { assetTransferMethod: "eip3009", name: cfg.assetName, version: cfg.assetVersion },
  });

  const send = (req, res, status, body, headers = {}) => {
    const origin = req.headers.origin;
    const allow = !origins ? "*" : origins.includes(origin) ? origin : origins[0];
    res.status = status;
    res.headers = { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": allow, vary: "Origin",
      "access-control-allow-headers": "PAYMENT-SIGNATURE, content-type",
      "access-control-expose-headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE", "cache-control": "no-store", ...headers };
    res.body = status === 204 ? "" : JSON.stringify(body, null, 2);
    return res;
  };

  async function onChainProof(farmId, period, dataHash) {
    if (!cfg.registry) return null;
    try { return await pub.readContract({ address: cfg.registry, abi: registryAbi, functionName: "verify", args: [farmId, period, dataHash] }); }
    catch { return null; }
  }

  // Route table: path regex → { kind, price, build(item) }
  function route(url) {
    let m = url.pathname.match(/^\/v1\/field\/([a-z0-9-]+)\/(score|evidence)$/);
    if (m) {
      const p = url.searchParams.get("period");
      if (p && !/^\d{6}$/.test(p)) return { error: [400, { error: "bad_period", hint: "period=YYYYMM" }] };
      return { slug: normSlug(m[1]), period: p ? Number(p) : null, kind: m[2] };
    }
    m = url.pathname.match(/^\/v1\/earth\/([a-z0-9-]+)\/(\d{6})$/);
    if (m) return { slug: normSlug(m[1]), period: Number(m[2]), kind: "earth" };
    return null;
  }

  return async function handle(method, rawUrl, headers = {}) {
    const req = { method, headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])) };
    const res = {};
    try {
      const url = new URL(rawUrl, `http://${req.headers.host ?? "localhost"}`);
      if (req.method === "OPTIONS") return send(req, res, 204, null);
      if (url.pathname === "/health" || url.pathname === "/v1/health") return send(req, res, 200, { ok: !problem, problem, network: cfg.network, chainId: cfg.chainId, asset: cfg.asset,
        assetSymbol: cfg.assetSymbol, payTo: cfg.payTo, registry: cfg.registry || null, explorer: cfg.explorer, prices, note: PRICING_NOTE });
      if (url.pathname === "/v1/farms") {
        const items = Object.values(farmsIndex(evidence)).map(f => ({
          id: f.slug, farmKey: f.farmKey, periods: f.periods, latest: f.latest,
          routes: [
            { path: `/v1/field/${f.slug}/score`, price: prices.score, priceUsd: fmtUsd(prices.score) },
            { path: `/v1/field/${f.slug}/evidence`, price: prices.evidence, priceUsd: fmtUsd(prices.evidence) },
          ],
        }));
        return send(req, res, 200, { network: cfg.network, asset: cfg.asset, assetSymbol: cfg.assetSymbol, note: PRICING_NOTE, items });
      }

      const r = route(url);
      if (!r) return send(req, res, 404, { error: "not_found" });
      if (r.error) return send(req, res, ...r.error);
      const item = pickEvidence(evidence, r.slug, r.period);
      if (!item) return send(req, res, 404, { error: "no_record_for_farm_month", farm: r.slug, period: r.period });
      if (isPlaceholder(item.ev)) return send(req, res, 503, { error: "placeholder_evidence_refused", detail: "This farm-month is PLACEHOLDER data; the oracle will not sell it." });

      if (problem) return send(req, res, 503, { error: "oracle_not_configured", detail: problem });
      const amount = r.kind === "score" ? prices.score : prices.evidence;
      const label = r.kind === "score" ? "Ceres Field Score (ceres-field-score.v1)" : "Ceres evidence bundle (NASA/partner indicators)";
      const resource = { url: url.href, description: `${label} · ${r.slug} ${item.ev.period} · ${fmtUsd(amount)} ${cfg.assetSymbol} · ${PRICING_NOTE}`, mimeType: "application/json" };
      const reqs = requirementsFor(amount);
      const sigHeader = req.headers["payment-signature"];
      if (!sigHeader) {
        const pr = { x402Version: 2, error: "PAYMENT-SIGNATURE header is required", resource, accepts: [reqs] };
        return send(req, res, 402, pr, { "PAYMENT-REQUIRED": b64(pr) });
      }

      let payload;
      try { payload = unb64(String(sigHeader)); } catch { payload = null; }
      const v = payload ? await fac.verify(payload, reqs) : { isValid: false, invalidReason: "invalid_payload" };
      if (!v.isValid) {
        const pr = { x402Version: 2, error: v.invalidReason, resource, accepts: [reqs] };
        return send(req, res, 402, pr, { "PAYMENT-REQUIRED": b64(pr) });
      }
      // exact/eip3009 flow: verify → settle → respond (settle before serving so data is never given away unpaid)
      const s = await fac.settle(payload, reqs);
      if (!s.success) {
        const pr = { x402Version: 2, error: s.errorReason, resource, accepts: [reqs] };
        return send(req, res, 402, pr, { "PAYMENT-REQUIRED": b64(pr), "PAYMENT-RESPONSE": b64(s) });
      }

      let body;
      if (r.kind === "score") {
        const ev = item.ev, base = toEvidenceResponse(item);
        body = { ...fieldScore(ev), farmId: base.farmId, evidenceFile: base.file, dataHash: dataHashOf(ev) };
      } else if (r.kind === "evidence") {
        body = toEvidenceResponse(item);
      } else {
        body = toResponse(item);
      }
      const dataHash = body.dataHash ?? body.evidence?.dataHash;
      const recordedOnChain = await onChainProof(body.farmId, item.ev.period, dataHash);
      body.proof = {
        chainId: cfg.chainId,
        registry: cfg.registry || null,
        dataHash,
        recordedOnChain, // true = these bytes are exactly what WaterProofRegistry holds; false = not anchored (yet); null = no registry configured
        paymentTx: s.transaction,
        paymentTxUrl: cfg.explorer ? `${cfg.explorer}/tx/${s.transaction}` : null,
        registryUrl: cfg.registry && cfg.explorer ? `${cfg.explorer}/address/${cfg.registry}` : null,
        amount, asset: cfg.asset, payer: s.payer ?? null,
        note: PRICING_NOTE,
      };
      return send(req, res, 200, body, { "PAYMENT-RESPONSE": b64(s) });
    } catch (e) {
      return send(req, res, 500, { error: "internal", detail: String(e.message).slice(0, 200) });
    }
  };
}

/** Node http server around createHandler (local runs, tests). Throws early if paid routes can't work. */
export function createApp(opts = {}) {
  const cfg = opts.cfg ?? loadConfig();
  const problem = configProblem(cfg);
  if (problem) throw new Error(problem);
  const handle = createHandler({ ...opts, cfg });
  return http.createServer(async (req, res) => {
    let r;
    try { r = await handle(req.method, req.url, { ...req.headers }); }
    catch (e) { r = { status: 500, headers: { "content-type": "application/json" }, body: JSON.stringify({ error: "internal" }) }; }
    res.writeHead(r.status, r.headers);
    res.end(r.body || undefined);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = loadConfig();
  createApp({ cfg }).listen(cfg.port, () => console.log(`Ceres Earth oracle (x402, ${cfg.network}, asset ${cfg.asset}) on :${cfg.port}`));
}
