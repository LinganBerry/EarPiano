// Metrónomo: clic con Web Audio, sin cargar nada extra. El primer tiempo de cada compás suena más agudo.
// Programa los clics un poco antes de que toquen (así no se desfasa aunque la página se ocupe). Se carga en la página y en test/.
(function (raiz) {
  'use strict';
  const MIN = 30, MAX = 240, POR_DEFECTO = 100, TIEMPOS = 4;
  const ADELANTO = 0.12, CADA_MS = 25, CLAVE = 'repertorio-metronomo-bpm';
  const limitar = b => { const n = Math.round(Number(b)); return Number.isFinite(n) ? Math.min(MAX, Math.max(MIN, n)) : POR_DEFECTO; };
  const hayAudio = () => Boolean(raiz.AudioContext || raiz.webkitAudioContext);
  const nuevoContexto = () => new (raiz.AudioContext || raiz.webkitAudioContext)();
  const leerBpm = () => { try { return limitar(raiz.localStorage.getItem(CLAVE) || POR_DEFECTO); } catch (e) { return POR_DEFECTO; } };
  const guardarBpm = b => { try { raiz.localStorage.setItem(CLAVE, String(b)); } catch (e) { /* nada */ } };

  /** fabrica: () => contexto de audio (para pruebas). Devuelve { bpm, fijar, sonando, iniciar, parar, alternar }. */
  function crear(fabrica) {
    let ctx = null, reloj = null, sonando = false, sig = 0, n = 0, bpm = leerBpm();

    function clic(t, acento) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = acento ? 1500 : 1000;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(acento ? 0.5 : 0.3, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.06);
    }
    function paso() {
      while (sig < ctx.currentTime + ADELANTO) { clic(sig, n % TIEMPOS === 0); sig += 60 / bpm; n++; }
    }
    function iniciar() {
      if (sonando) return true;
      try { ctx = ctx || (fabrica || nuevoContexto)(); } catch (e) { return false; }
      if (!ctx) return false;
      try { if (ctx.resume) ctx.resume(); } catch (e) { /* nada */ }
      sig = ctx.currentTime + 0.06; n = 0; sonando = true;
      reloj = setInterval(paso, CADA_MS); paso();
      return true;
    }
    function parar() { if (reloj) clearInterval(reloj); reloj = null; sonando = false; }
    function fijar(b) { bpm = limitar(b); guardarBpm(bpm); return bpm; }   // el nuevo tempo se aplica desde el siguiente clic
    return { bpm: () => bpm, fijar, sonando: () => sonando, iniciar, parar, alternar: () => (sonando ? (parar(), false) : iniciar()) };
  }

  raiz.Metronomo = { crear, limitar, hayAudio, MIN, MAX };
})(typeof window !== 'undefined' ? window : globalThis);
