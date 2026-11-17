// Pruebas del ritmo en la lectura a primera vista (lógica pura y dibujo). Ejecutar: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['../notacion.js', '../metronomo.js', '../lectura.js']) vm.runInContext(await readFile(new URL(f, import.meta.url), 'utf8'), ctx);
const J = x => JSON.parse(JSON.stringify(x));
const L = ctx.Lectura, N = ctx.Notacion;
const semilla = s => () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
const azares = { semilla: semilla(5), cero: () => 0, casiUno: () => 0.999999, medio: () => 0.5 };

function revisar(f, op, estricto = true) {
  const T = { '4/4': 8, '3/4': 6 }[op.compas], nivel = L.NIVELES_RITMO.indexOf(op.ritmo);
  const ev = f.eventos; let t = 0;
  for (const e of ev) { assert.equal(e.t, t, 'las figuras van seguidas, sin huecos ni empalmes'); assert.ok([1, 2, 4].includes(e.d)); t += e.d; }
  assert.equal(t, T, `el compás ${op.compas} suma ${T} corcheas, no ${t}`);
  assert.ok(!ev[0].silencio, 'nunca empieza con silencio');
  const sonoras = ev.filter(e => !e.silencio);
  assert.ok(sonoras.length >= 2);
  assert.equal(f.notas.length, sonoras.length); assert.equal(f.midis.length, sonoras.length); assert.equal(f.texto.length, ev.length);
  for (const e of ev) {
    if (e.d === 4) assert.ok(op.compas === '3/4' ? e.t <= 2 : e.t % 4 === 0, 'blanca en un lugar válido: t=' + e.t);
    if (e.d === 2) assert.equal(e.t % 2, 0, 'la negra empieza en un tiempo');
    if (e.d === 1) { const par = ev.find(o => o !== e && o.d === 1 && Math.floor(o.t / 2) === Math.floor(e.t / 2)); assert.ok(par, 'la corchea tiene su pareja en el mismo tiempo'); }
  }
  if (nivel === 1) assert.ok(ev.every(e => !e.silencio && e.d >= 2), 'nivel negras: sin corcheas ni silencios');
  if (nivel === 2) { assert.ok(ev.every(e => !e.silencio)); assert.ok(ev.some(e => e.d === 1)); }
  if (nivel === 3) { assert.ok(ev.some(e => e.silencio)); assert.ok(ev.some(e => e.d === 1)); }
  const [lo, hi] = L.RANGO[f.clave];
  f.pos.forEach((p, k) => { assert.ok(p >= lo && p <= hi); assert.equal(N.posicion(f.clave, f.notas[k]), p); assert.equal(f.notas[k].a, 0); });
  if (estricto) assert.ok(new Set(f.pos).size >= Math.min(3, sonoras.length), 'notas distintas');   // con un azar de mentira (siempre igual) no puede haberlas
  assert.deepEqual(sonoras.map(e => e.pos), f.pos);
}

test('todas las combinaciones de nivel, compás, clave y movimiento dan compases completos y válidos (con 4 clases de azar)', () => {
  for (const [nombre, az] of Object.entries(azares)) for (const ritmo of ['negras', 'corcheas', 'silencios']) for (const compas of ['4/4', '3/4'])
    for (const clave of ['sol', 'fa', 'ambas']) for (const movimiento of ['grados', 'saltos']) for (let i = 0; i < (nombre === 'semilla' ? 120 : 3); i++) {
      const op = { ritmo, compas, clave, movimiento };
      try { revisar(J(L.crearFraseRitmica(op, az)), op, nombre === 'semilla'); } catch (e) { e.message = `${nombre} ${JSON.stringify(op)}: ${e.message}`; throw e; }
    }
});

