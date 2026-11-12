import test from 'node:test';
import assert from 'node:assert/strict';
import { extraterrestrialRad, et0Hargreaves, et0HargreavesRs, kcAt, simulateCrop, initialAvailableFrac, residueCover } from '../js/core/agro.js';
import { normalize } from '../js/core/power.js';
import { CROPS } from '../js/data/crops.js';

// Serie sintética: n días, lluvia/temperaturas constantes
export function synth({ n = 800, P = 4, TX = 30, TN = 18, GR = 0.6, GT = 0.7, SW = 18, start = '2001-01-01' } = {}) {
  const arr = (v) => Array.from({ length: n }, (_, i) => (typeof v === 'function' ? v(i) : v));
  return normalize({ lat: -17.3, lon: -63, start, P: arr(P), TX: arr(TX), TN: arr(TN), GR: arr(GR), GT: arr(GT), SW: arr(SW), RH: arr(70) });
}

test('Ra coincide con FAO-56 (ejemplo 8: 20°S, 3 de septiembre ≈ 32,2 MJ)', () => {
  assert.ok(Math.abs(extraterrestrialRad(-20, 246) - 32.2) < 0.3);
});

test('ET0 Hargreaves en rango razonable para el trópico', () => {
  const e = et0Hargreaves(32, 20, 38);
  assert.ok(e > 4 && e < 7, `ET0=${e}`);
  const r = et0HargreavesRs(32, 20, 20);
  assert.ok(r > 4 && r < 6.5, `ET0Rs=${r}`);
});

test('Kc sigue las 4 etapas de FAO-56', () => {
  const c = CROPS.soya;
  assert.equal(kcAt(c, 0, 120), c.kc[0]);
  assert.equal(kcAt(c, 60, 120), c.kc[1]);
  assert.ok(Math.abs(kcAt(c, 119.9, 120) - c.kc[2]) < 0.02);
  assert.ok(kcAt(c, 25, 120) > c.kc[0] && kcAt(c, 25, 120) < c.kc[1]);
});

test('humedad inicial de GWETROOT se limita a 0..1', () => {
  assert.equal(initialAvailableFrac(0.2), 0);
  assert.equal(initialAvailableFrac(0.9), 1);
  assert.ok(Math.abs(initialAvailableFrac(0.55) - 0.5) < 1e-9);
});

test('con lluvia abundante el cultivo no sufre', () => {
  const d = synth({ P: 8 });
  const r = simulateCrop(d, { crop: CROPS.soya, sowIdx: 100 });
  assert.ok(r.waterRel > 0.97, `waterRel=${r.waterRel}`);
  assert.ok(r.yieldRel > 0.95);
  assert.equal(r.delay, 0);
});

test('sin lluvia el cultivo pierde rendimiento y la siembra se atrasa', () => {
  const d = synth({ P: 0, GT: 0.3, GR: 0.3 });
  const r = simulateCrop(d, { crop: CROPS.soya, sowIdx: 100 });
  assert.ok(r.yieldRel < 0.3, `yieldRel=${r.yieldRel}`);
  assert.ok(r.drySown);
});

test('el riego elimina el estrés hídrico y registra agua aplicada', () => {
  const d = synth({ P: 0, GT: 0.3, GR: 0.3 });
  const r = simulateCrop(d, { crop: CROPS.maiz, sowIdx: 100, irrigated: true });
  assert.ok(r.waterRel > 0.95);
  assert.ok(r.irr > 200);
});

test('calor en floración y heladas castigan el rendimiento', () => {
  const hot = simulateCrop(synth({ P: 8, TX: 39 }), { crop: CROPS.trigo, sowIdx: 100 });
  const ok = simulateCrop(synth({ P: 8, TX: 28 }), { crop: CROPS.trigo, sowIdx: 100 });
  assert.ok(hot.heatDays > 10 && hot.yieldRel < ok.yieldRel);
  const frost = simulateCrop(synth({ P: 8, TN: (i) => (i % 20 === 0 ? -2 : 12) }), { crop: CROPS.chia, sowIdx: 100 });
  assert.ok(frost.frostDays > 0 && frost.yieldRel < 0.8);
});

test('el rastrojo de maíz cubre más y dura más que el de soya', () => {
  assert.ok(residueCover(CROPS.maiz, 1, 60) > residueCover(CROPS.soya, 1, 60));
});
