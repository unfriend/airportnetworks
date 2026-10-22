
// ================================================================== STORY ==
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Until a narration is recorded, the table sets the
// pace: node tools/pace.mjs writes it from the words on the panel (each stretch
// between two cues lasts long enough to read what appeared at its start; run
// it again after the text changes). A recording replaces it with its own times.
const NARRATION_SYNC = [
  [0, 0], [2.8, 2.4], [6.4, 4], [7.1, 4.6], [14.1, 7], [20.9, 10], [21.6, 10.6],  // Intro
  [32.3, 14], [33, 14.6], [33.9, 15.2], [34.6, 15.8], [46.2, 20.5], [56.2, 27], [67.1, 36.5],
  [70.7, 38.5], [73.7, 41.1], [78.5, 42.5], [81.2, 44.5], [86.7, 47], [87.4, 47.6],  // Slide
  [95.3, 50], [96.7, 51.2], [102.6, 55], [111.8, 63], [122.7, 71],  // Library
  [138.8, 85], [139.5, 85.6], [140.9, 86.5], [181.2, 121.6], [192.4, 125],  // Method
  [199.6, 130], [200.3, 130.6], [202.6, 131.2], [208.7, 136.5], [211, 138], [224.8, 150],
  [230.2, 151], [232.5, 153], [235.7, 155], [241.4, 160], [247.8, 163],  // Atlas
  [256.9, 170], [258.3, 171.2], [265.6, 176], [266.2, 176.6], [276.9, 179.5], [286.5, 184],
  [319.4, 212.6],                                     // Age
  [327.8, 215], [329.1, 216.2], [334.6, 220], [347.2, 231], [357.2, 237], [369.1, 244],  // Disease
  [376, 250], [377.3, 251.2], [384.6, 256], [404.2, 273], [411.4, 278], [412.1, 278.6],  // Contacts
  [436.9, 285], [437.6, 285.6], [438.9, 286.2], [439.6, 286.8], [448.5, 289.5], [458.9, 296],
  [459.6, 296.6], [480.8, 298.5], [483.2, 300.6], [495.7, 305],  // Next
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
  { key: 'title', name: 'Intro', a: 0, b: 14 },
  { key: 'slide', name: 'Slide', a: 14, b: 50 },
  { key: 'library', name: 'Library', a: 50, b: 85 },
  { key: 'method', name: 'Method', a: 85, b: 130 },
  { key: 'atlas', name: 'Atlas', a: 130, b: 170 },
  { key: 'age', name: 'Age', a: 170, b: 215 },
  { key: 'pathology', name: 'Disease', a: 215, b: 250 },
  { key: 'contacts', name: 'Contacts', a: 250, b: 285 },
  { key: 'next', name: 'Next', a: 285, b: 305 },
];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
const C = Object.fromEntries(CH.map(c => [c.key, c]));

