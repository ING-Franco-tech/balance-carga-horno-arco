/* Motor de cálculo MeltPlan EAF
   - Balance de masa de la carga, residuales, escoria
   - Energía eléctrica: fórmula de Köhle (versión 2005, Kleimt et al.)
   - Optimización lineal (simplex de dos fases)
   - Calibración con coladas reales: sesgo, lineal, ridge, híbrido Köhle + proceso gaussiano */

const ELEMENTS = ['Cu', 'Sn', 'Ni', 'Cr', 'Mo'];
const TYPES = {
  scrap: 'Chatarra',
  shred: 'Fragmentada',
  dri: 'DRI / HBI',
  pig: 'Arrabio sólido'
};

function defaultMaterials() {
  return [
    { id: 'hms', name: 'Chatarra pesada HMS 1&2', type: 'scrap', use: true, price: 338, min: 0, max: 120, yield: 0.89, C: 0.15, SiO2: 1.6, Al2O3: 0.4, CaO: 0, MgO: 0, Si: 0, FeTot: 0, met: 0, Cu: 0.20, Sn: 0.020, Ni: 0.08, Cr: 0.10, Mo: 0.020, rho: 0.75, co2: 0.03, basket: true },
    { id: 'shr', name: 'Chatarra fragmentada', type: 'shred', use: true, price: 356, min: 0, max: 120, yield: 0.93, C: 0.10, SiO2: 1.0, Al2O3: 0.3, CaO: 0, MgO: 0, Si: 0, FeTot: 0, met: 0, Cu: 0.24, Sn: 0.022, Ni: 0.07, Cr: 0.09, Mo: 0.015, rho: 1.05, co2: 0.04, basket: true },
    { id: 'bus', name: 'Chatarra prime (bushelling)', type: 'scrap', use: true, price: 432, min: 0, max: 50, yield: 0.96, C: 0.06, SiO2: 0.3, Al2O3: 0.1, CaO: 0, MgO: 0, Si: 0, FeTot: 0, met: 0, Cu: 0.030, Sn: 0.004, Ni: 0.020, Cr: 0.030, Mo: 0.005, rho: 1.20, co2: 0.02, basket: true },
    { id: 'pkg', name: 'Paquetes de lámina', type: 'scrap', use: true, price: 398, min: 0, max: 60, yield: 0.94, C: 0.05, SiO2: 0.5, Al2O3: 0.2, CaO: 0, MgO: 0, Si: 0, FeTot: 0, met: 0, Cu: 0.060, Sn: 0.010, Ni: 0.030, Cr: 0.040, Mo: 0.008, rho: 1.40, co2: 0.02, basket: true },
    { id: 'ret', name: 'Retorno interno de planta', type: 'scrap', use: true, price: 305, min: 0, max: 18, yield: 0.95, C: 0.08, SiO2: 0.4, Al2O3: 0.1, CaO: 0, MgO: 0, Si: 0, FeTot: 0, met: 0, Cu: 0.045, Sn: 0.006, Ni: 0.030, Cr: 0.040, Mo: 0.008, rho: 1.10, co2: 0.0, basket: true },
    { id: 'dri', name: 'DRI (pellet, gas natural)', type: 'dri', use: true, price: 384, min: 0, max: 140, yield: 0, C: 2.2, SiO2: 2.4, Al2O3: 0.9, CaO: 0.8, MgO: 0.4, Si: 0, FeTot: 92.5, met: 94.0, Cu: 0.002, Sn: 0.001, Ni: 0.005, Cr: 0.005, Mo: 0.001, rho: 1.70, co2: 0.55, basket: false },
    { id: 'hbi', name: 'HBI importado', type: 'dri', use: true, price: 412, min: 0, max: 40, yield: 0, C: 1.2, SiO2: 2.8, Al2O3: 1.0, CaO: 0.6, MgO: 0.4, Si: 0, FeTot: 91.5, met: 93.0, Cu: 0.002, Sn: 0.001, Ni: 0.005, Cr: 0.005, Mo: 0.001, rho: 2.60, co2: 0.65, basket: true },
    { id: 'pig', name: 'Arrabio sólido', type: 'pig', use: true, price: 468, min: 0, max: 25, yield: 0.95, C: 4.3, SiO2: 0, Al2O3: 0, CaO: 0, MgO: 0, Si: 0.6, FeTot: 0, met: 0, Cu: 0.010, Sn: 0.002, Ni: 0.010, Cr: 0.020, Mo: 0.002, rho: 3.50, co2: 1.85, basket: true }
  ];
}

