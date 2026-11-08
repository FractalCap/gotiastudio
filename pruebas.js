/* =========================================================
   Gotiastudio — Pruebas gratis con enlace personalizado (paquetes.html)
   La página normal no muestra ninguna prueba. Aparece solo si el enlace trae parámetros válidos:
     · prueba = días gratis: solo 7, 15 o 30 (cualquier otro valor: página normal)
     · plan   = emprende, presencia, automatico o negocio. Sin plan: Automático y Negocio.
                Con un valor inválido: página normal
     · nombre = del cliente o del negocio (opcional, hasta 40 letras). Siempre con textContent
     · hasta  = fecha límite AAAA-MM-DD (opcional). Vencida o mal escrita: página normal
   Ejemplo: paquetes.html?prueba=15&plan=automatico&nombre=Hotel%20Las%20Palmas&hasta=2026-11-30
   Sin servidor y sin guardar nada. Carga antes de contacto.js: así los botones de WhatsApp ya
   salen con la prueba en su mensaje. Los elementos de cada paquete llevan data-paq en el HTML.
   ========================================================= */
(() => {
  const PAQUETES = { emprende: 'Emprende', presencia: 'Presencia', automatico: 'Automático', negocio: 'Negocio' };
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const q = new URLSearchParams(location.search);

  const dias = q.get('prueba');
  if (!['7', '15', '30'].includes(dias)) return;

  const plan = q.get('plan');
  if (q.has('plan') && !Object.keys(PAQUETES).includes(plan)) return;
  const aplica = q.has('plan') ? [plan] : ['automatico', 'negocio'];

  // la fecha límite cuenta hasta el final de ese día; una fecha que no existe (31 de febrero) no vale
  let limite = '';
  if (q.has('hasta')) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(q.get('hasta'));
    if (!m) return;
    const fin = new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999);
    if (fin.getMonth() !== +m[2] - 1 || fin.getDate() !== +m[3] || Date.now() > fin.getTime()) return;
    limite = ` Válido hasta el ${fin.getDate()} de ${MESES[fin.getMonth()]}.`;
  }

  // una prueba válida es de una mensualidad de paquete: entra directo a ese camino (caminos.js)
  document.documentElement.dataset.camino = 'auto';

  const nombre = [...(q.get('nombre') || '').trim().replace(/\s+/g, ' ')].slice(0, 40).join('').trim();
  const cuales = aplica.map((p) => PAQUETES[p]).join(' o ');
  const saludo = nombre ? `${nombre}, tienes` : 'Tienes';

  // el aviso de la portada
  const caja = document.getElementById('prueba');
  if (caja) {
    const aviso = document.createElement('p');
    aviso.className = 'prueba-aviso glass';
    aviso.textContent = `${saludo} ${dias} días gratis adicionales en tu mensualidad del paquete ${cuales}.${limite}`;
    const nota = document.createElement('p');
    nota.className = 'prueba-nota';
    nota.textContent = 'La prueba se activa al confirmar tu paquete por WhatsApp.';
    caja.append(aviso, nota);
    caja.hidden = false;
  }

  aplica.forEach((p) => {
    document.querySelectorAll(`[data-paq~="${p}"]`).forEach((el) => {
      // los botones de WhatsApp de ese paquete (contacto.js arma el enlace después, con este mensaje)
      if ('wa' in el.dataset) {
        if (!el.dataset.wa.includes('con mi prueba')) el.dataset.wa += ` con mi prueba de ${dias} días gratis`;
        return;
      }
      // la etiqueta junto a la mensualidad, en la pantalla resumen y en su ficha
      const tag = document.createElement('b');
      tag.className = 'prueba-tag';
      tag.textContent = `+${dias} días gratis`;
      el.append(' · ', tag);
    });
  });
})();
