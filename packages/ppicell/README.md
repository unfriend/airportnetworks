# Back into the cell (a story package, in development)

An interactome put back into a cell: the 13,460 proteins and 141,296 links of Menche et al. (2015), each protein placed
where the Human Protein Atlas finds it in the cell map's model cell, and each link judged by whether its two proteins
can meet there. Why a spatial interactome that is true to a real cell is so hard to build. Hidden while it is made
(`#ppicell`, or developer mode's Stories screen); the plan is `src/SPEC.md`.

- Made by: the app's authors, with the interactome of Jörg Menche and colleagues.
- Data (derived numbers only, in `src/sets/data.js`, written by `src/data/gen_data.py` from files kept out of the
  repository):
  - the interactome: J. Menche, A. Sharma, M. Kitsak, S. D. Ghiassian, M. Vidal, J. Loscalzo, A.-L. Barabási,
    Uncovering disease-disease relationships through the incomplete interactome, Science 347, 1257601 (2015), Data S1:
    its gene numbers, links and seven kinds of evidence. Used with Jörg Menche's permission.
  - the places: the Human Protein Atlas's subcellular locations (proteinatlas.org), its 49 locations put onto the cell
    map's 13 places (`LOC` in the generator; the sperm cell's own locations left out). The Atlas's data come under its
    licence (as far as we know CC BY-SA: the places in `src/sets/data.js` then carry it; to confirm), with credit to
    the Human Protein Atlas.
  - the gene numbers to symbols and Ensembl ids: NCBI Gene (public domain).
- Membrane sides and complexes (derived classes and memberships only, in `src/sets/sides.js`, written by
  `src/data/gen_sides.py` from `src/sets/data.js` and three public files; decoded by `src/sets/psides.js`; the rules and
  counts are `src/SPEC.md`, "Membrane sides and complexes"):
  - which side of a membrane each protein sits on, and each protein's reviewed accession: UniProtKB/Swiss-Prot release
    2026_04 (its subcellular locations, membrane spans, topological domains, lipidation, signal and transit peptides),
    licensed CC BY 4.0 (rest.uniprot.org/help/license); credit: The UniProt Consortium, UniProt: the Universal Protein
    Knowledgebase in 2025, Nucleic Acids Research 53, D609 (2025).
  - the complexes: the EBI Complex Portal (www.ebi.ac.uk/complexportal), curated human complexes, release 2026-11-20
    (names, Complex Portal accessions and members). Its licence is to confirm (we believe CC0 or CC BY 4.0; neither
    the download folder nor the pages we could fetch state it); credit: Meldal et al., Complex Portal 2022: new
    curation frontiers, Nucleic Acids Research 50, D578 (2022).
  - the gene numbers again from the symbols: NCBI Gene (public domain).
- The crowd (chapter 2): real proteins each simplified to a few balls, from `src/data/gen_structs.py <folder>` (writes
  `src/sets/structs.js`; the PDB, public domain), drawn as sphere impostors.
- Shapes: the proteins drawn (GRB2, TP53, STAT3, the lenses', the receptor, JAK2, p300) are entries of the
  Protein Data Bank (public domain, CC0), each cited in the story's small print (`credit` in `src/models.json`). They are
  made into models (molecular surfaces with baked shading; the receptor a cartoon of its chain) by the app's
  `tools/mol/build.py` from the entries listed in `src/models.json`, into `models/` (one `.mol` file each and
  `index.json`): `~/molenv/bin/python tools/mol/build.py packages/ppicell/src/models.json packages/ppicell/models`
  (it downloads any entry it lacks from files.rcsb.org; `--check`; the setup is `tools/mol/README.md`).
- Simplifications: vesicles count with the cytosol, the cytoskeleton (with the primary cilium) is in the cytosol, and the
  mitochondria are taken as their matrix. The Atlas's *Uncertain* locations are kept: only 182 of the 2,958 impossible
  links (strict reading) have an uncertain end.
- Every number the story shows is computed from these as the page runs (`src/sets/pdata.js`, `PDATA`); the judgement
  (possible, through a gate, impossible) is the story's own method, tried out first in `packages/cellstress`.

## Building it

```
python3 -I packages/ppicell/src/data/gen_data.py <folder with the three files>   # writes src/sets/data.js (--check)
~/molenv/bin/python tools/mol/build.py packages/ppicell/src/models.json packages/ppicell/models   # the protein models (--check)
node packages/ppicell/src/data/test-data.mjs                                     # the decoder agrees with the generator
python3 -I packages/ppicell/src/data/gen_sides.py --fetch <folder>               # downloads UniProt, the Complex Portal, NCBI Gene
python3 -I packages/ppicell/src/data/gen_sides.py <folder>                       # writes src/sets/sides.js (--check)
node packages/ppicell/src/data/test-sides.mjs                                    # PSIDES agrees with gen_sides.py
node packages/ppicell/src/build.mjs                                              # writes main.js
node tools/packages/scan.mjs
node tools/packages/check.mjs packages/ppicell --load
```
