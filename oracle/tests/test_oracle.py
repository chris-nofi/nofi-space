import base64
import json

from eth_account import Account
from fastapi.testclient import TestClient

from earth_oracle.config import load_farms
from earth_oracle.et0 import et0_pm, monthly_et0
from earth_oracle.evidence import evidence_hash, plot_hash
from earth_oracle.hls import crop_alive
from earth_oracle.power import climatology, summarize
from earth_oracle.sign import recover, sign_attestation


def test_et0_matches_fao56_example_17():
    # FAO-56 Example 17 (Bangkok, April): ET0 = 5.72 mm/day
    v = et0_pm(34.8, 25.6, 22.65, 2.0, 13.73, 2, 105, ea=2.85, g=0.14)
    assert abs(v - 5.72) < 0.05


def test_monthly_et0_shape_and_range():
    out = monthly_et0([28] * 12, [14] * 12, [22] * 12, [2.5] * 12, [55] * 12, -17.18, 1550)
    assert len(out) == 12 and all(2 < v < 9 for v in out)


def test_power_climatology_and_summary():
    farm = load_farms()["samegua"]
    series = {f"2024{m:02d}": 1.0 for m in range(1, 13)} | {"202413": 99.0, "202501": -999.0}
    raw = {
        "properties": {"parameter": {
            "T2M_MAX": {**series, **{f"2024{m:02d}": 27.0 for m in range(1, 13)}},
            "T2M_MIN": {**series, **{f"2024{m:02d}": 12.0 for m in range(1, 13)}},
            "PRECTOTCORR": {f"2024{m:02d}": 0.05 for m in range(1, 13)},
            "ALLSKY_SFC_SW_DWN": {f"2024{m:02d}": 6.5 for m in range(1, 13)},
            "RH2M": {f"2024{m:02d}": 50.0 for m in range(1, 13)},
            "WS2M": {f"2024{m:02d}": 2.5 for m in range(1, 13)},
        }},
        "parameters": {"ALLSKY_SFC_SW_DWN": {"units": "kW-hr/m^2/day"}},
    }
    clim = climatology(raw)
    assert clim["T2M_MAX"][0] == 27.0  # fill value and annual key ignored
    s = summarize(farm, raw)
    assert len(s["et0Monthly"]) == 12 and 15 < s["rainYearMm"] < 20


def test_crop_alive_rule():
    alive = [{"date": f"2026-{m:02d}-01", "ndvi": 0.6} for m in range(1, 13)]
    dead = [{"date": f"2026-{m:02d}-01", "ndvi": 0.1} for m in range(1, 13)]
    gap = alive[:3] + [{"date": f"2026-{m:02d}-01", "ndvi": 0.1} for m in range(4, 8)] + alive[7:]
    assert crop_alive(alive) is True
    assert crop_alive(dead) is False
    assert crop_alive(gap) is False


def test_eip712_sign_and_recover():
    acct = Account.create()
    att = {"plotId": "0x" + "11" * 32, "season": 2027, "rule": 0, "value": 6420, "cropAlive": True, "evidenceHash": "0x" + "22" * 32}
    escrow = "0x" + "33" * 20
    s = sign_attestation(att, acct.key.hex(), 43113, escrow)
    assert recover(att, s["signature"], 43113, escrow) == acct.address


def test_plot_hash_is_stable_and_hides_coordinates():
    f = load_farms()["carumas"]
    h = plot_hash(f)
    assert h == plot_hash(f) and h.startswith("0x") and len(h) == 66
    assert str(f.lat) not in h


def test_evidence_hash_canonical():
    assert evidence_hash({"b": 1, "a": 2}) == evidence_hash({"a": 2, "b": 1})


def test_x402_gate_demo_mode(monkeypatch):
    monkeypatch.setenv("X402_MODE", "demo")
    from earth_oracle.server import app

    c = TestClient(app)
    plot = next(f["plotId"] for f in c.get("/v1/farms").json() if f["id"] == "samegua")
    r = c.get(f"/v1/evidence-pack?plot={plot}&season=2027")
    assert r.status_code == 402
    req = json.loads(base64.b64decode(r.headers["PAYMENT-REQUIRED"]))
    assert req["accepts"][0]["scheme"] == "exact" and req["accepts"][0]["amount"] == "50000"
    pay = base64.b64encode(b'{"demo":true}').decode()
    r2 = c.get(f"/v1/evidence-pack?plot={plot}&season=2027", headers={"PAYMENT-SIGNATURE": pay})
    assert r2.status_code == 200
    assert json.loads(base64.b64decode(r2.headers["PAYMENT-RESPONSE"]))["simulated"] is True
    assert r2.json()["evidenceHash"].startswith("0x")


def test_water_endpoint_without_cache():
    from earth_oracle.server import app

    r = TestClient(app).get("/v1/farms/samegua/water")
    assert r.status_code == 200 and r.json()["farmId"] == "samegua"


def test_eip712_digest_matches_solidity_encoding():
    """Rebuild the digest exactly as WaterEscrow.hashAttestation does (abi.encode + \\x19\\x01)
    and compare with eth_account's typed-data hash, so Python signatures verify on-chain."""
    from eth_abi import encode
    from eth_account.messages import encode_typed_data
    from eth_utils import keccak

    from earth_oracle.sign import typed_data

    att = {"plotId": "0x" + "ab" * 32, "season": 2027, "rule": 0, "value": 6420, "cropAlive": True, "evidenceHash": "0x" + "cd" * 32}
    chain_id, escrow = 31337, "0x" + "12" * 20
    type_hash = keccak(text="Attestation(bytes32 plotId,uint32 season,uint8 rule,uint64 value,bool cropAlive,bytes32 evidenceHash)")
    struct_hash = keccak(encode(
        ["bytes32", "bytes32", "uint32", "uint8", "uint64", "bool", "bytes32"],
        [type_hash, bytes.fromhex("ab" * 32), 2027, 0, 6420, True, bytes.fromhex("cd" * 32)],
    ))
    domain_hash = keccak(encode(
        ["bytes32", "bytes32", "bytes32", "uint256", "address"],
        [keccak(text="EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
         keccak(text="AguaClara"), keccak(text="1"), chain_id, escrow],
    ))
    solidity_digest = keccak(b"\x19\x01" + domain_hash + struct_hash)

    msg = encode_typed_data(full_message=typed_data(att, chain_id, escrow))
    py_digest = keccak(b"\x19" + msg.version + msg.header + msg.body)
    assert py_digest == solidity_digest
