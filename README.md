<p align="center"><img src="assets/icon.svg" width="72" alt=""></p>

# Surco · rotaciones que se adaptan a tu clima

**NASA Space Apps Challenge 2026 · Field Shift** · Santa Cruz, Bolivia · [English below](#english)

Surco ayuda a un productor a responder una pregunta concreta: **¿qué rotación de cultivos me conviene ahora que el clima de mi lote cambió?**

1. **Tu lote:** tocas el mapa (o eliges una zona de ejemplo). La app descarga 25 años de datos diarios de **NASA POWER** para ese punto.
2. **¿Se movió tu temporada?** Calcula, año por año, cuándo empiezan y terminan las lluvias, cuántos días pasan de 35 °C, cuánto llueve en la temporada y cuánto duran los veranillos. Compara la primera mitad del período con la segunda y dice si la tendencia es clara o puede ser azar (r²).
3. **Tu rotación de hoy:** eliges una rotación típica (soya todo el año, soya y trigo, soya y barbecho…) o armas la tuya, de 1 o 2 años, con cultivos de cobertura. Puedes cambiar precios, rindes y costos.
4. **Compara:** simula **más de 4.000 rotaciones** con el clima real de **cada campaña desde 2001** y elige 3 alternativas distintas a la tuya: *mejor equilibrio*, *más segura* y *mejor para el suelo*. Para cada una muestra:
   - ganancia promedio y en un mal año (1 de cada 10), años con pérdida;
   - **períodos de suelo desnudo** y cuánta lluvia les cae encima (erosión);
   - **meses delicados** (sequía, calor, helada, lluvia fuerte) sobre el calendario;
   - **corte de ciclos de plagas** entre cultivos seguidos y el “puente verde” de la soya (roya asiática, chinches);
   - balance de nitrógeno y carbono que vuelve al suelo con el rastrojo;
   - por qué conviene, en palabras simples, y un historial de cómo le habría ido en cada campaña.
5. **Informe:** lo descargas en PDF o compartes un enlace con tu lote y tu rotación.

## Datos de la NASA que usa

| Variable | Parámetro NASA POWER | Para qué |
|---|---|---|
| Lluvia diaria corregida | `PRECTOTCORR` | inicio/fin de lluvias, veranillos, balance de agua |
| Temperatura máx./mín. a 2 m | `T2M_MAX`, `T2M_MIN` | calor en floración, heladas, ET0 |
| Radiación solar | `ALLSKY_SFC_SW_DWN` | evaporación de referencia (ET0) |
| Humedad del suelo superficial | `GWETTOP` | si se puede sembrar ese día |
| Humedad del suelo en raíces | `GWETROOT` | agua inicial del cultivo |

Fuente: [NASA POWER](https://power.larc.nasa.gov/) (NASA LaRC), comunidad agrícola (AG), resolución ~0,5°. La humedad del suelo viene del reanálisis [MERRA-2](https://gmao.gsfc.nasa.gov/reanalysis/MERRA-2/) de NASA GMAO. Los datos se piden en vivo a la API; las 4 zonas de ejemplo también vienen guardadas en `data/demo/` para que la app funcione sin internet.

## Modelo

- **ET0:** Hargreaves con la radiación medida por NASA.
- **Agua del cultivo:** coeficientes Kc por etapa (FAO-56) y balance diario del agua en la zona de raíces (FAO-56, cap. 8), con el agua disponible según el suelo (arenoso, franco o arcilloso).
- **Siembra:** si el suelo superficial está seco, la siembra espera hasta 25 días a que llueva.
- **Rendimiento:** respuesta al agua de FAO-33/66 (Ky), con más peso en floración. Castiga el calor en floración y las heladas.
- **Calibración:** el rendimiento sin estrés de cada cultivo se ajustó para que el promedio simulado en Montero, Okinawa y Pailón se parezca al promedio regional (`scripts/calib.mjs`).
- **Suelo:** cobertura diaria (cultivo vivo y rastrojo que se descompone), lluvia sobre suelo desnudo con la climatología de NASA, carbono del rastrojo, balance de N y similitud de plagas entre cultivos seguidos.

### Límites

Una celda de NASA POWER mide unos 50 km. El modelo no ve fertilización, variedades, plagas reales ni manejo. Sirve para **comparar opciones**, no para predecir una cosecha exacta. Los precios y costos son de referencia y se pueden editar.

## Usar

No necesita instalar nada: es HTML, CSS y JavaScript sin compilar.

```bash
python3 -m http.server 8000   # luego abre http://localhost:8000
npm test                      # 23 pruebas del motor (Node 20+)
npm run demo-data             # vuelve a bajar los datos demo de NASA POWER
```

Estructura: `js/core/` (motor: `power.js`, `agro.js`, `climate.js`, `rotation.js`), `js/data/crops.js` (cultivos, suelos, zonas, rotaciones típicas), `js/ui/charts.js` (gráficos SVG), `js/app.js` (interfaz), `tests/`.

---

## English

**Surco** (Spanish for *furrow*) helps a farmer answer one question: **which crop rotation should I use now that my field's climate has changed?**

Pick a field on the map → Surco downloads 25 years of daily **NASA POWER** data → shows how the rainy season, heat days and dry spells have shifted → simulates your current rotation plus 4,000+ alternatives in **every real season since 2001** → recommends 3 (best balance, safest, best for the soil) and compares them on profit, bad-year profit, **bare-field periods**, **vulnerable months**, **pest-cycle breaks**, nitrogen and residue carbon, with a plain-language explanation and a downloadable report. The interface is bilingual (ES/EN).

NASA data: `PRECTOTCORR`, `T2M_MAX`, `T2M_MIN`, `ALLSKY_SFC_SW_DWN`, `GWETTOP`, `GWETROOT` from the NASA POWER daily API (AG community, MERRA-2 based). Model: Hargreaves ET0 with NASA radiation, FAO-56 crop coefficients and daily root-zone water balance, FAO-33 yield response to water, heat and frost penalties.

Run: `python3 -m http.server 8000` and open `http://localhost:8000`. Tests: `npm test`.

## Licencia

MIT
