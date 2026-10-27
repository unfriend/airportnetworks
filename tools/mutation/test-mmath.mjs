// Checks the mutation story's maths (sets/mmath.js) against the poster's numbers (sets/data.js) and prints what the
// example gives (the numbers the story text and the sets use).
// usage (from the repository root): node tools/mutation/test-mmath.mjs     (exits 1 on a failed check; under a second)
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const here = path.dirname(new URL(import.meta.url).pathname);
const M = require('./sets/mmath.js');
const t0 = Date.now();
let bad = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) bad++; };
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const f3 = v => v.toFixed(3), pc = v => (100 * v).toFixed(1) + ' %';
const MODELS = M.MODELS.map(m => m.key), TS = [0, 0.01, 0.15, 0.45, 1, 1.6, 3];

// 0. Without the poster's data (Node), and pasted before it as the build does (MUT_DATA not yet initialised)
{
  const T = M.familyTree(1);
  ok(T.nodes[T.root].seq === 'ACGTTAGC' && M.data().fig1.ancestor === 'ACGTTAGC', 'works without MUT_DATA (its own copy)');
  const msrc = fs.readFileSync(path.join(here, 'sets/mmath.js'), 'utf8').replace("if (typeof module !== 'undefined') module.exports = MMATH;\n", '');
  const dsrc = fs.readFileSync(path.join(here, 'sets/data.js'), 'utf8');
  const [seq, same] = new Function(`${msrc}\n${dsrc}\nreturn [MMATH.familyTree(1).nodes[0].seq, MMATH.data() === MUT_DATA];`)();
  ok(seq === 'ACGTTAGC' && same, 'pasted before MUT_DATA, as in the story: loads, then reads MUT_DATA when called');
  globalThis.MUT_DATA = new Function(`${dsrc}\nreturn MUT_DATA;`)();
}
const D = globalThis.MUT_DATA;
ok(M.data() === D, 'reads MUT_DATA once it is loaded');
{
  const c = { species: Object.fromEntries(Object.entries(D.test.species).map(([k, v]) => [k, { top: v.top, bottom: v.bottom }])) };
  const copy = new Function(fs.readFileSync(path.join(here, 'sets/mmath.js'), 'utf8').match(/const COPY = (\{[\s\S]*?\n  \});/)[1].replace(/^/, 'return '))();
  ok(JSON.stringify(copy.test.species) === JSON.stringify(c.species) && copy.fig1.ancestor === D.fig1.ancestor &&
    copy.test.n === D.test.n && copy.test.w === D.test.w && copy.test.pairs === D.test.pairs, 'its copy for Node agrees with MUT_DATA');
}

// 1. The rule: P(t) is a proper transition matrix, a semigroup, keeps pi, mean rate 1
for (const mk of MODELS) {
  const Q = M.Q(mk), pi = M.pi(mk);
  let rate = 0, rows0 = 0;
  for (let i = 0; i < 4; i++) { rate -= pi[i] * Q[i * 5]; let s = 0; for (let j = 0; j < 4; j++) s += Q[i * 4 + j]; rows0 = Math.max(rows0, Math.abs(s)); }
  ok(close(rate, 1, 1e-12) && rows0 < 1e-12, `${mk}: Q's rows sum to 0, mean rate ${f3(rate)}`);
  let rs = 0, neg = 0, id = 0, semi = 0, keep = 0, rev = 0;
  for (const t of TS) {
    const P = M.P(mk, t);
    for (let i = 0; i < 4; i++) {
      let s = 0;
      for (let j = 0; j < 4; j++) {
        s += P[i * 4 + j]; neg = Math.min(neg, P[i * 4 + j]);
        rev = Math.max(rev, Math.abs(pi[i] * P[i * 4 + j] - pi[j] * P[j * 4 + i]));
      }
      rs = Math.max(rs, Math.abs(s - 1));
      let piP = 0; for (let k = 0; k < 4; k++) piP += pi[k] * P[k * 4 + i];
      keep = Math.max(keep, Math.abs(piP - pi[i]));
    }
    if (t === 0) for (let k = 0; k < 16; k++) id = Math.max(id, Math.abs(P[k] - (k % 5 === 0 ? 1 : 0)));
    for (const s of [0.07, 0.6]) {
      const A = M.P(mk, s), B = M.P(mk, t), C = M.P(mk, s + t);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        let v = 0; for (let k = 0; k < 4; k++) v += A[i * 4 + k] * B[k * 4 + j];
        semi = Math.max(semi, Math.abs(v - C[i * 4 + j]));
      }
    }
  }
  ok(rs < 1e-12 && neg >= 0 && id === 0, `${mk}: P(t) rows sum to 1, no entry below 0, P(0) = I exactly`);
  ok(semi < 1e-12 && keep < 1e-12 && rev < 1e-12, `${mk}: P(s) P(t) = P(s + t), pi P = pi, reversible (max error ${semi.toExponential(1)})`);
  // against a Taylor series of e^(Qt) at a small t
  const t = 0.05, E = new Float64Array(16), T = new Float64Array(16);
  for (let k = 0; k < 16; k++) E[k] = T[k] = k % 5 === 0 ? 1 : 0;
  for (let n = 1; n < 30; n++) {
    const U = new Float64Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let v = 0; for (let k = 0; k < 4; k++) v += T[i * 4 + k] * Q[k * 4 + j] * t / n; U[i * 4 + j] = v; }
    T.set(U); for (let k = 0; k < 16; k++) E[k] += U[k];
  }
  const P = M.P(mk, t);
  ok(E.every((v, k) => close(v, P[k], 1e-12)), `${mk}: P(0.05) matches the series of e^(Qt)`);
}
ok(close(M.Q('transitions')[2] / M.Q('transitions')[1], 4, 1e-12), 'transitions: A->G four times A->C');

