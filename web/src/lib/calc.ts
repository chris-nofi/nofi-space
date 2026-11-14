import type { Farm, Strategy } from "../types";

export const RATE_PER_M3 = 0.015; // USDC per m³ saved (example)

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

/** mm/day monthly means → m³/ha/year (1 mm on 1 ha = 10 m³) */
export function annualM3PerHa(etMonthly: number[]): number {
  return sum(etMonthly) * 30 * 10;
}

/** mm/day monthly means → mm/year */
export function annualMm(etMonthly: number[]): number {
  return sum(etMonthly) * 30;
}

export function pctVsRef(farm: Farm): number {
  const a = sum(farm.et), b = sum(farm.ref);
  return b > 0 ? Math.round(((a - b) / b) * 100) : 0;
}

export function baseline(farm: Farm): number {
  return farm.strategies.find((s) => s.current)?.water ?? farm.strategies[0].water;
}

/** a strategy earns a reward only if it isn't current and (for m³ mode) saves water */
export function eligible(farm: Farm, s: Strategy): boolean {
  if (s.current) return false;
  if (farm.mode === "m3") return s.water < baseline(farm);
  return true;
}

/** simulated measured season use for a committed strategy */
export function measured(s: Strategy): number {
  return Math.round((s.water * 1.035) / 100) * 100;
}

export function maxReward(farm: Farm, s: Strategy): number {
  if (!eligible(farm, s)) return 0;
  if (farm.mode === "practice") return (farm.rateHa ?? 0) * farm.ha;
  return (baseline(farm) - s.water) * farm.ha * RATE_PER_M3;
}

export function savedM3(farm: Farm, s: Strategy): number {
  return Math.max(0, (baseline(farm) - measured(s)) * farm.ha);
}

export function reward(farm: Farm, s: Strategy): number {
  if (!eligible(farm, s)) return 0;
  if (farm.mode === "practice") return (farm.rateHa ?? 0) * farm.ha * ((farm.compliance ?? 0) / 100);
  return savedM3(farm, s) * RATE_PER_M3;
}

/** deterministic fake hash for the simulated flow */
export function fakeHash(str: string): string {
  let h = 0x811c9dc5, out = "";
  for (let r = 0; r < 8; r++) {
    for (const ch of str + r) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    out += h.toString(16).padStart(8, "0");
  }
  return "0x" + out;
}

export const short = (h: string) => h.slice(0, 10) + "…" + h.slice(-6);

export function fmtNum(n: number, lang: "es" | "en", digits = 0): string {
  return n.toLocaleString(lang === "es" ? "es-PE" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
