// ================================================================ EXPLORE ==
// Explore mode: the trial's field at any date with its measures (Field), the soil block's sketch with its three switches
// (Nitrogen), the cloud of kinds and the nitrifiers (Microbes), the co-occurrence network, its modules, a threshold, the
// shuffle and the split (Network); or any scene with its own controls (Scenes). Every number shown is looked up in
// SOIL_DATA (through SDATA and the sets' api()) or read off the slides (said so): nothing is computed here.
const SCENES = [
  ['soil', 'Soil', 'The cut-away block of soil with its wheat: fertiliser, the nitrogen\'s flows, a soil pore with the relay\'s microbes, the halo of the BNI wheat\'s roots and the chromosome. A sketch, not data.'],
  ['web', 'Globe', 'From the lab in Vienna to the field trial in Japan (the arc ends at JIRCAS\'s home in Tsukuba: the trial\'s site and year are not given).'],
  ['field', 'Field', `The trial's ${FACTS.plots} plots: two wheats, three regimes, ${FACTS.reps} plots of each, over ${FACTS.dates} dates; the leaves by their measured chlorophyll, nitrate under the plots, the jars' N2O and the ${FACTS.samples} samples. The plots' layout is illustrative.`],
  ['net', 'Microbes', `About ${thousands(FACTS.kinds)} kinds of microbe as a cloud (the ${fmt(FACTS.common)} common ones in its core) and the network of the ${fmt(FACTS.nodes)} that rise and fall together: its modules, a threshold, its halves.`],
];
const SCENE_SHORT = {};
// the panes' closing notes, the same on the page and in the headset (a pane's intro may be shorter in the headset)
const NOTE = {
  field: show => (show === 'n2o' ? `Two measurements, an open question: the data's own value is "the potential amount of produced nitrous oxide" (one number per sample, unit not given); the jars' peaks are read off the slides (N2O in ppm over a 20 to 22 day incubation of each date's soil). Over the season in fertilised soil the data gives ${FACTS.n2oMeta[0].toFixed(2)} against ${FACTS.n2oMeta[1].toFixed(2)} (${pTxt(FACTS.n2oMeta[2])}); the slides' model finds the wheat line significant on days ${FACTS.days[0]} to ${FACTS.days[3]}.`
    : show === 'chl' ? `Chlorophyll (SPAD) on days ${FACTS.days[0]} to ${FACTS.days[2]} is the data's; day ${FACTS.days[4]} is read off the slides (the data's last values match them, so their dates are an open question), and the slides show none on day ${FACTS.days[3]}.`
    : `Group means of ${FACTS.reps} plots (one sample is missing); p from the data's test of the two wheats at that date. ${show === 'ph' ? 'pH was not measured on every date.' : 'Ammonium and nitrate in mg N per kg dry soil.'}`),
  nitrogen: 'A sketch, not data: the soil block, its flows and their shares are a drawing. The BNI wheat\'s roots slow the relay\'s first step; the synthetic inhibitor DCD does it everywhere in the soil.',
  microbes: `Kinds are amplicon sequence variants (ASVs) from 16S rRNA gene reads, numbered by abundance among all ${fmt(FACTS.kinds)}; the cloud holds every common kind and a sample of the rest, its places a drawing (abundance inwards, each phylum a sector). Of the ${fmt(FACTS.common)} common kinds only ${word(FACTS.byLine)} differ between the wheats: a ${D.common.lineKinds.map(k => `${k.genus}, more under the ${k.more === 'BNI' ? 'BNI' : 'control'} wheat`).join(', and a ')} (q about ${D.common.lineKinds[0].q.toFixed(2)}).`,
  network: `Built for this story, not the authors' analysis: correlation, not interaction. Links join kinds whose centred log-ratios rise and fall together across the ${FACTS.samples} samples (Spearman's ρ of at least 0.6, false discovery rate under 5 %); modules by the Louvain method (their number depends on the run: about ${word(FACTS.big)} big ones). The links mostly reflect the fertiliser and the plots: with the plots' means taken out, ${fmt(FACTS.residual.plot.links)} are left. No hub is a keystone.`,
};
const TABS = [['field', 'Field'], ['nitrogen', 'Nitrogen'], ['microbes', 'Microbes'], ['network', 'Network'], ['scenes', 'Scenes']];
// the tour's web set: only its globe (with the engine's hop), so its own controls (the internet, the ties) stay out
const HIDE_CTL = { web: ['view', 'ties'] };
const OWN_CTL = {};
const isNum = () => false;
const allCtl = k => (GL.sets[k].controls || []).filter(c => !(HIDE_CTL[k] || []).includes(c.key)).concat(OWN_CTL[k] || []);
const ctlsOf = k => allCtl(k).filter(c => !isNum(k, c));
// a control the panes offer now: a set may say when one applies (when(values)), so none sits there doing nothing; the
// shared state keeps every control (ctlsOf) all the same
const ctlShown = (k, c) => !c.when || c.when(Object.fromEntries(allCtl(k).map(x => [x.key, ctlValue(k, x)])));
// whether a scene's slider applies now (the threshold, in the network)
const numShown = (k, key) => key === 'rho' && k === 'net' && netView() !== 'cloud';
const numOf = key => X[key];
// (explore opens on the field at day 70, chlorophyll, both wheats; each scene starts on the story's own choices)
const X = { tab: 'field', scene: 'field', t0: 0, turn: 'on',
  ctl: { soil: { view: 'default', fert: 'on', wheat: 'bni', dcd: 'off' }, field: { view: 'default', date: '4', show: 'chl', line: 'both', fert: 'all' },
    net: { view: 'net', colour: 'module', by: 'line' } },
  mod: -1, rho: 0.6, shuf: 0, kind: -1, plot: -1 };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['field_jday', 'field_module', 'field_pick', 'field_show', 'field_line', 'field_fert', 'net_focus', 'net_splitBy', 'net_kind', 'soil_pick']);
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
// a view option's camera: the one it stands for, or the cam view of the same name
const CAM_ALIAS = { soil: { pore: 'relay' }, net: {}, field: {} };
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {};
  for (const x of [al[v], v]) if (x && c[x]) return x;
  return null;
}
// the control that chooses a scene's camera: its view
const VIEW_KEY = {};
const viewKey = k => VIEW_KEY[k] || 'view';
const viewCam = k => { const c = ctlOf(k, viewKey(k)); return c ? camFor(k, ctlValue(k, c)) : k === 'web' ? 'globe' : null; };
// the view on show in a set
const viewIs = (k, v) => { const c = ctlOf(k, viewKey(k)); return !!c && ctlValue(k, c) === v; };
// what the sets know (their api()): the field's plots and picking, the cloud's kinds, the network's modules and picking
const API = {};
const api = k => API[k] || (API[k] = (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null) || {});
// work for the next frame, once the sets have drawn what was just picked
const NEXT = [];
// what the panes choose, by name
const ctlv = (k, key) => { const c = ctlOf(k, key); return c ? ctlValue(k, c) : ''; };
const netView = () => ctlv('net', 'view');
const fieldDate = () => clamp(parseInt(ctlv('field', 'date'), 10) || 0, 0, 4);
const fieldShow = () => ctlv('field', 'show') || 'chl';
const SHOWS = ['chl', 'nh4', 'no3', 'n2o', 'ph'];
const BIG = D.net.mods.map((m, i) => i).filter(i => D.net.mods[i].n >= 100);
// a kind by its number (its abundance rank among all kinds): its index in the cloud, or -1 if the cloud does not hold it
function kindOfRank(r) {
  const R = SD.cloud.rank;
  let lo = 0, hi = R.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (R[m] < r) lo = m + 1; else hi = m; }
  return R[lo] === r ? lo : -1;
}

