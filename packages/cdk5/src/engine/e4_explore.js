// ================================================================ EXPLORE ==
// Explore mode: the authors' nine scenes with their switches (Scenes), any protein by its gene symbol or by pointing at
// it, with its partners lit (Proteins), the Disease Ontology terms offered, their proteins lit and their counts
// (Diseases), and what is whose (About). The scenes are not sets: both sets show every scene (the net its
// arrangement, the core its centre's close-up). Every number shown is looked up in CDK5_DATA (through CDATA and the
// sets' api()): nothing is computed here.
const SCN = CD.SCENES;   // bioproc, subunits, partners, ntrk2, sema, npas4, calpain, alzheimer, disease
const SCENES = [
  ['bioproc', 'Map of processes', `Every protein on a sphere by the Gene Ontology biological processes it takes part in: the ${fmt(FACTS.withProcess)} with a known process on the inner sphere, the ${fmt(FACTS.without)} without on the outer shell; links only between near neighbours. ${KNOT_NOTE}`],
  ['subunits', 'Activators', 'CDK5 and its two activators, p35 and p39, pulled into the map\'s centre, their two links bright green. The structures: CDK5 with the part of p35 that grips it; p39 has none known.'],
  ['partners', 'Its partners', `CDK5's ${fmt(FACTS.deg)} partners in the interactome, in the authors' star round it (their second project); ${FACTS.family5} of its cousins brighter.`],
  ['ntrk2', 'NTRK2 signalling', `The ${FACTS.ntrk2} proteins of Reactome's Signalling by NTRK2 pulled into the centre, with the ${FACTS.ntrk2Links} links among them; only these links show. The structures: BDNF and NTRK2's binding domain.`],
  ['sema', 'Semaphorins', `Reactome's Semaphorin interactions: the ${FACTS.semaShown} of its ${FACTS.sema} proteins in the map that its links join in one piece, with the ${FACTS.semaLinks} links among them (the authors' second project). The structures: SEMA4D and its receptor PLXNB1.`],
  ['npas4', 'NPAS4', `Reactome's Transcriptional regulation by NPAS4: the ${FACTS.npas4Shown - 1} of its ${FACTS.npas4} proteins in the map that its links join in one piece, and CDK5, joined to NPAS4 by a line the authors drew (the interactome has none). The structure: NPAS4 (mouse).`],
  ['calpain', 'Calpain', 'CDK5, now hyperactive, and calpain at the centre, with the one link the authors drew between them (calpain cuts p35, not CDK5); every other link of the two left out. The structures: calpain-1\'s cutting core; CDK5 with p25.'],
  ['alzheimer', 'Alzheimer\'s pathway', `The ${FACTS.alz} proteins of the Alzheimer's pathway pulled into the centre, CDK5 red, the ${FACTS.alzLinks} links among them; the map coloured by disease. Beside the centre: a Tau filament (Tau is a partner of CDK5, not in the pathway's list).`],
  ['disease', 'Disease landscape', `Every protein placed by the Disease Ontology diseases it is linked to: the ${fmt(FACTS.withDisease)} with a disease in the middle, the rest pushed to the walls; links between near proteins that interact.`],
];
const SCENE_SHORT = { bioproc: 'Processes', subunits: 'Activators', partners: 'Partners', ntrk2: 'NTRK2', sema: 'Semaphorins', npas4: 'NPAS4', calpain: 'Calpain', alzheimer: 'Alzheimer\'s', disease: 'Diseases' };
// the camera each scene opens on (the net's views)
const SCENE_VIEW = { bioproc: 'default', subunits: 'centre', partners: 'centre', ntrk2: 'centre', sema: 'centre', npas4: 'centre', calpain: 'centre', alzheimer: 'centre', disease: 'land' };
const sIdx = k => SCN.indexOf(k);
const hasCore = k => k !== 'bioproc' && k !== 'disease' && SCN.includes(k);
// the structures each scene shows in explore (the core's params), and p35 docked on CDK5 there
const MOL_X = {
  subunits: ['core_mCdk5', 'core_mP35', 'core_p39'], partners: ['core_mCdk5'], ntrk2: ['core_mCdk5', 'core_mP35', 'core_mBdnf', 'core_mTrkb'],
  sema: ['core_mSema'], npas4: ['core_mNpas4'], calpain: ['core_mCdk5', 'core_mP35', 'core_mCapn'], alzheimer: ['core_mCdk5', 'core_mP35', 'core_tau', 'core_mTau', 'core_phos'],
};
// the panes' closing notes, the same on the page and in the headset
const NOTE = {
  proteins: `Partners are the proteins one is known to bind (the interactome's protein-protein interactions). The diseases are among the ${FACTS.termsN} Disease Ontology terms offered here; a protein's own associations reach further. Gene symbols name the proteins (Entrez genes).`,
  diseases: `The counts are ours, in this map: over the ${fmt(FACTS.withDisease)} proteins with any disease association (parents included), ${FACTS.partnersDz} of CDK5's ${FACTS.deg} partners among them, against what chance would give (a hypergeometric test). The 30 nearest share CDK5's diseases by construction: the landscape places proteins with the same diseases together. Well-studied proteins have more known partners and diseases, so these are hints, not findings.`,
};
const TABS = [['scenes', 'Scenes'], ['proteins', 'Proteins'], ['diseases', 'Diseases'], ['about', 'About']];
// each scene's switches (the engine's, not the sets'): the knots of shared processes on the map of processes, its links, the sphere's outer shell, CDK5's cousins on the map of
// processes, its 30 nearest in the landscape
const CT = {
  clouds: { key: 'clouds', label: 'Processes', options: [['shown', 'Shown'], ['hidden', 'Hidden']] },
  links: { key: 'links', label: 'Links', options: [['on', 'On'], ['off', 'Off']] },
  shell: { key: 'shell', label: 'Outer shell', options: [['shown', 'Shown'], ['faint', 'Faint']] },
  cousins: { key: 'cousins', label: 'Its cousins', options: [['off', 'Off'], ['on', 'On']] },
  near: { key: 'near', label: 'Its 30 nearest', options: [['off', 'Off'], ['on', 'On']] },
};
const CTLS = { bioproc: [CT.clouds, CT.links, CT.shell, CT.cousins], subunits: [CT.links, CT.shell], partners: [CT.links, CT.shell], ntrk2: [CT.links, CT.shell],
  sema: [CT.links, CT.shell], npas4: [CT.links, CT.shell], calpain: [CT.links, CT.shell], alzheimer: [CT.links, CT.shell], disease: [CT.links, CT.near] };
