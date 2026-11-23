// The tree set of the endotype story: from the neighbourhoods' terms to the 12 endotypes. The gene x term matrix
// fills row by row, the dendrogram grows beside it, the split tests run down the tree from the root (a kept split
// parts the rows, a refused one gives an endotype its colour), the genes fly to positions by their tree distances,
// and the endotype network (the poster's metagraph) gathers them into bubbles on a ring. All geometry is built once;
// positions, colours and morphs are worked out in the shaders from a few dozen uniforms that update() sets.
SETS.tree = function (K) {
  const { THREE, smooth, clamp, lerp, prog, rng, rgb } = K;
  const set = K.newSet('tree');
  const D = ENDO_DATA, EN = D.endo, NE = EN.length, N = D.mod, NT = D.terms.length, PI = Math.PI, TAU = PI * 2;

  // ---------------------------------------------------------------- decode the data (once)
  const bytes = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const u16 = s => { const b = bytes(s); return new Uint16Array(b.buffer, 0, b.length >> 1); };
  const GENE = bytes(D.gene), SEED = bytes(D.seedOf), AB = u16(D.tree.ab), TH = bytes(D.tree.h), TCUT = bytes(D.tree.cut);
  const FN = u16(D.featN), FI = u16(D.featI), LK = u16(D.links), ML = D.modLinks || 0;
  const NAME = D.names.split('|').slice(0, N);
  const ECOL = EN.map(e => rgb(e.col));
  const MEM = EN.map(() => []); for (let i = 0; i < N; i++) MEM[GENE[i]].push(i);

  // the tree: node ids as in scipy (0..N-1 the genes, N + k merge k); leaves are in tree order, so every node spans a
  // run of rows LO..HI, and u (its row coordinate) is the middle of its two children's
  const NN = 2 * N - 1, ROOT = NN - 1;
  const NU = new Float32Array(NN), NH = new Float32Array(NN), LO = new Int32Array(NN), HI = new Int32Array(NN), PAR = new Int32Array(NN).fill(-1);
  for (let i = 0; i < N; i++) { NU[i] = i; LO[i] = HI[i] = i; }
  for (let k = 0; k < N - 1; k++) {
    const a = AB[2 * k], b = AB[2 * k + 1], n = N + k;
    NU[n] = (NU[a] + NU[b]) / 2; NH[n] = TH[k] / 255; LO[n] = Math.min(LO[a], LO[b]); HI[n] = Math.max(HI[a], HI[b]); PAR[a] = n; PAR[b] = n;
  }
  const KA = n => AB[2 * (n - N)], KB = n => AB[2 * (n - N) + 1];
  // the kept splits (cut 1), children before parents; each parts the rows at one boundary between two endotypes
  const CUTN = []; for (let k = 0; k < N - 1; k++) if (TCUT[k]) CUTN.push(N + k);
  const NC = Math.max(1, CUTN.length), CI = new Int32Array(NN).fill(-1); CUTN.forEach((n, j) => { CI[n] = j; });
  const BND = new Float32Array(NC).fill(1e6), CKA = new Int32Array(NC), CKB = new Int32Array(NC);
  CUTN.forEach((n, j) => { const a = KA(n), b = KB(n); CKA[j] = a; CKB[j] = b; BND[j] = (HI[a] < LO[b] ? HI[a] : HI[b]) + 0.5; });
  // the test pulse: it starts on a short trunk left of the root and arrives at each node of the kept tree at TAUN;
  // where it meets a split inside an endotype (that endotype's root) the test refuses and the endotype's colour runs
  // down its subtree (WD) and across its rows of the matrix (WA)
  const EROOT = new Int32Array(NE).fill(-1), TAUN = new Float32Array(NN).fill(-1);
  const visit = (n, tau) => {
    TAUN[n] = tau;
    if (CI[n] >= 0) for (const c of [KA(n), KB(n)]) visit(c, tau + 0.45 + 1.6 * (NH[n] - NH[c]));
    else EROOT[GENE[LO[n]]] = n;
  };
  visit(ROOT, 0);
  const TE = Array.from(EROOT, n => (n >= 0 ? TAUN[n] : 0)), WD = 1.0, WA = 0.8, P0 = -0.55, HTOP = 1.07;
  const PEND = Math.max(...TE) + WD + WA + 0.25;
  const washT = (e, h) => { const r = EROOT[e]; return TE[e] + WD * (1 - h / Math.max(r >= 0 ? NH[r] : 1, 1e-3)); };

  // the matrix: rows = genes, columns = terms ordered by the mean row of their ones, so its structure shows
  const OFF = new Int32Array(N + 1); for (let i = 0; i < N; i++) OFF[i + 1] = OFF[i] + FN[i];
  const tSum = new Float64Array(NT), tCnt = new Int32Array(NT);
  for (let i = 0; i < N; i++) for (let q = OFF[i]; q < OFF[i + 1]; q++) { tSum[FI[q]] += i; tCnt[FI[q]]++; }
  const ORDER = Array.from({ length: NT }, (_, c) => c).sort((a, b) => (tCnt[a] ? tSum[a] / tCnt[a] : 1e9) - (tCnt[b] ? tSum[b] / tCnt[b] : 1e9) || a - b);
  const COLX = new Int32Array(NT); ORDER.forEach((c, x) => { COLX[c] = x; });

  // the module's own links: inside an endotype (drawn in its bubble) and between two (the grey bands)
  const WL = [], BT = new Int32Array(NE * NE), OWN = new Int32Array(NE);
  for (let k = 0; k < ML; k++) {
    const a = LK[2 * k], b = LK[2 * k + 1]; if (a >= N || b >= N) continue;
    const ea = GENE[a], eb = GENE[b];
    if (ea === eb) { WL.push(a, b); OWN[ea]++; } else { BT[ea * NE + eb]++; BT[eb * NE + ea]++; }
  }
  const LOOSE = EN.map((e, k) => OWN[k] === 0);

  // ---------------------------------------------------------------- the look's dimensions (local units)
  const RH = 1.3, RP = RH / N, Y0 = (N - 1) * RP / 2, GAP = 0.02;           // rows: 1.3 tall, parting by GAP per kept split
  const MW = 1.5, CP = MW / NT, X0 = -0.36, X1 = X0 + MW;                  // columns: 1.5 wide
  const XL = X0 - 0.05, WT = 0.78, ZT = 0.3;                               // the tree: leaves at XL, root WT further left
  const XD = XL + 0.024;                                                   // the genes' dots between the leaves and the matrix
  const SZC = Math.min(RP, CP) * 1.08;

  // ---------------------------------------------------------------- positions by tree distance: metric MDS (SMACOF) of
  // the endotypes by the height where their subtrees meet, then of each endotype's genes by their own tree distances
  // (drawn smaller, so the endotypes read as clusters)
  function smacof(n, d, iters, r) {
    const X = new Float64Array(3 * n), Y = new Float64Array(3 * n);
    for (let i = 0; i < 3 * n; i++) X[i] = r() - 0.5;
    for (let it = 0; it < iters; it++) {
      Y.fill(0);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = X[3 * i] - X[3 * j], dy = X[3 * i + 1] - X[3 * j + 1], dz = X[3 * i + 2] - X[3 * j + 2];
        const dd = Math.sqrt(dx * dx + dy * dy + dz * dz), b = dd > 1e-9 ? d[i * n + j] / dd : 0;
        Y[3 * i] += b * dx; Y[3 * i + 1] += b * dy; Y[3 * i + 2] += b * dz; Y[3 * j] -= b * dx; Y[3 * j + 1] -= b * dy; Y[3 * j + 2] -= b * dz;
      }
      for (let i = 0; i < 3 * n; i++) X[i] = Y[i] / n;
    }
    let cx = 0, cy = 0, cz = 0; for (let i = 0; i < n; i++) { cx += X[3 * i]; cy += X[3 * i + 1]; cz += X[3 * i + 2]; }
    for (let i = 0; i < n; i++) { X[3 * i] -= cx / n; X[3 * i + 1] -= cy / n; X[3 * i + 2] -= cz / n; }
    return X;
  }
  const R0 = rng(393457);
  const ED = new Float64Array(NE * NE);
  { const anc = Array.from(EROOT, n => { const s = new Set(); for (let x = n; x >= 0; x = PAR[x]) s.add(x); return s; });
    for (let e = 0; e < NE; e++) for (let f = 0; f < NE; f++) if (e !== f) {
      let x = EROOT[f]; while (x >= 0 && !anc[e].has(x)) x = PAR[x];
      ED[e * NE + f] = x >= 0 ? NH[x] : 1;
    } }
  const CE = smacof(NE, ED, 160, R0);
  const DL = EN.map((e, k) => { const r = EROOT[k], n = r >= 0 ? HI[r] - LO[r] + 1 : 0; return new Float64Array(n * n).fill(0.04); });
  for (let k = 0; k < N - 1; k++) {
    const m = N + k; if (CI[m] >= 0) continue;
    const e = GENE[LO[m]], r = EROOT[e]; if (r < 0) continue;
    const lo = LO[r], n = HI[r] - lo + 1, d = DL[e], a = KA(m), b = KB(m), h = Math.max(NH[m], 0.04);
    for (let i = LO[a]; i <= HI[a]; i++) for (let j = LO[b]; j <= HI[b]; j++) { d[(i - lo) * n + j - lo] = h; d[(j - lo) * n + i - lo] = h; }
  }
  const MDS = new Float32Array(3 * N), WPOS = new Float32Array(3 * N);
  for (let e = 0; e < NE; e++) {
    const r = EROOT[e]; if (r < 0) continue;
    const lo = LO[r], n = HI[r] - lo + 1, X = n > 1 ? smacof(n, DL[e], 70, R0) : new Float64Array(3);
    let mx = 1e-6; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.hypot(X[3 * i], X[3 * i + 1], X[3 * i + 2]));
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) {
      WPOS[3 * (lo + i) + c] = X[3 * i + c] / mx;
      MDS[3 * (lo + i) + c] = CE[3 * e + c] + X[3 * i + c] * 0.34;
    }
  }
  { let mx = 1e-6; for (let i = 0; i < N; i++) mx = Math.max(mx, Math.hypot(MDS[3 * i], MDS[3 * i + 1], MDS[3 * i + 2]));
    for (let i = 0; i < 3 * N; i++) MDS[i] *= 0.82 / mx; }
  const MDSC = EN.map((e, k) => { const c = [0, 0, 0]; for (const i of MEM[k]) for (let q = 0; q < 3; q++) c[q] += MDS[3 * i + q] / Math.max(1, MEM[k].length); return c; });
  const MDSR = EN.map((e, k) => { let s = 0; for (const i of MEM[k]) s = Math.max(s, Math.hypot(MDS[3 * i] - MDSC[k][0], MDS[3 * i + 1] - MDSC[k][1], MDS[3 * i + 2] - MDSC[k][2])); return s; });

  // ---------------------------------------------------------------- the endotype network: bubbles on a ring (tree
  // order, the biggest at the top), the loose endotypes (no links among their own genes) floating below it
  const BR = EN.map((e, k) => 0.052 * Math.cbrt(Math.max(1, MEM[k].length)) * (LOOSE[k] ? 0.85 : 1));
  const runOrder = EN.map((e, k) => k).filter(k => EROOT[k] >= 0).sort((a, b) => LO[EROOT[a]] - LO[EROOT[b]]);
  let ring = runOrder.filter(k => !LOOSE[k]);
  const loose = runOrder.filter(k => LOOSE[k]);
  if (ring.length) { const big = ring.reduce((b, k) => (MEM[k].length > MEM[b].length ? k : b), ring[0]), q = ring.indexOf(big); ring = ring.slice(q).concat(ring.slice(0, q)); }
  const BC = new Float32Array(3 * NE), PAD = 0.075, LBELOW = new Uint8Array(NE);   // LBELOW: its label under the bubble
  { const span = k => 2 * BR[k] + PAD, tot = ring.reduce((s, k) => s + span(k), 0), RR = Math.max(0.3, tot / TAU);
    let c = 0;
    ring.forEach((k, j) => { if (j) c += (span(ring[j - 1]) + span(k)) / 2; const a = PI / 2 - c / RR;
      BC[3 * k] = RR * Math.cos(a); BC[3 * k + 1] = RR * Math.sin(a); BC[3 * k + 2] = 0.08 * Math.sin(2 * a); });
    let bot = 0; for (const k of ring) bot = Math.min(bot, BC[3 * k + 1] - BR[k]);
    loose.forEach((k, j) => { const sx = loose.length > 1 ? (j / (loose.length - 1)) * 2 - 1 : 0;
      BC[3 * k] = sx * RR * 0.95; BC[3 * k + 1] = bot - 0.02 - BR[k] - (1 - Math.abs(sx)) * 0.12; BC[3 * k + 2] = -0.1; });
    // labels: above the bubbles, but on the lower part of the ring they alternate below and above (neighbours there
    // are close), and the loose ones have theirs below
    ring.filter(k => BC[3 * k + 1] < -0.6 * RR).sort((a, b) => BC[3 * a] - BC[3 * b]).forEach((k, j) => { LBELOW[k] = j % 2 ? 1 : 0; });
    for (const k of loose) LBELOW[k] = 1;
    let top = -9, low = 9; for (let k = 0; k < NE; k++) { top = Math.max(top, BC[3 * k + 1] + BR[k]); low = Math.min(low, BC[3 * k + 1] - BR[k]); }
    const sh = -(top + low) / 2; for (let k = 0; k < NE; k++) BC[3 * k + 1] += sh; }
  const RCY = (() => { let s = 0, n = 0; for (const k of ring) { s += BC[3 * k + 1]; n++; } return n ? s / n : 0; })();
  const META_TOP = Math.max(...EN.map((e, k) => BC[3 * k + 1] + BR[k])), META_LOW = Math.min(...EN.map((e, k) => BC[3 * k + 1] - BR[k]));
  // each endotype's genes inside its bubble: a small force layout of its own links, started from its tree distances
  const LOC = new Float32Array(3 * N);
  { const adj = EN.map(() => []); for (let q = 0; q < WL.length; q += 2) adj[GENE[WL[q]]].push(WL[q], WL[q + 1]);
    for (let e = 0; e < NE; e++) {
      const r = EROOT[e]; if (r < 0) continue;
      const lo = LO[r], n = HI[r] - lo + 1, P = new Float64Array(3 * n), rr = Math.min(0.75, 1.15 / Math.cbrt(n)), rest = rr * 0.75;
      for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) P[3 * i + c] = WPOS[3 * (lo + i) + c] * 0.9 + (R0() - 0.5) * 0.04;
      const L = adj[e];
      for (let it = 0; it < 90; it++) {
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const dx = P[3 * i] - P[3 * j], dy = P[3 * i + 1] - P[3 * j + 1], dz = P[3 * i + 2] - P[3 * j + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
          if (d < rr) { const f = (rr - d) / d * 0.22; P[3 * i] += dx * f; P[3 * i + 1] += dy * f; P[3 * i + 2] += dz * f; P[3 * j] -= dx * f; P[3 * j + 1] -= dy * f; P[3 * j + 2] -= dz * f; }
        }
        for (let q = 0; q < L.length; q += 2) {
          const i = L[q] - lo, j = L[q + 1] - lo, dx = P[3 * i] - P[3 * j], dy = P[3 * i + 1] - P[3 * j + 1], dz = P[3 * i + 2] - P[3 * j + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6, f = (d - rest) / d * 0.08;
          P[3 * i] -= dx * f; P[3 * i + 1] -= dy * f; P[3 * i + 2] -= dz * f; P[3 * j] += dx * f; P[3 * j + 1] += dy * f; P[3 * j + 2] += dz * f;
        }
        for (let i = 0; i < n; i++) { const l = Math.hypot(P[3 * i], P[3 * i + 1], P[3 * i + 2]); if (l > 1) { P[3 * i] /= l; P[3 * i + 1] /= l; P[3 * i + 2] /= l; } }
      }
      let mx = 1e-6; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.hypot(P[3 * i], P[3 * i + 1], P[3 * i + 2]));
      const s = (LOOSE[e] ? 0.95 : 0.8) / mx;
      for (let i = 0; i < 3 * n; i++) LOC[3 * lo + i] = P[i] * s;
    } }

  // ---------------------------------------------------------------- shared uniforms and GLSL
  const UNI = {
    uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime,
    uGap: { value: new Float32Array(NC) }, uBnd: { value: BND }, uCutY: { value: new Float32Array(NC) },
    uF: { value: new Float32Array(NE) }, uR: { value: Float32Array.from(BR) }, uC: { value: BC },
    uCol: { value: Float32Array.from([].concat(...ECOL)) },
    uP: { value: PEND }, uScan: { value: N + 4 }, uScanA: { value: 0 }, uGridA: { value: 1 }, uGrow: { value: 1.2 }, uGrowing: { value: 0 },
    uMT: { value: 1 }, uM1: { value: 0 }, uM2: { value: 0 }, uDim: { value: 0 }, uFwdA: { value: 0.04 }, uBub: { value: 0 }, uLinkA: { value: 0 }, uBandA: { value: 0 },
  };
  const gf = x => (Number.isInteger(x) ? x.toFixed(1) : x.toFixed(6));   // a number for GLSL
  const HEAD = K.GLSL + `
uniform float uA, uGap[${NC}], uBnd[${NC}], uCutY[${NC}], uF[${NE}], uR[${NE}];
uniform vec3 uC[${NE}], uCol[${NE}];
uniform float uP, uScan, uScanA, uGrow, uGrowing, uMT, uM1, uM2, uDim, uFwdA, uBub, uLinkA, uBandA;
const float Y0 = ${gf(Y0)}, RP = ${gf(RP)}, GAP = ${gf(GAP)}, XL = ${gf(XL)}, WT = ${gf(WT)}, ZT = ${gf(ZT)}, X0 = ${gf(X0)}, CP = ${gf(CP)}, XD = ${gf(XD)};
const vec3 RC = vec3(0.0, ${gf(RCY)}, 0.0);
// a row's height: the kept splits passed so far part the rows at their boundaries
float rowY(float u) { float y = Y0 - u * RP; for (int k = 0; k < ${NC}; k++) y += GAP * uGap[k] * (0.5 - step(uBnd[k], u)); return y; }
float nodeY(float u, float i) { return i > -0.5 ? uCutY[int(i + 0.5)] : rowY(u); }
vec3 treeP(float h, float y) { return vec3(XL - WT * h, y, ZT * h * h); }
// a branch from child (x) to parent (y): an S-curve, level at both ends
vec3 branchP(vec2 u, vec2 h, vec2 i, float s) { float e = s * s * (3.0 - 2.0 * s); return treeP(mix(h.x, h.y, s), mix(nodeY(u.x, i.x), nodeY(u.y, i.y), e)); }
// brightness of endotype k under the focus: the focused one brighter, the others dimmed
float lum(int k) { return (1.0 - uDim * 0.72 * (1.0 - uF[k])) * (1.0 + 0.35 * uF[k]); }
vec3 bubC(int k) { return mix(uC[k], RC, 0.2 * uF[k]) + vec3(0.0, 0.0, 0.34 * uF[k]); }
float bubR(int k) { return uR[k] * (1.0 + 0.16 * uF[k]); }
`;
  // a gene's place: its row, its tree-distance spot, its bubble (each gene leaves a little after or before the others)
  const GENE_GLSL = `
attribute float aRow, aE, aSeed, aStag, aTm; attribute vec3 aMds, aLoc;
vec3 geneP(out float e1, out float e2) {
  int k = int(aE + 0.5);
  e1 = smoothstep(aStag * 0.35, aStag * 0.35 + 0.65, uM1);
  e2 = smoothstep(aStag * 0.3, aStag * 0.3 + 0.7, uM2);
  vec3 p = mix(vec3(XD, rowY(aRow), 0.0), aMds, e1);
  p.z += 0.22 * sin(3.14159 * e1) + uF[k] * uFwdA;
  p = mix(p, bubC(k) + aLoc * bubR(k), e2);
  p.z += 0.16 * sin(3.14159 * e2);
  return p;
}
`;
  const mat = (vs, fs, o = {}) => {
    const m = new THREE.ShaderMaterial(Object.assign({ uniforms: UNI, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending }, o));
    set.mats.push(m);
    return m;
  };
  const geo = (n, attrs, index) => {
    const g = new THREE.BufferGeometry(), A = { position: new Float32Array(3 * n) };
    g.setAttribute('position', new THREE.BufferAttribute(A.position, 3));
    for (const [k, s] of attrs) { A[k] = new Float32Array(n * s); g.setAttribute(k, new THREE.BufferAttribute(A[k], s)); }
    if (index) g.setIndex(index);
    return [g, A];
  };
  const add = (o, order) => { o.frustumCulled = false; o.renderOrder = order; set.group.add(o); return o; };

  // ---------------------------------------------------------------- the matrix: a faint grid per endotype block (it
  // parts with the rows), the scan line, and the ones as crisp glowing cells
  const bndAt = u => { for (let j = 0; j < CUTN.length; j++) if (Math.abs(BND[j] - u) < 0.01) return j; return -1; };
  { const [g, A] = geo(4 * NE, [['aUC', 2], ['aQ', 2], ['aG', 2], ['aE', 1], ['aTm', 1]], (() => { const ix = []; for (let k = 0; k < NE; k++) ix.push(4 * k, 4 * k + 1, 4 * k + 2, 4 * k + 2, 4 * k + 1, 4 * k + 3); return ix; })());
    for (let e = 0; e < NE; e++) {
      const r = EROOT[e], lo = r >= 0 ? LO[r] : 0, hi = r >= 0 ? HI[r] : -1;
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([qx, qy], c) => {
        const v = 4 * e + c;
        A.aUC.set([qy ? hi + 0.5 - 1e-3 : lo - 0.5 + 1e-3, qx ? NT + 1 : -1], 2 * v); A.aQ.set([qx, qy], 2 * v);
        A.aE[v] = e; A.aTm[v] = TE[e] + WD + (qx ? WA : 0); A.aG.set([bndAt(lo - 0.5), bndAt(hi + 0.5)], 2 * v);
      });
    }
    add(new THREE.Mesh(g, mat(HEAD + `
attribute vec2 aUC, aQ, aG; attribute float aE, aTm;
varying vec2 vUC, vQ, vG; varying vec3 vCol; varying float vTm, vK;
void main() {
  int k = int(aE + 0.5);
  vUC = aUC; vQ = aQ; vCol = uCol[k]; vTm = aTm; vK = lum(k);
  vG = vec2(aG.x < -0.5 ? 1.0 : uGap[int(aG.x + 0.5)], aG.y < -0.5 ? 1.0 : uGap[int(aG.y + 0.5)]);   // a frame between two blocks shows as they part
  gl_Position = projectionMatrix * modelViewMatrix * vec4(X0 + aUC.y * CP, rowY(aUC.x), uF[k] * uFwdA - 0.002, 1.0);
}`, `
uniform float uA, uP, uScan, uScanA, uGridA, uMT;
varying vec2 vUC, vQ, vG; varying vec3 vCol; varying float vTm, vK;
void main() {
  vec2 w = max(fwidth(vUC), vec2(1e-4)), fr = vec2(fract(vUC.x + 0.5), fract(vUC.y));
  vec2 dl = min(fr, 1.0 - fr) / w;
  float dense = smoothstep(0.22, 0.5, max(w.x, w.y));                    // cells under ~3 px: no lines (no moire), only the tint
  float line = (1.0 - smoothstep(0.0, 1.0, min(dl.x, dl.y))) * (1.0 - dense);
  vec2 qw = max(fwidth(vQ), vec2(1e-5)), qe = min(vQ, 1.0 - vQ) / qw;
  float edge = max(1.0 - smoothstep(0.0, 1.5, qe.x), (1.0 - smoothstep(0.0, 1.5, qe.y)) * (vQ.y < 0.5 ? vG.x : vG.y));
  float filled = smoothstep(uScan + 0.5, uScan - 0.5, vUC.x), lit = smoothstep(vTm - 0.05, vTm + 0.3, uP);
  vec3 col = mix(vec3(0.55, 0.66, 0.8), vCol, lit);
  float a = 0.03 + 0.025 * filled + 0.05 * lit + line * 0.09 + edge * (0.16 + 0.3 * lit);
  float sd = abs(vUC.x - uScan);
  a += uScanA * (exp(-sd * sd / 2.0) * 0.9 + exp(-sd / 9.0) * 0.08);
  col = mix(col, vec3(0.55, 0.93, 1.0), uScanA * exp(-sd / 3.0));
  gl_FragColor = vec4(col, a * vK * uMT * uGridA * uA);
}`, { side: THREE.DoubleSide, extensions: { derivatives: true } })), 1); }

  const NCELL = FI.length;
  { const [g, A] = geo(NCELL, [['aRC', 2], ['aE', 1], ['aTm', 1]]);
    let v = 0;
    for (let i = 0; i < N; i++) for (let q = OFF[i]; q < OFF[i + 1]; q++, v++) {
      const x = COLX[FI[q]]; A.aRC[2 * v] = i; A.aRC[2 * v + 1] = x; A.aE[v] = GENE[i]; A.aTm[v] = TE[GENE[i]] + WD + WA * x / NT;
    }
    add(new THREE.Points(g, mat(HEAD + `
attribute vec2 aRC; attribute float aE, aTm;
varying vec3 vC; varying float vA;
void main() {
  int k = int(aE + 0.5);
  float row = aRC.x, past = uScan - row;
  vec4 mv = modelViewMatrix * vec4(X0 + (aRC.y + 0.5) * CP, rowY(row), uF[k] * uFwdA, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(${gf(SZC)}, mv);
  float on = clamp(past, 0.0, 1.0), flash = on * exp(-max(past, 0.0) / 5.0) * uScanA, lit = smoothstep(aTm - 0.05, aTm + 0.25, uP);
  vC = mix(vec3(0.33, 0.8, 1.0), uCol[k], lit) * (1.0 + 1.8 * flash);
  vA = on * uMT * uA * lum(k) * 0.95;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA;
void main() {
  vec2 q = abs(gl_PointCoord - 0.5); float d = max(q.x, q.y);
  float a = smoothstep(0.5, 0.34, d);
  gl_FragColor = vec4(mix(vC, vec3(1.0), smoothstep(0.3, 0.0, d) * 0.25), vA * a);
}`)), 3); }

  // ---------------------------------------------------------------- the tree: every branch an S-curve from its child to
  // its parent; the kept tree (from the root down to each endotype's root) and the subtrees inside the endotypes
  const BRANCHES = [];   // [child, parent node or -1 for the trunk]
  for (let n = 0; n < NN; n++) if (n !== ROOT) BRANCHES.push([n, PAR[n]]);
  BRANCHES.push([ROOT, -1]);
  const kept = ([c, p]) => p < 0 || CI[p] >= 0;
  const segsOf = b => (kept(b) ? 22 : NH[b[1]] - NH[b[0]] > 0.12 ? 9 : 6);
  const bInfo = ([c, p]) => {
    const hp = p < 0 ? HTOP : NH[p], ip = p < 0 ? CI[ROOT] : CI[p], up = p < 0 ? NU[ROOT] : NU[p];
    const tc = TAUN[c], tp = p < 0 ? P0 + 0.05 : TAUN[p], e = kept([c, p]) ? -1 : GENE[LO[c]];
    return { uc: NU[c], up, hc: NH[c], hp, ic: CI[c], ip, e, tm: s => (e < 0 ? tc + s * (tp - tc) : washT(e, lerp(NH[c], hp, s))) };
  };
  const putB = (A, v, B, s) => {
    A.aUU[2 * v] = B.uc; A.aUU[2 * v + 1] = B.up; A.aHH[2 * v] = B.hc; A.aHH[2 * v + 1] = B.hp; A.aII[2 * v] = B.ic; A.aII[2 * v + 1] = B.ip;
    A.aS[v] = s; A.aTm[v] = B.tm(s); if (A.aE) A.aE[v] = B.e;
  };
  { const nSeg = BRANCHES.reduce((s, b) => s + segsOf(b), 0);
    const [g, A] = geo(2 * nSeg, [['aUU', 2], ['aHH', 2], ['aII', 2], ['aS', 1], ['aE', 1], ['aTm', 1]]);
    let v = 0;
    for (const b of BRANCHES) { const B = bInfo(b), m = segsOf(b); for (let q = 0; q < m; q++) { putB(A, v++, B, q / m); putB(A, v++, B, (q + 1) / m); } }
    add(new THREE.LineSegments(g, mat(HEAD + `
attribute vec2 aUU, aHH, aII; attribute float aS, aE, aTm;
varying vec3 vC; varying float vA;
void main() {
  vec3 p = branchP(aUU, aHH, aII, aS);
  float h = mix(aHH.x, aHH.y, aS), lk = 1.0, d = uP - aTm;
  vec3 ec = vec3(0.78, 1.0, 0.9);
  if (aE > -0.5) { int k = int(aE + 0.5); lk = lum(k); p.z += uF[k] * uFwdA; ec = uCol[k]; }
  float lit = smoothstep(-0.02, 0.18, d);
  float grow = smoothstep(uGrow + 0.004, uGrow - 0.025, h), front = uGrowing * exp(-pow((uGrow - h) / 0.03, 2.0));
  float comet = aE < -0.5 ? exp(-d * d / 0.003) : 0.35 * exp(-d * d / 0.012);
  vC = mix(vec3(0.38, 0.64, 0.92), ec, lit) + vec3(0.55, 0.85, 1.0) * (comet + front);
  vA = (mix(0.36, aE < -0.5 ? 0.95 : 0.75, lit) + 0.6 * comet + 0.7 * front) * grow * uMT * uA * lk;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`, `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.004) discard; gl_FragColor = vec4(vC, vA); }`)), 2); }

  // the pulse's head: a comet of glowing points along the kept tree
  { const KB_ = BRANCHES.filter(kept), CPN = 40;
    const [g, A] = geo(KB_.length * CPN, [['aUU', 2], ['aHH', 2], ['aII', 2], ['aS', 1], ['aTm', 1]]);
    let v = 0; for (const b of KB_) { const B = bInfo(b); for (let q = 0; q < CPN; q++) putB(A, v++, B, (q + 0.5) / CPN); }
    add(new THREE.Points(g, mat(HEAD + `
attribute vec2 aUU, aHH, aII; attribute float aS, aTm;
varying vec3 vC; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(branchP(aUU, aHH, aII, aS), 1.0);
  gl_Position = projectionMatrix * mv;
  float d = uP - aTm, a = d > 0.0 ? exp(-d / 0.09) : exp(-d * d / 0.0005);
  float h = mix(aHH.x, aHH.y, aS);
  gl_PointSize = pointPx(0.03 * (0.35 + 0.65 * a), mv);
  vC = mix(vec3(0.45, 0.85, 1.0), vec3(1.0), a * 0.6);
  vA = a * 0.9 * smoothstep(uGrow + 0.004, uGrow - 0.025, h) * uMT * uA;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA;
void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
  float a = max(smoothstep(0.5, 0.15, d) * 0.9, pow(1.0 - 2.0 * d, 1.5) * 0.6); gl_FragColor = vec4(vC, vA * a); }`)), 6); }

  // the tests' verdicts: a green check in a ring where a split is kept, a small dim cross where it is refused
  const GLY = CUTN.map(n => [n, 0]).concat(Array.from(EROOT).filter(n => n >= N).map(n => [n, 1]));
  { const [g, A] = geo(GLY.length, [['aNode', 3], ['aKind', 1], ['aTm', 1]]);
    GLY.forEach(([n, kind], v) => { A.aNode.set([NU[n], NH[n], CI[n]], 3 * v); A.aKind[v] = kind; A.aTm[v] = TAUN[n]; });
    add(new THREE.Points(g, mat(HEAD + `
attribute vec3 aNode; attribute float aKind, aTm;
varying vec3 vC; varying float vA, vKind, vAge, vPx;
void main() {
  vec4 mv = modelViewMatrix * vec4(treeP(aNode.y, nodeY(aNode.x, aNode.z)), 1.0);
  gl_Position = projectionMatrix * mv;
  float age = uP - aTm, on = smoothstep(0.0, 0.07, age), pop = 1.0 + 0.8 * exp(-max(age, 0.0) * 5.0) * on;
  gl_PointSize = pointPx((aKind < 0.5 ? 0.085 : 0.05) * pop, mv); vPx = 1.0 / gl_PointSize;
  vKind = aKind; vAge = max(age, 0.0);
  vC = aKind < 0.5 ? vec3(0.28, 0.95, 0.6) : vec3(1.0, 0.42, 0.36);
  vA = on * (aKind < 0.5 ? 1.0 : 0.62 - 0.22 * smoothstep(0.0, 0.8, age)) * smoothstep(uGrow + 0.004, uGrow - 0.025, aNode.y) * uMT * uA;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA, vKind, vAge, vPx;
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  vec2 q = gl_PointCoord - 0.5; q.y = -q.y;
  float aa = max(vPx, 0.01), r = length(q), a;
  if (vKind < 0.5) {
    float d = min(seg(q, vec2(-0.15, 0.01), vec2(-0.04, -0.1)), seg(q, vec2(-0.04, -0.1), vec2(0.16, 0.13)));
    float ck = 1.0 - smoothstep(0.04, 0.04 + aa, d), rg = 1.0 - smoothstep(0.024, 0.024 + aa, abs(r - 0.29));
    float wave = (1.0 - smoothstep(0.02, 0.02 + aa, abs(r - 0.29 - 0.2 * clamp(vAge * 2.5, 0.0, 1.0)))) * exp(-vAge * 3.5);
    a = max(max(ck, rg * 0.8), max((1.0 - smoothstep(0.27, 0.29, r)) * 0.16, wave * 0.7));
  } else {
    float d = min(seg(q, vec2(-0.2, -0.2), vec2(0.2, 0.2)), seg(q, vec2(-0.2, 0.2), vec2(0.2, -0.2)));
    a = 1.0 - smoothstep(0.055, 0.055 + aa, d);
  }
  if (a < 0.01) discard;
  gl_FragColor = vec4(vC, vA * a);
}`)), 7); }

  // ---------------------------------------------------------------- the genes: dots at their rows, at their tree-distance
  // spots, in their bubbles; and the links among each endotype's own genes
  const geneStag = i => ((i * 0.6180339887) % 1) * 0.6 + 0.4 * (i - LO[EROOT[GENE[i]]]) / Math.max(1, MEM[GENE[i]].length);
  const putG = (A, v, i) => {
    A.aRow[v] = i; A.aE[v] = GENE[i]; A.aSeed[v] = SEED[i] ? 1 : 0; A.aTm[v] = TE[GENE[i]] + WD; A.aStag[v] = geneStag(i);
    for (let c = 0; c < 3; c++) { A.aMds[3 * v + c] = MDS[3 * i + c]; A.aLoc[3 * v + c] = LOC[3 * i + c]; }
  };
  const GATTR = [['aRow', 1], ['aE', 1], ['aSeed', 1], ['aStag', 1], ['aTm', 1], ['aMds', 3], ['aLoc', 3]];
  { const [g, A] = geo(N, GATTR);
    for (let i = 0; i < N; i++) putG(A, i, i);
    add(new THREE.Points(g, mat(HEAD + GENE_GLSL + `
varying vec3 vC; varying float vA, vSeed;
void main() {
  int k = int(aE + 0.5); float e1, e2;
  vec4 mv = modelViewMatrix * vec4(geneP(e1, e2), 1.0);
  gl_Position = projectionMatrix * mv;
  float out_ = max(e1, e2), lit = max(smoothstep(aTm - 0.05, aTm + 0.2, uP), out_);
  gl_PointSize = pointPx(mix(0.0095, mix(0.032, 0.024, e2), out_) * (1.0 + 0.4 * aSeed * out_) * (1.0 + 0.25 * uF[k]), mv);
  vC = mix(vec3(0.5, 0.86, 1.0), uCol[k], lit); vSeed = aSeed * out_;
  float shown = max(clamp(uScan - aRow, 0.0, 1.0) * uMT, smoothstep(0.0, 0.3, out_));
  vA = shown * lum(k) * uA;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA, vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
  float a = max(smoothstep(0.5, 0.2, d) * 0.88, pow(1.0 - d * 2.0, 1.6) * 0.6);
  vec3 col = mix(vC, vec3(1.0), smoothstep(0.24, 0.0, d) * (0.3 + 0.45 * vSeed));
  a = max(a, vSeed * (1.0 - smoothstep(0.035, 0.08, abs(d - 0.42))));
  gl_FragColor = vec4(col, vA * a);
}`)), 8); }
  { const nL = WL.length / 2, [g, A] = geo(2 * nL, GATTR);
    for (let v = 0; v < WL.length; v++) putG(A, v, WL[v]);
    add(new THREE.LineSegments(g, mat(HEAD + GENE_GLSL + `
varying vec3 vC; varying float vA;
void main() {
  int k = int(aE + 0.5); float e1, e2;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(geneP(e1, e2), 1.0);
  vC = mix(uCol[k], vec3(1.0), 0.25); vA = uLinkA * e2 * 0.42 * lum(k) * uA;
}`, `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.004) discard; gl_FragColor = vec4(vC, vA); }`)), 5); }

  // ---------------------------------------------------------------- the bubbles and the grey bands between them
  { const sph = new THREE.SphereGeometry(1, 32, 22), sp = sph.attributes.position.array, si = sph.index.array, nv = sp.length / 3;
    const ix = []; for (let e = 0; e < NE; e++) for (let q = 0; q < si.length; q++) ix.push(si[q] + e * nv);
    const [g, A] = geo(nv * NE, [['aE', 1], ['aL', 1]], ix);
    for (let e = 0; e < NE; e++) { A.position.set(sp, 3 * nv * e); A.aE.fill(e, nv * e, nv * (e + 1)); A.aL.fill(LOOSE[e] ? 0.4 : 1, nv * e, nv * (e + 1)); }
    sph.dispose();
    add(new THREE.Mesh(g, mat(HEAD + `
attribute float aE, aL;
varying vec3 vN, vW, vCol; varying float vK;
void main() {
  int k = int(aE + 0.5); vec3 n = normalize(position);
  float wob = 1.0 + 0.035 * sin(3.0 * n.x + 2.0 * n.y + uTime * 0.6 + aE * 1.7) + 0.03 * sin(4.0 * n.z - uTime * 0.45 + aE);
  vec4 w = modelMatrix * vec4(bubC(k) + n * bubR(k) * mix(0.55, 1.0, uBub) * wob, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * n); vCol = uCol[k]; vK = lum(k) * uBub * aL;
  gl_Position = projectionMatrix * viewMatrix * w;
}`, `
uniform float uA; varying vec3 vN, vW, vCol; varying float vK;
void main() {
  float r = pow(1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vW))), 2.2);
  gl_FragColor = vec4(vCol * (0.5 + 0.75 * r), (0.035 + 0.5 * r) * vK * uA);
}`, { side: THREE.DoubleSide })), 4); }
  const BANDS = []; for (let a = 0; a < NE; a++) for (let b = a + 1; b < NE; b++) if (BT[a * NE + b] > 0) BANDS.push([a, b, BT[a * NE + b]]);
  { const TUB = 26, RAD = 6, per = (TUB + 1) * RAD, ix = [];
    BANDS.forEach((B, j) => { for (let s = 0; s < TUB; s++) for (let r = 0; r < RAD; r++) {
      const a = j * per + s * RAD + r, b = j * per + s * RAD + (r + 1) % RAD; ix.push(a, a + RAD, b, b, a + RAD, b + RAD); } });
    const [g, A] = geo(Math.max(1, BANDS.length * per), [['aS', 1], ['aTh', 1], ['aPair', 2], ['aW', 1]], ix);
    BANDS.forEach(([a, b, n], j) => { for (let s = 0; s <= TUB; s++) for (let r = 0; r < RAD; r++) {
      const v = j * per + s * RAD + r; A.aS[v] = s / TUB; A.aTh[v] = r / RAD * TAU; A.aPair[2 * v] = a; A.aPair[2 * v + 1] = b;
      A.aW[v] = (0.0015 + 0.00056 * n) * (LOOSE[a] || LOOSE[b] ? 0.8 : 1); } });
    add(new THREE.Mesh(g, mat(HEAD + `
attribute float aS, aTh, aW; attribute vec2 aPair;
varying vec3 vN, vW; varying float vK, vHi;
void main() {
  int a = int(aPair.x + 0.5), b = int(aPair.y + 0.5);
  vec3 cA = bubC(a), cB = bubC(b), ctl = mix(0.5 * (cA + cB), RC, 0.5);
  float L = max(length(cB - cA), 1e-3), s0 = clamp(bubR(a) * 0.9 / L, 0.0, 0.45), s1 = 1.0 - clamp(bubR(b) * 0.9 / L, 0.0, 0.45);
  float s = mix(s0, s1, aS), t = 1.0 - s;
  vec3 P = t * t * cA + 2.0 * t * s * ctl + s * s * cB, T = normalize(2.0 * t * (ctl - cA) + 2.0 * s * (cB - ctl) + 1e-5);
  vec3 Nn = cross(T, vec3(0.0, 0.0, 1.0)); Nn = length(Nn) < 0.1 ? normalize(cross(T, vec3(0.0, 1.0, 0.0))) : normalize(Nn);
  vec3 Bn = cross(T, Nn), n = cos(aTh) * Nn + sin(aTh) * Bn;
  float hide = smoothstep(uBandA * 0.52 - 0.04, uBandA * 0.52, min(aS, 1.0 - aS));   // they grow in from both ends
  vec4 w = modelMatrix * vec4(P + n * aW * mix(0.4, 1.0, uBandA), 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * n);
  vHi = max(uF[a], uF[b]); vK = uBandA * (1.0 - uDim * 0.75 * (1.0 - vHi)) * (1.0 - hide);
  gl_Position = projectionMatrix * viewMatrix * w;
}`, `
uniform float uA; varying vec3 vN, vW; varying float vK, vHi;
void main() {
  float r = pow(1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vW))), 1.5);
  vec3 col = mix(vec3(0.6, 0.66, 0.76), vec3(0.9, 0.93, 1.0), vHi);
  gl_FragColor = vec4(col, (0.07 + 0.2 * r) * (1.0 + 0.8 * vHi) * vK * uA);
}`, { side: THREE.DoubleSide })), 3); }

  // ---------------------------------------------------------------- CPU mirrors (anchors, views, pick)
  const st = { mat: 1, grow: 1, P: PEND, m1: 0, m2: 0, m1r: 0, m2r: 0, mt: 1, dim: 0, fwdA: 0.04 };
  const GAPV = UNI.uGap.value, CUTY = UNI.uCutY.value, FW = UNI.uF.value;
  const rowY = u => { let y = Y0 - u * RP; for (let j = 0; j < NC; j++) y += GAP * GAPV[j] * (0.5 - (u >= BND[j] ? 1 : 0)); return y; };
  const nodeY = n => (CI[n] >= 0 ? CUTY[CI[n]] : rowY(NU[n]));
  const bubC = (k, o = [0, 0, 0]) => { o[0] = lerp(BC[3 * k], 0, 0.2 * FW[k]); o[1] = lerp(BC[3 * k + 1], RCY, 0.2 * FW[k]); o[2] = BC[3 * k + 2] + 0.34 * FW[k]; return o; };
  const put = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; };
  const bubR = k => BR[k] * (1 + 0.16 * FW[k]);
  const sm = (a, b, x) => smooth((x - a) / (b - a));
  function genePos(i) {
    const k = GENE[i], s = geneStag(i), e1 = sm(s * 0.35, s * 0.35 + 0.65, st.m1r), e2 = sm(s * 0.3, s * 0.3 + 0.7, st.m2r);
    const p = [lerp(XD, MDS[3 * i], e1), lerp(rowY(i), MDS[3 * i + 1], e1), lerp(0, MDS[3 * i + 2], e1) + 0.22 * Math.sin(PI * e1) + FW[k] * st.fwdA];
    const c = bubC(k), r = bubR(k);
    for (let q = 0; q < 3; q++) p[q] = lerp(p[q], c[q] + LOC[3 * i + q] * r, e2);
    p[2] += 0.16 * Math.sin(PI * e2);
    return p;
  }
  const rowsMid = k => { const r = EROOT[k]; return r >= 0 ? (LO[r] + HI[r]) / 2 : 0; };
  // where endotype k is now: its rows, its cluster, its bubble
  const endoPos = (k, o = [0, 0, 0]) => {
    const fz = FW[k] * st.fwdA, c = MDSC[k], m1 = st.m1, ax = lerp(X0 + 0.12, c[0], m1), ay = lerp(rowY(rowsMid(k)), c[1], m1), az = c[2] * m1 + fz;
    bubC(k, o);
    return put(o, lerp(ax, o[0], st.m2), lerp(ay, o[1], st.m2), lerp(az, o[2], st.m2));
  };

  // ---------------------------------------------------------------- the focus: an endotype id from the param or the
  // explore panel, cross-faded over 0.6 s whenever it changes
  let ovr = null, fCur = -1, fPrev = -1, tCh = -1e9, lastT = 0;
  function update(S, t) {
    const mat_ = clamp(S.tree_matrix, 0, 1), grow = clamp(S.tree_tree, 0, 1), test = clamp(S.tree_test, 0, 1);
    const m1r = clamp(S.tree_mds, 0, 1), m2r = clamp(S.tree_meta, 0, 1), m1 = smooth(m1r), m2 = smooth(m2r);
    const mt = 1 - prog(Math.max(m1r, m2r), 0, 0.55), P = lerp(P0, PEND, test);
    U('uScan', mat_ * (N + 8) - 4); U('uScanA', prog(mat_, 0, 0.02) * (1 - prog(mat_, 0.95, 1))); U('uGridA', prog(mat_, 0, 0.06));
    U('uGrow', grow * 1.12); U('uGrowing', clamp(grow * (1 - grow) * 6, 0, 1)); U('uP', P); U('uMT', mt);
    U('uM1', m1r); U('uM2', m2r); U('uBub', prog(m2r, 0.3, 0.85)); U('uLinkA', prog(m2r, 0.55, 1)); U('uBandA', prog(m2r, 0.45, 0.95));
    for (let j = 0; j < CUTN.length; j++) GAPV[j] = smooth((P - TAUN[CUTN[j]]) / 0.7);
    for (let j = 0; j < CUTN.length; j++) CUTY[j] = (nodeY(CKA[j]) + nodeY(CKB[j])) / 2;
    // the focus
    // only a clock that runs smoothly cross-fades; a paused story, a seek or the first frame show the focus at once
    const adv = t - lastT, running = adv > 0 && adv < 0.25;
    if (t < lastT - 0.5 || t < tCh) tCh = -1e9;
    lastT = t;
    const want = ovr !== null ? ovr : clamp(Math.round(S.tree_focus || 0), 0, NE) - 1;
    if (want !== fCur) { fPrev = fCur; fCur = want; tCh = running ? t : -1e9; }
    const X = smooth(clamp((t - tCh) / 0.6, 0, 1));
    FW.fill(0); if (fCur >= 0) FW[fCur] += X; if (fPrev >= 0 && fPrev !== fCur) FW[fPrev] += 1 - X;
    const dim = (fCur >= 0 ? X : 0) + (fPrev >= 0 && fPrev !== fCur ? 1 - X : 0);
    const fwdA = lerp(lerp(0.04, 0.16, m1), 0.16, m2);
    U('uDim', dim); U('uFwdA', fwdA);
    st.mat = mat_; st.grow = grow; st.P = P; st.m1 = m1; st.m2 = m2; st.m1r = m1r; st.m2r = m2r; st.mt = mt; st.dim = dim; st.fwdA = fwdA;
  }
  const U = (k, v) => { UNI[k].value = v; };

  // ---------------------------------------------------------------- explore API
  const _m = new THREE.Matrix4(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
  const setV = (v, a) => (Array.isArray(a) ? v.set(a[0], a[1], a[2]) : v.copy(a));
  const rowAt = y => {   // the row nearest to height y (rows fall with u), or -1 in a gap
    let lo = 0, hi = N - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (rowY(m) > y) lo = m + 1; else hi = m; }
    let best = lo; if (lo > 0 && Math.abs(rowY(lo - 1) - y) < Math.abs(rowY(lo) - y)) best = lo - 1;
    return Math.abs(rowY(best) - y) < RP * 1.5 ? best : -1;
  };
  function pick(a, b) {
    if (a && a.ray) { _m.copy(set.group.matrixWorld).invert(); _o.copy(a.ray.origin).applyMatrix4(_m); _d.copy(a.ray.direction).transformDirection(_m); }
    else if (a && b) { setV(_o, a); setV(_d, b); _d.normalize(); }
    else return null;
    const o = [_o.x, _o.y, _o.z], d = [_d.x, _d.y, _d.z];
    if (st.m1 > 0.5 || st.m2 > 0.5) {
      // a gene dot near the ray, else (endotype network) a bubble it passes through, else (distances) a cluster
      let best = -1, bs = 1e9;
      for (let i = 0; i < N; i++) {
        if (FW[GENE[i]] < 0.5 && st.dim > 0.5) continue;
        const p = genePos(i), wx = p[0] - o[0], wy = p[1] - o[1], wz = p[2] - o[2], tt = wx * d[0] + wy * d[1] + wz * d[2];
        if (tt <= 0) continue;
        const perp = Math.hypot(wx - d[0] * tt, wy - d[1] * tt, wz - d[2] * tt), tol = (0.004 + 0.0028 * tt) * (st.m2 > 0.5 ? 1 : 1.4);
        if (perp < tol && perp / tol + tt * 0.05 < bs) { bs = perp / tol + tt * 0.05; best = i; }
      }
      if (best >= 0) return { gene: best };
      let be = -1, bt = 1e9;
      for (let k = 0; k < NE; k++) {
        const c = st.m2 > 0.5 ? bubC(k) : endoPos(k), r = st.m2 > 0.5 ? bubR(k) : Math.max(0.05, MDSR[k] * 1.1);
        const wx = c[0] - o[0], wy = c[1] - o[1], wz = c[2] - o[2], tt = wx * d[0] + wy * d[1] + wz * d[2];
        const q = wx * wx + wy * wy + wz * wz - tt * tt;
        if (q > r * r) continue;
        const hit = tt - Math.sqrt(r * r - q);
        if (hit > 0 && hit < bt) { bt = hit; be = k; }
      }
      return be >= 0 ? { endo: be } : null;
    }
    if (st.mt < 0.3 || Math.abs(d[2]) < 1e-4) return null;
    // the matrix and the leaves lie in z = 0; the tree curves towards you, so find its surface by a few steps
    let tt = -o[2] / d[2], x = o[0] + d[0] * tt, y = o[1] + d[1] * tt;
    if (tt > 0 && x >= XL - 0.004 && x <= X1 + 0.01) { const r = rowAt(y); return r >= 0 && r < (st.mat * (N + 8) - 4) ? { gene: r } : null; }
    let h = 0;
    for (let k = 0; k < 4; k++) { h = clamp((XL - x) / WT, 0, 1.1); tt = (ZT * h * h - o[2]) / d[2]; x = o[0] + d[0] * tt; y = o[1] + d[1] * tt; }
    h = (XL - x) / WT;
    if (tt <= 0 || h < 0 || h > 0.58 || h > st.grow * 1.12) return null;
    const r = rowAt(y);
    return r >= 0 ? { endo: GENE[r] } : null;
  }
  function setFocus(id) { ovr = id === null || id === undefined || id < 0 || id >= NE ? null : id | 0; }
  const API = {
    setFocus, pick, focus: () => fCur, genePos, endoPos,
    genes: N, terms: NT, order: ORDER.slice(), cells: NCELL, kept: CUTN.length, endoRoots: Array.from(EROOT),
    testTimes: { kept: CUTN.map(n => (TAUN[n] - P0) / (PEND - P0)), refused: TE.map(x => (x - P0) / (PEND - P0)) },
    bands: BANDS.map(b => b.slice()), own: Array.from(OWN), loose: LOOSE.slice(), name: i => NAME[i],
    bubble: k => ({ c: bubC(k), r: bubR(k), base: [BC[3 * k], BC[3 * k + 1], BC[3 * k + 2]], r0: BR[k], below: !!LBELOW[k] }),
  };

  // ---------------------------------------------------------------- anchors, labels, views, controls
  // anchors the labels read every frame fill arrays of their own (no garbage per frame)
  const AR = Array.from({ length: 6 + 2 * NE }, () => [0, 0, 0]);
  const root = () => put(AR[0], XL - WT * NH[ROOT], nodeY(ROOT), ZT * NH[ROOT] * NH[ROOT]);
  // the first refusal (for its label): the endotype whose root the pulse reaches first
  const REF = EROOT.reduce((b, n, e) => (n >= N && (b < 0 || TE[e] < TE[b]) ? e : b), -1), TREF = REF >= 0 ? TE[REF] : 0;
  const anchors = {
    matrix: [X0 + MW / 2, 0, 0], matrixTop: () => put(AR[1], X0 + MW / 2 - 0.2, rowY(0) + 0.07, 0),
    tree: [XL - WT * 0.5, 0, ZT * 0.25], treeTop: () => put(AR[2], XL - WT * 0.62, rowY(0) + 0.07, ZT * 0.38),
    root, kept: root, refused: () => { const n = EROOT[Math.max(REF, 0)]; return put(AR[3], XL - WT * NH[n], nodeY(n), ZT * NH[n] * NH[n]); },
    scan: () => [XD, rowY(clamp(st.mat * (N + 8) - 4, 0, N - 1)), 0],
    mds: [0, 0, 0], mdsTop: [0, Math.max(...MDSC.map((c, k) => c[1] + MDSR[k])) + 0.06, 0],
    meta: [0, RCY, 0], metaLow: [-0.06, META_LOW - 0.1, 0],
    focus: () => (fCur >= 0 ? endoPos(fCur, AR[4]) : st.m2 > 0.5 ? put(AR[4], 0, RCY, 0) : st.m1 > 0.5 ? put(AR[4], 0, 0, 0) : put(AR[4], -0.05, 0, 0.05)),
  };
  EN.forEach((e, k) => { anchors['e' + k] = () => endoPos(k, AR[6 + NE + k]); });
  const labels = [
    { text: [`${N} genes`, `× ${NT} terms`], cls: 'cyn', at: 'matrixTop', alpha: S => prog(S.tree_matrix, 0.02, 0.15) * st.mt },
    { text: ['Tree of genes', ''], cls: '', at: 'treeTop', alpha: S => prog(S.tree_tree, 0.35, 0.8) * st.mt },
    { text: ['Split kept', '· the two sides differ'], cls: 'grn', at: 'kept',
      alpha: S => sm(P0 + 0.5, P0 + 0.9, st.P) * (1 - prog(S.tree_test, 0.8, 0.95)) * st.mt },
    { text: ['Split refused', '· too alike'], cls: 'amb', at: 'refused',
      alpha: S => (REF >= 0 ? sm(TREF, TREF + 0.3, st.P) : 0) * (1 - prog(S.tree_test, 0.8, 0.95)) * st.mt },
    { text: ['Tree distances', '· near in the tree, near here'], cls: 'cyn', at: 'mdsTop', alpha: S => prog(S.tree_mds, 0.7, 1) * (1 - prog(S.tree_meta, 0, 0.3)) },
    { text: [`${NE} endotypes`, ''], cls: 'mag', at: 'metaLow', alpha: S => prog(S.tree_meta, 0.75, 1) },
  ];
  EN.forEach((e, k) => labels.push({ text: [String(e.id), '· ' + e.name], cls: '',
    at: () => { const c = bubC(k, AR[6 + k]); c[1] += LBELOW[k] ? -bubR(k) - 0.045 : bubR(k) + 0.03; return c; },
    alpha: S => prog(S.tree_meta, 0.85, 1) * (1 - st.dim * 0.6 * (1 - FW[k])) }));
  const camE = k => { const c = [lerp(BC[3 * k], 0, 0.2), lerp(BC[3 * k + 1], RCY, 0.2), BC[3 * k + 2] + 0.34], r = BR[k] * 1.16;
    return [clamp(c[0] * 14, -16, 16), clamp(6 + c[1] * 6, -4, 14), 1.25 + r * 4.2, c[0], c[1], c[2]]; };
  const cam = {
    default: [14, 8, 4.4, -0.05, 0, 0.05],
    matrix: [6, 4, 2.6, X0 + MW / 2, 0, 0],
    tree: [30, 6, 3.0, XL - WT * 0.4, 0, ZT * 0.2],
    mds: [22, 14, 3.5, 0, 0, 0],
    meta: [0, 5, 4.3, 0, (META_TOP + META_LOW) / 2, 0],
  };
  Object.defineProperty(cam, 'focus', { enumerable: true, get: () => {
    if (fCur < 0) return (st.m2 > 0.5 ? cam.meta : st.m1 > 0.5 ? cam.mds : cam.default).slice();
    if (st.m2 > 0.5) return camE(fCur);
    const p = endoPos(fCur); return st.m1 > 0.5 ? [22, 12, 1.5, p[0], p[1], p[2]] : [10, 4, 1.7, X0 + 0.45, p[1], p[2]];
  } });
  EN.forEach((e, k) => { cam['e' + k] = camE(k); });
  const params = { tree_a: 1, tree_matrix: 1, tree_tree: 1, tree_test: 1, tree_mds: 0, tree_meta: 0, tree_focus: 0 };
  const controls = [{ key: 'view', label: 'View', options: [['matrix', 'Matrix'], ['tree', 'Tree'], ['dist', 'Distances'], ['endo', 'Endotypes']] }];
  function explore(c) {
    const o = Object.assign({}, params), t = c.t || 0;
    delete o.tree_a;
    if (c.view === 'matrix') { o.tree_tree = 0; o.tree_test = 0; }
    if (c.view === 'tree') o.tree_test = clamp((t - 0.8) / 9, 0, 1);   // the tests replay each time the view opens
    if (c.view === 'dist') o.tree_mds = 1;
    if (c.view === 'endo') o.tree_meta = 1;
    return o;
  }

  update(params, 0);
  return Object.assign(set, { params, update, anchors, labels, cam, controls, explore, api: () => API });
};