// 2. The path and the pyramid
{
  const mk = M.DEFAULT, pi = M.pi(mk), c = M.CORNERS, P0 = M.simplex(pi), d = x => Math.hypot(x[0] - P0[0], x[1] - P0[1], x[2] - P0[2]);
  let edges = true;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (!close(Math.hypot(c[i][0] - c[j][0], c[i][1] - c[j][1], c[i][2] - c[j][2]), 1.6, 1e-12)) edges = false;
  const cen = [0, 1, 2].map(k => (c[0][k] + c[1][k] + c[2][k] + c[3][k]) / 4);
  ok(edges && cen.every(v => close(v, 0, 1e-12)), 'the pyramid: a regular tetrahedron of edge 1.6 centred on the origin');
  ok(c[0][1] > 0 && c[1][0] < 0 && c[1][2] > 0 && c[2][2] < 0 && c[3][0] > 0 && c[3][2] > 0, 'A at the top, C front left, G at the back, T front right');
  const out = new Float64Array(4), p3 = [0, 0, 0];
  M.path(mk, 0, 0, out);
  ok(out[0] === 1 && out[1] === 0 && M.simplex(out, p3).every((v, k) => close(v, c[0][k], 1e-12)), 'the path starts at corner A');
  let mono = true, prev = Infinity;
  for (let t = 0; t <= M.T_PATH + 1e-9; t += 0.02) { const x = d(M.simplex(M.path(mk, 0, t, out), p3)); if (x > prev + 1e-12) mono = false; prev = x; }
  const left = d(M.simplex(M.path(mk, 0, M.T_PATH, out), p3)) / d(c[0]);
  ok(mono && left < 0.25, `it heads for the long-run mix all the way and ends near it (${pc(1 - left)} of the way at T_PATH ${M.T_PATH})`);
  for (const t of [...M.POINTS, M.T_PATH]) {
    M.path(mk, 0, t, out);
    console.log(`     mix from A at t = ${t}: ${[...'ACGT'].map((L, i) => L + ' ' + f3(out[i])).join(', ')} (${pc(1 - d(M.simplex(out, p3)) / d(c[0]))} of the way)`);
  }
  console.log(`     long-run mix: ${[...'ACGT'].map((L, i) => L + ' ' + f3(pi[i])).join(', ')}`);
}