const GRADES = {
  ddq: { name: 'Estampado profundo DDQ / IF', Cu: 0.06, Sn: 0.010, Ni: 0.08, Cr: 0.08, Mo: 0.03, T: 1640 },
  auto: { name: 'Automotriz expuesta', Cu: 0.030, Sn: 0.008, Ni: 0.06, Cr: 0.06, Mo: 0.02, T: 1645 },
  cq: { name: 'Lámina comercial CQ', Cu: 0.12, Sn: 0.015, Ni: 0.12, Cr: 0.12, Mo: 0.04, T: 1630 },
  rebar: { name: 'Varilla corrugada', Cu: 0.40, Sn: 0.040, Ni: 0.25, Cr: 0.25, Mo: 0.08, T: 1620 }
};

function defaultProcess() {
  return {
    grade: 'ddq',
    GA: 150,          // peso de vaciado objetivo, t
    P: 90,            // potencia activa media, MW (600 kW/t, referencia de Kleimt et al.)
    util: 0.85,       // factor de utilización de potencia
    tOff: 15,         // tiempo sin arco, min
    basketV: 95,      // volumen de cesta, m3
    nBaskets: 2,
    driContinuous: true,
    T: 1640,          // temperatura de vaciado, °C
    O2L: 28,          // oxígeno de lanza, Nm3/t
    O2N: 0,           // oxígeno de postcombustión, Nm3/t
    gas: 4,           // gas natural de quemadores, Nm3/t
    carbonInj: 8,     // carbono inyectado, kg/t
    Z0: 30,           // escorificantes base, kg/t
    B: 2.0,           // basicidad CaO/SiO2
    limeCaO: 92,      // CaO en la cal, %
    lim: { Cu: 0.06, Sn: 0.010, Ni: 0.08, Cr: 0.08, Mo: 0.03 },
    rec: { Cu: 1, Sn: 1, Ni: 1, Cr: 0.4, Mo: 1 },
    driMin: 0, driMax: 85, // participación DRI/HBI en la carga, %
    prodMin: 0,       // productividad mínima, t/h (0 = sin restricción)
    pEl: 78,          // USD/MWh
    pElec: 6.2,       // USD/kg electrodo
    kElec: 3.4,       // kg electrodo / MWh
    pLime: 135,       // USD/t
    pO2: 0.11,        // USD/Nm3
    pGas: 0.24,       // USD/Nm3
    pC: 310,          // USD/t carbono
    pFixed: 38,       // otros costos de conversión, USD/t
    grid: 0.44,       // kg CO2 / kWh
    pCO2: 0,          // USD/t CO2
    scope3: false,    // incluir CO2 incorporado de materias primas en el costo de carbono
    annual: 2600000,  // t/año, para estimar ahorros
    useCal: true
  };
}

// ---------- Material properties ----------
function matYield(m) {
  if (m.type === 'dri') {
    const feMet = m.FeTot * m.met / 100;
    const feOx = m.FeTot - feMet;
    // Parte del FeO residual se reduce con el C del DRI; el resto pasa a la escoria
    const cReq = feOx * 12 / 55.85;
    const frac = Math.min(0.6, cReq > 0 ? (m.C * 0.45) / cReq : 0);
    return Math.max(0.5, (feMet + feOx * frac) / 100 * 0.985);
  }
  return m.yield;
}
function matSiO2(m) { return m.SiO2 + 2.139 * (m.Si || 0); }
// t de escorificante requerido por t de material (por basicidad)
function matLime(m, p) {
  return (p.B * matSiO2(m) - (m.CaO || 0)) / 100 / (p.limeCaO / 100);
}
function kohleTypeCoef(m) {
  if (m.type === 'dri') return 80;
  if (m.type === 'shred') return -50;
  return 0;
}

// ---------- Linear energy model ----------
// W_pre = A0 + Σ a_i x_i  (kWh/t sin el término de tiempo con arco)
// W = (W_pre) / (1 - c) con c = G·60/(1000·P·u) min por kWh/t
function energyModel(mats, p, G, cal) {
  const A0 = 375 - 400 + 0.3 * (p.T - 1600) + p.tOff - 8 * p.gas - 4.3 * p.O2L - 2.8 * p.O2N + p.Z0;
  const a = mats.map(m => (400 + kohleTypeCoef(m) + 1000 * matLime(m, p)) / G);
  const c = G * 60 / (1000 * p.P * p.util);
  const alpha = cal && p.useCal ? cal.a : 0;
  const beta = cal && p.useCal ? cal.b : 1;
  return { A0, a, c, alpha, beta };
}

