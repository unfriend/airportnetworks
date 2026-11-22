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
- Every number the story shows is computed from these as the page runs (`src/sets/pdata.js`, `PDATA`); the judgement
  (possible, through a gate, impossible) is the story's own method, tried out first in `packages/cellstress`.

## Building it

```
python3 -I packages/ppicell/src/data/gen_data.py <folder with the three files>   # writes src/sets/data.js (--check)
node packages/ppicell/src/data/test-data.mjs                                     # the decoder agrees with the generator
node packages/ppicell/src/build.mjs                                              # writes main.js
node tools/packages/scan.mjs
node tools/packages/check.mjs packages/ppicell --load
```
