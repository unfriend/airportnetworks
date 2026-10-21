
// ================================================================ EXPLORE ==
// Explore mode: the paper's comparisons and networks, its organs, the poster's one-scan network with your own uptakes
// and the people on its index; or any scene with its own controls.
const SCENES = [
  ['scan', 'Scanner', 'A PET/CT scanner, cut open: the ring of detectors, the events (a positron, two gamma photons, a line of response) and the image they build. Life size stands it in front of you.'],
  ['body', 'Body', 'A whole-body PET scan: the tracer arriving with the blood, settling where cells use sugar and leaving in the urine (the PET body of the tour).'],
  ['organs', 'Organs', `The paper's organs in the scan: their outlines, their uptakes, the matrix of ${fmt(FACTS.scans)} scans, a partial correlation, the networks and how their strength is spread.`],
  ['people', 'One scan and people', 'The poster\'s next step: one network per scan, its two measures and the index; then the people on it, survival and the immunotherapy test. Illustrative maths; the dots are stand-ins.'],
  ['liver', 'Liver', 'An organ is a network too: an illustrative liver in a few thousand patches, linked where their uptakes differ by more than a threshold; the best connected glow.'],
];
const TABS = [['networks', 'Networks'], ['organs', 'Organs'], ['one', 'One scan'], ['people', 'People'], ['scenes', 'Scenes']];
// the tour's body set: its network and its disease scan are the tour's illustration, so this story leaves them out
const HIDE_CTL = { body: ['view', 'state'] };
const ctlsOf = k => (GL.sets[k].controls || []).filter(c => !(HIDE_CTL[k] || []).includes(c.key));
const S1 = PET_DATA.single, ONE_N = S1.organs.length;
const X = { tab: 'networks', scene: 'organs', ctl: {}, t0: 0, turn: 'on', cmp: -1, net: 'full', organ: null, profile: 'healthy', u: null, theta: S1.theta, group: 0, life: false };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['organs_focus', 'organs_pair', 'people_group']);
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
// a control's option whose key or name matches re (the sets name their own options)
const optKey = (k, key, re) => { const c = ctlOf(k, key), o = c && c.options.find(([v, n]) => re.test(v) || re.test(n)); return o ? o[0] : null; };
const setApi = k => (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null);
// a view option's camera: the cam view of the same name, or the one its name stands for
const CAM_ALIAS = { organs: { organs: 'default', uptake: 'bars', partial: 'scatter', network: 'net' }, scan: { scanner: 'default' },
  people: { 'one scan': 'one', ratios: 'field', people: 'map', index: 'strip', survival: 'km', immunotherapy: 'auc' } };
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {}, vc = ctlOf(k, 'view'), o = vc && vc.options.find(x => x[0] === v), n = o ? String(o[1]).toLowerCase() : '';
  for (const x of [v, al[v], n, al[n]]) if (x && c[x]) return x;
  return null;
}
const viewCam = k => { const c = ctlOf(k, 'view'); return c ? camFor(k, ctlValue(k, c)) : null; };
// the organs set's Network control and the people set's Profile control (found by key, or by their number of options)
const netCtl = () => ctlOf('organs', 'net') || ctlOf('organs', 'network') || ctlOf('organs', 'which') || ctlsOf('organs').find(c => c.key !== 'view' && c.options.length === NET_IDS.length) || null;
const profCtl = () => ctlOf('people', 'profile') || ctlsOf('people').find(c => c.key !== 'view' && c.options.length === PROFILES.length) || null;
// option <-> network id, option <-> profile key: by value when the set uses the ids, else by position
const netOfOpt = (c, v) => (NET_IDS.includes(v) ? v : NET_IDS[c.options.findIndex(o => o[0] === v)] || null);
const optOfNet = (c, id) => c.options.find(o => o[0] === id) || c.options[NET_IDS.indexOf(id)] || null;
const profOfOpt = (c, v) => (PROFILES.some(p => p[0] === v) ? v : (PROFILES[c.options.findIndex(o => o[0] === v)] || PROFILES[0])[0]);
const optOfProf = (c, p) => c.options.find(o => o[0] === p) || c.options[PROFILES.findIndex(x => x[0] === p)] || null;
// the network and the profile on show: the controls hold them (so the Scenes tab and the panes agree)
const curNet = () => { const c = netCtl(); return c ? netOfOpt(c, ctlValue('organs', c)) : X.net; };
const curProfile = () => { const c = profCtl(); return c ? profOfOpt(c, ctlValue('people', c)) : X.profile; };
// the people set's views: the one-scan network (and its ratios) or the population
const viewIs = (k, re) => { const c = ctlOf(k, 'view'); if (!c) return false; const v = ctlValue(k, c), o = c.options.find(x => x[0] === v); return re.test(v) || (o && re.test(o[1])); };
const oneView = () => viewIs('people', /one|ratio|field/i);
const netView = () => viewIs('organs', /net|strength/i);
// work for the next frame, once the sets have drawn what was just picked (their anchors follow their params)
const NEXT = [];
const afterUpdate = f => { NEXT.push(f); };
const round2 = v => Math.round(v * 100) / 100;
const profU = p => { const q = S1.profiles[p] || S1.profiles.healthy; return q.u.slice(); };
const curU = () => X.u || profU(curProfile());

