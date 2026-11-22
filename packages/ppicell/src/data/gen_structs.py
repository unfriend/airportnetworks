#!/usr/bin/env python3
"""Writes ../sets/structs.js (PPI_STRUCTS): three real structures from the Protein Data Bank for chapter 7, one point per
amino acid (its alpha carbon) and one per DNA nucleotide (its phosphate), in angstroms, centred, with each residue's
domain. The PDB's data are public domain (CC0); the entries are credited in the story.

usage: python3 -I packages/ppicell/src/data/gen_structs.py <folder> [--check]

<folder> holds the entries' files below (WANT); any missing is downloaded there from files.rcsb.org first.
  1GRI  GRB2, full length (Maignan et al., Science 268, 291, 1995): chain A; its domains from UniProt P62993 (SH3 1-58,
        SH2 60-152, SH3 156-217)
  1TSR  TP53's core domain on DNA (Cho et al., Science 265, 346, 1994): chain B (the one bound to its site) and the DNA
        (chains E and F)
  1BG1  STAT3 as a pair on DNA (Becker et al., Nature 394, 145, 1998): the biological assembly (the two STAT3s, each
        holding the other's phosphorylated tyrosine in its SH2 domain, and the DNA); STAT3's SH2 from UniProt P40763
        (580-670)
--check exits 1 if structs.js is not what this would write.
"""
import json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'sets', 'structs.js')
# what each entry gives: (file, [(part name, author chain, 'protein' or 'dna', domains [(name, first, last)])])
WANT = {
    'grb2': ('1GRI.cif', 'GRB2, full length', 'PDB 1GRI (Maignan et al., Science 1995)', [
        ('GRB2', 'A', 'protein', [('SH3', 1, 58), ('SH2', 60, 152), ('SH3', 156, 217)])]),
    'tp53': ('1TSR.cif', "TP53's core domain on DNA", 'PDB 1TSR (Cho et al., Science 1994)', [
        ('TP53', 'B', 'protein', []), ('DNA', 'E', 'dna', []), ('DNA', 'F', 'dna', [])]),
    'stat3': ('1BG1-assembly1.cif', 'STAT3 as a pair on DNA', 'PDB 1BG1 (Becker et al., Nature 1998)', [
        ('STAT3', 'A', 'protein', [('SH2', 580, 670)]), ('STAT3', 'A-2', 'protein', [('SH2', 580, 670)]),
        ('DNA', 'B', 'dna', []), ('DNA', 'B-2', 'dna', [])]),
    # chapter 6's lenses
    'rasraf': ('4G0N.cif', 'H-Ras bound to the RBD of Raf', 'PDB 4G0N', [('HRAS', 'A', 'protein', []), ('RAF1', 'B', 'protein', [])]),
    'igg': ('1IGT.cif', 'an antibody (IgG)', 'PDB 1IGT (Harris et al., 1997)', [
        ('IgG light', 'A', 'protein', []), ('IgG heavy', 'B', 'protein', []), ('IgG light', 'C', 'protein', []), ('IgG heavy', 'D', 'protein', [])]),
    'bira': ('1BIA.cif', 'biotin ligase (BirA, E. coli)', 'PDB 1BIA (Wilson et al., 1992)', [('BirA', 'A', 'protein', [])]),
    # chapter 2's crowd (simplified: COARSE), and the lenses' tubes and halos
    'ubq': ('1UBQ.cif', 'ubiquitin', 'PDB 1UBQ (Vijay-Kumar et al., 1987)', [('UBQ', 'A', 'protein', [])]),
    'cam': ('1CLL.cif', 'calmodulin', 'PDB 1CLL (Chattopadhyaya et al., 1992)', [('CALM', 'A', 'protein', [])]),
    'gapdh': ('1U8F.cif', 'GAPDH (four chains)', 'PDB 1U8F (Jenkins and Tanner, 2006)', [(n, c, 'protein', []) for n, c in [('GAPDH', 'O'), ('GAPDH', 'P'), ('GAPDH', 'Q'), ('GAPDH', 'R')]]),
    'tub': ('1JFF.cif', 'tubulin (an alpha-beta pair)', 'PDB 1JFF (Lowe et al., 2001)', [('TUBA', 'A', 'protein', []), ('TUBB', 'B', 'protein', [])]),
    'actin': ('1ATN.cif', 'actin', 'PDB 1ATN (Kabsch et al., 1990)', [('ACT', 'A', 'protein', [])]),
    # chapter 3's receptor (its own residues only: the crystallised fusion's T4 lysozyme, numbered from 1000, left out)
    'b2ar': ('2RH1.cif', 'the beta-2 adrenergic receptor', 'PDB 2RH1 (Cherezov et al., 2007)', [('ADRB2', 'A', 'protein', [], 999)]),
    # chapter 7's shuttle
    'jak2': ('2B7A.cif', "JAK2's kinase domain", 'PDB 2B7A', [('JAK2', 'A', 'protein', [])]),
    'p300': ('3BIY.cif', "p300's acetyltransferase domain", 'PDB 3BIY (Liu et al., 2008)', [('EP300', 'A', 'protein', [])]),
}
# the crowd's simplified forms: a few balls (each the centre of a group of residues, its radius their reach), by
# k-means from evenly spaced starts, so the same every run
COARSE = ['ubq', 'cam', 'gapdh', 'tub', 'actin', 'bira']


