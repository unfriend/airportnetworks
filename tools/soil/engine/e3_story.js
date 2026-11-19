//#use head
// ================================================================== STORY ==
// Narration timing: [time in the recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands on
// the matching sentence. The story is narrated by a synthetic voice
// (audio/narration-soil.mp3, Kokoro's af_heart): node tools/voice/narrate.mjs
// soil writes this table and NARRATION_ENDS from the recording it makes (each
// stretch lasts the longer of 1.1 times its story time and its line's audio
// plus a pause); run it again after the text changes (see
// tools/voice/README.md).
const NARRATION_SYNC = [
  [0, 0], [1.98, 1.8], [4.18, 2.4], [7.62, 5],        // Half the sack
  [51.62, 45], [52.92, 46.18], [54.91, 46.2], [99.79, 87], [106, 91], [106.66, 91.6], [125.71, 99.3],  // The relay
  [126.48, 100], [127.78, 101.18], [129.87, 101.2], [139.72, 109], [168.32, 135], [173.55, 139],
  [174.21, 139.6], [200.49, 149.3],                   // A wheat fights back
  [201.26, 150], [202.56, 151.18], [204.33, 151.2], [247.01, 190], [249.43, 191.5], [251.41, 193],
  [255.37, 196.6], [289.7, 209.3],                    // The field trial
  [290.47, 210], [291.77, 211.18], [293.78, 211.2], [303.02, 219.6], [305.91, 220.5], [308.54, 222],
  [329, 240.6], [332.98, 241.5], [335.79, 243], [350.58, 252], [362.24, 262.6], [366.14, 263.5],
  [369.99, 267], [405.22, 284.3],                     // Greener, fewer leaks
  [405.99, 285], [407.29, 286.18], [409.85, 286.2], [419.5, 294], [443.7, 316], [451.78, 323],
  [452.44, 323.6], [456.1, 324.5], [458.58, 326], [462.54, 329.6], [493.51, 339.3],  // A crowd of 100,000
  [494.28, 340], [495.58, 341.18], [497.54, 341.2], [507.88, 350.6], [510.56, 351.5], [568.31, 404],
  [571.63, 407], [572.29, 407.6], [604.47, 414.3],    // Who rises together
  [605.24, 415], [606.54, 416.18], [608.05, 416.2], [619.61, 425], [636.11, 440], [662.92, 459.3],
  [663.69, 460],                                      // What we know
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { title: 50.15, relay: 125.5, bni: 200.25, trial: 289.5, leaks: 405, crowd: 493.3, together: 604.25, know: 662.7 };
//#use storyT narrT T_END
const CH = [
  { key: 'title', name: 'Half the sack', a: 0, b: 45 },
  { key: 'relay', name: 'The relay', a: 45, b: 100 },
  { key: 'bni', name: 'A wheat fights back', a: 100, b: 150 },
  { key: 'trial', name: 'The field trial', a: 150, b: 210 },
  { key: 'leaks', name: 'Greener, fewer leaks', a: 210, b: 285 },
  { key: 'crowd', name: 'A crowd of 100,000', a: 285, b: 340 },
  { key: 'together', name: 'Who rises together', a: 340, b: 415 },
  { key: 'know', name: 'What we know', a: 415, b: 460 },
];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
//#use C
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
//#use TR key ramp
// a value eased on a log scale: between log(v0) and log(v1)
const logMix = (v0, v1, x) => (v0 > 0 && v1 > 0 ? Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * x) : v0 + (v1 - v0) * x);
//#use evalTrack~2 storyState fadeVal ST~2 view fitShift
// views whose parts reach under the side panel or off the right edge on a landscape screen: a little further back,
// or their target moved, so they fit beside the panel (added to the set's own view, in story and explore mode alike)
// (measured at 1280 x 760: each view's parts between the panel's right edge and the screen's, above the timeline; the
// sets' own views fill a whole screen, so the wide ones stand back a little and move their target left of the parts'
// middle: the network split in two or three, the field with its jars on the bench and its stack behind)
const FIT = {
  net: { split: [0, 0, 0.5, -0.1, 0, 0] },
  field: { default: [0, 0, 0.35, -0.2, 0, 0.05], jars: [0, 0, 0.2, 0, 0, 0] },
  web: { globe: [0, 0, 1.8, 0, 0, 0] },
};
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen (the split network, the field with its bench)
const NARROW = { net: { split: 1.55, module: 1.15 }, field: { default: 1.25, plots: 1.2, stack: 1.2, cloud: 1.15 }, soil: { default: 1.15 } };
//#use narrowOf
// on a screen held sideways but too narrow for the side panel (the panel below, the scene in a strip above it, see
// lowK): [distance factor, the target's shift up]
const LOW = { soil: { default: [0.95, -0.1], plant: [0.9, -0.1] }, field: { stack: [0.9, -0.1] }, net: { cloud: [0.8, 0], core: [0.9, 0], net: [0.85, 0], module: [0.8, 0.1], split: [0.9, 0] } };
//#use LOW1 lowOf anchorOf
// ------------------------------------------------------------------- data --
// Every number the story shows is the trial's (SOIL_DATA), looked up through SDATA, or read off the slides' charts
// (SOIL_DATA.figs: said "read off the slides"). Nothing scientific is computed here.
const D = SOIL_DATA, SD = SDATA;
//#use pct word cap
// a value as the panes print it: a measure to its own precision, '–' where none was measured
const num = (v, d) => (v === null || v === undefined || !Number.isFinite(+v) ? '–' : (+v).toFixed(d));
const pTxt = p => (p === null || p === undefined || !Number.isFinite(+p) ? '' : p < 0.001 ? 'p < 0.001' : `p = ${(+p).toFixed(p < 0.01 ? 3 : 2)}`);
// a whole number of thousands ("about 100,000")
const thousands = n => fmt(Math.round(n / 1000) * 1000);

