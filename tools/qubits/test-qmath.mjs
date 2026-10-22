// Checks the qubits story's maths (sets/qmath.js) and prints what the example networks give.
// usage (from the repository root): node tools/qubits/test-qmath.mjs     (exits 1 on a failed check; about a second)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Q = require('./sets/qmath.js');
let bad = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) bad++; };
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// 1. The Pauli decomposition rebuilds a matrix exactly (a random real one, not symmetric, and a symmetric one)
for (const L of [1, 2, 3, 4]) {
  const N = 1 << L, r = Q.rng(100 + L), M = new Float64Array(N * N).map(() => r() * 2 - 1);
  const S = new Float64Array(N * N); for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) S[i * N + j] = M[i * N + j] + M[j * N + i];
  for (const [nm, A] of [['real', M], ['symmetric', S]]) {
    const c = Q.pauli(A, L), B = Q.fromPauli(c, L);
    let err = 0, im = 0;
    for (let i = 0; i < N * N; i++) { err = Math.max(err, Math.abs(B.re[i] - A[i])); im = Math.max(im, Math.abs(B.im[i])); }
    ok(err < 1e-12 && im < 1e-12, `Pauli decomposition rebuilds a ${nm} ${N}x${N} matrix (max error ${err.toExponential(1)})`);
    if (nm === 'symmetric') ok(c.im.every(v => Math.abs(v) < 1e-12), `  its weights are real at ${L} bits`);
  }
}
// and agrees with tr(sigma M) / N computed entry by entry, at 3 bits
{
  const L = 3, N = 8, r = Q.rng(7), M = new Float64Array(64).map(() => r());
  const c = Q.pauli(M, L);
  let worst = 0;
  for (let k = 0; k < 64; k++) {
    let re = 0, im = 0;
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) { const [er, ei] = Q.entry(k, L, a, b); re += er * M[b * N + a]; im += ei * M[b * N + a]; }
    worst = Math.max(worst, Math.abs(re / N - c.re[k]), Math.abs(im / N - c.im[k]));
  }
  ok(worst < 1e-12, 'each weight is tr(sigma M) / N');
}
// names: the figure's strings; Z2 is +1 where bit 2 is 0
{
  ok(['X0', 'X1', 'X2', 'Z2', 'Z2X1', 'X2X1', 'Y2Y1', 'Z2Z1', 'Z0', 'X1X0'].every(s => Q.name(Q.parse(s, 3), 3) === s), 'names and parse agree');
  ok(Q.name(Q.parse('X2X1', 3), 3, { sub: true }) === 'X₂X₁', 'names with subscripts');
  const z2 = Q.parse('Z2', 3);
  ok([0, 1, 2, 3].every(i => Q.entry(z2, 3, i, i)[0] === 1) && [4, 5, 6, 7].every(i => Q.entry(z2, 3, i, i)[0] === -1), 'Z2 is +1 on cells 0xx and -1 on 1xx');
  const yy = Q.parse('Y2Y1', 3);
  ok(Q.entry(yy, 3, 0, 6)[0] === -1 && Q.entry(yy, 3, 2, 4)[0] === 1, 'Y2Y1 hops across face diagonals with signs');
}

// 2. The algebras: so(2L) has L(2L - 1) strings, so(2L + 1) has L(2L + 1)
for (const L of [1, 2, 3, 4, 5]) {
  const t = Q.algebra('tfim', L), o = Q.algebra('odd', L);
  ok(t.dim === L * (2 * L - 1) && o.dim === L * (2 * L + 1), `at ${L} bits: ${t.label} has ${t.dim} strings, ${o.label} has ${o.dim}`);
}
{
  const o = Q.algebra('odd', 3), inside = s => o.set.has(Q.parse(s, 3));
  ok(['X0', 'X1', 'X2', 'Z2Z1', 'Y2Y1', 'Z1Z0', 'Z2'].every(inside), 'so(7) holds X0 X1 X2 Z2Z1 Z1Z0 Z2 and Y2Y1');
  ok(!['X2X1', 'Z0', 'X1X0'].some(inside), 'so(7) leaves out X2X1, Z0 and X1X0 (gray in the figure)');
  ok(o.gens.map(k => Q.name(k, 3)).join(' ') === 'X0 X1 X2 Z2Z1 Z1Z0 Z2', 'so(7) generators in the circuit\'s order');
}

