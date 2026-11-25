// Checks PNET (src/sets/pnet.js), the method run in the page: at every limit's default it gives the generator's
// counts and v205's drawing; its communities are the generator's to the last protein, and the same every run; the
// limits do what the Network tab says; a network chosen on the page is read, mapped and judged as it should be.
// usage: node packages/ppicell/src/data/test-pnet.mjs
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), require = createRequire(import.meta.url);
const P = require('../sets/pdata.js'), S = require('../sets/psides.js'), N = require('../sets/pnet.js'), SD = require('../sets/sides.js');
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hash = a => { let h = 0; for (const k of a) h = (Math.imul(h, 31) + k) | 0; return h; };

// ---- the defaults: the generator's counts, and what v205 drew (each drawing's links in order, hashed in the page)
// (the map rebuilt through PDATA.make, as the limits rebuild it, so the page's own path is what is checked)
const R = P.make({ sym: P.sym, pl: P.pl, main: P.main, rel: P.rel, la: P.la, lb: P.lb, kind: P.kind, com: null });
const RS = S.of(R, { cls: S.cls, lay: S.lay, ev: S.ev, by: S.by, acc: S.acc, cx: S.cx });
const LC = N.locs(R), ORD = N.order(R);
const split = (g, sd) => N.select(R, N.run(N.judge(R, RS, LC, g, sd)), ORD, LC.lPlace, 3, -1, 2000);
const C = P.D.check, CS = SD.check.split;
for (const [g, sd, want, name] of [[0, 0, C.split.strict, 'no sides, strict'], [1, 0, C.split.generous, 'no sides, generous'], [0, 1, CS.strict, 'named, strict'],
  [1, 1, CS.generous, 'named, generous'], [0, 2, CS.carryStrict, 'carried, strict (the story)'], [1, 2, CS.carryGenerous, 'carried, generous']]) {
  const s = split(g, sd);
  ok(same(s.tally, want) && s.notC === C.notContact && s.unpl === C.unplaced, `${name}: ${s.tally.join(', ')}; ${s.notC} not contacts, ${s.unpl} unplaced (generators: ${want.join(', ')}; ${C.notContact}, ${C.unplaced})`);
}
// [show, sides, reading, kind] -> v205's drawing: links in order (hash), drawn by verdict (taken from the v206 page)
const V205 = { '0,2,0,-1': [-610673691, [1994, 0, 0, 0]], '1,2,0,-1': [-1043718815, [1700, 293, 0, 0]], '2,2,0,-1': [2064466567, [1603, 290, 100, 0]],
  '3,2,0,-1': [-575510230, [1097, 204, 100, 591]], '2,0,1,-1': [-1394184300, [1772, 221, 0, 0]], '2,1,0,1': [1604330087, [1531, 365, 100, 0]], '3,2,1,4': [-864063212, [1388, 134, 100, 373]] };
for (const [k, [h, by]] of Object.entries(V205)) {
  const [show, sd, g, kind] = k.split(',').map(Number), s = N.select(R, N.run(N.judge(R, RS, LC, g, sd)), ORD, LC.lPlace, show, kind, 2000);
  ok(hash(s.list.concat(s.flagged)) === h && same(s.drawnBy, by), `the drawing for show ${show}, sides ${sd}, reading ${g}, kind ${kind}: v205's ${by.join(' + ')} links, in the same order`);
}

// ---- communities: the generator's, found again; the same every run (the seeded shuffle)
let t = Date.now();
const com = N.run(N.communities(R));
ok(com.length === P.L && com.every((c, l) => c === P.com[l]), `communities in the page: the generator's for all ${P.L} locations (${Date.now() - t} ms)`);
const base = { P, S };
const L2 = N.limit(base, { sup: 1, rel: 31, pls: 8191 });
const c1 = N.run(N.communities(L2.P)), c2 = N.run(N.communities(L2.P));
ok(c1.length === L2.P.L && c1.every((c, l) => c === c2[l]), `communities with two kinds of evidence or more: the same in two runs (${c1.length} locations)`);
// (in slices: a deadline that has passed makes it yield, and the result is the same)
N.T.until = 0;
let y = 0;
const gen = N.communities(L2.P);
let r;
while (!(r = gen.next()).done) y++;
N.T.until = Infinity;
ok(y > 5 && r.value.every((c, l) => c === c1[l]), `in ${y} slices: the same communities`);

