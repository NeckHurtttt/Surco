#!/usr/bin/env python3
"""Genera las imágenes del README (docs/img). Los textos se convierten a trazos para
que se vean igual en GitHub. Uso: uv run --with fonttools python scripts/docs_img.py <carpeta_fuentes>
(la carpeta debe tener fraunces-800.ttf, inter-600.ttf, inter-400.ttf: instancias de Google Fonts, OFL)."""
import math, pathlib, random, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FD = pathlib.Path(sys.argv[1]); OUT = pathlib.Path('docs/img'); OUT.mkdir(parents=True, exist_ok=True)
random.seed(4)

class F:
    def __init__(s, p):
        s.t = TTFont(p); s.gs = s.t.getGlyphSet(); s.cm = s.t.getBestCmap(); s.upm = s.t['head'].unitsPerEm
    def g(s, c): return s.gs[s.cm.get(ord(c), s.cm[32])]
    def width(s, txt, size, tr=0): return sum(s.g(c).width * size / s.upm + tr for c in txt)
    def path(s, txt, x, y, size, tr=0):
        k = size / s.upm; pen = SVGPathPen(s.gs, ntos=lambda v: f'{v:.1f}'.rstrip('0').rstrip('.'))
        for c in txt:
            g = s.g(c); g.draw(TransformPen(pen, (k, 0, 0, -k, x, y))); x += g.width * k + tr
        return pen.getCommands()
SERIF, SANS, SANSR = F(FD/'fraunces-800.ttf'), F(FD/'inter-600.ttf'), F(FD/'inter-400.ttf')

def T(txt, x, y, size, f=SANS, fill='#1d2a20', anchor='s', tr=0, extra=''):
    w = f.width(txt, size, tr)
    if anchor == 'm': x -= w / 2
    if anchor == 'e': x -= w
    return f'<path fill="{fill}" {extra} d="{f.path(txt, x, y, size, tr)}"/>'

INK, PAPER, GREEN, SOIL, WHEAT = '#1d2a20', '#f5f1e8', '#1f3d2b', '#8a6a4a', '#c8a165'
CROPC = ['#7cb342', '#d84315', '#ffb300', '#c8a165', '#9ccc65', '#26a69a', '#fbc02d', '#8a6a4a']
STILL = '@media (prefers-reduced-motion: reduce){*{animation:none!important}}'

def svg(w, h, label, body, css=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{label}">'
            f'<style>{css}{STILL}</style>{body}</svg>')

def logo_symbol(x, y, s):
    k = s / 40
    return (f'<g transform="translate({x},{y}) scale({k})"><rect width="40" height="40" rx="10" fill="{GREEN}"/>'
            f'<path d="M6 30c6-3 22-3 28 0M8 35c6-2.5 18-2.5 24 0M9 25c5-2.5 17-2.5 22 0" stroke="{WHEAT}" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
            f'<path d="M20 23V12" stroke="#9ccc65" stroke-width="2.4" stroke-linecap="round"/>'
            f'<path d="M20 15c-1-4-4-6-8-6 0 4 3 7 8 6zM20 13c1-4 4-6 8-6 0 4-3 7-8 6z" fill="#9ccc65"/></g>')

# ---------------- banner ----------------
W, H = 1200, 400; HZ = 238
o = ('<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3d79c"/><stop offset=".7" stop-color="#f6ead0"/><stop offset="1" stop-color="#f5f1e8"/></linearGradient>'
     '<radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd166"/><stop offset=".55" stop-color="#f2b134"/><stop offset="1" stop-color="#f2b134" stop-opacity="0"/></radialGradient>'
     '<linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b7bd6" stop-opacity=".35"/><stop offset="1" stop-color="#2b7bd6" stop-opacity="0"/></linearGradient>'
     '<clipPath id="field"><rect x="0" y="' + str(HZ) + f'" width="{W}" height="{H-HZ}"/></clipPath></defs>')
