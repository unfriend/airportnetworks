// Headless test of the room and depth test page (room-test/index.html), a test page that is not part of the app.
//   node tools/room-test.mjs
// It starts its own relay (--static . on port 8131, with --logs in a temporary folder) and drives the page with a
// pretend headset in headless Chromium: navigator.xr, XRWebGLLayer and XRWebGLBinding are stand-ins, and the frames are
// driven by hand through three.js r128's own WebXR path (its WebXRManager, the ArrayCamera, one sub-camera per eye). The
// pretend depth is a real WebGL2 texture array made in the page (near, 0.5 m, on the left half of each eye, far, 4 m, on
// the right), so Occlusion is checked by reading the framebuffer's pixels: a test pillar and the big panel hidden where
// the depth is nearer than them and not where it is farther, in both eyes, drawn by three.js and by raw WebGL. Also: the
// depth picture's colours, Room and Room hides with a pretend wall, floor and table (a pillar behind the wall hidden),
// pointing at the panel's buttons with a pretend controller, a session without depth, one whose browser refuses
// 'unsigned-short' (the ladder asks again) and one refused for another reason, CPU depth, depth close to a pillar's
// distance, an eye without depth, rows flipped (by hand and by the matrix), window depth for its own near and far, the
// frame times (the GPU's done-by time; Nothing asking for no depth), the autosave, the report's fields, Send to the
// relay. Each session's texture is new every frame and the layer has a framebuffer of its own. Needs Playwright with
// Chromium (as tools/smoke.mjs). Untested on a real Quest: that is what the page is for.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8131, base = `http://127.0.0.1:${PORT}/`;
const logs = fs.mkdtempSync(path.join(os.tmpdir(), 'room-test-logs-'));
const relay = spawn(process.execPath, ['relay/server.mjs', '--static', '.', '--port', String(PORT), '--host', '127.0.0.1', '--logs', logs, '--quiet'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
let relayOut = '';
relay.stdout.on('data', d => { relayOut += d; }); relay.stderr.on('data', d => { relayOut += d; });
const stop = () => { try { relay.kill(); } catch (e) { /* gone */ } };
process.on('exit', stop);
for (let i = 0; i < 50; i++) { try { if ((await fetch(base + 'api/health')).ok) break; } catch (e) { /* not yet */ } await new Promise(r => setTimeout(r, 100)); }

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const errors = [];
const step = async (name, fn) => { const n = errors.length; try { await fn(); } catch (e) { errors.push(name + ': ' + (e.stack || e.message)); } console.log((errors.length > n ? 'FAIL ' : 'ok   ') + name); };

// ------------------------------------------------------------------------------------------- the pretend headset
// o: { depth: 'gpu' | 'gpu16' (unsigned-short in an integer texture, in mm) | 'window' (a depth buffer's values for its own
// near and far, 0.1 and 20 m) | 'cpu' | 'none', room: bool, refuseUS: bool (a TypeError for 'unsigned-short'),
// split: 'x' (near on the left half, far on the right) | 'y' (near on the rows from 0, the top under the spec's
// convention), flip: bool (normDepthBufferFromNormView turns y over) }. At run time: F.near and F.far (metres), F.drop
// (an eye, 'left' or 'right', that gets no depth). As a headset does, the session hands out a new texture every frame
// (the last frame's deleted), with WebGL's default filter, and the layer has a framebuffer of its own.
function FAKE(o) {
  const ident = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const tr = (x, y, z) => { const m = ident(); m[12] = x; m[13] = y; m[14] = z; return m; };
  const rotX = (a, x, y, z) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, x, y, z, 1]); };
  const persp = (fov, asp, n, f) => { const t = 1 / Math.tan(fov * Math.PI / 360); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); };
  const DW = 64, DH = 64, WN = 0.1, WF = 20;
  const F = window.__fake = { o, session: null, time: 0, aim: null, src: null, tex: null, texFrame: -1, frameNo: 0, made: 0, calls: 0, near: 0.5, far: 4, drop: null };
  const depthAt = (x, y) => ((o.split === 'y' ? y < DH / 2 : x < DW / 2) ? F.near : F.far);
  const toWin = m => ((WF + WN) / (WF - WN) - 2 * WF * WN / ((WF - WN) * m)) * 0.5 + 0.5;
  const flipY = () => new Float32Array([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1]);
  const pose = m => ({ transform: { matrix: m, position: { x: m[12], y: m[13], z: m[14], w: 1 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } });
  // the room: a floor, a wall 1.8 m ahead (behind the 1 and 1.5 m pillars, in front of the panel and the 2 and 3 m ones), a table
  const planes = new Set([
    { planeSpace: { matrix: tr(0, -1.6, 0) }, polygon: [{ x: -3, y: 0, z: -3 }, { x: 3, y: 0, z: -3 }, { x: 3, y: 0, z: 3 }, { x: -3, y: 0, z: 3 }], orientation: 'horizontal', semanticLabel: 'floor', lastChangedTime: 1 },
    { planeSpace: { matrix: rotX(Math.PI / 2, 0, -1.6, -1.8) }, polygon: [{ x: -3, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, { x: 3, y: 0, z: -2.4 }, { x: -3, y: 0, z: -2.4 }], orientation: 'vertical', semanticLabel: 'wall', lastChangedTime: 1 }]);
  const bv = [], hx = 0.3, hy = 0.4, hz = 0.3;
  for (const x of [-hx, hx]) for (const y of [-hy, hy]) for (const z of [-hz, hz]) bv.push(x, y, z);
  const bi = [0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3];
  const meshes = new Set([{ meshSpace: { matrix: tr(0.9, -1.2, -1.2) }, vertices: new Float32Array(bv), indices: new Uint32Array(bi), semanticLabel: 'table', lastChangedTime: 1 }]);
  class Session extends EventTarget {
    constructor(mode, feats) {
      super(); this.mode = mode; this.renderState = { depthNear: 0.1, depthFar: 1000, baseLayer: null }; this.inputSources = []; this.visibilityState = 'visible';
      this.environmentBlendMode = mode === 'immersive-ar' ? 'alpha-blend' : 'opaque'; this.enabledFeatures = feats; this.cbs = new Map(); this.n = 0; this.frameRate = 72;
      if (feats.includes('depth-sensing')) { this.depthUsage = o.depth === 'cpu' ? 'cpu-optimized' : 'gpu-optimized'; this.depthDataFormat = o.depth === 'gpu16' ? 'unsigned-short' : 'float32'; }
    }
    updateRenderState(s) { Object.assign(this.renderState, s); }
    async requestReferenceSpace(type) { return type === 'local-floor' ? { floor: true } : { local: true, addEventListener() {} }; }
    requestAnimationFrame(cb) { const id = ++this.n; this.cbs.set(id, cb); return id; }
    cancelAnimationFrame(id) { this.cbs.delete(id); }
    async end() { if (this.ended) return; this.ended = true; this.dispatchEvent(new Event('end')); }
  }
  WebGL2RenderingContext.prototype.makeXRCompatible = function () { return Promise.resolve(); };
  window.XRWebGLLayer = class { constructor(s, gl) {
    // a framebuffer of its own, as a headset's layer has (colour and depth), so a pass that leaves another bound shows
    const W = this.framebufferWidth = gl.drawingBufferWidth, H = this.framebufferHeight = gl.drawingBufferHeight;
    const pf = gl.getParameter(gl.FRAMEBUFFER_BINDING), pr = gl.getParameter(gl.RENDERBUFFER_BINDING), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    for (const [fmt, att] of [[gl.RGBA8, gl.COLOR_ATTACHMENT0], [gl.DEPTH24_STENCIL8, gl.DEPTH_STENCIL_ATTACHMENT]]) {
      const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, fmt, W, H);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, att, gl.RENDERBUFFER, rb);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, pf); gl.bindRenderbuffer(gl.RENDERBUFFER, pr);
    this.framebuffer = fb; this.antialias = true; }
    getViewport(v) { const w = this.framebufferWidth / 2; return { x: v.eye === 'left' ? 0 : w, y: 0, width: w, height: this.framebufferHeight }; } };
  window.XRWebGLBinding = class {
    constructor(s, gl) { this.s = s; this.gl = gl; }
    getDepthInformation(view) {
      if (!this.s.depthUsage) throw new DOMException('Depth sensing is not enabled for this session', 'InvalidStateError');
      F.calls++;
      if (F.drop === view.eye) return null;
      if (F.texFrame !== F.frameNo) {   // a new real texture array each frame, made in the page's own context; the last one taken back
        const gl = this.gl, prev = gl.getParameter(gl.TEXTURE_BINDING_2D_ARRAY), fy = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL), pm = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
        const mm = o.depth === 'gpu16', t = gl.createTexture(), d = mm ? new Uint16Array(DW * DH * 2) : new Float32Array(DW * DH * 2);
        for (let l = 0; l < 2; l++) for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) { const m = depthAt(x, y); d[l * DW * DH + y * DW + x] = mm ? m * 1000 : o.depth === 'window' ? toWin(m) : m; }
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, mm ? gl.R16UI : gl.R32F, DW, DH, 2, 0, mm ? gl.RED_INTEGER : gl.RED, mm ? gl.UNSIGNED_SHORT : gl.FLOAT, d);   // (its filter left as made: the page sets nearest)
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, prev); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, fy); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, pm);
        if (F.tex) gl.deleteTexture(F.tex);
        F.tex = t; F.texFrame = F.frameNo; F.made++;
      }
      const info = { texture: F.tex, textureType: 'texture-array', imageIndex: view.eye === 'left' ? 0 : 1, width: DW, height: DH, rawValueToMeters: o.depth === 'gpu16' ? 0.001 : 1, normDepthBufferFromNormView: { matrix: o.flip ? flipY() : ident() } };
      if (o.depth === 'window') { info.depthNear = WN; info.depthFar = WF; }
      return info;
    }
  };
  const views = [-0.032, 0.032].map((x, i) => ({ eye: i ? 'right' : 'left', projectionMatrix: persp(90, 1, 0.05, 100), transform: { matrix: tr(x, 0, 0), position: { x, y: 0, z: 0, w: 1 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } }));
  F.frame = () => ({
    session: F.session,
    getViewerPose: () => Object.assign(pose(ident()), { views }),
    getPose: s => {
      if (!s) return null;
      if (s.floor) return pose(tr(0, -1.6, 0));
      if (s.matrix) return pose(s.matrix);
      if (s.ray && F.aim) { const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...F.aim.o), new THREE.Vector3(...F.aim.t), new THREE.Vector3(0, 1, 0)); m.setPosition(...F.aim.o); return pose(new Float32Array(m.elements)); }
      return null;
    },
    detectedPlanes: o.room ? planes : undefined,
    detectedMeshes: o.room ? meshes : undefined,
    getDepthInformation: v => {
      if (!F.session.depthUsage) throw new DOMException('Depth sensing is not enabled', 'InvalidStateError');
      F.calls++;
      if (F.drop === v.eye) return null;
      const cpuData = new Float32Array(DW * DH); for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) cpuData[y * DW + x] = depthAt(x, y);
      return { data: cpuData.buffer, width: DW, height: DH, rawValueToMeters: 1, normDepthBufferFromNormView: { matrix: ident() }, getDepthInMeters: (x, y) => depthAt(x * DW, y * DH) };
    },
  });
  F.step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      F.time += 1000 / 72; F.frameNo++;
      const cbs = [...F.session.cbs.values()]; F.session.cbs.clear();
      const fr = F.frame();
      for (const cb of cbs) cb(F.time, fr);
    }
  };
  // a controller pointed at a point (its pose from F.aim), then its trigger
  F.controller = () => {
    const src = F.src = { handedness: 'right', targetRayMode: 'tracked-pointer', targetRaySpace: { ray: true }, profiles: [] };
    F.session.inputSources = [src];
    const e = new Event('inputsourceschange'); e.added = [src]; e.removed = []; F.session.dispatchEvent(e);
  };
  F.select = () => { const e = new Event('select'); e.inputSource = F.src; F.session.dispatchEvent(e); };
  const xr = {
    isSessionSupported: async () => true,
    requestSession: async (mode, init) => {
      const ds = init.depthSensing;
      F.asked = (F.asked || 0) + 1;
      if (o.failFirst && F.asked === 1) throw new DOMException('The requested session configuration is not supported', 'NotSupportedError');
      if (o.refuseUS && ds && ds.dataFormatPreference.includes('unsigned-short')) throw new TypeError(`Failed to read the 'dataFormatPreference' property: The provided value 'unsigned-short' is not a valid enum value of type XRDepthDataFormat.`);
      let feats = (init.optionalFeatures || []).slice();
      if (o.depth === 'none' || !ds) feats = feats.filter(f => f !== 'depth-sensing');
      if (!o.room) feats = feats.filter(f => f !== 'plane-detection' && f !== 'mesh-detection');
      F.init = JSON.parse(JSON.stringify(init));
      return (F.session = new Session(mode, ['viewer', 'local', ...feats]));
    },
  };
  Object.defineProperty(navigator, 'xr', { value: xr, configurable: true });
}

