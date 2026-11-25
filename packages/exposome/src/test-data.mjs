// Checks the exposome story's generated data (src/sets/data.js and data/*.bin, from src/data/gen_data.py) and its
// accessor (src/sets/xdata.js, XDATA) against the paper's headline numbers and for internal consistency. A number the
// data gives differently from the paper is checked at the data's value and listed at the end (SPEC.md, "Numbers").
// usage: node packages/exposome/src/test-data.mjs
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), require = createRequire(import.meta.url);
const X = require('./sets/xdata.js'), M = X.meta;
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => ok(a === b, `${m}: ${a} (expected ${b})`);
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m}: ${a} (expected ${b} +- ${tol})`);
const toBuf = f => { const b = fs.readFileSync(path.join(here, '..', 'data', f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
for (const [k, f] of Object.entries(X.FILES)) X.take(k, k === 'names' ? fs.readFileSync(path.join(here, '..', 'data', 'names.json'), 'utf8') : toBuf(f.slice(5)));

// ---- the paper's numbers (SCRIPT.md's brackets)
eq(M.nSubst, 9887, 'substances with genes');
eq(M.nNet, 9764, 'network nodes');
eq(M.nEdges, 736470, 'network links');
eq(M.nPairs, 573673, 'substance-gene pairs (the paper: 573,674)');
eq(M.nGenes, 25579, 'genes (the paper: 25,580)');
eq(M.bapGenes, 16470, 'benzo(a)pyrene\'s genes');
eq(X.label[X.ex.bap], 'Benzo(a)pyrene', 'benzo(a)pyrene\'s name');
eq(M.topGenes[0][0] + ' ' + M.topGenes[0][1], 'CASP3 1701', 'the most disturbed gene');
const cl = Object.fromEntries(M.classes.names.map((nm, i) => [nm, M.classes.count[i]]));
eq(cl['Organic Chemicals'], 5594, 'organic chemicals'); eq(cl['Heterocyclic Compounds'], 3950, 'heterocyclic'); eq(cl['Polycyclic Compounds'], 1621, 'polycyclic');
eq(M.levels.raw.join('/'), '125/152/456', 'Louvain levels (the paper\'s 125, 152, 456)');
eq(M.levels.named.join('/'), '13/50/456', 'the deposit\'s named levels');
eq(M.maxDeg, 1084, 'the best linked substance (crocin)');
eq(X.label[X.ex.crocin], 'crocin', 'crocin');
eq(M.ppi.proteins, 18815, 'interactome proteins'); eq(M.ppi.links, 482935, 'interactome links');
const pc = k => Math.round(100 * M.pattern.count[k] / M.pattern.of);
eq([0, 1, 2, 3].map(pc).join('/'), '43/15/8/34', 'patterns (per cent)');
eq(M.pattern.of, 9852, 'substances in the interactome');
near(M.hazard.r, 0.24, 0.005, 'hazard against the best connected target (r)');
eq(M.hazard.n, 3165, 'substances with a hazard score');
ok(M.pattern.hazard[0] > M.pattern.hazard[1] && M.pattern.hazard[1] > Math.max(M.pattern.hazard[2], M.pattern.hazard[3]), 'hazard: central module, then hubs, highest');
eq(M.dis.n, 6177, 'diseases'); eq(M.dis.tested, 60855804, 'pairs tested'); eq(M.dis.near, 1601884, 'pairs significantly close');
eq(M.dis.overlap, 28403, 'pairs by shared genes alone'); eq(M.dis.close, 176259, 'pairs with z < -5');
eq(M.countries.n, 32, 'countries'); eq(M.countries.airSig + '/' + M.countries.airOf, '17/24', 'air: close diseases more frequent');
eq(M.countries.waterSig + '/' + M.countries.waterOf, '15/23', 'water (the paper: 16 of 23)');
const it = X.countries.find(c => c.name === 'Italy');
eq(it.risk[0], 57, 'Italy\'s substances');
const gb = X.ex.endrinItaly.gbd['Colon and rectum cancer'];
near(gb[0], 4.05, 0.005, 'colon and rectum cancer in Italy against the world'); near(gb[1], 1.14, 0.006, 'against western Europe');
ok(it.water.includes(X.ex.endrin) || it.air.includes(X.ex.endrin), 'endrin stands out in Italy');
ok(X.ex.endrinClose.some(r => r[0] === 'Colorectal Carcinoma'), 'colorectal carcinoma is close to endrin');
eq(X.ex.clot.members.length, 21, 'the clotting community');
for (const s of ['argatroban', 'melagatran', 'ximelagatran', 'lepirudin', 'Clobazam', 'calcium heparin', 'Dalteparin', 'Ioxaglic Acid']) ok(X.ex.clot.members.some(i => X.label[i] === s), 'clotting community holds ' + s);
for (const s of ['calcium heparin', 'Contraceptives, Oral, Combined', 'Ioxaglic Acid', 'Clobazam']) ok(X.ex.clot.serpinc1.some(i => X.label[i] === s), s + ' touches SERPINC1');
eq(X.comm.id[X.comm.byLevel[2][X.ex.clot.comm]], '11_2_1', 'the clotting community\'s id');
near(X.ex.ozoneAsthma.z, -5.74, 0.005, 'ozone and asthma (z)');

// ---- the accessor and the files agree
eq(X.label.length, M.nSubst, 'a label each');
let pairs = 0;
for (let i = 0; i < X.N; i++) { const t = X.targets(i); pairs += t.length; if (t.length !== X.ngenes[i]) { ok(false, 'genes of ' + i); break; } }
eq(pairs, M.nPairs, 'targets.bin holds every pair');
eq(X.gene.sym(X.targets(X.ex.bap)[0]), 'CASP3', 'genes most studied first');
eq(X.subsOfGene('CASP3').length, 1701, 'CASP3\'s substances from targets.bin');
eq(X.ppi.N, 18815, 'ppi.bin\'s proteins'); eq(X.ppi.head.links, 482935, 'ppi.bin\'s true link count');
ok(X.ppi.deg[0] >= X.ppi.deg[X.ppi.N - 1], 'best connected first');
ok(X.ppi.links.length / 2 <= 30000, 'interactome links drawn: at most 30,000');
let inCell = 0; for (let p = 0; p < X.ppi.N; p++) if (X.ppi.place[p] < 14) inCell++;
eq(inCell, X.ppi.head.inCell, 'proteins in the model cell');
eq(X.dis.N, 6177, 'diseases.bin');
eq(X.dis.genes(X.dis.find('Asthma')).length, X.ex.ozoneAsthma.diseaseGenes, 'asthma\'s genes');
const oz = X.dis.closeOf(X.ex.ozone);
eq(oz.length, X.close[X.ex.ozone], 'ozone\'s close diseases');
ok(oz.some(r => X.dis.name(r.d) === 'Asthma' && Math.abs(r.z + 5.74) < 0.006 && r.cit === X.ex.ozoneAsthma.cit), 'ozone and asthma among them');
ok(oz.every((r, j) => j === 0 || oz[j - 1].z <= r.z), 'closest first');
const as = X.dis.closeTo(X.dis.find('Asthma'));
eq(as.length, X.ex.ozoneAsthma.asthmaCloseSubs, 'asthma\'s close substances');
let tot = 0; for (let d = 0; d < X.dis.N; d++) tot += X.dis.closeTo(d).length;
eq(tot, M.dis.close, 'every close pair by disease');
let nearSum = 0; for (let i = 0; i < X.N; i++) nearSum += X.near[i];
eq(nearSum, M.dis.near, 'near counts add up');
// communities: sizes add up, parents nest, colours and the network's members
for (let lv = 0; lv < 3; lv++) eq(X.comm.byLevel[lv].reduce((s, k) => s + X.comm.size[k], 0), M.nNet, `level ${lv} covers the network`);
ok(X.comm.byLevel[2].every(k => X.comm.lv[X.comm.parent[k]] === 1) && X.comm.byLevel[1].every(k => X.comm.lv[X.comm.parent[k]] === 0), 'levels nest');
eq(X.members(X.comm.byLevel[0][0]).length, X.comm.size[X.comm.byLevel[0][0]], 'the largest group\'s members');
ok(X.commOf(X.N - 1, 0) === -1, 'a substance without links has no community');
const labels = JSON.parse(fs.readFileSync(path.join(here, 'data', 'labels.json'), 'utf8'));
for (const [lv, key] of [[0, 'top'], [1, 'mid'], [2, 'fine']]) for (const id of Object.keys(labels[key])) ok(X.comm.find(lv, id) >= 0 && X.comm.label[X.comm.find(lv, id)] === labels[key][id], `label ${key} ${id}`);
ok(X.comm.label[X.comm.find(0, '18')] === 'blood clotting', 'group 18: blood clotting');
// positions inside their boxes; every network node placed
let bad = 0; for (let j = 0; j < X.pos.length; j++) if (!(Math.abs(X.pos[j]) <= 1.0001)) bad++;
eq(bad, 0, 'layout within [-1, 1]');
eq(X.links.length / 2, M.drawn, 'links drawn'); ok(M.drawn <= 50000, 'at most 50,000 links drawn');
ok(Array.from(X.links).every(v => v < M.nNet), 'links between network nodes');
eq(X.find('ozone')[0], X.ex.ozone, 'search: ozone');
eq(X.find('benzo(a)pyrene')[0], X.ex.bap, 'search: benzo(a)pyrene');
for (const c of X.countries) ok(c.lat > 30 && c.lat < 72 && c.lon > -25 && c.lon < 40, 'a European place for ' + c.name);
// the size limits (SPEC.md)
const sz = f => fs.statSync(path.join(here, f)).size;
ok(sz('sets/data.js') < 1.5e6, 'embedded data under 1.5 MB');
const od = ['targets.bin', 'ppi.bin', 'diseases.bin', 'names.json'].reduce((s, f) => s + sz('../data/' + f), 0);
ok(od < 4e6, `on-demand files under 4 MB (${od})`);
console.log(fails ? `${fails} of ${n} checks failed` : `all ${n} checks passed`);
console.log('as the data gives it (the paper differs): pairs 573,673 (573,674); genes 25,579 (25,580); water 15 of 23 (16); next genes after CASP3: ' +
  M.topGenes.slice(1, 3).map(g => `${g[0]} ${g[1]}`).join(', ') + ' (the script: BCL2, BAX); hazard score for ' + Math.round(100 * M.hazard.n / M.hazard.of) + ' % (47 %: found in NORMAN, with or without a score)');
process.exit(fails ? 1 : 0);