// 3. Qubits: a pure letter's two arrows are its code, length 1; a mix that ties the qubits shortens them
{
  const b = new Float64Array(6);
  let good = true;
  for (let i = 0; i < 4; i++) {
    const p = [0, 0, 0, 0]; p[i] = 1; M.bloch(p, b);
    const [q1, q0] = M.bits(i);
    if (b[2] !== (q1 ? -1 : 1) || b[5] !== (q0 ? -1 : 1) || Math.hypot(b[0], b[1], b[2]) !== 1 || Math.hypot(b[3], b[4], b[5]) !== 1) good = false;
    if (M.CODES[i] !== D.fig1.codes['ACGT'[i]] || M.KETS[i] !== `|${D.fig1.codes['ACGT'[i]]}⟩`) good = false;
  }
  ok(good, 'bloch: A up up, C up down, G down up, T down down (0 up, 1 down), length 1; codes as the poster\'s');
  M.bloch([0.5, 0, 0, 0.5], b);
  ok(Math.hypot(b[0], b[1], b[2]) < 1e-12 && Math.hypot(b[3], b[4], b[5]) < 1e-12, 'half A, half T: the two qubits fully depend on each other (no arrows)');
  M.bloch([0.25, 0.25, 0.25, 0.25], b);
  ok(close(b[0], 1, 1e-12) && close(b[3], 1, 1e-12), 'the even mix: both arrows level, length 1 (independent)');
  const p = M.path(M.DEFAULT, 0, M.POINTS[1]);
  M.bloch(p, b);
  console.log(`     the mix at point 2 from A: first qubit (x ${f3(b[0])}, z ${f3(b[2])}, length ${f3(Math.hypot(b[0], b[2]))}), second (x ${f3(b[3])}, z ${f3(b[5])}, length ${f3(Math.hypot(b[3], b[5]))})`);
  // read-outs: seeded by index, frequencies follow the chances
  const n = 20000, cnt = [0, 0, 0, 0];
  for (let k = 0; k < n; k++) cnt[M.sample(p, 5, k)]++;
  ok(M.sample(p, 5, 123) === M.sample(p, 5, 123) && cnt.every((c, i) => Math.abs(c / n - p[i]) < 0.01), `sample: by index, ${n} read-outs follow the chances (${cnt.map(c => (c / n).toFixed(3)).join(' ')})`);
}

// 4. The circuit for one branch: its run (and its decomposition's) gives row `parent` of P(t)
{
  let worst = 0, worstS = 0;
  for (const mk of MODELS) for (const t of TS) {
    const P = M.P(mk, t);
    for (let i = 0; i < 4; i++) {
      const a = M.simulate(mk, t, i), s = M.simulate(mk, t, i, true);
      for (let j = 0; j < 4; j++) { worst = Math.max(worst, Math.abs(a[j] - P[i * 4 + j])); worstS = Math.max(worstS, Math.abs(s[j] - P[i * 4 + j])); }
    }
  }
  ok(worst < 1e-12, `the circuit gives row parent of P(t) for every parent, model and t (max error ${worst.toExponential(1)})`);
  ok(worstS < 1e-12, `so does its decomposition into RY turns and CNOTs (max error ${worstS.toExponential(1)})`);
  // the child's amplitudes are sqrt(P) and non-negative (not only the chances)
  {
    const t = 0.45, P = M.P(M.DEFAULT, t);
    let g = true;
    for (let i = 0; i < 4; i++) {
      const st = new Float64Array(16); st[i << 2] = 1; M.run(M.circuit(M.DEFAULT, t).gates, st);
      for (let j = 0; j < 4; j++) if (!close(st[(i << 2) | j], Math.sqrt(P[i * 4 + j]), 1e-12)) g = false;
    }
    ok(g, 'the parent stays as it was and the child ends in sum_j sqrt(P_ij) |j> (non-negative amplitudes)');
  }
  const c0 = M.circuit(M.DEFAULT, 0);
  ok(c0.gates.length === 4 && c0.gates.slice(2).every(g => g.thetas.every(v => v === 0)), 'all angles 0 at t = 0');
  const c = M.circuit(M.DEFAULT, 0.45), simple = c.gates.flatMap(M.decompose);
  ok(c.wires.join() === 'p1,p0,c1,c0' && c.gates.map(g => `${g.type} ${g.ctrl || g.ctrls.join('+')}>${g.tgt}`).join(' | ') === 'CNOT p1>c1 | CNOT p0>c0 | MRY p1+p0>c1 | MRY p1+p0+c1>c0', 'the gates: copy (two CNOTs), then the turn (two controlled RY)');
  const count = ty => simple.filter(g => g.type === ty).length;
  ok(M.decompose(c.gates[2]).length === 8 && M.decompose(c.gates[3]).length === 16 && count('RY') === 12 && count('CNOT') === 14, 'decomposed: 4 + 8 RY turns and 4 + 8 linking CNOTs after the copy\'s 2');
  ok(c.gates.flatMap(M.decompose).map(g => g.type + (g.ctrl || '') + g.tgt).join() === M.circuit('even', 1.3).gates.flatMap(M.decompose).map(g => g.type + (g.ctrl || '') + g.tgt).join(), 'the steps are the same on every branch and for every rule (only the angles change)');
  console.log(`     the circuit for parent A at t = 0.45: c1 turns ${f3(c.gates[2].thetas[0])} rad; c0 turns ${f3(c.gates[3].thetas[0])} (if c1 is 0) or ${f3(c.gates[3].thetas[1])} (if c1 is 1)`);
  console.log(`     all its angles (c1 by parent A C G T: ${c.gates[2].thetas.map(f3).join(' ')}; c0 by parent and c1: ${c.gates[3].thetas.map(f3).join(' ')})`);
  for (const mk of MODELS) {
    let mono = true, prev = -1;
    for (let t = 0; t <= 3; t += 0.01) { const a = M.turnAngle(mk, t); if (a < prev - 1e-12) mono = false; prev = a; }
    ok(M.turnAngle(mk, 0) === 0 && mono, `${mk}: turnAngle 0 at t = 0 and growing with t`);
  }
  console.log('     turnAngle (rad) of the story\'s rule: ' + [0.05, 0.1, 0.15, 0.25, 0.45, 0.6, 1, 1.6, 2].map(t => `${t}: ${f3(M.turnAngle(M.DEFAULT, t))}`).join(', '));
}