def coarse(pts, k):
    cen = [pts[int(i * len(pts) / k)] for i in range(k)]
    for _ in range(30):
        groups = [[] for _ in cen]
        for p in pts:
            groups[min(range(len(cen)), key=lambda j: sum((p[i] - cen[j][i]) ** 2 for i in range(3)))].append(p)
        cen = [[sum(p[i] for p in g) / len(g) for i in range(3)] if g else cen[j] for j, g in enumerate(groups)]
    out = []
    for c, g in zip(cen, groups):
        if g:
            r = (sum(sum((p[i] - c[i]) ** 2 for i in range(3)) for p in g) / len(g)) ** 0.5 + 2.4
            out.append([round(c[0] * 10), round(c[1] * 10), round(c[2] * 10), round(r * 10)])
    return out


def fetch(folder, name):
    p = os.path.join(folder, name)
    if not os.path.exists(p):
        os.makedirs(folder, exist_ok=True)
        urllib.request.urlretrieve('https://files.rcsb.org/download/' + name, p)
    return p


def atoms(path):
    cols, rows = [], []
    for line in open(path):
        if line.startswith('_atom_site.'):
            cols.append(line.split('.', 1)[1].strip())
        elif cols and (line.startswith('ATOM') or line.startswith('HETATM')):
            rows.append(line.split())
    ix = {c: i for i, c in enumerate(cols)}
    for r in rows:
        if r[ix['pdbx_PDB_model_num']] != '1' or r[ix['label_alt_id']] not in ('.', 'A'):
            continue
        yield (r[ix['auth_asym_id']], int(r[ix['auth_seq_id']]), r[ix['label_atom_id']].strip('"'),
               float(r[ix['Cartn_x']]), float(r[ix['Cartn_y']]), float(r[ix['Cartn_z']]))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        sys.exit(__doc__)
    folder, check = args[0], '--check' in sys.argv
    out = {}
    for key, (file, title, cite, parts) in WANT.items():
        A = list(atoms(fetch(folder, file)))
        got = []
        for part in parts:
            name, chain, kind, doms = part[:4]
            upto = part[4] if len(part) > 4 else 1e9   # (residues numbered up to this only)
            want = 'CA' if kind == 'protein' else 'P'
            pts = sorted({(seq, x, y, z) for c, seq, a, x, y, z in A if c == chain and a == want and seq <= upto})
            dom = [next((k for k, (n, a, b) in enumerate(doms) if a <= seq <= b), -1) for seq, *_ in pts]
            got.append({'name': name, 'kind': kind, 'chain': chain, 'res': [p[0] for p in pts], 'xyz': [p[1:] for p in pts],
                        'dom': dom, 'doms': [n for n, a, b in doms]})
        # centred on the middle of all its points; tenths of an angstrom as integers
        allp = [p for g in got for p in g['xyz']]
        c = [sum(p[i] for p in allp) / len(allp) for i in range(3)]
        cg = coarse([[p[i] - c[i] for i in range(3)] for p in allp], max(6, min(24, len(allp) // 25))) if key in COARSE else None
        for g in got:
            g['xyz'] = [round((p[i] - c[i]) * 10) for p in g['xyz'] for i in range(3)]
        out[key] = {'title': title, 'cite': cite, 'parts': got}
        if cg:
            out[key]['coarse'] = cg
        print(key, title + ':', ', '.join(f"{g['name']} {g['chain']} {len(g['res'])}" for g in got))
    js = ('// Generated by src/data/gen_structs.py from the Protein Data Bank (public domain): never edit by hand.\n'
          '// One point per amino acid (alpha carbon) and per DNA nucleotide (phosphate), tenths of an angstrom, centred.\n'
          'const PPI_STRUCTS = ' + json.dumps(out, separators=(',', ':')) + ';\n'
          "if (typeof module !== 'undefined') module.exports = PPI_STRUCTS;\n")
    if check:
        same = os.path.exists(OUT) and open(OUT).read() == js
        print('sets/structs.js is current' if same else 'sets/structs.js is out of date: run gen_structs.py')
        sys.exit(0 if same else 1)
    open(OUT, 'w').write(js)
    print(f'wrote sets/structs.js ({len(js) // 1024} KB)')


main()
