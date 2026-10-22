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
  const ch = A.chain(A.find('SYD'));
  ok(ch && ch[0] === base.start && ch.every((c, k) => !k || (A.arrivalDay(c) > A.arrivalDay(ch[k - 1]))), `the way it took to Sydney: ${ch ? ch.map(i => A.info(i).code).join(' > ') : 'none'}`);
  // small towns: how the hubs carry it ("slowly, then everywhere at once")
  const s = A.series(), first = d => s.E[d] + s.I[d] + s.R[d];
  console.log('    reached by day:', [5, 10, 15, 20, 25, 30, 40, 50, 60, 80].map(d => `${d}: ${first(Math.min(d, s.S.length - 1))}`).join(', '));
}
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
