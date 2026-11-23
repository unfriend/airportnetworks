#!/usr/bin/env python3
# Writes packages/cdk5/src/sets/data.js (CDK5_DATA) for the CDK5 story from the Menche lab's CDK5_data repository
# (https://github.com/menchelab/CDK5_data, Christiane Hütter): its "CDK5_analytics" VR project, six scenes on the whole
# human interactome, made by CDK5_BioStory_NEW.ipynb with cartoGRAPHs. The repository is kept out of this one: only
# the numbers below go in.
#
# usage (from the repository root):
#   python3 -I packages/cdk5/src/data/gen_data.py <folder of the CDK5_data clone> --go <folder with a GO release>
#   then node packages/cdk5/src/test-data.mjs and node packages/cdk5/src/build.mjs
# The GO folder holds goa_human.gaf.gz and go-basic.obo from https://current.geneontology.org/ (annotations/ and
# ontology/; CC BY 4.0); without --go the process knots (clouds) are left out. Needs numpy, Pillow, scipy and
# scikit-learn (python3 -m pip install numpy pillow scipy scikit-learn). Deterministic: the same inputs give the same
# file. Under a minute.
#
# Where everything comes from (all of it the authors'; nothing is laid out again here):
# - the interactome: input/ppi_elist.txt (309,355 links) over input/DF_gene_symbol_human.csv (16,376 proteins, by
#   Entrez id, in the order every texture uses);
# - each scene's layout, node colours and visible links: the VR project's textures in CDK5_analytics/ (layouts/*.bmp the
#   high bytes and layoutsl/*.bmp the low bytes of each coordinate, 16 bits each, 0..1; layoutsRGB/*.png a node's RGBA;
#   links/00-BIOPROC.bmp every link as two pixels, each a node's pixel in the 128-wide node textures (R + 128 G); linksRGB/*.png a link's RGBA,
#   alpha 0 hidden). Their layouts were made in the notebook by UMAP (GO biological processes on a sphere; Disease
#   Ontology associations in 3D) and spring layouts; the pickles they came from are not in the repository, the textures
#   hold what they gave;
# - the pathways: input/SignallingbyNTRK2.tsv and input/neurodegenerativepathwaysAlzheimers.tsv (Reactome exports);
# - diseases: input/d_gene_do.pkl (gene -> Disease Ontology ids, ancestors included), input/d_do_genes.pkl and
#   input/DO_names.pkl. Pickles can run code: these hold only dicts, lists and strings, and are read by an unpickler
#   that refuses every class.
# What this computes itself (offline, documented in the output): which DO terms are over-represented among CDK5's
# partners and among CDK5's nearest neighbours in the disease landscape (hypergeometric, within proteins that have any
# disease association, Benjamini-Hochberg over the terms tested), a scale for the frames, and the process knots on the
# map of processes (CDK5_DATA.clouds, with --go): the authors' GO matrix (Features_GO_BiolProc_Dataframe_human.pickle) is
# not in the repository, so the knots are named from a current GO release, as follows. Each GO biological process of 12
# to 600 of the map's proteins (annotations propagated to ancestors over is_a and part_of; no NOT; matched by gene
# symbol) is scored by how often its proteins' 15 nearest neighbours on the sphere share it, against chance; the best
# distinct ones (at least 5 times chance, sharing under 30 % of their proteins, their knots at least 15 degrees apart) each get the largest knot
# of its proteins (DBSCAN on their directions) as its place. Most of the map's dense clouds mix many processes in
# today's GO; these knots are where it shows one clearly.
import json, os, pickle, sys, base64, math
import numpy as np
from PIL import Image
from scipy.stats import hypergeom

SRC = sys.argv[1] if len(sys.argv) > 1 else None
GOD = sys.argv[sys.argv.index('--go') + 1] if '--go' in sys.argv else None
if not SRC or not os.path.isdir(os.path.join(SRC, 'CDK5_analytics')):
    sys.exit('usage: python3 -I packages/cdk5/src/data/gen_data.py <folder of the CDK5_data clone>')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sets', 'data.js')