// the one-scan network's maths (the people set's own when it has it; the same stand-in formulas otherwise):
// link i -> j = sigmoid((ln(u_i / u_j) - ln theta) / soft); Clearance = mean of the kidneys' outgoing links;
// Heterogeneity = Gini coefficient of the strengths; index = m + a C + b H, between 0 and 10
function measureOne(u, theta) {
  const A = setApi('people');
  if (A && A.measure) { try { const r = A.measure(u, theta); if (r && Number.isFinite(r.C) && Number.isFinite(r.H)) return r; } catch (e) { /* the engine's own copy below */ } }
  const N = u.length, lt = Math.log(theta), e = u.map(() => new Array(N).fill(0)), s = new Array(N).fill(0);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j) { e[i][j] = 1 / (1 + Math.exp(-(Math.log(u[i] / u[j]) - lt) / S1.soft)); s[i] += e[i][j]; s[j] += e[i][j]; }
  const k = S1.organs.indexOf('kidneys'), C = k < 0 ? 0 : e[k].reduce((a, v, j) => a + (j === k ? 0 : v), 0) / (N - 1);
  const m = s.reduce((a, v) => a + v, 0) / N;
  let g = 0;
  for (const a of s) for (const b of s) g += Math.abs(a - b);
  const H = m > 0 ? g / (2 * N * N * m) : 0;
  return { e, s, C, H, mdi: clamp(S1.proj.m + S1.proj.a * C + S1.proj.b * H, 0, 10) };
}
const linksOf = r => r.e.reduce((a, row) => a + row.filter(v => v > 0.5).length, 0);

