// ===================================================== EXPLORE: SUBSTANCES ==
// Builder B's part of explore mode (src/SPEC.md, "Explore mode"): its scene (SCENES_B: the cloud), the tabs Substances
// and Groups (renderSubstances, renderGroups here; drawSubstancesPane, drawGroupsPane in e6b_substances.js, kept in
// step: both read subInfo and groupInfo below), what they pick (XB) and share (stateB, applyB), picking in the cloud
// (pickWithB ...) and the address (hashB: &sub=<name or CTD id>, &group=<id such as 11_2_1>).
// Every statistic about the substances' own network is "in this map" or "here". Never "causes": a substance touches or
// disturbs genes; a disease is close in the map.
const SCENES_B = [
  ['cloud', 'Substances', 'Every substance as a point, arranged by the genes it shares with others (the authors\' layout) or by chemistry (shelves of chemical families). Click or point at one to pick it.'],
];
// the cloud's params that pick something by number (explore never eases them: e4_explore.js's STEP)
const STEP_B = ['cloud_level', 'cloud_focus', 'cloud_pick', 'pair_s1', 'pair_s2'];
// what B's panes pick: a substance, a community (by number: XDATA.comm), the search typed (never shared), a redraw count
const XB = { sub: -1, comm: -1, q: '', n: 0 };
// the shared part: plain outcomes only (SPEC.md, "Shared rooms")
const stateB = () => ({ sub: XB.sub, comm: XB.comm });
function applyB(v) {
  if (!v || typeof v !== 'object') return;
  if (Number.isInteger(v.sub) && v.sub >= -1 && v.sub < XDATA.N) XB.sub = v.sub;
  if (Number.isInteger(v.comm) && v.comm >= -1 && v.comm < XDATA.comm.n) XB.comm = v.comm;
}

// ------------------------------------------------------------ what the panes say (both panels read these)
const B_LEVEL = ['large group', 'smaller group', 'fine group'];
const bCap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const bWords = k => bCap(XDATA.comm.words(k)) || `Group ${XDATA.comm.id[k]}`;
const bFam = c => bCap(XDATA.classes.names[c].toLowerCase());
// well-known substances to start from (the story's own, and a few everyone knows), as the data names them
const B_QUICK = () => (B_QUICK.v || (B_QUICK.v = ['Benzo(a)pyrene', 'Ozone', 'Cadmium', 'Arsenic', 'Acetaminophen', 'Triclosan', 'Caffeine', 'Nicotine',
  'Diethylstilbestrol', 'Zearalenone', 'Endrin', 'calcium heparin', 'Clobazam'].map(s => XDATA.label.indexOf(s)).filter(i => i >= 0)));
