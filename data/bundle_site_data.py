#!/usr/bin/env python3
"""Bundle everything the dashboard / CERES needs into ONE browser file: data/out/ceres-nasa-data.js
   window.CERES_NASA_DATA = { generated, farms: { <id>: {...} }, sources: {...} }
Per farm: point/elevation, POWER climatology + ET0 + indices, crop water, El Algarrobal strategies,
MODIS + HLS NDVI monthly, ECOSTRESS ET monthly, SMAP (Carumas), CHIRPS history/SPI, ERA5 cross-checks,
latest evidence periods. Values come only from files produced by the pull scripts."""
import json, datetime as dt
from pathlib import Path
import pandas as pd
D = Path(__file__).resolve().parent
import sys; sys.path.insert(0, str(D))
from pull_and_build import FARMS, clean  # noqa

SOURCES = {
    "power": "NASA POWER Daily API v2, community AG (MERRA-2/GEOS-IT; CERES radiation) https://power.larc.nasa.gov/",
    "modis": "MOD13Q1 v061 NDVI 250 m 16-day, ORNL DAAC MODIS Web Service https://modis.ornl.gov/rst/api/v1/",
    "hls": "HLS L30/S30 v2.0 30 m (NASA LP DAAC) https://doi.org/10.5067/HLS/HLSS30.002",
    "ecostress": "ECOSTRESS L3T JET v002 ETdaily 70 m (NASA LP DAAC) https://doi.org/10.5067/ECOSTRESS/ECO_L3T_JET.002",
    "sentinel2": "Contains modified Copernicus Sentinel-2 L2A data 2024-2026 (ESA), via Element84 Earth Search STAC (partner)",
    "soilgrids": "Poggio et al. 2021, SoilGrids 2.0, ISRIC, CC-BY 4.0 (NON-NASA)",
    "era5": "ERA5 / ERA5-Land (ECMWF/Copernicus) via Open-Meteo archive API (NON-NASA)",
    "smap": "SMAP L3 Enhanced 9 km SPL3SMP_E v006 (NSIDC DAAC) https://doi.org/10.5067/M20OXIZHY3RJ",
    "srtm": "NASA SRTM GL1 30 m via OpenTopoData https://www.opentopodata.org/datasets/srtm/",
    "chirps": "CHIRPS v3.0 monthly, UCSB Climate Hazards Center https://data.chc.ucsb.edu/products/CHIRPS/v3.0/",
    "era5": "Copernicus ERA5 / ERA5-Land via Open-Meteo Historical API https://open-meteo.com/en/docs/historical-weather-api",
}


def monthly_clim(df, tcol, vcol):
    t = pd.to_datetime(df[tcol].astype(str).str[:10])
    g = df.assign(m=t.dt.month)[[vcol, "m"]].dropna().groupby("m")[vcol]
    return [None if m not in g.groups else round(float(g.get_group(m).mean()), 3) for m in range(1, 13)], \
           [int(len(g.get_group(m))) if m in g.groups else 0 for m in range(1, 13)]


