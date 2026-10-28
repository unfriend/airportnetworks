// Checks that TDATA decodes TOPO_DATA and that its lookups give the poster's numbers. No science: the numbers are
// topocyte's (sets/data.js, written by data/gen_data.py); this only checks that the data and the decoders agree.
// usage (from the repository root): node tools/topo/test-data.mjs
import fs from 'fs';
import path from 'path';
import vm from 'vm';
const here = path.dirname(new URL(import.meta.url).pathname);
import { createRequire } from 'module';
const ctx = { Buffer, console, require: createRequire(import.meta.url) };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here, 'sets/data.js'), 'utf8') + '\nthis.TOPO_DATA = TOPO_DATA;', ctx);
vm.runInContext(fs.readFileSync(path.join(here, 'sets/tdata.js'), 'utf8').replace("if (typeof module !== 'undefined') module.exports = TDATA;\n", '') + '\nthis.TDATA = TDATA;', ctx);
const { TOPO_DATA: D, TDATA: T } = ctx;
let fails = 0;
const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails++; };
const near = (a, b, e = 0.006) => Math.abs(a - b) <= e;

// the cohort
ok(D.labels.length === 123 && D.src.healthy === 66 && D.src.cirrhosis === 57, '123 slides: 66 healthy, 57 cirrhosis');
ok(D.labels.filter(Boolean).length === 57, 'labels: 57 cirrhosis');
ok(near(D.src.cells / 1e6, 30.8, 0.05), `30.8 million cells (${D.src.cells})`);
for (const dim of ['h0', 'h1']) {
  const H = D[dim];
  ok(H.scores.length === 123 && H.curves.length === 123 && H.held.length === 123 && H.y.length === 123, `${dim}: 123 slides everywhere`);
  ok(H.y.every((v, i) => v === D.labels[i]), `${dim}: its classes are the labels`);
  const c = [0, 0, 0, 0];
  H.y.forEach((y, i) => c[2 * y + H.held[i]]++);
  ok(c.join() === H.confusion.join(), `${dim}: the held-out predictions give its confusion ${H.confusion.join('/')}`);
  ok(near(H.accuracy, (c[0] + c[3]) / 123, 1e-3), `${dim}: accuracy ${H.accuracy}`);
  const all = T.share(dim === 'h1' ? 1 : 0, 0, Infinity);
  ok(near(all, H.shares.gap, 0.01), `${dim}: the fine shares add up to the gap ${H.shares.gap} (${all.toFixed(3)})`);
  ok(H.curves.every(c => c.length >= 4 && c.length % 2 === 0), `${dim}: every slide has a curve`);
}
const h1 = D.h1;
ok(near(h1.fve[0], 0.72, 0.005) && near(h1.fve[1], 0.20, 0.005), `loops: the first two shapes hold ${h1.fve[0]} and ${h1.fve[1]} (0.72, 0.20)`);
ok(h1.confusion.join('/') === '62/4/10/47', 'loops: 62/4/10/47');
ok(near(h1.accuracy, 0.886, 0.001), 'loops: accuracy 0.886');
ok(near(T.share(1, 5, 10), 2.73, 0.006), `loops 5-10 µm add ${T.share(1, 5, 10).toFixed(3)} (2.73)`);
ok(near(T.share(1, 10, 15), 4.65, 0.006), `loops 10-15 µm add ${T.share(1, 10, 15).toFixed(3)} (4.65)`);
ok(near(h1.shares.gap, 7.04, 0.006), `the gap is ${h1.shares.gap} (7.04)`);
ok(Math.round(Math.exp(h1.shares.gap)) >= 1130 && Math.round(Math.exp(h1.shares.gap)) <= 1145, `odds x ${Math.round(Math.exp(h1.shares.gap))} (1,138)`);
const other = h1.shares.gap - T.share(1, 5, 10) - T.share(1, 10, 15);
ok(near(other, -0.35, 0.01), `the other radii: ${other.toFixed(3)} (-0.35)`);
ok(D.poster.confusion.join('/') === '62/4/10/47' && near(D.poster.gap, 7.04), 'the poster\'s own panel d agrees');

