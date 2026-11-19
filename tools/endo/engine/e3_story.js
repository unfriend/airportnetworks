//#use head
// ================================================================== STORY ==
// Narration timing: [time in the recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands on
// the matching sentence. The story is narrated by a synthetic voice
// (audio/narration-endo.mp3, Kokoro's af_heart): node tools/voice/narrate.mjs
// endo writes this table and NARRATION_ENDS from the recording it makes (each
// stretch lasts the longer of 1.1 times its story time and its line's audio
// plus a pause); run it again after the text changes (see
// tools/voice/README.md).
const NARRATION_SYNC = [
  [0, 0], [1.32, 1.2], [3.62, 2.4], [6.49, 4], [15.38, 9], [16.04, 9.6], [26.25, 13.3],  // Intro
  [27.02, 14], [28.32, 15.18], [30.18, 15.2], [39.86, 24], [49.04, 31], [58.23, 36], [58.89, 36.6],
  [68.14, 39.3],                                      // Tired
  [68.91, 40], [70.21, 41.18], [72.94, 41.2], [80.89, 46], [86.61, 51], [91.17, 55], [97.71, 60],
  [104.08, 65], [104.74, 65.6], [114.65, 69.3],       // Genes
  [115.42, 70], [116.72, 71.18], [119.88, 71.2], [133.78, 79], [145.33, 87], [145.99, 87.6],
  [154.73, 89], [159.13, 93], [161.87, 95], [168.47, 101], [175.87, 107.3],  // Network
  [176.64, 108], [177.93, 109.18], [180.3, 109.2], [193.07, 119], [205.17, 130], [212.8, 134],
  [214.86, 135.5], [215.52, 136.1], [218.24, 137],    // Walk
  [230.34, 148], [231.64, 149.18], [233.68, 149.2], [249.48, 159], [261.69, 170], [262.35, 170.6],
  [264.27, 171], [264.93, 171.6], [267.13, 172],      // Neighbours
  [281.43, 185], [282.73, 186.18], [285.44, 186.2], [292.92, 193], [305.22, 204],  // Tree
  [328.32, 225], [329.62, 226.18], [331.5, 226.2], [343.11, 233], [355.41, 243], [356.07, 243.6],
  [377.89, 253], [393.19, 263], [408.01, 271], [414.61, 277], [423.31, 284.3],  // Endotypes
  [424.08, 285], [425.38, 286.18], [427.43, 286.2], [432.11, 288.5], [436.56, 291], [442.05, 294],
  [447.78, 298], [461.85, 309.3], [462.62, 310],      // What for
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { title: 26.05, tired: 67.9, genes: 114.45, cloud: 175.65, walk: 221.1, hood: 275.45, split: 320.55, endotypes: 423.1, next: 461.65 };
//#use storyT narrT T_END
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
//#use C DEF buildDefaults TR key ramp evalTrack storyState fadeVal ST view~2 anchorOf
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
//#use listOf
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
  const step = (id, at, out, text) => `<ul class="steps" data-at="${at}"${out ? ` data-out="${out}"` : ''} style="grid-area:1/1"><li style="border-left-color:${endoCol(id)}"><b style="color:${endoCol(id)}">Endotype ${id} · ${esc(E[id].name)}</b>${text}</li></ul>`;
  // ------------------------------------------------------------ panel copy
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">Endotypes</h1>
      <p class="lede" data-at="2.4">One disease, many mechanisms</p>
      <p data-at="4">${F.seeds} genes cause a group of rare diseases of the junction between nerve and muscle. How many mechanisms hide behind them?</p>
      <p class="note" data-at="9">This is a story of congenital myasthenic syndromes, and of EndotypY, a Python package that finds the endotypes of a disease in a network of proteins.</p>`,
    tired: `<h2 data-at="0.6">Muscles that tire</h2>
      <p data-at="1.2">Every movement starts with a nerve cell telling muscle fibres to contract. Each fibre meets the nerve at one point: the neuromuscular junction.</p>
      <p data-at="10">Up close, the nerve ending releases acetylcholine. It crosses a narrow gap and opens receptors on the muscle, and the fibre twitches.</p>
      <p data-at="17" class="amber">In congenital myasthenic syndromes, or CMS, the signal runs down: muscles tire as they work, and weakness grows with effort.</p>
      <p data-at="22">CMS are rare and inherited, most often from both parents. Some patients only tire with exercise; others struggle to walk, or to breathe.</p>`,
    genes: `<h2 data-at="0.6">${F.seeds} genes, one junction</h2>
      <p data-at="1.2">The Gene Table of Neuromuscular Disorders lists ${F.seeds} genes for CMS. Each works somewhere in the junction.</p>
      <ul class="steps">
        <li data-at="6"><b>Nerve ending · ${F.sites.nerve} genes</b>making, loading and releasing acetylcholine</li>
        <li data-at="11"><b>The gap · ${F.sites.cleft} genes</b>the basement membrane that holds it together</li>
        <li data-at="15"><b>Muscle membrane · ${F.sites.membrane} genes</b>the receptor, the proteins that cluster it, and sodium channels</li>
        <li data-at="20"><b>Inside the fibre · ${F.sites.fibre} genes</b>sugar chains for receptors, the scaffold and the nuclei</li>
      </ul>
      <p data-at="25" class="amber">Yet one mutation can be mild in one patient and severe in another. Genes alone do not explain the range; other genes in their networks are thought to shape it.</p>
      <p class="credits" data-at="27">Gene Table of Neuromuscular Disorders; places after UniProt (the junction is illustrative). Severity: Núñez-Carpintero et al., Nature Communications (2024).</p>`,
    cloud: `<h2 data-at="0.6">${fmt(F.genes)} proteins</h2>
      <div style="display:grid">
        <p data-at="1.2" data-out="8.5" style="grid-area:1/1">Proteins that interact make a network: here, ${fmt(F.genes)} proteins joined by ${fmt(F.links)} links. The ${F.seeds} CMS genes are its seeds.</p>
        <p data-at="9" class="amber" style="grid-area:1/1">Do the seeds share mechanisms? Endotypes are subtypes of a disease defined by its molecules: groups of disease genes that hang together, in the network and in what they do.</p>
      </div>
      <p data-at="17">First, one group or several? Give each seed a neighbourhood of its closest proteins, k of them. Seeds whose neighbourhoods meet form a group.</p>
      <div class="facts">${ks.map((k, j) => `<div data-at="${[19, 23, 25, 28][j]}"><b>${F.groupsAt(k)}</b><small>${F.groupsAt(k) === 1 ? 'group' : 'groups'} when k is ${k}</small></div>`).join('')}</div>
      <p data-at="31" class="amber">${F.oneK ? `Once k reaches ${F.oneK}, all ${F.seeds} seeds share one neighbourhood: one module, which the next steps split.` : 'The seeds stay in several groups.'}</p>
      <p class="credits" data-at="33">Step 1 of EndotypY (optional): seed groups.${F.firstShare.length ? ` Even at k = 1, ${listOf(F.firstShare)} share one.` : ''} The protein network is the one the authors used.</p>`,
    walk: `<h2 data-at="0.6">A walker that keeps coming home</h2>
      <p data-at="1.2">To find the rest of the module, EndotypY sends random walkers out from the seeds. At every step a walker hops to a random neighbour, or, ${word(F.tenths)} times in ten, jumps back to a seed.</p>
      <p data-at="11">Proteins the walkers visit again and again are close to the seeds, by many paths at once.</p>
      <p data-at="22" class="amber">The most visited proteins join the seeds, one by one, until the module holds together. In the authors' run:</p>
      <div class="facts"><div data-at="26"><b>${F.seeds}</b><small>seeds</small></div><div data-at="27.5"><b>${F.found}</b><small>more found by the walk</small></div><div data-at="29"><b>${F.module}</b><small>genes in the module</small></div></div>
      <p class="credits" data-at="32">Step 2 of EndotypY: network expansion by random walk with restart (restart probability ${F.r}, the package's default). The walkers and their heat are a re-run with the package's defaults; the module is the authors'.</p>`,
    hood: `<h2 data-at="0.6">Every gene's neighbourhood</h2>
      <p data-at="1.2">What does each gene do? Its neighbours tell more than the gene alone. Take ${esc(gsym)}, which anchors acetylcholinesterase in the gap. A walk from ${esc(gsym)} alone marks its neighbourhood: the top ${F.pct} per cent of the network, ${F.hood} proteins.</p>
      <p data-at="11">Some parts of the cell, named by Gene Ontology terms, come up among them more often than by chance. With ${esc(gsym)}'s own, they become ${esc(gsym)}'s row of marks. Every gene gets one.</p>
      <div class="facts"><div data-at="22"><b>${F.module}</b><small>genes</small></div><div data-at="23"><b>${F.terms}</b><small>cell parts</small></div><div data-at="24"><b>${fmt(F.ones)}</b><small>marks</small></div></div>
      <p data-at="28" class="amber">Genes with similar rows sit among similar parts of the cell.</p>
      <p class="credits" data-at="30">Step 3 of EndotypY: functional neighbourhood annotation (gene-set enrichment with GSEApy and Enrichr libraries; here ${esc(F.featLib.replace(/_/g, ' '))}).</p>`,
    split: `<h2 data-at="0.6">A tree that splits only when it must</h2>
      <p data-at="1.2">Genes with similar rows are joined, pair by pair, into a tree.</p>
      <p data-at="8">Where to cut it? Not at a fixed height. Tree2BreakSpace tests every split from the root down: do the two sides use the cell's parts differently? A split stays only when the data say so.</p>
      <p data-at="19" class="amber">Only ${F.cuts} splits are kept, which leaves ${F.endotypes} endotypes.</p>
      <p data-at="28">Laid out by their distances in the tree, genes that are close in the tree land close together.</p>
      <p class="credits" data-at="32">Step 4 of EndotypY: statistically filtered hierarchical clustering (Tree2BreakSpace, Sakalli et al., in progress).</p>`,
    endotypes: `<h2 data-at="0.6">${F.endotypes} endotypes</h2>
      <p data-at="1.2">Each endotype is a group of genes tied together in the network and in what they do. Here each one is a bubble, with grey bands for the links between them. In the authors' analysis:</p>
      <div style="display:grid">
        ${E[1] ? step(1, 8, 17.5, `${listOf(inEndo(1, ['SLC25A1']))} exports citrate from the nerve ending's mitochondria; from it comes acetyl-CoA, needed to make acetylcholine.`) : ''}
        ${E[9] ? step(9, 18, 27.5, `forming and releasing synaptic vesicles, with genes such as ${inEndo(9, ['SYT1', 'SYT2', 'SNAP25', 'STX19', 'RPH3A']).join(', ')}. Givinostat, a treatment for Duchenne muscular dystrophy, perturbs several of this endotype's genes: a lead for repurposing, not a treatment for CMS.`) : ''}
        ${E[5] ? step(5, 28, 37.5, `the receptor subunits ${inEndo(5, ['CHRNB1', 'CHRND']).join(', ')}, which start the muscle's signal, and the sodium channels ${inEndo(5, ['SCN4A', 'SCN8A', 'SCN1B']).join(', ')}, which carry it on.`) : ''}
        ${E[2] ? step(2, 38, 45.5, `the matrix in the gap, with genes such as ${inEndo(2, ['COLQ', 'AGRN', 'LAMB2', 'LAMA5', 'COL13A1']).join(', ')}. It holds the junction together and anchors acetylcholinesterase.`) : ''}
      </div>
      <p data-at="46" class="amber">Back in the junction, the endotypes with a shared place settle there.</p>
      <p class="note" data-at="52">${Word(F.clear)} endotypes share a clear place in the cell, and ${word(F.weak)} a weak one; ${word(F.none)} share none and hover loose: endotypes ${F.noPlace.join(', ')}.</p>`,
    next: `<h2 data-at="0.6">What endotypes are for</h2>
      <ul class="steps">
        <li data-at="1.2"><b>Patients</b>grouping them by mechanism, not by broad symptoms</li>
        <li data-at="3.5"><b>Drugs</b>finding pathways to target, and drugs to repurpose</li>
        <li data-at="6"><b>Rare and common</b>tracing the links between rare and common forms of a disease</li>
      </ul>
      <p data-at="9">EndotypY is open source: a Python package you can install from GitHub.</p>
      <p data-at="13">The authors are Chloé Bûcheron, Iker Núñez-Carpintero, Enes Sakalli, Mathilde Meyenberg, Julia Guthrie and Jörg Menche, of the Ludwig Boltzmann Institute for Network Medicine at the University of Vienna.</p>
      <p data-at="17"><button class="btn primary" id="btnGoExplore" type="button">Explore the endotypes</button></p>
      <p class="credits" data-at="19">Endotypes: the authors' result. The steps before them: re-run with the package's defaults to show the method. ISMB 2026 poster. EndotypY: github.com/menchelab/EndotypY. Rare and common autoimmunity: Guthrie et al., Science Advances (2023). Narration: a synthetic voice (Kokoro).</p>`,
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

  // ------------------------------------------------------------ sound effects
  // (sfxCue: story time, a sound, where it comes from: a set and one of its anchors; its options)
  sfxCue(C.title.a + 0.5, 'grow', 'motor', null, { dur: 7.5, pitch: 0.9 });              // the motor unit builds
  sfxCue(C.title.a + 5, 'spark', 'motor', 'axon');                                       // its impulses run
  a = C.tired.a;
  sfxCue(a + 7, 'whoosh', 'motor', 'junction', { dur: 1.6 });                            // the dive into an end plate
  sfxCue(a + 11, 'spark', 'syn', 'activezone', { seq: true });                           // the junction fires
  sfxCue(a + 11.6, 'spark', 'syn', 'activezone', { seq: true });
  [0.45, 0.28, 0.15].forEach((g, k) => sfxCue(a + 17 + 2 * k, 'spark', 'syn', 'activezone', { gain: g, seq: true }));   // and tires
  ['terminal', 'cleft', 'receptors', 'channels', 'nucleus'].forEach((p, k) => sfxCue(C.genes.a + [4, 10, 13, 17, 22][k], 'step', 'syn', p, { pitch: Math.pow(2, 2 * k / 12), seq: true }));   // gene groups light where they act
  a = C.cloud.a;
  sfxCue(a + 0.3, 'grow', 'net', 'cloud', { dur: 6 });                                   // the proteins
  sfxCue(a + 9, 'pulse', 'net', 'seeds');                                                // the seeds
  sfxCue(a + 17, 'grow', 'net', 'seeds', { dur: 12, pitch: 1.2, gain: 0.3 });            // their neighbourhoods grow
  a = C.walk.a;
  sfxCue(a + 2, 'pulse', 'net', 'seeds');                                                // walkers set out
  sfxCue(a + 10, 'grow', 'net', 'module', { dur: 10, pitch: 0.7, gain: 0.3 });           // the heat they leave
  sfxCue(a + 23, 'rise', 'net', 'module', { dur: 8 });                                   // the module pulls together
  a = C.hood.a;
  sfxCue(a + 2, 'pick', 'net', 'gene');                                                  // one gene
  sfxCue(a + 16, 'whoosh', 'tree', 'matrix');                                            // to the matrix
  sfxCue(a + 18, 'patter', 'tree', 'matrix', { dur: 10, gain: 0.25 });                   // its marks fill in
  sfxCue(C.split.a + 1, 'grow', 'tree', 'tree', { dur: 8, pitch: 0.8 });                 // the tree grows from its leaves
  sfxCue(C.split.a + 28, 'whoosh', 'tree', 'mds');                                       // the genes by tree distance
  a = C.endotypes.a;
  sfxCue(a + 1, 'rise', 'tree', 'meta', { dur: 4 });                                     // the endotype network
  four.forEach((id, j) => sfxCue(a + 9 + 10 * j - (j === 3 ? 1 : 0), 'ping', 'tree', 'meta', { gain: 0.4 }));   // each endotype told
  four.forEach((id, j) => sfxCue(a + 50 + 2.6 * j, 'bubble', 'syn', 'e' + id, { gain: 0.3, seq: true }));   // each flies to its place
  sfxCue(C.next.a + 3, 'rise', 'syn', null, { gain: 0.4 });                              // every endotype in place
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  label('syn', () => anchorOf('syn', 'scaffold'), '<b>Fatigable weakness</b>each twitch weaker', C.tired.a + 18, C.tired.b - 0.5, 'amb');
}
//#use buildCamera~3 setYaw smoothSeg spinEase storyCam~2 LBL labelEl label buildSetLabels~2 setLabelAlpha _v labelPos
//#use _placed placeLabels~2 curCh updateStoryDOM~2 buildTimeline ICON_PLAY ICON_PAUSE lastTick updateTimeline