test('cada nivel muestra de verdad lo suyo: variedad de figuras en 4/4 y en 3/4', () => {
  for (const compas of ['4/4', '3/4']) {
    const az = semilla(11), visto = { negras: new Set(), corcheas: new Set(), silencios: new Set() };
    for (const ritmo of Object.keys(visto)) for (let i = 0; i < 300; i++) L.crearRitmo({ ritmo, compas }, az).forEach(e => visto[ritmo].add((e.silencio ? 's' : '') + e.d));
    assert.deepEqual([...visto.negras].sort(), ['2', '4']);
    assert.deepEqual([...visto.corcheas].sort(), ['1', '2', '4']);
    assert.deepEqual([...visto.silencios].sort(), ['1', '2', '4', 's1', 's2', 's4']);
  }
});

test('datos raros en las opciones no rompen: compás o ritmo desconocidos usan 4/4 y negras', () => {
  for (const op of [{}, { compas: '7/8', ritmo: 'xx' }, { compas: null, ritmo: 'largas' }, { ritmo: 3 }]) {
    const f = J(L.crearFraseRitmica(op, semilla(1))); assert.equal(f.compas, '4/4');
    assert.equal(f.eventos.reduce((s, e) => s + e.d, 0), 8);
  }
});

test('limpiarRitmo: lo dañado o de versiones viejas vuelve a lo normal y lo bueno se conserva', () => {
  const normal = { ritmo: 'largas', compas: '4/4', tempo: 70, cuenta: true };
  for (const raro of [null, undefined, 5, 'texto', [], [1, 2], true, {}, { ritmo: 7, compas: {}, tempo: 'x', cuenta: 'si' }]) assert.deepEqual(J(L.limpiarRitmo(raro)), normal, JSON.stringify(raro));
  assert.deepEqual(J(L.limpiarRitmo({ ritmo: 'silencios', compas: '3/4', tempo: 95, cuenta: false, extra: 1 })), { ritmo: 'silencios', compas: '3/4', tempo: 95, cuenta: false });
  assert.equal(L.limpiarRitmo({ tempo: 9000 }).tempo, 120); assert.equal(L.limpiarRitmo({ tempo: 3 }).tempo, 50);
});

test('crearFrase (notas largas) sigue igual: 4 notas', () => {
  const f = J(L.crearFrase({ clave: 'sol', movimiento: 'grados' }, semilla(2))); assert.equal(f.notas.length, 4); assert.equal(f.eventos, undefined);
});

test('svgRitmo: sin salirse del dibujo, con tantos números de tiempo como el compás y un compás completo de figuras', () => {
  for (const compas of ['4/4', '3/4']) for (const ritmo of ['negras', 'corcheas', 'silencios']) for (const clave of ['sol', 'fa']) for (let i = 0; i < 100; i++) {
    const f = L.crearFraseRitmica({ ritmo, compas, clave, movimiento: 'saltos' }, Math.random), s = L.svgRitmo(clave, f);
    assert.equal(s.split('class="rc-n"').length - 1, compas === '4/4' ? 4 : 3);
    assert.ok(s.includes('viewBox="0 0 260 158"')); assert.ok(s.includes(`>${compas.split('/')[0]}<`));
    assert.equal(s.split('<ellipse').length - 1, f.notas.length, 'una cabeza por nota sonora');
    for (const m of s.matchAll(/ (?:cx|x1|x2|x)="(-?[\d.]+)"/g)) assert.ok(Number(m[1]) > 0 && Number(m[1]) < 260, 'x fuera: ' + m[1]);
    for (const m of s.matchAll(/ (?:cy|y1|y2|y)="(-?[\d.]+)"/g)) assert.ok(Number(m[1]) > 0 && Number(m[1]) < 158, 'y fuera: ' + m[1]);
    assert.ok(!/NaN|undefined/.test(s));
  }
  const f = { clave: 'sol', compas: '4/4', eventos: [{ t: 0, d: 4, silencio: false, pos: 4 }, { t: 4, d: 4, silencio: true }], notas: [1], midis: [1] };
  const s = L.svgRitmo('sol', f); assert.ok(s.includes('<rect'), 'silencio de blanca'); assert.ok(s.includes('fill="none" stroke="currentColor" stroke-width="2"'), 'blanca hueca');
});
