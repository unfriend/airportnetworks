// The guide: a robot (the people's street-armour figure, bodies.js, posed by ik.js) driven by the script (sets/script.js:
// SCRIPT, evalGuide) instead of a person, and the props it makes from its own body: the ray from its fist, a target,
// five markers from its spine, the network from its chest badge, a mini menu, a copy of itself, boot trails, a card,
// status tags. Life size: 1 unit is 1 m, the floor y = 0, the viewer's start at the origin looking along -z.
// Everything is a pure function of a clock (the story's, or practice's own), so seeking works; the solver's state is
// warmed again after a jump. Where bodies cannot be drawn (no float textures in a vertex shader, or an older shell) a
// plain figure of boxes and cylinders stands in, in the same head and hand frames.
SETS.guide = function (K) {
  const { THREE, clamp, lerp } = K;
  const set = K.newSet('guide');
  const V3 = () => new THREE.Vector3(), D = Math.PI / 180, NET = GUIDE.NET;
  const params = { guide_clock: 0, guide_mode: 0, guide_net: 1 };
  let G = compileScript(SCRIPT, GUIDE.CH);
  // ------------------------------------------------------------------ the figures: bodies.js, else the plain figure
  const FIG = { kind: 'wait', S: null, B: [null, null], asked: performance.now(), dead: false, last: [null, null], plain: null, fail: '' };
  const forcePlain = typeof location !== 'undefined' && /[?&#]nofvt\b/.test(location.search + location.hash);
  function usePlain(why) {
    if (FIG.kind === 'plain' || FIG.dead) return;
    FIG.kind = 'plain'; FIG.fail = why || '';
    if (FIG.S) { FIG.S.dispose(); FIG.S = null; }
    FIG.plain = [plainFigure(GUIDE.COL), plainFigure(GUIDE.COPY_COL)];
    for (const p of FIG.plain) set.group.add(p.g);
  }
  // ------------------------------------------------------------------ materials
  const mat = (o, base) => K.fade(set, new THREE.MeshBasicMaterial(Object.assign({ transparent: true }, o)), base === undefined ? 1 : base);
  const lam = (o, base) => K.fade(set, new THREE.MeshLambertMaterial(Object.assign({ transparent: true }, o)), base === undefined ? 1 : base);
  const op = (m, x) => { m.opacity = m.userData.base * set.uA.value * clamp(x, 0, 1); };
  const add = (g, m, ro) => { const o = new THREE.Mesh(g, m); if (ro) o.renderOrder = ro; set.group.add(o); return o; };
  const CYAN = 0x46d9ff, PEARL = 0xe8eef8, AMBER = 0xffb347;
  // ------------------------------------------------------------------ the room: a dark floor with a grid fading out from 3 m (VR and the page)
  const floorMat = K.fade(set, new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uG: { value: 0 } }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uA, uG; varying vec2 vP;
void main() {
  float r = length(vP), e = 1.0 - smoothstep(3.4, 4.0, r);
  vec2 g = abs(fract(vP / 0.5 + 0.5) - 0.5) * 0.5 / fwidth(vP);
  float line = (1.0 - smoothstep(0.0, 1.0, min(g.x, g.y))) * uG * (1.0 - smoothstep(1.5, 3.0, r));
  gl_FragColor = vec4(mix(vec3(0.016, 0.03, 0.05), vec3(0.32, 0.4, 0.5), line * 0.55), (0.96 * e) * uA);
}`, extensions: { derivatives: true },
  }));
  const floor = add(new THREE.CircleGeometry(4, 64), floorMat, -2);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.002;
  // soft contact shadows under each figure
  const shTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const shadows = [0, 1].map(() => { const m = add(new THREE.PlaneGeometry(0.75, 0.75), mat({ map: shTex, depthWrite: false }), -1); m.rotation.x = -Math.PI / 2; m.position.y = 0.003; return m; });
  // ------------------------------------------------------------------ the ray, its dot, the target
  const rayGeo = new THREE.CylinderGeometry(0.003, 0.003, 1, 8, 1, true); rayGeo.translate(0, 0.5, 0);
  const rayMat = K.fade(set, new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uK: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying float vY; void main() { vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uA, uK; varying float vY; void main() { gl_FragColor = vec4(0.27, 0.85, 1.0, (1.0 - smoothstep(0.7, 1.0, vY)) * 0.9 * uA * uK); }' }));
  const ray = add(rayGeo, rayMat, 5), dot = add(new THREE.SphereGeometry(0.006, 12, 8), mat({ color: CYAN }), 5);
  const ringMat = mat({ color: 0x8fb4d8 }), ring = add(new THREE.TorusGeometry(0.07, 0.006, 8, 40), ringMat);
  const ringCore = add(new THREE.CircleGeometry(0.06, 32), mat({ color: CYAN, side: THREE.DoubleSide, depthWrite: false }, 0.0));
  // ------------------------------------------------------------------ the markers (from the spine), their numbers and the line joining them
  const hexG = new THREE.CylinderGeometry(0.09, 0.09, 0.01, 6), gemG = new THREE.OctahedronGeometry(0.022);
  const hexMat = lam({ color: 0x2a3442, emissive: 0x000000 }), gemMat = mat({ color: PEARL });
  const hexes = new THREE.InstancedMesh(hexG, hexMat, 5), gems = new THREE.InstancedMesh(gemG, gemMat, 5);
  hexes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(15).fill(1), 3);
  gems.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(15).fill(1), 3);
  set.group.add(hexes, gems);
  const numTex = n => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#e8eef8'; x.font = '700 40px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), 32, 34); return new THREE.CanvasTexture(c); };
  const nums = [0, 1, 2, 3, 4].map(i => { const m = add(new THREE.PlaneGeometry(0.05, 0.05), mat({ map: numTex(i + 1), depthWrite: false }), 2); m.rotation.x = -Math.PI / 2; return m; });
  const lineGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
  const lineMat = K.fade(set, new THREE.LineBasicMaterial({ color: 0x6f8fb0, transparent: true }), 0.55), line = new THREE.LineSegments(lineGeo, lineMat);
  set.group.add(line);
  // ------------------------------------------------------------------ the network (from the badge): nodes, white cores, links, beads
  const nodeMat = lam({ color: PEARL, emissive: 0x2a3a52 }), coreMat = mat({ color: 0xffffff }), linkMat = mat({ color: 0xbfd2ea }, 0.85), beadMat = mat({ color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false });
  const nodes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), nodeMat, 10), cores = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), coreMat, 10);
  nodes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(30).fill(1), 3);
  const linkG = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); linkG.translate(0, 0.5, 0);
  const links = new THREE.InstancedMesh(linkG, linkMat, 12), beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 10, 8), beadMat, 24);
  links.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(36).fill(1), 3);
  for (const m of [nodes, cores, links, beads]) { m.frustumCulled = false; set.group.add(m); }
  // ------------------------------------------------------------------ boot trails: six fading discs a boot
  const trails = new THREE.InstancedMesh(new THREE.CircleGeometry(0.06, 16), mat({ color: PEARL, blending: THREE.AdditiveBlending, depthWrite: false }), 12);
  trails.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(36), 3); trails.frustumCulled = false; set.group.add(trails);
  // ------------------------------------------------------------------ holograms: the mini menu, the card, the narration hold's sign
  function holo(w, h, px) {
    const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * h / w);
    const tex = new THREE.CanvasTexture(c), m = add(new THREE.PlaneGeometry(w, h), mat({ map: tex, side: THREE.DoubleSide, depthWrite: false }), 6);
    return { c, x: c.getContext('2d'), tex, m, sig: '' };
  }
  const menu = holo(0.32, 0.2, 512), card = holo(0.3, 0.18, 480), sign = holo(0.56, 0.2, 700);
  const rr = (x, a, b, w, h, r) => { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); };
  function drawMenu(F) {
    const M = F.menu, sig = M.kind + M.tab + M.rows.join('') + M.shown;
    if (sig === menu.sig) return;
    menu.sig = sig;
    const x = menu.x, W = menu.c.width, H = menu.c.height;
    x.clearRect(0, 0, W, H); rr(x, 4, 4, W - 8, H - 8, 22); x.fillStyle = 'rgba(10,18,30,0.86)'; x.fill(); x.strokeStyle = 'rgba(70,217,255,0.7)'; x.lineWidth = 3; x.stroke();
    x.font = '700 30px system-ui, sans-serif'; x.fillStyle = '#e7eef8'; x.textBaseline = 'middle'; x.fillText('Menu', 26, 36);
    const tabs = ['Story', 'Settings', 'Circles', 'Debug'];
    x.font = '24px system-ui, sans-serif';
    tabs.forEach((t, i) => { const on = (M.kind === 'sticks' || M.tab) && i === 1; rr(x, 22 + i * 120, 62, 112, 40, 10); x.fillStyle = on ? '#46d9ff' : 'rgba(160,178,202,0.18)'; x.fill(); x.fillStyle = on ? '#04131c' : '#cfd9e6'; x.fillText(t, 34 + i * 120, 83); });
    if (!M.shown && M.kind !== 'sticks') return;
    const rows = M.kind === 'sticks' ? [['Moving with the sticks: on', 1]] : ['Narration', 'Subtitles', 'Sound', 'Labels', 'Moving with the sticks'].map((n, i) => [n, M.rows[i] || 0]);
    rows.forEach(([n, on], i) => { x.fillStyle = on ? '#e7eef8' : 'rgba(207,217,230,0.55)'; x.font = (on ? '700 ' : '') + '23px system-ui, sans-serif'; x.fillText((on ? '▸ ' : '   ') + n, 26, 132 + i * 37); });
    menu.tex.needsUpdate = true;
  }
  function drawCard(room) {
    const sig = 'c' + room;
    if (card.sig === sig) return;
    card.sig = sig;
    const x = card.x, W = card.c.width, H = card.c.height;
    x.clearRect(0, 0, W, H); rr(x, 4, 4, W - 8, H - 8, 20); x.fillStyle = 'rgba(8,26,38,0.88)'; x.fill(); x.strokeStyle = '#46d9ff'; x.lineWidth = 4; x.stroke();
    x.textBaseline = 'middle'; x.fillStyle = '#46d9ff'; x.font = '24px system-ui, sans-serif'; x.fillText(room ? 'Next' : 'Network theory', 28, 60);
    x.fillStyle = '#e7eef8'; x.font = '700 40px system-ui, sans-serif'; x.fillText(room ? 'Your circle’s stories' : 'Next: Airports', 28, 130);
    card.tex.needsUpdate = true;
  }
  function drawSign() {
    if (sign.sig) return;
    sign.sig = 's';
    const x = sign.x, W = sign.c.width, H = sign.c.height;
    x.clearRect(0, 0, W, H); rr(x, 4, 4, W - 8, H - 8, 20); x.fillStyle = 'rgba(10,18,30,0.9)'; x.fill(); x.strokeStyle = 'rgba(232,238,248,0.8)'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#e7eef8'; x.textBaseline = 'middle';
    const L = ['My voice is off. Point at Narration off, on the panel,', 'and pull the trigger (or pinch).', 'Or press Play to go on without it.'];
    L.forEach((s, i) => { x.font = (i ? '' : '700 ') + '27px system-ui, sans-serif'; x.fillText(s, 24, 50 + i * 76 * (H - 40) / 230); });
    sign.tex.needsUpdate = true;
  }
  // ------------------------------------------------------------------ the plain figure (where bodies cannot be drawn)
  function plainFigure(col) {
    const g = new THREE.Group(), c = new THREE.Color(...col), plate = c.clone().multiplyScalar(0.28);
    const pm = lam({ color: plate }), lm = mat({ color: c.clone() });
    const box = (w, h, d, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || pm); g.add(o); return o; };
    const cyl = m => { const geo = new THREE.CylinderGeometry(0.045, 0.04, 1, 10); geo.translate(0, 0.5, 0); const o = new THREE.Mesh(geo, m || pm); g.add(o); return o; };
    const P = { g, pm, lm, col: c, helmet: box(0.22, 0.26, 0.24), visor: box(0.17, 0.04, 0.02, lm), torso: box(0.36, 0.5, 0.22), pelvis: box(0.3, 0.14, 0.2),
      arms: [cyl(), cyl()], legs: [cyl(), cyl()], boots: [box(0.11, 0.08, 0.26), box(0.11, 0.08, 0.26)], fists: [box(0.08, 0.08, 0.08), box(0.08, 0.08, 0.08)],
      emblem: new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.01, 6), lm, 4), spine: new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 8, 6), lm, 5),
      pts: {} };
    g.add(P.emblem, P.spine);
    return P;
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _a = V3(), _b = V3(), _c = V3(), _d = V3(), _s = new THREE.Vector3(1, 1, 1), _Y = new THREE.Vector3(0, 1, 0), _col = new THREE.Color();
  // a point of the actor's own frame (x its left, z its forward, from its floor point) in the set's frame
  const toSet = (A, p, out) => { const s = Math.sin(A.heading * D), c = Math.cos(A.heading * D); return out.set(A.p[0] + p[0] * c + p[2] * s, p[1], A.p[1] - p[0] * s + p[2] * c); };
  const EMB = [[0, 1.33, 0.12], [0, 1.37, 0.12], [-0.034, 1.31, 0.12], [0.034, 1.31, 0.12]], SPN = [0, 1, 2, 3, 4].map(i => [0, 1.47 - i * 0.1, -0.14]);
  function posePlain(P, A, I) {
    const look = A.look, show = !(I.hide & 1) && I.power > 0.001 && !I.gone;
    P.g.visible = show;
    if (!show) return;
    const off = [0, 0, -0.08];   // (the body about 8 cm behind its eyes)
    toSet(A, [0, A.eye + 0.02, 0.02], P.helmet.position); P.helmet.rotation.set(-look[1] * D, look[0] * D, 0, 'YXZ');
    P.visor.position.copy(toSet(A, [0, A.eye, 0.13], _a)); P.visor.rotation.copy(P.helmet.rotation);
    toSet(A, [0, 1.28, off[2]], P.torso.position); P.torso.rotation.set(0, A.heading * D, 0);
    toSet(A, [0, 0.98, off[2]], P.pelvis.position); P.pelvis.rotation.copy(P.torso.rotation);
    for (let i = 0; i < 2; i++) {
      const sg = i ? -1 : 1, sh = toSet(A, [sg * 0.235, 1.46, off[2]], _a), w = toSet(A, A.hands[i].w, _b);
      const arm = P.arms[i]; arm.position.copy(sh); _c.copy(w).sub(sh); arm.scale.set(1, _c.length(), 1); arm.quaternion.setFromUnitVectors(_Y, _c.normalize());
      P.fists[i].position.copy(w); P.pts[i ? 'rfist' : 'lfist'] = w.toArray();
      const hip = toSet(A, [sg * 0.1, 0.92, off[2]], _a), foot = toSet(A, [sg * 0.1, 0.07, off[2] + 0.03], _d);
      const leg = P.legs[i]; leg.position.copy(foot); _c.copy(hip).sub(foot); leg.scale.set(1, _c.length(), 1); leg.quaternion.setFromUnitVectors(_Y, _c.normalize());
      P.boots[i].position.copy(foot).setY(0.04); P.boots[i].rotation.copy(P.torso.rotation);
      P.pts[i ? 'rboot' : 'lboot'] = [foot.x, 0, foot.z];
    }
    for (let i = 0; i < 4; i++) { toSet(A, EMB[i], _a); _m.compose(_a, _q.setFromEuler(_e.set(Math.PI / 2, A.heading * D, 0, 'YXZ')), _s); P.emblem.setMatrixAt(i, _m); P.pts['emblem' + i] = _a.toArray(); }
    for (let i = 0; i < 5; i++) { toSet(A, SPN[i], _a); _m.compose(_a, _q.identity(), _s); P.spine.setMatrixAt(i, _m); P.pts['spine' + i] = _a.toArray(); }
    P.emblem.instanceMatrix.needsUpdate = P.spine.instanceMatrix.needsUpdate = true;
    P.emblem.visible = !(I.hide & 2); P.spine.visible = !(I.hide & 4);
    P.pts.visor = P.visor.position.toArray(); P.pts.chest = toSet(A, [0, 1.33, off[2]], _a).toArray();
    // the lights: power as brightness, a dark part off, a flash towards white
    const fl = I.flash ? I.flash[1] : 0, on = (I.dark & 8 ? 0.15 : 1) * I.power;
    P.lm.color.copy(P.col).multiplyScalar(0.2 + 0.8 * on).lerp(_col.setRGB(1, 1, 1), fl * 0.6);
    P.pm.emissive.copy(P.col).multiplyScalar(0.05 * I.power);
  }
  // ------------------------------------------------------------------ live input (the engine's see(): the viewer's head and ray, the panel, the room)
  const LIVE = { head: [0, 1.6, 0], ray: null, panel: null, room: false, ar: false, hover: -1, paused: false, hold: false, labels: true };
  // ------------------------------------------------------------------ practice (explore mode): its own clock and script
  const PR = { on: false, t: 0, run: true, G: null, idleTo: 0, mk: -1, want: -1 };
  // the live clock (real seconds, always running): signals sent in explore mode and from the room
  const LC = { t: 0, sig: [], last: -1e9 };
  function practiceScript() {
    const P = { g: actorTracks(), c: actorTracks(), ray: [], target: [], lit: [], marks: -1e9, line: [-1e9, -1e9],
      net: { leave: -1e9, grow: [-1e9, -1e9], links: [], sprout: [-1e9, -1e9] }, dim: [], beads: [], signals: [], menu: [], trails: [], card: [], floor: [], quiet: [], ntag: [], tags: [], copyOn: [], name: [] };
    const g = P.g;
    g.mv.push([0, 0, 'home', 'snap']); g.face.push([0, 1]); g.look.push([0, 'you']); g.yaw.push([0, 0, 0]);
    g.parts.push([0, 'dark', GUIDE.ALL], [0, 'power', 0.12, 0], [0, 'power', 1, 1.2]);
    [8, 7, 5, 6, 1, 4, 3].forEach((p, i) => g.parts.push([0.15 * i, 'light', p === 1 ? [1, 2] : [p]], [0.15 * i, 'flash', p]));
    g.parts.push([0, 'hide', [1, 2]]);
    P.tags.push([0.3, 3.3, 'Practice mode']);
    return P;
  }
  const pushT = (list, e) => { list.push(e); list.sort((x, y) => x[0] - y[0]); };
  // the idle loop, 30 s at a time ahead of the clock: a weight shift every 4 s, a visor sweep every 9 s, a glance every 6 s
  function idleAhead() {
    const P = PR.G;
    while (PR.idleTo < PR.t + 40) {
      const t0 = Math.max(3, PR.idleTo), t1 = t0 + 30;
      for (let t = Math.ceil(t0 / 9) * 9; t < t1; t += 9) P.g.sweep.push(t + 0.5);
      for (let t = Math.ceil(t0 / 6) * 6; t < t1; t += 6) { pushT(P.g.look, [t + 0.2, 'net']); pushT(P.g.look, [t + 1.6, 'you']); }
      for (let t = Math.ceil(t0 / 4) * 4, k = 0; t < t1; t += 4, k++) pushT(P.g.eye, [t, k % 2 ? 1.6 : 1.61]);
      P.g.sweep.sort((x, y) => x - y);
      PR.idleTo = t1;
    }
  }
  // what the guide does in practice, started now on its clock
  function react(kind, a, b) {
    if (!PR.G) return;
    const t = PR.t, g = PR.G.g;
    if (kind === 'done') {
      pushT(g.face, [t, 1]); pushT(g.look, [t, 'you']); pushT(g.nod, [t + 0.3, 2]);
      pushT(PR.G.tags, [t, t + 2.5, `Task ${a} of ${b}: done`]);
    } else if (kind === 'all') {
      pushT(PR.G.tags, [t, t + 4, 'Practice complete']);
      pushT(g.face, [t, 0]);
      [90, 180, 270, 360].forEach((y, i) => pushT(g.yaw, [t + 0.2 + i * 0.75, y, 0.3]));
      pushT(g.yaw, [t + 3.3, 0, 0]); pushT(g.face, [t + 3.25, 1]);
      pushT(g.r, [t + 3.4, t + 4.6, 'wave', 2]);
    } else if (kind === 'signal') {
      pushT(g.look, [t, 'node:' + a]); pushT(g.r, [t, t + 1.4, 'point', 'node:' + a]); pushT(g.look, [t + 1.6, 'you']);
    } else if (kind === 'nudge') {
      if (a === 0) { pushT(g.look, [t, 'node:0']); pushT(g.r, [t, t + 1.6, 'point', 'node:0']); }
      else if (a === 2 || a === 3) { pushT(g.look, [t, 'panel:foot']); pushT(g.r, [t, t + 1.6, 'point', a === 2 ? 'panel:play' : 'panel:next']); }
      else if (a === 4) pushT(g.r, [t, t + 1.2, 'stick']);
      else if (a === 5) { pushT(g.look, [t, 'panel:recenter']); pushT(g.r, [t, t + 1.6, 'point', 'panel:recenter']); }
      else pushT(g.look, [t, 'node:1']);
      pushT(g.look, [t + 1.9, 'you']);
    }
  }
  // practice: walk to marker i at 0.6 m/s (from where it stands now)
  function walkTo(i) {
    if (!PR.G) { PR.want = i; return; }
    if (i === PR.mk) return PR.t;
    const g = PR.G.g, from = evalActor(g, PR.t, LIVE, PR.G).p, to = GUIDE.MARKS[clamp(i, 0, 4)], L = Math.hypot(to[0] - from[0], to[1] - from[1]);
    // (a move under way ends where it is now: the new one starts from here)
    g.mv = g.mv.filter(m => m[0] <= PR.t);
    const last = g.mv[g.mv.length - 1];
    if (last && last[1] > PR.t) { last[1] = PR.t; last[2] = from; last[3] = 'snap'; last[0] = PR.t; }
    const end = PR.t + Math.max(0.6, L / 0.6 + 0.3);
    g.mv.push([PR.t, end, 'm' + clamp(i, 0, 4), 'walk']);
    PR.mk = i;
    return end;
  }
  // ------------------------------------------------------------------ one frame
  let last = null, F = null, figT = [null, null], copyWas = false;
  const H = [[0, 0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 0, 0, 1]], I0 = { head: null, g: H, floor: 0, toWorld: null, rgb: GUIDE.COL, dt: 0, ease: 0 };
  // the grips (bodies.js) for an actor's two hands: worked out in its own frame (facing +z), turned with its heading
  function grips(A, out, k) {
    _q2.setFromAxisAngle(_Y, A.heading * D);
    for (let i = 0; i < 2; i++) {
      const h = A.hands[i], g = HOST.bodies.grip(i ? 'r' : 'l', h.w, h.a, out[i], k);
      _a.set(g[0], g[1], g[2]).applyQuaternion(_q2); _q.set(g[3], g[4], g[5], g[6]).premultiply(_q2);
      g[0] = _a.x + A.p[0]; g[1] = _a.y; g[2] = _a.z + A.p[1]; g[3] = _q.x; g[4] = _q.y; g[5] = _q.z; g[6] = _q.w;
    }
    return out;
  }
  // its look this frame, with the live guard: the viewer's head within 0.6 m of its head dims it, within 0.35 m hides it
  function look(A, rgb) {
    const d = Math.hypot(A.head[0] - LIVE.head[0], A.head[1] - LIVE.head[1], A.head[2] - LIVE.head[2]);
    return { hide: d < 0.35 ? 511 : A.hide, dark: A.dark, power: d < 0.6 ? Math.min(0.3, A.power) : A.power, flash: d < 0.6 ? null : A.flash, rgb };
  }
  // an actor drawn by bodies.js at clock t; re-warmed after a jump (a seek, a late join, a gap over 0.5 s): 30 steps of
  // 1/30 s over the second before t, solve only
  function drawBody(i, A, t, mode, evalAt) {
    const B = FIG.B[i], S = FIG.S, L = HOST.bodies, tw = set.group.matrixWorld, rgb = i ? GUIDE.COPY_COL : GUIDE.COL;
    const prev = figT[i];
    const jump = !prev || prev.mode !== mode || t < prev.t - 1e-6 || t - prev.t > 0.5;
    if (jump) {
      for (let k = 0; k < 30; k++) {
        const tk = t - 1 + k / 30, Ak = evalAt(tk);
        if (!Ak) continue;
        S.add(B, Object.assign({}, I0, { head: Ak.head, g: grips(Ak, H, B.k), toWorld: tw, rgb, dt: k ? 1 / 30 : 0, jump: k === 0, warm: true }));
      }
    }
    const lk = look(A, rgb);
    const ok = S.add(B, Object.assign({}, I0, { head: A.head, g: grips(A, H, B.k), toWorld: tw, rgb, dt: jump ? 1 / 30 : Math.max(0, t - prev.t), hide: lk.hide, dark: lk.dark, power: lk.power, flash: lk.flash }));
    figT[i] = { t, mode };
    return ok;
  }
  // a named point of an actor in the set's frame (bodies.point is in the world: back through the set's frame)
  const _inv = new THREE.Matrix4();
  function pointOf(i, name, out) {
    if (FIG.kind === 'bodies' && FIG.B[i] && FIG.B[i].drawn !== undefined) {
      const w = HOST.bodies.point(FIG.B[i], name, { toWorld: set.group.matrixWorld }, out);
      return w ? out.applyMatrix4(_inv) : null;
    }
    if (FIG.kind === 'plain') { const p = FIG.plain[i].pts[name]; return p ? out.fromArray(p) : null; }
    // (not yet known: worked out from the script's own frame)
    const A = i ? F && F.c : F && F.g;
    if (!A) return null;
    if (name === 'rfist' || name === 'lfist') return toSet(A, A.hands[name === 'rfist' ? 1 : 0].w, out);
    if (name.startsWith('emblem')) return toSet(A, EMB[+name.slice(6)], out);
    if (name.startsWith('spine')) return toSet(A, SPN[+name.slice(5)], out);
    return toSet(A, [0, 1.33, 0], out);
  }
  function update(S, t, dt) {
    if (FIG.dead) return;
    set.group.updateWorldMatrix(true, false);
    _inv.copy(set.group.matrixWorld).invert();
    const mode = S.guide_mode > 0.5 ? 1 : 0;
    LC.t += Math.max(0, dt || 0);
    if (mode && !PR.on) {
      PR.on = true; PR.t = 0; PR.G = practiceScript(); PR.idleTo = 0; PR.mk = -1;
      if (PR.want >= 0) { PR.G.g.mv.push([0, 0, 'm' + PR.want, 'snap']); PR.mk = PR.want; }
    }
    if (!mode) { PR.on = false; PR.G = null; }
    if (mode && PR.run && !LIVE.paused) PR.t += Math.max(0, Math.min(0.1, dt || 0));
    if (mode) idleAhead();
    const Gc = mode ? PR.G : G, clock = mode ? PR.t : S.guide_clock;
    F = evalGuide(Gc, clock, LIVE);
    if (mode) { F.marks = 99; F.line = 1; F.floor = 1; F.net = { fly: 1, left: true, grow: 1, links: [1, 1, 1, 1, 1, 1], sprout: S.guide_net > 0.5 ? 1 : 0, dim: 1 }; F.beads = []; F.target = 0; F.ray = rayOfPractice(); }
    F.beads = F.beads.concat(liveBeads(F.net.sprout > 0.5));
    // the narration hold: it points at the panel's Sound button (Narration off) and looks at it
    if (LIVE.hold && !mode) { F.g.hands[1] = gGesture('point', 1, 'panel:sound', clock, clock, F.g.p, F.g.heading, LIVE, Gc); F.ray = 1; }
    // the figures
    const stand = Math.min(1, set.uA.value);
    if (FIG.kind === 'bodies') {
      const Sx = FIG.S;
      Sx.attach(rootOf(set.group));
      Sx.begin(clock * 1000);
      if (stand > 0.003) {
        drawBody(0, F.g, clock, mode, tk => evalGuide(Gc, tk, LIVE).g);
        if (F.c) drawBody(1, F.c, clock, mode, tk => evalGuide(Gc, tk, LIVE).c);
        else figT[1] = null;
      }
      Sx.end();
    } else if (FIG.kind === 'plain') {
      posePlain(FIG.plain[0], F.g, look(F.g));
      if (F.c) posePlain(FIG.plain[1], F.c, look(F.c)); else FIG.plain[1].g.visible = false;
    }
    copyWas = !!F.c;
    // shadows
    shadows[0].position.set(F.g.p[0], 0.003, F.g.p[1] - 0.05); op(shadows[0].material, F.g.hide & 1 ? 0 : 0.9);
    shadows[1].visible = !!F.c; if (F.c) { shadows[1].position.set(F.c.p[0], 0.003, F.c.p[1] - 0.05); op(shadows[1].material, 0.9 * F.copyA); }
    // the room: a floor and its grid in VR and on a page, nothing in AR (the real floor)
    floor.visible = !LIVE.ar; floorMat.uniforms.uG.value = F.floor;
    drawRay(F);
    drawTarget(F);
    drawMarks(F, mode);
    drawNet(F, mode);
    drawTrails(F, Gc, clock);
    drawHolos(F);
    TAG.text = LIVE.paused && (mode || clock > GUIDE.CH[2].a) ? 'Paused' : F.tag || '';
    TAG.a = LIVE.paused && (mode || clock > GUIDE.CH[2].a) ? 1 : F.tagA;
  }
  const rootOf = o => { while (o.parent) o = o.parent; return o; };
  // practice: the ray is on while the guide points (its right hand's span)
  function rayOfPractice() {
    const r = PR.G.g.r; let a = 0;
    for (const s of r) if (s[2] === 'point' && PR.t >= s[0] + 0.25 && PR.t <= s[1]) a = Math.min(1, (PR.t - s[0] - 0.25) / 0.3, (s[1] - PR.t) / 0.2);
    return a;
  }
  // the ray from the right fist along the aim (to its target where it has one), its dot where it meets it
  function drawRay(F) {
    const on = F.ray > 0.01 && !(F.g.hide & 1);
    ray.visible = dot.visible = on;
    if (!on) return;
    const h = F.g.hands[1], fist = pointOf(0, 'rfist', _a);
    if (!fist) { ray.visible = dot.visible = false; return; }
    let dir;
    if (h.at) dir = _b.fromArray(h.at).sub(fist);
    else { _q2.setFromAxisAngle(_Y, F.g.heading * D); dir = _b.set(h.a[0], h.a[1], h.a[2]).applyQuaternion(_q2); }
    const len0 = h.at ? dir.length() : 3;
    dir.normalize();
    const from = _c.copy(fist).addScaledVector(dir, 0.07), len = Math.max(0.05, (len0 - 0.07) * F.ray);
    ray.position.copy(from); ray.quaternion.setFromUnitVectors(_Y, dir); ray.scale.set(1, len, 1);
    rayMat.uniforms.uK.value = F.ray;
    dot.position.copy(from).addScaledVector(dir, len); op(dot.material, F.ray);
    dot.visible = !!h.at && F.ray > 0.95;
  }
  function drawTarget(F) {
    const a = F.target, on = a > 0.01;
    ring.visible = ringCore.visible = on;
    if (!on) return;
    ring.position.fromArray(GUIDE.PT); ringCore.position.copy(ring.position);
    _a.fromArray(LIVE.head); ring.lookAt(_a); ringCore.lookAt(_a);
    ring.scale.setScalar(0.3 + 0.7 * a);
    const lit = F.lit || LIVE.hover === 'target';
    ringMat.color.setHex(lit ? CYAN : 0x8fb4d8); op(ringMat, a); op(ringCore.material, lit ? 0.35 * a : 0);
  }
  // the markers: from the spine's nodes (0.3 s apart, 0.8 s each, along an arc, turning flat) to the floor
  function drawMarks(F, mode) {
    const T = F.marks, here = nearMark(F.g.p);
    let shown = 0;
    for (let i = 0; i < 5; i++) {
      const x = clamp((T - 0.3 * i) / 0.8, 0, 1), m = GUIDE.MARKS[i];
      if (T < 0.3 * i) { _m.makeScale(0, 0, 0); hexes.setMatrixAt(i, _m); gems.setMatrixAt(i, _m); nums[i].visible = false; continue; }
      shown++;
      const from = pointOf(0, 'spine' + i, _a) || _a.set(m[0], 1.3, m[1]), e = gSmooth(x);
      _b.set(lerp(from.x, m[0], e), lerp(from.y, 0.006, e) + Math.sin(Math.PI * x) * 0.45, lerp(from.z, m[1], e));
      _q.setFromEuler(_e.set((1 - e) * Math.PI / 2, F.g.heading * D * (1 - e), 0, 'YXZ'));
      const s = 0.25 + 0.75 * e;
      _m.compose(_b, _q, _c.set(s, s, s)); hexes.setMatrixAt(i, _m);
      _d.set(0, 0.035, 0).applyQuaternion(_q).multiplyScalar(s).add(_b);
      _m.compose(_d, _q2.setFromAxisAngle(_Y, LC.t * 0.8 + i), _c.set(s, s, s)); gems.setMatrixAt(i, _m);
      const lit = i === here && x >= 1;
      hexes.setColorAt(i, _col.setRGB(lit ? 1.6 : 1, lit ? 1.7 : 1, lit ? 1.9 : 1));
      gems.setColorAt(i, lit ? _col.setRGB(1, 1, 1) : _col.setRGB(0.55, 0.6, 0.7));
      nums[i].visible = x >= 1; nums[i].position.set(m[0] + 0.045, 0.013, m[1] + 0.035); op(nums[i].material, 0.8);
    }
    hexes.instanceMatrix.needsUpdate = gems.instanceMatrix.needsUpdate = true;
    hexes.instanceColor.needsUpdate = gems.instanceColor.needsUpdate = true;
    hexes.visible = gems.visible = shown > 0;
    hexMat.emissive.setHex(here >= 0 ? 0x101820 : 0);
    // the line on the floor joining them in order, drawn as it grows
    const k = clamp(F.line, 0, 1) * 4, pos = lineGeo.attributes.position.array;
    let n = 0;
    for (let j = 0; j < 4 && j < k; j++) {
      const a = GUIDE.MARKS[j], b = GUIDE.MARKS[j + 1], f = Math.min(1, k - j);
      pos.set([a[0], 0.004, a[1], lerp(a[0], b[0], f), 0.004, lerp(a[1], b[1], f)], n * 6); n++;
    }
    lineGeo.setDrawRange(0, n * 2); lineGeo.attributes.position.needsUpdate = true;
    line.visible = n > 0;
  }
  const nearMark = p => GUIDE.MARKS.findIndex(m => Math.hypot(m[0] - p[0], m[1] - p[1]) < 0.2);
  // the network: the badge leaves the chest (1.6 s), grows to its place (0.7 m across), six more nodes sprout; signals
  // run as beads along the links; dimmed while the story moves on; a node the viewer points at lights
  const NP = NET.U.map(() => V3());
  function nodePlace(i, F, out) {
    const N = F.net, fin = _d.fromArray(gNode(i));
    if (i < 4) {
      const g = N.grow, s = lerp(0.03 / 0.35, 1, g), C = _c.fromArray(NET.C);
      fin.sub(C).multiplyScalar(s).add(C);
      if (N.fly < 1) {
        const from = pointOf(0, 'emblem' + i, out) || out.copy(C);
        const C2 = _c.fromArray(NET.C), e = gSmooth(N.fly);
        const sm = _b.fromArray(gNode(i)).sub(C2).multiplyScalar(0.03 / 0.35).add(C2);
        return out.lerpVectors(from, sm, e).setY(lerp(from.y, sm.y, e) + Math.sin(Math.PI * N.fly) * 0.15);
      }
      return out.copy(fin);
    }
    const a = NET.L.find(l => l[1] === i)[0], A = _b.fromArray(gNode(a));
    return out.lerpVectors(A, fin, N.sprout);
  }
  function drawNet(F, mode) {
    const N = F.net, on = N.left;
    nodes.visible = cores.visible = links.visible = on;
    if (!on) { beads.count = 0; return; }
    const n = N.sprout > 0.001 ? 10 : 4, dim = N.dim;
    for (let i = 0; i < 10; i++) {
      if (i >= n) { _m.makeScale(0, 0, 0); nodes.setMatrixAt(i, _m); cores.setMatrixAt(i, _m); continue; }
      nodePlace(i, F, NP[i]);
      const grow = i < 4 ? lerp(0.25, 1, N.grow) : N.sprout, r = (i ? 0.0175 : 0.025) * grow, hv = LIVE.hover === i;
      _m.compose(NP[i], _q.setFromEuler(_e.set(0.4 * i, LC.t * 0.3 + i, 0)), _c.set(r, r, r)); nodes.setMatrixAt(i, _m);
      _m.compose(NP[i], _q.identity(), _c.set(r * 0.45, r * 0.45, r * 0.45)); cores.setMatrixAt(i, _m);
      const glow = (hv ? 1 : 0) + nodeFlash(i, F);
      nodes.setColorAt(i, _col.setRGB(1, 1, 1).multiplyScalar(dim * (1 + glow * 0.8)));
    }
    let li = 0;
    for (let j = 0; j < 12; j++) {
      const [a, b] = NET.L[j];
      if (a >= n || b >= n) { _m.makeScale(0, 0, 0); links.setMatrixAt(j, _m); continue; }
      const lit = j < 6 ? N.links[j] : N.sprout;
      _c.copy(NP[b]).sub(NP[a]);
      const len = _c.length();
      _m.compose(NP[a], _q.setFromUnitVectors(_Y, _c.normalize()), _d.set(0.002 * (j < 6 ? lerp(0.5, 1, N.grow) : 1), len, 0.002 * (j < 6 ? lerp(0.5, 1, N.grow) : 1)));
      links.setMatrixAt(j, _m); links.setColorAt(j, _col.setRGB(1, 1, 1).multiplyScalar(dim * (0.25 + 0.75 * lit))); li++;
    }
    nodes.instanceMatrix.needsUpdate = cores.instanceMatrix.needsUpdate = links.instanceMatrix.needsUpdate = true;
    nodes.instanceColor.needsUpdate = links.instanceColor.needsUpdate = true;
    op(nodeMat, 1); op(coreMat, dim); op(linkMat, 1);
    // beads
    let k = 0;
    for (const [u, v, x] of F.beads) {
      if (k >= 24) break;
      const A = u === 'fist' ? pointOf(0, 'rfist', _a) : NP[u], B = NP[v];
      if (!A || (u !== 'fist' && u >= n) || v >= n) continue;
      _b.lerpVectors(A, B, gSmooth(x));
      _m.compose(_b, _q.identity(), _c.set(1, 1, 1)); beads.setMatrixAt(k++, _m);
    }
    beads.count = k; beads.instanceMatrix.needsUpdate = true;
    beads.visible = k > 0;
  }
  // a node lights as a bead reaches it (0.3 s)
  function nodeFlash(i, F) {
    let f = 0;
    for (const [, v, x] of F.beads) if (v === i && x > 0.8) f = 1;
    return f;
  }
  // the signals sent live (explore mode, a room's effect): on the live clock
  function liveBeads(grown) {
    const out = [];
    LC.sig = LC.sig.filter(s => LC.t - s[0] < 3);
    for (const b of beadsAt({ beads: [], signals: LC.sig }, LC.t, grown)) out.push(b);
    return out;
  }
  // boot trails: six fading discs a boot, 0.08 s apart, from the script (where the feet were then)
  function drawTrails(F, Gc, t) {
    let k = 0;
    if (F.trails) for (let j = 1; j <= 6; j++) {
      const A = evalActor(Gc.g, t - j * 0.08, LIVE, Gc);
      for (let s = 0; s < 2; s++) {
        toSet(A, [s ? -0.1 : 0.1, 0.004, -0.06], _a);
        _m.compose(_a, _q.setFromEuler(_e.set(-Math.PI / 2, 0, 0)), _c.set(1, 1, 1)); trails.setMatrixAt(k, _m);
        trails.setColorAt(k++, _col.setRGB(0.9, 0.93, 0.97).multiplyScalar(0.5 * (1 - j / 7)));
      }
    }
    trails.count = k; trails.visible = k > 0;
    trails.instanceMatrix.needsUpdate = true; if (trails.instanceColor) trails.instanceColor.needsUpdate = true;
  }
  // the holograms: the mini menu over its right hand, the card in its left, the narration hold's sign before it
  function drawHolos(F) {
    _a.fromArray(LIVE.head);
    menu.m.visible = !!F.menu && F.menu.a > 0.01;
    if (menu.m.visible) {
      drawMenu(F);
      const f = pointOf(0, 'rfist', _b);
      if (f) { menu.m.position.copy(f).add(_c.set(0, 0.17, 0)); menu.m.lookAt(_a); }
      op(menu.m.material, F.menu.a); menu.m.scale.setScalar(0.6 + 0.4 * F.menu.a);
    }
    card.m.visible = F.card > 0.01;
    if (card.m.visible) {
      drawCard(LIVE.room);
      const f = pointOf(0, 'lfist', _b);
      if (f) { card.m.position.copy(f).add(_c.set(0, 0.13, 0)); card.m.lookAt(_a); }
      op(card.m.material, F.card); card.m.scale.setScalar(0.6 + 0.4 * F.card);
    }
    sign.m.visible = !!LIVE.hold;
    if (sign.m.visible) {
      drawSign();
      toSet(F.g, [0, 0.95, 0.4], sign.m.position); sign.m.lookAt(_a); op(sign.m.material, 1);
    }
  }
  // ------------------------------------------------------------------ anchors, labels, views, controls
  const TAG = { text: '', a: 0 };
  const headOf = (A, up) => (A ? [A.head[0], A.head[1] + up, A.head[2]] : [0, -50, 0]);
  const anchors = {
    head: () => headOf(F && F.g, 0), tag: () => headOf(F && F.g, 0.36), copy: () => headOf(F && F.c, 0), copyTag: () => headOf(F && F.c, 0.36),
    fist: () => { const p = pointOf(0, 'rfist', V3()); return p ? p.toArray() : headOf(F && F.g, -0.5); },
    chest: () => { const p = pointOf(0, 'emblem0', V3()); return p ? p.toArray() : headOf(F && F.g, -0.28); },
    boots: () => (F ? [F.g.p[0], 0.05, F.g.p[1]] : [0, 0, 0]),
    net: () => NET.C.slice(), target: () => GUIDE.PT.slice(), menu: () => (menu.m.visible ? menu.m.position.toArray() : headOf(F && F.g, -0.2)),
    card: () => card.m.position.toArray(),
    nodeTag: () => { const i = nodeTagI(); return i >= 0 ? [NP[i].x, NP[i].y + 0.05, NP[i].z] : [0, -50, 0]; },
  };
  for (let i = 0; i < 5; i++) anchors['marker' + i] = () => [GUIDE.MARKS[i][0], 0.03, GUIDE.MARKS[i][1]];
  for (let i = 0; i < 10; i++) anchors['node' + i] = () => NP[i].toArray();
  const nodeTagI = () => (LIVE.hover >= 0 && typeof LIVE.hover === 'number' ? LIVE.hover : F ? F.ntag : -1);
  const degree = i => NET.L.filter(l => (l[0] === i || l[1] === i) && l[0] < (F && F.net.sprout > 0.5 ? 10 : 4) && l[1] < (F && F.net.sprout > 0.5 ? 10 : 4)).length;
  const quiet = () => (F && F.quiet ? 0 : 1);
  const labels = [
    { text: () => [TAG.text, ''], at: 'tag', alpha: () => (TAG.text === 'Labels: hidden' ? 1 : quiet()) * TAG.a },
    { text: ['Guest', ''], at: 'copyTag', cls: 'amb', alpha: () => (F && F.c && F.name ? quiet() : 0) },
    { text: () => { const i = nodeTagI(), d = i >= 0 ? degree(i) : 0; return i < 0 ? ['', ''] : [`${i ? (d > 1 ? 'Node' : 'Leaf') : 'Hub'}: ${d} link${d === 1 ? '' : 's'}`, '']; },
      at: 'nodeTag', cls: 'cyn', alpha: () => (nodeTagI() >= 0 && F && F.net.left ? quiet() : 0) },
  ];
  // views [az, el, dist, tx, ty, tz]: where you stand (the guide at home ahead); from the right at the markers; at the
  // network; wide enough for both robots
  const cam = {
    default: [-8, 12, 2.48, 0.35, 1.1, -2.0],
    side: [44, 22, 2.87, 0.45, 0.6, -2.2],
    net: [16, 13, 1.12, -0.05, 1.3, -1.25],
    wide: [-15, 14, 2.83, 0.8, 1.0, -2.05],
  };
  const controls = [{ key: 'net', label: 'Network', options: [['grown', 'Grown'], ['badge', 'Badge']] }];
  const explore = c => ({ guide_mode: 1, guide_net: c.net === 'badge' ? 0 : 1 });
  // ------------------------------------------------------------------ what the engine calls
  function see(o) { Object.assign(LIVE, o); }
  // the hit of a ray (in the set's frame: origin o, unit direction d): a node, the target, or null
  function hit(o, d) {
    let best = null, bd = 6;
    const test = (p, r, kind, id) => {
      const px = p[0] - o[0], py = p[1] - o[1], pz = p[2] - o[2], s = px * d[0] + py * d[1] + pz * d[2];
      if (s <= 0) return;
      const q = Math.hypot(px - s * d[0], py - s * d[1], pz - s * d[2]);
      if (q < r && s < bd) { bd = s; best = { kind, id, dist: s, point: [o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s] }; }
    };
    if (F && F.net.left) for (let i = 0; i < (F.net.sprout > 0.5 ? 10 : 4); i++) test(NP[i].toArray(), i ? 0.045 : 0.055, 'node', i);
    if (F && F.target > 0.5) test(GUIDE.PT, 0.085, 'target', 0);
    return best;
  }
  function signal(i) {
    if (!(i >= 0 && i < 10)) return false;
    LC.sig.push([LC.t, i]); LC.last = LC.t;
    return true;
  }
  const signalOn = () => LC.t - LC.last < Math.max(1.5, signalSpan(0, true) + 0.4);
  function chapters(ch) { G = compileScript(SCRIPT, ch.map(c => ({ key: c.key, a: c.a, b: c.b }))); }
  function dispose() {
    FIG.dead = true;
    if (FIG.S) { FIG.S.dispose(); FIG.S = null; }
  }
  // the figure: bodies.js where the shell has it (a draw set of its own), else the plain figure
  if (forcePlain || !HOST.needBodies) usePlain(forcePlain ? 'nofvt' : 'no HOST.needBodies');
  else HOST.needBodies().then(ok => {
    if (FIG.dead || FIG.kind !== 'wait') return;
    const L = ok && HOST.bodies;
    const S = L && L.set ? L.set(2) : null, a = S && L.person('tutorial-guide'), b = S && L.person('tutorial-copy');
    if (!S || !a || !b) { if (S) S.dispose(); usePlain('no bodies'); return; }
    L.size(a, 1.62); L.size(b, 1.62);
    FIG.S = S; FIG.B = [a, b]; FIG.kind = 'bodies';
  }, () => usePlain('load failed'));
  return Object.assign(set, { params, update, anchors, labels, cam, controls, explore, see, hit, signal, signalOn, chapters, dispose, react, walkTo,
    figure: () => FIG.kind, usePlain, bodyStats: () => (FIG.S ? FIG.S.stats() : null),
    practice: () => ({ on: PR.on, t: PR.t, mk: PR.mk }), setRun: on => { PR.run = !!on; }, practiceReset: () => { PR.want = -1; PR.run = true; },
    frame: () => F, nodeAt: i => NP[i].toArray(), degree,
    state: () => ({ figure: FIG.kind, n: FIG.S ? FIG.S.stats().n : FIG.kind === 'plain' ? (F && F.c ? 2 : 1) : 0, hide: F ? F.g.hide : 0, copy: !!(F && F.c),
      nodes: F && F.net.left ? (F.net.sprout > 0.001 ? 10 : 4) : 0, beads: F ? F.beads.length : 0, tag: TAG.text, pos: F ? F.g.p : null, fail: FIG.fail }) });
};
