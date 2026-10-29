
// ================================================================== STORY ==
// TODO(soil B): copied from the tissue topology story. Replaced already: NARRATION_SYNC (a 1:1 placeholder), CH (the
// eight chapters of SPEC.md), LOG, the engine's own defaults (the hop), logMix, the data and FACTS, the credits.
// Still the topo story's, marked TODO(soil B) where they stand: FIT, NARROW and LOW (measure them for the soil
// story's views), buildStory (the chapters' text and keys), the story labels, the stand view (here: the field's
// `stand`, in a headset in chapters 4 and 5, or none: SPEC.md, "The engine").
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Until a narration is recorded, the table sets the
// pace: node tools/pace.mjs writes it from the words on the panel (each stretch
// between two cues lasts long enough to read what appeared at its start; run
// it again after the text changes). A recording replaces it with its own times.
const NARRATION_SYNC = [
  [0, 0], [460, 460],   // TODO(soil B): a placeholder; node tools/pace.mjs <url> --write soil sets it once the story
                        // is in HOST.list (the integrator), from the panel's words
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
  { key: 'title', name: 'Half the sack', a: 0, b: 45 },
  { key: 'relay', name: 'The relay underground', a: 45, b: 100 },
  { key: 'bni', name: 'A wheat that fights back', a: 100, b: 150 },
  { key: 'trial', name: 'The field trial', a: 150, b: 210 },
  { key: 'leaks', name: 'Greener, fewer leaks', a: 210, b: 285 },
  { key: 'crowd', name: 'A crowd of 100,000', a: 285, b: 340 },
  { key: 'together', name: 'Who rises together', a: 340, b: 415 },
  { key: 'know', name: 'What we know', a: 415, b: 460 },
];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
const C = Object.fromEntries(CH.map(c => [c.key, c]));

// every param of every set, at rest; the sets themselves start hidden (and the engine's hop, see makeHop)
const DEF = {};
// params eased on a log scale in the story and in explore (a set lists its own as log): none of the engine's
const LOG = new Set([]);
function buildDefaults() {
  for (const k of SET_ORDER) Object.assign(DEF, GL.sets[k].params);
  for (const k of SET_ORDER) DEF[k + '_a'] = 0;
  DEF.hop_a = 0; DEF.hop_t = 0;
  for (const k of SET_ORDER) for (const n of GL.sets[k].log || []) LOG.add(n);
}
const TR = {};
const key = (n, t, v) => { (TR[n] = TR[n] || []).push([t, v]); };
const ramp = (n, t0, t1, v0, v1) => { key(n, t0, v0); key(n, t1, v1); };
// a value eased on a log scale: between log(v0) and log(v1)
const logMix = (v0, v1, x) => (v0 > 0 && v1 > 0 ? Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * x) : v0 + (v1 - v0) * x);
function evalTrack(n, t) {
  const ks = TR[n];
  if (!ks) return DEF[n];
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const [t0, v0] = ks[i - 1], [t1, v1] = ks[i];
      if (t1 <= t0) return v1;
      return LOG.has(n) ? logMix(v0, v1, smooth((t - t0) / (t1 - t0))) : v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
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

const ST = { labels: [], items: [], stand: [] };
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
// (measured at 1280 x 760: each view's parts between the panel's right edge and the screen's, above the timeline; the
// sets' own views fill a whole screen, so most stand back a little and move their target left of the parts' middle)
// TODO(soil B): FIT, NARROW and LOW below are the topo story's: measure the soil story's views (SPEC.md).
const FIT = {
  tower: { bars: [0, 0, 0.8, -0.3, 0, 0] },
  cohort: { stacks: [0, 0, 0.4, -0.25, 0, 0] },
  map: { relief: [0, 0, 0.3, -0.15, 0, 0] },
};
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen (measured at 390 x 760, the scene's pixels against the strip above the panel: the patch's 110
// cells across the width, the tower with its ruler and the board beside it, the cohort's shapes, scores and wall)
const NARROW = { tower: { plate: 1.15, snap: 1.15, tower: 1.25, default: 1.25, bars: 1.32 },
  cohort: { shapes: 1.25, space: 1.2, wall: 1.2, odds: 1.2 } };
const narrowOf = (k, name) => (NARROW[k] && NARROW[k][name]) || 1;
// on a screen held sideways but too narrow for the side panel (the panel below, the scene in a strip above it, see
// lowK) the tall tower comes closer and is centred in the strip: [distance factor, the target's shift up]
// (measured at 640 x 400: the tower about as tall as the strip, its plate's label end left under the panel; the board
// and the cohort's low views brought closer)
const LOW = { tower: { plate: [1, -0.2], snap: [1, -0.2], tower: [0.95, -0.38], default: [0.95, -0.38], bars: [0.72, -0.3] },
  cohort: { default: [0.7, -0.2], rack: [0.8, -0.1], means: [0.9, 0], shapes: [1, -0.15], stacks: [0.78, -0.1] } };
const LOW1 = [1, 0];
const lowOf = (k, name) => (LOW[k] && LOW[k][name]) || LOW1;
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

// ------------------------------------------------------------------- data --
// Every number the story shows is the trial's (SOIL_DATA), looked up through SDATA, or read off the slides' charts
// (SOIL_DATA.figs: say "read off the slides"). Nothing scientific is computed here.
// TODO(soil B): the helpers below are the topo story's; keep the ones the soil story uses.
const D = SOIL_DATA, SD = SDATA;
const f2 = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
const f2s = v => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2);   // a share or a score with its sign
const pct = v => (Number.isFinite(+v) ? `${Math.round(100 * v)} %` : '–');
// a radius in µm as the poster prints its snapshots (two decimals; whole above 60)
const fmtR = r => (!Number.isFinite(r) ? '∞' : r >= 60 ? String(Math.round(r)) : r >= 10 ? r.toFixed(1).replace(/\.0$/, '') : r.toFixed(2));
const fmtR2 = r => (!Number.isFinite(r) ? '∞' : r.toFixed(2));
const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] || String(n);
const plural = (n, one, many) => `${n === 1 ? 'one' : fmt(n)} ${n === 1 ? one : many}`;
const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');