// ---------- Evaluate a recipe ----------
function evaluate(x, mats, p, cal) {
  const G = mats.reduce((s, m, i) => s + x[i] * matYield(m), 0);
  const GE = x.reduce((s, v) => s + v, 0);
  if (G <= 0) return null;
  const em = energyModel(mats, p, G, cal);
  const terms = {};
  const sDRI = mats.reduce((s, m, i) => s + (m.type === 'dri' ? x[i] : 0), 0);
  const sShr = mats.reduce((s, m, i) => s + (m.type === 'shred' ? x[i] : 0), 0);
  const limeT = p.Z0 * G / 1000 + mats.reduce((s, m, i) => s + x[i] * matLime(m, p), 0);
  terms.base = 375;
  terms.charge = 400 * (GE / G - 1);
  terms.dri = 80 * sDRI / G;
  terms.shred = -50 * sShr / G;
  terms.slag = 1000 * limeT / G;
  terms.temp = 0.3 * (p.T - 1600);
  terms.gas = -8 * p.gas;
  terms.o2 = -4.3 * p.O2L - 2.8 * p.O2N;
  const Wpre = terms.base + terms.charge + terms.dri + terms.shred + terms.slag + terms.temp + terms.gas + terms.o2 + p.tOff;
  // con calibración lineal W = alpha + beta*K ; K = Wpre + tOn ; tOn = c*W
  const beta = em.beta, alpha = em.alpha, c = em.c;
  // W = alpha + beta*(Wpre + c W) -> W = (alpha + beta Wpre)/(1 - beta c)
  const W = (alpha + beta * Wpre) / (1 - beta * c);
  const tOn = c * W;
  terms.time = tOn + p.tOff;
  const Kraw = Wpre + tOn; // fórmula de Köhle sin calibrar con el tiempo resultante
  terms.cal = W - Kraw;
  const t2t = tOn + p.tOff;
  const prod = G * 60 / t2t;

  // residuales
  const resid = {};
  ELEMENTS.forEach(e => {
    resid[e] = mats.reduce((s, m, i) => s + x[i] * m[e] * p.rec[e], 0) / G;
  });
  // escoria
  const sio2 = mats.reduce((s, m, i) => s + x[i] * matSiO2(m) / 100, 0);
  const al2o3 = mats.reduce((s, m, i) => s + x[i] * (m.Al2O3 || 0) / 100, 0);
  const mgo = mats.reduce((s, m, i) => s + x[i] * (m.MgO || 0) / 100, 0) + limeT * 0.03;
  const cao = limeT * p.limeCaO / 100 + mats.reduce((s, m, i) => s + x[i] * (m.CaO || 0) / 100, 0);
  const slag = (cao + sio2 + al2o3 + mgo) / 0.70; // FeO ~30 % de la escoria
  // carbono
  const Ccharge = mats.reduce((s, m, i) => s + x[i] * m.C / 100, 0) * 1000 / G; // kg/t
  const Ctotal = Ccharge + p.carbonInj;
  const O2stoich = Ctotal * 0.95 * 0.933; // Nm3/t para C -> CO
  // costos USD/t acero líquido
  const cost = {};
  cost.mat = mats.reduce((s, m, i) => s + x[i] * m.price, 0) / G;
  cost.el = W * p.pEl / 1000;
  const electrode = p.kElec * W / 1000; // kg/t
  cost.electrode = electrode * p.pElec;
  cost.lime = limeT / G * p.pLime;
  cost.o2 = (p.O2L + p.O2N) * p.pO2;
  cost.gas = p.gas * p.pGas;
  cost.carbon = p.carbonInj / 1000 * p.pC;
  cost.fixed = p.pFixed;
  // CO2 kg/t
  const co2 = {};
  co2.el = W * p.grid;
  co2.gas = p.gas * 1.96;
  co2.carbon = Ctotal * 0.95 * 3.667;
  co2.lime = limeT / G * 1000 * 0.785 * (p.limeCaO / 100) * 0; // calcinación fuera del límite de planta
  co2.mat = mats.reduce((s, m, i) => s + x[i] * m.co2, 0) / G * 1000;
  const co2Direct = co2.el + co2.gas + co2.carbon;
  const co2Total = co2Direct + co2.mat;
  cost.co2 = p.pCO2 * (p.scope3 ? co2Total : co2Direct) / 1000;
  const costTotal = Object.values(cost).reduce((s, v) => s + v, 0);
  // volumen de cesta
  const vol = mats.reduce((s, m, i) => s + (!(m.type === 'dri' && !m.basket && p.driContinuous) ? x[i] / m.rho : 0), 0);
  return {
    x: x.slice(), G, GE, yieldAvg: G / GE, driShare: sDRI / GE * 100, shrShare: sShr / GE * 100,
    W, Kraw, tOn, t2t, prod, terms, resid, limeKg: limeT / G * 1000, slagKg: slag / G * 1000,
    Ccharge, Ctotal, O2stoich, electrode, cost, costTotal, co2, co2Direct, co2Total, vol
  };
}

