// Turns one farm-month evidence JSON into (1) a WaterProofRegistry.Attestation,
// (2) EIP-712 typed data the oracle signs with `cast wallet sign --data` (keystore/hardware wallet),
// and (3) the exact cast commands. This script never touches a private key.
//
// usage: node build-attestation.mjs <evidence.json> [--chain 43113] [--registry 0x...] [--uri https://...] [--allow-missing]
//
// Missing observations (e.g. El Algarrobal 202608/202609 et_mm.value = null, no valid ECOSTRESS pixel):
//   default        → refuse (exit 2) and say why. Attest a month with real ET first (algarrobal-202610, carumas-*).
//   --allow-missing → encode the documented sentinel MISSING_X10 = -1 for that *X10 field (a real ET/ET0/precip is
//                    never negative) and keep the full null + `reason` inside the hashed evidence JSON.
//                    NDVI has no safe sentinel (-1000..1000 are all real values), so a null NDVI always refuses.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { keccak256, toHex, hashTypedData } from "viem";

const args = process.argv.slice(2);
const file = args[0];
if (!file) { console.error("usage: node build-attestation.mjs <evidence.json> [--chain 43113] [--registry 0x..] [--uri ..] [--allow-missing]"); process.exit(1); }
const opt = (k, d) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : d; };
const chainId = Number(opt("--chain", "43113"));
const registry = opt("--registry", "0x0000000000000000000000000000000000000000");

// Canonical JSON: recursively sorted keys, no whitespace → stable sha256 for anyone re-checking.
const canon = (v) => Array.isArray(v) ? `[${v.map(canon).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`
  : JSON.stringify(v);

const ev = JSON.parse(readFileSync(file, "utf8"));
const canonical = canon(ev);
const dataHash = "0x" + createHash("sha256").update(canonical).digest("hex");
const sources = Object.values(ev.indicators).flatMap(i => [i.dataset, ...(i.granules || [])]).sort();
const sourcesHash = "0x" + createHash("sha256").update(sources.join("|")).digest("hex");
export const MISSING_X10 = -1;
const allowMissing = args.includes("--allow-missing");
const missing = [];
const isNum = (n) => typeof n === "number" && Number.isFinite(n);
const x10 = (field) => {
  const ind = ev.indicators[field];
  const n = ind?.value;
  if (isNum(n)) return Math.round(n * 10);
  missing.push({ field, reason: ind?.reason ?? "no value" });
  return MISSING_X10;
};

export const types = {
  Attestation: [
    { name: "farmId", type: "bytes32" }, { name: "period", type: "uint32" }, { name: "revision", type: "uint32" },
    { name: "etMmX10", type: "int32" }, { name: "et0MmX10", type: "int32" }, { name: "precipMmX10", type: "int32" },
    { name: "ndviX1000", type: "int16" }, { name: "strategyId", type: "uint8" }, { name: "waterSavedM3", type: "uint32" },
    { name: "dataHash", type: "bytes32" }, { name: "sourcesHash", type: "bytes32" }, { name: "uri", type: "string" },
  ],
};

const message = {
  farmId: keccak256(toHex(ev.farmKey)),
  period: ev.period,
  revision: ev.revision ?? 0,
  etMmX10: x10("et_mm"),
  et0MmX10: x10("et0_mm"),
  precipMmX10: x10("precip_mm"),
  ndviX1000: isNum(ev.indicators.ndvi?.value) ? Math.round(ev.indicators.ndvi.value * 1000) : NaN,
  strategyId: ev.engine.recommendedStrategyId,
  waterSavedM3: ev.engine.waterSavedM3 ?? 0,
  dataHash, sourcesHash,
  uri: opt("--uri", `https://ceres-ventures.example/evidence/${basename(file)}`),
};
if (!Number.isFinite(message.ndviX1000)) {
  console.error(`REFUSED ${basename(file)}: indicators.ndvi.value is null (${ev.indicators.ndvi?.reason ?? "no reason"}). NDVI has no safe on-chain sentinel.`);
  process.exit(2);
}
if (missing.length && !allowMissing) {
  console.error(`REFUSED ${basename(file)}: missing observation(s): ${missing.map(m => `${m.field} (${m.reason})`).join("; ")}.`);
  console.error("Attest a month with real values first (algarrobal-202610.json or a carumas-* month), or re-run with --allow-missing to encode the -1 sentinel.");
  process.exit(2);
}
if (missing.length) console.error(`WARNING ${basename(file)}: encoded MISSING_X10=-1 for ${missing.map(m => m.field).join(", ")}. Do not present those fields as observations.`);
if (/PLACEHOLDER/i.test(ev._note ?? "")) console.error(`WARNING ${basename(file)}: _note says PLACEHOLDER. Do not anchor placeholder data on a public chain.`);
const domain = { name: "WaterProofRegistry", version: "1", chainId, verifyingContract: registry };
const digest = hashTypedData({ domain, types, primaryType: "Attestation", message });

const typed = {
  types: { EIP712Domain: [
      { name: "name", type: "string" }, { name: "version", type: "string" },
      { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" } ], ...types },
  primaryType: "Attestation", domain, message,
};
const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });
const stem = basename(file, ".json");
writeFileSync(`${OUT}/${stem}.canonical.json`, canonical);
writeFileSync(`${OUT}/${stem}.typed.json`, JSON.stringify(typed, null, 2));
const tuple = `(${["farmId","period","revision","etMmX10","et0MmX10","precipMmX10","ndviX1000","strategyId","waterSavedM3","dataHash","sourcesHash"].map(k => message[k]).join(",")},"${message.uri}")`;
writeFileSync(`${OUT}/${stem}.tuple.txt`, tuple + "\n");

console.log(JSON.stringify({ chainId, registry, dataHash, sourcesHash, digest, missing, message }, null, 2));
console.log(`\n# A) simplest: the oracle account sends the attestation itself (keystore prompt):
cast send ${registry} "attest((bytes32,uint32,uint32,int32,int32,int32,int16,uint8,uint32,bytes32,bytes32,string))" '${tuple}' --rpc-url fuji --account ceres-oracle
#
# B) or sign off-chain and let anyone submit:
# 1) oracle signs (keystore prompt, no key on disk in plain text):
cast wallet sign --account ceres-oracle --data --from-file oracle/out/${stem}.typed.json
# 2) farmer / anyone submits with Core Wallet (dApp) or cast:
cast send ${registry} "attestWithSig((bytes32,uint32,uint32,int32,int32,int32,int16,uint8,uint32,bytes32,bytes32,string),bytes)" '${tuple}' <SIGNATURE> --rpc-url fuji --account <submitter>
# 3) anyone verifies:
cast call ${registry} "verify(bytes32,uint32,bytes32)(bool)" ${message.farmId} ${message.period} ${dataHash} --rpc-url fuji`);