async function openPage(o) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push((o.name || '') + ': ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push((o.name || '') + ': ' + m.text()); });
  await page.addInitScript(FAKE, o);
  await page.goto(base + 'room-test/');
  await page.waitForFunction(() => window.RT && !document.querySelector('#enterAR').disabled, null, { timeout: 20000 });
  return { page, ctx };
}
async function enterAR(page) {
  await page.click('#enterAR');
  await page.waitForFunction(() => RT.S && RT.S.session && window.__fake.session && window.__fake.session.cbs.size, null, { timeout: 20000 });
  await page.evaluate(() => window.__fake.step(3));
}
// pixels read right after a frame (the same task: the drawing buffer is still there); points as [eye, x, y], x and y
// fractions of that eye's viewport from its bottom left
// (read from the layer's own framebuffer; the probe made to run in the first of those frames, so a pass or probe that
// left another framebuffer bound would show as nothing drawn)
const looks = (page, pts, frames = 2) => page.evaluate(([pts, frames]) => {
  if (RT.S) RT.S.probeAt = -1e9;
  window.__fake.step(frames);
  const gl = RT.G.gl, L = RT.S.layer, W = L.framebufferWidth, H = L.framebufferHeight, out = new Uint8Array(4), prev = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  gl.bindFramebuffer(gl.FRAMEBUFFER, L.framebuffer);
  const px = pts.map(([eye, x, y]) => { gl.readPixels(Math.floor((eye * 0.5 + x * 0.5) * W), Math.floor(y * H), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out); return Array.from(out); });
  gl.bindFramebuffer(gl.FRAMEBUFFER, prev);
  return px;
}, [pts, frames]);
// where things are in each eye (90 degree views, eyes 3.2 cm either side): a point x metres across at d metres ahead
const at = (eye, x, d, y = 0.58) => [eye, 0.5 + (x - (eye ? 0.032 : -0.032)) / d / 2, y];
const P = {   // the read points: the big panel (2.5 m) left and right of the middle, the 1 m pillar (left half), the 1.5 m one (right)
  panelL: e => [e, 0.42, 0.58], panelR: e => [e, 0.58, 0.58], pillar1: e => at(e, -0.35, 1), pillar15: e => at(e, 0.5, 1.5),
  // the 2 m pillar (left half), its middle; the panel and the 1 m pillar in the upper half of the view and the lower
  pillar2: e => at(e, -1.1, 2, 0.5), panelUp: e => [e, 0.58, 0.56], panelDown: e => [e, 0.58, 0.44], pillar1Up: e => at(e, -0.35, 1, 0.6), pillar1Down: e => at(e, -0.35, 1, 0.3) };
