// Writes ../../data/example.txt: the Network tab's example network (Try an example), cut from the map itself: GRB2 and
// its partners with at least two kinds of evidence, and the links among them with at least two. Each line: a protein
// by its gene symbol, its partner by its UniProt accession (so the example shows two kinds of identifier), the number
// of kinds of evidence as a score, and the first kind as a word. Derived from the map (PDATA, PSIDES) only.
// usage: node packages/ppicell/src/data/gen_example.mjs [--check]
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), require = createRequire(import.meta.url);
const P = require('../sets/pdata.js'), S = require('../sets/psides.js');
const out = path.join(here, '..', '..', 'data', 'example.txt'), HUB = 'GRB2', MIN = 2;
const hub = P.sym.indexOf(HUB), nk = i => { let k = P.kind[i], c = 0; for (; k; k &= k - 1) c++; return c; };
// (the first kind that is a contact: regulatory and metabolic only when the link has no other)
const word = i => { for (const k of [1, 2, 4, 5, 6, 0, 3]) if (P.kind[i] >> k & 1) return P.kinds[k]; return ''; };
const near = new Set([hub]);
for (let i = 0; i < P.E; i++) if (nk(i) >= MIN && (P.la[i] === hub || P.lb[i] === hub)) near.add(P.la[i] === hub ? P.lb[i] : P.la[i]);
const lines = [];
for (let i = 0; i < P.E; i++) {
  const a = P.la[i], b = P.lb[i];
  if (nk(i) < MIN || !near.has(a) || !near.has(b) || !S.acc[b]) continue;
  lines.push([P.sym[a], S.acc[b], nk(i), word(i)].join('\t'));
}
const text = `# An example network for "Back into the cell" (the Network tab): ${HUB} and its partners with at least ${MIN} kinds of
# evidence in the built-in map (Menche et al. 2015), and the links among them with at least ${MIN}. Cut from the map by
# src/data/gen_example.mjs. Columns: a gene symbol, a UniProt accession, a score (here how many kinds of evidence the
# map has for the link) and a kind (the first of them that suggests contact).
protein_a\tprotein_b\tscore\tkind
${lines.join('\n')}
`;
if (process.argv.includes('--check')) {
  const same = fs.existsSync(out) && fs.readFileSync(out, 'utf8') === text;
  console.log(same ? 'data/example.txt is current' : 'data/example.txt is out of date: run gen_example.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(out, text);
console.log(`wrote data/example.txt: ${near.size} proteins, ${lines.length} links`);
