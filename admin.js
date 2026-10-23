/* =========================================================
   Gotiastudio — Panel de administrador (estadísticas y contactos)
   · Con Supabase (supabase-config.js lleno): pide entrar con una cuenta
     admin y lee las visitas que registra analytics.js. Usa la función
     admin_sessions (supabase-setup.sql), que entrega una fila por visita;
     si aún no existe, lee los eventos uno a uno y los agrupa aquí.
     Además usa: admin_daily (12 meses), leads (contactos y ventas),
     goals (metas del mes) y Realtime (actividad en vivo).
   · Sin Supabase (o con ?demo en la dirección): modo demostración con
     datos de ejemplo, sin pedir contraseña.
   Todo se calcula en el navegador a partir de las visitas del periodo
   elegido (y del periodo anterior, para comparar).
   ========================================================= */
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const cfg = window.GOTIA_SUPABASE || {};
  const demo = !cfg.url || !cfg.anonKey || new URLSearchParams(location.search).has('demo');
  const root = document.documentElement;
  let sb = null, days = 7, timer = 0, busy = false, rpc = null, cur = [], prev = [], shown = 30;
  let W = null, B = null, compare = true, tab = 'resumen';
  let mainMetric = 'visits', histMetric = 'visits', goalMetric = 'contacts', plGroup = 'Páginas web';
  let daily = null, dailyAt = 0, dailyOk = null, leads = [], leadsOk = null, goals = {}, goalsOk = null;
  let ldShown = 30, rt = null, rtOn = false, leadBySession = new Map();
  const openLeads = new Set(), live = new Map(), feed = [];
  try { compare = localStorage.getItem('gotia-adm-compare') !== '0'; } catch (e) {}

  // ---------- nombres para mostrar ----------
  const SECTIONS = [
    ['top', 'Portada'], ['estudio', 'Manifiesto'], ['servicios', 'Servicios'], ['automatizacion', 'Automatización'],
    ['ecosistema', 'Ecosistema'], ['panel', 'Panel'], ['datos', 'Datos'], ['proceso', 'Proceso'],
    ['packs', 'Planes'], ['faq', 'Preguntas'], ['equipo', 'Equipo'], ['contacto', 'Contacto']
  ];
  const SLIDES = [
    ['top', 'Portada'], ['paso-1', 'Paso 1 · Página web'],
    ['ejemplo-lite', 'Lite · ejemplo'], ['plan-lite', 'Lite · precio'], ['ejemplo-start', 'Start · ejemplo'], ['plan-start', 'Start · precio'],
    ['ejemplo-pro', 'Pro · ejemplo'], ['plan-pro', 'Pro · precio'], ['ejemplo-business', 'Business · ejemplo'], ['plan-business', 'Business · precio'],
    ['ejemplo-max', 'Max · ejemplo'], ['plan-max', 'Max · precio'], ['comparar', 'Comparar los 5 planes'],
    ['paso-2', 'Paso 2 · Automatización'], ['ejemplo-auto-web', 'Auto. Web · ejemplo'], ['auto-web', 'Auto. Web · precio'],
    ['ejemplo-auto-completa', 'Auto. Completa · ejemplo'], ['auto-completa', 'Auto. Completa · precio'],
    ['ejemplo-auto-avanzada', 'Auto. Avanzada · ejemplo'], ['auto-avanzada', 'Auto. Avanzada · precio'], ['diferencia', 'La diferencia'],
    ['paso-3', 'Paso 3 · Mensuales'], ['mantenimiento', 'Mantenimiento Web'], ['datos', 'Datos y Asesoría'], ['datos-360', 'Datos 360'],
    ['crecimiento', 'Crecimiento'], ['paso-4', 'Paso 4 · Beneficios'], ['contacto', 'Escríbenos']
  ];
  // price: el precio de planes.html, para sugerir el valor de cada venta
  const OFFERS = [
    { name: 'Plan Lite', group: 'Páginas web', price: 350000, ids: ['ejemplo-lite', 'plan-lite'], re: /\bPlan Lite\b/i },
    { name: 'Plan Start', group: 'Páginas web', price: 580000, ids: ['ejemplo-start', 'plan-start'], re: /\bPlan Start\b/i },
    { name: 'Plan Pro', group: 'Páginas web', price: 920000, ids: ['ejemplo-pro', 'plan-pro'], re: /\bPlan Pro\b/i },
    { name: 'Plan Business', group: 'Páginas web', price: 1890000, ids: ['ejemplo-business', 'plan-business'], re: /\bPlan Business\b/i },
    { name: 'Plan Max', group: 'Páginas web', price: 5900000, ids: ['ejemplo-max', 'plan-max'], re: /\bPlan Max\b/i },
    { name: 'Automatización Web', group: 'Automatización', price: 390000, ids: ['ejemplo-auto-web', 'auto-web'], re: /Automatizaci[oó]n Web/i },
    { name: 'Automatización Completa', group: 'Automatización', price: 1190000, ids: ['ejemplo-auto-completa', 'auto-completa'], re: /Automatizaci[oó]n Completa/i },
    { name: 'Automatización Avanzada', group: 'Automatización', price: 2900000, ids: ['ejemplo-auto-avanzada', 'auto-avanzada'], re: /Automatizaci[oó]n Avanzada/i },
    { name: 'Mantenimiento Web', group: 'Planes mensuales', price: 180000, ids: ['mantenimiento'], re: /Mantenimiento/i },
    { name: 'Datos y Asesoría', group: 'Planes mensuales', price: 650000, ids: ['datos'], re: /Datos y Asesor/i },
    { name: 'Datos 360', group: 'Planes mensuales', price: 1390000, ids: ['datos-360'], re: /Datos 360/i },
    { name: 'Crecimiento', group: 'Planes mensuales', price: 1900000, ids: ['crecimiento'], re: /Crecimiento/i },
    // se piden desde los botones de WhatsApp de la web principal (no tienen pantalla en planes y precios)
    { name: 'Panel de administrador', group: 'Servicios de la web principal', price: 0, ids: [], re: /panel de administrador/i },
    { name: 'Datos verificables', group: 'Servicios de la web principal', price: 0, ids: [], re: /datos verificables/i }
  ];
  const WEB_PLANS = [0, 1, 2, 3, 4];
  const NAMES = new Map([...SECTIONS.map(([id, t]) => ['h:' + id, t]), ...SLIDES.map(([id, t]) => ['p:' + id, t])]);
  const CONTACT = /^(WhatsApp|Instagram|Correo|Formulario)/;
  const WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const WEEK_PL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
  const STATUS = [['nuevo', 'Nuevo'], ['contactado', 'Contactado'], ['cotizado', 'Cotizado'], ['ganado', 'Venta cerrada'], ['perdido', 'Perdido']];
  const ST_NAME = Object.fromEntries(STATUS);
  const OPEN = new Set(['nuevo', 'contactado', 'cotizado']);
  const isForm = (l) => l.channel === 'Formulario';
  const TABS = {
    resumen: ['Resumen', 'Lo más importante de tu web en el periodo elegido.'],
    rendimiento: ['Rendimiento', 'Cómo evoluciona cada número. La línea punteada es el periodo anterior.'],
    contactados: ['Contactados', 'Las personas que llenaron el formulario de contacto de tu web.'],
    contactos: ['Contactos', 'Quién te escribió desde la web y en qué va cada venta.'],
    web: ['Web principal', 'Sección por sección: qué ven, cuánto se quedan y dónde se van.'],
    planes: ['Planes y precios', 'Qué planes miran, cuánto tiempo y cuáles piden.'],
    origen: ['Origen', 'De dónde llegan tus visitas y cuáles terminan escribiéndote.'],
    audiencia: ['Audiencia', 'Cuándo te visitan, desde qué dispositivo y desde dónde.'],
    visitas: ['Visitas', 'Cada visita, con su recorrido completo.']
  };
  const ICON = {
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
    tap: '<svg viewBox="0 0 24 24"><path d="M5 3l14 7-6 2-2 6z"/></svg>',
    go: '<svg viewBox="0 0 24 24"><path d="M4 12h16M14 6l6 6-6 6"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>'
  };

  const isPlanes = (page) => /planes/.test(page || '');
  const strip = (x) => String(x || '').replace(/^[hp]:/, '');
  const SRC = [
    [/google|gclid/, 'Google'], [/instagram|\big\b/, 'Instagram'], [/facebook|\bfb\b|fb\.com|fbclid|\bmeta\b/, 'Facebook'],
    [/tiktok/, 'TikTok'], [/whatsapp|wa\.me/, 'WhatsApp'], [/youtube|youtu\.be/, 'YouTube'], [/linkedin|lnkd/, 'LinkedIn'],
    [/(^|\s)t\.co\b|twitter|x\.com/, 'X'], [/bing|duckduckgo|yahoo|ecosia/, 'Otros buscadores'], [/correo|e-?mail|newsletter/, 'Correo'], [/\bqr\b/, 'Código QR']
  ];
  const source = (r) => {
    const s = ((r.utm_source || '') + ' ' + (r.referrer || '')).toLowerCase().trim();
    if (!s) return 'Directo';
    const hit = SRC.find(([re]) => re.test(s));
    const name = hit ? hit[1] : (r.referrer || r.utm_source || 'Otro').slice(0, 28);
    return /^(cpc|ppc|paid|ads?|anuncio)/i.test(r.utm_medium || '') ? name + ' · anuncio' : name;
  };
  const COUNTRY = [
    [/Bogota/, 'Colombia'], [/Mexico_City|Monterrey|Cancun|Tijuana|Merida|Chihuahua|Hermosillo|Mazatlan|Matamoros/, 'México'], [/Lima/, 'Perú'],
    [/Santiago|Punta_Arenas/, 'Chile'], [/Argentina|Buenos_Aires/, 'Argentina'], [/Caracas/, 'Venezuela'], [/Guayaquil|Galapagos/, 'Ecuador'],
    [/Panama/, 'Panamá'], [/Costa_Rica/, 'Costa Rica'], [/Santo_Domingo/, 'Rep. Dominicana'], [/Montevideo/, 'Uruguay'], [/Asuncion/, 'Paraguay'],
    [/La_Paz/, 'Bolivia'], [/Guatemala/, 'Guatemala'], [/El_Salvador/, 'El Salvador'], [/Tegucigalpa/, 'Honduras'], [/Managua/, 'Nicaragua'],
    [/Puerto_Rico/, 'Puerto Rico'], [/Havana/, 'Cuba'], [/Sao_Paulo|Bahia|Fortaleza|Recife|Manaus|Belem/, 'Brasil'],
    [/Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Montreal/, 'Canadá'],
    [/New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Indiana|Kentucky|Boise|Honolulu/, 'Estados Unidos'],
    [/Madrid|Canary/, 'España'], [/London/, 'Reino Unido'], [/Paris/, 'Francia'], [/Berlin/, 'Alemania'], [/Rome/, 'Italia'], [/Lisbon/, 'Portugal']
  ];
  const country = (tz) => {
    if (!tz) return '';
    const hit = COUNTRY.find(([re]) => re.test(tz));
    return hit ? hit[1] : tz.split('/').pop().replace(/_/g, ' ');
  };
  let langNames = null;
  try { langNames = new Intl.DisplayNames(['es'], { type: 'language' }); } catch (e) {}
  const langName = (l) => {
    if (!l) return '';
    try { const t = langNames && langNames.of(l); if (t) return t[0].toUpperCase() + t.slice(1); } catch (e) {}
    return l;
  };

  // ---------- formatos ----------
  const nf = new Intl.NumberFormat('es-CO');
  const n = (v) => nf.format(Math.round(v || 0));
  const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
  const p1 = (r) => (isFinite(r) ? (r * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 }) : '0') + '%';
  const pf = (v) => (v == null ? '—' : v.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + '%');
  const dur = (s) => {
    s = Math.round(s || 0);
    if (s < 60) return s + ' s';
    const m = Math.floor(s / 60), r = s % 60;
    if (m >= 60) return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
    return m + ' min' + (r ? ' ' + r + ' s' : '');
  };
  const durAxis = (s) => (s < 60 ? Math.round(s) + ' s' : s % 60 ? Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0') : s / 60 + ' min');
  const secs = (ms) => (ms / 1000).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' s';
  const sec1 = (v) => (v == null ? '—' : v.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' s');
  const money = (v) => '$' + nf.format(Math.round(v || 0));
  const moneyShort = (v) => (v >= 1e6 ? '$' + (v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' M' : v >= 1e4 ? '$' + Math.round(v / 1e3) + ' mil' : money(v));
  const hour = (h) => ((h % 12) || 12) + (h % 24 < 12 ? ' a. m.' : ' p. m.');
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
  const dayKey = (d) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parseYmd = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, k) => { const x = new Date(d); x.setDate(x.getDate() + k); return x; };
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const median = (a) => {
    if (!a.length) return 0;
    const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const countBy = (list, fn) => {
    const m = new Map();
    for (const x of list) { const k = fn(x); if (k) m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const groupBy = (list, fn) => {
    const m = new Map();
    for (const x of list) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
    return [...m.entries()].map(([name, l]) => ({ name, list: l })).sort((a, b) => b.list.length - a.list.length);
  };
  const ago = (d) => {
    const m = Math.round((Date.now() - d) / 6e4);
    if (m < 1) return 'ahora';
    if (m < 60) return 'hace ' + m + ' min';
    const h = Math.round(m / 60);
    if (h < 24) return 'hace ' + h + ' h';
    const k = Math.round(h / 24);
    return 'hace ' + k + (k === 1 ? ' día' : ' días');
  };
  const shortDate = (d) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  const EMPTY = 'Aún sin datos en este periodo.';

  // ---------- el periodo: hoy, o los últimos N días (y los N días anteriores, para comparar) ----------
  function windowFor(nDays) {
    const now = new Date();
    const start = addDays(startOf(now), -(nDays - 1));
    const prevStart = addDays(start, -nDays);
    return { now, start, prevStart, prevEnd: new Date(prevStart.getTime() + (now - start)) };
  }
  // cada punto de las gráficas: una hora (hoy), un día (7 y 30 días) o una semana (90 y 180 días)
  function bucketsFor(w) {
    const unit = days === 1 ? 'h' : days <= 31 ? 'd' : 'w';
    const len = unit === 'h' ? 24 : unit === 'd' ? days : Math.ceil(days / 7);
    const at = (base, i) => { const d = new Date(base); if (unit === 'h') d.setHours(i); else d.setDate(d.getDate() + i * (unit === 'w' ? 7 : 1)); return d; };
    const lab = (d) => (unit === 'h' ? hour(d.getHours()) : shortDate(d));
    const long = (d) => (unit === 'h' ? cap(d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })) + ', ' + hour(d.getHours())
      : unit === 'd' ? cap(d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })) : 'Semana del ' + shortDate(d));
    const labels = [], longs = [], prevLongs = [];
    for (let i = 0; i < len; i++) {
      labels.push(lab(at(w.start, i)));
      longs.push(long(at(w.start, i)) + (unit !== 'h' && i === len - 1 ? ' (en curso)' : ''));
      prevLongs.push('Antes · ' + long(at(w.prevStart, i)));
    }
    const idx = (date, base) => {
      if (unit === 'h') return startOf(date).getTime() === startOf(base).getTime() ? date.getHours() : -1;
      const dd = Math.round((startOf(date) - startOf(base)) / 864e5), i = unit === 'w' ? Math.floor(dd / 7) : dd;
      return dd >= 0 && i < len ? i : -1;
    };
    return { unit, n: len, labels, longs, prevLongs, idx, last: unit === 'h' ? w.now.getHours() : len - 1, word: unit === 'h' ? 'hora' : unit === 'd' ? 'día' : 'semana' };
  }
  function seriesBy(list, base, fn, at = (s) => s.start) {
    const g = Array.from({ length: B.n }, () => []);
    for (const s of list) { const d = at(s); if (!d) continue; const i = B.idx(d, base); if (i >= 0) g[i].push(s); }
    return g.map((x, i) => (i > B.last ? null : fn(x, i)));
  }
  const curSeries = (fn, list = cur, at) => seriesBy(list, W.start, fn, at);
  const prevSeries = (fn, list = prev, at) => seriesBy(list, W.prevStart, fn, at);

  const contactsOf = (l) => l.filter((s) => s.contact).length;
  const METRICS = {
    visits: { name: 'Visitas', kind: 'int', fmt: n, fn: (l) => l.length },
    people: { name: 'Personas', kind: 'int', fmt: n, fn: (l) => new Set(l.map((s) => s.visitor)).size },
    contacts: { name: 'Te escriben', kind: 'int', fmt: n, fn: contactsOf },
    conv: { name: 'Conversión', kind: 'pct', fmt: pf, fn: (l) => (l.length ? contactsOf(l) / l.length * 100 : null) },
    time: { name: 'Tiempo activo', kind: 'time', fmt: dur, fn: (l) => { const d = l.map((s) => s.dur).filter((x) => x > 0); return d.length ? mean(d) : null; } },
    bounce: { name: 'Se van enseguida', kind: 'pct', fmt: pf, fn: (l) => (l.length ? l.filter((s) => s.bounce).length / l.length * 100 : null) },
    plans: { name: 'Ven los planes', kind: 'pct', fmt: pf, fn: (l) => (l.length ? l.filter((s) => s.seesPlans).length / l.length * 100 : null) },
    newp: { name: 'Visitas nuevas', kind: 'pct', fmt: pf, fn: (l) => (l.length ? l.filter((s) => !s.back).length / l.length * 100 : null) }
  };
  const AXIS = {
    int: n, pct: (v) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + '%', time: durAxis,
    secs: (v) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' s', money: moneyShort
  };

  // ---------- gráficas de línea (SVG al tamaño real de la tarjeta) ----------
  // Una línea por serie; la del periodo anterior va punteada. Al pasar el cursor (o el dedo, o
  // con las flechas del teclado) una raya vertical marca el punto y un recuadro muestra todos los valores.
  const charts = new Map();
  let gid = 0;
  const ro = 'ResizeObserver' in window ? new ResizeObserver((entries) => entries.forEach((e) => {
    const c = charts.get(e.target);
    if (c && Math.abs(c.w - e.contentRect.width) > 1) draw(e.target);
  })) : null;
  function scale(max, kind) {
    if (!(max > 0)) max = kind === 'pct' ? 10 : kind === 'time' ? 60 : 4;
    const target = max / 5;   // entre 3 y 5 rayas: sin espacio vacío arriba
    let steps;
    if (kind === 'time') steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
    else { const mag = 10 ** Math.floor(Math.log10(target)); steps = [1, 2, 2.5, 5, 10].map((f) => f * mag); }
    let step = steps.find((s) => s >= target) || steps[steps.length - 1];
    if ((kind === 'int' || kind === 'money') && step % 1) step = Math.ceil(step);
    return { step, max: step * Math.max(1, Math.ceil(max / step - 1e-9)) };
  }
  // curva suave que no se pasa de los puntos (monótona): nunca dibuja valores que no existen
  function smooth(p) {
    const f = (v) => v.toFixed(1);
    if (p.length < 3) return p.map((q, i) => (i ? 'L' : 'M') + f(q[0]) + ' ' + f(q[1])).join('');
    const k = p.length, dx = [], m = [], t = [];
    for (let i = 0; i < k - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; m[i] = (p[i + 1][1] - p[i][1]) / (dx[i] || 1); }
    t[0] = m[0];
    for (let i = 1; i < k - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    t[k - 1] = m[k - 2];
    for (let i = 0; i < k - 1; i++) {
      if (!m[i]) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const r = 3 / Math.sqrt(s); t[i] = r * a * m[i]; t[i + 1] = r * b * m[i]; }
    }
    let d = 'M' + f(p[0][0]) + ' ' + f(p[0][1]);
    for (let i = 0; i < k - 1; i++) {
      const h = dx[i] / 3;
      d += `C${f(p[i][0] + h)} ${f(p[i][1] + t[i] * h)} ${f(p[i + 1][0] - h)} ${f(p[i + 1][1] - t[i + 1] * h)} ${f(p[i + 1][0])} ${f(p[i + 1][1])}`;
    }
    return d;
  }
  const good = (v) => v != null && isFinite(v);
  function lineChart(el, opts) {
    if (!charts.has(el)) { bindChart(el); if (ro) ro.observe(el); }
    const c = charts.get(el) || { w: 0, i: -1, table: false };
    c.cfg = opts;
    charts.set(el, c);
    draw(el);
  }
  function draw(el) {
    const c = charts.get(el);
    if (!c) return;
    const cfg = c.cfg, w = Math.round(el.clientWidth);
    c.w = w;
    if (!w) return;   // pestaña oculta: se dibuja cuando aparece
    const S = cfg.series || [];
    const keys = S.length > 1 ? S.map((s) => `<span><i class="${s.cls}"></i>${esc(s.name)}</span>`).join('') : '';
    const vals = S.flatMap((s) => s.values).filter(good);
    if (!vals.length || (!cfg.zeroOk && !vals.some((v) => v > 0))) {
      c.g = null;
      el.innerHTML = (keys ? `<div class="adm-lg">${keys}</div>` : '') + `<div class="adm-lc-empty">${cfg.empty || EMPTY}</div>`;
      return;
    }
    const lg = `<div class="adm-lg">${keys}<button class="adm-lg-tbl" type="button">${c.table ? 'Ver gráfica' : 'Ver tabla'}</button></div>`;
    if (c.table) {
      c.g = null;
      el.innerHTML = lg + `<div class="adm-lc-table"><table><thead><tr><th>${esc(cfg.col || '')}</th>${S.map((s) => `<th>${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${
        cfg.tips.map((t, i) => (S.some((s) => good(s.values[i])) ? `<tr><td>${esc(t)}</td>${S.map((s) => `<td>${good(s.values[i]) ? esc(cfg.fmt(s.values[i])) : '—'}</td>`).join('')}</tr>` : '')).join('')}</tbody></table></div>`;
      return;
    }
    const H = cfg.h || 240, len = cfg.labels.length, kind = cfg.kind || 'int', axis = AXIS[kind] || n;
    const sc = scale(Math.max(...vals) * (cfg.peak ? 1.14 : 1), kind);
    const ticks = [];
    for (let v = 0; v <= sc.max + 1e-9; v += sc.step) ticks.push(v);
    const tickTxt = ticks.map(axis);
    const ends = cfg.ends && w >= 440;
    const pad = { l: Math.max(30, Math.max(...tickTxt.map((t) => t.length)) * 6.3 + 14), r: 14, t: cfg.peak ? 20 : 12, b: 26 };
    if (ends) pad.r = Math.min(120, Math.max(...S.map((s) => s.name.length)) * 6.6 + 16);
    const pw = w - pad.l - pad.r, ph = H - pad.t - pad.b;
    const X = (i) => pad.l + (len === 1 ? pw / 2 : i * pw / (len - 1));
    const Y = (v) => pad.t + ph * (1 - v / sc.max);
    const id = 'g' + (++gid);
    let svg = `<svg width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" role="img" aria-label="${esc(cfg.label || '')}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="ar-top"/><stop offset="1" class="ar-bot"/></linearGradient></defs>`;
    ticks.forEach((v, k) => {
      const y = Math.round(Y(v)) + .5;
      svg += `<line class="${k ? 'g' : 'base'}" x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}"/><text class="ax" x="${pad.l - 8}" y="${y + 4}" text-anchor="end">${esc(tickTxt[k])}</text>`;
    });
    const every = Math.ceil(len / Math.max(2, Math.floor(pw / 74)));
    for (let i = 0; i < len; i += every) {
      const x = X(i), anchor = len > 1 && i === 0 ? 'start' : x + 26 > w ? 'end' : 'middle';
      svg += `<text class="ax" x="${x.toFixed(1)}" y="${H - 6}" text-anchor="${anchor}">${esc(cfg.labels[i])}</text>`;
    }
    const runs = (values) => {
      const out = [];
      let r = null;
      values.forEach((v, i) => { if (!good(v)) { r = null; return; } if (!r) out.push(r = []); r.push([X(i), Y(v)]); });
      return out;
    };
    const order = S.slice().sort((a, b) => (/prev|goal/.test(b.cls) ? 1 : 0) - (/prev|goal/.test(a.cls) ? 1 : 0));
    for (const s of order) {
      for (const r of runs(s.values)) {
        if (r.length === 1) { svg += `<path class="ln ${s.cls}" style="stroke-width:5" d="M${r[0][0].toFixed(1)} ${r[0][1].toFixed(1)}h.01"/>`; continue; }
        const d = smooth(r);
        if (cfg.area && s.cls === 'main') svg += `<path d="${d}L${r[r.length - 1][0].toFixed(1)} ${Y(0).toFixed(1)}L${r[0][0].toFixed(1)} ${Y(0).toFixed(1)}Z" fill="url(#${id})"/>`;
        svg += `<path class="ln ${s.cls}" d="${d}"/>`;
      }
    }
    // el punto más alto, con su valor (solo en la serie principal)
    if (cfg.peak && S[0]) {
      let hi = -1;
      S[0].values.forEach((v, i) => { if (good(v) && (hi < 0 || v > S[0].values[hi])) hi = i; });
      if (hi >= 0 && S[0].values[hi] > 0) {
        const x = X(hi), y = Y(S[0].values[hi]), anchor = x < pad.l + 30 ? 'start' : x > w - pad.r - 30 ? 'end' : 'middle';
        svg += `<circle class="pkd" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"/><text class="pk" x="${x.toFixed(1)}" y="${(y - 9).toFixed(1)}" text-anchor="${anchor}">${esc(cfg.fmt(S[0].values[hi]))}</text>`;
      }
    }
    // nombre de cada línea al final (para no depender solo del color)
    if (ends) {
      const lab = [];
      S.forEach((s) => { for (let i = s.values.length - 1; i >= 0; i--) if (good(s.values[i])) { lab.push({ x: X(i), y: Y(s.values[i]), t: s.name }); break; } });
      lab.sort((a, b) => a.y - b.y);
      for (let k = 1; k < lab.length; k++) if (lab[k].y - lab[k - 1].y < 14) lab[k].y = lab[k - 1].y + 14;
      const over = lab.length ? lab[lab.length - 1].y - (H - pad.b) : 0;
      if (over > 0) lab.forEach((l) => { l.y -= over; });
      lab.forEach((l) => { svg += `<text class="el" x="${(l.x + 8).toFixed(1)}" y="${(l.y + 4).toFixed(1)}">${esc(l.t)}</text>`; });
    }
    svg += `<line class="xh" x1="0" x2="0" y1="${pad.t}" y2="${H - pad.b}"/>` + S.map((s) => `<circle class="xd ${s.cls}" r="4.5" cx="-20" cy="-20"/>`).join('') + '</svg>';
    el.innerHTML = lg + svg + '<div class="adm-tt" aria-hidden="true"></div>';
    c.g = { X, Y, S, pad, w, len };
    if (c.i >= len) c.i = -1;
  }
  function hover(el, i) {
    const c = charts.get(el);
    if (!c || !c.g) return;
    const { X, Y, S, pad, w } = c.g, cfg = c.cfg, x = X(i);
    c.i = i;
    el.classList.add('is-hover');
    const xh = el.querySelector('.xh');
    xh.setAttribute('x1', x);
    xh.setAttribute('x2', x);
    el.querySelectorAll('.xd').forEach((dot, k) => {
      const v = S[k] && S[k].values[i];
      dot.style.display = good(v) ? '' : 'none';
      if (good(v)) { dot.setAttribute('cx', x); dot.setAttribute('cy', Y(v)); }
    });
    const tt = el.querySelector('.adm-tt');
    tt.innerHTML = `<h4>${esc(cfg.tips[i])}</h4>` + S.map((s) => `<p><i class="${s.cls}"></i><b>${good(s.values[i]) ? esc(cfg.fmt(s.values[i])) : '—'}</b><span>${esc(s.sub ? s.sub[i] : s.name)}</span></p>`).join('');
    const top = el.querySelector('svg').getBoundingClientRect().top - el.getBoundingClientRect().top, tw = tt.offsetWidth;
    const left = x + 16 + tw > w ? Math.max(0, x - 16 - tw) : x + 16;
    tt.style.transform = `translate(${left.toFixed(0)}px, ${(top + pad.t).toFixed(0)}px)`;
    tt.classList.add('on');
  }
  function unhover(el) {
    el.classList.remove('is-hover');
    const tt = el.querySelector('.adm-tt');
    if (tt) tt.classList.remove('on');
  }
  function bindChart(el) {
    el.tabIndex = 0;
    const at = (e) => {
      const c = charts.get(el), svg = el.querySelector('svg');
      if (!c || !c.g || !svg) return -1;
      const { pad, len, w } = c.g, x = e.clientX - svg.getBoundingClientRect().left;
      return Math.max(0, Math.min(len - 1, Math.round((x - pad.l) / (len === 1 ? 1 : (w - pad.l - pad.r) / (len - 1)))));
    };
    const move = (e) => { if (!e.target.closest('svg')) return; const i = at(e); if (i >= 0) hover(el, i); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerdown', move);
    el.addEventListener('pointerleave', () => unhover(el));
    el.addEventListener('focus', () => {
      const c = charts.get(el);
      if (!c || !c.g) return;
      let i = c.i;
      if (i < 0) for (i = c.g.len - 1; i > 0 && !c.g.S.some((s) => good(s.values[i])); i--);
      hover(el, i);
    });
    el.addEventListener('blur', () => unhover(el));
    el.addEventListener('keydown', (e) => {
      const c = charts.get(el);
      if (!c || !c.g) return;
      const k = { ArrowLeft: -1, ArrowRight: 1, Home: -1e4, End: 1e4 }[e.key];
      if (!k) return;
      e.preventDefault();
      hover(el, Math.max(0, Math.min(c.g.len - 1, (c.i < 0 ? 0 : c.i) + k)));
    });
    el.addEventListener('click', (e) => {
      if (!e.target.closest('.adm-lg-tbl')) return;
      const c = charts.get(el);
      c.table = !c.table;
      draw(el);
    });
  }
  // mini gráfica de los números grandes
  function spark(values) {
    const v = (values || []).map((x) => (good(x) ? x : null)), ok = v.filter((x) => x != null);
    if (ok.length < 2) return '';
    const lo = Math.min(...ok), hi = Math.max(...ok), span = hi - lo || 1;
    const pts = v.map((x, i) => (x == null ? null : [i / (v.length - 1) * 100, 28 - (x - lo) / span * 24]));
    let line = '', area = '', r = [];
    const flush = () => {
      if (r.length > 1) { const d = smooth(r); line += d; area += d + `L${r[r.length - 1][0].toFixed(1)} 32L${r[0][0].toFixed(1)} 32Z`; }
      r = [];
    };
    pts.forEach((p) => { if (p) r.push(p); else flush(); });
    flush();
    return `<svg class="adm-spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><path class="sa" d="${area}"/><path class="sl" d="${line}"/></svg>`;
  }

  // ---------- datos de ejemplo (modo demostración): un año de visitas, siempre las mismas ----------
  let demoCache = null;
  function demoSessions() {
    if (demoCache) return demoCache;
    let seed = 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const pick = (list) => {
      let r = rnd() * list.reduce((a, x) => a + x[1], 0);
      for (const [v, w] of list) { r -= w; if (r <= 0) return v; }
      return list[list.length - 1][0];
    };
    const HOURS = [0.2, 0.1, 0.05, 0.05, 0.05, 0.2, 0.5, 1, 1.6, 2, 2.2, 2.4, 3, 2.8, 2.2, 2, 2.1, 2.4, 2.8, 3.6, 4.2, 4, 2.8, 1.2].map((w, h) => [h, w]);
    const REF_HOME = [
      [{ q: 1 }, 18], [{ referrer: 'google.com', q: 1.15 }, 30], [{ referrer: 'l.instagram.com', q: 1.1 }, 22], [{ referrer: 'm.facebook.com', q: 0.85 }, 7],
      [{ utm_source: 'tiktok', utm_medium: 'social', q: 0.55 }, 12], [{ utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'lanzamiento-web', q: 1.25 }, 6],
      [{ utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'busqueda-paginas-web', q: 1 }, 5], [{ referrer: 'bing.com', q: 1 }, 2]
    ];
    const REF_PLANES = [
      [{ q: 1 }, 45], [{ utm_source: 'whatsapp', utm_medium: 'mensaje', utm_campaign: 'propuesta-octubre', q: 1.35 }, 30],
      [{ referrer: 'l.instagram.com', q: 1 }, 15], [{ utm_source: 'whatsapp', utm_medium: 'estado', utm_campaign: 'estado-promo', q: 0.9 }, 10]
    ];
    const DEV = [[{ device: 'móvil', q: 0.9, load: [1500, 4400] }, 63], [{ device: 'computador', q: 1.15, load: [700, 2100] }, 31], [{ device: 'tablet', q: 1, load: [1100, 3000] }, 6]];
    const TZ = [['America/Bogota', 86], ['America/Mexico_City', 4], ['America/New_York', 3], ['America/Lima', 2], ['Europe/Madrid', 2], ['America/Panama', 1.5], ['America/Santiago', 1.5]];
    const LANG = [['es-CO', 72], ['es-419', 12], ['es', 8], ['en-US', 5], ['es-MX', 3]];
    const HOME_STAY = { top: 7, estudio: 6, servicios: 16, automatizacion: 14, ecosistema: 11, panel: 18, datos: 14, proceso: 9, packs: 24, faq: 12, equipo: 7, contacto: 10 };
    const HOME_DROP = { ecosistema: 0.1, datos: 0.05, proceso: 0.06, equipo: 0.04 };
    const PL_STAY = (id) => (id.startsWith('ejemplo-') ? (id === 'ejemplo-max' ? 34 : 22) : /^(plan|auto)-/.test(id) ? 15 : /mantenimiento|datos|crecimiento/.test(id) ? 12 : 6);
    const TABS_DEMO = {
      'ejemplo-lite': ['Tu página', 'Celular', 'WhatsApp', 'Formulario'], 'ejemplo-start': ['Secciones', 'Servicios', 'Ubicación', 'Google'],
      'ejemplo-pro': ['Chat 24/7', 'Reservas', 'Correos', 'Panel'], 'ejemplo-business': ['Tienda', 'Pago', 'Estadísticas', 'Ventas'],
      'ejemplo-max': ['Google', 'Maps', 'Redes', 'Tu web'], 'ejemplo-auto-web': ['Formulario', 'Respuestas', 'Reservas', 'Avisos'],
      'ejemplo-auto-completa': ['WhatsApp', 'Calendar', 'CRM', 'Pagos'], 'ejemplo-auto-avanzada': ['Asistente IA', 'Reglas', 'Sistemas', 'Panel']
    };
    const FAQ = [['¿Cuánto cuesta mi página?', 55], ['¿Cuánto tarda?', 25], ['¿Hay pagos mensuales?', 20]];
    const TUTOS = [
      ['servicios', 'Una web que trabaja por ti', ['Te escriben', 'Responde', 'Te avisa']],
      ['servicios', 'Aparece en Google', ['Te buscan', 'En el mapa', 'Te escriben']],
      ['automatizacion', 'Automatización Completa', ['Te escriben', 'Agenda', 'Recuerda', 'Confirma']],
      ['panel', 'Tenlo en tu web', ['Lo armamos', 'Lo usas', 'Mejoras']],
      ['datos', 'Cuánta gente llega y cuántos compran', ['Llegan', 'Compran', 'Cada semana']]
    ];
    const ECO = [['Google', 30], ['Instagram', 26], ['TikTok', 14], ['Facebook', 8], ['Automatizaciones', 10], ['Panel de administrador', 6], ['Datos verificables', 4], ['Contenido con IA', 6]];
    const HOME_CONTACT = [
      ['WhatsApp · Quiero conocer los planes y precios', 30], ['WhatsApp · Quiero el precio y la información del Plan Pro', 14],
      ['WhatsApp · Quiero el precio y la información del Plan Start', 8], ['WhatsApp · Quiero el precio y la información del Plan Business', 7],
      ['WhatsApp · Quiero el precio y la información del Plan Lite', 6], ['WhatsApp · Quiero el precio y la información del Plan Max', 2],
      ['WhatsApp · Quiero saber qué automatización me conviene y su precio', 8], ['WhatsApp · Quiero información y precio de la Automatización Completa (WhatsApp, Google Calendar…)', 4],
      ['WhatsApp · Quiero saber qué plan le conviene a mi negocio', 6], ['WhatsApp · Quiero el panel de administrador para mi web', 3],
      ['WhatsApp · Quiero datos verificables en mi negocio', 2], ['Instagram', 12], ['Formulario enviado', 6], ['Correo', 3]
    ];
    const PL_WA = {
      'Plan Lite': 'Vi los planes y me interesa el Plan Lite ($350.000)', 'Plan Start': 'Vi los planes y me interesa el Plan Start ($580.000)',
      'Plan Pro': 'Vi los planes y me interesa el Plan Pro ($920.000)', 'Plan Business': 'Vi los planes y me interesa el Plan Business ($1.890.000)',
      'Plan Max': 'Vi los planes y me interesa el Plan Max ($5.900.000)', 'Automatización Web': 'Vi los planes y me interesa la Automatización Web',
      'Automatización Completa': 'Vi los planes y me interesa la Automatización Completa',
      'Automatización Avanzada': 'Vi los planes y me interesa una Automatización Avanzada a medida para mi empresa',
      'Mantenimiento Web': 'Vi los planes y me interesa el plan mensual de Mantenimiento Web ($180.000/mes)',
      'Datos y Asesoría': 'Vi los planes y me interesa el plan mensual de Datos y Asesoría ($650.000/mes)',
      'Datos 360': 'Vi los planes y me interesa el plan mensual Datos 360 ($1.390.000/mes)',
      'Crecimiento': 'Vi los planes y me interesa el plan mensual de Crecimiento ($1.900.000/mes)'
    };
    const PL_INTENT = { 'Plan Lite': 1, 'Plan Start': 1.3, 'Plan Pro': 1.9, 'Plan Business': 1.1, 'Plan Max': 0.15, 'Automatización Web': 0.8, 'Automatización Completa': 1, 'Automatización Avanzada': 0.5, 'Mantenimiento Web': 0.7, 'Datos y Asesoría': 0.6, 'Datos 360': 0.5, 'Crecimiento': 0.4 };

    const out = [], visitors = [], visits = new Map(), now = Date.now(), today = startOf(new Date());
    const make = (t, opts) => {
      const planes = opts.planes;
      const ref = opts.ref || pick(planes ? REF_PLANES : REF_HOME), dev = opts.dev || pick(DEV);
      const back = visitors.length > 20 && rnd() < (planes ? 0.34 : 0.22);
      const visitor = back ? visitors[visitors.length - 1 - Math.floor(rnd() * Math.min(visitors.length, 400))] : 'v' + Math.floor(rnd() * 1e12).toString(36);
      if (!back) visitors.push(visitor);
      const vn = (visits.get(visitor) || 0) + 1;
      visits.set(visitor, vn);
      const act3d = !planes && rnd() < 0.16, direct3d = !planes && !act3d && rnd() < 0.03;
      const q = ref.q * dev.q * (back ? 1.25 : 1) * (act3d || direct3d ? 1.2 : 1) * (0.75 + rnd() * 0.5);
      const pre = planes ? 'p:' : 'h:';
      const ids = planes ? SLIDES.map((s) => s[0]) : SECTIONS.map((s) => s[0]);
      const path = [], dwell = {}, clicks = [], interacts = [];
      const bounced = !opts.live && rnd() < Math.min(0.6, (planes ? 0.16 : 0.3) / q);
      let stay = 0;
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if (i > 0) {
          if (bounced) break;
          const cont = Math.min(0.975, (planes ? 0.935 : 0.88) * (0.9 + 0.1 * q)) - (planes ? 0 : HOME_DROP[id] || 0);
          if (rnd() > cont) break;
        }
        const s = Math.max(1, Math.round((planes ? PL_STAY(id) : HOME_STAY[id]) * (0.4 + rnd() * 1.2) * Math.min(1.6, q)));
        path.push(pre + id);
        dwell[pre + id] = bounced ? Math.round(2 + rnd() * 10) : s;
        stay += dwell[pre + id];
      }
      const has = (id) => path.includes(pre + id);
      if (!planes) {
        if (dev.device === 'móvil' && rnd() < 0.3) interacts.push('h:Abrió el menú');
        if (has('servicios') && rnd() < 0.18) interacts.push('h:Carrusel · servicios');
        // los tutoriales de 3 o 4 pasos: tocan uno o varios pasos
        for (const [sec, title, steps] of TUTOS) {
          if (!has(sec) || rnd() > 0.22) continue;
          const upto = 1 + Math.floor(rnd() * steps.length);
          for (let k = steps.length - upto; k < steps.length; k++) interacts.push('h:Tutorial · ' + title + ' · ' + steps[k]);
        }
        if (has('packs') && rnd() < 0.25) interacts.push('h:Planes · ir a ' + pick([['Pro', 4], ['Start', 2.5], ['Business', 2], ['Lite', 1.5], ['Max', 1]]));
        if (has('ecosistema') && rnd() < 0.35) interacts.push('h:Ecosistema · ' + pick(ECO));
        if (has('panel') && rnd() < 0.14) interacts.push('h:Probó el panel de ejemplo');
        if (has('faq') && rnd() < 0.5) interacts.push('h:Pregunta · ' + pick(FAQ));
        if (has('faq') && rnd() < 0.15) interacts.push('h:Pregunta · ' + pick(FAQ));
        if (rnd() < 0.08) interacts.push('h:Menú · Planes');
        if (rnd() < 0.05) interacts.push('h:Cambió a modo negro');
        if (!act3d && !direct3d && rnd() < 0.12) interacts.push('h:Aviso 3D · lo cerró');
        if (act3d) clicks.push(rnd() < 0.4 ? 'h:Activó la versión 3D (desde el aviso)' : 'h:Activó la versión 3D');
        const pc = (0.012 + (has('packs') ? 0.035 : 0) + (has('contacto') ? 0.05 : 0) + (has('faq') ? 0.01 : 0)) * q * q * (dev.device === 'móvil' ? 0.7 : 1.25);
        if (path.length > 1 && rnd() < pc) clicks.push('h:' + pick(HOME_CONTACT));
      } else {
        for (const id in TABS_DEMO) if (has(id) && rnd() < 0.32 * q) interacts.push('p:Demo · ' + id + ' · ' + TABS_DEMO[id][1 + Math.floor(rnd() * 3)]);
        if (rnd() < 0.22) interacts.push('p:Resumen · ' + pick([['Pro', 4], ['Business', 2], ['Start', 2], ['Max', 1.4], ['Lite', 1]]));
        if (rnd() < 0.12) interacts.push('p:Menú · ' + pick([['Automatización', 3], ['Mensuales', 2], ['Beneficios', 1]]));
        if (rnd() < 0.1) interacts.push('p:Puntos · comparar');
        const seen = OFFERS.filter((o) => o.ids.some(has));
        if (seen.length && rnd() < (0.06 + seen.length * 0.012) * q * q) {
          const o = pick(seen.map((x) => [x, PL_INTENT[x.name] * (1 + x.ids.filter(has).length)]));
          clicks.push('p:WhatsApp · ' + PL_WA[o.name]);
        } else if (path.length > 1 && rnd() < 0.015 * q) clicks.push('p:WhatsApp · Vi los planes y tengo una pregunta');
      }
      const duration = stay + Math.round(rnd() * 8);
      const page = planes ? '/planes.html' : '/';
      return {
        session: 's' + Math.floor(rnd() * 1e12).toString(36) + out.length, visitor,
        started_at: new Date(t).toISOString(), last_at: new Date(Math.min(now, t + duration * 1e3)).toISOString(),
        first_page: page, pages: [page], referrer: ref.referrer || null, utm_source: ref.utm_source || null,
        utm_medium: ref.utm_medium || null, utm_campaign: ref.utm_campaign || null, device: dev.device,
        lang: pick(LANG), tz: pick(TZ), version: planes ? null : direct3d ? '3d' : 'esencial', visit_no: vn,
        sections: path, dwell, clicks, interacts: [...new Set(interacts)], duration: opts.live ? 0 : duration,
        scroll: Math.min(100, Math.round(path.length / ids.length * 100 + rnd() * 6)),
        load_ms: Math.min(120000, Math.round((dev.load[0] + rnd() * (dev.load[1] - dev.load[0])) * (rnd() < 0.06 ? 2.2 : 1)))
      };
    };
    for (let d = 364; d >= 0; d--) {
      const day = addDays(today, -d), dayStart = day.getTime(), wd = day.getDay();
      const growth = 0.55 + (364 - d) / 364 * 0.95;
      const count = Math.round((15 + rnd() * 12) * growth * [0.62, 1.05, 1.12, 1, 1.04, 0.95, 0.74][wd]);
      for (let k = 0; k < count; k++) {
        let t = dayStart + (pick(HOURS) + rnd()) * 36e5;
        if (t > now - 6e5) {
          if (d) continue;
          t = now - 6e5 - rnd() * 3 * 36e5;
          if (t < dayStart) continue;
        }
        out.push(make(t, { planes: rnd() < 0.17 }));
      }
    }
    for (let k = 0; k < 3; k++) out.push(make(now - (k + 1) * 70e3, { planes: k === 2, live: true, ref: { referrer: 'l.instagram.com', q: 1 }, dev: DEV[0][0] }));
    out.sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
    return (demoCache = out);
  }
  // formularios de ejemplo (negocios y enlaces inventados, no de negocios reales)
  const DEMO_FORMS = [
    { name: 'Natalia Ruiz', contact: '+57 300 555 0142', business: 'Panadería', link: 'https://instagram.com/ejemplo.panaderia', message: 'Quiero que me encuentren en Google y recibir pedidos por WhatsApp.' },
    { name: 'Diego Herrera', contact: 'diego@example.com', business: 'Consultorio odontológico', link: 'https://www.google.com/maps/search/consultorio+odontologico+ejemplo', message: 'Necesito una página para que los pacientes agenden sus citas solos.' },
    { name: 'Paula Castro', contact: '315 555 0187', business: 'Gimnasio', link: '@ejemplo.gimnasio', message: 'Mostrar horarios y planes, y que la gente se inscriba desde el celular.' },
    { name: 'Mateo Vargas', contact: 'mateo.vargas@example.com', business: 'Restaurante', link: null, message: 'Me interesa una carta digital con reservas.' },
    { name: 'Juliana Ortiz', contact: '+57 320 555 0110', business: 'Estudio de yoga', link: 'instagram.com/ejemplo.yoga', message: null },
    { name: 'Sebastián Mora', contact: '301 555 0163', business: 'Taller de motos', link: 'https://www.google.com/maps/search/taller+de+motos+ejemplo', message: 'Que los clientes vean los servicios y precios antes de venir.' },
    { name: 'Valentina Ríos', contact: 'valentina@example.com', business: 'Floristería', link: '@ejemplo.flores', message: 'Vender arreglos por la web con domicilio.' },
    { name: 'Felipe Suárez', contact: '+57 311 555 0135', business: 'Agencia de viajes', link: null, message: 'Renovar la página que tengo; está lenta y no llegan clientes.' }
  ];
  // contactos de ejemplo: uno por cada visita que tocó un botón de contacto en los últimos 150 días
  let demoLeadCache = null;
  function demoLeads() {
    if (demoLeadCache) return demoLeadCache;
    let seed = 11;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const pick = (list) => {
      let r = rnd() * list.reduce((a, x) => a + x[1], 0);
      for (const [v, w] of list) { r -= w; if (r <= 0) return v; }
      return list[list.length - 1][0];
    };
    const NAMES_DEMO = ['Laura', 'Andrés', 'Camila', 'Julián', 'Valentina', 'Santiago', 'Daniela', 'Felipe', 'Mariana', 'Sebastián', 'Natalia', 'Carlos', 'Paula', 'Diego', 'Juliana', 'Mateo'];
    const NOTES = ['Pidió ejemplos de páginas para restaurantes.', 'Quiere pagar en dos cuotas.', 'Lo va a pensar hasta fin de mes.', 'Ya tiene dominio; preguntó si sirve.',
      'Le interesa también la automatización de WhatsApp.', 'Pidió la propuesta por correo.', 'Está comparando con otra agencia.', 'Quiere empezar la próxima semana.'];
    const now = Date.now(), out = [];
    demoSessions().slice().reverse().forEach((r) => {
      const c = (r.clicks || []).find((x) => CONTACT.test(strip(x)));
      const t = new Date(r.last_at).getTime();
      if (!c || now - t > 150 * 864e5) return;
      const age = (now - t) / 864e5, label = strip(c), o = OFFERS.find((x) => x.re.test(label));
      const status = age < 2 ? pick([['nuevo', 7], ['contactado', 3]])
        : age < 10 ? pick([['nuevo', 0.8], ['contactado', 3.5], ['cotizado', 3], ['ganado', 1.2], ['perdido', 1.3]])
          : age < 40 ? pick([['contactado', 0.6], ['cotizado', 0.8], ['ganado', 2.6], ['perdido', 4]])
            : pick([['ganado', 2.6], ['perdido', 4.6]]);
      const price = o ? o.price : pick([[580000, 2], [920000, 3], [1890000, 1]]);
      const closed = status === 'ganado' || status === 'perdido' ? new Date(Math.min(now - 36e5, t + (1 + rnd() * Math.min(age - 0.2, 12)) * 864e5)) : null;
      out.push({
        id: out.length + 1, created_at: new Date(t).toISOString(), updated_at: new Date(t).toISOString(), closed_at: closed ? closed.toISOString() : null,
        session: r.session, visitor: r.visitor, channel: label.split(' ')[0], label, page: r.first_page,
        referrer: r.referrer, utm_source: r.utm_source, utm_medium: r.utm_medium, utm_campaign: r.utm_campaign, device: r.device,
        name: status !== 'nuevo' && rnd() < 0.75 ? NAMES_DEMO[Math.floor(rnd() * NAMES_DEMO.length)] + ' ' + 'ABCDEFGHJLMNOPRSTV'[Math.floor(rnd() * 18)] + '.' : null,
        contact: null, status,
        value: status === 'cotizado' || status === 'ganado' ? Math.round(price * (rnd() < 0.25 ? 0.9 : 1)) : status === 'perdido' && rnd() < 0.5 ? price : null,
        next_at: (status === 'contactado' || status === 'cotizado') && age < 25 ? ymd(addDays(new Date(), Math.round(rnd() * 9) - 2)) : null,
        notes: rnd() < 0.35 ? NOTES[Math.floor(rnd() * NOTES.length)] : null
      });
      // quien envió el formulario dejó sus datos
      const l = out[out.length - 1];
      if (l.channel === 'Formulario') Object.assign(l, DEMO_FORMS[Math.floor(rnd() * DEMO_FORMS.length)], { consent_at: l.created_at });
    });
    out.reverse();
    // los tres más recientes, para ver cómo llegan
    const at = (h) => new Date(now - h * 36e5).toISOString();
    const form = (id, h, data) => ({ id, created_at: at(h), updated_at: at(h), closed_at: null, session: null, visitor: null, channel: 'Formulario', label: 'Formulario enviado', page: '/', referrer: null, utm_source: null, utm_medium: null, utm_campaign: null, device: 'móvil', plan: null, value: null, next_at: null, notes: null, status: 'nuevo', consent_at: at(h), ...data });
    out.unshift(
      form(9001, 0.6, { name: 'Laura Gómez', contact: '+57 300 555 0123', business: 'Peluquería', link: 'https://instagram.com/ejemplo.peluqueria', message: 'Quiero que mis clientas puedan reservar cita desde Instagram y desde la web.', referrer: 'l.instagram.com' }),
      form(9002, 5, { name: 'Andrés Martínez', contact: 'andres@example.com', business: 'Tienda de ropa', link: 'https://www.google.com/maps/search/tienda+de+ropa+ejemplo', message: 'Hoy vendo por WhatsApp y quiero una tienda en línea con pagos.', referrer: 'google.com', device: 'computador' }),
      form(9003, 22, { name: 'Camila Rojas', contact: '310 555 0199', business: 'Glamping', link: '@ejemplo.glamping', message: 'Necesito mostrar las cabañas, las fechas disponibles y recibir reservas.', utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'lanzamiento-web', status: 'contactado', next_at: ymd(new Date()), notes: 'Le escribí por WhatsApp; quiere ver ejemplos de reservas.' })
    );
    return (demoLeadCache = out);
  }

  // ---------- leer las visitas del periodo ----------
  async function fetchEvents(since) {
    const all = [];
    for (let from = 0; from < 100000; from += 1000) {
      const { data, error } = await sb.from('events').select('*').gte('created_at', since.toISOString()).order('created_at', { ascending: false }).range(from, from + 999);
      if (error) throw error;
      all.push(...data);
      if (data.length < 1000) break;
    }
    return all;
  }
  // lo mismo que hace admin_sessions en Supabase, por si aún no se creó
  function sessionsFromEvents(events) {
    const m = new Map();
    events.slice().sort((a, b) => (a.created_at < b.created_at ? -1 : 1)).forEach((e) => {
      const pre = isPlanes(e.page) ? 'p:' : 'h:';
      let r = m.get(e.session);
      if (!r) m.set(e.session, (r = { session: e.session, visitor: e.visitor, started_at: e.created_at, pages: [], sections: [], clicks: [], interacts: [], dwell: {}, duration: 0, scroll: 0, ok: false }));
      r.last_at = e.created_at;
      if (!r.device && e.device) r.device = e.device;
      if (!r.tz && e.tz) r.tz = e.tz;
      if (e.type === 'pageview') {
        if (!r.ok) Object.assign(r, { ok: true, first_page: e.page, referrer: e.referrer, utm_source: e.utm_source, utm_medium: e.utm_medium, utm_campaign: e.utm_campaign, lang: e.lang });
        if (!r.version && e.version) r.version = e.version;
        if (!r.pages.includes(e.page)) r.pages.push(e.page);
        if (e.visit_no) r.visit_no = Math.max(r.visit_no || 0, e.visit_no);
      } else if (e.type === 'section' && e.label) r.sections.push(pre + e.label);
      else if (e.type === 'click' && e.label) r.clicks.push(pre + e.label);
      else if (e.type === 'interact' && e.label) r.interacts.push(pre + e.label);
      else if (e.type === 'leave') {
        r.duration += e.duration || 0;
        r.scroll = Math.max(r.scroll, e.scroll || 0);
        if (e.load_ms != null) r.load_ms = Math.max(r.load_ms || 0, e.load_ms);
        if (e.dwell && typeof e.dwell === 'object') for (const k in e.dwell) r.dwell[pre + k] = (r.dwell[pre + k] || 0) + (Number(e.dwell[k]) || 0);
      }
    });
    return [...m.values()].filter((r) => r.ok);
  }
  async function fetchSessions(since) {
    if (demo) return demoSessions().filter((r) => new Date(r.started_at) >= since);
    if (rpc !== false) {
      const all = [];
      let failed = null;
      for (let from = 0; from < 100000; from += 1000) {
        const { data, error } = await sb.rpc('admin_sessions', { p_since: since.toISOString() }).range(from, from + 999);
        if (error) { failed = error; break; }
        all.push(...data);
        if (data.length < 1000) break;
      }
      if (!failed) { rpc = true; return all; }
      const missing = /PGRST202|42883/.test(failed.code || '') || /admin_sessions|function/i.test(failed.message || '');
      if (!missing) throw failed;
      rpc = false;
    }
    return sessionsFromEvents(await fetchEvents(since));
  }
  // un año, día por día (para la gráfica de 12 meses y las metas del mes)
  function dailyFromRows(rows) {
    const m = new Map();
    for (const r of rows) {
      const k = ymd(new Date(r.started_at));
      let d = m.get(k);
      if (!d) m.set(k, (d = { day: k, visits: 0, people: 0, contacts: 0, bounces: 0, active: 0, timed: 0, v: new Set() }));
      const contact = (r.clicks || []).some((c) => CONTACT.test(strip(c)));
      d.visits++;
      d.v.add(r.visitor);
      if (contact) d.contacts++;
      else if (new Set(r.sections || []).size <= 1 && (r.duration || 0) < 20) d.bounces++;
      if (r.duration > 0) { d.active += r.duration; d.timed++; }
    }
    return [...m.values()].map((d) => { d.people = d.v.size; delete d.v; return d; }).sort((a, b) => (a.day < b.day ? -1 : 1));
  }
  async function fetchDaily() {
    const since = addDays(startOf(new Date()), -371);
    if (demo) { dailyOk = true; return dailyFromRows(demoSessions().filter((r) => new Date(r.started_at) >= since)); }
    let tz = 'America/Bogota';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (e) {}
    const { data, error } = await sb.rpc('admin_daily', { p_since: since.toISOString(), p_tz: tz });
    if (error) { dailyOk = false; return null; }
    dailyOk = true;
    return data.map((r) => ({ day: String(r.day).slice(0, 10), visits: r.visits, people: r.people, contacts: r.contacts, bounces: r.bounces, active: Number(r.active_s) || 0, timed: r.timed || 0 }));
  }
  async function fetchLeads() {
    if (demo) { leadsOk = true; return demoLeads(); }
    const { data, error } = await sb.from('leads').select('*').order('created_at', { ascending: false }).limit(3000);
    if (error) { leadsOk = false; return []; }
    leadsOk = true;
    return data;
  }
  async function fetchGoals() {
    if (demo) { goalsOk = true; return; }
    const { data, error } = await sb.from('goals').select('*');
    if (error) { goalsOk = false; return; }
    goalsOk = true;
    goals = Object.fromEntries(data.map((g) => [String(g.month).slice(0, 10), g]));
  }

  // ---------- cada visita, lista para analizar ----------
  function prepare(rows) {
    const list = rows.map((r) => {
      const path = [...new Set((r.sections || []).filter(Boolean))];
      const clicks = (r.clicks || []).filter(Boolean), interacts = (r.interacts || []).filter(Boolean);
      const pages = (r.pages && r.pages.length ? r.pages : [r.first_page || '/']).filter(Boolean);
      const contacts = clicks.filter((c) => CONTACT.test(strip(c)));
      const intents = new Set();
      contacts.forEach((c) => OFFERS.forEach((o, i) => { if (o.re.test(c)) intents.add(i); }));
      const seen = new Set();
      OFFERS.forEach((o, i) => { if (o.ids.some((id) => path.includes('p:' + id))) seen.add(i); });
      const last = (pre) => { for (let i = path.length - 1; i >= 0; i--) if (path[i].startsWith(pre)) return path[i]; return ''; };
      const s = {
        id: r.session, visitor: r.visitor, start: new Date(r.started_at), last: new Date(r.last_at || r.started_at),
        pages, home: pages.some((p) => !isPlanes(p)), planes: pages.some(isPlanes) || path.some((x) => x.startsWith('p:')),
        referrer: r.referrer || '', utm_source: r.utm_source || '', utm_medium: r.utm_medium || '', utm_campaign: r.utm_campaign || '',
        device: r.device || 'computador', lang: r.lang || '', tz: r.tz || '', version: r.version || '', visitNo: r.visit_no || 0,
        path, sec: new Set(path), dwell: r.dwell || {}, clicks, interacts, contacts, intents, seen,
        dur: r.duration || 0, scroll: r.scroll || 0, load: r.load_ms || 0,
        exitH: last('h:'), exitP: last('p:')
      };
      s.src = source(s);
      s.contact = contacts.length > 0;
      s.contactH = contacts.some((c) => c.startsWith('h:'));
      s.contactP = contacts.some((c) => c.startsWith('p:'));
      s.channel = s.contact ? strip(contacts[0]).split(' ')[0] : '';
      s.bounce = !s.contact && path.length <= 1 && s.dur < 20;
      s.is3d = s.version === '3d' || clicks.some((c) => /Activó la versión 3D/.test(c));
      s.seesPlans = s.sec.has('h:packs') || s.planes;
      return s;
    });
    // ¿ya había venido? (visit_no lo dice; si falta, se busca en las visitas cargadas)
    const before = new Set();
    list.slice().sort((a, b) => a.start - b.start).forEach((s) => {
      s.back = s.visitNo > 1 || (!s.visitNo && before.has(s.visitor));
      before.add(s.visitor);
    });
    return list.sort((a, b) => b.start - a.start);
  }
  // cada contacto, con lo que se calcula de él (los campos con "_" no se guardan).
  // El plan: el que elegiste; si no, el del botón que tocó; si no, el que más miró en esa visita
  let sessById = new Map();
  function prepLead(l) {
    const label = l.label || '';
    let o = OFFERS.find((x) => x.name === l.plan) || OFFERS.find((x) => x.re.test(label));
    l._guess = false;
    if (!o && l.session && sessById.has(l.session)) {
      const s = sessById.get(l.session);
      const best = [...s.seen].map((i) => [i, OFFERS[i].ids.reduce((a, id) => a + (s.dwell['p:' + id] || 0), 0)]).sort((a, b) => b[1] - a[1])[0];
      if (best) { o = OFFERS[best[0]]; l._guess = true; }
    }
    l._created = new Date(l.created_at);
    l._closed = l.closed_at ? new Date(l.closed_at) : null;
    l._plan = o ? o.name : '';
    l._price = o ? o.price : 0;
    l._src = l.session || l.referrer || l.utm_source ? source(l) : l.channel || 'Manual';
    return l;
  }

  const summary = (list) => {
    const durs = list.map((s) => s.dur).filter((d) => d > 0);
    return {
      n: list.length,
      people: new Set(list.map((s) => s.visitor)).size,
      pages: list.reduce((a, s) => a + s.pages.length, 0),
      back: list.filter((s) => s.back).length,
      avg: mean(durs),
      bounce: list.filter((s) => s.bounce).length,
      contact: list.filter((s) => s.contact).length,
      seesPlans: list.filter((s) => s.seesPlans).length
    };
  };
  const rate = (a, b) => (b ? a / b : 0);

  // ---------- piezas para pintar ----------
  const delta = (c, p, invert) => {
    if (!compare) return '';
    if (!p) return c ? '<em class="adm-d up">nuevo</em>' : '';
    const d = Math.round((c - p) / p * 100);
    if (!d) return '<em class="adm-d">=</em>';
    return `<em class="adm-d ${(d > 0) !== !!invert ? 'up' : 'down'}">${d > 0 ? '↑' : '↓'} ${Math.abs(d)}%</em>`;
  };
  const pdelta = (c, p, hasPrev, invert) => {
    if (!compare || !hasPrev) return '';
    const d = Math.round((c - p) * 1000) / 10;
    if (!d) return '<em class="adm-d">=</em>';
    return `<em class="adm-d ${(d > 0) !== !!invert ? 'up' : 'down'}">${d > 0 ? '↑' : '↓'} ${Math.abs(d).toLocaleString('es-CO')} pts</em>`;
  };
  const K = (k, v, d, s, sp, metric) => ({ k, v, d, s, sp, metric });
  const kpis = (el, items) => {
    el.innerHTML = items.map(({ k, v, d, s, sp, metric }) => {
      const tag = metric ? 'button' : 'article';
      const attr = metric ? ` type="button" data-metric="${metric}" aria-pressed="${metric === mainMetric}" title="Ver en la gráfica"` : '';
      return `<${tag} class="adm-kpi glass"${attr}><small>${k}</small><span class="adm-kpi-val"><strong>${v}</strong>${d || ''}</span><span class="adm-kpi-sub">${s}</span>${sp ? spark(sp) : ''}</${tag}>`;
    }).join('');
  };
  const bars = (rows, total, fmt) => {
    if (!rows.length) return `<li class="adm-empty">${EMPTY}</li>`;
    const top = Math.max(...rows.map((r) => r[1]), 1);
    return rows.map(([k, v, extra]) => `<li><span title="${esc(k)}">${esc(k)}</span><i style="--w:${(v / top).toFixed(3)}"></i><b>${fmt ? fmt(v, extra) : n(v) + (total ? ` <small>${pct(v, total)}%</small>` : '')}</b></li>`).join('');
  };
  const cellbar = (v, base, label) => `<span class="adm-cellbar"><i style="--w:${base ? Math.min(1, v / base).toFixed(3) : 0}"></i><b>${label ?? pct(v, base) + '%'}</b></span>`;
  const emptyRow = (cols) => `<tr><td colspan="${cols}" class="adm-empty">${EMPTY}</td></tr>`;
  const mini = (head, rows) => `<table class="adm-mini"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const split = (groups, total) => `<div class="adm-split">${groups.map((g, i) => `<i class="d${Math.min(i, 3)}" style="--w:${(g.list.length / total).toFixed(3)}" title="${esc(g.name)}: ${pct(g.list.length, total)}%"></i>`).join('')}</div>`;
  const dot = (i) => `<i class="adm-dot d${Math.min(i, 3)}"></i>`;

  function funnel(el, steps) {
    const base = steps[0][1];
    if (!base) { el.innerHTML = `<li class="adm-empty">${EMPTY}</li>`; return; }
    el.innerHTML = steps.map(([label, v], i) => {
      const lost = i ? steps[i - 1][1] - v : 0;
      return `<li><div class="adm-funnel-top"><span>${label}</span><b>${pct(v, base)}%</b></div><i style="--w:${(v / base).toFixed(3)}"></i><small>${n(v)} ${v === 1 ? 'visita' : 'visitas'}${i && lost > 0 ? ` · se pierde el ${pct(lost, steps[i - 1][1])}% del paso anterior` : ''}</small></li>`;
    }).join('');
  }
  function sectionRows(list, pre, defs, exitKey) {
    return defs.map(([id, name]) => {
      const k = pre + id, reached = list.filter((s) => s.sec.has(k));
      const times = reached.map((s) => s.dwell[k] || 0).filter((v) => v > 0);
      return { name, reach: reached.length, time: times.length ? mean(times) : null, exits: list.filter((s) => s[exitKey] === k).length };
    });
  }
  function sectionTable(el, rows, base) {
    if (!base) { el.innerHTML = emptyRow(4); return; }
    const hot = Math.max(...rows.map((r) => r.exits));
    el.innerHTML = rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${cellbar(r.reach, base)}</td><td>${r.time == null ? '—' : dur(r.time)}</td><td class="${r.exits && r.exits === hot ? 'is-hot' : ''}">${pct(r.exits, base)}%</td></tr>`).join('');
  }
  function offerRows(list) {
    const P = list.filter((s) => s.planes);
    return OFFERS.map((o, i) => {
      const viewers = P.filter((s) => s.seen.has(i));
      const times = viewers.map((s) => o.ids.reduce((a, id) => a + (s.dwell['p:' + id] || 0), 0)).filter((v) => v > 0);
      const demos = o.ids.filter((id) => id.startsWith('ejemplo-'));
      const tocan = demos.length ? viewers.filter((s) => s.interacts.some((x) => demos.some((id) => x.startsWith('p:Demo · ' + id + ' · ')))).length : null;
      return {
        o, i, views: viewers.length, base: P.length, time: times.length ? mean(times) : null, demo: tocan,
        intents: list.filter((s) => s.intents.has(i)).length, conv: viewers.filter((s) => s.intents.has(i)).length
      };
    });
  }
  function bestTime(list) {
    const grid = WEEK.map(() => Array(24).fill(0));
    list.forEach((s) => { grid[(s.start.getDay() + 6) % 7][s.start.getHours()]++; });
    const totals = grid.map((r) => r.reduce((a, b) => a + b, 0));
    const wd = totals.indexOf(Math.max(...totals));
    let h = 0, best = -1;
    const byHour = Array(24).fill(0).map((_, i) => grid.reduce((a, r) => a + r[i], 0));
    for (let i = 0; i < 23; i++) if (byHour[i] + byHour[i + 1] > best) { best = byHour[i] + byHour[i + 1]; h = i; }
    return { grid, totals, wd, h, day: WEEK_PL[wd], from: hour(h), to: hour(h + 2) };
  }

  // ---------- RESUMEN ----------
  function renderResumen() {
    const a = summary(cur), b = summary(prev), hp = b.n > 0;
    const sp = (m) => curSeries(METRICS[m].fn);
    kpis($('#adm-kpis'), [
      K('Visitas', n(a.n), delta(a.n, b.n), days === 1 ? 'hoy' : '≈ ' + n(a.n / days) + ' por día', sp('visits'), 'visits'),
      K('Personas', n(a.people), delta(a.people, b.people), 'navegadores distintos', sp('people'), 'people'),
      K('Te escriben', n(a.contact), delta(a.contact, b.contact), 'visitas con un contacto', sp('contacts'), 'contacts'),
      K('Conversión', p1(rate(a.contact, a.n)), pdelta(rate(a.contact, a.n), rate(b.contact, b.n), hp), 'de las visitas te escribe', sp('conv'), 'conv'),
      K('Tiempo activo', dur(a.avg), delta(a.avg, b.avg), 'promedio por visita', sp('time'), 'time'),
      K('Se van enseguida', pct(a.bounce, a.n) + '%', pdelta(rate(a.bounce, a.n), rate(b.bounce, b.n), hp, true), 'sin pasar de la portada', sp('bounce'), 'bounce'),
      K('Ven los planes', pct(a.seesPlans, a.n) + '%', pdelta(rate(a.seesPlans, a.n), rate(b.seesPlans, b.n), hp), 'en la web o en planes y precios', sp('plans'), 'plans'),
      K('Nuevas', pct(a.n - a.back, a.n) + '%', pdelta(rate(a.n - a.back, a.n), rate(b.n - b.back, b.n), hp), n(a.back) + ' visitas de personas que vuelven', sp('newp'), 'newp')
    ]);
    renderMain();
    renderInsights();
    renderGoals();
    renderFeed();

    const H = cur.filter((s) => s.home), P = cur.filter((s) => s.planes);
    const hs = (id) => H.filter((s) => s.sec.has('h:' + id)).length;
    funnel($('#adm-funnel-home'), [
      ['Abren la web', H.length], ['Pasan de la portada', H.filter((s) => s.path.filter((x) => x.startsWith('h:')).length > 1).length],
      ['Ven los servicios', hs('servicios')], ['Llegan a los planes', hs('packs')], ['Llegan a contacto', hs('contacto')],
      ['Te escriben', H.filter((s) => s.contactH).length]
    ]);
    funnel($('#adm-funnel-planes'), planesSteps(P));

    $('#adm-sum-sources').innerHTML = bars(groupBy(cur, (s) => s.src).slice(0, 7).map((g) => [g.name, g.list.length]), cur.length);
    const offers = offerRows(cur).filter((r) => r.views || r.intents).sort((x, y) => y.views - x.views || y.intents - x.intents).slice(0, 7);
    $('#adm-sum-offers').innerHTML = bars(offers.map((r) => [r.o.name, r.views, r.intents]), 0, (v, k) => `${n(v)} <small>${n(k)} piden</small>`);
    const contacted = cur.filter((s) => s.contact);
    $('#adm-sum-contacts').innerHTML = bars([
      ...countBy(contacted, (s) => s.channel).map(([k, v]) => [k, v]),
      ...(contacted.length ? [['Desde planes y precios', contacted.filter((s) => s.contactP).length], ['Desde la web principal', contacted.filter((s) => s.contactH).length]] : [])
    ], contacted.length);
  }
  function planesSteps(P) {
    const has = (id) => (s) => s.sec.has('p:' + id);
    return [
      ['Abren planes y precios', P.length],
      ['Ven un plan de página web', P.filter((s) => WEB_PLANS.some((i) => s.seen.has(i))).length],
      ['Ven un ejemplo animado', P.filter((s) => s.path.some((x) => x.startsWith('p:ejemplo-'))).length],
      ['Comparan los planes', P.filter(has('comparar')).length],
      ['Ven automatización o mensuales', P.filter((s) => s.path.some((x) => /^p:(paso-2|paso-3|auto-|ejemplo-auto-|mantenimiento|datos|crecimiento)/.test(x))).length],
      ['Llegan al final', P.filter(has('contacto')).length],
      ['Te escriben', P.filter((s) => s.contactP).length]
    ];
  }
  // la gráfica grande: la métrica elegida, este periodo frente al anterior
  function renderMain() {
    const m = METRICS[mainMetric];
    $$('#adm-main-metric button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.metric === mainMetric)));
    $$('#adm-kpis [data-metric]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.metric === mainMetric)));
    $('#adm-main-title').textContent = m.name;
    $('#adm-main-sub').textContent = 'por ' + B.word + (compare ? ' · la línea punteada es el periodo anterior' : '');
    const series = [{ name: 'Este periodo', values: curSeries(m.fn), cls: 'main', sub: B.longs.map(() => 'Este periodo') }];
    if (compare) series.push({ name: 'Periodo anterior', values: prevSeries(m.fn), cls: 'prev', sub: B.prevLongs });
    lineChart($('#adm-main-chart'), { labels: B.labels, tips: B.longs, col: cap(B.word), series, fmt: m.fmt, kind: m.kind, area: true, peak: true, h: 280, zeroOk: m.kind !== 'int', label: m.name + ' por ' + B.word });
  }

  // lo que conviene hacer, según los datos (lo más importante primero)
  function renderInsights() {
    const out = [];
    const add = (tone, html, weight) => out.push({ tone, html, weight });
    const L = cur, a = summary(L), b = summary(prev);
    const go = (t, label) => ` <button type="button" data-go-tab="${t}">${label}</button>`;

    // contactos: lo más urgente
    if (leadsOk) {
      const forms = leads.filter((l) => isForm(l) && l.status === 'nuevo');
      if (forms.length) add('warn', `<b>${n(forms.length)} ${forms.length === 1 ? 'persona llenó el formulario y espera' : 'personas llenaron el formulario y esperan'} tu respuesta</b>. Escríbeles hoy.` + go('contactados', 'Ver formularios'), 12);
      const waiting = leads.filter((l) => !isForm(l) && l.status === 'nuevo' && Date.now() - l._created > 2 * 36e5);
      if (waiting.length) add('warn', `Tienes <b>${n(waiting.length)} ${waiting.length === 1 ? 'contacto' : 'contactos'} sin responder</b>. Quien responde primero suele quedarse con el cliente.` + go('contactos', 'Ver contactos'), 11);
      const today = ymd(new Date()), due = leads.filter((l) => OPEN.has(l.status) && l.next_at && l.next_at <= today);
      if (due.length) add('tip', `Hoy toca hacer seguimiento a <b>${n(due.length)} ${due.length === 1 ? 'contacto' : 'contactos'}</b>.` + go('contactos', 'Ver la lista'), 9);
    }
    const g = goalState();
    if (g && g.m.contacts.goal && g.elapsed > 0.2) {
      const r = g.m.contacts;
      if (r.proj < r.goal * 0.85) add('warn', `A este ritmo cerrarás el mes con unos <b>${n(r.proj)} contactos</b>, por debajo de tu meta de ${n(r.goal)}. Publica más o activa una campaña esta semana.`, 8);
      else if (r.proj >= r.goal) add('good', `Vas bien con tu meta: a este ritmo llegarás a unos <b>${n(r.proj)} contactos</b> este mes (meta: ${n(r.goal)}).`, 4);
    }
    if (!L.length) {
      add('tip', 'Aún no hay visitas en este periodo. Comparte el enlace de tu web para empezar a ver datos.', 1);
    } else {
      const avgRate = rate(a.contact, a.n);
      if (b.n >= 10) {
        const d = Math.round((a.n - b.n) / b.n * 100);
        if (d >= 10) add('good', `Las visitas <b>subieron ${d}%</b> frente al periodo anterior (${n(a.n)} frente a ${n(b.n)}).`, 5);
        else if (d <= -10) add('warn', `Las visitas <b>bajaron ${-d}%</b> frente al periodo anterior. Revisa si dejaste de publicar o si terminó alguna campaña.`, 8);
      }
      if (a.n >= 10 && !a.contact) add('warn', 'Nadie usó los botones de contacto en este periodo. Prueba un llamado más claro en la portada, como “Escríbenos por WhatsApp”.', 9);
      if (a.n >= 20 && a.bounce / a.n > 0.42) add('warn', `El <b>${pct(a.bounce, a.n)}%</b> se va sin pasar de la primera pantalla. Revisa que la portada diga en una frase qué haces y cómo escribirte.`, 6);

      const H = L.filter((s) => s.home);
      if (H.length >= 15) {
        let worst = null;
        for (let i = 2; i < SECTIONS.length; i++) {
          const x = H.filter((s) => s.sec.has('h:' + SECTIONS[i - 1][0])).length, y = H.filter((s) => s.sec.has('h:' + SECTIONS[i][0])).length;
          if (x - y > (worst ? worst.d : 0)) worst = { d: x - y, from: SECTIONS[i - 1][1], to: SECTIONS[i][1] };
        }
        if (worst && pct(worst.d, H.length) >= 6) add('warn', `El <b>${pct(worst.d, H.length)}%</b> de las visitas se va entre <b>${worst.from}</b> y <b>${worst.to}</b>. Haz esa parte más corta o pon un botón de WhatsApp justo ahí.`, 7);
      }

      const srcs = groupBy(L, (s) => s.src).map((gr) => ({ ...gr, rate: rate(gr.list.filter((s) => s.contact).length, gr.list.length), bounce: gr.list.filter((s) => s.bounce).length }))
        .filter((gr) => gr.list.length >= Math.max(8, L.length * 0.05));
      if (srcs.length >= 2 && a.contact >= 3) {
        const best = srcs.slice().sort((x, y) => y.rate - x.rate)[0];
        if (best.rate > avgRate * 1.3) add('good', `<b>${esc(best.name)}</b> es tu mejor origen: el ${p1(best.rate)} de sus visitas te escribe (el promedio es ${p1(avgRate)}). Vale la pena publicar o invertir más ahí.`, 7);
        const weak = srcs.filter((gr) => gr.list.length >= L.length * 0.1 && gr.rate < avgRate * 0.6 && gr !== best)[0];
        if (weak) add('warn', `<b>${esc(weak.name)}</b> trae el ${pct(weak.list.length, L.length)}% de las visitas, pero ${weak.rate ? `solo el ${p1(weak.rate)} te escribe` : 'ninguna te escribió'} y el ${pct(weak.bounce, weak.list.length)}% se va enseguida. Revisa que la publicación y la página prometan lo mismo.`, 6);
      }

      const mob = L.filter((s) => s.device === 'móvil'), desk = L.filter((s) => s.device === 'computador');
      if (mob.length >= 15 && desk.length >= 10) {
        const rm = rate(mob.filter((s) => s.contact).length, mob.length), rd = rate(desk.filter((s) => s.contact).length, desk.length);
        if (rd > 0 && rm < rd * 0.7) add('warn', `En celular te escriben menos (<b>${p1(rm)}</b> frente a <b>${p1(rd)}</b> en computador), y el ${pct(mob.length, L.length)}% te visita desde el celular. Revisa que el botón de WhatsApp se vea siempre en pantallas pequeñas.`, 6);
        else add('tip', `El <b>${pct(mob.length, L.length)}%</b> te visita desde el celular: cualquier cambio, pruébalo primero ahí.`, 1);
      }
      const ml = median(mob.filter((s) => s.load).map((s) => s.load));
      if (ml > 3000) add('warn', `En celular la web tarda <b>${secs(ml)}</b> en cargar (lo típico). Por encima de 3 s mucha gente se va: revisa imágenes y videos pesados.`, 6);

      const P = L.filter((s) => s.planes);
      if (P.length >= 10) {
        const rows = offerRows(L);
        const top = rows.slice().sort((x, y) => y.intents - x.intents)[0];
        if (top && top.intents >= 3) add('good', `<b>${top.o.name}</b> es lo que más piden: ${n(top.intents)} ${top.intents === 1 ? 'visita pidió' : 'visitas pidieron'} información. Destácalo en tus publicaciones.`, 6);
        const seenRows = rows.filter((r) => r.views >= 15);
        const avgConv = mean(seenRows.map((r) => r.conv / r.views));
        const cold = P.length < 25 ? null : seenRows.filter((r) => r.views >= P.length * 0.3 && r.conv / r.views < avgConv * 0.5).sort((x, y) => y.views * (y.time || 1) - x.views * (x.time || 1))[0];
        if (cold) add('tip', `<b>${cold.o.name}</b> se mira mucho (${pct(cold.views, P.length)}% de quienes abren planes${cold.time ? `, ${dur(cold.time)} en promedio` : ''}) pero casi nadie pide información. Quizá le falta un ejemplo de resultados o una opción de pago por partes.`, 5);
        const direct = P.filter((s) => s.src === 'Directo').length;
        if (direct / P.length > 0.5) add('tip', `El ${pct(direct, P.length)}% de quienes abren planes y precios llega sin origen. Cuando mandes la página por WhatsApp, usa un enlace con campaña.` + go('origen', 'Crear enlace'), 3);
      }
      if (L.length >= 30) {
        const t = bestTime(L);
        add('tip', `Te visitan más los <b>${t.day}</b>, y la franja con más visitas es de <b>${t.from} a ${t.to}</b>. Publica en redes un poco antes.`, 4);
      }
      const faq = countBy(L.flatMap((s) => s.interacts.filter((x) => x.startsWith('h:Pregunta · '))), (x) => strip(x).slice(11))[0];
      if (faq && faq[1] >= 5) add('tip', `La pregunta que más abren es <b>«${esc(faq[0])}»</b> (${n(faq[1])} veces). Es la duda principal: deja muy claro cómo pedir esa información por WhatsApp.`, 3);
      if (L.length >= 20 && a.back / a.n >= 0.15) add('tip', `El <b>${pct(a.back, a.n)}%</b> de las visitas son personas que ya habían venido: tienen interés. Un anuncio de remarketing o un mensaje de seguimiento puede traerlas de vuelta.`, 3);
      const h3 = H.filter((s) => s.is3d && s.dur), hl = H.filter((s) => !s.is3d && s.dur);
      if (h3.length >= 10 && hl.length >= 10) {
        const x = mean(h3.map((s) => s.dur)), y = mean(hl.map((s) => s.dur));
        if (y && x > y * 1.15) add('good', `Quienes ven la versión 3D se quedan <b>${pct(x - y, y)}% más tiempo</b> (${dur(x)} frente a ${dur(y)}).`, 2);
      }
    }
    if (!out.length) add('tip', 'Todo en orden por ahora. Cuando lleguen más visitas, aquí verás qué mejorar primero: dónde se van, qué origen te trae más clientes y qué plan piden más.', 0);
    const LABEL = { good: '✓ Bien', warn: '! Atención', tip: 'Idea' };
    $('#adm-insights').innerHTML = out.sort((x, y) => y.weight - x.weight).slice(0, 7)
      .map((i) => `<li class="${i.tone}"><em>${LABEL[i.tone]}</em><p>${i.html}</p></li>`).join('');
  }

  // ---------- METAS DEL MES ----------
  const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };
  const monthKey = () => ymd(monthStart());
  function goalFor() {
    const k = monthKey();
    if (!goals[k] && demo) goals[k] = { month: k, visits: 1000, contacts: 45, sales: 14, revenue: 18000000 };
    return goals[k] || { month: k };
  }
  // cuánto llevas este mes, día por día (visitas y contactos del resumen diario; ventas de los contactos)
  function monthDays() {
    const ms = monthStart(), now = new Date(), dim = new Date(ms.getFullYear(), ms.getMonth() + 1, 0).getDate(), today = now.getDate();
    const rows = Array.from({ length: dim }, (_, i) => ({ d: i + 1, visits: 0, contacts: 0, sales: 0, revenue: 0 }));
    let hasDaily = false;
    if (daily) {
      hasDaily = true;
      for (const r of daily) { const d = parseYmd(r.day); if (d >= ms && d.getMonth() === ms.getMonth()) { rows[d.getDate() - 1].visits += r.visits; rows[d.getDate() - 1].contacts += r.contacts; } }
    } else if (W && W.prevStart <= ms) {
      hasDaily = true;
      for (const s of cur.concat(prev)) if (s.start >= ms) { rows[s.start.getDate() - 1].visits++; if (s.contact) rows[s.start.getDate() - 1].contacts++; }
    }
    for (const l of leads) if (l.status === 'ganado' && l._closed && l._closed >= ms) { const r = rows[l._closed.getDate() - 1]; if (r) { r.sales++; r.revenue += Number(l.value) || 0; } }
    const elapsed = (today - 1 + (now - startOf(now)) / 864e5) / dim;
    return { rows, dim, today, elapsed, hasDaily };
  }
  function goalState() {
    if (!leadsOk && !daily) return null;
    const md = monthDays(), g = goalFor(), m = {};
    for (const key of ['visits', 'contacts', 'sales', 'revenue']) {
      const actual = md.rows.reduce((a, r) => a + r[key], 0), goal = Number(g[key]) || 0;
      m[key] = { actual, goal, proj: md.elapsed > 0 ? actual / md.elapsed : actual, ok: key === 'sales' || key === 'revenue' ? leadsOk : md.hasDaily };
    }
    return { m, ...md };
  }
  const GOALS = [['visits', 'Visitas', n], ['contacts', 'Contactos', n], ['sales', 'Ventas', n], ['revenue', 'Ingresos', moneyShort]];
  function renderGoals() {
    const ms = monthStart();
    $('#adm-goals-title').textContent = 'Metas de ' + ms.toLocaleDateString('es-CO', { month: 'long' });
    const st = goalState();
    const box = $('#adm-goals');
    if (!st) {
      $('#adm-goals-sub').textContent = '';
      box.innerHTML = `<li class="adm-empty">${goalsOk === false || dailyOk === false ? 'Para usar las metas, vuelve a ejecutar <code>supabase-setup.sql</code> en Supabase.' : EMPTY}</li>`;
      lineChart($('#adm-goals-chart'), { labels: [], tips: [], series: [], empty: ' ' });
      return;
    }
    const elapsed = st.elapsed;
    $('#adm-goals-sub').textContent = `vas en el día ${st.today} de ${st.dim}` + (goalsOk === false ? ' · para guardarlas, vuelve a ejecutar supabase-setup.sql' : '');
    box.innerHTML = GOALS.map(([key, name, fmt]) => {
      const r = st.m[key];
      if (!r.ok) return `<li data-goal="${key}" tabindex="0" role="button" aria-pressed="${key === goalMetric}"><div class="adm-goal-top"><span>${name}</span><b>—</b></div><p class="adm-goal-note">Falta un paso en Supabase para medir esto.</p></li>`;
      let chip = '', note = '';
      if (r.goal) {
        const state = r.proj >= r.goal ? ['st-good', '✓ Vas bien'] : r.proj >= r.goal * 0.85 ? ['st-warn', '! Casi'] : ['st-bad', '↓ Por debajo'];
        chip = `<span class="adm-chip-st ${state[0]}">${state[1]}</span>`;
        note = `A este ritmo: ~${fmt(r.proj)} al final del mes · hoy deberías llevar ${fmt(r.goal * elapsed)}`;
      } else note = 'Sin meta. Ponle una con «Editar metas».';
      return `<li data-goal="${key}" tabindex="0" role="button" aria-pressed="${key === goalMetric}">
        <div class="adm-goal-top"><span>${name}</span><b>${fmt(r.actual)}</b>${r.goal ? `<small>de ${fmt(r.goal)}</small>` : ''}</div>${chip}
        ${r.goal ? `<div class="adm-goal-bar" style="--w:${Math.min(1, r.actual / r.goal).toFixed(3)};--p:${Math.min(1, elapsed).toFixed(3)}"><i></i><u title="Dónde deberías ir hoy"></u></div>` : ''}
        <p class="adm-goal-note">${note}</p></li>`;
    }).join('');
    // la línea del mes: lo que llevas acumulado frente al camino a la meta
    const [key, name, fmt] = GOALS.find((x) => x[0] === goalMetric);
    const r = st.m[key];
    let acc = 0;
    const real = st.rows.map((x, i) => (i + 1 > st.today ? null : (acc += x[key])));
    const series = [{ name: name + ' acumulados', values: real, cls: 'main' }];
    if (r.goal) series.push({ name: 'Camino a la meta', values: real.map((_, i) => r.goal * (i + 1) / st.dim), cls: 'goal' });
    const labels = real.map((_, i) => String(i + 1)), tips = real.map((_, i) => cap(new Date(ms.getFullYear(), ms.getMonth(), i + 1).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })));
    lineChart($('#adm-goals-chart'), { labels, tips, col: 'Día', series, fmt, kind: key === 'revenue' ? 'money' : 'int', area: true, h: 200, zeroOk: true, label: name + ' del mes', empty: r.ok ? EMPTY : 'Falta un paso en Supabase para medir esto.' });
  }
  function fillGoalForm() {
    const g = goalFor(), f = $('#adm-goals-form');
    ['visits', 'contacts', 'sales', 'revenue'].forEach((k) => { f.elements[k].value = g[k] != null ? Math.round(g[k]) : ''; });
  }
  $('#adm-goals-edit').addEventListener('click', () => {
    const f = $('#adm-goals-form');
    f.hidden = !f.hidden;
    if (!f.hidden) { fillGoalForm(); f.elements.visits.focus(); }
  });
  $('#adm-goals-cancel').addEventListener('click', () => { $('#adm-goals-form').hidden = true; });
  $('#adm-goals-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, row = { month: monthKey() };
    ['visits', 'contacts', 'sales', 'revenue'].forEach((k) => { const v = f.elements[k].value.trim(); row[k] = v === '' ? null : Math.max(0, Math.round(Number(v)) || 0); });
    if (!demo) {
      const { error } = await sb.from('goals').upsert(row);
      if (error) { toast('No se pudieron guardar las metas. Revisa que ejecutaste supabase-setup.sql.', null, true); return; }
      goalsOk = true;
    }
    goals[row.month] = row;
    f.hidden = true;
    renderGoals();
    renderInsights();
    say('Metas guardadas');
  });
  $('#adm-goals').addEventListener('click', (e) => {
    const li = e.target.closest('[data-goal]');
    if (!li) return;
    goalMetric = li.dataset.goal;
    renderGoals();
  });
  $('#adm-goals').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-goal]')) { e.preventDefault(); e.target.click(); } });

  // ---------- ACTIVIDAD EN VIVO ----------
  function feedFromSession(s) {
    const where = s.planes && !s.home ? ' a planes y precios' : '';
    if (s.contact) {
      const o = [...s.intents].map((i) => OFFERS[i].name)[0];
      return { t: s.last, icon: 'chat', ok: true, html: `<b>Te escribió por ${esc(s.channel)}</b>${o ? ' · ' + esc(o) : ''}`, sub: s.src + ' · ' + s.device };
    }
    return { t: s.last, icon: 'eye', html: `<b>Visita${where}</b> desde ${esc(s.src)}`, sub: [s.device, s.path.length ? s.path.length + (s.path.length === 1 ? ' sección' : ' secciones') : '', s.dur ? dur(s.dur) : ''].filter(Boolean).join(' · ') };
  }
  function feedFromEvent(e) {
    const t = new Date(e.created_at || Date.now()), pre = isPlanes(e.page) ? 'p:' : 'h:', dev = e.device || '';
    if (e.type === 'pageview') return { t, icon: 'eye', html: `<b>Nueva visita${isPlanes(e.page) ? ' a planes y precios' : ''}</b> desde ${esc(source(e))}`, sub: dev };
    if (e.type === 'click' && CONTACT.test(e.label || '')) {
      const o = OFFERS.find((x) => x.re.test(e.label));
      return { t, icon: 'chat', ok: true, html: `<b>Te escribió por ${esc(e.label.split(' ')[0])}</b>${o ? ' · ' + esc(o.name) : ''}`, sub: dev };
    }
    if (e.type === 'section' && /^(packs|contacto|plan-|auto-|comparar)/.test(e.label || '')) return { t, icon: 'go', html: `Está viendo <b>${esc(NAMES.get(pre + e.label) || e.label)}</b>`, sub: dev };
    if (e.type === 'interact' && e.label) {
      const m = e.label.match(/^Demo · ([\w-]+) · /), o = m && OFFERS.find((x) => x.ids.includes(m[1]));
      if (o) return { t, icon: 'tap', html: `Tocó la demo de <b>${esc(o.name)}</b>`, sub: dev };
      if (e.label.startsWith('Pregunta · ')) return { t, icon: 'tap', html: `Abrió la pregunta <b>«${esc(e.label.slice(11))}»</b>`, sub: dev };
      const tu = e.label.match(/^Tutorial · (.+) · (.+)$/);
      if (tu) return { t, icon: 'tap', html: `Está viendo el tutorial <b>«${esc(tu[1])}»</b>`, sub: 'paso: ' + tu[2] + (dev ? ' · ' + dev : '') };
      if (e.label.startsWith('Planes · ir a ')) return { t, icon: 'go', html: `Fue al plan <b>${esc(e.label.slice(14))}</b>`, sub: dev };
      if (/formulario|panel de ejemplo/i.test(e.label)) return { t, icon: 'tap', html: `<b>${esc(e.label)}</b>`, sub: dev };
      return null;
    }
    if (e.type === 'leave' && e.duration >= 10) return { t, icon: 'out', html: `Salió después de <b>${dur(e.duration)}</b>`, sub: e.scroll ? 'bajó el ' + e.scroll + '% de la página' : dev };
    return null;
  }
  function pushFeed(item) {
    if (!item) return;
    item.fresh = true;
    feed.unshift(item);
    feed.length = Math.min(feed.length, 40);
    renderFeed();
  }
  function seedFeed() {
    feed.length = 0;
    cur.slice().sort((a, b) => b.last - a.last).slice(0, 14).forEach((s) => feed.push(feedFromSession(s)));
  }
  function renderFeed() {
    $('#adm-feed').innerHTML = feed.length ? feed.slice(0, 14).map((f) => `<li class="${f.ok ? 'ok' : ''}${f.fresh ? ' is-new' : ''}"><span class="fi">${ICON[f.icon]}</span><p>${f.html}${f.sub ? `<small>${esc(f.sub)}</small>` : ''}</p><time datetime="${f.t.toISOString()}">${ago(f.t)}</time></li>`).join('')
      : '<li class="adm-empty">Aún no hay actividad en este periodo.</li>';
    feed.forEach((f) => { f.fresh = false; });
  }
  function feedState() {
    const el = $('#adm-feed-state');
    const on = demo || rtOn;
    el.classList.toggle('off', !on);
    el.innerHTML = '<i></i>' + (demo ? 'En vivo (ejemplo)' : rtOn ? 'En vivo' : 'Cada minuto');
    el.title = on ? 'Las visitas y los contactos aparecen al instante' : 'Sin conexión en vivo: se actualiza cada minuto. Para verlo al instante, vuelve a ejecutar supabase-setup.sql.';
    $('#adm-feed-sub').textContent = on ? 'aparece al instante lo que pasa en tu web' : 'lo último que pasó en tu web';
  }
  function updateLive() {
    const now = Date.now();
    for (const [k, t] of live) if (now - t > 5 * 6e4) live.delete(k);
    $('#adm-live').textContent = n(live.size);
  }
  function onEvent(e) {
    live.set(e.session, Date.now());
    updateLive();
    pushFeed(feedFromEvent(e));
  }
  function onLeadChange(p) {
    if (p.eventType === 'DELETE') {
      const id = p.old && p.old.id;
      leads = leads.filter((l) => l.id !== id);
    } else {
      const l = prepLead({ ...p.new });
      const i = leads.findIndex((x) => x.id === l.id);
      if (i < 0) {
        leads.unshift(l);
        if (p.eventType === 'INSERT') newLeadToast(l);
      } else if (!editing()) {
        // el formulario completa una fila que el clic ya había creado: también se avisa
        if (isForm(l) && l.name && !leads[i].name) newLeadToast(l);
        leads[i] = l;
      }
    }
    leadBySession = new Map(leads.filter((l) => l.session).map((l) => [l.session, l]));
    renderContactos();
  }
  const leadToasts = new Map();
  function newLeadToast(l) {
    if (isForm(l)) {
      // si el clic llegó antes que los datos, el aviso con el nombre reemplaza al primero
      const old = leadToasts.get(l.id);
      if (old) old.remove();
      leadToasts.set(l.id, toast(`<b>Nuevo formulario${l.name ? ': ' + esc(l.name) : ''}</b>${l.business ? '<br><small>' + esc(l.business) + '</small>' : ''}`, { label: 'Ver', run: () => openForm(l.id) }));
      return;
    }
    toast(`<b>Nuevo contacto por ${esc(l.channel)}</b>${l._plan ? ' · ' + esc(l._plan) : ''}<br><small>${esc(l._src)}</small>`, { label: 'Ver', run: () => openLead(l.id) });
  }
  function startRealtime() {
    if (demo || !sb || rt) return;
    try {
      rt = sb.channel('panel-admin')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (p) => onEvent(p.new))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, onLeadChange)
        .subscribe((status) => { rtOn = status === 'SUBSCRIBED'; feedState(); });
    } catch (e) { rtOn = false; feedState(); }
  }
  async function stopRealtime() {
    if (rt && sb) { try { await sb.removeChannel(rt); } catch (e) {} }
    rt = null;
    rtOn = false;
  }
  // en el modo demostración, la actividad en vivo se simula para ver cómo se siente
  function demoTick() {
    if (!demo || $('#adm').hidden) return;
    if (!document.hidden) {
      const SID = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'], sid = SID[Math.floor(Math.random() * SID.length)];
      const r = Math.random(), dev = Math.random() < 0.65 ? 'móvil' : 'computador';
      const refs = [{ referrer: 'l.instagram.com' }, { referrer: 'google.com' }, {}, { utm_source: 'tiktok' }, { utm_source: 'whatsapp', utm_campaign: 'propuesta-octubre' }];
      const now = new Date().toISOString();
      let e;
      if (r < 0.32) e = { type: 'pageview', page: Math.random() < 0.2 ? '/planes.html' : '/', device: dev, ...refs[Math.floor(Math.random() * refs.length)] };
      else if (r < 0.55) e = { type: 'section', page: '/', label: ['packs', 'contacto'][Math.floor(Math.random() * 2)], device: dev };
      else if (r < 0.72) e = { type: 'interact', page: '/', label: ['Demo · ejemplo-pro · Reservas', 'Demo · ejemplo-start · Google', 'Pregunta · ¿Cuánto cuesta mi página?', 'Tutorial · Una web que trabaja por ti · Responde', 'Planes · ir a Pro'][Math.floor(Math.random() * 5)], device: dev };
      else if (r < 0.93) e = { type: 'leave', page: '/', duration: Math.round(20 + Math.random() * 200), scroll: Math.round(30 + Math.random() * 70), device: dev };
      else {
        const o = OFFERS[[0, 1, 2, 2, 3, 6][Math.floor(Math.random() * 6)]], form = Math.random() < 0.4;
        e = form ? { type: 'click', page: '/', label: 'Formulario enviado', device: dev } : { type: 'click', page: '/planes.html', label: 'WhatsApp · Vi los planes y me interesa el ' + o.name, device: dev };
        const l = prepLead({
          id: Date.now(), created_at: now, updated_at: now, closed_at: null, session: 'demo-' + Date.now(), visitor: 'v-demo', channel: form ? 'Formulario' : 'WhatsApp', label: e.label, page: e.page,
          referrer: 'l.instagram.com', device: dev, status: 'nuevo', name: null, contact: null, value: null, next_at: null, notes: null,
          ...(form ? { ...DEMO_FORMS[Math.floor(Math.random() * DEMO_FORMS.length)], consent_at: now } : {})
        });
        leads.unshift(l);
        demoLeads().unshift(l);
        newLeadToast(l);
        renderContactos();
      }
      onEvent({ ...e, session: sid, created_at: now });
    }
    setTimeout(demoTick, 6000 + Math.random() * 7000);
  }

  // ---------- RENDIMIENTO ----------
  function renderHist() {
    const el = $('#adm-hist-chart');
    $$('#adm-hist-metric button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.metric === histMetric)));
    if (!daily) {
      lineChart(el, { labels: [], tips: [], series: [], empty: dailyOk === false ? 'Para ver los últimos 12 meses, vuelve a ejecutar <code>supabase-setup.sql</code> en Supabase (crea el resumen diario).' : 'Cargando…' });
      return;
    }
    const today = startOf(new Date()), mon = addDays(today, -((today.getDay() + 6) % 7)), first = addDays(mon, -52 * 7);
    const weeks = Array.from({ length: 53 }, (_, k) => ({ d: addDays(first, k * 7), visits: 0, contacts: 0, bounces: 0, active: 0, timed: 0 }));
    for (const r of daily) {
      const k = Math.floor(Math.round((parseYmd(r.day) - first) / 864e5) / 7);
      if (k < 0 || k > 52) continue;
      const w = weeks[k];
      w.visits += r.visits; w.contacts += r.contacts; w.bounces += r.bounces; w.active += r.active; w.timed += r.timed;
    }
    const M = {
      visits: ['Visitas', 'int', n, (w) => w.visits], contacts: ['Te escriben', 'int', n, (w) => w.contacts],
      conv: ['Conversión', 'pct', pf, (w) => (w.visits ? w.contacts / w.visits * 100 : null)],
      bounce: ['Se van enseguida', 'pct', pf, (w) => (w.visits ? w.bounces / w.visits * 100 : null)],
      time: ['Tiempo activo', 'time', dur, (w) => (w.timed ? w.active / w.timed : null)]
    }[histMetric];
    const firstData = weeks.findIndex((w) => w.visits > 0);
    const values = weeks.map((w, k) => (firstData < 0 || k < firstData ? null : M[3](w)));
    const total = weeks.reduce((a, w) => a + w.visits, 0), totalC = weeks.reduce((a, w) => a + w.contacts, 0);
    $('#adm-hist-sub').textContent = `semana por semana · ${n(total)} visitas y ${n(totalC)} contactos en el último año`;
    lineChart(el, {
      labels: weeks.map((w) => shortDate(w.d)), col: 'Semana',
      tips: weeks.map((w, k) => 'Semana del ' + w.d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) + (k === 52 ? ' (en curso)' : '')),
      series: [{ name: M[0], values, cls: 'main' }], fmt: M[2], kind: M[1], area: true, peak: true, h: 260, zeroOk: M[1] !== 'int', label: M[0] + ' por semana, último año'
    });
  }
  const PERF = [
    ['conv', 'Conversión', '% de visitas que te escribe'],
    ['time', 'Tiempo activo', 'promedio por visita'],
    ['bounce', 'Se van enseguida', 'sin pasar de la portada · mientras más baja, mejor'],
    ['plans', 'Ven los planes', '% de visitas que llega a los planes'],
    ['speed', 'Velocidad de carga', 'tiempo típico en cargar · mientras más baja, mejor'],
    ['newback', 'Nuevas y recurrentes', 'visitas de personas nuevas y de quienes vuelven']
  ];
  function renderRendimiento() {
    renderHist();
    const box = $('#adm-perf');
    if (!box.children.length) {
      box.innerHTML = PERF.map(([id, title, desc]) => `<section class="adm-card glass"><div class="adm-pc-head"><div><h2>${title}</h2><p>${desc}</p></div><div class="adm-pc-val" id="pv-${id}"></div></div><div class="adm-lc adm-lc-sm" id="pc-${id}"></div></section>`).join('');
    }
    const a = summary(cur), b = summary(prev), hp = b.n > 0;
    const head = (id, v, d) => { $('#pv-' + id).innerHTML = `<strong>${v}</strong>${d || ''}`; };
    head('conv', p1(rate(a.contact, a.n)), pdelta(rate(a.contact, a.n), rate(b.contact, b.n), hp));
    head('time', dur(a.avg), delta(a.avg, b.avg));
    head('bounce', pct(a.bounce, a.n) + '%', pdelta(rate(a.bounce, a.n), rate(b.bounce, b.n), hp, true));
    head('plans', pct(a.seesPlans, a.n) + '%', pdelta(rate(a.seesPlans, a.n), rate(b.seesPlans, b.n), hp));
    for (const id of ['conv', 'time', 'bounce', 'plans']) {
      const m = METRICS[id];
      const series = [{ name: 'Este periodo', values: curSeries(m.fn), cls: 'main', sub: B.longs.map(() => 'Este periodo') }];
      if (compare) series.push({ name: 'Periodo anterior', values: prevSeries(m.fn), cls: 'prev', sub: B.prevLongs });
      lineChart($('#pc-' + id), { labels: B.labels, tips: B.longs, col: cap(B.word), series, fmt: m.fmt, kind: m.kind, area: true, h: 200, zeroOk: true, label: m.name });
    }
    const loadOf = (dev) => (l) => { const v = l.filter((s) => s.device === dev && s.load).map((s) => s.load); return v.length ? median(v) / 1000 : null; };
    const ml = median(cur.filter((s) => s.load).map((s) => s.load)), mlp = median(prev.filter((s) => s.load).map((s) => s.load));
    head('speed', ml ? secs(ml) : '—', ml && mlp ? delta(ml, mlp, true) : '');
    lineChart($('#pc-speed'), {
      labels: B.labels, tips: B.longs, col: cap(B.word), fmt: sec1, kind: 'secs', h: 200, ends: true, label: 'Velocidad de carga',
      series: [{ name: 'Celular', values: curSeries(loadOf('móvil')), cls: 's1' }, { name: 'Computador', values: curSeries(loadOf('computador')), cls: 's2' }]
    });
    head('newback', pct(a.n - a.back, a.n) + '% nuevas', '');
    lineChart($('#pc-newback'), {
      labels: B.labels, tips: B.longs, col: cap(B.word), fmt: n, kind: 'int', h: 200, ends: true, label: 'Nuevas y recurrentes',
      series: [{ name: 'Nuevas', values: curSeries((l) => l.filter((s) => !s.back).length), cls: 's1' }, { name: 'Vuelven', values: curSeries((l) => l.filter((s) => s.back).length), cls: 's2' }]
    });
  }

  // ---------- CONTACTOS ----------
  const inCur = (d) => !!d && d >= W.start;
  const inPrev = (d) => !!d && d >= W.prevStart && d < W.prevEnd;
  const won = (l) => l.status === 'ganado';
  const sumValue = (l) => l.reduce((a, x) => a + (Number(x.value) || 0), 0);
  function renderContactos() {
    if (!W) return;
    const badge = $('#adm-badge'), waiting = leads.filter((l) => l.status === 'nuevo').length;
    badge.hidden = !leadsOk || !waiting;
    badge.textContent = waiting > 99 ? '99+' : String(waiting);
    if (leadsOk === false) {
      $('#adm-ld-kpis').innerHTML = '';
      $('#adm-leads').innerHTML = '<p class="adm-empty">Para usar el seguimiento de contactos, vuelve a ejecutar <code>supabase-setup.sql</code> en Supabase. Desde ese momento, cada clic en WhatsApp, Instagram, correo o el formulario aparece aquí solo.</p>';
      ['#adm-ld-today', '#adm-ld-plans', '#adm-ld-sources'].forEach((s) => { $(s).innerHTML = ''; });
      $('#adm-ld-pipe').innerHTML = '';
      lineChart($('#adm-ld-chart'), { labels: [], tips: [], series: [], empty: 'Falta un paso en Supabase.' });
      renderForms();
      return;
    }
    const C = leads.filter((l) => inCur(l._created)), Cp = leads.filter((l) => inPrev(l._created));
    const closed = leads.filter((l) => inCur(l._closed)), closedP = leads.filter((l) => inPrev(l._closed));
    const wonC = closed.filter(won), wonP = closedP.filter(won), quoted = leads.filter((l) => l.status === 'cotizado');
    const cr = (l) => (l.length ? l.filter(won).length / l.length : 0);
    const spCreated = curSeries((l) => l.length, leads, (l) => l._created), spWon = curSeries((l) => l.length, leads.filter(won), (l) => l._closed);
    kpis($('#adm-ld-kpis'), [
      K('Contactos nuevos', n(C.length), delta(C.length, Cp.length), 'te escribieron en el periodo', spCreated),
      K('Sin responder', n(waiting), '', waiting ? 'esperan tu respuesta' : 'todo respondido'),
      K('En cotización', moneyShort(sumValue(quoted)), '', n(quoted.length) + (quoted.length === 1 ? ' cotización abierta' : ' cotizaciones abiertas')),
      K('Ventas cerradas', n(wonC.length), delta(wonC.length, wonP.length), 'en el periodo', spWon),
      K('Ingresos', moneyShort(sumValue(wonC)), delta(sumValue(wonC), sumValue(wonP)), 'de las ventas cerradas', curSeries((l) => sumValue(l), leads.filter(won), (l) => l._closed)),
      K('Tasa de cierre', p1(cr(closed)), pdelta(cr(closed), cr(closedP), closedP.length > 0), n(closed.length) + ' contactos cerrados (ganados o perdidos)')
    ]);
    $('#adm-ld-chart-sub').textContent = 'por ' + B.word + ' · contactos que llegan y ventas que cierras';
    lineChart($('#adm-ld-chart'), {
      labels: B.labels, tips: B.longs, col: cap(B.word), fmt: n, kind: 'int', h: 260, ends: true, label: 'Contactos y ventas',
      series: [{ name: 'Contactos nuevos', values: spCreated, cls: 's1' }, { name: 'Ventas cerradas', values: spWon, cls: 's2' }]
    });
    renderToday();
    renderPipe();
    renderLeadList();
    const byPlan = groupBy(wonC, (l) => l._plan || 'Sin plan definido');
    $('#adm-ld-plans').innerHTML = bars(byPlan.map((g) => [g.name, g.list.length, sumValue(g.list)]), 0, (v, k) => `${n(v)} <small>${moneyShort(k)}</small>`);
    const bySrc = groupBy(C, (l) => l._src).slice(0, 8);
    $('#adm-ld-sources').innerHTML = bars(bySrc.map((g) => [g.name, g.list.length, g.list.filter(won).length]), 0, (v, k) => `${n(v)} <small>${n(k)} ${k === 1 ? 'venta' : 'ventas'}</small>`);
    renderForms();
  }
  function todayItems() {
    const today = ymd(new Date()), out = [];
    for (const l of leads) {
      if (!OPEN.has(l.status)) continue;
      if (l.next_at && l.next_at <= today) {
        const late = Math.round((parseYmd(today) - parseYmd(l.next_at)) / 864e5);
        out.push({ l, w: 2e12 + late, why: late ? `Seguimiento atrasado ${late} ${late === 1 ? 'día' : 'días'}` : 'Seguimiento para hoy' });
      } else if (l.status === 'nuevo' && !l.next_at && Date.now() - l._created > 2 * 36e5) out.push({ l, w: 1e12 + (Date.now() - l._created) / 1e3, why: 'Sin responder · te escribió ' + ago(l._created) });
    }
    return out.sort((a, b) => b.w - a.w);
  }
  const who = (l) => l.name || (l.channel + (l._plan ? ' · ' + l._plan : ''));
  function renderToday() {
    const items = todayItems();
    $('#adm-ld-today').innerHTML = items.length
      ? items.slice(0, 6).map(({ l, why }) => `<li><p><b>${esc(who(l))}</b><small>${esc(why)}</small></p><button class="btn btn-glass glass btn-sm" type="button" data-open-lead="${l.id}">Abrir</button></li>`).join('')
        + (items.length > 6 ? `<li><p><small>y ${n(items.length - 6)} más</small></p><button class="btn btn-glass glass btn-sm" type="button" data-filter-open>Ver todos</button></li>` : '')
      : '<li><p><b>Todo al día.</b><small>No hay seguimientos pendientes ni contactos sin responder.</small></p></li>';
  }
  function leadScope() {
    const when = $('#lf-when').value, ch = $('#lf-channel').value, q = $('#lf-q').value.trim().toLowerCase();
    return leads.filter((l) => (when === 'todo' || inCur(l._created)) && (!ch || l.channel === ch)
      && (!q || [l.name, l.contact, l.notes, l._plan, l._src, l.channel, l.label, l.utm_campaign, l.business, l.message].some((x) => x && String(x).toLowerCase().includes(q))));
  }
  function renderPipe() {
    const scope = leadScope(), st = $('#lf-status').value;
    const max = Math.max(1, ...STATUS.map(([k]) => scope.filter((l) => l.status === k).length));
    $('#adm-ld-pipe').innerHTML = STATUS.map(([k, name]) => {
      const l = scope.filter((x) => x.status === k), v = sumValue(l);
      return `<button type="button" data-stage="${k}" aria-pressed="${st === k}"><span><i class="st-dot st-${k}"></i>${name}</span><strong>${n(l.length)}</strong><small>${v ? moneyShort(v) : k === 'nuevo' ? 'por responder' : '—'}</small><span class="pipe-bar st-${k}"><i style="--w:${(l.length / max).toFixed(3)}"></i></span></button>`;
    }).join('');
  }
  function leadRow(l) {
    const today = ymd(new Date()), due = OPEN.has(l.status) && l.next_at && l.next_at <= today;
    const sub = [l.channel, l.business, l._plan && (l._guess ? 'vio ' + l._plan : l._plan)].filter(Boolean).join(' · ');
    return `<article class="adm-lead${openLeads.has(l.id) ? ' is-open' : ''}" data-id="${l.id}">
      <div class="adm-lead-main">
        <span class="ld-when">${shortDate(l._created)}<small>${ago(l._created)}</small></span>
        <span class="ld-who"><b class="${l.name ? '' : 'is-empty'}">${esc(l.name || 'Sin nombre')}</b><small>${esc(sub)}</small></span>
        <span class="ld-src">${esc(l._src)}<small>${esc(l.utm_campaign || l.device || '')}</small></span>
        <span class="ld-status"><select class="adm-in adm-in-select st-sel st-${l.status}" data-f="status" aria-label="Estado">${STATUS.map(([k, name]) => `<option value="${k}"${k === l.status ? ' selected' : ''}>${name}</option>`).join('')}</select></span>
        <label class="ld-value"><span>$</span><input class="adm-in" data-f="value" inputmode="numeric" autocomplete="off" placeholder="${l._price ? n(l._price) : 'Valor'}" value="${l.value != null && l.value !== '' ? n(l.value) : ''}" aria-label="Valor de la venta"></label>
        <span class="ld-next"><input class="adm-in${due ? ' is-due' : ''}" type="date" data-f="next_at" value="${esc(l.next_at || '')}" aria-label="Próximo seguimiento" title="Próximo seguimiento"></span>
        <button class="ld-more" type="button" aria-expanded="${openLeads.has(l.id)}" aria-label="Ver más">${ICON.down}</button>
      </div>${openLeads.has(l.id) ? leadMore(l) : ''}
    </article>`;
  }
  function leadMore(l) {
    const facts = [
      ['Botón que tocó', l.label || '—'], ['Página', l.page ? (isPlanes(l.page) ? 'Planes y precios' : 'Web principal') : '—'],
      ['Llegó desde', l.referrer || l.utm_source || (l.session ? 'Directo' : 'Agregado a mano')], ['Campaña', [l.utm_campaign, l.utm_medium].filter(Boolean).join(' · ') || '—'],
      ['Dispositivo', l.device || '—'], ['Te escribió', l._created.toLocaleString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })],
      ['Cerrado', l._closed ? l._closed.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—']
    ];
    // lo que escribió en el formulario
    if (l.business) facts.unshift(['Negocio', l.business]);
    if (l.link) facts.push(['Su negocio en internet', l.link]);
    if (l.message) facts.push(['Mensaje', l.message]);
    const plans = '<option value="">' + (l._plan && !l.plan ? `Automático: ${esc(l._plan)}` : 'Sin definir') + '</option>' + OFFERS.map((o) => `<option${o.name === l.plan ? ' selected' : ''}>${o.name}</option>`).join('');
    return `<div class="adm-lead-more">
      <label class="adm-field"><span>Nombre</span><input data-f="name" maxlength="120" autocomplete="off" value="${esc(l.name || '')}"></label>
      <label class="adm-field"><span>Teléfono, @ o correo</span><input data-f="contact" maxlength="160" autocomplete="off" value="${esc(l.contact || '')}"></label>
      <label class="adm-field"><span>Plan que le interesa</span><select data-f="plan">${plans}</select></label>
      <label class="adm-field adm-field-wide"><span>Notas</span><textarea data-f="notes" maxlength="4000" placeholder="Qué pidió, qué le ofreciste, cuándo volver a escribirle…">${esc(l.notes || '')}</textarea></label>
      <dl class="adm-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <div class="adm-lead-actions"><small>Los cambios se guardan solos.</small><button class="adm-del" type="button" data-del>Eliminar contacto</button></div>
    </div>`;
  }
  function leadList() {
    const st = $('#lf-status').value;
    return leadScope().filter((l) => !st || (st === 'abiertos' ? OPEN.has(l.status) : l.status === st)).sort((a, b) => b._created - a._created);
  }
  function renderLeadList() {
    const box = $('#adm-leads');
    if (box.contains(document.activeElement)) return;   // está escribiendo: no se le borra nada
    const chSel = $('#lf-channel'), keep = chSel.value;
    chSel.innerHTML = '<option value="">Todos</option>' + [...new Set(leads.map((l) => l.channel).filter(Boolean))].sort().map((c) => `<option${c === keep ? ' selected' : ''}>${esc(c)}</option>`).join('');
    const list = leadList();
    $('#adm-ld-count').textContent = `${n(list.length)} ${list.length === 1 ? 'contacto' : 'contactos'} · toca la flecha para ver notas y detalles`;
    box.innerHTML = list.length
      ? '<div class="adm-lead-head"><span>Fecha</span><span>Contacto</span><span>Origen</span><span>Estado</span><span>Valor</span><span>Seguimiento</span><span></span></div>' + list.slice(0, ldShown).map(leadRow).join('')
      : `<p class="adm-empty">${leads.length ? 'No hay contactos con estos filtros.' : 'Aún no te ha escrito nadie desde la web. Cuando alguien toque WhatsApp, Instagram, correo o envíe el formulario, aparecerá aquí.'}</p>`;
    $('#adm-ld-more').hidden = list.length <= ldShown;
  }
  function openLead(id) {
    const l = leads.find((x) => String(x.id) === String(id));
    if (!l) return;
    if (tab !== 'contactos') setTab('contactos', true);
    openLeads.add(l.id);
    if (!leadList().includes(l)) { $('#lf-status').value = ''; $('#lf-when').value = 'todo'; $('#lf-q').value = ''; $('#lf-channel').value = ''; }
    const pos = leadList().indexOf(l);
    if (pos >= ldShown) ldShown = pos + 10;
    if ($('#adm-leads').contains(document.activeElement)) document.activeElement.blur();
    renderPipe();
    renderLeadList();
    const el = $(`.adm-lead[data-id="${CSS.escape(String(l.id))}"]`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('is-flash'); setTimeout(() => el.classList.remove('is-flash'), 2000); }
  }
  // guardar un cambio de un contacto (en Supabase, o en memoria en el modo demostración)
  async function saveLead(l, patch) {
    Object.assign(l, patch);
    if ('status' in patch) {
      l.closed_at = patch.status === 'ganado' || patch.status === 'perdido' ? new Date().toISOString() : null;
    }
    prepLead(l);
    if (!demo) {
      const { data, error } = await sb.from('leads').update(patch).eq('id', l.id).select().maybeSingle();
      if (error) { toast('No se pudo guardar el cambio: ' + esc(error.message || ''), null, true); return; }
      if (data) { Object.assign(l, data); prepLead(l); }
    }
    say('Guardado');
  }
  // un cambio en una fila de Contactos o en una tarjeta de Contactados: se guarda solo
  async function onLeadField(e) {
    const f = e.target.dataset.f, art = e.target.closest('[data-id]');
    if (!f || !art) return;
    const l = leads.find((x) => String(x.id) === art.dataset.id);
    if (!l) return;
    let v = e.target.value;
    const patch = {};
    if (f === 'value') {
      const num = v.replace(/[^\d]/g, '');
      patch.value = num ? Number(num) : null;
      e.target.value = num ? n(patch.value) : '';
    } else if (f === 'status') {
      patch.status = v;
      e.target.className = `adm-in adm-in-select st-sel st-${v}`;
      // al cotizar o cerrar, si no tiene valor, se sugiere el precio del plan
      if ((v === 'cotizado' || v === 'ganado') && (l.value == null || l.value === '') && l._price) {
        patch.value = l._price;
        const vi = art.querySelector('[data-f="value"]');
        if (vi) vi.value = n(l._price);
      }
      if (!OPEN.has(v)) { patch.next_at = null; const ni = art.querySelector('[data-f="next_at"]'); if (ni) ni.value = ''; }
    } else if (f === 'next_at') {
      patch.next_at = v || null;
      e.target.classList.toggle('is-due', !!v && v <= ymd(new Date()) && OPEN.has(l.status));
    } else if (f === 'plan') {
      patch.plan = v || null;
      const vi = art.querySelector('[data-f="value"]'), o = OFFERS.find((x) => x.name === v);
      if (vi && o) vi.placeholder = n(o.price);
    } else {
      v = v.trim();
      patch[f] = v || null;
      const b = f === 'name' && art.querySelector('.ld-who b');
      if (b) { b.textContent = v || 'Sin nombre'; b.classList.toggle('is-empty', !v); }
    }
    await saveLead(l, patch);
    const sub = f === 'plan' && art.querySelector('.ld-who small');
    if (sub) sub.textContent = [l.channel, l.business, l._plan && (l._guess ? 'vio ' + l._plan : l._plan)].filter(Boolean).join(' · ');
    // en Contactados, la tarjeta se actualiza al cambiar el estado
    if (f === 'status' && art.classList.contains('adm-fcard')) art.outerHTML = formCard(l);
    // todo menos la lista se vuelve a pintar (la lista se queda quieta mientras escribes)
    renderContactos();
    if (f === 'status' || f === 'value') { renderGoals(); renderInsights(); }
  }
  $('#adm-leads').addEventListener('change', onLeadField);
  $('#adm-forms').addEventListener('change', onLeadField);
  $('#adm-leads').addEventListener('click', async (e) => {
    const art = e.target.closest('.adm-lead');
    if (!art) return;
    const l = leads.find((x) => String(x.id) === art.dataset.id);
    if (!l) return;
    if (e.target.closest('.ld-more')) {
      const open = !openLeads.has(l.id);
      if (open) openLeads.add(l.id); else openLeads.delete(l.id);
      art.classList.toggle('is-open', open);
      e.target.closest('.ld-more').setAttribute('aria-expanded', String(open));
      const more = art.querySelector('.adm-lead-more');
      if (open && !more) art.insertAdjacentHTML('beforeend', leadMore(l));
      if (!open && more) more.remove();
      return;
    }
    if (e.target.closest('[data-del]')) {
      if (!confirm('¿Eliminar este contacto? No se puede deshacer.')) return;
      if (!demo) {
        const { error } = await sb.from('leads').delete().eq('id', l.id);
        if (error) { toast('No se pudo eliminar: ' + esc(error.message || ''), null, true); return; }
      } else { const d = demoLeads(), i = d.indexOf(l); if (i >= 0) d.splice(i, 1); }
      leads = leads.filter((x) => x !== l);
      openLeads.delete(l.id);
      renderContactos();
      say('Contacto eliminado');
    }
  });
  $('#adm-ld-pipe').addEventListener('click', (e) => {
    const b = e.target.closest('[data-stage]');
    if (!b) return;
    const sel = $('#lf-status');
    sel.value = sel.value === b.dataset.stage ? '' : b.dataset.stage;
    ldShown = 30;
    renderPipe();
    renderLeadList();
  });
  ['#lf-status', '#lf-channel', '#lf-when'].forEach((id) => $(id).addEventListener('change', () => { ldShown = 30; renderPipe(); renderLeadList(); }));
  let qTimer = 0;
  $('#lf-q').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => { ldShown = 30; renderPipe(); renderLeadList(); }, 200); });
  $('#adm-ld-more').addEventListener('click', () => { ldShown += 30; renderLeadList(); });
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open-lead]');
    if (o) { openLead(o.dataset.openLead); return; }
    if (e.target.closest('[data-filter-open]')) { $('#lf-status').value = 'abiertos'; $('#lf-when').value = 'todo'; ldShown = 30; renderPipe(); renderLeadList(); $('#adm-leads').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  // agregar un contacto a mano (te escribió por otro lado, una llamada, un referido…)
  $('#adm-ld-form-plan').innerHTML = '<option value="">Sin definir</option>' + OFFERS.map((o) => `<option>${o.name}</option>`).join('');
  $('#adm-ld-add').addEventListener('click', () => {
    const f = $('#adm-ld-form');
    f.hidden = !f.hidden;
    if (!f.hidden) f.elements.name.focus();
  });
  $('#adm-ld-cancel').addEventListener('click', () => { $('#adm-ld-form').hidden = true; });
  $('#adm-ld-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, plan = f.elements.plan.value;
    const row = { name: f.elements.name.value.trim() || null, contact: f.elements.contact.value.trim() || null, channel: f.elements.channel.value, label: 'Agregado a mano', plan: plan || null, status: 'nuevo' };
    let l;
    if (demo) {
      const now = new Date().toISOString();
      l = { id: Date.now(), created_at: now, updated_at: now, closed_at: null, session: null, visitor: null, page: null, referrer: null, utm_source: null, utm_medium: null, utm_campaign: null, device: null, value: null, next_at: null, notes: null, ...row };
      demoLeads().unshift(l);
    } else {
      const { data, error } = await sb.from('leads').insert(row).select().single();
      if (error) { toast('No se pudo guardar el contacto: ' + esc(error.message || ''), null, true); return; }
      l = data;
    }
    prepLead(l);
    if (!leads.includes(l)) leads.unshift(l);
    f.reset();
    f.hidden = true;
    openLeads.add(l.id);
    renderContactos();
    say('Contacto agregado');
  });

  // ---------- CONTACTADOS (el formulario de contacto de la web) ----------
  let fmFilter = '', fmShown = 20;
  const openForms = new Set();
  const editing = () => ['#adm-leads', '#adm-forms'].some((s) => $(s).contains(document.activeElement));
  // teléfono → WhatsApp, correo → correo. Lo que la persona escribió nunca se vuelve código:
  // solo se arman enlaces wa.me (con los números), mailto (con un correo válido) o http(s)
  function reachOf(l) {
    const v = String(l.contact || '').trim(), first = String(l.name || '').trim().split(/\s+/)[0] || '';
    const hello = `Hola${first ? ' ' + first : ''}, te escribo de Gotia Studio por el formulario que llenaste en nuestra web.`;
    if (/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(v)) return { kind: 'mail', href: `mailto:${v}?subject=${encodeURIComponent('Gotia Studio · tu solicitud')}&body=${encodeURIComponent(hello)}`, text: v };
    let digits = v.replace(/\D/g, '');
    if (!/[a-z@]/i.test(v) && digits.length >= 7 && digits.length <= 15) {
      if (digits.length === 10 && digits[0] === '3') digits = '57' + digits;   // celular de Colombia sin indicativo
      return { kind: 'wa', href: `https://wa.me/${digits}?text=${encodeURIComponent(hello)}`, text: v };
    }
    return { kind: '', href: '', text: v };
  }
  // el enlace de su negocio: se le agrega https:// si falta; un @usuario se toma como Instagram
  function linkOf(v) {
    v = String(v || '').trim();
    if (!v) return null;
    if (/^@[\w.]{1,30}$/.test(v)) return { href: 'https://instagram.com/' + v.slice(1), label: 'Instagram ' + v };
    let u;
    try { u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v.replace(/^\/+/, '')); } catch (e) { return null; }
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
    const host = u.hostname.replace(/^www\./, '');
    if (/(^|\.)instagram\.com$/.test(host)) { const h = u.pathname.split('/').filter(Boolean)[0]; return { href: u.href, label: 'Instagram' + (h ? ' @' + h : '') }; }
    if ((/(^|\.)google\.[a-z.]+$/.test(host) && /^\/maps/.test(u.pathname)) || /^(maps\.app\.goo\.gl|goo\.gl)$/.test(host)) return { href: u.href, label: 'Google Maps' };
    return { href: u.href, label: host };
  }
  const FM = { '': () => true, nuevo: (l) => l.status === 'nuevo', seguimiento: (l) => l.status === 'contactado' || l.status === 'cotizado', cerrados: (l) => !OPEN.has(l.status) };
  function formScope() {
    const when = $('#fm-when').value, q = $('#fm-q').value.trim().toLowerCase();
    return leads.filter((l) => isForm(l) && (when === 'todo' || inCur(l._created))
      && (!q || [l.name, l.contact, l.business, l.message, l.notes, l.link, l._src].some((x) => x && String(x).toLowerCase().includes(q))));
  }
  function formCard(l) {
    const r = reachOf(l), link = linkOf(l.link), notesOpen = openForms.has(l.id);
    const reach = r.href ? `<a href="${esc(r.href)}"${r.kind === 'wa' ? ' target="_blank" rel="noopener"' : ''}>${esc(r.text)}</a>` : esc(r.text || '—');
    const when = cap(l._created.toLocaleString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }));
    return `<article class="adm-fcard${l.status === 'nuevo' ? ' is-new' : ''}" data-id="${l.id}">
      <header class="fc-head">
        <div class="fc-who"><b>${esc(l.name || 'Sin nombre')}</b>${l.business ? `<span class="fc-biz">${esc(l.business)}</span>` : ''}<small>${esc(when)} · ${ago(l._created)}</small></div>
        <select class="adm-in adm-in-select st-sel st-${l.status}" data-f="status" aria-label="Estado del seguimiento">${STATUS.map(([k, name]) => `<option value="${k}"${k === l.status ? ' selected' : ''}>${name}</option>`).join('')}</select>
      </header>
      <dl class="fc-data">
        <div><dt>${r.kind === 'mail' ? 'Correo' : r.kind === 'wa' ? 'WhatsApp' : 'Contacto'}</dt><dd>${reach}</dd></div>
        <div><dt>Su negocio en internet</dt><dd>${link ? `<a href="${esc(link.href)}" target="_blank" rel="noopener noreferrer nofollow">${esc(link.label)} ↗</a>` : esc(l.link || '—')}</dd></div>
        <div><dt>Llegó desde</dt><dd>${esc(l._src)}${l.utm_campaign ? ' · ' + esc(l.utm_campaign) : ''}</dd></div>
        <div><dt>Dispositivo</dt><dd>${esc(l.device || '—')}</dd></div>
      </dl>
      ${l.message ? `<p class="fc-msg">${esc(l.message)}</p>` : `<p class="fc-msg is-empty">${l.name ? 'No dejó mensaje.' : 'Se registró el envío, pero sin los datos del formulario.'}</p>`}
      <div class="fc-actions">
        ${r.kind === 'wa' ? `<a class="btn btn-primary btn-sm" href="${esc(r.href)}" target="_blank" rel="noopener" data-reach>Escribir por WhatsApp</a>` : r.kind === 'mail' ? `<a class="btn btn-primary btn-sm" href="${esc(r.href)}" data-reach>Escribir un correo</a>` : ''}
        ${l.status === 'nuevo' ? '<button class="btn btn-glass glass btn-sm" type="button" data-act="contactado">Marcar contactado</button>' : ''}
        <button class="btn btn-glass glass btn-sm" type="button" data-act="notes" aria-expanded="${notesOpen}">${l.notes ? 'Ver notas' : 'Agregar nota'}</button>
        <button class="fc-open" type="button" data-open-lead="${l.id}">Más detalles</button>
      </div>
      <label class="adm-field fc-notes"${notesOpen ? '' : ' hidden'}><span>Notas (se guardan solas)</span><textarea data-f="notes" maxlength="4000" placeholder="Qué le respondiste, qué necesita, cuándo volver a escribirle…">${esc(l.notes || '')}</textarea></label>
    </article>`;
  }
  function renderForms() {
    if (!W) return;
    const all = leads.filter(isForm), waiting = all.filter((l) => l.status === 'nuevo').length;
    const badge = $('#adm-badge-form');
    badge.hidden = !leadsOk || !waiting;
    badge.textContent = waiting > 99 ? '99+' : String(waiting);
    if (leadsOk === false) {
      $('#adm-fm-kpis').innerHTML = '';
      $('#adm-fm-count').textContent = '';
      $('#adm-forms').innerHTML = '<p class="adm-empty">Para recibir aquí el formulario de contacto, vuelve a ejecutar <code>supabase-setup.sql</code> en Supabase.</p>';
      return;
    }
    const C = all.filter((l) => inCur(l._created)), Cp = all.filter((l) => inPrev(l._created)), answered = C.filter((l) => l.status !== 'nuevo').length;
    const wonC = all.filter((l) => won(l) && inCur(l._closed)), wonP = all.filter((l) => won(l) && inPrev(l._closed));
    kpis($('#adm-fm-kpis'), [
      K('Formularios', n(C.length), delta(C.length, Cp.length), 'recibidos en el periodo', curSeries((l) => l.length, all, (l) => l._created)),
      K('Sin responder', n(waiting), '', waiting ? 'esperan tu respuesta' : 'todo respondido'),
      K('Respondidos', C.length ? pct(answered, C.length) + '%' : '—', '', C.length ? `${n(answered)} de ${n(C.length)} del periodo` : 'del periodo'),
      K('Ventas', n(wonC.length), delta(wonC.length, wonP.length), wonC.length ? moneyShort(sumValue(wonC)) + ' en el periodo' : 'cerradas en el periodo')
    ]);
    $$('#adm-fm-filter [data-fm]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fm === fmFilter)));
    const box = $('#adm-forms');
    if (box.contains(document.activeElement)) return;   // está escribiendo una nota: no se le borra nada
    const list = formScope().filter(FM[fmFilter]).sort((a, b) => b._created - a._created);
    $('#adm-fm-count').textContent = `${n(list.length)} ${list.length === 1 ? 'formulario' : 'formularios'} · del más nuevo al más antiguo`;
    box.innerHTML = list.length ? list.slice(0, fmShown).map(formCard).join('')
      : `<p class="adm-empty">${all.length ? 'No hay formularios con estos filtros.' : 'Aún nadie ha llenado el formulario de contacto. Cuando alguien lo envíe desde tu web, aparecerá aquí al instante.'}</p>`;
    $('#adm-fm-more').hidden = list.length <= fmShown;
  }
  function openForm(id) {
    setTab('contactados', true);
    const l = leads.find((x) => String(x.id) === String(id));
    if (!l) return;
    if (!formScope().filter(FM[fmFilter]).includes(l)) { fmFilter = ''; $('#fm-q').value = ''; $('#fm-when').value = 'todo'; }
    if (editing()) document.activeElement.blur();
    renderForms();
    const el = $(`.adm-fcard[data-id="${CSS.escape(String(l.id))}"]`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('is-flash'); setTimeout(() => el.classList.remove('is-flash'), 2000); }
  }
  $('#adm-forms').addEventListener('click', async (e) => {
    const card = e.target.closest('.adm-fcard');
    if (!card) return;
    const l = leads.find((x) => String(x.id) === card.dataset.id);
    if (!l) return;
    // abrió WhatsApp o el correo: se ofrece marcarlo como contactado
    if (e.target.closest('[data-reach]') && l.status === 'nuevo') {
      toast(`¿Ya le escribiste a <b>${esc(l.name || 'esta persona')}</b>?`, { label: 'Marcar contactado', run: async () => { await saveLead(l, { status: 'contactado' }); renderContactos(); renderInsights(); } });
      return;
    }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'notes') {
      const box = card.querySelector('.fc-notes'), open = box.hidden;
      box.hidden = !open;
      act.setAttribute('aria-expanded', String(open));
      if (open) { openForms.add(l.id); box.querySelector('textarea').focus(); } else openForms.delete(l.id);
    } else if (act.dataset.act === 'contactado') {
      act.disabled = true;
      await saveLead(l, { status: 'contactado' });
      card.outerHTML = formCard(l);
      renderContactos();
      renderGoals();
      renderInsights();
    }
  });
  $('#adm-fm-filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-fm]');
    if (!b) return;
    fmFilter = b.dataset.fm;
    fmShown = 20;
    renderForms();
  });
  $('#fm-when').addEventListener('change', () => { fmShown = 20; renderForms(); });
  let fmTimer = 0;
  $('#fm-q').addEventListener('input', () => { clearTimeout(fmTimer); fmTimer = setTimeout(() => { fmShown = 20; renderForms(); }, 200); });
  $('#adm-fm-more').addEventListener('click', () => { fmShown += 20; renderForms(); });

  // ---------- WEB PRINCIPAL ----------
  function renderWeb() {
    const H = cur.filter((s) => s.home), Hp = prev.filter((s) => s.home);
    const a = summary(H), b = summary(Hp), hp = b.n > 0;
    const reach = (l, id) => l.filter((s) => s.sec.has('h:' + id)).length;
    const sp = (fn) => curSeries(fn, H);
    kpis($('#adm-web-kpis'), [
      K('Visitas', n(a.n), delta(a.n, b.n), n(a.people) + ' personas', sp(METRICS.visits.fn)),
      K('Tiempo activo', dur(a.avg), delta(a.avg, b.avg), 'promedio por visita', sp(METRICS.time.fn)),
      K('Se van enseguida', pct(a.bounce, a.n) + '%', pdelta(rate(a.bounce, a.n), rate(b.bounce, b.n), hp, true), 'sin pasar de la portada', sp(METRICS.bounce.fn)),
      K('Llegan a los planes', pct(reach(H, 'packs'), a.n) + '%', pdelta(rate(reach(H, 'packs'), a.n), rate(reach(Hp, 'packs'), b.n), hp), 'ven la sección Planes', sp((l) => (l.length ? reach(l, 'packs') / l.length * 100 : null))),
      K('Llegan al final', pct(reach(H, 'contacto'), a.n) + '%', pdelta(rate(reach(H, 'contacto'), a.n), rate(reach(Hp, 'contacto'), b.n), hp), 'ven Contacto', sp((l) => (l.length ? reach(l, 'contacto') / l.length * 100 : null))),
      K('Te escriben', p1(rate(H.filter((s) => s.contactH).length, a.n)), pdelta(rate(H.filter((s) => s.contactH).length, a.n), rate(Hp.filter((s) => s.contactH).length, b.n), hp), n(H.filter((s) => s.contactH).length) + ' visitas', sp((l) => l.filter((s) => s.contactH).length))
    ]);
    sectionTable($('#adm-web-sections'), sectionRows(H, 'h:', SECTIONS, 'exitH'), H.length);

    const faqBase = reach(H, 'faq');
    const faq = countBy(H.flatMap((s) => [...new Set(s.interacts.filter((x) => x.startsWith('h:Pregunta · ')))]), (x) => strip(x).slice(11));
    $('#adm-web-faq').innerHTML = bars(faq, faqBase);
    // cada tutorial cuenta una vez por visita, con el % que tocó todos sus pasos
    // (los pasos llegan por nombre: el total es la mayor cantidad de pasos que alguien tocó)
    const tut = new Map();
    H.forEach((s) => {
      const per = new Map();
      s.interacts.forEach((x) => { const m = strip(x).match(/^Tutorial · (.+) · (.+)$/); if (m) { if (!per.has(m[1])) per.set(m[1], new Set()); per.get(m[1]).add(m[2]); } });
      per.forEach((steps, t) => { if (!tut.has(t)) tut.set(t, []); tut.get(t).push(steps.size); });
    });
    const tutRows = [...tut].map(([t, sizes]) => { const all = Math.max(...sizes); return ['Tutorial · ' + t, sizes.length, all > 1 ? pct(sizes.filter((k) => k === all).length, sizes.length) : null]; });
    const touchLabel = (x) => x.replace(/^Planes · ir a (.+)$/, 'Fue al plan $1 (en Planes)');
    const others = countBy(H.flatMap((s) => [...new Set(s.interacts.filter((x) => !/^h:(Pregunta|Tutorial) · /.test(x)).map((x) => touchLabel(strip(x))))]), (x) => x);
    const touch = [...tutRows, ...others.map(([k, v]) => [k, v, null])].sort((a, b) => b[1] - a[1]).slice(0, 10);
    $('#adm-web-touch').innerHTML = bars(touch, 0, (v, done) => `${n(v)} <small>${done == null ? pct(v, H.length) + '%' : done + '% ve todos los pasos'}</small>`);
    const homeClicks = countBy(H.flatMap((s) => s.contacts.filter((c) => c.startsWith('h:')).map(strip)), (x) => x.replace(/^WhatsApp · /, 'WhatsApp: ')).slice(0, 8);
    $('#adm-web-clicks').innerHTML = bars(homeClicks);

    const v3 = H.filter((s) => s.is3d), vl = H.filter((s) => !s.is3d);
    const act = H.filter((s) => s.clicks.some((c) => /Activó la versión 3D/.test(c)));
    const fromInvite = H.filter((s) => s.clicks.some((c) => /desde el aviso/.test(c))).length;
    const closed = H.filter((s) => s.interacts.includes('h:Aviso 3D · lo cerró')).length;
    const row = (name, l) => [name, n(l.length), dur(mean(l.map((s) => s.dur).filter(Boolean))), p1(rate(l.filter((s) => s.contact).length, l.length))];
    $('#adm-web-3d').innerHTML = H.length
      ? `<p class="adm-big"><b>${pct(v3.length, H.length)}%</b> de las visitas vio la versión 3D</p>
         ${mini(['Versión', 'Visitas', 'Tiempo', 'Te escriben'], [row('3D', v3), row('Esencial', vl)])}
         <p class="adm-version">La activaron con el botón: <b>${n(act.length - fromInvite)}</b> · desde el aviso: <b>${n(fromInvite)}</b> · cerraron el aviso: <b>${n(closed)}</b></p>`
      : `<p class="adm-empty">${EMPTY}</p>`;

    const withScroll = H.filter((s) => s.scroll > 0);
    const bucket = [['Hasta 25%', 0, 25], ['26% a 50%', 26, 50], ['51% a 75%', 51, 75], ['76% a 100%', 76, 100]];
    $('#adm-web-scroll').innerHTML = withScroll.length ? bars(bucket.map(([k, x, y]) => [k, withScroll.filter((s) => s.scroll >= x && s.scroll <= y).length]), withScroll.length) : bars([]);
    $('#adm-web-exits').innerHTML = bars(countBy(H, (s) => NAMES.get(s.exitH)).slice(0, 6), H.length);
  }

  // ---------- PLANES Y PRECIOS ----------
  function renderPlanes() {
    const P = cur.filter((s) => s.planes), Pp = prev.filter((s) => s.planes);
    const a = summary(P), b = summary(Pp), hp = b.n > 0;
    const seePlan = (l) => l.filter((s) => WEB_PLANS.some((i) => s.seen.has(i))).length;
    const end = (l) => l.filter((s) => s.sec.has('p:contacto')).length;
    const ask = (l) => l.filter((s) => s.contactP).length;
    const sp = (fn) => curSeries(fn, P);
    kpis($('#adm-pl-kpis'), [
      K('Visitas', n(a.n), delta(a.n, b.n), 'abrieron planes y precios', sp(METRICS.visits.fn)),
      K('Personas', n(a.people), delta(a.people, b.people), n(a.back) + ' visitas de personas que vuelven', sp(METRICS.people.fn)),
      K('Tiempo activo', dur(a.avg), delta(a.avg, b.avg), 'promedio por visita', sp(METRICS.time.fn)),
      K('Ven un plan', pct(seePlan(P), a.n) + '%', pdelta(rate(seePlan(P), a.n), rate(seePlan(Pp), b.n), hp), 'al menos un plan de página web', sp((l) => (l.length ? seePlan(l) / l.length * 100 : null))),
      K('Llegan al final', pct(end(P), a.n) + '%', pdelta(rate(end(P), a.n), rate(end(Pp), b.n), hp), 'ven toda la presentación', sp((l) => (l.length ? end(l) / l.length * 100 : null))),
      K('Piden información', p1(rate(ask(P), a.n)), pdelta(rate(ask(P), a.n), rate(ask(Pp), b.n), hp), n(ask(P)) + ' visitas escribieron', sp(ask))
    ]);

    // cada plan con su color fijo dentro de su grupo (el color no cambia al cambiar el periodo)
    $$('#adm-pl-group button').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.group === plGroup)));
    const group = OFFERS.map((o, i) => [o, i]).filter(([o]) => o.group === plGroup);
    $('#adm-pl-trend-sub').textContent = 'visitas que vieron cada plan, por ' + B.word;
    lineChart($('#adm-pl-trend'), {
      labels: B.labels, tips: B.longs, col: cap(B.word), fmt: n, kind: 'int', h: 240, ends: true, label: 'Interés por plan',
      series: group.map(([o, i], k) => ({ name: o.name.replace(/^Plan |^Automatización /, ''), values: curSeries((l) => l.filter((s) => s.seen.has(i)).length, P), cls: 's' + (k + 1) })),
      empty: 'Aún nadie abrió planes y precios en este periodo.'
    });

    const rows = offerRows(cur);
    if (!P.length && !rows.some((r) => r.intents)) $('#adm-pl-offers').innerHTML = emptyRow(6);
    else {
      const best = Math.max(...rows.filter((r) => r.views >= 5).map((r) => r.conv / r.views), 0);
      let html = '', grp = '';
      rows.forEach((r) => {
        if (r.o.group !== grp) { grp = r.o.group; html += `<tr class="grp"><th colspan="6">${grp}</th></tr>`; }
        const c = r.views ? r.conv / r.views : 0;
        if (!r.o.ids.length) { html += `<tr><td>${r.o.name}</td><td><span class="adm-muted">no tiene pantalla aquí</span></td><td>—</td><td><span class="adm-muted">sin demo</span></td><td>${n(r.intents)}</td><td>—</td></tr>`; return; }
        html += `<tr><td>${r.o.name}</td><td>${cellbar(r.views, r.base)}</td><td>${r.time == null ? '—' : dur(r.time)}</td>
          <td>${r.demo == null ? '<span class="adm-muted">sin demo</span>' : r.views ? pct(r.demo, r.views) + '%' : '—'}</td>
          <td>${n(r.intents)}</td><td class="${r.views >= 5 && c && c === best ? 'is-best' : ''}">${r.views ? p1(c) : '—'}</td></tr>`;
      });
      $('#adm-pl-offers').innerHTML = html;
    }
    sectionTable($('#adm-pl-slides'), sectionRows(P, 'p:', SLIDES, 'exitP'), P.length);
    $('#adm-pl-clicks').innerHTML = bars(countBy(P.flatMap((s) => s.contacts.filter((c) => c.startsWith('p:')).map(strip)),
      (x) => x.replace(/^WhatsApp · /, '').replace(/^Vi los planes y (me interesa )?/, '').replace(/^\w/, (m) => m.toUpperCase())).slice(0, 8));
    const navLabel = (x) => {
      x = strip(x);
      const m = x.match(/^Demo · ([\w-]+) · /);
      if (m) { const o = OFFERS.find((of) => of.ids.includes(m[1])); return 'Tocó la demo de ' + (o ? o.name : m[1]); }
      if (x.startsWith('Resumen · ')) return 'Saltó desde el resumen a ' + x.slice(10);
      if (x.startsWith('Puntos · ')) return 'Usó los puntos para ir a ' + (NAMES.get('p:' + x.slice(9)) || x.slice(9));
      return x;
    };
    $('#adm-pl-nav').innerHTML = bars(countBy(P.flatMap((s) => [...new Set(s.interacts.filter((x) => x.startsWith('p:')).map(navLabel))]), (x) => x).slice(0, 8), P.length);
  }
  $('#adm-pl-group').addEventListener('click', (e) => {
    const b = e.target.closest('[data-group]');
    if (!b) return;
    plGroup = b.dataset.group;
    renderPlanes();
  });

  // ---------- ORIGEN ----------
  function renderOrigen() {
    // los 4 orígenes principales (contando también el periodo anterior, para que no cambien de color a cada rato) y "Otros"
    const top = countBy(cur.concat(prev), (s) => s.src).slice(0, 4).map((x) => x[0]);
    const series = top.map((name, k) => ({ name, values: curSeries((l) => l.filter((s) => s.src === name).length), cls: 's' + (k + 1) }));
    if (groupBy(cur, (s) => s.src).length > top.length) series.push({ name: 'Otros', values: curSeries((l) => l.filter((s) => !top.includes(s.src)).length), cls: 's5' });
    $('#adm-src-trend-sub').textContent = 'visitas por ' + B.word + ' de tus orígenes principales';
    lineChart($('#adm-src-trend'), { labels: B.labels, tips: B.longs, col: cap(B.word), fmt: n, kind: 'int', h: 260, ends: true, series, label: 'Visitas por origen' });

    const groups = groupBy(cur, (s) => s.src);
    const rates = groups.map((g) => (g.list.length >= 5 ? rate(g.list.filter((s) => s.contact).length, g.list.length) : 0));
    const best = Math.max(0, ...rates);
    $('#adm-src-table').innerHTML = groups.length ? groups.map((g, i) => {
      const l = g.list, c = l.filter((s) => s.contact).length;
      return `<tr><td>${esc(g.name)}</td><td>${cellbar(l.length, groups[0].list.length, n(l.length) + ` <small>${pct(l.length, cur.length)}%</small>`)}</td>
        <td>${pct(l.filter((s) => !s.back).length, l.length)}%</td><td>${dur(mean(l.map((s) => s.dur).filter(Boolean)))}</td>
        <td>${pct(l.filter((s) => s.bounce).length, l.length)}%</td><td>${pct(l.filter((s) => s.seesPlans).length, l.length)}%</td>
        <td class="${rates[i] && rates[i] === best ? 'is-best' : ''}">${p1(rate(c, l.length))} <small>${n(c)}</small></td></tr>`;
    }).join('') : emptyRow(7);

    const camps = groupBy(cur.filter((s) => s.utm_campaign), (s) => s.utm_campaign);
    $('#adm-src-campaigns').innerHTML = camps.length ? camps.slice(0, 12).map((g) => {
      const c = g.list.filter((s) => s.contact).length;
      const topSrc = countBy(g.list, (s) => s.src)[0][0], med = g.list[0].utm_medium;
      const src = topSrc + (med && !/anuncio/.test(topSrc) ? ' · ' + med : '');
      return `<tr><td>${esc(g.name)}</td><td>${esc(src)}</td><td>${n(g.list.length)}</td><td>${n(c)} <small>${p1(rate(c, g.list.length))}</small></td></tr>`;
    }).join('') : '<tr><td colspan="4" class="adm-empty">Aún no hay visitas con campaña. Crea un enlace abajo y compártelo.</td></tr>';
    $('#adm-src-refs').innerHTML = bars(countBy(cur.filter((s) => s.referrer), (s) => s.referrer).slice(0, 8), cur.length);
  }

  // ---------- AUDIENCIA ----------
  function renderAudiencia() {
    const L = cur, total = L.length;
    const t = bestTime(L), max = Math.max(1, ...t.grid.flat());
    let heat = '<span></span>' + Array.from({ length: 24 }, (_, h) => `<b>${h % 3 ? '' : h}</b>`).join('');
    t.grid.forEach((r, d) => {
      heat += `<span>${WEEK[d].slice(0, 3)}</span>` + r.map((v, h) => `<i style="--v:${(v / max).toFixed(3)}" title="${WEEK[d]} ${hour(h)}: ${n(v)} visitas"></i>`).join('');
    });
    $('#adm-au-heat').innerHTML = total ? heat : `<p class="adm-empty">${EMPTY}</p>`;
    $('#adm-au-best').textContent = total ? `Más visitas: los ${t.day}, de ${t.from} a ${t.to}` : 'día y hora';

    const stat = (l) => [n(l.length), dur(mean(l.map((s) => s.dur).filter(Boolean))), p1(rate(l.filter((s) => s.contact).length, l.length))];
    const dev = groupBy(L, (s) => s.device);
    $('#adm-au-devices').innerHTML = total ? split(dev, total) + mini(['', 'Visitas', 'Tiempo', 'Te escriben'],
      dev.map((g, i) => [dot(i) + esc(g.name[0].toUpperCase() + g.name.slice(1)) + ` <small>${pct(g.list.length, total)}%</small>`, ...stat(g.list)])) : `<p class="adm-empty">${EMPTY}</p>`;
    const nb = [{ name: 'Nuevas', list: L.filter((s) => !s.back) }, { name: 'Vuelven', list: L.filter((s) => s.back) }];
    $('#adm-au-new').innerHTML = total ? split(nb, total) + mini(['', 'Visitas', 'Tiempo', 'Te escriben'],
      nb.map((g, i) => [dot(i) + g.name + ` <small>${pct(g.list.length, total)}%</small>`, ...stat(g.list)])) : `<p class="adm-empty">${EMPTY}</p>`;

    const withLoad = L.filter((s) => s.load);
    if (withLoad.length) {
      const rows = groupBy(withLoad, (s) => s.device).map((g, i) => {
        const m = median(g.list.map((s) => s.load)), slow = pct(g.list.filter((s) => s.load > 3000).length, g.list.length);
        return [dot(i) + esc(g.name[0].toUpperCase() + g.name.slice(1)), `<span class="${m > 3000 ? 'is-hot' : m < 2000 ? 'is-best' : ''}">${secs(m)}</span>`, slow + '%'];
      });
      const all = median(withLoad.map((s) => s.load));
      $('#adm-au-speed').innerHTML = `<p class="adm-big"><b>${secs(all)}</b> ${all <= 2500 ? 'carga rápida' : all <= 3500 ? 'carga aceptable' : 'carga lenta'}</p>` + mini(['', 'Carga típica', 'Más de 3 s'], rows);
    } else $('#adm-au-speed').innerHTML = `<p class="adm-empty">${EMPTY}</p>`;

    $('#adm-au-geo').innerHTML = bars(countBy(L, (s) => country(s.tz) || 'Sin dato').slice(0, 7), total);
    $('#adm-au-lang').innerHTML = bars(countBy(L, (s) => langName(s.lang) || 'Sin dato').slice(0, 6), total);
    $('#adm-au-week').innerHTML = total ? bars(WEEK.map((d, i) => [d, t.totals[i]]), total) : bars([]);
  }

  // ---------- VISITAS ----------
  const when = (d) => {
    const mins = Math.round((Date.now() - d) / 6e4);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins} min`;
    return d.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  };
  const pageName = (s) => (s.home && s.planes ? 'Ambas' : s.planes ? 'Planes y precios' : 'Principal');
  const result = (s) => {
    if (s.contact) {
      const o = [...s.intents].map((i) => OFFERS[i].name)[0], l = leadBySession.get(s.id);
      return `<span class="adm-ok">${esc(s.channel)}${o ? ' · ' + esc(o) : ''}</span>${l ? `<small>${ST_NAME[l.status]}${l.name ? ' · ' + esc(l.name) : ''}</small>` : ''}`;
    }
    return s.bounce ? '<span class="adm-muted">Se fue enseguida</span>' : '—';
  };
  function filtered() {
    const page = $('#vf-page').value, src = $('#vf-source').value, dev = $('#vf-device').value;
    const onlyC = $('#vf-contact').checked, onlyB = $('#vf-back').checked;
    return cur.filter((s) => (!page || (page === 'planes' ? s.planes : s.home)) && (!src || s.src === src) && (!dev || s.device === dev) && (!onlyC || s.contact) && (!onlyB || s.back));
  }
  function renderVisitas() {
    const sel = $('#vf-source'), keep = sel.value;
    sel.innerHTML = '<option value="">Todos</option>' + groupBy(cur, (s) => s.src).map((g) => `<option${g.name === keep ? ' selected' : ''}>${esc(g.name)}</option>`).join('');
    const list = filtered();
    $('#adm-vi-count').textContent = `${n(list.length)} ${list.length === 1 ? 'visita' : 'visitas'} · toca una para ver su recorrido`;
    $('#adm-visits').innerHTML = list.length ? list.slice(0, shown).map((s, i) => `<tr class="vrow" data-i="${i}" tabindex="0">
      <td>${when(s.start)}</td><td>${pageName(s)}</td><td>${esc(s.src)}${s.utm_campaign ? `<small>${esc(s.utm_campaign)}</small>` : ''}</td>
      <td>${esc(s.device)}</td><td>${s.back ? (s.visitNo > 1 ? s.visitNo + '.ª vez' : 'Vuelve') : 'Nueva'}</td>
      <td>${s.dur ? dur(s.dur) : '—'}</td><td>${s.scroll ? s.scroll + '%' : '—'}</td><td>${result(s)}</td></tr>`).join('')
      : '<tr><td colspan="8" class="adm-empty">No hay visitas con estos filtros.</td></tr>';
    $('#adm-vi-more').hidden = list.length <= shown;
  }
  function detail(s) {
    const chips = s.path.map((k) => `<span class="adm-chip">${esc(NAMES.get(k) || strip(k))}${s.dwell[k] ? ` <small>${dur(s.dwell[k])}</small>` : ''}</span>`).join('');
    const list = (arr) => (arr.length ? arr.map((x) => `<span class="adm-chip">${esc(strip(x))}</span>`).join('') : '<span class="adm-muted">—</span>');
    const l = leadBySession.get(s.id);
    const facts = [
      ['Llegó desde', s.referrer || (s.utm_source ? s.utm_source : 'Directo (sin enlace de origen)')],
      ['Campaña', [s.utm_campaign, s.utm_medium].filter(Boolean).join(' · ') || '—'],
      ['País', country(s.tz) || '—'], ['Idioma', langName(s.lang) || '—'],
      ['Versión', s.planes && !s.home ? '—' : s.is3d ? '3D' : 'Esencial'], ['Carga', s.load ? secs(s.load) : '—'],
      ['Inicio', s.start.toLocaleString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })]
    ];
    if (l) facts.push(['Seguimiento', ST_NAME[l.status] + (l.name ? ' · ' + l.name : '') + (l.value ? ' · ' + money(l.value) : '')]);
    return `<tr class="vdetail"><td colspan="8"><div class="adm-detail">
      <div><h3>Recorrido</h3><div class="adm-chips">${chips || '<span class="adm-muted">—</span>'}</div></div>
      <div><h3>Lo que tocó</h3><div class="adm-chips">${list(s.interacts)}</div></div>
      <div><h3>Botones</h3><div class="adm-chips">${list(s.clicks)}</div>${l ? `<p class="adm-hint"><button class="btn btn-glass glass btn-sm" type="button" data-open-lead="${l.id}">Ver en contactos</button></p>` : ''}</div>
      <dl class="adm-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    </div></td></tr>`;
  }
  $('#adm-visits').addEventListener('click', (e) => {
    if (e.target.closest('[data-open-lead]')) return;
    const tr = e.target.closest('.vrow');
    if (!tr) return;
    const next = tr.nextElementSibling;
    if (next && next.classList.contains('vdetail')) { next.remove(); tr.classList.remove('is-open'); return; }
    tr.insertAdjacentHTML('afterend', detail(filtered()[Number(tr.dataset.i)]));
    tr.classList.add('is-open');
  });
  $('#adm-visits').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.vrow')) { e.preventDefault(); e.target.click(); } });
  ['#vf-page', '#vf-source', '#vf-device', '#vf-contact', '#vf-back'].forEach((id) => $(id).addEventListener('change', () => { shown = 30; renderVisitas(); }));
  $('#adm-vi-more').addEventListener('click', () => { shown += 30; renderVisitas(); });

  // descargar para Excel: en Contactos, los contactos; en las demás, las visitas (con los filtros de Visitas)
  function download(name, head, rows) {
    const cell = (v) => {
      v = v == null ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
      return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    const csv = '﻿' + [head, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  $('#adm-csv').addEventListener('click', () => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (tab === 'contactados' && leadsOk) {
      download(`gotia-formularios-${stamp}.csv`,
        ['fecha', 'hora', 'nombre', 'contacto', 'negocio', 'enlace', 'mensaje', 'estado', 'origen', 'campana', 'dispositivo', 'notas'],
        formScope().filter(FM[fmFilter]).sort((a, b) => b._created - a._created).map((l) => [l._created.toLocaleDateString('es-CO'), l._created.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          l.name, l.contact, l.business, l.link, l.message, ST_NAME[l.status], l._src, l.utm_campaign, l.device, l.notes]));
      return;
    }
    if (tab === 'contactos' && leadsOk) {
      download(`gotia-contactos-${stamp}.csv`,
        ['fecha', 'hora', 'canal', 'interes', 'origen', 'campana', 'dispositivo', 'nombre', 'contacto', 'negocio', 'estado', 'valor', 'proximo_seguimiento', 'cerrado', 'notas', 'mensaje', 'boton'],
        leadList().map((l) => [l._created.toLocaleDateString('es-CO'), l._created.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }), l.channel, l._plan, l._src, l.utm_campaign, l.device,
          l.name, l.contact, l.business, ST_NAME[l.status], l.value, l.next_at, l._closed ? l._closed.toLocaleDateString('es-CO') : '', l.notes, l.message, l.label]));
      return;
    }
    download(`gotia-visitas-${days === 1 ? 'hoy' : days + '-dias'}-${stamp}.csv`,
      ['fecha', 'hora', 'pagina', 'origen', 'sitio', 'utm_source', 'utm_medium', 'utm_campaign', 'dispositivo', 'idioma', 'pais', 'version', 'visita_n', 'nueva', 'tiempo_activo_s', 'bajo_pct', 'carga_ms', 'secciones', 'clics', 'interacciones', 'te_escribio', 'plan_pedido'],
      filtered().map((s) => [
        s.start.toLocaleDateString('es-CO'), s.start.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }), pageName(s), s.src, s.referrer,
        s.utm_source, s.utm_medium, s.utm_campaign, s.device, s.lang, country(s.tz), s.planes && !s.home ? '' : s.is3d ? '3D' : 'Esencial',
        s.visitNo || '', s.back ? 'no' : 'sí', s.dur, s.scroll, s.load || '', s.path.map((k) => NAMES.get(k) || strip(k)).join(' > '),
        s.clicks.map(strip).join(' | '), s.interacts.map(strip).join(' | '), s.contact ? s.channel : '', [...s.intents].map((i) => OFFERS[i].name).join(' | ')
      ]));
  });

  // ---------- crear enlaces con campaña ----------
  const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  function buildLink() {
    const u = new URL($('#lb-page').value || './', location.href);
    const src = $('#lb-source').value, camp = slug($('#lb-campaign').value);
    u.searchParams.set('utm_source', src);
    u.searchParams.set('utm_medium', src === 'google' ? 'cpc' : src === 'correo' ? 'email' : src === 'qr' ? 'impreso' : src === 'whatsapp' ? 'mensaje' : 'social');
    if (camp) u.searchParams.set('utm_campaign', camp);
    $('#lb-url').value = u.href;
  }
  ['#lb-page', '#lb-source', '#lb-campaign'].forEach((id) => $(id).addEventListener('input', buildLink));
  $('#lb-copy').addEventListener('click', async () => {
    const b = $('#lb-copy');
    try { await navigator.clipboard.writeText($('#lb-url').value); } catch (e) { $('#lb-url').select(); document.execCommand('copy'); }
    b.textContent = 'Copiado';
    setTimeout(() => { b.textContent = 'Copiar'; }, 1600);
  });
  buildLink();

  // ---------- avisos ----------
  function toast(html, action, bad) {
    const el = document.createElement('div');
    el.className = 'adm-toast';
    el.innerHTML = `<span class="fi"${bad ? ' style="color:var(--bad);background:var(--bad-bg)"' : ''}>${ICON.chat}</span><p>${html}</p>${action ? `<button class="btn btn-glass glass btn-sm" type="button">${esc(action.label)}</button>` : ''}`;
    if (action) el.querySelector('button').addEventListener('click', () => { action.run(); el.remove(); });
    $('#adm-toasts').appendChild(el);
    while ($('#adm-toasts').children.length > 3) $('#adm-toasts').firstElementChild.remove();
    setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 400); }, bad ? 9000 : 7000);
    return el;
  }
  const say = (msg) => { $('#adm-status').textContent = msg + ' · ' + new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }); };

  // ---------- secciones ----------
  function setTab(name, push) {
    if (!TABS[name]) name = 'resumen';
    tab = name;
    $$('.adm-nav [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    $$('.adm-pane').forEach((p) => { p.hidden = p.dataset.pane !== name; });
    // las gráficas de la sección que aparece se dibujan ya (sin esperar al aviso de tamaño)
    $$(`[data-pane="${name}"] .adm-lc`).forEach((el) => { const c = charts.get(el); if (c && c.w !== Math.round(el.clientWidth)) draw(el); });
    $('#adm-h1').textContent = TABS[name][0];
    $('#adm-desc').textContent = TABS[name][1];
    const csvLabel = name === 'contactos' ? 'Descargar los contactos (Excel / CSV)' : name === 'contactados' ? 'Descargar los formularios (Excel / CSV)' : 'Descargar las visitas (Excel / CSV)';
    $('#adm-csv').title = csvLabel;
    $('#adm-csv').setAttribute('aria-label', csvLabel);
    if (push) history.replaceState(null, '', name === 'resumen' ? location.pathname + location.search : '#' + name);
  }
  $$('.adm-nav [data-tab]').forEach((b) => b.addEventListener('click', () => { setTab(b.dataset.tab, true); scrollTo({ top: 0, behavior: 'smooth' }); }));
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go-tab]');
    if (!go) return;
    setTab(go.dataset.goTab, true);
    if (go.dataset.goTab === 'origen') setTimeout(() => $('#adm-builder').scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    else scrollTo({ top: 0, behavior: 'smooth' });
  });
  setTab(location.hash.slice(1));

  // qué ver en las gráficas
  $('#adm-kpis').addEventListener('click', (e) => {
    const b = e.target.closest('[data-metric]');
    if (!b) return;
    mainMetric = b.dataset.metric;
    renderMain();
    const chart = $('#adm-main-chart'), r = chart.getBoundingClientRect();
    if (r.top > innerHeight || r.bottom < 0) chart.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $('#adm-main-metric').addEventListener('click', (e) => { const b = e.target.closest('[data-metric]'); if (b) { mainMetric = b.dataset.metric; renderMain(); } });
  $('#adm-hist-metric').addEventListener('click', (e) => { const b = e.target.closest('[data-metric]'); if (b) { histMetric = b.dataset.metric; renderHist(); } });

  // ---------- cargar y pintar ----------
  function periodText() {
    const yr = (d) => (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
    const f = (a, b) => {
      if (startOf(a).getTime() === startOf(b).getTime()) return a.getDate() + ' ' + a.toLocaleDateString('es-CO', { month: 'short' }) + yr(a);
      if (a.getFullYear() !== b.getFullYear()) return `${shortDate(a)} ${a.getFullYear()} – ${shortDate(b)}${yr(b)}`;
      return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${b.toLocaleDateString('es-CO', { month: 'short' })}${yr(b)}` : `${shortDate(a)} – ${shortDate(b)}${yr(b)}`;
    };
    const now = W.now, prevEnd = new Date(W.prevEnd - 1);
    $('#adm-period').textContent = days === 1
      ? 'Hoy, ' + f(now, now) + (compare ? ' · frente a ayer a esta misma hora' : '')
      : f(W.start, now) + (compare ? ' · frente a ' + f(W.prevStart, prevEnd) : '');
  }
  function notes() {
    const miss = [];
    if (rpc === false) miss.push('los tiempos por sección y las campañas');
    if (dailyOk === false) miss.push('la gráfica de 12 meses');
    if (leadsOk === false) miss.push('el seguimiento de contactos');
    if (goalsOk === false) miss.push('las metas');
    const note = $('#adm-note');
    note.hidden = demo || !miss.length;
    if (!note.hidden) note.innerHTML = `<b>Falta un paso en Supabase:</b> vuelve a ejecutar <code>supabase-setup.sql</code> en el SQL Editor para activar ${miss.join(', ').replace(/, ([^,]*)$/, ' y $1')}. Lo demás ya funciona.`;
  }
  function renderAll() {
    periodText();
    notes();
    renderResumen();
    renderRendimiento();
    renderContactos();
    renderWeb();
    renderPlanes();
    renderOrigen();
    renderAudiencia();
    renderVisitas();
    updateLive();
    feedState();
  }
  async function refresh(force) {
    if (busy) return;
    busy = true;
    $('#adm-status').textContent = 'Cargando…';
    $('.adm-main').classList.add('is-loading');
    try {
      W = windowFor(days);
      B = bucketsFor(W);
      const needDaily = force || !daily || Date.now() - dailyAt > 6e5;
      const [rows, d, lrows] = await Promise.all([
        fetchSessions(W.prevStart),
        needDaily ? fetchDaily().catch(() => { dailyOk = false; return null; }) : Promise.resolve(daily),
        fetchLeads().catch(() => { leadsOk = false; return []; }),
        force || goalsOk == null ? fetchGoals().catch(() => { goalsOk = false; }) : null
      ]);
      if (needDaily) { daily = d; dailyAt = Date.now(); }
      const all = prepare(rows);
      sessById = new Map(all.map((s) => [s.id, s]));
      if (!editing()) leads = lrows.map(prepLead);
      leadBySession = new Map(leads.filter((l) => l.session).map((l) => [l.session, l]));
      cur = all.filter((s) => s.start >= W.start);
      prev = all.filter((s) => s.start >= W.prevStart && s.start < W.prevEnd);
      for (const s of cur) if (Date.now() - s.last < 5 * 6e4) live.set(s.id, Math.max(live.get(s.id) || 0, s.last.getTime()));
      if (!rtOn && (!demo || !feed.length)) seedFeed();
      renderAll();
      $('#adm-status').textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
    } catch (err) {
      $('#adm-status').textContent = 'No se pudieron cargar los datos: ' + (err.message || err);
    }
    $('.adm-main').classList.remove('is-loading');
    busy = false;
  }

  // ---------- entrar y salir ----------
  function showPanel() {
    $('#adm-login').hidden = true;
    $('#adm').hidden = false;
    $('#adm-demo').hidden = !demo;
    $('#adm-compare').checked = compare;
    refresh(true).then(() => { if (demo) setTimeout(demoTick, 4000); else startRealtime(); });
    clearInterval(timer);
    timer = setInterval(() => refresh(), 60e3);   // se actualiza solo cada minuto
  }
  function showLogin(msg) {
    clearInterval(timer);
    stopRealtime();
    $('#adm').hidden = true;
    $('#adm-login').hidden = false;
    $('#adm-error').textContent = msg || '';
  }
  async function isAdmin(user) {
    const { data, error } = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
    return !error && !!data;
  }

  $('#adm-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!sb) return;
    const btn = $('#adm-go');
    btn.disabled = true;
    btn.textContent = 'Entrando…';
    $('#adm-error').textContent = '';
    const { data, error } = await sb.auth.signInWithPassword({ email: $('#adm-email').value.trim(), password: $('#adm-pass').value });
    btn.disabled = false;
    btn.textContent = 'Entrar';
    if (error) { $('#adm-error').textContent = 'Correo o contraseña incorrectos.'; return; }
    if (!(await isAdmin(data.user))) {
      await sb.auth.signOut();
      $('#adm-error').textContent = 'Esta cuenta no tiene acceso de administrador.';
      return;
    }
    $('#adm-pass').value = '';
    showPanel();
  });
  $('#adm-logout').addEventListener('click', async () => {
    if (demo) { location.href = 'index.html'; return; }
    await stopRealtime();
    await sb.auth.signOut();
    showLogin('Saliste del panel.');
  });
  $('#adm-refresh').addEventListener('click', () => refresh(true));
  $$('.adm-range button').forEach((b) => b.addEventListener('click', () => {
    days = Number(b.dataset.days);
    shown = 30;
    ldShown = 30;
    $$('.adm-range button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    refresh();
  }));
  $('#adm-compare').addEventListener('change', (e) => {
    compare = e.target.checked;
    try { localStorage.setItem('gotia-adm-compare', compare ? '1' : '0'); } catch (err) {}
    if (W) renderAll();
  });
  $('#adm-theme').addEventListener('click', () => {
    const dark = root.dataset.theme !== 'dark';
    if (dark) root.dataset.theme = 'dark'; else delete root.dataset.theme;
    // también el calendario, las listas del navegador y la barra del celular
    $('meta[name="color-scheme"]').content = dark ? 'dark' : 'light';
    $('meta[name="theme-color"]').content = dark ? '#000000' : '#eaf3ff';
    try { localStorage.setItem('gotia-theme', dark ? 'dark' : 'light'); } catch (e) {}
  });
  // la hora de "hace 3 min" y quién sigue en la web, cada 30 s
  setInterval(() => { if (!$('#adm').hidden) { updateLive(); renderFeed(); } }, 30e3);
  if (demo) { $('#adm-logout').textContent = 'Ir a la web'; }

  // ---------- al abrir ----------
  (async () => {
    if (demo) { showPanel(); return; }
    if (!window.supabase || !window.supabase.createClient) { showLogin('No se pudo cargar la conexión con Supabase. Revisa tu internet y recarga.'); return; }
    sb = window.supabase.createClient(cfg.url, cfg.anonKey);
    const { data } = await sb.auth.getSession();
    const user = data && data.session && data.session.user;
    if (user && (await isAdmin(user))) showPanel();
    else showLogin();
  })();
})();
