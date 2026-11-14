"""x402 v2 buyer for the CERES agent (plan v2, `exact` scheme, EIP-3009).

CERES pays the Earth oracle for each NASA data record it uses in an answer:
  GET  → 402 + PAYMENT-REQUIRED (base64 JSON, accepts[])
  sign → EIP-712 TransferWithAuthorization (no gas: the facilitator submits it)
  GET  + PAYMENT-SIGNATURE → 200 + PAYMENT-RESPONSE (settlement tx)

Safety rails: only the configured network and asset, a hard price cap, and the agent key is read
from the environment at call time and never logged or returned. Testnet only.
"""
from __future__ import annotations

import base64
import json
import secrets
import time
from dataclasses import dataclass, field

import requests
from eth_account import Account
from eth_account.messages import encode_typed_data

from .config import env

EIP3009_TYPES = {
    "TransferWithAuthorization": [
        {"name": "from", "type": "address"},
        {"name": "to", "type": "address"},
        {"name": "value", "type": "uint256"},
        {"name": "validAfter", "type": "uint256"},
        {"name": "validBefore", "type": "uint256"},
        {"name": "nonce", "type": "bytes32"},
    ]
}


class X402Error(RuntimeError):
    pass


@dataclass
class PaidResponse:
    status: int
    data: dict
    payment: dict | None = None          # settlement: transaction, network, payer, amount, explorer URL
    requirements: dict | None = None
    elapsed_ms: int = 0
    log: list[str] = field(default_factory=list)


def b64json(obj: dict) -> str:
    return base64.b64encode(json.dumps(obj, separators=(",", ":")).encode()).decode()


def unb64json(s: str) -> dict:
    return json.loads(base64.b64decode(s))


def _chain_id(network: str) -> int:
    if not network.startswith("eip155:"):
        raise X402Error(f"unsupported network {network}")
    return int(network.split(":", 1)[1])


def choose(accepts: list[dict], network: str, asset: str | None, max_amount: int) -> dict:
    for a in accepts:
        if a.get("scheme") != "exact" or a.get("network") != network:
            continue
        if asset and a.get("asset", "").lower() != asset.lower():
            continue
        if int(a.get("amount") or a.get("maxAmountRequired") or 0) > max_amount:
            raise X402Error(f"price {a.get('amount')} above cap {max_amount}")
        return a
    raise X402Error(f"no acceptable payment option for {network}")


def sign_authorization(accepted: dict, private_key: str, now: int | None = None) -> dict:
    """Build the `exact`/EIP-3009 payload for one accepted requirement."""
    acct = Account.from_key(private_key)
    now = int(now if now is not None else time.time())
    extra = accepted.get("extra") or {}
    auth = {
        "from": acct.address,
        "to": accepted["payTo"],
        "value": str(int(accepted.get("amount") or accepted.get("maxAmountRequired"))),
        "validAfter": str(now - 600),
        "validBefore": str(now + int(accepted.get("maxTimeoutSeconds", 60))),
        "nonce": "0x" + secrets.token_hex(32),
    }
    domain = {
        "name": extra.get("name", env("X402_ASSET_NAME", "Ceres x402 Test USDC")),
        "version": str(extra.get("version", env("X402_ASSET_VERSION", "1"))),
        "chainId": _chain_id(accepted["network"]),
        "verifyingContract": accepted["asset"],
    }
    msg = {**auth, "value": int(auth["value"]), "validAfter": int(auth["validAfter"]), "validBefore": int(auth["validBefore"]),
           "nonce": bytes.fromhex(auth["nonce"][2:])}
    signed = acct.sign_message(encode_typed_data(domain, EIP3009_TYPES, msg))
    return {"signature": "0x" + signed.signature.hex().removeprefix("0x"), "authorization": auth}


def explorer_tx(tx: str | None, network: str) -> str | None:
    if not tx:
        return None
    base = env("X402_EXPLORER_URL") or {"eip155:880024": "https://nofiscan.io", "eip155:43113": "https://testnet.snowtrace.io"}.get(network)
    return f"{base.rstrip('/')}/tx/{tx}" if base else None


def fetch_paid(url: str, *, private_key: str | None = None, session: requests.Session | None = None, timeout: float = 30) -> PaidResponse:
    """GET a resource, paying once through x402 if the server asks for it."""
    http = session or requests.Session()
    network = env("X402_NETWORK", "eip155:880024")
    asset = env("X402_ASSET")
    cap = int(env("X402_MAX_AMOUNT", "100000"))  # 0.10 of a 6-decimal dollar
    t0 = time.monotonic()
    log = ["GET " + url]
    r = http.get(url, timeout=timeout)
    if r.status_code != 402:
        if r.status_code >= 400:
            raise X402Error(f"oracle answered {r.status_code}")
        return PaidResponse(r.status_code, r.json(), elapsed_ms=int((time.monotonic() - t0) * 1000), log=log + [str(r.status_code)])
    header = r.headers.get("PAYMENT-REQUIRED")
    reqs = unb64json(header) if header else r.json()
    log.append("402 Payment Required")
    key = private_key or env("CERES_AGENT_PRIVATE_KEY")
    if not key:
        raise X402Error("CERES_AGENT_PRIVATE_KEY not set")
    accepted = choose(reqs.get("accepts", []), network, asset, cap)
    payload = {"x402Version": reqs.get("x402Version", 2), "resource": reqs.get("resource"), "accepted": accepted,
               "payload": sign_authorization(accepted, key)}
    log.append(f"signed EIP-3009 {accepted.get('amount')} → {accepted['payTo']}")
    r2 = http.get(url, headers={"PAYMENT-SIGNATURE": b64json(payload)}, timeout=timeout)
    ms = int((time.monotonic() - t0) * 1000)
    if r2.status_code != 200:
        reason = r2.headers.get("PAYMENT-REQUIRED")
        raise X402Error(f"payment rejected ({r2.status_code}): {unb64json(reason).get('error') if reason else r2.text[:200]}")
    settle = unb64json(r2.headers["PAYMENT-RESPONSE"]) if r2.headers.get("PAYMENT-RESPONSE") else {}
    data = r2.json()
    tx = settle.get("transaction") or (data.get("proof") or {}).get("paymentTx")
    payment = {
        "transaction": tx, "network": settle.get("network", accepted["network"]), "payer": settle.get("payer"),
        "amount": accepted.get("amount"), "asset": accepted.get("asset"),
        "txUrl": (data.get("proof") or {}).get("paymentTxUrl") or explorer_tx(tx, accepted["network"]),
        "roundTripMs": ms,
    }
    log.append(f"200 OK · tx {tx}")
    return PaidResponse(200, data, payment=payment, requirements=accepted, elapsed_ms=ms, log=log)
