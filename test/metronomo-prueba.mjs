// Pruebas de metronomo.js con un reloj falso (sin audio ni esperas reales). Ejecutar: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const ctx = { console, performance }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(await readFile(new URL('../metronomo.js', import.meta.url), 'utf8'), ctx);
const M = ctx.Metronomo;

// Reloj falso: el tiempo solo avanza cuando la prueba lo manda; guarda cada clic programado.
function relojFalso() { const r = { t: 0, clics: [], sonido: true, ahora: () => r.t, clic: (t, a) => r.clics.push({ t, a }) }; return r; }
function armar(op = {}) {
  const reloj = relojFalso(), pulsos = [];
  const m = M.crear({ reloj, cada: () => () => {}, alPulso: p => pulsos.push(p), ...op });
  const avanzar = seg => { const fin = reloj.t + seg; while (reloj.t < fin - 1e-9) { reloj.t = Math.min(fin, reloj.t + 0.025); m.tick(); } };
  return { reloj, pulsos, m, avanzar };
}

test('limpiarTempo: entero entre 50 y 120; datos raros vuelven a 70', () => {
  assert.equal(M.limpiarTempo(80), 80); assert.equal(M.limpiarTempo('95'), 95); assert.equal(M.limpiarTempo(72.6), 73);
  assert.equal(M.limpiarTempo(10), 50); assert.equal(M.limpiarTempo(999), 120); assert.equal(M.limpiarTempo(-5), 50);
  for (const raro of [null, undefined, NaN, '', '   ', 'abc', {}, [], true, Infinity, -Infinity]) {
    const v = M.limpiarTempo(raro);
    assert.ok(Number.isInteger(v) && v >= 50 && v <= 120, String(raro) + ' → ' + v);
  }
  assert.equal(M.limpiarTempo(null), 70); assert.equal(M.limpiarTempo('abc'), 70);
});

test('el clic cae a la distancia exacta del tempo y el tiempo 1 lleva acento (4/4 a 60 y a 120)', () => {
  for (const tempo of [60, 120, 50]) {
    const { reloj, m, avanzar } = armar({ tempo, tiempos: 4, cuenta: false });
    m.iniciar(); avanzar(10);
    const dt = 60 / tempo;
    assert.ok(reloj.clics.length >= 4);
    reloj.clics.forEach((c, i) => {
      if (i) assert.ok(Math.abs(c.t - reloj.clics[i - 1].t - dt) < 1e-9, `tempo ${tempo}: paso ${i}`);
      assert.equal(c.a, i % 4 === 0, `acento en el clic ${i}`);
    });
    m.detener();
  }
});

test('compás de 3 tiempos: el acento vuelve cada 3', () => {
  const { reloj, m, avanzar } = armar({ tempo: 90, tiempos: 3, cuenta: false });
  m.iniciar(); avanzar(6);
  assert.deepEqual(reloj.clics.slice(0, 7).map(c => c.a), [true, false, false, true, false, false, true]);
});

test('compás de cuenta: el primer compás sale marcado como cuenta y los siguientes no', () => {
  const { pulsos, m, avanzar } = armar({ tempo: 120, tiempos: 4, cuenta: true });
  m.iniciar(); avanzar(5);
  assert.deepEqual(pulsos.slice(0, 4).map(p => p.cuenta), [true, true, true, true]);
  assert.ok(pulsos.slice(4).every(p => !p.cuenta));
  assert.deepEqual(pulsos.slice(0, 9).map(p => p.beat), [1, 2, 3, 4, 1, 2, 3, 4, 1]);
  assert.equal(pulsos[0].acento, true); assert.equal(pulsos[1].acento, false);
  const sin = armar({ tempo: 120, tiempos: 4, cuenta: false }); sin.m.iniciar(); sin.avanzar(3);
  assert.ok(sin.pulsos.every(p => !p.cuenta));
});

