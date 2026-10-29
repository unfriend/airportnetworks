# Writes tools/soil/sets/data.js (SOIL_DATA) for the soil story ("Holding on to nitrogen") from the authors' field trial:
# the 16S amplicon table, its taxonomy and the field metadata of the BNI wheat trial (Marina Montserrat Díez and
# colleagues: the group of Christa Schleper, University of Vienna, with JIRCAS, the University of Thessaly and Université
# Lyon 1), plus what the story takes from the slides' charts (tools/soil/data/figures.json, two readings reconciled by
# reconcile.py). Permission to use the slides and the data: given by the authors through the project's owner, 29 October
# 2026. The authors' files stay outside the repository; only derived numbers go in: the kinds of microbe (ASVs) are
# numbered by abundance, never named by their ids, and no sequence goes in.
#
# Inputs (a folder given on the command line, never the repository):
#   Soil_ASVs.csv        raw read counts, 100,116 ASVs x 119 samples (named <line>_<fert>_<time>_<rep>)
#   ASV_Identifiers.csv  the ASVs' taxonomy, Kingdom to Genus (SILVA-style)
#   Field_Metadata.csv   per sample: chlorophyll, nitrate, ammonium, N2O, SW (soil water), pH (not all filled)
# Needs Python 3.10+ with numpy, pandas, scipy and networkx (see requirements.txt next to this file; versions used:
# numpy 2.5, pandas 3.1, scipy 1.18, networkx 3.7). About three minutes and 4 GB of memory.
# usage: python -I tools/soil/data/gen_data.py <folder with the three CSVs>
#
# What SOIL_DATA holds (typed arrays are base64 strings: SDATA in sets/sdata.js decodes them once):
#   about, src        where it comes from; the table's size: samples 119, kinds 100,116, reads (total, min, median, max),
#                     zeros (share of the table that is 0), kindsPerSample (median), kingdoms, assigned (share of kinds
#                     with a name at each rank), noGenus (share of reads without a genus), missing (the one sample not
#                     in the data: BNI, fertilised + DCD, T4, plot 1)
#   design            lines (BNI, control), ferts (N none, F 250 kg N/ha, S 250 kg N/ha + DCD), times (T1..T5: days after
#                     planting, the slides' days, the growth stage and its Zadoks range), reps 4, groups (30: g = (line *
#                     3 + fert) * 5 + time), slots (120: s = g * 4 + rep; the missing sample's slot is null), n (samples
#                     per group)
#   meta              per measure (nh4, no3, n2o, chl, ph, water): name, unit, values (120 slots, null where missing),
#                     mean, sd, n (per group), and line (BNI against control): byFert [[mean BNI, mean control, p] x 3,
#                     all dates], byGroup [[...] x 15, fert * 5 + time]; p by Mann-Whitney U, two-sided; fertP (Kruskal-
#                     Wallis over the three regimes, all samples)
#   phyla             names (the 12 largest by mean share, then Other and Unassigned), kinds (how many of the 100,116 in
#                     each), share (mean % of reads), group ([30][14], mean % of reads per group)
#   guilds            the nitrifiers: keys aoa (ammonia-oxidising archaea: class Nitrososphaeria), nsp (Nitrosospira),
#                     nsm (Nitrosomonas), nit (Nitrospira: 16S cannot tell comammox from the rest), mnd (uncultured
#                     Nitrosomonadaceae: MND1, Ellin6067 and others; whether they oxidise ammonia is unknown); per guild:
#                     name, kinds, share (mean %), group (mean % per group), sd (per group), byFert, byLine, p ({fert, line,
#                     time}: Kruskal-Wallis, Mann-Whitney, Kruskal-Wallis), rho (Spearman with n2o, nh4, no3, ph); aoa1c
#                     (Group 1.1c inside the archaea: not known to oxidise ammonia), nob (Nitrobacter, Nitrolancea: share)
#   cloud             about 20,000 kinds for the cloud: all 3,384 common kinds and a seeded sample of the rest, sorted by
#                     abundance rank (1: the kind with the largest mean share). rank (Uint8 steps: rank[i] = rank[i - 1] +
#                     step[i], from 0), phy (Uint8, index in phyla.names), prev (Uint8, samples it is in, 0..119), ab
#                     (Uint8: log10 of its mean share of reads, 0 = 1e-8 or less, 255 = 1e-1; abRange), guild (Uint8: 0
#                     none, 1 + index in guilds.keys)
#   common            the 3,384 kinds in at least 20 % of samples (94.6 % of the reads): idx (Uint16, their cloud index),
#                     flags (Uint8 bits: 1 differs by fertiliser, 2 by date, 4 by wheat line, 8 by plot after the 30
#                     groups' means are taken out; Benjamini-Hochberg q < 0.05 on Kruskal-Wallis or Mann-Whitney of the
#                     CLR), cls, fam, gen (Uint16 indices in names.cls, .fam, .gen; 0 = unassigned), diff (the counts),
#                     lineKinds (the kinds that differ by wheat line: common index, rank, taxonomy, which line has more, q),
#                     n2oTop (the kinds most correlated with N2O, Spearman over all samples), n2oMax
#   net               the co-occurrence network (params: prevalence 0.2, CLR with pseudocount 1, Spearman, |rho| >= 0.6,
#                     BH q < 0.05; modules by Louvain on the positive links, seed 1). n, links, pos, neg, Q, lcc, density,
#                     meanDeg, modules (with 3 or more kinds); node (Uint16 common index per node), mod (Uint8 module, 255
#                     none), deg (Uint16), xyz (Int16 x 3 per node, x 1e-4: a 3D layout computed here, modules apart,
#                     radius about 1), ij (Uint16 node pairs), w (Int8: rho x 127) and split (Uint8 bits per link: 1 also
#                     in BNI's own network, 2 control's, 4 N's, 8 F's, 16 S's, 32 random half A's, 64 random half B's),
#                     links sorted by |rho| from the strongest, so the network at any stricter threshold is a prefix:
#                     cuts [[rho, links]]; mods (per module: n, phyla, top taxa and their share of the module's reads,
#                     share (% of reads per group), score (120 slots: the mean CLR of its kinds per sample, centred),
#                     r2 ({fert, time, line, plot}: the share of the score's variance that goes with each; plot after the
#                     30 groups' means), p, guilds (its nitrifiers)); thresholds (rho 0.5 to 0.8: nodes, links, pos,
#                     modules, Q); prevalence (10 % and 50 % at 0.6: nodes, links, jaccard with this network); null (links
#                     after shuffling each kind's samples: 0); splits (line, fert: each group's own network; random: 59 and
#                     60 sample halves, seeded; lineDiff, randomDiff); residual (after the 30 groups' means: links,
#                     shared with this network; after the plots' means too); fertNodes, fertAll (share of the network's
#                     kinds and of all common kinds that differ by fertiliser); guilds (per guild: kept, in the network,
#                     mean degree)
#   figs              what the story takes from figures.json: chl70 (chlorophyll on day 70 [fert][line], v and err), n2o
#                     (the incubation curves: times, curves [day][fert][line][10], peaks [day][fert][line], germline p as
#                     printed), qpcr (aoa, aob: [fert][day][line] copies per g, v and err), match (how the metadata agrees
#                     with the slides)
#   open              the open questions the data raises (to be said in the story where they matter)
import sys, os, json, base64, math, warnings
import numpy as np, pandas as pd, networkx as nx
from scipy.stats import t as tdist, rankdata, kruskal, mannwhitneyu, spearmanr

