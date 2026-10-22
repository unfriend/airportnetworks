// Checks the pass story's sets without a browser (three.js runs in Node for building; nothing is drawn): the outbreak
// is the same for the same start and settings, its series add up, fewer flights slow it; the fish school holds with
// seven neighbours and falls apart with one, and its warning outruns the shark; the cell's moves and API.
// usage (from the repository root, after node tools/pass/build.mjs): node tools/pass/test-sets.mjs [globe|fish|cell ...]
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const here = path.dirname(new URL(import.meta.url).pathname), root = path.join(here, '../..');
const only = process.argv.slice(2);
const want = k => !only.length || only.includes(k);
// a page without a page: a canvas whose 2D context draws nothing, a screen, a window
const ctx2d = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
const canvas = () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} });
const sandbox = { console, atob, TextDecoder, Math, Date, performance, setTimeout, clearTimeout,
  document: { createElement: () => canvas(), querySelector: () => null, documentElement: {} }, screen: { width: 1920, height: 1080 },
  window: { devicePixelRatio: 1, innerWidth: 1280, innerHeight: 760 }, navigator: { language: 'en-GB' }, getComputedStyle: () => ({ getPropertyValue: () => '' }) };
sandbox.THREE = require(path.join(root, 'three.min.js'));
vm.createContext(sandbox);
const load = f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
load('tools/lbi/kit.js');
vm.runInContext('var SETS = {}; var K = makeKit(THREE);', sandbox);
for (const f of ['tools/pass/gen/airports.js', 'tools/pass/gen/spatial.js']) {
  // (top-level consts of a script stay in its own scope in vm: make the originals' functions reachable)
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8').replace(/^const (PASS_\w+) =/m, 'var $1 ='), sandbox, { filename: f });
}
for (const s of ['fish', 'globe', 'cell']) if (want(s)) load(`tools/pass/sets/${s}.js`);
// (tuning: FISH_TUNE='V0=1,KA=2' tries other numbers for the school without editing the set)
if (process.env.FISH_TUNE && want('fish')) {
  let src = fs.readFileSync(path.join(root, 'tools/pass/sets/fish.js'), 'utf8');
  src = src.replace(/^  const V0 = .*$/m, line => process.env.FISH_TUNE.split(',').reduce((l, kv) => { const [k, v] = kv.split('='); return l.replace(new RegExp(`\\b${k} = [-0-9.]+`), `${k} = ${v}`); }, line));
  vm.runInContext(src, sandbox, { filename: 'fish (tuned)' });
}
let fails = 0;
const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails++; };
const build = k => { const t0 = performance.now(); const s = vm.runInContext(`SETS.${k}(K)`, sandbox); console.log(`${k}: built in ${(performance.now() - t0).toFixed(0)} ms`); return s; };

