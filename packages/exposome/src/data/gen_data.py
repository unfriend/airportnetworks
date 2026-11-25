# Generates the exposome story's data from the authors' deposit (Lombardo, Hutter, Unterlass, Menche, Nat Commun 2026;
# Zenodo record 18793297, CC BY 4.0): derived numbers only, never the deposit's files themselves.
#
# usage (from the repository root, Python 3.10+, numpy, pandas, openpyxl: requirements.txt):
#   node packages/exposome/src/data/gen_cell.mjs > /tmp/cell.json        (Back into the cell's model cell, run in Node)
#   python3 -I packages/exposome/src/data/gen_data.py <deposit folder> /tmp/cell.json
# <deposit folder> is the unpacked zip's top folder, Exposurome_withfiles/ (its input/, intermediate/, output/).
# Writes:
#   packages/exposome/src/sets/data.js   EXPO_DATA, embedded in main.js (counts, substances, communities, drawn links,
#                                        countries, the story's examples)
#   packages/exposome/data/targets.bin   every substance's genes (573,673 pairs), the genes' symbols   (on demand)
#   packages/exposome/data/ppi.bin       the interactome: proteins, their places and two arrangements, drawn links
#   packages/exposome/data/diseases.bin  6,177 diseases, their genes, the 176,259 close pairs (z < -5) with co-citations
#   packages/exposome/data/names.json    every substance's CTD id and full name (search)
#   packages/exposome/src/data/terms.json  each community's top enriched terms (what labels.json is written from)
# labels.json (hand-written, next to this file) gives communities their plain words; the generator only reads it.
# The pickles are read with a restricted unpickler (numpy, pandas and plain containers only); nothing in the deposit
# is run. The same inputs give the same files, byte for byte.
import sys, os, json, math, struct, base64, pickle, collections, hashlib, re, warnings
warnings.filterwarnings('ignore')
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.normpath(os.path.join(HERE, '..', '..'))
if len(sys.argv) < 3:
    sys.exit('usage: gen_data.py <deposit folder Exposurome_withfiles> <cell.json from gen_cell.mjs>')
DEP, CELL_JSON = sys.argv[1], sys.argv[2]
P = lambda *a: os.path.join(DEP, *a)

class Unp(pickle.Unpickler):
    OK = ('numpy', 'pandas', 'collections', 'copyreg', 'copy_reg', '_codecs', 'datetime')
    def find_class(self, m, n):
        if m == 'builtins' and n in ('set', 'frozenset', 'dict', 'list', 'tuple', 'slice', 'complex', 'bytearray', 'range', 'object'):
            return super().find_class(m, n)
        if m.split('.')[0] in self.OK:
            return super().find_class(m, n)
        raise pickle.UnpicklingError('blocked %s.%s' % (m, n))
def pk(*a):
    with open(P(*a), 'rb') as f:
        return Unp(f).load()
def tsv(*a):
    with open(P(*a), encoding='utf8') as f:
        rows = [l.rstrip('\n').split('\t') for l in f]
    return rows[0], rows[1:]
def log(*a): print(*a, file=sys.stderr)

# ---------------------------------------------------------------- substances and their genes (CTD, human)
_, rows = tsv('output', 'chem_gene_ref_df.tsv')
SG = collections.defaultdict(set)
for r in rows: SG[r[1]].add(r[2])
nPairs = sum(len(v) for v in SG.values())
geneSubs = collections.Counter(g for v in SG.values() for g in v)
log('substance-gene pairs', nPairs, 'substances', len(SG), 'genes', len(geneSubs))

# names: the network's properties file (network nodes) and CTD's name table; synonyms for short labels
import csv
props = list(csv.reader(open(P('output', 'VR', 'Exposurome_properties.csv'), encoding='utf8')))
NET_IDS = [r[0] for r in props]
NAME = {}
for l in open(P('output', 'CTDNameID.txt'), encoding='utf8'):
    p = l.rstrip('\n').split('\t')
    if len(p) >= 2 and p[0] != 'nan': NAME[p[0]] = p[1]
for r in props: NAME[r[0]] = r[1]
SYN, CTDCLS = {}, {}
for l in open(P('input', 'CTD', 'CTD_chemicals_cleaned.txt'), encoding='utf8'):
    if l.startswith('#'): continue
    p = l.rstrip('\n').split('\t')
    if len(p) < 8: continue
    CTDCLS[p[1]] = p[0]
    SYN[p[1]] = [s for s in p[7].split('|') if s]
others = sorted(set(SG) - set(NET_IDS))
IDS = NET_IDS + others              # network nodes in the authors' VR order, then the substances without links
IX = {e: i for i, e in enumerate(IDS)}
NS, NN = len(IDS), len(NET_IDS)
log('substances', NS, 'network nodes', NN)

def short(name, syns):
    # a label: the name, a drug combination's "drug combination" left out, cut at a word or bracket when still long
    # (never a synonym: CTD's short synonyms are often brand names, which the story never shows)
    name = name.strip()
    m = re.fullmatch(r'(.+?),? (?:drug )?combination', name)
    if m: name = m.group(1).replace(', ', ' and ')
    if len(name) <= 34: return name
    cut = name[:32]
    k = max(cut.rfind(' '), cut.rfind(','), cut.rfind('-'))
    return (cut[:k] if k > 14 else cut).rstrip(' ,-(') + '…'
FULL = [NAME.get(e, e) for e in IDS]
LABEL = [short(FULL[i], SYN.get(e, [])) for i, e in enumerate(IDS)]

