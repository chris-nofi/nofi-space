// Minimal self-hosted x402 facilitator for the `exact` scheme, EIP-3009 transfer method, on ONE EVM chain
// (Avalanche Fuji eip155:43113 for the demo, Circle USDC; the NØFI L1 eip155:880024 later, same code).
// Mirrors the checks in coinbase/x402 typescript/packages/mechanisms/evm/src/exact/facilitator/eip3009.ts
// (signature, window, amount, payee, asset, network, nonce unused, balance, simulation). Self-hosting keeps the
// settlement wallet ours and lets the identical stack run on our own L1, which no public facilitator supports.
import { createPublicClient, createWalletClient, http, getAddress, parseSignature, isAddressEqual } from "viem";

export const authorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
  ],
};

export const tokenAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "authorizationState", stateMutability: "view", inputs: [{ name: "a", type: "address" }, { name: "n", type: "bytes32" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "faucet", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "transferWithAuthorization", stateMutability: "nonpayable",
    inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" }, { name: "r", type: "bytes32" }, { name: "s", type: "bytes32" }], outputs: [] },
];

/**
 * @param {object} o
 * @param {import('viem').Chain} o.chain
 * @param {string} o.rpcUrl
 * @param {import('viem').Account | `0x${string}`} o.account  settlement signer (pays native gas: AVAX on Fuji). On anvil an unlocked
 *        address works; on Fuji use a dedicated hot wallet that only holds a little AVAX for gas (never commit it).
 */
export function createFacilitator({ chain, rpcUrl, account }) {
  const network = `eip155:${chain.id}`;
  const pub = createPublicClient({ chain, transport: http(rpcUrl) });
  const wallet = account ? createWalletClient({ chain, transport: http(rpcUrl), account }) : null;
  const signerAddress = account ? (typeof account === "string" ? account : account.address) : null;

  async function verify(paymentPayload, req) {
    const auth = paymentPayload?.payload?.authorization;
    const sig = paymentPayload?.payload?.signature;
    const payer = auth?.from;
    const bad = (invalidReason) => ({ isValid: false, invalidReason, payer });
    if (paymentPayload?.x402Version !== 2) return bad("invalid_x402_version");
    if (req.scheme !== "exact" || paymentPayload.accepted?.scheme !== "exact") return bad("unsupported_scheme");
    if (req.network !== network || paymentPayload.accepted?.network !== network) return bad("invalid_network");
    if ((req.extra?.assetTransferMethod ?? "eip3009") !== "eip3009") return bad("unsupported_asset_transfer_method");
    if (!auth || !sig) return bad("invalid_payload");
    if (!isAddressEqual(paymentPayload.accepted.asset, req.asset)) return bad("invalid_exact_evm_payload_asset_mismatch");
    if (!isAddressEqual(auth.to, req.payTo)) return bad("invalid_exact_evm_payload_recipient_mismatch");
    if (BigInt(auth.value) !== BigInt(req.amount)) return bad("invalid_exact_evm_payload_authorization_value");
    const now = Math.floor(Date.now() / 1000);
    if (BigInt(auth.validBefore) < BigInt(now + 6)) return bad("invalid_exact_evm_payload_authorization_valid_before");
    if (BigInt(auth.validAfter) > BigInt(now)) return bad("invalid_exact_evm_payload_authorization_valid_after");
    if (BigInt(auth.validBefore) - BigInt(now) > BigInt(req.maxTimeoutSeconds + 30)) return bad("invalid_exact_evm_payload_authorization_valid_before");
    const message = { from: getAddress(auth.from), to: getAddress(auth.to), value: BigInt(auth.value),
      validAfter: BigInt(auth.validAfter), validBefore: BigInt(auth.validBefore), nonce: auth.nonce };
    const domain = { name: req.extra?.name, version: req.extra?.version, chainId: chain.id, verifyingContract: getAddress(req.asset) };
    let okSig = false;
    try { okSig = await pub.verifyTypedData({ address: message.from, domain, types: authorizationTypes, primaryType: "TransferWithAuthorization", message, signature: sig }); } catch { okSig = false; }
    if (!okSig) return bad("invalid_exact_evm_payload_signature");
    const [used, bal] = await Promise.all([
      pub.readContract({ address: req.asset, abi: tokenAbi, functionName: "authorizationState", args: [message.from, message.nonce] }),
      pub.readContract({ address: req.asset, abi: tokenAbi, functionName: "balanceOf", args: [message.from] }),
    ]);
    if (used) return bad("invalid_exact_evm_payload_authorization_nonce_used");
    if (bal < message.value) return bad("insufficient_funds");
    return { isValid: true, payer: message.from, _message: message, _sig: sig };
  }

  async function settle(paymentPayload, req) {
    const v = await verify(paymentPayload, req);
    if (!v.isValid) return { success: false, errorReason: v.invalidReason, transaction: "", network, payer: v.payer };
    if (!wallet) return { success: false, errorReason: "facilitator_has_no_signer", transaction: "", network, payer: v.payer };
    const m = v._message; const { r, s, v: vv, yParity } = parseSignature(v._sig);
    const args = [m.from, m.to, m.value, m.validAfter, m.validBefore, m.nonce, Number(vv ?? BigInt(yParity + 27)), r, s];
    try {
      const { request } = await pub.simulateContract({ address: req.asset, abi: tokenAbi, functionName: "transferWithAuthorization", args, account: wallet.account });
      const hash = await wallet.writeContract(request);
      const rcpt = await pub.waitForTransactionReceipt({ hash });
      if (rcpt.status !== "success") return { success: false, errorReason: "transaction_reverted", transaction: hash, network, payer: m.from };
      return { success: true, transaction: hash, network, payer: m.from, blockNumber: Number(rcpt.blockNumber) };
    } catch (e) {
      return { success: false, errorReason: "settlement_failed", transaction: "", network, payer: m.from, detail: String(e.shortMessage ?? e.message).slice(0, 200) };
    }
  }

  const supported = () => ({
    kinds: [{ x402Version: 2, scheme: "exact", network }],
    extensions: [],
    signers: signerAddress ? { [network]: [signerAddress] } : {},
  });

  const strip = (r) => { const { _message, _sig, ...rest } = r; return rest; };
  return { network, verify: async (p, q) => strip(await verify(p, q)), settle, supported };
}