P = lambda *a: os.path.join(SRC, *a)
SCENES = [  # the analytics project's six layouts, in the story's order
    ('bioproc', '00-BIOPROC', 'The map of processes'),
    ('subunits', '01-CDK5-subunits', 'CDK5 and its activators'),
    ('ntrk2', '02-CDK5active-Signalling_by_NTRK2', 'Signalling by NTRK2'),
    ('calpain', '03-CDK5p35-CALPAIN', 'Calpain and CDK5'),
    ('alzheimer', '04-CDK5-hyperactive-alzheimers', "Alzheimer's pathway"),
    ('disease', '05-CDK5-hyperactive_diseaseInference', 'The disease landscape'),
]

class Safe(pickle.Unpickler):
    def find_class(self, m, n): raise pickle.UnpicklingError('a class in a data pickle: refused')
def pkl(f):
    with open(P('input', f), 'rb') as fh: return Safe(fh).load()

# ------------------------------------------------------------------------------------------------- proteins, links --
rows = open(P('input', 'DF_gene_symbol_human.csv'), encoding='utf-8').read().splitlines()[1:]
ids = [r.split(',', 1)[0] for r in rows]
sym = [r.split(',', 1)[1].strip().strip('"').strip('{}').strip("'") for r in rows]
N = len(ids); ix = {e: i for i, e in enumerate(ids)}
assert N == 16376 and len(set(sym)) == N and all(',' not in s for s in sym), 'the protein table changed'
CDK5 = sym.index('CDK5'); R1 = sym.index('CDK5R1'); R2 = sym.index('CDK5R2'); CAPN1 = sym.index('CAPN1')

el = []
for line in open(P('input', 'ppi_elist.txt')):
    a, b = line.split()[:2]; el.append((ix[a], ix[b]))
E = len(el); assert E == 309355
adj = [set() for _ in range(N)]
for a, b in el: adj[a].add(b); adj[b].add(a)
deg = np.array([len(s) for s in adj])

def img(path, mode):
    return np.asarray(Image.open(path).convert(mode))

# links texture: pixel 2k and 2k+1 are link k's two ends, each the node's pixel (x, y) in the 128 x 128 node textures
L = img(P('CDK5_analytics', 'links', '00-BIOPROC.bmp'), 'RGB').reshape(-1, 3).astype(np.int64)
li = L[:, 0] + 128 * L[:, 1]
nl = (int(np.nonzero(li)[0].max()) + 2) // 2
pairs = li[:2 * nl].reshape(-1, 2)
tex_links = set(tuple(sorted(p)) for p in pairs[:E].tolist())
assert tex_links == set(tuple(sorted(p)) for p in el), 'the links texture is not the interactome'
assert nl == E + 1 and sorted(pairs[E].tolist()) == sorted([CDK5, CAPN1]), 'the one added link is not CDK5 - CAPN1'
assert CAPN1 not in adj[CDK5], 'CDK5 - CAPN1 is in the interactome now'

def layout(name):
    hi = img(P('CDK5_analytics', 'layouts', name + '.bmp'), 'RGB').reshape(-1, 3).astype(np.int64)
    lo = img(P('CDK5_analytics', 'layoutsl', name + 'l.bmp'), 'RGB').reshape(-1, 3).astype(np.int64)
    return (hi * 256 + lo)[:N]  # 16-bit, 0..65535 = 0..1
def ncol(name): return img(P('CDK5_analytics', 'layoutsRGB', name + '.png'), 'RGBA').reshape(-1, 4)[:N]
def lcol(name): return img(P('CDK5_analytics', 'linksRGB', name + '.png'), 'RGBA').reshape(-1, 4)[:nl]

pos = {k: layout(f) for k, f, _ in SCENES}
cols = {k: ncol(f) for k, f, _ in SCENES}
lcols = {k: lcol(f) for k, f, _ in SCENES}