# ---------------------------------------------------------------- chemistry: MeSH top classes (the authors' d_classes)
dcl = pk('intermediate', 'd_classes.pickle')
import openpyxl
wb1 = openpyxl.load_workbook(P('output', 'Source_Data_exposurome_part1.xlsx'), read_only=True)
fig1a = {r[0]: r[3] for r in list(wb1['Fig1A'].iter_rows(values_only=True))[1:]}
CLASS_IDS = sorted(dcl, key=lambda k: -len(dcl[k]))            # largest family first
CLASS_NAMES = [CTDCLS.get(k, k) for k in CLASS_IDS]
CLASS_COUNT = [len(set(dcl[k])) for k in CLASS_IDS]
CLASS_COL = [fig1a.get(n, '#999999') for n in CLASS_NAMES]   # the authors' colours (Source Data Fig1A)
cmask = [0] * NS
for c, k in enumerate(CLASS_IDS):
    for e in dcl[k]:
        if e in IX: cmask[IX[e]] |= 1 << c
# each substance's own shelf: the rarest of its families (so a small family keeps its members); 12: none
order_rare = sorted(range(len(CLASS_IDS)), key=lambda c: CLASS_COUNT[c])
prim = [next((c for c in order_rare if cmask[i] >> c & 1), len(CLASS_IDS)) for i in range(NS)]
log('classes', list(zip(CLASS_NAMES, CLASS_COUNT)), 'none', prim.count(len(CLASS_IDS)))

# ---------------------------------------------------------------- the network: the authors' layout, colours, links
pos = np.array([[float(x) for x in r] for r in csv.reader(open(P('output', 'VR', 'Exposuromepos3d_louvain.csv')))])
col = [tuple(int(x) for x in r[:3]) for r in csv.reader(open(P('output', 'VR', 'Exposuromecol_louvain.csv')))]
assert len(pos) == NN and len(col) == NN
ctr = (pos.max(0) + pos.min(0)) / 2
pos = pos - ctr
pos /= np.abs(pos).max()           # into [-1, 1], the authors' proportions kept
EDGES = []
for l in open(P('output', 'backbone_exp_graph_significant_weighted.edgelist')):
    a, b, w = l.split()
    EDGES.append((IX[a], IX[b], float(w)))
# the significant links before the backbone was taken (the "strongest tenth"): counted, when the file is there
unf = P('output', 'unfiltered_weighted_exp_graph_significant.edgelist')
nUnf = sum(1 for _ in open(unf, 'rb')) if os.path.exists(unf) else None
deg = [0] * NS
for a, b, w in EDGES: deg[a] += 1; deg[b] += 1
log('edges', len(EDGES), 'max degree', max(deg), FULL[deg.index(max(deg))])
# the links drawn: each substance's 3 strongest, then the strongest overall, up to DRAWN in all (ties by index)
DRAWN = 45000
byn = collections.defaultdict(list)
for j, (a, b, w) in enumerate(EDGES): byn[a].append((-w, j)); byn[b].append((-w, j))
keep = set()
for n, l in byn.items():
    for _, j in sorted(l)[:3]: keep.add(j)
n3 = len(keep)
for j in sorted(range(len(EDGES)), key=lambda j: (-EDGES[j][2], j)):
    if len(keep) >= DRAWN: break
    keep.add(j)
keep = sorted(keep, key=lambda j: (-EDGES[j][2], j))
log('drawn links', len(keep), '(each node\'s 3 strongest:', n3, ')')

# ---------------------------------------------------------------- Louvain communities, three levels (renamed as the authors did)
L = ('output', 'Communities', 'Louvain')
it1 = pk(*L, 'weighted_ee_ji_first_louvain_iteration.pickle')       # middle raw -> [fine raw]
it2 = pk(*L, 'weighted_ee_ji_second_louvain_iteration.pickle')      # top raw -> [middle raw]
ex1 = pk(*L, 'weighted_ee_ji_first_louvain_iteration_exposures.pickle')
ex2 = pk(*L, 'weighted_ee_ji_second_louvain_iteration_exposures.pickle')
ex3 = pk(*L, 'weighted_ee_ji_third_louvain_iteration_exposures.pickle')
# (Exp_fin_4_Louvain_Clustering, cell 40: tops numbered by size, a level that does not split keeps its parent's name)
top_name = {com: str(c + 1) for c, com in enumerate(sorted(ex3, key=lambda k: -len(ex3[k])))}
mid_name = {}
for br, mids in it2.items():
    if len(mids) == 1: mid_name[mids[0]] = top_name[br]
    else:
        for q, m in enumerate(sorted(mids, key=lambda m: -len(ex2[m]))): mid_name[m] = top_name[br] + '_' + str(q + 1)
fine_name = {}
for md, fins in it1.items():
    if len(fins) == 1: fine_name[fins[0]] = mid_name[md]
    else:
        for q, f in enumerate(sorted(fins, key=lambda f: -len(ex1[f]))): fine_name[f] = mid_name[md] + '_' + str(q + 1)
