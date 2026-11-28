// Pruebas de retos.js (retos de acordes: lógica pura). Ejecutar: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(await readFile(new URL('../repaso.js', import.meta.url), 'utf8'), ctx);   // repaso espaciado (retos.js lo usa si está)
vm.runInContext(await readFile(new URL('../retos.js', import.meta.url), 'utf8'), ctx);
// Los objetos creados dentro de vm tienen otros prototipos: se copian a objetos normales para compararlos.
const J = x => JSON.parse(JSON.stringify(x));
const R = Object.fromEntries(Object.entries(ctx.Retos).map(([k, v]) => [k, typeof v === 'function' ? (...a) => J(v(...a)) : J(v)]));
const semilla = s => () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };

test('las 24 tríadas (12 mayores y 12 menores) se escriben con sus letras correctas', () => {
  const esperado = {
    C: 'C E G', Db: 'Db F Ab', D: 'D F# A', Eb: 'Eb G Bb', E: 'E G# B', F: 'F A C', 'F#': 'F# A# C#', G: 'G B D', Ab: 'Ab C Eb', A: 'A C# E', Bb: 'Bb D F', B: 'B D# F#',
    Cm: 'C Eb G', 'C#m': 'C# E G#', Dm: 'D F A', Ebm: 'Eb Gb Bb', Em: 'E G B', Fm: 'F Ab C', 'F#m': 'F# A C#', Gm: 'G Bb D', 'G#m': 'G# B D#', Am: 'A C E', Bbm: 'Bb Db F', Bm: 'B D F#'
  };
  let vistos = 0;
  for (const cal of ['M', 'm']) for (const r of R.RAICES[cal]) {
    const a = R.acorde(r, cal);
    assert.equal(a.tonos.map(t => t.nombre).join(' '), esperado[a.nombre], a.nombre); vistos++;
  }
  assert.equal(vistos, 24);
});

test('posiciones: orden de grave a agudo, notas correctas y siempre dentro del teclado dibujado (60–83)', () => {
  for (const cal of ['M', 'm']) for (const r of R.RAICES[cal]) {
    const a = R.acorde(r, cal), pcs = a.tonos.map(t => t.pc);
    for (let inv = 0; inv < 3; inv++) {
      const p = R.posicion(a, inv);
      assert.deepEqual(p.notas, [0, 1, 2].map(i => a.tonos[(i + inv) % 3].nombre), `${a.nombre} ${inv}`);
      assert.ok(p.midis.every((m, j) => j === 0 || m > p.midis[j - 1]), `ascendente ${a.nombre} ${inv}`);
      assert.ok(p.midis[0] >= 60 && p.midis[0] <= 71 && p.midis.at(-1) <= 83, `rango ${a.nombre} ${inv}: ${p.midis}`);
      assert.deepEqual(p.midis.map(m => m % 12), [0, 1, 2].map(i => pcs[(i + inv) % 3]), `notas ${a.nombre} ${inv}`);
    }
  }
  assert.deepEqual(R.posicion(R.acorde('C', 'M'), 0).midis, [60, 64, 67]);
  assert.deepEqual(R.posicion(R.acorde('B', 'M'), 2).midis, [66, 71, 75], 'B mayor en 2ª inversión no se sale del teclado');
});

test('crearReto: respeta las opciones, no repite el anterior y es repetible con semilla', () => {
  const az = semilla(7);
  let previo = null;
  for (let i = 0; i < 300; i++) {
    const r = R.crearReto({ calidad: 'm', inversiones: false }, az, previo);
    assert.equal(r.calidad, 'm'); assert.equal(r.inv, 0); assert.ok(r.nombre.endsWith('m')); assert.notEqual(r.item, previo); previo = r.item;
  }
  const vistas = new Set();
  for (let i = 0; i < 600; i++) { const r = R.crearReto({ calidad: 'ambos', inversiones: true }, az); vistas.add(r.calidad + r.inv); }
  assert.equal(vistas.size, 6, 'salen mayores y menores, en las 3 posiciones');
  assert.deepEqual(R.crearReto({ calidad: 'M' }, semilla(3)), R.crearReto({ calidad: 'M' }, semilla(3)));
  assert.equal(R.crearReto({}, semilla(1)).inv, 0, 'sin opciones: fundamental');
});

