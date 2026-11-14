export type Lang = "es" | "en";
export type L = { es: string; en: string };
export type Confidence = "field" | "regional" | "transferred" | "example";
export type RewardMode = "m3" | "practice";

export interface Strategy {
  id: string;
  name: L;
  current?: boolean;
  recommended?: boolean;
  /** m³/ha/year for irrigated farms, mm/season for rainfed */
  water: number;
  soil: number; // 0–100
  income: 1 | 2 | 3 | 4 | 5;
  mainRisk: L;
  why: L;
  evidence: L;
  gaps: L;
  risks: L;
}

export interface Check {
  id: string;
  label: L;
  detail: L;
  weight: number; // % of compliance for practice mode, 0 = gate
  result: "ok" | "partial" | "fail";
  got?: number;
}

export interface Farm {
  id: string;
  name: string;
  place: L;
  zone: L;
  lat: number;
  lon: number;
  ha: number;
  elevation: number;
  crop: L;
  waterSource: L;
  mode: RewardMode;
  rateHa?: number; // USDC per ha (practice mode)
  compliance?: number; // % (practice mode)
  /** monthly mean ET, mm/day, Jan..Dec */
  et: number[];
  /** comparison line, mm/day: valley median (irrigated) or available rain (rainfed) */
  ref: number[];
  refLabel: L;
  rainYear: number; // mm
  tminCold: number; // °C, coldest month mean minimum
  /** what CERES, the SI voice, says about this farm */
  ceres: L;
  strategies: Strategy[];
  checks: Check[];
  /** where each card's numbers came from */
  confidence: { water: Confidence; ref: Confidence };
}

export interface BasinSignals {
  reservoirPct: number[]; // % of max water surface, last 24 months
  headRainPct: number[]; // Dec–Mar rain vs normal, last 5 seasons
  storageCm: number[]; // GRACE-FO equivalent water thickness anomaly, cm
  confidence: Confidence;
}
