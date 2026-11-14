import type { Farm } from "../types";

const ORACLE = (import.meta.env.VITE_ORACLE_URL as string | undefined)?.replace(/\/$/, "");

export const hasOracle = Boolean(ORACLE);

interface WaterResponse {
  farmId: string;
  etMonthly?: number[];
  refMonthly?: number[];
  rainYearMm?: number;
  tminColdest?: number;
  sources?: { et?: "field" | "regional"; ref?: "field" | "regional" };
}

/**
 * Merge live oracle numbers into a farm. Falls back silently to the example
 * data when the oracle is not configured or not reachable.
 */
export async function loadFarm(farm: Farm): Promise<Farm> {
  if (!ORACLE) return farm;
  try {
    const r = await fetch(`${ORACLE}/v1/farms/${farm.id}/water`);
    if (!r.ok) return farm;
    const w = (await r.json()) as WaterResponse;
    return {
      ...farm,
      et: w.etMonthly?.length === 12 ? w.etMonthly : farm.et,
      ref: w.refMonthly?.length === 12 ? w.refMonthly : farm.ref,
      rainYear: w.rainYearMm ?? farm.rainYear,
      tminCold: w.tminColdest ?? farm.tminCold,
      confidence: {
        water: w.etMonthly?.length === 12 ? (w.sources?.et ?? "field") : farm.confidence.water,
        ref: w.refMonthly?.length === 12 ? (w.sources?.ref ?? "regional") : farm.confidence.ref,
      },
    };
  } catch {
    return farm;
  }
}
