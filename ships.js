// Spaceships (HOST.ships, v132; the owner, 10 November 2026: "if we double click the right stick in ar or vr mode we get
// a little spaceship that we can control with the right controllers position in space, it is automatically going forward
// and the grip is brakes/reverse, trigger is shooting, each ship has a shield and health, shield fills up again, health
// does not, both get lower when hit, first shield then health, a is boost but that only lasts briefly"; asked, steering
// "like a joystick is better since otherwise one could not fully turn", "new ship after 5s", ships seen by "everyone",
// practice targets alone "yes totally, maybe some ships that also fly around", and then: "leave the drifting targets and
// the drones in when more join so players can also coop against them, also add some addons like additional boost and
// faster shooting for some times and reinforced shields pickups that spawn from time to time").
// The shell's own mini-game, not a story: it flies over every story and every circle, alone or in a shared room. The
// right stick clicked twice launches or lands (shared.js's sticks); while flying the right controller belongs to the
// ship (HOST.inputsGuard stops its presses before three.js and the shell hear them, HOST.collab.ray answers for its ray).
// Each headset decides about its own ship; one pilot, the leader, runs the shared targets, drones and pickups. All of it
// goes out as a field of this headset's presence and quiet effects on one room-wide key (KEY): nothing stored, no room
// key, no FORMAT change. Its objects hang in the story's scene (its root is the renderer's reference space), taken out
// before a story is disposed and hung in the next one's, as occlusion.js's are, so a story change keeps the ship flying.
HOST.ships = (function () {
  'use strict';
  const V3 = THREE.Vector3, Q4 = THREE.Quaternion, M4 = THREE.Matrix4;
  const DEG = Math.PI / 180;
  // the joystick (the owner: "like a joystick"; to be tuned on a Quest): the right controller's roll against gravity
  // turns the ship about the vertical (dead zone, full at, at most deg/s), its pitch from the neutral taken at launch sets
  // the flight pitch (dead zone, full past it by, at most deg, eased with tau s); its yaw counts for nothing. The ship
  // banks into its turns (bank, eased with btau), which does not change its path
  const STEER = { rollDz: 4, rollFull: 40, turnMax: 140, pitchDz: 4, pitchFull: 30, pitchMax: 60, tau: 0.25, bank: 50, btau: 0.15 };
  // speeds (m/s, m/s2): cruise, reverse (the grip held past rev), a boost, the most it changes a second
  const FLY = { cruise: 1.2, reverse: -0.5, rev: 0.9, brake: 0.8, boost: 3.2, accel: 2.5 };
  // the arena: round where the pilot stood at launch (m along the floor), from lo to hi m over the floor, turned back
  // gently within soft of its edge (deg/s at the edge)
  const ARENA = { r: 5, lo: 0.15, hi: 3.0, soft: 0.6, back: 90 };
  // the guns: shots a second (with rapid fire), m/s (plus the ship's speed), life (s), damage; drones' bolts
  const GUN = { rate: 5, rapid: 10, v: 8, life: 1.25, dmg: 20, dv: 6, ddmg: 10, nose: 0.12 };
  // hit spheres (m): a ship, a drone, a target; a pickup taken within touch of the ship's middle
  const HIT = { ship: 0.18, drone: 0.2, target: 0.12, touch: 0.25 };
  // shield and health (a reinforced shield adds extra on top, used first, never refilled); refill a second
  const HP = { shield: 100, health: 100, extra: 50, refill: 25, dshield: 30, dhealth: 60, thealth: 40 };
  // the shared set: targets, drones (2 for one pilot, one more for each further pilot, at most), their speed (m/s), how
  // near and how straight ahead a ship must be for a drone to fire (m, deg); pickups at once at most
  const BOT = { targets: 3, drones: 2, most: 5, speed: 0.9, turn: 60, range: 4, aim: 20, picks: 2 };
  // times (ms; times() for tests): a new ship; the shield's refill after a hit; a boost and its recharge; with the boost
  // pickup; a pickup's next one (between min and max), its life; rapid fire and the boost pickup's time; a destroyed drone
  // or target back; a drone's shots; a pilot silent this long is gone; a claim not given
  const T0 = { respawn: 5000, regen: 2000, boostLen: 800, boostCharge: 4000, boostLenUp: 1200, boostChargeUp: 1000, pickMin: 15000, pickMax: 30000,
    pickLife: 25000, boostUp: 15000, rapid: 12000, back: 8000, droneFire: 1500, quiet: 2000, claim: 1000 }, T = Object.assign({}, T0);
  // others' ships and the leader's set drawn this far behind the relay's time, between samples (as people's heads are);
  // carried on past the last sample at most carry ms; the effects sent at most every flush ms (batched: presence's 15 a
  // second and these at most 20 stay well under the relay's 60 a member)
  const NET = { delay: 120, carry: 100, keep: 8, gap: 1000, flush: 50 };
  // the room-wide key of the effects (the relay's KEY rule; older shells ignore a key they do not know, and no story's
  // effect hook ever hears it: those are e.<station>)
  const KEY = 'ships';
  const KIND = { b: { name: 'Boost', col: '#ffb43c' }, r: { name: 'Rapid fire', col: '#ff4b4b' }, s: { name: 'Reinforced shield', col: '#4fa8ff' } };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r3 = v => Math.round(v * 1000) / 1000, r4 = v => Math.round(v * 10000) / 10000;
  const fin = a => Array.isArray(a) && a.every(Number.isFinite);
  const wrapA = a => { a %= 2 * Math.PI; return a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a; };
  const rnd = (a, b) => a + Math.random() * (b - a);

  let L = null;   // the shell's link (shared.js, link below): the relay's clock, who we are, the room's frame, notices
  // the clocks: this frame's time (the session's own, ms), and the relay's (in a room the room's; for tests the frame's)
  let FT = 0;
  const TC = { on: false, off: 0 };
  const pnow = () => FT || performance.now();
  const now = () => (TC.on ? pnow() + TC.off : L && L.now ? L.now() : performance.now());
  const me = () => (L && L.id && L.id()) || 'me';
  const inRoom = () => !!(L && L.room && L.room());   // (a shared room, lined up: the ship flies in room coordinates and goes out)
  // others' ships and effects are in room coordinates: a headset whose game is not in the room's frame (in a room, not
  // lined up) plays alone and takes none of them; a page (no session) keeps them for its people list
  const offRoom = () => !!HOST.session && F.kind !== 'room';
  const say = (title, text, ms) => { try { if (L && L.notice) L.notice(title, text, ms || 3500); } catch (e) { /* no notice */ } };
  const log = (ev, o) => { try { if (L && L.log) L.log(ev, o); } catch (e) { /* no log */ } };
  const memberOf = id => (L && L.member ? L.member(id) : null) || {};
  const nameOf = id => (id === me() ? (L && L.name && L.name()) || 'You' : memberOf(id).name || 'Someone');
  const colOf = id => (id === me() ? (L && L.colour && L.colour()) || '#7fd4ff' : memberOf(id).color || '#c9d6e6');

  // ---------------------------------------------------------------------------------------------- the state
  // this headset's ship (in the game's frame: room coordinates in a room, else the renderer's space moved down to the floor)
  const S = { on: false, want: '', sess: null, lt: 0, src: null, neutral: 0, p: new V3(), yaw: 0, pitch: 0, bank: 0, speed: 0, q: new Q4(),
    shield: HP.shield, extra: 0, health: HP.health, hitAt: -1e9, boostT: 0, charge: 1, aWas: true, shotAt: -1e9, n: 0,
    down: 0, downR: 0, killer: '', rapidUntil: 0, boostUntil: 0, gift: '', c: [0, 0], kind: '', floorY: 0, turn: 0, bumpAt: 0, ctrl: false, why: '' };
  const F = { m: new M4(), mi: new M4(), kind: '', floor: null, floorAsked: null };   // the game's frame in the renderer's space
  const RS = new Map();   // others' ships: id -> { s: samples [{ ts, v }], at, lt, last, w: the set's samples }
  const BOLTS = new Map();   // live bolts: key -> { by, dr, o, d, v, t0, mine, hit }
  const KILLS = new Map();   // per member, since this device joined: { ships, bots }
  const OUT = [];   // effects to send (batched)
  const PEND = new Map(), GONE = new Map();   // pickups claimed here and not yet given; pickups given (hidden until the set says so)
  const FLASH = new Map();   // entity -> { t, kind: 'ring' | 'spark' }
  let W = null;   // the shared set while this headset leads: { c, n, t, d, k, seq }
  let VW = null;   // the set as drawn here (the leader's own, or its samples')
  let LEAD = '', lastNow = 0, lastT = 0, flushAt = 0, code = '';
  const FREEZE = { on: false }, TRACK = { on: false, list: [] };   // (tests: the drones and targets stand still and hold fire)

  // the joystick: from the controller's roll and pitch (degrees) and its neutral pitch, the turn (deg/s, right
  // positive), the flight pitch wanted (deg, nose up positive) and the bank (deg)
  function steer(rollDeg, pitchDeg, neutralDeg) {
    const ar = Math.abs(rollDeg), k = ar > STEER.rollDz ? Math.sign(rollDeg) * Math.min(1, (ar - STEER.rollDz) / (STEER.rollFull - STEER.rollDz)) : 0;
    const d = pitchDeg - neutralDeg, ad = Math.abs(d), c = ad > STEER.pitchDz ? Math.sign(d) * Math.min(1, (ad - STEER.pitchDz) / STEER.pitchFull) : 0;
    return { turn: k * STEER.turnMax, pitch: c * STEER.pitchMax, bank: k * STEER.bank };
  }
  // a controller's roll (its bank about its own forward axis, against gravity: right side down positive) and pitch (its
  // forward axis above the horizontal), degrees, from its orientation
  const _f = new V3(), _r = new V3(), _u = new V3();
  function angles(q) {
    _f.set(0, 0, -1).applyQuaternion(q); _r.set(1, 0, 0).applyQuaternion(q); _u.set(0, 1, 0).applyQuaternion(q);
    return { roll: Math.atan2(-_r.y, _u.y) / DEG, pitch: Math.asin(clamp(_f.y, -1, 1)) / DEG };
  }
  const dirOf = (yaw, pitch, out) => out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  const _e = new THREE.Euler(0, 0, 0, 'YXZ');
  const qOf = (yaw, pitch, bank, out) => out.setFromEuler(_e.set(pitch, yaw, -bank, 'YXZ'));

  // ---------------------------------------------------------------------------------------------- the look
  // Nothing large and see-through (the owner's frame rate in v131): opaque lit meshes, merged and instanced (a draw call a
  // kind), small additive glows only (engine, drones' eyes, crystals, bolts' trails, bursts). Lit by its own shader in
  // view space, so it looks the same in every story whatever its lights
  const LIT_V = `
attribute vec3 aCol; attribute vec2 aMix;
varying vec3 vC; varying vec3 vN; varying float vE;
void main() {
  vec4 p = vec4(position, 1.0); vec3 n = normal;
#ifdef USE_INSTANCING
  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
#endif
  vec3 c = aCol;
#ifdef USE_INSTANCING_COLOR
  c = mix(c, c * instanceColor, aMix.x);
#endif
  vC = c; vE = aMix.y;
  vN = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`;
  const LIT_F = `
varying vec3 vC; varying vec3 vN; varying float vE;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  float d = max(dot(n, normalize(vec3(0.35, 0.8, 0.5))), 0.0), rim = pow(1.0 - abs(n.z), 2.0) * 0.3;
  vec3 c = vC * (0.3 + 0.8 * d + rim);
  gl_FragColor = vec4(mix(c, vC * 1.5 + 0.1, vE), 1.0);
}`;
  const GLOW_V = `
attribute vec3 aColor; attribute float aSize; uniform float uPx;
varying vec3 vC;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vC = aColor;
  gl_PointSize = clamp(aSize * projectionMatrix[1][1] * uPx / max(0.05, -mv.z), 1.0, 64.0);
  gl_Position = projectionMatrix * mv;
}`;
  const GLOW_F = `
varying vec3 vC;
void main() { vec2 d = gl_PointCoord - 0.5; float a = max(0.0, 1.0 - dot(d, d) * 4.0); gl_FragColor = vec4(vC * a * a, 1.0); }`;
  // a part: a geometry placed (m: a matrix), its colour, how much it takes the pilot's colour (tint 0..1), how much it
  // glows (0..1); merged into one non-indexed geometry with aCol and aMix
  function part(geo, m, col, tint, glow) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(m); g.computeVertexNormals();
    const n = g.attributes.position.count, c = new THREE.Color(col), cols = new Float32Array(n * 3), mix = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; mix[i * 2] = tint || 0; mix[i * 2 + 1] = glow || 0; }
    return { p: g.attributes.position.array, n: g.attributes.normal.array, c: cols, x: mix };
  }
  function merge(parts) {
    const len = k => parts.reduce((a, q) => a + q[k].length, 0), out = {};
    for (const k of ['p', 'n', 'c', 'x']) { const a = new Float32Array(len(k)); let o = 0; for (const q of parts) { a.set(q[k], o); o += q[k].length; } out[k] = a; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(out.p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(out.n, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(out.c, 3)); g.setAttribute('aMix', new THREE.BufferAttribute(out.x, 2));
    g.computeBoundingSphere();
    return g;
  }
  // a flat slab from a convex polygon in its x, y plane (counter-clockwise), thickness along z
  function slab(pts, th) {
    const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false, steps: 1, curveSegments: 1 });
    g.translate(0, 0, -th / 2);
    return g;
  }
  const mat = (p, q, s) => new M4().compose(new V3(...(p || [0, 0, 0])), q || new Q4(), new V3(...(s || [1, 1, 1])));
  const rotX = a => new Q4().setFromAxisAngle(new V3(1, 0, 0), a), rotY = a => new Q4().setFromAxisAngle(new V3(0, 1, 0), a), rotZ = a => new Q4().setFromAxisAngle(new V3(0, 0, 1), a);
  // the ship (an original low-poly fighter about 0.2 m long, its nose to -z, under 600 triangles): a pointed hexagonal
  // body, swept wings, two fins leaning out, a dark cockpit, an engine at the back. White parts take the pilot's colour
  function shipGeo() {
    const P = [];
    P.push(part(new THREE.CylinderGeometry(0.017, 0.02, 0.1, 6, 1), mat([0, 0, 0.02], rotX(Math.PI / 2)), '#ffffff', 1, 0));   // the body
    P.push(part(new THREE.ConeGeometry(0.017, 0.075, 6, 1), mat([0, 0, -0.0675], rotX(-Math.PI / 2)), '#ffffff', 1, 0));   // the nose
    for (const sx of [1, -1]) {
      // a swept wing (its x, y plane laid flat: y becomes z), a little lower than the body's middle
      const w = slab([[0.012, -0.02], [0.095, 0.045], [0.095, 0.066], [0.012, 0.05]].map(([x, z]) => [x * sx, z]), 0.006);
      P.push(part(w, mat([0, -0.004, 0], rotX(Math.PI / 2), [1, 1, 1]), '#ffffff', 0.85, 0));
      // a wing tip in a light grey (does not take the colour), and a fin leaning out
      P.push(part(new THREE.BoxGeometry(0.008, 0.008, 0.03), mat([0.095 * sx, -0.004, 0.055]), '#d9e2ee', 0, 0));
      const fin = slab([[0, 0.035], [0.042, 0.07], [0.042, 0.082], [0, 0.078]].map(([y, z]) => [z, y]), 0.005);
      P.push(part(fin, mat([0.018 * sx, 0.008, 0], new Q4().multiplyQuaternions(rotZ(-0.35 * sx), rotY(-Math.PI / 2)), [1, 1, 1]), '#ffffff', 0.6, 0));
    }
    P.push(part(new THREE.SphereGeometry(1, 8, 5), mat([0, 0.015, -0.02], null, [0.011, 0.009, 0.028]), '#10233d', 0, 0.15));   // the cockpit
    P.push(part(new THREE.CylinderGeometry(0.013, 0.016, 0.016, 8, 1), mat([0, 0, 0.076], rotX(Math.PI / 2)), '#3a4250', 0, 0));   // the engine
    P.push(part(new THREE.CircleGeometry(0.011, 8), mat([0, 0, 0.0845]), '#9fe6ff', 0, 1));   // its glow, facing back
    return merge(P);
  }
  // a drone: a dark, flat, angular core with two swept blades and a red eye and red edges (another design altogether)
  function droneGeo() {
    const P = [];
    P.push(part(new THREE.OctahedronGeometry(0.06, 0), mat([0, 0, 0], null, [1, 0.45, 1.35]), '#2a2f38', 0, 0));
    for (const sx of [1, -1]) {
      const b = slab([[0.03, 0.02], [0.11, -0.03], [0.12, 0.0], [0.04, 0.05]].map(([x, z]) => [x * sx, z]), 0.008);
      P.push(part(b, mat([0, 0, 0], rotX(Math.PI / 2)), '#1c2028', 0, 0));
      P.push(part(new THREE.BoxGeometry(0.004, 0.01, 0.05), mat([0.118 * sx, 0, -0.005], rotY(0.6 * sx)), '#ff2a2a', 0, 1));
    }
    P.push(part(new THREE.SphereGeometry(0.014, 8, 6), mat([0, 0.004, -0.075]), '#ff3030', 0, 1));   // the eye
    return merge(P);
  }
  // a target: a glowing crystal, two long pyramids point to point
  function crystalGeo() { return merge([part(new THREE.OctahedronGeometry(0.07, 0), mat(null, null, [0.65, 1.45, 0.65]), '#7cf2ff', 0, 0.55)]); }
  // the pickups, each its own shape and colour: an amber chevron (boost), a red bolt (rapid fire), a blue hexagon (shield)
  function pickGeo(k) {
    if (k === 'b') return merge([0.6, -0.6].map(a => part(new THREE.BoxGeometry(0.022, 0.07, 0.022), mat([0.018 * Math.sign(a), 0, 0], rotZ(a)), '#ffb43c', 0, 0.5)));
    if (k === 'r') return merge([part(new THREE.ConeGeometry(0.03, 0.06, 4, 1), mat([0, 0.03, 0]), '#ff4b4b', 0, 0.5), part(new THREE.ConeGeometry(0.03, 0.06, 4, 1), mat([0, -0.03, 0], rotX(Math.PI)), '#ff4b4b', 0, 0.5)]);
    return merge([part(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 6, 1), mat(null, rotX(Math.PI / 2)), '#4fa8ff', 0, 0.45),
      part(new THREE.CylinderGeometry(0.025, 0.025, 0.026, 6, 1), mat(null, rotX(Math.PI / 2)), '#dff0ff', 0, 0.6)]);
  }
  const G = { made: false, root: null, hud: null, mat: null, ships: null, drones: null, targets: null, picks: {}, bolts: null, rings: null, barBg: null, barFill: null,
    glow: null, burst: null, tags: new Map(), hudMesh: null, hudCv: null, hudTex: null, hudSig: '', arrow: null, tris: 0 };
  const MAXS = 16, MAXB = 240, MAXG = 96, MAXP = 360;
  function inst(geo, m, n, coloured) {
    const x = new THREE.InstancedMesh(geo, m, n);
    if (coloured) x.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
    x.instanceMatrix.setUsage(THREE.DynamicDrawUsage); x.frustumCulled = false; x.count = 0;
    return x;
  }
  function points(n) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    const m = new THREE.ShaderMaterial({ vertexShader: GLOW_V, fragmentShader: GLOW_F, uniforms: { uPx: G.px }, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 3;
    return p;
  }
  // made once, with HOST.quiet set (nothing of them is a story's)
  function make() {
    if (G.made) return;
    const q = HOST.quiet;
    HOST.quiet = true;
    try {
      G.px = { value: 600 };
      G.root = new THREE.Group(); G.root.name = 'ships'; G.root.matrixAutoUpdate = false;
      G.hud = new THREE.Group(); G.hud.name = 'ships hud';
      G.mat = new THREE.ShaderMaterial({ vertexShader: LIT_V, fragmentShader: LIT_F, side: THREE.DoubleSide });
      const sg = shipGeo();
      G.tris = sg.attributes.position.count / 3;
      // (its own material: three.js r128 keeps one program a material, and an instanced mesh with colours needs another)
      G.ships = inst(sg, G.mat.clone(), MAXS, true);
      G.drones = inst(droneGeo(), G.mat, BOT.most, false);
      G.targets = inst(crystalGeo(), G.mat, BOT.targets, false);
      for (const k of Object.keys(KIND)) G.picks[k] = inst(pickGeo(k), G.mat, BOT.picks, false);
      // the bolts: small bright elongated boxes along +z, in the shooter's colour (drones' red), one draw
      G.bolts = inst(new THREE.BoxGeometry(0.011, 0.011, 0.09), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXB, true);
      // a hit on a shield: a thin ring round the ship, flashing (small and additive)
      G.rings = inst(new THREE.TorusGeometry(0.17, 0.005, 4, 28), new THREE.MeshBasicMaterial({ color: 0x5fc8ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }), 24, false);
      // the bars over every ship, drone and target (shield, health): opaque quads turned to you, a dark back and the fill
      const pl = new THREE.PlaneGeometry(1, 1);
      G.barBg = inst(pl, new THREE.MeshBasicMaterial({ color: 0x0c121c }), 64, false);
      G.barFill = inst(pl, new THREE.MeshBasicMaterial({ color: 0xffffff }), 96, true);
      G.glow = points(MAXG);
      G.burst = points(MAXP);
      G.root.add(G.ships, G.drones, G.targets, ...Object.values(G.picks), G.bolts, G.rings, G.barBg, G.barFill, G.glow, G.burst);
      // the pilot's own strip above the right controller, and the arrow to the ship when it is out of view: drawn over
      // everything (as the frame-rate read-out is), opaque
      G.hudCv = document.createElement('canvas'); G.hudCv.width = 384; G.hudCv.height = 136;
      G.hudTex = new THREE.CanvasTexture(G.hudCv);
      G.hudMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.053), new THREE.MeshBasicMaterial({ map: G.hudTex, depthTest: false, depthWrite: false }));
      G.hudMesh.renderOrder = 56; G.hudMesh.visible = false;
      G.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.036, 8, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false }));
      G.arrow.renderOrder = 56; G.arrow.visible = false;
      G.hud.add(G.hudMesh, G.arrow);
      G.made = true;
    } finally { HOST.quiet = q; }
  }
  // the story's scene (built: its collab hook gives it only then)
  function storyScene() {
    const c = HOST.cur && HOST.cur.collab;
    try { return c && c.scene ? c.scene() : null; } catch (e) { return null; }
  }
  function detach() { if (G.root && G.root.parent) G.root.parent.remove(G.root); if (G.hud && G.hud.parent) G.hud.parent.remove(G.hud); }

  // ---------------------------------------------------------------------------------------------- the session
  // the session's own local-floor, asked once (outside a room the arena's floor is its floor); a session that ends lands
  function watch(s) {
    if (s === S.sess) return;
    if (S.on) land('session', true);
    S.sess = s || null; F.floor = null; F.floorAsked = null; F.kind = '';
    // (a session begins or ends: what was heard before, as a page or in another frame, goes; no session: nothing of it
    // left standing in the story's scene, which a page then draws, and the page's clock its own again)
    BOLTS.clear(); RS.clear(); W = null; VW = null; LEAD = '';
    if (!s) { detach(); PART.n = 0; FT = 0; lastT = 0; lastNow = 0; return; }
    try {
      if (typeof s.requestReferenceSpace === 'function') {
        F.floorAsked = s;
        s.requestReferenceSpace('local-floor').then(sp => { if (S.sess === s) F.floor = sp; }, () => { /* none: the head's height less 1.6 m */ });
      }
      const q = HOST.quiet;
      HOST.quiet = true;
      try { if (typeof s.addEventListener === 'function') s.addEventListener('end', () => { if (S.sess === s && S.on) land('session', true); }); } finally { HOST.quiet = q; }
    } catch (e) { /* a pretend session */ }
  }
  const immersive = () => !!HOST.session && (HOST.mode === 'immersive-vr' || HOST.mode === 'immersive-ar');
  const isAR = () => HOST.mode === 'immersive-ar';
  // the right controller (tracked, with a gamepad; never a tracked hand), or null; the hand alone when it is one
  function rightSrc() {
    let list = null;
    try { list = HOST.session ? HOST.session.inputSources : null; } catch (e) { /* gone */ }
    if (!list) return null;
    let hand = null;
    for (let i = 0; i < list.length; i++) {
      const x = list[i];
      if (!x || x.handedness !== 'right') continue;
      if (x.hand || !x.gamepad) { hand = x; continue; }
      if (x.targetRayMode === 'tracked-pointer') return x;
    }
    return hand ? { hand: true } : null;
  }
  // why the ship cannot fly here ('' it can): no immersive session, camera mode, a phone's AR, no controller in the right hand
  function whyNot() {
    if (!immersive()) return 'Only in VR or AR, with a controller in your right hand.';
    if (L && L.camera && L.camera()) return 'Not in camera mode.';
    if (L && L.phone && L.phone()) return 'Not on a phone: it needs a headset\'s controllers.';
    const r = rightSrc();
    if (!r) return 'It needs a controller in your right hand.';
    if (r.hand) return 'It needs a controller in your right hand: pick up the right controller (a hand cannot fly it).';
    return '';
  }

  // ---------------------------------------------------------------------------------------------- each frame
  const _m = new M4(), _m2 = new M4(), _p = new V3(), _q = new Q4(), _v = new V3(), _v2 = new V3(), _d = new V3(), _hp = new V3(), _hq = new Q4(), _cq = new Q4();
  const HEAD = { ok: false, p: new V3(), q: new Q4(), g: new V3(), gq: new Q4(), yaw: 0 };   // in the renderer's space, and in the game's (g, gq)
  const CTRL = { ok: false, p: new V3(), q: new Q4(), g: new V3(), gq: new Q4(), roll: 0, pitch: 0, grip: 0, trig: false, a: false };
  // the game's frame: in a shared room, lined up, room coordinates (the room's matrix, room -> the renderer's space);
  // else the renderer's space moved down to its floor (the session's local-floor, or the head's height less 1.6 m)
  function frameStep(f, ref) {
    const kind = inRoom() ? 'room' : 'own';
    if (kind === 'room') { F.m.copy(L.roomM()); }
    else {
      if (F.kind !== 'own' || !S.on) {   // (the floor taken as the ship launches, then kept: no jump while it flies)
        let y = null;
        if (F.floor && f) { try { const p = f.getPose(F.floor, ref); if (p) y = p.transform.position.y; } catch (e) { /* not now */ } }
        if (y === null && HEAD.ok) y = HEAD.p.y - 1.6;
        if (y !== null) S.floorY = y;
      }
      F.m.makeTranslation(0, S.floorY, 0);
    }
    F.mi.copy(F.m).invert();
    const was = F.kind;
    F.kind = kind;
    return was && was !== kind;
  }
  function sense(f, ref) {
    HEAD.ok = false; CTRL.ok = false;
    let vp = null;
    try { vp = f.getViewerPose(ref); } catch (e) { /* not this frame */ }
    if (vp) {
      const p = vp.transform.position, o = vp.transform.orientation;
      HEAD.p.set(p.x, p.y, p.z); HEAD.q.set(o.x, o.y, o.z, o.w); HEAD.ok = true;
    }
    const src = rightSrc();
    S.src = src && !src.hand ? src : null;
    if (S.src) {
      let pose = null;
      try { pose = f.getPose(S.src.gripSpace || S.src.targetRaySpace, ref); } catch (e) { /* not tracked now */ }
      if (pose) {
        const p = pose.transform.position, o = pose.transform.orientation;
        CTRL.p.set(p.x, p.y, p.z); CTRL.q.set(o.x, o.y, o.z, o.w); CTRL.ok = true;
        const a = angles(CTRL.q);
        CTRL.roll = a.roll; CTRL.pitch = a.pitch;
      }
      const b = S.src.gamepad && S.src.gamepad.buttons;
      CTRL.grip = b && b[1] ? +b[1].value || (b[1].pressed ? 1 : 0) : 0;
      CTRL.trig = !!(b && b[0] && (b[0].pressed || b[0].value > 0.5));
      CTRL.a = !!(b && b[4] && b[4].pressed);
    } else { CTRL.grip = 0; CTRL.trig = false; CTRL.a = false; }
  }
  const toGame = (v, out) => out.copy(v).applyMatrix4(F.mi);
  const toRef = (v, out) => out.copy(v).applyMatrix4(F.m);
  function gameHead() {
    if (!HEAD.ok) return;
    toGame(HEAD.p, HEAD.g);
    _m.extractRotation(F.mi); _q.setFromRotationMatrix(_m);
    HEAD.gq.copy(_q).multiply(HEAD.q);
    _v.set(0, 0, -1).applyQuaternion(HEAD.gq);
    HEAD.yaw = Math.atan2(-_v.x, -_v.z);
    if (CTRL.ok) { toGame(CTRL.p, CTRL.g); CTRL.gq.copy(_q).multiply(CTRL.q); }
  }
  function frame(s, t, f) {
    if (!f || typeof f !== 'object') return;
    if (s !== HOST.session) return;
    const r = HOST.renderer;
    let ref = null;
    try { ref = r ? r.xr.getReferenceSpace() : null; } catch (e) { ref = null; }
    if (!ref) return;
    if (Number.isFinite(t) && t > 0) FT = t;
    const pt = pnow(), dt = lastT ? clamp((pt - lastT) / 1000, 0, 0.1) : 0;
    lastT = pt;
    const tn = now(), tp = lastNow || tn;
    lastNow = tn;
    const c = L && L.code ? L.code() : '';
    if (c !== code) { code = c; KILLS.clear(); RS.clear(); BOLTS.clear(); W = null; VW = null; LEAD = ''; }
    sense(f, ref);
    const moved = frameStep(f, ref);
    gameHead();
    // a launch or a landing asked for (the right stick twice, the menu's row): here, where the frame is known
    if (S.want) { const w = S.want; S.want = ''; if (w === 'land') { if (S.on) land('asked'); } else if (!S.on) launch(); }
    if (moved) { W = null; VW = null; LEAD = ''; BOLTS.clear(); RS.clear(); }   // (another frame: the set and the bolts were in the old one)
    if (S.on && moved) { log('ship frame', { kind: F.kind }); spawn(true); }   // (the room joined or left while flying: anew there)
    if (S.on) shipStep(dt, pt, tn, f, ref);
    expireRemote(pt);
    leadStep(dt, tn);
    boltStep(tp, tn);
    if (S.on && !S.down) pickTouch(pt, tn);
    for (const [id, at] of PEND) if (pt - at > T.claim) PEND.delete(id);
    for (const [id, at] of GONE) if (pt - at > 3000) GONE.delete(id);
    flush(pt);
    draw(dt, pt, tn);
  }

  // ---------------------------------------------------------------------------------------------- this headset's ship
  function launch() {
    const why = whyNot();
    if (why) { log('ship refused', { why }); say('Spaceship', why, 4500); return false; }
    S.on = true; S.lt = Math.round(now()); S.kind = F.kind;   // (S.n never reset: bolt keys stay unique per pilot)
    KILLS.has(me()) || KILLS.set(me(), { ships: 0, bots: 0 });
    // the arena round where the pilot stands now
    if (HEAD.ok) S.c = [HEAD.g.x, HEAD.g.z]; else S.c = [0, 0];
    spawn(false);
    log('ship launched', { kind: F.kind, c: S.c.map(r3) });
    play('launch', S.p);
    say('Spaceship', 'Tilt the right controller to turn, raise or lower its nose to climb. Trigger: shoot. Grip: brake. A: boost. Right stick twice: land.', 6000);
    if (L && L.changed) L.changed();
    return true;
  }
  // a new ship at the controller: 0.5 m ahead of it along the head's level forward, at its height (both clamped into the
  // arena), flying where the head faces, level; full shield and health; the neutral taken again
  const HIST = [];   // this ship's places over the last 0.6 s: [relay ms, x, y, z]
  function spawn(re) {
    HIST.length = 0;
    const yaw = HEAD.ok ? HEAD.yaw : 0, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const cx = CTRL.ok ? CTRL.g.x : HEAD.ok ? HEAD.g.x : S.c[0], cz = CTRL.ok ? CTRL.g.z : HEAD.ok ? HEAD.g.z : S.c[1], cy = CTRL.ok ? CTRL.g.y : 1.2;
    if (re && HEAD.ok) S.c = [HEAD.g.x, HEAD.g.z];   // (in another frame: the arena round where the pilot stands now)
    let x = cx + 0.5 * fx, z = cz + 0.5 * fz;
    const dx = x - S.c[0], dz = z - S.c[1], d = Math.hypot(dx, dz), lim = ARENA.r - 0.2;
    if (d > lim) { x = S.c[0] + dx * lim / d; z = S.c[1] + dz * lim / d; }
    S.p.set(x, clamp(cy, ARENA.lo + 0.05, ARENA.hi - 0.05), z);
    S.yaw = yaw; S.pitch = 0; S.bank = 0; S.speed = FLY.cruise;
    S.shield = HP.shield; S.extra = 0; S.health = HP.health; S.hitAt = -1e9; S.boostT = 0; S.charge = 1; S.aWas = true;
    S.down = 0; S.downR = 0; S.killer = '';
    S.neutral = CTRL.ok ? CTRL.pitch : 0;
    qOf(S.yaw, S.pitch, S.bank, S.q);
  }
  function land(why, quiet) {
    if (!S.on) return;
    S.on = false; S.down = 0; S.boostT = 0; S.rapidUntil = 0; S.boostUntil = 0; S.extra = 0; S.gift = '';
    log('ship landed', { why });
    if (!quiet) { play('land', S.p); say('Spaceship landed', 'Click the right stick twice to fly again.', 3000); }
    if (L && L.changed) L.changed();
  }
  const rapidOn = t => S.rapidUntil > t, boostUpOn = t => S.boostUntil > t;
  function shipStep(dt, pt, tn, f, ref) {
    if (S.down) {
      if (pt - S.down >= T.respawn) { spawn(false); play('respawn', S.p); log('ship respawned', {}); if (S.gift) { take(S.gift); S.gift = ''; } }
      return;
    }
    // the pickups' times running out: a chime
    if (S.rapidUntil && tn >= S.rapidUntil) { S.rapidUntil = 0; play('pickupEnd', S.p); }
    if (S.boostUntil && tn >= S.boostUntil) { S.boostUntil = 0; play('pickupEnd', S.p); }
    const st = CTRL.ok ? steer(CTRL.roll, CTRL.pitch, S.neutral) : { turn: 0, pitch: 0, bank: 0 };
    S.turn = st.turn;
    S.yaw = wrapA(S.yaw - st.turn * DEG * dt);
    S.pitch += (st.pitch * DEG - S.pitch) * (1 - Math.exp(-dt / STEER.tau));
    S.bank += (st.bank * DEG - S.bank) * (1 - Math.exp(-dt / STEER.btau));
    // the speed: cruise, the grip braking (reversing slowly once nearly full), the boost (A, its rising edge, when its
    // meter is full; braking ends it), at most accel a second but the boost's kick
    const g = clamp(CTRL.grip, 0, 1), up = boostUpOn(tn);
    if (CTRL.a && !S.aWas && S.charge >= 1 && g < 0.05) { S.boostT = up ? T.boostLenUp : T.boostLen; S.charge = 0; S.speed = FLY.boost; play('boost', S.p); }
    S.aWas = CTRL.a;
    if (g >= 0.05) S.boostT = 0;
    let want;
    if (S.boostT > 0) { want = FLY.boost; S.boostT = Math.max(0, S.boostT - dt * 1000); S.speed = FLY.boost; }
    else {
      want = g >= FLY.rev ? FLY.reverse : FLY.cruise * (1 - FLY.brake * g);
      S.charge = Math.min(1, S.charge + dt * 1000 / (up ? T.boostChargeUp : T.boostCharge));
      const dv = want - S.speed, lim = FLY.accel * dt;
      S.speed += clamp(dv, -lim, lim);
    }
    // within soft of the arena's edge, heading outwards: turned back gently towards its middle
    const rx = S.p.x - S.c[0], rz = S.p.z - S.c[1], rr = Math.hypot(rx, rz);
    if (rr > ARENA.r - ARENA.soft && rr > 1e-6) {
      const ux = rx / rr, uz = rz / rr, hx = -Math.sin(S.yaw) * Math.sign(S.speed || 1), hz = -Math.cos(S.yaw) * Math.sign(S.speed || 1);
      if (hx * ux + hz * uz > 0) {
        const yT = Math.atan2(ux, uz) + (S.speed < 0 ? Math.PI : 0), d = wrapA(yT - S.yaw), k = clamp((rr - (ARENA.r - ARENA.soft)) / ARENA.soft, 0, 1);
        S.yaw = wrapA(S.yaw + Math.sign(d) * Math.min(Math.abs(d), ARENA.back * DEG * k * dt));
      }
    }
    dirOf(S.yaw, S.pitch, _d);
    _v.copy(S.p);   // (where it was: the room scan's planes are tested along the way)
    S.p.addScaledVector(_d, S.speed * dt);
    // the arena's edge: it bounces (its heading reflected about the edge), and its floor and ceiling
    const ex = S.p.x - S.c[0], ez = S.p.z - S.c[1], er = Math.hypot(ex, ez);
    if (er > ARENA.r) {
      const ux = ex / er, uz = ez / er;
      S.p.x = S.c[0] + ux * (ARENA.r - 0.01); S.p.z = S.c[1] + uz * (ARENA.r - 0.01);
      if (S.speed >= 0) { const hx = -Math.sin(S.yaw), hz = -Math.cos(S.yaw), k = hx * ux + hz * uz; if (k > 0) S.yaw = Math.atan2(-(hx - 2 * k * ux), -(hz - 2 * k * uz)); }
      bump();
    }
    // (its floor and ceiling: held there, level, until it is steered away)
    if (S.p.y < ARENA.lo) { S.p.y = ARENA.lo; if (S.pitch < 0) S.pitch = 0; }
    if (S.p.y > ARENA.hi) { S.p.y = ARENA.hi; if (S.pitch > 0) S.pitch = 0; }
    if (isAR()) planesBounce(f, ref, _v, pt);
    qOf(S.yaw, S.pitch, S.bank, S.q);
    if (TRACK.on) { TRACK.list.push([tn, S.p.x, S.p.y, S.p.z]); if (TRACK.list.length > 600) TRACK.list.shift(); }
    // the shield refills a while after the last hit; the health never does
    if (pt - S.hitAt >= T.regen && S.shield < HP.shield) S.shield = Math.min(HP.shield, S.shield + HP.refill * dt);
    // the trigger held: bolts from the nose, at most rate a second (rapid with the pickup)
    // (held, the next shot an interval after the last, not a frame later: the rate exact whatever the frame rate)
    const iv = 1000 / (rapidOn(tn) ? GUN.rapid : GUN.rate);
    if (CTRL.trig && pt - S.shotAt >= iv - 0.5) { S.shotAt = pt - S.shotAt < 2 * iv ? S.shotAt + iv : pt; shoot(tn); }
    // (where it has been, by the relay's time: a bolt heard late is swept against where the ship was then)
    HIST.push([tn, S.p.x, S.p.y, S.p.z]);
    while (HIST.length > 2 && tn - HIST[0][0] > 600) HIST.shift();
  }
  function bump() { const t = pnow(); if (t - S.bumpAt > 200) { S.bumpAt = t; play('bump', S.p); } }
  // In AR, the room scan's planes (walls, floor, ceiling, tables): the ship crossing one inside its polygon bounces off it
  // (its heading reflected about the plane), with a bump and no damage. Read from the frame (posed in the renderer's space)
  const PL = { list: [], at: 0 };
  const _pa = new V3(), _pb = new V3(), _pn = new V3(), _pm = new M4(), _pmi = new M4();
  function planesBounce(f, ref, from, pt) {
    let set = null;
    try { const ef = HOST.session && HOST.session.enabledFeatures; if (!ef || Array.prototype.includes.call(ef, 'plane-detection')) set = f.detectedPlanes; } catch (e) { set = null; }
    if (!set || !set.size) return;
    if (pt - S.bumpAt < 150) return;
    toRef(from, _pa); toRef(S.p, _pb);
    let k = 0;
    for (const pl of set) {
      if (++k > 64) break;
      let pose = null;
      try { pose = f.getPose(pl.planeSpace, ref); } catch (e) { pose = null; }
      if (!pose || !pl.polygon || pl.polygon.length < 3) continue;
      _pm.fromArray(pose.transform.matrix); _pmi.copy(_pm).invert();
      const a = _v2.copy(_pa).applyMatrix4(_pmi), ay = a.y, ax = a.x, az = a.z, b = _d.copy(_pb).applyMatrix4(_pmi), m = 0.05;
      const cross = (ay > m && b.y <= m) || (ay < -m && b.y >= -m);
      if (!cross) continue;
      const tt = Math.abs(ay - b.y) > 1e-6 ? (ay - Math.sign(ay) * m) / (ay - b.y) : 0, ix = ax + (b.x - ax) * tt, iz = az + (b.z - az) * tt;
      if (!inPoly(pl.polygon, ix, iz)) continue;
      // reflected about the plane's normal (its y), in the game's frame
      _pn.set(_pm.elements[4], _pm.elements[5], _pm.elements[6]).normalize().transformDirection(F.mi);
      dirOf(S.yaw, S.pitch, _d);
      if (S.speed < 0) _d.negate();
      _d.addScaledVector(_pn, -2 * _d.dot(_pn));
      if (S.speed < 0) _d.negate();
      S.yaw = Math.atan2(-_d.x, -_d.z); S.pitch = Math.asin(clamp(_d.y, -1, 1));
      S.p.copy(from);   // (back where it was this frame, its heading reflected)
      bump();
      log('ship bump', { plane: pl.semanticLabel || pl.orientation || '' });
      return;
    }
  }
  function inPoly(poly, x, z) {
    let ins = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, zi = poly[i].z, xj = poly[j].x, zj = poly[j].z;
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi) ins = !ins;
    }
    return ins;
  }
  function shoot(tn) {
    dirOf(S.yaw, S.pitch, _d);
    const o = _v.copy(S.p).addScaledVector(_d, GUN.nose), i = ++S.n;
    const ev = { k: 'b', i, o: [r3(o.x), r3(o.y), r3(o.z)], d: [r4(_d.x), r4(_d.y), r4(_d.z)], v: r3(GUN.v + S.speed), t: Math.round(tn) };
    emit(ev);
    play('zap', S.p);
  }
  // a hit on this headset's ship (a bolt of someone else's, or a drone's): the extra shield first, then the shield, what
  // is left the health; at 0 it explodes
  function hurt(n, by, key) {
    const t = pnow();
    let d = n;
    const a = Math.min(S.extra, d); S.extra -= a; d -= a;
    const b = Math.min(S.shield, d); S.shield -= b; d -= b;
    S.health = Math.max(0, S.health - d);
    S.hitAt = t;
    const hull = d > 0;
    try { const h = S.src && S.src.gamepad && S.src.gamepad.hapticActuators && S.src.gamepad.hapticActuators[0]; if (h && h.pulse) h.pulse(0.4, 60); } catch (e) { /* no buzz */ }
    emit({ k: 'h', w: 'me', b: key, s: Math.round(S.shield), x: Math.round(S.extra), h: Math.round(S.health), by, fx: hull ? 's' : 'r' });
    if (S.health <= 0) {
      S.down = t; S.downR = Math.round(now()); S.killer = by; S.boostT = 0; S.rapidUntil = 0; S.boostUntil = 0; S.extra = 0;
      emit({ k: 'x', w: 'me', by });
      log('ship destroyed', { by });
      say('Destroyed by ' + (by === 'drone' ? 'a drone' : nameOf(by)), 'A new ship in ' + Math.round(T.respawn / 1000) + ' s, at your controller.', 3500);
    }
  }

  // ---------------------------------------------------------------------------------------------- the effects
  // one effect: applied here at once and sent (batched) to the room; another's as it comes (fxIn, by: the relay's word)
  function emit(ev) { handle(ev, me(), true); if (inRoom()) OUT.push(ev); }
  function flush(pt) {
    if (!OUT.length || pt - flushAt < NET.flush) return;
    flushAt = pt;
    const e = OUT.splice(0, 40);
    try { if (L && L.send) L.send({ e }); } catch (er) { /* not sent */ }
  }
  function fxIn(v, by) {
    if (!v || !Array.isArray(v.e) || typeof by !== 'string' || !by || by === me() || offRoom()) return;
    for (const ev of v.e.slice(0, 60)) if (ev && typeof ev === 'object') { try { handle(ev, by, false); } catch (e) { /* a bad one */ } }
  }
  const keyOf = (by, i) => by + ':' + i;
  function handle(ev, by, mine) {
    const tn = now();
    if (ev.k === 'b') {   // a bolt: the same straight line on every device, from its start, direction, speed and time
      if (!fin(ev.o) || ev.o.length !== 3 || !fin(ev.d) || ev.d.length !== 3 || !Number.isFinite(ev.v) || !Number.isFinite(ev.t)) return;
      if (Math.abs(ev.t - tn) > 5000 || Math.abs(ev.v) > 30 || !HOST.session) return;   // (a page draws no bolts)
      const key = keyOf(by, ev.i);
      if (BOLTS.has(key) || BOLTS.size > 400) return;
      const dl = Math.hypot(...ev.d) || 1;
      BOLTS.set(key, { by: ev.dr ? 'drone' : by, dr: typeof ev.dr === 'string' ? ev.dr.slice(0, 16) : '', pilot: by, o: ev.o.slice(), d: ev.d.map(x => x / dl), v: ev.v, t0: ev.t, hit: false });
      if (!mine) play(ev.dr ? 'zapLow' : 'zap', _v.set(ev.o[0], ev.o[1], ev.o[2]), 0.6);
      else if (ev.dr) play('zapLow', _v.set(ev.o[0], ev.o[1], ev.o[2]));
      return;
    }
    if (ev.k === 'h') {   // a hit: the bolt goes everywhere; the ship's (the sender's), a drone's or a target's new bars
      if (typeof ev.b === 'string' && HOST.session) { const B = BOLTS.get(ev.b); if (B) B.hit = true; else BOLTS.set(ev.b, { hit: true, t0: tn, o: [0, 0, 0], d: [0, 0, 1], v: 0 }); }
      const w = typeof ev.w === 'string' ? ev.w : '';
      const ent = w === 'me' ? 'ship:' + by : w.slice(0, 24);
      FLASH.set(ent, { t: pnow(), kind: ev.fx === 's' ? 'spark' : 'ring' });
      if (w === 'me' && by !== me()) {
        const R = RS.get(by);
        if (R && R.last) { if (Number.isFinite(ev.s)) R.last.s = clamp(ev.s, 0, 150); if (Number.isFinite(ev.h)) R.last.h = clamp(ev.h, 0, 100); if (Number.isFinite(ev.x)) R.last.x = clamp(ev.x, 0, 50); R.hitAt = pnow(); }
      }
      if (w !== 'me' && VW && by === LEAD && by !== me()) { const e = entityOf(VW, w); if (e) { if (Number.isFinite(ev.s)) e.s = ev.s; if (Number.isFinite(ev.h)) e.h = ev.h; } }
      const at = posOf(ent);
      if (at) { play(ev.fx === 's' ? 'hullHit' : 'shieldHit', at, mine ? 1 : 0.7); if (ev.fx === 's') sparks(at); }
      return;
    }
    if (ev.k === 'x') {   // destroyed: a burst, a boom, and who did it counted
      const w = typeof ev.w === 'string' ? ev.w : '', shooter = typeof ev.by === 'string' ? ev.by.slice(0, 64) : '';
      const ent = w === 'me' ? 'ship:' + by : w.slice(0, 24), at = posOf(ent);
      if (at) { burst(at, w === 'me' ? colOf(by) : w[0] === 'd' ? '#ff5a3c' : '#7cf2ff'); play('boom', at); }
      if (w === 'me' && by !== me()) { const R = RS.get(by); if (R && R.last) { R.last.h = 0; R.last.dn = Math.round(tn); } }
      if (shooter && shooter !== 'drone') { let K = KILLS.get(shooter); if (!K) KILLS.set(shooter, (K = { ships: 0, bots: 0 })); if (w === 'me') K.ships++; else K.bots++; }
      if (L && L.changed) L.changed();
      return;
    }
    if (ev.k === 'c') {   // a claim on a pickup: the leader gives it to the first claim it receives
      if (!W || LEAD !== me() || typeof ev.i !== 'string') return;
      const P = W.k.find(k => k.id === ev.i);
      if (!P) return;
      W.k = W.k.filter(k => k !== P);
      emit({ k: 'g', i: P.id, to: by, kind: P.kind });
      return;
    }
    if (ev.k === 'g') {   // a pickup given: gone for everyone, its effect on for the one it was given to
      if (typeof ev.i !== 'string') return;
      GONE.set(ev.i, pnow()); PEND.delete(ev.i);
      if (VW && VW !== W) VW.k = VW.k.filter(k => k.id !== ev.i);
      const at = posOfPick(ev.i);
      if (ev.to === me() && S.on) { if (S.down) S.gift = ev.kind; else take(ev.kind); }   // (claimed just before it went down: at the new ship)
      else if (at) play('pickup', at, 0.6);
      return;
    }
  }
  // a pickup's effect: boost (recharging in 1 s and lasting 1.2 s for a while), rapid fire (10 a second for a while), a
  // reinforced shield (+50 on top, used first, never refilled); one of a kind again starts its time again, never piles up
  function take(kind) {
    const tn = now();
    if (kind === 'b') { S.boostUntil = tn + T.boostUp; S.charge = 1; }
    else if (kind === 'r') S.rapidUntil = tn + T.rapid;
    else if (kind === 's') S.extra = HP.extra;
    else return;
    log('ship pickup', { kind });
    play('pickup', S.p);
  }
  // this ship flying through a pickup (as it is drawn here): a claim (the leader decides); hidden for this pilot meanwhile
  function pickTouch(pt, tn) {
    if (!VW) return;
    for (const P of VW.k) {
      if (PEND.has(P.id) || GONE.has(P.id)) continue;
      if (Math.hypot(P.p.x - S.p.x, P.p.y - S.p.y, P.p.z - S.p.z) > HIT.touch) continue;
      PEND.set(P.id, pt);
      emit({ k: 'c', i: P.id, t: Math.round(tn) });
    }
  }

  // ---------------------------------------------------------------------------------------------- others' ships
  // a presence from someone (shared.js's onFx): its ship (sh), or none (landed); kept as samples by its ts
  function presIn(id, sh, ts) {
    if (typeof id !== 'string' || id === me() || offRoom()) return;
    if (!sh || typeof sh !== 'object') { if (RS.has(id)) { RS.delete(id); if (L && L.changed) L.changed(); } return; }
    const v = parseShip(sh);
    if (!v || !Number.isFinite(ts)) return;
    let R = RS.get(id);
    if (!R) RS.set(id, (R = { s: [], at: 0, lt: v.lt, last: null, hitAt: 0 }));
    // (shield, health or down changed: the pages' people lists say so; down at once, the bars at most once a second,
    // since the shield's refill changes them in nearly every presence)
    const pt = pnow(), dn = !R.last || !R.last.dn !== !v.dn, bars = R.last && (R.last.s !== v.s || R.last.x !== v.x || R.last.h !== v.h);
    if (dn || (bars && pt - (R.chAt || 0) > 1000)) { R.chAt = pt; if (L && L.changed) L.changed(); }
    R.at = pnow(); R.lt = v.lt; R.last = v;
    const s = R.s, last = s[s.length - 1];
    if (last && ts <= last.ts) return;
    // (after a pause, or destroyed and a new ship: anew, never gliding from where the old one was)
    if (last && (ts - last.ts > NET.gap || !last.v.dn !== !v.dn)) s.length = 0;
    s.push({ ts, v });
    if (s.length > NET.keep) s.shift();
  }
  function parseShip(sh) {
    if (!fin(sh.p) || sh.p.length !== 3 || !fin(sh.q) || sh.q.length !== 4 || !Number.isFinite(sh.lt)) return null;
    if (sh.p.some(x => Math.abs(x) > 1000)) return null;
    const ql = Math.hypot(...sh.q) || 1;
    const v = { lt: sh.lt, p: sh.p.slice(), q: sh.q.map(x => x / ql), s: clamp(+sh.s || 0, 0, 150), x: clamp(+sh.x || 0, 0, 50), h: clamp(+sh.h || 0, 0, 100),
      b: clamp(+sh.b || 0, 0, 100), v: Number.isFinite(sh.v) ? sh.v : 0, dn: Number.isFinite(sh.dn) ? sh.dn : 0, w: null };
    if (sh.w && typeof sh.w === 'object') v.w = parseSet(sh.w);
    return v;
  }
  function parseSet(w) {
    const pt3 = (a, i) => ({ x: +a[i], y: +a[i + 1], z: +a[i + 2] });
    const ok = (a, n) => Array.isArray(a) && a.length >= n && typeof a[0] === 'string' && a.slice(1).every(x => typeof x === 'string' || Number.isFinite(x));
    const t = (Array.isArray(w.t) ? w.t : []).filter(a => ok(a, 7)).slice(0, BOT.targets).map(a => ({ id: a[0].slice(0, 8), p: pt3(a, 1), h: a[4], a: !!a[5], back: a[6] }));
    const d = (Array.isArray(w.d) ? w.d : []).filter(a => ok(a, 11)).slice(0, BOT.most).map(a => ({ id: a[0].slice(0, 8), p: pt3(a, 1), yaw: a[4], pitch: a[5], s: a[6], h: a[7], a: !!a[8], back: a[9], bank: a[10] }));
    const k = (Array.isArray(w.k) ? w.k : []).filter(a => ok(a, 6) && KIND[a[1]]).slice(0, BOT.picks).map(a => ({ id: a[0].slice(0, 12), kind: a[1], p: pt3(a, 2), until: a[5] }));
    const c = fin(w.c) && w.c.length === 2 ? w.c.slice() : [0, 0];
    return { c, n: Number.isFinite(w.n) ? w.n : 0, t, d, k };
  }
  function expireRemote(pt) {
    let n = 0;
    for (const [id, R] of RS) if (pt - R.at > T.quiet) { RS.delete(id); n++; }
    if (n && L && L.changed) L.changed();   // (a pilot gone quiet: the people lists say so)
  }
  // a page has no frames: its others' ships go quiet by a timer (a headset's in its frames)
  setInterval(() => { if (!HOST.session && RS.size) try { expireRemote(pnow()); } catch (e) { /* never in the way */ } }, 1000);
  // where another ship is drawn now: NET.delay behind the relay's time, between its samples (places in a line, turns by
  // slerp), carried on at most NET.carry past the last
  const _qa = new Q4(), _qb = new Q4();
  function shipAt(R, rt, out) {
    const s = R.s, n = s.length;
    if (!n) return false;
    let a = s[0], b = s[0], f = 0;
    if (rt >= s[n - 1].ts) { b = s[n - 1]; a = n > 1 ? s[n - 2] : b; f = a === b ? 1 : 1 + Math.min(rt - b.ts, NET.carry) / Math.max(1, b.ts - a.ts); }
    else if (rt <= s[0].ts) { a = b = s[0]; f = 1; }
    else { let i = n - 1; while (i > 0 && s[i - 1].ts > rt) i--; a = s[i - 1]; b = s[i]; f = (rt - a.ts) / Math.max(1, b.ts - a.ts); }
    out.p.set(a.v.p[0] + (b.v.p[0] - a.v.p[0]) * f, a.v.p[1] + (b.v.p[1] - a.v.p[1]) * f, a.v.p[2] + (b.v.p[2] - a.v.p[2]) * f);
    _qa.fromArray(a.v.q); _qb.fromArray(b.v.q);
    out.q.copy(_qa).slerp(_qb, clamp(f, 0, 1));
    return true;
  }
  // the set as the leader's samples give it now (its drones and targets between two samples, by id; the pickups the latest)
  function setAt(R, rt) {
    const s = R.s.filter(x => x.v.w), n = s.length;
    if (!n) return null;
    let a = s[n - 1], b = a, f = 1;
    if (rt < s[n - 1].ts && n > 1) { let i = n - 1; while (i > 1 && s[i - 1].ts > rt) i--; a = s[i - 1]; b = s[i]; f = clamp((rt - a.ts) / Math.max(1, b.ts - a.ts), 0, 1); }
    const A = a.v.w, B = b.v.w, lerpE = (ea, eb, keys) => {
      const o = Object.assign({}, eb, { p: { x: ea.p.x + (eb.p.x - ea.p.x) * f, y: ea.p.y + (eb.p.y - ea.p.y) * f, z: ea.p.z + (eb.p.z - ea.p.z) * f } });
      for (const k of keys) o[k] = ea[k] + wrapA(eb[k] - ea[k]) * f;
      return o;
    };
    const pick = (la, lb, keys) => lb.map(eb => { const ea = la.find(x => x.id === eb.id); return ea && ea.a === eb.a ? lerpE(ea, eb, keys) : eb; });
    return { c: B.c, n: B.n, t: pick(A.t, B.t, []), d: pick(A.d, B.d, ['yaw', 'pitch', 'bank']), k: B.k.filter(k => !GONE.has(k.id)) };
  }

  // ---------------------------------------------------------------------------------------------- the leader and its set
  // the pilots flying (this headset and the others heard in the last T.quiet), by their launch time: the first leads,
  // ties by member id, the same on every device
  const PILOTS = [], PPOOL = [];   // (reused each frame: no garbage)
  function addPilot(id, lt) { const o = PPOOL[PILOTS.length] || (PPOOL[PILOTS.length] = { id: '', lt: 0 }); o.id = id; o.lt = lt; PILOTS.push(o); }
  function pilots() {
    const out = PILOTS;
    out.length = 0;
    if (S.on) addPilot(me(), S.lt);
    for (const [id, R] of RS) if (R.last && Number.isFinite(R.lt)) addPilot(id, R.lt);
    out.sort((a, b) => a.lt - b.lt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }
  function leadStep(dt, tn) {
    const P = pilots(), lead = P.length ? P[0].id : '';
    if (lead !== LEAD) {
      log('ship leader', { from: LEAD, to: lead, pilots: P.length });
      if (lead === me()) W = takeOver(VW);   // (from what it has been drawing: nothing jumps, nothing is born again)
      else W = null;
      LEAD = lead;
    }
    if (!lead) { W = null; VW = null; return; }
    if (lead === me()) { if (!W) W = takeOver(null); setStep(dt, tn, P.length); VW = W; return; }
    const R = RS.get(lead), rt = rtNow();
    const v = R ? setAt(R, rt) : null;
    if (v) VW = v;
  }
  const rtNow = () => (!TC.on && L && L.rt ? L.rt() : now() - NET.delay);
  // a set to lead: a copy of what was drawn here (positions, headings, shield and health, the pickups and their times),
  // or a new one round this pilot's arena
  function takeOver(v) {
    const p = e => new V3(e.p.x, e.p.y, e.p.z);
    if (v && (v.t.length || v.d.length || v.k.length)) {
      return { c: v.c.slice(), n: v.n || now() + rnd(T.pickMin, T.pickMax), seq: 0,
        t: v.t.map(e => ({ id: e.id, p: p(e), v: drift(), h: e.h, a: e.a, back: e.back })),
        d: v.d.map(e => ({ id: e.id, p: p(e), yaw: e.yaw, pitch: e.pitch, bank: e.bank || 0, s: e.s, h: e.h, a: e.a, back: e.back, hitAt: -1e9, fireAt: now() + T.droneFire, whim: 0, wy: e.yaw, wh: e.p.y, chase: 0 })),
        k: v.k.map(e => ({ id: e.id, kind: e.kind, p: p(e), until: e.until })) };
    }
    const c = S.on ? S.c.slice() : [0, 0], W2 = { c, n: now() + rnd(T.pickMin, T.pickMax), seq: 0, t: [], d: [], k: [] };
    for (let i = 0; i < BOT.targets; i++) W2.t.push({ id: 't' + (i + 1), p: freeSpot(W2, 1.2), v: drift(), h: HP.thealth, a: true, back: 0 });
    for (let i = 0; i < BOT.drones; i++) W2.d.push(newDrone(W2, 'd' + (i + 1)));
    return W2;
  }
  const drift = () => { const a = rnd(0, 2 * Math.PI); return new V3(Math.cos(a) * 0.12, rnd(-0.03, 0.03), Math.sin(a) * 0.12); };
  function freeSpot(w, inset) {
    const a = rnd(0, 2 * Math.PI), r = Math.sqrt(Math.random()) * (ARENA.r - (inset || 1));
    return new V3(w.c[0] + Math.cos(a) * r, rnd(0.6, 2.0), w.c[1] + Math.sin(a) * r);
  }
  function edgeSpot(w) {
    const a = rnd(0, 2 * Math.PI), r = ARENA.r - 0.4;
    return new V3(w.c[0] + Math.cos(a) * r, rnd(0.8, 2.0), w.c[1] + Math.sin(a) * r);
  }
  function newDrone(w, id) {
    const p = edgeSpot(w), yaw = Math.atan2(p.x - w.c[0], p.z - w.c[1]);   // (facing the middle)
    return { id, p, yaw, pitch: 0, bank: 0, s: HP.dshield, h: HP.dhealth, a: true, back: 0, hitAt: -1e9, fireAt: now() + T.droneFire, whim: 0, wy: yaw, wh: p.y, chase: 0 };
  }
  // the ships the drones see: this one exact, the others where they are drawn
  const SEEN = [];
  function shipsSeen() {
    SEEN.length = 0;
    if (S.on && !S.down) SEEN.push(S.p);
    for (const [, R] of RS) if (R.draw && R.last && !R.last.dn) SEEN.push(R.draw.p);
    return SEEN;
  }
  function setStep(dt, tn, n) {
    const w = W, pt = pnow();
    // drones: two for one pilot, one more for each further pilot, at most five (the latest ones go when fewer fly)
    const want = Math.min(BOT.most, BOT.drones + Math.max(0, n - 1));
    for (let i = w.d.length; i < want; i++) { let k = i + 1; while (w.d.some(d => d.id === 'd' + k)) k++; w.d.push(newDrone(w, 'd' + k)); }
    if (w.d.length > want) w.d.length = want;
    const ships = shipsSeen();
    for (const e of w.t) {   // the targets drift slowly, turning back at the arena's edge
      if (!e.a) { if (tn >= e.back) { e.a = true; e.h = HP.thealth; e.p.copy(edgeSpot(w)); } continue; }
      if (FREEZE.on) continue;
      e.p.addScaledVector(e.v, dt);
      const rx = e.p.x - w.c[0], rz = e.p.z - w.c[1], rr = Math.hypot(rx, rz);
      if (rr > ARENA.r - 0.6 && rx * e.v.x + rz * e.v.z > 0) { e.v.x = -e.v.x; e.v.z = -e.v.z; }
      if (e.p.y < 0.5 || e.p.y > 2.4) e.v.y = -e.v.y;
      e.p.y = clamp(e.p.y, 0.5, 2.4);
    }
    for (const e of w.d) {
      if (!e.a) { if (tn >= e.back) Object.assign(e, newDrone(w, e.id)); continue; }
      if (FREEZE.on) continue;   // (tests: still, holding fire, their shields as they are)
      if (pt - e.hitAt >= T.regen && e.s < HP.dshield) e.s = Math.min(HP.dshield, e.s + HP.refill * dt);
      // wandering: a new heading now and then; now and then towards the nearest pilot's ship; back from the edge
      let near = null, nd = Infinity;
      for (const p of ships) { const d = e.p.distanceTo(p); if (d < nd) { nd = d; near = p; } }
      if (tn >= e.whim) {
        e.whim = tn + rnd(2000, 5000);
        e.chase = near && Math.random() < 0.45 ? tn + 3000 : 0;
        e.wy = rnd(-Math.PI, Math.PI); e.wh = rnd(0.7, 2.2);
      }
      if (e.chase > tn && near) { e.wy = Math.atan2(-(near.x - e.p.x), -(near.z - e.p.z)); e.wh = clamp(near.y, 0.5, 2.6); }
      const rx = e.p.x - w.c[0], rz = e.p.z - w.c[1];
      if (Math.hypot(rx, rz) > ARENA.r - 0.8) e.wy = Math.atan2(rx, rz);
      const dy = wrapA(e.wy - e.yaw), tr = BOT.turn * DEG * dt;
      e.yaw = wrapA(e.yaw + clamp(dy, -tr, tr));
      e.bank += (clamp(-dy, -0.6, 0.6) - e.bank) * (1 - Math.exp(-dt / 0.3));
      e.pitch += (clamp((e.wh - e.p.y) * 0.8, -0.5, 0.5) - e.pitch) * (1 - Math.exp(-dt / 0.4));
      dirOf(e.yaw, e.pitch, _d);
      e.p.addScaledVector(_d, BOT.speed * dt);
      e.p.y = clamp(e.p.y, ARENA.lo + 0.2, ARENA.hi - 0.2);
      // a bolt every droneFire while a ship is within range and in front of it within aim degrees
      if (tn >= e.fireAt && near && nd < BOT.range) {
        _v2.copy(near).sub(e.p).normalize();
        if (_v2.dot(_d) > Math.cos(BOT.aim * DEG)) {
          e.fireAt = tn + T.droneFire;
          const o = _v.copy(e.p).addScaledVector(_d, 0.09);
          emit({ k: 'b', i: ++S.n, dr: e.id, o: [r3(o.x), r3(o.y), r3(o.z)], d: [r4(_d.x), r4(_d.y), r4(_d.z)], v: GUN.dv, t: Math.round(tn) });
        }
      }
    }
    // pickups: one every pickMin to pickMax at a free spot, at most two at once, each there for pickLife
    w.k = w.k.filter(k => k.until > tn);
    if (tn >= w.n) {
      w.n = tn + rnd(T.pickMin, T.pickMax);
      if (w.k.length < BOT.picks) {
        const kinds = Object.keys(KIND);
        w.k.push({ id: 'k' + Math.round(tn).toString(36) + (++w.seq), kind: kinds[Math.floor(Math.random() * kinds.length)], p: freeSpot(w, 1), until: tn + T.pickLife });
      }
    }
  }
  const entityOf = (w, key) => { const [k, id] = String(key).split(':'); return (k === 'd' ? w.d : k === 't' ? w.t : []).find(e => e.id === id) || null; };
  // where an entity ('ship:<id>', 'd:<id>', 't:<id>') is drawn now, in the game's frame
  function posOf(ent) {
    if (ent === 'ship:' + me()) return S.on ? S.p : null;
    if (ent.startsWith('ship:')) { const R = RS.get(ent.slice(5)); return R && R.draw ? R.draw.p : R && R.last ? _v2.fromArray(R.last.p) : null; }
    if (!VW) return null;
    const e = entityOf(VW, ent);
    return e ? _v2.set(e.p.x, e.p.y, e.p.z) : null;
  }
  function posOfPick(id) { if (!VW) return null; const k = VW.k.find(x => x.id === id); return k ? _v2.set(k.p.x, k.p.y, k.p.z) : null; }

  // ---------------------------------------------------------------------------------------------- the bolts
  // every live bolt swept between last frame's and this frame's places (the relay's times) against this headset's own
  // ship (exact; a sphere of HIT.ship), and while it leads against the targets and drones as it moves them. A ship's own
  // bolts never hit it; a drone's hit ships only
  const _a = new V3(), _b = new V3();
  function segHit(a, b, c, r) {
    _v.copy(b).sub(a);
    const l2 = _v.lengthSq();
    let t = l2 > 1e-12 ? _v2.copy(c).sub(a).dot(_v) / l2 : 0;
    t = clamp(t, 0, 1);
    return _v2.copy(a).addScaledVector(_v, t).distanceToSquared(c) <= r * r;
  }
  // a bolt against this ship's places from t0 to t1 (HIST): in each stretch between two of them, the bolt relative to the
  // ship moves in a line, so the nearest it came is that line's to the ship's middle
  const _ra = new V3(), _rb = new V3(), _o0 = new V3();
  function sweepPast(B, ta, tb) {
    const ts = [ta];
    for (const h of HIST) if (h[0] > ta && h[0] < tb) ts.push(h[0]);
    ts.push(tb);
    for (let i = 1; i < ts.length; i++) {
      boltAt(B, ts[i - 1], _ra).sub(histAt(ts[i - 1], _v)); boltAt(B, ts[i], _rb).sub(histAt(ts[i], _v));
      if (segHit(_ra, _rb, _o0.set(0, 0, 0), HIT.ship)) return true;
    }
    return false;
  }
  function histAt(t, out) {
    const n = HIST.length;
    if (!n || t >= HIST[n - 1][0]) return out.copy(S.p);
    if (t <= HIST[0][0]) return out.set(HIST[0][1], HIST[0][2], HIST[0][3]);
    let i = n - 1;
    while (i > 0 && HIST[i - 1][0] > t) i--;
    const a = HIST[i - 1], b = HIST[i], f = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
    return out.set(a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f);
  }
  const boltAt = (B, t, out) => { const k = B.v * (t - B.t0) / 1000; return out.set(B.o[0] + B.d[0] * k, B.o[1] + B.d[1] * k, B.o[2] + B.d[2] * k); };
  function boltStep(tp, tn) {
    const life = GUN.life * 1000, lead = W && LEAD === me();
    for (const [key, B] of BOLTS) {
      if (tn - B.t0 > life + 1500) { BOLTS.delete(key); continue; }
      if (B.hit) continue;
      // (one heard late from another device, even after its life, is swept once over its whole way so far: against where
      // this ship was meanwhile, and a drone or a target, which move slowly, where it is now)
      const first = !B.seen;
      B.seen = true;
      const t0 = first ? B.t0 : Math.max(B.t0, tp), t1 = Math.min(B.t0 + life, tn);
      if (t1 < t0 || tn < B.t0) continue;
      boltAt(B, t0, _a); boltAt(B, t1, _b);
      // (a drone's bolt hits any ship, the leader's too; a pilot's every ship but its own)
      if (S.on && !S.down && (B.by === 'drone' || B.pilot !== me()) && (first && t0 < tp - 1 ? sweepPast(B, t0, t1) : segHit(_a, _b, S.p, HIT.ship))) {
        B.hit = true; hurt(B.by === 'drone' ? GUN.ddmg : GUN.dmg, B.by === 'drone' ? 'drone' : B.by, key); continue;
      }
      if (!lead || B.by === 'drone') continue;
      for (const e of W.d) if (e.a && segHit(_a, _b, e.p, HIT.drone)) { B.hit = true; botHit(e, 'd', key, B.by); break; }
      if (B.hit) continue;
      for (const e of W.t) if (e.a && segHit(_a, _b, e.p, HIT.target)) { B.hit = true; botHit(e, 't', key, B.by); break; }
    }
  }
  // the leader decides a hit on a drone (its shield first) or a target (health alone), and its destruction (credited to
  // the pilot whose bolt did it)
  function botHit(e, k, key, by) {
    let d = GUN.dmg, hull = true;
    if (k === 'd') { const a = Math.min(e.s, d); e.s -= a; d -= a; hull = d > 0; e.hitAt = pnow(); }
    e.h = Math.max(0, e.h - d);
    emit({ k: 'h', w: k + ':' + e.id, b: key, s: k === 'd' ? Math.round(e.s) : 0, h: Math.round(e.h), by, fx: hull ? 's' : 'r' });
    if (e.h <= 0) {
      emit({ k: 'x', w: k + ':' + e.id, by });
      e.a = false; e.back = now() + T.back;
      if (k === 'd') { e.s = HP.dshield; }
    }
  }

  // ---------------------------------------------------------------------------------------------- particles
  const PART = { n: 0, p: new Float32Array(MAXP * 3), v: new Float32Array(MAXP * 3), c: new Float32Array(MAXP * 3), age: new Float32Array(MAXP), life: new Float32Array(MAXP), size: new Float32Array(MAXP) };
  function emitParts(at, n, speed, life, col, size) {
    const c = new THREE.Color(col);
    for (let i = 0; i < n && PART.n < MAXP; i++) {
      const j = PART.n++, a = rnd(0, 2 * Math.PI), z = rnd(-1, 1), s = Math.sqrt(1 - z * z), v = speed * rnd(0.4, 1);
      PART.p.set([at.x, at.y, at.z], j * 3); PART.v.set([Math.cos(a) * s * v, z * v, Math.sin(a) * s * v], j * 3);
      PART.c.set([c.r, c.g, c.b], j * 3); PART.age[j] = 0; PART.life[j] = life * rnd(0.6, 1); PART.size[j] = size;
    }
  }
  const burst = (at, col) => { emitParts(at, 36, 1.1, 0.8, col, 0.03); emitParts(at, 14, 0.5, 0.6, '#fff2c0', 0.04); };
  const sparks = at => emitParts(at, 10, 0.9, 0.3, '#ffe9a0', 0.018);
  function partStep(dt) {
    let k = 0;
    for (let i = 0; i < PART.n; i++) {
      PART.age[i] += dt;
      if (PART.age[i] >= PART.life[i]) continue;
      if (k !== i) {
        PART.p.copyWithin(k * 3, i * 3, i * 3 + 3); PART.v.copyWithin(k * 3, i * 3, i * 3 + 3); PART.c.copyWithin(k * 3, i * 3, i * 3 + 3);
        PART.age[k] = PART.age[i]; PART.life[k] = PART.life[i]; PART.size[k] = PART.size[i];
      }
      for (let a = 0; a < 3; a++) { PART.p[k * 3 + a] += PART.v[k * 3 + a] * dt; PART.v[k * 3 + a] *= Math.exp(-dt * 2.2); }
      k++;
    }
    PART.n = k;
    const g = G.burst.geometry, P = g.attributes.position.array, C = g.attributes.aColor.array, Z = g.attributes.aSize.array;
    for (let i = 0; i < k; i++) {
      const f = 1 - PART.age[i] / PART.life[i];
      for (let a = 0; a < 3; a++) { P[i * 3 + a] = PART.p[i * 3 + a]; C[i * 3 + a] = PART.c[i * 3 + a] * f; }
      Z[i] = PART.size[i] * (0.6 + 0.4 * f);
    }
    g.setDrawRange(0, k);
    g.attributes.position.needsUpdate = g.attributes.aColor.needsUpdate = g.attributes.aSize.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------------------------- drawing
  const _c = new THREE.Color(), _s = new V3(), _bq = new Q4(), _Z = new V3(0, 0, 1);
  const DRAW = { list: [] };
  const GL = { n: 0 };
  function glowAt(p, col, size) {
    if (GL.n >= MAXG) return;
    const g = G.glow.geometry, i = GL.n++;
    g.attributes.position.array.set([p.x, p.y, p.z], i * 3);
    _c.set(col); g.attributes.aColor.array.set([_c.r, _c.g, _c.b], i * 3);
    g.attributes.aSize.array[i] = size;
  }
  // the bars over an entity (shield and health; a target health alone), turned to you, and its pilot's name over a ship
  const BAR = { w: 0.12, h: 0.008, gap: 0.004, up: 0.11, nb: 0, nf: 0 };
  const _bp = new V3();
  function bars(p0, sh, shMax, ex, he, heMax) {
    if (!HEAD.ok) return;
    const p = _bp.copy(p0);
    _v.set(1, 0, 0).applyQuaternion(HEAD.gq);   // (right, as seen from your head)
    _bq.copy(HEAD.gq);
    const rows = sh === null ? [[he / heMax, he > 30 ? '#57d68d' : '#ff5c5c']] : [[sh / shMax, '#4fb3ff', ex / HP.extra], [he / heMax, he > 30 ? '#57d68d' : '#ff5c5c']];
    rows.forEach(([f, col, xf], i) => {
      const y = BAR.up + i * (BAR.h + BAR.gap);
      if (BAR.nb < 64) {
        _p.copy(p); _p.y += y;
        _m.compose(_p, _bq, _s.set(BAR.w + 0.004, BAR.h + 0.003, 1)); G.barBg.setMatrixAt(BAR.nb++, _m);
      }
      const ff = clamp(f, 0, 1);
      if (ff > 0.001 && BAR.nf < 96) {
        _p.copy(p); _p.y += y; _p.addScaledVector(_v, -(1 - ff) * BAR.w / 2);
        _p.addScaledVector(_d.set(0, 0, 1).applyQuaternion(_bq), 0.0008);
        _m.compose(_p, _bq, _s.set(BAR.w * ff, BAR.h, 1)); G.barFill.setMatrixAt(BAR.nf, _m); G.barFill.setColorAt(BAR.nf++, _c.set(col));
      }
      if (xf > 0.001 && BAR.nf < 96) {   // (a reinforced shield: a lighter strip over the shield's)
        _p.copy(p); _p.y += y + BAR.h * 0.25; _p.addScaledVector(_v, -(1 - xf) * BAR.w / 2);
        _p.addScaledVector(_d.set(0, 0, 1).applyQuaternion(_bq), 0.0016);
        _m.compose(_p, _bq, _s.set(BAR.w * xf, BAR.h * 0.5, 1)); G.barFill.setMatrixAt(BAR.nf, _m); G.barFill.setColorAt(BAR.nf++, _c.set('#bfe8ff'));
      }
    });
  }
  function tagFor(id) {
    let T2 = G.tags.get(id);
    if (T2) return T2;
    const q = HOST.quiet;
    HOST.quiet = true;
    try {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48;
      const tex = new THREE.CanvasTexture(cv), mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.019), new THREE.MeshBasicMaterial({ map: tex }));
      G.root.add(mesh);
      T2 = { cv, tex, mesh, sig: '' };
      G.tags.set(id, T2);
      return T2;
    } finally { HOST.quiet = q; }
  }
  function tagDraw(T2, name, col) {
    const sig = name + '|' + col;
    if (T2.sig === sig) return;
    T2.sig = sig;
    const c = T2.cv.getContext('2d');
    c.fillStyle = '#0c121c'; c.fillRect(0, 0, 256, 48);
    c.fillStyle = col; c.fillRect(0, 0, 8, 48);
    c.font = '700 28px B612, system-ui, sans-serif'; c.fillStyle = '#eef4fb'; c.textBaseline = 'middle';
    let s = name; while (s.length > 1 && c.measureText(s).width > 230) s = s.slice(0, -1);
    c.fillText(s === name ? s : s + '…', 18, 25);
    T2.tex.needsUpdate = true;
  }
  const RD = { p: new V3(), q: new Q4() }, TAGS_ON = new Set();   // (reused each frame: no garbage)
  function draw(dt, pt, tn) {
    const sc = storyScene();
    if (!sc) { detach(); return; }
    const any = S.on || RS.size || (VW && (VW.d.length || VW.t.length)) || BOLTS.size || PART.n;
    if (!any && !G.made) return;
    make();
    if (G.root.parent !== sc) sc.add(G.root);
    if (G.hud.parent !== sc) sc.add(G.hud);
    G.root.matrix.copy(F.m); G.root.matrixWorldNeedsUpdate = true;
    // (a pixel size for the glows: the headset's eye buffer height)
    try { const bl = HOST.session && HOST.session.renderState && HOST.session.renderState.baseLayer; G.px.value = (bl && bl.framebufferHeight ? bl.framebufferHeight : HOST.renderer.domElement.height) * 0.5; } catch (e) { /* keep */ }
    const rt = rtNow();
    DRAW.rt = rt;
    GL.n = 0; BAR.nb = 0; BAR.nf = 0;
    let ns = 0;
    // the ships: this one exact, the others NET.delay behind between their samples
    if (S.on && !S.down) {
      _m.compose(S.p, S.q, _s.set(1, 1, 1)); G.ships.setMatrixAt(ns, _m); G.ships.setColorAt(ns++, _c.set(colOf(me())));
      _p.set(0, 0, 0.095).applyQuaternion(S.q).add(S.p); glowAt(_p, S.boostT > 0 ? '#ffd27a' : '#7fdcff', S.boostT > 0 ? 0.06 : 0.035);
      bars(S.p, S.shield, HP.shield, S.extra, S.health, HP.health);
    }
    const tagsOn = TAGS_ON; tagsOn.clear();
    for (const [id, R] of RS) {
      if (!R.last || R.last.dn) { R.draw = null; continue; }
      if (!R.draw) R.draw = { p: new V3(), q: new Q4() };
      if (!shipAt(R, rt, R.draw) || ns >= MAXS) continue;
      _m.compose(R.draw.p, R.draw.q, _s.set(1, 1, 1)); G.ships.setMatrixAt(ns, _m); G.ships.setColorAt(ns++, _c.set(colOf(id)));
      _p.set(0, 0, 0.095).applyQuaternion(R.draw.q).add(R.draw.p); glowAt(_p, R.last.v > 2 ? '#ffd27a' : '#7fdcff', R.last.v > 2 ? 0.06 : 0.035);
      bars(R.draw.p, R.last.s, HP.shield, R.last.x, R.last.h, HP.health);
      const T2 = tagFor(id);
      tagDraw(T2, nameOf(id), colOf(id));
      T2.mesh.position.copy(R.draw.p); T2.mesh.position.y += BAR.up + 2 * (BAR.h + BAR.gap) + 0.013;
      if (HEAD.ok) T2.mesh.quaternion.copy(HEAD.gq);
      T2.mesh.visible = true; tagsOn.add(id);
    }
    for (const [id, T2] of G.tags) if (!tagsOn.has(id)) { T2.mesh.visible = false; if (!RS.has(id)) { T2.mesh.parent && T2.mesh.parent.remove(T2.mesh); T2.mesh.geometry.dispose(); T2.mesh.material.dispose(); T2.tex.dispose(); G.tags.delete(id); } }
    G.ships.count = ns; G.ships.instanceMatrix.needsUpdate = true; if (G.ships.instanceColor) G.ships.instanceColor.needsUpdate = true;
    // the shared set: drones, targets, pickups
    let nd = 0, nt = 0;
    const pc = { b: 0, r: 0, s: 0 };
    if (VW) {
      for (const e of VW.d) {
        if (!e.a || nd >= BOT.most) continue;
        _p.set(e.p.x, e.p.y, e.p.z); qOf(e.yaw, e.pitch, e.bank || 0, _q);
        _m.compose(_p, _q, _s.set(1, 1, 1)); G.drones.setMatrixAt(nd++, _m);
        _v.set(0, 0.004, -0.08).applyQuaternion(_q).add(_p); glowAt(_v, '#ff2a2a', 0.04);
        bars(_p, e.s, HP.dshield, 0, e.h, HP.dhealth);
      }
      for (const e of VW.t) {
        if (!e.a || nt >= BOT.targets) continue;
        _p.set(e.p.x, e.p.y, e.p.z); _q.setFromAxisAngle(_Z.set(0, 1, 0), (pt / 1000) * 0.8 + nt * 2);
        _m.compose(_p, _q, _s.set(1, 1, 1)); G.targets.setMatrixAt(nt++, _m);
        glowAt(_p, '#5fe8ff', 0.09);
        bars(_p, null, 0, 0, e.h, HP.thealth);
      }
      for (const k of VW.k) {
        if (PEND.has(k.id) || GONE.has(k.id) || pc[k.kind] >= BOT.picks) continue;
        const left = (k.until - tn) / 1000, f = left < 2 ? clamp(left / 2, 0.05, 1) : 1;   // (fading out over its last 2 s)
        _p.set(k.p.x, k.p.y + Math.sin(pt / 600) * 0.02, k.p.z); _q.setFromAxisAngle(_Z.set(0, 1, 0), pt / 700);
        _m.compose(_p, _q, _s.set(f, f, f)); G.picks[k.kind].setMatrixAt(pc[k.kind]++, _m);
        glowAt(_p, KIND[k.kind].col, 0.08 * f);
      }
    }
    for (const [k, X] of [['d', G.drones], ['t', G.targets]]) { X.count = k === 'd' ? nd : nt; X.instanceMatrix.needsUpdate = true; }
    for (const k of Object.keys(G.picks)) { G.picks[k].count = pc[k]; G.picks[k].instanceMatrix.needsUpdate = true; }
    // the bolts: where they are at the relay's time now, along their line
    let nb = 0;
    const life = GUN.life * 1000;
    for (const [, B] of BOLTS) {
      if (B.hit || tn < B.t0 || tn - B.t0 > life || nb >= MAXB) continue;
      boltAt(B, tn, _p);
      _q.setFromUnitVectors(_Z.set(0, 0, 1), _d.set(B.d[0], B.d[1], B.d[2]));
      _m.compose(_p, _q, _s.set(1, 1, 1)); G.bolts.setMatrixAt(nb, _m);
      _c.set(B.by === 'drone' ? '#ff3b3b' : colOf(B.pilot)).lerp(_c2.set('#ffffff'), 0.35);
      G.bolts.setColorAt(nb++, _c);
    }
    G.bolts.count = nb; G.bolts.instanceMatrix.needsUpdate = true; if (G.bolts.instanceColor) G.bolts.instanceColor.needsUpdate = true;
    // a hit on a shield: a ring round it, fading over 0.35 s
    let nr = 0;
    for (const [ent, Fl] of FLASH) {
      const a = (pt - Fl.t) / 350;
      if (a >= 1) { FLASH.delete(ent); continue; }
      if (Fl.kind !== 'ring' || nr >= 24) continue;
      const at = posOf(ent);
      if (!at) continue;
      _m.compose(at, HEAD.ok ? HEAD.gq : _bq.identity(), _s.setScalar((1 + a * 0.4) * (1 - a * 0.3))); G.rings.setMatrixAt(nr++, _m);
    }
    G.rings.count = nr; G.rings.instanceMatrix.needsUpdate = true;
    G.barBg.count = BAR.nb; G.barBg.instanceMatrix.needsUpdate = true;
    G.barFill.count = BAR.nf; G.barFill.instanceMatrix.needsUpdate = true; if (G.barFill.instanceColor) G.barFill.instanceColor.needsUpdate = true;
    const gg = G.glow.geometry;
    gg.setDrawRange(0, GL.n); gg.attributes.position.needsUpdate = gg.attributes.aColor.needsUpdate = gg.attributes.aSize.needsUpdate = true;
    partStep(dt);
    hudStep(pt, tn);
  }
  const _c2 = new THREE.Color();
  // the pilot's strip above the right controller (shield, health, the boost meter, kills, what is on and its time left;
  // the countdown while it is down), and an arrow at the edge of the view to the ship when it is out of view
  function hudStep(pt, tn) {
    const show = S.on && HEAD.ok;
    G.hudMesh.visible = show && CTRL.ok; G.arrow.visible = false;
    if (!show) return;
    if (CTRL.ok) {
      G.hudMesh.position.copy(CTRL.p); G.hudMesh.position.y += 0.085;
      G.hudMesh.quaternion.copy(HEAD.q);
      hudDraw(tn, pt);
    }
    if (S.down) return;
    toRef(S.p, _p);
    _v.copy(_p).sub(HEAD.p).applyQuaternion(_hq.copy(HEAD.q).invert());   // (the ship from your head, in its frame)
    const ang = Math.acos(clamp(-_v.z / (_v.length() || 1), -1, 1));
    if (ang < 34 * DEG) return;
    let dx = _v.x, dy = _v.y;
    const dl = Math.hypot(dx, dy);
    if (dl < 1e-4) { dx = 1; dy = 0; } else { dx /= dl; dy /= dl; }
    _v2.set(dx * 0.2, dy * 0.13, -0.7);
    G.arrow.position.copy(_v2).applyQuaternion(HEAD.q).add(HEAD.p);
    _cq.setFromUnitVectors(_Z.set(0, 0, -1), _d.set(dx, dy, 0));
    G.arrow.quaternion.copy(HEAD.q).multiply(_cq);
    G.arrow.material.color.set(colOf(me()));
    G.arrow.visible = true;
  }
  function hudDraw(tn, pt) {
    const K = KILLS.get(me()) || { ships: 0, bots: 0 }, cd = S.down ? Math.max(0, Math.ceil((T.respawn - (pt - S.down)) / 1000)) : 0;
    const on = [];
    if (S.boostUntil > tn) on.push(['Boost', Math.ceil((S.boostUntil - tn) / 1000) + ' s', KIND.b.col]);
    if (S.rapidUntil > tn) on.push(['Rapid', Math.ceil((S.rapidUntil - tn) / 1000) + ' s', KIND.r.col]);
    if (S.extra > 0) on.push(['Shield', '+' + Math.round(S.extra), KIND.s.col]);
    const sig = [Math.round(S.shield), Math.round(S.extra), Math.round(S.health), Math.round(S.charge * 20), S.boostT > 0, K.ships, K.bots, cd, S.killer, on.map(o => o[0] + o[1]).join()].join('|');
    if (sig === G.hudSig) return;
    G.hudSig = sig;
    const c = G.hudCv.getContext('2d'), Wd = 384, H = 136;
    c.fillStyle = '#0a1018'; c.fillRect(0, 0, Wd, H);
    c.fillStyle = colOf(me()); c.fillRect(0, 0, 6, H);
    c.font = '700 22px B612, system-ui, sans-serif'; c.textBaseline = 'middle';
    if (S.down) {
      c.fillStyle = '#ff8a7a'; c.fillText('Destroyed by ' + (S.killer === 'drone' ? 'a drone' : nameOf(S.killer)), 18, 40);
      c.fillStyle = '#eef4fb'; c.font = '700 30px B612, system-ui, sans-serif'; c.fillText('New ship in ' + cd + ' s', 18, 90);
      G.hudTex.needsUpdate = true;
      return;
    }
    const bar = (y, label, f, col, xf) => {
      c.fillStyle = '#9fb0c4'; c.font = '700 18px B612, system-ui, sans-serif'; c.fillText(label, 18, y + 7);
      c.fillStyle = '#1b2533'; c.fillRect(100, y, 190, 14);
      c.fillStyle = col; c.fillRect(100, y, 190 * clamp(f, 0, 1), 14);
      if (xf) { c.fillStyle = '#bfe8ff'; c.fillRect(100, y + 3, 190 * clamp(xf, 0, 1), 8); }
    };
    bar(12, 'SHIELD', S.shield / HP.shield, '#4fb3ff', S.extra / HP.extra);
    bar(36, 'HULL', S.health / HP.health, S.health > 30 ? '#57d68d' : '#ff5c5c');
    bar(60, 'BOOST', S.boostT > 0 ? 1 : S.charge, S.charge >= 1 || S.boostT > 0 ? '#ffb43c' : '#7a6230');
    c.fillStyle = '#eef4fb'; c.font = '700 18px B612, system-ui, sans-serif'; c.textAlign = 'right';
    c.fillText('Ships ' + K.ships, Wd - 12, 19); c.fillText('Drones ' + K.bots, Wd - 12, 43);
    c.textAlign = 'left';
    let x = 18;
    for (const [n, v, col] of on) { c.fillStyle = col; c.font = '700 20px B612, system-ui, sans-serif'; const s = n + ' ' + v; c.fillText(s, x, 108); x += c.measureText(s).width + 18; }
    G.hudTex.needsUpdate = true;
  }
  function play(name, gp, gain) {
    if (!HOST.sfx || !HOST.sfx.play || !immersive()) return;   // (pages draw nothing and play nothing of it)
    try { toRef(gp, _hp); HOST.sfx.play(name, Object.assign({ at: [_hp.x, _hp.y, _hp.z] }, gain && gain !== 1 ? { gain } : {})); } catch (e) { /* no sound */ }
  }

  // ---------------------------------------------------------------------------------------------- the shell's side
  // what goes in this headset's presence (shared.js's presenceOut, 15 a second): its ship, and while it leads the set
  function out() {
    if (!S.on || !inRoom()) return null;
    const o = { lt: S.lt, p: [r3(S.p.x), r3(S.p.y), r3(S.p.z)], q: [r4(S.q.x), r4(S.q.y), r4(S.q.z), r4(S.q.w)], v: Math.round(S.speed * 100) / 100,
      s: Math.round(S.shield), x: Math.round(S.extra), h: Math.round(S.health), b: Math.round(S.charge * 100), dn: S.down ? S.downR : 0 };
    if (W && LEAD === me()) {
      o.w = { c: [r3(W.c[0]), r3(W.c[1])], n: Math.round(W.n),
        t: W.t.map(e => [e.id, r3(e.p.x), r3(e.p.y), r3(e.p.z), Math.round(e.h), e.a ? 1 : 0, Math.round(e.back)]),
        d: W.d.map(e => [e.id, r3(e.p.x), r3(e.p.y), r3(e.p.z), r4(e.yaw), r4(e.pitch), Math.round(e.s), Math.round(e.h), e.a ? 1 : 0, Math.round(e.back), r4(e.bank)]),
        k: W.k.map(e => [e.id, e.kind, r3(e.p.x), r3(e.p.y), r3(e.p.z), Math.round(e.until)]) };
    }
    return o;
  }
  // the right controller while flying belongs to the ship (HOST.inputsGuard stops its presses, HOST.collab.ray its ray)
  const claims = x => !!(S.on && x && x.handedness === 'right' && !x.hand && x.gamepad);
  // the right stick clicked twice (shared.js), the menu's row, tests: launch or land at the next frame
  function toggle(why) {
    if (!S.on) { const w = whyNot(); if (w) { log('ship refused', { why: w }); say('Spaceship', w, 4500); return false; } }
    S.want = S.on ? 'land' : 'launch';
    log('ship asked', { want: S.want, by: why || '' });
    return true;
  }
  // the Shared dialog's people list: what someone flying shows ('' not flying)
  const nOf = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  function person(id) {
    const R = id === me() ? (S.on ? { last: { s: S.shield + S.extra, h: S.health, dn: S.down } } : null) : RS.get(id);
    const K = KILLS.get(id);
    const k = K && (K.ships || K.bots) ? 'destroyed ' + nOf(K.ships, 'ship', 'ships') + ' and ' + nOf(K.bots, 'drone or target', 'drones or targets') : '';
    if (!R || !R.last) return k;
    return (R.last.dn ? 'flying a ship (destroyed, back soon)' : 'flying a ship (shield ' + Math.round(R.last.s + (R.last.x || 0)) + ', health ' + Math.round(R.last.h) + ')') + (k ? ', ' + k : '');
  }
  // install: the input claim, the session (HOST.xr.watch, as HOST.session is set)
  if (HOST.inputsGuard && HOST.inputsGuard.claim) HOST.inputsGuard.claim(claims);
  if (HOST.xr && HOST.xr.watch) { const w0 = HOST.xr.watch; HOST.xr.watch = function (v) { try { watch(v); } catch (e) { /* never in the way */ } return w0.apply(this, arguments); }; }

  return {
    KEY, STEER, FLY, ARENA, GUN, HIT, HP, BOT,
    steer, angles,
    // the shell (shared.js) links itself in: { now, rt, id, name, colour, member, room, roomM, code, send, notice, log, camera, phone, changed }
    link(o) { L = o || null; },
    // each frame of a headset session, before any of its callbacks (index.html's moving with the sticks, frame), after
    // the frame is dressed: the frame's poses are three.js's
    frame(s, t, f) { try { frame(s, t, f); } catch (e) { console.warn('Spaceships:', e); } },
    flying: () => S.on, claims, toggle, out, presIn, fxIn, person, detach, whyNot,
    // for tests: the relay's time taken from the frames' (a test's own clock), or the relay's again
    testClock(on) { TC.on = !!on; return TC.on; },
    // for tests: launch (true) or land (false) at the next frame
    launch(on) { if (on === false) { if (S.on) S.want = 'land'; return true; } return toggle('test'); },
    line() { return S.on ? (S.down ? 'down, back in ' + Math.max(0, Math.ceil((T.respawn - (pnow() - S.down)) / 1000)) + ' s' : 'flying, shield ' + Math.round(S.shield + S.extra) + ', health ' + Math.round(S.health)) + ' · ' + (LEAD === me() ? 'leads the drones' : LEAD ? 'with ' + nameOf(LEAD) + '\'s drones' : '') + ' · pilots ' + pilots().length : RS.size ? RS.size + ' flying here' : 'none flying'; },
    // for tests: the times shortened ({ respawn, regen, ... } in ms; null the defaults again)
    times(o) {
      if (o === null) Object.assign(T, T0);
      else if (o) for (const k of Object.keys(T)) if (typeof o[k] === 'number' && o[k] >= 0) T[k] = o[k];
      return Object.assign({}, T);
    },
    // for tests: where things stand
    state() {
      const tn = now(), view = VW;
      return { flying: S.on, down: !!S.down, frame: F.kind, kind: S.kind, p: S.p.toArray(), yaw: S.yaw, pitch: S.pitch, bank: S.bank, q: S.q.toArray(), speed: S.speed, turn: S.turn, neutral: S.neutral,
        shield: S.shield, extra: S.extra, health: S.health, boost: { t: S.boostT, charge: S.charge }, rapid: Math.max(0, S.rapidUntil - tn), boostUp: Math.max(0, S.boostUntil - tn), killer: S.killer, c: S.c.slice(), lt: S.lt,
        ctrl: { ok: CTRL.ok, roll: CTRL.roll, pitch: CTRL.pitch, grip: CTRL.grip, trig: CTRL.trig, a: CTRL.a }, me: me(), leader: LEAD, lead: LEAD === me() && !!W, pilots: pilots().map(p => p.id),
        drones: view ? view.d.map(e => ({ id: e.id, p: [e.p.x, e.p.y, e.p.z], yaw: e.yaw, s: e.s, h: e.h, a: e.a, back: e.back })) : [],
        targets: view ? view.t.map(e => ({ id: e.id, p: [e.p.x, e.p.y, e.p.z], h: e.h, a: e.a, back: e.back })) : [],
        pickups: view ? view.k.map(e => ({ id: e.id, kind: e.kind, p: [e.p.x, e.p.y, e.p.z], left: e.until - tn, pend: PEND.has(e.id), gone: GONE.has(e.id) })) : [],
        next: view ? view.n - tn : 0, setC: view ? view.c.slice() : null,
        bolts: [...BOLTS.values()].filter(B => !B.hit && tn >= B.t0 && tn - B.t0 <= GUN.life * 1000).map(B => ({ by: B.by, pilot: B.pilot, dr: B.dr, p: boltAt(B, tn, new V3()).toArray(), v: B.v, age: tn - B.t0 })),
        kills: Object.fromEntries([...KILLS].map(([k, v]) => [k, Object.assign({}, v)])),
        remote: [...RS].map(([id, R]) => ({ id, lt: R.lt, p: R.draw ? R.draw.p.toArray() : R.last ? R.last.p.slice() : null, s: R.last ? R.last.s : 0, x: R.last ? R.last.x : 0, h: R.last ? R.last.h : 0, dn: R.last ? R.last.dn : 0, samples: R.s.length })),
        drawn: G.made ? { ships: G.ships.count, drones: G.drones.count, targets: G.targets.count, bolts: G.bolts.count, picks: Object.values(G.picks).reduce((a, x) => a + x.count, 0), hud: G.hudMesh.visible, arrow: G.arrow.visible, inScene: !!(G.root.parent && G.root.parent === storyScene()), tris: G.tris } : null,
        out: OUT.length, rt: DRAW.rt || 0 };
    },
    // for tests: things put where a test needs them (the game's frame), and the objects themselves
    debug: {
      place(p, yaw, pitch) { if (p) S.p.set(p[0], p[1], p[2]); if (Number.isFinite(yaw)) S.yaw = yaw; if (Number.isFinite(pitch)) S.pitch = pitch; qOf(S.yaw, S.pitch, S.bank, S.q); },
      speed(v) { S.speed = v; },
      freeze(on) { FREEZE.on = !!on; return FREEZE.on; },
      drone(id, o) { const e = W && W.d.find(d => d.id === id); if (!e) return false; if (o.p) e.p.set(o.p[0], o.p[1], o.p[2]); for (const k of ['yaw', 'pitch', 's', 'h', 'fireAt', 'whim', 'chase', 'wy', 'wh']) if (Number.isFinite(o[k])) e[k] = o[k]; if (o.a !== undefined) e.a = !!o.a; return true; },
      target(id, o) { const e = W && W.t.find(d => d.id === id); if (!e) return false; if (o.p) e.p.set(o.p[0], o.p[1], o.p[2]); if (Number.isFinite(o.h)) e.h = o.h; if (o.v) e.v.set(o.v[0], o.v[1], o.v[2]); return true; },
      pickup(kind, p, life) { if (!W || !KIND[kind]) return ''; const id = 'kt' + (++W.seq); W.k.push({ id, kind, p: new V3(p[0], p[1], p[2]), until: now() + (life || T.pickLife) }); return id; },
      next(ms) { if (W) W.n = now() + ms; },
      clearPicks() { if (W) W.k = []; },
      hurt(n, by) { if (S.on && !S.down) hurt(n, by || 'drone', 'test:' + (++S.n)); return { shield: S.shield, extra: S.extra, health: S.health, down: !!S.down }; },
      bolt(o, d, v, dr) { const n = ++S.n; emit(Object.assign({ k: 'b', i: n, o, d, v, t: Math.round(now()) }, dr ? { dr } : {})); return me() + ':' + n; },
      objects: () => G,
      // this ship's places by the relay's time while on ([ms, x, y, z], the last 600), or the list
      track(on) { if (on !== undefined) { TRACK.on = !!on; TRACK.list = []; } return TRACK.list.slice(); },
      claim(id) { emit({ k: 'c', i: String(id), t: Math.round(now()) }); PEND.set(String(id), pnow()); },
      materials() { const out = []; if (!G.made) return out; G.root.traverse(o => { if (o.material) out.push(o.material); }); G.hud.traverse(o => { if (o.material) out.push(o.material); }); return out; },
    },
  };
})();