// ---- the limits
ok(N.limit(base, N.LIM0) === base, 'every limit at its default: the map itself');
const nk = i => { let k = P.kind[i], c = 0; for (; k; k &= k - 1) c++; return c; };
let two = 0;
for (let i = 0; i < P.E; i++) if (nk(i) >= 2) two++;
ok(L2.P.E === two && L2.P.N === P.N, `least support two kinds: ${L2.P.E} links of ${P.E} (counted: ${two}), the same ${P.N} proteins`);
const noU = N.limit(base, { sup: 0, rel: 31 & ~2, pls: 8191 });
let placed = 0, unc = 0;
for (let p = 0; p < P.N; p++) { if (P.pl[p]) placed++; if (P.pl[p] && P.rel[p] === 1) unc++; }
let placed2 = 0;
for (let p = 0; p < P.N; p++) if (noU.P.pl[p]) placed2++;
ok(placed2 === placed - unc, `Uncertain not counted: ${placed2} proteins with a place (${placed} less ${unc} Uncertain)`);
const noCyt = N.limit(base, { sup: 0, rel: 31, pls: 8191 & ~1 });
let cyt = 0, only = 0;
for (let p = 0; p < P.N; p++) { if (P.pl[p] & 1) cyt++; if (P.pl[p] === 1) only++; }
ok(noCyt.P.L === P.L - cyt && (() => { let n = 0; for (let p = 0; p < P.N; p++) if (noCyt.P.pl[p]) n++; return n; })() === placed - only, `the cytosol not counted: ${cyt} locations fewer, ${only} proteins left without a place`);
// (each location keeps its side: ADRB2's plasma membrane)
const ad = P.sym.indexOf('ADRB2'), at = (Q, Sx) => { for (let l = Q.lOf[ad]; l < Q.lOf[ad + 1]; l++) if (Q.lPlace[l] === 9) return Sx.cls[l]; return -1; };
ok(at(noCyt.P, noCyt.S) === at(P, S) && at(P, S) === 6, 'ADRB2 keeps its side on the plasma membrane within limits (through it several times)');

// ---- reading a network
const rd = N.parse(['# a comment', 'gene_a\tgene_b\tscore\tkind', 'tp53\tMDM2\t0.9\tBinary', 'MDM2\tTP53\t0.5\tliterature', 'TP53\tTP53\t0.2\tbinary',
  'GRB2\tSOS1\tlots\tbinary', 'onlyone', '', 'P04637-2\t7157\t0.1\tbinary', 'ENSG00000141510.17\tGRB2\t0.3\tbinary'].join('\n'));
ok(!rd.error && rd.read === 8 && rd.comments === 1 && rd.hasScore && rd.hasKind && rd.header === 2, `read: 8 lines, a comment, line 2 a header, a score column and a kind column (${rd.read}, ${rd.comments}, ${rd.header})`);
ok(rd.errors.some(([n, w]) => n === 7 && /one identifier/.test(w)) && rd.errors.some(([n, w]) => n === 6 && /not a number/.test(w)), 'bad lines named by number: line 7 has one identifier, line 6 a score that is not a number');
const mapped = N.fromRows(rd, null, 'test');
// (gene_a gene_b: the header, found nowhere; tp53 any case; TP53-MDM2 twice one link with the best score and both kinds;
// the self-link kept; P04637-2 an isoform of TP53's accession; 7157 and the Ensembl id need the lookup)
ok(mapped.report.pairs === 3 && mapped.model.P.E === 3, `pairs kept without the lookup: ${mapped.report.pairs} (TP53-MDM2 once, TP53 with itself, GRB2-SOS1; the pairs with a gene number or an Ensembl id need the lookup)`);
ok(!mapped.report.missing.includes('gene_a') && mapped.report.missing.includes('7157') && mapped.report.missing.includes('ENSG00000141510.17'), 'not found: the gene number and the Ensembl id (no lookup); the header is no protein');
const M = mapped.model.P, tp = M.sym.indexOf('TP53'), md = M.sym.indexOf('MDM2');
const e = [...Array(M.E).keys()].find(i => (M.la[i] === tp && M.lb[i] === md) || (M.la[i] === md && M.lb[i] === tp));
ok(e !== undefined && M.sup[e] === Math.fround(0.9) && M.kind[e] === 3 && same(M.kindNames, ['Binary', 'Literature']), 'TP53-MDM2 given twice: one link, the best score (0.9), both kinds');
ok([...Array(M.E).keys()].some(i => M.la[i] === tp && M.lb[i] === tp), 'the self-link of TP53 kept');
const big = N.parse(Array.from({ length: N.MAX_LINES + 1 }, () => 'A\tB').join('\n'));
ok(/at most/.test(big.error || ''), `more than ${N.MAX_LINES} pairs refused in words: "${(big.error || '').slice(0, 60)}…"`);
{ // a hostile file: one long field (once a quadratic pattern: 80,000 digits took 10 s) refused by its length, in milliseconds
  const long = '1'.repeat(1e6), cases = [`TP53\tMDM2\t${long}`, `TP53\tMDM2\t${'1'.repeat(3000)}x`, `${'A'.repeat(3000)}\tMDM2`, `TP53\tMDM2\t0.5\nTP53\tGRB2\t${'9'.repeat(N.MAX_LINE - 20)}.`];
  let t = Date.now(); const rs = cases.map(c => N.parse(c)); t = Date.now() - t;
  ok(t < 200 && rs[0].error && /characters long/.test(rs[0].error) && /longer than/.test(rs[1].error) && /identifier longer/.test(rs[2].error) && rs[3].rows.length === 1 && rs[3].errors[0][0] === 2,
    `over-long lines and fields refused by number, in ${t} ms: "${rs[0].error.slice(0, 70)}…"`);
  let u = Date.now(); for (let i = 0; i < 50; i++) N.parse(`TP53\tMDM2\t${'1'.repeat(90)}x`); u = Date.now() - u;
  ok(u < 100, `the number pattern is linear: 50 near-numbers of 90 digits in ${u} ms`);
}
ok(N.parse('TP53,MDM2\nGRB2,SOS1').rows.length === 2 && N.parse('TP53 MDM2\nGRB2  SOS1').rows.length === 2, 'commas and spaces separate as tabs do');