# --------------------------------------------------------------------------------------------- annotations, colour --
c0 = cols['bioproc']
grey0 = (c0 == [50, 50, 50, 50]).all(1)
bp = ~grey0  # proteins with a GO biological process (the sphere's inner shell)
assert bp.sum() == 13003
g2do = pkl('d_gene_do.pkl'); do2g = pkl('d_do_genes.pkl'); don = pkl('DO_names.pkl')
dis = np.array([ids[i] in g2do for i in range(N)])
c5 = cols['disease']
assert dis.sum() == 6538 and ((c5[:, 3] != 80) == dis).all(), 'the disease colours are not the DO genes'

def palette(c, mask, alpha):
    # the colours by degree (cartoGRAPHs' colour_nodes_from_dict): one per class of degree; ordered by the degree of
    # their proteins, so index 0 is the least linked
    u = {}
    for i in np.nonzero(mask)[0]:
        t = tuple(int(x) for x in c[i][:3]); assert c[i][3] == alpha
        u.setdefault(t, []).append(deg[i])
    order = sorted(u, key=lambda t: (np.median(u[t]), t))
    at = {t: j for j, t in enumerate(order)}
    idx = np.full(N, 255, np.uint8)
    for i in np.nonzero(mask)[0]: idx[i] = at[tuple(int(x) for x in c[i][:3])]
    return [list(t) for t in order], idx
gpal, gidx = palette(c0, bp, 100)
# the disease palette from the landscape (only CDK5 is recoloured there, red); CDK5's own is the colour its degree gives
# in that palette (the nearest class by degree)
dmask = dis & (np.arange(N) != CDK5)
dpal, didx = palette(c5, dmask, 90)
cls_deg = [np.median([deg[i] for i in np.nonzero(didx == j)[0]]) for j in range(len(dpal))]
didx[CDK5] = int(np.argmin([abs(d - deg[CDK5]) for d in cls_deg]))
assert len(gpal) <= 255 and len(dpal) <= 255

COL = {  # the notebook's named colours (RGBA, alpha 0..255)
    'grey': [50, 50, 50, 50], 'greyL': [80, 80, 80, 40], 'greyD': [80, 80, 80, 80], 'green': [42, 255, 0, 240], 'greenL': [42, 255, 0, 100],
    'cyan': [0, 255, 240, 200], 'red': [255, 0, 0, 200], 'yellow': [255, 255, 0, 200], 'orange': [255, 165, 0, 240],
    'orangeL': [255, 165, 0, 100],
}
def colour_of(k, i):
    # what the scene's texture holds for protein i, rebuilt from the palettes and the scene's own colours
    if k in ('bioproc', 'subunits', 'ntrk2', 'calpain'):
        grey = {'bioproc': 'grey', 'subunits': 'greyL', 'ntrk2': 'greyL', 'calpain': 'greyD'}[k]
        base = gpal[gidx[i]] + [100] if bp[i] else COL[grey]
    else:
        base = dpal[didx[i]] + [90] if dis[i] else COL['greyD']
    return base

# ------------------------------------------------------------------------------------------------------- scenes ----
def b64(a): return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
def vlist(nums):  # unsigned varints
    out = bytearray()
    for v in nums:
        v = int(v)
        while True:
            b = v & 127; v >>= 7
            out.append(b | (128 if v else 0))
            if not v: break
    return out
def idxlist(sorted_idx):  # ascending indices as varint deltas, base64
    prev = 0; d = []
    for v in sorted_idx: d.append(v - prev); prev = v
    return base64.b64encode(bytes(vlist(d))).decode()

named = {tuple(v): k for k, v in COL.items()}
scenes = []
base_sphere = pos['bioproc']
for k, f, title in SCENES:
    lay = pos[k]
    base = 'landscape' if k == 'disease' else 'sphere'
    ref = pos['disease'] if base == 'landscape' else base_sphere
    moved = np.nonzero((lay != ref).any(1))[0].tolist()
    # node colours different from the base palette: the scene's own (named colours)
    special = {}
    for i in range(N):
        t = tuple(int(x) for x in cols[k][i])
        if list(t) != colour_of(k, i):
            assert t in named, (k, sym[i], t)
            special.setdefault(named[t], []).append(i)
    # links: visible ones by colour
    lc = lcols[k]; vis = np.nonzero(lc[:, 3])[0]
    links = {}
    for j in vis:
        t = tuple(int(x) for x in lc[j]); assert t in named, (k, t)
        a, b = sorted(pairs[j].tolist()); links.setdefault(named[t], []).append([a, b])
    scenes.append({'key': k, 'texture': f, 'title': title, 'layout': base,
                   'moved': moved, 'xyz': [lay[i].tolist() for i in moved], 'colours': special, 'links': links})
