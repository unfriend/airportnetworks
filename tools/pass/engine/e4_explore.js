// ================================================================ EXPLORE ==
// Explore mode: be the shark among the fish and change who watches whom (Fish); start an outbreak in any city on the
// airports' globe, play it day by day and change how it spreads (Outbreak); the cell map's cell, its proteins, their
// places and partners, and its moves (Cell); or any scene with its own controls (Scenes).
const SCENES = [['fish'], ['globe'], ['cell']];
const sceneName = k => T('sc.' + k);
const sceneDesc = k => (k === 'globe' ? T('sc.globe.d', num(FACTS.airports), num(FACTS.routes)) : T('sc.' + k + '.d'));
const TABS = [['fish', 'tab.fish'], ['outbreak', 'tab.out'], ['cell', 'tab.cell'], ['scenes', 'tab.scenes']];
const TAB_SCENE = { fish: 'fish', outbreak: 'globe', cell: 'cell' };
const ctlsOf = k => GL.sets[k].controls || [];
// a control the panes offer now (a set may say when one applies); the shared state keeps every control all the same
const ctlShown = (k, c) => !c.when || c.when(Object.fromEntries(ctlsOf(k).map(x => [x.key, ctlValue(k, x)])));
// what explore shows: the tab, the scene and its controls; the school's size; the outbreak's start and settings (and,
// per device, its day and whether it plays, and what a click on the globe does); the city looked up; the protein picked
const X = { tab: 'fish', scene: 'fish', ctl: {}, t0: 0, turn: 'on', shark: false, n: 300, city: '', prot: '',
  out: { start: 'VIE', inc: 5, inf: 7, spread: 'medium', cut: 0, day: 0, playing: false, click: 'start' } };
