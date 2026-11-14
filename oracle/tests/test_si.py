import numpy as np
import pytest
from fastapi.testclient import TestClient

from earth_oracle.si import AGENT_NAME
from earth_oracle.si.climate import apply_scenario, baseline_climate
from earth_oracle.si.engine import analyze
from earth_oracle.si.library import crop_kc_by_month, expand_year, farm_rotations
from earth_oracle.si.seasons import detect
from earth_oracle.si.sim import effective_rain, soil_score

FARMS = ["carumas", "samegua", "algarrobal"]


@pytest.fixture(scope="module")
def runs():
    return {f: analyze(f, draws=80) for f in FARMS}


def test_effective_rain_matches_scs():
    assert effective_rain(np.array([100.0]))[0] == pytest.approx(84.0)
    assert effective_rain(np.array([300.0]))[0] == pytest.approx(155.0)


def test_kc_curve_follows_fao_stages():
    kc = crop_kc_by_month("potato", 5)
    assert kc[0] == 0.5 and max(kc) == 1.15 and kc[-1] < 1.15


def test_calendar_wraps_year_end():
    cal = expand_year({"weight": 1, "segments": [{"crop": "potato", "start": 11, "months": 5}]})
    assert [cal.slots[m].crop for m in (10, 11, 0, 1, 2)] == ["potato"] * 5
    assert cal.slots[5].crop is None


def test_soil_score_rewards_cover_and_legumes():
    assert soil_score(0.5, 0.7, 3, 1.2, 0, 3) > soil_score(0.0, 0.2, 1, 0.5, 4, 1)


def test_every_farm_has_current_plus_three(runs):
    for f, a in runs.items():
        ids = [s["id"] for s in a["compare"]["strategies"]]
        assert len(ids) == 4 and sum(s["current"] for s in a["compare"]["strategies"]) == 1, f


def test_four_modules_present(runs):
    for a in runs.values():
        assert {"compare", "tradeoffs", "risk", "uncertainty", "seasons", "voice"} <= a.keys()
        assert len(a["risk"]["strategies"]["current"]["grid"]) == 5
        assert all(len(h["monthly"]) == 12 for h in a["risk"]["strategies"]["current"]["grid"])


def test_uncertainty_quantiles_ordered(runs):
    for a in runs.values():
        for s in a["uncertainty"]["strategies"].values():
            for metric in ("water", "incomePenHa"):
                q = s[metric]
                assert q["p10"] <= q["p50"] <= q["p90"]
        assert sum(a["uncertainty"]["rankFirstProbability"].values()) == pytest.approx(1.0, abs=1e-6)


def test_water_priority_picks_lowest_water_irrigated():
    a = analyze("samegua", priorities={"water": 1, "soil": 0, "income": 0, "resilience": 0}, draws=60)
    lowest = min(a["compare"]["strategies"], key=lambda s: s["water"]["p50"])["id"]
    assert a["tradeoffs"]["ranking"][0]["id"] == lowest


def test_dry_scenario_raises_deficit():
    wet = analyze("samegua", draws=60)
    dry = analyze("samegua", scenario={"rainPct": -40}, draws=60)
    assert dry["uncertainty"]["strategies"]["current"]["deficitPct"]["p50"] > wet["uncertainty"]["strategies"]["current"]["deficitPct"]["p50"]


def test_warming_scenario_raises_et0():
    c = baseline_climate("samegua")
    hot = apply_scenario(c, 0, 2)
    assert hot.et0(-17.18, 1550).sum() > c.et0(-17.18, 1550).sum()


def test_bare_windows_detected():
    nd = np.array([0.6, 0.6, 0.5, 0.2, 0.15, 0.15, 0.15, 0.15, 0.2, 0.2, 0.5, 0.6])
    d = detect(nd)
    assert d["bareMonths"] == 7 and d["bareWindows"][0]["startMonth"] == 4


def test_confidence_capped_while_synthetic(runs):
    for a in runs.values():
        if a["dataQuality"]["climate"] == "synthetic":
            assert a["uncertainty"]["confidence"] in ("low", "medium")


def test_ceres_is_grounded_and_reminds_review(runs):
    for a in runs.values():
        for lang, phrase in (("es", "Agencia Agraria"), ("en", "Agencia Agraria")):
            v = a["voice"][lang]
            assert v["agent"] == AGENT_NAME and phrase in v["text"]
        cur = next(s for s in a["compare"]["strategies"] if s["current"])
        assert f"{cur['water']['p50']:,.0f}".split(",")[0] in a["voice"]["en"]["text"]


def test_model_card_compares_three_approaches():
    from earth_oracle.si.model import load

    _, card = load()
    assert set(card["comparison"]) == {"physics", "linear", "gbm"}
    assert card["comparison"]["gbm"]["mae"] < card["comparison"]["physics"]["mae"]


def test_api_analyze_and_ceres():
    from earth_oracle.server import app

    c = TestClient(app)
    r = c.post("/v1/si/analyze", json={"farmId": "samegua", "draws": 60, "lang": "en"})
    assert r.status_code == 200 and r.json()["agent"] == AGENT_NAME
    b = c.post("/v1/ceres/brief", json={"farmId": "carumas", "draws": 60, "lang": "es"})
    assert b.status_code == 200 and b.json()["lang"] == "es"
    assert c.post("/v1/si/analyze", json={"farmId": "nope"}).status_code == 404
    assert c.get("/v1/si/model").json()["selected"] in ("gbm", "linear", "physics")


def test_rotations_reference_known_crops():
    from earth_oracle.si.library import crops

    lib = crops()["crops"]
    for f in FARMS:
        for s in farm_rotations(f)["strategies"]:
            assert abs(sum(y["weight"] for y in s["years"]) - 1) < 0.02
            for y in s["years"]:
                for seg in y["segments"]:
                    assert seg["crop"] in lib
