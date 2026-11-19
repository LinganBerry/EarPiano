// Los totales de TimerPiano en EarPiano: lectura segura, resumen sin recorrer sesiones, servidor /api/timer y pase compartido. Ejecutar: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import './registrar.mjs';

process.env.ADMIN_PASSWORD = 'clave-de-prueba-larga-123';
const contrato = JSON.parse(await readFile(new URL('./contrato-puente.json', import.meta.url), 'utf8'));
process.env.SESSION_SECRET = contrato.pase.secreto;
const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(await readFile(new URL('../timer.js', import.meta.url), 'utf8'), ctx);
const T = ctx.RepertorioTimer, J = x => JSON.parse(JSON.stringify(x));
const { limpiarTotales, RUTA_TOTALES } = await import('../lib/totales.js');
const auth = await import('../lib/auth.js');
const { memoria } = await import('./blob-falso.mjs');
const timerApi = await import('../api/timer.js');
const { archivo, resumen, hoy } = contrato.totales;

test('el archivo de totales del contrato da el resumen esperado, sin recorrer sesiones', () => {
  assert.deepEqual(J(T.resumenDeTotales(archivo, hoy)), resumen);
});

test('y el resumen por sesiones (enlaces) da lo mismo para las mismas sesiones', () => {
  let est = null;
  for (const s of contrato.totales.sesiones) est = T.agregar(est, { id: s.id, f: s.f, d: ['solfeo', 'hanon', 'oido', 'thompson'].map(a => s.d[a]) }).est;
  assert.deepEqual(J(T.resumen(est, hoy)), resumen);
});

test('limpiarTotales (cliente y servidor): lo dañado se descarta y lo bueno se conserva', () => {
  for (const f of [limpiarTotales, T.limpiarTotales]) {
    for (const raro of [null, undefined, 5, 'x', [], {}, { version: 2 }, { version: '1' }]) assert.equal(f(raro), null, JSON.stringify(raro));
    const r = J(f({ version: 1, sesiones: -4, dias: { '2026-02-30': [1, 1, 1, 1], '2026-11-16': [1, 2, 3], '2026-11-15': [1, 2, 3, 99999999], '2026-11-14': [5, 0, 0, 0], malo: [1, 1, 1, 1] }, areas: 'x' }));
    assert.deepEqual(r.dias, { '2026-11-14': [5, 0, 0, 0] }); assert.equal(r.sesiones, 0);
    assert.deepEqual(J(f(archivo)).dias, archivo.dias);
    assert.deepEqual(J(f(J(f(archivo)))), J(f(archivo)), 'lo que se guarda se vuelve a leer igual (idempotente)');
    const muchos = Object.fromEntries(Array.from({ length: 900 }, (_, i) => [new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10), [60, 0, 0, 0]]));
    assert.ok(Object.keys(f({ version: 1, dias: muchos }).dias).length <= 400, 'límite de días');
  }
});

test('el pase es el mismo de TimerPiano: formato ep1, y un pase mal firmado o de otro secreto no sirve', () => {
  const { token } = auth.crearToken();
  assert.match(token, new RegExp(contrato.pase.formato)); assert.equal(auth.tokenValido(token), true);
  for (const malo of ['v3.9999999999999.' + 'a'.repeat(64), 'ep1.9999999999999.' + 'a'.repeat(64), 'ep1.1.' + 'a'.repeat(64), '', null, 5]) assert.equal(auth.tokenValido(malo), false, String(malo));
  const guardado = process.env.SESSION_SECRET; process.env.SESSION_SECRET = 'otro-secreto-distinto-bien-largo-0123456789';
  assert.equal(auth.tokenValido(token), false, 'con otro SESSION_SECRET el pase no vale'); process.env.SESSION_SECRET = guardado;
});

const llamar = cuerpo => timerApi.POST(new Request('http://x/api/timer', { method: 'POST', body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) }));
test('/api/timer: pide pase, lee solo el archivo de totales y no entrega basura', async () => {
  memoria.clear();
  assert.equal((await llamar({})).status, 401); assert.equal((await llamar({ token: 'x' })).status, 401);
  assert.equal((await llamar('no es json')).status, 400); assert.equal((await llamar('x'.repeat(3000))).status, 413);
  const { token } = auth.crearToken();
  assert.deepEqual(await (await llamar({ token })).json(), { vacio: true }, 'todavía no hay totales');
  memoria.set(RUTA_TOTALES, { texto: JSON.stringify(archivo), etag: '"t1"' });
  const r = await llamar({ token }); assert.equal(r.status, 200); assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual((await r.json()).dias, archivo.dias);
  memoria.set(RUTA_TOTALES, { texto: '{"version": 9, "dias": 3}', etag: '"t2"' });
  assert.deepEqual(await (await llamar({ token })).json(), { vacio: true }, 'un archivo raro se trata como vacío');
  memoria.set(RUTA_TOTALES, { texto: 'esto no es json', etag: '"t3"' });
  assert.equal((await llamar({ token })).status, 500, 'un archivo ilegible da error claro, sin romper');
});
