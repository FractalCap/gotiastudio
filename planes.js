/* =========================================================
   Gotiastudio — Planes: presentación por pantallas
   Cada .slide ocupa la ventana y el scroll se ajusta a la siguiente
   (scroll-snap, en planes.css). Aquí:
     · puntos a la derecha (uno por pantalla) y barra de progreso arriba
     · el botón flotante de WhatsApp (entre la portada y el cierre)
     · un punto de ajuste extra al final de una pantalla que no quepa
       (celulares pequeños), para poder leerla entera
   ========================================================= */
(() => {
  const slides = [...document.querySelectorAll('.slide')];
  if (!slides.length) return;
  const n = slides.length;
  const wa = document.querySelector('.wa-float');
  const bar = document.querySelector('.progress');

  // puntos: uno por pantalla, con su nombre al pasar el cursor
  const nav = document.createElement('nav');
  nav.className = 'dots';
  nav.setAttribute('aria-label', 'Pantallas');
  const dots = slides.map((s) => {
    const a = document.createElement('a');
    a.href = '#' + s.id;
    a.dataset.label = s.dataset.title || '';
    a.setAttribute('aria-label', s.dataset.title || s.id);
    nav.appendChild(a);
    return a;
  });
  document.body.appendChild(nav);

  // punto de ajuste al final de cada pantalla (solo se activa si no cabe)
  slides.forEach((s) => {
    const end = document.createElement('i');
    end.className = 'snap-end';
    end.setAttribute('aria-hidden', 'true');
    s.appendChild(end);
  });
  const measure = () => slides.forEach((s) => s.classList.toggle('is-tall', s.offsetHeight > innerHeight + 4));

  let current = -1;
  const update = () => {
    // pantalla actual: la última cuyo borde superior ya pasó la mitad de la ventana
    const mid = innerHeight * 0.5;
    let idx = 0;
    for (let i = 0; i < n; i++) {
      if (slides[i].getBoundingClientRect().top <= mid) idx = i;
      else break;
    }
    if (idx !== current) {
      current = idx;
      dots.forEach((d, i) => {
        d.classList.toggle('on', i === idx);
        if (i === idx) d.setAttribute('aria-current', 'step');
        else d.removeAttribute('aria-current');
      });
      if (wa) wa.classList.toggle('show', idx > 0 && idx < n - 1);
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
  measure();
  update();
  // cuando llegan las fuentes las alturas pueden cambiar
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); update(); });
})();

