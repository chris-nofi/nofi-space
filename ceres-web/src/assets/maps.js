// Google Maps field map shared by the landing hero and /app (Google Maps JavaScript API, per Chris's choice).
// Hybrid imagery, AdvancedMarkerElement score badges at the CULTIVATION PIXEL (not the bare app point), a 30 m HLS
// pixel footprint (never a field boundary: no surveyed polygons exist), InfoWindow preview → onSelect(id).
// Missing key, bad key, or blocked script → fallback cards, so the page is never blank.
import { band, esc, L } from "./data.js";

const T = {
  es: { view: "Ver parcela", noKey: "El mapa no está configurado.", failed: "No se pudo cargar Google Maps.", cards: "Las tres chacras piloto siguen disponibles:",
        appPoint: "Punto de la app (suelo desnudo, no es el cultivo)", candidate: "Píxel verde candidato (30 m, sin confirmar con el agricultor)",
        footprint: "Huella del píxel HLS 30 m, no es el linde de la chacra", score: "Puntaje", noScore: "sin puntaje", conf: { low: "confianza baja", medium: "confianza media" } },
  en: { view: "View field", noKey: "The map is not configured.", failed: "Google Maps could not load.", cards: "The three pilot fields are still available:",
        appPoint: "App point (bare ground, not the crop)", candidate: "Candidate green pixel (30 m, not confirmed with the farmer)",
        footprint: "HLS 30 m pixel footprint, not the field boundary", score: "Score", noScore: "no score", conf: { low: "low confidence", medium: "medium confidence" } },
};

