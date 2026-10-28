# Writes tools/topo/sets/data.js (TOPO_DATA) from the authors' topocyte run of the GTEx liver cohort.
# Every number comes from topocyte (Simon Schindler, André Rendeiro, Jörg Menche) or from the poster's own figure
# scripts (pub/paper/fig1/real.py and simplify.py of the topocyte repository), run here; this script only calls them
# and packs what they return. None of their code is copied into the app (topocyte is GPL-3.0).
# The authors' files stay outside the repository (only these numbers go in):
#   cells.h5ad  the cohort's cells (gtex_liver_cells.h5ad: HistoPLUS centroids and cell types of 594 GTEx liver slides,
#               CC BY 4.0); only the 123 slides labelled healthy or cirrhosis are read
#   fig1/       the poster's figure project (real.py, simplify.py)
# Needs Python 3.10+ with numpy, scipy, anndata, pandas, scikit-learn, gudhi, h5py and the topocyte checkout importable
# (PYTHONPATH=<topocyte checkout>). Slide ids, donor details and images never go in: slides are numbered.
# usage: python -I tools/topo/data/gen_data.py cells.h5ad fig1/ [cache dir]    (about half an hour the first time;
# the cohort's persistence and models are cached in the cache dir, by default fig1/../fig1_cache)
import sys, os, math, json, base64, zlib, importlib.util, functools
import numpy as np

H5AD, FIG1 = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
CACHE = os.path.abspath(sys.argv[3]) if len(sys.argv) > 3 else os.path.join(os.path.dirname(FIG1), 'fig1_cache')
os.environ['TOPOCYTE_FIG1_CACHE'] = CACHE
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sets', 'data.js')
COLUMNS = 64             # columns of the curves drawn per slide (the figure scripts' exact envelope, coarser)
FINE = 0.5               # µm: width of the windows of radius whose shares are kept (any window is a sum of them)
FINE_TOP = 100.0         # µm: the last fine window ends here; one more runs to infinity
TILE_B = 640.0           # µm: the healthy tile round b's patch (as the poster's panel a)
MARGIN = 100.0           # µm: cells kept round f's window so its alpha complex is the slide's there
R_LO, R_HI = 0.5, 120.0  # µm: radii coded in one byte on a log scale (code 255: this or more)
OVER = 96                # bins along the long side of slide f's overview (cells per bin)


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


real = module('fig1_real', os.path.join(FIG1, 'real.py'))
simplify = real._simplify()
import h5py, pandas as pd, anndata as ad
import topocyte as tc
from topocyte.ph import BettiCurve, FPCAResult, compute_local_persistent_homology
from topocyte.tl.fpca import _coefficient, _logistic, _stored_model
import gudhi


# ---- the cells: the healthy and cirrhosis slides of the h5ad, as topocyte_data's loader returns them ----
# (read from the file each time: one slide is small, and the whole cohort is only read when the figure scripts' cache
# lacks its persistence; keeping 30 million cells in memory starved the later steps)
def _rows(f, slides):
    o = f['obs']
    cats = {k: [c.decode() for c in o[k]['categories'][:]] for k in ('label', 'slide_id', 'cell_type')}
    lab = o['label']['codes'][:]
    keep = np.isin(lab, [cats['label'].index('healthy'), cats['label'].index('cirrhosis')])
    del lab
    if slides is not None:
        keep &= np.isin(o['slide_id']['codes'][:], [cats['slide_id'].index(s) for s in slides])
    return cats, np.flatnonzero(keep)


def _runs(rows, size=4_000_000):
    """Contiguous runs of the kept rows, read from the file one block at a time."""
    starts = np.flatnonzero(np.diff(rows, prepend=-2) != 1)
    ends = np.append(starts[1:], rows.size)
    for s, e in zip(starts, ends):
        a, b = int(rows[s]), int(rows[e - 1]) + 1
        while a < b:
            yield a, min(b, a + size)
            a += size


def _read(ds, rows):
    return np.concatenate([ds[a:b] for a, b in _runs(rows)])


def load_cells(slides=None):
    with h5py.File(H5AD, 'r') as f:
        cats, rows = _rows(f, slides)
        o = f['obs']
        def cat(k):
            return pd.Categorical.from_codes(_read(o[k]['codes'], rows), categories=cats[k]).remove_unused_categories()
        obs = pd.DataFrame({'slide_id': cat('slide_id'), 'label': cat('label'), 'cell_type': cat('cell_type'),
                            'prob': _read(o['prob'], rows)})
        obs.index = pd.Index(np.arange(rows.size).astype(str))
        xy = np.asarray(_read(f['obsm']['spatial'], rows), dtype=np.float32)
    return ad.AnnData(obs=obs, obsm={'spatial': xy})


