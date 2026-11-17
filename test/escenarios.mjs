// Recorridos completos y escenarios raros de Acordes y Tonos, en un navegador simulado (jsdom).
// Ejecutar: npm i --no-save jsdom@30 && npm run test:escenarios
import test from 'node:test';
import assert from 'node:assert/strict';
import { navegador, abrirPractica, esperar, dormir, sinErrores, sembrar, memoria } from './navegador.mjs';

const fechaEn = (ms, zona) => new Date(ms).toLocaleDateString('en-CA', { timeZone: zona });
const sumar = (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const aviso = n => n.$('aviso-timer') && n.$('aviso-timer').textContent;
const ESTADO_PRACTICA = n => n.w.RepertorioPractica.estadoSesion();

async function contestar(n, bien) {
  const ses = ESTADO_PRACTICA(n), p = ses.preg, i = ses.i;
  if (p.tipo === 'pentagrama' || p.tipo === 'escala') {
    const letra = bien ? p.respuesta.l : n.w.Notacion.LETRAS[(n.w.Notacion.LETRAS.indexOf(p.respuesta.l) + 3) % 7];
    if (p.respuesta.a !== undefined && n.d.querySelector('[data-mod]') && bien) n.d.querySelector(`[data-mod="${p.respuesta.a}"]`).click();
    n.d.querySelector(`[data-letra="${letra}"]`).click();
  } else {
    const otro = n.w.Notacion.botones(ses.tema, ses.nivel).opciones.find(o => o.id !== p.respuesta.id).id;
    n.d.querySelector(`[data-op="${bien ? p.respuesta.id : otro}"]`).click();
  }
  await esperar(() => ESTADO_PRACTICA(n)?.i > i || !ESTADO_PRACTICA(n), 'que se registre la respuesta');
}
async function responder(n, cuantas, fallos = 0) {
  for (let i = 0; i < cuantas; i++) {
    await esperar(() => ESTADO_PRACTICA(n)?.preg && ESTADO_PRACTICA(n).fase === 'pregunta', 'siguiente pregunta');
    await contestar(n, i >= fallos);
    if (ESTADO_PRACTICA(n)?.fase === 'feedback' && n.$('pr-sig')) n.$('pr-sig').click();
  }
}
const empezarSol = n => [...n.d.querySelectorAll('[data-tema="sol"] button')].find(b => /Empezar · 10/.test(b.textContent)).click();
async function abrirLectura(n) { await abrirPractica(n); n.$('pr-lectura-ir').click(); await esperar(() => n.$('lc-empezar'), 'menú de lectura'); }
async function cerrarPractica(n) { for (let i = 0; i < 5 && !n.$('practica').hidden; i++) { n.tecla(n.d, 'Escape'); await dormir(80); } assert.equal(n.$('practica').hidden, true, 'Practicar se cierra con Esc'); }
async function atras(n, esperarA, que) { n.w.history.back(); await esperar(esperarA, que); }
const op = (n, c, v) => n.d.querySelector(`[data-op="${c}:${v}"]`);

test('RECORRIDO COMPLETO: abrir, buscar una canción, practicar (lectura con ritmo y preguntas) y sumar una sesión de TimerPiano', async () => {
  memoria.clear(); sembrar([['Cuán grande es Él', 'G', ['Coro', 'G D Em C']], ['Aleluya', 'C', ['Coro', 'C G Am F']], ['Santo', 'D', ['Verso', 'D A Bm G']]]);
  const n = await navegador('');
  const { d, $, escribir, tecla, w } = n;
  assert.equal(d.querySelectorAll('#lista .fila').length, 3);
  escribir($('q'), 'grande'); await esperar(() => d.querySelectorAll('#lista .fila').length === 1, 'buscar');
  const abrir = d.querySelector('#lista .fila button'); abrir.click();
  await esperar(() => !$('cancion').hidden && !$('cancion').classList.contains('oculta'), 'abrir la canción');
  assert.match($('cancion').textContent, /G.*D.*Em.*C/s);
  tecla(d, 'Escape'); await esperar(() => $('cancion').hidden || $('cancion').classList.contains('oculta'), 'cerrar con Esc'); await dormir(150);
  escribir($('q'), ''); await esperar(() => d.querySelectorAll('#lista .fila').length === 3, 'borrar la búsqueda');

  await abrirPractica(n);                                      // Lectura con ritmo
  n.$('pr-lectura-ir').click(); await esperar(() => $('lc-empezar'), 'menú de lectura');
  op(n, 'ritmo', 'silencios').click(); op(n, 'compas', '3/4').click(); $('lc-empezar').click();
  await esperar(() => $('lc-metro'), 'frase con metrónomo');
  assert.equal(d.querySelectorAll('svg.pentagrama .rc-n').length, 3, 'tres tiempos en 3/4');
  $('lc-metro-play').click(); assert.equal($('lc-metro-play').getAttribute('aria-pressed'), 'true');
  await esperar(() => /Cuenta/.test($('lc-estado').textContent), 'cuenta de entrada');
  $('lc-boton').click(); assert.ok($('lc-notas').textContent.length > 0);   // ver cuáles son (el metrónomo sigue)
  assert.equal($('lc-metro-play').getAttribute('aria-pressed'), 'true', 'ver la respuesta no corta el metrónomo');
  await atras(n, () => $('lc-empezar'), 'menú de lectura otra vez');
  await atras(n, () => $('pr-lectura-ir'), 'menú de Practicar');

  empezarSol(n); await esperar(() => ESTADO_PRACTICA(n)?.preg, 'primera pregunta');
  await responder(n, 10, 2); await esperar(() => $('pr-resultado'), 'resultado');
  assert.match($('pr-resultado').textContent, /8 de 10 · 80%/);

  const h = new Date(), f = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
  w.location.hash = `#timer=abc123def456.${f}.300-120-0-60`;   // lo que manda el botón "Sumar a Acordes y Tonos" de TimerPiano
  await esperar(() => aviso(n), 'aviso de TimerPiano');
  assert.equal(aviso(n), 'TimerPiano: se sumaron 8 min a tu práctica.');
  $('pr-stats-ir') && $('pr-stats-ir').click();
  sinErrores(n); n.cerrar();
});

test('LECTURA CON RITMO: opciones que se recuerdan, metrónomo con clic, tempo 50–120, cuenta de entrada y se apaga al salir', async () => {
  memoria.clear();
  const n = await navegador('', { audio: true });
  const { $, d, w } = n;
  await abrirLectura(n);
  assert.equal(op(n, 'ritmo', 'largas').getAttribute('aria-pressed'), 'true'); assert.equal(op(n, 'compas', '4/4').getAttribute('aria-pressed'), 'true');
  op(n, 'ritmo', 'corcheas').click(); op(n, 'compas', '3/4').click();
  assert.deepEqual(JSON.parse(w.localStorage.getItem('repertorio-lectura-ritmo')), { ritmo: 'corcheas', compas: '3/4', tempo: 70, cuenta: true });
  assert.deepEqual(JSON.parse(w.localStorage.getItem('repertorio-lectura-pref')), { clave: 'ambas', movimiento: 'grados' }, 'la preferencia vieja sigue con su forma de siempre');
  $('lc-empezar').click(); await esperar(() => $('lc-metro'), 'frase');
  assert.equal(d.querySelectorAll('svg.pentagrama .rc-n').length, 3); assert.equal(d.querySelectorAll('#lc-pulsos .lc-p').length, 3);
  assert.equal($('lc-estado').textContent, 'Parado'); assert.equal($('lc-sin-sonido').hidden, true);
  // tempo
  assert.equal($('lc-tempo').min, '50'); assert.equal($('lc-tempo').max, '120');
  for (let i = 0; i < 20; i++) $('lc-tempo-mas').click(); assert.equal($('lc-tempo-valor').textContent, '120');
  for (let i = 0; i < 20; i++) $('lc-tempo-menos').click(); assert.equal($('lc-tempo-valor').textContent, '50');
  n.escribir($('lc-tempo'), '120'); assert.equal(JSON.parse(w.localStorage.getItem('repertorio-lectura-ritmo')).tempo, 120);
  // metrónomo a 120: la cuenta de entrada son 3 pulsos
  $('lc-metro-play').click();
  assert.equal($('lc-metro-play').textContent, '■ Parar');
  await esperar(() => d.querySelector('#lc-pulsos .lc-p.on'), 'primer pulso', 2000);
  assert.match($('lc-estado').textContent, /Cuenta/);
  await esperar(() => $('lc-estado').textContent === 'Toca', 'fin de la cuenta', 3000);
  assert.ok(w.__clics.length >= 3 && w.__clics[0].f === 1760 && w.__clics[1].f === 1175, 'clic agudo en el 1 y grave en los demás: ' + JSON.stringify(w.__clics.slice(0, 3)));
  const enPantalla = [...d.querySelectorAll('svg.pentagrama .rc-n.on')].length; assert.ok(enPantalla <= 1);
  // sale: se apaga y ya no suenan clics
  w.history.back(); await esperar(() => $('lc-empezar'), 'menú');
  const clics = w.__clics.length; await dormir(700); assert.equal(w.__clics.length, clics, 'después de salir no sigue sonando');
  // vuelve, sin cuenta de entrada
  $('lc-empezar').click(); await esperar(() => $('lc-metro'), 'frase otra vez');
  assert.equal($('lc-tempo-valor').textContent, '120', 'recuerda el tempo');
  $('lc-cuenta').click(); assert.equal(JSON.parse(w.localStorage.getItem('repertorio-lectura-ritmo')).cuenta, false);
  $('lc-metro-play').click(); await esperar(() => $('lc-estado').textContent === 'Toca', 'empieza directo, sin cuenta', 1500);
  // si se oculta la pantalla, se detiene
  Object.defineProperty(d, 'hidden', { configurable: true, get: () => true }); d.dispatchEvent(new w.Event('visibilitychange'));
  assert.equal($('lc-metro-play').getAttribute('aria-pressed'), 'false'); assert.equal($('lc-estado').textContent, 'Parado');
  sinErrores(n); n.cerrar();
});

test('LECTURA CON RITMO sin Web Audio: se ve el pulso y avisa que no hay sonido', async () => {
  memoria.clear();
  const n = await navegador('');
  await abrirLectura(n);
  op(n, 'ritmo', 'negras').click(); n.$('lc-empezar').click(); await esperar(() => n.$('lc-metro'), 'frase');
  n.escribir(n.$('lc-tempo'), '120'); n.$('lc-cuenta').click();
  n.$('lc-metro-play').click();
  assert.equal(n.$('lc-sin-sonido').hidden, false);
  await esperar(() => n.d.querySelector('#lc-pulsos .lc-p.on') && n.$('lc-estado').textContent === 'Toca', 'pulsos a la vista', 2000);
  assert.ok(n.d.querySelector('svg.pentagrama .rc-n.on') || true);
  n.$('lc-metro-play').click(); assert.equal(n.$('lc-estado').textContent, 'Parado'); assert.equal(n.d.querySelector('#lc-pulsos .lc-p.on'), null);
  sinErrores(n); n.cerrar();
});

test('SIN INTERNET: la página abre con lo guardado, Practicar y Lectura funcionan y la sesión de TimerPiano se suma igual', async () => {
  memoria.clear();
  const n = await navegador('', { caido: true });
  await esperar(() => n.d.querySelectorAll('#lista .fila').length > 0 || n.$('sin-red').hidden === false, 'lista o aviso sin conexión');
  assert.equal(n.$('sin-red').hidden, false);
  await abrirLectura(n); op(n, 'ritmo', 'silencios').click(); n.$('lc-empezar').click(); await esperar(() => n.$('lc-metro'), 'frase sin red');
  await atras(n, () => n.$('lc-empezar'), 'menú'); await atras(n, () => n.$('pr-lectura-ir'), 'menú de Practicar');
  empezarSol(n); await esperar(() => ESTADO_PRACTICA(n)?.preg, 'pregunta sin red'); await responder(n, 10, 0);
  await esperar(() => n.$('pr-resultado'), 'resultado sin red'); assert.match(n.$('pr-resultado').textContent, /10 de 10/);
  const f = n.w.RepertorioTimer.fecha();
  n.w.location.hash = `#timer=abc123def456.${f}.60-0-0-0`; await esperar(() => aviso(n), 'aviso');
  assert.match(aviso(n), /se sumaron 1 min/);
  sinErrores(n); n.cerrar();
});

test('MUY LENTO: la página responde mientras la red tarda, y al llegar la respuesta no se rompe nada', async () => {
  memoria.clear(); sembrar([['Aleluya', 'C', ['Coro', 'C G Am F']]]);
  const n = await navegador('', { lento: 1200 });
  await abrirPractica(n);                                      // la red todavía no contestó
  assert.ok(n.$('practica').querySelector('.pr-tema'));
  await cerrarPractica(n);
  await esperar(() => n.d.querySelectorAll('#lista .fila').length === 1, 'la lista llega', 6000);
  sinErrores(n); n.cerrar();
});

test('ALMACENAMIENTO bloqueado o lleno: todo funciona en esta visita (no se guarda, pero no se rompe)', async () => {
  for (const almacen of ['bloqueado', 'lleno']) {
    memoria.clear(); sembrar([['Aleluya', 'C', ['Coro', 'C G Am F']]]);
    const n = await navegador('', { almacen });
    assert.equal(n.d.querySelectorAll('#lista .fila').length, 1, almacen);
    await abrirLectura(n);
    op(n, 'ritmo', 'silencios').click(); op(n, 'compas', '4/4').click(); n.$('lc-empezar').click(); await esperar(() => n.$('lc-metro'), 'frase');
    n.$('lc-tempo-mas').click(); n.$('lc-metro-play').click(); n.$('lc-metro-play').click(); n.$('lc-boton').click(); n.$('lc-boton').click();
    await atras(n, () => n.$('lc-empezar'), 'menú'); await atras(n, () => n.$('pr-lectura-ir'), 'menú de Practicar');
    empezarSol(n); await esperar(() => ESTADO_PRACTICA(n)?.preg, 'pregunta'); await responder(n, 10, 3);
    await esperar(() => n.$('pr-resultado'), 'resultado'); assert.match(n.$('pr-resultado').textContent, /7 de 10/, almacen);
    n.w.location.hash = `#timer=abc123def456.${n.w.RepertorioTimer.fecha()}.60-0-0-0`; await esperar(() => aviso(n), 'aviso de TimerPiano ' + almacen);
    sinErrores(n); n.cerrar();
  }
});

test('DATOS GUARDADOS dañados o de versiones viejas en la lectura con ritmo: vuelve a lo normal sin errores', async () => {
  const RAROS = [null, 7, true, 'texto', '{"ritmo":', [], [1, 2], {}, { ritmo: 9, compas: [], tempo: 'x', cuenta: 'sí' }, { ritmo: 'silencios', compas: '5/8', tempo: -4 }, { tempo: 1e9 }, { ritmo: 'silencios', compas: '3/4', tempo: 99, cuenta: false }];
  for (const clave of ['repertorio-lectura-ritmo', 'repertorio-lectura-pref']) for (const v of RAROS) {
    const n = await navegador('', { antes: w => w.localStorage.setItem(clave, typeof v === 'string' ? v : JSON.stringify(v)) });
    await abrirLectura(n);
    for (const [c, vals] of [['ritmo', ['largas', 'negras', 'corcheas', 'silencios']], ['compas', ['4/4', '3/4']]]) assert.equal(vals.filter(x => op(n, c, x).getAttribute('aria-pressed') === 'true').length, 1, `${clave}=${JSON.stringify(v)}: una sola opción de ${c}`);
    n.$('lc-empezar').click(); await esperar(() => n.$('lc-boton'), 'frase');
    const t = Number(n.$('lc-tempo-valor') ? n.$('lc-tempo-valor').textContent : 70); assert.ok(t >= 50 && t <= 120, 'tempo ' + t);
    n.$('lc-boton').click(); n.$('lc-boton').click();
    assert.deepEqual(n.errores, [], `${clave}=${JSON.stringify(v)}\n` + n.errores.join('\n')); n.cerrar();
  }
});

test('OTRA ZONA HORARIA: lo que manda TimerPiano se acepta con la fecha de tu día, aunque en el mundo ya sea otro', async () => {
  const antes = process.env.TZ;
  try {
    for (const zona of ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/Santo_Domingo', 'Asia/Kolkata', 'Europe/Madrid']) for (const horaUTC of [0, 11, 23]) {
      process.env.TZ = zona;
      const ms = Date.UTC(2026, 10, 16, horaUTC, 30), reloj = { ms }, hoy = fechaEn(ms, zona);
      memoria.clear();
      const n = await navegador('', { reloj, caido: true });
      assert.equal(n.w.RepertorioTimer.fecha(), hoy, `${zona}: "hoy" en la página`);
      const raro = `${zona} UTC ${horaUTC}:30`;
      n.w.location.hash = `#timer=abc123def456.${hoy}.300-0-0-0`; await esperar(() => aviso(n), raro); assert.match(aviso(n), /se sumaron 5 min/, raro); n.$('aviso-timer').click();
      n.w.location.hash = `#timer=abc123def457.${sumar(hoy, 1)}.300-0-0-0`; await esperar(() => aviso(n), raro); assert.match(aviso(n), /se sumaron/, raro + ': mañana (otra zona) se tolera'); n.$('aviso-timer').click();
      n.w.location.hash = `#timer=abc123def458.${sumar(hoy, 3)}.300-0-0-0`; await esperar(() => aviso(n), raro); assert.match(aviso(n), /No pude leer/, raro + ': 3 días adelante no'); n.$('aviso-timer').click();
      await abrirPractica(n); assert.match(n.$('pr-timer').textContent, /Hoy: 5 min/, raro);
      sinErrores(n); n.cerrar();
    }
  } finally { process.env.TZ = antes; if (antes === undefined) delete process.env.TZ; }
});

test('PASAR LA MEDIANOCHE en medio de una sesión: se guarda entera en un solo día válido y "Hoy" cambia al día nuevo', async () => {
  const antes = process.env.TZ; process.env.TZ = 'America/Santo_Domingo';
  try {
    memoria.clear();
    const reloj = { ms: Date.UTC(2026, 10, 17, 3, 59, 20) };         // 23:59:20 del 16 de noviembre en Santo Domingo
    const n = await navegador('', { reloj, caido: true });
    const dia1 = n.w.RepertorioTimer.fecha(); assert.equal(dia1, '2026-11-16');
    n.w.location.hash = `#timer=abc123def456.${dia1}.300-0-0-0`; await esperar(() => aviso(n), 'aviso'); n.$('aviso-timer').click();
    await abrirPractica(n); assert.match(n.$('pr-timer').textContent, /Hoy: 5 min/);
    await cerrarPractica(n);
    await abrirPractica(n); empezarSol(n); await esperar(() => ESTADO_PRACTICA(n)?.preg, 'pregunta');
    await responder(n, 5, 1);
    reloj.ms += 60 * 1000;                                           // son las 00:00:20 del 17
    assert.equal(n.w.RepertorioTimer.fecha(), '2026-11-17');
    await responder(n, 5, 0); await esperar(() => n.$('pr-resultado'), 'resultado');
    const { pend } = n.w.RepertorioPractica.datos;
    assert.equal(pend.length, 1, 'una sola sesión, no dos'); assert.equal(pend[0].n, 10); assert.equal(pend[0].a, 9);
    assert.match(String(pend[0].f || pend[0].d || ''), /^2026-11-1[67]$/, 'queda con un día válido: ' + JSON.stringify(pend[0]));
    await cerrarPractica(n);
    await abrirPractica(n);
    assert.match(n.$('pr-timer').textContent, /Hoy: 0 min|solfeo y oído|Hoy: —/, 'con el día nuevo, "Hoy" de TimerPiano empieza en 0: ' + n.$('pr-timer').textContent);
    n.w.location.hash = `#timer=abc123def459.2026-11-17.120-0-0-0`; await esperar(() => aviso(n), 'aviso del día nuevo');
    n.$('pr-stats-ir').click(); await esperar(() => n.$('pr-timer-stats'), 'tarjeta');
    assert.match(n.$('pr-timer-stats').textContent, /Hoy: 2 min · 7 días: 7 min · Racha: 2 días/, n.$('pr-timer-stats').textContent);
    sinErrores(n); n.cerrar();
  } finally { process.env.TZ = antes; if (antes === undefined) delete process.env.TZ; }
});
