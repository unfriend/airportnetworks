#!/usr/bin/env python3
"""Builds a story's protein models (tools/mol/SPEC.md): reads its models.json, fetches each entry's mmCIF from the
Protein Data Bank (into a cache outside the repository) and writes one <name>.mol per model, with its looks (a Gaussian
molecular surface with baked ambient occlusion, a cartoon, the balls' data) at a few levels of detail, and index.json.

usage: ~/molenv/bin/python tools/mol/build.py <models.json> <out folder> [--check] [--force] [--only name,name]

  --check   exits 1 when an output is missing or not built from the current models.json, entry files and this tool
  --force   rebuilds every model (otherwise a model whose inputs and file are unchanged is kept as it is)
  --only    builds only the models named (the others' entries in index.json are kept)
Env MOL_CACHE: where the mmCIF files are kept (default ~/molcache). Setup: tools/mol/README.md.
"""
import hashlib, json, math, os, re, struct, sys, time, urllib.request
import numpy as np
from scipy.spatial import cKDTree
from scipy import ndimage
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from skimage.measure import marching_cubes
import fast_simplification

VERSION = 1
MAGIC = b'MOL1'
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.expanduser(os.environ.get('MOL_CACHE', '~/molcache'))
RADII = {'C': 1.7, 'N': 1.55, 'O': 1.52, 'S': 1.8, 'P': 1.8, 'SE': 1.9, 'F': 1.47, 'CL': 1.75, 'BR': 1.85, 'I': 1.98}
ONE = {'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C', 'GLN': 'Q', 'GLU': 'E', 'GLY': 'G', 'HIS': 'H',
       'ILE': 'I', 'LEU': 'L', 'LYS': 'K', 'MET': 'M', 'PHE': 'F', 'PRO': 'P', 'SER': 'S', 'THR': 'T', 'TRP': 'W',
       'TYR': 'Y', 'VAL': 'V', 'MSE': 'M', 'SEP': 'S', 'TPO': 'T', 'PTR': 'Y', 'HYP': 'P', 'MLY': 'K', 'CSO': 'C',
       'DA': 'A', 'DC': 'C', 'DG': 'G', 'DT': 'T', 'DU': 'U', 'A': 'A', 'C': 'C', 'G': 'G', 'U': 'U', 'DI': 'I', 'I': 'I'}
PURINES = {'DA', 'DG', 'A', 'G', 'DI', 'I'}
PALETTE = ['#73ccff', '#ffbf59', '#8fd98f', '#ff8c8c', '#c9a6ff', '#ffd966', '#66d9c7', '#f2a6d9']
NUCLEIC = '#d9ccb3'
# the surface: each heavy atom a Gaussian exp(B (1 - d^2 / r^2)) of its van der Waals radius r (an atom alone has its
# surface at r; B, the sharpness, makes neighbours merge more when small); the finest grid step and its voxel cap
SHARP, STEP, MAX_VOXELS = 0.8, 0.8, 5_000_000
# default triangle targets for a ~300-residue protein (2,400 heavy atoms), scaled by size, LOD0 capped
LODS, ATOMS_REF, LOD0_CAP = [40000, 12000, 3000], 2400, 120000
# the cartoon: (spline segments per residue, points round the cross-section) per level of detail; fewer over 500 residues
CARTOON, CARTOON_BIG = [(6, 10), (3, 8), (2, 5)], [(4, 8), (2, 6), (1, 5)]


def fail(m):
    print(m)
    sys.exit(1)


# ------------------------------------------------------------------------------------------------------------ mmCIF --
TOK = re.compile(r"""'((?:[^']|'(?=\S))*)'(?=\s|$)|"((?:[^"]|"(?=\S))*)"(?=\s|$)|(\S+)""")


def cif_tokens(text):
    # (value, quoted) pairs; a line starting with ; opens a text field that the next such line closes; # starts a comment
    lines, i = text.split('\n'), 0
    while i < len(lines):
        ln = lines[i]
        if ln.startswith(';'):
            buf = [ln[1:]]
            i += 1
            while i < len(lines) and not lines[i].startswith(';'):
                buf.append(lines[i])
                i += 1
            i += 1
            yield '\n'.join(buf).strip(), True
            continue
        for m in TOK.finditer(ln):
            if m.group(3) is not None:
                if m.group(3).startswith('#'):
                    break
                yield m.group(3), False
            else:
                yield (m.group(1) if m.group(1) is not None else m.group(2)), True
        i += 1