// what the chosen scene and its controls ask for: that set fully in, every other set out; then what the panes pick
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  // the organs lie in the PET body: wherever they show, the body shows too, its tracer settled
  if (k === 'organs') Object.assign(tg, GL.sets.body.params, { body_a: 1, body_pet: 1 });
  tg[k + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = ctlValue(k, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  tg.body_net = 0; tg.body_state = 0;   // never the tour's own network or disease scan
  if (k === 'organs') {
    const w = NET_IDS.indexOf(curNet());
    if (w >= 0) tg.organs_which = w;
    tg.organs_focus = X.organ && PD.byId[X.organ] ? PD.byId[X.organ].i + 1 : 0;
    // the body dims under the network, the matrix and the scatter plot
    if ((tg.organs_net || 0) > 0.5 || (tg.organs_rows || 0) > 0.5 || (tg.organs_pair || 0) > 0.5) tg.body_a = 0.55;
  }
  if (k === 'people') {
    const p = curProfile(), u = curU();
    tg.people_profile = Math.max(0, PROFILES.findIndex(x => x[0] === p));
    tg.people_custom = X.u ? 1 : 0;
    for (let i = 0; i < ONE_N; i++) tg['people_u' + i] = u[i];
    tg.people_theta = X.theta;
    tg.people_group = X.group;
  }
  // life size: the scanner at work, the couch in, no vision row
  if (k === 'scan' && X.life) Object.assign(tg, { scan_vision: 0, scan_bed: 1, scan_events: Math.max(tg.scan_events || 0, 0.7), scan_lines: Math.max(tg.scan_lines || 0, 0.6) });
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
  // a gently swaying scene, unless you are steering it, standing by the scanner life size, or a set asks for stillness
  if (X.turn === 'on' && !(X.life && X.scene === 'scan') && !orbit.to && !orbit.held && !GL.still && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
// what the panes pick reaches the sets through their params (exploreTargets); here only the labels follow
function pushState() { updateExtraLabels(); }
function openScene(k, fly = true) {
  if (!GL.sets[k]) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (fly && !same) flyTo(view(k, X.life && k === 'scan' ? 'life' : viewCam(k) || 'default'));
  renderScenes();
  updateExtraLabels();
}
function setCtl(k, key, v) {
  const c = ctlOf(k, key);
  if (!c || !c.options.some(o => o[0] === v)) return;
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  if (c === profCtl()) X.u = null;   // a profile picked: its own uptakes
  // a view has its own best camera
  if (key === 'view' && k === X.scene && !(X.life && k === 'scan')) { const n = camFor(k, v); flyTo(view(k, n || 'default')); }
  renderAll();
}
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
function flyNear(p, d) { if (p && !(X.life && X.scene === 'scan')) flyTo([orbit.cur[0], orbit.cur[1], d, p[0], p[1], p[2]]); }

// --------------------------------------------------------------- actions --
// Each setter changes its own field only when called with ui false (a shared room's state arriving); picked by
// hand (ui true) it also brings up the scene and the view that show it.
// a comparison of Table 2 (-1 none): its first network, when the paper drew one
function selectCmp(i, ui = true) {
  X.cmp = i;
  if (ui && i >= 0) { const id = rowNets(PD.D.table2[i]).find(n => n && NET_IDS.includes(n)); if (id) showNet(id); }
  renderNets();
}
// the network on show in the organs set
function setNet(id) {
  if (!NET_IDS.includes(id)) return;
  const c = netCtl();
  if (c) { const o = optOfNet(c, id); if (o) (X.ctl.organs = X.ctl.organs || {})[c.key] = o[0]; } else X.net = id;
  X.t0 = performance.now();
  renderNets(); renderOrgans(); renderScenes();
}
function showNet(id) {
  setNet(id);
  if (X.scene !== 'organs') openScene('organs');
  if (!netView()) { const v = optKey('organs', 'view', /strength/i) || optKey('organs', 'view', /net/i); if (v) setCtl('organs', 'view', v); }
}
// an organ (null none): it glows in the organs set, its bar and links brighter
function selectOrgan(id, ui = true) {
  X.organ = id && PD.byId[id] ? id : null;
  if (ui && X.organ && X.scene !== 'organs') openScene('organs');
  if (ui && X.organ && X.scene === 'organs' && !viewIs('organs', /net|strength|matrix|partial|scatter/i)) afterUpdate(() => { if (X.organ === id) flyNear(anchorOf('organs', id), Math.min(orbit.cur[2], 2.6)); });
  pushState(); renderOrgans(); renderNets();
}
// a profile of the one-scan network (its uptakes; custom ones are dropped)
function selectProfile(p, ui = true) {
  if (!PROFILES.some(x => x[0] === p)) return;
  const c = profCtl();
  if (c) { const o = optOfProf(c, p); if (o) (X.ctl.people = X.ctl.people || {})[c.key] = o[0]; } else X.profile = p;
  X.u = null;
  if (ui) showOne();
  renderOne(); renderScenes();
}
function showOne() {
  if (X.scene !== 'people') openScene('people');
  if (!oneView()) { const v = optKey('people', 'view', /one/i); if (v) setCtl('people', 'view', v); }
}
// the seven uptakes (null: the profile's own); one moved by hand makes them custom
function setUs(u) { X.u = u ? u.map(v => round2(clamp(+v, 0.1, 5))) : null; syncOne(); }
function setU(i, v) { const u = curU(); u[i] = v; setUs(u); }
function setTheta(v) { X.theta = round2(clamp(+v, 1.1, 3)); syncOne(); }
// a group of the poster's population (0 none, 1..4): it glows, the others dim
function selectGroup(g, ui = true) {
  X.group = clamp(g | 0, 0, 4);
  if (ui && X.group) { if (X.scene !== 'people') openScene('people'); if (oneView()) { const v = optKey('people', 'view', /index|strip/i) || optKey('people', 'view', /people|map/i); if (v) setCtl('people', 'view', v); } }
  renderPeople();
}
// a view of the people set (People, Index, Survival, Immunotherapy)
function showPeople(re) { if (X.scene !== 'people') openScene('people'); const v = optKey('people', 'view', re); if (v) setCtl('people', 'view', v); }
// Life size: on screen the scanner from a couple of metres at eye height; in the headset life size on your floor
function setLife(on) {
  X.life = on;
  if (XR.on) xrRoom(on);
  if (on && X.scene !== 'scan') openScene('scan', false);
  if (X.scene === 'scan') flyTo(view('scan', on ? 'life' : viewCam('scan') || 'default'));
  document.querySelectorAll('[data-ctl="life"] button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === (on ? 'on' : 'off'))));
  renderScenes();
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls (they hold the
// network and the profile on show), the comparison, the organ, the custom uptakes, the threshold and the group.
// Turning and standing by the scanner life size are each person's own view.
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
  return { tab: X.tab, scene: X.scene, ctl, cmp: X.cmp, net: curNet(), organ: X.organ, profile: curProfile(), u: X.u ? X.u.slice() : null, theta: X.theta, group: X.group };
}
// show another person's state with the story's own setters (so both panels follow); every field is checked, and
// the camera stays where this person has it
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  const int = (n, lo, hi) => Number.isInteger(n) && n >= lo && n < hi;
  if (TABS.some(t => t[0] === v.tab) && v.tab !== X.tab) showTab(v.tab);
  if ((v.cmp === -1 || int(v.cmp, 0, PD.D.table2.length)) && v.cmp !== X.cmp) selectCmp(v.cmp, false);
  if ((v.organ === null || (typeof v.organ === 'string' && PD.byId[v.organ])) && v.organ !== X.organ) selectOrgan(v.organ, false);
  if (Number.isFinite(v.theta) && v.theta !== X.theta) setTheta(v.theta);
  if (int(v.group, 0, 5) && v.group !== X.group) selectGroup(v.group, false);
  // the scene and its controls; a view flies to its own camera as it does here
  if (SCENES.some(s => s[0] === v.scene) && v.scene !== X.scene) openScene(v.scene);
  for (const [k] of SCENES) for (const c of ctlsOf(k)) {
    const x = v.ctl && v.ctl[k] && v.ctl[k][c.key];
    if (!c.options.some(o => o[0] === x) || ctlValue(k, c) === x) continue;
    if (k === X.scene) setCtl(k, c.key, x); else (X.ctl[k] = X.ctl[k] || {})[c.key] = x;
  }
  // then the network and the profile (also held by controls: should the two ever disagree, these win) and the custom
  // uptakes (a profile arriving drops them, as it does here: the room's own come back after it)
  if (NET_IDS.includes(v.net) && v.net !== curNet()) setNet(v.net);
  if (PROFILES.some(p => p[0] === v.profile) && v.profile !== curProfile()) selectProfile(v.profile, false);
  if ((v.u === null || (Array.isArray(v.u) && v.u.length === ONE_N && v.u.every(Number.isFinite))) && JSON.stringify(v.u) !== JSON.stringify(X.u)) setUs(v.u);
  renderAll();
}

// ------------------------------------------------------------------ panes --
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:#04131c"' : ''}>${col ? `<span class="sw" style="background:${col}"></span>` : ''}${label}</button>`;
// the organ icons (PET_ICONS) as small pictures for the HTML panes, in the organ's colour
const ICON = {};
function iconUrl(id) {
  if (ICON[id] === undefined) {
    try {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 48;
      PET_ICONS.draw(cv.getContext('2d'), id, 24, 24, 44, { color: organCol(id), width: 2.6 });
      ICON[id] = cv.toDataURL();
    } catch (e) { ICON[id] = ''; }
  }
  return ICON[id];
}
const iconImg = (id, px) => (iconUrl(id) ? `<img src="${iconUrl(id)}" alt="" width="${px || 18}" height="${px || 18}" style="vertical-align:-4px;margin-right:5px">` : '');
// a network in words: organs, links, density and disorder (as printed), hubs (printed, or computed from its links)
function netInfo(id) {
  const n = netOf(id), e = edgesOf(id), h = hubsOf(id).filter(x => x !== 'aorta');
  if (!n) return { ok: false, text: 'This network is not in the data yet.' };
  const d = Number.isFinite(+n.density) ? `density ${pct(n.density)}` : '', o = Number.isFinite(+n.disorder) ? `disorder ${dis(n.disorder)}` : '';
  return { ok: e.length > 0, n, e, hubs: h,
    text: e.length ? `${(n.organs || []).length} organs, ${e.length} links${d || o ? `; ${[d, o].filter(Boolean).join(', ')} as printed` : ''}.` : 'Its links are not read off the figure yet: only its organs show.',
    hubText: e.length ? (h.length ? `Hubs: ${listOf(h.map(organLow))}${hubsPrinted(id) ? ' (marked in the paper)' : ` (computed: strength z-score above ${FACTS.hubZ})`}.` : 'No hub: the strength is spread evenly.') : '' };
}
// a network's strength per organ, sorted from high to low (as printed in the data, else summed from its links)
function strengths(id) {
  const n = netOf(id);
  if (!n) return [];
  let s = n.computed && n.computed.strength;
  if (!s) { s = {}; for (const [a, b, w] of edgesOf(id)) { s[a] = (s[a] || 0) + Math.abs(w); s[b] = (s[b] || 0) + Math.abs(w); } }
  return Object.entries(s).filter(([k]) => PD.byId[k]).sort((a, b) => b[1] - a[1]);
}
const sigWord = (sig, p) => `${esc(p)}${sig ? ' (significant)' : ' (no significant difference)'}`;
const rowName = r => `${r.what} · ${r.cohort.replace(/, split at the median.*$/, '').replace(/^full cohort$/, 'all scans')}`;
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    <div class="pane" id="pane-networks" role="tabpanel"></div>
    <div class="pane" id="pane-organs" role="tabpanel"></div>
    <div class="pane" id="pane-one" role="tabpanel"></div>
    <div class="pane" id="pane-people" role="tabpanel"></div>
    <div class="pane" id="pane-scenes" role="tabpanel"></div>`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => pickTab(b.dataset.tab)));
  // one click handler per pane: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v, n = v !== undefined && v !== '' && !isNaN(+v) ? +v : v;
    ({
      cmp: () => selectCmp(n === X.cmp ? -1 : n), net: () => showNet(v), organ: () => selectOrgan(v === X.organ ? null : v),
      profile: () => selectProfile(v), group: () => selectGroup(n === X.group ? 0 : n), pview: () => showPeople(new RegExp('^' + v + '$', 'i')),
      one: showOne, scene: () => openScene(v), ctl: () => setCtl(b.dataset.scene || X.scene, b.dataset.ctl, v), life: () => setLife(!X.life),
    }[b.dataset.act] || (() => {}))();
  });
  // the sliders of the one-scan network: values change in place, so a drag is not cut short by a redraw
  $('#explore').addEventListener('input', ev => {
    const el = ev.target;
    if (el.dataset.u !== undefined) { setU(+el.dataset.u, +el.value); if (X.scene !== 'people' || !oneView()) showOne(); }
    else if (el.id === 'theta') { setTheta(+el.value); if (X.scene !== 'people' || !oneView()) showOne(); }
  });
  renderAll();
  $('#viewctl').innerHTML = `<div class="grp"><span>Turn</span><div class="seg" data-ctl="turn" role="group" aria-label="Turn">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>
    <div class="grp"><span>Life size</span><div class="seg" data-ctl="life" role="group" aria-label="The scanner life size">${[['off', 'Off'], ['on', 'On']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${(X.life ? 'on' : 'off') === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]'), seg = b && b.closest('[data-ctl]');
    if (!seg) return;
    if (seg.dataset.ctl === 'turn') setTurn(b.dataset.v); else setLife(b.dataset.v === 'on');
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
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + k));
  updateExtraLabels();
}
// a tab picked by hand brings up the scene it talks about (a shared room's tab arriving does not: its scene comes with it)
function pickTab(k) {
  showTab(k);
  if (k === 'networks' && (X.scene !== 'organs' || !netView())) showNet(curNet());
  if (k === 'organs' && X.scene !== 'organs') openScene('organs');
  if (k === 'one') showOne();
  if (k === 'people' && (X.scene !== 'people' || oneView())) showPeople(/^index$/i);
}
function renderAll() { renderNets(); renderOrgans(); renderOne(); renderPeople(); renderScenes(); }
function renderNets() {
  const pane = $('#pane-networks');
  if (!pane) return;
  const T = PD.D.table2, r = T[X.cmp], id = curNet(), ni = netInfo(id);
  const rows = part => T.map((x, i) => [x, i]).filter(([x]) => x.part === part).map(([x, i]) => chip(`data-act="cmp" data-v="${i}"`, esc(rowName(x)), X.cmp === i, x.sigD || x.sigO ? '#ffb43b' : null)).join('');
  let h = `<p class="sub">The paper compared the networks of groups of scans (Table 2; amber: a significant difference). Pick a comparison.</p>
    <p class="grp-h">From health to disease</p><div class="chips">${rows('health')}</div>
    <p class="grp-h">Is it robust?</p><div class="chips">${rows('test')}</div>`;
  if (r) {
    const nets = rowNets(r);
    h += `<h3>${esc(r.what)}</h3><p class="sub">${esc(r.cohort)}</p>
      <dl class="stats">${r.groups.map((g, i) => `<dt>${esc(g.label)}</dt><dd>${pct(g.density)}<small>density · disorder ${dis(g.disorder)} · ${g.n} scans${nets[i] && NET_IDS.includes(nets[i]) ? ` · <button type="button" data-act="net" data-v="${nets[i]}" style="border:0;background:none;padding:0;font:inherit;color:var(--cyan);text-decoration:underline;cursor:pointer">show its network</button>` : ''}</small></dd>`).join('')}</dl>
      <p class="sub">Density: ${sigWord(r.sigD, r.pD)}. Disorder: ${sigWord(r.sigO, r.pO)}.</p>`;
  }
  h += `<p class="grp-h">Networks drawn in the paper</p><div class="chips">${NET_IDS.map((n, i) => chip(`data-act="net" data-v="${n}"`, esc(NET_SHORT[i]) + (hasNet(n) ? '' : ' <small>(not read yet)</small>'), n === id && X.scene === 'organs')).join('')}</div>
    <h3 style="font-size:20px">${esc(netShort(id))}</h3><p class="sub">${esc((netOf(id) || {}).title || '')}. ${esc(ni.text)} ${esc(ni.hubText || '')}</p>`;
  const st = strengths(id);
  if (ni.ok && st.length) {
    const mx = st[0][1] || 1;
    h += `<p class="grp-h">Strength of each organ: the sum of its links' weights</p><div class="bars">${st.map(([o, v]) => `<div class="bar${(ni.hubs || []).includes(o) ? ' hl' : ''}"><span class="v">${v.toFixed(1)}</span><div class="fill" style="height:${(100 * v / mx).toFixed(0)}%;background:${organCol(o)}"></div><span class="k">${esc(PD.byId[o].short.slice(0, 5))}</span></div>`).join('')}</div>`;
  }
  h += `<p class="grp-h">Protein networks (Table 3: tissues of ${fmt(FACTS.gtex)} people)</p>
    <dl class="stats">${PD.D.table3.filter(x => x.kind !== 'fdg').map(x => `<dt>${esc(x.name.replace(/ \(.*\)$/, ''))}</dt><dd>${pct(x.density)}<small>${x.r !== null ? `r = ${x.r} with FDG's · ` : ''}${esc(x.similar)}</small></dd>`).join('')}</dl>
    <div class="chips">${PD.D.table3.filter(PROT_NET).map(x => chip(`data-act="net" data-v="${PROT_NET(x)}"`, `${esc(netShort(PROT_NET(x)))} network`, PROT_NET(x) === id && X.scene === 'organs')).join('')}</div>`;
  pane.innerHTML = h;
}
function renderOrgans() {
  const pane = $('#pane-organs');
  if (!pane) return;
  const id = X.organ, O = PD.byId[id];
  let h = `<p class="sub">The ${FACTS.organs} organs of the paper and the aorta, the reference every organ is divided by. Pick one.</p>
    <div class="chips">${PD.D.organs.map(o => chip(`data-act="organ" data-v="${o.id}"`, iconImg(o.id) + esc(o.name), id === o.id)).join('')}</div>`;
  if (O) {
    const inF2 = PD.D.f2.organs.includes(id), e = edgesOf('full').filter(x => x[0] === id || x[1] === id).sort((a, b) => Math.abs(b[2]) - Math.abs(a[2]));
    const hubIn = NET_IDS.filter(n => hasNet(n) && hubsOf(n).includes(id));
    h += `<h3>${iconImg(id, 26)}${esc(O.name)}</h3>
      <dl class="stats"><dt>Measured</dt><dd style="font-size:15px">${esc(O.measure)}</dd>
      <dt>Typical uptake</dt><dd>${id === 'aorta' ? '1' : O.suv}<small>${id === 'aorta' ? 'the unit' : 'times the aorta\'s'} (illustrative)</small></dd>
      ${inF2 && strengths('full').length ? `<dt>Strength</dt><dd>${(strengths('full').find(s => s[0] === id) || [0, 0])[1].toFixed(2)}<small>in the network of all ${fmt(FACTS.scans)} scans</small></dd>` : ''}
      <dt>Hub in</dt><dd style="font-size:15px">${hubIn.length ? esc(listOf(hubIn.map(netShort))) : 'no network drawn so far'}</dd></dl>`;
    h += inF2 ? `<p class="grp-h">Its links in the network of all ${fmt(FACTS.scans)} scans (Figure 2A; blue together, red opposite)</p>
      <div class="chips">${e.length ? e.map(x => { const o = x[0] === id ? x[1] : x[0]; return `<button type="button" data-act="organ" data-v="${o}">${iconImg(o)}${esc(organName(o))} <b style="color:${x[2] > 0 ? '#4c7cff' : '#ff4d4d'}">${x[2] > 0 ? '+' : '−'}${Math.abs(x[2]).toFixed(2)}</b></button>`; }).join('') : '<span class="empty">none</span>'}</div>`
      : `<p class="sub">${id === 'aorta' ? 'Not a node: the blood pool every organ is divided by.' : `Not in the network of all scans (Figure 2A has ${FACTS.f2n} organs); it appears in the networks of Figure 3.`}</p>`;
  } else h += `<p class="empty">Colours and icons are the same in every scene. Point at an organ in the scan, a bar or a node to pick it there.</p>`;
  pane.innerHTML = h;
}
// the one-scan pane: built once per profile or custom change of structure; values change in place (syncOne)
function renderOne() {
  const pane = $('#pane-one');
  if (!pane) return;
  const u = curU(), p = curProfile();
  pane.innerHTML = `<p class="sub">The poster's next step: one network per scan, from ${word(ONE_N)} organs' uptakes (mean SUV). Pick a profile, or move the uptakes yourself.</p>
    <div class="chips" id="oneProf">${PROFILES.map(([k, n]) => chip(`data-act="profile" data-v="${k}"`, esc(n), !X.u && p === k, GROUP_COL[k])).join('')}${X.u ? chip('data-act="one"', 'Custom', true) : ''}</div>
    ${S1.organs.map((o, i) => `<p class="grp-h">${iconImg(o, 16)}${esc(organName(o))} <b data-uv="${i}" style="margin-left:auto;color:var(--ink)">${u[i].toFixed(2)}</b></p><input type="range" data-u="${i}" min="0.1" max="5" step="0.05" value="${u[i]}" style="accent-color:${organCol(o)}" aria-label="Uptake of the ${esc(organLow(o))}">`).join('')}
    <p class="grp-h">Threshold: one organ outshines another by <b id="thv" style="margin-left:auto;color:var(--ink)">${X.theta.toFixed(2)}</b></p><input type="range" id="theta" min="1.1" max="3" step="0.05" value="${X.theta}" aria-label="Threshold">
    <dl class="stats" id="oneOut" style="margin-top:14px"></dl>
    <p class="note">${esc(S1.note)} The profiles are illustrative too.</p>`;
  syncOne(true);
}
function syncOne(fresh) {
  const pane = $('#pane-one');
  if (!pane || !$('#oneOut')) return;
  // a switch between a profile and custom uptakes changes the chips: draw the pane again
  if (!fresh && !!pane.querySelector('#oneProf [data-act="one"]') !== !!X.u) { renderOne(); return; }
  const u = curU(), r = measureOne(u, X.theta);
  pane.querySelectorAll('input[data-u]').forEach(el => { const i = +el.dataset.u; if (document.activeElement !== el) el.value = u[i]; });
  pane.querySelectorAll('[data-uv]').forEach(el => { el.textContent = u[+el.dataset.uv].toFixed(2); });
  const th = $('#theta'); if (th && document.activeElement !== th) th.value = X.theta;
  $('#thv').textContent = X.theta.toFixed(2);
  $('#oneOut').innerHTML = `<dt>Links</dt><dd>${linksOf(r)}<small>of ${ONE_N * (ONE_N - 1)} possible</small></dd>
    <dt>Clearance</dt><dd>${r.C.toFixed(2)}<small>the kidneys' links out</small></dd>
    <dt>Heterogeneity</dt><dd>${r.H.toFixed(2)}<small>0 even, higher: one organ dominates</small></dd>
    <dt>Index</dt><dd style="color:var(--amber)">${r.mdi.toFixed(1)}<small>metabolic displacement, 0 to 10</small></dd>`;
}
function renderPeople() {
  const pane = $('#pane-people');
  if (!pane) return;
  const P = POSTER, g = P.groups[X.group - 1];
  const views = [['people', 'People'], ['index', 'Index'], ['survival', 'Survival'], ['immunotherapy', 'Immunotherapy']].filter(([k]) => optKey('people', 'view', new RegExp('^' + k + '$', 'i')));
  let h = `<p class="sub">The poster's results: ${P.mdiN ? `${fmt(P.mdiN)} people` : 'people'} by their index. Pick a group.</p>
    <div class="chips">${P.groups.map((x, i) => chip(`data-act="group" data-v="${i + 1}"`, `${esc(x.name)} <small>${x.n}</small>`, X.group === i + 1, x.col)).join('')}</div>`;
  if (g) h += `<h3><span class="sw" style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${g.col};margin-right:8px"></span>${esc(g.name)}</h3>
    <dl class="stats"><dt>People</dt><dd>${g.n}</dd><dt>Index</dt><dd>${g.centre}<small>${Array.isArray(g.err) ? `the poster's bar: ${g.err[0]} to ${g.err[1]}` : ''}</small></dd></dl>`;
  if (views.length) h += `<p class="grp-h">View</p><div class="chips">${views.map(([k, n]) => chip(`data-act="pview" data-v="${k}"`, n, X.scene === 'people' && viewIs('people', new RegExp('^' + k + '$', 'i')))).join('')}</div>`;
  if (P.thirds.length) h += `<p class="grp-h">Survival with cancer, by the index's thirds</p>
    <dl class="stats">${P.thirds.map(t => `<dt><span class="sw" style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${t.col};margin-right:6px"></span>${esc(t.name)}${t.n ? ` (${t.n})` : ''}</dt><dd>${t.median === undefined ? '–' : t.median === null ? 'not reached' : t.median + ' months'}<small>median${t.y1 !== null ? ` · ${t.y1}% after one year` : ''}</small></dd>`).join('')}</dl>`;
  if (P.auc.length) h += `<p class="grp-h">The immunotherapy test${P.respN ? ` (${P.respN} people with lung cancer)` : ''}: good from poor responders</p>
    <dl class="stats">${P.auc.slice().sort((a, b) => b.auc - a.auc).map(a => `<dt>${esc(a.name)}</dt><dd style="color:${a.net ? 'var(--amber)' : 'var(--muted)'}">${a.auc}<small>AUC${a.p ? ' · ' + esc(a.p) : ''}${a.net ? ' · network measure' : ''}</small></dd>`).join('')}</dl>
    <p class="sub">0.5 is chance. A first test, in few people.</p>`;
  h += `<p class="note">Group summaries from the poster. The dots are stand-ins drawn to match them, not patients.</p>`;
  pane.innerHTML = h;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${ctlsOf(X.scene).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    ${X.scene === 'scan' ? `<div class="actions">${chip('data-act="life"', 'Life size', X.life)}</div>` : ''}
    ${X.scene === 'organs' && X.organ ? `<p class="sub" style="margin-top:10px">Also shown: ${esc(organName(X.organ))} (Organs tab).</p>` : ''}`;
}
// labels the panes add (the sets label their own picks)
function updateExtraLabels() {
  LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); });
  LBL.extra = [];
  const s = GL.sets[X.scene], id = X.organ;
  if (X.scene === 'organs' && id && s.anchors[id] && !(s.labels || []).some(L => L.at === id)) {
    LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(organName(id))}</b>`, 'cyn'), set: 'organs', at: id, o: -1, txt: [organName(id), '', 'cyn'] });
  }
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { organ } or { group }, or null
function pickWith(rc) {
  if (APP.mode !== 'explore' || !(X.scene === 'organs' || X.scene === 'people')) return null;
  const A = setApi(X.scene);
  if (!A || !A.pick) return null;
  const r = A.pick(rc);
  if (typeof r === 'string') return PD.byId[r] ? { organ: r } : null;
  if (r && r.organ && PD.byId[r.organ]) return { organ: r.organ };
  return r && r.group >= 1 && r.group <= POSTER.groups.length ? { group: r.group } : null;
}
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
// where a pick is, in its set's own frame (for the headset's ray and tip), or null
function pickPos(p) {
  if (!p) return null;
  const s = GL.sets[X.scene], at = p.organ ? p.organ : 'g' + p.group;
  if (!s.anchors || !s.anchors[at]) return null;
  const q = anchorOf(X.scene, at);
  return q && Number.isFinite(q[0]) ? [q[0], q[1], q[2]] : null;
}
const pickText = p => (p.organ ? [organName(p.organ), p.organ === 'aorta' ? 'the reference' : PD.byId[p.organ].measure]
  : [POSTER.groups[p.group - 1].name, `${POSTER.groups[p.group - 1].n} people, index ${POSTER.groups[p.group - 1].centre}`]);
function choosePick(p) {
  if (!p) return;
  if (p.organ && X.scene === 'organs') { if (X.tab !== 'organs' && X.tab !== 'networks') showTab('organs'); selectOrgan(p.organ === X.organ ? null : p.organ, false); }
  else if (p.organ) showTab('one');   // an organ of the one-scan network: its slider
  else { showTab('people'); selectGroup(p.group === X.group ? 0 : p.group, false); }
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
    cv.style.cursor = p ? 'pointer' : 'grab';
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
