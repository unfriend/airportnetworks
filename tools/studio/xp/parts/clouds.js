// Puffy 3D clouds, three kinds: soft balls flattened underneath, white above and a cool grey-blue below (unlit, their
// light baked into their corners). They drift on the studio's motions (layout.json), not on clips of their own.
(function () {
  const T = THREE;
  const cloud = (name, seed, w, puffs) => {
    const R = XP.rng(seed), parts = [], top = new T.Color('#ffffff'), belly = new T.Color('#b4c6df'), c = new T.Color();
    for (let i = 0; i < puffs; i++) {
      const t = puffs === 1 ? 0.5 : i / (puffs - 1), r = w * (0.12 + 0.12 * Math.sin(t * Math.PI) + R() * 0.05);
      const x = (t - 0.5) * w * 0.8 + (R() - 0.5) * w * 0.08, y = r * (0.3 + R() * 0.3) + Math.sin(t * Math.PI) * w * 0.06, z = (R() - 0.5) * w * 0.25;
      const g = new T.IcosahedronGeometry(r, 2);
      const P = g.attributes.position;
      for (let k = 0; k < P.count; k++) { const yy = P.getY(k) + y; if (yy < w * 0.03) P.setY(k, w * 0.03 - y + (yy - w * 0.03) * 0.25); }
      g.translate(x, y, z);
      parts.push(g);
    }
    // a few small ones on top, for a lumpy crown
    for (let i = 0; i < Math.round(puffs / 2); i++) {
      const g = new T.IcosahedronGeometry(w * (0.07 + R() * 0.05), 1);
      g.translate((R() - 0.5) * w * 0.5, w * (0.25 + R() * 0.08), (R() - 0.5) * w * 0.15);
      parts.push(g);
    }
    const geo = XP.merge(parts.map(g => { g.deleteAttribute('uv'); g.deleteAttribute('normal'); return g; }), { smooth: true, noUV: true });
    parts.forEach(g => g.dispose());
    // their light baked in (bright from any side, as clouds over the hill are): white where they face up and the sun, a
    // soft grey-blue underneath; unlit, so a room's lights never turn them into storm clouds from below
    const P = geo.attributes.position, N = geo.attributes.normal, col = new Float32Array(P.count * 3), sun = new T.Vector3(0.4, 0.85, 0.35).normalize(), n = new T.Vector3();
    for (let k = 0; k < P.count; k++) {
      n.fromBufferAttribute(N, k);
      const up = XP.clamp(n.y * 0.5 + 0.5, 0, 1), lit = 0.86 + 0.14 * Math.max(0, n.dot(sun)), h = XP.clamp(P.getY(k) / (w * 0.25), 0, 1);
      c.copy(belly).lerp(top, XP.clamp(up * 0.75 + h * 0.4, 0, 1)).multiplyScalar(lit).toArray(col, k * 3);
    }
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    geo.deleteAttribute('normal');
    return { root: XP.group(name, XP.mesh(geo, XP.flat(null), 'cloud')) };
  };
  XP.part('cloud-a', { file: 'models/cloud-a.glb', build: () => cloud('cloud', 101, 1.2, 7) });
  XP.part('cloud-b', { file: 'models/cloud-b.glb', build: () => cloud('cloud', 202, 0.85, 5) });
  XP.part('cloud-c', { file: 'models/cloud-c.glb', build: () => cloud('cloud', 303, 1.6, 9) });
})();