// 5. Figure 1 and Figure 5 as the poster has them
{
  const f = D.fig1;
  const apply = (s, sw) => { const a = [...s]; for (const [p, x, y] of sw) { if (a[p - 1] !== x) return null; a[p - 1] = y; } return a.join(''); };
  ok(apply(f.ancestor, f.swaps.d1) === f.d1 && apply(f.ancestor, f.swaps.d2) === f.d2, 'Figure 1: the swaps turn the ancestor into its two descendants');
  const all = [...Object.entries(D.test.species), ['truth', D.test.truth], ...Object.entries(D.test.rebuilt)];
  let good = true;
  for (const [k, s] of all) {
    const b = M.brokenPairs(s.top, s.bottom).map(i => i + 1);
    if (b.join() !== s.broken.join()) { good = false; console.log(`     ${k}: broken ${b.join()} but listed ${s.broken.join()}`); }
  }
  ok(good, 'Figure 5: the broken pairs of every stem are exactly as listed (s1 1,5; s2 1,2,3; s3 4,6; truth 6; indep 1,6; coupled none; exact 1)');
  ok(D.pairsOk.every(p => M.ok(p[0], p[1])) && M.OKS.reduce((a, b) => a + b, 0) === D.pairsOk.length, 'ok: A-T, C-G, G-T both ways, and nothing else');
  ok(M.combos(2) === D.count.pair && M.combos(3) === 64 && M.combos(10) === 1048576 && M.qubits(10) === D.count.tenQubits, 'combinations: 16 for a pair, 64 for three, 1,048,576 for ten; 20 qubits for ten');
}

