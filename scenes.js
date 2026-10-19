/* =========================================================
   Gotiastudio — Escenas al hacer scroll
   La "G" de cristal y sus burbujas viven en un escenario fijo detrás de la
   página. En el hero rodean la "G"; al bajar, sección a sección, la "G"
   cambia de sitio, tamaño, giro y brillo, y las burbujas viajan en remolino
   hasta formar una figura nueva:
     Manifiesto  → anillo 3D que gira mientras lees
     Servicios   → suben entre las tarjetas de cristal
     Automatización → la "G" pasa a la izquierda y las burbujas suben a la derecha
     Ecosistema  → órbita alrededor de "Tu web"
     Panel       → recorren el marco de la ventana
     Datos       → una línea de tendencia que crece
     Proceso     → cuentas sobre la línea, que se llenan al avanzar
     Packs       → anillo 3D detrás de los packs
     Preguntas   → suben junto a la lista
     Contacto    → vuelven a rodear la "G"
     Footer      → suben y se despiden
   · La "G" se inclina y ondula con la velocidad del scroll (bubbles.js).
   · Las burbujas se apartan del cursor (en el celular, del dedo), su borde se
     enciende al acercarse y se estiran un poco con el scroll rápido.
   En el celular se ve igual que en el computador: las mismas burbujas y efectos.
   Con "reducir movimiento" todo se queda en el hero, como antes.
   ========================================================= */