// ---------- Simplex (dos fases, regla de Bland) ----------
function simplex(c, rows, n) {
  // rows: {a: [n], type: '<='|'>='|'=', b}
  const R = rows.map(r => r.b < 0 ? { a: r.a.map(v => -v), b: -r.b, type: r.type === '<=' ? '>=' : r.type === '>=' ? '<=' : '=' } : { a: r.a.slice(), b: r.b, type: r.type });
  const m = R.length;
  let nSlack = 0, nArt = 0;
  R.forEach(r => { if (r.type !== '=') nSlack++; if (r.type !== '<=') nArt++; });
  const N = n + nSlack + nArt;
  const T = [];
  const basis = [];
  let si = n, ai = n + nSlack;
  const artCols = [];
  R.forEach((r, k) => {
    const row = new Array(N + 1).fill(0);
    for (let j = 0; j < n; j++) row[j] = r.a[j];
    if (r.type === '<=') { row[si] = 1; basis.push(si); si++; }
    else if (r.type === '>=') { row[si] = -1; si++; row[ai] = 1; basis.push(ai); artCols.push(ai); ai++; }
    else { row[ai] = 1; basis.push(ai); artCols.push(ai); ai++; }
    row[N] = r.b;
    T.push(row);
  });
  const EPS = 1e-9;
  function pivot(pr, pc) {
    const pv = T[pr][pc];
    for (let j = 0; j <= N; j++) T[pr][j] /= pv;
    for (let i = 0; i < m; i++) {
      if (i === pr) continue;
      const f = T[i][pc];
      if (Math.abs(f) > 1e-14) for (let j = 0; j <= N; j++) T[i][j] -= f * T[pr][j];
    }
    basis[pr] = pc;
  }
  function run(cost, allowed) {
    for (let it = 0; it < 5000; it++) {
      // costos reducidos
      let enter = -1;
      for (let j = 0; j < N; j++) {
        if (!allowed(j) || basis.includes(j)) continue;
        let rc = cost[j];
        for (let i = 0; i < m; i++) rc -= cost[basis[i]] * T[i][j];
        if (rc < -EPS) { enter = j; break; }
      }
      if (enter < 0) return 'optimal';
      let leave = -1, best = Infinity;
      for (let i = 0; i < m; i++) {
        if (T[i][enter] > EPS) {
          const r = T[i][N] / T[i][enter];
          if (r < best - 1e-12 || (Math.abs(r - best) <= 1e-12 && basis[i] < basis[leave])) { best = r; leave = i; }
        }
      }
      if (leave < 0) return 'unbounded';
      pivot(leave, enter);
    }
    return 'iterlimit';
  }
  if (nArt > 0) {
    const c1 = new Array(N).fill(0);
    artCols.forEach(j => c1[j] = 1);
    run(c1, () => true);
    const infeas = basis.reduce((s, bj, i) => s + (artCols.includes(bj) ? T[i][N] : 0), 0);
    if (infeas > 1e-6) return { status: 'infeasible' };
    // sacar artificiales de la base
    for (let i = 0; i < m; i++) {
      if (artCols.includes(basis[i])) {
        for (let j = 0; j < n + nSlack; j++) {
          if (Math.abs(T[i][j]) > 1e-9) { pivot(i, j); break; }
        }
      }
    }
  }
  const c2 = new Array(N).fill(0);
  for (let j = 0; j < n; j++) c2[j] = c[j];
  const st = run(c2, j => j < n + nSlack);
  if (st !== 'optimal') return { status: st };
  const x = new Array(n).fill(0);
  basis.forEach((bj, i) => { if (bj < n) x[bj] = T[i][N]; });
  const obj = x.reduce((s, v, j) => s + v * c[j], 0);
  return { status: 'optimal', x, obj };
}

