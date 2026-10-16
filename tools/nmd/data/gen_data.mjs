// Turns the analysis files in ikerdata/ into the data block of the muscle story (tools/nmd/sets/data.js).
// usage (from the repository root): node tools/nmd/data/gen_data.mjs
// Inputs (Iker Núñez-Carpintero and Philipp Friedrich, LBI Network Medicine; no patient data):
//   <group>_Multiplex_Metadata.tsv  the 13 disease groups: gene, endotype (Cluster), seed ('Disease Gene', from the
//                                   2024 Gene Table of Neuromuscular Disorders) or 'RWR Added'
//   iker_nodes.tsv                  15,817 genes of the protein layers, with GO, HPO, KEGG and Reactome annotations
//   iker_edges.tsv                  488,793 interactions (IID): the layers each one is in (core + 26 tissues)
//   Overlaps_..._Network.tsv        the Congenital Myopathies x Hereditary Cardiomyopathies overlap in 26 mixed layers
// Computed here, on these files: each group's layer z-score in every protein layer (largest connected component of
// its seed genes against 1,000 random gene sets with the same numbers of links), the visiting probabilities of a random walk with
// restart over the protein layers (restart 0.7, layer switch 0.5, weighted by the z-scores), a GO-based name for
// every endotype, and a fixed 2D layout. Everything is deterministic.
import fs from 'fs';
import path from 'path';
const here = path.dirname(new URL(import.meta.url).pathname), root = path.join(here, '../../..');
const DIR = path.join(root, 'ikerdata');
const tsv = f => {
  const lines = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(l => l.length);
  const head = lines[0].split('\t');
  return lines.slice(1).map(l => { const c = l.split('\t'), o = {}; head.forEach((h, i) => { o[h] = c[i] === undefined ? '' : c[i]; }); return o; });
};
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };

// ----------------------------------------------------------------- groups --
// the 13 groups (the 2024 Gene Table's 16, small ones joined to the group they overlap most), short names, colours
const GROUPS = [
  ['Motor Neuron Diseases', 'Motor neuron', '#ff5a4b', 'neuron'],
  ['Hereditary Motor and Sensory Neuropathies', 'Motor & sensory nerve', '#ff8a3d', 'nerve'],
  ['Hereditary Ataxias', 'Ataxias', '#ffb43b', 'neuron'],
  ['Hereditary Paraplegias', 'Paraplegias', '#e6d23c', 'neuron'],
  ['Congenital Myasthenic Syndromes', 'Myasthenic syndromes', '#3ee08f', 'junction'],
  ['Congenital Myopathies', 'Congenital myopathies', '#46d9ff', 'muscle'],
  ['Distal Myopathies', 'Distal myopathies', '#4d94ff', 'muscle'],
  ['Metabolic Myopathies', 'Metabolic myopathies', '#2fc4b2', 'muscle'],
  ['Other Myopathies', 'Other myopathies', '#8fa8ff', 'muscle'],
  ['Muscular Dystrophies', 'Muscular dystrophies', '#b07bff', 'muscle'],
  ['Congenital Muscular Dystrophies', 'Congenital dystrophies', '#d77bff', 'muscle'],
  ['Hereditary Cardiomyopathies', 'Cardiomyopathies', '#ff5ad9', 'heart'],
  ['Other Neuromuscular Disorders', 'Other disorders', '#9aa8bb', 'muscle'],
];
const meta = GROUPS.map(([name]) => tsv(`${name}_Multiplex_Metadata.tsv`));

// ------------------------------------------------------------------ genes --
const geneIdx = new Map(), genes = [];
const gi = s => { if (!geneIdx.has(s)) { geneIdx.set(s, genes.length); genes.push({ sym: s, endo: new Array(GROUPS.length).fill(0), seed: 0, added: 0 }); } return geneIdx.get(s); };
meta.forEach((rows, g) => rows.forEach(r => {
  const i = gi(r.Node), G = genes[i];
  G.endo[g] = +r.Cluster;
  if (r.Origin === 'Disease Gene') G.seed |= 1 << g; else G.added |= 1 << g;
}));
const N = genes.length;

