
// ================================================================ EXPLORE ==
// Explore mode: the organs and their tissues, the domains and their tissue types, what changes with age, the method in
// four steps; or any scene with its own controls.
const SCENES = [
  ['body', 'Body', `The ${FACTS.organs} organs whose tissue GTEx collected, as points of light on a body drawn from a PET scan (the tour's body).`],
  ['slide', 'Section', 'One H&E-stained section of stomach wall (the tour\'s tissue, drawn), with the method\'s tiles, features and neighbours, and its domains at 20 and at 70.'],
  ['atlas', 'Library and atlas', `The slide library (${fmt(FACTS.slides)} slides), a section per tissue with its domains, the tiles in one map, what changes with age and the pathology curves.`],
  ['hier', 'Network', 'Iva Buljan\'s network of organ architecture: organs, tissues, tissue types and domains; and one organ\'s domain contacts at 20 and at 70.'],
];
const SCENE_SHORT = { atlas: 'Atlas' };
const TABS = [['organs', 'Organs'], ['domains', 'Domains'], ['age', 'Age'], ['method', 'Method'], ['scenes', 'Scenes']];
// the tour's body set: its network and its disease scan are the tour's illustration, so this story leaves them out;
// the sets' own Age controls give way to the story's age slider (X.age), which drives them all
const HIDE_CTL = { body: ['view', 'state', 'tracer'] };
const isAge = c => /^age$/i.test(c.key) || /^age$/i.test(c.label || '');
const ctlsOf = k => (GL.sets[k].controls || []).filter(c => !(HIDE_CTL[k] || []).includes(c.key) && !isAge(c));
// a control the panes offer now: a set may say when one applies (when(values)), so none sits there doing nothing; the
// shared state keeps every control (ctlsOf) all the same
const ctlShown = (k, c) => !c.when || c.when(Object.fromEntries((GL.sets[k].controls || []).map(x => [x.key, isAge(x) ? ageOpt(x) : ctlValue(k, x)])));
const AGE0 = FACTS.ages[0], AGE1 = FACTS.ages[1];
const X = { tab: 'organs', scene: 'atlas', ctl: {}, t0: 0, turn: 'on', organ: null, domain: null, age: AGE0, step: 1, kind: null };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['slide_focus', 'atlas_focus', 'hier_focus', 'hier_organ', 'dots_pick', 'atlas_net']);   // (atlas_net: the story's morph, never eased back in explore)
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
// a control's option whose key or name matches re (the sets name their own options)
const optKey = (k, key, re) => { const c = ctlOf(k, key), o = c && c.options.find(([v, n]) => re.test(v) || re.test(n)); return o ? o[0] : null; };
// the age slider as a set's own Age option (the one nearest X.age)
const ageOpt = c => { let b = c.options[0][0], bd = Infinity; for (const [v, n] of c.options) { const a = parseFloat(n) || parseFloat(v), d = Math.abs(a - X.age); if (d < bd) { bd = d; b = v; } } return b; };
const ageF = () => clamp((X.age - AGE0) / (AGE1 - AGE0), 0, 1);
// a view option's camera: the cam view of the same name, or the one its name stands for
const CAM_ALIAS = { atlas: { tiles: 'umap', age: 'volcano', pathology: 'curves', section: 'focus' }, slide: { section: 'default', features: 'matrix', neighbours: 'close', groups: 'group', age: 'domains' },
  hier: { network: 'net' } };
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {}, vc = ctlOf(k, 'view'), o = vc && vc.options.find(x => x[0] === v), n = o ? String(o[1]).toLowerCase() : '';
  // the atlas with a section brought forward: the section alone, or beside the volcano or the curves
  if (k === 'atlas' && X.organ && atlasIdx(X.organ)) { if (VIEW.map.test(v) && c.focus) return 'focus'; if ((VIEW.volcano.test(v) || VIEW.curves.test(v)) && c.age) return 'age'; }
  // (the atlas's age camera is for the volcano beside a section; the volcano alone has its own)
  if (k === 'atlas' && v === 'age' && c.volcano) return 'volcano';
  for (const x of [v, al[v], n, al[n]]) if (x && c[x]) return x;
  return null;
}
const viewCam = k => { const c = ctlOf(k, 'view'); return c ? camFor(k, ctlValue(k, c)) : null; };
// the view on show in a set, by its key or its name
const viewIs = (k, re) => { const c = ctlOf(k, 'view'); if (!c) return false; const v = ctlValue(k, c), o = c.options.find(x => x[0] === v); return re.test(v) || !!(o && re.test(o[1])); };
// the views the panes ask for, by what they show
const VIEW = { lib: /lib/i, map: /^atlas$/i, umap: /tile|umap/i, volcano: /volcano|^age$/i, curves: /patho|curve/i, net: /net/i, contacts: /contact/i,
  section: /section/i, sAge: /^age$/i };
