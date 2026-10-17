// Headless test of shared rooms (docs/shared-space-plan.md, section 9).
//   node tools/collab.mjs [--shots <dir>]
// It starts its own relay (relay/server.mjs --static .) on a free port, so no other server is needed, and
// checks: a page served by the relay starts a room; a mistyped code makes no room; Arrange all's two rows; three
// pages see the same stations; Remove asks first; per story in STORIES (below) play, pause, a jump and mode
// changes reach a following page (within 5 s: a busy machine is slow), the explore state round-trips both ways
// and the story's effect reaches the others; two people changing different controls at once both keep their
// change; a switch asked for while a story loads is not lost; a story picked by hand stops following; no writes
// while idle (no ping-pong); a late joiner gets everything; a relay restart is survived; a pretend headset (fake local-floor and shared spaces,
// as tools/smoke.mjs pretends) aligns from a published frame, stands at its station, stays there when taken off
// and on again, restarts nothing with Start on its Stories screen, sends its rays in room coordinates, re-aligns
// when the frame moves, switches story by walking to another station (and takes its state), lets the story's
// own panel win over a card behind it; a headset without a shared space calibrates from two marks (its panel's
// Stop calibrating still works), saves the frame with an anchor at mark A and finds it again next time; a VR
// headset asks once whether it is in the room, and takes its own floor when elsewhere. --shots also saves
// pictures (the Shared dialog on a desktop and a phone, two pretend headset views). --quick runs only the last
// story of STORIES in the per-story part (for a quicker run while working on the rest); --port N runs the relay on
// port N (default: any free port).
// Needs Playwright as tools/smoke.mjs does (PLAYWRIGHT_MODULE, CHROMIUM_PATH). Exits 1 on any failure.
//
// Adding a story: give it its hooks (the plan's section 7, as the flock has them), then an entry in STORIES:
//   change / back: code (run with HOST.cur.peek) that changes the story's shared explore state, and changes it
//                  again differently (both must change what collab.state() returns)
//   effect (optional): quiet stops the story's own effects, idle is true when none is playing, send causes one
//                  (calling HOST.collab.effect), seen is true on the other page once it plays there
//   more (optional): async (A, B) => more checks of its own, after the effect (A changed things, B follows)
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
  },
};
// the stories a pretend headset walks between: its own (the last in STORIES, whose station has an explore clock and
// stored state; the flock's sky catches every ray, so its rays have a length), another, and one whose card it picks
const HEADSET_STORY = 'flock', OTHER_STORY = 'spatial', PICK_STORY = 'proteins';

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
const fmt = a => '[' + a.map(v => (+v).toFixed(4)).join(', ') + ']';
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
  await page.goto(base() + 'index.html' + hash);
  await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 30000 });
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
    requestPersistentHandle: () => { const u = 'room' + ++X.n + Math.random().toString(36).slice(2, 6); X.handles.set(u, w); return Promise.resolve(u); } }; return a; };
  X.frame = {
    getPose: (s, b) => pose(world(b).clone().invert().multiply(world(s))),
    getViewerPose: b => pose(world(b).clone().invert().multiply(X.W.head)),
    createAnchor(t, b) {
      const w = world(b).clone().multiply(new THREE.Matrix4().compose(V(t.position.x, t.position.y, t.position.z),
        new THREE.Quaternion(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w), V(1, 1, 1)));
      X.made.push({ p: [t.position.x, t.position.y, t.position.z], space: b.name });
      return Promise.resolve(mkAnchor(w));
    },
  };
  X.sl = [];
  X.session = { mode: o.mode, enabledFeatures: o.features, visibilityState: 'visible', renderState: {},
    addEventListener(t, fn) { if (t === 'visibilitychange') X.sl.push(fn); }, removeEventListener(t, fn) { X.sl = X.sl.filter(f => f !== fn); },
    requestReferenceSpace: t => (t === 'local' || o.features.includes(t) ? Promise.resolve(X.spaces[t]) : Promise.reject(new Error(t + ' not supported'))),
    requestAnimationFrame(cb) { X.raf.push(cb); return X.raf.length; },
    restorePersistentAnchor: u => (X.handles.has(u) ? Promise.resolve(mkAnchor(X.handles.get(u))) : Promise.reject(new Error('unknown'))),
    deletePersistentAnchor: u => { X.handles.delete(u); return Promise.resolve(); } };
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

