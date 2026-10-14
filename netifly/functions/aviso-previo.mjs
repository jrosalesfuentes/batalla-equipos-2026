/* ============================================================
   BATALLA DE EQUIPOS 2026 · "Empieza en 20 minutos"
   --------------------------------------------------------
   Netlify ejecuta esto cada cinco minutos. Le pregunta a
   Supabase si hay partidos por empezar y, si los hay, manda un
   solo aviso a todas con quiénes juegan y en qué cancha.
   La base marca cada partido al entregarlo, así que no hay
   forma de que un aviso salga dos veces.
   ============================================================ */

const APP_ID  = 'bcb1e335-ecd1-4dda-8e6b-ea66dd455587';
const URL_SB  = 'https://efuivscdjjpxltytpgxf.supabase.co';
const LLAVE   = 'sb_publishable_HzIf3QRYjGYwWFYjkEJ--g_B8-Tg-_y';
const DESTINO = 'https://batalla-equipos-2026.netlify.app';

export default async () => {
  const clave = process.env.ONESIGNAL_REST_KEY;
  if (!clave) return new Response('Falta ONESIGNAL_REST_KEY', { status: 500 });

  let partidos = [];
  try {
    const r = await fetch(`${URL_SB}/rest/v1/rpc/partidos_por_avisar`, {
      method: 'POST',
      headers: { apikey: LLAVE, authorization: `Bearer ${LLAVE}`,
                 'content-type': 'application/json' },
      body: '{}'
    });
    if (!r.ok) return new Response('Supabase: ' + await r.text(), { status: 502 });
    partidos = await r.json();
  } catch (e) {
    return new Response('No se pudo consultar: ' + e.message, { status: 502 });
  }

  if (!partidos.length) return new Response('Nada por avisar', { status: 200 });

  /* Los tres partidos de un mismo turno van en un solo aviso. */
  const hora = partidos[0].hora;
  const lineas = partidos.map(p =>
    `Cancha ${p.cancha || '?'} · ${p.categoria}: ${p.dupla_1} (${p.equipo_1}) `
    + `vs ${p.dupla_2} (${p.equipo_2})`);
  const texto = lineas.join('\n');

  const ok = await mandar(clave, {
    app_id: APP_ID,
    included_segments: ['Subscribed Users'],
    headings: { en: `Empiezan a las ${hora}`, es: `Empiezan a las ${hora}` },
    contents: { en: texto, es: texto },
    url: DESTINO
  });

  return new Response(ok ? `Avisados ${partidos.length} partidos de las ${hora}`
                         : 'OneSignal rechazó el aviso', { status: ok ? 200 : 502 });
};

/* Las claves nuevas usan "Key" y las antiguas "Basic". */
async function mandar(clave, aviso) {
  for (const forma of ['Key', 'Basic']) {
    try {
      const r = await fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json',
                   authorization: `${forma} ${clave}` },
        body: JSON.stringify(aviso)
      });
      if (r.ok) return true;
      if (r.status !== 401 && r.status !== 403) return false;
    } catch { return false; }
  }
  return false;
}

/* Cada cinco minutos. */
export const config = { schedule: '*/5 * * * *' };