// the method's four steps and the slide's views that show them
const STEPS = [
  ['Tiles', /tile/i, () => `Each slide is cut into small squares: ${FACTS.tilesM} million tiles in all.`],
  ['Features', /feat/i, () => 'A deep-learning vision model describes each tile with a list of numbers, its features.'],
  ['Neighbours', /neigh/i, () => 'Each tile mixes in the features of the tiles around it (message passing), so it knows its surroundings.'],
  ['Domains', /group/i, () => 'Tiles with similar mixed features are grouped, across all slides: in a map of their features, alike tiles gather. A pathologist then names each group: a domain.'],
];
// work for the next frame, once the sets have drawn what was just picked (their anchors follow their params)
const NEXT = [];
const afterUpdate = f => { NEXT.push(f); };
// the organ picked (X.organ: an organ's name, or one of its GTEx tissues'), and the worked examples' organs
const organOf = v => (v ? MD.organ(v) || tissueOrgan(v) : null);
const exOrgan = i => { const x = FACTS.ex[i]; return x && atlasIdx(x.tissue) ? (api('atlas').tissues || [])[atlasIdx(x.tissue) - 1] : null; };
// the worked example on show (-1 none): its section in the atlas with the age slider, or the gut's on the slide
const exOn = () => FACTS.ex.findIndex((x, i) => (exOrgan(i) ? X.scene === 'atlas' && X.organ === exOrgan(i) && viewIs('atlas', VIEW.map)
  : X.scene === 'slide' && viewIs('slide', VIEW.sAge) && X.domain === x.domain));

