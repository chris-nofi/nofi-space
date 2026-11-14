"""Real NASA data package (Kepler, data/): engine inputs, reconciled El Algarrobal numbers, real evidence."""
import json

import pytest

from earth_oracle.ceres.tools import get_climate_context
from earth_oracle.proof import package, summary, verify_bytes
from earth_oracle.real_data import read_input
from earth_oracle.si.climate import baseline_climate
from earth_oracle.si.engine import analyze


@pytest.fixture(scope="module")
def alg():
    return analyze("algarrobal", draws=120)


def test_engine_reads_real_power_and_et0():
    c = baseline_climate("algarrobal")
    assert c.source == "nasa-power" and c.et0_ref is not None
    f = read_input("algarrobal_power.json")
    assert c.et0(-17.62, 162)[0] == pytest.approx(f["et0MmDayMonthly"][0], rel=1e-6)
    assert f["rainRangeMmYr"]["chirps"] == pytest.approx(26.5, abs=0.2)


def test_algarrobal_matches_kepler_reconciliation(alg):
    """CONNECT-REAL-DATA §4.3: 17,070 / 12,800 / 20,210 / 12,890 m³/ha/yr, drip + strip cover first."""
    exp = {s["id"]: s["water"]["expected"] for s in alg["compare"]["strategies"]}
    for sid, kepler in {"current": 17070, "deficit": 12800, "cover": 20210, "drip": 12890}.items():
        assert exp[sid] == pytest.approx(kepler, rel=0.005), sid
    assert alg["tradeoffs"]["ranking"][0]["id"] == "drip"
    assert [s["id"] for s in alg["compare"]["strategies"] if s["recommended"]] == ["drip"]
    drip = next(s for s in alg["compare"]["strategies"] if s["id"] == "drip")
    assert drip["deltas"]["waterPct"] == pytest.approx(-24.5, abs=0.15)


def test_off_field_points_are_not_used_as_measurements(alg):
    assert alg["waterUse"]["calibration"] == 1.0
    assert all(x["source"] != "ecostress" for x in alg["waterUse"]["current"])
    assert alg["dataQuality"]["ecostressPoint"]["representative"] is False
    t = alg["voice"]["es"]["text"]
    assert "no uso ECOSTRESS" in t and "ECOSTRESS muestra" not in t


def test_carumas_rain_source_uncertainty_lowers_confidence():
    a = analyze("carumas", draws=120)
    assert a["dataQuality"]["rainRangeMmYr"]["era5"] > 3 * a["dataQuality"]["rainRangeMmYr"]["chirps"]
    assert a["uncertainty"]["confidence"] == "low" and "ERA5" in a["voice"]["es"]["text"]


def test_real_evidence_records_and_issues():
    ok = package("carumas", "202610")
    assert ok["source"] == "evidence" and ok["attestable"] and verify_bytes(ok["record"], ok["dataHash"])
    bad = summary(package("algarrobal", "202610"))
    codes = " ".join(i["en"] for i in bad["issues"])
    assert not bad["attestable"] and "NDVI 0.069" in codes and "provisional crop pixel" in codes
    assert bad["et0Mm"] == 142.9  # Kepler's spot-check value


def test_climate_context_tool():
    c = get_climate_context("samegua")
    assert c["rain_mm_yr_by_source"]["chirps"] == pytest.approx(105.3, abs=0.2)
    assert any("ERA5-Land" in w for w in c["warnings"])
    json.dumps(c)