const ctlsOf = k => CTLS[k] || [];
const PATHS = [[-1, 'None'], [0, 'NTRK2 signalling'], [2, 'Semaphorins'], [3, 'NPAS4'], [1, 'Alzheimer\'s pathway']];
// a pathway's key in CDATA.pathways by its number, and its colour
const PATH_KEY = ['ntrk2', 'alzheimer', 'sema', 'npas4'];
const pathCol = v => (v === 1 ? CC.alz : v >= 0 ? CC.pathway : null);
// (explore opens on the disease landscape; each scene's switches start as the story shows them)
const X = { tab: 'scenes', scene: 'disease', t0: 0, turn: 'on', inside: false, ctl: {}, prot: -1, term: -1, path: -1, q: '', tpage: 0 };
//#use XS
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['net_pick', 'net_path', 'net_term']);
//#use orbit ctlValue ctlOf
const ctlv = (k, key) => { const c = ctlOf(k, key); return c ? ctlValue(k, c) : ''; };
// the camera a scene opens on, or standing inside the map
const sceneCam = () => (X.inside ? 'inside' : SCENE_VIEW[X.scene] || 'default');
// what the sets know (their api()): picking, places, the eye
const API = {};
//#use api NEXT
// the Disease Ontology terms offered, CDK5's own first, then the rest alphabetically (indices into CDATA.terms)
const TERM_ORDER = CD.terms.map((t, j) => j).sort((x, y) => (CD.terms[y].cdk5 - CD.terms[x].cdk5) || CD.terms[x].name.localeCompare(CD.terms[y].name, 'en', { sensitivity: 'base' }));
// a protein's name as the story says it (p35 and p39, calpain), and its gene symbol
const ALIAS = { [CD.r1]: 'p35', [CD.r2]: 'p39', [CD.capn1]: 'calpain', [CD.find('MAPT')]: 'Tau' };
const protName = i => (ALIAS[i] ? `${ALIAS[i]} · ${CD.sym[i]}` : CD.sym[i]);
// quick picks (Proteins): CDK5, its activators, calpain, the hub, the receptor and its growth factor
const QUICK = [CD.cdk5, CD.r1, CD.r2, CD.capn1, CD.find('MAPT'), CD.find('APP'), CD.find('NTRK2'), CD.find('BDNF'), CD.find('SEMA4D'), CD.npas4].filter(i => i >= 0);
const pathOf = i => [0, 2, 3, 1].filter(p => CD.pathways[PATH_KEY[p]].members.includes(i));

