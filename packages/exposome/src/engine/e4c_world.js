// ========================================================== EXPLORE: WORLD ==
// Builder C's part of explore mode (src/SPEC.md, "Explore mode"): its scenes (SCENES_C), the tabs Diseases and
// Countries (renderDiseases, renderCountries here; drawDiseasesPane, drawCountriesPane in e6c_world.js, kept in step),
// what they pick (XC) and share (stateC, applyC), picking in its scenes (pickWithC ...) and its address (hashC).
const SCENES_C = [
  ['cell', 'Cell', 'The model cell of Back into the cell: a substance\'s threads to the proteins of the genes it disturbs, or one gene\'s threads out to its substances.'],
  ['ppi', 'Interactome', 'The interactome sorted by contacts (our drawing: hubs in the middle, loners at the rim): where a substance hits, hazard, and the diseases close by.'],
  ['globe', 'Europe', 'The countries with data: their releases far above Europe\'s level (to air and water), close against distant diseases, and the risk scores.'],
];
// what C's panes pick: a disease (XDATA.dis), a country (index into XDATA.countries), a substance (from either pane, or
// B's when C's has none), a search typed (never shared)
const XC = { dis: -1, country: -1, sub: -1, q: '' };
const stateC = () => ({ dis: XC.dis, country: XC.country, sub: XC.sub });
function applyC(v) {
  if (!v || typeof v !== 'object') return;
  if (Number.isInteger(v.dis) && v.dis >= -1 && v.dis < 65535) XC.dis = v.dis;
  if (Number.isInteger(v.country) && v.country >= -1 && v.country < XDATA.countries.length) XC.country = v.country;
  if (Number.isInteger(v.sub) && v.sub >= -1 && v.sub < XDATA.N) XC.sub = v.sub;
}
// the substance C's scenes show: C's own pick, else B's (Substances tab), else def (benzo(a)pyrene unless given)
const pickSubC = def => (XC.sub >= 0 ? XC.sub : typeof XB !== 'undefined' && XB.sub >= 0 ? XB.sub : def === undefined ? XDATA.ex.bap : def);
// (the params that pick something jump in explore mode, never ease through the ones between)
let _stepC = false;
function stepC() {
  if (_stepC) return;
  _stepC = true;
  for (const n of ['cell_sub', 'cell_gene', 'ppi_pat', 'ppi_sub', 'ppi_dis', 'ppi_rip', 'globe_country', 'globe_sub']) STEP.add(n);
}

// ------------------------------------------------------------ what both panels say (HTML and the headset's canvas)
const QUICK_DIS = ['Asthma', 'Colorectal Carcinoma', 'Breast Carcinoma', 'Alzheimer\'s Disease', 'Parkinson Disease', 'Diabetes Mellitus, Non-Insulin-Dependent', 'Schizophrenia', 'Obesity'];
const NOTE_DIS = 'Close in this map: the proteins a substance touches sit fewer steps from the disease\'s proteins than chance would give (z below −5 here). A link in the data, not a cause; no medical advice.';
const NOTE_CTY = 'A country\'s releases far above Europe\'s level (industrial reports, 2007 to 2020), weighted: a link in the data, not a cause. Nothing here is about people.';
const disName = d => (d >= 0 ? XDATA.dis.name(d) : '');
const subName = s => (s >= 0 ? XDATA.label[s] : '');
function disInfo(d) {
  if (d < 0 || !XDATA.ready('diseases')) return null;
  const G = XDATA.dis.genes(d) || [], near = XDATA.dis.near(d), close = (XDATA.dis.closeTo(d) || []).slice(0, 10);
  const rows = [['Proteins', fmt(G.length), 'its genes, in the interactome'], ['Substances close', fmt(near), 'significantly closer than chance']];
  let pair = null;
  if (XC.sub >= 0) {
    const e = (XDATA.dis.closeOf(XC.sub) || []).find(x => x.d === d);
    pair = e ? `${subName(XC.sub)}: close in this map (z = ${f2(e.z)}); ${fmt(e.cit)} PubMed records name both.` : `${subName(XC.sub)}: not among its closest pairs (z below −5).`;
    if (XC.sub === XDATA.ex.ozone && d === XDATA.dis.find('Asthma') && XDATA.ex.ozoneAsthma.steps) {
      const st = XDATA.ex.ozoneAsthma.steps;
      pair += ` From ozone's targets: ${fmt(st[0])} are asthma proteins, ${fmt(st[1])} one step away, ${fmt(st[2])} two, ${fmt(st[3])} three (the steps drawn).`;
    }
  }
  return { head: cap(disName(d)), rows, close, pair };
}
const sigWords = v => (!v ? 'not compared' : v[2] < 0.05 && v[0] > v[1] ? 'close diseases more frequent' : 'no clear difference');
function ctyInfo(i) {
  const c = XDATA.countries[i];
  if (!c) return null;
  const pct = x => (x >= 0.01 ? `${(100 * x).toFixed(1)} %` : 'under 1 %');
  const rows = [['To air', fmt(c.air.length), 'substances far above Europe\'s level'], ['To water', fmt(c.water.length), ''],
    ['Score', c.risk ? pct(c.risk[3]) : 'none', c.risk ? 'of the total, weighted by central targets' : 'no elevated releases'],
    ['Air', sigWords(c.pa), c.pa ? `p ${c.pa[2] < 0.001 ? '< 0.001' : c.pa[2].toFixed(3)}` : ''], ['Water', sigWords(c.pw), c.pw ? `p ${c.pw[2] < 0.001 ? '< 0.001' : c.pw[2].toFixed(3)}` : '']];
  const inC = XC.sub >= 0 && (c.air.includes(XC.sub) || c.water.includes(XC.sub));
  const near = inC && XDATA.ready('diseases') ? (XDATA.dis.closeOf(XC.sub) || []).slice(0, 6) : [];
  return { head: c.name, rows, air: c.air, water: c.water, near, inC };
}

