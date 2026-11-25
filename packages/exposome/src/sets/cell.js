// The model cell of Back into the cell (its skins cut at build time from packages/ppicell/src/sets/cell.js by
// src/c-cut.mjs: EXPO_CELL, unchanged) with the interactome's 18,815 proteins where that story puts them (XDATA.ppi.cell:
// 9,790 in one of its 13 places; 3,400 it has without a place stand where it puts them, outside; 5,625 it does not have
// stand on a shell of their own just outside the membrane: "place not known"). One substance, outside, and a thread from
// it to every protein of a gene it disturbs, growing in waves (the most studied genes first); threads from many
// substances at once, faint; then one gene's protein (CASP3) with threads back out to its substances on a shell round the
// cell. The data says that a substance changed a gene, not which way: one colour for every thread.
// Draws: the skins (the cut's own meshes, 8 draws), the proteins (1 Points), the substance (1 Points), its threads (1
// LineSegments), the many substances (1 Points, 1 LineSegments), the gene's substances (1 Points, 1 LineSegments).
// Params (src/SPEC.md, "The sets"; the story keys them in engine/e3c_world.js):
//   cell_shell 1     the skins (0..1)
//   cell_dots 1      the proteins (0..1)
//   cell_sp 1        the substance's own point outside the cell (0..1: it comes forward)
//   cell_sub         the substance (step; XDATA index), its threads to its targets
//   cell_thr 0       its threads grown (0..1, in waves)
//   cell_many 0      threads from many substances at once (0..1)
//   cell_gene -1     a protein lit (step; interactome index), the start of the threads out
//   cell_rev 0       threads from that protein out to its substances (0..1; CASP3's 1,701)
//   cell_two 0       two of those substances lit and named (0..1)
//   cell_note 0      the "place not known" tag (0..1)
SETS.cell = function (K) {
  const { THREE, clamp, v3, smooth } = K;
  const set = K.newSet('cell');
  const mul = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const perp = d => v3.norm(Math.abs(d[0]) < 0.9 ? v3.cross(d, [1, 0, 0]) : v3.cross(d, [0, 1, 0]));
  // the cell's skins, as Back into the cell draws them
  // (built in the load's prep, a step of its own, against a stand-in set: its materials take this set's fade here)
  const CUT = CELL_PRE.cut || EXPO_CELL(K, THREE, clamp, v3, set, mul, perp);
  if (CELL_PRE.cut) { for (const m of CUT.shellMats) { m.uniforms.uA = set.uA; set.mats.push(m); } set.group.add(CUT.shells); CELL_PRE.cut = null; }
  const Q = XDATA.ppi, n = Q.N, CP = Q.cell || new Float32Array(3);
  const hsh = (a, b) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; };
  const at = p => [CP[3 * p], CP[3 * p + 1], CP[3 * p + 2]];
  const SRC = [1.85, 0.42, 0.45], FROM = [2.9, 1.0, 1.9];   // where the substance stands, and where it comes from

  // ------------------------------------------------------------ the proteins
  // aHit: when (in cell_thr's 0..1) a thread reaches the protein (2: none does); aIdx: the protein's number (cell_gene)
  const g = K.pointsGeo(Math.max(1, n)), GC = g.attributes.aCol.array, GS = g.attributes.aSize.array, GA = g.attributes.aA.array;
  const hit = new Float32Array(Math.max(1, n)).fill(2), idx = new Float32Array(Math.max(1, n));
  if (n) g.attributes.position.array.set(CP);
  const C_IN = K.rgb(LOOK.protein), C_OUT = K.rgb('#7c8696');
  let nKnown = 0;
  for (let i = 0; i < n; i++) {
    const pl = Q.place[i], ok = pl < 13;
    if (ok) nKnown++;
    GC.set(ok ? C_IN : C_OUT, 3 * i); GS[i] = ok ? 0.0125 : 0.0095; GA[i] = ok ? 0.75 : 0.35; idx[i] = i;
  }
  g.setAttribute('aHit', new THREE.BufferAttribute(hit, 1)); g.setAttribute('aIdx', new THREE.BufferAttribute(idx, 1));
  const PU = { uThr: { value: 0 }, uGene: { value: -1 }, uDots: { value: 1 }, uGlow: { value: 0 }, uTc: { value: new THREE.Vector3(...K.rgb(LOOK.thread)) } };
  const dots = new THREE.Points(g, K.points(set, { uniforms: PU, head: 'attribute float aHit, aIdx; uniform float uThr, uGene, uDots, uGlow; uniform vec3 uTc;', vertex: `
  float lit = smoothstep(aHit, aHit + 0.035, uThr);
  float me = 1.0 - step(0.5, abs(aIdx - uGene));
  vC = mix(vC, uTc, lit * 0.7);
  vC = mix(vC, vec3(1.0, 0.95, 0.75), me);
  vA = vA * uDots * (1.0 - lit * 0.25) + me * uGlow * uA;
  gl_PointSize = pointPx(aSize * (1.0 + 0.3 * lit + me * 5.0 * uGlow), mv);` }));
  dots.renderOrder = 10;
  set.group.add(dots);

  // ------------------------------------------------------------ the substance and its threads
  // each thread a soft curve of SEG segments from the substance to the protein; it grows from aT = its delay (the most
  // studied genes first, in waves) over 0.2 of cell_thr
  const SEG = 5, MAXT = 7000;   // (at most 7,000 threads drawn, the most studied genes: the label and panel give the whole count)
  const sp = K.pointsGeo(1);
  sp.attributes.aCol.array.set(K.rgb(LOOK.substance)); sp.attributes.aSize.array[0] = 0.12;
  const spObj = new THREE.Points(sp, K.points(set)); spObj.renderOrder = 12; spObj.frustumCulled = false;
  set.group.add(spObj);
  const tg = K.linesGeo(MAXT * SEG), TP = tg.attributes.position.array, TT = tg.attributes.aT.array, TA = tg.attributes.aA.array, TCc = tg.attributes.aCol.array;
  const TKU = { uK: { value: 1 } };
  const thr = new THREE.LineSegments(tg, K.lines(set, { uniforms: TKU, head: 'uniform float uK;', vertex: 'vA *= uK;' })); thr.renderOrder = 11; thr.frustumCulled = false;
  set.group.add(thr);
  tg.setDrawRange(0, 0);
  // a point on the curve from a to b at x, its bow out of the straight line set by h (0..1)
  const bow = (a, b, x, h, lift) => {
    const m = v3.lerp(a, b, 0.5), d = v3.sub(b, a), L = v3.len(d), w = perp(v3.norm(d)), u = v3.norm(v3.cross(d, w));
    const c = v3.add(m, v3.add(v3.mul(w, (h - 0.5) * 0.5 * L), v3.mul(u, (lift + 0.25 * h) * 0.3 * L)));
    const y = 1 - x;
    return [y * y * a[0] + 2 * y * x * c[0] + x * x * b[0], y * y * a[1] + 2 * y * x * c[1] + x * x * b[1], y * y * a[2] + 2 * y * x * c[2] + x * x * b[2]];
  };
  let shownSub = -2, nThr = 0;
  function threadsOf(s) {
    shownSub = s;
    hit.fill(2);
    const T = s >= 0 ? XDATA.targetsPPI(s) || [] : [], m = Math.min(T.length, MAXT), col = K.rgb(LOOK.thread);
    nThr = T.length;
    let v = 0;
    for (let j = 0; j < m; j++) {
      const p = T[j], b = at(p), d = 0.78 * Math.pow(j / Math.max(1, m), 0.55), h = hsh(s, p);
      hit[p] = d + 0.2;
      let q0 = SRC;
      for (let k = 1; k <= SEG; k++) {
        const q1 = bow(SRC, b, k / SEG, h, 0.2);
        TP.set(q0, 6 * v); TP.set(q1, 6 * v + 3);
        TT[2 * v] = d + 0.2 * (k - 1) / SEG; TT[2 * v + 1] = d + 0.2 * k / SEG;
        const a = (0.008 + 0.01 * h) * (0.35 + 0.65 * k / SEG);   // (faint where they bundle at the substance)
        TA[2 * v] = a * (k > 1 ? 1 : 0.6); TA[2 * v + 1] = a;
        TCc.set(col, 6 * v); TCc.set(col, 6 * v + 3);
        q0 = q1; v++;
      }
    }
    tg.setDrawRange(0, 2 * v);
    for (const k of ['position', 'aT', 'aA', 'aCol']) tg.attributes[k].needsUpdate = true;
    g.attributes.aHit.needsUpdate = true;
  }

  // ------------------------------------------------------------ many substances at once (the curated collection)
  // the 72 most studied after the substance itself, on a shell round the cell, each with threads to its 220 most studied
  // genes' proteins (a sample: the panel gives the collection's size)
  const MANY = 72, PER = 220, SHELL = 2.15;
  const famCol = i => K.rgb(LOOK.family[XDATA.prim[i]] || '#9aa7b8');
  const order = Array.from({ length: XDATA.N }, (_, i) => i).sort((a, b) => XDATA.ngenes[b] - XDATA.ngenes[a] || a - b);
  const manySubs = order.filter(i => i !== XDATA.ex.bap).slice(0, MANY);
  const ga = Math.PI * (3 - Math.sqrt(5));
  const spiral = (k, N, r, sq) => { const y = 1 - 2 * (k + 0.5) / N, s = Math.sqrt(1 - y * y), a = ga * k; return [r * s * Math.cos(a), r * y * (sq || 1), r * s * Math.sin(a)]; };
  const mg = K.pointsGeo(MANY), ml = K.linesGeo(MANY * PER);
  let mv = 0;
  manySubs.forEach((s, k) => {
    const p = spiral(k, MANY, SHELL, 0.8), c = famCol(s), T = XDATA.targetsPPI(s) || [];
    mg.attributes.position.array.set(p, 3 * k); mg.attributes.aCol.array.set(c, 3 * k); mg.attributes.aSize.array[k] = 0.04;
    for (let j = 0; j < Math.min(PER, T.length); j++) {
      ml.attributes.position.array.set(p, 6 * mv); ml.attributes.position.array.set(at(T[j]), 6 * mv + 3);
      ml.attributes.aCol.array.set(c, 6 * mv); ml.attributes.aCol.array.set(c, 6 * mv + 3);
      const r = 0.9 * hsh(s, T[j]);
      ml.attributes.aT.array[2 * mv] = r; ml.attributes.aT.array[2 * mv + 1] = r;
      ml.attributes.aA.array[2 * mv] = 0.012; ml.attributes.aA.array[2 * mv + 1] = 0.022;
      mv++;
    }
  });
  ml.setDrawRange(0, 2 * mv);
  const mU = { uK: { value: 0 } };
  const manyPts = new THREE.Points(mg, K.points(set, { uniforms: mU, head: 'uniform float uK;', vertex: 'vA *= uK;' }));
  const manyLines = new THREE.LineSegments(ml, K.lines(set));
  for (const o of [manyPts, manyLines]) { o.frustumCulled = false; o.renderOrder = 9; set.group.add(o); }

  // ------------------------------------------------------------ a gene's protein and its substances (CASP3's 1,701)
  const CASP3 = Q.find('CASP3'), REV_R = 1.6, RSEG = 3;
  const revSubs = CELL_PRE.rev || [];
  const rn = revSubs.length;
  const rg = K.pointsGeo(Math.max(1, rn)), rl = K.linesGeo(Math.max(1, rn * RSEG));
  const rHit = new Float32Array(Math.max(1, rn)).fill(2), rTwo = new Float32Array(Math.max(1, rn));
  const revPos = [];
  if (CASP3 >= 0) {
    const c0 = at(CASP3);
    revSubs.forEach((s, k) => {
      const p = spiral(k, rn, REV_R, 0.85), c = famCol(s), d = 0.8 * Math.pow(k / Math.max(1, rn), 0.6);
      revPos.push(p);
      rg.attributes.position.array.set(p, 3 * k); rg.attributes.aCol.array.set(c, 3 * k); rg.attributes.aSize.array[k] = 0.05;
      rHit[k] = d + 0.2; if (k < 2) rTwo[k] = 1;
      let q0 = c0;
      for (let j = 1; j <= RSEG; j++) {
        const q1 = bow(c0, p, j / RSEG, hsh(s, 7), 0.1), v = k * RSEG + j - 1;
        rl.attributes.position.array.set(q0, 6 * v); rl.attributes.position.array.set(q1, 6 * v + 3);
        rl.attributes.aCol.array.set(K.rgb(LOOK.thread), 6 * v); rl.attributes.aCol.array.set(c, 6 * v + 3);
        rl.attributes.aT.array[2 * v] = d + 0.2 * (j - 1) / RSEG; rl.attributes.aT.array[2 * v + 1] = d + 0.2 * j / RSEG;
        rl.attributes.aA.array[2 * v] = 0.2; rl.attributes.aA.array[2 * v + 1] = 0.12;
        q0 = q1;
      }
    });
  }
  rg.setAttribute('aHit', new THREE.BufferAttribute(rHit, 1)); rg.setAttribute('aTwo', new THREE.BufferAttribute(rTwo, 1));
  rl.setDrawRange(0, 2 * rn * RSEG);
  const RU = { uRev: { value: 0 }, uTwo: { value: 0 } };
  const revPts = new THREE.Points(rg, K.points(set, { uniforms: RU, head: 'attribute float aHit, aTwo; uniform float uRev, uTwo;', vertex: `
  float on = smoothstep(aHit - 0.02, aHit + 0.03, uRev);
  vA *= on * (1.0 - 0.6 * uTwo * (1.0 - aTwo)) * (0.8 + 0.6 * aTwo * uTwo);
  vC = mix(vC, vec3(1.0), 0.5 * aTwo * uTwo);
  gl_PointSize = pointPx(aSize * (1.0 + 1.6 * aTwo * uTwo), mv);` }));
  const revLines = new THREE.LineSegments(rl, K.lines(set, { uniforms: { uDim: RU.uTwo }, head: 'uniform float uDim;', vertex: 'vA *= 1.0 - 0.5 * uDim;' }));
  for (const o of [revPts, revLines]) { o.frustumCulled = false; o.renderOrder = 9; set.group.add(o); }

  // ------------------------------------------------------------ labels and views
  const lab = s => (s >= 0 ? XDATA.label[s] : '');
  const top = XDATA.meta.topGenes, pAt = sym => { const p = Q.find(sym); return p >= 0 ? at(p) : [0, 0, 0]; };
  const unknown = n - nKnown;
  let S0 = {};
  const outer = v3.mul(v3.norm([0.75, -0.55, 0.62]), 1.22);
  return Object.assign(set, {
    params: { cell_a: 1, cell_shell: 1, cell_dots: 1, cell_sp: 1, cell_sub: XDATA.ex.bap, cell_thr: 0, cell_many: 0, cell_gene: -1, cell_rev: 0, cell_two: 0, cell_note: 0 },
    keepClear: true,   // the skins are drawn where their geometry is: a headset keeps them clear of your head
    update(S) {
      S0 = S;
      const sh = clamp(S.cell_shell, 0, 1);
      for (const m of CUT.shellMats) m.uniforms.uK.value = sh;
      CUT.shells.visible = sh > 0.004;
      const s = Math.round(S.cell_sub);
      if (s !== shownSub && n) threadsOf(s);
      const x = smooth(clamp(S.cell_sp, 0, 1));
      sp.attributes.position.array.set(v3.lerp(FROM, SRC, x)); sp.attributes.position.needsUpdate = true;
      sp.attributes.aA.array[0] = x * (s >= 0 ? 1 : 0); sp.attributes.aA.needsUpdate = true;
      thr.material.uniforms.uReveal.value = clamp(S.cell_thr, 0, 1);
      thr.visible = S.cell_thr > 0.002 && s >= 0;
      PU.uThr.value = clamp(S.cell_thr, 0, 1); PU.uDots.value = clamp(S.cell_dots, 0, 1);
      PU.uGene.value = Math.round(S.cell_gene); PU.uGlow.value = S.cell_gene >= 0 ? 1 : 0;
      dots.visible = S.cell_dots > 0.004 || S.cell_gene >= 0;
      const mk = clamp(S.cell_many, 0, 1);
      mU.uK.value = mk; TKU.uK.value = 1 - 0.75 * mk; manyLines.material.uniforms.uReveal.value = mk * 1.12; manyPts.visible = manyLines.visible = mk > 0.003;
      RU.uRev.value = clamp(S.cell_rev, 0, 1); RU.uTwo.value = clamp(S.cell_two, 0, 1);
      revLines.material.uniforms.uReveal.value = RU.uRev.value;
      revPts.visible = revLines.visible = S.cell_rev > 0.002 && S.cell_gene >= 0;
    },
    anchors: {
      centre: [0, 0, 0], substance: SRC, outer, many: () => spiral(0, MANY, SHELL, 0.8),
      moving: () => v3.lerp(FROM, SRC, smooth(clamp(S0.cell_sp || 0, 0, 1))),
      gene: () => (S0.cell_gene >= 0 ? at(Math.round(S0.cell_gene)) : [0, 0, 0]),
      casp3: () => (CASP3 >= 0 ? at(CASP3) : [0, 0, 0]),
      g2: () => pAt(top[1][0]), g3: () => pAt(top[2][0]),
      two0: () => revPos[0] || [0, 0, 0], two1: () => revPos[1] || [0, 0, 0],
    },
    labels: [
      { text: () => [lab(shownSub), S0.cell_thr > 0.6 ? ` · ${fmt(XDATA.ngenes[shownSub] || 0)} genes` + (nThr > MAXT ? `, ${fmt(MAXT)} threads drawn` : '') : ''], at: 'moving', cls: 'cyn',
        alpha: S => clamp(S.cell_sp, 0, 1) * (1 - clamp(S.cell_rev * 3, 0, 1)) * (S.cell_sub >= 0 ? 1 : 0) },
      { text: ['A sample', ` · ${MANY} substances, ${PER} threads each at most`], at: 'many', minor: true, alpha: S => K.prog(S.cell_many, 0.5, 1) * (1 - clamp(S.cell_rev * 3, 0, 1)) },
      { text: ['Place not known', ` · ${fmt(unknown)} proteins`], at: 'outer', alpha: S => clamp(S.cell_note, 0, 1) * clamp(S.cell_dots, 0, 1), minor: true },
      { text: () => ['CASP3', rn ? ` · ${fmt(rn)} substances` : ''], at: 'casp3', cls: 'amb', alpha: S => (S.cell_gene >= 0 ? K.prog(S.cell_rev, 0, 0.15) : 0) },
      { text: () => [top[1][0], ` · ${fmt(top[1][1])}`], at: 'g2', alpha: S => K.prog(S.cell_rev, 0.35, 0.5) * (1 - clamp(S.cell_two, 0, 1)), minor: true },
      { text: () => [top[2][0], ` · ${fmt(top[2][1])}`], at: 'g3', alpha: S => K.prog(S.cell_rev, 0.4, 0.55) * (1 - clamp(S.cell_two, 0, 1)), minor: true },
      { text: () => [lab(revSubs[0] === undefined ? -1 : revSubs[0]), ''], at: 'two0', cls: 'cyn', alpha: S => (S.cell_gene >= 0 ? clamp(S.cell_two, 0, 1) : 0) },
      { text: () => [lab(revSubs[1] === undefined ? -1 : revSubs[1]), ''], at: 'two1', cls: 'cyn', alpha: S => (S.cell_gene >= 0 ? clamp(S.cell_two, 0, 1) : 0) },
    ],
    cam: {
      default: [22, 12, 4.3, 0.35, 0.05, 0.1],
      come: [30, 8, 3.4, 1.3, 0.35, 0.3],
      close: [30, 10, 3.5, 0.4, 0.05, 0.1],
      wide: [24, 16, 6.4, 0, 0, 0],
      rev: [28, 14, 6.6, 0, 0, 0],
    },
    controls: [
      { key: 'show', label: 'Threads', options: [['in', 'Into the cell'], ['many', 'Many substances'], ['out', 'Out from CASP3']] },
      { key: 'skin', label: 'Rooms', options: [['on', 'Shown'], ['off', 'Faint']] },
    ],
    explore(c) {
      stepC();
      const s = pickSubC(), out = c.show === 'out';
      return { cell_sub: s, cell_sp: out ? 0 : 1, cell_thr: c.show === 'in' ? 1 : 0, cell_many: c.show === 'many' ? 1 : 0,
        cell_gene: out ? CASP3 : -1, cell_rev: out ? 1 : 0, cell_two: 0, cell_shell: c.skin === 'off' ? 0.2 : 1, cell_dots: 1, cell_note: 1 };
    },
    api: () => ({
      // the protein nearest a ray (in world coordinates), or -1
      pick: rc => nearestOnRay(rc, set.group, CP, n, 0.03),
      pos: p => at(p),
    }),
  });
};
// the load's prep, a slice a step: the files, then the skins (Back into the cell's own code, the longest part), then
// CASP3's substances (a scan of every substance's genes)
const CELL_PRE = { stage: 0 };
SETS.cell.prep = () => {
  if (!XDATA.need(['ppi', 'targets'], pkgUrl)) return false;
  const P = CELL_PRE;
  if (P.stage === 0) {
    const { v3, clamp } = K, stand = { uA: { value: 0 }, mats: [] };
    const mul = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const perp = d => v3.norm(Math.abs(d[0]) < 0.9 ? v3.cross(d, [1, 0, 0]) : v3.cross(d, [0, 1, 0]));
    stand.group = new THREE.Group();
    P.cut = EXPO_CELL(K, THREE, clamp, v3, stand, mul, perp);
    P.stage = 1; return false;
  }
  if (P.stage === 1) {
    P.rev = (XDATA.ppi.N && XDATA.ready('targets') && XDATA.subsOfGene('CASP3')) || [];
    // the two lit at "two substances, the same genes?" are chapter threads' pair (pair.js) when the data says both touch
    // CASP3 (it does); else the first two of its list
    const two = PAIR_NAMES.map(nm => XDATA.label.indexOf(nm));
    if (two.every(i => i >= 0 && P.rev.includes(i))) P.rev = two.concat(P.rev.filter(i => !two.includes(i)));
    P.stage = 2;
  }
  return true;
};
// the point of P (n points, x y z, in obj's frame) nearest a world ray, within tol (local units) of it, nearer side first;
// -1 for none (shared by C's sets' picks)
const _nrM = new THREE.Matrix4(), _nrR = new THREE.Ray();
function nearestOnRay(rc, obj, P, n, tol, skip) {
  if (!P || !n) return -1;
  obj.updateWorldMatrix(true, false);
  _nrR.copy(rc.ray).applyMatrix4(_nrM.copy(obj.matrixWorld).invert());
  const o = _nrR.origin, d = _nrR.direction, dl = d.length();
  const dx = d.x / dl, dy = d.y / dl, dz = d.z / dl;
  let best = -1, bs = Infinity;
  for (let i = 0; i < n; i++) {
    if (skip && skip(i)) continue;
    const px = P[3 * i] - o.x, py = P[3 * i + 1] - o.y, pz = P[3 * i + 2] - o.z, t = px * dx + py * dy + pz * dz;
    if (t <= 0) continue;
    const qx = px - t * dx, qy = py - t * dy, qz = pz - t * dz, e = qx * qx + qy * qy + qz * qz, tl = tol * (1 + 0.25 * t);
    if (e > tl * tl) continue;
    const sc = e / (tl * tl) + t * 0.02;
    if (sc < bs) { bs = sc; best = i; }
  }
  return best;
}
