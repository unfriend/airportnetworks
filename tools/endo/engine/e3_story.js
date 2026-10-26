
// ================================================================== STORY ==
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Until a narration is recorded, the table sets the
// pace: node tools/pace.mjs writes it from the words on the panel (each stretch
// between two cues lasts long enough to read what appeared at its start; run
// it again after the text changes). A recording replaces it with its own times.
const NARRATION_SYNC = [
  [0, 0], [4.4, 4], [12.4, 9],                        // Intro
  [22.1, 14], [22.7, 14.6], [23.9, 15.2], [33.6, 24], [42.5, 31], [50.1, 36], [50.7, 36.6],  // Tired
  [59.3, 40], [60, 40.6], [61.2, 41.2], [67.6, 46], [89.2, 65.6], [100.6, 67], [101.2, 67.6],  // Genes
  [107.8, 70], [117.7, 79], [129.7, 87], [130.4, 87.6], [138.6, 89], [152.4, 101.6], [157.8, 103],  // Network
  [167, 108], [168.3, 109.18], [170.1, 109.2], [184.2, 119], [196.3, 130], [203.5, 134],
  [210.1, 140],                                       // Walk
  [222.9, 148], [223.6, 148.6], [224.8, 149.2], [238.9, 159], [258.2, 176.6], [262, 178],  // Neighbours
  [269.7, 185], [271, 186.18], [273.6, 186.2], [281, 193], [295.1, 204], [305, 213], [311.4, 217],  // Tree
  [320.2, 225], [321.5, 226.2], [334.4, 233], [345.4, 243], [358.2, 253],  // Endotypes
  [393.4, 285], [394.7, 286.18], [395.7, 286.2], [398.5, 288.5], [401.3, 291], [406.2, 294],
  [410.6, 298], [411.2, 298.6], [419.4, 302], [421.6, 304], [432.9, 310],  // What for
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
  { key: 'title', name: 'Intro', a: 0, b: 14 },
  { key: 'tired', name: 'Tired', a: 14, b: 40 },
  { key: 'genes', name: 'Genes', a: 40, b: 70 },
  { key: 'cloud', name: 'Network', a: 70, b: 108 },
  { key: 'walk', name: 'Walk', a: 108, b: 148 },
  { key: 'hood', name: 'Neighbours', a: 148, b: 185 },
  { key: 'split', name: 'Tree', a: 185, b: 225 },
  { key: 'endotypes', name: 'Endotypes', a: 225, b: 285 },
  { key: 'next', name: 'What for', a: 285, b: 310 },
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
const view = (k, name) => { const c = GL.sets[k].cam; return (c[name] || c.default).slice(); };
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

// ------------------------------------------------------------------- data --
// The analysis data (ENDO_DATA), decoded once for the story and the panels (each set decodes its own copy for
// drawing). Module genes are the first ED.M nodes, in tree order, so each endotype is a run of indices.
const ED = (() => {
  const D = ENDO_DATA, b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const u16 = s => { const b = b64(s); return new Uint16Array(b.buffer, 0, b.length >> 1); };
  const M = D.mod, names = D.names.split('|'), S = D.seeds.length;
  const gene = b64(D.gene), seedOf = b64(D.seedOf), featN = u16(D.featN), featI = u16(D.featI), links = u16(D.links), g = b64(D.groups.g);
  const nb = Array.from({ length: M }, () => []);
  for (let k = 0; k < D.modLinks; k++) { const a = links[2 * k], b = links[2 * k + 1]; if (a < M && b < M) { nb[a].push(b); nb[b].push(a); } }
  let o = 0;
  const genes = names.slice(0, M).map((sym, i) => {
    const terms = Array.from(featI.subarray(o, o + featN[i])); o += featN[i];
    return { sym, endo: gene[i], seed: seedOf[i] - 1, terms, nb: nb[i] };
  });
  const bySym = new Map(genes.map((x, i) => [x.sym.toUpperCase(), i]));
  // the seeds' groups at each neighbourhood size k: each seed's group (0 the largest) and how many groups there are
  const groups = D.groups.k.map((k, j) => { const of = Array.from(g.subarray(j * S, j * S + S)); return { k, of, n: new Set(of).size }; });
  const members = D.endo.map(e => genes.map((x, i) => i).filter(i => gene[i] === e.id));
  // a gene's neighbourhood (node indices of the whole network), decoded when asked for
  let hood = null;
  const hoodOf = i => { hood = hood || u16(D.hood); return hood.subarray(i * D.facts.hood, (i + 1) * D.facts.hood); };
  const cut = b64(D.tree.cut);
  return { D, M, genes, bySym, groups, members, hoodOf, cut, endo: D.endo, seeds: D.seeds, terms: D.terms };
})();
const geneIdx = s => { const i = ED.bySym.get(String(s || '').trim().toUpperCase()); return i === undefined ? -1 : i; };
// where each seed gene acts in the junction (UniProt; see tools/endo/SPEC.md), for the story's count by region
const SEED_SITE = {
  nerve: ['CHAT', 'SLC5A7', 'SLC18A3', 'SYT2', 'VAMP1', 'SNAP25', 'UNC13A', 'RPH3A', 'PREPL', 'MYO9A', 'SLC25A1'],
  cleft: ['COLQ', 'AGRN', 'LAMB2', 'LAMA5', 'COL13A1'],
  membrane: ['CHRNA1', 'CHRNB1', 'CHRND', 'CHRNE', 'CHRNG', 'RAPSN', 'LRP4', 'MUSK', 'DOK7', 'SCN4A'],
  fibre: ['DPAGT1', 'ALG2', 'ALG14', 'GFPT1', 'GMPPB', 'PLEC', 'DES', 'TOR1AIP1', 'CHD8'],
};
// what an endotype's place in the synapse is called
const PLACE = { mito: 'the nerve ending\'s mitochondria', lamina: 'the basement membrane in the gap', golgi: 'the Golgi of the muscle fibre',
  channels: 'the ion channels of the muscle membrane', er: 'the muscle fibre\'s endoplasmic reticulum', endosome: 'the nerve ending\'s endosomes',
  vesicles: 'the nerve ending\'s synaptic vesicles', scaffold: 'the muscle fibre\'s scaffold', junction: 'the junction as a whole' };
const STRONG = ['nothing shared', 'weak', 'clear'];

// ------------------------------------------------------------------ facts --
// Numbers the story quotes, counted from the analysis data (ENDO_DATA) when the story loads
const FACTS = (() => {
  const D = ENDO_DATA, F = D.facts, seedSet = new Set(D.seeds.map(s => s[0]));
  const at = k => ED.groups.find(x => x.k === k) || { n: 0 };
  const one = ED.groups.find(x => x.n === 1);
  // seeds that already share a neighbourhood at the smallest k
  const g0 = ED.groups[0], first = D.seeds.filter((s, j) => g0.of[j] === 0 && g0.of.filter(x => x === 0).length > 1).map(s => s[0]);
  const sites = Object.fromEntries(Object.entries(SEED_SITE).map(([k, l]) => [k, l.filter(s => seedSet.has(s)).length]));
  return Object.assign({}, F, {
    ones: ED.genes.reduce((a, x) => a + x.terms.length, 0), modLinks: D.modLinks, merges: D.mod - 1,
    cuts: ED.cut.reduce((a, x) => a + x, 0), groupsAt: k => at(k).n, oneK: one ? one.k : null, firstShare: first, sites,
    clear: D.endo.filter(e => e.strong === 2).length, weak: D.endo.filter(e => e.strong === 1).length, none: D.endo.filter(e => e.strong === 0).length,
    noPlace: D.endo.filter(e => !e.place).map(e => e.id), tenths: Math.round(F.r * 10),
  });
})();
// ' · '-joined symbols of those genes that are in endotype id (so the text only names what the data has)
const inEndo = (id, syms) => syms.filter(s => { const i = geneIdx(s); return i >= 0 && ED.genes[i].endo === id; });
const listOf = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const endoCol = id => (ED.endo[id] ? ED.endo[id].col : '#9aa3b5');

// the story's gene for the neighbourhoods: COLQ (in the basement membrane endotype)
const STORY_GENE = 'COLQ';
function buildStory() {
  const F = FACTS, E = ED.endo;
  const gi = geneIdx(STORY_GENE), gsym = gi >= 0 ? ED.genes[gi].sym : STORY_GENE;
  const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] || String(n);
  const Word = n => { const w = word(n); return w.charAt(0).toUpperCase() + w.slice(1); };
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // jump an index param (a site, a gene, an endotype) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  const kAt = k => Math.max(0, ED.groups.findIndex(x => x.k === k));   // net_k for a neighbourhood size
  const ks = [1, 10, 20, 50].filter(k => ED.groups.some(x => x.k === k));
  // the poster's four endotypes, in the order the story tells them
  const four = [1, 9, 5, 2].filter(id => E[id]);
  // one endotype's point, in its colour; they take turns in one place (a grid cell), each fading out as the next comes
  const step = (id, at, out, text) => `<ul class="steps" data-at="${at}"${out ? ` data-out="${out}"` : ''} style="grid-area:1/1"><li style="border-left-color:${endoCol(id)}"><b style="color:${endoCol(id)}">${id} · ${esc(E[id].name)}</b>${text}</li></ul>`;
  // ------------------------------------------------------------ panel copy
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">Endotypes</h1>
      <p class="lede" data-at="2.4">one disease, many mechanisms</p>
      <p data-at="4">${F.seeds} genes cause a group of rare diseases of the junction between nerve and muscle. How many mechanisms hide behind them?</p>
      <p class="note" data-at="9">A story of congenital myasthenic syndromes, and of EndotypY, a Python package that finds the endotypes of a disease in a network of proteins.</p>`,
    tired: `<h2 data-at="0.6">Muscles that tire</h2>
      <p data-at="1.2">Every movement starts with a nerve cell telling muscle fibres to contract. Each fibre meets the nerve at one point: the neuromuscular junction.</p>
      <p data-at="10">Up close, the nerve ending releases acetylcholine. It crosses a narrow gap and opens receptors on the muscle, and the fibre twitches.</p>
      <p data-at="17" class="amber">In congenital myasthenic syndromes (CMS) the signal runs down: muscles tire as they work, and weakness grows with effort.</p>
      <p data-at="22">CMS are rare and inherited, most often from both parents. Some patients only tire with exercise; others struggle to walk, or to breathe.</p>`,
    genes: `<h2 data-at="0.6">${F.seeds} genes, one junction</h2>
      <p data-at="1.2">The Gene Table of Neuromuscular Disorders lists ${F.seeds} genes for CMS. Each works somewhere in the junction.</p>
      <ul class="steps">
        <li data-at="6"><b>Nerve ending · ${F.sites.nerve}</b>making, loading and releasing acetylcholine</li>
        <li data-at="11"><b>The gap · ${F.sites.cleft}</b>the basement membrane that holds it together</li>
        <li data-at="15"><b>Muscle membrane · ${F.sites.membrane}</b>the receptor, the proteins that cluster it, sodium channels</li>
        <li data-at="20"><b>Inside the fibre · ${F.sites.fibre}</b>sugar chains for receptors, the scaffold, the nuclei</li>
      </ul>
      <p data-at="25" class="amber">Yet one mutation can be mild in one patient and severe in another. Genes alone do not explain the range; other genes in their networks are thought to shape it.</p>
      <p class="credits" data-at="27">Gene Table of Neuromuscular Disorders; places after UniProt (the junction is illustrative). Severity: Núñez-Carpintero et al., Nature Communications (2024).</p>`,
    cloud: `<h2 data-at="0.6">${fmt(F.genes)} proteins</h2>
      <div style="display:grid">
        <p data-at="1.2" data-out="8.5" style="grid-area:1/1">Proteins that interact make a network: ${fmt(F.genes)} proteins, ${fmt(F.links)} links. The ${F.seeds} CMS genes are its seeds.</p>
        <p data-at="9" class="amber" style="grid-area:1/1">Do the seeds share mechanisms? Endotypes are subtypes of a disease defined by its molecules: groups of disease genes that hang together, in the network and in what they do.</p>
      </div>
      <p data-at="17">First, one group or several? Give each seed a neighbourhood of its k closest proteins. Seeds whose neighbourhoods meet form a group.</p>
      <div class="facts">${ks.map((k, j) => `<div data-at="${[19, 23, 25, 28][j]}"><b>${F.groupsAt(k)}</b><small>${F.groupsAt(k) === 1 ? 'group' : 'groups'} at k = ${k}</small></div>`).join('')}</div>
      <p data-at="31" class="amber">${F.oneK ? `From k = ${F.oneK} on, all ${F.seeds} seeds share one neighbourhood: one module, which the next steps split.` : 'The seeds stay in several groups.'}</p>
      <p class="credits" data-at="33">Step 1 of EndotypY (optional): seed groups.${F.firstShare.length ? ` Even at k = 1, ${listOf(F.firstShare)} share one.` : ''} The protein network is the one the authors used.</p>`,
    walk: `<h2 data-at="0.6">A walker that keeps coming home</h2>
      <p data-at="1.2">To find the rest of the module, EndotypY sends random walkers out from the seeds. At every step a walker hops to a random neighbour, or, ${word(F.tenths)} times in ten, jumps back to a seed.</p>
      <p data-at="11">Proteins the walkers visit again and again are close to the seeds, by many paths at once.</p>
      <p data-at="22" class="amber">The most visited join the seeds, one by one, until the module holds together. In the authors' run:</p>
      <div class="facts"><div data-at="26"><b>${F.seeds}</b><small>seeds</small></div><div data-at="27.5"><b>+ ${F.found}</b><small>found by the walk</small></div><div data-at="29"><b>${F.module}</b><small>genes in the module</small></div></div>
      <p class="credits" data-at="32">Step 2 of EndotypY: network expansion by random walk with restart (restart probability ${F.r}, the package's default). The walkers and their heat are a re-run with the package's defaults; the module is the authors'.</p>`,
    hood: `<h2 data-at="0.6">Every gene's neighbourhood</h2>
      <p data-at="1.2">What does each gene do? Its neighbours tell more than the gene alone. Take ${esc(gsym)}, which anchors acetylcholinesterase in the gap: a walk from ${esc(gsym)} alone marks its neighbourhood, the top ${F.pct}% of the network (${F.hood} proteins).</p>
      <p data-at="11">The parts of the cell that come up among them more often than chance (Gene Ontology terms), with ${esc(gsym)}'s own, become ${esc(gsym)}'s row of marks. Every gene gets one.</p>
      <div class="facts"><div data-at="22"><b>${F.module}</b><small>genes</small></div><div data-at="23"><b>${F.terms}</b><small>cell parts</small></div><div data-at="24"><b>${fmt(F.ones)}</b><small>marks</small></div></div>
      <p data-at="28" class="amber">Genes with similar rows sit among similar parts of the cell.</p>
      <p class="credits" data-at="30">Step 3 of EndotypY: functional neighbourhood annotation (gene-set enrichment with GSEApy and Enrichr libraries; here ${esc(F.featLib.replace(/_/g, ' '))}).</p>`,
    split: `<h2 data-at="0.6">A tree that splits only when it must</h2>
      <p data-at="1.2">Genes with similar rows are joined, pair by pair, into a tree.</p>
      <p data-at="8">Where to cut it? Not at a fixed height. Tree2BreakSpace tests every split from the root down: do the two sides use the cell's parts differently? A split stays only when the data say so.</p>
      <p data-at="19" class="amber">Only ${F.cuts} splits are kept: ${F.endotypes} endotypes.</p>
      <p data-at="28">Laid out by their distances in the tree: genes close in the tree land close together.</p>
      <p class="credits" data-at="32">Step 4 of EndotypY: statistically filtered hierarchical clustering (Tree2BreakSpace, Sakalli et al., in progress).</p>`,
    endotypes: `<h2 data-at="0.6">${F.endotypes} endotypes</h2>
      <p data-at="1.2">Each endotype is a group of genes tied together in the network and in what they do: one bubble each, with grey bands for the links between them. In the authors' analysis:</p>
      <div style="display:grid">
        ${E[1] ? step(1, 8, 17.5, `${listOf(inEndo(1, ['SLC25A1']))} exports citrate from the nerve ending's mitochondria; from it comes acetyl-CoA, needed to make acetylcholine.`) : ''}
        ${E[9] ? step(9, 18, 27.5, `forming and releasing synaptic vesicles (${inEndo(9, ['SYT1', 'SYT2', 'SNAP25', 'STX19', 'RPH3A']).join(', ')}). Givinostat, a treatment for Duchenne muscular dystrophy, perturbs several of this endotype's genes: a lead for repurposing, not a treatment for CMS.`) : ''}
        ${E[5] ? step(5, 28, 37.5, `receptor subunits (${inEndo(5, ['CHRNB1', 'CHRND']).join(', ')}) that start the muscle's signal, and sodium channels (${inEndo(5, ['SCN4A', 'SCN8A', 'SCN1B']).join(', ')}) that carry it on.`) : ''}
        ${E[2] ? step(2, 38, 45.5, `the matrix in the gap (${inEndo(2, ['COLQ', 'AGRN', 'LAMB2', 'LAMA5', 'COL13A1']).join(', ')}): it holds the junction together and anchors acetylcholinesterase.`) : ''}
      </div>
      <p data-at="46" class="amber">Back in the junction, the endotypes with a shared place settle at it.</p>
      <p class="note" data-at="52">${Word(F.clear)} endotypes share a clear place in the cell, ${word(F.weak)} a weak one; ${word(F.none)} (${F.noPlace.join(', ')}) share none and hover loose.</p>`,
    next: `<h2 data-at="0.6">What endotypes are for</h2>
      <ul class="steps">
        <li data-at="1.2"><b>Patients</b>grouped by mechanism, not by broad symptoms</li>
        <li data-at="3.5"><b>Drugs</b>pathways to target, and drugs to repurpose</li>
        <li data-at="6"><b>Rare and common</b>the links between rare and common forms of a disease</li>
      </ul>
      <p data-at="9">EndotypY is open source: a Python package you install from github.com/menchelab/EndotypY.</p>
      <p data-at="13">Chloé Bûcheron, Iker Núñez-Carpintero, Enes Sakalli, Mathilde Meyenberg, Julia Guthrie and Jörg Menche: Ludwig Boltzmann Institute for Network Medicine, University of Vienna.</p>
      <p data-at="17"><button class="btn primary" id="btnGoExplore" type="button">Explore the endotypes</button></p>
      <p class="credits" data-at="19">Endotypes: the authors' result. The steps before them: re-run with the package's defaults to show the method. ISMB 2026 poster. Rare and common autoimmunity: Guthrie et al., Science Advances (2023).</p>`,
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
    wp.push([t, ...v, ease, k]);
  };
  let a, b;
  // Intro: the motor unit builds, its impulses running
  a = C.title.a; b = C.title.b;
  show('motor', 0.2, 2.5);
  ramp('motor_build', 0.5, 8, 0, 1);
  ramp('motor_signal', 5, 7, 0, 1);
  cam(a, 'motor', 'default', -35, null, [0, -4, 0.6]);
  cam(b - 1, 'motor', 'default', 5, 'spin');
  // Muscles that tire: the junctions glow, the camera dives into one, and the junction close up fires, then tires
  a = C.tired.a; b = C.tired.b;
  ramp('motor_groups', a, a + 2, 0, 1);
  jump('motor_site', a + 1, 0, 3);
  // the dive: into one end plate as the motor unit fades out, then the junction close up comes in
  ramp('motor_a', a + 7, a + 8.6, 1, 0);
  cam(a + 1, 'motor', 'default', 10);
  cam(a + 5.5, 'motor', 'junction');
  cam(a + 8.6, 'motor', 'junction', 0, null, [0, 0, -0.28]);
  show('syn', a + 8.6, a + 9.4, C.cloud.a - 0.5, C.cloud.a + 1.5);
  // no fibre's surface round the junction anywhere in the story: it only distracts
  key('syn_shell', 0, 0);
  ramp('syn_build', a + 8.7, a + 12, 0, 1);
  ramp('syn_fire', a + 11, a + 12.5, 0, 1);
  ramp('syn_tired', a + 17, a + 22, 0, 1);
  cam(a + 8.7, 'syn', 'wide');
  cam(a + 14, 'syn', 'default');
  cam(b - 0.5, 'syn', 'default', 20, 'spin');
  // The genes: each seed lights where it acts, the camera visiting the nerve ending, the gap, the receptors, the fibre
  a = C.genes.a; b = C.genes.b;
  ramp('syn_tired', a, a + 2, 1, 0);
  ramp('syn_fire', a + 1, a + 3, 1, 0);
  // the gene groups light one after another (nerve ending, gap, muscle membrane, inside) as the camera reaches them
  [[4, 0], [10, 0.3], [13, 0.45], [17, 0.62], [22, 0.86], [24, 1]].forEach(([t, v]) => key('syn_genes', a + t, v));
  cam(a + 2, 'syn', 'default', 10);
  cam(a + 7, 'syn', 'terminal');
  cam(a + 12, 'syn', 'cleft');
  cam(a + 16, 'syn', 'receptors');
  cam(a + 21, 'syn', 'nucleus');
  cam(a + 26, 'syn', 'default', -10);
  cam(b - 1, 'syn', 'default', 15, 'spin');
  ramp('syn_genes', b - 1.5, b + 0.5, 1, 0);
  // The network: the cloud of proteins, the seeds, and their groups as the neighbourhoods grow
  a = C.cloud.a; b = C.cloud.b;
  show('net', a - 0.5, a + 1.5, C.hood.a + 16, C.hood.a + 18);
  ramp('net_cloud', a, a + 6, 0, 1);
  ramp('net_seeds', a + 9, a + 11, 0, 1);
  // k = 1, then the neighbourhoods grow, holding where the text names the number of groups
  // (k = 1 shows its label a little past 0; groups at k = 1 and 2 are the same here)
  [[19, 1], [23, 10], [25, 20], [28, 50], [31, F.oneK || 75]].reduce((k0, [t, k]) => { const v = j => kAt(j) + (j === 1 ? 0.25 : 0); ramp('net_k', a + t - 2, a + t, k0 === null ? 0 : v(k0), v(k)); return k; }, null);
  cam(a + 1.5, 'net', 'default', -30, null, [0, 0, 1.2]);
  cam(a + 8, 'net', 'default', -5, 'spin');
  cam(a + 13, 'net', 'core');
  cam(b - 1, 'net', 'core', 50, 'spin');
  // The walk: walkers with restart, the heat they leave, then the module pulls together
  a = C.walk.a; b = C.walk.b;
  ramp('net_k', a, a + 2, kAt(F.oneK || 75), ED.groups.length - 1);
  ramp('net_walk', a + 2, a + 4, 0, 1); ramp('net_walk', a + 27, a + 29, 1, 0);
  ramp('net_heat', a + 10, a + 20, 0, 1);
  ramp('net_module', a + 23, a + 31, 0, 1);
  cam(a + 1, 'net', 'core', 50);
  cam(a + 21, 'net', 'core', 80, 'spin');
  cam(a + 27, 'net', 'module');
  cam(b - 1, 'net', 'module', 30, 'spin');
  // Neighbourhoods: the module goes back into the cloud, one gene lights its neighbourhood; then the matrix fills
  a = C.hood.a; b = C.hood.b;
  ramp('net_module', a, a + 3, 1, 0);
  ramp('net_heat', a + 1, a + 4, 1, 0);
  ramp('net_seeds', a + 1, a + 4, 1, 0.4);
  if (gi >= 0) { jump('net_gene', a + 2, -1, gi); ramp('net_hood', a + 4, a + 8, 0, 1); }
  cam(a + 1, 'net', 'default', 30);
  // close to the gene, in the cloud (the module back in it), from outside
  const NA = GL.sets.net.api ? GL.sets.net.api() : null, gv = gi >= 0 && NA && NA.geneView ? NA.geneView(gi) : view('net', 'core');
  wp.push([a + 6, ...gv, null, 'net']);
  wp.push([a + 15, gv[0] + 30, ...gv.slice(1), 'spin', 'net']);
  show('tree', a + 16, a + 18, C.endotypes.a + 45, C.endotypes.a + 47);
  ramp('tree_matrix', a + 18, a + 30, 0, 1);
  cam(a + 17.5, 'tree', 'matrix');
  cam(b - 1, 'tree', 'matrix', 15, 'spin');
  // The tree: grown from the leaves, tested from the root, then the genes by their tree distances
  a = C.split.a; b = C.split.b;
  ramp('tree_tree', a + 1, a + 9, 0, 1);
  ramp('tree_test', a + 10, a + 22, 0, 1);
  ramp('tree_mds', a + 28, a + 33, 0, 1);
  cam(a + 1, 'tree', 'tree');
  cam(a + 10, 'tree', 'default');
  cam(a + 22, 'tree', 'default', 15, 'spin');
  cam(a + 29, 'tree', 'mds');
  cam(b - 1, 'tree', 'mds', 40, 'spin');
  // Endotypes: the poster's endotype network, the four endotypes in turn, then each endotype flies to its place
  a = C.endotypes.a; b = C.endotypes.b;
  ramp('tree_mds', a, a + 3, 1, 0);
  ramp('tree_meta', a + 1, a + 5, 0, 1);
  four.reduce((f0, id, j) => { jump('tree_focus', a + 9 + 10 * j - (j === 3 ? 1 : 0), f0, id + 1); return id + 1; }, 0);
  jump('tree_focus', a + 45, four.length ? four[four.length - 1] + 1 : 0, 0);
  cam(a + 2, 'tree', 'meta');
  cam(a + 8, 'tree', 'meta', 10, 'spin');
  // each endotype from its own view (the set's cam e<id>), turning a little while it is told
  four.forEach((id, j) => { const t = a + 9.5 + 10 * j - (j === 3 ? 1 : 0); cam(t + 1, 'tree', 'e' + id); cam(t + 7.5, 'tree', 'e' + id, 6, 'spin'); });
  cam(a + 44, 'tree', 'meta');
  show('syn', a + 45, a + 47);
  ramp('syn_endo', a + 47, a + 53, 0, 1);
  four.reduce((p0, id, j) => { jump('syn_place', a + 50 + 2.6 * j, p0, id + 1); return id + 1; }, 0);
  cam(a + 46.5, 'syn', 'wide');
  cam(a + 50, 'syn', 'default');
  cam(b, 'syn', 'default', 25, 'spin');
  // What for: the junction with every endotype in its place
  a = C.next.a; b = C.next.b;
  jump('syn_place', a + 3, four.length ? four[four.length - 1] + 1 : 0, 0);
  cam(a + 5, 'syn', 'wide', 20);
  cam(b, 'syn', 'wide', 60, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  label('syn', () => anchorOf('syn', 'scaffold'), '<b>Fatigable weakness</b>each twitch weaker', C.tired.a + 18, C.tired.b - 0.5, 'amb');
}
// camera waypoints: [t, az, el, dist, tx, ty, tz, ease, set]; 'spin' segments turn at a steady pace.
// When the story hands over from one set to another, the new set is turned about its
// vertical axis so that its first view starts where the camera already is: a crossfade
// never swings the camera round. The set keeps that turn while it is on show (setYaw).
function buildCamera(wp) {
  wp.sort((x, y) => x[0] - y[0]);
  const turn = (w, deg) => {
    const r = deg * D2R, x = w[4], z = w[6];
    w[1] += deg; w[4] = x * Math.cos(r) + z * Math.sin(r); w[6] = -x * Math.sin(r) + z * Math.cos(r);
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
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7]];
  });
}
// the turn a set has at story time t: that of its latest stay on show (it starts fading in a little before its first view)
function setYaw(k, t) {
  let c = 0;
  for (const y of ST.yaw) if (y.k === k && y.t0 - 6 <= t) c = y.c;
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
function storyCam(t) {
  const wp = ST.wp;
  if (t <= wp[0][0]) return wp[0].slice(1, 7);
  for (let i = 1; i < wp.length; i++) {
    if (t <= wp[i][0]) {
      const p = wp[i - 1], q = wp[i], x = q[0] > p[0] ? (q[7] === 'spin' ? spinEase : smoothSeg)(t - p[0], q[0] - p[0]) : 1;
      return [p[1] + (q[1] - p[1]) * x, p[2] + (q[2] - p[2]) * x, Math.exp(Math.log(p[3]) + (Math.log(q[3]) - Math.log(p[3])) * x),
        p[4] + (q[4] - p[4]) * x, p[5] + (q[5] - p[5]) * x, p[6] + (q[6] - p[6]) * x];
    }
  }
  return wp[wp.length - 1].slice(1, 7);
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
function buildSetLabels() {
  for (const k of SET_ORDER) for (const L of GL.sets[k].labels || []) {
    const [b, r] = L.text;
    LBL.sets.push({ kind: 'set', el: labelEl(`<b>${esc(b)}</b>${esc(r || '')}`, L.cls), set: k, at: L.at, alpha: L.alpha, minor: !!L.minor, o: -1 });
  }
}
// a set label shows as far as its set is in and its own rule allows
// (labels a set marks as minor give way on narrow screens)
const setLabelAlpha = (L, S) => {
  const a = S[L.set + '_a'] || 0;
  if (a < 0.5 || (L.minor && !GL.wide && !XR.on)) return 0;
  return (2 * a - 1) * clamp(L.alpha ? L.alpha(S) : 1, 0, 1);
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
      if (!L.w) { L.w = L.el.offsetWidth || 120; L.h = L.el.offsetHeight || 22; }
      const sx = (_v.x * 0.5 + 0.5) * W;
      x = sx + 9; y = (-_v.y * 0.5 + 0.5) * H - 11;
      if (pr.width && y + L.h > pr.top && y < pr.bottom && x < pr.right + 6) {
        // a point just beside the panel keeps its label next to the panel; one behind it shows none
        if (GL.wide && sx > pr.right - 40) x = pr.right + 6; else o = 0;
      }
      if (y + L.h > barTop - 4 || y < 50) o = 0;
      x = Math.min(x, W - L.w - 6);
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
    const p = $('#panel'), over = fresh.getBoundingClientRect().bottom - (p.getBoundingClientRect().bottom - parseFloat(getComputedStyle(p).paddingBottom));
    if (over > 0) p.scrollTo({ top: p.scrollTop + over, behavior: 'smooth' });
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