const seen = px => px[3] > 0;
async function expect(page, what, want, eyes = [0, 1]) {
  const names = Object.keys(want), pts = [];
  for (const e of eyes) for (const n of names) pts.push(P[n](e));
  const got = await looks(page, pts);
  let k = 0;
  for (const e of eyes) for (const n of names) {
    const px = got[k++];
    if (seen(px) !== want[n]) errors.push(`${what}: ${n} in the ${e ? 'right' : 'left'} eye ${want[n] ? 'hidden' : 'shown'} (pixel ${px.join(',')})`);
  }
}
const mode = (page, k) => page.evaluate(async k => { RT.setMode(RT.MODES.findIndex(m => m[0] === k)); window.__fake.step(2); }, k);

// ------------------------------------------------------------------------------------------- the rounds
await step('the page loads with no errors, says what it tests, has no report yet', async () => {
  const { page, ctx } = await openPage({ name: 'load', depth: 'gpu', room: true });
  const t = await page.evaluate(() => ({ h: document.querySelector('h1').textContent, ar: document.querySelector('#enterAR').textContent, vr: document.querySelector('#enterVR').textContent,
    rep: document.querySelector('#report').value, untested: /untested on a real Quest/.test(document.body.textContent) }));
  if (t.h !== 'Room and depth test' || t.ar !== 'Enter AR' || t.vr !== 'Try VR too' || t.rep || !t.untested) errors.push('the page: ' + JSON.stringify(t));
  await ctx.close();
});

