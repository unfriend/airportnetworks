//#use head
// ================================================================== STORY ==
// Narration timing: [time in the recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands on
// the matching sentence. The story is narrated by a synthetic voice
// (audio/narration-qubits.mp3, Kokoro's af_heart): node tools/voice/narrate.mjs
// qubits writes this table and NARRATION_ENDS from the recording it makes (each
// stretch lasts the longer of 1.1 times its story time and its line's audio
// plus a pause); run it again after the text changes (see
// tools/voice/README.md).
const NARRATION_SYNC = [
  [0, 0], [1.32, 1.2], [3.69, 2.4], [4.35, 3], [7.54, 4], [12.45, 6.5], [20.64, 12], [21.3, 12.6],
  [24.79, 13.5], [28.15, 16], [35.41, 22.6], [57.93, 29.3],  // Pairs
  [58.7, 30], [60, 31.18], [61.94, 31.2], [68.86, 35], [90.42, 54.6], [109.79, 61.3],  // Walkers
  [110.56, 62], [111.86, 63.18], [113.65, 63.2], [120.02, 67], [125.66, 72], [135.12, 80],
  [135.78, 80.6], [142.88, 83], [155.91, 89.3],       // Shrink
  [156.68, 90], [157.98, 91.18], [159.6, 91.2], [171.92, 98], [193.92, 118], [200.54, 124],
  [201.2, 124.6], [208.49, 126], [209.15, 126.6], [225.7, 129.3],  // Cuts
  [226.47, 130], [227.77, 131.18], [229.67, 131.2], [237.53, 137], [246.73, 143], [259.74, 150],
  [260.4, 150.6], [282.02, 159.3],                    // Coarse
  [282.79, 160], [284.09, 161.18], [285.82, 161.2], [292.96, 165], [296.51, 168], [307.07, 177.6],
  [313.93, 180], [317.23, 183], [324.94, 189], [330.99, 193], [341.3, 200], [341.96, 200.6],
  [374.57, 214.3],                                    // Bricks
  [375.34, 215], [376.64, 216.18], [378.28, 216.2], [382.92, 219], [389.53, 224], [398.95, 230],
  [399.61, 230.6], [430.74, 238], [436.9, 243.6], [458.86, 253], [459.52, 253.6], [474.62, 256],
  [475.28, 256.6], [487.26, 261.3],                   // Toolbox
  [488.03, 262], [489.33, 263.18], [491.57, 263.2], [497.47, 266], [503.52, 270], [514.08, 279.6],
  [521.88, 282], [522.54, 282.6], [528.86, 285], [534.36, 290],  // Circuit
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { title: 57.7, walkers: 109.55, shrink: 155.7, cut: 225.5, coarse: 281.8, bricks: 374.35, toolbox: 487.05, circuit: 531.45 };
//#use storyT narrT T_END
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
// the engine's own params beside the sets' (DEF): none here; none keyed at an even pace or on a log scale (evalTrack)
const DEF_MORE = {}, LIN = new Set(), LOG = new Set();
//#use C DEF buildDefaults TR key ramp evalTrack storyState fadeVal ST view fitShift
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
//#use narrowOf anchorOf
// ------------------------------------------------------------------- data --
// The maths (QMATH) on the story's example network, and the real run's numbers (QUBITS_DATA), looked up once for the
// story and the panes. The example's numbers are computed here, never typed in; the real run's are used only where
// the text says "in the real network".
const Q = QMATH, QD = QUBITS_DATA;
const NETI = Math.max(0, Q.NETS.findIndex(n => n.key === Q.DEFAULT));   // the story's network (cube_net)
const SUBS = '₀₁₂₃₄₅₆₇₈₉';
const sub = nm => String(nm).replace(/\d/g, d => SUBS[d]);   // 'X2X1' -> 'X₂X₁'
//#use f2
const f3s = v => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(3);   // an angle with its sign
const pct = v => (Number.isFinite(+v) ? `${Math.round(100 * v)}%` : '–');
//#use word listOf
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
//#use inkCol swCol
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
      <p class="lede" data-at="2.4">How a gene network fits on a tiny quantum computer</p>
      ${turns(`<p data-at="4" data-out="21.5">Some diseases only appear when two genes are broken at the same time.</p>
        <p data-at="6.5" data-out="21.5">The dots on the diagonal are genes, and every dot above them is a pair. Add genes, and the pairs grow much faster.</p>
        <div class="facts"><div data-at="12" data-out="21.5"><b>${fmt(F.genes)}</b><small>genes in the real network</small></div><div data-at="13.5" data-out="21.5"><b>${F.pairsM} million</b><small>pairs of them</small></div></div>
        <p data-at="16" data-out="21.5" class="amber">Far too many to test one by one.</p>`,
      `<p class="note" data-at="22">n genes make n times n minus 1 over 2 pairs, so ${fmt(F.genes)} times ${fmt(F.genes - 1)} over 2 is ${fmt(F.pairs)}. The real network takes the physical protein interactions in ${esc(F.source)} with a combined score of ${F.score} or more, and keeps the largest connected component.</p>
        <p class="credits" data-at="26">After the method and figures of Joel Hancock. The networks drawn are examples, computed here.</p>`)}`,
    walkers: `<h2 data-at="0.6">Two walkers on a map</h2>
      ${turns(`<p data-at="1.2" data-out="20.5">Think of the network as a map. Each gene is a place, and a street joins two genes whose proteins touch.</p>
        <p data-at="5" data-out="20.5">Two walkers wander it, one for each gene of a pair.</p>
        <p data-at="14" data-out="20.5" class="amber">They are drawn to pairs that are broken together in patients more often than in healthy people.</p>`,
      `<p data-at="21" class="amber">Where they settle is where to look.</p>
        <p class="note" data-at="24">In symbols, the walkers' energy H is K plus c V plus ρ R. K, which is I minus A_c, lets them move along the network, and A_c comes later. V rewards the pairs that patients' data point to. R, the exchange operator, swaps the two walkers, so the search is for pairs, not single genes.</p>
        <p class="credits" data-at="28">The valleys here are illustrative: this story uses no patients' data.</p>`)}`,
    shrink: `<h2 data-at="0.6">Why shrink the map?</h2>
      ${turns(`<p data-at="1.2" data-out="17.5">A quantum computer could explore all the walkers' routes at once. But today's machines are tiny.</p>
        <p data-at="5" data-out="17.5" class="amber">3 qubits can only tell 8 places apart. So the map has to be shrunk first.</p>
        <p data-at="10" data-out="17.5">It is folded into 8 neighborhoods, and each gets a 3-digit code, like a postal code, from 000 to 111.</p>`,
      `<p data-at="18">Each digit is one qubit: q2, q1 and q0, read left to right. A bright qubit is a 1.</p>
        <p class="note" data-at="21">A qubit is a quantum bit. L qubits address 2 to the power L places, one per basis state, so 3 qubits give 2 times 2 times 2, which is 8. Each walker needs its own 3 qubits.</p>`)}`,
    cut: `<h2 data-at="0.6">Cutting the map</h2>
      ${turns(`<p data-at="1.2" data-out="33.5">Here is an example network, made up for this story. It has ${fmt(E.n)} genes and ${fmt(E.m)} links, with ${word(E.cells)} groups hidden in it. Its genes are never named.</p>
        <ul class="steps">
          ${step(8, 33.5, PURPLE, '1 · First cut', 'split the genes in two, keeping linked genes together: two halves, told apart by one digit')}
          ${step(18, 33.5, PURPLE, '2 · Second cut', 'split each half again: four cells on a square, told apart by two digits')}
          ${step(28, 33.5, PURPLE, '3 · Third cut', 'split every cell again: eight cells on a cube, told apart by three digits')}
        </ul>`,
      `<p data-at="34" class="amber">A gene's code is the side it fell on at each cut. Genes that share a code form a cell, at one corner of the cube.</p>
        <p class="note" data-at="36">Each cut is a bisection. The first cut sets the most significant digit, q2, so cells nest: each new cut splits every cell in two. The real run used ${F.run.bits} cuts, which give ${fmt(F.run.cells)} cells of about ${F.run.genesPerCell} genes each; the picture uses 3.</p>
        <p class="credits" data-at="38">The cuts here stand in for the authors' search (a beam search that also favors the toolbox of chapter 7): the network's slowest patterns grouped into ${word(E.cells)} equal cells, then the codes that keep the most links on the cube's edges.${E.purity !== null ? ` It puts ${pct(E.purity)} of genes with their hidden group.` : ''}</p>`)}`,
    coarse: `<h2 data-at="0.6">The coarse operator</h2>
      ${turns(`<p data-at="1.2" data-out="19.5">Now each corner is a cell, and the shrunk map says how much traffic flows between cells: the coarse operator, A_c.</p>
        <p data-at="7" data-out="19.5">A loop at each corner is the traffic that stays inside its cell. An edge joins every two corners, as wide as the traffic between them.</p>
        <p data-at="13" data-out="19.5" class="amber">Cube edges join cells one digit apart. Here they carry ${pct(E.cube)} of the traffic between cells, and face and body diagonals, which join cells two or three digits apart, carry the rest.</p>`,
      `<p class="note" data-at="20">A_c is P A P transposed, where A is the network's adjacency matrix and P holds the normalized cell indicators, so A_c is an 8 by 8 table. It is balanced over cells by Sinkhorn's method, so every row adds up to 1. The walkers move by K, which is I minus A_c, so what holds for A_c holds for K.</p>
        <p class="credits" data-at="25">In the real network, at 3 bits, cube edges carry ${RL.cube}% of the coupling between cells.</p>`)}`,
    bricks: `<h2 data-at="0.6">Building blocks</h2>
      ${turns(`<p data-at="1.2" data-out="28.5">Any traffic table can be built from a few kinds of simple moves: Lego bricks of movement, called Pauli strings.</p>
        <ul class="steps">
          ${step(5, 28.5, PURPLE, 'I', 'do nothing, the same loop on every corner')}
          ${step(8, 28.5, PURPLE, 'X₀, X₁, X₂', 'flip one digit, hopping along the cube’s edges in one direction')}
          ${step(17, 28.5, RED, 'Z₂', 'a sign set by one digit, with solid red loops of plus 1 and dashed blue loops of minus 1')}
          ${step(20, 28.5, PURPLE, 'Z₂X₁', 'hops with signs')}
          ${step(23, 28.5, PURPLE, 'X₂X₁, Y₂Y₁', 'flip two digits at once, along face diagonals, and Y adds signs')}
        </ul>`,
      `<p data-at="29">Any traffic table is a recipe of these bricks, the way a sound is a mix of pure tones.</p>
        <p data-at="33" class="amber">Here they are added largest first, and the rebuilt cube comes close to the true one: after ten bricks the error left is ${f2(E.err10)}, down from 1.</p>
        <p class="note" data-at="40">A Pauli string puts one Pauli matrix on each qubit. I does nothing, X flips the bit, Z gives plus 1 on 0 and minus 1 on 1, and Y flips with a sign. Subscripts are qubits, and q2 is the first cut. Any 8 by 8 table is one weighted sum of the 64 strings. Here the largest weights are ${esc(E.top.join(', '))}, and so on.</p>
        <p class="credits" data-at="46">In the real network the largest weights are ${esc(RL.weights.join(', '))}, and a tail.</p>`)}`,
    toolbox: `<h2 data-at="0.6">The toolbox</h2>
      ${turns(`<p data-at="1.2" data-out="22.5">A quantum computer runs some moves quickly and others hardly at all.</p>
        <p data-at="4" data-out="22.5" class="amber">Keep only the bricks in its quick toolbox, called a Lie algebra; the rest goes gray and is dropped.</p>
        <p data-at="9" data-out="22.5">What is dropped is the residual: 0 means nothing is lost, and 1 means everything is. Here it is ${f2(E.res7)} with three qubits.</p>
        <p class="note" data-at="15" data-out="22.5">The toolbox: the moves of the TFIM chain, a transverse-field Ising model, are X on each qubit and ZZ on neighbors, and they close into ${F.alg.tfim.label}, with ${F.alg.tfim.dim} strings at 3 qubits; adding Z on q2 gives ${F.alg.odd.label}, with ${F.alg.odd.dim} strings. Closed means the commutators of its strings stay inside, so its operators run as short circuits. The residual is the norm of A₀ minus its projection onto the algebra, over the norm of A₀, the traceless part.</p>`,
      `<p data-at="23">In the real network, every extra bit makes the fit worse.</p>
        <p data-at="28" class="amber">Our cuts lose ${f2(RL.ours(2))} at 2 bits, ${f2(RL.ours(3))} at 3 and ${f2(RL.ours(4))} at 4, where random cuts lose ${f2(RL.rand(2))}, ${f2(RL.rand(3))} and ${f2(RL.rand(4))}. At 8 bits ours lose ${f2(RL.ours(8))}, and the best variant ${f2(RL.best8)}: most of the operator falls outside the toolbox.</p>
        <p data-at="38">In the example network, computed here, the cuts lose ${ex[0]} at 1 bit, ${ex[1]} at 2 and ${ex[2]} at 3, and random cuts ${rd[1]} at 2 and ${rd[2]} at 3.</p>
        <p class="note" data-at="41">At 1 bit every cut loses nothing. In the real network at 3 bits, ${F.alg.odd.label}'s generators carry ${RL.so7.gens} percent of A_c's traceless weight, and the whole algebra ${RL.so7.whole} percent.</p>`)}`,
    circuit: `<h2 data-at="0.6">The recipe as a circuit</h2>
      ${turns(`<p data-at="1.2" data-out="16.5">What is kept runs as a short circuit: six gates on three qubits, each a small turn.</p>
        <p data-at="4" data-out="16.5" class="amber">Red X gates flip and blue Z gates add signs; the deeper the color, the larger the turn.</p>
        <p class="note" data-at="8" data-out="16.5">This is one Trotter step of e to the minus i K t, at 3 bits in ${F.alg.odd.label}, with the real network's angles on its gates.</p>`,
      `<p data-at="17">From thousands of genes to 8 cells on 3 qubits, and from a traffic table to a few bricks a quantum computer runs well.</p>
        <p data-at="20" class="amber">Next: more qubits need larger toolboxes or better cuts, and then the patients' data, V, go in.</p>
        <p data-at="23">Method and figures: Joel Hancock.</p>
        <p data-at="24"><button class="btn primary" id="btnGoExplore" type="button">Explore the cube</button></p>
        <p class="credits" data-at="25">The networks shown are examples, computed here; numbers marked "real network" are from the authors' run on ${esc(F.source)}. The cuts here stand in for their beam search, and the valleys are illustrative. The circuit's angles in the real network: ${esc(gatesText(RL.gates))}; θ = −2ct, with c = tr(P A_c)/8 and R_P(θ) = exp(−iθP/2), t = 1. Narration: a synthetic voice (Kokoro).</p>`)}`,
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
  hide('cube', a + 21.5, a + 23.5);   // gone before the camera reaches the chart's view (seen from there it crowded the view)
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
  // ---- sound effects (sfxCue: story time, a sound, where it comes from, its options), beside the keys above: a cue just
  // before the line it goes with, textures under the voice soft; sequences from the keys (when a ramp reaches a share)
  const rampAt = (t0, t1, f) => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (smooth(m) < f) lo = m; else hi = m; } return t0 + (t1 - t0) * lo; };
  a = C.title.a;
  sfxCue(a + 1, 'patter', 'pairs', 'genes0', { dur: 2, pitch: 1.3, gain: 0.3 });      // a few genes
  sfxCue(a + 6, 'grow', 'pairs', 'tri', { dur: 12, gain: 0.35 });                    // the grid of all pairs grows
  sfxCue(a + 18, 'rise', 'pairs', 'tri', { dur: 5, gain: 0.6 });                     // until it fills the view
  a = C.walkers.a;
  sfxCue(a + 0.2, 'whoosh', 'pairs', 'map');                                         // the map
  sfxCue(a + 4.8, 'pulse', 'pairs', 'walker0', { seq: true });                       // two walkers set out
  sfxCue(a + 5.4, 'pulse', 'pairs', 'walker1', { pitch: 1.12, seq: true });
  sfxCue(a + 13.8, 'grow', 'pairs', 'valley0', { dur: 4, pitch: 0.6 });              // the valleys (illustrative)
  sfxCue(a + 21.9, 'rise', 'pairs', 'valley1', { dur: 6, pitch: 0.8 });              // where they settle
  a = C.shrink.a;
  sfxCue(a + 2, 'rise', 'pairs', 'chip');                                            // the chip with three qubits
  sfxCue(a + 9.8, 'whoosh', 'pairs', 'map', { dur: 8, pitch: 0.7 });                 // the map folds into eight
  [0, 2, 4, 5, 7, 9, 11, 12].forEach((s, c) => sfxCue(a + 18 + 1.1 * c, 'step', 'pairs', 'hood' + c, { pitch: Math.pow(2, s / 12), gain: 0.5, seq: true }));   // each code, 000 to 111
  a = C.cut.a;
  sfxCue(a + 0.5, 'whoosh', 'cube', 'genes');                                        // the network in 3D
  [8, 18, 28].forEach((s, i) => sfxCue(a + s - 0.2, 'snap', 'cube', 'cut' + (i + 1), { pitch: Math.pow(2, 3 * i / 12) }));   // cut in two, four, eight
  a = C.coarse.a;
  sfxCue(a + 0.3, 'rise', 'cube', 'cube', { dur: 8 });                               // A_c grows on the cube
  a = C.bricks.a;
  for (let i = 0; i < 8; i++) sfxCue(a + 5 + 3 * i, 'clink', 'cube', 'top', { gain: 0.3, pitch: i ? 1 + 0.06 * i : 0.85 });   // each Pauli string in turn
  for (let i = 1; i <= 10; i++) sfxCue(rampAt(a + 34, a + 50, i / 10), 'step', 'cube', 'cube', { pitch: Math.pow(2, i / 12), gain: 0.3, seq: true });   // the ten largest added one by one
  a = C.toolbox.a;
  sfxCue(a + 2, 'snap', 'cube', 'cube', { pitch: 0.7 });                             // strings outside the algebra go gray
  sfxCue(a + 8.8, 'whoosh', 'cube', 'cube', { dur: 6, pitch: 0.8 });                 // the cube keeps only those inside
  sfxCue(a + 22.8, 'whoosh', 'chart', 'chart');                                      // the chart
  sfxCue(a + 27, 'grow', 'chart', 'ours', { dur: 10, pitch: 0.8, gain: 0.35 });      // the residual by depth
  sfxCue(a + 37.8, 'ping', 'chart', 'ex3');                                          // the example's point
  a = C.circuit.a;
  sfxCue(a + 0.2, 'whoosh', 'chart', 'circuit');                                     // the circuit
  RL.gates.forEach((g, i) => sfxCue(rampAt(a + 3, a + 13, i / 6), 'step', 'chart', 'q' + Math.max(...g.qubits), { pitch: Math.pow(2, 4 * Math.max(...g.qubits) / 12) * (g.type === 'RX' ? 1 : 0.84), gain: 0.5, seq: true }));   // six gates, by wire
  sfxCue(a + 14, 'ping', 'chart', 'circuit');                                        // the recipe
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  a = C.walkers.a;
  label('pairs', 'map', '<b>The example network</b> · as a map', a + 1.5, a + 12, 'cyn');
  a = C.coarse.a;
  label('cube', [0.12, 0.8, 0], '<b>A_c</b> · the traffic between cells', a + 6, C.coarse.b - 0.5, 'cyn');
}
// no set turns into another at a hand-over (buildCamera's MORPH)
const MORPH = {};
//#use buildCamera setYaw smoothSeg spinEase storyCam LBL labelEl label sfxSpan buildSetLabels labelText
//#use setLabelAlpha~2 _v labelPos _placed placeLabels curCh updateStoryDOM trackHTML buildTimeline ICON_PLAY ICON_PAUSE
//#use lastTick updateTimeline