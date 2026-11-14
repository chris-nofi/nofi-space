from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
except Exception:  # dotenv is optional
    pass

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CACHE = Path(os.getenv("ORACLE_CACHE_DIR", DATA / "cache"))
if not CACHE.is_absolute():
    CACHE = ROOT.parent / CACHE
CACHE.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class Farm:
    id: str
    name: str
    lat: float
    lon: float
    elevation_m: float
    area_ha: float
    mode: str  # "m3" | "practice"
    polygon: list
    salt: str
    raw: dict

    def bbox(self, pad_deg: float = 0.01) -> tuple[float, float, float, float]:
        """(west, south, east, north) around the farm point."""
        return (self.lon - pad_deg, self.lat - pad_deg, self.lon + pad_deg, self.lat + pad_deg)


def load_farms() -> dict[str, Farm]:
    doc = json.loads((DATA / "farms.json").read_text(encoding="utf-8"))
    out: dict[str, Farm] = {}
    for f in doc["farms"]:
        out[f["id"]] = Farm(
            id=f["id"], name=f["name"], lat=f["lat"], lon=f["lon"], elevation_m=f["elevation_m"],
            area_ha=f["area_ha"], mode=f["mode"], polygon=f["polygon"], salt=f["salt"], raw=f,
        )
    return out


def load_doc() -> dict:
    return json.loads((DATA / "farms.json").read_text(encoding="utf-8"))


def env(name: str, default: str | None = None) -> str | None:
    v = os.getenv(name)
    return v if v not in (None, "") else default
