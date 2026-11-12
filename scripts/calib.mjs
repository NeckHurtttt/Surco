import { readFileSync } from 'node:fs';
import { normalize } from '../js/core/power.js';
import { simulateCrop, dayIndex } from '../js/core/agro.js';
import { CROPS } from '../js/data/crops.js';
const ids = ['montero', 'okinawa', 'pailon'];
for (const [k, c] of Object.entries(CROPS)) {
  if (c.season === 'cobertura') continue;
  const rel = [];
  for (const id of ids) {
    const d = normalize(JSON.parse(readFileSync(`data/demo/${id}.json`)));
    for (let Y = 2001; Y < 2025; Y++) for (const s of c.sow) {
      const [m, dd] = s.split('-').map(Number); const yy = m >= 8 ? Y : Y + 1;
      const r = simulateCrop(d, { crop: c, sowIdx: dayIndex(d, Date.UTC(yy, m - 1, dd)), awc: 150 });
      if (r) rel.push(r);
    }
  }
  const mean = (f) => rel.reduce((s, r) => s + f(r), 0) / rel.length;
  console.log(k.padEnd(10), 'rel', mean((r) => r.yieldRel).toFixed(2), 'water', mean((r) => r.waterRel).toFixed(2), 'heatD', mean((r) => r.heatDays).toFixed(1), 'frostD', mean((r) => r.frostDays).toFixed(1), 'etc', mean((r) => r.etc).toFixed(0), 'rain', mean((r) => r.rain).toFixed(0));
}
