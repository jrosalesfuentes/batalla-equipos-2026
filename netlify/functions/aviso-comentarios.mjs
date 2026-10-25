/* ============================================================
   BATALLA DE EQUIPOS 2026 · "Comentaron las fotos"
   --------------------------------------------------------
   Netlify ejecuta esto cada cinco minutos. Le pregunta a
   Supabase si hay comentarios nuevos en la galería y, si los
   hay, manda un solo aviso con todos juntos, en vez de uno por
   cada comentario. La base los marca al entregarlos, así que no
   hay forma de que un aviso salga dos veces.
   ============================================================ */

const APP_ID  = 'bcb1e335-ecd1-4dda-8e6b-ea66dd455587';
const URL_SB  = 'https://efuivscdjjpxltytpgxf.supabase.co';
const LLAVE   = 'sb_publishable_HzIf3QRYjGYwWFYjkEJ--g_B8-Tg-_y';
const DESTINO = 'https://batalla-equipos-2026.netlify.app';

export default async () => {
  const clave = process.env.ONESIGNAL_REST_KEY;
  if (!clave) return new Response('Falta ONESIGNAL_REST_KEY', { status: 500 });

  let dichos = [];
  try {
    const r = await fetch(`${URL_SB}/rest/v1/rpc/comentarios_por_avisar`, {
      method: 'POST',
      headers: { apikey: LLAVE, authorization: `Bearer ${LLAVE}`,
                 'content-type': 'application/json' },
      body: '{}'
    });
    if (!r.ok) return new Response('Supabase: ' + await r.text(), { status: 502 });
    dichos = await r.json();
  } catch (e) {
    return new Response('No se pudo consultar: ' + e.message, { status: 502 });
  }

  if (!dichos.length) return new Response('Nada por avisar', { status: 200 });

  /* Un comentario se muestra entero; varios, resumidos, para que
     el aviso quepa en la pantalla del teléfono. */
  const corta = t => String(t || '').replace(/\s+/g, ' ').slice(0, 90);
  const titulo = dichos.length === 1
    ? `${dichos[0].nombre} comentó una foto`
    : `${dichos.length} comentarios nuevos en la galería`;
  const texto = dichos.length === 1
    ? `“${corta(dichos[0].texto)}” · ${dichos[0].album}`
    : dichos.slice(0, 5).map(c => `${c.nombre}: ${corta(c.texto)}`).join('\n')
      + (dichos.length > 5 ? `\ny ${dichos.length - 5} más` : '');

  const ok = await mandar(clave, {
    app_id: APP_ID,
    headings: { en: titulo, es: titulo },
    contents: { en: texto, es: texto },
    url: DESTINO
  });

  return new Response(ok ? `Avisados ${dichos.length} comentarios`
                         : 'OneSignal rechazó el aviso', { status: ok ? 200 : 502 });
};

/* Dos cosas cambian según la antigüedad de la cuenta: cómo se manda
   la clave y cómo se llama el grupo de todos los suscritos. Se
   prueban las combinaciones hasta dar con la que funciona. */
const GRUPOS = ['Total Subscriptions', 'Subscribed Users', 'Active Subscriptions'];

async function mandar(clave, base) {
  for (const forma of ['Key', 'Basic']) {
    let claveMala = false;
    for (const grupo of GRUPOS) {
      try {
        const r = await fetch('https://api.onesignal.com/notifications', {
          method: 'POST',
          headers: { 'content-type': 'application/json',
                     authorization: `${forma} ${clave}` },
          body: JSON.stringify({ ...base, included_segments: [grupo] })
        });
        const datos = await r.json().catch(() => ({}));
        if (r.ok && !datos.errors) return true;
        if (r.status === 401 || r.status === 403) { claveMala = true; break; }
      } catch { return false; }
    }
    if (!claveMala) break;
  }
  return false;
}

/* Cada cinco minutos. */
export const config = { schedule: '*/5 * * * *' };