S = {s['key']: s for s in scenes}
# what each scene's notebook cell did, checked against the textures
assert S['bioproc']['moved'] == [] and S['disease']['moved'] == []
assert sorted(S['subunits']['moved']) == sorted([CDK5, R1, R2])
assert sorted(S['calpain']['moved']) == sorted([CDK5, CAPN1])
assert set(S['subunits']['colours']) == {'green'} and S['subunits']['colours']['green'] == [CDK5]

def tsv(f):
    out = []
    for line in open(P('input', f), encoding='utf-8').read().splitlines()[1:]:
        parts = line.split('\t')
        if len(parts) > 1 and parts[1].strip():
            g = parts[1].split(' ')[1]
            if g in sym and sym.index(g) not in out: out.append(sym.index(g))
    return out
ntrk2 = tsv('SignallingbyNTRK2.tsv'); alz = tsv('neurodegenerativepathwaysAlzheimers.tsv')
assert set(S['ntrk2']['moved']) <= set(ntrk2) | {R1, R2} and len(ntrk2) == 25
alz_moved = set(S['alzheimer']['moved'])
assert alz_moved <= set(alz) | {R1, R2}

# each scene's centre: the proteins it pulls to the middle of the map (the notebook's spring layouts)
for s in scenes:
    s['centre'] = sorted(set(s['moved']) | ({CDK5} if s['key'] in ('subunits', 'ntrk2', 'calpain', 'alzheimer') else set()))

# ----------------------------------------------------------------------------------------------- diseases ----------
annotated = [i for i in range(N) if dis[i]]; NA = len(annotated)
term_genes = {}
for d, gs in do2g.items():
    m = sorted({ix[g] for g in gs if g in ix})
    if m: term_genes[d] = m
for d in term_genes: assert d in don, d
partners = sorted(adj[CDK5]); pa = [i for i in partners if dis[i]]
def enrich(group, min_size=10, max_size=2000):
    g = set(group); n = len(g); res = []
    for d, m in term_genes.items():
        K = len(m)
        if K < min_size or K > max_size: continue
        k = sum(1 for i in m if i in g)
        if k == 0: continue
        p = float(hypergeom.sf(k - 1, NA, K, n))
        res.append({'id': d, 'name': don[d], 'size': K, 'k': k, 'exp': n * K / NA, 'p': p})
    res.sort(key=lambda r: r['p'])
    m = len(res); prev = 1.0
    for r_i in range(m - 1, -1, -1):  # Benjamini-Hochberg
        q = min(prev, res[r_i]['p'] * m / (r_i + 1)); res[r_i]['q'] = q; prev = q
    return res
en_part = enrich(pa)
# CDK5's nearest neighbours in the disease landscape (its own diseases' company): the 30 nearest proteins with a
# disease association, by the landscape's 3D distance
L5 = pos['disease'].astype(float) / 65535
dd = np.linalg.norm(L5[annotated] - L5[CDK5], axis=1)
near = [annotated[j] for j in np.argsort(dd) if annotated[j] != CDK5][:30]
en_near = enrich(near, min_size=10)

cdk5_terms = sorted(g2do[ids[CDK5]], key=lambda d: len(term_genes.get(d, [])))
# terms offered in explore: CDK5's own, the partners' most over-represented (q < 0.05), the neighbours' (q < 0.05), a
# named set of brain diseases and two contrasts
NAMED = ["Alzheimer's disease", "Parkinson's disease", 'amyotrophic lateral sclerosis', "Huntington's disease",
         'neurodegenerative disease', 'lissencephaly', 'intellectual disability', 'autism spectrum disorder',
         'epilepsy', 'schizophrenia', 'bipolar disorder', 'cognitive disorder', 'pontocerebellar hypoplasia',
         'microcephaly', 'cancer', 'cardiovascular system disease']
