// Repetición espaciada: con el historial de sesiones (que ya se guarda) calcula, por ítem, cuándo toca repasarlo.
// Un fallo lo devuelve mañana; cada acierto seguido espacia más el siguiente repaso (1, 3, ~8, ~20 días…, estilo SM-2 simplificado).
// Lo que acertaste hoy no vuelve a salir hoy, y un error viejo que ya dominaste deja de molestar. Lógica pura, sin DOM.
(function (raiz) {
  'use strict';
  const FACILIDAD = { inicial: 2.5, min: 1.3, max: 2.8, premio: 0.05, castigo: 0.2 };
  const MAX_INTERVALO = 120;   // días: ni lo mejor sabido se pierde de vista más de 4 meses

  const msDia = 86400000;
  const dia = f => Date.parse(f + 'T00:00:00Z') / msDia;
  /** Días enteros de a a b ('AAAA-MM-DD'); positivo si b es después de a. */
  const dias = (a, b) => Math.round(dia(b) - dia(a));
  const sumar = (f, n) => new Date((dia(f) + n) * msDia).toISOString().slice(0, 10);

  /**
   * sesiones: [{ f, q: [[item, 1|0, ms], ...] }]. hoy: 'AAAA-MM-DD'.
   * Devuelve { item: { vistas, fallos, racha, intervalo, facilidad, ultima, vence, atraso } }
   * atraso = días desde que tocaba (0 = toca hoy, negativo = falta tiempo).
   */
  function calcular(sesiones, hoy) {
    // 1) por ítem y por día: un día cuenta como acierto solo si TODAS las respuestas de ese día fueron correctas
    const porItem = new Map();
    for (const s of sesiones || []) {
      if (!s || typeof s.f !== 'string' || !Array.isArray(s.q)) continue;
      for (const e of s.q) {
        if (!Array.isArray(e) || typeof e[0] !== 'string') continue;
        const dias_ = porItem.get(e[0]) || porItem.set(e[0], new Map()).get(e[0]);
        const d = dias_.get(s.f) || { ok: true, n: 0 };
        d.n++; if (!e[1]) d.ok = false;
        dias_.set(s.f, d);
      }
    }
    // 2) se recorre cada ítem día por día, en orden
    const salida = {};
    for (const [item, mapa] of porItem) {
      let racha = 0, intervalo = 0, facilidad = FACILIDAD.inicial, fallos = 0, vistas = 0, ultima = null;
      for (const f of [...mapa.keys()].sort()) {
        const d = mapa.get(f);
        vistas += d.n; ultima = f;
        if (d.ok) {
          racha++;
          intervalo = racha === 1 ? 1 : racha === 2 ? 3 : Math.min(MAX_INTERVALO, Math.round(intervalo * facilidad));
          facilidad = Math.min(FACILIDAD.max, facilidad + FACILIDAD.premio);
        } else {
          fallos++; racha = 0; intervalo = 1;
          facilidad = Math.max(FACILIDAD.min, facilidad - FACILIDAD.castigo);
        }
      }
      const vence = sumar(ultima, intervalo);
      salida[item] = { vistas, fallos, racha, intervalo, facilidad: Math.round(facilidad * 100) / 100, ultima, vence, atraso: dias(vence, hoy) };
    }
    return salida;
  }

  /** Ítems que toca repasar hoy y que alguna vez fallaste (lo que nunca fallas no hace falta vigilarlo), los más atrasados primero. */
  function pendientes(res, { max = 8, filtro } = {}) {
    return Object.entries(res)
      .filter(([k, r]) => r.atraso >= 0 && r.fallos > 0 && (!filtro || filtro(k)))
      .sort((a, b) => b[1].atraso - a[1].atraso || a[1].facilidad - b[1].facilidad || a[0].localeCompare(b[0]))
      .slice(0, max);
  }

  raiz.Repaso = { calcular, pendientes, dias, FACILIDAD };
})(typeof window !== 'undefined' ? window : globalThis);