// ------------------------------------------------------------ picking
function selectDis(d, fly = true) {
  XC.dis = d;
  if (d >= 0 && fly) { if (X.scene !== 'ppi') openScene('ppi'); setCtl('ppi', 'show', 'pick'); NEXT.push(() => flyNear(GL.sets.ppi.anchors.knot(), 1.9)); }
  pushState(); renderAll();
}
function selectSubC(s) {
  XC.sub = s;
  if (X.tab === 'countries' && X.scene === 'globe') { if (!ctlValue('globe', ctlOf('globe', 'show')) || ctlValue('globe', ctlOf('globe', 'show')) !== 'subs') setCtl('globe', 'show', 'subs'); }
  else if (X.scene !== 'cell') { if (X.scene !== 'ppi') openScene('ppi'); setCtl('ppi', 'show', 'pick'); }
  pushState(); renderAll();
}
function selectCountry(i, fly = true) {
  XC.country = i;
  if (fly) {
    if (X.scene !== 'globe') openScene('globe', false);
    flyTo(i >= 0 ? api('globe').view(i) : view('globe', 'default'));
  }
  pushState(); renderAll();
}

// ------------------------------------------------------------ the HTML panes
const _dchip = (act, v, label, on, col) => chip(`data-act="${act}" data-v="${v}"`, esc(label), on, col);
function renderDiseases() {
  const pane = $('#pane-diseases');
  if (!pane) return;
  if (!pane.querySelector('#cDq')) {
    pane.innerHTML = `<p class="sub">Find a disease: its proteins drawn together in the interactome, and the substances close to it in this map.</p>
      <div class="search"><input id="cDq" type="search" placeholder="A disease, such as asthma" autocomplete="off" spellcheck="false"></div><div id="cDbody"></div>`;
  }
  const inp = pane.querySelector('#cDq');
  if (document.activeElement !== inp && inp.value !== XC.q) inp.value = XC.q;
  const body = pane.querySelector('#cDbody');
  if (!XDATA.ready('diseases')) { body.innerHTML = '<p class="sub">…</p>'; XDATA.load('diseases', pkgUrl).then(renderAll, () => { body.innerHTML = '<p class="sub">The diseases could not be loaded (offline?).</p>'; }); return; }
  const list = XC.q ? XDATA.dis.search(XC.q, 12) : QUICK_DIS.map(n => XDATA.dis.find(n)).filter(d => d >= 0);
  const I = disInfo(XC.dis);
  body.innerHTML = `${XC.q ? `<p class="grp-h">${list.length ? 'Matches' : 'No disease holds that'}</p>` : ''}<div class="chips">${list.map(d => _dchip('cdis', d, disName(d), XC.dis === d, LOOK.disease)).join('')}</div>
    ${I ? `<h3 style="color:${inkCol(LOOK.disease)}">${esc(I.head)}</h3>${statsHtmlC(I.rows)}
      <p class="grp-h">Closest substances${I.close.length ? '' : ': none below z −5'}</p>
      <div class="chips">${I.close.map(e => _dchip('csub', e.s, `${subName(e.s)} · z ${f2(e.z)}`, XC.sub === e.s, LOOK.substance)).join('')}</div>
      ${I.pair ? `<p class="sub">${esc(I.pair)}</p>` : ''}
      <div class="chips" style="margin-top:12px">${X.scene !== 'ppi' ? _dchip('cshow', 'ppi', 'Show in the interactome', false) : ''}${XC.sub >= 0 ? _dchip('csub', -1, 'No substance', false) : ''}${_dchip('cdis', -1, 'None', false)}</div>`
    : '<p class="sub">No disease picked.</p>'}
    <p class="credits">${esc(NOTE_DIS)}</p>`;
}
function renderCountries() {
  const pane = $('#pane-countries');
  if (!pane) return;
  const C = XDATA.countries, I = XC.country >= 0 ? ctyInfo(XC.country) : null;
  const order = C.map((c, i) => i).sort((a, b) => C[a].name.localeCompare(C[b].name));
  const subChips = (L, col) => (L.length ? `<div class="chips">${L.map(s => _dchip('csub', s, subName(s), XC.sub === s, col)).join('')}</div>` : '<p class="sub">none</p>');
  pane.innerHTML = `<p class="sub">${fmt(C.length)} European countries. Pick one on the globe or here: the substances its industry released far above Europe's level, and the diseases close to them in this map.</p>
    <div class="chips">${order.map(i => _dchip('ccty', i, C[i].name, XC.country === i)).join('')}</div>
    ${I ? `<h3>${esc(I.head)}</h3>${statsHtmlC(I.rows)}
      <p class="grp-h">To air</p>${subChips(I.air, '#aee9ff')}
      <p class="grp-h">To water</p>${subChips(I.water, '#3f86ff')}
      ${I.inC ? `<p class="grp-h">${esc(subName(XC.sub))}: the diseases closest to it</p><div class="chips">${I.near.map(e => _dchip('cdis', e.d, `${disName(e.d)} · z ${f2(e.z)}`, XC.dis === e.d, LOOK.disease)).join('') || '<span class="sub">none below z −5</span>'}</div>` : ''}
      <div class="chips" style="margin-top:12px">${X.scene !== 'globe' ? _dchip('cshowg', XC.country, 'Show on the globe', false) : ''}${_dchip('ccty', -1, 'None', false)}</div>`
    : '<p class="sub">No country picked.</p>'}
    <p class="credits">${esc(NOTE_CTY)}</p>`;
}
const statsHtmlC = rows => `<dl class="stats">${rows.map(([k, v, m]) => `<dt>${esc(k)}</dt><dd>${esc(v)}${m ? ` <small>${esc(m)}</small>` : ''}</dd>`).join('')}</dl>`;

