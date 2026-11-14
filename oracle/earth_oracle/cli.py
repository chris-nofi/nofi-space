"""python -m earth_oracle.cli <power|ecostress|hls|dswx|plots> [--farm id|all]"""
from __future__ import annotations

import argparse
import json

from .config import load_farms
from .evidence import plot_hash


def main() -> None:
    ap = argparse.ArgumentParser(prog="earth_oracle")
    ap.add_argument("cmd", choices=["power", "ecostress", "hls", "dswx", "plots"])
    ap.add_argument("--farm", default="all")
    args = ap.parse_args()
    farms = load_farms()
    targets = list(farms.values()) if args.farm == "all" else [farms[args.farm]]

    if args.cmd == "plots":
        for f in targets:
            print(f.id, plot_hash(f))
        return
    if args.cmd == "dswx":
        from .dswx import extract

        print(json.dumps(extract(), indent=2)[:2000])
        return
    for f in targets:
        if args.cmd == "power":
            from .power import pull_and_cache

            s = pull_and_cache(f)
            print(f"{f.id}: rain {s['rainYearMm']} mm/yr · coldest Tmin {s['tminColdest']} °C · ET0 {s['et0Monthly']}")
        elif args.cmd == "ecostress":
            from .ecostress import extract

            r = extract(f)
            print(f"{f.id}: {len(r['overpasses'])} overpasses · {r['monthsWithData']} months · {r['etMonthly']}")
        elif args.cmd == "hls":
            from .hls import extract

            r = extract(f)
            print(f"{f.id}: {len(r['series'])} NDVI points · cropAlive={r['cropAlive']}")


if __name__ == "__main__":
    main()
