/* =========================================================
   Gotiastudio — "G" de cristal espectral (WebGL, sin dependencias)
   La "G" de la marca como cristal vivo: la superficie ondula suave
   (displacement), la luz la atraviesa y se separa en colores
   (refracción con dispersión), una película iridiscente la recorre y
   el rim light brilla en espectro (azul, violeta, magenta, naranja,
   dorado) sobre fondo negro. Reacciona al cursor: se inclina hacia él
   y se hincha bajo el puntero.
   Vive en un escenario fijo detrás de toda la página: en el hero está junto
   al texto y, al hacer scroll, scenes.js la lleva sección a sección a otro
   sitio (posición, tamaño, giro y brillo). Con la velocidad del scroll se
   inclina y ondula más, como un líquido.
   Aparece cuando la pantalla de carga le pasa el relevo (gotia:reveal).
   ========================================================= */
(() => {
  const canvas = document.getElementById('bubbles');
  const hero = document.querySelector('.hero');
  if (!canvas || !hero) return;
  const stage = canvas.parentElement;   // el escenario fijo (.stage)
  const root = document.documentElement;
  const gotia = (window.gotia = window.gotia || {});
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ---- Figura "G": dos trazos de cristal de grosor variable ----
  // Puntos de control de una B-spline cuadrática, en px de la imagen de
  // referencia (1295×1215): [x, y, radio]. El trazo pasa cerca, no por ellos.
  // Ajustados sobre la silueta de la referencia (~95 % de coincidencia), con los
  // radios suavizados para que el contorno no ondule.
  const G_STROKES = [
    // trazo grande en "C": cabeza arriba a la derecha → vuelta por la izquierda → gota inferior
    [[938, 224, 171], [804, 193, 182], [407, 378, 162], [275, 529, 166], [185, 736, 172], [474, 1015, 128], [681, 1050, 104]],
    // gancho: punta interior → lóbulo derecho → cola afilada
    [[608, 765, 38], [856, 685, 170], [1153, 613, 89], [1099, 847, 164], [918, 1113, 40]]
  ];
  const G_CENTER = [650, 600], G_PX = 560;   // centro de la figura y px por unidad local
  const REF_W = 1295, REF_H = 1215;          // tamaño de la imagen de referencia (g-glass.webp)

  // Un Bézier por tramo de la B-spline: [A, B, C, esfera envolvente] × tramo.
  // Va al shader como array de uniforms y se recorre en un bucle, así el
  // shader es corto y compila rápido en cualquier dispositivo.
  function figureSegments() {
    const loc = ([x, y, r]) => [(x - G_CENTER[0]) / G_PX, -(y - G_CENTER[1]) / G_PX, r / G_PX];
    const mid = (a, b) => a.map((v, i) => (v + b[i]) / 2);
    const out = [];
    for (const stroke of G_STROKES) {
      const Q = stroke.map(loc);
      const n = Q.length - 1;
      for (let i = 1; i < n; i++) {
        const A = i === 1 ? Q[0] : mid(Q[i - 1], Q[i]);
        const B = Q[i].slice();
        const C = i === n - 1 ? Q[n] : mid(Q[i], Q[i + 1]);
        // tramo recto: el Bézier degenera, lo curvamos un píxel
        if (Math.hypot(A[0] - 2 * B[0] + C[0], A[1] - 2 * B[1] + C[1]) < 1e-3) B[1] += 2e-3;
        const cx = (A[0] + B[0] + C[0]) / 3, cy = (A[1] + B[1] + C[1]) / 3;
        const R = Math.max(...[A, B, C].map((q) => Math.hypot(q[0] - cx, q[1] - cy))) +
                  Math.max(A[2], B[2], C[2]);
        out.push(...A, ...B, ...C, cx, cy, R);
      }
    }
    return new Float32Array(out);
  }
  const SEGS = figureSegments();
  const N_SEG = SEGS.length / 12;

  // caja de la figura en unidades locales, para encajarla en el hueco libre del hero
  const G_BOX = (() => {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < SEGS.length; i += 12) {
      for (let k = 0; k <= 16; k++) {
        const t = k / 16, w0 = (1 - t) * (1 - t), w1 = 2 * t * (1 - t), w2 = t * t;
        const x = w0 * SEGS[i] + w1 * SEGS[i + 3] + w2 * SEGS[i + 6];
        const y = w0 * SEGS[i + 1] + w1 * SEGS[i + 4] + w2 * SEGS[i + 7];
        const r = w0 * SEGS[i + 2] + w1 * SEGS[i + 5] + w2 * SEGS[i + 8];
        b[0] = Math.min(b[0], x - r); b[1] = Math.min(b[1], y - r);
        b[2] = Math.max(b[2], x + r); b[3] = Math.max(b[3], y + r);
      }
    }
    return { cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, w: b[2] - b[0], h: b[3] - b[1] };
  })();
  // radio de la esfera que envuelve la "G" (con margen para ondulación, hinchazón y halo)
  const G_BOUND = Math.hypot(G_BOX.w, G_BOX.h) / 2 + 0.45;
  // centro de esa caja en px de la imagen de referencia
  const REF_BOX = [G_CENTER[0] + G_BOX.cx * G_PX, G_CENTER[1] - G_BOX.cy * G_PX];

  // ---- Dónde va la "G": el hueco libre junto al texto del hero ----
  // la barra visible (el <header> también contiene el menú móvil oculto, que es más alto)
  const nav = document.querySelector('#nav .nav-inner') || document.getElementById('nav');
  const stats = hero.querySelector('.hero-services');
  const content = hero.querySelector('.hero-content');
  const heroText = hero.querySelectorAll('.hero-title, .hero-lead, .hero-actions, .hero-content .chip');
  const range = document.createRange();

  // borde derecho real del texto (líneas del titular, párrafo y botones)
  function textRight() {
    let right = 0;
    heroText.forEach((el) => {
      range.selectNodeContents(el);
      for (const rc of range.getClientRects()) right = Math.max(right, rc.right);
    });
    return right;
  }

  // caja de la "G" en el hero, relativa al hero: centro (x, y) en px CSS y px CSS por unidad local (k)
  function figureBox() {
    const r = hero.getBoundingClientRect();
    const cw = Math.max(1, r.width), ch = Math.max(1, r.height);
    const navBottom = nav ? nav.getBoundingClientRect().bottom - r.top : 0;
    let bx, by, bw, bh;
    if (cw / ch >= 1.05) {
      // escritorio: a la derecha del texto, sin pisarlo (mínimo 28 % del ancho)
      const right = cw * 0.96;
      bx = Math.min(textRight() - r.left + cw * 0.02, right - cw * 0.28);
      bw = right - bx;
      by = Math.max(navBottom + 16, ch * 0.1);
      bh = (stats ? stats.getBoundingClientRect().top - r.top : ch) - 24 - by;
    } else {
      // móvil: entre la barra de navegación y el texto
      const first = content && content.firstElementChild;
      by = navBottom + 16;
      bh = (first ? first.getBoundingClientRect().top - r.top : ch * 0.45) - 16 - by;
      bw = cw * 0.8;
      bx = (cw - bw) / 2;
    }
    const k = Math.max(0.016 * ch, Math.min(bw / G_BOX.w, bh / G_BOX.h) * 0.9);
    return { r, cw, ch, x: bx + bw / 2, y: by + bh / 2, k };
  }

  // ---- Pose de la "G": dónde está, de qué tamaño, cómo gira y cuánto brilla ----
  // S = lado mayor de su caja en px; x, y = centro de esa caja en px de la pantalla
  const G_MAX = Math.max(G_BOX.w, G_BOX.h);
  // la "G" del hero, relativa al hero (scenes.js la sigue mientras el hero está en pantalla)
  gotia.heroBox = () => {
    const b = figureBox();
    return { x: b.x, y: b.y, S: b.k * G_MAX };
  };
  function pose(now) {
    if (gotia.stage) return gotia.stage.update(now);
    const b = figureBox();
    return { x: b.r.left + b.x, y: b.r.top + b.y, S: b.k * G_MAX, yaw: 0, pitch: 0, roll: 0, dim: 1, vel: 0 };
  }

  // Para la pantalla de carga: dónde queda la imagen de referencia de la "G" en el
  // viewport (esquina superior izquierda) y a qué escala (px CSS por px de referencia)
  gotia.gTarget = () => {
    const P = pose(performance.now());
    const s = P.S / G_MAX / G_PX;
    return { left: P.x - REF_BOX[0] * s, top: P.y - REF_BOX[1] * s, scale: s, refWidth: REF_W, refHeight: REF_H };
  };

  // Sin WebGL: la "G" de la marca como imagen, en el mismo sitio y con la misma pose
  // (versión con fondo transparente: así se funde con la luz ambiental)
  let failed = false;
  function fail() {
    if (failed) return;
    failed = true;
    stage.classList.add('no-webgl');
    const img = new Image();
    img.className = 'stage-g';
    img.alt = '';
    img.decoding = 'async';
    img.src = 'g-glass-alpha.webp?v=2';
    img.style.width = REF_W + 'px';
    img.style.height = REF_H + 'px';
    stage.prepend(img);
    // scenes.js la mueve en cada frame
    gotia.placeFallback = (P) => {
      const s = P.S / G_MAX / G_PX;
      img.style.transform = `translate3d(${(P.x - REF_BOX[0] * s).toFixed(1)}px, ${(P.y - REF_BOX[1] * s).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
      img.style.opacity = P.dim.toFixed(3);
    };
    gotia.placeFallback(pose(performance.now()));
  }

  // lienzo transparente: deja ver la luz ambiental de la página alrededor de la "G"
  const gl = canvas.getContext('webgl', {
    antialias: false, alpha: true, depth: false, stencil: false,
    premultipliedAlpha: true, powerPreference: 'high-performance'
  });
  if (!gl) return fail();

  const VERT = `
    attribute vec2 p;
    void main() { gl_Position = vec4(p, 0.0, 1.0); }
  `;

  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif

    uniform vec2  uRes;
    uniform float uTime;
    uniform vec3  uCenter;   // xy = origen de la figura en mundo, z = escala
    uniform vec3  uMouse;    // xy = cursor en espacio local de la figura, z = intensidad (0-1)
    uniform float uFade;
    uniform float uWob;      // ondulación en reposo (menor si el sistema pide reducir movimiento)
    uniform mat3  uRot;      // balanceo + inclinación hacia el cursor
    uniform vec4  uBound;    // esfera envolvente en mundo: xyz centro, w radio
    uniform vec3  uSeg[${N_SEG * 4}];  // tramos de la "G" (ver figureSegments)

    const float FLAT = 0.85; // sección algo aplanada, como cristal inflado
    const vec3 PIVOT = vec3(${G_BOX.cx.toFixed(4)}, ${G_BOX.cy.toFixed(4)}, 0.0);

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    float dot2(vec2 v) { return dot(v, v); }

    // distancia (x) y parámetro (y) al Bézier cuadrático A-B-C (Inigo Quilez)
    vec2 bez(vec2 pos, vec2 A, vec2 B, vec2 C) {
      vec2 a = B - A;
      vec2 b = A - 2.0 * B + C;
      vec2 c = a * 2.0;
      vec2 d = A - pos;
      float kk = 1.0 / dot(b, b);
      float kx = kk * dot(a, b);
      float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
      float kz = kk * dot(d, a);
      float p = ky - kx * kx;
      float q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
      float h = q * q + 4.0 * p * p * p;
      vec2 res;
      if (h >= 0.0) {
        h = sqrt(h);
        vec2 x = (vec2(h, -h) - q) / 2.0;
        vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
        float t = clamp(uv.x + uv.y - kx, 0.0, 1.0);
        res = vec2(dot2(d + (c + b * t) * t), t);
      } else {
        float z = sqrt(-p);
        float v = acos(clamp(q / (p * z * 2.0), -1.0, 1.0)) / 3.0;
        float m = cos(v);
        float n = sin(v) * 1.732050808;
        vec2 t = clamp(vec2(m + m, -n - m) * z - kx, 0.0, 1.0);
        float dx = dot2(d + (c + b * t.x) * t.x);
        float dy = dot2(d + (c + b * t.y) * t.y);
        res = dx < dy ? vec2(dx, t.x) : vec2(dy, t.y);
      }
      return vec2(sqrt(res.x), res.y);
    }

    // tramo de tubo con radio variable (A.z → B.z → C.z); bb = esfera envolvente.
    // Devuelve (distancia, radio del tubo en ese punto). Lejos basta la cota.
    vec2 seg(vec3 p, vec3 A, vec3 B, vec3 C, vec3 bb) {
      float e = length(vec3(p.xy - bb.xy, p.z)) - bb.z;
      if (e > 0.4) return vec2(e, 0.0);
      vec2 h = bez(p.xy, A.xy, B.xy, C.xy);
      float r = mix(mix(A.z, B.z, h.y), mix(B.z, C.z, h.y), h.y);
      return vec2(FLAT * (length(vec2(h.x, p.z / FLAT)) - r), r);
    }

    // la "G": unión muy suave de los tramos (borra pliegues donde el tubo se dobla)
    vec2 figure(vec3 p) {
      p = uRot * (p - PIVOT) + PIVOT;
      vec2 res = vec2(1e3, 0.0);
      const float k = 0.035;
      for (int i = 0; i < ${N_SEG}; i++) {
        vec2 s = seg(p, uSeg[i * 4], uSeg[i * 4 + 1], uSeg[i * 4 + 2], uSeg[i * 4 + 3]);
        float h = clamp(0.5 + 0.5 * (s.x - res.x) / k, 0.0, 1.0);
        res = vec2(mix(s.x, res.x, h) - k * h * (1.0 - h), mix(s.y, res.y, h));
      }
      return res;
    }

    // ondulación líquida: ondas amplias y lentas que recorren la superficie
    float wobble(vec3 q, float t) {
      q *= 3.4;
      q += 0.5 * sin(q.yzx * 1.2 + t * vec3(0.9, 0.7, 0.8));
      float v = sin(q.x + t * 1.1) * sin(q.y - t * 0.8) * sin(q.z + t * 0.6);
      q = q * 2.2 + 1.3;
      v += 0.3 * sin(q.x - t * 1.3) * sin(q.y + t * 0.9) * sin(q.z - t * 1.2);
      return v;
    }

    // influencia del cursor en un punto (0 lejos, 1 justo debajo)
    float mouseAt(vec3 p) { return uMouse.z * exp(-dot2(p.xy - uMouse.xy) * 5.0); }

    float mapLocal(vec3 p) {
      vec2 f = figure(p);
      float d = f.x;
      // solo cerca de la superficie: lejos no hace falta y ahorra cálculo
      if (d < 0.3) {
        float m = mouseAt(p);
        float w = smoothstep(0.3, 0.1, d);
        // proporcional al grosor: en reposo ondula sin deformar el logo;
        // bajo el cursor ondula más y se hincha
        float amp = f.y * (uWob + 0.17 * m);
        d += w * (amp * wobble(p, uTime * 2.4) - f.y * 0.2 * m);
      }
      return d;
    }

    float map(vec3 p) {
      float s = uCenter.z;
      return mapLocal((p - vec3(uCenter.xy, 0.0)) / s) * s;
    }

    // normal por tetraedro; en bucle para no copiar map() cuatro veces (compila más rápido)
    vec3 calcNormal(vec3 p) {
      vec3 n = vec3(0.0);
      for (int i = 0; i < 4; i++) {
        vec3 e = i == 0 ? vec3(1.0, -1.0, -1.0) : i == 1 ? vec3(-1.0, -1.0, 1.0) : i == 2 ? vec3(-1.0, 1.0, -1.0) : vec3(1.0);
        n += e * map(p + e * 0.0015);
      }
      return normalize(n);
    }

    // softbox rectangular (luz de estudio)
    float softbox(vec3 d, vec3 dir, vec2 size, float soft) {
      vec3 z = normalize(dir);
      vec3 x = normalize(cross(vec3(0.0, 1.0, 0.0), z));
      vec3 y = cross(z, x);
      float dz = dot(d, z);
      if (dz <= 0.0) return 0.0;
      vec2 q = abs(vec2(dot(d, x), dot(d, y)) / dz);
      vec2 m = 1.0 - smoothstep(size - soft, size, q);
      return m.x * m.y;
    }

    // espectro: cian → azul → violeta → magenta → naranja → dorado (cíclico)
    vec3 film(float x) {
      float s = fract(x) * 6.0;
      vec3 c = vec3(0.30, 0.75, 1.00);
      c = mix(c, vec3(0.10, 0.28, 1.00), smoothstep(0.0, 1.0, s));
      c = mix(c, vec3(0.50, 0.16, 1.00), smoothstep(1.0, 2.0, s));
      c = mix(c, vec3(1.00, 0.18, 0.78), smoothstep(2.0, 3.0, s));
      c = mix(c, vec3(1.00, 0.45, 0.10), smoothstep(3.0, 4.0, s));
      c = mix(c, vec3(1.00, 0.80, 0.35), smoothstep(4.0, 5.0, s));
      c = mix(c, vec3(0.30, 0.75, 1.00), smoothstep(5.0, 6.0, s));
      return c;
    }

    // paleta profunda del estudio (la de la marca, con el azul eléctrico al frente):
    // azul → violeta → magenta → naranja → dorado → azul claro → azul (cíclica)
    vec3 deep(float x) {
      float s = fract(x) * 6.0;
      vec3 c = vec3(0.12, 0.34, 1.00);
      c = mix(c, vec3(0.42, 0.12, 1.00), smoothstep(0.0, 1.0, s));
      c = mix(c, vec3(1.00, 0.14, 0.60), smoothstep(1.0, 2.0, s));
      c = mix(c, vec3(1.00, 0.40, 0.06), smoothstep(2.0, 3.0, s));
      c = mix(c, vec3(1.00, 0.76, 0.26), smoothstep(3.0, 4.0, s));
      c = mix(c, vec3(0.20, 0.55, 1.00), smoothstep(4.0, 5.0, s));
      c = mix(c, vec3(0.12, 0.34, 1.00), smoothstep(5.0, 6.0, s));
      return c;
    }

    // Estudio fuera de cuadro. El fondo se ve negro, pero el cristal recoge:
    //  · detrás, un degradado espectral en vetas que lo rodea (azul a la izquierda,
    //    magenta arriba, naranja y dorado a la derecha): es lo que se ve a través del cristal;
    //  · tiras de luz que dejan vetas brillantes y una key blanca delante (destellos).
    vec3 env(vec3 d) {
      float back = smoothstep(0.35, -0.25, d.z);
      float r = length(d.xy);
      float a = atan(d.y, d.x) * 0.159;
      float side = smoothstep(0.0, 0.5, r);
      float band = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(a * 31.4 + r * 7.0 + uTime * 0.4), 1.4);
      band *= 0.75 + 0.25 * sin(r * 13.0 - a * 12.6 - uTime * 0.3);
      vec3 c = deep(0.5 - a + uTime * 0.03) * back * band * (0.1 + 2.2 * side * side);
      c += vec3(1.00, 0.92, 0.84) * 7.0 * softbox(d, vec3(-0.50, 0.62, 0.60), vec2(0.40, 0.24), 0.16);
      c += vec3(1.00, 0.97, 0.94) * 4.0 * softbox(d, vec3( 0.55, 0.25, 0.80), vec2(0.04, 0.60), 0.03);
      c += vec3(0.35, 0.72, 1.00) * 1.6 * softbox(d, vec3( 0.95, -0.05, 0.30), vec2(0.05, 0.95), 0.04);
      c += vec3(1.00, 0.62, 0.20) * 3.0 * softbox(d, vec3( 0.62, 0.30, -0.72), vec2(0.06, 0.90), 0.04);
      c += vec3(1.00, 0.30, 0.80) * 2.4 * softbox(d, vec3(-0.10, 0.70, -0.70), vec2(0.90, 0.05), 0.04);
      c += vec3(0.85, 0.90, 1.00) * 2.0 * softbox(d, vec3(-0.60, -0.20, -0.78), vec2(0.05, 0.80), 0.04);
      c += vec3(1.00, 0.95, 0.90) * 2.0 * softbox(d, vec3( 0.30, -0.50, -0.81), vec2(0.03, 0.70), 0.02);
      return c;
    }

    // luz que atraviesa el cristal: entra, cruza y sale por la cara de atrás.
    // Para una sección redonda la normal de salida es la de entrada reflejada
    // sobre la cuerda; cada canal usa otro índice (dispersión: el arcoíris del borde).
    vec3 transmit(vec3 rd, vec3 n, float ior) {
      vec3 t1 = refract(rd, n, 1.0 / ior);
      vec3 nb = reflect(n, t1);                 // normal de salida (hacia fuera)
      vec3 t2 = refract(t1, -nb, ior);
      if (dot(t2, t2) < 0.01) t2 = reflect(t1, -nb);
      return env(t2);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
      vec3 ro = vec3(0.0, 0.0, 5.0);
      vec3 rd = normalize(vec3(uv, -1.6));

      float minD = 1e3;
      vec3 pm = ro;
      bool hit = false;
      // esfera que envuelve la "G": los rayos que no la tocan no se marchan
      vec3 oc = ro - uBound.xyz;
      float sb = dot(oc, rd);
      float sh = sb * sb - dot(oc, oc) + uBound.w * uBound.w;
      if (sh > 0.0) {
        sh = sqrt(sh);
        float t = max(-sb - sh, 0.0);
        float tEnd = -sb + sh;
        float near = 0.3 * uCenter.z;
        float px = 0.8 / (1.6 * uRes.y);   // tamaño de un píxel por unidad de distancia
        for (int i = 0; i < 90; i++) {
          vec3 p = ro + rd * t;
          float d = map(p);
          if (d < minD) { minD = d; pm = p; }
          // a menos de un píxel cuenta como impacto: así los rayos rasantes del
          // borde (donde está el rim light) no se pierden
          if (d < max(0.0008, t * px)) { hit = true; break; }
          // cerca de la superficie la ondulación exige pasos más cortos
          t += d * (d < near ? 0.5 : 0.9);
          if (t > tEnd) break;
        }
        if (hit) pm = ro + rd * t;
      }

      vec3 col = vec3(0.0);
      float shade = 0.0;   // cuánto oscurece el cristal el fondo claro que tiene detrás

      if (hit) {
        vec3 p = pm;
        vec3 n = calcNormal(p);
        vec3 lp = (p - vec3(uCenter.xy, 0.0)) / uCenter.z;
        float m = mouseAt(lp);
        float ndv = clamp(dot(n, -rd), 0.0, 1.0);
        float edge = 1.0 - ndv;
        // sobre fondo claro el cristal se define por su borde: ahí apenas deja pasar la luz
        shade = 0.06 + 0.3 * pow(edge, 2.5);
        float F = 0.05 + 0.95 * pow(edge, 4.0);

        // película iridiscente: su grosor fluye por la superficie y cambia con el
        // ángulo, así los colores corren por el cristal como aceite sobre agua
        float th = 0.45 * sin(lp.x * 2.2 + lp.y * 1.4 + uTime * 0.9)
                 + 0.25 * sin(lp.y * 5.0 - lp.x * 3.0 - uTime * 1.3)
                 + edge * 1.2 + uTime * 0.05 + m * 0.6;
        vec3 irid = film(th);

        // relieve fino solo para el color (no cambia la forma): rompe reflejos y
        // refracciones en vetas líquidas, como el cristal soplado
        vec3 ns = normalize(n + 0.1 * (1.0 - 0.5 * edge) *
                  vec3(sin(lp.y * 9.0 + uTime * 1.1), sin(lp.x * 8.0 - uTime * 0.9), 0.0));

        // a través del cristal, con dispersión (cada canal se dobla distinto)
        vec3 tr = vec3(transmit(rd, ns, 1.40).r, transmit(rd, ns, 1.46).g, transmit(rd, ns, 1.53).b);
        col = tr * vec3(0.95, 0.88, 1.0) * (1.0 - F);

        // reflejo del estudio teñido por la película
        vec3 R = reflect(rd, ns);
        col += env(R) * mix(vec3(1.0), irid * 1.7, 0.6) * F;

        // luz que rebota dentro del cristal: vetas brillantes en el interior
        vec3 t1 = refract(rd, ns, 1.0 / 1.46);
        col += env(reflect(t1, reflect(ns, t1))) * mix(vec3(1.0), irid, 0.5) * F * 0.5;

        // velo de color en todo el cuerpo
        col += irid * 0.04 * (0.4 + edge);

        // rim light en espectro (el efecto del video): da la vuelta al contorno y fluye
        float ang = atan(n.y, n.x) * 0.159;
        vec3 rimC = deep(ang + uTime * 0.06 + 0.25 * sin(lp.x * 2.0 + lp.y * 1.5 + uTime) + m * 0.8);
        float lit = 0.35 + 0.65 * clamp(dot(n, normalize(vec3(-0.3, 0.8, -0.5))) + 0.6, 0.0, 1.0);
        col += rimC * pow(edge, 2.6) * 0.8 * lit;
        col += mix(rimC, vec3(1.0), 0.3) * pow(edge, 9.0) * 1.6 * lit;

        // destellos blancos nítidos
        col += vec3(1.0, 0.97, 0.92) * pow(max(dot(R, normalize(vec3(-0.45, 0.6, 0.65))), 0.0), 90.0) * 1.1;
        col += vec3(0.9, 0.95, 1.0) * pow(max(dot(R, normalize(vec3(0.6, 0.35, 0.72))), 0.0), 160.0) * 0.7;

        // bajo el cursor el espectro se enciende
        col += irid * m * (0.15 + edge) * 0.9;
      } else {
        // luz que desborda el contorno: línea fina en espectro con borde
        // irisado (cada canal se apaga a otra distancia) + halo suave
        vec2 q = (pm.xy - uCenter.xy) / uCenter.z - PIVOT.xy;
        vec3 gc = deep(atan(q.y, q.x) * 0.159 + uTime * 0.06);
        float dl = minD / uCenter.z;
        float up = 0.45 + 0.55 * clamp(q.y * 0.6 + 0.5, 0.0, 1.0);   // más luz arriba, como el contraluz
        vec3 line = exp(-dl * vec3(70.0, 85.0, 105.0));
        col += gc * (line * 0.95 * up + exp(-dl * 11.0) * 0.08);
      }

      // tono fílmico (ACES): los brillos se vuelven blancos sin perder el color
      col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
      col = pow(clamp(col, 0.0, 1.0), vec3(0.85));
      col *= 1.0 - 0.3 * dot(uv * 0.8, uv * 0.8);
      col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
      // el color es lo que se vería sobre negro (ya "premultiplicado"); el alfa, su brillo
      // un poco reforzado (sobre azul claro los colores pesan más) y la sombra del borde
      col = clamp(col, 0.0, 1.0) * uFade;
      float a = max(col.r, max(col.g, col.b));
      gl_FragColor = vec4(col, clamp(max(a * 1.3, shade * uFade), 0.0, 1.0));
    }
  `;

  // Compilación sin bloquear la página: con KHR_parallel_shader_compile el
  // driver compila en segundo plano y solo consultamos si ya terminó.
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  const vs = shader(gl.VERTEX_SHADER, VERT);
  const fs = shader(gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);

  let U = null;
  function setup() {
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    U = {
      res: gl.getUniformLocation(prog, 'uRes'),
      time: gl.getUniformLocation(prog, 'uTime'),
      center: gl.getUniformLocation(prog, 'uCenter'),
      mouse: gl.getUniformLocation(prog, 'uMouse'),
      fade: gl.getUniformLocation(prog, 'uFade'),
      wob: gl.getUniformLocation(prog, 'uWob'),
      rot: gl.getUniformLocation(prog, 'uRot'),
      bound: gl.getUniformLocation(prog, 'uBound')
    };
    gl.uniform3fv(gl.getUniformLocation(prog, 'uSeg'), SEGS);
  }

  // ---- Resolución: el mismo presupuesto de píxeles en computador y celular ----
  // (si el GPU no llega, la calidad adaptativa de draw la baja sola)
  const MAX_PIXELS = 1.6e6;
  const maxQuality = (cw, ch) => Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PIXELS / (cw * ch)));
  let qualityScale = 1;   // solo baja si el GPU no llega (ver draw)
  let W = 1, H = 1, CW = 1, CH = 1;
  const center = [0, 0, 1];   // origen de la figura en el mundo (xy) y escala (z); sale de la pose en cada frame

  function layout() {
    const r = canvas.getBoundingClientRect();
    CW = Math.max(1, r.width); CH = Math.max(1, r.height);
    const q = maxQuality(CW, CH) * qualityScale;
    W = Math.max(1, Math.round(CW * q));
    H = Math.max(1, Math.round(CH * q));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    gl.viewport(0, 0, W, H);
  }

  // pose (px de la pantalla) → origen y escala en el mundo
  function place(P) {
    const unit = 3.125 / CH;   // unidades de mundo por px CSS en el plano de la figura
    const s = (P.S / G_MAX) * unit;
    center[0] = (P.x - CW / 2) * unit - G_BOX.cx * s;
    center[1] = (CH / 2 - P.y) * unit - G_BOX.cy * s;
    center[2] = s;
  }

  // ---- Interacción: el cursor (o el dedo, en el celular) solo actúa sobre la "G" ----
  const pointer = { x: 0, y: 0, inside: false };
  const hover = { x: 0, y: 0, k: 0 };      // cursor suavizado en espacio local + intensidad
  const tilt = [0, 0];
  const aim = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = cx - r.left;
    pointer.y = cy - r.top;
    pointer.inside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= r.width && pointer.y <= r.height;
  };
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') aim(e.clientX, e.clientY); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer.inside = false; });
  // el dedo: los eventos touch siguen llegando mientras la página se desplaza
  const onTouch = (e) => { const t = e.touches[0]; if (t) aim(t.clientX, t.clientY); };
  addEventListener('touchstart', onTouch, { passive: true });
  addEventListener('touchmove', onTouch, { passive: true });
  const offTouch = (e) => { if (!e.touches.length) pointer.inside = false; };
  addEventListener('touchend', offTouch, { passive: true });
  addEventListener('touchcancel', offTouch, { passive: true });

  function updatePointer() {
    const unit = 3.125 / CH, s = center[2];
    const lx = ((pointer.x - CW / 2) * unit - center[0]) / s;
    const ly = ((CH / 2 - pointer.y) * unit - center[1]) / s;
    // intensidad: máxima sobre la "G", se apaga al alejarse de ella
    const dist = Math.hypot(lx - G_BOX.cx, ly - G_BOX.cy);
    const target = pointer.inside ? Math.min(1, Math.max(0, (2.6 - dist) / 1.4)) : 0;
    hover.k += (target - hover.k) * 0.07;
    hover.x += (lx - hover.x) * 0.18;
    hover.y += (ly - hover.y) * 0.18;
    // se inclina hacia el cursor
    const tx = pointer.inside ? Math.max(-1, Math.min(1, (lx - G_BOX.cx) / 1.6)) * 0.32 * hover.k : 0;
    const ty = pointer.inside ? Math.max(-1, Math.min(1, (ly - G_BOX.cy) / 1.6)) * 0.24 * hover.k : 0;
    tilt[0] += (tx - tilt[0]) * 0.06;
    tilt[1] += (ty - tilt[1]) * 0.06;
  }

  // balanceo lento + inclinación hacia el cursor + el giro de la escena (matriz 3×3 en columnas);
  // al hacer scroll se inclina un poco en la dirección del movimiento.
  // Con "reducir movimiento" el balanceo es más corto
  const rot = new Float32Array(9);
  const sway = reduce ? 0.4 : 1;
  function figureRotation(t, P) {
    const a = 0.1 * sway * Math.sin(t * 1.3) - tilt[0] + P.yaw;
    const b = 0.04 * sway * Math.sin(t * 0.9 + 1.0) + tilt[1] + P.pitch + clamp(P.vel / 6000, -0.22, 0.22);
    const c = P.roll;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
    // Rz(c)·Rx(b)·Ry(a), por filas
    const m0 = ca, m1 = 0, m2 = sa, m3 = sb * sa, m4 = cb, m5 = -sb * ca;
    rot.set([
      cc * m0 - sc * m3, sc * m0 + cc * m3, -cb * sa,
      cc * m1 - sc * m4, sc * m1 + cc * m4, sb,
      cc * m2 - sc * m5, sc * m2 + cc * m5, cb * ca
    ]);
    return rot;
  }

  // ---- Render loop ----
  // a la frecuencia de la pantalla también en el celular, como en el computador
  const FRAME_MS = 0;
  const BUDGET = 1000 / 60;
  let running = false, raf = 0, cleared = false;
  let time = 2.0, last = 0, lastDraw = 0, fade = 0, startedAt = 0;
  const samples = [];

  // mientras está la pantalla de carga la "G" espera: la carga le pasa el relevo
  // (main.js carga este script al elegir el 3D: si llega tarde, el relevo ya pasó)
  let revealed = !root.classList.contains('is-loading') || !!gotia.revealed;

  function draw(now) {
    const raw = last ? now - last : 16;
    const dt = Math.min(raw, 60);
    last = now;
    time += dt * 0.00042;
    if (revealed) fade = Math.min(1, fade + dt / 500);

    // calidad adaptativa: usa la mediana (los tirones sueltos de la carga no cuentan)
    // y no mide durante el primer segundo y medio. Un hueco de más de 120 ms no es el
    // GPU sino el navegador frenando la página (oculta, minimizada, otra ventana
    // encima): no cuenta y se vuelve a esperar antes de medir.
    if (raw > 120) {
      samples.length = 0;
      startedAt = now;
    } else if (running && now - startedAt > 1500) {
      samples.push(raw);
      if (samples.length === 30) {
        const median = samples.sort((a, b) => a - b)[15];
        if (median > BUDGET * 1.5 && qualityScale > 0.5) {
          qualityScale = Math.max(0.5, qualityScale * 0.85);
          layout();
        } else if (median < BUDGET * 0.75 && qualityScale < 1) {
          // sobra margen: recupera la nitidez poco a poco
          qualityScale = Math.min(1, qualityScale / 0.85);
          layout();
        }
        samples.length = 0;
      }
    }

    // dónde está la "G" en esta escena (scenes.js) y cómo reacciona al cursor
    const P = pose(now);
    place(P);
    updatePointer();

    // apagada (o aún sin revelar): basta con dejar el lienzo vacío una vez
    const f = fade * P.dim;
    if (f < 0.003) {
      if (!cleared) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); cleared = true; }
      return;
    }
    cleared = false;

    const s = center[2];
    gl.uniform2f(U.res, W, H);
    gl.uniform1f(U.time, time);
    gl.uniform3f(U.center, center[0], center[1], s);
    gl.uniform3f(U.mouse, hover.x, hover.y, hover.k);
    gl.uniform4f(U.bound, center[0] + G_BOX.cx * s, center[1] + G_BOX.cy * s, 0, G_BOUND * s);
    gl.uniform1f(U.fade, f);
    // con el scroll rápido la superficie ondula más, como un líquido que se agita
    gl.uniform1f(U.wob, (reduce ? 0.02 : 0.05) + Math.min(0.13, Math.abs(P.vel) / 2600));
    gl.uniformMatrix3fv(U.rot, false, figureRotation(time, P));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (now - lastDraw < FRAME_MS - 2) return;
    lastDraw = now;
    draw(now);
  }

  function start() {
    if (running || !revealed || !U || document.hidden) return;
    running = true;
    last = 0;
    startedAt = performance.now();
    samples.length = 0;
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  document.addEventListener('gotia:reveal', () => {
    if (revealed) return;
    revealed = true;
    fade = 0;
    start();
  });

  function begin() {
    setup();
    layout();
    stage.classList.add('gl-ready');
    // primer frame ya, aunque sea vacío: el GPU prepara el shader mientras la
    // pantalla de carga tapa el hero y la "G" luego entra sin tirón
    draw(performance.now());

    // el escenario está siempre en pantalla: solo se detiene con la pestaña oculta
    document.addEventListener('visibilitychange', () => {
      document.hidden ? stop() : start();
    });

    // el lienzo cambia de tamaño con la ventana
    const relayout = () => { layout(); if (!running) draw(performance.now()); };
    new ResizeObserver(relayout).observe(canvas);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  }

  (function whenLinked() {
    if (parallel && !gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)) {
      return setTimeout(whenLinked, 30);
    }
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[Gotiastudio] shader:', gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(prog));
      return fail();
    }
    begin();
  })();

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); fail(); });
})();
