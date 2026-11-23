/* =========================================================
   Gotiastudio — Botón flotante de WhatsApp (index.html y paquetes.html)
   Antes lo mostraban flotantes.js (la guía en audio) y planes.js; desde nov. 2026 las dos
   páginas son más simples y solo hace falta esto: aparece a los 0,6 s y se esconde mientras
   el menú del celular está abierto. El enlace lo arma contacto.js (data-wa).
   ========================================================= */
(() => {
  const wa = document.querySelector('.wa-float');
  if (!wa) return;
  const nav = document.getElementById('nav');
  let shown = false;
  const paint = () => wa.classList.toggle('show', shown && !(nav && nav.classList.contains('nav-open')));
  if (nav) new MutationObserver(paint).observe(nav, { attributes: true, attributeFilter: ['class'] });
  setTimeout(() => { shown = true; paint(); }, 600);
})();
