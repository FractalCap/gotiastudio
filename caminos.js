/* =========================================================
   Gotiastudio — La elección inicial de paquetes.html: automatizar, vender más o entender los datos.
   Hasta que la persona elige, solo se ve la portada. html[data-camino] dice qué camino va y el CSS
   esconde lo que lleva data-solo de los otros. Se entra directo con ?camino=automatizar, vender o datos,
   con una prueba gratis válida (pruebas.js) o con un #ancla de una pantalla de un camino.
   ========================================================= */
(() => {
  const root = document.documentElement;
  const q = new URLSearchParams(location.search);
  const enlace = { automatizar: 'auto', vender: 'vender', datos: 'datos' }[q.get('camino')];
  const destino = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
  const dueno = destino && destino.closest('[data-solo]');
  const botones = [...document.querySelectorAll('[data-camino-go]')];
  const pintar = (c) => {
    root.dataset.camino = c;
    botones.forEach((b) => b.setAttribute('aria-current', String(b.dataset.caminoGo === c)));
    document.dispatchEvent(new CustomEvent('gotia:camino', { detail: c }));
  };
  const inicial = root.dataset.camino || enlace || (dueno && dueno.dataset.solo.split(' ')[0]);
  if (inicial) pintar(inicial);
  if (inicial && destino) addEventListener('load', () => destino.scrollIntoView());
  botones.forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    pintar(b.dataset.caminoGo);
    const vistas = [...document.querySelectorAll('.slide')].filter((s) => s.getClientRects().length);
    if (vistas[1]) vistas[1].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }));
})();
