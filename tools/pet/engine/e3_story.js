
// ================================================================== STORY ==
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Until a narration is recorded, the table sets the
// pace: node tools/pace.mjs writes it from the words on the panel (each stretch
// between two cues lasts long enough to read what appeared at its start; run
// it again after the text changes). A recording replaces it with its own times.
const NARRATION_SYNC = [
  [0, 0], [1.3, 1.2], [3.1, 2.4], [5.7, 4], [11, 6.5], [11.7, 7.1], [19.4, 9],  // Intro
  [28.1, 16], [28.8, 16.6], [30.1, 17.2], [30.8, 17.8], [45.1, 20.5], [58.3, 29], [58.9, 29.6],
  [63.1, 30.5], [63.8, 31.1], [71.5, 33.5], [93, 47], [93.7, 47.6],  // Scanner
  [110.6, 52], [127.1, 67], [146.9, 77],              // Sugar
  [161.2, 90], [161.9, 90.6], [163.2, 91.2], [201, 125.6], [203, 126],  // Organs
  [207.4, 128], [209.4, 129.8], [220.2, 131], [220.8, 131.6], [225.4, 133], [226.1, 133.6],
  [245.7, 139], [251.8, 142],                         // Network
  [256.2, 146], [257.5, 147.18], [258.6, 147.2], [259.3, 147.8], [272.3, 153], [280.6, 157],
  [288.6, 162], [289.2, 162.6], [300.4, 167], [311, 174], [319.3, 181.6], [334.1, 185],
  [334.7, 185.6], [344.2, 188], [344.9, 188.6], [359.2, 194], [359.8, 194.6], [373.7, 196],
  [376, 198.1], [393.3, 200],                         // Health
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
  { key: 'title', name: 'Intro', a: 0, b: 16 },
  { key: 'scanner', name: 'Scanner', a: 16, b: 52 },
  { key: 'body', name: 'Sugar', a: 52, b: 90 },
  { key: 'organs', name: 'Organs', a: 90, b: 128 },
  { key: 'cohort', name: 'Network', a: 128, b: 146 },
  { key: 'health', name: 'Health', a: 146, b: 200 },
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
// (measured at 1280 x 760: each view's parts between the panel's right edge and the screen's, above the timeline)
const FIT = { scan: { vision: [0, 0, 3.3, -0.75] }, body: { default: [0, 0, 0.55] }, organs: { default: [0, 0, 0.55] },
  liver: { default: [0, 0, 0.15, -0.22] } };
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen (the vision row; the network)
const NARROW = { scan: { vision: 1.32 }, body: { front: 1.1 }, organs: { net: 1.3, matrix: 1.15, bars: 1.1 } };
const narrowOf = (k, name) => (NARROW[k] && NARROW[k][name]) || 1;
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

// ------------------------------------------------------------------- data --
// The paper's numbers (PET_DATA), looked up once for the story and the panels. The networks read off
// the figures may still be empty (no links yet): everything here works with any subset of organs and any number of links.
const PD = (() => {
  const D = PET_DATA, byId = {};
  D.organs.forEach((o, i) => { byId[o.id] = Object.assign({ i }, o); });
  return { D, byId, ids: D.organs.map(o => o.id), nets: Object.fromEntries((D.nets || []).map(n => [n.id, n])) };
})();
const netOf = id => PD.nets[id] || null;
const edgesOf = id => { const n = netOf(id); return n && Array.isArray(n.edges) ? n.edges : []; };
const hasNet = id => edgesOf(id).length > 0;
// a network's hubs, as the organs set draws them: only those the paper marks (its orange nodes); never ones computed
// from the links (they differ: the paper marks none in the network of all scans)
const hubsOf = id => { const n = netOf(id); return n && Array.isArray(n.hubs) ? n.hubs : []; };
const organName = id => (PD.byId[id] ? PD.byId[id].name : String(id));
const organLow = id => { const s = organName(id); return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; };
const organCol = id => (PD.byId[id] ? PD.byId[id].col : '#9aa3b5');
// the networks the organs set can show (organs_which: an index into this list), with their short names: the eleven of
// its Network control, then the robustness tests' (the vena cava as the reference, the three doses), which only the
// Networks tab's rows show
const NET_IDS = ['full', 'FDG_healthy', 'A_low', 'A_high', 'B_low', 'B_high', 'C_low', 'C_mid', 'C_high', 'HK2', 'GLUT'];
const NET_EXTRA = ['vena', 'dose_standard', 'dose_ultralow', 'dose_virtual'];
const NET_ALL = NET_IDS.concat(NET_EXTRA);
const NET_SHORT = ['All scans', `FDG, ${((netOf('FDG_healthy') || {}).organs || []).length} organs`, 'BMI low', 'BMI high', 'Tumour low', 'Tumour high', 'CRP low', 'CRP mid', 'CRP high', 'HK2', 'GLUT',
  'Vena cava', 'Standard dose', 'Ultra-low dose', 'Virtual low dose'];
const netShort = id => NET_SHORT[NET_ALL.indexOf(id)] || String(id);
// Table 2's comparisons whose groups the paper drew as networks (Figures 2A and 3): one network per group, or null.
// (Figure 4's healthy FDG network uses only the organs GTEx has too, so it belongs with the protein networks, Table 3.)
function rowNets(r) {
  if (!r) return [];
  const m = r.what === 'BMI' && /healthy/.test(r.cohort) ? ['A_low', 'A_high'] : r.what === 'Tumour load' ? ['B_low', 'B_high']
    : r.what === 'CRP' && /thirds/.test(r.cohort) ? ['C_low', 'C_mid', 'C_high'] : r.what === 'Blood pool' ? ['full', 'vena']
    : r.what === 'Dose' ? ['dose_standard', 'dose_ultralow', 'dose_virtual'] : [];
  return r.groups.map((g, i) => m[i] || null);
}
const rowOfNet = id => PD.D.table2.findIndex(r => rowNets(r).includes(id));
// the comparison a network stands for (none for the network of all scans: it is no comparison, only the reference of the
// blood-pool test)
const cmpOfNet = id => (id === 'full' ? -1 : rowOfNet(id));
// a network in a line: its group of Table 2, or what Figure 4 drew
function netTitle(id) {
  const n = netOf(id), ri = rowOfNet(id), r = PD.D.table2[ri];
  if (!n) return '';
  if (id === 'full' || id === 'vena') return `All ${fmt(PD.D.cohort.scans)} scans, every organ divided by the ${id === 'vena' ? 'vena cava' : 'aorta'} (Figure 2A, printed)`;
  if (r) { const g = r.groups[rowNets(r).indexOf(id)]; return `${r.what}, ${r.cohort.replace(/, split at the median.*$/, '')}: ${g.label} (${g.n} ${r.what === 'Dose' ? 'people' : 'scans'}; Figure ${n.fig}, read off, approximate)`; }
  if (id === 'FDG_healthy') return `FDG in the ${PD.D.cohort.healthy} scans of healthy volunteers, on the ${(n.organs || []).length} organs GTEx has too (Figure 4, read off, approximate)`;
  const t3 = PD.D.table3.find(x => PROT_NET(x) === id);
  return t3 ? `${t3.name}: from its gene's activity in the tissues of ${fmt(PD.D.cohort.gtex)} people (GTEx; Figure 4, read off, approximate)` : n.title || id;
}
// Table 3's protein networks drawn in Figure 4
const PROT_NET = r => (r.kind === 'fdg' ? 'FDG_healthy' : /HK2/.test(r.name) ? 'HK2' : /GLUT/.test(r.name) ? 'GLUT' : null);

// ------------------------------------------------------------------ facts --
// Numbers the story quotes, all from PET_DATA (a comparison or a reading not there yet leaves its sentence out)
const FACTS = (() => {
  const D = PET_DATA, c = D.cohort, p = D.protocol, full = netOf('full') || { edges: [], density: 0, disorder: 0 };
  const row = (what, re) => D.table2.find(r => r.what === what && (!re || re.test(r.cohort))) || null;
  const num = s => { const m = /(\d+(?:\.\d+)?)/.exec(s || ''); return m ? +m[1] : null; };
  const retest = row('Test-retest');
  return {
    scans: c.scans, subjects: c.subjects, healthy: c.healthy, cancer: c.cancer, lung: c.lung, hnscc: c.hnscc, gtex: c.gtex,
    fasting: p.fasting, dose: p.dose, rest: p.rest, hubZ: p.hub, p: p.p,
    organs: D.organs.length - 1, f2n: D.f2.organs.length, density: full.density, disorder: full.disorder, links: full.edges.length,
    row: { cancer: row('Cancer'), bmi: row('BMI', /healthy/), crp: row('CRP', /thirds/), tumour: row('Tumour load'), norepi: row('Norepinephrine') },
    weeks: retest ? num((/(\d+)\s*weeks/.exec(retest.cohort) || [])[1]) : null,
    robust: D.table2.filter(r => r.part === 'test'), hk2: D.table3.find(r => /HK2/.test(r.name)) || null, tested: D.table3.filter(r => r.kind !== 'fdg').length,
    year: num((/\((\d{4})\)/.exec(D.source.paper) || [])[1]),
  };
})();
const listOf = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'][n] || String(n);
const Word = n => { const w = word(n); return w.charAt(0).toUpperCase() + w.slice(1); };
const dis = v => (Number.isFinite(+v) ? (+v).toFixed(2) : '–');
// colours as text on the HTML panel, which is light in the light theme: an organ's or a group's colour mixed with the
// panel's ink (darker on a light panel, lighter on a dark one); the poster's light grey (its black, on our dark ground)
// is the ink itself. The headset's panel is dark: its canvas twin takes the colour itself (data-col).
const inkCol = c => (/^#d9dde6$/i.test(c) ? 'var(--ink)' : `color-mix(in srgb, ${c} 55%, var(--ink))`);
const swCol = c => (/^#d9dde6$/i.test(c) ? 'var(--ink)' : c);   // a swatch or a bar in the same colour
const pct = v => (Number.isFinite(+v) ? `${+v}%` : '–');

// the story's own networks, in the order it shows them (one that has no links yet is skipped: the network stays)
function buildStory() {
  const F = FACTS, R = F.row;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // jump an index param (an organ, a pair, a group) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const oi = id => (PD.byId[id] ? PD.byId[id].i + 1 : 0);   // organs_focus for an organ
  const wi = id => NET_ALL.indexOf(id);                      // organs_which for a network
  const gD = (r, i) => (r && r.groups[i] ? pct(r.groups[i].density) : '–');
  const step = (id, at, text) => `<li data-at="${at}" data-col="${organCol(id)}" style="border-left-color:${swCol(organCol(id))}"><b style="color:${inkCol(organCol(id))}">${esc(organName(id))}</b>${text}</li>`;
  // ------------------------------------------------------------ panel copy
  // parts of a chapter that take turns in one place, each fading out (data-out) as the next comes: the headset's
  // panel cannot scroll, so no chapter shows more than fits at once
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">One scan, one system</h1>
      <p class="lede" data-at="2.4">the body as a metabolic network</p>
      <p data-at="4">From PET scans to a network of organs, from health to disease.</p>
      <p data-at="6.5"><b>The aim</b>: from a scan to one network of the body, then prognosis and medication (goals, not yet shown).</p>
      <p class="note" data-at="9">After a paper in Med${F.year ? ` (${F.year})` : ''} and a poster from the Medical University of Vienna and the LBI for Network Medicine.</p>`,
    scanner: `<h2 data-at="0.6">How PET sees</h2>
      ${turns(`<p data-at="1.2" data-out="12.5">A PET scan, short for positron emission tomography, starts with a tracer: a molecule carrying a radioactive atom. The most common, and the one in this story, is FDG, a glucose look-alike carrying fluorine-18.</p>
        <p data-at="4.5" data-out="12.5">After at least ${F.fasting} hours without food, it goes into a vein. For about ${F.rest} minutes the person rests: cells take it up like glucose, and an enzyme, hexokinase, traps it inside.</p>`,
      `<p data-at="13">Then the scan. Around the tunnel sits a ring of detectors.</p>
        <ul class="steps">
          <li data-at="14.5"><b>A positron</b>fluorine-18 decays and sends one out, the electron's antimatter twin; it travels about a millimetre, drawn larger here</li>
          <li data-at="17.5"><b>Two photons, one line</b>it meets an electron and both vanish: two gamma photons of 511 keV fly off in opposite directions. Two detectors on opposite sides of the ring register both within a few billionths of a second, and the line between them passes close to where the tracer is</li>
        </ul>`)}
      <p class="credits" data-at="31">The uptake is measured as the SUV, the standardised uptake value: the tracer in a tissue divided by the dose per kilogram of body weight, so 1 would be an even spread. Protocol as in the paper: ${F.dose[0]} to ${F.dose[1]} MBq of FDG.</p>`,
    body: `<h2 data-at="0.6">Where the sugar goes</h2>
      <p data-at="6.5">The tracer arrives with the blood, and within the hour it settles where cells use sugar.</p>
      <p data-at="15">The brain takes up the most, and the heart often does too, though this varies greatly from person to person. The kidneys and the bladder glow too: FDG is filtered into the urine and mostly not taken back, so it leaves the body that way.</p>
      <p data-at="25">A tumour shows as a hot spot. This is the main application of PET scans in routine care: finding and staging cancer.</p>
      <p data-at="34" class="amber">Yet the scan holds every organ's metabolism at once.</p>`,
    organs: `<h2 data-at="0.6">Every organ, measured</h2>
      ${turns(`<p data-at="1.2" data-out="22.5">Segmentation algorithms outline up to ${F.organs} organs in each scan, in 3D, and a doctor checks them.</p>
        <p data-at="14" data-out="22.5">Each organ's uptake is divided by that of the aorta: the blood pool, the same reference in every scan.</p>`,
      `<ul class="steps">
          ${step('brain', 23, `${esc(PD.byId.brain.measure)}: it lives on sugar`)}
          ${step('liver', 27, esc(PD.byId.liver.measure))}
          ${step('muscle', 31, `${esc(PD.byId.muscle.measure)}${/gluteus/i.test(PD.byId.muscle.measure) ? ' (the buttock muscle)' : ''}`)}
        </ul>`)}
      <p data-at="35" class="amber">One scan, one row of numbers.</p>
      <p class="credits" data-at="36">The organs' values shown here are typical uptakes, for illustration.</p>`,
    cohort: `<h2 data-at="0.6">${fmt(F.scans)} scans</h2>
      ${turns(`<p data-at="1.2" data-out="4.5">A network like this needs many scans: one scan gives only one row of numbers. These networks are the paper's, each of a group of scans.</p>
        <p data-at="3" data-out="4.5">In all, ${fmt(F.scans)} scans of ${fmt(F.subjects)} people: ${F.healthy} of healthy volunteers, ${F.cancer} of people with cancer.</p>`,
      `<p data-at="5">Which organs rise and fall together across scans? Two are linked when they still do once all the others are taken into account (a partial correlation), and that is unlikely to be chance: blue where they rise together, red where one rises as the other falls.</p>
        <p data-at="11" class="amber">The network of all ${fmt(F.scans)} scans: ${F.f2n} organs, ${F.links} links${Number.isFinite(+F.density) ? `, a density of ${pct(F.density)} (more on that next)` : ''}.</p>
        <p class="credits" data-at="14">Figure 2A of the paper.</p>`)}`,
    health: `<h2 data-at="0.6">From health to disease</h2>
      ${turns(`<p data-at="1.2" data-out="15.5">Split the scans into groups, and give each group its own network.${R.cancer ? ` The healthy group's is dense: ${gD(R.cancer, 0)} of the most possible, against ${gD(R.cancer, 1)} with cancer (compared within this one set of scans).` : ''}</p>
        ${R.bmi ? `<p data-at="7" data-out="15.5">Weight, in healthy people: a density of ${gD(R.bmi, 0)} below the median BMI (body mass index: weight for height), ${gD(R.bmi, 1)} above it.</p>
        ${hubsOf('A_high').includes('brain') ? '<p data-at="11" data-out="15.5">In the heavier group, the brain is a hub: an organ with far stronger links than the rest.</p>' : ''}` : ''}`,
      `<p data-at="16" data-out="34.5">Two measures. Density: all links' strength together, as a share of the most possible. Disorder: how unevenly that strength is spread, from 0 (even) up (a few hubs).</p>
        ${R.tumour ? `<p data-at="21" data-out="34.5" class="amber">Groups with more tumour load have thinner networks: ${gD(R.tumour, 0)} against ${gD(R.tumour, 1)}, among people with cancer.${R.norepi ? ' So do groups with more stress hormone (norepinephrine), among healthy people.' : ''}</p>
        <p data-at="28" data-out="34.5">In such sparse networks, muscle and subcutaneous fat dominate${hubsOf('B_high').includes('muscle') ? '; here muscle is a hub' : ''}.</p>` : ''}`,
      `${F.robust.every(r => !r.sigD && !r.sigO) ? `<p data-at="35" data-out="47.5">And it holds: ${F.weeks ? `two scans within ${F.weeks} weeks, ` : ''}an ultra-low dose, another scanner, men and women, the aorta or the vena cava as the reference: none made a significant difference, though some groups were small (${Math.min(...F.robust.flatMap(r => r.groups.map(g => g.n)))} people).</p>` : ''}
        ${F.hk2 ? `<p data-at="39" data-out="47.5">Of ${F.tested} networks built from genes' activity in the tissues of ${fmt(F.gtex)} people, only that of hexokinase 2, an enzyme that traps FDG, resembles FDG's (r = ${F.hk2.r}).</p>` : ''}
        <p class="credits" data-at="42" data-out="47.5">Table 2 and Figures 3 and 4 of the paper; networks other than that of all scans read off its figures. A hub: an organ whose strength is more than ${F.hubZ} standard deviations above the network's average (z-score).</p>`,
      `<p data-at="48">Poster: Barbara K Geist, Alexander Grentner, Joel Fischer, Josef Yu, Dato Tsomaia, Adna Smajlovic, Stefan Grünert and Marcus Hacker: Division of Nuclear Medicine, Medical University of Vienna, and the LBI for Network Medicine.</p>
        <p data-at="50"><button class="btn primary" id="btnGoExplore" type="button">Explore the networks</button></p>
        <p class="credits" data-at="51.5">Numbers and networks: the paper, Geist et al., The metabolic organ connectome, Med${F.year ? ` (${F.year})` : ''} (of all ${fmt(F.scans)} scans printed there, the others read off its figures). Poster: Shaping a New Era in Nuclear Medicine. The intro's pictures: the vision slide. Organ values: illustrative.</p>`)}`,
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
  // (body and organs share one frame, so their waypoints turn them together)
  const cam = (t, k, name, spin, ease, nudge) => {
    const v = view(k, name);
    v[0] += spin || 0;
    if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0;
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name)]);
  };
  start({ scan_vision: 1, scan_bed: 0, scan_pass: 0, scan_cut: 0, scan_events: 0, scan_lines: 0, scan_image: 0, scan_rise: 0,
    body_pet: 0, body_net: 0, body_state: 0, body_blank: 0,
    organs_seg: 0, organs_suv: 0, organs_focus: 0, organs_lesion: 0, organs_rows: 0, organs_pair: 0, organs_partial: 0, organs_net: 0, organs_which: 0, organs_prev: 0, organs_mix: 1, organs_measures: 0 });
  let a, b;
  // Intro: the vision row (scanner, body, network, prognosis, medication), then it draws back into the scanner
  a = C.title.a; b = C.title.b;
  show('scan', 0.2, 2.5, C.body.a + 6.5, C.body.a + 7);   // (by then only its patient's image was left, and it is dark)
  ramp('scan_vision', a + 10, a + 15, 1, 0);
  cam(a, 'scan', 'vision', -8);
  cam(a + 9.5, 'scan', 'vision', 4, 'spin');
  cam(b - 0.5, 'scan', 'default', -12);
  // How PET sees: the couch slides in, the skin opens on the ring, events, lines of response, then the image
  a = C.scanner.a; b = C.scanner.b;
  ramp('scan_bed', a + 1, a + 7, 0, 1);
  ramp('scan_cut', a + 9, a + 12, 0, 1);
  ramp('scan_events', a + 12, a + 13.5, 0, 0.3); ramp('scan_events', a + 21, a + 24, 0.3, 1);
  ramp('scan_lines', a + 16, a + 27, 0, 1);
  ramp('scan_pass', a + 14, a + 32, 0, 0.6);   // the couch moves on through the ring as the counts come in
  ramp('scan_image', a + 27, a + 33, 0, 1);
  ramp('scan_events', a + 30, a + 34, 1, 0.4);
  cam(a + 1, 'scan', 'default', -4);
  cam(a + 8, 'scan', 'default', 10, 'spin');
  cam(a + 12.5, 'scan', 'ring');   // (once the skin is off: the ring view is inside the housing)
  cam(a + 20, 'scan', 'ring', 14, 'spin');
  cam(a + 24, 'scan', 'front', 0, null, [0, 4, -2.6]);
  cam(a + 28, 'scan', 'ring', 35);
  // (the image from above the couch: from inside the bore the body set's image is coarse)
  cam(a + 32, 'scan', 'ring', 2, null, [0, 6, 0.8, 0, -0.08, 0.4]);
  cam(b - 0.5, 'scan', 'ring', 14, 'spin', [0, 6, 0.8, 0, -0.08, 0.4]);
  // Where the sugar goes: the scanner goes and the patient's image stands up, exactly where (and as large as) the body
  // set stands in the view the chapter then uses, the camera easing to that view in step (so the hand-over from the scan
  // set's patient to the body set cannot be seen); its glow fades, then the tracer arrives, the hot organs, a tumour
  a = C.body.a; b = C.body.b;
  ramp('scan_rise', a, a + 1.5, 0, 0.25);          // the room goes (the camera holds)
  ramp('scan_rise', a + 1.5, a + 5, 0.25, 0.75);   // the patient stands up and turns
  ramp('scan_rise', a + 5, a + 6.5, 0.75, 1);      // its glow cools to dark
  show('body', a + 5, a + 6);   // (dark until the tracer comes: at body_pet 0 it draws nothing)
  ramp('body_pet', a + 6.5, a + 15, 0, 1);
  show('organs', a + 23, a + 25);
  ramp('organs_lesion', a + 24, a + 26, 0, 1);
  cam(a + 1.5, 'scan', 'ring', 14, null, [0, 6, 0.8, 0, -0.08, 0.4]);   // (where the scanner chapter's camera rests)
  cam(a + 5, 'body', 'front', -12, null, [0, 0, 0.55]);   // (buildCamera turns the body so the camera keeps its side)
  cam(a + 14.5, 'body', 'front', 6, 'spin', [0, 0, 0.55]);
  cam(a + 17, 'body', 'front', 10, null, [0, 0, -0.55, 0, 0.22, 0]);   // (not so close that the arms reach the top bar)
  cam(a + 23, 'body', 'front', 18, 'spin', [0, 0, -0.55, 0, 0.22, 0]);
  cam(a + 26, 'organs', 'lesion');
  cam(a + 32, 'organs', 'lesion', 10, 'spin');
  cam(b - 1, 'organs', 'default', -6);
  ramp('organs_lesion', b - 3, b, 1, 0);
  // Every organ, measured: the AI's outlines, slice by slice; each organ's uptake as a bar; three organs in turn
  a = C.organs.a; b = C.organs.b;
  ramp('body_a', a + 1, a + 4, 1, 0.55);
  ramp('organs_seg', a + 1, a + 12, 0, 1);
  ramp('organs_suv', a + 15, a + 21, 0, 1);
  // (the aorta glows, named, while the text divides every organ by it)
  jump('organs_focus', a + 14, 0, oi('aorta')); jump('organs_focus', a + 22, oi('aorta'), 0);
  [['brain', 23], ['liver', 27], ['muscle', 31]].reduce((f0, [id, t]) => { jump('organs_focus', a + t, f0, oi(id)); return oi(id); }, 0);
  jump('organs_focus', a + 35, oi('muscle'), 0);
  cam(a + 1, 'organs', 'seg');
  cam(a + 12, 'organs', 'seg', 12, 'spin');
  cam(a + 15, 'organs', 'bars');
  cam(a + 22, 'organs', 'bars', 6, 'spin');
  cam(b - 0.5, 'organs', 'bars', -6, 'spin');
  // 658 scans: the bars make way, and the network of all scans grows on the body
  a = C.cohort.a; b = C.cohort.b;
  ramp('organs_suv', a + 1, a + 3, 1, 0);
  ramp('organs_net', a + 3, a + 8, 0, 1);
  cam(a + 3, 'organs', 'net');
  cam(b - 0.5, 'organs', 'net', 18, 'spin');
  // From health to disease: BMI, density and disorder, tumour load; robust; hexokinase 2 like FDG
  a = C.health.a; b = C.health.b;
  // the networks in turn, each from the one before (a network not read off its figure yet is skipped)
  let w = wi('full'), nets = 0;
  // (a direct crossfade over 2 s from the network before, organs_prev, to the new one: easing organs_which would pass
  // through the networks between them in the list)
  const goNet = (id, t) => {
    if (!hasNet(id)) return;
    const n = wi(id);
    key('organs_prev', t - 0.01, w); key('organs_prev', t + 2.05, w);
    jump('organs_which', t, w, n);
    jump('organs_mix', t, 1, 0); key('organs_mix', t + 2, 1);
    w = n;
    sfxCue(t, 'grow', 'organs', 'net', { dur: 1.8, gain: 0.35, pitch: nets++ % 2 ? 1.15 : 0.85 });   // (sound effects: each network from the one before)
  };
  goNet('A_low', a + 7); goNet('A_high', a + 10);
  // (each network's density and disorder as a tag under its title while the text explains them)
  ramp('organs_measures', a + 16, a + 19, 0, 1);
  ramp('organs_measures', a + 35, a + 37, 1, 0);   // (robustness and hexokinase 2: the network alone)
  goNet('B_low', a + 21); goNet('B_high', a + 27);   // (tumour load; not the CRP thirds: they mix healthy people and patients)
  goNet('FDG_healthy', a + 36); goNet('HK2', a + 41.5);
  cam(a + 1, 'organs', 'net', 18);
  cam(a + 14, 'organs', 'net', 34, 'spin');
  cam(a + 17, 'organs', 'net', -14);   // (from the front while the measures are explained)
  cam(a + 34, 'organs', 'net', -4, 'spin');
  cam(a + 37, 'organs', 'net', 20);
  cam(b - 0.5, 'organs', 'net', 34, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);

  // ------------------------------------------------------------ sound effects
  // (sfxCue: story time, a sound, where it comes from: a set and one of its anchors; its options. sfxHold: a continuous
  // sound while the clock is inside a span. The health chapter's networks are cued in goNet, above)
  sfxCue(C.title.a + 0.3, 'rise', 'scan', 'vision_scan');                                 // the vision row
  sfxCue(C.title.a + 10, 'whoosh', 'scan', 'centre', { dur: 5, pitch: 0.8 });             // it draws back into the scanner
  a = C.scanner.a;
  sfxCue(a + 1, 'whoosh', 'scan', 'couch', { dur: 6, pitch: 0.6, gain: 0.4 });            // the couch slides in
  sfxCue(a + 9, 'whoosh', 'scan', 'ring', { dur: 2, pitch: 1.3 });                        // the skin opens on the ring
  sfxCue(a + 12, 'patter', 'scan', 'event', { dur: 1.5, pitch: 1.4, gain: 0.3 });         // the first coincidences
  sfxCue(a + 16, 'grow', 'scan', 'lor', { dur: 11, pitch: 1.3, gain: 0.3 });              // lines of response
  sfxCue(a + 27, 'rise', 'scan', 'patient', { dur: 5 });                                  // the image forms
  a = C.body.a;
  sfxCue(a + 1.5, 'whoosh', 'body', null, { dur: 3.5, pitch: 0.8 });                      // the patient stands up and turns
  sfxCue(a + 6.5, 'grow', 'body', null, { dur: 8, pitch: 0.9 });                          // the tracer arrives: hot organs
  sfxCue(a + 24, 'pulse', 'organs', 'lesion', { pitch: 0.8 });                            // a tumour
  a = C.organs.a;
  sfxCue(a + 1, 'ratchet', 'organs', null, { n: 20, dur: 10, pitch: 1.5, gain: 0.22 });   // outlined slice by slice
  sfxCue(a + 15, 'rise', 'organs', 'bars', { dur: 6 });                                   // each organ's uptake as a bar
  ['brain', 'liver', 'muscle'].forEach((id, k) => sfxCue(a + 23 + 4 * k, 'pick', 'organs', id, { seq: true }));   // three organs in turn
  sfxCue(C.cohort.a + 3, 'grow', 'organs', 'net', { dur: 5 });                            // the network of all scans grows on the body
  buildCamera(wp);
  // the scan set's patient stands up where the body set stands: no move, the same size, and the body set's turn (taken
  // from the camera's hand-over above) less its own
  const rt = GL.sets.scan.riseTo;
  if (rt) rt.yaw = (setYaw('body', C.body.a + 5) - setYaw('scan', C.body.a + 5)) * D2R;

  // --------------------------------------------------------- story labels
  // (the sets label their own parts, the hubs among them; the story adds what the scene alone does not say; the body
  // set labels its organs only with its own network, so its anchors are passed as points)
  const at = (k, n) => () => anchorOf(k, n);
  a = C.body.a;
  label('body', at('body', 'brain'), '<b>Brain</b>', a + 16, a + 23, 'amb');
  label('body', at('body', 'heart'), '<b>Heart</b>', a + 17, a + 23, 'amb');
  label('body', at('body', 'kidneys'), '<b>Kidneys</b>', a + 18.5, a + 23, 'amb');
  label('body', at('body', 'bladder'), '<b>Bladder</b>', a + 19.5, a + 23, 'amb');
  // (the health chapter opens on the network of all scans: the paper drew none for healthy against cancer, so the two
  // densities the text quotes stand by its title)
  if (R.cancer) label('organs', at('organs', 'title'), `<b>Healthy ${gD(R.cancer, 0)} · cancer ${gD(R.cancer, 1)}</b>density; no network drawn for them`, C.health.a + 1.5, C.health.a + 7, 'amb');
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
// (body and organs share the organs' turn: one frame)
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
function storyCam(t) {
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
    const [b, r] = L.text;
    LBL.sets.push({ kind: 'set', el: labelEl(`<b>${esc(b)}</b>${sfxSpan(r)}`, L.cls), set: k, at: L.at, alpha: L.alpha, minor: !!L.minor, o: -1 });
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