byname = {don[d]: d for d in term_genes}
pick = []
for d in cdk5_terms:
    if d in term_genes and len(term_genes[d]) <= 2000 and don[d] not in ('disease', 'syndrome'): pick.append(d)
for r in en_part[:40]:
    if r['q'] < 0.05: pick.append(r['id'])
for r in en_near[:20]:
    if r['q'] < 0.05: pick.append(r['id'])
for nm in NAMED:
    if nm in byname: pick.append(byname[nm])
seen = set(); terms = []
part_by = {r['id']: r for r in enrich(pa, min_size=1, max_size=10 ** 6)}
near_by = {r['id']: r for r in enrich(near, min_size=1, max_size=10 ** 6)}
for d in pick:
    if d in seen: continue
    seen.add(d); m = term_genes[d]
    rp = part_by.get(d); rn = near_by.get(d)
    terms.append({'id': d, 'name': don[d], 'n': len(m), 'genes': idxlist(m), 'cdk5': d in g2do[ids[CDK5]],
                  'partners': rp['k'] if rp else 0, 'expP': round(len(pa) * len(m) / NA, 2),
                  'pP': float('%.3g' % rp['p']) if rp else 1.0,
                  'near': rn['k'] if rn else 0, 'expN': round(len(near) * len(m) / NA, 2),
                  'pN': float('%.3g' % rn['p']) if rn else 1.0})
terms.sort(key=lambda t: (not t['cdk5'], t['name'].lower()))
def tops(res, n=12):
    return [{'id': r['id'], 'name': r['name'], 'size': r['size'], 'k': r['k'], 'exp': round(r['exp'], 2),
             'fold': round(r['k'] / r['exp'], 2), 'p': float('%.3g' % r['p']), 'q': float('%.3g' % r['q'])}
            for r in res[:n]]

# ----------------------------------------------------------------------------------------------- adjacency ---------
# each link once, from its lower index: per protein the count of higher neighbours, then their index deltas (varints)
buf = bytearray()
for i in range(N):
    hi = sorted(j for j in adj[i] if j > i)
    buf += vlist([len(hi)])
    buf += vlist([b - a for a, b in zip([i] + hi[:-1], hi)])
adj64 = base64.b64encode(bytes(buf)).decode()

