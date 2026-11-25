// The clotting group close up (builder B): the fine community 11_2_1 (XDATA.ex.clot: 21 substances, in middle 11_2 and
// top 11), drawn in the cloud set's own frame (the authors' layout), so it gathers out of the cloud where the camera
// has flown: each member flies from its place in the network to a loose ball round the group's middle; four come forward
// one by one with their names (heparin, the pill's hormones, the contrast dye, the sedative); above them the group's
// genes appear, every member threaded to each gene it touches (targets.bin: F2, prothrombin, by 19 of the 21; SERPINC1,
// antithrombin, by 5, the four among them; ten more by one or two each), and the group's name. A substance is a glyph
// whose shape and colour are its chemical family's (the authors' colours; shapes ours, one a family: a circle, a hexagon,
// a ring, a square, a diamond, a triangle, a star, a cross, a pentagon, a hollow square, a dotted ring, an octagon),
// never a drawn chemical structure: four unlike shapes, one gene.
// Params: clot_a (fade); clot_in 0..1 the members gather; clot_four 0..1 the four come forward, a quarter each, in the
// order the voice names them; clot_gene 0..1 the genes appear and the threads grow to them (SERPINC1's first);
// clot_label 0..1 the group's name and a soft glow in its colour; clot_pulse 0..1 pulses running up the threads, from
// the substances to the genes ("not what it is: what it disturbs"); clot_tags 0..1 (default 1) the names of the four
// and the genes (they go as the camera pulls back, the group's name stays).
// Anchors: centre (the group's middle), gene (SERPINC1), f2, four0..four3, name. Views: default (the group close, from
// the same side as the cloud set's g1121 view, so the hand-over keeps the camera), back (further out). Draw calls 3:
// glyphs, threads, the glow.
SETS.clot = function (K) {
  const { THREE, clamp, smooth } = K;
  const set = K.newSet('clot');
  const X = XDATA, E = X.ex.clot, M = E.members, n = M.length;
  const kf = X.comm.find(2, E.id), top = kf >= 0 ? X.comm.parent[X.comm.parent[kf]] : -1;
  // the group's middle in the authors' layout, and the side the camera looks from (the default view below)
  const C = [0, 0, 0];
  for (const i of M) for (let j = 0; j < 3; j++) C[j] += X.pos[3 * i + j] / n;
  const r3 = v => Math.round(v * 1000) / 1000;
  const VIEW = [196, 10, 0.85, r3(C[0]), r3(r3(C[1]) + 0.035), r3(C[2])];
  const az = VIEW[0] * Math.PI / 180, el = VIEW[1] * Math.PI / 180;
  const FR = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];   // (towards the camera)
  const RT = K.v3.norm(K.v3.cross([-FR[0], -FR[1], -FR[2]], [0, 1, 0])), UP = K.v3.cross(RT, [-FR[0], -FR[1], -FR[2]]);
  const at = (f, r, u) => [C[0] + FR[0] * f + RT[0] * r + UP[0] * u, C[1] + FR[1] * f + RT[1] * r + UP[1] * u, C[2] + FR[2] * f + RT[2] * r + UP[2] * u];
  // the four the voice names, in its order: heparin, the pill, the dye, the sedative
  const FOUR = [['calcium heparin', 'Heparin', ' · a blood thinner'], ['Contraceptives, Oral, Combined', 'The pill', ' · its hormones'],
    ['Ioxaglic Acid', 'Ioxaglic acid', ' · an X-ray dye'], ['Clobazam', 'Clobazam', ' · a sedative']]
    .map(([lab, b, r]) => ({ i: M.find(i => X.label[i] === lab), b, r })).filter(f => f.i !== undefined);
  const fourOf = i => FOUR.findIndex(f => f.i === i);
  // where each member gathers: the four in a row in front, the rest in a loose ball round the middle
  const HOME = M.map((i, j) => {
    const f = fourOf(i);
    if (f >= 0) return at(0.13, -0.105 + 0.07 * f, -0.03);
    const k = j - FOUR.filter(q => M.indexOf(q.i) < j).length, m = n - FOUR.length, y = 1 - 2 * (k + 0.5) / m, rr = Math.sqrt(1 - y * y), a = k * 2.39996;
    return at(-0.01 + 0.07 * rr * Math.cos(a), 0.085 * rr * Math.sin(a), 0.065 * y - 0.015);
  });
  // the group's genes (XDATA.ex.clot.genes, most shared first): SERPINC1 above the four, F2 beside it, the others in a
  // shallow arc behind and above
  const GENES = E.genes.map(([sym, k]) => ({ sym, k }));
  const gi = s => GENES.findIndex(q => q.sym === s);
  let o = 0;
  GENES.forEach(q => {
    q.p = q.sym === 'SERPINC1' ? at(0.1, 0.0, 0.135) : q.sym === 'F2' ? at(0.02, -0.12, 0.12)
      : (a => at(-0.05 - 0.02 * Math.cos(a), 0.17 * Math.sin(a), 0.12 + 0.06 * Math.cos(a)))(-1.25 + 2.5 * (o++ + 0.5) / Math.max(1, GENES.length - 2));
  });
  // the threads: every member to every gene of the group it touches (targets.bin), else only SERPINC1's five
  const TH = [];
  const buildThreads = () => {
    TH.length = 0;
    for (const i of M) {
      const t = X.targets(i), syms = t ? [...t].map(g => X.gene.sym(g)) : E.serpinc1.includes(i) ? ['SERPINC1'] : [];
      for (const s of syms) { const k = gi(s); if (k >= 0) TH.push([M.indexOf(i), k]); }
    }
    // SERPINC1's first (they grow first), then by gene
    TH.sort((a, b) => (GENES[a[1]].sym === 'SERPINC1' ? 0 : 1) - (GENES[b[1]].sym === 'SERPINC1' ? 0 : 1) || a[1] - b[1] || a[0] - b[0]);
  };
  buildThreads();
  const F2N = () => TH.filter(q => GENES[q[1]].sym === 'F2').length || (E.genes.find(q => q[0] === 'F2') || [0, 0])[1];

  // ---------------------------------------------------------------- glyphs (substances and genes, one draw)
  const NP = n + GENES.length + 1;
  const g = new THREE.BufferGeometry();
  const P = new Float32Array(3 * NP), COL = new Float32Array(3 * NP), SZ = new Float32Array(NP), AL = new Float32Array(NP), SH = new Float32Array(NP);
  const att = (nm, a, k) => g.setAttribute(nm, new THREE.BufferAttribute(a, k));
  att('position', P, 3); att('aCol', COL, 3); att('aSize', SZ, 1); att('aA', AL, 1); att('aShape', SH, 1);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(...C), 2);
  // each family's shape (by its order among the families: 8 shapes, two families share one only past the eighth)
  const shapeOf = c => c % 12;
  M.forEach((i, j) => { COL.set(K.rgb(X.classes.col[X.prim[i]]), 3 * j); SH[j] = shapeOf(X.prim[i]); });
  GENES.forEach((q, k) => { COL.set(K.rgb(q.sym === 'SERPINC1' || q.sym === 'F2' ? '#ff8a7a' : '#c98f86'), 3 * (n + k)); SH[n + k] = 20; });
  // the last one: the group's glow, in its top group's colour
  COL.set(K.rgb(top >= 0 ? X.comm.col[top] : '#c65d7d'), 3 * (NP - 1)); SH[NP - 1] = 21; P.set(C, 3 * (NP - 1));
  const gm = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: K.GLSL + `
attribute vec3 aCol; attribute float aSize, aA, aShape;
uniform float uA;
varying vec3 vC; varying float vA, vS;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // (at most about 3 degrees across, the glow excepted)
  float sc = length(modelViewMatrix[0].xyz), d = length(mv.xyz) / sc;
  gl_PointSize = pointPx(aShape > 20.5 ? aSize : min(aSize, 0.055 * d), mv);
  vC = aCol; vA = aA * uA; vS = aShape;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
varying vec3 vC; varying float vA, vS;
float poly(vec2 p, float k, float r) { float a = atan(p.x, p.y), s = 6.2831853 / k; return cos(floor(0.5 + a / s) * s - a) * length(p) - r; }
void main() {
  vec2 p = (gl_PointCoord - 0.5) * 2.0; p.y = -p.y;
  float l = length(p), s = floor(vS + 0.5), d;
  if (s > 20.5) { if (l > 1.0) discard; gl_FragColor = vec4(vC, vA * pow(1.0 - l, 2.2) * 0.5); return; }
  // shapes of the families (ours), a gene a soft round bead
  if (s < 0.5) d = l - 0.62;
  else if (s < 1.5) d = poly(p, 6.0, 0.6);
  else if (s < 2.5) d = abs(l - 0.5) - 0.14;
  else if (s < 3.5) d = max(abs(p.x), abs(p.y)) - 0.52;
  else if (s < 4.5) d = (abs(p.x) + abs(p.y)) * 0.75 - 0.5;
  else if (s < 5.5) d = poly(p + vec2(0.0, 0.12), 3.0, 0.38);
  else if (s < 6.5) { float a = atan(p.x, p.y); d = l - (0.42 + 0.22 * cos(5.0 * a)); }
  else if (s < 7.5) d = min(max(abs(p.x) - 0.2, abs(p.y) - 0.62), max(abs(p.y) - 0.2, abs(p.x) - 0.62));
  else if (s < 8.5) d = poly(p, 5.0, 0.5);
  else if (s < 9.5) d = abs(max(abs(p.x), abs(p.y)) - 0.42) - 0.12;
  else if (s < 10.5) d = min(abs(l - 0.52) - 0.1, l - 0.18);
  else if (s < 11.5) d = poly(p, 8.0, 0.56);
  else d = l - 0.55;
  float fill = smoothstep(0.06, -0.04, d), glow = exp(-max(d, 0.0) * 7.0) * 0.45;
  vec3 c = mix(vC, vec3(1.0), smoothstep(0.0, -0.35, d) * 0.25);
  float a = vA * max(fill, glow);
  if (a < 0.003) discard;
  gl_FragColor = vec4(c * (0.55 + 0.6 * fill), a);
}`,
  });
  set.mats.push(gm);
  const glyphs = new THREE.Points(g, gm);
  glyphs.renderOrder = 5; set.group.add(glyphs);

  // ---------------------------------------------------------------- threads (to the genes; pulses running up them)
  const NT = 64;
  const lg = new THREE.BufferGeometry(), LP = new Float32Array(6 * NT), LC = new Float32Array(6 * NT), LA = new Float32Array(2 * NT), LU = new Float32Array(2 * NT);
  lg.setAttribute('position', new THREE.BufferAttribute(LP, 3)); lg.setAttribute('aCol', new THREE.BufferAttribute(LC, 3));
  lg.setAttribute('aA', new THREE.BufferAttribute(LA, 1)); lg.setAttribute('aU', new THREE.BufferAttribute(LU, 1));
  lg.boundingSphere = g.boundingSphere;
  const lm = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uPulse: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aCol; attribute float aA, aU; uniform float uA; varying vec3 vC; varying float vA, vU;
