// Navegador simulado (jsdom) para las pruebas de escenarios, recorridos y toques al azar.
// Igual que el de e2e.mjs (servidor real de api/ con almacén falso) y con extras para situaciones raras:
//   opciones: antes(w)  prepara el dispositivo antes de cargar la página
//             caido     la red falla       lento: ms   cada petición tarda esos ms     copia: true   el servidor responde con copia guardada
//             reloj     { ms }  fecha y hora falsas (se cambia reloj.ms para "pasar el tiempo")
//             almacen   'bloqueado' (localStorage lanza error) | 'lleno' (se lee pero no se puede guardar)
//             audio     true: pone un AudioContext falso y deja los clics en window.__clics
// Limitación: jsdom no dibuja ni aplica CSS; para el aspecto está test/capturas.mjs (navegador real).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';

process.env.ADMIN_PASSWORD ||= 'clave-de-prueba-larga-123';
process.env.SESSION_SECRET ||= 's'.repeat(40);
let jsdom;
try { jsdom = await import('jsdom'); } catch { console.error('Falta jsdom: ejecuta  npm i --no-save jsdom@30'); process.exit(2); }
const { JSDOM, VirtualConsole, requestInterceptor } = jsdom.JSDOM ? jsdom : jsdom.default;
export const { memoria } = await import('./blob-falso.mjs');
const canciones = await import('../api/canciones.js');
const entrar = await import('../api/entrar.js');
const progreso = await import('../api/progreso.js');
const timer = await import('../api/timer.js');

export const RAIZ = fileURLToPath(new URL('..', import.meta.url));
export const PASE = process.env.ADMIN_PASSWORD;
const TIPOS = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };
const interceptor = requestInterceptor(async request => {
  const { pathname } = new URL(request.url);
  const tipo = { 'Content-Type': TIPOS[pathname.slice(pathname.lastIndexOf('.'))] || 'application/octet-stream' };
  if (pathname === '/vendor/Tone.js') return new Response('/* Tone.js se omite: jsdom no tiene audio */', { headers: tipo });
  try { return new Response(await readFile(join(RAIZ, pathname)), { headers: tipo }); }
  catch { return new Response('no existe', { status: 404 }); }
});
export const dormir = ms => new Promise(r => setTimeout(r, ms));
export const esperar = async (cond, que, ms = 6000) => {
  const fin = Date.now() + ms;
  for (;;) { try { const v = await cond(); if (v) return v; } catch { /* aún no */ } if (Date.now() > fin) throw new Error('Se agotó la espera: ' + que); await dormir(15); }
};
export const sinErrores = n => assert.deepEqual(n.errores, [], 'errores de JavaScript en la página:\n' + n.errores.join('\n'));

export function sembrar(lista) {
  memoria.set('repertorio/canciones.json', { texto: JSON.stringify({ version: 2, nombre: 'EarPiano', intro: '', canciones: lista.map(([t, tono, ...partes], i) => ({ id: 'id' + i + 'x' + t.length, titulo: t, artista: 'Artista ' + i, tono, partes: partes.map(([nombre, prog]) => ({ nombre, tono: '', prog, letra: '', pista: '' })) })) }), etag: '"e0"' });
}

export async function navegador(busqueda = '', red = {}) {
  const html = await readFile(join(RAIZ, 'index.html'), 'utf8');
  const errores = [], vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) errores.push(e.stack || e.message); });
  const dom = new JSDOM(html, {
    url: 'http://prueba.local/' + (red.local || /servidor/.test(busqueda) ? busqueda : busqueda.replace(/^([^#]*)/, (q, a) => a + (a ? '&' : '?') + 'servidor')), runScripts: 'dangerously', resources: { interceptors: [interceptor] }, pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.addEventListener('error', e => { if (!e.defaultPrevented) errores.push('error no capturado: ' + (e.error && e.error.stack || e.message)); });
      w.addEventListener('unhandledrejection', e => errores.push('promesa rechazada: ' + e.reason));
      if (red.reloj) {
        const R = red.reloj, Real = w.Date;
        class Falsa extends Real { constructor(...a) { if (a.length) super(...a); else super(R.ms); } static now() { return R.ms; } }
        w.Date = Falsa;
      }
      if (red.almacen) {
        const real = w.localStorage;
        const err = nombre => new w.DOMException(nombre === 'SecurityError' ? 'The operation is insecure.' : 'The quota has been exceeded.', nombre);
        const falso = red.almacen === 'bloqueado'
          ? { get() { throw err('SecurityError'); } }
          : { get: () => new Proxy(real, { get: (o, k) => (k === 'setItem' ? () => { throw err('QuotaExceededError'); } : typeof o[k] === 'function' ? o[k].bind(o) : o[k]) }) };
        Object.defineProperty(w, 'localStorage', { configurable: true, ...falso });
        if (red.almacen === 'bloqueado') Object.defineProperty(w, 'sessionStorage', { configurable: true, get() { throw err('SecurityError'); } });
      }
      if (red.antes) red.antes(w);
      if (red.audio) {
        w.__clics = [];
        w.AudioContext = class { constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; const t0 = Date.now(); Object.defineProperty(this, 'currentTime', { get: () => (Date.now() - t0) / 1000 }); }
          createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
          createOscillator() { const o = { frequency: {}, connect() {}, start: t => w.__clics.push({ t, f: o.frequency.value }), stop() {} }; return o; } };
      }
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      w.fetch = async (url, opts = {}) => {
        if (red.lento) await dormir(red.lento);
        if (red.caido) throw new TypeError('sin red');
        const u = new URL(url, 'http://prueba.local');
        const req = () => new Request(u.href, { method: opts.method || 'GET', headers: { 'x-vercel-forwarded-for': '7.7.7.7', ...(opts.headers || {}) }, body: opts.body });
        let r;
        if (u.pathname === '/api/canciones') r = opts.method === 'POST' ? await canciones.POST(req()) : await canciones.GET();
        else if (u.pathname === '/api/entrar') r = await entrar.POST(req());
        else if (u.pathname === '/api/progreso') r = await progreso.POST(req());
        else if (u.pathname === '/api/timer') r = await timer.POST(req());
        else return new Response('no existe', { status: 404 });
        if (red.copia && r.ok) { const h = new Headers(r.headers); h.set('X-Copia', '1'); return new Response(await r.text(), { status: r.status, headers: h }); }
        return r;
      };
    }
  });
  const w = dom.window, d = w.document, $ = id => d.getElementById(id);
  await new Promise(ok => (d.readyState === 'complete' ? ok() : w.addEventListener('load', ok)));
  if (!red.lento && !red.caido) await esperar(() => $('cuenta').textContent !== '…' && $('cuenta').textContent !== '', 'que cargue el repertorio');
  const escribir = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const tecla = (objetivo, key) => objetivo.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  const boton = (texto, raiz = d) => [...raiz.querySelectorAll('button')].find(b => b.textContent.trim() === texto);
  return { dom, w, d, $, errores, escribir, tecla, boton, cerrar: () => w.close() };
}

export async function abrirPractica(n) {
  n.w.RepertorioPractica.CFG.pausa = 0;
  const btn = n.$('practica-btn'); btn.focus(); btn.click();
  await esperar(() => !n.$('practica').hidden && n.$('practica').querySelector('.pr-tema'), 'pantalla de Practicar');
  return n.$('practica');
}