test('describir y limpiar: los datos guardados alterados no rompen nada', () => {
  assert.deepEqual(R.describir('Db|M|1'), { nombre: 'Db', corta: '1ª inv.' });
  assert.deepEqual(R.describir('F#|m|2'), { nombre: 'F#m', corta: '2ª inv.' });
  for (const malo of ['', 'X|M|0', 'Db|m|0', 'C|M|3', 'C|M|-1', 'C|M|1.5', 'C|Z|0', null, undefined, 5]) assert.equal(R.describir(malo), null, String(malo));
  const sucio = { items: { 'C|M|0': { v: 5, a: 9, ms: -3, mejor: 'x' }, 'Z|M|0': { v: 1, a: 1 }, 'D|M|0': 'hola', 'E|M|0': { v: 4, a: 2, ms: 6000, mejor: 2500 } } };
  const lim = R.limpiar(sucio);
  assert.deepEqual(Object.keys(lim.items).sort(), ['C|M|0', 'E|M|0']);
  assert.equal(lim.items['C|M|0'].a, 5, 'aciertos nunca superan a las veces'); assert.equal(lim.items['C|M|0'].ms, 0); assert.equal(lim.items['C|M|0'].mejor, 0);
  for (const raro of [null, 'texto', 5, [], { items: null }, { items: 'x' }]) assert.deepEqual(R.limpiar(raro), { items: {} });
});

test('estadísticas: registrar, "para repasar" y "los más lentos"', () => {
  const est = R.vacias();
  R.registrar(est, 'C|M|0', true, 2000); R.registrar(est, 'C|M|0', true, 1000);
  R.registrar(est, 'Db|M|0', false, 0); R.registrar(est, 'Db|M|0', true, 5000);
  R.registrar(est, 'E|m|1', false, 0);
  R.registrar(est, 'G|M|0', true, 4000); R.registrar(est, 'G|M|0', true, 6000);
  assert.deepEqual(J(est.items['C|M|0']), { v: 2, a: 2, ms: 3000, mejor: 1000 });
  assert.deepEqual(J(est.items['Db|M|0']), { v: 2, a: 1, ms: 5000, mejor: 5000 });
  const r = R.resumen(est);
  assert.equal(r.v, 7); assert.equal(r.a, 5);
  assert.deepEqual(r.repasar.map(f => f.nombre), ['Em', 'Db'], 'el que fallas más va primero; los que dominas no salen');
  assert.deepEqual(r.lentos.map(f => f.nombre), ['G', 'C'], 'solo con 2 o más aciertos, del más lento al más rápido');
  assert.deepEqual(R.resumen(R.vacias()), { v: 0, a: 0, repasar: [], lentos: [] });
});

test('"lo que más fallas sale más": respeta lo que elegiste y solo ayuda si activas "repasar"', () => {
  const est = R.vacias();
  for (let i = 0; i < 4; i++) R.registrar(est, 'Db|M|0', false, 0);          // lo fallas mucho
  R.registrar(est, 'C|M|2', false, 0);                                      // fallo en una inversión
  for (let i = 0; i < 5; i++) R.registrar(est, 'G|M|0', true, 2000);        // este lo dominas
  R.registrar(est, 'E|m|0', false, 0);
  const cuantos = (op, item, n = 1500) => { const az = semilla(11); let c = 0, prev = null; for (let i = 0; i < n; i++) { const r = R.crearReto(op, az, prev, est); prev = r.item; if (r.item === item) c++; } return c; };
  assert.deepEqual(R.debiles(est, { calidad: 'M', inversiones: false }).map(f => f.item), ['Db|M|0'], 'sin inversiones no entra C|M|2; los que dominas tampoco');
  assert.deepEqual(R.debiles(est, { calidad: 'ambos', inversiones: true }).map(f => f.item).sort(), ['C|M|2', 'Db|M|0', 'E|m|0']);
  assert.deepEqual(R.debiles(est, { calidad: 'm', inversiones: false }).map(f => f.item), ['E|m|0']);
  const con = cuantos({ calidad: 'M', inversiones: false, repasar: true }, 'Db|M|0'), sin = cuantos({ calidad: 'M', inversiones: false, repasar: false }, 'Db|M|0');
  assert.ok(con > 450 && con < 800, 'con repasar sale mucho más: ' + con);
  assert.ok(sin > 60 && sin < 200, 'sin repasar sale como cualquiera (~1 de 12): ' + sin);
  assert.equal(cuantos({ calidad: 'm', inversiones: false, repasar: true }, 'Db|M|0'), 0, 'nunca sale algo que no elegiste');
  assert.equal(cuantos({ calidad: 'M', inversiones: false, repasar: true }, 'C|M|2'), 0, 'sin inversiones no salen inversiones');
  let prev = null; for (let i = 0; i < 300; i++) { const r = R.crearReto({ calidad: 'M', repasar: true }, semilla(i), prev, est); assert.notEqual(r.item, prev); prev = r.item; }
});

