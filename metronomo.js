// Metrónomo sin internet: clic con Web Audio (nada que descargar) e indicador del pulso.
// La lógica (crear) no usa el DOM ni el audio real: recibe un "reloj" y se prueba en test/ con un reloj falso.
//  - reloj = { sonido, ahora(), clic(t, acento), reanudar?() }  (t y ahora() en segundos)
// Los clics se programan un poquito por delante (así no se atrasan aunque el teléfono se ocupe) y el indicador
// se enciende cuando llega el momento de cada clic.
(function (raiz) {
  'use strict';
  const TEMPO_MIN = 50, TEMPO_MAX = 120, TEMPO0 = 70;
  const ADELANTO = 0.15, CADA_MS = 25, SALTO_MAX = 0.25;

  // Deja el tempo como entero entre 50 y 120. Si el dato guardado está dañado (texto raro, null, etc.), usa 70.
  function limpiarTempo(v) {
    const ok = typeof v === 'number' || (typeof v === 'string' && v.trim() !== '');
    const n = ok ? Math.round(Number(v)) : NaN;
    return Number.isFinite(n) ? Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, n)) : TEMPO0;
  }

  function crear(opc = {}) {
    const reloj = opc.reloj, alPulso = opc.alPulso || (() => {});
    const cada = opc.cada || ((fn, ms) => { const id = setInterval(fn, ms); return () => clearInterval(id); });
    let tempo = limpiarTempo(opc.tempo), tiempos = Math.max(1, Math.min(12, Math.round(Number(opc.tiempos)) || 4)), cuenta = opc.cuenta !== false;
    let corriendo = false, proximo = 0, i = 0, enCuenta = false, cola = [], parar = null;

    function emitir() {
      const t = reloj.ahora();
      while (cola.length && cola[0].t <= t) { const p = cola.shift(); alPulso({ beat: p.beat + 1, tiempos: p.tiempos, acento: p.beat === 0, cuenta: p.cuenta }); }
    }
    function tick() {
      if (!corriendo) return;
      const ahora = reloj.ahora();
      if (proximo < ahora - SALTO_MAX) proximo = ahora + 0.05;       // la pestaña se durmió o el teléfono se colgó: no soltar una ráfaga de clics atrasados
      while (proximo < ahora + ADELANTO) {
        try { reloj.clic(proximo, i === 0); } catch (e) { /* sin sonido: el indicador sigue */ }
        cola.push({ t: proximo, beat: i, tiempos, cuenta: enCuenta });
        proximo += 60 / tempo;
        if (++i >= tiempos) { i = 0; enCuenta = false; }
      }
      emitir();
    }
    const api = {
      iniciar() {
        if (corriendo) return;
        try { if (reloj.reanudar) { const p = reloj.reanudar(); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* nada */ }
        corriendo = true; i = 0; enCuenta = cuenta; cola = []; proximo = reloj.ahora() + 0.08;
        parar = cada(tick, CADA_MS); tick();
      },
      detener() { corriendo = false; cola = []; if (parar) { parar(); parar = null; } },
      cambiarTempo(v) { tempo = limpiarTempo(v); return tempo; },          // se nota desde el siguiente pulso
      ponerTiempos(n) { tiempos = Math.max(1, Math.min(12, Math.round(Number(n)) || 4)); if (i >= tiempos) i = 0; },
      ponerCuenta(v) { cuenta = !!v; },
      estado: () => ({ corriendo, tempo, tiempos, cuenta, enCuenta }),
      tick
    };
    return api;
  }

  // Reloj sin sonido (si el aparato no tiene Web Audio): solo se ve el pulso.
  function relojSilencioso() {
    const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    return { sonido: false, ahora, clic() {} };
  }
  // Reloj con sonido: un clic corto (agudo en el tiempo 1, más grave en los demás).
  function relojAudio(g = raiz) {
    const AC = g.AudioContext || g.webkitAudioContext;
    if (!AC) return relojSilencioso();
    let ctx; try { ctx = new AC(); } catch (e) { return relojSilencioso(); }
    return {
      sonido: true,
      ahora: () => ctx.currentTime,
      reanudar: () => (ctx.state === 'suspended' && ctx.resume ? ctx.resume() : undefined),
      clic(t, acento) {
        const o = ctx.createOscillator(), v = ctx.createGain();
        o.type = 'sine'; o.frequency.value = acento ? 1760 : 1175;
        v.gain.setValueAtTime(0.0001, t);
        v.gain.linearRampToValueAtTime(acento ? 0.9 : 0.6, t + 0.002);
        v.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        o.connect(v); v.connect(ctx.destination); o.start(t); o.stop(t + 0.06);
      }
    };
  }

  raiz.Metronomo = { TEMPO_MIN, TEMPO_MAX, TEMPO0, limpiarTempo, crear, relojAudio, relojSilencioso };
})(typeof window !== 'undefined' ? window : globalThis);