warnings.filterwarnings('ignore')
DL = os.path.abspath(sys.argv[1])
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'sets', 'data.js')
FIGS = os.path.join(HERE, 'figures.json')
CLOUD_N = 20000          # kinds in the cloud (all common kinds and a seeded sample of the rest)
AB_RANGE = (-8.0, -1.0)  # log10 of a kind's mean share, coded in a byte
SPLITS = 20              # random halves
log = lambda *a: print(*a, flush=True)

# ---------------------------------------------------------------- the tables
c = pd.read_csv(os.path.join(DL, 'Soil_ASVs.csv'), index_col=0)
tax = pd.read_csv(os.path.join(DL, 'ASV_Identifiers.csv'), index_col=0).reindex(c.index)
meta = pd.read_csv(os.path.join(DL, 'Field_Metadata.csv'), index_col=0).T.apply(pd.to_numeric, errors='coerce').reindex(c.columns)
parts = pd.Series(c.columns, index=c.columns).str.split('_', expand=True)
parts.columns = ['line', 'fert', 'time', 'rep']
LINES, FERTS, TIMES, REPS = ['BNI', 'Ctrl'], ['N', 'F', 'S'], ['T1', 'T2', 'T3', 'T4', 'T5'], ['rep1', 'rep2', 'rep3', 'rep4']
line_i = parts.line.map(LINES.index).values
fert_i = parts.fert.map(FERTS.index).values
time_i = parts.time.map(TIMES.index).values
rep_i = parts.rep.map(REPS.index).values
group = (line_i * 3 + fert_i) * 5 + time_i
slot = group * 4 + rep_i
NS = c.shape[1]
rel = c / c.sum(axis=0)
log('samples', NS, 'kinds', c.shape[0])


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode('ascii')


def rnd(x, k=3):
    if x is None or (isinstance(x, float) and not math.isfinite(x)):
        return None
    return round(float(x), k)


def slots(v, k):
    out = [None] * 120
    for s, x in zip(slot, v):
        out[int(s)] = rnd(x, k)
    return out


def per_group(v, k):
    v = np.asarray(v, float)
    mean, sd, n = [], [], []
    for g in range(30):
        x = v[(group == g) & np.isfinite(v)]
        n.append(int(len(x)))
        mean.append(rnd(x.mean(), k) if len(x) else None)
        sd.append(rnd(x.std(ddof=1), k) if len(x) > 1 else None)
    return mean, sd, n


# ---------------------------------------------------------------- the network's machinery (as the data profile's)
def clr(counts):  # counts: features x samples
    l = np.log(counts + 1.0)
    return l - l.mean(axis=0, keepdims=True)


def spearman(X):  # X: features x samples -> rho matrix
    R = np.apply_along_axis(rankdata, 1, X)
    R = R - R.mean(1, keepdims=True)
    R /= np.linalg.norm(R, axis=1, keepdims=True)
    return R @ R.T


def bh(p):
    n = len(p)
    o = np.argsort(p)
    q = p[o] * n / np.arange(1, n + 1)
    q = np.minimum.accumulate(q[::-1])[::-1]
    out = np.empty(n)
    out[o] = np.minimum(q, 1)
    return out


def pairs(X):
    """all pairs' rho and q (rho 0 where a row is constant)"""
    n = X.shape[1]
    rho = np.nan_to_num(spearman(X))
    iu = np.triu_indices(X.shape[0], 1)
    r = rho[iu]
    tt = r * np.sqrt((n - 2) / np.clip(1 - r * r, 1e-12, None))
    p = 2 * tdist.sf(np.abs(tt), n - 2)
    return iu, r, bh(p)


def edges(X, names, rmin=0.6, qmax=0.05, pre=None):
    iu, r, q = pre if pre is not None else pairs(X)
    k = (np.abs(r) >= rmin) & (q < qmax)
    return [(names[i], names[j], float(x)) for i, j, x in zip(iu[0][k], iu[1][k], r[k])]


def positive_graph(E, nodes, names):
    """the positive links as a graph on integer labels (the kinds' places in names), so that Louvain's result does not
    depend on Python's string hashing, which changes from run to run"""
    ix = {a: i for i, a in enumerate(names)}
    P = nx.Graph()
    P.add_nodes_from(sorted(ix[a] for a in nodes))
    P.add_edges_from((ix[a], ix[b]) for a, b, w in E if w > 0)
    return P


def stats(E, names, seed=1):
    G = nx.Graph()
    G.add_nodes_from(names)
    G.add_weighted_edges_from([(a, b, abs(w)) for a, b, w in E])
    pos = sum(1 for e in E if e[2] > 0)
    # (built anew rather than as G.subgraph: a subgraph view of fewer than half the nodes iterates them in the order of a
    # set, which for strings changes from run to run, and Louvain and the layout depend on the order)
    G2 = nx.Graph()
    G2.add_nodes_from(v for v in G if G.degree(v) > 0)
    G2.add_weighted_edges_from([(a, b, abs(w)) for a, b, w in E])
    P = positive_graph(E, G2.nodes, names)
    mods = nx.community.louvain_communities(P, seed=seed) if P.number_of_edges() else []
    Q = nx.community.modularity(P, mods) if mods else float('nan')
    mods = [{names[i] for i in m} for m in mods]
    lcc = max((len(x) for x in nx.connected_components(G2)), default=0)
    S = dict(nodes=G2.number_of_nodes(), links=G.number_of_edges(), pos=pos, neg=len(E) - pos,
             density=round(nx.density(G2), 4) if G2.number_of_nodes() > 1 else 0, lcc=lcc,
             modules=len([m for m in mods if len(m) >= 3]), Q=round(Q, 3) if mods else None,
             meanDeg=round(2 * G.number_of_edges() / max(1, G2.number_of_nodes()), 2))
    return S, G2, mods


