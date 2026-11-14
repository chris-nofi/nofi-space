"""Import Kepler's real NASA data package (data/) into the engine's input files (oracle/data/real/).

Run: python -m earth_oracle.cli import-real

Per-farm choices follow data/CONNECT-REAL-DATA.md §5 and data/kepler-answers.md Q1-Q6:
- ET0: FAO-56 Penman-Monteith on raw NASA POWER, 2001-2025 (within ±5 % of ERA5 at all points).
- Temperature: Carumas = POWER + lapse shift (matches ERA5-Land within 0.1 °C); Samegua = POWER shifted to
  ERA5-Land monthly means (the POWER cell sits at 3,851 m); El Algarrobal = raw POWER (coastal inversion).
- Rain: CHIRPS v3 1991-2020 (POWER and ERA5 kept as the range); IMERG pending GES DISC EULA.
- ECOSTRESS: monthly mean ETdaily at the map point (70 m) with overpass counts.
- NDVI (package v2): Carumas = HLS 30 m at the app point (cropland); Samegua / El Algarrobal = Sentinel-2 10 m
  at the provisional field pixel (nearest HLS pixel with NDVI >= 0.5, 150 m / 532 m from the app point, to be
  confirmed with the farmer), because HLS at the app point reads bare ground (~0.05). MODIS 250 m is kept as context.
- Extensions (v2): SoilGrids (NON-NASA), Sentinel-2 cover / bare / vulnerable months, frost (preferred series per
  farm), SRTM slope and an erosion proxy (relative rank only, IMERG blocked).
- `representative` is false where Kepler found the point on desert or mixed pixels (Samegua, El Algarrobal):
  the engine then reports the value but does not treat it as the field's own measurement.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

from .config import DATA

REPO = Path(__file__).resolve().parents[2]
PACKAGE = REPO / "data"
REAL = DATA / "real"
EVIDENCE = REPO / "avalanche" / "oracle" / "evidence"

# Kepler §1/§4/§5: which point values describe the field itself
REPRESENTATIVE = {
    "carumas": {"ecostress": True, "ndvi": True},
    "samegua": {"ecostress": False, "ndvi": False},
    "algarrobal": {"ecostress": False, "ndvi": False},
}
TEMP_RULE = {
    "carumas": "POWER 2001-2025 + lapse shift to SRTM elevation (checked against ERA5-Land)",
    "samegua": "POWER 2001-2025 shifted to ERA5-Land 1991-2020 monthly means (POWER cell at 3,851 m)",
    "algarrobal": "raw POWER 2001-2025 (lapse correction is wrong under the coastal inversion)",
}
OFF_FIELD_NOTE = {
    "es": "El punto del mapa probablemente cae en desierto o en un píxel mixto, no en la chacra; se reporta pero no se usa como medición de la parcela.",
    "en": "The map point probably falls on desert or a mixed pixel, not the field; reported but not used as the field's measurement.",
}


def bundle() -> dict:
    return json.loads((PACKAGE / "out" / "ceres-site-data.json").read_text(encoding="utf-8"))


def _climatology_csv(farm_id: str) -> list[dict]:
    with open(PACKAGE / "historical" / f"{farm_id}_climatology_1991_2020.csv", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def _f(v) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def build_inputs(farm_id: str, b: dict | None = None) -> dict:
    b = b or bundle()
    n = b["farms"][farm_id]
    clim = n["climate"]["climatology_2001_2025"]
    rows = _climatology_csv(farm_id)
    tmax, tmin = list(clim["tmax_monthly"]), list(clim["tmin_monthly"])
    if farm_id == "carumas":
        shift = n["point"]["lapse_shift_degC"]
        tmax = [t + shift for t in tmax]
        tmin = [t + shift for t in tmin]
    elif farm_id == "samegua":
        delta = [(_f(r["era5land_t2m"]) or _f(r["t2m"])) - _f(r["t2m"]) for r in rows]
        tmax = [t + d for t, d in zip(tmax, delta)]
        tmin = [t + d for t, d in zip(tmin, delta)]
    chirps = [_f(r["chirps_mm"]) or 0.0 for r in rows]
    power_rain = [_f(r["precip_mm"]) or 0.0 for r in rows]
    era5_rain = [_f(r["era5_precip_mm"]) for r in rows]
    days = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    et0 = n["et0"]["power_raw"]
    power = {
        "source": "nasa-power",
        "farmId": farm_id,
        "tmaxMonthly": [round(v, 2) for v in tmax],
        "tminMonthly": [round(v, 2) for v in tmin],
        "rainMmDayMonthly": [round(v / d, 3) for v, d in zip(chirps, days)],
        "rhMonthly": clim["rh2m_monthly"],
        "u2Monthly": clim["ws2m_monthly"],
        "rsMjMonthly": clim["rs_mj_m2_day_monthly"],
        "et0MmDayMonthly": et0["et0_pm_monthly_mm_day"],
        "provenance": {
            "et0": "FAO-56 Penman-Monteith on NASA POWER daily (AG), 2001-2025, raw grid cell",
            "temperature": TEMP_RULE[farm_id],
            "rain": "CHIRPS v3.0 monthly 1991-2020 (substitute for GPM IMERG, pending GES DISC EULA)",
            "humidity_wind_radiation": "NASA POWER 2001-2025 climatology",
            "period": n["climate"]["period"],
        },
        "rainRangeMmYr": {
            "chirps": round(sum(chirps), 1), "power": round(sum(power_rain), 1),
            "era5": round(sum(v for v in era5_rain if v is not None), 1) if any(v is not None for v in era5_rain) else None,
        },
    }
    eco = n.get("et_ecostress") or {}
    ecostress = {
        "source": "ECOSTRESS L3T JET v002 ETdaily, 70 m (NASA LP DAAC)",
        "farmId": farm_id,
        "product": "ECO_L3T_JET",
        "etMonthly": eco.get("et_daily_mm_monthly_mean"),
        "overpassesMonthly": eco.get("n_overpasses"),
        "totalValid": eco.get("total_valid"), "totalRead": eco.get("total_read"),
        "first": eco.get("first"), "last": eco.get("last"),
        "monthsWithData": sum(1 for v in eco.get("et_daily_mm_monthly_mean") or [] if v is not None),
        "overpasses": [],
        "representative": REPRESENTATIVE[farm_id]["ecostress"],
        "note": "Monthly mean of valid overpasses 2019-2026 at the map point (multi-year climatology).",
    }
    modis = n["ndvi_modis"]
    ext = (_extensions().get(farm_id) or {})
    cover = ext.get("cover") or {}
    hls = n.get("ndvi_hls_app_point") or n.get("ndvi_hls")
    fp = n.get("field_pixel")
    if farm_id == "carumas" and hls and all(v is not None for v in hls.get("monthly_mean", [None])):
        ndvi = {"source": "HLS v2.0 30 m (L30/S30), monthly mean 2024-2026, Fmask", "dataset": "HLS_L30_S30_v2.0",
                "pointKind": "app_point", "monthly": hls["monthly_mean"], "nClear": hls.get("n_clear"),
                "first": hls.get("first"), "last": hls.get("last"), "representative": True,
                "note": "App point is on cropland (HLS NDVI 0.31-0.63)."}
    elif fp and cover.get("s2_median_ndvi_by_month_2024_2026"):
        ndvi = {"source": "Sentinel-2 L2A 10 m (ESA, partner), monthly median 2024-2026, SCL mask", "dataset": "Sentinel-2_L2A",
                "pointKind": "field_pixel_provisional", "monthly": cover["s2_median_ndvi_by_month_2024_2026"], "nClear": cover.get("s2_obs_by_month"),
                "fieldPixel": fp, "representative": True,
                "note": f"Provisional field pixel {fp.get('dist_from_app_point_m')} m from the app point (nearest HLS pixel with NDVI >= 0.5); confirm with the farmer. HLS at the app point reads bare ground."}
    else:
        ndvi = {"source": "MOD13Q1 v061 NDVI, 250 m, 16-day (ORNL DAAC)", "dataset": "MOD13Q1_v061", "pointKind": "app_point",
                "monthly": modis["ndvi_monthly_mean"], "representative": REPRESENTATIVE[farm_id]["ndvi"],
                "note": "MODIS pixel (~6 ha) is larger than the 1-2 ha field."}
    ndvi["context"] = {
        "hlsAppPoint": {k: (hls or {}).get(k) for k in ("monthly_mean", "n_clear", "total_clear", "first", "last")} if hls else None,
        "modis250m": {"monthly": modis["ndvi_monthly_mean"], "first": modis.get("first"), "last": modis.get("last"), "latest": modis.get("latest")},
        "s2FieldPixel": cover.get("s2_median_ndvi_by_month_2024_2026"),
    }
    context = {
        "farmId": farm_id,
        "point": n["point"],
        "climatology1991_2020": n["climate"]["climatology_1991_2020"],
        "trends": n["climate"].get("trends"),
        "extremes": n["climate"].get("extremes"),
        "ensoDecApr": n["climate"].get("enso_dec_apr"),
        "crossChecks": n["climate"].get("cross_checks"),
        "era5Et0MmYr": n["climate"].get("era5_et0_mm_yr_1991_2020"),
        "last12": n["climate"].get("last12_anomaly"),
        "et0MmYr": et0.get("et0_pm_mm_yr"),
        "cropWater": n.get("crop_water"),
        "strategiesRecomputed": n.get("strategies_recomputed"),
        "rainRangeMmYr": power["rainRangeMmYr"],
        "temperatureRule": TEMP_RULE[farm_id],
        "representative": REPRESENTATIVE[farm_id],
        "offFieldNote": None if REPRESENTATIVE[farm_id]["ecostress"] else OFF_FIELD_NOTE,
        "qc": n.get("qc"),
        "fieldPixel": fp,
        "extensions": _public_extensions(farm_id, ext),
        "smap": _smap_summary(n.get("smap")),
        "generated": b.get("generated"),
        "sources": b.get("sources"),
    }
    return {"power": power, "ecostress": ecostress, "ndvi": ndvi, "context": context}


def _extensions() -> dict:
    p = PACKAGE / "out" / "risk_extensions.json"
    return json.loads(p.read_text(encoding="utf-8"))["farms"] if p.exists() else {}


def erosion_ranks() -> dict:
    """Relative erosion rank (Kepler §10: a rank, never a number). Proxy = tan(slope) x mean intensity of the
    wettest 5 % of days (NASA POWER), raised one step when the field has bare months in the rainy season."""
    ext = _extensions()
    score = {}
    for fid, e in ext.items():
        proxy = ((e.get("erosion") or {}).get("power") or {}).get("proxy_tan_slope_x_p95_intensity") or 0.0
        wet_bare = any("rainy" in " ".join(v.get("reasons", [])) for v in (e.get("cover") or {}).get("vulnerable_months", []))
        score[fid] = proxy * (2.0 if wet_bare else 1.0)
    order = sorted(score, key=score.get, reverse=True)
    labels = ["high", "medium", "low"]
    return {fid: labels[min(i, 2)] for i, fid in enumerate(order)}


def _public_extensions(farm_id: str, ext: dict) -> dict | None:
    if not ext:
        return None
    frost = ext.get("frost") or {}
    pref = frost.get("preferred")
    cover = ext.get("cover") or {}
    return {
        "soil": ext.get("soil"),
        "cover": {k: cover.get(k) for k in ("point", "bare_threshold_ndvi", "s2_median_ndvi_by_month_2024_2026", "s2_obs_by_month",
                                            "hls_median_ndvi_by_month", "bare_months", "vulnerable_months", "method")},
        "frost": {"preferred": pref, "preferredReason": frost.get("preferred_reason"), "series": frost.get(pref) if pref else None,
                  "powerRawCell": {k: (frost.get("power") or {}).get(k) for k in ("clim_1991_2020_days_lt0_yr", "clim_1991_2020_days_lt2_yr")}},
        "slope": ext.get("slope"),
        "erosion": {"rank": erosion_ranks().get(farm_id), "power": (ext.get("erosion") or {}).get("power"),
                    "era5": (ext.get("erosion") or {}).get("era5"), "method": (ext.get("erosion") or {}).get("method"),
                    "imergStatus": (ext.get("erosion") or {}).get("imerg_status")},
    }


def _smap_summary(sm: dict | None) -> dict | None:
    if not sm:
        return None
    return {k: v for k, v in sm.items() if k != "monthly_series_m3m3"}


def import_all() -> list[Path]:
    REAL.mkdir(parents=True, exist_ok=True)
    b = bundle()
    out = []
    for fid in b["farms"]:
        parts = build_inputs(fid, b)
        for kind, obj in (("power", parts["power"]), ("ecostress", parts["ecostress"]), ("ndvi", parts["ndvi"]), ("context", parts["context"])):
            p = REAL / f"{fid}_{kind}.json"
            p.write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            out.append(p)
    return out


def read_input(name: str) -> dict | None:
    """Engine input lookup: a fresh NASA pull in the cache wins, then the imported real package."""
    from .config import CACHE

    for d in (CACHE, REAL):
        p = d / name
        if p.exists():
            return json.loads(p.read_text(encoding="utf-8"))
    return None


def context(farm_id: str) -> dict | None:
    return read_input(f"{farm_id}_context.json")
