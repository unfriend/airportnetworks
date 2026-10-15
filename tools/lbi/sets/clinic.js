// Rare diseases (slides 24-27): a crowd of people with one patient picked out in red, and a 3D Sankey diagram of the
// inborn errors of immunity (clinical categories against interactome clusters, Guthrie et al., Science Advances 2023).

// ------------------------------------------------------------------------------------------------ the crowd
SETS.crowd = function (K) {
  const { THREE, smooth, clamp, lerp } = K;
  const set = K.newSet('crowd');
  const r = K.rng(24);
  // People stand on arcs around a point in front of the crowd, so the rows bend gently towards the viewer.
  // The crowd is the middle of the first rows (about 400 people); crowd_grow fills in the people around and behind
  // it, outwards, into a sea of 6,000 that reaches the horizon.
  const R0 = 2.3, DR = 0.09, SP = 0.095, PHI = 0.28, PHW = 0.8, BASE = 400, ALL = 6000, PS = 0.9;
  const P = [];
  let nBase = 0, Rb = 0, R = R0;
  for (let row = 0; P.length < ALL; row++) {
    // further back people stand a little further apart
    const e = smooth((R - 4) / 7), sp = SP * (1 + 0.3 * e), inBase = !Rb;
    let n = Math.round(2 * PHW * R / sp);
    if ((n + row) % 2) n++;   // alternate odd and even rows so each row stands in the gaps of the one in front
    let rowP = [];
    for (let i = 0; i < n; i++) {
      // looser outside the first crowd, so the sea does not look like a grid
      const a0 = (i - (n - 1) / 2) * sp / R, loose = !inBase || Math.abs(a0) > PHI + 0.02, jit = loose ? 0.55 + 0.25 * e : 0.3;
      const a = a0 + (r() - 0.5) * jit * sp / R, rr = R + (r() - 0.5) * (jit + 0.1) * DR;
      const base = inBase && Math.abs(a) <= PHI;
      if (base) nBase++;
      rowP.push({ x: rr * Math.sin(a), z: -rr * Math.cos(a), a, R, row, h: PS * (0.9 + 0.18 * r()), w: PS * (0.92 + 0.14 * r()),
        rot: r() * 6.283, g: 0.27 + 0.08 * r(), s: r(), base });
    }
    if (P.length + n > ALL) rowP = rowP.sort((p, q) => Math.abs(p.a) - Math.abs(q.a)).slice(0, ALL - P.length);
    P.push(...rowP);
    R += DR * (1 + 0.3 * e);
    if (inBase && nBase >= BASE) Rb = R;
  }
  const Rmax = P[P.length - 1].R;
  // centre the first crowd on the origin (the rows bend around (0, CZ))
  const bz = P.filter(p => p.base).map(p => p.z), CZ = -(Math.min(...bz) + Math.max(...bz)) / 2;
  for (const p of P) p.z += CZ;
  const RAD = Math.max(...P.filter(p => p.base).map(p => Math.hypot(p.x, p.z))) + 0.04;
  // order in which the others appear (0..1): their distance from the first crowd
  const gd = p => Math.hypot(Math.max(0, p.R - Rb), Math.max(0, Math.abs(p.a) - PHI) * p.R);
  const others = P.filter(p => !p.base).sort((p, q) => gd(p) - gd(q));
  others.forEach((p, i) => { p.gr = i / (others.length - 1); });   // by rank, so they appear at an even rate
  for (const p of P) if (p.base) p.gr = -1;
  // the patient: a little left of centre, a few rows back (as on the slide)
  const red = P.filter(p => p.row === 3 && p.base).sort((p, q) => Math.abs(p.x + 0.22) - Math.abs(q.x + 0.22))[0];

  // A person like the icons on slide 24: a robe-like body with round shoulders, a short neck and a ball head.
  // Three levels of detail (see the tiers below), since the far rows are only a few pixels tall; even the coarsest
  // keeps shoulders, a neck and a blunt head, so it never reads as a spike.
  function person(seg, lod) {
    const pts = [], add = (x, y) => pts.push([x, y]);
    const head = (n, a0) => { for (let k = 0; k <= n; k++) { const a = a0 + k / n * (Math.PI / 2 - a0); add(0.023 * Math.cos(a), 0.123 + 0.023 * Math.sin(a)); } };
    add(0.04, 0);
    if (lod === 0) {
      add(0.0403, 0.03); add(0.037, 0.066);
      for (let k = 1; k <= 3; k++) { const a = k / 3 * Math.PI / 2; add(0.019 + 0.018 * Math.cos(a), 0.066 + 0.026 * Math.sin(a)); }
      add(0.0095, 0.098); head(5, -Math.PI / 3);
    } else if (lod === 1) {
      add(0.037, 0.066); add(0.025, 0.09); add(0.0095, 0.098); head(3, -Math.PI / 3);
    } else {
      // shoulders, a pinched neck and a blunt head: still a person at a few pixels
      add(0.035, 0.072); add(0.012, 0.099); add(0.022, 0.126); add(0, 0.146);
    }
    // a lathe whose crown is a fan on one vertex (LatheGeometry would spend a degenerate triangle per segment there)
    const n = pts.length - 1, pos = [], idx = [];
    for (let k = 0; k < n; k++) for (let s = 0; s < seg; s++) { const a = s / seg * 2 * Math.PI; pos.push(pts[k][0] * Math.sin(a), pts[k][1], pts[k][0] * Math.cos(a)); }
    pos.push(0, pts[n][1], 0);
    for (let k = 0; k < n - 1; k++) for (let s = 0; s < seg; s++) {
      const a = k * seg + s, b = k * seg + (s + 1) % seg;
      idx.push(a, b, b + seg, a, b + seg, a + seg);
    }
    for (let s = 0; s < seg; s++) idx.push((n - 1) * seg + s, (n - 1) * seg + (s + 1) % seg, n * seg);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  const G = { value: 0 };   // crowd_grow, shared by every crowd shader
  const LP = { value: new THREE.Vector3(red.x, 0.08, red.z) };   // where the patient's glow comes from
  // lit people: grow-in (scale up from the floor), a slight sway, and a cool rim so they read against the dark
  // (rk: rim strength; weaker on the coarser tiers, where a strong rim would trace their facets)
  function crowdMat(rk) {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0.0 });
    const u = { uRim: { value: new THREE.Color(0.1, 0.15, 0.24) }, uSpill: { value: 0 } };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { uGrow: G, uTime: K.U.uTime, uRim: u.uRim, uSpill: u.uSpill, uLP: LP });
      sh.vertexShader = 'attribute float aR, aS;\nuniform float uGrow, uTime;\nuniform vec3 uLP;\nvarying vec3 vLP;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
  vec3 transformed = vec3(position);
  float gv = aR < 0.0 ? 1.0 : clamp((uGrow * 1.3 - aR) / 0.3, 0.0, 1.0);
  float hh = transformed.y / 0.146;
  transformed.x += sin(uTime * 0.9 + aS * 6.283) * 0.006 * hh * hh;
  transformed *= gv * gv * (3.0 - 2.0 * gv);
  vLP = (viewMatrix * modelMatrix * vec4(uLP, 1.0)).xyz;`);
      // the patient's red glow lights the people around them
      sh.fragmentShader = 'uniform vec3 uRim;\nuniform float uSpill;\nvarying vec3 vLP;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += uRim * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
  vec3 ld = vLP + vViewPosition; float ll = length(ld);
  totalEmissiveRadiance += vec3(1.0, 0.3, 0.22) * uSpill * max(dot(normal, ld / ll), 0.0) * 0.006 / (0.004 + ll * ll);`);
    };
    m.userData.u = u; m.userData.rk = rk;
    return K.fade(set, m, 1);
  }
  const mat = crowdMat(1), midMat = crowdMat(0.7), farMat = crowdMat(0.45), redMat = crowdMat(1);
  const greys = [mat, midMat, farMat];
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), V = new THREE.Vector3(), Sc = new THREE.Vector3();
  const place = p => M4.compose(V.set(p.x, 0, p.z), Q.setFromAxisAngle(Y, p.rot), Sc.set(p.w, p.h, p.w));
  function tier(list, seg, lod, m) {
    const g = person(seg, lod), n = list.length;
    const aR = new Float32Array(n), aS = new Float32Array(n);
    const mesh = new THREE.InstancedMesh(g, m, n);
    list.forEach((p, i) => {
      mesh.setMatrixAt(i, place(p));
      // further rows fade towards the background colour (air between us and them)
      const k = 1 - 0.6 * smooth((Math.hypot(p.x, p.z) - 1.2) / 7);
      if (m === redMat) mesh.setColorAt(i, new THREE.Color(1, 1, 1));
      else mesh.setColorAt(i, new THREE.Color(p.g * k + 0.016 * (1 - k), p.g * k + 0.035 * (1 - k), p.g * 1.03 * k + 0.07 * (1 - k)));
      aR[i] = p.gr; aS[i] = p.s;
    });
    g.setAttribute('aR', new THREE.InstancedBufferAttribute(aR, 1));
    g.setAttribute('aS', new THREE.InstancedBufferAttribute(aS, 1));
    mesh.frustumCulled = false;
    mesh.userData.gr = aR;
    set.group.add(mesh);
    return mesh;
  }
  // the first crowd back to front (correct overlaps while the set fades); the others by gr (so count trims them),
  // in less detail the further they stand from the usual views (all frontal: the grown crowd is only in the story):
  // 8, 6, 5 and 3 sides (184, 78, 35 and 21 triangles)
  const dC = p => Math.hypot(p.x, p.z - 0.6), D1 = 2.1, D2 = 3;
  const byGr = (p, q) => p.gr - q.gr;
  const near = tier(P.filter(p => p.base && p !== red).sort((p, q) => p.z - q.z), 8, 0, mat);
  const mid = tier(P.filter(p => !p.base && dC(p) < D1).sort(byGr), 6, 1, midMat);
  const far = tier(P.filter(p => !p.base && dC(p) >= D1 && dC(p) < D2).sort(byGr), 5, 2, farMat);
  const far2 = tier(P.filter(p => !p.base && dC(p) >= D2).sort(byGr), 3, 2, farMat);
  const redMesh = tier([red], 14, 0, redMat);
  far2.renderOrder = 0; far.renderOrder = 1; mid.renderOrder = 2; near.renderOrder = 3; redMesh.renderOrder = 3;
  // how many grown people are up for a given crowd_grow (they are sorted by gr)
  const upTo = (arr, g) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < g) lo = m + 1; else hi = m; } return lo; };

  // soft contact shadows under the nearer rows (instanced flat quads)
  const shP = P.filter(p => p.base || dC(p) < D1).sort(byGr);
  const shG = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const shR = new Float32Array(shP.length);
  shP.forEach((p, i) => { shR[i] = p.gr; });
  shG.setAttribute('aR', new THREE.InstancedBufferAttribute(shR, 1));
  const shMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uGrow: G },
    transparent: true, depthWrite: false,
    vertexShader: `attribute float aR; uniform float uGrow; varying vec2 vUv;
void main() {
  vUv = uv;
  float gv = aR < 0.0 ? 1.0 : clamp((uGrow * 1.3 - aR) / 0.3, 0.0, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position * gv, 1.0);
}`,
    fragmentShader: `uniform float uA; varying vec2 vUv;
void main() { float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(0.0, 0.004, 0.012, (1.0 - smoothstep(0.25, 1.0, d)) * 0.6 * uA); }`,
  });
  set.mats.push(shMat);
  const shadows = new THREE.InstancedMesh(shG, shMat, shP.length);
  shP.forEach((p, i) => shadows.setMatrixAt(i, M4.compose(V.set(p.x, 0.0015, p.z), Q.set(0, 0, 0, 1), Sc.set(0.1 * p.w, 1, 0.085 * p.w))));
  shadows.frustumCulled = false; shadows.renderOrder = -1;
  set.group.add(shadows);
  const nShBase = shP.filter(p => p.base).length, shRest = shR.subarray(nShBase);

  // the floor: a dark disc that fades out at its edge and widens as the crowd grows; a pool of light under the patient
  // (uC: centre z, then the x and z radii of the disc)
  const flMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uRed: { value: 0 }, uRP: { value: new THREE.Vector2(red.x, red.z) }, uC: { value: new THREE.Vector3(0, 1.45, 1.45) } },
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uA, uRed; uniform vec2 uRP; uniform vec3 uC; varying vec3 vP;
void main() {
  float d = length(vec2(vP.x / uC.y, (vP.z - uC.x) / uC.z));
  vec3 col = mix(vec3(0.075, 0.105, 0.16), vec3(0.03, 0.045, 0.075), smoothstep(0.0, 0.9, d));
  float pr = length(vP.xz - uRP);
  col *= 1.0 - 0.45 * uRed;
  col += uRed * (vec3(1.0, 0.3, 0.25) * 0.5 * exp(-pr * pr / 0.02) + vec3(1.0, 0.86, 0.8) * 0.3 * (1.0 - smoothstep(0.075, 0.11, pr)));
  gl_FragColor = vec4(col, (1.0 - smoothstep(0.5, 1.0, d)) * 0.92 * uA);
}`,
  });
  set.mats.push(flMat);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2).translate(0, 0, -8), flMat);
  floor.renderOrder = -2; floor.frustumCulled = false;
  set.group.add(floor);

  // a soft beam of light from above onto the patient: brighter face-on, fading at its edges and towards the top
  const BH = 1.6, BR = 0.11;
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uRed: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN, vW; varying float vY;
void main() {
  vY = position.y / ${BH.toFixed(2)};
  vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `uniform float uA, uRed; varying vec3 vN, vW; varying float vY;
