// Cross-checks that the off-chain EIP-712 digest (viem) equals the contract's hashAttestation(),
// using a throwaway local anvil chain and an *unlocked* dev account (no private key handled here).
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { hashTypedData } from "viem";

const sh = (c) => execSync(c, { encoding: "utf8", cwd: ".." }).trim();
const RPC = "http://127.0.0.1:8545";
const from = sh(`cast rpc eth_accounts --rpc-url ${RPC}`).match(/0x[0-9a-fA-F]{40}/)[0];
const dep = sh(`forge create src/WaterProofRegistry.sol:WaterProofRegistry --rpc-url ${RPC} --unlocked --from ${from} --broadcast --constructor-args 0x000000000000000000000000000000000000dEaD`);
const registry = dep.match(/Deployed to: (0x[0-9a-fA-F]{40})/)[1];
sh(`node oracle/build-attestation.mjs oracle/evidence/algarrobal-202610.json --chain 31337 --registry ${registry} > /dev/null`);
const typed = JSON.parse(readFileSync("oracle/out/algarrobal-202610.typed.json", "utf8"));
const { EIP712Domain, ...types } = typed.types;
const offchain = hashTypedData({ domain: typed.domain, types, primaryType: "Attestation", message: typed.message });
const tuple = readFileSync("oracle/out/algarrobal-202610.tuple.txt", "utf8").trim();
const onchain = sh(`cast call ${registry} "hashAttestation((bytes32,uint32,uint32,int32,int32,int32,int16,uint8,uint32,bytes32,bytes32,string))(bytes32)" '${tuple}' --rpc-url ${RPC}`);
console.log({ registry, offchain, onchain, match: offchain.toLowerCase() === onchain.toLowerCase() });
process.exit(offchain.toLowerCase() === onchain.toLowerCase() ? 0 : 1);
