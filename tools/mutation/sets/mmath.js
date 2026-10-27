// MMATH: the maths of the mutation story, computed live from example numbers, as in the authors' own test (Enes Berk
// Sakalli: "for a test of the method these example numbers are fine, but for a real result they should be estimated
// from real sequences"). The poster's own numbers are MUT_DATA (sets/data.js); the story shows them only as "in the
// authors' test".
// Plain script: in stories/mutation.js it is pasted inside the story's closure before MUT_DATA (the build drops the
// module line at the end), so it reads MUT_DATA only when a function is called, never while it loads; in Node,
// require() or import it (tools/mutation/test-mmath.mjs checks it), with a copy of the few poster's facts it needs.
//
// What it does, in the order of the story:
// - letters are indices 0..3 for A, C, G, T; a letter's two qubits are its two bits, the first qubit the high bit
//   (A |00>, C |01>, G |10>, T |11>, as on the poster);
// - substitution models (GTR, and two simpler ones): the rate matrix Q, scaled so the mean rate is 1 (a branch length
//   is then the expected number of swaps per letter), and P(t) = e^(Qt) from the symmetric eigen-decomposition of
//   Pi^(1/2) Q Pi^(-1/2) (Jacobi); the mix along a path, and its point in the pyramid of mixes;
// - the two qubits of a mix (amplitudes, Bloch vectors from the reduced density matrices, seeded read-outs);
// - the circuit for one branch: a copy (two CNOTs) and a turn (two uniformly controlled RY rotations whose angles come
//   from P(t)), its decomposition into single-qubit RY turns and CNOTs (the Gray-code construction), and a small
//   state-vector simulator that checks it gives row `parent` of P(t);
// - the family tree in 3D, with every mutation simulated exactly under the model, and the poster's species tree;
// - pairs of letters: a reversible 16-state pair model, its P(t), the independent and the coupled stand-in, and the
//   rebuild of the ancestral stem by Felsenstein's pruning, sampled.
//
// The example values, and why (chosen to tell the poster's story in the same direction, never tuned to its numbers):
// - the story's model ('uneven', GTR): exchangeabilities AC 1.0, AG 3.6, AT 0.7, CG 1.1, CT 4.2, GT 0.9: transitions
//   (A<->G, C<->T) swap several times as readily as the other swaps, as in real DNA; long-run shares A 0.32, C 0.18,
//   G 0.24, T 0.26: A the most common, as on the poster's picture of the pyramid. 'even' (JC69) and 'transitions'
//   (K80, kappa 4) are the textbook simpler rules.
// - the path: T_PATH = 1.6 swaps per letter, points 1 to 3 at 0.15, 0.45 and 1.0. From corner A the story's mix has
//   come about 17 %, 41 % and 65 % of the way to the long-run mix at the three points and 78 % at T_PATH (even the
//   simplest rule leaves 13 % at 1.6; the slow part here is purines against pyrimidines, as those swaps are rarer).
// - the family tree: branch lengths seeded between 0.15 and 0.45 swaps per letter for the first split, 0.1 and 0.5 for
//   the second and 0.05 and 0.6 for the tips, so the crown is about as tall as it is wide.
// - the species tree ((s1, s2), s3): root to n1 0.25, n1 to s1 0.2, n1 to s2 0.3, root to s3 0.45: long enough for the
//   1 to 5 changed letters (of 12) that set the species apart from the true ancestor in Figure 5, short enough that
//   the stem is still recognisably one stem.
// - the pair model: w = 8, the poster's (matching pairs eight times as likely); both letters changing at once at a
//   tenth of the product of their single rates (dbl = 0.1: rare, but allowed, as the poster says).
// - the coupled circuit: the poster does not give its parts in detail, so Pcoupled is OUR STAND-IN for it (the story
//   says so wherever it shows): the independent turn, then a step that weights every resulting pair by w if it matches
//   and renormalises, on every branch however short; its root's prior is its own long-run mix (where its machine
//   settles, branch after branch, at the tree's mean branch length), which favours pairs more than the exact model's
//   (94 % of pairs matching against 83 %). So it favours pairs too strongly, by construction, which is what the
//   authors found of theirs.
// In this example (the story's model, w = 8) the exact chance that all six pairs of the rebuilt ancestor match is about
// 11 % letter by letter, 31 % with the exact pair model and 45 % with the coupled stand-in (2,000 sampled with seed 1:
// 11.0 %, 30.0 % and 46.1 %), and the long-run chance that all six match (allSixPrior) is about a third (0.33). The
// poster's test gives 10 %, 20 % and 43 %, and about a quarter: the stand-in landing near 43 % is chance, nothing was
// fitted to it, and the story shows the poster's numbers only as the poster's.
const MMATH = (() => {
  // ------------------------------------------------------------------ helpers
  // the kit's seeded random numbers (the same sequence as K.rng)
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // a number in [0, 1) from two integers, the same on every device (a read-out by index, a site's own stream)
  function hash(a, b) {
    let t = (Math.imul(a | 0, 0x9E3779B1) ^ Math.imul((b | 0) + 0x632BE5AB, 0x85EBCA77)) + 0x6D2B79F5 | 0;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const seedOf = (a, b) => Math.floor(hash(a, b) * 4294967296) | 0;
  const pop = v => { let c = 0; while (v) { v &= v - 1; c++; } return c; };
  const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // the poster's facts: MUT_DATA when it is loaded (read at call time: in the story it is pasted after this file),
  // else this copy of what the maths needs (the test checks the two agree)
  const COPY = {
    fig1: { ancestor: 'ACGTTAGC' },
    test: {
      species: { s1: { top: 'ATTACT', bottom: 'CGATAG' }, s2: { top: 'ATTACT', bottom: 'CTTTGA' }, s3: { top: 'GTTACT', bottom: 'TGAGGC' } },
      n: 2000, pairs: 6, w: 8,
    },
  };
  function data() {
    try { return typeof MUT_DATA !== 'undefined' ? MUT_DATA : COPY; } catch (e) { return COPY; }   // (not yet initialised)
  }

  // ------------------------------------------------------------------ letters
  const LETTERS = 'ACGT';
  const CODES = ['00', '01', '10', '11'];
  const KETS = CODES.map(c => `|${c}⟩`);
  const idx = ch => LETTERS.indexOf(ch);
  const bits = i => [i >> 1, i & 1];                     // [first qubit, second qubit]
  const toIdx = s => Uint8Array.from(s, idx);
  const toStr = a => Array.from(a, i => LETTERS[i]).join('');

  // ------------------------------------------------------------------ linear algebra
  // eigen-decomposition of a symmetric n x n matrix by cyclic Jacobi rotations: { vals, vecs } with eigenvector k in
  // column k (vecs[i * n + k])
  function eigSym(A, n) {
    const a = Float64Array.from(A), v = new Float64Array(n * n);
    for (let i = 0; i < n; i++) v[i * n + i] = 1;
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p * n + q] * a[p * n + q];
      if (off < 1e-32) break;
      for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
        const apq = a[p * n + q];
        if (Math.abs(apq) < 1e-300) continue;
        const th = (a[q * n + q] - a[p * n + p]) / (2 * apq);
        const t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const kp = a[k * n + p], kq = a[k * n + q]; a[k * n + p] = c * kp - s * kq; a[k * n + q] = s * kp + c * kq; }
        for (let k = 0; k < n; k++) { const pk = a[p * n + k], qk = a[q * n + k]; a[p * n + k] = c * pk - s * qk; a[q * n + k] = s * pk + c * qk; }
        for (let k = 0; k < n; k++) { const kp = v[k * n + p], kq = v[k * n + q]; v[k * n + p] = c * kp - s * kq; v[k * n + q] = s * kp + c * kq; }
      }
    }
    const vals = new Float64Array(n);
    for (let i = 0; i < n; i++) vals[i] = a[i * n + i];
    return { vals, vecs: v };
  }
  // a reversible rate matrix Q (n x n, row to column) with long-run shares pi, ready for e^(Qt): S = Pi^(1/2) Q
  // Pi^(-1/2) is symmetric, S = V L V^T, so e^(Qt) = Pi^(-1/2) V e^(Lt) V^T Pi^(1/2) = U e^(Lt) W
  function prepRev(Q, pi, n) {
    const sq = Float64Array.from(pi, Math.sqrt), S = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) S[i * n + j] = sq[i] * Q[i * n + j] / sq[j];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) S[i * n + j] = S[j * n + i] = (S[i * n + j] + S[j * n + i]) / 2;
    const { vals, vecs } = eigSym(S, n), U = new Float64Array(n * n), W = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) { U[i * n + k] = vecs[i * n + k] / sq[i]; W[k * n + i] = vecs[i * n + k] * sq[i]; }
    return { n, vals, U, W, ex: new Float64Array(n) };
  }
  // row r of e^(Qt) into out (from out[o]); exactly the identity at t = 0, never below 0 (rounding)
  function expRow(e, r, t, out, o = 0) {
    const n = e.n;
    if (!(t > 0)) { for (let j = 0; j < n; j++) out[o + j] = j === r ? 1 : 0; return out; }
    for (let k = 0; k < n; k++) e.ex[k] = Math.exp(e.vals[k] * t);
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += e.U[r * n + k] * e.ex[k] * e.W[k * n + j];
      out[o + j] = s > 0 ? s : 0;
    }
    return out;
  }
  function expAll(e, t, out) {
    const n = e.n;
    out = out || new Float64Array(n * n);
    for (let r = 0; r < n; r++) expRow(e, r, t, out, r * n);
    return out;
  }

  // ------------------------------------------------------------------ substitution models
  // r: exchangeabilities in the order AC, AG, AT, CG, CT, GT; pi: long-run shares of A, C, G, T
  const MODELS = [
    { key: 'even', name: 'All swaps alike', note: 'Every letter swaps for every other equally readily, and all four are equally common in the long run (JC69).',
      r: [1, 1, 1, 1, 1, 1], pi: [0.25, 0.25, 0.25, 0.25] },
    { key: 'transitions', name: 'A↔G and C↔T faster', note: 'A and G swap, and C and T swap, four times as readily as other pairs of letters; all four equally common in the long run (K80, κ = 4).',
      r: [1, 4, 1, 1, 4, 1], pi: [0.25, 0.25, 0.25, 0.25] },
    { key: 'uneven', name: 'The story\'s example', note: 'Each pair of letters swaps at its own rate, and the letters differ in how common they are in the long run (GTR). Example numbers.',
      r: [1.0, 3.6, 0.7, 1.1, 4.2, 0.9], pi: [0.32, 0.18, 0.24, 0.26] },
  ];
  const DEFAULT = 'uneven';
  const PAIRS6 = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];   // the order of r
  // a model by key, by index (0 even, 1 transitions, 2 uneven) or as an object ({ r, pi })
  function model(m) {
    if (m == null) m = DEFAULT;
    if (typeof m === 'number') return MODELS[m] || MODELS[2];
    if (typeof m === 'string') return MODELS.find(x => x.key === m) || MODELS[2];
    return m;
  }
  const prepCache = new Map(), objCache = new WeakMap();
  // per model: the scaled Q, its long-run shares, mu (the unscaled mean rate) and its eigen-decomposition
  function prep(m) {
    const mo = model(m), hit = mo.key ? prepCache.get(mo.key) : objCache.get(mo);
    if (hit) return hit;
    const ps = mo.pi.reduce((a, b) => a + b, 0), pi = Float64Array.from(mo.pi, v => v / ps), Qm = new Float64Array(16);
    PAIRS6.forEach(([i, j], k) => { Qm[i * 4 + j] = mo.r[k] * pi[j]; Qm[j * 4 + i] = mo.r[k] * pi[i]; });
    let mu = 0;
    for (let i = 0; i < 4; i++) { let s = 0; for (let j = 0; j < 4; j++) if (j !== i) s += Qm[i * 4 + j]; Qm[i * 5] = -s; mu += pi[i] * s; }
    for (let k = 0; k < 16; k++) Qm[k] /= mu;
    const e = { model: mo, Q: Qm, pi, mu, eig: prepRev(Qm, pi, 4) };
    if (mo.key) prepCache.set(mo.key, e); else objCache.set(mo, e);
    return e;
  }
  // the 4 x 4 rate matrix (row i to column j), mean rate sum pi_i (-Q_ii) = 1
  const Q = m => Float64Array.from(prep(m).Q);
  const pi = m => Float64Array.from(prep(m).pi);
  // P(t) = e^(Qt): the chance a letter i becomes j along a branch of length t
  const P = (m, t, out) => expAll(prep(m).eig, t, out);

  // ------------------------------------------------------------------ the path and the pyramid
  const T_PATH = 1.6, POINTS = [0.15, 0.45, 1.0];
  // the mix after t, starting from the pure letter `start` (row `start` of P(t)); per frame: give it out
  const path = (m, start, t, out) => expRow(prep(m).eig, start, t, out || new Float64Array(4));
  // a regular tetrahedron of edge 1.6 centred on the origin: A at the top, C front left, G at the back, T front right
  // (the story faces +z)
  const CORNERS = (() => {
    const E = 1.6, R = E * Math.sqrt(6) / 4, b = E / Math.sqrt(3), y = -R / 3;
    return [[0, R, 0], [-E / 2, y, b / 2], [0, y, -b], [E / 2, y, b / 2]];
  })();
  function simplex(p, out) {
    out = out || [0, 0, 0];
    out[0] = out[1] = out[2] = 0;
    for (let i = 0; i < 4; i++) for (let d = 0; d < 3; d++) out[d] += p[i] * CORNERS[i][d];
    return out;
  }

  // ------------------------------------------------------------------ qubits
  const amps = p => Array.from(p, v => Math.sqrt(Math.max(v, 0)));
  // the two qubits' Bloch vectors of the state sum sqrt(p_i) |i>: x, y, z of the first qubit, then of the second
  // (y is 0: the amplitudes are real; z +1 is 0, up; length 1 for a pure letter, shorter when the two depend on each
  // other)
  function bloch(p, out) {
    out = out || new Float64Array(6);
    const a0 = Math.sqrt(Math.max(p[0], 0)), a1 = Math.sqrt(Math.max(p[1], 0)), a2 = Math.sqrt(Math.max(p[2], 0)), a3 = Math.sqrt(Math.max(p[3], 0));
    const n = (a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3) || 1;
    out[0] = 2 * (a0 * a2 + a1 * a3) / n; out[1] = 0; out[2] = (a0 * a0 + a1 * a1 - a2 * a2 - a3 * a3) / n;
    out[3] = 2 * (a0 * a1 + a2 * a3) / n; out[4] = 0; out[5] = (a0 * a0 + a2 * a2 - a1 * a1 - a3 * a3) / n;
    return out;
  }
  // the k-th read-out of the mix p (a letter index): the same on every device for the same seed and k
  function sample(p, seed, k) {
    const s = p[0] + p[1] + p[2] + p[3];
    let u = hash(seed, k) * s;
    for (let i = 0; i < 3; i++) { if (u < p[i]) return i; u -= p[i]; }
    return 3;
  }

  // ------------------------------------------------------------------ the circuit for one branch
  // wires top to bottom: the parent's two qubits p1, p0, the child's c1, c0; a basis state is 8 p1 + 4 p0 + 2 c1 + c0
  const WIRES = ['p1', 'p0', 'c1', 'c0'];
  const bitOf = w => 3 - WIRES.indexOf(w);
  // the RY angle that turns |b> into sqrt(a0)|0> + sqrt(a1)|1> (a0, a1 >= 0, up to a common factor; 0 when both are 0)
  const ryTo = (b, a0, a1) => (b ? -2 * Math.atan2(Math.sqrt(a0), Math.sqrt(a1)) : 2 * Math.atan2(Math.sqrt(a1), Math.sqrt(a0))) || 0;
  const P16 = new Float64Array(16), A12 = new Float64Array(12);
  // the turn's 12 angles at branch length t: [0..3] c1's by the parent's letter i, [4..11] c0's by 2 i + c1. After the
  // copy the child is |i>; these take it to sum_j sqrt(P_ij(t)) |j> with non-negative amplitudes: all 0 at t = 0
  function angles(m, t, out) {
    out = out || new Float64Array(12);
    const Pm = P(m, t, P16);
    for (let i = 0; i < 4; i++) {
      const r = i * 4, b1 = i >> 1, b0 = i & 1;
      out[i] = ryTo(b1, Pm[r] + Pm[r + 1], Pm[r + 2] + Pm[r + 3]);
      for (let c = 0; c < 2; c++) out[4 + 2 * i + c] = ryTo(b0, Pm[r + 2 * c], Pm[r + 2 * c + 1]);
    }
    return out;
  }
  // the circuit: the copy (two CNOTs), then the turn (two uniformly controlled RY rotations)
  function circuit(m, t) {
    const a = angles(m, t);
    return {
      wires: WIRES.slice(), t,
      gates: [
        { type: 'CNOT', part: 'copy', ctrl: 'p1', tgt: 'c1' },
        { type: 'CNOT', part: 'copy', ctrl: 'p0', tgt: 'c0' },
        { type: 'MRY', part: 'turn', tgt: 'c1', ctrls: ['p1', 'p0'], thetas: Array.from(a.subarray(0, 4)) },
        { type: 'MRY', part: 'turn', tgt: 'c0', ctrls: ['p1', 'p0', 'c1'], thetas: Array.from(a.subarray(4, 12)) },
      ],
    };
  }
  // a gate as single-qubit RY turns and CNOTs: a uniformly controlled RY with k controls becomes 2^k RY and 2^k CNOT
  // (the Gray-code construction): RY(alpha_j) then a CNOT from the control whose bit changes between gray(j) and
  // gray(j + 1), so control state x turns by sum_j (-1)^|x & gray(j)| alpha_j; alpha solves that for the thetas
  function decompose(g) {
    if (g.type !== 'MRY') return [Object.assign({}, g)];
    const k = g.ctrls.length, N = 1 << k, gray = j => j ^ (j >> 1), out = [];
    for (let j = 0; j < N; j++) {
      let a = 0;
      for (let x = 0; x < N; x++) a += (pop(x & gray(j)) & 1 ? -1 : 1) * g.thetas[x];
      out.push({ type: 'RY', part: g.part, tgt: g.tgt, theta: a / N });
      const d = gray(j) ^ gray((j + 1) % N);
      if (d) out.push({ type: 'CNOT', part: g.part, ctrl: g.ctrls[k - 1 - Math.log2(d)], tgt: g.tgt });
    }
    return out;
  }
  // runs gates on a 4-qubit state vector (real amplitudes: every gate here is real)
  function run(gates, st) {
    for (const g of gates) {
      const tb = 1 << bitOf(g.tgt);
      for (let s = 0; s < 16; s++) {
        if (s & tb) continue;
        const s1 = s | tb;
        if (g.type === 'CNOT') { if (s & (1 << bitOf(g.ctrl))) { const v = st[s]; st[s] = st[s1]; st[s1] = v; } continue; }
        let th = g.theta;
        if (g.type === 'MRY') { let x = 0; for (const c of g.ctrls) x = 2 * x + (s >> bitOf(c) & 1); th = g.thetas[x]; }
        const c = Math.cos(th / 2), sn = Math.sin(th / 2), v0 = st[s], v1 = st[s1];
        st[s] = c * v0 - sn * v1; st[s1] = sn * v0 + c * v1;
      }
    }
    return st;
  }
  // the child's read-out chances when the parent is the letter `parent`: a state-vector run of the circuit (simple:
  // of its decomposition); equals row `parent` of P(t)
  function simulate(m, t, parent, simple) {
    let gates = circuit(m, t).gates;
    if (simple) gates = gates.flatMap(decompose);
    const st = run(gates, (() => { const s = new Float64Array(16); s[parent << 2] = 1; return s; })()), out = new Float64Array(4);
    for (let s = 0; s < 16; s++) out[s & 3] += st[s] * st[s];
    return out;
  }
  // one number for the gears: the mean |theta| of the turn, each c0 angle weighted by the share of the state it acts
  // on (in a plain mean the angles for the c1 value not yet reached would jump at t = 0+, though they act on nothing);
  // 0 at t = 0, growing with t
  function turnAngle(m, t) {
    const a = angles(m, t, A12), Pm = P16;
    let s = 0;
    for (let i = 0; i < 4; i++) {
      const r = i * 4, q0 = Pm[r] + Pm[r + 1], q1 = Pm[r + 2] + Pm[r + 3];
      s += (Math.abs(a[i]) + q0 * Math.abs(a[4 + 2 * i]) + q1 * Math.abs(a[5 + 2 * i])) / 2;
    }
    return s / 4;
  }

  // ------------------------------------------------------------------ trees
  // nodes { id, parent (-1 at the root), len (expected swaps per letter on the branch into it), kids, pos: [x, y, z],
  // depth, tip (index or -1), seq, branch (index of the branch into it, -1 at the root) }; branches { id, from, to, len,
  // depth, muts }. Branch b leads into node b + 1 (nodes are numbered level by level).
  const ROOT = [0, -1, 0], RISE = 1.6, TOP = 1.2;
  function node(nodes, parent, depth, az, rad) {
    const id = nodes.length;
    nodes.push({ id, parent, len: 0, kids: [], pos: [0, 0, 0], depth, tip: -1, seq: '', branch: id - 1, az, rad });
    if (parent >= 0) nodes[parent].kids.push(id);
    return id;
  }
  function place(nodes, unit) {
    for (const n of nodes) {
      if (n.parent < 0) { n.pos = ROOT.slice(); continue; }
      const p = nodes[n.parent];
      n.pos = [n.rad * Math.cos(n.az), p.pos[1] + n.len * unit, n.rad * Math.sin(n.az)];
    }
  }
  // the family tree: three levels of splits (8 tips, 14 branches). Layout: the root at (0, -1, 0); a child sits above
  // its parent by its branch length x 1.6 (heights are change: tips end at different heights; less than 1.6 only when
  // a tall seed would pass y = 1.2) and out from the vertical axis, farther the deeper (radii about 0.38, 0.78, 1.12);
  // the first split along x, each deeper split round its parent's direction (+-45 then +-22.5 degrees, a little
  // seeded jitter), so the eight tips stand evenly round the vertical: a round crown, never in a plane. The speed
  // scales the branch lengths (and the mutations) but not the drawing, so a tree keeps its shape: tree.unit is the
  // drawn height of one swap per letter.
  function familyTree(seed = 1, speed = 1, m = DEFAULT) {
    const r = rng(seed), e = prep(m), nodes = [], LEN = [[0.15, 0.45], [0.1, 0.5], [0.05, 0.6]];
    const RAD = [0, 0.38, 0.78, 1.12], SPREAD = [0, Math.PI / 2, Math.PI / 4, Math.PI / 8];
    const root = node(nodes, -1, 0, Math.PI / 2, 0);
    for (let d = 1; d <= 3; d++) {
      for (const p of nodes.filter(n => n.depth === d - 1)) for (const side of [-1, 1]) {
        const lo = LEN[d - 1][0], hi = LEN[d - 1][1], len = lo + (hi - lo) * r();
        const az = p.az + side * SPREAD[d] + (r() - 0.5) * 0.24, rad = RAD[d] * (1 + (r() - 0.5) * 0.1);
        nodes[node(nodes, p.id, d, az, rad)].len = len;
      }
    }
    let tip = 0, deep = 0;
    for (const n of nodes) {
      if (!n.kids.length) n.tip = tip++;
      n.path = n.parent < 0 ? 0 : nodes[n.parent].path + n.len;
      deep = Math.max(deep, n.path);
    }
    const unit = Math.min(RISE, (TOP - ROOT[1]) / deep);
    place(nodes, unit);
    // the mutations: each site follows the model exactly (waiting times and jumps of the Markov chain) along the branch,
    // from its own seeded stream
    const Qm = e.Q, branches = [];
    nodes[root].seq = data().fig1.ancestor;
    for (const n of nodes) {
      delete n.path;
      if (n.parent < 0) continue;
      n.len *= speed;
      const b = n.id - 1, from = toIdx(nodes[n.parent].seq), muts = [];
      for (let site = 0; site < from.length; site++) {
        const rs = rng(seedOf(seed * 131 + b, site));
        let x = from[site], tau = 0;
        for (;;) {
          const rate = -Qm[x * 5];
          tau += -Math.log(1 - rs()) / rate;
          if (tau >= n.len) break;
          let u = rs() * rate, y = 0;
          for (y = 0; y < 4; y++) { if (y === x) continue; if (u < Qm[x * 4 + y]) break; u -= Qm[x * 4 + y]; }
          if (y > 3) y = x === 3 ? 2 : 3;   // (rounding at the very end)
          muts.push({ at: tau / n.len, site, from: x, to: y });
          x = y;
        }
        from[site] = x;
      }
      muts.sort((a, c) => a.at - c.at);
      n.seq = toStr(from);
      branches.push({ id: b, from: n.parent, to: n.id, len: n.len, depth: n.depth, muts });
    }
    const byLen = branches.slice().sort((a, b) => a.len - b.len);
    return { kind: 'family', seed, speed, model: e.model.key, nodes, branches, root, tips: tip, unit: unit / speed,
      longest: byLen[byLen.length - 1].id, shortest: byLen[0].id };
  }
  // the poster's species tree ((s1, s2), s3) with example branch lengths, laid out the same way: the root's split along
  // a line from front right to back left, n1's two tips round the vertical from it, so the three tips stand about 120
  // degrees apart (s1 front left, s2 at the back, s3 front right); the tips' stems are Figure 5's
  function speciesTree() {
    const sp = data().test.species, nodes = [], deg = Math.PI / 180;
    const root = node(nodes, -1, 0, 0, 0);
    const n1 = node(nodes, root, 1, 210 * deg, 0.42), s3 = node(nodes, root, 1, 30 * deg, 0.9);
    const s1 = node(nodes, n1, 2, 150 * deg, 0.9), s2 = node(nodes, n1, 2, 270 * deg, 0.9);
    const LEN = { [n1]: 0.25, [s3]: 0.45, [s1]: 0.2, [s2]: 0.3 }, NAME = ['root', 'n1', 's3', 's1', 's2'];
    for (const n of nodes) { n.len = LEN[n.id] || 0; n.name = NAME[n.id]; n.seq = null; }
    place(nodes, RISE);
    [[s1, 's1'], [s2, 's2'], [s3, 's3']].forEach(([id, k], i) => {
      const n = nodes[id];
      n.tip = i; n.stem = { top: sp[k].top, bottom: sp[k].bottom }; n.seq = sp[k].top + sp[k].bottom;
    });
    const branches = nodes.filter(n => n.parent >= 0).map(n => ({ id: n.id - 1, from: n.parent, to: n.id, len: n.len, depth: n.depth, muts: [] }));
    return { kind: 'species', nodes, branches, root, tips: 3, unit: RISE, tipIds: [s1, s2, s3] };
  }
  const br = (tree, b) => (typeof b === 'number' ? tree.branches[b] : b);
  // a point on a branch's smooth curve (u 0 at the parent, 1 at the child): it leaves the parent upwards, bends
  // outwards and arrives nearly upright (a cubic Bezier, monotone in height)
  function curve(tree, b, u, out) {
    const B = br(tree, b), p0 = tree.nodes[B.from].pos, p3 = tree.nodes[B.to].pos, dy = p3[1] - p0[1], v = 1 - u;
    const w0 = v * v * v, w1 = 3 * v * v * u, w2 = 3 * v * u * u, w3 = u * u * u;
    out = out || [0, 0, 0];
    for (let d = 0; d < 3; d++) {
      const c1 = p0[d] + (d === 1 ? 0.5 * dy : 0), c2 = d === 1 ? p3[1] - 0.35 * dy : p3[d] - 0.15 * (p3[d] - p0[d]);
      out[d] = w0 * p0[d] + w1 * c1 + w2 * c2 + w3 * p3[d];
    }
    return out;
  }
  // its direction there (not normalised)
  function tangent(tree, b, u, out) {
    const B = br(tree, b), p0 = tree.nodes[B.from].pos, p3 = tree.nodes[B.to].pos, dy = p3[1] - p0[1], v = 1 - u;
    out = out || [0, 0, 0];
    for (let d = 0; d < 3; d++) {
      const c1 = p0[d] + (d === 1 ? 0.5 * dy : 0), c2 = d === 1 ? p3[1] - 0.35 * dy : p3[d] - 0.15 * (p3[d] - p0[d]);
      out[d] = 3 * v * v * (c1 - p0[d]) + 6 * v * u * (c2 - c1) + 3 * u * u * (p3[d] - c2);
    }
    return out;
  }
  // the sequence riding up branch b at u (its mutations up to there applied): letter indices into out
  function seqAt(tree, b, u, out) {
    const B = br(tree, b), s = tree.nodes[B.from].seq;
    out = out || new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = idx(s[i]);
    for (const mu of B.muts) { if (mu.at > u) break; out[mu.site] = mu.to; }
    return out;
  }

  // ------------------------------------------------------------------ pairs
  // the pairs that hold: A-T, C-G, G-T, both ways round
  const OKS = new Uint8Array(16);
  [[0, 3], [1, 2], [2, 3]].forEach(([x, y]) => { OKS[4 * x + y] = OKS[4 * y + x] = 1; });
  const ok = (x, y) => OKS[4 * (typeof x === 'string' ? idx(x) : x) + (typeof y === 'string' ? idx(y) : y)] === 1;
  const pairState = (x, y) => 4 * x + y;
  // the pairs of a stem that do not hold (0-based)
  const brokenPairs = (top, bottom) => [...top].map((c, i) => (ok(c, bottom[i]) ? -1 : i)).filter(i => i >= 0);
  const pairCache = new Map();
  const mkey = m => { const mo = model(m); return mo.key || JSON.stringify([mo.r, mo.pi]); };
  // a reversible pair model on the 16 states 4x + y: long-run share pi_xy ~ pi_x pi_y m(xy), m = w for a matching pair
  // and 1 otherwise; one letter changing: Q_xx' sqrt(m(x'y) / m(xy)) (Q the single letters' scaled rates); both at
  // once: dbl Q_xx' Q_yy' sqrt(m(x'y') / m(xy)); detailed balance holds by construction; scaled so the expected number
  // of letter changes per letter per unit time is 1 at the long-run mix. -> { Q (256), pi (16), w, dbl, eig }
  function pairModel(m, w = 8, dbl = 0.1) {
    const key = `${mkey(m)}|${w}|${dbl}`;
    if (pairCache.has(key)) return pairCache.get(key);
    const e = prep(m), q = e.Q, mm = s => (OKS[s] ? w : 1), Qp = new Float64Array(256), pp = new Float64Array(16);
    let z = 0;
    for (let s = 0; s < 16; s++) z += (pp[s] = e.pi[s >> 2] * e.pi[s & 3] * mm(s));
    for (let s = 0; s < 16; s++) pp[s] /= z;
    let changes = 0;
    for (let s = 0; s < 16; s++) {
      const x = s >> 2, y = s & 3;
      for (let s2 = 0; s2 < 16; s2++) {
        if (s2 === s) continue;
        const x2 = s2 >> 2, y2 = s2 & 3, f = Math.sqrt(mm(s2) / mm(s));
        const rate = y2 === y ? q[x * 4 + x2] * f : x2 === x ? q[y * 4 + y2] * f : dbl * q[x * 4 + x2] * q[y * 4 + y2] * f;
        Qp[s * 16 + s2] = rate;
        changes += pp[s] * rate * ((x !== x2) + (y !== y2)) / 2;
      }
    }
    for (let s = 0; s < 16; s++) {
      let sum = 0;
      for (let s2 = 0; s2 < 16; s2++) if (s2 !== s) sum += (Qp[s * 16 + s2] /= changes);
      Qp[s * 17] = -sum;
    }
    const pm = { Q: Qp, pi: pp, w, dbl, eig: prepRev(Qp, pp, 16) };
    pairCache.set(key, pm);
    return pm;
  }
  // e^(Q t) of the pair model (16 x 16, row to column)
  const Ppair = (m, w = 8, t = 0, dbl = 0.1, out) => expAll(pairModel(m, w, dbl).eig, t, out);
  const P4 = new Float64Array(16);
  // letter by letter: P(t) (x) P(t)
  function Pindep(m, t, out) {
    out = out || new Float64Array(256);
    const p = P(m, t, P4);
    for (let s = 0; s < 16; s++) for (let s2 = 0; s2 < 16; s2++) out[s * 16 + s2] = p[(s >> 2) * 4 + (s2 >> 2)] * p[(s & 3) * 4 + (s2 & 3)];
    return out;
  }
  // OUR STAND-IN for the authors' coupled circuit: the independent turn, then a coupling that weights each resulting
  // pair by w if it matches and normalises each row, so every branch favours matching pairs w times, however short it
  // is: too strongly, by design, as the authors found of theirs
  function Pcoupled(m, w = 8, t = 0, out) {
    out = Pindep(m, t, out);
    for (let s = 0; s < 16; s++) {
      let z = 0;
      for (let s2 = 0; s2 < 16; s2++) z += (out[s * 16 + s2] *= OKS[s2] ? w : 1);
      for (let s2 = 0; s2 < 16; s2++) out[s * 16 + s2] /= z;
    }
    return out;
  }
  // the long-run share of matching pairs, and the chance that all six pairs of a stem match
  function matchShare(m, w = 8) {
    const p = pairModel(m, w).pi;
    let s = 0;
    for (let k = 0; k < 16; k++) if (OKS[k]) s += p[k];
    return s;
  }
  const allSixPrior = (m, w = 8) => Math.pow(matchShare(m, w), data().test.pairs || 6);

  // ------------------------------------------------------------------ rebuilding the ancestor
  const METHODS = ['indep', 'coupled', 'exact'];
  // a method's 16 x 16 matrix for a branch, and its long-run mix (the root's prior)
  function trans(method, m, w, t, dbl) {
    return method === 'indep' ? Pindep(m, t) : method === 'coupled' ? Pcoupled(m, w, t) : Ppair(m, w, t, dbl);
  }
  // the long-run mix of a step M (n x n, rows sum to 1): pi M = pi, sum pi = 1 (Gauss-Jordan elimination)
  function stationary(M, n = 16) {
    const c1 = n + 1, A = new Float64Array(n * c1);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) A[i * c1 + j] = i === n - 1 ? 1 : M[j * n + i] - (i === j ? 1 : 0);
      A[i * c1 + n] = i === n - 1 ? 1 : 0;
    }
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r * c1 + c]) > Math.abs(A[p * c1 + c])) p = r;
      if (p !== c) for (let k = 0; k <= n; k++) { const v = A[c * c1 + k]; A[c * c1 + k] = A[p * c1 + k]; A[p * c1 + k] = v; }
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = A[r * c1 + c] / A[c * c1 + c];
        if (f) for (let k = c; k <= n; k++) A[r * c1 + k] -= f * A[c * c1 + k];
      }
    }
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.max(A[i * c1 + n] / A[i * c1 + i], 0);
    return out;
  }
  // a method's long-run mix, the root's prior: letter by letter pi_x pi_y; the exact pair model's pi_xy; the coupled
  // stand-in's, where its machine settles when run branch after branch (its step is not the same for every length:
  // here at the tree's mean branch length, tbar). That mix favours matching pairs more than the exact model's does
  // (on short steps the weight w comes on top of the pairs' own long-run favour), which is part of how the stand-in
  // favours pairs too strongly; with the exact model's mix as its prior it would rebuild fewer intact ancestors than
  // letter by letter on Figure 5's stems, as each branch's weighting makes the species' broken pairs unlikely
  function prior(method, m, w = 8, dbl = 0.1, tbar = 0.3) {
    if (method === 'exact') return pairModel(m, w, dbl).pi;
    if (method === 'coupled') return stationary(Pcoupled(m, w, tbar));
    const p = prep(m).pi, out = new Float64Array(16);
    for (let s = 0; s < 16; s++) out[s] = p[s >> 2] * p[s & 3];
    return out;
  }
  const rebuildCache = new Map();
  // the ancestor of the species tree's stems rebuilt by one method: per pair the posterior over the 16 root states
  // (Felsenstein's pruning with the method's matrix on every branch, its long-run mix as the prior), n ancestors
  // sampled from it (seeded), how many have all six pairs matching, and the exact chance of that
  // -> { method, post (Float64Array(6 x 16)), pairOk (6: each pair's chance to match), samples (Uint8Array(n x 6) of
  //    pair states), good (Uint8Array(n): 1 if all six match), intact, share, expected, best: { top, bottom } }
  function rebuild(method, o = {}) {
    const d = data().test, mo = model(o.model), w = o.w == null ? d.w : o.w, n = o.n == null ? d.n : o.n;
    const seed = o.seed == null ? 1 : o.seed, dbl = o.dbl == null ? 0.1 : o.dbl;
    const key = `${method}|${mkey(mo)}|${w}|${n}|${seed}|${dbl}`;
    if (rebuildCache.has(key)) return rebuildCache.get(key);
    const tr = speciesTree(), N = tr.nodes.length, mats = tr.nodes.map(nd => (nd.parent < 0 ? null : trans(method, mo, w, nd.len, dbl)));
    const tbar = tr.branches.reduce((a, b) => a + b.len, 0) / tr.branches.length;
    const pri = prior(method, mo, w, dbl, tbar), K = tr.nodes.find(nd => nd.stem).stem.top.length;
    const post = new Float64Array(K * 16), pairOk = new Float64Array(K), L = new Float64Array(N * 16);
    let top = '', bottom = '', expected = 1;
    for (let i = 0; i < K; i++) {
      for (let a = N - 1; a >= 0; a--) {   // children are numbered after their parents
        const nd = tr.nodes[a];
        if (nd.stem) { const st = pairState(idx(nd.stem.top[i]), idx(nd.stem.bottom[i])); for (let s = 0; s < 16; s++) L[a * 16 + s] = s === st ? 1 : 0; continue; }
        for (let s = 0; s < 16; s++) L[a * 16 + s] = 1;
        for (const c of nd.kids) {
          const M = mats[c];
          for (let s = 0; s < 16; s++) { let v = 0; for (let s2 = 0; s2 < 16; s2++) v += M[s * 16 + s2] * L[c * 16 + s2]; L[a * 16 + s] *= v; }
        }
      }
      let z = 0, bs = 0;
      for (let s = 0; s < 16; s++) z += (post[i * 16 + s] = pri[s] * L[tr.root * 16 + s]);
      for (let s = 0; s < 16; s++) { post[i * 16 + s] /= z; if (OKS[s]) pairOk[i] += post[i * 16 + s]; if (post[i * 16 + s] > post[i * 16 + bs]) bs = s; }
      top += LETTERS[bs >> 2]; bottom += LETTERS[bs & 3];
      expected *= pairOk[i];
    }
    const r = rng(seed), samples = new Uint8Array(n * K), good = new Uint8Array(n);
    let intact = 0;
    for (let k = 0; k < n; k++) {
      let all = 1;
      for (let i = 0; i < K; i++) {
        let u = r(), s = 0;
        for (; s < 15; s++) { u -= post[i * 16 + s]; if (u < 0) break; }
        samples[k * K + i] = s;
        if (!OKS[s]) all = 0;
      }
      good[k] = all; intact += all;
    }
    const res = { method, model: mo.key, w, n, seed, dbl, pairs: K, prior: pri, post, pairOk, samples, good, intact, share: intact / n, expected, best: { top, bottom } };
    rebuildCache.set(key, res);
    return res;
  }
  // n ancestors with exactly round(share x n) of them intact, for showing the authors' shares with plausible broken
  // pairs: the intact ones drawn from the method's posterior given that all six pairs match, the rest from it given at
  // least one broken (the story's model, w = 8); which ones are intact is shuffled (seeded)
  function crowd(method, share, n = 2000, seed = 1) {
    const R = rebuild(method, { n: 1 }), K = R.pairs, post = R.post, r = rng(seedOf(seed, 7 + METHODS.indexOf(method)));
    const k = Math.round(share * n), order = shuffle([...Array(n).keys()], r), samples = new Uint8Array(n * K), good = new Uint8Array(n);
    const draw = (i, onlyOk) => {
      let z = 0;
      for (let s = 0; s < 16; s++) if (!onlyOk || OKS[s]) z += post[i * 16 + s];
      let u = r() * z, s = 0;
      for (; s < 15; s++) { if (onlyOk && !OKS[s]) continue; u -= post[i * 16 + s]; if (u < 0) break; }
      while (onlyOk && !OKS[s]) s--;   // (rounding at the very end: the last matching state)
      return s;
    };
    for (let j = 0; j < n; j++) {
      const a = order[j], intact = j < k;
      for (let tries = 0; ; tries++) {
        let all = 1;
        for (let i = 0; i < K; i++) { const s = draw(i, intact); samples[a * K + i] = s; if (!OKS[s]) all = 0; }
        if (intact || !all) break;
        if (tries > 200) { samples[a * K] = 0; break; }   // (A-A: broken, should a posterior ever hold only pairs)
      }
      good[a] = intact ? 1 : 0;
    }
    return { method, n, pairs: K, samples, good, intact: k, share: k / n };
  }
  // the combinations a model of k linked letters must track, and the qubits that hold them
  const combos = k => Math.pow(4, k);
  const qubits = k => 2 * k;

  return {
    rng, hash, pop, data, LETTERS, CODES, KETS, idx, bits, toIdx, toStr,
    MODELS, DEFAULT, model, Q, pi, P, T_PATH, POINTS, path, CORNERS, simplex,
    amps, bloch, sample, WIRES, angles, circuit, decompose, run, simulate, turnAngle,
    familyTree, speciesTree, curve, tangent, seqAt,
    OKS, ok, pairState, brokenPairs, pairModel, Ppair, Pindep, Pcoupled, matchShare, allSixPrior,
    METHODS, prior, stationary, rebuild, crowd, combos, qubits, eigSym,
  };
})();
if (typeof module !== 'undefined') module.exports = MMATH;
