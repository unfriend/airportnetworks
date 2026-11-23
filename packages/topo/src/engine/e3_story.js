//#use head
// ================================================================== STORY ==
// Narration timing: [time in the recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands on
// the matching sentence. The story is narrated by a synthetic voice
// (packages/topo/audio/narration.mp3, Kokoro's af_heart): node tools/voice/narrate.mjs
// topo writes this table and NARRATION_ENDS from the recording it makes (each
// stretch lasts the longer of 1.1 times its story time and its line's audio
// plus a pause); run it again after the text changes (see
// tools/voice/README.md).
const NARRATION_SYNC = [
  [0, 0], [1.32, 1.2], [3.81, 2.4], [6.45, 4], [13.39, 9], [22.19, 17], [30.97, 21],  // Where cells sit
  [45.27, 34], [46.57, 35.18], [48.15, 35.2], [52.21, 38], [72.01, 56], [77.98, 59], [80.78, 61],
  [91.21, 61.3],                                      // Which scale?
  [91.98, 62], [93.28, 63.18], [94.92, 63.2], [99.73, 67], [103.03, 70], [112.11, 76], [144.01, 105],
  [149.76, 108], [150.42, 108.6], [170.6, 111.3],     // Balls grow
  [171.37, 112], [172.66, 113.18], [174.56, 113.2], [204.04, 140], [210.56, 143], [213.54, 145],
  [221.9, 152.6], [239.02, 159.3],                    // The tower
  [239.79, 160], [241.09, 161.18], [243.46, 161.2], [251.73, 166], [258.24, 171], [269.9, 181.6],
  [274.76, 183], [275.42, 183.6], [279.44, 184.5], [286.59, 191], [294.88, 198], [310.49, 205.3],  // 123 slides
  [311.26, 206], [312.56, 207.18], [314.46, 207.2], [320.84, 213], [328.06, 217], [343.02, 230.6],
  [346.87, 231], [347.53, 231.6], [351.68, 232.5], [352.34, 233.1], [356.07, 234], [359.94, 236],
  [360.6, 236.6], [372.22, 240], [378.8, 244], [379.46, 244.6], [397.29, 251.3],  // Which scales
  [398.06, 252], [399.36, 253.18], [401.32, 253.2], [411.83, 262], [431.19, 279.6], [433.95, 280],
  [447.15, 292], [464.55, 301.3],                     // Every cell
  [465.32, 302], [466.62, 303.18], [468.71, 303.2], [478.28, 310], [478.94, 310.6], [491.99, 314],
  [492.65, 314.6], [508.08, 320], [530.08, 340],      // What next
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { title: 43.05, scale: 91, balls: 170.35, tower: 238.8, cohort: 310.25, scales: 397.05, cells: 464.35, next: 520.2 };
//#use storyT narrT T_END
const CH = [
  { key: 'title', name: 'Where cells sit', a: 0, b: 34 },
  { key: 'scale', name: 'Which scale?', a: 34, b: 62 },
  { key: 'balls', name: 'Balls grow', a: 62, b: 112 },
  { key: 'tower', name: 'The tower', a: 112, b: 160 },
  { key: 'cohort', name: '123 slides', a: 160, b: 206 },
  { key: 'scales', name: 'Which scales', a: 206, b: 252 },
  { key: 'cells', name: 'Every cell', a: 252, b: 302 },
  { key: 'next', name: 'What next', a: 302, b: 340 },
];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
//#use C DEF
// the engine's own params beside the sets' (DEF): the liver's (see makeLiver)
const DEF_MORE = { liver_a: 0, liver_lift: 0, liver_slice: 0 };
// params eased on the poster's log ruler of the radius (TDATA.u in, TDATA.rOf out), in the story and in explore: the
// sets' own (a set lists them as log) and the map's radius; none run at an even pace
const LOG = new Set(['map_r']), LIN = new Set();
//#use buildDefaults TR key ramp
// a radius eased on the log ruler: between u(v0) and u(v1), back to µm
const logMix = (v0, v1, x) => (v0 > 0 && v1 > 0 ? TDATA.rOf(TDATA.u(v0) + (TDATA.u(v1) - TDATA.u(v0)) * x) : v0 + (v1 - v0) * x);
//#use evalTrack storyState fadeVal ST view fitShift
// views whose parts reach under the side panel or off the right edge on a landscape screen: a little further back,
// or their target moved, so they fit beside the panel (added to the set's own view, in story and explore mode alike)
// (measured at 1280 x 760: each view's parts between the panel's right edge and the screen's, above the timeline; the
// sets' own views fill a whole screen, so most stand back a little and move their target left of the parts' middle)
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
//#use narrowOf
// on a screen held sideways but too narrow for the side panel (the panel below, the scene in a strip above it, see
// lowK) the tall tower comes closer and is centred in the strip: [distance factor, the target's shift up]
// (measured at 640 x 400: the tower about as tall as the strip, its plate's label end left under the panel; the board
// and the cohort's low views brought closer)
const LOW = { tower: { plate: [1, -0.2], snap: [1, -0.2], tower: [0.95, -0.38], default: [0.95, -0.38], bars: [0.72, -0.3] },
  cohort: { default: [0.7, -0.2], rack: [0.8, -0.1], means: [0.9, 0], shapes: [1, -0.15], stacks: [0.78, -0.1] } };
//#use LOW1 lowOf anchorOf
// ------------------------------------------------------------------- data --
// Every number the story shows is topocyte's (TOPO_DATA), looked up through TDATA: counts of stored bars, sums of
// stored shares, stored scores. Nothing scientific is computed here.
const D = TOPO_DATA, T = TDATA, P = D.patch, SD = D.slide;
//#use f2
const f2s = v => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2);   // a share or a score with its sign
//#use pct
// a radius in µm as the poster prints its snapshots (two decimals; whole above 60)
const fmtR = r => (!Number.isFinite(r) ? '∞' : r >= 60 ? String(Math.round(r)) : r >= 10 ? r.toFixed(1).replace(/\.0$/, '') : r.toFixed(2));
const fmtR2 = r => (!Number.isFinite(r) ? '∞' : r.toFixed(2));
//#use word
const plural = (n, one, many) => `${n === 1 ? 'one' : fmt(n)} ${n === 1 ? one : many}`;
const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');