// ---------- Construcción y solución del problema de carga ----------
// opts: {driShareFix, priceMult:{id:mult}, pElMult, limOverride:{e:val}, prodMinOverride}
function optimize(matsAll, pIn, cal, opts = {}) {
  const p = Object.assign({}, pIn, { lim: Object.assign({}, pIn.lim, opts.limOverride || {}) });
  if (opts.pElMult) p.pEl = pIn.pEl * opts.pElMult;
  if (opts.pEl != null) p.pEl = opts.pEl;
  if (opts.prodMin != null) p.prodMin = opts.prodMin;
  if (opts.basketV != null) p.basketV = opts.basketV;
  const mats = matsAll.map(m => {
    const mm = Object.assign({}, m);
    if (opts.priceMult && opts.priceMult[m.id]) mm.price = m.price * opts.priceMult[m.id];
    if (opts.priceSet && opts.priceSet[m.id] != null) mm.price = opts.priceSet[m.id];
    return mm;
  }).filter(m => m.use);
  const n = mats.length;
  const G = p.GA;
  if (n === 0) return { status: 'nomaterials' };
  const em = energyModel(mats, p, G, cal);
  const denom = 1 - em.beta * em.c;
  // W(x) = (alpha + beta*(A0 + Σ a_i x_i)) / denom   — lineal
  const wConst = (em.alpha + em.beta * em.A0) / denom;
  const wCoef = em.a.map(ai => em.beta * ai / denom);
  // costo por kWh/t
  const dW = p.pEl / 1000 + p.kElec / 1000 * p.pElec + p.pCO2 * p.grid / 1000;
  const c = mats.map((m, i) => {
    let ci = m.price / G + matLime(m, p) * p.pLime / G + dW * wCoef[i];
    const co2C = m.C / 100 * 0.95 * 3.667; // t CO2 por t material
    ci += p.pCO2 * co2C / G;
    if (p.scope3) ci += p.pCO2 * m.co2 / G;
    return ci;
  });
  const rows = [];
  const tags = [];
  rows.push({ a: mats.map(m => matYield(m)), type: '=', b: G }); tags.push({ k: 'mass' });
  ELEMENTS.forEach(e => {
    if (p.lim[e] > 0) { rows.push({ a: mats.map(m => m[e] * p.rec[e]), type: '<=', b: p.lim[e] * G }); tags.push({ k: 'lim', e }); }
  });
  const isD = mats.map(m => m.type === 'dri' ? 1 : 0);
  if (opts.driShareFix != null) {
    const s = opts.driShareFix / 100;
    rows.push({ a: isD.map(d => d - s), type: '=', b: 0 }); tags.push({ k: 'drifix' });
  } else {
    if (p.driMax < 100) { const s = p.driMax / 100; rows.push({ a: isD.map(d => d - s), type: '<=', b: 0 }); tags.push({ k: 'drimax' }); }
    if (p.driMin > 0) { const s = p.driMin / 100; rows.push({ a: isD.map(d => d - s), type: '>=', b: 0 }); tags.push({ k: 'drimin' }); }
  }
  // volumen de cestas
  const inBasket = mats.map(m => !(m.type === 'dri' && !m.basket && p.driContinuous));
  rows.push({ a: mats.map((m, i) => inBasket[i] ? 1 / m.rho : 0), type: '<=', b: p.basketV * p.nBaskets }); tags.push({ k: 'vol' });
  // productividad mínima: t2t = c*W + tOff <= 60G/PR
  if (p.prodMin > 0) {
    const tMax = 60 * G / p.prodMin - p.tOff;
    rows.push({ a: wCoef.map(v => v * em.c), type: '<=', b: tMax - wConst * em.c }); tags.push({ k: 'prod' });
  }
  mats.forEach((m, i) => {
    if (m.max != null && m.max >= 0) { const a = new Array(n).fill(0); a[i] = 1; rows.push({ a, type: '<=', b: m.max }); tags.push({ k: 'max', id: m.id }); }
    if (m.min > 0) { const a = new Array(n).fill(0); a[i] = 1; rows.push({ a, type: '>=', b: m.min }); tags.push({ k: 'min', id: m.id }); }
  });
  const sol = simplex(c, rows, n);
  if (sol.status !== 'optimal') return { status: sol.status, mats, p };
  // expandir a lista completa
  const xFull = matsAll.map(m => { const k = mats.findIndex(mm => mm.id === m.id); return k >= 0 ? Math.max(0, sol.x[k]) : 0; });
  const ev = evaluate(xFull, matsAll.map(m => mats.find(mm => mm.id === m.id) || m), p, cal);
  // estado de restricciones
  const cons = rows.map((r, k) => {
    const lhs = r.a.reduce((s, v, j) => s + v * sol.x[j], 0);
    return Object.assign({}, tags[k], { lhs, rhs: r.b, type: r.type, active: Math.abs(lhs - r.b) < 1e-6 * Math.max(1, Math.abs(r.b)) });
  });
  return { status: 'optimal', x: xFull, ev, cons, mats, p, n, m: rows.length };
}

// Valor marginal por diferencias finitas (USD/t acero por unidad de relajación)
function marginalValues(matsAll, p, cal, base) {
  const out = [];
  const b0 = base.ev.costTotal;
  ELEMENTS.forEach(e => {
    if (!(p.lim[e] > 0)) return;
    const d = p.lim[e] * 0.05;
    const r = optimize(matsAll, p, cal, { limOverride: { [e]: p.lim[e] + d } });
    if (r.status === 'optimal') out.push({ key: 'lim_' + e, perUnit: (b0 - r.ev.costTotal) / d, step: d });
  });
  return out;
}

// ---------- Utilidades numéricas ----------
function mean(a) { return a.reduce((s, v) => s + v, 0) / (a.length || 1); }
function std(a) { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1)); }
function cholesky(A) {
  const n = A.length; const L = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) { if (s <= 0) return null; L[i][i] = Math.sqrt(s); }
      else L[i][j] = s / L[j][j];
    }
  }
  return L;
}
function cholSolve(L, b) {
  const n = L.length; const y = new Float64Array(n); const x = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; }
  for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
  return x;
}
function cholInvDiag(L) {
  const n = L.length; const d = new Float64Array(n);
  for (let c = 0; c < n; c++) { const e = new Float64Array(n); e[c] = 1; const v = cholSolve(L, e); d[c] = v[c]; }
  return d;
}
function metrics(y, f) {
  const res = y.map((v, i) => f[i] - v);
  const mae = mean(res.map(Math.abs));
  const rmse = Math.sqrt(mean(res.map(r => r * r)));
  const ym = mean(y);
  const sst = y.reduce((s, v) => s + (v - ym) ** 2, 0);
  const r2 = 1 - res.reduce((s, r) => s + r * r, 0) / (sst || 1);
  return { mae, rmse, r2, bias: mean(res) };
}