// ---- with the lookup (data/lookup.json, gen_lookup.py)
const lkFile = path.join(here, '..', '..', 'data', 'lookup.json');
const LK = N.decodeLookup(JSON.parse(fs.readFileSync(lkFile, 'utf8')));
const xs = LK.x.sym.find((s, j) => LK.x.pl[j] && LK.x.acc[j]), xj = LK.x.sym.indexOf(xs);
const withLk = N.fromRows(N.parse(`TP53\tMDM2\n7157\tGRB2\nENSG00000141510\tSOS1\nP04637\tRELA\n${xs}\tTP53\nNOTAGENE\tTP53`), LK, 'lookup');
const W = withLk.model.P;
ok(withLk.report.pairs === 5 && withLk.report.missing.length === 1 && withLk.report.missing[0] === 'NOTAGENE', `with the lookup: a gene number, an Ensembl id, an accession and ${xs} (a gene the Atlas lists outside the map) found; NOTAGENE not`);
const xi = W.sym.indexOf(xs);
ok(xi >= 0 && W.pl[xi] === LK.x.pl[xj] && withLk.report.inMap === 5, `${xs} carries the Atlas's places from the lookup (${W.pl[xi].toString(2)}); the other five proteins are the map's`);

// ---- the judgement on a chosen network, against verdicts checked by hand (carried sides, strict reading):
//   GRB2-SOS1 both in the cytosol: possible; CALR (ER lumen) - RELA (cytosol): through a gate (import into the ER);
//   APOH (Golgi lumen, signal peptide) - GRB2 (cytosol): impossible (no gate from the Golgi lumen to the cytosol);
//   CYCS (the mitochondria's gap) - SLC25A4 (through the inner membrane: gap and matrix): possible; CYCS - RELA: through a
//   gate (cytosol to the gap); APOH - CALR: through a gate (ER to Golgi); EGFR (through the plasma membrane and the Golgi
//   membrane) - GRB2: possible (the cytosol's side); TP53 with itself: possible
const HAND = [['GRB2', 'SOS1', 0], ['CALR', 'RELA', 1], ['APOH', 'GRB2', 2], ['CYCS', 'SLC25A4', 0], ['CYCS', 'RELA', 1], ['APOH', 'CALR', 1], ['EGFR', 'GRB2', 0], ['TP53', 'TP53', 0]];
const hm = N.fromRows(N.parse(HAND.map(([a, b]) => `${a}\t${b}`).join('\n')), null, 'hand'), H = hm.model, HL = N.locs(H.P), J = N.run(N.judge(H.P, H.S, HL, 0, 2));
for (const [a, b, v] of HAND) {
  const pa = H.P.sym.indexOf(a), pb = H.P.sym.indexOf(b), i = [...Array(H.P.E).keys()].find(k => (H.P.la[k] === pa && H.P.lb[k] === pb) || (H.P.la[k] === pb && H.P.lb[k] === pa));
  ok(J.cls[i] === v, `${a}-${b}: ${['possible', 'through a gate', 'impossible'][J.cls[i]] || 'grey'} (by hand: ${['possible', 'through a gate', 'impossible'][v]})`);
}
// (and the same as the map's own judgement of those links)
let agree = 0, there = 0;
for (let i = 0; i < P.E; i++) {
  const a = P.sym[P.la[i]], b = P.sym[P.lb[i]], k = HAND.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
  if (k >= 0 && P.contact(i)) { there++; agree += S.judge(i, false, true) === HAND[k][2] ? 1 : 0; }
}
ok(there >= 3 && agree === there, `the map's own links among them (${there}) judged alike`);
// (the example file reads and maps whole)
const ex = N.fromRows(N.parse(fs.readFileSync(path.join(here, '..', '..', 'data', 'example.txt'), 'utf8')), LK, 'example');
ok(ex.report.missing.length === 0 && ex.report.pairs > 1000 && same(ex.report.idKinds, ['sym', 'acc']), `the example: ${ex.report.pairs} pairs, ${ex.report.found} proteins, all found; columns read as symbols and UniProt accessions`);

