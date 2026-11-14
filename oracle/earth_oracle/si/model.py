"""SI water-use model: predicts monthly field evapotranspiration (mm/day) with uncertainty.

Why: ECOSTRESS passes over a field irregularly (space station orbit), so many months have
no observation. The model fills those gaps from NASA POWER weather + HLS NDVI, and gives
a calibration factor that ties the FAO-56 physics to what the satellite actually sees.

Three approaches are trained and compared on the same grouped cross-validation, as the
challenge asks ("compare different SI or statistical approaches"):
  1. physics  — FAO-56 with Kc estimated from NDVI (Kc ≈ 1.3·NDVI − 0.05), no training
  2. linear   — ridge regression on the harmonized features
  3. gbm      — gradient-boosting quantile regressors (p10 / p50 / p90)

Training data:
  * real    — ECOSTRESS overpasses joined to POWER + HLS (oracle/data/cache/*), when present
  * synthetic — physics-based simulation with management and sensor noise, so the pipeline
                runs end to end before the first Earthdata download. The model card says which.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from ..config import DATA, load_farms
from .climate import DAYS, baseline_climate, climate_sd, draw
from .library import farm_rotations, strategy_calendars
from .sim import simulate

MODEL_DIR = DATA / "models"
FEATURES = ["month_sin", "month_cos", "et0", "tmax", "tmin", "rain_mm", "ndvi", "elev_km", "irrigated"]
QUANTILES = (0.1, 0.5, 0.9)


def ndvi_from_cover(cover: np.ndarray, rng: np.random.Generator | None = None) -> np.ndarray:
    v = 0.12 + 0.75 * np.asarray(cover)
    if rng is not None:
        v = v + rng.normal(0, 0.04, v.shape)
    return np.clip(v, 0.05, 0.95)


def physics_et(et0: np.ndarray, ndvi: np.ndarray) -> np.ndarray:
    kc = np.clip(1.3 * ndvi - 0.05, 0.1, 1.25)
    return kc * et0


def synthetic_dataset(years: int = 12, seed: int = 7) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """X, y (ET mm/day as a satellite would see it), groups (farm-year), et0 column for physics."""
    rng = np.random.default_rng(seed)
    farms = load_farms()
    X, y, groups = [], [], []
    g = 0
    for fid, farm in farms.items():
        rot = farm_rotations(fid)
        base = baseline_climate(fid)
        sd = climate_sd(fid)
        for _ in range(years):
            for strat in rot["strategies"]:
                c = draw(base, sd, rng)
                et0 = c.et0(farm.lat, farm.elevation_m)
                r = simulate(strategy_calendars(fid, strat), c, et0, rot,
                             kc_scale=rng.normal(1, 0.08), infiltration_bonus=strat.get("infiltrationBonus", 0))
                true_et = r.actual_mm / DAYS
                mgmt = rng.lognormal(0, 0.10, 12)            # farm management variability
                sensor = rng.normal(0, 0.15, 12)             # ECOSTRESS ET uncertainty ~15 %
                obs = np.clip(true_et * mgmt * (1 + sensor), 0, None)
                ndvi = ndvi_from_cover(r.cover, rng)
                for m in range(12):
                    X.append([np.sin(2 * np.pi * m / 12), np.cos(2 * np.pi * m / 12), et0[m], c.tmax[m], c.tmin[m],
                              c.rain_mm[m], ndvi[m], farm.elevation_m / 1000, 1.0 if rot["water"] == "irrigated" else 0.0])
                    y.append(obs[m])
                    groups.append(g)
                g += 1
    return np.array(X), np.array(y), np.array(groups), np.array(X)[:, FEATURES.index("et0")]


def real_dataset() -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray] | None:
    """TODO(T2.7): join ECOSTRESS overpasses with POWER monthly + HLS NDVI for each farm.
    Return None until at least ~60 real overpasses exist."""
    return None


def _cv_compare(X: np.ndarray, y: np.ndarray, groups: np.ndarray) -> dict:
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.linear_model import Ridge
    from sklearn.metrics import mean_absolute_error, r2_score
    from sklearn.model_selection import GroupKFold
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    et0_col, ndvi_col = FEATURES.index("et0"), FEATURES.index("ndvi")
    res = {"physics": {"mae": [], "r2": []}, "linear": {"mae": [], "r2": []}, "gbm": {"mae": [], "r2": [], "coverage80": []}}
    for tr, te in GroupKFold(n_splits=5).split(X, y, groups):
        p = physics_et(X[te, et0_col], X[te, ndvi_col])
        res["physics"]["mae"].append(mean_absolute_error(y[te], p)); res["physics"]["r2"].append(r2_score(y[te], p))
        lin = make_pipeline(StandardScaler(), Ridge(alpha=1.0)).fit(X[tr], y[tr])
        pl = lin.predict(X[te])
        res["linear"]["mae"].append(mean_absolute_error(y[te], pl)); res["linear"]["r2"].append(r2_score(y[te], pl))
        q = {a: GradientBoostingRegressor(loss="quantile", alpha=a, n_estimators=150, max_depth=3, learning_rate=0.08, subsample=0.8, random_state=1).fit(X[tr], y[tr]) for a in QUANTILES}
        p50 = q[0.5].predict(X[te])
        lo, hi = q[0.1].predict(X[te]), q[0.9].predict(X[te])
        res["gbm"]["mae"].append(mean_absolute_error(y[te], p50)); res["gbm"]["r2"].append(r2_score(y[te], p50))
        res["gbm"]["coverage80"].append(float(np.mean((y[te] >= lo) & (y[te] <= hi))))
    return {k: {m: round(float(np.mean(v)), 3) for m, v in d.items()} for k, d in res.items()}


def train(save: bool = True) -> dict:
    """Train on real data if available, else synthetic. Returns the model card."""
    from sklearn.ensemble import GradientBoostingRegressor
    import joblib

    real = real_dataset()
    X, y, groups, _ = real if real else synthetic_dataset()
    cv = _cv_compare(X, y, groups)
    models = {a: GradientBoostingRegressor(loss="quantile", alpha=a, n_estimators=150, max_depth=3, learning_rate=0.08, subsample=0.8, random_state=1).fit(X, y) for a in QUANTILES}
    best = min(cv, key=lambda k: cv[k]["mae"])
    card = {
        "name": "CERES Ventures SI water-use model",
        "version": "0.1.0",
        "trainedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "target": "monthly mean field evapotranspiration, mm/day (ECOSTRESS-like)",
        "features": FEATURES,
        "trainingData": "real ECOSTRESS + POWER + HLS" if real else "SYNTHETIC physics-based simulation (replace with ECOSTRESS once cached)",
        "rows": int(len(y)),
        "groups": int(len(set(groups.tolist()))),
        "validation": "5-fold GroupKFold by farm-year (no leakage across years)",
        "comparison": cv,
        "selected": "gbm" if cv["gbm"]["mae"] <= cv[best]["mae"] * 1.05 else best,
        "uncertainty": "p10–p90 from quantile gradient boosting; 'coverage80' is the share of held-out values inside that band (target ≈ 0.80)",
        "limits": [
            "Trained on synthetic data until real ECOSTRESS overpasses are cached." if not real else "Three farms only; does not generalize beyond similar Moquegua zones.",
            "NDVI is a proxy for crop cover; it saturates in dense canopies.",
            "ECOSTRESS measures water consumed, not water delivered by the canal.",
        ],
    }
    if save:
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(models, MODEL_DIR / "et_quantiles.joblib")
        (MODEL_DIR / "model_card.json").write_text(json.dumps(card, indent=2), encoding="utf-8")
    return card


_LOADED: dict | None = None


def load() -> tuple[dict, dict]:
    """(quantile models, model card); trains on first use if no saved model exists."""
    global _LOADED
    if _LOADED is None:
        import joblib

        mpath, cpath = MODEL_DIR / "et_quantiles.joblib", MODEL_DIR / "model_card.json"
        if not (mpath.exists() and cpath.exists()):
            train(save=True)
        _LOADED = {"models": joblib.load(mpath), "card": json.loads(cpath.read_text(encoding="utf-8"))}
    return _LOADED["models"], _LOADED["card"]


def predict(features: np.ndarray) -> dict[str, np.ndarray]:
    models, _ = load()
    out = {f"p{int(a * 100)}": np.clip(models[a].predict(features), 0, None) for a in QUANTILES}
    # enforce monotone quantiles
    out["p10"] = np.minimum(out["p10"], out["p50"])
    out["p90"] = np.maximum(out["p90"], out["p50"])
    return out


def feature_rows(farm_id: str, clim, et0: np.ndarray, ndvi: np.ndarray, irrigated: bool) -> np.ndarray:
    farm = load_farms()[farm_id]
    return np.array([[np.sin(2 * np.pi * m / 12), np.cos(2 * np.pi * m / 12), et0[m], clim.tmax[m], clim.tmin[m],
                      clim.rain_mm[m], ndvi[m], farm.elevation_m / 1000, 1.0 if irrigated else 0.0] for m in range(12)])
