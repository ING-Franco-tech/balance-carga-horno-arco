/* Gráficas SVG propias: se dibujan con las variables de color del tema */
const NS = 'http://www.w3.org/2000/svg';
const Charts = (() => {
  let tip;
  function ensureTip() {
    if (!tip) { tip = document.createElement('div'); tip.className = 'ctip'; tip.hidden = true; document.body.appendChild(tip); }
    return tip;
  }
  function showTip(html, ev) {
    const t = ensureTip(); t.innerHTML = html; t.hidden = false;
    const pad = 14; const w = t.offsetWidth, h = t.offsetHeight;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = ev.clientY - h - pad;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  function hideTip() { if (tip) tip.hidden = true; }
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, attrs = {}) { const t = el('text', Object.assign({ x, y }, attrs), parent); t.textContent = s; return t; }
  function nice(min, max, n = 5) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min; const step0 = span / n; const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const r = step0 / mag; const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const ticks = []; for (let v = lo; v <= hi + step * 1e-6; v += step) ticks.push(+v.toFixed(10));
    return { lo, hi, step, ticks };
  }
  const fmtN = (v, d = 0) => v.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
  function frame(host, height) {
    host.innerHTML = '';
    const W = Math.max(280, host.clientWidth || 600);
    const svg = el('svg', { viewBox: `0 0 ${W} ${height}`, width: '100%', height, class: 'chart', role: 'img' }, host);
    return { svg, W, H: height };
  }

  // ---- Línea / área con eje secundario ----
  function line(host, o) {
    const H = o.height || 260;
    const { svg, W } = frame(host, H);
    const m = { l: 58, r: o.y2 ? 58 : 18, t: 16, b: 40 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const all = o.series.flatMap(s => s.points.filter(p => p[1] != null));
    const xs = all.map(p => p[0]);
    const xMin = o.x.min ?? Math.min(...xs), xMax = o.x.max ?? Math.max(...xs);
    function yr(axis) {
      const pts = o.series.filter(s => (s.axis || 'y') === axis).flatMap(s => s.points.filter(p => p[1] != null).map(p => p[1]));
      const extra = (o.hlines || []).filter(h => (h.axis || 'y') === axis).map(h => h.y);
      const cfg = o[axis] || {};
      const lo = cfg.min ?? Math.min(...pts, ...extra), hi = cfg.max ?? Math.max(...pts, ...extra);
      const pad = (hi - lo) * 0.08 || 1;
      return nice(cfg.min ?? lo - pad, cfg.max ?? hi + pad, 5);
    }
    const Y = yr('y'); const Y2 = o.y2 ? yr('y2') : null;
    const sx = v => m.l + (v - xMin) / (xMax - xMin || 1) * pw;
    const sy = (v, ax) => { const S = ax === 'y2' ? Y2 : Y; return m.t + ph - (v - S.lo) / (S.hi - S.lo) * ph; };
    const g = el('g', {}, svg);
    (o.bands || []).forEach(b => {
      const y1 = sy(Math.min(b.hi, Y.hi), b.axis), y2 = sy(Math.max(b.lo, Y.lo), b.axis);
      el('rect', { x: m.l, y: y1, width: pw, height: Math.max(0, y2 - y1), fill: b.color, opacity: b.opacity ?? 0.12 }, g);
      if (b.label) txt(g, m.l + pw - 6, y1 + 13, b.label, { class: 'c-note', 'text-anchor': 'end' });
    });
    (o.xbands || []).forEach(b => {
      el('rect', { x: sx(b.from), y: m.t, width: Math.max(0, sx(b.to) - sx(b.from)), height: ph, fill: b.color, opacity: b.opacity ?? 0.10 }, g);
      if (b.label) txt(g, sx(b.from) + 6, m.t + 13, b.label, { class: 'c-note' });
    });
    Y.ticks.forEach(t => {
      el('line', { x1: m.l, x2: m.l + pw, y1: sy(t), y2: sy(t), class: 'c-grid' }, g);
      txt(g, m.l - 8, sy(t) + 4, (o.y.fmt || fmtN)(t), { class: 'c-tick', 'text-anchor': 'end' });
    });
    if (Y2) Y2.ticks.forEach(t => txt(g, m.l + pw + 8, sy(t, 'y2') + 4, (o.y2.fmt || fmtN)(t), { class: 'c-tick' }));
    const X = o.x.ticks ? { ticks: o.x.ticks } : nice(xMin, xMax, Math.max(3, Math.min(8, Math.floor(pw / 80))));
    X.ticks.filter(t => t >= xMin - 1e-9 && t <= xMax + 1e-9).forEach(t => {
      el('line', { x1: sx(t), x2: sx(t), y1: m.t + ph, y2: m.t + ph + 4, class: 'c-axis' }, g);
      txt(g, sx(t), m.t + ph + 17, (o.x.fmt || fmtN)(t), { class: 'c-tick', 'text-anchor': 'middle' });
    });
    el('line', { x1: m.l, x2: m.l + pw, y1: m.t + ph, y2: m.t + ph, class: 'c-axis' }, g);
    if (o.x.label) txt(g, m.l + pw / 2, H - 6, o.x.label, { class: 'c-label', 'text-anchor': 'middle' });
    if (o.y.label) txt(g, 14, m.t + ph / 2, o.y.label, { class: 'c-label', 'text-anchor': 'middle', transform: `rotate(-90 14 ${m.t + ph / 2})` });
    if (o.y2 && o.y2.label) txt(g, W - 12, m.t + ph / 2, o.y2.label, { class: 'c-label', 'text-anchor': 'middle', transform: `rotate(90 ${W - 12} ${m.t + ph / 2})` });
    (o.hlines || []).forEach(h => {
      const y = sy(h.y, h.axis);
      el('line', { x1: m.l, x2: m.l + pw, y1: y, y2: y, stroke: h.color, 'stroke-width': 1.5, 'stroke-dasharray': h.dash || '5 4' }, g);
      if (h.label) txt(g, (h.axis === 'y2' ? m.l + 6 : m.l + pw - 6), y - 6, h.label, { class: 'c-note', fill: h.color, 'text-anchor': h.axis === 'y2' ? 'start' : 'end' });
    });
    (o.vlines || []).forEach(v => {
      const x = sx(v.x);
      el('line', { x1: x, x2: x, y1: m.t, y2: m.t + ph, stroke: v.color, 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }, g);
      if (v.label) txt(g, x + 5, m.t + 12, v.label, { class: 'c-note', fill: v.color });
    });
    o.series.forEach(s => {
      const ax = s.axis || 'y';
      // segmentos (huecos con null)
      const segs = []; let cur = [];
      s.points.forEach(p => { if (p[1] == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push(p); });
      if (cur.length) segs.push(cur);
      segs.forEach(seg => {
        const d = seg.map((p, i) => (i ? 'L' : 'M') + sx(p[0]).toFixed(1) + ' ' + sy(p[1], ax).toFixed(1)).join(' ');
        if (s.area) {
          const base = sy(Math.max((ax === 'y2' ? Y2 : Y).lo, 0), ax);
          el('path', { d: d + ` L${sx(seg[seg.length - 1][0]).toFixed(1)} ${base} L${sx(seg[0][0]).toFixed(1)} ${base} Z`, fill: s.color, opacity: 0.10 }, g);
        }
        if (!s.dotsOnly) el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2, 'stroke-dasharray': s.dash || null, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
      });
      if (s.dots) s.points.forEach(p => { if (p[1] != null) el('circle', { cx: sx(p[0]), cy: sy(p[1], ax), r: p[2] && p[2].r || 3, fill: (p[2] && p[2].color) || s.color, stroke: 'var(--panel)', 'stroke-width': 1 }, g); });
    });
    (o.markers || []).forEach(mk => {
      const cx = sx(mk.x), cy = sy(mk.y, mk.axis);
      el('circle', { cx, cy, r: 6, fill: mk.color, stroke: 'var(--panel)', 'stroke-width': 2 }, g);
      if (mk.label) {
        const right = cx < m.l + pw * 0.7;
        txt(g, cx + (right ? 10 : -10), cy - 10, mk.label, { class: 'c-mark', fill: mk.color, 'text-anchor': right ? 'start' : 'end' });
      }
    });
    // interacción: cursor vertical
    const cross = el('line', { y1: m.t, y2: m.t + ph, class: 'c-cross', visibility: 'hidden' }, svg);
    const hit = el('rect', { x: m.l, y: m.t, width: pw, height: ph, fill: 'transparent' }, svg);
    hit.addEventListener('mousemove', ev => {
      const r = svg.getBoundingClientRect(); const scale = W / r.width;
      const px = (ev.clientX - r.left) * scale; const xv = xMin + (px - m.l) / pw * (xMax - xMin);
      let html = ''; let snapX = null;
      o.series.forEach(s => {
        if (s.noTip) return;
        let best = null; s.points.forEach(p => { if (p[1] != null && (!best || Math.abs(p[0] - xv) < Math.abs(best[0] - xv))) best = p; });
        if (best) { snapX = snapX ?? best[0]; html += `<div><i style="background:${s.color}"></i>${s.name}: <b>${(s.fmt || (v => fmtN(v, 1)))(best[1])}</b></div>`; }
      });
      if (snapX == null) return;
      cross.setAttribute('x1', sx(snapX)); cross.setAttribute('x2', sx(snapX)); cross.setAttribute('visibility', 'visible');
      showTip(`<div class="ctip-h">${o.x.tipLabel ? o.x.tipLabel(snapX) : (o.x.name || '') + ' ' + (o.x.fmt || fmtN)(snapX)}</div>` + html, ev);
    });
    hit.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });
    if (o.onClick) { hit.style.cursor = 'pointer'; hit.addEventListener('click', ev => { const r = svg.getBoundingClientRect(); const px = (ev.clientX - r.left) * (W / r.width); o.onClick(xMin + (px - m.l) / pw * (xMax - xMin)); }); }
  }

  // ---- Barras horizontales (composición, tornado) ----
  function barsH(host, o) {
    const rowH = o.rowH || 26; const H = o.rows.length * rowH + 34;
    const { svg, W } = frame(host, H);
    const m = { l: o.labelW || 190, r: o.rows.some(r => r.valText) ? 92 : 64, t: 8, b: 26 };
    const pw = W - m.l - m.r;
    const vals = o.rows.flatMap(r => r.lo != null ? [r.lo, r.hi] : [r.value]);
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    const S = nice(lo, hi, 5);
    const sx = v => m.l + (v - S.lo) / (S.hi - S.lo) * pw;
    const g = el('g', {}, svg);
    S.ticks.forEach(t => { el('line', { x1: sx(t), x2: sx(t), y1: m.t, y2: H - m.b, class: 'c-grid' }, g); txt(g, sx(t), H - 8, (o.fmt || fmtN)(t), { class: 'c-tick', 'text-anchor': 'middle' }); });
    el('line', { x1: sx(0), x2: sx(0), y1: m.t, y2: H - m.b, class: 'c-axis' }, g);
    o.rows.forEach((r, i) => {
      const y = m.t + i * rowH;
      const lab = txt(g, m.l - 10, y + rowH / 2 + 4, r.label, { class: 'c-cat', 'text-anchor': 'end' });
      if (r.label.length > 28) lab.textContent = r.label.slice(0, 27) + '…';
      if (r.lo != null) {
        [[r.lo, o.loColor], [r.hi, o.hiColor]].forEach(([v, col]) => {
          const x0 = sx(Math.min(0, v)), x1 = sx(Math.max(0, v));
          const b = el('rect', { x: x0, y: y + 5, width: Math.max(1, x1 - x0), height: rowH - 10, rx: 2, fill: col }, g);
          b.addEventListener('mousemove', ev => showTip(`<div class="ctip-h">${r.label}</div>${r.tip || ''}`, ev)); b.addEventListener('mouseleave', hideTip);
        });
        txt(g, sx(Math.max(r.hi, r.lo, 0)) + 6, y + rowH / 2 + 4, r.valText != null ? r.valText : (o.valFmt || fmtN)(Math.max(Math.abs(r.lo), Math.abs(r.hi))), { class: 'c-val' });
      } else {
        const x0 = sx(Math.min(0, r.value)), x1 = sx(Math.max(0, r.value));
        const b = el('rect', { x: x0, y: y + 5, width: Math.max(1, x1 - x0), height: rowH - 10, rx: 2, fill: r.color || 'var(--blue)' }, g);
        b.addEventListener('mousemove', ev => showTip(`<div class="ctip-h">${r.label}</div>${r.tip || (o.valFmt || fmtN)(r.value)}`, ev)); b.addEventListener('mouseleave', hideTip);
        txt(g, x1 + 6, y + rowH / 2 + 4, (o.valFmt || fmtN)(r.value), { class: 'c-val' });
      }
    });
    if (o.xLabel) txt(g, m.l + pw / 2, H - 8, '', {});
  }

  // ---- Cascada (balance de energía) ----
  function waterfall(host, o) {
    const H = o.height || 280;
    const { svg, W } = frame(host, H);
    const m = { l: 52, r: 12, t: 22, b: o.steps.some(s => s.label2) ? 58 : 34 };
    if ((W - m.l - m.r) / o.steps.length < 52) { m.b = 56; m.l = 44; }
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    let run = 0; const bars = [];
    o.steps.forEach(s => {
      if (s.total) { bars.push({ s, a: 0, b: s.value }); run = s.value; }
      else { bars.push({ s, a: run, b: run + s.value }); run += s.value; }
    });
    const vals = bars.flatMap(b => [b.a, b.b]);
    const S = nice(Math.min(0, ...vals), Math.max(...vals) * 1.06, 5);
    const sy = v => m.t + ph - (v - S.lo) / (S.hi - S.lo) * ph;
    const g = el('g', {}, svg);
    S.ticks.forEach(t => { el('line', { x1: m.l, x2: m.l + pw, y1: sy(t), y2: sy(t), class: 'c-grid' }, g); txt(g, m.l - 8, sy(t) + 4, fmtN(t), { class: 'c-tick', 'text-anchor': 'end' }); });
    const bw = pw / bars.length; const narrow = bw < 52;
    bars.forEach((b, i) => {
      const x = m.l + i * bw + bw * 0.16, w = bw * 0.68;
      const y1 = sy(Math.max(b.a, b.b)), y2 = sy(Math.min(b.a, b.b));
      const col = b.s.total ? (b.s.color || 'var(--accent)') : b.s.value >= 0 ? 'var(--warm)' : 'var(--teal)';
      const r = el('rect', { x, y: y1, width: w, height: Math.max(1.5, y2 - y1), rx: 2, fill: col }, g);
      r.addEventListener('mousemove', ev => showTip(`<div class="ctip-h">${b.s.full || b.s.label}</div>${b.s.total ? '' : (b.s.value >= 0 ? '+' : '')}${fmtN(b.s.value, 1)} kWh/t`, ev)); r.addEventListener('mouseleave', hideTip);
      if (i < bars.length - 1 && !bars[i + 1].s.total) el('line', { x1: x + w, x2: x + bw, y1: sy(b.b), y2: sy(b.b), class: 'c-axis', 'stroke-dasharray': '2 2' }, g);
      const av = Math.abs(b.s.value);
      txt(g, x + w / 2, y1 - 6, (b.s.total ? '' : (b.s.value >= 0 ? '+' : '−')) + fmtN(av, !b.s.total && av < 9.95 && !narrow ? 1 : 0), { class: 'c-val', 'text-anchor': 'middle', 'font-size': narrow ? 9.5 : null });
      if (narrow) {
        const lx = x + w / 2, ly = H - m.b + 12;
        txt(g, lx, ly, b.s.short || b.s.label, { class: 'c-cat', 'text-anchor': 'end', transform: `rotate(-45 ${lx} ${ly})` });
      } else {
        txt(g, x + w / 2, H - m.b + 16, b.s.label, { class: 'c-cat', 'text-anchor': 'middle' });
        if (b.s.label2) txt(g, x + w / 2, H - m.b + 30, b.s.label2, { class: 'c-cat', 'text-anchor': 'middle' });
      }
    });
    el('line', { x1: m.l, x2: m.l + pw, y1: sy(0), y2: sy(0), class: 'c-axis' }, g);
    txt(g, 14, m.t + ph / 2, 'kWh/t', { class: 'c-label', 'text-anchor': 'middle', transform: `rotate(-90 14 ${m.t + ph / 2})` });
  }

  // ---- Dispersión con línea de paridad ----
  function scatter(host, o) {
    const H = o.height || 300;
    const { svg, W } = frame(host, H);
    const m = { l: 58, r: 16, t: 14, b: 42 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const xs = o.points.map(p => p.x), ys = o.points.map(p => p.y);
    let lo = Math.min(...xs, ...ys), hi = Math.max(...xs, ...ys);
    const pad = (hi - lo) * 0.06; const S = nice(lo - pad, hi + pad, 5);
    const sx = v => m.l + (v - S.lo) / (S.hi - S.lo) * pw, sy = v => m.t + ph - (v - S.lo) / (S.hi - S.lo) * ph;
    const g = el('g', {}, svg);
    S.ticks.forEach(t => {
      el('line', { x1: m.l, x2: m.l + pw, y1: sy(t), y2: sy(t), class: 'c-grid' }, g);
      txt(g, m.l - 8, sy(t) + 4, fmtN(t), { class: 'c-tick', 'text-anchor': 'end' });
      txt(g, sx(t), m.t + ph + 17, fmtN(t), { class: 'c-tick', 'text-anchor': 'middle' });
    });
    if (o.band) el('path', { d: `M${sx(S.lo)} ${sy(S.lo + o.band)} L${sx(S.hi - o.band)} ${sy(S.hi)} L${sx(S.hi)} ${sy(S.hi)} L${sx(S.hi)} ${sy(S.hi - o.band)} L${sx(S.lo + o.band)} ${sy(S.lo)} L${sx(S.lo)} ${sy(S.lo)} Z`, fill: 'var(--blue)', opacity: 0.08 }, g);
    el('line', { x1: sx(S.lo), y1: sy(S.lo), x2: sx(S.hi), y2: sy(S.hi), stroke: 'var(--ink-3)', 'stroke-dasharray': '5 4' }, g);
    if (o.band) txt(g, sx(S.lo) + 8, m.t + 14, `Banda ±${o.band} kWh/t`, { class: 'c-note' });
    o.points.forEach(p => {
      const c = el('circle', { cx: sx(p.x), cy: sy(p.y), r: 4.2, fill: p.color || 'var(--blue)', 'fill-opacity': 0.85, stroke: 'var(--panel)', 'stroke-width': 1 }, g);
      c.addEventListener('mousemove', ev => showTip(p.tip, ev)); c.addEventListener('mouseleave', hideTip);
      if (o.onClick) { c.style.cursor = 'pointer'; c.addEventListener('click', () => o.onClick(p)); }
    });
    el('line', { x1: m.l, x2: m.l + pw, y1: m.t + ph, y2: m.t + ph, class: 'c-axis' }, g);
    txt(g, m.l + pw / 2, H - 6, o.xLabel, { class: 'c-label', 'text-anchor': 'middle' });
    txt(g, 14, m.t + ph / 2, o.yLabel, { class: 'c-label', 'text-anchor': 'middle', transform: `rotate(-90 14 ${m.t + ph / 2})` });
  }

  // ---- Mapa de calor ----
  function heatmap(host, o) {
    const H = o.height || 320;
    const { svg, W } = frame(host, H);
    const m = { l: 62, r: 86, t: 12, b: 44 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const nx = o.xs.length, ny = o.ys.length; const cw = pw / nx, ch = ph / ny;
    const g = el('g', {}, svg);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = o.z[j][i];
      const r = el('rect', { x: m.l + i * cw, y: m.t + (ny - 1 - j) * ch, width: cw + 0.5, height: ch + 0.5, fill: v == null ? 'var(--line)' : o.color(v) }, g);
      r.addEventListener('mousemove', ev => showTip(o.tip(o.xs[i], o.ys[j], v), ev)); r.addEventListener('mouseleave', hideTip);
    }
    const stepX = Math.ceil(nx / Math.max(3, Math.floor(pw / 70)));
    o.xs.forEach((v, i) => { if (i % stepX === 0) txt(g, m.l + (i + 0.5) * cw, m.t + ph + 16, o.xFmt(v), { class: 'c-tick', 'text-anchor': 'middle' }); });
    const stepY = Math.ceil(ny / 6);
    o.ys.forEach((v, j) => { if (j % stepY === 0) txt(g, m.l - 8, m.t + (ny - 1 - j + 0.5) * ch + 4, o.yFmt(v), { class: 'c-tick', 'text-anchor': 'end' }); });
    txt(g, m.l + pw / 2, H - 6, o.xLabel, { class: 'c-label', 'text-anchor': 'middle' });
    txt(g, 14, m.t + ph / 2, o.yLabel, { class: 'c-label', 'text-anchor': 'middle', transform: `rotate(-90 14 ${m.t + ph / 2})` });
    if (o.marker) {
      const fx = (o.marker.x - o.xs[0]) / (o.xs[nx - 1] - o.xs[0]), fy = (o.marker.y - o.ys[0]) / (o.ys[ny - 1] - o.ys[0]);
      if (fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1) {
        const cx = m.l + cw / 2 + fx * (pw - cw), cy = m.t + ph - ch / 2 - fy * (ph - ch);
        el('circle', { cx, cy, r: 7, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.5 }, g);
        el('circle', { cx, cy, r: 2.5, fill: 'var(--ink)' }, g);
        txt(g, cx + 11, cy + 4, 'Condición actual', { class: 'c-mark', fill: 'var(--ink)' });
      }
    }
    // leyenda
    const lx = W - m.r + 22, lh = ph;
    for (let k = 0; k < 40; k++) { const v = o.legend.min + (o.legend.max - o.legend.min) * (1 - k / 39); el('rect', { x: lx, y: m.t + k * lh / 40, width: 14, height: lh / 40 + 0.5, fill: o.color(v) }, g); }
    [o.legend.max, (o.legend.max + o.legend.min) / 2, o.legend.min].forEach((v, k) => txt(g, lx + 20, m.t + k * lh / 2 + 4, o.legend.fmt(v), { class: 'c-tick' }));
  }


  // ---- Diagrama de flujo del horno (masa o energía) ----
  function sankey(host, o) {
    host.innerHTML = '';
    const W = Math.max(320, host.clientWidth || 900);
    const narrow = W < 680;
    const labW = Math.max(96, Math.min(210, W * 0.21));
    const nodeW = 9;
    const xL = labW, xR = W - labW - nodeW;
    const fw = Math.max(120, Math.min(280, (xR - xL - 2 * nodeW) * 0.4));
    const fx0 = W / 2 - fw / 2, fx1 = W / 2 + fw / 2;
    const left = o.left.filter(n => n.value > 1e-9), right = o.right.filter(n => n.value > 1e-9);
    const sumL = left.reduce((s, n) => s + n.value, 0), sumR = right.reduce((s, n) => s + n.value, 0);
    const tot = Math.max(sumL, sumR) || 1;
    const T = narrow ? 104 : 150;
    const k = T / tot;
    const minSlot = narrow ? 40 : 46, gap = narrow ? 6 : 10;
    const slots = arr => arr.map(n => Math.max(n.value * k + gap, minSlot));
    const sl = slots(left), sr = slots(right);
    const SL = sl.reduce((a, b) => a + b, 0), SR = sr.reduce((a, b) => a + b, 0);
    let H = Math.max(o.height || 440, SL + 40, SR + 40, T + 250);
    const cy = Math.max(H * 0.58, T / 2 + 150);
    H = Math.max(H, cy + T / 2 + 60);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, class: 'chart', role: 'img', 'aria-label': o.aria || 'Diagrama de balance' }, host);
    const defs = el('defs', {}, svg);
    const uid = 'sk' + Math.random().toString(36).slice(2, 7);
    const bath = el('linearGradient', { id: uid + 'b', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    [['0', '#FFD27A'], ['.35', '#FFA43A'], ['.7', '#F0661A'], ['1', '#B8410A']].forEach(([of, col]) => el('stop', { offset: of, 'stop-color': col }, bath));
    const shell = el('linearGradient', { id: uid + 's', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    [['0', '#24496F'], ['.5', '#3A6D9C'], ['1', '#24496F']].forEach(([of, col]) => el('stop', { offset: of, 'stop-color': col }, shell));
    const gasg = el('linearGradient', { id: uid + 'g', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    [['0', '#E9EEF4'], ['1', '#FFE8CC']].forEach(([of, col]) => el('stop', { offset: of, 'stop-color': col }, gasg));
    const glow = el('radialGradient', { id: uid + 'a', cx: '50%', cy: '50%', r: '50%' }, defs);
    [['0', '#FFFFFF', 1], ['.35', '#FFF2B8', .95], ['1', '#FFB547', 0]].forEach(([of, col, op]) => el('stop', { offset: of, 'stop-color': col, 'stop-opacity': op }, glow));
    const g = el('g', {}, svg);
    const ribbons = [];
    function ribbon(x0, a0, a1, x1, b0, b1, color, n, tot2) {
      const xm = (x0 + x1) / 2;
      const d = `M${x0} ${a0} C${xm} ${a0} ${xm} ${b0} ${x1} ${b0} L${x1} ${b1} C${xm} ${b1} ${xm} ${a1} ${x0} ${a1} Z`;
      const p = el('path', { d, fill: color, 'fill-opacity': 0.30, class: 's-ribbon' }, g);
      ribbons.push(p);
      p.addEventListener('mousemove', ev => { ribbons.forEach(r => r.style.opacity = r === p ? 1 : 0.35); p.setAttribute('fill-opacity', 0.55); showTip(`<div class="ctip-h">${n.label}</div>${n.fmt(n.value)} · ${fmtN(n.value / tot2 * 100, 1)} %`, ev); });
      p.addEventListener('mouseleave', () => { ribbons.forEach(r => r.style.opacity = 1); p.setAttribute('fill-opacity', 0.30); hideTip(); });
    }
    function nameFit(s, maxW, px) { const cw = px * 0.52; const n = Math.floor(maxW / cw); return s.length > n ? s.slice(0, Math.max(3, n - 1)) + '…' : s; }
    const nameSize = narrow ? 11.5 : 13, valSize = narrow ? 15 : 17;
    // izquierda
    let y = (H - SL) / 2, yin = cy - (sumL * k) / 2;
    left.forEach((n, i) => {
      const h = Math.max(2, n.value * k), yc = y + sl[i] / 2, y0 = yc - h / 2;
      ribbon(xL + nodeW, y0, y0 + h, fx0 + 6, yin, yin + h, n.color, n, sumL);
      el('rect', { x: xL, y: y0, width: nodeW, height: h, rx: 2.5, fill: n.color }, g);
      txt(g, xL - 10, yc - 3, nameFit(n.label, labW - 16, nameSize), { class: 's-name', 'text-anchor': 'end', 'font-size': nameSize });
      txt(g, xL - 10, yc + valSize - 1, n.fmt(n.value), { class: 's-val', 'text-anchor': 'end', 'font-size': valSize });
      y += sl[i]; yin += h;
    });
    // derecha
    y = (H - SR) / 2; let yout = cy - (sumR * k) / 2;
    right.forEach((n, i) => {
      const h = Math.max(2, n.value * k), yc = y + sr[i] / 2, y0 = yc - h / 2;
      ribbon(fx1 - 6, yout, yout + h, xR, y0, y0 + h, n.color, n, sumR);
      el('rect', { x: xR, y: y0, width: nodeW, height: h, rx: 2.5, fill: n.color }, g);
      txt(g, xR + nodeW + 10, yc - 3, nameFit(n.label, labW - 16, nameSize), { class: 's-name', 'font-size': nameSize });
      txt(g, xR + nodeW + 10, yc + valSize - 1, n.fmt(n.value), { class: 's-val', 'font-size': valSize });
      y += sr[i]; yout += h;
    });
    // horno
    const f = el('g', {}, svg);
    const bTop = cy - T / 2, bBot = cy + T / 2;
    const vTop = bTop - (narrow ? 46 : 62), vBot = bBot + (narrow ? 22 : 30);
    const wall = narrow ? 8 : 11, rad = Math.min(fw / 2, (vBot - bTop) * 0.9);
    const vessel = (x0, x1, top, bot, r) => `M${x0} ${top} L${x1} ${top} L${x1} ${bot - r} Q${x1} ${bot} ${x1 - r} ${bot} L${x0 + r} ${bot} Q${x0} ${bot} ${x0} ${bot - r} Z`;
    el('path', { d: vessel(fx0, fx1, vTop, vBot, rad * 0.55), fill: `url(#${uid}s)` }, f);
    const ix0 = fx0 + wall, ix1 = fx1 - wall, iBot = vBot - wall;
    el('path', { d: vessel(ix0, ix1, vTop + 4, iBot, rad * 0.45), fill: `url(#${uid}g)` }, f);
    const clipId = uid + 'c';
    const cp = el('clipPath', { id: clipId }, defs); el('path', { d: vessel(ix0, ix1, vTop + 4, iBot, rad * 0.45) }, cp);
    const inner = el('g', { 'clip-path': `url(#${clipId})` }, f);
    el('rect', { x: ix0, y: bTop - 9, width: ix1 - ix0, height: 9, fill: '#8B7B6B' }, inner);
    el('rect', { x: ix0, y: bTop - 9, width: ix1 - ix0, height: 3, fill: '#A89684' }, inner);
    el('rect', { x: ix0, y: bTop, width: ix1 - ix0, height: iBot - bTop + 2, fill: `url(#${uid}b)` }, inner);
    // ondas del baño
    for (let i = 0; i < 3; i++) {
      const yy = bTop + 14 + i * 9, w = ix1 - ix0;
      el('path', { d: `M${ix0} ${yy} q ${w / 8} -4 ${w / 4} 0 t ${w / 4} 0 t ${w / 4} 0 t ${w / 4} 0`, fill: 'none', stroke: '#FFE7A8', 'stroke-opacity': 0.35 - i * 0.1, 'stroke-width': 1.2 }, inner);
    }
    // bóveda y electrodos
    const roofY = vTop - (narrow ? 8 : 12);
    el('path', { d: `M${fx0 - 4} ${vTop + 1} Q${W / 2} ${roofY - (narrow ? 10 : 16)} ${fx1 + 4} ${vTop + 1} Z`, fill: '#2D5C8A' }, f);
    const eW = narrow ? 9 : 12, eGap = fw * 0.2;
    [-1, 0, 1].forEach(j => {
      const ex = W / 2 + j * eGap - eW / 2, eTop = (narrow ? 24 : 18) + (j === 0 ? 0 : 6), eBot = bTop - 22;
      el('rect', { x: ex, y: eTop, width: eW, height: eBot - eTop, rx: 2, fill: '#3E4956' }, f);
      el('rect', { x: ex + eW * 0.2, y: eTop, width: eW * 0.18, height: eBot - eTop, fill: '#5C6876' }, f);
      el('circle', { cx: ex + eW / 2, cy: eBot + 6, r: narrow ? 11 : 15, fill: `url(#${uid}a)` }, f);
    });
    // lectura central
    txt(f, W / 2, cy + (narrow ? 4 : 6), o.centerBig, { class: 's-big', 'text-anchor': 'middle', 'font-size': narrow ? 21 : 27 });
    txt(f, W / 2, cy + (narrow ? 22 : 28), o.centerCap, { class: 's-cap', 'text-anchor': 'middle', 'font-size': narrow ? 10.5 : 12 });
    if (o.leftCap) txt(svg, xL + nodeW, 16, o.leftCap, { class: 'c-tick', 'text-anchor': 'end', 'letter-spacing': '.08em' });
    if (o.rightCap) txt(svg, xR, 16, o.rightCap, { class: 'c-tick', 'letter-spacing': '.08em' });
  }

  return { line, barsH, waterfall, scatter, heatmap, sankey, showTip, hideTip, fmtN };
})();
