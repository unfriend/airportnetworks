// Checks the membrane sides in Node: PSIDES (src/sets/psides.js) decodes PPI_SIDES (src/sets/sides.js) over PDATA and
// judges the links again with the sides, and places the complexes, exactly as gen_sides.py did.
// usage: node packages/ppicell/src/data/test-sides.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const P = require('../sets/pdata.js');
const T = require('../sets/psides.js');
const C = T.S.check;
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
ok(T.S.cls.length === P.L && T.S.lay.length === P.L && T.S.ev.length === P.L && T.S.by.length === P.L, `${P.L} locations, a class each`);
ok(T.acc.length === P.N && T.acc.filter(a => a).length === C.mapped[0], `${C.mapped[0]} of ${P.N} proteins with a UniProt entry`);
// classes: a place without a membrane is '.', every other a digit; counts as gen_sides.py's
const MEMBRANE = [3, 4, 5, 6, 7, 8, 9, 10];
let shape = true;
const named = Array(8).fill(0), carried = Array(8).fill(0);
for (let l = 0; l < P.L; l++) {
  const mem = MEMBRANE.includes(P.lPlace[l]);
  if (mem !== (T.cls[l] !== 255)) shape = false;
  if (mem) (T.by[l] === 't' ? carried : named)[T.cls[l]]++;
  if (mem && T.cls[l] >= 2 && !T.locMask(l, false, true)) shape = false;
}
ok(shape, 'a class at every membrane place and only there; every known class reaches a space');
ok(named.join() === C.perClass.named.join() && carried.join() === C.perClass.carried.join(), `classes named ${named.join(', ')}; carried ${carried.join(', ')}`);
// the judgements: old (PDATA's), and with sides: UniProt's places only, and carried too
const count = f => { const c = [0, 0, 0]; for (let i = 0; i < P.E; i++) { const j = f(i); if (j >= 0) c[j]++; } return c; };
const old = g => i => P.contact(i) ? P.judge(P.pl[P.la[i]], P.pl[P.lb[i]], g) : -1;
const runs = { oldStrict: old(false), oldGenerous: old(true), strict: i => T.judge(i, false, false), generous: i => T.judge(i, true, false),
  carryStrict: i => T.judge(i, false, true), carryGenerous: i => T.judge(i, true, true) };
for (const [name, f] of Object.entries(runs)) { const c = count(f); ok(c.join() === C.split[name].join(), `${name}: ${c.join(', ')} (gen_sides.py: ${C.split[name].join(', ')})`); }
// the old span (strict and generous differ) and how much of it the sides settle
let span = 0, settled = 0, settledCarry = 0;
for (let i = 0; i < P.E; i++) {
  const a = runs.oldStrict(i), b = runs.oldGenerous(i);
  if (a < 0 || a === b) continue;
  span++;
  if (T.judge(i, false, false) === T.judge(i, true, false)) settled++;
  if (T.judge(i, false, true) === T.judge(i, true, true)) settledCarry++;
}
ok(span === C.span && settled === C.settled.named && settledCarry === C.settled.carry, `old span ${span}: settled ${settled}, carried too ${settledCarry}`);
// complexes
ok(T.cx.length === C.complexes && T.cx.every(c => c.members.length >= 2), `${T.cx.length} complexes with two members or more in the map`);
for (const carry of [false, true]) for (const g of [false, true]) {
  const key = (carry ? 'carry' : '') + (g ? 'Generous' : 'Strict'), kinds = [0, 0, 0, 0, 0];
  let sites = 0;
  T.cx.forEach((c, q) => { const r = T.cxPos(c, g, carry); kinds[r.kind]++; sites += (q + 1) * (r.site + 2); });
  ok(kinds.join() === C.complexPos[key].join() && sites === C.complexSites[key], `complexes ${key}: inside, on a face, spanning, cannot meet, too few placed ${kinds.join(', ')}`);
}
// the complexes whose members cannot meet, told apart: one gate apart, or no way to meet (no count in gen_sides.py: the
// two must add up to its count; the proteasome is one gate apart)
for (const carry of [false, true]) {
  let gate = 0, none = 0;
  T.cx.forEach(c => { if (T.cxPos(c, false, carry).kind === 3) T.cxGate(c, false, carry) ? gate++ : none++; });
  const want = C.complexPos[carry ? 'carryStrict' : 'Strict'][3], p26 = T.cx.find(c => c.name === '26S proteasome complex');
  ok(gate + none === want && p26 && T.cxGate(p26, false, carry), `cannot meet${carry ? ', carried' : ''}: ${gate} a gate apart, ${none} no way to meet (of ${want})`);
}
const pairs = new Set();
for (const c of T.cx) for (const x of c.members) for (const y of c.members) if (x < y) pairs.add(x * 65536 + y);
const inCx = [];
for (let i = 0; i < P.E; i++) { const a = P.la[i], b = P.lb[i]; if (a !== b && pairs.has(Math.min(a, b) * 65536 + Math.max(a, b))) inCx.push(i); }
ok(inCx.length === C.complexLinks, `${inCx.length} links inside a complex`);
for (const [name, f] of Object.entries(runs)) {
  const c = [0, 0, 0, 0];
  for (const i of inCx) { const j = f(i); c[j >= 0 ? j : 3]++; }
  ok(c.join() === C.complexSplit[name].join(), `  ${name}: ${c.join(', ')}`);
}
const adrb2 = P.sym.indexOf('ADRB2'), lo = P.lOf[adrb2], hi = P.lOf[adrb2 + 1];
ok([...Array(hi - lo).keys()].some(d => P.lPlace[lo + d] === 9 && T.cls[lo + d] === 6), 'ADRB2 goes through the plasma membrane several times');
process.exit(bad ? 1 : 0);
