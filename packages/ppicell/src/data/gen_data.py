#!/usr/bin/env python3
"""Writes ../sets/data.js (PPI_DATA) from the sources, which stay outside the repository.

usage: python3 -I packages/ppicell/src/data/gen_data.py <folder> [--check]

<folder> holds (any sub-folder is searched):
  DataS1_interactome.tsv        the interactome of Menche et al., Science 347, 1257601 (2015), Data S1 (the authors'
                                permission: see docs/data-and-permissions.md)
  subcellular_location.tsv      the Human Protein Atlas's subcellular locations (its download page; its licence: see the
                                package's README.md)
  Homo_sapiens.gene_info.gz     NCBI Gene's table (public domain): the interactome's gene numbers to symbols and Ensembl ids

What is written: derived numbers only. Every gene's symbol, its places in the cell map's 13 (from the Atlas's
locations, which 49 of them map to which place is LOC below; the sperm cell's own are left out), its main places and
the Atlas's reliability; every link as two gene numbers and its kinds of evidence (the paper's seven). And, for the
test (test-data.mjs), the split of the links into possible, through a gate and impossible as computed here, under the
strict and the generous reading of which way a membrane protein faces. No sequence, image, antibody or donor data.
--check exits 1 if data.js is not what this would write.
"""
import base64, gzip, json, os, struct, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'sets', 'data.js')

# the cell map's 13 places, in its order (packages/cellstress, stories/spatial.js)
PLACES = ['Cytosol', 'Nucleoplasm', 'Nucleolus', 'ER', 'Golgi', 'Mitochondria', 'Lysosomes', 'Endosomes', 'Peroxisomes',
          'Plasma membrane', 'Nuclear envelope', 'Cytoskeleton', 'Vesicles']
# the Atlas's locations onto them
LOC = {
    0: ['Cytosol', 'Cytoplasmic bodies', 'Aggresome', 'Rods & Rings', 'Lipid droplets'],
    1: ['Nucleoplasm', 'Nuclear bodies', 'Nuclear speckles', 'Mitotic chromosome', 'Kinetochore'],
    2: ['Nucleoli', 'Nucleoli fibrillar center', 'Nucleoli rim'],
    3: ['Endoplasmic reticulum'], 4: ['Golgi apparatus'], 5: ['Mitochondria'], 6: ['Lysosomes'], 7: ['Endosomes'],
    8: ['Peroxisomes'], 9: ['Plasma membrane', 'Cell Junctions', 'Focal adhesion sites', 'Cleavage furrow'],
    10: ['Nuclear membrane'],
    11: ['Microtubules', 'Actin filaments', 'Intermediate filaments', 'Centrosome', 'Centriolar satellite', 'Mitotic spindle',
         'Microtubule ends', 'Cytokinetic bridge', 'Midbody', 'Midbody ring', 'Basal body', 'Primary cilium',
         'Primary cilium tip', 'Primary cilium transition zone'],
    12: ['Vesicles'],
}
SPERM = ['Principal piece', 'Mid piece', 'End piece', 'Connecting piece', 'Acrosome', 'Equatorial segment', 'Calyx',
         'Perinuclear theca', 'Annulus', 'Flagellar centriole']
PLACE_OF = {n: k for k, v in LOC.items() for n in v}
REL = {'': 0, 'Uncertain': 1, 'Approved': 2, 'Supported': 3, 'Enhanced': 4}
KINDS = ['regulatory', 'binary', 'literature', 'metabolic', 'complexes', 'kinase', 'signaling']
# spaces (packages/cellstress): 0 cytosol, 1 nucleoplasm, 2 ER lumen, 3 Golgi lumen, 4 mitochondrial matrix,
# 5 lysosome, 6 endosome, 7 peroxisome, 8 outside the cell; a place's inner space and its membrane's other side
INNER = [0, 1, 1, 2, 3, 4, 5, 6, 7, 0, 1, 0, 0]
OUTER = [-1, -1, -1, 0, 0, 0, 0, 0, 0, 8, 0, -1, -1]
GATES = {(0, 1), (0, 2), (0, 4), (0, 7), (2, 3), (3, 8), (3, 5), (6, 5), (8, 6)}
GATES |= {(b, a) for a, b in GATES}


def find(folder, name):
    for root, _, files in os.walk(folder):
        if name in files:
            return os.path.join(root, name)
    sys.exit(f'{name} not found in {folder}')


def b64(fmt, values):
    return base64.b64encode(struct.pack('<' + fmt * len(values), *values)).decode()


def spaces(mask, generous):
    s = set()
    for pl in range(13):
        if mask >> pl & 1:
            s.add(INNER[pl])
            if generous and OUTER[pl] >= 0:
                s.add(OUTER[pl])
    return s


