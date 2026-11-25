// Recorridos completos y escenarios raros de EarPiano, en un navegador simulado (jsdom).
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
async function cerrarPractica(n) { for (let i = 0; i < 5 && !n.$('practica').hidden; i++) { n.tecla(n.d, 'Escape'); await dormir(80); } assert.equal(n.$('practica').hidden, true, 'Practicar se cierra con Esc'); }
async function atras(n, esperarA, que) { n.w.history.back(); await esperar(esperarA, que); }

test('RECORRIDO COMPLETO: abrir, buscar una canción, practicar (preguntas) y sumar una sesión de TimerPiano', async () => {
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

  await abrirPractica(n);

  empezarSol(n); await esperar(() => ESTADO_PRACTICA(n)?.preg, 'primera pregunta');
  await responder(n, 10, 2); await esperar(() => $('pr-resultado'), 'resultado');
  assert.match($('pr-resultado').textContent, /8 de 10 · 80%/);

  const h = new Date(), f = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
  w.location.hash = `#timer=abc123def456.${f}.300-120-0-60`;   // lo que manda el botón "Sumar a EarPiano" de TimerPiano
  await esperar(() => aviso(n), 'aviso de TimerPiano');
  assert.equal(aviso(n), 'TimerPiano: se sumaron 8 min a tu práctica.');
  $('pr-stats-ir') && $('pr-stats-ir').click();
  sinErrores(n); n.cerrar();
});

test('SIN INTERNET: la página abre con lo guardado, Practicar funciona y la sesión de TimerPiano se suma igual', async () => {
  memoria.clear();
  const n = await navegador('', { caido: true });
  await esperar(() => n.d.querySelectorAll('#lista .fila').length > 0 || n.$('sin-red').hidden === false, 'lista o aviso sin conexión');
  assert.equal(n.$('sin-red').hidden, false);
  await abrirPractica(n);
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
    await abrirPractica(n);
    empezarSol(n); await esperar(() => ESTADO_PRACTICA(n)?.preg, 'pregunta'); await responder(n, 10, 3);
    await esperar(() => n.$('pr-resultado'), 'resultado'); assert.match(n.$('pr-resultado').textContent, /7 de 10/, almacen);
    n.w.location.hash = `#timer=abc123def456.${n.w.RepertorioTimer.fecha()}.60-0-0-0`; await esperar(() => aviso(n), 'aviso de TimerPiano ' + almacen);
    sinErrores(n); n.cerrar();
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

test('TOTALES DE TIMERPIANO (almacén compartido): con tu pase, Practicar muestra lo que dejó TimerPiano sin sumar sesión por sesión; sin red usa la última copia; si algo falla vuelve a lo del enlace', async () => {
  const antes = process.env.TZ; process.env.TZ = 'America/Santo_Domingo';
  try {
    const { PASE } = await import('./navegador.mjs');
    const contrato = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('./contrato-puente.json', import.meta.url), 'utf8'));
    const reloj = { ms: Date.UTC(2026, 10, 16, 18, 0, 0) };                      // 14:00 del 16 de noviembre en Santo Domingo
    const ponerTotales = t => memoria.set('timerpiano/totales.json', { texto: typeof t === 'string' ? t : JSON.stringify(t), etag: '"t' + Math.random() + '"' });
    const entrar = async n => { const { j } = await n.w.RepertorioLocal.enviar('/api/entrar', { clave: PASE }); n.w.RepertorioLocal.guardarPase(j.token, false); return j.token; };

    memoria.clear(); ponerTotales(contrato.totales.archivo);
    const n = await navegador('', { reloj }); const token = await entrar(n);
    await abrirPractica(n);
    await esperar(() => /Hoy: 13 min/.test(n.$('pr-timer').textContent), 'los totales de TimerPiano en la fila');
    n.w.location.hash = `#timer=abc123def999.2026-11-16.300-0-0-0`; await esperar(() => aviso(n), 'aviso del enlace');
    n.$('pr-stats-ir').click(); await esperar(() => n.$('pr-timer-stats'), 'tarjeta de tiempo');
    assert.match(n.$('pr-timer-stats').textContent, /Hoy: 13 min · 7 días: 24 min · Racha: 1 día/, 'con totales compartidos el enlace no se suma otra vez: ' + n.$('pr-timer-stats').textContent);
    assert.ok(n.w.localStorage.getItem('repertorio-timer-totales-v1'), 'guarda la última copia para cuando no haya señal');
    sinErrores(n); const copia = n.w.localStorage.getItem('repertorio-timer-totales-v1'); n.cerrar();

    const sinRed = await navegador('', { reloj, caido: true, antes: w => { w.localStorage.setItem('repertorio-timer-totales-v1', copia); w.localStorage.setItem('repertorio-sesion-v3', token); } });
    await abrirPractica(sinRed); assert.match(sinRed.$('pr-timer').textContent, /Hoy: 13 min/, 'sin red usa la última copia'); sinErrores(sinRed); sinRed.cerrar();

    for (const [caso, archivo] of [['archivo roto', 'esto no es json'], ['archivo de otra versión', { version: 9 }], ['sin archivo', null]]) {
      memoria.clear(); if (archivo !== null) ponerTotales(archivo);
      const m = await navegador('', { reloj }); await entrar(m); await abrirPractica(m); await dormir(400);
      assert.doesNotMatch(m.$('pr-timer').textContent, /Hoy: 13 min/, caso); assert.match(m.$('pr-timer').textContent, /Te propone solfeo y oído|Hoy: 0 min/, caso); sinErrores(m); m.cerrar();
    }
    memoria.clear(); ponerTotales(contrato.totales.archivo);
    const v = await navegador('', { reloj, antes: w => w.localStorage.setItem('repertorio-sesion-v3', 'ep1.1.' + 'a'.repeat(64)) });
    await abrirPractica(v); await dormir(500); assert.equal(v.w.RepertorioLocal.leerPase(), '', 'un pase vencido se olvida'); sinErrores(v); v.cerrar();
  } finally { process.env.TZ = antes; if (antes === undefined) delete process.env.TZ; }
});