let code = '';
try {
  await startRelay(relayPort);
  // ------------------------------------------------------------ rooms --
  const A = await open('#stories');
  check('a page served by the relay finds it', await A.evaluate(async () => { await HOST.collab.detect(); return HOST.collab.relay === location.origin; }));
  await A.evaluate(() => HOST.collab.create());
  check('a page starts a room', await until(A, () => HOST.collab.status === 'open' && /^#s=[A-Z]{3}$/.test(location.hash), null, 10000));
  code = await A.evaluate(() => HOST.collab.code);
  await A.evaluate(() => HOST.collab.arrange({ x: 0, z: 0, yaw: 0 }));
  check('Arrange all makes the seven stations', await until(A, () => HOST.collab.stations().length === 7 && !HOST.collab.internals().pending.size, null, 3000));
  const B = await open('#s=' + code), C = await open('#s=' + code);
  const st7 = p => until(p, () => HOST.collab.status === 'open' && HOST.collab.stations().length === 7, null, 20000);
  await st7(B); await st7(C);
  const sts = p => p.evaluate(() => JSON.stringify(HOST.collab.stations()));
  const sa = await sts(A);
  check('three pages in the room see the same stations', sa === await sts(B) && sa === await sts(C));
  const others = [B, C];
  // Arrange all (from the room's origin, facing -z): a row of 4 spots 1.2 m ahead and 3 in the gaps 2.6 m behind,
  // 2.4 m apart, all facing away (so a station's own 1.1 m zone never touches another's)
  const arranged = JSON.parse(sa), keys = await A.evaluate(() => HOST.list.map(m => m.key));
  const wantSpot = i => (i < 4 ? [(i - 1.5) * 2.4, -1.2] : [(i - 5) * 2.4, -3.8]);
  const spotsOk = keys.every((k, i) => { const s = arranged.find(x => x.story === k); return s && near([s.x, s.z], wantSpot(i), 1e-3) && Math.abs(s.yaw) < 1e-3; });
  let closest = Infinity;
  for (const a of arranged) for (const b of arranged) if (a !== b) closest = Math.min(closest, Math.hypot(a.x - b.x, a.z - b.z));
  check('Arrange all: two rows (4 + 3), spots 2.4 m apart, the rows 2.6 m apart, all facing away from you', spotsOk && closest > 2.2 - 1e-6,
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
  // (both presses in one go, 0.3 s apart: a busy page could take longer than the 3 s the first one lasts)
  const rm = await A.evaluate(async id => {
    const q = () => document.querySelector(`[data-sh="remove:${id}"]`);
    q().click();
    await new Promise(r => setTimeout(r, 300));
    const text = q() && q().textContent, still = !!HOST.collab.station(id);
    q().click();
    return { text, still };
  }, rmId);
  const gone = await until(B, id => !HOST.collab.station(id), rmId, 5000);
  check('Remove asks first (Remove for everyone?), and a second press removes the station for everyone', rm.text === 'Remove for everyone?' && rm.still && gone,
    `first press: ${rm.text}, still there ${rm.still}, then gone ${gone} (A: ${await A.evaluate(id => !!HOST.collab.station(id), rmId)})`);
  await A.evaluate(() => { HOST.collab.dialog(false); HOST.collab.arrange({ x: 0, z: 0, yaw: 0 }); });
  await st7(B); await st7(C);

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
    // software WebGL can, falls behind between two checks: the stories cap a frame's step at 0.1 s)
    const run = await B.evaluate(() => new Promise(r => {
      const C = HOST.collab.internals(), p0 = C.pumpAt;
      const iv = setInterval(() => { if (C.pumpAt !== p0) { clearInterval(iv); r(HOST.cur.peek('APP.t')); } }, 1);
    }));
    const ran = from + (Date.now() - t0) / 1000;
    check(`${key}: a playing station runs on the relay's clock (a following page keeps up)`, Math.abs(run - ran) < 0.45, `B at ${run.toFixed(2)} s, ${ran.toFixed(2)} s since play`);
    await peek(A, 'APP.togglePlay()');
    const paused = await until(B, () => !HOST.cur.peek('APP.playing'), null, 5000);
    const [ca, cb] = [await clockOf(A), await clockOf(B)];
    await sleep(500);
    const cb2 = await clockOf(B);
    check(`${key}: pause reaches it, at the same moment, and it stays there`, paused && Math.abs(ca[2] - cb[2]) < 0.3 && Math.abs(cb2[2] - cb[2]) < 0.02, `A ${ca}, B ${cb}, then ${cb2}`);
    await peek(A, 'APP.seek(20)');
    check(`${key}: a jump reaches it`, await until(B, () => Math.abs(HOST.cur.peek('APP.t') - 20) < 0.3, null, 5000));
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
    if (T.more) await T.more(A, B);
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
  const before = await roomInfo(code), keep = port;
  await stopRelay();
  await sleep(400);
  await startRelay(keep);
  const back = p => until(p, () => HOST.collab.status === 'open' && HOST.collab.stations().length === 7, null, 25000);
  const allBack = (await Promise.all([A, ...others].map(back))).every(Boolean);
  const after = await roomInfo(code).catch(() => ({ keys: {} }));
  const kx = 'st.' + id0 + '.x';
  check('a relay restart is survived: the room comes back with its stations and state', allBack && Object.keys(after.keys || {}).filter(k => /^st\.[\w-]+$/.test(k)).length === 7 &&
    JSON.stringify(after.keys[kx] && after.keys[kx].v) === JSON.stringify(before.keys[kx].v), JSON.stringify(after.keys && after.keys[kx]));
  await peek(A, STORIES[key0].change);
  const sR = await stateOf(A);
  check('and a change after the restart still reaches the others', await until(B, s => JSON.stringify(HOST.cur.collab.state()) === s, sR, 5000));

  // ------------------------------------------------- a pretend headset --
  const H = await open('#s=' + code);
  await st7(H);
  await ready(H, 'airports');
  const aId = await A.evaluate(() => HOST.collab.id);
  await A.evaluate(f => HOST.collab.publish([['roomFrameShared', f]]), frameFor(ROOM, 'U1', aId, Date.now() - 60000));
  await until(A, () => !HOST.collab.internals().pending.size, null, 3000);   // stored before the headset's writes are counted
  const xrOpts = { mode: 'immersive-ar', features: ['local-floor', 'anchors', 'shared'], local: LOCAL, floor: FLOOR, shared: SHARED, sharedId: '', head: [0, 1.6, 0, 0] };
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
  check('headset: at the station, HOST.anchor holds the place and locks all but panels', await H.evaluate(() => HOST.anchor.held() && HOST.anchor.locked('globe') && !HOST.anchor.locked('panel')));
  const wrote = Object.entries((await roomInfo(code)).keys).filter(([, e]) => e.seq > q2).map(([k, e]) => `${k} by ${e.by === hId0 ? 'the headset' : e.by}`);
  check('headset: arriving at a station and starting a session write nothing', !wrote.length, wrote.join(', '));
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
  await frames(H, 500);
  const hId = await H.evaluate(() => HOST.collab.id);
  const seen = await A.evaluate(id => { const P = HOST.collab.people().get(id); return P && P.head ? { head: P.head, hands: P.hands, st: P.st } : null; }, hId);
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
  // pointing with the trigger: the shell's panel (its Open button) and another station's card take the press
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
  const openAt = await H.evaluate(() => {
    const S = HOST.collab.overlay().panel, r = S.regions.find(x => x.id === 'open');
    if (!r || !S.mesh.parent.visible) return null;
    const H = S.mw * S.h / S.w, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    return S.mesh.localToWorld(new THREE.Vector3((cx / S.w - 0.5) * S.mw, (0.5 - cy / S.vis) * H, 0)).toArray();
  });
  if (openAt) await press(openAt);
  check('headset: the shell\'s panel beside the story panel takes the trigger (Open)', !!openAt && await H.evaluate(() => HOST.collab.overlay().panel.vis > 200));
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
  // the room frame moves (newer marks elsewhere): this headset follows within a second
  ROOM = [2.05, 0, 1, 0.3];
  await A.evaluate(f => HOST.collab.publish([['roomFrameShared', f]]), frameFor(ROOM, 'U1', aId, Date.now()));
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
  const touch = async p => { await H.evaluate(p => { window.__xr.ctrl(0, p, [0, -1, 0]); HOST.cur.peek('XR.ctrls[0].wantPress = true'); }, p); await frames(H, 80); };
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
  await touch([markA[0] + 0.1, markA[1], markA[2] + 0.05]);
  const stClose = await H.evaluate(() => HOST.room.state);
  await touch(markB);
  await frames(H, 200);
  const cal = await H.evaluate(() => ({ frame: HOST.room.frame, src: HOST.room.src, saved: JSON.parse(localStorage.getItem('roomFrame') || 'null'), made: window.__xr.made }));
  const fa = unapply(FLOOR, markA), fb = unapply(FLOOR, markB), cx = unit([fb[0] - fa[0], 0, fb[2] - fa[2]]);
  check('calibration: mark A, then a mark B too close is refused', stA === 'mark-b' && stClose === 'mark-b', `${stA}, ${stClose}`);
  check('calibration: two marks give the expected frame (A the origin, A to B the x axis)', cal.src === 'marks' && near(cal.frame.o, [fa[0], 0, fa[2]], 2e-3) && near(cal.frame.x, cx, 2e-3),
    `${cal.src} o ${fmt(cal.frame ? cal.frame.o : [])} x ${fmt(cal.frame ? cal.frame.x : [])}, want ${fmt(fa)} ${fmt(cx)}`);
  check('calibration: saved on the headset, with a persistent anchor at mark A', cal.saved && near(cal.saved.o, [fa[0], 0, fa[2]], 2e-3) && !!cal.saved.anchor &&
    cal.made.length === 1 && cal.made[0].space === 'local-floor' && near(cal.made[0].p, fa, 2e-3), JSON.stringify({ saved: cal.saved, made: cal.made }));
  // the Guardian origin moves within the session (a reset with a transform): the frame follows at once
  const F2 = [0.1, 0, -0.2, 0.2];
  const moved = await H.evaluate(([F, F2]) => {
    const X = window.__xr, V = (x, y, z) => new THREE.Vector3(x, y, z);
    const M = a => new THREE.Matrix4().compose(V(a[0], a[1], a[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a[3]), V(1, 1, 1));
    const oldFromNew = M(F).invert().multiply(M(F2));
    X.W.floor = M(F2);
    for (const fn of X.resets['local-floor'] || []) fn({ transform: { matrix: Float32Array.from(oldFromNew.elements), inverse: { matrix: Float32Array.from(oldFromNew.clone().invert().elements) } } });
    return HOST.room.frame;
  }, [FLOOR, F2]);
  const mo = unapply(F2, apply(FLOOR, [fa[0], 0, fa[2]])), mx = rot(-F2[3], rot(FLOOR[3], cx));
  check('a reset of local-floor with a transform moves the frame into the new coordinates', moved && near(moved.o, [mo[0], 0, mo[2]], 2e-3) && near(moved.x, mx, 2e-3),
    `${moved ? fmt(moved.o) + ' ' + fmt(moved.x) : 'no frame'}, want ${fmt(mo)} ${fmt(mx)}`);
  // next session (or a reload): the anchor at mark A brings the frame back
  await H.evaluate(() => window.__xr.end());
  await H.evaluate(installXR, Object.assign({}, xrOpts, { features: ['local-floor', 'anchors'] }));
  await H.evaluate(() => window.__xr.begin());
  for (let k = 0; k < 12 && !(await H.evaluate(() => HOST.room.src)); k++) await frames(H, 250);   // a busy machine draws few frames
  const re = await H.evaluate(() => ({ frame: HOST.room.frame, src: HOST.room.src }));
  check('calibration: the next session finds the frame again by its anchor', re.src === 'anchor' && re.frame && near(re.frame.o, cal.frame.o, 2e-3) && near(re.frame.x, cal.frame.x, 2e-3),
    `${re.src} ${re.frame ? fmt(re.frame.o) : ''} ` + await H.evaluate(() => JSON.stringify(window.__collabLog.slice(-10).map(e => [e.ev, e.state || e.src || e.e || '']))));
  await H.evaluate(() => window.__xr.end());

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
  const asked = (await regionIds()).includes('ask:in');
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
  const again = (await regionIds()).some(id => id.startsWith('ask:'));
  check('VR: the panel asks once whether you are in the room with the others (In this room: aligned with them; Say I am elsewhere: your own floor; kept for the room)',
    asked && inRoom[0] === true && inRoom[1] !== 'own' && sayAway && away[0] === false && away[1] === 'own' && away[2] === false && !again,
    JSON.stringify({ asked, inRoom, sayAway, away, again }));

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