// annotations from the nodes file (genes without protein interactions are not in it)
const nodes = tsv('iker_nodes.tsv'), allIdx = new Map(nodes.map((x, i) => [x.id, i]));
// GO and HPO terms end with their id in brackets, so they split after it; KEGG names have no commas
const terms = (s, col) => (s ? s.split(/_KEGG/.test(col) ? ',' : /(?<=\)),/).map(t => t.trim()).filter(Boolean) : []);
const goName = t => t.replace(/\s*\(GO:\d+\)$/, '');
// GO and KEGG names come in Title Case: keep the first word, acronyms (DNA, RNA II), N-linked and proper names
const PROPER = new Set(['Golgi', 'Notch', 'Wnt', 'Hedgehog', 'Toll', 'Ras', 'Rho', 'Rac', 'Fc', 'Schwann', 'Purkinje', 'Ranvier', 'Huntington', 'Parkinson', 'Alzheimer']);
const keepCase = x => /[A-Z]{2}/.test(x) || /^[A-Z][-\d]/.test(x) || /\d[A-Z]/.test(x) || PROPER.has(x.replace(/[^A-Za-z]/g, ''));
const sentence = t => t.split(' ').map((x, k) => (k && !keepCase(x) ? x.toLowerCase() : x)).join(' ');
const ann = {};
for (const col of ['_GO_Biological_Process_2025_a', '_Human_Phenotype_Ontology_a', '_KEGG_2026_a', '_Reactome_Pathways_2024_a']) {
  const freq = new Map();
  for (const x of nodes) for (const t of terms(x[col], col)) freq.set(t, (freq.get(t) || 0) + 1);
  ann[col] = { freq, of: s => (allIdx.has(s) ? terms(nodes[allIdx.get(s)][col], col) : []) };
}
// the most specific terms (fewest genes, but shared by at least 5) say most about a gene
const specific = (col, s, k) => ann[col].of(s).filter(t => ann[col].freq.get(t) >= 5).sort((a, b) => ann[col].freq.get(a) - ann[col].freq.get(b)).slice(0, k);

// ----------------------------------------------------------------- layers --
const PPI_T = ['adipose_tissue', 'adrenal_gland', 'amygdala', 'bone', 'bone_marrow', 'brain', 'dorsal_root_ganglia', 'heart', 'hypothalamus',
  'kidney', 'liver', 'lung', 'lymph_nodes', 'mammary_gland', 'ovary', 'pancreas', 'pituitary_gland', 'placenta', 'prostate', 'salivary_gland',
  'skeletal_muscle', 'small_intestine', 'spleen', 'stomach', 'testes', 'uterus'];
const COEX = [['core', 'Core (in many tissues)'], ['ADS', 'Adipose, subcutaneous'], ['ADV', 'Adipose, visceral'], ['ARG', 'Adrenal gland'],
  ['ATA', 'Artery, aorta'], ['ATC', 'Artery, coronary'], ['ATT', 'Artery, tibial'], ['BRB', 'Brain, basal ganglia'], ['BRC', 'Brain, cerebellum'],
  ['BRO', 'Brain, other regions'], ['BST', 'Breast'], ['CLS', 'Colon, sigmoid'], ['CLT', 'Colon, transverse'], ['EMC', 'Oesophagus, mucosa'],
  ['EMS', 'Oesophagus, muscle'], ['FIB', 'Fibroblasts'], ['GEJ', 'Gastro-oesophageal junction'], ['HRA', 'Heart, atrium'], ['HRV', 'Heart, left ventricle'],
  ['ITI', 'Small intestine, ileum'], ['KDN', 'Kidney cortex'], ['LCL', 'Lymphoblastoid cells'], ['LNG', 'Lung'], ['LVR', 'Liver'],
  ['MSG', 'Minor salivary gland'], ['OVR', 'Ovary'], ['PIT', 'Pituitary'], ['PNC', 'Pancreas'], ['PRS', 'Prostate'], ['SKN', 'Skin'],
  ['SMU', 'Skeletal muscle'], ['SPL', 'Spleen'], ['STM', 'Stomach'], ['THY', 'Thyroid'], ['TNV', 'Tibial nerve'], ['TST', 'Testis'],
  ['UTR', 'Uterus'], ['VGN', 'Vagina'], ['WBL', 'Whole blood']];