if (want('globe')) {
  const g = build('globe'), A = g.api;
  const runOf = o => { const s = A.setup(o); const c = A.count(A.end()); return { s, c, ser: A.series(), arr: A.arrivalDay(A.find('JFK')) }; };
  const base = { start: A.find('VIE'), inc: 5, inf: 7, spread: 'medium', kept: 1, seed: 1 };
  const a = runOf(base), b = runOf(Object.assign({}, base, { start: A.find('LHR') })), a2 = runOf(base);
  ok(a.s.reached === a2.s.reached && a.arr === a2.arr && JSON.stringify(a.ser.I) === JSON.stringify(a2.ser.I), `the same start and settings give the same outbreak (${a.s.reached} cities, last day ${a.s.end}, JFK on day ${a.arr})`);
  ok(a.ser.S.every((s, d) => s + a.ser.E[d] + a.ser.I[d] + a.ser.R[d] === A.n()), 'every day the four states add up to all the cities');
  ok(a.s.reached > A.n() * 0.5, `medium spread from Vienna reaches most cities (${a.s.reached} of ${A.n()})`);
  console.log('   ', 'from London:', b.s.reached, 'cities, last day', b.s.end, ', peak day', b.s.peak);
  for (const sp of ['low', 'medium', 'high']) for (const kept of [1, 0.5, 0.1]) {
    const r = runOf(Object.assign({}, base, { spread: sp, kept }));
    const d50 = r.ser.S.findIndex(s => s < A.n() * 0.5);
    console.log(`    ${sp.padEnd(6)} flights kept ${String(kept * 100).padStart(3)} %: ${String(r.s.reached).padStart(4)} cities, half by day ${d50 < 0 ? '-' : d50}, peak day ${r.s.peak}, last day ${r.s.end}`);
  }
  const slow = runOf(Object.assign({}, base, { kept: 0.3 })), fast = runOf(base);
  const half = r => r.ser.S.findIndex(s => s < A.n() * 0.5);
  ok(half(slow) < 0 || half(slow) > half(fast), `fewer flights slow it down (half the cities by day ${half(fast)}, with 30 % of flights: ${half(slow) < 0 ? 'never' : 'day ' + half(slow)})`);
  // the chain to a city runs back to the start, each step a route, each arrival later than the one before
  A.setup(base);
  ok(A.search('wien')[0] === A.find('VIE') && A.search('VIE')[0] === A.find('VIE'), 'search finds Vienna by its code and as Wien');
  ok(A.info(A.find('GRU')).city === 'São Paulo' && A.search('são').includes(A.find('GRU')), 'São Paulo with its tilde, and found so');
  const ch = A.chain(A.find('SYD'));
  ok(ch && ch[0] === base.start && ch.every((c, k) => !k || (A.arrivalDay(c) > A.arrivalDay(ch[k - 1]))), `the way it took to Sydney: ${ch ? ch.map(i => A.info(i).code).join(' > ') : 'none'}`);
  // small towns: how the hubs carry it ("slowly, then everywhere at once")
  const s = A.series(), first = d => s.E[d] + s.I[d] + s.R[d];
  console.log('    reached by day:', [5, 10, 15, 20, 25, 30, 40, 50, 60, 80].map(d => `${d}: ${first(Math.min(d, s.S.length - 1))}`).join(', '));
}
if (want('fish')) {
  const f = build('fish'), S = Object.assign({}, f.params), st = () => f.state();
  const run = (sec, k) => { S.fish_k = k; for (let i = 0; i < sec * 30; i++) { f.see([0, 1.6, 0], []); f.update(S, 0, 1 / 30); } };
  // how the school is: polarisation (1: all swim one way), its groups (fish within 0.7 m of each other, chained) and the
  // share in the biggest, and how far its middle is from you
  function shape() {
    const { P, V, N } = st();
    let vx = 0, vy = 0, vz = 0;
    for (let i = 0; i < N; i++) { const l = Math.hypot(V[3 * i], V[3 * i + 1], V[3 * i + 2]); vx += V[3 * i] / l; vy += V[3 * i + 1] / l; vz += V[3 * i + 2] / l; }
    const par = Array.from({ length: N }, (_, i) => i), find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if ((P[3 * i] - P[3 * j]) ** 2 + (P[3 * i + 1] - P[3 * j + 1]) ** 2 + (P[3 * i + 2] - P[3 * j + 2]) ** 2 < 0.5) par[find(i)] = find(j);
    const sz = new Map(); for (let i = 0; i < N; i++) { const r = find(i); sz.set(r, (sz.get(r) || 0) + 1); }
    const c = st().centre;
    // local order: how alike each fish swims to those within 1.2 m of it (a school milling round you is ordered too)
    let lo = 0, ln = 0;
    for (let i = 0; i < N; i++) {
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (let j = 0; j < N; j++) {
        if ((P[3 * i] - P[3 * j]) ** 2 + (P[3 * i + 1] - P[3 * j + 1]) ** 2 + (P[3 * i + 2] - P[3 * j + 2]) ** 2 > 1.44) continue;
        const l = Math.hypot(V[3 * j], V[3 * j + 1], V[3 * j + 2]); sx += V[3 * j] / l; sy += V[3 * j + 1] / l; sz += V[3 * j + 2] / l; n++;
      }
      if (n > 3) { lo += Math.hypot(sx, sy, sz) / n; ln++; }
    }
    let mx = 0, my = 0, mz = 0; for (let i = 0; i < N; i++) { mx += P[3 * i] / N; my += P[3 * i + 1] / N; mz += P[3 * i + 2] / N; }
    let sp = 0; for (let i = 0; i < N; i++) sp += ((P[3 * i] - mx) ** 2 + (P[3 * i + 1] - my) ** 2 + (P[3 * i + 2] - mz) ** 2) / N;
    return { spread: Math.sqrt(sp), loc: ln ? lo / ln : 0, pol: Math.hypot(vx, vy, vz) / N, groups: [...sz.values()].filter(n => n >= 3).length, big: Math.max(...sz.values()) / N, dist: Math.hypot(c[0], c[2]) };
  }
  const fmtS = s => `spread ${s.spread.toFixed(1)} m, order ${s.loc.toFixed(2)} (polarisation ${s.pol.toFixed(2)}), ${s.groups.toFixed(1)} groups of 3 or more, the biggest ${(s.big * 100).toFixed(0)} %, its middle ${s.dist.toFixed(1)} m from you`;
  // (each phase measured as the mean of ten looks, two seconds apart, after it has settled for 20 s)
  const phase = (k, sec) => { run(sec - 20, k); const acc = { spread: 0, loc: 0, pol: 0, groups: 0, big: 0, dist: 0 }; for (let n = 0; n < 10; n++) { run(2, k); const s = shape(); for (const x in acc) acc[x] += s[x] / 10; } return acc; };
  const t0 = performance.now(); const a = phase(7, 40); const ms = (performance.now() - t0) / (40 * 30);
  console.log(`    40 s with seven neighbours: ${fmtS(a)} (${ms.toFixed(2)} ms a step)`);
  const t1 = st().t; run(10, 1); const b10 = shape(); const b = phase(1, 40);
  console.log(`    then with one: after 10 s the biggest group ${(b10.big * 100).toFixed(0)} %; after 40 s ${fmtS(b)}`);
  const c = phase(7, 40); console.log(`    then 40 s with seven again: ${fmtS(c)}`);
  ok(a.big > 0.8 && a.loc > 0.8 && a.spread < 2.5, 'with seven neighbours the school holds and swims as one');
  ok(b.spread > a.spread * 1.25 && b.groups >= 8 && b.loc < a.loc - 0.2, 'with one neighbour each it falls apart');
  ok(c.big > 0.7 && c.loc > 0.75 && c.spread < a.spread * 1.4, 'with seven again it comes back together');
  ok(a.dist < 10 && c.dist < 10, 'it stays round you');
  // the shark: the warning outruns it. Note when the warning reaches each fish and how far that fish is from the first
  // one warned; the warning's speed is the slope (fitted for the fish beyond 1.5 m), the shark's its own
  run(10, 7);
  const hits = []; f.watch((i, t) => { const { P } = st(); if (!hits.some(h => h[0] === i)) hits.push([i, t, P[3 * i], P[3 * i + 1], P[3 * i + 2]]); });
  S.fish_hunt = 1; let sharkMax = 0;
  for (let i = 0; i < 20 * 30; i++) { f.see([0, 1.6, 0], []); f.update(S, 0, 1 / 30); const sh = st().shark; if (sh.on) sharkMax = Math.max(sharkMax, Math.hypot(...sh.v)); }
  f.watch(null);
  if (hits.length > 10) {
    // the warning's front: how far from the first fish warned it has got after 0.3, 0.5 and 0.8 s (the middle one)
    const h0 = hits[0], far = tau => Math.max(...hits.filter(h => h[1] - h0[1] <= tau).map(h => Math.hypot(h[2] - h0[2], h[3] - h0[3], h[4] - h0[4]))) / tau;
    const sp = [far(0.3), far(0.5), far(0.8)].sort((x, y) => x - y)[1];
    ok(sp > sharkMax * 1.5, `the warning reaches ${hits.length} of ${st().N} fish, its front at about ${sp.toFixed(1)} m/s; the shark swims at most ${sharkMax.toFixed(1)} m/s`);
  } else ok(false, `the shark warned only ${hits.length} fish`);
  // steering: the shark follows a point
  f.steer([3, 1.6, -4]); run(4, 7); const sh = st().shark;
  ok(sh.on && Math.hypot(sh.p[0] - 3, sh.p[1] - 1.6, sh.p[2] + 4) < 1.5, 'a steered shark swims to where it is steered');
  f.steer(null); run(30, 7); ok(!st().shark.on, 'let go, it swims away');
}
if (want('cell')) {
  const c = build('cell'), A = c.api, S = Object.assign({}, c.params);
  const n = A.counts();
  ok(n.proteins > 200 && n.links > 200 && n.places === 13, `the cell map's cell as it is: ${n.proteins} proteins (${n.copies} copies in their places), ${n.links} links, ${n.places} places`);
  const p = A.protein('RELA'), inf = A.info(p);
  ok(inf && inf.places.length === 2 && inf.partners.length > 0 && inf.moves.includes('nfkb'), `RELA: ${inf.name}, in ${inf.places.map(x => x.name).join(' and ')}, partners in ${inf.partners.length} places, moves ${inf.moves.join(' ')}`);
  const d = A.moveDelta('nfkb')[0];
  ok(d && d.gained.length > 0, `when NF-κB moves into the nucleus RELA loses ${d.lost.length} partners and gains ${d.gained.length}`);
  const cf = A.moveDelta('cf');
  ok(cf.length === 1 && cf[0].sym === 'CFTR', 'cystic fibrosis: CFTR fails to reach the membrane');
  // the growth signal over the copies there now; with no moves, EGF reaches SRF
  const gp = A.path(A.protein('EGF'), A.protein('SRF'));
  ok(gp && gp.path.length >= 5, `a path from EGF to SRF: ${gp ? gp.path.length - 1 : '-'} steps`);
  c.setLang('de'); ok(A.move('cf').name === 'Mukoviszidose' && A.placeName(0) === 'Außerhalb der Zelle', 'German names for the moves and places');
  { c.setLang('en'); const en = []; for (let p = 0; p < n.proteins; p++) en.push(A.info(p).role);
    c.setLang('de'); const miss = en.filter((r, p) => A.info(p).role === r);
    ok(!miss.length, `every protein's role in German (${miss.length ? 'missing: ' + [...new Set(miss)].join('; ') : A.info(A.protein('RELA')).role})`);
    ok(A.search('Entzündung').includes(A.protein('RELA')), 'the German search finds RELA by its role'); }
  c.setLang('en'); ok(A.move('cf').name === 'Cystic fibrosis', 'and English again');
  // every label has a text in both languages
  let bad = 0; for (const l of ['en', 'de']) { c.setLang(l); for (const L of c.labels) { const t = L.text(); if (!Array.isArray(t)) bad++; } }
  ok(!bad, 'every label has its text in both languages');
  // update runs with the moves under way (the travelling proteins)
  S.cell_nfkb = 0.5; S.cell_cf = 0.5; S.cell_path = 7.5; c.update(S, 1, 1 / 60); ok(true, 'update with moves under way');
}
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
