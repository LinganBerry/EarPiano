// El puente con TimerPiano, de este lado: lo que manda TimerPiano lo entiende esta app, y lo que esta app le manda lo entiende TimerPiano.
// Usa test/contrato-puente.json, que es el MISMO archivo en las dos apps (TimerPiano lo prueba por su lado). Ejecutar: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const contrato = JSON.parse(await readFile(new URL('./contrato-puente.json', import.meta.url), 'utf8'));
const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(await readFile(new URL('../timer.js', import.meta.url), 'utf8'), ctx);
const T = ctx.RepertorioTimer;
const J = x => JSON.parse(JSON.stringify(x));

test('puente: las áreas y los sitios coinciden con el contrato', () => {
  assert.deepEqual(J(T.AREAS), contrato.areas, 'el orden de las áreas es el del enlace');
  assert.equal(T.URL_TIMER, contrato.sitios.timerpiano);
});

test('puente: cada enlace del contrato se acepta o se rechaza como dice (la fecha de hoy es la del contrato)', () => {
  for (const c of contrato.timer_a_repertorio) {
    const url = new URL(c.enlace), r = T.leerHash(url.hash, contrato.hoy);
    assert.equal(url.origin + '/', contrato.sitios.repertorio, c.caso + ': va a esta app');
    if (!c.valido) { assert.equal(r, null, c.caso); continue; }
    assert.ok(r, c.caso);
    assert.deepEqual(J(r), { id: c.id, f: c.f, d: contrato.areas.map(a => c.d[a]) }, c.caso);
  }
});

test('puente: una sesión que llega se suma una vez y se ve en el resumen', () => {
  for (const c of contrato.timer_a_repertorio.filter(x => x.valido && x.f <= contrato.hoy)) {
    const reg = T.leerHash(new URL(c.enlace).hash, contrato.hoy);
    const a = T.agregar(null, reg), b = T.agregar(a.est, reg);
    assert.equal(a.nuevo, true, c.caso); assert.equal(b.nuevo, false, c.caso + ': el mismo id no entra dos veces');
    const total = contrato.areas.reduce((s, x) => s + c.d[x], 0), res = T.resumen(a.est, c.f);
    assert.equal(res.hoy, total, c.caso);
    assert.deepEqual(J(res.areas), c.d, c.caso + ': por área');
  }
});

test('puente: el enlace que esta app le manda a TimerPiano es el del contrato', () => {
  for (const c of contrato.repertorio_a_timer) assert.equal(T.enlace(c.plan), c.enlace, c.caso);
  assert.equal(T.enlace(), contrato.repertorio_a_timer[0].enlace, 'el plan normal');
});
