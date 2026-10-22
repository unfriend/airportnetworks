
// ================================================================== STORY ==
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Edit here if you record a narration.
const NARRATION_SYNC = [
  [0, 0], [410, 410],
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
  const cmEndo = (muscle.length >= 2 ? muscle : named).slice(0, 3).map(e => `${e.c}, ${lc(e.name)}`);
  const shared = F.pairs.slice(0, 2).map(p => `endotype ${p.c1} of congenital myopathies (${lc(F.endoName(5, p.c1) || 'unnamed')}) and ${p.c2} of cardiomyopathies (${lc(F.endoName(11, p.c2) || 'unnamed')}), ${p.n} genes`);
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
      <p data-at="4">${F.layers} layers of data, one network: how rare muscle diseases share their machinery, and what muscle and heart have in common.</p>
      <p class="note" data-at="11">Each dot is a gene, the same gene on every level. Each level links the genes by a different kind of evidence.</p>`,
    motor: `<h2 data-at="0.6">From nerve to muscle</h2>
      <p data-at="1.2">Every movement starts in a motor neuron in the spinal cord. Its long axon, wrapped in myelin, carries the signal to the muscle.</p>
      <p data-at="12">At the neuromuscular junction the nerve passes the signal to the muscle fibre. Inside, chains of sarcomeres pull: thin actin filaments slide along thick myosin filaments.</p>
      <p data-at="30" class="amber">Neuromuscular disorders are rare genetic diseases of this motor unit.</p>
      <div class="facts"><div data-at="31"><b>16</b><small>disease groups</small></div><div data-at="32"><b>1,200+</b><small>diseases</small></div><div data-at="33"><b>~700</b><small>causal genes</small></div><div data-at="34"><b>3.7-4.99</b><small>in 10,000 people</small></div></div>
      <p data-at="36">They strike the nerve cells, the nerves, the junction or the muscle, with weakness and low muscle tone.</p>
      <p data-at="40">The heart muscle is built from the same sarcomeres: inherited cardiomyopathies belong here too.</p>
      <p class="credits" data-at="44">Gene Table of Neuromuscular Disorders (2024). Motor unit illustrative.</p>`,
    why: `<h2 data-at="0.6">Same weakness, different causes</h2>
      <p data-at="1.2">Patients share weakness, but the causes are many: about 700 genes. There are no molecular subtypes for these diseases yet.</p>
      <p data-at="9">A shared mechanism is called an endotype. Diseases that share one may share a treatment: a drug for one could be repurposed for another.</p>
      <ul class="steps">
        <li data-at="15"><b>Define</b>the endotypes of each disease group</li>
        <li data-at="17"><b>Overlap</b>find the endotypes different diseases share</li>
        <li data-at="19"><b>Point</b>to genes and drugs worth a closer look</li>
      </ul>`,
    tower: `<h2 data-at="0.6">${F.layers} layers, one network</h2>
      <p data-at="1.2">To see mechanisms, look at the genes from every side at once. The multiplex network stacks ${F.layers} layers; in each, the same genes are linked by a different kind of evidence.</p>
      <ul class="steps">
        <li data-at="8"><b>Proteins</b>that bind each other: a core of links found in more than 24 tissues, and ${F.cats.ppi - 1} tissue layers with their own links (IID)</li>
        <li data-at="14"><b>Genes</b>switched on together, in ${F.cats.coex - 1} tissues and a core (GTEx)</li>
        <li data-at="20"><b>Symptoms</b>shared in people and in mice (HPO, MPO)</li>
        <li data-at="25"><b>Pathways, drugs</b>shared pathways (Reactome) and drug targets (NeDRex)</li>
        <li data-at="30"><b>Essential</b>genes that cells need together (CRISPR screens)</li>
      </ul>
      <p class="note" data-at="35">In this map: ${fmt(F.genes)} genes (the known genes of the ${F.groups} disease groups and the genes the walk added) and ${fmt(F.links)} protein links. The Gene Table's 16 groups, small ones joined to their closest. Layers still waiting for their data show as dotted rims.</p>
      <p class="credits" data-at="38">Kotlyar et al. (IID); GTEx, with the co-expression core of Buphamalai et al., Nature Communications (2021); HPO; MPO; Reactome; NeDRex.</p>`,
    walk: `<h2 data-at="0.6">A walker that keeps coming home</h2>
      <p data-at="1.2">Start from the genes known to cause one group of diseases: here the ${F.cm.seeds} genes of congenital myopathies in the Gene Table.</p>
      <p data-at="8">A random walker sets off from them. At every step it jumps back to a known gene seven times in ten; otherwise it follows a link. At a gene found in several layers it changes layer half the time, preferring the layers where the disease's genes cluster most.</p>
      <p data-at="24" class="amber">Genes the walker visits again and again are close to the disease, from many sides at once.</p>
      <p data-at="34">The most visited join the disease module one by one, until the module holds together, or 200 genes have joined. ${capped ? 'For congenital myopathies the walk stopped at the limit of 200.' : `For congenital myopathies, ${F.cm.added} joined.`} Other groups held together sooner: for some a single gene was enough.</p>
      <p class="credits" data-at="44">Random walk with restart on the multiplex: restart 0.7, layer switch 0.5, layers weighted by z-score. After Buphamalai et al. (2021).</p>`,
    layers: `<h2 data-at="0.6">Different diseases, different layers</h2>
      <p data-at="1.2">Not every layer matters for every disease. A protein layer counts when a group's known genes link up in it more than chance would allow (a z-score of at least 1.645).</p>
      <ul class="steps">
        <li data-at="7"><b>Motor and sensory neuropathies</b>strongest in the ${lc(F.topLayer(1))} protein layer</li>
        <li data-at="16"><b>Myasthenic syndromes</b>strongest in the ${lc(F.topLayer(4))} protein layer</li>
        <li data-at="25"><b>Muscular dystrophies</b>strongest in the ${lc(F.topLayer(9))} protein layer</li>
      </ul>
      <p class="credits" data-at="30">Z-scores computed in this map over the protein layers: the largest linked group of a disease's known genes against ${fmt(D.walk.runs)} random gene sets with the same numbers of links.</p>`,
    endo: `<h2 data-at="0.6">Endotypes</h2>
      <p data-at="1.2">Inside a module, genes that do the same job sit together. Grouping them by the functions around them (Gene Ontology terms) splits each module into endotypes.</p>
      <p data-at="12">Congenital myopathies fall into ${F.cm.endo} endotypes, among them ${cmEndo.join('; ')}.</p>
      <p data-at="26" class="amber">Across the ${F.groups} groups: ${F.endotypes} endotypes, candidates for shared mechanisms.</p>
      <p class="note" data-at="32">Endotypes are numbered within each group; names are the most typical GO process of their genes.</p>`,
    overlap: `<h2 data-at="0.6">Heart and muscle</h2>
      <p data-at="1.2">Congenital myopathies and inherited cardiomyopathies often come together. Do they share machinery?</p>
      <p data-at="8">Side by side: ${F.cm.n} genes for congenital myopathies, ${F.hc.n} for cardiomyopathies, ${F.shared} in both. The endotypes that share the most genes: ${shared.join('; ')}.</p>
      <p data-at="22">The overlap shows in shared symptoms, in the co-expression of heart atrium and ventricle, and in the proteins of skeletal muscle.</p>
      <p data-at="34" class="amber">Their known genes alone share ${fmt(F.seedLinks)} protein links in this map. With the genes the walk found, ${fmt(F.moduleLinks)} links tie them together: without the walk, much of what they share is missed.</p>
      <p class="credits" data-at="46">Congenital myopathies (endotypes CM 1-${F.cm.endo}) and hereditary cardiomyopathies (HC); layers after netviz-iactive by Philipp Friedrich.</p>`,
    stress: `<h2 data-at="0.6">A stress test</h2>
      <p data-at="1.2">How much does the result hang on any one layer? Layers were removed at random, again and again: 10,000 networks for every number of removed layers, 680,000 in all.</p>
      <p data-at="14">About 45 hours on MareNostrum 5 at the Barcelona Supercomputing Center, in jobs of 25 nodes with 112 cores each.</p>
      <p data-at="22" class="amber">The modules keep their originally detected genes until most layers are gone; with fewer layers the walk has to search wider. The full multiplex finds the smallest sets of genes that define the disease modules (the authors' result; the picture is illustrative).</p>
      <p class="credits" data-at="28">With Alfonso Valencia and Davide Cirillo, Barcelona Supercomputing Center.</p>`,
    next: `<h2 data-at="0.6">What comes next</h2>
      <p data-at="1.2">Genes shared by the endotypes of different diseases are candidates: for diagnosis, and for drugs that might be repurposed from one disease to another.</p>
      <p data-at="9">The same approach now turns to inborn errors of immunity (Pauline Staiber).</p>
      <p data-at="14">Iker Núñez-Carpintero and Philipp Friedrich, with Julia Guthrie and Jörg Menche: Guthrie Lab and Menche Lab, Ludwig Boltzmann Institute for Network Medicine, Vienna.</p>
      <p data-at="20"><button class="btn primary" id="btnGoExplore" type="button">Explore the network</button></p>
      <p class="credits" data-at="22">ISMB 2026 (NetBio). Earlier multilayer work: Núñez-Carpintero et al., Nature Communications (2024). Data: Gene Table of Neuromuscular Disorders 2024, IID, GTEx, HPO, MPO, Reactome, NeDRex.</p>`,
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
  // the magnified sarcomere from just outside its lattice: down the filaments, then from the side
  cam(a + 22, 'motor', 'sarcomere', 0, null, [0, 8.66, 0.49]);
  cam(a + 29, 'motor', 'sarcomere', 22, 'spin', [0, 16.66, 0.24]);
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
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  label('tower', () => T.anchors.group(5), `<b>Congenital myopathies</b>${F.cm.seeds} known genes`, C.walk.a + 2, C.walk.a + 16, 'cyn');
  label('tower', 'pairMid', `<b>In both</b>${F.shared} genes`, C.overlap.a + 10, C.overlap.a + 30, 'amb');
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
