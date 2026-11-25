#!/usr/bin/env python3
"""Writes ../sets/sides.js (PPI_SIDES): on which side of a membrane each protein sits in each of its places, the links
judged again with those sides, and the curated human complexes. Reads ../sets/data.js (PPI_DATA, as gen_data.py wrote
it) and three public files; the interactome's and the Atlas's own files are not needed.

usage: python3 -I packages/ppicell/src/data/gen_sides.py <folder> [--check]
       python3 -I packages/ppicell/src/data/gen_sides.py --fetch <folder>    (downloads the three files into <folder>)

<folder> holds:
  uniprot.tsv.gz        UniProtKB/Swiss-Prot, reviewed human entries (CC BY 4.0), from rest.uniprot.org's stream: the
                        fields of FIELDS below (no sequences)
  9606.tsv              the EBI Complex Portal's curated human complexes (complextab), release in sources.json
  Homo_sapiens.gene_info.gz   NCBI Gene (public domain): data.js keeps symbols, not gene numbers, so the numbers are
                        found again from the symbols (the genes are in gene number order there, which settles a symbol
                        that names two genes)
  sources.json          what --fetch fetched and when (releases), copied into sides.js

Mapping: a story gene takes the reviewed UniProt entry whose GeneID is its gene number (of several, the one whose
primary name is its symbol, else the one with the longest location text); a gene with none, the one whose primary name
(else whose only synonym match) is its symbol.

The sides (one class per protein and place the Atlas lists it in; only the eight places with a membrane are judged:
ER, Golgi, mitochondria, lysosomes, endosomes, peroxisomes, plasma membrane, nuclear envelope; the others are spaces):
  An entry of UniProt's subcellular location (its comment, every isoform's block, Notes left out) covers a place when its
  term names it (TERMS below: e.g. 'Endoplasmic reticulum membrane', 'Microsome', 'Golgi apparatus, trans-Golgi network',
  'Mitochondrion inner membrane', 'Early endosome', 'Cell membrane', 'Apical cell membrane', 'Cell junction, ...',
  'Cell projection, ...', 'Secreted' (the plasma membrane's outside), 'Nucleus inner membrane', 'Nucleus, nuclear pore
  complex'). The bare term 'Membrane' covers any membrane place, but only for what a protein is wherever it sits in a
  membrane (steps 1, 2, 4). A place no entry covers is 0 'not in UniProt': no side is carried from one organelle to
  another.
  The protein's features: TRANSMEM (spans), INTRAMEM, TOPO_DOM (which side its domains face), LIPID (GPI anchors; on
  the cytosol's side: S-palmitoyl, N-myristoyl, S-farnesyl, S-geranylgeranyl, counted only without a signal peptide),
  SIGNAL, TRANSIT (to the mitochondrion). In order, the first that applies:
  1. through: a covering entry says Single-pass / Multi-pass, or the protein has spans and a covering membrane entry:
     6 'through several times' if an entry says Multi-pass (else Single-pass: 5 'through once') or, with no such words,
     two spans or more. In the mitochondria the layer must be known (the entry's outer or inner membrane, else the
     domains: a matrix domain = inner, cytoplasmic and intermembrane domains = outer), else 1. In the nuclear envelope
     inner / outer / the pore's membrane from the entry or the domains (nuclear = inner).
  2. GPI: an entry's 'Lipid-anchor, GPI-anchor' or a GPI LIPID feature: 4 'far side' (outside the cell, or the lumen).
  3. a side word on a covering entry ('Peripheral membrane protein; Cytoplasmic side' and so on): Cytoplasmic side 3
     'cytosol's side'; Extracellular / Lumenal side 4 'far side'; Matrix side the inner membrane's far side; Intermembrane
     side the gap; Nucleoplasmic side the inner nuclear membrane's near side. Two different sides: 1.
  4. a cytosolic lipid anchor (an entry's 'Lipid-anchor' or such a LIPID feature, no signal peptide): 3 'cytosol's side'.
  5. from the covering entries' own terms: a lumen, matrix or intermembrane space 2 'inside the space'; the nuclear lamina
     the inner membrane's nucleoplasmic side; 'Secreted' at the plasma membrane 7 'secreted'; 'Cell surface' 4 'far
     side'; but a protein without a signal peptide named both outside ('Secreted', 'Cell surface') and at the membrane
     (released without one, as annexins and HSP90 are) 1.
  6. covered, nothing above, the protein's signals decide: a signal peptide and no span 2 'inside' (the ER, Golgi,
     lysosome and endosome lumens are one side) or, at the plasma membrane, 7 'secreted' (4 'far side' if the entry says
     membrane); a transit peptide and a bare 'Mitochondrion' 2 'inside', the matrix; intramembrane stretches and no span
     3 'cytosol's side'; none of these signals 3 'cytosol's side' at the ER, Golgi, lysosomes, endosomes, plasma
     membrane and nuclear envelope (a protein made in the cytosol with no signal to cross a membrane stays on its
     cytosol side: the textbook rule, marked 'r' as our own inference). Otherwise 1 'side not told'.
  Carried (basis 't', used only when asked: PSIDES.judge(i, generous, true)): at a place no entry names, in the ER,
  Golgi, lysosomes, endosomes, plasma membrane or nuclear envelope, what the protein is in any membrane of those ways:
  through (spans), far side (GPI), inside or secreted (a signal peptide, no span), cytosol's side (a cytosolic lipid
  anchor, intramembrane stretches, or no signal at all). Else 0. Basis 'u' where an entry names the place.
  Layers ('-' none or not known): mitochondria o outer membrane, g the gap (intermembrane space), i inner membrane,
  m matrix; nuclear envelope o outer, i inner, p the pore, g the space between its membranes (the ER lumen's).
  Evidence of a class (ev): e experimental (ECO:0000269, ECO:0007744), c curated (by similarity ECO:0000250, curator's
  inference ECO:0000305, author's statement ECO:0000303, imported ECO:0000312, or unstated), p predicted (sequence
  analysis ECO:0000255 and the like), r our rule (step 6, no signal); the best among what decided it.

The spaces a class reaches (SPACES below): 0 cytosol, 1 nucleoplasm, 2 ER lumen (with the nuclear envelope's), 3 Golgi
lumen, 4 mitochondrial matrix, 5 lysosome, 6 endosome, 7 peroxisome, 8 outside the cell, and new: 9 the mitochondria's
intermembrane space. A place's near side faces the cytosol (the nucleoplasm for the inner nuclear membrane, the gap for
the inner mitochondrial membrane), its far side the lumen (outside for the plasma membrane). Inside = the far side's
space; through = both sides. A protein-place of class 0 or 1 keeps today's two readings (strict: the place's own space;
generous: its membrane's other side too); every other place reaches the same spaces in both. Gates as gen_data.py's,
and two more: the cytosol and the matrix to the gap (import through the outer and inner membranes).

Complexes: every complex in 9606.tsv, members from its expanded participant list (subcomplexes expanded), each
accession (isoform and chain suffixes dropped) to its story gene; kept with two story genes or more. Its position, per
reading, from its placed members' spaces: 4 fewer than two placed; 3 cannot meet (no space all reach); else 2 spanning
(a member through a membrane at a place reaching a shared space), 1 on a face (a member on a membrane's side there),
0 inside a space.

--check exits 1 if sides.js is not what this would write.
"""
import csv, gzip, json, os, re, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'sets', 'data.js')
OUT = os.path.join(HERE, '..', 'sets', 'sides.js')
FIELDS = 'accession,gene_primary,gene_names,xref_geneid,ft_transmem,ft_topo_dom,ft_intramem,ft_lipid,ft_signal,ft_transit,cc_subcellular_location'
URLS = {
    'uniprot.tsv.gz': 'https://rest.uniprot.org/uniprotkb/stream?compressed=true&format=tsv&query=(organism_id:9606)+AND+(reviewed:true)&fields=' + FIELDS,
    '9606.tsv': 'http://ftp.ebi.ac.uk/pub/databases/intact/complex/current/complextab/9606.tsv',
    'cp-release.json': 'http://ftp.ebi.ac.uk/pub/databases/intact/complex/current/release-metadata.json',
    'Homo_sapiens.gene_info.gz': 'https://ftp.ncbi.nlm.nih.gov/gene/DATA/GENE_INFO/Mammalia/Homo_sapiens.gene_info.gz',
}
CLASSES = ['not in UniProt', 'side not told', 'inside the space', "on the membrane, the cytosol's side",
           'on the membrane, the far side', 'through the membrane once', 'through the membrane several times', 'secreted']
