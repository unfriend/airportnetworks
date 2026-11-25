// The interactome (18,815 proteins; a drawn sample of 30,000 of its 482,935 contacts, ppi.bin), first where Back into the
// cell puts its proteins, then taken out and sorted: each protein in its own direction from the cell's centre, the best
// connected in the middle, loners at the rim (XDATA.ppi.sorted: our drawing, not the authors'). On it: a substance's
// targets (the four patterns' examples with every contact among their targets, counted by the generator, a sample
// drawn); every substance with a hazard score as a flare, brighter the more harmful, placed in the direction of its
// targets at the depth of its best connected one; a hit spreading over the drawn contacts (an illustration); a disease's
// proteins drawn together as a neighbourhood with its own contacts; the steps from ozone's targets to asthma (the
// shortest paths over every contact, from the generator: EX.ozoneAsthma); substance-disease pairs flashing, the close
// ones bright. Every position moves in the vertex shaders, from params: seeking works.
// Draws: proteins, contacts, a substance's targets and their contacts, a disease's proteins and contacts, the paths,
// the flares, the diseases and the pairs: 10 at most, most of them hidden at any moment.
// Params (src/SPEC.md, "The sets"; keyed in engine/e3c_world.js):
//   ppi_links 0     the drawn contacts (0..1)          ppi_sort 1      in the cell (0) -> sorted (1)
//   ppi_pat -1      a pattern (step 0..3): its example and colour (EX.patterns)
//   ppi_sub -1      a substance's targets lit (step)    ppi_hl 1        how bright they are (0..1)
//   ppi_haz 0       the hazard flares (0..1)            ppi_dis -1      a disease (step), its proteins drawn together
//   ppi_dhl 1       how bright the disease is (0..1)    ppi_gat 1       its proteins gathered into a neighbourhood (0..1)
//   ppi_paths 0     the steps from the substance's targets to the disease (0..1; ozone and asthma only)
//   ppi_pairs 0     substance-disease pairs flashing (0..1)
//   ppi_ripple 0    a hit spreading over the contacts (0..1, the front's progress); ppi_rip 0 (step): 0 from the middle, 1 from the rim
//   ppi_shrink 0    the whole drawing shrunk to a point (0..1)        ppi_tags 0    the hubs and loners named (0..1)
const PPI_PRE = { i: 0, sp: null, n: 0 };
// (each substance's place on the sorted drawing: in the mean direction of its targets, at the depth of its best
// connected one; built a slice at a time once the files are in, a step of the load)
function ppiPrep() {
  if (PPI_PRE.done) return true;
  const Q = XDATA.ppi, n = Q.N, N = XDATA.N;
  if (!n || !XDATA.ready('targets')) { PPI_PRE.done = true; return true; }
  if (!PPI_PRE.sp) { PPI_PRE.sp = new Float32Array(3 * N); PPI_PRE.ok = new Uint8Array(N); }
  const S = Q.sorted, sp = PPI_PRE.sp, t0 = performance.now();
  for (; PPI_PRE.i < N; PPI_PRE.i++) {
    const i = PPI_PRE.i, T = XDATA.targetsPPI(i);
    if (!T || !T.length) continue;
    let x = 0, y = 0, z = 0, best = 1e9;
    for (const p of T) {
      const a = S[3 * p], b = S[3 * p + 1], c = S[3 * p + 2], l = Math.hypot(a, b, c) || 1;
      x += a / l; y += b / l; z += c / l; if (p < best) best = p;
    }
    const m = T.length, h1 = ((i * 2654435761) >>> 0) / 4294967296, h2 = ((i * 2246822519 + 7) >>> 0) / 4294967296;
    const jz = h1 * 2 - 1, ja = h2 * Math.PI * 2, js = Math.sqrt(1 - jz * jz);
    x = x / m + 0.45 * js * Math.cos(ja); y = y / m + 0.45 * jz; z = z / m + 0.45 * js * Math.sin(ja);
    const l = Math.hypot(x, y, z) || 1, r = Math.hypot(S[3 * best], S[3 * best + 1], S[3 * best + 2]) * (0.92 + 0.16 * h1);
    sp[3 * i] = x / l * r; sp[3 * i + 1] = y / l * r; sp[3 * i + 2] = z / l * r; PPI_PRE.ok[i] = 1;
    if ((i & 255) === 0 && performance.now() - t0 > 12) { PPI_PRE.i++; return false; }
  }
  PPI_PRE.done = true;
  return true;
}
SETS.ppi = function (K) {
  const { THREE, clamp, smooth, v3 } = K;
  const set = K.newSet('ppi');
  const G = new THREE.Group();   // (shrunk to a point by ppi_shrink)
  set.group.add(G);
  const Q = XDATA.ppi, n = Q.N, CP = Q.cell || new Float32Array(3), SP = Q.sorted || new Float32Array(3), deg = Q.deg || [1];
  const EX = XDATA.ex, OA = EX.ozoneAsthma || {}, PATS = EX.patterns || [];
  const lmax = Math.log(Math.max(2, deg[0] || 2));
  const rad = p => Math.hypot(SP[3 * p], SP[3 * p + 1], SP[3 * p + 2]);
  const sAt = p => [SP[3 * p], SP[3 * p + 1], SP[3 * p + 2]];
  const dl = p => clamp(p / Math.max(1, n), 0, 1);   // (the best connected leave the cell first)

  // ------------------------------------------------------------ shared vertex code: in the cell -> sorted -> gathered
  const U = { uSort: { value: 1 }, uGat: { value: 0 } };
  const MIXH = 'attribute vec3 aPos2, aGat; attribute float aDl, aGw; uniform float uSort, uGat, uK;';
  const MIXV = `float s_ = smoothstep(aDl * 0.45, aDl * 0.45 + 0.55, uSort);
  vec3 p_ = mix(mix(position, aPos2, s_), aGat, uGat * aGw);`;
  const PTV = `vec4 mv2 = modelViewMatrix * vec4(p_, 1.0); gl_Position = projectionMatrix * mv2; gl_PointSize = pointPx(aSize, mv2);`;
  const more = (geo, nv) => {
    geo.setAttribute('aPos2', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    geo.setAttribute('aGat', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    geo.setAttribute('aDl', new THREE.BufferAttribute(new Float32Array(nv), 1));
    geo.setAttribute('aGw', new THREE.BufferAttribute(new Float32Array(nv), 1));
    return geo;
  };
  // a vertex v of geo at protein p (its two places, its delay, gathered or not)
  const putV = (geo, v, p, gat) => {
    const A = geo.attributes;
    A.position.array[3 * v] = CP[3 * p]; A.position.array[3 * v + 1] = CP[3 * p + 1]; A.position.array[3 * v + 2] = CP[3 * p + 2];
    A.aPos2.array[3 * v] = SP[3 * p]; A.aPos2.array[3 * v + 1] = SP[3 * p + 1]; A.aPos2.array[3 * v + 2] = SP[3 * p + 2];
    A.aDl.array[v] = dl(p);
    if (gat) { A.aGat.array.set(gat, 3 * v); A.aGw.array[v] = 1; } else A.aGw.array[v] = 0;
  };
  const dirty = (geo, nv, isLine) => { for (const k in geo.attributes) geo.attributes[k].needsUpdate = true; geo.setDrawRange(0, nv); };
  const ptsMat = (uni, extra) => K.points(set, { uniforms: Object.assign({ uK: { value: 1 } }, U, uni || {}), head: MIXH + (extra && extra.head || ''), vertex: MIXV + PTV + (extra && extra.vertex || '') + ' vA *= uK;' });
  const lineMat = (uni, extra) => K.lines(set, { uniforms: Object.assign({ uK: { value: 1 } }, U, uni || {}), head: MIXH + (extra && extra.head || ''),
    vertex: MIXV + ' gl_Position = projectionMatrix * modelViewMatrix * vec4(p_, 1.0);' + (extra && extra.vertex || '') + ' vA *= uK;' });
  const add = (o, order) => { o.frustumCulled = false; o.renderOrder = order; G.add(o); return o; };

  // ------------------------------------------------------------ the proteins (and the hit spreading over the contacts)
  const L = Q.links || new Uint16Array(0), nl = L.length / 2;
  // hops from a hit over the drawn contacts: from the best connected protein (0) and from a loner at the rim
  const adjOff = new Uint32Array(n + 1), adj = new Uint32Array(2 * nl);
  for (let j = 0; j < 2 * nl; j++) adjOff[L[j] + 1]++;
  for (let i = 0; i < n; i++) adjOff[i + 1] += adjOff[i];
  { const f = adjOff.slice(); for (let j = 0; j < nl; j++) { adj[f[L[2 * j]]++] = L[2 * j + 1]; adj[f[L[2 * j + 1]]++] = L[2 * j]; } }
  const hops = src => {
    const h = new Float32Array(Math.max(1, n)).fill(255);
    if (src < 0 || !n) return h;
    let fr = [src]; h[src] = 0;
    for (let d = 1; fr.length && d < 12; d++) { const nx = []; for (const u of fr) for (let k = adjOff[u]; k < adjOff[u + 1]; k++) { const w = adj[k]; if (h[w] === 255) { h[w] = d; nx.push(w); } } fr = nx; }
    return h;
  };
  let rim = -1;
  for (let p = n - 1; p >= 0 && rim < 0; p--) if (Q.place[p] < 13 && adjOff[p + 1] > adjOff[p] && rad(p) > 0.9 && SP[3 * p] > 0.2) rim = p;
  const g = more(K.pointsGeo(Math.max(1, n)), Math.max(1, n));
  const hot = K.rgb('#ffe2a6'), mid = K.rgb(LOOK.protein), cold = K.rgb('#4f6fae');
  const off = new Float32Array(Math.max(1, n));
  for (let p = 0; p < n; p++) {
    putV(g, p, p);
    const x = 1 - Math.log(Math.max(1, deg[p])) / lmax;   // 0 the best connected .. 1 a loner
    g.attributes.aCol.array.set(x < 0.35 ? v3.lerp(hot, mid, x / 0.35) : v3.lerp(mid, cold, (x - 0.35) / 0.65), 3 * p);
    g.attributes.aSize.array[p] = 0.0085 + 0.009 * (1 - x); g.attributes.aA.array[p] = 0.15 + 0.3 * (1 - x);
  }
  g.setAttribute('aHop0', new THREE.BufferAttribute(hops(0), 1)); g.setAttribute('aHop1', new THREE.BufferAttribute(hops(rim), 1));
  g.setAttribute('aOff', new THREE.BufferAttribute(off, 1));
  const BU = { uDim: { value: 0 }, uRipT: { value: -5 }, uRipK: { value: 0 } };
  const base = add(new THREE.Points(g, ptsMat(BU, { head: 'attribute float aHop0, aHop1, aOff; uniform float uDim, uRipT, uRipK;', vertex: `
  float hop = uRipK < 0.5 ? aHop0 : aHop1;
  float pulse = hop < 200.0 ? exp(-pow(uRipT - hop, 2.0) * 2.5) * pow(0.3, hop) : 0.0;
  vec3 q_ = p_ + normalize(p_ + vec3(1e-4)) * 0.06 * pulse;
  mv2 = modelViewMatrix * vec4(q_, 1.0); gl_Position = projectionMatrix * mv2;
  gl_PointSize = pointPx(aSize * (1.0 + 2.5 * pulse), mv2);
  vC = mix(vC, vec3(1.0, 0.97, 0.9), clamp(pulse * 1.6, 0.0, 1.0));
  vA = vA * (1.0 - 0.8 * uDim) * (1.0 - aOff * uGat) + clamp(pulse * 1.4, 0.0, 1.0) * uA;` })), 10);

  // ------------------------------------------------------------ the drawn contacts
  const lg = more(K.linesGeo(Math.max(1, nl)), Math.max(1, 2 * nl)), lcol = K.rgb('#7d9bdc');
  for (let j = 0; j < nl; j++) {
    putV(lg, 2 * j, L[2 * j]); putV(lg, 2 * j + 1, L[2 * j + 1]);
    lg.attributes.aCol.array.set(lcol, 6 * j); lg.attributes.aCol.array.set(lcol, 6 * j + 3);
    const a = 0.009 + 0.014 * (1 - dl(Math.max(L[2 * j], L[2 * j + 1])));
    lg.attributes.aA.array[2 * j] = a; lg.attributes.aA.array[2 * j + 1] = a;
  }
  const links = add(new THREE.LineSegments(lg, lineMat()), 8);
  // (for the headset's keep clear: every protein where it stands in the cell and where it stands sorted, never drawn
  // (its material hidden) but sampled, since the drawn points move in their shaders, not in their positions)
  const cg = new THREE.BufferGeometry(), cp = new Float32Array(Math.max(3, 6 * n));
  cp.set(CP.subarray(0, 3 * n)); cp.set(SP.subarray(0, 3 * n), 3 * n);
  cg.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  add(new THREE.Points(cg, new THREE.PointsMaterial({ visible: false })), 0);

  // ------------------------------------------------------------ a substance's targets and the contacts among them
  const SCAP = 14000, LCAP = 6000;
  const sg = more(K.pointsGeo(SCAP), SCAP), sl = more(K.linesGeo(LCAP), 2 * LCAP);
  const subPts = add(new THREE.Points(sg, ptsMat()), 13), subLines = add(new THREE.LineSegments(sl, lineMat()), 12);
  const isT = new Uint8Array(Math.max(1, n));
  let shownSub = -2, shownPat = -2, subC = [0, 0, 0], subN = 0;
  function showSub(s, pat) {
    shownSub = s; shownPat = pat; isT.fill(0);
    const T = s >= 0 ? XDATA.targetsPPI(s) || [] : [], m = Math.min(T.length, SCAP), col = K.rgb(pat >= 0 ? LOOK.pattern[pat] : LOOK.substance);
    subN = T.length;
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < m; j++) {
      const p = T[j]; isT[p] = 1; putV(sg, j, p);
      sg.attributes.aCol.array.set(col, 3 * j); sg.attributes.aSize.array[j] = (0.016 + 0.012 * (1 - dl(p))) * (m < 60 ? 2.2 : m < 400 ? 1.4 : 1); sg.attributes.aA.array[j] = m > 1000 ? 0.35 : m > 300 ? 0.7 : 1;
      cx += SP[3 * p]; cy += SP[3 * p + 1]; cz += SP[3 * p + 2];
    }
    // (its tag: at the mean of its targets, or for a few, at its first; pushed out of the crowded middle)
    subC = m ? (m <= 40 ? sAt(T[0]) : [cx / m, cy / m, cz / m]) : [0, 0, 0];
    if (m && Math.hypot(...subC) < 0.35) { const k = Math.hypot(...knot) > 0.01 && shownDis >= 0 ? v3.mul(v3.norm(knot), -0.5) : v3.mul(v3.norm(v3.add(subC, [0.3, 0.5, 0.4])), 0.45); subC = k; }
    dirty(sg, m);
    // the contacts among its targets: every one the generator counted for the four examples (a sample of them), else the
    // drawn sample's
    const ex = PATS.find(e => e.sub === s), E = ex ? ex.links : [];
    let v = 0;
    const put = (a, b) => {
      if (v >= LCAP) return;
      putV(sl, 2 * v, a); putV(sl, 2 * v + 1, b);
      sl.attributes.aCol.array.set(col, 6 * v); sl.attributes.aCol.array.set(col, 6 * v + 3);
      sl.attributes.aA.array[2 * v] = sl.attributes.aA.array[2 * v + 1] = ex ? 0.07 : 0.08; v++;
    };
    if (ex) for (let k = 0; k < E.length; k += 2) put(E[k], E[k + 1]);
    else if (s >= 0) for (let j = 0; j < nl; j++) if (isT[L[2 * j]] && isT[L[2 * j + 1]]) put(L[2 * j], L[2 * j + 1]);
    dirty(sl, 2 * v);
  }

  // ------------------------------------------------------------ a disease: its proteins drawn together, its own contacts
  const DCAP = 600, dg = more(K.pointsGeo(DCAP), DCAP), dlg = more(K.linesGeo(DCAP * 3), DCAP * 6);
  const disPts = add(new THREE.Points(dg, ptsMat()), 14), disLines = add(new THREE.LineSegments(dlg, lineMat()), 13);
  const gatOf = new Map();   // protein -> its place in the neighbourhood
  const asthma = XDATA.dis.find('Asthma');
  let shownDis = -2, knot = [0, 0, 0], disN = 0;
  function showDis(d) {
    shownDis = d; gatOf.clear();
    const Gn = d >= 0 ? Array.from(XDATA.dis.genes(d) || []).sort((a, b) => a - b).slice(0, DCAP) : [], m = Gn.length;
    disN = m; off.fill(0);
    // the neighbourhood: a small ball round the mean direction of its proteins, half way out, the best connected inside
    let x = 0, y = 0, z = 0;
    for (const p of Gn) { const r = rad(p) || 1; x += SP[3 * p] / r; y += SP[3 * p + 1] / r; z += SP[3 * p + 2] / r; }
    let l = Math.hypot(x, y, z);
    if (l < 0.15 * m || !m) { x = 0.55; y = 0.25; z = 0.8; l = Math.hypot(x, y, z); }
    knot = [x / l * 0.62, y / l * 0.62, z / l * 0.62];
    const R = 0.05 + 0.014 * Math.sqrt(m), ga = Math.PI * (3 - Math.sqrt(5)), col = K.rgb(LOOK.disease);
    Gn.forEach((p, k) => {
      const yy = 1 - 2 * (k + 0.5) / m, s = Math.sqrt(1 - yy * yy), a = ga * k, rr = R * Math.cbrt((k + 0.5) / m);
      const q = [knot[0] + rr * s * Math.cos(a), knot[1] + rr * yy, knot[2] + rr * s * Math.sin(a)];
      gatOf.set(p, q); off[p] = 1;
      putV(dg, k, p, q);
      dg.attributes.aCol.array.set(col, 3 * k); dg.attributes.aSize.array[k] = 0.026; dg.attributes.aA.array[k] = 1;
    });
    g.attributes.aOff.needsUpdate = true;
    dirty(dg, m);
    // its contacts: every one for asthma (the generator's), else the drawn sample's
    const E = d === asthma && OA.module ? OA.module : [];
    let v = 0;
    const put = (a, b) => { if (v >= DCAP * 3) return; putV(dlg, 2 * v, a, gatOf.get(a)); putV(dlg, 2 * v + 1, b, gatOf.get(b)); dlg.attributes.aCol.array.set(col, 6 * v); dlg.attributes.aCol.array.set(col, 6 * v + 3); dlg.attributes.aA.array[2 * v] = dlg.attributes.aA.array[2 * v + 1] = 0.55; v++; };
    if (E.length) for (let k = 0; k < E.length; k += 2) put(E[k], E[k + 1]);
    else if (d >= 0) for (let j = 0; j < nl; j++) if (gatOf.has(L[2 * j]) && gatOf.has(L[2 * j + 1])) put(L[2 * j], L[2 * j + 1]);
    dirty(dlg, 2 * v);
    showPaths();
  }

  // ------------------------------------------------------------ the steps from ozone's targets to asthma
  const PATHS = OA.paths || [], pg = more(K.linesGeo(Math.max(1, PATHS.length * 4)), Math.max(1, PATHS.length * 8));
  const pathLines = add(new THREE.LineSegments(pg, lineMat()), 15);
  let pathsOn = false;
  function showPaths() {
    pathsOn = shownSub === EX.ozone && shownDis === asthma && gatOf.size > 0;
    let v = 0;
    if (pathsOn) {
      const c0 = K.rgb(LOOK.substance), c1 = K.rgb('#ffe08a');
      PATHS.slice(0, 150).forEach((P, k) => {   // (150 of the generator's 240: enough to read, few enough to follow)
        const h = (((k + 1) * 2654435761) >>> 0) / 4294967296, st = P.length - 1;
        for (let j = 0; j < st; j++) {
          putV(pg, 2 * v, P[j], gatOf.get(P[j])); putV(pg, 2 * v + 1, P[j + 1], gatOf.get(P[j + 1]));
          pg.attributes.aCol.array.set(j ? c1 : c0, 6 * v); pg.attributes.aCol.array.set(c1, 6 * v + 3);
          pg.attributes.aT.array[2 * v] = 0.7 * h + 0.3 * j / st; pg.attributes.aT.array[2 * v + 1] = 0.7 * h + 0.3 * (j + 1) / st;
          pg.attributes.aA.array[2 * v] = pg.attributes.aA.array[2 * v + 1] = 0.2; v++;
        }
      });
    }
    dirty(pg, 2 * v);
  }

  // ------------------------------------------------------------ flares (substances), diseases, pairs
  const N = XDATA.N, SPS = PPI_PRE.sp || new Float32Array(3 * N), SOK = PPI_PRE.ok || new Uint8Array(N);
  const fg = K.pointsGeo(N), neutral = K.rgb('#9fd8ff');
  fg.setAttribute('aCol2', new THREE.BufferAttribute(new Float32Array(3 * N), 3));
  fg.setAttribute('aHz', new THREE.BufferAttribute(new Float32Array(N), 1));
  const HZ = LOOK.hazard.map(([t, c]) => [t, K.rgb(c)]);
  for (let i = 0; i < N; i++) {
    const hz = XDATA.hazard(i);
    fg.attributes.position.array.set(SPS.subarray(3 * i, 3 * i + 3), 3 * i);
    fg.attributes.aCol.array.set(hz >= 0 ? K.ramp(HZ, hz) : neutral, 3 * i);
    fg.attributes.aCol2.array.set(neutral, 3 * i);
    fg.attributes.aHz.array[i] = SOK[i] ? hz : -2;
    fg.attributes.aSize.array[i] = hz >= 0 ? 0.022 + 0.05 * hz : 0.014;
  }
  const FU = { uHaz: { value: 0 }, uPairs: { value: 0 } };
  const flares = add(new THREE.Points(fg, K.points(set, { uniforms: FU, head: 'attribute vec3 aCol2; attribute float aHz; uniform float uHaz, uPairs;', vertex: `
  float sc = aHz >= 0.0 ? 1.0 : 0.0;
  float tw = 0.85 + 0.15 * sin(uTime * 2.3 + aSize * 900.0);
  vA = uA * max(uHaz * sc * (0.06 + 0.94 * aHz) * tw, uPairs * 0.035 * step(-1.0, aHz));
  vC = mix(aCol2, vC, uHaz);
  if (aHz < -1.0) vA = 0.0;
  gl_PointSize = pointPx(aSize * mix(0.55, 1.0, uHaz), mv);` })), 16);
  // the diseases: each at the mean of its proteins' places (sorted), as a small red dot
  const nd = XDATA.dis.N, DPS = new Float32Array(3 * Math.max(1, nd)), dpg = K.pointsGeo(Math.max(1, nd)), dcol = K.rgb(LOOK.disease);
  for (let d = 0; d < nd; d++) {
    const Gn = XDATA.dis.genes(d);
    let x = 0, y = 0, z = 0;
    for (const p of Gn) { x += SP[3 * p]; y += SP[3 * p + 1]; z += SP[3 * p + 2]; }
    const m = Math.max(1, Gn.length), h = ((d * 2654435761) >>> 0) / 4294967296;
    DPS.set([x / m * (1 + 0.2 * h), y / m * (1 + 0.2 * h), z / m * (1 + 0.2 * h)], 3 * d);
    dpg.attributes.aCol.array.set(dcol, 3 * d); dpg.attributes.aSize.array[d] = 0.014;
  }
  dpg.attributes.position.array.set(DPS.subarray(0, dpg.attributes.position.array.length));
  const disDots = add(new THREE.Points(dpg, K.points(set, { uniforms: { uK: FU.uPairs }, head: 'uniform float uK;', vertex: 'vA *= uK * 0.4;' })), 16);
  // the pairs: a sample of the close ones (z < -5, diseases.bin) and as many pairs picked at random (tested, mostly not
  // close), each flashing in turn (a phase of its own, on story time), the close ones bright
  const PN = 2600, prg = K.linesGeo(2 * PN);
  prg.setAttribute('aPh', new THREE.BufferAttribute(new Float32Array(4 * PN), 1));
  {
    const F = XDATA.ready('diseases') ? XDATA.dis : null, close = K.rgb('#ffd27a'), far = K.rgb('#6f86b3');
    let v = 0;
    const put = (s, d, c, a, ph) => {
      prg.attributes.position.array.set(SPS.subarray(3 * s, 3 * s + 3), 6 * v); prg.attributes.position.array.set(DPS.subarray(3 * d, 3 * d + 3), 6 * v + 3);
      prg.attributes.aCol.array.set(c, 6 * v); prg.attributes.aCol.array.set(c, 6 * v + 3);
      prg.attributes.aA.array[2 * v] = prg.attributes.aA.array[2 * v + 1] = a;
      prg.attributes.aPh.array[2 * v] = prg.attributes.aPh.array[2 * v + 1] = ph; v++;
    };
    const rnd = K.rng(31);
    if (F && nd) {
      // (close pairs: by substance; a substance picked at random with a close pair, then its closest)
      for (let k = 0, tries = 0; k < PN && tries < 40 * PN; tries++) {
        const s = Math.floor(rnd() * XDATA.NN);
        if (!SOK[s] || !XDATA.close[s]) continue;
        const cl = F.closeOf(s);
        if (!cl || !cl.length) continue;
        const e = cl[Math.floor(rnd() * Math.min(cl.length, 6))];
        put(s, e.d, close, 0.32, rnd()); k++;
      }
      for (let k = 0; k < PN; k++) { const s = Math.floor(rnd() * XDATA.NN); if (!SOK[s]) { k--; continue; } put(s, Math.floor(rnd() * nd), far, 0.07, rnd()); }
    }
    prg.setDrawRange(0, 2 * v);
  }
  const pairs = add(new THREE.LineSegments(prg, K.lines(set, { uniforms: { uP: FU.uPairs }, head: 'attribute float aPh; uniform float uP;', vertex: `
  float f = fract(uTime * 0.21 + aPh);
  vA *= uP * (exp(-f * 9.0) * 0.9 + 0.1 * step(0.2, aA));` })), 17);

  // ------------------------------------------------------------ labels, views
  const patName = XDATA.meta.pattern.names, patShare = XDATA.meta.pattern.count.map(c => c / XDATA.meta.pattern.of);
  const sc = () => G.scale.x, sxs = p => [p[0] * sc(), p[1] * sc(), p[2] * sc()];
  let S0 = {};
  const knotView = () => {
    const l = Math.hypot(...knot) || 1;
    return [Math.atan2(knot[0], knot[2]) / D2R + 18, clamp(Math.asin(knot[1] / l) / D2R + 8, -60, 60), 1.75, knot[0] * 0.85, knot[1] * 0.85, knot[2] * 0.85];
  };
  if (asthma >= 0) showDis(asthma);
  const asthmaView = knotView();
  return Object.assign(set, {
    keepClear: true,   // (a headset keeps every protein clear of your head: the hidden stand-in above)
    params: { ppi_a: 1, ppi_links: 0, ppi_sort: 1, ppi_pat: -1, ppi_sub: -1, ppi_hl: 1, ppi_haz: 0, ppi_dis: -1, ppi_dhl: 1, ppi_gat: 1,
      ppi_paths: 0, ppi_pairs: 0, ppi_ripple: 0, ppi_rip: 0, ppi_shrink: 0, ppi_tags: 0 },
    update(S) {
      S0 = S;
      const k = 1 - 0.999 * smooth(clamp(S.ppi_shrink, 0, 1));
      G.scale.setScalar(k);
      U.uSort.value = clamp(S.ppi_sort, 0, 1);
      const pat = Math.round(S.ppi_pat), sub = Math.round(S.ppi_sub), dis = Math.round(S.ppi_dis);
      if (sub !== shownSub || pat !== shownPat) { showSub(sub, pat); showPaths(); }
      if (dis !== shownDis) showDis(dis);
      const hl = sub >= 0 ? clamp(S.ppi_hl, 0, 1) : 0, dh = dis >= 0 ? clamp(S.ppi_dhl, 0, 1) : 0;
      subPts.material.uniforms.uK.value = hl; subLines.material.uniforms.uK.value = hl;
      subPts.visible = subLines.visible = hl > 0.003;
      disPts.material.uniforms.uK.value = dh; disLines.material.uniforms.uK.value = dh;
      disPts.visible = disLines.visible = dh > 0.003;
      U.uGat.value = dis >= 0 ? smooth(clamp(S.ppi_gat, 0, 1)) * dh : 0;
      pathLines.material.uniforms.uReveal.value = clamp(S.ppi_paths, 0, 1);
      pathLines.visible = pathsOn && S.ppi_paths > 0.003;
      links.material.uniforms.uK.value = clamp(S.ppi_links, 0, 1); links.visible = S.ppi_links > 0.003;
      FU.uHaz.value = clamp(S.ppi_haz, 0, 1); FU.uPairs.value = clamp(S.ppi_pairs, 0, 1);
      flares.visible = S.ppi_haz > 0.003 || S.ppi_pairs > 0.003; disDots.visible = pairs.visible = S.ppi_pairs > 0.003;
      BU.uDim.value = clamp(Math.max(hl, dh, S.ppi_haz * 0.8, S.ppi_pairs * 0.8), 0, 1);
      const r = clamp(S.ppi_ripple, 0, 1);
      BU.uRipK.value = Math.round(S.ppi_rip) === 1 ? 1 : 0; BU.uRipT.value = r > 0.001 && r < 0.999 ? -1 + r * 7 : -5;
    },
    anchors: {
      centre: [0, 0, 0],
      hubs: () => sxs([0, 0.02, 0]),
      rim: () => sxs(rim >= 0 ? sAt(rim) : [1, 0, 0]),
      core: () => sxs([0.04, 0.12, 0.05]),
      sub: () => sxs(subC),
      knot: () => sxs(knot),
      between: () => sxs(v3.lerp(subC, knot, 0.5)),
      steps: () => sxs(v3.add(knot, v3.mul(v3.norm(knot), 0.22))),
      pairs: () => sxs([0.2, 0.75, 0.2]),
    },
    labels: [
      { text: ['Hubs', ' · our arrangement: most contacts in the middle'], at: 'hubs', cls: 'amb', alpha: S => clamp(S.ppi_tags, 0, 1) * K.prog(S.ppi_sort, 0.7, 1) },
      { text: ['Loners', ' · few contacts'], at: 'rim', alpha: S => clamp(S.ppi_tags, 0, 1) * K.prog(S.ppi_sort, 0.7, 1) },
      { text: () => [shownSub >= 0 ? XDATA.label[shownSub] : '', shownPat >= 0 ? ` · ${patName[shownPat]} (${Math.round(100 * patShare[shownPat])} %)` : shownSub >= 0 ? ` · ${fmt(subN)} proteins` : ''],
        at: 'sub', cls: 'cyn', alpha: S => (S.ppi_sub >= 0 ? clamp(S.ppi_hl, 0, 1) : 0) * (1 - clamp(S.ppi_pairs * 2, 0, 1)) },
      { text: () => [shownDis >= 0 ? XDATA.dis.name(shownDis) : '', shownDis >= 0 ? ` · ${fmt(disN)} proteins, drawn together here` : ''], at: 'knot', cls: 'mag',
        alpha: S => (S.ppi_dis >= 0 ? clamp(S.ppi_dhl, 0, 1) : 0) * (1 - clamp(S.ppi_paths * 1.5, 0, 1) * 0) },
      { text: () => ['Steps', OA.mean ? ` · ${OA.mean.toFixed(1)} on average` : ''], at: 'steps', cls: 'amb', alpha: S => (pathsOn ? K.prog(S.ppi_paths, 0.5, 0.9) : 0) },
      { text: ['An illustration', ' · a hit spreading'], at: () => (Math.round(S0.ppi_rip) === 1 ? sxs(rim >= 0 ? sAt(rim) : [1, 0, 0]) : sxs([0, -0.08, 0])),
        alpha: S => K.prog(S.ppi_ripple, 0, 0.08) * (1 - K.prog(S.ppi_ripple, 0.85, 1)) },
      { text: ['A sample of the pairs', ' · the close ones bright'], at: 'pairs', cls: 'amb', alpha: S => K.prog(S.ppi_pairs, 0.5, 1) },
    ],
    cam: {
      default: [20, 14, 3.9, 0, 0, 0],
      cell: [22, 12, 4.3, 0.35, 0.05, 0.1],
      core: [26, 12, 2.6, 0, 0, 0],
      asthma: asthmaView,
      far: [20, 14, 7.5, 0, 0, 0],
    },
    controls: [
      { key: 'view', label: 'Arrange', options: [['sorted', 'Sorted by contacts'], ['cell', 'In the cell']] },
      { key: 'show', label: 'Show', options: [['pick', 'Your picks'], ['patterns', 'Four patterns'], ['hazard', 'Hazard'], ['pairs', 'Pairs']] },
      { key: 'pat', label: 'Pattern', options: [['0', 'Central module'], ['1', 'Hubs'], ['2', 'Module at the edge'], ['3', 'Scattered']], when: v => v.show === 'patterns' },
      { key: 'links', label: 'Contacts', options: [['on', 'Drawn'], ['off', 'Hidden']] },
    ],
    explore(c) {
      stepC();
      const o = { ppi_sort: c.view === 'cell' ? 0 : 1, ppi_links: c.links === 'off' ? 0 : 0.6, ppi_hl: 1, ppi_dhl: 1, ppi_gat: c.view === 'cell' ? 0 : 1,
        ppi_pat: -1, ppi_sub: -1, ppi_dis: -1, ppi_haz: 0, ppi_pairs: 0, ppi_paths: 0, ppi_tags: c.show === 'pick' && XC.dis < 0 && pickSubC(-1) < 0 ? 1 : 0 };
      if (c.show === 'pick') { o.ppi_sub = pickSubC(-1); o.ppi_dis = XC.dis; o.ppi_paths = 1; }
      else if (c.show === 'patterns') { const k = clamp(+c.pat || 0, 0, 3); o.ppi_pat = k; o.ppi_sub = PATS[k] ? PATS[k].sub : -1; }
      else if (c.show === 'hazard') o.ppi_haz = 1;
      else if (c.show === 'pairs') o.ppi_pairs = 1;
      return o;
    },
    api: () => ({
      // the protein nearest a ray, on the drawing as it is now (sorted or in the cell), or -1
      pick: rc => nearestOnRay(rc, G, U.uSort.value > 0.5 ? SP : CP, n, 0.025),
      pos: p => sxs(U.uSort.value > 0.5 ? sAt(p) : [CP[3 * p], CP[3 * p + 1], CP[3 * p + 2]]),
      asthma,
    }),
  });
};
SETS.ppi.prep = () => XDATA.need(['ppi', 'targets', 'diseases'], pkgUrl) && ppiPrep();
