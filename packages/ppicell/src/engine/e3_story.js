//#use head
// ================================================================== STORY ==
// The chapters, on story time (seconds): a key, the name on the timeline, and where each begins and ends.
const CH = [
  { key: 'map', name: 'No place', a: 0, b: 60 },
  { key: 'crowd', name: 'Crowds', a: 60, b: 115 },
  { key: 'walls', name: 'Walls', a: 115, b: 180 },
  { key: 'back', name: 'Into the cell', a: 180, b: 255 },
  { key: 'judge', name: 'Can they meet?', a: 255, b: 325 },
  { key: 'red', name: 'Why red?', a: 325, b: 440 },
  { key: 'moments', name: 'Moments', a: 440, b: 510 },
  { key: 'next', name: 'What next', a: 510, b: 575 },
];
// Narration timing: [time in the recording, story time] pairs; the story is stretched or squeezed between them so
// each cue lands on its sentence. Without a recording (the default: captions only) the story keeps its own clock.
// With one (audio/narration.mp3 in the package: e7_app.js, narrationFile) put the pairs here, and where each chapter's
// words end in it as NARRATION_ENDS = { title: 19.5, ... } (the slideshow lets the voice finish there).
const NARRATION_SYNC = [[0, 0], [CH[CH.length - 1].b, CH[CH.length - 1].b]];
//#use storyT narrT T_END
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
// the engine's own params beside the sets' (DEF): none here; GRB2's turns at its domains run at an even pace (evalTrack)
const DEF_MORE = {}, LIN = new Set(['sites_cyc']), LOG = new Set();
//#use C DEF buildDefaults TR key ramp evalTrack storyState fadeVal ST view fitShift
// each set's views nudged so they fit beside the side panel on a wide screen: { set: { view: [daz, del, ddist, dtx,
// dty, dtz] } } (added to the set's own view, in story and explore mode alike); none here
const FIT = {};
// how much further back a view stands on a phone held upright: { set: { view: factor } }
const NARROW = { cell: { default: 1.15 }, ball: { default: 1.5, ball: 1.15, cell: 1.15 }, walls: { default: 1.15 }, lens: { default: 1.45 }, next: { default: 1.15, high: 1.15 },
  sites: { default: 1.2, shuttle: 1.3 } };
//#use narrowOf anchorOf
//#use f2 word listOf
//#use inkCol swCol
const CYAN = '#46d9ff', AMBER = '#ffb43b', MAGENTA = '#ff5ad9', RED = '#ff5a4b', GREEN = '#3ee08f';
// ------------------------------------------------------------------ facts --
// Every number the story quotes, computed from PDATA (and the cell's own counting) as the page runs.
const pc1 = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0');
function storyFacts() {
  const P = PDATA, cell = GL.sets.cell.api(), N = P.N, E = P.E, KN = P.kinds;
  const pop = m => { let c = 0; for (; m; m &= m - 1) c++; return c; };
  let placed = 0, one = 0, two = 0, more = 0, degSum = 0;
  for (let p = 0; p < N; p++) { const c = pop(P.pl[p]); if (c) placed++; if (c === 1) one++; else if (c === 2) two++; else if (c > 2) more++; degSum += cell.deg(p); }
  // the judgement in both readings (a protein's spaces once each; PDATA.judge only where no space is shared), by kind
  const sp = [new Uint16Array(N), new Uint16Array(N)];
  for (let p = 0; p < N; p++) { sp[0][p] = P.spaces(P.pl[p], false); sp[1][p] = P.spaces(P.pl[p], true); }
  const T = [[0, 0, 0], [0, 0, 0]], kJ = new Array(7).fill(0), kR = new Array(7).fill(0);
  let notC = 0, unpl = 0;
  for (let i = 0; i < E; i++) {
    const a = P.la[i], b = P.lb[i];
    if (!P.contact(i)) { notC++; continue; }
    if (!P.pl[a] || !P.pl[b]) { unpl++; continue; }
    for (let g = 0; g < 2; g++) {
      const j = sp[g][a] & sp[g][b] ? 0 : P.judge(P.pl[a], P.pl[b], g === 1);
      T[g][j]++;
      if (!g) for (let k = 0; k < 7; k++) if (P.kind[i] >> k & 1) { kJ[k]++; if (j === 2) kR[k]++; }
    }
  }
  // (regulatory and metabolic evidence alone says nothing of contact: the few contact links that also carry it are left
  // out of the shares by kind)
  const byKind = KN.map((n, k) => ({ n, k, pct: pc1(kR[k], kJ[k]), v: kJ[k] ? kR[k] / kJ[k] : 0 })).filter(o => kJ[o.k] && o.n !== 'regulatory' && o.n !== 'metabolic').sort((x, y) => x.v - y.v);
  // the examples: their links, places, and how their partners' links are judged (strict)
  const ex = s => {
    const p = cell.find(s), t = [0, 0, 0], pl = [];
    for (let k = 0; k < 13; k++) if (P.pl[p] >> k & 1) pl.push(cell.places[k].toLowerCase());
    let nuc = 0, cyt = 0;
    for (let i = 0; i < E; i++) {
      if (P.la[i] !== p && P.lb[i] !== p) continue;
      const q = P.la[i] === p ? P.lb[i] : P.la[i];
      if (q === p || !P.contact(i) || !P.pl[q]) continue;
      t[P.judge(P.pl[p], P.pl[q], false)]++;
      if (P.pl[q] >> 1 & 1) nuc++;
      if (P.pl[q] & 1) cyt++;
    }
    // (its links found in papers, and its rank by links from binary screens: the publication bias)
    let lit = 0;
    for (let i = 0; i < E; i++) if ((P.la[i] === p || P.lb[i] === p) && P.kind[i] & LIT) lit++;
    return { p, sym: s, deg: cell.deg(p), places: pl, t, nuc, cyt, lit, binRank: 1 + binN.filter(n => n > binN[p]).length };
  };
  // links by protein: all, from binary screens, from papers alone (a link of a protein with itself counted once)
  const LIT = 1 << KN.indexOf('literature'), BIN = 1 << KN.indexOf('binary'), allN = new Uint32Array(N), binN = new Uint32Array(N), litOnly = new Uint32Array(N);
  for (let i = 0; i < E; i++) for (const q of P.la[i] === P.lb[i] ? [P.la[i]] : [P.la[i], P.lb[i]]) { allN[q]++; if (P.kind[i] & BIN) binN[q]++; if (P.kind[i] === LIT) litOnly[q]++; }
  const hubs = [...allN.keys()].sort((x, y) => allN[y] - allN[x] || x - y).slice(0, 100), sum = (ids, a) => ids.reduce((t, q) => t + a[q], 0);
  const litTop = (100 * sum(hubs, litOnly) / sum(hubs, allN)).toFixed(0), litAll = (100 * litOnly.reduce((t, x) => t + x, 0) / allN.reduce((t, x) => t + x, 0)).toFixed(0);
  const kindName = n => ({ signaling: 'signalling' }[n] || n);
  return { N, E, placed, unplaced: N - placed, L: P.L, one, two, more, mean: degSum / N, places: cell.places.length,
    s: T[0], g: T[1], judged: T[0][0] + T[0][1] + T[0][2], notC, unpl, byKind, kind: n => byKind.find(o => KN[o.k] === n), kindName,
    litTop, litAll, GRB2: ex('GRB2'), TP53: ex('TP53'), STAT3: ex('STAT3'), RELA: ex('RELA') };
}

