// Gráficos SVG sin librerías. Los colores salen de clases CSS (tema claro/oscuro).
import { t, L, fmt } from '../i18n.js';
import { CROPS } from '../data/crops.js';
import { mmddOf } from '../core/rotation.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Día de campaña (1 = 1 de agosto) → "12 Oct"
export function campaignDayLabel(d) {
  const ms = Date.UTC(2001, 7, 1) + (d - 1) * 86400000;
  const dt = new Date(ms);
  return `${dt.getUTCDate()} ${t('months')[dt.getUTCMonth()]}`;
}

function niceTicks(lo, hi, n = 5) {
  const span = hi - lo || 1;
  const step0 = span / n; const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || mag * 10;
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

// --- Inicio de lluvias por campaña ---
export function onsetChart(seasons, trend) {
  const W = 640, H = 260, m = { l: 64, r: 16, t: 16, b: 34 };
  const pts = seasons.filter((s) => s.onset !== null);
  if (!pts.length) return '';
  const x0 = pts[0].year, x1 = pts[pts.length - 1].year;
  const ys = pts.map((s) => s.onset);
  const lo = Math.min(...ys) - 8, hi = Math.max(...ys) + 8;
  const X = (y) => m.l + (y - x0) / Math.max(1, x1 - x0) * (W - m.l - m.r);
  const Y = (v) => m.t + (v - lo) / (hi - lo) * (H - m.t - m.b); // más tarde = más abajo
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(t('onsetChart'))}">`;
  for (const v of niceTicks(lo, hi, 5)) {
    s += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick" x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${esc(campaignDayLabel(v))}</text>`;
  }
  for (let y = x0; y <= x1; y += 4) s += `<text class="tick" x="${X(y)}" y="${H - 10}" text-anchor="middle">${y}</text>`;
  // promedio de cada mitad
  const half = Math.floor(pts.length / 2);
  const seg = (arr, cls) => { if (!arr.length) return ''; const mv = arr.reduce((a, b) => a + b.onset, 0) / arr.length; return `<line class="${cls}" x1="${X(arr[0].year)}" x2="${X(arr[arr.length - 1].year)}" y1="${Y(mv)}" y2="${Y(mv)}"/>`; };
  s += seg(pts.slice(0, half), 'mean-a') + seg(pts.slice(pts.length - half), 'mean-b');
  // tendencia
  const a = trend.perDecade / 10;
  const mx = pts.reduce((q, p) => q + p.year, 0) / pts.length, my = ys.reduce((q, v) => q + v, 0) / ys.length;
  s += `<line class="trend" x1="${X(x0)}" y1="${Y(my + a * (x0 - mx))}" x2="${X(x1)}" y2="${Y(my + a * (x1 - mx))}"/>`;
  for (const p of pts) s += `<circle class="dot" cx="${X(p.year)}" cy="${Y(p.onset)}" r="4.5"><title>${p.year}: ${esc(p.onsetDate)}</title></circle>`;
  return s + '</svg>';
}

// --- Clima mensual: lluvia (barras) y ET0 (línea) + meses delicados ---
export function monthlyChart(monthly, vuln) {
  const W = 640, H = 270, m = { l: 44, r: 12, t: 14, b: 62 };
  const order = [7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6]; // agosto → julio
  const hi = Math.max(...monthly.map((x) => Math.max(x.rain, x.et0))) * 1.1;
  const bw = (W - m.l - m.r) / 12;
  const Y = (v) => H - m.b - v / hi * (H - m.t - m.b);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(t('monthlyChart'))}">`;
  for (const v of niceTicks(0, hi, 4)) s += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick" x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  let path = '';
  order.forEach((mi, i) => {
    const x = m.l + i * bw, mo = monthly[mi];
    s += `<rect class="bar-rain" x="${x + bw * 0.18}" y="${Y(mo.rain)}" width="${bw * 0.64}" height="${H - m.b - Y(mo.rain)}" rx="3"><title>${t('months')[mi]}: ${fmt(mo.rain)} mm · ET0 ${fmt(mo.et0)} mm</title></rect>`;
    path += `${i ? 'L' : 'M'}${x + bw / 2},${Y(mo.et0)}`;
    s += `<text class="tick" x="${x + bw / 2}" y="${H - m.b + 16}" text-anchor="middle">${t('months')[mi]}</text>`;
    const v = vuln[mi]; let k = 0;
    for (const [flag, cls] of [['dry', 'v-dry'], ['heat', 'v-heat'], ['frost', 'v-frost'], ['erosive', 'v-erosive']]) {
      if (v[flag]) { s += `<rect class="${cls}" x="${x + 4 + k * ((bw - 8) / 4)}" y="${H - m.b + 26}" width="${(bw - 8) / 4 - 2}" height="10" rx="2"><title>${t('v_' + flag)}</title></rect>`; }
      k++;
    }
  });
  s += `<path class="line-et0" d="${path}"/>`;
  return s + '</svg>';
}