// ---------- Calibración con coladas ----------
// heat: {charge:{id:t}, GA, T, O2L, O2N, gas, tOff, tOn, t2t, MWh, Cu, Sn, ...}
function heatInputs(h, matsAll, p) {
  const ids = matsAll.map(m => m.id);
  const x = ids.map(id => +(h.charge[id] || 0));
  const ph = Object.assign({}, p, { T: h.T, O2L: h.O2L, O2N: h.O2N || 0, gas: h.gas, tOff: h.tOff, useCal: false });
  const GE = x.reduce((s, v) => s + v, 0);
  const G = h.GA;
  const sDRI = matsAll.reduce((s, m, i) => s + (m.type === 'dri' ? x[i] : 0), 0);
  const sShr = matsAll.reduce((s, m, i) => s + (m.type === 'shred' ? x[i] : 0), 0);
  const limeT = ph.Z0 * G / 1000 + matsAll.reduce((s, m, i) => s + x[i] * matLime(m, ph), 0);
  const K = 375 + 400 * (GE / G - 1) + 80 * sDRI / G - 50 * sShr / G + 1000 * limeT / G + 0.3 * (ph.T - 1600) + h.t2t - 8 * ph.gas - 4.3 * ph.O2L - 2.8 * ph.O2N;
  const feats = [sDRI / GE * 100, sShr / GE * 100, GE / G, ph.T, h.t2t, ph.O2L, ph.gas, limeT / G * 1000];
  return { K, feats, y: h.MWh * 1000 / G };
}
const FEAT_NAMES = ['DRI en carga (%)', 'Fragmentada (%)', 'Carga / vaciado', 'T vaciado (°C)', 'Tap-to-tap (min)', 'O₂ lanza (Nm³/t)', 'Gas (Nm³/t)', 'Escorificantes (kg/t)'];

function standardize(X) {
  const d = X[0].length;
  const mu = [], sd = [];
  for (let j = 0; j < d; j++) { const col = X.map(r => r[j]); mu.push(mean(col)); sd.push(std(col) || 1); }
  return { mu, sd, Z: X.map(r => r.map((v, j) => (v - mu[j]) / sd[j])) };
}

function fitLinear(xs, ys) { // y = a + b x con LOO
  const n = xs.length; const xm = mean(xs), ym = mean(ys);
  let sxx = 0, sxy = 0; xs.forEach((x, i) => { sxx += (x - xm) ** 2; sxy += (x - xm) * (ys[i] - ym); });
  const b = sxx > 0 ? sxy / sxx : 1; const a = ym - b * xm;
  const loo = xs.map((x, i) => { const h = 1 / n + (x - xm) ** 2 / sxx; const e = ys[i] - (a + b * x); return ys[i] - e / (1 - h); });
  return { a, b, loo };
}

function fitRidge(Z, y, lambdas = [0.01, 0.1, 0.3, 1, 3, 10, 30]) {
  // con intercepto no penalizado (y centrado)
  const n = Z.length, d = Z[0].length; const ym = mean(y); const yc = y.map(v => v - ym);
  let best = null;
  lambdas.forEach(lam => {
    const A = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => Z.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? lam : 0)));
    const L = cholesky(A); if (!L) return;
    const b = cholSolve(L, Array.from({ length: d }, (_, i) => Z.reduce((s, r, k) => s + r[i] * yc[k], 0)));
    // leverage h_ii = 1/n + z_i^T A^-1 z_i
    const loo = Z.map((r, k) => {
      const v = cholSolve(L, r); const h = 1 / n + r.reduce((s, zi, i) => s + zi * v[i], 0);
      const fit = ym + r.reduce((s, zi, i) => s + zi * b[i], 0);
      return y[k] - (y[k] - fit) / (1 - h);
    });
    const mse = mean(loo.map((f, k) => (f - y[k]) ** 2));
    if (!best || mse < best.mse) best = { lam, b: Array.from(b), ym, loo, mse };
  });
  return best;
}

