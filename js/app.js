import { t, L, fmt, getLang, setLang } from './i18n.js';
import { CROPS, SOILS, LOCATIONS, PRESETS, HOST_NAMES } from './data/crops.js';
import { loadPower } from './core/power.js';
import { analyzeClimate, vulnerableMonths } from './core/climate.js';
import { evaluate, candidateRotations, score, pickAlternatives, rotationKey } from './core/rotation.js';
import { onsetChart, monthlyChart, timelineChart, historyChart, ring, cropDot, campaignDayLabel } from './ui/charts.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const state = {
  lat: LOCATIONS[1].lat, lon: LOCATIONS[1].lon, locId: LOCATIONS[1].id,
  soil: 'franco', irrigated: false,
  data: null, clim: null, vuln: null,
  rot: structuredClone(PRESETS[0]), presetId: PRESETS[0].id,
  prices: {}, results: null, chosen: null, candidates: null,
};

// ---------------- textos ----------------
function applyTexts() {
  document.documentElement.lang = getLang();
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  $('#btn-lang').textContent = t('lang');
  $('#method').innerHTML = t('method').map((x) => `<li>${x}</li>`).join('');
  $('#limits').innerHTML = t('limits').map((x) => `<li>${esc(x)}</li>`).join('');
  $('#soil').innerHTML = Object.entries(SOILS).map(([k, s]) => `<option value="${k}" ${k === state.soil ? 'selected' : ''}>${esc(L(s.name))} (${s.awc} mm/m)</option>`).join('');
  $('#water').value = state.irrigated ? '1' : '0';
  renderZones(); renderPresets(); renderBuilder(); renderPrices();
  if (state.clim) renderClimate();
  if (state.results) renderResults();
}

// ---------------- 1. Lote ----------------
let map, marker, cellRect;
function initMap() {
  if (!window.L) { $('#map').classList.add('nomap'); $('#map').textContent = '🗺️'; return; }
  map = window.L.map('map', { zoomControl: true, attributionControl: true }).setView([state.lat, state.lon], 8);
  const sat = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
  });
  const osm = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' });
  sat.addTo(map);
  window.L.control.layers({ Satélite: sat, Mapa: osm }, null, { position: 'topright' }).addTo(map);
  map.on('click', (e) => setLocation(e.latlng.lat, e.latlng.lng, null));
  drawMarker();
}
function drawMarker() {
  if (!map) return;
  const ll = [state.lat, state.lon];
  if (!marker) marker = window.L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#2f7d3b', fillOpacity: 1 }).addTo(map);
  marker.setLatLng(ll);
  // celda MERRA-2 (0,5° × 0,625°)
  const la = Math.round(state.lat / 0.5) * 0.5, lo = Math.round(state.lon / 0.625) * 0.625;
  const b = [[la - 0.25, lo - 0.3125], [la + 0.25, lo + 0.3125]];
  if (!cellRect) cellRect = window.L.rectangle(b, { color: '#fcd34d', weight: 2, fill: false, dashArray: '6 6' }).addTo(map).bindTooltip(t('cell'), { className: 'cell-label' });
  cellRect.setBounds(b);
}
function setLocation(lat, lon, locId) {
  state.lat = Math.round(lat * 100) / 100; state.lon = Math.round(lon * 100) / 100; state.locId = locId;
  $('#lat').value = state.lat; $('#lon').value = state.lon;
  renderZones(); drawMarker();
}
function renderZones() {
  $('#zones').innerHTML = LOCATIONS.map((l) => `<button type="button" class="chip ${state.locId === l.id ? 'on' : ''}" data-loc="${l.id}">${esc(l.name)}<small>${esc(L(l.note))}</small></button>`).join('');
}