EVID = {'-': 'none', 'e': 'experimental', 'c': 'curated (by similarity, inference or statement)', 'p': 'predicted (sequence analysis)', 'r': 'our rule: no signal to cross a membrane'}
# spaces as gen_data.py's, and 9 the mitochondria's intermembrane space
INNER = [0, 1, 1, 2, 3, 4, 5, 6, 7, 0, 1, 0, 0]
OUTER = [-1, -1, -1, 0, 0, 0, 0, 0, 0, 8, 0, -1, -1]
GATES = {(0, 1), (0, 2), (0, 4), (0, 7), (2, 3), (3, 8), (3, 5), (6, 5), (8, 6), (0, 9), (9, 4)}
GATES |= {(b, a) for a, b in GATES}
MEMBRANE = [3, 4, 5, 6, 7, 8, 9, 10]
# the membranes as the two spaces they part: ER, Golgi, outer and inner mitochondrial, lysosome, endosome, peroxisome,
# plasma membrane, inner nuclear membrane (the outer one is the ER's)
MEMS = [(0, 2), (0, 3), (0, 9), (9, 4), (0, 5), (0, 6), (0, 7), (0, 8), (1, 2)]
NONCONTACT = (1 << 0) | (1 << 3)


def B(*s):
    m = 0
    for x in s:
        m |= 1 << x
    return m


def SPACES(k, cls, layer):
    """the spaces (bit mask) class cls reaches at membrane place k and layer; 0 for the two unknown classes."""
    if cls <= 1:
        return 0
    if cls == 7:
        assert k == 9
        return B(8)
    if k == 5:
        near, far = {'o': (B(0), B(9)), 'i': (B(9), B(4)), 'g': (0, B(9)), 'm': (0, B(4))}[layer]
    elif k == 10:
        near, far = {'o': (B(0), B(2)), 'i': (B(1), B(2)), 'p': (B(0, 1), B(2)), '-': (B(0, 1), B(2)), 'g': (0, B(2))}[layer]
    else:
        near, far = B(0), B(8 if k == 9 else INNER[k])
    m = far if cls in (2, 4) else near if cls == 3 else (near | far if near and far else 0)
    assert m, (k, cls, layer)
    return m