def filt(cnt, prev=0.2):
    return cnt[(cnt > 0).mean(axis=1) >= prev]


def keyset(E):
    return {(a, b) if a < b else (b, a) for a, b, _ in E}


# ---------------------------------------------------------------- src
reads = c.sum(axis=0)
prevalence = (c > 0).sum(axis=1).values
mean_share = rel.mean(axis=1).values
order = np.lexsort((np.arange(len(mean_share)), -mean_share))     # by mean share, largest first (ties: table order)
rank = np.empty(len(order), int)
rank[order] = np.arange(1, len(order) + 1)
src = {
    'samples': NS, 'kinds': int(c.shape[0]), 'withReads': int((c.sum(axis=1) > 0).sum()),
    'reads': int(reads.sum()), 'readsMin': int(reads.min()), 'readsMedian': int(reads.median()), 'readsMax': int(reads.max()),
    'zeros': rnd((c.values == 0).mean(), 4), 'kindsPerSample': int((c > 0).sum(axis=0).median()),
    'kingdoms': {k: int(v) for k, v in tax.Kingdom.fillna('Unassigned').value_counts().items()},
    'assigned': {r: rnd(tax[r].notna().mean(), 3) for r in ['Phylum', 'Class', 'Order', 'Family', 'Genus']},
    'noGenus': rnd(rel[tax.Genus.isna().values].sum(axis=0).mean(), 3),
    'missing': None,
}
full = {f'{l}_{f}_{t}_{r}' for l in LINES for f in FERTS for t in TIMES for r in REPS}
miss = sorted(full - set(c.columns))
assert len(miss) == 1, miss
ml, mf, mt, mr = miss[0].split('_')
src['missing'] = {'line': LINES.index(ml), 'fert': FERTS.index(mf), 'time': TIMES.index(mt), 'rep': REPS.index(mr),
                  'slot': ((LINES.index(ml) * 3 + FERTS.index(mf)) * 5 + TIMES.index(mt)) * 4 + REPS.index(mr)}
log('src', src)

# ---------------------------------------------------------------- design
design = {
    'lines': [{'key': 'BNI', 'name': 'Munal-BNI', 'short': 'BNI wheat'}, {'key': 'Ctrl', 'name': 'Munal-control', 'short': 'control wheat'}],
    'ferts': [{'key': 'N', 'name': 'Not fertilised', 'kgN': 0}, {'key': 'F', 'name': 'Fertilised', 'kgN': 250},
              {'key': 'S', 'name': 'Fertilised + DCD', 'kgN': 250, 'inhibitor': 'DCD (a synthetic nitrification inhibitor)'}],
    # days after planting and growth stages: the authors' notes on the data; the slides' days: their charts' axis
    'times': [{'key': 'T1', 'dap': 129, 'day': 1, 'stage': 'early jointing and booting', 'zadoks': [30, 49]},
              {'key': 'T2', 'dap': 144, 'day': 15, 'stage': 'late jointing and booting', 'zadoks': [30, 49]},
              {'key': 'T3', 'dap': 153, 'day': 24, 'stage': 'heading and flowering', 'zadoks': [50, 69]},
              {'key': 'T4', 'dap': 182, 'day': 53, 'stage': 'grain filling', 'zadoks': [70, 89]},
              {'key': 'T5', 'dap': 199, 'day': 70, 'stage': 'ripening', 'zadoks': [90, 100]}],
    'reps': 4, 'plots': 24,
    'groups': 'g = (line * 3 + fert) * 5 + time (line 0 BNI, 1 control; fert 0 N, 1 F, 2 S; time 0..4)',
    'slots': 's = g * 4 + rep (rep 0..3); the missing sample\'s slot is null in every per-sample list',
    'n': [int((group == g).sum()) for g in range(30)],
    'fraction': 'rhizosphere soil (the slides\' notes)',
}

# ---------------------------------------------------------------- meta
MEAS = [('nh4', 'ammonium', 'Ammonium', 'mg N per kg dry soil', 2), ('no3', 'nitrate', 'Nitrate', 'mg N per kg dry soil', 2),
        ('n2o', 'N2O', 'N2O, potential production', 'unit not given (one number per sample)', 3),
        ('chl', 'chlorophyll', 'Chlorophyll', 'SPAD index (leaves)', 2), ('ph', 'pH', 'pH', '', 2),
        ('water', 'SW', 'Soil water', 'unit not given (0.25 to 0.66: a fraction)', 3)]
mdata = {}
for key, col, name, unit, k in MEAS:
    v = meta[col].values.astype(float)
    mean, sd, n = per_group(v, k)
    ok = np.isfinite(v)
    byFert, byGroup = [], []
    for f in range(3):
        a, b = v[(fert_i == f) & (line_i == 0) & ok], v[(fert_i == f) & (line_i == 1) & ok]
        p = mannwhitneyu(a, b).pvalue if len(a) > 1 and len(b) > 1 else None
        byFert.append([rnd(a.mean(), k) if len(a) else None, rnd(b.mean(), k) if len(b) else None, rnd(p, 3)])
        for t in range(5):
            a, b = v[(fert_i == f) & (time_i == t) & (line_i == 0) & ok], v[(fert_i == f) & (time_i == t) & (line_i == 1) & ok]
            p = mannwhitneyu(a, b).pvalue if len(a) > 1 and len(b) > 1 else None
            byGroup.append([rnd(a.mean(), k) if len(a) else None, rnd(b.mean(), k) if len(b) else None, rnd(p, 3)])
    xs = [v[(fert_i == f) & ok] for f in range(3)]
    mdata[key] = {'name': name, 'unit': unit, 'values': slots(v, k), 'mean': mean, 'sd': sd, 'n': n,
                  'line': {'byFert': byFert, 'byGroup': byGroup},
                  'fertP': rnd(kruskal(*xs).pvalue, 6) if all(len(x) > 1 for x in xs) else None}
log('N2O within F: BNI', mdata['n2o']['line']['byFert'][1])

