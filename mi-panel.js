/* =========================================================
   Gotiastudio — El panel de cada cliente (mi-panel.html)
   · Con Supabase (supabase-config.js lleno): pide entrar, y cada cuenta solo recibe
     los clientes a los que pertenece (my_clients y client_sessions, en
     supabase-clientes.sql: esa protección está en la base de datos, no aquí).
   · Sin Supabase (o con ?demo en la dirección): la cuenta de prueba, con datos de
     ejemplo y sin pedir contraseña.
   Lo que llega en cada visita lo escribe la web del cliente, que es pública: todo lo que
   se pinta con innerHTML pasa por esc(), y el nombre del cliente va con textContent.
   ========================================================= */
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const cfg = window.GOTIA_SUPABASE || {};
  const demo = !cfg.url || !cfg.anonKey || new URLSearchParams(location.search).has('demo');
  const root = document.documentElement;
  const PLAN = { mide: 'Mide', une: 'Une', decide: 'Decide' };
  const EMPTY = 'Aún sin datos en este periodo.';
  const DEMO_CLIENT = { id: 'prueba', name: 'Bloom Spa (cuenta de prueba)', plan: 'mide', status: 'activo', is_test: true };
  let sb = null, clients = [], client = null, days = 30, timer = 0, busy = false, metric = 'visits', cur = [], prev = [], W = null, B = null, shown = 10;

  // ---------- formatos ----------
  const nf = new Intl.NumberFormat('es-CO');
  const n = (v) => nf.format(Math.round(v || 0));
  const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
  const pf = (v) => (v == null ? '—' : v.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + '%');
  const dur = (s) => {
    s = Math.round(s || 0);
    if (s < 60) return s + ' s';
    const m = Math.floor(s / 60), r = s % 60;
    if (m >= 60) return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
    return m + ' min' + (r ? ' ' + r + ' s' : '');
  };
  const durAxis = (s) => (s < 60 ? Math.round(s) + ' s' : s % 60 ? Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0') : s / 60 + ' min');
  const hour = (h) => ((h % 12) || 12) + (h % 24 < 12 ? ' a. m.' : ' p. m.');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
  const parseYmd = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, k) => { const x = new Date(d); x.setDate(x.getDate() + k); return x; };
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const shortDate = (d) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  const longDate = (d) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  const countBy = (list, fn) => {
    const m = new Map();
    for (const x of list) { const k = fn(x); if (k) m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const pageName = (p) => (!p || p === '/' || p === '/index.html' ? 'Inicio' : p);
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

  // ---------- el periodo: hoy, o los últimos N días (y los N días anteriores, para comparar) ----------
  function windowFor(nDays) {
    const now = new Date();
    const start = addDays(startOf(now), -(nDays - 1));
    const prevStart = addDays(start, -nDays);
    return { now, start, prevStart, prevEnd: new Date(prevStart.getTime() + (now - start)) };
  }
  // cada punto de la gráfica: una hora (hoy), un día (7 y 30 días) o una semana (90 días)
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
  function seriesBy(list, base, fn) {
    const g = Array.from({ length: B.n }, () => []);
    for (const s of list) { const i = B.idx(s.start, base); if (i >= 0) g[i].push(s); }
    return g.map((x, i) => (i > B.last ? null : fn(x)));
  }
  const contactsOf = (l) => l.filter((s) => s.contact).length;
  const METRICS = {
    visits: { name: 'Visitas', kind: 'int', fmt: n, fn: (l) => l.length },
    people: { name: 'Personas', kind: 'int', fmt: n, fn: (l) => new Set(l.map((s) => s.visitor)).size },
    contacts: { name: 'Te contactan', kind: 'int', fmt: n, fn: contactsOf },
    time: { name: 'Tiempo promedio', kind: 'time', fmt: dur, fn: (l) => { const d = l.map((s) => s.dur).filter((x) => x > 0); return d.length ? mean(d) : null; } }
  };

  // ---------- la gráfica (SVG al tamaño real de la tarjeta; los estilos son los de admin.css) ----------
  const good = (v) => v != null && isFinite(v);
  const chart = { el: null, w: 0, i: -1, table: false, opts: null, g: null };
  function scale(max, kind) {
    if (!(max > 0)) max = kind === 'time' ? 60 : 4;
    const target = max / 5;
    let steps;
    if (kind === 'time') steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
    else { const mag = 10 ** Math.floor(Math.log10(target)); steps = [1, 2, 2.5, 5, 10].map((f) => f * mag); }
    let step = steps.find((s) => s >= target) || steps[steps.length - 1];
    if (kind === 'int' && step % 1) step = Math.ceil(step);
    return { step, max: step * Math.max(1, Math.ceil(max / step - 1e-9)) };
  }
  // curva suave que no se pasa de los puntos: nunca dibuja valores que no existen
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
  function draw() {
    const el = chart.el, o = chart.opts;
    if (!el || !o) return;
    const w = Math.round(el.clientWidth);
    chart.w = w;
    if (!w) return;
    const S = o.series, keys = S.map((s) => `<span><i class="${s.cls}"></i>${esc(s.name)}</span>`).join('');
    const vals = S.flatMap((s) => s.values).filter(good);
    if (!vals.some((v) => v > 0)) {
      chart.g = null;
      el.innerHTML = `<div class="adm-lg">${keys}</div><div class="adm-lc-empty">${EMPTY}</div>`;
      return;
    }
    const lg = `<div class="adm-lg">${keys}<button class="adm-lg-tbl" type="button">${chart.table ? 'Ver gráfica' : 'Ver tabla'}</button></div>`;
    if (chart.table) {
      chart.g = null;
      el.innerHTML = lg + `<div class="adm-lc-table"><table><thead><tr><th>${esc(o.col)}</th>${S.map((s) => `<th>${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${
        o.tips.map((t, i) => (S.some((s) => good(s.values[i])) ? `<tr><td>${esc(t)}</td>${S.map((s) => `<td>${good(s.values[i]) ? esc(o.fmt(s.values[i])) : '—'}</td>`).join('')}</tr>` : '')).join('')}</tbody></table></div>`;
      return;
    }
    const H = 240, len = o.labels.length, axis = o.kind === 'time' ? durAxis : n;
    const sc = scale(Math.max(...vals), o.kind);
    const ticks = [];
    for (let v = 0; v <= sc.max + 1e-9; v += sc.step) ticks.push(v);
    const tickTxt = ticks.map(axis);
    const pad = { l: Math.max(30, Math.max(...tickTxt.map((t) => t.length)) * 6.3 + 14), r: 14, t: 12, b: 26 };
    const pw = w - pad.l - pad.r, ph = H - pad.t - pad.b;
    const X = (i) => pad.l + (len === 1 ? pw / 2 : i * pw / (len - 1));
    const Y = (v) => pad.t + ph * (1 - v / sc.max);
    let svg = `<svg width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" role="img" aria-label="${esc(o.label)}"><defs><linearGradient id="mp-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="ar-top"/><stop offset="1" class="ar-bot"/></linearGradient></defs>`;
    ticks.forEach((v, k) => {
      const y = Math.round(Y(v)) + .5;
      svg += `<line class="${k ? 'g' : 'base'}" x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}"/><text class="ax" x="${pad.l - 8}" y="${y + 4}" text-anchor="end">${esc(tickTxt[k])}</text>`;
    });
    const every = Math.ceil(len / Math.max(2, Math.floor(pw / 74)));
    for (let i = 0; i < len; i += every) {
      const x = X(i), anchor = len > 1 && i === 0 ? 'start' : x + 26 > w ? 'end' : 'middle';
      svg += `<text class="ax" x="${x.toFixed(1)}" y="${H - 6}" text-anchor="${anchor}">${esc(o.labels[i])}</text>`;
    }
    const runs = (values) => {
      const out = [];
      let r = null;
      values.forEach((v, i) => { if (!good(v)) { r = null; return; } if (!r) out.push(r = []); r.push([X(i), Y(v)]); });
      return out;
    };
    for (const s of S.slice().reverse()) {
      for (const r of runs(s.values)) {
        if (r.length === 1) { svg += `<path class="ln ${s.cls}" style="stroke-width:5" d="M${r[0][0].toFixed(1)} ${r[0][1].toFixed(1)}h.01"/>`; continue; }
        const d = smooth(r);
        if (s.cls === 'main') svg += `<path d="${d}L${r[r.length - 1][0].toFixed(1)} ${Y(0).toFixed(1)}L${r[0][0].toFixed(1)} ${Y(0).toFixed(1)}Z" fill="url(#mp-g)"/>`;
        svg += `<path class="ln ${s.cls}" d="${d}"/>`;
      }
    }
    svg += `<line class="xh" x1="0" x2="0" y1="${pad.t}" y2="${H - pad.b}"/>` + S.map((s) => `<circle class="xd ${s.cls}" r="4.5" cx="-20" cy="-20"/>`).join('') + '</svg>';
    el.innerHTML = lg + svg + '<div class="adm-tt" aria-hidden="true"></div>';
    chart.g = { X, Y, S, pad, w, len };
    if (chart.i >= len) chart.i = -1;
  }
  function hover(i) {
    if (!chart.g) return;
    const el = chart.el, { X, Y, S, pad, w } = chart.g, o = chart.opts, x = X(i);
    chart.i = i;
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
    tt.innerHTML = `<h4>${esc(o.tips[i])}</h4>` + S.map((s) => `<p><i class="${s.cls}"></i><b>${good(s.values[i]) ? esc(o.fmt(s.values[i])) : '—'}</b><span>${esc(s.sub ? s.sub[i] : s.name)}</span></p>`).join('');
    const top = el.querySelector('svg').getBoundingClientRect().top - el.getBoundingClientRect().top, tw = tt.offsetWidth;
    const left = x + 16 + tw > w ? Math.max(0, x - 16 - tw) : x + 16;
    tt.style.transform = `translate(${left.toFixed(0)}px, ${(top + pad.t).toFixed(0)}px)`;
    tt.classList.add('on');
  }
  function bindChart(el) {
    chart.el = el;
    el.tabIndex = 0;
    const unhover = () => { el.classList.remove('is-hover'); const tt = el.querySelector('.adm-tt'); if (tt) tt.classList.remove('on'); };
    const move = (e) => {
      const svg = e.target.closest('svg');
      if (!svg || !chart.g) return;
      const { pad, len, w } = chart.g, x = e.clientX - svg.getBoundingClientRect().left;
      hover(Math.max(0, Math.min(len - 1, Math.round((x - pad.l) / (len === 1 ? 1 : (w - pad.l - pad.r) / (len - 1))))));
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerdown', move);
    el.addEventListener('pointerleave', unhover);
    el.addEventListener('blur', unhover);
    el.addEventListener('focus', () => {
      if (!chart.g) return;
      let i = chart.i;
      if (i < 0) for (i = chart.g.len - 1; i > 0 && !chart.g.S.some((s) => good(s.values[i])); i--);
      hover(i);
    });
    el.addEventListener('keydown', (e) => {
      const k = { ArrowLeft: -1, ArrowRight: 1, Home: -1e4, End: 1e4 }[e.key];
      if (!k || !chart.g) return;
      e.preventDefault();
      hover(Math.max(0, Math.min(chart.g.len - 1, (chart.i < 0 ? 0 : chart.i) + k)));
    });
    el.addEventListener('click', (e) => {
      if (!e.target.closest('.adm-lg-tbl')) return;
      chart.table = !chart.table;
      draw();
    });
    if ('ResizeObserver' in window) new ResizeObserver((entries) => { if (Math.abs(chart.w - entries[0].contentRect.width) > 1) draw(); }).observe(el);
  }
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

  // ---------- los datos de ejemplo de la cuenta de prueba (con la misma forma que client_sessions) ----------
  function demoRows(since) {
    let seed = 20261101;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pick = (list) => list[Math.floor(rnd() * list.length)];
    const PAGES = ['/', '/', '/', '/servicios', '/servicios', '/precios', '/reservas', '/nosotros'];
    const FROM = [['google.com'], ['google.com'], ['google.com'], ['instagram.com'], ['instagram.com'], ['facebook.com'], [null], [null], [null, 'tiktok', 'social', 'promo-noviembre']];
    const DEV = ['móvil', 'móvil', 'móvil', 'móvil', 'computador', 'computador', 'tablet'];
    const WAYS = ['WhatsApp', 'WhatsApp', 'WhatsApp', 'WhatsApp', 'Llamada', 'Formulario', 'Compra'];
    const now = new Date(), rows = [];
    for (let d = 0; d < 180; d++) {
      const base = Math.max(3, 16 + 6 * Math.sin(d / 5) - d * .05);
      const count = Math.round(base * (.75 + rnd() * .5));
      for (let k = 0; k < count; k++) {
        const start = new Date(startOf(addDays(now, -d)).getTime() + rnd() * 864e5);
        const pages = [pick(PAGES)];
        while (rnd() < .42 && pages.length < 5) pages.push(pick(PAGES));
        const from = pick(FROM), hit = rnd() < .12, secs = rnd() < .22 ? Math.round(rnd() * 15) : Math.round(20 + rnd() * 220);
        if (start > now) continue;
        rows.push({
          session: 'd' + d + '-' + k, visitor: 'v' + Math.floor(rnd() * 500), started_at: start.toISOString(), last_at: new Date(start.getTime() + secs * 1000).toISOString(),
          pages, referrer: from[0] || null, utm_source: from[1] || null, utm_medium: from[2] || null, utm_campaign: from[3] || null,
          device: pick(DEV), tz: 'America/Bogota', visit_no: rnd() < .3 ? 2 : 1, clicks: hit ? [pick(WAYS)] : null, duration: secs, scroll: Math.round(25 + rnd() * 75)
        });
      }
    }
    for (let k = 0; k < 2; k++) rows.push({ session: 'ahora-' + k, visitor: 'va' + k, started_at: new Date(now - (k + 1) * 6e4).toISOString(), last_at: new Date(now - k * 3e4).toISOString(), pages: ['/'], referrer: 'instagram.com', device: 'móvil', visit_no: 1, clicks: null, duration: 40, scroll: 30 });
    return rows.filter((r) => new Date(r.started_at) >= since).sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
  }

  // ---------- leer ----------
  async function fetchClients() {
    if (demo) {
      const t = startOf(new Date());
      const y = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      return [{ ...DEMO_CLIENT, started_on: y(addDays(t, -40)), free_until: y(addDays(t, 50)) }];
    }
    const { data, error } = await sb.rpc('my_clients');
    if (error) throw error;
    return data || [];
  }
  async function fetchSessions(since) {
    if (demo) return demoRows(since);
    const rows = [];
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await sb.rpc('client_sessions', { p_client: client.id, p_since: since.toISOString() }).range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    return rows;
  }
  const prepare = (rows) => rows.map((r) => {
    const clicks = r.clicks || [], pages = r.pages || [];
    return {
      id: r.session, visitor: r.visitor, start: new Date(r.started_at), last: new Date(r.last_at), pages, clicks,
      src: source(r), referrer: r.referrer, utm_source: r.utm_source, utm_medium: r.utm_medium, utm_campaign: r.utm_campaign,
      device: r.device || '', back: (r.visit_no || 1) > 1, dur: r.duration || 0, scroll: r.scroll || 0,
      contact: clicks.length > 0, bounce: !clicks.length && pages.length <= 1 && (r.duration || 0) < 20
    };
  });

  // ---------- pintar ----------
  const delta = (c, p) => {
    if (!p) return c ? '<em class="adm-d up">nuevo</em>' : '';
    const d = Math.round((c - p) / p * 100);
    if (!d) return '<em class="adm-d">=</em>';
    return `<em class="adm-d ${d > 0 ? 'up' : 'down'}">${d > 0 ? '↑' : '↓'} ${Math.abs(d)}%</em>`;
  };
  const bars = (rows, total) => {
    if (!rows.length) return `<li class="adm-empty">${EMPTY}</li>`;
    const top = Math.max(...rows.map((r) => r[1]), 1);
    return rows.map(([k, v]) => `<li><span title="${esc(k)}">${esc(k)}</span><i style="--w:${(v / top).toFixed(3)}"></i><b>${n(v)} <small>${pct(v, total)}%</small></b></li>`).join('');
  };
  const when = (d) => {
    const mins = Math.round((Date.now() - d) / 6e4);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins} min`;
    return d.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  };
  function renderHead() {
    $('#mp-name').textContent = client.name;
    $('#mp-kicker').textContent = 'Tu panel · ' + (PLAN[client.plan] || '');
    $('#mp-demo').hidden = !(demo || client.is_test);
    const free = $('#mp-free'), until = client.free_until && parseYmd(client.free_until);
    free.hidden = !until || until < startOf(new Date());
    if (!free.hidden) {
      const after = client.plan === 'mide' ? 'tu mensualidad' : 'tu mensualidad y el trabajo de tu analista de datos';
      free.textContent = `Estás en tus 3 meses gratis de registro de datos, hasta el ${longDate(until)}. Después empieza ${after}.`;
    }
    const note = $('#mp-note');
    note.hidden = client.status === 'activo';
    if (!note.hidden) note.textContent = 'Tu panel está en pausa: no estamos registrando visitas nuevas. Escríbenos para volver a activarlo.';
  }
  function renderPeriod() {
    const f = (d) => d.getDate() + ' ' + d.toLocaleDateString('es-CO', { month: 'short' });
    $('#mp-period').textContent = days === 1 ? 'Hoy, ' + f(W.now) + ' · frente a ayer a esta misma hora' : f(W.start) + ' – ' + f(W.now) + ' · frente a los ' + days + ' días anteriores';
  }
  function renderKpis() {
    const avg = (l) => METRICS.time.fn(l) || 0;
    const items = [
      ['visits', 'Visitas', n(cur.length), delta(cur.length, prev.length), `${n(cur.filter((s) => s.back).length)} de personas que vuelven`],
      ['people', 'Personas', n(METRICS.people.fn(cur)), delta(METRICS.people.fn(cur), METRICS.people.fn(prev)), 'cada navegador cuenta como una'],
      ['contacts', 'Te contactan', n(contactsOf(cur)), delta(contactsOf(cur), contactsOf(prev)), `${pct(contactsOf(cur), cur.length)}% de las visitas`],
      ['time', 'Tiempo promedio', dur(avg(cur)), delta(avg(cur), avg(prev)), `${pct(cur.filter((s) => s.bounce).length, cur.length)}% se va enseguida`]
    ];
    $('#mp-kpis').innerHTML = items.map(([m, k, v, d, s]) => `<button class="adm-kpi glass" type="button" data-metric="${m}" aria-pressed="${m === metric}" title="Ver en la gráfica"><small>${k}</small><span class="adm-kpi-val"><strong>${v}</strong>${d}</span><span class="adm-kpi-sub">${s}</span>${spark(seriesBy(cur, W.start, METRICS[m].fn))}</button>`).join('');
  }
  function renderMain() {
    const m = METRICS[metric];
    $('#mp-main-title').textContent = m.name;
    $('#mp-main-sub').textContent = 'por ' + B.word;
    $$('#mp-metric [data-metric]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.metric === metric)));
    $$('#mp-kpis [data-metric]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.metric === metric)));
    chart.opts = {
      labels: B.labels, tips: B.longs, col: cap(B.word), kind: m.kind, fmt: m.fmt, label: m.name,
      series: [
        { name: 'Este periodo', cls: 'main', values: seriesBy(cur, W.start, m.fn) },
        { name: 'Periodo anterior', cls: 'prev', values: seriesBy(prev, W.prevStart, m.fn), sub: B.prevLongs }
      ]
    };
    draw();
  }
  function renderLists() {
    $('#mp-sources').innerHTML = bars(countBy(cur, (s) => s.src).slice(0, 7), cur.length);
    const ways = new Map();
    for (const s of cur) for (const w of new Set(s.clicks)) ways.set(w, (ways.get(w) || 0) + 1);
    $('#mp-contacts').innerHTML = bars([...ways.entries()].sort((a, b) => b[1] - a[1]), cur.length);
    const views = new Map();
    for (const s of cur) for (const p of s.pages) views.set(pageName(p), (views.get(pageName(p)) || 0) + 1);
    $('#mp-pages').innerHTML = bars([...views.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7), [...views.values()].reduce((a, b) => a + b, 0));
    $('#mp-devices').innerHTML = bars(countBy(cur, (s) => cap(s.device)), cur.length);
  }
  function renderVisits() {
    $('#mp-vi-count').textContent = `${n(cur.length)} ${cur.length === 1 ? 'visita' : 'visitas'} en el periodo`;
    $('#mp-visits').innerHTML = cur.slice(0, shown).map((s) => `<tr>
      <td>${when(s.start)}</td><td>${esc(pageName(s.pages[0]))}${s.pages.length > 1 ? `<small>y ${s.pages.length - 1} más</small>` : ''}</td>
      <td>${esc(s.src)}${s.utm_campaign ? `<small>${esc(s.utm_campaign)}</small>` : ''}</td><td>${esc(cap(s.device))}</td><td>${s.dur ? dur(s.dur) : '—'}</td>
      <td>${s.contact ? `<span class="adm-ok">${esc(s.clicks[0])}</span>` : s.bounce ? '<span class="adm-muted">Se fue enseguida</span>' : '—'}</td></tr>`).join('');
    $('#mp-vi-more').hidden = cur.length <= shown;
  }
  function renderLive() {
    $('#mp-live').textContent = n(cur.filter((s) => Date.now() - s.last < 5 * 6e4).length);
  }
  function renderAll() {
    const none = !cur.length && !prev.length;
    $('#mp-wait').hidden = !none;
    $('#mp-data').hidden = none;
    renderHead();
    renderPeriod();
    renderLive();
    if (none) return;
    renderKpis();
    renderMain();
    renderLists();
    renderVisits();
  }
  async function refresh() {
    if (busy || !client) return;
    busy = true;
    $('#mp-status').textContent = 'Cargando…';
    $('.adm-main').classList.add('is-loading');
    try {
      W = windowFor(days);
      B = bucketsFor(W);
      const all = prepare(await fetchSessions(W.prevStart));
      cur = all.filter((s) => s.start >= W.start);
      prev = all.filter((s) => s.start >= W.prevStart && s.start < W.prevEnd);
      renderAll();
      $('#mp-status').textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
    } catch (err) {
      $('#mp-status').textContent = 'No se pudieron cargar los datos. Revisa tu internet e intenta de nuevo.';
    }
    $('.adm-main').classList.remove('is-loading');
    busy = false;
  }

  // ---------- descargar para Excel: sus datos son suyos ----------
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
  $('#mp-csv').addEventListener('click', () => {
    const stamp = new Date().toISOString().slice(0, 10);
    download(`visitas-${days === 1 ? 'hoy' : days + '-dias'}-${stamp}.csv`,
      ['fecha', 'hora', 'paginas', 'origen', 'sitio', 'utm_source', 'utm_medium', 'utm_campaign', 'dispositivo', 'nueva', 'tiempo_s', 'bajo_pct', 'contacto'],
      cur.map((s) => [s.start.toLocaleDateString('es-CO'), s.start.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }), s.pages.map(pageName).join(' > '), s.src, s.referrer,
        s.utm_source, s.utm_medium, s.utm_campaign, s.device, s.back ? 'no' : 'sí', s.dur, s.scroll, s.clicks.join(' | ')]));
  });

  // ---------- entrar y salir ----------
  function chooseClient() {
    let saved = null;
    try { saved = localStorage.getItem('gotia-mp-client'); } catch (e) {}
    client = clients.find((c) => c.id === saved) || clients[0];
    $('#mp-pick').hidden = clients.length < 2;
    const sel = $('#mp-client');
    sel.textContent = '';
    clients.forEach((c) => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.name;
      sel.appendChild(o);
    });
    sel.value = client.id;
  }
  function showPanel() {
    $('#mp-login').hidden = true;
    $('#mp').hidden = false;
    chooseClient();
    refresh();
    clearInterval(timer);
    timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 30e3);   // casi en vivo: cada 30 s
  }
  function showLogin(msg) {
    clearInterval(timer);
    client = null;
    $('#mp').hidden = true;
    $('#mp-login').hidden = false;
    $('#mp-error').textContent = msg || '';
  }
  $('#mp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!sb) return;
    const btn = $('#mp-go');
    btn.disabled = true;
    btn.textContent = 'Entrando…';
    $('#mp-error').textContent = '';
    const { error } = await sb.auth.signInWithPassword({ email: $('#mp-email').value.trim(), password: $('#mp-pass').value });
    if (error) {
      btn.disabled = false;
      btn.textContent = 'Entrar';
      $('#mp-error').textContent = 'Correo o contraseña incorrectos.';
      return;
    }
    let msg = '';
    try {
      clients = await fetchClients();
      if (!clients.length) msg = 'Esta cuenta todavía no tiene un panel. Escríbenos y te ayudamos.';
    } catch (err) {
      msg = 'No pudimos abrir tu panel. Intenta de nuevo en un momento.';
    }
    btn.disabled = false;
    btn.textContent = 'Entrar';
    if (msg) { await sb.auth.signOut(); $('#mp-error').textContent = msg; return; }
    $('#mp-pass').value = '';
    showPanel();
  });
  $('#mp-logout').addEventListener('click', async () => {
    if (demo) { location.href = 'index.html'; return; }
    await sb.auth.signOut();
    try { localStorage.removeItem('gotia-mp-client'); } catch (e) {}
    showLogin('Saliste de tu panel.');
  });
  $('#mp-client').addEventListener('change', (e) => {
    client = clients.find((c) => c.id === e.target.value) || client;
    try { localStorage.setItem('gotia-mp-client', client.id); } catch (err) {}
    shown = 10;
    refresh();
  });
  $('#mp-refresh').addEventListener('click', refresh);
  $('#mp-vi-more').addEventListener('click', () => { shown += 20; renderVisits(); });
  $$('.adm-range button').forEach((b) => b.addEventListener('click', () => {
    days = Number(b.dataset.days);
    shown = 10;
    $$('.adm-range button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    refresh();
  }));
  const pickMetric = (e) => {
    const b = e.target.closest('[data-metric]');
    if (!b) return;
    metric = b.dataset.metric;
    renderMain();
  };
  $('#mp-kpis').addEventListener('click', pickMetric);
  $('#mp-metric').addEventListener('click', pickMetric);
  $('#mp-theme').addEventListener('click', () => {
    const dark = root.dataset.theme !== 'dark';
    if (dark) root.dataset.theme = 'dark'; else delete root.dataset.theme;
    $('meta[name="color-scheme"]').content = dark ? 'dark' : 'light';
    $('meta[name="theme-color"]').content = dark ? '#000000' : '#eaf3ff';
    try { localStorage.setItem('gotia-theme', dark ? 'dark' : 'light'); } catch (e) {}
  });
  bindChart($('#mp-chart'));
  if (demo) $('#mp-logout').textContent = 'Ir a la web';

  // ---------- al abrir ----------
  (async () => {
    if (demo) { clients = await fetchClients(); showPanel(); return; }
    if (!window.supabase || !window.supabase.createClient) { showLogin('No se pudo cargar la conexión. Revisa tu internet y recarga.'); return; }
    sb = window.supabase.createClient(cfg.url, cfg.anonKey);
    const { data } = await sb.auth.getSession();
    if (!data || !data.session) { showLogin(); return; }
    try { clients = await fetchClients(); } catch (e) { clients = []; }
    if (clients.length) showPanel(); else showLogin();
  })();
})();
