// The Solitaire win: the green felt on the wall, the four aces up top, and four trails of cards bouncing out of it in
// 3D arcs down to the floor and into the room, a card running along each (clip Win). Our own card faces.
(function () {
  const T = THREE;
  XP.part('solitaire', { file: 'models/solitaire.glb', view: { dir: [0.9, 0.35, 1] }, build() {
    const w = 1.0, h = 0.72, F = XP.face(w, h, 1024, { back: '#0a4a0a' }), { g, W, fh } = F;
    const FLOOR = -1.0;   // (the felt's middle stands 1 m over the floor: the cards bounce on it)
    // the felt
    g.fillStyle = '#0a7d0a'; g.fillRect(0, 0, W, fh);
    const vg = g.createRadialGradient(W / 2, fh / 2, fh * 0.2, W / 2, fh / 2, W * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,30,0,0.45)'); g.fillStyle = vg; g.fillRect(0, 0, W, fh);
    g.strokeStyle = '#d8c48a'; g.lineWidth = 10; g.strokeRect(5, 5, W - 10, fh - 10);
    const cw = W * 0.09, ch = cw * 1.4, suits = [['♠', '#000'], ['♥', '#d01010'], ['♦', '#d01010'], ['♣', '#000']], aces = [];
    const card = (x, y, suit, col, rank) => {
      g.fillStyle = '#fff'; XP.rr(g, x, y, cw, ch, cw * 0.08); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 2; g.stroke();
      XP.text(g, rank, x + cw * 0.1, y + ch * 0.18, { size: Math.round(cw * 0.22), weight: 'bold', color: col });
      XP.text(g, suit, x + cw * 0.12, y + ch * 0.32, { size: Math.round(cw * 0.2), color: col });
      XP.text(g, suit, x + cw / 2, y + ch * 0.66, { size: Math.round(cw * 0.6), align: 'center', color: col });
    };
    suits.forEach(([s, col], i) => { const x = W * 0.42 + i * cw * 1.25, y = fh * 0.07; card(x, y, s, col, 'A'); aces.push([x, y]); });
    // the deck's back (our own pattern: a little hill on blue) and the empty places
    const bx = W * 0.05, by = fh * 0.07;
    g.fillStyle = '#1d4fcf'; XP.rr(g, bx, by, cw, ch, cw * 0.08); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); XP.emblem(g, bx + cw * 0.18, by + ch * 0.3, cw * 0.64);
    for (let i = 0; i < 7; i++) { g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2; XP.rr(g, W * 0.05 + i * cw * 1.25, fh * 0.42, cw, ch, cw * 0.08); g.stroke(); }
    XP.text(g, 'Score: 2001   Time: 61', W - 20, fh - 18, { size: Math.round(fh * 0.035), align: 'right', color: '#cfe8cf' });
    // (the felt and every copy of a card: one mesh, one picture)
    const parts = [XP.slab(F, 0.025, { r: [0.01, 0.01, 0.01, 0.01] })];
    const cwm = cw / W * w, chm = ch / fh * h;
    const cardGeo = (u0, v0, u1, v1) => {
      const P = [], U = [], C = [], hw = cwm / 2, hh = chm / 2;
      const put = (x, y, z, u, v, k) => { P.push(x, y, z); U.push(u, v); C.push(k, k, k); };
      // front (+z), then back (-z) mirrored so its picture reads the right way round from behind
      for (const [x, y, u, v] of [[-hw, -hh, u0, v0], [hw, -hh, u1, v0], [hw, hh, u1, v1], [-hw, -hh, u0, v0], [hw, hh, u1, v1], [-hw, hh, u0, v1]]) put(x, y, 0.001, u, v, 1);
      for (const [x, y, u, v] of [[hw, -hh, u0, v0], [-hw, -hh, u1, v0], [-hw, hh, u1, v1], [hw, -hh, u0, v0], [-hw, hh, u1, v1], [hw, hh, u0, v1]]) put(x, y, -0.001, u, v, 0.8);
      const q = new T.BufferGeometry(); q.setAttribute('position', new T.Float32BufferAttribute(P, 3)); q.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); q.setAttribute('color', new T.Float32BufferAttribute(C, 3)); q.computeVertexNormals();
      return q;
    };
    const paths = [], R = XP.rng(17);
    aces.forEach(([x, y], i) => {
      const [u0, v1] = [x / W, 1 - y / F.H], [u1, v0] = [(x + cw) / W, 1 - (y + ch) / F.H];
      const geo = cardGeo(u0, v0, u1, v1), [px, py] = F.px(x + cw / 2, y + ch / 2);
      // a bouncing flight: out of the felt and sideways, falling, bouncing on the floor, losing height each time
      const pts = []; let X = px, Y = py, Z = 0.04, vx = (i < 2 ? -1 : 1) * (0.25 + R() * 0.25), vy = 0.2 + R() * 0.3, vz = 0.35 + R() * 0.2;
      for (let k = 0; k < 120 && pts.length < 70; k++) {
        const dt = 0.03; vy -= 3.2 * dt; X += vx * dt; Y += vy * dt; Z += vz * dt;
        if (Y < FLOOR + chm / 2) { Y = FLOOR + chm / 2; vy = Math.abs(vy) * 0.78; }
        pts.push([X, Y, Z]);
      }
      paths.push({ pts, geo });
      // the trail: a copy every other step, the newest in front
      pts.forEach((p, k) => { if (k % 2 === 0) parts.push({ geo, m: new T.Matrix4().makeTranslation(p[0], p[1], p[2]) }); });
    });
    const mat = XP.flat(XP.tex(F.cv), { side: T.FrontSide });
    const geo = XP.merge(parts); parts.forEach(p => (p.isBufferGeometry ? p.dispose() : 0));
    const root = XP.group('solitaire', XP.mesh(geo, mat, 'felt'));
    // the four running cards (clip Win: each along its trail, then from the felt again)
    const tracks = [], P = 2.4;
    paths.forEach(({ pts, geo: cg }, i) => {
      const name = 'card' + i, m = XP.mesh(cg, mat, name); m.position.set(...pts[0]); root.add(m);
      const ts = pts.map((_, k) => +(k / (pts.length - 1) * (P - 0.05)).toFixed(4)).concat([P]);
      tracks.push(XP.vTrack(name, 'position', ts, pts.concat([pts[0]])));
      tracks.push(XP.vTrack(name, 'scale', [0, 0.04, P - 0.06, P - 0.03, P], [[0.01, 0.01, 0.01], [1, 1, 1], [1, 1, 1], [0.01, 0.01, 0.01], [0.01, 0.01, 0.01]]));
    });
    return { root, clips: [new T.AnimationClip('Win', P, tracks)] };
  } });
})();