// the controls a set's explore() reads: its own, and the time since they changed
function ctlArgs(k, now) {
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of allCtl(k)) c[ct.key] = ctlValue(k, ct);
  return c;
}
// what the chosen scene and its controls ask for: that set fully in, every other set out; then what the panes pick
// (a plot group, a module, a threshold, the shuffle, a kind)
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  tg[k + '_a'] = 1;
  const c = ctlArgs(k, now);
  if (s.explore) Object.assign(tg, s.explore(c));
  // the globe: only the globe, turning from Vienna to Japan while the hop draws its arc
  if (k === 'web') Object.assign(tg, { web_net: 0, web_globe: K.prog(c.t, 0, 1.2), web_ties: 0, web_spin: SPIN.vienna + (SPIN.japan - SPIN.vienna) * K.prog(c.t, 1, 7),
    hop_a: 1, hop_t: K.prog(c.t, 1.2, 6.5) });
  // the field: a plot group picked by hand
  // (the group picked lit whatever the wheat and regime chosen: those only dim plots while none is picked)
  if (k === 'field' && X.plot >= 0) Object.assign(tg, { field_pick: X.plot, field_tags: 1, field_line: -1, field_fert: -1 });
  if (k === 'net') {
    Object.assign(tg, { net_rho: X.rho, net_shuffle: X.shuf, net_focus: X.mod, net_kind: X.kind });
    if (X.mod >= 0 && netView() !== 'cloud') tg.net_mods = 1;
    // the field lies under the cloud and the network (a module lights the plots where it thrives), dim while it splits
    const fs = GL.sets.field, fc = ctlArgs('field', now);
    fc.t = 1e3;
    Object.assign(tg, fs.params, fs.explore ? fs.explore(fc) : {}, { field_a: netView() === 'split' ? 0.2 : X.mod >= 0 ? 1 : 0.7, field_jars: 0, field_cores: 0,
      field_stack: 0, field_tags: 0, field_pick: -1, field_line: -1, field_fert: -1, field_module: X.mod, field_mlit: X.mod >= 0 && netView() !== 'cloud' ? 1 : 0 });
  }
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : LOG.has(n) ? logMix(XS[n], tg[n], k) : XS[n] + (tg[n] - XS[n]) * k;
  // a gently swaying scene, unless you are steering it or a set asks for stillness
  if (X.turn === 'on' && !orbit.to && !orbit.held && !GL.still && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
// what the panes pick reaches the sets through their params (exploreTargets)
function pushState() { updateExtraLabels(); }
function openScene(k, fly = true) {
  if (!GL.sets[k] || !SCENES.some(s => s[0] === k)) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (fly && !same) flyTo(view(k, viewCam(k) || 'default'));
  renderAll();
}
function setCtl(k, key, v) {
  const c = ctlOf(k, key);
  if (!c || !c.options.some(o => o[0] === v)) return;
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  // (a wheat or a regime chosen: the group picked by hand gives way to it)
  if (k === 'field' && (key === 'line' || key === 'fert')) X.plot = -1;
  // a view has its own best camera
  if (key === viewKey(k) && k === X.scene) { const n = camFor(k, v); flyTo(view(k, n || 'default')); }
  renderAll();
}
// a view of a set, its scene brought up
function showView(k, v) { if (X.scene !== k) openScene(k); if (!viewIs(k, v)) setCtl(k, viewKey(k), v); }
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
// the threshold of the links drawn (0.6 to 0.8, to the hundredth): only the strongest links, the stored ones a prefix
function setRho(v, ui = true) {
  const r = clamp(Math.round(+v * 100) / 100, 0.6, 0.8);
  if (!Number.isFinite(r) || r === X.rho) return;
  X.rho = r;
  if (ui) { if (X.scene !== 'net') openScene('net'); if (netView() === 'cloud') setCtl('net', 'view', 'net'); }
  syncNums();
}
const setNum = (key, v, ui) => ({ rho: setRho }[key] || (() => {}))(v, ui);
// a module (-1 none): its kinds lit, the rest dimmed, and the plots where it thrives lit below
function selectModule(m, ui = true) {
  const n = D.net.mods.length;
  X.mod = Number.isInteger(m) && m >= 0 && m < n ? m : -1;
  if (ui && X.mod >= 0) {
    if (X.scene !== 'net') openScene('net');
    if (netView() !== 'net') setCtl('net', 'view', 'net');
    if (ctlv('net', 'colour') !== 'module') setCtl('net', 'colour', 'module');
  }
  renderAll();
}
const stepModule = d => { const n = D.net.mods.length; selectModule(X.mod < 0 ? (d > 0 ? 0 : n - 1) : (X.mod + d + n) % n); };
// the shuffle (0 the network, 1 the samples shuffled: not one link left)
function setShuffle(on, ui = true) {
  X.shuf = on ? 1 : 0;
  if (ui) { if (X.scene !== 'net') openScene('net'); if (netView() === 'cloud') setCtl('net', 'view', 'net'); }
  renderAll();
}
// the split: off (the whole network) or by wheat line, fertiliser or at random
function setSplit(by) {
  if (X.scene !== 'net') openScene('net');
  if (by === 'off') { if (netView() === 'split') setCtl('net', 'view', 'net'); }
  else { setCtl('net', 'by', by); if (netView() !== 'split') setCtl('net', 'view', 'split'); }
  renderAll();
}
// a kind of the cloud (-1 none): its bubble, its links and its numbers
function selectKind(i, ui = true) {
  const n = api('net').n || 0;
  X.kind = Number.isInteger(i) && i >= 0 && i < n ? i : -1;
  if (ui && X.kind >= 0) {
    if (X.scene !== 'net') openScene('net');
    if (netView() === 'split') setCtl('net', 'view', api('net').nodeOf(X.kind) >= 0 ? 'net' : 'cloud');
    if (netView() === 'net' && api('net').nodeOf(X.kind) < 0) setCtl('net', 'view', 'cloud');
    NEXT.push(() => { if (X.scene !== 'net' || X.kind < 0) return; flyNear(api('net').pos(X.kind), Math.min(orbit.cur[2], 1.6)); });
  }
  renderAll();
}
// a group of plots (line * 3 + fert, -1 none): lit, the others dimmed, with tags of the measure on show
function selectPlot(g, ui = true) {
  X.plot = Number.isInteger(g) && g >= 0 && g < 6 ? g : -1;
  if (ui && X.plot >= 0 && X.scene !== 'field') openScene('field');
  renderAll();
}
// a control of a scene picked from a tab: its scene brought up
function sceneCtl(k, key, v) {
  if (X.scene !== k) openScene(k);
  setCtl(k, key, v);
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls (the soil
// block's switches, the field's view, date, measure, wheat and regime, the microbes' view, colour and split), the
// module picked, the threshold, the shuffle, the kind picked and the group of plots picked. The camera is each
// person's own.
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
  return { tab: X.tab, scene: X.scene, ctl, mod: X.mod, rho: X.rho, shuf: X.shuf, kind: X.kind, plot: X.plot };
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
  // then the numbers and the picks (the threshold as the slider rounds it, so state() reports what was applied)
  const int = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi, okNum = (x, lo, hi) => Number.isFinite(x) && x >= lo && x <= hi;
  if (okNum(v.rho, 0.6, 0.8) && Math.round(v.rho * 100) / 100 !== X.rho) setRho(v.rho, false);
  if ((v.shuf === 0 || v.shuf === 1) && v.shuf !== X.shuf) setShuffle(v.shuf === 1, false);
  if (int(v.mod, -1, D.net.mods.length - 1) && v.mod !== X.mod) selectModule(v.mod, false);
  if (int(v.kind, -1, (api('net').n || 1) - 1) && v.kind !== X.kind) selectKind(v.kind, false);
  if (int(v.plot, -1, 5) && v.plot !== X.plot) selectPlot(v.plot, false);
  renderAll();
}

// ------------------------------------------------------------------ panes --
// (a lit chip as the shell's primary button: its text in the panel's colour, readable in either theme)
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:var(--panel-solid)"' : ''}>${col ? `<span class="sw" style="background:${swCol(col)}"></span>` : ''}${label}</button>`;
// a slider the panes hold (the threshold), with its value; it changes in place, so a drag is not cut short by a redraw
const NUM = { rho: { label: 'Rising together at least', min: 0.6, max: 0.8, step: 0.01, col: CYAN, text: v => `ρ ${v.toFixed(2)}` } };
const sOf = (o, v) => v, vOf = (o, s) => s;
const slider = key => { const o = NUM[key], v = numOf(key);
  return `<p class="grp-h">${o.label} <b data-numv="${key}" style="margin-left:auto;color:var(--ink)">${esc(o.text(v))}</b></p>
    <input type="range" data-num="${key}" min="${o.min}" max="${o.max}" step="${o.step}" value="${sOf(o, v)}" aria-label="${o.label}" style="accent-color:${o.col}">`; };
const statsHtml = rows => `<dl class="stats">${rows.map(([k, v, more]) => `<dt>${esc(k)}</dt><dd>${esc(v)}${more ? `<small>${esc(more)}</small>` : ''}</dd>`).join('')}</dl>`;
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
      view: () => { const [k, w] = v.split(':'); showView(k, w); }, scene: () => openScene(v),
      ctl: () => sceneCtl(b.dataset.scene || X.scene, b.dataset.ctl, v),
      mod: () => (v === 'none' ? selectModule(-1) : v === 'prev' ? stepModule(-1) : v === 'next' ? stepModule(1) : selectModule(+v)),
      shuf: () => setShuffle(!X.shuf), split: () => setSplit(v), kind: () => selectKind(v === 'none' ? -1 : +v), plot: () => selectPlot(v === 'none' ? -1 : +v),
      replay: () => { X.t0 = performance.now(); },
    }[b.dataset.act] || (() => {}))();
  });
  // the sliders change in place, so a drag is not cut short by a redraw
  $('#explore').addEventListener('input', ev => {
    const k = ev.target.dataset.num;
    if (NUM[k]) setNum(k, vOf(NUM[k], +ev.target.value), true);
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
  if (k === 'field' && X.scene !== 'field') openScene('field');
  if (k === 'nitrogen' && X.scene !== 'soil') openScene('soil');
  if (k === 'microbes') { if (X.scene !== 'net') openScene('net'); if (netView() !== 'cloud') setCtl('net', 'view', 'cloud'); if (ctlv('net', 'colour') === 'module') setCtl('net', 'colour', 'phylum'); }
  if (k === 'network') { if (X.scene !== 'net') openScene('net'); if (netView() === 'cloud') setCtl('net', 'view', 'net'); }
  renderAll();
}
function renderAll() { renderField(); renderNitrogen(); renderMicrobes(); renderNetwork(); renderScenes(); updateExtraLabels(); }
// the numbers that follow a slider, redrawn in place (the sliders themselves keep still while dragged)
function syncNums() {
  for (const k in NUM) {
    document.querySelectorAll(`[data-numv="${k}"]`).forEach(el => { el.textContent = NUM[k].text(numOf(k)); });
    document.querySelectorAll(`input[data-num="${k}"]`).forEach(el => { if (document.activeElement !== el) el.value = sOf(NUM[k], numOf(k)); });
  }
  const live = { network: () => statsHtml(netInfo().rows) };
  for (const k in live) document.querySelectorAll(`[data-live="${k}"]`).forEach(el => { el.innerHTML = live[k](); });
}

// ----------------------------------------------------------------- field --
const MEASURE = { chl: ['Chlorophyll', 'SPAD', 1], nh4: ['Ammonium', 'mg N/kg', 1], no3: ['Nitrate', 'mg N/kg', 1], n2o: ['N2O', 'potential, unit not given', 2], ph: ['pH', '', 2] };
const dateTxt = t => `Day ${FACTS.days[t]} · ${FACTS.stages[t]}`;
// a measure of one group at a date, as the panes print it: { v (the mean or the slides' reading), p, how }
function measureOf(key, line, fert, time) {
  if (key === 'chl') {
    if (time === 4) return { v: SD.chl70(fert, line).v, p: null, how: 'read off the slides' };
    if (time === 3) return { v: null, p: null, how: `none on day ${FACTS.days[3]}` };
  }
  const m = SD.meta(key, line, fert, time), tst = SD.lineTest(key, fert, time);
  return { v: m.mean, sd: m.sd, n: m.n, p: tst ? tst[2] : null, how: '' };
}
// the Field pane in words (both panels): the measure at the date for each regime, BNI against control, or one group picked
function fieldInfo() {
  const show = fieldShow(), t = fieldDate(), [name, unit, dp] = MEASURE[show];
  const rows = [0, 1, 2].map(f => {
    const b = measureOf(show, 0, f, t), c = measureOf(show, 1, f, t);
    return [FERT_NAME[f], `${num(b.v, dp)} · ${num(c.v, dp)}`, b.how || pTxt(b.p)];
  });
  // the jars' peaks for the date (read off the slides) with the data's N2O
  const jars = show === 'n2o' ? [0, 1, 2].map(f => { const pk = D.figs.n2o.peaks[t][f]; return [FERT_NAME[f], `${num(pk[0], 2)} · ${num(pk[1], 2)} ppm`, D.figs.n2o.p[t][f]]; }) : null;
  let pick = null;
  if (X.plot >= 0) {
    const line = Math.floor(X.plot / 3), fert = X.plot % 3, me = measureOf(show, line, fert, t), other = measureOf(show, 1 - line, fert, t);
    pick = { head: `${LINE_NAME[line]}, ${FERT_NAME[fert].toLowerCase()}`, col: LINE_COL[line], rows: [
      [name, me.v === null ? '–' : `${num(me.v, dp)}${unit && show !== 'n2o' ? ' ' + unit : ''}`, me.how || (me.sd !== undefined && me.sd !== null ? `± ${num(me.sd, dp)}, ${me.n} plots` : '')],
      [LINE_NAME[1 - line], num(other.v, dp), other.how || pTxt(me.p)]] };
  }
  return { head: `${name} · ${dateTxt(t)}`, sub: `BNI wheat · control wheat${unit && show !== 'n2o' ? ` (${unit})` : show === 'n2o' ? ' (the data: potential, unit not given)' : ''}`, rows, jars, pick };
}
const DATE_OPTS = () => ctlOf('field', 'date').options;
function renderField() {
  const pane = $('#pane-field');
  if (!pane || !ctlOf('field', 'date')) return;
  const on = X.scene === 'field', I = fieldInfo(), opts = key => ctlOf('field', key).options;
  const chips = (key, cols) => `<div class="chips">${opts(key).map(([o, n], i) => chip(`data-act="ctl" data-scene="field" data-ctl="${key}" data-v="${o}"`, esc(n), ctlv('field', key) === o, cols ? cols(o, i) : null)).join('')}</div>`;
  pane.innerHTML = `<p class="sub">The trial's ${FACTS.plots} plots: the BNI wheat and the control wheat, each with no fertiliser, with fertiliser and with fertiliser + DCD, ${word(FACTS.reps)} plots of each. Click a plot (or point at it and pull the trigger) to pick its group.</p>
    <p class="grp-h">Date</p>${chips('date')}
    <p class="grp-h">Show</p>${chips('show')}
    <p class="grp-h">Wheat</p>${chips('line', o => (o === '0' ? LINE_COL[0] : o === '1' ? LINE_COL[1] : null))}
    <p class="grp-h">Regime</p>${chips('fert', o => (o === 'all' ? null : FERT_COL[+o]))}
    <p class="grp-h">View</p><div class="chips">${opts('view').map(([o, n]) => chip(`data-act="view" data-v="field:${o}"`, esc(n), on && ctlv('field', 'view') === o)).join('')}</div>
    <h3>${esc(I.head)}</h3><p class="sub">${esc(I.sub)}</p>${statsHtml(I.rows)}
    ${I.jars ? `<p class="grp-h">The jars' peaks (read off the slides): BNI · control</p>${statsHtml(I.jars)}` : ''}
    ${I.pick ? `<h3 style="color:${inkCol(I.pick.col)}">${esc(I.pick.head)}</h3>${statsHtml(I.pick.rows)}<div class="chips">${chip('data-act="plot" data-v="none"', 'None', false)}</div>` : ''}
    <p class="note">${esc(NOTE.field(fieldShow()))}</p>`;
}

// -------------------------------------------------------------- nitrogen --
function renderNitrogen() {
  const pane = $('#pane-nitrogen');
  if (!pane || !ctlOf('soil', 'view')) return;
  const on = X.scene === 'soil';
  pane.innerHTML = `<p class="sub">A sketch, not data: the soil block with fertiliser, the BNI wheat's roots and the synthetic inhibitor. Switch them, and watch where the nitrogen goes.</p>
    ${ctlsOf('soil').map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([o, n]) => chip(`data-act="ctl" data-scene="soil" data-ctl="${c.key}" data-v="${o}"`, esc(n), (c.key !== 'view' || on) && ctlValue('soil', c) === o)).join('')}</div>`).join('')}
    <div class="chips">${chip('data-act="replay"', 'Replay the flows', false)}</div>
    <p class="note">${esc(NOTE.nitrogen)}</p>`;
}

