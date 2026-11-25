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
  counts are `src/SPEC.md`, "Membrane sides and complexes"). Since v205 the story judges with them (carried sides, the
  owner's choice: UniProt's where it names the place, elsewhere the protein's own build; the unknown ones strict), shows
  the complexes (chapter 6, *Machines*, and explore mode) and credits both in its small print:
  - which side of a membrane each protein sits on, and each protein's reviewed accession: UniProtKB/Swiss-Prot release
    2026_04 (its subcellular locations, membrane spans, topological domains, lipidation, signal and transit peptides),
    licensed CC BY 4.0 (rest.uniprot.org/help/license); credit: The UniProt Consortium, UniProt: the Universal Protein
    Knowledgebase in 2025, Nucleic Acids Research 53, D609-D617 (2025), doi:10.1093/nar/gkae1010 (checked against
    UniProt's own "How to cite us", 25 November 2026).
  - the complexes: the EBI Complex Portal (www.ebi.ac.uk/complexportal), curated human complexes, release 2026-11-20
    (names, Complex Portal accessions and members). **Its terms are to confirm before the story moves to `main`** (the
    owner, 25 November 2026: "we will confirm the terms later"; we believe CC0 or CC BY 4.0, but neither the download
    folder nor the pages we could fetch state it); credit: B. H. M. Meldal et al., Complex Portal 2022: new curation
    frontiers, Nucleic Acids Research 50, D578-D586 (2022), doi:10.1093/nar/gkab991 (checked against Europe PMC's
    record; the Complex Portal's own pages are a script we could not read, so whether it asks for this paper or a
    newer one is still to check).
  - the gene numbers again from the symbols: NCBI Gene (public domain).
- The crowd (chapter 2): real proteins each simplified to a few balls, from `src/data/gen_structs.py <folder>` (writes
  `src/sets/structs.js`; the PDB, public domain), drawn as sphere impostors.
- Shapes: the proteins drawn (GRB2, TP53, STAT3, the lenses', the receptor, JAK2, p300) are entries of the
  Protein Data Bank (public domain, CC0), each cited in the story's small print (`credit` in `src/models.json`). They are
  made into models (molecular surfaces with baked shading; the receptor a cartoon of its chain) by the app's
  `tools/mol/build.py` from the entries listed in `src/models.json`, into `models/` (one `.mol` file each and
  `index.json`): `~/molenv/bin/python tools/mol/build.py packages/ppicell/src/models.json packages/ppicell/models`
  (it downloads any entry it lacks from files.rcsb.org; `--check`; the setup is `tools/mol/README.md`).
- Simplifications: vesicles count with the cytosol, the cytoskeleton (with the primary cilium) is in the cytosol. The
  mitochondria are judged in four layers where UniProt tells them apart (outer membrane, the gap, inner membrane,
  matrix; the gap is a space of its own) and drawn with two skins, the gap between; a mitochondrial protein whose layer
  is not known is taken to be in the matrix. A complex is drawn as its members gathered on a small disk in a ring, not
  where each member's own dot is. The Atlas's *Uncertain* locations are kept: only 182 of the 2,958 impossible links
  (strict reading, without sides) have an uncertain end.
- Your own network (v207, the *Network* tab in explore mode; `src/SPEC.md`, "Your own network"): the method's limits
  run live in the page (`src/sets/pnet.js`), and a network chosen on a page (pairs of identifiers, an optional score and
  kind) is mapped onto the map's proteins and those of the lookup, `data/lookup.json`, which the page fetches only when
  a network is chosen. The lookup is written by `src/data/gen_lookup.py` from `src/sets/data.js`, `src/sets/sides.js`,
  gen_sides.py's three files and the Human Protein Atlas's `subcellular_location.tsv.zip`
  (https://www.proteinatlas.org/download/tsv/subcellular_location.tsv.zip, fetched 25 November 2026: 13,658 genes):
  derived identifiers and classes only (the map's proteins' NCBI gene numbers and Ensembl ids; the 3,665 genes the
  Atlas lists outside the map with their symbols, gene numbers, Ensembl ids, reviewed UniProt accessions, places on the
  13 and reliability, the sides of their membrane places by gen_sides.py's rules, and their Complex Portal complexes;
  other names that name exactly one protein). This is a second use of the Atlas's data, so its terms (above: **to
  confirm**) cover the lookup too, with the same credit; UniProt (CC BY 4.0), the Complex Portal (to confirm) and NCBI
  Gene (public domain) as above. A chosen network never leaves the browser unless its owner presses *Share with this
  room* or *Put on the relay* (v208, `src/SPEC.md`, "Stage 3"): then its pairs, scores and kinds as read (the proteins'
  symbols, the links, the kinds' words, the file's name) are kept on that relay (`relay/nets.mjs`) under an id made from
  them, readable by anyone who can open that relay's rooms, until removed; a station's state names it (`net`) and every
  device there fetches and builds it. It is kept in the browser (IndexedDB) only when asked.
  The example, `data/example.txt`, is cut from the map itself by `src/data/gen_example.mjs` (GRB2 and its partners).
- Every number the story shows is computed from these as the page runs (`src/sets/pdata.js`, `PDATA`); the judgement
  (possible, through a gate, impossible) is the story's own method, tried out first in `packages/cellstress`.

## The voice (v210)

The words changed in v205 (sides and complexes: `src/SCRIPT-sides.md`); the synthetic voice (Kokoro, `tools/voice/`) was
set up on the cloud machine at v210 and made the recording: `audio/narration.mp3` (15:08), with the real
`NARRATION_SYNC` and `NARRATION_ENDS` in `src/engine/e3_story.js`. Nobody has heard it yet. `tools/voice/say.json`
(`stories.ppicell`) respells `RELA` (*Rel Eigh*, so the A is a letter and not the article), `A T P` and `D N A` (read
as letters). The v204 recording (the old words) is kept as `src/narration-v204-old.mp3` (not in the package's index;
delete it once the new one is liked). To make it again after a change of words (cached lines are reused):

```
node tools/voice/narrate.mjs ppicell --lines    # what will be read (check A T P, E R, N F kappa B, proteasome)
node tools/voice/narrate.mjs ppicell            # writes audio/narration.mp3, NARRATION_SYNC and NARRATION_ENDS in
                                                # src/engine/e3_story.js, rebuilds main.js and the index
node tools/voice/check.mjs ppicell              # the story against its recording
```

Then `len` in `story.json`, the times in `docs/narration-timings.txt`, `VERSION` in `sw.js` and `node tools/release.mjs`.

## Export for wwiznet (v211)

The network on show as a dataset for wwiznet (asdf10k), the Menche lab's 3D network explorer
(github.com/menchelab/wwiznet_dist): the Network tab's *Export for wwiznet (ZIP)* in the page, or from the command line
(the mapping, the defaults and why: `src/SPEC.md`, "Export for wwiznet"):

```
node packages/ppicell/src/export-wwiznet.mjs <deployment>/data/ppicell            # the built-in map as the story shows it
node packages/ppicell/src/export-wwiznet.mjs <out> --copies main --edges all       # a node per protein, every link
node packages/ppicell/src/export-wwiznet.mjs <out> --net my-pairs.tsv --sides named --faces generous --links 8000
node packages/ppicell/src/data/test-wiz.mjs                                         # the files follow wwiznet's guide
```

Options: `--links 500|1000|2000|4000|8000`, `--support 1..4`, `--rel esau`, `--places 0,1,..,12`, `--group on|off` (the
address's keys), `--sides carried|named|none`, `--faces strict|generous`, `--show possible|gates|impossible|all` (what
counts as drawn), `--edges judged|all|drawn`, `--copies all|main`, `--net <pairs file>`, `--key`, `--label`. Then
`python3 server.py` in the deployment and `/?dataset=ppicell`. The export is the interactome and the Atlas's places in
another form, so it carries their terms and credit (above; `data_description.txt` and the guide window say them) and
never goes into this repository.

The other way round, a wwiznet dataset opens as a network of your own: on the Network tab choose or drop its
`edges.tsv` (with its `nodes.tsv`, or its folder), or `--net <folder or edges.tsv>` here. Only each edge's two ends,
one score column, one kind column and the node column naming the protein are read; every other column (wwiznet node
tables can carry variants and diseases) is skipped and never kept, shown or sent (`src/SPEC.md`, "wwiznet's files as
your own network").

Gene-set terms with `menchelab/enrichr` (outside the app; it reads `id` as the gene name): take a `--copies main` export
(ids are the symbols) and run `python3 enrichr.py --input <out>/nodes.tsv --output <out>/nodes.tsv`. For the per-place
export (ids `TP53@nucleoplasm`), swap the symbols in and back (enrichr keeps the rows' order):

```
python3 -c "import pandas as p,sys; n=p.read_csv(sys.argv[1],sep='\t',dtype=str,keep_default_na=False); n.assign(id=n['name']).to_csv(sys.argv[2],sep='\t',index=False)" <out>/nodes.tsv genes.tsv
python3 enrichr.py --input genes.tsv --output genes-annotated.tsv
python3 -c "import pandas as p,sys; a=p.read_csv(sys.argv[2],sep='\t',dtype=str,keep_default_na=False); a['id']=p.read_csv(sys.argv[1],sep='\t',dtype=str,keep_default_na=False)['id']; a.to_csv(sys.argv[1],sep='\t',index=False)" <out>/nodes.tsv genes-annotated.tsv
```

The terms come with their own sources' terms (the Enrichr libraries: GO and Reactome CC BY 4.0, HPO's own licence,
Orphanet CC BY 4.0, KEGG restricts redistribution: as far as we know, not stated in the library files); keep annotated
files out of this repository.

## Building it

```
python3 -I packages/ppicell/src/data/gen_data.py <folder with the three files>   # writes src/sets/data.js (--check)
~/molenv/bin/python tools/mol/build.py packages/ppicell/src/models.json packages/ppicell/models   # the protein models (--check)
node packages/ppicell/src/data/test-data.mjs                                     # the decoder agrees with the generator
python3 -I packages/ppicell/src/data/gen_sides.py --fetch <folder>               # downloads UniProt, the Complex Portal, NCBI Gene
python3 -I packages/ppicell/src/data/gen_sides.py <folder>                       # writes src/sets/sides.js (--check)
node packages/ppicell/src/data/test-sides.mjs                                    # PSIDES agrees with gen_sides.py
python3 -I packages/ppicell/src/data/gen_lookup.py <atlas folder> <folder>       # writes data/lookup.json (--check)
node packages/ppicell/src/data/gen_example.mjs                                   # writes data/example.txt (--check)
node packages/ppicell/src/data/test-pnet.mjs                                     # the method in the page: the generator's
                                                                                 # counts, v205's drawing, the communities,
                                                                                 # the limits, reading and mapping a network
node packages/ppicell/src/data/test-wiz.mjs                                      # the export for wwiznet
node packages/ppicell/src/build.mjs                                              # writes main.js
node tools/packages/scan.mjs
node tools/packages/check.mjs packages/ppicell --load
```
