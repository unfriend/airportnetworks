// Does a refactor change what the built stories' headset code does? Drives each story's headset code by hand in two
// copies of the app (a pretend session object, controllers aimed by setting their matrices, xrEnterScene, xrRecenter,
// xrPlace, xrBegin in nine directions, xrUpdate, a trigger press and release, three grip-and-carry runs, a panel grip,
// xrFreshStart, xrEnded; nmd, endo and pet once more life size) and compares the recorded state, value by value.
// Written for step 1b of the packages plan (docs/agents/stories.md, "Shared engine parts"); a real headset is still the
// only test of controllers, comfort and sessions. Not covered: xrStart/xrAdopt (a real session), the thumbsticks,
// two-hand resize, robots' room capture, pass's fingertip, the design room's carrying.
// usage: node tools/engine/xrsame.mjs <before dir> <after dir> [--keys a,b] [--out dir]
import fs from 'fs';
import http from 'http';
import path from 'path';
const ARGS = process.argv.slice(2), opt = n => { const i = ARGS.indexOf(n); return i >= 0 ? ARGS[i + 1] : null; };
const A = path.resolve(ARGS[0]), B = path.resolve(ARGS[1]);
const OUT = opt('--out');
const KEYS = (opt('--keys') || 'lbi,nmd,endo,pet,micro,ovary,qubits,mutation,topo,soil,pass,flock,robots,tutorial,design').split(',');
const PRE = { nmd: 'X.room = true; X.scene = "tower";', endo: 'X.gap = true; X.scene = "syn";', pet: 'X.life = true; X.scene = "scan";' };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const serve = dir => new Promise(res => {
  const s = http.createServer((q, r) => {
    const p = path.join(dir, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
    if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(p).pipe(r);
  }).listen(0, '127.0.0.1', () => res(s));
});
const EX = `(() => {
  const O = {}, r = v => typeof v === 'number' ? +v.toFixed(4) : v, ra = a => Array.from(a, r);
  const upd = () => { GL.world.updateMatrix(); GL.rig.updateMatrix(); };
  const st = () => { upd(); return { w: ra(GL.world.matrix.elements), R: r(XR.R), hitR: r(XR.hitR), tg: ra(XR.target.toArray()), off: ra(XR.globeOff.toArray()),
    size: r(XR.size), rot: ra(XR.rot.toArray()), rig: ra(GL.rig.matrix.elements), room: XR.room, cap: XR.cap === undefined ? 'u' : r(XR.cap),
    stars: GL.stars ? [GL.stars.visible, GL.stars.material.size] : null, wv: GL.world.visible, stories: XR.stories, tipI: XR.tipI, held: orbit.held,
    on: XR.on, body: document.body.classList.contains('xr'), mode: APP.mode, scene: X.scene,
    life: XR.lifeOff ? [ra(XR.lifeOff.toArray()), ra(XR.lifeTo.toArray()), XR.lifeAt] : null, pf: XR.pf, pt: XR.pt, pick: XR.pick }; };
  orbit.to = null; orbit.cur = orbit.cur.map((v, i) => i === 0 ? 30 : Math.round(v * 10) / 10);   // (the idle sway: the same view in both copies)
  XR.session = { environmentBlendMode: 'opaque', renderState: {}, addEventListener() {}, removeEventListener() {} }; XR.mode = 'immersive-vr';
  xrEnterScene(); O.enter = st();
  XR.stories = false;
  XR.head.set(0, 0, 0); XR.headQ.set(0, 0, 0, 1);
  xrRecenter(); O.recenter = st();
  for (let i = 0; i < 8; i++) xrPlace(orbit.cur, 1 / 60);
  O.place = st();
  const c = XR.ctrls[0];
  c.src = { gamepad: { axes: [0, 0, 0, 0], buttons: [], hapticActuators: [] }, targetRayMode: 'tracked-pointer', handedness: 'right' };
  c.g.visible = true; c.g.matrixAutoUpdate = false;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  let at = V(0, 0, 0);
  const aim = (x, y, z) => { c.g.matrix.lookAt(at, V(x, y, z).add(at), V(0, 1, 0)); c.g.matrix.setPosition(at); c.g.matrixWorld.copy(c.g.matrix); };
  const ctl = () => ({ h: c.hover ? { k: c.hover.kind, i: c.hover.i, pk: c.hover.pk ? JSON.stringify(c.hover.pk) : c.hover.pk, key: c.hover.key, p: c.hover.point ? ra(c.hover.point.toArray()) : null } : null,
    z: r(c.ray.scale.z), dot: c.dot.visible, ds: r(c.dot.scale.x), press: c.press ? c.press.kind : null, grab: c.grab ? c.grab.target : null });
  const wc = new THREE.Vector3().setFromMatrixPosition(GL.world.matrixWorld);
  const dirs = [[wc.x, wc.y, wc.z], [0.3, -0.2, -1.2], [0.25, -0.15, -1.2], [0.35, -0.25, -1.2], [-0.56, 0.04, -0.86], [0, -1, -0.3], [0.2, -1, -0.8], [0, 0.5, -1], [1, 0, 0]];
  O.pts = [];
  for (const d of dirs) { aim(...d); xrBegin(null, 1 / 60); O.pts.push(ctl()); }
  xrUpdate({});
  O.lbl = [...LBL.extra, ...LBL.sets, ...(XR.tip ? [XR.tip] : [])].slice(0, 12).map(L => [L.sprite ? [L.sprite.visible, ra(L.sprite.scale.toArray())] : null, L.sign ? [L.sign.visible, ra(L.sign.scale.toArray())] : null]);
  O.tip = XR.tip ? JSON.stringify(XR.tip.txt) : null;
  // the trigger at the scene's centre, held a frame, then let go
  aim(wc.x, wc.y, wc.z); xrBegin(null, 1 / 60); c.wantPress = true; xrBegin(null, 1 / 60); O.press = ctl(); O.pressSt = st();
  xrRelease(c); O.release = ctl(); O.relSt = st();
  // the grip on the scene, the hand moved, let go
  for (const [n, d] of [[wc.x, wc.y, wc.z], [0.3, -0.2, -1.2], [0, -1, -0.3]].entries()) {
    at = V(0, 0, 0); aim(...d); xrBegin(null, 1 / 60); xrGrab(c, true); const g = ctl();
    at = V(0.1, 0.05, 0); aim(...d); xrBegin(null, 1 / 60); xrBegin(null, 1 / 60);
    O['grab' + n] = [g, ctl(), st()]; xrGrab(c, false); O['let' + n] = [ctl(), st()];
  }
  // the grip on the panel
  at = V(0, 0, 0); aim(-0.56, 0.04, -0.86); xrBegin(null, 1 / 60); xrGrab(c, true); O.pgrab = ctl();
  at = V(0, 0.1, 0); aim(-0.56, 0.04, -0.86); xrBegin(null, 1 / 60); O.panel = [ra(XR.panelGroup.position.toArray()), ra(XR.panelGroup.quaternion.toArray())]; xrGrab(c, false);
  at = V(0, 0, 0);
  xrRecenter(); O.recenter2 = st();
  return JSON.stringify(O);
})()`;
const END = `(() => { const r = v => typeof v === 'number' ? +v.toFixed(4) : v; xrFreshStart(); const f = [APP.mode, XR.stories, XR.needRecenter, XR.lifeTo ? XR.lifeTo.toArray() : null];
  xrEnded(); return JSON.stringify({ f, on: XR.on, stars: GL.stars ? [GL.stars.visible, GL.stars.material.size] : null, wv: GL.world.visible, cap: XR.cap, tipI: XR.tipI,
  w: Array.from(GL.world.matrix.elements, r), grabs: XR.ctrls.map(c => c.grab) }); })()`;
const sA = await serve(A), sB = await serve(B);
const url = s => `http://127.0.0.1:${s.address().port}/`;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const settle = ms => new Promise(r => setTimeout(r, ms));
async function run(ctx, base, key, errs) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(key + ': ' + (e.stack || e.message).split('\n').slice(0, 2).join(' | ')));
  p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(key + ': ' + m.text().slice(0, 200)); });
  await p.goto(`${base}index.html?nosw#${key}&t=0`);
  await p.waitForFunction(k => typeof HOST === 'object' && HOST.curKey === k && HOST.cur && HOST.cur.peek('LOAD.done'), key, { timeout: 180000 });
  await p.evaluate(() => HOST.cur.peek('APP.mode === "explore" || APP.enterExplore()'));
  await settle(2500);
  const out = {};
  const ev = async (n, s) => { try { out[n] = JSON.parse(await p.evaluate(s => HOST.cur.peek(s), s)); } catch (e) { out[n] = 'ERROR ' + e.message.split('\n')[0]; } };
  await ev('a', EX);
  if (PRE[key]) { await p.evaluate(s => HOST.cur.peek(s), PRE[key]); await ev('room', EX); }
  await ev('end', END);
  await p.close();
  return out;
}
const flat = (o, pre = '', acc = {}) => { if (o && typeof o === 'object') { for (const k of Object.keys(o)) flat(o[k], pre + '.' + k, acc); } else acc[pre] = o; return acc; };
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 }, serviceWorkers: 'block' });
await ctx.addInitScript(() => { try { localStorage.setItem('collabAutoWelcome', 'off'); localStorage.setItem('collabAutoAll', 'off'); localStorage.setItem('tutorialHold', 'off'); } catch (e) { /* */ } });
for (const key of KEYS) {
  const eA = [], eB = [];
  const [oA, oB] = await Promise.all([run(ctx, url(sA), key, eA), run(ctx, url(sB), key, eB)]);
  const fA = flat(oA), fB = flat(oB), keys = [...new Set([...Object.keys(fA), ...Object.keys(fB)])];
  const bad = keys.filter(k => {
    const a = fA[k], b = fB[k];
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) > 2e-3 * Math.max(1, Math.abs(a));
    return a !== b;
  });
  console.log(`${key.padEnd(9)} ${keys.length} values, ${bad.length} differ${bad.length ? ': ' + bad.slice(0, 12).map(k => `${k} ${JSON.stringify(fA[k])} -> ${JSON.stringify(fB[k])}`).join('; ') : ''}`);
  if (OUT) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `xr-${key}.json`), JSON.stringify({ before: oA, after: oB }, null, 1)); }
  const ea = [...new Set(eA)], eb = [...new Set(eB)];
  if (ea.length || eb.length) console.log('   errors before:', ea.join(' || ') || '-', '\n   errors after: ', eb.join(' || ') || '-');
}
await browser.close(); sA.close(); sB.close();