// 1st, 2nd, 3rd, 48th
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

function buildStory() {
  const F = storyFacts(), cell = GL.sets.cell.api(), net = cell.net(2), drawn = net.ab.length / 2;
  const [s0, s1, s2] = F.s, g2 = F.g[2], J = F.judged, bin = F.kind('binary'), cx = F.kind('complexes'), lo = F.byKind[0], hi = F.byKind[F.byKind.length - 1];
  const { GRB2, TP53, STAT3, RELA } = F, quarter = Math.round(100 * F.unplaced / F.N);
  // what is drawn, in round numbers (about 2,000 links; the red ones raised so they show), and the crowd's molecules
  const about = fmt(Math.round(drawn / 100) * 100), redDrawn = Array.from(net.cls).filter(c => c === 2).length, crowdN = GL.sets.crowd.stats().n;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  // a param that picks something (a step: never eased) jumps from one value to the next at time t
  const jump = (n, t, v0, v1) => { key(n, t, v0); key(n, t, v1); };
  const step = (at, out, col, b, text) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  // ------------------------------------------------------------ panel copy
  // Each chapter's text: data-at is when a line appears (seconds into the chapter), data-out when it goes. The headset's
  // panel cannot scroll, so no chapter shows more than fits at once: parts that take turns in one place (turns), each
  // fading out as the next comes.
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const html = {
    map: `<h1 data-at="0.6">${esc(XR_TITLE)}</h1>
      <p class="lede" data-at="1.6">An interactome put back into a cell</p>
      ${turns(`<p data-at="3" data-out="20.5">An interactome is a map of which proteins bind which. This one has ${fmt(F.N)} human proteins and ${fmt(F.E)} links, with ${word(PDATA.kinds.length)} kinds of evidence (Menche and colleagues, 2015). Most suggest physical contact; ${fmt(F.notC)} do not.</p>
        <p data-at="10" data-out="20.5">Each protein is one dot. About ${about} links are drawn, the best supported of each kind.</p>`,
      `<p data-at="21" data-out="40.5">A hub is a protein with many links. The biggest sit in the middle: GRB2 alone has ${fmt(GRB2.deg)}. On average a protein has ${Math.round(F.mean)}.</p>`,
      `<p data-at="41">But a map like this says who binds whom, not where. Beside it stands an empty model cell.</p>
        <p data-at="48" class="amber">In a real cell two proteins can bind only if they meet.</p>`)}`,
    crowd: `<h2 data-at="0.6">Billions and thousands</h2>
      ${turns(`<p data-at="1.5" data-out="20.5">Take one spot of the cytosol, the watery inside of the cell, and look closer.</p>
        <p data-at="9" data-out="20.5">A cube about 100 nanometres across holds a few thousand protein molecules. They fill a quarter to a third of the space. Here ${fmt(crowdN)} are drawn, not to scale.</p>`,
      `<p data-at="21" data-out="33.5">A whole human cell holds roughly 1 to 10 billion protein molecules, of about ten thousand kinds.</p>`,
      `<p data-at="34">So one dot of the map stands for all the copies of one kind of protein in one place: the bright ones here.</p>
        <p data-at="41" class="amber">One dot per kind and place: ${fmt(F.L)} dots for the ${fmt(F.placed)} proteins with a place.</p>`)}`,
    walls: `<h2 data-at="0.6">Spaces and walls</h2>
      ${turns(`<p data-at="1.5" data-out="26.5">A cell is not one bag of water. Membranes divide it into spaces: the cytosol, the nucleoplasm inside the nucleus, the inside of the endoplasmic reticulum, the Golgi and every other organelle, and outside the cell.</p>
        <p data-at="14" data-out="26.5" class="amber">Two proteins can bind only where they share a space. Each mitochondrion, lysosome, endosome and peroxisome is a space of its own.</p>`,
      `<p data-at="27" data-out="44.5">A protein in a membrane can face one side or both. A receptor reaches across the plasma membrane: a part outside meets a signal, a part inside meets a partner.</p>`,
      `<p data-at="45">A few gates let proteins cross: the nuclear pores, and import into the endoplasmic reticulum, the mitochondria and the peroxisomes. Vesicles carry others between the endoplasmic reticulum, the Golgi, endosomes, lysosomes and the outside.</p>
        <p data-at="56" class="caption">Close-ups not to scale.</p>`)}`,
    back: `<h2 data-at="0.6">Back into the cell</h2>
      ${turns(`<p data-at="1.5" data-out="15.5">Now each protein goes where the Human Protein Atlas finds it, in ${word(F.places)} places of the model cell.</p>
        <p data-at="5" data-out="15.5">The Atlas is a public map of where human proteins sit. For each protein, cultured human cells are stained with an antibody that sticks to it, and photographed under a microscope.</p>`,
      `<p data-at="16" data-out="42.5">A protein in several places splits into copies on the way: ${fmt(F.one)} proteins have one place, ${fmt(F.two)} two and ${fmt(F.more)} three or more. ${fmt(F.L)} protein locations in all.</p>
        <p data-at="28" data-out="42.5">Within each place, proteins that link to each other gather together. Each mitochondrion keeps its own links.</p>`,
      `<p data-at="43">The links take the colour of their verdict.</p>
        <p data-at="55" class="amber">${fmt(F.unplaced)} proteins, a ${quarter > 22 && quarter < 28 ? 'quarter' : `${quarter} %`} of the map, have no place in the Atlas: it has no reliable picture of them yet. They wait outside the cell for now, grey.</p>`)}`,
    judge: `<h2 data-at="0.6">Can they meet?</h2>
      ${turns(`<p data-at="1.5" data-out="42.5">Judged strictly (an organelle's proteins inside it), the ${fmt(J)} links that suggest contact, between proteins that both have a place:</p>
        <ul class="steps">${step(3, 42.5, CYAN, `${fmt(s0)} possible`, ` (${pc1(s0, J)} %): a shared space`)}
          ${step(16, 42.5, AMBER, `${fmt(s1)} through a gate`, ` (${pc1(s1, J)} %): one known crossing apart`)}
          ${step(30, 42.5, RED, `${fmt(s2)} impossible`, ` (${pc1(s2, J)} %): no shared space, no crossing`)}</ul>`,
      `<p data-at="43">RELA, half of NF-κB, is listed only in the cytosol: the Atlas photographs resting cells. Signalled, it moves into the nucleus.</p>
        <p data-at="50" class="amber">So ${fmt(RELA.t[1])} of its links pass a gate.</p>
        <p data-at="58" class="caption">Counted apart: ${fmt(F.notC)} links that are not contacts (regulatory or metabolic only) and ${fmt(F.unpl)} with an end without a place. These are counts: about ${about} links are drawn, the red ones raised to ${fmt(redDrawn)} so they show.</p>`)}`,
    red: `<h2 data-at="0.6">Why red?</h2>
      ${turns(`<p data-at="1.5" data-out="13.5">Red links are the puzzle. In the Atlas, their two proteins never share a space, and no known gate joins their spaces. As drawn, they could not meet.</p>
        <p data-at="7" data-out="13.5" class="amber">So either the link is wrong, or a place is missing from the Atlas. Where do links come from?</p>`,
      `<ul class="steps">${step(19, 42.5, CYAN, 'Two-hybrid', ` tests in yeast, a single-celled fungus that is easy to grow. Both proteins are made inside one yeast cell, each carrying half of a switch. If they stick together, the halves meet and the yeast turns on a gene that shows. It tells you a pair can stick, not whether they meet in our cells.`)}</ul>
        <p data-at="31" data-out="42.5" class="amber">Binary links come mostly from such tests: ${bin.pct} % of them are impossible (those with both places known).</p>`,
      `<ul class="steps">${step(43, 65.5, AMBER, 'Purification', ' fishes. Cells are broken open, one protein is caught with a molecular hook, and whatever comes up with it is weighed in a mass spectrometer, a machine that tells proteins apart by weight. Once the cells are broken, proteins from different spaces can meet in the tube.')}</ul>
        <p data-at="55" data-out="65.5" class="amber">Yet complexes, mostly collected by hand from many such studies, agree best: ${cx.pct} % impossible.</p>`,
      `<ul class="steps">${step(66, 83.5, GREEN, 'Proximity labelling', ' works in living cells. The bait, a protein you pick, carries an enzyme that puts a small tag on every protein within about 10 nanometres. The tagged proteins are then fished out. It tells you who was near, not who held on.')}</ul>
        <p data-at="76" data-out="83.5">Large maps made this way came after this interactome.</p>`,
      `<p data-at="84" data-out="93.5">Across the ${word(F.byKind.length)} kinds of evidence that suggest contact, from ${lo.pct} % impossible (${F.kindName(lo.n)}) to ${hi.pct} % (${F.kindName(hi.n)}); a link counts under each of its kinds. This goes with the kind of evidence; it does not prove a method caused it.</p>`,
      `<p data-at="94" data-out="104.5">Partly the Atlas: it does not say which side of a membrane a protein is on. Inside only, ${fmt(s2)} links are impossible; either side, ${fmt(g2)}. One is too strict, the other too generous to rule anything out.</p>`,
      `<p data-at="105" class="amber">And ${fmt(F.unplaced)} proteins have no place at all: ${fmt(F.unpl)} of their links cannot be judged.</p>`)}`,
    moments: `<h2 data-at="0.6">Not all at once</h2>
      ${turns(`<p data-at="1.5" data-out="35.5">A hub does not hold all its partners at once. GRB2 has ${fmt(GRB2.deg)} links but three binding domains: an SH2, which holds a receptor's phosphorylated tyrosine, and two SH3s, which hold proline-rich stretches.</p>
        <p data-at="18" data-out="35.5" class="amber">Its partners take turns. A link is a moment in time, not a permanent wire.</p>`,
      `<p data-at="36" data-out="44.5">TP53, one of the best-known proteins, has ${fmt(TP53.deg)} links. The Atlas lists it in the ${listOf(TP53.places)}, and it goes to and fro through the nuclear pores.</p>
        <p data-at="40" data-out="44.5">${fmt(TP53.nuc)} of its partners are listed in the nucleoplasm, ${fmt(TP53.cyt)} in the cytosol (some in both).</p>`,
      `<p data-at="45" data-out="53.5" class="amber">Part of that is fame. TP53 is among the most studied proteins, and ${fmt(TP53.lit)} of its links come from papers. In systematic two-hybrid screens, which test pairs whatever their fame, it ranks ${ordinal(TP53.binRank)}.</p>`,
      `<p data-at="54">The Atlas lists STAT3 in the ${listOf(STAT3.places)}. It sits mostly in the cytosol until a kinase at a receptor, JAK2, switches it on; it pairs up, passes a pore and binds DNA and partners such as EP300 in the nucleus.</p>
        <p data-at="62" class="amber">Its ${fmt(STAT3.deg)} links are in ${word(STAT3.places.length)} places; when each happens is not in this map.</p>`)}`,
    next: `<h2 data-at="0.6">What it would take</h2>
      ${turns(`<p data-at="1.5" data-out="50.5">A map true to a real cell needs where and when each pair meets.</p>
        <ul class="steps">${step(5, 47.5, GREEN, 'Proximity maps', ' start from a bait: a chosen protein fitted with an enzyme that tags every protein near it in a living cell. Hundreds to thousands of baits show who is near whom, place by place')}
          ${step(22, 47.5, CYAN, 'Cryo-electron tomography', ' cuts frozen cells thin and shows single molecules where they are')}
          ${step(37, 47.5, MAGENTA, 'Whole-cell volumes', ' map every organelle of a whole cell in 3D')}</ul>`,
      `<p data-at="48" data-out="54.5">And fairer maps: well-studied proteins collect links, unstudied ones look lonely. Among the 100 biggest hubs, ${F.litTop} % of links come from papers alone, against ${F.litAll} % across the map. A map of binding is also a map of attention.</p>`,
      `<p data-at="55">Until then, the honest cell: dense networks inside each space, thin traffic through the gates, and a red remainder still to explain.</p>
        <p data-at="59"><button class="btn primary" id="btnGoExplore" type="button">Explore the cell</button></p>
        <p class="credits" data-at="60">The interactome of J. Menche and colleagues, Science 347, 1257601 (2015); the places from the Human Protein Atlas (proteinatlas.org). The judgement is this story's own.</p>`)}`,
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
  const lbl = [];   // story labels, placed once the camera is built: [set, at, html, tIn, tOut, cls]
  const L = (...a) => lbl.push(a);
  start({ cell_shell: 1, cell_net: 0, cell_amb: 1, cell_red: 1, cell_show: 2, cell_faces: 0, cell_kind: -1, cell_pp: -1, cell_pc: -1,
    ball_move: 0, ball_morph: 0, ball_tint: 0, ball_in: 1, ball_out: 1, crowd_open: 0, crowd_mark: 0, walls_lit: 0, walls_wall: 0, walls_parts: 0,
    lens_open: 0, lens_focus: 0, sites_act: 0, sites_cyc: 0, sites_tp: 0, sites_move: 0, next_halo: 0, next_slab: 0, next_vol: 0 });
  let a, b;
  // 1. A map without a place: the hairball turns beside the empty cell
  a = C.map.a; b = C.map.b;
  show('ball', 0.2, 2);
  show('cell', 1, 4);
  cam(a, 'ball', 'ball', -25);
  cam(a + 18, 'ball', 'ball', 5);
  cam(a + 40, 'ball', 'default', 0);
  cam(b, 'ball', 'default', 14, 'spin');
  L('ball', 'top', `<b>${fmt(F.N)} proteins</b> · about ${about} links drawn`, a + 6, a + 20, 'cyn');
  L('ball', 'hub', `<b>GRB2</b> · ${fmt(GRB2.deg)} links`, a + 22, a + 39, 'amb');
  L('cell', 'nucleus', '<b>An empty cell</b> · no proteins yet', a + 42, b - 1, '');
  sfxCue(a + 0.5, 'grow', 'ball', 'ball', { dur: 3, gain: 0.35 });
  // 2. Billions and thousands: one dot opens into its crowd
  a = C.crowd.a; b = C.crowd.b;
  ramp('ball_a', a, a + 3, 1, 0);
  show('crowd', a + 1, a + 3, b - 3, b - 0.5);
  ramp('crowd_open', a + 5, a + 13, 0, 1);
  ramp('crowd_mark', a + 33, a + 37, 0, 1);
  ramp('crowd_open', b - 9, b - 3, 1, 0);
  ramp('cell_shell', a + 6, a + 12, 1, 0.45); ramp('cell_shell', b - 8, b - 2, 0.45, 1);
  cam(a + 3, 'cell', 'default', 10);
  cam(a + 12, 'crowd', 'default', -10);
  cam(a + 33, 'crowd', 'close', 0);
  cam(b - 9, 'crowd', 'default', 25, 'spin');
  cam(b, 'cell', 'default', 30);
  L('crowd', 'dot', '<b>One dot</b> · in the cytosol', a + 2, a + 6, 'cyn');
  L('crowd', 'cube', `<b>About 100 nm</b> · ${fmt(crowdN)} molecules, not to scale`, a + 14, a + 33, '');
  L('crowd', 'mark', '<b>One kind, one place</b> · one dot', a + 37, b - 9, 'cyn');
  sfxCue(a + 5, 'whoosh', 'crowd', 'dot', { dur: 2, pitch: 0.9 });
  sfxCue(a + 9, 'patter', 'crowd', 'cube', { dur: 4, gain: 0.3 });
  sfxCue(a + 33, 'ping', 'crowd', 'mark', { gain: 0.4 });
  // 3. Spaces and walls: the spaces light one by one, the walls glow, then a receptor, a pore and an import site
  a = C.walls.a; b = C.walls.b;
  show('walls', a, a + 2, b - 2, b);
  // (six spaces, one every 3.2 s: the cytosol, the nucleoplasm, the ER's and the Golgi's lumens, the mitochondria, the
  // small organelles, outside)
  const SPACES = ['cytosol', 'nucleus', 'lumen', 'mito', 'small', 'outside'], litAt = i => a + 4 + 3.2 * i;
  ramp('walls_lit', a + 2, litAt(0), 0, 1);
  for (let i = 1; i < SPACES.length; i++) ramp('walls_lit', litAt(i) - 1.4, litAt(i), i, i + 1);
  ramp('walls_lit', a + 23, a + 26, SPACES.length, 0);
  ramp('walls_wall', a + 14, a + 18, 0, 1);
  ramp('walls_parts', a + 26, a + 29, 0, 1);
  ramp('walls_wall', b - 5, b - 2, 1, 0);
  ramp('cell_shell', a + 27, a + 30, 1, 0.35); ramp('cell_shell', b - 3, b, 0.35, 1);   // (the close-ups clear of the organelles' skins)
  cam(a + 1, 'walls', 'default', 30);
  cam(a + 24, 'walls', 'default', 55, 'spin');
  cam(a + 31, 'walls', 'receptor', 0);
  cam(a + 43, 'walls', 'receptor', 25, 'spin');
  cam(a + 48, 'walls', 'pore', 0);
  cam(a + 54, 'walls', 'pore', 20, 'spin');
  cam(a + 58, 'walls', 'import', 0);
  cam(b, 'walls', 'default', 60);
  SPACES.forEach((k, i) => L('walls', k, `<b>${['The cytosol', 'The nucleoplasm', 'The endoplasmic reticulum and Golgi lumens', 'Mitochondria', 'Lysosomes, endosomes, peroxisomes', 'Outside'][i]}</b>${i === 3 || i === 4 ? ' · each its own space' : ''}`, litAt(i) - 1, litAt(i) + 2.2, 'cyn'));
  L('walls', 'recOut', '<b>Outside</b> · meets a signal', a + 32, a + 44, 'amb');
  L('walls', 'recIn', '<b>Inside</b> · meets a partner', a + 34, a + 44, 'grn');
  L('walls', 'pore', '<b>A nuclear pore</b> · a gate', a + 49, a + 56, 'amb');
  L('walls', 'import', '<b>An import site</b> · into a mitochondrion', a + 59, b - 1, 'amb');
  SPACES.forEach((k, i) => sfxCue(litAt(i) - 1, 'ping', 'walls', k, { gain: 0.3, pitch: Math.pow(2, i / 12) }));
  sfxCue(a + 31, 'whoosh', 'walls', 'receptor', { dur: 2 });
  sfxCue(a + 48, 'whoosh', 'walls', 'pore', { dur: 2 });
  // 4. Back into the cell: the hairball moves over the cell, every dot flies to its place, the cell's own take over
  a = C.back.a; b = C.back.b;
  show('ball', a + 1, a + 3);
  ramp('ball_move', a + 5, a + 13, 0, 1);
  ramp('ball_morph', a + 15, a + 43, 0, 1);
  ramp('ball_tint', a + 43, a + 49, 0, 1);
  ramp('cell_net', a + 51, a + 57, 0, 1);
  ramp('ball_in', a + 52, a + 58, 1, 0);
  cam(a + 2, 'ball', 'default', 0);
  cam(a + 13, 'ball', 'cell', -10);
  cam(a + 43, 'ball', 'cell', 50, 'spin');
  cam(a + 58, 'cell', 'default', 30, null, [0, 6, 1.4]);   // (standing back: the proteins without a place round the cell)
  cam(b - 1, 'cell', 'default', 70);
  L('ball', 'outside', `<b>${fmt(F.unplaced)} proteins</b> · no place in the Atlas`, a + 55, b - 1, '');
  L('cell', CELL_MITO(), '<b>A mitochondrion</b> · its own links', a + 30, a + 42, 'mag');
  sfxCue(a + 5, 'whoosh', 'ball', 'ball', { dur: 4, pitch: 0.8 });
  sfxCue(a + 15, 'rush', 'ball', 'ball', { dur: 6, gain: 0.35 });
  sfxCue(a + 43, 'spark', 'cell', 'centre', { gain: 0.4 });
  // 5. Can they meet? The verdicts in turn, then RELA's links through the pores
  a = C.judge.a; b = C.judge.b;
  ramp('ball_out', a + 1, a + 5, 1, 0);
  ramp('ball_a', a + 5, a + 6, 1, 0);
  // (the cell drew all three since the morph: the amber and the red ones fade out, then come back one kind at a time)
  ramp('cell_amb', a + 1, a + 3, 1, 0); ramp('cell_red', a + 1, a + 3, 1, 0);
  ramp('cell_amb', a + 16, a + 18, 0, 1);
  ramp('cell_red', a + 30, a + 32, 0, 1);
  const rela = RELA.p, relaAt = dotOf(net, rela);
  jump('cell_pp', a + 43, -1, rela);
  jump('cell_pp', b - 1, rela, -1);
  cam(a + 2, 'cell', 'default', 70);
  cam(a + 42, 'cell', 'default', 130, 'spin');
  cam(a + 47, 'cell', 'default', 150, null, [0, 4, -1.0, CELL_NUC()[0], CELL_NUC()[1], CELL_NUC()[2]]);
  cam(b, 'cell', 'default', 185, 'spin', [0, 4, -1.0, CELL_NUC()[0], CELL_NUC()[1], CELL_NUC()[2]]);
  L('cell', 'edge', `<b>Possible</b> · ${fmt(s0)}, read strictly`, a + 4, a + 16, 'cyn');
  L('cell', 'nucleus', `<b>Through a gate</b> · ${fmt(s1)}, read strictly`, a + 17, a + 30, 'amb');
  L('cell', [0.1, -0.6, 0.45], `<b>Impossible</b> · ${fmt(s2)}, read strictly`, a + 31, a + 42, 'mag');
  if (relaAt) L('cell', relaAt, `<b>RELA</b> · cytosol only, ${fmt(RELA.t[1])} links through a gate`, a + 45, b - 1, 'amb');
  sfxCue(a + 3, 'link', 'cell', 'edge', { gain: 0.35 });
  sfxCue(a + 16, 'link', 'cell', 'nucleus', { gain: 0.35, pitch: 0.9 });
  sfxCue(a + 30, 'knock', 'cell', 'centre', { gain: 0.35 });
  sfxCue(a + 43, 'clink', 'cell', 'centre', { gain: 0.4 });
  // 6. Why red? What red means, on the cell (the others dimmed); the lenses one by one, each explained; the shares; the
  // faces, strict then generous; the proteins without a place
  a = C.red.a; b = C.red.b;
  ramp('cell_amb', a + 1, a + 3, 1, 0.15); ramp('cell_amb', a + 12, a + 14, 0.15, 1);
  show('lens', a + 13, a + 15, a + 84, a + 86);
  ramp('lens_open', a + 14, a + 19, 0, 1);
  ramp('lens_focus', a + 19, a + 21, 0, 1); ramp('lens_focus', a + 43, a + 45, 1, 2); ramp('lens_focus', a + 66, a + 68, 2, 3); ramp('lens_focus', a + 83, a + 85, 3, 0);
  jump('cell_faces', a + 97, 0, 1);
  jump('cell_faces', a + 104, 1, 0);
  jump('cell_show', a + 104, 2, 3);
  jump('cell_show', C.moments.a + 2.5, 3, 2);   // (as the cell fades out, nearly unseen: a hidden set is not updated, so later it would build as it comes back)
  cam(a + 1, 'cell', 'default', 190, null, [0, 4, -1.0, CELL_NUC()[0], CELL_NUC()[1], CELL_NUC()[2]]);
  cam(a + 12, 'cell', 'default', 215, 'spin', [0, 4, -1.0, CELL_NUC()[0], CELL_NUC()[1], CELL_NUC()[2]]);
  cam(a + 14, 'lens', 'default', 0);
  cam(a + 21, 'lens', 'yeast', 0);
  cam(a + 42, 'lens', 'yeast', 8, 'spin');
  cam(a + 45, 'lens', 'apms', 0);
  cam(a + 65, 'lens', 'apms', 8, 'spin');
  cam(a + 68, 'lens', 'prox', 0);
  cam(a + 83, 'lens', 'prox', 6, 'spin');
  cam(a + 86, 'cell', 'default', 20);
  cam(a + 104, 'cell', 'default', 60, 'spin');
  cam(b, 'cell', 'default', 85, 'spin', [0, 4, 1.4]);
  L('cell', [0.1, -0.6, 0.45], `<b>Impossible</b> · ${fmt(s2)}, read strictly`, a + 2, a + 13, 'mag');
  L('lens', 'yeastTag', `<b>Binary</b> · ${bin.pct} % impossible, of those with both places known`, a + 31, a + 86, 'cyn');
  L('lens', 'apmsTag', `<b>Complexes</b> · mostly curated · ${cx.pct} % impossible`, a + 55, a + 86, 'amb');
  L('lens', 'proxTag', '<b>Proximity</b> · large maps came after this one', a + 76, a + 86, 'grn');
  L('cell', [0.1, -0.6, 0.45], `<b>Strict: inside only</b> · ${fmt(s2)} impossible`, a + 94, a + 97, 'mag');
  L('cell', [0.1, -0.6, 0.45], `<b>Generous: either side</b> · ${fmt(g2)} impossible, too generous to rule any out`, a + 98, a + 104, 'cyn');
  L('cell', [-0.3, -1.25, 0.3], `<b>${fmt(F.unplaced)} without a place</b> · ${fmt(F.unpl)} links unjudged`, a + 105, b - 1, '');
  sfxCue(a + 2, 'knock', 'cell', 'centre', { gain: 0.3 });
  [19, 43, 66].forEach(d => sfxCue(a + d, 'pick', 'lens', d === 19 ? 'yeast' : d === 43 ? 'apms' : 'prox', { gain: 0.35 }));
  sfxCue(a + 97, 'snap', 'cell', 'centre', { gain: 0.35 });
  // 7. Not all at once: GRB2's domains and partners in turn; TP53 to and fro; STAT3 through a pore
  a = C.moments.a; b = C.moments.b;
  ramp('cell_a', a, a + 3, 1, 0);
  show('sites', a + 1, a + 4, b - 2, b);
  ramp('sites_cyc', a + 6, a + 35, 0, 7);
  ramp('sites_act', a + 35, a + 39, 0, 1);
  ramp('sites_tp', a + 39, a + 41, 0, 1); ramp('sites_tp', a + 52, a + 54, 1, 0);
  ramp('sites_move', a + 54, a + 68, 0, 1);
  cam(a + 2, 'sites', 'default', -20);
  cam(a + 12, 'sites', 'close', 0);
  cam(a + 34, 'sites', 'close', 25, 'spin');
  cam(a + 39, 'sites', 'shuttle', 0);
  cam(b, 'sites', 'shuttle', 25, 'spin');
  L('sites', 'grb2', `<b>GRB2</b> · ${fmt(GRB2.deg)} links`, a + 4, a + 12, 'amb');
  L('sites', 'shell', `<b>${fmt(GRB2.deg)} partners</b> · not all at once`, a + 20, a + 34, '');
  L('sites', 'tp53', `<b>TP53</b> · ${fmt(TP53.deg)} links`, a + 41, a + 53, 'mag');
  L('sites', 'cytosol', '<b>Cytosol</b>', a + 40, b - 1, '');
  L('sites', 'nucleus', '<b>Nucleus</b>', a + 40, b - 1, '');
  L('sites', 'stat3', `<b>STAT3</b> · ${fmt(STAT3.deg)} links`, a + 55, b - 1, 'cyn');
  L('sites', 'jak2', '<b>JAK2</b> · at a receptor', a + 55, a + 60, 'amb');
  L('sites', 'ep300', '<b>EP300</b> · in the nucleus', a + 64, b - 1, 'grn');
  sfxCue(a + 6, 'click', 'sites', 'grb2', { gain: 0.3 });
  sfxCue(a + 54, 'whoosh', 'sites', 'pore', { dur: 2, pitch: 1.1 });
  // 8. What it would take: proximity maps, a tomogram's slab, a whole-cell volume; then the honest cell
  a = C.next.a; b = C.next.b;
  ramp('cell_a', a, a + 3, 0, 1);
  show('next', a + 2, a + 4, a + 50, a + 52);
  ramp('cell_net', a + 2, a + 5, 1, 0.25); ramp('cell_net', a + 49, a + 53, 0.25, 1);   // (the cell's links dimmed under the methods)
  ramp('next_halo', a + 5, a + 11, 0, 1); ramp('next_halo', a + 20, a + 22, 1, 0);
  ramp('next_slab', a + 22, a + 28, 0, 1); ramp('next_slab', a + 35, a + 37, 1, 0);
  ramp('next_vol', a + 37, a + 43, 0, 1); ramp('next_vol', a + 49, a + 51, 1, 0);
  cam(a + 2, 'cell', 'default', 0);
  cam(a + 20, 'next', 'default', 30, 'spin');
  cam(a + 26, 'next', 'slab', 0);
  cam(a + 35, 'next', 'slab', 18, 'spin');
  cam(a + 41, 'next', 'high', 0);
  cam(a + 51, 'next', 'high', 20, 'spin');
  cam(b, 'cell', 'default', 50, 'spin');
  L('next', 'halo', '<b>Proximity maps</b> · near a bait', a + 7, a + 21, 'grn');
  L('next', 'slab', '<b>A tomogram</b> · molecules in place', a + 25, a + 36, 'cyn');
  L('next', 'vol', '<b>A whole-cell volume</b>', a + 40, a + 50, 'mag');
  L('cell', 'edge', '<b>Dense inside each space</b>', a + 52, b - 0.5, 'cyn');
  L('cell', 'nucleus', '<b>Thin traffic through gates</b>', a + 53, b - 0.5, 'amb');
  L('cell', [0.1, -0.6, 0.45], `<b>A red remainder</b> · ${fmt(s2)} links`, a + 54, b - 0.5, 'mag');
  sfxCue(a + 5, 'bubble', 'next', 'halo', { gain: 0.3 });
  sfxCue(a + 22, 'whoosh', 'next', 'slab', { dur: 2 });
  sfxCue(a + 37, 'grow', 'next', 'vol', { dur: 3, gain: 0.3 });
  sfxCue(a + 52, 'rise', 'cell', 'centre', { dur: 2.5, gain: 0.4 });
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  for (const l of lbl) label(...l);
}
// a protein's first dot in the cell's background (its position, in the cell's frame), or null
function dotOf(net, p) { for (let i = 0; i < net.n; i++) if (net.prot[i] === p) return Array.from(net.pos.subarray(3 * i, 3 * i + 3)); return null; }
// the cell's nucleus and first mitochondrion (for views and labels)
const CELL_NUC = () => GL.sets.cell.api().CELL.nuc.c, CELL_MITO = () => GL.sets.cell.api().CELL.mitos[0].c;
// no set turns into another at a hand-over (buildCamera's MORPH): the ball, the crowd, the walls, the lenses and what
// comes next share the cell's frame (FRAME)
const MORPH = {};
//#use buildCamera setYaw smoothSeg spinEase storyCam LBL labelEl label sfxSpan buildSetLabels labelText
//#use setLabelAlpha~2 _v labelPos _placed placeLabels curCh updateStoryDOM trackHTML buildTimeline ICON_PLAY ICON_PAUSE
//#use lastTick updateTimeline
