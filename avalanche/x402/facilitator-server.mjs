// Stand-alone x402 facilitator HTTP service (POST /verify, POST /settle, GET /supported, GET /health).
// Demo: Avalanche Fuji (eip155:43113), Circle USDC. Run it as its own process so the Earth oracle never holds
// the gas wallet: X402_FACILITATOR_URL=https://<host>. Put it behind HTTPS for the public demo.
import http from "node:http";
import { formatEther } from "viem";
import { createPublicClient, http as viemHttp } from "viem";
import { loadConfig } from "./config.mjs";
import { createFacilitator } from "./facilitator.mjs";
import { signerFromEnv } from "./server.mjs";

const cfg = loadConfig();
const signer = signerFromEnv();
const fac = createFacilitator({ chain: cfg.chain, rpcUrl: cfg.rpcUrl, account: signer });
const pub = createPublicClient({ chain: cfg.chain, transport: viemHttp(cfg.rpcUrl) });
const signerAddress = signer ? (typeof signer === "string" ? signer : signer.address) : null;
const json = (res, s, b) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(b)); };
const port = Number(process.env.FACILITATOR_PORT ?? 4021);

http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/supported") return json(res, 200, fac.supported());
    if (req.method === "GET" && req.url === "/health") {
      let gas = null; try { gas = signerAddress ? formatEther(await pub.getBalance({ address: signerAddress })) : null; } catch { gas = "rpc_error"; }
      return json(res, 200, { ok: Boolean(signerAddress), network: fac.network, signer: signerAddress, nativeGasBalance: gas, warn: signerAddress ? undefined : "no FACILITATOR_PRIVATE_KEY: verify works, settle will fail" });
    }
    if (req.method !== "POST" || !["/verify", "/settle"].includes(req.url)) return json(res, 404, { error: "not_found" });
    let raw = ""; for await (const c of req) raw += c;
    const { paymentPayload, paymentRequirements } = JSON.parse(raw || "{}");
    return json(res, 200, req.url === "/verify" ? await fac.verify(paymentPayload, paymentRequirements) : await fac.settle(paymentPayload, paymentRequirements));
  } catch (e) { return json(res, 500, { error: "internal", detail: String(e.message).slice(0, 200) }); }
}).listen(port, () => console.log(`x402 facilitator for ${fac.network} on :${port} · signer ${signerAddress ?? "(none)"}`));
