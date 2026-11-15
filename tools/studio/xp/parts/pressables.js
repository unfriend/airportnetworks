// What anyone can press or pick up (v146): the red close button of a window and the Media Player's play and stop buttons
// (each a small part that stands 4 mm in front of the drawn one, its back at z = 0, clip Lift: pointed at, it comes 4 mm
// out), four playing cards (our own faces: the pips only, no people) and an old printed page, each with a ball of itself
// that it crumples into when it is dropped in the bin (clip Crumple). All our own drawings.
(function () {
  const T = THREE, r4 = v => Math.round(v * 1e4) / 1e4;
  // a geometry painted flat with its light baked in (as the windows' unlit faces have theirs): colour col, lit by which way it faces
  const tint = (geo, col, dim) => { const c = new T.Color(col).toArray(); return XP.paint(geo, (x, y, z, nx, ny, nz) => [0, 0, XP.shade(nx, ny, nz) * (dim && nz < 0.9 ? dim : 1), c]); };
  const lift = (node, z) => new T.AnimationClip('Lift', 0.15, [XP.vTrack(node, 'position', [0, 0.15], [[0, 0, 0], [0, 0, z]])]);

  // ---- the close button: XP's red one with its white X in relief; 3 cm across (the object is scaled to its window's)
  XP.part('close-button', { file: 'models/close-button.glb', view: { dir: [0.4, 0.5, 1] }, build() {
    const S0 = 0.03, back = tint(XP.rbox(S0, S0, 0.006, 0.005), '#d9482a');
    back.translate(0, 0, 0.003);
    const bar = a => { const g = XP.box(0.021, 0.0042, 0.002); g.rotateZ(a); g.translate(0, 0, 0.0065); return tint(g, '#ffffff'); };
    const geo = XP.merge([back, bar(Math.PI / 4), bar(-Math.PI / 4)], { noUV: true });
    return { root: XP.group('close-button', XP.group('lift', XP.mesh(geo, XP.flat(null), 'button'))), clips: [lift('lift', 0.004)] };
  } });

  // ---- the Media Player's round play (green, a dark triangle) and stop (pale blue, a dark square) buttons, 4 cm across
  const round = (name, file, col, glyph) => XP.part(name, { file, view: { dir: [0.4, 0.5, 1] }, build() {
    const disc = new T.CylinderGeometry(0.02, 0.02, 0.006, 28); disc.rotateX(Math.PI / 2); disc.translate(0, 0, 0.003);
    const parts = [tint(disc, col, 0.7)];
    let g;
    if (glyph === 'play') { const tri = new T.Shape(); tri.moveTo(-0.0062, -0.0125); tri.lineTo(0.0125, 0); tri.lineTo(-0.0062, 0.0125); tri.closePath(); g = new T.ExtrudeGeometry(tri, { depth: 0.002, bevelEnabled: false }).toNonIndexed(); g.computeVertexNormals(); }
    else g = XP.box(0.0145, 0.0145, 0.002);
    g.translate(0, 0, glyph === 'play' ? 0.006 : 0.007);
    parts.push(tint(g, '#14181f'));
    return { root: XP.group(name, XP.group('lift', XP.mesh(XP.merge(parts, { noUV: true }), XP.flat(null), 'button'))), clips: [lift('lift', 0.004)] };
  } });
  round('media-play', 'models/media-play.glb', '#7fd21f', 'play');
  round('media-stop', 'models/media-stop.glb', '#c4d3ee', 'stop');

  // ---- a crumpled ball of paper: a jittered icosahedron (the jitter a function of where a corner is, so the faces stay joined)
  const crumpled = (r, col) => {
    const g = new T.IcosahedronGeometry(r, 1), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), k = 0.78 + 0.22 * Math.sin(x / r * 5.3 + y / r * 3.1) * Math.cos(z / r * 4.7 - y / r * 2.3) + 0.12 * Math.sin((x + z) / r * 7.1); P.setXYZ(i, x * k, y * k, z * k); }
    g.computeVertexNormals();
    return XP.merge([XP.solid(g, col)], { noUV: true });
  };
  // the part's tree: root > flat (lying on its back) > sheet (what the clip squashes and twists), and the ball beside the flat,
  // at rest tiny; Crumple (0.8 s): the sheet squashes and twists to nothing as the ball grows, then the ball drops 4 cm
  const sheetPart = (name, file, size, sheet, ballR) => XP.part(name, { file, view: { dir: [0.25, 1, 0.55] }, build() {
    const flat = XP.group('flat', XP.group('sheet', sheet)); flat.rotation.x = -Math.PI / 2;
    const ball = XP.mesh(crumpled(ballR, '#f2f2ea'), XP.lit({ roughness: 0.9 }), 'ball'); ball.position.set(0, ballR * 0.85, 0); ball.scale.setScalar(0.001);
    const s1 = [1, 1, 1], tiny = [0.001, 0.001, 0.001], b0 = ball.position.toArray();
    const clip = new T.AnimationClip('Crumple', 0.8, [
      XP.vTrack('sheet', 'scale', [0, 0.15, 0.3, 0.45, 0.8], [s1, [0.75, 0.75, 1.5], [0.4, 0.4, 2], tiny, tiny]),
      XP.qTrack('sheet', [0, 0.1, 0.2, 0.3, 0.45], [[0, 0, 0], [0.25, 0, 0.5], [-0.3, 0.25, -0.45], [0.2, -0.2, 0.3], [0, 0, 0]]),
      XP.vTrack('ball', 'scale', [0, 0.25, 0.45, 0.8], [tiny, tiny, s1, s1]),
      XP.vTrack('ball', 'position', [0, 0.45, 0.8], [b0, b0, [b0[0], b0[1] - 0.04, b0[2]]]),
    ]);
    return { root: XP.group(name, flat, ball), clips: [clip] };
  } });

  // ---- a playing card: 9.5 x 13.3 cm (one and a half times life size), 1.5 mm thick, our own faces (pips only), a plain blue back
  const PIPS = { A: [[0.5, 0.5]], 3: [[0.5, 0.22], [0.5, 0.5], [0.5, 0.78]], 7: [[0.3, 0.22], [0.3, 0.5], [0.3, 0.78], [0.7, 0.22], [0.7, 0.5], [0.7, 0.78], [0.5, 0.36]],
    10: [[0.3, 0.2], [0.3, 0.4], [0.3, 0.6], [0.3, 0.8], [0.7, 0.2], [0.7, 0.4], [0.7, 0.6], [0.7, 0.8], [0.5, 0.3], [0.5, 0.7]] };
  const card = (name, file, rank, suit, col) => sheetPart(name, file, 0, (() => {
    const w = 0.095, h = 0.133, F = XP.face(w, h, 256, { back: '#1d4fcf' }), { g, W, fh } = F;
    g.fillStyle = '#fbfbf6'; g.fillRect(0, 0, W, fh);
    g.strokeStyle = '#2a2a2a'; g.lineWidth = 3; XP.rr(g, 4, 4, W - 8, fh - 8, 14); g.stroke();
    const idx = (flip) => { g.save(); if (flip) { g.translate(W, fh); g.rotate(Math.PI); } XP.text(g, rank, 24, 42, { size: 36, weight: 'bold', align: 'center', color: col }); XP.text(g, suit, 24, 80, { size: 32, align: 'center', color: col }); g.restore(); };
    idx(false); idx(true);
    const px = rank === 'A' ? W * 0.3 : W * 0.15;
    for (const [fx, fy] of PIPS[rank === 'A' ? 'A' : rank]) XP.text(g, suit, W * (0.15 + fx * 0.7), fh * (0.1 + fy * 0.8) + px * 0.35, { size: Math.round(px * 1.3), align: 'center', color: col });
    const geo = XP.slab(F, 0.0015, { r: [0.006, 0.006, 0.006, 0.006], bevel: 0.0004 });
    geo.translate(0, 0, -0.00075);
    return XP.mesh(geo, XP.flat(XP.tex(F.cv)), 'card');
  })(), 0.034);
  card('card-hearts', 'models/card-hearts.glb', 'A', '♥', '#d01010');
  card('card-spades', 'models/card-spades.glb', '7', '♠', '#111111');
  card('card-diamonds', 'models/card-diamonds.glb', '3', '♦', '#d01010');
  card('card-clubs', 'models/card-clubs.glb', '10', '♣', '#111111');

  // ---- an old printed page: A4, slightly curled, our own short lines
  sheetPart('paper-draft', 'models/paper-draft.glb', 0, (() => {
    const w = 0.21, h = 0.297, F = XP.face(w, h, 512, { back: '#e4e4dc' }), { g, W, fh } = F;
    g.fillStyle = '#fbfbf6'; g.fillRect(0, 0, W, fh);
    XP.text(g, 'plans for today', 46, 88, { size: 40, weight: 'bold', font: XP.F.mono, color: '#222' });
    g.fillStyle = '#222'; g.fillRect(46, 104, W - 92, 3);
    ['1. close all windows', '2. find the door', '3. go outside', '4. touch the grass', '5. stay a while', '', '(draft 3)'].forEach((t, i) => XP.text(g, t, 46, 170 + i * 56, { size: 30, font: XP.F.mono, color: i === 6 ? '#888' : '#333', max: W - 92 }));
    const geo = new T.PlaneGeometry(w, h, 10, 14);
    const P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) P.setZ(i, 0.012 * (P.getX(i) / (w / 2)) ** 2);
    geo.computeVertexNormals();
    XP.paint(geo, (x, y) => [...F.uv(x, y), 1]);
    return XP.mesh(geo, XP.flat(XP.tex(F.cv), { side: T.DoubleSide }), 'page');
  })(), 0.05);
})();
