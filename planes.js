/* =========================================================
   Gotiastudio — Paquetes: presentación por pantallas
   Cada .slide ocupa la ventana y el scroll se ajusta a la siguiente
   (scroll-snap, en planes.css). Aquí:
     · puntos a la derecha (uno por pantalla) y barra de progreso arriba
     · el botón flotante de WhatsApp (entre la portada y el cierre)
     · un punto de ajuste extra al final de una pantalla que no quepa
       (celulares pequeños), para poder leerla entera
     · al llegar a una pantalla, todo lo suyo que aún no apareció aparece
   ========================================================= */
(() => {
  const all = [...document.querySelectorAll('.slide')];
  if (!all.length) return;
  let slides = all;   // solo las que se ven: dependen del camino elegido (caminos.js)
  const wa = document.querySelector('.wa-float');
  const bar = document.querySelector('.progress');

  // puntos: uno por pantalla, con su nombre al pasar el cursor
  const nav = document.createElement('nav');
  nav.className = 'dots';
  nav.setAttribute('aria-label', 'Pantallas');
  const dots = all.map((s) => {
    const a = document.createElement('a');
    a.href = '#' + s.id;
    a.dataset.label = s.dataset.title || '';
    a.setAttribute('aria-label', s.dataset.title || s.id);
    // la pantalla de cada mensualidad lleva su color (data-tint)
    if (s.dataset.tint) a.style.setProperty('--dot', s.dataset.tint);
    nav.appendChild(a);
    return a;
  });
  document.body.appendChild(nav);

  // punto de ajuste al final de cada pantalla (solo se activa si no cabe)
  all.forEach((s) => {
    const end = document.createElement('i');
    end.className = 'snap-end';
    end.setAttribute('aria-hidden', 'true');
    s.appendChild(end);
  });
  const measure = () => slides.forEach((s) => s.classList.toggle('is-tall', s.offsetHeight > innerHeight + 4));

  let current = null;
  const update = () => {
    // pantalla actual: la última cuyo borde superior ya pasó la mitad de la ventana
    const mid = innerHeight * 0.5;
    let idx = 0;
    for (let i = 0; i < slides.length; i++) {
      if (slides[i].getBoundingClientRect().top <= mid) idx = i;
      else break;
    }
    const now = slides[idx];
    if (now !== current) {
      current = now;
      // la pantalla actual se ve entera: lo que va pegado a su borde de abajo (el precio de cada
      // ejemplo, en laptops) nunca entra en la zona en que main.js lo hace aparecer
      now.querySelectorAll('[data-reveal]:not(.in)').forEach((el) => el.classList.add('in'));
      dots.forEach((d, i) => {
        d.classList.toggle('on', all[i] === now);
        if (all[i] === now) d.setAttribute('aria-current', 'step');
        else d.removeAttribute('aria-current');
      });
      // los casos de éxito ya traen su propio botón de WhatsApp
      if (wa) wa.classList.toggle('show', idx > 0 && idx < slides.length - 1 && now.id !== 'casos');
    }
    if (bar) {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.setProperty('--p', max > 0 ? Math.min(1, scrollY / max).toFixed(4) : '0');
    }
  };

  let raf = 0;
  addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; update(); });
  }, { passive: true });
  addEventListener('resize', () => { measure(); update(); });
  const camino = () => {
    slides = all.filter((s) => s.getClientRects().length);
    dots.forEach((d, i) => { d.hidden = !slides.includes(all[i]); });
    current = null;
    measure();
    update();
  };
  document.addEventListener('gotia:camino', camino);
  camino();
  // cuando llegan las fuentes las alturas pueden cambiar
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); update(); });
})();

/* ---------- Los recorridos de los 4 paquetes: tutorial sobre la página ----------
   Cada figure[data-tour] es un tutorial. En cada paso la luz (.t-spot) se posa en su parte
   ([data-tour-at="n"], que lleva .is-at mientras tanto), la nota (.t-tip) va al primer lado de su
   data-place en que quepa entera dentro de la ventana, y la flecha se dibuja de la nota a la parte.
   Si la página tiene más de lo que cabe (.t-scroll), baja sola hasta la parte, como al tocar un
   enlace del menú: con data-tour-scroll="top" la deja arriba siempre; si no, solo cuando no se ve
   entera (una parte fuera de la página vuelve arriba, salvo con data-tour-keep). Todo se mide
   aquí, así sirve igual en computador y en celular. Los pasos se llenan como las historias (Web
   Animations: se pausan si el ejemplo deja de verse; data-ms en la nota = lo que dura ese paso) y
   vuelven a empezar al volver a verlo; tocar un paso lo muestra y sigue desde ahí.
   Con movimiento reducido o en Lite no avanza solo: los pasos se cambian tocándolos. */
