// Extract the curated protein network from stories/proteins.js into plain JSON.
// Usage: node extract_proteins.mjs [repoDir] [outFile]
// Evaluates only the data block of the story (from `const PPI =` up to the first
// DOM helper `const $ = s =>`) in a vm sandbox; nothing touches a DOM or three.js.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = process.argv[2] || path.join(here, '../../..');
const out = process.argv[3] || path.join(here, 'proteins.json');
const src = fs.readFileSync(path.join(repo, 'stories/proteins.js'), 'utf8');

const a = src.indexOf('const PPI = '), b = src.indexOf('const $ = s =>');
if (a < 0 || b < 0 || b < a) throw new Error('markers not found: the layout of stories/proteins.js changed');
const block = src.slice(a, b);
const ctx = vm.createContext({ Math, Object, Array, JSON });
const D = vm.runInContext(`'use strict';\n${block}\n;({ PPI, HOP_DIST, LIFT, NARRATION_SYNC, CH, COMM_NAMES, COMM_COLORS, INTER_COLOR, STATS })`, ctx);
const { PPI, COMM_NAMES, COMM_COLORS, INTER_COLOR, STATS, HOP_DIST, CH } = JSON.parse(JSON.stringify(D));

// --- nodes: [sym, name, role, compartment, essential, x, y, z, module, betweenness]
const COMP = { X: 'outside the cell', M: 'cell membrane', C: 'cytoplasm', N: 'nucleus' };
const N = PPI.nodes.length, E = PPI.edges.length;
const idx = new Map(PPI.nodes.map((n, i) => [n[0], i]));
const deg = new Array(N).fill(0), adj = Array.from({ length: N }, () => []);
PPI.edges.forEach(([u, v]) => { deg[u]++; deg[v]++; adj[u].push(v); adj[v].push(u); });
const r3 = x => Math.round(x * 1e4) / 1e4;
const hex = c => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

// diseases (lists of symbols in PPI.disease), colours as the story draws them
const DIS_META = {
  breast: { name: 'Breast cancer', colour: [1.0, 0.45, 0.86], css: '#ff5ad9', note: 'story highlight "anc" + label style mag' },
  alzheimer: { name: "Alzheimer's disease", colour: null, css: null, note: 'in the data but not drawn as a module in the story; only BACE1 is used' },
};
// drug targets are not a data constant: they are written into the story text (buildStory, chapter "paths")
const DRUGS = [
  { drug: 'tamoxifen', target: 'ESR1', disease: 'breast', marker: 'target of tamoxifen' },
  { drug: 'trastuzumab', target: 'ERBB2', disease: 'breast', marker: 'target of trastuzumab' },
  { drug: 'olaparib', target: 'PARP1', disease: 'breast', marker: 'target of olaparib' },
  { drug: 'imatinib', target: 'ABL1', disease: null, marker: 'target of imatinib', note: 'only in ABL1 role text (PPI.nodes); not used in the story' },
  { drug: 'BACE1 inhibitors (unnamed; "drugs tested against Alzheimer\'s disease")', target: 'BACE1', disease: 'alzheimer', marker: 'BACE1, a target of drugs tested against Alzheimer' },
];
const drugColour = { colour: [0.30, 1.0, 0.58], css: '#3ee08f' };
for (const d of DRUGS) if (!src.includes(d.marker)) console.warn('warning: drug text not found in story:', d.marker);

