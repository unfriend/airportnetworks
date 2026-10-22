
// ================================================================== STORY ==
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Until a narration is recorded, the table sets the
// pace: node tools/pace.mjs writes it from the words on the panel (each stretch
// between two cues lasts long enough to read what appeared at its start; run
// it again after the text changes). A recording replaces it with its own times.
const NARRATION_SYNC = [
  [0, 0], [3.3, 3], [7, 4], [7.7, 4.6], [12.7, 6.5], [21.9, 12], [24.1, 13.5], [34.2, 22.6],
  [44, 26],                                           // Pairs
  [50.6, 30], [51.9, 31.18], [53.5, 31.2], [54.1, 31.8], [62.7, 35], [84.2, 54.6], [105.1, 58],  // Walkers
  [109.9, 62], [111.2, 63.18], [112.3, 63.2], [119.3, 67], [125.5, 72], [134.9, 80.6], [142.2, 83],  // Shrink
  [152.3, 90], [152.9, 90.6], [154.2, 91.2], [164.8, 98], [194, 124.6], [204.8, 126], [205.4, 126.6],
  [220.6, 128], [221.2, 128.6],                       // Cuts
  [241.6, 130], [242.3, 130.6], [243.6, 131.2], [252.8, 137], [264.2, 143], [275.6, 150],
  [276.3, 150.6], [296.3, 155],                       // Coarse
  [302.4, 160], [303.1, 160.6], [304, 161.2], [304.6, 161.8], [312.7, 165], [316.2, 168],
  [326.1, 177], [331, 180], [340.9, 189], [349.2, 193], [360.2, 200], [360.8, 200.6], [381.7, 206],  // Bricks
  [391.6, 215], [392.2, 215.6], [393.1, 216.2], [398.4, 219], [406.3, 224], [413.3, 230],
  [414, 230.6], [438.7, 238], [444.2, 243], [456.5, 253], [462.7, 256],  // Toolbox
  [472.8, 262], [474.1, 263.18], [475.6, 263.2], [476.3, 263.8], [483.1, 266], [490.5, 270],
  [509, 279], [509.6, 279.6], [518.6, 282], [519.3, 282.6], [526.1, 285], [528.3, 286], [530, 287.6],
  [543.9, 290],                                       // Circuit
];
// recording time -> original story time
function storyT(t) {
  const W = NARRATION_SYNC;
  if (t <= 0) return 0;
  for (let i = 1; i < W.length; i++) {
    if (t <= W[i][0]) { const [n0, o0] = W[i - 1], [n1, o1] = W[i]; return o0 + (o1 - o0) * (t - n0) / (n1 - n0); }
  }
  return W[W.length - 1][1] + (t - W[W.length - 1][0]);
}
// original story time -> recording time
function narrT(o) {
  const W = NARRATION_SYNC;
  for (let i = 1; i < W.length; i++) {
    if (o <= W[i][1]) { const [n0, o0] = W[i - 1], [n1, o1] = W[i]; return n0 + (n1 - n0) * (o - o0) / (o1 - o0); }
  }
  return W[W.length - 1][0] + (o - W[W.length - 1][1]);
}
let T_END = NARRATION_SYNC[NARRATION_SYNC.length - 1][0];
const CH = [
  { key: 'title', name: 'Pairs', a: 0, b: 30 },
  { key: 'walkers', name: 'Walkers', a: 30, b: 62 },
  { key: 'shrink', name: 'Shrink', a: 62, b: 90 },
  { key: 'cut', name: 'Cuts', a: 90, b: 130 },
  { key: 'coarse', name: 'Coarse', a: 130, b: 160 },
  { key: 'bricks', name: 'Bricks', a: 160, b: 215 },
  { key: 'toolbox', name: 'Toolbox', a: 215, b: 262 },
  { key: 'circuit', name: 'Circuit', a: 262, b: 290 },
];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
const C = Object.fromEntries(CH.map(c => [c.key, c]));

// every param of every set, at rest; the sets themselves start hidden
const DEF = {};
function buildDefaults() {
  for (const k of SET_ORDER) Object.assign(DEF, GL.sets[k].params);
  for (const k of SET_ORDER) DEF[k + '_a'] = 0;
}
const TR = {};
const key = (n, t, v) => { (TR[n] = TR[n] || []).push([t, v]); };
const ramp = (n, t0, t1, v0, v1) => { key(n, t0, v0); key(n, t1, v1); };
function evalTrack(n, t) {
  const ks = TR[n];
  if (!ks) return DEF[n];
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const [t0, v0] = ks[i - 1], [t1, v1] = ks[i];
      return t1 <= t0 ? v1 : v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
    }
  }
  return ks[ks.length - 1][1];
}
function storyState(t) {
  const s = {};
  for (const n in DEF) s[n] = evalTrack(n, t);
  return s;
}
const fadeVal = (t, a, b, d) => (t <= a || t >= b ? 0 : Math.min(smooth((t - a) / d), smooth((b - t) / d)));