// 3. The example networks: the planted cells are found
for (const s of Q.NETS) {
  const t0 = Date.now(), net = Q.network(s.key), A = Q.analyze(s.key, { L: 3 }), ms = Date.now() - t0;
  const R = Q.analyze(s.key, { L: 3, cut: 'random' });
  console.log(`     ${s.key}: ${net.n} genes, ${net.m} links; found cut in ${ms} ms: cells ${A.sizes.join(' ')}, purity ${A.purity === null ? '-' : A.purity.toFixed(3)}, ` +
    `cut share ${A.cutShare.toFixed(3)}, cube edges ${(100 * A.cubeShare).toFixed(0)}%, residual so(6) ${A.fits.tfim.residual.toFixed(3)} so(7) ${A.fits.odd.residual.toFixed(3)} ` +
    `(random cut ${R.fits.odd.residual.toFixed(3)})`);
  if (s.key === 'clear' || s.key === 'mixed') {
    ok(A.purity === 1, `  ${s.key}: every planted group is one cell`);
    // the labelling is the cube's: groups one bit apart on the planted cube are one bit apart in the found codes
    const map = new Int32Array(8).fill(-1);
    for (let i = 0; i < net.n; i++) map[net.group[i]] = A.code[i];
    let cube = true;
    for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) if ((Q.pop(a ^ b) === 1) !== (Q.pop(map[a] ^ map[b]) === 1)) cube = false;
    ok(cube, `  ${s.key}: the codes keep the planted cube (neighbors stay one bit apart)`);
    ok(A.fits.odd.residual < R.fits.odd.residual, `  ${s.key}: its residual is below a random cut's`);
  }
  // balanced A_c: rows sum to 1, symmetric
  let rs = 0, sym = 0;
  for (let i = 0; i < 8; i++) { let s1 = 0; for (let j = 0; j < 8; j++) { s1 += A.Ac[i * 8 + j]; sym = Math.max(sym, Math.abs(A.Ac[i * 8 + j] - A.Ac[j * 8 + i])); } rs = Math.max(rs, Math.abs(s1 - 1)); }
  ok(rs < 1e-9 && sym < 1e-12, `  ${s.key}: A_c is symmetric and balanced (rows sum to 1)`);
  // the I weight is the mean diagonal; the errors fall to 0 with every string added
  let tr = 0; for (let i = 0; i < 8; i++) tr += A.Ac[i * 9];
  ok(close(A.c.re[0], tr / 8), `  ${s.key}: the I weight is tr(A_c)/8 = ${(tr / 8).toFixed(3)}`);
  ok(A.errors[A.errors.length - 1] < 1e-7 && A.errors.every((e, j) => j === 0 || e <= A.errors[j - 1] + 1e-12), `  ${s.key}: the error falls to 0 as strings are added`);
  const rb = Q.rebuild(A.c, 3, A.order, A.order.length);
  ok(rb.re.every((v, i) => close(v, A.Ac[i], 1e-12)), `  ${s.key}: all strings rebuild A_c`);
}

// 4. The residual is 0 at 1 bit (a 2 x 2 balanced operator lies inside the algebra), for every network and cut
for (const s of Q.NETS) for (const how of ['found', 'random']) {
  const A = Q.analyze(s.key, { L: 1, cut: how });
  ok(A.fits.tfim.residual < 1e-7 && A.fits.odd.residual < 1e-7, `${s.key} (${how} cut) at 1 bit: residual 0`);
}
for (const s of Q.NETS) {
  const A = Q.analyze(s.key, { L: 2 });
  console.log(`     ${s.key} at 2 bits: residual so(4) ${A.fits.tfim.residual.toFixed(3)}, so(5) ${A.fits.odd.residual.toFixed(3)}`);
}

// 5. The residual is the projection's: ||A0 - Pi A0|| / ||A0|| by matrices
{
  const A = Q.analyze('mixed', { L: 3 }), alg = Q.algebra('odd', 3), N = 8;
  const A0 = A.Ac.slice(); for (let i = 0; i < N; i++) A0[i * 9] -= A.c.re[0];
  const P = Q.fromPauli(A.c, 3, alg.basis.filter(k => k));
  let num = 0, den = 0; for (let i = 0; i < 64; i++) { num += (A0[i] - P.re[i]) ** 2; den += A0[i] ** 2; }
  ok(close(Math.sqrt(num / den), A.fits.odd.residual, 1e-12), `the residual by matrices matches (${A.fits.odd.residual.toFixed(4)})`);
}

// 6. Trotter angles: theta = -2 c t; the real run's weights give the brief's angles
{
  const A = Q.analyze('clear', { L: 3 }), g = A.trotter.odd;
  ok(g.length === 6 && g.every(x => close(x.theta, -2 * x.c)), 'six gates, theta = -2 c t');
  ok(g.map(x => x.type + ' ' + x.qubits.join(',')).join(' | ') === 'RX 0 | RX 1 | RX 2 | RZZ 2,1 | RZZ 1,0 | RZ 2', 'gates in the circuit\'s order');
  console.log('     clear network, so(7) step: ' + g.map(x => `${x.type} q${x.qubits.join(',q')} ${x.theta.toFixed(3)}`).join('; '));
}
// 7. Determinism: the same network twice
{
  const a = Q.planted(Q.NETS.find(s => s.key === 'mixed')), b = Q.network('mixed');
  ok(a.m === b.m && a.edges.every((v, i) => v === b.edges[i]), 'the networks are seeded (the same links every time)');
}
// the layout is quick enough to draw
{
  const t0 = Date.now(); Q.layout(Q.network('blurred'), { dim: 3 }); const ms = Date.now() - t0;
  console.log(`     3D layout of the densest network: ${ms} ms`);
}
console.log(bad ? `${bad} check(s) failed` : 'all checks passed');
process.exit(bad ? 1 : 0);
