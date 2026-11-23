//#use head
// ================================================================== STORY ==
// Narration timing: [time in the recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands on
// the matching sentence. The story is narrated by a synthetic voice
// (packages/cdk5/audio/narration.mp3, Kokoro's af_heart): node tools/voice/narrate.mjs
// cdk5 writes this table and NARRATION_ENDS from the recording it makes (each
// stretch lasts the longer of 1.1 times its story time and its line's audio
// plus a pause); run it again after the text changes (see
// tools/voice/README.md).
const NARRATION_SYNC = [
  [0, 0], [1.32, 1.2], [3.88, 2.4], [7.88, 5], [13.38, 10], [23.12, 17], [35.88, 28.6],
  [39.41, 29.5],                                      // Sixteen thousand proteins
  [61.41, 49.5], [62.71, 50.68], [64.97, 50.7], [96.65, 79.5], [103.96, 85.5], [106.31, 87],  // A kinase among its cousins
  [129.41, 108], [130.71, 109.18], [132.87, 109.2],   // Two partners switch it on
  [190.95, 162], [192.24, 163.18], [194.04, 163.2],   // Healthy signalling
  [257.07, 220.5], [258.37, 221.68], [260.26, 221.7],  // A cut that sticks
  [318.34, 274.5], [319.64, 275.68], [321.8, 275.7],  // Stuck on in Alzheimer's
  [384.83, 333], [386.13, 334.18], [388.32, 334.2],   // A landscape of diseases
  [456.3, 396], [457.6, 397.18], [459.46, 397.2], [507.64, 441],  // Too little, too much
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { title: 50.25, kinase: 111.5, activators: 161.25, signal: 226.2, calpain: 292, alzheimer: 366.5, landscape: 450.2, learn: 486.55 };
//#use storyT narrT T_END
// (the chapters and every key, cue and line are authored in seconds as below and run at K_T of them: the story's own
// clock, so the narration, paced at least 1.1 times story time, comes to about 8 minutes)
const K_T = 0.9;
const CH0 = [
  { key: 'title', name: 'Sixteen thousand proteins', a: 0, b: 55 },
  { key: 'kinase', name: 'A kinase among its cousins', a: 55, b: 120 },
  { key: 'activators', name: 'Two partners switch it on', a: 120, b: 180 },
  { key: 'signal', name: 'Healthy signalling', a: 180, b: 245 },
  { key: 'calpain', name: 'A cut that sticks', a: 245, b: 305 },
  { key: 'alzheimer', name: 'Stuck on in Alzheimer\'s', a: 305, b: 370 },
  { key: 'landscape', name: 'A landscape of diseases', a: 370, b: 440 },
  { key: 'learn', name: 'Too little, too much', a: 440, b: 490 },
];
const CH = CH0.map(c => Object.assign({}, c, { a: c.a * K_T, b: c.b * K_T }));
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
//#use C
const C0 = Object.fromEntries(CH0.map(c => [c.key, c]));   // (authored times: buildStory's keys scale them)
//#use DEF
// the engine's own params beside the sets' (DEF): none; params eased on a log scale in the story and in explore (a set
// lists its own as log): none of the engine's; none run at an even pace
const DEF_MORE = {};
const LOG = new Set([]), LIN = new Set();
//#use buildDefaults TR
const key = (n, t, v) => { (TR[n] = TR[n] || []).push([t * K_T, v]); };   // (t authored: see K_T)
//#use ramp
// a value eased on a log scale: between log(v0) and log(v1)
const logMix = (v0, v1, x) => (v0 > 0 && v1 > 0 ? Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * x) : v0 + (v1 - v0) * x);
//#use evalTrack storyState fadeVal ST view fitShift
// views whose parts reach under the side panel or off the right edge on a landscape screen: a little further back, or
// their target moved (added to the set's own view, in story and explore mode alike). The close-ups of the centre stand
// a little further back (measured at 1280 x 760: p35 at the centre's left edge came under the panel)
const FIT = { net: { centre: [0, 0, 0.3, 0, 0, 0] }, core: { default: [0, 0, 0.3, 0, 0, 0], low: [0, 0, 0.3, 0, 0, 0] } };
// how much further back a view stands on a phone held upright (see narrowK): the whole map and the whole landscape
const NARROW = { net: { default: 1.15, side: 1.15, land: 1.2 } };
//#use narrowOf
// on a screen held sideways but too narrow for the side panel (the panel below, the scene in a strip above it, see
// lowK): [distance factor, the target's shift up]
const LOW = {};
//#use LOW1 lowOf anchorOf

