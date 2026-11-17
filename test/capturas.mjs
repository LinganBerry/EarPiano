// Capturas de las pantallas principales a 360 px de ancho (teléfono pequeño), en tema claro y oscuro, con un navegador real sin pantalla.
// Avisa si algo se sale del ancho o la página se mueve de lado. Las imágenes quedan en capturas/ (míralas tú: la prueba solo detecta cortes, no belleza).
// Ejecutar (una vez):  npm i --no-save playwright && npx playwright install chromium     Después:  npm run test:capturas
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

let chromium;
try { ({ chromium } = await import('playwright')); } catch { console.error('Falta Playwright: npm i --no-save playwright && npx playwright install chromium'); process.exit(2); }
const RAIZ = fileURLToPath(new URL('..', import.meta.url)), SALIDA = join(RAIZ, 'capturas'), ANCHO = 360, ALTO = 740;
const TIPOS = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const parte = (nombre, prog) => ({ nombre, tono: '', prog, letra: 'La la la la\nLa la la', pista: '' });
const CANCIONES = { version: 2, nombre: 'EarPiano', intro: '', canciones: [
  { id: 'id0aleluya', titulo: 'Aleluya', artista: 'Artista A', tono: 'C', partes: [parte('Verso', 'C Am | C Am | F G | C G'), parte('Coro', 'F G | Em Am | F G | C')] },
  { id: 'id1grande', titulo: 'Cuán grande es Él', artista: 'Artista B', tono: 'G', partes: [parte('Verso', 'G D | Em C'), parte('Coro', 'C G | D Em')] },
  { id: 'id2santo', titulo: 'Santo', artista: 'Artista C', tono: 'D', partes: [parte('Verso', 'D A | Bm G')] }] };
const servidor = createServer(async (q, r) => {
  let ruta = new URL(q.url, 'http://x').pathname; if (ruta === '/') ruta = '/index.html';
  if (ruta === '/api/canciones') { r.writeHead(200, { 'Content-Type': 'application/json' }); return r.end(JSON.stringify(CANCIONES)); }   // canciones de ejemplo, sin servidor
  if (ruta.startsWith('/api/')) { r.writeHead(503); return r.end('{}'); }
  try { r.writeHead(200, { 'Content-Type': TIPOS[extname(ruta)] || 'application/octet-stream' }); r.end(await readFile(join(RAIZ, ruta))); }
  catch { r.writeHead(404); r.end('no existe'); }
});
await new Promise(ok => servidor.listen(0, '127.0.0.1', ok));
const URL_BASE = `http://127.0.0.1:${servidor.address().port}/`;
await mkdir(SALIDA, { recursive: true });

