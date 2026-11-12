// Motor agronómico: ET0 (Hargreaves, FAO-56), Kc por etapas, balance hídrico diario
// del suelo (FAO-56 cap. 8) y respuesta del rendimiento al agua (FAO-33).
// Todo funciona sobre la serie diaria de NASA POWER (ver power.js).

const DAY = 86400000;

export function parseDate(s) { // 'YYYY-MM-DD' → ms UTC
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
export function isoDate(ms) { return new Date(ms).toISOString().slice(0, 10); }
export function dayIndex(data, ms) { return Math.round((ms - data.t0) / DAY); }
export function dateOf(data, i) { return data.t0 + i * DAY; }
export function doyOf(ms) {
  const d = new Date(ms); return Math.floor((ms - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY) + 1;
}
export function addDays(ms, n) { return ms + n * DAY; }
export function mmdd(year, s) { const [m, d] = s.split('-').map(Number); return Date.UTC(year, m - 1, d); }

// Radiación extraterrestre Ra (MJ m-2 día-1), FAO-56 ec. 21
export function extraterrestrialRad(latDeg, doy) {
  const phi = latDeg * Math.PI / 180;
  const dr = 1 + 0.033 * Math.cos(2 * Math.PI * doy / 365);
  const delta = 0.409 * Math.sin(2 * Math.PI * doy / 365 - 1.39);
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta))));
  return (24 * 60 / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
}

// ET0 Hargreaves-Samani (mm/día)
export function et0Hargreaves(tmax, tmin, ra) {
  const tmean = (tmax + tmin) / 2;
  return Math.max(0, 0.0023 * (tmean + 17.8) * Math.sqrt(Math.max(0, tmax - tmin)) * ra * 0.408);
}

// ET0 Hargreaves (1975) con radiación solar medida (Rs, MJ m-2 día-1)
export function et0HargreavesRs(tmax, tmin, rs) {
  return Math.max(0, 0.0135 * ((tmax + tmin) / 2 + 17.8) * rs * 0.408);
}

// Precalcula ET0 para toda la serie (se guarda en data.ET0).
// Usa la radiación solar de NASA POWER si existe; si no, Hargreaves-Samani con Ra.
export function ensureEt0(data) {
  if (data.ET0) return data.ET0;
  const out = new Float64Array(data.n);
  for (let i = 0; i < data.n; i++) {
    const rs = data.SW?.[i];
    if (rs > 0) out[i] = et0HargreavesRs(data.TX[i], data.TN[i], rs);
    else out[i] = et0Hargreaves(data.TX[i], data.TN[i], extraterrestrialRad(data.lat, doyOf(dateOf(data, i))));
  }
  data.ET0 = out;
  return out;
}

// Kc del día `d` (0..len-1) de un ciclo de `len` días
export function kcAt(crop, d, len) {
  const [ini, mid, end] = crop.kc;
  const [a, b, c] = crop.stages;
  const L1 = a * len, L2 = (a + b) * len, L3 = (a + b + c) * len;
  if (d < L1) return ini;
  if (d < L2) return ini + (mid - ini) * (d - L1) / (L2 - L1);
  if (d < L3) return mid;
  return mid + (end - mid) * Math.min(1, (d - L3) / Math.max(1, len - L3));
}

