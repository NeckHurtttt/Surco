// Motor de rotaciones: arma el calendario, lo simula en cada campaña real (2001→hoy),
// mide suelo (cobertura, rastrojo, nitrógeno, ciclos de plagas) y puntúa.
import { CROPS } from '../data/crops.js';
import { simulateCrop, dayIndex, residueCover, kcAt } from './agro.js';

const DAY = 86400000;
const CYCLE = 365;
const TURN = 5; // días mínimos entre cosecha y siembra

// Desfase (días desde el 1 de agosto de la campaña 0) de una fecha 'MM-DD'
export function offsetOf(mmdd, year = 0) {
  const [m, d] = mmdd.split('-').map(Number);
  const y = m >= 8 ? 2001 : 2002; // año base no bisiesto
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2001, 7, 1)) / DAY) + year * CYCLE;
}
export function mmddOf(offset) {
  const ms = Date.UTC(2001, 7, 1) + ((offset % CYCLE) + CYCLE) % CYCLE * DAY;
  return new Date(ms).toISOString().slice(5, 10);
}

/**
 * Calendario nominal de una rotación.
 * rot = { years, steps:[{crop, sow?:'MM-DD', year?:0|1}] }
 * Devuelve { L, items:[{crop, key, start, end, len, cover}], issues:[] }
 */
export function plan(rot) {
  const L = (rot.years || 1) * CYCLE;
  const issues = [];
  const cash = rot.steps.filter((s) => s.sow).map((s) => {
    const c = CROPS[s.crop];
    const start = offsetOf(s.sow, s.year || 0);
    return { key: s.crop, crop: c, start, end: start + c.days, len: c.days, cover: false };
  }).sort((a, b) => a.start - b.start);
  // Choques entre cultivos de renta (incluye el salto al siguiente ciclo)
  for (let i = 0; i < cash.length; i++) {
    const a = cash[i], b = cash[(i + 1) % cash.length];
    const bStart = i + 1 < cash.length ? b.start : b.start + L;
    if (cash.length > 1 && a.end + TURN > bStart) issues.push({ type: 'overlap', a: a.key, b: b.key, days: a.end + TURN - bStart });
  }
  // Coberturas: llenan el hueco después del cultivo que tienen antes en la lista de pasos
  const items = [...cash];
  rot.steps.forEach((s, idx) => {
    if (s.sow) return;
    const c = CROPS[s.crop];
    // cultivo de renta anterior en la lista de pasos
    let prev = null;
    for (let j = idx - 1; j >= -rot.steps.length; j--) {
      const st = rot.steps[(j + rot.steps.length) % rot.steps.length];
      if (st.sow) { prev = cash.find((x) => x.key === st.crop && x.start === offsetOf(st.sow, st.year || 0)); break; }
    }
    if (!prev) { issues.push({ type: 'cover_alone', a: s.crop }); return; }
    const pi = cash.indexOf(prev);
    const next = cash[(pi + 1) % cash.length];
    const nextStart = pi + 1 < cash.length ? next.start : next.start + L;
    const start = prev.end + TURN;
    let end = nextStart - 7;
    if (end - start > c.maxDays) end = start + c.maxDays;
    if (end - start < c.minDays) { issues.push({ type: 'cover_short', a: s.crop, days: end - start }); return; }
    items.push({ key: s.crop, crop: c, start, end, len: end - start, cover: true });
  });
  items.sort((a, b) => a.start - b.start);
  return { L, items, issues };
}

const quantile = (arr, q) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
};
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

// Caché de simulaciones por dataset
const caches = new WeakMap();
function simCached(data, crop, key, sowIdx, len, opts) {
  let c = caches.get(data);
  if (!c) { c = new Map(); caches.set(data, c); }
  const k = `${key}|${sowIdx}|${len}|${opts.awc}|${opts.irrigated ? 1 : 0}`;
  if (!c.has(k)) c.set(k, simulateCrop(data, { crop, sowIdx, len: crop.season === 'cobertura' ? len : undefined, awc: opts.awc, irrigated: opts.irrigated }));
  return c.get(k);
}