// Revisa lo que se ve en pantalla: nada se sale por los lados (salvo lo que desliza dentro de su propia caja) y la página no se mueve de lado.
const revisar = () => {
  const ancho = document.documentElement.clientWidth, malos = [];
  if (document.documentElement.scrollWidth > ancho + 1) malos.push('la página se mueve de lado (ancho ' + document.documentElement.scrollWidth + ')');
  const desliza = el => { for (let e = el.parentElement; e; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    if (el.classList.contains('saltar')) continue;                               // el enlace "Ir al buscador" se esconde a propósito hasta que lo enfocas
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden], [inert]')) continue;
    const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
    if ((b.right > ancho + 1 || b.left < -1) && !desliza(el)) malos.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} (${Math.round(b.left)}→${Math.round(b.right)}) "${(el.textContent || '').trim().slice(0, 25)}"`);
  }
  return malos.slice(0, 6);
};
const PASOS = [
  ['inicio', async p => {}],
  ['cancion', async p => { await p.click('#lista .fila button'); await p.waitForSelector('#cancion:not([hidden])'); }],
  ['practicar', async p => { await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.click('#practica-btn'); await p.waitForSelector('#pr-lectura-ir', { state: 'attached' }); }],
  ['lectura-menu', async p => { await p.evaluate(() => document.getElementById('pr-lectura-ir').click()); await p.waitForSelector('#lc-empezar'); }],
  ['lectura-4-4-silencios', async p => { await p.click('[data-op="ritmo:silencios"]'); await p.click('[data-op="compas:4/4"]'); await p.click('#lc-empezar'); await p.waitForSelector('#lc-metro'); }],
  ['lectura-metronomo-andando', async p => { await p.click('#lc-metro-play'); await p.waitForTimeout(1500); }],
  ['lectura-respuesta', async p => { await p.click('#lc-metro-play'); await p.click('#lc-boton'); await p.waitForSelector('#lc-notas'); }],
  ['lectura-3-4-corcheas', async p => { await p.goBack(); await p.waitForSelector('#lc-empezar'); await p.click('[data-op="ritmo:corcheas"]'); await p.click('[data-op="compas:3/4"]'); await p.click('#lc-empezar'); await p.waitForSelector('#lc-metro'); }],
  ['lectura-notas-largas', async p => { await p.goBack(); await p.waitForSelector('#lc-empezar'); await p.click('[data-op="ritmo:largas"]'); await p.click('#lc-empezar'); await p.waitForSelector('#lc-boton'); }],
  ['reconocer', async p => { await p.goto(URL_BASE); await p.waitForSelector('#lista .fila'); await p.click('#practica-btn'); await p.waitForSelector('#pr-reconocer-ir', { state: 'attached' }); await p.evaluate(() => document.getElementById('pr-reconocer-ir').click()); await p.waitForSelector('#rc-empezar-10'); await p.click('#rc-empezar-10'); await p.waitForTimeout(400); }],
  ['estadisticas', async p => { await p.goto(URL_BASE); await p.waitForSelector('#lista .fila'); await p.click('#practica-btn'); await p.waitForSelector('#pr-stats-ir', { state: 'attached' }); await p.evaluate(() => document.getElementById('pr-stats-ir').click()); await p.waitForSelector('#pr-stats'); }],
  ['teoria-quintas', async p => { await p.goto(URL_BASE); await p.waitForSelector('#lista .fila'); await p.click('#teoria-btn'); await p.click('#teoria button:has-text("Círculo")'); await p.waitForSelector('svg.cq'); }]
];
const problemas = [];
const navegador = await chromium.launch();
for (const tema of ['claro', 'oscuro']) {
  const ctx = await navegador.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
  const p = await ctx.newPage(), errores = [];
  p.on('pageerror', e => errores.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/503|Failed to load resource/.test(m.text())) errores.push(m.text()); });
  await p.goto(URL_BASE); await p.waitForSelector('#lista .fila');
  for (const [nombre, paso] of PASOS) {
    try { await paso(p); await p.waitForTimeout(250); }
    catch (e) { problemas.push(`[${tema}] ${nombre}: no se pudo llegar a esta pantalla (${e.message.split('\n')[0]})`); await p.screenshot({ path: join(SALIDA, `${tema}-ERROR-${nombre}.png`) }).catch(() => {}); continue; }
    const cortes = await p.evaluate(revisar);
    await p.screenshot({ path: join(SALIDA, `${tema}-${nombre}.png`) });
    for (const c of cortes) problemas.push(`[${tema}] ${nombre}: ${c}`);
    console.log(`${cortes.length ? '✗' : '✓'} ${tema} · ${nombre}`);
  }
  for (const e of errores) problemas.push(`[${tema}] error en la página: ${e}`);
  await ctx.close().catch(() => {});
}
await navegador.close().catch(() => {}); servidor.close();
console.log(`\nCapturas en ${SALIDA} (${ANCHO} px de ancho).`);
if (problemas.length) { console.error('\nPROBLEMAS:\n' + problemas.join('\n')); process.exit(1); }
console.log('Nada se sale del ancho y no hubo errores en la página.');