// ------------------------------------------------------------------ facts --
// Numbers the story quotes, all from SOIL_DATA (SPEC.md, "The data")
// TODO(soil B): extend with every number the text shows; never type one in.
const FACTS = (() => {
  const N = D.net, sp = N.splits, F = D.figs;
  return {
    samples: D.src.samples, kinds: D.src.kinds, reads: D.src.reads, common: D.common.n, readShare: D.common.readShare,
    plots: D.design.plots, dates: D.design.times.length, dap: D.design.times.map(t => t.dap), days: D.design.times.map(t => t.day),
    nodes: N.n, links: N.links, pos: N.pos, modules: N.modules, big: N.mods.filter(m => m.n >= 100).length, nullLinks: N.null.links,
    byLine: D.common.diff.line, byFert: D.common.diff.fert, byTime: D.common.diff.time, byPlot: D.common.diff.plot,
    lineLinks: sp.line.map(x => x.links), lineDiff: sp.lineDiff, randomDiff: sp.randomDiff, randomN: sp.random.length,
    thresholds: N.thresholds, nitrosospira: D.guilds.nsp.byFert, archaea: D.guilds.aoa.byFert,
    chl70: F.chl70[0].map(o => o.v), n2oPeakDay1: F.n2o.peaks[0][1], n2oMeta: D.meta.n2o.line.byFert[1],
  };
})();
// the credits: the last chapter's small print and explore's About note (the Scenes pane, page and headset)
const AUTH = 'Marina Montserrat Díez, Tadashi Yoshihashi, Guntur Subbarao Ventaka, Eleftheria Bachtsevani, Dimitrios Karpouzas, Christina Hazard, Melina Kerou and Christa Schleper';
const INSTS = 'University of Vienna (Vienna Doctoral School of Ecology and Evolution; Archaea Biology and Ecogenomics); University of Thessaly; Université Lyon 1 Claude Bernard; JIRCAS (Japan International Research Center for Agricultural Sciences)';
const DATA_CREDIT = 'The field trial\'s data (16S amplicon reads, field measurements) used with the authors\' permission; the kinds of microbe are numbered, never named by their ids. Values from the slides\' charts were read off them by two readers. The soil block, the relay, the chromosome and the field\'s layout are illustrative. The co-occurrence network was built for this story with a standard method.';
// TODO(soil B): the credits as the authors want them (SPEC.md, "Open questions"); the wheat line: Subbarao et al., PNAS (the slides' reference)
const ABOUT = `After the slides "Exploring the Effects of Biological Nitrification Inhibition on the Rhizosphere Microbiome of a BNI-enabled Winter Wheat" by ${AUTH} (${INSTS}). ${DATA_CREDIT}`;
// colours as text on the HTML panel, which is light in the light theme: a colour mixed with the panel's ink (darker on
// a light panel, lighter on a dark one). The headset's panel is dark: its canvas twin takes the colour itself (data-col).
const inkCol = c => `color-mix(in srgb, ${c} 55%, var(--ink))`;
const swCol = c => c;   // a swatch or a bar in the same colour
// the story's colours (SPEC.md, "Look"): balls and highlights cyan, pieces amber, loops orange, the two classes, the
// second shape green
const CYAN = '#46d9ff', AMBER = '#ffb43b', ORANGE = '#ff7a3c', RED = '#ff7a6b', BLUE = '#7cc0ff', GREEN = '#3ee08f', GREY = '#8e98ab';