const nice = s => s.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
// [key, display name, category]; categories: pheno, path, drug, ess, coex, ppi. Top of the tower first.
const LAYERS = [['HP', 'Human phenotypes (HPO)', 'pheno'], ['MP', 'Mouse phenotypes (MPO)', 'pheno'],
  ['reactome_copathway', 'Shared pathways (Reactome)', 'path'], ['drugs_NedRex', 'Shared drug targets (NeDRex)', 'drug'],
  ['co-essential', 'Essential together (CRISPR screens)', 'ess'],
  ...COEX.map(([c, n]) => ['coex_' + c, n, 'coex']),
  ['ppi_core', 'Core (in more than 24 tissues)', 'ppi'], ...PPI_T.map(t => ['ppi_' + t, nice(t), 'ppi'])];
const LI = new Map(LAYERS.map((l, i) => [l[0], i]));
const PPI = LAYERS.map((l, i) => [l, i]).filter(([l]) => l[2] === 'ppi').map(([, i]) => i);   // tower indices of the 27 protein layers
const ppiKey = t => (t === 'core' ? 'ppi_core' : 'ppi_' + t);

// ----------------------------------------------- the protein layers, in full --
const edgesAll = tsv('iker_edges.tsv');
const NA = nodes.length, P = PPI.length;
const pOf = new Map(PPI.map((li, p) => [LAYERS[li][0], p]));
const adj = Array.from({ length: P }, () => Array.from({ length: NA }, () => []));
const sub = new Map();                      // module subgraph: "i,j" -> 27-bit mask over PPI
for (const e of edgesAll) {
  const a = allIdx.get(e.source), b = allIdx.get(e.target);
  let mask = 0;
  for (const t of e._layers_a.split(';')) { if (!t) continue; const p = pOf.get(ppiKey(t)); mask |= 1 << p; adj[p][a].push(b); adj[p][b].push(a); }
  const ia = geneIdx.get(e.source), ib = geneIdx.get(e.target);
  if (ia !== undefined && ib !== undefined && ia !== ib) {
    const k = ia < ib ? ia + ',' + ib : ib + ',' + ia;
    sub.set(k, (sub.get(k) || 0) | mask);
  }
}
const inLayer = PPI.map((_, p) => adj[p].map(n => n.length > 0));
console.log(`genes ${N}, module edges ${sub.size}`);

// ------------------------------------------------------- layer z-scores --
function lcc(set, p) {
  const A = adj[p], mark = new Map(set.map(x => [x, -1]));
  let best = 0;
  for (const s of set) {
    if (mark.get(s) !== -1) continue;
    let size = 0; const st = [s]; mark.set(s, 1);
    while (st.length) { const u = st.pop(); size++; for (const v of A[u]) if (mark.get(v) === -1) { mark.set(v, 1); st.push(v); } }
    if (size > best) best = size;
  }
  return best;
}
const binCache = new Map();
function degreeBins(p) {
  if (binCache.has(p)) return binCache.get(p);
  const ids = [];
  for (let a = 0; a < NA; a++) if (inLayer[p][a]) ids.push(a);
  ids.sort((a, b) => adj[p][a].length - adj[p][b].length);
  const list = [], of = new Map();
  let cur = [];
  for (let k = 0; k < ids.length; k++) {
    cur.push(ids[k]);
    const d = adj[p][ids[k]].length, next = k + 1 < ids.length ? adj[p][ids[k + 1]].length : -1;
    if (cur.length >= 100 && next !== d) { list.push(cur); cur = []; }
  }
  if (cur.length) { if (list.length && cur.length < 100) list[list.length - 1].push(...cur); else list.push(cur); }
  list.forEach((B, i) => B.forEach(a => of.set(a, i)));
  const r = { list, of }; binCache.set(p, r); return r;
}
const RUNS = 1000;
const Z = GROUPS.map((_, g) => PPI.map((_, p) => {
  const seeds = genes.map((G, i) => [G, i]).filter(([G]) => G.seed >> g & 1).map(([G]) => allIdx.get(G.sym)).filter(a => a !== undefined && inLayer[p][a]);
  if (seeds.length < 2) return 0;
  // random genes matched to the seeds' numbers of links in this layer (degree bins of at least 100 genes)
  const bins = degreeBins(p), binOf = bins.of;
  const obs = lcc(seeds, p);
  let s1 = 0, s2 = 0;
  for (let r = 0; r < RUNS; r++) {
    const pick = new Set();
    for (const s of seeds) { const B = bins.list[binOf.get(s)]; let x; do { x = B[Math.floor(rnd() * B.length)]; } while (pick.has(x)); pick.add(x); }
    const v = lcc([...pick], p); s1 += v; s2 += v * v;
  }
  const m = s1 / RUNS, sd = Math.sqrt(Math.max(1e-9, s2 / RUNS - m * m));
  return Math.round((obs - m) / sd * 100) / 100;
}));
console.log('z-scores done');