test('el indicador no se enciende antes de tiempo (llega junto al clic, no por delante)', () => {
  const { reloj, pulsos, m, avanzar } = armar({ tempo: 60, tiempos: 4, cuenta: false });
  m.iniciar(); avanzar(0.05);
  assert.equal(pulsos.length, 0, 'el primer clic es a los 0.08 s');
  avanzar(0.1); assert.equal(pulsos.length, 1);
  avanzar(1.0); assert.equal(pulsos.length, 2); assert.ok(reloj.clics.length >= pulsos.length);
});

test('cambiar el tempo con el metrónomo andando se nota desde el siguiente pulso, sin saltos raros', () => {
  const { reloj, m, avanzar } = armar({ tempo: 60, tiempos: 4, cuenta: false });
  m.iniciar(); avanzar(3);
  assert.equal(m.cambiarTempo(120), 120); avanzar(4);
  const pasos = reloj.clics.slice(1).map((c, i) => c.t - reloj.clics[i].t);
  assert.ok(pasos.every(p => Math.abs(p - 1) < 1e-9 || Math.abs(p - 0.5) < 1e-9), pasos.join());
  assert.ok(pasos.some(p => Math.abs(p - 0.5) < 1e-9));
  assert.equal(m.cambiarTempo(5000), 120); assert.equal(m.cambiarTempo('x'), 70);
});

test('detener corta todo y se puede volver a empezar desde el tiempo 1 con cuenta', () => {
  const { reloj, pulsos, m, avanzar } = armar({ tempo: 100, tiempos: 4, cuenta: true });
  m.iniciar(); avanzar(1); m.detener();
  const n = reloj.clics.length, p = pulsos.length;
  avanzar(5); assert.equal(reloj.clics.length, n); assert.equal(pulsos.length, p); assert.equal(m.estado().corriendo, false);
  m.iniciar(); avanzar(1);
  assert.equal(pulsos[p].beat, 1); assert.equal(pulsos[p].cuenta, true);
});

test('si el teléfono se duerme un rato no se suelta una ráfaga de clics atrasados', () => {
  const { reloj, m, avanzar } = armar({ tempo: 120, tiempos: 4, cuenta: false });
  m.iniciar(); avanzar(1);
  const antes = reloj.clics.length; reloj.t += 30; m.tick();
  assert.ok(reloj.clics.length - antes <= 2, 'clics nuevos: ' + (reloj.clics.length - antes));
  assert.ok(reloj.clics.at(-1).t >= reloj.t);
});

test('si el sonido falla, el indicador sigue funcionando', () => {
  const reloj = relojFalso(); reloj.clic = () => { throw new Error('sin audio'); };
  const pulsos = [], m = M.crear({ reloj, cada: () => () => {}, alPulso: p => pulsos.push(p), tempo: 120, tiempos: 4, cuenta: false });
  m.iniciar(); for (let i = 0; i < 100; i++) { reloj.t += 0.025; m.tick(); }
  assert.ok(pulsos.length >= 4);
});

test('relojAudio: sin Web Audio devuelve un reloj silencioso; con Web Audio programa un oscilador por clic', () => {
  const mudo = M.relojAudio({}); assert.equal(mudo.sonido, false); assert.ok(mudo.ahora() >= 0); mudo.clic(1, true);
  const hechos = [];
  class AC { constructor() { this.currentTime = 0; this.state = 'suspended'; this.destination = {}; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createOscillator() { const o = { frequency: {}, connect() {}, start: t => hechos.push(['start', t, o.frequency.value]), stop() {} }; return o; } }
  const r = M.relojAudio({ AudioContext: AC }); assert.equal(r.sonido, true);
  r.clic(2, true); r.clic(3, false);
  assert.deepEqual(hechos, [['start', 2, 1760], ['start', 3, 1175]]);
  class Roto { constructor() { throw new Error('no'); } }
  assert.equal(M.relojAudio({ AudioContext: Roto }).sonido, false);
});
