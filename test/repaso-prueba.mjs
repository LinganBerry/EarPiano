// Pruebas de repaso.js (repetición espaciada). Ejecutar: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
await import('../repaso.js');
const R = globalThis.Repaso;
const ses = (f, ...q) => ({ f, q: q.map(([i, ok]) => [i, ok ? 1 : 0, 1000]) });

test('un fallo ayer: toca hoy (atraso 0) y aparece en pendientes', () => {
  const r = R.calcular([ses('2026-11-25', ['ac:C', 0])], '2026-11-26');
  assert.equal(r['ac:C'].intervalo, 1); assert.equal(r['ac:C'].vence, '2026-11-26'); assert.equal(r['ac:C'].atraso, 0);
  assert.deepEqual(R.pendientes(r).map(x => x[0]), ['ac:C']);
});

test('un fallo hoy mismo: toca mañana, todavía no', () => {
  const r = R.calcular([ses('2026-11-26', ['ac:C', 0])], '2026-11-26');
  assert.equal(r['ac:C'].atraso, -1); assert.deepEqual(R.pendientes(r), []);
});

test('lo acertado hoy no vuelve hoy, y los aciertos seguidos espacian 1, 3 y más días', () => {
  const dias = ['2026-11-01', '2026-11-02', '2026-11-04', '2026-11-08'];
  const r = R.calcular([ses(dias[0], ['ac:D', 0]), ...dias.slice(1).map(f => ses(f, ['ac:D', 1]))], '2026-11-08');
  assert.equal(r['ac:D'].racha, 3); assert.ok(r['ac:D'].intervalo >= 5, 'tercer acierto seguido: intervalo largo');
  assert.ok(r['ac:D'].atraso < 0, 'acertado hoy: no toca hoy');
  const t = [1, 2, 3, 4, 5].map(k => R.calcular([ses('2026-01-01', ['x', 0]), ...Array.from({ length: k }, (_, j) => ses('2026-01-0' + (j + 2), ['x', 1]))], '2026-01-09').x.intervalo);
  assert.deepEqual(t, [...t].sort((a, b) => a - b), 'el intervalo nunca baja mientras acierta'); assert.equal(t[0], 1); assert.equal(t[1], 3);
});

test('un error viejo ya dominado deja de molestar... hasta que se acerca a olvidarse', () => {
  const hist = [ses('2026-09-01', ['ac:E', 0]), ses('2026-09-02', ['ac:E', 1]), ses('2026-09-05', ['ac:E', 1]), ses('2026-09-13', ['ac:E', 1]), ses('2026-10-03', ['ac:E', 1])];
  const antes = R.calcular(hist, '2026-10-10');
  assert.ok(antes['ac:E'].atraso < 0, 'aún le faltan días: ' + JSON.stringify(antes['ac:E'])); assert.deepEqual(R.pendientes(antes), []);
  const despues = R.calcular(hist, '2026-11-01');
  assert.ok(despues['ac:E'].atraso > 0, 'pasó su fecha: toca repasarlo antes de olvidarlo'); assert.deepEqual(R.pendientes(despues).map(x => x[0]), ['ac:E']);
});

test('varias respuestas el mismo día: un solo fallo cuenta el día como fallo', () => {
  const r = R.calcular([ses('2026-11-24', ['ac:F', 1], ['ac:F', 0], ['ac:F', 1])], '2026-11-26');
  assert.equal(r['ac:F'].fallos, 1); assert.equal(r['ac:F'].vistas, 3); assert.equal(r['ac:F'].racha, 0);
});

test('lo que nunca fallaste no sale en pendientes; el orden es por atraso y luego por dificultad; entradas raras no rompen', () => {
  const r = R.calcular([
    ses('2026-11-10', ['a', 1]), ses('2026-11-20', ['viejo', 0]), ses('2026-11-24', ['reciente', 0]),
    null, { f: 5 }, { f: '2026-11-20', q: 'x' }, { f: '2026-11-20', q: [null, [7], ['z']] }
  ], '2026-11-26');
  const p = R.pendientes(r).map(x => x[0]);
  assert.ok(!p.includes('a'), 'nunca fallado: fuera'); assert.equal(p[0], 'viejo'); assert.ok(p.includes('reciente'));
  assert.deepEqual(R.pendientes(r, { max: 1 }).length, 1);
  assert.deepEqual(R.pendientes(r, { filtro: k => k === 'reciente' }).map(x => x[0]), ['reciente']);
});
