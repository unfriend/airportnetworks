
// ================================================================== STORY ==
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Until a narration is recorded, the table sets the
// pace: node tools/pace.mjs writes it from the words on the panel (each stretch
// between two cues lasts long enough to read what appeared at its start; run
// it again after the text changes). A recording replaces it with its own times.
const NARRATION_SYNC = [
  [0, 0], [460, 460],   // (a placeholder until the story is in HOST.list: node tools/pace.mjs <url> --write soil)
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
// sets' own views fill a whole screen, so the wide ones stand back a little and move their target left of the parts'
// middle: the network split in two or three, the field with its jars on the bench and its stack behind)
const FIT = {
  net: { split: [0, 0, 0.5, -0.1, 0, 0] },
  field: { default: [0, 0, 0.3, 0.15, 0, 0], jars: [0, 0, 0.2, 0, 0, 0] },
};
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen (the split network, the field with its bench)
const NARROW = { net: { split: 1.55, module: 1.15 }, field: { default: 1.25, plots: 1.2, stack: 1.2, cloud: 1.15 }, soil: { default: 1.15 } };
const narrowOf = (k, name) => (NARROW[k] && NARROW[k][name]) || 1;
// on a screen held sideways but too narrow for the side panel (the panel below, the scene in a strip above it, see
// lowK): [distance factor, the target's shift up]
const LOW = { soil: { default: [0.95, -0.1], plant: [0.9, -0.1] }, field: { stack: [0.9, -0.1] }, net: { cloud: [0.8, 0], core: [0.9, 0], net: [0.85, 0], module: [0.8, 0.1], split: [0.9, 0] } };
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
// (SOIL_DATA.figs: said "read off the slides"). Nothing scientific is computed here.
const D = SOIL_DATA, SD = SDATA;
const pct = v => (Number.isFinite(+v) ? `${Math.round(100 * v)} %` : '–');
const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] || String(n);
const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
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
    samples: D.src.samples, kinds: D.src.kinds, reads: D.src.reads, common: D.common.n, readShare: D.common.readShare,
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
  };
})();
// the credits: the last chapter's small print and explore's About note (the Scenes pane, page and headset)
const AUTH = 'Marina Montserrat Díez, Tadashi Yoshihashi, Guntur Subbarao Ventaka, Eleftheria Bachtsevani, Dimitrios Karpouzas, Christina Hazard, Melina Kerou and Christa Schleper';
const INSTS = 'University of Vienna (Vienna Doctoral School of Ecology and Evolution; Archaea Biology and Ecogenomics); University of Thessaly; Université Lyon 1 Claude Bernard; JIRCAS (Japan International Research Center for Agricultural Sciences)';
const DATA_CREDIT = 'The field trial\'s data (16S amplicon reads, field measurements) used with the authors\' permission; the kinds of microbe are numbered by abundance, never named by their ids. Values from the slides\' charts were read off them by two readers. The soil block, the relay, the chromosome and the field\'s layout are illustrative. The co-occurrence network was built for this story with a standard method; it is not the authors\' analysis.';
const ABOUT = `After the slides "Exploring the Effects of Biological Nitrification Inhibition on the Rhizosphere Microbiome of a BNI-enabled Winter Wheat" by ${AUTH} (${INSTS}). The BNI wheat: Subbarao et al., PNAS. ${DATA_CREDIT}`;
// colours as text on the HTML panel, which is light in the light theme: a colour mixed with the panel's ink (darker on
// a light panel, lighter on a dark one). The headset's panel is dark: its canvas twin takes the colour itself (data-col).
const inkCol = c => `color-mix(in srgb, ${c} 55%, var(--ink))`;
const swCol = c => c;   // a swatch or a bar in the same colour
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
        <p data-at="12" data-out="21.5" class="amber">The plant takes up some of it as ammonium; microbes in the soil get to much of the rest first.</p>`,
      `<p data-at="22">They turn it into nitrate, which washes away, and into nitrous oxide, a strong greenhouse gas.</p>
        <p data-at="30" class="amber">So farmers spread more.</p>
        <p class="note" data-at="33">"Less than 50 %", as the slides put it. The flows in this block are a drawing, not measurements: ammonium amber, nitrate blue, nitrous oxide lilac, nitrogen in the plant green.</p>
        <p class="credits" data-at="35">After the slides by Marina Montserrat Díez and colleagues (Christa Schleper's group, University of Vienna, with JIRCAS, the University of Thessaly and Université Lyon 1), and their field trial's data.</p>`)}`,
    relay: `<h2 data-at="0.6">The relay underground</h2>
      ${turns(`<p data-at="1.2" data-out="41.5">Inside the soil, microbes pass the nitrogen on, like runners in a relay.</p>
        <ul class="steps">
          ${step(9, 41.5, G.aoa, 'Archaea', 'turn ammonium into nitrite')}
          ${step(17, 41.5, G.nsp, 'Bacteria', 'do the same')}
          ${step(25, 41.5, G.nit, 'Nitrite oxidisers', 'turn nitrite into nitrate')}
          ${step(34, 41.5, AMBER, 'Comammox', 'does both steps in one microbe')}
        </ul>`,
      `<p data-at="42">Each hand-off is a step in a network of processes, and at each one nitrogen can leak away.</p>
        <p class="note" data-at="46">This is nitrification: ammonia-oxidising archaea (AOA) and bacteria (AOB) make nitrite, nitrite-oxidising bacteria (NOB) make nitrate, and complete ammonia oxidisers (comammox) do both. Nitrous oxide escapes along the way. The pore and its microbes are an illustration.</p>`)}`,
    bni: `<h2 data-at="0.6">A wheat that fights back</h2>
      ${turns(`<p data-at="1.2" data-out="23.5">Some plants release substances from their roots that slow the relay down: biological nitrification inhibition, or BNI.</p>
        <p data-at="9" data-out="23.5" class="amber">Breeders moved a piece of chromosome from a wild grass into the wheat Munal.</p>`,
      `<p data-at="24">The new wheat's roots slow the first hand-off, so more ammonium stays where the plant can take it up.</p>
        <p data-at="35" class="amber">Until now the evidence was one bacterium in a dish and one day in a field.</p>
        <p class="note" data-at="39">The wild grass is Leymus racemosus; the BNI wheat is Munal-BNI, the control wheat Munal-control, the same wheat without the segment (Subbarao et al., PNAS). The earlier evidence, as the slides list it: root exudates slowed one ammonia-oxidising bacterium in batch cultures, and a field study at a single timepoint found more nitrogen in the plant and fewer ammonia-oxidising archaea.</p>`)}`,
    trial: `<h2 data-at="0.6">The field trial</h2>
      ${turns(`<p data-at="1.2" data-out="24.5">To test it, the BNI wheat and the control wheat were grown side by side in a field in Japan:</p>
        ${legend([[16, FERT_COL[0], 'with no fertiliser'], [17.5, FERT_COL[1], 'with fertiliser'], [19, FERT_COL[2], 'with fertiliser and a synthetic inhibitor']], 24.5)}`,
      `<p data-at="25">Five times over ${F.days[F.days.length - 1]} days, soil was taken from the roots in every plot.</p>
        <div class="facts">${fact(40, AMBER, fmt(F.samples), 'samples')}${fact(41.5, CYAN, fmt(F.plots), 'plots')}${fact(43, GREEN, word(F.dates), 'dates')}</div>
        <p class="note" data-at="46">The trial is JIRCAS's; its site and year are not given, so the arc ends at JIRCAS's home in Tsukuba. Fertiliser: ${F.kgN} kg of nitrogen per hectare; the inhibitor: DCD (dicyandiamide, our reading). The slides' days ${d1} to ${dL} are ${F.dap[0]} to ${F.dap[F.dap.length - 1]} days after planting, from jointing to ripening. ${cap(word(F.reps))} replicates of each; the soil clinging to the roots (the rhizosphere); one sample is missing. The plots' layout is illustrative.</p>`)}`,
    leaks: `<h2 data-at="0.6">Greener, fewer leaks</h2>
      ${turns(`<p data-at="1.2" data-out="21.5">At the end of the season the BNI wheat is still green where the control wheat yellows, most clearly without fertiliser.</p>
        <div class="facts">${fact(9, LINE_COL[0], Math.round(cB), `BNI wheat, day ${dL}`, 21.5)}${fact(10.5, LINE_COL[1], Math.round(cC), 'control wheat', 21.5)}</div>
        <p class="note" data-at="12" data-out="21.5">Chlorophyll (SPAD) in the leaves of unfertilised plots, read off the slides.</p>`,
      `<p data-at="22" data-out="41.5">With fertiliser there is less nitrate in the soil under it in mid-season.</p>
        <div class="facts">${fact(30, LINE_COL[0], Math.round(nB), `mg N per kg, day ${F.days[2]}`, 41.5)}${fact(31.5, LINE_COL[1], Math.round(nC), 'under the control wheat', 41.5)}</div>
        <p class="note" data-at="33" data-out="41.5">Nitrate in fertilised plots, the group means of the data (${pTxt(F.no3d24[2])}). The slides call it lower from day ${F.days[2]} to day ${F.days[3]}; only day ${F.days[2]} is starred.</p>`,
      `<p data-at="42">And soil from its roots, given ammonium in a jar, gives off far less nitrous oxide, close to what the synthetic inhibitor achieves.</p>
        <div class="facts">${fact(52, LINE_COL[0], n1(oB), 'ppm at the peak, BNI wheat')}${fact(53.5, LINE_COL[1], n1(oC), `control wheat, day ${d1}`)}</div>
        <p class="note" data-at="57">Fertilised soil, read off the slides (${esc(F.incubation.replace(/ \(slide text\)$/, ''))}). An open question: the data's own N2O value, "the potential amount of produced nitrous oxide" (unit not given), shows no clear difference over the season (${F.n2oMeta[0].toFixed(2)} against ${F.n2oMeta[1].toFixed(2)}, ${pTxt(F.n2oMeta[2])}); how the two measurements relate is not known yet.</p>`)}`,
    crowd: `<h2 data-at="0.6">A crowd of ${thousands(F.kinds)}</h2>
      ${turns(`<p data-at="1.2" data-out="23.5">A spoonful of this soil holds about ${thousands(F.kinds)} kinds of microbe.</p>
        <p data-at="9" data-out="23.5" class="amber">${fmt(F.common)} of them make up ${pct(F.readShare)} of the DNA read.</p>`,
      `<p data-at="24">Fertiliser roughly doubles one ammonia-eating bacterium, Nitrosospira.</p>
        <p data-at="31">The wheat line changes nothing that can be measured: only ${word(F.byLine)} of the ${fmt(F.common)} common kinds differ between the two wheats.</p>
        <div class="facts">${fact(38, FERT_COL[1], fmt(F.byFert), 'differ by fertiliser')}${fact(39.5, GREY, fmt(F.byTime), 'by date')}${fact(41, LINE_COL[0], fmt(F.byLine), 'by wheat line')}</div>
        <p class="note" data-at="44">Kinds of microbe: amplicon sequence variants (ASVs) from 16S rRNA gene reads, numbered here by abundance. Nitrosospira: ${F.nitrosospira.map(v => v.toFixed(2)).join(', ')} % of reads without fertiliser, with it, and with DCD. The counts of ammonia oxidisers' genes (qPCR, read off the slides) differ little between the wheats (one marginal p = ${F.qpcrP}).</p>`)}`,
    together: `<h2 data-at="0.6">Who rises together</h2>
      ${turns(`<p data-at="1.2" data-out="30.5">Link two kinds of microbe when their numbers rise and fall together across the samples.</p>
        <div class="facts">${fact(10, CYAN, fmt(F.nodes), 'kinds', 30.5)}${fact(11.5, CYAN, fmt(F.links), 'links', 30.5)}</div>
        <p data-at="19" data-out="30.5" class="amber">Shuffle the samples, and not one link is left: the pattern is real.</p>`,
      `<p data-at="31" data-out="54.5">Its groups follow the fertiliser and the field's plots, not the wheat.</p>
        <p class="note" data-at="40" data-out="54.5">About ${word(F.big)} big groups (modules): ${word(F.bigFert)} rise and fall with the fertiliser, ${word(F.bigPlot)} with the plots; the wheat line explains under ${Math.max(1, Math.ceil(F.lineR2 * 100))} % of any big group's ups and downs.</p>`,
      `<p data-at="55">Split by wheat line, the two networks differ no more than two random halves of the samples do.</p>
        <p data-at="64" class="amber">And rising together is not working together.</p>
        <p class="note" data-at="67">Built for this story, not the authors' analysis: the ${fmt(F.common)} common kinds, centred log-ratios, Spearman's correlation of at least 0.6 (false discovery rate under 5 %), modules by the Louvain method (their number depends on the run). Each half's own network: ${fmt(F.lineLinks[0])} and ${fmt(F.lineLinks[1])} links, ${fmt(F.lineDiff)} apart; ${fmt(F.randomN)} random halves, ${fmt(F.randomDiff[0])} to ${fmt(F.randomDiff[1])} apart. With the plots' means taken out, ${fmt(F.residual.plot.links)} links are left.</p>`)}`,
    know: `<h2 data-at="0.6">What we know</h2>
      ${turns(`<p data-at="1.2" data-out="24.5">There are strong indications that the BNI wheat holds on to nitrogen in the soil, and it leaves the soil's microbes undisturbed.</p>
        <p data-at="10" data-out="24.5" class="amber">It is not yet proof.</p>
        <p data-at="14" data-out="24.5">Next: following marked nitrogen atoms through soil, microbe and plant, and reading which microbial genes are switched on.</p>`,
      `<p class="note" data-at="25">Marked atoms: isotope studies (15N); genes switched on: metatranscriptomics. Open questions remain, among them how the two N2O measurements relate and which dates the chlorophyll's last values belong to.</p>
        <p data-at="28"><button class="btn primary" id="btnGoExplore" type="button">Explore the field and its microbes</button></p>
        <p class="credits" data-at="29">After the slides by ${AUTH} (${INSTS}). The BNI wheat: Subbarao et al., PNAS.</p>
        <p class="credits" data-at="30">${esc(DATA_CREDIT)}</p>`)}`,
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
    field_cores: 0, field_stack: 0, field_module: -1, field_mlit: 0, field_pick: -1, field_tags: 0, field_show: 0, field_life: 0,
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
  cam(a + 0.5, 'web', 'globe', 0, null, [0, -6, 2.4]);
  cam(a + 3, 'web', 'globe', 0, null, [0, -2, 1.9]);
  cam(a + 12, 'web', 'globe', 0, 'spin', [0, 6, 1.1]);
  cam(a + 16, 'web', 'globe', 0, null, [0, 12, -2.7, jp[0], jp[1], jp[2]]);
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
  ramp('field_inc', a + 45, a + 60, 0, 1);
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
// (the field and the network share one turn: one frame)
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
// (in a headset a set's stand view may take over while it is the scene, see standView: none in this story yet)
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

// In a headset a set may stand life size round you while it is the scene (the muscle story's Stand inside, the topo
// story's tower): the story's view eases into that set's STAND view, keeping the story's turn, its axis STAND_BACK
// further off than the view's target. The soil story keys none (ST.stand is empty: the field's life-size view is the
// field set's own option, SPEC.md); the lines stay so one can be added by time (ST.stand.push([t0, t1, t2, t3])). The
// weight follows the story's time alone, so at a shared-room station everyone sees the same size. On a screen nothing
// changes.
const STAND = ['field', 'stand'], STAND_BACK = 0;
// ST.stand: [t0, t1, t2, t3], in over t0..t1 and out over t2..t3 (story time)
const standW = t => ST.stand.reduce((w, [t0, t1, t2, t3]) => Math.max(w, Math.min(smooth((t - t0) / (t1 - t0)), smooth((t3 - t) / (t3 - t2)))), 0);
function standView(v, w) {
  if (w <= 0) return v;
  const s = view(...STAND), A = v[0] * D2R;
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
