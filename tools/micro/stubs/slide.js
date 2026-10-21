// STUB for engine tests only (MICRO_STUBS=1 node tools/micro/build.mjs), until tools/micro/sets/slide.js exists:
// simple shapes in the tour's tissue set's frame (a slab about 2.1 long and 0.6 deep facing +z, mucosa on top) with
// the spec's params, anchors, labels, cam views, controls, explore(c) and api().
SETS.slide = function (K) {
  const { THREE, prog, clamp } = K, set = K.newSet('slide');
  const DOM = ['mucosa', 'submucosa', 'muscularis inner', 'muscularis outer', 'lymphoid', 'blood vessels'];
  const PAL = ['#c77dff', '#ffd166', '#4d94ff', '#2d6cdf', '#ff5a4b', '#ff8fab'];
  const domainColour = n => { const i = DOM.indexOf(String(n).toLowerCase()); return i >= 0 ? PAL[i] : '#9aa3b5'; };
  const X0 = -1.05, X1 = 1.05, Y0 = -0.3, Y1 = 0.3, Z = 0.012, NX = 40, NY = 12;
  // the four layers as bands (top, bottom), the submucosa's bottom moving up with age
  const bands = a => { const s = 0.1 - 0.18 * (1 - 0.08 * a); return [[Y1, 0.1], [0.1, s], [s, s - 0.1], [s - 0.1, Y0]]; };
  // tiles: a grid of outlines drawn on column by column
  const gl = K.linesGeo(NX + NY + 2), gp = gl.attributes.position.array, gc = gl.attributes.aCol.array, gt = gl.attributes.aT.array;
  let k = 0;
  const seg = (a, b, t) => { gp.set(a, 6 * k); gp.set(b, 6 * k + 3); gc.set([0.9, 0.95, 1, 0.9, 0.95, 1], 6 * k); gt[2 * k] = gt[2 * k + 1] = t; k++; };
  for (let i = 0; i <= NX; i++) { const x = X0 + (X1 - X0) * i / NX; seg([x, Y0, Z], [x, Y1, Z], i / NX); }
  for (let j = 0; j <= NY; j++) { const y = Y0 + (Y1 - Y0) * j / NY; seg([X0, y, Z], [X1, y, Z], 0); }
  const grid = new THREE.LineSegments(gl, K.lines(set)); set.group.add(grid);
  // the domains: translucent washes
  const wash = DOM.slice(0, 4).map((d, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), K.fade(set, new THREE.MeshBasicMaterial({ color: PAL[i], depthWrite: false }), 0.45)); set.group.add(m); return m; });
  const lym = new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), K.fade(set, new THREE.MeshBasicMaterial({ color: PAL[4], depthWrite: false }), 0.6));
  lym.position.set(-0.35, 0.16, Z + 0.002); set.group.add(lym);
  const ves = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), K.fade(set, new THREE.MeshBasicMaterial({ color: PAL[5], depthWrite: false }), 0.6));
  ves.position.set(0.35, 0.02, Z + 0.002); set.group.add(ves);
  // the feature matrix beside the slab
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), K.fade(set, new THREE.MeshBasicMaterial({ color: '#46d9ff', depthWrite: false }), 0.5));
  mat.position.set(1.45, 0, 0.1); set.group.add(mat);
  // neighbours: links between tile centres
  const lg = K.linesGeo(200), lp = lg.attributes.position.array, lc = lg.attributes.aCol.array;
  for (let i = 0; i < 200; i++) { const x = -0.5 + (i % 20) * 0.05, y = -0.1 + Math.floor(i / 20) * 0.025; lp.set([x, y, Z + 0.004, x + 0.05, y, Z + 0.004], 6 * i); lc.set([1, 0.85, 0.3, 1, 0.85, 0.3], 6 * i); }
  const links = new THREE.LineSegments(lg, K.lines(set)); set.group.add(links);
  const anchors = { tiles: [0, Y1, Z], matrix: [1.45, 0.27, 0.1], mucosa: [0.4, 0.2, Z], submucosa: [0.2, 0.01, Z], muscularis: [0.6, -0.2, Z],
    lymphoid: [-0.35, 0.16, Z], vessels: [0.35, 0.02, Z], gauge: [-0.9, -0.38, Z] };
  for (let i = 0; i < 5; i++) anchors['feat' + i] = [-0.8 + 0.4 * i, 0.1, 0.06];
  const DA = S => prog(S.slide_domain, 0.3, 1);
  return Object.assign(set, {
    params: { slide_a: 1, slide_tiles: 0, slide_feat: 0, slide_adj: 0, slide_domain: 0, slide_age: 0, slide_focus: 0 },
    update(S) {
      grid.material.uniforms.uReveal.value = S.slide_tiles * 1.02; grid.visible = S.slide_tiles > 0.01;
      const b = bands(S.slide_age), f = Math.round(S.slide_focus);
      wash.forEach((m, i) => {
        m.scale.set(X1 - X0, b[i][0] - b[i][1], 1); m.position.set(0, (b[i][0] + b[i][1]) / 2, Z + 0.001);
        m.visible = S.slide_domain > 0.01; m.material.opacity = 0.45 * S.slide_domain * S.slide_a * (f && f !== i + 1 ? 0.25 : 1);
      });
      lym.visible = ves.visible = S.slide_domain > 0.01;
      mat.visible = S.slide_feat > 0.01; mat.material.opacity = 0.5 * S.slide_feat * S.slide_a;
      links.visible = S.slide_adj > 0.01; links.material.uniforms.uReveal.value = 1; links.material.uniforms.uA.value = S.slide_adj * S.slide_a;
    },
    anchors,
    labels: [
      { text: ['Tiles', ''], at: 'tiles', alpha: S => prog(S.slide_tiles, 0.4, 1) * (1 - prog(S.slide_feat, 0, 0.3)) * (1 - prog(S.slide_domain, 0, 0.3)) },
      { text: ['Features', 'from a vision model'], at: 'matrix', alpha: S => prog(S.slide_feat, 0.5, 1) * (1 - prog(S.slide_domain, 0, 0.3)) },
      { text: ['Each tile listens', 'to its neighbours'], at: 'submucosa', alpha: S => prog(S.slide_adj, 0.5, 1) * (1 - prog(S.slide_domain, 0, 0.3)) },
      { text: ['Mucosa', ''], at: 'mucosa', cls: 'mag', alpha: DA },
      { text: ['Submucosa', ''], at: 'submucosa', cls: 'amb', alpha: S => DA(S) * (1 - prog(S.slide_adj, 0.5, 1)) },
      { text: ['Muscularis', ''], at: 'muscularis', cls: 'cyn', alpha: DA },
      { text: ['Lymphoid patch', ''], at: 'lymphoid', alpha: DA },
      { text: ['Submucosa', '42.9 % → 34.5 %'], at: 'gauge', cls: 'amb', alpha: S => prog(S.slide_age, 0, 0.1) },
    ],
    cam: { default: [0, 6, 3.2, 0, 0, 0], tiles: [0, 4, 1.7, 0, 0.05, 0], matrix: [-24, 6, 1.9, 0.9, 0, 0.1], close: [-6, 4, 0.6, 0.0, 0.0, 0.01], domains: [0, 6, 3, 0, 0, 0] },
    controls: [
      { key: 'view', label: 'View', options: [['section', 'Section'], ['tiles', 'Tiles'], ['features', 'Features'], ['neighbours', 'Neighbours'], ['domains', 'Domains'], ['age', 'Age']] },
      { key: 'age', label: 'Age', options: [['20', '20'], ['70', '70']] },
    ],
    explore(c) {
      const v = c.view;
      return { slide_tiles: v === 'tiles' || v === 'features' || v === 'neighbours' ? 1 : 0, slide_feat: v === 'features' ? 1 : 0, slide_adj: v === 'neighbours' ? 1 : 0,
        slide_domain: v === 'domains' || v === 'age' ? 1 : 0, slide_age: v === 'age' && c.age === '70' ? 1 : 0 };
    },
    api: () => ({
      domains: DOM.slice(), domainColour,
      pick(rc) { const h = rc.intersectObjects(wash, false)[0]; return h ? wash.indexOf(h.object) : -1; },
    }),
  });
};
