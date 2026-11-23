// The chart set of the qubits story: the honest result (the real run's residual by depth, our cuts against random
// ones, from QUBITS_DATA: good at 2 to 4 bits, worse with every bit; at 8 bits most of the operator is outside the
// algebra), with the example network's own residuals at 1 to 3 bits computed live (QMATH), and the recipe as a
// circuit: one Trotter step at 3 bits in so(7), six gates on three wires (q2, q1, q0), time running down, red for
// X-type gates and blue for Z-type, shaded by |theta| (the real run's angles, or the example network's).
// The chart and the circuit share the origin: the story shows one or the other (chart_plot, chart_circuit).
SETS.chart = function (K) {
  const { THREE, clamp, lerp, prog, smooth, rgb } = K;
  const set = K.newSet('chart');
  const Q = QMATH, D = QUBITS_DATA, LK = QLOOK(K, set);
  const R = D.residual, NBIT = R.bits.length;
  const X = b => -1.0 + (b - 1) * (2.0 / (NBIT - 1)), Yr = r => -0.5 + r;   // bits 1..8 across, residual 0..1 up
  const ZO = 0.1, ZR = -0.1, ZB = -0.3;   // our cuts in front, random behind, the back panel
  const COL = { ours: rgb('#46d9ff'), rand: rgb('#8e98ab'), ex: LK.AMBER, grid: rgb('#34405a') };
  // the example network's residual at 1, 2 and 3 bits (its found cut; the better of so(2L) and so(2L+1), as the real
  // run reports the best algebra of its panel)
  const EX = [1, 2, 3].map(L => { const A = Q.analyze(Q.DEFAULT, { L }); return Math.min(A.fits.tfim.residual, A.fits.odd.residual); });
  // the circuit: gates in time order, one row each
  const exGates = Q.analyze(Q.DEFAULT, { L: 3 }).trotter.odd.map(g => ({ type: g.type, qubits: g.qubits, theta: g.theta }));
  const SRC = [D.circuit.gates, exGates];
  const WX = q => 0.4 - q * 0.4;   // wire x: q2 left, q0 right
  const ROWY = i => 0.6 - i * 0.24;
  const tubes = LK.tubes(160), balls = LK.balls(60), boxes = LK.boxes(20), halos = LK.halos(60), rings = LK.rings(12);
  set.group.add(tubes.mesh, balls.mesh, boxes.mesh, halos.mesh, rings.mesh);
  const now = { src: 0 };
  function series(vals, z, col, g, a, rad) {
    const n = vals.length, upto = g * (n - 1);
    for (let i = 0; i < n; i++) {
      const p = [X(i + 1), Yr(vals[i]), z], on = clamp(upto - i + 1, 0, 1);
      if (on <= 0) break;
      balls.add(p, rad * 1.9 * smooth(on), col, a);
      halos.add(p, rad * 9, col, 0.3 * a * on);
      tubes.add([p[0], Yr(0), z], p, rad * 0.35, col, a * 0.35 * on, 0);   // a stem down to the axis
      if (i < n - 1 && upto > i) {
        const f = clamp(upto - i, 0, 1), q = [X(i + 2), Yr(vals[i + 1]), z];
        tubes.add(p, [lerp(p[0], q[0], f), lerp(p[1], q[1], f), z], rad, col, a, 0);
      }
    }
  }
  function update(S, t) {
    LK.depth();
    const plot = clamp(S.chart_plot, 0, 1), circ = clamp(S.chart_circuit, 0, 1);
    tubes.begin(); balls.begin(); boxes.begin(); halos.begin(); rings.begin();
    if (plot > 0.003) {
      // the back panel: residual lines at 0, 0.25 .. 1, faint lines at each bit, the axis
      for (let k = 0; k <= 4; k++) tubes.add([X(1) - 0.08, Yr(k / 4), ZB], [X(NBIT) + 0.08, Yr(k / 4), ZB], k === 0 ? 0.005 : 0.0025, k === 0 ? LK.INK : COL.grid, plot * (k === 0 ? 0.7 : 0.8), k === 0 ? 0 : 0);
      for (let b = 1; b <= NBIT; b++) tubes.add([X(b), Yr(0), ZB], [X(b), Yr(1), ZB], 0.002, COL.grid, plot * 0.6, 0);
      tubes.add([X(1) - 0.08, Yr(0), ZO + 0.08], [X(1) - 0.08, Yr(0), ZB], 0.003, COL.grid, plot * 0.6, 0);
      tubes.add([X(NBIT) + 0.08, Yr(0), ZO + 0.08], [X(NBIT) + 0.08, Yr(0), ZB], 0.003, COL.grid, plot * 0.6, 0);
      const g = clamp(S.chart_grow, 0, 1);
      series(R.ours, ZO, COL.ours, g, plot, 0.011);
      const rnd = clamp(S.chart_rand, 0, 1);
      if (rnd > 0.003) series(R.random, ZR, COL.rand, g, plot * rnd, 0.009);
      const best = clamp(S.chart_best, 0, 1) * prog(g, 0.9, 1);
      if (best > 0.003) {
        const p = [X(NBIT), Yr(R.best8), ZO];
        rings.add(p, [0, 0, 1], 0.035, 0.005, COL.ours, plot * best, 10);
      }
      const ex = clamp(S.chart_ex, 0, 1);
      if (ex > 0.003) EX.forEach((r, i) => {
        const p = [X(i + 1), Yr(r), ZO + 0.12];
        rings.add(p, [0, 0, 1], 0.03, 0.006, COL.ex, plot * ex, 0);
        halos.add(p, 0.1, COL.ex, 0.3 * plot * ex);
        if (i < 2) tubes.add(p, [X(i + 2), Yr(EX[i + 1]), ZO + 0.12], 0.004, COL.ex, plot * ex * 0.7, 14);
      });
    }
    if (circ > 0.003) {
      const src = Math.round(clamp(S.chart_src, 0, 1)), G = SRC[src], mx = Math.max(...G.map(g => Math.abs(g.theta))) || 1;
      now.src = src;
      const shown = clamp(S.chart_gates, 0, G.length), run = clamp(S.chart_run, 0, 1);
      // the wires, and a time arrow down the left
      for (let q = 2; q >= 0; q--) { tubes.add([WX(q), 0.82, 0], [WX(q), -0.86, 0], 0.006, LK.INK, circ * 0.55, 0); balls.add([WX(q), 0.82, 0], 0.016, LK.INK, circ * 0.8); }
      tubes.add([-0.72, 0.72, 0], [-0.72, -0.78, 0], 0.004, COL.grid, circ * 0.9, 18);
      tubes.add([-0.72, -0.78, 0], [-0.7, -0.74, 0], 0.004, COL.grid, circ * 0.9, 0); tubes.add([-0.72, -0.78, 0], [-0.74, -0.74, 0], 0.004, COL.grid, circ * 0.9, 0);
      // pulses running down the wires (the state passing through the step); a gate glows as one passes
      const pulses = [0, 1, 2].map(q => 0.82 - ((t * 0.32 + q * 0.21) % 1) * 1.68);
      if (run > 0.01) for (let q = 0; q < 3; q++) halos.add([WX(q), pulses[q], 0.01], 0.09, [0.85, 0.95, 1], circ * run * 0.8);
      G.forEach((gt, i) => {
        const a = circ * smooth(clamp(shown - i, 0, 1));
        if (a <= 0.003) return;
        const y = ROWY(i), shade = 0.22 + 0.78 * Math.abs(gt.theta) / mx, xt = gt.type === 'RX';
        const base = xt ? LK.RED : LK.BLUE, col = LK.mix([0.1, 0.11, 0.16], base, shade);
        const flash = run * Math.max(...gt.qubits.map(q => Math.exp(-(((pulses[q] - y) / 0.06) ** 2))));
        const c2 = LK.mix(col, [1, 1, 1], 0.35 * flash);
        for (const q of gt.qubits) {
          boxes.add([WX(q), y, 0], [0.17, 0.13, 0.09], c2, a);
          halos.add([WX(q), y, 0.06], 0.28, base, a * (0.12 + 0.35 * shade) * (1 + flash));
        }
        if (gt.qubits.length === 2) tubes.add([WX(gt.qubits[0]), y, 0], [WX(gt.qubits[1]), y, 0], 0.018, c2, a, 0);
      });
    }
    tubes.end(); balls.end(); boxes.end(); halos.end(); rings.end();
  }

  // ---------------------------------------------------------------- anchors, labels, views
  const anchors = {
    // (the series' labels sit along them, clear of each other and of the 8-bit end)
    chart: [0, 0, 0], ours: [X(5) + 0.02, Yr(R.ours[4]) - 0.1, ZO], rand: [X(3) - 0.05, Yr(R.random[2]) + 0.13, ZR],
    best8: [X(NBIT), Yr(R.best8), ZO], ex3: [X(3), Yr(EX[2]), ZO + 0.12], ours3: [X(3), Yr(R.ours[2]), ZO],
    axis: [X(1) - 0.1, Yr(1) + 0.08, ZB], bits: [X(NBIT) + 0.1, Yr(0) - 0.02, ZO],
    circuit: [0, 0, 0], top: [-0.78, 1.08, 0], time: [-0.72, 0.8, 0],
    q2: [WX(2), 0.9, 0], q1: [WX(1), 0.9, 0], q0: [WX(0), 0.9, 0],
  };
  const fmtT = v => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(3);
  const plotOn = S => clamp(S.chart_plot, 0, 1);
  const labels = [
    { text: ['Our cuts', ' · real network'], at: 'ours', cls: 'cyn', alpha: S => plotOn(S) * prog(S.chart_grow, 0.85, 1) },
    { text: ['Random cuts', ''], at: 'rand', cls: '', alpha: S => plotOn(S) * prog(S.chart_grow, 0.85, 1) * clamp(S.chart_rand, 0, 1) },
    { text: ['Best 8-bit run', ` · ${R.best8.toFixed(2)}`], at: 'best8', cls: 'cyn', minor: true, alpha: S => plotOn(S) * clamp(S.chart_best, 0, 1) * prog(S.chart_grow, 0.95, 1) },
    { text: ['Example network', ' · computed here'], at: 'ex3', cls: 'amb', alpha: S => plotOn(S) * clamp(S.chart_ex, 0, 1) },
    { text: ['Residual', ' · 0 nothing lost, 1 all lost'], at: 'axis', cls: '', alpha: S => plotOn(S) * prog(S.chart_grow, 0, 0.2) },
    { text: ['Bits', ' · qubits per walker'], at: 'bits', cls: '', alpha: S => plotOn(S) * prog(S.chart_grow, 0, 0.2) },
  ];
  for (let b = 1; b <= NBIT; b++) labels.push({ text: [String(b), ''], at: [X(b) - 0.02, Yr(0) - 0.05, ZO], cls: '', minor: true, alpha: S => plotOn(S) * prog(S.chart_grow, (b - 1) / 8, b / 8) });
  const circOn = S => clamp(S.chart_circuit, 0, 1);
  labels.push({ text: () => ['One Trotter step', now.src ? ' · example network, so(7)' : ' · real network, so(7)'], at: 'top', cls: 'mag', alpha: circOn });
  for (const q of [2, 1, 0]) labels.push({ text: ['q' + q, ''], at: 'q' + q, cls: '', alpha: circOn });
  labels.push({ text: ['Time', ''], at: 'time', cls: '', minor: true, alpha: circOn });
  for (let i = 0; i < 6; i++) {
    const text = () => { const g = SRC[now.src][i]; return g ? [g.type, ' θ ' + fmtT(g.theta)] : ['', '']; };
    const at = () => { const g = SRC[now.src][i]; return [Math.max(...g.qubits.map(WX)) + 0.11, ROWY(i), 0]; };
    labels.push({ text, at, cls: SRC[0][i].type === 'RX' ? 'mag' : 'cyn', alpha: S => circOn(S) * clamp(S.chart_gates - i, 0, 1) });
  }
  const cam = { default: [0, 8, 3.9, 0.1, 0.02, 0], chart: [0, 8, 3.9, 0.1, 0.02, 0], circuit: [-14, 6, 4.1, 0.05, 0.03, 0] };
  const controls = [
    { key: 'view', label: 'View', options: [['chart', 'Chart'], ['circuit', 'Circuit']] },
    { key: 'ex', label: 'Example network', options: [['off', 'Off'], ['on', 'On']], when: v => v.view !== 'circuit' },
    { key: 'src', label: 'Angles', options: [['real', 'Real network'], ['ex', 'Example network']], when: v => v.view === 'circuit' },
  ];
  function explore(c) {
    const circ = c.view === 'circuit';
    return { chart_plot: circ ? 0 : 1, chart_circuit: circ ? 1 : 0, chart_grow: 1, chart_rand: 1, chart_best: 1, chart_ex: c.ex === 'on' ? 1 : 0,
      chart_gates: 6, chart_run: 1, chart_src: c.src === 'ex' ? 1 : 0 };
  }
  const API = { residual: R, example: EX.slice(), gates: SRC.map(g => g.map(x => Object.assign({}, x))) };
  return Object.assign(set, {
    params: { chart_a: 1, chart_plot: 1, chart_grow: 1, chart_rand: 1, chart_best: 1, chart_ex: 0, chart_circuit: 0, chart_gates: 6, chart_run: 1, chart_src: 0 },
    update, anchors, labels, cam, controls, explore,
    api: () => API,
  });
};
