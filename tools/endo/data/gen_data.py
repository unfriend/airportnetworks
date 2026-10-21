# Writes tools/endo/sets/data.js (ENDO_DATA) from the authors' EndotypY run on congenital myasthenic syndromes (CMS).
# The authors' files stay outside the repository (only these numbers go in):
#   run.pkl    their saved Endotyper object: the protein network, the 35 seeds and the 12 endotypes (endo.endotypes)
#   seeds.xlsx the Gene Table's CMS genes (symbol, chromosome, protein, item)
# Needs Python 3.11+ with EndotypY installed (pip install --no-deps the EndotypY repository, plus numpy, pandas, networkx,
# scipy, gseapy, openpyxl); its clustering library is not needed (the endotypes are the authors').
# usage: python -I tools/endo/data/gen_data.py run.pkl seeds.xlsx        (a few minutes; Enrichr libraries are downloaded)
# The endotypes are the authors' result. The steps before them (seed groups, the module's walk, each gene's
# neighbourhood, its annotation, the tree) are re-run here with the package's defaults on the same network, to
# illustrate the method: the authors' own settings are not known, so the tree is drawn to agree with their endotypes.
import sys, os, types, pickle, importlib, json, math, base64, zlib
import numpy as np, scipy.sparse as sp, networkx as nx
for name in ('kl_clustering_analysis', 'kl_clustering_analysis.tree', 'kl_clustering_analysis.tree.poset_tree'):
    sys.modules[name] = types.ModuleType(name)
sys.modules['kl_clustering_analysis.tree.poset_tree'].PosetTree = None
import gseapy as gp, openpyxl
from scipy.cluster.hierarchy import linkage, leaves_list
from scipy.spatial.distance import squareform
from EndotypY.utils import download_enrichr_library
from EndotypY.expansion import get_module_neighborhood_terms_dict

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sets', 'data.js')
R, PCT, CORE, MAXLINKS = 0.8, 1, 2000, 15000
KS = [1, 2, 3, 4, 5, 10, 20, 30, 50, 75, 100, 150, 200]
FEAT_LIB, NAME_LIB = 'GO_Cellular_Component_2026', 'Jensen_COMPARTMENTS'
# short names, colours (after the poster's figure) and places in the synapse; the names follow each endotype's
# strongest COMPARTMENTS term (computed below and kept in `term`); 0, 4 and 7 share no place (nothing significant)
LOOK = {0: ('No shared place', '#9aa3b5', ''), 1: ('Mitochondria', '#a98bea', 'mito'), 2: ('Basement membrane', '#3cc4e6', 'lamina'),
        3: ('Golgi', '#34d1a8', 'golgi'), 4: ('No shared place', '#c7d65a', ''), 5: ('Ion channels', '#e3a03c', 'channels'),
        6: ('Organelle membranes', '#e2557a', 'er'), 7: ('No shared place', '#8f9bb0', ''), 8: ('Endosomes', '#58d06a', 'endosome'),
        9: ('Vesicles', '#5d86f0', 'vesicles'), 10: ('Muscle scaffold', '#f07b5a', 'scaffold'), 11: ('The junction', '#e070d0', 'junction')}

class _Obj: pass
class _U(pickle.Unpickler):  # a pickle can run code: only the expected classes are allowed
    def find_class(self, mod, name):
        if (mod, name) == ('EndotypY.endotyper', 'Endotyper'): return _Obj
        if mod.startswith('networkx.classes.'): return getattr(importlib.import_module(mod), name)
        raise pickle.UnpicklingError(f'refused {mod}.{name}')

class Walk:
    """EndotypY's random walk with restart, W = r (I - (1-r) A D^-1)^-1, scaled by D^-1/2 (scaling=True), by
    iteration instead of the package's dense inverse (the same numbers to 1e-14 on a test graph)."""
    def __init__(s, G):
        s.nodes = sorted(G.nodes()); s.idx = {g: i for i, g in enumerate(s.nodes)}
        A = sp.csc_matrix(nx.adjacency_matrix(G, s.nodes), dtype=float)
        s.deg = np.asarray(A.sum(axis=0)).ravel(); s.M = (A @ sp.diags(1 / s.deg)).tocsr()
    def run(s, genes_per_col):
        P0 = np.zeros((len(s.nodes), len(genes_per_col)))
        for j, gs in enumerate(genes_per_col):
            for g in gs: P0[s.idx[g], j] = 1
        P0 *= np.sqrt(s.deg)[:, None]; P = R * P0
        for _ in range(200):
            Pn = (1 - R) * (s.M @ P) + R * P0
            done = np.abs(Pn - P).max() < 1e-13; P = Pn
            if done: break
        return P / np.sqrt(s.deg)[:, None]