// 6. The pair model
for (const mk of MODELS) for (const [w, dbl] of [[8, 0.1], [1, 0], [30, 0.3]]) {
  const pm = M.pairModel(mk, w, dbl), pi = M.pi(mk), Q = pm.Q;
  let db = 0, rs = 0, pis = 0, z = 0, ch = 0;
  for (let s = 0; s < 16; s++) z += pi[s >> 2] * pi[s & 3] * (M.OKS[s] ? w : 1);
  for (let s = 0; s < 16; s++) {
    let r = 0;
    for (let s2 = 0; s2 < 16; s2++) {
      r += Q[s * 16 + s2];
      db = Math.max(db, Math.abs(pm.pi[s] * Q[s * 16 + s2] - pm.pi[s2] * Q[s2 * 16 + s]));
      if (s2 !== s) ch += pm.pi[s] * Q[s * 16 + s2] * (((s >> 2) !== (s2 >> 2)) + ((s & 3) !== (s2 & 3))) / 2;
    }
    rs = Math.max(rs, Math.abs(r));
    pis = Math.max(pis, Math.abs(pm.pi[s] - pi[s >> 2] * pi[s & 3] * (M.OKS[s] ? w : 1) / z));
  }
  ok(db < 1e-12 && rs < 1e-12 && pis < 1e-15 && close(ch, 1, 1e-12), `${mk}, w ${w}, both at once ${dbl}: detailed balance, rows sum to 0, pi = pi_x pi_y m / Z, one letter change per letter per unit time`);
}
for (const mk of MODELS) {
  let e = 0, rs = 0;
  for (const t of TS) {
    const A = M.Ppair(mk, 1, t, 0), B = M.Pindep(mk, t), C = M.Pcoupled(mk, 8, t), E = M.Ppair(mk, 8, t);
    for (let k = 0; k < 256; k++) e = Math.max(e, Math.abs(A[k] - B[k]));
    for (let s = 0; s < 16; s++) for (const X of [C, E]) { let r = 0; for (let s2 = 0; s2 < 16; s2++) r += X[s * 16 + s2]; rs = Math.max(rs, Math.abs(r - 1)); }
  }
  ok(e < 1e-12 && rs < 1e-12, `${mk}: Ppair at w = 1 with no double changes equals Pindep (max error ${e.toExponential(1)}); pair matrices' rows sum to 1`);
}
{
  // the coupled stand-in favours matching pairs w times on every branch, however short
  const C = M.Pcoupled(M.DEFAULT, 8, 0.05), I = M.Pindep(M.DEFAULT, 0.05), s = M.pairState(0, 1);   // from A-C (broken)
  ok(close((C[s * 16 + M.pairState(0, 3)] / C[s * 16 + M.pairState(0, 2)]) / (I[s * 16 + M.pairState(0, 3)] / I[s * 16 + M.pairState(0, 2)]), 8, 1e-9),
    'the coupled stand-in: from A-C, A-T (matching) is 8 times as likely against A-G as letter by letter, on a branch of 0.05');
  const share = p => { let v = 0; for (let k = 0; k < 16; k++) if (M.OKS[k]) v += p[k]; return v; };
  const pe = M.prior('exact', M.DEFAULT), pc0 = M.prior('coupled', M.DEFAULT, 8, 0.1, 0.3), pind = M.prior('indep', M.DEFAULT);
  const St = M.Pcoupled(M.DEFAULT, 8, 0.3); let st = 0;
  for (let j = 0; j < 16; j++) { let v = 0; for (let i = 0; i < 16; i++) v += pc0[i] * St[i * 16 + j]; st = Math.max(st, Math.abs(v - pc0[j])); }
  ok(st < 1e-12, 'the coupled stand-in\'s long-run mix is where its step settles');
  console.log(`     long-run share of matching pairs: letter by letter ${pc(share(pind))}, exact ${pc(share(pe))}, coupled stand-in ${pc(share(pc0))} (at the mean branch length 0.3)`);
  console.log(`     all six pairs matching in the long run (allSixPrior, the story's rule, w = 8): ${pc(M.allSixPrior(M.DEFAULT))} (the authors: "${D.test.allSixPrior}")`);
}