export function stageOf(crop, d, len) {
  const [a, b, c] = crop.stages;
  if (d < a * len) return 0;
  if (d < (a + b) * len) return 1;
  if (d < (a + b + c) * len) return 2;
  return 3;
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Agua inicial a partir de la humedad de zona radicular de NASA (GWETROOT, fracción de saturación)
export function initialAvailableFrac(gwetroot) {
  return clamp((gwetroot - 0.35) / (0.75 - 0.35), 0, 1);
}

// ¿Se puede sembrar el día i? (suelo superficial húmedo o lluvia reciente)
export function canSow(data, i, season) {
  const thr = season === 'verano' ? 0.6 : 0.5;
  const rainNeed = season === 'verano' ? 20 : 15;
  const r3 = (data.P[i] || 0) + (data.P[i - 1] || 0) + (data.P[i - 2] || 0);
  return data.GT[i] >= thr || r3 >= rainNeed;
}

/**
 * Simula un cultivo en un año real.
 * opts: { crop, sowIdx (fecha objetivo, índice de día), awc (mm/m), irrigated, window (días de tolerancia para sembrar), len (días, para coberturas) }
 * Devuelve rendimiento relativo (0..1) y diagnóstico.
 */
export function simulateCrop(data, opts) {
  const { crop, awc = 150, irrigated = false } = opts;
  const ET0 = ensureEt0(data);
  const len = opts.len || crop.days;
  const isCover = crop.season === 'cobertura';
  const window = opts.window ?? (isCover ? 10 : 25);

  // 1) Fecha real de siembra
  let sow = opts.sowIdx, delay = 0, drySown = false;
  if (!irrigated) {
    while (delay < window && !canSow(data, sow + delay, crop.season === 'cobertura' ? 'invierno' : crop.season)) delay++;
    if (delay >= window) drySown = true;
    sow += delay;
  }
  const end = Math.min(data.n - 1, sow + len);
  if (sow < 1 || sow + len > data.n - 1) return null; // fuera de la serie

  // 2) Balance hídrico diario
  const TAW = awc * crop.root;
  const RAW = crop.p * TAW;
  let Dr = TAW * (1 - initialAvailableFrac(data.GR[sow]));
  let sumEtc = 0, sumEta = 0, rain = 0, irr = 0, stressDays = 0, heatDays = 0, frostDays = 0, frostMid = 0;
  const midEtc = [0, 0, 0, 0], midEta = [0, 0, 0, 0];
  for (let d = 0; d < end - sow; d++) {
    const i = sow + d;
    const kc = kcAt(crop, d, len);
    const etc = kc * ET0[i];
    const p = data.P[i] || 0;
    const peff = p - Math.max(0, p - 50) * 0.5; // escorrentía en tormentas fuertes
    rain += p;
    let ks = Dr > RAW ? clamp((TAW - Dr) / ((1 - crop.p) * TAW), 0, 1) : 1;
    if (irrigated && Dr > RAW * 0.9) { irr += Dr; Dr = 0; ks = 1; }
    const eta = ks * etc;
    if (ks < 0.7) stressDays++;
    Dr = clamp(Dr - peff + eta, 0, TAW);
    sumEtc += etc; sumEta += eta;
    const st = stageOf(crop, d, len);
    midEtc[st] += etc; midEta[st] += eta;
    if (st === 2 && data.TX[i] >= crop.heat) heatDays++;
    if (d > 10 && data.TN[i] <= crop.frost) { frostDays++; if (st === 2) frostMid++; }
  }

  // 3) Rendimiento relativo
  const waterRel = sumEtc > 0 ? sumEta / sumEtc : 1;
  // La floración (etapa media) pesa más: mezcla 60 % ciclo completo + 40 % etapa media
  const midRel = midEtc[2] > 0 ? midEta[2] / midEtc[2] : 1;
  const effRel = 0.6 * waterRel + 0.4 * midRel;
  let y = isCover ? 1 : clamp(1 - crop.ky * (1 - effRel), 0, 1);
  const heatF = clamp(1 - 0.02 * heatDays, 0.6, 1);
  const frostF = clamp(1 - 0.06 * (frostDays - frostMid) - 0.15 * frostMid, 0.2, 1);
  const lateF = clamp(1 - 0.003 * Math.max(0, delay - 10), 0.85, 1);
  if (!isCover) y *= heatF * frostF * lateF;

  return {
    sowIdx: sow, harvestIdx: end, delay, drySown, len,
    etc: sumEtc, eta: sumEta, rain, irr, waterRel, midRel,
    stressDays, heatDays, frostDays, frostMid,
    yieldRel: y,
  };
}

// Cobertura del suelo por rastrojo `t` días después de la cosecha
export function residueCover(crop, yieldRel, t) {
  const c0 = crop.cover0 * (crop.yield ? clamp(0.4 + 0.6 * yieldRel, 0.3, 1) : 1);
  return c0 * Math.exp(-crop.decay * t);
}
