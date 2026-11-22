// Checks the story's data in Node: PDATA (src/sets/pdata.js) decodes PPI_DATA (src/sets/data.js) and recomputes the
// split of the links (possible, through a gate, impossible; strict and generous) exactly as gen_data.py did.
// usage: node packages/ppicell/src/data/test-data.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const P = require('../sets/pdata.js');
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
ok(P.N === P.D.nGenes && P.E === P.D.nLinks, `${P.N} genes, ${P.E} links`);
ok(P.pl.filter(m => m).length === P.D.placed, `${P.D.placed} genes with a place`);
for (const g of [false, true]) {
  const c = [0, 0, 0];
  for (let i = 0; i < P.E; i++) if (P.contact(i)) { const j = P.judge(P.pl[P.la[i]], P.pl[P.lb[i]], g); if (j >= 0) c[j]++; }
  const want = P.D.check.split[g ? 'generous' : 'strict'];
  ok(c.join() === want.join(), `${g ? 'generous' : 'strict'}: ${c.join(', ')} (gen_data.py: ${want.join(', ')})`);
}
let nc = 0, un = 0;
for (let i = 0; i < P.E; i++) { if (!P.contact(i)) nc++; else if (!P.pl[P.la[i]] || !P.pl[P.lb[i]]) un++; }
ok(nc === P.D.check.notContact && un === P.D.check.unplaced, `${nc} not contacts, ${un} with an end without a place`);
ok(P.sym[P.sym.indexOf('TP53')] === 'TP53', 'TP53 is in it');
// the communities: one per location, numbered within each place by size (0 the largest), as many as gen_data.py counted
let nl = 0;
for (let p = 0; p < P.N; p++) for (let m = P.pl[p]; m; m &= m - 1) nl++;
ok(P.L === nl && P.lOf[P.N] === nl, `${P.L} locations, one community number each`);
const sizes = Array.from({ length: 13 }, () => new Map());
for (let l = 0; l < P.L; l++) { const m = sizes[P.lPlace[l]]; m.set(P.com[l], (m.get(P.com[l]) || 0) + 1); }
const counts = sizes.map(m => m.size), tops = sizes.map(m => Math.max(0, ...m.values()));
const dense = sizes.every(m => [...m.keys()].every(c => c < m.size));
const bySize = sizes.every(m => { const v = [...Array(m.size).keys()].map(c => m.get(c)); return v.every((x, i) => !i || x <= v[i - 1]); });
ok(counts.join() === P.D.check.coms.join() && tops.join() === P.D.check.comTop.join(), `communities per place ${counts.join(', ')}; largest ${tops.join(', ')}`);
ok(dense && bySize, 'numbered 0 to n - 1 in each place, the largest first');
ok(P.lProt.every((p, l) => P.pl[p] >> P.lPlace[l] & 1), 'every location is a place its protein is in');
process.exit(bad ? 1 : 0);