// 7. Rebuilding the ancestor on the species tree from Figure 5's stems
{
  const T = M.speciesTree();
  ok(T.nodes.filter(n => n.stem).sort((a, b) => a.tip - b.tip).map(n => n.name + ':' + n.stem.top + '/' + n.stem.bottom).join() ===
    ['s1', 's2', 's3'].map(k => k + ':' + D.test.species[k].top + '/' + D.test.species[k].bottom).join(), 'the species tree\'s tips carry Figure 5\'s stems');
  const R = {};
  for (const m of M.METHODS) R[m] = M.rebuild(m, { model: M.DEFAULT, w: 8, n: 2000, seed: 1 });
  for (const m of M.METHODS) {
    const a = R[m], b = M.rebuild(m, { model: M.DEFAULT, w: 8, n: 2000, seed: 1, dbl: 0.1 }), c = M.rebuild(m, { n: 2000, seed: 2 });
    let recount = 0;
    for (let k = 0; k < a.n; k++) { let all = 1; for (let i = 0; i < 6; i++) if (!M.OKS[a.samples[k * 6 + i]]) all = 0; recount += all; }
    const again = M.rebuild(m, { n: 2000, seed: 1 });
    ok(a === b && a === again && recount === a.intact, `${m}: deterministic for a seed (cached), intact counted right`);
    ok(Math.abs(a.share - a.expected) < 0.03 && Math.abs(c.share - c.expected) < 0.03, `${m}: share ${pc(a.share)} within 3 points of the exact chance ${pc(a.expected)} (seed 2: ${pc(c.share)})`);
    let ps = 0; for (let i = 0; i < 6; i++) { let s = 0; for (let k = 0; k < 16; k++) s += a.post[i * 16 + k]; ps = Math.max(ps, Math.abs(s - 1)); }
    ok(ps < 1e-12, `${m}: each pair's posterior sums to 1`);
    console.log(`     ${m}: all six pairs ${pc(a.share)} of 2,000 (exact chance ${pc(a.expected)}); each pair matches with ${Array.from(a.pairOk, f3).join(' ')}; most likely ${a.best.top}/${a.best.bottom} (broken ${M.brokenPairs(a.best.top, a.best.bottom).map(i => i + 1).join(',') || 'none'})`);
  }
  ok(R.indep.expected < R.exact.expected && R.exact.expected < R.coupled.expected && R.indep.share < R.exact.share && R.exact.share < R.coupled.share,
    'the order letter by letter < exact pair model < coupled stand-in, as in the authors\' test');
  ok(R.exact.expected > 0.18 && R.exact.expected < 0.36, 'the exact share is between about a fifth and a third');
  for (const mk of ['even', 'transitions']) {
    const e = M.METHODS.map(m => M.rebuild(m, { model: mk }).expected);
    ok(e[0] < e[2] && e[2] < e[1], `${mk}: the same order (${e.map(pc).join(', ')})`);
  }
  // the crowd: exactly the share asked for, the rest with a broken pair
  for (const m of M.METHODS) {
    const C = M.crowd(m, D.test.intact[m], 2000, 1), C2 = M.crowd(m, D.test.intact[m], 2000, 1);
    let good = 0, right = true;
    for (let k = 0; k < C.n; k++) {
      let all = 1; for (let i = 0; i < 6; i++) if (!M.OKS[C.samples[k * 6 + i]]) all = 0;
      good += all; if (all !== C.good[k]) right = false;
    }
    ok(good === Math.round(D.test.intact[m] * 2000) && right && C.samples.every((v, i) => v === C2.samples[i]),
      `crowd ${m}: exactly ${good} of 2,000 intact (${pc(D.test.intact[m])}, the authors' test), the others broken, seeded`);
  }
}

