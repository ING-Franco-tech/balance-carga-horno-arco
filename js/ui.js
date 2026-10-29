(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const f = (v, d = 0) => (v == null || !isFinite(v)) ? '—' : Number(v).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const MAT_COLORS = ['var(--m1)', 'var(--m2)', 'var(--m3)', 'var(--m4)', 'var(--m5)', 'var(--m6)', 'var(--m7)', 'var(--m8)'];
const TYPE_LABEL = { scrap: 'Chatarra', shred: 'Fragmentada', dri: 'DRI / HBI', pig: 'Arrabio sólido' };
const EL_SUB = { Cu: 'Cu', Sn: 'Sn', Ni: 'Ni', Cr: 'Cr', Mo: 'Mo' };

// ---------------- Estado ----------------
const STORE = 'meltplan.v1';
const S = { mats: defaultMaterials(), p: defaultProcess(), heats: null, cmp: null, model: 'auto', view: 'balance', selHeat: null, repSel: 'plan', mapY: 'dri', planSnap: null };
try {
  const raw = localStorage.getItem(STORE);
  if (raw) {
    const d = JSON.parse(raw);
    if (d && d.v === 1) {
      if (Array.isArray(d.mats) && d.mats.length) S.mats = d.mats;
      if (d.p) S.p = Object.assign(defaultProcess(), d.p, { lim: Object.assign(defaultProcess().lim, d.p.lim || {}), rec: Object.assign(defaultProcess().rec, d.p.rec || {}) });
      if (Array.isArray(d.heats)) S.heats = d.heats;
      if (d.cmp) S.cmp = d.cmp;
      if (d.model) S.model = d.model;
      if (d.mapY) S.mapY = d.mapY;
    }
  }
} catch (e) { /* almacenamiento no disponible */ }
if (!S.heats) S.heats = demoHeats(defaultMaterials(), defaultProcess());
if (!S.cmp) S.cmp = typicalRecipe();
try { const h = (location.hash || '').replace('#', ''); if (h && document.getElementById('v-' + h)) S.view = h; } catch (e) { }

let saveT = null;
function persist() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify({ v: 1, mats: S.mats, p: S.p, heats: S.heats, cmp: S.cmp, model: S.model, mapY: S.mapY })); } catch (e) { } }, 300);
}
function typicalRecipe() { return { hms: 14, shr: 10, bus: 34, pkg: 29, ret: 14, dri: 57, hbi: 0, pig: 4 }; }

let R = null, CAL = null, PRED = null, MV = null, LAST_MS = 0, SC = null, SC_KEY = '';
function matColor(m) { const i = S.mats.indexOf(m); return MAT_COLORS[(i < 0 ? 0 : i) % MAT_COLORS.length]; }
function activeModelId() { if (!CAL || !CAL.ready) return null; return S.model === 'auto' ? CAL.bestId : (CAL.models.find(m => m.id === S.model) ? S.model : CAL.bestId); }

function toast(msg) {
  let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, 2600);
}

// ---------------- Cálculo ----------------
function recalc(opts = {}) {
  const t0 = performance.now();
  if (opts.cal !== false) CAL = calibrate(S.heats, S.mats, S.p);
  R = optimize(S.mats, S.p, CAL);
  MV = R.status === 'optimal' ? marginals() : null;
  PRED = R.status === 'optimal' && CAL && CAL.ready ? predictPlan(CAL, activeModelId(), R.ev, S.mats, S.p) : null;
  LAST_MS = performance.now() - t0;
  SC_KEY = '';
  renderAll();
  persist();
}
function marginals() {
  const out = {}; const b0 = R.ev.costTotal;
  const tryOpt = (fn, step) => { const p2 = clone(S.p); const m2 = clone(S.mats); fn(p2, m2); const r = optimize(m2, p2, CAL); return r.status === 'optimal' ? (b0 - r.ev.costTotal) / step : null; };
  R.cons.forEach(c => {
    if (!c.active) return;
    if (c.k === 'lim') { const st = S.p.lim[c.e] * 0.05; out['lim_' + c.e] = { v: tryOpt(p => { p.lim[c.e] += st; }, st / 0.01), unit: 'por 0.01 % adicional' }; }
    if (c.k === 'max') out['max_' + c.id] = { v: tryOpt((p, m) => { m.find(x => x.id === c.id).max += 5; }, 5), unit: 'por t adicional disponible' };
    if (c.k === 'vol') out.vol = { v: tryOpt(p => { p.basketV += 5 / p.nBaskets; }, 5), unit: 'por m³ de cesta' };
    if (c.k === 'drimax') out.drimax = { v: tryOpt(p => { p.driMax += 5; }, 5), unit: 'por punto de DRI' };
    if (c.k === 'drimin') out.drimin = { v: tryOpt(p => { p.driMin = Math.max(0, p.driMin - 5); }, 5), unit: 'por punto de DRI' };
    if (c.k === 'prod') out.prod = { v: tryOpt(p => { p.prodMin -= 5; }, 5), unit: 'por t/h menos' };
  });
  return out;
}
function diagnose() {
  const tests = [
    ['Quitar el límite de residuales del grado', p => { p.lim = { Cu: 0, Sn: 0, Ni: 0, Cr: 0, Mo: 0 }; }],
    ['Permitir hasta 100 % de DRI', p => { p.driMax = 100; p.driMin = 0; }],
    ['Quitar la productividad mínima', p => { p.prodMin = 0; }],
    ['Agregar una cesta más', p => { p.nBaskets += 1; }],
    ['Duplicar la disponibilidad de materiales', (p, m) => { m.forEach(x => x.max *= 2); }]
  ];
  return tests.filter(([, fn]) => { const p = clone(S.p), m = clone(S.mats); fn(p, m); return optimize(m, p, CAL).status === 'optimal'; }).map(t => t[0]);
}

// ---------------- Consola de parámetros ----------------
// [clave, etiqueta, unidad, paso, mín, máx]
const GROUPS = [
  { id: 'prod', name: 'Producto', color: 'var(--heat-3)', open: true, f: [
    ['grade', 'Grado', 'grade'],
    ['lim.Cu', 'Cobre máximo', '%', 0.005, 0.02, 0.4], ['lim.Sn', 'Estaño máximo', '%', 0.001, 0.004, 0.05],
    ['lim.Ni', 'Níquel máximo', '%', 0.005, 0.02, 0.3], ['lim.Cr', 'Cromo máximo', '%', 0.005, 0.02, 0.3], ['lim.Mo', 'Molibdeno máximo', '%', 0.005, 0.01, 0.1],
    ['driMin', 'DRI mínimo en la carga', '%', 1, 0, 100], ['driMax', 'DRI máximo en la carga', '%', 1, 0, 100], ['prodMin', 'Productividad mínima', 't/h', 5, 0, 260]
  ] },
  { id: 'horno', name: 'Horno', color: 'var(--steel)', open: true, f: [
    ['GA', 'Acero por colada', 't', 1, 40, 300], ['P', 'Potencia activa media', 'MW', 1, 20, 200], ['util', 'Utilización de potencia', '', 0.01, 0.6, 0.98],
    ['tOff', 'Tiempo sin arco', 'min', 0.5, 5, 40], ['basketV', 'Volumen por cesta', 'm³', 1, 20, 250], ['nBaskets', 'Número de cestas', '', 1, 1, 4],
    ['driContinuous', 'DRI por alimentación continua', 'switch']
  ] },
  { id: 'prac', name: 'Práctica de fusión', color: 'var(--sky)', open: false, f: [
    ['T', 'Temperatura de vaciado', '°C', 5, 1560, 1720], ['O2L', 'Oxígeno de lanza', 'Nm³/t', 0.5, 0, 60], ['O2N', 'Oxígeno de postcombustión', 'Nm³/t', 0.5, 0, 20],
    ['gas', 'Gas en quemadores', 'Nm³/t', 0.5, 0, 15], ['carbonInj', 'Carbono inyectado', 'kg/t', 0.5, 0, 25], ['Z0', 'Escorificantes base', 'kg/t', 1, 10, 80],
    ['B', 'Basicidad CaO/SiO₂', '', 0.1, 1, 3.5], ['limeCaO', 'CaO en la cal', '%', 0.5, 80, 98]
  ] },
  { id: 'cost', name: 'Precios', color: 'var(--green)', open: false, f: [
    ['pEl', 'Energía eléctrica', 'USD/MWh', 1, 20, 250], ['pElec', 'Electrodo de grafito', 'USD/kg', 0.1, 2, 12], ['kElec', 'Consumo de electrodo', 'kg/MWh', 0.1, 1, 8],
    ['pLime', 'Cal y escorificantes', 'USD/t', 5, 50, 300], ['pO2', 'Oxígeno', 'USD/Nm³', 0.01, 0.03, 0.4], ['pGas', 'Gas natural', 'USD/Nm³', 0.01, 0.05, 0.8],
    ['pC', 'Carbono de inyección', 'USD/t', 5, 100, 700], ['pFixed', 'Otros costos de conversión', 'USD/t', 1, 0, 120]
  ] },
  { id: 'emis', name: 'Emisiones y escala', color: 'var(--teal)', open: false, f: [
    ['grid', 'Factor de la red eléctrica', 'kg CO₂/kWh', 0.01, 0, 1], ['pCO2', 'Precio del carbono', 'USD/t', 1, 0, 200],
    ['scope3', 'Cobrar CO₂ de los insumos', 'switch'], ['annual', 'Producción anual', 't/año', 10000, 100000, 6000000], ['useCal', 'Usar calibración en el optimizador', 'switch']
  ] }
];
function getP(path) { return path.split('.').reduce((o, k) => o[k], S.p); }
function setP(path, v) { const ks = path.split('.'); let o = S.p; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = v; }
function fieldHTML(id, label, unit, step, value) {
  return `<label class="field" for="${id}"><span>${label}</span><span class="fi"><input id="${id}" type="number" step="${step || 'any'}" inputmode="decimal" value="${value}">${unit ? `<em>${unit}</em>` : ''}</span></label>`;
}
function pct(v, mn, mx) { return Math.max(0, Math.min(100, (v - mn) / (mx - mn) * 100)); }
function renderFields() {
  const openState = {}; $$('#console details').forEach(d => openState[d.dataset.g] = d.open);
  $('#console').innerHTML = GROUPS.map(gr => `<details class="cgroup" data-g="${gr.id}" ${(openState[gr.id] ?? gr.open) ? 'open' : ''}><summary><span class="dot" style="background:${gr.color}"></span>${gr.name}</summary>${gr.f.map(([key, label, unit, step, mn, mx]) => {
    const id = 'p_' + key.replace('.', '_');
    if (unit === 'switch') return `<div class="ctl"><label for="${id}">${label}</label><label class="switch"><input type="checkbox" id="${id}" data-key="${key}" ${getP(key) ? 'checked' : ''}><span class="tg"></span></label></div>`;
    if (unit === 'grade') return `<div class="chips" role="group" aria-label="Grado">${Object.entries(GRADES).map(([k, g]) => `<button type="button" class="chip ${S.p.grade === k ? 'on' : ''}" data-grade="${k}">${g.name}</button>`).join('')}${S.p.grade === 'custom' ? '<button type="button" class="chip on">Especificación propia</button>' : ''}</div>`;
    const v = getP(key);
    return `<div class="ctl"><label for="${id}">${label}</label><span class="num ${key === 'annual' ? 'wide' : ''}"><input id="${id}" type="number" step="${step}" inputmode="decimal" data-key="${key}" value="${v}">${unit ? `<span>${unit}</span>` : ''}</span><input class="rng" type="range" min="${mn}" max="${mx}" step="${step}" value="${v}" data-rng="${key}" aria-label="${label}" style="--pct:${pct(v, mn, mx)}%"></div>`;
  }).join('')}</details>`).join('') + `<div class="console-foot"><button class="btn sm" type="button" id="btnResetP">Restablecer parámetros</button></div>`;
}
function syncFields() {
  $$('[data-key]').forEach(inp => {
    if (document.activeElement === inp) return;
    const v = getP(inp.dataset.key);
    if (inp.type === 'checkbox') inp.checked = !!v; else inp.value = v;
  });
  $$('[data-rng]').forEach(r => { if (document.activeElement === r) return; const v = getP(r.dataset.rng); r.value = v; r.style.setProperty('--pct', pct(v, +r.min, +r.max) + '%'); });
}
let inT = null;
function onFieldInput(e) {
  const inp = e.target;
  if (inp.dataset && inp.dataset.rng) {
    const key = inp.dataset.rng; const v = parseFloat(inp.value);
    setP(key, v); inp.style.setProperty('--pct', pct(v, +inp.min, +inp.max) + '%');
    const num = document.querySelector(`[data-key="${key}"]`); if (num) num.value = v;
    if (key.startsWith('lim.')) S.p.grade = 'custom';
    clearTimeout(inT); inT = setTimeout(() => recalc({ cal: false }), 60); return;
  }
  if (!inp.dataset || !inp.dataset.key) return;
  const key = inp.dataset.key;
  if (inp.type === 'checkbox') { setP(key, inp.checked); recalc({ cal: key !== 'useCal' }); return; }
  const v = parseFloat(inp.value);
  if (!isFinite(v)) return;
  setP(key, v);
  const r = document.querySelector(`[data-rng="${key}"]`); if (r) { r.value = v; r.style.setProperty('--pct', pct(v, +r.min, +r.max) + '%'); }
  if (key.startsWith('lim.')) S.p.grade = 'custom';
  clearTimeout(inT); inT = setTimeout(() => recalc(), 180);
}

