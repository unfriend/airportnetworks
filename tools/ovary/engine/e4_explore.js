//#use head
// ================================================================ EXPLORE ==
// Explore mode: the kinds of object and their numbers, the age along the poster's trend lines, the two methods; or any
// scene with its own controls.
const SCENES = [
  ['organ', 'Ovary', 'A drawn ovary, cut open: follicles in the cortex, blood vessels in the medulla, a corpus luteum and corpora albicantia. Its counts follow the poster\'s trend lines with age.'],
  ['section', 'Section', 'A drawn H&E section of an ovary with the four kinds of object and cysts; a younger and an older one; the two methods; and the illustrative neighbor network, also gathered by kind.'],
];
//#use SCENE_SHORT
const TABS = [['objects', 'Objects'], ['age', 'Age'], ['methods', 'Methods'], ['scenes', 'Scenes']];
// the sets' own Age controls give way to the story's age slider (X.age), which drives them all
const isAge = c => /^age$/i.test(c.key) || /^age$/i.test(c.label || '');
const ctlsOf = k => (GL.sets[k].controls || []).filter(c => !isAge(c));
//#use ctlShown AGE0
const X = { tab: 'objects', scene: 'section', ctl: {}, t0: 0, turn: 'on', kind: null, age: 30, method: 'rf' };
//#use XS
// params that pick something by number jump to their new value instead of easing through the ones in between (none
// in this story's scenes now)
const STEP = new Set();
//#use orbit ctlValue ctlOf optKey
const hasOpt = (k, key, v) => { const c = ctlOf(k, key); return !!(c && c.options.some(o => o[0] === v)); };
//#use ageOpt
// a view option's camera: the one it stands for, or the cam view of the same name
const CAM_ALIAS = { organ: { cut: 'default', closed: 'whole', body: 'pelvis' }, section: { section: 'default', masks: 'mask', network: 'net' } };
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {}, vc = ctlOf(k, 'view'), o = vc && vc.options.find(x => x[0] === v), n = o ? String(o[1]).toLowerCase() : '';
  for (const x of [al[v], v, n, al[n]]) if (x && c[x]) return x;
  return null;
}
//#use viewCam viewIs NEXT afterUpdate
// each kind in a line (the story's own words)
const KIND_TEXT = { vessel: 'Tubes that carry blood, here cut across: a wall round an opening.', macrophage: 'Immune cells that clear away debris.',
  albicans: 'Pale scars, each left by a corpus luteum after an egg was released. They pile up over the years.', follicle: 'An egg in a ring of cells; the large ones hold fluid. The reserve that is never refilled.',
  cyst: 'Fluid-filled sacs. Only the segmentation looks for them.' };

