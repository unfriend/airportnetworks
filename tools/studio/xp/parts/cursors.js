// The cursors: the giant mouse arrow (white with a black bevelled edge, both sides alike; it leans forward to fly
// where you go), the pointing hand, and the hourglass with its sand (clip Flip). Unlit with their light baked in, but
// the hourglass, which is lit glass, wood and sand.
(function () {
  const T = THREE;
  // an outline extruded twice: a black body whose bevel reaches out past it, and a white face on each side
  const cursor = (pts, unit, o = {}) => {
    const sh = new T.Shape(pts.map(([x, y]) => new T.Vector2(x * unit, y * unit)));
    const dark = [0.06, 0.06, 0.07], white = [1, 1, 1];
    const edge = XP.extrude(sh, o.d || 0.05, o.edge || 0.012, (x, y, z, nx, ny, nz) => [0, 0, XP.shade(nx, ny, Math.abs(nz)), dark], { bevelSize: o.edge || 0.012, seg: 2 });
    edge.translate(0, 0, -(o.d || 0.05) / 2);
    const face = XP.extrude(sh, (o.d || 0.05) + 0.012, 0.004, (x, y, z, nx, ny, nz) => [0, 0, Math.abs(nz) > 0.9 ? 1 : 0.7, Math.abs(nz) > 0.9 ? white : dark], { bevelSize: 0.0015, seg: 1 });
    face.translate(0, 0, -((o.d || 0.05) + 0.012) / 2);
    const geo = XP.merge([edge, face], { bare: true }); edge.dispose(); face.dispose();
    return geo;
  };
  XP.part('cursor-arrow', { file: 'models/cursor-arrow.glb', view: { dir: [1, 0.4, 0.6] }, build() {
    const pts = [[0, 0], [0, -16], [3.8, -12.4], [6.7, -18.8], [9.4, -17.6], [6.6, -11.4], [11.4, -11.4]];
    const geo = cursor(pts, 0.7 / 19, { d: 0.045, edge: 0.014 });
    geo.translate(-0.12, 0.33, 0);   // (its middle near the origin)
    const m = XP.mesh(geo, XP.flat(null), 'arrow');
    // flying: its tip leaning forward (where its front, +z, points) and a little up
    const fly = XP.group('fly', m); fly.rotation.set(-1.05, 0, 0);
    return { root: XP.group('cursor-arrow', fly) };
  } });
  XP.part('cursor-hand', { file: 'models/cursor-hand.glb', build() {
    const pts = [[-1.1, 0.2], [-0.6, 0.6], [0.6, 0.6], [1.1, 0.2], [1.1, -6], [2.2, -6.1], [3, -6.6], [3.9, -6.6], [4.6, -7.1], [5.6, -7.2], [6.3, -7.7], [6.6, -8.6], [6.6, -12], [5.6, -15.2], [-0.6, -15.2], [-2.4, -13.2], [-4.6, -10.4], [-5, -9.4], [-4.4, -8.7], [-3.4, -8.8], [-1.1, -10.6]];
    const geo = cursor(pts, 0.36 / 16, { d: 0.035, edge: 0.01 });
    geo.translate(-0.01, 0.17, 0);
    return { root: XP.group('cursor-hand', XP.mesh(geo, XP.flat(null), 'hand')) };
  } });

  XP.part('hourglass', { file: 'models/hourglass.glb', build() {
    // the glass: a lathe of two bulbs, see-through (small); the frame: two discs and three posts; sand above and below
    const prof = []; for (let i = 0; i <= 20; i++) { const t = i / 20, y = -0.11 + t * 0.22, r = 0.012 + 0.058 * Math.pow(Math.abs(Math.sin(t * Math.PI)), 0.8) * (1 - 0.15 * Math.cos(t * Math.PI * 2)); prof.push(new T.Vector2(r, y)); }
    const glass = new T.LatheGeometry(prof, 20);
    const wood = [], R = 0.075;
    for (const y of [-0.122, 0.122]) wood.push(XP.solid(XP.cyl(R, R, 0.018, 24), '#8a5a2b', XP.at(null, 0, y, 0).m));
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; wood.push(XP.solid(XP.cyl(0.006, 0.006, 0.23, 8), '#6d4521', XP.at(null, Math.cos(a) * R * 0.86, 0, Math.sin(a) * R * 0.86).m)); }
    const frame = XP.merge(wood, { noUV: true });
    const sandGeo = (up) => { const g = new T.ConeGeometry(0.048, 0.07, 18); if (up) g.rotateX(Math.PI); return g; };
    const sandM = XP.lit({ vertexColors: false, color: 0xe8b04a, roughness: 0.9 });
    const top = XP.mesh(sandGeo(true), sandM, 'sandTop'), bot = XP.mesh(sandGeo(false), sandM, 'sandBottom');
    const topG = XP.group('topPivot', top), botG = XP.group('bottomPivot', bot);
    top.position.y = 0.035; topG.position.y = 0.012; bot.position.y = 0.035; botG.position.y = -0.105;   // (each scales about where its sand rests)
    const body = XP.group('glassBody', XP.mesh(frame, XP.lit({ roughness: 0.5 }), 'frame'), XP.mesh(glass, new T.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, depthWrite: false }), 'glass'), topG, botG);
    // Flip: sand runs down, it turns over, runs down again, turns over again (back where it began)
    const ts = [0, 1.6, 2.0, 3.6, 4.0], s = (a) => [a, a, a];
    const tracks = [
      XP.qTrack('glassBody', [0, 1.6, 2.0, 3.6, 4.0], [[0, 0, 0], [0, 0, 0], [0, 0, Math.PI], [0, 0, Math.PI], [0, 0, Math.PI * 2 - 1e-4]]),
      XP.vTrack('topPivot', 'scale', ts, [s(1), s(0.15), s(0.15), s(1), s(1)]),
      XP.vTrack('bottomPivot', 'scale', ts, [s(0.15), s(1), s(1), s(0.15), s(0.15)]),
    ];
    return { root: XP.group('hourglass', body), clips: [new T.AnimationClip('Flip', 4, tracks)] };
  } });
})();