// a community's members, best studied first (cached)
const B_MEM = new Map();
const bMembers = k => B_MEM.get(k) || (B_MEM.set(k, XDATA.members(k).sort((a, b) => XDATA.ngenes[b] - XDATA.ngenes[a] || a - b)), B_MEM.get(k));
const bLoad = name => { if (!XDATA.ready(name) && !XDATA.failed.has(name)) XDATA.load(name, pkgUrl).then(() => { XB.n++; renderAll(); }, () => { XB.n++; renderAll(); }); return XDATA.ready(name); };
// a substance in words: its card's rows and lists
function subInfo(i) {
  const X = XDATA;
  if (!(i >= 0 && i < X.N)) return null;
  const net = i < X.NN, fams = X.classes.names.map((nm, c) => c).filter(c => X.cls[i] & (1 << c));
  const pat = X.pattern(i), hz = X.hazard(i), groups = net ? [0, 1, 2].map(lv => X.commOf(i, lv)) : [];
  const rows = [['Genes it touches', fmt(X.ngenes[i]), `${fmt(X.nppi[i])} of them in the interactome`]];
  if (net) rows.push(['Threads here', fmt(X.deg[i]), 'links to other substances in this map']);
  rows.push(['Where it hits', pat >= 0 ? bCap(X.meta.pattern.names[pat]) : 'not known', pat >= 0 ? 'its targets in the network of proteins' : 'none of its genes in the interactome']);
  rows.push(['Hazard score', hz >= 0 ? hz.toFixed(2) : 'none', hz >= 0 ? 'from 0 harmless to 1 very harmful (NORMAN)' : 'not in the NORMAN list with a score']);
  rows.push(['Diseases close', fmt(X.near[i]), 'significantly close in this map']);
  // its genes (targets.bin), the closest diseases (diseases.bin), its full name (names.json): each once its file is in
  const tg = bLoad('targets') ? X.targets(i) : null, genes = tg ? [...tg.subarray(0, 10)].map(g => X.gene.sym(g)) : null;
  const dl = bLoad('diseases') ? X.dis.closeOf(i) : null, dis = dl ? dl.slice(0, 5).map(q => [X.dis.name(q.d), q.z]) : null;
  const full = X.ready('names') && X.full(i) !== X.label[i] ? X.full(i) : '';
  const nb = net && GL.sets.cloud ? api('cloud').neighbours(i).slice().sort((a, b) => X.ngenes[b] - X.ngenes[a] || a - b) : [];
  return { i, name: X.label[i], full, net, fams, groups, rows, genes, dis, nb: nb.slice(0, 12), nbAll: nb.length,
    loading: { genes: !tg && !X.failed.has('targets'), dis: !dl && !X.failed.has('diseases') } };
}
// a community in words: its level, size, the terms its label was written from, its parents, its children, its members
function groupInfo(k) {
  const X = XDATA, C = X.comm;
  if (!(k >= 0 && k < C.n)) return null;
  const lv = C.lv[k], path = [];
  for (let q = k; q >= 0; q = C.lv[q] > 0 ? C.parent[q] : -1) path.unshift(q);
  const kids = lv < 2 ? C.byLevel[lv + 1].filter(q => C.parent[q] === k).sort((a, b) => C.size[b] - C.size[a]) : [];
  const mem = bMembers(k);
  return { k, lv, name: bWords(k), plain: !!C.label[k], id: C.id[k], size: C.size[k], terms: (C.terms[k] || []).slice(0, 3), path,
    kids: kids.length > 1 ? kids : [], mem: mem.slice(0, 12), memAll: mem.length, col: C.col[path[0]] };
}
// the large groups (meta.levels.bigMin, 50 substances or more), largest first, and how many small ones besides
const B_BIG = () => B_BIG.v || (B_BIG.v = XDATA.comm.byLevel[0].filter(k => XDATA.comm.size[k] >= XDATA.meta.levels.bigMin).sort((a, b) => XDATA.comm.size[b] - XDATA.comm.size[a]));
const B_NOTE = {
  get sub() { return `A thread between two substances: they share many more genes than chance would give. The drawing shows the strongest ${fmt(XDATA.meta.drawn)} of the ${fmt(XDATA.meta.nEdges)} threads in this map. Closeness to a disease is a distance in the cell's network of proteins, not a cause.`; },
  grp: 'Groups (communities) are where the threads are dense: found by the authors at three levels. A group\'s words come from the processes its shared genes are known for (its top terms); where they gave no clear theme, the top term itself is shown.',
};

