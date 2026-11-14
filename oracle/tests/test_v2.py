"""Plan v2: earth records, dataHash, x402 buyer (EIP-3009 on eip155:880024), records API."""
import json

import pytest
from eth_account import Account
from eth_account.messages import encode_typed_data
from fastapi.testclient import TestClient

from earth_oracle import x402_client as x
from earth_oracle.proof import build_record, canonical, export, package, sha256_hex, verify_bytes

AGENT_KEY = "0x" + "11" * 32          # throwaway test key, never funded
PAY_TO = "0x000000000000000000000000000000000000dEaD"
ASSET = "0x00000000000000000000000000000000000C0FFE"


def test_record_is_deterministic_and_tamper_evident():
    a, b = package("samegua", "202610"), package("samegua", "202610")
    assert a["dataHash"] == b["dataHash"] and a["dataHash"] == sha256_hex(a["record"])
    assert verify_bytes(a["record"], a["dataHash"])
    bad = json.loads(json.dumps(a["record"]))
    bad["engine"]["waterSavedM3"] += 1  # inflate the water saved by one m³
    assert not verify_bytes(bad, a["dataHash"])


def test_record_contents_and_placeholder_flag():
    r = build_record("algarrobal", "202610")
    assert r["schema"] == "ceres-ventures/earth-record@1" and r["period"] == "202610"
    assert {s["dataset"] for s in r["sources"]} == {"NASA POWER", "ECOSTRESS", "HLS", "GPM IMERG"}
    assert r["placeholder"] is True  # no real pulls in the test env
    assert "createdAt" not in r      # no timestamps inside the hashed bytes
    assert "lat" not in json.dumps(r) and str(r["plotId"]).startswith("0x")  # no coordinates


def test_canonical_bytes_match_js_convention():
    assert canonical({"b": 1, "a": {"d": 2, "c": "ñ"}}) == '{"a":{"c":"ñ","d":2},"b":1}'.encode()


def test_canonical_numbers_match_javascript():
    # JSON.stringify writes 0.0 as 0 and 1e-7 as 1e-7; the attester and /verify hash those bytes
    assert canonical({"b": 0.0, "a": 1.5, "c": 1e-7, "d": [True, None, 142.9]}) == b'{"a":1.5,"b":0,"c":1e-7,"d":[true,null,142.9]}'


def test_bad_period_rejected():
    with pytest.raises(ValueError):
        build_record("samegua", "2026-10")


def test_export_writes_one_file_per_farm_month(tmp_path):
    files = export(tmp_path, ["202609", "202610"], ["samegua"])
    assert [f.name for f in files] == ["samegua-202609.json", "samegua-202610.json"]
    pkg = json.loads(files[1].read_text())
    assert pkg["onchain"]["period"] == 202610 and isinstance(pkg["onchain"]["et0MmX10"], int)
    assert pkg["source"] == "evidence"


def _requirements(amount="50000", network="eip155:880024"):
    return {"x402Version": 2, "error": "payment required", "resource": {"url": "/v1/earth/samegua/202610"},
            "accepts": [{"scheme": "exact", "network": network, "asset": ASSET, "amount": amount, "payTo": PAY_TO,
                         "maxTimeoutSeconds": 60, "extra": {"name": "Ceres x402 Test USDC", "version": "1"}}]}


class FakeResp:
    def __init__(self, status, body, headers=None):
        self.status_code, self._body, self.headers, self.text = status, body, headers or {}, json.dumps(body)

    def json(self):
        return self._body