// 8. The family tree: seeded, 8 tips, a round crown within bounds, mutations that add up
{
  let fit = true, round = true, seeded = true, muts = true, counts = true;
  for (let seed = 1; seed <= 40; seed++) for (const speed of [1, 2]) {
    const T = M.familyTree(seed, speed), U = M.familyTree(seed, speed);
    if (JSON.stringify(T) !== JSON.stringify(U)) seeded = false;
    if (T.nodes.length !== 15 || T.branches.length !== 14 || T.tips !== 8 || T.nodes.filter(n => n.tip >= 0).length !== 8) counts = false;
    const p = [0, 0, 0];
    for (const b of T.branches) for (let u = 0; u <= 1; u += 0.05) {
      M.curve(T, b.id, u, p);
      if (Math.hypot(p[0], p[2]) > 1.25 || p[1] > 1.2 + 1e-9 || p[1] < -1 - 1e-9) fit = false;
    }
    const tips = T.nodes.filter(n => n.tip >= 0), sx = Math.max(...tips.map(n => n.pos[0])) - Math.min(...tips.map(n => n.pos[0]));
    const sz = Math.max(...tips.map(n => n.pos[2])) - Math.min(...tips.map(n => n.pos[2]));
    if (sz < 0.5 * sx || sx < 0.5 * sz) round = false;
    const out = new Uint8Array(8);
    for (const b of T.branches) {
      if (!close(b.len, T.nodes[b.to].len) || b.muts.some((m, i) => m.at <= 0 || m.at >= 1 || (i && m.at < b.muts[i - 1].at))) muts = false;
      if (M.toStr(M.seqAt(T, b.id, 1, out)) !== T.nodes[b.to].seq || M.toStr(M.seqAt(T, b.id, 0, out)) !== T.nodes[b.from].seq) muts = false;
    }
  }
  ok(seeded && counts, 'family trees: seeded (the same tree twice), 15 nodes, 14 branches, 8 tips');
  ok(fit, 'every branch curve stays in the crown (radius 1.25, y from -1 to 1.2), 40 seeds at two speeds');
  ok(round, 'not flat: the tips spread at least half as far in z as in x, and the other way round');
  ok(muts, 'mutations in order along each branch; replayed they give each child\'s sequence');
  let hl = true;
  for (let seed = 1; seed <= 40; seed++) {
    const T = M.familyTree(seed), h = T.highlight, a = T.branches[h.long], b = T.branches[h.short];
    if (a.len <= b.len || a.muts.length <= b.muts.length) hl = false;
  }
  ok(hl, 'the highlighted long branch is longer and carries more swaps than the short one (40 seeds)');
  // the mutations follow the model: the average count per letter matches the branch length (many seeds)
  let n = 0, L = 0;
  for (let seed = 1; seed <= 300; seed++) for (const b of M.familyTree(seed).branches) { n += b.muts.length; L += b.len * 8; }
  ok(Math.abs(n / L - 1) < 0.05, `mutations per letter match the branch lengths (${f3(n / L)} swaps per swap expected, 300 trees)`);
  const T = M.familyTree(1), a = M.familyTree(1, 2);
  ok(a.nodes.every((nd, i) => nd.pos.every((v, k) => v === T.nodes[i].pos[k])) && close(a.branches[3].len, 2 * T.branches[3].len) && close(a.unit, T.unit / 2), 'speed scales the lengths, not the drawing');
  const tg = M.tangent(T, 0, 0), tg1 = M.tangent(T, 0, 1);
  ok(Math.abs(tg[0]) + Math.abs(tg[2]) < 1e-12 && tg[1] > 0 && tg1[1] > 2 * Math.hypot(tg1[0], tg1[2]), 'a branch leaves its parent upwards and arrives nearly upright');
  console.log(`     family tree (seed 1): drawn ${f3(T.unit)} high per swap per letter; longest branch ${T.longest} (${f3(T.branches[T.longest].len)}), shortest ${T.shortest} (${f3(T.branches[T.shortest].len)}); highlighted long ${T.highlight.long} (${f3(T.branches[T.highlight.long].len)}, ${T.branches[T.highlight.long].muts.length} swaps) and short ${T.highlight.short} (${f3(T.branches[T.highlight.short].len)}, ${T.branches[T.highlight.short].muts.length}); ${T.branches.reduce((s, b) => s + b.muts.length, 0)} mutations`);
  for (const b of T.branches) console.log(`       branch ${String(b.id).padStart(2)} ${b.from}->${String(b.to).padEnd(2)} len ${f3(b.len)}  ${b.muts.length} mutations ${b.muts.map(m => `${'ACGT'[m.from]}${m.site + 1}${'ACGT'[m.to]}@${m.at.toFixed(2)}`).join(' ')}`);
  console.log('       tips: ' + T.nodes.filter(nd => nd.tip >= 0).map(nd => `${nd.tip} ${nd.seq} (${nd.pos.map(v => v.toFixed(2)).join(', ')})`).join('; '));
  const S = M.speciesTree();
  console.log('     species tree: ' + S.nodes.map(nd => `${nd.name} (${nd.pos.map(v => v.toFixed(3)).join(', ')})`).join('; '));
  console.log('       branch lengths: ' + S.branches.map(b => `${S.nodes[b.from].name}->${S.nodes[b.to].name} ${b.len}`).join(', '));
}

const ms = Date.now() - t0;
ok(ms < 1000, `all in ${ms} ms`);
console.log(bad ? `${bad} check(s) failed` : 'all checks passed');
process.exit(bad ? 1 : 0);