# ---------------------------------------------------------------- phyla
phy = tax.Phylum.fillna('Unassigned')
ps = rel.groupby(phy.values).sum()
top = [p for p in ps.mean(axis=1).sort_values(ascending=False).index if p != 'Unassigned'][:12]
PHY = top + ['Other', 'Unassigned']
phy_i = np.array([PHY.index(p) if p in top else (13 if p == 'Unassigned' else 12) for p in phy.values])
pshare = np.zeros((14, NS))
for i in range(14):
    pshare[i] = rel.values[phy_i == i].sum(axis=0) * 100
phyla = {'names': PHY, 'kinds': [int((phy_i == i).sum()) for i in range(14)],
         'share': [rnd(x, 2) for x in pshare.mean(axis=1)],
         'group': [[rnd(pshare[i][group == g].mean(), 2) for i in range(14)] for g in range(30)]}
log('phyla', list(zip(PHY, phyla['share'])))

# ---------------------------------------------------------------- the nitrifier guilds
GKEYS = ['aoa', 'nsp', 'nsm', 'nit', 'mnd']
GNAMES = ['Ammonia-oxidising archaea', 'Nitrosospira', 'Nitrosomonas', 'Nitrospira', 'Uncultured Nitrosomonadaceae']
GROLES = ['ammonium to nitrite', 'ammonium to nitrite', 'ammonium to nitrite',
          'nitrite to nitrate (some do both steps: comammox; 16S cannot tell)', 'unknown: relatives of Nitrosospira, not known to oxidise ammonia']


def guild_of(r):
    g, f, cl = str(r.Genus), str(r.Family), str(r.Class)
    if cl == 'Nitrososphaeria': return 1
    if g == 'Nitrosospira': return 2
    if g == 'Nitrosomonas': return 3
    if g == 'Nitrospira': return 4
    if f == 'Nitrosomonadaceae': return 5
    return 0


guild = np.array([guild_of(r) for r in tax.itertuples()])
guilds = {'keys': GKEYS, 'names': GNAMES, 'roles': GROLES}
for gi, gk in enumerate(GKEYS):
    x = rel.values[guild == gi + 1].sum(axis=0) * 100
    mean, sd, _ = per_group(x, 3)
    ok = np.isfinite(meta.N2O.values)
    rho = {}
    for key, col in [('n2o', 'N2O'), ('nh4', 'ammonium'), ('no3', 'nitrate'), ('ph', 'pH')]:
        m = meta[col].values
        okm = np.isfinite(m)
        rho[key] = rnd(spearmanr(x[okm], m[okm]).statistic, 2)
    guilds[gk] = {'name': GNAMES[gi], 'kinds': int((guild == gi + 1).sum()), 'share': rnd(x.mean(), 3), 'group': mean, 'sd': sd,
                  'byFert': [rnd(x[fert_i == f].mean(), 3) for f in range(3)], 'byLine': [rnd(x[line_i == l].mean(), 3) for l in range(2)],
                  'p': {'fert': float('%.2g' % kruskal(*[x[fert_i == f] for f in range(3)]).pvalue),
                        'line': float('%.2g' % mannwhitneyu(x[line_i == 0], x[line_i == 1]).pvalue),
                        'time': float('%.2g' % kruskal(*[x[time_i == t] for t in range(5)]).pvalue)},
                  'rho': rho}
    log('guild', gk, guilds[gk]['kinds'], guilds[gk]['share'], guilds[gk]['byFert'], guilds[gk]['p'])
is1c = (tax.Order == 'Group 1.1c').values & (guild == 1)
guilds['aoa1c'] = {'kinds': int(is1c.sum()), 'share': rnd((rel.values[is1c].sum(axis=0) * 100).mean(), 3),
                   'note': 'Group 1.1c archaea (inside the class of the ammonia-oxidising archaea): not known to oxidise ammonia'}
nob = tax.Genus.isin(['Nitrobacter', 'Nitrolancea']).values
guilds['nob'] = {'kinds': int(nob.sum()), 'share': rnd((rel.values[nob].sum(axis=0) * 100).mean(), 4),
                 'note': 'Nitrobacter and Nitrolancea, the other nitrite oxidisers: almost absent'}

# ---------------------------------------------------------------- the common kinds and their tests
A = filt(c)
names = list(A.index)
NC = len(names)
cidx = {a: i for i, a in enumerate(names)}
X = clr(A.values)
log('common kinds', NC, 'read share', round(A.values.sum() / c.values.sum(), 3))
pkw = np.array([kruskal(*[x[fert_i == f] for f in range(3)]).pvalue for x in X])
ptime = np.array([kruskal(*[x[time_i == t] for t in range(5)]).pvalue for x in X])
pline = np.array([mannwhitneyu(x[line_i == 0], x[line_i == 1]).pvalue for x in X])
qf, qt, ql = bh(pkw), bh(ptime), bh(pline)
Xr = X.copy()
for g in range(30):
    s = group == g
    Xr[:, s] -= Xr[:, s].mean(1, keepdims=True)
prep = np.array([kruskal(*[x[rep_i == r] for r in range(4)]).pvalue for x in Xr])
qr = bh(prep)
flags = ((qf < .05) * 1 + (qt < .05) * 2 + (ql < .05) * 4 + (qr < .05) * 8).astype(np.uint8)
diff = {'fert': int((qf < .05).sum()), 'time': int((qt < .05).sum()), 'line': int((ql < .05).sum()), 'plot': int((qr < .05).sum())}
log('differ', diff)

# ---------------------------------------------------------------- the cloud
rng_cloud = np.random.default_rng(7)
is_common = np.zeros(len(c), bool)
pos_of = {a: i for i, a in enumerate(c.index)}
for a in names:
    is_common[pos_of[a]] = True
rest = np.flatnonzero(~is_common)
pick = np.sort(np.concatenate([np.flatnonzero(is_common), rng_cloud.choice(rest, CLOUD_N - NC, replace=False)]))
pick = pick[np.argsort(rank[pick], kind='stable')]                       # by abundance rank
cl_rank = rank[pick]
steps = np.diff(np.concatenate([[0], cl_rank]))
assert steps.max() <= 255, 'a rank step does not fit a byte'
ab = np.log10(np.maximum(mean_share[pick], 1e-12))
ab_code = np.clip(np.round((ab - AB_RANGE[0]) / (AB_RANGE[1] - AB_RANGE[0]) * 255), 0, 255).astype(np.uint8)
cloud_of = {int(p): i for i, p in enumerate(pick)}
cloud = {'n': int(len(pick)), 'of': int(len(c)), 'seed': 7, 'abRange': list(AB_RANGE),
         'rank': b64(steps.astype(np.uint8)), 'phy': b64(phy_i[pick].astype(np.uint8)),
         'prev': b64(prevalence[pick].astype(np.uint8)), 'ab': b64(ab_code), 'guild': b64(guild[pick].astype(np.uint8))}
