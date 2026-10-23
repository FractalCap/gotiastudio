/* =========================================================
   Gotiastudio — Datos de contacto
   Un solo lugar para las dos páginas (index.html y planes.html):
   cambia aquí tu WhatsApp y tu Instagram y todos los botones se actualizan.
     · data-wa="mensaje"  → abre WhatsApp con ese mensaje ya escrito
     · data-ig            → abre un mensaje directo en Instagram
     · data-ig-perfil     → abre el perfil de Instagram (para seguirlo: el sorteo)
     · data-ig-user       → escribe el @ de Instagram en el texto
   ========================================================= */
(() => {
  const CONTACTO = {
    whatsapp: '573027809730',  // con indicativo, sin "+" ni espacios
    instagram: 'gotiastudio'   // sin "@"
  };

  const num = CONTACTO.whatsapp.replace(/\D/g, '');
  const ig = CONTACTO.instagram.replace(/^@/, '').trim();
  // el formulario de contacto (main.js) los usa para abrir WhatsApp con el mensaje
  window.gotiaContacto = { whatsapp: num, instagram: ig };
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

  document.querySelectorAll('[data-ig-perfil]').forEach((a) => {
    if (!ig) { a.setAttribute('data-todo', 'instagram'); return; }
    open(a, `https://www.instagram.com/${ig}/`);
  });

  if (ig) document.querySelectorAll('[data-ig-user]').forEach((el) => { el.textContent = '@' + ig; });

  if (!num) console.warn('Gotiastudio: falta el número de WhatsApp en contacto.js');
})();
