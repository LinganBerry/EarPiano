// Pruebas de datos-local.js (canciones en este dispositivo). Ejecutar: npm test
import test from 'node:test';
import assert from 'node:assert/strict';

const almacen = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
globalThis.localStorage = almacen(); globalThis.sessionStorage = almacen();
await import('../local.js');
await import('../datos-local.js');
const D = globalThis.RepertorioDatos;
const cancion = (extra = {}) => ({ titulo: 'Gracia', artista: 'Ana', tono: 'G', partes: [{ prog: 'G | C | D' }], ...extra });

test('vacío al inicio', () => assert.deepEqual(D.leer().canciones, []));

test('guardar: crea con id, la lista la muestra y editar no duplica', () => {
  const r = D.aplicar({ accion: 'guardar', cancion: cancion() });
  assert.ok(r.ok); const id = r.j.cancion.id; assert.match(id, /^[A-Za-z0-9_-]{1,40}$/);
  assert.equal(D.leer().canciones.length, 1);
  assert.ok(D.aplicar({ accion: 'guardar', cancion: cancion({ id, titulo: 'Gracia 2' }) }).ok);
  assert.equal(D.leer().canciones.length, 1); assert.equal(D.leer().canciones[0].titulo, 'Gracia 2');
});

test('guardar: sin título o con tono inválido se rechaza', () => {
  assert.equal(D.aplicar({ accion: 'guardar', cancion: cancion({ titulo: '' }) }).status, 400);
  assert.equal(D.aplicar({ accion: 'guardar', cancion: cancion({ tono: 'H' }) }).status, 400);
});

test('borrar va a la papelera y restaurar la devuelve', () => {
  const id = D.leer().canciones[0].id;
  assert.ok(D.aplicar({ accion: 'borrar', id }).ok);
  assert.equal(D.leer().canciones.length, 0);
  assert.equal(D.aplicar({ accion: 'papelera' }).j.canciones.length, 1);
  assert.ok(D.aplicar({ accion: 'restaurar', id }).ok);
  assert.equal(D.leer().canciones.length, 1);
});

test('importar: simular no escribe, importar suma y no quita', () => {
  const copia = [cancion({ titulo: 'Nueva', artista: 'Luis' }), cancion({ titulo: '' })];
  const sim = D.aplicar({ accion: 'importar', canciones: copia, simular: true });
  assert.deepEqual([sim.j.nuevas, sim.j.omitidas], [1, 1]); assert.equal(D.leer().canciones.length, 1);
  assert.ok(D.aplicar({ accion: 'importar', canciones: copia }).ok); assert.equal(D.leer().canciones.length, 2);
  assert.equal(D.aplicar({ accion: 'importar', canciones: copia }).j.iguales, 1);
});

test('ajustes, acción desconocida y sin espacio', () => {
  D.aplicar({ accion: 'ajustes', nombre: 'Mi repertorio', intro: 'hola' });
  assert.equal(D.leer().nombre, 'Mi repertorio');
  assert.equal(D.aplicar({ accion: 'nada' }).status, 400);
  const real = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null, setItem() { throw new Error('lleno'); } };
  assert.equal(D.aplicar({ accion: 'guardar', cancion: cancion({ titulo: 'X' }) }).status, 507);
  globalThis.localStorage = real;
});
