#!/usr/bin/env python3
"""Writes ../../data/lookup.json: what the page needs to map a network chosen on it (the Network tab, "Your own
network" in SPEC.md) onto the cell, loaded by the page only when a network is chosen. Derived identifiers and classes
only, no sequences.

usage: python3 -I packages/ppicell/src/data/gen_lookup.py <atlas folder> <folder> [--check]

<atlas folder> holds the Human Protein Atlas's subcellular_location.tsv (or .tsv.zip, as its download page gives it:
https://www.proteinatlas.org/download/tsv/subcellular_location.tsv.zip; its terms: see the package's README.md).
<folder> is gen_sides.py's (uniprot.tsv.gz, 9606.tsv, Homo_sapiens.gene_info.gz, sources.json: gen_sides.py --fetch).
It also reads ../sets/data.js and ../sets/sides.js as they stand.

What is written:
  the map's 13,460 proteins, in data.js's order: each one's NCBI gene number (found again from its symbol, as
  gen_sides.py does) and Ensembl gene id (NCBI Gene's cross-reference; the number only, ENSG and its zeros dropped);
  every gene the Atlas lists that is not one of the map's proteins (by Ensembl id, or by symbol): its symbol, NCBI gene
  number, Ensembl id, reviewed UniProt accession (gen_sides.py's choice), its places on the cell map's 13 as
  gen_data.py maps the Atlas's locations (main ones too) and the Atlas's reliability, each membrane place's side class,
  layer, evidence and basis as gen_sides.py derives them from UniProt, and the Complex Portal complexes of sides.js it
  is a member of;
  former symbols and other names (NCBI Gene's synonyms, UniProt's gene names) that name exactly one protein and no
  protein's own symbol.
--check exits 1 if lookup.json is not what this would write.
"""
import base64, csv, gzip, io, json, os, re, struct, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen_data as GD     # noqa: E402  (its places: LOC, PLACE_OF, REL, SPERM)
import gen_sides as GS    # noqa: E402  (its rules: features, parse_location, classify, SPACES, MEMBRANE)

OUT = os.path.join(HERE, '..', '..', 'data', 'lookup.json')


def read_js(name):
    src = open(os.path.join(HERE, '..', 'sets', name), encoding='utf-8').read()
    return json.loads(src[src.index('{'):src.rindex('};') + 1])


def atlas_rows(folder):
    for root, _, files in os.walk(folder):
        if 'subcellular_location.tsv' in files:
            return open(os.path.join(root, 'subcellular_location.tsv'), encoding='utf-8').read()
        if 'subcellular_location.tsv.zip' in files:
            with zipfile.ZipFile(os.path.join(root, 'subcellular_location.tsv.zip')) as z:
                return z.read('subcellular_location.tsv').decode('utf-8')
    sys.exit('subcellular_location.tsv(.zip) not found in ' + folder)


