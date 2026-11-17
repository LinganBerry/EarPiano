// Lectura a primera vista: sale una frase corta en el pentagrama; la lees, la tocas en tu piano y luego miras cuáles eran.
// Dos modos: notas largas (4 notas, sin ritmo) y con ritmo (un compás de 4/4 o 3/4 con negras, blancas, corcheas y silencios) con metrónomo.
// La frase NO suena y no hay puntos ni estadísticas: es solo para leer. La lógica (crearFrase, crearFraseRitmica) no usa el DOM y se prueba en test/.
(function (raiz) {
  'use strict';
  const N = raiz.Notacion;
  if (!N || !N.svgFrase) return;

  // Posiciones permitidas en el pentagrama (0 = primera línea). Sol: Do4 a Sol5. Fa: La2 a Do4, la mano izquierda de siempre.
  const RANGO = { sol: [-2, 9], fa: [1, 10] };
  // "grados": casi siempre de una nota a la vecina (la base de leer). "saltos": terceras, cuartas y repeticiones.
  const PASOS = { grados: [-1, -1, 1, 1, 0], saltos: [-3, -2, -1, 1, 2, 3] };

  // Posiciones de las notas de una frase: casi siempre pasos a la nota vecina o pequeños saltos, con al menos 3 notas distintas (o todas distintas si son menos de 3).
  function posiciones(clave, movimiento, largo, azar) {
    const [lo, hi] = RANGO[clave], pasos = PASOS[movimiento === 'saltos' ? 'saltos' : 'grados'], minimo = Math.min(3, largo);
    let pos = [];
    for (let intento = 0; intento < 50 && new Set(pos).size < minimo; intento++) {
      pos = [lo + 2 + Math.floor(azar() * (hi - lo - 3))];   // empieza lejos de los bordes
      while (pos.length < largo) {
        const ult = pos[pos.length - 1], d = pasos[Math.floor(azar() * pasos.length)];
        pos.push(ult + d < lo || ult + d > hi ? ult - d : ult + d);        // si se sale del pentagrama, rebota hacia el otro lado
      }
    }
    return pos;
  }
  const elegirClave = (op, azar) => (op.clave === 'sol' || op.clave === 'fa' ? op.clave : (azar() < 0.5 ? 'sol' : 'fa'));

  function crearFrase(op = {}, azar = Math.random, largo = 4) {
    const clave = elegirClave(op, azar), pos = posiciones(clave, op.movimiento, largo, azar);
    const notas = pos.map(p => N.deIndice(N.CLAVES[clave].base + p, 0));
    return { clave, pos, notas, nombres: notas.map(n => N.nombre(n)), midis: notas.map(n => N.midi(n)) };
  }

  // --- ritmo ---
  // Todo se mide en corcheas: corchea = 1, negra = 2, blanca = 4. Cada tiempo (negra) dura 2 corcheas. Las figuras empiezan siempre en un tiempo,
  // salvo las corcheas, que van en pares dentro de un tiempo. De menos a más difícil: 'negras' (negras y blancas), 'corcheas' (+ pares de corcheas), 'silencios' (+ silencios).
  const COMPASES = { '4/4': { tiempos: 4 }, '3/4': { tiempos: 3 } };
  const NIVELES_RITMO = ['largas', 'negras', 'corcheas', 'silencios'];
  const FIGURA = { 1: 'corchea', 2: 'negra', 4: 'blanca' };
  const FIJOS = {                       // por si el azar no diera una combinación válida (solo con un azar de mentira): siempre cumplen las reglas del nivel
    '4/4': { 1: ['n', 'n', 'b'], 2: ['n', 'p', 'b'], 3: ['n', 'sn', 'p', 'n'] },
    '3/4': { 1: ['n', 'b'], 2: ['n', 'p', 'n'], 3: ['n', 'pc', 'n'] }
  };
  function armar(codigos) {
    const ev = []; let t = 0;
    const poner = (d, silencio) => { ev.push({ t, d, silencio }); t += d; };
    for (const c of codigos) {
      if (c === 'n') poner(2, false); else if (c === 'b') poner(4, false);
      else if (c === 'sn') poner(2, true); else if (c === 'sb') poner(4, true);
      else if (c === 'p') { poner(1, false); poner(1, false); }
      else if (c === 'p1') { poner(1, true); poner(1, false); }     // silencio de corchea + corchea
      else if (c === 'pc') { poner(1, false); poner(1, true); }     // corchea + silencio de corchea
    }
    return ev;
  }
  function crearRitmo(op = {}, azar = Math.random) {
    const compas = COMPASES[op.compas] ? op.compas : '4/4', T = COMPASES[compas].tiempos;
    const nivel = Math.max(1, NIVELES_RITMO.indexOf(op.ritmo));
    for (let intento = 0; intento < 200; intento++) {
      const codigos = [];
      for (let b = 0; b < T;) {
        const blanca = b + 2 <= T && (T === 3 || b % 2 === 0), ops = ['n', 'n'];
        if (blanca) ops.push('b');
        if (nivel >= 2) ops.push('p', 'p');
        if (nivel >= 3) { ops.push('pc'); if (b > 0) { ops.push('sn', 'p1'); if (blanca) ops.push('sb'); } }   // la frase nunca empieza con silencio
        const c = ops[Math.floor(azar() * ops.length)];
        codigos.push(c); b += c === 'b' || c === 'sb' ? 2 : 1;
      }
      const ev = armar(codigos);
      if (ev.filter(e => !e.silencio).length < 2) continue;
      if (nivel >= 2 && !ev.some(e => e.d === 1)) continue;
      if (nivel >= 3 && !ev.some(e => e.silencio)) continue;
      return ev;
    }
    return armar(FIJOS[compas][nivel]);
  }
  function crearFraseRitmica(op = {}, azar = Math.random) {
    const clave = elegirClave(op, azar), compas = COMPASES[op.compas] ? op.compas : '4/4';
    const ritmo = crearRitmo({ ...op, compas }, azar), sonoras = ritmo.filter(e => !e.silencio).length;
    const pos = posiciones(clave, op.movimiento, sonoras, azar);
    const notas = pos.map(p => N.deIndice(N.CLAVES[clave].base + p, 0));
    let k = 0;
    const eventos = ritmo.map(e => e.silencio ? { ...e, figura: 'silencio de ' + FIGURA[e.d] } : { ...e, figura: FIGURA[e.d], pos: pos[k], nota: notas[k++] });
    const nombres = notas.map(n => N.nombre(n));
    k = 0;
    return { clave, compas, eventos, pos, notas, nombres, midis: notas.map(n => N.midi(n)), texto: eventos.map(e => (e.silencio ? 'silencio' : nombres[k++])) };
  }
  // Datos guardados del ritmo y el metrónomo: lo dañado o raro vuelve a lo normal (no se rompe nada).
  const RITMO0 = { ritmo: 'largas', compas: '4/4', tempo: 70, cuenta: true };
  function limpiarRitmo(g) {
    const o = g && typeof g === 'object' && !Array.isArray(g) ? g : {}, M = raiz.Metronomo;
    return {
      ritmo: NIVELES_RITMO.includes(o.ritmo) ? o.ritmo : RITMO0.ritmo,
      compas: COMPASES[o.compas] ? o.compas : RITMO0.compas,
      tempo: M ? M.limpiarTempo(o.tempo) : RITMO0.tempo,
      cuenta: typeof o.cuenta === 'boolean' ? o.cuenta : RITMO0.cuenta
    };
  }

  // Dibujo de un compás: clave, compás, figuras con sus silencios y los números de los tiempos debajo (1 2 3 4). Todo con trazos del SVG (no depende de la fuente, salvo la clave).
  function svgRitmo(clave, frase) {
    const C = N.CLAVES[clave], T = COMPASES[frase.compas].tiempos, X0 = 100, U = (240 - X0) / (T * 2);
    const r = v => Math.round(v * 10) / 10, Y = p => 100 - p * 6, partes = [];
    const raya = (x1, y1, x2, y2, w = 1.2) => `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="currentColor" stroke-width="${w}"/>`;
    for (const p of [0, 2, 4, 6, 8]) partes.push(raya(8, Y(p), 252, Y(p)));
    partes.push(`<text x="16" y="${Y(C.linea)}" font-size="48" font-family="Atril Notas, Bravura, Noto Music, serif" fill="currentColor" aria-hidden="true">${C.glifo}</text>`);
    const [num, den] = frase.compas.split('/');
    for (const [txt, y] of [[num, 75], [den, 99]]) partes.push(`<text x="68" y="${y}" font-size="30" font-weight="700" font-family="Georgia, serif" fill="currentColor" text-anchor="middle" aria-hidden="true">${txt}</text>`);
    partes.push(raya(246, Y(0), 246, Y(8)), raya(250.5, Y(0), 250.5, Y(8), 3));
    const lineasExtra = (x, p) => {
      if (p <= -2) for (let q = -2; q >= (p % 2 === 0 ? p : p + 1); q -= 2) partes.push(raya(x - 12, Y(q), x + 12, Y(q)));
      if (p >= 10) for (let q = 10; q <= (p % 2 === 0 ? p : p - 1); q += 2) partes.push(raya(x - 12, Y(q), x + 12, Y(q)));
    };
    const cabeza = (x, p, hueca) => `<ellipse cx="${r(x)}" cy="${Y(p)}" rx="7.4" ry="5.3" transform="rotate(-20 ${r(x)} ${Y(p)})" ${hueca ? 'fill="none" stroke="currentColor" stroke-width="2"' : 'fill="currentColor"'}/>`;
    const SOBRA = 38;                                  // largo de la plica
    const resto = (x, d) => {
      const c = Y(4);
      if (d === 4) return `<rect x="${r(x - 8)}" y="${c - 6}" width="16" height="6" fill="currentColor"/>`;
      if (d === 2) return `<path d="M${r(x - 3)} ${c - 15} L${r(x + 4)} ${c - 6} L${r(x - 3)} ${c + 3} Q${r(x + 7)} ${c + 4} ${r(x + 3)} ${c + 14} Q${r(x - 1)} ${c + 9} ${r(x - 4)} ${c + 12}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
      return `<circle cx="${r(x - 3)}" cy="${c - 5}" r="3" fill="currentColor"/><path d="M${r(x - 3)} ${c - 5} Q${r(x + 3)} ${c - 6} ${r(x + 5)} ${c - 10} L${r(x - 3)} ${c + 13}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    };
    const ev = frase.eventos;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i], x = X0 + e.t * U;
      if (e.silencio) { partes.push(resto(x, e.d)); continue; }
      const sig = ev[i + 1], par = e.d === 1 && e.t % 2 === 0 && sig && sig.d === 1 && !sig.silencio && sig.t === e.t + 1;
      if (par) {
        const x2 = X0 + sig.t * U, abajo = (e.pos + sig.pos) / 2 >= 4, dx = abajo ? -6.6 : 6.6;
        const yf = abajo ? Math.max(Y(e.pos), Y(sig.pos)) + SOBRA : Math.min(Y(e.pos), Y(sig.pos)) - SOBRA;
        lineasExtra(x, e.pos); lineasExtra(x2, sig.pos);
        partes.push(cabeza(x, e.pos), cabeza(x2, sig.pos), raya(x + dx, Y(e.pos), x + dx, yf, 1.6), raya(x2 + dx, Y(sig.pos), x2 + dx, yf, 1.6));
        partes.push(`<line x1="${r(x + dx)}" y1="${r(yf)}" x2="${r(x2 + dx)}" y2="${r(yf)}" stroke="currentColor" stroke-width="5"/>`);
        i++; continue;
      }
      const abajo = e.pos >= 4, dx = abajo ? -6.6 : 6.6, yf = abajo ? Y(e.pos) + SOBRA : Y(e.pos) - SOBRA;
      lineasExtra(x, e.pos);
      partes.push(cabeza(x, e.pos, e.d === 4));
      if (e.d >= 2) partes.push(raya(x + dx, Y(e.pos), x + dx, yf, 1.6));
      if (e.d === 1) {                                 // corchea sola: plica con banderín
        partes.push(raya(x + dx, Y(e.pos), x + dx, yf, 1.6));
        partes.push(abajo ? `<path d="M${r(x + dx)} ${r(yf)} C${r(x + dx)} ${r(yf - 10)} ${r(x + dx + 11)} ${r(yf - 12)} ${r(x + dx + 8)} ${r(yf - 24)}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`
          : `<path d="M${r(x + dx)} ${r(yf)} C${r(x + dx)} ${r(yf + 10)} ${r(x + dx + 11)} ${r(yf + 12)} ${r(x + dx + 8)} ${r(yf + 24)}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`);
      }
    }
    for (let b = 0; b < T; b++) partes.push(`<text class="rc-n" data-b="${b + 1}" x="${r(X0 + b * 2 * U)}" y="150" font-size="12" font-weight="700" font-family="system-ui, sans-serif" fill="currentColor" text-anchor="middle" aria-hidden="true">${b + 1}</text>`);
    const figs = ev.length;
    return `<svg xmlns="http://www.w3.org/2000/svg" class="pentagrama" viewBox="0 0 260 158" role="img" aria-label="${C.nombre}: un compás de ${frase.compas} con ${figs} figuras">${partes.join('')}</svg>`;
  }
  const api = { RANGO, COMPASES, NIVELES_RITMO, RITMO0, crearFrase, crearRitmo, crearFraseRitmica, limpiarRitmo, svgRitmo };
  raiz.Lectura = api;
  if (typeof document === 'undefined') return;

  // --- pantalla (dentro de la capa de Practicar) ---
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) k === 'rol' ? n.setAttribute('role', v) : k.includes('-') ? n.setAttribute(k, v) : (n[k] = v);
    n.append(...kids.flat().filter(k => k != null && k !== false));
    return n;
  };
  const nodoSvg = texto => document.importNode(new DOMParser().parseFromString(texto, 'image/svg+xml').documentElement, true);
  const PREF = 'repertorio-lectura-pref', PREF_R = 'repertorio-lectura-ritmo', { leer, guardar } = window.RepertorioLocal;
  const PREF0 = { clave: 'ambas', movimiento: 'grados' };
  let caja = null, volverFn = null, vista = 'menu', pref = { ...PREF0 }, pr = { ...RITMO0 }, frase = null, n = 0, revelada = false;
  let metro = null, reloj = null, panel = null, ultimo = null;
  const barra = (izq, centro) => el('div', { className: 'cbarra' }, izq, el('span', { className: 'ctitulo' }, centro));
  const poner = (...hijos) => { caja.replaceChildren(...hijos); caja.scrollTop = 0; };
  const guardarTodo = () => { guardar(PREF, { clave: pref.clave, movimiento: pref.movimiento }); guardar(PREF_R, pr); };
  const NOMBRE_RITMO = { largas: 'Notas largas', negras: 'Negras y blancas', corcheas: '+ Corcheas', silencios: '+ Silencios' };

  // --- metrónomo: el mismo panel se reutiliza al ver la respuesta, para que no se corte el pulso ---
  function marcarPulso(p) {
    ultimo = p;
    if (!panel) return;
    panel.querySelectorAll('.lc-p').forEach((b, i) => b.classList.toggle('on', !!p && i + 1 === p.beat));
    const estado = panel.querySelector('#lc-estado');
    if (estado) estado.textContent = !metro || !metro.estado().corriendo ? 'Parado' : p && p.cuenta ? 'Cuenta de entrada…' : 'Toca';
    if (caja) caja.querySelectorAll('.rc-n').forEach(t => t.classList.toggle('on', !!p && Number(t.getAttribute('data-b')) === p.beat));
  }
  function pararMetro() {
    if (metro) metro.detener();
    metro = null; ultimo = null;
    const b = panel && panel.querySelector('#lc-metro-play'); if (b) { b.textContent = '▶ Metrónomo'; b.setAttribute('aria-pressed', 'false'); }
    marcarPulso(null);
  }
  function alternarMetro() {
    if (metro) { pararMetro(); return; }
    const M = window.Metronomo; if (!M) return;
    if (!reloj) reloj = M.relojAudio(window);
    metro = M.crear({ reloj, tempo: pr.tempo, tiempos: COMPASES[pr.compas].tiempos, cuenta: pr.cuenta, alPulso: marcarPulso });
    metro.iniciar();
    const b = panel.querySelector('#lc-metro-play'); b.textContent = '■ Parar'; b.setAttribute('aria-pressed', 'true');
    const aviso = panel.querySelector('#lc-sin-sonido'); if (aviso) aviso.hidden = reloj.sonido;
    marcarPulso(null);
  }
  function crearPanel() {
    const M = window.Metronomo; if (!M) return null;
    const tiempos = COMPASES[pr.compas].tiempos;
    const valor = el('span', { className: 'lc-tempo-v', id: 'lc-tempo-valor' }, String(pr.tempo));
    const poner_ = v => { pr.tempo = M.limpiarTempo(v); valor.textContent = String(pr.tempo); rango.value = String(pr.tempo); if (metro) metro.cambiarTempo(pr.tempo); };
    const rango = el('input', { type: 'range', id: 'lc-tempo', min: String(M.TEMPO_MIN), max: String(M.TEMPO_MAX), step: '1', value: String(pr.tempo), 'aria-label': 'Tempo en pulsos por minuto' });
    rango.addEventListener('input', () => poner_(rango.value));
    rango.addEventListener('change', () => { poner_(rango.value); guardarTodo(); });
    const paso = (txt, d, id, desc) => el('button', { type: 'button', id, 'aria-label': desc, onclick: () => { poner_(pr.tempo + d); guardarTodo(); } }, txt);
    const puntos = el('div', { className: 'lc-pulsos', id: 'lc-pulsos', rol: 'img', 'aria-label': 'Indicador del pulso' }, ...Array.from({ length: tiempos }, (_, i) => el('span', { className: 'lc-p' + (i === 0 ? ' acento' : '') })));
    const cuenta = el('input', { type: 'checkbox', id: 'lc-cuenta', checked: pr.cuenta });
    cuenta.addEventListener('change', () => { pr.cuenta = cuenta.checked; if (metro) metro.ponerCuenta(pr.cuenta); guardarTodo(); });
    return el('div', { className: 'lc-metro', id: 'lc-metro' },
      el('button', { type: 'button', className: 'primario', id: 'lc-metro-play', 'aria-pressed': 'false', onclick: alternarMetro }, '▶ Metrónomo'),
      puntos, el('p', { className: 'a lc-estado', id: 'lc-estado' }, 'Parado'),
      el('div', { className: 'lc-metro-fila' }, paso('−5', -5, 'lc-tempo-menos', 'Bajar el tempo 5 pulsos'), el('div', { className: 'lc-tempo-caja' }, valor, el('span', { className: 'a' }, 'pulsos por minuto')), paso('+5', 5, 'lc-tempo-mas', 'Subir el tempo 5 pulsos')),
      rango,
      el('label', { className: 'lc-cuenta' }, cuenta, ' Compás de cuenta antes de empezar'),
      el('p', { className: 'a', id: 'lc-sin-sonido', hidden: true }, 'Este aparato no deja sonar el clic: solo se ve el pulso.'));
  }

  function menu(conservar) {
    pararMetro(); panel = null;
    vista = 'menu'; frase = null;
    const y = conservar ? caja.scrollTop : 0;
    const opcion = (campo, valor, texto) => el('button', {
      type: 'button', 'data-op': campo + ':' + valor, 'aria-pressed': String((campo === 'ritmo' || campo === 'compas' ? pr : pref)[campo] === valor),
      onclick: () => {
        (campo === 'ritmo' || campo === 'compas' ? pr : pref)[campo] = valor; guardarTodo(); menu(true);
        const b = caja.querySelector(`[data-op="${campo}:${valor}"]`); if (b) b.focus({ preventScroll: true });
      }
    }, texto);
    poner(
      barra(el('button', { type: 'button', title: 'Volver a Practicar', onclick: () => { vista = 'fuera'; volverFn(); } }, '← Practicar'), 'Lectura a primera vista'),
      el('div', { className: 'ccuerpo', 'data-lectura': '1' },
        el('p', {}, 'Sale una frase corta. Léela sin parar y tócala en tu piano; después mira cuáles eran. No suena ni cuenta puntos: es solo para leer.'),
        el('div', { className: 'parte' }, el('h3', {}, 'Clave'),
          el('div', { className: 'tg', rol: 'group', 'aria-label': 'Clave' }, opcion('clave', 'sol', 'Sol'), opcion('clave', 'fa', 'Fa'), opcion('clave', 'ambas', 'Las dos'))),
        el('div', { className: 'parte' }, el('h3', {}, 'Movimiento'),
          el('div', { className: 'tg', rol: 'group', 'aria-label': 'Movimiento' }, opcion('movimiento', 'grados', 'Por grados'), opcion('movimiento', 'saltos', 'Con saltos'))),
        el('div', { className: 'parte' }, el('h3', {}, 'Ritmo'),
          el('div', { className: 'tg', rol: 'group', 'aria-label': 'Ritmo' }, ...NIVELES_RITMO.map(v => opcion('ritmo', v, NOMBRE_RITMO[v])))),
        el('div', { className: 'parte' }, el('h3', {}, 'Compás'),
          el('div', { className: 'tg', rol: 'group', 'aria-label': 'Compás' }, opcion('compas', '4/4', '4/4'), opcion('compas', '3/4', '3/4'))),
        el('p', {}, el('button', { type: 'button', className: 'primario', id: 'lc-empezar', onclick: siguiente }, 'Empezar'))));
    caja.scrollTop = y;
  }
  function siguiente() {
    frase = pr.ritmo === 'largas' ? crearFrase(pref) : crearFraseRitmica({ ...pref, ritmo: pr.ritmo, compas: pr.compas });
    n++; revelada = false; vista = 'frase'; pintar();
  }
  function pintar() {
    const todasEnPiano = frase.midis.every(m => m >= 60 && m <= 83);      // el teclado dibujado va de Do4 a Si5
    if (!panel) panel = crearPanel();
    const cuerpo = [el('div', { className: 'pr-visual rc-pent' }, nodoSvg(frase.eventos ? svgRitmo(frase.clave, frase) : N.svgFrase(frase.clave, frase.notas)))];
    if (panel) cuerpo.push(panel);
    if (revelada) {
      cuerpo.push(el('p', { className: 'rt-notas', id: 'lc-notas' }, (frase.texto || frase.nombres).join(' – ')));
      if (todasEnPiano) cuerpo.push(el('div', { className: 'pr-visual' }, nodoSvg(N.svgTeclado({ marcar: frase.midis }))));
    } else cuerpo.push(el('p', { className: 'a' }, 'Léela y tócala en tu piano.'));
    cuerpo.push(el('div', { className: 'rt-botones' }, el('button', { type: 'button', className: 'primario', id: 'lc-boton', onclick: () => { if (revelada) siguiente(); else { revelada = true; pintar(); } } }, revelada ? 'Otra frase' : 'Ver cuáles son')));
    poner(barra(el('button', { type: 'button', title: 'Salir (Esc)', onclick: () => history.back() }, '← Salir'), `Frase ${n}`), el('div', { className: 'ccuerpo pr-sesion', 'data-lectura': '1' }, ...cuerpo));
    marcarPulso(ultimo);
    const b = document.getElementById('lc-boton'); if (b) b.focus({ preventScroll: true });
  }

  // Si la pantalla se oculta (cambias de app o se apaga), el metrónomo se detiene solo.
  document.addEventListener('visibilitychange', () => { if (document.hidden && metro) pararMetro(); });

  api.abrir = (cajaPracticar, volver) => {
    caja = cajaPracticar; volverFn = volver; n = 0; panel = null;
    const g = leer(PREF) || {};
    pref = { ...PREF0, ...(typeof g === 'object' && !Array.isArray(g) ? g : {}) };
    if (!['sol', 'fa', 'ambas'].includes(pref.clave)) pref.clave = 'ambas';
    if (!['grados', 'saltos'].includes(pref.movimiento)) pref.movimiento = 'grados';
    pr = limpiarRitmo(leer(PREF_R));
    menu(); caja.focus({ preventScroll: true });
  };
  api.atras = () => { if (vista === 'frase') { menu(); return true; } pararMetro(); return false; };
})(typeof window !== 'undefined' ? window : globalThis);