const nodeDis = Array.from({ length: N }, () => []);
const diseases = Object.entries(PPI.disease).map(([key, genes]) => {
  const ids = genes.map(g => idx.get(g)), missing = genes.filter(g => !idx.has(g));
  ids.forEach(i => { if (i !== undefined) nodeDis[i].push(key); });
  // largest connected group of the module's genes (the story's "lcc")
  const inS = new Set(ids.filter(i => i !== undefined)), seen = new Set(); let lcc = 0;
  for (const s0 of inS) { if (seen.has(s0)) continue; let n = 0; const st = [s0]; seen.add(s0);
    while (st.length) { const u = st.pop(); n++; for (const v of adj[u]) if (inS.has(v) && !seen.has(v)) { seen.add(v); st.push(v); } }
    lcc = Math.max(lcc, n); }
  const m = DIS_META[key] || {};
  return { key, name: m.name || key, colour: m.colour, css: m.css, genes, idx: ids, missing, lcc, note: m.note };
});
const nodeDrug = new Array(N).fill(null);
DRUGS.forEach(d => { const i = idx.get(d.target); d.idx = i ?? null; if (i !== undefined) nodeDrug[i] = (nodeDrug[i] ? nodeDrug[i] + ', ' : '') + d.drug; });

const nodes = PPI.nodes.map(([sym, name, role, comp, ess, x, y, z, module, btw], i) => ({
  i, sym, name, role, comp, compartment: COMP[comp], essential: !!ess, module, degree: deg[i],
  betweenness: btw, pos: [x, y, z], r: r3(Math.hypot(x, y, z)),
  diseases: nodeDis[i], drug: nodeDrug[i],
}));

// modules (Louvain, numbered 0-9 in node field 8); edge colour index 10 = between modules
const modules = COMM_NAMES.map((name, k) => {
  const mem = nodes.filter(n => n.module === k);
  const roles = {}; mem.forEach(n => { roles[n.role] = (roles[n.role] || 0) + 1; });
  return { id: k, name, colour: COMM_COLORS[k], css: hex(COMM_COLORS[k]), size: mem.length,
    essential: mem.filter(n => n.essential).length, roles };
});
const interModule = { colour: INTER_COLOR, css: hex(INTER_COLOR) };

// "role" field = complex / pathway / function label per protein: group them
const groupsMap = new Map();
nodes.forEach(n => { if (!groupsMap.has(n.role)) groupsMap.set(n.role, []); groupsMap.get(n.role).push(n.i); });
const roles = [...groupsMap].map(([role, ids]) => {
  const s = new Set(ids); let internal = 0;
  PPI.edges.forEach(([u, v]) => { if (s.has(u) && s.has(v)) internal++; });
  const mods = {}; ids.forEach(i => { mods[nodes[i].module] = (mods[nodes[i].module] || 0) + 1; });
  return { role, size: ids.length, internalEdges: internal, modules: mods, members: ids.map(i => nodes[i].sym) };
}).sort((x, y) => y.size - x.size || x.role.localeCompare(y.role));

const res = {
  source: 'stories/proteins.js (PPI, COMM_NAMES, COMM_COLORS, INTER_COLOR, STATS, HOP_DIST, CH)',
  counts: { nodes: N, edges: E, modules: modules.length, roles: roles.length,
    essential: nodes.filter(n => n.essential).length,
    byCompartment: Object.fromEntries(Object.keys(COMP).map(c => [c, nodes.filter(n => n.comp === c).length])) },
  nodeFields: 'PPI.nodes[i] = [sym, name, role, compartment(X/M/C/N), essential(0/1), x, y, z, module(0-9), betweenness]',
  compartments: COMP,
  nodes,
  edges: PPI.edges,
  edgeModule: PPI.edges.map(([u, v]) => (nodes[u].module === nodes[v].module ? nodes[u].module : 10)),
  modules, interModule,
  diseases,
  drugs: DRUGS.map(({ marker, ...d }) => d), drugColour,
  roles,
  // multi-member role labels = named complexes / protein families in the data
  complexes: roles.filter(r => r.size >= 2).map(({ role, size, internalEdges, members }) => ({ name: role, size, internalEdges, members })),
  stats: STATS, ppiStats: PPI.stats, hopDist: HOP_DIST,
  chapters: CH.map(({ key, name, a, b }) => ({ key, name, a, b })),
  scene: { units: 'cell membrane sphere radius 1, nucleus sphere radius 0.37 (see GL setup); proteins drawn at their own radius r along unit direction pos/r' },
};
fs.writeFileSync(out, JSON.stringify(res));
console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(1) + ' KB');
