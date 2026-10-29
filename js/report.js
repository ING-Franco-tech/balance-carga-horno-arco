const Report = (() => {
  function css(sc) {
    return `
${sc}{--bg:#fff;--panel:#fff;--panel-2:#F2F5F8;--line:#D3DAE2;--line-2:#E6EAEF;--ink:#1B2531;--ink-2:#4B5868;--ink-3:#7E8B9B;--accent:#DD5B0E;--warm:#F2913A;--teal:#138A83;--blue:#2D5C8A;--crimson:#C8323C;--green:#2E8B57;--amber:#D3951F;--violet:#7A6CC2;--sky:#3AA2D3;
--m1:#2D5C8A;--m2:#4C8EC1;--m3:#7A6CC2;--m4:#93A6B9;--m5:#B8894A;--m6:#138A83;--m7:#5DAE8B;--m8:#A5486E;--font:"Barlow","Segoe UI",Arial,sans-serif;--cond:"Barlow Condensed","Arial Narrow",sans-serif;
background:#fff;color:var(--ink);font-family:var(--font);font-size:12px;line-height:1.45;width:794px;margin:0 auto;padding:40px 46px 34px;box-shadow:0 1px 3px rgba(20,28,37,.12),0 8px 24px rgba(20,28,37,.08);font-variant-numeric:tabular-nums;color-scheme:light}
${sc} *{box-sizing:border-box}
${sc} .rp-top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:14px;border-bottom:3px solid transparent;border-image:linear-gradient(90deg,#2D5C8A,#2D5C8A 55%,#F47A1F 80%,#FFB547) 1}
${sc} .rp-brand{display:flex;gap:10px;align-items:center}
${sc} .rp-brand b{font-size:15px;font-weight:600;display:block}
${sc} .rp-brand span{font-size:11px;color:var(--ink-3)}
${sc} .rp-doc{text-align:right;font-size:11px;color:var(--ink-2);line-height:1.6}
${sc} .rp-doc strong{display:block;font-size:17px;color:var(--ink);font-weight:600}
${sc} .rp-sec{margin-top:18px;break-inside:avoid}
${sc} .rp-sec>h3{font-family:var(--cond);font-size:13px;letter-spacing:.07em;text-transform:uppercase;font-weight:600;margin:0 0 8px;color:var(--ink-2)}
${sc} .rp-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid var(--line-2);border-radius:4px}
${sc} .rp-meta div{padding:7px 10px;border-right:1px solid var(--line-2);border-bottom:1px solid var(--line-2)}
${sc} .rp-meta div:nth-child(3n){border-right:0}
${sc} .rp-meta div:nth-last-child(-n+3){border-bottom:0}
${sc} .rp-meta span{display:block;font-size:10.5px;color:var(--ink-3)}
${sc} .rp-meta b{font-weight:600;font-size:12px}
${sc} .rp-kpis{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:4px}
${sc} .rp-kpis div{padding:9px 10px;border-right:1px solid var(--line-2)}
${sc} .rp-kpis div:last-child{border-right:0}
${sc} .rp-kpis span{display:block;font-size:10.5px;color:var(--ink-3)}
${sc} .rp-kpis b{font-family:var(--cond);font-size:21px;font-weight:600}
${sc} .rp-kpis small{font-size:10.5px;color:var(--ink-3);margin-left:2px}
${sc} table.rp-t{width:100%;border-collapse:collapse;font-size:11.5px}
${sc} .rp-t th{text-align:left;font-weight:600;font-size:10.5px;color:var(--ink-2);background:var(--panel-2);padding:6px 8px;border-bottom:1px solid var(--line)}
${sc} .rp-t td{padding:5px 8px;border-bottom:1px solid var(--line-2)}
${sc} .rp-t .n{text-align:right;white-space:nowrap}
${sc} .rp-t tfoot td{font-weight:600;background:var(--panel-2);border-top:1px solid var(--line);border-bottom:0}
${sc} .sw{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:-1px}
${sc} .ok{color:#17733F;font-weight:600} ${sc} .bad{color:#A3203F;font-weight:600} ${sc} .warn{color:#8A5A00;font-weight:600}
${sc} .rp-two{display:grid;grid-template-columns:1fr 1fr;gap:18px}
${sc} .rp-note{font-size:10.5px;color:var(--ink-3);margin:6px 0 0}
${sc} .rp-box{border:1px solid var(--line-2);border-radius:4px;padding:10px 12px;font-size:11.5px;color:var(--ink-2);min-height:44px}
${sc} .rp-sign{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin-top:40px}
${sc} .rp-sign div{border-top:1px solid var(--ink);padding-top:6px;font-size:10.5px;color:var(--ink-2)}
${sc} .rp-foot{display:flex;justify-content:space-between;margin-top:22px;padding-top:8px;border-top:1px solid var(--line-2);font-size:10px;color:var(--ink-3)}
${sc} .rp-status{display:inline-block;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:600}
${sc} .rp-status.ok{background:#E2F4E9} ${sc} .rp-status.bad{background:#FBE3E9} ${sc} .rp-status.warn{background:#FCF0D6}
${sc} svg.chart{display:block;overflow:visible}
${sc} .c-grid{stroke:var(--line-2);stroke-width:1} ${sc} .c-axis{stroke:var(--line);stroke-width:1} ${sc} .c-cross{display:none}
${sc} .c-tick{fill:var(--ink-3);font-size:10px;font-family:var(--font)} ${sc} .c-label{fill:var(--ink-2);font-size:10.5px;font-family:var(--font)}
${sc} .c-cat{fill:var(--ink-2);font-size:10.5px;font-family:var(--font)} ${sc} .c-val{fill:var(--ink);font-size:10.5px;font-weight:600;font-family:var(--font)}
${sc} .c-note{fill:var(--ink-3);font-size:10px;font-family:var(--font)} ${sc} .c-mark{font-size:10.5px;font-weight:600;font-family:var(--font)}
${sc} .rp-key{display:flex;gap:14px;font-size:10.5px;color:var(--ink-2);margin:0 0 4px}
${sc} .rp-key i{display:inline-block;width:12px;height:3px;border-radius:2px;margin-right:5px;vertical-align:3px}
`;
  }
  function chartSVG(fn, opts, width) {
    const host = document.createElement('div');
    host.style.cssText = `position:absolute;left:-10000px;top:0;width:${width}px`;
    document.body.appendChild(host);
    fn(host, opts);
    const svg = host.querySelector('svg');
    if (svg) { svg.setAttribute('width', width); svg.removeAttribute('role'); }
    const html = host.innerHTML; host.remove();
    return html;
  }
  function header(c, title, docId, when) {
    return `<div class="rp-top"><div class="rp-brand"><svg width="34" height="34" viewBox="0 0 34 34"><defs><linearGradient id="rpB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC861"/><stop offset=".55" stop-color="#F47A1F"/><stop offset="1" stop-color="#B8410A"/></linearGradient></defs><rect x="11" y="3" width="3" height="13" rx="1.2" fill="#3A4656"/><rect x="15.5" y="2" width="3" height="14" rx="1.2" fill="#3A4656"/><rect x="20" y="3" width="3" height="13" rx="1.2" fill="#3A4656"/><path d="M6 15h22v6.5c0 5.5-4.5 9.5-11 9.5S6 27 6 21.5z" fill="#2D5C8A"/><path d="M8.5 19.5h17v2.2c0 4-3.6 6.8-8.5 6.8s-8.5-2.8-8.5-6.8z" fill="url(#rpB)"/></svg><div><b>Balance de carga del horno de arco</b><span>Planificación de carga, energía y control de coladas</span></div></div>
      <div class="rp-doc"><strong>${title}</strong>Documento ${c.esc(docId)}<br>Emitido ${when}</div></div>`;
  }
  function foot(c) {
    return `<div class="rp-sign"><div>Elaboró</div><div>Revisó · Ingeniería de proceso</div><div>Aprobó · Jefatura de acería</div></div>
      <div class="rp-foot"><span>Balance de carga del horno de arco 1.0 · Desarrollado por Ing. J. Gabriel Franco</span><span>Modelo energético: Köhle (2005)${c.CAL && c.CAL.ready ? ' calibrado con ' + c.CAL.n + ' coladas' : ''}</span></div>`;
  }
  function nowStr() { const d = new Date(); return d.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); }

  function planBody(c) {
    const { S, R, f, esc } = c; const p = S.p;
    if (!R || R.status !== 'optimal') return `<div class="rp-sec"><div class="rp-box">No existe una carga factible con los parámetros actuales.</div></div>`;
    const e = R.ev; const g = c.GRADES[p.grade];
    const rows = S.mats.map((m, i) => ({ m, t: e.x[i] })).filter(r => r.t > 0.05).sort((a, b) => b.t - a.t);
    const wf = chartSVG(Charts.waterfall, { height: 230, steps: [
      { label: 'Fusión', value: e.terms.base, total: true, color: 'var(--ink-3)' }, { label: 'Carga', value: e.terms.charge }, { label: 'DRI', value: e.terms.dri },
      { label: 'Fragm.', value: e.terms.shred }, { label: 'Escorif.', value: e.terms.slag }, { label: 'Temp.', value: e.terms.temp }, { label: 'Tiempo', value: e.terms.time },
      { label: 'Gas', value: e.terms.gas }, { label: 'O₂', value: e.terms.o2 }, ...(Math.abs(e.terms.cal) > 0.05 ? [{ label: 'Calib.', value: e.terms.cal }] : []), { label: 'Total', value: e.W, total: true, color: 'var(--accent)' }] }, 700);
    const mv = c.MV || {};
    const act = R.cons.filter(k => k.active && k.k !== 'mass');
    const nameOf = k => k.k === 'lim' ? k.e + ' en el acero' : k.k === 'max' ? 'Disponibilidad de ' + (S.mats.find(m => m.id === k.id) || {}).name : k.k === 'vol' ? 'Volumen de cestas' : k.k === 'drimax' ? 'DRI máximo' : k.k === 'drimin' ? 'DRI mínimo' : k.k === 'prod' ? 'Productividad mínima' : k.k;
    const mvOf = k => mv[k.k === 'lim' ? 'lim_' + k.e : k.k === 'max' ? 'max_' + k.id : k.k];
    return `
    <div class="rp-sec"><h3>Condiciones de operación</h3><div class="rp-meta">
      <div><span>Grado</span><b>${esc(g ? g.name : 'Especificación propia')}</b></div><div><span>Acero objetivo por colada</span><b>${f(p.GA, 0)} t</b></div><div><span>Potencia activa · utilización</span><b>${f(p.P, 0)} MW · ${f(p.util, 2)}</b></div>
      <div><span>Temperatura de vaciado</span><b>${Math.round(p.T)} °C</b></div><div><span>O₂ de lanza · gas</span><b>${f(p.O2L, 1)} · ${f(p.gas, 1)} Nm³/t</b></div><div><span>Energía eléctrica</span><b>${f(p.pEl, 0)} USD/MWh</b></div></div></div>
    <div class="rp-sec"><h3>Resultados</h3><div class="rp-kpis">
      <div><span>Costo total</span><b>${f(e.costTotal, 2)}</b><small>USD/t</small></div><div><span>Energía eléctrica</span><b>${f(e.W, 0)}</b><small>kWh/t</small></div>
      <div><span>Tap-to-tap · productividad</span><b>${f(e.t2t, 1)}</b><small>min · ${f(e.prod, 0)} t/h</small></div><div><span>CO₂ directo</span><b>${f(e.co2Direct, 0)}</b><small>kg/t</small></div></div>
      ${c.PRED ? `<p class="rp-note">Predicción calibrada de energía: ${f(c.PRED.mu, 0)} kWh/t (intervalo de 95 %: ${f(c.PRED.lo, 0)}–${f(c.PRED.hi, 0)}), modelo ${esc(c.PRED.model.name)}.</p>` : ''}</div>
    <div class="rp-sec"><h3>Receta de carga</h3><table class="rp-t"><thead><tr><th>Material</th><th class="n">t por colada</th><th class="n">% de la carga</th><th class="n">USD/t material</th><th class="n">USD por colada</th><th class="n">Cu %</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><span class="sw" style="background:${c.matColor(r.m)}"></span>${esc(r.m.name)}</td><td class="n">${f(r.t, 1)}</td><td class="n">${f(r.t / e.GE * 100, 1)}</td><td class="n">${f(r.m.price, 0)}</td><td class="n">${f(r.t * r.m.price, 0)}</td><td class="n">${f(r.m.Cu, 3)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td>Total</td><td class="n">${f(e.GE, 1)}</td><td class="n">100.0</td><td></td><td class="n">${f(rows.reduce((s, r) => s + r.t * r.m.price, 0), 0)}</td><td></td></tr></tfoot></table>
      <p class="rp-note">Rendimiento metálico ${f(e.yieldAvg * 100, 1)} % · escorificantes ${f(e.limeKg, 0)} kg/t · escoria estimada ${f(e.slagKg, 0)} kg/t · DRI / HBI ${f(e.driShare, 1)} % de la carga.</p></div>
    <div class="rp-sec rp-two"><div><h3>Química residual</h3><table class="rp-t"><thead><tr><th>Elemento</th><th class="n">Calculado %</th><th class="n">Límite %</th><th>Estado</th></tr></thead><tbody>
      ${c.ELEMENTS.map(el => { const v = e.resid[el], l = p.lim[el]; const ok = !(l > 0) || v <= l + 1e-9; return `<tr><td>${el}</td><td class="n">${f(v, 4)}</td><td class="n">${l > 0 ? f(l, 3) : 'libre'}</td><td class="${ok ? 'ok' : 'bad'}">${ok ? 'Cumple' : 'No cumple'}</td></tr>`; }).join('')}</tbody></table></div>
      <div><h3>Restricciones activas</h3><table class="rp-t"><thead><tr><th>Restricción</th><th class="n">Valor de relajar</th></tr></thead><tbody>
      ${act.length ? act.map(k => { const v = mvOf(k); return `<tr><td>${esc(nameOf(k))}</td><td class="n">${v && v.v != null ? f(v.v, 2) + ' USD/t ' + v.unit : '—'}</td></tr>`; }).join('') : '<tr><td colspan="2">Ninguna</td></tr>'}</tbody></table></div></div>
    <div class="rp-sec"><h3>Energía eléctrica por término de la fórmula de Köhle (kWh/t)</h3>${wf}</div>`;
  }

  function heatBody(c, h) {
    const { S, f, esc } = c;
    const lim = c.GRADES[h.grade] || S.p.lim;
    const pred = c.heatPred(h); const st = c.heatStatus(h, pred);
    const x = S.mats.map(m => +(h.charge[m.id] || 0));
    const GE = x.reduce((s, v) => s + v, 0);
    const ph = Object.assign({}, S.p, { T: h.T, O2L: h.O2L, gas: h.gas, tOff: h.tOff, useCal: false });
    const ev = evaluate(x, S.mats, ph, null);
    const cuBal = S.mats.reduce((s, m, i) => s + x[i] * m.Cu, 0) / h.GA;
    const rows = S.mats.map((m, i) => ({ m, t: x[i], plan: h.plan ? h.plan.x[i] : null })).filter(r => r.t > 0 || (r.plan || 0) > 0.05).sort((a, b) => b.t - a.t);
    const status = st.chemBad ? '<span class="rp-status bad">Química fuera de especificación</span>' : st.energyBad ? '<span class="rp-status warn">Consumo de energía atípico</span>' : '<span class="rp-status ok">Colada conforme</span>';
    // historial de energía
    const hs = S.heats.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const k = hs.indexOf(h); const win = hs.slice(Math.max(0, k - 19), k + 1);
    const hist = chartSVG(Charts.line, { height: 200,
      series: [{ name: 'Medido', color: 'var(--blue)', dots: true, width: 1.6, points: win.map((q, i) => [i + 1, q.MWh * 1000 / q.GA, q === h ? { color: 'var(--accent)', r: 5 } : null]) },
        { name: 'Predicho', color: 'var(--ink-3)', dash: '4 3', width: 1.4, points: win.map((q, i) => [i + 1, c.heatPred(q)]) }],
      x: { label: 'Coladas anteriores hasta esta', min: 1, max: Math.max(2, win.length) }, y: { label: 'kWh/t' } }, 700);
    return `
    <div class="rp-sec"><h3>Identificación</h3><div class="rp-meta">
      <div><span>Colada</span><b>${esc(h.id)}</b></div><div><span>Fecha y hora de vaciado</span><b>${esc(h.date)} ${esc(h.time)}</b></div><div><span>Turno · operador</span><b>${esc(h.shift)} · ${esc(h.operator || '—')}</b></div>
      <div><span>Grado</span><b>${esc((c.GRADES[h.grade] || {}).name || 'Especificación propia')}</b></div><div><span>Acero vaciado</span><b>${f(h.GA, 1)} t</b></div><div><span>Estado</span><b>${status}</b></div></div></div>
    <div class="rp-sec"><h3>Resultados de la colada</h3><div class="rp-kpis">
      <div><span>Energía medida</span><b>${f(st.kwh, 0)}</b><small>kWh/t · ${f(h.MWh, 2)} MWh</small></div><div><span>Predicción del modelo</span><b>${f(pred, 0)}</b><small>kWh/t · desv. ${st.dev > 0 ? '+' : ''}${f(st.dev, 0)}</small></div>
      <div><span>Tap-to-tap · productividad</span><b>${f(h.t2t, 1)}</b><small>min · ${f(h.GA * 60 / h.t2t, 0)} t/h</small></div><div><span>Costo estimado</span><b>${ev ? f(ev.costTotal, 2) : '—'}</b><small>USD/t</small></div></div></div>
    <div class="rp-sec rp-two"><div><h3>Carga metálica${h.plan ? ' real frente a plan' : ''}</h3><table class="rp-t"><thead><tr><th>Material</th><th class="n">Real (t)</th>${h.plan ? '<th class="n">Plan (t)</th><th class="n">Dif.</th>' : '<th class="n">%</th>'}</tr></thead><tbody>
      ${rows.map(r => `<tr><td><span class="sw" style="background:${c.matColor(r.m)}"></span>${esc(r.m.name)}</td><td class="n">${f(r.t, 1)}</td>${h.plan ? `<td class="n">${f(r.plan, 1)}</td><td class="n">${r.t - r.plan > 0 ? '+' : ''}${f(r.t - r.plan, 1)}</td>` : `<td class="n">${f(r.t / GE * 100, 1)}</td>`}</tr>`).join('')}
      </tbody><tfoot><tr><td>Total</td><td class="n">${f(GE, 1)}</td>${h.plan ? `<td class="n">${f(h.plan.x.reduce((s, v) => s + v, 0), 1)}</td><td></td>` : '<td class="n">100.0</td>'}</tr></tfoot></table>
      <p class="rp-note">Rendimiento metálico real: ${f(h.GA / GE * 100, 1)} %.</p></div>
      <div><h3>Mediciones de proceso y química</h3><table class="rp-t"><tbody>
      <tr><td>Temperatura de vaciado</td><td class="n">${Math.round(h.T)} °C</td></tr><tr><td>Tiempo con arco · sin arco</td><td class="n">${f(h.t2t - h.tOff, 1)} · ${f(h.tOff, 1)} min</td></tr>
      <tr><td>O₂ de lanza · gas natural</td><td class="n">${f(h.O2L, 1)} · ${f(h.gas, 1)} Nm³/t</td></tr>
      <tr><td>Cu medido / límite</td><td class="n ${lim.Cu && h.Cu > lim.Cu ? 'bad' : ''}">${f(h.Cu, 3)} / ${f(lim.Cu, 3)} %</td></tr>
      <tr><td>Cu calculado por balance de carga</td><td class="n">${f(cuBal, 3)} %</td></tr>
      <tr><td>Sn medido / límite</td><td class="n ${lim.Sn && h.Sn > lim.Sn ? 'bad' : ''}">${f(h.Sn, 4)} / ${f(lim.Sn, 3)} %</td></tr>
      <tr><td>CO₂ directo estimado</td><td class="n">${ev ? f(ev.co2Direct, 0) : '—'} kg/t</td></tr></tbody></table></div></div>
    <div class="rp-sec"><h3>Energía específica de las últimas coladas</h3><div class="rp-key"><span><i style="background:var(--blue)"></i>Medido</span><span><i style="background:var(--ink-3)"></i>Predicho por el modelo</span><span><i style="background:var(--accent)"></i>Esta colada</span></div>${hist}</div>
    <div class="rp-sec"><h3>Observaciones</h3><div class="rp-box">${h.notes ? esc(h.notes) : 'Sin observaciones.'}${h.demo ? ' Colada de ejemplo generada por el programa.' : ''}</div></div>`;
  }

  function build(c, sel) {
    const h = sel !== 'plan' ? c.S.heats.find(x => x.id === sel) : null;
    const when = nowStr();
    const body = h ? heatBody(c, h) : planBody(c);
    const docId = h ? 'RC-' + h.id : 'PC-' + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    return `<div class="rp">${header(c, h ? 'Reporte de colada' : 'Plan de carga', docId, when)}${body}${foot(c)}</div>`;
  }
  function documentHTML(c, sel) {
    const h = sel !== 'plan' ? c.S.heats.find(x => x.id === sel) : null;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h ? 'Reporte de colada ' + c.esc(h.id) : 'Plan de carga'} · Balance de carga del horno de arco</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600&display=swap">
<style>body{margin:0;background:#E9ECEF;padding:24px 0}${css('.rp')}
.bar{width:794px;margin:0 auto 12px;display:flex;justify-content:flex-end;gap:8px;font-family:"Barlow",Arial,sans-serif}
.bar button{height:36px;padding:0 16px;border-radius:10px;border:1px solid #DD5B0E;background:#DD5B0E;color:#fff;font:inherit;font-weight:500;cursor:pointer}
@page{size:A4;margin:12mm}
@media print{body{background:#fff;padding:0}.bar{display:none}.rp{box-shadow:none;width:auto;padding:0}}</style></head>
<body><div class="bar"><button onclick="window.print()">Imprimir o guardar como PDF</button></div>${build(c, sel)}</body></html>`;
  }
  return { css, build, document: documentHTML };
})();