def main():
    hls = pd.read_csv(D / "raw/hls_ndvi_points.csv") if (D / "raw/hls_ndvi_points.csv").exists() else None
    eco = pd.read_csv(D / "raw/ecostress_jet_points.csv") if (D / "raw/ecostress_jet_points.csv").exists() else None
    smap = pd.read_csv(D / "raw/smap_carumas.csv") if (D / "raw/smap_carumas.csv").exists() else None
    rd = lambda n: pd.read_csv(D / "raw" / n) if (D / "raw" / n).exists() else None
    hls_fp, eco_fp = rd("hls_ndvi_fieldpx.csv"), rd("ecostress_jet_fieldpx.csv")
    gp = json.loads((D / "out/green_pixel_candidates.json").read_text()) if (D / "out/green_pixel_candidates.json").exists() else {}
    farms = {}
    for fid in FARMS:
        f = json.loads((D / f"out/{fid}.json").read_text())
        h = json.loads((D / f"historical/{fid}_historical_summary.json").read_text())
        x = dict(point=dict(lat=f["lat"], lon=f["lon"], **f["elevation"]),
                 climate=dict(period=f["power"]["period"], climatology_2001_2025=f["power"]["climatology_2001_2025"],
                              climatology_1991_2020=h["climatology_1991_2020"], trends=h["trends"], extremes=h["extremes"],
                              enso_dec_apr=h["enso_dec_apr"], cross_checks=h["cross_checks"], era5_et0_mm_yr_1991_2020=h.get("era5_et0_mm_yr_1991_2020"),
                              last12_anomaly=f["indices"]["last12_months_anomaly_vs_2001_2020"]),
                 et0=dict(power_raw=f["indices"]["power_raw"], site_lapse_adjusted=f["indices"]["site_lapse_adjusted"]),
                 crop_water=f["crop_water"], ndvi_modis=f["ndvi"], qc=f.get("qc"))
        if "strategies_recomputed" in f:
            x["strategies_recomputed"] = f["strategies_recomputed"]
        def hls_block(src, px):
            hh = src[(src.farm == fid) & src.ndvi.notna()].copy()
            if not len(hh):
                return None
            cl, n = monthly_clim(hh, "date", "ndvi")
            hh["ym"] = hh.date.str[:7]
            ts = hh.groupby("ym").ndvi.median().round(3)
            return dict(pixel=px, monthly_mean=cl, n_clear=n, total_clear=int(len(hh)), total_scenes=int((src.farm == fid).sum()),
                        first=str(hh.date.min()), last=str(hh.date.max()), monthly_median_series=ts.to_dict(),
                        bare_months_lt_0_25=int(sum(1 for v in cl if v is not None and v < 0.25)),
                        latest=dict(date=str(hh.sort_values("date").date.iloc[-1]), ndvi=float(hh.sort_values("date").ndvi.iloc[-1])))

        def eco_block(src, px):
            ee = src[(src.farm == fid) & src.et_daily_mm.notna()].drop_duplicates(["datetime_utc"]).copy()
            if not len(ee):
                return None
            cl, n = monthly_clim(ee, "datetime_utc", "et_daily_mm")
            return dict(pixel=px, et_daily_mm_monthly_mean=cl, n_overpasses=n, total_valid=int(len(ee)),
                        total_read=int((src.farm == fid).sum()), first=str(ee.datetime_utc.min()), last=str(ee.datetime_utc.max()))
        app_px = [f["lat"], f["lon"]]
        fp = gp.get(fid, {}).get("nearest_green_candidates", [None])[0] if fid in ("samegua", "algarrobal") else None
        if fp:
            x["field_pixel"] = dict(lat=fp["lat"], lon=fp["lon"], dist_from_app_point_m=fp["dist_m"], ndvi_on_scene=fp["ndvi"],
                                    scene=gp[fid]["scene"], ndvi_at_app_point_on_scene=gp[fid]["ndvi_at_point"],
                                    basis="nearest HLS pixel with NDVI>=0.5 (find_green_pixels.py); candidate - confirm with farmer")
        if hls is not None:
            x["ndvi_hls_app_point"] = hls_block(hls, app_px)
        if hls_fp is not None and fp and fid in set(hls_fp.farm):
            x["ndvi_hls"] = hls_block(hls_fp, [fp["lat"], fp["lon"]])
        elif hls is not None:
            x["ndvi_hls"] = x["ndvi_hls_app_point"]
        if eco is not None:
            x["et_ecostress_app_point"] = eco_block(eco, app_px)
        if eco_fp is not None and fp and fid in set(eco_fp.farm):
            x["et_ecostress"] = eco_block(eco_fp, [fp["lat"], fp["lon"]])
        elif eco is not None:
            x["et_ecostress"] = x["et_ecostress_app_point"]
        if fid == "carumas" and smap is not None and len(smap):
            ss = smap.dropna(subset=["sm_am"])
            cl, n = monthly_clim(ss, "date", "sm_am")
            ss2 = ss.copy(); ss2["ym"] = ss2.date.astype(str).str[:7]
            x["smap"] = dict(monthly_series_m3m3=ss2.groupby("ym").sm_am.mean().round(3).to_dict(), sm_am_monthly_mean_m3m3=cl, n=n, total_valid=int(len(ss)), first=str(ss.date.min()), last=str(ss.date.max()),
                             latest=dict(date=str(ss.date.iloc[-1]), sm=float(ss.sm_am.iloc[-1])) if len(ss) else None)
        ev = sorted((D.parent / "avalanche/oracle/evidence").glob(f"{fid}-*.json"))
        x["evidence_files"] = [f"avalanche/oracle/evidence/{p.name}" for p in ev]
        rx = D / "out/risk_extensions.json"
        if rx.exists():
            x["extensions"] = json.loads(rx.read_text())["farms"][fid]  # soil (NON-NASA SoilGrids), S2 cover (partner), frost, slope, erosion
        x["field_pixel_status"] = ("complete" if (D / "raw/hls_ndvi_fieldpx.csv").exists() and (D / "raw/ecostress_jet_fieldpx.csv").exists()
                                   else "pending: data/earthdata/field_pixels_pull.py still running; HLS/ECOSTRESS for samegua/algarrobal are app-point (bare ground) values")
        farms[fid] = x
    out = clean(dict(generated=dt.datetime.now().isoformat(timespec="seconds"), farms=farms, sources=SOURCES))
    (D / "out/ceres-site-data.json").write_text(json.dumps(out, indent=1, allow_nan=False))
    (D / "out/ceres-nasa-data.js").write_text("/* Generated by space-apps-2026/data/bundle_site_data.py - REAL NASA/partner data. */\n"
                                             "window.CERES_NASA_DATA = " + json.dumps(out, allow_nan=False) + ";\n")
    print("wrote out/ceres-nasa-data.js and out/ceres-site-data.json", sum(len(json.dumps(v)) for v in farms.values()), "bytes")


if __name__ == "__main__":
    main()
