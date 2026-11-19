// Lo practicado en TimerPiano, para mostrarlo aquí: POST /api/timer { token } -> los totales (ver lib/totales.js) o { vacio: true } si aún no hay.
// Lee SOLO timerpiano/totales.json (el resumen que TimerPiano deja al día), del mismo almacén de Vercel Blob. Solo lee: no escribe nada.
// Usa el mismo pase que el editor y TimerPiano (mismo SESSION_SECRET en los dos proyectos).
import { leer } from '../lib/almacen.js';
import { tokenValido, problemaConClave } from '../lib/auth.js';
import { RUTA_TOTALES, limpiarTotales } from '../lib/totales.js';

const responder = (cuerpo, status = 200) => Response.json(cuerpo, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  const problema = problemaConClave();
  if (problema) return responder({ error: problema }, 500);
  let cuerpo;
  try {
    const bruto = await request.text();
    if (bruto.length > 2000) return responder({ error: 'Los datos son demasiado grandes' }, 413);
    cuerpo = JSON.parse(bruto);
  } catch { return responder({ error: 'Solicitud inválida' }, 400); }
  if (!cuerpo || typeof cuerpo !== 'object') return responder({ error: 'Solicitud inválida' }, 400);
  if (!tokenValido(cuerpo.token)) return responder({ error: 'Sesión no válida o vencida' }, 401);
  try {
    const r = await leer(RUTA_TOTALES);
    const t = r && limpiarTotales(r.data);
    return responder(t || { vacio: true });
  } catch (e) {
    console.error('POST /api/timer:', e);
    return responder({ error: 'No se pudo leer lo de TimerPiano. Intenta de nuevo.' }, 500);
  }
}