// ------------------------------------------------- random walk with restart --
// Layer weights: informative layers (z >= 1.645) weighted by z (all protein layers alike if none is informative).
// At each step the walker restarts at a seed with probability 0.7 (in a layer chosen by weight); otherwise, with
// probability 0.5 it switches layer at its gene (to the layers the gene is in, by weight), then steps to a random
// neighbour in its layer. A gene with no neighbour in that layer sends the walker back to the seeds.
const RESTART = 0.7, SWITCH = 0.5;
function rwr(g) {
  let w = Z[g].map(z => (z >= 1.645 ? z : 0));
  if (!w.some(x => x > 0)) w = w.map(() => 1);
  const W = w.reduce((a, b) => a + b, 0); w = w.map(x => x / W);
  const seeds = genes.filter(G => G.seed >> g & 1).map(G => allIdx.get(G.sym)).filter(a => a !== undefined);
  const p0 = Array.from({ length: P }, () => new Float64Array(NA));
  for (const s of seeds) {
    const ls = PPI.map((_, p) => p).filter(p => w[p] > 0 && inLayer[p][s]), t = ls.reduce((a, p) => a + w[p], 0);
    for (const p of ls) p0[p][s] += w[p] / t / seeds.length;
  }
  let x = p0.map(a => a.slice());
  for (let it = 0; it < 60; it++) {
    const nx = Array.from({ length: P }, () => new Float64Array(NA));
    let lost = 0;
    for (let a = 0; a < NA; a++) {
      // switch layers at gene a
      let ws = 0;
      for (let p = 0; p < P; p++) if (w[p] > 0 && inLayer[p][a]) ws += w[p];
      for (let p = 0; p < P; p++) {
        const m = x[p][a];
        if (!m) continue;
        const move = m * (1 - RESTART);
        if (ws > 0) {
          const stay = move * (1 - SWITCH);
          spread(nx, p, a, stay);
          for (let q = 0; q < P; q++) if (w[q] > 0 && inLayer[q][a]) spread(nx, q, a, move * SWITCH * w[q] / ws);
        } else lost += move;
      }
    }
    function spread(nx, p, a, m) {
      const A = adj[p][a];
      if (!A.length) { lost += m; return; }
      const d = m / A.length;
      for (const b of A) nx[p][b] += d;
    }
    let diff = 0;
    for (let p = 0; p < P; p++) for (let a = 0; a < NA; a++) {
      const v = nx[p][a] + (RESTART + lost) * p0[p][a]; diff += Math.abs(v - x[p][a]); nx[p][a] = v;
    }
    x = nx;
    if (diff < 1e-9) break;
  }
  const score = new Float64Array(N);
  genes.forEach((G, i) => { const a = allIdx.get(G.sym); if (a !== undefined) for (let p = 0; p < P; p++) score[i] += x[p][a]; });
  return score;
}
const HEAT = GROUPS.map((_, g) => {
  const s = rwr(g);
  const mx = Math.max(...genes.map((G, i) => ((G.seed | G.added) >> g & 1) && !(G.seed >> g & 1) ? s[i] : 0)) || 1;
  // seeds glow full; the rest on a square-root scale of the strongest added gene
  return genes.map((G, i) => (G.seed >> g & 1 ? 255 : Math.min(254, Math.round(254 * Math.sqrt(s[i] / mx)))));
});
console.log('walks done');