common_cloud = np.array([cloud_of[pos_of[a]] for a in names], np.uint16)
# names of class, family and genus for the common kinds
def table(col):
    v = tax.loc[names, col].fillna('').values
    nm = [''] + sorted({x for x in v if x})
    ix = {x: i for i, x in enumerate(nm)}
    return nm, np.array([ix[x] for x in v], np.uint16)


ncls, icls = table('Class')
nfam, ifam = table('Family')
ngen, igen = table('Genus')


def taxname(a):
    r = tax.loc[a]
    for col in ['Genus', 'Family', 'Order', 'Class', 'Phylum']:
        if isinstance(r[col], str):
            return r[col] if col == 'Genus' else f'unnamed {r[col]}'
    return 'unnamed'


line_kinds = []
for i in np.flatnonzero(ql < .05):
    a = names[i]
    r = tax.loc[a]
    line_kinds.append({'common': int(i), 'rank': int(rank[pos_of[a]]), 'phylum': r.Phylum if isinstance(r.Phylum, str) else None,
                       'family': r.Family if isinstance(r.Family, str) else None, 'genus': r.Genus if isinstance(r.Genus, str) else None,
                       'more': 'BNI' if X[i][line_i == 0].mean() > X[i][line_i == 1].mean() else 'Ctrl', 'q': rnd(ql[i], 4)})
log('line kinds', line_kinds)
rh = np.array([spearmanr(X[i], meta.N2O.values).statistic for i in range(NC)])
n2o_top = [{'common': int(i), 'name': taxname(names[i]), 'phylum': tax.loc[names[i]].Phylum, 'rho': rnd(rh[i], 2)}
           for i in np.argsort(-np.abs(rh))[:3]]
common = {'n': NC, 'prevalence': 0.2, 'readShare': rnd(A.values.sum() / c.values.sum(), 3), 'idx': b64(common_cloud),
          'flags': b64(flags), 'cls': b64(icls), 'fam': b64(ifam), 'gen': b64(igen), 'names': {'cls': ncls, 'fam': nfam, 'gen': ngen},
          'diff': diff, 'lineKinds': line_kinds, 'n2oTop': n2o_top, 'n2oMax': rnd(np.abs(rh).max(), 2)}

# ---------------------------------------------------------------- the network
pre = pairs(X)
E = edges(X, names, pre=pre)
S, G, mods = stats(E, names)
log('network', S)
mods_sorted = sorted(mods, key=len, reverse=True)
mod_of = {}
for k, m in enumerate(mods_sorted):
    if len(m) >= 3:
        for v in m:
            mod_of[v] = k
NM = S['modules']
# Louvain is randomised: how many modules other seeds give (the five big ones are always there)
louv = []
P_all = positive_graph(E, G.nodes, names)
for s in range(30):
    m = nx.community.louvain_communities(P_all, seed=s)
    sz = sorted((len(x) for x in m), reverse=True)
    louv.append((len([x for x in sz if x >= 3]), round(nx.community.modularity(P_all, m), 3), len([x for x in sz if x >= 100])))
louvain = {'seeds': 30, 'modules': [min(x[0] for x in louv), max(x[0] for x in louv)], 'Q': [min(x[1] for x in louv), max(x[1] for x in louv)],
           'big': [min(x[2] for x in louv), max(x[2] for x in louv)], 'bigSize': 100,
           'note': 'Louvain with seeds 0 to 29: the count of modules of 3 or more kinds and of 100 or more; this network is seed 1'}
log('louvain', louvain)
nodes = sorted(G.nodes, key=lambda a: cidx[a])
nidx = {a: i for i, a in enumerate(nodes)}
deg = dict(G.degree())
# thresholds: the same pairs, other cut-offs
thresholds = []
for rmin in [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]:
    Sk, _, _ = stats(edges(X, names, rmin, pre=pre), names)
    thresholds.append({'rho': rmin, 'nodes': Sk['nodes'], 'links': Sk['links'], 'pos': Sk['pos'], 'modules': Sk['modules'], 'Q': Sk['Q']})
    log('threshold', thresholds[-1])
# the null: each kind's values shuffled across the samples on its own
rng = np.random.default_rng(1)
Xp = np.array([rng.permutation(x) for x in X])
null_links = len(edges(Xp, names))
log('null links', null_links)
# residual networks
setE = keyset(E)
Er = edges(Xr, names)
Xb = Xr.copy()
for r in range(4):
    s = rep_i == r
    Xb[:, s] -= Xb[:, s].mean(1, keepdims=True)
Eb = edges(Xb, names)
Sb, _, _ = stats(Eb, names)
residual = {'group': {'links': len(Er), 'shared': len(keyset(Er) & setE)}, 'plot': {'links': len(Eb), 'nodes': Sb['nodes']}}
log('residual', residual)
# prevalence variants at 0.6
prevs = []
for pv in [0.1, 0.5]:
    Ak = filt(c, pv)
    Ek = edges(clr(Ak.values), list(Ak.index))
    Sk, _, _ = stats(Ek, list(Ak.index))
    sE = keyset(Ek)
    prevs.append({'prev': pv, 'kinds': len(Ak), 'nodes': Sk['nodes'], 'links': Sk['links'], 'jaccard': rnd(len(sE & setE) / max(1, len(sE | setE)), 3)})
    log('prevalence', prevs[-1])


# each group's own network (its own filter and CLR), its null, and which of this network's links it keeps
def sub_net(mask):
    Ak = filt(c.loc[:, mask])
    nk = list(Ak.index)
    Xk = clr(Ak.values)
    Ek = edges(Xk, nk)
    Sk, _, _ = stats(Ek, nk)
    return Sk, keyset(Ek), len(Ak), Xk, nk


