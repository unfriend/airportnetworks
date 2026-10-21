// STUB for engine tests only (MICRO_STUBS=1 node tools/micro/build.mjs), until tools/micro/sets/atlas.js exists:
// the slide library, the atlas of 40 sections, the tile cloud, the volcano and the curves as simple shapes with the
// spec's params, anchors, labels, cam views, controls, explore(c) and api().
SETS.atlas = function (K) {
  const { THREE, prog } = K, set = K.newSet('atlas');
  const G = MICRO_DATA.graph, N = G.nodes;
  // the 40 tissues: GTEx's tissue names, an organ standing for itself where it has only one
  const hasT = new Set();
  for (const [a, b] of G.edges) if (N[a][1] === 0 && N[b][1] === 1) hasT.add(a);
  const TIS = N.map((n, i) => (n[1] === 1 || (n[1] === 0 && !hasT.has(i)) ? n[0] : null)).filter(Boolean).sort();
  const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const domainColour = n => new THREE.Color().setHSL((hue(n) % 360) / 360, 0.65, 0.6).getStyle();
  // the library: one point per slide column and age row
  const lib = K.pointsGeo(40 * 12), lp = lib.attributes.position.array, lc = lib.attributes.aCol.array, ls = lib.attributes.aSize.array;
  for (let i = 0; i < 40 * 12; i++) { const c = i % 40, r = Math.floor(i / 40), a = (c / 39 - 0.5) * 1.6; lp.set([2 * Math.sin(a), -0.6 + r * 0.11, 2 - 2 * Math.cos(a)], 3 * i); lc.set([0.95, 0.6, 0.75], 3 * i); ls[i] = 0.05; }
  const libP = new THREE.Points(lib, K.points(set)); set.group.add(libP);
  // the atlas: a disc per tissue on a grid
  const discs = TIS.map((t, i) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.11, 28), K.fade(set, new THREE.MeshBasicMaterial({ color: domainColour(t), depthWrite: false }), 0.85));
    m.userData.home = [((i % 8) - 3.5) * 0.3, (2 - Math.floor(i / 8)) * 0.3, 0.4]; set.group.add(m); return m;
  });
  // the tile cloud
  const NU = 3000, um = K.pointsGeo(NU), up = um.attributes.position.array, uc = um.attributes.aCol.array, us = um.attributes.aSize.array, r = K.rng(5);
  for (let i = 0; i < NU; i++) { const c = i % 12, a = c / 12 * 6.283; up.set([0.6 * Math.cos(a) + K.gauss(r) * 0.08, 0.2 + K.gauss(r) * 0.08 + (c % 3) * 0.1, 0.6 + 0.6 * Math.sin(a) + K.gauss(r) * 0.08], 3 * i); uc.set(K.rgb(domainColour('c' + c)), 3 * i); us[i] = 0.02; }
  const umP = new THREE.Points(um, K.points(set)); set.group.add(umP);
  // the volcano: bubbles over x (change per decade) and y (-log10 p)
  const vo = K.pointsGeo(60), vp = vo.attributes.position.array, vc = vo.attributes.aCol.array, vs = vo.attributes.aSize.array;
  for (let i = 0; i < 60; i++) { const x = K.gauss(r) * 0.3, y = Math.abs(x) * 1.2 + r() * 0.2; vp.set([x, y - 0.3, 0.5], 3 * i); vc.set(y > 0.3 ? [1, 0.7, 0.3] : [0.5, 0.55, 0.65], 3 * i); vs[i] = 0.04; }
  const voP = new THREE.Points(vo, K.points(set)); set.group.add(voP);
  // the curves: three examples and two pathology trajectories over age
  const cg = K.linesGeo(5 * 20), cp = cg.attributes.position.array, cc = cg.attributes.aCol.array;
  for (let j = 0; j < 5; j++) for (let i = 0; i < 20; i++) { const f = (x => -0.4 + 0.15 * j + 0.3 * Math.pow(x, 1 + j)); const k = j * 20 + i; cp.set([-0.6 + 1.2 * i / 20, f(i / 20), 0.5, -0.6 + 1.2 * (i + 1) / 20, f((i + 1) / 20), 0.5], 6 * k); cc.set([1, 0.5 + 0.1 * j, 0.6, 1, 0.5 + 0.1 * j, 0.6], 6 * k); }
  const curves = new THREE.LineSegments(cg, K.lines(set)); set.group.add(curves);
  let focus = 0;
  const anchors = { library: [0, 0.75, 0], atlas: [0, 0.8, 0.4], umap: [0, 0.6, 0.6], volcano: [0, 0.6, 0.5], curves: [0, 0.4, 0.5],
    focus: () => (focus > 0 ? [0, 0.32, 0.9] : [0, 0, 0.4]), ex0: [0.35, 0.4, 0.5], ex1: [-0.2, 0.1, 0.5], ex2: [-0.4, 0.45, 0.5] };
  return Object.assign(set, {
    params: { atlas_a: 1, atlas_lib: 0, atlas_map: 0, atlas_umap: 0, atlas_focus: 0, atlas_age: 0, atlas_volcano: 0, atlas_curves: 0 },
    update(S) {
      libP.visible = S.atlas_lib > 0.01; libP.material.uniforms.uA.value = S.atlas_lib * S.atlas_a;
      focus = Math.round(S.atlas_focus);
      discs.forEach((m, i) => {
        const f = focus === i + 1, h = m.userData.home;
        m.visible = S.atlas_map > 0.01;
        m.position.set(f ? 0 : h[0], f ? 0 : h[1], f ? 0.9 : h[2]); m.scale.setScalar(f ? 3 * (1 - 0.15 * S.atlas_age) : 1);
        m.material.opacity = 0.85 * S.atlas_map * S.atlas_a * (focus && !f ? 0.2 : 1);
      });
      umP.visible = S.atlas_umap > 0.01; umP.material.uniforms.uA.value = S.atlas_umap * S.atlas_a;
      voP.visible = S.atlas_volcano > 0.01; voP.material.uniforms.uA.value = S.atlas_volcano * S.atlas_a;
      curves.visible = S.atlas_curves > 0.01; curves.material.uniforms.uA.value = S.atlas_curves * S.atlas_a;
    },
    anchors,
    labels: [
      { text: ['24,945 slides', ''], at: 'library', alpha: S => prog(S.atlas_lib, 0.6, 1) * (1 - prog(S.atlas_map, 0, 0.3)) },
      { text: ['162 million tiles', '218 domains'], at: 'umap', alpha: S => prog(S.atlas_umap, 0.6, 1) },
      { text: ['28 % of domains', 'change with age'], at: 'volcano', cls: 'amb', alpha: S => prog(S.atlas_volcano, 0.6, 1) },
      { text: ['Corpus albicans', 'ovary'], at: 'ex0', alpha: S => prog(S.atlas_volcano, 0.6, 1) },
    ],
    cam: { default: [0, 8, 4.6, 0, 0, 0.4], library: [0, 8, 4.6, 0, 0, 0.4], atlas: [0, 5, 3.2, 0, 0, 0.4], umap: [20, 12, 2.6, 0, 0.3, 0.6],
      focus: [0, 4, 1.5, 0, 0, 0.9], volcano: [0, 4, 2.4, 0, 0.1, 0.5], curves: [0, 4, 2.2, 0, 0, 0.5] },
    controls: [{ key: 'view', label: 'View', options: [['library', 'Library'], ['atlas', 'Atlas'], ['umap', 'Tiles'], ['volcano', 'Age'], ['curves', 'Pathology']] }],
    explore(c) {
      const v = c.view;
      return { atlas_lib: v === 'library' ? 1 : 0, atlas_map: v === 'atlas' ? 1 : 0, atlas_umap: v === 'umap' ? 1 : 0, atlas_volcano: v === 'volcano' ? 1 : 0, atlas_curves: v === 'curves' ? 1 : 0 };
    },
    api: () => ({
      tissues: TIS.slice(), domainColour,
      pick(rc) { const h = rc.intersectObjects(discs.filter(m => m.visible), false)[0]; return h ? discs.indexOf(h.object) : -1; },
    }),
  });
};
