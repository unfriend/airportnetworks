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
  [0, 0],                                             // One messenger in a city
  [77, 70], [91.3, 83], [100.33, 91],                 // Two partners switch it on
  [123.43, 112],                                      // Everyone it talks to
  [152.03, 138],                                      // Growing and connecting
  [192.73, 175],                                      // Finding the way
  [232.33, 211],                                      // Reading the day
  [275.23, 250],                                      // A cut that sticks
  [323.63, 294],                                      // Stuck on, and out of place
  [367.63, 334],                                      // Stuck on in Alzheimer's
  [417.13, 379],                                      // A landscape of diseases
  [478.73, 435], [507.33, 461],                       // Too little, too much
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { title: 72.9, activators: 112.55, partners: 148.35, ntrk2: 188.45, sema: 227.75, npas4: 271.5, calpain: 317.95, reach: 363.25, alzheimer: 410.75, landscape: 473.45, learn: 499.4 };
//#use storyT narrT T_END
// (the chapters and every key, cue and line are authored in seconds as below and run at K_T of them: the story's own
// clock; the narration paces it at least 1.1 times story time)
const K_T = 1;
// the chapters follow the scenes of the colleague's scene document (0 to 9) and a short close
const CH0 = [
  { key: 'title', name: 'A city', a: 0, b: 70 },
  { key: 'activators', name: 'Switched on', a: 70, b: 112 },
  { key: 'partners', name: 'Its partners', a: 112, b: 138 },
  { key: 'ntrk2', name: 'Growing', a: 138, b: 175 },
  { key: 'sema', name: 'Direction', a: 175, b: 211 },
  { key: 'npas4', name: 'Timing', a: 211, b: 250 },
  { key: 'calpain', name: 'The cut', a: 250, b: 294 },
  { key: 'reach', name: 'Out of place', a: 294, b: 334 },
  { key: 'alzheimer', name: 'Alzheimer\'s', a: 334, b: 379 },
  { key: 'landscape', name: 'Diseases', a: 379, b: 435 },
  { key: 'learn', name: 'Too much', a: 435, b: 461 },
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
    // the second project's two pathways: in the map, and shown (the piece their links join)
    sema: F.pathways.sema, semaShown: F.pathways.semaShown, semaLinks: F.sceneLinks.sema, npas4: F.pathways.npas4, npas4Shown: F.pathways.npas4Shown,
    family5: F.family5 || 0,
    // where CDK5's partners crowd on the map of processes (for the view only): the partner with the most others within
    // 30 degrees of it, its place
    dense: (() => {
      const nb = Array.from(CD.nb(CD.cdk5)).map(sphereAt).map(p => { const l = Math.hypot(...p) || 1; return p.map(v => v / l); });
      let best = 0, bi = 0;
      nb.forEach((u, i) => { let c = 0; for (const w of nb) if (u[0] * w[0] + u[1] * w[1] + u[2] * w[2] > 0.866) c++; if (c > best) { best = c; bi = i; } });
      return nb[bi] || [0, 0, 1];
    })(),
  };
})();
// where the knots' names come from, wherever the knots show (chapter 1's small print, the credits, explore's scene)
const KNOT_NOTE = `The knots are named from today's Gene Ontology${FACTS.goRel ? ` (release ${FACTS.goRel})` : ''}, not the authors' own annotation; most of the map's big clouds mix many processes.`;
// the authors' own names of their nine scenes (the VR projects' folders: CDK5_analytics, and CDK5_minimal_new for
// three), in the story's order
const AUTHOR_SC = CD.SCENES.map(k => CD.scene(k).texture || k);
// the credits: the last chapter's small print and explore's About pane (page and headset)
const OURS = 'Ours: the close-ups at the map\'s centre (their balls, tubes and names, a clearer drawing of the centre\'s proteins at the authors\' places, scaled up; the structures from the Protein Data Bank, not to scale), the tags with numbers and the over-representation counts.';
const ABOUT = `After ${CD.about}. The authors': the interactome of ${fmt(FACTS.proteins)} proteins and ${fmt(FACTS.links)} links, every layout, colour and link of the nine scenes (six from their CDK5_analytics project, three from CDK5_minimal_new), the pathways' members (Reactome) and the proteins' Disease Ontology associations. ${OURS} The layouts place proteins with similar processes or diseases close only roughly (UMAP): distances on them are not measurements.`;
// the structures the close-ups show (sets/core.js, src/models.json): the protein, the entry and what it really is
// (explore's About, page and headset)
const STRUCTS = [
  ['CDK5', 'PDB 1H4L (Tarricone et al., Mol Cell 2001): human CDK5, from its crystal with p25'],
  ['p35', 'PDB 1H4L: only the part that grips CDK5, residues 147 to 293, within p25; the rest of p35 has no known shape (a small ball)'],
  ['p39', 'no structure known: a ball'],
  ['calpain (CAPN1)', 'PDB 1ZCM (Li et al., Biochemistry 2006): calpain-1\'s cutting core, its two protease domains only'],
  ['BDNF', 'PDB 1BND (Robinson et al., Biochemistry 1995): one chain of a pair of BDNF and NT-3'],
  ['NTRK2 (TrkB)', 'PDB 1HCF (Banfield et al., Structure 2001): only its binding domain (d5), there holding NT-4/5, a close cousin of BDNF'],
  ['SEMA4D, PLXNB1', 'PDB 3OL2 (Janssen et al., Nature 2010): the two together, their parts outside the cell (of PLXNB1 its first two domains)'],
  ['NPAS4', 'PDB 7XI3 (Sun et al., PNAS 2022): mouse NPAS4, its DNA-binding and PAS parts, from a crystal with ARNT2 on DNA'],
  ['Tau (MAPT)', 'PDB 5O3L (Fitzpatrick et al., Nature 2017): ten layers of the core of a paired helical filament from an Alzheimer\'s brain (cryo-EM)'],
];
// the About pane's note (page and headset): the two links the authors drew; the pairs the second project does not tell apart
const ABOUT_NOTE = `The CDK5 - calpain line of the calpain scene and the CDK5 - NPAS4 line of the NPAS4 scene are the authors' own, not interactions of the interactome: calpain cuts p35. In the second project's files ${CD.ambiguous.length} pairs of proteins have the very same links and colours in every scene (${CD.ambiguous.map(p => p.map(i => CD.sym[i]).join(' and ')).join(', ')}): which of a pair's two places is whose cannot be told, so they may be the other way round. Structures from the Protein Data Bank (CC0).`;
//#use inkCol swCol
// the story's colours (SPEC.md, "Look", CLOOK)
const CYAN = '#46d9ff', AMBER = '#ffb43b', RED = '#ff7a6b', GREEN = '#3ee08f', GREY = '#8e98ab';
const CC = CLOOK.C;