let main = await openPage({ name: 'gpu', depth: 'gpu', room: true });
const pg = main.page;
await step('AR with GPU depth: the session asked as the ladder says, depth found, probed and read as metres', async () => {
  await enterAR(pg);
  await pg.evaluate(() => window.__fake.step(5));
  const r = await pg.evaluate(() => ({ init: window.__fake.init, R: RT.R, used: RT.D && RT.D.used }));
  const ds = r.init.depthSensing;
  if (!ds || ds.usagePreference.join() !== 'gpu-optimized,cpu-optimized' || ds.dataFormatPreference.join() !== 'unsigned-short,luminance-alpha,float32') errors.push('the depth request: ' + JSON.stringify(ds));
  if (r.init.optionalFeatures.join() !== 'local-floor,hand-tracking,plane-detection,mesh-detection,depth-sensing') errors.push('the features: ' + r.init.optionalFeatures);
  const d = r.R.depth, e = d.eyes[0], p = d.probe && d.probe.eyes;
  if (!d.enabled || d.usage !== 'gpu-optimized' || d.format !== 'float32' || d.binding !== 'made') errors.push('depth: ' + JSON.stringify({ enabled: d.enabled, usage: d.usage, format: d.format, binding: d.binding }));
  if (!e || e.textureType !== 'texture-array' || e.width !== 64 || e.height !== 64 || e.rawValueToMeters !== 1 || e.imageIndex !== 0 || d.eyes[1].imageIndex !== 1) errors.push('the eyes: ' + JSON.stringify(d.eyes));
  if (!p || p.length !== 2 || p.some(q => q.min !== 0.5 || q.max !== 4 || q.zero)) errors.push('the probe: ' + JSON.stringify(d.probe));
  if (r.used !== 'metres' || d.firstValidS === null || d.validFrames < 5) errors.push(`read as ${r.used}, first valid ${d.firstValidS}, valid frames ${d.validFrames}`);
  if (r.R.floor !== -1.6) errors.push('the floor: ' + r.R.floor);
  // the room scan summed up, but nothing of it built while neither Room nor Room hides shows
  if (r.R.room.planes.count !== 2 || r.R.room.meshes.count !== 1) errors.push('the room summary outside Room: ' + JSON.stringify(r.R.room));
  const kids = await pg.evaluate(() => RT.G.room.children.length);
  if (kids) errors.push('the room built outside Room: ' + kids);
  if (!r.R.session.enabledFeatures.includes('depth-sensing') || r.R.session.layer.width !== 800) errors.push('the session: ' + JSON.stringify(r.R.session));
});
await step('Nothing: every test point drawn (both eyes)', async () => {
  await mode(pg, 'nothing');
  await expect(pg, 'nothing', { panelL: true, panelR: true, pillar1: true, pillar15: true });
});
await step('Occlusion (three.js): hidden where the depth is nearer, drawn where it is farther, both eyes', async () => {
  await mode(pg, 'occlusion');
  await expect(pg, 'occlusion, three.js', { panelL: false, panelR: true, pillar1: false, pillar15: true });
  const r = await pg.evaluate(() => ({ d: RT.R.depth, made: window.__fake.made }));
  if (r.d.drawWith !== 'three' || Object.keys(r.d.glErrors).length) errors.push('three.js way: ' + JSON.stringify({ drawWith: r.d.drawWith, glErrors: r.d.glErrors, switched: r.d.switched, prog: r.d.threeProgram }));
  if (r.made < 5) errors.push('the session\'s texture was not new each frame: ' + r.made);
});
await step('Occlusion close to a test thing: depth 1.9 m hides the 2 m pillar, 2.1 m does not (both eyes, both ways)', async () => {
  for (const how of ['three', 'raw']) {
    if (how === 'raw') await pg.evaluate(() => RT.act('draw'));
    await pg.evaluate(() => { window.__fake.near = window.__fake.far = 1.9; });
    await expect(pg, `depth 1.9 m (${how})`, { pillar2: false, pillar15: true, panelR: false });
    await pg.evaluate(() => { window.__fake.near = window.__fake.far = 2.1; });
    await expect(pg, `depth 2.1 m (${how})`, { pillar2: true, pillar15: true, panelR: false });
    if (how === 'raw') await pg.evaluate(() => RT.act('draw'));
  }
  await pg.evaluate(() => { window.__fake.near = 0.5; window.__fake.far = 4; });
});
await step('an eye with no depth this frame: no occlusion there (never the other eye\'s depth), the other eye as before', async () => {
  await pg.evaluate(() => { window.__fake.drop = 'right'; });
  await expect(pg, 'right eye without depth', { panelL: true, panelR: true, pillar1: true, pillar15: true }, [1]);
  await expect(pg, 'left eye with depth', { panelL: false, panelR: true, pillar1: false, pillar15: true }, [0]);
  await pg.evaluate(() => { window.__fake.drop = null; });
  await expect(pg, 'both eyes again', { panelL: false, panelR: true, pillar1: false, pillar15: true });
  const g = await pg.evaluate(() => RT.R.depth.glErrors);
  if (Object.keys(g).length) errors.push('WebGL errors with an eye missing: ' + JSON.stringify(g));
});
await step('Depth picture (three.js): near warm on the left, far cool on the right, both eyes', async () => {
  await mode(pg, 'picture');
  const got = await looks(pg, [[0, 0.3, 0.85], [0, 0.7, 0.85], [1, 0.3, 0.85], [1, 0.7, 0.85]]);
  got.forEach((px, i) => { const near = !(i % 2); if (!px[3] || (near ? !(px[0] > px[2] + 40) : !(px[2] > px[0] + 40))) errors.push(`picture (three.js) ${near ? 'near' : 'far'} eye ${i >> 1}: ${px}`); });
});
await step('raw WebGL: the same occlusion and picture drawn our own way', async () => {
  await pg.evaluate(() => RT.act('draw'));
  await mode(pg, 'occlusion');
  await expect(pg, 'occlusion, raw WebGL', { panelL: false, panelR: true, pillar1: false, pillar15: true });
  await mode(pg, 'picture');
  const got = await looks(pg, [[0, 0.3, 0.85], [0, 0.7, 0.85], [1, 0.3, 0.85], [1, 0.7, 0.85]]);
  got.forEach((px, i) => { const near = !(i % 2); if (!px[3] || (near ? !(px[0] > px[2] + 40) : !(px[2] > px[0] + 40))) errors.push(`picture (raw) ${near ? 'near' : 'far'} eye ${i >> 1}: ${px}`); });
  await mode(pg, 'nothing');
  await expect(pg, 'nothing after raw WebGL', { panelL: true, panelR: true, pillar1: true, pillar15: true });
  await pg.evaluate(() => RT.act('draw'));
});
await step('Room: the pretend floor, wall and table drawn with their labels, counted in the report', async () => {
  await mode(pg, 'room');
  const r = await pg.evaluate(() => { window.__fake.step(2); return { room: RT.R.room, kids: RT.G.room.children.length }; });
  const pl = r.room.planes, me = r.room.meshes;
  if (pl.count !== 2 || pl.labels.wall !== 1 || pl.labels.floor !== 1 || pl.orientations.vertical !== 1 || pl.points.join() !== '4,4' || pl.firstS === null) errors.push('planes: ' + JSON.stringify(pl));
  if (me.count !== 1 || me.labels.table !== 1 || me.vertices !== 8 || me.triangles !== 12) errors.push('meshes: ' + JSON.stringify(me));
  if (r.kids !== 3) errors.push('room objects: ' + r.kids);
  // the wall's see-through fill where the panel was (the test things are not drawn in Room)
  const px = await looks(pg, [P.panelR(0), P.panelR(1)]);
  if (px.some(p => !p[3])) errors.push('the wall not drawn: ' + JSON.stringify(px));
});
await step('Room hides: what stands behind the pretend wall hidden, what stands before it drawn (no depth pass)', async () => {
  await mode(pg, 'roomhide');
  await expect(pg, 'room hides', { panelL: false, panelR: false, pillar1: true, pillar15: true });
  const v = await pg.evaluate(() => [RT.G.occl.visible, RT.G.pic.visible]);
  if (v.some(Boolean)) errors.push('a depth pass on in Room hides: ' + v);
});
await step('the panel: a pretend controller pointed at Mode and its trigger change the mode; Bring here; a ray at the panel', async () => {
  const r = await pg.evaluate(() => {
    const F = window.__fake, P = RT.G.panel, m = P.mesh, out = {};
    F.step(1);
    const b = P.buttons.find(b => b.id === 'mode'), w = 0.6, h = 0.6 * 1408 / 1024;
    m.updateMatrixWorld();
    const p = m.localToWorld(new THREE.Vector3((b.x + b.w / 2) / 1024 * w - w / 2, h / 2 - (b.y + b.h / 2) / 1408 * h, 0));
    F.controller(); F.aim = { o: [0.15, -0.3, -0.2], t: [p.x, p.y, p.z] };
    F.step(2);
    out.hover = P.hover.slice(); const before = RT.S.mode;
    F.select(); F.step(1);
    out.moved = RT.S.mode === (before + 1) % RT.MODES.length;
    out.miss = RT.press([0, 0, 0], [0, 1, 0]);
    return out;
  });
  if (r.hover[0] !== 'mode' || !r.moved || r.miss !== null) errors.push('pointing: ' + JSON.stringify(r));
});
await step('frame times per mode (the gap, our code, the GPU\'s done-by time), Nothing asking for no depth, the autosave, Save report', async () => {
  const calls = {};
  for (const k of ['picture', 'occlusion', 'room', 'roomhide', 'nothing']) {
    await mode(pg, k);
    await pg.waitForTimeout(600);
    const c0 = await pg.evaluate(() => window.__fake.calls);
    await pg.evaluate(() => window.__fake.step(30));
    calls[k] = await pg.evaluate(() => window.__fake.calls) - c0;
  }
  if (calls.nothing || !calls.occlusion) errors.push('depth asked for: ' + JSON.stringify(calls));
  await pg.evaluate(() => { localStorage.removeItem('roomTestReport'); RT.S.savedAt = 0; window.__fake.step(1); });
  const auto = await pg.evaluate(() => JSON.parse(localStorage.getItem('roomTestReport') || 'null'));
  if (!auto || auto.saved !== 'auto') errors.push('the autosave: ' + (auto && auto.saved));
  await pg.evaluate(() => RT.act('save'));
  const r = await pg.evaluate(() => ({ rep: JSON.parse(localStorage.getItem('roomTestReport')), text: document.querySelector('#report').value, sum: document.querySelector('#summary').textContent }));
  const m = r.rep && r.rep.modes;
  if (!m || ['picture', 'occlusion', 'room', 'roomhide', 'nothing'].some(k => !(m[k] && m[k].frames > 0 && m[k].ms > 0 && m[k].seconds > 0 && m[k].busyMs > 0 && m[k].busyFrames > 0 && typeof m[k].headroomMs === 'number' && m[k].budgetMs > 13.8 && m[k].budgetMs < 14))) errors.push('the modes\' times: ' + JSON.stringify(m));
  if (m && !(m.nothing.depthMs === 0 && m.occlusion.depthMs > 0)) errors.push('depth\'s own time: ' + JSON.stringify({ nothing: m.nothing.depthMs, occlusion: m.occlusion.depthMs }));
  if (!r.rep || typeof r.rep.gpuTimer !== 'string' || r.rep.session.frameRate !== 72) errors.push('the GPU timer and frame rate: ' + JSON.stringify(r.rep && { t: r.rep.gpuTimer, fr: r.rep.session.frameRate }));
  if (!r.rep || !/OculusBrowser|Chrome/.test(r.rep.ua) || r.rep.attempts.length !== 1 || !r.rep.attempts[0].ok || !r.rep.depth.fields.includes('rawValueToMeters') && !r.rep.depth.fields.length) errors.push('the report: ' + JSON.stringify(r.rep && { ua: r.rep.ua, attempts: r.rep.attempts, fields: r.rep.depth.fields }));
  if (!r.text || !/Planes/.test(r.sum) || !/float32/.test(r.sum)) errors.push('the page\'s report: ' + r.sum);
  if (/password|token/i.test(r.text)) errors.push('the report names a password');
});
await step('Exit: the session ends, the report saved, Send to the relay keeps it in the relay\'s logs', async () => {
  await pg.evaluate(() => RT.act('exit'));
  await pg.waitForFunction(() => !RT.S && JSON.parse(localStorage.getItem('roomTestReport')).saved === 'session ended', null, { timeout: 10000 });
  await pg.waitForSelector('#send:not([hidden])', { timeout: 5000 });
  await pg.click('#send');
  await pg.waitForFunction(() => /Sent/.test(document.querySelector('#sendNote').textContent), null, { timeout: 5000 });
  const files = fs.readdirSync(logs).filter(f => f.endsWith('.jsonl'));
  const lines = files.flatMap(f => fs.readFileSync(path.join(logs, f), 'utf8').trim().split('\n')).map(l => JSON.parse(l));
  if (!lines.some(l => l.type === 'room-test' && l.report && l.report.depth && l.report.depth.usage === 'gpu-optimized')) errors.push('the relay\'s log: ' + files.join());
});
await main.ctx.close();