# UniProt location terms to (place, layer, kind); kind: mem a membrane, lum a lumen or space, out outside, surf the cell
# surface, lam the nuclear lamina, any the organelle itself
def term_places(t):
    out = []
    kind = 'lum' if 'lumen' in t else 'mem' if 'membrane' in t else 'any'
    if t.startswith('Endoplasmic reticulum-Golgi intermediate compartment'):
        return [(3, '-', kind), (4, '-', kind)]
    if t.startswith(('Endoplasmic reticulum', 'Rough endoplasmic reticulum', 'Smooth endoplasmic reticulum', 'Sarcoplasmic reticulum', 'Microsome')):
        return [(3, '-', kind)]
    if t.startswith(('Golgi apparatus', 'Golgi outpost')):
        return [(4, '-', kind)]
    if t.startswith('Mitochondrion'):
        if 'outer membrane' in t: return [(5, 'o', 'mem')]
        if 'intermembrane space' in t: return [(5, 'g', 'lum')]
        if 'inner membrane' in t: return [(5, 'i', 'mem')]
        if 'matrix' in t: return [(5, 'm', 'lum')]
        return [(5, '-', kind)]
    if t.startswith(('Lysosome', 'Autolysosome')):
        return [(6, '-', kind)]
    if re.match(r'(Early |Late |Recycling |Postsynaptic recycling )?[Ee]ndosome', t):
        return [(7, '-', kind)]
    if t.startswith('Peroxisome'):
        return [(8, '-', 'lum' if 'matrix' in t else kind)]
    if t.startswith('Secreted'):
        return [(9, '-', 'out')]
    if t == 'Cell surface':
        return [(9, '-', 'surf')]
    if t.startswith(('Cell membrane', 'Apical cell membrane', 'Basolateral cell membrane', 'Lateral cell membrane', 'Basal cell membrane',
                     'Apicolateral cell membrane', 'Postsynaptic cell membrane', 'Presynaptic cell membrane', 'Synaptic cell membrane',
                     'Postsynaptic density', 'Myelin membrane', 'Cell junction', 'Cell projection', 'Cleavage furrow', 'Cytoplasm, cell cortex')):
        return [(9, '-', kind)]
    if t in ('Membrane raft', 'Membrane, caveola', 'Membrane, clathrin-coated pit', 'Membrane, coated pit'):
        return [(9, '-', 'mem')]
    if t.startswith('Nucleus'):
        if t == 'Nucleus envelope': return [(10, '-', 'any')]
        if t == 'Nucleus membrane': return [(10, '-', 'mem')]
        if t == 'Nucleus inner membrane': return [(10, 'i', 'mem')]
        if t == 'Nucleus outer membrane': return [(10, 'o', 'mem')]
        if t == 'Nucleus, nuclear pore complex': return [(10, 'p', 'any')]
        if t == 'Nucleus lamina': return [(10, 'i', 'lam')]
        if t == 'Nucleus intermembrane space': return [(10, 'g', 'lum')]
    if t == 'Membrane':
        return [(-1, '-', 'gen')]
    return out


def ev_of(text):
    """the best evidence among the ECO codes in a text: e, c, p (c when none is given)."""
    codes = re.findall(r'ECO:(\d+)', text)
    if not codes:
        return 'c'
    if any(c in ('0000269', '0007744') for c in codes):
        return 'e'
    if any(c in ('0000250', '0000305', '0000303', '0000312') for c in codes):
        return 'c'
    return 'p'


def best(*evs):
    for e in 'ecpr':
        if e in evs:
            return e
    return '-'


def split_top(s, sep):
    """splits s on sep outside braces."""
    out, depth, cur = [], 0, ''
    i = 0
    while i < len(s):
        ch = s[i]
        depth += ch == '{'
        depth -= ch == '}'
        if depth == 0 and s.startswith(sep, i):
            out.append(cur)
            cur = ''
            i += len(sep)
            continue
        cur += ch
        i += 1
    out.append(cur)
    return out


def parse_location(cc):
    """UniProt's subcellular location comment as entries: (term, [(topology part, ecos text)], term's ecos text)."""
    entries = []
    for blk in cc.split('SUBCELLULAR LOCATION: ')[1:]:
        blk = re.sub(r'^\[.*?\]:\s*', '', blk.strip())
        blk = blk.split('Note=')[0].strip()
        for ent in split_top(blk + ' ', '. '):
            parts = split_top(ent, ';')
            clean = [(re.sub(r'\{[^}]*\}', '', p).strip(' .'), p) for p in parts]
            if not clean or not clean[0][0]:
                continue
            entries.append((clean[0][0], [(c.lower(), raw) for c, raw in clean[1:]], clean[0][1]))
    return entries


def features(r):
    f = {}
    f['tm'] = len(re.findall(r'TRANSMEM ', r['Transmembrane']))
    f['tmEv'] = ev_of(r['Transmembrane']) if f['tm'] else '-'
    f['intra'] = len(re.findall(r'INTRAMEM ', r['Intramembrane']))
    f['intraEv'] = ev_of(r['Intramembrane']) if f['intra'] else '-'
    f['doms'] = set(re.findall(r'TOPO_DOM [^;]*; /note="([^"]*)"', r['Topological domain']))
    f['signal'] = 'SIGNAL ' in r['Signal peptide']
    f['signalEv'] = ev_of(r['Signal peptide']) if f['signal'] else '-'
    tr = re.findall(r'TRANSIT [^;]*; /note="([^"]*)"(; /evidence="[^"]*")?', r['Transit peptide'])
    f['transit'] = any(n.startswith('Mitochondrion') for n, _ in tr)
    f['transitEv'] = best(*[ev_of(e) for n, e in tr if n.startswith('Mitochondrion')]) if f['transit'] else '-'
    gpi, cyto = [], []
    for note, e in re.findall(r'LIPID [^;]*; /note="([^"]*)"(; /evidence="[^"]*")?', r['Lipidation']):
        if note.startswith('(Microbial'):
            continue
        if note.startswith(('GPI-anchor', 'GPI-like')):
            gpi.append(ev_of(e))
        elif re.match(r'(S-palmitoyl|N-myristoyl|S-farnesyl|S-geranylgeranyl)', note):
            cyto.append(ev_of(e))
    f['gpi'] = best(*gpi) if gpi else ''
    f['cytolipid'] = best(*cyto) if cyto and not f['signal'] else ''
    return f


CARRY = (3, 4, 6, 7, 9, 10)   # (the places of the secretory and endocytic ways and the nuclear envelope)


def carried(f, entries, k):
    """(class, layer, evidence) at a place UniProt does not name, from the protein's own topology alone ('t'): what it
    is in any membrane of the secretory and endocytic ways (spans, a GPI anchor, a signal peptide without a span, a
    cytosolic lipid anchor, intramembrane stretches, or no signal at all: the cytosol's side). Never in the
    mitochondria or peroxisomes (their import needs no signal UniProt shows)."""
    if k not in CARRY:
        return 0, '-', '-'
    words = [p for term, parts, _ in entries if term == 'Membrane' for p, _ in parts]
    if f['tm']:
        cls = 6 if 'multi-pass membrane protein' in words or (f['tm'] >= 2 and not any(w.startswith('single-pass') for w in words)) else 5
        lay = '-'
        if k == 10:
            lay = 'i' if 'Nuclear' in f['doms'] else 'o' if 'Perinuclear space' in f['doms'] and 'Cytoplasmic' in f['doms'] else '-'
        return cls, lay, f['tmEv']
    if f['gpi']:
        return (4, '-', f['gpi']) if k != 10 else (0, '-', '-')
    if f['signal']:
        if f['intra']:
            return 0, '-', '-'
        return (2, '-', f['signalEv']) if k in (3, 4, 6, 7) else (7, '-', f['signalEv']) if k == 9 else (0, '-', '-')
    if f['cytolipid']:
        return 3, '-', f['cytolipid']
    if f['intra']:
        return 3, '-', f['intraEv']
    if not f['transit']:
        return 3, '-', 'r'
    return 0, '-', '-'