o += f'<rect width="{W}" height="{H}" fill="url(#sky)"/>'
o += f'<circle cx="960" cy="{HZ-6}" r="150" fill="url(#sun)" class="glow"/><circle cx="960" cy="{HZ-6}" r="62" fill="#f2b134"/>'
# nube con lluvia
cl = f'<g class="cloud"><g transform="translate(700,58)"><ellipse cx="40" cy="30" rx="44" ry="20" fill="#fffaf0"/><ellipse cx="78" cy="22" rx="34" ry="22" fill="#fffaf0"/><ellipse cx="110" cy="32" rx="30" ry="16" fill="#fffaf0"/>'
cl += ''.join(f'<rect class="drop" style="animation-delay:{i*.17:.2f}s" x="{22+i*13}" y="48" width="2" height="9" rx="1" fill="#2b7bd6"/>' for i in range(7))
o += cl + '</g></g>'
# satélite que cruza y escanea
sat = (f'<g class="sat"><g transform="translate(0,46)"><path class="scan" d="M0 12 L-90 {HZ+60-46} L90 {HZ+60-46} Z" fill="url(#beam)"/>'
       '<rect x="-7" y="4" width="14" height="16" rx="2" fill="#0b3d91"/><rect x="-33" y="8" width="22" height="8" fill="#2b7bd6"/><rect x="11" y="8" width="22" height="8" fill="#2b7bd6"/>'
       '<path d="M-33 12H33" stroke="#0b3d91" stroke-width="1"/><circle cx="0" cy="22" r="2.5" fill="#fc3d21"/></g></g>')