// -------------------------------------------------------------- microbes --
// the nitrifiers' shares of reads by regime and by wheat line (both panels)
function guildRows() {
  return D.guilds.keys.map(k => { const G = D.guilds[k]; return [G.name, `${G.byFert.map(v => v.toFixed(2)).join(' · ')} %`, `BNI ${G.byLine[0].toFixed(2)} · control ${G.byLine[1].toFixed(2)}`]; });
}
// a kind picked, in words (both panels)
function kindInfo() {
  if (X.kind < 0 || !api('net').info) return null;
  const I = api('net').info(X.kind), sh = I.share;
  const rows = [['Phylum', I.phylum], ['In samples', `${I.prev} of ${I.samples}`], ['Share of reads', `${sh >= 0.01 ? sh.toFixed(sh >= 1 ? 1 : 2) : sh.toPrecision(1)} %`, 'on average']];
  if (I.guild) rows.push(['Nitrifier', I.guild]);
  rows.push(['Differs by', I.differs ? (I.differs.length ? I.differs.join(', ') : 'nothing measurable') : 'not tested', I.differs ? 'fertiliser, date, wheat line or plot' : 'a rare kind']);
  rows.push(['Network', I.node >= 0 ? `${fmt(I.links)} links${I.module >= 0 ? `, module ${I.module + 1}` : ''}` : 'not in it']);
  return { head: `Kind ${fmt(I.rank)}${I.name ? ' · ' + I.name : ''}`, rows };
}
function renderMicrobes() {
  const pane = $('#pane-microbes');
  if (!pane || !ctlOf('net', 'colour')) return;
  const col = ctlv('net', 'colour'), K2 = kindInfo();
  pane.innerHTML = `<p class="sub">About ${thousands(FACTS.kinds)} kinds of microbe in this soil, as a cloud: the ${fmt(FACTS.common)} common ones (${pct(FACTS.readShare)} of the reads) in its core. Click a kind (or point at it and pull the trigger) to pick it.</p>
    <p class="grp-h">Colour</p><div class="chips">${[['phylum', 'Phylum'], ['guild', 'Nitrifiers']].map(([o, n]) => chip(`data-act="ctl" data-scene="net" data-ctl="colour" data-v="${o}"`, n, col === o)).join('')}${chip('data-act="view" data-v="net:cloud"', 'The crowd', X.scene === 'net' && netView() === 'cloud')}</div>
    <p class="grp-h">The nitrifiers' share of reads: not fertilised · fertilised · + DCD</p>${statsHtml(guildRows())}
    ${K2 ? `<h3>${esc(K2.head)}</h3>${statsHtml(K2.rows)}<div class="chips">${chip('data-act="kind" data-v="none"', 'None', false)}</div>` : '<p class="sub">No kind picked.</p>'}
    <p class="note">${esc(NOTE.microbes)}</p>`;
}