def classify(f, entries, k):
    """(class, layer, evidence, basis) of a protein with features f and location entries at membrane place k; basis u
    when UniProt names the place, t when only the protein's own topology says it (carried(), not used by default)."""
    matched = []
    for term, parts, raw in entries:
        for place, layer, kind in term_places(term):
            if place == k:
                matched.append((layer, kind, parts, raw))
    if not matched:
        return carried(f, entries, k) + ('t',)
    return classify_named(f, entries, k, matched) + ('u',)


def classify_named(f, entries, k, matched):
    gen = [(layer, kind, parts, raw) for term, parts, raw in entries for place, layer, kind in term_places(term) if place == -1]
    covering = matched + gen
    layers = {l for l, _, _, _ in matched if l != '-'}
    layer = '-' if not layers else layers.pop() if len(layers) == 1 else 'x'   # (x: two layers named, not told apart)
    doms = f['doms']

    def from_doms():
        if k == 5:
            if 'Mitochondrial matrix' in doms: return 'i'
            if 'Cytoplasmic' in doms and 'Mitochondrial intermembrane' in doms: return 'o'
        if k == 10:
            if 'Nuclear' in doms: return 'i'
            if 'Perinuclear space' in doms and 'Cytoplasmic' in doms: return 'o'
        return '-'
    # 1. through
    multi = [raw for _, _, parts, raw in covering for p, raw in parts if p == 'multi-pass membrane protein']
    single = [raw for _, _, parts, raw in covering for p, raw in parts if p.startswith('single-pass')]
    memlike = any(kind in ('mem', 'any', 'gen') for _, kind, _, _ in covering)
    if multi or single or (f['tm'] and memlike):
        cls = 6 if multi or (not single and f['tm'] >= 2) else 5
        ev = best(*[ev_of(x) for x in multi + single], f['tmEv'])
        lay = layer if layer != '-' else from_doms()
        if k == 5 and lay not in ('o', 'i'):
            return 1, '-', '-'
        if k == 10 and lay == 'x':
            lay = '-'
        if lay in ('x', 'g', 'm'):
            return 1, '-', '-'
        return cls, lay, ev
    # 2. GPI
    gpi = [raw for _, _, parts, raw in covering for p, raw in parts if 'gpi' in p]
    if gpi or (f['gpi'] and memlike):
        if k in (5, 10):
            return 1, '-', '-'
        return 4, '-', best(*[ev_of(x) for x in gpi], f['gpi'] or '-')
    # 3. a side word on a covering entry
    sides = {}
    for lay0, _, parts, _ in matched:
        for p, raw in parts:
            if p.endswith(' side'):
                sides.setdefault(p, []).append(ev_of(raw))
    if sides:
        if len(sides) > 1:
            return 1, '-', '-'
        word, evs = next(iter(sides.items()))
        ev = best(*evs)
        lay = layer
        if word == 'cytoplasmic side':
            if k == 5: return (3, 'o', ev) if lay in ('-', 'o') else (1, '-', '-')
            if k == 10: return 3, ('o' if lay == '-' else lay if lay in ('o', 'i', 'p') else 'o'), ev
            return 3, '-', ev
        if word in ('extracellular side', 'lumenal side'):
            if k == 5: return 1, '-', '-'
            if k == 10: return 4, (lay if lay in ('o', 'i') else '-'), ev
            return 4, '-', ev
        if word == 'matrix side':
            return (4, 'i', ev) if k == 5 and lay in ('-', 'i') else (1, '-', '-')
        if word == 'intermembrane side':
            if k != 5: return 1, '-', '-'
            if lay == 'o': return 4, 'o', ev
            if lay == 'i': return 3, 'i', ev
            return 2, 'g', ev
        if word == 'nucleoplasmic side':
            return (3, 'i', ev) if k == 10 and lay in ('-', 'i') else (1, '-', '-')
        return 1, '-', '-'
    # 4. a cytosolic lipid anchor
    lip = [raw for _, _, parts, raw in covering for p, raw in parts if p == 'lipid-anchor']
    if (lip or f['cytolipid']) and not f['signal']:
        ev = best(*[ev_of(x) for x in lip], f['cytolipid'] or '-')
        if k == 5: return (3, 'o', ev) if layer in ('-', 'o') else (1, '-', '-')
        if k == 8: return 3, '-', ev
        if k == 10: return 3, (layer if layer in ('o', 'i', 'p') else '-'), ev
        return 3, '-', ev
    # 5. the entries' own terms
    kinds = {}
    for lay0, kind, _, raw in matched:
        kinds.setdefault(kind, []).append((lay0, raw))
    if 'lum' in kinds:
        lays = {l for l, _ in kinds['lum']}
        ev = best(*[ev_of(r) for _, r in kinds['lum']])
        if k == 5:
            return (2, lays.pop(), ev) if len(lays) == 1 else (1, '-', '-')
        if k == 10:
            return 2, 'g', ev
        return 2, '-', ev
    if 'lam' in kinds:
        return 3, 'i', best(*[ev_of(r) for _, r in kinds['lam']])
    if ('out' in kinds or 'surf' in kinds) and not f['signal'] and ('mem' in kinds or 'any' in kinds):
        return 1, '-', '-'   # (no signal peptide, named both outside and at the membrane: either face)
    if 'out' in kinds:
        return 7, '-', best(*[ev_of(r) for _, r in kinds['out']])
    if 'surf' in kinds:
        return 4, '-', best(*[ev_of(r) for _, r in kinds['surf']])
    # 6. the protein's signals
    if f['signal'] and not f['tm'] and not f['intra']:
        if k in (3, 4, 6, 7): return 2, '-', f['signalEv']
        if k == 9: return (4 if 'mem' in kinds else 7), '-', f['signalEv']
        return 1, '-', '-'
    if k == 5:
        if f['transit'] and not f['tm'] and set(kinds) == {'any'} and layer == '-':
            return 2, 'm', f['transitEv']
        return 1, '-', '-'
    if k == 8:
        return 1, '-', '-'
    if f['intra'] and not f['tm']:
        return 3, (layer if k == 10 and layer in ('o', 'i', 'p') else '-'), f['intraEv']
    if not f['signal'] and not f['transit'] and not f['tm']:
        return 3, (layer if k == 10 and layer in ('o', 'i', 'p') else '-'), 'r'
    return 1, '-', '-'