// the patch
const P = D.patch;
ok(T.patch.n === 110, `the patch has ${T.patch.n} cells (110)`);
const pieces = r => T.deaths(P.h0, r) + 1;
ok(P.snaps.length === 4, 'four snapshots');
const want = [[82, 0], [3, 1], [1, 1], [1, 0]];
P.snaps.forEach((r, k) => {
  const n0 = pieces(r), n1 = T.betti(P.h1, r);
  ok(n0 === P.betti[k][0] && n1 === P.betti[k][1], `at ${r} µm: ${n0} pieces, ${n1} loops (stored ${P.betti[k].join(', ')})`);
});
ok(P.betti[0][0] === 82 && P.betti[1][0] === 3 && P.betti[2][0] === 1 && P.betti[3][0] === 1, 'the poster\'s pieces: 82, 3, 1, 1');
ok(P.betti[1][1] >= 1 && P.betti[2][1] >= 1, 'the loop is alive at the second and third snapshots');
ok(P.joins.length === P.h0.length, `one join per finite piece (${P.joins.length})`);
ok(P.loops.length === P.h1.length / 2 && near(P.loops[0].b, P.loop[0], 0.01) && near(P.loops[0].d, P.loop[1], 0.01), 'the longest loop first, as panel b\'s');
ok(P.loops[0].ring && P.loops[0].ring.length >= 3, `the main loop has a ring of ${P.loops[0].ring ? P.loops[0].ring.length : 0} edges`);

// the tile, the window
ok(T.tile.n === D.tile.n && T.tile.n > 300, `the healthy tile: ${T.tile.n} cells`);
const S = T.slide;
ok(S.n === 6716 && S.n === D.slide.n, `the window: ${S.n} cells (6,716)`);
ok(D.slide.comp100.sizes.join('/') === '1000/5716', 'the split at 100 µm: 1,000 and 5,716 cells (the poster\'s)');
const c50 = [0, 0];
for (let i = 0; i < S.n; i++) { if (S.lo50[i] < 0) c50[0]++; else if (S.lo50[i] > 0) c50[1]++; }
ok(c50.join('/') === D.slide.comp50.sizes.join('/'), `the split at 50 µm from the scores: ${c50.join('/')} (stored ${D.slide.comp50.sizes.join('/')})`);
ok(D.slide.train === 122, 'scored by the model of the other 122 slides');
const e = D.slide.e;
ok(near(S.lo50[e.cell], e.logOdds, 0.011), `cell v's score at 50 µm: ${S.lo50[e.cell]} (${e.logOdds})`);
ok(T.localReady && S.localH0(e.cell).length >= 19, `cell v has ${S.localH0(e.cell).length + 1} cells within 50 µm`);
const ev = D.slide.eBars, mine = S.localH0(e.cell);
ok(ev.h0.length === mine.length && ev.h0.every((r, k) => Math.abs(r - mine[k]) / r < 0.025), 'cell v\'s stored bars agree with its packed ones (to the one-byte step)');
ok(S.localH1(e.cell).length === ev.h1.length, `cell v has ${ev.h1.length / 2} loops`);
ok(S.edges.n > S.n && S.tris.n > S.n, `the window's complex: ${S.edges.n} edges, ${S.tris.n} triangles`);
let bad = 0;
for (let k = 0; k < S.edges.n; k++) if (S.edges.i[k] >= S.n || S.edges.j[k] >= S.n) bad++;
ok(!bad, 'every edge joins two window cells');
const O = D.slide.overview;
ok(T.b64(O.count, Uint8Array).length === O.w * O.h, `the overview: ${O.w} x ${O.h} bins of ${O.bin} µm`);
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
