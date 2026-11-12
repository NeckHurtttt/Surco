// Catálogo de cultivos para la llanura cruceña (Bolivia).
// Valores agronómicos aproximados a partir de FAO-56 (Kc, p, raíz), FAO-33 (Ky)
// y referencias regionales. Precios, costos y rendimientos son de REFERENCIA y editables.
//
// season: 'verano' (siembra oct-dic) | 'invierno' (siembra feb-jul) | 'cobertura'
// days: ciclo siembra→cosecha
// kc: [ini, mid, end]; stages: fracciones del ciclo [ini, des, med, fin]
// root: profundidad efectiva de raíz (m); p: fracción de agua fácilmente aprovechable
// ky: factor de respuesta del rendimiento al agua (FAO-33)
// heat: Tmax (°C) que daña en floración/llenado; frost: Tmin (°C) que daña después de emerger
// hosts: grupos de plagas/enfermedades que hospeda (para cortar ciclos)
// residue: rastrojo (t/ha con rendimiento normal); cover0: cobertura inicial del rastrojo; decay: pérdida diaria
// n: balance neto aproximado de N (kg/ha): + aporta, − demanda/exporta
// yield: rendimiento en un año sin estrés (t/ha), calibrado para que el promedio simulado 2001-2024
//        en Montero/Okinawa/Pailón se parezca al promedio regional; price (USD/t), cost (USD/ha)
// sow: fechas de siembra candidatas 'MM-DD'

