
// ================================================================== STORY ==
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Until a narration is recorded, the table sets the
// pace: node tools/pace.mjs writes it from the words on the panel (each stretch
// between two cues lasts long enough to read what appeared at its start; run
// it again after the text changes). A recording replaces it with its own times.
const NARRATION_SYNC = [
  [0, 0], [2.6, 2.4], [5.2, 4], [5.8, 4.6], [10.7, 6.5], [18.3, 13], [19, 13.6], [25.1, 15],
  [31.2, 20.5], [34.5, 23], [35.2, 23.6],             // Letters
  [43.9, 26], [44.5, 26.6], [45.8, 27.2], [71.5, 50.6], [79.4, 51.5], [80, 52.1], [83.2, 52.5],
  [86, 55.1], [101, 57], [101.7, 57.6],               // Family tree
  [110.4, 60], [111, 60.6], [112.3, 61.2], [120.4, 66], [134.7, 79], [143.1, 84], [149.5, 88],
  [150.2, 88.6], [156.3, 91], [156.9, 91.6],          // Qubits
  [170.7, 96], [171.3, 96.6], [172.2, 97.2], [172.8, 97.8], [176.4, 99], [179.8, 102], [184.2, 106],
  [194.8, 113], [202.4, 118], [210.9, 124], [216.4, 128],  // The rule
  [229.6, 134], [230.2, 134.6], [231.1, 135.2], [244.1, 147], [253.8, 154], [261.4, 160.5],
  [270.3, 168.6], [274.8, 170], [275.4, 170.6],       // Machine
  [302.3, 180], [303.6, 181.18], [304.7, 181.2], [334.8, 208.6], [339.7, 209], [344.1, 213],
  [346.6, 215], [347.3, 215.6], [349.1, 216], [349.8, 216.6],  // Pairs
  [368.6, 218], [369.3, 218.6], [370.6, 219.2], [384.7, 232], [391, 236], [400.9, 245], [408.5, 249],
  [409.2, 249.6], [418.7, 253], [419.4, 253.6], [427.2, 256],  // Rebuild
  [443.7, 264], [445, 265.18], [446.1, 265.2], [455.8, 270], [456.5, 270.6], [465.1, 273],
  [465.8, 273.6], [476.2, 278], [476.8, 278.6], [492.7, 280], [494.4, 281.6], [507.3, 282],
  [516.1, 290],                                       // What for
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
  { key: 'title', name: 'Letters', a: 0, b: 26 },
  { key: 'tree', name: 'Family tree', a: 26, b: 60 },
  { key: 'qubits', name: 'Qubits', a: 60, b: 96 },
  { key: 'rule', name: 'The rule', a: 96, b: 134 },
  { key: 'machine', name: 'Machine', a: 134, b: 180 },
  { key: 'pairs', name: 'Pairs', a: 180, b: 218 },
  { key: 'rebuild', name: 'Rebuild', a: 218, b: 264 },
  { key: 'what', name: 'What for', a: 264, b: 290 },
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

const ST = { labels: [], items: [], stand: [] };
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
// (measured at 1280 x 760: each view's parts between the panel's right edge and the screen's, above the timeline; the
// sets' own views fill a whole screen, so most stand back a little and move their target left of the parts' middle)
const FIT = {
  letters: { default: [0, 0, 0.7, -0.22, -0.06, 0], helix: [0, 0, 1.1, -0.17, -0.03, -0.08], peel: [0, 0, 0.6, -0.17, -0.03, 0.02],
    rows: [0, 0, 0.45, -0.32, -0.09, 0.06], qubits: [0, 0, 0.1, -0.13, 0.08, 0], reads: [0, 0, 0.25, -0.22, 0.02, 0] },
  tree: { default: [0, 0, 0.1, -0.26, -0.23, 0.11], grow: [0, 0, 1.4, -0.28, 0.24, 0.09], crown: [0, 0, 0.3, -0.24, -0.3, 0.14],
    pair: [0, 0, 0.5, -0.51, -0.54, 0.53], gears: [0, 0, 1.45, -0.24, 0.02, 0.13], species: [0, 0, 0.65, -0.35, -0.1, 0.12],
    what: [0, 0, 0.1, -0.5, -0.1, 0.08] },
  rule: { default: [0, 0, 0.35, -0.1, -0.12, -0.05], rates: [0, 0, 2.6, -0.32, -0.07, 0.09], pyramid: [0, 0, 0.6, -0.05, -0.13, -0.02],
    path: [0, 0, 0.35, -0.09, -0.12, -0.06], compiler: [0, 0, 0.35, -0.23, 0.16, 0], machine: [0, 0, 1.1, 0.03, 0.05, 0],
    copy: [0, 0, 1.65, 0.37, -0.1, 0], turn: [0, 0, 1.15, -0.18, 0.15, 0.04], circuit: [0, 0, 0.5, -0.2, -0.05, 0], steps: [0, 0, 0.5, -0.15, 0.2, 0] },
  stem: { default: [0, 0, 0.1, -0.2, -0.03, 0.06], strand: [0, 0, 0.45, -0.21, -0.09, 0], fold: [0, 0, 0.1, -0.18, -0.06, 0.05],
    break: [0, 0, 0.3, -0.22, -0.14, 0.1], count: [0, 0, 0.1, -0.61, 0.02, -0.13], cloud: [0, 0, 1.75, -0.63, 0.24, -0.11],
    fields: [0, 0, 1.85, -0.29, 0.8, 0], compare: [0, 0, 1.8, -0.46, 0.23, 0] },
};
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen
const NARROW = {};
const narrowOf = (k, name) => (NARROW[k] && NARROW[k][name]) || 1;
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

// ------------------------------------------------------------------- data --
// The maths (MMATH) on the story's example numbers, and the poster's numbers (MUT_DATA), looked up once for the story
// and the panes. The examples' numbers are computed here, never typed in; the poster's are used only where the text
// says "in the authors' test".
const M = MMATH, D = MUT_DATA, TD = D.test;
const MI = Math.max(0, M.MODELS.findIndex(m => m.key === M.DEFAULT));   // the story's rule (rule_model)
const LET = M.LETTERS, KET = M.KETS;
const f2 = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
const pct = v => (Number.isFinite(+v) ? `${Math.round(100 * v)} %` : '–');
const deg = v => `${Math.round(Math.abs(v) * 180 / Math.PI)}°`;   // how far a turn goes (its size, not its direction)
const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] || String(n);
const listOf = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const swapsN = n => `${n} swap${n === 1 ? '' : 's'}`;
const brokenN = n => (n ? `${n} broken pair${n === 1 ? '' : 's'}` : 'no broken pair');
// a big count in words: 1,048,576 is 'about a million'
const aboutN = n => { const m = Math.round(n / 1e6); return m === 1 ? 'about a million' : m > 1 ? `about ${word(m)} million` : fmt(n); };
// four chances in words: 'A 71 %, C 5 %, G 19 % and T 6 %'
const chancesText = p => listOf(Array.from(p).map((v, i) => `${LET[i]} ${pct(v)}`));
// how far a mix has come from its pure letter towards the long-run mix (the pyramid is an affine picture of the four
// chances, so the share of the distance is the same there)
const wayOf = (p, pi, s) => {
  let d = 0, d0 = 0;
  for (let i = 0; i < 4; i++) { d += (p[i] - pi[i]) ** 2; d0 += ((i === s ? 1 : 0) - pi[i]) ** 2; }
  return 1 - Math.sqrt(d / (d0 || 1));
};
// the arrows of a letter's two qubits, in words
const codeWords = i => [['up', 'up'], ['up', 'down'], ['down', 'up'], ['down', 'down']][i].map((w, k) => `${k ? 'second' : 'first'} ${w}`).join(', ');