splits = {'line': [], 'fert': [], 'random': []}
bits = np.zeros(len(E), np.uint8)
ekeys = [(a, b) if a < b else (b, a) for a, b, _ in E]
for k, levels, base_bit in [('line', LINES, 1), ('fert', FERTS, 4)]:
    for j, lv in enumerate(levels):
        mask = (parts[k] == lv).values
        Sk, sE, kept, Xk, nk = sub_net(mask)
        nl = len(edges(np.array([rng.permutation(x) for x in Xk]), nk))
        for e, kk in enumerate(ekeys):
            if kk in sE:
                bits[e] |= base_bit << j
        splits[k].append({'key': lv, 'samples': int(mask.sum()), 'kept': kept, 'nodes': Sk['nodes'], 'links': Sk['links'],
                          'Q': Sk['Q'], 'modules': Sk['modules'], 'null': nl, 'keeps': int(sum(1 for kk in ekeys if kk in sE))})
        log('split', k, splits[k][-1])
rng_split = np.random.default_rng(1)
for i in range(SPLITS):
    perm = rng_split.permutation(NS)
    s1 = np.zeros(NS, bool)
    s1[perm[:59]] = True
    na, sa, _, _, _ = sub_net(s1)
    nb, sb, _, _, _ = sub_net(~s1)
    if i == 0:
        for e, kk in enumerate(ekeys):
            if kk in sa: bits[e] |= 32
            if kk in sb: bits[e] |= 64
        splits['randomKeeps'] = [int(sum(1 for kk in ekeys if kk in sa)), int(sum(1 for kk in ekeys if kk in sb))]
    splits['random'].append([na['links'], nb['links']])
    log('random split', i, splits['random'][-1])
rd = [abs(a - b) for a, b in splits['random']]
splits['lineDiff'] = abs(splits['line'][0]['links'] - splits['line'][1]['links'])
splits['randomDiff'] = [min(rd), max(rd)]
splits['randomMore'] = int(sum(1 for d in rd if d > splits['lineDiff']))
splits['seed'] = 1
splits['note'] = ('each half\'s own network, as the whole one (its own 20 % filter and CLR): the BNI and control halves differ '
                  'by lineDiff links; random halves of 59 and 60 samples by randomDiff')
log('lineDiff', splits['lineDiff'], 'random', splits['randomDiff'], 'more', splits['randomMore'])
# links sorted from the strongest
eorder = sorted(range(len(E)), key=lambda e: (-abs(E[e][2]), nidx[E[e][0]], nidx[E[e][1]]))
ij = np.array([[nidx[E[e][0]], nidx[E[e][1]]] for e in eorder], np.uint16)
wq = np.array([int(round(E[e][2] * 127)) for e in eorder], np.int8)
sbits = bits[eorder]
absr = np.array([abs(E[e][2]) for e in eorder])
cuts = [[x, int((absr >= x).sum())] for x in [0.6, 0.65, 0.7, 0.75, 0.8]]   # (the same test as the thresholds')
log('cuts', cuts)


# a 3D layout (a drawing: linked kinds sit close, distances mean nothing more): the big modules (30 kinds or more) by a
# spring layout among themselves on a sphere of radius 0.62, each small one beside the big module it links to most
# (outside it), each module's kinds by a spring layout of its own positive links (scaled so 90 % lie within its radius,
# 0.05 x its size^(1/3), the rest pulled in to 1.3 times it), the kinds in no module beside their neighbours; then the
# whole scaled to radius 1
def layout():
    rngl = np.random.default_rng(3)
    P = nx.Graph()
    P.add_nodes_from(nodes)
    P.add_edges_from([(a, b) for a, b, w in E if w > 0])
    sizes = [len(mods_sorted[k]) for k in range(NM)]
    BIG = [k for k in range(NM) if sizes[k] >= 30]
    MG = nx.Graph()
    MG.add_nodes_from(range(NM))
    for a, b in P.edges:
        ma, mb = mod_of.get(a), mod_of.get(b)
        if ma is not None and mb is not None and ma != mb:
            MG.add_edge(ma, mb, w=MG.get_edge_data(ma, mb, {'w': 0})['w'] + 1)
    BG = nx.Graph()
    BG.add_nodes_from(BIG)
    BG.add_weighted_edges_from((u, v, math.log1p(d['w'])) for u, v, d in MG.edges(data=True) if u in BIG and v in BIG)
    cen = nx.spring_layout(BG, dim=3, seed=1, weight='weight', k=2.0, iterations=300)
    Cb = np.array([cen[k] for k in BIG])
    Cb -= Cb.mean(axis=0)
    C = {k: x / (np.linalg.norm(x) or 1) * 0.62 for k, x in zip(BIG, Cb)}
    rad = lambda k: 0.05 * sizes[k] ** (1 / 3)
    j = 0
    for k in range(NM):
        if k in C:
            continue
        nb = [(MG[k][m]['w'], m) for m in MG.neighbors(k) if m in BIG]
        ang = 2.399 * j
        j += 1
        if nb:
            m = max(nb)[1]
            d = C[m] / np.linalg.norm(C[m])
            t = np.cross(d, [0, 1, 0])
            t = t / (np.linalg.norm(t) or 1)
            u = np.cross(d, t)
            C[k] = C[m] + d * (rad(m) + 0.1) + (t * math.cos(ang) + u * math.sin(ang)) * 0.12
        else:
            v = rngl.normal(0, 1, 3)
            C[k] = v / np.linalg.norm(v)
    pos = {}
    for k in range(NM):
        mem = [a for a in nodes if mod_of.get(a) == k]
        ms = set(mem)
        sub = nx.Graph()
        sub.add_nodes_from(mem)
        sub.add_edges_from((a, b) for a, b in P.edges(mem) if a in ms and b in ms)
        p = nx.spring_layout(sub, dim=3, seed=1, iterations=150) if len(mem) > 1 else {mem[0]: np.zeros(3)}
        Pm = np.array([p[a] for a in mem])
        Pm -= Pm.mean(axis=0)
        r90 = np.percentile(np.linalg.norm(Pm, axis=1), 90) or 1
        Pm *= rad(k) / r90
        nr = np.linalg.norm(Pm, axis=1)
        Pm *= np.minimum(1, 1.3 * rad(k) / np.maximum(nr, 1e-9))[:, None]
        for a, x in zip(mem, Pm):
            pos[a] = C[k] + x
    for a in nodes:
        if a in pos:
            continue
        nb = sorted((b for b in G.neighbors(a) if b in pos), key=lambda b: cidx[b])
        if nb:
            pos[a] = np.mean([pos[b] for b in nb], axis=0) * 1.15 + rngl.normal(0, 0.04, 3)
        else:
            v = rngl.normal(0, 1, 3)
            pos[a] = v / np.linalg.norm(v)
    Pa = np.array([pos[a] for a in nodes])
    Pa -= Pa.mean(axis=0)
    Pa /= np.linalg.norm(Pa, axis=1).max()
    return Pa