def judge(sa, sb):
    if sa & sb:
        return 0
    return 1 if any((x, y) in GATES for x in range(10) if sa >> x & 1 for y in range(10) if sb >> y & 1) else 2


def old_spaces(mask, generous):
    s = 0
    for k in range(13):
        if mask >> k & 1:
            s |= 1 << INNER[k]
            if generous and OUTER[k] >= 0:
                s |= 1 << OUTER[k]
    return s


def fetch(folder):
    os.makedirs(folder, exist_ok=True)
    info = {}
    for name, url in URLS.items():
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; data-fetch)'})
        with urllib.request.urlopen(req, timeout=600) as r, open(os.path.join(folder, name), 'wb') as f:
            f.write(r.read())
            info[name] = {k: r.headers.get(k) for k in ('X-UniProt-Release', 'X-UniProt-Release-Date', 'Last-Modified') if r.headers.get(k)}
    cp = json.load(open(os.path.join(folder, 'cp-release.json')))
    src = {'uniprot': 'UniProtKB/Swiss-Prot release ' + info['uniprot.tsv.gz'].get('X-UniProt-Release', '?') + ' (' + info['uniprot.tsv.gz'].get('X-UniProt-Release-Date', '?') + ')',
           'complexPortal': 'EBI Complex Portal release ' + cp.get('release_identifier', '?') + ', complextab/9606.tsv',
           'ncbiGene': 'NCBI Gene Homo_sapiens.gene_info (' + info['Homo_sapiens.gene_info.gz'].get('Last-Modified', '?') + ')'}
    json.dump(src, open(os.path.join(folder, 'sources.json'), 'w'), indent=1)
    print('fetched into', folder, json.dumps(src))