def cohort_cells():
    with h5py.File(H5AD, 'r') as f:
        return int(_rows(f, None)[1].size)


real.load_cells = load_cells
# the two cohorts' stored models are read once (each read of the cache is a gigabyte)
real.cohort_view = functools.cache(real.cohort_view)
real.holdout_view = functools.cache(real.holdout_view)
MPP, RULER = real.MPP, real.RULER
log = functools.partial(print, file=sys.stderr, flush=True)


# ---- packing ----
def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def rcode(r):
    """A radius in µm as one byte on a log scale from R_LO to R_HI (255 for R_HI or more, or infinity)."""
    r = np.asarray(r, float)
    c = np.round(255 * np.log(np.clip(r, R_LO, R_HI) / R_LO) / math.log(R_HI / R_LO))
    return np.where(np.isfinite(r), c, 255).astype(np.uint8)


def rnd(a, d=3):
    return [round(float(x), d) for x in np.ravel(a)]


def env(r, v, columns=COLUMNS):
    """The figure scripts' exact envelope of a step function on the ruler, as flat [u, y, u, y, ...]."""
    with np.errstate(divide='ignore'):
        e = simplify.envelope(np.asarray(r, float), np.asarray(v, float), columns, RULER)
    return rnd(e, 4)


import gc
clf_opts = real.COHORT['classify']


def cohort_ids(view):
    ids = [str(g) for g in view.uns['betti_fpca_cos_h1']['group_ids']]
    return ids, [str(view.obs.loc[g, 'label']) for g in ids]


# ---- the cohort, per homology dimension: curves, components, scores, classifier, shares ----
def dimension(dim, groups):
    key = f'betti_fpca_cos_h{dim}'
    payload = view.uns[key]
    assert [str(g) for g in payload['group_ids']] == ids
    result = FPCAResult.coerce(payload)
    entry = payload['classifiers'][clf_opts['label_key']]
    curves = [BettiCurve.from_result(groups[g], dim) for g in ids]
    # the unit curves, drawn over the bundle's top: two passes, so that only one slide's steps are held at a time
    top = max(float(np.asarray(c.steps()[1], float).max()) / n for c, n in zip(curves, result.norms))
    drawn, off = [], [0]
    for curve, norm in zip(curves, result.norms):
        x, v = curve.steps()
        with np.errstate(divide='ignore'):
            e = simplify.envelope(np.sqrt(np.maximum(x, 0)) * MPP, np.asarray(v, float) / norm / top, COLUMNS, RULER)
        drawn.append(np.round(np.clip(e, 0, 1) * 65535).astype(np.uint16))
        off.append(off[-1] + len(e))
    del x, v
    drawn = {'off': b64(np.array(off, np.uint32)), 'uy': b64(np.concatenate(drawn))}
    v_, rho = result.eigenvectors, result.gram_eigenvalues
    from topocyte.ph.decomposition import _flat_bars, _step_sums
    rows = [v_[:, k] / (np.sqrt(rho[k]) * result.norms) for k in range(2)]   # the two shapes the story draws
    x, values = _step_sums(*_flat_bars(curves, dim)[:3], rows)
    del curves
    r = np.sqrt(x) * MPP
    del x
    phi_peak = max(float(np.abs(row).max()) for row in values)
    phi = [env(r, row / phi_peak, 240) for row in values]
    del r, values
    gc.collect()
    coef = _coefficient(view, key, clf_opts['label_key'], MPP)
    rc = np.sqrt(coef.x)
    mtop = max(float(coef.reference.max()), float(coef.positive.max()))
    gpeak = max(abs(float(coef.gamma.max())), abs(float(coef.gamma.min())))
    means = {'healthy': env(rc, coef.reference / mtop, 240), 'cirrhosis': env(rc, coef.positive / mtop, 240)}
    gamma = env(rc, coef.gamma / gpeak, 240)
    del coef, rc
    gc.collect()
    edges = list(np.arange(0.0, FINE_TOP + FINE / 2, FINE)) + [math.inf]
    table = tc.tl.fpca_scale_importance(view, fpca_key=key, key=clf_opts['label_key'], windows=edges, scale=MPP)
    # the held-out prediction of every slide, as fpca_classify's own cross-validation makes them (same folds)
    from sklearn.model_selection import StratifiedKFold, cross_val_predict
    p = entry['params']
    X = result.scores[:, :entry['n_components']]
    y = np.asarray(entry['y'])
    held = cross_val_predict(_logistic(p['Cs'], p['inner_cv'], p['scoring'], p['max_iter'], p['random_state']), X, y,
                             cv=StratifiedKFold(n_splits=p['cv'], shuffle=True, random_state=p['random_state']))
    from sklearn.metrics import confusion_matrix
    assert np.array_equal(confusion_matrix(y, held, labels=[0, 1]), np.asarray(entry['cv']['confusion_matrix'])), \
        'the re-run cross-validation does not match the stored one'
    return {
        'fve': rnd(result.explained_variance_ratio[:6], 4),
        'scores': [rnd(s, 4) for s in result.scores[:, :4]],
        'curves': drawn, 'phi': phi, 'means': means, 'gamma': gamma, 'gammaPeak': round(gpeak, 6),
        'classes': list(entry['classes']), 'y': [int(v) for v in y],
        'coef': rnd(np.ravel(entry['coef']), 6), 'intercept': round(float(np.ravel(entry['intercept'])[0]), 6),
        'C': round(float(entry['C']), 6),
        'logOdds': rnd(entry['predictions']['log_odds'], 3),
        'held': [int(v) for v in held],
        'accuracy': round(float(entry['cv']['accuracy']), 4),
        'confusion': [int(v) for v in np.ravel(entry['cv']['confusion_matrix'])],
        'shares': {'edges': [e if math.isfinite(e) else None for e in edges], 'delta': rnd(table['delta'], 5),
                   'gap': round(float(table.attrs['gap']), 4)},
    }