export const CROPS = {
  soya: {
    name: { es: 'Soya de verano', en: 'Summer soybean' }, short: { es: 'Soya', en: 'Soy' },
    family: 'legumbre', season: 'verano', color: '#7cb342', days: 120,
    kc: [0.4, 1.15, 0.5], stages: [0.15, 0.2, 0.45, 0.2], root: 1.0, p: 0.5, ky: 0.85,
    heat: 36, frost: 2, hosts: ['roya', 'chinches', 'nematodos', 'esclerotinia', 'mancha_legum'],
    residue: 2.5, cover0: 0.45, decay: 0.015, n: 15,
    yield: 2.8, price: 380, cost: 470, sow: ['10-25', '11-15', '12-05'],
  },
  soya_inv: {
    name: { es: 'Soya de invierno', en: 'Winter soybean' }, short: { es: 'Soya inv.', en: 'W. soy' },
    family: 'legumbre', season: 'invierno', color: '#9ccc65', days: 105,
    kc: [0.4, 1.1, 0.5], stages: [0.15, 0.2, 0.45, 0.2], root: 1.0, p: 0.5, ky: 0.85,
    heat: 36, frost: 2, hosts: ['roya', 'chinches', 'nematodos', 'esclerotinia', 'mancha_legum'],
    residue: 2.0, cover0: 0.4, decay: 0.015, n: 10,
    yield: 2.8, price: 380, cost: 430, sow: ['05-15', '06-05'],
  },
  maiz: {
    name: { es: 'Maíz de verano', en: 'Summer maize' }, short: { es: 'Maíz', en: 'Maize' },
    family: 'gramínea', season: 'verano', color: '#fbc02d', days: 130,
    kc: [0.3, 1.2, 0.6], stages: [0.17, 0.28, 0.33, 0.22], root: 1.2, p: 0.55, ky: 1.25,
    heat: 35, frost: 2, hosts: ['cogollero', 'chicharrita', 'fusarium', 'hongos_gram'],
    residue: 7, cover0: 0.9, decay: 0.006, n: -110,
    yield: 6.7, price: 190, cost: 640, sow: ['10-01', '11-01'],
  },
  maiz_inv: {
    name: { es: 'Maíz de invierno', en: 'Winter maize' }, short: { es: 'Maíz inv.', en: 'W. maize' },
    family: 'gramínea', season: 'invierno', color: '#f9a825', days: 125,
    kc: [0.3, 1.15, 0.6], stages: [0.17, 0.28, 0.33, 0.22], root: 1.2, p: 0.55, ky: 1.25,
    heat: 35, frost: 2, hosts: ['cogollero', 'chicharrita', 'fusarium', 'hongos_gram'],
    residue: 6, cover0: 0.85, decay: 0.006, n: -90,
    yield: 4.8, price: 190, cost: 560, sow: ['02-15', '03-10'],
  },
  sorgo: {
    name: { es: 'Sorgo grano', en: 'Grain sorghum' }, short: { es: 'Sorgo', en: 'Sorghum' },
    family: 'gramínea', season: 'invierno', color: '#d84315', days: 115,
    kc: [0.4, 1.0, 0.55], stages: [0.17, 0.28, 0.33, 0.22], root: 1.4, p: 0.55, ky: 0.9,
    heat: 38, frost: 3, hosts: ['cogollero', 'pulgon', 'hongos_gram'],
    residue: 6, cover0: 0.85, decay: 0.006, n: -70,
    yield: 3.4, price: 170, cost: 330, sow: ['02-25', '03-25'],
  },
  trigo: {
    name: { es: 'Trigo', en: 'Wheat' }, short: { es: 'Trigo', en: 'Wheat' },
    family: 'gramínea', season: 'invierno', color: '#c8a165', days: 110,
    kc: [0.4, 1.15, 0.3], stages: [0.15, 0.25, 0.4, 0.2], root: 1.2, p: 0.55, ky: 1.05,
    heat: 34, frost: -1, hosts: ['pulgon', 'fusarium', 'hongos_gram'],
    residue: 3.5, cover0: 0.8, decay: 0.007, n: -60,
    yield: 2.3, price: 270, cost: 380, sow: ['04-15', '05-10'],
  },
  girasol: {
    name: { es: 'Girasol', en: 'Sunflower' }, short: { es: 'Girasol', en: 'Sunflower' },
    family: 'compuesta', season: 'invierno', color: '#ffb300', days: 110,
    kc: [0.35, 1.0, 0.35], stages: [0.2, 0.28, 0.36, 0.16], root: 1.4, p: 0.45, ky: 0.95,
    heat: 36, frost: 0, hosts: ['esclerotinia', 'chinches', 'alternaria'],
    residue: 3, cover0: 0.4, decay: 0.012, n: -40,
    yield: 1.7, price: 400, cost: 350, sow: ['03-01', '03-25', '04-15'],
  },
  chia: {
    name: { es: 'Chía', en: 'Chia' }, short: { es: 'Chía', en: 'Chia' },
    family: 'labiada', season: 'invierno', color: '#8d6e63', days: 130,
    kc: [0.35, 1.0, 0.4], stages: [0.2, 0.3, 0.35, 0.15], root: 0.8, p: 0.5, ky: 0.9,
    heat: 35, frost: 3, hosts: ['mosca_blanca', 'hongos_chia'],
    residue: 2, cover0: 0.35, decay: 0.012, n: -30,
    yield: 0.65, price: 1000, cost: 300, sow: ['02-25', '03-20'],
  },
  frejol: {
    name: { es: 'Frejol', en: 'Common bean' }, short: { es: 'Frejol', en: 'Bean' },
    family: 'legumbre', season: 'invierno', color: '#6d4c41', days: 90,
    kc: [0.4, 1.15, 0.35], stages: [0.2, 0.3, 0.35, 0.15], root: 0.7, p: 0.45, ky: 1.15,
    heat: 32, frost: 2, hosts: ['chinches', 'mosca_blanca', 'mancha_legum', 'esclerotinia'],
    residue: 1.5, cover0: 0.3, decay: 0.015, n: 10,
    yield: 1.7, price: 650, cost: 420, sow: ['04-10', '05-01'],
  },
  arroz: {
    name: { es: 'Arroz de secano', en: 'Upland rice' }, short: { es: 'Arroz', en: 'Rice' },
    family: 'gramínea', season: 'verano', color: '#aed581', days: 125,
    kc: [0.7, 1.15, 0.8], stages: [0.17, 0.28, 0.35, 0.2], root: 0.6, p: 0.3, ky: 1.3,
    heat: 35, frost: 5, hosts: ['sogata', 'hongos_gram', 'pyricularia'],
    residue: 4, cover0: 0.75, decay: 0.008, n: -60,
    yield: 4.4, price: 300, cost: 600, sow: ['11-15', '12-10'],
  },
  // --- cultivos de cobertura (no se cosechan: llenan el hueco entre cosecha y siembra) ---
  crotalaria: {
    name: { es: 'Crotalaria (cobertura)', en: 'Crotalaria (cover)' }, short: { es: 'Crotalaria', en: 'Crotalaria' },
    family: 'legumbre', season: 'cobertura', color: '#26a69a', days: 0, minDays: 45, maxDays: 150,
    kc: [0.4, 1.0, 0.9], stages: [0.2, 0.3, 0.4, 0.1], root: 1.2, p: 0.5, ky: 0,
    heat: 40, frost: 2, hosts: [], nematicide: true,
    residue: 5, cover0: 0.9, decay: 0.008, n: 80,
    yield: 0, price: 0, cost: 70,
  },
  mijo: {
    name: { es: 'Mijo (cobertura)', en: 'Millet (cover)' }, short: { es: 'Mijo', en: 'Millet' },
    family: 'gramínea', season: 'cobertura', color: '#4db6ac', days: 0, minDays: 40, maxDays: 140,
    kc: [0.3, 1.0, 0.8], stages: [0.2, 0.3, 0.4, 0.1], root: 1.2, p: 0.55, ky: 0,
    heat: 42, frost: 3, hosts: ['cogollero'],
    residue: 6, cover0: 0.9, decay: 0.006, n: -10,
    yield: 0, price: 0, cost: 45,
  },
  braquiaria: {
    name: { es: 'Braquiaria (cobertura)', en: 'Brachiaria (cover)' }, short: { es: 'Braquiaria', en: 'Brachiaria' },
    family: 'gramínea', season: 'cobertura', color: '#00897b', days: 0, minDays: 60, maxDays: 220,
    kc: [0.5, 0.9, 0.9], stages: [0.2, 0.3, 0.4, 0.1], root: 1.5, p: 0.6, ky: 0,
    heat: 42, frost: 0, hosts: ['salivazo'],
    residue: 7, cover0: 0.95, decay: 0.005, n: -5,
    yield: 0, price: 0, cost: 55,
  },
};