async function analyze() {
  const btn = $('#btn-analyze'); btn.disabled = true;
  const st = $('#status'); st.className = 'status'; st.textContent = t('loading');
  try {
    const loc = LOCATIONS.find((l) => l.id === state.locId);
    const data = await loadPower(state.lat, state.lon, {
      demoUrl: loc ? `data/demo/${loc.id}.json` : `data/demo/${nearestDemo().id}.json`,
      onStatus: (s) => { if (s !== 'api') st.textContent = t('st_' + s); },
    });
    state.data = data;
    state.clim = analyzeClimate(data);
    state.vuln = vulnerableMonths(state.clim);
    state.results = null; state.candidates = null;
    st.className = 'status ok';
    st.textContent = `${t('st_' + data.source)} · ${state.clim.period[0]} → ${state.clim.period[1]}`;
    unlock('#clima'); unlock('#rotacion');
    renderClimate();
    saveHash();
    $('#clima').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    console.error(e);
    st.className = 'status err'; st.textContent = t('st_error');
  } finally { btn.disabled = false; }
}
function nearestDemo() {
  return LOCATIONS.reduce((best, l) => (Math.hypot(l.lat - state.lat, l.lon - state.lon) < Math.hypot(best.lat - state.lat, best.lon - state.lon) ? l : best));
}
const unlock = (sel) => $(sel).classList.remove('locked');

// ---------------- 2. Clima ----------------
function trendLabel(tr) {
  if (tr.r2 >= 0.25) return t('trendStrong');
  if (tr.r2 >= 0.08) return t('trendWeak');
  return t('trendNone');
}
function ccard(title, now, delta, unit, tr, sense, sub) {
  // sense: 'later' para fechas; 'more' para cantidades
  const d = Math.round(delta);
  let word, cls;
  if (Math.abs(delta) < (unit === t('mm') ? 30 : 3)) { word = t('same'); cls = 'flat'; }
  else if (sense === 'later') { word = `${Math.abs(d)} ${t('days')} ${d > 0 ? t('later') : t('earlier')}`; cls = d > 0 ? 'up' : 'down'; }
  else { word = `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))} ${unit}`; cls = sense === 'bad-up' ? (d > 0 ? 'up' : 'down') : (d > 0 ? 'down' : 'up'); }
  if (tr.r2 < 0.08) cls = 'flat'; // sin tendencia: no pintarlo como alarma
  return `<article class="ccard"><h3>${esc(title)}</h3><div class="big ${cls}">${esc(word)}</div><div class="sub">${sub}</div>
    <span class="tr">${esc(trendLabel(tr))} · r² ${tr.r2.toFixed(2)}</span></article>`;
}
function renderClimate() {
  const c = state.clim, tr = c.trends;
  const per = (x) => `${x.firstYears[0]}–${x.firstYears[1]} → ${x.lastYears[0]}–${x.lastYears[1]}`;
  const anyFrost = c.years.some((y) => y.frost > 0);
  const cards = [
    ccard(t('onsetTitle'), tr.onset.last, tr.onset.last - tr.onset.first, t('days'), tr.onset, 'later',
      `${esc(campaignDayLabel(Math.round(tr.onset.first)))} → <b>${esc(campaignDayLabel(Math.round(tr.onset.last)))}</b><br>${per(tr.onset)}`),
    ccard(t('hotTitle'), tr.hot.last, tr.hot.last - tr.hot.first, t('days'), tr.hot, 'bad-up',
      `${fmt(tr.hot.first)} → <b>${fmt(tr.hot.last)}</b> ${t('days')} ${t('perYear')}<br>${per(tr.hot)}`),
    ccard(t('rainTitle'), tr.seasonRain.last, tr.seasonRain.last - tr.seasonRain.first, t('mm'), tr.seasonRain, 'good-up',
      `${fmt(tr.seasonRain.first)} → <b>${fmt(tr.seasonRain.last)}</b> mm (${t('sepApr')})<br>${per(tr.seasonRain)}`),
    anyFrost && tr.frost.last + tr.frost.first > 2
      ? ccard(t('frostTitle'), tr.frost.last, tr.frost.last - tr.frost.first, t('days'), tr.frost, 'bad-up', `${fmt(tr.frost.first, 1)} → <b>${fmt(tr.frost.last, 1)}</b> ${t('perYear')}<br>${per(tr.frost)}`)
      : ccard(t('drySpellTitle'), tr.drySpell.last, tr.drySpell.last - tr.drySpell.first, t('days'), tr.drySpell, 'bad-up',
        `${fmt(tr.drySpell.first, 1)} → <b>${fmt(tr.drySpell.last, 1)}</b> ${t('days')} (${t('decMar')})<br>${per(tr.drySpell)}`),
  ];
  $('#climate-cards').innerHTML = cards.join('');
  $('#chart-onset').innerHTML = onsetChart(c.seasons, tr.onset);
  $('#lg-a').textContent = `${tr.onset.firstYears[0]}–${tr.onset.firstYears[1]}`;
  $('#lg-b').textContent = `${tr.onset.lastYears[0]}–${tr.onset.lastYears[1]}`;
  $('#lg-t').textContent = t('perDecade', { v: `${tr.onset.perDecade >= 0 ? '+' : ''}${fmt(tr.onset.perDecade, 1)} ${t('days')}` });
  $('#chart-monthly').innerHTML = monthlyChart(c.monthly, state.vuln);
}