// ---------------- Lecturas y estado ----------------
function renderChrome() {
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.view === S.view));
  $$('.view').forEach(v => v.hidden = v.id !== 'v-' + S.view);
  $('#navCount').textContent = S.heats.length;
  $$('.chip[data-grade]').forEach(c => c.classList.toggle('on', c.dataset.grade === S.p.grade));
  const ok = R && R.status === 'optimal';
  const mid = activeModelId();
  const k = $('#kpis');
  if (!ok) {
    k.innerHTML = ['Costo total', 'Energía eléctrica', 'Tap-to-tap', 'Productividad', 'DRI en la carga', 'Cobre final', 'CO₂ directo'].map(l => `<div class="ro"><div class="lb">${l}</div><div class="vl">—</div><div class="sub">Sin solución</div></div>`).join('');
  } else {
    const e = R.ev; const lim = S.p.lim.Cu; const cuOk = !(lim > 0) || e.resid.Cu <= lim + 1e-9;
    const wVal = PRED ? PRED.mu : e.W;
    const cuMax = lim > 0 ? lim * 1.25 : Math.max(e.resid.Cu * 1.3, 0.01);
    k.innerHTML = `
      <div class="ro hot"><div class="lb">Costo total</div><div class="vl">${f(e.costTotal, 2)}<small>USD/t</small></div><div class="sub">${f(e.costTotal * S.p.GA, 0)} USD por colada</div></div>
      <div class="ro"><div class="lb">${PRED ? 'Energía prevista' : 'Energía eléctrica'}</div><div class="vl">${f(wVal)}<small>kWh/t</small></div><div class="sub">${PRED ? `Intervalo 95 %: ${f(PRED.lo)}–${f(PRED.hi)}` : 'Fórmula de Köhle'}</div></div>
      <div class="ro"><div class="lb">Tap-to-tap</div><div class="vl">${f(e.t2t, 1)}<small>min</small></div><div class="sub">${f(e.tOn, 1)} min con arco</div></div>
      <div class="ro"><div class="lb">Productividad</div><div class="vl">${f(e.prod)}<small>t/h</small></div><div class="sub">${f(e.prod * 24 * 0.9 / 1000, 1)} kt por día al 90 %</div></div>
      <div class="ro"><div class="lb">DRI en la carga</div><div class="vl">${f(e.driShare, 1)}<small>%</small></div><div class="gauge"><i style="width:${Math.min(100, e.driShare)}%;background:var(--teal)"></i></div></div>
      <div class="ro"><div class="lb">Cobre final</div><div class="vl" style="color:${cuOk ? 'inherit' : 'var(--crimson)'}">${f(e.resid.Cu, 3)}<small>%</small></div><div class="gauge"><i style="width:${Math.min(100, e.resid.Cu / cuMax * 100)}%;background:${cuOk ? (lim > 0 && e.resid.Cu > lim * 0.92 ? 'var(--amber)' : 'var(--green)') : 'var(--crimson)'}"></i>${lim > 0 ? `<b style="left:${lim / cuMax * 100}%" title="Límite ${f(lim, 3)} %"></b>` : ''}</div></div>
      <div class="ro"><div class="lb">CO₂ directo</div><div class="vl">${f(e.co2Direct)}<small>kg/t</small></div><div class="sub">${f(e.co2Total)} kg/t con insumos</div></div>`;
  }
  const st = R ? R.status : '';
  const stTxt = { optimal: 'Solución óptima', infeasible: 'Sin solución factible', unbounded: 'Problema no acotado', nomaterials: 'Sin materiales activos', iterlimit: 'Límite de iteraciones' }[st] || st;
  const mm = mid && CAL.models.find(m => m.id === mid);
  $('#status').innerHTML = `<span><span class="dot ${ok ? '' : 'bad'}"></span>${stTxt}${ok ? ` · ${R.n} variables, ${R.m} restricciones, ${f(LAST_MS, 0)} ms` : ''}</span><span>Modelo de energía: ${mm ? mm.name + ', error medio ' + f(mm.metrics.mae, 1) + ' kWh/t' : 'Köhle (2005)'}</span><span class="by">Desarrollado por <b>Ing. J. Gabriel Franco</b></span>`;
  const acts = $('#vacts');
  acts.innerHTML = '';
  if (S.view === 'resultado' && ok) acts.innerHTML = `<button class="btn" type="button" id="btnCopy">Copiar receta</button><button class="btn" type="button" id="btnToLog">Registrar colada con esta receta</button>`;
}

// ---------------- Vista: balance ----------------
let SK_MODE = 'mass';
function renderBalance() {
  const host = $('#sankey');
  $$('#sankeyMode button').forEach(b => b.classList.toggle('on', b.dataset.mode === SK_MODE));
  if (!R || R.status !== 'optimal') { host.innerHTML = `<div style="padding:24px">${infeasibleHTML()}</div>`; $('#recipeStrip').innerHTML = ''; $('#insights').innerHTML = ''; $('#sankeyHint').textContent = ''; return; }
  const e = R.ev, p = S.p, G = e.G;
  const tF = v => f(v, 1) + ' t';
  if (SK_MODE === 'mass') {
    const mats = S.mats.map((m, i) => ({ m, t: e.x[i] })).filter(r => r.t > 0.05).sort((a, b) => b.t - a.t);
    const limeT = e.limeKg * G / 1000, cT = p.carbonInj * G / 1000, slagT = e.slagKg * G / 1000;
    const inT = e.GE + limeT + cT;
    const gasT = Math.max(0, inT - G - slagT);
    Charts.sankey(host, {
      height: 470, aria: 'Balance de masa de la colada',
      left: [...mats.map(r => ({ label: r.m.name, value: r.t, color: matColor(r.m), fmt: tF })), { label: 'Cal y escorificantes', value: limeT, color: '#B9AFA3', fmt: tF }, { label: 'Carbono inyectado', value: cT, color: '#4A5563', fmt: tF }],
      right: [{ label: 'Acero líquido', value: G, color: '#E8661A', fmt: tF }, { label: 'Escoria', value: slagT, color: '#8B7B6B', fmt: tF }, { label: 'Gases, polvo y pérdidas', value: gasT, color: '#A9B6C4', fmt: tF }],
      centerBig: f(e.GE, 1) + ' t', centerCap: 'CARGA METÁLICA', leftCap: 'ENTRA', rightCap: 'SALE'
    });
    $('#sankeyHint').textContent = `Masa por colada · rendimiento metálico ${f(e.yieldAvg * 100, 1)} %`;
  } else {
    const t = e.terms; const kw = v => f(v, 0) + ' kWh/t';
    const gasE = 8 * p.gas, o2E = 4.3 * p.O2L, pcE = 2.8 * p.O2N;
    const fusion = Math.max(0, t.base + t.temp + t.shred);
    const losses = Math.max(0, t.time + t.cal);
    Charts.sankey(host, {
      height: 470, aria: 'Balance de energía de la colada',
      left: [{ label: 'Energía eléctrica', value: e.W, color: '#2D5C8A', fmt: kw }, { label: 'Oxígeno de lanza', value: o2E, color: '#3AA2D3', fmt: kw }, { label: 'Quemadores de gas', value: gasE, color: '#D3951F', fmt: kw }, { label: 'Postcombustión', value: pcE, color: '#7A6CC2', fmt: kw }],
      right: [{ label: 'Fusión y sobrecalentamiento', value: fusion, color: '#E8661A', fmt: kw }, { label: 'Escoria y escorificantes', value: t.slag, color: '#8B7B6B', fmt: kw }, { label: 'Material extra cargado', value: t.charge, color: '#B8894A', fmt: kw }, { label: 'DRI / HBI', value: t.dri, color: '#138A83', fmt: kw }, { label: 'Pérdidas por tiempo', value: losses, color: '#A9B6C4', fmt: kw }],
      centerBig: f(e.W, 0) + ' kWh/t', centerCap: 'ELÉCTRICA', leftCap: 'ENTRA', rightCap: 'SE CONSUME EN'
    });
    $('#sankeyHint').textContent = `Energía por tonelada de acero · fórmula de Köhle${CAL && CAL.ready && p.useCal ? ' calibrada' : ''}`;
  }
  const rows = S.mats.map((m, i) => ({ m, t: e.x[i] })).filter(r => r.t > 0.05).sort((a, b) => b.t - a.t);
  $('#recipeStrip').innerHTML = rows.map(r => `<div class="rcard" title="${f(r.t / r.m.max * 100, 0)} % del disponible"><div class="nm"><span class="sw" style="background:${matColor(r.m)}"></span>${esc(r.m.name)}</div><div class="t">${f(r.t, 1)}<small>t · ${f(r.t / e.GE * 100, 0)} %</small></div><div class="bar"><i style="width:${Math.min(100, r.t / r.m.max * 100)}%;background:${matColor(r.m)}"></i></div></div>`).join('');
  const ins = [];
  const act = R.cons.filter(c => c.active && c.k === 'lim');
  const elName = { Cu: 'cobre', Sn: 'estaño', Ni: 'níquel', Cr: 'cromo', Mo: 'molibdeno' };
  if (act.length) {
    const c = act[0]; const mv = MV && MV['lim_' + c.e];
    ins.push(`<div class="insight warm"><span class="k">Lo que limita la mezcla</span>El <b>${elName[c.e]}</b> está en su límite de ${f(p.lim[c.e], 3)} %.${mv && mv.v != null ? ` Cada 0.01 % adicional permitido bajaría el costo <b>${f(mv.v, 2)} USD/t</b>.` : ''}</div>`);
  } else ins.push(`<div class="insight"><span class="k">Química</span>Ningún residual está en su límite. La mezcla la deciden el precio de los materiales y la energía.</div>`);
  const full = rows.filter(r => r.t >= r.m.max - 1e-6);
  ins.push(full.length ? `<div class="insight"><span class="k">Inventario</span>Se usa todo lo disponible de <b>${full.map(r => esc(r.m.name.toLowerCase())).join('</b>, <b>')}</b>. Conseguir más de ese material es la forma más directa de bajar el costo.</div>` : `<div class="insight"><span class="k">Inventario</span>Ningún material se agota con esta receta.</div>`);
  ins.push(PRED ? `<div class="insight"><span class="k">Energía esperada</span>Con ${CAL.n} coladas de calibración se esperan <b>${f(PRED.mu, 0)} kWh/t</b> (95 %: ${f(PRED.lo, 0)}–${f(PRED.hi, 0)}), es decir <b>${f(PRED.mu * G / 1000, 1)} MWh</b> por colada.</div>` : `<div class="insight"><span class="k">Energía esperada</span><b>${f(e.W, 0)} kWh/t</b> según la fórmula de Köhle. Registra coladas para calibrarla con el horno real.</div>`);
  $('#insights').innerHTML = ins.join('');
}
function infeasibleHTML() {
  if (!R) return '';
  if (R.status === 'nomaterials') return `<div class="callout warn"><div>No hay materiales activos. Activa al menos uno en <b>Materiales</b>.</div></div>`;
  const fixes = diagnose();
  return `<div class="callout bad"><div><b>No existe una carga que cumpla todas las restricciones.</b> ${fixes.length ? 'El problema vuelve a tener solución con alguno de estos cambios: ' + fixes.map(x => x.toLowerCase()).join('; ') + '.' : 'Revisa disponibilidades, límites del grado y volumen de cestas.'}</div></div>`;
}