class FakeOracle:
    """Plays the x402 server + facilitator: recovers the EIP-3009 signer and checks every field."""

    def __init__(self, reqs):
        self.reqs, self.seen = reqs, []

    def get(self, url, headers=None, timeout=None):
        sig = (headers or {}).get("PAYMENT-SIGNATURE")
        if not sig:
            return FakeResp(402, self.reqs, {"PAYMENT-REQUIRED": x.b64json(self.reqs)})
        p = x.unb64json(sig)
        acc, auth = p["accepted"], p["payload"]["authorization"]
        msg = {**auth, "value": int(auth["value"]), "validAfter": int(auth["validAfter"]),
               "validBefore": int(auth["validBefore"]), "nonce": bytes.fromhex(auth["nonce"][2:])}
        domain = {"name": "Ceres x402 Test USDC", "version": "1", "chainId": 880024, "verifyingContract": ASSET}
        signer = Account.recover_message(encode_typed_data(domain, x.EIP3009_TYPES, msg), signature=p["payload"]["signature"])
        assert p["x402Version"] == 2 and acc["network"] == "eip155:880024"
        assert signer == auth["from"] == Account.from_key(AGENT_KEY).address
        assert auth["to"] == PAY_TO and auth["value"] == "50000"
        assert auth["nonce"] not in self.seen
        self.seen.append(auth["nonce"])
        tx = "0x" + "ab" * 32
        body = {"record": {"values": {"etMmDay": 4.9}}, "dataHash": "0x" + "cd" * 32, "placeholder": True,
                "proof": {"recordedOnChain": True, "paymentTxUrl": f"https://nofiscan.io/tx/{tx}"}}
        return FakeResp(200, body, {"PAYMENT-RESPONSE": x.b64json({"success": True, "transaction": tx, "network": acc["network"], "payer": signer})})


def test_x402_buyer_pays_once_with_valid_eip3009(monkeypatch):
    monkeypatch.setenv("X402_NETWORK", "eip155:880024")
    monkeypatch.setenv("X402_ASSET", ASSET)
    oracle = FakeOracle(_requirements())
    res = x.fetch_paid("https://oracle.test/v1/earth/samegua/202610", private_key=AGENT_KEY, session=oracle)
    assert res.status == 200 and res.payment["txUrl"].startswith("https://nofiscan.io/tx/0x")
    assert res.payment["amount"] == "50000" and len(oracle.seen) == 1
    assert "11" * 32 not in json.dumps(res.__dict__)  # key never echoed


def test_x402_buyer_refuses_overpriced_or_wrong_network(monkeypatch):
    monkeypatch.setenv("X402_NETWORK", "eip155:880024")
    monkeypatch.setenv("X402_MAX_AMOUNT", "100000")
    with pytest.raises(x.X402Error, match="cap"):
        x.fetch_paid("u", private_key=AGENT_KEY, session=FakeOracle(_requirements(amount="5000000")))
    with pytest.raises(x.X402Error, match="no acceptable"):
        x.fetch_paid("u", private_key=AGENT_KEY, session=FakeOracle(_requirements(network="eip155:1")))


def test_ceres_tool_uses_paid_path_when_configured(monkeypatch):
    from earth_oracle.ceres import tools

    monkeypatch.setenv("X402_EARTH_URL", "https://oracle.test")
    monkeypatch.setenv("X402_ASSET", ASSET)
    monkeypatch.setenv("CERES_AGENT_PRIVATE_KEY", AGENT_KEY)
    monkeypatch.setattr(tools, "fetch_paid", lambda url: x.fetch_paid(url, session=FakeOracle(_requirements())))
    r = tools.get_verified_record("samegua", "202610")
    assert r["paid_via_x402"] and r["recorded_on_chain"] and r["payment"]["txUrl"].startswith("https://nofiscan.io")


def test_records_api_is_farmer_safe(monkeypatch):
    from earth_oracle.server import app

    c = TestClient(app)
    r = c.get("/v1/records/samegua?periods=202609,202610")
    body = r.json()
    assert r.status_code == 200 and body["chainId"] == 880024 and len(body["records"]) == 2
    assert "values" not in body["records"][0] and body["records"][0]["dataHash"].startswith("0x")
    assert c.get("/v1/records/samegua?periods=oops").status_code == 422
    monkeypatch.delenv("ORACLE_ADMIN_TOKEN", raising=False)
    assert c.get("/v1/records/samegua/202610/package").status_code == 401
    monkeypatch.setenv("ORACLE_ADMIN_TOKEN", "t")
    full = c.get("/v1/records/samegua/202610/package", headers={"Authorization": "Bearer t"}).json()
    assert verify_bytes(full["record"], full["dataHash"])