mid_of_fine = {f: md for md, fins in it1.items() for f in fins}
top_of_mid = {m: br for br, mids in it2.items() for m in mids}
dep_fine = pk(*L, 'weighted_ji_fine_grained_communities_dict.pickle')
assert {k: set(v) for k, v in dep_fine.items()} == {fine_name[f]: set(v) for f, v in ex1.items()}, 'fine communities differ from the deposit'
TOPS = sorted(ex3, key=lambda k: -len(ex3[k]))
MIDS = sorted(ex2, key=lambda m: (TOPS.index(top_of_mid[m]), -len(ex2[m])))
FINES = sorted(ex1, key=lambda f: (MIDS.index(mid_of_fine[f]), -len(ex1[f])))
COMM = []   # every community: level 0 top (125), 1 middle (152), 2 fine (456)
for lv, lst, ex, nm in ((0, TOPS, ex3, top_name), (1, MIDS, ex2, mid_name), (2, FINES, ex1, fine_name)):
    for c in lst: COMM.append({'lv': lv, 'raw': c, 'id': nm[c], 'members': set(ex[c])})
ci = {(c['lv'], c['raw']): k for k, c in enumerate(COMM)}
for c in COMM:
    c['parent'] = -1 if c['lv'] == 0 else ci[(0, top_of_mid[c['raw']])] if c['lv'] == 1 else ci[(1, mid_of_fine[c['raw']])]
fineOf = [0xFFFF] * NS
for k, c in enumerate(COMM):
    if c['lv'] == 2:
        for e in c['members']: fineOf[IX[e]] = k - len(TOPS) - len(MIDS)
# the community's colour: the authors' VR colour of its members (the VR colours follow the top level)
for c in COMM:
    cs = collections.Counter(col[IX[e]] for e in c['members'] if IX[e] < NN)
    c['col'] = '#%02x%02x%02x' % cs.most_common(1)[0][0]
# the deposit's named levels (13 broad, 50 middle: those that split further), and their enrichment (Enrichr, FDR)
named = {}
for lvname, f, enr in (('broad', 'weighted_ji_broad_communities_dict.pickle', 'significant_enrichment_third_louvain_cluster_fdr.pickle'),
                       ('middle', 'weighted_ji_middle_communities_dict.pickle', 'significant_enrichment_second_louvain_cluster_fdr.pickle'),
                       ('fine', 'weighted_ji_fine_grained_communities_dict.pickle', 'significant_enrichment_first_louvain_cluster_fdr.pickle')):
    d, e = pk(*L, f), pk(*L, enr)
    for k, v in d.items(): named.setdefault(frozenset(v), []).append((lvname, k, e.get(k)))
NAMED13 = sorted(pk(*L, 'weighted_ji_broad_communities_dict.pickle'), key=int)
TERMS = {}
for k, c in enumerate(COMM):
    c['dep'] = [(a, b) for a, b, _ in named.get(frozenset(c['members']), [])]
    best = None
    for a, b, df in named.get(frozenset(c['members']), []):
        if df is not None and len(df): best = df; break
    terms = []
    if best is not None:
        df = best[best['FDR'] < 0.05].sort_values(['FDR', 'Term'])
        terms = [[str(t), float('%.3g' % q)] for t, q in zip(df['Term'][:8], df['FDR'][:8])]
    c['terms'] = terms
LV = ['top', 'mid', 'fine']
labels_path = os.path.join(HERE, 'labels.json')
LABELS = json.load(open(labels_path, encoding='utf8')) if os.path.exists(labels_path) else {}
for c in COMM:
    c['label'] = (LABELS.get(LV[c['lv']], {}) or {}).get(c['id'])
with open(os.path.join(HERE, 'terms.json'), 'w', encoding='utf8') as f:
    out = {LV[lv]: {c['id']: {'n': len(c['members']), 'in': c['dep'] and c['dep'][0][0] + ' ' + c['dep'][0][1] or None, 'terms': c['terms'],
                               'sample': sorted(LABEL[IX[e]] for e in sorted(c['members'], key=lambda e: -len(SG.get(e, ())))[:8])}
                     for c in COMM if c['lv'] == lv and len(c['members']) >= (20 if lv else 1)} for lv in range(3)}
    json.dump(out, f, indent=1, ensure_ascii=False)
    f.write('\n')
log('communities', [sum(c['lv'] == lv for c in COMM) for lv in range(3)], 'tops >= 50:', sum(len(c['members']) >= 50 for c in COMM if c['lv'] == 0))

# ---------------------------------------------------------------- the interactome, patterns, hazard
ppi_rows = [l.strip().split(',') for l in open(P('input', 'PPI', 'autocore_symbol_lcc.csv'))][1:]
pairs = set()
for a, b in ppi_rows: pairs.add((a, b) if a <= b else (b, a))
ADJ = collections.defaultdict(set)
for a, b in pairs:
    if a != b: ADJ[a].add(b); ADJ[b].add(a)