// every param of every set, at rest; the sets themselves start hidden
const DEF = {};
function buildDefaults() {
  for (const k of SET_ORDER) Object.assign(DEF, GL.sets[k].params);
  for (const k of SET_ORDER) DEF[k + '_a'] = 0;
  DEF.dots = 0; DEF.dots_pick = 0;   // the engine's own organ points in the body (makeDots)
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
// (the section, 2.1 long, needs about 4 units' distance to fit right of the panel: further back, and moved right)
const SEC = [0, 0, 0.6, -0.22];
const FIT = { atlas: { default: [0, 0, 1.1, -0.22], library: [0, 0, 1.1, -0.22], atlas: [0, 0, 0.8, -0.35], focus: [0, 0, 0.55, -0.05, 0.0], volcano: [0, 0, 0.45, -0.2],
  curves: [0, 0, 1.1, -0.32], age: [0, 0, 0.45, -0.2] },
  body: { default: [0, 0, 0.55], front: [0, 0, 0.55] }, hier: { net: [0, 0, 0.35, 0, 0.05], default: [0, 0, 0.25, 0, 0.03] }, tissue: { default: SEC, section: SEC }, slide: { default: SEC, section: SEC, domains: SEC, age: SEC, tiles: [0, 0, 0.35, -0.25], close: [0, 0, 0.6, -0.14], group: [0, 0, 0.85, -0.17] } };
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen
const NARROW = { tissue: { section: 1.2, default: 1.2 }, slide: { default: 1.2, domains: 1.2, group: 1.25 }, atlas: { library: 1.1, default: 1.1, atlas: 1.2, volcano: 1.15, curves: 1.15 },
  hier: { net: 1.2, default: 1.2 } };
const narrowOf = (k, name) => (NARROW[k] && NARROW[k][name]) || 1;
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

// ------------------------------------------------------------------- data --
// The preprint's numbers and Iva Buljan's network of organ architecture (MICRO_DATA), looked up once for the story and
// the panes. In the network, domains hang on tissue types (not on organs): an organ reaches its domains only through
// the tissue types it has, which other organs share.
const MD = (() => {
  const D = MICRO_DATA, N = D.graph.nodes, adj = N.map(() => new Set());
  for (const [a, b] of D.graph.edges) if (a !== b) { adj[a].add(b); adj[b].add(a); }
  const byName = (i, j) => N[i][0].localeCompare(N[j][0]);
  const nb = (i, level) => [...adj[i]].filter(j => N[j][1] === level).sort(byName);
  const atLevel = level => N.map((n, i) => i).filter(i => N[i][1] === level).sort(byName);
  const types = atLevel(2), domains = atLevel(3);
  const organs = D.organs.map((o, i) => {
    const node = N.findIndex(n => n[1] === 0 && n[0] === o.name), tis = node >= 0 ? nb(node, 1) : [];
    const ty = new Set(node >= 0 ? nb(node, 2) : []);
    tis.forEach(t => nb(t, 2).forEach(x => ty.add(x)));
    return Object.assign({ i, node, tissues: tis.map(t => N[t][0]), types: [...ty].sort(byName) }, o);
  });
  // a tissue type's domains, and the organs that have it (directly or through one of their tissues)
  const typeDomains = t => nb(t, 3);
  const typeOrgans = t => organs.filter(o => o.types.includes(t));
  const typeOfDomain = d => nb(d, 2)[0] ?? -1;
  return { D, N, adj, organs, types, domains, typeDomains, typeOrgans, typeOfDomain,
    organ: name => organs.find(o => o.name.toLowerCase() === String(name || '').toLowerCase()) || null,
    domain: name => domains.find(d => N[d][0].toLowerCase() === String(name || '').toLowerCase()) ?? -1,
    type: name => types.find(t => N[t][0].toLowerCase() === String(name || '').toLowerCase()) ?? -1 };
})();
const nodeName = i => (MD.N[i] ? MD.N[i][0] : '');
const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
// a GTEx tissue's own part, for a list under its organ ('Adipose - Subcutaneous' under Adipose: 'Subcutaneous')
const tisShort = (t, organ) => (t.startsWith(organ + ' - ') ? t.slice(organ.length + 3) : t);
// the network's four levels and their colours (as in the talk's Figure 5)
const LEVEL_COL = ['#1f8a4c', '#7ccf7e', '#ef8f7a', '#5aa9ff'];
const levelName = l => (MICRO_DATA.levels || ['organ', 'tissue', 'tissue type', 'domain'])[l];
// what the sets know (their api()): the atlas's 40 tissues, the slide's domains, the network's nodes and contact organs
const setApi = k => (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null);
const API = {};
const api = k => API[k] || (API[k] = setApi(k) || {});
// a domain's colour, the same in every set (the atlas set's palette; else the slide's; else a fixed one by name)
const PAL = ['#ff9ec4', '#ffd166', '#4d94ff', '#3ee08f', '#c77dff', '#ff8a5b', '#46d9ff', '#f4a6ff', '#b8e05a', '#ff5a7a'];
function domCol(name) {
  for (const k of ['atlas', 'slide']) { const f = api(k).domainColour; if (f) { try { const c = f(name); if (c) return c; } catch (e) { /* the next */ } } }
  let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PAL[h % PAL.length];
}
// an organ's section in the atlas (atlas_focus: a tissue's index + 1; 0 none): its own tissue, or its first
const atlasIdx = name => {
  const T = api('atlas').tissues || [], n = String(name || '').toLowerCase();
  const i = T.findIndex(t => t.toLowerCase() === n), j = i >= 0 ? i : T.findIndex(t => t.toLowerCase().startsWith(n + ' - '));
  return j + 1;
};
// the organ a tissue of the atlas belongs to
const tissueOrgan = t => { const s = String(t || ''); return MD.organs.find(o => s === o.name || s.startsWith(o.name + ' - ') || o.tissues.includes(s)) || null; };
// a node of the network set by name and level (hier_focus), or -1
const hierIdx = (name, level) => { const L = api('hier').nodes || []; const n = String(name || '').toLowerCase(); return L.findIndex(x => x.level === level && String(x.name).toLowerCase() === n); };
// a domain of the network on the slide (slide_focus: its index + 1; 0 none): the same name, or one that starts alike
// ('muscularis' and 'muscularis inner', 'lymphoid Peyer patches' and 'lymphoid')
function slideIdx(name) {
  const L = (api('slide').domains || []).map(x => String(x).toLowerCase()), n = String(name || '').toLowerCase();
  if (!n) return 0;
  let i = L.indexOf(n);
  if (i < 0) i = L.findIndex(x => x.startsWith(n + ' ') || n.startsWith(x + ' '));
  if (i < 0) i = L.findIndex(x => x.split(' ')[0] === n.split(' ')[0]);
  return i + 1;
}
// the network's domain a slide domain stands for (its name, or the one that starts alike), or ''
function slideDomain(k) {
  const s = String((api('slide').domains || [])[k] || '').toLowerCase();
  if (!s) return '';
  const D = MD.domains.map(d => nodeName(d));
  return D.find(n => n.toLowerCase() === s) || D.find(n => s.startsWith(n.toLowerCase() + ' ') || n.toLowerCase().startsWith(s + ' '))
    || D.find(n => n.toLowerCase().split(' ')[0] === s.split(' ')[0]) || '';
}
// the contact networks' organs (hier_organ: an index into them) and the preprint's findings for one of them
const contactIdx = re => Math.max(0, (api('hier').contactOrgans || []).findIndex(o => re.test((o && o.name) || o)));
// the talk's figures, when read: the domains drawn for a tissue ({ name, share }), else none. The figures name tissues
// their own way ('Artery coronary', 'Tibial nerve', 'Aorta'): a reading fits a GTEx tissue when all its words are in it
const words = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').split(/[^a-z]+/).filter(Boolean);
const tidyDom = s => String(s).replace(/pathches/g, 'patches').replace(/adventita/g, 'adventitia').replace(/\bmedula\b/g, 'medulla').replace(/\s*\/\s*/g, ' and ');
// (a reading named only by its organ, 'Colon' or 'Heart', fits no tissue of an organ sampled at two sites: which one the
// talk shows is not said)
function figDomains(tissue) {
  const A = (MICRO_DATA.figures || {}).atlas, w = words(tissue), O = tissueOrgan(tissue);
  if (!Array.isArray(A) || !w.length) return [];
  const only = x => O && O.tissues.length > 1 && words(x).join() === words(O.name).join();
  const e = A.find(x => x && words(x.tissue).join() === w.join()) || A.find(x => x && words(x.tissue).length && !only(x.tissue) && words(x.tissue).every(q => w.includes(q)));
  return e && Array.isArray(e.domains) ? e.domains.filter(d => d && d.name && !/tissue edge/i.test(d.name)).map(d => ({ name: tidyDom(d.name), share: +d.share || 0 })) : [];
}

// ------------------------------------------------------------------ facts --
// Numbers and findings the story quotes, all from MICRO_DATA (a finding not there leaves its sentence out)
const FACTS = (() => {
  const D = MICRO_DATA, F = D.facts, fd = D.findings || {}, path = fd.pathology || [], inter = fd.interactions || [];
  const lv = [0, 0, 0, 0];
  D.graph.nodes.forEach(n => { lv[n[1]]++; });
  // the tissue type shared most widely: the one most organs have
  const wide = MD.types.map(t => ({ name: nodeName(t), organs: MD.typeOrgans(t).length })).sort((a, b) => b.organs - a.organs)[0] || null;
  const yr = /bioRxiv (\d{4})/.exec(D.source.preprint || '');
  return Object.assign({}, F, {
    tilesM: Math.round(F.tiles / 1e6), levels: lv, wide, year: yr ? +yr[1] : null,
    plaque: path.find(p => /plaque/i.test(p.kind)) || null, infarct: path.find(p => /infarct/i.test(p.kind)) || null,
    remodel: path.filter(p => !/plaque|infarct/i.test(p.kind)),
    colon: inter.find(x => /colon/i.test(x.organ) && x.a) || null, artery: inter.find(x => /arter/i.test(x.organ) && x.a) || null, inter,
    ex: D.examples || [], most: fd.most || '', connective: fd.connective || '', stable: fd.stable || '',
    figs: Object.keys(D.figures || {}),
  });
})();
const listOf = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] || String(n);
const pct = v => (Number.isFinite(+v) ? `${+v}%` : '–');
const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
// colours as text on the HTML panel, which is light in the light theme: a colour mixed with the panel's ink (darker on a
// light panel, lighter on a dark one). The headset's panel is dark: its canvas twin takes the colour itself (data-col).
const inkCol = c => `color-mix(in srgb, ${c} 55%, var(--ink))`;
const swCol = c => c;   // a swatch or a bar in the same colour
// a worked example of change with age in a line: what it is, its share at both ages and per decade
const exText = x => `${x.note}; ${pct(x.from)} of the section at ${FACTS.ages[0]}, ${pct(x.to)} at ${FACTS.ages[1]} (${signed(x.perDecade)}% per decade)`;
const exName = x => `${cap(x.tissue)} · ${x.domain}`;
// a change in the contacts between two domains, in words
// where a finding is ('in arteries', 'in the heart')
const inOrgan = o => (/^arter/i.test(o) ? 'in arteries' : `in the ${String(o).toLowerCase()}`);
const where = x => (x.note && /arter/i.test(x.note) ? x.note : `the ${String(x.organ).toLowerCase()}`);
const meet = x => (x.a ? `${cap(x.a)} and ${x.b} meet ${x.dir > 0 ? 'more' : 'less'} with age in ${where(x)}` : `In ${where(x)}, ${x.note}`);