const ST = { labels: [], items: [] };
// a set's camera view by name (falls back to its default view)
// (with the story's own framing on top: FIT)
const view = (k, name) => {
  const c = GL.sets[k].cam, v = (c[name] || c.default).slice(), f = c[name] && FIT[k] && FIT[k][name];
  if (f) for (let i = 0; i < f.length; i++) v[i] += f[i];
  return v;
};
// the part of a view's FIT that moves its target clear of the side panel: on a screen without one (a phone, a narrow
// window) applyCamera takes it back, so the view stays centred there
const fitShift = (k, name) => { const f = GL.sets[k].cam[name] && FIT[k] && FIT[k][name]; return f ? [f[3] || 0, f[4] || 0, f[5] || 0] : [0, 0, 0]; };
// views whose parts reach under the side panel or off the right edge on a landscape screen: a little further back,
// or their target moved, so they fit beside the panel (added to the set's own view, in story and explore mode alike)
// (measured at 1280 x 760: each view's parts between the panel's right edge and the screen's, above the timeline)
// (the grid of pairs, about 2.1 tall, fills the height between the top bar and the timeline; the gallery, from the big
// cube to its fifth column about 4.3 across, needs about 7.9 units' distance beside the panel, its middle left of the
// view's target)
const FIT = { pairs: { grid: [0, 0, 1.3, 0, 0.05], hoods: [0, 0, 0.5, 0.1], chip: [0, 0, 0.4, 0.05] },
  cube: { default: [0, 0, 0.6], cube: [0, 0, 1.7], genes: [0, 0, 0.3], bricks: [0, 0, 2.3, -0.42], gallery: [0, 0, 0.5] }, chart: { default: [0, 0, 0.7, -0.05], chart: [0, 0, 0.7, -0.05] } };
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen
const NARROW = { pairs: { grid: 1.1, hoods: 1.15, chip: 1.1 }, cube: { genes: 1.1, bricks: 1.2, gallery: 1.1 }, chart: { default: 1.1, chart: 1.1 } };
const narrowOf = (k, name) => (NARROW[k] && NARROW[k][name]) || 1;
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

// ------------------------------------------------------------------- data --
// The maths (QMATH) on the story's example network, and the real run's numbers (QUBITS_DATA), looked up once for the
// story and the panes. The example's numbers are computed here, never typed in; the real run's are used only where
// the text says "in the real network".
const Q = QMATH, QD = QUBITS_DATA;
const NETI = Math.max(0, Q.NETS.findIndex(n => n.key === Q.DEFAULT));   // the story's network (cube_net)
const SUBS = '₀₁₂₃₄₅₆₇₈₉';
const sub = nm => String(nm).replace(/\d/g, d => SUBS[d]);   // 'X2X1' -> 'X₂X₁'
const f2 = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
const f3s = v => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(3);   // an angle with its sign
const pct = v => (Number.isFinite(+v) ? `${Math.round(100 * v)}%` : '–');
const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] || String(n);
const listOf = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const codeStr = (c, L) => c.toString(2).padStart(L, '0');
// the better of the two algebras (the real run reports the best algebra of its panel; the chart set does the same)
const bestRes = A => Math.min(A.fits.tfim.residual, A.fits.odd.residual);
// the analysis of any example network, cut and depth (cached by QMATH)
const anOf = (ni, cut, L) => Q.analyze(Q.NETS[clamp(ni | 0, 0, Q.NETS.length - 1)].key, { L: clamp(L | 0, 1, 3), cut: cut === 'random' ? 'random' : 'found' });
// a string's index at L bits from its name ('X2X1'), or -1 when it acts on a qubit beyond L or is no string
const isBrick = nm => typeof nm === 'string' && (nm === 'I' || (/^([XYZ][0-2]){1,3}$/.test(nm) && Q.name(Q.parse(nm, 3), 3) === nm));
const brickK = (nm, L) => (!isBrick(nm) || (nm !== 'I' && Math.max(...nm.match(/\d/g).map(Number)) >= L) ? -1 : Q.parse(nm, L));
// what a string does on the cube, in words
function brickWhat(k, L) {
  const p = Q.parts(k, L), x = k >> L, nx = Q.pop(x);
  if (!p.length) return 'do nothing: the same loop on every corner';
  if (!x) return p.length === 1 ? 'a sign by one digit: loops of +1 and −1' : 'a sign by digits: loops of +1 and −1';
  if (p.length === 1) return p[0].p === 'X' ? 'flip one digit: hops along the cube’s edges' : 'flip one digit, with a sign';
  if (nx === 1) return 'hops with signs';
  return nx === 2 ? 'flip two digits: face diagonals' : 'flip three digits: body diagonals';
}

// ------------------------------------------------------------------ facts --
// Numbers the story quotes: the example network's computed here, the real run's from QUBITS_DATA
const FACTS = (() => {
  const net = Q.network(Q.DEFAULT), a = L => anOf(NETI, 'found', L), r = L => anOf(NETI, 'random', L), a3 = a(3), sz = a3.sizes;
  const R = QD.residual, at = b => R.bits.indexOf(b);
  return {
    genes: QD.network.genes, pairs: Q.pairs(QD.network.genes), pairsM: Math.round(Q.pairs(QD.network.genes) / 1e6),
    source: QD.network.source, score: QD.network.score, run: QD.run,
    real: {
      cube: QD.cubeShare, so7: QD.so7, R, best8: R.best8,
      ours: b => R.ours[at(b)], rand: b => R.random[at(b)],
      weights: QD.weights3.map(([n, w]) => `${sub(n)} ${w.toFixed(2)}`), outside: QD.outside3.map(sub),
      gates: QD.circuit.gates,
    },
    ex: {
      name: Q.NETS[NETI].name, n: net.n, m: net.m, cells: sz.length, cellMin: Math.min(...sz), cellMax: Math.max(...sz),
      cube: a3.cubeShare, purity: a3.purity, err10: a3.errors[Math.min(10, a3.errors.length - 1)],
      top: a3.order.slice(0, 5).map(k => `${Q.name(k, 3, { sub: true })} ${f2(a3.c.re[k])}`),
      res: [1, 2, 3].map(L => bestRes(a(L))), rand: [1, 2, 3].map(L => bestRes(r(L))), res7: a3.fits.odd.residual, res6: a3.fits.tfim.residual,
    },
    alg: { odd: Q.algebra('odd', 3), tfim: Q.algebra('tfim', 3) },
  };
})();
// the circuit's gates in words: 'RX on q0, q1 and q2 (θ = ...)'
const gatesText = G => {
  const q = g => g.qubits.map(i => 'q' + i), rx = G.filter(g => g.type === 'RX'), zz = G.filter(g => g.type === 'RZZ'), z = G.filter(g => g.type === 'RZ');
  return [rx.length ? `RX on ${listOf(rx.map(g => q(g)[0]))} (θ = ${rx.map(g => f3s(g.theta)).join(', ')})` : '',
    zz.length ? `RZZ on ${listOf(zz.map(g => `(${q(g).join(', ')}) at ${f3s(g.theta)}`))}` : '',
    z.length ? `RZ on ${listOf(z.map(g => `${q(g)[0]} at ${f3s(g.theta)}`))}` : ''].filter(Boolean).join(', ');
};
// colors as text on the HTML panel, which is light in the light theme: a color mixed with the panel's ink (darker on a
// light panel, lighter on a dark one). The headset's panel is dark: its canvas twin takes the color itself (data-col).
const inkCol = c => `color-mix(in srgb, ${c} 55%, var(--ink))`;
const swCol = c => c;   // a swatch or a bar in the same color
const PURPLE = '#9a90ff', RED = '#ff5a4b', BLUE = '#4d94ff', GRAY = '#8e98ab';