# ------------------------------------------------------------------------------------- process knots (with --go) ---
clouds = []; go_about = None
if GOD:
    import gzip
    from sklearn.cluster import DBSCAN
    from sklearn.neighbors import NearestNeighbors
    sys.setrecursionlimit(20000)
    par, gname, cur, ver = {}, {}, None, ''
    for line in open(os.path.join(GOD, 'go-basic.obo'), encoding='utf-8'):
        line = line.strip()
        if line.startswith('data-version:'): ver = line.split(':', 1)[1].strip()
        if line.startswith('['): cur = None; continue
        if line.startswith('id: GO:'): cur = line[4:]; par[cur] = []
        elif cur and line.startswith('name: '): gname[cur] = line[6:]
        elif cur and line.startswith('is_a: '): par[cur].append(line[6:16])
        elif cur and line.startswith('relationship: part_of '): par[cur].append(line[22:32])
    anc = {}
    def ancestors(t):
        if t not in anc:
            r = {t}
            for q in par.get(t, ()): r |= ancestors(q)
            anc[t] = r
        return anc[t]
    bysym = {x.upper(): i for i, x in enumerate(sym)}
    g2t = {}
    for line in gzip.open(os.path.join(GOD, 'goa_human.gaf.gz'), 'rt', encoding='utf-8'):
        if line[0] == '!': continue
        f = line.split('\t')
        if f[8] != 'P' or 'NOT' in f[3] or f[4] not in par: continue
        i = bysym.get(f[2].upper())
        if i is None or not bp[i]: continue
        g2t.setdefault(i, set()).update(ancestors(f[4]))
    idx = np.nonzero(bp)[0]
    U = (base_sphere.astype(float) / 65535) - 0.5
    V = U / np.linalg.norm(U, axis=1, keepdims=True)
    NB = NearestNeighbors(n_neighbors=16).fit(V[idx]).kneighbors(V[idx])[1][:, 1:]
    posin = {int(i): j for j, i in enumerate(idx)}
    tg = {}
    for i, ts in g2t.items():
        for t in ts: tg.setdefault(t, set()).add(i)
    scored = []
    for t, G in tg.items():
        K = len(G)
        if K < 12 or K > 600: continue
        mem = np.zeros(len(idx), bool); mem[[posin[i] for i in G]] = True
        share = float(mem[NB[mem]].mean()); fold = share / (K / len(idx))
        scored.append((share * fold * math.sqrt(K), t, share, fold))
    scored.sort(key=lambda r: (-r[0], r[1]))
    picked = []
    for sc, t, share, fold in scored:
        if len(clouds) >= 14: break
        G = tg[t]
        if fold < 5 or any(len(G & tg[q]) / len(G | tg[q]) > 0.3 for q in picked): continue
        mi = sorted(G); lab = DBSCAN(eps=0.06, min_samples=4).fit(V[mi]).labels_
        if (lab >= 0).sum() == 0: continue
        big = np.bincount(lab[lab >= 0]).argmax(); knot = [mi[j] for j in np.nonzero(lab == big)[0]]
        d = V[knot].mean(0); d /= np.linalg.norm(d)
        if any(np.degrees(np.arccos(np.clip(d @ np.array(c['dir']), -1, 1))) < 15 for c in clouds): continue
        r = float(np.mean(np.linalg.norm(U[knot], axis=1))) * 2.4
        picked.append(t)
        clouds.append({'id': t, 'name': gname[t], 'size': len(G), 'n': len(knot), 'share': round(share, 3),
                       'fold': round(fold, 1), 'dir': [round(float(x), 4) for x in d],
                       'centre': [round(float(x) * r, 4) for x in d], 'knot': idxlist(sorted(knot)),
                       'members': idxlist(mi)})
    go_about = {'release': ver, 'annotated': len(g2t), 'source': 'Gene Ontology (goa_human.gaf, go-basic.obo), CC BY 4.0',
                'method': 'per GO biological process of 12 to 600 of the map\'s proteins: the share of its proteins\' 15 '
                          'nearest neighbours on the sphere that share it, against chance; the 14 best distinct at least 5 times chance, each at '
                          'its largest knot (DBSCAN); names from a current GO release, not the authors\' matrix'}
    for c in clouds: del c['dir']
else:
    print('no --go: the process knots are left out')

# --------------------------------------------------------------------------------------------------- facts --------
cdk_family = [i for i in range(N) if sym[i].startswith('CDK') and sym[i][3:].isdigit()]
u = (base_sphere.astype(float) / 65535) - 0.5; u /= np.linalg.norm(u, axis=1, keepdims=True)
ang = lambda i, j: float(np.degrees(np.arccos(np.clip(u[i] @ u[j], -1, 1))))
rank = int((deg > deg[CDK5]).sum()) + 1
def links_of(k): return sum(len(v) for v in S[k]['links'].values())
facts = {
    'proteins': N, 'links': E, 'withProcess': int(bp.sum()), 'withDisease': int(dis.sum()), 'terms': len(term_genes),
    'cdk5': {'deg': int(deg[CDK5]), 'rank': rank, 'partnersWithDisease': len(pa), 'terms': len(g2do[ids[CDK5]])},
    'hub': {'sym': sym[int(np.argmax(deg))], 'deg': int(deg.max())},
    'family': [{'i': i, 'sym': sym[i], 'deg': round(ang(CDK5, i), 1)} for i in cdk_family],
    'activators': {'p35': round(ang(CDK5, R1), 1), 'p39': round(ang(CDK5, R2), 1)},
    'sceneLinks': {s['key']: links_of(s['key']) for s in scenes},
    'pathways': {'ntrk2': len(ntrk2), 'alzheimer': len(alz), 'alzheimerShown': len(alz_moved | {CDK5})},
    'added': [CDK5, CAPN1],
}

