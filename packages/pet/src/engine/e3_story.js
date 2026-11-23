//#use head
// ================================================================== STORY ==
// Narration timing: [time in the recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands on
// the matching sentence. The story is narrated by a synthetic voice
// (packages/pet/audio/narration.mp3, Kokoro's af_heart): node tools/voice/narrate.mjs
// pet writes this table and NARRATION_ENDS from the recording it makes (each
// stretch lasts the longer of 1.1 times its story time and its line's audio
// plus a pause); run it again after the text changes (see
// tools/voice/README.md).
const NARRATION_SYNC = [
  [0, 0], [1.98, 1.8], [4.13, 2.4], [7, 4], [11.41, 6.5], [12.07, 7.1], [20.12, 9], [31.02, 15.3],  // Intro
  [31.79, 16], [33.09, 17.18], [34.8, 17.2], [35.46, 17.8], [50.17, 20.5], [62.29, 29],
  [62.95, 29.6], [66.87, 30.5], [67.53, 31.1], [77.19, 33.5], [99.11, 51.3],  // Scanner
  [99.88, 52], [116.38, 67], [131.58, 77], [141.48, 86], [145.23, 89.3],  // Sugar
  [146, 90], [147.3, 91.18], [149.31, 91.2],          // Organs
  [189.79, 128], [191.08, 129.18], [193.52, 129.2], [194.18, 129.8], [203.49, 131], [204.15, 131.6],
  [214.08, 133], [214.74, 133.6], [232.35, 139], [241.46, 145.3],  // Network
  [242.23, 146], [243.53, 147.18], [245.49, 147.2], [246.15, 147.8], [259.77, 153], [260.43, 153.6],
  [272.43, 157], [278.23, 162], [278.89, 162.6], [292.1, 167], [305.98, 174], [313.8, 181],
  [314.46, 181.6], [329.85, 185], [345.44, 194], [346.1, 194.6], [363.14, 199.3], [363.91, 200],  // Health
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { title: 30.8, scanner: 98.9, body: 145, organs: 188.7, cohort: 241.25, health: 362.9 };
//#use storyT narrT T_END
const CH = [
  { key: 'title', name: 'Intro', a: 0, b: 16 },
  { key: 'scanner', name: 'Scanner', a: 16, b: 52 },
  { key: 'body', name: 'Sugar', a: 52, b: 90 },
  { key: 'organs', name: 'Organs', a: 90, b: 128 },
  { key: 'cohort', name: 'Network', a: 128, b: 146 },
  { key: 'health', name: 'Health', a: 146, b: 200 },
];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
// the engine's own params beside the sets' (DEF): none here; none keyed at an even pace or on a log scale (evalTrack)
const DEF_MORE = {}, LIN = new Set(), LOG = new Set();
//#use C DEF buildDefaults TR key ramp evalTrack storyState fadeVal ST view fitShift
// views whose parts reach under the side panel or off the right edge on a landscape screen: a little further back,
// or their target moved, so they fit beside the panel (added to the set's own view, in story and explore mode alike)
// (measured at 1280 x 760: each view's parts between the panel's right edge and the screen's, above the timeline)
const FIT = { scan: { vision: [0, 0, 3.3, -0.75] }, body: { default: [0, 0, 0.55] }, organs: { default: [0, 0, 0.55] },
  liver: { default: [0, 0, 0.15, -0.22] } };
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen (the vision row; the network)
const NARROW = { scan: { vision: 1.32 }, body: { front: 1.1 }, organs: { net: 1.3, matrix: 1.15, bars: 1.1 } };
//#use narrowOf anchorOf
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
//#use listOf
const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'][n] || String(n);
const Word = n => { const w = word(n); return w.charAt(0).toUpperCase() + w.slice(1); };
const dis = v => (Number.isFinite(+v) ? (+v).toFixed(2) : '–');
// colours as text on the HTML panel, which is light in the light theme: an organ's or a group's colour mixed with the
// panel's ink (darker on a light panel, lighter on a dark one); the poster's light grey (its black, on our dark ground)
// is the ink itself. The headset's panel is dark: its canvas twin takes the colour itself (data-col).
const inkCol = c => (/^#d9dde6$/i.test(c) ? 'var(--ink)' : `color-mix(in srgb, ${c} 55%, var(--ink))`);
const swCol = c => (/^#d9dde6$/i.test(c) ? 'var(--ink)' : c);   // a swatch or a bar in the same colour
//#use pct~2

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
      <p class="lede" data-at="2.4">The body as a metabolic network</p>
      <p data-at="4">From PET scans to a network of organs, from health to disease.</p>
      <p data-at="6.5"><b>The aim</b> is to go from a scan to one network of the body, then to prognosis and medication. These are goals, not yet shown.</p>
      <p class="note" data-at="9">This story is based on a paper in the journal Med${F.year ? `, published in ${F.year},` : ''} and a poster from the Medical University of Vienna and the LBI for Network Medicine.</p>`,
    scanner: `<h2 data-at="0.6">How PET sees</h2>
      ${turns(`<p data-at="1.2" data-out="12.5">A PET scan, short for positron emission tomography, starts with a tracer: a molecule carrying a radioactive atom. The most common, and the one in this story, is FDG, a glucose look-alike carrying fluorine-18.</p>
        <p data-at="4.5" data-out="12.5">After at least ${F.fasting} hours without food, it goes into a vein. For about ${F.rest} minutes the person rests, while cells take it up like glucose and an enzyme, hexokinase, traps it inside.</p>`,
      `<p data-at="13">Then comes the scan. Around the tunnel sits a ring of detectors.</p>
        <ul class="steps">
          <li data-at="14.5"><b>A positron</b>fluorine-18 decays and sends one out, the electron's antimatter twin; it travels about a millimetre, though here it is drawn larger</li>
          <li data-at="17.5"><b>Two photons, one line</b>the positron meets an electron, and both vanish into two gamma photons of 511 keV that fly off in opposite directions. Two detectors on opposite sides of the ring register both within a few billionths of a second, and the line between them passes close to where the tracer sits</li>
        </ul>`)}
      <p class="credits" data-at="31">The uptake is measured as the SUV, the standardised uptake value: the tracer in a tissue divided by the dose per kilogram of body weight, so 1 would be an even spread. Protocol as in the paper: ${F.dose[0]} to ${F.dose[1]} MBq of FDG.</p>`,
    body: `<h2 data-at="0.6">Where the sugar goes</h2>
      <p data-at="6.5">The tracer arrives with the blood, and within the hour it settles where cells use sugar.</p>
      <p data-at="15">The brain takes up the most, and the heart often does too, though this varies greatly from person to person. The kidneys and the bladder glow too: FDG is filtered into the urine and mostly not taken back, so it leaves the body that way.</p>
      <p data-at="25">A tumour shows as a hot spot. This is the main application of PET scans in routine care: finding and staging cancer.</p>
      <p data-at="34" class="amber">Yet the scan holds every organ's metabolism at once.</p>`,
    organs: `<h2 data-at="0.6">Every organ, measured</h2>
      ${turns(`<p data-at="1.2" data-out="22.5">Segmentation algorithms outline up to ${F.organs} organs in each scan, in 3D, and a doctor checks them.</p>
        <p data-at="14" data-out="22.5">Each organ's uptake is divided by that of the aorta, the blood pool, so the reference is the same in every scan.</p>`,
      `<ul class="steps">
          ${step('brain', 23, `${esc(PD.byId.brain.measure)}; it lives on sugar`)}
          ${step('liver', 27, esc(PD.byId.liver.measure))}
          ${step('muscle', 31, `${esc(PD.byId.muscle.measure)}${/gluteus/i.test(PD.byId.muscle.measure) ? ', the buttock muscle' : ''}`)}
        </ul>`)}
      <p data-at="35" class="amber">One scan, one row of numbers.</p>
      <p class="credits" data-at="36">The organs' values shown here are typical uptakes, for illustration.</p>`,
    cohort: `<h2 data-at="0.6">${fmt(F.scans)} scans</h2>
      ${turns(`<p data-at="1.2" data-out="4.5">A network like this needs many scans: one scan gives only one row of numbers. These networks are the paper's, each one built from a group of scans.</p>
        <p data-at="3" data-out="4.5">In all, ${fmt(F.scans)} scans of ${fmt(F.subjects)} people: ${F.healthy} of healthy volunteers and ${F.cancer} of people with cancer.</p>`,
      `<p data-at="5">Which organs rise and fall together across scans? Two are linked when they still do once all the others are taken into account, which is called a partial correlation, and when that is unlikely to be chance. A link is blue where they rise together, and red where one rises as the other falls.</p>
        <p data-at="11" class="amber">The network of all ${fmt(F.scans)} scans has ${F.f2n} organs and ${F.links} links${Number.isFinite(+F.density) ? `, with a density of ${pct(F.density)}. More on that next` : ''}.</p>
        <p class="credits" data-at="14">Figure 2A of the paper.</p>`)}`,
    health: `<h2 data-at="0.6">From health to disease</h2>
      ${turns(`<p data-at="1.2" data-out="15.5">Split the scans into groups, and give each group its own network.${R.cancer ? ` Compared within this one set of scans, the healthy group's network is dense, at ${gD(R.cancer, 0)} of the most possible, against ${gD(R.cancer, 1)} for people with cancer.` : ''}</p>
        ${R.bmi ? `<p data-at="7" data-out="15.5">Among healthy people, split at the median body mass index, or BMI, which is weight for height, the lighter group's network has a density of ${gD(R.bmi, 0)}, and the heavier group's ${gD(R.bmi, 1)}.</p>
        ${hubsOf('A_high').includes('brain') ? '<p data-at="11" data-out="15.5">In the heavier group, the brain is a hub: an organ with far stronger links than the rest.</p>' : ''}` : ''}`,
      `<p data-at="16" data-out="34.5">There are two measures. Density is the strength of all links together, as a share of the most possible. Disorder is how unevenly that strength is spread, from 0 when it is even, and higher when it gathers in a few hubs.</p>
        ${R.tumour ? `<p data-at="21" data-out="34.5" class="amber">Among people with cancer, groups with more tumour load have thinner networks: ${gD(R.tumour, 0)} with less load, against ${gD(R.tumour, 1)} with more.${R.norepi ? ' So do groups with more of the stress hormone norepinephrine, among healthy people.' : ''}</p>
        <p data-at="28" data-out="34.5">In such sparse networks, muscle and subcutaneous fat, the fat under the skin, dominate${hubsOf('B_high').includes('muscle') ? '; here muscle is a hub' : ''}.</p>` : ''}`,
      `${F.robust.every(r => !r.sigD && !r.sigO) ? `<p data-at="35" data-out="47.5">And it holds across ${F.weeks ? `two scans within ${F.weeks} weeks, ` : ''}an ultra-low dose, another scanner, men and women, and the aorta or the vena cava as the reference: none of these made a significant difference, though some groups were small, with as few as ${Math.min(...F.robust.flatMap(r => r.groups.map(g => g.n)))} people.</p>` : ''}
        ${F.hk2 ? `<p data-at="39" data-out="47.5">Of ${F.tested} networks built from genes' activity in the tissues of ${fmt(F.gtex)} people, only that of hexokinase 2, an enzyme that traps FDG, resembles FDG's network, with a correlation of ${F.hk2.r}.</p>` : ''}
        <p class="credits" data-at="42" data-out="47.5">Table 2 and Figures 3 and 4 of the paper; networks other than that of all scans read off its figures. A hub: an organ whose strength is more than ${F.hubZ} standard deviations above the network's average (z-score).</p>`,
      `<p data-at="48">The poster is by Barbara K Geist, Alexander Grentner, Joel Fischer, Josef Yu, Dato Tsomaia, Adna Smajlovic, Stefan Grünert and Marcus Hacker, of the Division of Nuclear Medicine at the Medical University of Vienna and the LBI for Network Medicine.</p>
        <p data-at="50"><button class="btn primary" id="btnGoExplore" type="button">Explore the networks</button></p>
        <p class="credits" data-at="51.5">Numbers and networks: the paper, Geist et al., The metabolic organ connectome, Med${F.year ? ` (${F.year})` : ''} (of all ${fmt(F.scans)} scans printed there, the others read off its figures). Poster: Shaping a New Era in Nuclear Medicine. The intro's pictures: the vision slide. Organ values: illustrative. Narration: a synthetic voice (Kokoro).</p>`)}`,
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
  // (explore shows the sets unturned, so there it is none: updateSets)
  ST.riseYaw = (setYaw('body', C.body.a + 5) - setYaw('scan', C.body.a + 5)) * D2R;

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
// no set turns into another at a hand-over (buildCamera's MORPH)
const MORPH = {};
//#use buildCamera setYaw
//#use smoothSeg spinEase storyCam LBL labelEl label sfxSpan buildSetLabels setLabelAlpha _v labelPos _placed
//#use placeLabels curCh updateStoryDOM trackHTML buildTimeline ICON_PLAY ICON_PAUSE lastTick updateTimeline