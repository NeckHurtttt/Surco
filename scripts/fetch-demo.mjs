// Descarga datos NASA POWER para las zonas de ejemplo → data/demo/<id>.json
// Uso: node scripts/fetch-demo.mjs
import { writeFileSync } from 'node:fs';
import { LOCATIONS } from '../js/data/crops.js';
import { powerUrl, fromPowerJson } from '../js/core/power.js';
for (const l of LOCATIONS) {
  const res = await fetch(powerUrl(l.lat, l.lon));
  if (!res.ok) { console.error(l.id, res.status); continue; }
  const c = fromPowerJson(await res.json(), l.lat, l.lon);
  for (const k of Object.keys(c)) if (Array.isArray(c[k])) c[k] = c[k].map((v) => (v === null ? null : Math.round(v * 100) / 100));
  writeFileSync(`data/demo/${l.id}.json`, JSON.stringify(c));
  console.log(l.id, c.start, c.TX.length, 'días');
}
