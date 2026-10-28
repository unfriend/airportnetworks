// Headless test of shared rooms (docs/shared-space-plan.md, section 9).
//   node tools/collab.mjs [--shots <dir>]
// It starts its own relay (relay/server.mjs --static .) on a free port, so no other server is needed, and
// checks: a page served by the relay starts a room; a mistyped code makes no room; Arrange all's two rows; three
// pages see the same stations; Remove asks first; per story in STORIES (below) play, pause, a jump and mode
// changes reach a following page (within 5 s: a busy machine is slow), the explore state round-trips both ways
// and the story's effect reaches the others; two people changing different controls at once both keep their
// change; a switch asked for while a story loads is not lost; a story picked by hand stops following; no writes
// while idle (no ping-pong); a late joiner gets everything; a relay restart is survived; the headsets' two settings
// (labels, free moving) are the room's: everything in 3D in a room without them, set on one page, in the Shared
// dialog or the headset's menu for every page and headset, never refused by the layout lock, kept across a relay
// restart and in a room on this device, free moving off taking the turns out of places and panels, and a free grip
// at a station turning the scene and the panel for everyone; a pretend headset (fake local-floor and shared spaces,
// as tools/smoke.mjs pretends) aligns from a published frame, stands at its station, stays there when taken off
// and on again, restarts nothing with Start on its Stories screen, sends its rays in room coordinates, re-aligns
// when the frame moves, switches story by walking to another station (and takes its state), lets the story's
// own panel win over a card behind it; a headset without a shared space calibrates from two marks (its panel's
// Stop calibrating still works), saves the frame with an anchor at mark A and finds it again next time; a VR
// headset asks once whether it is in the room, and takes its own floor when elsewhere; the headset's menu (closed
// at first, only its clock on the left wrist; opened by the left stick's click, a touch of the right controller or
// index fingertip, or the trigger on the clock; Exit inside). --shots also saves pictures (the Shared dialog on a
// desktop and a phone, four pretend headset views). --quick runs only the last
// story of STORIES in the per-story part (for a quicker run while working on the rest); --port N runs the relay on
// port N (default: any free port).
// Needs Playwright as tools/smoke.mjs does (PLAYWRIGHT_MODULE, CHROMIUM_PATH). Exits 1 on any failure.
//
// Adding a story: give it its hooks (the plan's section 7, as the flock has them), then an entry in STORIES:
//   change / back: code (run with HOST.cur.peek) that changes the story's shared explore state, and changes it
//                  again differently (both must change what collab.state() returns)
//   effect (optional): quiet stops the story's own effects, idle is true when none is playing, send causes one
//                  (calling HOST.collab.effect), seen is true on the other page once it plays there
//   more (optional): async (A, B, C) => more checks of its own, after the effect (A changed things, B and C follow)
// The first entry starts on every page's Stories screen with its story already loaded (Follow must close it);
// the last is the station page A follows last, so it is the pretend headset's (HEADSET_STORY).
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const STORIES = {
  airports: {
    change: "(showTab('closures'), xrSetK(20), setView('color', 'btw'))",
    back: "(X.manual.add(A('LHR')), updateClosures(), showTab('communities'), X.iso = 3, renderCommunities(), X.hubsBy = 'btw', renderHubs(), X.routes = 1.1)",
  },
  proteins: {
    change: "(selectAirport(A('TP53')), showTab('communities'), X.iso = 3, renderCommunities(), xrSetK(20), setView('pillars', 'btw'))",
    back: "(X.manual.add(A('EGFR')), updateClosures(), xrPathPreset(A('BACE1'), A('BRCA1')), showTab('path'), X.hubsBy = 'btw', renderHubs(), setView('color', 'deg'), X.routes = 1.1)",
  },
  spatial: {
    change: "setView('color', 'deg'); setMove(MV.nfkb, true); runPath(A('EGF'), A('SRF'))",
    back: "showTab('prox'); setBait(CP('NUP153')); X.proxR = 0.12; selectProtein(A('RELA'), false)",
  },
  lbi: {
    change: "openScene('atp'); setCtl('atp', 'view', 'network')",
    back: "showTab('protein'); selectProtein(findProtein('TP53')); xrPathPreset(findProtein('TP53'), findProtein('BRCA1'))",
  },
  nmd: {
    change: "selectGroup(5); togglePick(5, 13); runWalk(5); setCtl('tower', 'show', 'walk')",
    back: "addMine(findGene('TTN')); addMine(findGene('DES')); runWalk('mine'); knockRandom(10); showTab('layers')",
  },
  endo: {
    change: "selectEndo(2); showTab('method'); showStep(0); setK(8)",
    back: "showTab('genes'); selectGene(GL.sets.net.api().geneIndex('SNAP25')); setCtl('net', 'walkers', 'on'); setK(3)",
  },
  pet: {
    change: "showNet('A_high'); selectOrgan('liver'); setCtl('scan', 'view', 'inside')",
    back: "showNet('C_high'); selectOrgan('muscle'); setCtl('scan', 'view', 'ring')",
  },
  micro: {
    change: "selectOrgan('Ovary'); setAge(70); setStep(3)",
    back: "selectDomain('submucosa'); showTab('domains'); setCtl('hier', 'view', 'contacts')",
  },
  qubits: {
    change: "sceneCtl('cube', 'net', '2'); selectBrick('X2X1'); setCtl('cube', 'bits', '2')",
    back: "setSum(6); setCtl('cube', 'alg', '0'); showTab('depth'); sceneCtl('chart', 'view', 'circuit')",
  },
  pass: {
    // (and the school's place at the station, sea: moved with the grip there, the same for everyone)
    change: "pickTab('outbreak'); setStart('LHR'); setOut('inc', 3); setOut('cut', 50); selectCity('SYD'); XR.lifeSt.set(0.4, -0.3, 1.25)",
    back: "selectProtein('RELA'); setMove('nfkb'); setFishK(3); setFishN(450); pickTab('fish'); XR.lifeSt.set(-1.5, 0.2, 0)",
    effect: { quiet: "setCtl('fish', 'shark', 'off')", idle: '!GL.sets.fish.sharkOn()', send: 'sendShark(null)', seen: 'GL.sets.fish.sharkOn()' },
  },
  ovary: {
    change: "selectKind('follicle'); setAge(60); setMethod('seg')",
    back: "showTab('scenes'); openScene('section'); setCtl('section', 'view', 'kinds'); selectKind('vessel')",
  },
  mutation: {
    change: "pickTab('rule'); sceneCtl('rule', 'model', 'even'); sceneCtl('rule', 'start', 'C'); setTime(0.8)",
    // (the pair favour picked by hand turns the stem's numbers to this example, computed live)
    back: "pickTab('tree'); sceneCtl('tree', 'seed', '3'); selectBranch(4); setW(20)",
  },
  robots: {
    change: "setCtl('robots', 'rule', 'chain'); setCtl('robots', 'robots', '12')", back: "setCtl('robots', 'trails', 'on'); setCtl('robots', 'links', 'on')",
    effect: { quiet: '0', idle: "(window.__c0 = GL.sets.robots.anchors.crumbs().join(), true)", send: 'spillCrumbs()', seen: "GL.sets.robots.anchors.crumbs().join() !== window.__c0" },
    // the pile lands at the same spot everywhere, and a dusty floor again (a counter, not state) dusts the others' too
    async more(A, B) {
      const pile = p => peek(p, 'GL.sets.robots.anchors.crumbs().join()');
      const [a, b] = [await pile(A), await pile(B)];
      check('robots: the crumbs land at the same spot on the others', a === b, `A ${a}, B ${b}`);
      const d0 = await peek(A, 'Math.floor(XS.robots_dust || 0)');
      await peek(B, 'dustAgain()');
      check('robots: a dusty floor again on one page dusts the others', await until(A, d => HOST.cur.peek('Math.floor(XS.robots_dust || 0)') === d + 1, d0, 5000),
        `A from ${d0} to ${await peek(A, 'XS.robots_dust')}`);
    },
  },
  flock: {
    change: "setCtl('flock', 'birds', '400')", back: "setCtl('flock', 'birds', '100')",
    effect: { quiet: "setCtl('flock', 'falcon', 'off')", idle: '!GL.sets.flock.falconOn()', send: 'sendFalcon(null)', seen: 'GL.sets.flock.falconOn()' },
    // the flock belongs to the station: the same falcon everywhere; one page leads, the others take its flight time
    // and fly with its flock (positions in the set's frame, the same on every page)
    async more(A, B, C) {
      const fal = p => peek(p, 'GL.sets.flock.falconOn() ? GL.sets.flock.state().falcon.p.slice() : null');
      const [fa, fb] = await Promise.all([fal(A), fal(B)]);
      check('flock: the falcon flies the same way on the others', !!fa && !!fb && Math.hypot(fa[0] - fb[0], fa[1] - fb[1], fa[2] - fb[2]) < 10, `A ${fa}, B ${fb}`);
      await sleep(3000);
      for (const p of [A, B, C]) await until(p, () => !HOST.cur.peek('GL.sets.flock.falconOn()'), null, 15000);   // scattered birds gather again
      await sleep(3000);
      const fl = p => peek(p, '(() => { const s = GL.sets.flock, f = s.flight(); return { lead: !s.following(), t: f.t, m: f.m }; })()');
      const f = await Promise.all([A, B, C].map(fl)), d = (a, b) => Math.hypot(a.m[0] - b.m[0], a.m[1] - b.m[1], a.m[2] - b.m[2]);
      const show = JSON.stringify(f.map(x => ({ lead: x.lead, t: +x.t.toFixed(2), m: x.m.map(v => +v.toFixed(1)) })));
      check('flock: one page at the station leads, the others follow it', f.filter(x => x.lead).length === 1, show);
      check('flock: every page flies on the leader\'s flight time', Math.max(...f.map(x => x.t)) - Math.min(...f.map(x => x.t)) < 0.6, show);
      check('flock: the flocks fly together (their middles within 5 m)', d(f[0], f[1]) < 5 && d(f[0], f[2]) < 5, show);
    },
  },
};
// the stories a pretend headset walks between: its own (the last in STORIES, whose station has an explore clock and
// stored state; the flock's sky catches every ray, so its rays have a length), another, and one whose card it picks
const HEADSET_STORY = 'flock', OTHER_STORY = 'spatial', PICK_STORY = 'proteins', MOVE_STORY = 'nmd';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const argv = process.argv.slice(2), shots = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : '';
if (argv.includes('--quick')) for (const k of Object.keys(STORIES).slice(0, -1)) delete STORIES[k];
const relayPort = argv.includes('--port') ? +argv[argv.indexOf('--port') + 1] : 0;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const fails = [], errors = [];
const check = (name, ok, detail) => {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (!ok && detail ? ': ' + detail : ''));
  if (!ok) fails.push(name);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const near = (a, b, tol) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= tol);
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const fmt = a => '[' + a.map(v => (+v).toFixed(4)).join(', ') + ']';
const r3 = x => Math.round(x * 1000) / 1000;
const angle = (a, b) => { let d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };

// ---- the relay
let relay = null, port = 0;
function startRelay(p) {
  return new Promise((res, rej) => {
    const r = spawn(process.execPath, ['relay/server.mjs', '--port', String(p || 0), '--static', '.', '--quiet'], { cwd: root });
    let out = '';
    const t = setTimeout(() => rej(new Error('the relay did not start: ' + out)), 10000);
    r.stdout.on('data', d => {
      out += d;
      const m = /listening on http:\/\/[^:]+:(\d+)/.exec(out);
      if (m) { clearTimeout(t); port = +m[1]; relay = r; res(r); }
    });
    r.stderr.on('data', d => { out += d; });
    r.on('exit', c => { if (!port) rej(new Error('the relay stopped (' + c + '): ' + out)); });
  });
}
const stopRelay = () => new Promise(res => { if (!relay) return res(); relay.once('exit', res); relay.kill('SIGTERM'); relay = null; });
const base = () => `http://127.0.0.1:${port}/`;
const roomInfo = async code => (await fetch(base() + 'api/rooms/' + code)).json();

// ---- pages: each in its own browser context (its own storage, like separate devices)
async function open(hash, size) {
  const ctx = await browser.newContext({ viewport: size || { width: 640, height: 400 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.stack || e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(base() + 'index.html' + hash, { timeout: 90000 });   // (pages already open draw in software: a busy machine loads slowly)
  await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });
  return page;
}
const until = (page, fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms || 1000, polling: 30 }).then(() => true, () => false);
const peek = (page, src) => page.evaluate(s => HOST.cur.peek(s), src);
const ready = (page, key, ms) => until(page, k => HOST.curKey === k && HOST.cur && HOST.cur.peek('typeof ST !== "undefined" && ST.items.length > 0') &&
  (!HOST.cur.collab || HOST.collab.internals().ready), key, ms || 40000);
const clockOf = page => peek(page, '[APP.mode, APP.playing, APP.t]');
const stateOf = page => page.evaluate(() => JSON.stringify(HOST.cur.collab.state()));
const stationOf = (page, story) => page.evaluate(k => (HOST.collab.stations().find(s => s.story === k) || {}).id, story);

// ---- poses in the pretend room: [x, y, z, yaw] (yaw about the vertical, three.js's way)
const rot = (yaw, v) => [v[0] * Math.cos(yaw) + v[2] * Math.sin(yaw), v[1], -v[0] * Math.sin(yaw) + v[2] * Math.cos(yaw)];
const apply = (P, v) => { const r = rot(P[3], v); return [r[0] + P[0], r[1] + P[1], r[2] + P[2]]; };
const unapply = (P, v) => rot(-P[3], [v[0] - P[0], v[1] - P[1], v[2] - P[2]]);
const unit = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
// the physical room: the room frame, the shared space's origin, this headset's local-floor and local origins
let ROOM = [2, 0, 1, 0.3];
const SHARED = [-1, 0, 0.5, 1.1], FLOOR = [0.4, 0, -0.7, -0.5], LOCAL = [0.9, 1.6, 0.2, 0.8];
const frameFor = (P, uuid, by, at) => ({ uuid, o: unapply(SHARED, [P[0], P[1], P[2]]), x: rot(-SHARED[3], rot(P[3], [1, 0, 0])), by, at, src: 'marks' });

// a pretend headset session in a page (WebXR in software, as tools/smoke.mjs does): fake spaces and frames
// whose poses come from the room above; the story's xrBegin and the shell's own frame callback are driven by step()
function installXR(o) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z), Y = V(0, 1, 0);
  const M = a => new THREE.Matrix4().compose(V(a[0], a[1], a[2]), new THREE.Quaternion().setFromAxisAngle(Y, a[3]), V(1, 1, 1));
  const X = window.__xr = { W: { local: M(o.local), floor: M(o.floor), shared: M(o.shared), head: M(o.head) }, raf: [], made: [], handles: window.__handles || new Map(), resets: {}, n: 0 };
  window.__handles = X.handles;   // saved anchors outlive a session, as on a headset
  const sp = name => ({ name, addEventListener(t, fn) { (X.resets[name] = X.resets[name] || []).push(fn); }, removeEventListener() {} });
  X.spaces = { local: sp('local'), 'local-floor': sp('local-floor'), shared: Object.assign(sp('shared'), { UUId: o.sharedId || '' }) };
  const world = s => s.world || X.W[{ local: 'local', 'local-floor': 'floor', shared: 'shared' }[s.name]];
  const pose = m => {
    const p = V(), q = new THREE.Quaternion(), sc = V();
    m.decompose(p, q, sc);
    return { transform: { position: { x: p.x, y: p.y, z: p.z, w: 1 }, orientation: { x: q.x, y: q.y, z: q.z, w: q.w }, matrix: Float32Array.from(m.elements) } };
  };
  const mkAnchor = w => { const a = { anchorSpace: { world: w }, delete() {},
    requestPersistentHandle: () => {   // a full store (o.cap handles) refuses, with Quest Browser's words
      if (o.cap && X.handles.size >= o.cap) return Promise.reject(new DOMException('Failed to execute \'requestPersistentHandle\' on \'XRAnchor\': Maximum number of anchors reached!', 'InvalidStateError'));
      const u = 'room' + ++X.n + Math.random().toString(36).slice(2, 6); X.handles.set(u, w); return Promise.resolve(u);
    } }; return a; };
  X.frame = {
    getPose: (s, b) => pose(world(b).clone().invert().multiply(world(s))),
    getViewerPose: b => pose(world(b).clone().invert().multiply(X.W.head)),
    getJointPose: (j, b) => (j && j.world ? pose(world(b).clone().invert().multiply(j.world)) : null),   // a tracked hand's joint
    createAnchor(t, b) {
      const w = world(b).clone().multiply(new THREE.Matrix4().compose(V(t.position.x, t.position.y, t.position.z),
        new THREE.Quaternion(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w), V(1, 1, 1)));
      X.made.push({ p: [t.position.x, t.position.y, t.position.z], space: b.name });
      return Promise.resolve(mkAnchor(w));
    },
  };
  X.sl = []; X.ev = {};
  X.session = { mode: o.mode, enabledFeatures: o.features, visibilityState: 'visible', renderState: {},
    addEventListener(t, fn) { if (t === 'visibilitychange') X.sl.push(fn); else (X.ev[t] = X.ev[t] || []).push(fn); },
    removeEventListener(t, fn) { X.sl = X.sl.filter(f => f !== fn); if (X.ev[t]) X.ev[t] = X.ev[t].filter(f => f !== fn); }, inputSources: [],
    requestReferenceSpace: t => (t === 'local' || o.features.includes(t) ? Promise.resolve(X.spaces[t]) : Promise.reject(new Error(t + ' not supported'))),
    requestAnimationFrame(cb) { X.raf.push(cb); return X.raf.length; },
    restorePersistentAnchor: u => (X.handles.has(u) ? Promise.resolve(mkAnchor(X.handles.get(u))) : Promise.reject(new Error('unknown'))),
    deletePersistentAnchor: u => { if (X.stuck) return Promise.reject(new DOMException('cannot delete', 'InvalidStateError')); X.handles.delete(u); return Promise.resolve(); },
    get persistentAnchors() { return [...X.handles.keys()]; } };
  const xr = HOST.renderer.xr;
  X.getRef = X.getRef || xr.getReferenceSpace;
  xr.getReferenceSpace = () => X.spaces.local;
  X.begin = () => {
    HOST.closePicker();
    HOST.mode = o.mode; HOST.session = X.session;
    HOST.cur.peek('(XR.session = HOST.session, XR.mode = HOST.mode, xrEnterScene())');
  };
  // one frame: the story's headset loop (which asks HOST.anchor.frame), then the shell's own callback
  // (while a story changes, the next one only joins in once it has taken over the session: xrAdopt)
  X.step = () => {
    if (HOST.cur && HOST.cur.peek('typeof XR !== "undefined" && XR.on')) HOST.cur.peek('xrBegin')(X.frame, 0.016);
    for (const cb of X.raf.splice(0)) cb(performance.now(), X.frame);
  };
  X.head = h => { X.W.head = M(h); };
  // the headset taken off (hidden) or put on again (visible): its listeners in the order they were added
  X.visibility = v => { X.session.visibilityState = v; for (const fn of X.sl.slice()) fn({ session: X.session }); };
  // a session event (squeezestart, squeezeend) to the listeners the page added
  X.fire = (t, e) => { for (const fn of (X.ev[t] || []).slice()) fn(e); };
  // controller i by its whole pose in the story's local space: the story's controller and the session's input
  // source (whose target ray the shell reads while it carries a station)
  X.aim = (i, m) => {
    const c = HOST.cur.peek('XR.ctrls')[i];
    const src = X.session.inputSources[i] || (X.session.inputSources[i] = { targetRayMode: 'tracked-pointer', handedness: i ? 'left' : 'right', gamepad: null, targetRaySpace: {} });
    c.src = src; c.g.visible = true; c.g.matrix.copy(m);
    src.targetRaySpace.world = X.W.local.clone().multiply(m);
  };
  // a controller's ray, given in the room (world) coordinates
  X.ctrl = (i, ow, dw) => {
    const c = HOST.cur.peek('XR.ctrls')[i];
    if (!ow) { c.src = null; c.g.visible = false; return; }
    const inv = X.W.local.clone().invert(), ol = V(...ow).applyMatrix4(inv), dl = V(...dw).normalize().transformDirection(inv);
    c.src = c.src || { targetRayMode: 'tracked-pointer', handedness: i ? 'left' : 'right', gamepad: null };
    c.g.visible = true;
    c.g.matrix.compose(ol, new THREE.Quaternion().setFromUnitVectors(V(0, 0, -1), dl), V(1, 1, 1));
  };
  X.end = () => { try { HOST.cur.peek('xrEnded()'); } catch (e) { /* no story */ } HOST.session = null; HOST.mode = null; xr.getReferenceSpace = X.getRef; };
  // local-floor moves to F (the room's pose of its origin) and says so as Quest Browser does: a reset whose
  // transform carries points from the old coordinates into the new ones, its height the head's change (dy, which
  // must not count); err moves the reported origin (Quest's was 1 to 1.5 cm out)
  X.floorReset = (F, dy, err) => {
    const old = X.W.floor, E = err ? M([F[0] + err[0], F[1], F[2] + err[2], F[3]]) : M(F);
    X.W.floor = M(F);
    const newFromOld = new THREE.Matrix4().makeTranslation(0, dy || 0, 0).multiply(E.clone().invert().multiply(old));
    for (const fn of X.resets['local-floor'] || []) fn({ transform: { matrix: Float32Array.from(newFromOld.elements), inverse: { matrix: Float32Array.from(newFromOld.clone().invert().elements) } } });
  };
  return true;
}
// frames for a while (real time passes: the station dwell, the reconciliation)
const frames = (page, ms) => page.evaluate(async ms => {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) { window.__xr.step(); await new Promise(r => setTimeout(r, 16)); }
}, ms);
const rigOf = page => page.evaluate(() => { const r = HOST.cur.peek('GL.rig'); return [r.position.x, r.position.y, r.position.z, 2 * Math.atan2(r.quaternion.y, r.quaternion.w)]; });
// where a story's rig must stand at station s: its spot at eye height, in this headset's local space
const rigAt = (s, L) => { L = L || LOCAL; const w = apply(ROOM, [s.x, 1.6, s.z]); return [...unapply(L, w), ROOM[3] + s.yaw - L[3]]; };
const headAt = (s, yaw) => [...apply(ROOM, [s.x, 1.6, s.z]), yaw || 0];
// walk a pretend headset to station s: after a second there its story starts (frames go on until it has), and
// takes over the session as a story does in its init (xrAdopt). Returns whether it switched, and not too early.
async function walk(page, s, story, yaw) {
  await page.evaluate(h => window.__xr.head(h), headAt(s, yaw));
  await frames(page, 500);
  const early = await page.evaluate(k => HOST.curKey === k, story);
  let ok = false;
  for (let i = 0; i < 40 && !ok; i++) { await frames(page, 300); ok = await page.evaluate(k => HOST.curKey === k, story); }
  ok = ok && await ready(page, story, 40000);
  if (ok) { await page.evaluate(() => HOST.cur.peek('xrAdopt()')); await frames(page, 200); }
  return ok && !early;
}

