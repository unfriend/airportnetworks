// The studio tour's parts (tools/studio/tour/README.md): every model of the example scene examples/studio-tour/, built
// in code with the Bliss XP room's kit (XP.*, tools/studio/xp/kit.js) in the generator's page. All our own, low-poly, few
// materials: the hall, the signs (a board of text on a post, one unlit draw each), a small robot with five clips, a bee,
// an eye, a vase, a bowl drawn from one side only, an easel with a picture, a low wall, the shuttle and the world outside
// it. Deterministic: every random number comes from XP.rng(seed). The signs' words come from layout.mjs (TOUR.signs).
(function () {
  const T = THREE, D2R = Math.PI / 180;
  const TOUR = window.TOUR = {};
  const lit = () => XP.lit({ roughness: 0.7 });
  const col = c => new T.Color(c).toArray();
  // a box of colour c, its middle at (x, y, z), turned by (rx, ry, rz)
  const box = (w, h, d, c, x, y, z, rx, ry, rz) => XP.solid(XP.box(w, h, d), c, XP.at(null, x, y, z, rx, ry, rz).m);
  const at = (geo, c, x, y, z, rx, ry, rz, s) => XP.solid(geo, c, XP.at(null, x, y, z, rx, ry, rz, s).m);
  const mesh = (list, mat, name) => XP.mesh(XP.merge(list, { noUV: true }), mat, name);

  // ------------------------------------------------------------------ signs --
  // Section colours: the basics blue, what reacts green, what moves amber, the shuttle violet, the boards grey
  TOUR.SECTION = { basics: '#2f6fd6', react: '#1f9a5c', move: '#d07a12', shuttle: '#7a4fd0', board: '#3d4b60' };
  // a sign's face: a coloured band with its number and the studio's name for the feature, what it does, and what to do
  // here (a pale box), on white; all sizes in pixels of a face W wide
  function drawSign(F, s) {
    const { g, W, fh } = F, k = W / 768, band = Math.round(96 * k), pad = Math.round(28 * k), C = TOUR.SECTION[s.section] || TOUR.SECTION.board;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, fh);
    g.fillStyle = C; g.fillRect(0, 0, W, band);
    let x = pad;
    if (s.n) {
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(pad + 30 * k, band / 2, 30 * k, 0, Math.PI * 2); g.fill();
      XP.text(g, String(s.n), pad + 30 * k, band / 2 + 1, { size: Math.round(32 * k), weight: 'bold', align: 'center', base: 'middle', color: C, font: XP.F.title });
      x = pad + 76 * k;
    }
    XP.text(g, s.title, x, band / 2 + 2, { size: Math.round((s.small ? 42 : 50) * k), weight: 'bold', base: 'middle', color: '#ffffff', font: XP.F.title, max: W - x - pad });
    let y = band + pad + 6 * k;
    const size = Math.round((s.size || 33) * k), lh = Math.round(size * 1.28);
    g.font = `${size}px ${XP.F.ui}`;
    const para = (text, color, weight) => {
      g.font = `${weight || ''} ${size}px ${XP.F.ui}`.trim();
      for (const line of XP.wrap(g, text, W - 2 * pad - (s.boxed ? 24 * k : 0))) { XP.text(g, line, pad, y + size * 0.8, { size, weight, color }); y += lh; }
    };
    for (const p of [].concat(s.what || [])) { para(p, '#1b2330'); y += Math.round(10 * k); }
    if (s.here) {
      // what to do here, in a pale box of the section's colour
      g.font = `bold ${size}px ${XP.F.ui}`;
      const lines = XP.wrap(g, s.here, W - 2 * pad - 36 * k), top = y + 4 * k, hgt = lines.length * lh + 22 * k;
      g.fillStyle = C; g.globalAlpha = 0.13; XP.rr(g, pad - 10 * k, top, W - 2 * pad + 20 * k, hgt, 12 * k); g.fill(); g.globalAlpha = 1;
      g.fillStyle = C; g.fillRect(pad - 10 * k, top, 8 * k, hgt);
      y = top + 12 * k;
      for (const line of lines) { XP.text(g, line, pad + 12 * k, y + size * 0.8, { size, weight: 'bold', color: '#14202e' }); y += lh; }
      y += 22 * k;
    }
    if (y > fh + 2) throw new Error(`sign ${s.file}: its words take ${Math.round(y)} px of ${fh}`);
  }
  // a sign: a board w x h metres facing +z, its middle `mid` metres up, tilted back a little, on a post (or none: on a
  // wall, its back at z = 0); one unlit draw
  function signPart(s) {
    XP.part(s.part, { file: s.file, sign: true, build() {
      const w = s.w || 1.1, h = s.h || 0.75, W = s.px || 640, F = XP.face(w, h, W, { back: '#5b6472' });
      drawSign(F, s);
      const tex = XP.tex(F.cv), d = 0.03, parts = [];
      const board = XP.slab(F, d, { bevel: 0.006 });
      const tilt = s.post === false ? 0 : -8 * D2R, mid = s.mid || 1.45;
      board.translate(0, 0, -d / 2);
      board.rotateX(tilt); board.translate(0, mid, s.post === false ? d / 2 : 0);
      parts.push(board);
      if (s.post !== false) {
        // (the post and its foot painted with the back strip's grey)
        const strip = (g, k) => XP.paint(g.index ? g.toNonIndexed() : g, (x, y, z, nx, ny, nz) => [...F.back, k * XP.shade(nx, ny, nz)]);
        const post = XP.box(0.06, mid - h * 0.4, 0.06); post.translate(0, (mid - h * 0.4) / 2, -0.04);
        const foot = XP.box(0.36, 0.03, 0.28); foot.translate(0, 0.015, -0.04);
        parts.push(strip(post, 0.9), strip(foot, 0.7));
      }
      return { root: XP.group(s.part, XP.mesh(XP.merge(parts), XP.flat(tex), 'board')), clips: [] };
    } });
  }
  TOUR.signs = list => { for (const s of list) signPart(s); return list.length; };

  // ------------------------------------------------------------------ the hall --
  // A floor 7.6 m wide from z = +2.5 to -38.5 (its top 4 mm up, over the stage's floor), a pale walkway down the middle,
  // a band of each section's colour along its edges where that section's stands are, and walls 3.2 m high at x = +-3.8
  // and at both ends; no roof. One lit draw.
  XP.part('hall', { file: 'models/hall.glb', view: { dir: [0.6, 0.9, 0.5] }, build() {
    const L = [], X = 3.8, Z0 = 2.5, Z1 = -38.5, H = 3.2, len = Z0 - Z1, mz = (Z0 + Z1) / 2;
    L.push(box(2 * X, 0.024, len, '#3b4350', 0, -0.008, mz));
    L.push(box(2.6, 0.004, len - 1, '#59626f', 0, 0.006, mz - 0.5));
    for (const [z0, z1, c] of TOUR.bands || []) for (const sx of [-1, 1]) L.push(box(0.5, 0.004, z0 - z1, TOUR.SECTION[c], sx * (X - 0.4), 0.006, (z0 + z1) / 2));
    for (const sx of [-1, 1]) {
      L.push(box(0.16, H, len, '#aab3c0', sx * (X + 0.08), H / 2, mz));
      L.push(box(0.02, 0.24, len, '#7c8698', sx * (X - 0.01), 0.12, mz));
    }
    for (const z of [Z0, Z1]) L.push(box(2 * X + 0.32, H, 0.16, '#aab3c0', 0, H / 2, z + (z > 0 ? 0.08 : -0.08)));
    return { root: XP.group('hall', mesh(L, lit(), 'hall')), clips: [] };
  } });

  // ------------------------------------------------------------------ the robot --
  // A small robot, 1.2 m tall, its front +z: Hips (a group at 0.5 m) holding Body (torso and head), the legs and the arms
  // on pivots, each one lit draw of one shared material. Clips: Idle, Walk (a stride in place: the studio's As it moves
  // measures it), Wave, Jump, Dance.
  XP.part('robot', { file: 'models/robot.glb', view: { dir: [0.5, 0.35, 1] }, build() {
    const M = lit(), C = { body: '#e9edf3', trim: '#2f6fd6', dark: '#1c2330', eye: '#7fe3ff', joint: '#8a95a8' };
    const body = mesh([
      at(XP.rbox(0.36, 0.42, 0.24, 0.06), C.body, 0, 0.23, 0),
      box(0.37, 0.06, 0.25, C.trim, 0, 0.06, 0),
      box(0.12, 0.08, 0.02, C.trim, 0, 0.3, 0.125),
      box(0.08, 0.06, 0.08, C.joint, 0, 0.47, 0),
      at(XP.rbox(0.3, 0.24, 0.24, 0.07), C.body, 0, 0.62, 0),
      box(0.22, 0.09, 0.02, C.dark, 0, 0.63, 0.122),
      box(0.05, 0.035, 0.01, C.eye, -0.05, 0.635, 0.133),
      box(0.05, 0.035, 0.01, C.eye, 0.05, 0.635, 0.133),
      at(XP.cyl(0.008, 0.008, 0.12, 6), C.joint, 0, 0.8, 0),
      at(XP.sphere(0.025, 8, 6), C.trim, 0, 0.86, 0),
    ], M, 'Body');
    const hips = XP.group('Hips', body); hips.position.set(0, 0.5, 0);
    const limb = (name, x, y, parts) => { const g = XP.group(name, mesh(parts, M, name + 'Mesh')); g.position.set(x, y, 0); hips.add(g); return g; };
    for (const [n, x] of [['LeftLeg', 0.1], ['RightLeg', -0.1]]) limb(n, x, 0, [box(0.12, 0.42, 0.14, C.joint, 0, -0.23, 0), box(0.14, 0.08, 0.22, C.trim, 0, -0.46, 0.03)]);
    for (const [n, x] of [['LeftArm', 0.23], ['RightArm', -0.23]]) limb(n, x, 0.38, [at(XP.sphere(0.05, 8, 6), C.trim, 0, 0, 0), box(0.08, 0.32, 0.09, C.joint, 0, -0.2, 0), at(XP.sphere(0.05, 8, 6), C.body, 0, -0.38, 0)]);
    const root = XP.group('robot', hips);
    const Q = XP.qTrack, V = XP.vTrack, S = Math.sin, PI = Math.PI;
    const samp = (dur, n, f) => XP.sample(dur, n, f);
    const hip = (y, x) => [x || 0, y, 0];
    // Idle: a slow breath and the arms hanging a little out
    const idle = (() => { const [t, v] = samp(2, 8, s => hip(0.5 + 0.01 * S(s * PI), 0)); const [ta, va] = samp(2, 8, s => [0, 0, 0.08 + 0.03 * S(s * PI)]);
      return new T.AnimationClip('Idle', 2, [V('Hips', 'position', t, v), Q('LeftArm', ta, va), Q('RightArm', ta, va.map(e => [0, 0, -e[2]]))]); })();
    // Walk: one stride a second, legs and arms swinging opposite, the hips bobbing twice a stride
    const walk = (() => { const n = 12, [t, l] = samp(1, n, s => [0.45 * S(s * 2 * PI), 0, 0]), r = l.map(e => [-e[0], 0, 0]);
      const [, hv] = samp(1, n, s => hip(0.5 + 0.02 * Math.abs(S(s * 2 * PI)), 0));
      return new T.AnimationClip('Walk', 1, [Q('LeftLeg', t, l), Q('RightLeg', t, r), Q('LeftArm', t, r.map(e => [e[0] * 0.8, 0, 0.06])), Q('RightArm', t, l.map(e => [e[0] * 0.8, 0, -0.06])), V('Hips', 'position', t, hv)]); })();
    // Wave: the right arm up and waving
    const wave = (() => { const t = [0, 0.3, 0.55, 0.8, 1.05, 1.3, 1.6], z = [0.05, 2.5, 2.1, 2.7, 2.1, 2.5, 0.05];
      return new T.AnimationClip('Wave', 1.6, [Q('RightArm', t, z.map(a => [0, 0, -a]))]); })();
    // Jump: down, up 30 cm with the arms up, down again
    const jump = (() => { const t = [0, 0.2, 0.45, 0.7, 0.9], y = [0.5, 0.42, 0.8, 0.44, 0.5], a = [0.08, 0.3, 2.6, 0.5, 0.08], lg = [0, 0.5, -0.2, 0.4, 0];
      return new T.AnimationClip('Jump', 0.9, [V('Hips', 'position', t, y.map(v => hip(v, 0))), Q('LeftArm', t, a.map(v => [0, 0, v])), Q('RightArm', t, a.map(v => [0, 0, -v])), Q('LeftLeg', t, lg.map(v => [v, 0, 0])), Q('RightLeg', t, lg.map(v => [v, 0, 0]))]); })();
    // Dance: hips side to side, arms up in turn, a twist
    const dance = (() => { const n = 16, [t, hv] = samp(2, n, s => hip(0.5 + 0.03 * Math.abs(S(s * 2 * PI)), 0.06 * S(s * PI)));
      const [, la] = samp(2, n, s => [0, 0, 1.2 + 1.2 * S(s * PI)]), [, ra] = samp(2, n, s => [0, 0, -(1.2 - 1.2 * S(s * PI))]), [, tw] = samp(2, n, s => [0, 0.35 * S(s * PI), 0]);
      return new T.AnimationClip('Dance', 2, [V('Hips', 'position', t, hv), Q('LeftArm', t, la), Q('RightArm', t, ra), Q('Body', t, tw)]); })();
    return { root, clips: [idle, walk, wave, jump, dance] };
  } });

  // ------------------------------------------------------------------ small things --
  // a bee, 12 cm long, its wings beating (clip Fly)
  XP.part('bee', { file: 'models/bee.glb', view: { dir: [0.6, 0.6, 1] }, build() {
    const M = lit(), g = XP.sphere(0.04, 12, 8);
    g.scale(1, 1, 1.5);
    const P = g.attributes.position, c = [];
    for (let i = 0; i < P.count; i++) { const z = P.getZ(i), band = Math.floor((z + 0.06) / 0.022) % 2; c.push(...(z > 0.045 ? col('#1c1c1c') : band ? col('#1c1c1c') : col('#f2b705'))); }
    g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    const body = XP.mesh(XP.merge([g, at(XP.sphere(0.006, 6, 4), '#ffffff', 0.018, 0.012, 0.058), at(XP.sphere(0.006, 6, 4), '#ffffff', -0.018, 0.012, 0.058)], { noUV: true }), M, 'BeeBody');
    const wing = (x, a) => at(XP.box(0.07, 0.003, 0.035), '#dfefff', x, 0, 0, 0, 0, a);
    const wings = XP.group('Wings', mesh([wing(0.04, 0.25), wing(-0.04, -0.25)], M, 'WingsMesh')); wings.position.set(0, 0.035, 0);
    const t = [0, 0.05, 0.1], fly = new T.AnimationClip('Fly', 0.1, [XP.qTrack('Wings', t, [[0, 0, 0.35], [0, 0, -0.35], [0, 0, 0.35]])]);
    return { root: XP.group('bee', body, wings), clips: [fly] };
  } });
  // an eye on a stalk, 1.1 m tall: what a Look at behaviour turns
  XP.part('eye', { file: 'models/eye.glb', view: { dir: [0.4, 0.3, 1] }, build() {
    const g = XP.sphere(0.13, 20, 14), P = g.attributes.position, c = [];
    for (let i = 0; i < P.count; i++) { const z = P.getZ(i) / 0.13, r = Math.hypot(P.getX(i), P.getY(i)) / 0.13; c.push(...(z > 0.94 && r < 0.3 ? col('#101418') : z > 0.8 ? col('#2f8fd6') : col('#f4f6f8'))); }
    g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    const L = [at(g, '#ffffff', 0, 1.0, 0), at(XP.cyl(0.025, 0.03, 0.86, 8), '#7c8698', 0, 0.44, 0), at(XP.cyl(0.18, 0.2, 0.04, 16), '#4a5568', 0, 0.02, 0)];
    return { root: XP.group('eye', mesh(L, lit(), 'eye')), clips: [] };
  } });
  // a vase, 32 cm, pale with a grey neck, so a tint shows
  XP.part('vase', { file: 'models/vase.glb', view: { dir: [0.5, 0.5, 1] }, build() {
    const pr = [[0.001, 0], [0.07, 0], [0.09, 0.04], [0.11, 0.12], [0.1, 0.2], [0.06, 0.27], [0.055, 0.3], [0.07, 0.32]].map(([x, y]) => new T.Vector2(x, y));
    const g = new T.LatheGeometry(pr, 16).toNonIndexed(); g.computeVertexNormals();
    const P = g.attributes.position, c = [];
    for (let i = 0; i < P.count; i++) { const y = P.getY(i); c.push(...(y > 0.26 ? col('#8f98a8') : col('#f1efe9'))); }
    g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    return { root: XP.group('vase', XP.mesh(XP.merge([g], { noUV: true }), lit(), 'vase')), clips: [] };
  } });
  // a bowl drawn from its outside only (one-sided, as some files are): looking in, its far side is missing until Faces:
  // Both sides
  XP.part('bowl', { file: 'models/bowl.glb', view: { dir: [0.4, 1, 0.8] }, build() {
    const g = new T.SphereGeometry(0.2, 20, 7, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    g.translate(0, 0.2, 0);
    return { root: XP.group('bowl', XP.mesh(XP.merge([XP.solid(g, '#c8643c')], { noUV: true }), lit(), 'bowl')), clips: [] };
  } });

  // ------------------------------------------------------------------ pictures --
  // our own two little paintings: a day and a night over the same hills (512 x 384)
  TOUR.painting = night => {
    const { cv, g } = XP.canvas(512, 384), r = XP.rng(XP.seed(night ? 'night' : 'day'));
    g.fillStyle = XP.grad(g, 0, 0, 0, 260, night ? [[0, '#0b1230'], [1, '#253a6e']] : [[0, '#5aa9ff'], [1, '#cfe8ff']]); g.fillRect(0, 0, 512, 384);
    if (night) { for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + 0.6 * r()})`; g.fillRect(r() * 512, r() * 230, 2, 2); } g.fillStyle = '#f4f0d8'; g.beginPath(); g.arc(400, 80, 34, 0, 7); g.fill(); g.fillStyle = '#0b1230'; g.beginPath(); g.arc(386, 72, 30, 0, 7); g.fill(); }
    else { g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(410, 82, 40, 0, 7); g.fill(); for (const [x, y] of [[90, 70], [250, 110]]) XP.cloud(g, x, y, 120, 40, r); }
    const hill = (y, c, f) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, 384); for (let x = 0; x <= 512; x += 16) g.lineTo(x, y + 26 * Math.sin(x / 512 * Math.PI * f + y)); g.lineTo(512, 384); g.fill(); };
    hill(250, night ? '#1d3b2c' : '#5fae4e', 2); hill(300, night ? '#14281f' : '#3f8c3a', 3);
    g.fillStyle = night ? '#3a2f2a' : '#c9553b'; g.fillRect(150, 236, 70, 54); g.beginPath(); g.moveTo(140, 238); g.lineTo(185, 200); g.lineTo(230, 238); g.fill();
    g.fillStyle = night ? '#ffd86b' : '#6fb7ff'; g.fillRect(166, 252, 16, 16); g.fillRect(190, 252, 16, 16);
    return cv;
  };
  // an easel holding the day painting: the picture first (material 0, the one a trigger cube's Change texture swaps),
  // then the wooden frame and legs; 1 m tall, the picture's middle at 0.72 m
  XP.part('easel', { file: 'models/easel.glb', view: { dir: [0.4, 0.3, 1] }, build() {
    const w = 0.56, h = 0.42, pic = new T.PlaneGeometry(w, h), tex = XP.tex(TOUR.painting(false));
    pic.rotateX(-8 * D2R); pic.translate(0, 0.72, 0.03);
    const P = XP.mesh(pic, new T.MeshBasicMaterial({ map: tex }), 'picture');
    const W = '#8a5a34', L = [
      box(w + 0.08, 0.04, 0.03, W, 0, 0.72 + h / 2 + 0.01, 0.01, -8 * D2R), box(w + 0.08, 0.04, 0.03, W, 0, 0.72 - h / 2 - 0.01, 0.04, -8 * D2R),
      box(0.04, h, 0.03, W, -w / 2 - 0.02, 0.72, 0.025, -8 * D2R), box(0.04, h, 0.03, W, w / 2 + 0.02, 0.72, 0.025, -8 * D2R),
      box(0.04, 1.0, 0.04, W, -0.24, 0.5, 0.05, -6 * D2R, 0, 6 * D2R), box(0.04, 1.0, 0.04, W, 0.24, 0.5, 0.05, -6 * D2R, 0, -6 * D2R), box(0.04, 1.0, 0.04, W, 0, 0.48, -0.2, 16 * D2R),
      box(0.62, 0.03, 0.06, W, 0, 0.49, 0.06)];
    return { root: XP.group('easel', P, mesh(L, lit(), 'frame')), clips: [] };
  } });
  // a low wall, 1.6 m wide, 1 m high, 12 cm thick (a cut-out opens a window in it)
  XP.part('low-wall', { file: 'models/low-wall.glb', view: { dir: [0.5, 0.4, 1] }, build() {
    const L = [box(1.6, 1.0, 0.12, '#b9643f', 0, 0.5, 0), box(1.66, 0.05, 0.16, '#d8d2c8', 0, 1.02, 0)];
    for (let r = 0; r < 6; r++) for (const sz of [-1, 1]) L.push(box(1.6, 0.01, 0.005, '#d8cbbb', 0, 0.16 * r + 0.08, sz * 0.0625));
    return { root: XP.group('low-wall', mesh(L, lit(), 'wall')), clips: [] };
  } });

  // ------------------------------------------------------------------ the shuttle --
  // Our own boxy little shuttle, one lit draw: a cabin 2.8 x 3.8 m outside (inside 2.64 x 3.64 m, 2.4 m high) with a
  // doorway in its back (+z, 1.1 x 2.1 m), two windows a side, a bench along each side for two people each, a shelf on the
  // front wall for the VR goggles, a nose (-z), fins and engines. Its origin on the floor at the cabin's middle. The owner
  // swaps in his own: one object (and its group: tools/studio/tour/README.md).
  XP.part('shuttle', { file: 'models/shuttle.glb', view: { dir: [0.8, 0.45, 0.9] }, build() {
    const L = [], C = { hull: '#dfe4eb', in: '#7d889a', stripe: '#ff8a3d', floor: '#3a4250', bench: '#3f6fc0', dark: '#2a303b', glow: '#ff7a2a', metal: '#8a95a8' };
    const X = 1.4, Z = 1.9, H = 2.5, t = 0.08;
    L.push(box(2 * X, 0.06, 2 * Z, C.floor, 0, 0.03, 0));
    L.push(box(2 * X + 0.1, 0.12, 2 * Z + 0.1, C.dark, 0, H + 0.06, 0));
    // the sides: below and above the windows, pillars between (windows z -1.5..-0.5 and 0..1, y 1.05..1.65)
    for (const sx of [-1, 1]) {
      const x = sx * (X - t / 2);
      L.push(box(t, 1.05, 2 * Z, C.hull, x, 0.525, 0), box(t, H - 1.65, 2 * Z, C.hull, x, (H + 1.65) / 2, 0));
      for (const [z0, z1] of [[-Z, -1.5], [-0.5, 0], [1, Z]]) L.push(box(t, 0.6, z1 - z0, C.hull, x, 1.35, (z0 + z1) / 2));
      L.push(box(0.02, 0.16, 2 * Z, C.stripe, sx * (X + 0.01), 0.8, 0));
      // the inside's lining, a little in (so inside and out have their own colours)
      L.push(box(0.01, 1.0, 2 * Z - 2 * t, C.in, sx * (X - t - 0.006), 0.55, 0));
      // a bench for two along each side: seat, back, two legs
      L.push(box(0.46, 0.08, 2.6, C.bench, sx * (X - t - 0.24), 0.44, 0.1), box(0.08, 0.5, 2.6, C.bench, sx * (X - t - 0.05), 0.73, 0.1));
      for (const z of [-0.9, 1.1]) L.push(box(0.36, 0.4, 0.06, C.metal, sx * (X - t - 0.24), 0.2, z));
    }
    // the front wall (solid; the nose is outside it) and the shelf for the goggles at its right
    L.push(box(2 * X, H, t, C.hull, 0, H / 2, -Z + t / 2), box(2 * X - 2 * t, H - 0.1, 0.01, C.in, 0, H / 2, -Z + t + 0.006));
    L.push(box(0.7, 0.04, 0.26, C.dark, 0.85, 1.0, -Z + t + 0.13), box(0.04, 0.2, 0.2, C.metal, 0.85, 0.88, -Z + t + 0.1));
    // the back wall with its doorway (x -0.55..0.55, up to 2.1 m) and a step down to the hall
    for (const sx of [-1, 1]) L.push(box(X - 0.55, H, t, C.hull, sx * (0.55 + (X - 0.55) / 2), H / 2, Z - t / 2));
    L.push(box(1.1, H - 2.1, t, C.hull, 0, (H + 2.1) / 2, Z - t / 2), box(1.14, 0.06, 0.12, C.stripe, 0, 2.1, Z - t / 2));
    L.push(box(1.1, 0.03, 0.5, C.metal, 0, 0.015, Z + 0.25));
    // a light along the ceiling
    L.push(box(0.3, 0.02, 2.6, '#fff6dc', 0, H - 0.01, 0));
    // the nose: a frustum from the cabin's front, 1.4 m long, with a dark windscreen band
    const nose = new T.CylinderGeometry(0.35, 1, 1.4, 4, 1).toNonIndexed(); nose.rotateY(Math.PI / 4); nose.computeVertexNormals();
    nose.scale(X * Math.SQRT1_2 * 2 / 1, 1, (H * 0.5) * Math.SQRT1_2 * 2 / 1);
    L.push(at(nose, C.hull, 0, H / 2 + 0.05, -Z - 0.7, -Math.PI / 2, 0, 0));
    L.push(box(1.6, 0.4, 0.02, C.dark, 0, H * 0.72, -Z - 0.45, -0.62));
    // fins and engines at the back, out of the doorway's way
    for (const sx of [-1, 1]) {
      L.push(box(0.06, 0.7, 1.0, C.stripe, sx * 1.0, H + 0.45, Z - 0.6, 0.3));
      L.push(at(XP.cyl(0.28, 0.32, 0.6, 12), C.metal, sx * (X + 0.25), 0.9, Z - 0.2, Math.PI / 2), at(XP.cyl(0.22, 0.22, 0.02, 12), C.glow, sx * (X + 0.25), 0.9, Z + 0.11, Math.PI / 2));
    }
    return { root: XP.group('shuttle', mesh(L, lit(), 'shuttle')), clips: [] };
  } });

  // ------------------------------------------------------------------ somewhere else --
  // The world a trigger cube shows round the shuttle as you sit in it: a dome 4.8 m round the cabin (drawn from inside:
  // its faces turned in) with a violet sky, stars, a ringed planet at the shuttle's left and a moon at its right, far
  // mountains, and a rusty ground 8 mm up (over the stage's floor). One unlit draw, its picture 768 x 384: the sky above
  // and a strip of plain colours below for the ground and the mountains (their colours in the corners).
  XP.part('elsewhere', { file: 'models/elsewhere.glb', view: { cam: [[0, 1.4, 0], [0, 1.6, -4], 75] }, build() {
    const W = 768, Hs = 336, { cv, g } = XP.canvas(W, 384), r = XP.rng(XP.seed('elsewhere'));
    g.fillStyle = XP.grad(g, 0, 0, 0, Hs, [[0, '#05040e'], [0.55, '#1a1240'], [1, '#5b3a7a']]); g.fillRect(0, 0, W, Hs);
    for (let i = 0; i < 260; i++) { const y = Math.pow(r(), 1.4) * Hs * 0.85, s = r() < 0.08 ? 2 : 1; g.fillStyle = `rgba(255,255,255,${0.35 + 0.65 * r()})`; g.fillRect(r() * W, y, s, s); }
    // a nebula of soft blobs
    for (let i = 0; i < 26; i++) { const x = 450 + r() * 195, y = 45 + r() * 105, R = 22 + r() * 45, gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, 'rgba(255,120,200,0.16)'); gr.addColorStop(1, 'rgba(255,120,200,0)'); g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R); }
    // u = 0.25 is the shuttle's left (-x), 0.75 its right (+x): the dome's azimuth below; a ringed planet at the left, a moon at the right
    const planet = (x, y, R, c0, c1, ring) => {
      if (ring) { g.strokeStyle = 'rgba(240,210,170,0.8)'; g.lineWidth = 6; g.beginPath(); g.ellipse(x, y, R * 1.9, R * 0.42, -0.25, Math.PI, 2 * Math.PI); g.stroke(); }
      const gr = g.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
      if (ring) { g.strokeStyle = 'rgba(240,210,170,0.9)'; g.beginPath(); g.ellipse(x, y, R * 1.9, R * 0.42, -0.25, 0, Math.PI); g.stroke(); }
    };
    planet(W * 0.25, Hs - 22, 44, '#ffd6a0', '#b0582c', true);
    planet(W * 0.75, Hs - 40, 24, '#f2f4ff', '#8b93b8', false);
    planet(W * 0.52, Hs - 60, 9, '#a8f0ff', '#2a6f9a', false);
    g.fillStyle = '#c47a4a'; g.fillRect(0, Hs, W, 384 - Hs);
    const tex = XP.tex(cv), R = 4.8, seg = 40, rows = 12, P = [], U = [], C = [];
    const v = (u, y) => 1 - (Hs * (1 - y)) / 384;   // (y 0 the horizon, 1 the top: into the sky's part of the picture)
    const ground = [0.5, 1 - (Hs + 24) / 384];
    const push = (p, uv, c) => { P.push(...p); U.push(...uv); C.push(...(c || [1, 1, 1])); };
    // the sky: rows of quads from the horizon up, wound to face in
    for (let j = 0; j < rows; j++) for (let i = 0; i < seg; i++) {
      const a0 = i / seg, a1 = (i + 1) / seg, e0 = j / rows * Math.PI / 2, e1 = (j + 1) / rows * Math.PI / 2;
      const pt = (a, e) => [-R * Math.cos(e) * Math.sin(a * 2 * Math.PI), R * Math.sin(e), R * Math.cos(e) * Math.cos(a * 2 * Math.PI)];
      // (a = 0 is +z, behind; a = 0.25 the shuttle's left (-x); a = 0.5 ahead (-z); 0.75 its right (+x))
      const A = pt(a0, e0), B = pt(a1, e0), Cc = pt(a1, e1), D = pt(a0, e1), ua = [a0, v(a0, j / rows)], ub = [a1, v(a1, j / rows)], uc = [a1, v(a1, (j + 1) / rows)], ud = [a0, v(a0, (j + 1) / rows)];
      push(A, ua); push(Cc, uc); push(B, ub); push(A, ua); push(D, ud); push(Cc, uc);
    }
    // far mountains: a jagged band standing on the ground round the dome's foot, facing in
    for (let i = 0; i < seg * 2; i++) {
      const a0 = i / (seg * 2), a1 = (i + 1) / (seg * 2), h0 = 0.5 + 0.8 * r(), h1 = 0.5 + 0.8 * r(), Rm = R * 0.97;
      const pt = (a, y) => [-Rm * Math.sin(a * 2 * Math.PI), y, Rm * Math.cos(a * 2 * Math.PI)], c = col(r() < 0.5 ? '#4a2c3a' : '#5a3446');
      push(pt(a0, 0), ground, c); push(pt(a1, h1), ground, c); push(pt(a1, 0), ground, c); push(pt(a0, 0), ground, c); push(pt(a0, h0), ground, c); push(pt(a1, h1), ground, c);
    }
    // the ground: rings of the dome's radius, rusty with darker patches, facing up
    const rings = 5, gy = 0.008;
    const gc = (a, rr) => { const n = Math.sin(a * 37.7 + rr * 5.1) * Math.cos(a * 13.3 - rr * 3.7); return col(n > 0.35 ? '#8a4b2e' : n < -0.4 ? '#d79a68' : '#b8683f'); };
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
      const a0 = i / seg, a1 = (i + 1) / seg, r0 = j / rings * R, r1 = (j + 1) / rings * R;
      const pt = (a, rr) => [-rr * Math.sin(a * 2 * Math.PI), gy, rr * Math.cos(a * 2 * Math.PI)];
      push(pt(a0, r0), ground, gc(a0, r0)); push(pt(a0, r1), ground, gc(a0, r1)); push(pt(a1, r1), ground, gc(a1, r1));
      if (j) { push(pt(a0, r0), ground, gc(a0, r0)); push(pt(a1, r1), ground, gc(a1, r1)); push(pt(a1, r0), ground, gc(a1, r0)); }
    }
    // (every triangle wound the other way round: its front seen from inside the dome and from above the ground)
    for (const [A, n] of [[P, 3], [U, 2], [C, 3]]) for (let i = 0; i < A.length; i += 3 * n) for (let j = 0; j < n; j++) { const t = A[i + n + j]; A[i + n + j] = A[i + 2 * n + j]; A[i + 2 * n + j] = t; }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
    geo.setAttribute('color', new T.Float32BufferAttribute(C, 3));
    geo.computeVertexNormals();
    // (welded into an indexed geometry: corners shared, a fifth of the bytes)
    return { root: XP.group('elsewhere', XP.mesh(XP.merge([geo]), XP.flat(tex), 'elsewhere')), clips: [] };
  } });
})();
