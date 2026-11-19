//#use head
// ================================================================== STORY ==
// Narration timing: [time in the recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands on
// the matching sentence. The story is narrated by a synthetic voice
// (audio/narration-micro.mp3, Kokoro's af_heart): node tools/voice/narrate.mjs
// micro writes this table and NARRATION_ENDS from the recording it makes (each
// stretch lasts the longer of 1.1 times its story time and its line's audio
// plus a pause); run it again after the text changes (see
// tools/voice/README.md).
const NARRATION_SYNC = [
  [0, 0], [1.32, 1.2], [3.77, 2.4], [6.79, 4], [12.37, 7], [13.03, 7.6], [20.59, 10], [21.25, 10.6],
  [34.56, 13.3],                                      // Intro
  [35.33, 14], [36.63, 15.18], [38.23, 15.2], [48.89, 20.5], [59.5, 27], [70.61, 37.1],
  [74.53, 38.5], [77.99, 40.5], [78.65, 41.1], [83.81, 42.5], [87.17, 44.5], [93.5, 49.3],  // Slide
  [94.27, 50], [95.57, 51.18], [99.3, 51.2], [99.96, 51.8], [108.76, 55], [111.2, 56.5],
  [113.09, 58], [115.15, 59.5], [119.02, 63],         // Library
  [143.22, 85], [144.54, 86.2], [146.4, 86.5], [155.9, 94.5], [164.7, 102.5], [174.63, 111.5],
  [186.84, 122.6], [204.8, 126], [211.26, 129.3],     // Method
  [212.03, 130], [213.32, 131.18], [215.41, 131.2], [222.15, 135], [224.57, 136.5], [227.73, 138],
  [241.59, 150.6], [246.28, 151], [248.48, 153], [251.95, 155],  // Atlas
  [268.45, 170], [269.74, 171.18], [271.13, 171.2], [278.39, 176], [292.4, 184], [308.28, 194],
  [323.89, 204], [338.51, 212], [339.17, 212.6], [350.18, 214.3],  // Age
  [350.95, 215], [352.24, 216.18], [353.78, 216.2], [354.44, 216.8], [362.43, 220], [367.84, 224],
  [375.54, 231], [383.72, 237], [398.07, 249.3],      // Disease
  [398.84, 250], [400.14, 251.18], [401.64, 251.2], [407.68, 256],  // Contacts
  [439.58, 285], [440.88, 286.18], [442.7, 286.2], [449.62, 289.5], [458.12, 296], [458.78, 296.6],
  [485.32, 304.3], [486.09, 305],                     // Next
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { title: 34.35, slide: 93.3, library: 132.8, method: 211.05, atlas: 263.65, age: 349.95, pathology: 397.85, contacts: 432.7, next: 485.1 };
//#use storyT narrT T_END
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
//#use C DEF
function buildDefaults() {
  for (const k of SET_ORDER) Object.assign(DEF, GL.sets[k].params);
  for (const k of SET_ORDER) DEF[k + '_a'] = 0;
  DEF.dots = 0; DEF.dots_pick = 0;   // the engine's own organ points in the body (makeDots)
}
//#use TR key ramp evalTrack storyState fadeVal ST view fitShift
// views whose parts reach under the side panel or off the right edge on a landscape screen: a little further back,
// or their target moved, so they fit beside the panel (added to the set's own view, in story and explore mode alike)
// (measured at 1280 x 760: each view's parts between the panel's right edge and the screen's, above the timeline)
// (the section, 2.1 long, needs about 4 units' distance to fit right of the panel: further back, and moved right)
const SEC = [0, 0, 0.6, -0.22];
const FIT = { atlas: { default: [0, 0, 1.1, -0.22], library: [0, 0, 1.1, -0.22], atlas: [0, 0, 0.8, -0.35], focus: [0, 0, 0.55, -0.05, 0.0], volcano: [0, 0, 0.45, -0.2],
  curves: [0, 0, 1.1, -0.32], age: [0, 0, 0.45, -0.2] },
  body: { default: [0, 0, 0.55], front: [0, 0, 0.55] }, hier: { net: [0, 0, 0.35, 0, 0.05], default: [0, 0, 0.25, 0, 0.03], grow: [0, 0, 0.8, -0.18, 0.02] }, tissue: { default: SEC, section: SEC }, slide: { default: SEC, section: SEC, domains: SEC, age: SEC, tiles: [0, 0, 0.35, -0.25], close: [0, 0, 0.6, -0.14], group: [0, 0, 0.85, -0.17] } };
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen
const NARROW = { tissue: { section: 1.2, default: 1.2 }, slide: { default: 1.2, domains: 1.2, group: 1.25 }, atlas: { library: 1.1, default: 1.1, atlas: 1.2, volcano: 1.15, curves: 1.15 },
  hier: { net: 1.2, default: 1.2, grow: 1.2 } };
//#use narrowOf anchorOf
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
//#use cap
// a GTEx tissue's own part, for a list under its organ ('Adipose - Subcutaneous' under Adipose: 'Subcutaneous')
const tisShort = (t, organ) => (t.startsWith(organ + ' - ') ? t.slice(organ.length + 3) : t);
// the network's four levels and their colours (as in the talk's Figure 5)
const LEVEL_COL = ['#1f8a4c', '#7ccf7e', '#ef8f7a', '#5aa9ff'];
const levelName = l => (MICRO_DATA.levels || ['organ', 'tissue', 'tissue type', 'domain'])[l];
// what the sets know (their api()): the atlas's 40 tissues, the slide's domains, the network's nodes and contact organs
const setApi = k => (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null);
//#use API
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
//#use listOf word
const pct = v => (Number.isFinite(+v) ? `${+v}%` : '–');
const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
//#use inkCol~2 swCol
// a worked example of change with age in a line: what it is, its share at both ages and per decade
const exText = x => `${x.note}, from ${pct(x.from)} of the section at ${FACTS.ages[0]} to ${pct(x.to)} at ${FACTS.ages[1]}, ${signed(x.perDecade)}% per decade`;
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
      <p class="lede" data-at="2.4">How organs are built, and how they age</p>
      <p data-at="4">The body's organs are built from small working units, and they change as we age.</p>
      <p data-at="7">Each point of light is one of the ${F.organs} organs whose tissue the GTEx project collected from ${fmt(F.donors)} people.</p>
      <p class="note" data-at="10">This story follows a preprint${F.year ? ` posted on bioRxiv in ${F.year}` : ''}, a poster and a talk from the Rendeiro group at CeMM, the LBI for Network Medicine and the Medical University of Vienna.</p>`,
    slide: `<h2 data-at="0.6">One slide</h2>
      ${turns(`<p data-at="1.2" data-out="21.5">Take a thin slice of an organ, here the wall of the stomach, and stain it. This is H&amp;E, haematoxylin and eosin, the standard stain of pathology.</p>
        <p data-at="6.5" data-out="21.5">Haematoxylin colours the cells' nuclei purple-blue; eosin colours their cytoplasm and the fibres between them pink. White is fat, or empty space.</p>
        <p data-at="13" data-out="21.5">Close up, it is all cells. Yet they are not scattered at random: they are arranged in units that each do a job.</p>`,
      `<ul class="steps">
          ${step(22.5, 0, domCol('mucosa'), 'Mucosa', 'the lining, with glands that make mucus and acid')}
          ${step(24.5, 0, domCol('submucosa'), 'Submucosa', 'loose tissue with blood vessels')}
          ${step(26.5, 0, domCol('inner circular smooth muscle'), 'Muscularis', 'layers of muscle, one around and one along, that move food onwards')}
          ${step(28.5, 0, domCol('lymphoid tissue'), 'Lymphoid patch', 'a cluster of immune cells')}
        </ul>
        <p data-at="30.5" class="amber">Such recurring arrangements are microanatomical domains: the units between cells and organs.</p>
        <p class="credits" data-at="33">Slides like this are cheap, plentiful and show a wide field. This section is drawn, not a real slide.</p>`)}`,
    library: `<h2 data-at="0.6">${fmt(F.slides)} slides</h2>
      <p data-at="1.2">The Genotype-Tissue Expression project, GTEx, collected tissue from ${fmt(F.donors)} people who died aged ${F.ages[0]} to ${F.ages[1]}.</p>
      <div class="facts"><div data-at="5"><b>${fmt(F.donors)}</b><small>people</small></div><div data-at="6.5"><b>${F.tissues}</b><small>tissues</small></div><div data-at="8"><b>${F.organs}</b><small>organs</small></div><div data-at="9.5"><b>${fmt(F.slides)}</b><small>slides</small></div></div>
      <p data-at="13">Each slide is one tissue of one person. Here each column is a tissue, and each row an age, the youngest at the bottom.</p>
      <p data-at="21" class="amber">This is enough to compare how organs are built, and to see how that changes with age.</p>
      <p class="credits" data-at="27">${fmt(F.donorsAnalysed)} people's slides were analysed: median age ${F.medianAge}, ${pct(F.male)} men. The slides here are drawn, not the GTEx images.</p>`,
    method: `<h2 data-at="0.6">Finding the domains</h2>
      ${turns(`<ul class="steps">
          ${step(1.5, 36.5, '#46d9ff', 'Step 1 · Tiles', `each slide is cut into small squares, far smaller than drawn here, giving ${F.tilesM} million tiles in all`)}
          ${step(9.5, 36.5, '#46d9ff', 'Step 2 · Features', 'a deep-learning vision model describes each tile with a list of numbers, drawn here as 16 blocks of colour')}
          ${step(17.5, 36.5, '#46d9ff', 'Step 3 · Neighbours', 'joined to its neighbours, each tile mixes in their descriptions as messages run along the links, which is called message passing')}
          ${step(26.5, 36.5, '#46d9ff', 'Step 4 · Domains', 'in a map of the mixed descriptions, alike tiles gather across all slides; each group is a domain, and colours the slide')}
        </ul>`,
      `<p data-at="37">No labels are needed: a pathologist named the domains afterwards. The method, ${esc(F.method)}, agrees with pathologists' notes, with a correlation of ${F.bench.salivary.r} for salivary gland and ${F.bench.stomach.r} for stomach mucosa, where 1 would be perfect.</p>
        <p data-at="41" class="amber">Now the tiles of every tissue share one map: alike tiles lie close together, coloured by domain.</p>`)}`,
    atlas: `<h2 data-at="0.6">An atlas of the body</h2>
      ${turns(`<p data-at="1.2" data-out="19.5">Across the ${F.tissues} tissues, there are ${F.domains} domains of ${F.types} types, in ${F.superclasses} classes.</p>
        <div class="facts"><div data-at="5" data-out="19.5"><b>${F.types}</b><small>types of domain</small></div><div data-at="6.5" data-out="19.5"><b>${pct(F.shared3)}</b><small>in three or more tissues</small></div><div data-at="8" data-out="19.5"><b>${pct(F.specific)}</b><small>in one tissue only</small></div></div>
        <p data-at="11" data-out="19.5">A few kinds recur in many tissues, such as connective tissue and blood vessels. Most belong to one tissue.</p>`,
      `<p data-at="20">Iva Buljan's network of organ architecture puts it together in four levels:</p>
        <ul class="legend">${[`${F.levels[0]} organs`, `${F.levels[1]} tissues, where an organ has several`, `${F.levels[2]} tissue types`, `${F.levels[3]} domains, as named in this map`].map((t, l) => `<li data-at="${21 + 2 * l}"><span class="sw" style="background:${LEVEL_COL[l]}"></span>${t}</li>`).join('')}</ul>
        ${F.wide ? `<p data-at="30" class="amber">${esc(cap(F.wide.name))} is the tissue type shared most widely: ${F.wide.organs} of the ${F.organs} organs have it.</p>` : ''}
        <p class="credits" data-at="33">The network as in the talk's Figure 5: domains hang on tissue types, and tissue types on organs and their tissues.</p>`)}`,
    age: `<h2 data-at="0.6">Age</h2>
      ${turns(`<p data-at="1.2" data-out="13.5">Of ${F.donorVars} things known about the donors, age is the strongest in explaining how their domains differ.</p>
        <p data-at="6" data-out="13.5" class="amber">${pct(F.ageChange)} of domains change with age: ${F.agePairs[0]} of ${F.agePairs[1]} pairs of a domain and a tissue, where the domain covers more than ${pct(F.agePairsMin)}. Most change by less than ${pct(F.mostUnder)} per decade.</p>
        <p class="credits" data-at="9.5" data-out="13.5">Each bubble is a domain in a tissue: right, it grows with age; left, it shrinks; higher, the change is surer.</p>`,
      `<ul class="steps">${F.ex.map((x, i) => step(14 + 10 * i, 0, exCol[i], exName(x), esc(exText(x)))).join('')}</ul>
        <p data-at="42">${esc(F.connective)} ${esc(F.most)}</p>`)}`,
    pathology: `<h2 data-at="0.6">Disease</h2>
      ${turns(`<p data-at="1.2" data-out="15.5">GTEx's pathologists noted what they saw on each slide: ${fmt(F.pathology.instances)} notes of ${F.pathology.kinds} kinds.</p>
        <ul class="steps">${[F.plaque, F.infarct].filter(Boolean).map((p, i) => step(5 + 4 * i, 15.5, i ? '#ff5a4b' : '#ffb43b', cap(p.kind), `${esc(inOrgan(p.organ))}, ${esc(p.note)}`)).join('')}</ul>`,
      `<p data-at="16" class="amber">Disease and healthy ageing often remodel different parts of a tissue: how much of a domain there is, its shape, or both.</p>
        ${F.remodel.length ? `<p data-at="22">For example, ${esc(F.remodel.map(p => `${p.kind} ${p.note}`).join('; '))}.</p>` : ''}
        <p class="credits" data-at="29">${F.figs.includes('trajectories') ? 'Curves read off the talk\'s figures.' : 'Curves drawn after the preprint\'s descriptions, not its data points.'}</p>`)}`,
    contacts: `<h2 data-at="0.6">Neighbours</h2>
      ${turns(`<p data-at="1.2" data-out="16.5">Domains touch. Which ones meet, and how much, makes a network of contacts in each organ.</p>
        ${F.colon ? `<p data-at="6" data-out="16.5">${esc(meet(F.colon))}.</p>` : ''}`,
      `${F.artery ? `<p data-at="17">${esc(meet(F.artery))}.</p>` : ''}
        ${F.stable ? `<p data-at="23" class="amber">${esc(F.stable)}</p>` : ''}
        ${others.length ? `<p class="credits" data-at="28">Also: ${esc(others.join('; '))}. Contact networks drawn after the preprint's findings.</p>` : ''}`)}`,
    next: `<h2 data-at="0.6">Tissue and time</h2>
      ${turns(`<p data-at="1.2" data-out="10.5">This is a map of how the body is built, from cells to domains to organs, and of how it changes with age.</p>
        <p data-at="4.5" data-out="10.5" class="amber">It may help to study ageing itself, to spot early signs of disease in routine slides, and to compare organs on one scale.</p>`,
      `<p data-at="11">The preprint behind this story is by Iva Buljan, Z. Bagó-Horváth and A. F. Rendeiro${F.year ? `, posted on bioRxiv in ${F.year}` : ''}. The poster and the talk are by Iva Buljan, of the Rendeiro group at the LBI for Network Medicine, the Medical University of Vienna and CeMM, the Research Center for Molecular Medicine of the Austrian Academy of Sciences. The slides are from ${esc(F.gtex)}.</p>
        <p data-at="13.5"><button class="btn primary" id="btnGoExplore" type="button">Explore the atlas</button></p>
        <p class="credits" data-at="15">Slides, sections and tiles are drawn, not the GTEx images; the domain maps, the volcano's other points and the contact networks are illustrative where the figures give no numbers. Narration: a synthetic voice (Kokoro).</p>`)}`,
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
    atlas_lib: 0, atlas_map: 0, atlas_umap: 0, atlas_focus: 0, atlas_age: 0, atlas_volcano: 0, atlas_curves: 0, atlas_net: 0,
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
  // (the library and the section cross: one fades out as the other fades in, over the camera's move)
  hide('atlas', a - 0.5, a + 2.5);
  jump('atlas_lib', a + 2.6, 1, 0);   // the library's wall stays gone after its chapter (the sections still come from its place)
  jump('slide_domain', a - 0.6, 1, 0);
  show('slide', a - 0.5, a + 2, a + 37, a + 39);
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
  // An atlas of the body: a section per tissue; then it turns into the network of organ architecture, level by level
  // with the legend's lines: the sections' tiles gather into a bead per domain, each section's organ flies up to its
  // node, the sections to their tissues', their beads on to the tissue types' and the domains' (atlas_net; hier_grow
  // is keyed at the same times, so each node grows as its things arrive: the atlas leads it by netLead)
  a = C.atlas.a; b = C.atlas.b;
  ramp('atlas_umap', a + 1, a + 4, 1, 0);
  cam(a + 2.5, 'atlas', 'atlas', -6);
  cam(a + 15.5, 'atlas', 'atlas', 5, 'spin');
  const lead = +api('atlas').netLead || 0, grow = v => (v - lead) / (1 - lead);
  ramp('atlas_net', a + 15, a + 31.5, 0, 1); ramp('hier_grow', a + 15, a + 31.5, grow(0), grow(1));
  jump('atlas_net', a + 33, 1, 0);   // (the atlas is gone by then; it comes back as itself in the next chapter)
  show('hier', a + 19, a + 20);
  hide('atlas', a + 28.8, a + 30.3);
  // (the camera rises over the atlas while its tiles gather, holds while things fly, then takes the network's view)
  // (an even turn of about 2.5 degrees a second, ending where it did before the morph, so the next hand-over is as it was)
  cam(a + 19.5, 'hier', 'grow', -3);
  cam(a + 28.5, 'hier', 'grow', 19, 'spin');
  // (the tissue type shared most widely lights up with its line)
  const wideN = F.wide ? hierIdx(F.wide.name, 2) : -1;
  if (wideN >= 0) { jump('hier_focus', a + 30, -1, wideN); jump('hier_focus', b - 0.5, wideN, -1); }
  cam(a + 31.5, 'hier', 'net', 4);
  cam(b - 0.5, 'hier', 'net', 25, 'spin');
  // Age: the volcano; then the three examples in turn (the ovary, the gut on the slide, the pituitary)
  a = C.age.a; b = C.age.b;
  hide('hier', a, a + 2);
  show('atlas', a + 0.5, a + 2.5, a + 24, a + 26);
  ramp('atlas_volcano', a, a + 6, 0, 1);   // (begun before the atlas shows, so its sections never flash up behind it)
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

  // ------------------------------------------------------------ sound effects
  // (sfxCue: story time, a sound, where it comes from: a set and one of its anchors, or a point in its frame; its options)
  a = C.title.a;
  sfxCue(a + 0.3, 'rise', 'body', null);                                                  // the PET body
  sfxCue(a + 3, 'patter', 'body', null, { dur: 4, pitch: 1.4, gain: 0.3 });               // the organs' points light one by one
  sfxCue(C.slide.a - 2.5, 'pick', 'body', st);                                            // the stomach's point glows
  a = C.slide.a;
  sfxCue(a + 1.2, 'whoosh', 'slide', null, { dur: 2 });                                   // into the stomach: the section
  ['mucosa', 'submucosa', 'inner', 'outer', 'lymphoid'].forEach((d, k) => sfxCue(a + [22.5, 24.5, 26.5, 27.5, 28.5][k], 'step', 'slide', d, { pitch: Math.pow(2, 2 * k / 12), seq: true }));   // its domains wash in
  a = C.library.a;
  sfxCue(a + 1, 'clink', 'atlas', 'library');                                             // the first slide
  sfxCue(a + 1.5, 'patter', 'atlas', 'library', { dur: 11, gain: 0.35 });                 // the slides burst onto the wall
  a = C.method.a;
  sfxCue(a + 2, 'grow', 'slide', 'tiles', { dur: 6, pitch: 1.2 });                       // tiles
  sfxCue(a + 9.5, 'grow', 'slide', 'feat', { dur: 6, pitch: 1.5, gain: 0.35 });          // their features light up
  [18, 20, 22].forEach(t => sfxCue(a + t, 'pulse', 'slide', 'listen', { gain: 0.3, seq: true }));   // messages along the links
  sfxCue(a + 26.5, 'whoosh', 'slide', 'cloudC', { dur: 4, pitch: 1.2 });                  // the lift into a map
  sfxCue(a + 33, 'whoosh', 'slide', null, { dur: 2.5, pitch: 0.7 });                      // back down onto the slide
  sfxCue(a + 37.5, 'rise', 'atlas', 'umap', { dur: 5 });                                  // the tile cloud of all slides
  a = C.atlas.a;
  sfxCue(a + 15, 'rise', 'hier', 'top', { dur: 16, gain: 0.4 });                          // the atlas turns into the network
  sfxCue(a + 20, 'whoosh', 'hier', 'top', { dur: 3 });                                    // the organs fly up to their nodes
  if (wideN >= 0) sfxCue(a + 30, 'ping', 'hier', 'focus');                                // the tissue type shared most widely
  a = C.age.a;
  sfxCue(a + 0.3, 'grow', 'atlas', 'volcano', { dur: 6 });                                // the volcano
  sfxCue(a + 14, 'pick', 'atlas', 'ex0');                                                 // the first example
  sfxCue(a + 17, 'rise', 'atlas', 'focus', { dur: 6, pitch: 0.8 });                       // from 20 to 70
  sfxCue(a + 27, 'rise', 'slide', 'submucosa', { dur: 6, pitch: 0.8 });                   // the gut ages
  sfxCue(a + 37, 'rise', 'atlas', 'focus', { dur: 5, pitch: 0.8 });                       // the third example ages
  sfxCue(C.pathology.a + 1.5, 'grow', 'atlas', 'curves', { dur: 5, pitch: 0.8 });         // the trajectories
  a = C.contacts.a;
  sfxCue(a + 0.5, 'whoosh', 'hier', 'contacts');                                          // the colon's contacts
  sfxCue(a + 7, 'rise', 'hier', 'change', { dur: 7, pitch: 0.8 });                        // from 20 to 70
  sfxCue(a + 16, 'whoosh', 'hier', null, { dur: 1.5 });                                   // the switch to the artery
  sfxCue(a + 19, 'rise', 'hier', 'change', { dur: 7, pitch: 0.75 });                      // from 20 to 70
  sfxCue(C.next.a + 0.5, 'rise', 'body', null, { gain: 0.4 });                            // tissue and time
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
// sets the one before turns into at a hand-over (the network grows out of the atlas: atlas_net), so they share its turn
const MORPH = { hier: 'atlas' };
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
      // (a set that the one before turns into, MORPH, takes its turn: the atlas's things fly to the network's nodes)
      cur = { k: w[8], t0: w[0], c: cur && MORPH[w[8]] === cur.k ? cur.c : Math.abs(d) > 40 ? d : 0 };
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
//#use setYaw~2 smoothSeg spinEase storyCam LBL labelEl label sfxSpan buildSetLabels~3 setLabelAlpha _v labelPos
//#use _placed placeLabels curCh updateStoryDOM buildTimeline ICON_PLAY ICON_PAUSE lastTick updateTimeline