export const HOST_NAMES = {
  roya: { es: 'roya asiática', en: 'Asian soybean rust' },
  chinches: { es: 'chinches', en: 'stink bugs' },
  nematodos: { es: 'nematodos', en: 'nematodes' },
  esclerotinia: { es: 'moho blanco (esclerotinia)', en: 'white mold' },
  mancha_legum: { es: 'manchas foliares de legumbres', en: 'legume leaf spots' },
  cogollero: { es: 'gusano cogollero', en: 'fall armyworm' },
  chicharrita: { es: 'chicharrita del maíz', en: 'corn leafhopper' },
  fusarium: { es: 'fusarium', en: 'fusarium' },
  hongos_gram: { es: 'hongos de gramíneas', en: 'grass fungi' },
  pulgon: { es: 'pulgón', en: 'aphids' },
  alternaria: { es: 'alternaria', en: 'alternaria' },
  mosca_blanca: { es: 'mosca blanca', en: 'whitefly' },
  hongos_chia: { es: 'hongos de chía', en: 'chia fungi' },
  sogata: { es: 'sogata', en: 'rice planthopper' },
  pyricularia: { es: 'pyricularia (quemado)', en: 'rice blast' },
  salivazo: { es: 'salivazo', en: 'spittlebug' },
};

export const SOILS = {
  arenoso: { name: { es: 'Arenoso', en: 'Sandy' }, awc: 80 },
  franco: { name: { es: 'Franco', en: 'Loam' }, awc: 150 },
  arcilloso: { name: { es: 'Arcilloso', en: 'Clay' }, awc: 180 },
};

export const LOCATIONS = [
  { id: 'montero', name: 'Montero', lat: -17.34, lon: -63.25, note: { es: 'Zona integrada norte', en: 'Northern integrated zone' } },
  { id: 'okinawa', name: 'Okinawa Uno', lat: -17.22, lon: -62.89, note: { es: 'Zona norte, soya y trigo', en: 'North, soy and wheat' } },
  { id: 'pailon', name: 'Pailón', lat: -17.66, lon: -62.72, note: { es: 'Zona este, expansión', en: 'Eastern expansion zone' } },
  { id: 'cabezas', name: 'Cabezas', lat: -18.79, lon: -63.40, note: { es: 'Zona sur, más seca', en: 'Southern, drier' } },
];

// Rotaciones típicas que el agricultor puede elegir como "la mía".
// Cada paso: { crop, sow:'MM-DD', year: 0|1 (campaña dentro del ciclo) }. Cobertura: { crop } sin fecha.
export const PRESETS = [
  { id: 'soya_soya', name: { es: 'Soya todo el año', en: 'Soy all year' }, years: 1,
    steps: [{ crop: 'soya', sow: '11-15' }, { crop: 'soya_inv', sow: '05-25' }] },
  { id: 'soya_barbecho', name: { es: 'Soya y barbecho', en: 'Soy + fallow' }, years: 1,
    steps: [{ crop: 'soya', sow: '11-15' }] },
  { id: 'soya_trigo', name: { es: 'Soya y trigo', en: 'Soy + wheat' }, years: 1,
    steps: [{ crop: 'soya', sow: '11-15' }, { crop: 'trigo', sow: '05-10' }] },
  { id: 'soya_girasol', name: { es: 'Soya y girasol', en: 'Soy + sunflower' }, years: 1,
    steps: [{ crop: 'soya', sow: '11-15' }, { crop: 'girasol', sow: '03-25' }] },
  { id: 'soya_sorgo', name: { es: 'Soya y sorgo', en: 'Soy + sorghum' }, years: 1,
    steps: [{ crop: 'soya', sow: '11-15' }, { crop: 'sorgo', sow: '03-25' }] },
  { id: 'soya_maiz', name: { es: 'Soya y maíz de invierno', en: 'Soy + winter maize' }, years: 1,
    steps: [{ crop: 'soya', sow: '10-25' }, { crop: 'maiz_inv', sow: '03-10' }] },
];