# Each dimension is packed in a process of its own (TOPO_PART=0 or 1), before the main one reads anything big: the
# cohort's 30.8 million bars of pieces, walked several times, ran a single process out of memory.
PART = os.environ.get('TOPO_PART')
if PART is not None:
    dim = int(PART)
    view = real.cohort_view()
    ids, labels = cohort_ids(view)
    log(f'packing H{dim} ...')
    out = dimension(dim, tc.tl.read_persistence(view, 'slide_ph'))
    with open(os.path.join(CACHE, f'topo-h{dim}.json'), 'w') as fh:
        json.dump(out, fh)
    sys.exit(0)


def part(dim):
    path = os.path.join(CACHE, f'topo-h{dim}.json')
    if not os.path.exists(path):
        import subprocess
        subprocess.run([sys.executable, os.path.abspath(__file__), *sys.argv[1:]], env={**os.environ, 'TOPO_PART': str(dim)},
                       check=True)
    with open(path) as fh:
        return json.load(fh)


h0, h1 = part(0), part(1)

# ---- the poster's panels, as its figure scripts compute them ----
log('cohort (persistence, cosine fPCA, classifiers) ...')
view = real.cohort_view()
log('cohort without slide f ...')
hold = real.holdout_view()
log('panels b, c, d ...')
pb, pc, pd_ = real.panel_b(), real.panel_c(), real.panel_d()
pc = {'fve': pc['fve']}
gc.collect()
log('f at 100 µm ...')
real.DELTA_UM = 100.0
f100, comp100 = real.f_scores(), real.f_composition()
log('panel e ...')
pe = real.panel_e()
real.DELTA_UM = 50.0
log('f at 50 µm ...')
f50, comp50 = real.f_scores(), real.f_composition()

ids, labels = cohort_ids(view)


