/* =========================================================
   Gotiastudio — Medición para la web de un cliente (paquetes de datos)
   Se instala con una sola línea en la web del cliente (ver GUIA-CLIENTES.md):
     <script src="https://…/medir.js" data-cliente="ID" data-url="…" data-key="…" defer></script>
   Lo que registra se ve en mi-panel.html. Anónimo: sin nombres ni IP; un identificador
   al azar por navegador (visitante) y otro por visita (sesión). Nunca guarda lo que la
   persona escribe en un formulario ni el número o el correo al que le escribe. Registra:
     · pageview  cada página que abre: de dónde llega, la campaña y el dispositivo
     · click     cómo te contacta: WhatsApp, Llamada, Correo, Instagram, Formulario o Compra
     · leave     al salir o cambiar de pestaña: tiempo activo y hasta dónde bajó
   Una compra se marca con data-gotia-compra en el botón, o con gotiaCompra() en la página
   de gracias. Se apaga sola si faltan los datos o el navegador pide "no rastrear".
   ========================================================= */
(() => {
  const me = document.currentScript;
  const { cliente, url, key } = (me && me.dataset) || {};
  if (!cliente || !url || !key) return;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  const endpoint = url.replace(/\/+$/, '') + '/rest/v1/client_events';
  const headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  const rid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
  const cut = (s, n) => (s || '').toString().replace(/\s+/g, ' ').trim().slice(0, n);
  const get = (storage, k) => { try { return storage.getItem(k); } catch (e) { return null; } };
  const put = (storage, k, v) => { try { storage.setItem(k, v); } catch (e) {} };

  // visitante (dura en el navegador) y visita (dura mientras la pestaña siga abierta)
  let visitor = get(localStorage, 'gotia-m-vid');
  if (!visitor) { visitor = rid(); put(localStorage, 'gotia-m-vid', visitor); }
  let session = get(sessionStorage, 'gotia-m-sid'), visitNo = Number(get(sessionStorage, 'gotia-m-vno')) || 0;
  if (!session) {
    session = rid();
    visitNo = Math.min(100000, (Number(get(localStorage, 'gotia-m-vn')) || 0) + 1);
    put(sessionStorage, 'gotia-m-sid', session);
    put(sessionStorage, 'gotia-m-vno', String(visitNo));
    put(localStorage, 'gotia-m-vn', String(visitNo));
  }

  const base = {
    client_id: cliente,
    page: cut(location.pathname, 120) || '/',
    visitor,
    session,
    device: matchMedia('(max-width: 767px)').matches ? 'móvil' : matchMedia('(max-width: 1100px) and (pointer: coarse)').matches ? 'tablet' : 'computador'
  };
  const send = (type, extra, last) => {
    try {
      fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ ...base, type, ...extra }), keepalive: !!last }).catch(() => {});
    } catch (e) {}
  };

  // de dónde llega: el dominio que lo trajo (no la dirección completa) y la campaña, si la hay
  let referrer = '';
  try {
    const r = document.referrer && new URL(document.referrer);
    if (r && r.host !== location.host) referrer = r.host.replace(/^www\./, '');
  } catch (e) {}
  const q = new URLSearchParams(location.search);
  const utm = q.get('utm_source') || (q.has('gclid') ? 'google' : q.has('fbclid') ? 'facebook' : q.has('ttclid') ? 'tiktok' : '');
  const medium = q.get('utm_medium') || (q.has('gclid') || q.has('fbclid') || q.has('ttclid') ? 'cpc' : '');
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  send('pageview', {
    referrer: cut(referrer, 80) || null,
    utm_source: cut(utm, 60) || null,
    utm_medium: cut(medium, 60) || null,
    utm_campaign: cut(q.get('utm_campaign'), 80) || null,
    tz: cut(tz, 40) || null,
    visit_no: visitNo || null
  });

  // cómo te contacta (una vez por cosa en cada página, por si toca dos veces el mismo botón)
  const sent = new Set();
  const contact = (label) => {
    if (sent.has(label)) return;
    sent.add(label);
    send('click', { label });
  };
  const CHANNELS = [
    [/^(https?:\/\/(wa\.me|(api|web)\.whatsapp\.com)\b|whatsapp:)/i, 'WhatsApp'],
    [/^tel:/i, 'Llamada'],
    [/^mailto:/i, 'Correo'],
    [/^https?:\/\/(www\.)?(ig\.me|instagram\.com)\b/i, 'Instagram']
  ];
  document.addEventListener('click', (e) => {
    if (!e.isTrusted) return;
    if (e.target.closest('[data-gotia-compra]')) contact('Compra');
    const a = e.target.closest('a[href]');
    const hit = a && CHANNELS.find(([re]) => re.test(a.href));
    if (hit) contact(hit[1]);
  }, true);
  document.addEventListener('submit', (e) => {
    if (!e.target.matches('[role="search"]') && !e.target.querySelector('input[type="search"]')) contact('Formulario');
  }, true);
  window.gotiaCompra = () => contact('Compra');

  // tiempo activo: solo cuenta mientras la pestaña está a la vista y la persona hizo algo en los
  // últimos 2 minutos (si deja la web abierta y se va, no suma)
  let maxScroll = 0, lastAct = Date.now(), lastTick = Date.now(), active = 0;
  const awake = () => { lastAct = Date.now(); };
  addEventListener('scroll', () => {
    awake();
    const h = document.documentElement.scrollHeight - innerHeight;
    if (h > 0) maxScroll = Math.max(maxScroll, Math.min(100, Math.round(scrollY / h * 100)));
  }, { passive: true });
  ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'].forEach((t) => addEventListener(t, awake, { passive: true }));
  const tick = () => {
    const now = Date.now(), step = Math.min(2500, now - lastTick);
    lastTick = now;
    if (document.visibilityState === 'visible' && now - lastAct <= 120e3) active += step;
  };
  setInterval(tick, 1000);

  // al salir (o al cambiar de pestaña): se manda lo acumulado desde el último envío
  const flush = () => {
    tick();
    const duration = Math.round(active / 1000);
    active = 0;
    if (duration) send('leave', { duration: Math.min(86400, duration), scroll: maxScroll }, true);
  };
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
    else { lastTick = Date.now(); awake(); }
  });
})();