// ------------------------------------------------------------------ facts --
// Numbers the story quotes: the examples' computed here, the authors' test's from MUT_DATA
const FACTS = (() => {
  const sw = k => D.fig1.swaps[k].map(([at, a, b]) => `${a}→${b} at letter ${at}`);
  // the letters' mix (the rule's after point 2, from A) and the story's 24 read-outs (seed 1, as letters_reads)
  const mix = Array.from(M.path(MI, 0, M.POINTS[1])), reads = [0, 0, 0, 0], nReads = 24;
  for (let k = 1; k <= nReads; k++) reads[M.sample(mix, 1, k)]++;
  const pi = Array.from(M.pi(MI)), r = M.MODELS[MI].r, top = pi.indexOf(Math.max(...pi));
  // the family tree (seed 1, the story's speed): its long and short branch
  const tr = M.familyTree(1, 1), L = tr.branches[tr.highlight.long], S = tr.branches[tr.highlight.short];
  // the machine as the story shows it at the end of its turn: parent G after 1 swap per letter
  const par = 2, t = 1, a = M.angles(MI, t), circ = M.circuit(MI, t), simple = circ.gates.filter(g => g.type === 'MRY').flatMap(M.decompose);
  // the count: how many letters the story links at most (ten), and the pairs that hold (each once: A–T, C–G, G–T)
  const TEN = 10, held = D.pairsOk.filter(p => p[0] < p[1]);
  return {
    anc: D.fig1.ancestor, d1: D.fig1.d1, d2: D.fig1.d2, sw1: sw('d1'), sw2: sw('d2'), n: D.fig1.ancestor.length,
    mix, reads, nReads, point: M.POINTS[1],
    pi, top, fast: ((r[1] + r[4]) / 2) / ((r[0] + r[2] + r[3] + r[5]) / 4),   // transitions against the other swaps
    points: M.POINTS, tPath: M.T_PATH, ways: M.POINTS.concat(M.T_PATH).map(x => wayOf(M.path(MI, 0, x), pi, 0)),
    branches: tr.branches.length, tips: tr.nodes.filter(n => n.tip >= 0).length,
    long: { len: L.len, swaps: L.muts.length }, short: { len: S.len, swaps: S.muts.length },
    turn: { t, par, c1: a[par], c0: [a[4 + 2 * par], a[5 + 2 * par]] },
    ry: simple.filter(g => g.type === 'RY').length, cx: simple.filter(g => g.type === 'CNOT').length,
    wires: circ.wires.length, copies: circ.gates.filter(g => g.type === 'CNOT').length, blocks: circ.gates.filter(g => g.type === 'MRY').length,
    perLetter: M.qubits(1), perLink: M.combos(1), held,
    ten: TEN, combos: { pair: M.combos(2), three: M.combos(3), ten: M.combos(TEN) }, qubits10: M.qubits(TEN),
    species: Object.keys(TD.species).length, truthBroken: M.brokenPairs(TD.truth.top, TD.truth.bottom).length,
    authors: D.poster.authors, refs: D.poster.refs,
  };
})();
// colours as text on the HTML panel, which is light in the light theme: a colour mixed with the panel's ink (darker on
// a light panel, lighter on a dark one). The headset's panel is dark: its canvas twin takes the colour itself (data-col).
const inkCol = c => `color-mix(in srgb, ${c} 55%, var(--ink))`;
const swCol = c => c;   // a swatch or a bar in the same colour
// the poster's letters (the Okabe-Ito palette, as the sets draw them), the machine's blue, time's green
const LCOL = ['#e69f00', '#56b4e9', '#f0e442', '#cc79a7'];
const BLUE = '#4fb0ff', GREEN = '#3fd6a6', CYAN = '#46d9ff', AMBER = '#ffb43b', RED = '#ff5a4b', GREY = '#8e98ab';
// the three ways of rebuilding, as the stem set colours their fields' tags, and as the story names them
const METHOD_COL = { indep: GREY, exact: GREEN, coupled: CYAN };
const METHOD_SAY = { indep: 'Letter by letter', exact: 'The exact pair calculation', coupled: 'With the coupled circuit' };