void main() {
  float f = abs(dot(normalize(vN), normalize(cameraPosition - vW)));
  float a = pow(f, 1.5) * (1.0 - vY) * (1.0 - vY) * smoothstep(0.06, 0.3, vY) * 0.55 * uRed * uA;
  gl_FragColor = vec4(vec3(1.0, 0.82, 0.76) * a, a);
}`,
  });
  set.mats.push(beamMat);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(BR, BH, 40, 1, true).translate(0, BH / 2, 0), beamMat);
  beam.position.set(red.x, 0, red.z); beam.renderOrder = 4;
  set.group.add(beam);
  // dust in the beam, drifting down; and a red glow around the patient
  const NM = 70, mg = K.pointsGeo(NM + 1);
  for (let i = 0; i < NM; i++) {
    mg.attributes.position.array.set([r() * 6.283, Math.sqrt(r()) * 0.9, r()], 3 * i);
    mg.attributes.aCol.array.set([1, 0.9, 0.82], 3 * i);
    mg.attributes.aSize.array[i] = 0.006 + 0.006 * r();
    mg.attributes.aA.array[i] = 0.5 + 0.5 * r();
  }
  mg.attributes.position.array.set([0, 0, -1], 3 * NM);   // the glow (z < 0 marks it)
  mg.attributes.aCol.array.set(K.rgb('#ff5a4b'), 3 * NM);
  mg.attributes.aSize.array[NM] = 0.42;
  mg.attributes.aA.array[NM] = 0.42;
  const moteMat = K.points(set, {
    uniforms: { uRed: { value: 0 }, uC: { value: new THREE.Vector3(red.x, 0, red.z) } },
    head: 'uniform float uRed; uniform vec3 uC;',
    vertex: `
  if (position.z < 0.0) {
    pos = uC + vec3(0.0, 0.075 * ${red.h.toFixed(3)}, 0.0);
    vA *= uRed * (0.85 + 0.15 * sin(uTime * 2.2));
  } else {
    float yy = fract(position.z - uTime * 0.035) * 1.35;
    float rr = position.y * ${BR} * (1.0 - yy / ${BH.toFixed(2)});
    pos = uC + vec3(cos(position.x + uTime * 0.1) * rr, yy, sin(position.x + uTime * 0.1) * rr);
    vA *= uRed * smoothstep(0.0, 0.2, yy) * (1.0 - smoothstep(0.9, 1.35, yy)) * (0.6 + 0.4 * sin(uTime * 1.7 + position.x * 9.0));
  }
  mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize, mv);`,
  });
  const motes = new THREE.Points(mg, moteMat);
  motes.frustumCulled = false; motes.renderOrder = 5;
  set.group.add(motes);

  const GREY = new THREE.Color(red.g, red.g, red.g * 1.03), RED = new THREE.Color('#ff5a4b'), DEEP = new THREE.Color(0.72, 0.1, 0.07);
  const zB = CZ - Rb, zMax = CZ - Rmax;
  return Object.assign(set, {
    params: { crowd_a: 1, crowd_red: 0, crowd_grow: 0 },
    update(S, t) {
      const rd = clamp(S.crowd_red, 0, 1), gw = clamp(S.crowd_grow, 0, 1);
      G.value = gw;
      // people write depth even while fading, so the crowd stays solid instead of turning to glass
      for (const m of greys) {
        m.depthWrite = true;
        m.color.setScalar(1 - 0.66 * rd);
        m.userData.u.uSpill.value = rd;
        m.userData.u.uRim.value.setRGB(0.1, 0.15, 0.24).multiplyScalar((1 - 0.6 * rd) * m.userData.rk);
      }
      redMat.depthWrite = true;
      redMat.color.copy(GREY).lerp(DEEP, rd);
      redMat.emissive.copy(RED).multiplyScalar(rd * (0.3 + 0.06 * Math.sin(t * 2.2)));
      redMat.userData.u.uRim.value.setRGB(0.1, 0.15, 0.24).lerp(RED, rd);
      flMat.uniforms.uRed.value = beamMat.uniforms.uRed.value = moteMat.uniforms.uRed.value = rd;
      beam.visible = motes.visible = rd > 0.002;
      // grown rows: only draw the ones that have started to rise
      const g = gw * 1.3;
      for (const m of [mid, far, far2]) { m.count = upTo(m.userData.gr, g); m.visible = m.count > 0; }
      shadows.count = nShBase + upTo(shRest, g);
      // the floor follows the crowd back
      const e = smooth(gw);
      flMat.uniforms.uC.value.set(lerp(0, (zB + zMax) / 2 - 0.6, e), lerp(1.45, 7.5, e), lerp(1.45, 6.2, e));
    },
    anchors: {
      red: [red.x, 0.165 * red.h, red.z], crowd: [0, 0.07, 0], front: [0, 0.07, CZ - R0], back: [0, 0.07, zB],
      far: [0, 0.07, (zB + zMax) / 2], horizon: [0, 0.07, zMax],
    },
    labels: [],
    cam: {
      default: [0, 20, 3.6, 0, 0.04, 0],
      close: [12, 22, 0.95, red.x, 0.085, red.z],
      wide: [0, 24, 5.6, 0, 0, -1.4],
    },
    controls: [],
    explore() { return {}; },
    // the first crowd is about 2.3 wide and 2 deep: wider than the usual radius 1.1, so it says how far it reaches
    radius: +RAD.toFixed(2), count: ALL, baseCount: nBase,
  });
};

// ------------------------------------------------------------------------------------------------ the Sankey
SETS.sankey = function (K) {
  const { THREE, smooth, clamp, prog } = K;
  const set = K.newSet('sankey');
  // [name, short name, genes, colour]; counts and colours from Guthrie et al. (2023), slide 27
  const CL = [
    ['Autoinflammatory disorders', 'Autoinflammatory', 40, '#4bb8d6'],
    ['Combined immunodeficiencies with associated or syndromic features', 'Combined, syndromic', 19, '#f39a3c'],
    ['Immunodeficiencies affecting cellular and humoral immunity', 'Cellular and humoral', 27, '#e3534c'],
    ['Phenocopies of inborn errors of immunity', 'Phenocopies', 4, '#b07fd9'],
    ['Diseases of immune dysregulation', 'Immune dysregulation', 33, '#43b6c6'],
    ['Predominantly antibody deficiencies', 'Antibody deficiencies', 10, '#a2544f'],
    ['Congenital defects of phagocyte number or function', 'Phagocyte defects', 9, '#8d8d8d'],
    ['Defects in intrinsic and innate immunity', 'Intrinsic and innate', 3, '#e2c64a'],
    ['Complement deficiencies', 'Complement deficiencies', 28, '#e0535b'],
  ];
  const MO = [
    ['c23', 'c23', 1, '#8a8f98'],
    ['RNA remodelling and nucleotide', 'RNA and nucleotide', 19, '#9b6bd6'],
    ['Proteasome complex', 'Proteasome', 8, '#e0453a'],
    ['Calcium', 'Calcium', 2, '#3fae5a'],
    ['NF-κB and chromatin', 'NF-κB and chromatin', 22, '#2f9e44'],
    ['Regulation of cell death and survival', 'Cell death', 21, '#8c3b2e'],
    ['c4', 'c4', 3, '#6d7784'],
    ['Meiosis, antigen presentation', 'Meiosis, antigen presentation', 3, '#c84fd0'],
    ['Vesicular traffic', 'Vesicular traffic', 9, '#d9c63a'],
    ['Actin regulation', 'Actin regulation', 5, '#2d8fd6'],
    ['Transcription factors, DNA binding complex', 'Transcription factors', 19, '#7d6b5d'],
    ['TCR and BCR', 'TCR and BCR', 9, '#a855d8'],
    ['CD28 costimulation', 'CD28 costimulation', 4, '#c73fa0'],
    ['Interleukin and cytokine', 'Interleukin, cytokine', 7, '#1f7ac2'],
    ['Steroid resistant inflammation', 'Steroid resistant', 15, '#8a4b2a'],
    ['c19', 'c19', 1, '#5aa86c'],
    ['c9', 'c9', 1, '#9aa4ad'],
    ['Complement', 'Complement', 23, '#d6303a'],
    ['c3', 'c3', 1, '#c0c4c9'],
  ];
  // genes from clinical category (row) to molecular cluster (column). Illustrative: only the row and column
  // totals come from the paper (they are checked below).
  //       c23 RNA Prot Ca NFkB death c4 meio ves actin TF TCR CD28 IL ster c19 c9 C' c3
  const M = [
    [1, 8, 7, 0, 8, 4, 0, 0, 0, 0, 0, 0, 0, 2, 9, 0, 0, 1, 0],
    [0, 6, 0, 1, 2, 0, 1, 1, 1, 1, 5, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 2, 0, 1, 3, 0, 1, 2, 0, 1, 5, 6, 3, 3, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 2, 10, 1, 0, 7, 1, 6, 0, 1, 1, 3, 0, 1, 0, 0],
    [0, 1, 0, 0, 4, 1, 0, 0, 0, 0, 1, 3, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 3, 0, 0, 1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 22, 1],
  ];
  // one-word names for the explore buttons (the labels keep the longer short names)
  const BTN = ['Autoinflammatory', 'Syndromic', 'Cellular', 'Phenocopies', 'Dysregulation', 'Antibody', 'Phagocyte', 'Innate', 'Complement'];
  const nL = CL.length, nR = MO.length;
  const rowSum = M.map(row => row.reduce((s, v) => s + v, 0));
  const colSum = MO.map((_, j) => M.reduce((s, row) => s + row[j], 0));
  const total = rowSum.reduce((s, v) => s + v, 0);
  CL.forEach((c, i) => { if (rowSum[i] !== c[2]) throw new Error('sankey: row ' + c[0] + ' sums to ' + rowSum[i]); });
  MO.forEach((c, j) => { if (colSum[j] !== c[2]) throw new Error('sankey: column ' + c[0] + ' sums to ' + colSum[j]); });

  // layout: genes stack at U per gene; the 19 clusters with small gaps, the 9 categories spread to the same height
  const U = 0.0072, GR = 0.0125, H = total * U + (nR - 1) * GR, GL = (H - total * U) / (nL - 1);
  const XL = -0.95, XR = 0.5, BW = 0.07, BD = 0.16, TH = 0.012, XA = XL + BW / 2, XB = XR - BW / 2;
  const lTop = [], rTop = [];
  for (let i = 0, y = H / 2; i < nL; i++) { lTop.push(y); y -= rowSum[i] * U + GL; }
  for (let j = 0, y = H / 2; j < nR; j++) { rTop.push(y); y -= colSum[j] * U + GR; }
  const lMid = lTop.map((y, i) => y - rowSum[i] * U / 2), rMid = rTop.map((y, j) => y - colSum[j] * U / 2);
  // each category's ribbons run in their own depth layer (first category in front), so crossings read in 3D;
  // they ease into it and back out over the outer 35% of the span, so no ribbon bends sharply near a column
  const zP = CL.map((_, i) => ((nL - 1) / 2 - i) * 0.06), ZF = zP[0] + 0.1, RMP = 0.35;
  const DMAX = 0.36, delay = (i, j) => 0.3 * i / (nL - 1) + 0.06 * j / (nR - 1);
  const plateau = s => smooth(s / RMP) * smooth((1 - s) / RMP);

  // ---- ribbons: one mesh per category (so they sort by layer), each a thin band with four faces
  const FLOW = { value: 1 };
  function ribbonMat(col) {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(0.7), emissive: col, emissiveIntensity: 0.15, roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide });
    const u = { uPop: { value: 0 }, uEdge: { value: new THREE.Color(col) } };
    m.onBeforeCompile = sh => {
      sh.uniforms.uFlow = FLOW; sh.uniforms.uPop = u.uPop; sh.uniforms.uEdge = u.uEdge;
      sh.vertexShader = 'attribute float aS, aD;\nvarying float vS, vF;\nuniform float uFlow, uPop;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  vS = aS; vF = clamp((uFlow - aD) / ${(1 - DMAX).toFixed(3)}, 0.0, 1.0);
  transformed.z += uPop * smoothstep(0.0, ${RMP}, aS) * smoothstep(0.0, ${RMP}, 1.0 - aS);`);
      sh.fragmentShader = 'varying float vS, vF;\nuniform vec3 uEdge;\n' + sh.fragmentShader
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (vF < 0.002 || vS > vF) discard;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uEdge * 0.9 * (1.0 - smoothstep(0.0, 0.06, vF - vS)) * (1.0 - smoothstep(0.9, 1.0, vF));');
    };
    m.userData.u = u;
    return K.fade(set, m, 0.86);
  }
  const NS = 48;
  const xs = [[XL, 0]];
  for (let k = 0; k <= NS; k++) xs.push([XA + (XB - XA) * k / NS, k / NS]);
  xs.push([XR, 1]);
  const offL = new Array(nL).fill(0), offR = new Array(nR).fill(0);
  const ribbons = [], lanes = [];   // lanes: one per gene, for the travelling dots
  for (let i = 0; i < nL; i++) {
    const pos = [], aS = [], aD = [], idx = [];
    for (let j = 0; j < nR; j++) {
      const c = M[i][j];
      if (!c) continue;
      const y0 = lTop[i] - offL[i] * U, y1 = rTop[j] - offR[j] * U, d = delay(i, j), ins = Math.min(0.0007, c * U * 0.1);
      for (let l = 0; l < c; l++) lanes.push([y0 - (l + 0.5) * U, y1 - (l + 0.5) * U, i, d]);
      offL[i] += c; offR[j] += c;
      // four strips: front, back, top, bottom; each with its own vertices so the edges stay crisp
      for (let f = 0; f < 4; f++) {
        const v0 = pos.length / 3;
        for (const [x, s] of xs) {
          const sm = smooth(s), yT = y0 + (y1 - y0) * sm - ins, yB = yT - c * U + 2 * ins, z = zP[i] * plateau(s) - zP[i];
          const zf = z + TH / 2, zb = z - TH / 2;
          if (f === 0) pos.push(x, yT, zf, x, yB, zf);
          else if (f === 1) pos.push(x, yB, zb, x, yT, zb);
          else if (f === 2) pos.push(x, yT, zb, x, yT, zf);
          else pos.push(x, yB, zf, x, yB, zb);
          aS.push(s, s); aD.push(d, d);
        }
        for (let k = 0; k < xs.length - 1; k++) {
          const a = v0 + 2 * k, b = a + 2;
          idx.push(a, a + 1, b + 1, a, b + 1, b);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
    g.setAttribute('aD', new THREE.Float32BufferAttribute(aD, 1));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, ribbonMat(CL[i][3]));
    mesh.position.z = zP[i];   // sorts the translucent layers back to front from any side
    mesh.renderOrder = 1; mesh.frustumCulled = false;
    set.group.add(mesh);
    ribbons.push(mesh);
  }

  // ---- blocks: 9 + 19 lit boxes in one instanced mesh, glowing in their own colour
  const BG = { value: 0.2 };
  const bm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1 });
  bm.onBeforeCompile = sh => {
    sh.uniforms.uGlow = BG;
    sh.fragmentShader = 'uniform float uGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vColor * uGlow;');
  };
  K.fade(set, bm, 1);
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bm, nL + nR);
  blocks.frustumCulled = false;
  const bCol = [...CL, ...MO].map(c => new THREE.Color(c[3]));
  bCol.forEach((c, k) => blocks.setColorAt(k, c));
  set.group.add(blocks);
  const M4 = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), Sc = new THREE.Vector3(), C = new THREE.Color();

  // ---- one travelling dot per gene and lap: genes flowing from their clinical category to their cluster
  const NDOT = 3, dr = K.rng(27), dg = K.pointsGeo(lanes.length * NDOT);
  const dCat = new Float32Array(lanes.length * NDOT), dPh = new Float32Array(lanes.length * NDOT), dDl = new Float32Array(lanes.length * NDOT);
  lanes.forEach(([y0, y1, i, d], l) => {
    const col = K.v3.lerp(K.rgb(CL[i][3]), [1, 1, 1], 0.55);
    for (let k = 0; k < NDOT; k++) {
      const n = l * NDOT + k;
      dg.attributes.position.array.set([y0, y1, zP[i]], 3 * n);
      dg.attributes.aCol.array.set(col, 3 * n);
      dg.attributes.aSize.array[n] = 0.011;
      dg.attributes.aA.array[n] = 0.75;
      dCat[n] = i; dPh[n] = (k + dr() * 0.8) / NDOT; dDl[n] = d;
    }
  });
  dg.setAttribute('aCat', new THREE.BufferAttribute(dCat, 1));
  dg.setAttribute('aPh', new THREE.BufferAttribute(dPh, 1));
  dg.setAttribute('aD', new THREE.BufferAttribute(dDl, 1));
  const uK = new Array(nL).fill(1), uPop = new Array(nL).fill(0);
  const dm = K.points(set, {
    uniforms: { uFlow: FLOW, uOn: { value: 1 }, uK: { value: uK }, uPop: { value: uPop } },
    head: `attribute float aCat, aPh, aD; uniform float uFlow, uOn; uniform float uK[${nL}], uPop[${nL}];`,
    vertex: `
  float f = clamp((uFlow - aD) / ${(1 - DMAX).toFixed(3)}, 0.0, 1.0);
  float s = fract(aPh + uTime * 0.075);
  float sm = s * s * (3.0 - 2.0 * s), pl = smoothstep(0.0, ${RMP}, s) * smoothstep(0.0, ${RMP}, 1.0 - s);
  int c = int(aCat + 0.5);
  pos = vec3(mix(${XA.toFixed(4)}, ${XB.toFixed(4)}, s), mix(position.x, position.y, sm), (position.z + uPop[c]) * pl);
  mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize, mv);
  vA *= uOn * uK[c] * smoothstep(0.0, 0.05, f - s) * smoothstep(0.0, 0.05, s) * smoothstep(0.0, 0.05, 1.0 - s);`,
  });
  const dots = new THREE.Points(dg, dm);
  dots.frustumCulled = false; dots.renderOrder = 2;
  set.group.add(dots);

  // ---- labels: the molecular ones are spread apart where small clusters crowd together, with leader lines
  const MINS = 0.064, yLab = rMid.slice();
  for (let it = 0; it < 80; it++) {
    for (let j = 1; j < nR; j++) {
      const gap = yLab[j - 1] - yLab[j];
      if (gap < MINS) { const d = (MINS - gap) / 2; yLab[j - 1] += d; yLab[j] -= d; }
    }
  }
  const XLAB = XR + BW / 2 + 0.055, ZLAB = BD / 2;
  const lg = K.linesGeo(2 * nR);
  for (let j = 0; j < nR; j++) {
    const x0 = XR + BW / 2 + 0.004, x1 = x0 + 0.022;
    lg.attributes.position.array.set([x0, rMid[j], ZLAB, x1, rMid[j], ZLAB, x1, rMid[j], ZLAB, XLAB - 0.004, yLab[j], ZLAB], 12 * j);
    for (let k = 0; k < 4; k++) lg.attributes.aCol.array.set([0.58, 0.65, 0.74], 12 * j + 3 * k);
    lg.attributes.aA.array.set([0.55, 0.55, 0.55, 0.55], 4 * j);
    lg.attributes.aT.array.set([j / (nR - 1), j / (nR - 1), j / (nR - 1), j / (nR - 1)], 4 * j);
  }
  const lm = K.lines(set);
  const leaders = new THREE.LineSegments(lg, lm);
  leaders.renderOrder = 2;
  set.group.add(leaders);

  // ---- state shared by update and the labels
  const SPR = 0.7, rv = (p, k, n) => clamp(p * (1 + SPR) - SPR * k / (n - 1), 0, 1);
  // Highlight weights: w[i] for each category, D how much the rest dims. Two ways in: sankey_hi (the story keys it
  // in jumps; in-between values blend neighbouring categories) and sankey_h1..h9 (explore: one weight per category,
  // so when the engine eases them the old highlight fades out while the new one fades in, skipping none between)
  const st = { D: 0, w: new Array(nL).fill(0), rel: new Array(nR).fill(0) };
  function hilite(S) {
    const hi = S.sankey_hi || 0;
    let D = clamp(hi, 0, 1);
    for (let i = 0; i < nL; i++) {
      const h = clamp(S['sankey_h' + (i + 1)] || 0, 0, 1);
      st.w[i] = Math.max(0, 1 - Math.abs(hi - (i + 1)), h);
      D += h;
    }
    st.D = Math.min(1, D);
    for (let j = 0; j < nR; j++) { let s = 0; for (let i = 0; i < nL; i++) if (M[i][j]) s += st.w[i]; st.rel[j] = Math.min(1, s); }
  }
  // the highlighted stay bright all the way (even while the highlight itself is fading in), the rest dim with D
  const keepL = i => clamp(1 - st.D + st.w[i], 0, 1), keepR = j => clamp(1 - st.D + st.rel[j], 0, 1);
  function setBlock(k, x, y, h, g, keep, glow) {
    if (g < 0.002) Sc.set(0, 0, 0); else Sc.set(BW * (0.3 + 0.7 * g), h * g, BD * (0.3 + 0.7 * g));
    blocks.setMatrixAt(k, M4.compose(V.set(x, y, 0), Q, Sc));
    blocks.setColorAt(k, C.copy(bCol[k]).multiplyScalar(0.8 * (0.2 + 0.8 * keep) * (1 + 0.3 * glow)));
  }

  const labels = [
    { text: ['Clinical', `${nL} categories`], at: 'clinical', cls: 'amb', alpha: S => prog(S.sankey_left, 0.1, 0.5) },
    { text: ['Molecular', `${nR} clusters`], at: 'molecular', cls: 'cyn', alpha: S => prog(S.sankey_right, 0.1, 0.5) },
    ...CL.map((c, i) => ({ text: [c[1], String(c[2])], at: 'leftLabel' + i, cls: '',
      alpha: S => { hilite(S); return prog(rv(S.sankey_left, i, nL), 0.5, 1) * (1 - 0.75 * (1 - keepL(i))); } })),
    // minor: clusters of 3 genes or fewer, which the engine may drop on narrow screens and in the headset
    ...MO.map((c, j) => ({ text: [c[1], String(c[2])], at: 'rightLabel' + j, cls: '', minor: c[2] <= 3,
      alpha: S => { hilite(S); return prog(rv(S.sankey_right, j, nR), 0.5, 1) * (1 - 0.75 * (1 - keepR(j))); } })),
  ];
  const anchors = {
    mid: [(XL + XR) / 2, 0, 0], clinical: [XL - 0.02, H / 2 + 0.075, ZLAB], molecular: [XR - 0.02, H / 2 + 0.075, ZLAB],
    top: [(XL + XR) / 2, H / 2, 0], bottom: [(XL + XR) / 2, -H / 2, 0],
  };
  // left<i> and right<j>: the front face of each block; leftLabel<i> and rightLabel<j>: where the set's labels sit
  CL.forEach((_, i) => { anchors['left' + i] = [XL, lMid[i], BD / 2]; anchors['leftLabel' + i] = [XL + BW / 2 + 0.012, lMid[i], ZLAB]; });
  MO.forEach((_, j) => { anchors['right' + j] = [XR, rMid[j], BD / 2]; anchors['rightLabel' + j] = [XLAB, yLab[j], ZLAB]; });

  return Object.assign(set, {
    params: Object.assign({ sankey_a: 1, sankey_left: 1, sankey_right: 1, sankey_flow: 1, sankey_hi: 0 },
      ...CL.map((_, i) => ({ ['sankey_h' + (i + 1)]: 0 }))),
    update(S) {
      const left = clamp(S.sankey_left, 0, 1), right = clamp(S.sankey_right, 0, 1), a = set.uA.value;
      hilite(S);
      FLOW.value = clamp(S.sankey_flow, 0, 1);
      for (let i = 0; i < nL; i++) setBlock(i, XL, lMid[i], rowSum[i] * U, smooth(rv(left, i, nL)), keepL(i), st.w[i]);
      for (let j = 0; j < nR; j++) setBlock(nL + j, XR, rMid[j], colSum[j] * U, smooth(rv(right, j, nR)), keepR(j), st.rel[j]);
      blocks.instanceMatrix.needsUpdate = true; blocks.instanceColor.needsUpdate = true;
      blocks.visible = left > 0.001 || right > 0.001;
      // the highlighted category's ribbons glow and come forward in front of every other layer
      for (let i = 0; i < nL; i++) {
        const m = ribbons[i].material, w = st.w[i], keep = keepL(i);
        m.opacity = 0.86 * a * (0.1 + 0.9 * keep);
        m.emissiveIntensity = 0.15 + 0.3 * w;
        m.userData.u.uPop.value = uPop[i] = (ZF - zP[i]) * w;
        uK[i] = 0.08 + 0.92 * keep;
        ribbons[i].visible = FLOW.value > 0.002;
      }
      dm.uniforms.uOn.value = prog(FLOW.value, 0.5, 1);
      dots.visible = FLOW.value > 0.5;
      lm.uniforms.uReveal.value = (right * (1 + SPR) - 0.5) / SPR;
      leaders.visible = right > 0.01;
    },
    anchors,
    labels,
    cam: {
      default: [-8, 7, 3.75, 0.18, 0, 0],
      oblique: [-42, 14, 3.5, 0.1, 0, 0],
      molecular: [-16, 4, 2.4, 0.6, 0, 0],
      // for narrow portrait screens (w/h < 1): turned a little, so the diagram is narrower and shows its depth
      portrait: [-26, 9, 3.4, -0.12, 0, 0],
    },
    controls: [{ key: 'hi', label: 'Highlight', options: [['0', 'None'], ...BTN.map((b, i) => [String(i + 1), b])] }],
    // explore highlights through sankey_h1..h9, never sankey_hi (easing that would sweep through the categories between)
    explore(c) {
      const k = parseInt(c.hi, 10) || 0, o = { sankey_left: 1, sankey_right: 1, sankey_flow: 1, sankey_hi: 0 };
      for (let i = 1; i <= nL; i++) o['sankey_h' + i] = i === k ? 1 : 0;
      return o;
    },
    left: CL.map(c => c[0]), right: MO.map(c => c[0]), total,
    leftShort: CL.map(c => c[1]), rightShort: MO.map(c => c[1]),
    leftColours: CL.map(c => c[3]), rightColours: MO.map(c => c[3]), matrix: M.map(row => row.slice()),
  });
};
