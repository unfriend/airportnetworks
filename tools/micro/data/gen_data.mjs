// Writes tools/micro/sets/data.js (the constant MICRO_DATA) for the microanatomy story, from:
// - Iva Buljan's network of organ architecture (Cytoscape GraphML: organs, tissues, tissue types and microanatomical
//   domains; the file stays out of the repository, only these numbers are kept): node .../network_with_tissue_types_hierarchical.graphml
// - the preprint: Buljan I, Bago-Horvath Z, Rendeiro AF, "Systematic mapping of human tissue microanatomy reveals
//   age-associated remodeling and resilience", bioRxiv 2025, doi 10.1101/2025.10.13.682110 (CC BY-NC): its numbers,
//   typed in below;
// - tools/micro/data/figures.json: values read off the talk's figures (if present).
// usage (from the repository root): node tools/micro/data/gen_data.mjs <graphml>
import fs from 'fs';
import path from 'path';
const here = path.dirname(new URL(import.meta.url).pathname);
const src = process.argv[2];
if (!src) { console.error('usage: node tools/micro/data/gen_data.mjs <graphml>'); process.exit(1); }
const xml = fs.readFileSync(src, 'utf8');
const figPath = path.join(here, 'figures.json');
const FIG = fs.existsSync(figPath) ? JSON.parse(fs.readFileSync(figPath, 'utf8')) : {};