// ------------------------------------------------------------ picking in C's scenes
function pickWithC(rc) {
  if (APP.mode !== 'explore') return null;
  for (const k of ['globe', 'ppi', 'cell']) {
    if (X.scene !== k || (XS[k + '_a'] || 0) < 0.5) continue;
    const A = api(k);
    let i = -1;
    try { i = A.pick ? A.pick(rc) : -1; } catch (e) { i = -1; }
    if (i >= 0) return { k: 'c', s: k, i };
  }
  return null;
}
function pickPosC(p) { const A = api(p.s); return A.pos ? A.pos(p.i) : null; }
function pickTextC(p) {
  if (p.s === 'globe') { const c = XDATA.countries[p.i], n = c.air.length + c.water.length; return [c.name, n ? ` · ${fmt(c.air.length)} to air, ${fmt(c.water.length)} to water` : ' · no elevated releases']; }
  const Q = XDATA.ppi, pl = Q.place[p.i];
  return [Q.sym(p.i), ` · ${fmt(Q.deg[p.i])} contacts${p.s === 'cell' ? ', ' + (pl < 13 ? Q.places[pl].toLowerCase() : 'place not known') : ''}`];
}
function chooseC(p) {
  if (p.s === 'globe') { if (X.tab !== 'countries') showTab('countries'); selectCountry(p.i === XC.country ? -1 : p.i, false); }
}
// the address: &dis=<name>, &country=<name>, &csub=<a substance's label>
function hashC(hp) {
  const q = s => String(hp.get(s) || '').trim();
  if (q('country')) { const i = XDATA.countries.findIndex(c => c.name.toLowerCase() === q('country').toLowerCase()); if (i >= 0) XC.country = i; }
  if (q('csub')) { const s = XDATA.find(q('csub'), 1)[0]; if (s !== undefined) XC.sub = s; }
  if (q('dis') && XDATA.ready('diseases')) { let d = XDATA.dis.find(q('dis')); if (d < 0) d = XDATA.dis.search(q('dis'), 1)[0]; if (d !== undefined && d >= 0) XC.dis = d; }
}
// a button in C's panes clicked (its data-act not the frame's: true when handled) and a search box typed in
function actC(el) {
  const v = +el.dataset.v;
  switch (el.dataset.act) {
    case 'cdis': selectDis(v === XC.dis ? -1 : v); return true;
    case 'csub': selectSubC(v === XC.sub ? -1 : v); return true;
    case 'ccty': selectCountry(v === XC.country ? -1 : v); return true;
    case 'cshow': openScene('ppi'); setCtl('ppi', 'show', 'pick'); return true;
    case 'cshowg': openScene('globe'); selectCountry(v); return true;
  }
  return false;
}
function inputC(ev) {
  if (!ev.target || ev.target.id !== 'cDq') return false;
  XC.q = ev.target.value;
  renderDiseases();
  return true;
}
// the headset's search: the shell's keypad
async function xrSearchC() {
  if (!(HOST.collab && HOST.collab.keypad)) return;
  let q = null;
  try { q = await HOST.collab.keypad({ title: 'Search a disease', hint: 'Part of its name, such as asthma', value: XC.q, max: 24 }); } catch (e) { q = null; }
  if (q === null || q === undefined) return;
  XC.q = String(q).trim();
  renderAll();
}