PROT = sorted(ADJ, key=lambda s: (-len(ADJ[s]), s))       # best connected first
PX = {s: i for i, s in enumerate(PROT)}
PDEG = [len(ADJ[s]) for s in PROT]
log('interactome', len(PROT), 'links', len(pairs), '(without self-links', sum(len(v) for v in ADJ.values()) // 2, ')')
_, rows = tsv('output', 'exp_ppi_df.tsv')
PAT_NAMES = ['Central-module exposure', 'Hub-exposure', 'Peripheral-module exposure', 'Scattered exposure']
pat = [255] * NS
patc = collections.Counter()
for r in rows:
    t = r[2]
    k = next((i for i, n in enumerate(PAT_NAMES) if t.lower().startswith(n.lower()[:7])), None)
    assert k is not None, t
    patc[k] += 1
    if r[1] in IX: pat[IX[r[1]]] = k
nPat = len(rows)
_, rows = tsv('output', 'exp_haz_df.tsv')
haz = [255] * NS
hz, md = [], []
for r in rows:
    if r[4] in ('', 'nan'): continue
    if r[1] in IX: haz[IX[r[1]]] = int(round(float(r[4]) * 100))
    hz.append(float(r[4])); md.append(float(r[3]))
hazR = float(np.corrcoef(md, hz)[0, 1])
haz_by_pat = {}
for k in range(4):
    v = [haz[i] / 100 for i in range(NS) if pat[i] == k and haz[i] != 255]
    haz_by_pat[k] = round(float(np.mean(v)), 4)
nPPIg = [0] * NS; maxDeg = [0] * NS
for e, gs in SG.items():
    i = IX[e]
    d = [len(ADJ[g]) for g in gs if g in ADJ]
    nPPIg[i] = len(d); maxDeg[i] = max(d) if d else 0
log('patterns', dict(patc), 'of', nPat, 'hazard', len(hz), 'r', round(hazR, 4), 'by pattern', haz_by_pat)

# ---------------------------------------------------------------- diseases (DisGeNET score > 0.4, genes in the interactome)
f = open(P('input', 'Disease', 'all_gene_disease_associations.tsv'), encoding='utf8'); h = f.readline().rstrip('\n').split('\t')
DG = collections.defaultdict(list)
for l in f:
    p = l.rstrip('\n').split('\t')
    if float(p[9]) > 0.4 and p[1] in ADJ: DG[p[5]].append(p[1])     # (as the authors: a list, a gene once per row)
DIS = sorted(DG)
DX = {d: i for i, d in enumerate(DIS)}
log('diseases', len(DIS), 'pairs', sum(len(set(v)) for v in DG.values()))
_, rows = tsv('output', 'exp_dis_cit_df.tsv')
CLOSE = []
for r in rows: CLOSE.append((IX[r[1]], DX[r[2]], float(r[3]), int(float(r[4]))))
CLOSE.sort(key=lambda x: (x[0], x[2], x[1]))
fdr = pk('output', 'exp_random', 'new_significant_exp_dis_proximity_pval_adj.pickle')
nNear = [0] * NS; disNear = [0] * len(DIS)
for (e, d) in fdr:
    nNear[IX[e]] += 1; disNear[DX[d]] += 1
nClose = [0] * NS
for s, d, z, c in CLOSE: nClose[s] += 1
nOverlap = len(pk('output', 'exp_random', 'new_signficant_exp_dis_overlap_adj.pickle'))
nExpPPI = sum(1 for e, gs in SG.items() if any(g in ADJ for g in gs))
log('proximity: near (FDR)', len(fdr), 'close (z<-5)', len(CLOSE), 'overlap', nOverlap, 'tested', nExpPPI, 'x', len(DIS))

# ---------------------------------------------------------------- countries (EEA releases, the authors' selections, GBD)
wb2 = openpyxl.load_workbook(P('output', 'Source_Data_exposurome_part2.xlsx'), read_only=True)
air = pk('output', 'GBD', 'air_country_selected_chem_id_dict.pickle')
water = pk('intermediate', 'country_selected_chem_id_water_dict.pickle')
_, rows = tsv('output', 'Country_risk.tsv')
risk = {r[1]: [int(r[2]), int(r[3]), float(r[4]), float(r[5])] for r in rows}
riskTot = sum(v[3] for v in risk.values())
# approximate centres (latitude, longitude) for the globe: ours, not the authors'
LATLON = {'Austria': (47.6, 14.1), 'Belgium': (50.6, 4.6), 'Bulgaria': (42.7, 25.3), 'Croatia': (45.2, 15.6), 'Cyprus': (35.0, 33.2),
          'Czechia': (49.8, 15.5), 'Denmark': (56.0, 10.0), 'Estonia': (58.7, 25.5), 'Finland': (62.5, 26.0), 'France': (46.6, 2.4),
          'Germany': (51.1, 10.4), 'Greece': (39.3, 22.0), 'Hungary': (47.2, 19.4), 'Iceland': (64.9, -18.6), 'Ireland': (53.2, -8.0),
          'Italy': (42.8, 12.6), 'Latvia': (56.9, 24.9), 'Lithuania': (55.3, 23.9), 'Luxembourg': (49.8, 6.1), 'Malta': (35.9, 14.4),
          'Netherlands': (52.2, 5.5), 'Norway': (61.0, 9.0), 'Poland': (52.0, 19.4), 'Portugal': (39.6, -8.0), 'Romania': (45.9, 24.9),
          'Serbia': (44.0, 20.9), 'Slovakia': (48.7, 19.7), 'Slovenia': (46.1, 14.8), 'Spain': (40.2, -3.6), 'Sweden': (62.0, 15.0),
          'Switzerland': (46.8, 8.2), 'United Kingdom': (54.0, -2.5)}
# proximal against distant diseases' incidence per country (Source Data Fig4E air, Fig4F water): mean z of each, and
# a one-sided Mann-Whitney test (normal approximation with tie correction and continuity, as scipy's default here)
def mwu_greater(x, y):
    n1, n2 = len(x), len(y); v = list(x) + list(y)
    o = sorted(range(len(v)), key=lambda i: v[i]); r = [0.0] * len(v); tc = 0; i = 0
    while i < len(o):
        j = i
        while j + 1 < len(o) and v[o[j + 1]] == v[o[i]]: j += 1
        for k in range(i, j + 1): r[o[k]] = (i + j) / 2 + 1
        t = j - i + 1; tc += t ** 3 - t; i = j + 1
    U = sum(r[:n1]) - n1 * (n1 + 1) / 2; n = n1 + n2
    s = math.sqrt(n1 * n2 / 12 * ((n + 1) - tc / (n * (n - 1))))
    return 0.5 * math.erfc(((U - n1 * n2 / 2 - 0.5) / s) / math.sqrt(2))
prox = {}
for key, sheet in (('air', 'Fig4E'), ('water', 'Fig4F')):
    d = collections.defaultdict(lambda: collections.defaultdict(list))
    for r in list(wb2[sheet].iter_rows(values_only=True))[1:]: d[r[0]][r[2]].append(float(r[1]))
    prox[key] = {c: [round(float(np.mean(v['proximal'])), 3), round(float(np.mean(v['distant'])), 3), float('%.3g' % mwu_greater(v['proximal'], v['distant']))] for c, v in d.items()}
def spearman(x, y):
    rk = lambda v: np.argsort(np.argsort(v, kind='stable'), kind='stable').astype(float)
    def avg(v):   # average ranks for ties
        v = np.asarray(v, float); o = np.argsort(v, kind='stable'); r = np.empty(len(v)); i = 0
        while i < len(v):
            j = i
            while j + 1 < len(v) and v[o[j + 1]] == v[o[i]]: j += 1
            r[o[i:j + 1]] = (i + j) / 2 + 1; i = j + 1
        return r
    return float(np.corrcoef(avg(x), avg(y))[0, 1])
f4d = [r for r in list(wb2['Fig4D'].iter_rows(values_only=True))[1:] if r[2] == 'Raw']
# (Fig4D gives each pair's proximity binned: -2, -3 ... -10 and '>-2', taken as -1; the paper's own value, from the
# unbinned z, is the notebook's: Exp_fin_10, cell 236, Spearman -0.265)
rho4d = spearman([-1.0 if r[1] == '>-2' else float(r[1]) for r in f4d], [float(r[0]) for r in f4d])
# endrin in Italy (Source Data Fig4G: GBD incidence, normalised, 20 years each): the mean over the years, as the paper
g = collections.defaultdict(list)
for r in list(wb2['Fig4G'].iter_rows(values_only=True))[1:]: g[(r[3], r[9])].append(float(r[13]))
causes = sorted(set(k[1] for k in g))
gbd = {c: [round(np.mean(g[('Italy', c)]) / np.mean(g[('Global', c)]), 4), round(np.mean(g[('Italy', c)]) / np.mean(g[('Western Europe', c)]), 4)] for c in causes}
COUNTRIES = sorted(air)
assert set(COUNTRIES) == set(water) and set(LATLON) >= set(COUNTRIES)
ctry = []
for c in COUNTRIES:
    a = sorted(IX[e] for e in air[c] if e in IX); w = sorted(IX[e] for e in water[c] if e in IX)
    ctry.append({'name': c, 'lat': LATLON[c][0], 'lon': LATLON[c][1], 'air': a, 'water': w,
                 'risk': risk.get(c) and [risk[c][0], risk[c][1], risk[c][2], round(risk[c][3] / riskTot, 5)],
                 'pa': prox['air'].get(c), 'pw': prox['water'].get(c)})
nAirSig = sum(1 for v in prox['air'].values() if v[2] < 0.05 and v[0] > v[1])
nWaterSig = sum(1 for v in prox['water'].values() if v[2] < 0.05 and v[0] > v[1])
log('countries', len(COUNTRIES), 'air', nAirSig, '/', len(prox['air']), 'water', nWaterSig, '/', len(prox['water']), 'rho Fig4D', round(rho4d, 4))
log('water p near 0.05', {c: v for c, v in prox['water'].items() if 0.03 < v[2] < 0.08})

# ---------------------------------------------------------------- binary helpers
def b64(fmt, arr): return base64.b64encode(struct.pack('<%d%s' % (len(arr), fmt), *arr)).decode()
def q16(v, lim):   # [-lim, lim] to 0..65535
    return [max(0, min(65535, int(round((x / lim + 1) / 2 * 65535)))) for x in v]
class Bin:
    def __init__(self): self.sec, self.buf, self.off = {}, [], 0
    def add(self, k, fmt, arr):
        b = struct.pack('<%d%s' % (len(arr), fmt), *arr) if fmt != 'lines' else '\n'.join(arr).encode('utf8')
        pad = (-self.off) % 8
        if pad: self.buf.append(b'\0' * pad); self.off += pad
        self.sec[k] = [fmt, self.off, len(arr) if fmt != 'lines' else len(b)]
        if fmt == 'lines': self.sec[k].append(len(arr))
        self.buf.append(b); self.off += len(b)
    def write(self, path, meta):
        head = json.dumps(dict(meta, sections=self.sec), separators=(',', ':'), ensure_ascii=False).encode('utf8')
        head += b' ' * ((-(len(head) + 8)) % 8)
        with open(path, 'wb') as f:
            f.write(b'XBN1' + struct.pack('<I', len(head)) + head + b''.join(self.buf))
        return os.path.getsize(path)

# ---------------------------------------------------------------- on-demand files
GENES = sorted(geneSubs, key=lambda g: (-geneSubs[g], g))
GX = {g: i for i, g in enumerate(GENES)}
B = Bin(); offs = [0]; flat = []
for e in IDS:
    gs = sorted(GX[g] for g in SG[e]); flat += gs; offs.append(len(flat))
B.add('sym', 'lines', GENES); B.add('nsub', 'H', [geneSubs[g] for g in GENES])
B.add('g2p', 'H', [PX.get(g, 0xFFFF) for g in GENES]); B.add('off', 'I', offs); B.add('gene', 'H', flat)
sz_t = B.write(os.path.join(PKG, 'data', 'targets.bin'), {'what': 'every substance\'s genes (CTD, human): off[s]..off[s+1] into gene', 'pairs': len(flat)})

cell = json.load(open(CELL_JSON))
CSYM = {s: i for i, s in enumerate(cell['sym'])}
place, cpos, spos = [], [], []
maxd = math.log(max(PDEG))
GA = math.pi * (3 - math.sqrt(5))
for i, s in enumerate(PROT):
    j = CSYM.get(s)
    if j is None:   # not in the model cell: a ring of its own just outside the membrane (golden spiral by order)
        y = 1 - 2 * (i + 0.5) / len(PROT); r = math.sqrt(1 - y * y); a = GA * i
        p = [1.18 * r * math.cos(a), 1.18 * y * 0.8, 1.18 * r * math.sin(a)]; place.append(14)
    else:
        p = cell['pos'][3 * j:3 * j + 3]; place.append(cell['place'][j])
    cpos += p
    # the sorted arrangement: the best connected in the middle, loners at the rim, each in its direction from the centre
    n = math.sqrt(sum(x * x for x in p)) or 1
    rr = 0.1 + 0.9 * (1 - math.log(PDEG[i]) / maxd) ** 0.8
    h = int(hashlib.md5(s.encode()).hexdigest()[:6], 16) / 0xFFFFFF
    rr *= 0.97 + 0.06 * h
    spos += [x / n * rr for x in p]
# the contacts drawn: each protein's link to its best connected partner, then a fixed sample (by a hash of the pair)
DRAWN_P = 30000
pl = sorted((PX[a], PX[b]) for a, b in pairs if a != b)
kp = set()
for i, s in enumerate(PROT):
    j = min(PX[t] for t in ADJ[s]); kp.add((min(i, j), max(i, j)))
rest = sorted((p for p in pl if p not in kp), key=lambda p: hashlib.md5(('%d %d' % p).encode()).hexdigest())
kp = sorted(kp | set(rest[:max(0, DRAWN_P - len(kp))]))
B = Bin()
B.add('sym', 'lines', PROT); B.add('deg', 'H', PDEG); B.add('place', 'B', place)
B.add('cell', 'H', q16(cpos, 1.6)); B.add('sorted', 'H', q16(spos, 1.6))
B.add('links', 'H', [x for p in kp for x in p])
sz_p = B.write(os.path.join(PKG, 'data', 'ppi.bin'), {'what': 'the interactome (HuRI and others: input/PPI/autocore_symbol_lcc.csv), best connected first',
    'places': cell['places'] + ['in the cell, no place known', 'not in the model cell'], 'lim': 1.6, 'proteins': len(PROT), 'links': len(pairs), 'drawn': len(kp),
    'inCell': sum(1 for s in PROT if s in CSYM), 'placed': sum(1 for x in place if x < 13)})
log('ppicell match', sum(1 for s in PROT if s in CSYM), 'of', len(PROT), 'placed', sum(1 for x in place if x < 13))

B = Bin()
B.add('name', 'lines', DIS)
doff, dflat = [0], []
for d in DIS:
    gs = sorted(set(PX[g] for g in DG[d])); dflat += gs; doff.append(len(dflat))
B.add('off', 'I', doff); B.add('gene', 'H', dflat); B.add('near', 'H', [min(65535, x) for x in disNear])
B.add('cs', 'H', [x[0] for x in CLOSE]); B.add('cd', 'H', [x[1] for x in CLOSE])
B.add('cz', 'h', [int(round(x[2] * 100)) for x in CLOSE]); B.add('cc', 'H', [min(65535, x[3]) for x in CLOSE])
sz_d = B.write(os.path.join(PKG, 'data', 'diseases.bin'), {'what': 'DisGeNET diseases (score > 0.4, genes in the interactome) and the close pairs (z < -5) with PubMed co-citations, by substance then z',
    'diseases': len(DIS), 'close': len(CLOSE)})
with open(os.path.join(PKG, 'data', 'names.json'), 'w', encoding='utf8') as f:
    # (a full name only where it differs from the label the story carries)
    json.dump({'id': IDS, 'full': {str(i): FULL[i] for i in range(NS) if FULL[i] != LABEL[i]}}, f, ensure_ascii=False, separators=(',', ':'))
sz_n = os.path.getsize(os.path.join(PKG, 'data', 'names.json'))

# ---------------------------------------------------------------- the story's examples
def sx(e): return IX[e]
BAP, OZONE, ENDRIN = 'D001564', 'D010126', 'D004732'
clot = next(c for c in COMM if c['lv'] == 2 and c['id'] == '11_2_1')
clotM = sorted((IX[e] for e in clot['members']), key=lambda i: (-len(SG[IDS[i]]), i))
cnt = collections.Counter(g for i in clotM for g in SG[IDS[i]])
clotGenes = [[g, n] for g, n in sorted(cnt.items(), key=lambda x: (-x[1], x[0]))[:12]]
def close_of(s, k=20):
    return [[DIS[d], z, c] for (s2, d, z, c) in CLOSE if s2 == s][:k]
ozAs = next(x for x in CLOSE if x[0] == IX[OZONE] and DIS[x[1]] == 'Asthma')
asthma = DX['Asthma']
EX = {
    'bap': sx(BAP), 'ozone': sx(OZONE), 'endrin': sx(ENDRIN), 'crocin': sx('C029036'),
    'ozoneAsthma': {'z': ozAs[2], 'cit': ozAs[3], 'disease': 'Asthma', 'diseaseGenes': len(set(DG['Asthma'])),
                    'asthmaCloseSubs': sum(1 for x in CLOSE if x[1] == asthma), 'ozoneClose': nClose[IX[OZONE]]},
    'clot': {'id': '11_2_1', 'comm': COMM.index(clot) - len(TOPS) - len(MIDS), 'members': clotM, 'genes': clotGenes,
             'serpinc1': sorted(i for i in clotM if 'SERPINC1' in SG[IDS[i]])},
    'endrinClose': close_of(IX[ENDRIN]), 'endrinItaly': {'gbd': gbd, 'inAir': IX[ENDRIN] in ctry[COUNTRIES.index('Italy')]['air'],
                                                        'inWater': IX[ENDRIN] in ctry[COUNTRIES.index('Italy')]['water']},
}
# (builder C, the interactome's scenes: what needs the whole interactome, which the app does not carry; ppi.bin draws a
# sample of its contacts) the steps from each of ozone's targets to the nearest asthma protein (breadth-first over every
# contact; the authors' closest distance), counted, and a sample of those shortest paths (interactome indices, the
# target first); and for chapter centre's four example substances the contacts among their targets (all counted, a
# sample drawn, by a hash of the pair)
def steps_to(src_set):
    dist = {s: 0 for s in src_set}; par = {s: None for s in src_set}; q = collections.deque(sorted(src_set))
    while q:
        u = q.popleft()
        for v in sorted(ADJ[u]):
            if v not in dist: dist[v] = dist[u] + 1; par[v] = u; q.append(v)
    return dist, par
_asth = set(g for g in DG['Asthma'] if g in PX)
_dist, _par = steps_to(_asth)
_oz = sorted(set(g for g in SG[OZONE] if g in PX), key=lambda g: PX[g])
_hist = [0] * 5
for g in _oz: _hist[min(4, _dist.get(g, 4))] += 1
_far = sorted((g for g in _oz if _dist.get(g, 0) >= 1), key=lambda g: hashlib.md5(('oz ' + g).encode()).hexdigest())[:240]
def _path(g):
    out = [PX[g]]
    while _par[g] is not None: g = _par[g]; out.append(PX[g])
    return out
EX['ozoneAsthma']['steps'] = _hist
EX['ozoneAsthma']['mean'] = round(sum(min(_dist.get(g, 9), 9) for g in _oz) / max(1, len(_oz)), 3)
EX['ozoneAsthma']['paths'] = [_path(g) for g in _far]
# (asthma's own contacts: the links among its proteins, the module drawn as a neighbourhood)
EX['ozoneAsthma']['module'] = [x for p in sorted({(min(PX[a], PX[b]), max(PX[a], PX[b])) for a in _asth for b in ADJ[a] if b in _asth and a != b}) for x in p]
def _among(e, cap=1500):
    T = set(g for g in SG[e] if g in PX)
    L = sorted({(min(PX[a], PX[b]), max(PX[a], PX[b])) for a in T for b in ADJ[a] if b in T and a != b})
    keep_ = sorted(sorted(L, key=lambda p: hashlib.md5(('%d %d' % p).encode()).hexdigest())[:cap])
    return {'n': len(L), 'links': [x for p in keep_ for x in p]}
_lab = {LABEL[i].lower(): IDS[i] for i in range(NS)}
EX['patterns'] = [dict(sub=IX[_lab[nm]], **_among(_lab[nm])) for nm in ('cadmium', 'triclosan', 'thallium', 'scopolamine')]
log('ozone-asthma steps', _hist, 'mean', EX['ozoneAsthma']['mean'], 'paths', len(EX['ozoneAsthma']['paths']),
    'pattern examples', [(p['sub'], p['n']) for p in EX['patterns']])
topGenes = [[g, geneSubs[g]] for g in GENES[:10]]
med = float(np.median([len(SG[e]) for e in IDS]))
M = {
    'nSubst': NS, 'nNet': NN, 'nGenes': len(GENES), 'nPairs': nPairs, 'medianGenes': med, 'bapGenes': len(SG[BAP]),
    'topGenes': topGenes, 'nEdges': len(EDGES), 'nSignificant': nUnf, 'nPairsAll': NS * (NS - 1) // 2, 'drawn': len(keep), 'maxDeg': max(deg),
    'classes': {'names': CLASS_NAMES, 'ids': CLASS_IDS, 'count': CLASS_COUNT, 'col': CLASS_COL},
    'levels': {'raw': [len(TOPS), len(MIDS), len(FINES)], 'named': [len(NAMED13), len(pk(*L, 'weighted_ji_middle_communities_dict.pickle')), len(dep_fine)],
               'named13': NAMED13, 'big': sum(len(c['members']) >= 50 for c in COMM if c['lv'] == 0),
               'bigShare': round(sum(len(c['members']) for c in COMM if c['lv'] == 0 and len(c['members']) >= 50) / NN, 4)},
    'pattern': {'names': ['a central module', 'hubs', 'a module at the edge', 'scattered'], 'count': [patc[k] for k in range(4)], 'of': nPat,
                'hazard': [haz_by_pat[k] for k in range(4)]},
    'hazard': {'n': len(hz), 'of': nPat, 'r': round(hazR, 4), 'cited': {'matched': 4669, 'share': 0.4738, 'note': 'substances found in the NORMAN list, with or without a score (the authors\' notebook Exp_fin_9, cells 23-24); 3,165 of them have a score'}},
    'ppi': {'proteins': len(PROT), 'links': len(pairs), 'selfFree': sum(len(v) for v in ADJ.values()) // 2},
    'dis': {'n': len(DIS), 'tested': nExpPPI * len(DIS), 'subsTested': nExpPPI, 'near': len(fdr), 'close': len(CLOSE), 'overlap': nOverlap},
    'countries': {'n': len(COUNTRIES), 'airSig': nAirSig, 'airOf': len(prox['air']), 'waterSig': nWaterSig, 'waterOf': len(prox['water']), 'rho': round(rho4d, 4),
                  'airMean': round(sum(len(c['air']) for c in ctry) / len(ctry), 2), 'waterMean': round(sum(len(c['water']) for c in ctry) / len(ctry), 2),
                  'risk': len(risk)},
    'cited': {'chemVsGenes': {'spearman': -0.0009, 'pearson': 0.0358, 'note': 'chemical likeness (Tanimoto) against shared genes (Jaccard), all pairs: the authors\' notebook Exp_fin_3, cell 31 (the pair tables are not in the deposit\'s small files)'},
              'overlapVsGO': {'spearman': 0.0053, 'note': 'shared genes (Jaccard) against what the genes do (GO, Resnik), pairs related in MeSH: Exp_fin_3, cell 27; the paper\'s 0.005'}},
}
D = {
    'source': 'Lombardo, Hütter, Unterlass, Menche, Nat Commun 17, 5754 (2026); deposit Zenodo 18793297 (CC BY 4.0); derived numbers only',
    'meta': M, 'ex': EX,
    'label': '\n'.join(LABEL),
    'b': {
        'pos': ['H', NN * 3, b64('H', q16(pos.flatten().tolist(), 1.0))],
        'cls': ['H', NS, b64('H', cmask)], 'prim': ['B', NS, b64('B', prim)],
        'fine': ['H', NS, b64('H', fineOf)], 'pat': ['B', NS, b64('B', pat)], 'haz': ['B', NS, b64('B', haz)],
        'ngenes': ['H', NS, b64('H', [len(SG[e]) for e in IDS])], 'nppi': ['H', NS, b64('H', nPPIg)], 'maxdeg': ['H', NS, b64('H', maxDeg)],
        'deg': ['H', NS, b64('H', deg)], 'near': ['H', NS, b64('H', [min(65535, x) for x in nNear])], 'close': ['H', NS, b64('H', nClose)],
        'links': ['H', 2 * len(keep), b64('H', [x for j in keep for x in EDGES[j][:2]])],
        'lw': ['B', len(keep), b64('B', [max(1, min(255, int(round(EDGES[j][2] * 255)))) for j in keep])],
    },
    'comm': {'lv': [c['lv'] for c in COMM], 'id': [c['id'] for c in COMM], 'n': [len(c['members']) for c in COMM], 'parent': [c['parent'] for c in COMM],
             'col': [c['col'] for c in COMM], 'label': [c['label'] for c in COMM], 'terms': [[t[0] for t in c['terms'][:3]] for c in COMM],
             'counts': [len(TOPS), len(MIDS), len(FINES)]},
    'countries': ctry,
}
# shelves by chemistry (chapter 1, ours): one ring per family, the largest at the bottom, a band of rows each
shelf = [0.0] * (3 * NS)
fams = list(range(len(CLASS_IDS) + 1))
members = {c: sorted((i for i in range(NS) if prim[i] == c), key=lambda i: (-len(SG[IDS[i]]), i)) for c in fams}
fams = [c for c in fams if members[c]]
for k, c in enumerate(fams):
    y0 = -0.75 + 1.5 * k / max(1, len(fams) - 1)
    m = members[c]; per = 900; rows_ = (len(m) + per - 1) // per
    for q, i in enumerate(m):
        row, slot = divmod(q, per); nrow = min(per, len(m) - row * per)
        a = 2 * math.pi * (slot + 0.5 * row) / nrow
        h = int(hashlib.md5(IDS[i].encode()).hexdigest()[:6], 16) / 0xFFFFFF
        rr = 0.92 + 0.08 * h
        shelf[3 * i:3 * i + 3] = [rr * math.cos(a), y0 + (row - (rows_ - 1) / 2) * 0.03, rr * math.sin(a)]
D['b']['shelf'] = ['H', NS * 3, b64('H', q16(shelf, 1.0))]
D['meta']['shelves'] = fams
js = ('// Generated by src/data/gen_data.py from the authors\' deposit (Lombardo, Hütter, Unterlass, Menche, Nat Commun 2026;\n'
      '// Zenodo 18793297, CC BY 4.0): never edit by hand. Derived numbers only; decoded by src/sets/xdata.js (XDATA).\n'
      'const EXPO_DATA = ' + json.dumps(D, separators=(',', ':'), ensure_ascii=False) + ';\n'
      "if (typeof module !== 'undefined') module.exports = EXPO_DATA;\n")
with open(os.path.join(PKG, 'src', 'sets', 'data.js'), 'w', encoding='utf8') as f: f.write(js)
log('sizes: data.js', len(js.encode()), 'targets.bin', sz_t, 'ppi.bin', sz_p, 'diseases.bin', sz_d, 'names.json', sz_n, 'on demand total', sz_t + sz_p + sz_d + sz_n)