// ------------------------------------------------------------ the graph --
// a minimal GraphML reader: <node id><data key=..>..</data></node>, <edge source target>
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const datas = body => Object.fromEntries([...body.matchAll(/<data key="([^"]+)">([^<]*)<\/data>/g)].map(m => [m[1], unesc(m[2])]));
const nodes = [...xml.matchAll(/<node id="([^"]+)"[^>]*>([\s\S]*?)<\/node>/g)].map(m => ({ gid: m[1], ...datas(m[2]) }));
const edges = [...xml.matchAll(/<edge [^>]*source="([^"]+)"[^>]*target="([^"]+)"[^>]*>/g)].map(m => [m[1], m[2]]);
const LEVEL = { Organ: 0, Tissue: 1, 'Tissue type': 2, Domain: 3 };
const tidy = s => s.replace(/pathches/g, 'patches').replace(/adventita/g, 'adventitia').replace(/\bmedula\b/g, 'medulla')
  .replace(/^Pars intermedia$/, 'pars intermedia').replace(/pia matter/g, 'pia mater');
const N = nodes.filter(n => n.Type in LEVEL).map(n => ({ gid: n.gid, name: tidy(n.name), level: LEVEL[n.Type], ab: n.Abundance ? +n.Abundance : null }));
N.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
const idx = new Map(N.map((n, i) => [n.gid, i]));
const E = edges.filter(([a, b]) => idx.has(a) && idx.has(b)).map(([a, b]) => [idx.get(a), idx.get(b)].sort((x, y) => x - y));

// ----------------------------------------------- organs on the tour's body --
// a home point in the tour's PET body set's frame (feet at y -0.95, faces +z, the person's left +x); sex-specific
// organs sit where they would be (each organ's look is its 3D model, sets/organs.js, found by name)
const ORGAN_AT = {
  'Adipose': [0.1, -0.2, 0.07], 'Adrenal Gland': [-0.054, 0.152, -0.06], 'Artery': [0.014, 0.25, -0.04],
  'Bladder': [0, -0.112, 0.045], 'Brain': [0, 0.738, -0.008], 'Breast': [0.07, 0.36, 0.1],
  'Cervix': [0, -0.1, 0.02], 'Colon': [-0.09, 0.05, 0.03], 'Esophagus': [0, 0.45, -0.03],
  'Fallopian Tube': [0.06, -0.04, 0.0], 'Heart': [0.038, 0.293, 0.052], 'Kidney': [-0.065, 0.098, -0.066],
  'Liver': [-0.074, 0.205, 0.012], 'Lung': [-0.079, 0.365, -0.01], 'Minor Salivary Gland': [0, 0.66, 0.08],
  'Muscle': [0.09, -0.62, -0.03], 'Nerve': [-0.09, -0.62, 0.0], 'Ovary': [-0.06, -0.06, 0.0],
  'Pancreas': [0.032, 0.14, -0.01], 'Pituitary': [0, 0.71, 0.0], 'Prostate': [0, -0.15, 0.0],
  'Skin': [0.1, -0.7, 0.05], 'Small Intestine': [0, 0.02, 0.05], 'Spleen': [0.108, 0.2, -0.056],
  'Stomach': [0.08, 0.2, 0.05], 'Testis': [0.03, -0.21, 0.06], 'Thyroid': [0, 0.548, 0.042],
  'Uterus': [0, -0.07, 0.02], 'Vagina': [0, -0.13, 0.02],
};
const organs = N.filter(n => n.level === 0).map(n => {
  const a = ORGAN_AT[n.name] || [0, 0, 0];
  return { name: n.name, pos: a.slice(0, 3) };
});

// --------------------------------------------------------- the preprint --
const FACTS = {
  slides: 24945, tissues: 40, organs: 29, donors: 983, donorsAnalysed: 971, ages: [20, 70], medianAge: 56, male: 66.8,
  tiles: 162e6, domains: 218, types: 74, superclasses: 10, shared3: 16, specific: 69,
  ageChange: 28, agePairs: [37, 128], agePairsMin: 1, mostUnder: 3, donorVars: 111,
  pathology: { instances: 9643, kinds: 54 },
  bench: { salivary: { r: 0.91, r2: 0.83 }, stomach: { r: 0.76, r2: 0.58 } },
  method: 'H&E-UTAG', gtex: 'GTEx (Genotype-Tissue Expression project)',
};
const EXAMPLES = [
  { domain: 'corpus albicans', tissue: 'Ovary', from: 1.4, to: 11.89, perDecade: 3.51,
    note: 'scars left by old ovarian follicles: they pile up with age' },
  { domain: 'submucosa', tissue: 'gastrointestinal tract', from: 42.9, to: 34.5, perDecade: -0.98,
    note: 'the loose layer under the gut lining thins' },
  { domain: 'adenohypophysis', tissue: 'Pituitary', from: 82.6, to: 67.9, perDecade: -3.42,
    note: 'the gland part of the pituitary shrinks' },
];
const FINDINGS = {
  most: 'Integumentary (skin) and reproductive tissues changed most, nervous and muscular tissues least.',
  connective: 'Connective tissue increased with age in many organs.',
  pathology: [
    { kind: 'calcified plaques', organ: 'Artery', note: 'rise with age, faster after about 40' },
    { kind: 'infarct tissue', organ: 'Heart', note: 'rises steeply after about 60' },
    { kind: 'testicular atrophy', organ: 'Testis', note: 'changes the shape of the seminiferous tubules (morphology)' },
    { kind: 'arterial fibrosis', organ: 'Artery', note: 'changes how much tunica adventitia there is (abundance)' },
    { kind: 'liver cirrhosis', organ: 'Liver', note: 'changes both' },
  ],
  interactions: [
    { organ: 'Uterus', note: 'the endometrium shifts towards contacts with connective tissue', dir: 0 },
    { organ: 'Ovary', a: 'mucosa', b: 'fibromuscular tissue', dir: 1 },
    { organ: 'Skin', a: 'subdermis', b: 'reticular dermis', dir: -1 },
    { organ: 'Colon', a: 'muscularis', b: 'submucosa', dir: -1 },
    { organ: 'Fallopian Tube', a: 'mucosa', b: 'muscularis', dir: -1 },
    { organ: 'Fallopian Tube', a: 'mucosa', b: 'fibromuscular tissue', dir: 1 },
    { organ: 'Artery', a: 'calcified plaque', b: 'tunica intima', dir: 1, note: 'coronary and tibial arteries' },
  ],
  stable: 'Most organs keep the same core network of domain contacts as they age: a resilient framework.',
};

const D = {
  source: {
    preprint: 'Buljan I, Bago-Horvath Z, Rendeiro AF. Systematic mapping of human tissue microanatomy reveals age-associated remodeling and resilience. bioRxiv 2025. doi:10.1101/2025.10.13.682110 (CC BY-NC)',
    poster: 'Buljan I, Bagó-Horváth Z, Rendeiro A. Microanatomical organization of the human body and its changes with age. LBI for Network Medicine; CeMM; Medical University of Vienna.',
  },
  facts: FACTS, examples: EXAMPLES, findings: FINDINGS,
  levels: ['organ', 'tissue', 'tissue type', 'domain'],
  graph: { nodes: N.map(n => [n.name, n.level, n.ab]), edges: E },
  organs,
  figures: FIG,
};
const head = `// MICRO_DATA: generated by tools/micro/data/gen_data.mjs; never edit by hand.
// Sources: the preprint (${D.source.preprint}), the poster and talk, and Iva Buljan's network of organ architecture.
// Fields:
//   source        citations
//   facts         the preprint's numbers (slides, tissues, organs, donors (983 in its abstract; 971 analysed in its
//                 results), ages, tiles, domains, domain types, shared and tissue-specific shares (%), the share of
//                 domains that change with age (%, and as domain-tissue pairs over 1 % abundance), pathology, benchmarks)
//   examples[]    the three worked examples of change with age { domain, tissue, from (% at 20), to (% at 70),
//                 perDecade, note }
//   findings      the preprint's other findings in words: most and least changed systems, connective tissue,
//                 pathology [{ kind, organ, note }], interactions [{ organ, a, b, dir (1 more contacts with age, -1
//                 fewer), note }], stable
//   levels        the four levels of the network: organ, tissue, tissue type, domain
//   graph         the network of organ architecture: nodes [name, level 0..3, abundance (domains only)], edges [a, b]
//                 (indices into nodes; organ-tissue, organ-tissue type, tissue-tissue type, domain-tissue type and a
//                 few tissue type-tissue type links)
//   organs[]      the 29 organs { name, pos (a home point in the tour's PET body set's frame) }
//   figures       values read off the talk's figures (atlas sections, the volcano, trajectories, interactions), if any
`;
const out = path.join(here, '../sets/data.js');
fs.writeFileSync(out, head + 'const MICRO_DATA = ' + JSON.stringify(D) + ';\n');
console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0), 'KB');
const byLevel = [0, 1, 2, 3].map(l => N.filter(n => n.level === l).length);
console.log('nodes by level', byLevel.join(' / '), 'edges', E.length, 'figures', Object.keys(FIG).join(', ') || 'none');