// what the chosen scene and its controls ask for: that set fully in, every other set out; then what the panes pick
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  tg[k + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = isAge(ct) ? ageOpt(ct) : ctlValue(k, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  // the age slider drives the ovary and the section to the year (the sets' own Age options are steps of ten); on the Age
  // tab the cut-away ovary carries its tags (each method's count on the poster's lines) instead of its parts' names
  if (k === 'organ') {
    tg.organ_age = X.age;
    if (viewIs('organ', /body/)) Object.assign(tg, GL.sets.body.params, { body_a: 1, body_net: 0, body_state: 0, body_blank: 0 });   // the ovary in the tour's body
    else if (X.tab === 'age') Object.assign(tg, { organ_counts: 1, organ_parts: 0 });
  }
  if (k === 'section') tg.section_age = X.age;
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  // a set coming in waits until the one going out is gone: the ovary and the section stand in one place, and two
  // see-through models there flicker in a headset as their drawing order flips with the head. One going out also drops
  // a little more each frame, so it is gone in about half a second instead of lingering faintly for one more (the
  // owner, 2 November 2026: "ovary section and more still overlaps on transitions")
  const going = Object.keys(DEF).some(n => n.endsWith('_a') && tg[n] === 0 && XS[n] > 0);
  for (const n in DEF) {
    const fade = n.endsWith('_a');
    if (going && fade && tg[n] > XS[n]) continue;
    XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
    if (fade && tg[n] === 0) XS[n] = Math.max(0, XS[n] - dt * 0.6);
  }
  // a gently swaying scene, unless you are steering it or a set asks for stillness
  if (X.turn === 'on' && !orbit.to && !orbit.held && !GL.still && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
//#use pushState
function openScene(k, fly = true) {
  if (!GL.sets[k] || !SCENES.some(s => s[0] === k)) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (fly && !same) { flyTo(view(k, viewCam(k) || 'default')); sfxAct('whoosh', k, null, { dur: 0.8 }); }   // (sound effects: another scene)
  pushState(); renderAll();
}
function setCtl(k, key, v) {
  const c = ctlOf(k, key);
  if (!c || !c.options.some(o => o[0] === v)) return;
  // (sound effects: a view, By kind's hubs, a kind picked out, an age)
  if (ctlValue(k, c) !== v) sfxAct(...(key === 'view' ? (v === 'kinds' ? ['rise', k, 'kinds', { dur: 2 }] : ['whoosh', k, null, { dur: 0.7, pitch: 1.1 }]) : key === 'show' ? ['pick', k, v !== 'none' && GL.sets[k].anchors[v] ? v : null] : ['step', k, null, { pitch: 1.2 }]));
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  // a view has its own best camera
  if (key === 'view' && k === X.scene) { const n = camFor(k, ctlValue(k, ctlOf(k, 'view'))); flyTo(view(k, n || 'default')); }
  pushState(); renderAll();
}
// a view of a set by its option's key, its scene brought up
function showView(k, v) { if (X.scene !== k) openScene(k); if (hasOpt(k, 'view', v) && ctlValue(k, ctlOf(k, 'view')) !== v) setCtl(k, 'view', v); }
//#use flyTo orbitStep
// --------------------------------------------------------------- actions --
// Each setter changes its own field only when called with ui false (a shared room's state arriving); picked by
// hand (ui true) it also sets the scenes' controls that show it.
// a kind of object (null none): picked out on the section and in the ovary (where it has it); a kind the ovary on show
// lacks (macrophages, cysts) brings up the section
function selectKind(v, ui = true) {
  const was = X.kind;
  X.kind = KD[v] ? v : null;
  if (ui) {
    const k = X.kind;
    (X.ctl.section = X.ctl.section || {}).show = k || 'none';
    (X.ctl.organ = X.ctl.organ || {}).show = k && hasOpt('organ', 'show', k) ? k : 'none';
    if (k && X.scene === 'organ' && !hasOpt('organ', 'show', k)) openScene('section');
  }
  if (X.kind && X.kind !== was) sfxAct('pick', X.scene, GL.sets[X.scene].anchors[X.kind] ? X.kind : null);   // (sound effects: a kind picked)
  pushState(); renderAll();
}
// the age (20 to 70): the ovary and the section follow it
function setAge(v) {
  const d0 = Math.floor(X.age / 10);
  X.age = Math.round(clamp(+v, AGE0, AGE1));
  // (sound effects: each decade the slider crosses, a tone lower the older)
  const d1 = Math.floor(X.age / 10);
  if (d1 !== d0) sfxAct('step', X.scene === 'section' ? 'section' : 'organ', X.scene === 'section' ? 'center' : 'age', { pitch: Math.pow(2, -2 * (d1 - 2) / 12), gain: 0.6 });
  syncAge();
}
// one of the two methods: tiles and the random forest (the vote plays again), or SegFormer's masks (swept again)
function setMethod(m, ui = true) {
  if (!METHOD[m]) return;
  if (m !== X.method) sfxAct('whoosh', 'section', 'center', { dur: 1.2, pitch: m === 'seg' ? 1.2 : 0.85 });   // (sound effects: the other method)
  X.method = m;
  if (ui) { showView('section', m === 'rf' ? 'forest' : 'masks'); X.t0 = performance.now(); }
  renderAll();
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls, the kind of
// object, the age and the method. The camera is each person's own.
//#use collabView collabSetView
function collabState() {
  const ctl = {};
  for (const [k] of SCENES) ctl[k] = Object.fromEntries(ctlsOf(k).map(c => [c.key, ctlValue(k, c)]));
  return { tab: X.tab, scene: X.scene, ctl, kind: X.kind, age: X.age, method: X.method };
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
  // then the picks (after the controls, which already show them)
  if ((v.kind === null || (typeof v.kind === 'string' && KD[v.kind])) && v.kind !== X.kind) selectKind(v.kind, false);
  if (Number.isInteger(v.age) && v.age >= AGE0 && v.age <= AGE1 && v.age !== X.age) setAge(v.age);
  if (METHOD[v.method] && v.method !== X.method) setMethod(v.method, false);
  renderAll();
}

//#use chip
const ageInput = () => `<p class="grp-h">Age <b data-agev style="margin-left:auto;color:var(--ink)">${X.age}</b></p><input type="range" data-age min="${AGE0}" max="${AGE1}" step="1" value="${X.age}" aria-label="Age" style="accent-color:#ffb43b;width:100%">`;
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    ${TABS.map(([k]) => `<div class="pane" id="pane-${k}" role="tabpanel"></div>`).join('')}`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => pickTab(b.dataset.tab)));
  // one click handler per pane: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v;
    ({
      kind: () => selectKind(v === X.kind ? null : v), method: () => setMethod(v),
      view: () => { const [k, o] = v.split(':'); showView(k, o); },
      scene: () => openScene(v), ctl: () => setCtl(b.dataset.scene || X.scene, b.dataset.ctl, v),
    }[b.dataset.act] || (() => {}))();
  });
  // the age slider changes in place, so a drag is not cut short by a redraw
  $('#explore').addEventListener('input', ev => { if (ev.target.dataset.age !== undefined) setAge(+ev.target.value); });
  renderAll();
  $('#viewctl').innerHTML = `<div class="grp"><span>Turn</span><div class="seg" data-ctl="turn" role="group" aria-label="Turn">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]'), seg = b && b.closest('[data-ctl]');
    if (seg && seg.dataset.ctl === 'turn') setTurn(b.dataset.v);
  });
  showTab(X.tab);
}
//#use setTurn
function showTab(k) {
  X.tab = k;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === k));
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + k));
  updateExtraLabels();
}
// a tab picked by hand brings up the scene it talks about (a shared room's tab arriving does not: its scene comes with it)
function pickTab(k) {
  showTab(k);
  // (the Age tab's 3D is the cut-away ovary with its tags, each method's count on the poster's lines, as in the story)
  if (k === 'age' && !(X.scene === 'organ' && viewIs('organ', /cut/))) showView('organ', 'cut');
  if (k === 'methods' && !(X.scene === 'section' && viewIs('section', /tiles|forest|masks/))) setMethod(X.method);
  renderAll();
}
function renderAll() { renderObjects(); renderAge(); renderMethods(); renderScenes(); updateExtraLabels(); }
// a kind's numbers: annotated, the random forest's scores, SegFormer's IoU, its trend and the methods' agreement (as
// text: no charts in this story's explore mode)
function kindStats(key) {
  const k = KD[key], f1 = FACTS.f1[key], rows = [];
  if (k.annotated) rows.push(['Marked by hand', fmt(k.annotated), 'training labels']);
  if (k.rf) rows.push(['Random forest', `F1 ${sc2(k.rf.f1)}`, `precision ${sc2(k.rf.precision)} · recall ${sc2(k.rf.recall)}`]);
  rows.push(['SegFormer', `IoU ${sc2(k.iou)}`, key === 'cyst' ? 'hard: the masks mostly miss' : 'overlap of masks']);
  if (k.trend) rows.push(['With age', `r ${rT(k.trend.rf.r)} · ${rT(k.trend.seg.r)}`, `RF p ${pT(k.trend.rf.p)} · Seg p ${pT(k.trend.seg.p)}`]);
  if (k.compare) rows.push(['Methods agree', `r ${rT(k.compare.r)}`, `donor by donor · p ${pT(k.compare.p)}`]);
  const note = f1 && f1.printed !== f1.computed ? `F1 ${sc2(f1.printed)} as the poster prints it; its precision and recall give ${sc2(f1.computed)} (asked of the authors).` : '';
  return { rows, note };
}
function renderObjects() {
  const pane = $('#pane-objects');
  if (!pane) return;
  const k = X.kind;
  let h = `<p class="sub">The four kinds of object the poster counts, and cysts, which only the segmentation looks for. Pick one, or point at one on the section.</p>
    <div class="chips">${KINDS.map(q => chip(`data-act="kind" data-v="${q}"`, esc(Plural(q)), k === q, KCOL[q])).join('')}</div>`;
  if (k) {
    const st = kindStats(k);
    h += `<h3><span class="sw" style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${KCOL[k]};margin-right:8px"></span>${esc(Plural(k))}</h3>
      <p class="sub">${esc(KIND_TEXT[k])}</p>
      <dl class="stats">${st.rows.map(([t, v, s]) => `<dt>${t}</dt><dd>${esc(v)}<small>${esc(s)}</small></dd>`).join('')}</dl>
      ${st.note ? `<p class="note">${esc(st.note)}</p>` : ''}
      <p class="grp-h">Show it</p><div class="chips">${chip('data-act="view" data-v="section:section"', 'On the section', X.scene === 'section' && viewIs('section', /^section$/))}${hasOpt('organ', 'show', k) ? chip('data-act="view" data-v="organ:cut"', 'In the ovary', X.scene === 'organ') : ''}</div>`;
  } else h += `<p class="empty">${fmt(FACTS.annotated)} objects of the four kinds were marked by hand to train the methods.</p>`;
  pane.innerHTML = h;
}
// the counts on the poster's trend lines at the age (objects per section, rounded), in the order of its trend charts
const ageRows = () => CHART.map(q => [q, onLine(q, 'rf', X.age), onLine(q, 'seg', X.age)]);
function renderAge() {
  const pane = $('#pane-age');
  if (!pane) return;
  pane.innerHTML = `<p class="sub">Move the age: the ovary and the section follow the poster's trend lines (different donors at each age, not one ovary followed over time).</p>
    ${ageInput()}
    <p class="grp-h">On the poster's trend line at <b data-agev style="color:var(--ink)">${X.age}</b> (objects per section)</p>
    <dl class="stats" id="ageTab">${ageTable()}</dl>
    <p class="grp-h">Show it on</p><div class="chips">${chip('data-act="scene" data-v="organ"', 'The ovary', X.scene === 'organ')}${chip('data-act="scene" data-v="section"', 'The section', X.scene === 'section')}</div>
    <p class="note">The two methods count differently (random forest, segmentation); the lines are the poster's. The ovary and the section are drawn to follow them, not to scale.</p>`;
}
const ageTable = () => ageRows().map(([q, r, s]) => `<dt><span class="sw" style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${KCOL[q]};margin-right:6px"></span>${esc(Plural(q))}</dt><dd>${fmt(r)} · ${fmt(s)}<small>random forest · segmentation</small></dd>`).join('');
// the age's readouts, slider and counts, in place (a drag is not cut short)
function syncAge() {
  document.querySelectorAll('[data-agev]').forEach(el => { el.textContent = X.age; });
  document.querySelectorAll('input[data-age]').forEach(el => { if (document.activeElement !== el) el.value = X.age; });
  const t = $('#ageTab'); if (t) t.innerHTML = ageTable();
}
function renderMethods() {
  const pane = $('#pane-methods');
  if (!pane) return;
  const m = METHOD[X.method], rf = X.method === 'rf', kinds = rf ? KINDS4 : KINDS;
  pane.innerHTML = `<p class="sub">Two ways to find the objects on a section, and how well each does.</p>
    <div class="chips">${chip('data-act="method" data-v="rf"', '1 · Tiles and a random forest', rf)}${chip('data-act="method" data-v="seg"', '2 · SegFormer\'s masks', !rf)}</div>
    <h3>${esc(m.title)}</h3><p>${esc(m.steps.join(' → '))}.</p>
    <div class="chips">${rf ? chip('data-act="view" data-v="section:tiles"', 'Tiles and features', X.scene === 'section' && viewIs('section', /tiles/)) + chip('data-act="view" data-v="section:forest"', 'The vote', X.scene === 'section' && viewIs('section', /forest/))
      : chip('data-act="view" data-v="section:masks"', 'The masks', X.scene === 'section' && viewIs('section', /masks/))}</div>
    <dl class="stats">${kinds.map(q => `<dt><span class="sw" style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${KCOL[q]};margin-right:6px"></span>${esc(Plural(q))}</dt><dd>${rf ? `F1 ${sc2(KD[q].rf.f1)}<small>precision ${sc2(KD[q].rf.precision)} · recall ${sc2(KD[q].rf.recall)}</small>` : `IoU ${sc2(KD[q].iou)}`}</dd>`).join('')}</dl>
    <p class="note">${rf ? 'Precision: of the tiles called follicle, how many are one. Recall: of the follicles, how many were found. F1: the two in one number. 1 is perfect.'
      : `IoU: how far a predicted mask and the true one overlap (1 is perfect). Cysts, found only by the segmentation, score just ${sc2(KD.cyst.iou)}: hard.`}</p>`;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${ctlsOf(X.scene).filter(c => ctlShown(X.scene, c)).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    ${ageHere() ? ageInput() : ''}
    ${X.kind ? `<p class="sub" style="margin-top:10px">Also shown: ${esc(Plural(X.kind))} (Objects tab).</p>` : ''}`;
}
// the scene on show changes with the age (the slider belongs with it)
const ageHere = () => X.scene === 'organ' || X.scene === 'section';
// labels the panes add: the kind picked, at its place on the section or in the ovary
let XL = null;
function updateExtraLabels() {
  const sig = [APP.mode, X.scene, X.kind].join('|');
  if (sig === XL) return;
  XL = sig;
  LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); });
  LBL.extra = [];
  if (APP.mode !== 'explore' || !X.kind) return;
  const k = KD[X.kind], at = X.scene === 'section' || (X.scene === 'organ' && hasOpt('organ', 'show', X.kind)) ? X.kind : null;
  if (!at || !GL.sets[X.scene].anchors[at]) return;
  const txt = [Plural(X.kind), k.annotated ? `${fmt(k.annotated)} marked` : 'segmentation only'];
  LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(txt[0])}</b>${esc(txt[1])}`, 'cyn'), set: X.scene, at, o: -1, txt: [...txt, 'cyn'] });
}

//#use _rc
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { kind } (an object on the
// section), or null
function pickWith(rc) {
  if (APP.mode !== 'explore' || X.scene !== 'section') return null;
  const A = api('section');
  if (!A.pick || (XS.section_a || 0) < 0.5) return null;
  let r = -1;
  try { r = A.pick(rc); } catch (e) { return null; }
  const key = (A.kinds || KINDS)[r];
  return r >= 0 && KD[key] ? { kind: key } : null;
}
//#use pickAt
// where a pick is, in its set's own frame (for the headset's ray and tip): where the ray met the section (pickWith
// has just asked it), or null (then where the ray meets the scene)
const pickPos = p => (p && X.scene === 'section' && api('section').hitAt ? api('section').hitAt() : null);
const pickText = p => [cap(KD[p.kind].name), KD[p.kind].annotated ? `${fmt(KD[p.kind].annotated)} marked` : 'segmentation only'];
function choosePick(p) {
  if (!p) return;
  if (X.tab !== 'objects') showTab('objects');
  selectKind(p.kind === X.kind ? null : p.kind);
}
//#use bindCanvas