def cif_parse(text, want):
    # the categories wanted, each a list of rows {item: value}, from loops and single-row (item value) blocks alike
    toks, out, k = list(cif_tokens(text)), {}, 0
    bare = lambda j: not toks[j][1]
    while k < len(toks):
        t = toks[k][0]
        if bare(k) and t == 'loop_':
            k += 1
            cols = []
            while k < len(toks) and bare(k) and toks[k][0].startswith('_'):
                cols.append(toks[k][0])
                k += 1
            vals = []
            while k < len(toks) and not (bare(k) and (toks[k][0].startswith('_') or toks[k][0] == 'loop_' or toks[k][0].startswith('data_'))):
                vals.append(toks[k][0])
                k += 1
            cat = cols[0].split('.')[0] if cols else ''
            if cat in want:
                names, nc = [c.split('.', 1)[1] for c in cols], len(cols)
                out[cat] = [dict(zip(names, vals[j:j + nc])) for j in range(0, len(vals) - nc + 1, nc)]
        elif bare(k) and t.startswith('_') and '.' in t and k + 1 < len(toks):
            cat, name = t.split('.', 1)
            if cat in want:
                out.setdefault(cat, [{}])[0][name] = toks[k + 1][0]
            k += 2
        else:
            k += 1
    return out


def fetch(entry, assembly):
    name = f'{entry.upper()}-assembly{assembly}.cif' if assembly else f'{entry.upper()}.cif'
    p = os.path.join(CACHE, name)
    if not os.path.exists(p):
        os.makedirs(CACHE, exist_ok=True)
        print(f'  downloading {name}')
        urllib.request.urlretrieve('https://files.rcsb.org/download/' + name, p + '.part')
        os.replace(p + '.part', p)
    return p


def source(spec, base):
    src = spec['pdb']
    if src.lower().endswith('.cif'):
        p = src if os.path.isabs(src) else os.path.join(base, src)
        if not os.path.exists(p):
            fail(f'{spec["name"]}: no file {p}')
        return p
    return fetch(src, spec.get('assembly'))


# --------------------------------------------------------------------------------------------------------- the model --
def in_range(rule, chain, num):
    # residues: a number (the highest kept), [from, to], or {chain: either}; a chain 'A-2' (an assembly's copy) takes A's
    if rule is None:
        return True
    if isinstance(rule, dict):
        rule = rule.get(chain, rule.get(chain.split('-')[0]))
        if rule is None:
            return True
    if isinstance(rule, (int, float)):
        return num <= rule
    return rule[0] <= num <= rule[1]


