// Canciones guardadas en ESTE dispositivo (modo local, el normal para cualquier usuario).
// Hace lo mismo que api/canciones.js pero sin servidor ni contraseña: guardar, borrar (papelera), restaurar, ajustes e importar.
// El modo servidor (con tu contraseña) solo se usa con ?servidor. Se carga después de local.js.
(function (raiz) {
  'use strict';
  const CLAVE = 'earpiano-canciones-v1';
  const LIM = { titulo: 200, artista: 200, nota: 300, enlace: 300, partes: 30, nombre: 60, prog: 500, pista: 200, letra: 1500, letraCancion: 12000 };
  const MAX_CANCIONES = 1000, MAX_IMPORTAR = 300;
  const TONO = /^[A-G][#b]?m?$/, ID = /^[A-Za-z0-9_-]{1,40}$/;
  const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const largo = (v, max) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').split('\n').map(l => l.replace(/[ \t]+$/, '')).join('\n').trim().slice(0, max) : '');
  const url = v => { const t = texto(v, LIM.enlace); return /^https?:\/\/\S+$/i.test(t) ? t : ''; };
  const tonoOk = v => { const t = texto(v, 10); return TONO.test(t) ? t : ''; };
  const limpiar = c => ({
    titulo: texto(c && c.titulo, LIM.titulo), artista: texto(c && c.artista, LIM.artista), tono: tonoOk(c && c.tono),
    nota: texto(c && c.nota, LIM.nota), enlace: url(c && c.enlace), letra: largo(c && c.letra, LIM.letraCancion),
    partes: (Array.isArray(c && c.partes) ? c.partes : []).slice(0, LIM.partes)
      .map(p => ({ nombre: texto(p && p.nombre, LIM.nombre), tono: tonoOk(p && p.tono), prog: texto(p && p.prog, LIM.prog), pista: texto(p && p.pista, LIM.pista), letra: largo(p && p.letra, LIM.letra) }))
      .filter(p => p.prog)
  });
  const guardable = c => Boolean(c.titulo && c.tono);
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const clave = c => norm(c.titulo) + '|' + norm(c.artista);
  const nuevoId = () => { try { return crypto.randomUUID().replace(/-/g, '').slice(0, 16); } catch (e) { return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); } };
  const hoy = () => new Date().toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' });
  const publica = c => { const { borrada, ...resto } = c; return resto; };
  const L = () => raiz.RepertorioLocal;

  const doc = () => {
    const d = L().leer(CLAVE, null);
    return d && typeof d === 'object' && Array.isArray(d.canciones) ? d : { version: 2, nombre: '', intro: '', actualizado: '', canciones: [] };
  };
  // Lo que ve la página: sin las de la papelera.
  const leer = () => { const d = doc(); return { version: 2, nombre: d.nombre || '', intro: d.intro || '', actualizado: d.actualizado || '', canciones: d.canciones.filter(c => !c.borrada).map(publica) }; };
  const buscar = (d, id) => d.canciones.findIndex(c => c.id === id);

  const ACCIONES = {
    guardar(d, b) {
      const c = limpiar(b.cancion);
      if (!guardable(c)) return { error: 'La canción necesita título y un tono válido.', status: 400 };
      const id = b.cancion && b.cancion.id !== undefined ? b.cancion.id : nuevoId();
      if (typeof id !== 'string' || !ID.test(id)) return { error: 'Identificador inválido.', status: 400 };
      const i = buscar(d, id), ahora = new Date().toISOString();
      if (i < 0 && d.canciones.length >= MAX_CANCIONES) return { error: 'Se llegó al máximo de canciones.', status: 400 };
      const g = i >= 0 ? { ...d.canciones[i], ...c, id, actualizada: ahora } : { id, ...c, creada: ahora, actualizada: ahora };
      if (i >= 0) d.canciones[i] = g; else d.canciones.push(g);
      return { cancion: publica(g) };
    },
    borrar(d, b) {
      const i = buscar(d, b.id);
      if (i < 0) return { error: 'No existe esa canción.', status: 404 };
      if (!d.canciones[i].borrada) d.canciones[i] = { ...d.canciones[i], borrada: true, actualizada: new Date().toISOString() };
      return {};
    },
    restaurar(d, b) {
      const i = buscar(d, b.id);
      if (i < 0) return { error: 'No existe esa canción.', status: 404 };
      const { borrada, ...resto } = d.canciones[i];
      d.canciones[i] = { ...resto, actualizada: new Date().toISOString() };
      return { cancion: publica(d.canciones[i]) };
    },
    ajustes(d, b) { d.nombre = texto(b.nombre, 120); d.intro = texto(b.intro, 300); return {}; },
    importar(d, b) {
      if (!Array.isArray(b.canciones) || !b.canciones.length) return { error: 'La copia no trae canciones.', status: 400 };
      if (b.canciones.length > MAX_IMPORTAR) return { error: 'Máximo ' + MAX_IMPORTAR + ' canciones por importación.', status: 400 };
      const porClave = new Map(d.canciones.map((c, i) => [clave(c), i]));
      let nuevas = 0, actualizadas = 0, iguales = 0, omitidas = 0;
      const ahora = new Date().toISOString();
      for (const o of b.canciones) {
        const c = limpiar(o);
        if (!guardable(c)) { omitidas++; continue; }
        let i = o && typeof o.id === 'string' && ID.test(o.id) ? buscar(d, o.id) : -1;
        if (i < 0 && porClave.has(clave(c))) i = porClave.get(clave(c));
        if (i >= 0) {
          const previa = d.canciones[i];
          if (JSON.stringify(limpiar(previa)) === JSON.stringify(c) && !previa.borrada) { iguales++; continue; }
          const { borrada, ...resto } = previa;
          d.canciones[i] = { ...resto, ...c, actualizada: ahora };
          actualizadas++;
        } else {
          if (d.canciones.length >= MAX_CANCIONES) return { error: 'Se llegó al máximo de canciones.', status: 400 };
          const id = o && typeof o.id === 'string' && ID.test(o.id) ? o.id : nuevoId();
          d.canciones.push({ id, ...c, creada: ahora, actualizada: ahora });
          porClave.set(clave(c), d.canciones.length - 1);
          nuevas++;
        }
      }
      if (typeof b.nombre === 'string' && !d.nombre) d.nombre = texto(b.nombre, 120);
      if (typeof b.intro === 'string' && !d.intro) d.intro = texto(b.intro, 300);
      return { nuevas, actualizadas, iguales, omitidas, ...(b.simular ? { simulado: true } : {}) };
    }
  };

  // Misma forma que la respuesta del servidor: { ok, status, j }
  function aplicar(b) {
    if (!b || typeof b !== 'object') return { ok: false, status: 400, j: { error: 'Solicitud inválida' } };
    if (b.accion === 'papelera') return { ok: true, status: 200, j: { canciones: doc().canciones.filter(c => c.borrada).map(publica) } };
    if (!Object.prototype.hasOwnProperty.call(ACCIONES, b.accion)) return { ok: false, status: 400, j: { error: 'Acción desconocida' } };
    const d = doc();
    const res = ACCIONES[b.accion](d, b);
    if (res.error) return { ok: false, status: res.status || 400, j: { error: res.error } };
    if (!res.simulado) {
      d.version = 2; d.actualizado = hoy();
      try { localStorage.setItem(CLAVE, JSON.stringify(d)); }
      catch (e) { return { ok: false, status: 507, j: { error: 'No hay espacio en este dispositivo para guardar.' } }; }
    }
    return { ok: true, status: 200, j: { ok: true, ...res } };
  }

  const api = { leer, aplicar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.RepertorioDatos = api;
})(typeof window !== 'undefined' ? window : globalThis);