xyz = layout()
xyz_q = np.round(xyz * 10000).astype(np.int16)


# the modules
def score_of(members):
    idx = [cidx[a] for a in members]
    return X[idx].mean(axis=0)


def r2(y, lab):
    y = y - y.mean()
    tot = (y ** 2).sum()
    btw = sum(((lab == v).sum() * y[lab == v].mean() ** 2) for v in np.unique(lab))
    return btw / tot if tot > 0 else 0.0


mods_out = []
for k in range(NM):
    m = mods_sorted[k]
    sc = score_of(m)
    sc_c = sc - sc.mean()
    res = sc_c.copy()
    for g in range(30):
        s = group == g
        res[s] -= res[s].mean()
    tot = (sc_c ** 2).sum()
    plot_r2 = sum(((rep_i == r).sum() * res[rep_i == r].mean() ** 2) for r in range(4)) / tot if tot > 0 else 0
    rows = [pos_of[a] for a in m]
    share = rel.values[rows].sum(axis=0) * 100
    ph = tax.loc[list(m), 'Phylum'].fillna('Unassigned').value_counts().head(3)
    tn = pd.Series(rel.values[rows].mean(axis=1), index=[taxname(a) for a in m]).groupby(level=0).sum().sort_values(ascending=False)
    tot_share = tn.sum()
    gk = {GKEYS[j]: int(sum(1 for a in m if guild[pos_of[a]] == j + 1)) for j in range(5)}
    mods_out.append({
        'n': len(m), 'phyla': [[p, int(n)] for p, n in ph.items()],
        'top': [[nm, rnd(v / tot_share * 100, 1)] for nm, v in tn.head(3).items()],
        'share': [rnd(share[group == g].mean(), 3) for g in range(30)], 'score': slots(sc_c, 2),
        'r2': {'fert': rnd(r2(sc_c, fert_i), 3), 'time': rnd(r2(sc_c, time_i), 3), 'line': rnd(r2(sc_c, line_i), 3), 'plot': rnd(plot_r2, 3)},
        'p': {'fert': float('%.2g' % kruskal(*[sc[fert_i == f] for f in range(3)]).pvalue),
              'time': float('%.2g' % kruskal(*[sc[time_i == t] for t in range(5)]).pvalue),
              'line': float('%.2g' % mannwhitneyu(sc[line_i == 0], sc[line_i == 1]).pvalue),
              'plot': float('%.2g' % kruskal(*[res[rep_i == r] for r in range(4)]).pvalue)},
        'guilds': gk,
    })
    log('module', k, mods_out[-1]['n'], mods_out[-1]['r2'], mods_out[-1]['top'])
inE = list(G.nodes)
fe = np.array([qf[cidx[a]] < .05 for a in inE])
net_guilds = {}
for j, gk in enumerate(GKEYS):
    ks = [a for a in names if guild[pos_of[a]] == j + 1]
    inn = [a for a in ks if a in G]
    net_guilds[gk] = {'kept': len(ks), 'inNet': len(inn), 'meanDeg': rnd(np.mean([deg[a] for a in inn]), 1) if inn else 0}
net = {
    'params': {'prevalence': 0.2, 'transform': 'centred log-ratio (CLR), pseudocount 1, over the common kinds',
               'correlation': 'Spearman', 'rho': 0.6, 'q': 0.05, 'fdr': 'Benjamini-Hochberg (t approximation)',
               'modules': 'Louvain on the positive links, seed 1; a module has 3 or more kinds'},
    'n': S['nodes'], 'links': S['links'], 'pos': S['pos'], 'neg': S['neg'], 'Q': S['Q'], 'lcc': S['lcc'],
    'density': S['density'], 'meanDeg': S['meanDeg'], 'modules': NM,
    'node': b64(np.array([cidx[a] for a in nodes], np.uint16)),
    'mod': b64(np.array([mod_of.get(a, 255) for a in nodes], np.uint8)),
    'deg': b64(np.array([deg[a] for a in nodes], np.uint16)),
    'xyz': b64(xyz_q), 'xyzScale': 1e-4,
    'ij': b64(ij), 'w': b64(wq), 'wScale': 1 / 127, 'split': b64(sbits),
    'splitBits': {'BNI': 1, 'Ctrl': 2, 'N': 4, 'F': 8, 'S': 16, 'randomA': 32, 'randomB': 64},
    'cuts': cuts, 'mods': mods_out, 'louvain': louvain, 'thresholds': thresholds, 'prevalence': prevs,
    'null': {'links': null_links, 'seed': 1, 'how': 'each kind\'s values shuffled across the samples on its own'},
    'splits': splits, 'residual': residual,
    'fertNodes': rnd(fe.mean(), 3), 'fertAll': rnd((qf < .05).mean(), 3), 'guilds': net_guilds,
}

# ---------------------------------------------------------------- what the story takes from the slides' readings
F = json.load(open(FIGS))
s6, s7, s9 = F['slide6'], F['slide7'], F['slide9']
figs = {
    'chl70': [[{'v': o['v'], 'err': o['err']} for o in s6['chl'][f][4]] for f in range(3)],
    'n2o': {'times': s7['times'], 'units': s7['units'],
            'curves': [[[[p['v'] for p in s7['curves'][d][f][l]] for l in ['BNI', 'ctrl']] for f in range(3)] for d in range(5)],
            'peaks': s7['peaks'], 'p': s7['germline_p'], 'incubation': s7['incubation'], 'note': s7['incubation_note']},
    'qpcr': {g.lower(): [[[{'v': o['v'], 'err': o['err']} for o in s9[g][f][d]] for d in range(5)] for f in range(3)] for g in ['AOA', 'AOB']},
    'qpcrUnits': s9['units'], 'qpcrNote': s9['annotation'],
}
# how the metadata agrees with the slides: ammonium and nitrate by date; chlorophyll T1..T4 against the slides' days 1, 15, 24, 70
match = {}
for key, sk in [('nh4', 'nh4'), ('no3', 'no3')]:
    d = []
    for f in range(3):
        for t in range(5):
            for l in range(2):
                v, r = mdata[key]['mean'][(l * 3 + f) * 5 + t], s6[sk][f][t][l]['v']
                if v is not None and r is not None:
                    d.append(abs(v - r))
    match[key] = {'maxDiff': rnd(max(d), 1), 'medianDiff': rnd(float(np.median(d)), 2)}
