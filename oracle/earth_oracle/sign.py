"""EIP-712 attestations. Types must match contracts/src/WaterEscrow.sol exactly."""
from __future__ import annotations

from eth_account import Account
from eth_account.messages import encode_typed_data

DOMAIN_NAME = "AguaClara"
DOMAIN_VERSION = "1"

TYPES = {
    "EIP712Domain": [
        {"name": "name", "type": "string"},
        {"name": "version", "type": "string"},
        {"name": "chainId", "type": "uint256"},
        {"name": "verifyingContract", "type": "address"},
    ],
    "Attestation": [
        {"name": "plotId", "type": "bytes32"},
        {"name": "season", "type": "uint32"},
        {"name": "rule", "type": "uint8"},
        {"name": "value", "type": "uint64"},
        {"name": "cropAlive", "type": "bool"},
        {"name": "evidenceHash", "type": "bytes32"},
    ],
}

RULE_PER_M3 = 0
RULE_PER_PRACTICE = 1


def _b32(h: str | bytes) -> bytes:
    if isinstance(h, bytes):
        return h
    return bytes.fromhex(h[2:] if h.startswith("0x") else h)


def typed_data(att: dict, chain_id: int, verifying_contract: str) -> dict:
    return {
        "types": TYPES,
        "primaryType": "Attestation",
        "domain": {"name": DOMAIN_NAME, "version": DOMAIN_VERSION, "chainId": chain_id, "verifyingContract": verifying_contract},
        "message": {
            "plotId": _b32(att["plotId"]),
            "season": int(att["season"]),
            "rule": int(att["rule"]),
            "value": int(att["value"]),
            "cropAlive": bool(att["cropAlive"]),
            "evidenceHash": _b32(att["evidenceHash"]),
        },
    }


def sign_attestation(att: dict, private_key: str, chain_id: int, verifying_contract: str) -> dict:
    msg = encode_typed_data(full_message=typed_data(att, chain_id, verifying_contract))
    signed = Account.sign_message(msg, private_key)
    return {"signature": "0x" + signed.signature.hex().removeprefix("0x"), "signer": Account.from_key(private_key).address}


def recover(att: dict, signature: str, chain_id: int, verifying_contract: str) -> str:
    msg = encode_typed_data(full_message=typed_data(att, chain_id, verifying_contract))
    return Account.recover_message(msg, signature=signature)
