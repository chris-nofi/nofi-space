import type { Confidence, L } from "../types";

export interface Source {
  name: string;
  what: L;
  resolution: string;
  access: L;
  confidence: Confidence;
  href: string;
  nasa: boolean;
}

const S: Record<string, Source> = {
  ecostress: {
    name: "ECOSTRESS ET · ECO_L3T_JET", nasa: true, confidence: "field", resolution: "70 m",
    what: { es: "Agua que consume cada parcela (evapotranspiración), desde la Estación Espacial.", en: "Water each field consumes (evapotranspiration), from the Space Station." },
    access: { es: "Earthdata Login (gratis)", en: "Earthdata Login (free)" },
    href: "https://cmr.earthdata.nasa.gov/search/concepts/C4057232489-LPCLOUD.html",
  },
  esi: {
    name: "ECOSTRESS ESI · ECO_L4T_ESI", nasa: true, confidence: "field", resolution: "70 m",
    what: { es: "Índice de estrés: separa una práctica no cumplida de un año seco.", en: "Stress index: separates a skipped practice from a dry year." },
    access: { es: "Earthdata Login", en: "Earthdata Login" },
    href: "https://search.earthdata.nasa.gov/search?q=ECO_L4T_ESI",
  },
  hls: {
    name: "HLS · HLSL30 / HLSS30", nasa: true, confidence: "field", resolution: "30 m · 2–3 días",
    what: { es: "NDVI: confirma que el cultivo está vivo y que la rotación cambió.", en: "NDVI: confirms the crop is alive and the rotation changed." },
    access: { es: "Earthdata Login", en: "Earthdata Login" },
    href: "https://www.earthdata.nasa.gov/data/catalog/lpcloud-hlsl30-2.0",
  },
  power: {
    name: "NASA POWER", nasa: true, confidence: "regional", resolution: "~50 km",
    what: { es: "Temperatura, lluvia, radiación, humedad y viento → evapotranspiración de referencia (FAO-56) y heladas.", en: "Temperature, rain, radiation, humidity, wind → reference ET (FAO-56) and frost." },
    access: { es: "Sin registro", en: "No login" },
    href: "https://power.larc.nasa.gov/docs/services/api/",
  },
  imerg: {
    name: "GPM IMERG Late · GPM_3IMERGDL", nasa: true, confidence: "regional", resolution: "~10 km · diario",
    what: { es: "Lluvia en la cabecera que llena Pasto Grande.", en: "Headwater rain that fills Pasto Grande." },
    access: { es: "Earthdata Login", en: "Earthdata Login" },
    href: "https://search.earthdata.nasa.gov/search?q=GPM_3IMERGDL",
  },
  dswx: {
    name: "OPERA DSWx-HLS", nasa: true, confidence: "field", resolution: "30 m",
    what: { es: "Superficie de agua de Pasto Grande, Vizcachas y qochas.", en: "Water surface of Pasto Grande, Vizcachas and qochas." },
    access: { es: "Earthdata Login", en: "Earthdata Login" },
    href: "https://search.earthdata.nasa.gov/search?q=OPERA_L3_DSWX-HLS",
  },
  grace: {
    name: "GRACE-FO mascons", nasa: true, confidence: "regional", resolution: "cuenca",
    what: { es: "Tendencia del agua almacenada en la región (subterránea y suelo).", en: "Trend of water stored in the region (groundwater and soil)." },
    access: { es: "Earthdata Login", en: "Earthdata Login" },
    href: "https://podaac.jpl.nasa.gov/dataset/TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4",
  },
  smap: {
    name: "SMAP · SPL3SMP_E", nasa: true, confidence: "regional", resolution: "9 km",
    what: { es: "Humedad del suelo en la zona alta.", en: "Highland soil moisture." },
    access: { es: "Earthdata Login", en: "Earthdata Login" },
    href: "https://nsidc.org/data/spl3smp_e/versions/6",
  },
  fao56: {
    name: "FAO-56 crop coefficients", nasa: false, confidence: "transferred", resolution: "—",
    what: { es: "Cuánta agua pide cada cultivo según su etapa.", en: "How much water each crop needs by growth stage." },
    access: { es: "Publicación abierta", en: "Open publication" },
    href: "https://www.fao.org/4/x0490e/x0490e00.htm",
  },
  local: {
    name: "INIA · Agencia Agraria Moquegua · SENAMHI", nasa: false, confidence: "transferred", resolution: "—",
    what: { es: "Variedades, rendimientos, semilla y estaciones en tierra.", en: "Varieties, yields, seed and ground stations." },
    access: { es: "Instituciones locales", en: "Local institutions" },
    href: "https://www.senamhi.gob.pe/",
  },
};

export type SheetKey = "water" | "strategies" | "reward" | "basin";

export const SHEETS: Record<SheetKey, { title: L; note: L; sources: Source[] }> = {
  water: {
    title: { es: "De dónde sale el consumo de agua", en: "Where water use comes from" },
    note: {
      es: "1 mm sobre 1 hectárea = 10 m³. ECOSTRESS mide el agua consumida, no la entregada: las pérdidas en canales no aparecen. Las pasadas son irregulares (órbita de la estación espacial).",
      en: "1 mm over 1 hectare = 10 m³. ECOSTRESS measures water consumed, not delivered: canal losses don't show. Overpasses are irregular (space station orbit).",
    },
    sources: [S.ecostress, S.power, S.hls],
  },
  strategies: {
    title: { es: "Cómo comparamos las estrategias", en: "How strategies are compared" },
    note: {
      es: "Agua = evapotranspiración de referencia (NASA POWER) × coeficientes de cultivo (FAO-56). Suelo e ingreso son puntajes iniciales para revisar con expertos locales.",
      en: "Water = reference ET (NASA POWER) × crop coefficients (FAO-56). Soil and income are starting scores to review with local experts.",
    },
    sources: [S.power, S.fao56, S.local],
  },
  reward: {
    title: { es: "Cómo se verifica la recompensa", en: "How the reward is verified" },
    note: {
      es: "Ahorrar agua abandonando o secando la parcela nunca paga: HLS debe mostrar un cultivo vivo. El oráculo firma la evidencia y el contrato en NØCHAIN paga. Testnet, fondos simulados.",
      en: "Saving water by abandoning or drying a field never pays: HLS must show a living crop. The oracle signs the evidence and the NØCHAIN contract pays. Testnet, simulated funds.",
    },
    sources: [S.ecostress, S.esi, S.hls, S.dswx, S.smap],
  },
  basin: {
    title: { es: "Señales de la cuenca", en: "Basin signals" },
    note: {
      es: "Estas señales describen la región, no una parcela. Sirven de contexto, nunca para pagar.",
      en: "These signals describe the region, not a field. Context only, never used for payouts.",
    },
    sources: [S.dswx, S.imerg, S.grace],
  },
};
