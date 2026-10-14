/* ============================================================
   BATALLA DE EQUIPOS 2026 · Enviar una notificación
   --------------------------------------------------------
   Esta pieza vive en Netlify, no en la app, porque guarda la
   clave secreta de OneSignal. La app nunca la ve.
   Solo las administradoras pueden mandar avisos: se comprueba
   contra Supabase antes de enviar nada.
   ============================================================ */

const APP_ID  = 'bcb1e335-ecd1-4dda-8e6b-ea66dd455587';
const URL_SB  = 'https://efuivscdjjpxltytpgxf.supabase.co';
const LLAVE   = 'sb_publishable_HzIf3QRYjGYwWFYjkEJ--g_B8-Tg-_y';
const DESTINO = 'https://batalla-equipos-2026.netlify.app';

export default async (peticion) => {
  if (peticion.method !== 'POST')
    return new Response('Solo POST', { status: 405 });

  const clave = process.env.ONESIGNAL_REST_KEY;
  if (!clave)
    return respuesta(500, 'Falta la clave de OneSignal en Netlify (ONESIGNAL_REST_KEY).');

  let cuerpo;
  try { cuerpo = await peticion.json(); }
  catch { return respuesta(400, 'No se entendió la petición.'); }

  const titulo  = (cuerpo.titulo  || '').toString().trim().slice(0, 90);
  const mensaje = (cuerpo.mensaje || '').toString().trim().slice(0, 180);
  if (!titulo) return respuesta(400, 'Falta el título del aviso.');

  /* ---------- ¿quien pide es administradora? ---------- */
  const token = (peticion.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return respuesta(401, 'Hay que entrar como administradora.');

  let esAdmin = false;
  try {
    const r = await fetch(`${URL_SB}/rest/v1/rpc/es_admin`, {
      method: 'POST',
      headers: { apikey: LLAVE, authorization: `Bearer ${token}`,
                 'content-type': 'application/json' },
      body: '{}'
    });
    esAdmin = r.ok && (await r.json()) === true;
  } catch { esAdmin = false; }

  if (!esAdmin) return respuesta(403, 'Esa sesión no es de administradora.');

  /* ---------- enviar ---------- */
  const aviso = {
    app_id: APP_ID,
    included_segments: ['Subscribed Users'],
    headings: { en: titulo, es: titulo },
    contents: { en: mensaje || titulo, es: mensaje || titulo },
    url: cuerpo.url || DESTINO
  };

  /* Las claves nuevas de OneSignal usan "Key" y las antiguas
     "Basic". Probamos la nueva y, si la rechaza, la vieja. */
  for (const forma of ['Key', 'Basic']) {
    try {
      const r = await fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json',
                   authorization: `${forma} ${clave}` },
        body: JSON.stringify(aviso)
      });
      const datos = await r.json().catch(() => ({}));
      if (r.ok && !datos.errors)
        return respuesta(200, 'Aviso enviado.', { destinatarias: datos.recipients ?? null });
      if (r.status !== 401 && r.status !== 403)
        return respuesta(502, detalle(datos) || 'OneSignal rechazó el aviso.');
    } catch (e) {
      return respuesta(502, 'No se pudo hablar con OneSignal: ' + e.message);
    }
  }
  return respuesta(502, 'OneSignal no aceptó la clave. Revísala en Netlify.');
};

const detalle = d => {
  const e = d && d.errors;
  if (!e) return '';
  return Array.isArray(e) ? e.join(' · ') : JSON.stringify(e);
};

const respuesta = (codigo, mensaje, extra = {}) =>
  new Response(JSON.stringify({ ok: codigo === 200, mensaje, ...extra }),
    { status: codigo, headers: { 'content-type': 'application/json' } });

export const config = { path: '/api/avisar' };