// Precio/rendimiento/costo: usa los del usuario si los editó
function econ(key, prices) { const c = CROPS[key]; const p = prices?.[key] || {}; return { yield: p.yield ?? c.yield, price: p.price ?? c.price, cost: p.cost ?? c.cost }; }

/**
 * Simula la rotación en cada campaña histórica.
 * opts: { awc, irrigated, prices }
 */
export function simulateRotation(data, rot, opts = {}) {
  const pl = plan(rot);
  const years = rot.years || 1;
  const y0 = new Date(data.t0).getUTCFullYear();
  const scenarios = [];
  for (let Y = y0; ; Y++) {
    const base = Date.UTC(Y, 7, 1);
    const baseIdx = dayIndex(data, base);
    if (baseIdx < 0) continue;
    const lastEnd = Math.max(...pl.items.map((it) => it.end));
    if (baseIdx + lastEnd + 40 >= data.n) break;
    let prevHarvest = -Infinity, margin = 0, ok = true;
    const runs = [];
    for (const it of pl.items) {
      let sow = baseIdx + it.start;
      if (sow < prevHarvest + TURN) sow = prevHarvest + TURN; // el anterior se atrasó
      const r = simCached(data, it.crop, it.key, sow, it.len, opts);
      if (!r) { ok = false; break; }
      const e = econ(it.key, opts.prices);
      const income = it.cover ? 0 : r.yieldRel * e.yield * e.price;
      margin += income - e.cost - (opts.irrigated ? r.irr * (opts.waterCost ?? 0.3) : 0);
      runs.push({ key: it.key, cover: it.cover, ...r, income, tons: it.cover ? 0 : r.yieldRel * e.yield });
      prevHarvest = r.harvestIdx;
    }
    if (!ok) break;
    scenarios.push({ year: Y, margin: margin / years, runs });
  }
  return { plan: pl, scenarios };
}

// ---------- Suelo ----------
function canopy(crop, d, len) {
  // cobertura viva aproximada: 0 los primeros 10 días → máx. al final del desarrollo → baja al madurar
  const kc = kcAt(crop, d, len);
  const max = crop.kc[1];
  const grow = Math.min(1, Math.max(0, (d - 10) / Math.max(1, (crop.stages[0] + crop.stages[1]) * len - 10)));
  return Math.min(0.95, grow * 0.95 * (kc / max) ** 0.5);
}

export function soilIndicators(pl, monthly, yieldMean = {}) {
  const { L, items } = pl;
  const cover = new Float64Array(L);
  const host = new Map(); // host → días vivos
  // Ordena por inicio; el rastrojo de cada cultivo dura hasta que otro lo tape
  for (let pass = 0; pass < 2; pass++) { // 2 pasadas para que el rastrojo del final cubra el inicio
    for (const it of items) {
      const yr = it.cover ? 1 : (yieldMean[it.key] ?? 1);
      for (let d = 0; d < it.len; d++) {
        const t = (it.start + d) % L;
        cover[t] = Math.max(cover[t], canopy(it.crop, d, it.len));
        if (pass === 0) for (const h of it.crop.hosts) host.set(h, (host.get(h) || 0) + 1);
      }
      for (let d = 0; d < L; d++) {
        const t = (it.end + d) % L;
        cover[t] = Math.max(cover[t], residueCover(it.crop, yr, d));
      }
    }
  }
  // Lluvia sobre suelo desnudo (mm/año), con la climatología mensual de NASA
  let bareDays = 0, rainOnBare = 0;
  const bare = [];
  let run = null;
  for (let t = 0; t < L; t++) {
    const m = new Date(Date.UTC(2001, 7, 1) + (t % CYCLE) * DAY).getUTCMonth();
    const isBare = cover[t] < 0.3;
    if (isBare) { bareDays++; rainOnBare += (monthly?.[m]?.rain ?? 0) / 30.4; }
    if (isBare && !run) run = { start: t, end: t };
    else if (isBare) run.end = t;
    else if (run) { if (run.end - run.start >= 14) bare.push(run); run = null; }
  }
  if (run && run.end - run.start >= 14) bare.push(run);
  const years = L / CYCLE;

  // Ciclo de plagas: transiciones entre cultivos consecutivos (incluye cobertura)
  const seq = [...items].sort((a, b) => a.start - b.start);
  const trans = [];
  for (let i = 0; i < seq.length; i++) {
    const a = seq[i], b = seq[(i + 1) % seq.length];
    if (seq.length === 1) { trans.push({ a: a.key, b: a.key, shared: [...a.crop.hosts], score: 0 }); break; }
    const A = new Set(a.crop.hosts), B = new Set(b.crop.hosts);
    const shared = [...A].filter((h) => B.has(h));
    const union = new Set([...A, ...B]).size || 1;
    let score = 1 - shared.length / union;
    const gap = ((b.start - a.end) % L + L) % L;
    if (shared.length && gap >= 60) score = Math.min(1, score + 0.3); // hueco largo sin hospedero
    if (b.crop.nematicide || a.crop.nematicide) score = Math.min(1, score + 0.2);
    trans.push({ a: a.key, b: b.key, shared, score });
  }
  // Años seguidos con el mismo cultivo de renta en la misma temporada (2 años)
  const pestBreak = mean(trans.map((t) => t.score));
  const greenBridge = (host.get('roya') || 0) / years; // días/año con soya viva

  // Rastrojo (C t/ha/año) y nitrógeno (kg/ha/año)
  let carbon = 0, nitrogen = 0;
  for (const it of items) {
    const yr = it.cover ? Math.min(1.2, it.len / 100) : (yieldMean[it.key] ?? 1);
    carbon += it.crop.residue * yr * 0.42;
    nitrogen += it.cover ? it.crop.n * Math.min(1.2, it.len / 100) : it.crop.n;
  }
  const families = new Set(items.map((it) => it.crop.family)).size;
  return {
    cover, coverPct: 1 - bareDays / L, bareDays: bareDays / years, rainOnBare: rainOnBare / years, bare,
    pestBreak, trans, greenBridge, carbon: carbon / years, nitrogen: nitrogen / years, families,
    crops: new Set(items.map((it) => it.key)).size,
  };
}

