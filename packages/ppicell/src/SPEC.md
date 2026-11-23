# Back into the cell (`ppicell`): the spec

A story package (`tools/packages/SPEC.md`): an interactome put back into a cell, and why a spatial interactome that is
true to a real cell is so hard to build. About nine minutes of story, then explore mode. For a biological audience,
kept as simple as possible: short sentences, every term glossed once. British English. Synthetic narration (Kokoro,
`tools/voice/`) once the text is settled. The method was tried out on made-up data in `packages/cellstress` (its
`README.md`, "The method"); this story applies it to real data.

## The data (`PDATA`, `src/sets/pdata.js`)

From `src/data/gen_data.py` (README.md): the interactome of Menche et al. (2015): 13,460 proteins, 141,296 links, each
with its kinds of evidence (regulatory, binary, literature, metabolic, complexes, kinase, signalling); the Human Protein
Atlas's locations on the cell map's 13 places (9,905 proteins have one; 17,935 locations in all), the main ones, and
the Atlas's reliability. Every number shown is computed from `PDATA` at load time, never typed in. Facts worth knowing
(computed now, to be computed again in the page):

- mean 21 links a protein; the biggest hubs GRB2 (871), YWHAZ (501), TP53 (449), YWHAG (442), SRC (440) (a link of a protein with itself, 2,869 of them, counted once);
- 3,555 proteins have no place in the Atlas; 4,189 one place, 3,808 two, 1,908 three or more;
- 6,546 links are not contacts (regulatory or metabolic only); 35,271 have an end without a place;
- of the 99,479 judged: strict reading 81,131 possible, 15,390 through a gate, 2,958 impossible (3.0 %); generous
  reading 88,456, 11,023, 0. Impossible by kind (strict, among the judged contact links): complexes 0.7 %, kinase 2.0 %,
  literature 3.2 %, signalling 3.3 %, binary 5.0 % (regulatory 8.7 % and metabolic 5.5 % only if their non-contact
  links are judged too, as an earlier count did: the story leaves those two kinds out);
- examples: RELA (NF-κB) is listed only in the cytosol (the Atlas photographs resting cells), so its nuclear partners
  are amber; STAT3 cytosol and nucleoplasm; KPNB1 (importin) cytosol, nucleoplasm and nuclear envelope; EGFR Golgi,
  plasma membrane and cytoskeleton; TRAF6 nucleolus and mitochondria (a surprise worth a label); TP53 (449 links)
  cytosol, nucleoplasm and vesicles, one of the best-known proteins: the owner wants it among the examples.

- simplifications of the mapping onto spaces (honest, not hidden): vesicles count with the cytosol (their own lumen is
  not modelled), the cytoskeleton (and the primary cilium and other structures put with it) is in the cytosol, and a
  protein the Atlas puts in the mitochondria is taken to be in the matrix (its membranes and intermembrane space are not
  told apart);
- the Atlas's *Uncertain* locations are kept (489 proteins have that reliability); they matter little: only 182 of the
  2,958 impossible links (strict) have an end whose locations are uncertain.

`src/data/test-data.mjs` checks that `PDATA` agrees with the generator; run it after any change to either.

## The method (as in `packages/cellstress`)

- **Spaces**: cytosol, nucleoplasm, ER lumen, Golgi lumen, mitochondrial matrix, lysosome, endosome, peroxisome,
  outside. Two proteins can bind only where they share one. Each mitochondrion, lysosome, endosome and peroxisome is a
  space of its own.
- **Faces**: the Atlas does not say whether an organelle's protein sits inside it or on its membrane facing the cytosol.
  Two readings, both shown: *strict* (inside only) and *generous* (its membrane's other side too). The difference is a
  finding (chapter 6), not a setting to hide.
- **The judgement** of each contact link from its proteins' places: possible (a shared space), through a gate (one known
  crossing: nuclear pores; import into the ER, mitochondria, peroxisomes; vesicles), impossible. Links that are not
  contacts (regulatory, metabolic only) and links with an end without a place are counted apart and drawn grey when shown.
- **Dots**: a dot is a protein where it meets others: one per listed location; a link inside one of the many small
  organelles is drawn inside one of them; a soluble protein meeting a membrane gets a dot beside it; a long link inside
  a place gives the less connected partner a dot beside the other.