// ---------------------------------------------------------- endotype names --
const BP = '_GO_Biological_Process_2025_a';
const ENDO = GROUPS.map((_, g) => {
  const by = new Map();
  genes.forEach((G, i) => { if (G.endo[g]) { if (!by.has(G.endo[g])) by.set(G.endo[g], []); by.get(G.endo[g]).push(i); } });
  const all = genes.filter(G => G.endo.some(Boolean)), bg = new Map();
  for (const G of all) for (const t of ann[BP].of(G.sym)) bg.set(t, (bg.get(t) || 0) + 1);
  return [...by.keys()].sort((a, b) => a - b).map(c => {
    const mem = by.get(c), cnt = new Map();
    for (const i of mem) for (const t of ann[BP].of(genes[i].sym)) cnt.set(t, (cnt.get(t) || 0) + 1);
    const need = mem.length <= 2 ? 1 : 2;
    const ranked = [...cnt].filter(([, n]) => n >= need).map(([t, n]) => {
      const f = n / mem.length; return [f * Math.log(f / (bg.get(t) / all.length)), t, n];
    }).sort((a, b) => b[0] - a[0] || bg.get(a[1]) - bg.get(b[1]));
    const top = ranked.slice(0, 3).map(r => [sentence(goName(r[1])), r[2]]);
    return { c, n: mem.length, name: top.length ? top[0][0] : '', terms: top };
  });
});

// ------------------------------------------- the overlap's other layers --
const ov = tsv('Overlaps_Congenital Myopathies_Hereditary Cardiomyopathies_Multiplex_Network.tsv');
const ovCols = Object.keys(ov[0]).slice(2).map(c => [c, c.replace(/\.tsv$/, '').replace(/ /g, '_')]).filter(([, k]) => LI.has(k));
const extra = [];                       // [i, j, tower layer] for layers that are not protein layers
let ovPpi = 0;
for (const r of ov) {
  const a = geneIdx.get(r.V1), b = geneIdx.get(r.V2);
  if (a === undefined || b === undefined) continue;
  for (const [c, k] of ovCols) if (r[c] === '1') { if (k.startsWith('ppi_')) ovPpi++; else extra.push([a, b, LI.get(k)]); }
}
const OVL = meta[5].concat(meta[11]).length;
console.log(`overlap: ${extra.length} links in other layers, ${ovPpi} protein-layer links`);

// ---------------------------------------------------------------- layout --
// Force layout of the module network (all protein layers together, plus a pull between genes that share an
// endotype), squeezed into the unit disc. The tower may later push it out to leave room in the middle.
const X = new Float64Array(N), Y = new Float64Array(N);
for (let i = 0; i < N; i++) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()); X[i] = r * Math.cos(a); Y[i] = r * Math.sin(a); }
const springs = [];
for (const [k, m] of sub) { const [a, b] = k.split(',').map(Number); let c = 0; for (let x = m; x; x &= x - 1) c++; springs.push([a, b, 0.3 + c / 27]); }
for (const [a, b] of extra) springs.push([a, b, 0.4]);
GROUPS.forEach((_, g) => {
  const by = new Map();
  genes.forEach((G, i) => { if (G.endo[g]) { if (!by.has(G.endo[g])) by.set(G.endo[g], []); by.get(G.endo[g]).push(i); } });
  for (const mem of by.values()) for (let u = 0; u < mem.length; u++) for (let v = u + 1; v < mem.length; v++) springs.push([mem[u], mem[v], 0.6 / Math.sqrt(mem.length)]);
});
const k0 = 1.6 / Math.sqrt(N);
for (let it = 0; it < 360; it++) {
  const T = 0.08 * (1 - it / 360) + 0.002;
  const fx = new Float64Array(N), fy = new Float64Array(N);
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const dx = X[i] - X[j], dy = Y[i] - Y[j], d2 = dx * dx + dy * dy + 1e-6, f = k0 * k0 / d2;
    fx[i] += dx * f; fy[i] += dy * f; fx[j] -= dx * f; fy[j] -= dy * f;
  }
  for (const [a, b, w] of springs) {
    const dx = X[a] - X[b], dy = Y[a] - Y[b], d = Math.sqrt(dx * dx + dy * dy) + 1e-9, f = w * d / k0;
    fx[a] -= dx / d * f * d; fy[a] -= dy / d * f * d; fx[b] += dx / d * f * d; fy[b] += dy / d * f * d;
  }
  for (let i = 0; i < N; i++) {
    fx[i] -= X[i] * 0.6; fy[i] -= Y[i] * 0.6;                // gravity keeps loose genes close
    const f = Math.hypot(fx[i], fy[i]) || 1, s = Math.min(f, T) / f;
    X[i] += fx[i] * s; Y[i] += fy[i] * s;
  }
}
// into the unit disc: radius by rank, so the disc fills evenly
const order = [...Array(N).keys()].sort((a, b) => Math.hypot(X[a], Y[a]) - Math.hypot(X[b], Y[b]));
const POS = new Int16Array(2 * N);
order.forEach((i, k) => {
  const r = Math.sqrt((k + 0.5) / N) * 0.98, a = Math.atan2(Y[i], X[i]);
  POS[2 * i] = Math.round(r * Math.cos(a) * 32000); POS[2 * i + 1] = Math.round(r * Math.sin(a) * 32000);
});

