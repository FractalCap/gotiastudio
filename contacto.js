/* =========================================================
   Gotiastudio — Datos de contacto
   Un solo lugar para las dos páginas (index.html y planes.html):
   cambia aquí tu WhatsApp y tu Instagram y todos los botones se actualizan.
     · data-wa="mensaje"  → abre WhatsApp con ese mensaje ya escrito
     · data-ig            → abre un mensaje directo en Instagram
   ========================================================= */
(() => {
  const CONTACTO = {
    whatsapp: '573508676976',  // con indicativo, sin "+" ni espacios
    instagram: 'gotiastudio'   // sin "@"
  };

  const num = CONTACTO.whatsapp.replace(/\D/g, '');
  const ig = CONTACTO.instagram.replace(/^@/, '').trim();
  const open = (a, url) => {
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.removeAttribute('data-todo');
  };

  document.querySelectorAll('[data-wa]').forEach((a) => {
    const msg = a.dataset.wa || 'Hola Gotia Studio 👋 Quiero más información';
    // sin número todavía: el botón no lleva a ningún sitio (main.js lo deja quieto)
    if (!num) { a.setAttribute('data-todo', 'whatsapp'); return; }
    open(a, `https://wa.me/${num}?text=${encodeURIComponent(msg)}`);
  });

  document.querySelectorAll('[data-ig]').forEach((a) => {
    if (!ig) { a.setAttribute('data-todo', 'instagram'); return; }
    open(a, `https://ig.me/m/${ig}`);
  });

  if (!num) console.warn('Gotiastudio: falta el número de WhatsApp en contacto.js');
})();