await step('a browser that does not know \'unsigned-short\': the ladder asks again without it', async () => {
  const { page, ctx } = await openPage({ name: 'ladder', depth: 'gpu', room: false, refuseUS: true });
  await enterAR(page);
  const r = await page.evaluate(() => ({ a: RT.R.attempts, f: window.__fake.init.depthSensing.dataFormatPreference, d: RT.R.depth.enabled, planes: RT.R.room.planesOn }));
  if (r.a.length !== 2 || !/^TypeError/.test(r.a[0].error) || !r.a[1].ok || r.f.join() !== 'luminance-alpha,float32' || !r.d || r.planes) errors.push('the ladder: ' + JSON.stringify(r));
  await mode(page, 'occlusion');
  await expect(page, 'occlusion after the ladder', { panelL: false, panelR: true });
  await ctx.close();
});
await step('the depth\'s rows: identity reads row 0 at the top of the view; Depth as: metres, flipped turns it over', async () => {
  const { page, ctx } = await openPage({ name: 'rows', depth: 'gpu', room: false, split: 'y' });
  await enterAR(page);
  await page.evaluate(() => { RT.G.panel.mesh.position.y += 3; });   // (the readout panel hangs below the eyes, over the lower read points)
  await mode(page, 'occlusion');
  await expect(page, 'rows, as given', { panelUp: false, panelDown: true, pillar1Up: false, pillar1Down: true });
  await page.evaluate(() => { RT.act('interp'); RT.act('interp'); });   // auto -> metres -> metres, flipped
  const used = await page.evaluate(() => RT.D.used);
  if (used !== 'metres-flip') errors.push('Depth as: ' + used);
  await expect(page, 'rows, flipped by hand', { panelUp: true, panelDown: false, pillar1Up: true, pillar1Down: false });
  await ctx.close();
});
await step('normDepthBufferFromNormView that turns y over: applied (three.js and raw WebGL)', async () => {
  const { page, ctx } = await openPage({ name: 'flip', depth: 'gpu', room: false, split: 'y', flip: true });
  await enterAR(page);
  await page.evaluate(() => { RT.G.panel.mesh.position.y += 3; });
  await mode(page, 'occlusion');
  await expect(page, 'the matrix applied', { panelUp: true, panelDown: false, pillar1Up: true, pillar1Down: false });
  await page.evaluate(() => RT.act('draw'));
  await expect(page, 'the matrix applied (raw)', { panelUp: true, panelDown: false, pillar1Up: true, pillar1Down: false });
  const e = await page.evaluate(() => RT.R.depth.eyes[0].matrix);
  if (e[5] !== -1 || e[13] !== 1) errors.push('the matrix in the report: ' + e);
  await ctx.close();
});
await step('window depth (a depth buffer for its own near and far, 0.1 to 20 m): auto reads it so, the same occlusion, close steps right', async () => {
  const { page, ctx } = await openPage({ name: 'window', depth: 'window', room: false });
  await enterAR(page);
  await mode(page, 'occlusion');
  const d = await page.evaluate(() => ({ used: RT.D.used, why: RT.R.depth.autoWhy, range: RT.R.depth.windowRange, eye: RT.R.depth.eyes[0] }));
  if (d.used !== 'window' || !/depth buffer/.test(d.why) || !/information/.test(d.range) || d.eye.depthNear !== 0.1 || d.eye.depthFar !== 20) errors.push('window depth: ' + JSON.stringify(d));
  await expect(page, 'window depth', { panelL: false, panelR: true, pillar1: false, pillar15: true });
  for (const how of ['three', 'raw']) {
    if (how === 'raw') await page.evaluate(() => RT.act('draw'));
    await page.evaluate(() => { window.__fake.near = window.__fake.far = 1.9; });
    await expect(page, `window 1.9 m (${how})`, { pillar2: false, pillar15: true });
    await page.evaluate(() => { window.__fake.near = window.__fake.far = 2.1; });
    await expect(page, `window 2.1 m (${how})`, { pillar2: true, pillar15: true, panelR: false });
  }
  await ctx.close();
});
await step('a first request refused for another reason: the next rung (depth with fewer formats) is still tried', async () => {
  const { page, ctx } = await openPage({ name: 'failfirst', depth: 'gpu', room: false, failFirst: true });
  await enterAR(page);
  const r = await page.evaluate(() => ({ a: RT.R.attempts, d: RT.R.depth.enabled }));
  if (r.a.length !== 2 || !/^NotSupportedError/.test(r.a[0].error) || !r.a[1].ok || r.a[1].formats.join() !== 'luminance-alpha,float32' || !r.d) errors.push('the ladder after another error: ' + JSON.stringify(r));
  await ctx.close();
});
await step('a session without depth sensing: every other mode still runs and says why', async () => {
  const { page, ctx } = await openPage({ name: 'nodepth', depth: 'none', room: true });
  await enterAR(page);
  await mode(page, 'occlusion');
  await expect(page, 'occlusion without depth', { panelL: true, panelR: true, pillar1: true });
  await mode(page, 'roomhide');
  await expect(page, 'room hides without depth', { panelL: false, pillar1: true });
  const r = await page.evaluate(() => ({ d: RT.R.depth, calls: window.__fake.calls }));
  if (r.d.enabled || !r.d.why || r.calls) errors.push('without depth: ' + JSON.stringify({ enabled: r.d.enabled, why: r.d.why, calls: r.calls }));
  await ctx.close();
});
await step('unsigned-short in an integer texture: the float sampler refused, an integer one used, the same occlusion', async () => {
  const { page, ctx } = await openPage({ name: 'gpu16', depth: 'gpu16', room: false });
  await enterAR(page);
  await mode(page, 'occlusion');
  await expect(page, 'occlusion with integer depth', { panelL: false, panelR: true, pillar1: false, pillar15: true });
  await mode(page, 'picture');
  const got = await looks(page, [[0, 0.3, 0.85], [0, 0.7, 0.85]]);
  if (!(got[0][3] && got[0][0] > got[0][2] + 40 && got[1][3] && got[1][2] > got[1][0] + 40)) errors.push('picture with integer depth: ' + JSON.stringify(got));
  const r = await page.evaluate(() => ({ d: RT.R.depth, kind: RT.D.kind, used: RT.D.used }));
  const p = r.d.probe && r.d.probe.eyes[0];
  if (!r.kind.int || !/integer/.test(r.d.sampler) || !p || p.min !== 500 || p.max !== 4000 || p.metres.join() !== '0.5,4,4' || r.used !== 'metres') errors.push('integer depth: ' + JSON.stringify({ kind: r.kind, sampler: r.d.sampler, probe: p, used: r.used }));
  await ctx.close();
});
await step('CPU depth: uploaded as metres, the same occlusion', async () => {
  const { page, ctx } = await openPage({ name: 'cpu', depth: 'cpu', room: false });
  await enterAR(page);
  await mode(page, 'occlusion');
  await expect(page, 'occlusion with CPU depth', { panelL: false, panelR: true, pillar1: false, pillar15: true });
  const r = await page.evaluate(() => RT.R.depth);
  if (r.usage !== 'cpu-optimized' || r.eyes[0].centreM !== 4 || !r.probe || r.probe.eyes[0].min !== 0.5) errors.push('CPU depth: ' + JSON.stringify({ usage: r.usage, eye: r.eyes[0], probe: r.probe }));
  await ctx.close();
});

await browser.close();
stop();
fs.rmSync(logs, { recursive: true, force: true });
if (errors.length) { console.log('\n' + errors.join('\n')); process.exit(1); }
console.log('\nroom-test: all good (in headless Chromium with a pretend headset; untested on a real Quest)');
