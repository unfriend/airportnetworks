
// ================================================================== STORY ==
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Edit here if you record a narration.
const NARRATION_SYNC = [
  [0, 0], [330, 330],
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
  { key: 'cohort', name: 'Network', a: 128, b: 172 },
  { key: 'health', name: 'Health', a: 172, b: 218 },
  { key: 'one', name: 'One scan', a: 218, b: 258 },
  { key: 'people', name: 'People', a: 258, b: 305 },
  { key: 'vision', name: 'Vision', a: 305, b: 330 },
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
// views whose parts reach under the side panel or off the right edge on a landscape screen: a little further back,
// or their target moved, so they fit beside the panel (added to the set's own view, in story and explore mode alike)
const FIT = { organs: { strength: [0, 0, 0.4, 0.05] },
  people: { strip: [0, 0, 0.4, -0.35], auc: [6, 0, 0.45, -0.3], km: [0, 0, 0.3, 0, 0.04] } };
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen (the vision row; the network with its chart; the one-scan scene with its gauges)
const NARROW = { scan: { vision: 1.32 }, organs: { net: 1.3, strength: 1.45, matrix: 1.15, bars: 1.1 },
  people: { default: 1.2, one: 1.2, metrics: 1.35, strip: 1.15, map: 1.1, km: 1.1, auc: 1.1 } };
const narrowOf = (k, name) => (NARROW[k] && NARROW[k][name]) || 1;
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

// ------------------------------------------------------------------- data --
// The paper's and the poster's numbers (PET_DATA), looked up once for the story and the panels. The networks read off
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
// the networks the organs set can show (organs_which: an index into this list), with their short names
const NET_IDS = ['full', 'FDG_healthy', 'A_low', 'A_high', 'B_low', 'B_high', 'C_low', 'C_mid', 'C_high', 'HK2', 'GLUT'];
const NET_SHORT = ['All scans', `FDG, ${((netOf('FDG_healthy') || {}).organs || []).length || 9} organs`, 'BMI low', 'BMI high', 'Tumour low', 'Tumour high', 'CRP low', 'CRP mid', 'CRP high', 'HK2', 'GLUT'];
const netShort = id => NET_SHORT[NET_IDS.indexOf(id)] || String(id);
// Table 2's comparisons whose groups the paper drew as networks (Figures 2A and 3): one network per group, or null.
// (Figure 4's healthy FDG network uses only the organs GTEx has too, so it belongs with the protein networks, Table 3.)
function rowNets(r) {
  if (!r) return [];
  const m = r.what === 'BMI' && /healthy/.test(r.cohort) ? ['A_low', 'A_high'] : r.what === 'Tumour load' ? ['B_low', 'B_high']
    : r.what === 'CRP' && /thirds/.test(r.cohort) ? ['C_low', 'C_mid', 'C_high'] : r.what === 'Blood pool' ? ['full', null] : [];
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
  if (id === 'full') return `All ${fmt(PD.D.cohort.scans)} scans, every organ divided by the aorta (Figure 2A, printed)`;
  if (r) { const g = r.groups[rowNets(r).indexOf(id)]; return `${r.what}, ${r.cohort.replace(/, split at the median.*$/, '')}: ${g.label} (${g.n} scans; Figure ${n.fig}, read off)`; }
  if (id === 'FDG_healthy') return `FDG in the ${PD.D.cohort.healthy} healthy people, on the ${(n.organs || []).length} organs GTEx has too (Figure 4, read off)`;
  const t3 = PD.D.table3.find(x => PROT_NET(x) === id);
  return t3 ? `${t3.name}: from its gene's activity in the tissues of ${fmt(PD.D.cohort.gtex)} people (GTEx; Figure 4, read off)` : n.title || id;
}
// Table 3's protein networks drawn in Figure 4
const PROT_NET = r => (r.kind === 'fdg' ? 'FDG_healthy' : /HK2/.test(r.name) ? 'HK2' : /GLUT/.test(r.name) ? 'GLUT' : null);
// the four profiles of the one-scan network, in the order of people_profile, and the poster's groups' colours
const PROFILES = [['healthy', 'Healthy'], ['cancer', 'Cancer'], ['both', 'Cancer + dyslipidaemia'], ['dys', 'Dyslipidaemia']];
const GROUP_COL = { cancer: '#d9dde6', both: '#9b5de5', dys: '#ff4fd8', healthy: '#38bdf8' };
const THIRD_COL = ['#38bdf8', '#a78bfa', '#d9dde6'];
// The poster's numbers: its groups on the index, its cohort, survival by the index's thirds and the immunotherapy test.
// Read generously (lists of { name or label or group, n, ... } or objects keyed by group), so a reading that arrives in
// another shape, or not at all, leaves its sentence out instead of breaking the story.
const POSTER = (() => {
  const P = PET_DATA.poster || {};
  const list = x => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.entries(x).map(([k, v]) => (v && typeof v === 'object' ? Object.assign({ key: k }, v) : { key: k, n: v })) : []);
  const name = g => String(g.name || g.label || g.group || g.key || '');
  const sum = l => l.reduce((a, g) => a + (Number.isFinite(+g.n) ? +g.n : 0), 0);
  const groups = ((P.mdi && P.mdi.groups) || []).map((g, i) => Object.assign({ i, col: GROUP_COL[g.key] || '#9aa3b5' }, g, { name: name(g) }));
  const co = P.cohort || {}, base = list(co.baseline || co.base), follow = list(co.followup || co.followUp || co.follow);
  // survival by the index's thirds: the curves (name, n) with the poster's table (median in months, NR: not reached;
  // survival after one year)
  const km = P.km || {}, table = list(km.table), curves = list(Array.isArray(km) ? km : km.curves || km.groups || km.thirds || km.tertiles);
  const thirds = (curves.length ? curves : table).map((c, i) => {
    const g = Object.assign({}, table[i] || {}, c);
    const mk = ['median', 'medianMonths', 'med'].find(k => k in g), yk = ['oneYear', 'y1', 'surv1', 's1', 'year1'].find(k => k in g);
    const md = mk ? g[mk] : undefined, y = yk ? parseFloat(g[yk]) : NaN;
    return { name: name(c).replace(/^\d+(st|nd|rd|th)\s+(tertile|third)\s*/i, ''), n: +g.n || null, col: THIRD_COL[i] || '#9aa3b5',
      median: md === undefined ? undefined : md === null || /^\s*(nr|n\.r\.|not)/i.test(String(md)) || !Number.isFinite(parseFloat(md)) ? null : parseFloat(md),
      y1: Number.isFinite(y) ? Math.round(y <= 1 ? y * 100 : y) : null };
  });
  // the immunotherapy test: the AUC of each measure (the network's own: group 'network'), and how many people
  const pr = P.prognosis || {}, resp = list(pr.groups || pr.response || pr.responders || (pr.strip ? { good: pr.strip.good, poor: pr.strip.bad || pr.strip.poor } : null));
  const auc = list(pr.auc || pr.aucs || pr.measures).filter(a => Number.isFinite(+a.auc)).map(a => ({ name: name(a), auc: +a.auc,
    p: a.p === undefined || a.p === null ? '' : /^p/i.test(String(a.p)) ? String(a.p) : `p = ${a.p}`,
    net: a.group ? /net/i.test(a.group) : a.kind ? /net|metab|index|pet/i.test(a.kind) : /index|clearance|heterogen|network|displacement/i.test(name(a)) }));
  const ici = follow.find(g => /immun|ici|checkpoint/i.test(name(g)));
  const respN = +pr.n || sum(resp) || (ici ? +ici.n : 0) || null;
  return { groups, mdiN: sum(groups), base, follow, baseN: +co.baselineTotal || sum(base), followN: +co.followupTotal || sum(follow), thirds, resp, respN, auc, name,
    bestNet: auc.filter(a => a.net).sort((a, b) => b.auc - a.auc)[0] || null, bestClin: auc.filter(a => !a.net).sort((a, b) => b.auc - a.auc)[0] || null };
})();

