// Descarga y normaliza datos diarios de NASA POWER (comunidad AG).
// https://power.larc.nasa.gov/docs/services/api/temporal/daily/
import { parseDate } from './agro.js';

export const PARAMS = {
  P: 'PRECTOTCORR',      // lluvia corregida (mm/día) — MERRA-2 / GPM IMERG
  TX: 'T2M_MAX',          // temperatura máxima a 2 m (°C)
  TN: 'T2M_MIN',          // temperatura mínima a 2 m (°C)
  GR: 'GWETROOT',         // humedad del suelo en zona radicular (0-1)
  GT: 'GWETTOP',          // humedad del suelo superficial (0-1)
  SW: 'ALLSKY_SFC_SW_DWN', // radiación solar (MJ/m²/día)
  RH: 'RH2M',             // humedad relativa (%)
};
export const START = '2001-01-01';
const API = 'https://power.larc.nasa.gov/api/temporal/daily/point';

export function powerUrl(lat, lon, start = START, end = defaultEnd()) {
  const q = new URLSearchParams({
    parameters: Object.values(PARAMS).join(','), community: 'AG',
    latitude: lat.toFixed(3), longitude: lon.toFixed(3),
    start: start.replaceAll('-', ''), end: end.replaceAll('-', ''), format: 'JSON',
  });
  return `${API}?${q}`;
}

export function defaultEnd(now = Date.now()) {
  return new Date(now - 10 * 86400000).toISOString().slice(0, 10);
}

// Convierte la respuesta JSON de POWER al formato compacto {lat, lon, start, P:[], TX:[]…}
export function fromPowerJson(json, lat, lon) {
  const par = json.properties.parameter;
  const fill = json.header?.fill_value ?? -999;
  const dates = Object.keys(par[PARAMS.TX]).sort();
  const out = { lat, lon, start: `${dates[0].slice(0, 4)}-${dates[0].slice(4, 6)}-${dates[0].slice(6, 8)}` };
  for (const [k, name] of Object.entries(PARAMS)) {
    out[k] = dates.map((d) => { const v = par[name]?.[d]; return v === undefined || v === fill ? null : v; });
  }
  // Recorta días finales sin datos (latencia de POWER)
  let last = dates.length - 1;
  while (last > 0 && (out.TX[last] === null || out.P[last] === null)) last--;
  for (const k of Object.keys(PARAMS)) out[k] = out[k].slice(0, last + 1);
  return out;
}

// Rellena huecos y arma el objeto de trabajo
export function normalize(compact, source = 'api') {
  const n = compact.TX.length;
  const data = { lat: compact.lat, lon: compact.lon, start: compact.start, t0: parseDate(compact.start), n, source };
  for (const k of Object.keys(PARAMS)) {
    const src = compact[k] || [];
    const arr = new Float64Array(n);
    let prev = k === 'P' ? 0 : (src.find((v) => v !== null && v !== undefined) ?? 0);
    for (let i = 0; i < n; i++) {
      const v = src[i];
      if (v === null || v === undefined || v <= -990) arr[i] = k === 'P' ? 0 : prev;
      else { arr[i] = v; prev = v; }
    }
    data[k] = arr;
  }
  return data;
}

const round = (a) => a.map((v) => (v === null ? null : Math.round(v * 100) / 100));
export function compactOf(data) {
  const c = { lat: data.lat, lon: data.lon, start: data.start };
  for (const k of Object.keys(PARAMS)) c[k] = round(Array.from(data[k]));
  return c;
}

const cacheKey = (lat, lon) => `surco:power:v1:${lat.toFixed(2)},${lon.toFixed(2)}`;
function cacheGet(lat, lon) {
  try { const s = localStorage.getItem(cacheKey(lat, lon)); return s ? JSON.parse(s) : null; } catch { return null; }
}
function cacheSet(lat, lon, compact) {
  try { localStorage.setItem(cacheKey(lat, lon), JSON.stringify(compact)); } catch { /* lleno o bloqueado */ }
}

// Carga datos: caché → API → datos demo (si se da demoUrl)
export async function loadPower(lat, lon, { demoUrl, demoData, fetchImpl = fetch, onStatus = () => {} } = {}) {
  const cached = cacheGet(lat, lon);
  if (cached) { onStatus('cache'); return normalize(cached, 'cache'); }
  try {
    onStatus('api');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    const res = await fetchImpl(powerUrl(lat, lon), { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`POWER HTTP ${res.status}`);
    const compact = fromPowerJson(await res.json(), lat, lon);
    cacheSet(lat, lon, compact);
    return normalize(compact, 'api');
  } catch (err) {
    if (demoData) { onStatus('demo'); return normalize(demoData, 'demo'); }
    if (!demoUrl) throw err;
    onStatus('demo');
    const res = await fetchImpl(demoUrl);
    return normalize(await res.json(), 'demo');
  }
}