// what the chosen scene, its switches and the panes' picks ask for: both sets in (the core where the scene has a centre)
function exploreTargets() {
  const k = X.scene, i = Math.max(0, sIdx(k)), core = hasCore(k) && !X.inside, hyper = i >= sIdx('calpain') ? 1 : 0, sw = key => ctlv(k, key);
  const tg = Object.assign({}, GL.sets.net.params, GL.sets.core.params, {
    net_a: 1, core_a: core ? 1 : 0, net_scene: i, core_scene: i, net_grow: 1,
    net_links: sw('links') === 'off' ? 0 : 1, net_shell: sw('shell') === 'faint' ? 0 : 1,
    net_cdk5: 1, net_hyper: hyper, core_hyper: hyper, core_cut: hyper, core_flow: ['ntrk2', 'sema', 'npas4', 'alzheimer'].includes(k) ? 1 : 0,
    core_names: hasCore(k) && CD.scene(k).centre.length > 30 ? 0 : 1,   // (a crowded centre: only its key names; a pick names any)
    core_dock: 1, core_mCdk5: 0, core_mP35: 0, core_p39: 0, core_mCapn: 0, core_mBdnf: 0, core_mTrkb: 0, core_mSema: 0, core_mNpas4: 0, core_tau: 0, core_mTau: 0, core_phos: 0,
    net_veil: core ? 1 : 0, net_core: core ? 1 : 0, net_family: sw('cousins') === 'on' ? 1 : 0, net_near: sw('near') === 'on' ? 1 : 0,
    net_clouds: i === 0 && sw('clouds') !== 'hidden' ? 1 : 0, net_shells: 0, net_landTags: k === 'disease' ? 1 : 0, net_homes: 0, net_hub: 0, net_partners: 0,
    net_pick: X.prot, net_path: X.path, net_term: X.term, net_termA: X.term >= 0 ? 1 : 0,
    net_dim: X.prot >= 0 || X.term >= 0 || X.path >= 0 || sw('near') === 'on' ? 0.55 : sw('cousins') === 'on' ? 0.3 : 0,
  });
  for (const n of MOL_X[k] || []) tg[n] = 1;
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
//#use exploreStep pushState
function openScene(k, fly = true) {
  if (!SCN.includes(k)) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (!INSIDE_OK(k) && X.inside) { X.inside = false; if (fly && same) flyTo(view('net', sceneCam())); }   // (standing inside: the map of processes only)
  if (fly && !same) { if (!X.inside) flyTo(view('net', sceneCam())); sfxAct('whoosh', 'net', 'centre', { dur: 0.8 }); }   // (sound effects: another scene)
  renderAll();
}
function setCtl(k, key, v) {
  const c = ctlOf(k, key);
  if (!c || !c.options.some(o => o[0] === v)) return;
  if (ctlValue(k, c) !== v) ctlSound(k, key, v);
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  renderAll();
}
// (sound effects: a switch: links snap on or off, the shell fades, the cousins or the nearest light up)
function ctlSound(k, key, v) {
  const on = v === 'on' || v === 'shown';
  sfxAct(...(key === 'links' ? [on ? 'link' : 'snap', 'net', 'cdk5'] : key === 'shell' ? ['whoosh', 'net', 'top', { dur: 0.7, pitch: on ? 1.1 : 0.8 }]
    : [on ? 'ping' : 'step', 'net', key === 'near' ? 'near' : 'cdk5']));
}
// a switch of a scene picked from a pane: its scene brought up
function sceneCtl(k, key, v) {
  if (X.scene !== k) openScene(k);
  setCtl(k, key, v);
}
//#use flyTo orbitStep
// fly to look at a protein: on the sphere from outside, over its own place; at the centre, the close-up; in the
// landscape close to it, keeping the direction you look from (not while standing inside the map)
function flyToProt(i) {
  if (X.inside || i < 0 || !api('net').pos) return;
  const p = api('net').pos(i), r = Math.hypot(p[0], p[1], p[2]);
  if (X.scene === 'disease') flyTo([orbit.cur[0], orbit.cur[1], Math.min(orbit.cur[2], 1.8), p[0], p[1], p[2]]);
  else if (hasCore(X.scene) && r < CD.CENTRE_R * 1.2) flyTo(view('net', 'centre'));
  else if (r > 1e-6) flyTo([Math.atan2(p[0], p[2]) / D2R, clamp(Math.asin(clamp(p[1] / r, -1, 1)) / D2R, -60, 60), 2.0, p[0] / 2, p[1] / 2, p[2] / 2]);
}
// Stand inside: the camera at the map's middle, looking out at CDK5's side (in a headset the map about 2.5 m round you).
// Only on the map of processes: there the middle is empty (every protein at least 0.82 from it, about 1 m in a headset);
// the other scenes have CDK5 and the centre's proteins there, and the landscape its bulk
const INSIDE_OK = k => k === 'bioproc';
function setInside(on, ui = true) {
  on = !!on && INSIDE_OK(X.scene);
  if (on !== X.inside) sfxAct('whoosh', 'net', 'centre', { dur: 1, pitch: on ? 0.8 : 1.2 });
  X.inside = on;
  if (ui) flyTo(view('net', sceneCam()));
  renderAll();
}

// --------------------------------------------------------------- actions --
// Each setter changes its own field only when called with ui false (a shared room's state arriving); picked by
// hand (ui true) it also flies to what it shows.
// a protein (-1 none): its ring, its label with its partners, its partners' lines across the map
function selectProt(i, ui = true) {
  const was = X.prot;
  X.prot = Number.isInteger(i) && i >= 0 && i < CD.n ? i : -1;
  if (X.prot >= 0 && X.prot !== was) sfxAct('pick', 'net', 'pick');   // (sound effects: a protein picked, at it)
  if (ui && X.prot >= 0) NEXT.push(() => { if (X.prot >= 0) flyToProt(X.prot); });
  renderAll();
}
// a disease term (-1 none): its proteins lit on the scene on show
function selectTerm(j, ui = true) {
  const was = X.term;
  X.term = Number.isInteger(j) && j >= 0 && j < CD.terms.length ? j : -1;
  if (X.term >= 0 && X.term !== was) sfxAct('ping', 'net', 'term');   // (sound effects: a term lit)
  if (ui && X.term >= 0) X.tpage = Math.floor(TERM_ORDER.indexOf(X.term) / TPAGE);
  renderAll();
}
// a pathway lit (-1 none, 0 NTRK2's, 1 the Alzheimer's, 2 Semaphorin interactions, 3 NPAS4's): its members brighten
// wherever they are
function setPath(p, ui = true) {
  const v = Number.isInteger(p) && p >= 0 && p < PATH_KEY.length ? p : -1;
  if (v >= 0 && v !== X.path) sfxAct('pulse', 'net', 'centre', { gain: 0.6 });
  X.path = v;
  renderAll();
}
// a protein shown in the landscape: the scene, then close to it
function protOnLand(i) {
  if (i < 0) return;
  if (X.inside) setInside(false, false);
  openScene('disease', false);
  NEXT.push(() => flyToProt(i));
  renderAll();
}
// the search (Proteins): the matches for what is typed, CDK5 first (the page's own field; a headset types on the shell's
// keypad); never shared
const searchOf = q => CD.search(q, 10);
async function xrSearch() {
  if (!(HOST.collab && HOST.collab.keypad)) return;
  let q = null;
  try { q = await HOST.collab.keypad({ title: 'Search a protein', hint: 'Its gene symbol, such as CDK5 or APP', value: X.q, max: 16 }); } catch (e) { q = null; }
  if (q === null || q === undefined) return;
  X.q = String(q).trim().toUpperCase();
  const r = searchOf(X.q);
  if (r.length && CD.sym[r[0]].toUpperCase() === X.q) selectProt(r[0]);
  renderAll();
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene, every scene's switches, the protein picked,
// the term picked and the pathway lit. The camera (and standing inside), the search text and the term list's page are
// each person's own. v: the shape of this state (a package changes it only together with v, which apply checks).
// (v2, v190: the scenes partners, sema and npas4, the pathways 2 and 3)
const COLLAB_V = 2;
// shared rooms: the scene's view in a headset at a station (explore mode), which turns and sizes it in the room:
// shared (HOST.collab), so everyone there sees it alike; null while it flies somewhere (a pick, a view arriving)
function collabView() {
  if (APP.mode !== 'explore' || orbit.to || X.inside || XR.inW > 0.01) return null;   // (standing inside is this device's own)
  const c = orbit.cur, r = (x, k) => Math.round(x * k) / k;
  return [r((((c[0] + 180) % 360) + 360) % 360 - 180, 10), r(c[1], 10), r(c[2], 100), r(c[3], 100), r(c[4], 100), r(c[5], 100)];
}
//#use collabSetView
function collabState() {
  const ctl = {};
  for (const k of SCN) ctl[k] = Object.fromEntries(ctlsOf(k).map(c => [c.key, ctlValue(k, c)]));
  return { v: COLLAB_V, tab: X.tab, scene: X.scene, ctl, prot: X.prot, term: X.term, path: X.path };
}
// show another person's state with the story's own setters (so both panels follow); every field is checked, and
// the camera stays where this person has it
function collabApply(v) {
  if (!v || typeof v !== 'object' || v.v !== COLLAB_V) return;
  if (TABS.some(t => t[0] === v.tab) && v.tab !== X.tab) showTab(v.tab);
  if (SCN.includes(v.scene) && v.scene !== X.scene) openScene(v.scene, false);   // (another person's change: this camera stays)
  for (const k of SCN) for (const c of ctlsOf(k)) {
    const x = v.ctl && v.ctl[k] && v.ctl[k][c.key];
    if (!c.options.some(o => o[0] === x) || ctlValue(k, c) === x) continue;
    if (k === X.scene) setCtl(k, c.key, x); else (X.ctl[k] = X.ctl[k] || {})[c.key] = x;
  }
  const int = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
  if (int(v.prot, -1, CD.n - 1) && v.prot !== X.prot) selectProt(v.prot, false);
  if (int(v.term, -1, CD.terms.length - 1) && v.term !== X.term) selectTerm(v.term, false);
  if (int(v.path, -1, PATH_KEY.length - 1) && v.path !== X.path) setPath(v.path, false);
  renderAll();
}

//#use chip statsHtml
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    ${TABS.map(([k]) => `<div class="pane" id="pane-${k}" role="tabpanel"></div>`).join('')}`;
  // the Proteins pane's search field is built once (a redraw must not take the text being typed), its picks below it
  $('#pane-proteins').innerHTML = `<p class="sub">Search a protein by its gene symbol, or click one on the map (or point at it and pull the trigger).</p>
    <div class="search"><input id="cdkq" type="search" placeholder="A gene symbol, such as CDK5 or APP" autocomplete="off" spellcheck="false" aria-label="Search proteins" role="combobox" aria-expanded="false" aria-controls="cdkqs"><ul class="sugg" id="cdkqs" role="listbox"></ul></div>
    <div id="protPane"></div>`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => pickTab(b.dataset.tab)));
  // one click handler per pane: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v;
    ({
      scene: () => openScene(v), ctl: () => sceneCtl(b.dataset.scene || X.scene, b.dataset.ctl, v), inside: () => setInside(!X.inside),
      path: () => setPath(+v), prot: () => selectProt(v === 'none' ? -1 : +v), term: () => selectTerm(v === 'none' ? -1 : +v),
      land: () => protOnLand(+v), tland: () => { if (X.inside) setInside(false, false); openScene('disease'); },
    }[b.dataset.act] || (() => {}))();
  });
  // the search: matches as you type, Enter takes the first (or the one chosen with the arrows)
  const q = $('#cdkq'), sg = $('#cdkqs');
  let hits = [], sel = 0;
  const list = () => {
    hits = searchOf(q.value); sel = 0;
    sg.innerHTML = hits.map((i, k) => `<li role="option" data-i="${i}" aria-selected="${k === sel}"><b>${esc(CD.sym[i])}</b><span>${ALIAS[i] ? esc(ALIAS[i]) : ''}</span><em>${fmt(CD.deg(i))} partners</em></li>`).join('');
    sg.classList.toggle('on', hits.length > 0 && !!q.value.trim()); q.setAttribute('aria-expanded', sg.classList.contains('on'));
  };
  const take = i => { if (i === undefined || i < 0) return; q.value = CD.sym[i]; sg.classList.remove('on'); q.setAttribute('aria-expanded', 'false'); selectProt(i); };
  q.addEventListener('input', list);
  q.addEventListener('focus', () => { if (q.value.trim()) list(); });
  q.addEventListener('blur', () => setTimeout(() => sg.classList.remove('on'), 150));
  q.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { take(hits[sel]); ev.preventDefault(); }
    else if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && hits.length) {
      sel = (sel + (ev.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length;
      sg.querySelectorAll('li').forEach((li, k) => li.setAttribute('aria-selected', k === sel));
      ev.preventDefault();
    } else if (ev.key === 'Escape') sg.classList.remove('on');
  });
  sg.addEventListener('mousedown', ev => { const li = ev.target.closest('li'); if (li) { ev.preventDefault(); take(+li.dataset.i); } });
  renderAll();
  $('#viewctl').innerHTML = `<div class="grp"><span>Turn</span><div class="seg" data-ctl="turn" role="group" aria-label="Turn">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]'), seg = b && b.closest('[data-ctl]');
    if (seg && seg.dataset.ctl === 'turn') setTurn(b.dataset.v);
  });
  showTab(X.tab);
}
//#use setTurn showTab
// a tab picked by hand (every tab works on the scene on show: nothing to bring up)
function pickTab(k) { showTab(k); renderAll(); }
function renderAll() { renderScenes(); renderProteins(); renderDiseases(); renderAbout(); updateExtraLabels(); }

