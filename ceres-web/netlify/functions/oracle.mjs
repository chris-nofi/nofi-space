// Ceres x402 field API as a Netlify Function (same origin as the site, HTTPS for free).
//   /v1/field/:id/score · /v1/field/:id/evidence · /v1/earth/:farm/:period · /v1/farms · /health
// The code is the tested oracle from space-apps-2026/avalanche/x402, copied into ./_x402 by `npm run build`.
// Netlify environment variables (Site configuration → Environment variables), never in files:
//   X402_PAY_TO              Ceres treasury (public address, ≠ the demo payer)        required for paid routes
//   FACILITATOR_PRIVATE_KEY  hot wallet holding only a little Fuji AVAX for gas (mark as secret)   required to settle
//   WATERPROOF_REGISTRY      WaterProofRegistry on Fuji (adds proof.recordedOnChain)   optional
//   ALLOWED_ORIGINS          CORS allowlist, comma-separated                            optional (default *)
// Chain defaults to Fuji 43113 + Circle USDC; nothing else needs setting.
import { createHandler } from "./_x402/server.mjs";
import { evidenceMap } from "./_x402/evidence-bundle.mjs";

let handle;

export default async (req) => {
  handle ??= createHandler({ evidence: evidenceMap() });
  const r = await handle(req.method, req.url, Object.fromEntries(req.headers));
  return new Response(r.status === 204 ? null : r.body, { status: r.status, headers: r.headers });
};

export const config = { path: ["/v1/*", "/health"] };