const XS = {};
// params that count or are driven here jump to their new value instead of easing through the ones in between; the
// cell's moves travel at an even pace (three seconds; NF-kB's relay first, in 1.6 s, as the cell map does)
const STEP = new Set(['fish_n', 'fish_k', 'fish_hunt', 'globe_day']);
const MOVE_P = new Set(['cell_cue', 'cell_nfkb', 'cell_apop', 'cell_tfeb', 'cell_glut4', 'cell_nrf2', 'cell_als', 'cell_cf']);
const orbit = { cur: [0, -6, 0.25, 0, 1.6, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
const ctlVal = (k, key) => { const c = ctlOf(k, key); return c ? ctlValue(k, c) : ''; };
// a view option's camera: the cam view of the same name
function camFor(k, v) { const c = GL.sets[k].cam || {}; return v && c[v] ? v : null; }
const viewCam = k => camFor(k, ctlVal(k, 'view'));
const viewIs = (k, v) => ctlVal(k, 'view') === v;
// on a screen the camera follows the school unless you look around yourself
const following = () => APP.mode === 'story' || ctlVal('fish', 'view') !== 'free';
// what the sets know
const api = k => GL.sets[k].api || {};
// work for the next frame, once the sets have drawn what was just picked
const NEXT = [];
// the fish: neighbours each one watches (1 to 12) and how many there are
const fishK = () => clamp(parseInt(ctlVal('fish', 'k'), 10) || 7, 1, 12);
const MOVE_KEYS = () => api('cell').moves().map(m => m.key);

// what the chosen scene and its controls ask for: that set fully in, every other set out
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  tg[k + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of ctlsOf(k)) c[ct.key] = ctlValue(k, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  tg.lens = k === 'fish' ? 1 : 0;
  if (k === 'fish') Object.assign(tg, { fish_n: X.n, fish_k: fishK() });
  // (the outbreak is played here, day by day: the Outbreak tab's day, not the set's own clock)
  if (k === 'globe' && c.out === 'on') Object.assign(tg, { globe_out: 1, globe_dim: 1, globe_day: X.out.day });
  // (NF-kB moves once its relay has reached it)
  if (k === 'cell' && c.move === 'nfkb' && (XS.cell_cue || 0) < 0.999) tg.cell_nfkb = 0;
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  // the outbreak plays four days a second, to its end
  const O = X.out;
  if (O.playing) { O.day = Math.min(O.day + dt * 4, api('globe').end()); if (O.day >= api('globe').end()) O.playing = false; }
  const sd = Math.floor(O.day) + (O.playing ? 'p' : '');
  if (sd !== X.sd) { X.sd = sd; syncOut(); }   // (the readouts and the chart once a day)
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) {
    if (STEP.has(n)) XS[n] = tg[n];
    else if (MOVE_P.has(n)) { const r = dt / (n === 'cell_cue' ? 1.6 : 3); XS[n] += clamp(tg[n] - XS[n], -r, r); }
    else XS[n] += (tg[n] - XS[n]) * k;
  }
  // the shark's button follows the shark
  const so = GL.sets.fish.sharkOn();
  if (so !== X.so) { X.so = so; renderFish(); }
  // a gently swaying scene, unless you are steering it, it is life size, or a headset at its station stands still
  if (X.turn === 'on' && X.scene !== 'fish' && !orbit.to && !orbit.held && !GL.still && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
function pushState() { updateExtraLabels(); }
function openScene(k, fly = true) {
  if (!GL.sets[k] || !SCENES.some(s => s[0] === k)) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (k === 'fish' && !same) FOL.az = null;   // (the camera finds the school afresh)
  if (fly && !same) { flyTo(view(k, viewCam(k) || 'default')); sfxAct('whoosh', k, null, { dur: 0.8 }); }   // (sound effects: another scene)
  if (k === 'globe') outApply();
  renderAll();
}
function setCtl(k, key, v, ui = true) {
  const c = ctlOf(k, key);
  if (!c || !c.options.some(o => o[0] === v)) return;
  // (sound effects: a view, the outbreak switched on, a control)
  if (ctlValue(k, c) !== v) sfxAct(...(key === 'view' ? ['whoosh', k, null, { dur: 0.7, pitch: 1.1 }] : k === 'globe' && key === 'out' && v === 'on' ? ['pulse', k, 'start'] : ['step', k, null]));
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  // a view has its own best camera
  if (key === 'view' && k === X.scene) { const n = camFor(k, v); if (n) flyTo(view(k, n)); else if (k === 'fish') FOL.az = null; }
  // the globe's outbreak switched on from the Scenes tab plays from day 0
  if (k === 'globe' && key === 'out' && ui) { if (v === 'on') { X.out.day = 0; X.out.playing = true; } else X.out.playing = false; }
  renderAll();
}
// a view of a set, its scene brought up
function showView(k, v) { if (X.scene !== k) openScene(k); if (!viewIs(k, v)) setCtl(k, 'view', v); }
function sceneCtl(k, key, v) { if (X.scene !== k) openScene(k); setCtl(k, key, v); }
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
// hand (ui true) it also brings up the scene that shows it.
// the fish: neighbours watched (1 to 12), the school's size (100 to 600), being the shark, a shark sent
function setFishK(n, ui = true) {
  const k0 = fishK();
  (X.ctl.fish = X.ctl.fish || {}).k = String(clamp(Math.round(+n) || 7, 1, 12));
  if (fishK() !== k0) sfxAct('step', 'fish', 'school', { pitch: Math.pow(2, (fishK() - 1) / 12) });   // (sound effects: neighbours watched)
  if (ui && X.scene !== 'fish') openScene('fish');
  syncFish();
}
function setFishN(n, ui = true) {
  const n0 = X.n;
  X.n = clamp(Math.round((+n || 300) / 50) * 50, 100, 600);
  if (X.n !== n0) sfxAct('patter', 'fish', 'school', { dur: 0.8, pitch: X.n > n0 ? 1.2 : 0.8, gain: 0.7 });   // (sound effects: fish come, or go)
  if (ui && X.scene !== 'fish') openScene('fish');
  syncFish();
}
function setShark(on) {
  X.shark = !!on;
  if (!X.shark) GL.sets.fish.steer(null);
  if (X.shark && X.scene !== 'fish') openScene('fish');
  renderFish();
}
// a shark from anywhere, or where you point (dir, in the school's frame); in a shared room the others at this station
// see the same one (the set's onLaunch, see fishSync); true if one went
function sendShark(dir) {
  if (!GL.sets.fish.scatter(dir || null)) return false;
  renderFish();
  return true;
}
// the outbreak: its start (an airport's code), its settings, and the city looked up
const outIndex = code => api('globe').find(code);
function outApply() {
  const O = X.out, g = api('globe');
  g.setup({ start: outIndex(O.start), inc: O.inc, inf: O.inf, spread: O.spread, kept: 1 - O.cut / 100 });
  O.day = Math.min(O.day, g.end());
  g.select(X.city ? outIndex(X.city) : -1);
}
function setStart(code, ui = true) {
  if (outIndex(code) < 0) return;
  if (ui) sfxAct('pulse', 'globe', api('globe').pos(outIndex(code), 0.02));   // (sound effects: the outbreak starts there)
  X.out.start = code;
  if (ui) {
    X.out.day = 0; X.out.playing = true; X.out.click = 'look';   // (picked by hand: it plays, and the next click looks a city up)
    showOutbreak();
  }
  outApply(); renderOutbreak();
}
function selectCity(code, ui = true) {
  const was = X.city;
  X.city = code && outIndex(code) >= 0 ? code : '';
  if (X.city && X.city !== was) sfxAct('pick', 'globe', api('globe').pos(outIndex(X.city), 0.02));   // (sound effects: a city looked up)
  if (ui) showOutbreak();
  api('globe').select(X.city ? outIndex(X.city) : -1);
  renderOutbreak();
}
// a setting: inc and inf in days, spread 'low' | 'medium' | 'high', cut the share of flights cut (0 to 90 %)
function setOut(k, v, ui = true) {
  const O = X.out;
  if (k === 'inc') O.inc = clamp(Math.round(+v) || 5, 1, 21);
  else if (k === 'inf') O.inf = clamp(Math.round(+v) || 7, 2, 30);
  else if (k === 'cut') O.cut = clamp(Math.round((+v || 0) / 10) * 10, 0, 90);
  else if (k === 'spread' && ['low', 'medium', 'high'].includes(v)) O.spread = v;
  else return;
  if (ui) showOutbreak();
  outApply();
  if (k === 'spread') renderOutbreak(); else syncOut();
}
function playOut(on) {
  const O = X.out, end = api('globe').end();
  if (on && O.day >= end) O.day = 0;
  if (on && !O.playing) sfxAct('pulse', 'globe', 'start');   // (sound effects: the outbreak plays)
  O.playing = !!on;
  if (O.playing) showOutbreak();
  syncOut();
}
function setDay(d) { X.out.day = clamp(+d || 0, 0, api('globe').end()); X.out.playing = false; showOutbreak(); syncOut(); }
// the globe brought up with its outbreak on (by hand)
function showOutbreak() {
  if (X.scene !== 'globe') openScene('globe');
  if (ctlVal('globe', 'out') !== 'on') (X.ctl.globe = X.ctl.globe || {}).out = 'on';
}
// the cell: a protein picked (by its index, and the copy clicked), a move
function selectProtein(p, copy, ui = true) {
  const A = api('cell');
  p = typeof p === 'string' ? A.protein(p) : p;
  if (!(Number.isInteger(p) && p >= 0)) p = -1;
  const was = X.prot;
  X.prot = p >= 0 ? A.info(p).sym : '';
  if (X.prot && X.prot !== was) sfxAct('pick', 'cell', Number.isInteger(copy) ? A.pos(copy) : X.prot);   // (sound effects: a protein picked)
  A.select(p, copy);
  if (ui && X.scene !== 'cell') openScene('cell');
  renderCell(); updateExtraLabels();
}
function setMove(key, ui = true) {
  if (key !== 'none' && !MOVE_KEYS().includes(key)) return;
  if (key !== 'none' && key !== ctlVal('cell', 'move')) sfxAct(...(key === 'cf' ? ['snap', 'cell', 'CFTR'] : ['whoosh', 'cell', 'org_nuc', { dur: 1.5, pitch: 0.9 }]));   // (sound effects: a move played)
  (X.ctl.cell = X.ctl.cell || {}).move = key;
  if (ui && X.scene !== 'cell') openScene('cell');
  renderAll();
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene, every scene's controls (not the fish's
// view: on a screen it is each person's camera), the school's size, the outbreak's start and settings, the city looked
// up and the protein picked; and in story and explore mode alike where the sea has been moved at the station (sea: the
// school's offset in the station's frame, metres to the centimetre, XR.lifeSt; kept and passed on by a screen, which
// draws the fish where it always does). The camera, the outbreak's day (each plays it themselves), the language, a
// steered shark and the sea moved outside a room stay each person's own.
// shared rooms: the scene's view in a headset at a station (explore mode), which turns and sizes it in the room:
// shared (HOST.collab), so everyone there sees it alike; null while it flies somewhere, and among the life-size fish
function collabView() {
  if (APP.mode !== 'explore' || orbit.to || X.scene === 'fish') return null;
  const c = orbit.cur, r = (x, k) => Math.round(x * k) / k;
  return [r((((c[0] + 180) % 360) + 360) % 360 - 180, 10), r(c[1], 10), r(c[2], 100), r(c[3], 100), r(c[4], 100), r(c[5], 100)];
}
function collabSetView(v, now) {
  if (APP.mode !== 'explore' || X.scene === 'fish' || !Array.isArray(v) || v.length !== 6 || !v.every(Number.isFinite)) return;
  const c = orbit.cur, to = v.slice();
  to[0] += 360 * Math.round((c[0] - to[0]) / 360);
  if (now) { orbit.cur = to; orbit.to = null; return; }   // someone else turning it: there at once (shared.js smooths it)
  Object.assign(orbit, { from: c.slice(), to, t0: performance.now(), fast: true });   // a short glide there
}
const SHARED_SKIP = { fish: ['view'] };
function collabState() {
  const ctl = {};
  for (const [k] of SCENES) ctl[k] = Object.fromEntries(ctlsOf(k).filter(c => !(SHARED_SKIP[k] || []).includes(c.key)).map(c => [c.key, ctlValue(k, c)]));
  const O = X.out;
  return { tab: X.tab, scene: X.scene, ctl, n: X.n, out: { start: O.start, inc: O.inc, inf: O.inf, spread: O.spread, cut: O.cut }, city: X.city, prot: X.prot,
    sea: XR.lifeSt.toArray() };
}
const _sa = new THREE.Vector3();
// show another person's state with the story's own setters (so both panels follow); every field is checked, and
// the camera stays where this person has it
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  if (TABS.some(t => t[0] === v.tab) && v.tab !== X.tab) showTab(v.tab);
  if (SCENES.some(s => s[0] === v.scene) && v.scene !== X.scene) openScene(v.scene);
  for (const [k] of SCENES) for (const c of ctlsOf(k)) {
    const x = v.ctl && v.ctl[k] && v.ctl[k][c.key];
    if ((SHARED_SKIP[k] || []).includes(c.key) || typeof x !== 'string' || ctlValue(k, c) === x) continue;
    if (k === 'fish' && c.key === 'k') { if (/^([1-9]|1[0-2])$/.test(x)) setFishK(+x, false); continue; }   // (any of 1 to 12)
    if (k === 'cell' && c.key === 'move') { setMove(x, false); continue; }   // (any of the cell's moves)
    if (!c.options.some(o => o[0] === x)) continue;
    if (k === X.scene) setCtl(k, c.key, x, false); else (X.ctl[k] = X.ctl[k] || {})[c.key] = x;
  }
  if (Number.isInteger(v.n) && v.n >= 100 && v.n <= 600 && v.n % 50 === 0 && v.n !== X.n) setFishN(v.n, false);
  const o = v.out, O = X.out;
  if (o && typeof o === 'object') {
    if (Number.isInteger(o.inc) && o.inc >= 1 && o.inc <= 21 && o.inc !== O.inc) setOut('inc', o.inc, false);
    if (Number.isInteger(o.inf) && o.inf >= 2 && o.inf <= 30 && o.inf !== O.inf) setOut('inf', o.inf, false);
    if (Number.isInteger(o.cut) && o.cut >= 0 && o.cut <= 90 && o.cut % 10 === 0 && o.cut !== O.cut) setOut('cut', o.cut, false);
    if (['low', 'medium', 'high'].includes(o.spread) && o.spread !== O.spread) setOut('spread', o.spread, false);
    if (typeof o.start === 'string' && o.start !== O.start && outIndex(o.start) >= 0) setStart(o.start, false);
  }
  if (typeof v.city === 'string' && v.city !== X.city && (!v.city || outIndex(v.city) >= 0)) selectCity(v.city, false);
  if (typeof v.prot === 'string' && v.prot !== X.prot) { const p = v.prot ? api('cell').protein(v.prot) : -1; if (!v.prot || (Number.isInteger(p) && p >= 0)) selectProtein(p, undefined, false); }
  // (the school glides there: placeLife); not while this headset carries it, so a late echo never pulls at the hand
  if (v3ok(v.sea) && !seaHeld()) XR.lifeSt.copy(seaClamp(_sa.fromArray(v.sea)));
  renderAll();
}
// shared rooms: the school belongs to the station, as the flock does. Everyone there says where their school is, twice
// a second (a quiet effect); the one there longest leads (since: when it came, in the relay's time; a page back from a
// pause, a hidden tab, counts as new; ties by member id): the others take its swimming time and steer their school to
// it (the set's follow), and only it sends sharks of its own (the story's, now and then; a page new there listens
// 1.5 s first); a shark anyone sends goes to everyone, exactly as it starts. Positions are in the set's frame, whose
// origin is the station's spot on every device. True while at a station (the school then stays round its spot)
const FSY = { heard: new Map(), sent: 0, last: 0, since: 0, from: 0 };
const r2 = a => a.map(x => Math.round(x * 100) / 100);
const earlier = (a, b) => a.since < b.since || (a.since === b.since && a.id < b.id);
function fishSync() {
  const s = GL.sets.fish, L = HOST.collab.live(), on = !!(L && L.story === HOST.curKey && HOST.collab.joined);
  const pn = performance.now(), gap = FSY.last ? pn - FSY.last : 0;
  FSY.last = pn;
  s.onLaunch = f => HOST.collab.effect('shark', f);
  if (!on) { FSY.heard.clear(); FSY.since = 0; s.hush(false); if (s.following()) s.follow(null); return false; }
  const now = HOST.collab.now(), me = { id: HOST.collab.id || '', since: FSY.since };
  if (!FSY.since || gap > 1500) { FSY.since = me.since = Math.round(now); FSY.from = pn; }
  if (pn - FSY.sent > 500) {
    FSY.sent = pn;
    const f = s.flight();
    HOST.collab.effect('school', { id: me.id, since: me.since, at: Math.round(now), t: Math.round(f.t * 1000) / 1000, m: r2(f.m), v: r2(f.v) }, true);
  }
  let lead = null;
  for (const [k, v] of FSY.heard) if (pn - v.got > 2000) FSY.heard.delete(k); else if (earlier(v, me) && (!lead || earlier(v, lead))) lead = v;
  s.hush(pn - FSY.from < 1500);
  if (lead) { const age = clamp((now - lead.at) / 1000, 0, 2); s.follow({ t: lead.t + age, m: lead.m.map((x, j) => x + lead.v[j] * age), v: lead.v }, Math.min(gap, 1000) / 1000); }
  else if (s.following()) s.follow(null);
  return true;
}
// sound effects, live (the shared block's sfxStep calls this every frame, story and explore mode alike, unless the story is
// hidden): a shark arriving (a rush where it is) and, half a second later, the warning racing through the school; your own
// steering starting; the school's middle coming within 3 m of your head after being more than 5 m off (at most every
// 10 s). Polled, not hooked, so sharks from other devices sound too; only while the fish show (GL.lifeOn)
const SFL = { so: false, st: false, far: true, near: 0 };
function sfxLive() {
  const s = GL.sets.fish, so = s.sharkOn(), z = s.state(), st = !!(so && z.shark.steer), pn = performance.now();
  if (!GL.lifeOn) { SFL.so = so; SFL.st = st; SFL.far = true; return; }
  if (so && !SFL.so) { sfxPlay('rush', 'fish', 'shark', { dur: 1.4 }); sfxPlay('rush', 'fish', 'school', { delay: 0.5, pitch: 1.3, dur: 1, force: true }); }
  else if (st && !SFL.st) sfxPlay('rush', 'fish', 'shark', { dur: 0.8, pitch: 1.2, gain: 0.7 });
  SFL.so = so; SFL.st = st;
  const h = z.me.head, f = s.flight().m, d = Math.hypot(f[0] - h[0], f[1] - h[1], f[2] - h[2]);
  if (d > 5) SFL.far = true;
  else if (d < 3 && SFL.far && pn - SFL.near > 10000) { SFL.far = false; SFL.near = pn; sfxPlay('rush', 'fish', 'school', { dur: 1.6, pitch: 0.8, gain: 0.3 }); }
}
// what another device at the station sent: where its school is, or a shark
const v3ok = a => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
function fishEffect(type, d) {
  if (!d || typeof d !== 'object') return;
  if (type === 'school' && typeof d.id === 'string' && d.id.length < 64 && Number.isFinite(d.since) && Number.isFinite(d.at) && Number.isFinite(d.t) && v3ok(d.m) && v3ok(d.v)) {
    FSY.heard.set(d.id, { id: d.id, since: d.since, at: d.at, t: d.t, m: d.m, v: d.v, got: performance.now() });
  } else if (type === 'shark' && v3ok(d.p) && v3ok(d.v) && (d.aim === null || v3ok(d.aim))) {
    GL.sets.fish.shark(d); renderFish();
  }
}

// ------------------------------------------------------------------ panes --
// (a lit chip as the shell's primary button: its text in the panel's colour, readable in either theme)
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:var(--panel-solid)"' : ''}>${col ? `<span class="sw" style="background:${swCol(col)}"></span>` : ''}${label}</button>`;
const slider = (sl, min, max, step, v, label, col) => `<input type="range" data-sl="${sl}" min="${min}" max="${max}" step="${step}" value="${v}" aria-label="${esc(label)}" style="width:100%;accent-color:${col || CYAN}">`;
const grpH = (label, val, attr) => `<p class="grp-h">${esc(label)}${val !== undefined ? ` <b ${attr || ''} style="margin-left:auto;color:var(--ink)">${esc(val)}</b>` : ''}</p>`;
// the airports a class is likely to start from (all of them can be picked on the globe or found by name)
const QUICK_START = ['VIE', 'LHR', 'JFK', 'PEK', 'SYD', 'GRU', 'JNB', 'DEL'];
// proteins worth a look in the cell: a receptor, the moves' travellers and the wrong places
const QUICK_PROT = ['EGFR', 'RELA', 'CFTR', 'TARDBP', 'SLC2A4', 'NFE2L2', 'TFEB', 'TP53'];
const cityOf = code => { const i = outIndex(code), f = i >= 0 ? api('globe').info(i) : null; return f ? f.city : code; };
// the panes' frame: the language switch, the tabs and a pane for each (made again when the language changes)
function exploreHTML() {
  const ex = $('#explore');
  ex.lang = LANG;
  ex.innerHTML = `<div style="display:flex;justify-content:flex-end">${langSwitch()}</div>
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${esc(T(n))}</button>`).join('')}</div>
    ${TABS.map(([k]) => `<div class="pane" id="pane-${k}" role="tabpanel"></div>`).join('')}`;
  renderAll();
  buildViewCtl();
  showTab(X.tab);
}
function buildExplore() {
  const ex = $('#explore');
  {
    ex.addEventListener('click', ev => {
      const t = ev.target.closest('[data-tab]');
      if (t) { pickTab(t.dataset.tab); return; }
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const v = b.dataset.v;
      ({
        view: () => { const [k, w] = v.split(':'); showView(k, w); }, scene: () => openScene(v),
        ctl: () => sceneCtl(b.dataset.scene || X.scene, b.dataset.ctl, v),
        shark: () => setShark(v === 'on'), send: () => sendShark(null),
        start: () => setStart(v), city: () => selectCity(v === X.city ? '' : v), click: () => { X.out.click = v; renderOutbreak(); },
        play: () => playOut(!X.out.playing), again: () => { X.out.day = 0; playOut(true); }, spread: () => setOut('spread', v),
        prot: () => selectProtein(v === X.prot ? -1 : v), move: () => setMove(v === ctlVal('cell', 'move') ? 'none' : v),
      }[b.dataset.act] || (() => {}))();
    });
    // sliders change in place, so a drag is not cut short by a redraw; searches list what they find
    ex.addEventListener('input', ev => {
      const e = ev.target, sl = e.dataset.sl;
      if (sl) ({ fk: () => setFishK(e.value), fn: () => setFishN(e.value), day: () => setDay(e.value),
        inc: () => setOut('inc', e.value), inf: () => setOut('inf', e.value), cut: () => setOut('cut', e.value) }[sl] || (() => {}))();
      if (e.dataset.q) searchList(e.dataset.q, e.value);
    });
  }
  $('#viewctl').addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]'), seg = b && b.closest('[data-ctl]');
    if (seg && seg.dataset.ctl === 'turn') setTurn(b.dataset.v);
  });
  exploreHTML();
}
// the bar under the scene in explore mode: the scene's sway
function buildViewCtl() {
  const vc = $('#viewctl');
  vc.innerHTML = `<div class="grp"><span>${esc(T('turn'))}</span><div class="seg" data-ctl="turn" role="group" aria-label="${esc(T('turn'))}">${[['on', T('on')], ['off', T('off')]].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${esc(n)}</button>`).join('')}</div></div>`;
}
function setTurn(v) {
  X.turn = v;
  document.querySelectorAll('[data-ctl="turn"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
}
function showTab(k) {
  X.tab = k;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === k));
  const tb = $('#explore .tabs'), on = tb && tb.querySelector(`[data-tab="${k}"]`);
  if (on) { const r = on.getBoundingClientRect(), q = tb.getBoundingClientRect(); if (r.width && (r.left < q.left || r.right > q.right)) tb.scrollLeft += r.left - q.left - 8; }
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + k));
  updateExtraLabels();
}
// a tab picked by hand brings up the scene it talks about (a shared room's tab arriving does not: its scene comes with it)
function pickTab(k) {
  showTab(k);
  if (TAB_SCENE[k] && X.scene !== TAB_SCENE[k]) openScene(TAB_SCENE[k]);
  if (k === 'outbreak' && ctlVal('globe', 'out') !== 'on') { (X.ctl.globe = X.ctl.globe || {}).out = 'on'; renderAll(); }
}
function renderAll() { renderFish(); renderOutbreak(); renderCell(); renderScenes(); updateExtraLabels(); }
// a search's results, as chips under its box (the airports by code, city, name or country, also German city names; the
// proteins by symbol or name)
function searchList(q, s) {
  const box = $(`[data-res="${q}"]`);
  if (!box) return;
  const hits = s.trim() ? (q === 'out' ? api('globe').search(s, 6) : api('cell').search(s, 6)) : [];
  box.innerHTML = hits.map(i => {
    if (q === 'out') { const f = api('globe').info(i); return chip(`data-act="start" data-v="${esc(f.code)}"`, `${esc(f.city)} <small>${esc(f.code)}</small>`, f.code === X.out.start); }
    const f = api('cell').info(i); return chip(`data-act="prot" data-v="${esc(f.sym)}"`, esc(f.sym), f.sym === X.prot);
  }).join('');
}
// the fish's words for how many neighbours they watch
const kText = k => (k === 1 ? T('f.k1') : k === 2 ? T('f.k2') : T('f.k3', k));
function renderFish() {
  const pane = $('#pane-fish');
  if (!pane) return;
  const busy = GL.sets.fish.sharkOn(), k = fishK(), vc = ctlOf('fish', 'view'), lc = ctlOf('fish', 'links');
  pane.innerHTML = `<p class="sub">${esc(T('f.sub'))}</p>
    ${grpH(T('f.shark'))}<div class="chips">${[['off', T('off')], ['on', T('on')]].map(([v, n]) => chip(`data-act="shark" data-v="${v}"`, esc(n), X.shark === (v === 'on'))).join('')}
      <button type="button" data-act="send"${busy ? ' disabled' : ''}>${esc(busy ? T('f.busy') : T('f.send'))}</button></div>
    ${X.shark ? `<p class="sub">${esc(T('f.shark.how'))}</p>` : ''}
    ${grpH(T('f.k'), k, 'data-kv')}${slider('fk', 1, 12, 1, k, T('f.k'))}
    <p class="sub" data-kt>${esc(kText(k))}</p>
    ${grpH(T('f.links'))}<div class="chips">${lc.options.map(([v, n]) => chip(`data-act="ctl" data-scene="fish" data-ctl="links" data-v="${v}"`, esc(n), ctlValue('fish', lc) === v)).join('')}</div>
    ${grpH(T('f.n'), X.n, 'data-nv')}${slider('fn', 100, 600, 50, X.n, T('f.n'))}
    ${grpH(vc.label)}<div class="chips">${vc.options.map(([v, n]) => chip(`data-act="ctl" data-scene="fish" data-ctl="view" data-v="${v}"`, esc(n), ctlValue('fish', vc) === v)).join('')}</div>
    <p class="note">${esc(T('f.note'))}</p>`;
}
// the fish's readouts and sliders, in place (a drag is not cut short)
function syncFish() {
  const k = fishK();
  document.querySelectorAll('[data-kv]').forEach(el => { el.textContent = k; });
  document.querySelectorAll('[data-kt]').forEach(el => { el.textContent = kText(k); });
  document.querySelectorAll('[data-nv]').forEach(el => { el.textContent = X.n; });
  for (const [sl, v] of [['fk', k], ['fn', X.n]]) document.querySelectorAll(`input[data-sl="${sl}"]`).forEach(el => { if (document.activeElement !== el) el.value = v; });
}
// the outbreak's numbers now: the series, the day, how far it has come, the city looked up
function outNow() {
  const g = api('globe'), sr = g.series(), end = g.end(), d = Math.floor(X.out.day), c = g.count(d), sm = g.summary();
  return { g, sr, end, d, c, reached: c.E + c.I + c.R, total: sm.reached, peakDay: sm.peak, peak: sr.I[sm.peak] };
}
// what the city looked up shows: when it was reached, and the way it came
function cityText() {
  if (!X.city) return ['', ''];
  const g = api('globe'), i = outIndex(X.city), f = g.info(i), a = g.arrivalDay(i);
  const head = X.city === X.out.start ? T('o.sel.start', f.city) : a === null ? T('o.sel.never', f.city) : a <= X.out.day ? T('o.sel.on', f.city, a) : T('o.sel.yet', f.city, a);
  const ch = a !== null && X.city !== X.out.start ? g.chain(i).map(j => g.info(j).city) : [];
  return [head, ch.length > 1 ? T('o.way', ch.join(' → ')) : ''];
}
// the chart: cities in each state by day, stacked (recovered, infectious, exposed: their top is the cities reached),
// with the day on show; as an SVG on the page and drawn the same on the headset's panel (drawChart)
const OUT_COL = { E: AMBER, I: RED, R: GREY };
function chartPaths(n, W, H) {
  const { sr, end } = n, max = Math.max(1, n.total), xs = d => (d / Math.max(1, end)) * W, ys = v => H - (v / max) * H;
  const band = (lo, hi) => {
    const top = [], bot = [];
    for (let d = 0; d <= end; d++) { top.push([xs(d), ys(hi(d))]); bot.push([xs(d), ys(lo(d))]); }
    return top.concat(bot.reverse());
  };
  return [['R', band(() => 0, d => sr.R[d])], ['I', band(d => sr.R[d], d => sr.R[d] + sr.I[d])], ['E', band(d => sr.R[d] + sr.I[d], d => sr.R[d] + sr.I[d] + sr.E[d])]];
}
function chartSVG(n) {
  const W = 300, H = 96, pts = a => a.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '), x = (n.d / Math.max(1, n.end)) * W;
  return `<svg viewBox="-2 -12 ${W + 4} ${H + 28}" role="img" aria-label="${esc(T('o.reached'))}" style="width:100%;display:block;margin:6px 0 2px">
    <line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="var(--line)"/>
    ${chartPaths(n, W, H).map(([k, p]) => `<polygon points="${pts(p)}" fill="${OUT_COL[k]}" fill-opacity="0.85"/>`).join('')}
    <line x1="${x.toFixed(1)}" y1="-4" x2="${x.toFixed(1)}" y2="${H}" stroke="var(--ink)" stroke-width="1.5"/>
    <text x="0" y="-3" font-size="10" fill="var(--muted)">${esc(num(n.total))}</text>
    <text x="${W}" y="${H + 13}" font-size="10" fill="var(--muted)" text-anchor="end">${esc(T('o.day', n.end))}</text>
    <text x="0" y="${H + 13}" font-size="10" fill="var(--muted)">${esc(T('o.day', 0))}</text></svg>
    <p class="sub" style="margin:0 0 8px">${['E', 'I', 'R'].map(k => `<span class="sw" style="display:inline-block;width:9px;height:9px;border-radius:2px;margin:0 5px 0 0;background:${OUT_COL[k]}"></span>${esc(T('o.' + k))}`).join(' &nbsp;')}</p>`;
}
function renderOutbreak() {
  const pane = $('#pane-outbreak');
  if (!pane) return;
  const O = X.out, n = outNow(), st = outIndex(O.start), sf = st >= 0 ? api('globe').info(st) : null;
  pane.innerHTML = `<p class="sub amber"><b>${esc(T('o.sub'))}</b></p>
    ${grpH(T('o.start'), sf ? `${sf.city} (${sf.code})` : O.start)}
    <div class="chips">${QUICK_START.filter(c => outIndex(c) >= 0).map(c => chip(`data-act="start" data-v="${c}"`, esc(cityOf(c)), c === O.start)).join('')}</div>
    <input type="search" data-q="out" placeholder="${esc(T('o.search'))}" aria-label="${esc(T('o.search'))}" style="width:100%">
    <div class="chips" data-res="out"></div>
    ${grpH(T('o.click'))}<div class="chips">${[['start', T('o.click.start')], ['look', T('o.click.look')]].map(([v, l]) => chip(`data-act="click" data-v="${v}"`, esc(l), O.click === v)).join('')}</div>
    <div class="chips"><button type="button" class="btn primary" data-act="play" data-play>${esc(O.playing ? T('o.pause') : T('o.play'))}</button>
      <button type="button" data-act="again">${esc(T('o.again'))}</button>
      <b data-day style="margin-left:auto;align-self:center;font-size:18px">${esc(T('o.day', n.d))}</b></div>
    ${slider('day', 0, n.end, 1, n.d, T('o.day', ''))}
    <div data-chart>${chartSVG(n)}</div>
    <dl class="stats" data-ostats>${outStats(n)}</dl>
    <p data-city>${cityHTML()}</p>
    ${grpH(T('o.inc'), T('o.days', O.inc), 'data-incv')}${slider('inc', 1, 21, 1, O.inc, T('o.inc'), AMBER)}
    ${grpH(T('o.inf'), T('o.days', O.inf), 'data-infv')}${slider('inf', 2, 30, 1, O.inf, T('o.inf'), RED)}
    ${grpH(T('o.spread'))}<div class="chips">${['low', 'medium', 'high'].map(v => chip(`data-act="spread" data-v="${v}"`, esc(T('o.' + v)), O.spread === v)).join('')}</div>
    ${grpH(T('o.cut'), `${O.cut} %`, 'data-cutv')}${slider('cut', 0, 90, 10, O.cut, T('o.cut'))}
    <p class="note">${esc(T('o.note'))} ${esc(T('o.data'))}</p>`;
}
const outStats = n => `<dt>${esc(T('o.reached'))}</dt><dd>${esc(T('o.reachedv', num(n.reached), num(FACTS.airports)))}</dd>
  <dt>${esc(T('o.peak'))}</dt><dd>${esc(T('o.peakv', num(n.peak), n.peakDay))}</dd><dt>${esc(T('o.over'))}</dt><dd>${esc(T('o.overv', n.end))}</dd>`;