def hexrgb(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def read_model(spec, path):
    C = cif_parse(open(path, encoding='utf-8', errors='replace').read(), {'_atom_site', '_struct_conf', '_struct_sheet_range'})
    rows = C.get('_atom_site') or fail(f'{spec["name"]}: no atoms in {path}')
    model0 = rows[0].get('pdbx_PDB_model_num', '1')
    want = spec.get('chains')
    keep_het = set(spec.get('ligands', []))
    res, by = [], {}
    for r in rows:
        if r.get('pdbx_PDB_model_num', '1') != model0 or r.get('label_alt_id', '.') not in ('.', '?', 'A'):
            continue
        el = r.get('type_symbol', 'C').upper()
        if el in ('H', 'D'):
            continue
        comp = r.get('label_comp_id') or r.get('auth_comp_id')
        poly = r.get('label_seq_id', '.') not in ('.', '?')
        if not poly and comp not in keep_het:   # (waters, ions and ligands, unless asked for)
            continue
        chain = r.get('auth_asym_id') or r['label_asym_id']
        if want and chain not in want:
            continue
        num = int(r.get('auth_seq_id') or r['label_seq_id'])
        if not in_range(spec.get('residues'), chain, num):
            continue
        key = (chain, num, r.get('pdbx_PDB_ins_code', '?'), comp)
        if key not in by:
            by[key] = {'chain': chain, 'num': num, 'comp': comp, 'poly': poly, 'atoms': {}}
            res.append(by[key])
        by[key]['atoms'][r.get('label_atom_id', r.get('auth_atom_id'))] = (el, float(r['Cartn_x']), float(r['Cartn_y']), float(r['Cartn_z']))
    if not res:
        fail(f'{spec["name"]}: no atoms kept (chains {want})')
    # chains in the order asked for (or met), residues in file order within each
    order = want or list(dict.fromkeys(r['chain'] for r in res))
    res.sort(key=lambda r: order.index(r['chain']))
    # secondary structure (helices from _struct_conf, strands from _struct_sheet_range), by chain (an assembly's copies
    # take their original's) and residue number
    ss = {}
    for r in C.get('_struct_conf', []):
        if r.get('conf_type_id', '').startswith('HELX'):
            for n in range(int(r['beg_auth_seq_id']), int(r['end_auth_seq_id']) + 1):
                ss[(r['beg_auth_asym_id'], n)] = 1
    for r in C.get('_struct_sheet_range', []):
        for n in range(int(r['beg_auth_seq_id']), int(r['end_auth_seq_id']) + 1):
            ss.setdefault((r['beg_auth_asym_id'], n), 2)
    for r in res:
        A = r['atoms']
        r['kind'] = 0 if 'CA' in A and r['poly'] else 1 if ("C1'" in A or 'P' in A) and r['poly'] else 2
        r['ss'] = ss.get((r['chain'], r['num'])) or ss.get((r['chain'].split('-')[0], r['num'])) or 0 if r['kind'] == 0 else 0
        anchor = A.get('CA') if r['kind'] == 0 else A.get('P') or A.get("C4'") if r['kind'] == 1 else None
        r['pos'] = np.array(anchor[1:] if anchor else np.mean([a[1:] for a in A.values()], 0), float)
        r['one'] = ONE.get(r['comp'], 'X')
    if not C.get('_struct_conf') and not C.get('_struct_sheet_range'):
        guess_ss(res)
    return res


def guess_ss(res):
    # no records (a model, not an entry): helices where CA i to i+3 is about 5 A for four in a row, strands where CA i
    # to i+2 is about 6.7 A (a rough stand-in for DSSP)
    P = [r['pos'] for r in res]
    for i in range(len(res) - 3):
        if all(res[j]['kind'] == 0 and res[j]['chain'] == res[i]['chain'] for j in range(i, i + 4)):
            if 4.6 < np.linalg.norm(P[i] - P[i + 3]) < 5.6:
                for j in range(i, i + 4):
                    res[j]['ss'] = 1
    for i in range(len(res) - 2):
        if res[i]['ss'] == 0 and all(res[j]['kind'] == 0 and res[j]['chain'] == res[i]['chain'] for j in range(i, i + 3)):
            if np.linalg.norm(P[i] - P[i + 2]) > 6.4:
                res[i + 1]['ss'] = 2


def colours(spec, res):
    # each residue's colour and domain, by the model's colour rule (tools/mol/SPEC.md, "colour")
    rule = spec.get('colour', {})
    by, chains, doms = rule.get('by', 'chain'), rule.get('chains', {}), rule.get('domains', [])
    names = list(dict.fromkeys(d[4] if len(d) > 4 else f'{d[0]} {d[1]}-{d[2]}' for d in doms))
    order = list(dict.fromkeys(r['chain'] for r in res))
    for r in res:
        c, base = r['chain'], r['chain'].split('-')[0]
        own = chains.get(c) or chains.get(base)
        if own is None:
            own = rule.get('default') if by == 'uniform' or (by == 'domain' and rule.get('default')) else None
        if own is None:
            own = NUCLEIC if r['kind'] == 1 else PALETTE[order.index(c) % len(PALETTE)] if by == 'chain' else '#b3b3b3'
        r['dom'] = 255
        if by == 'domain':
            for d in doms:
                if d[0] in (c, base, '*') and d[1] <= r['num'] <= d[2]:
                    own, r['dom'] = d[3], names.index(d[4] if len(d) > 4 else f'{d[0]} {d[1]}-{d[2]}')
                    break
        if by == 'uniform':
            own = rule.get('default', '#b3b3b3') if not chains.get(c) and not chains.get(base) else own
        r['rgb'] = hexrgb(own)
    return names


def orient(spec, res):
    # the model's frame: centred and turned to its own axes (longest along x, then y), unless orient is false (the
    # entry's own coordinates, so models cut from one entry line up); returns R, c with model = R (pdb - c)
    X = np.array([a[1:] for r in res for a in r['atoms'].values()], float)
    if spec.get('orient', True) is False:
        return np.eye(3), np.zeros(3)
    c = X.mean(0)
    w, V = np.linalg.eigh(np.cov((X - c).T))
    ax = [V[:, i] for i in np.argsort(-w)]
    for i in (0, 1):   # (a fixed sign: the side with the heavier tail positive)
        if np.sum(((X - c) @ ax[i]) ** 3) < 0:
            ax[i] = -ax[i]
    R = np.array([ax[0], ax[1], np.cross(ax[0], ax[1])])
    P = (X - c) @ R.T
    c = c + R.T @ ((P.min(0) + P.max(0)) / 2)   # (the box's middle at the origin)
    return R, c


# -------------------------------------------------------------------------------------------------------- the surface --
def density(xyz, rad, h, B, lo, shape):
    grid = np.zeros(shape, np.float32)
    flat = grid.ravel()
    g = (xyz - lo) / h
    base = np.round(g).astype(np.int64)
    cut2 = (rad * rad * (1 + 6.9 / B))   # (contributions under 0.001 left out)
    m = int(math.ceil(math.sqrt(cut2.max()) / h))
    st = np.array([shape[1] * shape[2], shape[2], 1])
    inv = 1.0 / (rad * rad)
    for dx in range(-m, m + 1):
        for dy in range(-m, m + 1):
            for dz in range(-m, m + 1):
                if dx * dx + dy * dy + dz * dz > (m + 0.9) ** 2:
                    continue
                c = base + (dx, dy, dz)
                d2 = (((c - g) * h) ** 2).sum(1)
                ok = d2 < cut2
                np.add.at(flat, (c[ok] * st).sum(1), np.exp(B * (1 - d2[ok] * inv[ok])).astype(np.float32))
    return grid


def sample(grid, P, lo, h, order=1):
    return ndimage.map_coordinates(grid, ((P - lo) / h).T, order=order, mode='constant', cval=0.0)


def fib(n):
    # n directions spread evenly over the sphere (a Fibonacci lattice: the same every run)
    i = np.arange(n) + 0.5
    z = 1 - 2 * i / n
    t = math.pi * (1 + 5 ** 0.5) * i
    s = np.sqrt(1 - z * z)
    return np.stack([s * np.cos(t), s * np.sin(t), z], 1)


def surface_ao(grid, lo, h, V, N):
    # ambient occlusion: from each vertex, rays over its hemisphere (cosine-weighted) marched through the density; a ray
    # is blocked once it meets the inside (density over the surface's level), near blocks counting more
    D, T = fib(48), np.array([1.6, 2.6, 4.0, 6.0, 9.0, 13.0])
    out = np.empty(len(V))
    for a in range(0, len(V), 4000):
        v, n = V[a:a + 4000], N[a:a + 4000]
        w = np.clip(n @ D.T, 0, None)                                   # (k, 48)
        P = v[:, None, None, :] + (D[None, :, None, :] * T[None, None, :, None]) + n[:, None, None, :] * 0.3
        d = sample(grid, P.reshape(-1, 3), lo, h).reshape(len(v), len(D), len(T))
        hit = np.clip((d - 0.6) / 0.6, 0, 1)                            # (soft: partly blocked near the level)
        fall = np.array([1.0, 0.95, 0.85, 0.7, 0.55, 0.4])              # (far blocks count less)
        blocked = np.max(hit * fall, axis=2)
        out[a:a + 4000] = 1 - (w * blocked).sum(1) / np.maximum(w.sum(1), 1e-6)
    return np.clip(out, 0, 1) ** 1.6   # (more contrast: the open half stays light, crevices go dark)


def mc_surface(X, rad, B, h):
    pad = max(4.5, float(rad.max()) * math.sqrt(1 + 6.9 / B)) + 2 * h   # (an atom's reach: wider when soft)
    lo = X.min(0) - pad
    shape = tuple(int(s) for s in np.ceil((X.max(0) + pad - lo) / h).astype(int) + 1)
    grid = density(X, rad, h, B, lo, shape)
    V, F, _, _ = marching_cubes(grid, level=1.0, spacing=(h, h, h), allow_degenerate=False)
    V = V + lo
    # faces wound outwards (towards falling density)
    gx, gy, gz = np.gradient(grid, h)
    cen = V[F].mean(1)
    G = np.stack([sample(g, cen, lo, h) for g in (gx, gy, gz)], 1)
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    if np.sum((fn * G).sum(1)) > 0:
        F = F[:, ::-1]
    # pieces: cavities inside (wound inwards: negative volume) and crumbs dropped
    n = len(V)
    A = coo_matrix((np.ones(len(F) * 3), (F.ravel(), np.roll(F, 1, 1).ravel())), shape=(n, n))
    k, lab = connected_components(A, directed=False)
    fl = lab[F[:, 0]]
    vol = np.bincount(fl, weights=np.einsum('ij,ij->i', V[F[:, 0]], np.cross(V[F[:, 1]], V[F[:, 2]])) / 6, minlength=k)
    cnt = np.bincount(fl, minlength=k)
    keep = (vol > 0) & (cnt >= max(40, 0.002 * len(F)))
    F = F[keep[fl]]
    used = np.unique(F)
    remap = np.full(n, -1)
    remap[used] = np.arange(len(used))
    return V[used], remap[F], grid, lo, (gx, gy, gz)


# -------------------------------------------------------------------------------------------------------- the cartoon --
def smooth01(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


DIMS = {0: (0.38, 0.38, 2), 1: (1.25, 0.32, 2), 2: (1.05, 0.3, 4), 9: (1.0, 1.0, 2)}   # (half width, half depth, roundness) coil, helix, strand, nucleic


def catmull(P, sub):
    # a Catmull-Rom spline through P, sub points per span (and the last point): positions and the span parameter t
    Q = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out, ts = [], []
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = Q[i], Q[i + 1], Q[i + 2], Q[i + 3]
        for k in range(sub):
            u = k / sub
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
            ts.append(i + u)
    out.append(P[-1])
    ts.append(len(P) - 1)
    return np.array(out), np.array(ts)


class Mesh:
    def __init__(self):
        self.V, self.N, self.C, self.R, self.F, self.n = [], [], [], [], [], 0

    def add(self, V, N, C, R, F):
        self.F.append(np.asarray(F) + self.n)
        self.V.append(V); self.N.append(N); self.C.append(C); self.R.append(R)
        self.n += len(V)

    def done(self):
        if not self.V:
            return None
        return (np.vstack(self.V), np.vstack(self.N), np.vstack(self.C), np.concatenate(self.R), np.vstack(self.F))


def sweep(M, pts, T, S, a, b, p, col, rid, ring, caps):
    # a tube along pts (tangents T, width directions S) whose cross-section at each point is a superellipse of half width
    # a, half depth b and roundness p; ring points round it; caps closes the two ends
    n = len(pts)
    U = np.cross(T, S)
    th = 2 * math.pi * (np.arange(ring) + 0.5) / ring
    cs, sn = np.cos(th), np.sin(th)
    e = 2.0 / p[:, None]
    x = a[:, None] * np.sign(cs) * np.abs(cs) ** e
    y = b[:, None] * np.sign(sn) * np.abs(sn) ** e
    nx = np.sign(cs) * np.abs(cs) ** (2 - e) / a[:, None]
    ny = np.sign(sn) * np.abs(sn) ** (2 - e) / b[:, None]
    V = pts[:, None, :] + S[:, None, :] * x[..., None] + U[:, None, :] * y[..., None]
    N = S[:, None, :] * nx[..., None] + U[:, None, :] * ny[..., None]
    N /= np.linalg.norm(N, axis=2, keepdims=True)
    j, k = np.meshgrid(np.arange(n - 1), np.arange(ring), indexing='ij')
    i0, i1, i2, i3 = j * ring + k, j * ring + (k + 1) % ring, (j + 1) * ring + k, (j + 1) * ring + (k + 1) % ring
    F = np.concatenate([np.stack([i0, i1, i2], -1).reshape(-1, 3), np.stack([i1, i3, i2], -1).reshape(-1, 3)])
    M.add(V.reshape(-1, 3), N.reshape(-1, 3), np.repeat(col, ring, 0), np.repeat(rid, ring), F)
    for end in [e for e, c in zip((0, n - 1), caps) if c]:
        s = -1 if end == 0 else 1
        cv = np.vstack([pts[end], V[end]])
        cn = np.repeat(T[end][None] * s, ring + 1, 0)
        f = np.array([[0, 1 + q, 1 + (q + 1) % ring] if s > 0 else [0, 1 + (q + 1) % ring, 1 + q] for q in range(ring)])
        M.add(cv, cn, np.repeat(col[end][None], ring + 1, 0), np.repeat(rid[end], ring + 1), f)
    return V, N


def frames(pts, side):
    T = np.gradient(pts, axis=0)
    T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-9)
    S = side - T * (side * T).sum(1, keepdims=True)
    for i in range(len(S)):   # (where the side runs along the tangent: the last good one)
        if np.linalg.norm(S[i]) < 1e-3:
            S[i] = S[i - 1] if i else np.cross(T[i], [0.3, 0.5, 0.8])
    S /= np.linalg.norm(S, axis=1, keepdims=True)
    return T, S


def protein_segment(M, seg, ids, sub, ring):
    n = len(seg)
    P = np.array([r['pos'] for r in seg])
    kind = [r['ss'] for r in seg]
    for i in range(n):   # (a strand of one residue is drawn as coil)
        if kind[i] == 2 and not ((i > 0 and kind[i - 1] == 2) or (i + 1 < n and kind[i + 1] == 2)):
            kind[i] = 0
    Ps = P.copy()
    for i in range(1, n - 1):   # (strands straightened: their CA zigzag averaged out)
        if kind[i] == 2:
            Ps[i] = (P[i - 1] + 2 * P[i] + P[i + 1]) / 4
    # each residue's width direction: its carbonyl (C to O), flipped to agree with the one before
    side, last = [], np.array([0.0, 0.0, 1.0])
    for r in seg:
        A = r['atoms']
        o = np.array(A['O'][1:]) - np.array(A['C'][1:]) if 'O' in A and 'C' in A else last
        if np.dot(o, last) < 0:
            o = -o
        side.append(o / (np.linalg.norm(o) or 1))
        last = side[-1]
    side = np.array(side)
    pts, ts = catmull(Ps, sub)
    i0 = np.minimum(np.floor(ts).astype(int), n - 1)
    i1 = np.minimum(i0 + 1, n - 1)
    f = ts - i0
    sv = side[i0] * (1 - f)[:, None] + side[i1] * f[:, None]
    T, S = frames(pts, sv)
    dim = np.array([DIMS[k] for k in kind])
    sf = smooth01(f)[:, None]
    d = dim[i0] * (1 - sf) + dim[i1] * sf
    a, b, p = d[:, 0].copy(), d[:, 1].copy(), d[:, 2].copy()
    # arrows: over a strand's last residue the width runs from 1.7 down to the coil's; at its start a step (two rings)
    cut = []
    for i in range(1, n):
        if kind[i] == 2 and (i + 1 == n or kind[i + 1] != 2):
            on = (ts >= i - 1) & (ts <= i)
            u = ts[on] - (i - 1)
            a[on] = 1.75 * (1 - u) + DIMS[0][0] * u
            b[on] = DIMS[2][1]
            p[on] = 4
            cut.append(int(np.argmax(ts >= i - 1)))
    near = np.minimum(np.round(ts).astype(int), n - 1)
    col = np.array([seg[q]['rgb'] for q in near], float)
    rid = np.array([ids[q] for q in near])
    # pieces between the arrows' steps, each swept on its own; a step's flat face joins the two
    bounds = [0] + cut + [len(pts) - 1]
    for k in range(len(bounds) - 1):
        s0, s1 = bounds[k], bounds[k + 1]
        if s1 <= s0:
            continue
        sl = slice(s0, s1 + 1)
        aa = a[sl].copy()
        if k + 1 < len(bounds) - 1:
            aa[-1] = DIMS[2][0]   # (the piece before a step ends at the strand's width)
        sweep(M, pts[sl], T[sl], S[sl], aa, b[sl], p[sl], col[sl], rid[sl], ring, caps=(s0 == 0, s1 == len(pts) - 1))
        if k + 1 < len(bounds) - 1:   # the arrow's back: a flat ring between the two widths
            j = s1
            Vb, Va = ring_at(pts[j], T[j], S[j], DIMS[2][0], b[j], ring), ring_at(pts[j], T[j], S[j], 1.75, b[j], ring)
            V = np.vstack([Vb, Va])
            q = np.arange(ring)
            F = np.concatenate([np.stack([q, (q + 1) % ring, ring + q], 1), np.stack([(q + 1) % ring, ring + (q + 1) % ring, ring + q], 1)])
            M.add(V, np.repeat(-T[j][None], 2 * ring, 0), np.repeat(col[j][None], 2 * ring, 0), np.repeat(rid[j], 2 * ring), F)


def ring_at(c, t, s, a, b, ring):
    # one cross-section's points (an arrow's, roundness 4), as sweep makes them
    th = 2 * math.pi * (np.arange(ring) + 0.5) / ring
    cs, sn = np.cos(th), np.sin(th)
    return c + np.outer(a * np.sign(cs) * np.abs(cs) ** 0.5, s) + np.outer(b * np.sign(sn) * np.abs(sn) ** 0.5, np.cross(t, s))


def nucleic_segment(M, seg, ids, sub, ring):
    P = np.array([r['pos'] for r in seg])
    if len(seg) >= 2:
        pts, ts = catmull(P, sub)
        near = np.minimum(np.round(ts).astype(int), len(seg) - 1)
        T, S = frames(pts, np.cross(np.gradient(pts, axis=0), [0.31, 0.83, 0.47]))
        one = np.ones(len(pts))
        sweep(M, pts, T, S, one * 1.0, one * 1.0, one * 2, np.array([seg[q]['rgb'] for q in near], float), np.array([ids[q] for q in near]), ring, (True, True))
    # the bases: a rung from the backbone to the base's middle (N1 of a purine, N3 of a pyrimidine)
    for q, r in enumerate(seg):
        A = r['atoms']
        tip = A.get('N1' if r['comp'] in PURINES else 'N3')
        if not tip:
            continue
        a, b = r['pos'], np.array(tip[1:])
        ax = b - a
        ln = np.linalg.norm(ax)
        if ln < 1:
            continue
        m = max(2, sub // 2)
        pts = a[None] + ax[None] * np.linspace(0, 1, m)[:, None]
        T = np.repeat((ax / ln)[None], m, 0)
        S = np.repeat(np.cross(T[0], [0.31, 0.83, 0.47])[None], m, 0)
        S /= np.linalg.norm(S, axis=1, keepdims=True)
        one = np.ones(m)
        c = np.array(r['rgb'], float) * 0.85 + 255 * 0.15
        sweep(M, pts, T, S, one * 0.75, one * 0.75, one * 2, np.repeat(c[None], m, 0), np.repeat(ids[q], m), max(5, ring - 2), (False, True))


def cartoon(res, sub, ring):
    M = Mesh()
    ids = {id(r): i for i, r in enumerate(res)}
    seg, segs = [], []
    for r in res:   # (a new piece at each chain, kind or gap: CA to CA over 4.3 A, P to P over 8 A)
        if r['kind'] == 2:
            continue
        if seg and (seg[-1]['chain'] != r['chain'] or seg[-1]['kind'] != r['kind'] or
                    np.linalg.norm(seg[-1]['pos'] - r['pos']) > (4.3 if r['kind'] == 0 else 8.0)):
            segs.append(seg)
            seg = []
        seg.append(r)
    if seg:
        segs.append(seg)
    for s in segs:
        sid = [ids[id(r)] for r in s]
        if s[0]['kind'] == 1:
            nucleic_segment(M, s, sid, sub, ring)
        elif len(s) >= 2:
            protein_segment(M, s, sid, sub, ring)
    return M.done()


def cartoon_ao(V, N, anchors):
    # cheap: how crowded it is just outside each vertex (residues within 10 A of a point 2.5 A out), the core darker
    tree = cKDTree(anchors)
    cnt = tree.query_ball_point(V + N * 2.5, 10.0, return_length=True)
    return np.clip(1.2 - cnt / 40.0, 0.45, 1.0)


# --------------------------------------------------------------------------------------------------------- the file --
def octenc(N):
    n = N / np.abs(N).sum(1, keepdims=True)
    x, y = n[:, 0].copy(), n[:, 1].copy()
    neg = n[:, 2] < 0
    sx, sy = np.where(x >= 0, 1.0, -1.0), np.where(y >= 0, 1.0, -1.0)
    x[neg], y[neg] = ((1 - np.abs(n[neg, 1])) * sx[neg]), ((1 - np.abs(n[neg, 0])) * sy[neg])
    return np.clip(np.round(np.stack([x, y], 1) * 127), -127, 127).astype(np.int8)


class Blob:
    def __init__(self):
        self.parts, self.n = [], 0

    def put(self, arr):
        b = np.ascontiguousarray(arr).tobytes()
        off = self.n
        self.parts.append(b + b'\0' * (-len(b) % 4))
        self.n += len(self.parts[-1])
        return off

    def bytes(self):
        return b''.join(self.parts)


def geometry(blob, V, N, C, AO, R, F, q):
    off, s = q
    Q = np.clip(np.round((V - off) / s), -32767, 32767).astype('<i2')
    col = np.concatenate([np.clip(np.round(C), 0, 255), np.clip(np.round(AO * 255), 0, 255)[:, None]], 1).astype(np.uint8)
    big = len(V) >= 65536
    return {'v': int(len(V)), 't': int(len(F)), 'pos': blob.put(Q), 'nrm': blob.put(octenc(N)), 'col': blob.put(col),
            'res': blob.put(R.astype('<u2')), 'idx': blob.put(F.astype('<u4' if big else '<u2')), 'i32': big}


def r6(x):
    return [round(float(v), 4) for v in x]


def build_model(spec, path):
    t0 = time.time()
    res = read_model(spec, path)
    doms = colours(spec, res)
    R, c = orient(spec, res)
    for r in res:
        r['pos'] = R @ (r['pos'] - c)
        r['atoms'] = {k: (a[0], *(R @ (np.array(a[1:]) - c))) for k, a in r['atoms'].items()}
    X = np.array([a[1:] for r in res for a in r['atoms'].values()])
    rad = np.array([RADII.get(a[0], 1.7) for r in res for a in r['atoms'].values()])
    owner = np.array([i for i, r in enumerate(res) for _ in r['atoms']])
    rgb = np.array([r['rgb'] for r in res], float)
    anchors = np.array([r['pos'] for r in res])
    lo, hi = X.min(0) - rad.max(), X.max(0) + rad.max()
    mid = (lo + hi) / 2
    radius = float(np.max(np.linalg.norm(X - mid, axis=1) + rad))
    q = (mid, float(np.max(hi - lo) / 2 / 32000 * 1.15))   # (int16 positions: under 0.003 A apart for 100 A)
    looks = spec.get('looks', ['surface', 'cartoon', 'balls'])
    blob, out = Blob(), {}
    chains = list(dict.fromkeys(r['chain'] for r in res))
    info = {'atoms': len(X), 'residues': len(res)}
    if 'surface' in looks:
        h = max(spec.get('step', STEP), (np.prod(X.max(0) - X.min(0) + 13) / MAX_VOXELS) ** (1 / 3))
        V0, F0, grid, glo, G = mc_surface(X, rad, spec.get('sharpness', SHARP), h)
        k = (len(X) / ATOMS_REF) ** 0.75
        targets = spec.get('lods') or [min(LOD0_CAP, int(LODS[0] * k)), int(LODS[1] * k), max(800, int(LODS[2] * k))]
        tree = cKDTree(X)
        out['surface'] = []
        # soft: per level, how much to smooth it (angstroms): 0 cuts that level down from the detailed surface; more builds
        # it from its own blurred density (atoms a little bigger, merging more, on a coarser grid), a smooth outline that
        # needs few triangles and shades evenly: what a crowd seen from afar wants (cut down from the detailed surface, a
        # few hundred triangles look crumpled)
        soft = spec.get('soft', [0, 0, 0])
        made = {0: (V0, F0, grid, glo, G, h)}
        for li, tg in enumerate(targets):
            s = float(soft[li]) if li < len(soft) else 0.0
            if s not in made:
                hs = max(h, 0.8 + 0.6 * s)
                made[s] = (*mc_surface(X, rad + 0.5 * s, spec.get('sharpness', SHARP) / (1 + s), hs), hs)
            Vs, Fs, gs, gl, Gs, hs = made[s]
            if tg < len(Fs):
                V, F = fast_simplification.simplify(Vs.astype(np.float32), Fs.astype(np.int64), target_reduction=1 - tg / len(Fs))
                V = V.astype(float)
            else:
                V, F = Vs, Fs
            N = -np.stack([sample(g, V, gl, hs) for g in Gs], 1)
            N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
            _, near = tree.query(V)
            ri = owner[near]
            ao = surface_ao(gs, gl, hs, V, N)
            out['surface'].append(geometry(blob, V, N, rgb[ri], ao, ri, F, q))
        info['surface'] = f'{len(F0)} triangles at {h:.2f} A'
    if 'cartoon' in looks and any(r['kind'] < 2 for r in res):
        out['cartoon'] = []
        for sub, ring in (CARTOON if len(res) <= 500 else CARTOON_BIG):
            V, N, Cc, Ri, F = cartoon(res, sub, ring)
            out['cartoon'].append(geometry(blob, V, N, Cc, cartoon_ao(V, N, anchors), Ri, F, q))
    if 'balls' in looks:
        out['balls'] = True
    # the residue table
    cnt = cKDTree(anchors).query_ball_point(anchors, 10.0, return_length=True)
    rao = np.clip(1.15 - cnt / 40.0, 0.4, 1.0)
    rcol = np.concatenate([rgb, np.round(rao * 255)[:, None]], 1).astype(np.uint8)
    table = {'n': len(res), 'chain': blob.put(np.array([chains.index(r['chain']) for r in res], np.uint8)),
             'num': blob.put(np.array([r['num'] for r in res], '<i4')),
             'one': blob.put(np.frombuffer(''.join(r['one'] for r in res).encode('ascii'), np.uint8)),
             'kind': blob.put(np.array([r['kind'] for r in res], np.uint8)), 'ss': blob.put(np.array([r['ss'] for r in res], np.uint8)),
             'dom': blob.put(np.array([r['dom'] for r in res], np.uint8)), 'pos': blob.put(anchors.astype('<f4')), 'col': blob.put(rcol)}
    head = {'v': VERSION, 'name': spec['name'], 'title': spec.get('title', spec['name']), 'credit': spec.get('credit', ''),
            'chains': chains, 'domains': doms, 'radius': round(radius, 3), 'size': r6(hi - lo), 'centre': r6(mid),
            'frame': {'rot': r6(R.ravel()), 'origin': r6(c)}, 'q': {'off': r6(q[0]), 'scale': q[1]},
            'res': table, 'looks': out}
    js = json.dumps(head, sort_keys=True, separators=(',', ':')).encode('utf-8')
    js += b' ' * (-len(js) % 4)
    data = MAGIC + struct.pack('<II', VERSION, len(js)) + js + blob.bytes()
    info['seconds'] = round(time.time() - t0, 1)
    return data, head, info


# ------------------------------------------------------------------------------------------------------------ main --
def fp(b):
    return hashlib.sha256(b).hexdigest()[:16]


def src_hash(spec, path):
    tool = open(os.path.abspath(__file__), 'rb').read()
    return fp(json.dumps(spec, sort_keys=True).encode() + open(path, 'rb').read() + tool)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 2:
        sys.exit(__doc__)
    check, force = '--check' in sys.argv, '--force' in sys.argv
    only = next((sys.argv[i + 1].split(',') for i, a in enumerate(sys.argv) if a == '--only' and i + 1 < len(sys.argv)), None)
    if only:
        args = [a for a in args if a not in ','.join(only).split(',') and a != ','.join(only)]
    mj, outdir = args[0], args[1]
    specs = json.load(open(mj))
    specs = specs.get('models', specs) if isinstance(specs, dict) else specs
    names = [s['name'] for s in specs]
    if len(set(names)) != len(names) or not all(re.match(r'^[a-z0-9][a-z0-9_-]{0,40}$', n) for n in names):
        fail('models.json: each name once, lower-case letters, digits, - and _')
    ip = os.path.join(outdir, 'index.json')
    old = {m['name']: m for m in json.load(open(ip))['models']} if os.path.exists(ip) else {}
    base, entries, bad = os.path.dirname(os.path.abspath(mj)), [], 0
    for spec in specs:
        path = source(spec, base)
        sh, f = src_hash(spec, path), os.path.join(outdir, spec['name'] + '.mol')
        o = old.get(spec['name'])
        current = o and o.get('src') == sh and os.path.exists(f) and fp(open(f, 'rb').read()) == o.get('fp')
        if check:
            if not current:
                print(f'{spec["name"]}.mol is out of date')
                bad += 1
            continue
        if (current and not force) or (only and spec['name'] not in only):
            if o:
                entries.append(o)
            print(f'{spec["name"]}: kept')
            continue
        data, head, info = build_model(spec, path)
        os.makedirs(outdir, exist_ok=True)
        open(f, 'wb').write(data)
        L = head['looks']
        e = {'name': spec['name'], 'title': head['title'], 'credit': head['credit'], 'file': spec['name'] + '.mol', 'fp': fp(data),
             'bytes': len(data), 'radius': head['radius'], 'size': head['size'], 'residues': head['res']['n'], 'chains': head['chains'],
             'looks': {k: ([g['t'] for g in v] if isinstance(v, list) else True) for k, v in L.items()}, 'src': sh}
        entries.append(e)
        print(f'{spec["name"]}: {info["residues"]} residues, {info["atoms"]} atoms; ' +
              '; '.join(f'{k} {"/".join(str(t) for t in v) if isinstance(v, list) else ""}' for k, v in e['looks'].items()) +
              f'; {len(data) / 1024:.0f} KB in {info["seconds"]} s' + (f' ({info["surface"]})' if 'surface' in info else ''))
    if check:
        idx_ok = os.path.exists(ip) and [m['name'] for m in json.load(open(ip))['models']] == names
        if not idx_ok:
            print('index.json does not list the models of models.json')
        print('models are current' if not bad and idx_ok else 'run tools/mol/build.py')
        sys.exit(0 if not bad and idx_ok else 1)
    entries.sort(key=lambda m: names.index(m['name']))
    open(ip, 'w').write(json.dumps({'v': VERSION, 'models': entries}, indent=1) + '\n')
    print(f'wrote {ip}')


if __name__ == '__main__':
    main()