test('registrar con fecha: guarda el resultado de cada día; un solo fallo ese día lo marca como fallo; solo ' + 20 + ' días', () => {
  const est = R.vacias();
  R.registrar(est, 'C|M|0', true, 1000, '2026-11-01'); R.registrar(est, 'C|M|0', true, 900, '2026-11-01');
  assert.deepEqual(J(est.items['C|M|0'].h), [['2026-11-01', 1]]);
  R.registrar(est, 'C|M|0', false, 0, '2026-11-01'); R.registrar(est, 'C|M|0', true, 800, '2026-11-01');
  assert.deepEqual(J(est.items['C|M|0'].h), [['2026-11-01', 0]], 'un fallo del día no se borra por acertar después');
  for (let d = 2; d <= 28; d++) R.registrar(est, 'C|M|0', true, 700, '2026-11-' + String(d).padStart(2, '0'));
  assert.equal(est.items['C|M|0'].h.length, 20); assert.equal(est.items['C|M|0'].h[19][0], '2026-11-28');
  const sin = R.vacias(); R.registrar(sin, 'D|M|0', true, 500);
  assert.deepEqual(J(sin.items['D|M|0']), { v: 1, a: 1, ms: 500, mejor: 500 }, 'sin fecha no se agrega nada');
});

test('limpiar conserva el historial por día válido y descarta lo dañado', () => {
  const raw = { items: { 'C|M|0': { v: 3, a: 2, ms: 3000, mejor: 900, h: [['2026-11-01', 1], ['mal', 1], ['2026-11-02', 7], 'x', ['2026-11-03', 0]] }, 'D|M|0': { v: 1, a: 1, ms: 5, mejor: 5, h: 'no' } } };
  const lim = R.limpiar(raw);
  assert.deepEqual(lim.items['C|M|0'].h, [['2026-11-01', 1], ['2026-11-03', 0]]);
  assert.equal('h' in lim.items['D|M|0'], false);
  const largo = { items: { 'E|M|0': { v: 30, a: 30, ms: 1, mejor: 1, h: Array.from({ length: 30 }, (_, i) => ['2026-10-' + String(i + 1).padStart(2, '0'), 1]) } } };
  assert.equal(R.limpiar(largo).items['E|M|0'].h.length, 20);
});

test('repaso espaciado en retos: solo cuenta lo que ya toca y fallaste alguna vez; los datos viejos siguen como antes', () => {
  const hoy = '2026-11-27', est = R.vacias();
  const dias = (item, ...h) => { est.items[item] = { v: h.length, a: h.filter(x => x[1]).length, ms: 0, mejor: 0, h }; };
  dias('Db|M|0', ['2026-11-24', 0]);                                                          // fallado hace 3 días: toca
  dias('Eb|M|0', ['2026-11-27', 0]);                                                          // fallado hoy: toca mañana
  dias('F|M|0', ['2026-10-01', 0], ['2026-10-02', 1], ['2026-10-05', 1], ['2026-10-13', 1], ['2026-11-20', 1]);   // dominado y espaciado: aún no toca
  dias('G|M|0', ['2026-11-20', 1]);                                                           // nunca fallado
  est.items['A|M|0'] = { v: 5, a: 1, ms: 0, mejor: 0 };                                       // dato viejo sin días: criterio de antes (80 %)
  const f = R.debiles(est, { calidad: 'M', inversiones: false, hoy });
  assert.deepEqual(f.map(x => x.item).sort(), ['A|M|0', 'Db|M|0']);
  assert.ok(f.find(x => x.item === 'Db|M|0').peso >= 3, 'atrasado y fallado: pesa más');
  const mas = R.debiles(est, { calidad: 'M', inversiones: false, hoy: '2026-12-20' }).map(x => x.item);
  assert.ok(mas.includes('F|M|0'), 'con el tiempo, lo dominado vuelve a tocar antes de olvidarse');
});

test('crearReto con repasar: el reto vencido sale mucho más que uno al azar, y el que aún no toca no se fuerza', () => {
  const est = R.vacias(), hoy = R.hoy();
  const ayer = new Date(Date.now() - 3 * 86400000).toLocaleDateString('en-CA');
  est.items['Db|M|0'] = { v: 1, a: 0, ms: 0, mejor: 0, h: [[ayer, 0]] };
  est.items['Eb|M|0'] = { v: 1, a: 0, ms: 0, mejor: 0, h: [[hoy, 0]] };
  const cuantos = item => { const az = semilla(7); let c = 0, prev = null; for (let i = 0; i < 1500; i++) { const r = R.crearReto({ calidad: 'M', inversiones: false, repasar: true }, az, prev, est); prev = r.item; if (r.item === item) c++; } return c; };
  const venc = cuantos('Db|M|0'), no = cuantos('Eb|M|0');
  assert.ok(venc > 450, 'vencido: ' + venc); assert.ok(no < 200, 'sin vencer sale como cualquiera: ' + no);
});