function buildStory() {
  const F = FACTS, E = F.ex, RL = F.real;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  const hide = (k, t0, t1) => ramp(k + '_a', t0, t1, 1, 0);
  // jump an index param (a string, a code) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const step = (at, out, col, b, text) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  // ------------------------------------------------------------ panel copy
  // parts of a chapter that take turns in one place, each fading out (data-out) as the next comes: the headset's
  // panel cannot scroll, so no chapter shows more than fits at once
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const ex = E.res.map(f2), rd = E.rand.map(f2);
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">Three qubits</h1>
      <p class="lede" data-at="2.4">how a gene network fits on a tiny quantum computer</p>
      ${turns(`<p data-at="4" data-out="21.5">Some diseases only appear when two genes are broken at the same time.</p>
        <p data-at="6.5" data-out="21.5">Each dot here is a gene, and each square a pair of them. Add genes, and the pairs grow much faster.</p>
        <div class="facts"><div data-at="12" data-out="21.5"><b>${fmt(F.genes)}</b><small>genes in the real network</small></div><div data-at="13.5" data-out="21.5"><b>${F.pairsM} million</b><small>pairs of them</small></div></div>
        <p data-at="16" data-out="21.5" class="amber">Far too many to test one by one.</p>`,
      `<p class="note" data-at="22">n genes make n(n − 1)/2 pairs: ${fmt(F.genes)} × ${fmt(F.genes - 1)} / 2 = ${fmt(F.pairs)}. The real network: ${esc(F.source)}, physical protein interactions with a combined score of ${F.score} or more, its largest connected component.</p>
        <p class="credits" data-at="26">After the method and figures of Joel Hancock. The networks drawn are examples, computed here.</p>`)}`,
    walkers: `<h2 data-at="0.6">Two walkers on a map</h2>
      ${turns(`<p data-at="1.2" data-out="20.5">Think of the network as a map. Each gene is a place, and a street joins two genes whose proteins touch.</p>
        <p data-at="5" data-out="20.5">Two walkers wander it, one for each gene of a pair.</p>
        <p data-at="14" data-out="20.5" class="amber">They are drawn to pairs that are broken together in patients more often than in healthy people.</p>`,
      `<p data-at="21" class="amber">Where they settle is where to look.</p>
        <p class="note" data-at="24">In symbols, the walkers' energy is H = K + c V + ρ R. K = I − A_c lets them move along the network (A_c comes later); V rewards the pairs that patients' data point to; R, the exchange operator, swaps the two walkers, so the search is for pairs, not single genes.</p>
        <p class="credits" data-at="28">The valleys here are illustrative: this story uses no patients' data.</p>`)}`,
    shrink: `<h2 data-at="0.6">Why shrink the map?</h2>
      ${turns(`<p data-at="1.2" data-out="17.5">A quantum computer could explore all the walkers' routes at once. But today's machines are tiny.</p>
        <p data-at="5" data-out="17.5" class="amber">3 qubits can only tell 8 places apart. So the map has to be shrunk first.</p>
        <p data-at="10" data-out="17.5">It is folded into 8 neighborhoods, and each gets a 3-digit code, like a postal code: 000 to 111.</p>`,
      `<p data-at="18">Each digit is one qubit: q2, q1 and q0, read left to right. A bright qubit is a 1.</p>
        <p class="note" data-at="21">A qubit is a quantum bit. L qubits address 2^L places, one per basis state: 3 qubits give 2 × 2 × 2 = 8. Each walker needs its own 3 qubits.</p>`)}`,
    cut: `<h2 data-at="0.6">Cutting the map</h2>
      ${turns(`<p data-at="1.2" data-out="33.5">Here is an example network, made up for this story: ${fmt(E.n)} genes and ${fmt(E.m)} links, with ${word(E.cells)} groups hidden in it. Its genes are never named.</p>
        <ul class="steps">
          ${step(8, 33.5, PURPLE, '1 · First cut', 'split the genes in two, keeping linked genes together: two halves, one digit')}
          ${step(18, 33.5, PURPLE, '2 · Second cut', 'split each half again: four cells, two digits (a square)')}
          ${step(28, 33.5, PURPLE, '3 · Third cut', 'and again: eight cells, three digits (a cube)')}
        </ul>`,
      `<p data-at="34" class="amber">A gene's code is the side it fell on at each cut. Genes that share a code form a cell, at one corner of the cube.</p>
        <p class="note" data-at="36">Each cut is a bisection. The first is the most significant digit (q2), so cells nest: each new cut splits every cell in two. The real run used ${F.run.bits} cuts: ${fmt(F.run.cells)} cells of about ${F.run.genesPerCell} genes; the picture uses 3.</p>
        <p class="credits" data-at="38">The cuts here stand in for the authors' search (a beam search that also favors the toolbox of chapter 7): the network's slowest patterns grouped into ${word(E.cells)} equal cells, then the codes that keep the most links on the cube's edges.${E.purity !== null ? ` It puts ${pct(E.purity)} of genes with their hidden group.` : ''}</p>`)}`,
    coarse: `<h2 data-at="0.6">The coarse operator</h2>
      ${turns(`<p data-at="1.2" data-out="19.5">Now each corner is a cell, and the shrunk map says how much traffic flows between cells: the coarse operator, A_c.</p>
        <p data-at="7" data-out="19.5">A loop at each corner is the traffic that stays inside its cell. An edge joins every two corners, as wide as the traffic between them.</p>
        <p data-at="13" data-out="19.5" class="amber">Cube edges join cells one digit apart. Here they carry ${pct(E.cube)} of the traffic between cells; face and body diagonals, two or three digits apart, the rest.</p>`,
      `<p class="note" data-at="20">A_c = P A Pᵀ: A is the network's adjacency matrix, and P the normalized cell indicators, so A_c is an 8 × 8 table. It is balanced over cells (Sinkhorn), so every row adds up to 1. The walkers move by K = I − A_c: what holds for A_c holds for K.</p>
        <p class="credits" data-at="25">In the real network, at 3 bits, cube edges carry ${RL.cube}% of the coupling between cells.</p>`)}`,
    bricks: `<h2 data-at="0.6">Building blocks</h2>
      ${turns(`<p data-at="1.2" data-out="28.5">Any traffic table can be built from a few kinds of simple moves: Lego bricks of movement, called Pauli strings.</p>
        <ul class="steps">
          ${step(5, 28.5, PURPLE, 'I', 'do nothing: the same loop on every corner')}
          ${step(8, 28.5, PURPLE, 'X₀, X₁, X₂', 'flip one digit: hops along the cube’s edges in one direction')}
          ${step(17, 28.5, RED, 'Z₂', 'a sign by digit: loops of +1 (solid, red) and −1 (dashed, blue)')}
          ${step(20, 28.5, PURPLE, 'Z₂X₁', 'hops with signs')}
          ${step(23, 28.5, PURPLE, 'X₂X₁, Y₂Y₁', 'flip two digits at once: face diagonals (Y with signs)')}
        </ul>`,
      `<p data-at="29">Any traffic table is a recipe of these bricks, the way a sound is a mix of pure tones.</p>
        <p data-at="33" class="amber">Here they are added largest first, and the rebuilt cube comes close to the true one: after ten bricks the error left is ${f2(E.err10)}, down from 1.</p>
        <p class="note" data-at="40">A Pauli string puts one Pauli matrix on each qubit: I (do nothing), X (flip the bit), Z (+1 on 0, −1 on 1) or Y (flip with a sign). Subscripts are qubits; q2 is the first cut. Any 8 × 8 table is one weighted sum of the 64 strings. Here: ${esc(E.top.join(', '))} …</p>
        <p class="credits" data-at="46">In the real network the largest weights are ${esc(RL.weights.join(', '))}, and a tail.</p>`)}`,
    toolbox: `<h2 data-at="0.6">The toolbox</h2>
      ${turns(`<p data-at="1.2" data-out="22.5">A quantum computer runs some moves quickly and others hardly at all.</p>
        <p data-at="4" data-out="22.5" class="amber">Keep only the bricks in its quick toolbox, a Lie algebra; the rest goes gray and is dropped.</p>
        <p data-at="9" data-out="22.5">What is dropped is the residual: 0 means nothing lost, 1 everything. Here it is ${f2(E.res7)} with three qubits.</p>
        <p class="note" data-at="15" data-out="22.5">The toolbox: the TFIM chain's moves (X on each qubit, ZZ on neighbors) close to ${F.alg.tfim.label}, ${F.alg.tfim.dim} strings at 3 qubits; Z on q2 as well gives ${F.alg.odd.label}, ${F.alg.odd.dim} strings. Closed means the commutators of its strings stay inside, so its operators run as short circuits. Residual = ‖A₀ − ΠA₀‖ / ‖A₀‖, with A₀ the traceless part and Π the projection onto the algebra.</p>`,
      `<p data-at="23">In the real network, every extra bit makes the fit worse.</p>
        <p data-at="28" class="amber">Our cuts lose ${f2(RL.ours(2))} at 2 bits, ${f2(RL.ours(3))} at 3 and ${f2(RL.ours(4))} at 4, where random cuts lose ${f2(RL.rand(2))}, ${f2(RL.rand(3))} and ${f2(RL.rand(4))}. At 8 bits ours lose ${f2(RL.ours(8))} (the best variant ${f2(RL.best8)}): most of the operator falls outside the toolbox.</p>
        <p data-at="38">The example network, computed here: ${ex[0]} at 1 bit, ${ex[1]} at 2 and ${ex[2]} at 3 (random cuts: ${rd[1]} at 2, ${rd[2]} at 3).</p>
        <p class="note" data-at="41">At 1 bit every cut loses nothing. In the real network at 3 bits, ${F.alg.odd.label}'s generators carry ${RL.so7.gens}% of A_c's traceless weight, and the whole algebra ${RL.so7.whole}%.</p>`)}`,
    circuit: `<h2 data-at="0.6">The recipe as a circuit</h2>
      ${turns(`<p data-at="1.2" data-out="16.5">What is kept runs as a short circuit: six gates on three qubits, each a small turn.</p>
        <p data-at="4" data-out="16.5" class="amber">Red gates flip (X), blue gates add signs (Z); the deeper the color, the larger the turn.</p>
        <p class="note" data-at="8" data-out="16.5">One Trotter step of e^(−iKt) at 3 bits in ${F.alg.odd.label}, with the real network's angles: ${esc(gatesText(RL.gates))}. θ = −2ct, with c = tr(P A_c)/8 and R_P(θ) = exp(−iθP/2), t = 1.</p>`,
      `<p data-at="17">From thousands of genes to 8 cells on 3 qubits, and from a traffic table to a few bricks a quantum computer runs well.</p>
        <p data-at="20" class="amber">Next: more qubits need larger toolboxes or better cuts, and then the patients' data, V, go in.</p>
        <p data-at="23">Method and figures: Joel Hancock.</p>
        <p data-at="24"><button class="btn primary" id="btnGoExplore" type="button">Explore the cube</button></p>
        <p class="credits" data-at="25">The networks shown are examples, computed here; numbers marked "real network" are from the authors' run on ${esc(F.source)}. The cuts here stand in for their beam search, and the valleys are illustrative.</p>`)}`,
  };

  const story = $('#story');
  story.innerHTML = CH.map(c => `<section class="ch" data-ch="${c.key}">${html[c.key]}</section>`).join('');
  CH.forEach(c => {
    const sec = story.querySelector(`[data-ch="${c.key}"]`);
    ST.items.push({ sec, ch: c, els: Array.from(sec.querySelectorAll('[data-at]')).map(el => ({
      el, at: c.a + parseFloat(el.dataset.at), out: el.dataset.out ? c.a + parseFloat(el.dataset.out) : c === CH[CH.length - 1] ? Infinity : c.b - 0.05, o: -1 })),
      grow: [] });
  });

  // ------------------------------------------------------------ timeline keys
  const wp = [];
  // a camera waypoint at time t: a set's named view, turned by spin degrees, optionally nudged
  const cam = (t, k, name, spin, ease, nudge) => {
    const v = view(k, name);
    v[0] += spin || 0;
    if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0;
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name)]);
  };
  start({ pairs_genes: 0, pairs_grid: 0, pairs_map: 0, pairs_walk: 0, pairs_valley: 0, pairs_settle: 0, pairs_chip: 0, pairs_fold: 0, pairs_code: 0,
    cube_net: NETI, cube_cut: 0, cube_genes: 0, cube_bits: 0, cube_ac: 0, cube_bricks: 0, cube_lesson: 0, cube_build: 0, cube_sum: 0, cube_alg: 0,
    cube_keep: 0, cube_algebra: 1, cube_focus: -1,
    chart_plot: 1, chart_grow: 0, chart_rand: 1, chart_best: 1, chart_ex: 0, chart_circuit: 0, chart_gates: 0, chart_run: 1, chart_src: 0 });
  let a, b;
  // Looking for pairs: a few genes, then the grid of all their pairs growing until it fills the view
  a = C.title.a; b = C.title.b;
  show('pairs', 0.2, 2);
  ramp('pairs_genes', a + 1, a + 3, 0, 1);
  ramp('pairs_grid', a + 6, a + 24, 0, 1);
  cam(a, 'pairs', 'grid', -10);
  cam(b - 1, 'pairs', 'grid', 8, 'spin');
  // Two walkers on a map: the example network as a city map, two walkers, the valleys (illustrative), where they settle
  a = C.walkers.a; b = C.walkers.b;
  ramp('pairs_map', a, a + 4, 0, 1);
  ramp('pairs_walk', a + 5, a + 7, 0, 1);
  ramp('pairs_valley', a + 14, a + 18, 0, 1);
  ramp('pairs_settle', a + 22, a + 28, 0, 1);
  cam(a + 1.5, 'pairs', 'map', -8);
  cam(a + 13, 'pairs', 'map', 6, 'spin');
  cam(a + 19, 'pairs', 'walkers', -4);
  cam(b - 0.5, 'pairs', 'walkers', 8, 'spin');
  // Why shrink the map?: the chip with three qubits; the map folds into eight neighborhoods, each one's code on the chip
  a = C.shrink.a; b = C.shrink.b;
  ramp('pairs_walk', a, a + 3, 1, 0); ramp('pairs_valley', a, a + 3, 1, 0); ramp('pairs_settle', a, a + 1, 1, 0);
  ramp('pairs_chip', a + 2, a + 6, 0, 1);
  ramp('pairs_fold', a + 10, a + 18, 0, 1);
  for (let c = 0; c < 8; c++) jump('pairs_code', a + 18 + 1.1 * c, c, c + 1);
  jump('pairs_code', a + 27, 8, 0);
  cam(a + 1.5, 'pairs', 'chip', -6);
  cam(a + 9, 'pairs', 'chip', 6, 'spin');
  cam(a + 13, 'pairs', 'hoods', -4);
  cam(b - 0.5, 'pairs', 'hoods', 6, 'spin');
  // Cutting the map: the example network in 3D, cut in two, four and eight (each gene flies to its corner)
  a = C.cut.a; b = C.cut.b;
  hide('pairs', a, a + 3);
  show('cube', a + 0.5, a + 3);
  jump('cube_genes', a, 0, 1);
  ramp('cube_bits', a + 8, a + 14, 0, 1);
  ramp('cube_bits', a + 18, a + 24, 1, 2);
  ramp('cube_bits', a + 28, a + 34, 2, 3);
  cam(a + 1, 'cube', 'genes', -14);
  cam(b - 0.5, 'cube', 'genes', 24, 'spin');
  // The coarse operator: the genes gather into their corners and A_c grows on the cube
  a = C.coarse.a; b = C.coarse.b;
  ramp('cube_ac', a, a + 8, 0, 1);
  cam(a + 3, 'cube', 'default', -8);
  cam(a + 12, 'cube', 'cube', -2);
  cam(b - 0.5, 'cube', 'cube', 10, 'spin');
  // Building blocks: the gallery of the reference figure's strings, each shown on the big cube in turn; then the
  // network's ten largest, added one by one while the error left shrinks
  a = C.bricks.a; b = C.bricks.b;
  jump('cube_lesson', a, 0, 1);
  ramp('cube_bricks', a, a + 4, 0, 1);
  let f0 = -1;
  ['I', 'X0', 'X1', 'X2', 'Z2', 'Z2X1', 'X2X1', 'Y2Y1'].forEach((nm, i) => { const k = Q.parse(nm, 3); jump('cube_focus', a + 5 + 3 * i, f0, k); f0 = k; });
  jump('cube_focus', a + 29, f0, -1);
  ramp('cube_lesson', a + 29, a + 31, 1, 0);
  ramp('cube_build', a + 32, a + 33, 0, 1);
  ramp('cube_sum', a + 34, a + 50, 0, 10);
  cam(a + 1.5, 'cube', 'bricks', -4);
  cam(a + 27, 'cube', 'bricks', 3, 'spin');
  cam(a + 31, 'cube', 'bricks', -3);
  cam(b - 0.5, 'cube', 'bricks', 3, 'spin');
  // The toolbox: strings outside the algebra go gray, the cube keeps only those inside (the residual); then the real
  // run's residual by depth, ours against random, and the example network's
  a = C.toolbox.a; b = C.toolbox.b;
  ramp('cube_alg', a + 2, a + 5, 0, 1);
  ramp('cube_keep', a + 9, a + 15, 0, 1);
  hide('cube', a + 23, a + 26);
  show('chart', a + 23, a + 26);
  ramp('chart_grow', a + 27, a + 37, 0, 1);
  ramp('chart_ex', a + 38, a + 40, 0, 1);
  cam(a + 1, 'cube', 'bricks', -3);
  cam(a + 21, 'cube', 'bricks', 4, 'spin');
  cam(a + 25, 'chart', 'chart', -8);
  cam(b - 0.5, 'chart', 'chart', 6, 'spin');
  // The recipe as a circuit: six gates on three wires, in time order
  a = C.circuit.a; b = C.circuit.b;
  ramp('chart_plot', a, a + 2, 1, 0);
  ramp('chart_circuit', a, a + 3, 0, 1);
  ramp('chart_gates', a + 3, a + 13, 0, 6);
  cam(a + 2, 'chart', 'circuit', -4);
  cam(b, 'chart', 'circuit', 8, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  a = C.walkers.a;
  label('pairs', 'map', '<b>The example network</b> · as a map', a + 1.5, a + 12, 'cyn');
  a = C.coarse.a;
  label('cube', [0.12, 0.8, 0], '<b>A_c</b> · the traffic between cells', a + 6, C.coarse.b - 0.5, 'cyn');
}
// camera waypoints: [t, az, el, dist, tx, ty, tz, ease, set, narrow factor, FIT's target shift]; 'spin' segments turn at
// a steady pace.
// When the story hands over from one set to another, the new set is turned about its
// vertical axis so that its first view starts where the camera already is: a crossfade
// never swings the camera round. The set keeps that turn while it is on show (setYaw).
function buildCamera(wp) {
  wp.sort((x, y) => x[0] - y[0]);
  const turn = (w, deg) => {
    const r = deg * D2R, x = w[4], z = w[6], f = w[10], fx = f[0], fz = f[2];
    w[1] += deg; w[4] = x * Math.cos(r) + z * Math.sin(r); w[6] = -x * Math.sin(r) + z * Math.cos(r);
    f[0] = fx * Math.cos(r) + fz * Math.sin(r); f[2] = -fx * Math.sin(r) + fz * Math.cos(r);   // (the shift turns with it)
  };
  ST.yaw = [];
  let cur = null, prevAz = null;
  for (const w of wp) {
    if (!cur || w[8] !== cur.k) {
      const d = prevAz === null ? 0 : ((prevAz - w[1]) % 360 + 540) % 360 - 180;
      cur = { k: w[8], t0: w[0], c: Math.abs(d) > 40 ? d : 0 };
      ST.yaw.push(cur);
    }
    turn(w, cur.c);
    prevAz = w[1];
  }
  // keep turning the short way round between views
  let prev = null;
  ST.wp = wp.map(w => {
    let az = w[1];
    if (prev !== null) az += 360 * Math.round((prev - az) / 360);
    prev = az;
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7], w[9] || 1, w[10]];
  });
}
// the turn a set has at story time t: that of its latest stay on show (it starts fading in a little before its first view)
// (the tissue and the slide share one turn: one frame)
function setYaw(k, t) {
  let c = 0;
  const f = frameOf(k);
  for (const y of ST.yaw) if (y.k === f && y.t0 - 6 <= t) c = y.c;
  return c;
}
// 0..1 progress over a segment of length D: smoothstep, or for 'spin' segments a steady
// slow turn with short eased starts and stops (trapezoidal speed profile)
const smoothSeg = (t, D) => smooth(t / D);
function spinEase(t, D) {
  const r = Math.min(2.5, D / 3);
  if (t <= 0) return 0;
  if (t >= D) return 1;
  const v = 1 / (D - r); // cruise speed so the ramps plus cruise cover 0..1
  if (t < r) return v * t * t / (2 * r);
  if (t > D - r) return 1 - v * (D - t) * (D - t) / (2 * r);
  return v * (t - r / 2);
}
// the story's view at time t: [az, el, dist, tx, ty, tz, narrow factor, and FIT's target shift x, y, z]
function storyCam(t) {
  const wp = ST.wp, end = w => [w[1], w[2], w[3], w[4], w[5], w[6], w[8], ...w[9]];
  if (t <= wp[0][0]) return end(wp[0]);
  for (let i = 1; i < wp.length; i++) {
    if (t <= wp[i][0]) {
      const p = wp[i - 1], q = wp[i], x = q[0] > p[0] ? (q[7] === 'spin' ? spinEase : smoothSeg)(t - p[0], q[0] - p[0]) : 1, f = p[9], g = q[9];
      return [p[1] + (q[1] - p[1]) * x, p[2] + (q[2] - p[2]) * x, Math.exp(Math.log(p[3]) + (Math.log(q[3]) - Math.log(p[3])) * x),
        p[4] + (q[4] - p[4]) * x, p[5] + (q[5] - p[5]) * x, p[6] + (q[6] - p[6]) * x, p[8] + (q[8] - p[8]) * x,
        f[0] + (g[0] - f[0]) * x, f[1] + (g[1] - f[1]) * x, f[2] + (g[2] - f[2]) * x];
    }
  }
  return end(wp[wp.length - 1]);
}

// ---------------------------------------------------------------- labels --
// Story labels are pinned to a set's anchor for a stretch of story time; each
// set also brings its own labels, shown whenever its params call for them.
const LBL = { story: ST.labels, sets: [], extra: [] };
function labelEl(html, cls) {
  const el = document.createElement('div');
  el.className = 'lbl ' + (cls || '');
  el.innerHTML = html;
  el.style.opacity = 0;
  $('#labels').appendChild(el);
  return el;
}
function label(set, at, html, tIn, tOut, cls) {
  if (typeof at === 'string' && (GL.sets[set].labels || []).some(L => L.at === at)) return; // the set labels this point itself
  ST.labels.push({ kind: 'story', el: labelEl(html, cls), set, at, tIn, tOut, o: -1 });
}
// a label's rest after its bold part; a long one (more than a mark such as ' · hub' or ' · 1.2×') gives way on narrow
// screens (placeLabels)
const sfxSpan = r => (!r ? '' : String(r).length > 8 ? `<span class="sx">${esc(r)}</span>` : esc(r));
function buildSetLabels() {
  for (const k of SET_ORDER) for (const L of GL.sets[k].labels || []) {
    // (a label's text may be a function: it follows what the set shows, see labelText)
    const fn = typeof L.text === 'function' ? L.text : null, [b, r] = fn ? fn() : L.text;
    LBL.sets.push({ kind: 'set', el: labelEl(`<b>${esc(b)}</b>${sfxSpan(r)}`, L.cls), set: k, at: L.at, alpha: L.alpha, minor: !!L.minor, o: -1,
      fn, tx: fn ? b + '|' + r : '', none: !b && !r });
  }
}
// a label whose text is a function (the gallery's weights, the grid's count, the gate angles) is read again while it
// shows and redrawn when it changes: the HTML label, and the headset's sprite (dropped, so it is made again)
function labelText(L) {
  if (!L.fn) return;
  const [b, r] = L.fn(), s = b + '|' + r;
  if (s === L.tx) return;
  L.tx = s; L.none = !b && !r;
  L.el.innerHTML = `<b>${esc(b)}</b>${sfxSpan(r)}`;
  L.w = 0; L.nar = undefined; dropSprite(L);
}
// a set label shows as far as its set is in and its own rule allows
// (labels a set marks as minor give way on narrow screens)
const setLabelAlpha = (L, S) => {
  const a = S[L.set + '_a'] || 0;
  if (a < 0.5 || (L.minor && !GL.wide && !XR.on)) return 0;
  const v = (2 * a - 1) * clamp(L.alpha ? L.alpha(S) : 1, 0, 1);
  if (v > 0) labelText(L);
  return L.none ? 0 : v;
};
// where a label points, in the world's own coordinates
const _v = new THREE.Vector3();
function labelPos(L, out) {
  const p = anchorOf(L.set, L.at);
  return out.set(p[0], p[1], p[2]).applyMatrix4(GL.sets[L.set].group.matrix);
}
// labels on screen: pinned next to their point, nudged down where they would overlap, and
// kept clear of the side panel, the timeline and the edge of the screen
const _placed = [];
function placeLabels(list, alphaOf) {
  _placed.length = 0;
  const vis = [], W = window.innerWidth, H = window.innerHeight;
  const pr = $('#panel').getBoundingClientRect(), barTop = $('#bar').getBoundingClientRect().top || H;
  for (const L of list) {
    let o = Math.round(alphaOf(L) * 100) / 100, x = 0, y = 0;
    if (o > 0) {
      labelPos(L, _v).applyMatrix4(GL.world.matrixWorld).project(GL.camera);
      if (_v.z > 1 || Math.abs(_v.x) > 1.2 || Math.abs(_v.y) > 1.2) o = 0;
    }
    if (o > 0) {
      // (on a narrow screen a label's long rest is left out: the panel says it, and the scene there is small)
      if (L.nar !== !GL.wide) { L.nar = !GL.wide; const sx = L.el.querySelector('.sx'); if (sx) sx.style.display = L.nar ? 'none' : ''; L.w = 0; }
      if (!L.w) { L.w = L.el.offsetWidth || 120; L.h = L.el.offsetHeight || 22; }
      const sx = (_v.x * 0.5 + 0.5) * W;
      x = sx + 9; y = (-_v.y * 0.5 + 0.5) * H - 11;
      if (pr.width && y + L.h > pr.top && y < pr.bottom && x < pr.right + 6) {
        // a point just beside the panel keeps its label next to the panel; one behind it shows none
        if (GL.wide && sx > pr.right - 40) x = pr.right + 6; else o = 0;
      }
      if (y + L.h > barTop - 4 || y < 50) o = 0;
      x = Math.max(6, Math.min(x, W - L.w - 6));
    }
    if (o !== L.o) { L.el.style.opacity = o; L.o = o; }
    if (o <= 0) continue;
    vis.push([L, x, y]);
  }
  vis.sort((p, q) => p[2] - q[2]);
  for (const [L, x, y0] of vis) {
    let y = y0;
    for (let pass = 0; pass < 6; pass++) {
      const hit = _placed.find(r => x < r[0] + r[2] && r[0] < x + L.w && y < r[1] + r[3] && r[1] < y + L.h);
      if (!hit) break;
      y = hit[1] + hit[3] + 2;
    }
    _placed.push([x, y, L.w, L.h]);
    L.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
}

// ------------------------------------------------------------ panel update --
let curCh = null;
function updateStoryDOM(t) {
  const c = CH.find(c => t >= c.a && t < c.b) || CH[CH.length - 1];
  if (c !== curCh) {
    ST.items.forEach(it => it.sec.classList.toggle('on', it.ch === c));
    curCh = c;
    $('#panel').scrollTop = 0;
  }
  const it = ST.items.find(x => x.ch === c);
  let fresh = null;
  for (const e of it.els) {
    const o = Math.round(fadeVal(t, e.at, e.out, 0.6) * 100) / 100;
    if (o !== e.o) {
      if (e.o <= 0 && o > 0 && !e.el.classList.contains('credits')) fresh = e.el;
      e.el.style.opacity = o; e.o = o; e.el.style.visibility = o > 0 ? 'visible' : 'hidden';
    }
  }
  // on a short (phone) panel, scroll just far enough that a line that has just appeared is not below the fold
  if (fresh) {
    const p = $('#panel'), pr = p.getBoundingClientRect(), over = fresh.getBoundingClientRect().bottom - (pr.bottom - parseFloat(getComputedStyle(p).paddingBottom));
    if (over > 0) {
      // (a chapter's heading is shown whole or scrolled out of sight, never cut in half)
      const h = it.sec.querySelector('h1, h2'), hr = h && h.getBoundingClientRect(), edge = pr.top + p.clientTop + over;
      p.scrollTo({ top: p.scrollTop + over + (hr && hr.top < edge && hr.bottom > edge ? hr.bottom - edge + 4 : 0), behavior: 'smooth' });
    }
  }
  if (c.key === 'title') {
    const arc = $('#titleArc');
    if (arc) { arc.setAttribute('stroke-dashoffset', (1 - smooth((t - 0.5) / 2.2)).toFixed(3)); $('#titleDot').setAttribute('opacity', smooth((t - 2.5) / 0.4)); }
  }
}

// ------------------------------------------------------------- timeline UI --
function buildTimeline() {
  const tr = $('#track');
  tr.innerHTML = '<div class="rail"></div><div class="done"></div>' + CH.slice(1).map(c =>
    `<div class="tick" data-k="${c.key}" style="left:${(100 * c.na / T_END).toFixed(2)}%"></div><div class="name" data-k="${c.key}" style="left:${(100 * c.na / T_END).toFixed(2)}%">${c.name}</div>`).join('') + '<div class="knob"></div>';
  tr.setAttribute('aria-valuemax', Math.round(T_END));
  const seekAt = ev => {
    const r = tr.getBoundingClientRect();
    APP.seek(clamp((ev.clientX - r.left) / r.width, 0, 1) * T_END);
  };
  let drag = false;
  tr.addEventListener('pointerdown', ev => { drag = true; tr.setPointerCapture(ev.pointerId); seekAt(ev); });
  tr.addEventListener('pointermove', ev => { if (drag) seekAt(ev); });
  tr.addEventListener('pointerup', () => { drag = false; });
  tr.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowRight') { APP.seek(APP.t + 5); ev.preventDefault(); }
    if (ev.key === 'ArrowLeft') { APP.seek(APP.t - 5); ev.preventDefault(); }
  });
  $('#play').addEventListener('click', () => APP.togglePlay());
  // slideshow: Next and this story's switch, in the shell's row at the foot of the panel (an older shell has none)
  if ($('#slides')) { $('#btnNext').addEventListener('click', slideNext); $('#btnSlides').addEventListener('click', slideToggle); }
  if ($('#btnNextBar')) $('#btnNextBar').addEventListener('click', slideNext);   // Next beside Play (phones)
}
const ICON_PLAY = '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 16 16"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>';
let lastTick = -1;
function updateTimeline(t, playing) {
  const p = (100 * t / T_END).toFixed(2);
  if (p !== lastTick) {
    $('#track .done').style.width = p + '%';
    $('#track .knob').style.left = p + '%';
    $('#track').setAttribute('aria-valuenow', Math.round(t));
    const m = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    $('#clock').textContent = m(t) + ' / ' + m(T_END);
    const c = CH.find(c => t >= c.na && t < c.nb) || CH[CH.length - 1];
    document.querySelectorAll('#track .name').forEach(n => n.classList.toggle('cur', n.dataset.k === c.key));
    lastTick = p;
  }
  const want = playing ? 'pause' : 'play';
  const btn = $('#play');
  if (btn.dataset.s !== want) { btn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY; btn.dataset.s = want; btn.setAttribute('aria-label', playing ? 'Pause' : 'Play'); }
  slideDOM();
}