// ------------------------------------------------------------------- data --
// Every number the story shows is the authors' (CDK5_DATA: their interactome, layouts and links) or the generator's
// documented counts (its over-representation tests), looked up through CDATA. Nothing scientific is computed here.
const CD = CDATA;
//#use pct word cap
const num = (v, d) => (v === null || v === undefined || !Number.isFinite(+v) ? '–' : (+v).toFixed(d));
const pTxt = p => (p === null || p === undefined || !Number.isFinite(+p) ? '' : p < 0.001 ? 'p < 0.001' : `p = ${(+p).toFixed(p < 0.01 ? 3 : 2)}`);
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const listAnd = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
// a protein's place on the map of processes, and the direction (degrees about the vertical) it is seen from
const sphereAt = i => { const L = CD.layout('bioproc'); return [L[3 * i], L[3 * i + 1], L[3 * i + 2]]; };
const azOf = p => Math.atan2(p[0], p[2]) / D2R;

// ------------------------------------------------------------------ facts --
// Numbers the story quotes, all from CDK5_DATA (SPEC.md, "The data")
const FACTS = (() => {
  const F = CD.facts, Dz = CD.diseases, T = n => CD.terms.find(t => t.name === n) || null;
  // a term CDK5's partners lean towards: only among the generator's most over-represented (partnerTop) with q under 0.05
  const top = n => Dz.partnerTop.find(t => t.name === n && t.q < 0.05) || null;
  // CDK5's cousins on the sphere: the CDKs that crowd round it (a few degrees; the next is far off), CDK1 elsewhere
  const fam = F.family.filter(f => f.i !== CD.cdk5).sort((a, b) => a.deg - b.deg), near = fam.filter(f => f.deg < 10);
  const T0 = { near: 0, n: 0 };
  return {
    proteins: F.proteins, links: F.links, withProcess: F.withProcess, without: F.proteins - F.withProcess, withDisease: F.withDisease,
    mapLinks: F.sceneLinks.bioproc, landLinks: F.sceneLinks.disease, ntrk2Links: F.sceneLinks.ntrk2, alzLinks: F.sceneLinks.alzheimer,
    deg: F.cdk5.deg, rank: F.cdk5.rank, hub: F.hub.sym, hubDeg: F.hub.deg,
    famNear: near.map(f => f.sym).sort((a, b) => parseInt(a.slice(3), 10) - parseInt(b.slice(3), 10)), famMax: Math.max(...near.map(f => f.deg)),
    cdk1: (fam.find(f => f.sym === 'CDK1') || { deg: 0 }).deg,
    p35: F.activators.p35, p39: F.activators.p39, ntrk2: F.pathways.ntrk2, alz: F.pathways.alzheimer,
    cdk5Terms: F.cdk5.terms, partnersDz: F.cdk5.partnersWithDisease, park: top('Parkinson\'s disease'), psych: top('psychotic disorder'),
    nearN: Dz.near.length, liss: T('lissencephaly') || T0, pch: T('pontocerebellar hypoplasia') || T0,
    // the map of processes' first knots, named from a current GO release (CDATA.clouds, CDATA.go; none without them)
    knots: (CD.clouds || []).slice(0, 3).map(c => c.name), goRel: CD.go && CD.go.release ? String(CD.go.release).replace(/^releases\//, '') : '',
    famMaxR: Math.ceil(Math.max(...near.map(f => f.deg))),   // (the net's tag rounds it up too)
    cancers: Dz.partnerTop.filter(t => t.q < 0.05 && /cancer|carcinoma|neoplasm/i.test(t.name)).length, topN: Dz.partnerTop.length, termsN: CD.terms.length,
  };
})();
// where the knots' names come from, wherever the knots show (chapter 1's small print, the credits, explore's scene)
const KNOT_NOTE = `The knots are named from today's Gene Ontology${FACTS.goRel ? ` (release ${FACTS.goRel})` : ''}, not the authors' own annotation; most of the map's big clouds mix many processes.`;
// the authors' own names of their six scenes (the CDK5_analytics project's folders), in the story's order
const AUTHOR_SC = ['00-BIOPROC', '01-CDK5-subunits', '02-CDK5active-Signalling_by_NTRK2', '03-CDK5p35-CALPAIN', '04-CDK5-hyperactive-alzheimers', '05-CDK5-hyperactive_diseaseInference'];
// the credits: the last chapter's small print and explore's About pane (page and headset)
const OURS = 'Ours: the close-ups at the map\'s centre (their balls, tubes and names, a clearer drawing of the centre\'s proteins at the authors\' places, scaled up), the tags with numbers and the over-representation counts.';
const ABOUT = `After ${CD.about}. The authors': the interactome of ${fmt(FACTS.proteins)} proteins and ${fmt(FACTS.links)} links, every layout, colour and link of the six scenes, the pathways' members (Reactome) and the proteins' Disease Ontology associations. ${OURS} The layouts place proteins with similar processes or diseases close only roughly (UMAP): distances on them are not measurements.`;
//#use inkCol swCol
// the story's colours (SPEC.md, "Look", CLOOK)
const CYAN = '#46d9ff', AMBER = '#ffb43b', RED = '#ff7a6b', GREEN = '#3ee08f', GREY = '#8e98ab';
const CC = CLOOK.C;

function buildStory() {
  const F = FACTS;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  const hide = (k, t0, t1) => ramp(k + '_a', t0, t1, 1, 0);
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const step = (at, out, col, b, text) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  // a big number in a colour of its own (the headset's canvas reads data-col)
  const big = (col, v) => `<b data-col="${col}" style="color:${inkCol(col)}">${v}</b>`;
  // (out: where a part that takes turns with the next fades out)
  const fact = (at, col, v, small, out) => `<div data-at="${at}"${out ? ` data-out="${out}"` : ''}>${big(col, v)}<small>${small}</small></div>`;
  // ------------------------------------------------------------ panel copy
  // parts of a chapter that take turns in one place, each fading out (data-out) as the next comes: the headset's
  // panel cannot scroll, so no chapter shows more than fits at once
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const n1 = v => (Math.round(v * 10) / 10).toFixed(1), deg = v => `${Math.round(v)}°`;
  const ACT = CC.activator, ALZ = CC.alz, HYP = CC.hyper;
  // small print the narration leaves out (data-say ""; it stays on the panels and in a headset)
  const note = (at, text, out) => `<p class="note" data-say="" data-at="${at}"${out ? ` data-out="${out}"` : ''}>${text}</p>`;
  const quiet = (at, col, v, small, out) => fact(at, col, v, small, out).replace('<div data-at', '<div data-say="" data-at');
  // the knots' short names (the net's tags), and where their names come from (shown wherever the knots are)
  const knots = F.knots.map(n => (api('net').knotName ? api('net').knotName(n) : n).toLowerCase());
  // the partners' terms that pass (FACTS: q under 0.05 among the most over-represented), named in the text only then
  const lean = [[F.park, 'Parkinson\'s disease', 'Parkinson\'s'], [F.psych, 'psychotic disorders', 'psychotic disorders']].filter(x => x[0]);
  const qTxt = t => (t.q < 0.001 ? 'q < 0.001' : `q = ${t.q.toFixed(3)}`);
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">The switch that sticks</h1>
      <p class="lede" data-at="2.4">CDK5, its network and brain diseases</p>
      ${turns(`<p data-at="5" data-out="27.5">A human cell runs on thousands of proteins.</p>
        <p data-at="10" data-out="27.5">Here are ${fmt(F.proteins)} of them. Proteins with similar jobs sit close together, and lines join those known to bind.</p>
        ${knots.length ? `<p data-at="17" data-out="27.5" class="amber">Where proteins share a job, they gather in knots: ${esc(listAnd(knots))}.</p>` : ''}`,
      `<div class="facts">${fact(28, GREEN, fmt(F.withProcess), 'with a known job, on the inner sphere')}${fact(29.5, GREY, fmt(F.without), 'with none known, on the outer shell')}</div>
        <p data-at="37" class="green">Somewhere among them is CDK5.</p>
        ${note(42, `This is the map of processes: each protein placed on a sphere by the Gene Ontology biological processes it takes part in, with the lab's cartoGRAPHs. The interactome joins proteins that bind with ${fmt(F.links)} links; the map shows only the ${fmt(F.mapLinks)} between near neighbours. Colours follow how many partners a protein has, from dark green to pale yellow for the most linked. ${KNOT_NOTE}`)}
        <p class="credits" data-at="45">After the Menche lab's CDK5_data repository by Christiane Hütter, and its CDK5_analytics VR scenes.</p>`)}`,
    kinase: `<h2 data-at="0.6">A kinase among its cousins</h2>
      ${turns(`<p data-at="1.2" data-out="29.5">CDK5 is a kinase: it switches other proteins on or off by adding phosphate to them.</p>
        <p data-at="9" data-out="29.5" class="green">On the map it sits among its cousins, kinases that drive cell division or switch genes on.</p>
        ${note(15, `CDK stands for cyclin-dependent kinase. CDK2, 4 and 6 drive cell division; CDK7, 8 and 9 mainly control how genes are read. ${listAnd(F.famNear)} sit within ${F.famMaxR} degrees of CDK5 on the sphere; CDK1 is ${Math.round(F.cdk1)} degrees away.`, 29.5)}`,
      `<p data-at="30">But CDK5 works in neurons, which no longer divide, and its partners are spread across the map.</p>
        <div class="facts">${fact(36, GREEN, fmt(F.deg), 'partners')}${fact(37.5, CYAN, ordinal(F.rank), `of ${fmt(F.proteins)} by partners`)}${quiet(46, AMBER, fmt(F.hubDeg), `for ${esc(F.hub)}, the most`)}</div>
        ${note(49, 'Partners are the proteins it is known to bind, its protein-protein interactions. Many proteins have only a few; the best studied have the most.')}`)}`,
    activators: `<h2 data-at="0.6">Two partners switch it on</h2>
      ${turns(`<p data-at="1.2" data-out="24.5">Its cousins are switched on by cyclins. CDK5 is not.</p>
        <p data-at="8" data-out="24.5" class="green">Two proteins found in neurons, p35 and p39, switch it on. On the map they live far apart.</p>
        <div class="facts">${quiet(14, ACT, deg(F.p35), 'from CDK5 to p35 on the sphere', 24.5)}${quiet(15.5, ACT, deg(F.p39), 'to p39, nearly opposite', 24.5)}</div>`,
      `<p data-at="25">Here they come together at the centre.</p>
        ${note(35, 'p35 is the protein CDK5R1 and p39 is CDK5R2. This is the authors\' scene of CDK5 and its regulatory subunits, with its two links bright green. The balls, tubes and names at the centre are our clearer drawing of the centre\'s proteins, at the authors\' places, scaled up.')}`)}`,
    signal: `<h2 data-at="0.6">Healthy signalling</h2>
      ${turns(`<p data-at="1.2" data-out="27.5">In a healthy neuron, the growth factor BDNF docks on its receptor, NTRK2.</p>
        <p data-at="12" data-out="27.5" class="cyan">A chain of proteins passes the message on, and CDK5 with p35 is one link.</p>`,
      `<p data-at="28">The neuron grows, survives and connects.</p>
        <div class="facts">${quiet(34, CYAN, fmt(F.ntrk2), 'proteins in the pathway')}${quiet(35.5, CYAN, fmt(F.ntrk2Links), 'links among them')}</div>
        ${note(40, 'This is Reactome\'s pathway Signalling by NTRK2, its proteins pulled into the centre with the links among them in the interactome; only these links show now. NTRK2 is also called TrkB. The message branches through the RAS proteins, PI3K and PLCG1, and CDK5 works with TIAM1 and RAC1 on the cell\'s skeleton. The faint ball is p39, left from the scene before.')}`)}`,
    calpain: `<h2 data-at="0.6">A cut that sticks</h2>
      ${turns(`<p data-at="1.2" data-out="22.5">Under stress, calcium floods into a neuron and wakes calpain, an enzyme that cuts proteins.</p>
        <p data-at="12" data-out="22.5" class="amber">Calpain cuts p35 into a shorter piece, p25.</p>`,
      `<p data-at="23" class="red">Bound to p25, CDK5 stays switched on for too long, and in the wrong places: it is hyperactive.</p>
        ${note(34, 'Calpain here is CAPN1 (Patrick and colleagues, Nature 1999; Lee and colleagues, Nature 2000). The link drawn between CDK5 and calpain is the authors\': calpain acts on p35, not on CDK5, and the interactome has no such link. The authors also left out every other link of CDK5 and of calpain in this scene. p25 has no point of its own in the interactome.')}`)}`,
    alzheimer: `<h2 data-at="0.6">Stuck on in Alzheimer's</h2>
      ${turns(`<p data-at="1.2" data-out="37.5">A switch stuck on does damage.</p>
        <p data-at="5" data-out="37.5">In Alzheimer's disease models, hyperactive CDK5 sets off harmful paths at once:</p>
        <ul class="steps">
          ${step(14, 37.5, ALZ, 'The cell cycle', 'CDC25A, B and C').replace('<li ', '<li data-say="the cell cycle," ')}
          ${step(17, 37.5, ALZ, 'The Golgi', 'GOLGA2').replace('<li ', '<li data-say="the Golgi," ')}
          ${step(20, 37.5, ALZ, 'The nuclear envelope', 'the lamins LMNA and LMNB1').replace('<li ', '<li data-say="the nuclear envelope," ')}
          ${step(23, 37.5, ALZ, 'Defences against oxidative stress', 'PRDX1, PRDX2 and SOD2').replace('<li ', '<li data-say="the defences against oxidative stress," ')}
          ${step(26, 37.5, ALZ, 'Signals for the cell\'s death', 'FOXO3, and its targets BCL2L11 and FASLG').replace('<li ', '<li data-say="and signals for the cell\'s death." ')}
        </ul>`,
      `<p data-at="38">Now the map is coloured by disease; grey proteins have none known.</p>
        <div class="facts">${quiet(44, ALZ, fmt(F.withDisease), 'proteins with a known disease')}${quiet(45.5, ALZ, fmt(F.alz), 'in the pathway')}${quiet(47, ALZ, fmt(F.alzLinks), 'links among them')}</div>
        ${note(50, 'The pathway is Reactome\'s "Deregulated CDK5 triggers multiple neurodegenerative pathways in Alzheimer\'s disease models", our reading of the name of the authors\' file. The diseases are those of the Disease Ontology. The faint ball is p39 again.')}`)}`,
    landscape: `<h2 data-at="0.6">A landscape of diseases</h2>
      ${turns(`<p data-at="1.2" data-out="29.5">Now place every protein by the diseases it is linked to.</p>
        <p data-at="16" data-out="29.5" class="amber">Proteins with a known disease gather in the middle; the rest are pushed to the walls.</p>`,
      `<p data-at="30" data-out="49.5">CDK5 lands among proteins tied to the same rare brain disorders: lissencephaly, a smooth brain, and pontocerebellar hypoplasia.</p>
        <div class="facts">${quiet(36, HYP, `${F.liss.near} of ${F.nearN}`, 'of its nearest share its lissencephaly', 49.5)}${quiet(38, HYP, `${F.pch.near} of ${F.nearN}`, 'its pontocerebellar hypoplasia', 49.5)}</div>
        ${note(41, `By construction: this layout places proteins with the same diseases together, so its nearest share them. In pontocerebellar hypoplasia the pons and the cerebellum stay small. CDK5's own Disease Ontology terms, ${F.cdk5Terms} with their parents, include lissencephaly, pontocerebellar hypoplasia, intellectual disability, schizophrenia and neurodegenerative disease.`, 49.5)}`,
      `<p data-at="50">${lean.length ? `Its partners lean towards the brain too: more of them than chance would give are linked to ${esc(listAnd(lean.map(x => x[1])))}.` : 'Its partners are spread over many diseases.'}</p>
        ${lean.length ? `<div class="facts">${lean.map(([t, , nm], k) => quiet(57 + 1.5 * k, CYAN, fmt(t.k), `${k ? 'with' : 'partners with'} ${esc(nm)}, about ${t.exp >= 10 ? Math.round(t.exp) : n1(t.exp)} expected`)).join('')}</div>` : ''}
        ${note(61, `The landscape places each protein by its Disease Ontology terms, their parents included (UMAP in 3D); its ${fmt(F.landLinks)} links join near proteins that interact. The counts are ours, over the ${fmt(F.withDisease)} proteins with any disease, ${F.partnersDz} of CDK5's ${F.deg} partners among them (a hypergeometric test, corrected for testing many terms${lean.length ? `: ${lean.map(([t, , nm]) => `${nm} ${qTxt(t)}`).join(', ')}` : ''}).${F.cancers ? ` Several cancers lean the same way (${F.cancers} of the ${F.topN} strongest terms).` : ''} Well-studied proteins have more known partners and diseases: in this map these are hints, not findings.`)}`)}`,
    learn: `<h2 data-at="0.6">Too little, too much</h2>
      ${turns(`<p data-at="1.2" data-out="21.5">CDK5 shows why a network view helps.</p>
        <p data-at="6" data-out="21.5">Too little CDK5, and the brain does not build itself properly.</p>
        <p data-at="13" data-out="21.5" class="red">Too much, stuck on by calpain's cut, and neurons are damaged.</p>`,
      `<p data-at="22">Explore the map yourself: any protein, any pathway, any disease.</p>
        <p data-at="25"><button class="btn primary" id="btnGoExplore" type="button">Explore the map</button></p>
        <p class="credits" data-at="27">After the Menche lab's CDK5_data repository (github.com/menchelab/CDK5_data) by Christiane Hütter, and its CDK5_analytics VR project, made with cartoGRAPHs; the interactome, Reactome's pathways, the Gene Ontology and the Disease Ontology as the authors used them. ${KNOT_NOTE}</p>
        <p class="credits" data-at="28">${OURS} Narration: a synthetic voice.</p>`)}`,
  };


  const story = $('#story');
  story.innerHTML = CH.map(c => `<section class="ch" data-ch="${c.key}">${html[c.key]}</section>`).join('');
  CH.forEach(c => {
    const sec = story.querySelector(`[data-ch="${c.key}"]`);
    ST.items.push({ sec, ch: c, els: Array.from(sec.querySelectorAll('[data-at]')).map(el => ({
      el, at: c.a + K_T * parseFloat(el.dataset.at), out: el.dataset.out ? c.a + K_T * parseFloat(el.dataset.out) : c === CH[CH.length - 1] ? Infinity : c.b - 0.05, o: -1 })),
      grow: [] });
  });

  // ------------------------------------------------------------ timeline keys
  const wp = [];
  // a camera waypoint at time t: a set's named view, turned by spin degrees, optionally nudged
  const cam = (t, k, name, spin, ease, nudge) => {
    const v = view(k, name);
    v[0] += spin || 0;
    if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0;
    wp.push([t * K_T, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name), lowOf(k, name)]);
  };
  // turns of the whole map's view that face a protein on the sphere (CDK5, APP), or the middle of CDK5 and its
  // activators (their homes are 99 and 172 degrees apart)
  const az0 = view('net', 'default')[0], toC = azOf(sphereAt(CD.cdk5)) - az0, toApp = azOf(sphereAt(Math.max(0, CD.find(F.hub)))) - az0;
  const mid = [CD.cdk5, CD.r1, CD.r2].map(sphereAt).reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]), toMid = azOf(mid) - az0;
  start({ net_grow: 0, net_scene: 0, net_shell: 1, net_links: 1, net_cdk5: 0, net_hyper: 0, net_partners: 0, net_pick: -1, net_family: 0,
    net_homes: 0, net_clouds: 0, net_path: -1, net_term: -1, net_termA: 0, net_near: 0, net_veil: 0, net_core: 0, net_dim: 0, net_hub: 0, net_shells: 0,
    net_landTags: 0, core_scene: 0, core_names: 1, core_hyper: 0, core_cut: 0, core_flow: 0 });
  let a, b;
  // Sixteen thousand proteins: the map grows from its middle; its two shells named; CDK5 found, the view turned to it
  a = C0.title.a; b = C0.title.b;
  show('net', 0.2, 2);
  ramp('net_grow', a + 1, a + 9, 0, 1);
  ramp('net_clouds', a + 16, a + 19, 0, 1);   // (the knots where proteins share a job, named)
  ramp('net_clouds', a + 33, a + 36, 1, 0);
  ramp('net_shells', a + 26, a + 29, 0, 1);
  ramp('net_shells', a + 36, a + 38, 1, 0);
  ramp('net_cdk5', a + 37.5, a + 40, 0, 1);
  cam(a, 'net', 'default', toC - 70);
  cam(a + 9, 'net', 'default', toC - 45);
  cam(a + 26, 'net', 'default', toC - 20, 'spin');
  cam(a + 37, 'net', 'default', toC);
  cam(b - 0.5, 'net', 'default', toC + 8, 'spin');
  // In a headset the first two chapters stand you inside the map (xrPlace: the map's middle at your eyes, about 2.5 m
  // round you, CDK5's side in front), once it has grown, and float it in front of you again for the activators
  ST.stand.push([a + 7, a + 10, C0.kinase.b - 5, C0.kinase.b - 0.5].map(x => x * K_T));
  // A kinase among its cousins: close to CDK5, its family lit round it; then its 205 partners across the map; the hub
  a = C0.kinase.a; b = C0.kinase.b;
  ramp('net_family', a + 9, a + 12, 0, 1);
  ramp('net_family', a + 27, a + 30, 1, 0);
  ramp('net_partners', a + 31, a + 37, 0, 1);
  ramp('net_dim', a + 31, a + 35, 0, 0.55);
  ramp('net_hub', a + 45, a + 48, 0, 1);
  ramp('net_hub', b - 4, b - 1, 1, 0);
  ramp('net_partners', b - 3.5, b - 0.5, 1, 0);
  ramp('net_dim', b - 3.5, b - 0.5, 0.55, 0);
  cam(a + 1.5, 'net', 'cdk5', 0);
  cam(a + 26, 'net', 'cdk5', 12, 'spin');
  cam(a + 31, 'net', 'default', toC);
  cam(a + 48, 'net', 'default', toApp, 'spin');   // (the short way round to the hub, at a steady pace)
  cam(b - 0.5, 'net', 'default', toApp + 12, 'spin');
  // Two partners switch it on: p35's and p39's homes lit on the sphere; then the three pulled into the centre (scene 0
  // to 1), the core coming in with them and the sphere veiled in front of it
  a = C0.activators.a; b = C0.activators.b;
  ramp('net_homes', a + 8, a + 11, 0, 1);
  ramp('net_homes', a + 22, a + 25, 1, 0);
  ramp('net_scene', a + 25, a + 33, 0, 1); ramp('core_scene', a + 25, a + 33, 0, 1);
  show('core', a + 25, a + 27);
  ramp('net_core', a + 25, a + 31, 0, 1);
  ramp('net_veil', a + 28, a + 33, 0, 1);
  cam(a + 1, 'net', 'default', toMid, null, [0, 16, 0.3]);
  cam(a + 22, 'net', 'default', toMid + 18, 'spin', [0, 16, 0.3]);
  cam(a + 26, 'net', 'default', toC);
  cam(a + 33, 'net', 'centre', 0);
  cam(b - 0.5, 'net', 'centre', 25, 'spin');
  // Healthy signalling: the pathway's proteins pulled in (scene 1 to 2), the signal running out from BDNF
  a = C0.signal.a; b = C0.signal.b;
  ramp('net_scene', a + 3, a + 10, 1, 2); ramp('core_scene', a + 3, a + 10, 1, 2);
  ramp('core_flow', a + 14, a + 17, 0, 1);
  ramp('core_flow', b - 3, b - 0.5, 1, 0);
  cam(a + 1, 'net', 'centre', 30);
  cam(a + 12, 'core', 'low', -10);
  cam(a + 40, 'core', 'low', 25, 'spin');
  cam(b - 0.5, 'net', 'centre', 10);
  // A cut that sticks: calpain and CDK5 at the centre (scene 2 to 3); the link the authors drew flashes on; CDK5 turns red
  a = C0.calpain.a; b = C0.calpain.b;
  ramp('net_scene', a + 3, a + 10, 2, 3); ramp('core_scene', a + 3, a + 10, 2, 3);
  ramp('core_cut', a + 14, a + 19, 0, 1);
  ramp('net_hyper', a + 24, a + 30, 0, 1); ramp('core_hyper', a + 24, a + 30, 0, 1);
  cam(a + 1, 'net', 'centre', -10);
  cam(a + 12, 'core', 'default', -5);
  cam(b - 0.5, 'core', 'default', 30, 'spin');
  // Stuck on in Alzheimer's: the pathway's proteins pulled in (scene 3 to 4), the map recoloured by disease; the signal
  // runs out from CDK5 in orange; then back to see the map, the veil lifting
  a = C0.alzheimer.a; b = C0.alzheimer.b;
  ramp('net_scene', a + 3, a + 10, 3, 4); ramp('core_scene', a + 3, a + 10, 3, 4);
  ramp('core_flow', a + 14, a + 17, 0, 1);
  ramp('core_flow', a + 40, a + 43, 1, 0);
  ramp('net_veil', a + 41, a + 46, 1, 0);
  cam(a + 1, 'net', 'centre', -10);
  cam(a + 12, 'core', 'default', -10);
  cam(a + 38, 'core', 'default', 15, 'spin');
  cam(a + 45, 'net', 'default', toC);
  cam(b - 0.5, 'net', 'default', toC + 25, 'spin');
  // A landscape of diseases: the sphere opens into the landscape (scene 4 to 5), the core going; its two kinds named;
  // close to CDK5, its 30 nearest; then its partners across the landscape
  a = C0.landscape.a; b = C0.landscape.b;
  ramp('net_scene', a + 3, a + 15, 4, 5); ramp('core_scene', a + 3, a + 15, 4, 5);
  hide('core', a + 8, a + 13);
  ramp('net_core', a + 3, a + 12, 1, 0);
  ramp('net_landTags', a + 16, a + 19, 0, 1);
  ramp('net_landTags', a + 27, a + 30, 1, 0);
  ramp('net_near', a + 31, a + 35, 0, 1);
  ramp('net_dim', a + 31, a + 34, 0, 0.55);
  ramp('net_near', a + 47, a + 50, 1, 0);
  ramp('net_partners', a + 51, a + 57, 0, 1);
  cam(a + 1, 'net', 'default', toC);
  cam(a + 15, 'net', 'land', -20);
  cam(a + 27, 'net', 'land', 5, 'spin');
  cam(a + 31, 'net', 'landCdk5', 0);
  cam(a + 47, 'net', 'landCdk5', 20, 'spin');
  cam(a + 52, 'net', 'land', 10);
  cam(b - 0.5, 'net', 'land', 30, 'spin');
  // Too little, too much: the landscape, CDK5 glowing, a slow turn
  a = C0.learn.a; b = C0.learn.b;
  ramp('net_partners', a, a + 3, 1, 0);
  ramp('net_dim', a, a + 3, 0.55, 0);
  cam(a + 1, 'net', 'land', 32);
  cam(b - 0.5, 'net', 'land', 72, 'spin');
  // ---- sound effects (sfxCue: story time, a sound, where it comes from, its options), beside the keys above: a cue just
  // before the line it goes with, textures under the voice soft (cued in authored seconds, as the keys)
  const cue = (t, ...r) => sfxCue(t * K_T, ...r);
  a = C0.title.a;
  cue(a + 0.8, 'grow', 'net', 'centre', { dur: 8 });                              // the map grows from its middle
  cue(a + 37.3, 'ping', 'net', 'cdk5');                                           // CDK5 found
  a = C0.kinase.a;
  cue(a + 1, 'whoosh', 'net', 'cdk5', { dur: 1.5 });                              // close to CDK5
  cue(a + 8.8, 'ping', 'net', 'cdk5', { pitch: 1.2 });                            // its cousins lit
  [31, 31.5, 32, 32.5, 33].forEach((s, i) => cue(a + s, 'link', 'net', 'cdk5', { pitch: Math.pow(2, 2 * i / 12), seq: true }));   // its partners
  cue(a + 44.8, 'ping', 'net', 'app', { pitch: 0.8 });                            // the hub
  a = C0.activators.a;
  cue(a + 7.8, 'step', 'net', 'p35');                                             // p35's home
  cue(a + 8.4, 'step', 'net', 'p39', { pitch: 1.12 });                            // p39's
  cue(a + 24.8, 'whoosh', 'net', 'centre', { dur: 7 });                           // pulled into the centre
  cue(a + 31, 'link', 'core', 'cdk5', { seq: true });                             // their two links
  cue(a + 31.6, 'link', 'core', 'cdk5', { pitch: 1.12, seq: true });
  a = C0.signal.a;
  cue(a + 2.8, 'whoosh', 'net', 'centre', { dur: 6 });                            // the pathway pulled in
  cue(a + 13.8, 'pulse', 'core', 'bdnf');                                         // the signal
  cue(a + 28, 'pulse', 'core', 'ntrk2', { gain: 0.4 });
  a = C0.calpain.a;
  cue(a + 2.8, 'whoosh', 'net', 'centre', { dur: 6, pitch: 0.8 });                // the pathway goes, calpain comes
  cue(a + 14, 'snap', 'core', 'capn1');                                           // the cut
  cue(a + 14.5, 'spark', 'core', 'cdk5');
  cue(a + 24, 'knock', 'core', 'cdk5');                                           // CDK5 turns red
  a = C0.alzheimer.a;
  cue(a + 2.8, 'whoosh', 'net', 'centre', { dur: 6 });                            // the pathway pulled in
  cue(a + 13.8, 'pulse', 'core', 'cdk5', { pitch: 0.8 });                         // the harm spreads from CDK5
  [14, 17, 20, 23, 26].forEach((s, i) => cue(a + s - 0.3, 'step', 'core', 'app', { pitch: Math.pow(2, -2 * i / 12), gain: 0.4 }));   // its paths, one by one
  cue(a + 37.8, 'rise', 'net', 'top', { dur: 3 });                                // the map coloured by disease
  a = C0.landscape.a;
  cue(a + 2.8, 'whoosh', 'net', 'centre', { dur: 10, pitch: 0.7 });               // the sphere opens into the landscape
  cue(a + 12, 'rise', 'net', 'centre', { dur: 3 });
  cue(a + 30.8, 'ping', 'net', 'near');                                           // its 30 nearest
  [51, 51.5, 52, 52.5].forEach((s, i) => cue(a + s, 'link', 'net', 'cdk5', { pitch: Math.pow(2, 2 * i / 12), seq: true }));   // its partners
  a = C0.learn.a;
  cue(a + 0.5, 'rise', 'net', 'cdk5', { gain: 0.4 });                             // the landscape, CDK5 glowing
  cue(a + 12.8, 'knock', 'net', 'cdk5', { pitch: 0.8, gain: 0.4 });               // too much
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the map's colours mean once they turn to disease)
  a = C0.alzheimer.a;
  label('net', 'top', '<b>Coloured by disease</b> · grey: none known', (a + 38) * K_T, (C0.alzheimer.b - 1) * K_T, 'amb');
}
// no set turns into another at a hand-over (buildCamera's MORPH)
const MORPH = {};
//#use buildCamera setYaw smoothSeg spinEase
// the story's view at time t: [az, el, dist, tx, ty, tz, narrow factor, FIT's target shift x, y, z, and LOW's two]
// (in a headset the first two chapters stand you inside the map instead: standW and xrPlace)
const storyCam = t => storyView(t);
//#use storyView
// In a headset the first two chapters stand you inside the map (the topo story keys its tower the same way): its
// middle at your eyes, the sphere about 2.5 m round you, CDK5's side in front (the net set's `inside` view; xrPlace
// blends to that pose by this weight, XR.inW). The weight follows the story's time alone, so at a shared-room station
// everyone sees the same. On a screen nothing changes.
// ST.stand: [t0, t1, t2, t3], in over t0..t1 and out over t2..t3 (story time)
//#use standW
//#use LBL labelEl label sfxSpan buildSetLabels labelText setLabelAlpha~2 _v labelPos _placed placeLabels curCh
//#use updateStoryDOM trackHTML buildTimeline ICON_PLAY ICON_PAUSE lastTick updateTimeline
