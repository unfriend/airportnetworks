// The methods as lenses over the cell (chapter 6): three rings, each with a small scene of how a method finds a link
// (illustrative shapes). Two-hybrid: in a yeast nucleus, two proteins each carry half of a switch; if they bind, the halves
// meet on the DNA and a reporter lights, wherever the two live in our own cells. Purification with mass spectrometry: the
// cell is broken open and a bait pulled out of the mix with what clings to it, proteins from different places meeting in
// the tube. Proximity labelling: a bait in a living cell marks what comes near it with tags, near, not necessarily bound.
// lens_open brings the rings in, lens_focus lights one (1, 2, 3; 0 all alike). Drawn in the cell's frame, above it.
SETS.lens = function (K) {
  const { THREE, clamp, v3 } = K;
  const set = K.newSet('lens');
  const AT = [[-1.3, 1.08, 0.25], [0, 1.36, 0.35], [1.3, 1.08, 0.25]], R = 0.42;
  const face = new THREE.Vector3(...v3.norm([Math.sin(20 * Math.PI / 180), 0.25, Math.cos(20 * Math.PI / 180)]));
  const solid = (c, e) => K.fade(set, new THREE.MeshStandardMaterial({ color: new THREE.Color(...c), roughness: 0.5, metalness: 0.05, emissive: new THREE.Color(...c).multiplyScalar(e || 0.2) }));
  const blob = (r, c, e) => new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), solid(c, e));
  const lenses = AT.map(p => {
    const g = new THREE.Group(), inner = new THREE.Group();
    g.position.set(...p); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face);
    const ringMat = K.fade(set, new THREE.MeshStandardMaterial({ color: 0xcfe6ff, roughness: 0.35, metalness: 0.6, emissive: 0x2a3a50 }));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.018, 10, 64), ringMat));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 48), K.rim(set, { color: [0.35, 0.6, 0.9], a0: 0.05, a1: 0.05 }));
    g.add(disc); g.add(inner); set.group.add(g);
    return { g, inner, ringMat, disc };
  });
  const pts = (n, f) => { const geo = K.pointsGeo(n); for (let i = 0; i < n; i++) f(i, geo.attributes); return geo; };
  const PLC = [[0.55, 0.78, 1.0], [0.66, 0.54, 1.0], [1.0, 0.45, 0.35], [0.35, 0.95, 0.6], [1.0, 0.78, 0.3]];
  const r = K.rng(5);
  // 1. two-hybrid: a yeast nucleus, its DNA, the bait on it (with its half of the switch), the prey coming in
  const Y = lenses[0].inner;
  Y.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 20), K.rim(set, { color: [0.75, 0.6, 1.0], a0: 0.04, a1: 0.5 })));
  const dna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.44, 8), solid([0.6, 0.65, 0.8])); dna.rotation.z = Math.PI / 2; dna.position.y = -0.12; Y.add(dna);
  const bait = blob(0.05, [0.3, 0.75, 1.0]); bait.position.set(-0.03, -0.04, 0); Y.add(bait);
  const prey = blob(0.045, [1.0, 0.6, 0.3]); Y.add(prey);
  const glowG = pts(1, (i, a) => { a.aCol.array.set([1.0, 0.95, 0.5]); a.aSize.array[0] = 0.12; });
  const glow = new THREE.Points(glowG, K.points(set)); glow.position.set(0.1, -0.12, 0.01); Y.add(glow);
  // 2. purification: pieces of a broken cell drifting apart; proteins from several places falling into a tube
  const A2 = lenses[1].inner, shards = [];
  for (let i = 0; i < 7; i++) {
    const th = i / 7 * Math.PI * 2, m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6, th, Math.PI * 2 / 7 * 0.8, 0.3, 1.9), K.rim(set, { color: [0.55, 0.78, 1.0], a0: 0.05, a1: 0.45 }));
    m.position.y = 0.12; m.userData.d = [Math.cos(th + 0.4), 0.3 * (r() - 0.5), -Math.sin(th + 0.4)]; A2.add(m); shards.push(m);
  }
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.22, 20, 1, true), K.rim(set, { color: [0.8, 0.9, 1.0], a0: 0.05, a1: 0.6 })); tube.position.y = -0.2; A2.add(tube);
  const NM = 36, mix = pts(NM, (i, a) => { a.aCol.array.set(PLC[i % PLC.length], 3 * i); a.aSize.array[i] = 0.035; });
  const mixP = new THREE.Points(mix, K.points(set)); A2.add(mixP);
  const mixS = Array.from({ length: NM }, () => [0.16 * (r() - 0.5) * 2, 0.12 + 0.14 * (r() - 0.5), 0.1 * (r() - 0.5)]), mixE = Array.from({ length: NM }, () => [0.09 * (r() - 0.5), -0.27 + 0.14 * r(), 0.08 * (r() - 0.5)]);
  // 3. proximity labelling: a bait, its halo, the neighbours it tags as they come near
  const A3 = lenses[2].inner;
  const bait3 = blob(0.045, [0.3, 0.75, 1.0]); A3.add(bait3);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.17, 28, 18), K.rim(set, { color: [0.4, 1.0, 0.7], a0: 0.06, a1: 0.5 })); A3.add(halo);
  const NN = 30, nbS = [], nb = pts(NN, (i, a) => {
    const u = K.unit(r), d = 0.07 + 0.22 * Math.sqrt(r()); nbS.push([u[0] * d, u[1] * d * 0.8, u[2] * d * 0.5]);
    a.aCol.array.set([0.65, 0.7, 0.8], 3 * i); a.aSize.array[i] = 0.04;
  });
  const nbP = new THREE.Points(nb, K.points(set)); A3.add(nbP);
  const tags = pts(NN, (i, a) => { a.aCol.array.set([0.4, 1.0, 0.7], 3 * i); a.aSize.array[i] = 0.022; a.aA.array[i] = 0; });
  const tagP = new THREE.Points(tags, K.points(set)); A3.add(tagP);
  const anchorOf = (i, y) => () => { const p = AT[i]; return [p[0], p[1] + y, p[2]]; };
  return Object.assign(set, {
    // lens_open: the rings come in (each a little after the one before); lens_focus: one lit (1 two-hybrid, 2
    // purification, 3 proximity labelling), the others dimmed; 0 all alike
    params: { lens_a: 1, lens_open: 0, lens_focus: 0 },
    update(S, t) {
      const o = clamp(S.lens_open, 0, 1), f = clamp(S.lens_focus, 0, 3);
      lenses.forEach((L, i) => {
        const s = K.smooth(clamp(o * 1.6 - i * 0.3, 0, 1)), lit = f < 0.5 ? 1 : Math.max(0.3, 1 - Math.abs(f - (i + 1)));
        L.g.scale.setScalar(Math.max(0.01, s) * (0.85 + 0.15 * lit));
        L.g.visible = s > 0.01;
        L.ringMat.emissive.setRGB(0.16 * lit + 0.05, 0.22 * lit + 0.06, 0.32 * lit + 0.08);
        L.inner.visible = lit > 0.35;
      });
      // two-hybrid: the prey comes, binds, the reporter lights, it leaves (a loop of 6 s)
      const a = (t / 6) % 1, near = a < 0.35 ? K.smooth(a / 0.35) : a < 0.8 ? 1 : 1 - K.smooth((a - 0.8) / 0.2);
      prey.position.set(0.25 - 0.17 * near, 0.12 - 0.15 * near, 0);
      glowG.attributes.aA.array[0] = clamp((near - 0.9) * 10, 0, 1) * (0.7 + 0.3 * Math.sin(t * 6)); glowG.attributes.aA.needsUpdate = true;
      // purification: the cell breaks open, its proteins fall into the tube (a loop of 8 s)
      const b = (t / 8) % 1, br = K.smooth(clamp(b / 0.3, 0, 1)), fall = K.smooth(clamp((b - 0.25) / 0.45, 0, 1)), back = clamp((b - 0.92) / 0.08, 0, 1);
      shards.forEach(m => { const d = m.userData.d; m.position.set(d[0] * 0.12 * br, 0.12 + d[1] * 0.1 * br, d[2] * 0.12 * br); m.visible = back < 0.5; });
      const P2 = mix.attributes.position.array;
      for (let i = 0; i < NM; i++) for (let k = 0; k < 3; k++) P2[3 * i + k] = mixS[i][k] + (mixE[i][k] - mixS[i][k]) * fall;
      mix.attributes.aA.array.fill(1 - back); mix.attributes.position.needsUpdate = true; mix.attributes.aA.needsUpdate = true;
      // proximity labelling: neighbours drift; those inside the halo collect a tag (a loop of 7 s)
      const c = (t / 7) % 1, P3 = nb.attributes.position.array, T3 = tags.attributes.position.array, TA = tags.attributes.aA.array;
      for (let i = 0; i < NN; i++) {
        const s = nbS[i], w = 0.02 * Math.sin(t * 0.9 + i);
        P3[3 * i] = s[0] + w; P3[3 * i + 1] = s[1] - w; P3[3 * i + 2] = s[2];
        const inside = Math.hypot(s[0], s[1], s[2]) < 0.17;
        TA[i] = inside ? clamp((c - i / NN * 0.6) * 5, 0, 1) * (c < 0.95 ? 1 : 0) : 0;
        T3[3 * i] = P3[3 * i] + 0.018; T3[3 * i + 1] = P3[3 * i + 1] + 0.018; T3[3 * i + 2] = P3[3 * i + 2] + 0.01;
      }
      nb.attributes.position.needsUpdate = true; tags.attributes.position.needsUpdate = true; tags.attributes.aA.needsUpdate = true;
    },
    anchors: { yeast: anchorOf(0, R + 0.08), apms: anchorOf(1, R + 0.08), prox: anchorOf(2, R + 0.08),
      yeastTag: anchorOf(0, -R - 0.06), apmsTag: anchorOf(1, -R - 0.06), proxTag: anchorOf(2, -R - 0.06) },
    labels: [],
    cam: { default: [20, 10, 5.4, 0, 0.5, 0], yeast: [14, 6, 2.7, AT[0][0], AT[0][1] - 0.1, AT[0][2]], apms: [20, 6, 2.7, AT[1][0], AT[1][1] - 0.1, AT[1][2]], prox: [26, 6, 2.7, AT[2][0], AT[2][1] - 0.1, AT[2][2]] },
  });
};
