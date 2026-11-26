// Transposición: sube o baja acordes, progresiones, letra con acordes y tono, medio tono por vez.
// Solo cambia lo que se VE: lo guardado de la canción no se toca. Lógica pura, sin DOM (se carga en la página y en test/).
(function (raiz) {
  'use strict';
  const BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const SOST = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const BEMO = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const MAYOR = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const MENOR = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
  const CON_BEMOLES = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);
  const ACORDE = /^([A-G])([#b\u266F\u266D]?)([^/]*)(?:\/([A-G])([#b\u266F\u266D]?))?$/;
  const CALIDAD = /^(?:m|min|maj|M|dim|aug|sus|add|\d|[+\u00B0\u00F8\u0394\-()#b\u266F\u266D,])*$/;
  const TONO = /^([A-G])([#b]?)(m?)$/;

  const cambio = a => (a === '#' || a === '\u266F' ? 1 : a ? -1 : 0);
  const clase = (letra, alt) => (BASE[letra] + cambio(alt) + 12) % 12;
  const mod = (x) => ((x % 12) + 12) % 12;
  const esAcorde = t => typeof t === 'string' && t.length > 0 && t.length <= 24 && (m => !!m && CALIDAD.test(m[3]))(ACORDE.exec(t));
  const bemoles = tono => CON_BEMOLES.has(tono);

  /** Un acorde ("F#m7/C#") subido n semitonos. bem = escribir con bemoles. Lo que no es un acorde se devuelve igual. */
  function acorde(a, n, bem) {
    const m = ACORDE.exec(a);
    if (!m || !CALIDAD.test(m[3])) return a;
    const nombres = bem ? BEMO : SOST;
    return nombres[mod(clase(m[1], m[2]) + n)] + m[3] + (m[4] ? '/' + nombres[mod(clase(m[4], m[5]) + n)] : '');
  }

  /** El tono ("G", "F#m") subido n semitonos. Elige un nombre cómodo: Bb y no A#, F# y no Gb. */
  function tono(t, n) {
    const m = TONO.exec(t || '');
    if (!m) return t;
    const i = mod(clase(m[1], m[2]) + n);
    return (m[3] ? MENOR : MAYOR)[i];
  }

  /** Una progresión ("G | C D | Em") subida n semitonos; separadores y palabras que no son acordes quedan igual. */
  function texto(prog, n, bem) {
    if (typeof prog !== 'string' || !n) return prog;
    return prog.replace(/[^\s|]+/g, tok => tok.split(/-(?=[A-G])/).map(x => (esAcorde(x) ? acorde(x, n, bem) : x)).join('-'));
  }

  /** La letra con acordes entre corchetes ("[Am]Cuando [F]sol"): solo cambia lo que es un acorde, no "[Coro]". */
  function letra(l, n, bem) {
    if (typeof l !== 'string' || !n) return l;
    return l.replace(/\[([^\[\]\n]{1,24})\]/g, (todo, dentro) => (esAcorde(dentro.trim()) ? '[' + acorde(dentro.trim(), n, bem) + ']' : todo));
  }

  /** Copia de la canción subida n semitonos (tono, partes y letra). Con n = 0 devuelve la misma canción. */
  function cancion(c, n) {
    n = mod(Number(n) || 0);
    if (!c || !n) return c;
    const nuevo = tono(c.tono, n), bem = bemoles(nuevo);
    return {
      ...c, tono: nuevo,
      partes: (c.partes || []).map(p => ({ ...p, tono: p.tono ? tono(p.tono, n) : p.tono, prog: texto(p.prog, n, bem) })),
      letra: letra(c.letra, n, bem)
    };
  }

  raiz.Transponer = { acorde, tono, texto, letra, cancion, esAcorde, bemoles };
})(typeof window !== 'undefined' ? window : globalThis);