let code = '', NST = 0;   // the room's code; how many stories (one station each after Arrange all)
let slidesSeen = false;   // the slideshow's stop and Next in a room: checked on the first story followed
try {
  await startRelay(relayPort);
  // ------------------------------------------------------------ rooms --
  const A = await open('#stories');
  check('a page served by the relay finds it', await A.evaluate(async () => { await HOST.collab.detect(); return HOST.collab.relay === location.origin; }));
  await A.evaluate(() => HOST.collab.create());
  check('a page starts a room', await until(A, () => HOST.collab.status === 'open' && /^#s=[A-Z]{3}$/.test(location.hash), null, 10000));
  code = await A.evaluate(() => HOST.collab.code);
  await A.evaluate(() => HOST.collab.arrange({ x: 0, z: 0, yaw: 0 }));
  check('Arrange all makes a station for every story', await until(A, () => HOST.collab.stations().length === HOST.list.length && !HOST.collab.internals().pending.size, null, 3000));
  const B = await open('#s=' + code), C = await open('#s=' + code);
  const st7 = p => until(p, () => HOST.collab.status === 'open' && HOST.collab.stations().length === HOST.list.length, null, 20000);
  await st7(B); await st7(C);
  const sts = p => p.evaluate(() => JSON.stringify(HOST.collab.stations()));
  const sa = await sts(A);
  check('three pages in the room see the same stations', sa === await sts(B) && sa === await sts(C));
  const others = [B, C];
  // Arrange all (from the room's origin, facing -z): a row of half the stories (rounded up) 1.2 m ahead and the rest 2.6 m behind,
  // 2.4 m apart, all facing away (so a station's own 1.1 m zone never touches another's)
  const arranged = JSON.parse(sa), keys = await A.evaluate(() => HOST.list.map(m => m.key));
  NST = keys.length;
  const front = Math.ceil(NST / 2), wantSpot = i => (i < front ? [(i - (front - 1) / 2) * 2.4, -1.2] : [(i - front - (NST - front - 1) / 2) * 2.4, -3.8]);
  const spotsOk = keys.every((k, i) => { const s = arranged.find(x => x.story === k); return s && near([s.x, s.z], wantSpot(i), 1e-3) && Math.abs(s.yaw) < 1e-3; });
  let closest = Infinity;
  for (const a of arranged) for (const b of arranged) if (a !== b) closest = Math.min(closest, Math.hypot(a.x - b.x, a.z - b.z));
  check(`Arrange all: two rows (${Math.ceil(NST / 2)} + ${Math.floor(NST / 2)}), spots 2.4 m apart, the rows 2.6 m apart, all facing away from you`, spotsOk && closest > 2.2 - 1e-6,
    arranged.map(s => `${s.story} ${s.x},${s.z} ${s.yaw}`).join('; '));
  // a mistyped code (or an old link) makes no room: the page says so and stays out
  const E = await open('#stories');
  const bad = 'QQZ' === code ? 'QQY' : 'QQZ';
  await E.evaluate(async c => { await HOST.collab.detect(); HOST.collab.join(c); }, bad);
  const out = await until(E, () => !HOST.collab.joined && /no room/i.test(HOST.collab.internals().note), null, 8000);
  const listed = (await (await fetch(base() + 'api/rooms')).json()).some(r => r.code === bad);
  check('a code with no room behind it makes no room: the page says so and stays out', out && !listed,
    `${await E.evaluate(() => HOST.collab.status + ' ' + HOST.collab.internals().note)}, listed ${listed}`);
  await E.context().close();
  // Remove asks first ("Remove for everyone?"), and only a second press removes the station, for everyone
  const rmId = await stationOf(A, 'airports');
  await A.evaluate(() => HOST.collab.dialog(true));
  await sleep(200);
  // (both presses in one go, with no wait between: a page busy building shaders in software can block for
  // longer than the 3 s the first press lasts, which would only arm Remove again)
  const rm = await A.evaluate(id => {
    const q = () => document.querySelector(`[data-sh="remove:${id}"]`);
    q().click();
    const text = q() && q().textContent, still = !!HOST.collab.station(id);
    q().click();
    return { text, still };
  }, rmId);
  const gone = await until(B, id => !HOST.collab.station(id), rmId, 5000);
  check('Remove asks first (Remove for everyone?), and a second press removes the station for everyone', rm.text === 'Remove for everyone?' && rm.still && gone,
    `first press: ${rm.text}, still there ${rm.still}, then gone ${gone} (A: ${await A.evaluate(id => !!HOST.collab.station(id), rmId)})`);
  // the room map: a station's dot dragged moves it, its square dragged turns it, for everyone
  const mapT = await A.evaluate(async () => {
    const cv = document.querySelector('#shMap'), s = HOST.collab.stations().find(x => x.story === 'proteins') || HOST.collab.stations()[0];
    for (let k = 0; k < 20 && !HOST.collab.mapView(); k++) await new Promise(r => setTimeout(r, 100));   // drawn by the pump
    const tf = HOST.collab.mapView();
    if (!tf || !s) return { err: 'no map' };
    const r = cv.getBoundingClientRect(), ev = (type, x, z) => cv.dispatchEvent(new PointerEvent(type, { clientX: r.left + tf.X(x), clientY: r.top + tf.Y(z), pointerId: 7, buttons: type === 'pointerup' ? 0 : 1, bubbles: true }));
    ev('pointerdown', s.x, s.z); ev('pointermove', s.x + 0.5, s.z + 0.3); await new Promise(r => setTimeout(r, 150)); ev('pointermove', s.x + 1, s.z + 0.6); ev('pointerup', s.x + 1, s.z + 0.6);
    const m = HOST.collab.station(s.id), tf2 = HOST.collab.mapView(), r2 = cv.getBoundingClientRect(), a = s.yaw + Math.PI / 2;
    const at = (x, z) => ({ clientX: r2.left + tf2.X(x), clientY: r2.top + tf2.Y(z), pointerId: 8, bubbles: true });
    cv.dispatchEvent(new PointerEvent('pointerdown', at(m.x - 1.4 * Math.sin(m.yaw), m.z - 1.4 * Math.cos(m.yaw))));
    cv.dispatchEvent(new PointerEvent('pointermove', Object.assign(at(m.x - 1.4 * Math.sin(a), m.z - 1.4 * Math.cos(a)), { buttons: 1 })));
    cv.dispatchEvent(new PointerEvent('pointerup', at(m.x - 1.4 * Math.sin(a), m.z - 1.4 * Math.cos(a))));
    const after = HOST.collab.station(s.id), lockB = document.querySelector('[data-sh="lock"]');
    lockB.click(); await new Promise(r => setTimeout(r, 300));
    const tf3 = HOST.collab.mapView(), r3 = cv.getBoundingClientRect(), at3 = (x, z, b) => ({ clientX: r3.left + tf3.X(x), clientY: r3.top + tf3.Y(z), pointerId: 9, buttons: b, bubbles: true });
    cv.dispatchEvent(new PointerEvent('pointerdown', at3(after.x, after.z, 1))); cv.dispatchEvent(new PointerEvent('pointermove', at3(after.x - 1, after.z, 1)));
    cv.dispatchEvent(new PointerEvent('pointerup', at3(after.x - 1, after.z, 0)));
    const still = HOST.collab.station(s.id), arrOff = document.querySelector('[data-sh="arrange"]').disabled, label = lockB.textContent;
    const followed = HOST.collab.internals().follow;   // (a drag on the locked map is no click: it follows nothing)
    lockB.click(); await new Promise(r => setTimeout(r, 300));
    return { id: s.id, from: [s.x, s.z, s.yaw], moved: [m.x, m.z], turned: after.yaw, follow: HOST.collab.internals().follow, locked: { kept: Math.abs(still.x - after.x) < 1e-6, arrOff, label, followed, unlocked: !HOST.collab.locked } };
  });
  const mapB = !mapT.err && await until(B, ([id, x, z, yaw]) => { const s = HOST.collab.station(id); return !!s && Math.abs(s.x - x) < 0.005 && Math.abs(s.z - z) < 0.005 && Math.abs(Math.sin(s.yaw - yaw)) < 0.005; },
    [mapT.id, mapT.from[0] + 1, mapT.from[1] + 0.6, mapT.from[2] + Math.PI / 2], 3000);
  check('the room map: a station\'s dot dragged moves it and its square dragged turns it, for everyone (a drag follows nothing)', !mapT.err &&
    near(mapT.moved, [mapT.from[0] + 1, mapT.from[1] + 0.6], 0.005) && Math.abs(Math.sin(mapT.turned - mapT.from[2] - Math.PI / 2)) < 0.005 && !mapT.follow && mapB, JSON.stringify(mapT));
  check('the room map: with the layout locked (its button) a station cannot be dragged and Arrange all is off; unlocked again', !mapT.err &&
    mapT.locked.kept && mapT.locked.arrOff && mapT.locked.label === 'Unlock layout' && !mapT.locked.followed && mapT.locked.unlocked, JSON.stringify(mapT.locked));
  await A.evaluate(() => { HOST.collab.dialog(false); HOST.collab.arrange({ x: 0, z: 0, yaw: 0 }); });
  await st7(B); await st7(C);

  // ------------------------------------------- the headsets' two settings --
  // labels (in 3D, hidden, on top) and free moving are the room's, the same on every page and headset in it (key
  // look): a room without the key gives everything in 3D; set on one page, the others follow at once, also from the
  // Shared dialog's row and with the layout locked (it never refuses them); free moving off takes the turns out of
  // the stations' places and panels
  const lookOf = p => p.evaluate(() => [HOST.xr.labels(), HOST.xr.free()].join());
  const lookIs = (p, want) => until(p, w => [HOST.xr.labels(), HOST.xr.free()].join() === w, want, 3000);
  const look0 = await Promise.all([A, B, C].map(lookOf));
  check('the headsets\' settings: a room without them gives everything in 3D (labels in 3D, free moving) on every page',
    !(await roomInfo(code)).keys.look && look0.every(l => l === 'fixed,true'), look0.join('; '));
  await A.evaluate(() => HOST.xr.setLabels('hidden'));
  const lookSet = await lookIs(B, 'hidden,true') && await lookIs(C, 'hidden,true');
  check('the headsets\' settings: set on one page, every other page in the room follows', lookSet, (await Promise.all([A, B, C].map(lookOf))).join('; '));
  // a station's scene turned and its panel tilted (as a free grip leaves them), and the layout locked; then B's
  // Shared dialog: labels on top, free moving off
  const tId = await stationOf(A, 'lbi'), kTp = 'st.' + tId + '.place', kTn = 'st.' + tId + '.panel';
  await A.evaluate(([a, b]) => {
    HOST.collab.publish([[a, { x: 0.1, y: 0, z: -0.2, s: 1, q: [0, 0.7071, 0, 0.7071], story: 'lbi' }], [b, { x: -0.5, y: 1.5, z: -0.6, yaw: 0.3, q: [0.2, 0.1, 0, 0.9747], story: 'lbi' }]]);
    HOST.collab.lock(true);
  }, [kTp, kTn]);
  const turned = await until(B, k => HOST.collab.locked && !!HOST.collab.val(k) && !!HOST.collab.val(k).q, kTp, 3000);
  const dlg = await B.evaluate(async () => {
    HOST.collab.dialog(true); await new Promise(r => setTimeout(r, 300));
    const sl = document.querySelector('#shLabels'), fb = document.querySelector('[data-sh="free"]'), shown = sl && sl.value;
    sl.value = 'face'; sl.dispatchEvent(new Event('change', { bubbles: true })); fb.click();
    await new Promise(r => setTimeout(r, 300));
    const out = { shown, sel: sl.value, btn: fb.textContent };
    HOST.collab.dialog(false);
    return out;
  });
  const lk2 = await lookIs(A, 'face,false') && await lookIs(C, 'face,false');
  for (let k = 0; k < 15 && ((await roomInfo(code)).keys[kTp] || { v: {} }).v.q; k++) await sleep(200);
  const rk2 = (await roomInfo(code)).keys, unq = !!rk2[kTp] && !rk2[kTp].v.q && !!rk2[kTn] && !rk2[kTn].v.q && rk2[kTn].v.yaw === 0.3;
  const aUnq = await A.evaluate(([a, b]) => !HOST.collab.val(a).q && !HOST.collab.val(b).q, [kTp, kTn]);
  check('the headsets\' settings: the Shared dialog\'s row sets them for everyone, also with the layout locked; free moving off takes the turns out of the stations\' places and panels',
    turned && dlg.shown === 'hidden' && dlg.sel === 'face' && dlg.btn === 'Moving: facing you' && lk2 && unq && aUnq && !!rk2.look && rk2.look.v.labels === 'face' && rk2.look.v.free === false,
    JSON.stringify({ turned, dlg, lk2, place: rk2[kTp], panel: rk2[kTn], look: rk2.look }));
  await A.evaluate(([a, b]) => { HOST.collab.lock(false); HOST.collab.publish([[a, null], [b, null]]); HOST.xr.setLabels('fixed'); HOST.xr.setFree(true); }, [kTp, kTn]);
  await lookIs(B, 'fixed,true'); await lookIs(C, 'fixed,true');

  // ------------------------------------------------- each story, followed --
  for (const [key, T] of Object.entries(STORIES)) {
    const id = await stationOf(A, key);
    for (const p of [A, B, C]) { await p.evaluate(i => HOST.collab.follow(i), id); }
    for (const p of [A, B, C]) await ready(p, key);
    // (and closes the Stories screen, also where the story was loaded already: while it shows, nothing syncs)
    const shown = await Promise.all([A, B, C].map(p => p.evaluate(() => HOST.curKey + (HOST.picking ? ' on its Stories screen' : ''))));
    check(`${key}: Follow shows the station's story on every page`, shown.every(k => k === key), shown.join(', '));
    await until(B, () => !HOST.cur.peek('APP.playing'), null, 3000);
    const t0 = Date.now(), from = (await clockOf(A))[2];
    await peek(A, 'APP.playing || APP.togglePlay()');
    check(`${key}: play reaches a following page`, await until(B, () => HOST.cur.peek('APP.mode === "story" && APP.playing'), null, 5000));
    await sleep(1500);
    // read just after the shell's five-times-a-second check (a page rendering a frame a second, as headless
    // software WebGL can, falls behind between two checks: the stories cap a frame's step at 0.1 s), after five
    // checks in a row, and keep the read nearest the clock: a long frame can still come between a check and a read
    const reads = await B.evaluate(() => new Promise(r => {
      const C = HOST.collab.internals(), out = []; let p0 = C.pumpAt;
      const iv = setInterval(() => { if (C.pumpAt !== p0) { p0 = C.pumpAt; out.push([HOST.cur.peek('APP.t'), Date.now()]); if (out.length === 5) { clearInterval(iv); r(out); } } }, 1);
    }));
    const [run, ran] = reads.map(([v, at]) => [v, from + (at - t0) / 1000]).sort((a, b) => Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1]))[0];
    check(`${key}: a playing station runs on the relay's clock (a following page keeps up)`, Math.abs(run - ran) < 0.45, `B at ${run.toFixed(2)} s, ${ran.toFixed(2)} s since play`);
    await peek(A, 'APP.togglePlay()');
    const paused = await until(B, () => !HOST.cur.peek('APP.playing'), null, 5000);
    const [ca, cb] = [await clockOf(A), await clockOf(B)];
    await sleep(500);
    const cb2 = await clockOf(B);
    check(`${key}: pause reaches it, at the same moment, and it stays there`, paused && Math.abs(ca[2] - cb[2]) < 0.3 && Math.abs(cb2[2] - cb[2]) < 0.02, `A ${ca}, B ${cb}, then ${cb2}`);
    await peek(A, 'APP.seek(20)');
    check(`${key}: a jump reaches it`, await until(B, () => Math.abs(HOST.cur.peek('APP.t') - 20) < 0.3, null, 5000));
    // slideshow on page A only (a setting per device): its stop at a chapter's end pauses the station for the others
    // at that t, and its Next plays it again (once, on the first story followed here)
    if (!slidesSeen) {
      slidesSeen = true;
      await A.evaluate(k => HOST.slides.set(k, true), key);
      const s = await peek(A, 'slideStop(1)');
      await peek(A, `(APP.seek(${s} - 2), APP.playing || APP.togglePlay())`);
      const stopped = await until(A, s => !HOST.cur.peek('APP.playing') && HOST.cur.peek('APP.t') === s, s, 20000) && await until(B, () => !HOST.cur.peek('APP.playing'), null, 5000);
      const [ca, cb] = [await clockOf(A), await clockOf(B)];
      check(`${key}: a slideshow stop on one page pauses the station at the end of the chapter`, stopped && Math.abs(cb[2] - s) < 0.3, `stop ${s}, A ${ca}, B ${cb}`);
      await A.evaluate(() => document.getElementById('btnNext').click());
      check(`${key}: Next on that page plays the station again`, await until(B, s => HOST.cur.peek('APP.playing') && HOST.cur.peek('APP.t') > s - 0.3, s, 5000), JSON.stringify(await clockOf(B)));
      await A.evaluate(() => HOST.slides.setGlobal(false));
      await peek(A, 'APP.togglePlay()');
      await until(B, () => !HOST.cur.peek('APP.playing'), null, 5000);
    }
    await peek(A, 'APP.enterExplore()');
    check(`${key}: explore mode reaches it`, await until(B, () => HOST.cur.peek('APP.mode') === 'explore', null, 5000));
    await sleep(500);
    const s0 = await stateOf(A);
    await peek(A, T.change);
    const s1 = await stateOf(A);
    const same = (p, s) => until(p, s => JSON.stringify(HOST.cur.collab.state()) === s, s, 6000);
    check(`${key}: the explore state reaches the others`, s1 !== s0 && await same(B, s1) && await same(C, s1), `${s0} -> ${s1}, B ${await stateOf(B)}`);
    await peek(B, T.back);
    const s2 = await stateOf(B);
    check(`${key}: and comes back the other way`, s2 !== s1 && await same(A, s2), `B ${s2}, A ${await stateOf(A)}`);
    if (T.effect) {
      const E = T.effect;
      await peek(A, E.quiet);
      await sleep(400);
      const calm = await until(B, s => HOST.cur.peek(s), E.idle, 20000) && await until(A, s => HOST.cur.peek(s), E.idle, 20000);
      await peek(A, E.send);
      check(`${key}: its effect plays at the others`, calm && await until(B, s => HOST.cur.peek(s), E.seen, 5000));
    }
    if (T.more) await T.more(A, B, C);
    await peek(B, 'APP.enterStory(0)');
    check(`${key}: Replay story on another page reaches the first`, await until(A, () => HOST.cur.peek('APP.mode === "story" && APP.t < 2'), null, 5000));
    await peek(A, 'APP.enterExplore()');
    await until(C, () => HOST.cur.peek('APP.mode') === 'explore', null, 5000);
  }

  // ----------------------------------- two people, two controls, at once --
  // A and B change different controls of the station they follow (the last story's) at the same moment: neither
  // change is undone by the other. First as people do (each page publishes at its next poll), then with both
  // writes on their way at once (each page sees the other's while its own is unacknowledged)
  {
    const lastKey = Object.keys(STORIES).at(-1), ctl = async p => JSON.parse(await stateOf(p));
    await until(A, k => HOST.curKey === k, lastKey, 5000);
    const s0 = await ctl(A), f = Object.keys(s0);
    // the first two fields of the state, each set to another of its control's options
    const other = (k, v) => `(GL.sets.${lastKey}.controls.find(c => c.key === '${k}').options.map(o => o[0]).find(o => o !== ${JSON.stringify(v)}))`;
    const twice = async (now, label) => {
      const a0 = await ctl(A), [va, vb] = [await peek(A, other(f[0], a0[f[0]])), await peek(B, other(f[1], a0[f[1]]))];
      const send = now ? `; HOST.collab.publish([['st.' + HOST.collab.live().id + '.x', HOST.cur.collab.state()]])` : '';
      await Promise.all([
        A.evaluate(([k, v, send]) => HOST.cur.peek(`setCtl('${HOST.curKey}', '${k}', '${v}')${send}`), [f[0], va, send]),
        B.evaluate(([k, v, send]) => HOST.cur.peek(`setCtl('${HOST.curKey}', '${k}', '${v}')${send}`), [f[1], vb, send]),
      ]);
      const both = (p, w) => until(p, ([a, b, va, vb]) => { const x = HOST.cur.collab.state(); return x[a] === va && x[b] === vb; }, [f[0], f[1], va, vb], 5000);
      const ok = await both(A) && await both(B) && await both(C);
      check(`two people change two controls at once (${label}): both changes stay, on every page`, ok,
        `want ${f[0]} ${va}, ${f[1]} ${vb}; A ${await stateOf(A)}, B ${await stateOf(B)}, C ${await stateOf(C)}`);
    };
    await twice(false, 'each at its next poll');
    await twice(true, 'both writes on their way');
  }

  // ------------------------------------------- switches and own choices --
  // two stations followed back to back on a page: the second is not lost while the first story loads
  {
    const lastKey = Object.keys(STORIES).at(-1), [k1, k2] = ['spatial', 'robots'].filter(k => k !== lastKey).concat(['airports']).slice(0, 2);
    const [i1, i2] = [await stationOf(B, k1), await stationOf(B, k2)];
    await B.evaluate(([a, b]) => { HOST.collab.follow(a); HOST.collab.follow(b); }, [i1, i2]);
    const sw = await until(B, ([k, id]) => HOST.curKey === k && !HOST.busy && HOST.collab.live() && HOST.collab.live().id === id, [k2, i2], 60000) && await ready(B, k2);
    check('a page that follows two stations back to back ends at the second (a switch while a story loads is not lost)', sw,
      `story ${await B.evaluate(() => HOST.curKey)}, live ${await B.evaluate(() => (HOST.collab.live() || {}).story)}`);
    // a story picked by hand (the Stories screen) leaves the station: no longer following, and not pulled back
    await B.evaluate(k => HOST.start(k), lastKey === 'airports' ? 'proteins' : 'airports');
    const own = lastKey === 'airports' ? 'proteins' : 'airports';
    await ready(B, own);
    const left = await B.evaluate(() => [HOST.collab.following(), HOST.collab.mine(), !!HOST.collab.live()]);
    const nudge = await stationOf(A, 'nmd');
    await A.evaluate(id => { const s = HOST.collab.station(id); HOST.collab.publish([['st.' + id, { story: s.story, x: s.x + 0.01, z: s.z, yaw: s.yaw }]]); }, nudge);
    await sleep(3500);
    const stay = await B.evaluate(() => HOST.curKey);
    check('a story picked by hand stops following the station, and a change in the room does not pull the page back', !left[0] && !left[1] && !left[2] && stay === own,
      `following ${left[0] || '-'}, mine ${left[1] || '-'}, live ${left[2]}, now ${stay}`);
    await A.evaluate(id => { const s = HOST.collab.station(id); HOST.collab.publish([['st.' + id, { story: s.story, x: s.x - 0.01, z: s.z, yaw: s.yaw }]]); }, nudge);
    await B.evaluate(id => HOST.collab.follow(id), await stationOf(B, lastKey));
    await ready(B, lastKey);
  }

  // ------------------------------------------------------ no ping-pong --
  await sleep(800);
  const q0 = (await roomInfo(code)).seq;
  await sleep(5000);
  const q1 = (await roomInfo(code)).seq;
  check('no ping-pong: no writes in 5 s of idle with three pages following', q1 === q0, `${q1 - q0} writes`);

  // ------------------------------------------------------- late joiner --
  // at the station page A followed last
  const key0 = Object.keys(STORIES).at(-1), id0 = await stationOf(A, key0);
  const D = await open('#s=' + code);
  await st7(D);
  await D.evaluate(i => HOST.collab.follow(i), id0);
  await ready(D, key0);
  const sA = await stateOf(A);
  check('a late joiner gets the stations, the clock and the explore state', await until(D, s => HOST.cur.peek('APP.mode') === 'explore' && JSON.stringify(HOST.cur.collab.state()) === s, sA, 5000),
    `A ${sA}, D ${await stateOf(D)}`);
  await D.context().close();

  // ---------------------------------------------------- relay restart --
  // (the headsets' labels on top first: the restarted relay gets the room's settings back too)
  await A.evaluate(() => HOST.xr.setLabels('face'));
  await until(A, () => !HOST.collab.internals().pending.size, null, 3000);
  const before = await roomInfo(code), keep = port;
  await stopRelay();
  await sleep(400);
  await startRelay(keep);
  const back = p => until(p, () => HOST.collab.status === 'open' && HOST.collab.stations().length === HOST.list.length, null, 25000);
  const allBack = (await Promise.all([A, ...others].map(back))).every(Boolean);
  const after = await roomInfo(code).catch(() => ({ keys: {} }));
  const kx = 'st.' + id0 + '.x';
  check('a relay restart is survived: the room comes back with its stations and state', allBack && Object.keys(after.keys || {}).filter(k => /^st\.[\w-]+$/.test(k)).length === NST &&
    JSON.stringify(after.keys[kx] && after.keys[kx].v) === JSON.stringify(before.keys[kx].v), JSON.stringify(after.keys && after.keys[kx]));
  await peek(A, STORIES[key0].change);
  const sR = await stateOf(A);
  check('and a change after the restart still reaches the others', await until(B, s => JSON.stringify(HOST.cur.collab.state()) === s, sR, 5000));
  let lookR = null;
  for (let k = 0; k < 25 && !lookR; k++) { const r = await roomInfo(code).catch(() => ({ keys: {} })); lookR = r.keys && r.keys.look && r.keys.look.v; if (!lookR) await sleep(200); }
  check('a relay restart keeps the headsets\' settings (labels on top here) for every page', !!lookR && lookR.labels === 'face' && lookR.free === true &&
    await lookIs(B, 'face,true') && await lookIs(C, 'face,true'), JSON.stringify({ lookR, B: await lookOf(B) }));
  await A.evaluate(() => HOST.xr.setLabels('fixed'));
  await lookIs(B, 'fixed,true'); await lookIs(C, 'fixed,true');

  // ------------------------------------------------- a pretend headset --
  const H = await open('#s=' + code);
  await st7(H);
  await ready(H, 'airports');
  const aId = await A.evaluate(() => HOST.collab.id);
  await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameFor(ROOM, 'U1', aId, Date.now() - 60000));
  await until(A, () => !HOST.collab.internals().pending.size, null, 3000);   // stored before the headset's writes are counted
  const xrOpts = { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [0, 1.6, 0, 0] };
  await H.evaluate(() => HOST.room.sharedAlign(true));   // aligning from the shared space is off unless asked for
  await H.evaluate(installXR, xrOpts);
  const q2 = (await roomInfo(code)).seq, hId0 = await H.evaluate(() => HOST.collab.id);
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 400);
  check('headset: waits for the shared space\'s id', await H.evaluate(() => HOST.room.state === 'shared-wait'), await H.evaluate(() => HOST.room.state));
  // the id arrives with the space's reset event, a moment later
  await H.evaluate(() => { const X = window.__xr; X.spaces.shared.UUId = 'U1'; for (const fn of X.resets.shared || []) fn({ transform: null }); });
  await frames(H, 300);
  const fr = await H.evaluate(() => HOST.room.frame && { o: HOST.room.frame.o, x: HOST.room.frame.x, src: HOST.room.src });
  const wantO = unapply(FLOOR, ROOM.slice(0, 3)), wantX = rot(-FLOOR[3], rot(ROOM[3], [1, 0, 0]));
  check('headset: aligns from the frame published for its shared space', fr && fr.src === 'adopted' && near(fr.o, [wantO[0], 0, wantO[2]], 1e-4) && near(fr.x, wantX, 1e-4),
    fr ? `${fr.src} o ${fmt(fr.o)} x ${fmt(fr.x)}, want o ${fmt(wantO)} x ${fmt(wantX)}` : 'no frame');
  // the menu is closed at the start of a session: only its clock shows (here beside the story panel: no left controller)
  const menu0 = await H.evaluate(() => { const O = HOST.collab.overlay(); return { open: HOST.collab.menu, clock: O.clockG.visible, panel: O.panelG.visible,
    regions: O.panel.regions.length, onHand: !!O.onHand, scale: O.clockG.scale.x, hit: O.hit.includes(O.clock.mesh) && !O.hit.includes(O.panel.mesh) }; });
  check('headset: the menu is closed at first, only its clock shows (beside the story panel without a left controller)', !menu0.open && menu0.clock && !menu0.panel &&
    !menu0.regions && !menu0.onHand && menu0.scale === 2 && menu0.hit, JSON.stringify(menu0));
  // the shared space as the relay logs caught Quest Browser: its pose at the head right after waking (not used,
  // nothing compared or published from it), and a space that is just this headset's own floor (named on the panel)
  const glitch = await H.evaluate(() => {
    const X = window.__xr, keep = X.W.shared, R = HOST.room.internals(), sa = R.sharedAlign;
    R.sharedAlign = false;   // the adopted frame stays put meanwhile
    X.head([-6, 1.6, 6, 0]);   // away from the stations (a second at one would make it the headset's)
    X.W.shared = X.W.head.clone(); X.step(); X.step();
    const atHead = !R.sharedOK && R.sharedHead && window.__collabLog.some(e => e.ev === 'shared at head');
    X.W.shared = X.W.floor.clone(); X.step(); X.step();
    const own = R.sharedOK && /your own floor/.test(HOST.room.sharedLine());
    X.W.shared = keep; X.step(); X.step();
    R.sharedAlign = sa;
    return { atHead, own, back: R.sharedOK && !R.sharedHead && !/your own floor/.test(HOST.room.sharedLine()) };
  });
  check('headset: a shared space at the head is not used, and one that is just its own floor is named on the panel', glitch.atHead && glitch.own && glitch.back, JSON.stringify(glitch));
  // standby with the shared space in use: the floor moves while the headset sleeps (a reset says how; Quest's floor
  // came back 12 to 17 cm off) and the shared space is wrong for a while: the frame the reset carried over holds;
  // once the space is back and agrees, the room is where it was, and at the same height as before
  const F6 = [FLOOR[0] + 0.5, -0.15, FLOOR[2] - 0.3, FLOOR[3] + 0.6], JUNK = [SHARED[0] + 0.8, 0, SHARED[2] - 0.4, SHARED[3] + 0.35];
  const sleepWake = (F, S) => H.evaluate(([F, S]) => {
    const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z);
    const M = a => new THREE.Matrix4().compose(V(a[0], a[1], a[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a[3]), V(1, 1, 1));
    X.visibility('hidden'); X.floorReset(F, 0.2); X.W.shared = M(S); X.visibility('visible');
    for (let k = 0; k < 20; k++) X.step();
    return { src: HOST.room.src, frame: HOST.room.frame && { o: HOST.room.frame.o.slice(), x: HOST.room.frame.x.slice() }, held: window.__collabLog.slice(-40).some(e => e.ev === 'shared held after wake') };
  }, [F, S]);
  const spaceBack = S => H.evaluate(S => {
    const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z);
    X.W.shared = new THREE.Matrix4().compose(V(S[0], S[1], S[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), S[3]), V(1, 1, 1));
    for (const fn of X.resets.shared || []) fn({ transform: null });
    HOST.room.internals().visibleAt -= 21000;   // (nothing is let go within 20 s of waking)
  }, S);
  const held6 = await sleepWake(F6, JUNK);
  await spaceBack(SHARED);
  await frames(H, 800);
  const back6 = await H.evaluate(() => ({ src: HOST.room.src, frame: HOST.room.frame, note: HOST.room.floorNote(), after: window.__collabLog.filter(e => e.ev === 'shared after wake').slice(-1)[0] || null }));
  const w6 = unapply(F6, ROOM.slice(0, 3)), x6 = rot(-F6[3], rot(ROOM[3], [1, 0, 0]));
  check('headset: after standby, while the shared space is wrong, the frame the floor\'s reset carried over holds', held6.src === 'adopted' && held6.held && !!held6.frame &&
    near([held6.frame.o[0], held6.frame.o[2]], [w6[0], w6[2]], 2e-3) && near(held6.frame.x, x6, 2e-3), JSON.stringify(Object.assign(held6, { want: [w6, x6] })));
  check('headset: once the shared space agrees again the room is where it was, at the same height though the floor moved 15 cm', back6.src === 'adopted' &&
    near(back6.frame.o, [w6[0], 0.15, w6[2]], 2e-3) && near(back6.frame.x, x6, 2e-3) && !!back6.after && back6.after.agree && /floor moved 15 cm down/.test(back6.note),
    JSON.stringify(Object.assign(back6, { want: [w6, x6] })));
  await sleepWake(FLOOR, SHARED);   // and back to the floor the rest expects
  await H.evaluate(() => { HOST.room.internals().visibleAt -= 21000; });   // (held for 20 s after waking, at the height it had)
  await frames(H, 800);
  check('headset: woken again on the first floor, the room is back on it', near(await H.evaluate(() => HOST.room.frame.o), [wantO[0], 0, wantO[2]], 2e-3),
    fmt(await H.evaluate(() => HOST.room.frame.o)));
  // Re-align by hand (in the menu): a headset left offset (as one was after a long standby) goes back to the
  // room's frame through the shared space, which is asked for again
  const qA = (await roomInfo(code)).seq;   // (the room's frame is written on purpose from here to qB)
  const ra = await H.evaluate(async () => {
    const X = window.__xr, R = HOST.room.internals();
    X.head([-6, 1.6, 6, 0]);   // away from the stations
    const good = R.frame.o.slice(), t = performance.now();
    R.frame.o[0] += 0.6; R.frame.o[2] -= 0.4; R.wakeHold = t; R.stillSince = t;   // offset, and held as after waking
    for (let k = 0; k < 3; k++) X.step();
    const off = Math.hypot(R.frame.o[0] - good[0], R.frame.o[2] - good[2]);
    HOST.collab.panelOpen(true); X.step(); X.step();
    const S = HOST.collab.overlay().panel, last = S.regions.find(x => x.id === 'col:7'), fits = !!last && last.y + last.h <= S.h;   // the whole panel on its canvas
    const r = S.regions.find(x => x.id === 'realign');
    if (r) r.fn();
    // (it waits up to 3 s for the room's frame written again, which a page without a headset never does)
    for (let k = 0; k < 70; k++) { X.step(); await new Promise(res => setTimeout(res, 60)); if (!R.again) break; }
    HOST.collab.panelOpen(false);
    return { region: !!r, fits, off, d: Math.hypot(R.frame.o[0] - good[0], R.frame.o[2] - good[2]), src: R.src, again: R.again,
      asked: window.__collabLog.some(e => e.ev === 'shared asked again' && e.why === 'realign'), note: (window.__collabLog.filter(e => e.ev === 'notice').slice(-1)[0] || {}).title };
  });
  check('Re-align: an offset headset goes back to the room\'s frame through the shared space, asked for again (the panel fits its canvas)', ra.region && ra.fits && ra.off > 0.5 && ra.d < 2e-3 &&
    ra.src === 'adopted' && !ra.again && ra.asked && ra.note === 'Re-aligned', JSON.stringify(ra));
  // back from standby but still not in the others' space 15 s later (here: no pose but the head's): asked for again
  const rq = await H.evaluate(async () => {
    const X = window.__xr, R = HOST.room.internals(), keep = X.W.shared;
    X.visibility('hidden'); X.visibility('visible');
    X.W.shared = X.W.head.clone(); X.step(); X.step();
    R.visibleAt -= 16000; X.step(); X.step();
    await new Promise(res => setTimeout(res, 50));
    X.step(); X.step();
    const asked = window.__collabLog.filter(e => e.ev === 'shared asked again' && e.why === 'wake').length;
    X.W.shared = keep; R.visibleAt -= 21000;
    return { asked };
  });
  await frames(H, 600);
  check('after standby, a headset still outside the shared space 15 s later asks for it again (once)', rq.asked === 1, JSON.stringify(rq));
  // after a night the shared space may come back made again under the same id. A follower holds the room where it
  // was rather than take last night's frame through the new space, and follows the room's frame once its writer has
  // written it again since
  const frameIn = (S, P, uuid, by, g, p) => ({ uuid, o: unapply(S, [P[0], P[1], P[2]]), x: rot(-S[3], rot(P[3], [1, 0, 0])), by, g, at: Date.now() - 60000, p });
  const F8 = [FLOOR[0] + 0.3, 0, FLOOR[2] + 0.5, FLOOR[3] + 0.4], NEWS = [SHARED[0] + 1.3, 0, SHARED[2] - 0.6, SHARED[3] - 0.8], ROOM2 = [ROOM[0] + 0.5, 0, ROOM[2] - 0.4, ROOM[3] + 0.2];
  const inFloor = (F, P) => [unapply(F, P.slice(0, 3)), rot(-F[3], rot(P[3], [1, 0, 0]))];
  const nap = (F, S) => H.evaluate(([F, S]) => {
    const X = window.__xr, R = HOST.room.internals(), V = (x, y, z) => new THREE.Vector3(x, y, z);
    const M = a => new THREE.Matrix4().compose(V(a[0], a[1], a[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a[3]), V(1, 1, 1));
    X.visibility('hidden'); X.floorReset(F, 0.1); X.W.shared = M(S); X.visibility('visible');
    for (let k = 0; k < 4; k++) X.step();
    R.visibleAt -= 21000; R.stillSince -= 6000;   // settled, and the space still for 5 s
    for (let k = 0; k < 4; k++) X.step();
    return { src: R.src, o: R.frame.o.slice(), x: R.frame.x.slice(), hold: !!R.wakeHold, held: window.__collabLog.slice(-30).some(e => e.ev === 'shared held after wake') };
  }, [F, S]);
  const fz = await nap(F8, NEWS), [fo8, fx8] = inFloor(F8, ROOM);
  check('after a night, a follower holds the room where it was rather than take last night\'s frame through a space made again', fz.src === 'adopted' && fz.hold && fz.held &&
    near([fz.o[0], fz.o[2]], [fo8[0], fo8[2]], 2e-3) && near(fz.x, fx8, 2e-3), JSON.stringify(Object.assign(fz, { want: [fo8, fx8] })));
  await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), Object.assign(f, { p: Math.round(HOST.collab.now()) })]]), frameIn(NEWS, ROOM2, 'U1', aId, 'shared'));
  await frames(H, 400);
  const fw2 = await H.evaluate(() => ({ src: HOST.room.src, o: HOST.room.frame.o.slice(), x: HOST.room.frame.x.slice(), hold: !!HOST.room.internals().wakeHold })), [fo2, fx2] = inFloor(F8, ROOM2);
  check('and follows the room\'s frame once its writer has written it into the space again', fw2.src === 'adopted' && !fw2.hold && near([fw2.o[0], fw2.o[2]], [fo2[0], fo2[2]], 2e-3) &&
    near(fw2.x, fx2, 2e-3), JSON.stringify(Object.assign(fw2, { want: [fo2, fx2] })));
  // the room's frame written by this headset itself, after a night in a space made again: written into the new space
  // as it was held, so whoever is in that space finds the room where it was
  const hIdW = await H.evaluate(() => HOST.collab.id), F9 = [FLOOR[0] - 0.4, 0, FLOOR[2] + 0.2, FLOOR[3] - 0.6], NEW9 = [SHARED[0] - 0.7, 0, SHARED[2] + 0.9, SHARED[3] + 1.1];
  await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameIn(NEWS, ROOM2, 'U1', hIdW, 'shared'));
  await frames(H, 300);
  const rp = await H.evaluate(async ([F9, NEW9]) => {
    const X = window.__xr, R = HOST.room.internals(), V = (x, y, z) => new THREE.Vector3(x, y, z), key = HOST.room.frameKey('U1');
    const M = a => new THREE.Matrix4().compose(V(a[0], a[1], a[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a[3]), V(1, 1, 1));
    const world = () => V(R.frame.o[0], 0, R.frame.o[2]).applyMatrix4(X.W.floor), w0 = world();
    X.visibility('hidden'); X.floorReset(F9, 0.1); X.W.shared = M(NEW9); X.visibility('visible');
    for (let k = 0; k < 4; k++) X.step();
    R.visibleAt -= 21000; R.stillSince -= 6000;
    for (let k = 0; k < 4; k++) { X.step(); await new Promise(res => setTimeout(res, 20)); }
    const P = HOST.collab.val(key);
    return { held: world().distanceTo(w0), sent: V(...P.o).applyMatrix4(X.W.shared).setY(0).distanceTo(w0.clone().setY(0)), by: P.by === HOST.collab.id, fresh: !!P.p,
      hold: !!R.wakeHold, rep: window.__collabLog.slice(-40).some(e => e.ev === 'shared after wake' && e.republished) };
  }, [F9, NEW9]);
  check('after a night, the room\'s frame written by this headset goes into the space made again as it was held', rp.held < 2e-3 && rp.sent < 2e-3 && rp.by && rp.fresh &&
    !rp.hold && rp.rep, JSON.stringify(rp));
  // back to the room as the rest expects: the space where it was, the room's frame by A, the first floor
  await spaceBack(SHARED);
  await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameFor(ROOM, 'U1', aId, Date.now() - 60000));
  await sleepWake(FLOOR, SHARED);
  await H.evaluate(() => HOST.room.realignNow());
  for (let k = 0; k < 10 && !(await H.evaluate(() => !HOST.room.internals().again)); k++) await frames(H, 500);
  const rb = await H.evaluate(() => ({ src: HOST.room.src, o: HOST.room.frame.o }));
  check('and back in the room\'s space, it takes the room\'s frame again', rb.src === 'adopted' && near([rb.o[0], rb.o[2]], [wantO[0], wantO[2]], 2e-3), JSON.stringify(rb));
  const qB = (await roomInfo(code)).seq;
  // walk to the headset story's station: after a second there it becomes this headset's story, placed at the station
  const stationFor = async k => { const s = await H.evaluate(k => HOST.collab.stations().find(s => s.story === k) || null, k); if (!s) throw new Error('no station for ' + k); return s; };
  const S1 = await stationFor(HEADSET_STORY);
  const switched = await walk(H, S1, HEADSET_STORY, 0.4);
  const rig = await rigOf(H), want = rigAt(S1);
  check('headset: a second at a station switches to its story, which stands at the station', switched && near(rig.slice(0, 3), want.slice(0, 3), 1e-4) && angle(rig[3], want[3]) < 1e-4,
    `story ${await H.evaluate(() => HOST.curKey)}, rig ${fmt(rig)}, want ${fmt(want)}`);
  // the headset recentres (its local origin moves; the story's own reset listener asks to recentre): the story
  // stays at its station, placed there again every frame
  const relocal = L => H.evaluate(L => {
    const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z);
    X.W.local = new THREE.Matrix4().compose(V(L[0], L[1], L[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), L[3]), V(1, 1, 1));
    for (const fn of X.resets.local || []) fn({ transform: null });
  }, L);
  const L2 = [LOCAL[0] + 0.7, LOCAL[1], LOCAL[2] - 0.4, LOCAL[3] + 0.9];
  await relocal(L2); await frames(H, 250);
  const rigR = await rigOf(H), wantR = rigAt(S1, L2);
  await relocal(LOCAL); await frames(H, 250);
  check('headset: when the headset recentres, the story stays at its station', near(rigR.slice(0, 3), wantR.slice(0, 3), 1e-4) && angle(rigR[3], wantR[3]) < 1e-4,
    `rig ${fmt(rigR)}, want ${fmt(wantR)}`);
  // taken off for more than 3 s and put on again: outside a room the story would restart for a new wearer on its
  // Stories screen; at a station it stays, and nothing is written (the station's clock and state go on applying)
  const q3 = (await roomInfo(code)).seq;
  await H.evaluate(() => window.__xr.visibility('hidden'));
  await sleep(3300);
  await H.evaluate(() => window.__xr.visibility('visible'));
  await frames(H, 600);
  const q4 = (await roomInfo(code)).seq, modeBack = await H.evaluate(() => HOST.cur.peek('APP.mode'));
  check('headset: taken off and put on again, it writes nothing and takes the station\'s clock again', q4 === q3 && modeBack === 'explore', `${q4 - q3} writes, mode ${modeBack}`);
  const onAgain = await H.evaluate(() => [HOST.curKey, HOST.cur.peek('XR.stories'), HOST.collab.mine()]);
  check('headset: and it stays in its story at its station (no Stories screen)', onAgain[0] === HEADSET_STORY && onAgain[1] === false && onAgain[2] === S1.id, JSON.stringify(onAgain));
  check('headset: at the station, HOST.anchor holds the place; the grip may move the panel and the scene (for everyone), not the shell\'s things',
    await H.evaluate(() => HOST.anchor.held() && !HOST.anchor.locked('globe') && !HOST.anchor.locked('panel') && HOST.anchor.locked('shell') && HOST.room.inRoom()));
  const since = e => (e.seq > q2 && e.seq <= qA) || e.seq > qB;   // (not the writes the standby tests made on purpose)
  const wrote = Object.entries((await roomInfo(code)).keys).filter(([, e]) => since(e)).map(([k, e]) => `${k} by ${e.by === hId0 ? 'the headset' : e.by}`);
  const wroteWhy = wrote.length ? ' ' + JSON.stringify(Object.entries((await roomInfo(code)).keys).filter(([, e]) => since(e)).map(([k, e]) => [k, e.seq, e.v])) + ' ' +
    await H.evaluate(() => JSON.stringify(window.__collabLog.filter(e => /publish|switch|attach|apply|recv|go|station|adopt|hold/.test(e.ev)).slice(-40).map(e => [e.t, e.ev, e.keys || e.st || e.story || e.id || '']))) : '';
  check('headset: arriving at a station and starting a session write nothing', !wrote.length, wrote.join(', ') + wroteWhy);
  check('headset: the station\'s clock and state apply there', await until(H, s => HOST.cur.peek('APP.mode') === 'explore' && JSON.stringify(HOST.cur.collab.state()) === s, await stateOf(A), 2000));
  // a session begun on the headset's Stories screen at a station: its card (Start) goes into the story as the
  // room has it, and restarts nothing for the others
  const q5 = (await roomInfo(code)).seq;
  await H.evaluate(() => HOST.cur.peek('(XR.stories = true, XR.inStory = false, xrLandingClose())'));
  await frames(H, 400);
  const q6 = (await roomInfo(code)).seq, card = await H.evaluate(() => HOST.cur.peek('[APP.mode, XR.stories]')), modeA = (await clockOf(A))[0];
  check('headset: Start on its Stories screen at a station restarts nothing (no writes, still exploring)', q6 === q5 && card[0] === 'explore' && card[1] === false && modeA === 'explore',
    `${q6 - q5} writes, headset ${card}, A ${modeA}`);
  // a ray: the others see it in room coordinates
  const ow = apply(ROOM, [S1.x + 0.2, 1.3, S1.z - 0.1]), dw = unit([0.3, -0.2, -1]);
  await H.evaluate(([o, d]) => window.__xr.ctrl(0, o, d), [ow, dw]);
  const hId = await H.evaluate(() => HOST.collab.id);
  let seen = null;   // presence goes out 15 times a second; a busy machine may take a while to show it
  for (let k = 0; k < 8 && !(seen && seen.hands.length); k++) {
    await frames(H, 400);
    seen = await A.evaluate(id => { const P = HOST.collab.people().get(id); return P && P.head ? { head: P.head, hands: P.hands, st: P.st } : null; }, hId);
  }
  const wantRay = [...unapply(ROOM, ow), ...rot(-ROOM[3], dw)], headRoom = unapply(ROOM, headAt(S1));
  check('headset: its rays reach the others in room coordinates', seen && seen.hands.length === 1 && near(seen.hands[0].slice(0, 6), wantRay, 3e-3) && seen.hands[0][6] > 0,
    seen ? `got ${fmt(seen.hands[0] || [])}, want ${fmt(wantRay)}` : 'no presence');
  check('headset: and its head, and the station it is at', seen && near(seen.head.slice(0, 3), headRoom, 3e-3) && seen.st === S1.id);
  // another person's presence (a headset elsewhere, in room coordinates) is drawn in this headset's room: the
  // ray from its hand along its direction to its length, a dot at the end, a name tag; an avatar (not here)
  const drawn = await H.evaluate(async () => {
    const C = HOST.collab.internals(), R = HOST.room.internals(), id = 'zz-test';
    const put = () => {
      if (!C.members.some(m => m.id === id)) C.members.push({ id, name: 'Test', color: '#ff7a59', kind: 'vr', here: false });
      C.pres.set(id, { id, at: performance.now(), st: '', head: [1, 1.6, -2, 0, 0, 0, 1], hands: [[1.2, 1.3, -2.1, 0.6, 0, -0.8, 2]] });
    };
    for (let k = 0; k < 30; k++) { put(); window.__xr.step(); await new Promise(r => setTimeout(r, 10)); }
    const o = HOST.collab.overlay().people.get(id);
    if (!o) return null;
    o.g.updateMatrixWorld(true);
    const a = new THREE.Vector3(0, 0, 0).applyMatrix4(o.rays[0].matrixWorld), b = new THREE.Vector3(0, 0, 1).applyMatrix4(o.rays[0].matrixWorld);
    const toRoom = v => v.clone().applyMatrix4(R.mi).toArray();
    const out = { from: toRoom(a), to: toRoom(b), dot: toRoom(o.dots[0].getWorldPosition(new THREE.Vector3())), avatar: o.avatar.visible, tag: o.name };
    C.pres.delete(id); C.members = C.members.filter(m => m.id !== id);
    return out;
  });
  const rayEnd = [1.2 + 0.6 * 2, 1.3, -2.1 - 0.8 * 2];
  check('headset: another person\'s ray, dot, tag and avatar are drawn where they are in the room', drawn && near(drawn.from, [1.2, 1.3, -2.1], 1e-3) && near(drawn.to, rayEnd, 1e-3) &&
    near(drawn.dot, rayEnd, 1e-3) && drawn.avatar && drawn.tag === 'Test', JSON.stringify(drawn));
  // the sound zone: the narration comes from the station's content (a panner there, the listener at your head)
  // and the <audio> element plays fainter with distance
  const cz = [S1.x - 1.4 * Math.sin(S1.yaw), 1.4, S1.z - 1.4 * Math.cos(S1.yaw)], czLocal = unapply(LOCAL, apply(ROOM, cz));
  const headLocal = unapply(LOCAL, headAt(S1)), dz = Math.hypot(...czLocal.map((v, i) => v - headLocal[i])), vol = Math.min(1, 1.5 / (1.5 + 2.5 * Math.max(0, dz - 1.5)));
  const zone = await H.evaluate(() => { const A = HOST.audio.state(), p = A.pan, L = A.ctx && A.ctx.listener;
    return { pan: p ? [p.positionX.value, p.positionY.value, p.positionZ.value] : null, ear: L ? [L.positionX.value, L.positionY.value, L.positionZ.value] : null, vol: A.el.volume, model: p && p.panningModel,
      refDistance: p && p.refDistance }; });
  check('headset: the sound zone puts the narration at the station, at full volume at its spot', zone.pan && zone.model === 'HRTF' && near(zone.pan, czLocal, 1e-3) &&
    near(zone.ear, headLocal, 1e-3) && Math.abs(zone.vol - vol) < 0.012 && vol === 1 && zone.refDistance === 1.5, `${JSON.stringify(zone)}, want ${fmt(czLocal)} at volume ${vol.toFixed(3)}`);
  // pointing with the trigger: the menu's clock (it opens the menu) and another station's card take the press
  const press = async target => {
    await H.evaluate(t => {
      const X = window.__xr, c = HOST.cur.peek('XR.ctrls')[0], V = THREE.Vector3;
      const head = new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert());
      const o = head.clone().add(new V(0.12, -0.3, -0.1)), d = new V(...t).sub(o).normalize();
      c.src = c.src || { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: null };
      c.g.visible = true;
      c.g.matrix.compose(o, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), d), new V(1, 1, 1));
      c.wantPress = true;
    }, target);
    await frames(H, 150);
  };
  const openAt = await H.evaluate(() => { const O = HOST.collab.overlay(); return !HOST.collab.menu && O.clockG.visible ? O.clockG.getWorldPosition(new THREE.Vector3()).toArray() : null; });
  if (openAt) await press(openAt);
  const opened = await H.evaluate(() => { const O = HOST.collab.overlay(); return { open: HOST.collab.menu, panel: O.panelG.visible, vis: O.panel.vis, ids: O.panel.regions.map(r => r.id) }; });
  check('headset: the trigger on the menu\'s clock (beside the story panel) opens the menu: Close in its header, Exit inside', !!openAt && opened.open && opened.panel && opened.vis > 200 &&
    opened.ids.includes('close') && opened.ids.includes('exit') && !opened.ids.includes('open'), JSON.stringify(opened));
  await H.evaluate(() => HOST.collab.panelOpen(false));
  await frames(H, 150);
  // a station's card 1 m behind the story's own panel: the panel takes the ray (it is nearer, and drawn on top);
  // without the panel in front the card would have taken it
  const depth = await H.evaluate(async () => {
    const C = HOST.collab.internals(), R = HOST.room.internals(), V = THREE.Vector3, X = window.__xr;
    const P = HOST.cur.peek('XR.main && XR.main.mesh');
    if (!P || !P.visible) return { err: 'no story panel' };
    const pc = P.getWorldPosition(new V()), head = new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert());
    // in the room: the card's centre 1 m on along the line from the head through the panel, level, facing back
    const pr = pc.clone().applyMatrix4(R.mi), hr = head.clone().applyMatrix4(R.mi), dir = pr.clone().sub(hr).setY(0).normalize();
    const cc = pr.clone().addScaledVector(dir, 1); cc.y = 1.45;
    // its spot further on (facing back), so the headset does not walk into it
    const yaw = Math.atan2(dir.x, dir.z), id = 'zzdepth', st = { id, story: 'robots', x: cc.x + 1.4 * Math.sin(yaw), z: cc.z + 1.4 * Math.cos(yaw), yaw };
    C.st.push(st); C.stById.set(id, st);
    for (let k = 0; k < 3; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); }
    const card = HOST.collab.overlay().cards.get(id);
    if (!card) return { err: 'no card' };
    const cw = card.mesh.getWorldPosition(new V()), d = cw.clone().sub(pc).normalize(), o = pc.clone().addScaledVector(d, -0.6);
    const c = HOST.cur.peek('XR.ctrls')[0];
    c.src = c.src || { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: null };
    c.g.visible = true; c.g.matrix.compose(o, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), d), new V(1, 1, 1));
    for (let k = 0; k < 3; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); }
    const kind = c.hover && c.hover.kind, alone = HOST.collab.ray(0, o, d), behind = HOST.collab.ray(0, o, d, 0.6);
    C.st.splice(C.st.indexOf(st), 1); C.stById.delete(id);
    c.g.visible = false; c.src = null;
    for (let k = 0; k < 2; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); }
    return { kind, alone: alone && alone.dist, behind: !!behind, toCard: cw.distanceTo(o) };
  });
  check('headset: the story\'s own panel in front of a station\'s card takes the ray (the card alone would)', depth.kind === 'panel' && depth.alone && Math.abs(depth.alone - depth.toCard) < 0.05 && !depth.behind,
    JSON.stringify(depth));
  const SP = await stationFor(PICK_STORY);
  const cardAt = await H.evaluate(id => { const c = HOST.collab.overlay().cards.get(id); return c ? c.mesh.getWorldPosition(new THREE.Vector3()).toArray() : null; }, SP.id);
  if (cardAt) await press(cardAt);
  let picked = !!cardAt && await until(H, k => HOST.curKey === k, PICK_STORY, 15000) && await ready(H, PICK_STORY, 40000);
  if (picked) { await H.evaluate(() => HOST.cur.peek('xrAdopt()')); await frames(H, 200); }
  const rigP = await rigOf(H), wantP = rigAt(SP);
  check(`headset: pointing at a station's card and pulling the trigger goes there (${PICK_STORY}, placed at its station)`, picked && near(rigP.slice(0, 3), wantP.slice(0, 3), 1e-4),
    `story ${await H.evaluate(() => HOST.curKey)}, rig ${fmt(rigP)}, want ${fmt(wantP)}, card ${cardAt && fmt(cardAt)}; ` +
    await H.evaluate(() => JSON.stringify(window.__collabLog.slice(-8).map(e => [e.ev, e.id || e.st || e.story || '']))));
  // the grip on another station's card picks it up: pointed 20 degrees further left it swings round the hand, raised
  // 10 degrees it goes further, a twist of the wrist turns it; the room has it while it moves (ten times a second)
  // and where it is put down; when someone else moves it, its ring here glides there
  const SM = await stationFor(MOVE_STORY);
  const grabStep = (what, deg) => H.evaluate(async ([id, what, deg]) => {
    const X = window.__xr, V = THREE.Vector3, Q = THREE.Quaternion, rad = deg * Math.PI / 180;
    const run = async ms => { const t0 = performance.now(); while (performance.now() - t0 < ms) { X.step(); await new Promise(r => setTimeout(r, 16)); } };
    const G = window.__grab = window.__grab || {};
    if (what === 'aim') {
      const card = HOST.collab.overlay().cards.get(id);
      if (!card) return { err: 'no card' };
      const head = new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert());
      G.o = head.clone().add(new V(0.12, -0.3, -0.1));
      G.q = new Q().setFromUnitVectors(new V(0, 0, -1), card.mesh.getWorldPosition(new V()).sub(G.o).normalize());
    } else if (what === 'swing') G.q.premultiply(new Q().setFromAxisAngle(new V(0, 1, 0), rad));
    else if (what === 'raise') { const f = new V(0, 0, -1).applyQuaternion(G.q); G.q.premultiply(new Q().setFromAxisAngle(f.cross(new V(0, 1, 0)).normalize(), rad)); }
    else if (what === 'twist') G.q.premultiply(new Q().setFromAxisAngle(new V(0, 0, -1).applyQuaternion(G.q), rad));
    if (G.o) X.aim(0, new THREE.Matrix4().compose(G.o, G.q, new V(1, 1, 1)));
    if (what === 'grip') { X.step(); X.fire('squeezestart', { inputSource: X.session.inputSources[0] }); }   // (a grip comes between frames, on a fresh hover)
    if (what === 'let go') X.fire('squeezeend', { inputSource: X.session.inputSources[0] });
    await run(what === 'aim' ? 200 : 400);
    const h = HOST.collab.internals().hov.get(0), o = HOST.room.toRoom(G.o.clone());
    return { hov: h && h.target.kind === 'station' ? h.target.id : '', moving: HOST.room.moving, hand: [o.x, o.z], st: HOST.collab.station(id) };
  }, [SM.id, what, deg || 0]);
  const g0 = await grabStep('aim'), g1 = await grabStep('grip');
  const sM0 = g1.st, vM0 = [sM0.x - g1.hand[0], 0, sM0.z - g1.hand[1]], deg = d => d * Math.PI / 180;
  const g2 = await grabStep('swing', 20);
  const vM1 = rot(deg(20), vM0), wM1 = [g1.hand[0] + vM1[0], g1.hand[1] + vM1[2], sM0.yaw + deg(20)];
  const seenA = await until(A, ([id, w]) => { const s = HOST.collab.station(id); return !!s && Math.hypot(s.x - w[0], s.z - w[1]) < 0.01; }, [SM.id, wM1], 3000);
  await grabStep('raise', 10);
  await grabStep('twist', 30);
  const g5 = await grabStep('let go');
  const kM2 = Math.exp(2 * deg(10)), wantM = [g1.hand[0] + vM1[0] * kM2, g1.hand[1] + vM1[2] * kM2, Math.atan2(Math.sin(sM0.yaw + deg(20) - deg(30)), Math.cos(sM0.yaw + deg(20) - deg(30)))];
  const putA = await until(A, ([id, w]) => { const s = HOST.collab.station(id); return !!s && Math.hypot(s.x - w[0], s.z - w[1]) < 0.01 && Math.abs(Math.sin(s.yaw - w[2])) < 0.01; }, [SM.id, wantM], 3000);
  check('headset: the grip on a station\'s card picks it up (its story does not move), pointing swings it round, and the others see it move',
    g0.hov === SM.id && g1.moving === SM.id && !(await H.evaluate(() => HOST.cur.peek('XR.ctrls[0].grab'))) && !!g2.st && Math.hypot(g2.st.x - wM1[0], g2.st.z - wM1[1]) < 0.01 && seenA,
    JSON.stringify({ hov: g0.hov, moving: g1.moving, st: g2.st, want: wM1, seenA }));
  check('headset: raised it goes further, a twist of the wrist turns it, and the room has it where it is put down', putA && !g5.moving &&
    Math.hypot(g5.st.x - wantM[0], g5.st.z - wantM[1]) < 0.01 && Math.abs(Math.sin(g5.st.yaw - wantM[2])) < 0.01, JSON.stringify({ st: g5.st, want: wantM, putA }));
  await A.evaluate(s => HOST.collab.publish([['st.' + s.id, { story: s.story, x: s.x, z: s.z, yaw: s.yaw }]]), sM0);
  await until(H, ([id, x]) => { const s = HOST.collab.station(id); return !!s && Math.abs(s.x - x) < 1e-6; }, [SM.id, sM0.x], 3000);
  const glide = await H.evaluate(async ([id, x, z]) => {
    const X = window.__xr, ring = () => { const g = HOST.collab.overlay().rings.get(id).g; return Math.hypot(g.position.x - x, g.position.z - z); };
    const before = ring(); X.step(); const one = ring();
    let n = 1;   // (in frames: a slow machine draws few, and each eases at most a tenth of a second's worth)
    for (; n < 120 && ring() > 0.002; n++) { X.step(); await new Promise(r => setTimeout(r, 16)); }
    return { before, one, after: ring(), frames: n };
  }, [SM.id, sM0.x, sM0.z]);
  check('headset: a station someone else moves glides to its new place here', glide.before > 0.5 && glide.one > 0.02 && glide.one < glide.before && glide.after < 0.002 && glide.frames > 2, JSON.stringify(glide));
  // the layout lock: locked from a page, the grip moves no station and Arrange all is refused; unlocked with the
  // headset panel's button, for everyone
  await A.evaluate(() => HOST.collab.lock(true));
  const lockSeen = await until(H, () => HOST.collab.locked, null, 3000);
  const lk0 = await grabStep('aim'), lk1 = await grabStep('grip');
  await grabStep('let go');
  const arrRefused = await H.evaluate(() => { const before = JSON.stringify(HOST.collab.stations()); HOST.collab.arrange({ x: 5, z: 5, yaw: 0 }); return before === JSON.stringify(HOST.collab.stations()); });
  await H.evaluate(() => HOST.collab.panelOpen(true));
  await frames(H, 300);
  const unlockBtn = await H.evaluate(() => { const r = HOST.collab.overlay().panel.regions.find(x => x.id === 'lock'); if (!r || !r.fn) return false; r.fn(); return true; });
  const unlocked = await until(A, () => !HOST.collab.locked, null, 3000);
  await H.evaluate(() => HOST.collab.panelOpen(false));
  check('headset: the layout lock (from a page) stops the grip moving a station and Arrange all; the headset panel\'s button unlocks it for everyone',
    lockSeen && lk0.hov === SM.id && !lk1.moving && !!lk1.st && Math.abs(lk1.st.x - lk0.st.x) < 1e-6 && arrRefused && unlockBtn && unlocked,
    JSON.stringify({ lockSeen, hov: lk0.hov, moving: lk1.moving, arrRefused, unlockBtn, unlocked }));
  // the menu's clock rides on the left controller (behind its grip and above it, turned to the eyes); a click of the
  // left stick opens the menu above the clock and closes it again; a touch of the right controller's tip opens it,
  // and takes another touch only once moved 7 cm away; with tracked hands the clock sits on the left wrist, the right
  // index fingertip opens it and presses the menu's buttons by touch; without a left controller or hand the clock
  // goes back beside the story panel
  const hand = await H.evaluate(async () => {
    const X = window.__xr, V = THREE.Vector3, M4 = THREE.Matrix4, O = HOST.collab.overlay(), g = O.clockG, S = O.panel;
    const steps = async n => { for (let k = 0; k < n; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); } };
    HOST.collab.panelOpen(false);
    const head = new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert()), lp = head.clone().add(new V(-0.2, -0.35, -0.3));
    X.aim(1, new M4().compose(lp, new THREE.Quaternion(), new V(1, 1, 1)));
    await steps(4);
    const out = { closed: !HOST.collab.menu && g.visible && !O.panelG.visible, c: g.position.toArray(), want: lp.clone().add(new V(0, 0.05, 0.05)).toArray(), scale: g.scale.x,
      facing: new V(0, 0, 1).applyQuaternion(g.quaternion).dot(head.clone().sub(g.position).normalize()) };
    // the left stick's click (button 3), pressed and let go: open; again: closed
    const btn = { pressed: false };
    X.session.inputSources[1].gamepad = { buttons: [{}, {}, {}, btn], axes: [0, 0, 0, 0], hapticActuators: [] };
    await steps(2);
    btn.pressed = true; await steps(2); out.stick = HOST.collab.menu; btn.pressed = false; await steps(3);
    const vh = S.mw * S.vis / S.w * O.panelG.scale.x;
    out.above = O.panelG.visible && Math.abs(O.panelG.position.y - vh - (g.position.y + 0.065)) < 1e-3 && Math.hypot(O.panelG.position.x - g.position.x, O.panelG.position.z - g.position.z) < 1e-6;
    out.pscale = O.panelG.scale.x;
    out.ids = S.regions.map(r => r.id).slice(0, 3);
    btn.pressed = true; await steps(2); btn.pressed = false; await steps(2);
    out.stickClosed = !HOST.collab.menu && !O.panelG.visible;
    // the right controller's tip: 10 cm off (armed), 2 cm (opens), 5 cm and 2 cm again (no second touch), away and back (closes)
    const at = d => X.aim(0, new M4().compose(g.position.clone().add(new V(d, 0, 0)), new THREE.Quaternion(), new V(1, 1, 1)));
    at(0.1); await steps(2); at(0.02); await steps(2); out.touch = HOST.collab.menu;
    at(0.05); await steps(2); at(0.02); await steps(2); out.held = HOST.collab.menu;
    at(0.1); await steps(2); at(0.02); await steps(2); out.touchClosed = !HOST.collab.menu;
    at(0.3); await steps(2);
    // the tip touching the clock and pointing at it as the trigger is pulled: one toggle, not two (open, then shut)
    const nMenu = () => window.__collabLog.filter(e => e.ev === 'menu').length;
    const aimAt = d => { const c = g.position.clone(), dir = c.clone().sub(head).normalize();
      X.aim(0, new M4().compose(c.clone().addScaledVector(dir, -d), new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), dir), new V(1, 1, 1))); };
    aimAt(0.15); await steps(3);
    const m0 = nMenu();
    aimAt(0.025); await steps(3); HOST.cur.peek('XR.ctrls')[0].wantPress = true; await steps(4);
    out.touchTrigger = [HOST.collab.menu, nMenu() - m0];
    HOST.collab.panelOpen(false); aimAt(0.15); await steps(3);
    // the right grip held (carrying something, or both grips resizing the scene) or calibrating: a touch does nothing,
    // and one begun so counts only once the tip has moved away
    const grip = { pressed: true };
    X.session.inputSources[0].gamepad = { buttons: [{}, grip, {}, {}], axes: [0, 0, 0, 0], hapticActuators: [] };
    at(0.02); await steps(3); out.gripHeld = HOST.collab.menu;
    grip.pressed = false; await steps(3); out.gripLetGo = HOST.collab.menu;
    at(0.15); await steps(3); at(0.02); await steps(3); out.afterGrip = HOST.collab.menu;
    HOST.collab.panelOpen(false); at(0.15); await steps(3);
    HOST.room.calibrate(); out.calibrating = !!HOST.room.internals().calib;
    at(0.02); await steps(3); out.calib = HOST.collab.menu;
    HOST.room.cancel(); HOST.collab.panelOpen(false);
    X.session.inputSources[0].gamepad = null; at(0.3); await steps(2);
    // hands: a left wrist turned every which way, the right index fingertip
    const J = m => ({ world: X.W.local.clone().multiply(m) }), tip = J(new M4());
    const tipAt = v => { tip.world = X.W.local.clone().multiply(new M4().makeTranslation(v.x, v.y, v.z)); };
    const wq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 0.7, -0.3)), wp = head.clone().add(new V(-0.15, -0.4, -0.35)), wm = new M4().compose(wp, wq, new V(1, 1, 1));
    X.session.inputSources[1] = { handedness: 'left', targetRayMode: 'tracked-pointer', gamepad: null, targetRaySpace: J(wm), hand: new Map([['wrist', J(wm)]]) };
    X.session.inputSources[0] = { handedness: 'right', targetRayMode: 'tracked-pointer', gamepad: null, targetRaySpace: J(new M4()), hand: new Map([['index-finger-tip', tip]]) };
    tipAt(head.clone().add(new V(0.3, -0.3, -0.2)));
    await steps(25);
    out.wrist = g.position.toArray(); out.wristWant = wp.clone().add(new V(0, 0.03, 0.035).applyQuaternion(wq)).toArray();
    out.handClosed = !HOST.collab.menu && g.visible && !!O.onHand;
    const c0 = g.position.clone();
    tipAt(c0.clone().add(new V(0.1, 0, 0))); await steps(2); tipAt(c0.clone().add(new V(0.015, 0, 0))); await steps(3);
    out.finger = HOST.collab.menu && O.panelG.visible;
    // a fingertip on Exit: hovered 4 cm in front of it, pressed within 1.5 cm, once, again after pulling back
    const s = X.session, e0 = s.end; let n = 0; s.end = () => { n++; };
    const r = S.regions.find(x => x.id === 'exit'), Hh = S.mw * S.h / S.w;
    const onExit = d => S.mesh.localToWorld(new V((r.x + r.w / 2) / S.w * S.mw - S.mw / 2, (0.5 - (r.y + r.h / 2) / S.vis) * Hh, d / O.panelG.scale.x));
    tipAt(onExit(0.04)); await steps(2); out.pokeHover = S.hover;
    tipAt(onExit(0.005)); await steps(2); out.poke1 = n; await steps(2); out.poke1b = n;
    tipAt(onExit(0.04)); await steps(2); tipAt(onExit(0.005)); await steps(2); out.poke2 = n;
    // a poke and a pinch on the ray at the same button at once press it once; a pinch a second later is its own
    const cr = HOST.cur.peek('XR.ctrls')[0], ro = head.clone().add(new V(0.1, -0.2, 0)), rd = onExit(0).sub(ro).normalize();
    cr.src = cr.src || { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: null };
    cr.g.visible = true; cr.g.matrix.compose(ro, new THREE.Quaternion().setFromUnitVectors(new V(0, 0, -1), rd), new V(1, 1, 1));
    tipAt(onExit(0.04)); await steps(3);
    const n3 = n;
    tipAt(onExit(0.005)); await steps(1); cr.wantPress = true; await steps(4); out.pokePinch = n - n3;
    await new Promise(r => setTimeout(r, 800)); cr.wantPress = true; await steps(4); out.pinchLater = n - n3;
    cr.g.visible = false;
    if (e0) s.end = e0; else delete s.end;
    tipAt(head.clone().add(new V(0.3, -0.3, -0.2))); await steps(2);
    HOST.collab.panelOpen(false);
    // no left controller or hand: beside the story panel again
    for (const k of [0, 1]) { const c = HOST.cur.peek('XR.ctrls')[k]; c.g.visible = false; c.src = null; }
    X.session.inputSources.length = 0;
    await steps(3);
    out.back = g.scale.x === 2 && !O.onHand && g.visible;
    return out;
  });
  check('headset: the menu\'s clock rides on the left controller (behind its grip and above it, turned to your eyes)', hand.closed && near(hand.c, hand.want, 2e-3) &&
    hand.scale === 1 && hand.facing > 0.99, JSON.stringify(hand));
  check('headset: a click of the left stick opens the menu above the clock (Close, Exit inside) and closes it again', hand.stick && hand.above && Math.abs(hand.pscale - 0.62) < 1e-6 &&
    hand.ids.includes('close') && hand.ids.includes('exit') && hand.stickClosed, JSON.stringify(hand));
  check('headset: a touch of the right controller\'s tip opens the menu; another touch counts only once it moved away', hand.touch && hand.held && hand.touchClosed, JSON.stringify(hand));
  check('headset: the trigger pulled while the tip touches the clock toggles the menu once; no touch with the right grip held or while calibrating',
    hand.touchTrigger[0] === true && hand.touchTrigger[1] === 1 && !hand.gripHeld && !hand.gripLetGo && hand.afterGrip && hand.calibrating && !hand.calib, JSON.stringify(hand));
  check('headset: with tracked hands the clock sits on the left wrist, the right index fingertip opens the menu and presses its buttons by touch (once, again after pulling back)',
    hand.handClosed && near(hand.wrist, hand.wristWant, 2e-3) && hand.finger && hand.pokeHover === 'exit' && hand.poke1 === 1 && hand.poke1b === 1 && hand.poke2 === 2, JSON.stringify(hand));
  check('headset: a fingertip poke and a pinch on the ray at the same button press it once (a pinch a second later again)', hand.pokePinch === 1 && hand.pinchLater === 2, JSON.stringify(hand));
  check('headset: without a left controller or hand the clock goes back beside the story panel', hand.back, JSON.stringify(hand));
  await frames(H, 150);
  // the room frame moves (newer marks elsewhere): this headset follows within a second
  ROOM = [2.05, 0, 1, 0.3];
  await A.evaluate(f => HOST.collab.publish([[HOST.room.frameKey('U1'), f]]), frameFor(ROOM, 'U1', aId, Date.now()));
  await frames(H, 900);
  const fr2 = await H.evaluate(() => HOST.room.frame.o), wantO2 = unapply(FLOOR, ROOM.slice(0, 3));
  check('headset: re-aligns when the published frame moves more than 3 cm', near(fr2, [wantO2[0], 0, wantO2[2]], 1e-4), `${fmt(fr2)} want ${fmt(wantO2)}`);
  // walk on to another station: placed there, with that station's clock and state
  const S2 = await stationFor(OTHER_STORY);
  await H.evaluate(() => window.__xr.ctrl(0, null));
  const sw2 = await walk(H, S2, OTHER_STORY, 1);
  const rig2 = await rigOf(H), want2 = rigAt(S2);
  check(`headset: walking on to ${OTHER_STORY} switches again, placed at its station`, sw2 && near(rig2.slice(0, 3), want2.slice(0, 3), 1e-4) && angle(rig2[3], want2[3]) < 1e-4,
    `story ${await H.evaluate(() => HOST.curKey)}, rig ${fmt(rig2)}, want ${fmt(want2)}`);
  const keys2 = (await roomInfo(code)).keys, x2 = keys2['st.' + S2.id + '.x'], mode2 = (keys2['st.' + S2.id + '.play'] || { v: {} }).v.mode;
  check(`headset: and ${OTHER_STORY}'s clock and explore state apply there`, !!x2 && await until(H, ([s, m]) => HOST.cur.peek('APP.mode') === m && JSON.stringify(HOST.cur.collab.state()) === s, [JSON.stringify(x2.v), mode2], 3000),
    `room ${x2 && JSON.stringify(x2.v)}, headset ${await stateOf(H)}`);
  // in explore mode at a station the scene's view (how it is turned and sized: where it stands in the room) is
  // shared by the headsets there: this one publishes its view, glides to one published by someone else, and a turn
  // made here goes out
  const kv = 'st.' + S2.id + '.view';
  await H.evaluate(() => { if (HOST.cur.peek('APP.mode') !== 'explore') HOST.cur.peek('APP.enterExplore()'); });
  const viewIs = want => until(H, w => { const v = HOST.cur.collab.view(); return !!v && JSON.stringify(v) === w; }, JSON.stringify(want), 6000);
  let v0 = null;
  for (let k = 0; k < 20 && !v0; k++) { await frames(H, 250); v0 = await H.evaluate(() => HOST.cur.collab.view()); }
  for (let k = 0; k < 12 && JSON.stringify(((await roomInfo(code)).keys[kv] || {}).v) !== JSON.stringify(v0); k++) await frames(H, 250);
  const pub0 = ((await roomInfo(code)).keys[kv] || {}).v;
  const v1 = [v0[0] > 0 ? v0[0] - 12 : v0[0] + 12, Math.round(((v0[1] + 220) % 360 - 180) * 10) / 10, Math.round(v0[2] * 0.8 * 100) / 100, v0[3], v0[4]];
  await A.evaluate(([k, v]) => HOST.collab.publish([[k, v]]), [kv, v1]);
  const got1 = await viewIs(v1);
  await H.evaluate(() => { const o = HOST.cur.peek('orbit'); o.to = null; o.cur[1] += 25; });
  const v2 = await H.evaluate(() => HOST.cur.collab.view());
  for (let k = 0; k < 12 && JSON.stringify(((await roomInfo(code)).keys[kv] || {}).v) !== JSON.stringify(v2); k++) await frames(H, 250);
  const pub2 = ((await roomInfo(code)).keys[kv] || {}).v;
  check(`headset: in explore mode at a station the scene's view is shared (${OTHER_STORY}: published, followed, a turn here goes out)`,
    !!v0 && JSON.stringify(pub0) === JSON.stringify(v0) && got1 && JSON.stringify(pub2) === JSON.stringify(v2), JSON.stringify({ v0, pub0, v1, got1, v2, pub2 }));
  // at a station in a shared room the story panel has no Stories button, and a Stories screen left open closes by
  // itself (the story goes on as the room has it)
  const sb = await H.evaluate(async () => {
    const X = window.__xr, ids = () => HOST.cur.peek('XR.main.regions.map(r => r.id)');
    HOST.cur.peek('(XR.main.last = "", XR.main.t = -1e9, panelTick(XR.main, performance.now() + 1e6))');
    const none = ids().length > 0 && !ids().includes('stories'), mode = HOST.cur.peek('APP.mode');
    HOST.cur.peek('(XR.stories = true)');
    for (let k = 0; k < 3; k++) { X.step(); await new Promise(r => setTimeout(r, 20)); }
    return { none, closed: !HOST.cur.peek('XR.stories'), same: HOST.cur.peek('APP.mode') === mode, ids: ids() };
  });
  check('headset: at a station in a shared room no Stories button, and a Stories screen closes by itself (the story goes on)', sb.none && sb.closed && sb.same, JSON.stringify(sb));
  // the scene and the panel at a station: both grips on the scene resize it (and move it with their middle), one grip
  // on the panel moves it; it goes out to the room (st.<id>.place, st.<id>.panel) and comes back from it, gliding
  const kPl = 'st.' + S2.id + '.place', kPn = 'st.' + S2.id + '.panel';
  const pl = await H.evaluate(async () => {
    const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z), wait = () => new Promise(r => setTimeout(r, 30));
    const at = (i, x, y, z) => X.aim(i, new THREE.Matrix4().makeTranslation(x, y, z));
    const grab = (i, kind, on) => HOST.cur.peek(`(c => { if (${on}) c.hover = ${kind === 'panel' ? '{ kind: "panel", P: XR.main, x: 10, y: 10, point: XR.main.mesh.getWorldPosition(new THREE.Vector3()) }' : '{ kind: "globe", i: -1, point: c.o.clone() }'}; xrGrab(c, ${on}); })(XR.ctrls[${i}])`);
    const R = HOST.cur.peek('GL.rig'), o = V(0, -0.2, -0.6).applyMatrix4(R.matrixWorld);
    at(0, o.x - 0.1, o.y, o.z); at(1, o.x + 0.1, o.y, o.z);
    X.step(); X.step();
    const s0 = HOST.cur.peek('XR.size');
    grab(0, 'globe', true); grab(1, 'globe', true);
    for (let k = 0; k < 3; k++) { X.step(); await wait(); }
    at(0, o.x - 0.2, o.y + 0.1, o.z); at(1, o.x + 0.2, o.y + 0.1, o.z);   // twice as far apart, 10 cm higher
    for (let k = 0; k < 8; k++) { X.step(); await wait(); }
    const mid = { size: HOST.cur.peek('XR.size'), off: HOST.cur.peek('XR.globeOff.toArray()'), held: HOST.cur.xrPose().held };
    grab(1, 'globe', false);
    for (let k = 0; k < 2; k++) { X.step(); await wait(); }
    at(0, o.x - 0.2, o.y + 0.1, o.z - 0.3);   // the other hand carries on alone: 30 cm further
    for (let k = 0; k < 6; k++) { X.step(); await wait(); }
    grab(0, 'globe', false);
    for (let k = 0; k < 4; k++) { X.step(); await wait(); }
    const one = { size: HOST.cur.peek('XR.size'), off: HOST.cur.peek('XR.globeOff.toArray()') };
    // the panel, with one grip
    const p0 = HOST.cur.peek('XR.panelGroup.position.toArray()');
    const pw = HOST.cur.peek('XR.main.mesh.getWorldPosition(new THREE.Vector3())');
    at(0, pw.x, pw.y, pw.z + 0.3); X.step(); grab(0, 'panel', true);
    at(0, pw.x + 0.25, pw.y, pw.z + 0.3);
    for (let k = 0; k < 6; k++) { X.step(); await wait(); }
    grab(0, 'panel', false);
    for (let k = 0; k < 4; k++) { X.step(); await wait(); }
    X.ctrl(0, null); X.ctrl(1, null);
    return { s0, mid, one, p0, p1: HOST.cur.peek('XR.panelGroup.position.toArray()') };
  });
  for (let k = 0; k < 10 && !((await roomInfo(code)).keys[kPl] && (await roomInfo(code)).keys[kPn]); k++) await frames(H, 200);
  const rk = (await roomInfo(code)).keys, rPl = rk[kPl] && rk[kPl].v, rPn = rk[kPn] && rk[kPn].v;
  check('headset: both grips on the scene resize it (twice as far apart: twice the size) and move it with their middle; one hand carries on alone',
    Math.abs(pl.mid.size - 2 * pl.s0) < 0.02 && pl.mid.held && Math.abs(pl.mid.off[1] - 0.1) < 0.01 && Math.abs(pl.one.size - pl.mid.size) < 1e-6 &&
    Math.abs(Math.hypot(...pl.one.off.map((v, k) => v - pl.mid.off[k])) - 0.3) < 0.03, JSON.stringify(pl));
  check('headset: the scene\'s place and size and the moved panel go out to the room', !!rPl && Math.abs(rPl.s - pl.one.size) < 0.002 &&
    near([rPl.x, rPl.y, rPl.z], pl.one.off, 2e-3) && !!rPn && Math.abs(rPn.x - pl.p1[0]) < 2e-3 && Math.abs(rPn.y - 1.6 - pl.p1[1]) < 2e-3 &&
    Math.hypot(...pl.p1.map((v, k) => v - pl.p0[k])) > 0.2, JSON.stringify({ rPl, rPn, pl }));
  // someone else's: it glides in here
  await A.evaluate(([a, b]) => HOST.collab.publish([[a, { x: 0.2, y: 0.1, z: -0.3, s: 0.5 }], [b, { x: -0.7, y: 1.5, z: -0.6, yaw: 0.4 }]]), [kPl, kPn]);
  const pglide = await H.evaluate(async () => {
    const X = window.__xr, seen = [];
    const there = () => HOST.cur.peek('XR.size === 0.5 && XR.panelGroup.position.distanceTo(new THREE.Vector3(-0.7, -0.1, -0.6)) < 1e-6 && XR.globeOff.distanceTo(new THREE.Vector3(0.2, 0.1, -0.3)) < 1e-6');
    for (let k = 0; k < 150 && !there(); k++) { X.step(); await new Promise(r => setTimeout(r, 16)); seen.push(HOST.cur.peek('XR.size')); }
    return { size: HOST.cur.peek('XR.size'), off: HOST.cur.peek('XR.globeOff.toArray()'), pp: HOST.cur.peek('XR.panelGroup.position.toArray()'), pr: HOST.cur.peek('XR.panelGroup.rotation.y'),
      between: seen.some(v => v > 0.52 && v < 1.9), frames: seen.length };
  });
  check('headset: a place, size and panel from someone else pglide in', Math.abs(pglide.size - 0.5) < 1e-3 && near(pglide.off, [0.2, 0.1, -0.3], 2e-3) &&
    near(pglide.pp, [-0.7, -0.1, -0.6], 2e-3) && Math.abs(pglide.pr - 0.4) < 3e-3 && pglide.between, JSON.stringify(pglide));
  // free moving (the room's setting, on by default): the grip turns the scene with the hand and tilts the panel; the
  // turns go out with the place and the panel (q, to 4 decimals), and the other pages hold the same values
  // degrees between two turns (normalised: the room's are rounded to 4 decimals)
  const qang = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]) / Math.hypot(...a) / Math.hypot(...b))) * 180 / Math.PI;
  const fm = await H.evaluate(async () => {
    const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z), R = HOST.cur.peek('GL.rig');
    const run = async n => { for (let k = 0; k < n; k++) { X.step(); await new Promise(r => setTimeout(r, 30)); } };
    // controller i at p in the rig's frame, turned yaw about its vertical and pitched (radians)
    const at = (i, p, yaw, pitch) => X.aim(i, new THREE.Matrix4().compose(V(...p).applyMatrix4(R.matrixWorld),
      R.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch || 0, yaw || 0, 0, 'YXZ'))), V(1, 1, 1)));
    const grab = (i, kind, on) => HOST.cur.peek(`(c => { if (${on}) c.hover = ${kind === 'panel' ? '{ kind: "panel", P: XR.main, x: 10, y: 10, point: XR.main.mesh.getWorldPosition(new THREE.Vector3()) }' : '{ kind: "globe", i: -1, point: c.o.clone() }'}; xrGrab(c, ${on}); })(XR.ctrls[${i}])`);
    const free = HOST.xr.free(), rot0 = HOST.cur.peek('XR.rot.toArray()');
    // the scene: held, the hand turned 90 degrees about the vertical as it moves
    at(0, [0.1, -0.2, -0.6]); await run(2);
    grab(0, 'globe', true); await run(2);
    for (let k = 1; k <= 6; k++) { at(0, [0.1 + 0.02 * k, -0.2, -0.6 + 0.01 * k], k * Math.PI / 12); await run(2); }
    grab(0, 'globe', false); await run(6);
    const rot = HOST.cur.peek('XR.rot.toArray()');
    // the panel: held, the hand turned 20 degrees and pitched 30
    const pw = HOST.cur.peek('GL.rig.worldToLocal(XR.main.mesh.getWorldPosition(new THREE.Vector3())).toArray()');
    at(0, [pw[0], pw[1], pw[2] + 0.3]); await run(1); grab(0, 'panel', true);
    at(0, [pw[0] + 0.05, pw[1] + 0.05, pw[2] + 0.3], 20 * Math.PI / 180, 30 * Math.PI / 180); await run(6);
    grab(0, 'panel', false); await run(6);
    X.ctrl(0, null);
    return { free, rot0, rot, want: new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2).multiply(new THREE.Quaternion().fromArray(rot0)).toArray(),
      pq: HOST.cur.peek('XR.panelGroup.quaternion.toArray()'), up: HOST.cur.peek('new THREE.Vector3(0, 1, 0).applyQuaternion(XR.panelGroup.quaternion).y') };
  });
  let rk3 = {};
  for (let k = 0; k < 15; k++) { rk3 = (await roomInfo(code)).keys; if (rk3[kPl] && rk3[kPl].v.q && rk3[kPn] && rk3[kPn].v.q) break; await frames(H, 200); }
  const fq = rk3[kPl] && rk3[kPl].v.q, fpq = rk3[kPn] && rk3[kPn].v.q;
  const vals = await Promise.all([A, B].map(p => p.evaluate(([a, b]) => JSON.stringify([HOST.collab.val(a).q, HOST.collab.val(b).q]), [kPl, kPn])));
  const tilt = Math.acos(Math.min(1, fm.up)) * 180 / Math.PI;
  check('headset: free moving at a station, the grip turns the scene with the hand (90 degrees) and tilts the panel (30 degrees); the turns go out to the room, and the others have the same',
    fm.free && !!fq && !!fpq && qang(fm.rot, fm.want) < 0.05 && qang(fq, fm.rot) < 0.05 && tilt > 25 && tilt < 35 && qang(fpq, fm.pq) < 0.05 &&
    vals.every(v => v === JSON.stringify([fq, fpq])), JSON.stringify({ fm, fq, fpq, vals, tilt }));
  // the headset's menu sets them for everyone in the room: Moving: facing you (the turns go, the scene faces you
  // again and the panel stands upright), then Labels round (hidden, on top, in 3D), each followed by the pages
  const menuPress = id => H.evaluate(async id => {
    const X = window.__xr; X.step(); X.step();
    const r = HOST.collab.overlay().panel.regions.find(x => x.id === id); if (r && r.fn) r.fn();
    for (let k = 0; k < 3; k++) { X.step(); await new Promise(res => setTimeout(res, 20)); }
    return !!(r && r.fn);
  }, id);
  await H.evaluate(() => HOST.collab.panelOpen(true));
  const pf = await menuPress('free');
  const offAB = await lookIs(A, 'fixed,false') && await lookIs(B, 'fixed,false');
  let rk4 = {};
  for (let k = 0; k < 15; k++) { rk4 = (await roomInfo(code)).keys; if (!rk4[kPl].v.q && !rk4[kPn].v.q) break; await frames(H, 200); }
  await frames(H, 100);
  const hOff = await H.evaluate(() => ({ free: HOST.cur.peek('XR.free'), rot: HOST.cur.peek('XR.rot.toArray()'), up: HOST.cur.peek('new THREE.Vector3(0, 1, 0).applyQuaternion(XR.panelGroup.quaternion).y') }));
  check('headset: Moving in the headset\'s menu turns free moving off for everyone: the turns leave the room, the scene faces you again and the panel stands upright',
    pf && offAB && !rk4[kPl].v.q && !rk4[kPn].v.q && !hOff.free && qang(hOff.rot, [0, 0, 0, 1]) < 1e-6 && Math.abs(hOff.up - 1) < 1e-6, JSON.stringify({ pf, offAB, place: rk4[kPl], panel: rk4[kPn], hOff }));
  // what the headset draws of the room in each: the other stations' cards and a person's name tag (someone injected
  // for a few frames)
  const roomLook = () => H.evaluate(async () => {
    const C = HOST.collab.internals(), id = 'zz-look';
    if (!C.members.some(m => m.id === id)) C.members.push({ id, name: 'Look', color: '#ff7a59', kind: 'vr', here: false });
    for (let k = 0; k < 4; k++) { C.pres.set(id, { id, at: performance.now(), st: '', head: [1, 1.6, -2, 0, 0, 0, 1], hands: [] }); window.__xr.step(); await new Promise(r => setTimeout(r, 10)); }
    const O = HOST.collab.overlay(), o = O.people.get(id), f = m => ({ vis: m.visible, dt: m.material.depthTest, dw: m.material.depthWrite, at: m.material.alphaTest, ro: m.renderOrder });
    const out = { cards: [...O.cards.values()].map(c => Object.assign(f(c.mesh), { back: c.back.renderOrder, same: c.back.material === c.mesh.material, v: c.mesh.material.version })),
      tag: o ? f(o.tag) : null, sign: o ? { vis: o.sign.visible, faces: o.sign.children.map(f) } : null,
      menu: [O.clock, O.panel, O.note].map(S => !S.mesh.material.depthTest && S.mesh.renderOrder > 50) };
    C.pres.delete(id); C.members = C.members.filter(m => m.id !== id);
    return out;
  });
  const lseen = [], looks = {};
  for (let k = 0; k < 3; k++) {
    const ok = await menuPress('labels'), w = await H.evaluate(() => HOST.xr.labels());
    lseen.push(w + '/' + await peek(H, 'XR.lm') + (ok && await lookIs(A, w + ',false') && await lookIs(C, w + ',false') ? '' : ' (not on the pages)'));
    looks[w] = await roomLook();
    if (w === 'fixed') looks.again = await roomLook();
  }
  check('headset: Labels in the headset\'s menu goes round (hidden, on top, in 3D), for its story and every page in the room', lseen.join() === 'hidden/hidden,face/face,fixed/fixed', lseen.join(', '));
  // on top the cards are drawn after the scenes (before the story's panels, depth-tested) and the tag is a sprite over
  // everything, as before; in 3D both are drawn as the labels' signs are (first of the see-through things, writing
  // depth, their clear corners cut away; both faces), so a glowing or glass model in front hides them, and their
  // materials are built again only when the mode changes; hidden, neither is drawn. The menu, its clock and the
  // shell's note stay on top in every mode
  const LK = looks, cardsAre = (L, want) => !!L && L.cards.length > 5 && L.cards.every(c => c.same && want(c));
  check('headset: the other stations\' cards and a person\'s name tag are on top as before with labels on top, drawn in the scene as the labels\' signs are with labels in 3D, and not drawn with labels hidden; the menu stays on top',
    cardsAre(LK.face, c => c.vis && c.dt && !c.dw && !c.at && c.ro === 49 && c.back === 49) && LK.face.tag && LK.face.tag.vis && !LK.face.tag.dt && LK.face.tag.ro > 50 && !LK.face.sign.vis &&
    cardsAre(LK.fixed, c => c.vis && c.dt && c.dw && c.at > 0 && c.ro === -1 && c.back === -1) && LK.fixed.tag && !LK.fixed.tag.vis && LK.fixed.sign.vis &&
    LK.fixed.sign.faces.length === 2 && LK.fixed.sign.faces.every(x => x.dt && x.dw && x.at > 0 && x.ro === -1) &&
    LK.again.cards.every((c, i) => c.v === LK.fixed.cards[i].v) &&
    !!LK.hidden && LK.hidden.cards.every(c => !c.vis) && LK.hidden.tag && !LK.hidden.tag.vis && !LK.hidden.sign.vis &&
    ['face', 'fixed', 'hidden'].every(m => LK[m] && LK[m].menu.every(Boolean)),
    JSON.stringify({ face: LK.face && Object.assign({}, LK.face, { cards: LK.face.cards.slice(0, 2) }), fixed: LK.fixed && Object.assign({}, LK.fixed, { cards: LK.fixed.cards.slice(0, 2) }),
      hidden: LK.hidden && Object.assign({}, LK.hidden, { cards: LK.hidden.cards.slice(0, 2) }) }));
  await H.evaluate(() => HOST.collab.panelOpen(false));
  await A.evaluate(() => HOST.xr.setFree(true));
  check('headset: and free moving on again from a page', await until(H, () => { window.__xr.step(); return HOST.xr.free() && HOST.cur.peek('XR.free'); }, null, 3000));
  // the layout lock stops the grip on scenes and panels too
  await A.evaluate(() => HOST.collab.lock(true));
  await until(H, () => HOST.collab.locked, null, 3000);
  const lockG = await H.evaluate(() => {
    const X = window.__xr;
    X.aim(0, new THREE.Matrix4().makeTranslation(0, 1.4, -0.4)); X.step();
    HOST.cur.peek('(c => { c.hover = { kind: "globe", i: -1, point: c.o.clone() }; xrGrab(c, true); })(XR.ctrls[0])');
    const g = HOST.cur.peek('!!XR.ctrls[0].grab');
    HOST.cur.peek('xrGrab(XR.ctrls[0], false)'); X.ctrl(0, null);
    return { locked: HOST.anchor.locked('globe') && HOST.anchor.locked('panel'), grabbed: g, hint: HOST.room.gripHint };
  });
  await A.evaluate(() => HOST.collab.lock(false));
  check('headset: while the layout is locked the grip moves no scene and no panel (and the panel says so)', lockG.locked && !lockG.grabbed && /locked/.test(lockG.hint), JSON.stringify(lockG));
  check('headset: and back again', await walk(H, S1, HEADSET_STORY, 0));
  // Remove on the headset panel asks first: the first press only arms it (for 3 s), the station stays
  await H.evaluate(() => HOST.collab.panelOpen(true));
  await frames(H, 150);
  const rm1 = await H.evaluate(() => { const r = HOST.collab.overlay().panel.regions.find(x => x.id === 'remove'); if (r) r.fn(); return !!r; });
  await frames(H, 150);
  const rmLabel = await H.evaluate(() => HOST.collab.internals().rm && HOST.collab.internals().rm.id);
  await sleep(3200);
  await frames(H, 100);
  const rmAfter = await H.evaluate(id => [!!HOST.collab.station(id), HOST.collab.internals().rm && performance.now() < HOST.collab.internals().rm.until], S1.id);
  check('headset: Remove asks first (one press arms it for 3 s, the station stays)', rm1 && rmLabel === S1.id && rmAfter[0] && !rmAfter[1], JSON.stringify([rm1, rmLabel, rmAfter]));
  await H.evaluate(() => HOST.collab.panelOpen(false));
  await H.evaluate(() => window.__xr.end());
  const quietAfter = await H.evaluate(() => { const A = HOST.audio.state(); return { pan: !!A.pan, vol: A.el.volume, held: HOST.anchor.held(), lock: HOST.anchor.locked('globe'), shell: HOST.anchor.locked('shell') }; });
  check('headset: after the session no sound zone and no hold (all as outside a room)', !quietAfter.pan && quietAfter.vol === 1 && !quietAfter.held && !quietAfter.lock, JSON.stringify(quietAfter));
  check('headset: the grip on the shell\'s own things never moves the scene', quietAfter.shell);

  // ----------------------------------------- calibration from two marks --
  // a headset without a shared space and without saved marks: calibrate, touching mark A then mark B
  await H.evaluate(() => { localStorage.removeItem('roomFrame'); HOST.room.internals().saved = null; });
  await H.evaluate(installXR, Object.assign({}, xrOpts, { features: ['local-floor', 'anchors'] }));
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 300);
  check('calibration: a headset with no shared space and no marks asks to calibrate', await H.evaluate(() => HOST.room.state === 'calibrate'), await H.evaluate(() => HOST.room.state));
  const markA = [1.0, 0.75, -0.4], markB = [2.2, 0.75, 0.9];
  const touch = async p => {   // held still on the mark, then the trigger (a second pull within 0.6 s would be ignored)
    await H.evaluate(p => window.__xr.ctrl(0, p, [0, -1, 0]), p); await frames(H, 650);
    await H.evaluate(() => HOST.cur.peek('XR.ctrls[0].wantPress = true')); await frames(H, 100);
  };
  // pressed by mistake: the panel's Stop calibrating still takes the trigger (no mark is taken)
  await H.evaluate(() => { HOST.room.calibrate(); HOST.collab.panelOpen(true); });
  await frames(H, 200);
  const stopAt = await H.evaluate(() => {
    const S = HOST.collab.overlay().panel, r = S.regions.find(x => x.id === 'cal');
    if (!r || !S.mesh.parent.visible) return null;
    const H = S.mw * S.h / S.w, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    return S.mesh.localToWorld(new THREE.Vector3((cx / S.w - 0.5) * S.mw, (0.5 - cy / S.vis) * H, 0)).toArray();
  });
  if (stopAt) await press(stopAt);
  const stopped = await H.evaluate(() => [HOST.room.state, !!HOST.room.internals().calib, !!HOST.room.frame]);
  check('calibration: while calibrating, the panel\'s Stop calibrating still works (the press takes no mark)', !!stopAt && stopped[0] === 'calibrate' && !stopped[1] && !stopped[2], JSON.stringify(stopped));
  await H.evaluate(() => { HOST.collab.panelOpen(false); window.__xr.ctrl(0, null); });
  await frames(H, 100);
  await H.evaluate(() => HOST.room.calibrate());
  await touch(markA);
  const stA = await H.evaluate(() => HOST.room.state);
  const dbl = await H.evaluate(p => { window.__xr.ctrl(0, p, [0, -1, 0]); HOST.cur.peek('XR.ctrls[0].wantPress = true'); window.__xr.step(); return HOST.room.state; }, markB);
  check('calibration: a second pull right after a mark (a double pull) is ignored', dbl === 'mark-b' &&
    await H.evaluate(() => window.__collabLog.some(e => e.ev === 'mark ignored')), dbl);
  await touch([markA[0] + 0.1, markA[1], markA[2] + 0.05]);
  const stClose = await H.evaluate(() => HOST.room.state);
  await touch(markB);
  // the anchors at A and B are made, checked against the marks, and their handles saved
  const keptMarks = () => H.evaluate(() => { const s = JSON.parse(localStorage.getItem('roomFrame') || 'null'); return !!(s && s.anchors && s.anchors.length === 2); });
  for (let k = 0; k < 12 && !(await keptMarks()); k++) await frames(H, 250);
  const cal = await H.evaluate(() => ({ frame: HOST.room.frame, src: HOST.room.src, saved: JSON.parse(localStorage.getItem('roomFrame') || 'null'), made: window.__xr.made,
    mk: HOST.room.marks, line: HOST.room.sourceLine() }));
  const fa = unapply(FLOOR, markA), fb = unapply(FLOOR, markB), cx = unit([fb[0] - fa[0], 0, fb[2] - fa[2]]), dAB = Math.hypot(fb[0] - fa[0], fb[2] - fa[2]);
  check('calibration: mark A, then a mark B too close is refused', stA === 'mark-b' && stClose === 'mark-b', `${stA}, ${stClose}`);
  check('calibration: two marks give the expected frame (A the origin, A to B the x axis)', cal.src === 'marks' && near(cal.frame.o, [fa[0], 0, fa[2]], 2e-3) && near(cal.frame.x, cx, 2e-3),
    `${cal.src} o ${fmt(cal.frame ? cal.frame.o : [])} x ${fmt(cal.frame ? cal.frame.x : [])}, want ${fmt(fa)} ${fmt(cx)}`);
  check('calibration: saved with two anchors, at mark A and at mark B (their handles kept, no coordinates trusted alone)', cal.saved && cal.saved.v === 2 &&
    near(cal.saved.a, fa, 2e-3) && near(cal.saved.b, fb, 2e-3) && cal.saved.anchors.length === 2 && cal.saved.anchors.every(Boolean) && cal.made.length === 2 &&
    cal.made.every(m => m.space === 'local-floor') && near(cal.made[0].p, fa, 2e-3) && near(cal.made[1].p, fb, 2e-3), JSON.stringify({ saved: cal.saved, made: cal.made }));
  check('calibration: the marks are drawn where they were touched (A at the origin, B along x), and the panel says the room rests on them',
    !!cal.mk && Math.abs(cal.mk[0] - fa[1]) < 2e-3 && Math.abs(cal.mk[1] - dAB) < 2e-3 && Math.abs(cal.mk[2] - fb[1]) < 2e-3 && /own marks, held by two anchors/.test(cal.line),
    JSON.stringify({ mk: cal.mk, line: cal.line, want: [fa[1], dAB, fb[1]] }));
  // the room's floor under the marks: the first calibration sets it (mark A's height); a headset whose floor is
  // lower (a Guardian floor set wrong) stands the room on the marks instead, and says so
  const rm0 = ((await roomInfo(code)).keys.rm || {}).v || null;
  // (the anchors are read every 0.5 s and the value comes through the relay: a slow machine may need a few frames)
  const floorTo = async y => { for (let k = 0; k < 16; k++) { await frames(H, 250); if (Math.abs(await H.evaluate(() => HOST.room.frame.o[1]) - y) < 3e-3) break; } };
  await A.evaluate(v => HOST.collab.publish([['rm', v]]), { a: r3(fa[1] - 0.15), d: r3(dAB), by: aId, at: Date.now() });
  await floorTo(0.15);
  const fl = await H.evaluate(() => ({ y: HOST.room.frame.o[1], mk: HOST.room.marks, note: HOST.room.floorNote() }));
  await A.evaluate(v => HOST.collab.publish([['rm', v]]), { a: r3(fa[1]), d: r3(dAB), by: aId, at: Date.now() });
  await floorTo(0);
  const fl0 = await H.evaluate(() => HOST.room.frame.o[1]);
  check('the room\'s floor: the first calibration sets it; a floor 15 cm lower than the room\'s is allowed for (the room stands on the marks)',
    !!rm0 && Math.abs(rm0.a - fa[1]) < 2e-3 && Math.abs(rm0.d - dAB) < 2e-3 && Math.abs(fl.y - 0.15) < 3e-3 && Math.abs(fl.mk[0] - (fa[1] - 0.15)) < 3e-3 &&
    /floor is 15 cm lower/.test(fl.note) && Math.abs(fl0) < 3e-3, JSON.stringify({ rm0, fl, fl0 }));
  // the Guardian origin moves within the session (a reset with a transform): the frame follows at once
  const F2 = [0.1, 0, -0.2, 0.2];
  const moved = await H.evaluate(F2 => { window.__xr.floorReset(F2, 0.3); return HOST.room.frame; }, F2);
  const mo = unapply(F2, apply(FLOOR, [fa[0], 0, fa[2]])), mx = rot(-F2[3], rot(FLOOR[3], cx));
  check('a reset of local-floor as Quest Browser sends it (old to new, the head\'s height ignored) moves the frame into the new coordinates',
    moved && near(moved.o, [mo[0], 0, mo[2]], 2e-3) && near(moved.x, mx, 2e-3), `${moved ? fmt(moved.o) + ' ' + fmt(moved.x) : 'no frame'}, want ${fmt(mo)} ${fmt(mx)}`);
  // a recentre without a word (Quest Browser fires no reset): local and local-floor both move; the two anchors
  // keep the frame on the marks
  const F3 = [-0.6, 0, 0.5, -0.9], L3 = [F3[0], 1.6, F3[2], F3[3]];
  await H.evaluate(([F, L]) => {
    const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z);
    const M = a => new THREE.Matrix4().compose(V(a[0], a[1], a[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a[3]), V(1, 1, 1));
    X.W.floor = M(F); X.W.local = M(L);
  }, [F3, L3]);
  const fa3 = unapply(F3, markA), fb3 = unapply(F3, markB), cx3 = unit([fb3[0] - fa3[0], 0, fb3[2] - fa3[2]]);
  // (the anchors are read every 0.5 s, at once when the origin seems to jump: a slow machine may need a few frames)
  let rc = null;
  for (let k = 0; k < 16; k++) {
    await frames(H, 250);
    rc = await H.evaluate(() => ({ frame: HOST.room.frame, src: HOST.room.src }));
    if (rc.frame && near(rc.frame.o, [fa3[0], 0, fa3[2]], 2e-3)) break;
  }
  check('a recentre without a reset event: the anchors keep the frame on the marks', rc.src === 'marks' && rc.frame && near(rc.frame.o, [fa3[0], 0, fa3[2]], 2e-3) && near(rc.frame.x, cx3, 2e-3),
    `${rc.src} ${rc.frame ? fmt(rc.frame.o) + ' ' + fmt(rc.frame.x) : 'no frame'}, want ${fmt(fa3)} ${fmt(cx3)} ` +
    await H.evaluate(() => JSON.stringify(window.__collabLog.slice(-25).map(e => [e.t, e.ev, e.why || e.src || '']))));
  // taken off and on again (as two Quest 3s did): the origin moves and a reset says how (4 cm out here), and the
  // anchors are not tracked any more: the frame follows the reset at once, and the anchors found again by their
  // saved handles put it back on the marks
  const F4 = [0.8, 0, 0.9, 2.1], L4 = [F4[0], 1.6, F4[2], F4[3]];
  const wk0 = await H.evaluate(([F, L]) => {
    const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z);
    const M = a => new THREE.Matrix4().compose(V(a[0], a[1], a[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a[3]), V(1, 1, 1));
    const stale = new Set(HOST.room.internals().anchors || []);
    X.visibility('hidden');
    X.floorReset(F, -0.25, [0.04, 0, 0]); X.W.local = M(L);
    X.frame.trackedAnchors = { has: a => !stale.has(a) };
    X.visibility('visible');
    window.__collabLog.push({ ev: 'test woke' });
    return HOST.room.frame;
  }, [F4, L4]);
  const fa4 = unapply(F4, markA), fb4 = unapply(F4, markB), cx4 = unit([fb4[0] - fa4[0], 0, fb4[2] - fa4[2]]);
  const sinceWake = () => H.evaluate(() => { const L = window.__collabLog, i = L.map(e => e.ev).lastIndexOf('test woke'); return L.slice(i + 1).map(e => e.ev); });
  for (let k = 0; k < 40 && !(await sinceWake()).includes('anchors moved'); k++) await frames(H, 250);
  const wk = await H.evaluate(() => ({ src: HOST.room.src, frame: HOST.room.frame, state: HOST.room.state }));
  wk.log = await sinceWake();
  await H.evaluate(() => { delete window.__xr.frame.trackedAnchors; });
  check('off and on again: the frame follows the reset at once (the right way round), and is kept', !!wk0 && dist(wk0.o, [fa4[0], 0, fa4[2]]) < 0.05 &&
    near(wk0.x, cx4, 3e-3) && Math.abs(wk0.o[1]) < 3e-3, JSON.stringify({ o: wk0 && wk0.o, x: wk0 && wk0.x, want: [fa4, cx4] }));
  check('off and on again, the anchors not tracked: found again by their saved handles, the frame back on the marks', ['marks', 'anchor'].includes(wk.src) && !!wk.frame &&
    near(wk.frame.o, [fa4[0], 0, fa4[2]], 3e-3) && near(wk.frame.x, cx4, 3e-3) && wk.log.includes('marks unanswered') && !wk.log.includes('calibrate'),
    JSON.stringify(Object.assign(wk, { want: [fa4, cx4] })));
  // ...and when the headset cannot find them by their handles at first (two Quest 3s did not, after 5 and 15 minutes
  // asleep, and did once AR was entered again): it keeps looking every 10 s, and the frame goes back on the marks
  // once they come
  const Fr5 = [0.7, 0, 1.0, 2.2], Lr5 = [Fr5[0], 1.6, Fr5[2], Fr5[3]];
  const hidN = await H.evaluate(([F, L]) => {
    const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z), R = HOST.room.internals();
    const M = a => new THREE.Matrix4().compose(V(a[0], a[1], a[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a[3]), V(1, 1, 1));
    const stale = new Set(R.anchors || []), ids = (R.saved && R.saved.anchors) || [];
    window.__hidden = ids.map(u => [u, X.handles.get(u)]);
    for (const u of ids) X.handles.delete(u);   // the browser does not find them by their handles for now
    X.visibility('hidden');
    X.floorReset(F, -0.2, [0.03, 0, 0]); X.W.local = M(L);
    X.frame.trackedAnchors = { has: a => !stale.has(a) };
    X.visibility('visible');
    window.__collabLog.push({ ev: 'test woke' });
    return ids.length;
  }, [Fr5, Lr5]);
  for (let k = 0; k < 60 && !(await sinceWake()).includes('anchors not found'); k++) await frames(H, 250);
  const nfr5 = (await sinceWake()).includes('anchors not found');
  await frames(H, 100);
  const lost5 = await H.evaluate(() => ({ reenter: HOST.room.internals().reenter, line: HOST.room.sourceLine(), state: HOST.room.state,
    lost: window.__collabLog.filter(e => e.ev === 'marks lost').slice(-1)[0] || null, note: (window.__collabLog.filter(e => e.ev === 'notice').slice(-1)[0] || {}).title }));
  check('off and on again, the marks not found in the session: the frame held, and the panel asks to leave AR and enter it again',
    lost5.reenter === true && /leave AR and enter it again/.test(lost5.line) && !!lost5.lost && lost5.lost.why === 'wake' && lost5.state !== 'calibrate', JSON.stringify(lost5));
  await H.evaluate(() => { for (const [u, w] of window.__hidden) window.__xr.handles.set(u, w); });
  for (let k = 0; k < 90 && !(await sinceWake()).includes('anchors moved'); k++) await frames(H, 250);
  const far5 = unapply(Fr5, markA), fbr5 = unapply(Fr5, markB), cxr5 = unit([fbr5[0] - far5[0], 0, fbr5[2] - far5[2]]);
  const rtw = await H.evaluate(() => ({ src: HOST.room.src, frame: HOST.room.frame, state: HOST.room.state }));
  rtw.log = await sinceWake();
  await H.evaluate(() => { delete window.__xr.frame.trackedAnchors; });
  check('off and on again, the anchors not found by their handles at first: looked for again (every 10 s), the frame back on the marks once they come',
    hidN === 2 && nfr5 && rtw.log.includes('anchors found again') && ['marks', 'anchor'].includes(rtw.src) && !!rtw.frame && near(rtw.frame.o, [far5[0], 0, far5[2]], 3e-3) &&
    near(rtw.frame.x, cxr5, 3e-3) && !rtw.log.includes('calibrate'), JSON.stringify(Object.assign(rtw, { hidN, nfr5, want: [far5, cxr5] })));
  const back5 = await H.evaluate(() => ({ reenter: HOST.room.internals().reenter, line: HOST.room.sourceLine() }));
  check('the marks found after all: the panel no longer asks to leave AR', back5.reenter === false && !/leave AR/.test(back5.line), JSON.stringify(back5));
  // a jump of the origin while the marks' anchors are not found (their tries over) but their handles are saved: the
  // calibration is kept (a new AR session finds the marks), the panel asks to leave AR and enter it again, and the
  // anchors are looked for again at once
  const jmp = await H.evaluate(() => {
    const X = window.__xr, R = HOST.room.internals(), ids = (R.saved && R.saved.anchors) || [];
    window.__hidden = ids.map(u => [u, X.handles.get(u)]);
    for (const u of ids) X.handles.delete(u);
    for (const a of R.anchors || []) { try { a.delete(); } catch (e) { /* gone */ } }
    Object.assign(R, { anchors: null, anchorIds: null, anchorsOK: false, anchorP: null, anchorTried: true, retryAt: 0, retryFrom: 0 });   // as when the tries ran out
    window.__collabLog.push({ ev: 'test jump' });
    const f0 = HOST.room.frame && HOST.room.frame.o.slice();
    R.prev = { p: [9, 1.6, 9], q: [0, 0, 0, 1], t: performance.now() - 20 }; R.originCheck(performance.now());
    return { f0, n: ids.length };
  });
  const sinceJump = () => H.evaluate(() => { const L = window.__collabLog, i = L.map(e => e.ev).lastIndexOf('test jump'); return L.slice(i + 1); });
  for (let k = 0; k < 40 && !(await sinceJump()).some(e => e.ev === 'anchors not found'); k++) await frames(H, 250);
  const jl = await H.evaluate(() => ({ state: HOST.room.state, frame: HOST.room.frame, reenter: HOST.room.internals().reenter, line: HOST.room.sourceLine(), saved: !!localStorage.getItem('roomFrame') }));
  jl.log = (await sinceJump()).map(e => e.ev + (e.why ? ':' + e.why : ''));
  check('a jump of the origin with saved anchors not found: the calibration kept, and the panel asks to leave AR and enter it again',
    jmp.n === 2 && jl.state !== 'calibrate' && !!jl.frame && !!jmp.f0 && near(jl.frame.o, jmp.f0, 1e-3) && jl.reenter === true && /leave AR/.test(jl.line) && jl.saved &&
    jl.log.includes('marks lost:jump') && jl.log.includes('anchors not found'), JSON.stringify(Object.assign(jl, { jmp })));
  await H.evaluate(() => { for (const [u, w] of window.__hidden) window.__xr.handles.set(u, w); });
  for (let k = 0; k < 90 && !(await sinceJump()).some(e => e.ev === 'anchors found again'); k++) await frames(H, 250);
  const jb = await H.evaluate(() => ({ reenter: HOST.room.internals().reenter, src: HOST.room.src }));
  jb.found = (await sinceJump()).some(e => e.ev === 'anchors found again');
  check('...and found on the next try: the panel no longer asks to leave AR', jb.found && jb.reenter === false && ['marks', 'anchor'].includes(jb.src), JSON.stringify(jb));
  // next session (or a reload): the anchors at mark A and mark B bring the frame back; handles nobody knows go
  await H.evaluate(() => window.__xr.end());
  await H.evaluate(() => window.__handles.set('junk-left-over', new THREE.Matrix4()));
  await H.evaluate(installXR, Object.assign({}, xrOpts, { features: ['local-floor', 'anchors'] }));
  await H.evaluate(() => window.__xr.begin());
  for (let k = 0; k < 12 && !(await H.evaluate(() => HOST.room.src)); k++) await frames(H, 250);   // a busy machine draws few frames
  const re = await H.evaluate(() => ({ frame: HOST.room.frame, src: HOST.room.src }));
  const tidy = await H.evaluate(() => ({ junk: window.__handles.has('junk-left-over'), ours: HOST.room.handles().every(u => window.__handles.has(u)) }));
  check('a new session deletes saved anchors nobody knows (they fill the browser\'s few slots), and keeps the room\'s', !tidy.junk && tidy.ours, JSON.stringify(tidy));
  check('calibration: the next session finds the frame again by its two anchors', re.src === 'anchor' && re.frame && near(re.frame.o, cal.frame.o, 2e-3) && near(re.frame.x, cal.frame.x, 2e-3),
    `${re.src} ${re.frame ? fmt(re.frame.o) : ''} ` + await H.evaluate(() => JSON.stringify(window.__collabLog.slice(-10).map(e => [e.ev, e.state || e.src || e.e || '']))));
  // Forget calibration (two presses on the shell's panel): the marks and their saved anchors go, and the headset
  // lines up again from the start (here, with no shared space, it asks to calibrate); the panel says there is no
  // shared space
  await H.evaluate(() => HOST.collab.panelOpen(true));
  await frames(H, 200);   // the panel draws (and lists its buttons) in the headset's frames
  const forgot = await H.evaluate(() => {
    const S = HOST.collab.overlay().panel, ids = (HOST.room.internals().saved || {}).anchors || [];
    const press = () => { const r = S.regions.find(x => x.id === 'forget'); if (r && r.fn) r.fn(); return !!(r && r.fn); };
    // both presses at once: a busy page can take longer than the 3 s the first press arms it for
    const first = press(), kept = !!localStorage.getItem('roomFrame') && !!HOST.room.frame, second = press();
    return { first, kept, second, ids, gone: ids.every(u => !window.__xr.handles.has(u)), saved: localStorage.getItem('roomFrame'), frame: HOST.room.frame, line: HOST.room.sharedLine() };
  });
  await frames(H, 300);
  const forgotState = await H.evaluate(() => { HOST.collab.panelOpen(false); return HOST.room.state; });
  check('Forget calibration: the first press only asks, the second forgets the marks and their anchors, and the headset asks to calibrate again',
    forgot.first && forgot.kept && forgot.second && forgot.ids.length === 2 && forgot.gone && !forgot.saved && !forgot.frame && forgotState === 'calibrate' && /No shared space/.test(forgot.line),
    JSON.stringify(Object.assign({ state: forgotState }, forgot)));
  // calibrating again drops the old marks' anchors at once (they would pull the new frame back to the old marks)
  const savedIds = () => H.evaluate(() => { const S = HOST.room.internals().saved; return S && S.anchors.length === 2 ? S.anchors.slice() : null; });
  const recal = async () => {
    await H.evaluate(() => HOST.room.calibrate());
    await touch(markA); await touch(markB);
    for (let k = 0; k < 8 && !(await savedIds()); k++) await frames(H, 250);
    return savedIds();
  };
  const h1 = await recal(), h2 = await recal();
  const hs = await H.evaluate(([a, b]) => [a.some(u => window.__xr.handles.has(u)), b.every(u => window.__xr.handles.has(u))], [h1 || [], h2 || []]);
  check('calibrating again replaces the old marks\' anchors (their saved handles are deleted)', !!h1 && !!h2 && h1[0] !== h2[0] && !hs[0] && hs[1], JSON.stringify({ h1, h2, hs }));
  // Forget while the next session is still finding those anchors: the anchors that arrive afterwards are not used
  await H.evaluate(() => window.__xr.end());
  await H.evaluate(installXR, Object.assign({}, xrOpts, { features: ['local-floor', 'anchors'] }));
  await H.evaluate(() => {
    const S = window.__xr.session, restore = S.restorePersistentAnchor;
    window.__releaseAnchors = [];
    S.restorePersistentAnchor = u => new Promise(r => { window.__releaseAnchors.push(() => r(restore(u))); });
    window.__xr.begin();
  });
  for (let k = 0; k < 12 && (await H.evaluate(() => HOST.room.state)) !== 'restoring'; k++) await frames(H, 250);
  const lateSt = await H.evaluate(() => { const st = HOST.room.state; HOST.room.forget(); for (const f of window.__releaseAnchors) f(); return st; });
  await frames(H, 400);
  const late = await H.evaluate(h => ({ anchors: !!HOST.room.internals().anchors, state: HOST.room.state, frame: !!HOST.room.frame, handles: h.filter(u => window.__xr.handles.has(u)) }), h2 || []);
  check('Forget while last time\'s anchors are still being found: the late anchors are not used, and the headset asks to calibrate',
    lateSt === 'restoring' && !late.anchors && !late.frame && late.state === 'calibrate' && !late.handles.length, JSON.stringify(Object.assign({ was: lateSt }, late)));
  await H.evaluate(() => window.__xr.end());

  // ----------------------------- the shared space never overrides marks --
  // a headset in shared space U1 with no marks takes the frame published for U1; once calibrated it keeps its own
  // marks, publishes them for U1 (with the marks, for drawing), ignores a newer frame someone else publishes there,
  // and only says how far the shared space puts that one's marks from its own
  check('shared space: used unless switched off (the default)', await A.evaluate(() => HOST.room.sharedAlign()) === true);
  // a headset whose shared space is just its own floor while someone here published for it has not joined (one
  // Quest 3 had that every session): it takes nothing through it and says so
  await H.evaluate(() => HOST.room.sharedAlign(true));
  await H.evaluate(installXR, Object.assign({}, xrOpts, { sharedId: 'U1', shared: FLOOR, head: [-6, 1.6, 6, 0] }));
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 3000);
  const nj = await H.evaluate(() => ({ state: HOST.room.state, frame: HOST.room.frame, line: HOST.room.sourceLine(), shared: HOST.room.sharedLine(),
    log: window.__collabLog.some(e => e.ev === 'shared not joined') }));
  check('shared space: a headset whose space is just its own floor takes no frame through it from someone here, and says it has not joined',
    !nj.frame && nj.state === 'shared-wait' && /Not in the others/.test(nj.line) && /your own floor/.test(nj.shared) && nj.log, JSON.stringify(nj));
  await H.evaluate(() => window.__xr.end());
  // a frame published there by someone who has left is last time's (the space was made again under its id): after
  // the wait the first headset in the space replaces it with its own; and a frame someone here publishes later for
  // that space is taken, though the first headset's space is its own floor
  // (with another headset in the room since before this one, not yet in the space: this one, first in the space,
  // still becomes the room; a rule that counted that headset as someone here stopped alignment on two Quest 3s)
  const rfKey1 = await H.evaluate(() => HOST.room.frameKey('U1'));
  await B.evaluate(() => { const C = HOST.collab.internals(); C.ws.send(JSON.stringify({ t: 'hello', name: C.name, color: C.color, kind: 'ar', here: true })); });
  await until(H, bid => HOST.collab.members.some(m => m.id === bid && m.kind === 'ar' && m.here), await B.evaluate(() => HOST.collab.id), 3000);
  await A.evaluate(([k, f]) => HOST.collab.publish([[k, f]]), [rfKey1, Object.assign(frameFor([ROOM[0] + 1, 0, ROOM[2], ROOM[3]], 'U1', 'left-long-ago', Date.now() - 3600e3), { g: 'shared' })]);
  await H.evaluate(installXR, Object.assign({}, xrOpts, { sharedId: 'U1', shared: FLOOR, head: [-6, 1.6, 6, 0] }));
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 3000);
  const early7 = await H.evaluate(() => ({ src: HOST.room.src, state: HOST.room.state }));
  for (let k = 0; k < 60 && (await H.evaluate(() => HOST.room.src)) !== 'shared'; k++) await frames(H, 250);   // after the 8 s wait
  await frames(H, 600);
  const sU7 = await H.evaluate(() => ({ src: HOST.room.src, frame: HOST.room.frame, id: HOST.collab.id, first: HOST.room.internals().firstHere }));
  const pub7 = ((await roomInfo(code)).keys[rfKey1] || {}).v || null;
  await B.evaluate(() => HOST.collab.me({}));   // (a page again)
  check('shared space: a frame there from someone who has left waits, then the first headset\'s own space replaces it (another headset in the room since before)', early7.src === '' && early7.state === 'shared-wait' &&
    sU7.src === 'shared' && sU7.first === true && !!sU7.frame && near(sU7.frame.o, [0, 0, 0], 1e-3) && !!pub7 && pub7.by === sU7.id, JSON.stringify({ early7, sU7, pub7 }) + ' ' +
    await H.evaluate(() => JSON.stringify({ members: HOST.collab.members.map(m => [m.id, m.kind, m.here, m.since]), log: window.__collabLog.filter(e => /shared|first|frame|welcome|close|connect/.test(e.ev)).slice(-20) })));
  await A.evaluate(([k, f]) => HOST.collab.publish([[k, f]]), [rfKey1, frameFor(ROOM, 'U1', aId, Date.now())]);
  await frames(H, 1000);
  const took7 = await H.evaluate(() => ({ src: HOST.room.src, frame: HOST.room.frame, line: HOST.room.sourceLine() }));
  const w7 = unapply(SHARED, ROOM.slice(0, 3));   // its space is its floor here, so the frame lands where the space puts it
  check('shared space: the first headset (its space is its own floor) takes a frame someone here publishes for it', took7.src === 'adopted' &&
    near(took7.frame.o, [w7[0], 0, w7[2]], 2e-3) && !/Not in the others/.test(took7.line), JSON.stringify(took7));
  await H.evaluate(() => window.__xr.end());
  // a Quest that left AR and entered it again got its space back under the same id but as its own floor, while the
  // other headset, aligned through the space, stayed where it was (two spaces, the relay's logs): with another headset
  // here aligned in that id, its own frame from before is not taken through it (not joined), also once the space
  // drifts a few cm (a judgement flapping at 2 cm took it)
  const hRe = await H.evaluate(() => HOST.collab.id);
  await A.evaluate(([k, f]) => HOST.collab.publish([[k, f]]), [rfKey1, Object.assign(frameFor([ROOM[0] + 1, 0, ROOM[2], ROOM[3]], 'U1', hRe, Date.now() - 600e3), { g: 'shared' })]);
  // (page B plays a headset aligned in U1: one presence through the relay, then kept fresh on H, since a page in a
  // background tab runs its timers about once a minute)
  const bRe = await B.evaluate(() => {
    const C = HOST.collab.internals(), ws = C.ws, send = ws.send.bind(ws);
    ws.send = m => { if (!/"t":"fx","k":"p\./.test(m)) send(m); };   // (its own presence, a page's, held back)
    send(JSON.stringify({ t: 'hello', name: C.name, color: C.color, kind: 'ar', here: true }));
    send(JSON.stringify({ t: 'fx', k: 'p.' + C.id, v: { st: '', head: [0, 1.6, 0, 0, 0, 0, 1], hands: [], sp: 'U1', al: 'adopted' } }));
    return C.id;
  });
  await until(H, bid => HOST.collab.members.some(m => m.id === bid && m.kind === 'ar' && m.here), bRe, 3000);
  const preRe = await until(H, bid => { const P = HOST.collab.people().get(bid); return !!P && P.sp === 'U1' && P.al === 'adopted'; }, bRe, 3000);
  await H.evaluate(bid => Object.defineProperty(HOST.collab.people().get(bid), 'at', { get: () => performance.now(), set() {}, configurable: true }), bRe);
  await H.evaluate(installXR, Object.assign({}, xrOpts, { sharedId: 'U1', shared: FLOOR, head: [-6, 1.6, 6, 0] }));
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 2500);
  await H.evaluate(() => { const X = window.__xr; X.W.shared = X.W.floor.clone().multiply(new THREE.Matrix4().makeTranslation(0.05, 0, 0.03)); });
  await frames(H, 1500);
  const reIn = await H.evaluate(() => { const R = HOST.room.internals(); return { src: HOST.room.src, frame: HOST.room.frame, first: R.firstHere, own: R.sharedOwn, line: HOST.room.sourceLine(),
    log: window.__collabLog.filter(e => /^shared (first|own|not joined|joined)/.test(e.ev)).slice(-6) }; });
  const rePub = ((await roomInfo(code)).keys[rfKey1] || {}).v || null;
  check('shared space: back in AR, its space now its own floor while another headset here is aligned in that id, a headset does not take its own frame from before through it (not joined; also with the space 6 cm off)',
    preRe && !reIn.frame && reIn.first === false && reIn.own === true && /Not in the others/.test(reIn.line) && !!rePub && rePub.by === hRe && rePub.g === 'shared', JSON.stringify({ preRe, reIn, rePub }));
  await H.evaluate(() => window.__xr.end());
  // ...but the true first headset in a space (its space is its own floor too) stays first once the others are
  // aligned through it: Re-align, and its id flicking to a default space and back, do not make it 'not joined'
  await H.evaluate(bid => HOST.collab.people().delete(bid), bRe);
  await H.evaluate(installXR, Object.assign({}, xrOpts, { sharedId: 'U1', shared: FLOOR, head: [-6, 1.6, 6, 0] }));
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 2000);
  const fst0 = await H.evaluate(() => ({ src: HOST.room.src, first: HOST.room.internals().firstHere }));
  await B.evaluate(() => { const C = HOST.collab.internals(); WebSocket.prototype.send.call(C.ws, JSON.stringify({ t: 'fx', k: 'p.' + C.id, v: { st: '', head: [0, 1.6, 0, 0, 0, 0, 1], hands: [], sp: 'U1', al: 'adopted' } })); });
  await until(H, bid => { const P = HOST.collab.people().get(bid); return !!P && P.sp === 'U1'; }, bRe, 3000);
  await H.evaluate(bid => Object.defineProperty(HOST.collab.people().get(bid), 'at', { get: () => performance.now(), set() {}, configurable: true }), bRe);
  await H.evaluate(() => HOST.room.realignNow());
  await frames(H, 2500);
  await H.evaluate(() => { window.__xr.spaces.shared.UUId = 'D1'; });
  await frames(H, 600);
  await H.evaluate(() => { window.__xr.spaces.shared.UUId = 'U1'; });
  await frames(H, 2500);
  const fst = await H.evaluate(() => { const R = HOST.room.internals(); return { src: HOST.room.src, frame: !!HOST.room.frame, first: R.firstHere, own: R.sharedOwn, nj: R.notJoined, aloneAt: R.aloneAt, id: R.sharedId,
    log: window.__collabLog.filter(e => /^shared (first|own|not joined|joined|id)|realign/.test(e.ev)).slice(-8) }; });
  check('shared space: the first headset in a space stays first with another headset aligned through it, after Re-align and an id flicking away and back',
    (fst0.src === 'adopted' || fst0.src === 'shared') && fst0.first === true && fst.frame && fst.first === true && fst.own === true && !fst.nj && !fst.aloneAt && fst.id === 'U1', JSON.stringify({ fst0, fst }));
  await H.evaluate(() => window.__xr.end());
  await H.evaluate(bid => HOST.collab.people().delete(bid), bRe);
  await B.evaluate(() => { delete HOST.collab.internals().ws.send; HOST.collab.me({}); });
  await A.evaluate(([k, f]) => HOST.collab.publish([[k, f]]), [rfKey1, frameFor(ROOM, 'U1', aId, Date.now() - 60000)]);
  await H.evaluate(() => HOST.room.sharedAlign(false));
  await H.evaluate(installXR, Object.assign({}, xrOpts, { sharedId: 'U1' }));
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 1500);
  const off = await H.evaluate(() => ({ state: HOST.room.state, frame: HOST.room.frame }));
  check('shared space: switched off on the panel, a headset without marks asks to calibrate', off.state === 'calibrate' && !off.frame, JSON.stringify(off));
  await H.evaluate(() => HOST.room.sharedAlign(true));
  for (let k = 0; k < 12 && (await H.evaluate(() => HOST.room.src)) !== 'adopted'; k++) await frames(H, 250);
  const ad0 = await H.evaluate(() => HOST.room.src);
  const hId2 = await H.evaluate(() => HOST.collab.id);
  await H.evaluate(() => window.__xr.head([-6, 1.6, 6, 0]));   // away from the stations: no story switch while calibrating
  await frames(H, 300);
  await recal();
  await frames(H, 1200);
  const rfKey = await H.evaluate(() => HOST.room.frameKey('U1'));
  const pub = ((await roomInfo(code)).keys[rfKey] || {}).v || null;
  const own1 = await H.evaluate(() => {
    const O = HOST.collab.overlay(), h = HOST.collab.internals().hov.get(0), r = HOST.collab.internals().rays.get(0);
    return { src: HOST.room.src, frame: HOST.room.frame, cur: HOST.curKey, root: !!(O.root && O.root.parent), vis: !!(O.root && O.root.visible),
      hov: h ? [h.target.kind, Math.round(performance.now() - h.at)] : null, ray: r ? [Math.round(performance.now() - r.at)] : null,
      log: window.__collabLog.slice(-25).map(e => e.ev + (e.state ? ':' + e.state : e.st ? ':' + e.st : e.story ? ':' + e.story : e.why ? ':' + e.why : '')) };
  });
  check('shared space: a headset without marks takes the published frame; once calibrated it uses its marks and publishes them for its space',
    ad0 === 'adopted' && own1.src === 'marks' && near(own1.frame.o, [fa[0], 0, fa[2]], 2e-3) && !!pub && pub.by === hId2 && pub.g === 'marks' && Array.isArray(pub.m) &&
    Math.abs(pub.m[1] - dAB) < 2e-3, JSON.stringify({ ad0, own1, pub }));
  const yawW = Math.atan2(-(markB[2] - markA[2]), markB[0] - markA[0]);
  const P3 = Object.assign(frameFor([markA[0] + 0.1, 0, markA[2], yawW + 0.05], 'U1', aId, Date.now() + 5000), { g: 'marks', m: [0.7, 1.5, 0.72] });
  await A.evaluate(([k, f]) => HOST.collab.publish([[k, f]]), [rfKey, P3]);
  await frames(H, 1500);
  const kept = await H.evaluate(() => ({ src: HOST.room.src, frame: HOST.room.frame, cmp: HOST.room.cmp, line: HOST.room.sourceLine() }));
  check('shared space: a newer frame published by someone else does not move a calibrated headset; the panel says how far apart their marks are',
    kept.src === 'marks' && near(kept.frame.o, [fa[0], 0, fa[2]], 2e-3) && !!kept.cmp && Math.abs(kept.cmp.d - 0.1) < 3e-3 && Math.abs(kept.cmp.a - 2.9) < 0.15 && /puts .*'s marks 10 cm, 2\.\d\u00b0 from yours/.test(kept.line),
    JSON.stringify(kept));
  await H.evaluate(() => HOST.room.forget());
  await frames(H, 800);
  const ad1 = await H.evaluate(() => ({ src: HOST.room.src, frame: HOST.room.frame, mk: HOST.room.marks, line: HOST.room.sourceLine() }));
  const w3 = unapply(FLOOR, [markA[0] + 0.1, 0, markA[2]]);
  check('shared space: after Forget calibration the headset takes that frame instead, marks included', ad1.src === 'adopted' && near(ad1.frame.o, [w3[0], 0, w3[2]], 2e-3) &&
    JSON.stringify(ad1.mk) === JSON.stringify(P3.m) && /through the shared space/.test(ad1.line), JSON.stringify(ad1));
  await H.evaluate(() => window.__xr.end());

  // ------------------------------------------ a shared space found split; no room scan --
  // two calibrated headsets whose marks the shared space puts 60 cm apart (two spaces under one id, as two Quest 3s
  // were): the room is told (rs.<id>), and told it is whole again once they agree; a headset without marks then takes
  // nothing through that space and asks to calibrate. A headset with plane detection but no planes says it has no
  // room scan (Space Setup not run, or Physical space features off), and stops once planes come
  const rsKey = 'rs.U1', rsOf = async () => ((await roomInfo(code)).keys[rsKey] || {}).v || null;
  await H.evaluate(installXR, Object.assign({}, xrOpts, { sharedId: 'U1', features: xrOpts.features.concat(['plane-detection']), head: [-6, 1.6, 6, 0] }));
  await H.evaluate(() => { window.__xr.frame.detectedPlanes = new Set(); window.__xr.begin(); });
  await frames(H, 300);
  await recal();
  await frames(H, 600);
  const far = Object.assign(frameFor([markA[0] + 0.6, 0, markA[2], yawW], 'U1', aId, Date.now() + 9000), { g: 'marks', m: [0.7, 1.5, 0.72] });
  await A.evaluate(([k, f]) => HOST.collab.publish([[k, f]]), [rfKey, far]);
  for (let k = 0; k < 40 && !((await rsOf()) || {}).bad; k++) await frames(H, 250);
  const sp1 = await rsOf(), hSp = await H.evaluate(() => HOST.collab.id);
  await A.evaluate(([k, f]) => HOST.collab.publish([[k, f]]), [rfKey, Object.assign({}, far, frameFor([markA[0] + 0.01, 0, markA[2], yawW], 'U1', aId, Date.now() + 9500))]);
  for (let k = 0; k < 20 && ((await rsOf()) || {}).bad; k++) await frames(H, 250);
  const sp2 = await rsOf();
  check('shared space split: two calibrated headsets 60 cm apart through it tell the room, and tell it again once they agree',
    !!sp1 && sp1.bad === true && Math.abs(sp1.d - 0.6) < 0.02 && sp1.by === hSp && sp1.with === aId && !!sp2 && sp2.bad === false, JSON.stringify({ sp1, sp2 }));
  await A.evaluate(([k, f]) => HOST.collab.publish([[k, f]]), [rfKey, Object.assign({}, far, { at: Date.now() + 10000 })]);
  for (let k = 0; k < 40 && !((await rsOf()) || {}).bad; k++) await frames(H, 250);
  await H.evaluate(() => HOST.room.forget());
  await frames(H, 1500);
  const sp3 = await H.evaluate(() => ({ src: HOST.room.src, frame: HOST.room.frame, state: HOST.room.state, line: HOST.room.sourceLine(),
    note: window.__collabLog.some(e => e.ev === 'notice' && e.title === 'Shared space not usable') }));
  check('shared space split: a headset without marks takes nothing through it and asks to calibrate, saying why',
    !sp3.frame && sp3.state === 'calibrate' && /puts calibrated headsets here 60 cm apart/.test(sp3.line) && sp3.note, JSON.stringify(sp3));
  for (let k = 0; k < 100 && !(await H.evaluate(() => HOST.room.internals().noScan)); k++) await frames(H, 250);   // (20 s into the session)
  await frames(H, 1200);
  const scan1 = await H.evaluate(() => { const R = HOST.room.internals(); return { none: R.noScan, n: R.scanN, note: window.__collabLog.some(e => e.ev === 'notice' && e.title === 'No room scan') }; });
  await H.evaluate(() => { window.__xr.frame.detectedPlanes = new Set([{}]); });
  await frames(H, 1500);
  const scan2 = await H.evaluate(() => { const R = HOST.room.internals(); return { none: R.noScan, n: R.scanN }; });
  check('no room scan: a headset with plane detection and no planes says so after 20 s, and stops once planes come',
    scan1.none === true && scan1.n === 0 && scan1.note && scan2.none === false && scan2.n === 1, JSON.stringify({ scan1, scan2 }));
  await H.evaluate(() => window.__xr.end());
  await A.evaluate(([k, a]) => HOST.collab.publish([[k, { uuid: 'U1', bad: false, d: 0, a: 0, by: a, with: a, at: Date.now() }]]), [rsKey, aId]);

  // -------------------------------------------- a calibration without anchors --
  // a browser without anchors: the marks hold for the session until the origin moves (a reset, or the head
  // seeming to jump), then the headset asks to calibrate again; a mark is taken where the controller was held
  // still, not where the trigger pull moved it
  await H.evaluate(installXR, Object.assign({}, xrOpts, { features: ['local-floor'] }));
  await H.evaluate(() => { delete window.__xr.frame.createAnchor; window.__xr.begin(); });
  await frames(H, 300);
  await H.evaluate(p => { HOST.room.calibrate(); window.__xr.ctrl(0, p, [0, -1, 0]); }, markA);
  await frames(H, 300);
  const stillA = await H.evaluate(async p => {
    // held still right up to the pull (a busy machine can take longer between two calls than the half second of
    // history the mark looks back over)
    for (let k = 0; k < 4; k++) { window.__xr.step(); await new Promise(r => setTimeout(r, 40)); }
    window.__xr.ctrl(0, [p[0] + 0.03, p[1] - 0.01, p[2]], [0, -1, 0]); HOST.cur.peek('XR.ctrls[0].wantPress = true'); window.__xr.step();
    const c = HOST.room.internals().calib; return c && c.a ? c.a.toArray() : null;
  }, markA);
  const stillWhy = stillA && near(stillA, fa, 5e-3) ? '' : ' ' + await H.evaluate(() => { const h = HOST.collab.internals().rays.get(0), t = performance.now();
    return JSON.stringify({ story: HOST.curKey, hist: h && h.hist ? h.hist.map(e => Math.round(t - e[0])) : null, log: window.__collabLog.slice(-14).map(e => [Math.round(t - e.t), e.ev, e.st || e.story || e.state || e.step || '']) }); });
  check('calibration: the mark is where the controller was held still before the trigger, not where the pull moved it', !!stillA && near(stillA, fa, 5e-3), `${stillA && fmt(stillA)} want ${fmt(fa)}` + stillWhy);
  await touch(markB);
  await frames(H, 300);
  const noA = await H.evaluate(() => ({ src: HOST.room.src, line: HOST.room.sourceLine(), saved: localStorage.getItem('roomFrame') }));
  await H.evaluate(() => { for (const fn of window.__xr.resets['local-floor'] || []) fn({ transform: null }); });
  await frames(H, 200);
  const afterReset = await H.evaluate(() => HOST.room.state);
  await recal();
  await frames(H, 200);
  const jumped = await H.evaluate(() => { const R = HOST.room.internals(); R.prev = { p: [9, 1.6, 9], q: [0, 0, 0, 1], t: performance.now() - 20 }; R.originCheck(performance.now()); return HOST.room.state; });
  await recal();
  await frames(H, 200);
  check('without anchors: the marks hold for the session (nothing saved), and a reset with no transform or a jump of the origin asks to calibrate again',
    noA.src === 'marks' && /no anchors/.test(noA.line) && !noA.saved && afterReset === 'calibrate' && jumped === 'calibrate', JSON.stringify({ noA, afterReset, jumped }));
  // off and on again with a reset that says how the origin moved: the frame follows it and stays (asking to
  // calibrate after every wake was worse), and the marks are shown to check by eye
  const F5 = [0.2, 0, 0.3, 1.2];
  await H.evaluate(F => { const X = window.__xr; X.visibility('hidden'); X.floorReset(F, 0.1); X.visibility('visible'); }, F5);
  await frames(H, 300);
  const woke = await H.evaluate(() => ({ state: HOST.room.state, frame: HOST.room.frame }));
  await frames(H, 5200);
  const woke2 = await H.evaluate(() => ({ state: HOST.room.state, last: window.__collabLog.filter(e => e.ev === 'marks unanswered').slice(-1)[0] || null }));
  const fa5 = unapply(F5, markA), fb5 = unapply(F5, markB), cx5 = unit([fb5[0] - fa5[0], 0, fb5[2] - fa5[2]]);
  check('without anchors, off and on again: the frame follows the reset and is kept (no new calibration asked)', woke.state === 'marks' && !!woke.frame &&
    near([woke.frame.o[0], woke.frame.o[2]], [fa5[0], fa5[2]], 3e-3) && near(woke.frame.x, cx5, 3e-3) && woke2.state === 'marks' && !!woke2.last && woke2.last.reset === true,
    JSON.stringify({ woke, woke2, want: [fa5, cx5] }));
  await H.evaluate(() => window.__xr.end());

  // a full store of saved anchors (one Quest 3 refused every handle: "Maximum number of anchors reached!"): the
  // leftovers nobody knows are deleted and the handles asked again; when the store cannot be freed the marks hold
  // for the session and the panel says a restart will ask to calibrate
  const fullStore = async stuck => {
    await H.evaluate(() => { localStorage.removeItem('roomFrame'); HOST.room.internals().saved = null; });
    await H.evaluate(installXR, Object.assign({}, xrOpts, { features: ['local-floor', 'anchors'], cap: 8 }));
    await H.evaluate(stuck => { window.__xr.stuck = stuck; window.__xr.begin(); }, stuck);
    await frames(H, 300);
    await H.evaluate(() => { const X = window.__xr; for (let i = 0; X.handles.size < 8; i++) X.handles.set('junk-' + i, new THREE.Matrix4()); window.__collabLog.push({ ev: 'test full' }); });
    await recal();
    for (let k = 0; k < 8 && !(await H.evaluate(() => window.__collabLog.some(e => e.ev === 'handles again'))); k++) await frames(H, 250);
    const r = await H.evaluate(() => {
      const L = window.__collabLog, i = L.map(e => e.ev).lastIndexOf('test full'), after = L.slice(i + 1), S = HOST.room.internals().saved;
      return { made: after.find(e => e.ev === 'anchors made') || null, tidied: after.find(e => e.ev === 'anchors tidied') || null, again: after.find(e => e.ev === 'handles again') || null,
        saved: S ? S.anchors.length : -1, junk: [...window.__xr.handles.keys()].filter(u => /^junk/.test(u)).length, full: HOST.room.internals().full, state: HOST.room.state };
    });
    await H.evaluate(() => window.__xr.end());
    return r;
  };
  const fs1 = await fullStore(false), fs2 = await fullStore(true);
  check('a full anchor store: leftovers deleted, the handles asked again and saved', !!fs1.made && /Maximum number of anchors/.test((fs1.made.err || [])[0] || '') &&
    !!fs1.tidied && fs1.tidied.deleted >= 1 && !!fs1.again && fs1.again.saved && fs1.saved === 2 && !fs1.junk && !fs1.full && fs1.state === 'marks', JSON.stringify(fs1));
  check('a full anchor store that cannot be freed: the marks hold for the session, and the panel says so', !!fs2.again && !fs2.again.saved && fs2.full &&
    fs2.saved === 0 && fs2.state === 'marks' && !!fs2.tidied && fs2.tidied.failed.length > 0, JSON.stringify(fs2));

  // ------------------------------------------ a VR headset elsewhere --
  await H.evaluate(installXR, Object.assign({}, xrOpts, { mode: 'immersive-vr', head: [0.3, 1.7, -0.2, 0.6] }));
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 300);
  const own = await H.evaluate(() => ({ frame: HOST.room.frame, src: HOST.room.src, here: HOST.collab.members.find(m => m.id === HOST.collab.id).here }));
  const oh = unapply(FLOOR, [0.3, 1.7, -0.2]);
  check('VR elsewhere: its own floor, centred where it stands, facing its way', own.src === 'own' && !own.here && near(own.frame.o, [oh[0], 0, oh[2]], 1e-4) &&
    near(own.frame.x, rot(0.6 - FLOOR[3], [1, 0, 0]), 1e-4), JSON.stringify(own));
  // in VR the shell's panel asks once per room whether you are in the room with the others; the answer is kept
  const regionIds = () => H.evaluate(() => HOST.collab.overlay().panel.regions.map(r => r.id));
  const pressRegion = id => H.evaluate(id => { const r = HOST.collab.overlay().panel.regions.find(x => x.id === id); if (r) r.fn(); return !!r; }, id);
  const asked = (await regionIds()).includes('ask:in') && await H.evaluate(() => HOST.collab.menu && (window.__collabLog.filter(e => e.ev === 'notice').slice(-1)[0] || {}).title === 'One question');
  await pressRegion('ask:in');
  await frames(H, 300);
  const inRoom = await H.evaluate(() => [HOST.collab.internals().hereSet, HOST.room.src, HOST.room.state]);
  await frames(H, 100);
  const sayAway = (await regionIds()).includes('here') && await pressRegion('here');
  await frames(H, 300);
  const away = await H.evaluate(c => [HOST.collab.internals().hereSet, HOST.room.src, JSON.parse(localStorage.getItem('collabHere') || '{}')[c]], code);
  await H.evaluate(() => window.__xr.end());
  await H.evaluate(installXR, Object.assign({}, xrOpts, { mode: 'immersive-vr', head: [0.3, 1.7, -0.2, 0.6] }));
  await H.evaluate(() => window.__xr.begin());
  await frames(H, 300);
  const shut = await H.evaluate(() => !HOST.collab.menu);   // (asked already: the menu stays closed)
  await H.evaluate(() => HOST.collab.panelOpen(true));
  await frames(H, 150);
  const again = !shut || (await regionIds()).some(id => id.startsWith('ask:'));
  check('VR: the panel asks once whether you are in the room with the others (In this room: aligned with them; Say I am elsewhere: your own floor; kept for the room)',
    asked && inRoom[0] === true && inRoom[1] !== 'own' && sayAway && away[0] === false && away[1] === 'own' && away[2] === false && !again,
    JSON.stringify({ asked, inRoom, sayAway, away, again }));
  // Exit (leaving VR or AR) is inside the headset's menu, and not on the story panel; closed, only the clock shows
  await H.evaluate(() => HOST.collab.panelOpen(false));
  await frames(H, 200);
  const exitClosed = await H.evaluate(() => { const O = HOST.collab.overlay(); return O.clockG.visible && !O.panelG.visible && !O.panel.regions.some(x => x.id === 'exit'); });
  await H.evaluate(() => HOST.collab.panelOpen(true));
  await frames(H, 200);
  const exitT = await H.evaluate(() => {
    const s = HOST.session, e0 = s.end, P = HOST.collab.overlay().panel, r = P.regions.find(x => x.id === 'exit');
    let n = 0; s.end = () => { n++; };
    if (r) r.fn();
    if (e0) s.end = e0; else delete s.end;
    return { found: !!r, ended: n, story: HOST.cur.peek("XR.main.regions.some(r => r.id === 'exit')") };
  });
  await H.evaluate(() => HOST.collab.panelOpen(false));
  check('Exit is inside the headset\'s menu (not on the closed clock) and ends the session; the story panel has none', exitClosed && exitT.found && exitT.ended === 1 && exitT.story === false,
    JSON.stringify(Object.assign({ exitClosed }, exitT)));

  // ------------------------------------------- a fresh shared space --
  // Fresh shared space (two presses): every page in the room moves to the app under s/<n>/ (a new page address, so
  // Quest Browser gives the headsets a new shared space) and joins the room again there; a headset arriving there is
  // told to start one headset first; a page opened at the old address later is moved too, and the log has the
  // whole address. In a room of its own, so the other pages stay where they are
  const Fp1 = await open('');
  await Fp1.evaluate(() => HOST.collab.create());
  await until(Fp1, () => !!HOST.collab.code && HOST.collab.status === 'open', null, 8000);
  const fcode = await Fp1.evaluate(() => HOST.collab.code);
  const Fp2 = await open('#s=' + fcode);
  await until(Fp2, c => HOST.collab.code === c && HOST.collab.status === 'open' && HOST.collab.members.length === 2 && HOST.collab.internals().served === true, fcode, 8000);   // (Fresh needs to know the relay serves the page)
  const fOnce = await Fp2.evaluate(() => { HOST.collab.fresh(); return HOST.collab.val('sg'); });   // armed only
  await Fp2.evaluate(() => HOST.collab.fresh());
  const fMoved = await Promise.all([Fp1, Fp2].map(P => P.waitForURL(/\/s\/1\/(index\.html)?#/, { timeout: 15000 }).then(() => true, () => false)));
  const fBack = await Promise.all([Fp1, Fp2].map(P => P.waitForFunction(c => typeof HOST !== 'undefined' && HOST.collab && HOST.collab.code === c && HOST.collab.status === 'open' &&
    HOST.collab.internals().served === true, fcode, { timeout: 20000, polling: 100 }).then(() => true, () => false)));
  const fFin = await Fp1.evaluate(() => ({ gen: HOST.collab.gen, path: location.pathname, relay: HOST.collab.relay, note: HOST.collab.internals().note, story: HOST.curKey }));
  check('fresh shared space: two presses move every page in the room to the app under s/1/, where they join the room again (the relay still at the root)',
    !fOnce && fMoved.every(Boolean) && fBack.every(Boolean) && fFin.gen === 1 && /\/s\/1\/$/.test(fFin.path) && !/\/s\//.test(fFin.relay) && /fresh shared space/.test(fFin.note || ''),
    JSON.stringify({ fOnce, fMoved, fBack, fFin }));
  await Fp2.evaluate(() => HOST.start('airports'));
  await ready(Fp2, 'airports');
  await Fp2.evaluate(installXR, Object.assign({}, xrOpts, { sharedId: 'U9', shared: SHARED }));
  await Fp2.evaluate(() => window.__xr.begin());
  await frames(Fp2, 1200);
  const fXr = await Fp2.evaluate(() => { const L = window.__collabLog, s = L.filter(e => e.ev === 'session').pop() || {};
    return { told: L.some(e => e.ev === 'notice' && e.title === 'A fresh shared space'), page: s.page, sg: s.sg, search: s.search }; });
  await Fp2.evaluate(() => window.__xr.end());
  const Fp3 = await open('?probe=1#s=' + fcode);
  const fp3 = await Fp3.waitForURL(/\/s\/1\/\?probe=1#/, { timeout: 15000 }).then(() => true, () => false);
  const f3In = fp3 && await Fp3.waitForFunction(c => typeof HOST !== 'undefined' && HOST.collab && HOST.collab.code === c && HOST.collab.status === 'open', fcode, { timeout: 20000, polling: 100 }).then(() => true, () => false);
  check('fresh shared space: a headset there is told to start one headset first, its log has the whole address; a page opened at the old address is moved too (its query kept)',
    fXr.told && /\/s\/1\/$/.test(fXr.page || '') && fXr.sg === 1 && fXr.search === '' && fp3 && f3In, JSON.stringify({ fXr, fp3, f3In }));
  // a page at a fresh address in a room with no generation (a relay restarted, a link to a new room) stays there and
  // gives the room its generation, instead of going back to the old address
  const Fp4 = await (await browser.newContext({ viewport: { width: 640, height: 400 } })).newPage();
  Fp4.on('pageerror', e => errors.push(e.stack || e.message));
  await Fp4.goto(base() + 's/1/index.html', { timeout: 90000 });
  await Fp4.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });   // (as open(): a busy machine loads slowly)
  await Fp4.evaluate(() => HOST.collab.create());
  const f4 = await until(Fp4, () => !!HOST.collab.code && HOST.collab.status === 'open' && !!HOST.collab.val('sg'), null, 10000);
  await sleep(1500);
  const f4s = await Fp4.evaluate(() => ({ path: location.pathname, sg: HOST.collab.val('sg'), gen: HOST.collab.gen }));
  check('fresh shared space: a page at s/1/ in a room with no generation stays there and gives the room generation 1',
    f4 && /\/s\/1\/$/.test(f4s.path) && f4s.gen === 1 && !!f4s.sg && f4s.sg.n === 1, JSON.stringify({ f4, f4s }));
  await Promise.all([Fp1, Fp2, Fp3, Fp4].map(P => P.context().close()));

  // ------------------------------------------- a room on this device --
  // no relay known (a copy on a plain web host): a room still works on the page alone, kept in its storage
  const lctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
  await lctx.route('**/api/**', r => r.abort());   // this host answers no relay calls
  const Lp = await lctx.newPage();
  Lp.on('pageerror', e => errors.push(e.stack || e.message));
  Lp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  const lopen = async () => { await Lp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 }); };
  await Lp.goto(base() + 'index.html#s=LCL', { timeout: 90000 }); await lopen();
  const lj = await until(Lp, () => HOST.collab.code === 'LCL' && HOST.collab.local && HOST.collab.status === 'open', null, 8000);
  check('no relay known: a link opens its room on this device', lj, JSON.stringify(await Lp.evaluate(() => [HOST.collab.code, HOST.collab.local, HOST.collab.status, HOST.collab.relay])));
  await Lp.evaluate(() => { HOST.collab.arrange({ x: 0, z: 0, yaw: 0 }); });
  await until(Lp, () => HOST.collab.stations().length === HOST.list.length && !HOST.collab.internals().pending.size, null, 3000);
  const lsid = await stationOf(Lp, OTHER_STORY);
  await Lp.evaluate(id => { HOST.collab.move(id, { x: 0.5, z: -3, yaw: 0.2 }); HOST.collab.lock(true); }, lsid);
  check('a room on this device: Arrange all, moving a station and the lock work alone', await until(Lp, () => HOST.collab.stations().length === HOST.list.length && HOST.collab.locked &&
    !HOST.collab.internals().pending.size, null, 3000));
  // the headsets' settings in a room on this device: the room's too (with the layout locked), and kept with it
  await Lp.evaluate(() => { HOST.xr.setLabels('hidden'); HOST.xr.setFree(false); });
  const llook = await until(Lp, () => JSON.stringify(HOST.collab.look()) === '{"labels":"hidden","free":false}' && !HOST.collab.internals().pending.size, null, 3000);
  await sleep(700);   // kept at most 0.4 s after a change
  await Lp.reload({ timeout: 90000 }); await lopen();
  const lk = await until(Lp, id => HOST.collab.code === 'LCL' && HOST.collab.local && HOST.collab.stations().length === HOST.list.length && HOST.collab.locked &&
    HOST.collab.station(id) && HOST.collab.station(id).z === -3 && HOST.collab.kept().some(r => r.code === 'LCL' && r.stations === HOST.list.length), lsid, 8000);
  check('a room on this device: kept across a reload (stations, places, the lock)', lk, JSON.stringify(await Lp.evaluate(() => [HOST.collab.code, HOST.collab.local, HOST.collab.stations().length, HOST.collab.locked, HOST.collab.kept()])));
  const llook2 = await until(Lp, () => HOST.collab.code === 'LCL' && JSON.stringify(HOST.collab.look()) === '{"labels":"hidden","free":false}' && HOST.xr.labels() === 'hidden' && !HOST.xr.free(), null, 8000);
  check('a room on this device: the headsets\' settings are the room\'s (set with the layout locked) and kept across a reload', llook && llook2,
    JSON.stringify(await Lp.evaluate(() => [HOST.collab.look(), HOST.xr.labels(), HOST.xr.free()])));
  await Lp.evaluate(() => { HOST.collab.lock(false); HOST.xr.setLabels('fixed'); HOST.xr.setFree(true); });
  await ready(Lp, 'airports');
  // a headset alone (no shared space): the stations stand on its floor; the panel has Re-align, not the question
  // whether it is in the room with the others; walking up to a station plays its story there
  await Lp.evaluate(installXR, Object.assign({}, xrOpts, { mode: 'immersive-vr', features: ['local-floor', 'anchors'] }));
  await Lp.evaluate(() => window.__xr.begin());
  await frames(Lp, 400);
  const lf = await Lp.evaluate(() => ({ src: HOST.room.src, aligned: HOST.room.aligned, o: HOST.room.frame && HOST.room.frame.o, ids: HOST.collab.overlay().panel.regions.map(r => r.id) }));
  check('a room on this device, in a headset: the stations stand on its floor, and the panel offers Re-align (no question about the others)',
    lf.src === 'floor' && lf.aligned && near(lf.o, [0, 0, 0], 1e-6), JSON.stringify(lf));
  await Lp.evaluate(() => HOST.collab.panelOpen(true));
  await frames(Lp, 100);
  const lids = await Lp.evaluate(() => HOST.collab.overlay().panel.regions.map(r => r.id));
  // (the menu at its tallest, a room on this headset with a three-line note: You and its colours still on it)
  const lfit = await Lp.evaluate(() => {
    const X = window.__xr, C = HOST.collab.internals(), S = HOST.collab.overlay().panel, keep = C.note;
    const fits = () => { const c = S.regions.find(x => x.id === 'col:7'); return !!c && c.y + c.h <= S.vis && S.vis <= S.h; };
    const plain = fits();
    C.note = 'A note three lines long: the relay could not be reached, so this room stays on this headset until one answers, and nobody else can join it yet.';
    S.sig = ''; X.step(); X.step();
    const out = { plain, tall: fits(), vis: S.vis, h: S.h };
    C.note = keep; S.sig = ''; X.step();
    return out;
  });
  const lfits = lfit.plain && lfit.tall;
  const lre = lfits && lids.includes('realign') && !lids.includes('here') && !lids.some(id => id.startsWith('ask:')) &&
    await Lp.evaluate(() => { HOST.collab.overlay().panel.regions.find(r => r.id === 'realign').fn(); return !!HOST.room.internals().again; });
  await frames(Lp, 200);
  const lre2 = await Lp.evaluate(() => ({ again: HOST.room.internals().again, src: HOST.room.src, note: window.__collabLog.filter(e => e.ev === 'notice').slice(-1)[0] }));
  check('a room on this device: Re-align with nothing to line up with keeps the stations where they are (the menu fits, also with a long note)', lre && !lre2.again && lre2.src === 'floor' &&
    lre2.note && lre2.note.title === 'Nothing to re-align to', JSON.stringify({ lids, lfit, lre, lre2 }));
  const ROOM0 = ROOM;
  ROOM = FLOOR;   // this headset's room is its floor
  const lS = await Lp.evaluate(k => HOST.collab.stations().find(s => s.story === k), HEADSET_STORY);
  const lw = await walk(Lp, lS, HEADSET_STORY, 0.2);
  const lrig = await rigOf(Lp), lwant = rigAt(lS);
  ROOM = ROOM0;
  check('a room on this device, in a headset: a second at a station plays its story there', lw && near(lrig.slice(0, 3), lwant.slice(0, 3), 1e-4), `rig ${fmt(lrig)}, want ${fmt(lwant)}`);
  // a relay entered later: the room goes there (made from this device's copy), and others can join it; the headset
  // keeps its placement and is not asked whether it is with the others
  await lctx.unroute('**/api/**');
  await Lp.evaluate(u => HOST.collab.setRelay(u), base().replace(/^http/, 'ws'));
  const lback = await until(Lp, () => { window.__xr.step(); return !HOST.collab.local && HOST.collab.status === 'open'; }, null, 10000);
  await frames(Lp, 400);
  const lkeep = await Lp.evaluate(() => ({ src: HOST.room.src, o: HOST.room.frame && HOST.room.frame.o, ask: HOST.collab.overlay().panel.regions.some(r => r.id.startsWith('ask:')), here: HOST.collab.internals().hereSet }));
  check('moving to the relay, the headset keeps its placement (no question about the others)', lkeep.src === 'floor' && near(lkeep.o || [9, 9, 9], [0, 0, 0], 1e-6) && !lkeep.ask && lkeep.here === true, JSON.stringify(lkeep));
  await Lp.evaluate(() => window.__xr.end());
  const linfo = lback ? await until(Lp, () => !HOST.collab.internals().pending.size, null, 5000) && await roomInfo('LCL') : null;
  const ist = linfo ? Object.keys(linfo.keys).filter(k => /^st\.[\w-]+$/.test(k)).length : 0;
  check('a room on this device goes to a relay once one answers, with its stations', lback && ist === NST && linfo.keys['st.' + lsid].v.z === -3, JSON.stringify({ lback, ist }));
  const Lo = await open('#s=LCL');
  check('and another device joins it there', await st7(Lo));
  await Lo.context().close();
  await lctx.close();
  // a relay that cannot be reached as the room is joined: the room goes on, on this device
  const uctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
  const Up = await uctx.newPage();
  Up.on('pageerror', e => errors.push(e.stack || e.message));
  await Up.goto(base() + 'index.html#s=QQQ&relay=' + encodeURIComponent('ws://127.0.0.1:9'), { timeout: 90000 });
  await Up.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });
  check('a relay that cannot be reached: the room opens on this device instead', await until(Up, () => HOST.collab.code === 'QQQ' && HOST.collab.local && HOST.collab.status === 'open', null, 10000),
    JSON.stringify(await Up.evaluate(() => [HOST.collab.code, HOST.collab.local, HOST.collab.status, window.__collabLog.filter(e => /local|close|join/.test(e.ev)).slice(-5)])));
  await uctx.close();

  // ------------------------------------------------------ pictures --
  if (shots) {
    fs.mkdirSync(shots, { recursive: true });
    // another person in VR (page C), standing at the room's middle and pointing at H
    const Sf = S1;
    await C.evaluate(installXR, Object.assign({}, xrOpts, { mode: 'immersive-vr', head: [0.3, 1.7, -0.2, 0.6] }));
    await C.evaluate(() => { HOST.collab.me({ name: 'Grace', color: '#ff5ad9' }); window.__xr.begin(); });
    await frames(C, 300);
    // both in their own frames (made from the same spot): room coordinates agree
    await H.evaluate(() => { HOST.collab.me({ name: 'Ada', color: '#3ee08f' }); });
    const goRoom = (p, x, y, z, yaw) => p.evaluate(([x, y, z, yaw]) => {
      const X = window.__xr, R = HOST.room.internals(), v = new THREE.Vector3(x, y, z).applyMatrix4(R.m).applyMatrix4(X.W.local);
      const a = yaw + R.yaw + Math.atan2(-X.W.local.elements[2], X.W.local.elements[0]);
      X.head([v.x, v.y, v.z, a]);
    }, [x, y, z, yaw]);
    await goRoom(H, Sf.x, 1.6, Sf.z, Sf.yaw);
    await frames(H, 1300);
    await ready(H, HEADSET_STORY, 40000);
    await goRoom(C, 0.4, 1.65, -0.3, Math.atan2(-(Sf.x - 0.4), -(Sf.z + 0.3)));
    await C.evaluate(([x, z]) => {
      const X = window.__xr, R = HOST.room.internals(), L = X.W.local;
      const o = new THREE.Vector3(0.6, 1.3, -0.4).applyMatrix4(R.m).applyMatrix4(L), t = new THREE.Vector3(x, 0, z).applyMatrix4(R.m).applyMatrix4(L);
      X.ctrl(0, o.toArray(), t.sub(o).normalize().toArray());
    }, [Sf.x * 0.5 + 1.2, Sf.z * 0.5 - 1.2]);   // pointing at the floor, off to the side (seen from H)
    await frames(C, 600);
    await frames(H, 400);
    // render what H sees from its head, looking at yaw (room) and pitch
    const view = async (file, yawRoom, pitch) => {
      const url = await H.evaluate(([yawRoom, pitch]) => {
        const X = window.__xr, R = HOST.room.internals(), r = HOST.renderer;
        const loop = HOST.cur.peek('frame');
        r.setAnimationLoop(null);
        HOST.cur.peek('(xrPlace(), xrUpdate(APP.mode === "story" ? storyState(storyT(APP.t)) : XS), XR.panels.forEach(P => { P.last = ""; P.t = -1e9; panelTick(P, performance.now() + 1e6); }))');
        HOST.collab.internals().pumpAt = 0;
        for (const cb of X.raf.splice(0)) cb(performance.now(), X.frame);
        const hp = new THREE.Vector3().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert());
        const cam = new THREE.PerspectiveCamera(84, r.domElement.width / r.domElement.height, 0.05, 2000);
        cam.position.copy(hp);
        cam.quaternion.setFromEuler(new THREE.Euler(pitch, yawRoom + R.yaw, 0, 'YXZ'));
        const sc = HOST.cur.peek('GL.scene');
        sc.updateMatrixWorld(true);
        r.render(sc, cam);
        const u = r.domElement.toDataURL('image/png');
        r.setAnimationLoop(loop);
        return u;
      }, [yawRoom, pitch]);
      fs.writeFileSync(path.join(shots, file), Buffer.from(url.split(',')[1], 'base64'));
    };
    const face = Math.atan2(-(0.4 - Sf.x), -(-0.3 - Sf.z));
    await view('headset-people.png', face, -0.12);
    await H.evaluate(() => HOST.collab.panelOpen(true));
    await frames(H, 200);
    await view('headset-panels.png', Sf.yaw + 0.85, -0.18);
    // the menu's clock on a left controller held low in front (closed), and the menu open above it
    await H.evaluate(yaw => {
      const X = window.__xr, V = THREE.Vector3, Y = yaw + HOST.room.internals().yaw;
      const hp = new V().setFromMatrixPosition(X.W.head).applyMatrix4(X.W.local.clone().invert());
      const lp = hp.add(new V(-Math.sin(Y), 0, -Math.cos(Y)).multiplyScalar(0.45)).add(new V(-Math.cos(Y), -5, Math.sin(Y)).multiplyScalar(0.06));
      X.aim(1, new THREE.Matrix4().compose(lp, new THREE.Quaternion().setFromAxisAngle(new V(0, 1, 0), Y), new V(1, 1, 1)));
      HOST.collab.panelOpen(false);
    }, Sf.yaw);
    await frames(H, 300);
    await view('headset-clock.png', Sf.yaw, -0.55);
    await H.evaluate(() => HOST.collab.panelOpen(true));
    await frames(H, 300);
    await view('headset-menu.png', Sf.yaw, -0.13);
    await H.evaluate(() => { const c = HOST.cur.peek('XR.ctrls')[1]; c.g.visible = false; c.src = null; window.__xr.session.inputSources.length = 0; });
    // the page's dialog with the room map, on a desktop and on a phone
    await A.setViewportSize({ width: 1000, height: 760 });
    const alive = Promise.all([frames(H, 3500), frames(C, 3500)]);   // the two headsets keep sending where they are
    await sleep(1200);
    await A.evaluate(() => HOST.collab.dialog(true));
    await sleep(900);
    await A.screenshot({ path: path.join(shots, 'dialog-desktop.png') });
    await alive;
    const P = await open('#s=' + code, { width: 390, height: 844 });
    await st7(P);
    await P.evaluate(() => HOST.collab.dialog(true));
    await sleep(900);
    await P.screenshot({ path: path.join(shots, 'dialog-phone.png') });
    await P.evaluate(() => document.querySelector('#shared .box').scrollTo(0, 420));
    await sleep(300);
    await P.screenshot({ path: path.join(shots, 'dialog-phone-2.png') });
    console.log('pictures in ' + shots);
  }
} catch (e) {
  console.log('FAIL ' + (e.stack || e.message));
  fails.push('exception');
} finally {
  await browser.close();
  await stopRelay();
}
if (errors.length) { console.log('\npage errors:\n' + errors.join('\n\n')); fails.push('page errors'); }
if (fails.length) { console.log(`\n${fails.length} failed`); process.exit(1); }
console.log('\nall good');