def ens_num(e):
    return str(int(e[4:])) if e and e.startswith('ENSG') and e[4:].isdigit() else ''


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 2:
        sys.exit(__doc__)
    hpa, folder, check = args[0], args[1], '--check' in sys.argv
    D, SD = read_js('data.js'), read_js('sides.js')
    sym = D['sym'].split('|')
    N = len(sym)
    pl0 = struct.unpack('<%dH' % N, base64.b64decode(D['pl']))
    # NCBI Gene: symbol -> gene numbers (increasing), gene number -> Ensembl id, synonyms
    cand, ens_of, syn_of, sym_of = {}, {}, {}, {}
    for line in gzip.open(os.path.join(folder, 'Homo_sapiens.gene_info.gz'), 'rt', encoding='utf-8'):
        if line[0] == '#':
            continue
        c = line.split('\t')
        g = int(c[1])
        cand.setdefault(c[2], []).append(g)
        sym_of[g] = c[2]
        for t in c[5].split('|'):
            if t.startswith('Ensembl:') and g not in ens_of:
                ens_of[g] = t[8:]
        syn_of[g] = [s for s in c[4].split('|') if s and s != '-']
    # the map's gene numbers again from their symbols (gen_sides.py's way)
    gid, prev = [], 0
    for s in sym:
        v = [int(s[5:])] if s.startswith('Gene ') else sorted(x for x in cand.get(s, []) if x > prev)
        assert v, 'no gene number for ' + s
        gid.append(v[0])
        prev = v[0]
    map_ens = {ens_of.get(g, '') for g in gid} - {''}
    map_sym = {s.upper() for s in sym}
    gid_of_ens = {}
    for g, e in sorted(ens_of.items()):
        gid_of_ens.setdefault(e, g)
    # UniProt (reviewed human entries)
    rows = {}
    with gzip.open(os.path.join(folder, 'uniprot.tsv.gz'), 'rt', encoding='utf-8') as f:
        head = f.readline().rstrip('\n').split('\t')
        for line in f:
            r = dict(zip(head, line.rstrip('\n').split('\t')))
            rows[r['Entry']] = r
    by_gid, prim = {}, {}
    for acc, r in rows.items():
        for g in r['GeneID'].split(';'):
            if g.strip():
                by_gid.setdefault(int(g), []).append(acc)
        prim.setdefault(r['Gene Names (primary)'], []).append(acc)
    # the Atlas's genes not in the map
    text = atlas_rows(hpa)
    lines = text.split('\n')
    head = lines[0].split('\t')
    col = {n: head.index(n) for n in ['Gene', 'Gene name', 'Reliability', 'Main location', 'Additional location']}
    X = {'sym': [], 'acc': [], 'gid': [], 'ens': [], 'pl': [], 'main': [], 'rel': [], 'cls': [], 'lay': [], 'ev': [], 'by': []}
    xacc_all = {}
    atlas_n, skipped = 0, 0
    seen_sym = set()
    feats = {}
    for line in lines[1:]:
        if not line.strip():
            continue
        c = line.split('\t')
        atlas_n += 1
        e, s = c[col['Gene']], c[col['Gene name']]
        if e in map_ens or s.upper() in map_sym or s.upper() in seen_sym or not s:
            skipped += 1
            continue
        seen_sym.add(s.upper())
        g = gid_of_ens.get(e, 0)
        m = mn = 0
        for n in c[col['Main location']].split(';'):
            if n in GD.PLACE_OF:
                mn |= 1 << GD.PLACE_OF[n]
        for n in (c[col['Main location']] + ';' + c[col['Additional location']]).split(';'):
            if n in GD.PLACE_OF:
                m |= 1 << GD.PLACE_OF[n]
        rel = GD.REL.get(c[col['Reliability']], 0) if m else 0
        # its reviewed UniProt entry (gen_sides.py's choice: by gene number, its own symbol first, then the longest
        # location text; else the one whose primary name is its symbol)
        acc = ''
        cs = by_gid.get(g) if g else None
        if cs:
            acc = sorted(cs, key=lambda a: (rows[a]['Gene Names (primary)'] != s, -len(rows[a]['Subcellular location [CC]']), a))[0]
            for a in cs:
                xacc_all.setdefault(a, len(X['sym']))
        elif len(prim.get(s, [])) == 1:
            acc = prim[s][0]
            xacc_all.setdefault(acc, len(X['sym']))
        for k in range(13):
            if not m >> k & 1:
                continue
            if k not in GS.MEMBRANE:
                X['cls'].append('.'); X['lay'].append('-'); X['ev'].append('-'); X['by'].append('-')
                continue
            if acc and acc not in feats:
                feats[acc] = (GS.features(rows[acc]), GS.parse_location(rows[acc]['Subcellular location [CC]']))
            cl, ly, ev, by = GS.classify(*feats[acc], k) if acc else (0, '-', '-', '-')
            if cl <= 1:
                ly, ev, by = '-', '-', ('-' if cl == 0 else by)
            GS.SPACES(k, cl, ly)
            X['cls'].append(str(cl)); X['lay'].append(ly); X['ev'].append(ev); X['by'].append(by)
        X['sym'].append(s); X['acc'].append(acc); X['gid'].append(str(g) if g else ''); X['ens'].append(ens_num(e))
        X['pl'].append(m); X['main'].append(mn); X['rel'].append(str(rel))
    nx = len(X['sym'])
    # the complexes of sides.js each extra gene is a member of (9606.tsv's expanded participant lists)
    cx_at = {c[0]: i for i, c in enumerate(SD['cx'])}
    cxm = {}
    with open(os.path.join(folder, '9606.tsv'), newline='', encoding='utf-8') as f:
        rd = csv.reader(f, delimiter='\t')
        h = next(rd)
        ci = {n: h.index(n) for n in ['#Complex ac', 'Expanded participant list']}
        for row in rd:
            n = cx_at.get(int(row[ci['#Complex ac']][4:]))
            if n is None:
                continue
            for tok in row[ci['Expanded participant list']].split('|'):
                base = tok.split('(')[0].split('-')[0]
                if base in xacc_all:
                    cxm.setdefault(n, set()).add(xacc_all[base])
    # synonyms that name exactly one protein (map or extra) and are no protein's own symbol
    own = map_sym | {s.upper() for s in X['sym']}
    names = {}
    for i, g in enumerate(gid):
        for s in syn_of.get(g, []):
            names.setdefault(s.upper(), set()).add(i)
    for j, g in enumerate(X['gid']):
        if g:
            for s in syn_of.get(int(g), []):
                names.setdefault(s.upper(), set()).add(N + j)
    # (UniProt's gene names of the map's entries, sides.js's, and the lookup's)
    refs = {a: i for i, a in enumerate(SD['acc'].split('|')) if a}
    refs.update({a: N + j for a, j in xacc_all.items()})
    for acc, ref in refs.items():
        if acc in rows:
            for s in rows[acc]['Gene Names'].split():
                names.setdefault(s.upper(), set()).add(ref)
    syn = sorted([s, next(iter(v))] for s, v in names.items() if len(v) == 1 and s not in own and not re.match(r'^\d+$', s))
    b64 = lambda vals: base64.b64encode(struct.pack('<%dH' % len(vals), *vals)).decode()
    src = json.load(open(os.path.join(folder, 'sources.json')))
    src['atlas'] = 'Human Protein Atlas subcellular_location.tsv (' + str(atlas_n) + ' genes)'
    out_data = {
        'source': src,
        'n': N,
        'gid': '|'.join(str(g) for g in gid),
        'ens': '|'.join(ens_num(ens_of.get(g, '')) for g in gid),
        'syn': syn,
        'extra': {'sym': '|'.join(X['sym']), 'acc': '|'.join(X['acc']), 'gid': '|'.join(X['gid']), 'ens': '|'.join(X['ens']),
                  'pl': b64(X['pl']), 'main': b64(X['main']), 'rel': ''.join(X['rel']),
                  'cls': ''.join(X['cls']), 'lay': ''.join(X['lay']), 'ev': ''.join(X['ev']), 'by': ''.join(X['by']),
                  'cx': [[n, sorted(v)] for n, v in sorted(cxm.items())]},
        'check': {'atlasGenes': atlas_n, 'inMap': skipped, 'extra': nx, 'extraPlaced': sum(1 for m in X['pl'] if m),
                  'extraWithUniProt': sum(1 for a in X['acc'] if a), 'mapWithEnsembl': sum(1 for g in gid if ens_of.get(g)),
                  'synonyms': len(syn), 'complexesWithExtra': len(cxm)},
    }
    out = json.dumps(out_data, separators=(',', ':'), ensure_ascii=False) + '\n'
    if check:
        same = os.path.exists(OUT) and open(OUT, encoding='utf-8').read() == out
        print('data/lookup.json is current' if same else 'data/lookup.json is out of date: run gen_lookup.py')
        sys.exit(0 if same else 1)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(out)
    print(f'wrote data/lookup.json ({len(out.encode()) // 1024} KB):', json.dumps(out_data['check']))


if __name__ == '__main__':
    main()
