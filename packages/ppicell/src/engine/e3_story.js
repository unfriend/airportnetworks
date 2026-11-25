//#use head
// ================================================================== STORY ==
// The chapters, on story time (seconds): a key, the name on the timeline, and where each begins and ends.
const CH = [
  { key: 'map', name: 'No place', a: 0, b: 60 },
  { key: 'crowd', name: 'Crowds', a: 60, b: 115 },
  { key: 'walls', name: 'Walls', a: 115, b: 223 },
  { key: 'back', name: 'Into the cell', a: 223, b: 305 },
  { key: 'judge', name: 'Can they meet?', a: 305, b: 380 },
  { key: 'machines', name: 'Machines', a: 380, b: 442 },
  { key: 'red', name: 'Why red?', a: 442, b: 581 },
  { key: 'moments', name: 'Moments', a: 581, b: 651 },
  { key: 'next', name: 'What next', a: 651, b: 716 },
];
// Narration timing: [time in the recording, story time] pairs; the story is stretched or squeezed between them so
// each cue lands on its sentence. Without a recording (the default: captions only) the story keeps its own clock.
// With one (audio/narration.mp3 in the package: e7_app.js, narrationFile) put the pairs here, and where each chapter's
// words end in it as NARRATION_ENDS = { title: 19.5, ... } (the slideshow lets the voice finish there).
// v205: the words changed (sides and complexes) and the recording is not made yet (the voice needs Kokoro: README.md),
// so there is none (the v204 one is kept as src/narration-v204-old.mp3, not served) and these tables are laid out by
// tools/voice/narrate.mjs --dry on estimated durations (16.2 characters a second, as the old recording read), so the
// subtitles keep the voice's pace; node tools/voice/narrate.mjs ppicell writes both from the real recording.
const NARRATION_SYNC = [
  [0, 0], [3.3, 3], [16.07, 10], [50.17, 41], [58.24, 48],  // No place
  [71.44, 60], [73.09, 61.5], [81.54, 69], [96.77, 81], [111.07, 94], [119.71, 101],  // Crowds
  [135.11, 115], [136.76, 116.5], [160.39, 129], [241.79, 203], [254.31, 212],  // Walls
  [266.41, 223], [268.06, 224.5], [285.27, 239],      // Into the cell
  [357.87, 305], [360.18, 307.1], [375.06, 313], [419.72, 353.6], [435.04, 360],  // Can they meet?
  [457.04, 380], [496.64, 416], [518.97, 434],        // Machines
  [527.77, 442], [548.67, 461], [572.86, 473], [586.06, 485], [607.47, 497], [621.59, 508],
  [641.95, 518], [661.75, 536], [677.6, 548], [694.38, 561], [707.71, 571],  // Why red?
  [718.71, 581], [758.31, 617], [771.5, 626], [789.76, 635], [804.82, 643],  // Moments
  [813.62, 651], [815.93, 653.1], [827.17, 656], [874.47, 699], [889.21, 706], [906.97, 715.3],
  [907.74, 716],                                      // What next
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { map: 69.05, crowd: 124.95, walls: 263.8, back: 345.3, judge: 440.4, machines: 526.45, red: 714.5, moments: 811.2, next: 906.75 };
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
  // and with sides (PSIDES): the story's judgement is carried (UniProt's sides where it names the place, elsewhere the
  // protein's own build), the unknown ones strict (C) or generous; the old one without sides (T) to compare: how much of
  // the span between its two readings the sides settle, and how many links fare worse with them (and how many of those
  // turn red)
  const T = [[0, 0, 0], [0, 0, 0]], Cs = [[0, 0, 0], [0, 0, 0]], kJ = new Array(7).fill(0), kR = new Array(7).fill(0), SD = PSIDES;
  let notC = 0, unpl = 0, span = 0, settled = 0, worse = 0, toRed = 0;
  for (let i = 0; i < E; i++) {
    const a = P.la[i], b = P.lb[i];
    if (!P.contact(i)) { notC++; continue; }
    if (!P.pl[a] || !P.pl[b]) { unpl++; continue; }
    const o = [0, 1].map(g => (sp[g][a] & sp[g][b] ? 0 : P.judge(P.pl[a], P.pl[b], g === 1))), c = [SD.judge(i, false, true), SD.judge(i, true, true)];
    for (let g = 0; g < 2; g++) { T[g][o[g]]++; Cs[g][c[g]]++; }
    for (let k = 0; k < 7; k++) if (P.kind[i] >> k & 1) { kJ[k]++; if (c[0] === 2) kR[k]++; }
    if (o[0] !== o[1]) { span++; if (c[0] === c[1]) settled++; }
    if (c[0] > o[0]) { worse++; if (c[0] === 2) toRed++; }
  }
  // the sides themselves (protein-places with a membrane: known from UniProt's naming of the place, or carried from the
  // protein's own build; the mitochondria's layers told apart), and the complexes' positions
  let memAll = 0, named = 0, carried = 0, mito = 0;
  for (let l = 0; l < P.L; l++) {
    if (SD.cls[l] === 255) continue;
    memAll++;
    if (SD.cls[l] >= 2) { if (SD.by[l] === 't') carried++; else { named++; if (P.lPlace[l] === 5) mito++; } }
  }
  const cxK = [0, 0, 0, 0, 0];
  let cxGate = 0, cxOdd = 0;
  const pm = SD.masks(false, true);
  for (const c of SD.cx) {
    const k = SD.cxPos(c, false, true).kind;
    cxK[k]++;
    if (k !== 3) continue;
    if (SD.cxGate(c, false, true)) cxGate++;
    // (a single member the odd one out: the others share a space without it)
    const pl = c.members.filter(p => P.pl[p]);
    if (pl.some(x => pl.reduce((m, p) => (p === x ? m : m & pm[p]), 1023))) cxOdd++;
  }
  // the proteasome's parts by the two spaces they are listed in, and BiP (HSPA5), the ER's own chaperone
  const prot = SD.cx.find(c => c.name === '26S proteasome complex'), pr = { both: 0, cyt: 0, nuc: 0 };
  if (prot) for (const p of prot.members) { const m = pm[p] & 3; if (m === 3) pr.both++; else if (m === 1) pr.cyt++; else if (m === 2) pr.nuc++; }
  const bip = cell.find('HSPA5'), bipCyt = bip >= 0 && P.pl[bip] === 1;
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
      t[PSIDES.judge(i, false, true)]++;   // (the story's judgement: carried sides, the unknown ones strict)
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
    s: Cs[0], g: Cs[1], os: T[0], og: T[1], span, settled, worse, toRed, memAll, named, carried, mito, cxN: SD.cx.length, cxK, cxGate, cxOdd, pr, bip, bipCyt,
    judged: T[0][0] + T[0][1] + T[0][2], notC, unpl, byKind, kind: n => byKind.find(o => KN[o.k] === n), kindName,
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
  // the Protein Data Bank's entries, credited in small print (the models' credits, models.json: 'PDB 1ABC (Someone et al., 2000)')
  const cite = k => molCredit(k), pdbId = k => cite(k).split(' ')[1] || '', crowdK = GL.sets.crowd.stats().kinds;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  // a param that picks something (a step: never eased) jumps from one value to the next at time t
  const jump = (n, t, v0, v1) => { key(n, t, v0); key(n, t, v1); };
  const step = (at, out, col, b, text, say) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''}${say !== undefined ? ` data-say="${esc(say)}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  // ------------------------------------------------------------ panel copy
  // Each chapter's text: data-at is when a line appears (seconds into the chapter), data-out when it goes. The headset's
  // panel cannot scroll, so no chapter shows more than fits at once: parts that take turns in one place (turns), each
  // fading out as the next comes.
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  // The voice has its own words (data-say: tools/voice/narrate.mjs speaks them, the headset's subtitles show them): a
  // scientist talking to a general audience, a cell as a house (spaces as rooms, membranes as walls, gates as doors),
  // round numbers. The panel keeps the key points and the exact numbers (the owner, 23 November 2026).
  const sy = s => ` data-say="${esc(s.replace(/\s+/g, ' ').trim())}"`, mute = ' data-say=""';
  const near = (n, k) => fmt(Math.round(n / k) * k), in100 = (x, n) => Math.round(100 * x / n);
  // a share in words where it is close to a simple one ('three quarters'), else so many in a hundred
  const share = x => (Math.abs(x - 0.75) < 0.03 ? 'three quarters' : Math.abs(x - 0.5) < 0.03 ? 'half' : Math.abs(x - 0.25) < 0.03 ? 'a quarter' : Math.abs(x - 2 / 3) < 0.03 ? 'two thirds' : `${Math.round(100 * x)} in a hundred`);
  const Cap = w => w[0].toUpperCase() + w.slice(1);
  const [o2, og2] = [F.os[2], F.og[2]], [cxIn, cxFace, cxSpan, cxApart] = F.cxK, setPct = Math.round(100 * F.settled / F.span);
  const html = {
    map: `<h1 data-at="0.6"${mute}>${esc(XR_TITLE)}</h1>
      <p class="lede" data-at="1.6"${mute}>An interactome put back into a cell</p>
      ${turns(`<p data-at="3" data-out="20.5"${sy(`This is a map of which human proteins stick to which. Biologists call it an interactome. Every dot is a protein, about ${near(F.N, 500)} of them, and every line means: these two have been seen to bind.`)}>An interactome: a map of which proteins bind which. ${fmt(F.N)} human proteins, ${fmt(F.E)} links.</p>
        <p data-at="10" data-out="20.5"${sy(`There are more than ${fmt(Math.floor(F.E / 10000) * 10000)} lines, far too many to draw at once. So you just saw them sweep past, a couple of thousand at a time. What stays are the best supported ones.`)}>One dot per protein. About ${about} links drawn at a time.</p>
        <p data-at="4" data-out="20.5" class="credits">Menche and colleagues, 2015: ${word(PDATA.kinds.length)} kinds of evidence. Most suggest physical contact; ${fmt(F.notC)} links do not.</p>`,
      `<p data-at="21" data-out="40.5"${sy(`A few proteins have a huge number of partners. We call them hubs. This one, GRB2, has ${fmt(GRB2.deg)}. Most proteins have far fewer: about ${Math.round(F.mean)} on average.`)}>Hubs are proteins with many links. GRB2 has ${fmt(GRB2.deg)}; the average protein ${Math.round(F.mean)}.</p>`,
      `<p data-at="41"${sy(`It is a beautiful object. But notice what is missing. The map tells us who binds whom. It does not tell us where.`)}>The map says who binds whom, not where.</p>
        <p data-at="48" class="amber"${sy(`And in a real cell, two proteins can only bind if they actually meet. So let's put this map back into a cell, the empty one waiting beside it, and see what survives.`)}>In a real cell two proteins can bind only if they meet.</p>`)}`,
    crowd: `<h2 data-at="0.6"${mute}>Billions and thousands</h2>
      ${turns(`<p data-at="1.5" data-out="20.5"${sy(`But first: what does one dot stand for? Let's pick one spot in the cytosol, the watery inside of the cell, and zoom in.`)}>One spot of the cytosol, the watery inside of the cell.</p>
        <p data-at="9" data-out="20.5"${sy(`This cube is about a hundred nanometres across, a thousandth of the width of a hair. Even in this speck there are a few thousand protein molecules, packed shoulder to shoulder. Here ${fmt(crowdN)} are drawn, each simplified to a few balls.`)}>About 100 nanometres across: a few thousand protein molecules, filling a quarter to a third of the space.</p>`,
      `<p data-at="21" data-out="33.5"${sy(`A whole human cell holds billions of protein molecules, of about ten thousand different kinds. It is a very crowded place.`)}>A whole cell: 1 to 10 billion protein molecules, of about ten thousand kinds.</p>
        <p data-at="22" data-out="33.5" class="credits">Molecules: ubiquitin, calmodulin, actin, GAPDH and tubulin from the Protein Data Bank (${['ubq', 'cam', 'actin', 'gapdh', 'tub'].map(pdbId).join(', ')}), each simplified to a few balls (its residues grouped). Sizes to scale, packed about as densely as a real cytoplasm.</p>`,
      `<p data-at="34"${sy(`So a dot on our map is not one molecule. It is every copy of one kind of protein, in one place. Like the bright ones here.`)}>One dot: all the copies of one kind of protein in one place.</p>
        <p data-at="41" class="amber"${sy(`One dot per kind, per place. Keep that in mind. It will matter in a moment.`)}>${fmt(F.L)} dots for the ${fmt(F.placed)} proteins with a place.</p>
        <p data-at="37" class="credits">The bright ones: the ${fmt(crowdK.find(k => k[0] === 'cam')[1])} calmodulins drawn.</p>`)}`,
    walls: `<h2 data-at="0.6"${mute}>Spaces and walls</h2>
      ${turns(`<p data-at="1.5" data-out="26.5"${sy(`A cell is not a bag of soup. It is more like a house with rooms. The cytosol is one room. The inside of the nucleus is another. The endoplasmic reticulum and the Golgi, where proteins are made and shipped, have rooms of their own. Then come the mitochondria, the cell's power stations, and small organelles such as lysosomes. And the last room is the world outside.`)}>A cell is a house with rooms. Membranes are the walls; each space is a room.</p>
        <p data-at="14" data-out="26.5" class="amber"${sy(`Two proteins in different rooms cannot touch, however well they would fit. And every single mitochondrion is a room of its own.`)}>Two proteins can bind only where they share a space. Each mitochondrion, lysosome, endosome and peroxisome is its own.</p>`,
      `<p data-at="27" data-out="44.5"${sy(`Some proteins sit in a wall and reach into both rooms. This receptor crosses the cell's outer membrane. Outside, it catches a signal. Inside, it passes the message on to a partner.`)}>A protein in a membrane can reach into both sides: a receptor meets a signal outside and a partner inside.</p>
        <p data-at="29" data-out="44.5" class="credits">The receptor: the beta-2 adrenergic receptor, its chain as ribbons, with an agonist (BI-167107) in its pocket and the G protein Gs docked inside, their surfaces; ${cite('b2ar')}. Its seven helices cross the membrane.</p>`,
      `<p data-at="45" data-out="59.5"${sy(`So a protein has more than an address. It has a side. It can float inside a room. It can cling to a wall from the cytosol's side, or from the far side. Or it can go right through, once, or many times, like our receptor.`)}>A protein in a place with a membrane is inside the space, on the membrane's cytosol side, on its far side, through it once, through it several times, or secreted.</p>
        <p data-at="47" data-out="59.5" class="credits">Inside: calmodulin, ${cite('cam')}; on the cytosol's side, held by its lipid tail: H-Ras, PDB ${pdbId('ras')}; their surfaces. The others are simple shapes.</p>`,
      `<p data-at="60" data-out="75.5"${sy(`How do we know? Partly from experiments, and partly from the protein's own build. A greasy stretch marks a crossing. A short tag at the start means: send me inside. No tag means: I stay on the cytosol's side. That last one is a textbook rule, and it has exceptions.`)}>From UniProt where it names the place (${fmt(F.named)} of ${fmt(F.memAll)} membrane places); elsewhere from the protein's own build: membrane spans, lipid anchors, a signal peptide (${fmt(F.carried)} more). No signal peptide is taken as the cytosol's side: a rule with exceptions.</p>
        <p data-at="61" data-out="75.5" class="credits">Sides: UniProt (CC BY 4.0), each protein's membrane spans, topology, lipid anchors, signal and transit peptides and locations.</p>`,
      `<p data-at="76" data-out="96.5"${sy(`And there are doors. Biologists call them gates. Nuclear pores let proteins in and out of the nucleus.`)}>Gates are the doors: nuclear pores, and import into the endoplasmic reticulum, the mitochondria and the peroxisomes.</p>
        <p data-at="88" data-out="96.5"${sy(`A mitochondrion pulls its proteins in through a narrow channel, unfolded, like thread through the eye of a needle. And small bubbles called vesicles carry cargo between the other rooms.`)}>Into a mitochondrion a protein goes unfolded. Vesicles carry others between the endoplasmic reticulum, the Golgi, endosomes, lysosomes and the outside.</p>
        <p data-at="89" data-out="96.5" class="caption"${mute}>Close-ups not to scale.</p>
        <p data-at="79" data-out="96.5" class="credits">Crossing the pore: TP53's core domain, PDB ${pdbId('tp53')}; threading into the mitochondrion: frataxin, ${cite('fxn')}, its chain drawn as beads, folding again inside; their surfaces. The pore and the import gates are simple shapes.</p>`,
      `<p data-at="97"${sy(`A mitochondrion even has two walls. So there are four places to be: the outer wall, the gap, the inner wall, and the innermost room, the matrix.`)}>Mitochondria: outer membrane, the gap between, inner membrane, matrix (told apart for ${fmt(F.mito)} proteins).</p>
        <p data-at="98" class="caption"${mute}>Close-ups not to scale.</p>`)}`,
    back: `<h2 data-at="0.6"${mute}>Back into the cell</h2>
      ${turns(`<p data-at="1.5" data-out="15.5"${sy(`Now we need an address for every protein. For that we use the Human Protein Atlas, a large public project. Its teams stained human cells for one protein at a time, with an antibody that sticks to it, and photographed under a microscope where the cell lights up.`)}>Each protein goes where the Human Protein Atlas finds it: cells stained with an antibody for one protein at a time, and photographed. ${word(F.places)[0].toUpperCase() + word(F.places).slice(1)} places in this model cell.</p>`,
      `<p data-at="16" data-out="49.5"${sy(`Now watch every dot fly home. Many proteins live in more than one place. In our picture, such a protein splits into copies on the way, one dot for each address.`)}>In this picture a protein in several places splits into copies: ${fmt(F.one)} proteins have one place, ${fmt(F.two)} two and ${fmt(F.more)} three or more.</p>
        <p data-at="28" data-out="49.5"${sy(`Inside each room, proteins that are linked settle close together, so their lines stay short. And each mitochondrion keeps its links to itself.`)}>Linked proteins gather together. Each mitochondrion keeps its own links.</p>
        <p data-at="40" data-out="49.5"${sy(`And a protein that belongs to a wall settles on it: on its own side, or straddling it.`)}>A membrane protein sits on its side of the membrane, or through it.</p>`,
      `<p data-at="50"${sy(`The lines now take on colours. We will come to what they mean in a moment.`)}>The links take the colour of their verdict.</p>
        <p data-at="62" class="amber"${sy(`But about ${quarter > 22 && quarter < 28 ? 'a quarter' : `${quarter} in a hundred`} of the proteins have no address at all. The Atlas has no reliable picture of them yet. They wait outside the cell, in grey.`)}>${fmt(F.unplaced)} proteins have no place in the Atlas yet. They wait outside the cell, grey.</p>`)}`,
    judge: `<h2 data-at="0.6"${mute}>Can they meet?</h2>
      ${turns(`<p data-at="1.5" data-out="47.5"${sy(`Now the test. For every link we ask: can these two proteins actually meet? We take the links where both partners have an address, about ${near(J, 1000)} of them. Where we know a protein's side, we use it. Where we do not, we assume it is inside.`)}>The ${fmt(J)} links that suggest contact, between proteins that both have a place. Sides where known; otherwise inside (the strict reading):</p>
        <ul class="steps">${step(8, 47.5, CYAN, `${fmt(s0)} possible`, ` (${pc1(s0, J)} %): a shared space, or a side that faces it`, `${Cap(word(Math.round(10 * s0 / J)))} in ten pass. Both partners share a room, or one reaches into the other's room through a wall. These keep the colour of their room.`)}
          ${step(21, 47.5, AMBER, `${fmt(s1)} through a gate`, ` (${pc1(s1, J)} %): one known crossing apart`, `About ${in100(s1, J)} in a hundred are one door apart. Say, one partner is in the cytosol and the other in the nucleus, with the pores between them. Those we colour amber.`)}
          ${step(35, 47.5, RED, `${fmt(s2)} impossible`, ` (${pc1(s2, J)} %): no shared space, no side that faces it, no known crossing`, `And about ${near(s2, 100)} links should be impossible. Their partners share no room, no wall and no door. Those are red.`)}</ul>`,
      `<p data-at="48"${sy(`Look at one protein, RELA. It is half of a famous alarm switch called N F kappa B. The Atlas photographed resting cells, and in a resting cell RELA sits in the cytosol. But raise the alarm, and it moves into the nucleus to switch genes on.`)}>RELA, half of NF-κB, is listed only in the cytosol: the Atlas photographs resting cells. Signalled, it moves into the nucleus.</p>
        <p data-at="55" class="amber"${sy(`So its ${fmt(RELA.t[1])} amber links are not mistakes. They are moments nobody photographed.`)}>${fmt(RELA.t[1])} of its links pass a gate: moments the Atlas did not photograph.</p>
        <p data-at="63" class="caption"${mute}>Counted apart: ${fmt(F.notC)} links that are not contacts and ${fmt(F.unpl)} with an end without a place. About ${about} links are drawn, and the red ones are raised to ${fmt(redDrawn)} so that they show in this picture.</p>`)}`,
    machines: `<h2 data-at="0.6"${mute}>Machines</h2>
      ${turns(`<p data-at="1.5" data-out="15.5"${sy(`Some proteins never work alone. They lock together into machines. Biologists call them complexes, and curators have collected about ${near(F.cxN, 1000)} human ones by hand. In our cell, a machine is a group of dots held in one outline.`)}>${fmt(F.cxN)} curated human complexes with at least two proteins in this map (the Complex Portal). Each is its proteins held in one outline.</p>`,
      `<p data-at="16" data-out="35.5"${sy(`Most sit inside one room, like the ribosome of the mitochondria. Some coat a wall from one side, like the coats that shape vesicles. And some go right through a wall. The pore in the nuclear envelope is one. So is the turbine that makes the cell's fuel, A T P.`)}>Where they sit, sides where known:</p>
        <ul class="steps">${step(17, 35.5, '#e6edf8', `${fmt(cxIn)} inside a space`, ' (the mitochondrial ribosome\'s large subunit, in the matrix)', '')}
          ${step(23, 35.5, GREEN, `${fmt(cxFace)} on a face`, ' (the COPII coat, on the cytosol\'s side)', '')}
          ${step(28, 35.5, MAGENTA, `${fmt(cxSpan)} through a membrane`, ' (the nuclear pore, ATP synthase)', '')}</ul>`,
      `<p data-at="36" data-out="53.5"${sy(`But look at these. A few hundred machines have their parts listed in different rooms. Take the proteasome, the cell's shredder. ${F.pr.both * 2 > F.pr.both + F.pr.cyt + F.pr.nuc ? 'Most' : 'Many'} of its parts are listed in both the nucleus and the cytosol, but ${word(F.pr.nuc)} only in the nucleus, and ${word(F.pr.cyt)} only in the cytosol. Yet we know it is one machine. So here it is not the link that is wrong. It is an address.`)} class="amber">${fmt(cxApart)} complexes have members listed in different spaces (${fmt(F.cxGate)} only a gate apart, ${fmt(cxApart - F.cxGate)} with no way to meet)${F.cxOdd * 2 > cxApart ? '; in most, a single member is the odd one out' : ''}. A known machine in pieces: a place is off, not the link.</p>
        <p data-at="37" data-out="53.5" class="credits">The 26S proteasome: ${fmt(F.pr.both)} parts listed in the nucleus and the cytosol, ${fmt(F.pr.nuc)} in the nucleus only, ${fmt(F.pr.cyt)} in the cytosol only.</p>`,
      `${F.bipCyt ? `<p data-at="54"${sy(`It happens to the best. The Atlas lists BiP, the most famous resident of the E R's inside, only in the cytosol.`)}>HSPA5 (BiP), a chaperone of the ER lumen, is listed only in the cytosol.</p>` : ''}
        <p data-at="55" class="credits">Complexes: the EBI Complex Portal (curated human complexes); their positions from their members' places and sides, this story's own.</p>`)}`,
    red: `<h2 data-at="0.6"${mute}>Why red?</h2>
      ${turns(`<p data-at="1.5" data-out="13.5"${sy(`So what about the red ones? As drawn, those partners could never meet.`)}>Red links: no shared space, and no gate between.</p>
        <p data-at="7" data-out="13.5" class="amber"${sy(`So either the link is wrong, or an address is. We have just seen addresses go wrong. To see how links can, we have to look at how they are found in the first place. There are three main ways.`)}>Either the link is wrong, or a place is missing. Where do links come from?</p>`,
      `<ul class="steps">${step(19, 42.5, CYAN, 'Two-hybrid', ` Both proteins are made in one yeast cell, each with half of a switch. If they stick, the yeast shows it. It tells you a pair can stick, not whether they meet in our cells.`, `The first is called two-hybrid. You take two human proteins and make them both inside a yeast cell. Each carries half of a switch. If the two stick together, the halves meet, the switch turns on, and the yeast shows it. It is clever, and it can test thousands of pairs. But think about what it tells you: that two proteins can stick. Not that they ever meet in a human cell.`)}</ul>
        <p data-at="31" data-out="42.5" class="amber"${sy(`And indeed, of the links found this way, about ${Math.round(+bin.pct)} in a hundred are red.`)}>Binary links, mostly from such tests: ${bin.pct} % impossible.</p>
        <p data-at="21" data-out="42.5" class="credits">H-Ras and Raf: PDB ${pdbId('ras')}, their surfaces. Not to scale.</p>`,
      `<ul class="steps">${step(43, 65.5, AMBER, 'Purification', ' Cells are broken open, one protein is caught with a molecular hook, and what comes up with it is identified. In the tube, proteins from different spaces can meet.', `The second way works like fishing. You break cells open, catch one protein with a molecular hook, and see what comes up with it. A machine called a mass spectrometer identifies the catch. But notice: once the cell is broken, the walls are gone. Proteins from different rooms can meet in the tube, though they never would in life.`)}</ul>
        <p data-at="55" data-out="65.5" class="amber"${sy(`Even so, the best-behaved links in our map are the complexes. These are proteins known to work together as stable machines, checked by hand across many studies. ${+cx.pct < 1 ? 'Fewer than one in a hundred of their links is red.' : `Only about ${Math.round(+cx.pct)} in a hundred of their links are red.`}`)}>Complexes, stable machines gathered by hand from many studies: only ${cx.pct} % impossible.</p>`,
      `<ul class="steps">${step(66, 83.5, GREEN, 'Proximity labelling', ' In living cells: the bait carries an enzyme that tags every protein within about 10 nanometres. It tells you who was near, not who held on.', `The third way is the newest, and it works inside living cells. You pick a protein, the bait, and attach an enzyme to it that sprays a small tag onto everything within about ten nanometres. Then you collect whatever got tagged. That tells you who was nearby, in the right room. Not necessarily who was holding on.`)}</ul>
        <p data-at="76" data-out="83.5"${sy(`The big maps made this way came after the interactome we are looking at.`)}>Large maps made this way came after this interactome.</p>
        <p data-at="68" data-out="83.5" class="credits">The antibody: PDB ${pdbId('igg')}. BirA: PDB ${pdbId('bira')}. Their surfaces; the other proteins simplified. Not to scale.</p>`,
      `<p data-at="84" data-out="93.5"${sy(`So how often a link turns out red depends on how it was found. That is a pattern. It is not proof that the method is to blame.`)}>By kind of evidence: from ${lo.pct} % impossible (${F.kindName(lo.n)}) to ${hi.pct} % (${F.kindName(hi.n)}). A pattern, not proof.</p>
        <p data-at="85" data-out="93.5" class="credits">Of the ${word(F.byKind.length)} kinds of evidence that suggest contact; a link found in several ways counts under each.</p>`,
      `<p data-at="94" data-out="105.5"${sy(`And the sides matter. The Atlas only tells us that a protein belongs to an organelle, not on which side of its wall. Without sides, everything hung on a guess. Assume inside, and about ${near(o2, 1000)} links were red. Allow either side, and ${og2 ? `only about ${near(og2, 100)} were` : 'none were'}.`)}>Without sides: ${fmt(o2)} impossible if inside only, ${og2 ? fmt(og2) : 'none'} if either side.</p>`,
      `<p data-at="106" data-out="118.5"${sy(`With sides, the guess shrinks. About ${share(F.settled / F.span)} of that doubt is settled. And what is left is firmer. Read the unknown ones strictly, and about ${near(s2, 100)} links are red. Read them generously, and about ${near(g2, 100)} still are.${g2 ? ' No reading makes them go away any more.' : ''}`)}>Sides settle ${setPct} % of the links that hung on the reading. Now: ${fmt(s2)} impossible if the unknown sides are inside, ${g2 ? fmt(g2) : 'none'} if either side.</p>`,
      `<p data-at="119" data-out="128.5" class="amber"${sy(`And sides cut both ways. About ${near(F.worse, 100)} links are now worse off than before: most of them now need a door, and about ${near(F.toRed, 10)} have turned red. A protein on an organelle's outer face does not share its inside.`)}>${fmt(F.worse)} links are worse off with sides (${fmt(F.toRed)} now impossible): on an organelle's cytosol side is not inside it.</p>`,
      `<p data-at="129" class="amber"${sy(`And remember the proteins waiting outside. Their links, about ${near(F.unpl, 1000)} of them, we cannot judge at all.`)}>${fmt(F.unplaced)} proteins have no place: their ${fmt(F.unpl)} links cannot be judged.</p>`)}`,
    moments: `<h2 data-at="0.6"${mute}>Not all at once</h2>
      ${turns(`<p data-at="1.5" data-out="35.5"${sy(`Now suppose a link is right, and both partners share a room. Even then, it is not a wire. Take GRB2 again. It has ${fmt(GRB2.deg)} partners, but only three hands: three small domains, each of which holds one partner at a time.`)}>GRB2: ${fmt(GRB2.deg)} links, but three binding domains, an SH2 and two SH3s.</p>
        <p data-at="18" data-out="35.5" class="amber"${sy(`So its partners have to take turns. A link in the map is a moment in time, not a permanent connection.`)}>Partners take turns. A link is a moment in time, not a permanent wire.</p>
        <p data-at="3" data-out="35.5" class="credits">GRB2: PDB 1GRI (Maignan et al., 1995), its surface. Partners: their docking stretches, each a short chain of amino acids (illustrative).</p>`,
      `<p data-at="36" data-out="44.5"${sy(`Or take TP53, the cell's best-known guardian against cancer. It has ${fmt(TP53.deg)} links, and it travels to and fro through the nuclear pores. Some of its partners wait in the nucleus, others in the cytosol.`)}>TP53: ${fmt(TP53.deg)} links. It goes to and fro through the nuclear pores: ${fmt(TP53.nuc)} partners are listed in the nucleoplasm, ${fmt(TP53.cyt)} in the cytosol (some in both).</p>
        <p data-at="37" data-out="44.5" class="credits">TP53's core domain: PDB 1TSR (Cho et al., 1994), its surface. Not to scale against the pores.</p>`,
      `<p data-at="45" data-out="53.5" class="amber"${sy(`But be a little careful with that number. TP53 is one of the most studied proteins there is, and ${fmt(TP53.lit)} of its links come from individual papers. The more people look at a protein, the more partners they find. In systematic screens, which test every pair alike, it only ranks ${ordinal(TP53.binRank)}.`)}>Part of that is fame: ${fmt(TP53.lit)} of its links in this interactome come from papers. In systematic two-hybrid screens it ranks ${ordinal(TP53.binRank)}.</p>`,
      `<p data-at="54"${sy(`One last traveller: STAT3. It waits in the cytosol until a signal arrives at a receptor, where an enzyme called JAK2 switches it on. Two copies pair up, pass through a pore, and in the nucleus they bind D N A and new partners.`)}>STAT3 waits in the cytosol until JAK2 switches it on at a receptor; it pairs up, passes a pore and binds DNA and partners such as EP300.</p>
        <p data-at="62" class="amber"${sy(`Its ${fmt(STAT3.deg)} links happen in different places, at different times. Our map shows them all at once.`)}>Its ${fmt(STAT3.deg)} links are in ${word(STAT3.places.length)} places; when each happens is not in this map.</p>
        <p data-at="56" class="credits">STAT3: PDB 1BG1 (Becker et al., 1998); JAK2: ${pdbId('jak2')}; p300: ${pdbId('p300')}; their surfaces. Not to scale.</p>`)}`,
    next: `<h2 data-at="0.6"${mute}>What it would take</h2>
      ${turns(`<p data-at="1.5" data-out="47.5"${sy(`So what would it take to draw a map that is true to a real cell? We would need to know where, and when, each pair really meets. Three kinds of experiment are getting us there.`)}>A map true to a real cell needs where and when each pair meets.</p>
        <ul class="steps">${step(5, 47.5, GREEN, 'Proximity maps', ' hundreds to thousands of baits show who is near whom, place by place', `Proximity maps repeat the tagging trick with hundreds, even thousands of baits. They chart who is near whom, room by room.`)}
          ${step(22, 47.5, CYAN, 'Cryo-electron tomography', ' cuts frozen cells thin and shows single molecules where they are', `Cryo-electron tomography freezes a cell in an instant, cuts it into thin slices, and shows single molecules exactly where they were.`)}
          ${step(37, 47.5, MAGENTA, 'Whole-cell volumes', ' map every organelle of a whole cell in 3D', `And whole-cell imaging maps every organelle of an entire cell in three dimensions.`)}</ul>`,
      `<p data-at="48" data-out="54.5"${sy(`It would also take fairer maps. Famous proteins collect links, and unstudied ones look lonely. Among the hundred biggest hubs, ${F.litTop} in a hundred links come from papers alone. A map of binding is also a map of our attention.`)}>And fairer maps: among the 100 biggest hubs, ${F.litTop} % of links come from papers alone, against ${F.litAll} % across the map.</p>`,
      `<p data-at="55"${sy(`Until then, this is the honest picture. Dense networks inside each room. Thin traffic through the doors. And a red remainder that nobody can explain yet. Which of those links are mistakes, and which are biology we have not understood? That is still open. Have a look around.`)}>Until then, the honest cell: dense networks inside each space, thin traffic through the gates, and a red remainder still to explain.</p>
        <p data-at="59"><button class="btn primary" id="btnGoExplore" type="button">Explore the cell</button></p>
        <p class="credits" data-at="60">The interactome of J. Menche and colleagues, Science 347, 1257601 (2015); the places from the Human Protein Atlas (proteinatlas.org). Sides: UniProt (CC BY 4.0). Complexes: the EBI Complex Portal. The judgement is this story's own.</p>`)}`,
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
    ball_move: 0, ball_morph: 0, ball_tint: 0, ball_in: 1, ball_out: 1, ball_hi: -1, ball_hl: 0, ball_sweep: 0, cell_ties: 1, crowd_open: 0, crowd_mark: 0, walls_lit: 0, walls_wall: 0, walls_parts: 0,
    cell_sides: 2, cell_cxs: 0, cell_cxp: -1, cell_cxon: 0, cell_cxa: 0, walls_sides: 0, walls_lay: 0,
    lens_open: 0, lens_focus: 0, sites_act: 0, sites_cyc: 0, sites_tp: 0, sites_move: 0, next_halo: 0, next_slab: 0, next_vol: 0 });
  let a, b;
  // 1. A map without a place: the hairball alone, framed in the middle; the empty cell comes in beside it only as the
  // voice brings it in ('the empty one waiting beside it', the amber line at a + 48; the owner, 23 November 2026)
  a = C.map.a; b = C.map.b;
  show('ball', 0.2, 2);
  show('cell', a + 49, a + 53);
  cam(a, 'ball', 'ball', -25);
  cam(a + 18, 'ball', 'ball', 5);
  cam(a + 48, 'ball', 'ball', 12, 'spin');
  cam(a + 54, 'ball', 'default', 4);
  cam(b, 'ball', 'default', 14, 'spin');
  L('ball', 'top', `<b>${fmt(F.N)} proteins</b> · about ${about} links drawn`, a + 6, a + 20, 'cyn');
  L('ball', 'hub', `<b>GRB2</b> · ${fmt(GRB2.deg)} links`, a + 22, a + 39, 'amb');
  // (as the text names GRB2: its links stand out in the hairball, the rest dims; the owner, 22 November 2026)
  // (as the text gives the map's number of links, every one of them lights once, 2,000 at a time, from the hubs out)
  ramp('ball_sweep', a + 4, a + 9.5, 0, 1);
  // (ball_hl's first third lights GRB2's dot, the rest its links)
  jump('ball_hi', a + 21, -1, GRB2.p); ramp('ball_hl', a + 21, a + 25, 0, 1);
  ramp('ball_hl', a + 38.5, a + 40.5, 1, 0); jump('ball_hi', a + 41, GRB2.p, -1);
  L('cell', 'nucleus', '<b>An empty cell</b> · no proteins yet', a + 51, b - 1, '');
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
  L('crowd', 'cube', `<b>About 100 nm</b> · ${fmt(crowdN)} molecules, simplified`, a + 14, a + 33, '');
  L('crowd', 'mark', '<b>One kind, one place</b> · one dot', a + 37, b - 9, 'cyn');
  sfxCue(a + 5, 'whoosh', 'crowd', 'dot', { dur: 2, pitch: 0.9 });
  sfxCue(a + 9, 'patter', 'crowd', 'cube', { dur: 4, gain: 0.3 });
  sfxCue(a + 33, 'ping', 'crowd', 'mark', { gain: 0.4 });
  // 3. Spaces and walls: the spaces light one by one, the walls glow, then a receptor, the sides a protein can take
  // beside it, a pore and an import site, and the mitochondrion's four layers
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
  ramp('walls_sides', a + 45, a + 48, 0, 1); ramp('walls_sides', a + 75, a + 77, 1, 0);
  // (the four layers in turn as the voice names them, then out)
  ramp('walls_lay', a + 97, a + 99, 0, 1); [2, 3, 4].forEach((k, i) => ramp('walls_lay', a + 99.5 + 2 * i, a + 101 + 2 * i, k - 1, k)); ramp('walls_lay', a + 106, a + 107.5, 4, 0);
  ramp('walls_wall', b - 5, b - 2, 1, 0);
  ramp('cell_shell', a + 27, a + 30, 1, 0.35); ramp('cell_shell', b - 3, b, 0.35, 1);   // (the close-ups clear of the organelles' skins)
  cam(a + 1, 'walls', 'default', 30);
  cam(a + 24, 'walls', 'default', 55, 'spin');
  cam(a + 31, 'walls', 'receptor', 0);
  cam(a + 43, 'walls', 'receptor', 25, 'spin');
  cam(a + 47, 'walls', 'sides', 0);
  cam(a + 74, 'walls', 'sides', 40, 'spin');
  cam(a + 79, 'walls', 'pore', 0);
  cam(a + 85, 'walls', 'pore', 20, 'spin');
  cam(a + 89, 'walls', 'import', 0);
  cam(a + 106, 'walls', 'import', 24, 'spin');   // (held while the protein threads in and the layers light)
  cam(b, 'walls', 'default', 60);
  SPACES.forEach((k, i) => L('walls', k, `<b>${['The cytosol', 'The nucleoplasm', 'The endoplasmic reticulum and Golgi lumens', 'Mitochondria', 'Lysosomes, endosomes, peroxisomes', 'Outside'][i]}</b>${i === 3 || i === 4 ? ' · each its own space' : ''}`, litAt(i) - 1, litAt(i) + 2.2, 'cyn'));
  L('walls', 'recOut', '<b>Outside</b> · a signal in its pocket', a + 32, a + 44, 'amb');
  L('walls', 'recIn', '<b>Inside</b> · its partner, a G protein', a + 34, a + 44, 'grn');
  [['sIn', 'Inside the space', 'calmodulin, in the cytosol', 50], ['sCyto', 'On the cytosol\'s side', 'H-Ras', 51.5], ['sFar', 'On the far side', 'on a lipid anchor', 53],
    ['sOnce', 'Through once', '', 54.5], ['sMany', 'Through several times', 'the receptor', 56], ['sSec', 'Secreted', 'outside', 57.5]]
    .forEach(([k, n, r, t], i) => L('walls', k, `<b>${n}</b>${r ? ' · ' + r : ''}`, a + t, a + 75, ['cyn', 'grn', 'amb', 'mag', 'mag', 'cyn'][i]));
  L('walls', 'pore', '<b>A nuclear pore</b> · a gate', a + 80, a + 87, 'amb');
  L('walls', 'import', '<b>An import site</b> · into a mitochondrion', a + 90, a + 96.5, 'amb');
  [['lOuter', 'Outer membrane'], ['lGap', 'The gap'], ['lInner', 'Inner membrane'], ['lMatrix', 'The matrix']].forEach(([k, n], i) => L('walls', k, `<b>${n}</b>`, a + 97.5 + 2 * i, i === 3 ? b - 1 : a + 100 + 2 * i, 'mag'));
  SPACES.forEach((k, i) => sfxCue(litAt(i) - 1, 'ping', 'walls', k, { gain: 0.3, pitch: Math.pow(2, i / 12) }));
  sfxCue(a + 31, 'whoosh', 'walls', 'receptor', { dur: 2 });
  sfxCue(a + 46, 'pick', 'walls', 'sMany', { gain: 0.3 });
  sfxCue(a + 79, 'whoosh', 'walls', 'pore', { dur: 2 });
  // 4. Back into the cell: the hairball moves over the cell, every dot flies to its place (a membrane protein to its
  // side), the cell's own take over
  a = C.back.a; b = C.back.b;
  show('ball', a + 1, a + 3);
  ramp('ball_move', a + 5, a + 13, 0, 1);
  ramp('ball_morph', a + 15, a + 48, 0, 1);
  ramp('ball_tint', a + 50, a + 56, 0, 1);
  ramp('cell_net', a + 58, a + 64, 0, 1);
  ramp('ball_in', a + 59, a + 65, 1, 0);
  cam(a + 2, 'ball', 'default', 0);
  cam(a + 13, 'ball', 'cell', -10);
  cam(a + 50, 'ball', 'cell', 50, 'spin');
  cam(a + 65, 'cell', 'default', 30, null, [0, 6, 1.4]);   // (standing back: the proteins without a place round the cell)
  cam(b - 1, 'cell', 'default', 70);
  L('ball', 'outside', `<b>${fmt(F.unplaced)} proteins</b> · no place in the Atlas`, a + 62, b - 1, '');
  L('cell', CELL_MITO(), '<b>A mitochondrion</b> · its own links', a + 30, a + 40, 'mag');
  sfxCue(a + 5, 'whoosh', 'ball', 'ball', { dur: 4, pitch: 0.8 });
  sfxCue(a + 15, 'rush', 'ball', 'ball', { dur: 6, gain: 0.35 });
  sfxCue(a + 50, 'spark', 'cell', 'centre', { gain: 0.4 });
  // 5. Can they meet? The verdicts in turn (sides where known, the unknown ones strict), then RELA's links through the
  // pores
  a = C.judge.a; b = C.judge.b;
  ramp('ball_out', a + 1, a + 5, 1, 0);
  ramp('ball_a', a + 5, a + 6, 1, 0);
  // (the cell drew all three since the morph: the amber and the red ones fade out, then come back one kind at a time)
  ramp('cell_amb', a + 1, a + 3, 1, 0); ramp('cell_red', a + 1, a + 3, 1, 0);
  ramp('cell_amb', a + 21, a + 23, 0, 1);
  ramp('cell_red', a + 35, a + 37, 0, 1);
  // (red is on show only while the story talks about it: the owner, 23 November 2026; out again for RELA's amber links,
  // in for 'Why red?', out under the lenses, in for the shares by kind and the readings, out with the proteins without a
  // place, in again for the last picture's red remainder)
  ramp('cell_red', a + 47, a + 49, 1, 0);
  const rela = RELA.p, relaAt = dotOf(net, rela);
  jump('cell_pp', a + 48, -1, rela);
  jump('cell_pp', b - 1, rela, -1);
  // (RELA's own dot and its links in front, facing you, not behind the nucleus (the owner, 23 November 2026): the view's
  // bearing is RELA's from the nucleus, in the cell's own frame, and it looks between the two; in a headset the same
  // bearing turns the scene, xrPlace)
  const nuc = CELL_NUC(), relaAz = relaAt ? Math.atan2(relaAt[0] - nuc[0], relaAt[2] - nuc[2]) / D2R : 150;
  const relaT = relaAt ? [0, 1, 2].map(i => nuc[i] + 0.3 * (relaAt[i] - nuc[i])) : nuc, relaN = [0, 0, -1.0, relaT[0], relaT[1], relaT[2]];
  cam(a + 2, 'cell', 'default', 70);
  cam(a + 47, 'cell', 'default', relaAz + 50, 'spin');
  cam(a + 52, 'cell', 'default', relaAz - 10, null, relaN);
  cam(b, 'cell', 'default', relaAz + 15, 'spin', relaN);
  L('cell', 'edge', `<b>Possible</b> · ${fmt(s0)}, sides where known`, a + 9, a + 21, 'cyn');
  L('cell', 'nucleus', `<b>Through a gate</b> · ${fmt(s1)}`, a + 22, a + 35, 'amb');
  L('cell', [0.1, -0.6, 0.45], `<b>Impossible</b> · ${fmt(s2)}, unknown sides read strictly`, a + 36, a + 47, 'mag');
  if (relaAt) L('cell', relaAt, `<b>RELA</b> · cytosol only, ${fmt(RELA.t[1])} links through a gate`, a + 50, b - 1, 'amb');
  sfxCue(a + 8, 'link', 'cell', 'edge', { gain: 0.35 });
  sfxCue(a + 21, 'link', 'cell', 'nucleus', { gain: 0.35, pitch: 0.9 });
  sfxCue(a + 35, 'knock', 'cell', 'centre', { gain: 0.35 });
  sfxCue(a + 48, 'clink', 'cell', 'centre', { gain: 0.4 });
  // 6. Machines: the complexes as rings round their members, the background dimmed; the examples in turn (inside, on a
  // face, through a membrane), then the proteasome listed apart, then BiP
  a = C.machines.a; b = C.machines.b;
  const CX = cell.cx, ex = CX.ex, cxAt = n => (n >= 0 ? CX.at(n) : []);
  ramp('cell_net', a + 2, a + 5, 1, 0.25); ramp('cell_net', b - 3, b, 0.25, 1);
  ramp('cell_shell', a + 2, a + 5, 1, 0.5); ramp('cell_shell', b - 3, b, 0.5, 1);
  ramp('cell_amb', a + 2, a + 4, 1, 0.15); ramp('cell_amb', b - 3, b, 0.15, 1);
  ramp('cell_cxa', a + 6, a + 8, 0, 1); ramp('cell_cxa', b - 2.5, b - 0.5, 1, 0);
  jump('cell_cxs', a + 6, 0, 15); jump('cell_cxs', a + 35.5, 15, 16); jump('cell_cxs', b - 0.3, 16, 0);
  // (the camera to a point p of the cell, from outside it on p's bearing, d away)
  const camTo = (t, p, d, turn, ease) => p && cam(t, 'cell', 'default', Math.atan2(p[0], p[2]) / D2R - 20 + (turn || 0), ease, [0, -4, d - 3.6, p[0], p[1], p[2]]);
  const mid = l => l.length && l.reduce((s, q) => s.map((x, i) => x + q[i] / l.length), [0, 0, 0]);
  const [rib, cop, npc, atp, psm] = ex.map(cxAt);
  cam(a + 2, 'cell', 'default', 40);
  cam(a + 14, 'cell', 'default', 70, 'spin');
  camTo(a + 17, rib[0], 0.75, 0); camTo(a + 21.5, rib[0], 0.75, 15, 'spin');
  camTo(a + 23.5, cop[0], 0.8, 0); camTo(a + 27, cop[0], 0.8, 12, 'spin');
  camTo(a + 28.5, npc[0], 0.9, 0); camTo(a + 31, npc[0], 0.9, 10, 'spin');
  camTo(a + 32, atp[0], 0.75, 0); camTo(a + 35, atp[0], 0.75, 12, 'spin');
  camTo(a + 38, mid(psm), 1.1, 0); camTo(a + 52, mid(psm), 1.1, 25, 'spin');
  const bipAt = F.bipCyt ? dotOf(net, F.bip) : null;
  if (bipAt) { jump('cell_pp', a + 54, -1, F.bip); jump('cell_pp', b - 1, F.bip, -1); camTo(a + 55, bipAt, 1.4, 0); camTo(b - 1, bipAt, 1.4, 15, 'spin'); }
  cam(b, 'cell', 'default', 20);
  if (rib[0]) L('cell', rib[0], '<b>A machine</b> · its proteins in one outline', a + 8, a + 15.5, '');
  if (rib[0]) L('cell', rib[0], '<b>Mitochondrial ribosome</b> · large subunit, in the matrix', a + 17.5, a + 22.5, 'cyn');
  if (cop[0]) L('cell', cop[0], '<b>COPII coat</b> · on the cytosol\'s side', a + 24, a + 28, 'grn');
  if (npc[0]) L('cell', npc[0], '<b>Nuclear pore</b> · through the envelope', a + 29, a + 32, 'mag');
  if (atp[0]) L('cell', atp[0], '<b>ATP synthase</b> · through the inner membrane', a + 32.5, a + 35.5, 'mag');
  psm.forEach((q, i) => L('cell', q, i ? `<b>Also listed here</b>` : `<b>26S proteasome</b> · listed in ${word(psm.length)} spaces`, a + 38.5, a + 53, 'amb'));
  if (bipAt) L('cell', bipAt, '<b>HSPA5 (BiP)</b> · listed only in the cytosol', a + 55.5, b - 1, 'amb');
  sfxCue(a + 6, 'grow', 'cell', 'centre', { dur: 2, gain: 0.3 });
  [17, 23.5, 28.5].forEach((d, i) => sfxCue(a + d, 'ping', 'cell', 'centre', { gain: 0.3, pitch: Math.pow(2, i / 12) }));
  sfxCue(a + 36, 'knock', 'cell', 'centre', { gain: 0.35 });
  // 7. Why red? What red means, on the cell (the others dimmed); the lenses one by one, each explained; the shares; the
  // sides: without them (inside only, then either side), with them (the unknown ones strict, then generous), the links
  // worse off; the proteins without a place
  a = C.red.a; b = C.red.b;
  ramp('cell_amb', a + 1, a + 3, 1, 0.15); ramp('cell_amb', a + 12, a + 14, 0.15, 1);
  ramp('cell_red', a + 0.5, a + 2.5, 0, 1); ramp('cell_red', a + 13, a + 15, 1, 0); ramp('cell_red', a + 84, a + 86, 0, 1);
  show('lens', a + 13, a + 15, a + 84, a + 86);
  ramp('lens_open', a + 14, a + 19, 0, 1);
  ramp('lens_focus', a + 19, a + 21, 0, 1); ramp('lens_focus', a + 43, a + 45, 1, 2); ramp('lens_focus', a + 66, a + 68, 2, 3);
  jump('cell_sides', a + 94, 2, 0);
  jump('cell_faces', a + 99.5, 0, 1);
  jump('cell_sides', a + 106, 0, 2); jump('cell_faces', a + 106, 1, 0);
  jump('cell_faces', a + 112.5, 0, 1);
  jump('cell_faces', a + 119, 1, 0);
  jump('cell_show', a + 129, 2, 3);
  jump('cell_show', C.moments.a + 2.5, 3, 2);   // (as the cell fades out, nearly unseen: a hidden set is not updated, so later it would build as it comes back)
  cam(a + 1, 'cell', 'default', relaAz + 20, null, [0, 4, -1.0, nuc[0], nuc[1], nuc[2]]);   // (on from RELA's bearing, no swing)
  cam(a + 12, 'cell', 'default', relaAz + 45, 'spin', [0, 4, -1.0, nuc[0], nuc[1], nuc[2]]);
  cam(a + 14, 'lens', 'default', 0);
  cam(a + 21, 'lens', 'yeast', 0);
  cam(a + 42, 'lens', 'yeast', 8, 'spin');
  cam(a + 45, 'lens', 'apms', 0);
  cam(a + 65, 'lens', 'apms', 8, 'spin');
  cam(a + 68, 'lens', 'prox', 0);
  cam(a + 83, 'lens', 'prox', 6, 'spin');
  cam(a + 86, 'cell', 'default', 20);
  cam(a + 110, 'cell', 'default', 50, 'spin');
  cam(a + 129, 'cell', 'default', 75, 'spin');
  cam(b, 'cell', 'default', 100, 'spin', [0, 4, 1.4]);
  L('cell', [0.1, -0.6, 0.45], `<b>Impossible</b> · ${fmt(s2)}`, a + 2, a + 13, 'mag');
  L('lens', 'yeastTag', `<b>Binary</b> · ${bin.pct} % impossible, of those with both places known`, a + 31, a + 44, 'cyn');
  L('lens', 'apmsTag', `<b>Complexes</b> · stable machines, gathered by hand · ${cx.pct} % impossible`, a + 55, a + 67, 'amb');
  L('lens', 'proxTag', '<b>Proximity</b> · large maps came after this one', a + 76, a + 86, 'grn');
  const RL = [0.1, -0.6, 0.45];
  L('cell', RL, `<b>No sides, inside only</b> · ${fmt(o2)} impossible`, a + 95, a + 99.5, 'mag');
  L('cell', RL, `<b>No sides, either side</b> · ${og2 ? fmt(og2) : 'none'} impossible`, a + 100, a + 105.5, 'cyn');
  L('cell', RL, `<b>Sides, the unknown inside</b> · ${fmt(s2)} impossible`, a + 107, a + 112.5, 'mag');
  L('cell', RL, `<b>Sides, the unknown either side</b> · ${fmt(g2)} impossible`, a + 113, a + 118.5, 'mag');
  L('cell', RL, `<b>Worse off with sides</b> · ${fmt(F.worse)} links, ${fmt(F.toRed)} now red`, a + 120, a + 128.5, 'amb');
  L('cell', [-0.3, -1.25, 0.3], `<b>${fmt(F.unplaced)} without a place</b> · ${fmt(F.unpl)} links unjudged`, a + 130, b - 1, '');
  sfxCue(a + 2, 'knock', 'cell', 'centre', { gain: 0.3 });
  [19, 43, 66].forEach(d => sfxCue(a + d, 'pick', 'lens', d === 19 ? 'yeast' : d === 43 ? 'apms' : 'prox', { gain: 0.35 }));
  sfxCue(a + 99.5, 'snap', 'cell', 'centre', { gain: 0.35 });
  sfxCue(a + 106, 'snap', 'cell', 'centre', { gain: 0.35, pitch: 1.1 });
  // 8. Not all at once: GRB2's domains and partners in turn; TP53 to and fro; STAT3 through a pore
  a = C.moments.a; b = C.moments.b;
  ramp('cell_a', a, a + 3, 1, 0); ramp('cell_red', a, a + 2.5, 1, 0);
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
  // 9. What it would take: proximity maps, a tomogram's slab, a whole-cell volume; then the honest cell
  a = C.next.a; b = C.next.b;
  ramp('cell_a', a, a + 3, 0, 1);
  show('next', a + 2, a + 4, a + 50, a + 52);
  ramp('cell_net', a + 2, a + 5, 1, 0.25); ramp('cell_net', a + 49, a + 53, 0.25, 1);   // (the cell's links dimmed under the methods)
  ramp('cell_red', a + 52, a + 54, 0, 1);   // (the red remainder, back for the last picture)
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
