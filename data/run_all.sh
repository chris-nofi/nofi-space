#!/usr/bin/env bash
# Reproduce every Ceres Ventures data product from scratch (cached downloads are reused; pass --refresh to
# pull_and_build.py to force POWER/MODIS/SRTM/CMR re-download). Run from /workspace/space-apps-2026.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=data/.venv/bin/python
if [ ! -x "$PY" ]; then uv venv data/.venv && uv pip install -p $PY numpy pandas scipy requests xarray netCDF4 h5py rasterio earthaccess fsspec aiohttp; fi
$PY -u data/historical/chirps3_pull.py           # CHIRPS v3 monthly at 3 points (needed by the POWER precip QC)
$PY -u data/pull_and_build.py                     # POWER + FAO-56 ET0 + indices + MODIS NDVI + SRTM + CMR -> data/out/
$PY -u data/historical/build_historical.py        # 1981->now POWER/CHIRPS/ERA5 history -> data/historical/
$PY -u data/historical/spi_chirps.py              # SPI-3/6 from CHIRPS
if [ -n "${EARTHDATA_TOKEN:-}" ]; then
  $PY -u data/earthdata/earthdata_cog_pull.py ecostress hls   # direct COG reads (LP DAAC)
  $PY -u data/earthdata/smap_harmony.py 2015                  # SMAP via Harmony subsetting (slow: ~1 h)
else
  echo "EARTHDATA_TOKEN not set: skipping ECOSTRESS/HLS/SMAP"
fi
$PY -u data/partner/soilgrids_pull.py                      # SoilGrids 2.0 0-30 cm (NON-NASA) -> out/soilgrids.json
$PY -u data/partner/s2_pull.py                             # Sentinel-2 L2A 10 m NDVI, Earth Search STAC (partner) -> raw/s2_ndvi_points.csv
$PY -u data/partner/risk_build.py                          # soil/cover/frost/slope/erosion -> out/risk_extensions.json
$PY -u data/build_evidence.py 202607 202608 202609 202610   # -> avalanche/oracle/evidence/
node data/fix/apply_algarrobal_fix.mjs                      # -> data/patched/ceres-ai/ + algarrobal-fix.diff
$PY -u data/bundle_site_data.py                            # -> data/out/ceres-nasa-data.js (one browser bundle)