document.querySelectorAll('[data-tour]').forEach((tour) => {
  const win = tour.querySelector('.mock-win');
  const spot = tour.querySelector('.t-spot');
  const svg = tour.querySelector('.t-arrow');
  const line = tour.querySelector('.t-line'), head = tour.querySelector('.t-head');
  const sc = tour.querySelector('.t-scroll');
  const tips = [...tour.querySelectorAll('.t-tip')];
  const tabs = [...tour.querySelectorAll('.t-steps button')];
  const parts = tips.map((t, i) => tour.querySelector(`[data-tour-at="${i + 1}"]`));
  const STEP = 7000, HOLD = 1500;   // con calma: hay quien lee despacio (el último espera un poco más)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const auto = () => !reduce && !document.documentElement.classList.contains('lowend');
  const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));
  const f = (n) => n.toFixed(1);
  let cur = 0, anim = null, on = false;

  // dónde está un elemento dentro de la ventana, en px de la ventana (aunque esté escalada al aparecer)
  const box = (el) => {
    const w = win.getBoundingClientRect(), r = el.getBoundingClientRect(), k = win.offsetWidth / w.width || 1;
    return { x: (r.left - w.left) * k, y: (r.top - w.top) * k, w: r.width * k, h: r.height * k };
  };

  // baja (o sube) la página hasta la parte (t = dónde está ahora); devuelve cuánto se moverá
  const scrollTo = (el, t) => {
    const view = sc.parentElement;
    const now = -new DOMMatrix(getComputedStyle(sc).transform).m42 || 0;
    const inside = sc.contains(el);
    if (!inside && el.closest('[data-tour-keep]')) return 0;   // este paso no mueve la página
    let to = 0;
    if (inside) {
      const top = t.y - box(view).y + now;   // dónde queda la parte con la página arriba del todo
      const max = sc.offsetTop + sc.offsetHeight + parseFloat(getComputedStyle(view).paddingBottom) - view.clientHeight;
      const seen = top - now >= 4 && top - now + t.h <= view.clientHeight - 4;
      to = clamp(tour.dataset.tourScroll === 'top' || !seen ? top - 12 : now, 0, max);
    }
    sc.style.transform = to ? `translate3d(0, ${f(-to)}px, 0)` : '';
    return inside ? now - to : 0;
  };

  // la luz, la nota y la flecha del paso i
  const place = (i) => {
    const W = win.offsetWidth, H = win.offsetHeight;
    if (!W || !parts[i]) return;
    const t = box(parts[i]);
    if (sc) t.y += scrollTo(parts[i], t);
    const pad = Math.max(5, W * 0.008);
    const s = { x: t.x - pad, y: t.y - pad, w: t.w + pad * 2, h: t.h + pad * 2 };
    Object.assign(spot.style, {
      left: s.x + 'px', top: s.y + 'px', width: s.w + 'px', height: s.h + 'px',
      borderRadius: (t.h < H * 0.16 ? s.h / 2 : Math.max(10, W * 0.016)) + 'px',   // botones: píldora
    });

    // la nota: el primer lado en que quepa entera; si no cabe en ninguno (ventana bajita), el que
    // menos tape la parte señalada
    const tip = tips[i], tw = tip.offsetWidth, th = tip.offsetHeight;
    const m = 10, gap = clamp(W * 0.07, 34, 64), cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    const ax = clamp(cx - tw * 0.32, m, W - tw - m), ay = clamp(cy - th * 0.2, m, H - th - m);   // un poco a un lado: la flecha hace curva
    const at = { below: [ax, s.y + s.h + gap], above: [ax, s.y - gap - th], right: [s.x + s.w + gap, ay], left: [s.x - gap - tw, ay] };
    const pos = (k) => [clamp(at[k][0], m, W - tw - m), clamp(at[k][1], m, H - th - m)];
    const fits = (k) => pos(k).every((v, j) => Math.abs(v - at[k][j]) < 1);
    const over = (k) => {
      const [x, y] = pos(k);
      return Math.max(0, Math.min(x + tw, s.x + s.w) - Math.max(x, s.x)) * Math.max(0, Math.min(y + th, s.y + s.h) - Math.max(y, s.y));
    };
    const sides = (tip.dataset.place || 'below').split(' ');
    const side = sides.find(fits) || sides.reduce((a, k) => (over(k) < over(a) ? k : a));
    const [x, y] = pos(side);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';

    // la flecha: del borde de la nota que mira a la parte, hasta justo antes de la luz
    // (si la nota quedó encima de la parte, sin flecha)
    const free = { below: y >= s.y + s.h + 12, above: y + th <= s.y - 12, right: x >= s.x + s.w + 12, left: x + tw <= s.x - 12 }[side];
    if (!free) { line.setAttribute('d', ''); head.setAttribute('d', ''); return; }
    const n = 16, e = 5;
    let a, b;
    if (side === 'below' || side === 'above') {
      const sx = clamp(cx, x + n, x + tw - n);
      a = [sx, side === 'below' ? y - 4 : y + th + 4];
      b = [clamp(sx, s.x + n, s.x + s.w - n), side === 'below' ? s.y + s.h + e : s.y - e];
    } else {
      const sy = clamp(cy, y + n, y + th - n);
      a = [side === 'right' ? x - 4 : x + tw + 4, sy];
      b = [side === 'right' ? s.x + s.w + e : s.x - e, clamp(sy, s.y + n / 2, s.y + s.h - n / 2)];
    }
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, bow = len * 0.3 * (i % 2 ? 1 : -1);
    const c = [(a[0] + b[0]) / 2 - (dy / len) * bow, (a[1] + b[1]) / 2 + (dx / len) * bow];
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    line.setAttribute('d', `M${f(a[0])} ${f(a[1])}Q${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`);
    // la punta: dos trazos cortos según la dirección en que llega la curva
    const ang = Math.atan2(b[1] - c[1], b[0] - c[0]) + Math.PI, hs = clamp(W * 0.016, 8, 13);
    const wing = (k) => `${f(b[0] + Math.cos(ang + k) * hs)} ${f(b[1] + Math.sin(ang + k) * hs)}`;
    head.setAttribute('d', `M${wing(0.5)}L${f(b[0])} ${f(b[1])}L${wing(-0.5)}`);
  };

  // la barra del paso se llena y, al llenarse, pasa al siguiente
  const play = () => {
    if (anim) anim.cancel();
    anim = null;
    if (!auto()) { tour.classList.add('is-still'); return; }
    const fill = tabs[cur].querySelector('.t-fill');
    anim = fill.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
      duration: (Number(tips[cur].dataset.ms) || STEP) + (cur === tips.length - 1 ? HOLD : 0), easing: 'linear', fill: 'forwards',
    });
    anim.onfinish = () => show((cur + 1) % tips.length);
    if (!on) anim.pause();
  };

  const show = (i) => {
    cur = i;
    tour.dataset.step = i + 1;   // el CSS de cada paquete cambia cosas según el paso (la sección del menú, Google…)
    tabs.forEach((b, k) => {
      b.setAttribute('aria-pressed', String(k === i));
      b.classList.toggle('is-done', k < i);
    });
    tips.forEach((t, k) => t.classList.toggle('is-on', k === i));
    parts.forEach((p, k) => p && p.classList.toggle('is-at', k === i));
    tour.classList.remove('is-drawn');
    place(i);
    void svg.getBoundingClientRect();   // la flecha (y lo que se anima en la parte) vuelven a empezar
    tour.classList.add('is-drawn');
    play();
  };

  // si cambia el tamaño (girar el celular, fuentes que llegan), todo se recoloca sin animarse
  const snap = () => {
    tour.classList.add('is-snap');
    place(cur);
    void win.offsetWidth;
    tour.classList.remove('is-snap');
  };

  tour.classList.add('is-live');
  if (!auto()) tour.classList.add('is-still');
  tabs.forEach((b, i) => b.addEventListener('click', () => show(i)));
  show(0);
  requestAnimationFrame(() => tour.classList.add('is-ready'));
  if (window.ResizeObserver) new ResizeObserver(snap).observe(win);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(snap);
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting === on) return;
    on = e.isIntersecting;
    if (on) show(0);
    else if (anim) anim.pause();
  }, { threshold: 0.35 }).observe(tour);
  document.addEventListener('gotia:lowend', () => { if (anim) anim.cancel(); anim = null; tour.classList.add('is-still'); });
});
