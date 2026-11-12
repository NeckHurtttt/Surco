import test from 'node:test';
import assert from 'node:assert/strict';
import { linreg, rainOnset, maxDrySpell, analyzeClimate, campaignDay } from '../js/core/climate.js';
import { normalize } from '../js/core/power.js';

test('regresión lineal exacta', () => {
  const r = linreg([0, 1, 2, 3], [1, 3, 5, 7]);
  assert.ok(Math.abs(r.slope - 2) < 1e-9 && Math.abs(r.r2 - 1) < 1e-9);
});

test('inicio de lluvias: primer evento sin racha seca después', () => {
  // 2001: seco hasta el 10/10 (falsa partida el 1/10 seguida de 15 días secos), lluvia real desde el 20/10
  const start = Date.UTC(2001, 0, 1); const n = 900;
  const P = Array.from({ length: n }, (_, i) => {
    const d = new Date(start + i * 86400000); const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, dd = d.getUTCDate();
    if (y === 2001 && m === 10 && dd === 1) return 30;
    if (y === 2001 && ((m === 10 && dd >= 20) || m >= 11)) return 10;
    if (y === 2002 && m <= 3) return 6;
    return 0;
  });
  const data = normalize({ lat: -17, lon: -63, start: '2001-01-01', P, TX: P.map(() => 30), TN: P.map(() => 18), GR: P.map(() => 0.5), GT: P.map(() => 0.5), SW: P.map(() => 18), RH: P.map(() => 70) });
  const i = rainOnset(data, 2001);
  assert.equal(new Date(data.t0 + i * 86400000).toISOString().slice(0, 10), '2001-10-20');
  assert.equal(maxDrySpell(data, 0, 10), 11);
});

test('día de campaña: 1 de agosto = 1', () => {
  assert.equal(campaignDay(Date.UTC(2010, 7, 1)), 1);
  assert.equal(campaignDay(Date.UTC(2011, 6, 31)), 365);
});

test('clima mensual de un dataset real: verano más lluvioso que invierno', async () => {
  const { readFileSync } = await import('node:fs');
  const data = normalize(JSON.parse(readFileSync(new URL('../data/demo/montero.json', import.meta.url))));
  const c = analyzeClimate(data);
  assert.ok(c.monthly[0].rain > 2 * c.monthly[6].rain);
  assert.ok(c.seasons.length >= 20);
  assert.ok(c.trends.onset.n >= 20);
});
