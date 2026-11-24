// Las canciones de ejemplo (ejemplos/canciones-ejemplo.json) deben poder importarse tal cual: válidas, con id, sin acordes raros ni compases vacíos.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { limpiarCancion, guardable, idValido } from '../lib/limpiar.js';

const d = JSON.parse(readFileSync(new URL('../ejemplos/canciones-ejemplo.json', import.meta.url), 'utf8'));
const ACORDE = /^(?:maj|min|dim|aug|sus|add|alt|M|m|o|ø|°|\+|-|\d|[#♯b♭]|[(),]|\/[A-G][#♯b♭]*|\/)*$/;   // la misma que editor.js
assert.ok(d.canciones.length >= 3, 'faltan canciones de ejemplo');
const ids = new Set();
for (const c of d.canciones) {
  const l = limpiarCancion(c);
  assert.ok(guardable(l), c.titulo + ': sin título o tono válido');
  assert.ok(idValido(c.id) && !ids.has(c.id), c.titulo + ': id inválido o repetido'); ids.add(c.id);
  assert.equal(l.partes.length, c.partes.length, c.titulo + ': una parte se perdió al limpiar');
  assert.equal(l.nota, c.nota, c.titulo + ': la nota se recortó');
  for (const p of c.partes) {
    assert.ok(!p.prog.split('|').some(g => !g.trim()), c.titulo + ' / ' + p.nombre + ': compás vacío');
    const raros = p.prog.split(/[\s|]+/).flatMap(t => t.split(/-(?=[A-G])/)).filter(t => t && t !== '-').filter(t => { const r = /^[A-G][#♯b♭]*/.exec(t); return !r || !ACORDE.test(t.slice(r[0].length)); });
    assert.deepEqual(raros, [], c.titulo + ' / ' + p.nombre + ': acorde no reconocido');
  }
}
console.log('ejemplos: ' + d.canciones.length + ' canciones de ejemplo válidas');