// ------------------------------------------------------------------ facts --
// Numbers the story quotes, all from SOIL_DATA (SPEC.md, "The data")
const FACTS = (() => {
  const N = D.net, sp = N.splits, F = D.figs, M = D.meta, ds = D.design;
  const big = N.mods.map((m, i) => i).filter(i => N.mods[i].n >= 100);
  const top = m => { const r = N.mods[m].r2; let b = 'fert'; for (const k of ['time', 'line', 'plot']) if (r[k] > r[b]) b = k; return b; };
  const qp = /p = ([\d.]+)/.exec(F.qpcrNote || '');
  return {
    samples: D.src.samples, kinds: D.src.kinds, perSample: D.src.kindsPerSample, reads: D.src.reads, common: D.common.n, readShare: D.common.readShare,
    plots: ds.plots, reps: ds.reps, dates: ds.times.length, dap: ds.times.map(t => t.dap), days: ds.times.map(t => t.day), stages: ds.times.map(t => t.stage),
    kgN: ds.ferts[1].kgN, nodes: N.n, links: N.links, pos: N.pos, neg: N.neg, modules: N.modules, big: big.length, nullLinks: N.null.links,
    bigFert: big.filter(m => top(m) === 'fert').length, bigPlot: big.filter(m => top(m) === 'plot').length,
    lineR2: Math.max(...big.map(m => N.mods[m].r2.line)),
    byLine: D.common.diff.line, byFert: D.common.diff.fert, byTime: D.common.diff.time, byPlot: D.common.diff.plot,
    lineLinks: sp.line.map(x => x.links), lineDiff: sp.lineDiff, randomDiff: sp.randomDiff, randomN: sp.random.length, randomMore: sp.randomMore,
    thresholds: N.thresholds, cuts: N.cuts, residual: N.residual, nitrosospira: D.guilds.nsp.byFert, archaea: D.guilds.aoa.byFert,
    chl70: F.chl70[0].map(o => o.v), no3d24: M.no3.line.byGroup[1 * 5 + 2], n2oPeak: F.n2o.peaks[0][1], n2oDcd: F.n2o.peaks[0][2],
    n2oMeta: M.n2o.line.byFert[1], n2oMetaDay: [0, 1, 2].map(t => M.n2o.line.byGroup[1 * 5 + t]), qpcrP: qp ? qp[1] : '',
    incubation: F.n2o.incubation, fertNodes: N.fertNodes, fertAll: N.fertAll,
    // when the control wheat's fertilised soil of day 1 peaks in its jar, as a share of the incubation (the jars' clock)
    n2oPeakInc: (c => F.n2o.times[c.indexOf(Math.max(...c))] / F.n2o.times[F.n2o.times.length - 1])(SD.n2o(0, 1, 1)),
  };
})();
// the credits: the last chapter's small print and explore's About note (the Scenes pane, page and headset)
const AUTH = 'Marina Montserrat Díez, Tadashi Yoshihashi, Guntur Subbarao Ventaka, Eleftheria Bachtsevani, Dimitrios Karpouzas, Christina Hazard, Melina Kerou and Christa Schleper';
const INSTS = 'University of Vienna (Vienna Doctoral School of Ecology and Evolution; Archaea Biology and Ecogenomics); University of Thessaly; Université Lyon 1 Claude Bernard; JIRCAS (Japan International Research Center for Agricultural Sciences)';
const DATA_CREDIT = 'The field trial\'s data (16S amplicon reads, field measurements) used with the authors\' permission; the kinds of microbe are numbered by abundance, never named by their ids. Values from the slides\' charts were read off them by two readers. The soil block, the relay, the chromosome and the field\'s layout are illustrative. The co-occurrence network was built for this story with a standard method; it is not the authors\' analysis.';
const ABOUT = `After the slides "Exploring the Effects of Biological Nitrification Inhibition on the Rhizosphere Microbiome of a BNI-enabled Winter Wheat" by ${AUTH} (${INSTS}). The BNI wheat: Subbarao et al., PNAS. ${DATA_CREDIT}`;
//#use inkCol swCol
// the story's colours (SPEC.md, "Look", SLOOK): the two wheat lines, the three regimes, nitrogen as it moves, the guilds
const CYAN = '#46d9ff', AMBER = '#ffb43b', RED = '#ff7a6b', BLUE = '#7cc0ff', GREEN = '#3ee08f', GREY = '#8e98ab';
const LINE_COL = SLOOK.LINE, FERT_COL = SLOOK.FERT;
const LINE_NAME = ['BNI wheat', 'Control wheat'], FERT_NAME = ['Not fertilised', 'Fertilised', 'Fertilised + DCD'];

