//#use head
// ================================================================== STORY ==
// Narration timing: [time in the recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands on
// the matching sentence. The story is narrated by a synthetic voice
// (packages/ovary/audio/narration.mp3, Kokoro's af_heart): node tools/voice/narrate.mjs
// ovary writes this table and NARRATION_ENDS from the recording it makes (each
// stretch lasts the longer of 1.1 times its story time and its line's audio
// plus a pause); run it again after the text changes (see
// tools/voice/README.md).
const NARRATION_SYNC = [
  [0, 0], [1.32, 1.2], [3.79, 2.4], [4.45, 3], [7.77, 4], [12.88, 8.5], [17.83, 13], [30.13, 20],
  [41.81, 28], [53.68, 36], [64.66, 44.3],            // Reserve
  [65.43, 45], [66.73, 46.18], [69.16, 46.2], [69.82, 46.8], [77.03, 49], [79.6, 50.5], [84, 54.5],
  [99.9, 63],                                         // Donors
  [118.6, 80], [119.9, 81.18], [121.67, 81.2], [122.33, 81.8], [132.6, 86], [145.8, 98],
  [152.43, 104], [164.53, 115], [172.67, 120], [173.33, 120.6], [188.98, 124.3],  // Section
  [189.75, 125], [190.41, 125.6], [193.06, 127], [245.42, 174.6], [262.34, 178], [263, 178.6],
  [289.82, 184.3],                                    // Methods
  [290.59, 185], [291.89, 186.18], [293.61, 186.2], [294.27, 186.8], [311.8, 192], [312.46, 192.6],
  [327.47, 197], [336.27, 202], [346.8, 207], [347.46, 207.6], [362.06, 211], [371.01, 216],
  [371.67, 216.6], [389.41, 219.5], [390.07, 220.1], [403.06, 224.3],  // Age
  [403.83, 225], [405.13, 226.18], [406.98, 226.2], [407.64, 226.8], [415.49, 230], [443.65, 255.6],
  [456.71, 259.5], [468.26, 270],                     // Next
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { title: 64.45, donors: 108.45, section: 188.75, methods: 289.6, trends: 402.85, network: 463.5 };
//#use storyT narrT T_END
const CH = [
  { key: 'title', name: 'Reserve', a: 0, b: 45 },
  { key: 'donors', name: 'Donors', a: 45, b: 80 },
  { key: 'section', name: 'Section', a: 80, b: 125 },
  { key: 'methods', name: 'Methods', a: 125, b: 185 },
  { key: 'trends', name: 'Age', a: 185, b: 225 },
  { key: 'network', name: 'Next', a: 225, b: 270 },
];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
// the engine's own params beside the sets' (DEF): none here; none keyed at an even pace or on a log scale (evalTrack)
const DEF_MORE = {}, LIN = new Set(), LOG = new Set();
//#use C DEF buildDefaults TR key ramp evalTrack storyState fadeVal ST view fitShift
// views whose parts reach under the side panel or off the right edge on a landscape screen: a little further back,
// or their target moved, so they fit beside the panel (added to the set's own view, in story and explore mode alike)
// (measured at 1280 x 760: each view's parts between the panel's right edge and the screen's, above the timeline)
// (the section and the ovary, about 1.9 long, need about 4 units' distance to fit right of the panel: further back,
// and moved right)
const SEC = [0, 0, 0.6, -0.22];
const FIT = { organ: { default: [0, 0, 0.5, -0.2], face: [0, 0, 1.0, -0.5], open: [0, 0, 0.5, -0.2], whole: [0, 0, 0.4, -0.15] },
  section: { default: SEC, pair: [0, 0, 1.05, -0.25], tiles: SEC, mask: SEC, net: [0, 0, 0.9, -0.2], forest: [0, 0, 1.0, -0.2], kinds: [0, 0, 0.3, -0.2] },
  charts: { default: [0, 0, 0.5, -0.2], hist: [0, 0, 0.5, -0.2], fan: [0, 0, 0.5, -0.2] } };
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen
const NARROW = { organ: { default: 1.15, face: 1.15, open: 1.15 }, section: { default: 1.2, pair: 1.3, tiles: 1.2, mask: 1.2, net: 1.2, forest: 1.3, kinds: 1.25 },
  charts: { default: 1.25, hist: 1.25, fan: 1.25 } };
//#use narrowOf anchorOf
// ------------------------------------------------------------------- data --
// The poster's numbers (OVARY_DATA, typed in exactly as printed) and its lines looked up (OVARY_TREND), for the story and
// the panes. Every number the story states comes from here.
const OD = OVARY_DATA, TRD = OVARY_TREND;
const KD = Object.fromEntries(OD.kinds.map(k => [k.key, k]));
// the four kinds both methods find, in the poster's table order (vessel, macrophage, albicans, follicle); the cyst only
// the segmentation finds; the order of the poster's trend charts (vessel, albicans, follicle, macrophage), for lists
const KINDS4 = OD.kinds.filter(k => !k.segOnly).map(k => k.key), KINDS = OD.kinds.map(k => k.key), CHART = OD.chartOrder;
// each kind's color: the poster's, lifted for the dark scene and the headset's panel (OVARY_LOOK.GLOW)
const toHex = c => '#' + c.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
const KCOL = Object.fromEntries(OD.kinds.map((k, i) => [k.key, toHex(OVARY_LOOK.GLOW[i])]));
//#use cap
const plural = key => KD[key].plural, Plural = key => cap(KD[key].plural);
// scores as the poster prints them ('0.70'), r and p as printed ('−0.24', '2.1×10⁻⁴')
const sc2 = v => (+v).toFixed(2), rT = TRD.rText, pT = TRD.pText;
const METHOD = { rf: OD.methods.rf, seg: OD.methods.seg };
// the count of a kind at an age on each method's fitted line (objects per section), rounded as the ovary's tags round
// it (the lines are read off the poster's figures): whole numbers under 100, the nearest ten above
const onLine = (key, m, age) => { const c = Math.max(0, TRD.line(key, m, age)); return c < 99.5 ? Math.round(c) : Math.round(c / 10) * 10; };
// what the sets know (their api())
const setApi = k => (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null);
//#use API
const api = k => API[k] || (API[k] = setApi(k) || {});

// ------------------------------------------------------------------ facts --
const FACTS = (() => {
  const D = OD, H = D.hist, B = D.background;
  // donors in the bars that start after an age (so all of them are older than it)
  const over = a => H.counts.reduce((s, n, i) => s + (H.from + i * H.width >= a ? n : 0), 0);
  // the age at which the follicle lines reach none (each method's, averaged; said to the nearest five years)
  const z = ['rf', 'seg'].map(m => D.trends.follicle[m].zeroAge).filter(Number.isFinite);
  const ps = KINDS4.map(k => KD[k].compare.p);
  // the trends with age (eight: four kinds by two methods): those with p of 0.05 or more are no trend; the others' p sum
  // up as "below" the first of 0.001, 0.01, 0.05 above their largest
  const tr = KINDS4.flatMap(k => ['rf', 'seg'].map(m => KD[k].trend[m])), sig = tr.filter(t => t.p < 0.05);
  const pTop = sig.length ? Math.max(...sig.map(t => t.p)) : 1;
  // the follicles: the share of donors with none in their section in the last decade (each method's, read off the
  // figures, averaged; said to the nearest 5 %)
  const zs = ['rf', 'seg'].map(m => D.trends.follicle[m].zero), last = zs[0].length - 1;
  return {
    donors: D.facts.donors, ages: D.facts.ages, data: D.facts.data, scale: D.facts.scale, bars: H.counts.length, width: H.width, over40: over(40),
    annotated: KINDS4.reduce((s, k) => s + KD[k].annotated, 0), zeroAt: z.length ? Math.round(z.reduce((s, v) => s + v, 0) / z.length / 5) * 5 : null,
    birth: B.atBirth, puberty: B.atPuberty, menopause: B.atMenopause, menoAge: B.menopauseAge, future: D.message.future,
    pMin: Math.min(...ps), pMax: Math.max(...ps), f1: D.checks.f1,
    noTrend: tr.length - sig.length, pBelow: [0.001, 0.01, 0.05].find(x => pTop < x) || null,
    noneDecade: 20 + 10 * last, nonePct: Math.round(zs.reduce((s, a) => s + a[last], 0) / zs.length * 20) * 5,
  };
})();
//#use listOf
const mil = n => (n >= 1e6 ? `${n / 1e6}` : fmt(n));
// the textbook numbers of follicles, said with "about"
const reserveText = F => `There are about ${mil(F.birth[0])} to ${mil(F.birth[1])} million follicles at birth, about ${fmt(F.puberty[0])} to ${fmt(F.puberty[1])} at puberty and about ${fmt(F.menopause)} at menopause, which comes at around ${F.menoAge} on average.`;
// the authors with their affiliations, and the support, as the poster gives them
const creditText = () => {
  const S = OD.source;
  return `Poster: "${S.title}" by ${listOf(S.authors.map(a => `${a.name} (${a.aff.join(', ')})`))}. ${S.affiliations.map((x, i) => `(${i + 1}) ${x}`).join('; ')}. Supported by ${listOf(S.support)}. Data: ${S.data}.`;
};
//#use inkCol swCol

function buildStory() {
  const F = FACTS;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  const hide = (k, t0, t1) => ramp(k + '_a', t0, t1, 1, 0);
  // jump a param (a step, or one changed while its set is hidden) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const step = (at, out, col, b, text) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  // ------------------------------------------------------------ panel copy
  // parts of a chapter that take turns in one place, each fading out (data-out) as the next comes: the headset's
  // panel cannot scroll, so no chapter shows more than fits at once
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const fol = KD.follicle, ves = KD.vessel, alb = KD.albicans, mac = KD.macrophage, cyst = KD.cyst;
  // a trend in words: both methods' r below 0, 'fall'; above, 'rise' (the poster's r); per method, 'no trend' where its
  // p is 0.05 or more
  const trendDir = k => (k.trend.rf.r < 0 && k.trend.seg.r < 0 ? 'fall' : k.trend.rf.r > 0 && k.trend.seg.r > 0 ? 'rise' : '');
  const trendBy = (k, m) => { const t = k.trend[m]; return `${t.p >= 0.05 ? 'no trend' : t.r < 0 ? 'falling' : 'rising'} by ${m === 'rf' ? 'the random forest' : 'segmentation'}, where r is ${rT(t.r)}${t.p >= 0.05 ? ` and p is ${pT(t.p)}` : ''}`; };
  // the methods' agreement donor by donor (the poster's comparison r), well (r 0.7 or more) and less; where the
  // segmentation's fitted line runs below the diagonal for all the less (slopes below 1, read off the poster's
  // comparison charts), it finds fewer (and the small print says where that comes from)
  const ag = KINDS4.slice().sort((p, q) => KD[q].compare.r - KD[p].compare.r), well = ag.filter(k => KD[k].compare.r >= 0.7), less = ag.filter(k => KD[k].compare.r < 0.7);
  const fewer = well.length > 0 && less.length > 0 && less.every(k => OD.compare[k] && OD.compare[k].slope < 1);
  const agreeText = () => {
    const rl = (ks, first) => listOf(ks.map((k, i) => `${plural(k)} at ${first && !i ? 'r ' : ''}${rT(KD[k].compare.r)}`));
    return well.length && less.length ? `Donor by donor, the methods agree on ${rl(well, true)}, less on ${rl(less)}${fewer ? ', where the segmentation finds fewer' : ''}.` : `Donor by donor, the methods agree on ${rl(ag, true)}.`;
  };
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">The aging ovary</h1>
      <p class="lede" data-at="2.4">What ${F.donors} ovaries show about aging</p>
      ${turns(`<p data-at="4" data-out="19.5">The ovaries hold the eggs, each in a small sac of cells called a follicle.</p>
        <p data-at="8.5" data-out="19.5" class="amber">Every ovary starts with a reserve of follicles that is never refilled.</p>
        <p class="note" data-at="13" data-out="19.5">${esc(reserveText(F))}</p>`,
      `<p data-at="20">Cut it open: the outer layer, called the cortex, holds the follicles, from tiny resting ones to large ones filled with fluid. The inner part, the medulla, carries the blood vessels.</p>
        <p data-at="28">About once a month a follicle releases its egg. What is left becomes a corpus luteum, which shrinks to a pale scar called a corpus albicans. Scars pile up over the years.</p>
        <p class="note" data-at="36">The reserve cannot be measured directly. The hormones AMH and FSH are used as indirect markers, but they cannot accurately reflect the true reserve of follicles.</p>`)}`,
    donors: `<h2 data-at="0.6">${F.donors} donors</h2>
      <p data-at="1.2">The ovaries come from GTEx, the Genotype-Tissue Expression project, which collected tissue from people who had died.</p>
      <div class="facts"><div data-at="4"><b>${F.donors}</b><small>donors</small></div><div data-at="5.5"><b>${F.ages[0]}–${F.ages[1]}</b><small>years old</small></div></div>
      <p data-at="9.5">For each donor there is a slide of ovary stained with H&amp;E, hematoxylin and eosin, which colors nuclei purple and the rest pink; the activity of its genes, measured by bulk RNA-seq; and clinical and demographic information.</p>
      <p data-at="18" class="amber">Each slide stacks up at its donor's age. Most donors were older: at least ${F.over40} of the ${F.donors} were over 40.</p>
      <p class="credits" data-at="25">The poster's age histogram. The slides are drawn, not the GTEx images.</p>`,
    section: `<h2 data-at="0.6">What's in a section</h2>
      ${turns(`<p data-at="1.2" data-out="34.5">This is a drawing of a thin slice of ovary. To teach a computer what to find, people marked ${fmt(F.annotated)} objects of four kinds by hand:</p>
        <ul class="steps">
          ${step(6, 34.5, KCOL.vessel, `${Plural('vessel')} · ${fmt(ves.annotated)}`, 'tubes that carry blood, here cut across')}
          ${step(12, 34.5, KCOL.macrophage, `${Plural('macrophage')} · ${fmt(mac.annotated)}`, 'immune cells that clear away debris')}
          ${step(18, 34.5, KCOL.albicans, `${Plural('albicans')} · ${fmt(alb.annotated)}`, 'pale scars, each left by a corpus luteum')}
          ${step(24, 34.5, KCOL.follicle, `${Plural('follicle')} · ${fmt(fol.annotated)}`, 'each an egg in a ring of cells; large ones hold fluid')}
        </ul>`,
      `<p data-at="35">Here a younger ovary lies beside an older one. The older one has large pale scars and almost no follicles left.</p>
        <p class="note" data-at="40">The numbers count the objects marked by hand, the training labels the computer learns from. The scale bars are as on the poster, ${esc(F.scale.young)} and ${esc(F.scale.old)}. Both sections are drawn, not GTEx images.</p>`)}`,
    methods: `<h2 data-at="0.6">Two ways to find them</h2>
      ${turns(`<ul class="steps">
          ${step(2, 38.5, '#46d9ff', 'First way · Tiles', 'the section is cut into small squares, each labeled with what it shows')}
          ${step(8, 38.5, '#46d9ff', 'Features', 'UNI2, a large foundation model trained on pathology images, turns each tile into a list of numbers')}
          ${step(16, 38.5, '#ffb43b', 'A random forest', 'many decision trees each ask a few questions of those numbers and vote; the most votes decide the tile\'s label')}
          ${step(33, 38.5, '#ffb43b', 'Prediction', 'every tile gets a label. This is called tile-level classification')}
        </ul>`,
      `<ul class="steps">${step(39, 0, '#3ee08f', 'Second way · Masks', 'SegFormer, a semantic segmentation model, paints a mask over each object it finds, pixel by pixel')}</ul>
        <p data-at="49">How good are they? Precision asks how many of the tiles called follicle really are one. Recall asks how many of the follicles were found. F1 puts the two in one number, and IoU measures how far a predicted mask and the true one overlap. For each score, 1 is perfect.</p>
        <p class="note" data-at="53">The random forest's F1 scores: ${KINDS4.map(k => `${plural(k)} ${sc2(KD[k].rf.f1)}`).join(', ')}. SegFormer's IoU scores: ${KINDS4.map(k => `${plural(k)} ${sc2(KD[k].iou)}`).join(', ')}. Cysts, which only the segmentation finds, are hard: their IoU is just ${sc2(cyst.iou)}.</p>`)}`,
    trends: `<h2 data-at="0.6">Trends with age</h2>
      ${turns(`<p data-at="1.2" data-out="30.5">Count each kind in every donor's section by both methods, the random forest and segmentation, RF and Seg on the tags, and set the counts against age, with different donors at each age, not one ovary followed over time. This ovary ages along the poster's lines.</p>
        <ul class="steps">
          ${step(7, 30.5, KCOL.follicle, `${Plural('follicle')} ${trendDir(fol)} to none on the lines by about age ${F.zeroAt}`, `r is ${rT(fol.trend.rf.r)} by the random forest and ${rT(fol.trend.seg.r)} by segmentation; of donors in their ${F.noneDecade}s, about ${F.nonePct} percent have none in their section`)}
          ${step(12, 30.5, KCOL.vessel, `${Plural('vessel')} ${trendDir(ves)}`, `r is ${rT(ves.trend.rf.r)} by the random forest and ${rT(ves.trend.seg.r)} by segmentation`)}
          ${step(17, 30.5, KCOL.albicans, `${Plural('albicans')} ${trendDir(alb)} as the scars pile up`, `r is ${rT(alb.trend.rf.r)} by the random forest and ${rT(alb.trend.seg.r)} by segmentation`)}
          ${step(22, 30.5, KCOL.macrophage, Plural('macrophage'), `${trendBy(mac, 'rf')}; ${trendBy(mac, 'seg')}. They are not drawn here`)}
        </ul>
        <p class="note" data-at="26" data-out="30.5">Compare each method with itself over the years: they count in their own ways.${F.pBelow ? ` ${F.noTrend ? 'Every other' : 'Every'} trend has p below ${F.pBelow}.` : ''}</p>`,
      `<p data-at="31">${esc(agreeText())}</p>
        <p class="note" data-at="34.5">r runs from −1 to +1. Below 0 means fewer with age, above 0 means more, and near 0 means no trend. A small p means a trend this strong would rarely come about by chance.</p>
        <p class="credits" data-at="37.5">r and p are the poster's (the agreement's p from ${pT(F.pMax)} down to ${pT(F.pMin)}).${fewer ? ' "Finds fewer" is read off the slopes of its comparison charts.' : ''} The tags on the ovary give each method's count on the poster's lines, read off its figures: approximate. The ovary is drawn to follow them, not to scale.</p>`)}`,
    network: `<h2 data-at="0.6">Next: a network</h2>
      ${turns(`<p data-at="1.2" data-out="29.5">Where things lie matters too. Make each object a node, link objects that lie close together, and you have a spatial neighbor network.</p>
        <p class="note" data-at="5" data-out="29.5">The network is drawn as an illustration of the poster's next step, not its result.</p>
        <p data-at="11" data-out="29.5">Gather the nodes by kind, and the links become bands that show which kinds lie next to which.</p>
        <p data-at="19.5" data-out="29.5">As the ovary ages, the network changes: the follicles' nodes go, and the scars' nodes come.</p>`,
      `<p data-at="30">Next, the authors plan to ${esc(listOf(F.future))}.</p>
        <p class="amber" data-at="34.5">Network medicine comes in here: as in the story Tissue and time, a tissue becomes a network of neighbors.</p>
        <p class="credits" data-at="38.5">${esc(creditText())}</p>
        <p data-at="41.5"><button class="btn primary" id="btnGoExplore" type="button">Explore the ovary</button></p>
        <p class="credits" data-at="43">Drawn, not GTEx images: the ovary, the slides and the sections. Illustrative: the network. Approximate: the tags on the ovary (read off the poster's figures). Narration: a synthetic voice (Kokoro).</p>`)}`,
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
  // (the body and the ovary share one frame, so their waypoints turn them together)
  const cam = (t, k, name, spin, ease, nudge) => {
    const v = view(k, name);
    v[0] += spin || 0;
    if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0;
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name)]);
  };
  start({ body_pet: 1, body_net: 0, body_state: 0, body_blank: 0,
    organ_grow: 0, organ_body: 1, organ_open: 0, organ_age: 25, organ_follicle: 0, organ_albicans: 0, organ_vessel: 0, organ_luteum: 0, organ_parts: 0, organ_agelab: 0, organ_counts: 0,
    section_age: 26, section_pair: 0, section_vessel: 0, section_macrophage: 0, section_albicans: 0, section_follicle: 0, section_cyst: 0,
    section_tiles: 0, section_feat: 0, section_forest: 0, section_pred: 0, section_mask: 0, section_net: 0, section_lift: 0, section_kinds: 0, section_names: 0,
    charts_slides: 0, charts_hist: 0 });
  let a, b;
  // The reserve: the tour's PET body, the ovary small in its pelvis; it grows out of the body, opens, and its parts are named
  a = C.title.a; b = C.title.b;
  show('body', 0.2, 2); show('organ', 0.2, 2);
  cam(a, 'organ', 'body', -12);
  cam(a + 4.5, 'organ', 'body', 6, 'spin');
  cam(a + 9, 'organ', 'pelvis');
  ramp('organ_grow', a + 9.5, a + 18.5, 0, 1);
  hide('body', a + 11, a + 16);
  cam(a + 18.5, 'organ', 'whole');
  ramp('organ_open', a + 20, a + 27, 0, 1);
  cam(a + 21, 'organ', 'open');
  cam(a + 27.5, 'organ', 'face');
  ramp('organ_parts', a + 27, a + 29, 0, 1);
  cam(a + 32, 'organ', 'face', 8, 'spin');
  cam(a + 35, 'organ', 'cortex');
  cam(b - 0.5, 'organ', 'cortex', 10, 'spin');
  // 255 donors: the slides fly in and fan out, then stack into the age histogram
  a = C.donors.a; b = C.donors.b;
  hide('organ', a, a + 1.5);
  ramp('organ_parts', a + 1.5, a + 1.6, 1, 0);
  // (the slides fly in while the ovary fades, from 1.5 s before the chapter: the owner, 2 November 2026, "the donors
  // should fade in earlier, else the space is empty")
  show('charts', a - 1.5, a + 0.5);
  ramp('charts_slides', a - 1.5, a + 8.5, 0, 1);
  cam(a + 1, 'charts', 'fan', -8);
  cam(a + 11, 'charts', 'fan', 6, 'spin');
  ramp('charts_hist', a + 13, a + 23, 0, 1);
  cam(a + 14, 'charts', 'hist', -4);
  cam(b - 0.5, 'charts', 'hist', 8, 'spin');
  // What's in a section: one kind picked out after another with its count; all four; then a younger and an older section
  a = C.section.a; b = C.section.b;
  // (one model out before the next comes in, at each change of model: two see-through models in one place flicker in a
  // headset as their drawing order flips with the head; the owner, 2 November 2026)
  hide('charts', a, a + 1.2);
  jump('charts_slides', a + 2.2, 1, 0); jump('charts_hist', a + 2.2, 1, 0);
  show('section', a + 1.2, a + 2.6);
  cam(a + 1, 'section', 'default', -10);
  cam(a + 5.5, 'section', 'default', 4, 'spin');
  const pick = (k, t0, t1) => { ramp('section_' + k, t0, t0 + 1, 0, 1); ramp('section_' + k, t1, t1 + 1, 1, 0); };
  pick('vessel', a + 6, a + 11.5); pick('macrophage', a + 12, a + 17.5); pick('albicans', a + 18, a + 23.5);
  ramp('section_follicle', a + 24, a + 25, 0, 1);
  cam(a + 25, 'section', 'close');
  cam(a + 29.5, 'section', 'close', 8, 'spin');
  // (all four at once, then none)
  for (const k of ['vessel', 'macrophage', 'albicans']) ramp('section_' + k, a + 30.5, a + 31.5, 0, 1);
  for (const k of KINDS4) ramp('section_' + k, a + 33.5, a + 34.5, 1, 0);
  cam(a + 31.5, 'section', 'default', -4);
  ramp('section_pair', a + 35, a + 41, 0, 1);
  cam(a + 35.5, 'section', 'pair');
  cam(b - 0.5, 'section', 'pair', 6, 'spin');
  // Two methods: tiles, their features, the forest's vote, the predictions; then SegFormer's masks, and the scores as tags
  // on the masked section's own objects (story labels, below)
  a = C.methods.a; b = C.methods.b;
  ramp('section_pair', a, a + 2, 1, 0);
  ramp('section_tiles', a + 2, a + 7, 0, 1);
  cam(a + 2, 'section', 'tiles', -6);
  cam(a + 7.5, 'section', 'tiles', 4, 'spin');
  ramp('section_feat', a + 8, a + 14, 0, 1);
  cam(a + 9, 'section', 'feat');
  cam(a + 15, 'section', 'feat', 6, 'spin');
  ramp('section_forest', a + 16, a + 33, 0, 1);
  cam(a + 17, 'section', 'forest');
  cam(a + 32, 'section', 'forest', 8, 'spin');
  ramp('section_pred', a + 33, a + 37.5, 0, 1);
  cam(a + 35.5, 'section', 'tiles', -4);
  for (const n of ['section_tiles', 'section_feat', 'section_forest', 'section_pred']) ramp(n, a + 38, a + 39.5, 1, 0);
  ramp('section_mask', a + 39.5, a + 47.5, 0, 1);
  cam(a + 39.5, 'section', 'mask', -6);
  cam(a + 47.5, 'section', 'mask', 6, 'spin');
  cam(b - 0.5, 'section', 'mask', 18, 'spin', [0, 10]);
  // Trends with age: the big cut-away ovary alone ages from 20 to 70, its tags giving each method's count on the poster's
  // lines (no charts: the r values are on the panel)
  a = C.trends.a; b = C.trends.b;
  hide('section', a, a + 1.2);
  jump('section_mask', a + 2.2, 1, 0);
  jump('organ_body', a, 1, 0); jump('organ_agelab', a, 0, 1); jump('organ_age', a, 25, 20);
  show('organ', a + 1.2, a + 2.7);
  ramp('organ_counts', a + 3, a + 5, 0, 1);
  ramp('organ_age', a + 5, a + 37, 20, 70);
  cam(a + 1, 'organ', 'default', -8);
  cam(a + 14, 'organ', 'default', 6, 'spin');
  cam(a + 19, 'organ', 'face', -4);
  cam(b - 0.5, 'organ', 'face', 8, 'spin');
  // Next, a network: the illustrative spatial neighbor network over the section; it tips back, its nodes rise off it and
  // gather into hubs by kind, the links into bands between kinds; then it ages from 25 to 65
  a = C.network.a; b = C.network.b;
  hide('organ', a, a + 1.2);
  jump('organ_counts', a + 2.2, 1, 0); jump('organ_agelab', a + 2.2, 1, 0);
  jump('section_age', a, 26, 25);
  show('section', a + 1.2, a + 2.6);
  ramp('section_net', a + 2, a + 9, 0, 1);
  ramp('section_lift', a + 10, a + 14, 0, 1);
  ramp('section_kinds', a + 14.5, a + 19, 0, 1);
  ramp('section_names', a + 17, a + 19, 0, 1);   // (the hubs' names: the set's labels, each going with its hub)
  ramp('section_age', a + 20, a + 36, 25, 65);
  cam(a + 2.5, 'section', 'net', -6);   // (over the crossfade: the ovary's face view rises to the network's slowly)
  cam(a + 9.5, 'section', 'net', 2, 'spin');
  cam(a + 14, 'section', 'kinds', 0, null, [0, 10, -0.3, 0, -0.3]);   // (the slab tipped back and sunk: from a little above)
  cam(a + 19.5, 'section', 'kinds', -4);
  cam(b, 'section', 'kinds', 10, 'spin');
  // ---- sound effects (sfxCue: story time, a sound, where it comes from, its options), beside the keys above: a cue just
  // before the line it goes with, textures under the voice soft; sequences from the keys (when a ramp reaches a share)
  const rampAt = (t0, t1, f) => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (smooth(m) < f) lo = m; else hi = m; } return t0 + (t1 - t0) * lo; };
  a = C.title.a;
  sfxCue(a + 0.3, 'rise', 'body', null, { gain: 0.4 });                          // the body
  sfxCue(a + 9.5, 'rise', 'organ', 'small', { dur: 9, pitch: 0.9 });              // the ovary grows out of it
  sfxCue(a + 19.8, 'whoosh', 'organ', 'cortex', { dur: 7, pitch: 0.7 });          // it opens
  sfxCue(a + 27.2, 'ping', 'organ', 'follicle');                                  // its parts named
  a = C.donors.a;
  sfxCue(a + 0.9, 'clink', 'charts', 'slides');                                   // the first slide
  sfxCue(a + 1.5, 'patter', 'charts', 'fan', { dur: 9, gain: 0.35 });             // 255 slides fly in and fan out
  sfxCue(a + 13, 'ratchet', 'charts', 'hist', { n: 12, dur: 10, pitch: 0.8, gain: 0.3 });   // they stack into the histogram
  a = C.section.a;
  [['vessel', 6], ['macrophage', 12], ['albicans', 18], ['follicle', 24]].forEach(([k, s], j) => sfxCue(a + s - 0.2, 'pick', 'section', k, { pitch: Math.pow(2, 2 * j / 12) }));   // each kind
  sfxCue(a + 30.5, 'grow', 'section', 'center', { dur: 1.5 });                    // all four
  sfxCue(a + 34.7, 'whoosh', 'section', 'young');                                 // a younger and an older section
  a = C.methods.a;
  sfxCue(a + 1.8, 'grow', 'section', 'tiles', { dur: 5, pitch: 1.2 });            // tiles
  sfxCue(a + 7.8, 'grow', 'section', 'feat', { dur: 6, pitch: 1.5, gain: 0.35 });   // UNI2's features
  sfxCue(a + 15.8, 'patter', 'section', 'forest', { dur: 4, pitch: 0.8, gain: 0.3 });   // the grove grows
  { const v0 = rampAt(a + 16, a + 33, 0.35), v1 = rampAt(a + 16, a + 33, 0.85);   // (the trees answer, the set's section_forest 0.35 to 0.85)
    sfxCue(v0, 'ratchet', 'section', 'forest', { n: 10, dur: v1 - v0, gain: 0.3 }); }
  sfxCue(a + 32.8, 'ping', 'section', 'pred');                                    // the predictions
  sfxCue(a + 39.3, 'whoosh', 'section', 'mask', { dur: 3 });                      // SegFormer's masks wash in
  [['follicle', 49.5], ['vessel', 50.3], ['macrophage', 51.1], ['albicans', 51.9], ['cyst', 53.5]].forEach(([k, s], j) =>
    sfxCue(a + s, 'step', 'section', 'tag_' + k, { pitch: Math.pow(2, 2 * j / 12), gain: 0.3, seq: true }));   // the scores as tags
  a = C.trends.a;
  sfxCue(a + 3, 'pick', 'organ', 'age');                                          // the count tags
  for (let k = 0; k <= 5; k++) sfxCue(rampAt(a + 5, a + 37, k / 5), 'step', 'organ', 'follicle', { pitch: Math.pow(2, -2 * k / 12), gain: 0.3 });   // each decade, 20 to 70
  a = C.network.a;
  sfxCue(a + 2, 'grow', 'section', 'center', { dur: 7 });                         // the neighbor network
  sfxCue(a + 10, 'whoosh', 'section', 'net', { dur: 4, pitch: 1.2 });             // it tips up off the section
  sfxCue(a + 14.5, 'rise', 'section', 'kinds', { dur: 4.5 });                     // it gathers into hubs by kind
  [30, 40, 50, 60].forEach((y, k) => sfxCue(rampAt(a + 20, a + 36, (y - 25) / 40), 'step', 'section', 'kinds', { pitch: Math.pow(2, -2 * (k + 1) / 12), gain: 0.25 }));   // it ages, 25 to 65
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  a = C.title.a;
  label('organ', 'small', '<b>An ovary</b>one of two', a + 4, a + 10, 'mag');
  a = C.donors.a;
  label('charts', 'fan', `<b>${F.donors} slides</b>one per donor`, a + 5, a + 13, 'cyn');
  a = C.section.a;
  [['vessel', 6, 11.5, 'cyn'], ['macrophage', 12, 17.5, 'grn'], ['albicans', 18, 23.5, 'mag'], ['follicle', 24, 30.5, 'amb']].forEach(([k, t0, t1, cls]) =>
    label('section', k, `<b>${esc(cap(KD[k].name))}</b>${fmt(KD[k].annotated)} marked`, a + t0 + 0.5, a + t1, cls));
  // the scores as tags on the masked section's own objects: the random forest's F1 and SegFormer's IoU (the poster's)
  a = C.methods.a; b = C.methods.b;
  [['follicle', 49.5, 'amb'], ['vessel', 50.3, 'cyn'], ['macrophage', 51.1, 'grn'], ['albicans', 51.9, 'mag'], ['cyst', 53.5, '']].forEach(([k, t0, cls]) =>
    label('section', 'tag_' + k, `<b>${esc(cap(KD[k].name))}</b>${KD[k].rf ? `F1 ${sc2(KD[k].rf.f1)} · ` : ''}IoU ${sc2(KD[k].iou)}${k === 'cyst' ? ': the mask misses most of it' : ''}`, a + t0, b, cls));
}
// no set turns into another at a hand-over (buildCamera's MORPH)
const MORPH = {};
//#use buildCamera setYaw smoothSeg spinEase storyCam LBL labelEl label sfxSpan buildSetLabels labelText
//#use setLabelAlpha~2 _v labelPos _placed
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
    if (o <= 0) { if (L.o !== 0) { L.el.style.opacity = 0; L.o = 0; } continue; }
    vis.push([L, x, y, o]);
  }
  vis.sort((p, q) => p[2] - q[2]);
  for (const [L, x, y0, o0] of vis) {
    let y = y0, o = o0;
    for (let pass = 0; pass < 6; pass++) {
      const hit = _placed.find(r => x < r[0] + r[2] && r[0] < x + L.w && y < r[1] + r[3] && r[1] < y + L.h);
      if (!hit) break;
      y = hit[1] + hit[3] + 2;
    }
    // (a label nudged down under the panel or the timeline, as on a small screen held sideways, shows none)
    if ((pr.width && y + L.h > pr.top && y < pr.bottom && x < pr.right + 6) || y + L.h > barTop - 4) o = 0;
    if (o !== L.o) { L.el.style.opacity = o; L.o = o; }
    if (o <= 0) continue;
    _placed.push([x, y, L.w, L.h]);
    L.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
}

//#use curCh updateStoryDOM trackHTML buildTimeline ICON_PLAY ICON_PAUSE lastTick updateTimeline