"""FAO-56 Penman-Monteith reference evapotranspiration (monthly), Allen et al. 1998.

All functions are pure so they can be unit-tested offline.
"""
from __future__ import annotations

import math

SIGMA = 4.903e-9  # MJ K^-4 m^-2 day^-1
MID_MONTH_DOY = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349]


def sat_vp(t: float) -> float:
    """e°(T), kPa (eq. 11)."""
    return 0.6108 * math.exp(17.27 * t / (t + 237.3))


def slope_vp(t: float) -> float:
    """Δ, kPa/°C (eq. 13)."""
    return 4098 * sat_vp(t) / (t + 237.3) ** 2


def psychrometric(elev_m: float) -> float:
    """γ, kPa/°C (eqs. 7–8)."""
    p = 101.3 * ((293 - 0.0065 * elev_m) / 293) ** 5.26
    return 0.000665 * p


def extraterrestrial_radiation(lat_deg: float, doy: int) -> float:
    """Ra, MJ m^-2 day^-1 (eqs. 21–25)."""
    phi = math.radians(lat_deg)
    dr = 1 + 0.033 * math.cos(2 * math.pi * doy / 365)
    delta = 0.409 * math.sin(2 * math.pi * doy / 365 - 1.39)
    ws = math.acos(max(-1.0, min(1.0, -math.tan(phi) * math.tan(delta))))
    return (24 * 60 / math.pi) * 0.0820 * dr * (
        ws * math.sin(phi) * math.sin(delta) + math.cos(phi) * math.cos(delta) * math.sin(ws)
    )


def et0_pm(
    tmax: float,
    tmin: float,
    rs_mj: float,
    u2: float,
    lat_deg: float,
    elev_m: float,
    doy: int,
    rh_mean: float | None = None,
    ea: float | None = None,
    g: float = 0.0,
) -> float:
    """Daily-equivalent ET0 (mm/day) from monthly means.

    Provide either `ea` (kPa) or `rh_mean` (%). `g` is soil heat flux (MJ m^-2 day^-1),
    monthly approximation G = 0.14 (T_month - T_prev_month) (eq. 44).
    """
    t = (tmax + tmin) / 2
    es = (sat_vp(tmax) + sat_vp(tmin)) / 2
    if ea is None:
        if rh_mean is None:
            raise ValueError("give ea or rh_mean")
        ea = rh_mean / 100 * es
    delta = slope_vp(t)
    gamma = psychrometric(elev_m)
    ra = extraterrestrial_radiation(lat_deg, doy)
    rso = (0.75 + 2e-5 * elev_m) * ra
    rns = 0.77 * rs_mj
    ratio = min(1.0, rs_mj / rso) if rso > 0 else 1.0
    rnl = SIGMA * (((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2) * (0.34 - 0.14 * math.sqrt(ea)) * (1.35 * ratio - 0.35)
    rn = rns - rnl
    num = 0.408 * delta * (rn - g) + gamma * (900 / (t + 273)) * u2 * (es - ea)
    den = delta + gamma * (1 + 0.34 * u2)
    return max(0.0, num / den)


def monthly_et0(
    tmax: list[float], tmin: list[float], rs_mj: list[float], u2: list[float], rh: list[float], lat: float, elev: float
) -> list[float]:
    """12 monthly ET0 values (mm/day), with G from neighbouring months."""
    tmean = [(a + b) / 2 for a, b in zip(tmax, tmin)]
    out = []
    for m in range(12):
        g = 0.14 * (tmean[m] - tmean[m - 1])
        out.append(round(et0_pm(tmax[m], tmin[m], rs_mj[m], u2[m], lat, elev, MID_MONTH_DOY[m], rh_mean=rh[m], g=g), 2))
    return out