D = {
    'about': "the Menche lab's CDK5_data repository (github.com/menchelab/CDK5_data, Christiane Hütter): its "
             "CDK5_analytics VR project, six scenes on the human interactome made with cartoGRAPHs, with the "
             "Reactome pathways and Disease Ontology associations it uses",
    'n': N, 'e': E, 'cdk5': CDK5, 'r1': R1, 'r2': R2, 'capn1': CAPN1,
    'sym': ','.join(sym),
    'adj': adj64,
    'pos': {'sphere': b64(base_sphere.astype('<u2')), 'landscape': b64(pos['disease'].astype('<u2'))},
    'bp': b64(np.packbits(bp, bitorder='little')), 'dis': b64(np.packbits(dis, bitorder='little')),
    'pal': {'go': gpal, 'dz': dpal}, 'gidx': b64(gidx), 'didx': b64(didx),
    'col': COL,
    'scenes': [{'key': s['key'], 'title': s['title'], 'texture': s['texture'], 'layout': s['layout'],
                'centre': s['centre'], 'moved': s['moved'], 'xyz': s['xyz'], 'colours': s['colours'],
                'links': {c: b64(np.array(v, '<u2').ravel()) for c, v in s['links'].items()},
                'nlinks': {c: len(v) for c, v in s['links'].items()}} for s in scenes],
    'pathways': {
        'ntrk2': {'name': 'Signalling by NTRK2', 'source': 'Reactome', 'members': ntrk2},
        'alzheimer': {'name': 'Deregulated CDK5 triggers multiple neurodegenerative pathways in Alzheimer\'s disease models',
                      'short': "CDK5 in Alzheimer's disease", 'source': 'Reactome (our reading of the file\'s name)',
                      'members': alz, 'shown': sorted(alz_moved | {CDK5})},
    },
    'diseases': {'annotated': NA, 'partnersAnnotated': len(pa), 'cdk5Terms': [don[d] for d in cdk5_terms],
                 'terms': terms, 'partnerTop': tops(en_part), 'near': near, 'nearTop': tops(en_near),
                 'method': 'hypergeometric over the proteins with any Disease Ontology association (ancestors '
                           'included), terms of 10 to 2,000 proteins, Benjamini-Hochberg'},
    'facts': facts,
    'clouds': clouds, 'go': go_about,
}
js = json.dumps(D, separators=(',', ':'), ensure_ascii=False)
hdr = ("// Generated by packages/cdk5/src/data/gen_data.py from the Menche lab's CDK5_data repository (its CDK5_analytics VR "
       "project); do not edit.\n// See the generator's header and packages/cdk5/src/SPEC.md for what each field holds; decode it "
       "with CDATA (sets/cdata.js).\n")
with open(OUT, 'w', encoding='utf-8') as fh: fh.write(hdr + 'const CDK5_DATA = ' + js + ';\n')
print('wrote', os.path.relpath(OUT), '%.0f KB' % (len(js) / 1024))
print('scenes', {s['key']: (len(s['centre']), {c: len(v) for c, v in s['links'].items()}, {c: len(v) for c, v in s['colours'].items()}) for s in scenes})
print('CDK5 degree', int(deg[CDK5]), 'rank', rank, 'partners with disease', len(pa), 'of', len(partners))
print('partner top', [(r['name'], r['k'], round(r['exp'], 1), '%.2g' % r['q']) for r in en_part[:12]])
print('near top', [(r['name'], r['k'], round(r['exp'], 1), '%.2g' % r['q']) for r in en_near[:10]], [sym[i] for i in near[:12]])
print('family', [(f['sym'], f['deg']) for f in facts['family']], facts['activators'])
print('terms offered', len(terms))
print('process knots', [(c['name'], c['n'], c['size'], c['fold']) for c in clouds])