// ------------------------------------------------------------ picking
function selectSub(i, fly = true) {
  XB.sub = i >= 0 && i < XDATA.N ? i : -1;
  if (XB.sub >= 0) XB.comm = -1;
  sfxAct('step', 'cloud', null);
  if (XB.sub >= 0 && XB.sub < XDATA.NN && fly) {
    if (X.scene !== 'cloud') openScene('cloud', false);
    // (once the set has drawn the pick: its place in the arrangement on show)
    NEXT.push(() => { const p = api('cloud').pos(XB.sub); flyTo([orbit.cur[0], clamp(orbit.cur[1], -30, 40), 1.2, p[0], p[1], p[2]]); });
  } else if (XB.sub < 0 && fly && X.scene === 'cloud') flyTo(view('cloud', viewCam('cloud') || 'default'));
  pushState(); renderAll();
}
function selectGroup(k, fly = true) {
  XB.comm = k >= 0 && k < XDATA.comm.n ? k : -1;
  if (XB.comm >= 0) XB.sub = -1;
  sfxAct('step', 'cloud', null);
  if (fly) {
    if (X.scene !== 'cloud') openScene('cloud', false);
    if (XB.comm >= 0) NEXT.push(() => { const c = api('cloud').cen(XB.comm), d = 0.55 + 2.2 * Math.sqrt(XDATA.comm.size[XB.comm] / XDATA.NN); flyTo([orbit.cur[0], clamp(orbit.cur[1], -30, 40), d, c[0], c[1], c[2]]); });
    else flyTo(view('cloud', viewCam('cloud') || 'default'));
  }
  pushState(); renderAll();
}

// ------------------------------------------------------------ the Substances pane
const bChip = (act, v, label, on, col) => chip(`data-act="${act}" data-v="${v}"`, esc(label), on, col);
const bRows = rows => `<dl class="stats">${rows.map(([k, v, more]) => `<dt>${esc(k)}</dt><dd>${esc(v)}${more ? ` <small>${esc(more)}</small>` : ''}</dd>`).join('')}</dl>`;
function renderSubstances() {
  const pane = $('#pane-substances');
  if (!pane) return;
  if (!pane.querySelector('#xsq')) {
    // (the search box is built once: a redraw must not take the text being typed)
    pane.innerHTML = `<p class="sub">Find a substance and follow its threads: its genes, its group, the diseases close to it. Or click one in the cloud.</p>
      <div class="search"><input id="xsq" type="search" placeholder="A name, such as cadmium or caffeine" autocomplete="off" spellcheck="false" aria-label="Search substances" role="combobox" aria-expanded="false" aria-controls="xsqs"><ul class="sugg" id="xsqs" role="listbox"></ul></div>
      <div id="xsBody"></div>`;
    const q = $('#xsq'), sg = $('#xsqs');
    q.value = XB.q;
    q.addEventListener('keydown', ev => {
      const li = [...sg.querySelectorAll('li')], k = li.findIndex(e => e.getAttribute('aria-selected') === 'true');
      if (ev.key === 'Enter') { const e = li[Math.max(0, k)]; if (e) { selectSub(+e.dataset.i); bSugg(false); } ev.preventDefault(); }
      else if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && li.length) {
        const j = (k + (ev.key === 'ArrowDown' ? 1 : li.length - 1)) % li.length;
        li.forEach((e, m) => e.setAttribute('aria-selected', m === j));
        ev.preventDefault();
      } else if (ev.key === 'Escape') bSugg(false);
    });
    q.addEventListener('focus', () => { bLoad('names'); if (q.value.trim()) bSugg(true); });
    q.addEventListener('blur', () => { clearTimeout(XB.blurT); XB.blurT = setTimeout(() => bSugg(false), 150); });
    sg.addEventListener('mousedown', ev => { const li = ev.target.closest('li'); if (li) { ev.preventDefault(); selectSub(+li.dataset.i); bSugg(false); } });
  }
  const I = subInfo(XB.sub), body = $('#xsBody');
  body.innerHTML = `<p class="grp-h">Start with</p><div class="chips">${B_QUICK().map(i => bChip('bsub', i, XDATA.label[i], XB.sub === i)).join('')}</div>
    ${I ? `<h3 style="color:${inkCol(LOOK.substance)}">${esc(I.name)}</h3>${I.full ? `<p class="sub">${esc(I.full)}</p>` : ''}
      ${I.fams.length ? `<p class="grp-h">Chemical famil${I.fams.length > 1 ? 'ies' : 'y'} <small>(the colours of the shelves)</small></p><p class="sub">${I.fams.map(c => `<span style="display:inline-flex;align-items:center;gap:6px;margin:0 12px 2px 0"><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${swCol(LOOK.family[c] || LOOK.none)}"></span>${esc(bFam(c))}</span>`).join('')}</p>` : ''}
      ${bRows(I.rows)}
      ${I.net ? `<p class="grp-h">Its groups, from large to fine</p><div class="chips">${I.groups.map((k, lv) => bChip('bgroup', k, `${bWords(k)} · ${fmt(XDATA.comm.size[k])}`, false, XDATA.comm.col[I.groups[0]])).join('')}</div>`
        : '<p class="sub">No thread to another substance here, so no place in the network and no group.</p>'}
      <p class="grp-h">Its genes${I.genes ? ', most studied first' : ''}</p><p class="sub">${I.genes ? esc(I.genes.join(', ')) + (XDATA.ngenes[I.i] > I.genes.length ? ` and ${fmt(XDATA.ngenes[I.i] - I.genes.length)} more` : '') : I.loading.genes ? '…' : 'not available offline'}</p>
      <p class="grp-h">Diseases closest to it in this map</p><p class="sub">${I.dis ? (I.dis.length ? esc(I.dis.map(([d, z]) => `${d} (z ${f2(z)})`).join('; ')) : `none of the closest pairs (z below ${Z_CUT()})`) : I.loading.dis ? '…' : 'not available offline'}</p>
      ${I.nb.length ? `<p class="grp-h">Its strongest threads here (${fmt(I.nbAll)} drawn)</p><div class="chips">${I.nb.map(j => bChip('bsub', j, XDATA.label[j], false)).join('')}</div>` : ''}
      <div class="chips" style="margin-top:12px">${SCENES.filter(([k]) => k === 'cell' || k === 'ppi').map(([k, nm]) => bChip('bscene', k, `Its genes: ${nm}`, false)).join('')}${bChip('bsub', 'none', 'None', false)}</div>`
    : '<p class="sub">No substance picked.</p>'}
    <p class="note">${esc(B_NOTE.sub)}</p>`;
}
// the search's suggestions, as you type (labels, and full names once names.json is in)
function bSugg(on) {
  const q = $('#xsq'), sg = $('#xsqs');
  if (!q || !sg) return;
  const hits = on ? XDATA.find(q.value, 12) : [];
  sg.innerHTML = hits.map((i, k) => `<li role="option" data-i="${i}" aria-selected="${k === 0}"><b>${esc(XDATA.label[i])}</b><span>${i < XDATA.NN ? esc(bWords(XDATA.commOf(i, 0))) : 'no threads'}</span><em>${fmt(XDATA.ngenes[i])} genes</em></li>`).join('');
  sg.classList.toggle('on', hits.length > 0);
  q.setAttribute('aria-expanded', hits.length > 0);
}