- **Layout**: real data has no module labels, so the generator adds them: communities within each place by label
  propagation over the contact links (plain Python, seeded, so the same every run), written per protein and place into
  `data.js`. In a large place each community gathers round its own spot (as cellstress's modules).
- **What is drawn**: at most about 2,000 links at once, the most important first: `score` = how many kinds of evidence a
  link has, then how many of its proteins' links agree with its place (no made-up scores). At most 2,000 more for a
  pick. Dots: every listed location (17,935) plus the copies the drawn links need; more than 20,000 is fine (the owner,
  22 November 2026: neither the frame rate nor reading suffers), so no dot is dropped.

## The sets (each `src/sets/<name>.js`, the contract of `packages/lbi/src/SPEC.md`)

| Set | What it is | Built from |
| --- | --- | --- |
| `cell` | the cell map's model cell (skins, the 13 places), the dots, the links in their three colours, the pick | `packages/cellstress/src/sets/cell.js`, made to read `PDATA` |
| `ball` | the interactome as a hairball: the same 2,000 links and their proteins on a sphere layout, morphing into the cell (each dot flies to its place; a protein in several places splits into copies on the way) | new |
| `models` | helpers, not a set: the protein models (`src/models.json`, built by `tools/mol/build.py` into `models/`, drawn by the engine's `molMesh` and `molInstanced`: `tools/mol/SPEC.md`); `molPrep` (a set's `prep`: true once its models have come; the first call starts fetching all of them), `molCredit`, `molPts`, `molAxis` | new |
| `crowd` | one dot opening into the crowd it stands for: a 100 nm cube packed about as densely as a real cytoplasm with 3,600 real proteins (ubiquitin, calmodulin, actin, GAPDH, tubulin), each simplified to a few balls (`coarse` in `sets/structs.js`, from `src/data/gen_structs.py`), sizes to scale, none overlapping (packed in slices before the set is built: `SETS.crowd.prep`), jiggling in the shader; every ball a point drawn as a lit sphere with its true depth (one draw, about 42,000 points; the owner, 22 November 2026: the balls look better than simplified surfaces); calmodulin marked | new |
| `walls` | the spaces lit one by one (the cytosol, the nucleus, the ER's and the Golgi's lumens, the mitochondria, the small organelles, outside), membranes as walls; the receptor across the plasma membrane is the beta-2 adrenergic receptor (PDB 2RH1 as a cartoon, its seven helices as ribbons, the bundle along the membrane's normal from UniProt P07550's membrane spans, coloured by those spans in `models.json`: outside, in the membrane, inside); the pore and the import site schematic | new, over `cell` (`FRAME`), `models` |
| `lens` | the methods as lenses over the cell: in a yeast nucleus H-Ras and Raf's Ras-binding domain (PDB 4G0N, two surfaces cut from the entry in its own coordinates) meeting at their crystal contact (two-hybrid); a broken-open cell, the crowd's real proteins (instanced, LOD 2) in their places' colours falling into a tube onto an antibody (PDB 1IGT, a surface, light and heavy chains in two shades) (purification); a bait carrying the biotin ligase BirA (PDB 1BIA, a surface), a halo of tags on the crowd's real proteins (instanced) round it (proximity labelling) | new, `models` |
| `sites` | a hub up close (GRB2, PDB 1GRI, its surface): its three binding domains coloured (the one a partner docks at lit, `setHighlight` on its residue range), its partners taking turns at them as their docking stretches (chains of nine amino acids: a phosphotyrosine stretch at the SH2, proline-rich ones at the SH3s), not all 872 at once; and a shuttle: TP53 (1TSR) to and fro, STAT3 (1BG1) switched on by JAK2's kinase (2B7A), through a pore, onto DNA beside p300's acetyltransferase domain (3BIY), all as surfaces (the STAT3 pair and its DNA three models cut from 1BG1's assembly in its own coordinates, so they line up and move apart); the pores and the envelope schematic | new, `models` |
| `next` | what it would take: the cell refining (a proximity atlas's halos, a cryo-ET slab with its few molecules sharp, a whole-cell volume), ending on the honest cell: dense local networks, thin traffic through gates, a red remainder | new, over `cell` |

## The story (about 540 s)

| # | Chapter | s | Sets | What happens |
| --- | --- | --- | --- | --- |
| 1 | A map without a place | 60 | `ball` | the hairball turns: 13,460 proteins, 141,296 links (about 2,000 drawn: "the best supported of each kind", a share per verdict and place, the rare verdicts raised to at least 100 so they show); the empty cell beside it; "this map says who binds whom, but not where" |
| 2 | Billions and thousands | 55 | `crowd`, `cell` | one dot opens into its crowd; the scale; why one dot per kind and place |
| 3 | Spaces and walls | 65 | `walls`, `cell` | the spaces light up; two proteins must share one; membrane proteins face one side or both; gates |
| 4 | Back into the cell | 75 | `ball` → `cell` | the morph: dots go to their places and split into copies; communities gather; each mitochondrion keeps its own links; the 3,555 without a place stay outside, greyed |
| 5 | Can they meet? | 70 | `cell` | the three kinds shown in turn with their counts (the strict reading) on the cell (tags, not charts); amber bending through the pores; RELA's amber links as the example |
| 6 | Why red? | 80 | `lens`, `cell` | the methods as lenses; the impossible share by kind of evidence as tags on the lenses; the faces: strict and generous side by side (0 % to 3 % impossible from that alone: the generous reading is too generous to rule anything out, the strict one too strict; the truth lies between); the shares by kind are a correlation with the kind of evidence, not proof that a method caused the red; a quarter of the map without a place |
| 7 | Not all at once | 70 | `sites` | GRB2's 871 links against its few sites; TP53 (449 links, in the cytosol and the nucleus) as the second hub and a shuttle; STAT3 through a pore; links as moments |
| 8 | What it would take | 65 | `next` | the way forward; the honest cell; the button to explore |

Each chapter's text is short (the headset's panel cannot scroll: parts take turns). No chart as a chapter (the owner's
rule): numbers stand as tags on the cell, the lenses and the dots they belong to.

## Explore mode

- *Cell* tab: show possible / + through gates / + impossible / + not contacts and unplaced (grey); faces strict or
  generous; kinds of evidence (chips: all, or one kind); organelles on/off; outside/inside.
- *Pick* tab: a protein (click a dot, point and press; or a search box on the page: its symbol), its places, its links in
  their colours, dotted ties between its copies; a place, its links inside it. As cellstress.
- Address: `#ppicell&explore&show=2&faces=strict&kind=binary&p=TP53` (a protein by symbol), `&place=4`.
- Shared state `{ v, tab, show, faces, kind, shells, p, place }` (outcomes only).

## Headset

As the cell map story: the cell on the frame (`GL.rig`), about 0.7 m across, made bigger with both grips to step inside;
the panels as every story's. Frame rate: the dots (about 20k) are one draw, the links two (possible, flagged),
a pick one more, the crowd one instanced draw. Report what only a headset shows (frame rate inside the cell, comfort of
the morph, the crowd's density) as untested until tried there.

## Building it (budget about 2M tokens)

The protein models (once the venv of `tools/mol/README.md` is set up; `--check` says whether they are current):
`~/molenv/bin/python tools/mol/build.py packages/ppicell/src/models.json packages/ppicell/models`, then
`node tools/packages/scan.mjs`. Close-ups are surfaces (the receptor a cartoon), the crowd's five only small levels
(`lods`), every model only the look it uses: about 5 MB in all.


1. Data (done): the generator, `PDATA`, the test. Add the communities (label propagation) to the generator.
2. Builder A (Opus): `cell` from cellstress on `PDATA`, the layout, the judgement with both readings, explore mode and
   the Pick tab (HTML and headset twins), the shared state.
3. Builder B (Opus): `ball` and the morph, `crowd`, `walls`, `lens`, `sites`, `next`, the story (`e3_story.js`: chapters,
   keys, camera, labels).
4. One review (Sonnet), one fix round; then narration (`tools/voice/narrate.mjs` taught to read a package), the
   checks (`check.mjs --load`), screenshots shown as they are taken.

## The owner's first headset notes (22 November 2026), done

114 to 119 fps of 120 Hz in most of the story, 97 at the lenses, 90 in explore mode. The text: no mention of the cell map
story (people may only see this one); the endoplasmic reticulum in full (also the place's name in the data); what the
Human Protein Atlas is, where it first appears (chapter 4); two-hybrid explained (half a switch each, a reporter gene in
yeast); "a moment in time"; baits and proximity maps explained (chapter 8); the publication bias (the owner: why TP53
gets so much attention): at TP53 in chapter 7 (its links from papers, its rank in systematic screens) and in chapter 8
(the literature-only share of the 100 biggest hubs against the whole map: a map of attention); the cytoskeleton runs
everywhere in a real cell, drawn along a few fibres here (the Pick tab says so); Turn off by default in explore mode.

## The owner's second headset notes (22 November 2026), done

113 to 119 fps throughout. "They wait outside the cell for now"; links through a gate drawn at the gate (each protein a dot
just inside and just outside the membrane, a short stitch through it, `gateSite` in `sets/cell.js`) instead of long arcs;
chapter 6 rewritten for lay people and 35 s longer (325 to 440 s; the story 575 s): what a red link means first, then
each method explained in its own part (two-hybrid in yeast, purification and the mass spectrometer, proximity labelling
in living cells), the kinds compared, the two readings, the proteins without a place; "not a permanent wire".

## Open questions

- The Atlas's current licence terms (to confirm; credit in the panel and README either way).
- Whether the story is listed for everyone when done (then the shell lists packages before the tutorial, one line).
- Examples (the owner, 22 November 2026: agreed, and TP53 added): GRB2 the hub, TP53 the famous one (hub and shuttle),
  STAT3 the shuttle, RELA the amber example. TP53 is also the explore mode's first pick in the address examples.

## A paper on the layout method (idea)

- **The idea** (the owner, 23 November 2026): the layout method of this story "has potential, could we formalize this and
  maybe write a paper about it?"
- **The method**: an interactome's proteins are placed into the compartments of a model cell, and each link is judged by
  where its two proteins can meet: possible (a shared space), through a gate (one known crossing) or impossible
  ("The method" above).
- **Needed before a paper**: a formal statement of the method; a check of prior work (ComPPI and other
  localisation-filtered interactomes were named from memory and need a proper literature search); validation against
  proximity-labelling or other spatial proteomics maps; the Human Protein Atlas data's terms.
- **Status**: not started; the owner has not asked for a draft.
