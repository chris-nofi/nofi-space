#!/usr/bin/env python3
"""Put NASA GPM IMERG Late Run Daily v07 (GPM_3IMERGDL) into the farm-month evidence as the primary monthly rain.

Input : data/raw/imerg_daily_late_v07.csv  (from data/earthdata/imerg_opendap_pull.py late 2026-07-01 2026-10-31)
Edits : avalanche/oracle/evidence/<farm>-<YYYYMM>.json, in place, only:
        - indicators.precip_mm  -> IMERG Late monthly sum (every day of the month required, else left unchanged)
                                   with the previous CHIRPS v3 value kept as `crossCheck` (not primary)
        - extensions.erosion.method / imerg_status -> IMERG access status (erosion climatology itself stays POWER/ERA5;
                                   an IMERG Final daily climatology is future work)
        - revision -> number of records already anchored for (farm, period) per ceres-web/attestations.json
                      (WaterProofRegistry.verify() matches only the LATEST revision, so a corrected record of an
                      anchored month must be attested as the next revision)
        - _note    -> says which script touched the record
Why a patch and not a full data/build_evidence.py re-run: that script also needs cached ERA5-Land inputs; every other
field must stay byte-identical so only the rain figure (and the hash) changes. Never signs or sends anything.
Final Run (GPM_3IMERGDF) for 2026 is not in CMR yet (~3.5-month latency); the label says Late Run.
"""
import csv, json, sys
from collections import defaultdict
from pathlib import Path
import calendar

D = Path(__file__).resolve().parents[1]
ROOT = D.parent
EV = ROOT / "avalanche" / "oracle" / "evidence"
SRC = D / "raw" / "imerg_daily_late_v07.csv"
ATT = ROOT / "ceres-web" / "attestations.json"

rows = list(csv.DictReader(SRC.open()))
by = defaultdict(list)
for r in rows:
    by[(r["farm"], int(r["date"][:4] + r["date"][5:7]))].append(r)
anchored = set(json.loads(ATT.read_text()).get("records", {}).keys()) if ATT.exists() else set()

changed = []
for p in sorted(EV.glob("*-*.json")):
    farm, period = p.stem.rsplit("-", 1)
    period = int(period)
    days = by.get((farm, period), [])
    n_month = calendar.monthrange(period // 100, period % 100)[1]
    ev = json.loads(p.read_text())
    ind = ev["indicators"]
    prev = ind.get("precip_mm", {})
    if len(days) != n_month:
        print(f"skip {p.name}: IMERG Late has {len(days)}/{n_month} days")
        continue
    days.sort(key=lambda r: r["date"])
    total = round(sum(float(r["mm_day"]) for r in days), 1)
    cross = prev.get("crossCheck") if str(prev.get("dataset", "")).startswith("GPM_3IMERG") else (
        {"value": prev.get("value"), "dataset": prev.get("dataset"), "scale": prev.get("scale")} if prev.get("dataset") else None)
    ind["precip_mm"] = {
        "value": total,
        "dataset": "GPM_3IMERGDL_v07",
        "product": "GPM IMERG Late Run Daily V07 (near-real-time). Final Run for 2026 not yet in CMR.",
        "run": "Late",
        "scale": "0.1 deg",
        "point": [float(days[0]["grid_lat"]), float(days[0]["grid_lon"])],
        "days": len(days),
        "granules": [r["granule"] for r in days],
        "crossCheck": cross,
    }
    er = ev.get("extensions", {}).get("erosion")
    if isinstance(er, dict):
        if "method" in er:
            er["method"] = er["method"].replace(
                "IMERG was the requested rain source but GES DISC returns 403 EULA Acceptance Failure for this Earthdata account; POWER and ERA5-Land daily used as substitutes and both reported.",
                "Rain-intensity climatology from POWER and ERA5-Land daily (both reported). IMERG access now works (Late Run daily is the primary monthly rain in indicators.precip_mm); an IMERG Final daily climatology for this proxy is future work.")
        if "imerg_status" in er:
            er["imerg_status"] = "accessible: GPM_3IMERGDL v07 Late daily used for indicators.precip_mm; erosion climatology still POWER/ERA5-Land"
    key = f"{farm}/{period}"
    ev["revision"] = 1 if key in anchored else ev.get("revision", 0)
    note = ev.get("_note", "")
    tag = " Monthly rain: GPM IMERG Late daily v07 via data/earthdata/apply_imerg_late.py (CHIRPS v3 kept as crossCheck)."
    if tag not in note:
        ev["_note"] = note + tag
    out = json.dumps(ev, ensure_ascii=False, indent=2)
    if out != p.read_text():
        p.write_text(out)
        changed.append((p.name, prev.get("value"), total, ev["revision"]))

for name, old, new, rev in changed:
    print(f"{name}: precip {old} (CHIRPS) -> {new} mm (IMERG Late), revision {rev}")
print(f"{len(changed)} evidence file(s) updated")
sys.exit(0)
