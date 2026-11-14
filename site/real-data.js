/* CERES Ventures — replaces the dashboard's illustrative numbers with real data at load time.
   Sources (no number is typed by hand here):
   - window.CERES_NASA_DATA  (ceres-nasa-data.js, Kepler's package: NASA POWER, MODIS, ECOSTRESS, CHIRPS, ERA5, SRTM)
   - window.AGUA_SI_FIXTURES / AGUA_SI_CLIMATE (si-data.js, the SI engine run on those inputs)
   app.js calls window.CeresRealData.apply(DB) right after DB is defined. */
(() => {
  "use strict";
  const NASA = window.CERES_NASA_DATA || null;
  const FX = window.AGUA_SI_FIXTURES || {};
  const CL = window.AGUA_SI_CLIMATE || {};
  const DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const r2 = (v) => Math.round(v * 100) / 100;
  const fmt = (n, lang, d = 0) => Number(n).toLocaleString(lang === "es" ? "es-PE" : "en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const both = (fn) => ({ es: fn("es"), en: fn("en") });
  const MES = { es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"], en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] };

  const CITE = {
    power: { es: "Clima: NASA POWER Daily v2 (AG), 0,5°×0,625°, 1981–2026 · ET₀ FAO-56 Penman-Monteith (Allen et al. 1998)", en: "Climate: NASA POWER Daily v2 (AG), 0.5°×0.625°, 1981–2026 · ET₀ FAO-56 Penman-Monteith (Allen et al. 1998)" },
    kc: { es: "Kc: FAO-56 Tabla 12 · eficiencias: Brouwer et al. 1989 (FAO, gravedad 60 %, goteo 90 %)", en: "Kc: FAO-56 Table 12 · efficiencies: Brouwer et al. 1989 (FAO, surface 60 %, drip 90 %)" },
    chirps: { es: "Lluvia: CHIRPS v3.0 mensual, 0,05°, UCSB CHC (sustituye a GPM IMERG); rango con NASA POWER y ERA5 (Copernicus, vía Open-Meteo)", en: "Rain: CHIRPS v3.0 monthly, 0.05°, UCSB CHC (stands in for GPM IMERG); range with NASA POWER and ERA5 (Copernicus, via Open-Meteo)" },
    ecostress: { es: "ECOSTRESS L3T JET v002 ET diaria, 70 m, NASA JPL / LP DAAC · doi:10.5067/ECOSTRESS/ECO_L3T_JET.002", en: "ECOSTRESS L3T JET v002 daily ET, 70 m, NASA JPL / LP DAAC · doi:10.5067/ECOSTRESS/ECO_L3T_JET.002" },
    modis: { es: "MOD13Q1 v061 NDVI, 250 m, 16 días (Didan 2021) · doi:10.5067/MODIS/MOD13Q1.061", en: "MOD13Q1 v061 NDVI, 250 m, 16-day (Didan 2021) · doi:10.5067/MODIS/MOD13Q1.061" },
    si: { es: "Voz y respuestas de CERES generadas por SI", en: "CERES voice and answers are SI-generated" },
  };

  function ecoSentence(id, n, cl, lang) {
    const e = (cl && cl.ecostress) || {};
    const v = (e.etMonthly || []).filter((x) => x != null);
    if (!v.length) return null;
    const etc = (n.crop_water.etc_mm_monthly || []).map((x, k) => x / DAYS[k]).filter((x) => x > 0);
    const lo = Math.min(...v), hi = Math.max(...v);
    const cropLo = etc.length ? Math.min(...etc) : null, cropHi = etc.length ? Math.max(...etc) : null;
    const yrs = `${String(e.first || "").slice(0, 4)}–${String(e.last || "").slice(0, 4)}`;
    if (lang === "es") {
      let s = `ECOSTRESS (70 m, ${e.totalValid} pasadas válidas ${yrs}) en el punto del mapa: ${fmt(lo, lang, 1)}–${fmt(hi, lang, 1)} mm/día según el mes.`;
      if (e.representative === false && cropHi) s += ` Un cultivo así regado usaría ${fmt(cropLo, lang, 1)}–${fmt(cropHi, lang, 1)} mm/día (FAO-56): el punto probablemente no está sobre la chacra.`;
      return s;
    }
    let s = `ECOSTRESS (70 m, ${e.totalValid} valid overpasses ${yrs}) at the map point: ${fmt(lo, lang, 1)}–${fmt(hi, lang, 1)} mm/day by month.`;
    if (e.representative === false && cropHi) s += ` A fully irrigated crop like this would use ${fmt(cropLo, lang, 1)}–${fmt(cropHi, lang, 1)} mm/day (FAO-56): the point is probably not on the field.`;
    return s;
  }

  function ndviSentence(n, cl, lang) {
    const m = (cl && cl.ndvi && cl.ndvi.monthly) || n.ndvi_modis.ndvi_monthly_mean;
    const bare = m.filter((v) => v < 0.25).length;
    const lo = Math.min(...m), hi = Math.max(...m);
    return lang === "es"
      ? `MODIS 250 m (2001–2026): ${bare} meses al año con NDVI medio < 0,25 en este píxel (rango ${fmt(lo, lang, 2)}–${fmt(hi, lang, 2)}); el píxel es más grande que la parcela.`
      : `MODIS 250 m (2001–2026): ${bare} months a year with mean NDVI < 0.25 at this pixel (range ${fmt(lo, lang, 2)}–${fmt(hi, lang, 2)}); the pixel is larger than the field.`;
  }

  function coldestTmin(id, n, cl) {
    if (cl && cl.tminMonthly) return Math.min(...cl.tminMonthly);
    return Math.min(...n.climate.climatology_2001_2025.tmin_monthly);
  }

  function apply(DB) {
    if (!NASA || !NASA.farms) return false;
    for (const f of DB.FARMS) {
      const n = NASA.farms[f.id];
      if (!n) continue;
      const fx = FX[f.id], cl = CL[f.id];
      // monthly series for the chart: crop ET (FAO-56 Kc × real ET0) vs reference ET0
      f.et = n.crop_water.etc_mm_monthly.map((v, k) => r2(v / DAYS[k]));
      f.ref = n.et0.power_raw.et0_pm_monthly_mm_day.slice();
      f.etLabel = { es: `ETc ${n.crop_water.crop === "olive" ? "del olivo" : "del cultivo"} (FAO-56, modelada)`, en: `${n.crop_water.crop === "olive" ? "Olive" : "Crop"} ETc (FAO-56, modeled)` };
      f.refLabel = { es: "ET₀ de referencia (NASA POWER, FAO-56)", en: "Reference ET₀ (NASA POWER, FAO-56)" };
      f.annualEtcMm = n.crop_water.etc_mm_yr;
      f.rainYear = Math.round(n.climate.climatology_1991_2020.chirps_mm_yr);
      f.rainRange = (fx && fx.dataQuality && fx.dataQuality.rainRangeMmYr) || null;
      f.rainMonthly = cl ? cl.rainMonthlyMm : null;
      f.tminCold = r2(coldestTmin(f.id, n, cl));
      f.tempRule = cl && cl.provenance ? cl.provenance.temperature : null;
      f.confidence = { ...(f.confidence || {}), water: "modeled", ref: "measured" };
      f.real = { point: n.point, ecostress: cl ? cl.ecostress : null, ndvi: cl ? cl.ndvi : null, generated: NASA.generated };
      // strategies: water, soil and the recommendation come from the SI engine on these inputs
      if (fx) {
        const eng = Object.fromEntries(fx.compare.strategies.map((s) => [s.id, s]));
        for (const s of f.strategies) {
          const e = eng[s.id];
          if (!e) continue;
          s.water = Math.round(e.water.expected != null ? e.water.expected : e.water.p50);
          s.soil = Math.round(e.soil);
          s.recommended = Boolean(e.recommended);
        }
        if (fx.voice) f.ceres = { es: fx.voice.es.text, en: fx.voice.en.text };
      }
      // replace observation claims with sentences built from the data
      const cur = f.strategies.find((s) => s.current);
      const eco = both((lang) => ecoSentence(f.id, n, cl, lang));
      if (cur) {
        if (f.id === "carumas") cur.evidence = both((lang) => ndviSentence(n, cl, lang));
        else if (eco.es) cur.evidence = eco;
      }
      f.citations = CITE;
    }
    DB.REAL = { loaded: true, generated: NASA.generated, sources: NASA.sources, cite: CITE };
    return true;
  }

  window.CeresRealData = { apply, cite: CITE, months: MES };
})();
