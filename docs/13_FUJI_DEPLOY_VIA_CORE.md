# Fuji deploy through Core Wallet (no private key leaves Core)

Core's MCP signer can only send transactions **to** an address, so the registry is created through the standard CREATE2
deployer that already exists on Fuji (`0x4e59b44847b379578588920cA78FbF26c0B4956C`, verified on Snowtrace 14 Nov 2026).
`avalanche/src/CeresRegistryBootstrap.sol` deploys `WaterProofRegistry`, registers the three farms and transfers ownership
to the sender's address in one transaction. Tested: `forge test` 28/28 (incl. deploy through the real CREATE2 deployer bytecode)
and a full rehearsal on anvil `--chain-id 43113`.

## Expected result (deterministic)

| | |
|---|---|
| Sender / owner / oracle | `0xA5a9524A0BC91c9e7AC2fd4E5798146AC4991D96` (Chris, Core account 1) |
| Salt | `cast format-bytes32-string "ceres-fuji-v1"` |
| Bootstrap | `0x4fFF9735679FBb47A574F5927E3B232Cb6398e79` |
| **WaterProofRegistry** | **`0xa03c3472b8F5F6d6FE1dB23B241DB5A50aa3892d`** |
| Gas | ~2.40M (send with gasLimit 3,200,000) |

If the owner address or the compiled bytecode changes, the addresses change: recompute before sending.

## Steps

```bash
cd avalanche && forge build
OWNER=0xA5a9524A0BC91c9e7AC2fd4E5798146AC4991D96
SALT=$(cast format-bytes32-string "ceres-fuji-v1")
INIT=$(jq -r .bytecode.object out/CeresRegistryBootstrap.sol/CeresRegistryBootstrap.json)$(cast abi-encode "constructor(address,address)" $OWNER $OWNER | cut -c3-)
DATA=${SALT}${INIT#0x}
cast create2 --deployer 0x4e59b44847b379578588920cA78FbF26c0B4956C --salt $SALT --init-code $INIT   # → bootstrap address
```

1. **Deploy**: Core `sign_and_send_evm_tx` { caip2Id `eip155:43113`, fromAddress OWNER, to `0x4e59…956C`, data `$DATA`, gasLimit `3200000` }.
   Or from a machine with a keystore: `cast send 0x4e59b44847b379578588920cA78FbF26c0B4956C $DATA --rpc-url fuji --account <acct>`.
2. **Check**: `cast call 0xa03c3472b8F5F6d6FE1dB23B241DB5A50aa3892d "owner()(address)" --rpc-url fuji` = OWNER; `farmCount()` = 3.
3. **Anchor El Algarrobal 202610**:
   `node oracle/build-attestation.mjs oracle/evidence/algarrobal-202610.json --chain 43113 --registry 0xa03c3472b8F5F6d6FE1dB23B241DB5A50aa3892d`
   → take the printed tuple → `cast calldata "attest((bytes32,uint32,uint32,int32,int32,int32,int16,uint8,uint32,bytes32,bytes32,string))" '<tuple>'`
   → Core `sign_and_send_evm_tx` { to registry, data, gasLimit `400000` }. dataHash `0x795d6df060ff23036afc664c2ae4955b003c37c59a98cf3eef1eacb9a54cfa84`.
4. **Wire it**: Netlify env `WATERPROOF_REGISTRY=0xa03c…892d` and `X402_PAY_TO=<treasury>` on `ceres-ventures-preview` and
   `gleaming-sunflower-16cdde`; `ceres-web/attestations.json` → `{"registry": "0x3238…", "records": {"algarrobal/202610": {"tx": "0x…", "block": N}}}`.

Core MCP gotcha (14 Nov): `list_accounts` returned "Account not available. Enable the account in the policy." until the account
and Fuji testnet were enabled in the connection's policy; a running session may need a new session to pick up a changed policy.