function buildStory() {
  const F = FACTS;
  // the fields of rebuilt ancestors left to right (the shares in ascending order): the text names them in this order
  const FIELDS = GL.sets.stem.api().methods;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  const hide = (k, t0, t1) => ramp(k + '_a', t0, t1, 1, 0);
  // jump an index param (a letter, a method) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const step = (at, out, col, b, text) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  // a big number in a colour of its own (the headset's canvas reads data-col)
  const big = (col, v) => `<b data-col="${col}" style="color:${inkCol(col)}">${v}</b>`;
  // ------------------------------------------------------------ panel copy
  // parts of a chapter that take turns in one place, each fading out (data-out) as the next comes: the headset's
  // panel cannot scroll, so no chapter shows more than fits at once
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const W = word(TD.pairs), A1 = F.authors[0], A2 = F.authors[1];
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">The mutation machine</h1>
      <p class="lede" data-at="2.4">DNA's changes as a quantum circuit</p>
      ${turns(`<p data-at="4" data-out="12.5">DNA is a text written in ${word(LET.length)} letters: ${listOf([...LET])}.</p>
        <p data-at="6.5" data-out="12.5" class="amber">Every time it is copied, now and then a letter is swapped for another. That is a mutation.</p>`,
      `<p data-at="13">Here an ancestor's ${word(F.n)} letters, ${F.anc}, are copied twice, and ${F.sw1.length === F.sw2.length ? `each copy swaps ${word(F.sw1.length)} of them` : `the first copy swaps ${word(F.sw1.length)} of them and the second ${word(F.sw2.length)}`}.</p>
        <ul class="steps">
          ${step(15, 0, GREEN, `Copy 1 · ${F.d1}`, esc(listOf(F.sw1)))}
          ${step(20.5, 0, GREEN, `Copy 2 · ${F.d2}`, esc(listOf(F.sw2)))}
        </ul>
        <p class="credits" data-at="23">After the poster by Enes Berk Sakalli and Arndt von Haeseler. The numbers drawn are examples, as in the authors' own test.</p>`)}`,
    tree: `<h2 data-at="0.6">A family tree</h2>
      ${turns(`<p data-at="1.2" data-out="23.5">Copied over many generations, one text becomes many: a family tree.</p>
        <p data-at="6" data-out="23.5">Where two branches part lived a shared ancestor.</p>
        <p data-at="11" data-out="23.5" class="amber">Each copy carries the letters up its branch. Where one flashes, a letter was swapped.</p>`,
      `<p data-at="24">A branch's length says how much changed along it: the expected number of swaps per letter, which grows with time.</p>
        <div class="facts"><div data-at="25.5">${big(GREEN, f2(F.long.len))}<small>swaps per letter on a long branch: ${swapsN(F.long.swaps)} here</small></div><div data-at="26.5">${big(GREEN, f2(F.short.len))}<small>on a short one: ${swapsN(F.short.swaps)}</small></div></div>
        <p class="note" data-at="28.5">Chance gives more or fewer swaps; the length is what to expect. Trees like this trace viruses as they spread [1] and how a tumour grew from one cancer cell [6], and the rule of change they assume matters [2].</p>
        <p class="credits" data-at="31">The tree's ${F.branches} branches and their swaps are examples, simulated with the story's rule. Heights are change: each branch rises by its length.</p>`)}`,
    qubits: `<h2 data-at="0.6">Letters as qubits</h2>
      ${turns(`<p data-at="1.2" data-out="18.5">A quantum computer can hold each letter in ${word(F.perLetter)} qubits, drawn as arrows on spheres: up is 0, down is 1.</p>
        <ul class="steps">${[0, 1, 2, 3].map(i => step(6 + 3 * i, 18.5, LCOL[i], `${LET[i]} is ${KET[i]}`, codeWords(i))).join('')}</ul>`,
      `<p data-at="19">Tilt the arrows and the ${word(F.perLetter)} qubits hold a mix of all ${word(LET.length)} letters at once, like a spinning coin.</p>
        <p data-at="24">Reading them out makes the coin land on one letter, each with its own chance.</p>
        <p data-at="28" class="amber">Here the chances are ${chancesText(F.mix)}; ${F.nReads} read-outs gave ${listOf(F.reads.map((n, i) => `${n} ${LET[i]}`))}.</p>
        <p class="note" data-at="31">|01⟩ means first 0, then 1. An arrow shorter than its sphere means the ${word(F.perLetter)} qubits depend on each other. This mix is where the rule of the next chapter takes an A after ${F.point} swaps per letter.</p>`)}`,
    rule: `<h2 data-at="0.6">The rule</h2>
      ${turns(`<p data-at="1.2" data-out="16.5">A substitution model is the rule for how letters change:</p>
        <ul class="steps">
          ${step(3, 16.5, BLUE, 'Thicker arrows', 'how readily one letter swaps for another')}
          ${step(6, 16.5, AMBER, 'Bigger balls', 'how common each letter is in the long run')}
        </ul>
        <p class="note" data-at="10" data-out="16.5">Here A↔G and C↔T swap about ${word(Math.round(F.fast))} times as readily as the other pairs, and ${LET[F.top]} is the most common letter in the long run (${pct(F.pi[F.top])}).</p>`,
      `<p data-at="17">Every mix of the four letters is a point in this pyramid, the pure letters at its corners.</p>
        <p data-at="22" class="amber">Start at A, and as time goes on the rule moves the mix along a path towards the long-run mix.</p>
        <p data-at="28">After ${listOf(F.points.map(String))} swaps per letter it has come ${listOf(F.ways.slice(0, 3).map(pct))} of the way; after ${F.tPath}, ${pct(F.ways[3])}.</p>
        <p class="note" data-at="32">The most general standard rule is GTR, the general time-reversible model. The mix follows p(t) = p(0) e^(Qt), a dynamical system: Q holds the rates. The rates and shares here are examples.</p>`)}`,
    machine: `<h2 data-at="0.6">The machine</h2>
      ${turns(`<p data-at="1.2" data-out="25.5">A compiler turns the rule into a quantum circuit: a machine of gears for one branch.</p>
        <ul class="steps">
          ${step(8, 25.5, CYAN, '1 · Copy', 'the parent\'s letter is stamped onto the child')}
          ${step(13, 25.5, GREEN, '2 · Turn', 'the child\'s qubits turn: the longer the branch, the further, and the child\'s mix lands where the rule\'s path is at that time')}
          ${step(20, 25.5, BLUE, '3 · The circuit', `${word(F.wires)} wires, the parent's ${word(F.perLetter)} qubits and the child's, with ${word(F.copies)} copy gates and ${word(F.blocks)} turn blocks`)}
        </ul>`,
      `<p data-at="26.5">One machine per branch, joined into the tree.</p>
        <p data-at="34" class="amber">Read at the tips, it writes new sequences that follow the rule.</p>
        <p class="note" data-at="36">The copy is ${word(F.copies)} CNOT gates. The turn is a few rotations of single qubits plus steps that link two qubits, so it depends on the parent's letter: for a ${LET[F.turn.par]} after ${F.turn.t} swap per letter, c1 and c0, the child's first and second qubit, turn ${deg(F.turn.c1)} and ${deg(F.turn.c0[0])} or ${deg(F.turn.c0[1])}. How far each step turns depends only on the branch length; the steps are the same on every branch: ${F.ry} turns of one qubit and ${F.cx} links.</p>`)}`,
    pairs: `<h2 data-at="0.6">Letters that work together</h2>
      ${turns(`<p data-at="1.2" data-out="27.5">Letters often act together.</p>
        <p data-at="4" data-out="27.5">An RNA strand folds back on itself into a stem, held by pairs: ${F.held.map(p => `${p[0]} with ${p[1]}`).join(', ')}.</p>
        <p data-at="14" data-out="27.5" class="amber">If one letter changes alone, its pair breaks.</p>
        <p data-at="21" data-out="27.5">Coupling lets the two letters of a pair change together, so the pair holds.</p>`,
      `<p data-at="28">Models of pairs exist, but each linked letter multiplies the combinations by ${word(F.perLink)}.</p>
        <div class="facts"><div data-at="29">${big(CYAN, fmt(F.combos.pair))}<small>combinations for a pair</small></div><div data-at="33">${big(AMBER, fmt(F.combos.ten))}<small>for ${word(F.ten)} letters: ${aboutN(F.combos.ten)}</small></div><div data-at="35">${big(GREEN, F.qubits10)}<small>qubits for ${word(F.ten)}: ${word(F.perLetter)} per letter</small></div></div>
        <p class="note" data-at="36">T stands for RNA's U here, as on the poster. On every branch the coupling acts on both letters of a pair beside the turn: changes that keep a pair are more likely (${word(TD.w)} times, in the authors' example), and both letters may change at once [3].</p>`)}`,
    rebuild: `<h2 data-at="0.6">Rebuilding the ancestor</h2>
      ${turns(`<p data-at="1.2" data-out="26.5">${cap(word(F.species))} species carry the same stem, each changed in its own way.</p>
        <p data-at="7" data-out="26.5" class="amber">What did their shared ancestor have?</p>
        <p data-at="14" data-out="26.5">Rebuild it ${fmt(TD.n)} times with each method, and count the ancestors whose ${W} pairs all hold:</p>
        <ul class="steps">${FIELDS.map((m, i) => step(18 + 3 * i, 26.5, METHOD_COL[m], METHOD_SAY[m], `${pct(TD.intact[m])}${i ? '' : ' of them'}`)).join('')}</ul>`,
      `<p data-at="27" class="amber">So the coupling favours pairs too strongly: its ancestors look believable, but its percentages are not true chances.</p>
        <p data-at="31">And a broken pair is normal: the true ancestor here has ${word(F.truthBroken)}, and only ${esc(TD.allSixPrior)} of ancestors have all ${W} pairs matched.</p>
        <p data-at="35">One rebuilt ancestor of each method stands before its field; white frames mark letters that differ from the true one.</p>
        <p class="note" data-at="38">In the authors' test: a made-up stem of ${W} pairs in ${word(F.species)} species, ${fmt(TD.n)} rebuilt ancestors per method, matching pairs ${word(TD.w)} times as likely as mismatched ones. The shares are theirs; which stems are intact is drawn for the picture.</p>`)}`,
    what: `<h2 data-at="0.6">What it is for</h2>
      ${turns(`<p data-at="1.2" data-out="13.5">Rebuilding ancestors is how researchers brought back old virus proteins for vaccine research [4, 5] and trace how a tumour grew from one cancer cell [6].</p>
        <p data-at="6" data-out="13.5" class="amber">This circuit turns a rule of letter change into a machine a quantum computer can run, and couples letters that change together.</p>
        <p class="note" data-at="9" data-out="13.5">For now it handles one letter or one pair at a time, on simulated data. For real results the numbers would be estimated from real sequences.</p>`,
      `<p data-at="14">After the poster by ${esc(A1.name)} (${esc(A1.inst)}) and ${esc(A2.name)} (${esc(A2.inst)}).</p>
        <p data-at="16"><button class="btn primary" id="btnGoExplore" type="button">Explore the machine</button></p>
        <p class="credits" data-at="17">${F.refs.map((r, i) => `[${i + 1}] ${esc(r)}.`).join(' ')}</p>
        <p class="credits" data-at="18">The numbers drawn are examples, computed here; numbers said to be from the authors' test are theirs.</p>`)}`,
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
  start({ letters_helix: 1, letters_peel: 0, letters_copy1: 0, letters_mut1: 0, letters_copy2: 0, letters_mut2: 0, letters_open: 0, letters_code: 0,
    letters_mix: 0, letters_target: 0, letters_time: M.POINTS[1], letters_reads: 0, letters_seed: 1,
    tree_species: 0, tree_grow: 0, tree_seq: 1, tree_hi: 0, tree_gears: 0, tree_flow: 0, tree_q: 0, tree_seed: 1, tree_speed: 1, tree_pick: -1,
    rule_balls: 0, rule_flow: 1, rule_pyr: 0, rule_path: 0, rule_time: 0, rule_model: MI, rule_start: 0, rule_compile: 0, rule_machine: 0,
    rule_parent: F.turn.par, rule_copy: 0, rule_circuit: 0, rule_simple: 0, rule_run: 1,
    stem_strand: 0, stem_fold: 0, stem_break: 0, stem_couple: 0, stem_both: 0, stem_count: 0, stem_qubits: 0, stem_species: 0, stem_fields: 0,
    stem_named: 0, stem_sort: 0, stem_truth: 0, stem_examples: 0, stem_src: 0, stem_w: TD.w, stem_seed: 1, stem_method: -1 });
  let a, b;
  // A text in four letters: the helix turning, its top strand peeling into the ancestor's row, two copies with swaps
  a = C.title.a; b = C.title.b;
  show('letters', 0.2, 2, b - 1, b + 1);
  ramp('letters_peel', a + 6, a + 11, 0, 1);
  ramp('letters_helix', a + 11, a + 14, 1, 0);
  ramp('letters_copy1', a + 13, a + 15, 0, 1);
  ramp('letters_mut1', a + 15, a + 18, 0, 1);
  ramp('letters_copy2', a + 18.5, a + 20.5, 0, 1);
  ramp('letters_mut2', a + 20.5, a + 23.5, 0, 1);
  cam(a, 'letters', 'default', -8);
  cam(a + 5.5, 'letters', 'default', 2, 'spin');
  cam(a + 10, 'letters', 'peel', 0);
  cam(a + 14, 'letters', 'rows', -6);
  cam(b - 0.5, 'letters', 'rows', 6, 'spin');
  // A family tree: it grows from its root, the letters riding up, mutations flashing; a long and a short branch
  a = C.tree.a; b = C.tree.b;
  show('tree', a, a + 2, b - 2, b);
  ramp('tree_grow', a + 4, a + 24, 0, 1);
  ramp('tree_hi', a + 24, a + 27, 0, 1);
  ramp('tree_hi', b - 3, b - 1, 1, 0);
  ST.stand.push([a + 1, a + 4, b - 2.5, b]);   // (in a headset: once the letters have gone, until the qubits come)
  cam(a + 1.5, 'tree', 'grow', -10);
  cam(a + 22, 'tree', 'grow', 30, 'spin');
  cam(a + 25, 'tree', 'pair', -4);
  cam(b - 0.5, 'tree', 'pair', 6, 'spin');
  // Letters as qubits: the ancestor's first tile opens into two qubits, the four codes, the tilt into a mix, read-outs
  a = C.qubits.a; b = C.qubits.b;
  show('letters', a, a + 2, b - 1, b + 1);
  ramp('letters_open', a + 2, a + 6, 0, 1);
  [1, 2, 3].forEach(i => jump('letters_code', a + 6 + 3 * i, i - 1, i));
  jump('letters_code', a + 18, 3, 0);
  ramp('letters_mix', a + 19, a + 22, 0, 1);
  ramp('letters_reads', a + 24, a + 28, 0, 4);
  ramp('letters_reads', a + 28, a + 34, 4, F.nReads);
  cam(a + 0.5, 'letters', 'rows', -4);
  cam(a + 3.5, 'letters', 'qubits', -6);
  cam(a + 23, 'letters', 'qubits', 6, 'spin');
  cam(a + 25.5, 'letters', 'reads', -3);
  cam(b - 0.5, 'letters', 'reads', 4, 'spin');
  // The rule: balls and arrows, the pyramid of mixes, the path from A towards the long-run mix
  a = C.rule.a; b = C.rule.b;
  show('rule', a, a + 2);
  ramp('rule_balls', a + 1, a + 6, 0, 1);
  ramp('rule_pyr', a + 16, a + 21, 0, 1);
  ramp('rule_path', a + 22, a + 24, 0, 1);
  ramp('rule_time', a + 24, a + 35, 0, M.T_PATH);
  cam(a + 1, 'rule', 'rates', -8);
  cam(a + 15, 'rule', 'rates', 10, 'spin');
  cam(a + 18, 'rule', 'pyramid', -4);
  cam(a + 23, 'rule', 'path', -6);
  cam(b - 0.5, 'rule', 'path', 10, 'spin');
  // The machine: the compiler, the copy, the turn, the circuit; then one machine per branch of the family tree
  a = C.machine.a; b = C.machine.b;
  ramp('rule_time', a, a + 2, M.T_PATH, 0);
  ramp('rule_compile', a, a + 4, 0, 1);
  ramp('rule_machine', a + 4, a + 8, 0, 1);
  ramp('rule_copy', a + 8, a + 13, 0, 1);
  ramp('rule_time', a + 13, a + 20, 0, F.turn.t);
  ramp('rule_circuit', a + 20, a + 23, 0, 1);
  hide('rule', a + 25.5, a + 27.5);
  show('tree', a + 26.5, a + 29, b - 2, b);
  ramp('tree_gears', a + 29, a + 32, 0, 1);
  ramp('tree_flow', a + 34, a + 36, 0, 1);
  ramp('tree_flow', b - 3, b - 1, 1, 0);
  ST.stand.push([a + 27.5, a + 30.5, b - 2.5, b]);   // (in a headset: once the circuit has gone, until the stem comes)
  cam(a + 1.5, 'rule', 'compiler', -4);
  cam(a + 5.5, 'rule', 'machine', 0);
  cam(a + 8.5, 'rule', 'copy', -2);
  cam(a + 13, 'rule', 'copy', 2, 'spin');
  cam(a + 14.5, 'rule', 'turn', -4);
  cam(a + 20, 'rule', 'turn', 4, 'spin');
  cam(a + 21.5, 'rule', 'circuit', -2);
  cam(a + 25, 'rule', 'circuit', 3, 'spin');
  cam(a + 28, 'tree', 'gears', -10);
  cam(b - 0.5, 'tree', 'gears', 14, 'spin');
  // Letters that work together: the strand folds into a stem, a pair breaks, the coupling keeps one, the count
  a = C.pairs.a; b = C.pairs.b;
  show('stem', a, a + 2, b - 2, b);
  ramp('stem_strand', a + 1, a + 5, 0, 1);
  ramp('stem_fold', a + 6, a + 12, 0, 1);
  ramp('stem_break', a + 14, a + 17, 0, 1);
  ramp('stem_break', a + 20, a + 21, 1, 0);
  ramp('stem_couple', a + 21, a + 23, 0, 1);
  ramp('stem_both', a + 24, a + 26, 0, 1);
  ramp('stem_count', a + 28, a + 30, 0, 1);
  ramp('stem_count', a + 31, a + 32.5, 1, 2);
  ramp('stem_count', a + 33, a + 35, 2, 3);
  ramp('stem_qubits', a + 34, a + 36, 0, 1);
  cam(a + 1.5, 'stem', 'strand', 20);
  cam(a + 6.5, 'stem', 'fold', 6);
  cam(a + 13, 'stem', 'fold', -4, 'spin');
  cam(a + 15, 'stem', 'break', -6);
  cam(a + 27, 'stem', 'break', 8, 'spin');
  cam(a + 29, 'stem', 'count', 0);
  cam(a + 32.5, 'stem', 'count', 4, 'spin');
  cam(a + 34.5, 'stem', 'cloud', 0);
  cam(b - 0.5, 'stem', 'cloud', 4, 'spin');
  // Rebuilding the ancestor: the species tree and its stems, the "?", three fields of rebuilt ancestors, their
  // shares, the true ancestor and one rebuilt example per method (the close-up's params jump while the stem set is out)
  a = C.rebuild.a; b = C.rebuild.b;
  jump('tree_species', a - 1, 0, 1); jump('tree_grow', a - 1, 1, 0); jump('tree_gears', a - 1, 1, 0);
  jump('stem_strand', a + 0.5, 1, 0); jump('stem_count', a + 0.5, 3, 0); jump('stem_qubits', a + 0.5, 1, 0);
  show('tree', a, a + 3);
  ramp('tree_grow', a, a + 6, 0, 1);
  ramp('tree_q', a + 1, a + 4, 0, 1);
  ramp('tree_gears', a + 3, a + 6, 0, 1);
  show('stem', a + 3, a + 5);
  ramp('stem_species', a + 6, a + 11, 0, 1);
  ramp('stem_fields', a + 14, a + 24, 0, 1);
  // each field lit, and its tag shown, as the text names it (its step's data-at), left to right
  FIELDS.forEach((m, i) => {
    jump('stem_method', a + 18 + 3 * i, i ? M.METHODS.indexOf(FIELDS[i - 1]) : -1, M.METHODS.indexOf(m));
    ramp('stem_named', a + 18 + 3 * i, a + 18.6 + 3 * i, i, i + 1);
  });
  jump('stem_method', a + 27, M.METHODS.indexOf(FIELDS[FIELDS.length - 1]), -1);
  ramp('stem_sort', a + 25, a + 28, 0, 1);
  ramp('tree_q', a + 30, a + 33, 1, 0);
  ramp('stem_truth', a + 31, a + 34, 0, 1);
  ramp('stem_examples', a + 35, a + 39, 0, 1);
  cam(a + 1.5, 'tree', 'species', -8);
  cam(a + 12, 'tree', 'species', 6, 'spin');
  cam(a + 15, 'stem', 'fields', -4);
  cam(a + 29, 'stem', 'fields', 4, 'spin');
  cam(a + 32, 'stem', 'compare', -3);
  cam(b - 0.5, 'stem', 'compare', 4, 'spin');
  // What it is for: the species tree, its machines running, the species' stems
  a = C.what.a; b = C.what.b;
  for (const n of ['stem_fields', 'stem_examples', 'stem_truth']) ramp(n, a, a + 2, 1, 0);
  ramp('tree_flow', a + 2, a + 6, 0, 1);
  cam(a + 2, 'tree', 'what', -6);
  cam(b - 0.5, 'tree', 'what', 16, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  a = C.machine.a;
  label('tree', 'tip2', '<b>New sequences</b> · read at the tips', a + 35, C.machine.b - 2, 'cyn');
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
// (the tree and the stem share one turn: one frame)
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
// (in a headset the family tree stands tall while it is the scene, see standView)
const storyCam = t => (XR.on ? standView(storyView(t), standW(t)) : storyView(t));
function storyView(t) {
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

// In a headset the family tree stands tall in front of you while it is the scene (chapter 2, and the machines of
// chapter 5): the story's view eases into the tree set's `stand` (about 1.5 m tall, its root low, its crown above your
// eyes), keeping the story's turn; the species tree of chapters 7 and 8 stays at table size. Its axis stands STAND_BACK
// (in the set's units) further off than the view's target, so that nothing of it, the level ring and the rows of
// letters riding up included, comes within 0.35 m of your eyes (measured with the story's turns: 0.44 m at the
// closest). The weight follows the story's time alone, so at a shared-room station everyone sees the same size. On a
// screen nothing changes.
const STAND_BACK = 0.2;
// ST.stand: [t0, t1, t2, t3], in over t0..t1 and out over t2..t3 (story time)
const standW = t => ST.stand.reduce((w, [t0, t1, t2, t3]) => Math.max(w, Math.min(smooth((t - t0) / (t1 - t0)), smooth((t3 - t) / (t3 - t2)))), 0);
function standView(v, w) {
  if (w <= 0) return v;
  const s = view('tree', 'stand'), A = v[0] * D2R;
  s[3] += STAND_BACK * Math.sin(A); s[5] += STAND_BACK * Math.cos(A);   // (towards you: the target nearer, the axis further)
  v[1] += (s[1] - v[1]) * w;
  v[2] = Math.exp(Math.log(v[2]) + (Math.log(s[2]) - Math.log(v[2])) * w);
  for (let i = 3; i < 6; i++) v[i] += (s[i] - v[i]) * w;
  return v;
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
// a label whose text is a function (a pile's count, a branch's length, a field's share, a turn's angle) is read again
// while it shows and redrawn when it changes: the HTML label, and the headset's sprite (dropped, so it is made again)
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
