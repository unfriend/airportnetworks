
// ================================================================ EXPLORE ==
// Explore mode: the paper's comparisons and networks, its organs; or any scene with its own controls (the liver, an
// organ as a network of patches, only here).
const SCENES = [
  ['scan', 'Scanner', 'A PET/CT scanner, cut open: the ring of detectors, the events (a positron, two gamma photons, a line of response) and the image they build. Life size stands it in front of you.'],
  ['body', 'Body', 'A whole-body PET scan: the tracer arriving with the blood, settling where cells use sugar and leaving in the urine (the PET body of the tour).'],
  ['organs', 'Organs', `The paper's organs in the scan: their outlines, their uptakes, the matrix of ${fmt(FACTS.scans)} scans (stand-in values), a partial correlation and the networks.`],
  ['liver', 'Liver', 'An organ is a network too: a liver in a few thousand patches, linked where one patch\'s uptake is more than a set number of times another\'s (a rule like the poster\'s, applied here to patches of one organ, as an illustration); the best connected glow.'],
];
const TABS = [['networks', 'Networks'], ['organs', 'Organs'], ['scenes', 'Scenes']];
// the tour's body set: its network and its disease scan are the tour's illustration, so this story leaves them out
const HIDE_CTL = { body: ['view', 'state'] };
const ctlsOf = k => (GL.sets[k].controls || []).filter(c => !(HIDE_CTL[k] || []).includes(c.key));
// a control the panes offer now: a set may say when one applies (when(values)), so none sits there doing nothing; the
// shared state keeps every control (ctlsOf) all the same
const ctlShown = (k, c) => !c.when || c.when(Object.fromEntries(ctlsOf(k).map(x => [x.key, ctlValue(k, x)])));
const X = { tab: 'networks', scene: 'organs', ctl: {}, t0: 0, turn: 'on', cmp: -1, netX: null, organ: null, life: false };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between; the
// organs' network and its crossfade (organs_prev to organs_which by organs_mix) and the explainer's pair change smoothly
// in the set's own time (explore(c)), so they pass unchanged
const STEP = new Set(['organs_focus', 'organs_pair', 'organs_which', 'organs_prev', 'organs_mix']);
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
// a control's option whose key or name matches re (the sets name their own options)
const optKey = (k, key, re) => { const c = ctlOf(k, key), o = c && c.options.find(([v, n]) => re.test(v) || re.test(n)); return o ? o[0] : null; };
const setApi = k => (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null);
// a view option's camera: the cam view of the same name, or the one its name stands for
const CAM_ALIAS = { organs: { organs: 'default', uptake: 'bars', partial: 'scatter', network: 'net' }, scan: { scanner: 'default' } };
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {}, vc = ctlOf(k, 'view'), o = vc && vc.options.find(x => x[0] === v), n = o ? String(o[1]).toLowerCase() : '';
  for (const x of [al[v], v, al[n], n]) if (x && c[x]) return x;
  return null;
}
const viewCam = k => { const c = ctlOf(k, 'view'); return c ? camFor(k, ctlValue(k, c)) : null; };
// the network on show: the organs set's Network control holds it (its options are the ids), so the Scenes tab and the
// panes agree; a robustness test's network, which that control does not offer, is X.netX
const curNet = () => X.netX || ctlValue('organs', ctlOf('organs', 'network'));
// whether a set's view on show matches re (by its key or its name)
const viewIs = (k, re) => { const c = ctlOf(k, 'view'); if (!c) return false; const v = ctlValue(k, c), o = c.options.find(x => x[0] === v); return re.test(v) || (o && re.test(o[1])); };
const netView = () => viewIs('organs', /net/i);
// work for the next frame, once the sets have drawn what was just picked (their anchors follow their params)
const NEXT = [];
const afterUpdate = f => { NEXT.push(f); };

