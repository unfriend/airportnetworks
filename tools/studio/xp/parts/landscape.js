// For VR: the Bliss landscape (a large rolling hill round the room under a sky dome with painted clouds) and the
// starfield you fly through. Both painted in code: the hill's light baked into its corners, the sky on a canvas.
(function () {
  const T = THREE;
  const sm = (a, b, x) => { const t = XP.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // the ground's height (m) at x, z: flat where the room is, the big hill ahead (-z), softer ones round it, rising far off
  // to meet the sky's painted horizon
  const height = (x, z) => {
    const r = Math.hypot(x, z), e = (a, b, sx, sz) => Math.exp(-((x - a) ** 2 / sx + (z - b) ** 2 / sz));
    const hill = 7.5 * e(-3, -30, 520, 190) + 3.2 * e(28, -6, 240, 320) + 4.2 * e(-30, 8, 300, 380) + 2.6 * e(8, 32, 320, 260) + 1.6 * e(14, -18, 90, 120);
    const ripple = 0.4 * Math.sin(x * 0.19 + 1.3) * Math.sin(z * 0.16 + 0.4) + 0.22 * Math.sin(x * 0.47 + 2) * Math.cos(z * 0.41);
    return 0.008 + sm(3.4, 10, r) * Math.max(0, hill + ripple * sm(6, 14, r)) + 5 * sm(34, 56, r);
  };
  XP.part('landscape', { file: 'models/landscape.glb', view: { cam: [[0, 1.7, 6], [0, 3, -30], 70] }, build() {
    const R = XP.rng(41), NR = 40, NS = 72, RMAX = 58, P = [], C = [], I = [];
    const sun = new T.Vector3(0.45, 0.8, 0.4).normalize(), n = new T.Vector3();
    const light = new T.Color('#b9e34e'), mid = new T.Color('#5fa82c'), deep = new T.Color('#2a6418'), haze = new T.Color('#9cc3e8'), c = new T.Color();
    const shadow = [[6, -20, 7], [-14, -9, 6], [20, 12, 8]];   // (cloud shadows: x, z, radius)
    const colourAt = (x, z, y) => {
      const e = 0.6, nx = height(x - e, z) - height(x + e, z), nz = height(x, z - e) - height(x, z + e);
      n.set(nx, 2 * e, nz).normalize();
      const lit = XP.clamp(0.55 + 0.6 * n.dot(sun), 0.45, 1.12), t = XP.clamp(y / 7, 0, 1), r = Math.hypot(x, z);
      c.copy(deep).lerp(mid, XP.clamp(0.35 + n.y * 0.4 + t * 0.4, 0, 1)).lerp(light, XP.clamp((lit - 0.85) * 1.6 + t * 0.35, 0, 0.8));
      const stripe = 0.94 + 0.06 * Math.sin((x * 0.9 + z * 0.35) + Math.sin(z * 0.2) * 3);
      let k = lit * stripe * (0.96 + R() * 0.08);
      for (const [sx, sz, sr] of shadow) k *= 1 - 0.28 * Math.exp(-((x - sx) ** 2 + (z - sz) ** 2) / (sr * sr));
      c.multiplyScalar(k).lerp(haze, XP.clamp((r - 18) / 50, 0, 0.55));
      return c.toArray();
    };
    P.push(0, height(0, 0), 0); C.push(...colourAt(0, 0, 0));
    for (let i = 1; i <= NR; i++) {
      const r = RMAX * (i / NR) ** 1.7;
      for (let j = 0; j < NS; j++) {
        const a = j / NS * Math.PI * 2 + (i % 2) * Math.PI / NS, x = Math.sin(a) * r, z = -Math.cos(a) * r, y = height(x, z);
        P.push(x, y, z); C.push(...colourAt(x, z, y));
      }
    }
    for (let j = 0; j < NS; j++) I.push(0, 1 + ((j + 1) % NS), 1 + j);   // (wound to face up)
    for (let i = 1; i < NR; i++) for (let j = 0; j < NS; j++) {
      const a = 1 + (i - 1) * NS + j, b = 1 + (i - 1) * NS + (j + 1) % NS, c2 = 1 + i * NS + j, d = 1 + i * NS + (j + 1) % NS;
      I.push(a, b, c2, b, d, c2);
    }
    const ground = new T.BufferGeometry();
    ground.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    ground.setAttribute('color', new T.Float32BufferAttribute(C, 3));
    ground.setIndex(I);
    // the sky: a dome turned inside out, a painted sky on it (the zenith at its top, the horizon near its foot)
    const { cv, g } = XP.canvas(1024, 512), W = 1024, H = 512, hz = H * (1 - (1 - 0.5 / 0.56));
    g.fillStyle = XP.grad(g, 0, 0, 0, H, [[0, '#123f9e'], [0.35, '#2f6fd4'], [0.7, '#78acec'], [hz / H - 0.01, '#c8e2f8'], [hz / H + 0.01, '#a9cbe0'], [1, '#86ad9a']]);
    g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W * 0.3, hz * 0.55, 0, W * 0.3, hz * 0.55, W * 0.18); glow.addColorStop(0, 'rgba(255,253,235,0.55)'); glow.addColorStop(1, 'rgba(255,253,235,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    const RC = XP.rng(5);
    for (let i = 0; i < 26; i++) {   // clouds, lower ones larger and flatter (perspective), drawn again across the seam
      const y = hz * (0.25 + RC() * 0.68), k = y / hz, cw = W * (0.04 + RC() * 0.07) * (0.6 + k), x = RC() * W;
      for (const dx of [-W, 0, W]) XP.cloud(g, x + dx, y, cw, cw * (0.5 - k * 0.22), XP.rng(100 + i), {});
    }
    const sky = new T.SphereGeometry(62, 48, 18, 0, Math.PI * 2, 0, Math.PI * 0.56);
    sky.scale(-1, 1, 1);   // (inside out: seen from within, without a back side, which a glTF material cannot say)
    sky.deleteAttribute('normal');
    const skyMesh = XP.mesh(sky, new T.MeshBasicMaterial({ map: XP.tex(cv) }), 'sky');
    const root = XP.group('landscape', XP.mesh(ground, XP.flat(null), 'hill'), skyMesh);
    return { root };
  } });

  // ---- the starfield: three layers of one field of small stars flying towards you, round your eyes (clip Fly)
  XP.part('starfield', { file: 'models/starfield.glb', view: { cam: [[0.3, 1.5, 2.5], [0, 1.6, -10], 75] }, build() {
    const R = XP.rng(77), N = 260, D = 14, Pp = [], Cc = [];
    for (let i = 0; i < N; i++) {
      const a = R() * Math.PI * 2, r = 0.9 + 11 * R() ** 1.6, x = Math.cos(a) * r, y = Math.sin(a) * r * 0.75, z = -R() * D, s = 0.025 + 0.05 * R() + r * 0.006;
      // a small four-pointed star facing you (two triangles), both sides drawn
      const pts = [[0, s], [-s * 0.28, 0], [s * 0.28, 0], [0, -s], [-s, 0], [0, s * 0.28], [0, -s * 0.28], [s, 0]];
      for (const [p, q, w] of [[0, 1, 2], [3, 2, 1], [4, 6, 5], [7, 5, 6]]) for (const k of [p, q, w]) { Pp.push(x + pts[k][0], y + pts[k][1], z); }
      const b = 0.75 + R() * 0.25, tint = R();
      for (let k = 0; k < 12; k++) Cc.push(b * (tint < 0.2 ? 0.8 : 1), b * (tint < 0.2 ? 0.88 : 0.97), b);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(Pp, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(Cc, 3));
    const mat = new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide });
    const root = XP.group('starfield'), Per = 5, tracks = [];
    for (let k = 0; k < 3; k++) {
      const m = XP.mesh(geo, mat, 'layer' + k); m.position.set(0, 1.6, -k * D); root.add(m);
      tracks.push(XP.vTrack('layer' + k, 'position', [0, Per], [[0, 1.6, -k * D], [0, 1.6, -k * D + D]]));
    }
    return { root, clips: [new T.AnimationClip('Fly', Per, tracks)] };
  } });
})();
