// Pruebas de timer.js (puente con TimerPiano: leer el enlace, sumar sin repetir, resumen y racha). Ejecutar: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(await readFile(new URL('../timer.js', import.meta.url), 'utf8'), ctx);
const J = x => JSON.parse(JSON.stringify(x));
const T = ctx.RepertorioTimer;
const HOY = '2026-11-13';

test('leerHash: acepta lo bien formado y rechaza lo raro', () => {
  assert.deepEqual(J(T.leerHash('#timer=abc123def456.2026-11-13.300-120-0-60', HOY)), { id: 'abc123def456', f: '2026-11-13', d: [300, 120, 0, 60] });
  assert.ok(T.leerHash('#timer=abc123def456.2026-11-14.60-0-0-0', HOY), 'mañana se acepta (por la zona horaria)');
  for (const malo of [
    '', '#plan=solfeo-5', '#timer=', '#timer=abc.2026-11-13.1-1-1-1',                       // vacío, otro enlace, id corto
    '#timer=ABC123DEF456.2026-11-13.1-1-1-1', '#timer=abc123def456.2026-13-40.1-1-1-1',     // mayúsculas, fecha imposible
    '#timer=abc123def456.2026-02-30.1-1-1-1', '#timer=abc123def456.2026-11-20.60-0-0-0',    // 30 de febrero, fecha futura
    '#timer=abc123def456.2026-11-13.0-0-0-0', '#timer=abc123def456.2026-11-13.1-1-1',       // sin tiempo, faltan áreas
    '#timer=abc123def456.2026-11-13.99999-0-0-0', '#timer=abc123def456.2026-11-13.14401-0-0-0',  // cifras absurdas
    '#timer=abc123def456.2026-11-13.-5-1-1-1', '#timer=abc123def456.2026-11-13.1-1-1-1&x=1',
    '#timer=abc123def456.2026-11-13.14400-14400-14400-1', null, undefined,
  ]) assert.equal(T.leerHash(malo, HOY), null, String(malo));
});

test('agregar: suma una vez, no repite el mismo id y deja todo ordenado por fecha', () => {
  let est = { v: 1, ses: [] };
  let r = T.agregar(est, { id: 'aaaaaaaa1111', f: '2026-11-12', d: [60, 0, 0, 0] }); assert.equal(r.nuevo, true); est = r.est;
  r = T.agregar(est, { id: 'bbbbbbbb2222', f: '2026-11-10', d: [0, 60, 0, 0] }); est = r.est;
  r = T.agregar(est, { id: 'aaaaaaaa1111', f: '2026-11-12', d: [999, 0, 0, 0] });
  assert.equal(r.nuevo, false, 'el mismo id no se repite aunque cambien los números'); est = r.est;
  assert.deepEqual(J(est).ses.map(s => s.id), ['bbbbbbbb2222', 'aaaaaaaa1111']);
  assert.equal(J(est).ses[1].d[0], 60, 'se queda lo primero que llegó');
  for (let i = 0; i < 450; i++) est = T.agregar(est, { id: 'x' + String(i).padStart(8, '0'), f: '2026-11-13', d: [1, 0, 0, 0] }).est;
  assert.equal(est.ses.length, 400, 'guarda como máximo 400 sesiones');
});

test('limpiar: lo guardado que no cuadra se descarta sin romper nada', () => {
  assert.deepEqual(J(T.limpiar(null)), { v: 1, ses: [] }); assert.deepEqual(J(T.limpiar('x')), { v: 1, ses: [] });
  const sucio = { ses: [{ id: 'aaaaaaaa1111', f: '2026-11-12', d: [1, 2, 3, 4] }, { id: 'MAL', f: '2026-11-12', d: [1, 2, 3, 4] }, { id: 'cccccccc3333', f: 'ayer', d: [1, 2, 3, 4] },
    { id: 'dddddddd4444', f: '2026-11-12', d: [1, 2, 3] }, { id: 'eeeeeeee5555', f: '2026-11-12', d: [1, 2, 3, -4] }, { id: 'ffffffff6666', f: '2026-11-12', d: [1.5, 2, 3, 4] }, null, 7] };
  assert.deepEqual(J(T.limpiar(sucio)).ses.map(s => s.id), ['aaaaaaaa1111']);
});

test('resumen: hoy, últimos 7 días, por área y racha', () => {
  const s = (id, f, d) => ({ id, f, d });
  const est = { v: 1, ses: [s('aaaaaaaa0001', '2026-11-13', [300, 0, 120, 0]), s('aaaaaaaa0002', '2026-11-13', [0, 60, 0, 0]),
    s('aaaaaaaa0003', '2026-11-12', [600, 0, 0, 0]), s('aaaaaaaa0004', '2026-11-11', [0, 0, 0, 90]),
    s('aaaaaaaa0005', '2026-11-07', [0, 0, 100, 0]), s('aaaaaaaa0006', '2026-11-06', [999, 999, 999, 999])] };
  const r = J(T.resumen(est, HOY));
  assert.equal(r.hoy, 480); assert.equal(r.semana, 480 + 600 + 90 + 100, 'del 7 al 13: el 6 ya no cuenta');
  assert.deepEqual(r.areas, { solfeo: 900, hanon: 60, oido: 220, thompson: 90 });
  assert.equal(r.racha, 3, '13, 12 y 11 (el 10 no hubo)'); assert.equal(r.registros, 6);
  // hoy sin llegar a 1 minuto: la racha cuenta desde ayer
  assert.equal(T.resumen({ ses: [s('aaaaaaaa0001', '2026-11-13', [30, 0, 0, 0]), s('aaaaaaaa0002', '2026-11-12', [60, 0, 0, 0])] }, HOY).racha, 1);
  assert.equal(T.resumen({ ses: [] }, HOY).racha, 0); assert.equal(T.resumen(null, HOY).registros, 0);
  // los días se suman: dos sesiones de 30 s el mismo día valen 1 minuto
  assert.equal(T.resumen({ ses: [s('aaaaaaaa0001', '2026-11-13', [30, 0, 0, 0]), s('aaaaaaaa0002', '2026-11-13', [0, 30, 0, 0])] }, HOY).racha, 1);
  // cruce de mes y de año
  assert.equal(T.resumen({ ses: [s('aaaaaaaa0001', '2027-01-01', [60, 0, 0, 0]), s('aaaaaaaa0002', '2026-12-31', [60, 0, 0, 0]), s('aaaaaaaa0003', '2026-12-30', [60, 0, 0, 0])] }, '2027-01-01').racha, 3);
});

test('enlace hacia TimerPiano: plan sugerido con minutos de 5 en 5, solo áreas válidas', () => {
  assert.equal(T.enlace(), 'https://zaenlly1.vercel.app/#plan=solfeo-5,oido-5');
  assert.equal(T.enlace({ hanon: 10 }), 'https://zaenlly1.vercel.app/#plan=hanon-10');
  assert.ok(Object.values(T.PLAN).every(m => m % 5 === 0 && m >= 0 && m <= 120) && Object.keys(T.PLAN).every(a => T.AREAS.includes(a)));
  assert.equal(T.minutos(480), 8); assert.equal(T.minutos(29), 0); assert.equal(T.minutos(30), 1);
});