// ---------- Resumen y puntaje ----------
export function evaluate(data, rot, clim, opts = {}) {
  const sim = simulateRotation(data, rot, opts);
  const margins = sim.scenarios.map((s) => s.margin);
  const byCrop = {};
  for (const s of sim.scenarios) for (const r of s.runs) {
    if (r.cover) continue;
    const b = (byCrop[r.key] ||= { yields: [], drought: 0, heat: 0, frost: 0, delay: [], dry: 0, n: 0, stress: [] });
    b.yields.push(r.yieldRel); b.n++;
    if (r.waterRel < 0.75) b.drought++;
    if (r.heatDays >= 3) b.heat++;
    if (r.frostDays >= 1) b.frost++;
    if (r.drySown) b.dry++;
    b.delay.push(r.delay); b.stress.push(r.stressDays);
  }
  const crops = {};
  const yieldMean = {};
  for (const [k, b] of Object.entries(byCrop)) {
    yieldMean[k] = mean(b.yields);
    crops[k] = {
      yieldMean: yieldMean[k], yieldP10: quantile(b.yields, 0.1),
      droughtProb: b.drought / b.n, heatProb: b.heat / b.n, frostProb: b.frost / b.n,
      dryProb: b.dry / b.n, delay: mean(b.delay), stress: mean(b.stress), n: b.n,
    };
  }
  const soil = soilIndicators(sim.plan, clim?.monthly, yieldMean);
  const cropList = Object.values(crops);
  const climRisk = cropList.length ? mean(cropList.map((c) => Math.min(1, 0.6 * c.droughtProb + 0.25 * c.heatProb + 0.4 * c.frostProb))) : 0;
  return {
    rot, plan: sim.plan, scenarios: sim.scenarios,
    margin: { mean: mean(margins), p10: quantile(margins, 0.1), p90: quantile(margins, 0.9), lossProb: margins.filter((m) => m < 0).length / Math.max(1, margins.length), n: margins.length },
    crops, soil, climRisk,
    feasible: !sim.plan.issues.some((i) => i.type === 'overlap'),
  };
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
export function soilScore(s) {
  const cover = clamp01((s.coverPct - 0.35) / 0.6);
  const om = clamp01(s.carbon / 3.5);
  const n = clamp01((s.nitrogen + 150) / 200);
  const bridge = s.greenBridge > 240 ? 0.6 : 1;
  return (0.35 * cover + 0.25 * s.pestBreak * bridge + 0.2 * om + 0.2 * n);
}

// Puntajes 0-100 relativos al grupo comparado
export function score(results, w = { profit: 0.4, safety: 0.3, soil: 0.3 }) {
  const ms = results.map((r) => r.margin.mean);
  const p10s = results.map((r) => r.margin.p10);
  const lo = Math.min(...ms), hi = Math.max(...ms);
  const lo10 = Math.min(...p10s), hi10 = Math.max(...p10s);
  for (const r of results) {
    const profit = hi > lo ? (r.margin.mean - lo) / (hi - lo) : 1;
    const p10n = hi10 > lo10 ? (r.margin.p10 - lo10) / (hi10 - lo10) : 1;
    const safety = 0.5 * p10n + 0.25 * (1 - r.margin.lossProb) + 0.25 * (1 - r.climRisk);
    const soil = soilScore(r.soil);
    r.scores = { profit: profit * 100, safety: safety * 100, soil: soil * 100 };
    r.total = (w.profit * profit + w.safety * safety + w.soil * soil) / (w.profit + w.safety + w.soil) * 100;
  }
  return results;
}

// ---------- Candidatas ----------
export function candidateRotations() {
  const summer = [['soya', '11-15'], ['soya', '10-25'], ['soya', '12-05'], ['maiz', '10-01'], ['maiz', '11-01'], ['arroz', '11-15']];
  const winter = [];
  for (const [k, c] of Object.entries(CROPS)) {
    if (c.season === 'invierno') for (const s of c.sow) winter.push({ crop: k, sow: s });
    if (c.season === 'cobertura') winter.push({ crop: k });
  }
  winter.push(null); // barbecho
  const one = [];
  for (const [sc, ss] of summer) for (const w of winter) {
    const steps = [{ crop: sc, sow: ss }];
    if (w) steps.push(w.sow ? { ...w } : { crop: w.crop });
    one.push({ years: 1, steps });
  }
  const okOne = one.filter((r) => !plan(r).issues.length);
  // Dos años: combina rotaciones de 1 año distintas cuyo cultivo de verano cambie (rompe ciclos)
  const two = [];
  for (const a of okOne) for (const b of okOne) {
    if (a === b || a.steps[0].crop === b.steps[0].crop) continue;
    const steps = [...a.steps.map((s) => ({ ...s, year: 0 })), ...b.steps.map((s) => ({ ...s, year: 1 }))];
    two.push({ years: 2, steps });
  }
  return [...okOne, ...two.filter((r) => !plan(r).issues.length)];
}

export function rotationKey(rot) {
  return `${rot.years}:` + rot.steps.map((s) => `${s.crop}@${s.sow || '-'}#${s.year || 0}`).join(',');
}

// Elige 3 alternativas distintas: mejor equilibrio, más segura, mejor para el suelo
export function pickAlternatives(current, pool) {
  const cur = rotationKey(current.rot);
  const others = pool.filter((r) => rotationKey(r.rot) !== cur && r.feasible && r.margin.n > 0);
  const used = new Set();
  const sig = (r) => r.plan.items.map((i) => i.key).sort().join('+');
  const take = (sorted, tag) => {
    const r = sorted.find((x) => !used.has(sig(x)) && sig(x) !== sig(current));
    if (!r) return null;
    used.add(sig(r)); r.tag = tag; return r;
  };
  // Solo alternativas que no ganen mucho menos que lo actual (≥80 %), salvo que no haya otras
  const floor = current.margin.mean > 0 ? current.margin.mean * 0.8 : current.margin.mean - 50;
  const viable = others.filter((r) => r.margin.mean >= floor);
  const base = viable.length >= 3 ? viable : others;
  const best = take([...base].sort((a, b) => b.total - a.total), 'balance');
  const safest = take([...base].sort((a, b) => (b.scores.safety + 0.2 * b.total) - (a.scores.safety + 0.2 * a.total)), 'safety');
  const soil = take([...base].sort((a, b) => (b.scores.soil + 0.2 * b.total) - (a.scores.soil + 0.2 * a.total)), 'soil');
  return [best, safest, soil].filter(Boolean);
}
