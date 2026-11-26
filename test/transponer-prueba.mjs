// Pruebas de transponer.js. Ejecutar: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
await import('../transponer.js');
const T = globalThis.Transponer;

test('acorde: sube con la calidad y el bajo, y elige sostenido o bemol según el tono', () => {
  assert.equal(T.acorde('G', 2, false), 'A');
  assert.equal(T.acorde('Em7', 1, false), 'Fm7');
  assert.equal(T.acorde('D/F#', 2, false), 'E/G#');
  assert.equal(T.acorde('D/F#', 1, true), 'Eb/G');
  assert.equal(T.acorde('Bb', 2, false), 'C');
  assert.equal(T.acorde('C#dim', 1, true), 'Ddim');
  assert.equal(T.acorde('Gmaj7', 12, false), 'Gmaj7');
  assert.equal(T.acorde('Hola', 2, false), 'Hola');
});

test('tono: nombres cómodos y el menor se queda menor', () => {
  assert.equal(T.tono('G', 3), 'Bb');
  assert.equal(T.tono('A', 1), 'Bb');
  assert.equal(T.tono('E', 2), 'F#');
  assert.equal(T.tono('Am', 3), 'Cm');
  assert.equal(T.tono('Em', 1), 'Fm');
  assert.equal(T.tono('C', -1), 'B');
  assert.equal(T.tono('', 2), '');
});

test('texto: transpone la progresión y respeta barras, repeticiones y guiones', () => {
  assert.equal(T.texto('G | C D | Em', 2, false), 'A | D E | F#m');
  assert.equal(T.texto('G-D | C x2', 2, false), 'A-E | D x2');
  assert.equal(T.texto('C | F | G7', 0, false), 'C | F | G7');
  assert.equal(T.texto('C | F | G7', 3, true), 'Eb | Ab | Bb7');
});

test('letra: solo cambia los acordes entre corchetes, no los títulos de sección', () => {
  assert.equal(T.letra('[Coro]\n[Am]Cuando [F]sol', 2, false), '[Coro]\n[Bm]Cuando [G]sol');
  assert.equal(T.letra('sin acordes', 2, false), 'sin acordes');
});

test('cancion: copia transpuesta sin tocar la original; ida y vuelta de 12 la deja igual', () => {
  const c = { titulo: 'X', tono: 'G', letra: '[G]a [D]b', partes: [{ nombre: 'A', tono: '', prog: 'G | C D' }, { nombre: 'B', tono: 'Em', prog: 'Em | C' }] };
  const t = T.cancion(c, 3);
  assert.equal(t.tono, 'Bb'); assert.equal(t.partes[0].prog, 'Bb | Eb F'); assert.equal(t.partes[1].tono, 'Gm'); assert.equal(t.letra, '[Bb]a [F]b');
  assert.equal(c.tono, 'G'); assert.equal(c.partes[0].prog, 'G | C D', 'la original no cambia');
  assert.equal(T.cancion(c, 0), c);
  assert.deepEqual(T.cancion(T.cancion(c, 5), -5), { ...c, tono: 'G', partes: [{ nombre: 'A', tono: '', prog: 'G | C D' }, { nombre: 'B', tono: 'Em', prog: 'Em | C' }], letra: '[G]a [D]b' });
});