# ---- slide f's window: its cells, types, local log-odds and local bars at 50 µm, the alpha complex there ----
cells_f = load_cells([real.SLIDE_F])
xy_px = np.asarray(cells_f.obsm['spatial'], float)
types = [str(t) for t in cells_f.obs['cell_type'].cat.categories]
x0, y0, side = real.WINDOW_F
assert np.array_equal(f50['index'], f100['index'])
idx = f50['index']
wxy = xy_px[idx] * MPP - [x0, y0]                       # µm in the window, y down as on the slide
ttype = np.asarray(cells_f.obs['cell_type'].cat.codes)[idx]
log('local persistence of the window cells at 50 µm ...')
local = compute_local_persistent_homology(xy_px, round(50.0 / MPP), max_dim=1, centers=idx, n_jobs=-1)
model, classifier = real.holdout_model()
sc = model.transform(local)
lo = np.full(len(local), np.nan)
ok = ~np.isnan(sc[:, 0])
lo[ok] = classifier.decision_function(sc[ok])
assert np.allclose(lo[ok], f50['log_odds'][ok]) and np.array_equal(np.isnan(lo), np.isnan(f50['log_odds']))
h0d, h1b = [], []
off0, off1 = [0], [0]
for k in range(len(local)):
    d0 = np.sqrt(local[k].diagrams[0]) * MPP
    d0 = d0[np.isfinite(d0[:, 1]), 1]
    d1 = np.sqrt(local[k].diagrams[1]) * MPP
    d1 = d1[np.isfinite(d1[:, 1])]
    h0d.append(rcode(np.sort(d0)))
    h1b.append(rcode(d1).ravel())
    off0.append(off0[-1] + d0.size)
    off1.append(off1[-1] + d1.shape[0])
log('alpha complex of the window ...')
near = np.flatnonzero((xy_px[:, 0] * MPP > x0 - MARGIN) & (xy_px[:, 0] * MPP < x0 + side + MARGIN) &
                      (xy_px[:, 1] * MPP > y0 - MARGIN) & (xy_px[:, 1] * MPP < y0 + side + MARGIN))
place = np.full(xy_px.shape[0], -1)
place[idx] = np.arange(idx.size)
st = gudhi.AlphaComplex(points=xy_px[near]).create_simplex_tree()
edges_w, tris_w = [], []
for s, t in st.get_filtration():
    if len(s) < 2:
        continue
    w = place[near[s]]
    if (w < 0).any():
        continue
    (edges_w if len(s) == 2 else tris_w).append((*w, math.sqrt(t) * MPP))
edges_w, tris_w = np.array(edges_w), np.array(tris_w)
k_e = int(np.flatnonzero(idx == pe['cell'])[0])     # the poster's cell v among the window's cells


def comp(c):
    return {'types': c['types'], 'healthy': rnd(c['healthy_like'], 4), 'cirrhosis': rnd(c['cirrhosis_like'], 4),
            'sizes': [c['sizes']['healthy_like'], c['sizes']['cirrhosis_like']]}


# slide f's overview: its cells counted in bins (the slide's shape, its scars from fibroblasts and lymphocytes)
sxy = xy_px * MPP
mn, mx = sxy.min(0), sxy.max(0)
bin_um = float((mx - mn).max() / OVER)
nb = np.ceil((mx - mn) / bin_um).astype(int) + 1
bi = ((sxy - mn) / bin_um).astype(int)
flat = bi[:, 1] * nb[0] + bi[:, 0]
count = np.bincount(flat, minlength=nb[0] * nb[1])
scar = np.bincount(flat, weights=np.isin(np.asarray(cells_f.obs['cell_type'].astype(str)),
                                         ['Fibroblasts', 'Lymphocytes']).astype(float), minlength=nb[0] * nb[1])
cmax = float(np.percentile(count[count > 0], 99))
over = {'bin': round(bin_um, 2), 'w': int(nb[0]), 'h': int(nb[1]),
        'window': rnd([(x0 - mn[0]) / bin_um, (y0 - mn[1]) / bin_um, side / bin_um], 3),
        'count': b64(np.clip(np.round(255 * count / cmax), 0, 255).astype(np.uint8)),
        'scar': b64(np.round(255 * np.divide(scar, count, out=np.zeros_like(scar), where=count > 0)).astype(np.uint8)),
        'cells': int(xy_px.shape[0])}

