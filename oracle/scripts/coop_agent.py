"""Plays a water utility's AI agent buying an evidence pack over x402.

Demo mode (default): sends a placeholder payment payload; the oracle returns a
simulated PAYMENT-RESPONSE. Task T3.5 replaces `make_payment` with a real
EIP-3009 transferWithAuthorization signed for USDC.

usage: python scripts/coop_agent.py --oracle http://localhost:8787 --farm samegua
"""
from __future__ import annotations

import argparse
import base64
import json

import requests


def b64json(s: str) -> dict:
    return json.loads(base64.b64decode(s))


def make_payment(req: dict) -> str:
    # TODO(T3.5): build and sign the real x402 `exact` EVM payload (EIP-3009) for req["accepts"][0].
    payload = {"x402Version": 2, "scheme": "exact", "network": req["accepts"][0]["network"], "payload": {"demo": True}}
    return base64.b64encode(json.dumps(payload).encode()).decode()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--oracle", default="http://localhost:8787")
    ap.add_argument("--farm", default="samegua")
    ap.add_argument("--season", type=int, default=2027)
    a = ap.parse_args()

    plot = next(f["plotId"] for f in requests.get(f"{a.oracle}/v1/farms", timeout=10).json() if f["id"] == a.farm)
    url = f"{a.oracle}/v1/evidence-pack?plot={plot}&season={a.season}"

    r = requests.get(url, timeout=30)
    print("→ GET evidence pack:", r.status_code)
    if r.status_code != 402:
        raise SystemExit("expected 402 Payment Required")
    req = b64json(r.headers["PAYMENT-REQUIRED"])
    acc = req["accepts"][0]
    print(f"  price {int(acc['amount']) / 1e6} USDC on {acc['network']} → {acc['payTo']}")

    r2 = requests.get(url, headers={"PAYMENT-SIGNATURE": make_payment(req)}, timeout=60)
    print("→ retry with payment:", r2.status_code)
    r2.raise_for_status()
    settle = b64json(r2.headers["PAYMENT-RESPONSE"])
    body = r2.json()
    print("  settlement:", settle)
    print("  evidenceHash:", body["evidenceHash"], "· signed:", bool(body.get("signature")))
    # TODO(T3.3): read the on-chain Attestation event for this plot/season and compare evidenceHash.


if __name__ == "__main__":
    main()
