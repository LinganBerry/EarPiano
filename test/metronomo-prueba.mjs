// Pruebas de metronomo.js con un audio falso y reloj simulado. Ejecutar: npm test
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
await import('../metronomo.js');
const M = globalThis.Metronomo;

const audioFalso = () => {
  const ctx = { currentTime: 0, clics: [], destination: {}, resume() {},
    createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }),
    createOscillator() { const o = { frequency: { value: 0 }, connect() {}, start(t) { ctx.clics.push({ t, f: o.frequency.value }); }, stop() {} }; return o; } };
  return ctx;
};

test('limitar: números enteros entre 30 y 240; lo raro vuelve a 100', () => {
  assert.equal(M.limitar(10), 30); assert.equal(M.limitar(999), 240); assert.equal(M.limitar(87.6), 88);
  assert.equal(M.limitar('abc'), 100); assert.equal(M.limitar(undefined), 100);
});

test('iniciar programa el primer clic agudo; cada compás de 4 vuelve a sonar agudo; parar detiene', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  const ctx = audioFalso(), m = M.crear(() => ctx);
  m.fijar(120);
  assert.equal(m.iniciar(), true); assert.equal(m.sonando(), true);
  assert.equal(ctx.clics.length, 1); assert.equal(ctx.clics[0].f, 1500, 'el primer tiempo es agudo');
  for (let k = 1; k <= 8; k++) { ctx.currentTime = k * 0.5; mock.timers.tick(25); }
  const f = ctx.clics.map(c => c.f);
  assert.deepEqual(f.slice(0, 5), [1500, 1000, 1000, 1000, 1500], 'agudo, 3 normales, agudo');
  assert.ok(Math.abs(ctx.clics[1].t - ctx.clics[0].t - 0.5) < 1e-9, 'a 120 BPM, medio segundo entre clics');
  m.parar(); assert.equal(m.sonando(), false);
  const antes = ctx.clics.length; ctx.currentTime = 99; mock.timers.tick(100);
  assert.equal(ctx.clics.length, antes, 'detenido: no programa más clics');
  mock.timers.reset();
});

test('cambiar el tempo mientras suena se aplica desde el siguiente clic; alternar y sin audio', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  const ctx = audioFalso(), m = M.crear(() => ctx);
  m.fijar(60); m.iniciar();                       // 1 s entre clics
  m.fijar(120);
  ctx.currentTime = 1; mock.timers.tick(25); ctx.currentTime = 1.5; mock.timers.tick(25);
  const t = ctx.clics.map(c => c.t);
  assert.ok(t.length >= 3 && Math.abs(t[2] - t[1] - 0.5) < 1e-9, 'después del cambio, medio segundo');
  assert.equal(m.alternar(), false); assert.equal(m.sonando(), false); assert.equal(m.alternar(), true); m.parar();
  mock.timers.reset();
  assert.equal(M.crear(() => { throw new Error('sin audio'); }).iniciar(), false, 'sin audio: no revienta');
});
