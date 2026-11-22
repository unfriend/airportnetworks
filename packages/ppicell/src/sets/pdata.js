// PDATA: the story's data (PPI_DATA, src/sets/data.js, generated) decoded once, and the method's rules, shared by the
// sets and checked in Node by src/data/test-data.mjs. The interactome of Menche et al. (2015) and the Human Protein
// Atlas's locations onto the cell map's 13 places; every number the story shows is computed from these.
const PDATA = (() => {
  const D = typeof PPI_DATA !== 'undefined' ? PPI_DATA : require('./data.js');
  const bytes = s => (typeof atob === 'function' ? Uint8Array.from(atob(s), c => c.charCodeAt(0)) : new Uint8Array(Buffer.from(s, 'base64')));
  const u16 = s => { const b = bytes(s); return new Uint16Array(b.buffer, b.byteOffset, b.length / 2); };
  const sym = D.sym.split('|'), pl = u16(D.pl), main = u16(D.main), rel = Uint8Array.from(D.rel, c => +c);
  const lb = bytes(D.links), E = lb.length / 5, la = new Uint16Array(E), lbb = new Uint16Array(E), kind = new Uint8Array(E);
  for (let i = 0; i < E; i++) { la[i] = lb[5 * i] | lb[5 * i + 1] << 8; lbb[i] = lb[5 * i + 2] | lb[5 * i + 3] << 8; kind[i] = lb[5 * i + 4]; }
  // locations: one per protein and place it is in (17,935), in protein order then place order, as gen_data.py writes
  // the communities; lOf[p] is protein p's first, lOf[p + 1] the one after its last
  const com = u16(D.com), L = com.length, lProt = new Uint16Array(L), lPlace = new Uint8Array(L), lOf = new Uint32Array(sym.length + 1);
  for (let p = 0, l = 0; p < sym.length; p++) { lOf[p] = l; for (let k = 0; k < 13; k++) if (pl[p] >> k & 1) { lProt[l] = p; lPlace[l++] = k; } lOf[p + 1] = l; }
  // spaces: 0 cytosol, 1 nucleoplasm, 2 ER lumen, 3 Golgi lumen, 4 mitochondrial matrix, 5 lysosome, 6 endosome,
  // 7 peroxisome, 8 outside the cell; each place's inner space and its membrane's other side (-1: no membrane)
  const INNER = [0, 1, 1, 2, 3, 4, 5, 6, 7, 0, 1, 0, 0], OUTER = [-1, -1, -1, 0, 0, 0, 0, 0, 0, 8, 0, -1, -1];
  // gates: two spaces one known crossing apart (nuclear pores; import into the ER, mitochondria and peroxisomes;
  // vesicles along the secretory and endocytic ways)
  const GATES = [[0, 1], [0, 2], [0, 4], [0, 7], [2, 3], [3, 8], [3, 5], [6, 5], [8, 6]];
  const GATE = new Set(GATES.flatMap(([a, b]) => [a * 9 + b, b * 9 + a]));
  // a places mask's spaces as a mask of 9 bits: strict, a place's inner space; generous, its membrane's other side too
  const spaces = (mask, generous) => {
    let s = 0;
    for (let p = 0; p < 13; p++) if (mask >> p & 1) { s |= 1 << INNER[p]; if (generous && OUTER[p] >= 0) s |= 1 << OUTER[p]; }
    return s;
  };
  const gated = (sa, sb) => { for (let a = 0; a < 9; a++) if (sa >> a & 1) for (let b = 0; b < 9; b++) if (sb >> b & 1 && GATE.has(a * 9 + b)) return true; return false; };
  // a link's judgement from its two proteins' places: 0 possible (a shared space), 1 through a gate, 2 impossible; -1 an
  // end without a place
  const judge = (ma, mb, generous) => {
    if (!ma || !mb) return -1;
    const sa = spaces(ma, generous), sb = spaces(mb, generous);
    return sa & sb ? 0 : gated(sa, sb) ? 1 : 2;
  };
  // kinds: bit i is D.kinds[i]; regulatory (0) and metabolic (3) alone are not contacts
  const NONCONTACT = 1 << 0 | 1 << 3;
  const contact = i => (kind[i] & ~NONCONTACT) !== 0;
  return { D, sym, pl, main, rel, E, la, lb: lbb, kind, L, com, lProt, lPlace, lOf, N: sym.length, places: D.places, kinds: D.kinds, INNER, OUTER, GATES, spaces, judge, contact };
})();
if (typeof module !== 'undefined') module.exports = PDATA;