// what the chosen scene and its controls ask for: that set fully in, every other set out; then what the panes pick
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  // the organs lie in the PET body: wherever they show, the body shows too, its tracer settled
  if (k === 'organs') Object.assign(tg, GL.sets.body.params, { body_a: 1, body_pet: 1 });
  tg[k + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = ctlValue(k, ct);
  if (k === 'organs') c.network = curNet();   // (a robustness test's network too: the set crossfades to it from the one before)
  if (s.explore) Object.assign(tg, s.explore(c));
  tg.body_net = 0; tg.body_state = 0;   // never the tour's own network or disease scan
  // (a comparison with no network of its own: the network last shown dims, with the set's labels, and its measures go)
  if (k === 'organs' && noNet()) { tg.organs_a = 0.5; tg.organs_measures = 0; }
  if (k === 'organs') {
    tg.organs_focus = X.organ && PD.byId[X.organ] ? PD.byId[X.organ].i + 1 : 0;
    // the body dims under the network, the matrix and the scatter plot
    if ((tg.organs_net || 0) > 0.5 || (tg.organs_rows || 0) > 0.5 || (tg.organs_pair || 0) > 0.5) tg.body_a = 0.55;
  }
  // life size: the scanner at work, the couch in, no vision row
  if (k === 'scan' && X.life) Object.assign(tg, { scan_vision: 0, scan_bed: 1, scan_events: Math.max(tg.scan_events || 0, 0.7), scan_lines: Math.max(tg.scan_lines || 0, 0.6) });
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  sfxScanner();
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
  if (!same) sfxAct('whoosh', k, null, { dur: 1.2 });   // (sound effects: another scene)
  if (X.life && k !== 'scan') setLife(false);   // (life size is the scanner's)
  if (fly && !same) flyTo(view(k, X.life && k === 'scan' ? 'life' : viewCam(k) || 'default'));
  lifeCtl();
  renderScenes(); renderNets(); updateExtraLabels();
}
function setCtl(k, key, v) {
  const c = ctlOf(k, key);
  if (!c || !c.options.some(o => o[0] === v)) return;
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  if (k === 'organs' && key === 'network') X.netX = null;   // a network of the control's own
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
  if (ui && i >= 0) { const id = rowNets(PD.D.table2[i]).find(n => n && NET_ALL.includes(n)); if (id) showNet(id); }
  renderNets();
}
// the network on show in the organs set: one of its Network control's, or a robustness test's (X.netX)
function setNet(id) {
  if (!NET_ALL.includes(id)) return;
  if (id !== curNet()) sfxAct('grow', 'organs', 'net', { dur: 1.2, gain: 0.5 });   // (sound effects: another network)
  if (NET_IDS.includes(id)) { (X.ctl.organs = X.ctl.organs || {}).network = id; X.netX = null; } else X.netX = id;
  X.t0 = performance.now();
  renderNets(); renderOrgans(); renderScenes();
}
// a network picked by hand (its chip, a link): the comparison it belongs to comes with it
function pickNet(id) { if (!NET_ALL.includes(id)) return; X.cmp = cmpOfNet(id); showNet(id); }
function showNet(id) {
  setNet(id);
  if (X.scene !== 'organs') openScene('organs');
  if (!netView()) { const v = optKey('organs', 'view', /net/i); if (v) setCtl('organs', 'view', v); }
}
// an organ (null none): it glows in the organs set, its bar and links brighter
function selectOrgan(id, ui = true) {
  X.organ = id && PD.byId[id] ? id : null;
  if (ui && X.organ) sfxAct('pick', 'organs', X.organ);   // (sound effects: an organ picked)
  if (ui && X.organ && X.scene !== 'organs') openScene('organs');
  if (ui && X.organ && X.scene === 'organs' && !viewIs('organs', /net|matrix|partial|scatter/i)) afterUpdate(() => { if (X.organ === id) flyNear(anchorOf('organs', id), Math.min(orbit.cur[2], 2.6)); });
  pushState(); renderOrgans(); renderNets();
}
// Life size: on screen the scanner from a couple of metres at eye height; in the headset life size on your floor
function setLife(on) {
  if (on && !X.life) sfxAct('rise', 'scan', 'ring', { dur: 1.5 });   // (sound effects: the scanner life size round you)
  X.life = on;
  if (XR.on) xrRoom(on);
  if (on && X.scene !== 'scan') openScene('scan', false);
  if (on) showTab('scenes');   // (the Scenes tab holds the scanner's controls and the Life size button)
  if (X.scene === 'scan') flyTo(view('scan', on ? 'life' : viewCam('scan') || 'default'));
  document.querySelectorAll('[data-ctl="life"] button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === (on ? 'on' : 'off'))));
  renderScenes();
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls (they hold the
// network on show), the comparison and the organ.
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
  return { tab: X.tab, scene: X.scene, ctl, cmp: X.cmp, net: curNet(), organ: X.organ };
}
// show another person's state with the story's own setters (so both panels follow); every field is checked, and
// the camera stays where this person has it
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  const int = (n, lo, hi) => Number.isInteger(n) && n >= lo && n < hi;
  if (TABS.some(t => t[0] === v.tab) && v.tab !== X.tab) showTab(v.tab);
  if ((v.cmp === -1 || int(v.cmp, 0, PD.D.table2.length)) && v.cmp !== X.cmp) selectCmp(v.cmp, false);
  if ((v.organ === null || (typeof v.organ === 'string' && PD.byId[v.organ])) && v.organ !== X.organ) selectOrgan(v.organ, false);
  // the scene and its controls; a view flies to its own camera as it does here
  if (SCENES.some(s => s[0] === v.scene) && v.scene !== X.scene) openScene(v.scene);
  for (const [k] of SCENES) for (const c of ctlsOf(k)) {
    const x = v.ctl && v.ctl[k] && v.ctl[k][c.key];
    if (!c.options.some(o => o[0] === x) || ctlValue(k, c) === x) continue;
    if (k === X.scene) setCtl(k, c.key, x); else (X.ctl[k] = X.ctl[k] || {})[c.key] = x;
  }
  // then the network (also held by a control: should the two ever disagree, this wins)
  if (NET_ALL.includes(v.net) && v.net !== curNet()) setNet(v.net);
  renderAll();
}

// ------------------------------------------------------------------ panes --
// (a lit chip as the shell's primary button: its text in the panel's colour, readable in either theme)
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:var(--panel-solid)"' : ''}>${col ? `<span class="sw" style="background:${swCol(col)}"></span>` : ''}${label}</button>`;
// the organ icons (PET_ICONS) as small pictures for the HTML panes: in the organ's colour on a dark disc, as the
// network's nodes are (light organ colours would vanish on the light theme's panel); drawn at 64 px, shown at 18 to 26.
// Made once the story is built (iconStep, from a timer; not while a headset session runs, where the panes do not show),
// never during the load: there the first picture read back from a canvas held the page for seconds. A pane drawn before
// its icons are made holds empty pictures of their size (data-icon), filled in as they are made. The canvas is drawn
// on the processor (willReadFrequently: it is read back once), so reading it back waits for nothing.
const ICON = {}, ICONQ = { want: [], t: 0 };
function iconUrl(id) {
  if (ICON[id] === undefined && !ICONQ.want.includes(id)) { ICONQ.want.push(id); if (!ICONQ.t) ICONQ.t = setTimeout(iconStep, 300); }
  return ICON[id] || '';
}
function iconStep() {
  ICONQ.t = 0;
  if (LOAD.gone) return;
  if (!LOAD.done || XR.on) { ICONQ.t = setTimeout(iconStep, 500); return; }
  const t0 = performance.now();
  while (ICONQ.want.length && performance.now() - t0 < 20) {
    const id = ICONQ.want.shift();
    try {
      const cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
      cv.width = cv.height = 64;
      ctx.beginPath(); ctx.arc(32, 32, 31, 0, 7); ctx.fillStyle = '#0a1322'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = organCol(id); ctx.globalAlpha = 0.55; ctx.stroke(); ctx.globalAlpha = 1;
      PET_ICONS.draw(ctx, id, 32, 32, 42, { color: organCol(id), width: 42 * 0.085, detail: false });
      ICON[id] = cv.toDataURL();
    } catch (e) { ICON[id] = ''; }
    if (ICON[id]) document.querySelectorAll(`#explore img[data-icon="${id}"]`).forEach(im => { im.src = ICON[id]; });
  }
  if (ICONQ.want.length) ICONQ.t = setTimeout(iconStep, 30);
}
const iconImg = (id, px) => { const u = iconUrl(id); return `<img${u ? ` src="${u}"` : ''} data-icon="${id}" alt="" width="${px || 20}" height="${px || 20}" style="vertical-align:-5px;margin-right:6px">`; };
// a network in words: organs, links, density and disorder (as printed), hubs (printed, or computed from its links)
function netInfo(id) {
  const n = netOf(id), e = edgesOf(id), h = hubsOf(id).filter(x => x !== 'aorta');
  if (!n) return { ok: false, text: 'This network is not in the data yet.' };
  const d = Number.isFinite(+n.density) ? `density ${pct(n.density)}` : '', o = Number.isFinite(+n.disorder) ? `disorder ${dis(n.disorder)}` : '';
  return { ok: e.length > 0, n, e, hubs: h,
    text: e.length ? `${(n.organs || []).length} organs, ${e.length} links${d || o ? `; ${[d, o].filter(Boolean).join(', ')} as printed` : ''}.` : 'Its links are not read off the figure yet: only its organs show.',
    hubText: !e.length ? '' : h.length ? `${h.length > 1 ? 'Hubs' : 'Hub'} marked in the paper: ${listOf(h.map(organLow))}.` : 'No hub marked in the paper.' };
}
// a network's strength per organ, sorted from high to low (as printed in the data, else summed from its links)
function strengths(id) {
  const n = netOf(id);
  if (!n) return [];
  let s = n.computed && n.computed.strength;
  if (!s) { s = {}; for (const [a, b, w] of edgesOf(id)) { s[a] = (s[a] || 0) + Math.abs(w); s[b] = (s[b] || 0) + Math.abs(w); } }
  return Object.entries(s).filter(([k]) => PD.byId[k]).sort((a, b) => b[1] - a[1]);
}
// what a comparison measured, in plain words (Table 2's names)
const WHAT_GLOSS = { Leukocytes: 'white blood cells', CRP: 'C-reactive protein, a marker of inflammation', Norepinephrine: 'a stress hormone',
  'Tumour load': 'TLG, total tumour glycolysis: the tumours\' volume times their uptake', BMI: 'body mass index: weight for height' };
// a comparison the paper drew no network for, picked while a network shows: that network dims (exploreTargets) and the
// scene and the panes say so, so the picture never seems to show the comparison
const noNet = () => { const r = PD.D.table2[X.cmp]; return !!r && X.scene === 'organs' && netView() && !rowNets(r).some(n => n && NET_ALL.includes(n)); };
const NO_NET = 'The paper drew no network for this comparison: the network last shown is dimmed.';
const sigWord = (sig, p) => `${esc(p)}${sig ? ' (significant)' : ' (no significant difference)'}`;
const rowName = r => `${r.what} · ${r.cohort.replace(/, split at the median.*$/, '').replace(/, normalised to$/, '').replace(/^full cohort$/, 'all scans')}`;
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    <div class="pane" id="pane-networks" role="tabpanel"></div>
    <div class="pane" id="pane-organs" role="tabpanel"></div>
    <div class="pane" id="pane-scenes" role="tabpanel"></div>`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => pickTab(b.dataset.tab)));
  // one click handler per pane: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v, n = v !== undefined && v !== '' && !isNaN(+v) ? +v : v;
    ({
      cmp: () => selectCmp(n === X.cmp ? -1 : n), net: () => pickNet(v), cnet: () => showNet(v), organ: () => selectOrgan(v === X.organ ? null : v),
      scene: () => openScene(v), ctl: () => setCtl(b.dataset.scene || X.scene, b.dataset.ctl, v), life: () => setLife(!X.life),
    }[b.dataset.act] || (() => {}))();
  });
  renderAll();
  $('#viewctl').innerHTML = `<div class="grp"><span>Turn</span><div class="seg" data-ctl="turn" role="group" aria-label="Turn">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>
    <div class="grp"><span>Life size</span><div class="seg" data-ctl="life" role="group" aria-label="The scanner life size">${[['off', 'Off'], ['on', 'On']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${(X.life ? 'on' : 'off') === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]'), seg = b && b.closest('[data-ctl]');
    if (!seg) return;
    if (seg.dataset.ctl === 'turn') setTurn(b.dataset.v); else setLife(b.dataset.v === 'on');
  });
  lifeCtl();
  showTab(X.tab);
}
// the bottom bar's Life size: the scanner's only
function lifeCtl() { const g = document.querySelector('#viewctl [data-ctl="life"]'); if (g && g.closest('.grp')) g.closest('.grp').style.display = X.scene === 'scan' ? '' : 'none'; }
function setTurn(v) {
  X.turn = v;
  document.querySelectorAll('[data-ctl="turn"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
}
function showTab(k) {
  X.tab = k;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === k));
  // (should the tabs overflow a phone's panel: the row scrolls so the chosen one shows)
  const tb = $('#explore .tabs'), on = tb && tb.querySelector(`[data-tab="${k}"]`);
  if (on) { const r = on.getBoundingClientRect(), q = tb.getBoundingClientRect(); if (r.width && (r.left < q.left || r.right > q.right)) tb.scrollLeft += r.left - q.left - 8; }
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + k));
  updateExtraLabels();
}
// a tab picked by hand brings up the scene it talks about (a shared room's tab arriving does not: its scene comes with it)
function pickTab(k) {
  showTab(k);
  if (k === 'networks' && (X.scene !== 'organs' || !netView())) showNet(curNet());
  if (k === 'organs' && X.scene !== 'organs') openScene('organs');
}
function renderAll() { renderNets(); renderOrgans(); renderScenes(); }
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
    h += `<h3>${esc(r.what)}${WHAT_GLOSS[r.what] ? ` <small style="font-weight:400;font-size:15px;color:var(--muted)">${esc(WHAT_GLOSS[r.what])}</small>` : ''}</h3><p class="sub">${esc(r.cohort)}</p>
      <dl class="stats">${r.groups.map((g, i) => `<dt>${esc(g.label)}</dt><dd>${pct(g.density)}<small>density · disorder ${dis(g.disorder)} · ${g.n} scans${nets[i] && NET_ALL.includes(nets[i]) ? ` · <button type="button" data-act="cnet" data-v="${nets[i]}" style="border:0;background:none;padding:0;font:inherit;color:var(--cyan);text-decoration:underline;cursor:pointer">${nets[i] === id && X.scene === 'organs' ? 'on show' : 'show its network'}</button>` : ''}</small></dd>`).join('')}</dl>
      <p class="sub">Density: ${sigWord(r.sigD, r.pD)}. Disorder: ${sigWord(r.sigO, r.pO)}.</p>${r.note ? `<p class="note">${esc(r.note)}</p>` : ''}${noNet() ? `<p class="note">${esc(NO_NET)}</p>` : ''}`;
  }
  h += `<p class="grp-h">Networks drawn in the paper</p><div class="chips">${NET_IDS.map((n, i) => chip(`data-act="net" data-v="${n}"`, esc(NET_SHORT[i]) + (hasNet(n) ? '' : ' <small>(not read yet)</small>'), n === id && X.scene === 'organs')).join('')}</div>
    <h3 style="font-size:20px">${esc(netShort(id))}</h3><p class="sub">${esc(netTitle(id))}. ${esc(ni.text)} ${esc(ni.hubText || '')}</p>`;
  // (the strongest organs in words: no chart of the strengths, the owner's rule against 2D graphs)
  const st = strengths(id).slice(0, 3);
  if (ni.ok && st.length) h += `<p class="sub">Strongest: ${st.map(([o, v]) => `${esc(organName(o))} ${v.toFixed(1)}`).join(', ')} (an organ's strength: the sum of its links' weights).</p>`;
  h += `<p class="grp-h">Gene-activity networks (Table 3, GTEx: tissues of ${fmt(FACTS.gtex)} people)</p>
    <dl class="stats">${PD.D.table3.filter(x => x.kind !== 'fdg').map(x => `<dt>${esc(x.name.replace(/ \(.*\)$/, ''))}</dt><dd>${pct(x.density)}<small>${x.r !== null ? `r = ${x.r} with FDG's network · ` : ''}${esc(x.similar)}</small></dd>`).join('')}</dl>
    <div class="chips">${PD.D.table3.filter(PROT_NET).map(x => chip(`data-act="net" data-v="${PROT_NET(x)}"`, `${esc(netShort(PROT_NET(x)))} network`, PROT_NET(x) === id && X.scene === 'organs')).join('')}</div>`;
  pane.innerHTML = h;
  updateExtraLabels();
}
function renderOrgans() {
  const pane = $('#pane-organs');
  if (!pane) return;
  const id = X.organ, O = PD.byId[id];
  let h = `<p class="sub">The ${FACTS.organs} organs of the paper and the aorta, the reference every organ is divided by. Pick one.</p>
    <div class="chips">${PD.D.organs.map(o => chip(`data-act="organ" data-v="${o.id}"`, iconImg(o.id) + esc(o.name), id === o.id)).join('')}</div>`;
  if (O) {
    const inF2 = PD.D.f2.organs.includes(id), e = edgesOf('full').filter(x => x[0] === id || x[1] === id).sort((a, b) => Math.abs(b[2]) - Math.abs(a[2]));
    const hubIn = NET_ALL.filter(n => hasNet(n) && hubsOf(n).includes(id));
    h += `<h3>${iconImg(id, 26)}${esc(O.name)}</h3>
      <dl class="stats"><dt>Measured</dt><dd style="font-size:15px">${esc(O.measure)}</dd>
      <dt>Typical uptake</dt><dd>${id === 'aorta' ? '1' : O.suv}<small>${id === 'aorta' ? 'the unit' : 'times the aorta\'s'} (illustrative)</small></dd>
      ${inF2 && strengths('full').length ? `<dt>Strength</dt><dd>${(strengths('full').find(s => s[0] === id) || [0, 0])[1].toFixed(2)}<small>in the network of all ${fmt(FACTS.scans)} scans</small></dd>` : ''}
      <dt>Hub in</dt><dd style="font-size:15px">${hubIn.length ? esc(listOf(hubIn.map(netShort))) : 'none of the networks drawn'}</dd></dl>`;
    h += inF2 ? `<p class="grp-h">Its links in the network of all ${fmt(FACTS.scans)} scans (Figure 2A; blue together, red opposite)</p>
      <div class="chips">${e.length ? e.map(x => { const o = x[0] === id ? x[1] : x[0]; return `<button type="button" data-act="organ" data-v="${o}">${iconImg(o)}${esc(organName(o))} <b style="color:${inkCol(x[2] > 0 ? '#4c7cff' : '#ff4d4d')}">${x[2] > 0 ? '+' : '−'}${Math.abs(x[2]).toFixed(2)}</b></button>`; }).join('') : '<span class="empty">none</span>'}</div>`
      : `<p class="sub">${id === 'aorta' ? 'Not a node: the blood pool every organ is divided by.' : `Not in the network of all scans (Figure 2A has ${FACTS.f2n} organs); it appears in some of Figure 3's networks.`}</p>`;
  } else h += `<p class="empty">Colours and icons are the same in every scene. Point at an organ in the scan, a bar or a node to pick it there.</p>`;
  pane.innerHTML = h;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${ctlsOf(X.scene).filter(c => ctlShown(X.scene, c)).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlLit(X.scene, c, v))).join('')}</div>`).join('')}
    ${X.scene === 'scan' ? `<div class="actions">${chip('data-act="life"', 'Life size', X.life)}</div>` : ''}
    ${X.scene === 'organs' && X.organ ? `<p class="sub" style="margin-top:10px">Also shown: ${esc(organName(X.organ))} (Organs tab).</p>` : ''}`;
}
// a control's option is lit when it holds that value (the Network control's none while a robustness test's network shows)
const ctlLit = (k, c, v) => ctlValue(k, c) === v && !(k === 'organs' && c.key === 'network' && X.netX);
// labels the panes add (the sets label their own picks)
function updateExtraLabels() {
  LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); });
  LBL.extra = [];
  const s = GL.sets[X.scene], id = X.organ;
  if (X.scene === 'organs' && id && s.anchors[id] && !(s.labels || []).some(L => L.at === id)) {
    LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(organName(id))}</b>`, 'cyn'), set: 'organs', at: id, o: -1, txt: [organName(id), '', 'cyn'] });
  }
  // a comparison the paper drew no network for: its densities where the network's title would be
  if (noNet()) {
    const r = PD.D.table2[X.cmp], b = rowName(r), rest = `density ${r.groups.map(g => pct(g.density)).join(' against ')} · no network drawn in the paper`;
    LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(b)}</b>${esc(rest)}`, 'amb'), set: 'organs', at: 'title', o: -1, txt: [b, rest, 'amb'] });
  }
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { organ }, or null
function pickWith(rc) {
  if (APP.mode !== 'explore' || X.scene !== 'organs') return null;
  const A = setApi(X.scene);
  if (!A || !A.pick) return null;
  const r = A.pick(rc);
  if (typeof r === 'string') return PD.byId[r] ? { organ: r } : null;
  return r && r.organ && PD.byId[r.organ] ? { organ: r.organ } : null;
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
  const s = GL.sets[X.scene], at = p.organ;
  if (!s.anchors || !s.anchors[at]) return null;
  const q = anchorOf(X.scene, at);
  return q && Number.isFinite(q[0]) ? [q[0], q[1], q[2]] : null;
}
const pickText = p => [organName(p.organ), p.organ === 'aorta' ? 'the reference' : PD.byId[p.organ].measure];
function choosePick(p) {
  if (!p) return;
  if (p.organ && X.scene === 'organs') { if (X.tab !== 'organs' && X.tab !== 'networks') showTab('organs'); selectOrgan(p.organ === X.organ ? null : p.organ, false); }
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
// sound effects: the scanner's ring hums while it is the scene in explore mode, as it does in the story (from exploreStep,
// every frame in explore mode; the drone fades by itself once nobody calls it)
function sfxScanner() {
  if (X.scene !== 'scan' || sfxHidden() || !HOST.sfx || !HOST.sfx.drone) return;
  try { HOST.sfx.drone(XR_HERE + '.ring', 'machine', Object.assign(sfxWhere('scan', 'ring'), { pitch: 1.3, gain: 0.22 })); } catch (e) { /* an older shell */ }
}