// ---------------------------------------------------------------- output --
const termTable = [], termIdx = new Map();
const tid = t => { if (!termIdx.has(t)) { termIdx.set(t, termTable.length); termTable.push(t); } return termIdx.get(t); };
const geneRows = genes.map(G => [G.sym, G.endo.join('.'), G.seed, G.added,
  specific(BP, G.sym, 3).map(t => tid(sentence(goName(t)))).join('.'),
  specific('_Human_Phenotype_Ontology_a', G.sym, 2).map(t => tid(t.replace(/\s*\(HP:\d+\)$/, ''))).join('.'),
  specific('_KEGG_2026_a', G.sym, 1).map(t => tid(sentence(t.charAt(0) + t.slice(1).toLowerCase()))).join('.'),
  allIdx.has(G.sym) ? 1 : 0].join('|'));
const E = new Uint32Array(sub.size * 2);
let k = 0;
for (const [key, m] of [...sub].sort((a, b) => (a[0] < b[0] ? -1 : 1))) { const [a, b] = key.split(',').map(Number); E[k++] = a << 16 | b; E[k++] = m; }
const XE = new Uint16Array(extra.length * 3); extra.forEach((e, i) => XE.set(e, 3 * i));
const b64 = a => Buffer.from(a.buffer).toString('base64');
const DATA = {
  groups: GROUPS.map(([name, short, col, site], g) => ({ name, short, col, site,
    seeds: genes.filter(G => G.seed >> g & 1).length, added: genes.filter(G => (G.added & ~G.seed) >> g & 1).length,
    z: Z[g], endo: ENDO[g] })),
  layers: LAYERS.map(([key, name, cat]) => ({ key, name, cat, data: cat === 'ppi' ? 'all' : ovCols.some(([, k2]) => k2 === key) ? 'overlap' : '' })),
  ppi: PPI, genes: geneRows, terms: termTable,
  edges: b64(E), extra: b64(XE), pos: b64(POS), heat: HEAT.map(h => Buffer.from(Uint8Array.from(h)).toString('base64')),
  overlap: { groups: [5, 11], genes: [...new Set(ov.flatMap(r => [r.V1, r.V2]))].filter(s => geneIdx.has(s)).map(s => geneIdx.get(s)) },
  walk: { restart: RESTART, switch: SWITCH, zMin: 1.645, runs: RUNS },
};
const js = `// Data of the muscle story, made by tools/nmd/data/gen_data.mjs from ikerdata/ (do not edit by hand).
// groups: name, short name, colour, where in the body (neuron, nerve, junction, muscle, heart), seed and added gene
//   counts, z (layer z-score per protein layer, in the order of ppi), endo (endotypes: number c, size n, GO-based name)
// layers: the tower from top to bottom: key, name, category (pheno, path, drug, ess, coex, ppi), data ('all', 'overlap' or '')
// genes: 'SYMBOL|endotype per group (0 none)|seed group bits|added group bits|GO terms|HPO terms|KEGG|in protein layers'
//   (terms index into terms)
// edges: base64 Uint32 pairs [i << 16 | j, protein-layer bits (bit p = layer ppi[p])]
// extra: base64 Uint16 triples [i, j, tower layer] for the overlap's other layers
// pos: base64 Int16 x, y per gene in the unit disc (x 32000); heat: per group, base64 bytes per gene (walk visits)
const NMD_DATA = ${JSON.stringify(DATA)};
`;
fs.writeFileSync(path.join(root, 'tools/nmd/sets/data.js'), js);
console.log(`wrote tools/nmd/sets/data.js (${(js.length / 1024).toFixed(0)} KB), ${termTable.length} terms`);
for (const [g, G] of DATA.groups.entries()) console.log(G.short, 'seeds', G.seeds, 'added', G.added, 'endotypes', G.endo.length, 'best z', Math.max(...G.z).toFixed(1), 'informative', G.z.filter(z => z >= 1.645).length);