chl_rows = []
for f in range(3):
    for t, day in zip(range(4), [0, 1, 2, 4]):
        for l in range(2):
            v, r = mdata['chl']['mean'][(l * 3 + f) * 5 + t], s6['chl'][f][day][l]['v']
            chl_rows.append([f, t, l, v, r, None if v is None or r is None else rnd(abs(v - r), 2)])
match['chl'] = {'rows': chl_rows, 'order': '[fert, metadata time, line, metadata mean, slide reading, difference]: the metadata\'s '
                'T1..T4 against the slides\' days 1, 15, 24 and 70'}
figs['match'] = match
log('match', {k: v for k, v in match.items() if k != 'chl'})
log('chl rows', [r for r in chl_rows if r[5] is not None and r[5] > 1])

# ---------------------------------------------------------------- open questions
n2oF = mdata['n2o']['line']['byFert'][1]
open_q = [
    'Chlorophyll: the slides show it on days 1, 15, 24 and 70 (none on day 53); the metadata has it at T1 to T4 (T5 almost '
    'empty), and its T4 values match the slides\' day 70 for the unfertilised and fertilised plots. For fertilised + DCD the '
    'metadata\'s T4 (BNI %s from 3 plots, control %s) and the slide\'s day 70 (BNI about %s, control about %s) are nearly '
    'swapped.' % (mdata['chl']['mean'][(0 * 3 + 2) * 5 + 3], mdata['chl']['mean'][(1 * 3 + 2) * 5 + 3], figs['chl70'][2][0]['v'], figs['chl70'][2][1]['v']),
    'N2O: the metadata\'s value is "the potential amount of produced nitrous oxide" (one number per sample, unit not given); '
    'the slides show N2O in ppm over a 20 to 22 day incubation of each day\'s soil. Within fertilised soil, pooled over the '
    'season, the metadata gives BNI %s against control %s (p = %s); by date it is lower for BNI on days 1 and 24 and higher on '
    'day 15, while the slides\' model finds the wheat line significant on days 1 to 53. Which measurement the metadata\'s is, '
    'and how the two relate, is open.' % (n2oF[0], n2oF[1], n2oF[2]),
    'Days: the slides\' days 1, 15, 24, 53 and 70 are taken as T1 to T5 (129, 144, 153, 182 and 199 days after planting); by '
    'that count the slides\' day 15 would be day 16.',
    'The incubation ran 20 days (slide 7) or 22 (its caption in the notes; the axis runs to about 22).',
    'Nitrate: the slide says lower under the BNI wheat on days 24 to 53 in fertilised soil; only day 24 is starred.',
    'DCD is taken to be dicyandiamide, a synthetic nitrification inhibitor (the slides do not spell it out).',
    'The field: the site and year are not given (the trial is JIRCAS\'s, in Japan); the plot map is not known, so the field\'s '
    '24 plots in four blocks (a replicate taken as a block, since the replicates behave like field blocks in the data) are '
    'illustrative.',
    'Only the prokaryotes (16S) were sent; the slides also show fungi, arbuscular mycorrhizal fungi and protists.',
    'Of the %d kinds of ammonia-oxidising archaea (class Nitrososphaeria), %d are Group 1.1c, not known to oxidise ammonia.' % (guilds['aoa']['kinds'], guilds['aoa1c']['kinds']),
    'The co-occurrence network is ours, built with a standard method for this story: correlation, not interaction; its '
    'modules follow the fertiliser and the plots; its hubs shift with the thresholds (no keystone species).',
]

data = {
    'about': ('the BNI wheat field trial (Marina Montserrat Díez and colleagues; Christa Schleper\'s group, University of Vienna, '
              'with JIRCAS, the University of Thessaly and Université Lyon 1): 16S amplicon reads, their taxonomy and the field '
              'metadata, used with the authors\' permission (29 Oct 2026); kinds numbered, no ids, no sequences; values read off '
              'the slides\' charts in figs (two readers, reconciled)'),
    'src': src, 'design': design, 'meta': mdata, 'phyla': phyla, 'guilds': guilds, 'cloud': cloud, 'common': common,
    'net': net, 'figs': figs, 'open': open_q,
}

# ---------------------------------------------------------------- checks
checks = {
    'samples 119': NS == 119,
    'kinds 100,116': c.shape[0] == 100116,
    'common kinds 3,384': NC == 3384,
    'network 1,564 kinds': S['nodes'] == 1564,
    'network 22,348 links': S['links'] == 22348,
    'modules 17': NM == 17,
    'shuffled: 0 links': null_links == 0,
    'kinds that differ by line: 2': diff['line'] == 2,
    'kinds that differ by fertiliser: 1,646': diff['fert'] == 1646,
    'kinds that differ by date: 580': diff['time'] == 580,
    'threshold 0.5: 84,506 links': thresholds[0]['links'] == 84506,
    'threshold 0.8: 449 links': thresholds[-1]['links'] == 449,
    'cut 0.7: 4,267 links': dict((round(a, 2), b) for a, b in cuts)[0.7] == 4267,
    'cuts agree with the thresholds': all(b == next(x['links'] for x in thresholds if abs(x['rho'] - a) < 1e-9) for a, b in cuts),
    'BNI network 38,653 links': splits['line'][0]['links'] == 38653,
    'control network 30,276 links': splits['line'][1]['links'] == 30276,
    'line diff within random range': splits['randomDiff'][0] <= splits['lineDiff'] <= splits['randomDiff'][1],
    'cloud 20,000': cloud['n'] == CLOUD_N,
}
for k, v in checks.items():
    log(('ok   ' if v else 'FAIL ') + k)
text = json.dumps(data, separators=(',', ':'), ensure_ascii=False)
with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write('// Generated by tools/soil/data/gen_data.py from the authors\' field trial (16S reads, taxonomy, field metadata) and '
             'tools/soil/data/figures.json; do not edit.\n// See the header of the generator and tools/soil/SPEC.md for what '
             'each field holds; decode it with SDATA (sets/sdata.js).\n')
    fh.write('const SOIL_DATA = ' + text + ';\n')
log('wrote', OUT, len(text) // 1024, 'KB')
sys.exit(0 if all(checks.values()) else 1)