// ---------------- Vista: materias primas ----------------
const MAT_COLS = [
  ['price', 'Precio', 'USD/t', 1], ['max', 'Disponible', 't', 1], ['min', 'Mínimo', 't', 0.5],
  ['Cu', 'Cu', '%', 0.001], ['Sn', 'Sn', '%', 0.001], ['Ni', 'Ni', '%', 0.001], ['Cr', 'Cr', '%', 0.001], ['Mo', 'Mo', '%', 0.001],
  ['yield', 'Rend.', 't/t', 0.01], ['FeTot', 'Fe total', '%', 0.1], ['met', 'Metaliz.', '%', 0.1], ['C', 'C', '%', 0.01], ['Si', 'Si', '%', 0.01], ['SiO2', 'SiO₂', '%', 0.1], ['Al2O3', 'Al₂O₃', '%', 0.1], ['CaO', 'CaO', '%', 0.1], ['MgO', 'MgO', '%', 0.1],
  ['rho', 'Densidad', 't/m³', 0.05], ['co2', 'CO₂ incorp.', 't/t', 0.01]
];
function renderMaterials() {
  const t = $('#matTable');
  t.classList.add('compact');
  t.innerHTML = `<thead><tr><th class="first">Usar</th><th>Material</th><th>Tipo</th>${MAT_COLS.map(c => `<th class="n">${c[1]}<br><span class="muted" style="font-weight:400">${c[2]}</span></th>`).join('')}<th>Cesta</th><th class="last"></th></tr></thead><tbody>${S.mats.map((m, i) => `
    <tr data-i="${i}"><td class="first"><input type="checkbox" data-mf="use" ${m.use ? 'checked' : ''} aria-label="Usar ${esc(m.name)}"></td>
    <td><span class="matname"><span class="sw" style="background:${matColor(m)}"></span><input class="cell txt" data-mf="name" value="${esc(m.name)}" aria-label="Nombre"></span></td>
    <td><select class="cell" data-mf="type" aria-label="Tipo">${Object.entries(TYPE_LABEL).map(([k, v]) => `<option value="${k}" ${m.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
    ${MAT_COLS.map(c => {
      const isDRI = m.type === 'dri';
      if (c[0] === 'yield' && isDRI) return `<td class="n muted" title="Calculado a partir del Fe total, la metalización y el carbono">${f(matYield(m), 3)}</td>`;
      if ((c[0] === 'FeTot' || c[0] === 'met') && !isDRI) return `<td class="n muted">—</td>`;
      return `<td class="n"><input class="cell sm" type="number" step="${c[3]}" data-mf="${c[0]}" value="${m[c[0]]}" aria-label="${c[1]}"></td>`;
    }).join('')}
    <td><input type="checkbox" data-mf="basket" ${m.basket ? 'checked' : ''} aria-label="Se carga por cesta"></td>
    <td class="last"><button class="btn sm ghost danger" type="button" data-del="${i}" aria-label="Quitar material">Quitar</button></td></tr>`).join('')}</tbody>`;
  $('#matNote').innerHTML = `Valores de referencia tomados de rangos publicados para cada tipo de material; se reemplazan por los análisis del patio de chatarra y del laboratorio de la planta. El rendimiento del DRI se calcula con su Fe total, metalización y carbono. La columna <b>Cesta</b> indica si el material se carga por cesta; el DRI marcado como alimentación continua no ocupa volumen de cesta.`;
  // mapa costo vs cobre
  const pts = S.mats.filter(m => m.use);
  if (pts.length) {
    Charts.line($('#chMatMap'), {
      height: 280,
      series: [{ name: 'Precio', points: pts.map(m => [m.Cu, m.price]), dotsOnly: true, color: 'transparent', noTip: true }],
      markers: pts.map(m => ({ x: m.Cu, y: m.price, color: matColor(m), label: m.name.length > 22 ? m.name.slice(0, 21) + '…' : m.name })),
      vlines: S.p.lim.Cu > 0 ? [{ x: S.p.lim.Cu, color: 'var(--crimson)', label: 'Límite del grado' }] : [],
      x: { label: 'Cobre en el material (%)', fmt: v => f(v, 2), min: 0 }, y: { label: 'Precio (USD/t)' }
    });
  }
  // calculadora DRI
  const dris = S.mats.filter(m => m.type === 'dri');
  $('#driCalc').innerHTML = dris.length ? dris.map(m => {
    const feMet = m.FeTot * m.met / 100, feOx = m.FeTot - feMet, lime = matLime(m, S.p) * 1000;
    const dW = 80 + 1000 * matLime(m, S.p) + 400 * (1 / matYield(m) - 1);
    return `<p style="margin:0 0 6px;font-weight:600"><span class="sw" style="background:${matColor(m)}"></span>${esc(m.name)}</p><div class="dl" style="margin-bottom:14px">
      <div class="k">Fe metálico</div><div class="v">${f(feMet, 1)}<small>%</small></div>
      <div class="k">Fe como FeO</div><div class="v">${f(feOx, 1)}<small>%</small></div>
      <div class="k">Rendimiento metálico calculado</div><div class="v">${f(matYield(m), 3)}<small>t/t</small></div>
      <div class="k">Escorificante requerido por basicidad</div><div class="v">${f(lime, 0)}<small>kg/t DRI</small></div>
      <div class="k">Energía adicional frente a chatarra</div><div class="v">${f(dW, 0)}<small>kWh/t DRI</small></div></div>`;
  }).join('') + `<p class="note">Una parte del FeO residual se reduce con el carbono del DRI y el resto pasa a la escoria. La ganga ácida exige cal para mantener la basicidad, y esa cal también consume energía. Por eso un DRI con 1 % más de SiO₂ cuesta más de lo que indica su precio.</p>` : '<p class="note">No hay materiales tipo DRI / HBI.</p>';
}
function onMatInput(e) {
  const inp = e.target; const tr = inp.closest('tr[data-i]'); if (!tr || !inp.dataset.mf) return;
  const m = S.mats[+tr.dataset.i]; const k = inp.dataset.mf;
  if (inp.type === 'checkbox') m[k] = inp.checked;
  else if (k === 'name') m.name = inp.value;
  else if (k === 'type') { m.type = inp.value; if (m.type === 'dri' && !m.FeTot) { m.FeTot = 92; m.met = 93; } if (m.type !== 'dri' && !m.yield) m.yield = 0.92; renderMaterials(); }
  else { const v = parseFloat(inp.value); if (!isFinite(v)) return; m[k] = v; }
  clearTimeout(inT); inT = setTimeout(() => recalc(), 220);
}

// ---------------- Vista: carga óptima ----------------
function renderResult() {
  const msg = $('#optMsg');
  if (!R || R.status !== 'optimal') {
    msg.innerHTML = infeasibleHTML();
    ['#stackBar', '#recipeTable', '#bullets', '#massList', '#chWaterfall', '#chCost', '#consTable', '#chCO2', '#co2Note'].forEach(s => $(s).innerHTML = '');
    renderCompare(); return;
  }
  msg.innerHTML = '';
  const e = R.ev, p = S.p;
  const rows = S.mats.map((m, i) => ({ m, i, t: e.x[i] })).filter(r => r.m.use);
  const used = rows.filter(r => r.t > 0.05).sort((a, b) => b.t - a.t);
  $('#stackBar').innerHTML = `<div class="stack">${used.map(r => `<div style="width:${r.t / e.GE * 100}%;background:${matColor(r.m)}">${r.t / e.GE > 0.07 ? f(r.t / e.GE * 100, 0) + ' %' : ''}</div>`).join('')}</div><div class="legend">${used.map(r => `<span><span class="sw" style="background:${matColor(r.m)}"></span>${esc(r.m.name)}</span>`).join('')}</div>`;
  const tot = { t: 0, usd: 0, cu: 0, vol: 0 };
  $('#recipeTable').innerHTML = `<thead><tr><th class="first">Material</th><th class="n">t por colada</th><th class="n">% carga</th><th class="n">USD por colada</th><th class="n">Cu (kg)</th><th class="n last">Uso</th></tr></thead><tbody>${rows.sort((a, b) => b.t - a.t).map(r => {
    const cont = r.m.type === 'dri' && !r.m.basket && p.driContinuous;
    const usd = r.t * r.m.price, cu = r.t * r.m.Cu * 10; tot.t += r.t; tot.usd += usd; tot.cu += cu;
    const atMax = r.t >= r.m.max - 1e-6 && r.t > 0;
    const use = r.t < 0.05 ? '<span class="muted">—</span>' : atMax ? `<span class="pill warn" title="Se usa todo el inventario disponible">100 %</span>` : `${f(r.t / r.m.max * 100, 0)} %`;
    return `<tr${r.t < 0.05 ? ' class="muted"' : ''}><td class="first nw"><span class="sw" style="background:${matColor(r.m)}"></span>${esc(r.m.name)}${cont && r.t > 0.05 ? ' <span class="pill info">Continuo</span>' : ''}</td><td class="n"><b>${f(r.t, 1)}</b></td><td class="n">${f(r.t / e.GE * 100, 1)}</td><td class="n">${f(usd, 0)}</td><td class="n">${f(cu, 1)}</td><td class="n last">${use}</td></tr>`;
  }).join('')}</tbody><tfoot><tr><td class="first">Total</td><td class="n">${f(tot.t, 1)}</td><td class="n">100.0</td><td class="n">${f(tot.usd, 0)}</td><td class="n">${f(tot.cu, 1)}</td><td class="last"></td></tr></tfoot>`;
  $('#recipeTools').innerHTML = `<span class="note">${f(e.G, 1)} t de acero líquido</span>`;
  // residuales
  $('#bullets').innerHTML = ELEMENTS.map(el => {
    const v = e.resid[el], lim = p.lim[el];
    const has = lim > 0; const max = Math.max(has ? lim * 1.3 : v * 1.3, v * 1.1, 1e-4);
    const ratio = has ? v / lim : 0;
    const col = !has ? 'var(--blue)' : ratio > 1.0001 ? 'var(--crimson)' : ratio > 0.92 ? 'var(--amber)' : 'var(--green)';
    return `<div class="bl"><div class="el">${EL_SUB[el]}</div><div class="track"><div class="fill" style="width:${Math.min(100, v / max * 100)}%;background:${col}"></div>${has ? `<div class="lim" style="left:${lim / max * 100}%" title="Límite ${f(lim, 3)} %"></div>` : ''}</div><div class="v"><b>${f(v, 4)} %</b> <span>/ ${has ? f(lim, 3) : 'libre'}</span></div></div>`;
  }).join('') + `<p class="note" style="margin:2px 0 0">La línea vertical marca el límite del grado. Cobre, estaño, níquel y molibdeno no se oxidan en el horno, así que pasan completos al acero; del cromo se considera que el ${f(p.rec.Cr * 100)} % queda en el baño.</p>`;
  const volCap = p.basketV * p.nBaskets;
  $('#massList').innerHTML = [
    ['Acero líquido por colada', f(e.G, 1), 't'], ['Carga metálica total', f(e.GE, 1), 't'], ['Rendimiento metálico', f(e.yieldAvg * 100, 1), '%'],
    ['Escorificantes', f(e.limeKg, 0), 'kg/t'], ['Escoria estimada', f(e.slagKg, 0), 'kg/t'], ['Carbono cargado e inyectado', f(e.Ctotal, 1), 'kg/t'],
    ['O₂ estequiométrico para C → CO', f(e.O2stoich, 1), 'Nm³/t'], ['Volumen de cestas usado', f(e.vol, 0) + ' de ' + f(volCap, 0), 'm³'], ['Consumo de electrodo', f(e.electrode, 2), 'kg/t']
  ].map(r => `<div class="k">${r[0]}</div><div class="v">${r[1]}<small>${r[2]}</small></div>`).join('');
  // cascada
  const tm = e.terms;
  Charts.waterfall($('#chWaterfall'), {
    height: 300, steps: [
      { short: 'Fusión', label: 'Fusión', label2: 'del acero', full: 'Energía base para fundir y sobrecalentar el acero', value: tm.base, total: true, color: 'var(--ink-3)' },
      { short: 'Carga', label: 'Carga', label2: 'extra', full: 'Material cargado por encima del acero vaciado (pérdidas a escoria y polvo)', value: tm.charge },
      { short: 'DRI', label: 'DRI', label2: 'HBI', full: 'Penalización por DRI / HBI', value: tm.dri },
      { short: 'Fragm.', label: 'Frag-', label2: 'mentada', full: 'Chatarra fragmentada (funde más rápido)', value: tm.shred },
      { short: 'Escorif.', label: 'Escori-', label2: 'ficantes', full: 'Fusión de cal y escorificantes', value: tm.slag },
      { short: 'Temp.', label: 'Tempe-', label2: 'ratura', full: 'Sobrecalentamiento sobre 1600 °C', value: tm.temp },
      { short: 'Tiempo', label: 'Tiempo', label2: 'de colada', full: 'Pérdidas proporcionales al tap-to-tap', value: tm.time },
      { short: 'Gas', label: 'Quema-', label2: 'dores', full: 'Energía química del gas natural', value: tm.gas },
      { short: 'O₂', label: 'Oxí-', label2: 'geno', full: 'Energía química del oxígeno de lanza y postcombustión', value: tm.o2 },
      ...(Math.abs(tm.cal) > 0.05 ? [{ short: 'Calib.', label: 'Calibra-', label2: 'ción', full: 'Corrección con coladas reales del horno', value: tm.cal }] : []),
      { short: 'Total', label: 'Total', label2: 'kWh/t', full: 'Energía eléctrica específica', value: e.W, total: true, color: 'var(--accent)' }
    ]
  });
  // costo
  const c = e.cost;
  Charts.barsH($('#chCost'), {
    labelW: 168, valFmt: v => f(v, 2), fmt: v => f(v, 0), rows: [
      { label: 'Materiales metálicos', value: c.mat, color: 'var(--blue)' }, { label: 'Energía eléctrica', value: c.el, color: 'var(--accent)' },
      { label: 'Electrodo', value: c.electrode, color: 'var(--warm)' }, { label: 'Cal y escorificantes', value: c.lime, color: 'var(--teal)' },
      { label: 'Oxígeno', value: c.o2, color: 'var(--sky)' }, { label: 'Gas natural', value: c.gas, color: 'var(--violet)' },
      { label: 'Carbono', value: c.carbon, color: 'var(--m4)' }, { label: 'Otros de conversión', value: c.fixed, color: 'var(--m4)' },
      ...(c.co2 > 0 ? [{ label: 'Carbono emitido', value: c.co2, color: 'var(--crimson)' }] : [])
    ]
  });
  // restricciones
  const consName = c2 => {
    if (c2.k === 'mass') return 'Balance de masa: acero vaciado';
    if (c2.k === 'lim') return EL_SUB[c2.e] + ' en el acero';
    if (c2.k === 'drimax') return 'DRI / HBI máximo';
    if (c2.k === 'drimin') return 'DRI / HBI mínimo';
    if (c2.k === 'vol') return 'Volumen de cestas';
    if (c2.k === 'prod') return 'Productividad mínima';
    if (c2.k === 'max') return 'Disponible: ' + (S.mats.find(m => m.id === c2.id) || {}).name;
    if (c2.k === 'min') return 'Mínimo: ' + (S.mats.find(m => m.id === c2.id) || {}).name;
    return c2.k;
  };
  const consVal = c2 => {
    if (c2.k === 'mass') return [f(e.G, 1) + ' t', f(p.GA, 1) + ' t'];
    if (c2.k === 'lim') return [f(e.resid[c2.e], 4) + ' %', f(p.lim[c2.e], 3) + ' %'];
    if (c2.k === 'drimax' || c2.k === 'drimin') return [f(e.driShare, 1) + ' %', f(c2.k === 'drimax' ? p.driMax : p.driMin, 0) + ' %'];
    if (c2.k === 'vol') return [f(e.vol, 0) + ' m³', f(p.basketV * p.nBaskets, 0) + ' m³'];
    if (c2.k === 'prod') return [f(e.prod, 0) + ' t/h', f(p.prodMin, 0) + ' t/h'];
    if (c2.k === 'max' || c2.k === 'min') { const i = S.mats.findIndex(m => m.id === c2.id); return [f(e.x[i], 1) + ' t', f(c2.k === 'max' ? S.mats[i].max : S.mats[i].min, 1) + ' t']; }
    return ['', ''];
  };
  const mvKey = c2 => c2.k === 'lim' ? 'lim_' + c2.e : c2.k === 'max' ? 'max_' + c2.id : c2.k;
  const consRows = R.cons.filter(c2 => c2.k !== 'max' || c2.active).sort((a, b) => (b.active - a.active));
  $('#consTable').innerHTML = `<thead><tr><th class="first">Restricción</th><th class="n">Valor</th><th class="n">Límite</th><th>Estado</th><th class="n last">Valor de relajar</th></tr></thead><tbody>${consRows.map(c2 => {
    const [v, l] = consVal(c2); const mv = MV && MV[mvKey(c2)];
    const st = c2.k === 'mass' ? '<span class="pill mute">Igualdad</span>' : c2.active ? '<span class="pill warn">Activa</span>' : '<span class="pill ok">Con holgura</span>';
    return `<tr><td class="first">${esc(consName(c2))}</td><td class="n">${v}</td><td class="n">${l}</td><td>${st}</td><td class="n last">${mv && mv.v != null ? `<b>${f(mv.v, 2)}</b> <span class="muted">USD/t ${mv.unit}</span>` : '<span class="muted">—</span>'}</td></tr>`;
  }).join('')}</tbody>`;
  // CO2
  Charts.barsH($('#chCO2'), {
    labelW: 168, valFmt: v => f(v, 0), fmt: v => f(v, 0), rows: [
      { label: 'Electricidad (red)', value: e.co2.el, color: 'var(--accent)' }, { label: 'Gas natural', value: e.co2.gas, color: 'var(--violet)' },
      { label: 'Carbono cargado e inyectado', value: e.co2.carbon, color: 'var(--m4)' }, { label: 'Materias primas', value: e.co2.mat, color: 'var(--teal)' }
    ]
  });
  const pos = v => Math.min(100, v / 2.4 * 100);
  $('#co2Note').innerHTML = `<p class="note" style="margin:10px 0 6px">kg de CO₂ por tonelada de acero líquido. Comparación con la literatura en t CO₂/t:</p>
    <div style="position:relative;height:40px;margin:4px 6px 22px">
      <div style="position:absolute;left:0;right:0;top:14px;height:10px;border-radius:5px;background:var(--panel-2);border:1px solid var(--line-2)"></div>
      <div title="Ruta horno eléctrico: 0,25–1,1 t/t" style="position:absolute;top:14px;height:10px;left:${pos(0.25)}%;width:${pos(1.1) - pos(0.25)}%;background:var(--teal);opacity:.35;border-radius:5px"></div>
      <div title="Alto horno y convertidor: 1,6–2,2 t/t" style="position:absolute;top:14px;height:10px;left:${pos(1.6)}%;width:${pos(2.2) - pos(1.6)}%;background:var(--crimson);opacity:.3;border-radius:5px"></div>
      <div style="position:absolute;top:6px;height:26px;width:3px;border-radius:2px;background:var(--ink);left:calc(${pos(e.co2Total / 1000)}% - 1px)"></div>
      <div style="position:absolute;top:36px;font-size:11.5px;color:var(--ink-2);left:${pos(0.25)}%;white-space:nowrap">Horno eléctrico 0.25–1.1</div>
      <div style="position:absolute;top:36px;font-size:11.5px;color:var(--ink-2);right:0;white-space:nowrap">Alto horno y convertidor 1.6–2.2</div>
      <div style="position:absolute;top:-12px;font-size:11.5px;font-weight:600;color:var(--ink);left:calc(${pos(e.co2Total / 1000)}% + 6px);white-space:nowrap">Esta receta ${f(e.co2Total / 1000, 2)} t/t</div>
    </div><p class="note" style="margin:0">Rangos publicados por Kirschen, Hay y Echterhof (2021). El valor de esta receta incluye el CO₂ incorporado en las materias primas.</p>`;
  renderCompare();
}

function renderCompare() {
  const used = S.mats.filter(m => m.use);
  const ok = R && R.status === 'optimal';
  $('#cmpTable').innerHTML = `<thead><tr><th class="first">Material</th><th class="n">Receta actual (t)</th><th class="n last">Óptima (t)</th></tr></thead><tbody>${used.map(m => {
    const i = S.mats.indexOf(m);
    return `<tr><td class="first"><span class="sw" style="background:${matColor(m)}"></span>${esc(m.name)}</td><td class="n"><input class="cell" type="number" step="0.5" data-cmp="${m.id}" value="${S.cmp[m.id] ?? 0}" aria-label="Receta actual ${esc(m.name)}"></td><td class="n last">${ok ? f(R.ev.x[i], 1) : '—'}</td></tr>`;
  }).join('')}</tbody>`;
  const x = S.mats.map(m => m.use ? +(S.cmp[m.id] || 0) : 0);
  const out = $('#cmpOut');
  if (x.reduce((s, v) => s + v, 0) <= 0) { out.innerHTML = '<p class="note">Ingresa la receta que usa hoy el taller para calcular la diferencia.</p>'; return; }
  const ev = evaluate(x, S.mats, S.p, CAL);
  if (!ev || !ok) { out.innerHTML = '<p class="note">No hay solución óptima para comparar.</p>'; return; }
  const d = ev.costTotal - R.ev.costTotal;
  const viol = ELEMENTS.filter(el => S.p.lim[el] > 0 && ev.resid[el] > S.p.lim[el] + 1e-9);
  out.innerHTML = viol.length ? `<div class="bigread"><strong>${f(d, 2)}</strong><span>USD/t de diferencia frente a la óptima</span></div><p class="note" style="margin:6px 0 0">La receta actual es más barata porque no cumple el grado; la diferencia no es un ahorro alcanzable.</p>` : `<div class="bigread savings ${d < 0 ? 'neg' : ''}"><strong>${f(d, 2)}</strong><span>USD/t de ahorro con la receta óptima</span></div>
    <div class="bigread savings ${d < 0 ? 'neg' : ''}" style="margin-top:6px"><strong style="font-size:22px">${f(d * S.p.annual / 1e6, 2)}</strong><span>millones de USD al año con ${f(S.p.annual / 1e6, 2)} Mt de producción</span></div>
    <div class="dl" style="margin-top:14px">
      <div class="k">Acero que produce la receta actual</div><div class="v">${f(ev.G, 1)}<small>t</small></div>
      <div class="k">Costo receta actual / óptima</div><div class="v">${f(ev.costTotal, 2)} / ${f(R.ev.costTotal, 2)}<small>USD/t</small></div>
      <div class="k">Energía actual / óptima</div><div class="v">${f(ev.W, 0)} / ${f(R.ev.W, 0)}<small>kWh/t</small></div>
      <div class="k">Cobre actual / óptimo</div><div class="v">${f(ev.resid.Cu, 3)} / ${f(R.ev.resid.Cu, 3)}<small>%</small></div>
      <div class="k">CO₂ directo actual / óptimo</div><div class="v">${f(ev.co2Direct, 0)} / ${f(R.ev.co2Direct, 0)}<small>kg/t</small></div>
    </div>
    <div style="margin-top:12px">${viol.length ? `<div class="callout bad"><div>La receta actual <b>no cumple</b> el grado en ${viol.map(v => EL_SUB[v]).join(', ')}.</div></div>` : `<div class="callout ok"><div>La receta actual cumple la química del grado.</div></div>`}${Math.abs(ev.G - S.p.GA) > 3 ? `<div class="callout warn" style="margin-top:8px"><div>La receta actual produce ${f(ev.G, 1)} t, distinto del objetivo de ${f(S.p.GA, 0)} t. La comparación se hace por tonelada.</div></div>` : ''}</div>`;
}

// ---------------- Vista: escenarios ----------------
function scenarios() {
  const key = JSON.stringify([S.mats, S.p, CAL && CAL.ready ? [CAL.a, CAL.b] : 0, S.mapY]);
  if (key === SC_KEY && SC) return SC;
  const sweep = [];
  const pFree = Object.assign(clone(S.p), { lim: { Cu: 0, Sn: 0, Ni: 0, Cr: 0, Mo: 0 } });
  for (let s = 0; s <= 100.001; s += 2.5) {
    const r = optimize(S.mats, S.p, CAL, { driShareFix: s });
    const rf = optimize(S.mats, pFree, CAL, { driShareFix: s });
    sweep.push({ s, ok: r.status === 'optimal', cost: r.ev && r.ev.costTotal, cu: r.ev && r.ev.resid.Cu, W: r.ev && r.ev.W, prod: r.ev && r.ev.prod, freeCost: rf.ev && rf.ev.costTotal, freeCu: rf.ev && rf.ev.resid.Cu });
  }
  // tornado
  const base = R.ev.costTotal; const torn = [];
  S.mats.filter(m => m.use).forEach(m => {
    const lo = optimize(S.mats, S.p, CAL, { priceMult: { [m.id]: 0.85 } }), hi = optimize(S.mats, S.p, CAL, { priceMult: { [m.id]: 1.15 } });
    if (lo.ev && hi.ev) torn.push({ label: m.name, lo: lo.ev.costTotal - base, hi: hi.ev.costTotal - base, dl: lo.ev.driShare, dh: hi.ev.driShare });
  });
  const elo = optimize(S.mats, S.p, CAL, { pElMult: 0.85 }), ehi = optimize(S.mats, S.p, CAL, { pElMult: 1.15 });
  if (elo.ev && ehi.ev) torn.push({ label: 'Energía eléctrica', lo: elo.ev.costTotal - base, hi: ehi.ev.costTotal - base, dl: elo.ev.driShare, dh: ehi.ev.driShare });
  torn.sort((a, b) => Math.max(Math.abs(b.lo), Math.abs(b.hi)) - Math.max(Math.abs(a.lo), Math.abs(a.hi)));
  // mapa
  const mY = S.mats.find(m => m.id === S.mapY && m.use) || S.mats.find(m => m.use && m.type === 'dri') || S.mats.find(m => m.use);
  const xs = []; for (let v = 40; v <= 160.001; v += 10) xs.push(v);
  const ys = []; for (let k = 0; k <= 10; k++) ys.push(Math.round(mY.price * (0.7 + 0.06 * k)));
  const z = ys.map(py => xs.map(px => { const r = optimize(S.mats, S.p, CAL, { pEl: px, priceSet: { [mY.id]: py } }); return r.status === 'optimal' ? r.ev.driShare : null; }));
  SC = { sweep, torn, map: { xs, ys, z, mat: mY } }; SC_KEY = key;
  return SC;
}
function mixColor(a, b, t) {
  const pa = hexRGB(a), pb = hexRGB(b);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
}
function hexRGB(h) { h = h.trim(); if (h.startsWith('rgb')) return h.match(/\d+/g).slice(0, 3).map(Number); h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function renderScenarios() {
  if (!R || R.status !== 'optimal') { $('#chDRI').innerHTML = infeasibleHTML(); ['#chDRI2', '#chTornado', '#chMap', '#noteDRI'].forEach(s => $(s).innerHTML = ''); return; }
  const sc = scenarios(); const e = R.ev;
  const feas = sc.sweep.filter(r => r.ok);
  const bands = []; let from = null;
  sc.sweep.forEach((r, i) => { if (!r.ok && from == null) from = r.s; if ((r.ok || i === sc.sweep.length - 1) && from != null) { bands.push({ from: Math.max(0, from - 1.25), to: r.ok ? r.s - 1.25 : 100, color: 'var(--crimson)', opacity: 0.07, label: bands.length ? null : 'Sin solución' }); from = null; } });
  $('#keyDRI').innerHTML = `<span><i style="background:var(--accent)"></i>Costo con la especificación</span><span style="color:var(--ink-3)"><i class="dash" style="background:var(--ink-3)"></i>Costo sin límites de residuales</span><span><i style="background:var(--crimson)"></i>Cobre resultante (eje derecho)</span>`;
  Charts.line($('#chDRI'), {
    height: 300,
    series: [
      { name: 'Costo', color: 'var(--accent)', points: sc.sweep.map(r => [r.s, r.ok ? r.cost : null]), width: 2.5, fmt: v => f(v, 2) + ' USD/t' },
      { name: 'Sin límites', color: 'var(--ink-3)', dash: '5 4', points: sc.sweep.map(r => [r.s, r.freeCost ?? null]), fmt: v => f(v, 2) + ' USD/t' },
      { name: 'Cu', color: 'var(--crimson)', axis: 'y2', points: sc.sweep.map(r => [r.s, r.ok ? r.cu : r.freeCu ?? null]), fmt: v => f(v, 3) + ' %' }
    ],
    xbands: bands,
    hlines: S.p.lim.Cu > 0 ? [{ y: S.p.lim.Cu, axis: 'y2', color: 'var(--crimson)', label: 'Límite Cu ' + f(S.p.lim.Cu, 3) + ' %' }] : [],
    markers: [{ x: e.driShare, y: e.costTotal, color: 'var(--accent)', label: 'Óptimo ' + f(e.driShare, 1) + ' % DRI' }],
    x: { label: 'DRI / HBI en la carga metálica (%)', min: 0, max: 100, tipLabel: v => f(v, 1) + ' % DRI' },
    y: { label: 'Costo total (USD/t)', fmt: v => f(v, 0) }, y2: { label: 'Cu en el acero (%)', fmt: v => f(v, 2), min: 0 }
  });
  const minFeas = feas.length ? feas[0].s : null;
  const maxFeas = feas.length ? feas[feas.length - 1].s : null;
  const gap = sc.sweep.find(r => Math.abs(r.s - Math.round(e.driShare / 2.5) * 2.5) < 1e-6);
  $('#noteDRI').innerHTML = feas.length ? `${minFeas > 0 ? `Con la especificación actual se necesita al menos ${f(minFeas, 1)} % de DRI / HBI para cumplir la química. ` : `La química del grado se puede cumplir en todo el rango de ${f(minFeas, 0)} a ${f(maxFeas, 0)} % de DRI / HBI, aunque con distinto costo. `}La distancia entre la curva naranja y la punteada es lo que cuesta diluir residuales en cada punto${gap && gap.ok && gap.freeCost != null ? `; cerca del óptimo son ${f(gap.cost - gap.freeCost, 1)} USD/t` : ''}. El óptimo económico está en ${f(e.driShare, 1)} % de DRI / HBI.` : '';
  $('#keyDRI2').innerHTML = `<span><i style="background:var(--warm)"></i>Energía eléctrica</span><span><i style="background:var(--blue)"></i>Productividad (eje derecho)</span>`;
  Charts.line($('#chDRI2'), {
    height: 260,
    series: [
      { name: 'Energía', color: 'var(--warm)', points: sc.sweep.map(r => [r.s, r.ok ? r.W : null]), width: 2.2, fmt: v => f(v, 0) + ' kWh/t' },
      { name: 'Productividad', color: 'var(--blue)', axis: 'y2', points: sc.sweep.map(r => [r.s, r.ok ? r.prod : null]), width: 2.2, fmt: v => f(v, 0) + ' t/h' }
    ],
    markers: [{ x: e.driShare, y: e.W, color: 'var(--warm)' }],
    x: { label: 'DRI / HBI en la carga (%)', min: 0, max: 100, tipLabel: v => f(v, 1) + ' % DRI' }, y: { label: 'kWh/t' }, y2: { label: 't/h' }
  });
  Charts.barsH($('#chTornado'), {
    labelW: 176, loColor: 'var(--teal)', hiColor: 'var(--crimson)', fmt: v => (v > 0 ? '+' : '') + f(v, 0),
    rows: sc.torn.slice(0, 8).map(t => ({ label: t.label, lo: t.lo, hi: t.hi, valText: `${f(t.lo, 1)} / +${f(t.hi, 1)}`, tip: `Precio −15 %: ${f(t.lo, 2)} USD/t (DRI ${f(t.dl, 0)} %)<br>Precio +15 %: +${f(t.hi, 2)} USD/t (DRI ${f(t.dh, 0)} %)` }))
  });
  // mapa
  const sel = $('#mapY');
  sel.innerHTML = S.mats.filter(m => m.use).map(m => `<option value="${m.id}" ${m.id === sc.map.mat.id ? 'selected' : ''}>Precio: ${esc(m.name)}</option>`).join('');
  const c0 = '#FFF3E2', c1 = '#138A83';
  const zs = sc.map.z.flat().filter(v => v != null); const zmax = Math.max(10, ...zs);
  Charts.heatmap($('#chMap'), {
    height: 330, xs: sc.map.xs, ys: sc.map.ys, z: sc.map.z,
    color: v => mixColor(c0, c1, Math.min(1, v / zmax) * 0.92 + 0.04),
    xFmt: v => f(v), yFmt: v => f(v), xLabel: 'Precio de la energía eléctrica (USD/MWh)', yLabel: 'Precio ' + sc.map.mat.name + ' (USD/t)',
    tip: (x, y, v) => `<div class="ctip-h">${f(x)} USD/MWh · ${f(y)} USD/t</div>${v == null ? 'Sin solución factible' : 'DRI óptimo: <b>' + f(v, 1) + ' %</b>'}`,
    legend: { min: 0, max: zmax, fmt: v => f(v, 0) + ' % DRI' }, marker: { x: S.p.pEl, y: sc.map.mat.price }
  });
}

// ---------------- Vista: registro de coladas ----------------
function heatPred(h) {
  // predicción del modelo activo para la colada (validación dejando la colada fuera cuando pertenece a la calibración)
  const mid = activeModelId();
  if (CAL && CAL.ready) {
    const k = CAL.valid.indexOf(h);
    if (k >= 0) return CAL.models.find(m => m.id === mid).loo[k];
  }
  const r = heatInputs(h, S.mats, S.p); return r.K;
}
function heatStatus(h, pred) {
  const kwh = h.MWh * 1000 / h.GA; const dev = kwh - pred;
  const sd = CAL && CAL.ready ? CAL.models.find(m => m.id === activeModelId()).metrics.rmse : 25;
  const lim = GRADES[h.grade] || { Cu: S.p.lim.Cu, Sn: S.p.lim.Sn };
  const chemBad = (lim.Cu && h.Cu > lim.Cu + 1e-9) || (lim.Sn && h.Sn > lim.Sn + 1e-9);
  const energyBad = Math.abs(dev) > 2.5 * sd;
  return { kwh, dev, chemBad, energyBad, pill: chemBad ? '<span class="pill bad">Química fuera</span>' : energyBad ? '<span class="pill warn">Energía atípica</span>' : '<span class="pill ok">Conforme</span>' };
}
function sortedHeats() { return S.heats.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)); }
function renderRegistry() {
  const hs = sortedHeats();
  if (!S.selHeat && hs.length) S.selHeat = hs[0].id;
  $('#heatTable').classList.add('nowrap');
  $('#heatTable').innerHTML = `<thead><tr><th class="first">Colada</th><th>Fecha y hora</th><th class="n">DRI %</th><th class="n">Medido<br><span class="muted" style="font-weight:400">kWh/t</span></th><th class="n">Predicho<br><span class="muted" style="font-weight:400">kWh/t</span></th><th class="n">Desv.</th><th class="n">Cu %</th><th class="last">Estado</th></tr></thead><tbody>${hs.map(h => {
    const pred = heatPred(h); const st = heatStatus(h, pred);
    const GE = Object.values(h.charge).reduce((s, v) => s + +v, 0);
    const dri = S.mats.reduce((s, m) => s + (m.type === 'dri' ? +(h.charge[m.id] || 0) : 0), 0) / (GE || 1) * 100;
    return `<tr class="click ${h.id === S.selHeat ? 'sel' : ''}" data-heat="${esc(h.id)}" tabindex="0"><td class="first"><b>${esc(h.id)}</b></td><td>${esc(h.date.slice(5))} <span class="muted">${esc(h.time)} · ${esc(h.shift)}</span></td><td class="n">${f(dri, 1)}</td><td class="n">${f(st.kwh, 0)}</td><td class="n">${f(pred, 0)}</td><td class="n" style="color:${st.energyBad ? 'var(--crimson)' : 'inherit'}">${st.dev > 0 ? '+' : ''}${f(st.dev, 0)}</td><td class="n">${f(h.Cu, 3)}</td><td class="last">${st.pill}</td></tr>`;
  }).join('')}</tbody>`;
  $('#heatTable').closest('.tw').style.maxHeight = '430px';
  const demo = S.heats.some(h => h.demo);
  $('#clearDemoWrap').innerHTML = demo ? `<button class="btn sm ghost" type="button" id="btnClearDemo">Quitar coladas de ejemplo</button>` : '';
  renderHeatDetail();
  if (!$('#h_id')) renderHeatForm();
}
function renderHeatDetail() {
  const h = S.heats.find(x => x.id === S.selHeat);
  const box = $('#heatDetail');
  if (!h) { $('#hdTitle').textContent = 'Detalle de la colada'; $('#hdTools').innerHTML = ''; box.innerHTML = '<p class="note">Selecciona una colada del registro.</p>'; return; }
  const pred = heatPred(h); const st = heatStatus(h, pred);
  const GE = Object.values(h.charge).reduce((s, v) => s + +v, 0);
  const lim = GRADES[h.grade] || S.p.lim;
  $('#hdTitle').textContent = 'Colada ' + h.id;
  $('#hdTools').innerHTML = `<button class="btn sm" type="button" id="btnHeatRep">Generar reporte</button><span id="delWrap"><button class="btn sm ghost danger" type="button" id="btnHeatDel">Eliminar</button></span>`;
  const rows = S.mats.map(m => ({ m, t: +(h.charge[m.id] || 0) })).filter(r => r.t > 0).sort((a, b) => b.t - a.t);
  box.innerHTML = `${h.demo ? '<div class="callout info" style="margin-bottom:12px"><div>Colada de ejemplo generada para demostrar la calibración. Se reemplaza con datos del horno.</div></div>' : ''}
  <div class="grid g2">
    <div class="dl">
      <div class="k">Fecha y hora</div><div class="v">${esc(h.date)} ${esc(h.time)}</div>
      <div class="k">Turno · operador</div><div class="v">${esc(h.shift)} · ${esc(h.operator || '—')}</div>
      <div class="k">Grado</div><div class="v">${esc((GRADES[h.grade] || {}).name || 'Propio')}</div>
      <div class="k">Acero vaciado</div><div class="v">${f(h.GA, 1)}<small>t</small></div>
      <div class="k">Carga metálica</div><div class="v">${f(GE, 1)}<small>t</small></div>
      <div class="k">Temperatura de vaciado</div><div class="v">${Math.round(h.T)}<small>°C</small></div>
      <div class="k">Tap-to-tap</div><div class="v">${f(h.t2t, 1)}<small>min</small></div>
    </div>
    <div class="dl">
      <div class="k">Energía medida</div><div class="v">${f(h.MWh, 2)}<small>MWh</small></div>
      <div class="k">Energía específica medida</div><div class="v">${f(st.kwh, 0)}<small>kWh/t</small></div>
      <div class="k">Predicción del modelo</div><div class="v">${f(pred, 0)}<small>kWh/t</small></div>
      <div class="k">Desviación</div><div class="v" style="color:${st.energyBad ? 'var(--crimson)' : 'inherit'}">${st.dev > 0 ? '+' : ''}${f(st.dev, 0)}<small>kWh/t</small></div>
      <div class="k">Cu final / límite</div><div class="v" style="color:${lim.Cu && h.Cu > lim.Cu ? 'var(--crimson)' : 'inherit'}">${f(h.Cu, 3)} / ${f(lim.Cu, 3)}<small>%</small></div>
      <div class="k">Sn final / límite</div><div class="v">${f(h.Sn, 4)} / ${f(lim.Sn, 3)}<small>%</small></div>
      <div class="k">Estado</div><div class="v">${st.pill}</div>
    </div>
  </div>
  <div style="margin-top:14px"><div class="stack" style="height:22px">${rows.map(r => `<div style="width:${r.t / GE * 100}%;background:${matColor(r.m)}" title="${esc(r.m.name)}: ${f(r.t, 1)} t"></div>`).join('')}</div>
  <div class="legend">${rows.map(r => `<span><span class="sw" style="background:${matColor(r.m)}"></span>${esc(r.m.name)} ${f(r.t, 1)} t</span>`).join('')}</div></div>
  ${h.notes ? `<p class="prose" style="margin:12px 0 0"><b>Observaciones:</b> ${esc(h.notes)}</p>` : ''}`;
}
const HEAT_MEAS = [['GA', 'Acero vaciado', 't', 0.1], ['MWh', 'Energía eléctrica medida', 'MWh', 0.01], ['T', 'Temperatura de vaciado', '°C', 1], ['t2t', 'Tap-to-tap', 'min', 0.1], ['tOff', 'Tiempo sin arco', 'min', 0.1], ['O2L', 'Oxígeno de lanza', 'Nm³/t', 0.1], ['gas', 'Gas natural', 'Nm³/t', 0.1], ['Cu', 'Cobre final', '%', 0.001], ['Sn', 'Estaño final', '%', 0.0001]];
function nextHeatId() {
  const nums = S.heats.map(h => parseInt(String(h.id).replace(/\D/g, '').slice(-4), 10)).filter(n => isFinite(n));
  return 'C26-' + String((nums.length ? Math.max(...nums) : 4000) + 1);
}
function renderHeatForm(fromPlan) {
  const now = new Date();
  const d = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const t = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const hr = now.getHours(); const sh = hr >= 6 && hr < 14 ? 'A' : hr >= 14 && hr < 22 ? 'B' : 'C';
  $('#f-heat-id').innerHTML = `
    <label class="field" for="h_id"><span>Número de colada</span><span class="fi"><input id="h_id" type="text" value="${nextHeatId()}"></span></label>
    <label class="field" for="h_date"><span>Fecha</span><span class="fi"><input id="h_date" type="date" value="${d}"></span></label>
    <label class="field" for="h_time"><span>Hora de vaciado</span><span class="fi"><input id="h_time" type="time" value="${t}"></span></label>
    <label class="field" for="h_shift"><span>Turno</span><span class="fi sel"><select id="h_shift">${['A', 'B', 'C'].map(s => `<option ${s === sh ? 'selected' : ''}>${s}</option>`).join('')}</select></span></label>
    <label class="field" for="h_op"><span>Operador</span><span class="fi"><input id="h_op" type="text" placeholder="Nombre"></span></label>
    <label class="field" for="h_grade"><span>Grado</span><span class="fi sel"><select id="h_grade">${Object.entries(GRADES).map(([k, g]) => `<option value="${k}" ${k === S.p.grade ? 'selected' : ''}>${g.name}</option>`).join('')}</select></span></label>`;
  const ok = R && R.status === 'optimal';
  $('#f-heat-charge').innerHTML = S.mats.filter(m => m.use).map(m => {
    const i = S.mats.indexOf(m); const v = fromPlan && ok ? Math.round(R.ev.x[i] * 10) / 10 : '';
    return fieldHTML('hc_' + m.id, `<span class="sw" style="background:${matColor(m)}"></span>${esc(m.name)}`, 't', 0.1, v);
  }).join('');
  const defaults = { GA: S.p.GA, T: S.p.T, t2t: ok ? Math.round(R.ev.t2t * 10) / 10 : '', tOff: S.p.tOff, O2L: S.p.O2L, gas: S.p.gas, MWh: '', Cu: '', Sn: '' };
  $('#f-heat-meas').innerHTML = HEAT_MEAS.map(([k, l, u, st]) => fieldHTML('hm_' + k, l, u, st, defaults[k] ?? '')).join('');
  $('#h_notes').value = '';
  $('#heatFormMsg').innerHTML = fromPlan ? '<div class="callout info"><div>Carga precargada con la receta optimizada. Ajusta los valores reales antes de guardar.</div></div>' : '';
  S.planSnap = fromPlan && ok ? { x: R.ev.x.slice(), W: R.ev.W, pred: PRED ? PRED.mu : R.ev.W, cost: R.ev.costTotal } : null;
}
function saveHeat(ev) {
  ev.preventDefault();
  const g = id => $('#' + id).value.trim();
  const num = id => parseFloat($('#' + id).value);
  const errs = [];
  const id = g('h_id');
  if (!id) errs.push('el número de colada');
  if (S.heats.some(h => h.id === id)) errs.push('un número de colada que no exista en el registro');
  const charge = {}; S.mats.filter(m => m.use).forEach(m => { const v = num('hc_' + m.id); if (isFinite(v) && v > 0) charge[m.id] = v; });
  if (!Object.keys(charge).length) errs.push('la carga real de al menos un material');
  const h = { id, date: g('h_date'), time: g('h_time'), shift: g('h_shift'), operator: g('h_op'), grade: g('h_grade'), charge, notes: $('#h_notes').value.trim(), O2N: 0 };
  HEAT_MEAS.forEach(([k]) => h[k] = num('hm_' + k));
  ['GA', 'MWh', 't2t'].forEach(k => { if (!(h[k] > 0)) errs.push({ GA: 'el acero vaciado', MWh: 'la energía eléctrica medida', t2t: 'el tap-to-tap' }[k]); });
  if (!h.date || !h.time) errs.push('la fecha y la hora');
  if (errs.length) { $('#heatFormMsg').innerHTML = `<div class="callout bad"><div>Falta ${errs.join(', ')}.</div></div>`; return; }
  ['T', 'tOff', 'O2L', 'gas', 'Cu', 'Sn'].forEach(k => { if (!isFinite(h[k])) h[k] = k === 'T' ? S.p.T : k === 'tOff' ? S.p.tOff : k === 'O2L' ? S.p.O2L : k === 'gas' ? S.p.gas : 0; });
  h.tOn = Math.round((h.t2t - h.tOff) * 10) / 10;
  if (S.planSnap) h.plan = S.planSnap;
  S.heats.push(h); S.selHeat = h.id; S.planSnap = null;
  recalc();
  renderHeatForm(false);
  toast('Colada ' + h.id + ' guardada');
}
function heatsCSV() {
  const ids = S.mats.map(m => m.id);
  const head = ['colada', 'fecha', 'hora', 'turno', 'operador', 'grado', 'acero_t', 'energia_MWh', 'kWh_t', 'T_vaciado_C', 'tap_to_tap_min', 'tiempo_sin_arco_min', 'O2_lanza_Nm3_t', 'gas_Nm3_t', 'Cu_pct', 'Sn_pct', ...ids.map(i => 'carga_' + i + '_t'), 'observaciones'];
  const q = v => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = sortedHeats().reverse().map(h => [h.id, h.date, h.time, h.shift, h.operator, h.grade, h.GA, h.MWh, (h.MWh * 1000 / h.GA).toFixed(1), h.T, h.t2t, h.tOff, h.O2L, h.gas, h.Cu, h.Sn, ...ids.map(i => h.charge[i] || 0), h.notes].map(q).join(','));
  return head.join(',') + '\n' + lines.join('\n') + '\n';
}
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',' || c === ';') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}
function importCSV(text) {
  const rows = parseCSV(text); if (rows.length < 2) { toast('El archivo no tiene filas de datos'); return; }
  const H = rows[0].map(h => h.trim().toLowerCase());
  const col = n => H.indexOf(n);
  let added = 0, skipped = 0;
  rows.slice(1).forEach(r => {
    const v = n => { const k = col(n); return k >= 0 ? r[k] : ''; };
    const id = v('colada'); if (!id || S.heats.some(h => h.id === id)) { skipped++; return; }
    const charge = {}; H.forEach((h, k) => { const m = h.match(/^carga_(.+)_t$/); if (m && parseFloat(r[k]) > 0) charge[m[1]] = parseFloat(r[k]); });
    const h = { id, date: v('fecha'), time: v('hora'), shift: v('turno'), operator: v('operador'), grade: v('grado') || S.p.grade, GA: +v('acero_t'), MWh: +v('energia_mwh'), T: +v('t_vaciado_c') || S.p.T, t2t: +v('tap_to_tap_min'), tOff: +v('tiempo_sin_arco_min') || S.p.tOff, O2L: +v('o2_lanza_nm3_t') || S.p.O2L, gas: +v('gas_nm3_t') || 0, O2N: 0, Cu: +v('cu_pct') || 0, Sn: +v('sn_pct') || 0, charge, notes: v('observaciones') };
    if (h.GA > 0 && h.MWh > 0 && h.t2t > 0 && Object.keys(charge).length) { S.heats.push(h); added++; } else skipped++;
  });
  recalc(); toast(`${added} coladas importadas${skipped ? ', ' + skipped + ' omitidas' : ''}`);
}

// ---------------- Vista: calibración ----------------
const LIT = { kohle: 'MAE 15–40 kWh/t en cinco hornos industriales', bias: 'Ajuste del término propio del horno', lin: 'Regresión lineal: MAE 6–15 kWh/t', ridge: 'Regresión lineal: MAE 6–15 kWh/t', gp: 'Proceso gaussiano: MAE 5–10 kWh/t' };
function spcData() {
  const mid = activeModelId(); const m = CAL.models.find(x => x.id === mid);
  const idx = CAL.valid.map((h, k) => k).sort((a, b) => (CAL.valid[a].date + CAL.valid[a].time).localeCompare(CAL.valid[b].date + CAL.valid[b].time));
  const res = idx.map(k => CAL.y[k] - m.loo[k]);
  const mr = res.slice(1).map((v, i) => Math.abs(v - res[i]));
  const sig = (mr.reduce((s, v) => s + v, 0) / (mr.length || 1)) / 1.128;
  const c = res.reduce((s, v) => s + v, 0) / res.length;
  return { idx, res, c, ucl: c + 3 * sig, lcl: c - 3 * sig, sig, m };
}
function renderCalibration() {
  const msg = $('#calMsg');
  if (!CAL || !CAL.ready) {
    msg.innerHTML = `<div class="callout info"><div>Se necesitan al menos 6 coladas con energía medida para calibrar. Hay ${CAL ? CAL.n : 0} en el registro. Mientras tanto se usa la fórmula de Köhle sin corrección.</div></div>`;
    ['#modelTable', '#predBox', '#chParity', '#chSPC', '#spcList', '#modelNote', '#keySPC'].forEach(s => $(s).innerHTML = ''); return;
  }
  msg.innerHTML = CAL.valid.some(h => h.demo) ? `<div class="callout info"><div>La calibración usa ${CAL.n} coladas; incluye coladas de ejemplo. Al importar el histórico del horno, los coeficientes se ajustan solos.</div></div>` : '';
  const mid = activeModelId();
  $('#modelTable').innerHTML = `<thead><tr><th class="first">Modelo</th><th class="n">MAE kWh/t</th><th class="n">RMSE kWh/t</th><th class="n">R²</th><th>Referencia en la literatura</th><th class="last">Activo</th></tr></thead><tbody>${CAL.models.map(m => `
    <tr class="click ${m.id === mid ? 'sel' : ''}" data-model="${m.id}"><td class="first"><b>${m.name}</b>${m.id === CAL.bestId ? ' <span class="pill ok">Mejor</span>' : ''}</td><td class="n">${f(m.metrics.mae, 1)}</td><td class="n">${f(m.metrics.rmse, 1)}</td><td class="n">${f(m.metrics.r2, 3)}</td><td class="muted">${LIT[m.id]}</td><td class="last"><input type="radio" name="mdl" value="${m.id}" ${m.id === mid ? 'checked' : ''} aria-label="Usar ${m.name}"></td></tr>`).join('')}
    <tr class="click ${S.model === 'auto' ? 'sel' : ''}" data-model="auto"><td class="first" colspan="5">Elegir automáticamente el de menor error</td><td class="last"><input type="radio" name="mdl" value="auto" ${S.model === 'auto' ? 'checked' : ''} aria-label="Elegir automáticamente"></td></tr></tbody>`;
  const k = CAL.models[0], best = CAL.models.find(m => m.id === CAL.bestId);
  $('#modelNote').innerHTML = `Cada colada se predice con un modelo entrenado sin ella, así que el error es el que se espera en coladas nuevas. Con ${CAL.n} coladas, el mejor modelo reduce el error medio de ${f(k.metrics.mae, 1)} a ${f(best.metrics.mae, 1)} kWh/t (${f((1 - best.metrics.mae / k.metrics.mae) * 100, 0)} % menos). Referencias: Reimann et al. (2021) con más de 21 000 coladas de cinco hornos.`;
  // predicción
  if (PRED && R && R.status === 'optimal') {
    const z = CAL.st;
    const plan = heatInputs({ charge: Object.fromEntries(S.mats.map((m, i) => [m.id, R.ev.x[i]])), GA: R.ev.G, T: S.p.T, O2L: S.p.O2L, O2N: S.p.O2N, gas: S.p.gas, tOff: S.p.tOff, t2t: R.ev.t2t, MWh: 0 }, S.mats, S.p);
    const out = plan.feats.map((v, j) => { const col = CAL.rows.map(r => r.feats[j]); const lo = Math.min(...col), hi = Math.max(...col); const tol = (hi - lo) * 0.05; const d = j === 2 ? 3 : j === 3 ? 0 : 1; const fx = x => j === 3 ? String(Math.round(x)) : f(x, d); return v < lo - tol || v > hi + tol ? FEAT_NAMES[j] + ` (${fx(v)}; datos entre ${fx(lo)} y ${fx(hi)})` : null; }).filter(Boolean);
    void z;
    $('#predBox').innerHTML = `<div class="bigread"><strong>${f(PRED.mu, 0)}</strong><span>kWh/t predichos para la receta óptima</span></div>
      <div class="dl" style="margin-top:12px">
        <div class="k">Intervalo de 95 %</div><div class="v">${f(PRED.lo, 0)} – ${f(PRED.hi, 0)}<small>kWh/t</small></div>
        <div class="k">Energía por colada</div><div class="v">${f(PRED.mu * R.ev.G / 1000, 1)}<small>MWh</small></div>
        <div class="k">Fórmula de Köhle sin calibrar</div><div class="v">${f(PRED.K, 0)}<small>kWh/t</small></div>
        <div class="k">Modelo usado</div><div class="v">${PRED.model.name}</div>
        <div class="k">Corrección lineal (a + b·Köhle)</div><div class="v">a = ${f(CAL.a, 1)} · b = ${f(CAL.b, 3)}</div>
        <div class="k">El optimizador usa la corrección</div><div class="v">${S.p.useCal ? '<span class="pill ok">Sí</span>' : '<span class="pill mute">No</span>'}</div>
      </div>
      ${out.length ? `<div class="callout warn" style="margin-top:12px"><div><b>Extrapolación.</b> La receta queda fuera del rango de las coladas usadas para calibrar en: ${out.join('; ')}. La predicción es menos confiable.</div></div>` : ''}`;
  } else $('#predBox').innerHTML = infeasibleHTML();
  // paridad
  const spc = spcData();
  const flagged = new Set(spc.idx.filter((k, i) => spc.res[i] > spc.ucl || spc.res[i] < spc.lcl));
  const m = spc.m;
  Charts.scatter($('#chParity'), {
    height: 300, band: 15, xLabel: 'Predicho (kWh/t)', yLabel: 'Medido (kWh/t)',
    points: CAL.valid.map((h, k) => ({ x: m.loo[k], y: CAL.y[k], color: flagged.has(k) ? 'var(--crimson)' : 'var(--blue)', tip: `<div class="ctip-h">${esc(h.id)}</div>Medido ${f(CAL.y[k], 0)} · predicho ${f(m.loo[k], 0)} kWh/t`, h })),
    onClick: p => { S.selHeat = p.h.id; go('registro'); }
  });
  $('#keySPC').innerHTML = `<span><i style="background:var(--blue)"></i>Error por colada</span><span style="color:var(--ink-3)"><i class="dash" style="background:var(--ink-3)"></i>Media</span><span style="color:var(--crimson)"><i class="dash" style="background:var(--crimson)"></i>Límites de control ±3σ</span>`;
  Charts.line($('#chSPC'), {
    height: 260,
    series: [{ name: 'Medido − predicho', color: 'var(--blue)', dots: true, width: 1.4, points: spc.res.map((v, i) => [i + 1, v, flagged.has(spc.idx[i]) ? { color: 'var(--crimson)', r: 4.5 } : null]), fmt: v => f(v, 1) + ' kWh/t' }],
    hlines: [{ y: spc.c, color: 'var(--ink-3)', dash: '4 4' }, { y: spc.ucl, color: 'var(--crimson)', label: 'LSC ' + f(spc.ucl, 0) }, { y: spc.lcl, color: 'var(--crimson)', label: 'LIC ' + f(spc.lcl, 0) }],
    x: { label: 'Secuencia de coladas', min: 1, max: spc.res.length, tipLabel: v => CAL.valid[spc.idx[Math.round(v) - 1]].id }, y: { label: 'Error (kWh/t)' }
  });
  const fl = spc.idx.filter((k, i) => flagged.has(k));
  $('#spcList').innerHTML = fl.length ? `<p class="note" style="margin:10px 0 6px">Coladas fuera de control, para revisar:</p>${fl.map(k => { const h = CAL.valid[k]; const i = spc.idx.indexOf(k); return `<div class="callout warn" style="margin-bottom:6px;cursor:pointer" data-heat-open="${esc(h.id)}"><div><b>${esc(h.id)}</b> · ${esc(h.date)} ${esc(h.time)} · error ${spc.res[i] > 0 ? '+' : ''}${f(spc.res[i], 0)} kWh/t${h.notes ? ' · ' + esc(h.notes) : ''}</div></div>`; }).join('')}` : '<p class="note" style="margin-top:10px">Ninguna colada fuera de los límites de control.</p>';
}

// ---------------- Vista: reporte ----------------
function renderReportView() {
  const sel = $('#repSel');
  const hs = sortedHeats();
  if (S.repSel !== 'plan' && !S.heats.some(h => h.id === S.repSel)) S.repSel = 'plan';
  sel.innerHTML = `<option value="plan">Plan de carga actual</option>` + hs.map(h => `<option value="${esc(h.id)}" ${S.repSel === h.id ? 'selected' : ''}>Colada ${esc(h.id)} · ${esc(h.date)} ${esc(h.time)}</option>`).join('');
  sel.value = S.repSel;
  $('#sheet').innerHTML = Report.build(reportCtx(), S.repSel);
}
function reportCtx() { return { S, R, CAL, PRED, MV, f, esc, matColor, heatPred, heatStatus, activeModelId, ELEMENTS, GRADES, TYPE_LABEL }; }
async function saveFile(filename, data, mime) {
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      const dl = await window.claude.use('downloads');
      if (dl) { await dl.save({ filename, data }); toast('Archivo listo: ' + filename); return; }
    }
  } catch (e) {
    if (e && e.code === 'declined') { toast('Descarga cancelada'); return; }
    if (e && e.code === 'rate_limited') { toast('Hay una descarga pendiente; inténtalo de nuevo en unos segundos'); return; }
  }
  try {
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000); toast('Archivo listo: ' + filename);
  } catch (e) { toast('No fue posible descargar el archivo en esta vista'); }
}

// ---------------- Vista: método ----------------
function renderMethod() {
  const bench = [];
  const scrapP = Object.assign(clone(S.p), { lim: { Cu: 0, Sn: 0, Ni: 0, Cr: 0, Mo: 0 }, gas: 7.5, O2L: 31, useCal: false });
  const r0 = optimize(S.mats, scrapP, null, { driShareFix: 0 });
  const driP = Object.assign(clone(S.p), { lim: { Cu: 0, Sn: 0, Ni: 0, Cr: 0, Mo: 0 }, gas: 1, O2L: 27.5, driMax: 100, useCal: false });
  const r1 = optimize(S.mats, driP, null, { driShareFix: 87.5 });
  const pill = (v, lo, hi) => { if (v == null) return '<span class="pill mute">Sin dato</span>'; if (v >= lo && v <= hi) return '<span class="pill ok">Dentro del rango</span>'; const d = v < lo ? (lo - v) / lo * 100 : (v - hi) / hi * 100; if (d < 3) return '<span class="pill ok">En el borde del rango</span>'; return `<span class="pill warn">${f(d, 0)} % ${v < lo ? 'bajo' : 'sobre'} el rango</span>`; };
  bench.push(['Energía con 100 % chatarra (gas 7.5, O₂ 31 Nm³/t)', r0.ev ? f(r0.ev.W, 0) + ' kWh/t' : '—', '340–390 kWh/t', 'Kirschen et al., 2021', pill(r0.ev && r0.ev.W, 340, 390)]);
  bench.push(['Energía con 87.5 % DRI (gas 1, O₂ 27.5 Nm³/t)', r1.ev ? f(r1.ev.W, 0) + ' kWh/t' : '—', '530–680 kWh/t', 'Kirschen et al., 2021', pill(r1.ev && r1.ev.W, 530, 680)]);
  if (R && R.ev) bench.push(['CO₂ de la receta óptima, con materias primas', f(R.ev.co2Total / 1000, 2) + ' t/t', '0.25–1.1 t/t', 'Kirschen et al., 2021', pill(R.ev.co2Total / 1000, 0.25, 1.1)]);
  if (R && R.ev) bench.push(['Escoria de la receta óptima', f(R.ev.slagKg, 0) + ' kg/t', 'hasta 140 kg/t con DRI', 'Kirschen et al., 2021', pill(R.ev.slagKg, 60, 140)]);
  if (CAL && CAL.ready) {
    const k = CAL.models[0].metrics.mae, b = CAL.models.find(m => m.id === CAL.bestId).metrics.mae;
    bench.push(['Error de Köhle sin calibrar (coladas del registro)', f(k, 1) + ' kWh/t', '14.8–40.0 kWh/t', 'Reimann et al., 2021', pill(k, 14.8, 40)]);
    bench.push(['Error del mejor modelo calibrado', f(b, 1) + ' kWh/t', '5.3–14.9 kWh/t', 'Reimann et al., 2021', pill(b, 5.3, 14.9)]);
  }
  const ref = (t, u) => `<li>${t}${u ? ` <a href="${u}" target="_blank" rel="noopener">Ver fuente</a>` : ''}</li>`;
  $('#methodWrap').innerHTML = `
  <div class="panel"><div class="ph"><h2>Qué resuelve</h2></div><div class="pb prose">
    <p>El programa decide qué mezcla de chatarras, DRI, HBI y arrabio cargar en el horno de arco para producir el acero pedido al menor costo total. El costo total incluye los metálicos, la energía eléctrica que cada mezcla exige, el electrodo, la cal que pide la ganga del DRI, el oxígeno, el gas y, si se activa, el precio del carbono.</p>
    <p>La decisión está limitada por la química del grado (cobre, estaño, níquel, cromo y molibdeno no se pueden refinar en el horno y solo se controlan por dilución), por la disponibilidad de cada material, por el volumen de las cestas, por el rango de DRI que acepta la práctica y, si se fija, por la productividad mínima.</p>
    <p>Cada colada real que se registra mejora el modelo de energía del horno. Con el histórico de la planta el programa queda calibrado para ese horno en particular.</p></div></div>
  <div class="panel"><div class="ph"><h2>Modelo de energía eléctrica</h2></div><div class="pb prose">
    <p>Se usa la fórmula estadística de Köhle en su versión actualizada (Kleimt, Köhle, Kühn y Zisser, 2005), construida con datos de decenas de hornos y extendida a DRI, HBI y postcombustión:</p>
    <p style="font-size:13px;background:var(--panel-2);padding:10px 12px;border-radius:5px;line-height:1.9">W<sub>R</sub> = 375 + 400 (G<sub>E</sub>/G<sub>A</sub> − 1) + 80 G<sub>DRI</sub>/G<sub>A</sub> − 50 G<sub>Shr</sub>/G<sub>A</sub> − 350 G<sub>HM</sub>/G<sub>A</sub> + 1000 G<sub>Z</sub>/G<sub>A</sub> + 0.3 (T<sub>A</sub> − 1600) + t<sub>T2T</sub> − 8 M<sub>G</sub> − 4.3 M<sub>L</sub> − 2.8 M<sub>N</sub></p>
    <p>W<sub>R</sub> en kWh/t; G masas en t (carga, vaciado, DRI, fragmentada, arrabio líquido, escorificantes); T<sub>A</sub> en °C; t<sub>T2T</sub> en min; M<sub>G</sub>, M<sub>L</sub>, M<sub>N</sub> en Nm³/t de gas, oxígeno de lanza y de postcombustión. El tiempo con arco depende de la propia energía (t = W·G<sub>A</sub>/(P·u)), así que la ecuación se resuelve en forma cerrada y sigue siendo lineal en las masas cargadas. Eso permite optimizar con programación lineal y obtener el óptimo global.</p></div></div>
  <div class="panel"><div class="ph"><h2>Balance de masa, residuales y escoria</h2></div><div class="pb prose">
    <p><b>Acero:</b> Σ m<sub>i</sub>·η<sub>i</sub> = G<sub>A</sub>, con η el rendimiento metálico. Para DRI y HBI, η se calcula con el Fe metálico, el FeO residual y el carbono disponible para reducirlo.</p>
    <p><b>Residuales:</b> [X]<sub>acero</sub> = Σ m<sub>i</sub>·X<sub>i</sub>·r<sub>X</sub> / G<sub>A</sub> ≤ X<sub>máx</sub>. El factor de recuperación r es 1 para Cu, Sn, Ni y Mo, y menor para Cr porque una parte se oxida a la escoria.</p>
    <p><b>Escorificantes:</b> G<sub>Z</sub> = Z<sub>0</sub>·G<sub>A</sub> + Σ m<sub>i</sub>·(B·SiO₂<sub>i</sub> − CaO<sub>i</sub>)/CaO<sub>cal</sub>, donde B es la basicidad objetivo y el Si del arrabio se cuenta como SiO₂.</p>
    <p><b>Emisiones:</b> electricidad por el factor de la red, 1.96 kg CO₂/Nm³ de gas, 3.67 kg CO₂/kg de carbono oxidado y el CO₂ incorporado declarado para cada material.</p></div></div>
  <div class="panel"><div class="ph"><h2>Optimización y calibración</h2></div><div class="pb prose">
    <p><b>Optimizador:</b> método símplex de dos fases con regla de Bland, resuelto en el navegador en milisegundos. Después de cada solución se recalcula el problema con cada restricción activa ligeramente relajada para obtener su valor marginal en USD/t.</p>
    <p><b>Calibración:</b> con las coladas registradas se ajustan cuatro modelos sobre la fórmula de Köhle: sesgo propio del horno, corrección lineal, regresión ridge con ocho variables de proceso y un modelo híbrido en el que un proceso gaussiano aprende el error de Köhle. Los hiperparámetros se eligen minimizando el error al predecir cada colada con un modelo entrenado sin ella. El proceso gaussiano entrega además una banda de incertidumbre para cada predicción, que crece cuando la receta sale del rango de los datos.</p>
    <p><b>Control:</b> la carta de control usa el error de predicción por colada, con límites a ±3σ estimados con el rango móvil. Señala coladas cuya energía no se explica por la carga ni por la práctica.</p></div></div>
  <div class="panel" style="grid-column:1/-1"><div class="ph"><h2>Validación frente a la literatura</h2></div><div class="pb flush"><div class="tw"><table class="t"><thead><tr><th class="first">Caso</th><th class="n">Este programa</th><th class="n">Literatura</th><th>Fuente</th><th class="last">Resultado</th></tr></thead><tbody>${bench.map(b => `<tr><td class="first">${b[0]}</td><td class="n"><b>${b[1]}</b></td><td class="n">${b[2]}</td><td class="muted">${b[3]}</td><td class="last">${b[4]}</td></tr>`).join('')}</tbody></table></div></div><div class="pb"><p class="note">Los casos de energía usan la fórmula de Köhle sin calibrar y se recalculan con los parámetros vigentes del horno. Con práctica de alta energía química (oxígeno y quemadores) la fórmula general tiende a quedar por debajo del consumo de los hornos de chatarra, porque omite las pérdidas propias de cada horno. Reimann et al. (2021) corrigen esa diferencia con un sesgo ajustado por horno; es lo que hace la calibración de este programa con el registro de coladas.</p></div></div>
  <div class="panel"><div class="ph"><h2>Herramientas comerciales comparables</h2></div><div class="pb prose">
    <p><b>Danieli Q-CHARGE:</b> calculador de carga de mínimo costo para el horno, con optimización de residuales y cálculos de escenarios.</p>
    <p><b>Primetals EAF Best Practice Analysis y Melt Expert:</b> análisis con coladas de referencia, predicción de costos de conversión y optimización de la mezcla de chatarra.</p>
    <p><b>TMS Scrap OptiMiser y GenBlend+:</b> optimización mensual de compras de chatarra y de la química de fusión.</p>
    <p><b>PSI qontrol maps:</b> evaluación de calidad de chatarra y optimización de la mezcla de carga.</p>
    <p>Este programa reúne en una sola herramienta la carga de mínimo costo con energía y CO₂ dentro del objetivo, el valor marginal de cada restricción, el mapa de decisión de DRI frente a precios, la calibración con incertidumbre a partir del histórico del horno y el registro de coladas con reporte.</p></div></div>
  <div class="panel"><div class="ph"><h2>Referencias</h2></div><div class="pb prose"><ol style="padding-left:18px;margin:0;display:grid;gap:8px">
    ${ref('Kleimt, B., Köhle, S., Kühn, R., Zisser, S. (2005). Application of models for electrical energy consumption to improve EAF operation and dynamic control. 8th European Electric Steelmaking Conference, Birmingham.', 'https://www.researchgate.net/publication/239615624')}
    ${ref('Reimann, A., Hay, T., Echterhof, T., Kirschen, M., Pfeifer, H. (2021). Application and evaluation of mathematical models for prediction of the electric energy demand using plant data of five industrial-size EAFs. Metals, 11(9), 1348.', 'https://www.mdpi.com/2075-4701/11/9/1348')}
    ${ref('Kirschen, M., Hay, T., Echterhof, T. (2021). Process improvements for direct reduced iron melting in the electric arc furnace with emphasis on slag operation. Processes, 9(2), 402.', 'https://doi.org/10.3390/pr9020402')}
    ${ref('Kirschen, M., Badr, K., Pfeifer, H. (2011). Influence of direct reduced iron on the energy balance of the electric arc furnace in steel industry. Energy, 36(10), 6146–6155.', 'https://doi.org/10.1016/j.energy.2011.07.050')}
    ${ref('Daehn, K. E., Cabrera Serrenho, A., Allwood, J. M. (2017). How will copper contamination constrain future global steel recycling? Environmental Science &amp; Technology, 51(11), 6599–6606.', 'https://doi.org/10.1021/acs.est.7b00997')}
    ${ref('Danieli Automation. Q-CHARGE, least-cost calculator for EAF charge.', 'https://www.dca.it/en/products/technological-packages/steelmaking/q-charge_32_21.htm')}
    ${ref('Primetals Technologies. EAF Best Practice Analysis.', 'https://www.primetals.com/en/portfolio/services/steelmaking/electric-steelmaking/eaf-best-practice-analysis/')}
  </ol><p class="note" style="margin-top:12px">Los límites de residuales de cada grado y los análisis de materiales son valores típicos de la literatura y se sustituyen por las especificaciones internas de la planta.</p></div></div>
  <div class="panel" style="grid-column:1/-1"><div class="pb" style="padding-top:16px;display:flex;gap:18px;flex-wrap:wrap;align-items:center;justify-content:space-between"><div class="prose" style="max-width:none"><b>Balance de carga del horno de arco</b> · versión 1.0 · Desarrollado por <b>Ing. J. Gabriel Franco</b></div><button class="btn sm" type="button" id="btnResetAll">Restablecer todo el programa</button></div></div>`;
}

// ---------------- Navegación y render ----------------
function renderAll() {
  renderChrome();
  if (S.view === 'balance') { syncFields(); renderBalance(); }
  if (S.view === 'materiales') renderMaterials();
  if (S.view === 'resultado') renderResult();
  if (S.view === 'escenarios') renderScenarios();
  if (S.view === 'registro') renderRegistry();
  if (S.view === 'calibracion') renderCalibration();
  if (S.view === 'reporte') renderReportView();
  if (S.view === 'metodo') renderMethod();
}
function go(v) {
  S.view = v; Charts.hideTip();
  try { history.replaceState(null, '', '#' + v); } catch (e) { }
  renderAll(); window.scrollTo(0, 0);
}

// ---------------- Eventos ----------------
document.addEventListener('click', e => {
  const nav = e.target.closest('[data-view]'); if (nav) { go(nav.dataset.view); return; }
  const g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
  const gr = e.target.closest('[data-grade]'); if (gr) { const gd = GRADES[gr.dataset.grade]; S.p.grade = gr.dataset.grade; ELEMENTS.forEach(el => S.p.lim[el] = gd[el]); S.p.T = gd.T; renderFields(); recalc({ cal: false }); return; }
  const sm = e.target.closest('[data-mode]'); if (sm) { SK_MODE = sm.dataset.mode; renderBalance(); return; }
  const id = e.target.closest('button') && e.target.closest('button').id;
  const tr = e.target.closest('tr[data-heat]'); if (tr) { S.selHeat = tr.dataset.heat; renderRegistry(); return; }
  const ho = e.target.closest('[data-heat-open]'); if (ho) { S.selHeat = ho.dataset.heatOpen; go('registro'); return; }
  const md = e.target.closest('tr[data-model]'); if (md) { S.model = md.dataset.model; recalc({ cal: false }); return; }
  const del = e.target.closest('[data-del]'); if (del) { S.mats.splice(+del.dataset.del, 1); recalc(); return; }
  switch (id) {
    case 'btnOpt': recalc(); go('resultado'); toast(R.status === 'optimal' ? 'Carga optimizada: ' + f(R.ev.costTotal, 2) + ' USD/t' : 'No hay solución factible'); break;
    case 'btnToLog': go('registro'); renderHeatForm(true); break;
    case 'btnResetP': { const keep = { annual: S.p.annual }; S.p = Object.assign(defaultProcess(), keep); renderFields(); recalc(); toast('Parámetros restablecidos'); break; }
    case 'btnAddMat': S.mats.push({ id: 'm' + Date.now().toString(36), name: 'Material nuevo', type: 'scrap', use: false, price: 350, min: 0, max: 30, yield: 0.92, C: 0.1, SiO2: 1, Al2O3: 0.2, CaO: 0, MgO: 0, Si: 0, FeTot: 0, met: 0, Cu: 0.1, Sn: 0.01, Ni: 0.05, Cr: 0.05, Mo: 0.01, rho: 1, co2: 0.03, basket: true }); renderMaterials(); persist(); toast('Material agregado; actívalo en la columna Usar'); break;
    case 'btnResetMat': S.mats = defaultMaterials(); recalc(); toast('Materiales restablecidos'); break;
    case 'btnCmpReset': S.cmp = typicalRecipe(); renderCompare(); persist(); break;
    case 'btnCopy': {
      const lines = ['Receta · Balance de carga del horno de arco · ' + new Date().toLocaleString('es-MX'), ...S.mats.map((m, i) => [m.name, R.ev.x[i]]).filter(r => r[1] > 0.05).map(r => `${r[0]}: ${f(r[1], 1)} t`), `Acero: ${f(R.ev.G, 1)} t · ${f(R.ev.costTotal, 2)} USD/t · ${f(R.ev.W, 0)} kWh/t · Cu ${f(R.ev.resid.Cu, 3)} %`];
      const txt = lines.join('\n');
      try { navigator.clipboard.writeText(txt).then(() => toast('Receta copiada'), () => toast('No se pudo copiar en esta vista')); } catch (err) { toast('No se pudo copiar en esta vista'); }
      break;
    }
    case 'btnUsePlan': renderHeatForm(true); break;
    case 'btnClearForm': renderHeatForm(false); break;
    case 'btnHeatRep': S.repSel = S.selHeat; go('reporte'); break;
    case 'btnHeatDel': $('#delWrap').innerHTML = `<span class="inline-confirm">¿Eliminar? <button class="btn sm danger" type="button" id="btnHeatDelYes">Sí, eliminar</button><button class="btn sm ghost" type="button" id="btnHeatDelNo">No</button></span>`; break;
    case 'btnHeatDelYes': S.heats = S.heats.filter(h => h.id !== S.selHeat); S.selHeat = null; recalc(); toast('Colada eliminada'); break;
    case 'btnHeatDelNo': renderHeatDetail(); break;
    case 'btnClearDemo': $('#clearDemoWrap').innerHTML = `<span class="inline-confirm">¿Quitar ${S.heats.filter(h => h.demo).length} coladas de ejemplo? <button class="btn sm danger" type="button" id="btnClearDemoYes">Quitar</button><button class="btn sm ghost" type="button" id="btnClearDemoNo">No</button></span>`; break;
    case 'btnClearDemoYes': S.heats = S.heats.filter(h => !h.demo); S.selHeat = null; recalc(); toast('Coladas de ejemplo eliminadas'); break;
    case 'btnClearDemoNo': renderRegistry(); break;
    case 'btnExportCSV': saveFile('registro_coladas_' + new Date().toISOString().slice(0, 10) + '.csv', heatsCSV(), 'text/csv'); break;
    case 'btnRepCSV': saveFile('registro_coladas_' + new Date().toISOString().slice(0, 10) + '.csv', heatsCSV(), 'text/csv'); break;
    case 'btnRepDl': { const name = S.repSel === 'plan' ? 'plan_de_carga_' + new Date().toISOString().slice(0, 10) : 'reporte_colada_' + S.repSel; saveFile(name + '.html', Report.document(reportCtx(), S.repSel), 'text/html'); break; }
    case 'btnResetAll': $('#btnResetAll').outerHTML = `<span class="inline-confirm" id="resetConfirm">Se borran parámetros, materiales y coladas propias. <button class="btn sm danger" type="button" id="btnResetAllYes">Restablecer</button><button class="btn sm ghost" type="button" id="btnResetAllNo">Cancelar</button></span>`; break;
    case 'btnResetAllYes': S.mats = defaultMaterials(); S.p = defaultProcess(); S.heats = demoHeats(defaultMaterials(), defaultProcess()); S.cmp = typicalRecipe(); S.model = 'auto'; S.selHeat = null; renderFields(); recalc(); toast('Programa restablecido'); break;
    case 'btnResetAllNo': renderMethod(); break;
  }
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('tr[data-heat]')) { e.preventDefault(); S.selHeat = e.target.dataset.heat; renderRegistry(); } });
$('#console').addEventListener('input', e => { if (e.target.type !== 'checkbox') onFieldInput(e); });
$('#console').addEventListener('change', e => { if (e.target.type === 'checkbox') onFieldInput(e); });
$('#matTable').addEventListener('input', e => { if (e.target.tagName !== 'SELECT' && e.target.type !== 'checkbox') onMatInput(e); });
$('#matTable').addEventListener('change', e => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') onMatInput(e); });
$('#cmpTable').addEventListener('input', e => { const k = e.target.dataset.cmp; if (!k) return; const v = parseFloat(e.target.value); S.cmp[k] = isFinite(v) ? v : 0; clearTimeout(inT); inT = setTimeout(() => { const foc = document.activeElement && document.activeElement.dataset.cmp; renderCompare(); if (foc) { const el = document.querySelector(`[data-cmp="${foc}"]`); if (el) { el.focus(); const L = el.value.length; try { el.setSelectionRange(L, L); } catch (er) { } } } persist(); }, 350); });
$('#heatForm').addEventListener('submit', saveHeat);
$('#csvIn').addEventListener('change', e => { const file = e.target.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => importCSV(String(rd.result)); rd.readAsText(file); e.target.value = ''; });
$('#mapY').addEventListener('change', e => { S.mapY = e.target.value; SC_KEY = ''; renderScenarios(); persist(); });
$('#repSel').addEventListener('change', e => { S.repSel = e.target.value; renderReportView(); });
document.addEventListener('change', e => { if (e.target.name === 'mdl') { S.model = e.target.value; recalc({ cal: false }); } });
let rsT = null; let lastW = window.innerWidth;
window.addEventListener('resize', () => { if (window.innerWidth === lastW) return; lastW = window.innerWidth; clearTimeout(rsT); rsT = setTimeout(() => { if (['balance', 'materiales', 'resultado', 'escenarios', 'calibracion'].includes(S.view)) renderAll(); }, 200); });
window.addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (h && h !== S.view && document.getElementById('v-' + h)) go(h); });

$('#report-css').textContent = Report.css('.rp');
renderFields();
recalc();
})();