def judge(ma, mb, generous):
    sa, sb = spaces(ma, generous), spaces(mb, generous)
    if sa & sb:
        return 0
    return 1 if any((x, y) in GATES for x in sa for y in sb) else 2


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        sys.exit(__doc__)
    folder, check = args[0], '--check' in sys.argv
    # NCBI Gene: number -> symbol, Ensembl id
    sym, ens = {}, {}
    with gzip.open(find(folder, 'Homo_sapiens.gene_info.gz'), 'rt') as f:
        for line in f:
            if line.startswith('#'):
                continue
            c = line.split('\t')
            sym[c[1]] = c[2]
            for t in c[5].split('|'):
                if t.startswith('Ensembl:'):
                    ens[c[1]] = t[8:]
    # the interactome
    links = []
    for line in open(find(folder, 'DataS1_interactome.tsv')):
        if line.startswith('#') or not line.strip():
            continue
        a, b, t = line.rstrip('\n').split('\t')
        kinds = 0
        for k in t.split(';'):
            kinds |= 1 << KINDS.index(k.strip())
        links.append((a.strip(), b.strip(), kinds))
    genes = sorted({g for a, b, _ in links for g in (a, b)}, key=int)
    idx = {g: i for i, g in enumerate(genes)}
    # the Atlas
    atlas = {}
    with open(find(folder, 'subcellular_location.tsv')) as f:
        head = f.readline().rstrip('\n').split('\t')
        col = {n: head.index(n) for n in ['Gene', 'Reliability', 'Main location', 'Additional location']}
        for line in f:
            c = line.rstrip('\n').split('\t')
            atlas[c[col['Gene']]] = c
    pl, mn, rel, sperm_only = [], [], [], 0
    for g in genes:
        r = atlas.get(ens.get(g))
        m = main = 0
        if r:
            for n in r[col['Main location']].split(';'):
                if n in PLACE_OF:
                    main |= 1 << PLACE_OF[n]
            for n in (r[col['Main location']] + ';' + r[col['Additional location']]).split(';'):
                if n in PLACE_OF:
                    m |= 1 << PLACE_OF[n]
            if not m and any(n in SPERM for n in (r[col['Main location']] + ';' + r[col['Additional location']]).split(';')):
                sperm_only += 1
        pl.append(m)
        mn.append(main)
        rel.append(REL.get(r[col['Reliability']], 0) if r and m else 0)
    # the split, for the test: possible, through a gate, impossible; links that are not contacts (regulatory or
    # metabolic only) and links with an end without a place apart
    NONCONTACT = (1 << 0) | (1 << 3)
    split = {}
    for generous in (False, True):
        c = [0, 0, 0]
        for a, b, k in links:
            if not k & ~NONCONTACT:
                continue
            ma, mb = pl[idx[a]], pl[idx[b]]
            if ma and mb:
                c[judge(ma, mb, generous)] += 1
        split['generous' if generous else 'strict'] = c
    not_contact = sum(1 for _, _, k in links if not k & ~NONCONTACT)
    unplaced = sum(1 for a, b, k in links if k & ~NONCONTACT and not (pl[idx[a]] and pl[idx[b]]))
    data = {
        'source': 'Menche et al., Science 347, 1257601 (2015), Data S1; Human Protein Atlas subcellular locations; NCBI Gene',
        'places': PLACES, 'kinds': KINDS,
        'nGenes': len(genes), 'nLinks': len(links), 'placed': sum(1 for m in pl if m), 'spermOnly': sperm_only,
        'sym': '|'.join(sym.get(g, 'Gene ' + g) for g in genes),
        'pl': b64('H', pl), 'main': b64('H', mn), 'rel': ''.join(str(x) for x in rel),
        # each link: gene a, gene b (16 bits each), its kinds (8 bits: bit i is KINDS[i])
        'links': base64.b64encode(b''.join(struct.pack('<HHB', idx[a], idx[b], k) for a, b, k in links)).decode(),
        'check': {'split': split, 'notContact': not_contact, 'unplaced': unplaced},
    }
    out = ('// Generated by src/data/gen_data.py from the interactome of Menche et al. (2015), the Human Protein Atlas\'s\n'
           '// subcellular locations and NCBI Gene: never edit by hand. Derived numbers only (see the package\'s README.md).\n'
           'const PPI_DATA = ' + json.dumps(data, separators=(',', ':')) + ';\n'
           "if (typeof module !== 'undefined') module.exports = PPI_DATA;\n")
    if check:
        same = os.path.exists(OUT) and open(OUT).read() == out
        print('sets/data.js is current' if same else 'sets/data.js is out of date: run gen_data.py')
        sys.exit(0 if same else 1)
    open(OUT, 'w').write(out)
    print(f'wrote sets/data.js ({len(out) // 1024} KB): {len(genes)} genes ({data["placed"]} with a place), {len(links)} links;'
          f' split strict {split["strict"]}, generous {split["generous"]}; not contacts {not_contact}, unplaced {unplaced}')


main()
