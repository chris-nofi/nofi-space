#!/usr/bin/env python3
"""Submit (and optionally poll/download) the AppEEARS point request in appeears_request.json.

Credentials (never stored, never printed), first match wins:
  APPEEARS_TOKEN                          - an AppEEARS bearer token you already have
  EARTHDATA_USERNAME + EARTHDATA_PASSWORD - POST /login with HTTP basic auth (AppEEARS docs)
  EARTHDATA_TOKEN                         - Earthdata Login user token tried as bearer (may be rejected
                                            by AppEEARS; if so use username/password)
Usage:
  python appeears_submit.py --check          # validate product/layer names against the live API (no login)
  python appeears_submit.py --submit         # submit, print task_id, save to appeears_task.json
  python appeears_submit.py --poll --download  # wait for task and download CSVs to ../raw/appeears/
API docs: https://appeears.earthdatacloud.nasa.gov/api/
"""
import argparse, json, os, sys, time
from pathlib import Path
import requests

API = "https://appeears.earthdatacloud.nasa.gov/api"
HERE = Path(__file__).resolve().parent
REQ = json.loads((HERE / "appeears_request.json").read_text())
TASKF = HERE / "appeears_task.json"


def token():
    if os.environ.get("APPEEARS_TOKEN"):
        return os.environ["APPEEARS_TOKEN"]
    u, p = os.environ.get("EARTHDATA_USERNAME"), os.environ.get("EARTHDATA_PASSWORD")
    if u and p:
        r = requests.post(f"{API}/login", auth=(u, p), timeout=60); r.raise_for_status()
        return r.json()["token"]
    if os.environ.get("EARTHDATA_TOKEN"):
        return os.environ["EARTHDATA_TOKEN"]
    sys.exit("No credentials: set APPEEARS_TOKEN, or EARTHDATA_USERNAME/EARTHDATA_PASSWORD, or EARTHDATA_TOKEN")


def check():
    ok = True
    by_prod = {}
    for l in REQ["params"]["layers"]:
        by_prod.setdefault(l["product"], []).append(l["layer"])
    for prod, layers in by_prod.items():
        r = requests.get(f"{API}/product/{prod}", timeout=60)
        if r.status_code != 200:
            print(f"[x] product {prod}: HTTP {r.status_code}"); ok = False; continue
        avail = set(r.json().keys())
        for l in layers:
            print(("[ok]" if l in avail else "[x] ") + f" {prod} / {l}" + ("" if l in avail else f"  (available: {sorted(avail)[:12]}...)"))
            ok &= l in avail
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true"); ap.add_argument("--submit", action="store_true")
    ap.add_argument("--poll", action="store_true"); ap.add_argument("--download", action="store_true")
    a = ap.parse_args()
    if a.check or a.submit:
        if not check():
            sys.exit("Fix layer names in appeears_request.json before submitting.")
    if a.submit:
        h = {"Authorization": f"Bearer {token()}"}
        r = requests.post(f"{API}/task", json=REQ, headers=h, timeout=120); r.raise_for_status()
        TASKF.write_text(json.dumps(r.json())); print("submitted:", r.json())
    if a.poll or a.download:
        h = {"Authorization": f"Bearer {token()}"}
        tid = json.loads(TASKF.read_text())["task_id"]
        while True:
            st = requests.get(f"{API}/task/{tid}", headers=h, timeout=60).json()
            print(time.strftime("%H:%M:%S"), st.get("status")); 
            if st.get("status") == "done": break
            if st.get("status") in ("error", "expired"): sys.exit(st)
            time.sleep(60)
        if a.download:
            out = HERE.parent / "raw" / "appeears"; out.mkdir(parents=True, exist_ok=True)
            for f in requests.get(f"{API}/bundle/{tid}", headers=h, timeout=60).json()["files"]:
                r = requests.get(f"{API}/bundle/{tid}/{f['file_id']}", headers=h, timeout=600, allow_redirects=True)
                (out / Path(f["file_name"]).name).write_bytes(r.content); print("saved", f["file_name"])


if __name__ == "__main__":
    main()