// ---- stage 3: the shared form (PNET.toDoc, docError, fromDoc), as the relay keeps it: the same network back, to the
// last link, its order, kinds, scores and sides, with and without a protein from the lookup
const eqModel = (m, n) => m.P.N === n.P.N && m.P.E === n.P.E && same(m.P.sym, n.P.sym) && same(Array.from(m.P.la), Array.from(n.P.la)) && same(Array.from(m.P.lb), Array.from(n.P.lb)) &&
  same(Array.from(m.P.kind), Array.from(n.P.kind)) && same(Array.from(m.P.sup), Array.from(n.P.sup)) && same(Array.from(m.P.pl), Array.from(n.P.pl)) && same(m.P.supSteps.map(x => x.label), n.P.supSteps.map(x => x.label)) &&
  same(Array.from(m.S.cls), Array.from(n.S.cls)) && same(m.S.cx.map(c => c.ac + c.members.join()), n.S.cx.map(c => c.ac + c.members.join())) && same(m.P.kindNames, n.P.kindNames);
for (const [what, m, lk] of [['the example', ex.model, LK], ['the lookup test (a gene outside the map)', withLk.model, LK], ['the hand-picked pairs', H, null]]) {
  const d = JSON.parse(JSON.stringify(N.toDoc(m, what))), back = N.run(N.fromDoc(d, N.docNeedsLookup(d) ? lk : null));
  ok(N.docError(d) === '' && back.model && eqModel(m, back.model) && back.report.missing.length === 0, `${what}: shared as ${JSON.stringify(d).length} bytes, read back the same network (${m.P.N} proteins, ${m.P.E} links, kinds, sides, complexes)`);
}
{
  // (scores: a network with a score column; and a name not found leaves its links out, counted)
  const sc = N.fromRows(N.parse('a\tb\tscore\nTP53\tMDM2\t0.9\nGRB2\tSOS1\t0.123456789\nEGFR\tGRB2\t\nRELA\tNFKB1\t0.5'), null, 'scores').model;
  const d = JSON.parse(JSON.stringify(N.toDoc(sc, 'scores'))), back = N.run(N.fromDoc(d, null));
  ok(d.s && d.s.includes(null) && eqModel(sc, back.model), `scores kept to the Float32 (${d.s.join(', ')}), a link without one as null`);
  const d2 = JSON.parse(JSON.stringify(d)); d2.prot[0] = 'NOTAGENE';
  const b2 = N.run(N.fromDoc(d2, null));
  ok(b2.report.missing.join() === 'NOTAGENE' && b2.report.dropped >= 1 && b2.model.P.E === sc.P.E - b2.report.dropped, `a name not found: its ${b2.report.dropped} link(s) left out and said`);
  const bads = [[{}, 'v'], [Object.assign({}, d, { name: '' }), 'name'], [Object.assign({}, d, { a: d.a.concat(0) }), 'a, b, k'], [Object.assign({}, d, { k: d.k.map(() => 9) }), 'kind bits'],
    [Object.assign({}, d, { b: d.b.map(() => 99) }), 'not in prot'], [Object.assign({}, d, { s: d.s.map(() => 'x') }), 'score']];
  ok(bads.every(([x, w]) => N.docError(x).includes(w) || (w === 'v' && N.docError(x))), 'a bad shared network refused in words: ' + bads.map(([x]) => N.docError(x)).join('; '));
}
// (the built-in map itself as a shared network: the largest the size limit is set from)
{
  const MAPN = { P: R, S: RS, score: false };
  const d = N.toDoc(MAPN, 'the built-in map'), txt = JSON.stringify(d);
  let t1 = Date.now(); const back = N.run(N.fromDoc(JSON.parse(txt), null)); t1 = Date.now() - t1;
  ok(N.docError(d) === '' && back.model.P.E === P.E && back.model.P.N === P.N && back.report.dropped === 0, `the built-in map as a shared network: ${(txt.length / 1e6).toFixed(2)} MB, read back in ${t1} ms with all ${P.E} links`);
}
console.log(bad ? `${bad} failed` : 'all ok');
process.exit(bad ? 1 : 0);
