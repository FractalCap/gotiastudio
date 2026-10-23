/* =========================================================
   Gotiastudio — Registro de visitas (para el panel admin)
   Anónimo: sin nombres ni IP; un identificador al azar por navegador
   (visitante) y otro por visita (sesión). Registra:
     · pageview  al abrir la página: de dónde llega (y la campaña), dispositivo,
                 versión, zona horaria y si es su 1.ª, 2.ª… visita
     · section   cada sección (o pantalla de planes) que llega a ver, una vez
     · click     WhatsApp (con el plan que pide), Instagram, correo, formulario, "3D"
     · interact  lo que toca: preguntas, burbujas, demos de los planes, menú…
     · leave     al salir o cambiar de pestaña: tiempo activo, hasta dónde bajó,
                 cuánto tardó en cargar y cuántos segundos pasó en cada sección
   Se apaga sola si supabase-config.js está vacío o el navegador pide
   "no rastrear". Los datos van directo a Supabase (solo se pueden agregar).
   ========================================================= */
(() => {
  const cfg = window.GOTIA_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey) return;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  const endpoint = cfg.url.replace(/\/+$/, '') + '/rest/v1/events';
  const headers = {
    apikey: cfg.anonKey,
    Authorization: 'Bearer ' + cfg.anonKey,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal'
  };
  const rid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
  const cut = (s, n) => (s || '').toString().replace(/\s+/g, ' ').trim().slice(0, n);
  const get = (storage, key) => { try { return storage.getItem(key); } catch (e) { return null; } };
  const put = (storage, key, v) => { try { storage.setItem(key, v); } catch (e) {} };

  // visitante (dura en el navegador) y visita (dura mientras la pestaña siga abierta)
  let visitor = get(localStorage, 'gotia-vid');
  if (!visitor) { visitor = rid(); put(localStorage, 'gotia-vid', visitor); }
  let session = get(sessionStorage, 'gotia-sid'), visitNo = Number(get(sessionStorage, 'gotia-vno')) || 0;
  if (!session) {
    session = rid();
    visitNo = Math.min(100000, (Number(get(localStorage, 'gotia-vn')) || 0) + 1);
    put(sessionStorage, 'gotia-sid', session);
    put(sessionStorage, 'gotia-vno', String(visitNo));
    put(localStorage, 'gotia-vn', String(visitNo));
  }

  const isPlanes = /planes(\.html)?$/.test(location.pathname);
  const base = {
    page: cut(location.pathname.replace(/index\.html$/, '') || '/', 80),
    visitor,
    session,
    device: matchMedia('(max-width: 767px)').matches ? 'móvil' : matchMedia('(max-width: 1100px) and (pointer: coarse)').matches ? 'tablet' : 'computador',
    lang: cut(navigator.language, 12),
    version: isPlanes ? null : document.documentElement.classList.contains('lite') ? 'esencial' : '3d'
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

  // las secciones que llega a ver (en planes.html, cada pantalla)
  const sections = [...document.querySelectorAll('main section[id], body > section[id], .slide[id]')];
  const seen = new Set();
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    const id = e.target.id;
    if (!e.isIntersecting || seen.has(id)) return;
    seen.add(id);
    send('section', { label: cut(id, 120) });
  }), { threshold: 0.4 });
  sections.forEach((s) => io.observe(s));

  // lo que toca (una vez por cosa en cada página, para no llenar la base)
  const touched = new Set();
  const interact = (label) => {
    label = cut(label, 120);
    if (!label || touched.has(label) || touched.size >= 60) return;
    touched.add(label);
    send('interact', { label });
  };
  const slideOf = (el) => (el.closest('.slide[id], section[id]') || {}).id || '';

  // versión Lite: por qué la eligió la web, o si pasó a ella en el momento (main.js). En la
  // columna "version" cuenta como "esencial" (la base solo acepta "esencial" y "3d")
  const why = (window.gotia || {}).low;
  if (why) interact('Versión Lite · ' + why);
  document.addEventListener('gotia:lowend', (e) => interact('Versión Lite · ' + e.detail + ' (pasó sola)'));

  // los botones que importan
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a, button, summary');
    if (!a) return;
    let label = '';
    if (a.matches('[data-wa]')) label = 'WhatsApp · ' + (a.dataset.wa || '').replace(/^Hola Gotia Studio\s*👋?\s*/i, '');
    else if (a.matches('[data-ig]')) label = 'Instagram';
    else if (a.matches('a[href^="mailto:"]')) label = 'Correo';
    else if (a.matches('.ver-to-3d')) label = 'Activó la versión 3D';
    else if (a.matches('.fxi-go')) label = 'Activó la versión 3D (desde el aviso)';
    if (label) { send('click', { label: cut(label, 120) }); return; }

    // interacciones: ayudan a saber qué interesa
    const text = cut(a.textContent, 60);
    if (a.matches('summary')) { if (!a.parentElement.open) interact('Pregunta · ' + text); }
    else if (a.matches('.orbit-item')) interact('Ecosistema · ' + (a.dataset.title || text));
    else if (a.matches('.mx-tabs button')) interact('Demo · ' + slideOf(a) + ' · ' + text);
    else if (a.matches('.ov-item')) interact('Resumen · ' + cut((a.querySelector('b') || a).textContent, 40));
    else if (a.matches('.dots a')) interact('Puntos · ' + (a.getAttribute('href') || '').slice(1));
    else if (a.matches('[data-svc-go]')) interact('Carrusel · ' + slideOf(a));
    else if (a.matches('.tuto-steps button')) {
      // los tutoriales de 3 pasos: qué tarjeta y qué paso toca
      const card = a.closest('.svc-card');
      const title = cut(((card && card.querySelector('h3')) || {}).textContent, 50);
      interact('Tutorial · ' + (title || slideOf(a)) + ' · ' + text.replace(/^\d+\s*/, ''));
    }
    else if (a.matches('[data-plan-go]')) interact('Planes · ir a ' + text);
    else if (a.matches('.fxi-close')) interact('Aviso 3D · lo cerró');
    else if (a.matches('.ver-to-lite')) interact('Volvió a la versión Esencial');
    else if (a.matches('.theme-toggle')) interact(document.documentElement.dataset.theme === 'dark' ? 'Cambió a modo claro' : 'Cambió a modo negro');
    else if (a.matches('.nav-burger')) interact('Abrió el menú');
    else if (a.matches('.nav a[href^="#"], .mobile-menu a[href^="#"], .s-hero a[href^="#"]')) interact('Menú · ' + text.replace(/^\d+\s*/, ''));
  }, true);
  document.addEventListener('input', (e) => {
    if (e.target.closest('.panel-try')) interact('Probó el panel de ejemplo');
    else if (e.target.closest('#contact-form')) interact('Empezó a llenar el formulario');
  }, true);
  const form = document.getElementById('contact-form');
  if (form) form.addEventListener('submit', () => setTimeout(() => {
    if (form.classList.contains('sent')) send('click', { label: 'Formulario enviado' });
  }, 0));

  // tiempo activo y tiempo en cada sección: solo cuenta mientras la pestaña está a la vista
  // y la persona hizo algo en los últimos 2 minutos (si deja la web abierta y se va, no suma)
  let maxScroll = 0, lastAct = Date.now(), lastTick = Date.now(), active = 0, sentLoad = false;
  const dwell = {};
  const awake = () => { lastAct = Date.now(); };
  const onScroll = () => {
    awake();
    const h = document.documentElement.scrollHeight - innerHeight;
    if (h > 0) maxScroll = Math.max(maxScroll, Math.min(100, Math.round(scrollY / h * 100)));
  };
  addEventListener('scroll', onScroll, { passive: true });
  ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'].forEach((t) => addEventListener(t, awake, { passive: true }));
  const current = () => {
    const mid = innerHeight / 2;
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) return s.id;
    }
    return '';
  };
  const tick = () => {
    const now = Date.now(), step = Math.min(2500, now - lastTick);
    lastTick = now;
    if (document.visibilityState !== 'visible' || now - lastAct > 120e3) return;
    active += step;
    const id = current();
    if (id) dwell[id] = (dwell[id] || 0) + step;
  };
  setInterval(tick, 1000);

  // al salir (o al cambiar de pestaña): se manda lo acumulado desde el último envío
  const loadMs = () => {
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      const v = nav && (nav.loadEventEnd || nav.domContentLoadedEventEnd);
      return v > 0 ? Math.min(120000, Math.round(v)) : null;
    } catch (e) { return null; }
  };
  const flush = () => {
    tick();
    const secs = {};
    let any = false;
    for (const k in dwell) {
      const v = Math.round(dwell[k] / 1000);
      if (v > 0) { secs[cut(k, 40)] = Math.min(86400, v); any = true; }
      delete dwell[k];
    }
    const duration = Math.round(active / 1000);
    active = 0;
    if (!duration && !any && sentLoad) return;
    const extra = { duration: Math.min(86400, duration), scroll: maxScroll, dwell: any ? secs : null };
    if (!sentLoad) { extra.load_ms = loadMs(); sentLoad = true; }
    send('leave', extra, true);
  };
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
    else { lastTick = Date.now(); awake(); }
  });
})();