// ---------------------------------------------------------------- scenes --
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const i = sIdx(X.scene), sc = SCENES[i];
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${ctlsOf(X.scene).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    <p class="grp-h">Light a pathway</p><div class="chips">${PATHS.map(([v, n]) => chip(`data-act="path" data-v="${v}"`, esc(n), X.path === v, pathCol(v))).join('')}</div>
    ${INSIDE_OK(X.scene) ? `<div class="chips" style="margin-top:12px">${chip('data-act="inside"', 'Stand inside', X.inside)}</div>` : ''}
    <p class="note">The authors' scene: ${esc(AUTHOR_SC[i])}.${hasCore(X.scene) ? ' The balls, tubes and names at the centre are our clearer drawing of its proteins, at the authors\' places, scaled up.' : ''}</p>`;
}

// -------------------------------------------------------------- proteins --
// a protein in words (both panels): its partners, a process, its diseases among the terms offered, its pathways
function protInfo(i) {
  if (i < 0) return null;
  const tm = CD.termsOf(i), pw = pathOf(i), nb = Array.from(CD.nb(i)).sort((a, b) => CD.deg(b) - CD.deg(a));
  return {
    head: protName(i), i,
    rows: [['Partners', fmt(CD.deg(i)), i === CD.cdk5 ? `${ordinal(FACTS.rank)} of ${fmt(FACTS.proteins)}` : ''],
      ['Known process', CD.bp(i) ? 'yes' : 'none', CD.bp(i) ? 'on the inner sphere' : 'on the outer shell'],
      ['Diseases', CD.dis(i) ? (tm.length ? `${tm.length} of the ${FACTS.termsN} terms here` : 'none of the terms here') : 'none known', CD.dis(i) ? 'in the landscape\'s middle' : 'at the landscape\'s walls'],
      ['Pathways', pw.length ? pw.map(p => PATHS.find(x => x[0] === p)[1]).join(', ') : 'none of the four']],
    partners: nb.slice(0, 12), more: Math.max(0, nb.length - 12), terms: tm.slice(0, 6),
  };
}
function renderProteins() {
  const el = $('#protPane');
  if (!el) return;
  const I = protInfo(X.prot);
  el.innerHTML = `<div class="chips">${QUICK.map(i => chip(`data-act="prot" data-v="${i}"`, esc(ALIAS[i] || CD.sym[i]), X.prot === i, i === CD.cdk5 ? (XS.net_hyper > 0.5 ? CC.hyper : CC.cdk5) : null)).join('')}</div>
    ${I ? `<h3 style="color:${inkCol(CC.pick)}">${esc(I.head)}</h3>${statsHtml(I.rows)}
      <p class="grp-h">Partners${I.more ? `: the first ${I.partners.length}, most linked first, and ${fmt(I.more)} more` : ''}</p>
      <div class="chips">${I.partners.map(j => chip(`data-act="prot" data-v="${j}"`, esc(CD.sym[j]), false)).join('') || '<span class="sub">none</span>'}</div>
      ${I.terms.length ? `<p class="grp-h">Diseases among the terms</p><div class="chips">${I.terms.map(j => chip(`data-act="term" data-v="${j}"`, esc(CD.terms[j].name), X.term === j, CC.term)).join('')}</div>` : ''}
      <div class="chips" style="margin-top:12px">${X.scene !== 'disease' ? chip(`data-act="land" data-v="${I.i}"`, 'Show it on the landscape', false) : ''}${I.i !== CD.cdk5 ? chip(`data-act="prot" data-v="${CD.cdk5}"`, 'Back to CDK5', false) : ''}${chip('data-act="prot" data-v="none"', 'None', false)}</div>`
    : '<p class="sub">No protein picked.</p>'}
    <p class="note">${esc(NOTE.proteins)}</p>`;
}

// -------------------------------------------------------------- diseases --
const TPAGE = 10;
// a term in words (both panels): its size, CDK5's own or not, its partners and nearest against chance
function termInfo(j) {
  const t = CD.terms[j];
  if (!t) return null;
  const e = v => (v >= 10 ? Math.round(v) : (Math.round(v * 10) / 10).toFixed(1));
  return { head: cap(t.name), rows: [['Proteins', fmt(t.n), 'with this disease, in this map'], ['CDK5\'s own', t.cdk5 ? 'yes' : 'no'],
    ['Its partners', `${t.partners} of ${FACTS.partnersDz}`, `about ${e(t.expP)} expected${t.pP < 0.05 ? ', ' + pTxt(t.pP) : ''}`],
    ['Its 30 nearest', `${t.near} of ${FACTS.nearN}`, `about ${e(t.expN)} expected${t.pN < 0.05 ? ', ' + pTxt(t.pN) : ''}`]] };
}
function renderDiseases() {
  const pane = $('#pane-diseases');
  if (!pane) return;
  const I = X.term >= 0 ? termInfo(X.term) : null, keep = pane.querySelector('.tlist'), top = keep ? keep.scrollTop : 0;
  pane.innerHTML = `<p class="sub">${FACTS.termsN} Disease Ontology terms, CDK5's own first. Pick one to light its proteins on the scene on show; the landscape shows them best.</p>
    <div class="chips tlist" style="max-height:220px;overflow-y:auto">${TERM_ORDER.map(j => chip(`data-act="term" data-v="${j}"`, esc(CD.terms[j].name), X.term === j, CD.terms[j].cdk5 ? (XS.net_hyper > 0.5 ? CC.hyper : CC.cdk5) : null)).join('')}</div>
    ${I ? `<h3 style="color:${inkCol(CC.term)}">${esc(I.head)}</h3>${statsHtml(I.rows)}
      <div class="chips">${X.scene !== 'disease' ? chip('data-act="tland"', 'Show on the landscape', false) : ''}${chip('data-act="term" data-v="none"', 'None', false)}</div>` : '<p class="sub">No term picked. Terms with a CDK5 swatch are its own.</p>'}
    <p class="note">${esc(NOTE.diseases)}</p>`;
  const tl = pane.querySelector('.tlist'); if (tl) tl.scrollTop = top;
}

// ----------------------------------------------------------------- about --
function renderAbout() {
  const pane = $('#pane-about');
  if (!pane) return;
  pane.innerHTML = `<p class="sub">${esc(ABOUT)}</p>
    <p class="grp-h">The authors' nine scenes</p>
    <ul class="legend">${SCENES.map(([k, n], i) => `<li><span class="sw" style="background:${swCol(SCENE_COL[k])}"></span>${esc(AUTHOR_SC[i])}: ${esc(n)}</li>`).join('')}</ul>
    <p class="grp-h">The structures (close-ups not to scale)</p>
    <ul class="legend">${STRUCTS.map(s => `<li>${esc(s[0])}: ${esc(s[1])}</li>`).join('')}</ul>
    <p class="note">${esc(ABOUT_NOTE)} Over-representation counts: ${esc(CD.diseases.method)}.</p>`;
}
// each scene's swatch (About)
const SCENE_COL = { bioproc: CC.cdk5, subunits: CC.activator, partners: CC.partner, ntrk2: CC.pathway, sema: CC.pathway, npas4: CC.pathway, calpain: CC.calpain, alzheimer: CC.alz, disease: CC.hyper };
// labels the panes add (none: the sets label their own picks)
function updateExtraLabels() {}

//#use _rc
// what a ray (a THREE.Raycaster in world coordinates) points at: a ball of the core first, else a protein of the map;
// { p: its index, k: the set that found it } or null
// what can be picked (the engine's pickMemo, v224): explore's params and where the viewer is (the net's veil and the
// core's nearness follow it: _eye, updateSets); not while CDK5 pulses (its ball's size follows the clock)
function pickSig(out) {
  if ((XS.core_a || 0) >= 0.5 && (XS.core_hyper || 0) > 0) return false;
  out.push(_eye.x, _eye.y, _eye.z);
  for (const n in XS) out.push(XS[n]);
}
function pickWith(rc) {
  if (APP.mode !== 'explore') return null;
  for (const k of ['core', 'net']) {
    if ((XS[k + '_a'] || 0) < 0.5) continue;
    const A = api(k);
    let r = -1;
    try { r = A.pick ? A.pick(rc) : -1; } catch (e) { r = -1; }
    if (r && typeof r === 'object') r = r.i;   // (a set answering with an object)
    if (Number.isInteger(r) && r >= 0 && r < CD.n) return { p: r, k };
  }
  return null;
}
//#use pickAt
// where a pick is, in the net's own frame (for the headset's ray and tip), or null (then where the ray meets the scene)
function pickPos(p) {
  const A = api(p.k);
  return A.pos ? A.pos(p.p) : null;
}
function pickText(p) { return [protName(p.p), ` · ${fmt(CD.deg(p.p))} partners`]; }
// a click (or the trigger) on a protein picks it (again: none), in the Proteins tab
function choosePick(p) {
  if (!p) return;
  if (X.tab !== 'proteins') showTab('proteins');
  selectProt(p.p === X.prot ? -1 : p.p, false);
}
//#use bindCanvas