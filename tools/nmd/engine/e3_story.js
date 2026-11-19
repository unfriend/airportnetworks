//#use head
// ================================================================== STORY ==
// Narration timing: [time in the recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands on
// the matching sentence. The story is narrated by a synthetic voice
// (audio/narration-nmd.mp3, Kokoro's af_heart): node tools/voice/narrate.mjs
// nmd writes this table and NARRATION_ENDS from the recording it makes (each
// stretch lasts the longer of 1.1 times its story time and its line's audio
// plus a pause); run it again after the text changes (see
// tools/voice/README.md).
const NARRATION_SYNC = [
  [0, 0], [1.32, 1.2], [6.01, 4], [14.85, 11],        // Intro
  [24.75, 20], [26.05, 21.18], [27.99, 21.2], [60.33, 50.6], [64.98, 51], [65.64, 51.6], [67.23, 52],
  [67.89, 52.6], [70.52, 53], [71.18, 53.6], [73.56, 54], [74.22, 54.6], [78.1, 56], [85.1, 60],  // Motor unit
  [98.3, 72], [99.6, 73.18], [102.18, 73.2], [111.03, 81], [120.04, 87], [123.74, 89], [127.57, 91],  // Causes
  [133.07, 96], [134.37, 97.18], [137.06, 97.2], [148.69, 104], [158.37, 110], [181.47, 131],
  [201.5, 141.3],                                     // Layers
  [202.27, 142], [203.56, 143.18], [205.93, 143.2], [214.48, 150],  // Walker
  [263.98, 195], [265.28, 196.18], [267.88, 196.2], [276.4, 202],  // Contexts
  [309.4, 232], [310.7, 233.18], [312.36, 233.2], [339.64, 258], [346.33, 264],  // Endotypes
  [361.73, 278], [363.03, 279.18], [364.8, 279.2], [372.94, 286.6], [405.42, 300],  // Heart and muscle
  [449.42, 340], [450.71, 341.18], [452.44, 341.2], [466.52, 354], [477.18, 362], [494.67, 374.3],  // Stress test
  [495.44, 375], [496.74, 376.18], [498.51, 376.2], [508.37, 384], [536.97, 410],  // Next
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { title: 21.75, motor: 92.4, why: 131.1, tower: 201.25, walk: 260.15, layers: 300.3, endo: 353.1, overlap: 432.55, stress: 494.45, next: 526.6 };
//#use storyT narrT T_END
const CH = [
  { key: 'title', name: 'Intro', a: 0, b: 20 },
  { key: 'motor', name: 'Motor unit', a: 20, b: 72 },
  { key: 'why', name: 'Causes', a: 72, b: 96 },
  { key: 'tower', name: 'Layers', a: 96, b: 142 },
  { key: 'walk', name: 'Walker', a: 142, b: 195 },
  { key: 'layers', name: 'Contexts', a: 195, b: 232 },
  { key: 'endo', name: 'Endotypes', a: 232, b: 278 },
  { key: 'overlap', name: 'Heart and muscle', a: 278, b: 340 },
  { key: 'stress', name: 'Stress test', a: 340, b: 375 },
  { key: 'next', name: 'Next', a: 375, b: 410 },
];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
//#use C DEF buildDefaults TR key ramp evalTrack storyState fadeVal ST view~2 anchorOf
// ------------------------------------------------------------------ facts --
// Numbers the story quotes, counted from the analysis data (NMD_DATA) when the story loads
const FACTS = (() => {
  const D = NMD_DATA, genes = D.genes.map(r => r.split('|')), G = D.groups.length;
  const inG = (r, g) => ((+r[2] | +r[3]) >> g & 1) === 1, isSeed = (r, g) => (+r[2] >> g & 1) === 1;
  const bin = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const E = new Uint32Array(bin(D.edges).buffer);
  const links = test => { let n = 0; for (let k = 0; k < E.length; k += 2) if (test(genes[E[k] >>> 16], genes[E[k] & 65535])) n++; return n; };
  const CM = 5, HC = 11;
  const both = genes.filter(r => inG(r, CM) && inG(r, HC));
  // pairs of endotypes (one of each group) that share genes, most shared first
  const share = new Map();
  for (const r of both) { const e = r[1].split('.'); const k = e[CM] + '-' + e[HC]; share.set(k, (share.get(k) || 0) + 1); }
  const pairs = [...share].sort((a, b) => b[1] - a[1]).map(([k, n]) => { const [c1, c2] = k.split('-').map(Number); return { c1, c2, n }; });
  const endoName = (g, c) => { const e = D.groups[g].endo.find(x => x.c === c); return e ? e.name : ''; };
  const topLayer = g => { let b = 0; D.groups[g].z.forEach((z, p) => { if (z > D.groups[g].z[b]) b = p; }); return D.layers[D.ppi[b]].name; };
  const cats = {}; for (const l of D.layers) cats[l.cat] = (cats[l.cat] || 0) + 1;
  return {
    genes: genes.length, links: E.length / 2, layers: D.layers.length, cats, groups: G,
    endotypes: D.groups.reduce((a, g) => a + g.endo.length, 0),
    cm: { seeds: D.groups[CM].seeds, added: D.groups[CM].added, n: genes.filter(r => inG(r, CM)).length, endo: D.groups[CM].endo.length },
    hc: { n: genes.filter(r => inG(r, HC)).length }, shared: both.length, pairs, endoName, topLayer,
    seedLinks: links((a, b) => (isSeed(a, CM) || isSeed(a, HC)) && (isSeed(b, CM) || isSeed(b, HC))),
    moduleLinks: links((a, b) => (inG(a, CM) || inG(a, HC)) && (inG(b, CM) || inG(b, HC))),
  };
})();

function buildStory() {
  const F = FACTS, D = NMD_DATA, T = GL.sets.tower;
  const lc = s => s.charAt(0).toLowerCase() + s.slice(1);
  // the biggest endotypes of congenital myopathies, by name, for the text
  const named = D.groups[5].endo.filter(e => e.name).sort((a, b) => b.n - a.n);
  const muscle = named.filter(e => /muscle|sarcomere|myofibril|contraction|actin|myosin/i.test(e.name) && e.name.length <= 45);
  const cmEndo = (muscle.length >= 2 ? muscle : named).slice(0, 3).map(e => `number ${e.c}, ${lc(e.name)}`);
  const shared = F.pairs.slice(0, 2).map(p => `endotype ${p.c1} of congenital myopathies, ${lc(F.endoName(5, p.c1) || 'unnamed')}, and endotype ${p.c2} of cardiomyopathies, ${lc(F.endoName(11, p.c2) || 'unnamed')}, with ${p.n} genes in common`);
  const capped = F.cm.added >= 200;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // jump an index param (a disease group, a site) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // ------------------------------------------------------------ panel copy
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">Hidden connections</h1>
      <p class="lede" data-at="2.4">in rare diseases of nerves and muscles</p>
      <p data-at="4">${F.layers} layers of data in one network show how rare muscle diseases share their machinery, and what muscle and heart have in common.</p>
      <p class="note" data-at="11">Each dot is a gene, the same gene on every level. Each level links the genes by a different kind of evidence.</p>`,
    motor: `<h2 data-at="0.6">From nerve to muscle</h2>
      <p data-at="1.2">Every movement starts in a motor neuron in the spinal cord. Its long axon, wrapped in myelin, carries the signal to the muscle.</p>
      <p data-at="12">At the neuromuscular junction the nerve passes the signal to the muscle fibre. Inside, chains of sarcomeres, tiny contracting units, pull as thin actin filaments slide along thick myosin filaments.</p>
      <p data-at="30" class="amber">Neuromuscular disorders are rare genetic diseases of this motor unit.</p>
      <div class="facts"><div data-at="31"><b>16</b><small>disease groups</small></div><div data-at="32"><b>1,200</b><small>or more diseases</small></div><div data-at="33"><b>700</b><small>or so causal genes</small></div><div data-at="34"><b>3.7-4.99</b><small>in 10,000 people</small></div></div>
      <p data-at="36">They strike the nerve cells, the nerves, the junction or the muscle, causing weakness and low muscle tone.</p>
      <p data-at="40">The heart muscle is built from the same sarcomeres: its inherited diseases, the cardiomyopathies, belong here too.</p>
      <p class="credits" data-at="44">Gene Table of Neuromuscular Disorders (2024). Motor unit illustrative.</p>`,
    why: `<h2 data-at="0.6">Same weakness, different causes</h2>
      <p data-at="1.2">Patients share weakness, but the causes are many: about 700 genes. There are no molecular subtypes for these diseases yet.</p>
      <p data-at="9">A shared mechanism is called an endotype. Diseases that share one may share a treatment: a drug for one could be repurposed for another.</p>
      <ul class="steps">
        <li data-at="15"><b>First</b>define the endotypes of each disease group</li>
        <li data-at="17"><b>Then</b>find the endotypes that different diseases share</li>
        <li data-at="19"><b>Finally</b>point to genes and drugs worth a closer look</li>
      </ul>`,
    tower: `<h2 data-at="0.6">${F.layers} layers, one network</h2>
      <p data-at="1.2">To see mechanisms, look at the genes from every side at once. The multiplex network stacks ${F.layers} layers; in each, the same genes are linked by a different kind of evidence.</p>
      <ul class="steps">
        <li data-at="8"><b>Proteins</b>those that bind each other, in a core of links found in more than 24 tissues and in ${F.cats.ppi - 1} tissue layers with links of their own</li>
        <li data-at="14"><b>Genes</b>those switched on together, in ${F.cats.coex - 1} tissues and in a core layer</li>
        <li data-at="20"><b>Symptoms</b>those that genes share, in people and in mice</li>
        <li data-at="25"><b>Pathways and drugs</b>shared pathways and drug targets</li>
        <li data-at="30"><b>Essential</b>genes that cells need together, from CRISPR screens</li>
      </ul>
      <p class="note" data-at="35">This map holds ${fmt(F.genes)} genes, the known genes of the ${F.groups} disease groups plus the genes the walk added, and ${fmt(F.links)} protein links. The groups are the Gene Table's 16, with small ones joined to their closest. Layers still waiting for their data show as dotted rims.</p>
      <p class="credits" data-at="38">Proteins: Kotlyar et al. (IID). Genes switched on together: GTEx, with the co-expression core of Buphamalai et al., Nature Communications (2021). Symptoms: HPO, MPO. Pathways: Reactome. Drug targets: NeDRex.</p>`,
    walk: `<h2 data-at="0.6">A walker that keeps coming home</h2>
      <p data-at="1.2">Start from the genes known to cause one group of diseases: here the ${F.cm.seeds} genes of congenital myopathies in the Gene Table.</p>
      <p data-at="8">A random walker sets off from them. At every step it jumps back to a known gene seven times in ten; otherwise it follows a link. At a gene found in several layers it changes layer half the time, preferring the layers where the disease's genes cluster most.</p>
      <p data-at="24" class="amber">Genes the walker visits again and again are close to the disease, from many sides at once.</p>
      <p data-at="34">The most visited genes join the disease module one by one, until the module holds together, or 200 genes have joined. ${capped ? 'For congenital myopathies the walk stopped at the limit of 200.' : `For congenital myopathies, ${F.cm.added} joined.`} Other groups held together sooner: for some a single gene was enough.</p>
      <p class="credits" data-at="44">Random walk with restart on the multiplex: restart 0.7, layer switch 0.5, layers weighted by z-score. After Buphamalai et al. (2021).</p>`,
    layers: `<h2 data-at="0.6">Different diseases, different layers</h2>
      <p data-at="1.2">Not every layer matters for every disease. A protein layer counts when a group's known genes link up in it more than chance would allow.</p>
      <ul class="steps">
        <li data-at="7"><b>Motor and sensory neuropathies</b>strongest in the protein layer of the ${lc(F.topLayer(1))}</li>
        <li data-at="16"><b>Myasthenic syndromes</b>strongest in the protein layer of the ${lc(F.topLayer(4))}</li>
        <li data-at="25"><b>Muscular dystrophies</b>strongest in the protein layer of the ${lc(F.topLayer(9))}</li>
      </ul>
      <p class="credits" data-at="30">A protein layer counts at a z-score of at least 1.645. Z-scores computed in this map over the protein layers: the largest linked group of a disease's known genes against ${fmt(D.walk.runs)} random gene sets with the same numbers of links.</p>`,
    endo: `<h2 data-at="0.6">Endotypes</h2>
      <p data-at="1.2">Inside a module, genes that do the same job sit together. Grouping them by the functions around them, their Gene Ontology terms, splits each module into endotypes.</p>
      <p data-at="12">Congenital myopathies fall into ${F.cm.endo} endotypes, among them ${cmEndo.join('; ')}.</p>
      <p data-at="26" class="amber">Across the ${F.groups} groups there are ${F.endotypes} endotypes, candidates for shared mechanisms.</p>
      <p class="note" data-at="32">Endotypes are numbered within each group, and named after the most typical Gene Ontology process of their genes.</p>`,
    overlap: `<h2 data-at="0.6">Heart and muscle</h2>
      <p data-at="1.2">Congenital myopathies and inherited cardiomyopathies often come together. Do they share machinery?</p>
      <p data-at="8">Side by side, congenital myopathies have ${F.cm.n} genes, cardiomyopathies ${F.hc.n}, and ${F.shared} are in both. The endotypes that share the most genes are ${shared.join('; ')}.</p>
      <p data-at="22">The overlap shows in shared symptoms, in genes switched on together in the heart's atrium and ventricle, and in the proteins of skeletal muscle.</p>
      <p data-at="34" class="amber">Their known genes alone share ${fmt(F.seedLinks)} protein links in this map. With the genes the walk found, ${fmt(F.moduleLinks)} links tie them together. Without the walk, much of what they share is missed.</p>
      <p class="credits" data-at="46">Congenital myopathies (endotypes CM 1-${F.cm.endo}) and hereditary cardiomyopathies (HC); layers after netviz-iactive by Philipp Friedrich.</p>`,
    stress: `<h2 data-at="0.6">A stress test</h2>
      <p data-at="1.2">How much does the result hang on any one layer? Layers were removed at random, again and again: 10,000 networks for every number of removed layers, 680,000 in all.</p>
      <p data-at="14">It took about 45 hours on MareNostrum 5 at the Barcelona Supercomputing Center, in jobs of 25 nodes with 112 cores each.</p>
      <p data-at="22" class="amber">The modules keep their originally detected genes until most layers are gone; with fewer layers the walk has to search wider. The full multiplex finds the smallest sets of genes that define the disease modules. That is the authors' result; the picture only illustrates it.</p>
      <p class="credits" data-at="28">With Alfonso Valencia and Davide Cirillo, Barcelona Supercomputing Center.</p>`,
    next: `<h2 data-at="0.6">What comes next</h2>
      <p data-at="1.2">Genes shared by the endotypes of different diseases are candidates for diagnosis, and for drugs that might be repurposed from one disease to another.</p>
      <p data-at="9">The same approach now turns to inborn errors of immunity, with Pauline Staiber.</p>
      <p data-at="14">This work is by Iker Núñez-Carpintero and Philipp Friedrich, with Julia Guthrie and Jörg Menche, of the Guthrie Lab and the Menche Lab at the Ludwig Boltzmann Institute for Network Medicine in Vienna.</p>
      <p data-at="20"><button class="btn primary" id="btnGoExplore" type="button">Explore the network</button></p>
      <p class="credits" data-at="22">ISMB 2026 (NetBio). Earlier multilayer work: Núñez-Carpintero et al., Nature Communications (2024). Data: Gene Table of Neuromuscular Disorders 2024, IID, GTEx, HPO, MPO, Reactome, NeDRex. Narration: a synthetic voice (Kokoro).</p>`,
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
  const CMg = 6, HCg = 12; // tower_group values: group index + 1
  let a, b;
  // Intro: the tower rises, layer by layer, every disease group in its colour
  a = C.title.a; b = C.title.b;
  show('tower', 0.2, 2.5, b - 1.5, b + 0.5);
  ramp('tower_rise', 0.5, 10, 0, 1);
  cam(a, 'tower', 'default', -40, null, [0, -6, 0.8]);
  cam(b - 1, 'tower', 'default', 25, 'spin');
  // The motor unit: nerve, junction, muscle, sarcomere, and the diseases on it
  a = C.motor.a; b = C.motor.b;
  show('motor', a - 0.5, a + 1.5, b - 1.5, b + 0.5);
  ramp('motor_build', a, a + 6, 0, 1);
  ramp('motor_signal', a + 7, a + 9, 0, 1); ramp('motor_signal', a + 30, a + 32, 1, 0);
  ramp('motor_open', a + 17, a + 21, 0, 1);
  ramp('motor_contract', a + 23, a + 26, 0, 1); ramp('motor_contract', a + 30, a + 32, 1, 0);
  ramp('motor_groups', a + 31, a + 34, 0, 1);
  // the heart lights as the camera reaches it
  [[a + 37, 1], [a + 39, 2], [a + 40.5, 3], [a + 42, 4], [a + 44, 5]].reduce((v0, [t, v]) => { jump('motor_site', t, v0, v); return v; }, 0);
  jump('motor_site', b - 3, 5, 0);
  ramp('motor_heart', a + 40, a + 44, 0, 1);
  cam(a + 1, 'motor', 'default', -20);
  cam(a + 6, 'motor', 'cord');
  cam(a + 11, 'motor', 'junction');
  cam(a + 16, 'motor', 'fibre');
  // the magnified sarcomere from outside, the rest of the unit behind it: down the filaments past its outer Z-disc, then
  // round to the side (the camera stays clear of the lattice; in a headset nothing passes you)
  cam(a + 22, 'motor', 'sarcEnd');
  cam(a + 29, 'motor', 'sarcSide', 0, 'spin');
  cam(a + 34, 'motor', 'default', -10);
  cam(a + 44, 'motor', 'heart');
  cam(b - 1, 'motor', 'default', 15, 'spin');
  // Same weakness, different causes: the genes of all groups, seen from above
  a = C.why.a; b = C.why.b;
  show('tower', a - 0.5, a + 2);
  cam(a + 1, 'tower', 'top', -10);
  cam(b, 'tower', 'top', 30, 'spin');
  // The layers: the categories come up, the camera rises along the tower
  a = C.tower.a; b = C.tower.b;
  ramp('tower_cats', a + 2, a + 5, 0.4, 1);
  cam(a + 3, 'tower', 'side', -20);
  cam(a + 14, 'tower', 'ppi', 0, 'spin');
  cam(a + 24, 'tower', 'side', 15, 'spin', [0, 0, 0, 0, 0.5]);
  cam(b - 1, 'tower', 'default', 30, 'spin');
  ramp('tower_cats', b - 3, b, 1, 0.4);
  // The walker: seeds of congenital myopathies, walkers, heat, the module grows
  a = C.walk.a; b = C.walk.b;
  jump('tower_group', a, 0, CMg);
  ramp('tower_seeds', a + 1, a + 3, 0, 1);
  ramp('tower_walk', a + 8, a + 10, 0, 1); ramp('tower_walk', a + 36, a + 38, 1, 0);
  ramp('tower_heat', a + 18, a + 30, 0, 1);
  ramp('tower_module', a + 34, a + 46, 0, 1);
  ramp('tower_heat', a + 44, a + 47, 1, 0);
  cam(a + 1, 'tower', 'ppi', -25);
  cam(a + 18, 'tower', 'ppi', 10, 'spin');
  cam(a + 34, 'tower', 'default', 25);
  cam(b - 1, 'tower', 'default', 45, 'spin');
  // Different layers: each group's z-scores as bars up the tower
  a = C.layers.a; b = C.layers.b;
  ramp('tower_seeds', a, a + 2, 1, 0); ramp('tower_module', a, a + 2, 1, 0);
  ramp('tower_z', a + 2, a + 4, 0, 1);
  jump('tower_group', a + 3, CMg, 2); jump('tower_group', a + 15, 2, 5); jump('tower_group', a + 24, 5, 10);
  ramp('tower_z', b - 2, b, 1, 0);
  cam(a + 2, 'tower', 'ppi', 40);
  cam(b - 1, 'tower', 'ppi', 80, 'spin');
  // Endotypes: congenital myopathies in colour, then gathered on a grid
  a = C.endo.a; b = C.endo.b;
  jump('tower_group', a, 10, CMg);
  ramp('tower_seeds', a + 1, a + 2, 0, 1); ramp('tower_module', a + 1, a + 3, 0, 1);
  ramp('tower_endo', a + 2, a + 6, 0, 1);
  ramp('tower_grid', a + 12, a + 18, 0, 1);
  ramp('tower_grid', b - 3, b, 1, 0);
  cam(a + 2, 'tower', 'default', 60);
  cam(a + 12, 'tower', 'default', 75, 'spin');
  cam(a + 18, 'tower', 'grid', 0);
  cam(b - 1, 'tower', 'grid', 25, 'spin');
  // Heart and muscle: two towers and what they share; seeds alone, then the module again
  a = C.overlap.a; b = C.overlap.b;
  ramp('tower_endo', a, a + 2, 1, 0);
  ramp('tower_pair', a + 2, a + 7, 0, 1);
  ramp('tower_seedonly', a + 34, a + 37, 0, 1); ramp('tower_seedonly', a + 44, a + 47, 1, 0);
  ramp('tower_pair', b - 3, b, 1, 0);
  cam(a + 3, 'tower', 'default', 0);
  cam(a + 8, 'tower', 'pair', 0);
  cam(a + 22, 'tower', 'pair', 20, 'spin');
  cam(a + 34, 'tower', 'pair', -10);
  cam(b - 1, 'tower', 'pair', 10, 'spin');
  // A stress test: layers fall away, the module holds; then the supercomputer and its sea of towers
  a = C.stress.a; b = C.stress.b;
  ramp('tower_drop', a + 1, a + 12, 0, 0.85);
  show('hpc', a + 12.5, a + 14.5, b - 1.5, b + 0.5);
  ramp('tower_a', a + 12, a + 14, 1, 0);
  ramp('hpc_racks', a + 13, a + 15, 0, 1);
  ramp('hpc_field', a + 18, a + 23, 0, 1);
  ramp('hpc_remove', a + 23, b - 2, 0, 0.9);
  for (const n of ['tower_drop', 'tower_seeds', 'tower_module']) ramp(n, a + 14.5, a + 15.5, n === 'tower_drop' ? 0.85 : 1, 0);
  jump('tower_group', a + 15, CMg, 0);
  cam(a + 1, 'tower', 'default', 15);
  cam(a + 12, 'tower', 'default', 45, 'spin');
  // over the hall, then in along the cold aisle's centre line (so the camera never meets a rack), a slow walk down
  // it, back out the same way, and up and out over the sea of towers
  cam(a + 14, 'hpc', 'default');
  cam(a + 16.5, 'hpc', 'aisle');
  cam(a + 18, 'hpc', 'racks');
  cam(a + 21, 'hpc', 'racks', 0, 'spin', [0, 0, 0, 0, 0, -0.24]);
  cam(a + 23, 'hpc', 'aisle');
  cam(a + 25.5, 'hpc', 'default', 20);
  cam(a + 28, 'hpc', 'field');
  cam(b - 1, 'hpc', 'field', 15, 'spin');
  // What comes next: the whole tower once more, opened up around the viewer
  a = C.next.a; b = C.next.b;
  ramp('tower_a', a - 1, a + 1, 0, 1);
  ramp('tower_room', a + 2, a + 8, 0, 1);
  ramp('tower_cats', a + 2, a + 6, 0.4, 1);
  cam(a, 'tower', 'default', 10, null, [0, 0, 0.6]);
  cam(a + 10, 'tower', 'default', 60, 'spin', [0, 0, 0.3]);
  cam(b, 'tower', 'default', 140, 'spin', [0, 0, 0.3]);
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);

  // ------------------------------------------------------------ sound effects
  // (sfxCue: story time, a sound, where it comes from: a set and one of its anchors; its options. sfxHold: a continuous
  // sound while the clock is inside a span)
  const cmAt = () => T.anchors.group(CMg - 1);   // the congenital myopathies' genes in the tower
  sfxCue(C.title.a + 0.5, 'rise', 'tower', 'mid', { dur: 9.5, gain: 0.5 });              // the tower rises layer by layer
  a = C.motor.a;
  sfxCue(a + 0.3, 'grow', 'motor', 'cord', { dur: 6, pitch: 0.9 });                      // the motor unit builds
  sfxCue(a + 7, 'spark', 'motor', 'axon', { seq: true });                                // impulses run down the axon
  sfxCue(a + 7.6, 'spark', 'motor', 'junction', { seq: true });                          // and reach the junction
  sfxCue(a + 17, 'whoosh', 'motor', 'sarcomere', { dur: 4, pitch: 1.2 });                // the sarcomere opens
  sfxCue(a + 23, 'whoosh', 'motor', 'fibre', { dur: 1.5, pitch: 0.7 });                  // the muscle contracts
  sfxCue(a + 31, 'pulse', 'motor', 'junction');                                          // disease groups light on the unit
  sfxCue(a + 40, 'heart', 'motor', 'heart', { gain: 0.5, seq: true });                   // the heart lights
  sfxCue(a + 41, 'heart', 'motor', 'heart', { gain: 0.5, seq: true });
  sfxCue(C.why.a + 0.3, 'whoosh', 'tower', null);                                        // back to the tower, from above
  sfxCue(C.tower.a + 2, 'grow', 'tower', null, { dur: 3, pitch: 0.8 });                  // the categories come up
  a = C.walk.a;
  sfxCue(a + 1, 'pulse', 'tower', cmAt);                                                 // the seeds of congenital myopathies
  sfxCue(a + 8, 'patter', 'tower', cmAt, { dur: 3, pitch: 1.3, gain: 0.3 });             // walkers set out
  sfxCue(a + 18, 'grow', 'tower', cmAt, { dur: 12, pitch: 0.7, gain: 0.3 });             // the heat spreads
  sfxCue(a + 34, 'rise', 'tower', cmAt, { dur: 10 });                                    // the module grows
  [3, 15, 24].forEach((t, k) => sfxCue(C.layers.a + t, 'step', 'tower', null, { pitch: [1, 1.12, 1.26][k], seq: true }));   // each group's z-scores
  sfxCue(C.endo.a + 2, 'grow', 'tower', null, { dur: 4, pitch: 1.1 });                   // endotypes in colour
  sfxCue(C.endo.a + 12, 'ratchet', 'tower', null, { n: 8, dur: 6, gain: 0.3 });          // gathered on a grid
  sfxCue(C.overlap.a + 2, 'whoosh', 'tower', 'pairMid', { dur: 5 });                     // two towers
  sfxCue(C.overlap.a + 34, 'pulse', 'tower', 'pairMid', { pitch: 0.8 });                 // the known genes alone
  a = C.stress.a;
  [1, 0.94, 0.89].forEach((p, k) => sfxCue(a + 2 + 3 * k, 'knock', 'tower', null, { pitch: p, seq: true }));   // layers fall away; the module holds
  sfxCue(a + 18, 'grow', 'hpc', 'field', { dur: 5 });                                    // the sea of towers
  sfxCue(C.next.a + 2, 'rise', 'tower', null, { dur: 6 });                               // the tower opens round you
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  label('tower', () => T.anchors.group(5), `<b>Congenital myopathies</b>${F.cm.seeds} known genes`, C.walk.a + 2, C.walk.a + 16, 'cyn');
  label('tower', 'pairMid', `<b>In both</b>${F.shared} genes`, C.overlap.a + 10, C.overlap.a + 30, 'amb');
}
//#use buildCamera~3 setYaw smoothSeg spinEase storyCam~2 LBL labelEl label buildSetLabels~2 setLabelAlpha _v labelPos
//#use _placed placeLabels~2 curCh updateStoryDOM~2 buildTimeline ICON_PLAY ICON_PAUSE lastTick updateTimeline