def main():
    if '--fetch' in sys.argv:
        return fetch([a for a in sys.argv[1:] if not a.startswith('--')][0])
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        sys.exit(__doc__)
    folder, check = args[0], '--check' in sys.argv
    src = open(DATA).read()
    D = json.loads(src[src.index('{'):src.rindex('};') + 1])
    import base64, struct
    sym = D['sym'].split('|')
    N = len(sym)
    pl = struct.unpack('<%dH' % N, base64.b64decode(D['pl']))
    lb = base64.b64decode(D['links'])
    links = [struct.unpack_from('<HHB', lb, 5 * i) for i in range(len(lb) // 5)]
    # gene numbers again from the symbols (NCBI Gene), in increasing order
    cand = {}
    for line in gzip.open(os.path.join(folder, 'Homo_sapiens.gene_info.gz'), 'rt'):
        if line[0] != '#':
            c = line.split('\t')
            cand.setdefault(c[2], []).append(int(c[1]))
    gid, prev = [], 0
    for s in sym:
        v = [int(s[5:])] if s.startswith('Gene ') else sorted(x for x in cand.get(s, []) if x > prev)
        assert v, 'no gene number for ' + s
        gid.append(v[0])
        prev = v[0]
    of_gid = {g: i for i, g in enumerate(gid)}
    # UniProt
    rows = {}
    with gzip.open(os.path.join(folder, 'uniprot.tsv.gz'), 'rt') as f:
        head = f.readline().rstrip('\n').split('\t')
        for line in f:
            r = dict(zip(head, line.rstrip('\n').split('\t')))
            rows[r['Entry']] = r
    by_gene = {}
    for acc, r in rows.items():
        for g in r['GeneID'].split(';'):
            if g.strip() and int(g) in of_gid:
                by_gene.setdefault(of_gid[int(g)], []).append(acc)
    acc_of, how = [''] * N, [0, 0, 0]
    prim = {}
    syn = {}
    for acc, r in rows.items():
        prim.setdefault(r['Gene Names (primary)'], []).append(acc)
        for s in set(r['Gene Names'].split()):
            syn.setdefault(s, []).append(acc)
    for i in range(N):
        c = by_gene.get(i)
        if c:
            c = sorted(c, key=lambda a: (rows[a]['Gene Names (primary)'] != sym[i], -len(rows[a]['Subcellular location [CC]']), a))
            acc_of[i] = c[0]
            how[0] += 1
        elif len(prim.get(sym[i], [])) == 1:
            acc_of[i] = prim[sym[i]][0]
            how[1] += 1
        elif len(syn.get(sym[i], [])) == 1:
            acc_of[i] = syn[sym[i]][0]
            how[2] += 1
    gene_of_acc = {}
    for i, a in enumerate(acc_of):
        if a:
            gene_of_acc.setdefault(a, i)
    for acc, r in rows.items():   # (a story gene's other reviewed entries map to it too, for the complexes)
        for g in r['GeneID'].split(';'):
            if g.strip() and int(g) in of_gid:
                gene_of_acc.setdefault(acc, of_gid[int(g)])
    # the classes: one per location (protein order, then place order, as data.js's communities)
    cls, lay, evs, bys = [], [], [], []
    loc_prot, loc_place = [], []
    feats = {}
    for i in range(N):
        a = acc_of[i]
        if a and a not in feats:
            r = rows[a]
            feats[a] = (features(r), parse_location(r['Subcellular location [CC]']))
        for k in range(13):
            if not pl[i] >> k & 1:
                continue
            loc_prot.append(i)
            loc_place.append(k)
            if k not in MEMBRANE:   # (a space: nothing to judge)
                cls.append('.'); lay.append('-'); evs.append('-'); bys.append('-')
                continue
            c, l, e, by = classify(*feats[a], k) if a else (0, '-', '-', '-')
            if c <= 1:
                l, e, by = '-', '-', ('-' if c == 0 else by)
            SPACES(k, c, l)   # (asserts every known class reaches a space)
            cls.append(str(c)); lay.append(l); evs.append(e); bys.append(by)
    L = len(cls)

    def loc_mask(l, generous, carry=False):
        k, c = loc_place[l], cls[l]
        if c == '.':
            return 1 << INNER[k]
        if c in '01' or (bys[l] == 't' and not carry):
            return 1 << INNER[k] | (1 << OUTER[k] if generous and OUTER[k] >= 0 else 0)
        return SPACES(k, int(c), lay[l])
    MODES = [(c, g) for c in (False, True) for g in (False, True)]
    masks = {m: [0] * N for m in MODES}
    for l in range(L):
        for c, g in MODES:
            masks[(c, g)][loc_prot[l]] |= loc_mask(l, g, c)
    # judgements: old (gen_data.py's) and new, strict and generous; with UniProt's places only, and carried too
    old = {g: [-1] * len(links) for g in (False, True)}
    NEW = {m: [-1] * len(links) for m in MODES}
    for n, (a, b, kd) in enumerate(links):
        if not kd & ~NONCONTACT or not (pl[a] and pl[b]):
            continue
        for g in (False, True):
            old[g][n] = judge(old_spaces(pl[a], g), old_spaces(pl[b], g))
        for m in MODES:
            NEW[m][n] = judge(masks[m][a], masks[m][b])
    carry = '--carry' in sys.argv   # (the report's mode)
    new = {g: NEW[(carry, g)] for g in (False, True)}

    def count(t, idx=None):
        c = [0, 0, 0]
        for n in (range(len(t)) if idx is None else idx):
            if t[n] >= 0:
                c[t[n]] += 1
        return c
    split = {'oldStrict': count(old[False]), 'oldGenerous': count(old[True]),
             'strict': count(NEW[(False, False)]), 'generous': count(NEW[(False, True)]),
             'carryStrict': count(NEW[(True, False)]), 'carryGenerous': count(NEW[(True, True)])}
    assert split['oldStrict'] == D['check']['split']['strict'] and split['oldGenerous'] == D['check']['split']['generous'], split
    # the old span (strict differs from generous) and what became of it
    span = [n for n in range(len(links)) if old[False][n] >= 0 and old[False][n] != old[True][n]]
    settled = [n for n in span if new[False][n] == new[True][n]]
    settled_by = {('carry' if c else 'named'): sum(1 for n in span if NEW[(c, False)][n] == NEW[(c, True)][n]) for c in (False, True)}
    # complexes
    cx, cx_skipped, cx_rows = [], 0, 0
    with open(os.path.join(folder, '9606.tsv'), newline='') as f:
        rd = csv.reader(f, delimiter='\t')
        h = next(rd)
        ci = {n: h.index(n) for n in ['#Complex ac', 'Recommended name', 'Expanded participant list']}
        for row in rd:
            cx_rows += 1
            mem, unm = set(), 0
            for tok in row[ci['Expanded participant list']].split('|'):
                t = tok.split('(')[0]
                if not re.match(r'^[OPQ][0-9][A-Z0-9]{3}[0-9]|^[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}', t):
                    continue   # (small molecules, RNA)
                base = t.split('-')[0]
                if base in gene_of_acc:
                    mem.add(gene_of_acc[base])
                else:
                    unm += 1
            if len(mem) >= 2:
                cx.append([int(row[ci['#Complex ac']][4:]), row[ci['Recommended name']], sorted(mem), unm])
            else:
                cx_skipped += 1
    cx.sort()

    def cx_pos(members, g, carry=False):
        """(kind, site): site a space (0-9) all placed members reach, or 10 + i for membrane MEMS[i] when every member
        reaches one of its sides and one of them spans it; kind 0 inside, 1 on a face, 2 spanning, 3 cannot meet, 4
        fewer than two placed (site -1 for these two)."""
        placed = [p for p in members if pl[p]]
        if len(placed) < 2:
            return 4, -1
        mk = masks[(carry, g)]
        common = (1 << 10) - 1
        for p in placed:
            common &= mk[p]
        if common:
            site = (common & -common).bit_length() - 1
            kind = 0
            for p in placed:
                here = [l for l in range(lofs[p], lofs[p + 1]) if loc_mask(l, g, carry) >> site & 1]
                known = lambda l: cls[l] in '3456' and (carry or bys[l] != 't')
                if all(known(l) for l in here):
                    kind = max(kind, 2 if any(cls[l] in '56' for l in here) else 1)
            return kind, site
        for i, (x, y) in enumerate(MEMS):
            two = 1 << x | 1 << y
            if all(mk[p] & two for p in placed) and any(
                    cls[l] in '56' and (carry or bys[l] != 't') and loc_mask(l, g, carry) & two == two
                    for p in placed for l in range(lofs[p], lofs[p + 1])):
                return 2, 10 + i
        return 3, -1
    lofs = [0] * (N + 1)
    for i in range(N):
        lofs[i + 1] = lofs[i] + bin(pl[i]).count('1')
    CXPOS = {(c, g): [cx_pos(m, g, c) for _, _, m, _ in cx] for c, g in MODES}
    cxpos = {g: CXPOS[(carry, g)] for g in (False, True)}
    pairs = {}
    for _, _, m, _ in cx:
        for x in m:
            for y in m:
                if x < y:
                    pairs[(x, y)] = 1
    cxlinks = [n for n, (a, b, kd) in enumerate(links) if a != b and (min(a, b), max(a, b)) in pairs]
    cxsplit = {}
    for name, t in (('oldStrict', old[False]), ('oldGenerous', old[True]), ('strict', NEW[(False, False)]), ('generous', NEW[(False, True)]),
                    ('carryStrict', NEW[(True, False)]), ('carryGenerous', NEW[(True, True)])):
        c = [0, 0, 0, 0]
        for n in cxlinks:
            c[t[n] if t[n] >= 0 else 3] += 1
        cxsplit[name] = c
    # counts for the test and the story
    per_class = {'named': [0] * 8, 'carried': [0] * 8}
    for c, by in zip(cls, bys):
        if c != '.':
            per_class['carried' if by == 't' else 'named'][int(c)] += 1
    by_ev = {}
    for c, e, by in zip(cls, evs, bys):
        if c not in '.01':
            key = by + e
            by_ev[key] = by_ev.get(key, 0) + 1
    prov = json.load(open(os.path.join(folder, 'sources.json')))
    out_data = {
        'source': prov,
        'classes': CLASSES, 'evidence': EVID,
        'layers': {'-': 'none or not known', 'o': 'outer membrane', 'g': 'the gap between the membranes', 'i': 'inner membrane', 'm': 'matrix', 'p': 'the nuclear pore'},
        'spaces': ['cytosol', 'nucleoplasm', 'ER lumen', 'Golgi lumen', 'mitochondrial matrix', 'lysosome', 'endosome', 'peroxisome', 'outside the cell', 'mitochondrial intermembrane space'],
        'gatesAdded': [[0, 9], [9, 4]],
        # per location (as PDATA's: protein order, then place order): class digit ('.' a place without a membrane),
        # layer letter, evidence letter, basis (u UniProt names the place, t carried from the protein's own topology)
        'cls': ''.join(cls), 'lay': ''.join(lay), 'ev': ''.join(evs), 'by': ''.join(bys),
        # each protein's reviewed UniProt accession ('' none)
        'acc': '|'.join(acc_of),
        # complexes: [Complex Portal number (CPX-n), name, story proteins, members not in the story]
        'cx': cx,
        'check': {'mapped': [sum(1 for a in acc_of if a)] + how, 'perClass': per_class, 'byEvidence': dict(sorted(by_ev.items())),
                  'split': split, 'span': len(span), 'settled': settled_by, 'complexes': len(cx), 'complexRows': cx_rows,
                  'complexPos': {('carry' if c else '') + ('Generous' if g else 'Strict'): [sum(1 for k, _ in CXPOS[(c, g)] if k == j) for j in range(5)] for c, g in MODES},
                  'complexSites': {('carry' if c else '') + ('Generous' if g else 'Strict'): sum((q + 1) * (s + 2) for q, (_, s) in enumerate(CXPOS[(c, g)])) for c, g in MODES},
                  'complexLinks': len(cxlinks), 'complexSplit': cxsplit},
    }
    out = ('// Generated by src/data/gen_sides.py from src/sets/data.js, UniProtKB/Swiss-Prot (CC BY 4.0), the EBI Complex\n'
           '// Portal and NCBI Gene: never edit by hand. Derived classes and memberships only (see the package\'s README.md).\n'
           'const PPI_SIDES = ' + json.dumps(out_data, separators=(',', ':'), ensure_ascii=False) + ';\n'
           "if (typeof module !== 'undefined') module.exports = PPI_SIDES;\n")
    if check:
        same = os.path.exists(OUT) and open(OUT, encoding='utf-8').read() == out
        print('sets/sides.js is current' if same else 'sets/sides.js is out of date: run gen_sides.py')
        sys.exit(0 if same else 1)
    open(OUT, 'w', encoding='utf-8').write(out)
    print(f'wrote sets/sides.js ({len(out.encode()) // 1024} KB)')
    print(json.dumps(out_data['check'], indent=None))
    if '--report' in sys.argv:
        report(locals())


def report(v):
    """the numbers for the spec and the story (--report): verdicts by kind and place, examples, complexes."""
    import collections
    sym, links, old, new, pl, cls, lay, evs = v['sym'], v['links'], v['old'], v['new'], v['pl'], v['cls'], v['lay'], v['evs']
    loc_prot, loc_place, D, cx, cxpos = v['loc_prot'], v['loc_place'], v['D'], v['cx'], v['cxpos']
    P = D['places']
    K = D['kinds']
    tag = lambda n: ('PGX'[new[False][n]] + ('' if new[False][n] == new[True][n] else '/' + 'PGX'[new[True][n]]))
    print('\nby kind (old strict, old generous, new strict, new generous: possible, gate, impossible)')
    for kk in range(7):
        if (1 << kk) & NONCONTACT:
            continue
        row = []
        for t in (old[False], old[True], new[False], new[True]):
            c = [0, 0, 0]
            for n, (a, b, kd) in enumerate(links):
                if kd >> kk & 1 and t[n] >= 0:
                    c[t[n]] += 1
            row.append(c)
        print(f'  {K[kk]:11s}', row, ' impossible %% strict old %.1f new %.1f generous new %.1f' % tuple(100 * r[2] / max(1, sum(r)) for r in (row[0], row[2], row[3])))
    print('by place (links with an end in the place)')
    for k in range(13):
        row = []
        for t in (old[False], old[True], new[False], new[True]):
            c = [0, 0, 0]
            for n, (a, b, kd) in enumerate(links):
                if t[n] >= 0 and (pl[a] >> k & 1 or pl[b] >> k & 1):
                    c[t[n]] += 1
            row.append(c)
        print(f'  {P[k]:22s}', row)
    print('per place, classes 0..7 (protein-places)')
    for k in MEMBRANE:
        c = collections.Counter(cls[l] for l in range(len(cls)) if loc_place[l] == k)
        e = collections.Counter(evs[l] for l in range(len(cls)) if loc_place[l] == k and cls[l] not in '01')
        ly = collections.Counter(lay[l] + cls[l] for l in range(len(cls)) if loc_place[l] == k and lay[l] != '-')
        print(f'  {P[k]:22s}', [c.get(str(j), 0) for j in range(8)], dict(e), dict(ly) if ly else '')
    span = v['span']
    trans = collections.Counter((old[False][n], old[True][n], new[False][n], new[True][n]) for n in span)
    print('old span', len(span), 'settled', len(v['settled']))
    for key, n in trans.most_common(20):
        print('  ', key, n)
    oi = [n for n in range(len(links)) if old[False][n] == 2]
    print('old strict impossible', len(oi), collections.Counter((new[False][n], new[True][n]) for n in oi).most_common())
    worse = [n for n in range(len(links)) if old[False][n] >= 0 and new[False][n] > old[False][n]]
    print('new strict worse than old strict', len(worse), collections.Counter((old[False][n], new[False][n]) for n in worse).most_common())
    worseg = [n for n in range(len(links)) if old[True][n] >= 0 and new[True][n] > old[True][n]]
    print('new generous worse than old generous', len(worseg), collections.Counter((old[True][n], new[True][n]) for n in worseg).most_common())
    newimp = [n for n in range(len(links)) if new[False][n] == 2 and new[True][n] == 2]
    print('impossible in both new readings', len(newimp))
    deg = collections.Counter()
    for a, b, kd in links:
        deg[a] += 1; deg[b] += 1
    ex = sorted(newimp, key=lambda n: -(deg[links[n][0]] + deg[links[n][1]]))[:25]
    print('  e.g.', ', '.join(f'{sym[links[n][0]]}-{sym[links[n][1]]}' for n in ex))
    idx = {s: i for i, s in enumerate(sym)}

    def show(s):
        i = idx.get(s)
        if i is None:
            return s + ' (not in the map)'
        ls = [l for l in range(len(cls)) if loc_prot[l] == i]
        return f'{s} [{v["acc_of"][i]}] ' + '; '.join(f'{P[loc_place[l]]}: ' + ('space' if cls[l] == '.' else CLASSES[int(cls[l])] + ('' if lay[l] == '-' else ' (' + lay[l] + ')') + ('' if evs[l] == '-' else ' ' + evs[l])) for l in ls)
    print('examples')
    for s in EXAMPLES:
        print('  ', show(s))
    for s in [a for a in sys.argv[sys.argv.index('--report') + 1:] if not a.startswith('--')]:
        print('  ', show(s))
    print('verdict changes of the examples (old strict/generous -> new strict/generous)')
    for s in ['GRB2', 'TP53', 'STAT3', 'RELA', 'EGFR', 'ADRB2', 'KRAS', 'HRAS']:
        i = idx[s]
        c = collections.Counter()
        for n, (a, b, kd) in enumerate(links):
            if (a == i or b == i) and old[False][n] >= 0:
                c[('PGX'[old[False][n]] + 'PGX'[old[True][n]], 'PGX'[new[False][n]] + 'PGX'[new[True][n]])] += 1
        print('  ', s, dict(c))
    print('complexes', len(cx), 'sizes', collections.Counter(min(len(m), 10) for _, _, m, _ in cx).most_common())
    names = ['inside', 'on a face', 'spanning', 'cannot meet', 'too few placed']
    for g in (False, True):
        print('  ', 'generous' if g else 'strict', [sum(1 for k, _ in cxpos[g] if k == j) for j in range(5)])
    for j in range(4):
        items = [(c, cxpos[False][q], cxpos[True][q]) for q, c in enumerate(cx) if cxpos[False][q][0] == j]
        items.sort(key=lambda t: -len(t[0][2]))
        print(f' {names[j]} ({len(items)}; generous the same kind: {sum(1 for c, s, g in items if g[0] == j)})')
        for c, s, g in items[:12]:
            sp = s[1] if s[1] < 10 else MEMS[s[1] - 10]
            extra = ''
            if j == 3:
                mk = v['masks'][(v['carry'], False)]
                placed = [m for m in c[2] if pl[m]]
                bestsp = max(range(10), key=lambda x: sum(1 for m in placed if mk[m] >> x & 1))
                outl = [m for m in placed if not mk[m] >> bestsp & 1]
                extra = f' best space {bestsp}: {len(placed) - len(outl)} of {len(placed)}; out: ' + ', '.join(sym[m] + '(' + '+'.join(P[k][:5] for k in range(13) if pl[m] >> k & 1) + ')' for m in outl[:6])
            print(f'    CPX-{c[0]} {c[1]}: {", ".join(sym[m] for m in c[2][:12])}{" ..." if len(c[2]) > 12 else ""} (+{c[3]} not in map) spaces {sp}; generous {names[g[0]]}{extra}')
        if j == 3:
            mk = v['masks'][(v['carry'], False)]
            one = 0
            for c, s, g in items:
                placed = [m for m in c[2] if pl[m]]
                bestsp = max(range(10), key=lambda x: sum(1 for m in placed if mk[m] >> x & 1))
                one += len(placed) - sum(1 for m in placed if mk[m] >> bestsp & 1) == 1
            print(f'   of which one member alone out: {one}; small (2-3 members): {sum(1 for c, _, _ in items if len(c[2]) <= 3)}')
            for c, s, g in [t for t in items if len(t[0][2]) <= 3][:15]:
                print(f'    CPX-{c[0]} {c[1]}: ' + ', '.join(sym[m] + '(' + '+'.join(P[k][:5] for k in range(13) if pl[m] >> k & 1) + ')' for m in c[2]))
    print('links inside complexes', len(v['cxlinks']), v['cxsplit'])


EXAMPLES = ['ADRB2', 'EGFR', 'GRB2', 'TP53', 'STAT3', 'RELA', 'KRAS', 'HRAS', 'CD55', 'CD59', 'ALB', 'INS', 'TOMM20', 'TOMM40', 'CYCS',
            'COX4I1', 'SLC25A4', 'HSPD1', 'CS', 'LMNA', 'LMNB1', 'NUP98', 'CALR', 'HSPA5', 'GOLGA2', 'LAMP1', 'RAB5A', 'PEX14', 'CAT', 'KPNB1', 'TRAF6']

if __name__ == '__main__':   # (imported by gen_lookup.py for its tables and rules)
    main()