slide = {
    'side': side, 'n': int(idx.size), 'types': types,
    'xy': b64(np.round(wxy * 10).astype(np.int16)), 'type': b64(ttype.astype(np.uint8)),
    'lo50': b64(np.asarray(f50['log_odds'], np.float32)), 'lo100': b64(np.asarray(f100['log_odds'], np.float32)),
    'limit50': round(f50['limit'], 2), 'limit100': round(f100['limit'], 2), 'train': int(f50['train_slides']),
    'comp50': comp(comp50), 'comp100': comp(comp100),
    # each cell's own bars, deflated (raw): per cell the count of its pieces' joinings and of its loops (Uint16 each),
    # then all joinings' one-byte radii, then all loops' (birth, death) pairs of one-byte radii
    'local': {'n0': int(off0[-1]), 'n1': int(off1[-1]),
              'z': base64.b64encode(zlib.compress(np.diff(np.array(off0)).astype(np.uint16).tobytes() +
                                                  np.diff(np.array(off1)).astype(np.uint16).tobytes() +
                                                  np.concatenate(h0d).tobytes() +
                                                  (np.concatenate(h1b) if h1b else np.zeros(0, np.uint8)).tobytes(),
                                                  9, -15)).decode()},
    'eBars': {'h0': rnd(np.sort(np.sqrt(local[k_e].diagrams[0][np.isfinite(local[k_e].diagrams[0][:, 1]), 1]) * MPP), 3),
              'h1': rnd(np.sqrt(local[k_e].diagrams[1][np.isfinite(local[k_e].diagrams[1][:, 1])]) * MPP, 3)},
    'edges': {'n': len(edges_w), 'ij': b64(edges_w[:, :2].astype(np.uint16)), 'r': b64(rcode(edges_w[:, 2]))},
    'tris': {'n': len(tris_w), 'ijk': b64(tris_w[:, :3].astype(np.uint16)), 'r': b64(rcode(tris_w[:, 3]))},
    'e': {'cell': int(np.flatnonzero(idx == pe['cell'])[0]), 'logOdds': round(pe['log_odds'], 2),
          'drawR': round(pe['draw_r'], 2)},
    'overview': over,
}

# ---- the healthy tile round b's patch (the poster's panel a): its cells and types ----
cells_b = load_cells([real.SLIDE_B])
bxy = np.asarray(cells_b.obsm['spatial'], float) * MPP
bx0, by0, bside = real.WINDOW_B
cx, cy = bx0 + bside / 2, by0 + bside / 2
inb = (np.abs(bxy[:, 0] - cx) < TILE_B / 2) & (np.abs(bxy[:, 1] - cy) < TILE_B / 2)
tile = {'side': TILE_B, 'n': int(inb.sum()), 'types': [str(t) for t in cells_b.obs['cell_type'].cat.categories],
        'xy': b64(np.round((bxy[inb] - [cx - TILE_B / 2, cy - TILE_B / 2]) * 10).astype(np.int16)),
        'type': b64(np.asarray(cells_b.obs['cell_type'].cat.codes)[inb].astype(np.uint8)),
        'patch': rnd([(TILE_B - bside) / 2, (TILE_B - bside) / 2, bside], 3)}

# ---- the patch (panel b): its alpha filtration, bars and snapshots ----
pts = np.asarray(pb['points'])
simp = pb['simplices']
# For drawing the tower: gudhi's own persistence pairs of the same complex (as panel b builds it). An H0 bar is a
# vertex whose piece joins another at an edge: which piece it joins is read off gudhi's filtration in order (book-
# keeping for the drawing only; the deaths it gives are checked against gudhi's bars). An H1 bar is an edge that
# closes a loop and the triangle that fills it; its ring is the figure scripts' boundary of the hole just after birth.
stp = gudhi.AlphaComplex(points=pts).create_simplex_tree()
stp.compute_persistence(homology_coeff_field=2)
dies = {}
for b, d in stp.persistence_pairs():
    if len(b) == 1 and d:
        dies[tuple(sorted(d))] = b[0]
parent = list(range(len(pts)))
rep = list(range(len(pts)))
def find(i):
    while parent[i] != i:
        parent[i] = parent[parent[i]]
        i = parent[i]
    return i
joins = []
for s, t in stp.get_filtration():
    if len(s) != 2:
        continue
    a, c = find(s[0]), find(s[1])
    if a == c:
        continue
    v = dies[tuple(sorted(s))]
    dying, living = (a, c) if find(v) == a else (c, a)
    assert rep[dying] == v
    joins.append((v, rep[living], s[0], s[1], round(math.sqrt(t), 3)))
    parent[dying] = living
assert np.allclose(sorted(j[4] for j in joins), np.sort(pb['h0']), atol=2e-3), 'the joins do not match gudhi\'s H0 bars'
loops = []
for b, d in stp.persistence_pairs():
    if len(b) == 2 and d:
        tb, td = stp.filtration(b), stp.filtration(d)
        (ax, ay), (bx, by), (cx_, cy_) = pts[list(d)]
        dd = 2 * (ax * (by - cy_) + bx * (cy_ - ay) + cx_ * (ay - by))
        hole = (((ax**2 + ay**2) * (by - cy_) + (bx**2 + by**2) * (cy_ - ay) + (cx_**2 + cy_**2) * (ay - by)) / dd,
                ((ax**2 + ay**2) * (cx_ - bx) + (bx**2 + by**2) * (ax - cx_) + (cx_**2 + cy_**2) * (bx - ax)) / dd)
        ring = real._boundary(simp, pts, tb, hole)
        loops.append({'b': round(math.sqrt(tb), 3), 'd': round(math.sqrt(td), 3), 'edge': list(b), 'tri': list(d),
                      'hole': rnd(hole, 2), 'ring': [list(e) for e in ring] if ring else None})
