// "¿Se movió tu temporada?": indicadores climáticos por año a partir de NASA POWER.
import { ensureEt0, dayIndex, dateOf, isoDate, doyOf } from './agro.js';

const DAY = 86400000;
const utc = (y, m, d) => Date.UTC(y, m - 1, d);

// Regresión lineal simple
export function linreg(xs, ys) {
  const pts = xs.map((x, i) => [x, ys[i]]).filter(([, y]) => y !== null && Number.isFinite(y));
  const n = pts.length;
  if (n < 3) return { slope: 0, intercept: 0, r2: 0, n };
  const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  const slope = sxx ? sxy / sxx : 0;
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
  return { slope, intercept: my - slope * mx, r2, n };
}

// Inicio de lluvias de la campaña que empieza en sept del año y:
// primer día con ≥25 mm en 3 días y sin racha seca ≥10 días en los 30 siguientes.
export function rainOnset(data, y) {
  const a = dayIndex(data, utc(y, 9, 1)), b = dayIndex(data, utc(y + 1, 1, 31));
  if (a < 0 || b + 35 >= data.n) return null;
  for (let i = a; i <= b; i++) {
    if (data.P[i] + data.P[i + 1] + data.P[i + 2] < 25) continue;
    let run = 0, ok = true;
    for (let j = i + 3; j < i + 33; j++) { run = data.P[j] < 1 ? run + 1 : 0; if (run >= 10) { ok = false; break; } }
    if (ok) return i;
  }
  return null;
}

// Fin de lluvias: primer día desde el 1 de marzo con <10 mm en los 20 días siguientes
export function rainCessation(data, y) {
  const a = dayIndex(data, utc(y + 1, 3, 1)), b = dayIndex(data, utc(y + 1, 6, 30));
  if (a < 0 || b + 20 >= data.n) return null;
  for (let i = a; i <= b; i++) {
    let s = 0; for (let j = i; j < i + 20; j++) s += data.P[j];
    if (s < 10) return i;
  }
  return b;
}

// Racha seca más larga (días seguidos <1 mm) entre dos fechas
export function maxDrySpell(data, a, b) {
  let run = 0, best = 0;
  for (let i = Math.max(0, a); i <= Math.min(b, data.n - 1); i++) { run = data.P[i] < 1 ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}

// Día del año "de campaña" (1 = 1 de agosto) para comparar fechas entre años
export function campaignDay(ms) {
  const d = new Date(ms); const y = d.getUTCMonth() >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return Math.round((ms - utc(y, 8, 1)) / DAY) + 1;
}

export function analyzeClimate(data) {
  ensureEt0(data);
  const y0 = new Date(data.t0).getUTCFullYear();
  const yEnd = new Date(dateOf(data, data.n - 1)).getUTCFullYear();

  // --- Por campaña (sept y → ago y+1) ---
  const seasons = [];
  for (let y = y0; y < yEnd; y++) {
    const on = rainOnset(data, y), off = rainCessation(data, y);
    const a = dayIndex(data, utc(y, 12, 1)), b = dayIndex(data, utc(y + 1, 3, 31));
    const ra = dayIndex(data, utc(y, 9, 1)), rb = dayIndex(data, utc(y + 1, 4, 30));
    let rain = null;
    if (ra >= 0 && rb < data.n) { rain = 0; for (let i = ra; i <= rb; i++) rain += data.P[i]; }
    seasons.push({
      year: y,
      onset: on === null ? null : campaignDay(dateOf(data, on)), onsetDate: on === null ? null : isoDate(dateOf(data, on)),
      cessation: off === null ? null : campaignDay(dateOf(data, off)), cessationDate: off === null ? null : isoDate(dateOf(data, off)),
      length: on !== null && off !== null ? off - on : null,
      drySpell: a >= 0 && b < data.n ? maxDrySpell(data, a, b) : null,
      rain,
    });
  }

  // --- Por año calendario ---
  const years = [];
  for (let y = y0; y <= yEnd; y++) {
    const a = Math.max(0, dayIndex(data, utc(y, 1, 1))), b = Math.min(data.n - 1, dayIndex(data, utc(y, 12, 31)));
    if (b - a < 360) continue; // año incompleto
    let rain = 0, hot = 0, frost = 0, tmax = 0;
    for (let i = a; i <= b; i++) {
      rain += data.P[i]; tmax += data.TX[i];
      if (data.TX[i] >= 35) hot++;
      if (data.TN[i] <= 2) frost++;
    }
    years.push({ year: y, rain, hot, frost, tmax: tmax / (b - a + 1) });
  }

  // --- Climatología mensual ---
  const months = Array.from({ length: 12 }, () => ({ rain: 0, et0: 0, tmax: 0, tmin: 0, gr: 0, hot: 0, frost: 0, days: 0, frostYears: new Set(), dry: 0 }));
  const nYears = new Set();
  for (let i = 0; i < data.n; i++) {
    const d = new Date(dateOf(data, i)); const m = months[d.getUTCMonth()];
    nYears.add(d.getUTCFullYear());
    m.rain += data.P[i]; m.et0 += data.ET0[i]; m.tmax += data.TX[i]; m.tmin += data.TN[i]; m.gr += data.GR[i]; m.days++;
    if (data.TX[i] >= 35) m.hot++;
    if (data.TN[i] <= 2) { m.frost++; m.frostYears.add(d.getUTCFullYear()); }
  }
  const monthly = months.map((m) => {
    const yrs = m.days / 30.4;
    return {
      rain: m.rain / yrs, et0: m.et0 / yrs, tmax: m.tmax / m.days, tmin: m.tmin / m.days, gr: m.gr / m.days,
      hot: m.hot / yrs, frost: m.frost / yrs, frostProb: m.frostYears.size / nYears.size,
    };
  });

  // --- Tendencias ---
  const trend = (arr, key) => {
    const xs = arr.map((s) => s.year), ys = arr.map((s) => s[key]);
    const r = linreg(xs, ys);
    const valid = arr.filter((s) => s[key] !== null);
    const half = Math.floor(valid.length / 2);
    const mean = (v) => v.reduce((s, x) => s + x[key], 0) / Math.max(1, v.length);
    return {
      perDecade: r.slope * 10, r2: r.r2, n: r.n,
      first: mean(valid.slice(0, half)), last: mean(valid.slice(valid.length - half)),
      firstYears: valid.length ? [valid[0].year, valid[half - 1]?.year] : [],
      lastYears: valid.length ? [valid[valid.length - half]?.year, valid[valid.length - 1].year] : [],
    };
  };

  return {
    seasons, years, monthly,
    trends: {
      onset: trend(seasons, 'onset'), cessation: trend(seasons, 'cessation'), length: trend(seasons, 'length'),
      drySpell: trend(seasons, 'drySpell'), seasonRain: trend(seasons, 'rain'),
      hot: trend(years, 'hot'), frost: trend(years, 'frost'), rain: trend(years, 'rain'),
    },
    period: [isoDate(data.t0), isoDate(dateOf(data, data.n - 1))],
  };
}

// Meses vulnerables: sequía (lluvia < ET0/2), calor (≥3 días ≥35 °C), helada (prob ≥20 %)
export function vulnerableMonths(clim) {
  return clim.monthly.map((m) => ({
    dry: m.rain < m.et0 * 0.5,
    heat: m.hot >= 3,
    frost: m.frostProb >= 0.2,
    erosive: m.rain >= 150,
  }));
}

export { doyOf };