// ------------------------------------------------------------------ facts --
// Numbers the story quotes, all from TOPO_DATA
const FACTS = (() => {
  const H = D.h1, conf = H.confusion, W = D.poster.windows, c50 = SD.comp50, ti = n => c50.types.indexOf(n);
  const w = W.map(([r0, r1]) => ({ r0, r1, s: T.share(1, r0, r1) })), gap = H.shares.gap;
  return {
    slides: D.labels.length, healthy: D.src.healthy, cirrhosis: D.src.cirrhosis, cellsM: (D.src.cells / 1e6).toFixed(1),
    minutes: D.src.runtime.minutes, tile: T.tile.n, tileSide: D.tile.side,
    patch: T.patch.n, snaps: P.snaps.map((r, k) => ({ r, pieces: P.betti[k][0], loops: P.betti[k][1] })), loop: P.loop, loops: P.h1.length / 2,
    // the loops alive at the second snapshot besides the big one (the stored loops, longest first): how many, and the
    // radius by which they have all filled in
    others: (() => { const r = P.snaps[1], o = P.loops.slice(1).filter(L => L.b <= r && r < L.d); return { n: o.length, by: Math.max(0, ...o.map(L => L.d)) }; })(),
    fve: H.fve, w, rest: gap - w.reduce((s, x) => s + x.s, 0), gap, odds: Math.exp(gap),
    right: conf[0] + conf[3], hRight: conf[0], cRight: conf[3], hN: conf[0] + conf[1], cN: conf[2] + conf[3], acc: H.accuracy,
    window: T.slide.n, newCells: SD.overview.cells, score: SD.e.logOdds, delta: 50, train: SD.train, limit: SD.limit50,
    sizes: c50.sizes, sizes100: SD.comp100.sizes,
    lymph: [c50.healthy[ti('Lymphocytes')], c50.cirrhosis[ti('Lymphocytes')]], fib: [c50.healthy[ti('Fibroblasts')], c50.cirrhosis[ti('Fibroblasts')]],
  };
})();
// the credits: the last chapter's small print and explore's About note (the Scenes pane, page and headset)
const AUTH = 'Simon Schindler, André Rendeiro and Jörg Menche';
const INSTS = 'Ludwig Boltzmann Institute for Network Medicine at the University of Vienna; University of Vienna; CeMM Research Center for Molecular Medicine of the Austrian Academy of Sciences; Medical University of Vienna; Max Perutz Labs, Vienna BioCenter';
const CELLS_CREDIT = 'The cells: the GTEx project\'s liver slides, segmented by the authors with HistoPLUS (CC BY 4.0); slides are numbered, never named.';
const SITE = 'topocyte.lab.lbi-netmed.com';
const ABOUT = `After the poster "topocyte: scale-resolved topological phenotyping of tissue architecture across spatial modalities" by ${AUTH} (${INSTS}). ${CELLS_CREDIT} ${SITE}`;
//#use inkCol swCol
// the story's colours (SPEC.md, "Look"): balls and highlights cyan, pieces amber, loops orange, the two classes, the
// second shape green
const CYAN = '#46d9ff', AMBER = '#ffb43b', ORANGE = '#ff7a3c', RED = '#ff7a6b', BLUE = '#7cc0ff', GREEN = '#3ee08f', GREY = '#8e98ab';

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
      `<p data-at="17">A computer can find every cell in a stained slide: here, ${F.cellsM} million of them in ${F.slides} slides of liver.</p>
        <p data-at="21">Other ways of measuring tissue, reading genes in spots or staining proteins in colour, also show where the cells are.</p>
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
        <p class="note" data-at="27">Scale-resolved means every radius at once, with no size to choose. Next come the ${F.patch} cells of the small square in the middle of this healthy tile.</p>`)}`,
    balls: `<h2 data-at="0.6">Balls grow</h2>
      ${turns(`<p data-at="1.2" data-out="13.5">Take the ${F.patch} cells of that square, and keep only where they sit.</p>
        <p data-at="5" data-out="13.5">Grow a ball round every cell.</p>
        <p data-at="8" data-out="13.5" class="amber">Where two balls touch, the cells are joined by an edge; where three meet, a triangle fills in, giving a network that also has triangles.</p>`,
      `<ul class="steps">${F.snaps.map((s, k) => step(SNAP_AT[k], 0, k ? (s.r < ld ? ORANGE : AMBER) : AMBER, `At ${fmtR2(s.r)} µm`, esc(cap(snapSay(s))))).join('')}</ul>
        <p class="note" data-at="46">The network with triangles is called the alpha complex. It is a simplicial complex, the higher-order generalisation of a network. The radii and counts are the poster's snapshots; ${word(F.snaps[1].loops)} loops are alive at ${fmtR2(F.snaps[1].r)} µm: the big one, and ${word(F.others.n)} others that have all filled in by ${fmtR(F.others.by)} µm.</p>`)}`,
    tower: `<h2 data-at="0.6">The tower of scales</h2>
      ${turns(`<p data-at="1.2" data-out="27.5">Now let the radius become height.</p>
        <p data-at="4" data-out="27.5">Each piece is a thread rising from its cell; where two pieces join, their threads merge, until one trunk is left.</p>
        <p data-at="12" data-out="27.5" class="amber">Each loop is a chimney, from the height where it closes to where it fills.</p>
        <p data-at="19" data-out="27.5">The glass plane rises with the radius: it cuts the tower where the network is at that radius.</p>`,
      `<p data-at="28">How long each piece and each loop lives is a bar; how many are alive at each height gives two curves.</p>
        <div class="facts"><div data-at="31">${big(AMBER, fmt(F.patch))}<small>pieces, a bar each</small></div><div data-at="33">${big(ORANGE, fmt(F.loops))}<small>loops, at most ${word(most)} at once</small></div></div>
        <p data-at="36" class="amber">Together they describe the tissue at every scale at once.</p>
        <p class="note" data-at="40">This is persistent homology. Pieces are H0, the connected components, and loops H1, the holes; the bars are the barcode, and the counts the Betti curves, exact step functions. The filtration's value t is r squared; the story shows the radius r.</p>`)}`,
    cohort: `<h2 data-at="0.6">${F.slides} slides</h2>
      ${turns(`<p data-at="1.2" data-out="20.5">Do this for every slide: ${F.healthy} healthy livers and ${F.cirrhosis} with cirrhosis, where scars cut the liver into knots.</p>
        <p data-at="6" data-out="20.5">Each slide gets its own curves; here are its loops, small radii on the left, large on the right.</p>
        <p data-at="11" data-out="20.5">Scaled to the same size, only their shape counts.</p>
        <p data-at="16" data-out="20.5" class="amber">The healthy slides' average is in blue, the cirrhotic slides' in red.</p>`,
      `<p data-at="21">Comparing every slide with every other finds the main shapes the curves vary by:</p>
        <div class="facts"><div data-at="23">${big(CYAN, pct(F.fve[0]))}<small>of the variation in loops lies in shape 1</small></div><div data-at="24.5">${big(GREEN, pct(F.fve[1]))}<small>in shape 2</small></div></div>
        <p data-at="31" class="amber">Each slide becomes a point by how much of each shape it has, and healthy and cirrhotic slides separate before anything is trained.</p>
        <p class="note" data-at="38">The curves get cosine normalisation, and the functional PCA is computed exactly from the bars' ends, with no grid. All ${F.slides} slides and ${F.cellsM} million cells took ${F.minutes} minutes on a laptop's processor.</p>`)}`,
    scales: `<h2 data-at="0.6">Which scales matter</h2>
      ${turns(`<p data-at="1.2" data-out="23.5">A classifier draws a wall between the two clouds.</p>
        <p data-at="7" data-out="23.5">Each slide moves to its log-odds: how far it lies on the cirrhosis side of the wall, or the healthy side.</p>
        <p data-at="11" data-out="23.5" class="amber">Read back through the shapes, it becomes a weight for every radius: loops alive at ${wa.r0} to ${wb.r1} µm speak for cirrhosis.</p>`,
      `<p data-at="24">What each stretch of radii adds to the difference between the two groups:</p>
        <div class="facts"><div data-at="25">${big(RED, f2s(wa.s))}<small>from loops of ${wa.r0} to ${wa.r1} µm</small></div><div data-at="26.5">${big(RED, f2s(wb.s))}<small>from ${wb.r0} to ${wb.r1} µm</small></div><div data-at="28">${big(BLUE, f2s(F.rest))}<small>from the other radii</small></div></div>
        <p data-at="30">Together they add up to ${f2(F.gap)} in log-odds: on average, a cirrhotic slide's odds of cirrhosis are about ${fmt(F.odds)} times a healthy slide's.</p>
        <p data-at="34" class="amber">Tested fairly, on slides it never saw, it gets ${F.right} of ${F.slides} right.</p>
        <p class="note" data-at="38">The classifier is a logistic regression on the first four scores; its weight per radius is gamma of r. In five-fold cross-validation it gets ${F.hRight} of ${F.hN} healthy and ${F.cRight} of ${F.cN} cirrhotic slides right, an accuracy of ${F.acc.toFixed(3)}.</p>`)}`,
    cells: `<h2 data-at="0.6">Every cell a centre</h2>
      ${turns(`<p data-at="1.2" data-out="26.5">Now take a slide the classifier never saw: ${fmt(F.newCells)} cells, and a window of ${fmt(F.window)} of them.</p>
        <p data-at="10" data-out="26.5">Pick one cell and look only at the cells within ${F.delta} µm of it.</p>
        <p data-at="15" data-out="26.5">They make their own small network, with its own pieces and loops,</p>
        <p data-at="21" data-out="26.5" class="amber">and their own curves.</p>`,
      `<p data-at="27">The classifier gives the cell a score of its own:</p>
        <div class="facts"><div data-at="28">${big(F.score < 0 ? BLUE : RED, f2s(F.score))}<small>its log-odds, so ${F.score < 0 ? 'healthy' : 'cirrhosis'}-like</small></div></div>
        <p data-at="33" class="amber">Do this for every cell, and the slide becomes a map: the scars light up red, the healthy tissue blue.</p>
        <p class="note" data-at="40">This is local persistent homology: the slide's network restricted to each cell's neighbourhood. The shapes and the classifier were fitted for the pieces, H0, on the other ${F.train} slides. The colours are the poster's, at most ${f2(F.limit)} either way.</p>`)}`,
    next: `<h2 data-at="0.6">Where analysis begins</h2>
      ${turns(`<p data-at="1.2" data-out="17.5">The cells now fall into two groups: ${fmt(F.sizes[1])} cirrhosis-like and ${fmt(F.sizes[0])} healthy-like.</p>
        <p data-at="8" data-out="17.5">The groups can be compared in whatever was measured: here, the cirrhosis-like cells hold ${more(F.lymph)} lymphocytes, ${pct(F.lymph[1])} against ${pct(F.lymph[0])}, and ${more(F.fib)} fibroblasts, ${pct(F.fib[1])} against ${pct(F.fib[0])}.</p>
        <p class="note" data-at="12" data-out="17.5">The types are the labels of the computer that found the cells, not a pathologist's. With a radius of 100 µm, as in the poster's figure, the groups have ${fmt(F.sizes100[0])} healthy-like and ${fmt(F.sizes100[1])} cirrhosis-like cells.</p>`,
      `<p data-at="18">In spatial transcriptomics it would be genes, and in spatial proteomics, proteins.</p>
        <p data-at="25" class="amber">Four calls of topocyte, and the shape of tissue becomes something to measure.</p>
        <p data-at="28"><button class="btn primary" id="btnGoExplore" type="button">Explore the shape of tissue</button></p>
        <p class="credits" data-at="29">After the poster by ${AUTH} (${INSTS}).</p>
        <p class="credits" data-at="30">${esc(CELLS_CREDIT)} The genes and proteins are sketches of the workflow, not data. ${SITE} Narration: a synthetic voice (Kokoro).</p>`)}`,
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
  // ---- sound effects (sfxCue: story time, a sound, where it comes from, its options), beside the keys above: a cue just
  // before the line it goes with, textures under the voice soft
  a = C.title.a;
  sfxCue(a + 0.3, 'rise', 'body', null, { gain: 0.4 });                              // the body
  sfxCue(a + 3.5, 'whoosh', 'body', 'liver', { dur: 5, pitch: 0.8 });                // the liver lifts out and turns
  sfxCue(a + 8.8, 'whoosh', 'body', 'liver', { dur: 0.6, pitch: 1.5 });              // a thin slice
  sfxCue(a + 15.2, 'knock', 'slide', 'tile', { pitch: 1.4, gain: 0.4 });             // it lies flat on its glass
  sfxCue(a + 20.8, 'whoosh', 'slide', 'spots', { dur: 1.5 });                        // other modalities sweep in
  sfxCue(a + 25.3, 'whoosh', 'slide', 'fluo', { dur: 1.5, pitch: 1.15 });
  sfxCue(a + 29.3, 'patter', 'slide', 'points', { dur: 2, pitch: 1.3 });             // every cell becomes a bead
  a = C.scale.a;
  [4, 11, 17].forEach((s, i) => sfxCue(a + s - 0.2, 'step', 'slide', 'square', { pitch: Math.pow(2, 3 * i / 12) }));   // three fixed scales
  sfxCue(a + 23, 'pick', 'slide', 'patch');                                          // the poster's patch
  a = C.balls.a;
  sfxCue(a + 3, 'grow', 'tower', 'plate', { dur: 5, pitch: 1.4 });                   // cells shrink into beads
  SNAP_AT.forEach((s, k) => sfxCue(a + s - 0.2, 'pulse', 'tower', 'plate', { pitch: Math.pow(2, 2 * k / 12) }));   // the balls stop at the poster's four snapshots
  sfxCue(a + 45.8, 'whoosh', 'tower', 'plate');                                      // the radius to 60 µm
  a = C.tower.a;
  sfxCue(a + 1, 'rise', 'tower', 'top', { dur: 9 });                                 // the tower rises
  sfxCue(a + 11.8, 'whoosh', 'tower', 'plane', { dur: 5, pitch: 1.2 });              // the plane sweeps up
  sfxCue(a + 17, 'link', 'tower', 'hole');                                           // the big loop just closed
  sfxCue(a + 29, 'grow', 'tower', 'bars', { dur: 11, pitch: 0.8, gain: 0.35 });      // the barcode
  a = C.cohort.a;
  sfxCue(a + 0.4, 'clink', 'cohort', 'rack');                                        // 123 glass slides
  sfxCue(a + 1.5, 'grow', 'cohort', 'rack', { dur: 14, gain: 0.3 });                 // their curves light one after another
  sfxCue(a + 21.8, 'whoosh', 'cohort', 'phi1');                                      // the two main shapes
  sfxCue(a + 30.8, 'patter', 'cohort', 'cube', { dur: 6, gain: 0.4 });               // slides fly into the cube of scores
  a = C.scales.a;
  sfxCue(a + 0.8, 'rise', 'cohort', 'wall');                                         // the classifier's wall
  sfxCue(a + 11, 'grow', 'cohort', 'ruler', { dur: 12, gain: 0.3 });                 // the weight for every radius
  sfxCue(a + 25, 'patter', 'cohort', 'zero', { dur: 7, pitch: 0.7, gain: 0.3 });     // bands drop into the gap
  sfxCue(a + 34, 'ratchet', 'cohort', 'stack1', { n: 12, dur: 8, gain: 0.4 });       // the held-out stacks
  a = C.cells.a;
  sfxCue(a + 0.3, 'clink', 'slide', 'window');                                       // a new slide
  sfxCue(a + 4, 'whoosh', 'slide', 'window', { dur: 6 });                            // the zoom
  sfxCue(a + 11, 'pick', 'map', 'cell');                                             // one cell
  sfxCue(a + 13, 'grow', 'map', 'dome', { dur: 8, pitch: 1.2, gain: 0.4 });          // its network grows with the balls
  sfxCue(a + 26.8, 'ping', 'map', 'score');                                          // its score
  sfxCue(a + 32.8, 'rise', 'map', 'sweep', { dur: 10, gain: 0.4 });                  // every cell scored, a relief
  a = C.next.a;
  sfxCue(a + 2, 'whoosh', 'map', 'healthy', { dur: 8 });                             // the two groups and their piles
  sfxCue(a + 17.8, 'whoosh', 'map', 'genes', { dur: 2 });                            // the genes sketch
  sfxCue(a + 24.8, 'whoosh', 'map', 'proteins', { dur: 2, pitch: 1.15 });            // the proteins sketch
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say: the liver and its slice)
  a = C.title.a;
  label('body', () => GL.liver.at.liver, '<b>The liver</b>', a + 5, a + 10.5, '');
  label('body', () => GL.liver.at.slice, '<b>A thin slice</b> · laid on glass', a + 9.5, a + 12.6, 'amb');
}
// no set turns into another at a hand-over (buildCamera's MORPH)
const MORPH = {};
//#use buildCamera setYaw smoothSeg spinEase
// the story's view at time t: [az, el, dist, tx, ty, tz, narrow factor, FIT's target shift x, y, z, and LOW's two]
// (in a headset the tower of scales stands tall while it is the scene, see standView)
const storyCam = t => (XR.on ? standView(storyView(t), standW(t)) : storyView(t));
//#use storyView
// In a headset the tower of scales stands tall in front of you while it is the scene (chapters 3 and 4): the story's
// view eases into the tower set's `stand` (about 1.5 m tall, the plate low and the trunk's top above your eyes),
// keeping the story's turn. Its axis stands STAND_BACK (in the set's units) further off than the view's target, so that
// nothing of it comes within 0.35 m of your eyes (the tower set's manifest: 0.38 m at the closest for the story's
// turns from -60 to 60 degrees, the board more than 0.9 m away). The weight follows the story's time alone, so at a
// shared-room station everyone sees the same size. On a screen nothing changes.
const STAND_BACK = 0.2;
//#use standW
function standView(v, w) {
  if (w <= 0) return v;
  const s = view('tower', 'stand'), A = v[0] * D2R;
  s[3] += STAND_BACK * Math.sin(A); s[5] += STAND_BACK * Math.cos(A);   // (towards you: the target nearer, the axis further)
  v[1] += (s[1] - v[1]) * w;
  v[2] = Math.exp(Math.log(v[2]) + (Math.log(s[2]) - Math.log(v[2])) * w);
  for (let i = 3; i < 6; i++) v[i] += (s[i] - v[i]) * w;
  return v;
}

//#use LBL labelEl label sfxSpan buildSetLabels labelText setLabelAlpha~2 _v labelPos _placed placeLabels curCh
//#use updateStoryDOM trackHTML buildTimeline ICON_PLAY ICON_PAUSE lastTick updateTimeline