const cityHTML = () => { const [a, b] = cityText(); return a ? `<b>${esc(a)}</b>${b ? `<br><small>${esc(b)}</small>` : ''}` : ''; };
// the outbreak's readouts, chart and sliders, in place (a drag is not cut short); a new end changes the day slider
function syncOut() {
  if (!$('#pane-outbreak')) return;
  const O = X.out, n = outNow();
  const set = (sel, f) => document.querySelectorAll(sel).forEach(f);
  set('[data-day]', el => { el.textContent = T('o.day', n.d); });
  set('[data-play]', el => { el.textContent = O.playing ? T('o.pause') : T('o.play'); });
  set('[data-chart]', el => { el.innerHTML = chartSVG(n); });
  set('[data-ostats]', el => { el.innerHTML = outStats(n); });
  set('[data-city]', el => { el.innerHTML = cityHTML(); });
  set('[data-incv]', el => { el.textContent = T('o.days', O.inc); });
  set('[data-infv]', el => { el.textContent = T('o.days', O.inf); });
  set('[data-cutv]', el => { el.textContent = `${O.cut} %`; });
  for (const [sl, v, max] of [['day', n.d, n.end], ['inc', O.inc], ['inf', O.inf], ['cut', O.cut]]) set(`input[data-sl="${sl}"]`, el => { if (max !== undefined) el.max = max; if (document.activeElement !== el) el.value = v; });
}
// the protein picked: its places, and its partners in each
function protInfo() {
  if (!X.prot) return null;
  const A = api('cell'), p = A.protein(X.prot);
  return Number.isInteger(p) && p >= 0 ? A.info(p) : null;
}
const placeCol = k => api('cell').original.placeCss(k);
function renderCell() {
  const pane = $('#pane-cell');
  if (!pane) return;
  const A = api('cell'), f = protInfo(), mv = ctlVal('cell', 'move'), m = mv !== 'none' ? A.move(mv) : null;
  const quick = QUICK_PROT.filter(s => { const p = A.protein(s); return Number.isInteger(p) && p >= 0; });
  const delta = m ? A.moveDelta(mv).filter(d => d.lost.length || d.gained.length).slice(0, 4) : [];
  const syms = l => l.map(p => A.info(p).sym);
  pane.innerHTML = `<p class="sub">${esc(T('c.sub'))}</p>
    <input type="search" data-q="cell" placeholder="${esc(T('c.search'))}" aria-label="${esc(T('c.search'))}" style="width:100%">
    <div class="chips" data-res="cell"></div>
    <div class="chips">${quick.map(s => chip(`data-act="prot" data-v="${s}"`, esc(A.info(A.protein(s)).sym), X.prot === A.info(A.protein(s)).sym)).join('')}</div>
    ${f ? `<h3>${esc(f.sym)}</h3><p class="sub">${esc(f.name !== f.sym ? f.name + ' · ' : '')}${esc(f.role || '')}</p>
      ${grpH(T('c.places'))}<div class="chips">${f.places.map(pl => chip('disabled', esc(pl.name), false, placeCol(pl.k))).join('')}</div>
      ${grpH(T('c.partners'))}${f.partners.map(pp => `<p class="sub" style="margin:0 0 6px"><b style="color:${inkCol(placeCol(pp.place))}">${esc(pp.name)}:</b> ${pp.list.length ? esc(pp.list.slice(0, 8).map(x => x.sym).join(', ')) + (pp.list.length > 8 ? ' ' + esc(T('c.more', pp.list.length - 8)) : '') : esc(T('c.alone'))}</p>`).join('')}`
      : `<p class="sub">${esc(T('c.none'))}</p>`}
    ${grpH(T('c.moves'))}<div class="chips">${chip('data-act="move" data-v="none"', esc(T('c.nomove')), mv === 'none')}${A.moves().map(x => chip(`data-act="move" data-v="${x.key}"`, esc(x.name), mv === x.key, x.disease ? RED : TEAL)).join('')}</div>
    ${m ? `<h3>${esc(m.title)}</h3><p class="sub">${esc(m.text)}${m.disease ? ` <b style="color:${inkCol(RED)}">(${esc(T('c.disease'))})</b>` : ''}</p>
      ${delta.length ? `<ul class="steps">${delta.map(d => `<li data-col="${d.lost.length ? RED : TEAL}" style="border-left-color:${d.lost.length ? RED : TEAL}"><b style="color:${inkCol(d.lost.length ? RED : TEAL)}">${esc(d.sym)}</b>${esc([d.lost.length ? T('c.lost', syms(d.lost).slice(0, 5).join(', ')) : '', d.gained.length ? T('c.gained', syms(d.gained).slice(0, 5).join(', ')) : ''].filter(Boolean).join('; '))}</li>`).join('')}</ul>` : `<p class="sub">${esc(T('c.nochange'))}</p>`}` : ''}
    <p class="note">${esc(T('c.note'))}</p>`;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  pane.innerHTML = `<div class="chips">${SCENES.map(([k]) => chip(`data-act="scene" data-v="${k}"`, esc(sceneName(k)), k === X.scene)).join('')}</div>
    <h3>${esc(sceneName(X.scene))}</h3><p class="sub">${esc(sceneDesc(X.scene))}</p>
    ${ctlsOf(X.scene).filter(c => ctlShown(X.scene, c)).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}`;
}
// labels the panes add (none: the sets label their own picks: the city looked up, the protein picked)
function updateExtraLabels() {}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2(), _rp = new THREE.Vector3();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { city } (an airport) or { copy }
// (a protein in one of its places), or null
function pickWith(rc) {
  if (APP.mode !== 'explore') return null;
  try {
    if (X.scene === 'globe') { const i = api('globe').pick(rc); return i >= 0 ? { city: i } : null; }
    if (X.scene === 'cell') { const c = api('cell').pick(rc); return c >= 0 ? { copy: c } : null; }
  } catch (e) { return null; }
  return null;
}
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
// where a pick is, in its set's own frame (for the headset's ray and tip), or null (then where the ray meets the scene)
function pickPos(p) { return p.city !== undefined ? api('globe').pos(p.city, 0.02) : p.copy !== undefined ? api('cell').pos(p.copy) : null; }
function pickText(p) {
  if (p.city !== undefined) {
    const g = api('globe'), f = g.info(p.city), a = g.arrivalDay(p.city), on = ctlVal('globe', 'out') === 'on';
    return [f.city, on && a !== null ? `${f.code} · ${T('sky.day', a)}` : T('tip.city', f.code, num(f.routes))];
  }
  const A = api('cell'), p0 = A.proteinOf(p.copy);
  return [A.info(p0).sym, A.placeName(A.original.NET.cPlace[p.copy])];
}
function choosePick(p) {
  if (!p) return;
  if (p.city !== undefined) {
    const code = api('globe').info(p.city).code;
    if (X.tab !== 'outbreak') showTab('outbreak');
    if (X.out.click === 'start') setStart(code); else selectCity(code === X.city ? '' : code);
  } else if (p.copy !== undefined) {
    if (X.tab !== 'cell') showTab('cell');
    const A = api('cell'), q = A.proteinOf(p.copy);
    selectProtein(A.info(q).sym === X.prot ? -1 : q, p.copy);
  }
}
// be the shark: the point on the pointer's ray as far from the camera as the school is (in the school's frame)
function steerAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  const c = schoolAt(), d = clamp(GL.camera.position.distanceTo(_rp.set(c[0], c[1], c[2])), 1.5, 14);
  GL.sets.fish.steer(inFish(_rp.copy(_rc.ray.direction).multiplyScalar(d).add(_rc.ray.origin)));
}
const sharking = () => APP.mode === 'explore' && X.shark && X.scene === 'fish';
function bindCanvas() {
  const cv = GL.canvas, tip = $('#tip'), pts = new Map();
  let down = null, pinch = 0;
  cv.addEventListener('pointerdown', ev => {
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    cv.setPointerCapture(ev.pointerId);
    down = { x: ev.clientX, y: ev.clientY, moved: false };
    orbit.held = true;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
    if (sharking() && ev.pointerType === 'touch') steerAt(ev.clientX, ev.clientY);
  });
  cv.addEventListener('pointermove', ev => {
    const explore = APP.mode === 'explore';
    // being the shark: the pointer leads it (a touch drags it), and the camera stays with the school
    if (sharking() && (ev.pointerType !== 'touch' || pts.has(ev.pointerId))) { steerAt(ev.clientX, ev.clientY); if (pts.has(ev.pointerId)) pts.set(ev.pointerId, [ev.clientX, ev.clientY]); tip.style.opacity = 0; return; }
    if (pts.has(ev.pointerId) && explore) {
      const p = pts.get(ev.pointerId), dx = ev.clientX - p[0], dy = ev.clientY - p[1];
      pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch > 0) orbit.cur[2] = clamp(orbit.cur[2] * pinch / d, X.scene === 'fish' ? 0.2 : 0.05, 60);
        pinch = d; down.moved = true; return;
      }
      if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) down.moved = true;
      if (down && down.moved) {
        orbit.to = null;
        if (X.scene === 'fish') {
          // dragging takes the camera from the school: from then on you look around yourself; close up you stand still
          // and turn your head (drag the water along), from afar you circle the school
          if (following()) { orbit.cur = followView(orbit.cur, 0, true).slice(0, 6); setCtl('fish', 'view', 'free'); }
          const near = orbit.cur[2] < 1, s = near ? -0.18 : 0.25;
          orbit.cur[0] += dx * (near ? 0.18 : -0.25); orbit.cur[1] = clamp(orbit.cur[1] + dy * s, -80, 80);
        } else { orbit.cur[0] -= dx * 0.25; orbit.cur[1] = clamp(orbit.cur[1] + dy * 0.25, -80, 80); }
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
    if (sharking() && ev.pointerType === 'touch' && !pts.size) GL.sets.fish.steer(null);
    else if (APP.mode === 'explore' && down && !down.moved && ev.type === 'pointerup') {
      // a click on the water sends a shark that way; on the globe or the cell it picks
      if (X.scene === 'fish') { if (!sharking()) { _m2.set(ev.clientX / window.innerWidth * 2 - 1, -(ev.clientY / window.innerHeight) * 2 + 1); _rc.setFromCamera(_m2, GL.camera); GL.world.updateMatrixWorld(true); sendShark(_rp.copy(_rc.ray.direction).transformDirection(_sm.copy(GL.sets.fish.group.matrixWorld).invert()).toArray()); } }
      else choosePick(pickAt(ev.clientX, ev.clientY));
    }
    if (!pts.size) { down = null; orbit.held = false; }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { tip.style.opacity = 0; if (sharking()) GL.sets.fish.steer(null); });
  cv.addEventListener('wheel', ev => {
    if (APP.mode !== 'explore') return;
    ev.preventDefault();
    orbit.to = null;
    orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ev.deltaY * 0.0012), X.scene === 'fish' ? 0.2 : 0.05, 60);
  }, { passive: false });
}