loops.sort(key=lambda l: l['b'] - l['d'])
patch = {
    'joins': [list(j) for j in joins], 'loops': loops,
    'side': round(pb['frame'][2], 3), 'pts': rnd(pts, 2),
    'edges': [v for s, t in simp if len(s) == 2 for v in (*s, round(math.sqrt(t), 3))],
    'tris': [v for s, t in simp if len(s) == 3 for v in (*s, round(math.sqrt(t), 3))],
    'h0': rnd(np.sort(pb['h0']), 3), 'h1': rnd(pb['h1'], 3), 'loop': rnd(pb['loop'], 3), 'hole': rnd(pb['hole'], 2),
    'snaps': [round(r, 3) for r, _ in pb['snaps']], 'betti': [list(b) for b in pb['betti']],
}

data = {
    'about': 'topocyte (Schindler, Rendeiro, Menche): the GTEx liver cohort of its tutorial 04 and poster, computed by '
             'topocyte and the poster\'s figure scripts; slides numbered, no ids',
    'src': {'mpp': MPP, 'healthy': labels.count('healthy'), 'cirrhosis': labels.count('cirrhosis'),
            'cells': cohort_cells(), 'components': clf_opts['n_components'],
            'folds': int(view.uns['betti_fpca_cos_h1']['classifiers']['label']['params']['cv']),
            'ruler': list(RULER), 'rcode': [R_LO, R_HI],
            # typed from the poster (its runtime.tex): persistence and fPCA of the cohort on a laptop's CPU
            'runtime': {'minutes': 1.9, 'seconds': [71, 46], 'machine': 'Apple M4, 16 GB, 10 cores'}},
    'labels': [1 if l == 'cirrhosis' else 0 for l in labels],
    'h0': h0, 'h1': h1,
    'poster': {'fve': rnd(pc['fve'], 4), 'windows': [rnd(w, 3) for w in pd_['windows']], 'gap': round(pd_['gap'], 3),
               'confusion': list(pd_['confusion']), 'accuracy': round(pd_['accuracy'], 4)},
    'patch': patch, 'tile': tile, 'slide': slide,
}

# ---- the check: the poster's numbers ----
P = data['poster']
checks = {
    'slides 66/57': (data['src']['healthy'], data['src']['cirrhosis']) == (66, 57),
    'cells 30.8M': round(data['src']['cells'] / 1e6, 1) == 30.8,
    'fve 0.72 0.20': (round(P['fve'][0], 2), round(P['fve'][1], 2)) == (0.72, 0.20),
    'confusion 62/4/10/47': P['confusion'] == [62, 4, 10, 47],
    'accuracy 0.886': round(P['accuracy'], 3) == 0.886,
    'shares 2.73 4.65': [round(w[2], 2) for w in P['windows'] if w[0] in (5.0, 10.0)] == [2.73, 4.65],
    'gap 7.04': round(P['gap'], 2) == 7.04,
    'split 1000/5716 at 100 µm': data['slide']['comp100']['sizes'] == [1000, 5716],
    'patch 82 pieces at t1': data['patch']['betti'][0][0] == 82,
}
for k, v in checks.items():
    log(('ok   ' if v else 'FAIL ') + k)
log('windows', P['windows'], 'gap', P['gap'], 'fve', P['fve'][:4], 'e', data['slide']['e'],
    'split50', data['slide']['comp50']['sizes'], 'limits', data['slide']['limit50'], data['slide']['limit100'])

text = json.dumps(data, separators=(',', ':'), ensure_ascii=False)
with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write('// Generated by tools/topo/data/gen_data.py from the authors\' topocyte run of the GTEx liver cohort; do not '
             'edit.\n// See the header of the generator and tools/topo/SPEC.md for what each field holds.\n')
    fh.write('const TOPO_DATA = ' + text + ';\n')
log('wrote', OUT, len(text) // 1024, 'KB')
sys.exit(0 if all(checks.values()) else 1)