o += sat
# campo en perspectiva: cuñas desde el punto de fuga
vx, vy = 600, HZ - 70
n = 26
xs = [-400 + i * (2000 / n) for i in range(n + 1)]
f = ''
for i in range(n):
    col = CROPC[(i * 3 + i // 4) % len(CROPC)]
    a, b = xs[i], xs[i + 1]
    def at(x, y): return vx + (x - vx) * (y - vy) / (H - vy)
    f += f'<path d="M{at(a,HZ):.1f} {HZ}L{at(b,HZ):.1f} {HZ}L{b:.1f} {H}L{a:.1f} {H}Z" fill="{col}" opacity=".92"/>'
# franjas horizontales (parcelas) y surcos
for k in range(8):
    y = HZ + (H - HZ) * ((k + 1) / 8) ** 1.6
    f += f'<rect x="0" y="{y:.1f}" width="{W}" height="{1.2 + k*0.35:.1f}" fill="{PAPER}" opacity=".55"/>'
for i in range(n * 3):
    a = -400 + i * (2000 / (n * 3))
    f += f'<path d="M{vx + (a - vx) * (HZ - vy) / (H - vy):.1f} {HZ}L{a:.1f} {H}" stroke="#000" stroke-opacity=".07" stroke-width="1"/>'
o += f'<g clip-path="url(#field)">{f}</g><rect x="0" y="{HZ-1}" width="{W}" height="2" fill="{SOIL}" opacity=".5"/>'
# brotes en primer plano
for i in range(14):
    x = 40 + i * 86 + random.randint(-8, 8); y = H - 18 - random.randint(0, 10)
    o += (f'<g class="sprout" style="animation-delay:{i*.18:.2f}s;transform-origin:{x}px {y}px"><path d="M{x} {y}V{y-18}" stroke="#2f7d3b" stroke-width="3" stroke-linecap="round"/>'
          f'<path d="M{x} {y-12}c-2-7-8-10-14-9 0 7 6 11 14 9zM{x} {y-15}c2-7 8-10 14-9 0 7-6 11-14 9z" fill="#2f7d3b"/></g>')
# textos
o += f'<rect x="56" y="46" width="{SANS.width("NASA SPACE APPS 2026 · FIELD SHIFT", 13, 1.6)+34:.0f}" height="30" rx="15" fill="#fffaf0"/><circle cx="74" cy="61" r="5" fill="#0b3d91"/><circle cx="74" cy="61" r="8" fill="none" stroke="#fc3d21" stroke-opacity=".5" stroke-width="2.5"/>'
o += T('NASA SPACE APPS 2026 · FIELD SHIFT', 88, 66, 13, SANS, '#4d5a50', tr=1.6)
o += logo_symbol(56, 98, 72) + T('Surco', 144, 160, 84, SERIF, INK, tr=-1)
o += T('Rotaciones que se adaptan a tu clima', 58, 206, 25, SANS, INK)
css = ('.sat{animation:sa 14s linear infinite}@keyframes sa{from{transform:translateX(-120px)}to{transform:translateX(1320px)}}'
       '.scan{animation:sc 1.4s ease-in-out infinite alternate}@keyframes sc{from{opacity:.25}to{opacity:1}}'
       '.cloud{animation:cl 18s ease-in-out infinite alternate}@keyframes cl{to{transform:translateX(-160px)}}'
       '.drop{animation:dr 1.2s linear infinite}@keyframes dr{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(60px);opacity:0}}'
       '.glow{animation:gl 5s ease-in-out infinite alternate}@keyframes gl{to{opacity:.6}}'
       '.sprout{animation:sp 3.2s ease-in-out infinite}@keyframes sp{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}')
(OUT/'banner.svg').write_text(svg(W, H, 'Surco: rotaciones que se adaptan a tu clima. NASA Space Apps 2026, Field Shift.', o, css))

# ---------------- separador (surco con brotes) ----------------
W2, H2 = 1200, 40
p = 'M0 26 ' + ' '.join(f'Q{x+25} {18 if (x//50)%2 else 34} {x+50} 26' for x in range(0, W2, 50))
o = f'<path d="{p}" fill="none" stroke="{SOIL}" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>'
for i, x in enumerate(range(50, W2, 100)):
    col = CROPC[i % len(CROPC)]
    o += (f'<g class="s" style="animation-delay:{i*.25:.2f}s;transform-origin:{x}px 26px"><path d="M{x} 26V12" stroke="{col}" stroke-width="2.5" stroke-linecap="round"/>'
          f'<circle cx="{x}" cy="11" r="4" fill="{col}"/></g>')
(OUT/'surco.svg').write_text(svg(W2, H2, '', o, '.s{animation:gr 2.8s ease-in-out infinite}@keyframes gr{0%,100%{transform:scaleY(.55)}50%{transform:scaleY(1)}}'))

# ---------------- flujo de datos ----------------
W3, H3 = 1000, 250
boxes = [('NASA POWER', ['lluvia · temperatura', 'radiación solar', 'humedad del suelo'], '#0b3d91', '#e8eef8'),
         ('Tu clima', ['inicio de lluvias', 'calor · veranillos', 'meses delicados'], '#2b7bd6', '#e7f1fb'),
         ('Simulador', ['4.700 rotaciones', '× 25 campañas reales', 'agua · calor · suelo'], '#2f7d3b', '#e8f2e6'),
         ('3 alternativas', ['mejor equilibrio', 'más segura', 'mejor para el suelo'], '#8a6a4a', '#f3ece2')]
o = f'<rect width="{W3}" height="{H3}" rx="18" fill="#fffdf8"/>'
bw, gap = 206, 46
for i, (title, lines, c, bg) in enumerate(boxes):
    x = 26 + i * (bw + gap); y = 40
    o += f'<rect x="{x}" y="{y}" width="{bw}" height="170" rx="14" fill="{bg}" stroke="{c}" stroke-width="2"/>'
    o += f'<rect x="{x}" y="{y}" width="{bw}" height="44" rx="14" fill="{c}"/><rect x="{x}" y="{y+30}" width="{bw}" height="14" fill="{c}"/>'
    o += T(f'{i+1} · {title}', x + bw / 2, y + 29, 17, SANS, '#ffffff', 'm')
    for j, ln in enumerate(lines): o += T(ln, x + bw / 2, y + 82 + j * 30, 15, SANSR, INK, 'm')
    if i < 3:
        ax = x + bw + 6
        o += f'<path class="flow" d="M{ax} {y+85}H{ax+gap-14}" stroke="{c}" stroke-width="3" stroke-dasharray="6 6" fill="none"/><path d="M{ax+gap-16} {y+77}l10 8-10 8z" fill="{c}"/>'
(OUT/'flujo.svg').write_text(svg(W3, H3, 'Flujo: datos NASA POWER → tu clima → simulador de 4.700 rotaciones en 25 campañas → 3 alternativas', o, '.flow{animation:fl 1s linear infinite}@keyframes fl{to{stroke-dashoffset:-12}}'))

# ---------------- logo grande ----------------
o = logo_symbol(0, 0, 120) + T('Surco', 140, 92, 92, SERIF, INK, tr=-1)
(OUT/'logo.svg').write_text(svg(420, 124, 'Surco', o))
print('ok')
