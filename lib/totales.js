// Totales de TimerPiano (timerpiano/totales.json, en el mismo almacén de Vercel Blob): un resumen chico que TimerPiano deja al día cada vez
// que sube una sesión. EarPiano solo lee este archivo (no recorre ni suma todas las sesiones). Aquí se revisa lo leído antes de entregarlo:
// lo que no cuadra se descarta. Mismo formato que lib/server/totales.ts de TimerPiano (test/contrato-puente.json lo comprueba en las dos).
export const RUTA_TOTALES = 'timerpiano/totales.json';
const MAX_DIAS = 400, MAX_SEG_DIA_AREA = 86400;
const fechaValida = f => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f) && new Date(f + 'T00:00:00Z').toISOString().slice(0, 10) === f;
const entero = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;

// -> { version: 1, actualizado, sesiones, segundos, areas: [s,h,o,t], dias: { f: [s,h,o,t] } } o null si no es de fiar
export function limpiarTotales(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x) || x.version !== 1) return null;
  const dias = {};
  const entradas = x.dias && typeof x.dias === 'object' && !Array.isArray(x.dias) ? Object.entries(x.dias) : [];
  for (const [f, d] of entradas.slice(0, MAX_DIAS)) {
    if (fechaValida(f) && Array.isArray(d) && d.length === 4 && d.every(n => entero(n, MAX_SEG_DIA_AREA))) dias[f] = d.slice();
  }
  const areas = Array.isArray(x.areas) && x.areas.length === 4 && x.areas.every(n => entero(n, 1e9)) ? x.areas.slice() : [0, 0, 0, 0];
  return {
    version: 1,
    actualizado: Number.isFinite(x.actualizado) ? x.actualizado : 0,
    sesiones: entero(x.sesiones, 1e6) ? x.sesiones : 0,
    segundos: entero(x.segundos, 4e9) ? x.segundos : areas.reduce((a, b) => a + b, 0),
    areas, dias
  };
}