// --------------------------------------------------------------- network --
// a module in words (both panels): its size, phyla, best-known genera, what its ups and downs go with, its nitrifiers
const R2W = [['fert', 'fertiliser'], ['time', 'date'], ['line', 'wheat line'], ['plot', 'plot']];
function moduleInfo(m) {
  const M = D.net.mods[m];
  if (!M) return null;
  const GSHORT = { aoa: 'archaea', nsp: 'Nitrosospira', nsm: 'Nitrosomonas', nit: 'Nitrospira', mnd: 'of unknown role' };
  const gk = Object.entries(M.guilds || {}).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${GSHORT[k] || D.guilds[k].name}`);
  return { head: `Module ${m + 1} · ${fmt(M.n)} kinds`, col: SLOOK.module(m), rows: [
    ['Follows', api('net').follows ? api('net').follows(m) : '', R2W.map(([k, w]) => `${w} ${pct(M.r2[k])}`).join(', ')],
    ['Phyla', M.phyla.map(([p, n]) => `${p} ${n}`).join(', ')],
    ['Best known', M.top.map(([g]) => g).join(', ')],
    ['Nitrifiers', gk.length ? gk.join(', ') : 'none']] };
}
// the network at the threshold, the shuffle and the split, in words (both panels)
function netInfo() {
  const A = api('net'), sp = D.net.splits, cut = SD.net.cut(X.rho), v = netView(), by = ctlv('net', 'by');
  const rows = [['Links', X.shuf ? `${fmt(D.net.null.links)} (shuffled)` : fmt(cut), X.shuf ? 'each kind\'s samples shuffled on its own' : `of ${fmt(FACTS.links)} at 0.60`],
    ['Kinds', A.nodesAt ? fmt(A.nodesAt(X.rho)) : '', 'with a link']];
  if (v === 'split') {
    const L = by === 'fert' ? sp.fert.map((s, i) => [FERT_NAME[i], `${fmt(s.links)} links`, `${s.samples} samples`]) : by === 'random' ? [['Half A', `${fmt(sp.random[0][0])} links`, '59 samples'], ['Half B', `${fmt(sp.random[0][1])} links`, '60 samples']]
      : sp.line.map((s, i) => [LINE_NAME[i], `${fmt(s.links)} links`, `${s.samples} samples`]);
    rows.push(...L);
    if (by !== 'fert') rows.push(['Apart', fmt(by === 'random' ? Math.abs(sp.random[0][0] - sp.random[0][1]) : sp.lineDiff), `random halves: ${fmt(sp.randomDiff[0])} to ${fmt(sp.randomDiff[1])}`]);
  }
  return { rows };
}
const SPLIT_OPTS = [['off', 'Off'], ['line', 'Wheat line'], ['fert', 'Fertiliser'], ['random', 'At random']];
const splitNow = () => (netView() === 'split' ? ctlv('net', 'by') : 'off');
function renderNetwork() {
  const pane = $('#pane-network');
  if (!pane || !ctlOf('net', 'colour')) return;
  const col = ctlv('net', 'colour'), M = X.mod >= 0 ? moduleInfo(X.mod) : null;
  pane.innerHTML = `<p class="sub">The ${fmt(FACTS.nodes)} kinds that rise and fall together across the ${FACTS.samples} samples. Pick a module to light the plots where it thrives; shuffle the samples; split the samples in two.</p>
    <p class="grp-h">Colour</p><div class="chips">${[['module', 'Module'], ['phylum', 'Phylum'], ['guild', 'Nitrifiers']].map(([o, n]) => chip(`data-act="ctl" data-scene="net" data-ctl="colour" data-v="${o}"`, n, col === o)).join('')}</div>
    <p class="grp-h">Module</p><div class="chips">${BIG.map(m => chip(`data-act="mod" data-v="${m}"`, `${m + 1}`, X.mod === m, SLOOK.module(m))).join('')}${chip('data-act="mod" data-v="prev"', '‹', false)}${chip('data-act="mod" data-v="next"', '›', false)}${chip('data-act="mod" data-v="none"', 'None', X.mod < 0)}</div>
    ${M ? `<h3 style="color:${inkCol(M.col)}">${esc(M.head)}</h3>${statsHtml(M.rows)}` : ''}
    ${slider('rho')}
    <p class="sub">At 0.55, ${fmt(FACTS.thresholds.find(x => x.rho === 0.55).links)} links; at 0.5, ${fmt(FACTS.thresholds.find(x => x.rho === 0.5).links)}: too many to draw.</p>
    <div class="chips">${chip('data-act="shuf"', X.shuf ? 'Unshuffle' : 'Shuffle the samples', !!X.shuf)}</div>
    <p class="grp-h">Split by</p><div class="chips">${SPLIT_OPTS.map(([o, n]) => chip(`data-act="split" data-v="${o}"`, n, splitNow() === o)).join('')}</div>
    <div data-live="network">${statsHtml(netInfo().rows)}</div>
    <p class="note">${esc(NOTE.network)}</p>`;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${ctlsOf(X.scene).filter(c => ctlShown(X.scene, c)).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    ${Object.keys(NUM).filter(key => numShown(X.scene, key)).map(slider).join('')}
    <p class="grp-h">About</p><p class="credits">${esc(ABOUT)}</p>`;
}
// labels the panes add (none: the sets label their own picks)
function updateExtraLabels() {}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { kind } (a kind of the cloud or
// the network) or { plot } (a plot of the field), or null
function pickWith(rc) {
  if (APP.mode !== 'explore' || !['field', 'net'].includes(X.scene)) return null;
  const A = api(X.scene);
  let r = null;
  try { r = A.pick ? A.pick(rc) : null; } catch (e) { return null; }
  if (r === null || r === undefined) return null;
  if (X.scene === 'net') return r.kind === 'kind' ? { kind: r.i } : null;
  const p = typeof r === 'number' ? r : r.plot !== undefined ? r.plot : r.p !== undefined ? r.p : r.i;
  return Number.isInteger(p) && p >= 0 && p < FACTS.plots ? { plot: p } : null;
}
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
// where a pick is, in its set's own frame (for the headset's ray and tip), or null (then where the ray meets the scene)
function pickPos(p) {
  if (p.kind !== undefined && api('net').pos) return api('net').pos(p.kind);
  if (p.plot !== undefined && api('field').plotXZ) { const q = api('field').plotXZ(p.plot); return [q[0], 0.06, q[2]]; }
  return null;
}
function pickText(p) {
  if (p.kind !== undefined) return api('net').kindText ? api('net').kindText(p.kind) : ['', ''];
  if (p.plot !== undefined) {
    const o = SD.ofPlot(p.plot), [name, , dp] = MEASURE[fieldShow()];
    return [LINE_NAME[o.line], ` · ${FERT_NAME[o.fert].toLowerCase()} · ${name === 'N2O' || name === 'pH' ? name : name.toLowerCase()} ${num(plotValue(p.plot), dp)}`];
  }
  return ['', ''];
}
// a plot's own value of the measure on show at the date (the data's; chlorophyll's last date from the slides, its group's)
function plotValue(p) {
  const o = SD.ofPlot(p), show = fieldShow(), t = fieldDate();
  if (show === 'chl' && t >= 3) return measureOf(show, o.line, o.fert, t).v;
  const v = SD.value(show, SD.slot(o.line, o.fert, t, o.rep));
  return v === null || v === undefined ? measureOf(show, o.line, o.fert, t).v : v;
}
// a click (or the trigger) on a kind picks it (again: none); on a plot, its group (again: none)
function choosePick(p) {
  if (!p) return;
  if (p.kind !== undefined) {
    if (X.tab !== 'microbes' && X.tab !== 'network') showTab(netView() === 'cloud' ? 'microbes' : 'network');
    selectKind(p.kind === X.kind ? -1 : p.kind, false);
  } else if (p.plot !== undefined) {
    const o = SD.ofPlot(p.plot), g = o.line * 3 + o.fert;
    if (X.tab !== 'field') showTab('field');
    selectPlot(g === X.plot ? -1 : g, false);
  }
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
