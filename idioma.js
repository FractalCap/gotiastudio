/* =========================================================
   Gotiastudio — Idioma (index.html, paquetes.html y terminos.html)
   Español con precios en COP o inglés con precios en USD. Los textos van dos veces en el HTML
   (data-l="es" y data-l="en") y styles.css esconde el que no toca ("Idioma").
   El <head> de cada página aplica la elección guardada antes de pintar; aquí solo se cambia:
     · [data-lang-set="es|en"] → los botones del selector de la primera visita (.lang-pick)
     · [data-lang-toggle]      → el botón ES / EN del menú
     · [data-aria-en]          → la etiqueta para lectores de pantalla en inglés
   Al cambiar avisa con el evento "gotia:lang" (contacto.js rehace los enlaces de WhatsApp con data-wa-en).
   ========================================================= */
(() => {
  const root = document.documentElement;
  const titles = { es: root.dataset.esTitle || document.title, en: root.dataset.enTitle || '' };
  const arias = [...document.querySelectorAll('[data-aria-en]')].map((el) => [el, el.getAttribute('aria-label') || '']);
  const current = () => (root.classList.contains('lang-en') ? 'en' : 'es');
  const paintAria = (lang) => arias.forEach(([el, es]) => el.setAttribute('aria-label', lang === 'en' ? el.dataset.ariaEn : es));

  const set = (lang) => {
    try { localStorage.setItem('gotia-lang', lang); } catch (e) {}
    root.classList.remove('lang-ask');
    root.classList.toggle('lang-en', lang === 'en');
    root.lang = lang;
    if (titles[lang]) document.title = titles[lang];
    paintAria(lang);
    document.dispatchEvent(new CustomEvent('gotia:lang', { detail: lang }));
  };

  paintAria(current());
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang-set], [data-lang-toggle]');
    if (!b) return;
    e.preventDefault();
    set(b.dataset.langSet || (current() === 'en' ? 'es' : 'en'));
  });

  // primera visita: el foco va al selector (teclado y lectores de pantalla)
  if (root.classList.contains('lang-ask')) {
    const first = document.querySelector('.lang-pick [data-lang-set]');
    if (first) first.focus({ preventScroll: true });
  }
})();
