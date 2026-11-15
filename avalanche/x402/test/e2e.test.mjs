// End-to-end rehearsal of the DEMO setup on a local anvil node started with --chain-id 43113 (Fuji's chain id):
//   - FujiUSDCMock stands in for Circle USDC 0x5425…Bc65 with the SAME EIP-712 domain ("USD Coin", "2"), so the
//     payer signs byte-for-byte what Core Wallet signs on real Fuji;
//   - WaterProofRegistry deployed, El Algarrobal 202610 attested with the output of ../oracle/build-attestation.mjs;
//   - the payer buys /v1/field/:id/score and /evidence through x402; the facilitator pays the gas.
// Uses only anvil's unlocked dev accounts (eth_sendTransaction / eth_signTypedData_v4). No private keys anywhere.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, defineChain, keccak256, toHex } from "viem";
import { createApp } from "../server.mjs";
import { createFacilitator, tokenAbi } from "../facilitator.mjs";
import { loadEvidence, canon } from "../earth-data.mjs";
import { payAndFetch, buildPayment } from "../client.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "out");
const ORACLE_DIR = join(HERE, "..", "..", "oracle");
const PORT = 18545 + Math.floor(Math.random() * 1000);
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 43113;
const chain = defineChain({ id: CHAIN_ID, name: "anvil-as-fuji", nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const ANVIL = process.env.ANVIL ?? `${process.env.HOME}/.foundry/bin/anvil`;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
const unb64 = (s) => JSON.parse(Buffer.from(s, "base64").toString());

let anvil, server, base, pub, accounts, token, registry, evidence;

const art = (file, name = file) => JSON.parse(readFileSync(join(OUT, `${file}.sol`, `${name}.json`), "utf8"));
const wallet = (account) => createWalletClient({ chain, transport: http(RPC), account });
const balanceOf = (a) => pub.readContract({ address: token, abi: tokenAbi, functionName: "balanceOf", args: [a] });

async function deploy(account, file, args = []) {
  const a = art(file);
  const hash = await wallet(account).deployContract({ abi: a.abi, bytecode: a.bytecode.object, args });
  return (await pub.waitForTransactionReceipt({ hash })).contractAddress;
}

before(async () => {
  anvil = spawn(ANVIL, ["--chain-id", String(CHAIN_ID), "--port", String(PORT), "--silent"], { stdio: "ignore" });
  pub = createPublicClient({ chain, transport: http(RPC) });
  for (let i = 0; i < 80; i++) { try { await pub.getChainId(); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  accounts = await pub.request({ method: "eth_accounts" });
  const [deployer, payer, treasury, facilitatorGas, oracle] = accounts;

  token = await deploy(deployer, "FujiUSDCMock");
  registry = await deploy(deployer, "WaterProofRegistry", [oracle]);
  const regAbi = art("WaterProofRegistry").abi;
  const reg = (acct) => ({ address: registry, abi: regAbi, account: acct });
  for (const [key, label] of [["moquegua:carumas", "Carumas"], ["moquegua:samegua", "Samegua"], ["moquegua:algarrobal", "El Algarrobal"]]) {
    await pub.waitForTransactionReceipt({ hash: await wallet(deployer).writeContract({ ...reg(deployer), functionName: "registerFarm", args: [keccak256(toHex(key)), "0x0000000000000000000000000000000000000000", label] }) });
  }

  // Oracle anchors El Algarrobal 202610 using the real attester's output (same dataHash the API will sell).
  const outText = execFileSync("node", [join(ORACLE_DIR, "build-attestation.mjs"), join(ORACLE_DIR, "evidence", "algarrobal-202610.json"), "--chain", String(CHAIN_ID), "--registry", registry], { encoding: "utf8" });
  const { message } = JSON.parse(outText.slice(0, outText.indexOf("\n\n#")));
  // Replay the Fuji history on the fresh local registry: earlier revisions first (revision 0 = the CHIRPS-rain record
  // anchored in tx 0x9bd56d2d…), then the current record, so verify() matches the latest revision as on Fuji.
  const PRIOR = ["0x795d6df060ff23036afc664c2ae4955b003c37c59a98cf3eef1eacb9a54cfa84"];
  for (let rev = 0; rev < message.revision; rev++) {
    const prior = { ...message, revision: rev, dataHash: PRIOR[rev] ?? keccak256(toHex(`prior-${rev}`)) };
    const rc = await pub.waitForTransactionReceipt({ hash: await wallet(oracle).writeContract({ ...reg(oracle), functionName: "attest", args: [prior] }) });
    assert.equal(rc.status, "success", `local revision ${rev} attest`);
  }
  const rc = await pub.waitForTransactionReceipt({ hash: await wallet(oracle).writeContract({ ...reg(oracle), functionName: "attest", args: [message] }) });
  assert.equal(rc.status, "success", "current revision attest");

  // Prefund the demo payer with test USDC (on real Fuji: Circle's testnet faucet).
  await pub.waitForTransactionReceipt({ hash: await wallet(payer).writeContract({ address: token, abi: tokenAbi, functionName: "faucet", account: payer }) });

  evidence = loadEvidence(); // default dirs = real oracle/evidence only
  const cfg = { chain, chainId: CHAIN_ID, network: `eip155:${CHAIN_ID}`, rpcUrl: RPC, explorer: "https://testnet.snowtrace.io", asset: token,
    assetName: "USD Coin", assetVersion: "2", assetSymbol: "USDC", payTo: treasury, priceAtomic: "50000",
    prices: { score: "20000", evidence: "50000" }, maxTimeoutSeconds: 120, facilitatorUrl: "", registry };
  server = createApp({ cfg, evidence, facilitator: createFacilitator({ chain, rpcUrl: RPC, account: facilitatorGas }) });
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server?.close(); anvil?.kill(); });

test("free index lists the 3 farms × 4 real months, Fuji network, demo-pricing note", async () => {
  const r = await (await fetch(`${base}/v1/farms`)).json();
  assert.equal(r.network, "eip155:43113");
  assert.deepEqual(r.items.map(i => i.id).sort(), ["algarrobal", "carumas", "samegua"]);
  for (const i of r.items) assert.deepEqual(i.periods, [202607, 202608, 202609, 202610]);
  assert.match(r.note, /Testnet demo pricing/);
});

test("unpaid score request → HTTP 402 with x402 v2 requirements for Circle-USDC domain on eip155:43113", async () => {
  const res = await fetch(`${base}/v1/field/algarrobal/score`);
  assert.equal(res.status, 402);
  const pr = unb64(res.headers.get("PAYMENT-REQUIRED"));
  const a = pr.accepts[0];
  assert.equal(pr.x402Version, 2);
  assert.equal(a.network, "eip155:43113");
  assert.equal(a.scheme, "exact");
  assert.equal(a.amount, "20000");
  assert.deepEqual(a.extra, { assetTransferMethod: "eip3009", name: "USD Coin", version: "2" });
  assert.match(pr.resource.description, /Not a commercial offer/);
});

test("payer buys the Algarrobal 202610 score: 58 / medium, anchored on-chain, payer spends zero gas", async () => {
  const [, payer, treasury] = accounts;
  const gasBefore = await pub.getBalance({ address: payer });
  const tBefore = await balanceOf(treasury);
  const r = await payAndFetch(`${base}/v1/field/algarrobal/score`, { wallet: wallet(payer), chainId: CHAIN_ID });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.formulaVersion, "ceres-field-score.v1");
  assert.equal(r.body.period, 202610);
  assert.equal(r.body.score, 58);
  assert.equal(r.body.confidence, "medium");
  assert.equal(r.body.proof.recordedOnChain, true);
  assert.equal(r.body.proof.chainId, 43113);
  assert.match(r.body.proof.paymentTxUrl, /^https:\/\/testnet\.snowtrace\.io\/tx\/0x[0-9a-f]{64}$/);
  assert.equal(await balanceOf(treasury) - tBefore, 20000n);
  assert.equal(await pub.getBalance({ address: payer }), gasBefore, "payer spent zero native gas (facilitator paid it)");
});

test("evidence purchase returns the exact bytes behind dataHash; unattested month says recordedOnChain=false", async () => {
  const [, payer] = accounts;
  const r = await payAndFetch(`${base}/v1/field/algarrobal/evidence?period=202610`, { wallet: wallet(payer), chainId: CHAIN_ID });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.placeholder, false);
  const rehash = "0x" + createHash("sha256").update(canon(r.body.evidence)).digest("hex");
  assert.equal(rehash, r.body.dataHash);
  assert.equal(r.body.proof.recordedOnChain, true);

  const c = await payAndFetch(`${base}/v1/field/carumas/evidence?period=202610`, { wallet: wallet(payer), chainId: CHAIN_ID });
  assert.equal(c.status, 200);
  assert.equal(c.body.proof.recordedOnChain, false); // honest: paid, served, not anchored
});

test("/v1/earth alias still works, including the old el-algarrobal slug", async () => {
  const [, payer] = accounts;
  const r = await payAndFetch(`${base}/v1/earth/el-algarrobal/202610`, { wallet: wallet(payer), chainId: CHAIN_ID });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.farm, "moquegua:algarrobal");
  assert.equal(r.body.placeholder, false);
});

test("replayed payment is rejected", async () => {
  const [, payer] = accounts;
  const r = await payAndFetch(`${base}/v1/field/samegua/score`, { wallet: wallet(payer), chainId: CHAIN_ID });
  assert.equal(r.status, 200);
  const replay = await fetch(`${base}/v1/field/samegua/score`, { headers: { "PAYMENT-SIGNATURE": b64(r.payment) } });
  assert.equal(replay.status, 402);
  assert.equal(unb64(replay.headers.get("PAYMENT-REQUIRED")).error, "invalid_exact_evm_payload_authorization_nonce_used");
});

test("underpaying, redirecting, or reusing the cheaper score price on /evidence is rejected", async () => {
  const [, payer, , , stranger] = accounts;
  const pr = unb64((await fetch(`${base}/v1/field/carumas/evidence`)).headers.get("PAYMENT-REQUIRED"));
  const cheap = structuredClone(pr); cheap.accepts[0].amount = "20000"; // score price on the evidence route
  const r1 = await fetch(`${base}/v1/field/carumas/evidence`, { headers: { "PAYMENT-SIGNATURE": b64(await buildPayment({ wallet: wallet(payer), paymentRequired: cheap, chainId: CHAIN_ID })) } });
  assert.equal(r1.status, 402);
  const redirect = structuredClone(pr); redirect.accepts[0].payTo = stranger;
  const r2 = await fetch(`${base}/v1/field/carumas/evidence`, { headers: { "PAYMENT-SIGNATURE": b64(await buildPayment({ wallet: wallet(payer), paymentRequired: redirect, chainId: CHAIN_ID })) } });
  assert.equal(r2.status, 402);
});

test("a payment signed with the wrong EIP-712 domain or for another chain (NØFI 880024) is rejected", async () => {
  const [, payer] = accounts;
  const pr = unb64((await fetch(`${base}/v1/field/carumas/score`)).headers.get("PAYMENT-REQUIRED"));
  const wrongName = structuredClone(pr); wrongName.accepts[0].extra.name = "Ceres x402 Test USDC"; wrongName.accepts[0].extra.version = "1";
  const r1 = await fetch(`${base}/v1/field/carumas/score`, { headers: { "PAYMENT-SIGNATURE": b64(await buildPayment({ wallet: wallet(payer), paymentRequired: wrongName, chainId: CHAIN_ID })) } });
  assert.equal(r1.status, 402);
  assert.equal(unb64(r1.headers.get("PAYMENT-REQUIRED")).error, "invalid_exact_evm_payload_signature");
  const nofi = structuredClone(pr); nofi.accepts[0].network = "eip155:880024";
  const r2 = await fetch(`${base}/v1/field/carumas/score`, { headers: { "PAYMENT-SIGNATURE": b64(await buildPayment({ wallet: wallet(payer), paymentRequired: nofi, chainId: 880024 })) } });
  assert.equal(r2.status, 402);
});

test("unknown farm → 404, bad period → 400, no payment asked", async () => {
  assert.equal((await fetch(`${base}/v1/field/arequipa/score`)).status, 404);
  assert.equal((await fetch(`${base}/v1/field/carumas/score?period=2026-10`)).status, 400);
  assert.equal((await fetch(`${base}/v1/field/carumas/score?period=202512`)).status, 404);
});

test("payment still settles when the chain has been idle (Avalanche mines only on demand)", async () => {
  const [, payer] = accounts;
  await new Promise(r => setTimeout(r, 7000)); // latest block is now > 5 s older than the wall clock
  const r = await payAndFetch(`${base}/v1/field/carumas/score`, { wallet: wallet(payer), chainId: CHAIN_ID });
  assert.equal(r.status, 200, JSON.stringify(r.paymentResponse ?? r.body));
});
