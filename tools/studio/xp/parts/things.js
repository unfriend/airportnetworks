// Things of the video: the white door that opens onto the hill (clip Open), the flip phone with the hill on its screen,
// the clear CRT monitor on the hill (its housing see-through), and the rubber duck "You". Lit (one material each, colours
// in the corners), their screens and the view through the door unlit pictures.
(function () {
  const T = THREE, S = XP.solid, M = (x, y, z, rx, ry, rz) => XP.at(null, x, y, z, rx, ry, rz).m;
  // a picture on a flat panel (unlit): a canvas painted by fn, w x h metres
  const picture = (w, h, W, fn, name) => {
    const H = Math.round(W * h / w), { cv, g } = XP.canvas(W, H); fn(g, W, H);
    const geo = new T.PlaneGeometry(w, h); geo.deleteAttribute('normal');
    return XP.mesh(geo, new T.MeshBasicMaterial({ map: XP.tex(cv) }), name || 'picture');
  };

  XP.part('door', { file: 'models/door.glb', view: { dir: [0.9, 0.3, 1] }, build() {
    // centred, its back against the wall at z = 0: the frame round an opening 0.9 x 2.05 m, the hill painted behind it
    const ow = 0.9, oh = 2.05, fw = 0.09, D = 0.12, H2 = (oh + fw) / 2, white = '#d9d6cc';   // (an off-white: lit by a room, it reads as white)
    const frame = XP.merge([
      S(XP.box(fw, oh + fw, D), white, M(-(ow + fw) / 2, -fw / 2 + fw / 2, D / 2)), S(XP.box(fw, oh + fw, D), white, M((ow + fw) / 2, 0, D / 2)),
      S(XP.box(ow + 2 * fw, fw, D), white, M(0, H2 - fw / 2 + fw / 2, D / 2)),
      S(XP.box(ow + 2 * fw + 0.04, 0.02, D + 0.01), '#e6e4dc', M(0, H2 + fw / 2 + 0.01, D / 2)),
    ], { noUV: true });
    const root = XP.group('door', XP.mesh(frame, XP.lit({ roughness: 0.7 }), 'frame'));
    root.children[0].position.y = -fw / 2;
    const view = picture(ow, oh, 448, (g, W, H) => XP.hill(g, 0, 0, W, H, { seed: 27, clouds: 4, crest: 0.62 }), 'outside');
    view.position.set(0, -fw / 2, 0.012); root.add(view);
    // the leaf: panels in relief, a lever handle; it swings on its left side towards you
    const lw = ow - 0.01, lh = oh - 0.01, t = 0.04, parts = [S(XP.rbox(lw, lh, t, 0.006), white, M(lw / 2, 0, 0))];
    for (const [px, py, pw, ph] of [[0.24, 0.5, 0.3, 0.75], [0.66, 0.5, 0.3, 0.75], [0.24, -0.45, 0.3, 0.95], [0.66, -0.45, 0.3, 0.95]]) {
      parts.push(S(XP.rbox(pw, ph, 0.012, 0.004), '#c4c1b6', M(lw * px / 0.9, py, t / 2)));
    }
    parts.push(S(XP.cyl(0.03, 0.03, 0.012, 20), '#c9ced6', M(lw - 0.08, -0.02, t / 2 + 0.006, Math.PI / 2)));
    const leafGeo = XP.merge(parts, { noUV: true });
    const handle = XP.merge([S(XP.cyl(0.009, 0.009, 0.05, 10), '#d8dde4', M(0, 0, 0.025, Math.PI / 2)), S(XP.rbox(0.13, 0.022, 0.018, 0.008), '#e4e8ee', M(-0.055, 0, 0.05))], { noUV: true });
    const metal = XP.lit({ roughness: 0.25, metalness: 0.85 });
    const lever = XP.group('lever', XP.mesh(handle, metal, 'handle')); lever.position.set(lw - 0.08, -0.02, t / 2 + 0.012);
    const leaf = XP.group('leaf', XP.mesh(leafGeo, XP.lit({ roughness: 0.7 }), 'panel'), lever);
    leaf.position.set(-ow / 2 + 0.005, -fw / 2, 0.06);
    root.add(leaf);
    // Open: the handle goes down, the door swings 100 degrees towards you, easing to rest
    const ease = [0, 0.15, 0.5, 0.85, 1], ts = [0.3, 0.55, 0.9, 1.3, 1.6];
    const tracks = [
      XP.qTrack('lever', [0, 0.15, 0.35, 0.6], [[0, 0, 0], [0, 0, 0.45], [0, 0, 0.45], [0, 0, 0]]),
      XP.qTrack('leaf', [0].concat(ts), [[0, 0, 0]].concat(ease.map(e => [0, -1.75 * e, 0]))),
    ];
    return { root, clips: [new T.AnimationClip('Open', 1.6, tracks)] };
  } });

  XP.part('flip-phone', { file: 'models/flip-phone.glb', build() {
    // a flip phone at two and a half times its size, open, standing on its foot; the hill on its screen
    const k = 2.5, w = 0.05 * k, hl = 0.09 * k, t = 0.014 * k, silver = '#b8c0cc', parts = [S(XP.rbox(w, hl, t, 0.01), silver, M(0, hl / 2, 0))];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) parts.push(S(XP.box(w * 0.22, hl * 0.09, 0.006), r === 0 && c !== 1 ? '#7fd17f' : '#e8ecf2', M((c - 1) * w * 0.28, hl * (0.2 + r * 0.14), t / 2 + 0.002)));
    parts.push(S(XP.rbox(w * 0.36, hl * 0.12, 0.006, 0.01), '#9aa4b4', M(0, hl * 0.82, t / 2 + 0.002)));
    const lower = XP.group('lower', XP.mesh(XP.merge(parts, { noUV: true }), XP.lit({ roughness: 0.35, metalness: 0.5 }), 'keys'));
    lower.rotation.x = -0.18;
    const upperParts = [S(XP.rbox(w, hl, t * 0.8, 0.012), silver, M(0, hl / 2, 0)), S(XP.cyl(0.006, 0.006, 0.035, 8), '#5a6170', M(w * 0.32, hl + 0.015, 0))];
    const upper = XP.group('upper', XP.mesh(XP.merge(upperParts, { noUV: true }), XP.lit({ roughness: 0.35, metalness: 0.5 }), 'lid'));
    const scr = picture(w * 0.8, hl * 0.62, 256, (g, W, H) => { XP.hill(g, 0, 0, W, H, { seed: 9, clouds: 2 }); XP.text(g, '9:41', W - 10, 30, { size: 26, align: 'right', weight: 'bold', color: '#fff', shadow: 'rgba(0,0,0,0.5)', sd: 2 }); }, 'screen');
    scr.position.set(0, hl * 0.55, t * 0.41); upper.add(scr);
    lower.add(upper); upper.position.set(0, hl, 0); upper.rotation.x = -0.2;   // (open: the lid on from the hinge, a little further back)
    return { root: XP.group('flip-phone', lower) };
  } });

  XP.part('glass-crt', { file: 'models/glass-crt.glb', view: { dir: [0.9, 0.45, 1] }, build() {
    // a clear CRT monitor standing on the grass: its housing see-through (one pane, small), so the dark picture tube, its
    // neck glowing orange and the green board show through it; a pale bezel round the screen, which shows the hill
    const cy = 0.27, solid = [];
    solid.push(S(XP.rbox(0.46, 0.38, 0.05, 0.03), '#d5e6ee', M(0, cy, 0.065)));                 // (the bezel)
    const tube = XP.cyl(0.035, 0.15, 0.22, 24); tube.rotateX(-Math.PI / 2); solid.push(S(tube, '#1d2229', M(0, cy, -0.08)));
    const neck = XP.cyl(0.025, 0.025, 0.06, 12); neck.rotateX(-Math.PI / 2); solid.push(S(neck, '#2a3038', M(0, cy, -0.22)));
    solid.push(S(XP.box(0.3, 0.008, 0.2), '#2f7d3c', M(0, cy - 0.15, -0.11)));                  // (the board)
    solid.push(S(XP.rbox(0.28, 0.025, 0.24, 0.01), '#cfdde6', M(0, 0.0125, -0.08)));              // (the foot)
    solid.push(S(XP.cyl(0.04, 0.05, 0.065, 16), '#c3d3dd', M(0, 0.057, -0.08)));
    const body = XP.merge(solid, { noUV: true });
    const shell = XP.cyl(0.127, 0.2546, 0.3, 4); shell.rotateY(Math.PI / 4); shell.rotateX(-Math.PI / 2); shell.scale(1.222, 1, 1); shell.translate(0, cy, -0.11);
    shell.deleteAttribute('uv');
    const root = XP.group('glass-crt', XP.mesh(body, XP.lit({ roughness: 0.35, metalness: 0.15 }), 'monitor'),
      XP.mesh(shell, new T.MeshStandardMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.24, roughness: 0.05, metalness: 0.1, depthWrite: false }), 'glass'),
      XP.mesh(new T.SphereGeometry(0.016, 10, 8).translate(0, cy, -0.255), new T.MeshBasicMaterial({ color: 0xff9a3c }), 'glow'));
    const scr = picture(0.36, 0.27, 384, (g, W, H) => { XP.hill(g, 0, 0, W, H, { seed: 45, clouds: 3 }); const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,20,0.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H); }, 'screen');
    scr.position.set(0, cy, 0.0905); root.add(scr);
    return { root };
  } });

  XP.part('duck', { file: 'models/duck.glb', build() {
    // a rubber duck, about 22 cm long, sitting on the floor and looking your way (+z)
    const yel = '#ffd21f', parts = [];
    const body = XP.sphere(0.1, 24, 16); body.scale(0.95, 0.68, 1.15); parts.push(S(body, yel, M(0, 0.07, -0.01)));
    const tail = new T.ConeGeometry(0.035, 0.07, 12); tail.rotateX(-2.2); parts.push(S(tail, yel, M(0, 0.12, -0.12)));
    const head = XP.sphere(0.062, 20, 14); parts.push(S(head, yel, M(0, 0.165, 0.06)));
    for (const sx of [-1, 1]) { const wg = XP.sphere(0.05, 14, 10); wg.scale(0.35, 0.6, 1); parts.push(S(wg, '#f6c400', M(sx * 0.088, 0.085, -0.02, 0, 0, sx * 0.2))); parts.push(S(XP.sphere(0.011, 10, 8), '#111111', M(sx * 0.03, 0.185, 0.11))); parts.push(S(XP.sphere(0.004, 6, 4), '#ffffff', M(sx * 0.033, 0.19, 0.12))); }
    const beak = XP.sphere(0.03, 16, 10); beak.scale(1.1, 0.35, 1); parts.push(S(beak, '#ff8a1a', M(0, 0.15, 0.115)));
    const beak2 = XP.sphere(0.026, 14, 8); beak2.scale(1, 0.3, 0.9); parts.push(S(beak2, '#f07a10', M(0, 0.138, 0.11)));
    return { root: XP.group('duck', XP.mesh(XP.merge(parts, { noUV: true }), XP.lit({ roughness: 0.3 }), 'duck')) };
  } });
})();