// ------------------------------------------------------------------ facts --
// Numbers the story quotes, all from PET_DATA (a comparison or a reading not there yet leaves its sentence out)
const FACTS = (() => {
  const D = PET_DATA, c = D.cohort, p = D.protocol, full = netOf('full') || { edges: [], density: 0, disorder: 0 };
  const row = (what, re) => D.table2.find(r => r.what === what && (!re || re.test(r.cohort))) || null;
  const num = s => { const m = /(\d+(?:\.\d+)?)/.exec(s || ''); return m ? +m[1] : null; };
  const retest = row('Test-retest');
  return {
    scans: c.scans, subjects: c.subjects, healthy: c.healthy, cancer: c.cancer, lung: c.lung, hnscc: c.hnscc, gtex: c.gtex,
    fasting: p.fasting, dose: p.dose, rest: p.rest, hubZ: p.hub, p: p.p, seg: p.segmentation,
    organs: D.organs.length - 1, f2n: D.f2.organs.length, density: full.density, disorder: full.disorder, links: full.edges.length,
    row: { cancer: row('Cancer'), bmi: row('BMI', /healthy/), crp: row('CRP', /thirds/), tumour: row('Tumour load'), norepi: row('Norepinephrine') },
    weeks: retest ? num((/(\d+)\s*weeks/.exec(retest.cohort) || [])[1]) : null,
    robust: D.table2.filter(r => r.part === 'test'), hk2: D.table3.find(r => /HK2/.test(r.name)) || null, tested: D.table3.filter(r => r.kind !== 'fdg').length,
    pair: (D.synth && D.synth.pairs && D.synth.pairs[0]) || null, single: D.single, poster: POSTER,
    year: num((/\((\d{4})\)/.exec(D.source.paper) || [])[1]),
  };
})();
const listOf = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'][n] || String(n);
const Word = n => { const w = word(n); return w.charAt(0).toUpperCase() + w.slice(1); };
const dis = v => (Number.isFinite(+v) ? (+v).toFixed(2) : '–');
// 'MOOSE (nnU-Net)' -> 'MOOSE, an nnU-Net model'
const segName = s => { const m = /^(.*?)\s*\((.*)\)\s*$/.exec(s || ''); return m ? `${m[1]}, an ${m[2]} model` : String(s || ''); };
// colours as text on the HTML panel, which is light in the light theme: an organ's or a group's colour mixed with the
// panel's ink (darker on a light panel, lighter on a dark one); the poster's light grey (its black, on our dark ground)
// is the ink itself. The headset's panel is dark: its canvas twin takes the colour itself (data-col).
const inkCol = c => (/^#d9dde6$/i.test(c) ? 'var(--ink)' : `color-mix(in srgb, ${c} 55%, var(--ink))`);
const swCol = c => (/^#d9dde6$/i.test(c) ? 'var(--ink)' : c);   // a swatch or a bar in the same colour
const pct = v => (Number.isFinite(+v) ? `${+v}%` : '–');

// the story's own networks, in the order it shows them (one that has no links yet is skipped: the network stays)
function buildStory() {
  const F = FACTS, R = F.row, P = F.poster, S1 = F.single, prof = k => (S1 && S1.profiles && S1.profiles[k]) || null;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // jump an index param (an organ, a pair, a group) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const oi = id => (PD.byId[id] ? PD.byId[id].i + 1 : 0);   // organs_focus for an organ
  const wi = id => NET_IDS.indexOf(id);                      // organs_which for a network
  const gD = (r, i) => (r && r.groups[i] ? pct(r.groups[i].density) : '–'), gO = (r, i) => (r && r.groups[i] ? dis(r.groups[i].disorder) : '–');
  const step = (id, at, text) => `<li data-at="${at}" data-col="${organCol(id)}" style="border-left-color:${swCol(organCol(id))}"><b style="color:${inkCol(organCol(id))}">${esc(organName(id))}</b>${text}</li>`;
  const ones = (S1 && S1.organs) || [];
  const thirds = P.thirds.filter(g => g.median !== undefined || g.y1 !== null);
  const med = g => (g.median === null ? 'not reached' : `${g.median} months`);
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1), pOf = a => (a && a.p ? parseFloat(String(a.p).replace(/^[^0-9.]+/, '')) : NaN);
  const bar = P.follow.find(g => /bariatric/i.test(P.name(g)));
  // the explainer's pair linked only through other organs (the organs set finds it in the stand-in cohort; none: left out)
  const OP = setApi('organs') || {}, ind = (OP.pairs || []).find(p => p.indirect && Number.isFinite(p.r) && Number.isFinite(p.pr)) || null;
  // (said only while the poster's centres are in that order)
  const gc = k => { const g = P.groups.find(x => x.key === k); return g && Number.isFinite(+g.centre) ? +g.centre : NaN; };
  const order = gc('cancer') < gc('healthy') && gc('healthy') < gc('dys');
  // ------------------------------------------------------------ panel copy
  // parts of a chapter that take turns in one place, each fading out (data-out) as the next comes: the headset's
  // panel cannot scroll, so no chapter shows more than fits at once
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">One scan, one system</h1>
      <p class="lede" data-at="2.4">the body as a metabolic network</p>
      <p data-at="4">From one PET scan to a network of organs: what it says about health, disease and survival.</p>
      <p class="note" data-at="9">After a paper in Med${F.year ? ` (${F.year})` : ''} and a poster from the Division of Nuclear Medicine, Medical University of Vienna, and the LBI for Network Medicine.</p>`,
    scanner: `<h2 data-at="0.6">Seeing sugar</h2>
      ${turns(`<p data-at="1.2" data-out="10.5">A PET scan starts with a sugar. FDG (fluorodeoxyglucose) is glucose carrying radioactive fluorine-18.</p>
        <p data-at="5" data-out="10.5">After at least ${F.fasting} hours without food, ${F.dose[0]} to ${F.dose[1]} MBq of FDG go into a vein. For about ${F.rest} minutes the person rests: cells take the sugar up like glucose, and hexokinase traps it inside.</p>`,
      `<p data-at="11">Then the scan. Around the tunnel sits a ring of detectors.</p>
        <ul class="steps">
          <li data-at="13"><b>A positron</b>fluorine-18 decays and sends one out; it travels about a millimetre</li>
          <li data-at="17"><b>Two photons</b>it meets an electron: two gamma photons of 511 keV fly off in opposite directions</li>
          <li data-at="21"><b>A coincidence</b>detectors opposite each other register both at once; the line between them passes through the sugar</li>
        </ul>`)}
      <p data-at="27" class="amber">Millions of such lines make the image: a map of where the body takes up sugar.</p>
      <p class="credits" data-at="31">The uptake is measured as the SUV, the standardised uptake value. Protocol as in the paper.</p>`,
    body: `<h2 data-at="0.6">Where the sugar goes</h2>
      <p data-at="1.2">The tracer arrives with the blood, and within the hour it settles where cells use sugar.</p>
      <p data-at="10">The brain and the heart take up the most. The kidneys and the bladder glow too: FDG is filtered into the urine and not taken back, so it leaves the body that way.</p>
      <p data-at="20">A tumour shows as a hot spot. Usually that is all a scan is read for.</p>
      <p data-at="29" class="amber">Yet the scan holds every organ's metabolism at once.</p>`,
    organs: `<h2 data-at="0.6">Every organ, measured</h2>
      ${turns(`<p data-at="1.2" data-out="22.5">An AI (${esc(segName(F.seg))}) outlines ${F.organs} organs in every scan, slice by slice, and a doctor checks them.</p>
        <p data-at="14" data-out="22.5">Each organ's uptake is divided by that of the aorta: the blood pool, the same reference in every scan.</p>`,
      `<ul class="steps">
          ${step('brain', 23, `${esc(PD.byId.brain.measure)}: it lives on sugar`)}
          ${step('liver', 27, esc(PD.byId.liver.measure))}
          ${step('muscle', 31, esc(PD.byId.muscle.measure))}
        </ul>`)}
      <p data-at="35" class="amber">One scan, one row of numbers.</p>
      <p class="credits" data-at="36">The organs' values shown here are typical uptakes, for illustration.</p>`,
    cohort: `<h2 data-at="0.6">${fmt(F.scans)} scans</h2>
      ${turns(`<p data-at="1.2" data-out="14.5">The paper took ${fmt(F.scans)} scans of ${fmt(F.subjects)} people: ${F.healthy} of healthy volunteers and ${F.cancer} of people with cancer (${F.lung} lung, ${F.hnscc} head and neck).</p>
        <div class="facts"><div data-at="7" data-out="14.5"><b>${fmt(F.scans)}</b><small>scans</small></div><div data-at="8.5" data-out="14.5"><b>${F.f2n}</b><small>organs in the network</small></div><div data-at="10" data-out="14.5"><b>${fmt(F.scans * F.f2n)}</b><small>values</small></div></div>`,
      F.pair ? `<p data-at="15" data-out="34.5">Which organs rise and fall together across people? Take the ${esc(organLow(F.pair.a))} and the ${esc(organLow(F.pair.b))}.</p>
        <p data-at="19" data-out="34.5">A plain correlation mixes direct links with links that only pass through other organs.</p>
        <p data-at="22.5" data-out="34.5" class="amber">A partial correlation first takes out what all the other organs explain, then correlates what is left: here r = ${F.pair.r} becomes ${F.pair.pr} (the paper: ${F.pair.paper}).</p>
        ${ind ? `<p data-at="29" data-out="34.5">The ${esc(organLow(ind.a))} and the ${esc(organLow(ind.b))}: r = ${ind.r}, but ${dis(ind.pr)} once the other organs are taken out.${ind.paper === null ? ' The paper draws no link between them.' : ''}</p>` : ''}` : '',
      `<p data-at="35">Keep the significant ones (p &lt; ${F.p}) and draw them: blue where two organs rise together, red where one rises as the other falls.</p>
        <p data-at="39">The network of all ${fmt(F.scans)} scans: ${F.f2n} organs, ${F.links} links${Number.isFinite(+F.density) ? `, a density of ${pct(F.density)} (more on that next)` : ''}.</p>
        <p class="credits" data-at="41">Figure 2A of the paper. The people in the scatter plot are ${fmt(F.scans)} stand-ins with the paper's partial correlations.</p>`)}`,
    health: `<h2 data-at="0.6">From health to disease</h2>
      ${turns(`<p data-at="1.2" data-out="15.5">Split the scans into groups, and give each group its own network.${R.cancer ? ` Healthy people's is dense: ${gD(R.cancer, 0)} of the most possible, against ${gD(R.cancer, 1)} with cancer.` : ''}</p>
        ${R.bmi ? `<p data-at="7" data-out="15.5">Body weight, in healthy people: ${gD(R.bmi, 0)} below the median BMI, ${gD(R.bmi, 1)} above it. The brain becomes a hub.</p>` : ''}`,
      `<p data-at="16" data-out="34.5">Two measures. Density: all links' strength together, as a share of the most possible. Disorder: how unevenly that strength is spread, from 0 (even) up (a few hubs).</p>
        ${R.crp ? `<p data-at="21" data-out="34.5" class="amber">Inflammation (CRP, in thirds): density ${listOf(R.crp.groups.map(g => pct(g.density)))}; disorder ${listOf(R.crp.groups.map(g => dis(g.disorder)))}. As health erodes, muscle and subcutaneous fat take over as hubs.</p>` : ''}
        ${R.norepi && R.tumour ? `<p data-at="31" data-out="34.5">Stress (norepinephrine: ${gD(R.norepi, 0)} against ${gD(R.norepi, 1)}) and tumour load (${gD(R.tumour, 0)} against ${gD(R.tumour, 1)}) thin it too.</p>` : ''}`,
      `${F.robust.every(r => !r.sigD && !r.sigO) ? `<p data-at="35">And it holds: ${F.weeks ? `scans ${F.weeks} weeks apart, ` : ''}an ultra-low dose, another scanner, men and women, the aorta or the vena cava as the reference: no significant difference.</p>` : ''}
        ${F.hk2 ? `<p data-at="39">Of ${F.tested} protein networks from the tissues of ${fmt(F.gtex)} people, only hexokinase 2, the enzyme that traps FDG, has a network like FDG's (r = ${F.hk2.r}).</p>` : ''}
        <p class="credits" data-at="42">Table 2 and Figures 3 and 4 of the paper; networks other than that of all scans read off its figures.${R.cancer ? ` Disorder: ${gO(R.cancer, 0)} healthy, ${gO(R.cancer, 1)} with cancer.` : ''} A hub: strength z-score above ${F.hubZ}.</p>`)}`,
    one: `<h2 data-at="0.6">One scan, one network</h2>
      ${turns(`<p data-at="1.2" data-out="23.5">So far, one network for a whole group. The next step: a network for every scan, from ${word(ones.length)} organs.</p>
        <p data-at="6" data-out="23.5">Compare every organ with every other: how much more sugar does it take up?</p>
        <p data-at="12" data-out="23.5">Where one outshines another by more than a threshold, draw a link. The links make this person's network.</p>`,
      `<ul class="steps">
          <li data-at="24"><b>Clearance</b>how the kidneys handle the tracer</li>
          <li data-at="27"><b>Heterogeneity</b>how unevenly the uptake is spread over the organs</li>
        </ul>
        ${prof('healthy') && prof('cancer') && prof('dys') ? `<p data-at="30" class="amber">Together they give a metabolic displacement index. It moves with health: ${prof('healthy').mdi.toFixed(1)} for a healthy profile, ${prof('cancer').mdi.toFixed(1)} with cancer, ${prof('dys').mdi.toFixed(1)} with dyslipidaemia (unhealthy blood fats).</p>` : ''}
        <p class="note" data-at="34">Illustrative maths: the poster names Clearance, Heterogeneity and the index, but its formulas are not published yet. These are stand-ins, and so are the profiles.</p>`)}`,
    people: `<h2 data-at="0.6">${P.mdiN ? `${fmt(P.mdiN)} people, one index` : 'People on one index'}</h2>
      ${turns(`<p data-at="1.2" data-out="27.5">Every scan becomes one point, placed by its two measures.${P.groups.length ? ` In the poster's results: ${listOf(P.groups.map(g => `${esc(g.name.toLowerCase())} (${g.n})`))}.` : ''}</p>
        ${order ? `<p data-at="9" data-out="27.5">On the index, cancer sits low and dyslipidaemia high, with healthy people in between.</p>` : ''}
        ${P.groups.length ? `<div class="facts">${P.groups.map((g, j) => `<div data-at="${14 + 2.5 * j}" data-out="27.5"><b data-col="${g.col}" style="color:${inkCol(g.col)}">${g.centre}</b><small>${esc(g.name)}</small></div>`).join('')}</div>` : ''}`,
      `<p data-at="28" data-out="35.5" class="amber">Split by the index into thirds, people with cancer near the healthy range lived longest.</p>
        ${thirds.length ? `<ul class="steps">${thirds.map((g, j) => `<li data-at="${29.5 + j}" data-out="35.5" data-col="${g.col}" style="border-left-color:${swCol(g.col)}"><b style="color:${inkCol(g.col)}">${esc(cap(g.name))}${g.n ? ` (${g.n})` : ''}</b>median survival ${med(g)}${g.y1 !== null ? `; ${g.y1}% alive after a year` : ''}</li>`).join('')}</ul>` : ''}`,
      `<p data-at="36">${P.respN ? `In ${P.respN}` : 'In a small group of'} people with lung cancer given immunotherapy before surgery, the index told good from poor responders better than CRP, tumour stage or age${P.bestNet && P.bestClin ? ` (AUC ${P.bestNet.auc} against ${P.bestClin.auc} at best)` : ''}. A first test, in few people${pOf(P.bestNet) > F.p ? ', and not yet significant' : ''}.</p>
        <p data-at="42">After ${bar ? 'bariatric surgery' : 'surgery'} and immunotherapy, the index moved towards the healthy range.</p>
        <p class="credits" data-at="45">The poster's results, as group summaries. The dots are stand-ins drawn to match them, not patients.</p>`)}`,
    vision: `<h2 data-at="0.6">One scan, one system</h2>
      ${turns(`<p data-at="1.2" data-out="14.5">One routine scan could show how a whole body is doing: what lies ahead, and which medication might help.</p>
        <p data-at="6" data-out="14.5">Organs like muscle and fat could become targets: the paper names GLP-1 drugs, metformin, statins and SGLT2 inhibitors.</p>
        <p data-at="10" data-out="14.5" class="amber">A measure of health, not only of disease. It still has to be tested in larger studies.</p>`,
      `<p data-at="15">Barbara K Geist, Alexander Grentner, Joel Fischer, Josef Yu, Dato Tsomaia, Adna Smajlovic, Stefan Grünert and Marcus Hacker: Division of Nuclear Medicine, Medical University of Vienna, and the LBI for Network Medicine.</p>
        <p data-at="18"><button class="btn primary" id="btnGoExplore" type="button">Explore the networks</button></p>
        <p class="credits" data-at="20">Geist et al., The metabolic organ connectome, Med${F.year ? ` (${F.year})` : ''}; poster: Shaping a New Era in Nuclear Medicine. Networks of all ${fmt(F.scans)} scans: printed in the paper; other networks read off its figures. One-scan maths, organ values and the population dots: illustrative stand-ins.</p>`)}`,
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
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name)]);
  };
  start({ scan_vision: 1, scan_bed: 0, scan_pass: 0, scan_cut: 0, scan_events: 0, scan_lines: 0, scan_image: 0,
    body_pet: 0, body_net: 0, body_state: 0, body_blank: 0,
    organs_seg: 0, organs_suv: 0, organs_focus: 0, organs_lesion: 0, organs_rows: 0, organs_pair: 0, organs_partial: 0, organs_net: 0, organs_which: 0, organs_prev: 0, organs_mix: 1, organs_strength: 0,
    people_bars: 0, people_ratio: 0, people_thresh: 0, people_one: 0, people_metrics: 0, people_profile: 0, people_custom: 0, people_map: 0, people_mdi: 0,
    people_group: 0, people_km: 0, people_response: 0, people_follow: 0 });
  let a, b;
  // Intro: the vision row (scanner, body, network, prognosis, medication), then it draws back into the scanner
  a = C.title.a; b = C.title.b;
  // (the row is about 6 units wide: from this far, and a little to the right, it fits beside the panel)
  const rowPad = [0, 0, Math.max(0, 11 - view('scan', 'vision')[2]), -0.45];
  show('scan', 0.2, 2.5, C.body.a + 0.3, C.body.a + 2.3);
  ramp('scan_vision', a + 10, a + 15, 1, 0);
  cam(a, 'scan', 'vision', -8, null, rowPad);
  cam(a + 9.5, 'scan', 'vision', 4, 'spin', rowPad);
  cam(b - 0.5, 'scan', 'default', -12);
  // Seeing sugar: the couch slides in, the skin opens on the ring, events, lines of response, then the image
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
  // Where the sugar goes: the standing body, the tracer arriving, the hot organs, then a tumour
  a = C.body.a; b = C.body.b;
  show('body', a + 0.3, a + 2.3);
  ramp('body_a', C.one.a, C.one.a + 2, 0.55, 0);   // (dimmed under the organs from their chapter on)
  ramp('body_pet', a + 1.5, a + 10, 0, 1);
  show('organs', a + 18, a + 20, C.one.a, C.one.a + 2);
  ramp('organs_lesion', a + 19, a + 21, 0, 1);
  cam(a + 0.5, 'body', 'front', -12, null, [0, 0, 0.4]);
  cam(a + 9.5, 'body', 'front', 6, 'spin');
  cam(a + 12, 'body', 'front', 10, null, [0, 0, -1.1, 0, 0.3, 0]);
  cam(a + 18, 'body', 'front', 18, 'spin', [0, 0, -1.1, 0, 0.3, 0]);
  cam(a + 21, 'organs', 'lesion');
  cam(a + 28, 'organs', 'lesion', 10, 'spin');
  cam(b - 1, 'organs', 'default', -6);
  ramp('organs_lesion', b - 3, b, 1, 0);
  // Every organ, measured: the AI's outlines, slice by slice; each organ's uptake as a bar; three organs in turn
  a = C.organs.a; b = C.organs.b;
  ramp('body_a', a + 1, a + 4, 1, 0.55);
  ramp('organs_seg', a + 1, a + 12, 0, 1);
  ramp('organs_suv', a + 15, a + 21, 0, 1);
  [['brain', 23], ['liver', 27], ['muscle', 31]].reduce((f0, [id, t]) => { jump('organs_focus', a + t, f0, oi(id)); return oi(id); }, 0);
  jump('organs_focus', a + 35, oi('muscle'), 0);
  cam(a + 1, 'organs', 'seg');
  cam(a + 12, 'organs', 'seg', 12, 'spin');
  cam(a + 15, 'organs', 'bars');
  cam(a + 22, 'organs', 'bars', 6, 'spin');
  cam(b - 0.5, 'organs', 'bars', -6, 'spin');
  // 658 scans: one row, then all of them; the partial correlation of two organs; the network of all scans
  a = C.cohort.a; b = C.cohort.b;
  key('organs_rows', a + 1, 0); key('organs_rows', a + 5, 0.35); key('organs_rows', a + 7, 0.35); key('organs_rows', a + 12, 1);
  if (F.pair) {
    ramp('organs_pair', a + 15, a + 18, 0, 1);   // (the dots rise out of the slab)
    ramp('organs_partial', a + 22, a + 27, 0, 1);
    // then a pair linked only through other organs: back to its raw values, on to it, its partial correlation
    // (organs_pair NPR + 1 is pair 1 again: from there the last pair is a neighbour, the ones between never show)
    if (ind) {
      const np = OP.pairs.length, ii = OP.pairs.indexOf(ind) + 1, from = ii === np ? np + 1 : 1;
      if (from !== 1) jump('organs_pair', a + 28.5, 1, from);
      ramp('organs_partial', a + 28.5, a + 29.5, 1, 0); ramp('organs_pair', a + 28.5, a + 30, from, ii);
      ramp('organs_partial', a + 30.5, a + 34, 0, 1);
      jump('organs_pair', C.health.a, ii, 0);   // (unseen: the network has hidden the panel by then)
    } else jump('organs_pair', C.health.a, 1, 0);
  }
  ramp('organs_net', a + 35, a + 43, 0, 1);
  ramp('organs_rows', a + 34, a + 36.5, 1, 0); ramp('organs_suv', a + 34, a + 36.5, 1, 0);
  // (the slab reaches left of the view's target: nudged clear of the panel)
  cam(a + 1, 'organs', 'matrix', 0, null, [0, 0, 0.35, -0.25]);
  cam(a + 13, 'organs', 'matrix', 10, 'spin', [0, 0, 0.35, -0.25]);
  if (F.pair) { cam(a + 16, 'organs', 'scatter'); cam(a + 34, 'organs', 'scatter', 5, 'spin'); }
  cam(a + 37, 'organs', 'net');
  cam(b - 0.5, 'organs', 'net', 18, 'spin');
  // From health to disease: BMI, the strength distribution, CRP thirds; robust; hexokinase 2 like FDG
  a = C.health.a; b = C.health.b;
  // the networks in turn, each from the one before (a network not read off its figure yet is skipped)
  let w = wi('full');
  // (a direct crossfade over 2 s from the network before, organs_prev, to the new one: easing organs_which would pass
  // through the networks between them in the list)
  const goNet = (id, t) => {
    if (!hasNet(id)) return;
    const n = wi(id);
    key('organs_prev', t - 0.01, w); key('organs_prev', t + 2.05, w);
    jump('organs_which', t, w, n);
    jump('organs_mix', t, 1, 0); key('organs_mix', t + 2, 1);
    w = n;
  };
  goNet('A_low', a + 7); goNet('A_high', a + 12);
  ramp('organs_strength', a + 16, a + 19, 0, 1);
  ramp('organs_strength', a + 35, a + 37, 1, 0);   // (robustness and hexokinase 2: the network alone)
  goNet('C_low', a + 21); goNet('C_mid', a + 25); goNet('C_high', a + 29);
  goNet('FDG_healthy', a + 36); goNet('HK2', a + 41.5);
  cam(a + 1, 'organs', 'net', 18);
  cam(a + 14, 'organs', 'net', 34, 'spin');
  cam(a + 17, 'organs', 'strength');
  cam(a + 34, 'organs', 'strength', 10, 'spin');
  cam(a + 37, 'organs', 'net', 20);
  cam(b - 0.5, 'organs', 'net', 34, 'spin');
  // One scan, one network: bars, ratios, the threshold, the network, the two measures, three profiles in turn
  a = C.one.a; b = C.one.b;
  show('people', a + 0.5, a + 2.5, C.vision.a, C.vision.a + 2);
  ramp('people_bars', a + 2, a + 5, 0, 1);
  ramp('people_ratio', a + 7, a + 11, 0, 1);
  ramp('people_thresh', a + 12, a + 15, 0, 1);
  ramp('people_one', a + 17, a + 22, 0, 1);
  ramp('people_metrics', a + 24, a + 28, 0, 1);
  key('people_profile', a + 31, 0); key('people_profile', a + 33, 1); key('people_profile', a + 35, 1); key('people_profile', a + 38, 3);
  // (the bars first: they stand above the field, about 1.2 wide, before the network pushes them aside)
  const barsV = [-4, -9, -1.4, 0.36, 0.28, -0.1];
  cam(a + 1, 'people', 'one', -10, null, barsV);
  cam(a + 6.5, 'people', 'one', 0, 'spin', barsV);
  cam(a + 10, 'people', 'field');
  cam(a + 15, 'people', 'field', 12, 'spin');
  cam(a + 18, 'people', 'one');
  cam(a + 24, 'people', 'metrics');
  cam(b - 0.5, 'people', 'metrics', 8, 'spin');
  // People: the population by its two measures, the index strip, the groups in turn, survival, immunotherapy, follow-up
  a = C.people.a; b = C.people.b;
  ramp('people_map', a + 1, a + 6, 0, 1);
  for (const n of ['people_bars', 'people_ratio', 'people_thresh', 'people_one', 'people_metrics']) ramp(n, a + 2, a + 6, 1, 0);
  ramp('people_mdi', a + 9, a + 14, 0, 1);
  // each group glows in turn as its number appears in the panel
  P.groups.slice(0, 4).reduce((g0, g, j) => { jump('people_group', a + 14 + 2.5 * j, g0, j + 1); return j + 1; }, 0);
  if (P.groups.length) jump('people_group', a + 25, Math.min(4, P.groups.length), 0);
  ramp('people_km', a + 28, a + 32, 0, 1);
  ramp('people_km', a + 35, a + 37, 1, 0);
  ramp('people_response', a + 36, a + 40, 0, 1);
  ramp('people_response', a + 41, a + 43, 1, 0);
  ramp('people_follow', a + 42, a + 46, 0, 1);
  cam(a + 2, 'people', 'map');
  cam(a + 8, 'people', 'map', 8, 'spin');
  cam(a + 10.5, 'people', 'strip');
  cam(a + 26, 'people', 'strip', 5, 'spin');
  cam(a + 29, 'people', 'km');
  cam(a + 35, 'people', 'km', 4, 'spin');
  cam(a + 37, 'people', 'auc');
  cam(a + 41, 'people', 'auc', 4, 'spin');
  cam(a + 43, 'people', 'strip');
  cam(b - 0.5, 'people', 'strip', 6, 'spin');
  // One scan, one system: the vision row again
  a = C.vision.a; b = C.vision.b;
  show('scan', a + 0.5, a + 2.5);
  // (the scanner comes back as it was at the start: couch out, closed, no events)
  for (const n of ['scan_bed', 'scan_cut', 'scan_lines', 'scan_image']) jump(n, a, 1, 0);
  jump('scan_pass', a, 0.6, 0);
  jump('scan_events', a, 0.4, 0);
  ramp('scan_vision', a + 1, a + 9, 0, 1);
  cam(a + 1.5, 'scan', 'vision', -10, null, rowPad);
  cam(b, 'scan', 'vision', 6, 'spin', rowPad);
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts, the hubs among them; the story adds what the scene alone does not say; the body
  // set labels its organs only with its own network, so its anchors are passed as points)
  const at = (k, n) => () => anchorOf(k, n);
  a = C.body.a;
  label('body', at('body', 'brain'), '<b>Brain</b>the most sugar', a + 11, a + 18, 'amb');
  label('body', at('body', 'heart'), '<b>Heart</b>', a + 12, a + 18, 'amb');
  label('body', at('body', 'kidneys'), '<b>Kidneys</b>into the urine', a + 13.5, a + 18, 'amb');
  label('body', at('body', 'bladder'), '<b>Bladder</b>', a + 14.5, a + 18, 'amb');
  label('organs', 'lesion', '<b>A tumour</b>a hot spot', a + 21, a + 30, 'amb');
}
// camera waypoints: [t, az, el, dist, tx, ty, tz, ease, set, narrow factor]; 'spin' segments turn at a steady pace.
// When the story hands over from one set to another, the new set is turned about its
// vertical axis so that its first view starts where the camera already is: a crossfade
// never swings the camera round. The set keeps that turn while it is on show (setYaw).
function buildCamera(wp) {
  wp.sort((x, y) => x[0] - y[0]);
  const turn = (w, deg) => {
    const r = deg * D2R, x = w[4], z = w[6];
    w[1] += deg; w[4] = x * Math.cos(r) + z * Math.sin(r); w[6] = -x * Math.sin(r) + z * Math.cos(r);
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
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7], w[9] || 1];
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
// the story's view at time t: [az, el, dist, tx, ty, tz, narrow factor]
function storyCam(t) {
  const wp = ST.wp, end = w => [w[1], w[2], w[3], w[4], w[5], w[6], w[8]];
  if (t <= wp[0][0]) return end(wp[0]);
  for (let i = 1; i < wp.length; i++) {
    if (t <= wp[i][0]) {
      const p = wp[i - 1], q = wp[i], x = q[0] > p[0] ? (q[7] === 'spin' ? spinEase : smoothSeg)(t - p[0], q[0] - p[0]) : 1;
      return [p[1] + (q[1] - p[1]) * x, p[2] + (q[2] - p[2]) * x, Math.exp(Math.log(p[3]) + (Math.log(q[3]) - Math.log(p[3])) * x),
        p[4] + (q[4] - p[4]) * x, p[5] + (q[5] - p[5]) * x, p[6] + (q[6] - p[6]) * x, p[8] + (q[8] - p[8]) * x];
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
function buildSetLabels() {
  for (const k of SET_ORDER) for (const L of GL.sets[k].labels || []) {
    const [b, r] = L.text;
    LBL.sets.push({ kind: 'set', el: labelEl(`<b>${esc(b)}</b>${esc(r || '')}`, L.cls), set: k, at: L.at, alpha: L.alpha, minor: !!L.minor, o: -1 });
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
      if (!L.w) { L.w = L.el.offsetWidth || 120; L.h = L.el.offsetHeight || 22; }
      const sx = (_v.x * 0.5 + 0.5) * W;
      x = sx + 9; y = (-_v.y * 0.5 + 0.5) * H - 11;
      if (pr.width && y + L.h > pr.top && y < pr.bottom && x < pr.right + 6) {
        // a point just beside the panel keeps its label next to the panel; one behind it shows none
        if (GL.wide && sx > pr.right - 40) x = pr.right + 6; else o = 0;
      }
      if (y + L.h > barTop - 4 || y < 50) o = 0;
      x = Math.min(x, W - L.w - 6);
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
    const p = $('#panel'), over = fresh.getBoundingClientRect().bottom - (p.getBoundingClientRect().bottom - parseFloat(getComputedStyle(p).paddingBottom));
    if (over > 0) p.scrollTo({ top: p.scrollTop + over, behavior: 'smooth' });
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
}
