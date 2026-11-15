// Network + payment config for the Ceres Earth oracle x402 paywall.
// Demo network (locked 14 Nov 2026 ~04:15 Peru/Bogotá, UTC-5): Avalanche Fuji C-Chain (43113),
// paid in Circle's Fuji USDC, which already implements EIP-3009 (no custom token deploy).
// The NØFI L1 (880024) stays defined here so the same code moves over unchanged when it is live.
import { defineChain } from "viem";

export const fuji = defineChain({
  id: 43113,
  name: "Avalanche Fuji C-Chain",
  nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
  rpcUrls: { default: { http: ["https://api.avax-test.network/ext/bc/C/rpc"] } },
  blockExplorers: { default: { name: "Snowtrace", url: "https://testnet.snowtrace.io" } },
  testnet: true,
});

export const nofiTestnet = defineChain({
  id: 880024,
  name: "NØFI Chain Testnet (NØCHAIN, Avalanche L1)",
  nativeCurrency: { name: "NØFI Test Dollar", symbol: "tUSD", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc-testnet.nofichain.com/avalanche-l1/evm/880024"] } },
  blockExplorers: { default: { name: "nofiscan", url: "https://nofiscan.io" } },
  testnet: true,
});

export const NETWORKS = { 43113: fuji, 880024: nofiTestnet };

/** Circle USDC on Fuji (FiatTokenV2_2, EIP-3009). EIP-712 domain read on-chain 14 Nov 2026: name() "USD Coin", version() "2". */
export const FUJI_USDC = { address: "0x5425890298aed601595a70AB815c96711a31Bc65", name: "USD Coin", version: "2", decimals: 6 };

/** Per-asset defaults so switching chain doesn't silently keep the wrong EIP-712 domain. */
const ASSET_DEFAULTS = {
  43113: FUJI_USDC,
  880024: { address: undefined, name: "Ceres x402 Test USDC", version: "1", decimals: 6 }, // X402TestUSDC after DeployNofi
};

/** Paid routes and their testnet demo prices (atomic units, 6 decimals). Not a commercial offer. */
export const DEFAULT_PRICES = {
  score: "20000",    // 0.02 USDC  GET /v1/field/:id/score
  evidence: "50000", // 0.05 USDC  GET /v1/field/:id/evidence  (and the /v1/earth alias)
};

/** Build the runtime config from env. Nothing secret lives here. */
export function loadConfig(env = process.env) {
  const chainId = Number(env.X402_CHAIN_ID ?? 43113);
  const base = NETWORKS[chainId];
  const assetDef = ASSET_DEFAULTS[chainId] ?? {};
  const rpcUrl = env.X402_RPC_URL ?? base?.rpcUrls.default.http[0];
  const chain = base ?? defineChain({ id: chainId, name: `local-${chainId}`, nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
  const evidencePrice = env.X402_PRICE_EVIDENCE ?? env.X402_PRICE ?? DEFAULT_PRICES.evidence;
  return {
    chain,
    chainId,
    network: `eip155:${chainId}`, // CAIP-2, as x402 v2 requires
    rpcUrl,
    explorer: env.X402_EXPLORER ?? base?.blockExplorers?.default.url ?? "",
    asset: env.X402_ASSET ?? assetDef.address,
    assetName: env.X402_ASSET_NAME ?? assetDef.name,       // EIP-712 domain name, must equal the token's name()
    assetVersion: env.X402_ASSET_VERSION ?? assetDef.version, // EIP-712 domain version, must equal the token's version()
    assetSymbol: env.X402_ASSET_SYMBOL ?? (chainId === 43113 ? "USDC" : "tUSDCx"),
    payTo: env.X402_PAY_TO, // Ceres Ventures treasury (public address). Must NOT be the demo payer.
    priceAtomic: evidencePrice, // kept for older callers
    prices: { score: env.X402_PRICE_SCORE ?? DEFAULT_PRICES.score, evidence: evidencePrice },
    maxTimeoutSeconds: Number(env.X402_MAX_TIMEOUT ?? 120),
    facilitatorUrl: env.X402_FACILITATOR_URL ?? "", // empty → in-process facilitator
    registry: env.WATERPROOF_REGISTRY ?? "", // WaterProofRegistry address (optional; adds on-chain proof link)
    port: Number(env.PORT ?? 4020),
  };
}