function buildStory() {
  const F = FACTS;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  const hide = (k, t0, t1) => ramp(k + '_a', t0, t1, 1, 0);
  // a param up over [t0, t1] (and down over [t2, t3])
  const up = (n, t0, t1, t2, t3, v) => { ramp(n, t0, t1, 0, v || 1); if (t2 !== undefined) ramp(n, t2, t3, v || 1, 0); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  // ------------------------------------------------------------ panel copy
  // Each chapter: a heading, the key points (data-at: when a line appears, seconds into the chapter) and its small
  // print. The voice has its own words (data-say: tools/voice/narrate.mjs speaks them, the headset's subtitles show
  // them), one spoken line per cue: a key point carries the line said as it appears; a line said with no key point of
  // its own is a cue mark (vo: an empty mark in the panel, its words only spoken and subtitled). A key point not spoken
  // and the small print carry data-say="" (mute).
  const sy = s => ` data-say="${esc(s.replace(/\s+/g, ' ').trim())}"`, mute = ' data-say=""';
  const vo = (at, s) => `<span class="vo" data-at="${at}"${sy(s)}>​</span>`;
  const pt = (at, text, say, cls, out) => (typeof cls === 'number' ? pt(at, text, say, '', cls) : `<p data-at="${at}"${out ? ` data-out="${out}"` : ''}${cls ? ` class="${cls}"` : ''}${say === undefined ? mute : sy(say)}>${text}</p>`);
  // parts of a chapter that take turns in one place, the first fading out (its lines' data-out) as the next comes: a
  // short screen and the headset's panel show a heading and at most two points at once, never scrolling it away
  const turns = (...parts) => `<div style="display:grid">${parts.map(q => `<div style="grid-area:1/1">${q}</div>`).join('')}</div>`;
  const note = (at, text) => `<p class="note" data-at="${at}"${mute}>${text}</p>`;
  const n1 = v => (Math.round(v * 10) / 10).toFixed(1);
  // a round number as the voice says it (one to nineteen, and whole hundreds), else in figures
  const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const say = v => (v < 20 ? ONES[v] : v % 100 === 0 && v < 2000 ? `${ONES[v / 100]} hundred` : fmt(v));
  const knots = F.knots.map(n => (api('net').knotName ? api('net').knotName(n) : n).toLowerCase());
  const park = F.park, about = v => (v >= 10 ? fmt(Math.round(v)) : n1(v));
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1"${mute}>The switch that sticks</h1>
      <p class="lede" data-at="2"${mute}>CDK5, its network and brain diseases</p>
      ${turns(`${vo(3, 'Think of a cell as a city.')}
      ${pt(6.5, `${fmt(F.proteins)} human proteins; lines join those known to bind`, `Its workers are proteins, thousands of kinds of them. Here are ${say(Math.floor(F.proteins / 1000))} thousand, and every line joins two that are known to work hand in hand.`, 42.0)}
      ${pt(18, 'Proteins with similar jobs sit close together', 'Workers with similar jobs live in the same neighbourhood. So this is a map of who does what.', 42.0)}
      ${vo(26, 'Some workers are messengers. We call them kinases. They carry instructions: start making energy, move this cargo, divide now.')}
      ${vo(34, 'Today we follow one messenger. Its name is CDK5. Let\'s find it.')}
      ${vo(40, 'There.')}`,
      `${pt(42.5, 'CDK5: a kinase of nerve cells', 'Most of its family tell cells when to divide. CDK5 is the odd one out. It works in nerve cells, which never divide again. There it helps them grow, reach out and connect, which is what a brain needs in order to learn.', 'green')}
      ${vo(61, 'It has side jobs elsewhere in the body too, from repairing DNA to releasing insulin.')}
      ${note(62, `The map of processes: each protein placed on a sphere by the Gene Ontology biological processes it takes part in (the lab's cartoGRAPHs); ${fmt(F.withProcess)} with a known process inside, ${fmt(F.without)} without on the outer shell. The map draws ${fmt(F.mapLinks)} of the ${fmt(F.links)} links, between near neighbours. ${knots.length ? `The knots named: ${esc(listAnd(knots))}. ` : ''}${KNOT_NOTE}`)}
      <p class="credits" data-at="63">After the Menche lab's CDK5_data repository by Christiane Hütter, and its two VR projects.</p>`)}`,
    activators: `<h2 data-at="0.6"${mute}>Two partners switch it on</h2>
      ${vo(2, 'On its own, CDK5 does nothing.')}
      ${pt(6, 'Its cousins are switched on by cyclins. CDK5 is not.', 'It needs a partner to switch it on. For the rest of its family, that partner is a cyclin.')}
      ${pt(13, 'p35 (CDK5R1) and p39 (CDK5R2), both made in nerve cells', 'CDK5 waits for something else: one of two proteins made in nerve cells. We call them p35 and p39.', 'green')}
      ${vo(21, 'Here they are, right beside it.')}
      ${vo(25, 'When one of them docks, the switch is on. When it lets go, the switch is off. That is how it should be: on for a moment, then off again.')}
      ${note(36, 'The authors\' scene of CDK5 and its regulatory subunits, pulled into the map\'s centre. The structures are real: CDK5 and the part of p35 that grips it, as they sit together in a crystal (residues 147 to 293, within p25); the rest of p35 has no known shape and is a small ball. p39 has no known structure: a ball. Close-ups not to scale.')}`,
    partners: `<h2 data-at="0.6"${mute}>Everyone it talks to</h2>
      ${vo(1.5, 'So who does this messenger talk to?')}
      ${pt(6, `<b class="big">${fmt(F.deg)}</b> proteins are known to bind CDK5`, `These are all the proteins CDK5 is known to touch. About ${say(Math.round(F.deg / 100) * 100)} of them.`, 'green')}
      ${pt(13, `${ordinal(F.rank)} of ${fmt(F.proteins)} by number of partners`, 'That is a lot of conversations for one protein. And they are not all about the same thing.')}
      ${vo(21, 'Let\'s listen in on three.')}
      ${note(22, `Interactions as the authors collected them (HIPPIE); pathways from Reactome. The authors' star of CDK5's partners, from their second project; ${F.family5} of its cousins, other CDKs, brighter.`)}`,
    ntrk2: `<h2 data-at="0.6"${mute}>Growing and connecting</h2>
      ${turns(`${vo(2, 'The first is about growing.')}
      ${pt(6, `Signalling by NTRK2: ${fmt(F.ntrk2)} proteins (Reactome)`, 'A nerve cell gets a signal from outside, a growth factor called BDNF.', 'cyan', 25.5)}
      ${pt(12, 'BDNF docks on its receptor, NTRK2; the message passes down a chain', 'It docks on a receptor in the cell\'s outer skin, NTRK2.', 25.5)}
      ${vo(18, 'From there the message is handed along a chain of proteins, and CDK5 is one of the hands.')}`,
      `${pt(26, 'Further down: the MAP kinase and PI3K-AKT routes', 'The result: the cell matures, it strengthens its connections, and it survives. The same route also carries our sense of pain.')}
      ${note(33, `Reactome's pathway, its proteins pulled into the centre with the ${fmt(F.ntrk2Links)} links among them. NTRK2 is also called TrkB. The structures: BDNF is one chain of a crystal of BDNF with NT-3; NTRK2 is only its binding domain, from a crystal with NT-4/5, a close cousin of BDNF; CDK5 with p35's gripping part. Close-ups not to scale.`)}`)}`,
    sema: `<h2 data-at="0.6"${mute}>Finding the way</h2>
      ${vo(2, 'The second is about direction.')}
      ${pt(6, `Semaphorin interactions: ${fmt(F.sema)} proteins (Reactome)`, 'A growing nerve cell sends out a long thread, and its tip has to find the right way.', 'cyan')}
      ${pt(14, 'Semaphorins: signals outside the cell that guide its shape and movement', 'Signals outside the cell act like road signs. They are called semaphorins, after the old signal towers.')}
      ${vo(22, 'CDK5 helps the cell read those signs, and it helps build the scaffolding inside the growing tip.')}
      ${vo(30, 'So the thread goes where it should.')}
      ${note(31, `From the authors' second project: the ${fmt(F.semaShown)} proteins of the pathway that its links join in one piece, with the ${fmt(F.semaLinks)} links among them. The structures: the semaphorin SEMA4D and the start of its receptor, PLXNB1, from one crystal of the two together, their parts outside the cell. Close-ups not to scale.`)}`,
    npas4: `<h2 data-at="0.6"${mute}>Reading the day</h2>
      ${turns(`${vo(2, 'The third is about timing.')}
      ${pt(6, `Transcriptional regulation by NPAS4: ${fmt(F.npas4)} proteins (Reactome)`, undefined, 'cyan', 19.5)}
      ${pt(7, 'NPAS4 switches genes on when a nerve cell has been active', 'When a nerve cell has been busy, a protein called NPAS4 goes to the DNA and switches genes on.', 19.5)}
      ${vo(14, 'It is how the cell takes note of what it has just been through.')}`,
      `${pt(20, 'Linked to the body\'s day and night rhythm', 'CDK5 has a say in that as well. And this route has been tied to the body\'s clock, the rhythm that tells us when to sleep and when to wake.')}
      ${vo(32, 'Three conversations, three different jobs. All of them healthy.')}
      ${note(34, `From the authors' second project: the ${fmt(F.npas4Shown - 1)} proteins its links join in one piece, and CDK5. CDK5 is in Reactome's list, but no link of the interactome joins it to the rest, so the authors drew one to NPAS4. The tie to the body's clock is reported, not shown here. The structure: mouse NPAS4, the part that holds DNA, from a crystal with its partner ARNT2. Close-ups not to scale.`)}`)}`,
    calpain: `<h2 data-at="0.6"${mute}>A cut that sticks</h2>
      ${vo(2, 'Now for what can go wrong.')}
      ${vo(6, 'When a nerve cell is under stress, calcium floods in, and it wakes an enzyme called calpain. Calpain is a pair of scissors.')}
      ${pt(16, 'Calpain (CAPN1) cuts p35 into a shorter piece, p25', 'It does not touch CDK5. It cuts the partner, p35, and leaves a shorter piece. We call it p25.', 'amber')}
      ${pt(25, 'p25 lasts much longer than p35: the switch stays on', 'Here is the trouble. p35 is short lived, so the switch goes off by itself. p25 is tough. It hangs on.')}
      ${vo(34, 'And so the switch sticks. CDK5 stays on, long after it should have stopped.')}
      ${note(40, 'The line the authors drew from CDK5 to calpain is not a binding of the interactome: calpain cuts p35, not CDK5. The structure: calpain-1\'s cutting core (CAPN1, its two protease domains). Close-ups not to scale.')}`,
    reach: `<h2 data-at="0.6"${mute}>Stuck on, and out of place</h2>
      ${turns(`${vo(1.5, 'A switch that is stuck on is bad enough. But there is a second problem.')}
      ${pt(8, 'With p25, CDK5 is no longer kept where it belongs', 'With its normal partner, CDK5 is kept in its place. With p25, it is not.', 'red', 22.5)}
      ${pt(15, 'It reaches the cell\'s interior and the nucleus', 'It wanders. It turns up deep inside the cell, even in the nucleus, where the DNA is kept.', 22.5)}`,
      `${pt(23, `Its partners lie all across the map`, 'Look how far its connections reach: right across the map.')}
      ${vo(30, 'A messenger that never stops, in places it should not be, handing out instructions nobody asked for.')}
      ${note(37, `CDK5's ${fmt(F.deg)} partners on the map of processes, its lines drawn from the map's centre.`)}`)}`,
    alzheimer: `<h2 data-at="0.6"${mute}>Stuck on in Alzheimer's</h2>
      ${turns(`${pt(2, `Deregulated CDK5 in Alzheimer's disease models: ${fmt(F.alz)} proteins (Reactome)`, 'We know one disease where this happens: Alzheimer\'s.', 'amber', 20.5)}
      ${vo(7, 'Inside every nerve cell there are tracks that carry cargo, and a protein called Tau holds those tracks together.')}
      ${pt(16, 'It overloads Tau and neurofilaments with phosphate', 'Overactive CDK5 loads Tau with far too many phosphate tags.', 20.5)}`,
      `${pt(21, 'Tangles of Tau are a hallmark of Alzheimer\'s disease', 'Tau lets go of the tracks and clumps into tangles. Those tangles are one of the hallmarks of Alzheimer\'s disease.', 'amber')}
      ${vo(30, 'That is why researchers are looking at CDK5 as a possible target for treatment. It is early days, but the idea is simple: unstick the switch.')}
      ${note(41, 'Reactome\'s "Deregulated CDK5 triggers multiple neurodegenerative pathways in Alzheimer\'s disease models" (our reading of the name of the authors\' file); the map now coloured by disease, grey for none known. Tau (MAPT) is not in the pathway\'s list: it is one of CDK5\'s partners in the interactome, and its line to CDK5 is that link. The structure: the core of a Tau filament from an Alzheimer\'s brain, ten layers. Close-ups not to scale.')}`)}`,
    landscape: `<h2 data-at="0.6"${mute}>A landscape of diseases</h2>
      ${turns(`${vo(2, 'Let\'s step back one last time, and redraw the map.')}
      ${pt(9, `${fmt(F.withDisease)} proteins with a known disease, placed by the diseases they share`, 'Now proteins sit together when they are linked to the same diseases. It is a landscape of what goes wrong.', 25.5)}
      ${pt(18, 'CDK5 lands among rare disorders of brain development', 'CDK5 lands among proteins tied to rare disorders in which the brain does not form properly.', 'red', 25.5)}`,
      `${pt(26, park ? `${fmt(park.k)} of its partners are linked to Parkinson's disease; about ${about(park.exp)} would be expected by chance (in this map)` : 'Its partners lean towards brain disorders (in this map)', 'And its partners lean towards the brain as well: Parkinson\'s disease, psychotic disorders. More of them than chance would give us.', 'cyan')}
      ${vo(35, 'But its lines also run into parts of this landscape that have nothing to do with the brain, some cancers among them.')}
      ${vo(44, 'Nobody knows yet what CDK5 is doing there. A map like this does not prove anything. It tells us where to look next.')}
      ${note(52, `Well-studied proteins have more known partners and more known diseases; a pattern, not proof. The landscape places each protein by its Disease Ontology terms (UMAP in 3D). The counts are ours, over the ${fmt(F.withDisease)} proteins with any disease, ${F.partnersDz} of CDK5's ${F.deg} partners among them (a hypergeometric test, corrected for testing many terms). Lit: Parkinson's disease, then cancer.`)}`)}`,
    learn: `<h2 data-at="0.6"${mute}>Too little, too much</h2>
      ${turns(`${vo(1.5, 'So that is CDK5. One messenger, many conversations.')}
      ${pt(6, 'Too little CDK5: the brain does not build itself properly', 'Too little of it, and a brain cannot build itself. Too much, stuck on, and nerve cells are harmed.', 13.5)}
      ${pt(10, 'Too much, stuck on: nerve cells are damaged', undefined, 'red', 13.5)}`,
      `${pt(14, 'Explore it yourself: any protein, any pathway, any disease', 'The map is yours now. Pick any protein, any pathway, any disease. Have a look around.')}
      <p data-at="16"${mute}><button class="btn primary" id="btnGoExplore" type="button">Explore the map</button></p>
      <p class="credits" data-at="18">After the Menche lab's CDK5_data repository (github.com/menchelab/CDK5_data) by Christiane Hütter: its CDK5_analytics and CDK5_minimal_new VR projects, made with cartoGRAPHs; the interactome, Reactome's pathways, the Gene Ontology and the Disease Ontology as the authors used them. ${KNOT_NOTE}</p>
      <p class="credits" data-at="19">${OURS} Narration: a synthetic voice.</p>`)}`,
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
  // turns of the whole map's view that face a protein on the sphere (CDK5), and the side where CDK5's partners crowd
  const az0 = view('net', 'default')[0], el0 = view('net', 'default')[1], toC = azOf(sphereAt(CD.cdk5)) - az0;
  const toDense = azOf(F.dense) - az0, elDense = Math.max(-25, Math.min(35, Math.asin(F.dense[1] / Math.hypot(...F.dense)) / D2R)) - el0;
  const termIx = n => CD.terms.findIndex(t => t.name === n);
  const PARK = termIx('Parkinson\'s disease'), CANCER = termIx('cancer');
  const S = sc => CD.SCENES.indexOf(sc);
  start({ net_grow: 0, net_scene: 0, net_shell: 1, net_links: 1, net_cdk5: 0, net_hyper: 0, net_partners: 0, net_pick: -1, net_family: 0,
    net_homes: 0, net_clouds: 0, net_path: -1, net_term: -1, net_termA: 0, net_near: 0, net_veil: 0, net_core: 0, net_dim: 0, net_hub: 0, net_shells: 0,
    net_landTags: 0, core_scene: 0, core_names: 0, core_hyper: 0, core_cut: 0, core_flow: 0, core_dock: 0, core_mCdk5: 0, core_mP35: 0, core_p39: 0,
    core_mCapn: 0, core_mBdnf: 0, core_mTrkb: 0, core_mSema: 0, core_mNpas4: 0, core_tau: 0, core_mTau: 0, core_phos: 0 });
  // both sets move from one of the authors' scenes to the next together, over [t0, t1]
  const move = (t0, t1, from, to) => { ramp('net_scene', t0, t1, S(from), S(to)); ramp('core_scene', t0, t1, S(from), S(to)); };
  let a, b;
  // 0 One messenger in a city: the map grows from its middle; the knots where proteins share a job; the search for
  // CDK5 (the view turning to it), found and named
  a = C0.title.a; b = C0.title.b;
  show('net', 0.2, 2);
  ramp('net_grow', a + 2, a + 11, 0, 1);
  up('net_clouds', a + 19, a + 22, a + 30, a + 33);
  up('net_cdk5', a + 39.6, a + 41.5);
  cam(a, 'net', 'default', toC - 80);
  cam(a + 11, 'net', 'default', toC - 55, 'spin');
  cam(a + 19, 'net', 'default', toC - 40);
  cam(a + 31, 'net', 'default', toC - 25, 'spin');
  cam(a + 35, 'net', 'default', toC - 18);
  cam(a + 40, 'net', 'cdk5', 0);
  cam(b - 0.5, 'net', 'cdk5', 8, 'spin');
  // In a headset the first chapter stands you inside the map (xrPlace: the map's middle at your eyes, about 2.5 m round
  // you, CDK5's side in front), once it has grown, and floats it in front of you again before CDK5 is found
  ST.stand.push([a + 9, a + 12, a + 33, a + 37].map(x => x * K_T));
  // 1 Two partners switch it on: CDK5, p35 and p39 pulled into the centre (scene 0 to 1), the view into the centre with
  // them; their structures as they are named; p35 docks on CDK5 (the switch on) and lets go again (off)
  a = C0.activators.a; b = C0.activators.b;
  move(a + 1, a + 9, 'bioproc', 'subunits');
  show('core', a + 1, a + 3);
  ramp('net_core', a + 1, a + 7, 0, 1);
  ramp('net_veil', a + 4, a + 9, 0, 1);
  up('core_mCdk5', a + 20.6, a + 22.4);
  up('core_mP35', a + 21, a + 23);
  up('core_p39', a + 21.4, a + 23.4);
  ramp('core_dock', a + 25.5, a + 28.5, 0, 1);
  ramp('core_dock', a + 30.5, a + 33.5, 1, 0);
  cam(a + 1, 'net', 'default', toC);
  cam(a + 9, 'net', 'centre', 0);
  cam(a + 18, 'net', 'centre', 15, 'spin');
  cam(a + 23, 'core', 'dock', 0);
  cam(b - 0.5, 'core', 'dock', 12, 'spin');
  // 2 Everyone it talks to: the authors' star of CDK5's 205 partners round it (scene 1 to 2), the activators going
  a = C0.partners.a; b = C0.partners.b;
  ramp('core_mP35', a + 0.5, a + 3, 1, 0); ramp('core_p39', a + 0.5, a + 3, 1, 0);
  move(a + 4, a + 11, 'subunits', 'partners');
  // (the star's points are the authors' dark green, faint: CDK5's lines to them, the partners lit, the rest stepping back)
  up('net_partners', a + 5, a + 11, b - 2.5, b);
  ramp('net_dim', a + 5, a + 10, 0, 0.45); ramp('net_dim', b - 2.5, b, 0.45, 0);
  cam(a + 1, 'core', 'default', 0);
  cam(a + 10, 'net', 'centre', 10, null, [0, 4, 0.35]);
  cam(b - 0.5, 'net', 'centre', 40, 'spin', [0, 4, 0.35]);
  // 3 Growing and connecting: Signalling by NTRK2 pulled in (scene 2 to 3); BDNF and its receptor as they are named,
  // then CDK5 with p35 docked, the message running from BDNF
  a = C0.ntrk2.a; b = C0.ntrk2.b;
  move(a + 1, a + 8, 'partners', 'ntrk2');
  key('core_dock', a, 1);
  up('core_mBdnf', a + 8, a + 10);
  up('core_mTrkb', a + 12.6, a + 14.4);
  up('core_mP35', a + 18.5, a + 20.5);
  up('core_flow', a + 19, a + 22, b - 3, b - 0.5);
  cam(a + 1, 'net', 'centre', 40, null, [0, 4, 0.35]);
  cam(a + 8, 'net', 'centre', 70, 'spin');
  cam(a + 13, 'core', 'trk', 0);
  cam(a + 18, 'core', 'trk', 10, 'spin');
  cam(a + 23, 'core', 'default', 0);
  cam(b - 0.5, 'core', 'default', 30, 'spin');
  // 4 Finding the way: Semaphorin interactions pulled in (scene 3 to 4); a semaphorin and its receptor; the signs read
  a = C0.sema.a; b = C0.sema.b;
  ramp('core_mBdnf', a + 0.5, a + 3, 1, 0); ramp('core_mTrkb', a + 0.5, a + 3, 1, 0); ramp('core_mP35', a + 0.5, a + 3, 1, 0);
  move(a + 2, a + 9, 'ntrk2', 'sema');
  up('core_mSema', a + 17.5, a + 19.5);
  up('core_flow', a + 22.5, a + 25.5, b - 3, b - 0.5);
  cam(a + 2, 'core', 'default', 30);
  cam(a + 9, 'net', 'centre', 50, 'spin');
  cam(a + 18, 'core', 'sema', 0);
  cam(a + 27, 'core', 'sema', 12, 'spin');
  cam(a + 31, 'core', 'default', 0);
  cam(b - 0.5, 'core', 'default', 25, 'spin');
  // 5 Reading the day: Transcriptional regulation by NPAS4 pulled in (scene 4 to 5); NPAS4; the authors' line from CDK5
  a = C0.npas4.a; b = C0.npas4.b;
  ramp('core_mSema', a + 0.5, a + 3, 1, 0);
  move(a + 1, a + 8, 'sema', 'npas4');
  up('core_mNpas4', a + 10.5, a + 12.5);
  up('core_flow', a + 13, a + 16, b - 4, b - 1);
  cam(a + 1, 'core', 'default', 25);
  cam(a + 8, 'net', 'centre', 45, 'spin');
  cam(a + 12, 'core', 'npas', 0);
  cam(a + 30, 'core', 'npas', 15, 'spin');
  cam(b - 0.5, 'core', 'default', 20);
  // 6 A cut that sticks: calpain and CDK5 at the centre (scene 5 to 6), p35 docked on CDK5; calpain as it is named; the
  // cut (p35's rest breaks off: p25), then CDK5 turning red
  a = C0.calpain.a; b = C0.calpain.b;
  ramp('core_mNpas4', a + 0.5, a + 3, 1, 0);
  move(a + 1, a + 8, 'npas4', 'calpain');
  up('core_mP35', a + 6, a + 8);
  up('core_mCapn', a + 12.6, a + 14.4);
  ramp('core_cut', a + 18, a + 24, 0, 1);
  ramp('net_hyper', a + 35, a + 39, 0, 1); ramp('core_hyper', a + 35, a + 39, 0, 1);
  cam(a + 1, 'core', 'default', 20);
  cam(a + 9, 'core', 'default', 0);
  cam(a + 14, 'core', 'cut', 0);
  cam(a + 33, 'core', 'cut', 15, 'spin');
  cam(b - 0.5, 'core', 'cut', 20, 'spin');
  // 7 Stuck on, and out of place: the view back to the whole map (the close-up and the veil going), CDK5's lines to
  // its partners across the map; towards the side where they crowd
  a = C0.reach.a; b = C0.reach.b;
  ramp('core_mCapn', a + 8, a + 11, 1, 0);
  hide('core', a + 10, a + 14);
  ramp('net_core', a + 10, a + 14, 1, 0);
  ramp('net_veil', a + 10, a + 15, 1, 0);
  up('net_partners', a + 23, a + 28);
  ramp('net_dim', a + 23, a + 27, 0, 0.55);
  cam(a + 1, 'core', 'cut', 20);
  cam(a + 9, 'core', 'default', 10);
  cam(a + 18, 'net', 'default', toC);
  cam(a + 25, 'net', 'default', toC + 8, 'spin');
  cam(a + 33, 'net', 'default', toDense, null, [0, elDense, -0.25]);
  cam(b - 0.5, 'net', 'default', toDense + 10, 'spin', [0, elDense, -0.25]);
  // 8 Stuck on in Alzheimer's: back to the centre; the pathway pulled in (scene 6 to 7), the map coloured by disease;
  // Tau beside the centre, phosphate tags piling on it, then its filament, the harm running out from CDK5
  a = C0.alzheimer.a; b = C0.alzheimer.b;
  ramp('net_partners', a + 0.5, a + 3, 1, 0); ramp('net_dim', a + 0.5, a + 3, 0.55, 0);
  move(a + 3, a + 10, 'calpain', 'alzheimer');
  show('core', a + 3, a + 5);
  ramp('net_core', a + 3, a + 8, 0, 1);
  ramp('net_veil', a + 4, a + 9, 0, 1);
  up('core_tau', a + 12.6, a + 14.4);
  up('core_phos', a + 17, a + 22);
  up('core_mTau', a + 22.5, a + 24.5);
  up('core_flow', a + 31, a + 34);
  cam(a + 1, 'net', 'default', toDense, null, [0, elDense, -0.25]);
  cam(a + 9, 'net', 'centre', 0);
  cam(a + 15, 'core', 'tau', 0);
  cam(a + 29, 'core', 'tau', 12, 'spin');
  cam(a + 33, 'core', 'default', 5);
  cam(b - 0.5, 'core', 'default', 25, 'spin');
  // 9 A landscape of diseases: the sphere opens into the landscape (scene 7 to 8), the close-up going; its two kinds;
  // close to CDK5, its nearest; its partners' lines; Parkinson's disease lit, then cancer
  a = C0.landscape.a; b = C0.landscape.b;
  move(a + 3, a + 15, 'alzheimer', 'disease');
  hide('core', a + 4, a + 9);
  ramp('core_flow', a + 3, a + 6, 1, 0); ramp('core_mTau', a + 4, a + 8, 1, 0); ramp('core_tau', a + 4, a + 8, 1, 0); ramp('core_phos', a + 4, a + 8, 1, 0);
  ramp('net_core', a + 3, a + 12, 1, 0);
  ramp('net_veil', a + 3, a + 9, 1, 0);
  up('net_landTags', a + 12, a + 15, a + 18, a + 20);
  up('net_near', a + 19, a + 22, a + 25, a + 27);
  ramp('net_dim', a + 19, a + 22, 0, 0.55);
  up('net_partners', a + 26, a + 30);
  key('net_term', a + 27.9, -1); key('net_term', a + 28, PARK);
  ramp('net_termA', a + 28, a + 31, 0, 1);
  ramp('net_termA', a + 35, a + 36.5, 1, 0);
  key('net_term', a + 36.6, PARK); key('net_term', a + 36.7, CANCER);
  ramp('net_termA', a + 36.8, a + 39, 0, 1);
  ramp('net_termA', a + 50, a + 53, 1, 0);
  cam(a + 1, 'core', 'default', 25);
  cam(a + 4, 'net', 'default', toC);
  cam(a + 15, 'net', 'land', -20);
  cam(a + 18, 'net', 'land', -10, 'spin');
  cam(a + 22, 'net', 'landCdk5', 0);
  cam(a + 26, 'net', 'landCdk5', 10, 'spin');
  cam(a + 31, 'net', 'land', 10);
  cam(b - 0.5, 'net', 'land', 45, 'spin');
  // Too little, too much: the landscape, CDK5 glowing, a slow turn
  a = C0.learn.a; b = C0.learn.b;
  ramp('net_partners', a, a + 3, 1, 0);
  ramp('net_dim', a, a + 3, 0.55, 0);
  key('net_term', a + 4, CANCER); key('net_term', a + 4.1, -1);
  cam(a + 1, 'net', 'land', 46);
  cam(b - 0.5, 'net', 'land', 80, 'spin');
  // ---- sound effects (sfxCue: story time, a sound, where it comes from, its options), beside the keys above: a cue just
  // before the moment it goes with, soft under the voice
  const cue = (t, ...r) => sfxCue(t * K_T, ...r);
  a = C0.title.a;
  cue(a + 1.8, 'grow', 'net', 'centre', { dur: 8 });                              // the map grows from its middle
  cue(a + 39.5, 'ping', 'net', 'cdk5');                                           // CDK5 found
  a = C0.activators.a;
  cue(a + 0.8, 'whoosh', 'net', 'centre', { dur: 7 });                            // pulled into the centre
  cue(a + 25.6, 'link', 'core', 'cdk5', { seq: true });                           // p35 docks: on
  cue(a + 30.6, 'link', 'core', 'cdk5', { pitch: 0.8, seq: true });               // lets go: off
  a = C0.partners.a;
  cue(a + 3.8, 'whoosh', 'net', 'centre', { dur: 6 });                            // the star
  [6, 6.5, 7, 7.5].forEach((s, i) => cue(a + s, 'link', 'net', 'cdk5', { pitch: Math.pow(2, 2 * i / 12), seq: true, gain: 0.5 }));
  a = C0.ntrk2.a;
  cue(a + 0.8, 'whoosh', 'net', 'centre', { dur: 6 });                            // the pathway pulled in
  cue(a + 18.8, 'pulse', 'core', 'bdnf');                                         // the message
  a = C0.sema.a;
  cue(a + 1.8, 'whoosh', 'net', 'centre', { dur: 6 });
  cue(a + 22.3, 'pulse', 'core', 'sema', { pitch: 1.1 });
  a = C0.npas4.a;
  cue(a + 0.8, 'whoosh', 'net', 'centre', { dur: 6 });
  cue(a + 12.8, 'pulse', 'core', 'npas4', { pitch: 0.9 });
  a = C0.calpain.a;
  cue(a + 0.8, 'whoosh', 'net', 'centre', { dur: 6, pitch: 0.8 });                // calpain comes in
  cue(a + 18.6, 'snap', 'core', 'capn1');                                         // the cut
  cue(a + 19.1, 'spark', 'core', 'cdk5');
  cue(a + 35, 'knock', 'core', 'cdk5');                                           // CDK5 turns red
  a = C0.reach.a;
  [23, 23.5, 24, 24.5].forEach((s, i) => cue(a + s, 'link', 'net', 'cdk5', { pitch: Math.pow(2, 2 * i / 12), seq: true }));   // its lines
  a = C0.alzheimer.a;
  cue(a + 2.8, 'whoosh', 'net', 'centre', { dur: 6 });                            // the pathway pulled in
  cue(a + 9.8, 'rise', 'net', 'top', { dur: 3 });                                 // the map coloured by disease
  [17, 18.5, 20].forEach((s, i) => cue(a + s, 'step', 'core', 'tau', { pitch: Math.pow(2, -2 * i / 12), gain: 0.4 }));   // phosphate tags
  cue(a + 22.4, 'knock', 'core', 'tau', { pitch: 0.7 });                          // the tangle
  a = C0.landscape.a;
  cue(a + 2.8, 'whoosh', 'net', 'centre', { dur: 10, pitch: 0.7 });               // the sphere opens into the landscape
  cue(a + 18.8, 'ping', 'net', 'near');                                           // its nearest
  [26, 26.5, 27, 27.5].forEach((s, i) => cue(a + s, 'link', 'net', 'cdk5', { pitch: Math.pow(2, 2 * i / 12), seq: true }));   // its partners
  a = C0.learn.a;
  cue(a + 0.5, 'rise', 'net', 'cdk5', { gain: 0.4 });                             // the landscape, CDK5 glowing
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the map's colours mean once they turn to disease)
  a = C0.alzheimer.a;
  label('net', 'top', '<b>Coloured by disease</b> · grey: none known', (a + 10) * K_T, (a + 15) * K_T, 'amb');
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
