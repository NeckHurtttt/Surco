import { readFileSync } from 'node:fs';
import { normalize } from '../js/core/power.js';
import { analyzeClimate } from '../js/core/climate.js';
import { evaluate, candidateRotations, score, pickAlternatives, plan } from '../js/core/rotation.js';
import { PRESETS } from '../js/data/crops.js';
const id = process.argv[2] || 'okinawa';
const data = normalize(JSON.parse(readFileSync(`data/demo/${id}.json`)), 'demo');
let t = Date.now();
const clim = analyzeClimate(data);
console.log('clima ms', Date.now() - t, clim.period);
const tr = clim.trends;
for (const k of Object.keys(tr)) console.log(k, tr[k].perDecade.toFixed(1), 'r2', tr[k].r2.toFixed(2), 'n', tr[k].n, tr[k].first.toFixed(1), '→', tr[k].last.toFixed(1));
console.log('onsets', clim.seasons.map((s) => s.onsetDate).join(' '));
console.log('monthly rain', clim.monthly.map((m) => m.rain.toFixed(0)).join(' '));
console.log('monthly et0', clim.monthly.map((m) => m.et0.toFixed(0)).join(' '));
console.log('frostProb', clim.monthly.map((m) => m.frostProb.toFixed(2)).join(' '));
const opts = { awc: 150 };
for (const p of PRESETS) {
  const r = evaluate(data, p, clim, opts);
  console.log(p.id, 'margin', r.margin.mean.toFixed(0), 'p10', r.margin.p10.toFixed(0), 'loss', r.margin.lossProb.toFixed(2), 'n', r.margin.n,
    'cover', r.soil.coverPct.toFixed(2), 'rainBare', r.soil.rainOnBare.toFixed(0), 'pest', r.soil.pestBreak.toFixed(2), 'C', r.soil.carbon.toFixed(2), 'N', r.soil.nitrogen.toFixed(0), 'issues', JSON.stringify(r.plan.issues));
  for (const [k, c] of Object.entries(r.crops)) console.log('   ', k, 'y', c.yieldMean.toFixed(2), 'p10', c.yieldP10.toFixed(2), 'dr', c.droughtProb.toFixed(2), 'heat', c.heatProb.toFixed(2), 'frost', c.frostProb.toFixed(2), 'delay', c.delay.toFixed(1), 'dry', c.dryProb.toFixed(2));
}
t = Date.now();
const cands = candidateRotations();
console.log('candidatas', cands.length);
const pool = cands.map((c) => evaluate(data, c, clim, opts));
const cur = evaluate(data, PRESETS[0], clim, opts);
score([cur, ...pool]);
console.log('eval ms', Date.now() - t);
const alts = pickAlternatives(cur, pool);
for (const a of [cur, ...alts]) console.log(a.tag || 'actual', a.rot.years, a.plan.items.map((i) => i.key + '@' + i.start).join(' '), 'tot', a.total.toFixed(0), JSON.stringify(Object.fromEntries(Object.entries(a.scores).map(([k, v]) => [k, v.toFixed(0)]))), 'm', a.margin.mean.toFixed(0), 'p10', a.margin.p10.toFixed(0));