// ---------------- 3. Rotación ----------------
const SUMMER = Object.keys(CROPS).filter((k) => CROPS[k].season === 'verano');
const WINTER = Object.keys(CROPS).filter((k) => CROPS[k].season === 'invierno' || CROPS[k].season === 'cobertura');

function renderPresets() {
  $('#presets').innerHTML = PRESETS.map((p) => `<button type="button" class="chip ${state.presetId === p.id ? 'on' : ''}" data-preset="${p.id}">${esc(L(p.name))}</button>`).join('');
}
// La rotación se edita como filas por año: [verano, invierno]
function rows() {
  const out = [];
  for (let y = 0; y < (state.rot.years || 1); y++) {
    const st = state.rot.steps.filter((s) => (s.year || 0) === y);
    out.push({ summer: st.find((s) => CROPS[s.crop].season === 'verano') || null, winter: st.find((s) => CROPS[s.crop].season !== 'verano') || null });
  }
  return out;
}
function dateOptions(key, cur) {
  const c = CROPS[key]; if (!c?.sow) return '';
  const opts = [...new Set([...(c.sow || []), ...(cur ? [cur] : [])])].sort((a, b) => {
    const f = (s) => { const [m, d] = s.split('-').map(Number); return ((m + 4) % 12) * 31 + d; }; return f(a) - f(b);
  });
  return opts.map((s) => { const [m, d] = s.split('-').map(Number); return `<option value="${s}" ${s === cur ? 'selected' : ''}>${d} ${t('months')[m - 1]}</option>`; }).join('');
}
function renderBuilder() {
  const rs = rows();
  $('#two-years').checked = state.rot.years === 2;
  $('#builder').innerHTML = rs.map((r, y) => {
    const sKey = r.summer?.crop || '', wKey = r.winter?.crop || '';
    const sOpts = `<option value="">${esc(t('fallow'))}</option>` + SUMMER.map((k) => `<option value="${k}" ${k === sKey ? 'selected' : ''}>${esc(L(CROPS[k].name))}</option>`).join('');
    const wOpts = `<option value="">${esc(t('fallow'))}</option>` + WINTER.map((k) => `<option value="${k}" ${k === wKey ? 'selected' : ''}>${esc(L(CROPS[k].name))}</option>`).join('');
    const wDate = wKey && CROPS[wKey].season !== 'cobertura';
    return `<div class="brow" data-year="${y}"><div class="yr">${t(y ? 'year2' : 'year1')}</div>
      <label><span>☀ ${t('summer')}</span><div class="bcell"><select data-k="s">${sOpts}</select><select data-k="sd" ${sKey ? '' : 'disabled'}>${sKey ? dateOptions(sKey, r.summer.sow) : ''}</select></div></label>
      <label><span>❄ ${t('winter')}</span><div class="bcell"><select data-k="w">${wOpts}</select><select data-k="wd" ${wDate ? '' : 'disabled'}>${wDate ? dateOptions(wKey, r.winter.sow) : `<option>${wKey ? t('cover') : '—'}</option>`}</select></div></label></div>`;
  }).join('');
}
function readBuilder() {
  const steps = [];
  document.querySelectorAll('.brow').forEach((row) => {
    const y = Number(row.dataset.year);
    const s = row.querySelector('[data-k="s"]').value, sd = row.querySelector('[data-k="sd"]').value;
    const w = row.querySelector('[data-k="w"]').value, wd = row.querySelector('[data-k="wd"]').value;
    if (s) steps.push({ crop: s, sow: CROPS[s].sow.includes(sd) || /^\d\d-\d\d$/.test(sd) ? sd : CROPS[s].sow[0], year: y });
    if (w) steps.push(CROPS[w].season === 'cobertura' ? { crop: w, year: y } : { crop: w, sow: /^\d\d-\d\d$/.test(wd) ? wd : CROPS[w].sow[0], year: y });
  });
  state.rot = { years: document.querySelectorAll('.brow').length, steps };
  state.presetId = null; renderPresets();
}
function onBuilderChange(e) {
  const k = e.target.dataset.k;
  if (k === 's' || k === 'w') { // al cambiar cultivo, poner su primera fecha
    const row = e.target.closest('.brow');
    const v = e.target.value; const sel = row.querySelector(`[data-k="${k}d"]`);
    sel.innerHTML = v && CROPS[v].sow ? dateOptions(v, CROPS[v].sow[Math.min(1, CROPS[v].sow.length - 1)]) : `<option>${v ? t('cover') : '—'}</option>`;
    sel.disabled = !(v && CROPS[v].sow);
  }
  readBuilder(); invalidate();
}
function setTwoYears(on) {
  readBuilder();
  if (on && state.rot.years === 1) {
    state.rot = { years: 2, steps: [...state.rot.steps.map((s) => ({ ...s, year: 0 })), ...state.rot.steps.map((s) => ({ ...s, year: 1 }))] };
  } else if (!on && state.rot.years === 2) {
    state.rot = { years: 1, steps: state.rot.steps.filter((s) => (s.year || 0) === 0) };
  }
  renderBuilder(); invalidate();
}
function invalidate() { if (state.results) { state.results = null; $('#comparar').classList.add('locked'); } saveHash(); }

