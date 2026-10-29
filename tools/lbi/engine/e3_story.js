
// ================================================================== STORY ==
// Narration timing: [time in the recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. The tour is narrated by a synthetic voice
// (audio/narration-lbi.mp3, Kokoro's af_heart): node tools/voice/narrate.mjs lbi
// writes this table and NARRATION_ENDS from the recording it makes (each
// stretch lasts the longer of 1.1 times its story time and its line's audio
// plus a pause); run it again after the text changes (see tools/voice/README.md).
const NARRATION_SYNC = [
  [0, 0], [1.3, 1.2], [2.9, 2.4], [4.2, 3.6], [11.9, 8], [12.6, 8.6], [23.5, 13],  // Intro
  [33.4, 22], [34.7, 23.18], [36.3, 23.2], [62.5, 47], [66.3, 49],  // Parts
  [72.1, 54], [72.7, 54.6], [73.7, 55.2], [91.1, 71], [94.6, 73],  // Networks
  [100.7, 78], [102, 79.18], [103, 79.2], [103.6, 79.8], [108.1, 81], [133.4, 104], [138.2, 108],  // Life
  [145.6, 114], [146.2, 114.6], [147.5, 115.2], [156.1, 123], [166.4, 132], [189, 152.6],
  [193.8, 154],                                       // Complexes
  [202.6, 162], [203.9, 163.18], [204.9, 163.2], [219.6, 176.6], [221.8, 177], [236.1, 190],
  [238.1, 191], [257.9, 209], [265.2, 214],           // Map
  [274, 222], [274.7, 222.6], [275.7, 223.2], [284.3, 228], [293.1, 236], [300.5, 240],  // Disease
  [309.3, 248], [310, 248.6], [311.2, 249.2], [312.6, 250.4], [314.5, 251.6],  // Immunity
  [356.7, 290], [357.4, 290.6], [358.7, 291.2], [383.7, 314], [392.1, 318],  // Treatment
  [396.5, 322], [397.1, 322.6], [398.1, 323.2],       // Scales
  [434.2, 356], [434.8, 356.6], [436.4, 358], [437.1, 358.6], [442.5, 360], [445.7, 362],
  [449.6, 364],                                       // Institute
  [471.6, 384], [472.9, 385.2], [484.8, 394],         // Body
  [502.4, 410], [503, 410.6], [504.3, 411.2],         // Tissue
  [536, 440], [538, 441.8], [543.4, 443], [546.9, 445], [549.5, 447], [553.4, 449], [574.3, 468],  // Mission
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
  { key: 'title', name: 'Intro', a: 0, b: 22 },
  { key: 'whole', name: 'Parts', a: 22, b: 54 },
  { key: 'everywhere', name: 'Networks', a: 54, b: 78 },
  { key: 'blocks', name: 'Life', a: 78, b: 114 },
  { key: 'complex', name: 'Complexes', a: 114, b: 162 },
  { key: 'map', name: 'Map', a: 162, b: 222 },
  { key: 'rare', name: 'Disease', a: 222, b: 248 },
  { key: 'iei', name: 'Immunity', a: 248, b: 290 },
  { key: 'treat', name: 'Treatment', a: 290, b: 322 },
  { key: 'scales', name: 'Scales', a: 322, b: 356 },
  { key: 'lbi', name: 'Institute', a: 356, b: 384 },
  { key: 'body', name: 'Body', a: 384, b: 410 },
  { key: 'tissue', name: 'Tissue', a: 410, b: 440 },
  { key: 'mission', name: 'Mission', a: 440, b: 468 },
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

function buildStory() {
  const I = GL.sets.int, SK = GL.sets.sankey;
  // clinical categories, molecular clusters, disease genes
  const SANKEY_N = [SK.left ? SK.left.length : 9, SK.right ? SK.right.length : 19, SK.total || 173];
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // ------------------------------------------------------------ panel copy
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--amber)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--amber)"/><circle cx="352" cy="36" r="4.5" fill="var(--amber)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">A glimpse into the future</h1>
      <p class="lede" data-at="2.4">of network medicine</p>
      <p data-at="3.6">Welcome to the Ludwig Boltzmann Institute for Network Medicine in Vienna: a tour from the parts of a protein machine to the whole body.</p>
      <p data-at="8">Each dot stands for a human protein, each line for a physical interaction between two of them. This illustrative map has ${fmt(I.nodeCount)} dots and ${fmt(I.edgeCount)} lines; real maps of the human interactome hold more than 13,000 proteins and 140,000 interactions.</p>
      <p class="note" data-at="13">The lights are groups of proteins that work together: the proteasome, growth-factor signalling, cell death and DNA repair.</p>`,
    whole: `<h2 data-at="0.6">More than the sum of its parts</h2>
      <p data-at="1.2">A computer is built from a few hundred parts: chips full of transistors, resistors, screws.</p>
      <div style="display:grid">
        <p data-at="7" data-out="15.5" style="grid-area:1/1">Take it apart and lay out every piece, and you have the complete parts list. It still does not tell you how the computer works.</p>
        <p data-at="16" class="amber" style="grid-area:1/1">What makes it work is how the parts are wired together.</p>
      </div>
      <p data-at="25">Parts joined by wires: a network. Life is built the same way.</p>
      <p class="credits" data-at="27">After Todd McLellan, Things Come Apart (2013), and the Apple I schematic (Apple Computer Company, 1976), designed by Steve Wozniak.</p>`,
    everywhere: `<h2 data-at="0.6">Networks are everywhere</h2>
      <p data-at="1.2">Once you look for the wiring, you find it everywhere. The internet is a network of computers and cables, held together by a few giant hubs.</p>
      <p data-at="11">Friendships form a network too. Each bright light is a city; most ties join nearby cities, a few cross oceans.</p>
      <p class="note" data-at="17">The first story in this app follows the world's airline network.</p>
      <p class="credits" data-at="19">Friendship map after Paul Butler, Facebook (December 2010). Bright city lights from the airports story; fainter lights and ties illustrative.</p>`,
    blocks: `<h2 data-at="0.6">The building blocks of life</h2>
      <p data-at="1.2">In 2001 a first draft of the human genome was published. One copy of our DNA holds</p>
      <div class="facts"><div data-at="3"><b>23</b><small>chromosomes</small></div><div data-at="5.5"><b>3 billion</b><small>letters (base pairs)</small></div><div data-at="9"><b>20,000</b><small>protein-coding genes</small></div></div>
      <p data-at="16">Each of these genes is the recipe for a protein. In 2021 AlphaFold predicted the shape of nearly every human protein.</p>
      <p data-at="26">Here are 25 of them. There are about 20,000 kinds, each with its own shape and job.</p>
      <p class="credits" data-at="30">International Human Genome Sequencing Consortium, Nature (2001, 2004); Jumper et al. and Tunyasuvunakool et al., Nature (2021). Shapes in the AlphaFold style, coloured by confidence; illustrative.</p>`,
    complex: `<h2 data-at="0.6">Putting the pieces together</h2>
      <p data-at="1.2">Proteins rarely work alone. Here are 13 of the proteins that build ATP synthase, the machine that makes most of the cell's energy currency, ATP.</p>
      <div style="display:grid">
        <p data-at="9" data-out="17.5" style="grid-area:1/1">Assembled, they form a rotary motor in the inner membrane of mitochondria. Two helpers, ATPAF1 and ATPAF2, keep the alpha and beta parts from clumping until they join the head, then leave.</p>
        <p data-at="18" data-out="29.5" style="grid-area:1/1">In action: protons flowing through the membrane turn the rotor. Each turn takes 8 protons and makes 3 ATP.</p>
        <p data-at="30" style="grid-area:1/1">As a network, each protein is a node and each contact a link.</p>
      </div>
      <p data-at="38" class="amber">The whole machine is one small neighbourhood in the map of all human protein interactions: the interactome.</p>
      <p class="credits" data-at="40">The complex in action after the animation by Drew Berry and Franck Tétaz (WEHI). Structure illustrative.</p>`,
    map: `<h2 data-at="0.6">The interactome as a map</h2>
      <p data-at="1.2">Read it like the map of a city.</p>
      <ul class="steps">
        <li data-at="4"><b>Shape</b>A city's layout shapes its life; the network's shape was set by evolution.</li>
        <li data-at="14"><b>Location</b>Central proteins matter most, like the centre of town.</li>
        <li data-at="28"><b>Neighbourhoods</b>Proteins that work together sit together.</li>
        <li data-at="42"><b>Distance</b>Close in the network means related.</li>
      </ul>
      <div style="display:grid">
        <p class="note" data-at="15" data-out="27.5" style="grid-area:1/1">In yeast, proteins with many partners are about three times as likely to be essential for life as those with few.</p>
        <p class="note" data-at="29" data-out="41.5" style="grid-area:1/1">In yeast, map which genes depend on which, and the cell's jobs fall into districts.</p>
        <p class="note" data-at="47" style="grid-area:1/1">Diseases whose modules overlap, like multiple sclerosis and rheumatoid arthritis, tend to share symptoms and to occur together. Peroxisomal disorders lie far away.</p>
      </div>
      <p class="credits" data-at="52">Köberlin et al., Cell (2015); Jeong et al., Nature (2001); Costanzo et al., Science (2016); Menche et al., Science (2015). Disease modules illustrative.</p>`,
    rare: `<h2 data-at="0.6">Understand, diagnose, treat</h2>
      <p data-at="1.2">More than 6,000 rare diseases have a known genetic cause; about four in five rare diseases are genetic. Each is rare, but together they affect some 300 million people.</p>
      <p data-at="6">For every patient the same questions: which gene is broken? What does that do to the cell? How can we treat it?</p>
      <p data-at="14" class="amber">A broken gene sits in a neighbourhood of the interactome. Drugs act on neighbourhoods too: where the two overlap, a drug may help.</p>
      <p class="credits" data-at="18">Nguengang Wakap et al., European Journal of Human Genetics (2020). Disease and drug neighbourhoods illustrative.</p>`,
    iei: `<h2 data-at="0.6">Inborn errors of immunity</h2>
      <div class="facts"><div data-at="1.2"><b>430</b><small>rare diseases</small></div><div data-at="2.4"><b>1 in 1,000</b><small>to 1 in 5,000 people, all together</small></div><div data-at="3.6"><b>95%</b><small>of patients get non-specific treatment</small></div></div>
      <p data-at="6">Diagnosis is often missing or late, and the diseases are poorly understood.</p>
      <div style="display:grid">
        <p data-at="12" data-out="20" style="grid-area:1/1">On the interactome, the genes of those that mainly cause autoimmunity or autoinflammation fall into clusters. Each cluster is a shared mechanism: an endotype.</p>
        <p data-at="21" style="grid-area:1/1">The ${SANKEY_N[0]} clinical categories doctors use cut across their ${SANKEY_N[1]} molecular clusters. Endotypes define diseases by their mechanism.</p>
      </div>
      <p class="credits" data-at="34">Guthrie et al., Science Advances (2023): ${SANKEY_N[2]} genes of inborn errors with mainly autoimmunity or autoinflammation; flows between categories illustrative. Zhang et al. 2017; Picard et al. 2017; Bousfiha et al. 2018.</p>`,
    treat: `<h2 data-at="0.6">Better treatments, faster diagnoses</h2>
      <p data-at="1.2">Drugs already used for a cluster sit closer to it in the network than other drugs. That points to old drugs worth repurposing, and to new targeted ones.</p>
      <p data-at="12">Diagnosis: a patient's genome holds many rare variants. Let a signal spread through the network from genes that match the patient's symptoms, and it ranks the candidate genes.</p>
      <p data-at="24" class="amber">Here the broken gene comes out on top. In 139 patients with rare neurological disorders, informed network propagation ranked the right gene better than any single clue.</p>
      <p class="credits" data-at="28">Guthrie et al., Science Advances (2023); Buphamalai et al., Nature Communications (2021). Patient illustrative.</p>`,
    scales: `<h2 data-at="0.6">Networks across scales</h2>
      <p data-at="1.2">From a billionth of a metre to a whole body, from a millionth of a second to a lifetime, life is built from networks.</p>
      <p data-at="15">Proteins bind proteins, cells signal to cells, organs talk to organs, and diseases spread from person to person.</p>
      <p data-at="24" class="amber">Medicine reaches into all of them: diagnosis, treatment, nutrition and lifestyle.</p>
      <p class="credits" data-at="30">After Sin and Menche (2021).</p>`,
    lbi: `<h2 data-at="0.6">Network medicine at the LBI-NetMed</h2>
      <ul class="steps">
        <li data-at="2"><b>RG1</b>The geometry of molecular networks in health and disease: the mathematics of how perturbations mix and evolve over time.</li>
        <li data-at="4"><b>RG2</b>Intra- and inter-cellular networks: the human network architecture across scales.</li>
        <li data-at="6"><b>RG3</b>Disease patterns and treatment outcomes across the population, from health registry data.</li>
        <li data-at="8"><b>RG4</b>DataDiVR: the future of data exploration, with virtual reality, machine learning and AI.</li>
      </ul>
      <p data-at="15">Led by Julia Guthrie, André Rendeiro and Jörg Menche, the groups work together across every scale.</p>`,
    body: `<h2 data-at="0.6">Whole-body networks</h2>
      <p data-at="1.2">A total-body PET scan follows a tracer sugar through every organ at once. The brain takes up the most, and often the heart; the kidneys and bladder glow because the tracer leaves the body in the urine.</p>
      <p data-at="10">Organs that rise and fall together form a network of organs.</p>
      <p data-at="17" class="amber">Disease rewires it.</p>
      <p class="credits" data-at="21">Reed et al., NeuroImage (2023); Geist et al., Med (2025). Organ network illustrative.</p>`,
    tissue: `<h2 data-at="0.6">From tissue to cells</h2>
      <p data-at="1.2">A slice of stomach wall, stained pink and purple: glands at the surface, loose tissue with blood vessels, muscle below.</p>
      <p data-at="9">Zoom in and it is made of cells. Join each cell to its neighbours, and the tissue becomes a network.</p>
      <p data-at="16">Imaging dozens of proteins at once tells the cell types apart, and every sample becomes a point we can compare with the others.</p>
      <p class="credits" data-at="24">Rendeiro et al., Nature (2021); Abila et al., Nature Medicine (2026).</p>`,
    mission: `<h2 data-at="0.6">Our mission</h2>
      <p data-at="1.2">We are more than 40 researchers from many disciplines at the Ludwig Boltzmann Institute for Network Medicine. We want to</p>
      <ul class="steps">
        <li data-at="3"><b>Understand</b>gain fundamental insights into the network architecture of health and disease</li>
        <li data-at="5"><b>Help patients</b>turn these insights into concrete patient benefit</li>
        <li data-at="7"><b>Build in Vienna</b>make Vienna an international centre of excellence for network medicine</li>
        <li data-at="9"><b>Look ahead</b>invent the future of medicine</li>
      </ul>
      <p data-at="15"><button class="btn primary" id="btnGoExplore" type="button">Explore the scenes</button></p>
      <p class="credits" data-at="17">Thank you! netmed.lbg.ac.at · menchelab.com · Narration: a synthetic voice (Kokoro).</p>`,
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
  // Intro: the interactome grows, pathways light up one after another
  a = C.title.a; b = C.title.b;
  show('int', 0.2, 2.5, b - 1.5, b + 0.5);
  ramp('int_reveal', 0.5, 7, 0, 1);
  [[5, 7], [3, 10], [8, 13], [1, 16]].forEach(([m, t]) => ramp('int_path' + m, t, t + 1.5, 0, 1));
  [5, 3, 8, 1].forEach(m => ramp('int_path' + m, b - 1, b + 0.5, 1, 0));
  cam(a, 'int', 'paths', -35, null, [0, 0, 0.5]);
  cam(b - 1, 'int', 'paths', 40, 'spin');
  // Parts: the computer comes apart, its circuit is wired, a network remains
  a = C.whole.a; b = C.whole.b;
  show('mac', a - 0.5, a + 2, b - 1.5, b + 0.5);
  ramp('mac_explode', a + 7, a + 12.5, 0, 1);
  ramp('mac_wire', a + 16, a + 23, 0, 1);
  ramp('mac_net', a + 25, a + 29.5, 0, 1);
  cam(a + 1.5, 'mac', 'default', -25);
  cam(a + 7, 'mac', 'default', 5, 'spin');
  cam(a + 13, 'mac', 'table', -10);
  cam(a + 16, 'mac', 'table', -5, 'spin');
  cam(a + 22, 'mac', 'wiring', 5);
  cam(a + 25, 'mac', 'wiring', 10, 'spin');
  cam(a + 30, 'mac', 'network', 0);
  cam(b - 1, 'mac', 'network', 25, 'spin');
  // Networks are everywhere: the internet, then friendships around the world
  a = C.everywhere.a; b = C.everywhere.b;
  show('web', a - 0.5, a + 1.5, b - 1.5, b + 0.5);
  ramp('web_net', a + 0.5, a + 8, 0, 1); ramp('web_net', a + 9.5, a + 12, 1, 0);
  ramp('web_globe', a + 10, a + 12.5, 0, 1); ramp('web_ties', a + 12, a + 20, 0, 1);
  ramp('web_spin', a + 10, b + 1, 0, 0.12);
  cam(a + 1, 'web', 'net', -30);
  cam(a + 10, 'web', 'net', 30, 'spin');
  cam(a + 12.5, 'web', 'globe', -10);
  cam(b - 1, 'web', 'globe', 10, 'spin');
  // Building blocks: DNA, chromosomes, protein shapes, all the proteins
  a = C.blocks.a; b = C.blocks.b;
  show('dna', a - 0.5, a + 1.5, b - 1.5, b + 0.5);
  ramp('dna_helix', a, a + 3, 0, 1);
  ramp('dna_chrom', a + 8, a + 13, 0, 1);
  ramp('dna_fold', a + 16, a + 21, 0, 1);
  ramp('dna_field', a + 25, a + 32, 0, 1);
  cam(a + 1, 'dna', 'helix', -15);
  cam(a + 8, 'dna', 'helix', 15, 'spin');
  cam(a + 13, 'dna', 'chrom');
  cam(a + 16, 'dna', 'chrom', 8, 'spin');
  cam(a + 21, 'dna', 'fold');
  cam(a + 25, 'dna', 'fold', 10, 'spin');
  cam(a + 32, 'dna', 'field');
  cam(b - 1, 'dna', 'field', 15, 'spin');
  // Complexes: the parts of ATP synthase, assembled, running, as a network, inside the interactome
  a = C.complex.a; b = C.complex.b;
  show('atp', a - 0.5, a + 1.5, a + 39, a + 41.5);
  ramp('atp_parts', a, a + 2, 0, 1);
  ramp('atp_colour', a + 5, a + 7, 0, 1);
  ramp('atp_build', a + 9, a + 16.5, 0, 1);
  ramp('atp_flow', a + 18, a + 20, 0, 1); ramp('atp_flow', a + 29, a + 31, 1, 0);
  key('atp_turns', a + 18, 0); key('atp_turns', a + 30, 4.5);
  ramp('atp_net', a + 30, a + 33, 0, 1);
  ramp('atp_shrink', a + 36, a + 40, 0, 1);
  show('int', a + 38, a + 41);
  key('int_atp', a + 36.9, 0); key('int_atp', a + 37, 1);
  cam(a + 1, 'atp', 'parts', 0, null, [0, 0, 0.4, -0.05]);
  cam(a + 7, 'atp', 'parts', 10, 'spin', [0, 0, 0.4, -0.05]);
  cam(a + 16.5, 'atp', 'complex', -20);
  cam(a + 30, 'atp', 'complex', 40, 'spin');
  cam(a + 36, 'atp', 'complex', 60, 'spin');
  cam(a + 40, 'int', 'atp');
  cam(b, 'int', 'default', 40);
  // The interactome as a map: the network becomes a city
  a = C.map.a; b = C.map.b;
  ramp('int_atp', a, a + 2, 1, 0);
  ramp('int_flat', a + 2, a + 8, 0, 1); ramp('int_build', a + 6, a + 10.5, 0, 1);
  ramp('int_hub', a + 14, a + 16, 0, 1); ramp('int_hub', a + 26.5, a + 28.5, 1, 0);
  ramp('int_pins', a + 16, a + 18, 0, 1);
  ramp('int_hood', a + 28, a + 31, 0, 1); ramp('int_hood', a + 40.5, a + 42.5, 1, 0);
  ramp('int_route', a + 42, a + 47, 0, 1);
  ramp('int_dis', a + 46.5, a + 50, 0, 1);
  ramp('int_a', b - 1.5, b + 0.5, 1, 0);
  cam(a + 9, 'int', 'city');
  cam(a + 27, 'int', 'city', 15, 'spin');
  cam(a + 41, 'int', 'city', 30, 'spin');
  cam(b - 1.5, 'int', 'city', 50, 'spin');
  // reset the map while the interactome is hidden
  for (const n of ['int_flat', 'int_build', 'int_pins', 'int_route', 'int_dis']) ramp(n, b + 0.6, b + 1.2, 1, 0);
  // Rare diseases: one patient among many, a disease neighbourhood and a drug's
  a = C.rare.a; b = C.rare.b;
  show('crowd', a - 0.5, a + 1.5, a + 11, a + 13);
  ramp('crowd_red', a + 3, a + 5, 0, 1);
  ramp('crowd_grow', a + 5, a + 10, 0, 1);
  ramp('int_a', a + 11.5, a + 13.5, 0, 1);
  ramp('int_rare', a + 13, a + 17, 0, 1);
  cam(a + 1.5, 'crowd', 'default');
  cam(a + 5, 'crowd', 'close');
  cam(a + 11, 'crowd', 'default', 0, null, [0, 8, 1.5]);
  cam(a + 13.5, 'int', 'rare', -20);
  cam(b - 4, 'int', 'rare', -40, 'spin');
  // Inborn errors of immunity: clusters on the interactome, then clinic versus mechanism
  a = C.iei.a; b = C.iei.b;
  ramp('int_rare', a, a + 2, 1, 0);
  ramp('int_iei', a + 1, a + 5, 0, 1);
  ramp('int_a', a + 19.5, a + 21.5, 1, 0);
  show('sankey', a + 20.5, a + 22.5, b - 1.5, b + 0.5);
  ramp('sankey_left', a + 21, a + 24, 0, 1);
  ramp('sankey_right', a + 24, a + 27, 0, 1);
  ramp('sankey_flow', a + 26, a + 33, 0, 1);
  key('sankey_hi', a + 34, 0); key('sankey_hi', a + 34.01, 9); key('sankey_hi', a + 37, 9); key('sankey_hi', a + 37.01, 1);
  key('sankey_hi', b - 1.5, 1); key('sankey_hi', b - 1.49, 0);
  cam(a + 5, 'int', 'iei', -15);
  cam(a + 20, 'int', 'iei', 25, 'spin');
  // the diagram is wide: a little further back, and on wide screens shifted clear of the side panel
  cam(a + 21.5, 'sankey', 'default', -12, null, [0, 0, 1.0, GL.wide ? -0.45 : 0]);
  cam(b - 1.5, 'sankey', 'default', 12, 'spin', [0, 0, 1.0, GL.wide ? -0.45 : 0]);
  // Treatments and diagnosis: drugs dock on clusters, a signal spreads from the patient's genes
  a = C.treat.a; b = C.treat.b;
  ramp('int_a', a - 1, a + 1, 0, 1);
  ramp('int_drugs', a + 2, a + 10, 0, 1); ramp('int_drugs', a + 11, a + 13, 1, 0);
  ramp('int_iei', a + 12, a + 14, 1, 0);
  ramp('int_heat', a + 11, a + 21, 0, 1);
  ramp('int_cand', a + 20, a + 24, 0, 1);
  ramp('int_a', b - 1.5, b + 0.5, 1, 0);
  for (const n of ['int_heat', 'int_cand']) ramp(n, b + 0.6, b + 1.2, 1, 0);
  cam(a + 1, 'int', 'iei', 25);
  cam(a + 11, 'int', 'iei', 5, 'spin');
  cam(a + 14, 'int', 'heat', -15);
  cam(b - 1.5, 'int', 'heat', 20, 'spin');
  // Scales: the tower of length scales, time, networks, medicine
  a = C.scales.a; b = C.scales.b;
  show('scale', a - 0.5, a + 1.5);
  ramp('scale_len', a, a + 9, 0, 1);
  ramp('scale_time', a + 9, a + 15, 0, 1);
  ramp('scale_net', a + 15, a + 22, 0, 1);
  ramp('scale_med', a + 24, a + 29, 0, 1);
  cam(a + 1, 'scale', 'low', -20);
  cam(a + 9, 'scale', 'time', 2);
  cam(a + 15, 'scale', 'tower', 20);
  cam(b, 'scale', 'tower', 50, 'spin');
  // The institute: four research groups across the scales, and the links between them
  a = C.lbi.a; b = C.lbi.b;
  ramp('scale_time', a, a + 2, 1, 0); ramp('scale_med', a, a + 2, 1, 0); ramp('scale_net', a, a + 2, 1, 0);
  ramp('scale_rg', a + 2, a + 10, 0, 1);
  ramp('scale_syn', a + 13, a + 21, 0, 1);
  ramp('scale_a', b - 1.5, b + 0.5, 1, 0);
  for (const n of ['scale_len', 'scale_rg', 'scale_syn']) ramp(n, b + 0.6, b + 1.2, 1, 0);
  cam(a + 1, 'scale', 'tower', 60, null, [0, 0, 0.9]);
  cam(b - 1.5, 'scale', 'tower', 110, 'spin', [0, 0, 0.9]);
  // The whole body: a PET scan and the network of organs
  a = C.body.a; b = C.body.b;
  show('body', a - 0.5, a + 1.5, b - 1.5, b + 0.5);
  ramp('body_pet', a + 0.5, a + 6, 0, 1);
  ramp('body_net', a + 10, a + 13, 0, 1);
  ramp('body_state', a + 17, a + 20, 0, 1);
  cam(a + 1, 'body', 'front', -25, null, [0, 0, 0.35]);
  cam(a + 10, 'body', 'front', 25, 'spin', [0, 0, 0.35]);
  cam(a + 12, 'body', 'net', -10, null, [0, 0, 0.2]);
  cam(b - 1.5, 'body', 'net', 20, 'spin', [0, 0, 0.2]);
  // Tissue: a stained section, cells, a network of neighbours, many markers, an embedding
  a = C.tissue.a; b = C.tissue.b;
  show('tissue', a - 0.5, a + 1.5, b - 1.5, b + 0.5);
  ramp('tissue_graph', a + 11, a + 16, 0, 1);
  ramp('tissue_mark', a + 16, a + 19, 0, 1);
  ramp('tissue_embed', a + 22, a + 26.5, 0, 1);
  // the section is long: further back, and on wide screens shifted clear of the side panel
  cam(a + 1, 'tissue', 'section', -10, null, [0, 0, 0.8, GL.wide ? -0.2 : 0]);
  cam(a + 5, 'tissue', 'section', 10, 'spin', [0, 0, 0.8, GL.wide ? -0.2 : 0]);
  cam(a + 10, 'tissue', 'zoom');
  cam(a + 16, 'tissue', 'zoom', 8, 'spin');
  cam(a + 19, 'tissue', 'mark');
  cam(a + 22, 'tissue', 'mark', 10, 'spin');
  cam(a + 24.5, 'tissue', 'embed', -10);
  cam(b - 1.5, 'tissue', 'embed', 10, 'spin');
  // Mission: the team, then the interactome with every pathway alight
  a = C.mission.a; b = C.mission.b;
  ramp('scale_team', a - 0.5, a + 3, 0, 1);
  show('scale', a - 0.5, a + 1.5, a + 12, a + 14);
  show('int', a + 12.5, a + 14.5);
  for (let m = 0; m < 10; m++) ramp('int_path' + m, a + 14 + 0.6 * m, a + 15.5 + 0.6 * m, 0, 1);
  cam(a + 1, 'scale', 'team', -20);
  cam(a + 12.5, 'scale', 'team', 30, 'spin');
  cam(a + 14.5, 'int', 'paths', 0, null, [0, 0, 0.6]);
  cam(b, 'int', 'paths', 120, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  label('web', 'hub', '<b>A hub</b>of the internet', C.everywhere.a + 4, C.everywhere.a + 9.5, 'amb');
  label('int', 'atp', '<b>ATP synthase</b>in the interactome', C.complex.a + 41, C.complex.b - 0.5, 'cyn');
  const pins = I.info && I.info.pins ? I.info.pins : ['A hub', 'A protein'];
  label('int', 'pinRed', `<b>${esc(pins[0])}</b>a hub in the centre`, C.map.a + 18, C.map.a + 27, 'mag');
  label('int', 'pinBlue', `<b>${esc(pins[1])}</b>out on the edge`, C.map.a + 18.5, C.map.a + 27, 'cyn');
  label('crowd', 'red', '<b>One patient</b>', C.rare.a + 4, C.rare.a + 11, 'mag');
  label('int', 'rare', '<b>Disease gene</b>and its neighbours', C.rare.a + 16, C.rare.b - 0.5, 'mag');
  label('int', 'treat', '<b>Drug target</b>and its neighbours', C.rare.a + 17, C.rare.b - 0.5, 'grn');
  label('int', 'seed', '<b>Symptom genes</b>where the signal starts', C.treat.a + 15.5, C.treat.b - 1, 'amb');
  label('int', 'causal', '<b>Top candidate</b>the broken gene', C.treat.a + 22, C.treat.b - 1, 'mag');
  label('tissue', 'mucosa', '<b>Glands</b>', C.tissue.a + 2, C.tissue.a + 9, 'mag');
  label('tissue', 'submucosa', '<b>Loose tissue</b>with vessels', C.tissue.a + 2.6, C.tissue.a + 9, 'mag');
  label('tissue', 'muscle', '<b>Muscle</b>', C.tissue.a + 3.2, C.tissue.a + 9, 'mag');
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
