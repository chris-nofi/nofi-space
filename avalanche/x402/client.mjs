// x402 buyer client: the CERES agent (or a cooperative / buyer) buying a field score or evidence bundle.
//   node client.mjs http://localhost:4020/v1/field/algarrobal/score
//   node client.mjs http://localhost:4020/v1/field/carumas/evidence?period=202610
// Signer: PAYER_ADDRESS (unlocked node account, anvil rehearsal) or PAYER_PRIVATE_KEY (CERES agent's testnet
// wallet, runtime env only). In the live demo the buyer can also pay from Core Wallet via web/pagar.html.
import { createWalletClient, http, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
import { loadConfig } from "./config.mjs";
import { authorizationTypes } from "./facilitator.mjs";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
const unb64 = (s) => JSON.parse(Buffer.from(s, "base64").toString("utf8"));

/** Signs an x402 v2 exact/eip3009 PaymentPayload for the first acceptable requirement. */
export async function buildPayment({ wallet, paymentRequired, chainId }) {
  const req = paymentRequired.accepts.find(a => a.scheme === "exact" && a.network === `eip155:${chainId}`);
  if (!req) throw new Error(`no acceptable requirement for eip155:${chainId}`);
  const now = Math.floor(Date.now() / 1000);
  // validAfter is backdated 10 min (as the x402 reference client does): the facilitator simulates against the latest
  // block, and Avalanche only produces blocks when there is traffic, so "now − 5 s" can be newer than that block.
  const authorization = { from: wallet.account.address, to: req.payTo, value: req.amount,
    validAfter: String(now - 600), validBefore: String(now + req.maxTimeoutSeconds), nonce: toHex(randomBytes(32)) };
  const signature = await wallet.signTypedData({
    account: wallet.account,
    domain: { name: req.extra.name, version: req.extra.version, chainId, verifyingContract: req.asset },
    types: authorizationTypes, primaryType: "TransferWithAuthorization",
    message: { ...authorization, value: BigInt(authorization.value), validAfter: BigInt(authorization.validAfter), validBefore: BigInt(authorization.validBefore) },
  });
  return { x402Version: 2, resource: paymentRequired.resource, accepted: req, payload: { signature, authorization } };
}

/** fetch() that transparently pays a 402 once. */
export async function payAndFetch(url, { wallet, chainId }) {
  const first = await fetch(url);
  if (first.status !== 402) return { status: first.status, body: await first.json(), paid: false };
  const pr = unb64(first.headers.get("PAYMENT-REQUIRED"));
  const payment = await buildPayment({ wallet, paymentRequired: pr, chainId });
  const second = await fetch(url, { headers: { "PAYMENT-SIGNATURE": b64(payment) } });
  const pre = second.headers.get("PAYMENT-RESPONSE");
  return { status: second.status, body: await second.json(), paid: true, paymentResponse: pre ? unb64(pre) : null, payment };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = loadConfig();
  const account = process.env.PAYER_PRIVATE_KEY ? privateKeyToAccount(process.env.PAYER_PRIVATE_KEY) : process.env.PAYER_ADDRESS;
  if (!account) throw new Error("Set PAYER_ADDRESS (anvil) or PAYER_PRIVATE_KEY (testnet-only CERES agent wallet)");
  const wallet = createWalletClient({ chain: cfg.chain, transport: http(cfg.rpcUrl), account });
  const r = await payAndFetch(process.argv[2] ?? `http://localhost:${cfg.port}/v1/field/algarrobal/score`, { wallet, chainId: cfg.chainId });
  console.log(JSON.stringify(r, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
}
