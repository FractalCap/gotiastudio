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

/* Black Days: precio del Pack Lanzamiento en $590.000 (antes $890.000) por 10 días.
   Termina el 6 de dic. de 2026 a las 23:59 (hora de Colombia). Al pasar la fecha, las piezas
   [data-bd] se esconden y vuelven las [data-bd-off] (el precio normal), sin tocar el HTML. */
(() => {
  const END = new Date('2026-12-06T23:59:59-05:00').getTime();
  const on = document.querySelectorAll('[data-bd]');
  const off = document.querySelectorAll('[data-bd-off]');
  const counts = document.querySelectorAll('[data-bd-count]');
  if (!on.length) return;
  const pad = (n) => String(n).padStart(2, '0');
  const tick = () => {
    const left = END - Date.now();
    if (left <= 0) {
      on.forEach((el) => { el.hidden = true; });
      off.forEach((el) => { el.hidden = false; });
      clearInterval(timer);
      return;
    }
    const s = Math.floor(left / 1000);
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    counts.forEach((el) => {
      const en = el.closest('[data-l]')?.getAttribute('data-l') === 'en';
      const days = d ? `${d} ${en ? (d === 1 ? 'day' : 'days') : (d === 1 ? 'día' : 'días')} ` : '';
      el.textContent = `${days}${pad(h)}:${pad(m)}:${pad(sec)}`;
    });
  };
  const timer = setInterval(tick, 1000);
  tick();
})();
