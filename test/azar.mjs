// Toques al azar (opcional): abre la página y, durante unos cientos de pasos, toca botones, escribe en cuadros, usa teclas,
// manda enlaces de TimerPiano buenos y rotos, daña datos guardados y corta la red. Solo busca errores de JavaScript.
// Ejecutar: npm i --no-save jsdom@30 && npm run test:azar
//   AZAR_PASOS=1500  más pasos (por defecto 400)    AZAR_SEMILLA=123  repetir exactamente una corrida    AZAR_RONDAS=3  varias páginas seguidas
import { navegador, abrirPractica, esperar, dormir, memoria, sembrar } from './navegador.mjs';

const PASOS = Number(process.env.AZAR_PASOS) || 400, RONDAS = Number(process.env.AZAR_RONDAS) || 2;
const SEMILLA = Number(process.env.AZAR_SEMILLA) || (Date.now() % 1e9);
let s = SEMILLA;
const azar = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
const elegir = a => a[Math.floor(azar() * a.length)];
console.log(`Toques al azar: semilla ${SEMILLA}, ${PASOS} pasos × ${RONDAS} rondas (para repetir: AZAR_SEMILLA=${SEMILLA})`);

const TEXTOS = ['', 'a', 'G D Em C', 'zzzz', '💥', '<img src=x onerror=alert(1)>', 'x'.repeat(600), '0', '-1', '99999', '  ', 'Do♯ Re♭', 'C/E | F#m7b5', "'\";--"];
const HASHES = ['#timer=abc123def456.2026-11-16.300-0-0-0', '#timer=roto', '#timer=abc123def456.2030-01-01.1-1-1-1', '#plan=solfeo-5', '#x', '#timer=', '#timer=zzzzzzzzzzzz.2026-02-31.1-1-1-1', ''];
const DANAR = ['repertorio-practica-v1', 'repertorio-retos-v1', 'repertorio-timer-v1', 'repertorio-practica-pref'];
const RAROS = ['null', '7', '"texto"', '{"ses":5}', '[1,2]', '{', '{"ritmo":9,"tempo":"x"}'];

const fallos = [];
for (let ronda = 1; ronda <= RONDAS; ronda++) {
  memoria.clear(); sembrar([['Aleluya', 'C', ['Coro', 'C G Am F']], ['Cuán grande es Él', 'G', ['Verso', 'G D Em C'], ['Coro', 'C G D']], ['Santo', 'D', ['Verso', 'D A Bm G']]]);
  const red = {};
  const n = await navegador('', red);
  const { d, w } = n;
  const bitacora = [];
  const visible = el => !el.closest('[hidden]') && !el.disabled && !el.closest('[inert]');
  // Como una persona: toca lo que tiene delante (la capa abierta: Practicar, canción, ventana), no lo que quedó tapado detrás.
  const frente = () => { const capas = ['.capa', '#practica', '#cancion', '#teoria'].map(q => d.querySelector(q)).filter(e => e && visible(e) && !e.classList.contains('oculta')); return capas.length ? capas[capas.length - 1] : d; };
  for (let i = 0; i < PASOS; i++) {
    const r = azar();
    try {
      if (r < 0.55) {                                    // tocar un botón o enlace
        const cand = [...frente().querySelectorAll('button, a[href], [role=button], summary, input[type=checkbox], input[type=radio]')].filter(visible);
        if (cand.length) { const el = elegir(cand); bitacora.push('toca ' + (el.id || el.textContent.trim().slice(0, 25) || el.tagName)); (el.click ? el.click() : el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }))); }
      } else if (r < 0.70) {                             // escribir en un cuadro
        const cand = [...frente().querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=password]), textarea, select')].filter(visible);
        if (cand.length) {
          const el = elegir(cand); let v = elegir(TEXTOS);
          if (el.tagName === 'SELECT' && el.options.length) v = elegir([...el.options]).value;
          if (el.type === 'range') v = String(Math.floor(azar() * 200));
          bitacora.push(`escribe "${String(v).slice(0, 12)}" en ${el.id || el.tagName}`);
          el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true }));
        }
      } else if (r < 0.82) {                             // teclas
        const k = elegir(['Escape', 'Enter', ' ', '/', '+', '-', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'a', 'b', 'c', 'd', 'e', 'f', 'g', '#', 'r', '1', '2', '3', '4']);
        bitacora.push('tecla ' + k); n.tecla(elegir([d, d.activeElement || d.body]), k);
      } else if (r < 0.87) { bitacora.push('atrás'); w.history.back(); }
      else if (r < 0.91) { const h = elegir(HASHES); bitacora.push('enlace ' + h.slice(0, 30)); w.location.hash = h; }
      else if (r < 0.94) { const c = elegir(DANAR), v = elegir(RAROS); bitacora.push('daña ' + c); try { w.localStorage.setItem(c, v); } catch { /* nada */ } }
      else if (r < 0.96) { red.caido = !red.caido; bitacora.push('red ' + (red.caido ? 'cae' : 'vuelve')); w.dispatchEvent(new w.Event(red.caido ? 'offline' : 'online')); }
      else if (r < 0.98) { bitacora.push('abre Practicar'); const b = n.$('practica-btn'); if (b && visible(b)) b.click(); }
      else { Object.defineProperty(d, 'hidden', { configurable: true, get: () => !!azar() < 0.5 }); bitacora.push('visibilidad'); d.dispatchEvent(new w.Event('visibilitychange')); }
    } catch (e) { fallos.push(`ronda ${ronda}, paso ${i}: la prueba tocó algo que lanzó "${e.message}"\n   últimos pasos: ${bitacora.slice(-8).join(' → ')}`); break; }
    if (i % 25 === 0) await dormir(5);
    if (n.errores.length) { fallos.push(`ronda ${ronda}, paso ${i}: ${n.errores[0].split('\n').slice(0, 4).join(' | ')}\n   últimos pasos: ${bitacora.slice(-10).join(' → ')}`); break; }
  }
  n.cerrar();
}
if (fallos.length) { console.error('\nERRORES ENCONTRADOS:\n' + fallos.join('\n\n') + `\n\nRepetir: AZAR_SEMILLA=${SEMILLA} AZAR_PASOS=${PASOS} AZAR_RONDAS=${RONDAS} npm run test:azar`); process.exit(1); }
console.log('Sin errores de JavaScript.'); process.exit(0);