// what the chosen scene and its controls ask for: that set fully in, every other set out; then what the panes pick
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  // the slide's tiles and domains lie on the tour's tissue section: wherever the slide shows, the section shows too
  if (k === 'slide') Object.assign(tg, GL.sets.tissue.params, { tissue_a: 1 });
  tg[k + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = isAge(ct) ? ageOpt(ct) : ctlValue(k, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  const ag = ageF(), O = organOf(X.organ);
  tg.dots = 0; tg.dots_pick = 0;
  if (k === 'body') { tg.body_net = 0; tg.body_state = 0; tg.dots = 1; tg.dots_pick = O ? O.i + 1 : 0; }   // never the tour's own network or disease scan
  if (k === 'slide') { if (viewIs('slide', /age|domain/i)) tg.slide_age = ag; tg.slide_focus = X.domain ? slideIdx(X.domain) : 0; }
  if (k === 'atlas') { tg.atlas_focus = X.organ ? atlasIdx(X.organ) : 0; tg.atlas_age = ag; }
  if (k === 'hier') {
    const d = X.domain ? hierIdx(X.domain, 3) : -1, t = O && X.organ !== O.name ? hierIdx(X.organ, 1) : -1;
    tg.hier_focus = d >= 0 ? d : t >= 0 ? t : O ? hierIdx(O.name, 0) : X.kind ? hierIdx(X.kind, 2) : -1;
    tg.hier_age = ag;
  }
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
  // a gently swaying scene, unless you are steering it or a set asks for stillness
  if (X.turn === 'on' && !orbit.to && !orbit.held && !GL.still && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
// what the panes pick reaches the sets through their params (exploreTargets); here only the labels follow
function pushState() { updateExtraLabels(); }
function openScene(k, fly = true) {
  if (k === 'tissue') k = 'slide';   // (the section is shown with the slide)
  if (!GL.sets[k] || !SCENES.some(s => s[0] === k)) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (!same) sfxAct('whoosh', k, null, { dur: 1.2 });   // (sound effects: another scene)
  if (fly && !same) flyTo(view(k, viewCam(k) || 'default'));
  renderAll();
}
function setCtl(k, key, v) {
  const c = ctlOf(k, key);
  if (!c || !c.options.some(o => o[0] === v)) return;
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  // a view of one of the method's steps is that step
  if (k === 'slide' && key === 'view') { const i = STEPS.findIndex(s => viewIs('slide', s[1])); if (i >= 0) X.step = i + 1; }
  // a view has its own best camera
  if (key === 'view' && k === X.scene) { const n = camFor(k, v); flyTo(view(k, n || 'default')); }
  renderAll();
}
// a view of a set by what it shows (VIEW), its scene brought up
function showView(k, re) { if (X.scene !== k) openScene(k); const v = optKey(k, 'view', re); if (v && ctlValue(k, ctlOf(k, 'view')) !== v) setCtl(k, 'view', v); }
function flyTo(v) {
  const c = orbit.cur;
  orbit.from = c.slice();
  orbit.to = v.slice();
  orbit.to[0] = v[0] + 360 * Math.round((c[0] - v[0]) / 360);
  orbit.t0 = performance.now(); orbit.fast = false;
}
function orbitStep(now) {
  if (!orbit.to) return;
  const x = smooth((now - orbit.t0) / ((orbit.fast ? 0.25 : orbit.dur) * 1000)), f = orbit.from, t = orbit.to;   // fast: a view from the room
  orbit.cur = f.map((v, k) => (k === 2 ? Math.exp(Math.log(v) + (Math.log(t[k]) - Math.log(v)) * x) : v + (t[k] - v) * x));
  if (x >= 1) { orbit.to = null; orbit.fast = false; }
}
// fly to a point of the scene on show, keeping the direction you look from
function flyNear(p, d) { if (p) flyTo([orbit.cur[0], orbit.cur[1], d, p[0], p[1], p[2]]); }

// --------------------------------------------------------------- actions --
// Each setter changes its own field only when called with ui false (a shared room's state arriving); picked by
// hand (ui true) it also brings up the scene and the view that show it.
// an organ, or one of its tissues (null none): its section comes forward in the atlas, it lights up in the network
// and in the body
function selectOrgan(v, ui = true) {
  const O = organOf(v);
  X.organ = O ? (MD.organ(v) ? O.name : (O.tissues.find(t => t.toLowerCase() === String(v).toLowerCase()) || O.name)) : null;
  if (X.organ) X.domain = null;
  if (ui && X.organ) {
    if (X.scene === 'body') afterUpdate(() => { if (X.organ && organOf(X.organ) === O) flyNear(O.pos, Math.min(orbit.cur[2], 1.6)); });
    else if (X.scene !== 'hier' || !viewIs('hier', VIEW.net)) { if (atlasIdx(X.organ)) { if (!(X.scene === 'atlas' && (viewIs('atlas', VIEW.volcano) || viewIs('atlas', VIEW.curves)))) showView('atlas', VIEW.map); flyTo(view('atlas', viewCam('atlas') || 'focus')); } }
  }
  if (ui && !X.organ && X.scene === 'atlas') flyTo(view('atlas', viewCam('atlas') || 'default'));   // (back from the section)
  if (ui && X.organ) sfxAct('pick', X.scene, X.scene === 'body' ? O.pos : null);   // (sound effects: an organ picked)
  pushState(); renderAll();
}
// a domain of the network (null none): it lights up in the network, and on the section if it is one of its domains
function selectDomain(v, ui = true) {
  const d = v ? MD.domain(v) : -1;
  X.domain = d >= 0 ? nodeName(d) : null;
  if (X.domain) { X.organ = null; X.kind = nodeName(MD.typeOfDomain(d)) || X.kind; }
  if (ui && X.domain && !(X.scene === 'slide' && slideIdx(X.domain))) showView('hier', VIEW.net);
  if (ui && X.domain) sfxAct('pick', X.scene, null);   // (sound effects: a domain picked)
  pushState(); renderAll();
}
// a tissue type: the Domains panes list its domains (this device's own choice, not shared)
function pickKind(v) { X.kind = MD.type(v) >= 0 ? nodeName(MD.type(v)) : null; renderAll(); }
// the age (20 to 70): the sections, the domains on the slide and the contacts follow it
function setAge(v, ui = false) {
  const a0 = X.age;
  X.age = Math.round(clamp(+v, AGE0, AGE1));
  // (sound effects: the slider moved by hand across a decade, a tone higher each decade)
  if (ui && Math.floor(a0 / 10) !== Math.floor(X.age / 10)) sfxAct('step', X.scene, null, { pitch: Math.pow(2, 2 * (Math.floor(X.age / 10) - 2) / 12) });
  // (moved by hand where nothing shows the age: the gut's example on the slide)
  if (ui && !(X.scene === 'slide' && viewIs('slide', /age|domain/i)) && !(X.scene === 'atlas' && X.organ && viewIs('atlas', VIEW.map)) && !(X.scene === 'hier' && viewIs('hier', VIEW.contacts))) showExample(FACTS.ex.findIndex((x, i) => !exOrgan(i)), false);
  syncAge();
}
// one of the method's four steps (1 to 4): the section with that step's view
function setStep(n, ui = true) {
  X.step = clamp(n | 0, 1, STEPS.length);
  if (ui) showView('slide', STEPS[X.step - 1][1]);
  if (ui) sfxAct('step', 'slide', null, { pitch: Math.pow(2, 2 * (X.step - 1) / 12) });   // (sound effects: the method's step, a tone higher each)
  renderAll();
}
// a worked example of change with age: its section in the atlas (or on the slide), at 70 unless asked otherwise
function showExample(i, to70 = true) {
  const x = FACTS.ex[i];
  if (!x) return;
  if (exOrgan(i)) { X.domain = null; X.organ = exOrgan(i); showView('atlas', VIEW.map); flyTo(view('atlas', viewCam('atlas') || 'focus')); }
  else { X.organ = null; const d = MD.domain(x.domain); X.domain = d >= 0 ? nodeName(d) : null; showView('slide', VIEW.sAge); }
  if (to70) X.age = AGE1;
  pushState(); renderAll();
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls, the organ (or
// tissue), the domain, the age and the method's step. The tissue type listed in the Domains panes, the search and the
// camera are each person's own.
// shared rooms: the scene's view in a headset at a station (explore mode), which turns and sizes it in the room:
// shared (HOST.collab), so everyone there sees it alike; null while it flies somewhere (a pick, a view arriving)
function collabView() {
  if (APP.mode !== 'explore' || orbit.to) return null;
  const c = orbit.cur, r = (x, k) => Math.round(x * k) / k;
  return [r((((c[0] + 180) % 360) + 360) % 360 - 180, 10), r(c[1], 10), r(c[2], 100), r(c[3], 100), r(c[4], 100), r(c[5], 100)];
}
function collabSetView(v) {
  if (APP.mode !== 'explore' || !Array.isArray(v) || v.length !== 6 || !v.every(Number.isFinite)) return;
  const c = orbit.cur, to = v.slice();
  to[0] += 360 * Math.round((c[0] - to[0]) / 360);
  Object.assign(orbit, { from: c.slice(), to, t0: performance.now(), fast: true });   // a short glide there
}
function collabState() {
  const ctl = {};
  for (const [k] of SCENES) ctl[k] = Object.fromEntries(ctlsOf(k).map(c => [c.key, ctlValue(k, c)]));
  return { tab: X.tab, scene: X.scene, ctl, organ: X.organ, domain: X.domain, age: X.age, step: X.step };
}
// show another person's state with the story's own setters (so both panels follow); every field is checked, and
// the camera stays where this person has it
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  if (TABS.some(t => t[0] === v.tab) && v.tab !== X.tab) showTab(v.tab);
  // the scene and its controls; a view flies to its own camera as it does here
  if (SCENES.some(s => s[0] === v.scene) && v.scene !== X.scene) openScene(v.scene);
  for (const [k] of SCENES) for (const c of ctlsOf(k)) {
    const x = v.ctl && v.ctl[k] && v.ctl[k][c.key];
    if (!c.options.some(o => o[0] === x) || ctlValue(k, c) === x) continue;
    if (k === X.scene) setCtl(k, c.key, x); else (X.ctl[k] = X.ctl[k] || {})[c.key] = x;
  }
  // then the picks (after the views, which may set the step: the room's step wins)
  if ((v.organ === null || (typeof v.organ === 'string' && organOf(v.organ))) && v.organ !== X.organ) selectOrgan(v.organ, false);
  if ((v.domain === null || (typeof v.domain === 'string' && MD.domain(v.domain) >= 0)) && v.domain !== X.domain) selectDomain(v.domain, false);
  if (Number.isInteger(v.age) && v.age >= AGE0 && v.age <= AGE1 && v.age !== X.age) setAge(v.age);
  if (Number.isInteger(v.step) && v.step >= 1 && v.step <= STEPS.length && v.step !== X.step) setStep(v.step, false);
  renderAll();
}

// ------------------------------------------------------------------ panes --
// (a lit chip as the shell's primary button: its text in the panel's colour, readable in either theme)
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:var(--panel-solid)"' : ''}>${col ? `<span class="sw" style="background:${swCol(col)}"></span>` : ''}${label}</button>`;
// each organ's small 3D model (ORGAN3D, sets/organs.js) as a picture for the panes: drawn once at 64 px, shown at 20 to
// 30. The models and pictures build between frames from the start (updateSets), the ones a pane asks for first; until
// an organ's picture is drawn its chip keeps the place with a soft dot, and the picture goes in as it comes
// (fillOrganPics), so nothing is drawn again all at once
const orgPic = o => (o && ORGAN3D.idOf(o.name)) || null;
const ORG_DOT = 'radial-gradient(circle,rgba(255,158,196,.55) 0 22%,rgba(255,158,196,0) 46%)';
const iconImg = (o, px) => {
  const id = orgPic(o), u = id ? ORGAN3D.picUrl(id) : '', s = px || 22;
  return id ? `<span class="o3"${u ? '' : ` data-org="${id}"`} aria-hidden="true" style="display:inline-block;width:${s}px;height:${s}px;vertical-align:-6px;margin-right:5px;background:${u ? `url(${u})` : ORG_DOT} center/contain no-repeat"></span>` : '';
};
function fillOrganPics() {
  for (const el of document.querySelectorAll('span.o3[data-org]')) {
    const u = ORGAN3D.picUrl(el.dataset.org);
    if (u) { el.style.background = `url(${u}) center/contain no-repeat`; el.removeAttribute('data-org'); }
  }
}
const link = (act, v, text) => `<button type="button" data-act="${act}" data-v="${esc(v)}" style="border:0;background:none;padding:0;font:inherit;color:var(--cyan);text-decoration:underline;cursor:pointer">${text}</button>`;
let DQ = '';   // the Domains pane's search (this page's own)
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    ${TABS.map(([k]) => `<div class="pane" id="pane-${k}" role="tabpanel"></div>`).join('')}`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => pickTab(b.dataset.tab)));
  // one click handler per pane: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v, n = v !== undefined && v !== '' && !isNaN(+v) ? +v : v;
    ({
      organ: () => selectOrgan(organOf(v) && organOf(v) === organOf(X.organ) && MD.organ(v) ? null : v), tis: () => selectOrgan(v),
      domain: () => selectDomain(v === X.domain ? null : v), kind: () => { pickKind(v); if (X.tab !== 'domains') showTab('domains'); },
      ex: () => showExample(n), view: () => { const [k, r] = v.split(':'); showView(k, VIEW[r]); }, step: () => setStep(n),
      scene: () => openScene(v), ctl: () => setCtl(b.dataset.scene || X.scene, b.dataset.ctl, v),
    }[b.dataset.act] || (() => {}))();
  });
  // the age slider and the domains' search change in place, so a drag or typing is not cut short by a redraw
  $('#explore').addEventListener('input', ev => {
    const el = ev.target;
    if (el.dataset.age !== undefined) setAge(+el.value, true);
    else if (el.id === 'domq') { DQ = el.value; filterDomains(); }
  });
  renderAll();
  $('#viewctl').innerHTML = `<div class="grp"><span>Turn</span><div class="seg" data-ctl="turn" role="group" aria-label="Turn">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]'), seg = b && b.closest('[data-ctl]');
    if (seg && seg.dataset.ctl === 'turn') setTurn(b.dataset.v);
  });
  showTab(X.tab);
}
function setTurn(v) {
  X.turn = v;
  document.querySelectorAll('[data-ctl="turn"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
}
function showTab(k) {
  X.tab = k;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === k));
  // (five tabs overflow a phone's panel: the row scrolls so the chosen one shows)
  const tb = $('#explore .tabs'), on = tb && tb.querySelector(`[data-tab="${k}"]`);
  if (on) { const r = on.getBoundingClientRect(), q = tb.getBoundingClientRect(); if (r.width && (r.left < q.left || r.right > q.right)) tb.scrollLeft += r.left - q.left - 8; }
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + k));
  updateExtraLabels();
}
// a tab picked by hand brings up the scene it talks about (a shared room's tab arriving does not: its scene comes with it)
function pickTab(k) {
  showTab(k);
  if (k === 'organs' && X.scene === 'slide') { if (X.organ && atlasIdx(X.organ)) showView('atlas', VIEW.map); else openScene('body'); }
  if (k === 'domains' && X.scene !== 'hier' && !(X.scene === 'slide' && X.domain && slideIdx(X.domain))) showView('hier', VIEW.net);
  if (k === 'age' && !(exOn() >= 0 || (X.scene === 'atlas' && (viewIs('atlas', VIEW.volcano) || viewIs('atlas', VIEW.curves))) || (X.scene === 'hier' && viewIs('hier', VIEW.contacts)))) showView('atlas', VIEW.volcano);
  if (k === 'method') setStep(X.step);
}
function renderAll() { renderOrgans(); renderDomains(); renderAge(); renderMethod(); renderScenes(); updateExtraLabels(); }
function renderOrgans() {
  const pane = $('#pane-organs');
  if (!pane) return;
  const O = organOf(X.organ);
  let h = `<p class="sub">The ${FACTS.organs} organs whose tissue GTEx collected. Pick one: its section, its tissues and its place in the network.</p>
    <div class="chips">${MD.organs.map(o => chip(`data-act="organ" data-v="${esc(o.name)}"`, iconImg(o) + esc(o.name), O === o)).join('')}</div>`;
  if (O) {
    const tis = O.tissues.length ? O.tissues : [O.name], fd = figDomains(X.organ !== O.name ? X.organ : tis[0]);
    h += `<h3>${iconImg(O, 26)}${esc(O.name)}</h3>
      <p class="grp-h">${tis.length > 1 ? `Its ${word(tis.length)} tissues in GTEx: pick one to see its section` : 'One tissue in GTEx'}</p>
      <div class="chips">${tis.map(t => chip(`data-act="tis" data-v="${esc(t)}"`, esc(tisShort(t, O.name)), X.organ === t || (tis.length > 1 && X.organ === O.name && t === tis[0]), LEVEL_COL[1])).join('')}</div>
      <p class="grp-h">Its tissue types in the network</p>
      <div class="chips">${O.types.map(t => chip(`data-act="kind" data-v="${esc(nodeName(t))}"`, `${esc(cap(nodeName(t)))} <small>${MD.typeDomains(t).length}</small>`, false, LEVEL_COL[2])).join('')}</div>
      <p class="sub">The number is how many domains hang on that tissue type in the network (shared with other organs). Pick a type to see them.</p>
      ${fd.length ? `<p class="grp-h">Domains of ${esc(tisShort(X.organ !== O.name ? X.organ : tis[0], O.name))} in the talk's atlas (approximate share, read off the talk's figure)</p><div class="chips">${fd.map(d => (MD.domain(d.name) >= 0 ? chip(`data-act="domain" data-v="${esc(nodeName(MD.domain(d.name)))}"`, `${esc(cap(d.name))} <small>${shareTxt(d.share)}</small>`, false, domCol(d.name))
        : `<span class="empty" style="display:inline-flex;align-items:center;padding:6px 8px"><span class="sw" style="background:${swCol(domCol(d.name))};margin-right:6px"></span>${esc(cap(d.name))}&nbsp;<small>${shareTxt(d.share)}</small></span>`)).join('')}</div>` : ''}
      <p class="grp-h">Show it</p><div class="chips">${chip('data-act="view" data-v="atlas:map"', 'Its section', X.scene === 'atlas' && viewIs('atlas', VIEW.map))}${chip('data-act="view" data-v="hier:net"', 'In the network', X.scene === 'hier' && viewIs('hier', VIEW.net))}${chip('data-act="scene" data-v="body"', 'In the body', X.scene === 'body')}</div>`;
  } else h += '<p class="empty">Point at an organ\'s light in the body, a section in the atlas or a node of the network to pick it there.</p>';
  pane.innerHTML = h;
}
function renderDomains() {
  const pane = $('#pane-domains');
  if (!pane) return;
  const d = X.domain ? MD.domain(X.domain) : -1, t = d >= 0 ? MD.typeOfDomain(d) : -1;
  let h = `<p class="sub">The network's ${MD.domains.length} domains (as named in this map), by the tissue type they belong to. Pick one, or search.</p>`;
  if (d >= 0) {
    const org = t >= 0 ? MD.typeOrgans(t) : [], si = slideIdx(X.domain);
    h += `<h3><span class="sw" style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${domCol(X.domain)};margin-right:8px"></span>${esc(cap(X.domain))}</h3>
      <dl class="stats"><dt>Tissue type</dt><dd style="font-size:16px">${t >= 0 ? link('kind', nodeName(t), esc(cap(nodeName(t)))) : '–'}</dd>
      <dt>Organs with it</dt><dd>${org.length}<small>organs have ${t >= 0 ? esc(nodeName(t)) : 'its tissue type'}; the network does not say which of them have this domain</small></dd></dl>
      <div class="chips">${org.map(o => chip(`data-act="organ" data-v="${esc(o.name)}"`, iconImg(o) + esc(o.name), false)).join('')}</div>
      <p class="grp-h">Show it</p><div class="chips">${chip('data-act="view" data-v="hier:net"', 'In the network', X.scene === 'hier')}${si ? chip('data-act="view" data-v="slide:sAge"', 'On the section', X.scene === 'slide') : ''}</div>`;
  }
  h += `<input type="search" id="domq" placeholder="Search the domains" aria-label="Search the domains" value="${esc(DQ)}" style="width:100%;margin:12px 0 4px;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--ink);font:inherit">
    <div id="domList">${MD.types.filter(x => MD.typeDomains(x).length).map(x => `<div data-grp><p class="grp-h"${X.kind === nodeName(x) ? ' style="color:var(--ink)"' : ''}><span class="sw" style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${LEVEL_COL[2]};margin-right:6px"></span>${esc(cap(nodeName(x)))}</p>
      <div class="chips">${MD.typeDomains(x).map(y => chip(`data-act="domain" data-v="${esc(nodeName(y))}" data-name="${esc(nodeName(y).toLowerCase())}"`, esc(cap(nodeName(y))), y === d, domCol(nodeName(y)))).join('')}</div></div>`).join('')}</div>
    <p class="note">Domain colours are the same in every scene. Point at a domain on the section or a node of the network to pick it there.</p>`;
  pane.innerHTML = h;
  filterDomains();
}
// the search: domains whose name holds it (and the groups that still hold any)
function filterDomains() {
  const q = DQ.trim().toLowerCase();
  document.querySelectorAll('#domList [data-grp]').forEach(g => {
    let any = false;
    g.querySelectorAll('[data-name]').forEach(b => { const on = !q || b.dataset.name.includes(q); b.style.display = on ? '' : 'none'; any = any || on; });
    g.style.display = any ? '' : 'none';
  });
}
function renderAge() {
  const pane = $('#pane-age');
  if (!pane) return;
  const F = FACTS, e = exOn(), exCol = ['#ff9ec4', '#ffd166', '#c77dff'];
  pane.innerHTML = `<p class="sub">Age is the strongest of ${F.donorVars} things known about the donors. ${pct(F.ageChange)} of domains change with it, mostly by less than ${pct(F.mostUnder)} per decade. Pick an example, or move the age.</p>
    <p class="grp-h">Worked examples</p><div class="chips">${F.ex.map((x, i) => chip(`data-act="ex" data-v="${i}"`, esc(exName(x)), e === i, exCol[i])).join('')}</div>
    ${e >= 0 ? `<p class="sub">${esc(cap(exText(F.ex[e])))}.</p>` : ''}
    <p class="grp-h">Age <b data-agev style="margin-left:auto;color:var(--ink)">${X.age}</b></p><input type="range" data-age min="${AGE0}" max="${AGE1}" step="1" value="${X.age}" aria-label="Age" style="accent-color:#ffb43b">
    <p class="grp-h">Across the body</p><div class="chips">${chip('data-act="view" data-v="atlas:volcano"', 'What changes', X.scene === 'atlas' && viewIs('atlas', VIEW.volcano))}${chip('data-act="view" data-v="atlas:curves"', 'Pathology', X.scene === 'atlas' && viewIs('atlas', VIEW.curves))}${chip('data-act="view" data-v="hier:contacts"', 'Contacts', X.scene === 'hier' && viewIs('hier', VIEW.contacts))}</div>
    <p class="note">${esc(F.connective)} ${esc(F.most)}${F.plaque ? ` ${esc(cap(F.plaque.kind))} ${esc(inOrgan(F.plaque.organ))} ${esc(F.plaque.note)}` : ''}${F.infarct ? `; ${esc(F.infarct.kind)} ${esc(inOrgan(F.infarct.organ))} ${esc(F.infarct.note)}` : ''}.</p>`;
}
// the age's readouts and slider, in place (a drag is not cut short)
function syncAge() {
  document.querySelectorAll('[data-agev]').forEach(el => { el.textContent = X.age; });
  document.querySelectorAll('input[data-age]').forEach(el => { if (document.activeElement !== el) el.value = X.age; });
}
function renderMethod() {
  const pane = $('#pane-method');
  if (!pane) return;
  const F = FACTS, s = STEPS[X.step - 1];
  pane.innerHTML = `<p class="sub">How ${esc(F.method)} finds domains in ${fmt(F.slides)} slides without being told what to look for, in four steps.</p>
    <div class="chips">${STEPS.map(([n], i) => chip(`data-act="step" data-v="${i + 1}"`, `${i + 1} · ${n}`, X.step === i + 1 && X.scene === 'slide')).join('')}</div>
    <h3>${X.step} · ${s[0]}</h3><p>${esc(s[2]())}</p>
    <div class="actions">${X.step > 1 ? chip(`data-act="step" data-v="${X.step - 1}"`, 'Back', false) : ''}${X.step < STEPS.length ? chip(`data-act="step" data-v="${X.step + 1}"`, 'Next', false) : ''}</div>
    <p class="grp-h">Then</p><div class="chips">${chip('data-act="view" data-v="atlas:umap"', 'The tiles in one map', X.scene === 'atlas' && viewIs('atlas', VIEW.umap))}${chip('data-act="view" data-v="atlas:map"', 'The atlas', X.scene === 'atlas' && viewIs('atlas', VIEW.map))}</div>
    <p class="note">It agrees with pathologists' notes: salivary gland r = ${F.bench.salivary.r}, stomach mucosa r = ${F.bench.stomach.r} (1 would be perfect). The result: ${F.domains} domains of ${F.types} types.</p>`;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${ctlsOf(X.scene).filter(c => ctlShown(X.scene, c)).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    ${ageHere() ? `<p class="grp-h">Age <b data-agev style="margin-left:auto;color:var(--ink)">${X.age}</b></p><input type="range" data-age min="${AGE0}" max="${AGE1}" step="1" value="${X.age}" aria-label="Age" style="accent-color:#ffb43b">` : ''}
    ${X.organ && X.scene !== 'slide' && !contactsOn() ? `<p class="sub" style="margin-top:10px">Also shown: ${esc(X.organ)} (Organs tab).</p>` : X.domain && !contactsOn() ? `<p class="sub" style="margin-top:10px">Also shown: ${esc(cap(X.domain))} (Domains tab).</p>` : ''}`;
}
// a share read off the talk's figure, by eye: under half a percent is shown as <1%
const shareTxt = f => (f * 100 < 0.5 ? '&lt;1%' : Math.round(f * 100) + '%');
// the network's contacts: one organ's own contact network (the hier set's Organ control), not the organ or domain picked
const contactsOn = () => X.scene === 'hier' && viewIs('hier', VIEW.contacts);
// the scene on show changes with the age (the slider belongs with it)
const ageHere = () => (X.scene === 'slide' && viewIs('slide', /age|domain/i)) || (X.scene === 'atlas' && !!X.organ && viewIs('atlas', VIEW.map)) || (X.scene === 'hier' && viewIs('hier', VIEW.contacts));
// labels the panes add (the sets label their own picks: the atlas names its focused section, the network its focused node)
let XL = null;
function updateExtraLabels() {
  const O = organOf(X.organ), sig = [APP.mode, X.scene, X.organ].join('|');
  if (sig === XL) return;
  XL = sig;
  LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); });
  LBL.extra = [];
  if (APP.mode !== 'explore') return;
  // the organ picked, at its point in the body
  if (X.scene === 'body' && O) LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(O.name)}</b>`, 'mag'), set: 'body', at: O.pos.slice(), o: -1, txt: [O.name, '', 'mag'] });
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { organ } (an organ or one of its
// tissues), { domain }, { kind } (a tissue type) or { sdom } (a domain of the section not in the network), or null
function pickWith(rc) {
  if (APP.mode !== 'explore') return null;
  const k = X.scene;
  if (k === 'body') { const i = GL.dots.pick(rc); return i >= 0 ? { organ: MD.organs[i].name } : null; }
  const A = api(k);
  if (!A.pick) return null;
  let r = -1;
  try { r = A.pick(rc); } catch (e) { return null; }
  if (!(r >= 0)) return null;
  if (k === 'atlas') { const t = (A.tissues || [])[r]; return t && organOf(t) ? { organ: t } : null; }
  if (k === 'hier') {
    const n = (A.nodes || [])[r];
    if (!n) return null;
    if (n.level === 3) { const d = MD.domain(n.name); return d >= 0 ? { domain: nodeName(d) } : null; }
    if (n.level === 2) return MD.type(n.name) >= 0 ? { kind: nodeName(MD.type(n.name)) } : null;
    return organOf(n.name) ? { organ: n.name } : null;
  }
  if (k === 'slide') { const d = slideDomain(r); return d ? { domain: d } : (A.domains || [])[r] ? { sdom: A.domains[r] } : null; }
  return null;
}
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
// where a pick is, in its set's own frame (for the headset's ray and tip), or null (then where the ray meets the scene)
function pickPos(p) {
  if (p && p.organ && X.scene === 'body') { const O = organOf(p.organ); return O ? O.pos.slice() : null; }
  return null;
}
const pickText = p => (p.organ ? (MD.organ(p.organ) ? [p.organ, 'organ'] : [tisShort(p.organ, organOf(p.organ).name), `tissue of the ${organOf(p.organ).name.toLowerCase()}`])
  : p.domain ? [cap(p.domain), nodeName(MD.typeOfDomain(MD.domain(p.domain))) || 'domain'] : p.kind ? [cap(p.kind), 'tissue type'] : [cap(p.sdom), 'on this section']);
function choosePick(p) {
  if (!p) return;
  if (p.organ) { if (X.tab !== 'organs') showTab('organs'); selectOrgan(p.organ === X.organ ? null : p.organ, false); }
  else if (p.domain) { if (X.tab !== 'domains') showTab('domains'); selectDomain(p.domain === X.domain ? null : p.domain, false); }
  else if (p.kind) { showTab('domains'); pickKind(p.kind); }
}
function bindCanvas() {
  const cv = GL.canvas, tip = $('#tip'), pts = new Map();
  let down = null, pinch = 0;
  cv.addEventListener('pointerdown', ev => {
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    cv.setPointerCapture(ev.pointerId);
    down = { x: ev.clientX, y: ev.clientY, moved: false };
    orbit.held = true;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  cv.addEventListener('pointermove', ev => {
    const explore = APP.mode === 'explore';
    if (pts.has(ev.pointerId) && explore) {
      const p = pts.get(ev.pointerId), dx = ev.clientX - p[0], dy = ev.clientY - p[1];
      pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch > 0) orbit.cur[2] = clamp(orbit.cur[2] * pinch / d, 0.05, 40);
        pinch = d; down.moved = true; return;
      }
      if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) down.moved = true;
      if (down && down.moved) {
        orbit.to = null;
        orbit.cur[0] -= dx * 0.25; orbit.cur[1] = clamp(orbit.cur[1] + dy * 0.25, -80, 80);
      }
      tip.style.opacity = 0;
      return;
    }
    if (!explore || ev.pointerType === 'touch') { tip.style.opacity = 0; return; }
    const p = pickAt(ev.clientX, ev.clientY);
    cv.style.cursor = p && !p.sdom ? 'pointer' : 'grab';
    if (p) {
      const [b, r] = pickText(p);
      tip.innerHTML = `<b>${esc(b)}</b>${esc(r)}`;
      tip.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 12}px)`;
      tip.style.opacity = 1;
    } else tip.style.opacity = 0;
  });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (APP.mode === 'explore' && down && !down.moved && ev.type === 'pointerup') choosePick(pickAt(ev.clientX, ev.clientY));
    if (!pts.size) { down = null; orbit.held = false; }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { tip.style.opacity = 0; });
  cv.addEventListener('wheel', ev => {
    if (APP.mode !== 'explore') return;
    ev.preventDefault();
    orbit.to = null;
    orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ev.deltaY * 0.0012), 0.05, 40);
  }, { passive: false });
}
