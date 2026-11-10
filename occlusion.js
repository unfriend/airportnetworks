// Real-world occlusion (HOST.occlusion; the owner, 6 November 2026: "occlusion should be on by default"). In an AR
// session (passthrough) what is real hides what stands behind it, as in the room: people, hands and anything that moves
// (the headset's depth sensing) and the walls and furniture of the room scan (Space Setup's planes and meshes). The way
// it is done was proven on a Quest 3 with the room test page (room-test/, Quest Browser 154): the session's depth, a
// texture array of 320 x 320 per eye in a depth buffer's values for depthNear 0.1 and no far plane, seen from the eye
// itself (no reprojection), written as each eye's depth in a full-view pass drawn first (1.7 ms of an 11 ms frame); the
// room drawn depth-only (3 ms for 31,299 triangles), built again only when its shape really changes.
// Nothing is drawn in colour: things are only hidden. Never hidden: what is drawn over everything (the menu, the
// notices, the subtitles, the frame-rate read-out, labels and cards set on top); hidden as real things would be: the
// scenes, cards in 3D, the circles' rings and icons. This headset's own setting (xrOccl, #occl=): 'both' (the default),
// 'room', 'depth' (people) or 'off'; a story may ask for its own (scene(mode); the studio, for a scene that says so),
// cleared when the story changes. Its objects hang in the story's scene (its root is the renderer's reference space),
// taken out before a story is disposed and hung in the next one's. Nothing of it is in a story's state or a room.
// After a sleep (v131; the owner, 10 November 2026: "Occlusion stops working after longer sleep in quest 3s?"): what the
// session gave is asked for again (renew: a new XRWebGLBinding, the depth's kind and reading decided afresh, its depth
// resumed, the room built again from what the frame lists) when the session is visible again after a while hidden, and
// by a watchdog when the depth stops coming, its calls keep throwing or no part of the room has a pose; all of it logged,
// so the headsets' logs say what stopped and what came back.
HOST.occlusion = (function () {
  'use strict';
  const MODES = ['both', 'room', 'depth', 'off'], NEXT = { both: 'room', room: 'depth', depth: 'off', off: 'both' };
  const SAY = { both: 'room and people', room: 'room', depth: 'people', off: 'nothing' };
  // how far behind a real surface a thing must be to be hidden (metres along the view): a robot's trail on the floor, a
  // line along a wall's foot or a model standing on the floor is not hidden by the surface it stands on (the depth is
  // noisier than the room scan)
  const BIAS = { depth: 0.04, room: 0.02 };
  // when to ask again (ms; times() for tests): the session hidden at least this long (a sleep, not a glance at the
  // system menu); no depth for this long while it had come; no part of the room posed for this long; the watchdog's
  // first try at least this long after the last ask, each next one twice as long, at most cap tries after the session's
  // start or a sleep; the depth's calls throwing on this many frames in a row
  const T0 = { wake: 10000, lost: 1500, room: 2000, every: 10000, cap: 6, throws: 30 }, T = Object.assign({}, T0);
  let own = 'both';
  try { const v = localStorage.getItem('xrOccl'); if (MODES.includes(v)) own = v; } catch (e) { /* storage blocked */ }
  const O = { over: null, root: null, quad: null, room: null, mats: {}, roomMat: null, warned: {}, lost: false, restored: 0 };
  let S = null;   // per session: what it was given, the depth this frame, the room's parts
  const msg = e => String((e && e.message) || e).slice(0, 160);
  const warn = (k, e) => { if (!O.warned[k]) { O.warned[k] = true; console.warn('Occlusion: ' + k + (e ? ': ' + msg(e) : '')); } };
  // the shell's log (shared.js: it goes to the relay with a headset's alignment samples), when it is there
  const clog = (ev, data) => { try { if (HOST.collab && HOST.collab.log) HOST.collab.log(ev, data); } catch (e) { /* no log */ } };
  const get = (o, k) => { try { return o[k] === undefined ? null : o[k]; } catch (e) { return null; } };
  const depthActive = () => { const v = S ? get(S.session, 'depthActive') : null; return v === true || v === false ? v : null; };
  const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const mode = () => (O.over && MODES.includes(O.over) ? O.over : own);
  const ar = () => { const s = HOST.session; return !!s && (HOST.mode ? HOST.mode === 'immersive-ar' : !!s.environmentBlendMode && s.environmentBlendMode !== 'opaque'); };

  // ---------------------------------------------------------------------------------------------- the shaders
  // The room test's own (room-test/index.html), less what only it needs (the picture, the depth's own view). Values are
  // read with texelFetch, so the texture's filter does not matter. Two readings: metres (the value times its scale,
  // through normDepthBufferFromNormView from the view's coordinates, origin top left) and window (a depth buffer's value
  // for the depth's own near and far, lying over the view as it is, as three.js r158 reads it, back to metres); then
  // written as the eye's depth with its own projection, a little further away (BIAS.depth)
  const FRAG_HEAD = `
precision highp float; precision highp int;
#ifdef ARR
#ifdef INTT
uniform highp usampler2DArray uDepth;
#else
uniform highp sampler2DArray uDepth;
#endif
#else
#ifdef INTT
uniform highp usampler2D uDepth;
#else
uniform highp sampler2D uDepth;
#endif
#endif
uniform float uLayer;
varying vec2 vUv;
out highp vec4 fragColor;
float rawAt(vec2 d) {
#ifdef ARR
  ivec2 sz = textureSize(uDepth, 0).xy;
  ivec2 p = clamp(ivec2(d * vec2(sz)), ivec2(0), sz - 1);
  vec4 v = vec4(texelFetch(uDepth, ivec3(p, int(uLayer + 0.5)), 0));
#else
  ivec2 sz = textureSize(uDepth, 0);
  ivec2 p = clamp(ivec2(d * vec2(sz)), ivec2(0), sz - 1);
  vec4 v = vec4(texelFetch(uDepth, p, 0));
#endif
#ifdef LA
  return v.r * 255.0 + v.a * 65280.0;
#else
  return v.r;
#endif
}`;
  const FRAG_DEPTH = `
uniform float uScale, uWin, uNear, uFar, uInf, uBias;
uniform mat4 uM;
uniform mat4 projectionMatrix;
vec2 texOf(vec2 uv) { return uWin > 0.5 ? uv : (uM * vec4(uv.x, 1.0 - uv.y, 0.0, 1.0)).xy; }
float metresAt(vec2 uv) {
  vec2 d = texOf(uv);
  if (d.x < 0.0 || d.y < 0.0 || d.x > 1.0 || d.y > 1.0) return -1.0;
  float raw = rawAt(d);
  if (uWin > 0.5) {
    if (!(raw > 0.0 && raw < 1.0)) return -1.0;
    if (uInf > 0.5) return uNear / (1.0 - raw);
    float z = raw * 2.0 - 1.0;
    return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
  }
  float m = raw * uScale;
  return m > 0.0 && m < 1000.0 ? m : -1.0;
}
void main() {
  float m = metresAt(vUv);
  if (m <= 0.0) discard;
  vec4 c = projectionMatrix * vec4(0.0, 0.0, -(m + uBias), 1.0);
  gl_FragDepth = clamp(c.z / c.w * 0.5 + 0.5, 0.0, 1.0);
  fragColor = vec4(0.0);
}`;
  // the probe: the raw value of a 16 x 16 grid over the depth, its float's four bytes as a pixel (exact)
  const FRAG_PROBE = `
void main() {
  uint b = floatBitsToUint(rawAt(vUv));
  fragColor = vec4(float(b & 255u), float((b >> 8) & 255u), float((b >> 16) & 255u), float(b >> 24)) / 255.0;
}`;
  const VERT = `varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const defs = k => [k.arr ? '#define ARR' : '', k.int ? '#define INTT' : '', k.la ? '#define LA' : ''].join('\n');
  const kindKey = k => (k.arr ? 'A' : 'T') + (k.int ? 'I' : 'F') + (k.la ? 'L' : '');
  // the room's parts: depth only, each corner pushed BIAS.room further along its view ray
  const ROOM_VERT = `uniform float uBias;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float l = length(mv.xyz);
  if (l > 1e-4) mv.xyz *= 1.0 + uBias / l;
  gl_Position = projectionMatrix * mv;
}`;

  // ---------------------------------------------------------------------------------------------- the objects
  // made once, with HOST.quiet set (nothing of them is a story's), first used in an AR session
  function make() {
    if (O.root) return;
    const q = HOST.quiet;
    HOST.quiet = true;
    try {
      // (a group's renderOrder orders everything in it before the story's own things, whatever their renderOrder)
      O.root = new THREE.Group(); O.root.name = 'occlusion'; O.root.renderOrder = -1e9; O.root.visible = false;
      O.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ colorWrite: false }));
      O.quad.frustumCulled = false; O.quad.renderOrder = -2; O.quad.visible = false;
      O.quad.onBeforeRender = (r, sc, cam) => eyeUniforms(cam);
      O.room = new THREE.Group(); O.room.name = 'occlusion room'; O.room.visible = false;
      O.room.renderOrder = -1e9;   // (a group inside a group sets its own order: without this the room's walls came after a story's own low orders)
      O.roomMat = new THREE.ShaderMaterial({ vertexShader: ROOM_VERT, fragmentShader: 'void main() { gl_FragColor = vec4(0.0); }',
        uniforms: { uBias: { value: BIAS.room } }, colorWrite: false, depthWrite: true, depthTest: true, side: THREE.DoubleSide });
      O.root.add(O.quad, O.room);
    } finally { HOST.quiet = q; }
  }
  function depthMaterial(k) {
    const key = kindKey(k);
    if (O.mats[key]) return O.mats[key];
    const q = HOST.quiet;
    HOST.quiet = true;
    try {
      const m = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: defs(k) + FRAG_HEAD + FRAG_DEPTH,
        uniforms: { uDepth: { value: null }, uLayer: { value: 0 }, uScale: { value: 1 }, uWin: { value: 0 }, uNear: { value: 0.1 }, uFar: { value: 1000 },
          uInf: { value: 0 }, uBias: { value: BIAS.depth }, uM: { value: new THREE.Matrix4() } },
        depthTest: true, depthWrite: true, colorWrite: false });
      m.depthFunc = THREE.AlwaysDepth;
      return (O.mats[key] = m);
    } finally { HOST.quiet = q; }
  }
  // the story's scene (built: its collab hook gives it only then)
  function storyScene() {
    const c = HOST.cur && HOST.cur.collab;
    try { return c && c.scene ? c.scene() : null; } catch (e) { return null; }
  }
  function hide() { if (O.root) O.root.visible = false; }

  // ---------------------------------------------------------------------------------------------- the session
  // (the watchdog's tries for the depth or the room: how many since the session's start or a sleep, the last ask, when
  // it gave up)
  const limiter = () => ({ n: 0, at: -1e9, gave: 0 });
  function begin(s, r) {
    end();
    const gl = r.getContext(), sv = k => get(s, k);
    const F = sv('enabledFeatures'), has = f => (F ? Array.from(F).includes(f) : null);
    S = { session: s, gl, binding: null, D: null, views: null, decided: false, probeAt: 0, probeN: 0, probe: null, frames: 0, valid: 0,
      depth: { enabled: false, usage: sv('depthUsage'), format: sv('depthDataFormat'), why: '', errors: 0 },
      planesOn: has('plane-detection') === true, meshesOn: has('mesh-detection') === true, planes: new Map(), meshes: new Map(), built: 0,
      // what comes and goes (renew): the last frame with depth, since when none came, the depth's calls throwing (frames
      // in a row), the room's parts and how many have a pose (and since when none), the session hidden since, how long it
      // was hidden last, a sleep to answer on the next frame; what was asked again, and what is to be said back
      lastDepthAt: 0, everDepth: false, missSince: 0, throwRun: 0, parts: 0, posed: 0, posedLast: 0, unposedSince: 0, stepAt: 0,
      hiddenAt: 0, hidLast: 0, wakeDue: 0, renews: 0, roomRenews: 0, redecides: 0, resumes: 0, bindings: 0, shapeLogAt: -1e9,
      td: limiter(), tr: limiter(), back: { depth: false, room: false, at: 0, why: '' }, told: false, vis: null };
    const Q = S.depth;
    Q.enabled = has('depth-sensing') === true || (F === null && !!Q.usage);
    if (!Q.enabled) Q.why = 'not given by the browser';
    else if (Q.usage !== 'cpu-optimized' && !bind()) Q.enabled = false;
    // a sleep: the session hidden, then visible again (a short glance at the system menu is no sleep); answered on the
    // next frame (step)
    const me = S, vis = () => {
      if (S !== me) return;
      const v = get(s, 'visibilityState'), t = performance.now();
      if (v === 'hidden') { if (!S.hiddenAt) S.hiddenAt = t; return; }
      if (v !== 'visible' || !S.hiddenAt) return;
      const h = t - S.hiddenAt;
      S.hiddenAt = 0; S.hidLast = Math.round(h);
      if (h >= T.wake) S.wakeDue = h;
    };
    const q = HOST.quiet;
    HOST.quiet = true;
    try { s.addEventListener('visibilitychange', vis); S.vis = vis; } catch (e) { /* no events */ } finally { HOST.quiet = q; }
  }
  // the session's depth for the GPU (a binding of its own to the renderer's context), at the start and again by renew
  function bind() {
    const Q = S.depth;
    S.binding = null;
    if (typeof XRWebGLBinding !== 'function') { Q.why = 'no XRWebGLBinding'; return false; }
    try { S.binding = new XRWebGLBinding(S.session, S.gl); S.bindings++; return true; } catch (e) { Q.why = 'XRWebGLBinding: ' + msg(e); return false; }
  }
  function dropRoom() {
    for (const k of ['planes', 'meshes']) { for (const e of S[k].values()) dropPart(e); S[k].clear(); }
    S.parts = 0; S.unposedSince = 0;
  }
  function dropDepth() {
    const D = S.D, gl = S.gl;
    if (D) {
      for (const t of Object.values(D.zero)) try { gl.deleteTexture(t); } catch (e) { /* lost */ }
      for (const t of D.cpuTex) if (t) t.dispose();
      if (D.cpuZero) D.cpuZero.dispose();
      // (a stand-in's WebGL texture is the session's or a zero one: forgotten, never disposed, which would delete it)
      for (const t of D.ph) if (t) try { HOST.renderer.properties.remove(t); } catch (e) { /* gone */ }
    }
    S.D = null;
  }
  function end() {
    if (!S) return;
    if (S.vis) try { S.session.removeEventListener('visibilitychange', S.vis); } catch (e) { /* gone */ }
    dropRoom();
    dropDepth();
    S = null;
    hide();
  }
  // Ask again for what the session gave (v131). After a long sleep a Quest's runtime may stop, or start again, its depth
  // and its room scan, and nothing asked again (as with anchors not tracked after standby): the depth as at the start (a
  // new binding; its kind, reading and probe decided afresh; depth sensing resumed where the session says it is not
  // active, or does not say), and the room's parts dropped, so they are built again from what the frame lists now. With
  // room, the room only. Never a pause (v124's rule, below)
  function renew(why, room, hid) {
    const t = performance.now(), Q = S.depth, s = S.session, L = room ? S.tr : S.td;
    clog('occlusion renew', { why, room: !!room, depthActive: depthActive(), frames: S.frames, valid: S.valid, errors: Q.errors, err: Q.why || '',
      ago: S.lastDepthAt ? Math.round(t - S.lastDepthAt) : -1, hidden: Math.round(hid || 0), tries: L.n, parts: S.parts, posed: S.posed });
    if (S.parts) S.back.room = true;
    dropRoom();
    S.back.at = t; S.back.why = why;
    if (room) { S.roomRenews++; return; }
    S.renews++;
    dropDepth();
    S.decided = false; S.probeN = 0; S.probeAt = 0; S.probe = null; S.missSince = 0; S.throwRun = 0;
    if (!Q.enabled) return;
    S.back.depth = true;
    if (Q.usage !== 'cpu-optimized') bind();
    if (typeof s.resumeDepthSensing === 'function' && depthActive() !== true) {
      try { s.resumeDepthSensing(); S.resumes++; } catch (e) { warn('resuming the depth', e); }
    }
  }
  // the watchdog's ask, rate-limited: the first at least T.every after the last ask, each next one twice as long after,
  // at most T.cap since the session's start or a sleep; then given up: the Debug tab's line says to enter AR again, with
  // one notice a session (not for depth that never came)
  function tryRenew(why, room) {
    const L = room ? S.tr : S.td, t = performance.now();
    if (L.n >= T.cap) {
      if (L.gave) return;
      L.gave = t;
      clog('occlusion gave up', { what: room ? 'room' : 'depth', why, tries: L.n, ago: S.lastDepthAt ? Math.round(t - S.lastDepthAt) : -1 });
      if (!S.told && (room || S.everDepth)) {
        S.told = true;
        const n = HOST.collab && HOST.collab.notice;
        try {
          if (n) n(room ? 'The room no longer hides things' : 'People no longer hide things', room
            ? 'The headset stopped placing its room scan. Leave AR and enter it again to bring it back.'
            : 'The headset stopped giving its depth (people, hands). Leave AR and enter it again to bring it back.', 12000);
        } catch (e) { /* no notice */ }
      }
      return;
    }
    if (t - L.at < T.every * Math.pow(2, L.n)) return;
    L.n++; L.at = t;
    renew(why, room);
  }
  // Depth sensing is never paused (v124; until then it was paused while nothing used it). The owner, 8 November 2026:
  // "When real world hides is set to nothing on startup it never can be turned on and one needs to exit the headset and
  // go in again with it enabled": a Quest whose depth sensing was paused from the session's first frame did not give it
  // back after resumeDepthSensing. Whatever the reason, the depth now runs for the whole AR session (the setting only
  // decides what is drawn with it)

  // ---------------------------------------------------------------------------------------------- the depth
  // one 1 x 1 texture of zeros of a kind (an eye without depth this frame: every pixel discarded, never the other eye's
  // or an older frame's texture, which the session may have taken back)
  function keepBinding(target, fn) {
    const gl = S.gl, prev = gl.getParameter(target === gl.TEXTURE_2D_ARRAY ? gl.TEXTURE_BINDING_2D_ARRAY : gl.TEXTURE_BINDING_2D);
    try { return fn(); } finally { gl.bindTexture(target, prev); }
  }
  function zeroTex(k) {
    const D = S.D, key = kindKey(k);
    if (D.zero[key]) return D.zero[key];
    const gl = S.gl, target = k.arr ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D;
    return keepBinding(target, () => {
      const fy = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL), pm = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      const t = gl.createTexture(); gl.bindTexture(target, t);
      const [ifmt, fmt, type, data] = k.int ? [gl.R16UI, gl.RED_INTEGER, gl.UNSIGNED_SHORT, new Uint16Array(1)] : k.la ? [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)] : [gl.R32F, gl.RED, gl.FLOAT, new Float32Array(1)];
      if (k.arr) gl.texImage3D(target, 0, ifmt, 1, 1, 1, 0, fmt, type, data); else gl.texImage2D(target, 0, ifmt, 1, 1, 0, fmt, type, data);
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, fy); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, pm);
      return (D.zero[key] = t);
    });
  }
  // a texture that stands for the session's own (three.js binds the WebGL texture we give it, as it is: never uploaded)
  function placeholder(arr) {
    const t = arr ? new THREE.DataTexture2DArray(null, 1, 1, 1) : new THREE.Texture();
    t.version = 0;
    return t;
  }
  // the session's texture made complete for texelFetch (nearest, no mipmaps: a new texture's default filter wants mipmaps
  // it does not have, and an incomplete texture reads as 0), every frame and every eye before anything draws, since the
  // session may hand out another texture each frame
  function ready(tex, arr) {
    if (!tex) return;
    const gl = S.gl, target = arr ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D;
    keepBinding(target, () => {
      gl.bindTexture(target, tex);
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    });
  }
  // CPU depth (a phone's, say): the eye's values as metres in a float texture of our own
  function cpuUpload(E, info, rv) {
    const D = S.D, w = info.width, h = info.height, buf = info.data;
    const src = S.depth.format === 'float32' ? new Float32Array(buf) : new Uint16Array(buf);
    let tex = D.cpuTex[E.i];
    if (!tex || tex.image.width !== w || tex.image.height !== h) {
      if (tex) tex.dispose();
      const q = HOST.quiet; HOST.quiet = true;
      try { tex = D.cpuTex[E.i] = new THREE.DataTexture(new Float32Array(w * h), w, h, THREE.RedFormat, THREE.FloatType); } finally { HOST.quiet = q; }
    }
    const dst = tex.image.data;
    for (let j = 0; j < dst.length && j < src.length; j++) dst[j] = src[j] * rv;
    tex.needsUpdate = true;
  }
  // the depth's kind decided afresh (its shape changed: a texture array or a texture per eye, its format, its own range,
  // its scale): the stand-ins of the old kind forgotten, the reading and the probe again
  function redecide(from, to) {
    const D = S.D, t = performance.now();
    for (const x of D.ph) if (x) try { HOST.renderer.properties.remove(x); } catch (e) { /* gone */ }
    D.ph = []; D.kind = null; D.used = ''; S.decided = false; S.probeN = 0; S.probe = null; S.redecides++;
    if (t - S.shapeLogAt > 2000) { S.shapeLogAt = t; clog('occlusion renew', { why: 'shape', from, to, frames: S.frames, valid: S.valid, count: S.redecides }); }
  }
  // this frame's depth for each eye ({ tex, layer, scale, near, far, inf, matrix } or none). Only this frame's is used:
  // the session may take a texture back after its frame
  function depthStep(f) {
    const Q = S.depth;
    if (S.D) S.D.eyes = [];
    if (!Q.enabled || !S.views) return false;
    const gpu = Q.usage !== 'cpu-optimized';
    if (gpu && !S.binding) return false;
    if (!S.D) S.D = { kind: null, shape: '', cpu: !gpu, ph: [], cpuTex: [], eyes: [], zero: {}, used: '' };
    const D = S.D, rs = S.session.renderState || {}, fmt = get(S.session, 'depthDataFormat');
    if (fmt) Q.format = fmt;   // (read each frame: part of the depth's shape)
    S.frames++;
    let any = false, threw = false;
    S.views.forEach((view, i) => {
      let info = null;
      try { info = gpu ? S.binding.getDepthInformation(view) : f.getDepthInformation(view); } catch (e) { Q.errors++; Q.why = msg(e); threw = true; }
      if (!info || (gpu && !info.texture) || (!gpu && !info.data)) return;
      const g = k => { try { return info[k]; } catch (e) { return undefined; } };
      const arr = g('textureType') === 'texture-array';
      // a depth buffer's near and far: the depth information's own when it gives them (Quest Browser: 0.1 and Infinity),
      // else the session's
      const rv = +g('rawValueToMeters') || 1, dn = +g('depthNear'), df = +g('depthFar'), ownRange = dn > 0 && df > dn, far = ownRange ? df : (rs.depthFar || 1000);
      // the depth's shape (its kind of texture, its format, whether it gives its own range, its scale): one that changes
      // from what the kind was decided on (a depth provider started again after a sleep, say) is decided afresh
      const shape = (gpu ? g('textureType') : 'cpu') + '|' + Q.format + '|' + (ownRange ? 'own' : 'session') + '|' + rv;
      if (!any && D.kind && D.shape !== shape) redecide(D.shape, shape);
      if (!D.kind) { D.kind = gpu ? { arr, int: false, la: Q.format === 'luminance-alpha' } : { arr: false, int: false, la: false }; D.shape = shape; }
      const mat = g('normDepthBufferFromNormView'), M = mat && mat.matrix ? Array.from(mat.matrix) : IDENT;
      const E = { i, rv, tex: gpu ? info.texture : null, layer: arr ? (+g('imageIndex') || 0) : 0, matrix: M, cpu: !gpu,
        // (a 16-bit value read through a float sampler comes as value / 65535)
        scale: !gpu ? 1 : (Q.format === 'unsigned-short' && !D.kind.int ? rv * 65535 : rv),
        near: ownRange ? dn : (rs.depthNear || 0.1), far, inf: !(far < 1e6), own: ownRange };
      if (!gpu) cpuUpload(E, info, rv);
      else { if (!D.ph[i]) D.ph[i] = placeholder(D.kind.arr); ready(E.tex, D.kind.arr); }
      D.eyes[i] = E; any = true;
    });
    S.throwRun = threw && !any ? S.throwRun + 1 : 0;
    if (!any) return false;
    S.valid++;
    // the reading: until the probe has said, a depth buffer's when the depth gives its own range (as Quest Browser's
    // does), else metres; the probe (the room test's auto reading) looks once at the values themselves
    if (gpu && !S.decided && performance.now() - S.probeAt > 1000 && S.probeN < 6) {
      S.probeAt = performance.now(); S.probeN++;
      try { S.probe = probe(); } catch (e) { warn('the probe', e); S.probe = null; try { rawEnd(); } catch (er) { /* */ } }
    }
    decide();
    if (gpu && D.kind && S.views.some((v, i) => !D.eyes[i])) zeroTex(D.kind);   // (made before anything draws)
    return true;
  }
  // window (a depth buffer's) when every value is between 0 and 1 and they bunch near 1 and nothing scales them to metres
  // (or the depth gives its own near and far, which only a depth buffer needs); else metres
  function decide() {
    const D = S.D, E = D.eyes.find(Boolean), P = S.probe;
    if (!E) return;
    if (E.cpu) { D.used = 'metres'; S.decided = true; return; }
    const plain = E.scale === 1 || E.own;
    if (P && P.n) { D.used = P.buf && plain ? 'window' : 'metres'; S.decided = true; }
    else D.used = E.own ? 'window' : 'metres';
  }
  // per eye, as three.js draws the ArrayCamera one camera at a time (its left camera on layer 1, its right on layer 2):
  // that eye's texture, layer and reading
  function eyeUniforms(cam) {
    const m = O.quad.material, u = m && m.uniforms, D = S && S.D;
    if (!u || !D || !D.kind) return;
    const L = cam && cam.layers ? cam.layers.mask : 0, eye = L & 4 ? 1 : 0, E = (L & 6) ? D.eyes[eye] : null;
    if (E) {
      u.uLayer.value = E.layer; u.uScale.value = E.scale; u.uWin.value = D.used === 'window' ? 1 : 0;
      u.uNear.value = E.near; u.uFar.value = E.inf ? 1000 : E.far; u.uInf.value = E.inf ? 1 : 0; u.uM.value.fromArray(E.matrix);
    }
    if (D.cpu) u.uDepth.value = E ? D.cpuTex[eye] : cpuZero();
    else {
      const ph = D.ph[eye] || (D.ph[eye] = placeholder(D.kind.arr));
      u.uDepth.value = ph;
      const p = HOST.renderer.properties.get(ph);
      p.__webglTexture = E ? E.tex : D.zero[kindKey(D.kind)] || null; p.__webglInit = true;
    }
    m.uniformsNeedUpdate = true;
  }
  function cpuZero() { const D = S.D; return D.cpuZero || (D.cpuZero = new THREE.DataTexture(new Float32Array(1), 1, 1, THREE.RedFormat, THREE.FloatType)); }

  // the probe (raw WebGL, the room test's): each eye's 16 x 16 grid of raw values read back, a few times at most a
  // session until it has values; an integer texture refused by a float sampler is tried with an integer one
  function compile(fragBody, k) {
    const gl = S.gl, sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'compile'); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, '#version 300 es\n#define varying out\nin vec2 position;\n' + VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, '#version 300 es\n#define varying in\n' + defs(k) + FRAG_HEAD + fragBody));
    gl.bindAttribLocation(p, 0, 'position');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    return { p, uDepth: gl.getUniformLocation(p, 'uDepth'), uLayer: gl.getUniformLocation(p, 'uLayer') };
  }
  function probeProgram(k) {
    O.progs = O.progs || {};
    const key = kindKey(k);
    if (!(key in O.progs)) { try { O.progs[key] = compile(FRAG_PROBE, k); } catch (e) { O.progs[key] = null; warn('the probe\'s program', e); } }
    return O.progs[key];
  }
  function rawSetup() {
    const gl = S.gl;
    if (!O.vao) {
      O.vao = gl.createVertexArray(); gl.bindVertexArray(O.vao);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
    }
    if (!O.probeFb) {
      O.probeTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, O.probeTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 16, 16, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      O.probeFb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, O.probeFb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, O.probeTex, 0);
    }
  }
  function rawEnd() {
    const gl = S.gl, r = HOST.renderer, L = S.session.renderState && S.session.renderState.baseLayer;
    gl.bindVertexArray(null); gl.useProgram(null);
    r.resetState();   // three.js forgets what it thought was bound ...
    if (r.state.bindXRFramebuffer) r.state.bindXRFramebuffer(L ? L.framebuffer : null);   // ... and draws into the headset's framebuffer again
  }
  function probe() {
    const gl = S.gl, D = S.D, out = { n: 0, over1: 0, median: 0, max: 0, buf: false };
    rawSetup();
    const vals = [];
    for (const E of D.eyes) {
      if (!E || E.cpu) continue;
      let k = D.kind, prog = probeProgram(k);
      if (!prog) break;
      gl.getError();
      const draw = () => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, O.probeFb); gl.viewport(0, 0, 16, 16);
        for (const c of [gl.BLEND, gl.DEPTH_TEST, gl.SCISSOR_TEST, gl.CULL_FACE, gl.STENCIL_TEST]) gl.disable(c);
        gl.colorMask(true, true, true, true);
        gl.useProgram(prog.p); gl.bindVertexArray(O.vao);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(k.arr ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D, E.tex);
        gl.uniform1i(prog.uDepth, 0); gl.uniform1f(prog.uLayer, E.layer);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        return gl.getError();
      };
      let err = draw();
      if (err === gl.INVALID_OPERATION && !k.int && !k.la) {
        const k2 = Object.assign({}, k, { int: true }), p2 = probeProgram(k2);
        if (p2) { k = k2; prog = p2; err = draw(); if (!err) { D.kind = k2; for (const X of D.eyes) if (X && !X.cpu) X.scale = X.rv; } }
      }
      if (err) continue;
      const px = new Uint8Array(16 * 16 * 4);
      gl.readPixels(0, 0, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (const v of new Float32Array(px.buffer)) if (isFinite(v) && v > 0) vals.push(v);
    }
    rawEnd();
    vals.sort((a, b) => a - b);
    out.n = vals.length;
    if (out.n) {
      out.median = vals[out.n >> 1]; out.max = vals[out.n - 1]; out.over1 = vals.filter(v => v > 1).length;
      out.buf = !out.over1 && out.median > 0.9 && out.max < 1;
    }
    return out;
  }

  // ---------------------------------------------------------------------------------------------- the room
  // a part's shape, to tell a real change from lastChangedTime moving on (a Quest 3 moved it about 56 times a second with
  // nothing changed): a plane by its corners, a mesh by its sizes and a sample of its values (a big scan is not hashed
  // whole every frame), the same arrays as last time taken as the same shape
  function shapeSig(o, kind, e) {
    if (kind === 'plane') return Array.from(o.polygon || []).map(p => Math.round(p.x * 1000) + ',' + Math.round(p.y * 1000) + ',' + Math.round(p.z * 1000)).join(';');
    const v = o.vertices || [], ix = o.indices || [];
    if (e && e.v === v && e.ix === ix && e.sig) return e.sig;
    const sv = Math.max(1, Math.floor(v.length / 1024)), si = Math.max(1, Math.floor(ix.length / 1024));
    let h = 7;
    for (let i = 0; i < v.length; i += sv) h = (h * 31 + Math.round(v[i] * 1000)) | 0;
    for (let i = 0; i < ix.length; i += si) h = (h * 31 + ix[i]) | 0;
    return v.length + ':' + ix.length + ':' + h;
  }
  function buildPart(o, kind) {
    const geo = new THREE.BufferGeometry();
    if (kind === 'plane') {
      const pts = Array.from(o.polygon || []), pos = new Float32Array(pts.length * 3), idx = [];
      pts.forEach((p, k) => { pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; });
      for (let k = 1; k + 1 < pts.length; k++) idx.push(0, k, k + 1);   // (the polygon is convex)
      if (!idx.length) return null;
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
    } else {
      const v = o.vertices, ix = o.indices;
      if (!v || v.length < 9) return null;
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
      if (ix) geo.setIndex(new THREE.BufferAttribute(ix instanceof Uint32Array ? new Uint32Array(ix) : new Uint32Array(Array.from(ix)), 1));
    }
    const m = new THREE.Mesh(geo, O.roomMat);
    m.matrixAutoUpdate = false; m.renderOrder = -1;   // (after the depth: both write the nearer)
    return m;
  }
  function dropPart(e) {
    if (!e.m) return;
    if (e.m.parent) e.m.parent.remove(e.m);
    e.m.geometry.dispose(); e.m = null;
  }
  // each part's pose every frame; a part whose shape changed keeps its old drawing until the new one is built (never a
  // gap), at most two built a frame
  function roomSync(set, map, kind, f, ref, budget) {
    const seen = new Set();
    set.forEach(o => {
      seen.add(o);
      let e = map.get(o);
      if (!e || e.changed !== o.lastChangedTime) {
        let sig = '';
        try { sig = shapeSig(o, kind, e); } catch (err) { warn('the room scan', err); return; }
        if (e) { e.changed = o.lastChangedTime; if (sig !== e.sig) { e.sig = sig; e.stale = true; } }
        else { e = { m: null, changed: o.lastChangedTime, sig, stale: true }; map.set(o, e); }
        if (kind === 'mesh') { e.v = o.vertices; e.ix = o.indices; }
      }
      if (e.stale && budget.n > 0) {
        budget.n--; e.stale = false;
        let m = null;
        const q = HOST.quiet; HOST.quiet = true;
        try { m = buildPart(o, kind); } catch (err) { warn('building the room', err); } finally { HOST.quiet = q; }
        if (m) { dropPart(e); e.m = m; O.room.add(m); S.built++; }
      }
      if (!e.m) return;
      let pose = null;
      try { pose = f.getPose(kind === 'plane' ? o.planeSpace : o.meshSpace, ref); } catch (err) { /* not this frame */ }
      if (pose) { e.m.matrix.fromArray(pose.transform.matrix); e.m.matrixWorldNeedsUpdate = true; }
      e.m.visible = !!pose;
      S.parts++; if (pose) S.posed++;
    });
    for (const [o, e] of map) if (!seen.has(o)) { dropPart(e); map.delete(o); }
  }
  function roomStep(f, ref) {
    const budget = { n: 2 };
    S.parts = 0; S.posed = 0;
    if (S.planesOn) { let s = null; try { s = f.detectedPlanes; } catch (e) { /* none */ } if (s) roomSync(s, S.planes, 'plane', f, ref, budget); }
    if (S.meshesOn) { let s = null; try { s = f.detectedMeshes; } catch (e) { /* none */ } if (s) roomSync(s, S.meshes, 'mesh', f, ref, budget); }
    return S.planes.size + S.meshes.size > 0;
  }

  // ---------------------------------------------------------------------------------------------- each frame
  // before the story's own frame (HOST.loading.wrap): the depth fetched for this frame, the room's parts placed, both
  // hung in the story's scene, so the story's render draws them first
  function step(f) {
    const r = HOST.renderer, s = HOST.session, pres = !!(r && s && r.xr.isPresenting);
    if (O.lost) { hide(); return; }   // (the WebGL context lost: nothing until it is restored, restored() below)
    if (S && (S.session !== s || !pres)) end();
    if (!pres || !ar()) { hide(); return; }
    // (three.js r128 also runs the loop on the window's frames when it is given during a session: such a frame has no
    // XRFrame, and the last frame's depth may be gone by then)
    if (!f) { if (O.quad) O.quad.visible = false; return; }
    if (!S) begin(s, r);
    const t = performance.now();
    // back from a sleep: asked again at once, and the watchdog's tries start afresh
    if (S.wakeDue) {
      const h = S.wakeDue;
      S.wakeDue = 0;
      for (const L of [S.td, S.tr]) { L.n = 0; L.at = t; L.gave = 0; }
      renew('wake', false, h);
    }
    // (frames that stopped coming for a while, as while the next story builds with the shell's loading scene: what was
    // missing before is counted afresh)
    if (t - (S.stepAt || t) > 5000) { S.missSince = 0; S.unposedSince = 0; S.throwRun = 0; }
    S.stepAt = t;
    const sc = storyScene();
    if (!sc) { hide(); S.missSince = 0; S.unposedSince = 0; S.throwRun = 0; return; }
    make();
    if (O.root.parent !== sc) sc.add(O.root);
    const m = mode(), wantD = m === 'both' || m === 'depth', wantR = m === 'both' || m === 'room';
    const ref = r.xr.getReferenceSpace();
    S.views = null;
    try { const vp = f.getViewerPose(ref); S.views = vp ? vp.views : null; } catch (e) { /* not this frame */ }
    let d = false, rm = false;
    if (S.D) S.D.eyes = [];
    if (wantD && S.views) {
      try { d = depthStep(f); } catch (e) { warn('the depth', e); d = false; }
    }
    if (d) O.quad.material = depthMaterial(S.D.kind);
    O.quad.visible = d;
    if (wantR) {
      try { rm = roomStep(f, ref); } catch (e) { warn('the room', e); }
    }
    O.room.visible = rm;
    O.root.visible = d || rm;
    // the watchdog: only while the session is visible (hidden or blurred, a headset may stop its depth on purpose) and
    // only for what the mode uses
    const v = get(s, 'visibilityState'), live = !v || v === 'visible';
    if (live && wantD && S.views && S.depth.enabled) depthWatch(d, t); else { S.missSince = 0; S.throwRun = 0; }
    if (live && wantR) roomWatch(t); else S.unposedSince = 0;
  }
  // depth that had come and is wanted, the views there, but none for T.lost; or its calls throwing on T.throws frames in
  // a row (from the start too)
  function depthWatch(d, t) {
    if (d) {
      S.lastDepthAt = t; S.everDepth = true; S.missSince = 0; S.td.gave = 0;
      if (S.back.depth) { S.back.depth = false; clog('occlusion back', { what: 'depth', why: S.back.why, ms: Math.round(t - S.back.at), renews: S.renews, resumes: S.resumes }); }
      return;
    }
    if (!S.missSince) S.missSince = t;
    if (S.throwRun >= T.throws) tryRenew('depth throws');
    else if (S.everDepth && t - S.missSince >= T.lost) tryRenew('depth lost');
  }
  // room parts there, none of them with a pose for T.room: the room built again (only the room); 'occlusion room' when
  // the parts posed go to or from none
  function roomWatch(t) {
    const n = S.posed;
    if ((n > 0) !== (S.posedLast > 0)) clog('occlusion room', { posed: n, parts: S.parts, planes: S.planes.size, meshes: S.meshes.size });
    S.posedLast = n;
    if (n > 0 || !S.parts) {
      S.unposedSince = 0;
      if (n > 0) {
        S.tr.gave = 0;
        if (S.back.room) { S.back.room = false; clog('occlusion back', { what: 'room', why: S.back.why, ms: Math.round(t - S.back.at), posed: n, parts: S.parts }); }
      }
      return;
    }
    if (!S.unposedSince) S.unposedSince = t;
    if (t - S.unposedSince >= T.room) tryRenew('room', true);
  }
  function wrap(fn) {
    if (!fn) return fn;
    return function (t, f) {
      try { step(f); } catch (e) { warn('the frame', e); hide(); }
      return fn(t, f);
    };
  }

  return {
    MODES, SAY,
    // the mode in use (a story's own, else this headset's), this headset's own, the next after one, and the story's
    mode, own: () => own, next: m => NEXT[MODES.includes(m) ? m : own], over: () => O.over, say: m => SAY[m] || SAY.off,
    set(m) { if (!MODES.includes(m)) return; own = m; try { localStorage.setItem('xrOccl', m); } catch (e) { /* storage blocked */ } },
    // a story's own (the studio's scene: true is 'both', false 'off', null this headset's own again); cleared when the
    // story changes (detach)
    scene(m) { O.over = m === true ? 'both' : m === false ? 'off' : MODES.includes(m) ? m : null; return O.over; },
    sig: () => mode() + (O.over ? '!' : '') + (ar() ? 'a' : '') + (S && (S.td.gave || S.tr.gave) ? 'x' : ''),
    ar, wrap,
    // the shell, before a story is disposed: out of its scene (hung in the next one's on its first frame) and its own
    // choice forgotten
    detach() { O.over = null; if (O.root && O.root.parent) O.root.parent.remove(O.root); },
    // the WebGL context lost and restored (index.html's makeRenderer): nothing drawn meanwhile; restored, our own GL
    // objects (the probe's program, its quad and framebuffer, the zero textures) belong to the lost context, so they are
    // forgotten and the session's part begins anew on the next frame (three.js makes its own again; the headset's layer
    // would need the session started again, which only leaving AR and entering again does)
    lost() { O.lost = true; hide(); },
    restored() {
      O.lost = false; O.restored++;
      O.progs = null; O.vao = null; O.probeFb = null; O.probeTex = null;
      if (S && S.D) { S.D.zero = {}; S.D.cpuTex = []; S.D.cpuZero = null; }
      end();
    },
    // the Debug tab's line
    line() {
      const m = mode(), what = SAY[m] + (O.over ? ' (the scene\'s)' : '');
      if (!S) return what + ' · not in AR';
      const Q = S.depth, D = S.D, E = D && D.eyes.find(Boolean), t = performance.now(), ago = S.lastDepthAt ? Math.round((t - S.lastDepthAt) / 1000) : 0;
      if (S.td.gave) return what + ' · ' + (S.everDepth ? 'depth stopped ' + ago + ' s ago' : 'no depth came (' + (Q.why || 'none given') + ')') + ': leave AR and enter again';
      if (S.tr.gave) return what + ' · the room scan stopped: leave AR and enter again';
      const dp = !Q.enabled ? 'no depth' : E ? 'depth ' + (E.cpu ? 'CPU' : 'GPU') + ', ' + (D.used || '?')
        : !(m === 'both' || m === 'depth') ? 'depth not used' : S.everDepth && S.missSince && t - S.missSince > 1000 ? 'depth stopped ' + ago + ' s ago, asked again ' + S.td.n : 'depth waiting';
      return what + ' · ' + dp + ' · room ' + (S.planes.size + S.meshes.size) + (S.renews + S.roomRenews ? ' · renewed ' + (S.renews + S.roomRenews) : '');
    },
    // for the headset's alignment samples (shared.js, every 5 s in a room): short keys
    sample() {
      if (!S) return null;
      const Q = S.depth, D = S.D;
      return { m: mode(), u: Q.usage || '', f: Q.format || '', k: D && D.kind ? kindKey(D.kind) : '', r: D ? D.used : '', a: depthActive(), n: S.frames, v: S.valid,
        ago: S.lastDepthAt ? Math.round(performance.now() - S.lastDepthAt) : -1, e: Q.errors, pl: S.planes.size, me: S.meshes.size, po: S.posed, rn: S.renews, rr: S.roomRenews };
    },
    // for tests: the times above shortened ({ wake, lost, room, every, cap, throws }, in ms; null the defaults again)
    times(o) {
      if (o === null) Object.assign(T, T0);
      else if (o) for (const k of Object.keys(T)) if (typeof o[k] === 'number' && o[k] >= 0) T[k] = o[k];
      return Object.assign({}, T);
    },
    // for tests: what is set and drawn now
    state() {
      const D = S && S.D;
      return { mode: mode(), own, over: O.over, ar: ar(), session: !!S, root: !!(O.root && O.root.visible && O.root.parent), inScene: !!(O.root && O.root.parent && O.root.parent === storyScene()),
        quad: !!(O.quad && O.quad.visible), roomShown: !!(O.room && O.room.visible), lost: O.lost, restored: O.restored,
        gl: { vao: !!O.vao, probe: !!O.probeFb, progs: O.progs ? Object.keys(O.progs).length : 0 },
        depth: S ? Object.assign({}, S.depth, { kind: D && D.kind, shape: D ? D.shape : '', used: D ? D.used : '', eyes: D ? D.eyes.map(E => !!E) : [], frames: S.frames, valid: S.valid, decided: S.decided, probe: S.probe, probeN: S.probeN }) : null,
        room: S ? { planes: S.planes.size, meshes: S.meshes.size, built: S.built, on: [S.planesOn, S.meshesOn], parts: S.parts } : null,
        lastDepthAt: S ? S.lastDepthAt : 0, hiddenAt: S ? S.hiddenAt : 0, hidLast: S ? S.hidLast : 0, renews: S ? S.renews : 0, roomRenews: S ? S.roomRenews : 0,
        redecides: S ? S.redecides : 0, resumes: S ? S.resumes : 0, bindings: S ? S.bindings : 0, posed: S ? S.posed : 0, depthActive: depthActive(),
        tries: S ? { depth: S.td.n, room: S.tr.n } : null, gaveUp: S ? { depth: !!S.td.gave, room: !!S.tr.gave } : null, told: !!(S && S.told) };
    },
    parts: () => ({ root: O.root, quad: O.quad, room: O.room }),
  };
})();