// ------------------------------------------------------------ the Groups pane
function renderGroups() {
  const pane = $('#pane-groups');
  if (!pane) return;
  const I = groupInfo(XB.comm), C = XDATA.comm, big = B_BIG();
  pane.innerHTML = `<p class="sub">The network falls into groups where its threads are dense, at three levels: ${fmt(C.counts[0])} large ones, ${fmt(C.counts[1])} smaller and ${fmt(C.counts[2])} fine. Each with what its genes do.</p>
    ${I ? `<div class="chips">${I.path.map(q => bChip('bgroup', q, `${bWords(q)}`, q === I.k, C.col[I.path[0]])).join('')}</div>
      <h3>${esc(I.name)}</h3><p class="sub">A ${B_LEVEL[I.lv]} of ${fmt(I.size)} substances (the authors' ${esc(I.id)}).</p>
      ${I.terms.length ? `<p class="grp-h">${I.plain ? 'Its words come from these processes' : 'Its top terms'}</p><p class="sub">${esc(I.terms.join('; '))}</p>` : ''}
      ${I.kids.length ? `<p class="grp-h">Inside it: ${I.kids.length} ${B_LEVEL[I.lv + 1]}s</p><div class="chips">${I.kids.map(q => bChip('bgroup', q, `${bWords(q)} · ${fmt(C.size[q])}`, false)).join('')}</div>` : ''}
      <p class="grp-h">Members${I.memAll > I.mem.length ? `: the ${I.mem.length} best studied of ${fmt(I.memAll)}` : ''}</p><div class="chips">${I.mem.map(i => bChip('bsub', i, XDATA.label[i], false)).join('')}</div>
      <div class="chips" style="margin-top:12px">${bChip('bgroup', 'none', 'All groups', false)}</div>`
    : `<p class="grp-h">The ${big.length} large groups (${fmt(XDATA.meta.levels.bigMin)} substances or more), and ${fmt(C.counts[0] - big.length)} small ones</p>
      <div class="chips">${big.map(k => bChip('bgroup', k, `${bWords(k)} · ${fmt(C.size[k])}`, false, C.col[k])).join('')}</div>`}
    <p class="note">${esc(B_NOTE.grp)}</p>`;
}

// ------------------------------------------------------------ picking in the cloud (null unless the cloud is on show)
function pickWithB(rc) {
  if (X.scene !== 'cloud' || !GL.sets.cloud) return null;
  const i = api('cloud').pick(rc);
  return i >= 0 ? { k: 'b', i } : null;
}
function pickPosB(p) { return api('cloud').pos(p.i); }
function pickTextB(p) { const i = p.i; return [XDATA.label[i], ` · ${fmt(XDATA.ngenes[i])} genes · ${bWords(XDATA.commOf(i, 0))}`]; }
function chooseB(p) { selectSub(p.i === XB.sub ? -1 : p.i, false); }
// the address (#exposome&explore&...): &sub=<name or CTD id>, &group=<id>; read once at the start
function hashB(hp) {
  const s = hp.get('sub'), gid = hp.get('group');
  if (s) {
    const q = s.toLowerCase(), i = XDATA.label.findIndex(l => l.toLowerCase() === q);
    const take = j => { if (j >= 0) { selectSub(j, false); NEXT.push(() => { const p = api('cloud').pos(j); orbit.cur = [orbit.cur[0], orbit.cur[1], 1.2, p[0], p[1], p[2]]; orbit.to = null; }); } };
    if (i >= 0) take(i);
    else if (/^[A-Z]\d+$/.test(s)) XDATA.load('names', pkgUrl).then(() => take(XDATA.N ? [...Array(XDATA.N).keys()].find(j => XDATA.id(j) === s) ?? -1 : -1), () => {});
    else take((XDATA.find(s, 1)[0]) ?? -1);
  }
  if (gid) {
    const C = XDATA.comm, lv = Math.min(2, (gid.match(/_/g) || []).length);
    let k = -1;
    for (let l = lv; l >= 0 && k < 0; l--) k = C.find(l, gid);
    if (k >= 0) selectGroup(k, false);
  }
}
// a button in B's panes clicked (its data-act not the frame's: true when handled) and the search box typed in
function actB(el) {
  const v = el.dataset.v;
  const f = {
    bsub: () => { selectSub(v === 'none' ? -1 : +v); if (v !== 'none' && X.tab === 'groups') pickTab('substances'); },
    bgroup: () => { selectGroup(v === 'none' ? -1 : +v); if (v !== 'none' && X.tab === 'substances') pickTab('groups'); },
    bscene: () => { if (SCENES.some(s => s[0] === v)) openScene(v); },
  }[el.dataset.act];
  if (!f) return false;
  f();
  return true;
}
function inputB(ev) {
  if (!ev.target || ev.target.id !== 'xsq') return false;
  XB.q = ev.target.value;
  bLoad('names');
  bSugg(!!XB.q.trim());
  return true;
}