function renderPrices() {
  const keys = Object.keys(CROPS).filter((k) => CROPS[k].season !== 'cobertura');
  $('#price-table').innerHTML = `<thead><tr><th>${t('crop')}</th><th>${t('potYield')}</th><th>${t('price')}</th><th>${t('cost')}</th></tr></thead><tbody>` +
    keys.map((k) => {
      const c = CROPS[k], p = state.prices[k] || {};
      return `<tr><td>${cropDot(k)}${esc(L(c.name))}</td>
        <td><input type="number" step="0.1" min="0" data-p="${k}:yield" value="${p.yield ?? c.yield}"></td>
        <td><input type="number" step="10" min="0" data-p="${k}:price" value="${p.price ?? c.price}"></td>
        <td><input type="number" step="10" min="0" data-p="${k}:cost" value="${p.cost ?? c.cost}"></td></tr>`;
    }).join('') + '</tbody>';
}

// ---------------- 4. Comparar ----------------
const weights = () => ({ profit: +$('#w-profit').value + 0.01, safety: +$('#w-safety').value + 0.01, soil: +$('#w-soil').value + 0.01 });
const opts = () => ({ awc: SOILS[state.soil].awc, irrigated: state.irrigated, prices: state.prices });

async function compare() {
  if (!state.data) return;
  readBuilder();
  const btn = $('#btn-compare'); btn.disabled = true;
  const prog = $('#progress'); prog.hidden = false;
  const bar = prog.querySelector('div'), lab = prog.querySelector('span');
  try {
    state.candidates ||= candidateRotations();
    const all = state.candidates;
    const o = opts();
    const current = evaluate(state.data, state.rot, state.clim, o);
    const pool = [];
    const B = 150;
    for (let i = 0; i < all.length; i += B) {
      for (const r of all.slice(i, i + B)) pool.push(evaluate(state.data, r, state.clim, o));
      bar.style.width = `${(i / all.length) * 100}%`;
      lab.textContent = t('computing', { n: fmt(all.length), y: current.margin.n });
      await new Promise((r) => setTimeout(r, 0));
    }
    score([current, ...pool], weights());
    const alts = pickAlternatives(current, pool);
    current.tag = 'current';
    state.results = [current, ...alts];
    state.chosen = null;
    unlock('#comparar');
    renderResults();
    $('#comparar').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    console.error(e);
  } finally { btn.disabled = false; prog.hidden = true; bar.style.width = '0'; }
}

