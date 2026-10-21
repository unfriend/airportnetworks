// STUB of the liver set (tools/pet/SPEC.md), for engine work before the real set exists.
SETS.liver = function (K) {
  const { THREE } = K, set = K.newSet('liver'), n = 3000, g = K.pointsGeo(n), r = K.rng(3), P = g.attributes.position.array;
  for (let i = 0; i < n; i++) { const p = K.unit(r), s = Math.cbrt(r()); P.set([p[0] * s * 0.8, p[1] * s * 0.35, p[2] * s * 0.45], 3 * i); g.attributes.aCol.array.set([1, 0.5 + 0.3 * r(), 0.2], 3 * i); g.attributes.aSize.array[i] = 0.02; }
  const pts = new THREE.Points(g, K.points(set)); set.group.add(pts);
  return Object.assign(set, {
    params: { liver_a: 1, liver_grow: 1, liver_links: 0, liver_top: 0, liver_spin: 0 },
    update(S, t) { pts.scale.setScalar(0.2 + 0.8 * S.liver_grow); pts.rotation.y = S.liver_spin * Math.PI * 2; },
    anchors: { centre: [0, 0, 0], top: [0, 0.35, 0] },
    labels: [{ text: ['3,000 patches', ''], at: 'top', alpha: S => K.prog(S.liver_grow, 0.8, 1) * (1 - S.liver_links) }],
    cam: { default: [20, 15, 3.4, 0, 0, 0], close: [30, 10, 1.6, 0.2, 0, 0] },
    controls: [{ key: 'view', label: 'View', options: [['patches', 'Patches'], ['links', 'Links'], ['hubs', 'Hubs']] }],
    explore(c) { return { liver_grow: 1, liver_links: c.view === 'patches' ? 0 : 1, liver_top: c.view === 'hubs' ? 1 : 0, liver_spin: c.t * 0.02 }; },
  });
};