function buildStory() {
  const F = FACTS;
  // fade a set in over [t0, t1] and out over [t2, t3]; the slide always comes with the tissue section it lies on
  const show = (k, t0, t1, t2, t3) => {
    for (const s of k === 'slide' ? ['tissue', 'slide'] : [k]) { ramp(s + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(s + '_a', t2, t3, 1, 0); }
  };
  const hide = (k, t0, t1) => { for (const s of k === 'slide' ? ['tissue', 'slide'] : [k]) ramp(s + '_a', t0, t1, 1, 0); };
  // jump an index param (a domain, a tissue, an organ) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const sd = (...names) => names.reduce((f, n) => f || slideIdx(n), 0);   // slide_focus for a domain of the section (the first name it has)
  // atlas_focus for each worked example (the atlas set's own choice, else by name; the gut's is shown on the slide)
  const exI = F.ex.map((x, i) => (Array.isArray(api('atlas').examples) && api('atlas').examples[i] >= 0 ? api('atlas').examples[i] + 1 : atlasIdx(x.tissue)));
  const step = (at, out, col, b, text) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  const exCol = ['#ff9ec4', '#ffd166', '#c77dff'];
  // ------------------------------------------------------------ panel copy
  // parts of a chapter that take turns in one place, each fading out (data-out) as the next comes: the headset's
  // panel cannot scroll, so no chapter shows more than fits at once
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const others = F.inter.filter(x => x !== F.colon && x !== F.artery).map(x => (x.a ? `${x.a} and ${x.b} meet ${x.dir > 0 ? 'more' : 'less'} in ${where(x)}` : `in ${where(x)}, ${x.note}`));
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">Tissue and time</h1>
      <p class="lede" data-at="2.4">how organs are built, and how they age</p>
      <p data-at="4">How the body's organs are built from small working units, and how they change as we age.</p>
      <p data-at="7">Each point of light is one of the ${F.organs} organs whose tissue GTEx collected from ${fmt(F.donors)} people.</p>
      <p class="note" data-at="10">After a preprint${F.year ? ` (bioRxiv, ${F.year})` : ''}, a poster and a talk from the Rendeiro group: CeMM, the LBI for Network Medicine and the Medical University of Vienna.</p>`,
    slide: `<h2 data-at="0.6">One slide</h2>
      ${turns(`<p data-at="1.2" data-out="21.5">Take a thin slice of an organ, here the wall of the stomach, and stain it. This is H&amp;E (haematoxylin and eosin), the standard stain of pathology.</p>
        <p data-at="6.5" data-out="21.5">Haematoxylin colours the cells' nuclei purple-blue; eosin colours their cytoplasm and the fibres between them pink. White is fat, or empty space.</p>
        <p data-at="13" data-out="21.5">Close up, it is all cells. Yet they are not scattered at random: they are arranged in units that each do a job.</p>`,
      `<ul class="steps">
          ${step(22.5, 0, domCol('mucosa'), 'Mucosa', 'the lining: glands that make mucus and acid')}
          ${step(24.5, 0, domCol('submucosa'), 'Submucosa', 'loose tissue with blood vessels')}
          ${step(26.5, 0, domCol('inner circular smooth muscle'), 'Muscularis', 'layers of muscle, one around and one along, that move food on')}
          ${step(28.5, 0, domCol('lymphoid tissue'), 'Lymphoid patch', 'a cluster of immune cells')}
        </ul>
        <p data-at="30.5" class="amber">Such recurring arrangements are microanatomical domains: the units between cells and organs.</p>
        <p class="credits" data-at="33">Slides like this are cheap, plentiful and show a wide field. This section is drawn, not a real slide.</p>`)}`,
    library: `<h2 data-at="0.6">${fmt(F.slides)} slides</h2>
      <p data-at="1.2">GTEx (the Genotype-Tissue Expression project) collected tissue from ${fmt(F.donors)} people who died aged ${F.ages[0]} to ${F.ages[1]}.</p>
      <div class="facts"><div data-at="5"><b>${fmt(F.donors)}</b><small>people</small></div><div data-at="6.5"><b>${F.tissues}</b><small>tissues</small></div><div data-at="8"><b>${F.organs}</b><small>organs</small></div><div data-at="9.5"><b>${fmt(F.slides)}</b><small>slides</small></div></div>
      <p data-at="13">Each slide is one tissue of one person. Here each column is a tissue, and each row an age, the youngest at the bottom.</p>
      <p data-at="21" class="amber">Enough to compare how organs are built, and to see how that changes with age.</p>
      <p class="credits" data-at="27">${fmt(F.donorsAnalysed)} people's slides were analysed: median age ${F.medianAge}, ${pct(F.male)} men. The slides here are drawn, not the GTEx images.</p>`,
    method: `<h2 data-at="0.6">Finding the domains</h2>
      ${turns(`<ul class="steps">
          ${step(1.5, 36.5, '#46d9ff', '1 · Tiles', `each slide is cut into small squares (far smaller than drawn here): ${F.tilesM} million tiles in all`)}
          ${step(9.5, 36.5, '#46d9ff', '2 · Features', 'a deep-learning vision model describes each tile with a list of numbers (drawn here as 16 blocks of colour)')}
          ${step(17.5, 36.5, '#46d9ff', '3 · Neighbours', 'joined to its neighbours, each tile mixes in their descriptions: messages run along the links (message passing)')}
          ${step(26.5, 36.5, '#46d9ff', '4 · Domains', 'in a map of the mixed descriptions, alike tiles gather, across all slides: each group is a domain, and colours the slide')}
        </ul>`,
      `<p data-at="37">No labels needed: a pathologist named the domains afterwards. The method, ${esc(F.method)}, agrees with pathologists' notes (salivary gland r = ${F.bench.salivary.r}, stomach mucosa r = ${F.bench.stomach.r}; r = 1 would be perfect).</p>
        <p data-at="41" class="amber">Now the tiles of every tissue in one map: alike tiles lie close together, coloured by domain.</p>`)}`,
    atlas: `<h2 data-at="0.6">An atlas of the body</h2>
      ${turns(`<p data-at="1.2" data-out="19.5">Across the ${F.tissues} tissues: ${F.domains} domains of ${F.types} types, in ${F.superclasses} classes.</p>
        <div class="facts"><div data-at="5" data-out="19.5"><b>${F.types}</b><small>types of domain</small></div><div data-at="6.5" data-out="19.5"><b>${pct(F.shared3)}</b><small>in three or more tissues</small></div><div data-at="8" data-out="19.5"><b>${pct(F.specific)}</b><small>in one tissue only</small></div></div>
        <p data-at="11" data-out="19.5">A few kinds recur in many tissues, such as connective tissue and blood vessels. Most belong to one tissue.</p>`,
      `<p data-at="20">Iva Buljan's network of organ architecture puts it together in four levels:</p>
        <ul class="legend">${[`${F.levels[0]} organs`, `their tissues, where an organ has several (${F.levels[1]})`, `${F.levels[2]} tissue types`, `${F.levels[3]} domains, as named in this map`].map((t, l) => `<li data-at="${21 + 2 * l}"><span class="sw" style="background:${LEVEL_COL[l]}"></span>${t}</li>`).join('')}</ul>
        ${F.wide ? `<p data-at="30" class="amber">${esc(cap(F.wide.name))} is the tissue type shared most widely: ${F.wide.organs} of the ${F.organs} organs have it.</p>` : ''}
        <p class="credits" data-at="33">The network as in the talk's Figure 5: domains hang on tissue types, and tissue types on organs and their tissues.</p>`)}`,
    age: `<h2 data-at="0.6">Age</h2>
      ${turns(`<p data-at="1.2" data-out="13.5">Of ${F.donorVars} things known about the donors, age is the strongest in explaining how their domains differ.</p>
        <p data-at="6" data-out="13.5" class="amber">${pct(F.ageChange)} of domains change with age (${F.agePairs[0]} of ${F.agePairs[1]} pairs of a domain and a tissue, where the domain covers more than ${pct(F.agePairsMin)}), mostly by less than ${pct(F.mostUnder)} per decade.</p>
        <p class="credits" data-at="9.5" data-out="13.5">Each bubble is a domain in a tissue: right, it grows with age; left, it shrinks; higher, the change is surer.</p>`,
      `<ul class="steps">${F.ex.map((x, i) => step(14 + 10 * i, 0, exCol[i], exName(x), esc(exText(x)))).join('')}</ul>
        <p data-at="42">${esc(F.connective)} ${esc(F.most)}</p>`)}`,
    pathology: `<h2 data-at="0.6">Disease</h2>
      ${turns(`<p data-at="1.2" data-out="15.5">GTEx's pathologists noted what they saw on each slide: ${fmt(F.pathology.instances)} notes of ${F.pathology.kinds} kinds.</p>
        <ul class="steps">${[F.plaque, F.infarct].filter(Boolean).map((p, i) => step(5 + 4 * i, 15.5, i ? '#ff5a4b' : '#ffb43b', cap(p.kind), `${esc(inOrgan(p.organ))}: ${esc(p.note)}`)).join('')}</ul>`,
      `<p data-at="16" class="amber">Disease and healthy ageing often remodel different parts of a tissue: how much of a domain there is, its shape, or both.</p>
        ${F.remodel.length ? `<p data-at="22">For example: ${esc(F.remodel.map(p => `${p.kind} ${p.note}`).join('; '))}.</p>` : ''}
        <p class="credits" data-at="29">${F.figs.includes('trajectories') ? 'Curves read off the talk\'s figures.' : 'Curves drawn after the preprint\'s descriptions, not its data points.'}</p>`)}`,
    contacts: `<h2 data-at="0.6">Neighbours</h2>
      ${turns(`<p data-at="1.2" data-out="16.5">Domains touch. Which ones meet, and how much, makes a network of contacts in each organ.</p>
        ${F.colon ? `<p data-at="6" data-out="16.5">${esc(meet(F.colon))}.</p>` : ''}`,
      `${F.artery ? `<p data-at="17">${esc(meet(F.artery))}.</p>` : ''}
        ${F.stable ? `<p data-at="23" class="amber">${esc(F.stable)}</p>` : ''}
        ${others.length ? `<p class="credits" data-at="28">Also: ${esc(others.join('; '))}. Contact networks drawn after the preprint's findings.</p>` : ''}`)}`,
    next: `<h2 data-at="0.6">Tissue and time</h2>
      ${turns(`<p data-at="1.2" data-out="10.5">A map of how the body is built, from cells to domains to organs, and of how it changes with age.</p>
        <p data-at="4.5" data-out="10.5" class="amber">It may help to study ageing itself, to spot early signs of disease in routine slides, and to compare organs on one scale.</p>`,
      `<p data-at="11">Preprint: Iva Buljan, Z. Bagó-Horváth and A. F. Rendeiro${F.year ? ` (bioRxiv, ${F.year})` : ''}. Poster and talk: Iva Buljan, of the Rendeiro group at CeMM (Research Center for Molecular Medicine of the Austrian Academy of Sciences), the LBI for Network Medicine and the Medical University of Vienna. Slides: ${esc(F.gtex)}.</p>
        <p data-at="13.5"><button class="btn primary" id="btnGoExplore" type="button">Explore the atlas</button></p>
        <p class="credits" data-at="15">Slides, sections and tiles are drawn, not the GTEx images; the domain maps, the volcano's other points and the contact networks are illustrative where the figures give no numbers.</p>`)}`,
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
  // (the tissue and the slide share one frame, so their waypoints turn them together)
  const cam = (t, k, name, spin, ease, nudge) => {
    const v = view(k, name);
    v[0] += spin || 0;
    if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0;
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name)]);
  };
  start({ body_pet: 1, body_net: 0, body_state: 0, body_blank: 0, dots: 0, dots_pick: 0, tissue_graph: 0, tissue_mark: 0, tissue_embed: 0,
    slide_tiles: 0, slide_feat: 0, slide_adj: 0, slide_group: 0, slide_domain: 0, slide_age: 0, slide_focus: 0,
    atlas_lib: 0, atlas_map: 0, atlas_umap: 0, atlas_focus: 0, atlas_age: 0, atlas_volcano: 0, atlas_curves: 0,
    hier_grow: 0, hier_focus: -1, hier_contacts: 0, hier_organ: 0, hier_age: 0 });
  const stomach = MD.organs.findIndex(o => /stomach/i.test(o.name)) + 1;
  if (stomach) ORGAN3D.want(ORGAN3D.idOf(MD.organs[stomach - 1].name));   // (its model is the first the story shows: built first)
  let a, b;
  // Intro: the tour's PET body, the organs' points lighting up one by one
  a = C.title.a; b = C.title.b;
  show('body', 0.2, 2);
  ramp('dots', a + 3, a + 7, 0, 1);
  cam(a, 'body', 'front', -14);
  cam(b - 2.5, 'body', 'front', 8, 'spin');
  // One slide: into the stomach (its point glows), the section, close up, then its domains wash in, one by one
  a = C.slide.a; b = C.slide.b;
  jump('dots_pick', a - 2.5, 0, stomach);
  const st = (MD.organs[stomach - 1] || { pos: [0, 0, 0] }).pos;
  cam(a + 1.5, 'body', 'front', 4, null, [0, 0, -2.6, st[0], st[1], st[2]]);
  hide('body', a + 1.2, a + 3);
  show('slide', a + 1.8, a + 4);
  cam(a + 4, 'tissue', 'section', -8);
  cam(a + 11, 'tissue', 'section', 6, 'spin');
  cam(a + 15, 'tissue', 'zoom');
  cam(a + 20, 'tissue', 'zoom', 10, 'spin');
  cam(a + 23.5, 'slide', 'domains', -6);
  cam(b - 0.5, 'slide', 'domains', 6, 'spin');
  ramp('slide_domain', a + 22, a + 27, 0, 1);
  // (each glows as its line appears; one the section does not have is skipped; then all of them again)
  let f0 = 0;
  for (const [f, t] of [[sd('mucosa'), 22.5], [sd('submucosa'), 24.5], [sd('inner circular smooth muscle', 'muscularis'), 26.5], [sd('outer longitudinal smooth muscle'), 27.5],
    [sd('lymphoid tissue', 'lymphoid'), 28.5], [-1, 30.5]]) if (f && f !== f0) { const v = Math.max(0, f); jump('slide_focus', a + t, f0, v); f0 = v; }
  // 24,945 slides: the library, column by tissue, row by age
  a = C.library.a; b = C.library.b;
  hide('slide', a, a + 2);
  show('atlas', a + 0.5, a + 2.5);
  ramp('atlas_lib', a + 1, a + 14, 0, 1);
  // (the slides burst onto the wall; the camera goes along the rack up close, glass slides with their tissue, then
  // back to the whole wall)
  cam(a + 1, 'atlas', 'library', -12);
  cam(a + 6, 'atlas', 'shelf');
  cam(a + 11, 'atlas', 'shelf', 8, 'spin');
  cam(a + 16.5, 'atlas', 'library', -4);
  cam(b - 0.5, 'atlas', 'library', 12, 'spin');
  // Finding the domains: back at the section, the four steps, built as the tour builds its cell network: the tiles,
  // their features lighting up (16 blocks each), a network over them whose links carry messages, the lift into a map
  // of the mixed descriptions where alike tiles gather and take their domain's colour, and back down onto the slide;
  // then the tile cloud of all slides
  a = C.method.a; b = C.method.b;
  hide('atlas', a, a + 2);
  jump('slide_domain', a, 1, 0);
  show('slide', a + 0.5, a + 2.5, a + 37, a + 39);
  ramp('slide_tiles', a + 2, a + 8, 0, 1);
  ramp('slide_feat', a + 9.5, a + 15.5, 0, 1);
  ramp('slide_adj', a + 17.5, a + 24, 0, 1);
  ramp('slide_group', a + 26.5, a + 30.5, 0, 1);
  ramp('slide_group', a + 33, a + 35.5, 1, 2);
  ramp('slide_domain', a + 33.5, a + 36, 0, 1);
  cam(a + 2, 'slide', 'tiles', -8);
  cam(a + 8, 'slide', 'tiles', 4, 'spin');
  cam(a + 10.5, 'slide', 'matrix');
  cam(a + 16, 'slide', 'matrix', 6, 'spin');
  cam(a + 18.5, 'slide', 'close');
  cam(a + 25, 'slide', 'close', 8, 'spin');
  cam(a + 28.5, 'slide', 'group');
  cam(a + 33, 'slide', 'group', 6, 'spin');
  cam(a + 36, 'slide', 'domains');
  // (the sections come forward from the library's wall, and the tiles rise out of them)
  show('atlas', a + 37.5, a + 39.5);
  ramp('atlas_map', a + 37.5, a + 40, 0, 1);
  ramp('atlas_umap', a + 40, a + 44, 0, 1);
  cam(a + 39, 'atlas', 'umap', -10);
  cam(b - 0.5, 'atlas', 'umap', 25, 'spin');
  // An atlas of the body: a section per tissue; then the network of organ architecture growing level by level
  a = C.atlas.a; b = C.atlas.b;
  ramp('atlas_umap', a + 1, a + 4, 1, 0);
  cam(a + 2.5, 'atlas', 'atlas', -6);
  cam(a + 18, 'atlas', 'atlas', 8, 'spin');
  hide('atlas', a + 19, a + 21);
  show('hier', a + 19.5, a + 21.5);
  ramp('hier_grow', a + 21, a + 29, 0, 1);
  // (the tissue type shared most widely lights up with its line)
  const wideN = F.wide ? hierIdx(F.wide.name, 2) : -1;
  if (wideN >= 0) { jump('hier_focus', a + 30, -1, wideN); jump('hier_focus', b - 0.5, wideN, -1); }
  cam(a + 20.5, 'hier', 'net', -15);
  cam(b - 0.5, 'hier', 'net', 25, 'spin');
  // Age: the volcano; then the three examples in turn (the ovary, the gut on the slide, the pituitary)
  a = C.age.a; b = C.age.b;
  hide('hier', a, a + 2);
  show('atlas', a + 0.5, a + 2.5, a + 24, a + 26);
  ramp('atlas_volcano', a + 2, a + 8, 0, 1);
  cam(a + 2, 'atlas', 'volcano', -8);
  cam(a + 13, 'atlas', 'volcano', 6, 'spin');
  ramp('atlas_volcano', a + 14, a + 16, 1, 0);
  if (exI[0]) jump('atlas_focus', a + 14, 0, exI[0]);
  ramp('atlas_age', a + 17, a + 23, 0, 1);
  cam(a + 15.5, 'atlas', 'focus');
  cam(a + 23.5, 'atlas', 'focus', 8, 'spin');
  // (the gut's submucosa on the section: its share falls as the age goes from 20 to 70)
  jump('slide_tiles', a, 1, 0); jump('slide_adj', a, 1, 0); jump('slide_feat', a, 1, 0); jump('slide_group', a, 2, 0);
  show('slide', a + 24.5, a + 26.5, a + 34, a + 36);
  jump('slide_focus', a + 24, 0, sd('submucosa'));
  ramp('slide_age', a + 27, a + 33, 0, 1);
  cam(a + 25, 'slide', 'age', -6);
  cam(a + 33.5, 'slide', 'age', 6, 'spin');
  show('atlas', a + 34, a + 36);
  if (exI[0] || exI[2]) jump('atlas_focus', a + 30, exI[0], exI[2]);
  jump('atlas_age', a + 30, 1, 0);
  ramp('atlas_age', a + 37, a + 42, 0, 1);
  cam(a + 35, 'atlas', 'focus', -6);
  cam(b - 0.5, 'atlas', 'focus', 8, 'spin');
  // Disease: the trajectories over age
  a = C.pathology.a; b = C.pathology.b;
  ramp('atlas_curves', a + 1.5, a + 7, 0, 1);
  jump('atlas_focus', a + 2.6, exI[2], 0); jump('atlas_age', a + 2.6, 1, 0);
  cam(a + 2, 'atlas', 'curves', -6);
  cam(b - 0.5, 'atlas', 'curves', 8, 'spin');
  // Neighbours: the colon's domain contacts, then the coronary artery's, each from age 20 to 70
  a = C.contacts.a; b = C.contacts.b;
  hide('atlas', a, a + 2);
  jump('hier_contacts', a, 0, 1);
  jump('hier_organ', a, 0, contactIdx(/colon/i));
  show('hier', a + 0.5, a + 2.5);
  ramp('hier_age', a + 7, a + 14, 0, 1);
  // (the switch to the artery behind a short fade)
  ramp('hier_a', a + 15.5, a + 16.8, 1, 0); ramp('hier_a', a + 17.2, a + 18.6, 0, 1);
  jump('hier_organ', a + 17, contactIdx(/colon/i), contactIdx(/coronary|arter/i));
  jump('hier_age', a + 17, 1, 0);
  ramp('hier_age', a + 19, a + 26, 0, 1);
  cam(a + 2, 'hier', 'contacts', -10);
  cam(a + 16, 'hier', 'contacts', 6, 'spin');
  cam(a + 18, 'hier', 'contacts', -6);
  cam(b - 0.5, 'hier', 'contacts', 8, 'spin');
  // Tissue and time: the body and its organs again
  a = C.next.a; b = C.next.b;
  hide('hier', a, a + 2);
  show('body', a + 0.5, a + 2.5);
  jump('dots_pick', a, stomach, 0);
  cam(a + 1, 'body', 'front', -16);
  cam(b, 'body', 'front', 10, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  const at = (k, n) => () => anchorOf(k, n);
  const dotAt = name => (MD.organ(name) || { pos: [0, 0, 0] }).pos;
  a = C.title.a;
  label('body', dotAt('Brain'), `<b>${F.organs} organs</b>`, a + 7, C.slide.a - 3, 'mag');
  label('body', st, '<b>Stomach</b>', C.slide.a - 2.5, C.slide.a + 1.6, 'mag');
  a = C.slide.a;
  label('tissue', at('tissue', 'mucosa'), '<b>Nuclei</b>purple-blue: haematoxylin', a + 7, a + 13, 'amb');
  label('tissue', at('tissue', 'submucosa'), '<b>Fibres</b>pink: eosin', a + 8, a + 13, 'amb');
  label('tissue', at('tissue', 'vessel'), '<b>A blood vessel</b>', a + 9.5, a + 13, 'amb');
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
// (the tissue and the slide share one turn: one frame)
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
    const [b, r] = L.text;
    LBL.sets.push({ kind: 'set', el: labelEl(`<b>${esc(b)}</b>${sfxSpan(r)}`, L.cls), set: k, at: L.at, alpha: L.alpha, minor: !!L.minor, o: -1 });
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
