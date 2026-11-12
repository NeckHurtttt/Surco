// Arma dist/Surco.html: un solo archivo con el código, los estilos, el logo y los datos demo
// de NASA POWER adentro. Se abre con doble clic (el mapa y la descarga en vivo necesitan internet).
// Uso: node scripts/empaquetar.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { LOCATIONS } from '../js/data/crops.js';

mkdirSync('dist', { recursive: true });
const js = execFileSync('npx', ['-y', 'esbuild@0.24.0', 'js/app.js', '--bundle', '--format=iife', '--minify', '--target=es2020'], { encoding: 'utf8' });
const css = readFileSync('css/app.css', 'utf8');
const icon = readFileSync('assets/icon.svg', 'utf8');
const demo = Object.fromEntries(LOCATIONS.map((l) => [l.id, JSON.parse(readFileSync(`data/demo/${l.id}.json`, 'utf8'))]));
const iconData = `data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}`;
let html = readFileSync('index.html', 'utf8')
  .replace('<link rel="stylesheet" href="css/app.css">', `<style>${css}</style>`)
  .replace('href="assets/icon.svg"', `href="${iconData}"`)
  .replace('<svg viewBox="0 0 40 40" aria-hidden="true"><use href="assets/icon.svg#logo"/></svg>', `<img src="${iconData}" alt="" width="32" height="32">`)
  .replace('<script type="module" src="js/app.js"></script>', () => `<script>window.SURCO_DEMO=${JSON.stringify(demo)};</script>\n<script>${js.replace(/<\/script/g, '<\\/script')}</script>`);
// un solo archivo: el script principal ya no es módulo, así que hay que esperar a Leaflet (defer)
html = html.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js" defer></script>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>');
writeFileSync('dist/Surco.html', html);
console.log('dist/Surco.html', (html.length / 1024 / 1024).toFixed(2), 'MB');