/* ---------- Ejemplos de los planes: recorridos animados por todo lo que incluye cada uno ----------
   Cada ejemplo (.mock-page[data-demo]) tiene pestañas (.mx-tabs) y escenas (.mx-scene). Mientras
   se ve, cada escena sigue sus pasos y pasa a la siguiente, en bucle; la línea bajo el menú marca
   el tiempo de la escena. Las pestañas saltan a cada escena. Con movimiento reducido y en la
   versión Lite (html.lowend), cada escena se ve ya terminada y no cambia sola; si la web pasa a
   Lite con un recorrido en marcha (main.js, evento gotia:lowend), la escena se completa ahí.
   Los pasos van en data-steps, separados por ";": "espera acción [objetivo] [ms]"
     +clase / -clase   añade o quita a la escena un estado (.s-1, .s-pin…), que el CSS anima
     type sel [ms]     escribe en sel su data-q, letra a letra (antes muestra data-start o nada)
     count sel [ms]    sube el número de sel de data-from a data-to, sin esperar (data-pre: "$")
     each sel [ms]     enciende (.on) cada sel, uno tras otro
     end               solo espera, lo que queda de la escena */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const still = () => reduce || document.documentElement.classList.contains('lowend');
  const fmt = (v) => Math.round(v).toLocaleString('es-CO');
  const setNum = (el, v) => { el.textContent = (el.dataset.pre || '') + fmt(v); };

  document.querySelectorAll('[data-demo]').forEach((demo) => {
    const tabs = [...demo.querySelectorAll('.mx-tabs button')];
    const scenes = [...demo.querySelectorAll('.mx-scene')];
    const prog = demo.querySelector('.mx-prog');
    const plans = scenes.map((s) => (s.dataset.steps || '').split(';').map((x) => x.trim()).filter(Boolean).map((x) => {
      const [ms, act, sel, arg] = x.split(/\s+/);
      return { ms: Number(ms) || 0, act, sel, arg: Number(arg) || 0 };
    }));
    const all = (s, sel) => (sel ? [...s.querySelectorAll(sel)] : []);
    // duración aproximada de cada escena, para la línea de tiempo
    const lens = plans.map((p, i) => p.reduce((t, st) => {
      const els = all(scenes[i], st.sel);
      if (st.act === 'type') return t + st.ms + els.reduce((n, el) => n + (el.dataset.q || '').length * (st.arg || 55), 0);
      if (st.act === 'each') return t + st.ms + els.length * (st.arg || 300);
      return t + st.ms;
    }, 0));
    let run = 0, at = 0, visible = false;

    // espera que se corta si el recorrido cambió (otra pestaña, el ejemplo dejó de verse)
    const wait = (ms, id) => new Promise((ok) => setTimeout(() => ok(id === run), ms));
    const count = (el, ms, id) => {
      const from = Number(el.dataset.from) || 0, to = Number(el.dataset.to) || 0, t0 = performance.now();
      const step = () => {
        if (id !== run) return;
        const k = Math.min(1, (performance.now() - t0) / ms);
        setNum(el, from + (to - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) setTimeout(step, 30);
      };
      step();
    };

    // deja la escena en su punto de partida, o ya terminada (done)
    const reset = (i, done) => {
      const s = scenes[i];
      [...s.classList].filter((c) => c.startsWith('s-')).forEach((c) => s.classList.remove(c));
      plans[i].forEach((st) => {
        const els = all(s, st.sel);
        if (st.act === 'type') els.forEach((el) => { el.textContent = done ? el.dataset.q : (el.dataset.start || ''); });
        else if (st.act === 'count') els.forEach((el) => setNum(el, Number(done ? el.dataset.to : el.dataset.from) || 0));
        else if (st.act === 'each') els.forEach((el) => el.classList.toggle('on', !!done));
        else if (done && st.act[0] === '+') s.classList.add(st.act.slice(1));
        else if (done && st.act[0] === '-') s.classList.remove(st.act.slice(1));
      });
    };
    const show = (i) => {
      at = i;
      scenes.forEach((s, j) => s.classList.toggle('is-on', j === i));
      tabs.forEach((t, j) => t.classList.toggle('on', j === i));
    };
    const timeLine = (ms) => {
      if (!prog) return;
      prog.style.transition = 'none';
      prog.style.width = '0';
      void prog.offsetWidth;
      prog.style.transition = `width ${ms}ms linear`;
      prog.style.width = '100%';
    };

    async function play(i, id) {
      const s = scenes[i];
      for (const st of plans[i]) {
        if (!(await wait(st.ms, id))) return false;
        const els = all(s, st.sel);
        if (st.act[0] === '+') s.classList.add(st.act.slice(1));
        else if (st.act[0] === '-') s.classList.remove(st.act.slice(1));
        else if (st.act === 'type') {
          for (const el of els) {
            const t = el.dataset.q || '';
            el.textContent = '';
            for (let k = 1; k <= t.length; k++) {
              el.textContent = t.slice(0, k);
              if (!(await wait(st.arg || 55, id))) return false;
            }
          }
        } else if (st.act === 'count') els.forEach((el) => count(el, st.arg || 1200, id));
        else if (st.act === 'each') {
          for (const el of els) {
            el.classList.add('on');
            if (!(await wait(st.arg || 300, id))) return false;
          }
        }
      }
      return true;
    }

    // el recorrido: desde la escena i, una tras otra y vuelta a empezar
    async function tour(i) {
      const id = ++run;
      while (id === run) {
        reset(i);
        show(i);
        timeLine(lens[i]);
        if (!(await play(i, id))) return;
        i = (i + 1) % scenes.length;
      }
    }
    const stop = () => { run++; if (prog) prog.style.transition = 'none'; };

    // tocar una pestaña lleva a esa escena (y el recorrido sigue desde ahí)
    tabs.forEach((t, i) => t.addEventListener('click', () => {
      if (still()) { reset(i, true); show(i); return; }
      tour(i);
    }));

    // antes de verse (y con movimiento reducido): la primera escena, ya terminada
    reset(0, true);
    show(0);
    if (still()) return;
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting === visible) return;
      visible = e.isIntersecting;
      if (visible && !still()) tour(at);
      else stop();
    }, { threshold: 0.35 }).observe(demo);
    document.addEventListener('gotia:lowend', () => { stop(); reset(at, true); });
  });
})();