(() => {
  const stage = document.querySelector('.stage');
  const layer = stage && stage.querySelector('.stage-bubbles');
  const hero = document.querySelector('.hero');
  if (!layer || !hero) return;
  const gotia = (window.gotia = window.gotia || {});
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const damp = (k, dt) => 1 - Math.exp(-k * dt);   // suavizado igual a cualquier fps
  const opt = (o, key, d) => (o && key in o ? o[key] : d);

  // aleatorio con semilla: la composición es la misma en cada visita
  let seed = 11;
  const rnd = (a = 0, b = 1) => {
    seed = (seed * 16807) % 2147483647;
    return a + (b - a) * ((seed - 1) / 2147483646);
  };

  // ---- Las burbujas (su composición en el hero) ----
  // Alrededor de la "G": [x, y, tamaño, profundidad], en unidades del lado mayor
  // de la "G" y desde su centro. Profundidad: 0 = lejos (desenfocada), 1 = cerca.
  const AROUND_G = [
    [ 0.45, -0.47, 0.190, 0.95],   // la protagonista, arriba a la derecha
    [ 0.53,  0.41, 0.110, 0.75],
    [-0.46,  0.51, 0.090, 0.60],
    [-0.36, -0.56, 0.055, 0.50],
    [ 0.26, -0.61, 0.045, 0.40],
    [-0.01,  0.61, 0.040, 0.65],
    [-0.26,  0.73, 0.025, 0.35],
    [ 0.58, -0.18, 0.020, 0.45]
  ];
  // En el resto del hero: x e y en fracción del hero; tamaño en fracción de su lado menor.
  // Las tres primeras son grandes, lejanas y desenfocadas (bokeh)
  const FREE = [
    [0.985, 0.04, 0.240, 0.05],
    [0.03,  0.97, 0.200, 0.08],
    [0.02,  0.10, 0.100, 0.10],
    [0.47,  0.11, 0.020, 0.50],
    [0.53,  0.66, 0.012, 0.35],
    [0.80,  0.80, 0.026, 0.55]
  ];
  const defs = [
    ...AROUND_G.map((d) => ({ d, g: true })),
    ...FREE.map((d) => ({ d, g: false }))
  ];

  const bubbles = defs.map(({ d, g }) => {
    const el = document.createElement('span');
    const depth = d[3];
    el.className = 'lb hb';
    // cuanto más lejos, más desenfocada
    const blur = (0.35 - depth) * 8;
    if (blur > 0.5) el.style.filter = `blur(${blur.toFixed(2)}px)`;
    // flotación propia de cada una (las cercanas se mueven más)
    el.style.setProperty('--d', rnd(7, 12).toFixed(2) + 's');
    el.style.setProperty('--dd', (-rnd(0, 12)).toFixed(2) + 's');
    el.style.setProperty('--dx', rnd(-10, 10).toFixed(1) + 'px');
    el.style.setProperty('--dy', (-(10 + 18 * depth) * rnd(0.7, 1.2)).toFixed(1) + 'px');
    // la película iridiscente arranca en otro ángulo y algunas giran al revés
    el.style.setProperty('--id', (-rnd(0, 16)).toFixed(2) + 's');
    if (rnd() < 0.4) el.style.setProperty('--idir', 'reverse');
    layer.appendChild(el);
    return {
      el, def: d, g, depth, bokeh: depth < 0.15,
      op0: 0.45 + 0.55 * Math.min(1, depth / 0.5),   // cuanto más lejos, más tenue
      rank: 0, j: 0, base: 0, heroSize: 0,
      x: 0, y: 0, size: 0, op: 0,                      // estado suavizado
      ox: 0, oy: 0, vx: 0, vy: 0, hl: 0,               // empujón del cursor y brillo del borde
      tr: '', opShown: -1, hlShown: -1,
      // azar propio: sitio en las figuras dispersas, salida, remolino y rapidez
      rx: rnd(), ry: rnd(), rz: rnd(), stagger: rnd(), swirl: rnd(-1, 1), resp: rnd(6, 10)
    };
  });
  // las de cristal se ordenan por tamaño (rango 0 = la mayor); las desenfocadas van aparte
  const glass = bubbles
    .filter((b) => !b.bokeh)
    .sort((a, b) => (b.g ? b.def[2] * 0.5 : b.def[2]) - (a.g ? a.def[2] * 0.5 : a.def[2]));
  glass.forEach((b, i) => { b.rank = i; });
  bubbles.filter((b) => b.bokeh).forEach((b, i) => { b.j = i; });

  // Microburbujas: suben desde la parte baja de la "G" y la siguen a donde vaya
  const FIZZ_REF = 400;   // se colocan a esta escala y el contenedor sigue el tamaño de la "G"
  const fizz = document.createElement('div');
  const fizzMove = document.createElement('div');
  fizz.className = 'hb-fizz';
  fizzMove.className = 'hb-fizz-move';
  fizz.appendChild(fizzMove);
  layer.appendChild(fizz);
  for (let i = 0; i < 10; i++) {
    const wrap = document.createElement('span');
    const b = document.createElement('span');
    const dur = rnd(7.5, 12.5);
    wrap.className = 'hb-rise';
    wrap.style.left = (rnd(-0.34, 0.34) * FIZZ_REF).toFixed(1) + 'px';
    wrap.style.top = (rnd(0.12, 0.38) * FIZZ_REF).toFixed(1) + 'px';
    wrap.style.setProperty('--rise', (-rnd(0.75, 1.15) * FIZZ_REF).toFixed(1) + 'px');
    wrap.style.setProperty('--d', dur.toFixed(2) + 's');
    wrap.style.setProperty('--dl', (-rnd(0, dur)).toFixed(2) + 's');
    wrap.style.setProperty('--o', rnd(0.55, 0.9).toFixed(2));
    b.className = 'lb';
    b.style.setProperty('--s', rnd(4, 10).toFixed(1) + 'px');
    b.style.setProperty('--w', rnd(3, 9).toFixed(1) + 'px');
    b.style.setProperty('--sw', rnd(2.2, 3.8).toFixed(2) + 's');
    b.style.setProperty('--sd', (-rnd(0, 3.8)).toFixed(2) + 's');
    wrap.appendChild(b);
    fizzMove.appendChild(wrap);
  }

  // ---- Escenas, en el orden de la página ----
  // g: la "G". x, y en fracción de la pantalla; s = tamaño en fracción de su lado menor;
  //    yaw / pitch / roll en radianes ([desde, hasta] = gira mientras recorres la sección);
  //    dim = brillo (bajo cuando queda detrás de texto).
  // b: la figura de las burbujas (ver FORMS) y o, sus ajustes; anchor: el elemento que siguen.
  // k: dónde van las burbujas desenfocadas (fracción de la pantalla).
  const SCENES = [
    { el: '#top', g: 'hero', b: 'cluster', k: 'hero' },
    { el: '#estudio', g: { x: 0.5, y: 0.52, s: 0.92, yaw: [-0.55, 0.55], roll: 0.06, dim: 0.32 },
      b: 'ring', o: { rx: 0.42, ry: 0.3, turn: 0.5 }, k: [[0.05, 0.2], [0.95, 0.82], [0.88, 0.08]] },
    { el: '#servicios', g: { x: 0.93, y: 0.5, s: 0.64, yaw: -0.8, pitch: 0.12, dim: 0.55 },
      b: 'rise', k: [[0.02, 0.55], [0.62, 0.04], [0.38, 0.97]] },
    { el: '#automatizacion', g: { x: 0.08, y: 0.22, s: 0.46, yaw: [0.6, -0.2], roll: -0.2, dim: 0.5 },
      b: 'rise', o: { x0: 0.5, x1: 0.97 }, k: [[0.96, 0.9], [0.04, 0.96], [0.7, 0.05]] },
    { el: '#ecosistema', g: { x: 0.07, y: 0.86, s: 0.46, roll: 0.45, dim: 0.45 },
      b: 'orbit', anchor: '#orbit', k: [[0.97, 0.1], [0.04, 0.1], [0.62, 0.97]] },
    { el: '#panel', g: { x: 0.96, y: 0.66, s: 0.42, yaw: 0.7, dim: 0.55 },
      b: 'frame', anchor: '.window', k: [[0.03, 0.3], [0.97, 0.12], [0.5, 0.02]] },
    { el: '#datos', g: { x: 0.06, y: 0.68, s: 0.5, yaw: -0.45, dim: 0.5 },
      b: 'trend', k: [[0.96, 0.06], [0.04, 0.95], [0.55, 0.5]] },
    { el: '#proceso', g: { x: 0.5, y: 0.92, s: 0.34, pitch: 0.6, dim: 0.6 },
      b: 'line', anchor: '#steps', k: [[0.04, 0.15], [0.96, 0.22], [0.5, 0.98]] },
    { el: '#packs', g: { x: 0.5, y: 0.5, s: 0.9, yaw: [0.45, -0.45], dim: 0.3 },
      b: 'ring', o: { rx: 0.46, ry: 0.36, turn: -0.45 }, k: [[0.03, 0.86], [0.97, 0.14], [0.1, 0.04]] },
    { el: '#faq', g: { x: 0.17, y: 0.87, s: 0.44, roll: -0.35, dim: 0.6 },
      b: 'rise', o: { x0: 0.52, x1: 0.97 }, k: [[0.97, 0.3], [0.05, 0.1], [0.55, 0.97]] },
    { el: '#contacto', g: { x: 0.86, y: 0.24, s: 0.52, yaw: -0.2, dim: 0.9 },
      b: 'cluster', k: [[0.03, 0.9], [0.97, 0.96], [0.04, 0.07]] },
    { el: '.footer', g: { x: 0.5, y: 0.78, s: 0.5, dim: 0.5 },
      b: 'rise', o: { x0: 0.06, x1: 0.94 }, k: [[0.03, 0.64], [0.95, 0.22], [0.5, 0.04]] }
  ]
    .slice(0, reduce ? 1 : undefined)
    .map((sc) => ({ ...sc, node: document.querySelector(sc.el), anchorNode: sc.anchor ? document.querySelector(sc.anchor) : null }))
    .filter((sc) => sc.node);

  // ---- Figuras: cada una da [x, y, tamaño, opacidad] para una burbuja de cristal ----
  const RING = [0.085, 0.074, 0.065, 0.058, 0.052, 0.047, 0.042, 0.037, 0.033, 0.029, 0.026];
  const FORMS = {
    // la composición del hero alrededor de la "G" (también en Contacto)
    cluster(b, c) {
      if (b.g) return [c.G.x + b.def[0] * c.G.S, c.G.y + b.def[1] * c.G.S, b.def[2] * c.G.S, b.op0];
      const R = c.hero ? c.heroR : c.view;
      return [R.left + b.def[0] * R.width, R.top + b.def[1] * R.height, b.def[2] * Math.min(R.width, R.height), b.op0];
    },
    // anillo en 3D alrededor del centro: las de delante, más grandes y brillantes; gira al avanzar
    ring(b, c, o) {
      const a = 0.35 + (b.rank / c.n) * TAU + opt(o, 'turn', 0.5) * TAU * c.p;
      const z = Math.sin(a), near = (z + 1) / 2;
      return [
        c.vw * 0.5 + Math.cos(a) * c.vw * opt(o, 'rx', 0.42),
        c.vh * 0.52 + z * c.vh * opt(o, 'ry', 0.3),
        c.m * RING[b.rank % RING.length] * (0.65 + 0.5 * near),
        0.45 + 0.55 * near
      ];
    },
    // órbita plana alrededor de otro elemento (el ecosistema), al revés que sus anillos
    orbit(b, c) {
      const r = c.anchor;
      if (!r || !r.width) return FORMS.ring(b, c, {});
      const R = r.width * 0.58, a = -0.6 + (b.rank / c.n) * TAU - c.p * Math.PI;
      return [r.left + r.width / 2 + Math.cos(a) * R, r.top + r.height / 2 + Math.sin(a) * R, c.m * (b.rank < 2 ? 0.05 : 0.03), 0.95];
    },
    // recorren el borde de un elemento (la ventana del panel)
    frame(b, c) {
      const r = c.anchor;
      if (!r || !r.width) return FORMS.rise(b, c, {});
      const pad = 24, L = r.left - pad, T = r.top - pad, W = r.width + pad * 2, H = r.height + pad * 2;
      let u = (((b.rank + 0.5) / c.n + c.p * 0.3) % 1) * 2 * (W + H);
      let x, y;
      if (u < W) { x = L + u; y = T; }
      else if ((u -= W) < H) { x = L + W; y = T + u; }
      else if ((u -= H) < W) { x = L + W - u; y = T + H; }
      else { x = L; y = T + H - (u - W); }
      return [x, y, c.m * (b.rank % 3 === 0 ? 0.05 : 0.028), 0.95];
    },
    // una línea de tendencia que sube: las más grandes, arriba a la derecha
    trend(b, c) {
      const t = (c.n - 1 - b.rank + 0.5) / c.n;
      return [
        c.vw * mix(0.07, 0.93, t),
        c.vh * (mix(0.86, 0.18, Math.pow(t, 1.3)) + 0.025 * Math.sin(t * 10 + c.p * 7)),
        c.m * (0.018 + 0.07 * t * t),
        0.92
      ];
    },
    // cuentas sobre la línea del proceso: se llenan como una barra de progreso al avanzar
    line(b, c) {
      const r = c.anchor;
      const k = (b.rank + 0.5) / c.n;
      const on = k < c.p * 1.6 - 0.3;
      let x, y;
      if (r && r.width > 860) {
        x = mix(r.left + 34, r.right - r.width * 0.12, k);
        y = r.top + 34 + Math.sin(b.rank * 1.3 + c.p * 8) * 6;
      } else {
        // en pantallas estrechas no hay línea: la dibujan ellas junto al borde
        x = c.vw * 0.06;
        y = c.vh * mix(0.18, 0.9, k);
      }
      return [x, y, c.m * (on ? 0.04 : 0.02), on ? 1 : 0.55];
    },
    // dispersas, suben despacio mientras recorres la sección
    rise(b, c, o) {
      return [
        c.vw * mix(opt(o, 'x0', 0.04), opt(o, 'x1', 0.96), b.rx),
        c.vh * (0.15 + b.ry) - c.p * c.vh * (0.35 + 0.4 * b.rz),
        c.m * (0.016 + 0.04 * b.rz),
        0.85
      ];
    }
  };

  // las desenfocadas no forman figuras: cambian de esquina en cada escena
  function bokehAt(b, c, sc) {
    if (sc.k === 'hero') {
      const R = c.heroR;
      return [R.left + b.def[0] * R.width, R.top + b.def[1] * R.height, b.heroSize, b.op0];
    }
    const k = sc.k[b.j % sc.k.length];
    return [k[0] * c.vw, k[1] * c.vh, b.heroSize, b.op0];
  }
  const target = (b, sc, c) => (b.bokeh ? bokehAt(b, c, sc) : FORMS[sc.b](b, c, sc.o));

  // ---- La "G" en cada escena ----
  const val = (v, p) => (Array.isArray(v) ? mix(v[0], v[1], p) : v || 0);
  let heroBox = null;   // la "G" del hero, relativa a él (la calcula bubbles.js)
  function scenePose(sc, c) {
    if (sc.g === 'hero') {
      const hb = heroBox || { x: c.heroR.width * 0.72, y: c.heroR.height * 0.45, S: c.m * 0.55 };
      // baja con el hero, pero más despacio que el texto: se nota la profundidad
      return {
        x: c.heroR.left + hb.x, y: c.heroR.top * (reduce ? 1 : 0.45) + hb.y, S: hb.S,
        yaw: 0, pitch: 0, roll: 0,
        dim: reduce ? clamp(c.heroR.bottom / (c.vh * 0.6), 0, 1) : 1
      };
    }
    const g = sc.g, portrait = c.vw < c.vh;
    let x = g.x;
    // en vertical se aparta más hacia el borde y brilla menos: el texto ocupa casi todo el ancho
    if (portrait && x !== 0.5) x += x < 0.5 ? -0.06 : 0.06;
    return {
      x: x * c.vw, y: g.y * c.vh, S: g.s * c.m,
      yaw: val(g.yaw, c.p), pitch: val(g.pitch, c.p), roll: val(g.roll, c.p), dim: g.dim * (portrait ? 0.8 : 1)
    };
  }
  const KEYS = ['x', 'y', 'S', 'yaw', 'pitch', 'roll', 'dim'];
  function blendPose(a, b, w, i) {
    // a mitad de camino se aleja un poco y da medio giro: el paso entre secciones se nota
    const mid = Math.sin(Math.PI * w);
    const out = {};
    for (const key of KEYS) out[key] = mix(a[key], b[key], w);
    out.S *= 1 - 0.12 * mid;
    out.yaw += mid * 0.7 * (i % 2 ? -1 : 1);
    return out;
  }

  const view = { left: 0, top: 0, width: 1, height: 1 };
  function ctxFor(sc, r, heroR, vw, vh) {
    const c = {
      vw, vh, m: Math.min(vw, vh), n: glass.length, view, heroR, hero: sc.g === 'hero',
      // avance por la sección: 0 cuando asoma por abajo, 1 cuando se va por arriba
      p: clamp((vh - r.top) / (r.height + vh), 0, 1),
      anchor: sc.anchorNode ? sc.anchorNode.getBoundingClientRect() : null
    };
    c.G = scenePose(sc, c);
    return c;
  }

  // ---- Medidas: tamaños base y entrada (con la ventana, las fuentes o el contenido) ----
  let entered = false;
  function measure() {
    heroBox = gotia.heroBox ? gotia.heroBox() : null;
    const vw = innerWidth, vh = innerHeight, m = Math.min(vw, vh);
    const hr = hero.getBoundingClientRect();
    const GS = heroBox ? heroBox.S : m * 0.55;
    const n = glass.length;
    for (const b of bubbles) {
      b.heroSize = b.def[2] * (b.g ? GS : Math.min(hr.width, hr.height));
      // su tamaño mayor en cualquier escena fija su resolución: al escalar solo baja, nunca se ve borrosa
      let max = b.heroSize;
      if (!b.bokeh) {
        const t = (n - 1 - b.rank + 0.5) / n;
        max = Math.max(max,
          m * RING[b.rank % RING.length] * 1.15,      // anillo (las de delante)
          m * 0.05,                                   // órbita y marco
          m * (0.018 + 0.07 * t * t),                 // tendencia
          m * 0.056,                                  // dispersas
          b.def[2] * (b.g ? 0.52 * m : m)             // contacto
        );
      }
      const base = Math.round(clamp(max, 6, 260));
      if (Math.abs(base - b.base) > 1) {
        b.base = base;
        b.el.style.setProperty('--s', base + 'px');
        b.tr = '';
      }
    }
    // entrada en onda: primero las más cercanas a la "G" (solo la primera vez)
    if (!entered) {
      entered = true;
      const c0 = ctxFor(SCENES[0], hr, hr, vw, vh);
      for (const b of bubbles) {
        const t = target(b, SCENES[0], c0);
        const k = clamp(Math.hypot(t[0] - c0.G.x, t[1] - c0.G.y) / (c0.G.S * 1.4), 0, 1);
        b.el.style.setProperty('--in', (0.3 + 0.95 * k * k + rnd(0, 0.08)).toFixed(2) + 's');
      }
    }
  }

  // ---- Cada frame: escena actual, pose de la "G" y burbujas ----
  const P = { x: 0, y: 0, S: 1, yaw: 0, pitch: 0, roll: 0, dim: 1, vel: 0 };   // pose actual de la "G" (suavizada)
  const ptr = { x: -1e4, y: -1e4, on: false };
  const par = { x: 0, y: 0 };   // parallax con el cursor, suavizado (-1 a 1)
  let lastNow = -1, lastT = 0, lastScroll = 0, vel = 0, primed = false, fizzTr = '', fizzOp = '';

  function update(now) {
    if (now === lastNow) return P;   // bubbles.js y este bucle lo piden en el mismo frame
    const dt = primed ? clamp((now - lastT) / 1000, 0.001, 0.05) : 0;
    lastNow = now;
    lastT = now;
    const vw = innerWidth, vh = innerHeight;
    view.width = vw;
    view.height = vh;

    // velocidad del scroll (px/s), suavizada; se apaga sola al parar
    const sy = scrollY;
    if (dt) vel = mix(vel, reduce ? 0 : (sy - lastScroll) / dt, damp(8, dt));
    lastScroll = sy;

    // (primero se lee todo, luego se escribe)
    const rects = SCENES.map((sc) => sc.node.getBoundingClientRect());
    const heroR = rects[0];
    // f = última escena ya completa; w = avance hacia la siguiente (0 a 1)
    let f = 0, w = 0;
    for (let i = 1; i < SCENES.length; i++) {
      const t = smooth(clamp((vh * 0.92 - rects[i].top) / (vh * 0.62), 0, 1));
      if (t >= 1) { f = i; continue; }
      w = t;
      break;
    }
    const A = SCENES[f], cA = ctxFor(A, rects[f], heroR, vw, vh);
    const B = w > 0 ? SCENES[f + 1] : null;
    const cB = B ? ctxFor(B, rects[f + 1], heroR, vw, vh) : null;

    // la "G": de una escena a otra, con inercia
    const T = B ? blendPose(cA.G, cB.G, w, f) : cA.G;
    const kp = primed ? damp(6.5, dt) : 1;
    for (const key of KEYS) P[key] += (T[key] - P[key]) * kp;
    P.vel = vel;

    // cursor o dedo: parallax suave y el empujón a las burbujas cercanas
    const inside = ptr.on;
    const tx = inside ? clamp((ptr.x / vw) * 2 - 1, -1, 1) : 0;
    const ty = inside ? clamp((ptr.y / vh) * 2 - 1, -1, 1) : 0;
    if (dt) {
      const k = damp(3, dt);
      par.x += (tx - par.x) * k;
      par.y += (ty - par.y) * k;
    }
    // con el scroll rápido se estiran un poco, como burbujas de verdad
    const stretch = clamp(Math.abs(vel) / 4000, 0, 0.14);

    for (const b of bubbles) {
      let t = target(b, A, cA);
      if (B) {
        const tb = target(b, B, cB);
        // cada una sale a su tiempo y viaja en arco: un remolino, no una fila
        const e = smooth(clamp((w - b.stagger * 0.35) / 0.65, 0, 1));
        const dx = tb[0] - t[0], dy = tb[1] - t[1], len = Math.hypot(dx, dy) || 1;
        const arc = Math.sin(Math.PI * e) * Math.min(len * 0.35, 240) * b.swirl;
        t = [mix(t[0], tb[0], e) - (dy / len) * arc, mix(t[1], tb[1], e) + (dx / len) * arc, mix(t[2], tb[2], e), mix(t[3], tb[3], e)];
      }
      if (!primed) {
        b.x = t[0]; b.y = t[1]; b.size = t[2]; b.op = t[3];
      } else {
        const k = damp(b.resp, dt);
        b.x += (t[0] - b.x) * k;
        b.y += (t[1] - b.y) * k;
        b.size += (t[2] - b.size) * k;
        b.op += (t[3] - b.op) * k;
      }

      // el cursor las aparta con un muelle suave y les enciende el borde
      if (dt) {
        let fx = 0, fy = 0, near = 0;
        if (inside && !b.bokeh) {
          const dx = b.x + b.ox - ptr.x, dy = b.y + b.oy - ptr.y;
          const R = b.size * 0.5 + 120, d = Math.hypot(dx, dy) || 1;
          if (d < R) {
            near = 1 - d / R;
            const force = near * near * 2400 * (0.35 + b.depth);
            fx = (dx / d) * force;
            fy = (dy / d) * force;
          }
        }
        b.vx += (fx - 36 * b.ox - 10 * b.vx) * dt;
        b.vy += (fy - 36 * b.oy - 10 * b.vy) * dt;
        b.ox += b.vx * dt;
        b.oy += b.vy * dt;
        b.hl += (near - b.hl) * damp(7, dt);
      }

      // las cercanas se desplazan más con el cursor que las lejanas: se nota la profundidad
      const k = b.depth;
      const x = b.x + b.ox - par.x * (6 + 26 * k);
      const y = b.y + b.oy - par.y * (4 + 18 * k);
      const s = (b.size / b.base) * (1 + 0.07 * b.hl);
      const tr = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(s * (1 - stretch * 0.5)).toFixed(3)}, ${(s * (1 + stretch)).toFixed(3)})`;
      if (tr !== b.tr) { b.tr = tr; b.el.style.transform = tr; }
      const op = Math.round(b.op * 100) / 100;
      if (op !== b.opShown) { b.opShown = op; b.el.style.setProperty('--op', op); }
      const hl = Math.round(b.hl * 200) / 200;
      if (hl !== b.hlShown) { b.hlShown = hl; b.el.style.setProperty('--hl', hl); }
    }

    // las microburbujas siguen a la "G" y se apagan cuando ella se atenúa
    const ftr = `translate3d(${P.x.toFixed(1)}px, ${P.y.toFixed(1)}px, 0) scale(${(P.S / FIZZ_REF).toFixed(3)})`;
    if (ftr !== fizzTr) { fizzTr = ftr; fizzMove.style.transform = ftr; }
    const fop = clamp((P.dim - 0.2) / 0.5, 0, 1).toFixed(2);
    if (fop !== fizzOp) { fizzOp = fop; fizzMove.style.opacity = fop; }
    // sin WebGL, la imagen de la "G" sigue la misma pose
    if (gotia.placeFallback) gotia.placeFallback(P);

    primed = true;
    return P;
  }

  gotia.stage = { update };
  measure();
  update(performance.now());   // todo en su sitio desde el primer momento (sin animar)

  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    ptr.x = e.clientX;
    ptr.y = e.clientY;
    ptr.on = true;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { ptr.on = false; });
  // en el celular el dedo hace de cursor mientras toca la pantalla (también al desplazar)
  const onTouch = (e) => {
    const t = e.touches[0];
    if (!t) return;
    ptr.x = t.clientX;
    ptr.y = t.clientY;
    ptr.on = true;
  };
  addEventListener('touchstart', onTouch, { passive: true });
  addEventListener('touchmove', onTouch, { passive: true });
  const offTouch = (e) => { if (!e.touches.length) ptr.on = false; };
  addEventListener('touchend', offTouch, { passive: true });
  addEventListener('touchcancel', offTouch, { passive: true });

  let raf = 0;
  const loop = (now) => { raf = requestAnimationFrame(loop); update(now); };
  const start = () => { if (!raf && !document.hidden) raf = requestAnimationFrame(loop); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  start();

  // las medidas cambian con la ventana, las fuentes y al abrir o cerrar contenido (p. ej. comparar packs)
  let timer = 0;
  const remeasure = () => { clearTimeout(timer); timer = setTimeout(measure, 80); };
  new ResizeObserver(remeasure).observe(document.body);
  addEventListener('resize', remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  document.addEventListener('gotia:reveal', measure);
})();