function rbf(a, b, ell) { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.exp(-s / (2 * ell * ell)); }
function fitGP(Z, r) {
  const n = Z.length; const rm = mean(r); const rc = r.map(v => v - rm);
  const sf = std(r) || 1;
  let best = null;
  [0.8, 1.2, 1.8, 2.6, 4].forEach(ell => {
    [0.35, 0.6, 1.0].forEach(ratio => {
      const sn = sf * ratio;
      const K = Z.map((zi, i) => Z.map((zj, j) => sf * sf * rbf(zi, zj, ell) + (i === j ? sn * sn : 0)));
      const L = cholesky(K); if (!L) return;
      const alpha = cholSolve(L, rc); const dInv = cholInvDiag(L);
      const loo = rc.map((v, i) => r[i] - alpha[i] / dInv[i]); // predicción LOO del residuo
      const mse = mean(loo.map((f, i) => (f - r[i]) ** 2));
      if (!best || mse < best.mse) best = { ell, sf, sn, L, alpha: Array.from(alpha), rm, mse, loo, Z };
    });
  });
  return best;
}
function gpPredict(gp, z) {
  const k = gp.Z.map(zi => gp.sf * gp.sf * rbf(zi, z, gp.ell));
  const mu = gp.rm + k.reduce((s, v, i) => s + v * gp.alpha[i], 0);
  const v = cholSolve(gp.L, k);
  const varf = Math.max(0, gp.sf * gp.sf - k.reduce((s, ki, i) => s + ki * v[i], 0));
  return { mu, sd: Math.sqrt(varf + gp.sn * gp.sn) };
}

function calibrate(heats, matsAll, p) {
  const valid = heats.filter(h => h.MWh > 0 && h.GA > 0 && h.t2t > 0);
  if (valid.length < 6) return { n: valid.length, ready: false };
  const rows = valid.map(h => heatInputs(h, matsAll, p));
  const y = rows.map(r => r.y), K = rows.map(r => r.K);
  const models = [];
  models.push({ id: 'kohle', name: 'Köhle original (2005)', loo: K.slice(), fit: K.slice() });
  const bias = mean(y.map((v, i) => v - K[i]));
  const looBias = y.map((v, i) => K[i] + (bias * y.length - (v - K[i])) / (y.length - 1));
  models.push({ id: 'bias', name: 'Köhle + sesgo del horno', loo: looBias, bias });
  const lin = fitLinear(K, y);
  models.push({ id: 'lin', name: 'Köhle con corrección lineal', loo: lin.loo, a: lin.a, b: lin.b });
  const st = standardize(rows.map(r => r.feats));
  const ZK = st.Z.map((z, i) => z.concat([(K[i] - mean(K)) / (std(K) || 1)]));
  const rid = fitRidge(ZK, y);
  if (rid) models.push({ id: 'ridge', name: 'Regresión ridge multivariable', loo: rid.loo, ridge: rid });
  const resid = y.map((v, i) => v - K[i]);
  const gp = fitGP(st.Z, resid);
  if (gp) models.push({ id: 'gp', name: 'Híbrido Köhle + proceso gaussiano', loo: gp.loo.map((r, i) => K[i] + r), gp });
  models.forEach(m => { m.metrics = metrics(y, m.loo); });
  const best = models.filter(m => m.id !== 'kohle').reduce((a, b) => (b.metrics.mae < a.metrics.mae ? b : a));
  const resLin = y.map((v, i) => v - (lin.a + lin.b * K[i]));
  return { ready: true, n: valid.length, valid, rows, y, K, models, bestId: best.id, a: lin.a, b: lin.b, st, Kmean: mean(K), Ksd: std(K) || 1, rmseLin: Math.sqrt(mean(resLin.map(v => v * v))), gp, rid, bias };
}

// predicción calibrada para una receta (usa entradas de proceso planificadas)
function predictPlan(cal, modelId, ev, mats, p) {
  if (!cal || !cal.ready) return null;
  const h = { charge: {}, GA: ev.G, T: p.T, O2L: p.O2L, O2N: p.O2N, gas: p.gas, tOff: p.tOff, t2t: ev.t2t, MWh: 0 };
  mats.forEach((m, i) => h.charge[m.id] = ev.x[i]);
  const r = heatInputs(h, mats, p);
  const m = cal.models.find(mm => mm.id === modelId) || cal.models.find(mm => mm.id === cal.bestId);
  const z = r.feats.map((v, j) => (v - cal.st.mu[j]) / cal.st.sd[j]);
  let mu, sd = m.metrics.rmse;
  if (m.id === 'kohle') mu = r.K;
  else if (m.id === 'bias') mu = r.K + m.bias;
  else if (m.id === 'lin') mu = m.a + m.b * r.K;
  else if (m.id === 'ridge') { const zk = z.concat([(r.K - cal.Kmean) / cal.Ksd]); mu = m.ridge.ym + zk.reduce((s, v, i) => s + v * m.ridge.b[i], 0); }
  else { const g = gpPredict(m.gp, z); mu = r.K + g.mu; sd = Math.max(g.sd, 1); }
  return { mu, lo: mu - 1.96 * sd, hi: mu + 1.96 * sd, model: m, K: r.K };
}