void main() { vC = aCol; vA = aA * uA; vU = aU; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uPulse; varying vec3 vC; varying float vA, vU;
void main() { float k = fract(vU * 1.5 - uTime * 0.6); float a = vA * (1.0 + uPulse * 2.5 * pow(k, 6.0));
  if (a < 0.003) discard; gl_FragColor = vec4(vC, a); }`,
  });
  set.mats.push(lm);
  const threads = new THREE.LineSegments(lg, lm);
  threads.renderOrder = 4; set.group.add(threads);

  // ---------------------------------------------------------------- the place of each member now
  const four = (s, f) => smooth(clamp(s.clot_four * 4 - f, 0, 1));
  function memberAt(s, j, out) {
    const i = M[j], e = smooth(clamp((clamp(s.clot_in, 0, 1) - 0.4 * ((j * 0.618) % 1)) / 0.6, 0, 1)), h = HOME[j], f = fourOf(i);
    // (the four wait a little behind their place until their turn comes)
    const back = f >= 0 ? 1 - four(s, f) : 0;
    for (let m = 0; m < 3; m++) out[m] = X.pos[3 * i + m] + (h[m] - FR[m] * 0.11 * back - X.pos[3 * i + m]) * e;
    return out;
  }
  let S = { clot_in: 1, clot_four: 1, clot_gene: 1, clot_label: 1 };
  const _p = [0, 0, 0];
  if (!TH.length || !X.ready('targets')) set.rethread = true;

  return Object.assign(set, {
    params: { clot_a: 1, clot_in: 1, clot_four: 0, clot_gene: 0, clot_label: 0, clot_pulse: 0, clot_tags: 1 },
    update(s, t) {
      S = s;
      if (set.rethread && X.ready('targets')) { set.rethread = false; buildThreads(); }
      const gin = clamp(s.clot_gene, 0, 1), lab = clamp(s.clot_label, 0, 1), cin = clamp(s.clot_in, 0, 1);
      for (let j = 0; j < n; j++) {
        memberAt(s, j, _p); P.set(_p, 3 * j);
        const f = fourOf(M[j]), fw = f >= 0 ? four(s, f) : 0;
        SZ[j] = (0.018 + 0.026 * fw) * (1 + 0.05 * Math.sin(t * 2 + j));
        AL[j] = (0.55 + 0.45 * cin) * (f >= 0 ? 0.65 + 0.35 * fw : 1 - 0.35 * clamp(s.clot_four * 2, 0, 1));
      }
      GENES.forEach((q, k) => {
        const e = smooth(clamp((gin - (q.sym === 'SERPINC1' ? 0 : q.sym === 'F2' ? 0.25 : 0.45)) / 0.4, 0, 1)), big = q.sym === 'SERPINC1' || q.sym === 'F2';
        P.set(q.p, 3 * (n + k)); SZ[n + k] = (big ? 0.03 : 0.016) * (1 + 0.08 * Math.sin(t * 3 + k)); AL[n + k] = e * (big ? 1 : 0.7);
      });
      SZ[NP - 1] = 0.55; AL[NP - 1] = 0.25 * lab;
      for (const a of ['position', 'aSize', 'aA']) g.attributes[a].needsUpdate = true;
      // threads: from the substance to the gene, growing out after the gene's turn
      TH.slice(0, NT).forEach(([j, k], q) => {
        const gs = GENES[k].sym, st = gs === 'SERPINC1' ? 0.1 : gs === 'F2' ? 0.35 : 0.55, e = smooth(clamp((gin - st - 0.02 * (q % 7)) / 0.35, 0, 1));
        memberAt(s, j, _p);
        const gp = GENES[k].p;
        for (let m = 0; m < 3; m++) { LP[6 * q + m] = _p[m]; LP[6 * q + 3 + m] = _p[m] + (gp[m] - _p[m]) * e; }
        const hot = gs === 'SERPINC1', c = K.rgb(hot ? LOOK.thread : X.classes.col[X.prim[M[j]]]);
        LC.set(c, 6 * q); LC.set(hot ? K.rgb(LOOK.shared) : c, 6 * q + 3);
        LA[2 * q] = LA[2 * q + 1] = e * (hot ? 0.7 : gs === 'F2' ? 0.32 : 0.22);
        LU[2 * q] = 0; LU[2 * q + 1] = 1;
      });
      for (let q = Math.min(TH.length, NT); q < NT; q++) LA[2 * q] = LA[2 * q + 1] = 0;
      for (const a of ['position', 'aCol', 'aA', 'aU']) lg.attributes[a].needsUpdate = true;
      lm.uniforms.uPulse.value = clamp(s.clot_pulse, 0, 1);
    },
    anchors: {
      centre: C, gene: () => GENES[gi('SERPINC1')].p, f2: () => (gi('F2') >= 0 ? GENES[gi('F2')].p : C),
      four0: () => memberAt(S, M.indexOf(FOUR[0].i), [0, 0, 0]), four1: () => memberAt(S, M.indexOf(FOUR[1].i), [0, 0, 0]),
      four2: () => memberAt(S, M.indexOf(FOUR[2].i), [0, 0, 0]), four3: () => memberAt(S, M.indexOf(FOUR[3].i), [0, 0, 0]),
      name: at(-0.02, 0.0, -0.13),
    },
    labels: [
      ...FOUR.map((f, k) => ({ at: 'four' + k, text: [f.b, f.r], alpha: s => clamp(s.clot_four * 4 - k - 0.3, 0, 1) * s.clot_tags })),
      { at: 'gene', text: ['SERPINC1', ' · antithrombin, a brake on clotting'], alpha: s => clamp(s.clot_gene * 4 - 0.6, 0, 1) * s.clot_tags },
      { at: 'f2', text: () => ['F2', ` · prothrombin, touched by ${F2N()} of ${n}`], minor: true, alpha: s => clamp(s.clot_gene * 4 - 1.6, 0, 1) * s.clot_tags * (1 - clamp(s.clot_label * 2, 0, 1)) },
      { at: 'name', text: [X.comm.words(kf) ? X.comm.words(kf).charAt(0).toUpperCase() + X.comm.words(kf).slice(1) : 'Blood clotting', ` · ${n} substances, one fine group`], alpha: s => clamp(s.clot_label * 2 - 0.5, 0, 1) },
    ],
    cam: { default: VIEW, back: [VIEW[0], 14, 1.5, VIEW[3], VIEW[4], VIEW[5]] },
  });
};
SETS.clot.prep = () => XDATA.need(['targets'], pkgUrl);