// --- Calendario de rotaciones (2 años desde agosto) ---
export function timelineChart(results, vuln) {
  const W = 900, rowH = 46, top = 46, left = 150, right = 10;
  const days = 730, H = top + results.length * rowH + 8;
  const X = (d) => left + d / days * (W - left - right);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart timeline" role="img" aria-label="${esc(t('timeline'))}">`;
  s += '<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="6" class="hatch"/></pattern>'
    + '<pattern id="stripe" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="8" height="8" fill="rgba(255,255,255,0)"/><rect width="3" height="8" fill="rgba(255,255,255,.35)"/></pattern></defs>';
  // meses
  let d = 0;
  for (let i = 0; i < 24; i++) {
    const mi = (7 + i) % 12; const len = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mi];
    const v = vuln[mi];
    const cls = v.frost ? 'v-frost' : v.heat ? 'v-heat' : v.dry ? 'v-dry' : v.erosive ? 'v-erosive' : 'v-none';
    s += `<rect class="${cls}" x="${X(d)}" y="22" width="${X(d + len) - X(d) - 1}" height="8" rx="2"/>`;
    s += `<text class="tick" x="${X(d + len / 2)}" y="16" text-anchor="middle">${t('months')[mi][0]}</text>`;
    if (mi === 7 && i) s += `<line class="year-sep" x1="${X(d)}" x2="${X(d)}" y1="10" y2="${H}"/>`;
    d += len;
  }
  results.forEach((r, ri) => {
    const y = top + ri * rowH;
    s += `<text class="row-label" x="${left - 10}" y="${y + 20}" text-anchor="end">${esc(r.label)}</text>`;
    s += `<rect class="row-bg" x="${left}" y="${y + 4}" width="${W - left - right}" height="${rowH - 14}" rx="6"/>`;
    const L2 = r.plan.L;
    // suelo desnudo
    for (let rep = 0; rep < days / L2; rep++) for (const b of r.soil.bare) {
      const a = b.start + rep * L2, e = b.end + 1 + rep * L2;
      if (a >= days) continue;
      s += `<rect fill="url(#hatch)" x="${X(a)}" y="${y + 4}" width="${X(Math.min(days, e)) - X(a)}" height="${rowH - 14}" rx="4"><title>${t('bare')}: ${b.end - b.start + 1} ${t('days')}</title></rect>`;
    }
    for (let rep = -1; rep < days / L2; rep++) for (const it of r.plan.items) {
      {
        const a = it.start + rep * L2, e = it.end + rep * L2;
        if (e <= 0 || a >= days) continue;
        const xa = X(Math.max(0, a)), xe = X(Math.min(days, e));
        const name = L(it.crop.short);
        s += `<g class="crop-bar"><rect x="${xa}" y="${y + 8}" width="${Math.max(2, xe - xa - 1)}" height="${rowH - 22}" rx="5" fill="${it.crop.color}"/>`;
        if (it.cover) s += `<rect x="${xa}" y="${y + 8}" width="${Math.max(2, xe - xa - 1)}" height="${rowH - 22}" rx="5" fill="url(#stripe)"/>`;
        if (xe - xa > 44) s += `<text class="bar-label" x="${xa + 7}" y="${y + 26}">${esc(name)}</text>`;
        s += `<title>${esc(L(it.crop.name))}: ${mmddOf(it.start)} → ${mmddOf(it.end)} (${it.len} ${t('days')})</title></g>`;
      }
    }
  });
  return s + '</svg>';
}

// --- Historial: ganancia por campaña ---
export function historyChart(results) {
  const years = [...new Set(results.flatMap((r) => r.scenarios.map((s) => s.year)))].sort();
  const W = 900, cell = Math.min(28, (W - 160) / years.length), rowH = 30, top = 24, left = 150;
  const H = top + results.length * rowH + 30;
  const all = results.flatMap((r) => r.scenarios.map((s) => s.margin));
  const hi = Math.max(1, ...all.map(Math.abs));
  const color = (v) => {
    const k = Math.min(1, Math.abs(v) / hi);
    return v >= 0 ? `hsl(130 ${35 + 30 * k}% ${88 - 48 * k}%)` : `hsl(4 ${45 + 35 * k}% ${86 - 40 * k}%)`;
  };
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart heat" role="img" aria-label="${esc(t('history'))}">`;
  years.forEach((y, i) => { if (i % 3 === 0) s += `<text class="tick" x="${left + i * cell + cell / 2}" y="16" text-anchor="middle">${String(y).slice(2)}/${String(y + 1).slice(2)}</text>`; });
  results.forEach((r, ri) => {
    const y = top + ri * rowH;
    s += `<text class="row-label" x="${left - 10}" y="${y + 19}" text-anchor="end">${esc(r.label)}</text>`;
    const by = new Map(r.scenarios.map((x) => [x.year, x.margin]));
    years.forEach((yr, i) => {
      if (!by.has(yr)) return;
      const v = by.get(yr);
      s += `<rect x="${left + i * cell + 1}" y="${y + 2}" width="${cell - 2}" height="${rowH - 4}" rx="4" fill="${color(v)}"><title>${yr}/${yr + 1}: ${fmt(v)} USD/ha</title></rect>`;
    });
  });
  // leyenda
  const ly = H - 14;
  s += `<rect x="${left}" y="${ly - 9}" width="14" height="10" rx="2" fill="${color(-hi)}"/><text class="tick" x="${left + 20}" y="${ly}">${fmt(-hi)}</text>`;
  s += `<rect x="${left + 90}" y="${ly - 9}" width="14" height="10" rx="2" fill="${color(0)}"/><text class="tick" x="${left + 110}" y="${ly}">0</text>`;
  s += `<rect x="${left + 150}" y="${ly - 9}" width="14" height="10" rx="2" fill="${color(hi)}"/><text class="tick" x="${left + 170}" y="${ly}">+${fmt(hi)} USD/ha</text>`;
  return s + '</svg>';
}

// --- Anillo de puntaje ---
export function ring(v, cls = '') {
  const r = 26, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, v)) / 100;
  return `<svg viewBox="0 0 64 64" class="ring ${cls}" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="ring-bg"/><circle cx="32" cy="32" r="${r}" class="ring-fg" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 32 32)"/><text x="32" y="38" text-anchor="middle" class="ring-txt">${Math.round(v)}</text></svg>`;
}

export function cropDot(key) { return `<i class="dot-crop" style="background:${CROPS[key].color}"></i>`; }