def b64(a): return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()

def main(pkl, xlsx):
    o = _U(open(pkl, 'rb')).load()
    G = o.network.copy(); G.remove_nodes_from(['gene_a', 'gene_b'])  # the network file's header, read as a link
    seeds = list(o.seeds); endos = {int(k): list(v) for k, v in o.endotypes[2].items()}
    rows = list(openpyxl.load_workbook(xlsx, read_only=True, data_only=True).worksheets[0].iter_rows(values_only=True))[2:]
    table = [[str(r[0]).strip(), ' '.join(str(r[2]).split()), str(r[3])] for r in rows if r[0]]
    assert {t[0] for t in table} == set(seeds), 'the seed table and the run differ'
    wk = Walk(G)
    # the module genes, by endotype; the tree orders them within each endotype below
    lab = {g: k for k in endos for g in endos[k]}
    # 1. seed groups: each seed's neighbourhood (itself, its top k by its own walk, then the next until connected);
    #    seeds whose neighbourhoods overlap join a group (the package's run_seed_clustering rule)
    P = wk.run([[s] for s in seeds])
    order = {s: [wk.nodes[i] for i in np.argsort(-P[:, j], kind='stable')] for j, s in enumerate(seeds)}
    def hood(s, k):
        rk = [g for g in order[s] if g != s]; mod = [s] + rk[:k]; i = k
        while not nx.is_connected(G.subgraph(mod)) and i < 2000: mod.append(rk[i]); i += 1
        return set(mod)
    gk = []
    for k in KS:
        H = {s: hood(s, k) for s in seeds}; SG = nx.Graph(); SG.add_nodes_from(seeds)
        SG.add_edges_from((a, b) for i, a in enumerate(seeds) for b in seeds[i + 1:] if not H[a].isdisjoint(H[b]))
        comps = sorted(nx.connected_components(SG), key=lambda c: (-len(c), min(seeds.index(x) for x in c)))
        gi = {s: n for n, c in enumerate(comps) for s in c}; gk.append([gi[t[0]] for t in table])
        print('k', k, 'groups', len(comps), flush=True)
    # 2. the walk from all seeds (the module's ranking)
    heat = wk.run([seeds])[:, 0]
    rank = [wk.nodes[i] for i in np.argsort(-heat, kind='stable')]
    # 3. each module gene's neighbourhood: its own walk, top 1% of the network
    mgenes = [g for k in sorted(endos) for g in endos[k]]
    n_hood = math.ceil(len(wk.nodes) * PCT / 100)
    P = wk.run([[g] for g in mgenes])
    top = {g: [wk.nodes[i] for i in np.argsort(-P[:, j], kind='stable')[:n_hood]] for j, g in enumerate(mgenes)}
    # 4. annotation: each gene's own terms plus the terms enriched in its neighbourhood (the package's function)
    L = download_enrichr_library(FEAT_LIB, organism='Human')
    ann = get_module_neighborhood_terms_dict(top, L, 0.05)
    terms = sorted({t for v in ann.values() for t in v})
    tix = {t: i for i, t in enumerate(terms)}
    X = np.zeros((len(mgenes), len(terms)), dtype=bool)
    for i, g in enumerate(mgenes):
        for t in ann.get(g, []): X[i, tix[t]] = True
    print('features', X.shape, int(X.sum()), flush=True)
    # 5. the tree: Jaccard distances on the features; drawn to agree with the authors' endotypes (each endotype a
    #    subtree; merges inside an endotype are splits the test refuses, merges of endotypes are splits it accepts)
    inter = X.astype(np.int32) @ X.T.astype(np.int32); sz = X.sum(1)
    D = 1 - inter / np.maximum(sz[:, None] + sz[None] - inter, 1); np.fill_diagonal(D, 0)
    ks = sorted(endos); members = {k: [i for i, g in enumerate(mgenes) if lab[g] == k] for k in ks}
    Z, nid, top_of = [], len(mgenes), {}
    for k in ks:  # inside each endotype: average linkage, heights squeezed into 0..0.55
        m = members[k]
        if len(m) == 1: top_of[k] = m[0]; continue
        z = linkage(squareform(D[np.ix_(m, m)], checks=False), 'average'); hmax = max(z[:, 2].max(), 1e-9)
        ids = list(m)
        for a, b, h, _ in z:
            Z.append([ids[int(a)], ids[int(b)], 0.55 * h / hmax, 0]); ids.append(nid); nid += 1
        top_of[k] = ids[-1]
    E = np.array([[D[np.ix_(members[a], members[b])].mean() for b in ks] for a in ks]); np.fill_diagonal(E, 0)
    ze = linkage(squareform(E, checks=False), 'average'); emin, emax = ze[:, 2].min(), max(ze[:, 2].max(), 1e-9)
    ids = [top_of[k] for k in ks]
    for a, b, h, _ in ze:
        Z.append([ids[int(a)], ids[int(b)], 0.62 + 0.38 * (h - emin) / max(emax - emin, 1e-9), 1]); ids.append(nid); nid += 1
    Zs = np.array([[a, b, h, 2] for a, b, h, _ in Z], dtype=float)
    leaf = leaves_list(Zs)
    # module genes in tree order (so each endotype is a run); remap everything to that order
    perm = list(leaf); pos_of = {old: new for new, old in enumerate(perm)}
    mg = [mgenes[i] for i in perm]; Xo = X[perm]
    remap = lambda v: pos_of[v] if v < len(mgenes) else v
    Zo = [[remap(int(a)), remap(int(b)), h, c] for a, b, h, c in Z]
    n = len(mg)
    # 6. the cloud: the module first (tree order), then the most visited genes to CORE, then everyone else
    core = list(mg) + [g for g in rank if g not in lab][:CORE - len(mg)]
    cset = set(core); rest = [g for g in wk.nodes if g not in cset]
    H = nx.Graph(); H.add_nodes_from(core)   # in a fixed order (a subgraph view iterates a set: its order changes per run)
    H.add_edges_from((a, b) for a, b in G.edges(core) if a in cset and b in cset)
    init = {g: np.random.default_rng(zlib.crc32(g.encode())).normal(size=3) * (0.3 if g in lab else 1.0) for g in core}
    lay = nx.spring_layout(H, dim=3, pos=init, iterations=80, seed=7)
    cp = np.array([lay[g] for g in core]); cp -= cp[:len(mg)].mean(0); cp /= np.percentile(np.linalg.norm(cp, axis=1), 95)
    ci = {g: i for i, g in enumerate(core)}; rng = np.random.default_rng(11)
    lh = np.log10(np.maximum(heat, 1e-12)); lo, hi = np.percentile(lh, 1), lh.max()
    q = {g: (lh[wk.idx[g]] - lo) / (hi - lo) for g in wk.nodes}
    rp = []
    for g in rest:  # outside the core: towards its core neighbours, further out the less the walk visits it
        nb = [cp[ci[x]] for x in G[g] if x in ci]
        d = np.mean(nb, 0) if nb else rng.normal(size=3)
        d = d / (np.linalg.norm(d) + 1e-9) + rng.normal(size=3) * 0.35; d /= np.linalg.norm(d)
        rp.append(d * (1.25 + 0.9 * (1 - max(0, min(1, q[g]))) + rng.random() * 0.25))
    allpos = np.vstack([cp, np.array(rp)]); order_all = core + rest; oi = {g: i for i, g in enumerate(order_all)}
    hb = np.clip(np.round(np.array([q[g] for g in order_all]) * 255), 0, 255).astype(np.uint8)
    for s in seeds: hb[oi[s]] = 255
    # links among the core: the module's own first, then module-to-core, then a sample of the rest
    E1 = [(ci[a], ci[b]) for a, b in H.edges() if a in lab and b in lab]
    E2 = [(ci[a], ci[b]) for a, b in H.edges() if (a in lab) != (b in lab)]
    E3 = [(ci[a], ci[b]) for a, b in H.edges() if a not in lab and b not in lab]
    rng.shuffle(E2); rng.shuffle(E3); E2 = E2[:MAXLINKS // 2]; E3 = E3[:MAXLINKS - len(E1) - len(E2)]
    links = np.array(E1 + E2 + E3, dtype=np.uint16).ravel()
    hoods = np.array([[oi[x] for x in top[g]] for g in mg], dtype=np.uint16).ravel()
    featN = Xo.sum(1).astype(np.uint16); featI = np.array([j for i in range(n) for j in np.nonzero(Xo[i])[0]], dtype=np.uint16)
    # 7. what each endotype is: enrichment of its genes in COMPARTMENTS (as on the poster's grid)
    LN = download_enrichr_library(NAME_LIB, organism='Human'); endo = []
    for k in ks:
        r = gp.enrich(gene_list=endos[k], gene_sets=LN, outdir=None).results.sort_values('Adjusted P-value')
        t, p = (r['Term'].iloc[0], float(r['Adjusted P-value'].iloc[0])) if len(r) else ('', 1.0)
        name, col, place = LOOK[k]
        endo.append({'id': k, 'n': len(endos[k]), 'name': name, 'term': t, 'p': float(f'{p:.2g}'),
                     'strong': 2 if p < 0.01 else 1 if p < 0.1 and place else 0, 'col': col, 'place': place,
                     'seeds': [s for s in seeds if lab[s] == k]})
        print('endotype', k, name, t, p, flush=True)
    clean = lambda t: t.split(' (GO:')[0]
    D_ = {
        'facts': {'genes': G.number_of_nodes(), 'links': G.number_of_edges(), 'seeds': len(seeds), 'module': n,
                  'found': n - len(seeds), 'endotypes': len(ks), 'hood': n_hood, 'pct': PCT, 'r': R, 'terms': len(terms),
                  'annotated': int((Xo.sum(1) > 0).sum()), 'featLib': FEAT_LIB, 'nameLib': NAME_LIB},
        'seeds': table, 'endo': endo,
        'nodes': len(order_all), 'core': len(core), 'mod': n, 'names': '|'.join(core),
        'gene': b64(np.array([lab[g] for g in mg], dtype=np.uint8)),
        'seedOf': b64(np.array([next((i + 1 for i, t in enumerate(table) if t[0] == g), 0) for g in mg], dtype=np.uint8)),
        'pos': b64(np.clip(np.round(allpos * 10000), -32000, 32000).astype(np.int16)),
        'heat': b64(hb), 'links': b64(links), 'modLinks': len(E1), 'nLinks': len(links) // 2,
        'groups': {'k': KS, 'g': b64(np.array(gk, dtype=np.uint8))},
        'hood': b64(hoods), 'terms': [clean(t) for t in terms],
        'featN': b64(featN), 'featI': b64(featI),
        'tree': {'ab': b64(np.array([[a, b] for a, b, _, _ in Zo], dtype=np.uint16)),
                 'h': b64(np.array([round(h * 255) for _, _, h, _ in Zo], dtype=np.uint8)),
                 'cut': b64(np.array([c for *_, c in Zo], dtype=np.uint8))},
    }
    head = f'''// ENDO_DATA: the EndotypY run on congenital myasthenic syndromes for the endotype story. Generated by
// tools/endo/data/gen_data.py from the authors' files; never edit by hand. Typed arrays are base64 (little-endian).
// facts: counts and settings: genes and links of the protein network, seeds, module ({n} genes), found (module genes
//   that are not seeds), endotypes, hood (neighbourhood size: the top pct % of the network by each gene's own walk),
//   r (the walk's restart probability), terms (columns of the feature matrix, from featLib), annotated (genes with
//   at least one term), nameLib (the library that names the endotypes)
// seeds: [symbol, protein, Gene Table item] for the 35 seed genes, in the Gene Table's order
// endo: per endotype {{ id, n, name, term (its strongest {NAME_LIB} term), p (adjusted), strong (2 clear, 1 weak,
//   0 none), col, place (where it acts in the synapse: mito, lamina, golgi, channels, er, endosome, vesicles,
//   scaffold, junction, or '' for none), seeds (its seed genes) }}
// nodes: every gene of the network is a point; the first `core` have names and a layout, the first `mod` of those
//   are the module genes in tree order (each endotype a run); names: the core's names, '|'-separated
// gene: Uint8 per module gene, its endotype id; seedOf: Uint8 per module gene, 1 + its index in seeds, or 0
// pos: Int16 x, y, z per node (/10000; the module near the middle, unit radius for most of the core)
// heat: Uint8 per node, the walk from all seeds (log scale; seeds 255)
// links: Uint16 pairs of node indices among the core: the first modLinks are the module's own links, then
//   module-to-core links, then a sample of the rest (nLinks in all)
// groups: k (neighbourhood sizes) and g: Uint8 [k][seed] the seed's group at that k (0 = largest group)
// hood: Uint16 x hood per module gene, the node indices of its neighbourhood
// terms: the feature matrix's terms; featN: Uint16 per module gene, its number of terms; featI: Uint16, their indices
// tree: mod - 1 merges in scipy order (index < mod a leaf, mod + i merge i): ab Uint16 pairs, h Uint8 height (/255),
//   cut Uint8 1 where the merge joins two endotypes (the test accepts that split), 0 inside an endotype
'''
    js = head + 'const ENDO_DATA = ' + json.dumps(D_, separators=(',', ':')) + ';\n'
    open(OUT, 'w').write(js); print('wrote', OUT, len(js) // 1024, 'KB')

if __name__ == '__main__': main(*sys.argv[1:3])
