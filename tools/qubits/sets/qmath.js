// QMATH: the maths of the qubits story, computed live from small example networks (no real network data).
// Plain script: in stories/qubits.js it is pasted inside the story's closure (the build drops the module line at the
// end); in Node, require() or import it (tools/qubits/test-qmath.mjs checks it).
//
// What it does, in the order of the story:
// - example networks: the planted hypercube block model (8 groups of genes on the corners of a cube, after the authors'
//   synthetic check: 0.5 within a group, 0.04 between cube neighbors, 0.002 otherwise; here 40 genes a group) at three
//   strengths of mixing, and a random network with as many links as the clearest one; all seeded, so every device
//   builds the same ones;
// - the bisections: a stand-in for the authors' beam search (see cut()): spectral clustering into 2^L equal cells, then
//   the cube labelling that keeps the most coupling on one-bit hops; bisection q is bit q of the cell code, the first
//   bisection the most significant bit, so cells nest as prefixes; and random halvings to compare with;
// - the coarse operator A_c = P A P^T (P the normalized cell indicators), Sinkhorn-balanced over cells;
// - the Pauli decomposition of a 2^L x 2^L matrix over all 4^L strings by a Walsh-Hadamard transform, O(4^L L);
// - the algebras: the TFIM chain (X_q and Z_q Z_(q+1), closing to so(2L)) and so(2L+1) (plus the boundary Z on the top
//   qubit), closed under commutators of Pauli strings;
// - the residual ||A0 - Pi A0||_F / ||A0||_F of the traceless part, the reconstruction from the first k strings and its
//   error, and the angles of one Trotter step, theta = -2 c t.
//
// Pauli strings are indices k = (x << L) | z: bit q of x puts an X on qubit q, bit q of z a Z (both: Y). The string is
// sigma = i^|x & z| X^x Z^z, so (sigma)[b ^ x][b] = i^|x & z| (-1)^|z & b|. Qubit q is bit q of the cell index; q0 is
// the least significant bit, q(L-1) the first bisection. Names are written from the top qubit down: X2X1, Z0, Y2Y1.
const QMATH = (() => {
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
  const pop = v => { let c = 0; while (v) { v &= v - 1; c++; } return c; };
  const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ------------------------------------------------------------------ example networks
  // A network: { key, name, n, edges (Int32Array, pairs i<j), group (Int8Array, the planted corner of each gene, or
  // null), deg, nbr (CSR: off, adj) }. Genes are numbered in a shuffled order, so nothing can read the groups off it.
  function finish(key, name, n, list, group, note) {
    const edges = Int32Array.from(list), m = edges.length / 2, deg = new Int32Array(n);
    for (let e = 0; e < m; e++) { deg[edges[2 * e]]++; deg[edges[2 * e + 1]]++; }
    const off = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) off[i + 1] = off[i] + deg[i];
    const adj = new Int32Array(2 * m), fill = off.slice(0, n);
    for (let e = 0; e < m; e++) { const a = edges[2 * e], b = edges[2 * e + 1]; adj[fill[a]++] = b; adj[fill[b]++] = a; }
    return { key, name, note, n, m, edges, group, deg, off, adj };
  }
  // the planted hypercube block model: 2^bits groups of per genes; a pair is linked with probability pin inside a group,
  // pnbr between groups one bit apart on the cube, pfar otherwise. Each may be a number or a function: pin(g),
  // pnbr(g, h, q) (q the bit they differ in), pfar(g, h) (g, h the groups' corners, 0 .. 2^bits - 1)
  function planted(o) {
    const bits = o.bits || 3, G = 1 << bits, per = o.per || 40, n = G * per, r = rng(o.seed || 1);
    const order = shuffle([...Array(n).keys()], r);   // gene id of the j-th member of the planted list
    const group = new Int8Array(n);
    for (let j = 0; j < n; j++) group[order[j]] = Math.floor(j / per);
    const f = v => (typeof v === 'function' ? v : () => v), pin = f(o.pin), pnbr = f(o.pnbr), pfar = f(o.pfar);
    const P = new Float64Array(G * G);
    for (let g = 0; g < G; g++) for (let h = 0; h < G; h++) {
      const x = g ^ h, d = pop(x);
      P[g * G + h] = d === 0 ? pin(g) : d === 1 ? pnbr(Math.min(g, h), Math.max(g, h), Math.log2(x)) : pfar(Math.min(g, h), Math.max(g, h));
    }
    const list = [];
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (r() < P[group[a] * G + group[b]]) list.push(a, b);
    return finish(o.key, o.name, n, list, group, o.note);
  }
  // a random network (Erdos-Renyi) with a given number of links: no groups to find
  function random(o) {
    const n = o.n, r = rng(o.seed || 1), seen = new Set(), list = [];
    while (list.length < 2 * o.m) {
      const a = Math.floor(r() * n), b = Math.floor(r() * n);
      if (a === b) continue;
      const i = Math.min(a, b), j = Math.max(a, b);
      if (seen.has(i * n + j)) continue;
      seen.add(i * n + j); list.push(i, j);
    }
    return finish(o.key, o.name, n, list, null, o.note);
  }
  // the story's example networks (key, name, how it is made); built on first use and kept
  const sg = (g, q) => (g >> q & 1 ? -1 : 1);   // +1 where bit q of a corner is 0, -1 where it is 1
  const NETS = [
    { key: 'clear', name: 'Clear groups', kind: 'planted', per: 40, pin: 0.5, pnbr: 0.04, pfar: 0.002, seed: 11,
      note: '8 groups of 40 genes on a cube: linked with probability 0.5 inside a group, 0.04 between neighbors, 0.002 otherwise' },
    // (uneven, like a real network: some groups denser inside, hops along bit 1 strongest and stronger on the side
    // where bit 2 is 0, more links across one face diagonal than the other)
    { key: 'mixed', name: 'Uneven groups', kind: 'planted', per: 40, seed: 12,
      pin: g => 0.5 + 0.08 * sg(g, 2) * sg(g, 1) + 0.05 * sg(g, 2),
      pnbr: (g, h, q) => (q === 1 ? 0.14 + 0.04 * sg(g, 2) : q === 2 ? 0.09 : 0.07 + 0.03 * sg(g, 1)),
      pfar: (g, h) => ((g ^ h) === 6 ? (sg(g, 2) === sg(g, 1) ? 0.015 : 0.05) : (g ^ h) === 3 ? 0.03 : (g ^ h) === 5 ? 0.01 : 0.006),
      note: '8 groups of 40 genes on a cube, uneven: 0.37 to 0.63 inside a group, 0.04 to 0.18 between neighbors, 0.006 to 0.05 otherwise' },
    { key: 'blurred', name: 'Strong mixing', kind: 'planted', per: 40, pin: 0.5, pnbr: 0.25, pfar: 0.12, seed: 13,
      note: '8 groups of 40 genes on a cube: 0.5 inside a group, 0.25 between neighbors, 0.12 otherwise' },
    { key: 'random', name: 'Random network', kind: 'random', n: 320, seed: 14,
      note: '320 genes and as many links as the clear network, placed at random: no groups' },
  ];
  const DEFAULT = 'mixed';   // the story's network
  const cache = {};
  function network(key) {
    if (cache[key]) return cache[key];
    const s = NETS.find(x => x.key === key);
    if (!s) throw new Error('unknown network ' + key);
    const net = s.kind === 'planted' ? planted(s) : random(Object.assign({ m: network('clear').m }, s));
    return (cache[key] = net);
  }

  // ------------------------------------------------------------------ the bisections
  // The slowest modes: an orthonormal basis (n x k, column-major Float64Array) of the k leading eigenvectors of
  // (I + D^-1/2 A D^-1/2) / 2, by subspace iteration from a seeded start (the shift keeps the bulk below the groups').
  function modes(net, k, iters = 100, seed = 5) {
    const { n, off, adj, deg } = net, r = rng(seed), isd = new Float64Array(n);
    for (let i = 0; i < n; i++) isd[i] = deg[i] ? 1 / Math.sqrt(deg[i]) : 0;
    let Q = new Float64Array(n * k).map(() => r() - 0.5);
    let W = new Float64Array(n * k);
    const orth = M => {   // modified Gram-Schmidt on the columns
      for (let c = 0; c < k; c++) {
        const v = M.subarray(c * n, c * n + n);
        for (let p = 0; p < c; p++) { const u = M.subarray(p * n, p * n + n); let d = 0; for (let i = 0; i < n; i++) d += u[i] * v[i]; for (let i = 0; i < n; i++) v[i] -= d * u[i]; }
        let s = 0; for (let i = 0; i < n; i++) s += v[i] * v[i];
        s = Math.sqrt(s) || 1; for (let i = 0; i < n; i++) v[i] /= s;
      }
    };
    orth(Q);
    for (let it = 0; it < iters; it++) {
      for (let c = 0; c < k; c++) {
        const v = Q.subarray(c * n, c * n + n), w = W.subarray(c * n, c * n + n);
        for (let i = 0; i < n; i++) {
          let s = 0;
          for (let e = off[i]; e < off[i + 1]; e++) s += isd[adj[e]] * v[adj[e]];
          w[i] = 0.5 * (v[i] + isd[i] * s);
        }
      }
      orth(W); [Q, W] = [W, Q];
    }
    return Q;
  }
  // k-means on the rows of X (n x d, row-major), farthest-point start from the longest row, then balanced cells
  // (cap genes each: the gene with the most to lose takes its nearest cell with room first), then Lloyd steps with the cap
  function kmeansBalanced(X, n, d, k, cap) {
    const C = new Float64Array(k * d), lab = new Int32Array(n).fill(-1);
    const dist = (i, c) => { let s = 0; for (let j = 0; j < d; j++) { const t = X[i * d + j] - C[c * d + j]; s += t * t; } return s; };
    let first = 0, best = -1;
    for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < d; j++) s += X[i * d + j] ** 2; if (s > best) { best = s; first = i; } }
    for (let j = 0; j < d; j++) C[j] = X[first * d + j];
    const md = new Float64Array(n).fill(Infinity);
    for (let c = 1; c < k; c++) {
      let far = 0, fd = -1;
      for (let i = 0; i < n; i++) { md[i] = Math.min(md[i], dist(i, c - 1)); if (md[i] > fd) { fd = md[i]; far = i; } }
      for (let j = 0; j < d; j++) C[c * d + j] = X[far * d + j];
    }
    const centroids = () => {
      C.fill(0); const cnt = new Int32Array(k);
      for (let i = 0; i < n; i++) { cnt[lab[i]]++; for (let j = 0; j < d; j++) C[lab[i] * d + j] += X[i * d + j]; }
      for (let c = 0; c < k; c++) for (let j = 0; j < d; j++) C[c * d + j] /= cnt[c] || 1;
    };
    // plain Lloyd steps first, so the centers find the groups
    for (let it = 0; it < 30; it++) {
      let moved = false;
      for (let i = 0; i < n; i++) { let bc = 0, bd = Infinity; for (let c = 0; c < k; c++) { const t = dist(i, c); if (t < bd) { bd = t; bc = c; } } if (lab[i] !== bc) { lab[i] = bc; moved = true; } }
      centroids();
      if (!moved) break;
    }
    // then the balanced assignment, twice
    const D = new Float64Array(n * k);
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) D[i * k + c] = dist(i, c);
      const room = new Int32Array(k).fill(cap), done = new Uint8Array(n);
      lab.fill(-1);
      for (let left = n; left > 0; left--) {
        let gi = -1, gc = -1, gr = -Infinity;
        for (let i = 0; i < n; i++) {
          if (done[i]) continue;
          let b1 = Infinity, b2 = Infinity, bc = -1;
          for (let c = 0; c < k; c++) { if (!room[c]) continue; const t = D[i * k + c]; if (t < b1) { b2 = b1; b1 = t; bc = c; } else if (t < b2) b2 = t; }
          const reg = (b2 === Infinity ? 0 : b2 - b1);
          if (reg > gr || (reg === gr && i < gi)) { gr = reg; gi = i; gc = bc; }
        }
        lab[gi] = gc; done[gi] = 1; room[gc]--;
      }
      centroids();
    }
    return lab;
  }
  // links between groups: W[a][b] (a != b counted once per link each way, a == b twice per link inside)
  function groupLinks(net, lab, k) {
    const W = new Float64Array(k * k);
    for (let e = 0; e < net.m; e++) { const a = lab[net.edges[2 * e]], b = lab[net.edges[2 * e + 1]]; W[a * k + b]++; W[b * k + a]++; }
    return W;
  }
  // The cut: spectral clustering into 2^L equal cells, then the codes. Every way of giving the 8 cells the codes 000 to
  // 111 is tried (with the first group at 000: flipping a bit of every code changes nothing that counts, so 7! = 5,040
  // ways are enough); the one kept puts the most links on one-bit hops (cube edges), then the fewest across
  // the first bisection, then the second (ties: the first found). Returns the codes (Uint8Array, L bits a gene; L up to 3).
  // This is a stand-in for the authors' beam search: like theirs, its result is an ordered list of global bisections.
  function cut(net, L = 3) {
    const k = 1 << L, n = net.n;
    const Q = modes(net, k);
    // drop the trivial mode (its direction is sqrt(degree)), keep the rest, rows normalized
    const v0 = new Float64Array(n); let s0 = 0;
    for (let i = 0; i < n; i++) { v0[i] = Math.sqrt(net.deg[i]); s0 += net.deg[i]; }
    for (let i = 0; i < n; i++) v0[i] /= Math.sqrt(s0) || 1;
    for (let c = 0; c < k; c++) { const v = Q.subarray(c * n, c * n + n); let d = 0; for (let i = 0; i < n; i++) d += v0[i] * v[i]; for (let i = 0; i < n; i++) v[i] -= d * v0[i]; }
    const X = new Float64Array(n * k);
    for (let i = 0; i < n; i++) {
      let s = 0; for (let c = 0; c < k; c++) s += Q[c * n + i] ** 2;
      s = Math.sqrt(s) || 1; for (let c = 0; c < k; c++) X[i * k + c] = Q[c * n + i] / s;
    }
    const lab = kmeansBalanced(X, n, k, k, Math.ceil(n / k));
    const W = groupLinks(net, lab, k);
    // the labelling: cur[g] = the code of group g
    let best = null, bs = null;
    const used = new Uint8Array(k), cur = new Int32Array(k);
    const score = () => {
      let one = 0; const across = new Float64Array(L);
      for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) {
        const w = W[a * k + b], x = cur[a] ^ cur[b];
        if (pop(x) === 1) one += w;
        for (let q = 0; q < L; q++) if (x >> q & 1) across[q] += w;
      }
      // (most on cube edges; then the fewest across the top bit, then the next)
      const s = [one]; for (let q = L - 1; q >= 0; q--) s.push(-across[q]);
      return s;
    };
    const better = (s, t) => { for (let i = 0; i < s.length; i++) { if (s[i] > t[i] + 1e-9) return true; if (s[i] < t[i] - 1e-9) return false; } return false; };
    used[0] = 1; cur[0] = 0;
    (function rec(g) {
      if (g === k) { const s = score(); if (!bs || better(s, bs)) { bs = s; best = Int32Array.from(cur); } return; }
      for (let c = 0; c < k; c++) if (!used[c]) { used[c] = 1; cur[g] = c; rec(g + 1); used[c] = 0; }
    })(1);
    const code = new Uint8Array(n);
    for (let i = 0; i < n; i++) code[i] = best[lab[i]];
    return code;
  }
  // random halvings: each bisection puts a random half of the genes on side 1 (the cells' sizes vary, as in the real
  // run's random baseline)
  function randomCut(net, L = 3, seed = 21) {
    const r = rng(seed), n = net.n, code = new Uint8Array(n);
    for (let q = L - 1; q >= 0; q--) {
      const ids = shuffle([...Array(n).keys()], r);
      for (let j = 0; j < n >> 1; j++) code[ids[j]] |= 1 << q;
    }
    return code;
  }
  // the codes at fewer bits: the first bisections only (cells nest as prefixes)
  const prefix = (code, Lfrom, Lto) => code.map(c => c >> (Lfrom - Lto));
  // how well a cut found the planted groups: the share of genes in their cell's most common group
  function purity(net, code, L) {
    if (!net.group) return null;
    const k = 1 << L, G = 1 << 3, cnt = new Int32Array(k * G);
    for (let i = 0; i < net.n; i++) cnt[code[i] * G + net.group[i]]++;
    let s = 0;
    for (let c = 0; c < k; c++) { let m = 0; for (let g = 0; g < G; g++) m = Math.max(m, cnt[c * G + g]); s += m; }
    return s / net.n;
  }
  const sizes = (code, L) => { const s = new Array(1 << L).fill(0); for (const c of code) s[c]++; return s; };

  // ------------------------------------------------------------------ the coarse operator
  // A_c = P A P^T with P[c][i] = 1/sqrt(|c|) for the genes of cell c: A_c[c][d] = links(c, d) / sqrt(|c| |d|), the
  // diagonal counting each link inside a cell twice (A is symmetric). N x N, row-major.
  function coarse(net, code, L) {
    const N = 1 << L, A = new Float64Array(N * N), sz = sizes(code, L);
    for (let e = 0; e < net.m; e++) { const a = code[net.edges[2 * e]], b = code[net.edges[2 * e + 1]]; A[a * N + b]++; A[b * N + a]++; }
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) A[a * N + b] = sz[a] && sz[b] ? A[a * N + b] / Math.sqrt(sz[a] * sz[b]) : 0;
    return A;
  }
  // symmetric Sinkhorn balancing: diag(x) A diag(x) with every row (and column) summing to 1, x_i (A x)_i = 1
  // (empty cells stay zero)
  function sinkhorn(A, N, tol = 1e-13, max = 2000) {
    const x = new Float64Array(N), Ax = new Float64Array(N), live = [];
    for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += A[i * N + j]; if (s > 0) { live.push(i); x[i] = 1 / Math.sqrt(s); } }
    for (let it = 0; it < max; it++) {
      let err = 0;
      for (const i of live) { let s = 0; for (const j of live) s += A[i * N + j] * x[j]; Ax[i] = s; err = Math.max(err, Math.abs(x[i] * s - 1)); }
      if (err < tol) break;
      for (const i of live) x[i] = Math.sqrt(x[i] / Ax[i]);
    }
    const B = new Float64Array(N * N);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) B[i * N + j] = x[i] * A[i * N + j] * x[j];
    return B;
  }
  // the share of the coupling between cells that runs along cube edges (cells one bit apart)
  function cubeShare(B, N) {
    let one = 0, all = 0;
    for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) { all += B[a * N + b]; if (pop(a ^ b) === 1) one += B[a * N + b]; }
    return all ? one / all : 0;
  }

  // ------------------------------------------------------------------ Pauli strings
  const IM = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // i^m
  // in-place Walsh-Hadamard transform: f[z] <- sum_j (-1)^|z & j| f[j]
  function wht(f) {
    for (let h = 1; h < f.length; h <<= 1) for (let i = 0; i < f.length; i += h << 1) for (let j = i; j < i + h; j++) {
      const a = f[j], b = f[j + h]; f[j] = a + b; f[j + h] = a - b;
    }
    return f;
  }
  // The weights c_k = tr(sigma_k M) / N of a real N x N matrix (N = 2^L) on all 4^L strings, O(4^L L): for each X part
  // x, f[j] = M[j][j ^ x], and tr(X^x Z^z M) = sum_j (-1)^|z & j| f[j] is f's Walsh-Hadamard transform at z.
  // Returns { re, im } (Float64Array(4^L)); im is zero for a symmetric M.
  function pauli(M, L) {
    const N = 1 << L, re = new Float64Array(N * N), im = new Float64Array(N * N), f = new Float64Array(N);
    for (let x = 0; x < N; x++) {
      for (let j = 0; j < N; j++) f[j] = M[j * N + (j ^ x)];
      wht(f);
      for (let z = 0; z < N; z++) {
        const ph = IM[pop(x & z) & 3];
        re[(x << L) | z] = ph[0] * f[z] / N; im[(x << L) | z] = ph[1] * f[z] / N;
      }
    }
    return { re, im };
  }
  // The matrix sum_k c_k sigma_k (c: { re, im } or a plain array of real weights; only the strings in 'only', if given).
  // Returns { re, im } (Float64Array(N * N), row-major).
  function fromPauli(c, L, only) {
    const N = 1 << L, re = new Float64Array(N * N), im = new Float64Array(N * N);
    const cr = c.re || c, ci = c.im || null;
    const add = k => {
      const x = k >> L, z = k & (N - 1), a = cr[k], b = ci ? ci[k] : 0;
      if (!a && !b) return;
      const ph = IM[pop(x & z) & 3];
      for (let col = 0; col < N; col++) {
        const s = pop(z & col) & 1 ? -1 : 1, pr = ph[0] * s, pi = ph[1] * s, row = col ^ x;
        re[row * N + col] += a * pr - b * pi; im[row * N + col] += a * pi + b * pr;
      }
    };
    if (only) for (const k of only) add(k); else for (let k = 0; k < N * N; k++) add(k);
    return { re, im };
  }
  // one entry of a string: (sigma_k)[row][col], as [re, im] (0 unless col = row ^ x)
  function entry(k, L, row, col) {
    const N = 1 << L, x = k >> L, z = k & (N - 1);
    if ((row ^ col) !== x) return [0, 0];
    const ph = IM[pop(x & z) & 3], s = pop(z & col) & 1 ? -1 : 1;
    return [ph[0] * s, ph[1] * s];
  }
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  // a string's name, top qubit first: 'X2X1' (opts.sub: 'X₂X₁'); the identity is 'I'
  function name(k, L, opts = {}) {
    const N = 1 << L, x = k >> L, z = k & (N - 1);
    let s = '';
    for (let q = L - 1; q >= 0; q--) {
      const a = x >> q & 1, b = z >> q & 1;
      if (!a && !b) continue;
      s += (a && b ? 'Y' : a ? 'X' : 'Z') + (opts.sub ? SUB[q] : q);
    }
    return s || 'I';
  }
  // the inverse of name(): 'X2X1' or 'Z₀' -> k
  function parse(s, L) {
    if (s === 'I') return 0;
    let x = 0, z = 0;
    const t = String(s).replace(/[₀-₉]/g, c => String(SUB.indexOf(c)));
    for (const m of t.matchAll(/([XYZ])(\d+)/g)) { const q = +m[2]; if (m[1] !== 'Z') x |= 1 << q; if (m[1] !== 'X') z |= 1 << q; }
    return (x << L) | z;
  }
  // which qubits a string acts on, and how: [{ q, p: 'X' | 'Y' | 'Z' }] top qubit first
  const parts = (k, L) => { const N = 1 << L, x = k >> L, z = k & (N - 1), out = []; for (let q = L - 1; q >= 0; q--) { const a = x >> q & 1, b = z >> q & 1; if (a || b) out.push({ q, p: a && b ? 'Y' : a ? 'X' : 'Z' }); } return out; };
  // a string's kind for drawing: 'loops' (diagonal: I and Z strings, self-loops of sign +1 or -1), 'hops' (it moves
  // the walker across x: cube edges for one bit, face diagonals for two, body diagonals for three)
  const kind = (k, L) => (k >> L ? 'hops' : 'loops');
  const ys = (k, L) => pop((k >> L) & k & ((1 << L) - 1));
  // two strings anticommute when their symplectic product is odd; their product is the string k1 ^ k2 (up to a phase)
  const anti = (a, b, L) => { const N = 1 << L, xa = a >> L, za = a & (N - 1), xb = b >> L, zb = b & (N - 1); return (pop(xa & zb) + pop(za & xb)) & 1; };

  // ------------------------------------------------------------------ the algebras
  // the closure of a set of strings under commutators: [P, Q] = 2 P Q when they anticommute (a string, up to a
  // phase), 0 when they commute. Returns the strings, sorted.
  function closure(gens, L) {
    const list = [...new Set(gens)], seen = new Set(list);
    for (let i = 0; i < list.length; i++) for (let j = 0; j < i; j++) {
      if (!anti(list[i], list[j], L)) continue;
      const p = list[i] ^ list[j];
      if (!seen.has(p)) { seen.add(p); list.push(p); }
    }
    return list.sort((a, b) => a - b);
  }
  // the generators: 'tfim' = X_q on every qubit and Z_q Z_(q+1) on neighbors (the TFIM chain, so(2L));
  // 'odd' = the same plus Z on the top qubit q(L-1) (so(2L+1)); in the circuit's order: X0 .. X(L-1), then
  // Z(L-1)Z(L-2) .. Z1Z0, then the boundary Z
  function generators(kindName, L) {
    const N = 1 << L, g = [];
    for (let q = 0; q < L; q++) g.push((1 << q) << L);
    for (let q = L - 2; q >= 0; q--) g.push((1 << q) | (1 << (q + 1)));
    if (kindName === 'odd') g.push(1 << (L - 1));
    return g.filter(k => k > 0 && k < N * N);
  }
  const ALG = { tfim: { label: L => `so(${2 * L})`, name: 'TFIM chain' }, odd: { label: L => `so(${2 * L + 1})`, name: 'TFIM chain with a boundary Z' } };
  const algCache = {};
  function algebra(kindName, L) {
    const id = kindName + L;
    if (algCache[id]) return algCache[id];
    const gens = generators(kindName, L), basis = closure(gens, L);
    return (algCache[id] = { kind: kindName, L, gens, basis, set: new Set(basis), dim: basis.length, label: ALG[kindName].label(L), name: ALG[kindName].name });
  }
  // the fit of weights c (from pauli()) to an algebra: the traceless part's squared norm T (sum over k != 0 of |c_k|^2),
  // the share inside the algebra's span, the share on its generators, and the residual sqrt(1 - inside), which is
  // ||A0 - Pi A0||_F / ||A0||_F (every string has the same norm, so the projection keeps the weights inside)
  function fit(c, L, alg) {
    const M = 1 << (2 * L), sq = k => c.re[k] * c.re[k] + (c.im ? c.im[k] * c.im[k] : 0);
    let T = 0, I = 0, G = 0;
    for (let k = 1; k < M; k++) T += sq(k);
    for (const k of alg.basis) if (k) I += sq(k);
    for (const k of alg.gens) G += sq(k);
    return { total: T, inside: T ? I / T : 1, gens: T ? G / T : 1, residual: T ? Math.sqrt(Math.max(0, 1 - I / T)) : 0 };
  }
  // the strings by weight, largest first (ties by index); zero weights left out
  function order(c, eps = 1e-12) {
    const M = c.re.length, ids = [];
    for (let k = 0; k < M; k++) if (Math.hypot(c.re[k], c.im ? c.im[k] : 0) > eps) ids.push(k);
    return ids.sort((a, b) => Math.hypot(c.re[b], c.im ? c.im[b] : 0) - Math.hypot(c.re[a], c.im ? c.im[a] : 0) || a - b);
  }
  // the matrix rebuilt from the first k strings of an order, and the error left: ||M - M_k||_F / ||M||_F
  const rebuild = (c, L, ord, k) => fromPauli(c, L, ord.slice(0, k));
  function errors(c, ord) {
    const sq = k => c.re[k] * c.re[k] + (c.im ? c.im[k] * c.im[k] : 0);
    let tot = 0; for (const k of ord) tot += sq(k);
    const out = [1]; let left = tot;
    for (const k of ord) { left -= sq(k); out.push(tot ? Math.sqrt(Math.max(0, left) / tot) : 0); }
    return out;   // out[j] = the error with the first j strings
  }
  // One Trotter step of e^(-iKt), K = I - A_c, on the generators: a gate R_P(theta) = exp(-i theta P / 2) per generator,
  // theta = -2 c_P t (with c_P = tr(P A_c) / 2^L); on the generator part it equals e^(+i A_c t) up to a global phase.
  function trotter(c, L, alg, t = 1) {
    return alg.gens.map(k => {
      const p = parts(k, L), type = p.length === 2 ? 'RZZ' : 'R' + p[0].p;
      return { k, name: name(k, L), type, qubits: p.map(o => o.q), c: c.re[k], theta: -2 * c.re[k] * t };
    });
  }

  // ------------------------------------------------------------------ a whole analysis
  // a network's cut (found or random, 3 bits, cached), its first L bits, A_c balanced, the weights and the fits
  const cuts = {};
  function cut3(netKey, how) {
    const id = netKey + ':' + how;
    if (!cuts[id]) { const net = network(netKey); cuts[id] = how === 'random' ? randomCut(net, 3) : cut(net, 3); }
    return cuts[id];
  }
  const anCache = {};
  function analyze(netKey, o = {}) {
    const L = o.L || 3, how = o.cut || 'found', id = `${netKey}:${how}:${L}`;
    if (anCache[id]) return anCache[id];
    const net = network(netKey), code = prefix(cut3(netKey, how), 3, L), N = 1 << L;
    const raw = coarse(net, code, L), Ac = sinkhorn(raw, N), c = pauli(Ac, L), ord = order(c);
    const algs = { tfim: algebra('tfim', L), odd: algebra('odd', L) };
    const fits = { tfim: fit(c, L, algs.tfim), odd: fit(c, L, algs.odd) };
    let cutLinks = 0;
    for (let e = 0; e < net.m; e++) if (code[net.edges[2 * e]] !== code[net.edges[2 * e + 1]]) cutLinks++;
    return (anCache[id] = {
      net: netKey, cut: how, L, N, code, sizes: sizes(code, L), purity: purity(net, code, L), raw, Ac, c, order: ord,
      errors: errors(c, ord), fits, cubeShare: cubeShare(Ac, N), cutShare: net.m ? cutLinks / net.m : 0,
      trotter: { tfim: trotter(c, L, algs.tfim), odd: trotter(c, L, algs.odd) },
    });
  }

  // ------------------------------------------------------------------ a layout for drawing
  // force-directed (Fruchterman-Reingold), seeded and deterministic: dim 2 or 3, positions in about [-1, 1]; 'init' (a
  // function gene -> [x, y, z]) seeds it. Returns a Float32Array(n * 3) (z = 0 in 2D).
  function layout(net, o = {}) {
    const n = net.n, dim = o.dim || 3, r = rng(o.seed || 3), P = new Float64Array(n * 3), F = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) {
      const p = o.init ? o.init(i) : [r() * 2 - 1, r() * 2 - 1, dim === 3 ? r() * 2 - 1 : 0];
      for (let d = 0; d < 3; d++) P[3 * i + d] = d < dim ? p[d] + (r() - 0.5) * 0.02 : 0;
    }
    const iters = o.iters || 60, kk = (o.k || 1) * Math.pow((dim === 3 ? 8 : 4) / n, 1 / dim), grav = o.gravity || 0.1;
    let temp = o.temp || 0.2;
    for (let it = 0; it < iters; it++) {
      F.fill(0);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = P[3 * i] - P[3 * j], dy = P[3 * i + 1] - P[3 * j + 1], dz = P[3 * i + 2] - P[3 * j + 2];
        const d2 = dx * dx + dy * dy + dz * dz + 1e-6, f = kk * kk / d2;
        F[3 * i] += dx * f; F[3 * i + 1] += dy * f; F[3 * i + 2] += dz * f;
        F[3 * j] -= dx * f; F[3 * j + 1] -= dy * f; F[3 * j + 2] -= dz * f;
      }
      for (let e = 0; e < net.m; e++) {
        const i = net.edges[2 * e], j = net.edges[2 * e + 1];
        const dx = P[3 * i] - P[3 * j], dy = P[3 * i + 1] - P[3 * j + 1], dz = P[3 * i + 2] - P[3 * j + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-9, f = d / kk;
        F[3 * i] -= dx * f; F[3 * i + 1] -= dy * f; F[3 * i + 2] -= dz * f;
        F[3 * j] += dx * f; F[3 * j + 1] += dy * f; F[3 * j + 2] += dz * f;
      }
      for (let i = 0; i < n; i++) {
        for (let d = 0; d < dim; d++) F[3 * i + d] -= grav * P[3 * i + d] * n * kk;
        const l = Math.hypot(F[3 * i], F[3 * i + 1], F[3 * i + 2]) || 1, s = Math.min(l, temp) / l;
        for (let d = 0; d < dim; d++) P[3 * i + d] += F[3 * i + d] * s;
      }
      temp *= 0.95;
    }
    // centered and scaled to radius 1 (the 98th percentile)
    const cen = [0, 0, 0];
    for (let i = 0; i < n; i++) for (let d = 0; d < 3; d++) cen[d] += P[3 * i + d] / n;
    const rr = [];
    for (let i = 0; i < n; i++) { for (let d = 0; d < 3; d++) P[3 * i + d] -= cen[d]; rr.push(Math.hypot(P[3 * i], P[3 * i + 1], P[3 * i + 2])); }
    rr.sort((a, b) => a - b);
    const s = 1 / (rr[Math.floor(n * 0.98)] || 1);
    return Float32Array.from(P, v => v * s);
  }

  // ------------------------------------------------------------------ small facts for the text
  // the number of unordered pairs of n genes
  const pairs = n => n * (n - 1) / 2;
  // the dimension of so(m): m (m - 1) / 2; at L bits so(2L) has L(2L - 1), so(2L + 1) has L(2L + 1)
  const soDim = m => m * (m - 1) / 2;
  // the colors of the 8 cells (by code), the same in every set and pane
  const CELL_COLORS = ['#46d9ff', '#3ee08f', '#ffd166', '#ff8fd8', '#b9a6ff', '#7df0c8', '#ff9e6b', '#8fb8ff'];

  return {
    rng, pop, NETS, DEFAULT, network, planted, random, modes, cut, randomCut, prefix, purity, sizes, cut3,
    coarse, sinkhorn, cubeShare, wht, pauli, fromPauli, entry, name, parse, parts, kind, ys, anti,
    closure, generators, algebra, fit, order, rebuild, errors, trotter, analyze, layout, pairs, soDim, CELL_COLORS,
  };
})();
if (typeof module !== 'undefined') module.exports = QMATH;
