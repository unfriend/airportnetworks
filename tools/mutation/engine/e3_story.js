//#use head
// ================================================================== STORY ==
// Narration timing: [time in the recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands on
// the matching sentence. The story is narrated by a synthetic voice
// (audio/narration-mutation.mp3, Kokoro's af_heart): node
// tools/voice/narrate.mjs mutation writes this table and NARRATION_ENDS from
// the recording it makes (each stretch lasts the longer of 1.1 times its story
// time and its line's audio plus a pause); run it again after the text changes
// (see tools/voice/README.md).
const NARRATION_SYNC = [
  [0, 0], [1.32, 1.2], [3.92, 2.4], [7.17, 4], [12.03, 6.5], [19.84, 13.6], [27.4, 15],
  [34.39, 20.5], [40.89, 25.3],                       // Letters
  [41.66, 26], [42.96, 27.18], [44.79, 27.2], [70.53, 50.6], [76.97, 51.5], [77.63, 52.1],
  [82.4, 52.5], [86.12, 54.5], [86.78, 55.1], [98.94, 59.3],  // Family tree
  [99.71, 60], [101, 61.18], [102.97, 61.2], [110.81, 66], [117.57, 72], [121.12, 75], [125.52, 79],
  [131.68, 84], [136.57, 88], [137.23, 88.6], [148.68, 91], [149.34, 91.6], [163.35, 95.3],  // Qubits
  [164.12, 96], [165.42, 97.18], [166.85, 97.2], [167.51, 97.8], [171.06, 99], [175.4, 102],
  [179.8, 106], [190.27, 113], [196.15, 118], [203.41, 124.6], [216.32, 128], [216.98, 128.6],
  [233.73, 133.3],                                    // The rule
  [234.5, 134], [235.8, 135.18], [237.31, 135.2], [250.29, 147], [259.03, 154], [267.12, 160.5],
  [275.37, 168], [279.69, 170], [280.35, 170.6], [309.04, 179.3],  // Machine
  [309.81, 180], [311.11, 181.18], [313.26, 181.2], [343.4, 208.6], [348.58, 209], [353.64, 213.6],
  [359.22, 215], [359.88, 215.6], [362.36, 216], [363.02, 216.6], [379.13, 217.3],  // Pairs
  [379.9, 218], [381.19, 219.18], [383.31, 219.2], [397.39, 232], [403.9, 236], [407.2, 239],
  [410.61, 242], [413.91, 245], [421.77, 249], [430.27, 253], [430.93, 253.6], [438.11, 256],
  [438.77, 256.6], [454.98, 263.3],                   // Rebuild
  [455.75, 264], [457.05, 265.18], [458.71, 265.2], [468.56, 270], [469.22, 270.6], [476.7, 273],
  [486.58, 278], [505.65, 289.3], [506.42, 290],      // What for
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { title: 40.65, tree: 98.7, qubits: 163.15, rule: 233.5, machine: 308.8, pairs: 378.9, rebuild: 454.75, what: 505.4 };
//#use storyT narrT T_END
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
//#use C DEF buildDefaults TR key ramp evalTrack storyState fadeVal ST~2 view fitShift
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
// across the screen (measured at 390 x 760: the machine's close-ups and the pyramid beside them, the circuit, the tree
// seen across its two branches, the straight strand, the fields)
const NARROW = { letters: { default: 1.1, peel: 1.1 }, tree: { pair: 1.35, gears: 1.06, what: 1.06 },
  rule: { copy: 1.6, turn: 1.18, circuit: 1.1 }, stem: { strand: 1.4, fold: 1.2, fields: 1.12, compare: 1.22 } };
//#use narrowOf
// on a screen held sideways but too narrow for the side panel (the panel below, the scene in a strip above it, see
// lowK) the tall family tree comes closer and is centred in the strip: [distance factor, the target's shift up]
// (measured at 640 x 400: about as tall as the strip, as the qubits story's map stands there)
const LOW = { tree: { default: [0.72, -0.3], grow: [0.62, 0], crown: [0.72, 0], pair: [0.69, -0.68], gears: [0.67, -0.1] } };
//#use LOW1 lowOf anchorOf
// ------------------------------------------------------------------- data --
// The maths (MMATH) on the story's example numbers, and the poster's numbers (MUT_DATA), looked up once for the story
// and the panes. The examples' numbers are computed here, never typed in; the poster's are used only where the text
// says "in the authors' test".
const M = MMATH, D = MUT_DATA, TD = D.test;
const MI = Math.max(0, M.MODELS.findIndex(m => m.key === M.DEFAULT));   // the story's rule (rule_model)
const LET = M.LETTERS, KET = M.KETS;
//#use f2 pct
const deg = v => `${Math.round(Math.abs(v) * 180 / Math.PI)}°`;   // how far a turn goes (its size, not its direction)
//#use word listOf
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
//#use inkCol swCol
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
        <p data-at="6" data-out="23.5">Where two branches part, there lived a shared ancestor.</p>
        <p data-at="11" data-out="23.5" class="amber">Each copy carries the letters up its branch. Where a letter flashes, it was swapped.</p>`,
      `<p data-at="24">A branch's length says how much changed along it: the expected number of swaps per letter, which grows with time.</p>
        <div class="facts"><div data-at="25.5">${big(GREEN, f2(F.long.len))}<small>swaps per letter on a long branch: ${swapsN(F.long.swaps)} here</small></div><div data-at="26.5">${big(GREEN, f2(F.short.len))}<small>on a short one: ${swapsN(F.short.swaps)}</small></div></div>
        <p class="note" data-at="28.5">Chance gives more or fewer swaps; the length is what to expect. Trees like this trace viruses as they spread and how a tumour grew from one cancer cell, and the rule of change they assume matters.</p>
        <p class="credits" data-at="31">The tree's ${F.branches} branches and their swaps are examples, simulated with the story's rule. Heights are change: each branch rises by its length. On viruses see [1], on tumours [6], on the rule of change [2].</p>`)}`,
    qubits: `<h2 data-at="0.6">Letters as qubits</h2>
      ${turns(`<p data-at="1.2" data-out="18.5">A quantum computer can hold each letter in ${word(F.perLetter)} qubits, drawn as arrows on spheres: up is 0, down is 1.</p>
        <ul class="steps">${[0, 1, 2, 3].map(i => step(6 + 3 * i, 18.5, LCOL[i], `${LET[i]} is ${KET[i]}`, codeWords(i))).join('')}</ul>`,
      `<p data-at="19">Tilt the arrows and the ${word(F.perLetter)} qubits hold a mix of all ${word(LET.length)} letters at once, like a spinning coin.</p>
        <p data-at="24">Reading them out makes the coin land on one letter, each with its own chance.</p>
        <p data-at="28" class="amber">Here the chances are ${chancesText(F.mix)}; ${F.nReads} read-outs gave ${listOf(F.reads.map((n, i) => `${n} ${LET[i]}`))}.</p>
        <p class="note" data-at="31">C's code, 01, means first 0, then 1. An arrow shorter than its sphere means the ${word(F.perLetter)} qubits depend on each other. This mix is where the rule of the next chapter takes an A after ${F.point} swaps per letter.</p>`)}`,
    rule: `<h2 data-at="0.6">The rule</h2>
      ${turns(`<p data-at="1.2" data-out="16.5">A substitution model is the rule for how letters change:</p>
        <ul class="steps">
          ${step(3, 16.5, BLUE, 'The thicker the arrow', 'the more readily one letter swaps for another')}
          ${step(6, 16.5, AMBER, 'The bigger the ball', 'the more common its letter is in the long run')}
        </ul>
        <p class="note" data-at="10" data-out="16.5">Here A and G, and C and T, swap about ${word(Math.round(F.fast))} times as readily as the other pairs, and ${LET[F.top]} is the most common letter in the long run, at ${pct(F.pi[F.top])}.</p>`,
      `<p data-at="17">Every mix of the four letters is a point in this pyramid, with the pure letters at its corners.</p>
        <p data-at="22" class="amber">Start at A, and as time goes on the rule moves the mix along a path towards the long-run mix.</p>
        <p data-at="28">After ${listOf(F.points.map(String))} swaps per letter, it has come ${listOf(F.ways.slice(0, 3).map(pct))} of the way; after ${F.tPath}, ${pct(F.ways[3])}.</p>
        <p class="note" data-at="32">The most general standard rule is GTR, the general time-reversible model. The mix follows a dynamical system: after a time t it is the starting mix times e to the power of Q times t, where Q holds the rates. The rates and shares here are examples.</p>`)}`,
    machine: `<h2 data-at="0.6">The machine</h2>
      ${turns(`<p data-at="1.2" data-out="25.5">A compiler turns the rule into a quantum circuit: a machine of gears for one branch.</p>
        <ul class="steps">
          ${step(8, 25.5, CYAN, '1 · Copy', 'the parent\'s letter is stamped onto the child')}
          ${step(13, 25.5, GREEN, '2 · Turn', 'the child\'s qubits turn, further on a longer branch, and the child\'s mix lands where the rule\'s path is at that time')}
          ${step(20, 25.5, BLUE, '3 · The circuit', `${word(F.wires)} wires, for the parent's ${word(F.perLetter)} qubits and the child's, carrying ${word(F.copies)} copy gates and ${word(F.blocks)} turn blocks`)}
        </ul>`,
      `<p data-at="26.5">Each branch gets one machine, and the machines join into the tree.</p>
        <p data-at="34" class="amber">Read at the tips, it writes new sequences that follow the rule.</p>
        <p class="note" data-at="36">The copy is ${word(F.copies)} CNOT gates. The turn is a few rotations of single qubits plus steps that link two qubits, so it depends on the parent's letter: for a ${LET[F.turn.par]} after ${F.turn.t} swap per letter, c1, the child's first qubit, turns ${deg(F.turn.c1)}, and c0, its second, turns ${deg(F.turn.c0[0])} or ${deg(F.turn.c0[1])}. How far each step turns depends only on the branch length; the steps are the same on every branch: ${F.ry} turns of one qubit and ${F.cx} links.</p>`)}`,
    pairs: `<h2 data-at="0.6">Letters that work together</h2>
      ${turns(`<p data-at="1.2" data-out="27.5">Letters often act together.</p>
        <p data-at="4" data-out="27.5">An RNA strand folds back on itself into a stem, held by pairs: ${F.held.map(p => `${p[0]} with ${p[1]}`).join(', ')}.</p>
        <p data-at="14" data-out="27.5" class="amber">If one letter changes alone, its pair breaks.</p>
        <p data-at="21" data-out="27.5">Coupling lets the two letters of a pair change together, so the pair holds.</p>`,
      `<p data-at="28">Models of pairs exist, but each linked letter multiplies the combinations by ${word(F.perLink)}.</p>
        <div class="facts"><div data-at="29">${big(CYAN, fmt(F.combos.pair))}<small>combinations for a pair</small></div><div data-at="33">${big(AMBER, fmt(F.combos.ten))}<small>for ${word(F.ten)} letters: ${aboutN(F.combos.ten)}</small></div><div data-at="35">${big(GREEN, F.qubits10)}<small>qubits for ${word(F.ten)}: ${word(F.perLetter)} per letter</small></div></div>
        <p class="note" data-at="36">T stands for RNA's U here, as on the poster. On every branch the coupling acts on both letters of a pair alongside the turn: changes that keep a pair are more likely, in the authors' example ${word(TD.w)} times as likely, and both letters may change at once.</p>`)}`,
    rebuild: `<h2 data-at="0.6">Rebuilding the ancestor</h2>
      ${turns(`<p data-at="1.2" data-out="26.5">${cap(word(F.species))} species carry the same stem, each changed in its own way.</p>
        <p data-at="7" data-out="26.5" class="amber">What did their shared ancestor have?</p>
        <p data-at="14" data-out="26.5">Rebuild it ${fmt(TD.n)} times with each method, and count the ancestors whose ${W} pairs all hold:</p>
        <ul class="steps">${FIELDS.map((m, i) => step(18 + 3 * i, 26.5, METHOD_COL[m], METHOD_SAY[m], `${pct(TD.intact[m])}${i ? '' : ' of them'}`)).join('')}</ul>`,
      `<p data-at="27" class="amber">So the coupling favours pairs too strongly: its ancestors look believable, but its percentages are not true chances.</p>
        <p data-at="31">And a broken pair is normal: the true ancestor here has ${word(F.truthBroken)}, and only ${esc(TD.allSixPrior)} of ancestors have all ${W} pairs matched.</p>
        <p data-at="35">One rebuilt ancestor of each method stands before its field; white frames mark letters that differ from the true one.</p>
        <p class="note" data-at="38">In the authors' test, the ancestor of a made-up stem of ${W} pairs in ${word(F.species)} species was rebuilt ${fmt(TD.n)} times per method, with matching pairs ${word(TD.w)} times as likely as mismatched ones. The shares are theirs; which stems are intact is drawn for the picture.</p>`)}`,
    what: `<h2 data-at="0.6">What it is for</h2>
      ${turns(`<p data-at="1.2" data-out="13.5">Rebuilding ancestors is how researchers brought back old virus proteins for vaccine research and trace how a tumour grew from one cancer cell.</p>
        <p data-at="6" data-out="13.5" class="amber">This circuit turns a rule of letter change into a machine a quantum computer can run, and couples letters that change together.</p>
        <p class="note" data-at="9" data-out="13.5">For now it handles one letter or one pair at a time, on simulated data. For real results the numbers would be estimated from real sequences.</p>`,
      `<p data-at="14">After the poster by ${esc(A1.name)}, of the ${esc(A1.inst)}, and ${esc(A2.name)}, of the ${esc(A2.inst)}.</p>
        <p data-at="16"><button class="btn primary" id="btnGoExplore" type="button">Explore the machine</button></p>
        <p class="credits" data-at="17">On both letters of a pair changing at once see [3], on old virus proteins [4, 5], on tumours [6]. ${F.refs.map((r, i) => `[${i + 1}] ${esc(r)}.`).join(' ')}</p>
        <p class="credits" data-at="18">The numbers drawn are examples, computed here; numbers said to be from the authors' test are theirs. Narration: a synthetic voice (Kokoro).</p>`)}`,
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
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name), lowOf(k, name)]);
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
  // ---- sound effects (sfxCue: story time, a sound, where it comes from, its options; sfxHold: a continuous sound),
  // beside the keys above: a cue just before the line it goes with, textures under the voice soft; sequences from the
  // keys (when a ramp reaches a share)
  const rampAt = (t0, t1, f) => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (smooth(m) < f) lo = m; else hi = m; } return t0 + (t1 - t0) * lo; };
  a = C.title.a;
  sfxCue(a + 0.3, 'rise', 'letters', 'helix', { gain: 0.5 });                        // the helix
  sfxCue(a + 6, 'whoosh', 'letters', 'ancestor', { dur: 5, pitch: 1.1 });            // the strand peels into the ancestor's row
  sfxCue(a + 12.8, 'patter', 'letters', 'copy1', { dur: 2, gain: 0.4 });             // copy one
  sfxCue(a + 15.2, 'pick', 'letters', 'swap1', { pitch: 1.5 });                      // a swap
  sfxCue(a + 18.4, 'patter', 'letters', 'copy2', { dur: 2, gain: 0.4 });             // copy two
  sfxCue(a + 20.7, 'pick', 'letters', 'swap2', { pitch: 1.5 });                      // a swap
  a = C.tree.a;
  sfxCue(a + 4, 'grow', 'tree', 'root', { dur: 18, pitch: 0.9, gain: 0.35 });        // the family tree grows
  sfxCue(a + 23.8, 'ping', 'tree', 'long');                                          // a long and a short branch
  a = C.qubits.a;
  sfxCue(a + 2, 'whoosh', 'letters', 'tile', { dur: 1.5 });                          // a tile opens into two qubits
  for (let i = 0; i < 4; i++) sfxCue(a + 5.8 + 3 * i, 'step', 'letters', 'qubit1', { pitch: Math.pow(2, 2 * i / 12), seq: true });   // the four codes
  sfxCue(a + 18.8, 'whoosh', 'letters', 'qubit2', { pitch: 1.3 });                   // the tilt into a mix
  for (let k = 1; k <= 4; k++) sfxCue(rampAt(a + 24, a + 28, k / 4), 'step', 'letters', 'piles', { pitch: 1.2, gain: 0.5, seq: true });   // the first read-outs, one by one
  sfxCue(a + 28.3, 'patter', 'letters', 'piles', { dur: 5.7, gain: 0.3 });           // then many pile up
  a = C.rule.a;
  sfxCue(a + 1, 'grow', 'rule', 'pyramid', { dur: 5 });                              // balls and arrows
  sfxCue(a + 16, 'rise', 'rule', 'pyramid', { dur: 5 });                             // the pyramid of mixes
  sfxCue(a + 21.8, 'pick', 'rule', 'ballA');                                         // the path starts at A
  sfxCue(a + 35, 'ping', 'rule', 'mix');                                             // it nears the long-run mix
  a = C.machine.a;
  sfxCue(a + 0.3, 'ratchet', 'rule', 'compiler', { n: 8, dur: 4 });                  // the compiler
  sfxCue(a + 4, 'rise', 'rule', 'machine', { dur: 4 });                              // the machine
  sfxCue(a + 7.8, 'whoosh', 'rule', 'copyGates');                                    // the copy
  sfxCue(a + 19.8, 'link', 'rule', 'circuit');                                       // the circuit
  sfxCue(a + 29, 'ratchet', 'tree', 'crown', { n: 14, dur: 3 });                     // a machine on every branch
  sfxCue(a + 33.8, 'patter', 'tree', 'tips', { dur: 2, pitch: 1.3, gain: 0.3 });     // read at the tips
  a = C.pairs.a;
  sfxCue(a + 6, 'whoosh', 'stem', 'stem', { dur: 6, pitch: 0.8 });                   // the strand folds into a stem
  sfxCue(a + 13.8, 'snap', 'stem', 'brk');                                           // a pair breaks
  sfxCue(a + 20.8, 'link', 'stem', 'gear');                                          // the coupling keeps one
  [28, 31, 33].forEach((s, i) => sfxCue(a + s, 'step', 'stem', 'square', { pitch: Math.pow(2, 3 * i / 12), seq: true }));   // the count of combinations
  a = C.rebuild.a;
  sfxCue(a + 0.3, 'grow', 'tree', 'n1', { dur: 6 });                                 // the species tree
  sfxCue(a + 14, 'patter', 'stem', 'cloud', { dur: 10, gain: 0.3 });                 // fields of rebuilt ancestors
  FIELDS.forEach((m, i) => sfxCue(a + 17.8 + 3 * i, 'step', 'stem', 'field_' + m, { pitch: Math.pow(2, 2 * i / 12) }));   // each field lit
  sfxCue(a + 30.8, 'ping', 'stem', 'truth');                                         // the true ancestor
  a = C.what.a;
  sfxCue(a + 2, 'ratchet', 'tree', 'crown', { n: 10, dur: 4, gain: 0.25 });          // the machines running
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  a = C.machine.a;
  label('tree', 'tip2', '<b>New sequences</b> · read at the tips', a + 35, C.machine.b - 2, 'cyn');
}
//#use buildCamera~2
// the turn a set has at story time t: that of its latest stay on show (it starts fading in a little before its first view)
// (the tree and the stem share one turn: one frame)
function setYaw(k, t) {
  let c = 0;
  const f = frameOf(k);
  for (const y of ST.yaw) if (y.k === f && y.t0 - 6 <= t) c = y.c;
  return c;
}
//#use smoothSeg spinEase
// the story's view at time t: [az, el, dist, tx, ty, tz, narrow factor, FIT's target shift x, y, z, and LOW's two]
// (in a headset the family tree stands tall while it is the scene, see standView)
const storyCam = t => (XR.on ? standView(storyView(t), standW(t)) : storyView(t));
//#use storyView
// In a headset the family tree stands tall in front of you while it is the scene (chapter 2, and the machines of
// chapter 5): the story's view eases into the tree set's `stand` (about 1.5 m tall, its root low, its crown above your
// eyes), keeping the story's turn; the species tree of chapters 7 and 8 stays at table size. Its axis stands STAND_BACK
// (in the set's units) further off than the view's target, so that nothing of it, the level ring and the rows of
// letters riding up included, comes within 0.35 m of your eyes (measured with the story's turns: 0.44 m at the
// closest). The weight follows the story's time alone, so at a shared-room station everyone sees the same size. On a
// screen nothing changes.
const STAND_BACK = 0.2;
//#use standW
function standView(v, w) {
  if (w <= 0) return v;
  const s = view('tree', 'stand'), A = v[0] * D2R;
  s[3] += STAND_BACK * Math.sin(A); s[5] += STAND_BACK * Math.cos(A);   // (towards you: the target nearer, the axis further)
  v[1] += (s[1] - v[1]) * w;
  v[2] = Math.exp(Math.log(v[2]) + (Math.log(s[2]) - Math.log(v[2])) * w);
  for (let i = 3; i < 6; i++) v[i] += (s[i] - v[i]) * w;
  return v;
}

//#use LBL labelEl label sfxSpan buildSetLabels
// a label whose text is a function (a pile's count, a branch's length, a field's share, a turn's angle) is read again
// while it shows and redrawn when it changes: the HTML label, and the headset's sprite (dropped, so it is made again)
function labelText(L) {
  if (!L.fn) return;
  const now = performance.now();
  if (L.tx && now - (L.tt || 0) < 100) return;   // (read at most ten times a second)
  L.tt = now;
  const [b, r] = L.fn(), s = b + '|' + r;
  if (s === L.tx) return;
  L.tx = s; L.none = !b && !r;
  L.el.innerHTML = `<b>${esc(b)}</b>${sfxSpan(r)}`;
  L.w = 0; L.nar = undefined; labelRedraw(L);
}
//#use setLabelAlpha~2 _v labelPos _placed placeLabels curCh updateStoryDOM buildTimeline ICON_PLAY ICON_PAUSE
//#use lastTick updateTimeline