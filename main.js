/* =========================================================
   Gotiastudio — Interacciones
   ========================================================= */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const gotia = (window.gotia = window.gotia || {});
  // versión Esencial (simple y rápida): sin pantalla de carga, sin WebGL y sin efectos
  const isLite = () => root.classList.contains('lite');
  // versión Lite (gama media-baja, internet lento, ahorro de datos): como Esencial, pero todo quieto.
  // La elige el <head>, o la web pasa a ella en el momento si va a tirones (ver final)
  const isLow = () => root.classList.contains('lowend');
  // efectos de la versión 3D: se registran aquí y arrancan solo si se elige el 3D (ver final)
  const fx = [];
  // con "reducir movimiento" la web sigue viva; solo se evitan los desplazamientos
  // grandes (el vuelo de la "G" de la carga) y las demos de las secciones se quedan quietas
  // y completas. En Lite, igual. Si la web pasa a Lite con una demo en marcha, termina la
  // vuelta que lleva y se queda quieta (de ahí los isLow() en cada bucle)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || isLow();
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (n) => Math.round(n).toLocaleString('es-ES', { useGrouping: 'always' });

  /* ---------- Split words (conserva <em>) ---------- */
  function splitWords(el, cls) {
    const out = [];
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const s = document.createElement('span');
            s.className = cls;
            s.textContent = part;
            out.push(s);
            frag.appendChild(s);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
    return out;
  }

  // curva cubic-bezier de CSS evaluada en JS (para seguir al anillo de carga)
  const cubicBezier = (x1, y1, x2, y2) => {
    const at = (a, b, t) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
    return (x) => {
      let lo = 0, hi = 1, t = x;
      for (let i = 0; i < 20; i++) { t = (lo + hi) / 2; at(x1, x2, t) < x ? (lo = t) : (hi = t); }
      return at(y1, y2, t);
    };
  };

  /* ---------- Hero intro ---------- */
  const heroTitle = $('[data-split]');
  if (heroTitle) splitWords(heroTitle, 'w').forEach((w, i) => w.style.setProperty('--wi', i));
  const ready = () => requestAnimationFrame(() => document.body.classList.add('is-ready'));

  /* ---------- Pantalla de carga (1,8 s) ----------
     La "G" de cristal aparece, el anillo de luz completa la carga y al terminar
     la "G" vuela hasta su sitio en el hero, donde le pasa el relevo a la "G" en WebGL.
     Solo en la versión 3D. */
  function runLoader() {
    const loader = $('#loader');
    if (!loader) {
      (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]) : Promise.resolve()).then(ready);
      return;
    }
    gotia.loaderRunning = true;   // la red de seguridad del <head> ya no hace falta
    const LOADER_MS = 1800;
    const g = $('#loader-g');
    const pct = $('#loader-pct');
    const arc = $('.lr-arc', loader);
    const ringEase = cubicBezier(.45, .05, .2, 1);   // la misma curva que el anillo (1,6 s tras 0,15 s)
    let start = performance.now(), out = false;

    const count = (now) => {
      if (out) return;
      const k = clamp((now - start - 150) / 1600, 0, 1);
      pct.textContent = String(Math.round(ringEase(k) * 100)).padStart(3, '0');
      requestAnimationFrame(count);
    };

    const exit = () => {
      if (out) return;
      out = true;
      pct.textContent = '100';
      // la "G" vuela hasta la "G" del hero: misma figura, misma escala
      const t = gotia.gTarget ? gotia.gTarget() : null;
      let flies = false;
      if (t && !reduce) {
        const r = g.getBoundingClientRect();
        const k = (t.scale * t.refWidth) / r.width;
        const onScreen = t.top < innerHeight && t.top + t.scale * t.refHeight > 0;
        if (onScreen && k > 0.05 && k < 20) {
          g.style.transform = `translate(${t.left - r.left}px, ${t.top - r.top}px) scale(${k})`;
          flies = true;
        }
      }
      g.classList.add(flies ? 'flies' : 'is-out');
      loader.classList.add('is-out');
      ready();
      // relevo: la "G" en WebGL aparece cuando la de la carga ya casi llegó (84 % del vuelo)
      setTimeout(() => {
        gotia.revealed = true;   // por si bubbles.js llega después del relevo
        document.dispatchEvent(new Event('gotia:reveal'));
      }, flies ? 600 : 120);
      setTimeout(() => {
        root.classList.remove('is-loading');
        loader.remove();
        g.remove();
      }, 1300);
    };

    const run = () => {
      requestAnimationFrame(count);
      setTimeout(exit, Math.max(0, start + LOADER_MS - performance.now()));
    };
    // el reloj de la carga es el de la animación del anillo, que arranca con el primer pintado
    const anim = arc && arc.getAnimations ? arc.getAnimations()[0] : null;
    if (anim) anim.ready.then(() => { if (anim.startTime != null) start = anim.startTime; run(); });
    else run();
    // por si el navegador nunca arranca la animación (página abierta en segundo plano)
    setTimeout(exit, 4500);
  }

  /* ---------- Nav ---------- */
  const nav = $('#nav');
  const burger = $('.nav-burger');
  const onScrollNav = () => nav.classList.toggle('scrolled', scrollY > 24);
  onScrollNav();
  addEventListener('scroll', onScrollNav, { passive: true });

  const setMenu = (open) => {
    nav.classList.toggle('nav-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  };
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('nav-open')));
  $$('#mobile-menu a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- Modo negro ----------
     El botón de la luna cambia la web al negro y el del sol la devuelve al azul claro.
     La elección se recuerda (el <head> la aplica antes de pintar en la próxima visita). */
  const themeBtn = $('.theme-toggle');
  if (themeBtn) {
    const metaColor = $('meta[name="theme-color"]');
    const metaScheme = $('meta[name="color-scheme"]');
    const isDark = () => root.dataset.theme === 'dark';
    const syncBtn = () => {
      themeBtn.setAttribute('aria-pressed', String(isDark()));
      themeBtn.title = isDark() ? 'Cambiar a claro' : 'Cambiar a negro';
    };
    const setTheme = (dark) => {
      if (dark) root.dataset.theme = 'dark';
      else delete root.dataset.theme;
      if (metaColor) metaColor.content = dark ? '#000000' : '#eaf3ff';
      if (metaScheme) metaScheme.content = dark ? 'dark' : 'light';
      try { localStorage.setItem('gotia-theme', dark ? 'dark' : 'light'); } catch (e) {}
      syncBtn();
    };
    syncBtn();
    themeBtn.addEventListener('click', () => {
      const dark = !isDark();
      if (!document.startViewTransition || reduce) { setTheme(dark); return; }
      // el nuevo color se abre en círculo desde el propio botón
      const r = themeBtn.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      document.startViewTransition(() => setTheme(dark)).ready.then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
          { duration: 750, easing: 'cubic-bezier(.65, 0, .35, 1)', pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(() => {});
    });
  }

  const navLinks = $$('.nav-links a');
  const sectionIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks.forEach((a) => { const s = $(a.getAttribute('href')); if (s) sectionIO.observe(s); });

  /* ---------- Reveal on scroll ---------- */
  $$('[data-stagger]').forEach((parent) => {
    [...parent.children].forEach((child, i) => {
      child.setAttribute('data-reveal', '');
      child.style.setProperty('--d', (i * 0.07).toFixed(2) + 's');
    });
  });
  fx.push(() => {
    const revealIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        revealIO.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    $$('[data-reveal]').forEach((el) => revealIO.observe(el));
  });

  /* ---------- Manifiesto (las dos versiones) ----------
     La sección se queda fija y, al bajar, cada palabra pasa de borrosa y tenue a nítida;
     una raya fina marca el avance y al final aparecen la nota y la firma. */
  const scrubEl = $('[data-scrub]');
  if (scrubEl) {
    const words = splitWords(scrubEl, 'sw');
    const section = scrubEl.closest('.manifesto');
    const bar = $('.manifesto-bar i', section);
    const cache = [];
    let ticking = false;
    const run = () => {
      ticking = false;
      const r = section.getBoundingClientRect(), vh = innerHeight;
      if (r.bottom < -100 || r.top > vh + 100) return;
      // empieza cuando la sección va por la mitad de la pantalla y acaba justo antes de soltarse
      const start = vh * 0.55, end = vh * 0.1 - (r.height - vh);
      const p = clamp((start - r.top) / (start - end), 0, 1);
      const n = p * (words.length + 1);
      words.forEach((w, i) => {
        const k = clamp(n - i, 0, 1).toFixed(3);
        if (cache[i] !== k) { cache[i] = k; w.style.setProperty('--k', k); }
      });
      if (bar) bar.style.transform = `scaleX(${p.toFixed(3)})`;
      section.classList.toggle('is-done', p > 0.94);
    };
    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(run);
    }, { passive: true });
    addEventListener('resize', run);
    run();
  }

  /* ---------- Proceso: los círculos se encienden uno tras otro, en bucle (las dos versiones) ----------
     El texto queda quieto: cada círculo se enciende, queda marcado y pasa al siguiente. Al
     terminar espera un momento y vuelve a empezar, solo mientras se ve (no depende del scroll).
     La línea va del centro del primer círculo al del último. */
  const stepsEl = $('#steps');
  if (stepsEl) {
    const line = $('.steps-line', stepsEl);
    const steps = $$('.step', stepsEl);
    const dots = steps.map((s) => $('.step-dot', s));
    const n = steps.length;

    // la línea, del primer círculo al último (cambia con el ancho y entre fila y columna).
    // offsetLeft/Top: el centro de cada círculo sin contar la escala del que está encendido
    const center = (i) => [
      steps[i].offsetLeft + dots[i].offsetLeft + dots[i].offsetWidth / 2,
      steps[i].offsetTop + dots[i].offsetTop + dots[i].offsetHeight / 2
    ];
    function placeLine() {
      const [ax, ay] = center(0), [bx, by] = center(n - 1);
      const col = Math.abs(bx - ax) < 2;
      Object.assign(line.style, col
        ? { left: ax + 'px', top: ay + 'px', width: '1px', height: by - ay + 'px', right: 'auto', bottom: 'auto' }
        : { left: ax + 'px', top: ay + 'px', width: bx - ax + 'px', height: '1px', right: 'auto', bottom: 'auto' });
    }
    placeLine();
    addEventListener('resize', placeLine);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeLine);

    if (!reduce) {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      let on = false, running = false;
      const run = async () => {
        running = true;
        while (on && !isLow()) {
          steps.forEach((s) => s.classList.remove('is-now', 'is-done'));
          await wait(700);
          for (const s of steps) {
            if (!on) break;
            s.classList.add('is-now');
            await wait(1100);
            s.classList.remove('is-now');
            s.classList.add('is-done');
            await wait(200);
          }
          await wait(2400);
        }
        running = false;
      };
      new IntersectionObserver(([e]) => {
        on = e.isIntersecting;
        if (on && !running) run();
      }, { threshold: 0.3 }).observe(stepsEl);
    }
  }

  /* ---------- Spotlight en tarjetas glass (solo 3D) ----------
     Con ratón sigue al cursor; en el celular se enciende bajo el dedo mientras toca la tarjeta. */
  fx.push(() => {
    $$('.spot').forEach((el) => {
      const light = (cx, cy) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (cx - r.left) + 'px');
        el.style.setProperty('--my', (cy - r.top) + 'px');
      };
      el.addEventListener('pointermove', (e) => light(e.clientX, e.clientY));
      const touch = (e) => {
        const t = e.touches[0];
        if (!t) return;
        light(t.clientX, t.clientY);
        el.classList.add('touch-on');
      };
      const untouch = (e) => { if (!e.touches.length) el.classList.remove('touch-on'); };
      el.addEventListener('touchstart', touch, { passive: true });
      el.addEventListener('touchmove', touch, { passive: true });
      el.addEventListener('touchend', untouch, { passive: true });
      el.addEventListener('touchcancel', untouch, { passive: true });
    });
  });

  /* ---------- Cursor burbuja + botones magnéticos (solo 3D) ----------
     Con ratón la burbuja sigue al cursor. En el celular aparece bajo el dedo mientras
     toca la pantalla (también al desplazar) y se desvanece al soltar. */
  fx.push(() => {
    const ring = $('.cursor-ring');
    const body = document.body;
    let x = -100, y = -100, rx = -100, ry = -100, shown = '';
    const hoverSel = 'a, button, input, select, textarea, label, summary, [data-tip]';
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      x = e.clientX; y = e.clientY;
      body.classList.remove('cursor-touch');
      body.classList.add('cursor-on');
      body.classList.toggle('cursor-hover', !!e.target.closest(hoverSel));
    }, { passive: true });
    root.addEventListener('pointerleave', () => body.classList.remove('cursor-on'));
    const touch = (e) => {
      const t = e.touches[0];
      if (!t) return;
      x = t.clientX; y = t.clientY;
      // al poner el dedo aparece ahí mismo, sin viajar desde el toque anterior
      if (e.type === 'touchstart') { rx = x; ry = y; }
      body.classList.add('cursor-on', 'cursor-touch');
      body.classList.remove('cursor-hover');
    };
    addEventListener('touchstart', touch, { passive: true });
    addEventListener('touchmove', touch, { passive: true });
    const untouch = (e) => { if (!e.touches.length) body.classList.remove('cursor-on'); };
    addEventListener('touchend', untouch, { passive: true });
    addEventListener('touchcancel', untouch, { passive: true });
    (function follow() {
      if (isLow()) return;
      rx += (x - rx) * 0.2;
      ry += (y - ry) * 0.2;
      const tr = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
      if (tr !== shown) { shown = tr; ring.style.transform = tr; }
      requestAnimationFrame(follow);
    })();

    // los botones siguen un poco al cursor o al dedo, y vuelven a su sitio al salir o soltar
    $$('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        if (isLow()) return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * 0.18}px, ${dy * 0.3}px)`;
      });
      const reset = () => { el.style.transform = ''; };
      el.addEventListener('pointerleave', reset);
      el.addEventListener('pointerup', reset);
      el.addEventListener('pointercancel', reset);
    });
  });

  /* ---------- Contenido IA (tarjeta 06): el visor graba (las dos versiones) ----------
     El timecode corre mientras se ve. En Esencial no hay animaciones CSS, así que la luz,
     la esfera, su sombra y el REC se mueven con Web Animations; el flyer flota en las dos. */
  const tc = $('#timecode');
  if (tc) {
    let frame = 12 * 24 + 4, onScreen = false;
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(tc.parentElement);
    const pad = (n) => String(n).padStart(2, '0');
    setInterval(() => {
      if (!onScreen || document.hidden || isLow()) return;
      frame++;
      const f = frame % 24, s = Math.floor(frame / 24) % 60, m = Math.floor(frame / 1440) % 60;
      tc.textContent = `00:${pad(m)}:${pad(s)}:${pad(f)}`;
    }, 1000 / 24);
  }
  // el video de ejemplo: tres tomas de 2,8 s con zoom lento, un destello en cada corte y la
  // barra de reproducción; solo corre mientras se ve la pestaña "Video"
  const vfv = $('.svc-card .viewfinder');
  if (vfv && vfv.animate) {
    const scene = $('.vf-scene', vfv), cut = $('.vf-cut', vfv), bar = $('.vf-bar i', vfv), label = $('[data-k=shot]', vfv);
    const SHOTS = [
      { name: 'Primer plano', zoom: [1.3, 1.16] },
      { name: 'Título', zoom: [1.05, 1] },
      { name: 'Cierre', zoom: [1, 1.05] }
    ];
    const DUR = 2800;
    const pane = vfv.closest('.ma-pane');
    let shot = -1, on = false, zoomAnim = null, barAnim = null, was = false;
    const playing = () => on && !document.hidden && !isLow() && (!pane || pane.classList.contains('is-on'));
    const play = () => {
      const now = playing();
      if (now && !was) shot = -1;   // al volver a la pestaña "Video", empieza desde la primera toma
      was = now;
      if (now) {
        shot = (shot + 1) % SHOTS.length;
        const s = SHOTS[shot];
        vfv.dataset.shot = shot + 1;
        if (label) label.textContent = `Toma ${shot + 1}/3 · ${s.name}`;
        if (zoomAnim) zoomAnim.cancel();
        zoomAnim = scene.animate([{ transform: `scale(${s.zoom[0]})` }, { transform: `scale(${s.zoom[1]})` }], { duration: DUR, easing: 'linear', fill: 'forwards' });
        cut.animate([{ opacity: 0.6 }, { opacity: 0 }], { duration: 280, easing: 'ease-out' });
        if (shot === 0) {
          if (barAnim) barAnim.cancel();
          barAnim = bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: DUR * SHOTS.length, easing: 'linear', fill: 'forwards' });
        }
      }
      setTimeout(play, DUR);
    };
    if (reduce) vfv.dataset.shot = 2;   // con "reducir movimiento": quieto en la toma del título
    else {
      new IntersectionObserver(([e]) => { on = e.isIntersecting; }, { threshold: 0.3 }).observe(vfv);
      play();
    }
  }
  const vfCard = $('.svc-card.card-wide');
  if (vfCard && !reduce && vfCard.animate) {
    const loopAnim = (el, frames, ms) => el && el.animate(frames, { duration: ms, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    loopAnim($('.fl-orb', vfCard), [{ translate: '0 0' }, { translate: '0 -9px' }], 3200);
    loopAnim($('.fl-glow', vfCard), [{ opacity: 0.7, scale: '1' }, { opacity: 1, scale: '1.12' }], 4200);
    if (isLite()) {
      loopAnim($('.vf-orb', vfCard), [{ translate: '0 0' }, { translate: '0 -10px' }], 3000);
      loopAnim($('.vf-light', vfCard), [{ transform: 'translateX(0)' }, { transform: 'translateX(95%)' }], 5500);
      loopAnim($('.vf-shadow', vfCard), [{ scale: '1', opacity: 1 }, { scale: '.85', opacity: 0.7 }], 3000);
      const rec = $('.rec', vfCard);
      if (rec) rec.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], { duration: 1400, iterations: Infinity });
    }
  }

  /* ---------- Recorridos de cuadros: Servicios y Automatización (las dos versiones) ----------
     · Si los cuadros caben en la pantalla, la sección se queda fija (.is-pinned) y el scroll
       los pasa de lado, de uno en uno.
     · Si no caben (celulares), van uno debajo de otro.
     En los dos casos, al soltar el scroll la página se ajusta sola para dejar centrado el
     cuadro siguiente (o el anterior, si subías). Flechas, puntos e índices llevan directo a
     cada uno; los enlaces [data-svc-go] de fuera van a Servicios, salvo que digan a qué
     sección con data-svc-for. */
  $$('.svc').forEach((svc) => {
    const scroller = $('.svc-scroll', svc);
    const stage = $('.svc-stage', svc);
    const view = $('.svc-view', svc);
    const track = $('.svc-track', svc);
    const cards = $$('.svc-card', track);
    const dots = $$('.svc-dot', svc);
    const prev = $('.svc-prev', svc), next = $('.svc-next', svc);
    const count = $('.svc-count b', svc);
    const n = cards.length;
    // el primer cuadro es la presentación ("Seis servicios. Un solo sistema."): cuenta como 00
    const intro = cards.filter((c) => c.classList.contains('svc-intro')).length;
    const NAV = 92, UI = 72;   // franja libre entre el menú fijo y los controles de abajo
    let pinned = false, active = -1, starts = [], ends = [], centers = [], shownX = '', raf = 0;
    let lastW = 0, lastH = 0;

    // dónde queda centrada cada tarjeta (scrollY de la página). Una tarjeta más alta que la
    // pantalla se puede leer entera: va de su borde de arriba (starts) a su borde de abajo (ends)
    function measureStops() {
      const y = scrollY;
      if (pinned) {
        const top = scroller.getBoundingClientRect().top + y;
        const step = (scroller.offsetHeight - stage.offsetHeight) / Math.max(1, n - 1);
        starts = cards.map((_, i) => top + i * step);
        ends = starts;
      } else {
        const room = innerHeight - NAV - UI;
        starts = [];
        ends = [];
        cards.forEach((c) => {
          // el centro no cambia con la escala de --f; el alto, sin escalar
          const r = c.getBoundingClientRect(), h = c.offsetHeight;
          const s = (r.top + r.bottom) / 2 + y - h / 2 - NAV - Math.max(0, (room - h) / 2);
          starts.push(s);
          ends.push(s + Math.max(0, h - room));
        });
      }
    }
    // posición de la página → tarjeta, con decimales entre una y otra
    // (antes de la primera da menos de 0; después de la última, más de n - 1)
    function indexAt(y) {
      if (n < 2) return 0;
      if (y < starts[0]) return (y - starts[0]) / (starts[1] - ends[0]);
      for (let i = 0; i < n; i++) {
        if (y <= ends[i]) return i;
        if (i < n - 1 && y < starts[i + 1]) return i + (y - ends[i]) / (starts[i + 1] - ends[i]);
      }
      return n - 1 + (y - ends[n - 1]) / (starts[n - 1] - ends[n - 2]);
    }
    // el punto más cercano en el que la tarjeta i se ve bien
    const stopFor = (i, y) => clamp(y, starts[i], ends[i]);

    function setActive(i) {
      if (i === active) return;
      active = i;
      cards.forEach((c, j) => c.classList.toggle('is-active', j === i));
      dots.forEach((d, j) => d.setAttribute('aria-current', String(j === i)));
      count.textContent = String(Math.max(0, i - intro + 1)).padStart(2, '0');
      prev.disabled = i === 0;
      next.disabled = i === n - 1;
    }
    const setFocus = (c, k) => {
      const v = k.toFixed(3);
      if (c._f !== v) { c._f = v; c.style.setProperty('--f', v); }
    };

    function render() {
      raf = 0;
      const r = svc.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) return;   // lejos de la pantalla: nada que mover
      measureStops();
      const f = indexAt(scrollY);
      const at = clamp(f, 0, n - 1);
      if (pinned) {
        const i = Math.min(n - 2, Math.floor(at));
        const c = centers[i] + (centers[i + 1] - centers[i]) * (at - i);
        const x = `translate3d(${(view.clientWidth / 2 - c).toFixed(1)}px, 0, 0)`;
        if (x !== shownX) { shownX = x; track.style.transform = x; }
        cards.forEach((card, j) => setFocus(card, clamp(1 - Math.abs(j - at), 0, 1)));
      } else {
        // una debajo de otra: cuánto de cada tarjeta se ve en la franja libre
        const top = NAV, bottom = innerHeight - UI, room = bottom - top;
        cards.forEach((card) => {
          const cr = card.getBoundingClientRect();
          const seen = Math.min(cr.bottom, bottom) - Math.max(cr.top, top);
          setFocus(card, clamp(seen / Math.min(cr.height, room), 0, 1));
        });
      }
      setActive(Math.round(at));
    }
    const queue = () => { if (!raf) raf = requestAnimationFrame(render); };

    // modo: fija si el texto de todas las tarjetas cabe en la pantalla
    function measure() {
      lastW = innerWidth;
      lastH = innerHeight;
      svc.classList.add('is-on', 'is-pinned');
      pinned = cards.every((c) => c.scrollHeight <= c.clientHeight + 1);
      if (!pinned) {
        svc.classList.remove('is-pinned');
        track.style.transform = shownX = '';
      }
      centers = cards.map((c) => c.offsetLeft + c.offsetWidth / 2);
      if (active < 0) setActive(0);
      render();
    }

    // going = destino de un salto (flechas, puntos, barra del hero): mientras viaja, nada lo corrige
    let going = null, lastPoll = -1;
    function goTo(i) {
      i = clamp(i, 0, n - 1);
      measureStops();
      going = Math.round(starts[i]);
      lastPoll = -1;
      scrollTo({ top: going, behavior: 'smooth' });
    }
    // si quien visita mueve la página, el salto deja de mandar
    const takeOver = () => { going = null; };
    addEventListener('wheel', takeOver, { passive: true });
    addEventListener('keydown', takeOver);

    // al soltar el scroll: la siguiente tarjeta en la dirección en que ibas, centrada
    // rest = dónde estaba quieta la página; from = esa posición en tarjetas, al empezar a moverse
    let idle = 0, from = null, rest = scrollY, touching = false;
    function settle() {
      if (going !== null) {
        const y = scrollY;
        // sigue viajando: esperar; llegó (o el navegador lo detuvo): queda quieta ahí
        if (Math.abs(y - going) > 2 && y !== lastPoll) {
          lastPoll = y;
          idle = setTimeout(settle, 150);
          return;
        }
        going = null;
        from = null;
        rest = y;
        return;
      }
      if (touching || from === null) return;
      measureStops();
      const y = scrollY, f = indexAt(y), start = from, moved = f - start;
      from = null;
      rest = y;
      if (Math.abs(moved) < 0.01 || f === Math.round(f)) return;   // quieto, o leyendo una tarjeta alta
      const down = moved > 0;
      let t;
      if (f < 0) {
        if (!down || f < -0.35) return;           // entrando desde arriba: a la primera
        t = 0;
      } else if (f > n - 1) {
        if (down || f > n - 1 + 0.35) return;     // saliendo por abajo, libre; volviendo: a la última
        t = n - 1;
      } else {
        t = down ? Math.ceil(f - 0.12) : Math.floor(f + 0.12);
        // paso a paso: un gesto corto (rueda, Av Pág, espacio) avanza solo una tarjeta
        // (entrando desde arriba, la primera; desde abajo, la última)
        if (Math.abs(moved) < 1.6) {
          const base = start < -0.05 ? -1 : start > n - 0.95 ? n : Math.round(start);
          t = down ? Math.min(t, base + 1) : Math.max(t, base - 1);
        }
      }
      const to = Math.round(stopFor(clamp(t, 0, n - 1), y));
      if (Math.abs(to - y) > 2) {
        rest = to;
        scrollTo({ top: to, behavior: 'smooth' });
      }
    }
    addEventListener('scroll', () => {
      queue();
      const r = svc.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) { rest = scrollY; from = null; return; }
      if (from === null) {
        measureStops();
        from = indexAt(rest);
      }
      clearTimeout(idle);
      idle = setTimeout(settle, 150);
    }, { passive: true });
    addEventListener('touchstart', () => { touching = true; going = null; }, { passive: true });
    const untouch = (e) => {
      if (e.touches.length) return;
      touching = false;
      clearTimeout(idle);
      idle = setTimeout(settle, 150);
    };
    addEventListener('touchend', untouch, { passive: true });
    addEventListener('touchcancel', untouch, { passive: true });

    prev.addEventListener('click', () => goTo(active - 1));
    next.addEventListener('click', () => goTo(active + 1));
    dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));
    // en la versión fija, tocar una tarjeta de al lado la trae al centro
    track.addEventListener('click', (e) => {
      const i = cards.indexOf(e.target.closest('.svc-card'));
      if (!pinned || i < 0 || i === active || e.target.closest('[data-svc-go]')) return;
      e.preventDefault();
      goTo(i);
    });
    // con el teclado (Tab), la tarjeta que recibe el foco pasa al centro
    track.addEventListener('focusin', (e) => {
      const i = cards.indexOf(e.target.closest('.svc-card'));
      if (pinned && i >= 0 && i !== active) goTo(i);
    });
    // la barra del hero, los índices de las presentaciones y otros enlaces llevan directo a cada cuadro
    const ownerOf = (a) => (a.dataset.svcFor ? document.getElementById(a.dataset.svcFor) : a.closest('.svc') || $('#servicios'));
    $$('[data-svc-go]').filter((a) => ownerOf(a) === svc).forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      goTo(intro + Number(a.dataset.svcGo));
    }));

    // en el celular la barra del navegador cambia el alto al bajar: solo se mide de nuevo
    // si cambia el ancho o el alto cambia de verdad (girar, cambiar el tamaño de la ventana)
    let rt = 0;
    addEventListener('resize', () => {
      if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 120) { queue(); return; }
      clearTimeout(rt);
      rt = setTimeout(measure, 120);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    measure();
  });

  /* ---------- Pestañas de ejemplo: Productos / Reservas (02) y Video / Flyer (06) ----------
     Se alternan solos cada 4,5 s mientras se ven; al tocar una pestaña se queda en esa un rato. */
  // data-tabs="8400,4500": cuánto se queda cada pestaña (ms); sin valor, 4,5 s cada una
  $$('[data-tabs]').forEach((box) => {
    const tabs = $$('.ma-tab', box), panes = $$('.ma-pane', box);
    const times = (box.dataset.tabs || '').split(',').map(Number);
    let cur = 0, inView = false, hold = 0;
    const show = (i) => {
      cur = i;
      tabs.forEach((t, j) => t.setAttribute('aria-selected', String(j === i)));
      panes.forEach((p, j) => p.classList.toggle('is-on', j === i));
    };
    tabs.forEach((t, i) => t.addEventListener('click', () => { show(i); hold = Date.now() + 12000; }));
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; }, { threshold: 0.5 }).observe(box);
    const next = () => setTimeout(() => {
      if (inView && !document.hidden && !isLow() && Date.now() > hold) show((cur + 1) % tabs.length);
      next();
    }, times[cur] || 4500);
    if (!reduce) next();
  });

  /* ---------- Reporte de la tarjeta 04: la estadística se mueve (las dos versiones) ----------
     Al aparecer, todo sube desde cero; luego recorre tres semanas de ejemplo: los números
     cuentan, las barras crecen, cambia de dónde llegan las visitas y la recomendación.
     Se queda más rato en la última semana y solo se mueve mientras se ve. */
  const dash = $('[data-dash]');
  if (dash) {
    const WEEKS = [
      { range: '7–13 sep', v: 3480, n: 2050, t: 138, d: [12, 13, 5], days: [420, 470, 455, 520, 610, 560, 445],
        src: [58, 21, 21], doubt: 'el 41% se va en «Envíos».', tip: 'mostrar el costo de envío desde la ficha.' },
      { range: '14–20 sep', v: 3910, n: 2380, t: 149, d: [12, 16, 8], days: [470, 520, 500, 590, 690, 650, 490],
        src: [60, 22, 18], doubt: 'el 36% se va en «Precios».', tip: 'añadir reseñas junto a los precios.' },
      { range: '21–27 sep', v: 4812, n: 3021, t: 161, d: [23, 27, 8], days: [540, 610, 580, 720, 860, 820, 682],
        src: [61, 24, 15], doubt: 'el 38% se va en «Envíos».', tip: 'mostrar el costo de envío en cada producto.' }
    ];
    const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const k = (name) => $(`[data-k=${name}]`, dash);
    const el = { range: k('range'), v: k('v'), n: k('n'), t: k('t'), doubt: k('doubt'), tip: k('tip') };
    const deltas = $$('.dash-kpis em', dash);
    const chart = $('.mc-bars', dash);
    const bars = $$('.mc-bars > span', dash);
    const src = $$('.dash-src li', dash);
    const box = $('.dash-tip', dash);
    const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
    const put = { v: fmt, n: fmt, t: mmss };
    const shown = { v: 0, n: 0, t: 0 };
    bars.forEach((b, i) => b.style.setProperty('--n', i));

    const count = (key, to) => {
      const from = shown[key], t0 = performance.now(), dur = 1100;
      const step = (now) => {
        const p = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3);
        el[key].textContent = put[key](from + (to - from) * e);
        if (p < 1) requestAnimationFrame(step);
      };
      shown[key] = to;
      requestAnimationFrame(step);
    };
    const show = (w) => {
      el.range.textContent = w.range;
      ['v', 'n', 't'].forEach((key) => count(key, w[key]));
      deltas.forEach((e, i) => { e.textContent = `↑ ${w.d[i]}%`; });
      const max = Math.max(...w.days);
      bars.forEach((b, i) => {
        b.style.setProperty('--h', (w.days[i] / max).toFixed(3));
        b.classList.toggle('peak', w.days[i] === max);
        b.dataset.tip = `${DAYS[i]} · ${fmt(w.days[i])}`;
      });
      chart.setAttribute('aria-label', 'Visitas por día: ' + w.days.map((x, i) => `${DAYS[i].toLowerCase()} ${x}`).join(', '));
      src.forEach((li, i) => {
        $('b', li).textContent = `${w.src[i]}%`;
        $('i', li).style.setProperty('--w', (w.src[i] / 100).toFixed(2));
      });
      // la recomendación cambia con un fundido corto
      box.classList.add('fade');
      setTimeout(() => {
        el.doubt.textContent = w.doubt;
        el.tip.textContent = w.tip;
        box.classList.remove('fade');
      }, 260);
    };

    let cur = WEEKS.length - 1, inView = false, started = false, timer = 0;
    const loop = () => {
      timer = setTimeout(() => {
        if (inView && !document.hidden && !isLow()) { cur = (cur + 1) % WEEKS.length; show(WEEKS[cur]); }
        loop();
      }, cur === WEEKS.length - 1 ? 6000 : 3800);
    };
    const start = () => {
      started = true;
      // desde cero: barras vacías, números en 0, y en el siguiente cuadro sube a la primera semana
      bars.forEach((b) => b.style.setProperty('--h', '0'));
      src.forEach((li) => $('i', li).style.setProperty('--w', '0'));
      ['v', 'n', 't'].forEach((key) => { shown[key] = 0; el[key].textContent = put[key](0); });
      cur = 0;
      requestAnimationFrame(() => requestAnimationFrame(() => show(WEEKS[0])));
      loop();
    };
    if (!reduce) {
      new IntersectionObserver(([e]) => {
        inView = e.isIntersecting;
        if (inView && !started && !isLow()) start();
      }, { threshold: 0.35 }).observe(dash);
    }
  }

  /* ---------- Redes → tu web (tarjeta 05): las visitas viajan (las dos versiones) ----------
     Cada poco sale una visita de Instagram, TikTok o Facebook (su borde se enciende), viaja
     por su línea como un punto de luz y al llegar "Tu web" late y suma la visita. */
  const flow = $('.svc-card .social-flow');
  if (flow && !reduce) {
    const wire = $('.sf-wire', flow);
    const paths = $$('.sf-lines path', flow);
    const nets = $$('.sf-src', flow);
    const target = $('.sf-target', flow);
    const counter = $('[data-sf-count]', flow);
    const VB_W = 100, VB_H = 144;           // viewBox de las líneas
    const WEIGHT = [0.45, 0.3, 0.25];        // Instagram llega más seguido que TikTok y Facebook
    const lens = paths.map((p) => p.getTotalLength());
    let total = 1284, dots = [], raf = 0, nextAt = 0, hitTimer = 0;
    const pick = () => { let r = Math.random(); for (let i = 0; i < WEIGHT.length; i++) { if ((r -= WEIGHT[i]) < 0) return i; } return 0; };
    const ping = (el, cls, ms) => { el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); };
    const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

    const arrive = () => {
      total += 1 + Math.floor(Math.random() * 3);
      if (total > 9999) total = 1284;
      counter.textContent = '+' + fmt(total);
      clearTimeout(hitTimer);
      target.classList.add('is-hit');
      hitTimer = setTimeout(() => target.classList.remove('is-hit'), 220);
    };
    const tick = (now) => {
      if (isLow()) return stop();
      raf = requestAnimationFrame(tick);
      if (now >= nextAt) {
        const i = pick();
        const el = document.createElement('i');
        el.className = 'sf-dot';
        wire.appendChild(el);
        dots.push({ el, i, t0: now, dur: 1300 + Math.random() * 600 });
        ping(nets[i], 'is-ping', 420);
        nextAt = now + 420 + Math.random() * 520;
      }
      const w = wire.clientWidth, h = wire.clientHeight;
      dots = dots.filter((d) => {
        const p = (now - d.t0) / d.dur;
        if (p >= 1) { d.el.remove(); arrive(); return false; }
        const pt = paths[d.i].getPointAtLength(lens[d.i] * ease(p));
        d.el.style.transform = `translate3d(${(pt.x / VB_W * w).toFixed(1)}px, ${(pt.y / VB_H * h).toFixed(1)}px, 0)`;
        d.el.style.opacity = p < 0.12 ? (p / 0.12).toFixed(2) : p > 0.88 ? ((1 - p) / 0.12).toFixed(2) : '1';
        return true;
      });
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      dots.forEach((d) => d.el.remove());
      dots = [];
    };
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !raf) { nextAt = 0; raf = requestAnimationFrame(tick); }
      else if (!e.isIntersecting && raf) stop();
    }, { threshold: 0.3 }).observe(flow);
  }

  /* ---------- Automatización Web: demo paso a paso (las dos versiones) ----------
     Alguien escribe en el formulario de tu web, pulsa Enviar y cada automatización se
     enciende en orden: recibido, guardado, correo, cita y aviso. Vuelve a empezar mientras se ve. */
  const aw = $('[data-aw]');
  if (aw && !reduce) {
    const ins = $$('.aw-in', aw), send = $('.aw-send', aw), steps = $$('.aw-steps li', aw);
    const texts = ins.map((el) => el.textContent);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let on = false, running = false;
    const type = async (el, text) => {
      el.classList.add('is-typing');
      for (let i = 1; i <= text.length; i++) {
        el.textContent = text.slice(0, i);
        await wait(38 + Math.random() * 42);
      }
      el.classList.remove('is-typing');
    };
    const run = async () => {
      running = true;
      while (on && !isLow()) {
        aw.classList.add('is-live');
        ins.forEach((el) => { el.textContent = ''; });
        steps.forEach((s) => s.classList.remove('is-on', 'is-done'));
        send.textContent = 'Enviar';
        send.classList.remove('is-sent');
        await wait(600);
        for (let i = 0; i < ins.length; i++) { await type(ins[i], texts[i]); await wait(160); }
        send.classList.add('is-press');
        await wait(180);
        send.classList.remove('is-press');
        send.textContent = 'Enviado ✓';
        send.classList.add('is-sent');
        for (const s of steps) {
          s.classList.add('is-on');
          await wait(850);
          s.classList.remove('is-on');
          s.classList.add('is-done');
        }
        await wait(2800);
      }
      running = false;
    };
    new IntersectionObserver(([e]) => {
      on = e.isIntersecting;
      if (on && !running) run();
    }, { threshold: 0.3 }).observe(aw);
  }

  /* ---------- Automatización Completa: demo del chat (las dos versiones) ----------
     Un cliente escribe por WhatsApp, el asistente responde con un menú y agenda la cita;
     luego cada herramienta conectada se enciende y la línea de abajo explica qué hizo. */
  const ac = $('[data-ac]');
  if (ac && !reduce) {
    const msgs = $$('.ac-msg', ac), typing = $('.ac-typing', ac), tools = $$('.ac-tools span', ac);
    const cap = $('.ac-cap', ac), capTool = $('[data-k=tool]', ac), capWhat = $('[data-k=what]', ac);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let on = false, running = false, dots = [];
    const pop = (el) => {
      el.classList.add('is-show');
      el.animate([{ opacity: 0, transform: 'translateY(8px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    };
    const write = async (ms) => {   // "escribiendo…" con los tres puntos saltando
      typing.classList.add('is-show');
      dots = $$('i', typing).map((d, i) => d.animate([{ transform: 'none' }, { transform: 'translateY(-3px)' }, { transform: 'none' }], { duration: 700, delay: i * 120, iterations: Infinity }));
      await wait(ms);
      dots.forEach((a) => a.cancel());
      typing.classList.remove('is-show');
    };
    const say = (tool, what) => {
      cap.classList.add('fade');
      setTimeout(() => { capTool.textContent = tool; capWhat.textContent = what; cap.classList.remove('fade'); }, 250);
    };
    const light = async (i, tool, what, ms = 1300) => {
      tools[i].classList.add('is-on');
      say(tool, what);
      await wait(ms);
      tools[i].classList.remove('is-on');
      tools[i].classList.add('is-done');
    };
    const run = async () => {
      running = true;
      while (on && !isLow()) {
        ac.classList.add('is-live');
        msgs.forEach((m) => m.classList.remove('is-show'));
        tools.forEach((t) => t.classList.remove('is-on', 'is-done'));
        say('Cliente', 'escribe a tu negocio por WhatsApp, a cualquier hora');
        await wait(500);
        await write(900);
        pop(msgs[0]);
        await wait(500);
        tools[0].classList.add('is-on');
        say('WhatsApp e Instagram', 'responden al instante con un menú');
        await wait(500);
        pop(msgs[1]);
        await wait(1100);
        tools[0].classList.remove('is-on');
        tools[0].classList.add('is-done');
        await write(700);
        pop(msgs[2]);
        await wait(400);
        tools[1].classList.add('is-on');
        say('Google Calendar', 'agenda la cita sola, sin cruces de horario');
        await wait(500);
        pop(msgs[3]);
        await wait(900);
        tools[1].classList.remove('is-on');
        tools[1].classList.add('is-done');
        await light(2, 'Gmail', 'envía la confirmación y el link de pago');
        await light(3, 'CRM', 'registra al cliente con su historial');
        await light(4, 'Recordatorio', 'por WhatsApp y correo, 24 h antes de la cita');
        await light(5, 'Pagos', 'confirma el pago y pide una reseña en Google');
        say('Todo conectado', 'sin que tú escribas un solo mensaje');
        await wait(3000);
      }
      running = false;
    };
    new IntersectionObserver(([e]) => {
      on = e.isIntersecting;
      if (on && !running) run();
    }, { threshold: 0.3 }).observe(ac);
  }

  /* ---------- Automatización Avanzada: demo del flujo a medida (las dos versiones) ----------
     Entra un pedido, la IA lo califica, una regla propia pide aprobación, tres tareas corren
     en paralelo y el panel se actualiza; un pulso baja por cada conexión. Se repite mientras se ve. */
  const av = $('[data-av]');
  if (av && !reduce) {
    const flow = $('.av-flow', av);
    const steps = [...flow.children].filter((el) => !el.classList.contains('av-link'));   // nodos y el grupo en paralelo
    const links = $$('.av-link', av);
    const status = $('[data-k=status]', av), rule = $('[data-k=rule]', av), cap = $('[data-k=cap]', av);
    const ruleText = rule.textContent;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let on = false, running = false;
    const say = (t) => {
      cap.classList.add('fade');
      setTimeout(() => { cap.textContent = t; cap.classList.remove('fade'); }, 250);
    };
    const nodesOf = (step) => (step.classList.contains('av-node') ? [step] : $$('.av-node', step));
    const lightOn = async (step, stagger = 0) => {
      for (const n of nodesOf(step)) { n.classList.add('is-on'); if (stagger) await wait(stagger); }
    };
    const lightDone = (step) => nodesOf(step).forEach((n) => { n.classList.remove('is-on'); n.classList.add('is-done'); });
    const pulse = (link) => {
      const dot = $('i', link);
      return dot.animate(
        [{ top: '-3px', opacity: 0 }, { top: '0px', opacity: 1, offset: 0.15 }, { top: '10px', opacity: 1, offset: 0.85 }, { top: '14px', opacity: 0 }],
        { duration: 520, easing: 'ease-in-out' }
      ).finished.catch(() => {});
    };
    const TEXTS = [
      'Entra un pedido por la web o por WhatsApp.',
      'El asistente con IA lo lee y lo califica: cliente mayorista.',
      'Tu regla: si supera $2.000, te pide aprobación antes de seguir.',
      'En paralelo: descuenta inventario en 3 sedes, emite la factura y actualiza el CRM.',
      'Tu panel muestra los indicadores al instante.'
    ];
    const run = async () => {
      running = true;
      while (on && !isLow()) {
        av.classList.add('is-live');
        $$('.av-node', av).forEach((n) => n.classList.remove('is-on', 'is-done'));
        rule.textContent = ruleText;
        status.textContent = 'Listo para ejecutar';
        status.classList.remove('is-run', 'is-ok');
        say('Un flujo hecho a la medida de tu empresa, de punta a punta.');
        await wait(1200);
        status.textContent = 'En ejecución';
        status.classList.add('is-run');
        for (let i = 0; i < steps.length; i++) {
          if (i > 0) await pulse(links[i - 1]);
          say(TEXTS[i]);
          await lightOn(steps[i], i === 3 ? 160 : 0);
          if (i === 2) { await wait(900); rule.textContent = 'Aprobado ✓ por gerencia'; }
          await wait(i === 3 ? 1400 : 1000);
          lightDone(steps[i]);
        }
        status.textContent = 'Completado ✓ · 4 s';
        status.classList.remove('is-run');
        status.classList.add('is-ok');
        say('Todo el proceso corre solo, mientras tú atiendes tu negocio.');
        await wait(3000);
      }
      running = false;
    };
    new IntersectionObserver(([e]) => {
      on = e.isIntersecting;
      if (on && !running) run();
    }, { threshold: 0.3 }).observe(av);
  }

  /* ---------- Así trabaja una automatización completa: los pasos se encienden (las dos versiones) ----------
     La línea se llena de un paso al siguiente; el que llega se enciende y los anteriores quedan
     marcados. Al terminar espera un momento y vuelve a empezar, solo mientras se ve. */
  const flowCard = $('[data-flow]');
  if (flowCard && !reduce) {
    const box = $('.flow-box', flowCard), items = $$('.flow li', flowCard);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let on = false, running = false;
    const run = async () => {
      running = true;
      while (on && !isLow()) {
        flowCard.classList.add('is-live');
        items.forEach((li) => li.classList.remove('is-on', 'is-done'));
        box.style.setProperty('--p', 0);
        await wait(700);
        for (let i = 0; i < items.length; i++) {
          box.style.setProperty('--p', (i / (items.length - 1)).toFixed(3));
          await wait(i ? 450 : 0);
          items[i].classList.add('is-on');
          await wait(900);
          items[i].classList.remove('is-on');
          items[i].classList.add('is-done');
        }
        await wait(2600);
      }
      running = false;
    };
    new IntersectionObserver(([e]) => {
      on = e.isIntersecting;
      if (on && !running) run();
    }, { threshold: 0.3 }).observe(flowCard);
  }

  /* ---------- Ecosistema (órbita) ----------
     En las dos versiones se elige tocando una burbuja; el recorrido automático es solo del 3D. */
  const orbit = $('#orbit');
  if (orbit) {
    const items = $$('.orbit-item', orbit);
    const panel = $('#eco-panel');
    const els = { kicker: $('#eco-kicker'), title: $('#eco-title'), desc: $('#eco-desc'), icon: $('#eco-icon') };
    let idx = -1, autoTimer = 0, resumeTimer = 0, inView = false;

    const select = (i) => {
      if (i === idx) return;
      idx = i;
      const it = items[i];
      items.forEach((el, j) => el.classList.toggle('active', j === i));
      els.kicker.textContent = it.dataset.group;
      els.title.textContent = it.dataset.title;
      els.desc.textContent = it.dataset.desc;
      els.icon.innerHTML = it.querySelector('svg').outerHTML;
      panel.classList.remove('swapping');
      void panel.offsetWidth;
      panel.classList.add('swapping');
    };
    const startAuto = () => {
      if (isLite()) return;
      clearInterval(autoTimer);
      autoTimer = setInterval(() => { if (inView) select((idx + 1) % items.length); }, 3400);
    };
    const userPick = (i) => {
      clearInterval(autoTimer);
      clearTimeout(resumeTimer);
      orbit.classList.add('paused');
      select(i);
      resumeTimer = setTimeout(() => { orbit.classList.remove('paused'); startAuto(); }, 9000);
    };
    items.forEach((it, i) => {
      it.addEventListener('mouseenter', () => userPick(i));
      it.addEventListener('focus', () => userPick(i));
      it.addEventListener('click', () => userPick(i));
    });
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; }, { threshold: 0.3 }).observe(orbit);
    fx.push(startAuto);
  }

  /* ---------- Demo del panel de administrador ---------- */
  const table = $('#a-table');
  if (table) {
    const cats = ['Fragancias', 'Accesorios', 'Marroquinería'];
    const shapes = ['p1', 'p2', 'p3'];
    const rows = $$('.a-row[data-i]', table);
    const pv = { card: $('#pv-card'), obj: $('#pv-obj'), cat: $('#pv-cat'), name: $('#pv-name'), price: $('#pv-price') };
    const saveState = $('#save-state');
    const publishBtn = $('#publish');
    const toast = $('#toast');
    let sel = 0, toastTimer = 0;

    const read = (row) => ({
      name: $('[data-k=name]', row).value.trim(),
      price: $('[data-k=price]', row).value,
      visible: $('[data-k=visible]', row).checked
    });

    const render = (flash) => {
      const d = read(rows[sel]);
      pv.cat.textContent = cats[sel];
      pv.name.textContent = d.name || 'Sin nombre';
      pv.price.textContent = d.price === '' ? '$—' : '$' + fmt(Math.max(0, Number(d.price)));
      pv.obj.className = 'pv-obj ' + shapes[sel];
      pv.card.classList.toggle('is-off', !d.visible);
      if (flash) {
        pv.card.classList.remove('flash');
        void pv.card.offsetWidth;
        pv.card.classList.add('flash');
      }
    };
    const setSel = (i) => {
      if (i === sel) return;
      sel = i;
      rows.forEach((r, j) => r.classList.toggle('sel', j === i));
      render(true);
    };
    const markDirty = () => {
      saveState.classList.add('dirty');
      saveState.lastElementChild.textContent = 'Cambios sin publicar';
      publishBtn.disabled = false;
    };

    rows.forEach((row, i) => {
      row.addEventListener('pointerdown', () => setSel(i));
      row.addEventListener('focusin', () => setSel(i));
      row.addEventListener('input', () => {
        row.classList.toggle('is-off', !$('[data-k=visible]', row).checked);
        setSel(i);
        render(false);
        markDirty();
      });
    });

    publishBtn.disabled = true;
    publishBtn.addEventListener('click', () => {
      publishBtn.disabled = true;
      publishBtn.textContent = 'Publicando…';
      setTimeout(() => {
        publishBtn.textContent = 'Publicar cambios';
        saveState.classList.remove('dirty');
        saveState.lastElementChild.textContent = 'Publicado hace un momento';
        render(true);
        $('#toast-text').textContent = 'Cambios publicados en tu web';
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
      }, 650);
    });
    render(false);
  }

  /* ---------- Reporte semanal ---------- */
  const report = $('#report');
  if (report) {
    const W = {
      35: { v: 2890, s: 1640, d: 401, c: 88 },
      36: { v: 3120, s: 1810, d: 420, c: 96, range: '31 ago – 6 sep', heat: [100, 64, 45, 29, 12], doubt: 3,
            tip: 'El 38% de quienes llegan a «Envíos» se va sin comprar. Recomendación: mostrar el costo de envío desde la ficha de producto.' },
      37: { v: 3480, s: 2050, d: 465, c: 112, range: '7 – 13 sep', heat: [100, 66, 47, 31, 13], doubt: 3,
            tip: 'Las visitas desde Instagram crecieron un 21%. Recomendación: fijar en el perfil un enlace directo al catálogo.' },
      38: { v: 3910, s: 2380, d: 498, c: 131, range: '14 – 20 sep', heat: [100, 69, 50, 34, 15], doubt: 2,
            tip: 'Quienes ven el video del producto compran 2,3× más. Recomendación: añadir video a los 5 productos más vistos.' },
      39: { v: 4812, s: 3021, d: 544, c: 168, range: '21 – 27 sep', heat: [100, 72, 52, 36, 17], doubt: 2,
            tip: 'Semana récord: las compras crecieron un 28%. La sección «Precios» sigue siendo el punto de duda: sugerimos añadir garantía y reseñas justo ahí.' }
    };
    const kpi = { v: $('#k-v'), s: $('#k-s'), d: $('#k-d'), c: $('#k-c') };
    const dlt = { v: $('#d-v'), s: $('#d-s'), d: $('#d-d'), c: $('#d-c') };
    const bars = $$('.f-bar', report);
    const vals = $$('.f-val', report);
    const heat = $$('.hs', report);
    const insight = $('.insight', report);
    const shown = { v: 4812, s: 3021, d: 544, c: 168 };
    const pct = (x) => (x >= 10 ? Math.round(x) + '%' : x.toFixed(1).replace('.', ',') + '%');

    const tween = (key, to) => {
      const from = shown[key];
      const el = kpi[key];
      const t0 = performance.now(), dur = 900;
      const step = (now) => {
        const k = clamp((now - t0) / dur, 0, 1);
        const e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(from + (to - from) * e);
        if (k < 1) requestAnimationFrame(step);
        else shown[key] = to;
      };
      requestAnimationFrame(step);
    };

    const show = (w, animate) => {
      const d = W[w], p = W[w - 1];
      $('#r-range').textContent = d.range;
      ['v', 's', 'd', 'c'].forEach((k) => {
        animate ? tween(k, d[k]) : (kpi[k].textContent = fmt(d[k]), shown[k] = d[k]);
        const ch = ((d[k] - p[k]) / p[k]) * 100;
        dlt[k].textContent = `${ch >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(ch))}% vs. semana anterior`;
      });
      const cart = d.d + d.c;
      const steps = [d.v, d.s, cart, d.c];
      steps.forEach((n, i) => {
        const r = n / d.v;
        bars[i].style.setProperty('--w', r.toFixed(4));
        vals[i].textContent = pct(r * 100);
        bars[i].parentElement.parentElement.setAttribute('title', `${fmt(n)} personas`);
      });
      $('#f-note').textContent = `↳ ${fmt(d.d)} personas dudaron: llegaron al carrito y no completaron la compra.`;
      heat.forEach((h, i) => {
        h.style.setProperty('--v', (d.heat[i] / 100).toFixed(2));
        h.querySelector('b').textContent = d.heat[i] + '%';
        h.classList.toggle('doubt', i === d.doubt);
      });
      $('#insight').textContent = d.tip;
      if (animate) {
        insight.classList.remove('swapping');
        void insight.offsetWidth;
        insight.classList.add('swapping');
      }
    };

    const tabs = $$('.tab', report);
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
        show(Number(tab.dataset.w), !isLow());   // en Lite, los números cambian sin contar
      });
    });
    show(39, false);
  }

  /* ---------- Packs → preselección en el formulario ---------- */
  const packSelect = $('#f-pack');
  $$('[data-pack]').forEach((btn) => {
    btn.addEventListener('click', () => { if (packSelect) packSelect.value = btn.dataset.pack; });
  });

  /* ---------- Formulario de contacto ---------- */
  const form = $('#contact-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let ok = true;
      $$('[required]', form).forEach((input) => {
        const wrap = input.closest('.input');
        const bad = !input.value.trim();
        wrap.classList.toggle('invalid', bad);
        if (bad && ok) { input.focus(); ok = false; }
      });
      if (!ok) return;
      // TODO: conectar con tu servicio de formularios (Formspree, EmailJS, Make, WhatsApp API…)
      // const data = Object.fromEntries(new FormData(form));
      form.classList.add('sent');
    });
    $$('input, textarea', form).forEach((i) => i.addEventListener('input', () => i.closest('.input').classList.remove('invalid')));
  }

  /* ---------- Enlaces pendientes de configurar ---------- */
  $$('[data-todo]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));

  /* ---------- Año ---------- */
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Invitación a los efectos: sale del botón "3D" y se va sola a los 20 s ----------
     Solo en Esencial (ni en la 3D, que ya los tiene, ni en Lite, que es para equipos que no
     pueden con ellos), una vez por visita y no con movimiento reducido.
     Aparece a los 4 s de entrar, justo debajo del botón "3D" del menú, señalándolo (el botón se
     marca mientras tanto). La línea de abajo marca los 20 s y se detiene mientras el ratón está
     encima o el teclado dentro. Se va también al abrir el menú del celular. */
  const invite = $('#fx-invite');
  const fxBtn = $('.nav .fx-toggle.ver-to-3d');
  if (invite && fxBtn) {
    let seen = false;
    try { seen = sessionStorage.getItem('gotia-fx-invite') === '1'; } catch (e) {}
    if (isLite() && !reduce && !seen) {
      const bar = $('.fxi-bar', invite);
      const LIFE = 20000;
      // el tiempo lo lleva un temporizador (left = lo que falta); la línea solo lo dibuja
      let line = null, timer = 0, left = LIFE, since = 0, gone = false;
      // justo debajo del botón, sin salirse de la pantalla; --cx = dónde va la punta
      const place = () => {
        const r = fxBtn.getBoundingClientRect(), w = invite.offsetWidth;
        const cx = r.left + r.width / 2, x = clamp(cx - w / 2, 12, innerWidth - w - 12);
        invite.style.left = x + 'px';
        invite.style.top = r.bottom + 12 + 'px';
        invite.style.setProperty('--cx', cx - x + 'px');
      };
      const hide = () => {
        if (gone) return;
        gone = true;
        clearTimeout(timer);
        invite.classList.remove('show');
        fxBtn.classList.remove('is-invited');
        removeEventListener('resize', place);
        setTimeout(() => { invite.hidden = true; if (line) line.cancel(); }, 700);
      };
      const run = () => {
        if (gone || timer) return;
        since = Date.now();
        timer = setTimeout(hide, left);
        if (line) line.play();
      };
      const hold = () => {
        if (gone || !timer) return;
        clearTimeout(timer);
        timer = 0;
        left = Math.max(0, left - (Date.now() - since));
        if (line) line.pause();
      };
      setTimeout(() => {
        if (gone || isLow()) return;
        try { sessionStorage.setItem('gotia-fx-invite', '1'); } catch (e) {}
        invite.hidden = false;
        place();
        addEventListener('resize', place);
        invite.classList.add('show');
        fxBtn.classList.add('is-invited');
        if (bar.animate) line = bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: LIFE, fill: 'forwards' });
        run();
        invite.addEventListener('pointerenter', hold);
        invite.addEventListener('pointerleave', run);
        invite.addEventListener('focusin', hold);
        invite.addEventListener('focusout', () => setTimeout(() => { if (!invite.matches(':focus-within')) run(); }));
      }, 4000);
      $('.fxi-close', invite).addEventListener('click', hide);
      if (burger) burger.addEventListener('click', hide);
    }
  }

  /* ---------- Versión: Esencial, Lite o 3D ----------
     El <head> ya decidió: html.lite (Esencial, la que se ve al entrar), html.lite.lowend (Lite,
     para equipos de gama media-baja, internet lento o ahorro de datos) o ninguna (3D, con el
     botón "3D" del menú, que recarga la página con ?version=3d).
     · 3D: carga bubbles.js + scenes.js (WebGL), la pantalla de carga y todos los efectos.
     · Esencial: el mismo contenido y estilo, sin carga, sin WebGL y sin animaciones.
     · Lite: la Esencial con las demos quietas y completas, sin desenfoques ni transiciones.
     En planes.html no hay 3D: sin html.lowend lleva sus efectos (cursor, brillo de las tarjetas…). */
  function start(version) {
    if (version === 'esencial') {
      ['#loader', '#loader-g'].forEach((s) => { const el = $(s); if (el) el.remove(); });
      root.classList.remove('is-loading');
      $$('[data-reveal]').forEach((el) => el.classList.add('in'));
      document.body.classList.add('is-ready');
      return;
    }
    (gotia.fx || []).forEach((src) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = false;   // en orden: scenes.js usa lo que prepara bubbles.js
      document.body.appendChild(s);
    });
    runLoader();
    fx.forEach((f) => f());
  }

  /* ---------- Lite automática: las dos pruebas que no caben en el <head> ----------
     Cuando la página ya cargó (para no frenarla) y solo si quien visita no eligió versión:
     · gráficos: sin WebGL, dibujado por software o un chip gráfico de gama baja. Se mira una
       vez por navegador y se recuerda (gotia-gpu).
     · fluidez: mientras la página se desplaza se miden los cuadros por segundo; si dos tandas
       seguidas van a tirones (menos de ~28 por segundo, o 1 de cada 5 cuadros muy lento), pasa
       a Lite y lo recuerda 30 días (gotia-lento). Es la que decide en iPhone y Safari, que no
       dicen su memoria ni sus núcleos.
     Si alguna salta, la web pasa a Lite en el momento, sin recargar: el CSS lo aquieta todo y
     las demos terminan la vuelta que llevan. */
  const LOW_GPU = /SwiftShader|llvmpipe|Software|Basic Render|Mali-(4\d\d|T\d+|G(31|51|52|57|71|72)\b)|Adreno \(TM\) ([1-5]\d\d|610)\b|PowerVR|SGX/i;

  function toLow(why) {
    if (isLow()) return;
    gotia.low = why;
    root.classList.add('lowend');
    // los bucles de Web Animations (el flyer que flota, el REC del visor…) se quedan quietos
    if (document.getAnimations) {
      document.getAnimations().forEach((a) => { if (a.effect && a.effect.getTiming().iterations === Infinity) a.cancel(); });
    }
    document.dispatchEvent(new CustomEvent('gotia:lowend', { detail: why }));   // lo escuchan planes.js y analytics.js
  }

  function probeGpu() {
    let low = null;
    try { if (localStorage.getItem('gotia-gpu')) return; } catch (e) {}   // ya se miró
    try {
      const gl = document.createElement('canvas').getContext('webgl', { failIfMajorPerformanceCaveat: true });
      if (!gl) low = true;
      else {
        // Firefox da el nombre del chip directamente; Chrome y Safari, con la extensión
        let gpu = String(gl.getParameter(gl.RENDERER));
        const info = /WebKit/.test(gpu) && gl.getExtension('WEBGL_debug_renderer_info');
        if (info) gpu = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
        low = LOW_GPU.test(gpu);
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    } catch (e) { return; }
    try { localStorage.setItem('gotia-gpu', low ? 'bajo' : 'ok'); } catch (e) {}
    if (low) toLow('gráficos');
  }

  function watchFlow() {
    let until = 0, last = 0, raf = 0, frames = [], slow = 0;
    const tick = (now) => {
      raf = 0;
      if (isLow()) return;
      // un hueco de más de medio segundo es el navegador frenando la página (oculta, otra ventana), no el equipo
      if (last && !document.hidden && now - last < 500) frames.push(now - last);
      last = now;
      if (frames.length >= 90) {
        frames.sort((a, b) => a - b);
        const median = frames[45], long = frames.filter((t) => t > 50).length / frames.length;
        frames = [];
        slow = median > 36 || long > 0.2 ? slow + (median > 60 ? 2 : 1) : 0;
        if (slow >= 2) {
          try { localStorage.setItem('gotia-lento', String(Date.now())); } catch (e) {}
          toLow('iba lento');
          return;
        }
      }
      if (now < until) raf = requestAnimationFrame(tick);
      else last = 0;   // la pausa entre un desplazamiento y otro no es un cuadro lento
    };
    // solo cuenta mientras la página se mueve: quieta, cualquier equipo va fluido
    const poke = () => {
      if (isLow()) return;
      until = performance.now() + 250;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    ['scroll', 'wheel', 'touchmove'].forEach((t) => addEventListener(t, poke, { passive: true }));
  }

  start(isLite() || isLow() ? 'esencial' : '3d');
  if (!gotia.chosen && !isLow()) {
    const later = () => setTimeout(() => { probeGpu(); if (!isLow()) watchFlow(); }, 1000);
    if (document.readyState === 'complete') later();
    else addEventListener('load', later, { once: true });
  }
})();
