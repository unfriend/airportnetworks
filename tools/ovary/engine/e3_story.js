
// ================================================================== STORY ==
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Until a narration is recorded, the table sets the
// pace: node tools/pace.mjs writes it from the words on the panel (each stretch
// between two cues lasts long enough to read what appeared at its start; run
// it again after the text changes). A recording replaces it with its own times.
const NARRATION_SYNC = [
  [0, 0], [2.6, 2.4], [4.4, 4], [9.5, 8.5], [22.1, 20], [32.6, 28], [43.8, 36],  // Reserve
  [53.7, 45], [55, 46.2], [61.1, 49], [67.1, 54.5], [78, 63],  // Donors
  [96.7, 80], [98, 81.18], [98.8, 81.2], [106.3, 86], [138.2, 115], [144.7, 120],  // Section
  [154.4, 125], [155.1, 125.6], [156.9, 127], [209.3, 174.6], [223.4, 178],  // Methods
  [232.4, 185], [233, 185.6], [234.1, 186.2], [244.2, 195], [284.9, 232], [290.7, 236],
  [291.3, 236.6], [300.4, 240],                       // Age
  [310.1, 245], [311.4, 246.18], [312.2, 246.2], [329.6, 262], [333.2, 265], [342, 273],  // Agree?
  [352.8, 280], [353.5, 280.6], [354.6, 281.2], [363.1, 289], [367.8, 292.5], [374, 298.1],
  [383.4, 302], [390.3, 306], [390.9, 306.6], [412.6, 309], [414.2, 310.5], [421.5, 315],  // Next
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
  { key: 'title', name: 'Reserve', a: 0, b: 45 },
  { key: 'donors', name: 'Donors', a: 45, b: 80 },
  { key: 'section', name: 'Section', a: 80, b: 125 },
  { key: 'methods', name: 'Methods', a: 125, b: 185 },
  { key: 'trends', name: 'Age', a: 185, b: 245 },
  { key: 'agree', name: 'Agree?', a: 245, b: 280 },
  { key: 'network', name: 'Next', a: 280, b: 315 },
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
// (the section and the ovary, about 1.9 long, need about 4 units' distance to fit right of the panel: further back,
// and moved right)
const SEC = [0, 0, 0.6, -0.22];
const FIT = { organ: { default: [0, 0, 0.5, -0.2], face: [0, 0, 1.0, -0.5], open: [0, 0, 0.5, -0.2], whole: [0, 0, 0.4, -0.15] },
  section: { default: SEC, pair: [0, 0, 1.05, -0.25], tiles: SEC, mask: SEC, net: [0, 0, 0.9, -0.2], forest: [0, 0, 1.0, -0.2] },
  charts: { default: [0, 0, 0.5, -0.2], trends: [0, 0, 0.5, -0.2], hist: [0, 0, 0.5, -0.2], fan: [0, 0, 0.5, -0.2], scores: [0, 0, 0.5, -0.25], side: [0, 0, 1.0, -0.2], focus: [0, 0, 1.4, -0.32] } };
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen
const NARROW = { organ: { default: 1.15, face: 1.15, open: 1.15 }, section: { default: 1.2, pair: 1.3, tiles: 1.2, mask: 1.2, net: 1.2, forest: 1.3 },
  charts: { default: 1.2, trends: 1.2, hist: 1.25, fan: 1.25, scores: 1.3, side: 1.35 } };
const narrowOf = (k, name) => (NARROW[k] && NARROW[k][name]) || 1;
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

// ------------------------------------------------------------------- data --
// The poster's numbers (OVARY_DATA, typed in exactly as printed) and its lines looked up (OVARY_TREND), for the story and
// the panes. Every number the story states comes from here.
const OD = OVARY_DATA, TRD = OVARY_TREND;
const KD = Object.fromEntries(OD.kinds.map(k => [k.key, k]));
// the four kinds both methods find, in the poster's table order (vessel, macrophage, albicans, follicle); the cyst only
// the segmentation finds; the charts' 2 x 2 order (vessel, albicans, follicle, macrophage)
const KINDS4 = OD.kinds.filter(k => !k.segOnly).map(k => k.key), KINDS = OD.kinds.map(k => k.key), CHART = OD.chartOrder;
// each kind's color: the poster's, lifted for the dark scene and the headset's panel (OVARY_LOOK.GLOW)
const toHex = c => '#' + c.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
const KCOL = Object.fromEntries(OD.kinds.map((k, i) => [k.key, toHex(OVARY_LOOK.GLOW[i])]));
const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
const plural = key => KD[key].plural, Plural = key => cap(KD[key].plural);
// scores as the poster prints them ('0.70'), r and p as printed ('−0.24', '2.1×10⁻⁴')
const sc2 = v => (+v).toFixed(2), rT = TRD.rText, pT = TRD.pText;
const METHOD = { rf: OD.methods.rf, seg: OD.methods.seg };
// the count of a kind at an age on each method's fitted line, rounded as a count (objects per section)
const onLine = (key, m, age) => Math.max(0, Math.round(TRD.line(key, m, age)));
// what the sets know (their api())
const setApi = k => (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null);
const API = {};
const api = k => API[k] || (API[k] = setApi(k) || {});

// ------------------------------------------------------------------ facts --
const FACTS = (() => {
  const D = OD, H = D.hist, B = D.background;
  // donors in the bars that start after an age (so all of them are older than it)
  const over = a => H.counts.reduce((s, n, i) => s + (H.from + i * H.width >= a ? n : 0), 0);
  // the age at which the follicle lines reach none (each method's, averaged; said to the nearest five years)
  const z = ['rf', 'seg'].map(m => D.trends.follicle[m].zeroAge).filter(Number.isFinite);
  const ps = KINDS4.map(k => KD[k].compare.p);
  return {
    donors: D.facts.donors, ages: D.facts.ages, data: D.facts.data, scale: D.facts.scale, bars: H.counts.length, width: H.width, over40: over(40),
    annotated: KINDS4.reduce((s, k) => s + KD[k].annotated, 0), zeroAt: z.length ? Math.round(z.reduce((s, v) => s + v, 0) / z.length / 5) * 5 : null,
    birth: B.atBirth, puberty: B.atPuberty, menopause: B.atMenopause, menoAge: B.menopauseAge, future: D.message.future,
    pMin: Math.min(...ps), pMax: Math.max(...ps), f1: D.checks.f1,
  };
})();
const listOf = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const mil = n => (n >= 1e6 ? `${n / 1e6}` : fmt(n));
// the textbook numbers of follicles, said with "about"
const reserveText = F => `About ${mil(F.birth[0])} to ${mil(F.birth[1])} million follicles at birth, about ${fmt(F.puberty[0])} to ${fmt(F.puberty[1])} at puberty and about ${fmt(F.menopause)} at menopause (on average around ${F.menoAge}).`;
// the authors with their affiliations, and the support, as the poster gives them
const creditText = () => {
  const S = OD.source;
  return `Poster: "${S.title}" by ${listOf(S.authors.map(a => `${a.name} (${a.aff.join(', ')})`))}. ${S.affiliations.map((x, i) => `(${i + 1}) ${x}`).join('; ')}. Supported by ${listOf(S.support)}. Data: ${S.data}.`;
};
// colors as text on the HTML panel, which is light in the light theme: a color mixed with the panel's ink (darker on a
// light panel, lighter on a dark one). The headset's panel is dark: its canvas twin takes the color itself (data-col).
const inkCol = c => `color-mix(in srgb, ${c} 55%, var(--ink))`;
const swCol = c => c;   // a swatch or a bar in the same color

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
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">The aging ovary</h1>
      <p class="lede" data-at="2.4">what ${F.donors} ovaries show about aging</p>
      ${turns(`<p data-at="4" data-out="19.5">The ovaries hold the eggs, each in a small sac of cells: a follicle.</p>
        <p data-at="8.5" data-out="19.5" class="amber">Every ovary starts with a reserve of follicles that is never refilled.</p>
        <p class="note" data-at="13" data-out="19.5">${esc(reserveText(F))}</p>`,
      `<p data-at="20">Cut open: the outer layer (the cortex) holds the follicles, from tiny resting ones to large ones filled with fluid. The inner part (the medulla) carries the blood vessels.</p>
        <p data-at="28">About once a month a follicle releases its egg. What is left becomes a corpus luteum, which shrinks to a pale scar: a corpus albicans. Scars pile up over the years.</p>
        <p class="note" data-at="36">The reserve cannot be measured directly. The hormones AMH and FSH are used as indirect markers, but they cannot accurately reflect the true reserve of follicles.</p>`)}`,
    donors: `<h2 data-at="0.6">${F.donors} donors</h2>
      <p data-at="1.2">The ovaries come from GTEx (the Genotype-Tissue Expression project), which collected tissue from people who had died.</p>
      <div class="facts"><div data-at="4"><b>${F.donors}</b><small>donors</small></div><div data-at="5.5"><b>${F.ages[0]}–${F.ages[1]}</b><small>years old</small></div></div>
      <p data-at="9.5">For each donor: a slide of ovary stained with H&amp;E (hematoxylin and eosin: nuclei purple, the rest pink), the activity of its genes (bulk RNA-seq), and clinical and demographic information.</p>
      <p data-at="18" class="amber">Each slide stacks on its donor's age. Most donors were older: at least ${F.over40} of the ${F.donors} were over 40.</p>
      <p class="credits" data-at="25">The poster's age histogram. The slides are drawn, not the GTEx images.</p>`,
    section: `<h2 data-at="0.6">What's in a section</h2>
      ${turns(`<p data-at="1.2" data-out="34.5">A thin slice of ovary, drawn. To teach a computer what to find, people marked ${fmt(F.annotated)} objects of four kinds by hand:</p>
        <ul class="steps">
          ${step(6, 34.5, KCOL.vessel, `${Plural('vessel')} · ${fmt(ves.annotated)}`, 'tubes that carry blood, here cut across')}
          ${step(12, 34.5, KCOL.macrophage, `${Plural('macrophage')} · ${fmt(mac.annotated)}`, 'immune cells that clear away debris')}
          ${step(18, 34.5, KCOL.albicans, `${Plural('albicans')} · ${fmt(alb.annotated)}`, 'pale scars, each left by a corpus luteum')}
          ${step(24, 34.5, KCOL.follicle, `${Plural('follicle')} · ${fmt(fol.annotated)}`, 'an egg in a ring of cells; large ones hold fluid')}
        </ul>`,
      `<p data-at="35">A younger ovary beside an older one. In the older: large pale scars, and almost no follicles left.</p>
        <p class="note" data-at="40">The numbers are the objects marked by hand (the training labels). Scale bars as on the poster: ${esc(F.scale.young)} and ${esc(F.scale.old)}. Both sections are drawn, not GTEx images.</p>`)}`,
    methods: `<h2 data-at="0.6">Two ways to find them</h2>
      ${turns(`<ul class="steps">
          ${step(2, 38.5, '#46d9ff', '1 · Tiles', 'the section is cut into small squares, each labeled with what it shows')}
          ${step(8, 38.5, '#46d9ff', 'Features', 'UNI2, a pathology foundation model (a large model trained on pathology images), turns each tile into a list of numbers')}
          ${step(16, 38.5, '#ffb43b', 'A random forest', 'many decision trees each ask a few questions of those numbers and vote; the most votes name the tile')}
          ${step(33, 38.5, '#ffb43b', 'Prediction', 'every tile gets a label: tile-level classification')}
        </ul>`,
      `<ul class="steps">${step(39, 0, '#3ee08f', '2 · Masks', 'SegFormer, a semantic segmentation model, paints a mask over each object it finds, pixel by pixel')}</ul>
        <p data-at="49">How good are they? Precision: of the tiles called follicle, how many are one. Recall: of the follicles, how many were found. F1: the two in one number. IoU: how far a predicted mask and the true one overlap. 1 is perfect.</p>
        <p class="note" data-at="53">Random forest F1: ${KINDS4.map(k => `${plural(k)} ${sc2(KD[k].rf.f1)}`).join(', ')}. SegFormer IoU: ${KINDS4.map(k => `${plural(k)} ${sc2(KD[k].iou)}`).join(', ')}; cysts, which only the segmentation finds, just ${sc2(cyst.iou)}: hard.</p>`)}`,
    trends: `<h2 data-at="0.6">Trends with age</h2>
      ${turns(`<p data-at="1.2" data-out="46.5">Count each kind in every donor's section by both methods (RF: random forest; Seg: segmentation) and set the counts against age. On the left, the ovary ages along.</p>
        <ul class="steps">
          ${step(10, 46.5, KCOL.follicle, `${Plural('follicle')} fall`, `toward none by about ${F.zeroAt} · RF r ${rT(fol.trend.rf.r)}, Seg r ${rT(fol.trend.seg.r)}`)}
          ${step(18, 46.5, KCOL.vessel, `${Plural('vessel')} fall`, `RF r ${rT(ves.trend.rf.r)}, Seg r ${rT(ves.trend.seg.r)}`)}
          ${step(26, 46.5, KCOL.albicans, `${Plural('albicans')} rise`, `the scars pile up · RF r ${rT(alb.trend.rf.r)}, Seg r ${rT(alb.trend.seg.r)}`)}
          ${step(34, 46.5, KCOL.macrophage, Plural('macrophage'), `flat by the random forest (r ${rT(mac.trend.rf.r)}), falling by segmentation (r ${rT(mac.trend.seg.r)})`)}
        </ul>`,
      `<p data-at="47">${Plural('follicle')} up close: both lines reach none by about ${F.zeroAt}. The band holds most of the dots.</p>
        <p class="note" data-at="51">r runs from −1 to +1: below 0, fewer with age; above 0, more; near 0, no trend. A small p means a trend this strong would rarely come about by chance.</p>
        <p class="credits" data-at="55">The lines, r and p are the poster's. The dots are drawn to match the poster's trends, not the donors' values. The ovary's counts follow the lines.</p>`)}`,
    agree: `<h2 data-at="0.6">Do the methods agree?</h2>
      <p data-at="1.2">On the poster each donor is one dot: the random forest's count across, the segmentation's up. On the dashed diagonal both would count the same.</p>
      <ul class="steps">
        ${step(10, 0, KCOL.follicle, `${Plural('follicle')} · r ${rT(fol.compare.r)}`, 'agree well')}
        ${step(13, 0, KCOL.vessel, `${Plural('vessel')} · r ${rT(ves.compare.r)}`, 'agree well')}
        ${step(17, 0, KCOL.albicans, `${Plural('albicans')} · r ${rT(alb.compare.r)}`, 'agree less: the segmentation finds far fewer')}
        ${step(20, 0, KCOL.macrophage, `${Plural('macrophage')} · r ${rT(mac.compare.r)}`, 'agree less: the segmentation finds fewer')}
      </ul>
      <p class="amber" data-at="24">Two methods, one picture of aging: fewer follicles and vessels, more scars.</p>
      <p class="credits" data-at="28">r and p as on the poster (p from ${pT(F.pMax)} down to ${pT(F.pMin)}). The dots are drawn to match, not the donors' values or how many donors each chart has.</p>`,
    network: `<h2 data-at="0.6">Next: a network</h2>
      ${turns(`<p data-at="1.2" data-out="17">Where things lie matters too. Make each object a node, and link objects that lie close together: a spatial neighbor network.</p>
        <p data-at="9" data-out="17">As the ovary ages, the network changes: follicles' nodes go, scars' nodes come.</p>
        <p class="note" data-at="12.5" data-out="17">Drawn as an illustration of the poster's next step, not its result.</p>`,
      `<p data-at="17.5">Next, the authors plan to ${esc(listOf(F.future))}.</p>
        <p class="amber" data-at="22">This is where network medicine comes in: as in Tissue and time, a tissue becomes a network of neighbors.</p>
        <p class="credits" data-at="26">${esc(creditText())}</p>
        <p data-at="29"><button class="btn primary" id="btnGoExplore" type="button">Explore the ovary</button></p>
        <p class="credits" data-at="30.5">Drawn, not GTEx images: the ovary, the slides and the sections. Illustrative: the dots of the charts and the network.</p>`)}`,
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
    organ_grow: 0, organ_body: 1, organ_open: 0, organ_age: 25, organ_side: 0, organ_follicle: 0, organ_albicans: 0, organ_vessel: 0, organ_luteum: 0, organ_parts: 0, organ_agelab: 0,
    section_age: 26, section_pair: 0, section_vessel: 0, section_macrophage: 0, section_albicans: 0, section_follicle: 0, section_cyst: 0,
    section_tiles: 0, section_feat: 0, section_forest: 0, section_pred: 0, section_mask: 0, section_net: 0,
    charts_slides: 0, charts_hist: 0, charts_trend: 0, charts_sweep: 20, charts_focus: 0, charts_rf: 1, charts_seg: 1, charts_band: 0, charts_cmp: 0, charts_side: 0, charts_score: 0, charts_iou: 0 });
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
  show('charts', a + 0.5, a + 2.5);
  ramp('charts_slides', a + 1, a + 10, 0, 1);
  cam(a + 1, 'charts', 'fan', -8);
  cam(a + 11, 'charts', 'fan', 6, 'spin');
  ramp('charts_hist', a + 13, a + 23, 0, 1);
  cam(a + 14, 'charts', 'hist', -4);
  cam(b - 0.5, 'charts', 'hist', 8, 'spin');
  // What's in a section: one kind picked out after another with its count; all four; then a younger and an older section
  a = C.section.a; b = C.section.b;
  hide('charts', a, a + 2);
  jump('charts_slides', a + 2.2, 1, 0); jump('charts_hist', a + 2.2, 1, 0);
  show('section', a + 0.5, a + 2.5);
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
  // Two methods: tiles, their features, the forest's vote, the predictions; then SegFormer's masks; then the scores
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
  hide('section', a + 48, a + 50);
  jump('section_mask', a + 50.2, 1, 0);
  show('charts', a + 48.5, a + 50.5);
  ramp('charts_score', a + 49.5, a + 53, 0, 1);
  ramp('charts_iou', a + 52, a + 55, 0, 1);
  cam(a + 49, 'charts', 'scores', -6);
  cam(b - 0.5, 'charts', 'scores', 6, 'spin');
  // Trends with age: the four charts on the right sweep from 20 to 70 while the ovary on the left ages along; then the
  // follicles up close (behind a short fade, so no other chart passes through the middle)
  a = C.trends.a; b = C.trends.b;
  ramp('charts_score', a, a + 2, 1, 0); ramp('charts_iou', a, a + 2, 1, 0);
  ramp('charts_trend', a + 1, a + 4, 0, 1);
  ramp('charts_side', a, a + 3, 0, 1);
  jump('organ_grow', a, 0, 1); jump('organ_body', a, 1, 0); jump('organ_side', a, 0, 1); jump('organ_agelab', a, 0, 1); jump('organ_age', a, 25, 20);
  show('organ', a + 1, a + 3);
  ramp('charts_sweep', a + 5, a + 46, 20, 70);
  ramp('organ_age', a + 5, a + 46, 20, 70);
  cam(a + 1, 'charts', 'side', -6);
  cam(a + 46, 'charts', 'side', 6, 'spin');
  ramp('charts_a', a + 46.3, a + 47.3, 1, 0); hide('organ', a + 46.3, a + 47.3);
  jump('charts_focus', a + 47.4, 0, 3); jump('charts_side', a + 47.4, 1, 0); jump('charts_band', a + 47.4, 0, 1);
  ramp('charts_a', a + 47.5, a + 49, 0, 1);
  cam(a + 47.4, 'charts', 'focus');
  cam(b - 0.5, 'charts', 'focus', 8, 'spin');
  // Do the methods agree: all four charts again (behind a short fade), then they turn into the comparisons
  a = C.agree.a; b = C.agree.b;
  ramp('charts_a', a, a + 1, 1, 0);
  jump('charts_focus', a + 1.1, 3, 0); jump('charts_band', a + 1.1, 1, 0);
  ramp('charts_a', a + 1.2, a + 2.5, 0, 1);
  ramp('charts_cmp', a + 3, a + 10, 0, 1);
  cam(a + 1.1, 'charts', 'trends', -6);
  cam(b - 0.5, 'charts', 'trends', 8, 'spin');
  // Next, a network: the illustrative spatial neighbor network over the section, changing as it ages from 25 to 65
  a = C.network.a; b = C.network.b;
  hide('charts', a, a + 2);
  jump('section_age', a, 26, 25);
  show('section', a + 0.5, a + 2.5);
  ramp('section_net', a + 2, a + 10, 0, 1);
  ramp('section_age', a + 12, a + 28, 25, 65);
  cam(a + 1, 'section', 'net', -6);
  cam(a + 12, 'section', 'net', 2, 'spin');
  cam(b, 'section', 'net', 8, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);
  // the ovary beside the charts takes their turn (the two are one picture there)
  ST.side = [C.trends.a - 1, C.trends.b];

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  a = C.title.a;
  label('organ', 'small', '<b>An ovary</b>one of two', a + 4, a + 10, 'mag');
  a = C.donors.a;
  label('charts', 'fan', `<b>${F.donors} slides</b>one per donor`, a + 5, a + 13, 'cyn');
  a = C.section.a;
  [['vessel', 6, 11.5, 'cyn'], ['macrophage', 12, 17.5, 'grn'], ['albicans', 18, 23.5, 'mag'], ['follicle', 24, 30.5, 'amb']].forEach(([k, t0, t1, cls]) =>
    label('section', k, `<b>${esc(cap(KD[k].name))}</b>${fmt(KD[k].annotated)} marked`, a + t0 + 0.5, a + t1, cls));
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
// (the body and the ovary share one turn: one frame; beside the charts, the ovary takes theirs)
function setYaw(k, t) {
  let c = 0;
  const f = frameOf(k) === 'organ' && ST.side && t >= ST.side[0] && t <= ST.side[1] ? 'charts' : frameOf(k);
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
    // (a label's text may be a function: it follows what the set shows, see labelText)
    const fn = typeof L.text === 'function' ? L.text : null, [b, r] = fn ? fn() : L.text;
    LBL.sets.push({ kind: 'set', el: labelEl(`<b>${esc(b)}</b>${sfxSpan(r)}`, L.cls), set: k, at: L.at, alpha: L.alpha, minor: !!L.minor, o: -1,
      fn, tx: fn ? b + '|' + r : '', none: !b && !r });
  }
}
// a label whose text is a function (the ovary's age, the charts' r) is read again while it shows and redrawn when it
// changes: the HTML label, and the headset's sprite (dropped, so it is made again)
function labelText(L) {
  if (!L.fn) return;
  const [b, r] = L.fn(), s = b + '|' + r;
  if (s === L.tx) return;
  L.tx = s; L.none = !b && !r;
  L.el.innerHTML = `<b>${esc(b)}</b>${sfxSpan(r)}`;
  L.w = 0; L.nar = undefined; dropSprite(L);
}
// a set label shows as far as its set is in and its own rule allows
// (labels a set marks as minor give way on narrow screens)
const setLabelAlpha = (L, S) => {
  const a = S[L.set + '_a'] || 0;
  if (a < 0.5 || (L.minor && !GL.wide && !XR.on)) return 0;
  const v = (2 * a - 1) * clamp(L.alpha ? L.alpha(S) : 1, 0, 1);
  if (v > 0) labelText(L);
  return L.none ? 0 : v;
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
