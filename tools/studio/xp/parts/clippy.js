// Clippy: our own paperclip character, built from scratch: a wire bent the classic way (two nested loops), metallic,
// two big eyes with pupils and eyebrows; about 34 cm tall. He chills (clip Chill: reclining, breathing, a blink, a lazy
// look round), blinks (Blink), waves (Wave: perks up, eyebrows up, a bounce) and dances (Dance, the Desktop Dancer).
// His lounge is its own model: a beanbag, a pillow to lean on, a drink and a beach umbrella.
(function () {
  const T = THREE;
  XP.part('clippy', { file: 'models/clippy.glb', view: { dir: [0.5, 0.25, 1] }, build() {
    const u = 0.0122, foot = 1.65, cx = 0.4;   // (a centimetre of the drawing in metres; his foot's height in it; his middle)
    const P = XP.clippyPath().map(([x, y]) => { const yy = (y - foot) * u; return new T.Vector3((x - cx) * u, yy, Math.sin(Math.PI * y / 27) * 0.9 * u); });
    const curve = new T.CatmullRomCurve3(P, false, 'centripetal');
    const wire = new T.TubeGeometry(curve, 200, 0.4 * u, 8, false);
    // (round the two ends off)
    const capA = XP.sphere(0.4 * u, 10, 8); capA.translate(P[0].x, P[0].y, P[0].z);
    const capB = XP.sphere(0.4 * u, 10, 8); capB.translate(P[P.length - 1].x, P[P.length - 1].y, P[P.length - 1].z);
    const wireGeo = XP.merge([wire, capA, capB].map(g => { g.deleteAttribute('uv'); return g; }), { smooth: true, noUV: true });
    wireGeo.deleteAttribute('color');
    const metal = XP.lit({ vertexColors: false, color: 0xc9d1dc, roughness: 0.22, metalness: 0.92 });
    const white = XP.lit({ vertexColors: false, color: 0xf2f2f2, roughness: 0.35 }), black = XP.lit({ vertexColors: false, color: 0x0d0d10, roughness: 0.25 });
    const body = XP.group('body', XP.mesh(wireGeo, metal, 'wire'));
    const ey = (20.6 - foot) * u, ez = 1.5 * u;
    for (const [k, side] of [['L', -1], ['R', 1]]) {
      const eye = XP.group('eye' + k), w = XP.sphere(1.75 * u, 20, 14); w.scale(1, 1.18, 0.75);
      const pupil = XP.sphere(0.72 * u, 14, 10); pupil.scale(1, 1.1, 0.6);
      const pm = XP.mesh(pupil, black, 'pupil' + k); pm.position.set(0.25 * u * side * 0, -0.35 * u, 1.25 * u);
      eye.add(XP.mesh(w, white, 'white' + k), pm);
      eye.position.set(side * 1.9 * u, ey, ez);
      body.add(eye);
      // an eyebrow: a short thick arc over the eye
      const arc = []; for (let i = 0; i <= 8; i++) { const a = Math.PI * (0.25 + 0.5 * i / 8); arc.push(new T.Vector3(Math.cos(a) * 2.1 * u, Math.sin(a) * 1.1 * u, 0)); }
      const bg = new T.TubeGeometry(new T.CatmullRomCurve3(arc), 12, 0.32 * u, 6, false); bg.deleteAttribute('uv');
      const brow = XP.mesh(bg, black, 'brow' + k); brow.position.set(side * 1.9 * u, ey + 1.6 * u, ez + 0.6 * u); brow.rotation.z = -side * 0.12;
      body.add(brow);
    }
    const root = XP.group('clippy', body);
    // ---- the clips (node tracks: body turns, breathes and bounces; eyes blink; pupils look; brows lift)
    const R0 = -0.42;   // (reclining against his pillow)
    const blink = (t0) => [[t0, 1], [t0 + 0.06, 0.08], [t0 + 0.14, 0.08], [t0 + 0.22, 1]];
    const eyesTrack = (dur, blinks, wide) => {
      const keys = [[0, wide || 1]]; for (const b of blinks) keys.push(...blink(b).map(([t, v]) => [t, v * (wide || 1)])); keys.push([dur, wide || 1]);
      return ['L', 'R'].map(k => XP.vTrack('eye' + k, 'scale', keys.map(x => +x[0].toFixed(3)), keys.map(x => [x[1] > 0.5 ? x[1] : 1, x[1], 1])));
    };
    const pupils = (ts, xs, ys) => ['L', 'R'].map(k => XP.vTrack('pupil' + k, 'position', ts, xs.map((x, i) => [x * u, (ys ? ys[i] : -0.35) * u, 1.25 * u])));
    const brows = (ts, ys) => ['L', 'R'].map((k, i) => XP.vTrack('brow' + k, 'position', ts, ys.map(y => [(i ? 1 : -1) * 1.9 * u, ey + (1.6 + y) * u, ez + 0.6 * u])));
    // Chill: 8 s, reclined, breathing, two blinks, a lazy look left and right
    const [bt, bq] = XP.sample(8, 16, t => [R0 + 0.02 * Math.sin(t / 8 * Math.PI * 2), 0, 0.03 * Math.sin(t / 8 * Math.PI * 2 + 1)]);
    const [st, sv] = XP.sample(8, 16, t => [1, 1 + 0.018 * Math.sin(t / 4 * Math.PI * 2), 1]);
    const chill = new T.AnimationClip('Chill', 8, [XP.qTrack('body', bt, bq), XP.vTrack('body', 'scale', st, sv), ...eyesTrack(8, [2.6, 6.9]),
      ...pupils([0, 1, 1.6, 3, 4.2, 4.8, 6.2, 7, 8], [0, 0, -0.55, -0.55, 0, 0.55, 0.55, 0, 0]), ...brows([0, 1.6, 3, 4.8, 6.2, 8], [0, 0.15, 0, 0.15, 0, 0])]);
    const blinkClip = new T.AnimationClip('Blink', 0.35, eyesTrack(0.35, [0.05]));
    // Wave: up from his recline, a bounce and a wiggle, eyebrows up, eyes on you, then back
    const wt = [0, 0.35, 0.6, 0.85, 1.1, 1.35, 1.6, 2.0, 2.4];
    const wave = new T.AnimationClip('Wave', 2.4, [
      XP.qTrack('body', wt, [[R0, 0, 0], [0, 0, 0], [0, 0, 0.16], [0, 0, -0.16], [0, 0, 0.14], [0, 0, -0.12], [0, 0, 0], [0, 0, 0], [R0, 0, 0]]),
      XP.vTrack('body', 'position', [0, 0.35, 0.5, 0.65, 0.8, 0.95, 2.4], [[0, 0, 0], [0, 0, 0], [0, 0.045, 0], [0, 0, 0], [0, 0.028, 0], [0, 0, 0], [0, 0, 0]]),
      ...brows([0, 0.3, 1.9, 2.4], [0, 1.1, 1.1, 0]), ...pupils([0, 0.3, 2.0, 2.4], [0, 0, 0, 0], [-0.35, 0.1, 0.1, -0.35]), ...eyesTrack(2.4, [1.7], 1.08),
    ]);
    // Dance: the Desktop Dancer, a sway and a bounce on every beat
    const [dt, dq] = XP.sample(2, 16, t => [-0.1, 0, 0.28 * Math.sin(t / 2 * Math.PI * 2)]);
    const [dpt, dpv] = XP.sample(2, 16, t => [0, 0.032 * Math.abs(Math.sin(t / 2 * Math.PI * 4)), 0]);
    const dance = new T.AnimationClip('Dance', 2, [XP.qTrack('body', dt, dq), XP.vTrack('body', 'position', dpt, dpv),
      ...brows([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2], [0, 0.8, 0, 0.8, 0, 0.8, 0, 0.8, 0]), ...pupils([0, 0.5, 1, 1.5, 2], [0.5, -0.5, 0.5, -0.5, 0.5])]);
    return { root, clips: [chill, blinkClip, wave, dance] };
  } });

  XP.part('clippy-lounge', { file: 'models/clippy-lounge.glb', view: { dir: [0.6, 0.6, 1] }, build() {
    const S = XP.solid, M = (x, y, z, rx, ry, rz) => XP.at(null, x, y, z, rx, ry, rz).m, parts = [];
    const bag = XP.sphere(0.17, 28, 16); bag.scale(1, 0.42, 1); parts.push(S(bag, '#3a9b3a', M(0, 0.07, 0)));
    const dent = XP.sphere(0.1, 18, 10); dent.scale(1, 0.25, 1); parts.push(S(dent, '#43ad43', M(0, 0.1, -0.01)));
    parts.push(S(XP.rbox(0.2, 0.15, 0.07, 0.03, 3), '#2a6ee8', M(0, 0.17, -0.14, -0.45)));
    // a drink beside it: a glass of something orange with a straw and a little paper umbrella
    parts.push(S(XP.cyl(0.028, 0.022, 0.09, 16), '#d9f2ff', M(0.2, 0.045, 0.08)), S(XP.cyl(0.026, 0.026, 0.05, 16), '#ff9a2a', M(0.2, 0.05, 0.08)));
    parts.push(S(XP.cyl(0.003, 0.003, 0.12, 6), '#ff5aa0', M(0.21, 0.1, 0.08, 0, 0, -0.3)), S(new T.ConeGeometry(0.03, 0.015, 10), '#ffd23f', M(0.18, 0.115, 0.07, 0, 0, 0.4)));
    // a beach umbrella over him: a pole and a striped canopy
    parts.push(S(XP.cyl(0.006, 0.006, 0.62, 8), '#e8e8e8', M(-0.2, 0.31, -0.08)));
    const can = new T.ConeGeometry(0.26, 0.09, 16, 1, true), Pc = can.attributes.position, col = new Float32Array(Pc.count * 3);
    for (let i = 0; i < Pc.count; i++) { const a = Math.atan2(Pc.getZ(i), Pc.getX(i)), k = Math.floor((a + Math.PI) / (Math.PI * 2) * 16 + 0.5) % 2; new T.Color(k ? '#ffffff' : '#e8432a').toArray(col, i * 3); }
    can.setAttribute('color', new T.BufferAttribute(col, 3));
    parts.push({ geo: can, m: M(-0.2, 0.64, -0.08, 0.08, 0, 0.1) });
    const geo = XP.merge(parts, { noUV: true });
    return { root: XP.group('clippy-lounge', XP.mesh(geo, XP.lit({ roughness: 0.75, side: T.DoubleSide }), 'lounge')) };
  } });
})();