function seqName(r) {
  return r.plan.items.map((it) => L(it.crop.short) + (it.cover ? '*' : '')).join(' → ');
}
const pct = (x) => `${fmt(x * 100)} %`;
const signed = (v, d = 0) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), d)}`;

function warningsFor(r) {
  const w = [];
  for (const i of r.plan.issues) {
    if (i.type === 'overlap') w.push(t('w_overlap', { a: L(CROPS[i.a].short), b: L(CROPS[i.b].short), d: i.days }));
    if (i.type === 'cover_short') w.push(t('w_coverShort', { a: L(CROPS[i.a].short), d: Math.max(0, i.days) }));
  }
  if (r.soil.greenBridge > 240) w.push(t('w_bridge', { d: fmt(r.soil.greenBridge) }));
  const mono = r.soil.trans.filter((x) => x.score < 0.4 && x.shared.length);
  if (mono.length) w.push(t('w_mono', { h: [...new Set(mono.flatMap((x) => x.shared))].slice(0, 3).map((h) => L(HOST_NAMES[h])).join(', ') }));
  if (r.soil.rainOnBare > 250) w.push(t('w_bare', { d: fmt(r.soil.bareDays), mm: fmt(r.soil.rainOnBare) }));
  for (const [k, c] of Object.entries(r.crops)) {
    const name = L(CROPS[k].short);
    if (c.droughtProb >= 0.3) w.push(t('w_drought', { c: name, p: fmt(c.droughtProb * 10) }));
    if (c.heatProb >= 0.3) w.push(t('w_heat', { c: name, p: fmt(c.heatProb * 10) }));
    if (c.frostProb >= 0.2) w.push(t('w_frost', { c: name, p: fmt(c.frostProb * 10) }));
  }
  if (r.soil.nitrogen < -80) w.push(t('w_n', { n: fmt(-r.soil.nitrogen) }));
  return w;
}

function whyFor(r, cur) {
  const out = [];
  const dm = r.margin.mean - cur.margin.mean;
  if (dm >= 15) out.push(t('y_margin', { v: fmt(dm) }));
  else if (dm <= -15) out.push(t('y_marginLess', { v: fmt(-dm) }));
  const db = r.margin.p10 - cur.margin.p10;
  if (db >= 15) out.push(t('y_bad', { v: fmt(db) }));
  const dr = cur.soil.rainOnBare - r.soil.rainOnBare;
  if (dr >= 40) out.push(t('y_bare', { v: fmt(dr) }));
  if (r.soil.pestBreak - cur.soil.pestBreak >= 0.15) out.push(t('y_pest', { a: pct(cur.soil.pestBreak), b: pct(r.soil.pestBreak) }));
  if (cur.soil.greenBridge > 240 && r.soil.greenBridge <= 240) out.push(t('y_bridge'));
  const dn = r.soil.nitrogen - cur.soil.nitrogen;
  if (dn >= 20) out.push(t('y_n', { v: fmt(dn) }));
  const dc = r.soil.carbon - cur.soil.carbon;
  if (dc >= 0.3) out.push(t('y_c', { v: fmt(dc, 1) }));
  if (cur.climRisk - r.climRisk >= 0.08) out.push(t('y_risk', { a: pct(cur.climRisk), b: pct(r.climRisk) }));
  return out;
}

function sbar(label, v) {
  return `<div class="sbar"><span>${esc(label)}</span><i><b style="width:${Math.max(2, Math.min(100, v))}%"></b></i><span>${Math.round(v)}</span></div>`;
}

function renderResults() {
  const rs = state.results; if (!rs) return;
  const cur = rs[0];
  for (const r of rs) r.label = r.tag === 'current' ? t('current') : t('tag_' + r.tag);
  const w = warningsFor(cur);
  $('#warnings').innerHTML = w.length ? `<div class="warn"><h3>⚠ ${esc(t('warnings'))}</h3><ul>${w.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  $('#cards').innerHTML = rs.map((r, i) => {
    const isCur = i === 0;
    const why = isCur ? [] : whyFor(r, cur);
    const crops = Object.entries(r.crops).map(([k, c]) => `<tr><td>${cropDot(k)}${esc(L(CROPS[k].short))}</td><td>${fmt(c.yieldMean * ((state.prices[k]?.yield) ?? CROPS[k].yield), 1)} ${t('tha')}</td><td>${pct(c.droughtProb)}</td><td>${pct(c.heatProb)}</td><td>${fmt(c.delay)} d</td></tr>`).join('');
    const nCls = r.soil.nitrogen >= 0 ? 'good' : r.soil.nitrogen < -80 ? 'bad' : '';
    return `<article class="rcard ${isCur ? 'cur' : 'alt'} ${state.chosen === i ? 'chosen' : ''}">
      <div class="tag">${esc(r.label)}</div>
      <div class="seq">${esc(seqName(r))}</div>
      <div class="head">${ring(r.total)}<div class="money">${fmt(r.margin.mean)} <small>${t('usdHaYr')} · ${t('marginAvg').toLowerCase()}</small></div></div>
      ${sbar(t('wProfit'), r.scores.profit)}${sbar(t('wSafety'), r.scores.safety)}${sbar(t('wSoil'), r.scores.soil)}
      <ul class="kv">
        <li><span>${t('marginBad')}</span><b class="${r.margin.p10 < 0 ? 'bad' : ''}">${fmt(r.margin.p10)} USD</b></li>
        <li><span>${t('lossYears')}</span><b class="${r.margin.lossProb > 0.1 ? 'bad' : ''}">${pct(r.margin.lossProb)}</b></li>
        <li><span>${t('coverPct')}</span><b class="${r.soil.coverPct > 0.75 ? 'good' : r.soil.coverPct < 0.5 ? 'bad' : ''}">${pct(r.soil.coverPct)}</b></li>
        <li><span>${t('rainBare')}</span><b class="${r.soil.rainOnBare > 250 ? 'bad' : r.soil.rainOnBare < 100 ? 'good' : ''}">${fmt(r.soil.rainOnBare)} ${t('mmYr')}</b></li>
        <li><span>${t('pestBreak')}</span><b class="${r.soil.pestBreak > 0.7 ? 'good' : r.soil.pestBreak < 0.4 ? 'bad' : ''}">${pct(r.soil.pestBreak)}</b></li>
        <li><span>${t('nitrogen')}</span><b class="${nCls}">${signed(r.soil.nitrogen)} ${t('kgNha')}</b></li>
        <li><span>${t('carbon')}</span><b>${fmt(r.soil.carbon, 1)} ${t('tCha')}</b></li>
        <li><span>${t('climRisk')}</span><b class="${r.climRisk > 0.35 ? 'bad' : ''}">${pct(r.climRisk)}</b></li>
      </ul>
      ${why.length ? `<div class="why"><b>${t('why')}</b><ul>${why.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      <details><summary>${t('details')}</summary><table><thead><tr><th></th><th>${t('yieldAvg')}</th><th>${t('droughtP')}</th><th>${t('heatP')}</th><th>${t('sowDelay')}</th></tr></thead><tbody>${crops}</tbody></table></details>
      ${isCur ? '' : `<div class="choose"><button type="button" class="${state.chosen === i ? 'primary' : 'ghost'}" data-choose="${i}">${state.chosen === i ? '✓ ' + t('chosen') : t('choose')}</button></div>`}
    </article>`;
  }).join('');
  $('#chart-timeline').innerHTML = timelineChart(rs, state.vuln);
  $('#chart-history').innerHTML = historyChart(rs);
}

// ---------------- enlace para compartir ----------------
function saveHash() {
  const p = new URLSearchParams({ lat: state.lat, lon: state.lon, soil: state.soil, irr: state.irrigated ? 1 : 0 });
  if (state.locId) p.set('z', state.locId);
  p.set('rot', `${state.rot.years}|` + state.rot.steps.map((s) => `${s.crop}${s.sow ? '@' + s.sow : ''}${s.year ? '#1' : ''}`).join(','));
  history.replaceState(null, '', '#' + p.toString());
}
function loadHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.has('lat') && p.has('lon')) { state.lat = +p.get('lat'); state.lon = +p.get('lon'); state.locId = p.get('z'); }
  if (p.has('soil') && SOILS[p.get('soil')]) state.soil = p.get('soil');
  if (p.get('irr') === '1') state.irrigated = true;
  if (p.has('rot')) {
    try {
      const [y, list] = p.get('rot').split('|');
      const steps = list.split(',').filter(Boolean).map((x) => {
        const m = x.match(/^(\w+)(?:@(\d\d-\d\d))?(#1)?$/); if (!m || !CROPS[m[1]]) throw new Error('rot');
        return { crop: m[1], ...(m[2] ? { sow: m[2] } : {}), ...(m[3] ? { year: 1 } : {}) };
      });
      state.rot = { years: Number(y) === 2 ? 2 : 1, steps };
      state.presetId = PRESETS.find((pr) => rotationKey(pr) === rotationKey(state.rot))?.id || null;
    } catch { /* enlace roto: deja la rotación por defecto */ }
  }
}

// ---------------- tema ----------------
function initTheme() {
  let th = null; try { th = localStorage.getItem('surco:theme'); } catch { /* */ }
  if (th) document.documentElement.dataset.theme = th;
  $('#btn-theme').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('surco:theme', next); } catch { /* */ }
  });
}

// ---------------- eventos ----------------
function bind() {
  $('#zones').addEventListener('click', (e) => {
    const b = e.target.closest('[data-loc]'); if (!b) return;
    const l = LOCATIONS.find((x) => x.id === b.dataset.loc);
    setLocation(l.lat, l.lon, l.id); map?.setView([l.lat, l.lon], 8);
  });
  for (const id of ['#lat', '#lon']) $(id).addEventListener('change', () => { setLocation(+$('#lat').value, +$('#lon').value, null); map?.setView([state.lat, state.lon]); });
  $('#soil').addEventListener('change', (e) => { state.soil = e.target.value; invalidate(); });
  $('#water').addEventListener('change', (e) => { state.irrigated = e.target.value === '1'; invalidate(); });
  $('#btn-analyze').addEventListener('click', analyze);
  $('#presets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-preset]'); if (!b) return;
    const p = PRESETS.find((x) => x.id === b.dataset.preset);
    state.rot = structuredClone({ years: p.years, steps: p.steps }); state.presetId = p.id;
    renderPresets(); renderBuilder(); invalidate();
  });
  $('#builder').addEventListener('change', onBuilderChange);
  $('#two-years').addEventListener('change', (e) => setTwoYears(e.target.checked));
  $('#price-table').addEventListener('change', (e) => {
    const [k, f] = (e.target.dataset.p || '').split(':'); if (!k) return;
    const v = parseFloat(e.target.value);
    if (Number.isFinite(v) && v >= 0) { (state.prices[k] ||= {})[f] = v; invalidate(); }
  });
  for (const id of ['#w-profit', '#w-safety', '#w-soil']) $(id).addEventListener('change', () => {
    if (state.results) { score(state.results, weights()); renderResults(); }
  });
  $('#btn-compare').addEventListener('click', compare);
  $('#cards').addEventListener('click', (e) => {
    const b = e.target.closest('[data-choose]'); if (!b) return;
    state.chosen = Number(b.dataset.choose); renderResults();
  });
  $('#btn-print').addEventListener('click', () => {
    document.querySelectorAll('.rcard details').forEach((d) => { d.open = true; });
    window.print();
  });
  $('#btn-share').addEventListener('click', async () => {
    saveHash();
    try { await navigator.clipboard.writeText(location.href); $('#btn-share').textContent = '✓'; } catch { prompt('URL', location.href); }
    setTimeout(() => { $('#btn-share').textContent = t('share'); }, 1500);
  });
  $('#btn-lang').addEventListener('click', () => { setLang(getLang() === 'es' ? 'en' : 'es'); applyTexts(); });
}

// ---------------- inicio ----------------
loadHash();
initTheme();
applyTexts();
bind();
$('#lat').value = state.lat; $('#lon').value = state.lon;
$('#soil').value = state.soil;
window.addEventListener('load', initMap);
// Si el enlace trae un lote, analizar de una
if (location.hash.includes('lat=')) analyze();

// Para pruebas en el navegador
window.surco = { state, analyze, compare };