let loader;
function loadGoogleMaps(key, lang) {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  loader ??= new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), 15000);
    window.__ceresMapsReady = () => { clearTimeout(timer); resolve(); };
    window.gm_authFailure = () => { window.dispatchEvent(new Event("ceres:maps-auth-failure")); };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&libraries=maps,marker&language=${lang}&region=PE&callback=__ceresMapsReady`;
    s.async = true;
    s.onerror = () => { clearTimeout(timer); reject(new Error("script_error")); };
    document.head.appendChild(s);
  });
  return loader;
}

const distM = (a, b) => {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const pixelSquare = ({ lat, lon }, half = 15) => {
  const dLat = half / 111320, dLon = half / (111320 * Math.cos(lat * Math.PI / 180));
  return [{ lat: lat - dLat, lng: lon - dLon }, { lat: lat - dLat, lng: lon + dLon }, { lat: lat + dLat, lng: lon + dLon }, { lat: lat + dLat, lng: lon - dLon }];
};

/**
 * @param {HTMLElement} el   container (.mapbox)
 * @param {object} o
 * @param {Array} o.farms              from /data/farms.json
 * @param {Object} o.scores            id → { score, confidence }
 * @param {string} o.lang              "es" | "en"
 * @param {(id:string)=>void} o.onSelect
 * @param {object} o.cfg               window.CERES_CONFIG
 * @param {()=>object} [o.padding]     fitBounds padding (e.g. leave room for the drawer)
 */
export async function mountFarmMap(el, o) {
  const t = T[o.lang] ?? T.es;
  el.innerHTML = `<div class="gmap" role="region" aria-label="${o.lang === "es" ? "Mapa de chacras de Moquegua" : "Map of Moquegua fields"}"></div>`;
  const api = { select() {}, fit() {}, ok: false };

  const fallback = (why) => {
    el.innerHTML = `<div class="map-fallback" role="region" aria-label="${esc(t.cards)}">
      <p><b>${esc(why === "nokey" ? t.noKey : t.failed)}</b> <span class="muted">${esc(t.cards)}</span></p>
      <div class="fb-cards">${o.farms.map(f => {
        const s = o.scores[f.id];
        return `<button class="fb-card" data-id="${esc(f.id)}"><span class="badge ${band(s?.score)}">${s?.score ?? "—"}</span>
          <span><b>${esc(L(f.place, o.lang))}</b><br><small>${esc(L(f.crop, o.lang))}</small></span></button>`;
      }).join("")}</div></div>`;
    el.querySelectorAll(".fb-card").forEach(b => b.addEventListener("click", () => o.onSelect(b.dataset.id)));
    return api;
  };

  if (!o.cfg.googleMapsApiKey) return fallback("nokey");
  let authFailed = false;
  window.addEventListener("ceres:maps-auth-failure", () => { authFailed = true; fallback("failed"); }, { once: true });
  try { await loadGoogleMaps(o.cfg.googleMapsApiKey, o.lang); }
  catch { return fallback("failed"); }
  if (authFailed) return api;

  const { Map, InfoWindow, Polygon } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  const map = new Map(el.querySelector(".gmap"), {
    mapId: o.cfg.googleMapId || "DEMO_MAP_ID", // Advanced Markers need a Map ID; DEMO_MAP_ID works until a Cloud Map ID is set
    mapTypeId: "hybrid", mapTypeControl: true,
    mapTypeControlOptions: { mapTypeIds: ["hybrid", "satellite", "roadmap", "terrain"] },
    streetViewControl: false, fullscreenControl: true, gestureHandling: "cooperative", tilt: 0,
    center: { lat: -17.2, lng: -70.95 }, zoom: 9,
  });
  const iw = new InfoWindow();
  const markers = {};

  const iwContent = (f) => {
    const s = o.scores[f.id];
    const div = document.createElement("div");
    div.className = "iw";
    div.innerHTML = `<b>${esc(L(f.place, o.lang))}</b><br>${esc(L(f.crop, o.lang))}<br>
      ${t.score}: <b>${s?.score ?? t.noScore}</b>${s?.confidence ? ` · ${esc(t.conf[s.confidence] ?? s.confidence)}` : ""}<br>
      <button class="btn sm" type="button">${esc(t.view)} →</button>`;
    div.querySelector("button").addEventListener("click", () => o.onSelect(f.id));
    return div;
  };

  for (const f of o.farms) {
    const s = o.scores[f.id];
    const content = document.createElement("div");
    content.className = "marker";
    content.innerHTML = `<span class="badge ${band(s?.score)}" aria-hidden="true">${s?.score ?? "—"}</span><span class="tag">${esc(L(f.place, o.lang).split(" · ")[0])}</span>`;
    const m = new AdvancedMarkerElement({ map, position: { lat: f.marker.lat, lng: f.marker.lon }, content, gmpClickable: true,
      title: `${L(f.place, o.lang)} · ${t.score} ${s?.score ?? t.noScore}` });
    m.addListener("click", () => { iw.setContent(iwContent(f)); iw.open({ map, anchor: m }); api.highlight(f.id); });
    markers[f.id] = { m, content };

    if (f.marker.kind === "field_pixel") {
      new Polygon({ map, paths: pixelSquare(f.marker), strokeColor: "#9df5e4", strokeWeight: 2, fillColor: "#9df5e4", fillOpacity: 0.18, clickable: false });
    }
    if (distM(f.marker, f.appPoint) > 25) {
      const dot = document.createElement("div"); dot.className = "apppt";
      new AdvancedMarkerElement({ map, position: { lat: f.appPoint.lat, lng: f.appPoint.lon }, content: dot, title: t.appPoint });
    }
    if (f.candidate) {
      const dot = document.createElement("div"); dot.className = "apppt"; dot.style.background = "#9df5e4";
      new AdvancedMarkerElement({ map, position: { lat: f.candidate.lat, lng: f.candidate.lon }, content: dot, title: t.candidate });
    }
  }

  api.ok = true;
  api.map = map;
  api.highlight = (id) => Object.entries(markers).forEach(([k, v]) => v.content.classList.toggle("sel", k === id));
  api.fit = () => {
    const b = new google.maps.LatLngBounds();
    o.farms.forEach(f => b.extend({ lat: f.marker.lat, lng: f.marker.lon }));
    map.fitBounds(b, o.padding?.() ?? 48);
  };
  api.select = (id, zoom = 15) => {
    const f = o.farms.find(x => x.id === id);
    if (!f) return;
    api.highlight(id);
    map.panTo({ lat: f.marker.lat, lng: f.marker.lon });
    map.setZoom(zoom);
  };
  api.fit();
  return api;
}