function buildStory() {
  const F = FACTS;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  const hide = (k, t0, t1) => ramp(k + '_a', t0, t1, 1, 0);
  // jump an index param (a pick, a date) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const step = (at, out, col, b, text) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  // a big number in a colour of its own (the headset's canvas reads data-col)
  const big = (col, v) => `<b data-col="${col}" style="color:${inkCol(col)}">${v}</b>`;
  // (out: where a part that takes turns with the next fades out)
  const fact = (at, col, v, small, out) => `<div data-at="${at}"${out ? ` data-out="${out}"` : ''}>${big(col, v)}<small>${small}</small></div>`;
  const legend = (items, out) => `<ul class="legend">${items.map(([at, col, t]) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''}><span class="sw" style="background:${swCol(col)}"></span>${t}</li>`).join('')}</ul>`;
  // ------------------------------------------------------------ panel copy
  // parts of a chapter that take turns in one place, each fading out (data-out) as the next comes: the headset's
  // panel cannot scroll, so no chapter shows more than fits at once
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const G = SLOOK.GUILD, [cB, cC] = F.chl70, [nB, nC] = F.no3d24, [oB, oC] = F.n2oPeak, d1 = F.days[0], dL = F.days[F.days.length - 1];
  const n1 = v => (Math.round(v * 10) / 10).toFixed(1);
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">Holding on to nitrogen</h1>
      <p class="lede" data-at="2.4">A wheat, its soil and the microbes in between</p>
      ${turns(`<p data-at="5" data-out="21.5">Less than half of the fertiliser a farmer spreads ends up in the crop.</p>
        <p data-at="12" data-out="21.5" class="amber">The plant takes up some of it; microbes in the soil get to much of the rest first.</p>`,
      `<p data-at="22">They turn it into nitrate, which washes away, and into nitrous oxide, a strong greenhouse gas.</p>
        <p data-at="30" class="amber">So farmers spread more.</p>
        <p class="note" data-at="33">The slides put it as "less than 50 per cent". The flows in this block are a drawing: ammonium is amber, nitrate blue, nitrous oxide lilac and nitrogen in the plant green.</p>
        <p class="credits" data-at="35">After the slides by Marina Montserrat Díez and colleagues (University of Vienna, JIRCAS, University of Thessaly, Université Lyon 1) and their field trial's data.</p>`)}`,
    relay: `<h2 data-at="0.6">The relay underground</h2>
      ${turns(`<p data-at="1.2" data-out="41.5">Inside the soil, microbes pass the nitrogen on, like runners in a relay.</p>
        <ul class="steps">
          ${step(9, 41.5, G.aoa, 'Archaea', 'they turn ammonium into nitrite')}
          ${step(17, 41.5, G.nsp, 'Bacteria', 'they do the same')}
          ${step(25, 41.5, G.nit, 'Nitrite oxidisers', 'they turn nitrite into nitrate')}
          ${step(34, 41.5, AMBER, 'Comammox', 'a single microbe that does both steps')}
        </ul>`,
      `<p data-at="42">Each hand-off is a step in a network of processes, and at each one nitrogen can leak away.</p>
        <p class="note" data-at="46">This relay is called nitrification. Its runners are ammonia-oxidising archaea and bacteria, or AOA and AOB, nitrite-oxidising bacteria, or NOB, and complete ammonia oxidisers, or comammox. Nitrous oxide escapes along the way. The pore is an illustration.</p>`)}`,
    bni: `<h2 data-at="0.6">A wheat that fights back</h2>
      ${turns(`<p data-at="1.2" data-out="23.5">Some plants release substances from their roots that slow the relay down. This is called biological nitrification inhibition, or BNI.</p>
        <p data-at="9" data-out="23.5" class="amber">Breeders moved a piece of chromosome from a wild grass into the wheat Munal.</p>`,
      `<p data-at="24">The new wheat's roots are meant to slow the first hand-off, so that more ammonium stays where the plant can take it up.</p>
        <p data-at="35" class="amber">Until now the evidence was one bacterium in a dish and one day in a field.</p>
        <p class="note" data-at="39">The wild grass is Leymus racemosus. The BNI wheat, described by Subbarao and colleagues in the journal PNAS, is Munal-BNI, and the control wheat Munal-control, the same wheat without the segment. As for the earlier evidence, root exudates, the substances roots release, slowed one ammonia-oxidising bacterium in a culture, and one field sampling found more nitrogen in the plant and fewer ammonia-oxidising archaea.</p>`)}`,
    trial: `<h2 data-at="0.6">The field trial</h2>
      ${turns(`<p data-at="1.2" data-out="24.5">To test it, the BNI wheat and the control wheat were grown side by side in a field in Japan:</p>
        ${legend([[16, FERT_COL[0], 'with no fertiliser,'], [17.5, FERT_COL[1], 'with fertiliser,'], [19, FERT_COL[2], 'and with fertiliser and a synthetic inhibitor.']], 24.5)}`,
      `<p data-at="25">Five times over ${F.days[F.days.length - 1]} days, soil was taken from the roots in every plot.</p>
        <div class="facts">${fact(40, AMBER, fmt(F.samples), 'samples')}${fact(41.5, CYAN, fmt(F.plots), 'plots')}${fact(43, GREEN, fmt(F.dates), 'dates')}</div>
        <p class="note" data-at="46">The trial is by JIRCAS, a research centre in Japan. The trial's site and year are not given, so the arc ends at JIRCAS's home in Tsukuba. The fertiliser was ${F.kgN} kilograms of nitrogen per hectare, and the inhibitor DCD, which we read as dicyandiamide. Days ${d1} to ${dL} are ${F.dap[0]} to ${F.dap[F.dap.length - 1]} days after planting. ${cap(word(F.reps))} replicates of each were grown. The soil sampled is the soil clinging to the roots, the rhizosphere, and one sample is missing. The plots' layout is illustrative.</p>`)}`,
    leaks: `<h2 data-at="0.6">Greener, fewer leaks</h2>
      ${turns(`<p data-at="1.2" data-out="21.5">At the end of the season the BNI wheat is still green where the control wheat yellows, most clearly without fertiliser.</p>
        <div class="facts">${fact(9, LINE_COL[0], Math.round(cB), `for the BNI wheat on day ${dL}`, 21.5)}${fact(10.5, LINE_COL[1], Math.round(cC), 'for the control wheat', 21.5)}</div>
        <p class="note" data-at="12" data-out="21.5">This is chlorophyll in the leaves of unfertilised plots, measured as SPAD values and read off the slides.</p>`,
      `<p data-at="22" data-out="41.5">With fertiliser there is less nitrate in the soil under it in mid-season.</p>
        <div class="facts">${fact(30, LINE_COL[0], Math.round(nB), `milligrams of nitrogen per kilogram on day ${F.days[2]}`, 41.5)}${fact(31.5, LINE_COL[1], Math.round(nC), 'under the control wheat', 41.5)}</div>
        <p class="note" data-at="33" data-out="41.5">This is nitrate in fertilised plots, the group means of the data, with ${pTxt(F.no3d24[2])}. The slides call it lower from day ${F.days[2]} to day ${F.days[3]}, but only day ${F.days[2]} is starred as significant.</p>`,
      `<p data-at="42">And soil from its roots, given ammonium in a jar, gives off far less nitrous oxide, close to what the synthetic inhibitor achieves.</p>
        <div class="facts">${fact(52, LINE_COL[0], n1(oB), 'parts per million at the peak for the BNI wheat')}${fact(53.5, LINE_COL[1], n1(oC), `for the control wheat on day ${d1}`)}</div>
        <p class="note" data-at="57">This is fertilised soil, read off the slides, which give the incubation as ${esc(F.incubation.replace(/ \(slide text\)$/, '').replace(/^(\d+) mg N\/kg soil \(NH4\)2SO4, (\d+)% water content, (\d+) days incubation$/, '$1 milligrams of nitrogen per kilogram of soil, given as ammonium sulphate, at $2 per cent water content, for $3 days'))}. There is an open question. The data's own nitrous oxide value, "the potential amount of produced nitrous oxide", given without a unit, shows no clear difference over the season, ${F.n2oMeta[0].toFixed(2)} against ${F.n2oMeta[1].toFixed(2)}, with ${pTxt(F.n2oMeta[2])}. How the two measurements relate is not known yet.</p>`)}`,
    crowd: `<h2 data-at="0.6">A crowd of ${thousands(F.kinds)}</h2>
      ${turns(`<p data-at="1.2" data-out="23.5">Across the ${fmt(F.samples)} samples, this soil holds about ${thousands(F.kinds)} kinds of microbe, some ${fmt(Math.round(F.perSample / 100) * 100)} in a typical sample.</p>
        <p data-at="9" data-out="23.5" class="amber">${fmt(F.common)} of them make up ${pct(F.readShare)} of the DNA that was read.</p>`,
      `<p data-at="24">Fertiliser roughly doubles one ammonia-eating bacterium, Nitrosospira.</p>
        <p data-at="31">The wheat line barely shows: only ${word(F.byLine)} of the ${fmt(F.common)} common kinds differ between the two wheats.</p>
        <div class="facts">${fact(38, FERT_COL[1], fmt(F.byFert), 'differ by fertiliser')}${fact(39.5, GREY, fmt(F.byTime), 'by date')}${fact(41, LINE_COL[0], fmt(F.byLine), 'by wheat line')}</div>
        <p class="note" data-at="44">The kinds of microbe are amplicon sequence variants, or ASVs, from 16S rRNA gene reads, numbered by abundance. Nitrosospira makes up ${F.nitrosospira.map(v => v.toFixed(2)).join(', ')} per cent of reads without fertiliser, with it, and with DCD. Gene counts of the ammonia oxidisers, measured by qPCR and read off the slides, differ little between the wheats, with one marginal p value of ${F.qpcrP}.</p>`)}`,
    together: `<h2 data-at="0.6">Who rises together</h2>
      ${turns(`<p data-at="1.2" data-out="30.5">Link two kinds of microbe when their numbers rise and fall together across the samples.</p>
        <div class="facts">${fact(10, CYAN, fmt(F.nodes), 'kinds', 30.5)}${fact(11.5, CYAN, fmt(F.links), 'links', 30.5)}</div>
        <p data-at="19" data-out="30.5" class="amber">Shuffle the samples, and not one link is left: the pattern is real.</p>`,
      `<p data-at="31" data-out="54.5">The network's groups follow the fertiliser and the field's plots; the wheat barely shows.</p>
        <p class="note" data-at="40" data-out="54.5">Of about ${word(F.big)} big groups, called modules, ${word(F.bigFert)} rise and fall with the fertiliser and ${word(F.bigPlot)} with the plots. The wheat line explains under ${Math.max(1, Math.ceil(F.lineR2 * 100))} per cent of any big group's ups and downs.</p>`,
      `<p data-at="55">Split by wheat line, the two networks differ no more than two random halves of the samples do.</p>
        <p data-at="64" class="amber">And rising together is not working together.</p>
        <p class="note" data-at="67">This network was built for this story and is not the authors' analysis. It uses the ${fmt(F.common)} common kinds, centred log-ratios, Spearman's correlation of at least 0.6 with a false discovery rate under 5 per cent, and Louvain modules. The two wheat lines' own networks have ${fmt(F.lineLinks[0])} and ${fmt(F.lineLinks[1])} links, and the halves of ${fmt(F.randomN)} random splits differ by ${fmt(F.randomDiff[0])} to ${fmt(F.randomDiff[1])} links.</p>`)}`,
    know: `<h2 data-at="0.6">What we know</h2>
      ${turns(`<p data-at="1.2" data-out="24.5">There are strong indications that the BNI wheat stays greener and loses less nitrate, and that the soil's microbe community and network show no clear change from the wheat line.</p>
        <p data-at="10" data-out="24.5" class="amber">It is not yet proof.</p>
        <p data-at="14" data-out="24.5">The next steps are to follow marked nitrogen atoms through soil, microbe and plant, and to read which microbial genes are switched on.</p>`,
      `<p class="note" data-at="25">Marking atoms means isotope studies with nitrogen-15; reading which genes are switched on is called metatranscriptomics. One question is still open. The jars show far less nitrous oxide from the BNI wheat's soil, while the data's own nitrous oxide value shows no clear difference over the season, ${F.n2oMeta[0].toFixed(2)} against ${F.n2oMeta[1].toFixed(2)}, with ${pTxt(F.n2oMeta[2])}. How the two measurements relate is not known yet.</p>
        <p data-at="28"><button class="btn primary" id="btnGoExplore" type="button">Explore the trial</button></p>
        <p class="credits" data-at="29">After the slides by ${AUTH} (University of Vienna; University of Thessaly; Université Lyon 1; JIRCAS, Japan). The BNI wheat: Subbarao et al., PNAS.</p>
        <p class="credits" data-at="30">The trial's data used with the authors' permission. The soil block, the relay, the chromosome and the field's layout are illustrative. Narration: a synthetic voice (Kokoro).</p>`)}`,
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
  start({ soil_grow: 0, soil_cut: 1, soil_fert: 0, soil_flow: 0, soil_plant: 0.45, soil_inhibit: 0, soil_halo: 0, soil_dcd: 0, soil_pore: 0,
    soil_relay: 0, soil_grass: 0, soil_chrom: 0, soil_tracer: 0, soil_pick: -1,
    web_net: 0, web_globe: 1, web_ties: 0, web_spin: SPIN.vienna,
    field_grow: 0, field_date: 0, field_net: 0, field_chl: 0, field_nh4: 0, field_no3: 0, field_jars: 0, field_jday: 0, field_inc: 0,
    field_cores: 0, field_stack: 0, field_module: -1, field_mlit: 0, field_pick: -1, field_tags: 0, field_show: 0, field_life: 0, field_line: -1, field_fert: -1,
    net_cloud: 0, net_nitro: 0, net_pull: 0, net_links: 0, net_shuffle: 0, net_mods: 0, net_rho: 0.6, net_focus: -1, net_split: 0, net_splitBy: 0, net_kind: -1 });
  let a, b;
  // Half the sack: the block with its wheat growing from a seedling, fertiliser falling and dissolving into ammonium,
  // then the flows: some up the roots into the plant, the rest through the relay down out of the block as nitrate, or
  // up out of it as nitrous oxide
  a = C.title.a; b = C.title.b;
  show('soil', 0.2, 2);
  ramp('soil_grow', a + 0.5, a + 7, 0, 1);
  ramp('soil_fert', a + 6, a + 12, 0, 1);
  ramp('soil_flow', a + 12, a + 22, 0, 1);
  cam(a, 'soil', 'default', -34);
  cam(a + 5, 'soil', 'plant', -16);
  cam(a + 8, 'soil', 'surface', -10);
  cam(a + 13, 'soil', 'surface', 6, 'spin');
  cam(a + 17, 'soil', 'default', -6);
  cam(a + 29, 'soil', 'default', 12, 'spin');
  cam(a + 33, 'soil', 'roots', -8);
  cam(b - 0.5, 'soil', 'roots', 6, 'spin');
  // The relay underground: a pore grows out of the block, magnified; the four relay runners come in one by one, each
  // handing on glowing particles that change colour as they pass
  a = C.relay.a; b = C.relay.b;
  ramp('soil_pore', a + 2, a + 7, 0, 1);
  ramp('soil_relay', a + 8, a + 10, 0, 1);
  ramp('soil_relay', a + 16, a + 18, 1, 2);
  ramp('soil_relay', a + 24, a + 26, 2, 3);
  ramp('soil_relay', a + 33, a + 35, 3, 4);
  ramp('soil_pore', b - 6, b - 1, 1, 0);
  jump('soil_relay', b - 0.5, 4, 0);
  cam(a + 1, 'soil', 'pore', -10);
  cam(a + 7, 'soil', 'relay', -12);
  cam(a + 40, 'soil', 'relay', 12, 'spin');
  cam(b - 1, 'soil', 'default', -10);
  // A wheat that fights back: the wild grass beside the block, two chromosomes above, a segment gliding from the grass's
  // into the wheat's; then the halo round the roots and the relay slowing (the particles stay amber)
  a = C.bni.a; b = C.bni.b;
  ramp('soil_grass', a + 2, a + 6, 0, 1);
  ramp('soil_chrom', a + 9, a + 14, 0, 0.5);
  ramp('soil_chrom', a + 15, a + 21, 0.5, 1);
  ramp('soil_grass', a + 24, a + 27, 1, 0);
  ramp('soil_chrom', a + 24, a + 27, 1, 0);
  ramp('soil_halo', a + 26, a + 32, 0, 1);
  ramp('soil_inhibit', a + 28, a + 36, 0, 0.7);
  cam(a + 2, 'soil', 'chrom', -12);
  cam(a + 22, 'soil', 'chrom', 10, 'spin');
  cam(a + 26, 'soil', 'roots', -8);
  cam(b - 1, 'soil', 'roots', 10, 'spin');
  // The field trial: the globe facing Vienna, turning east while the hop draws its arc to Japan, the camera diving
  // towards Japan as the field fades in: the wheat grows on bare plots under netting, the dates pass, and at each a
  // core lifts out of every plot; then the cores fly into the stack of the design
  a = C.trial.a; b = C.trial.b;
  hide('soil', a, a + 2);
  show('web', a, a + 2);
  key('web_spin', a + 2, SPIN.vienna);
  ramp('web_spin', a + 3, a + 12, SPIN.vienna, SPIN.japan);
  ramp('hop_a', a + 2, a + 3, 0, 1);
  ramp('hop_t', a + 3, a + 11, 0, 1);
  hide('web', a + 14.5, a + 17);
  show('field', a + 14.5, a + 16.5);
  ramp('field_grow', a + 16, a + 24, 0, 1);
  ramp('field_net', a + 19, a + 23, 0, 1);
  // the five dates (the wheat taller, its stage, and the cores lifting at each)
  [26, 29.5, 33, 36.5].forEach((s, i) => ramp('field_date', a + s, a + s + 2, i, i + 1));
  ramp('field_cores', a + 25, a + 39, 0, 1);
  ramp('field_stack', a + 41, a + 50, 0, 1);
  const jp = SPIN.at(36.05, 140.12, SPIN.japan);
  cam(a + 0.5, 'web', 'globe', 0, null, [0, -6, 0.6]);
  cam(a + 3, 'web', 'globe', 0, null, [0, -2, 0.1]);
  cam(a + 12, 'web', 'globe', 0, 'spin', [0, 6, -0.7]);
  cam(a + 16, 'web', 'globe', 0, null, [0, 12, -4.5, jp[0], jp[1], jp[2]]);
  cam(a + 17, 'field', 'plots', -20);
  cam(a + 24, 'field', 'default', -10);
  cam(a + 27, 'field', 'low', -12);
  cam(a + 38, 'field', 'low', 14, 'spin');
  cam(a + 41, 'field', 'stack', -8);
  cam(b - 1, 'field', 'stack', 8, 'spin');
  // Greener, fewer leaks: the cores back into the ground; the leaves take each plot's measured chlorophyll at day 70
  // (the unfertilised BNI plots picked, with their tags); back to day 24 and nitrate seeping under the plots (the
  // fertilised BNI plots picked); then the jars of day 1's soil breathing out N2O over the incubation
  a = C.leaks.a; b = C.leaks.b;
  ramp('field_stack', a, a + 3, 1, 0);
  ramp('field_cores', a + 2, a + 4, 1, 0);
  ramp('field_chl', a + 3, a + 7, 0, 1);
  jump('field_pick', a + 8, -1, 0);
  ramp('field_tags', a + 8, a + 10, 0, 1);
  ramp('field_tags', a + 19, a + 21, 1, 0);
  jump('field_pick', a + 21.5, 0, -1);
  ramp('field_date', a + 22, a + 26, 4, 2);
  ramp('field_no3', a + 23, a + 28, 0, 1);
  jump('field_pick', a + 28.5, -1, 1); jump('field_show', a + 28.5, 0, 2);
  ramp('field_tags', a + 29, a + 31, 0, 1);
  ramp('field_tags', a + 39, a + 41, 1, 0);
  jump('field_pick', a + 41.5, 1, -1);
  ramp('field_no3', a + 40, a + 43, 1, 0);
  jump('field_jday', a + 41.9, 0, 0);
  ramp('field_jars', a + 42, a + 45, 0, 1);
  // (the incubation runs to the curves' peak, about day 9 of 22, and holds there: the text's numbers)
  ramp('field_inc', a + 45, a + 56, 0, F.n2oPeakInc);
  cam(a + 1, 'field', 'default', -12);
  cam(a + 6, 'field', 'low', -14);
  cam(a + 20, 'field', 'low', 10, 'spin');
  cam(a + 24, 'field', 'under', -10);
  cam(a + 40, 'field', 'under', 10, 'spin');
  cam(a + 44, 'field', 'jars', -6);
  cam(b - 1, 'field', 'jars', 8, 'spin');
  // A crowd of 100,000: the field small below; the cloud of kinds appears over it from the centre outwards; the
  // nitrifiers flare
  a = C.crowd.a; b = C.crowd.b;
  ramp('field_jars', a, a + 3, 1, 0);
  ramp('field_date', a, a + 3, 2, 4);
  show('net', a + 1, a + 2);
  ramp('net_cloud', a + 2, a + 9, 0, 1);
  ramp('net_nitro', a + 24, a + 28, 0, 1);
  ramp('net_nitro', b - 3, b, 1, 0);
  cam(a + 0.5, 'field', 'cloud', -10);
  cam(a + 8, 'net', 'cloud', -6);
  cam(a + 20, 'net', 'cloud', 10, 'spin');
  cam(a + 24, 'net', 'core', -6);
  cam(b - 1, 'net', 'core', 10, 'spin');
  // Who rises together: the network's kinds fly out of the core to its layout, the links fade in; a shuffle dissolves
  // them; the modules take their colours, two of them lighting the plots where they thrive below; then the two wheat
  // lines' networks side by side
  a = C.together.a; b = C.together.b;
  ramp('net_pull', a + 2, a + 10, 0, 1);
  ramp('net_links', a + 7, a + 13, 0, 1);
  ramp('net_shuffle', a + 19, a + 23, 0, 1);
  ramp('net_shuffle', a + 26, a + 29.5, 1, 0);
  ramp('net_mods', a + 31, a + 35, 0, 1);
  const [mF, mP] = [0, 1].map(want => D.net.mods.findIndex(m => { const r = m.r2; return m.n >= 100 && (want ? r.plot > r.fert : r.fert > r.plot); }));
  jump('net_focus', a + 38, -1, mF); jump('field_module', a + 38, -1, mF);
  ramp('field_mlit', a + 38, a + 41, 0, 1);
  jump('net_focus', a + 45, mF, mP); jump('field_module', a + 45, mF, mP);
  ramp('field_mlit', a + 51, a + 53, 1, 0);
  jump('net_focus', a + 53.5, mP, -1); jump('field_module', a + 53.5, mP, -1);
  ramp('net_mods', a + 53, a + 56, 1, 0);
  jump('net_splitBy', a + 55, 0, 0);
  ramp('net_split', a + 56, a + 62, 0, 1);
  ramp('field_a', a + 54, a + 57, 1, 0.25);
  cam(a + 1, 'net', 'core', 0);
  cam(a + 9, 'net', 'net', -8);
  cam(a + 30, 'net', 'net', 14, 'spin');
  cam(a + 34, 'net', 'module', -8);
  cam(a + 52, 'net', 'module', 10, 'spin');
  cam(a + 57, 'net', 'split', -4);
  cam(b - 1, 'net', 'split', 4, 'spin');
  // What we know: back in the block, the halo glowing and the flows held; one marked atom travels from a grain through
  // the soil, a microbe, a root and into the leaf
  a = C.know.a; b = C.know.b;
  hide('net', a, a + 2.5);
  ramp('field_a', a, a + 2.5, 0.25, 0);
  show('soil', a + 1, a + 3);
  ramp('soil_tracer', a + 5, a + 24, 0, 1);
  cam(a + 1.5, 'soil', 'tracer', -14);
  cam(a + 24, 'soil', 'tracer', 12, 'spin');
  cam(b - 0.5, 'soil', 'default', 16, 'spin');
  // ---- sound effects (sfxCue: story time, a sound, where it comes from, its options), beside the keys above: a cue just
  // before the line it goes with, textures under the voice soft; sequences from the keys (when a ramp reaches a share)
  const rampAt = (t0, t1, f) => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (smooth(m) < f) lo = m; else hi = m; } return t0 + (t1 - t0) * lo; };
  a = C.title.a;
  sfxCue(a + 0.5, 'rise', 'soil', 'stem', { dur: 6 });                               // the wheat grows from a seedling
  sfxCue(a + 6, 'patter', 'soil', 'fert', { dur: 5, gain: 0.45 });                   // fertiliser falls
  sfxCue(a + 11.8, 'rush', 'soil', 'nh4', { dur: 10, pitch: 0.8, gain: 0.3 });       // the flows: up, down, out
  a = C.relay.a;
  sfxCue(a + 2, 'whoosh', 'soil', 'pore', { dur: 5 });                               // a pore, magnified
  ['aoa', 'aob', 'nob', 'comammox'].forEach((k, i) => sfxCue(a + [8, 16, 24, 33][i] + 0.2, 'pick', 'soil', k, { pitch: Math.pow(2, 2 * i / 12) }));   // the four relay runners
  sfxCue(a + 49, 'whoosh', 'soil', 'pore', { dur: 4, pitch: 0.7 });                 // the pore shrinks back
  a = C.bni.a;
  sfxCue(a + 2, 'rise', 'soil', 'grass');                                            // the wild grass
  sfxCue(a + 8.8, 'whoosh', 'soil', 'chromGrass');                                   // two chromosomes
  sfxCue(a + 21, 'link', 'soil', 'chromWheat');                                      // the segment lands in the wheat's
  sfxCue(a + 26, 'pulse', 'soil', 'halo');                                           // the halo round the roots
  sfxCue(a + 28.5, 'pulse', 'soil', 'pore', { pitch: 0.7, gain: 0.35 });             // the relay slows
  a = C.trial.a;
  sfxCue(a + 2.5, 'whoosh', 'web', 'europe', { dur: 9, pitch: 0.6 });                // the globe turns east, the hop to Japan
  sfxCue(a + 11, 'ping', 'web', 'asia');                                             // Japan
  sfxCue(a + 14.5, 'whoosh', 'field', 'field');                                      // down to the field
  sfxCue(a + 16, 'rise', 'field', 'field', { dur: 8 });                              // the wheat grows
  [26, 29.5, 33, 36.5].forEach((s, i) => sfxCue(a + s, 'knock', 'field', 'field', { pitch: 1.4 * Math.pow(2, i / 12), gain: 0.35 }));   // each date, a core lifts from every plot
  sfxCue(a + 41, 'patter', 'field', 'stack', { dur: 9, gain: 0.4 });                 // the cores fly into the stack
  a = C.leaks.a;
  sfxCue(a + 3, 'rise', 'field', 'field', { dur: 4, pitch: 1.2 });                   // leaves by their chlorophyll
  sfxCue(a + 8, 'pick', 'field', 'bni');                                             // the unfertilised BNI plots picked
  sfxCue(a + 21.8, 'whoosh', 'field', 'field', { dur: 4, pitch: 0.7 });              // back to day 24
  sfxCue(a + 23, 'rush', 'field', 'under', { dur: 5, pitch: 0.6, gain: 0.3 });       // nitrate seeping
  sfxCue(a + 28.5, 'pick', 'field', 'bni');                                          // the fertilised BNI plots
  [41.8, 42.2, 42.6].forEach((s, i) => sfxCue(a + s, 'bubble', 'field', 'jars', { pitch: Math.pow(2, 2 * i / 12), seq: true }));   // the jars
  [45, 48, 51, 54].forEach(s => sfxCue(a + s, 'bubble', 'field', 'jars', { pitch: 0.7, gain: 0.3 }));   // breathing out N2O
  a = C.crowd.a;
  sfxCue(a + 2, 'grow', 'net', 'cloud', { dur: 7, pitch: 0.9 });                     // 20,000 kinds
  sfxCue(a + 23.8, 'pulse', 'net', 'cloud', { pitch: 1.2 });                         // the nitrifiers flare
  a = C.together.a;
  sfxCue(a + 2, 'whoosh', 'net', 'net', { dur: 8 });                                 // kinds fly out to their layout
  sfxCue(a + 7, 'grow', 'net', 'net', { dur: 6 });                                   // links fade in
  sfxCue(a + 18.8, 'snap', 'net', 'net');                                            // the shuffle
  sfxCue(a + 19.1, 'patter', 'net', 'net', { dur: 3.5, gain: 0.3 });                 // the links dissolve
  sfxCue(a + 30.8, 'grow', 'net', 'net', { dur: 4, pitch: 1.2 });                    // modules take colours
  [38, 45].forEach((s, i) => sfxCue(a + s, 'pulse', 'field', 'lit', { pitch: i ? 0.8 : 1 }));   // a module lights its plots
  sfxCue(a + 55.8, 'whoosh', 'net', 'mid', { dur: 6 });                              // the two wheat lines' networks
  a = C.know.a;
  sfxCue(a + 1, 'rise', 'soil', null, { gain: 0.4 });                                // back in the block
  [0.02, 0.32, 0.5, 0.75].forEach((f, i) => sfxCue(rampAt(a + 5, a + 24, f), 'step', 'soil', 'tracer', { pitch: Math.pow(2, 2 * i / 12), seq: true }));   // one marked atom: grain, microbe, root, stem
  sfxCue(a + 24, 'ping', 'soil', 'ear');                                             // into the leaf
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds the hop's two ends)
  a = C.trial.a;
  label('web', () => GL.hop.at.vienna, '<b>Vienna</b> · the lab', a + 2.5, a + 9, 'cyn');
  label('web', () => GL.hop.at.japan, '<b>Japan</b> · the field trial', a + 10.5, a + 16, 'amb');
}
// the globe's turn (web_spin, in turns) that brings a longitude to face +z, and a point of the globe at a turn (the web
// set's ll() and its turn, as makeHop has them)
const SPIN = {
  of: lon => -(lon - HOP.L0) / 360,
  at(lat, lon, spin) {
    const A = lat * D2R, B = (lon - HOP.L0) * D2R, p = [Math.cos(A) * Math.sin(B), Math.sin(A), Math.cos(A) * Math.cos(B)], r = spin * Math.PI * 2;
    return [p[0] * Math.cos(r) + p[2] * Math.sin(r), p[1], -p[0] * Math.sin(r) + p[2] * Math.cos(r)];
  },
};
SPIN.vienna = SPIN.of(HOP.from[1]) + 0.02; SPIN.japan = SPIN.of(HOP.to[1]);
//#use buildCamera~2
// the turn a set has at story time t: that of its latest stay on show (it starts fading in a little before its first view)
// (the field and the network share one turn: one frame)
function setYaw(k, t) {
  let c = 0;
  const f = frameOf(k);
  for (const y of ST.yaw) if (y.k === f && y.t0 - 6 <= t) c = y.c;
  return c;
}
//#use smoothSeg spinEase
// the story's view at time t: [az, el, dist, tx, ty, tz, narrow factor, FIT's target shift x, y, z, and LOW's two]
// (in a headset a set's stand view may take over while it is the scene, see standView: none in this story yet)
const storyCam = t => (XR.on ? standView(storyView(t), standW(t)) : storyView(t));
//#use storyView
// In a headset a set may stand life size round you while it is the scene (the muscle story's Stand inside, the topo
// story's tower): the story's view eases into that set's STAND view, keeping the story's turn, its axis STAND_BACK
// further off than the view's target. The soil story keys none (ST.stand is empty: the field's life-size view is the
// field set's own option, SPEC.md); the lines stay so one can be added by time (ST.stand.push([t0, t1, t2, t3])). The
// weight follows the story's time alone, so at a shared-room station everyone sees the same size. On a screen nothing
// changes.
const STAND = ['field', 'stand'], STAND_BACK = 0;
//#use standW
function standView(v, w) {
  if (w <= 0) return v;
  const s = view(...STAND), A = v[0] * D2R;
  s[3] += STAND_BACK * Math.sin(A); s[5] += STAND_BACK * Math.cos(A);   // (towards you: the target nearer, the axis further)
  v[1] += (s[1] - v[1]) * w;
  v[2] = Math.exp(Math.log(v[2]) + (Math.log(s[2]) - Math.log(v[2])) * w);
  for (let i = 3; i < 6; i++) v[i] += (s[i] - v[i]) * w;
  return v;
}
//#use LBL labelEl label sfxSpan buildSetLabels labelText setLabelAlpha~2 _v labelPos _placed placeLabels curCh
//#use updateStoryDOM buildTimeline ICON_PLAY ICON_PAUSE lastTick updateTimeline