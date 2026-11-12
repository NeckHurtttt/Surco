import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plan, offsetOf, mmddOf, evaluate, candidateRotations, score, pickAlternatives, soilIndicators } from '../js/core/rotation.js';
import { normalize } from '../js/core/power.js';
import { analyzeClimate } from '../js/core/climate.js';
import { PRESETS } from '../js/data/crops.js';

const data = normalize(JSON.parse(readFileSync(new URL('../data/demo/okinawa.json', import.meta.url))));
const clim = analyzeClimate(data);

test('offset ↔ fecha', () => {
  assert.equal(offsetOf('08-01'), 0);
  assert.equal(mmddOf(offsetOf('11-15')), '11-15');
  assert.equal(offsetOf('03-01', 1) - offsetOf('03-01'), 365);
});

test('detecta choque de fechas', () => {
  const p = plan({ years: 1, steps: [{ crop: 'soya', sow: '12-05' }, { crop: 'sorgo', sow: '02-25' }] });
  assert.ok(p.issues.some((i) => i.type === 'overlap'));
});

test('la cobertura llena el hueco entre cosecha y siembra', () => {
  const p = plan({ years: 1, steps: [{ crop: 'soya', sow: '11-15' }, { crop: 'crotalaria' }] });
  const cov = p.items.find((i) => i.cover);
  const soy = p.items.find((i) => !i.cover);
  assert.ok(cov.start >= soy.end && cov.end <= soy.start + 365);
  assert.ok(cov.len >= 45);
});

test('todas las rotaciones típicas son viables y se simulan 20+ campañas', () => {
  for (const pr of PRESETS) {
    const r = evaluate(data, pr, clim, { awc: 150 });
    assert.ok(r.feasible, pr.id);
    assert.ok(r.margin.n >= 20, `${pr.id}: ${r.margin.n}`);
  }
});

test('soya todo el año: puente verde y poco corte de plagas', () => {
  const r = evaluate(data, PRESETS.find((p) => p.id === 'soya_soya'), clim, { awc: 150 });
  assert.ok(r.soil.greenBridge > 200);
  assert.ok(r.soil.pestBreak < 0.4);
});

test('una gramínea de invierno cubre más el suelo que el barbecho', () => {
  const fallow = evaluate(data, PRESETS.find((p) => p.id === 'soya_barbecho'), clim, { awc: 150 });
  const sorgo = evaluate(data, PRESETS.find((p) => p.id === 'soya_sorgo'), clim, { awc: 150 });
  assert.ok(sorgo.soil.coverPct > fallow.soil.coverPct + 0.2);
  assert.ok(sorgo.soil.rainOnBare < fallow.soil.rainOnBare);
  assert.ok(sorgo.soil.pestBreak > fallow.soil.pestBreak);
});

test('cambiar el precio cambia la ganancia', () => {
  const rot = PRESETS.find((p) => p.id === 'soya_barbecho');
  const a = evaluate(data, rot, clim, { awc: 150 });
  const b = evaluate(data, rot, clim, { awc: 150, prices: { soya: { price: 500 } } });
  assert.ok(b.margin.mean > a.margin.mean + 200);
});

test('suelo arenoso = más riesgo que franco', () => {
  const rot = PRESETS.find((p) => p.id === 'soya_trigo');
  const sandy = evaluate(data, rot, clim, { awc: 80 });
  const loam = evaluate(data, rot, clim, { awc: 150 });
  assert.ok(sandy.margin.mean < loam.margin.mean);
});

test('genera candidatas viables y elige 3 alternativas distintas a la actual', () => {
  const cands = candidateRotations();
  assert.ok(cands.length > 1000);
  const cur = evaluate(data, PRESETS[0], clim, { awc: 150 });
  const pool = cands.slice(0, 400).map((c) => evaluate(data, c, clim, { awc: 150 }));
  score([cur, ...pool]);
  const alts = pickAlternatives(cur, pool);
  assert.equal(alts.length, 3);
  const sig = (r) => r.plan.items.map((i) => i.key).sort().join('+');
  assert.equal(new Set([cur, ...alts].map(sig)).size, 4);
  for (const a of alts) assert.ok(a.total >= 0 && a.total <= 100);
});

test('indicadores de suelo con calendario vacío no revientan', () => {
  const s = soilIndicators({ L: 365, items: [] }, clim.monthly);
  assert.equal(s.coverPct, 0);
});