// TODO(soil B): buildStory below is the topo story's, as the pattern: write the soil story's chapters (SPEC.md,
// "Chapters"): their panel text from FACTS, the sets' keys and the camera waypoints; then the story labels.
function buildStory() {
  const F = FACTS, most = (GL.sets.tower.api().most || {}).loops || 0;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  const hide = (k, t0, t1) => ramp(k + '_a', t0, t1, 1, 0);
  // jump an index param (a pick, a layout) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const step = (at, out, col, b, text) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  // a big number in a colour of its own (the headset's canvas reads data-col)
  const big = (col, v) => `<b data-col="${col}" style="color:${inkCol(col)}">${v}</b>`;
  // ------------------------------------------------------------ panel copy
  // parts of a chapter that take turns in one place, each fading out (data-out) as the next comes: the headset's
  // panel cannot scroll, so no chapter shows more than fits at once
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  // the poster's four snapshots in words, from their stored counts and the big loop's stored birth and death
  const [lb, ld] = F.loop;
  const snapSay = s => {
    const n = s.pieces, one = n === 1;
    if (s.r < lb) return `${fmt(n)} separate pieces`;
    if (s.r < ld) return T.u(s.r) - T.u(lb) < 0.05 ? `${one ? 'one piece' : `${fmt(n)} pieces`} left, and a big loop has just closed round an empty space`
      : `${one ? 'it is all one piece' : `${fmt(n)} pieces`}, the big loop still open inside`;
    return `${one ? 'still one piece' : `${fmt(n)} pieces`}, and the big loop has filled`;
  };
  const SNAP_AT = [14, 25, 35, 43];   // (as the radius reaches each snapshot, below)
  // two stored shares [healthy-like, cirrhosis-like] compared in words, as the percentages shown read
  const more = ([h, c]) => (Math.round(100 * c) === Math.round(100 * h) ? 'about as many' : c > h ? 'more' : 'fewer');
  const [wa, wb] = F.w;
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">The shape of tissue</h1>
      <p class="lede" data-at="2.4">Topology of cells in the liver</p>
      ${turns(`<p data-at="4" data-out="16.5">Under the microscope, a slice of liver is a crowd of cells, and where they sit says how healthy the tissue is.</p>
        <p data-at="9" data-out="16.5" class="amber">Here a thin slice is cut from a liver and laid on glass.</p>`,
      `<p data-at="17">A computer can find every cell in a stained slide: ${F.cellsM} million of them in ${F.slides} slides of liver here.</p>
        <p data-at="21">Other ways of measuring tissue, reading genes in spots or staining proteins in colour, also give where the cells are.</p>
        <p data-at="29.5" class="amber">From here on, only those positions count.</p>
        <p class="credits" data-at="31">After the poster by ${AUTH}. The cells were found by the authors with HistoPLUS in the GTEx project's slides; topocyte reads cells from any spatial modality (H&amp;E, spatial transcriptomics, spatial proteomics) as an AnnData.</p>`)}`,
    scale: `<h2 data-at="0.6">Which scale?</h2>
      ${turns(`<p data-at="1.2" data-out="21.5">To read how cells are arranged, most tools pick one scale:</p>
        <ul class="steps">
          ${step(4, 21.5, CYAN, 'One patch size', 'cut the tissue into squares, and read each square')}
          ${step(11, 21.5, CYAN, 'A neighbour count', 'join each cell to its nearest few, here six')}
          ${step(17, 21.5, CYAN, 'One radius', 'look only at the cells within a fixed distance')}
        </ul>`,
      `<p data-at="22">But tissue has structure at every scale, from a cell's neighbours to the shape of a whole lobule.</p>
        <p data-at="25" class="amber">topocyte reads all of them at once.</p>
        <p class="note" data-at="27">Scale-resolved: every radius at once, with no size to choose. Next, the ${F.patch} cells of the small square in the middle of this healthy tile.</p>`)}`,
    balls: `<h2 data-at="0.6">Balls grow</h2>
      ${turns(`<p data-at="1.2" data-out="13.5">Take the ${F.patch} cells of that square, and keep only where they sit.</p>
        <p data-at="5" data-out="13.5">Grow a ball round every cell.</p>
        <p data-at="8" data-out="13.5" class="amber">Where two balls touch, the cells are joined by an edge; where three meet, a triangle fills in: a network that also has triangles.</p>`,
      `<ul class="steps">${F.snaps.map((s, k) => step(SNAP_AT[k], 0, k ? (s.r < ld ? ORANGE : AMBER) : AMBER, `${fmtR2(s.r)} µm`, esc(cap(snapSay(s))))).join('')}</ul>
        <p class="note" data-at="46">The network with triangles is the alpha complex, a simplicial complex: the higher-order generalisation of a network. The radii and counts are the poster's snapshots; ${word(F.snaps[1].loops)} loops are alive at ${fmtR2(F.snaps[1].r)} µm: the big one, and ${word(F.others.n)} others that have all filled in by ${fmtR(F.others.by)} µm.</p>`)}`,
    tower: `<h2 data-at="0.6">The tower of scales</h2>
      ${turns(`<p data-at="1.2" data-out="27.5">Now let the radius become height.</p>
        <p data-at="4" data-out="27.5">Each piece is a thread rising from its cell; where two pieces join, their threads merge, until one trunk is left.</p>
        <p data-at="12" data-out="27.5" class="amber">Each loop is a chimney, from the height where it closes to where it fills.</p>
        <p data-at="19" data-out="27.5">The glass plane rises with the radius: it cuts the tower where the network is at that radius.</p>`,
      `<p data-at="28">How long each piece and each loop lives is a bar; how many are alive at each height gives two curves.</p>
        <div class="facts"><div data-at="31">${big(AMBER, fmt(F.patch))}<small>pieces, a bar each</small></div><div data-at="33">${big(ORANGE, fmt(F.loops))}<small>loops, at most ${word(most)} at once</small></div></div>
        <p data-at="36" class="amber">Together they describe the tissue at every scale at once.</p>
        <p class="note" data-at="40">This is persistent homology. Pieces are H0 (connected components), loops H1 (holes); the bars are the barcode, and the counts the Betti curves, exact step functions. The filtration's value is t = r²; the story shows the radius r.</p>`)}`,
    cohort: `<h2 data-at="0.6">${F.slides} slides</h2>
      ${turns(`<p data-at="1.2" data-out="20.5">Do this for every slide: ${F.healthy} healthy livers and ${F.cirrhosis} with cirrhosis, where scars cut the liver into knots.</p>
        <p data-at="6" data-out="20.5">Each slide gets its own curves: here its loops, small radii on the left, large on the right.</p>
        <p data-at="11" data-out="20.5">Scaled to the same size, only their shape counts.</p>
        <p data-at="16" data-out="20.5" class="amber">The healthy slides' average in blue, the cirrhotic slides' in red.</p>`,
      `<p data-at="21">Comparing every slide with every other finds the main shapes the curves vary by:</p>
        <div class="facts"><div data-at="23">${big(CYAN, pct(F.fve[0]))}<small>of the variation in loops: shape 1</small></div><div data-at="24.5">${big(GREEN, pct(F.fve[1]))}<small>shape 2</small></div></div>
        <p data-at="31" class="amber">Each slide becomes a point by how much of each shape it has, and healthy and cirrhotic slides fall apart before anything is trained.</p>
        <p class="note" data-at="38">Cosine normalisation; the functional PCA, computed exactly from the bars' ends (no grid). All ${F.slides} slides and ${F.cellsM} million cells took ${F.minutes} minutes on a laptop's processor.</p>`)}`,
    scales: `<h2 data-at="0.6">Which scales matter</h2>
      ${turns(`<p data-at="1.2" data-out="23.5">A classifier draws a wall between the two clouds.</p>
        <p data-at="7" data-out="23.5">Each slide moves to its log-odds: how far it lies on the cirrhosis side of the wall, or the healthy side.</p>
        <p data-at="11" data-out="23.5" class="amber">Read back through the shapes, it becomes a weight for every radius: loops alive at ${wa.r0} to ${wb.r1} µm speak for cirrhosis.</p>`,
      `<p data-at="24">What each stretch of radii adds to the difference between the two groups:</p>
        <div class="facts"><div data-at="25">${big(RED, f2s(wa.s))}<small>loops of ${wa.r0} to ${wa.r1} µm</small></div><div data-at="26.5">${big(RED, f2s(wb.s))}<small>${wb.r0} to ${wb.r1} µm</small></div><div data-at="28">${big(BLUE, f2s(F.rest))}<small>the other radii</small></div></div>
        <p data-at="30">Together: ${f2(F.gap)} in log-odds: on average, a cirrhotic slide's odds of cirrhosis are about ${fmt(F.odds)} times a healthy slide's.</p>
        <p data-at="34" class="amber">Tested fairly, on slides it never saw, it gets ${F.right} of ${F.slides} right.</p>
        <p class="note" data-at="38">A logistic regression on the first four scores; γ(r) is its weight per radius. Five-fold cross-validation: ${F.hRight} of ${F.hN} healthy and ${F.cRight} of ${F.cN} cirrhotic slides right, accuracy ${F.acc.toFixed(3)}.</p>`)}`,
    cells: `<h2 data-at="0.6">Every cell a centre</h2>
      ${turns(`<p data-at="1.2" data-out="26.5">Now a slide the classifier never saw: ${fmt(F.newCells)} cells, and a window of ${fmt(F.window)} of them.</p>
        <p data-at="10" data-out="26.5">Pick one cell and look only at the cells within ${F.delta} µm of it.</p>
        <p data-at="15" data-out="26.5">They make their own small network, with its own pieces and loops,</p>
        <p data-at="21" data-out="26.5" class="amber">and their own curves.</p>`,
      `<p data-at="27">The classifier gives the cell a score of its own:</p>
        <div class="facts"><div data-at="28">${big(F.score < 0 ? BLUE : RED, f2s(F.score))}<small>its log-odds: ${F.score < 0 ? 'healthy' : 'cirrhosis'}-like</small></div></div>
        <p data-at="33" class="amber">Do this for every cell, and the slide becomes a map: the scars light up red, the healthy tissue blue.</p>
        <p class="note" data-at="40">Local persistent homology: the slide's network restricted to each cell's neighbourhood. The shapes and the classifier were fitted on the other ${F.train} slides (pieces, H0). The colours are the poster's, at most ±${f2(F.limit)}.</p>`)}`,
    next: `<h2 data-at="0.6">Where analysis begins</h2>
      ${turns(`<p data-at="1.2" data-out="17.5">The cells now fall into two groups: ${fmt(F.sizes[1])} cirrhosis-like and ${fmt(F.sizes[0])} healthy-like.</p>
        <p data-at="8" data-out="17.5">The groups can be compared in whatever was measured: here, the cirrhosis-like cells hold ${more(F.lymph)} lymphocytes (${pct(F.lymph[1])} against ${pct(F.lymph[0])}) and ${more(F.fib)} fibroblasts (${pct(F.fib[1])} against ${pct(F.fib[0])}).</p>
        <p class="note" data-at="12" data-out="17.5">The types are the labels of the computer that found the cells, not a pathologist's. With a radius of 100 µm, as in the poster's figure, the groups have ${fmt(F.sizes100[0])} healthy-like and ${fmt(F.sizes100[1])} cirrhosis-like cells.</p>`,
      `<p data-at="18">In spatial transcriptomics it would be genes, in spatial proteomics proteins.</p>
        <p data-at="25" class="amber">Four calls of topocyte, and the shape of tissue becomes something to measure.</p>
        <p data-at="28"><button class="btn primary" id="btnGoExplore" type="button">Explore the shape of tissue</button></p>
        <p class="credits" data-at="29">After the poster by ${AUTH} (${INSTS}).</p>
        <p class="credits" data-at="30">${esc(CELLS_CREDIT)} The genes and proteins are sketches of the workflow, not data. ${SITE}</p>`)}`,
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
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name), lowOf(k, name)]);
  };
  start({ body_pet: 1, body_net: 0, body_state: 0, body_blank: 0, liver_lift: 0, liver_slice: 0,
    slide_show: 0, slide_mode: 0, slide_points: 0, slide_scale: 0, slide_patch: 0, slide_over: 0,
    map_cell: 0, map_r: 1.5, map_balls: 0, map_bars: 0, map_score: 0, map_all: 0, map_split: 0, map_omics: 0, map_pick: -1, map_delta: 0,
    tower_r: 1.5, tower_rise: 0, tower_bars: 0, tower_he: 1, tower_lit: 0,
    cohort_dim: 1, cohort_rack: 0, cohort_means: 0, cohort_shapes: 0, cohort_space: 0, cohort_wall: 0, cohort_odds: 0, cohort_stacks: 0,
    cohort_gamma: 0, cohort_gap: 0, cohort_win: 0, cohort_from: 5, cohort_to: 15, cohort_pick: -1 });
  let a, b;
  // Where cells sit: the tour's body, its liver lifting out and turning, a thin slice of it standing inside it, falling
  // flat and growing into the healthy tile on its glass; the cells close; the other modalities sweep in (sketches),
  // then every cell becomes a bead
  a = C.title.a; b = C.title.b;
  show('body', 0.2, 2);
  hide('body', a + 11.5, a + 14);
  ramp('liver_a', a + 2.5, a + 3.5, 0, 1);
  ramp('liver_lift', a + 3.5, a + 8.5, 0, 1);
  ramp('liver_slice', a + 9, a + 12, 0, 0.5);
  ramp('liver_slice', a + 12, a + 15.5, 0.5, 1);
  ramp('liver_a', a + 16, a + 17, 1, 0);
  show('slide', a + 15, a + 16.5);
  ramp('slide_mode', a + 21, a + 23.5, 0, 1);
  ramp('slide_mode', a + 25.5, a + 28, 1, 2);
  ramp('slide_points', a + 29.5, a + 31.5, 0, 1);
  jump('slide_mode', a + 33.5, 2, 0);   // (unseen: every cell is a bead by then)
  const LIV = [0, 6, -2.05, LIVER_OUT[0], LIVER_OUT[1], LIVER_OUT[2]];   // (the body's front view brought close to the lifted liver)
  cam(a, 'body', 'front', -12);
  cam(a + 3.5, 'body', 'front', -4, 'spin');
  cam(a + 8.5, 'body', 'front', -6, null, LIV);
  cam(a + 12, 'body', 'front', 4, 'spin', LIV);
  cam(a + 15.5, 'slide', 'tile', 0);
  cam(a + 18, 'slide', 'close', 0);
  cam(a + 20.5, 'slide', 'tile', -6);
  cam(b - 0.5, 'slide', 'tile', 6, 'spin');
  // Which scale?: back to H&E, the three fixed scales on the tile in turn, then the poster's patch marked
  a = C.scale.a; b = C.scale.b;
  ramp('slide_points', a + 1, a + 3, 1, 0);
  ramp('slide_scale', a + 4, a + 6, 0, 1);
  ramp('slide_scale', a + 11, a + 13, 1, 2);
  ramp('slide_scale', a + 17, a + 19, 2, 3);
  ramp('slide_scale', a + 22, a + 23.5, 3, 0);
  ramp('slide_patch', a + 23, a + 25, 0, 1);
  hide('slide', a + 26, a + 28);
  cam(a + 1.5, 'slide', 'tile', -4);
  cam(a + 5, 'slide', 'square', 0);
  cam(a + 10, 'slide', 'square', 6, 'spin');
  cam(a + 12, 'slide', 'hub', 0);
  cam(a + 16, 'slide', 'hub', 6, 'spin');
  cam(a + 18, 'slide', 'circle', 0);
  cam(a + 21.5, 'slide', 'circle', 6, 'spin');
  cam(a + 24, 'slide', 'patch', 0);
  cam(a + 26.5, 'slide', 'patch', 3, 'spin');
  // Balls grow: the patch's 110 cells in H&E shrink into beads; balls grow round them, the radius stopping at the
  // poster's four snapshots (eased on its log ruler: tower_r is one of the tower set's log params)
  a = C.balls.a; b = C.balls.b;
  show('tower', a - 2, a + 1);
  ramp('tower_he', a + 3, a + 8, 1, 0);
  key('tower_r', a + 8, 1.5);
  F.snaps.forEach((s, k) => ramp('tower_r', a + SNAP_AT[k] - [3, 6, 5, 4][k], a + SNAP_AT[k], k ? F.snaps[k - 1].r : 1.5, s.r));
  ramp('tower_r', a + 46, a + 48.5, F.snaps[3].r, 60);
  ST.stand.push([a + 1, a + 4.5, C.tower.b - 4, C.tower.b - 0.5]);   // (in a headset: the tower stands tall through chapters 3 and 4)
  cam(a + 0.5, 'tower', 'snap', 0);
  cam(a + 4, 'tower', 'plate', -8);
  cam(a + 10, 'tower', 'plate', 4, 'spin');
  cam(a + 13, 'tower', 'snap', -6);
  cam(b - 1.5, 'tower', 'snap', 10, 'spin');
  // The tower of scales: the radius back to its start as the tower rises, then the plane sweeping up through it,
  // stopping where the big loop has just closed and where it is still open; the barcode and the two curves
  a = C.tower.a; b = C.tower.b;
  ramp('tower_rise', a + 1, a + 10, 0, 1);
  ramp('tower_r', a + 2, a + 10, 60, 1.5);
  ramp('tower_r', a + 12, a + 17, 1.5, F.snaps[1].r);
  ramp('tower_r', a + 20, a + 24, F.snaps[1].r, F.snaps[2].r);
  ramp('tower_r', a + 26, a + 29, F.snaps[2].r, 60);
  ramp('tower_bars', a + 29, a + 40, 0, 1);
  hide('tower', b - 2, b + 1);
  cam(a + 1, 'tower', 'tower', -10);
  cam(a + 10, 'tower', 'tower', 8, 'spin');
  cam(a + 12, 'tower', 'default', 0);
  cam(a + 28, 'tower', 'default', 22, 'spin');
  cam(a + 30, 'tower', 'bars', 0);
  cam(b - 1.5, 'tower', 'bars', 10, 'spin');
  // 123 slides: the rack and its curves lighting one after another, the classes' means, the two main shapes, then the
  // slides fly into the cube of their scores
  a = C.cohort.a; b = C.cohort.b;
  show('cohort', a - 2, a + 1);
  ramp('cohort_rack', a + 1, a + 16, 0, 1);
  ramp('cohort_means', a + 16, a + 19, 0, 1);
  ramp('cohort_shapes', a + 22, a + 26, 0, 1);
  ramp('cohort_space', a + 31, a + 41, 0, 1);
  cam(a + 0.5, 'cohort', 'default', -10);
  cam(a + 5, 'cohort', 'rack', -6);
  cam(a + 15, 'cohort', 'rack', 6, 'spin');
  cam(a + 17.5, 'cohort', 'means', 0);
  cam(a + 21, 'cohort', 'means', 4, 'spin');
  cam(a + 23.5, 'cohort', 'shapes', -4);
  cam(a + 30, 'cohort', 'shapes', 4, 'spin');
  cam(a + 33, 'cohort', 'space', -6);
  cam(b - 0.5, 'cohort', 'space', 10, 'spin');
  // Which scales matter: the wall, the log-odds, the weight per radius on the column, the windows' bands dropping into
  // the gap; then the column goes and the slides drop into the four stacks of the held-out test
  a = C.scales.a; b = C.scales.b;
  ramp('cohort_wall', a + 1, a + 6, 0, 1);
  ramp('cohort_odds', a + 7, a + 11, 0, 1);
  ramp('cohort_gamma', a + 11, a + 23, 0, 1);
  ramp('cohort_gap', a + 25, a + 32, 0, 1);
  ramp('cohort_gamma', a + 32, a + 34, 1, 0);
  ramp('cohort_stacks', a + 34, a + 42, 0, 1);
  hide('cohort', b - 2, b + 1);
  cam(a + 1.5, 'cohort', 'wall', 0);
  cam(a + 6, 'cohort', 'wall', 4, 'spin');
  cam(a + 7.5, 'cohort', 'odds', 0);
  cam(a + 11, 'cohort', 'odds', 4, 'spin');
  cam(a + 13, 'cohort', 'gamma', 0);
  cam(a + 23, 'cohort', 'gamma', 6, 'spin');
  cam(a + 25, 'cohort', 'gap', 0);
  cam(a + 32, 'cohort', 'gap', 4, 'spin');
  cam(a + 35, 'cohort', 'stacks', -6);
  cam(b - 1, 'cohort', 'stacks', 8, 'spin');
  // Every cell a centre: the new slide whole on its glass, the zoom into the window, one cell under its dome (its
  // network growing with the balls, its bars, its score), then the dome sweeping the window into a relief
  a = C.cells.a; b = C.cells.b;
  jump('slide_show', a - 1, 0, 1); jump('slide_over', a - 1, 0, 1); jump('slide_patch', a - 1, 1, 0);
  show('slide', a, a + 2);
  ramp('slide_over', a + 4, a + 10, 1, 0);
  show('map', a + 10, a + 11);
  ramp('map_cell', a + 11, a + 13.5, 0, 1);
  key('map_r', a + 11, 1.5);
  ramp('map_r', a + 13, a + 16.5, 1.5, SD.e.drawR);
  ramp('map_r', a + 17, a + 21, SD.e.drawR, 30);
  ramp('map_r', a + 22, a + 26, 30, F.delta);
  ramp('map_balls', a + 12, a + 14, 0, 1);
  ramp('map_balls', a + 19, a + 22, 1, 0);
  ramp('map_bars', a + 21, a + 26, 0, 1);
  ramp('map_score', a + 27, a + 29, 0, 1);
  ramp('map_cell', a + 32, a + 34, 1, 0);
  ramp('map_all', a + 33, a + 46, 0, 1);
  cam(a + 0.5, 'slide', 'over', -6);
  cam(a + 10, 'slide', 'window', 0);
  cam(a + 12, 'map', 'cell', -6);
  cam(a + 14.5, 'map', 'net', 0);
  cam(a + 19.5, 'map', 'net', 6, 'spin');
  cam(a + 23, 'map', 'bars', 0);
  cam(a + 26.5, 'map', 'bars', 4, 'spin');
  cam(a + 28, 'map', 'score', 0);
  cam(a + 32, 'map', 'score', 4, 'spin');
  cam(a + 34.5, 'map', 'sweep', 0);
  cam(a + 41, 'map', 'sweep', 4, 'spin');
  cam(a + 43, 'map', 'relief', -4);
  cam(b - 0.5, 'map', 'relief', 10, 'spin');
  // Where analysis begins: the cells lift off into their two groups and their piles by type; then the sketches of the
  // other modalities (genes, then proteins)
  a = C.next.a; b = C.next.b;
  ramp('map_split', a + 2, a + 10, 0, 1);
  ramp('map_omics', a + 18, a + 22, 0, 1);
  ramp('map_omics', a + 25, a + 29, 1, 2);
  cam(a + 2, 'map', 'split', -6);
  cam(a + 16, 'map', 'split', 8, 'spin');
  cam(a + 18.5, 'map', 'omics', -4);
  cam(b - 0.5, 'map', 'omics', 10, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // TODO(soil B): the story's own labels (the hop's Vienna and Japan, the soil block's parts the set does not label).
  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say: the liver and its slice)
  a = C.title.a;
  label('body', () => GL.liver.at.liver, '<b>The liver</b>', a + 5, a + 10.5, '');
  label('body', () => GL.liver.at.slice, '<b>A thin slice</b> · laid on glass', a + 9.5, a + 12.6, 'amb');
}
// camera waypoints: [t, az, el, dist, tx, ty, tz, ease, set, narrow factor, FIT's target shift, LOW]; 'spin' segments turn at
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
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7], w[9] || 1, w[10], w[11]];
  });
}
// the turn a set has at story time t: that of its latest stay on show (it starts fading in a little before its first view)
// (the slide and the map share one turn: one frame)
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
// the story's view at time t: [az, el, dist, tx, ty, tz, narrow factor, FIT's target shift x, y, z, and LOW's two]
// (in a headset the tower of scales stands tall while it is the scene, see standView)
const storyCam = t => (XR.on ? standView(storyView(t), standW(t)) : storyView(t));
function storyView(t) {
  const wp = ST.wp, end = w => [w[1], w[2], w[3], w[4], w[5], w[6], w[8], ...w[9], ...w[10]];
  if (t <= wp[0][0]) return end(wp[0]);
  for (let i = 1; i < wp.length; i++) {
    if (t <= wp[i][0]) {
      const p = wp[i - 1], q = wp[i], x = q[0] > p[0] ? (q[7] === 'spin' ? spinEase : smoothSeg)(t - p[0], q[0] - p[0]) : 1, f = p[9], g = q[9], l = p[10], m = q[10];
      return [p[1] + (q[1] - p[1]) * x, p[2] + (q[2] - p[2]) * x, Math.exp(Math.log(p[3]) + (Math.log(q[3]) - Math.log(p[3])) * x),
        p[4] + (q[4] - p[4]) * x, p[5] + (q[5] - p[5]) * x, p[6] + (q[6] - p[6]) * x, p[8] + (q[8] - p[8]) * x,
        f[0] + (g[0] - f[0]) * x, f[1] + (g[1] - f[1]) * x, f[2] + (g[2] - f[2]) * x, l[0] + (m[0] - l[0]) * x, l[1] + (m[1] - l[1]) * x];
    }
  }
  return end(wp[wp.length - 1]);
}

// TODO(soil B): the stand view below is the topo story's tower: for the soil story either the field set's `stand`
// (life size: the plots round you, chapters 4 and 5) or nothing (standW returning 0). SPEC.md, "Headset".
// In a headset the tower of scales stands tall in front of you while it is the scene (chapters 3 and 4): the story's
// view eases into the tower set's `stand` (about 1.5 m tall, the plate low and the trunk's top above your eyes),
// keeping the story's turn. Its axis stands STAND_BACK (in the set's units) further off than the view's target, so that
// nothing of it comes within 0.35 m of your eyes (the tower set's manifest: 0.38 m at the closest for the story's
// turns from -60 to 60 degrees, the board more than 0.9 m away). The weight follows the story's time alone, so at a
// shared-room station everyone sees the same size. On a screen nothing changes.
const STAND_BACK = 0.2;
// ST.stand: [t0, t1, t2, t3], in over t0..t1 and out over t2..t3 (story time)
const standW = t => ST.stand.reduce((w, [t0, t1, t2, t3]) => Math.max(w, Math.min(smooth((t - t0) / (t1 - t0)), smooth((t3 - t) / (t3 - t2)))), 0);
function standView(v, w) {
  if (w <= 0) return v;
  const s = view('tower', 'stand'), A = v[0] * D2R;
  s[3] += STAND_BACK * Math.sin(A); s[5] += STAND_BACK * Math.cos(A);   // (towards you: the target nearer, the axis further)
  v[1] += (s[1] - v[1]) * w;
  v[2] = Math.exp(Math.log(v[2]) + (Math.log(s[2]) - Math.log(v[2])) * w);
  for (let i = 3; i < 6; i++) v[i] += (s[i] - v[i]) * w;
  return v;
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
// a label whose text is a function (the radius and its counts, a slide picked, a window's share, a cell's score) is read again
// while it shows and redrawn when it changes: the HTML label, and the headset's sprite (dropped, so it is made again)
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