// ---------- Coladas de ejemplo (sintéticas, reproducibles) ----------
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function demoHeats(matsAll, p) {
  const r = rng(20261028);
  const heats = [];
  const start = new Date(2026, 9, 18, 6, 10);
  let t = start.getTime();
  const shifts = ['A', 'B', 'C'];
  const ops = ['L. Treviño', 'M. Garza', 'R. Salinas', 'C. Ibarra'];
  for (let k = 0; k < 42; k++) {
    const dri = 5 + r() * 70;              // % DRI
    const GA = 148 + gauss(r) * 3;
    const T = 1638 + gauss(r) * 9;
    const O2L = 28 + gauss(r) * 2.5;
    const gas = Math.max(0, 4 + gauss(r) * 1.2);
    // receta: DRI + mezcla de chatarras
    const charge = {};
    const yD = matYield(matsAll.find(m => m.id === 'dri'));
    const fr = { hms: 0.18 + r() * 0.12, shr: 0.08 + r() * 0.06, bus: 0.22 + r() * 0.10, pkg: 0.15 + r() * 0.07, ret: 0.08, pig: 0.03 };
    const fs = Object.values(fr).reduce((s, v) => s + v, 0);
    const yS = Object.entries(fr).reduce((s, [id, f]) => s + f / fs * matsAll.find(m => m.id === id).yield, 0);
    const GE = GA / (dri / 100 * yD + (1 - dri / 100) * yS);
    charge.dri = GE * dri / 100;
    Object.entries(fr).forEach(([id, f]) => charge[id] = GE * (1 - dri / 100) * f / fs);
    Object.keys(charge).forEach(id => charge[id] = Math.round(charge[id] * 10) / 10);
    // comportamiento "real" del horno: coeficientes distintos de Köhle + no linealidad + ruido
    // la planta ajusta la mezcla para cumplir el cobre del grado (salvo una colada)
    const cuOf = () => matsAll.reduce((s, m) => s + (charge[m.id] || 0) * m.Cu, 0) / GA;
    let guard = 0;
    while (k !== 19 && cuOf() > 0.054 && guard++ < 200) {
      const from = charge.shr > 1 ? 'shr' : charge.hms > 1 ? 'hms' : null; if (!from) break;
      charge[from] = Math.round((charge[from] - 1) * 10) / 10; charge.bus = Math.round((charge.bus + 1) * 10) / 10;
    }
    const h = { charge, GA, T, O2L, O2N: 0, gas, tOff: 15 + Math.max(0, gauss(r) * 3), t2t: 0, MWh: 0 };
    let W = 0, t2t = 55;
    for (let it = 0; it < 4; it++) {
      h.t2t = t2t;
      const base = heatInputs(Object.assign({}, h, { MWh: 1 }), matsAll, p).K;
      const extraDRI = 0.016 * Math.max(0, dri - 35) ** 2 + 0.25 * Math.max(0, T - 1645); // pérdidas no lineales con DRI alto y baño muy caliente
      W = base + 14 + 0.18 * (dri - 40) + extraDRI;
      const tOn = W * GA / (1000 * p.P * p.util) * 60;
      t2t = tOn + h.tOff;
    }
    W += gauss(r) * 6.5 + (k === 27 ? 38 : 0) + (k === 33 ? -30 : 0);
    h.t2t = Math.round(t2t * 10) / 10;
    h.tOn = Math.round((h.t2t - h.tOff) * 10) / 10;
    h.MWh = Math.round(W * GA / 1000 * 100) / 100;
    // química
    const cu = matsAll.reduce((s, m) => s + (charge[m.id] || 0) * m.Cu, 0) / GA;
    const sn = matsAll.reduce((s, m) => s + (charge[m.id] || 0) * m.Sn, 0) / GA;
    h.Cu = Math.round((cu * (1 + gauss(r) * 0.06)) * 1000) / 1000;
    h.Sn = Math.round((sn * (1 + gauss(r) * 0.08)) * 10000) / 10000;
    const d = new Date(t);
    h.id = 'C26-' + String(4180 + k);
    h.date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    h.time = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    const hr = d.getHours();
    h.shift = hr >= 6 && hr < 14 ? 'A' : hr >= 14 && hr < 22 ? 'B' : 'C';
    h.operator = ops[k % ops.length];
    h.grade = 'ddq';
    h.GA = Math.round(GA * 10) / 10;
    h.T = Math.round(T);
    h.O2L = Math.round(O2L * 10) / 10;
    h.gas = Math.round(gas * 10) / 10;
    h.tOff = Math.round(h.tOff * 10) / 10;
    h.notes = k === 27 ? 'Demora por cambio de electrodo, baño frío' : k === 33 ? 'Pie líquido mayor al habitual' : '';
    h.demo = true;
    heats.push(h);
    t += (h.t2t + 150 + r() * 120) * 60000;
  }
  void shifts;
  return heats;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { defaultMaterials, defaultProcess, GRADES, optimize, evaluate, matYield, simplex, calibrate, demoHeats, predictPlan, marginalValues, heatInputs, ELEMENTS };
