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
| `cell` | the cell map's model cell (skins, the 13 places; each mitochondrion two skins since v205), the dots (a membrane protein's on its side: `drawCode`), the links in their three colours, the pick; since v205 the judgement with sides (`cell_sides`: 0 none, 1 named, 2 carried; each reading and sides judged once) and the complexes (`cell_cxs` the story's examples, `cell_cxp` a picked one, `cell_cxon` every one or a picked protein's, `cell_cxa` their fade: one Points and one LineSegments draw for all) | `packages/cellstress/src/sets/cell.js`, made to read `PDATA` and `PSIDES` |
| `ball` | the interactome as a hairball: the same 2,000 links and their proteins on a sphere layout, morphing into the cell (each dot flies to its place; a protein in several places splits into copies on the way) | new |
| `models` | helpers, not a set: the protein models (`src/models.json`, built by `tools/mol/build.py` into `models/`, drawn by the engine's `molMesh` and `molInstanced`: `tools/mol/SPEC.md`); `molPrep` (a set's `prep`: true once its models have come; the first call starts fetching all of them), `molCredit`, `molPts`, `molAxis` | new |
| `crowd` | one dot opening into the crowd it stands for: a 100 nm cube packed about as densely as a real cytoplasm with 3,600 real proteins (ubiquitin, calmodulin, actin, GAPDH, tubulin), each simplified to a few balls (`coarse` in `sets/structs.js`, from `src/data/gen_structs.py`), sizes to scale, none overlapping (packed in slices before the set is built: `SETS.crowd.prep`), jiggling in the shader; every ball a point drawn as a lit sphere with its true depth (one draw, about 42,000 points; the owner, 22 November 2026: the balls look better than simplified surfaces); calmodulin marked | new |
| `walls` | (v205: beside the receptor, the sides a protein can take, `walls_sides`: calmodulin inside, H-Ras on the cytosol's side, a ball on a stalk on the far side, a rod through once, a ball drifting off outside; at the import site the mitochondrion's four layers lit in turn, `walls_lay`) the spaces lit one by one (the cytosol, the nucleus, the ER's and the Golgi's lumens, the mitochondria, the small organelles, outside), membranes as walls; the receptor across the plasma membrane is the beta-2 adrenergic receptor (PDB 2RH1 as a cartoon, its seven helices as ribbons, the bundle along the membrane's normal from UniProt P07550's membrane spans, coloured by those spans in `models.json`: outside, in the membrane, inside); the pore and the import site schematic | new, over `cell` (`FRAME`), `models` |
| `lens` | the methods as lenses over the cell: in a yeast nucleus H-Ras and Raf's Ras-binding domain (PDB 4G0N, two surfaces cut from the entry in its own coordinates) meeting at their crystal contact (two-hybrid); a broken-open cell, the crowd's real proteins (instanced, LOD 2) in their places' colours falling into a tube onto an antibody (PDB 1IGT, a surface, light and heavy chains in two shades) (purification); a bait carrying the biotin ligase BirA (PDB 1BIA, a surface), a halo of tags on the crowd's real proteins (instanced) round it (proximity labelling) | new, `models` |
| `sites` | a hub up close (GRB2, PDB 1GRI, its surface): its three binding domains coloured (the one a partner docks at lit, `setHighlight` on its residue range), its partners taking turns at them as their docking stretches (chains of nine amino acids: a phosphotyrosine stretch at the SH2, proline-rich ones at the SH3s), not all 872 at once; and a shuttle: TP53 (1TSR) to and fro, STAT3 (1BG1) switched on by JAK2's kinase (2B7A), through a pore, onto DNA beside p300's acetyltransferase domain (3BIY), all as surfaces (the STAT3 pair and its DNA three models cut from 1BG1's assembly in its own coordinates, so they line up and move apart); the pores and the envelope schematic | new, `models` |
| `next` | what it would take: the cell refining (a proximity atlas's halos, a cryo-ET slab with its few molecules sharp, a whole-cell volume), ending on the honest cell: dense local networks, thin traffic through gates, a red remainder | new, over `cell` |

## The story (about 540 s; 716 s of story time since v205, about 15 minutes with the voice)

Since v205 (stage B of "Membrane sides and complexes" below) the chapters are: map 0-60, crowd 60-115, walls 115-223,
back 223-305, judge 305-380, machines 380-442, red 442-581, moments 581-651, next 651-716 (story time); the words are
`src/SCRIPT-sides.md`'s, in `src/engine/e3_story.js`. The table below is the first plan; what v205 changed:

- 3 *Spaces and walls* (108 s): after the receptor, the sides a protein can take (shown beside it) and how we know
  (UniProt; a protein's own build; the no-signal rule, said to have exceptions); after the import site the
  mitochondrion's four layers lit one after another.
- 4 *Back into the cell* (82 s): a line for the membrane proteins settling on their sides.
- 5 *Can they meet?* (75 s): the verdicts with carried sides, the unknown ones strict.
- 6 *Machines* (new, 62 s): the Complex Portal's complexes as rings round their members; inside a space (the
  mitochondrial ribosome's large subunit), on a face (the COPII coat), through a membrane (the nuclear pore, ATP
  synthase); the 26S proteasome listed apart (a part in the nucleoplasm, a part in the cytosol, one gate apart); BiP
  (HSPA5) listed only in the cytosol.
- 7 *Why red?* (139 s): the sides part in three: without sides (inside only, either side), with sides (the unknown
  ones strict, generous; the share they settle), the links worse off with sides.

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
- Address: `#ppicell&explore&show=2&faces=strict&kind=binary&p=TP53` (a protein by symbol), `&place=4`; since v207 the
  *Network* tab's limits (`&links=`, `&support=`, `&rel=`, `&places=`, `&group=off`: "Your own network", stage 1).
- Shared state `{ v, tab, show, faces, kind, shells, p, place }` (outcomes only).
- Since v205: *Sides* (carried, the default; named only; none, the old judgement) and *Unknown sides* (strict or
  generous, the old *Reading*, now for the sides not known); *Complexes* off or on (on: every complex as a ring, or a
  picked protein's). A protein's pick gives each place's side in words (and how it is known) and lists its complexes
  to press; a complex's pick (pressed there, or typed on the page in the *Complex* box) draws it, dims the rest and
  gives its members (to press), its position (inside a space, on a face, through a membrane, listed apart: one gate
  apart or no way to meet) and its links inside it by verdict. Address `&sides=named`, `&cx=on`,
  `&complex=CPX-5993`; shared state `{ v: 3, tab, scene, ctl (with sides and cx), p, place, cx, copies }` (FORMAT
  `networks-57`).

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

## Membrane sides and complexes (planned; the owner, 25 November 2026)

- **The question** (the owner): "can we add complexes, how do we get where proteins and complexes are on a hull
  (inside/outside/or sticking through it/other cases?)". **Decided**: for the whole story (told chapters, numbers and
  explore mode), not as an explore-mode layer only.
- **Where the sides come from**: UniProt (CC BY 4.0): each protein's membrane spans and which side each stretch is on
  (*Transmembrane*, *Topological domain*, *Intramembrane*, *Lipidation*, *Signal peptide*, the subcellular location's
  topology). The story already uses it for one protein (the receptor of chapter 3, P07550). From it each protein in a
  place with a membrane gets a position: soluble inside the space; on the membrane, the cytosol's side; on the membrane,
  the far side; through the membrane once; through it several times; secreted; unknown.
- **Unknown stays honest**: a protein without that annotation keeps today's two readings (strict and generous). The
  finding of chapter 6 changes from "0 % to 3 % from the faces alone" to how much of that span the annotations settle.
- **Mitochondria**: four layers (outer membrane, the gap, inner membrane, matrix) where UniProt tells them apart; today
  all count as the matrix.
- **Complexes**: the EBI Complex Portal's curated human complexes (CC0 / CC BY 4.0: to confirm). A complex's position
  follows from its members' (all inside, all on one face, spanning). Drawn as dots held in one outline that sits inside
  a space, on a face or through the skin. A complex whose members are listed where they cannot meet is a finding, shown
  as such, never hidden.
- **The data**: the interactome's and the Atlas's source files stay outside the repository and are not on a cloud
  machine, so the new step reads `src/sets/data.js` as it stands and adds to it (`src/data/gen_sides.py`: derived
  classes and complex memberships only, no sequences). Its own test is `src/data/test-sides.mjs`.
- **The narration** is rewritten for the chapters it touches (3, 5, 6 and a line for complexes); the voice is synthetic,
  so `node tools/voice/narrate.mjs ppicell` and `check.mjs ppicell` run where Kokoro is (not on a cloud machine): until
  then the recording says the old words.

### Stage A, the data (done, 25 November 2026)

`src/data/gen_sides.py <folder>` (`--fetch <folder>` downloads the inputs, `--check`, `--report [--carry] [symbols]`
prints the numbers below) writes `src/sets/sides.js` (`PPI_SIDES`, 327 KB) from `src/sets/data.js` and three public
files: UniProtKB/Swiss-Prot release 2026_04 (4 November 2026; reviewed human entries, 20,429; the fields named in the
script, no sequences), the EBI Complex Portal's curated human complexes (release 2026-11-20, `complextab/9606.tsv`, 2,533
complexes) and NCBI Gene's human table (25 November 2026: `data.js` keeps symbols, so the gene numbers are found again
from them, in gene number order). `src/sets/psides.js` (`PSIDES`) decodes it over `PDATA` and judges with sides;
`node src/data/test-sides.mjs` recomputes every count below in JavaScript. Not yet in `build.mjs` (stage B).

- **Mapping**: 13,202 of the 13,460 proteins have a reviewed UniProt entry (13,074 by gene number, 126 by symbol, 2 by a
  synonym). 4,010 proteins have a place with a membrane (4,359 such protein-places of the 17,935).
- **The classes** (per protein and place, only the eight places with a membrane): 0 not in UniProt, 1 side not told,
  2 inside the space, 3 on the membrane on the cytosol's side, 4 on its far side, 5 through it once, 6 through it
  several times, 7 secreted (the plasma membrane's outside); a layer (mitochondria: outer membrane, the gap, inner
  membrane, matrix; nuclear envelope: outer, inner, the pore, between its membranes), the evidence and a basis. The
  rules, in order, are the script's docstring: spans (Single-pass, Multi-pass, TRANSMEM features), GPI anchors, a side
  word on the location (*Peripheral membrane protein; Cytoplasmic side* and so on), a cytosolic lipid anchor
  (palmitoyl, myristoyl, farnesyl, geranylgeranyl, without a signal peptide), the location's own term (a lumen, the
  matrix, the gap, *Secreted*, *Cell surface*), then the protein's signals (a signal peptide without a span: inside the
  lumen, or secreted; a transit peptide and a bare *Mitochondrion*: the matrix; no signal at all: the cytosol's side,
  the textbook rule, marked as our inference).
- **Basis**: *named* where a UniProt location names the Atlas's place (no side carried from one organelle to another:
  the owner's brief); *carried* where only the protein's own topology says it (spans, GPI, a signal peptide, lipid
  anchors, or no signal), in the ER, Golgi, lysosomes, endosomes, plasma membrane and nuclear envelope only (never the
  mitochondria or peroxisomes, whose import needs no visible signal). Both are in the file; `PSIDES.judge(i, generous,
  carry)` takes either: **a choice for the owner** (carried settles far more; it rests on one textbook rule).
- **Counts** (protein-places, named; carried in brackets): known 1,994 (+1,862 = 3,856 of 4,359): inside 298 (+140),
  cytosol's side 649 (+1,331), far side 60 (+4), through once 513 (+233), several times 413 (+143), secreted 61 (+11);
  side not told 152; not in UniProt 2,213 named only, 351 with carried. Evidence of the known ones (named): experimental 505,
  curated 673, predicted 374, our no-signal rule 442 (carried: 105, 56, 426, 1,275). By place, named / carried known of
  all: plasma membrane 1,071 / 826 of 1,927; Golgi 239 / 647 of 888; ER 224 / 221 of 446; mitochondria 395 / 0 of 838
  (317 not in UniProt, 126 not told); nuclear envelope 43 / 151 of 209; lysosomes 4 / 13 of 17; endosomes 9 / 4 of 13;
  peroxisomes 9 / 0 of 21.
- **Mitochondria**: matrix 236 (the term or a transit peptide), the gap 17 (CYCS, AIFM1, COX17, NDUFA8), inner
  membrane 99 (spanning 63: SLC25A4, COX4I1, TIMM23; on its gap side 8: CHCHD3, TIMM9/10/13; on its matrix side 28),
  outer membrane 43 (spanning 38: TOMM20, TOMM40, BCL2, MAVS, FIS1; on the cytosol's side 5: TOMM34).
- **New space and gates**: 9, the mitochondria's intermembrane space; gates cytosol to gap and gap to matrix. A class
  reaches: inside or far side the place's lumen (outside for the plasma membrane; the gap or the matrix by layer;
  between the nuclear membranes the ER lumen), cytosol's side the cytosol (the nucleoplasm for the inner nuclear
  membrane, the gap for the inner mitochondrial one; both for the pore), through both. Classes 0 and 1 (and carried
  ones unless asked) keep today's two readings.
- **The verdicts** (99,479 contact links judged; possible, through a gate, impossible): today strict 81,131 / 15,390 /
  2,958, generous 88,456 / 11,023 / 0. With sides, named: strict 82,566 / 15,024 / 1,889, generous 86,225 / 12,583 /
  671. With carried too: strict 83,847 / 14,445 / 1,187, generous 85,792 / 12,821 / 866. Of the 8,736 links whose
  verdict today depends on the reading, the sides settle 4,560 (52 %) named, 6,499 (74 %) carried. Of today's 2,958
  strictly impossible: named 586 now possible in both, 429 gate in both, 573 impossible in both, 1,370 still open;
  carried 1,115, 678, 738, 427 open. The sides also make links worse than today's strict reading (312 named, 300
  carried: a protein on an organelle's cytosol side no longer shares its lumen), and the generous reading loses its 0:
  671 named, 866 carried impossible in both readings (the most connected: GRB2 with secreted APOH and HTRA1; spliceosome
  proteins SF3B1, SF3B3, DHX9 with the inner membrane's carriers SLC25A3, SLC25A5 and HSPD1 in the matrix).
- **By kind** (impossible, strict today, then with sides named strict / generous, carried strict / generous): binary
  5.0 % to 2.5 / 0.8, 1.6 / 1.2; literature 3.2 % to 2.2 / 0.8, 1.4 / 1.0; signalling 3.3 % to 2.3 / 0.5, 1.3 / 1.0;
  kinase 2.0 % to 1.7 / 0.0, 0.2 / 0.0; complexes 0.7 % to 0.6 / 0.4, 0.4 / 0.4. Named, the strict order of the kinds
  stays; carried, kinase falls to last.
- **By place** (impossible links with an end there, today strict, then named strict / generous): Golgi 1,548 to 742 / 44
  (carried 180 / 175), nucleoplasm 1,969 to 1,372 / 588, mitochondria 1,080 to 880 / 493 (carried 800 / 502), cytosol 833
  to 475 / 57, ER 504 to 269 / 77, plasma membrane 412 to 266 / 102 (carried 144 / 140), nuclear envelope 81 to 27 / 2.
- **The examples**: ADRB2 through the plasma membrane seven times (experimental); EGFR through the plasma membrane and
  the Golgi's once; GRB2, TP53, STAT3, RELA and KRAS have no membrane place in the Atlas (their verdicts move only through
  their partners: of GRB2's 59 links open today 9 settle possible and 17 through a gate, and 2 possible today become
  impossible, APOH and HTRA1, both secreted; of RELA's 25, 4 possible and 10 through a gate); SRC and FYN on the plasma membrane's
  cytosol side (lipid anchors); PLAUR, CD48, GPC1 on its far side (GPI); TGFB1, THBS1 secreted; CALR, P4HB, HSP90B1
  inside the ER; GOLGA2 on the Golgi's cytosol side; LMNB1 on the inner nuclear membrane's nucleoplasm side; KPNB1 on the
  nuclear envelope (our rule). The Atlas lists HSPA5 (BiP, the ER's own chaperone) only in the cytosol.
- **Complexes**: 2,126 of the 2,533 have two members or more in the map (930 of two, 487 of three, 309 of four, 400 of
  five or more; 10,900 links of the map fall inside one). Their positions (named, strict; generous in
  brackets): inside a space 1,276 (1,384), on a face 59 (48), spanning 132 (107), cannot meet 272 (200), fewer than two
  placed 387. With carried: 1,243, 96, 157, 243, 387. Inside: the mitochondrial ribosome (matrix), Mediator, RNA
  polymerases, SAGA (nucleoplasm), the exocyst, ESCRT-III (cytosol). On a face: COPI and COPII coats, TRAPP, AP-2, the
  Golgi's GRASP65 with GM130 (cytosol), TIM9-TIM10 (the gap). Spanning: complexes I and IV across the inner membrane
  (gap and matrix), ATP synthase, complex III, TIM23, TOM40, the nuclear pore, oligosaccharyltransferase, gamma-secretase,
  the nicotinic acetylcholine receptor, the T cell receptor. Cannot meet: in 222 of the 272 a single member is out; the
  60S and 40S ribosomal subunits (RPL27 listed in the nucleus, RPL41 and RPS13 in the ER), the 26S and 20S proteasomes
  (most subunits listed in the nucleoplasm, PSMA5, PSMC2 in the cytosol), the spliceosome's stages (SNRPD2 in the
  cytosol), the dystrophin complex, the Na/K ATPase (FXYD2 in the mitochondria). Links inside complexes: today strict
  7,394 / 316 / 25 (3,165 not judged), named 7,375 / 338 / 22, generous 7,476 / 257 / 2.
- **Doubts**: the no-signal rule (442 named, 1,275 carried) is textbook but has exceptions (proteins secreted without a
  signal: UniProt says *Secreted* for some, and those win); a span's both sides are counted even when one side is a few
  amino acids; a protein's sides are taken per place but a link is judged per protein (as today); UniProt's location is
  per protein, not per isoform; *Cell projection*, *Cell junction* and *Cytoplasm, cell cortex* count as the plasma
  membrane; *Endoplasmic reticulum-Golgi intermediate compartment* as both; the Complex Portal licence is to confirm.

## Your own network (planned for after "Membrane sides and complexes"; the owner, 25 November 2026)

- **The idea** (the owner): "make this an interactive app where one can upload their own PPI, select limits etc, live
  control them even". **Decided**: wait until the story's rework above is done, then do it.
- **Stages**: (1) the method in the browser on the built-in data (today `gen_data.py` judges, groups and lays out):
  controls for how many links are drawn, the kinds of evidence, the readings, the Atlas's reliability, the places;
  (2) upload on a page: a list of pairs by gene symbol or UniProt id with an optional score, mapped with lookup tables
  the package ships (human only: the Atlas is human); the data stays in the browser unless shared; (3) live control in a
  room: someone at a laptop changes the limits, headsets see the cell change; a headset takes the network through the
  relay, as studio scenes go.
- **Status**: done: stages 1 and 2 (v207) and 3 (v208), below. Left: trying it on Quests and the owner's relays (each
  needs v208's relay, `relay/README.md`, "Shared networks"); a headset choosing a file of its own (it opens the kept one
  and those on the relay); species other than human.

### Stage 1, the method in the page (done, v207)

- **What runs in the page** (`src/sets/pnet.js`, `PNET`; the cell set builds a network per model and limits,
  `makeNet` in `src/sets/cell.js`): the limits (`PNET.limit`: the same proteins in the same order, links with too
  little support left out, places not counted dropped), the judgement of every link (`PNET.judge`, as before), the
  links drawn (`PNET.select`: v205's selection, moved out of the set), and the communities (`PNET.communities`:
  `gen_data.py`'s label propagation ported to the last tie, its LCG's low 31 bits through `Math.imul`). At every limit's
  default the cell draws the map with the generator's communities, exactly as v205 (the same dots and links, checked
  headless against v206's page by hash); the page's own communities take over as soon as a limit that changes them
  moves.
- **Built in slices**: in explore mode (`cell_live`) every change is a job run 4 ms a frame (`PNET.T`, generators that
  yield once their slice is spent), what was drawn staying until the new drawing is ready (`NET.busy` meanwhile: no
  pick reads the dots being made); the story builds at once, as before. A job rebuilding the network on show finishes
  before the next starts; one making another network is dropped when the wish changes. Up to four networks are kept
  ready (`NETS`), the story's always.
- **The limits** (the *Network* tab, page and headset; the twins `renderNet` and `drawNetPane` in
  `src/engine/e4b_network.js`; `X.lim`, the cell's params `cell_top`, `cell_sup`, `cell_rel`, `cell_pls`, `cell_grp`):
  links drawn 500, 1,000, 2,000 (the default), 4,000, 8,000; the least support (the map: 1 to 4 kinds of evidence:
  141,296, 41,395, 10,590 and 412 links; none has more than five); the Atlas's reliability (`data.js` carries one level
  a protein, for all its places, so a level switched off leaves its proteins without a place: Enhanced 993, Supported
  3,999, Approved 4,424, Uncertain 489 of the 9,905 placed); the places that count (the 13; a protein in none of those
  counted has no place); grouping (communities, or off: the dots spread evenly through their places, each small
  organelle's copy chosen by location). *Reset limits*. The existing switches (Show, Sides, Unknown sides, Complexes,
  Evidence, Organelles, View) stay on the Cell tab and work with them. The Cell tab's counts follow (computed;
  *In this map, within the Network tab's limits* said first when a limit is on); the Network tab says the network,
  its counts and what the limits leave out, and while a job runs what it is doing (with the communities' share done).
- **Address**: `&links=<500 ... 8000>`, `&support=<1 to 4: kinds of evidence>`, `&rel=<letters e s a u: Enhanced,
  Supported, Approved, Uncertain>`, `&places=<place numbers, 0 to 12, with commas>`, `&group=off`, `&tab=net`.
- **Shared state**: `{ v: 4, ..., lim: { top, sup, rel, pls, grp } }` (FORMAT `networks-58`); `apply()` checks each
  limit as the tab's own buttons do (`setLim`).
- **Measured** (headless Chromium, SwiftShader at 1280 x 800, so frames take about 250 ms and a job's 4 ms slices land
  one a frame; the work itself is the CPU's): changing the links drawn, 54 to 78 ms of work for 500 to 8,000 links (130
  at 16,000, 224 at 32,000); the least support to two kinds (limits, the communities found again, judged and drawn)
  194 ms; three kinds 121; grouping off 57; the Atlas's levels 59; the places 39; the sides switch (judged again) 87;
  the communities alone 186 to 290 ms in Node. No frame during a job was slower than the frames before it by more than
  the noise. Draw calls stay 16 whatever the links drawn (one draw for the pale links, one for the flagged). Frame time
  with SwiftShader: 250 ms at 2,000 links, 283 at 8,000, 317 at 16,000, 383 at 32,000; so the top is 8,000. A headset's
  frame rate at 8,000 links is untested.
- **The test**: `node src/data/test-pnet.mjs` (the generator's counts for every reading and sides, v205's drawing for
  seven settings by hash, the communities the generator's for all 17,935 locations and the same in two runs and in
  slices, the limits' counts; and stage 2's reading, mapping and judgement below).

### Stage 2, your own network (done, v207)

- **A page only**: the Network tab's *Your own network* (`OWNN` in `e4b_network.js`): a file (`.tsv`, `.csv`, `.txt`;
  the box or dropped on it) or pasted text, *Use the text*, *Try an example*. A headset's tab says *Choose a network of
  your own on a laptop* and offers the built-in network and, if one was kept in its browser, that one.
- **The format** (`PNET.parse`): one pair a line, two identifiers, then optionally a score (a number) and a kind (a
  word), separated by tabs, commas, semicolons or spaces; `#` lines are comments; a first line whose score is no number,
  or that names no protein at all, is a header; each identifier column is told by what most of its values look like
  (UniProt accessions, with or without an isoform's `-n`; Ensembl gene ids, with or without a version; NCBI gene numbers;
  else gene symbols, any case), and each value tried as what it looks like; a column after the two is a score where most
  of it is numbers, else a kind. A pair given twice (either way round) is one link with its best score and its kinds
  joined; a protein with itself is kept, as the map keeps its own. At most 250,000 pairs and 20 MB (the map is 141,296
  links; the page's own steps scale with the links, so this keeps a chosen network within about twice the map's work),
  said in words. Up to seven kinds (more: the six commonest and *other*), offered by the Evidence switch; every link of
  a chosen network counts as a contact (no regulatory or metabolic kind). Lines with a problem are named by number (one
  identifier only; a score that is no number: the pair kept without it).
- **Mapping** (`PNET.tables`, `find`): the map's own symbols and UniProt accessions (`sides.js`), then the lookup,
  `data/lookup.json` (written by `src/data/gen_lookup.py <atlas folder> <gen_sides.py's folder>`, fetched with
  `HOST.pkgUrl` only when a network is chosen; 1.1 MB, about 410 KB gzipped): the map's 13,460 proteins' NCBI gene
  numbers and Ensembl ids (13,215 have one); the 3,665 genes the Atlas lists that are not in the map (of its 13,658;
  3,577 with a place, 3,508 with a reviewed UniProt entry), each with its symbol, gene number, Ensembl id, accession,
  places and main places on the 13 (`gen_data.py`'s mapping), reliability, the sides of its membrane places
  (`gen_sides.py`'s rules, named and carried) and the complexes of `sides.js` it belongs to (235 complexes gain one);
  and 49,695 other names (NCBI Gene's synonyms, UniProt's gene names) that name exactly one protein and no protein's
  own symbol. 17,125 proteins can be found in all. Without the lookup (offline before it was ever fetched) only the
  map's symbols and accessions are tried, and the report says so.
- **The report**: lines read (comments, a header), the columns as read, pairs kept (and those with a protein not
  found), proteins found (in the map), not found (listed, and *Download the list* as `not-found.txt` made in the page),
  with a place, links that can be judged, the Complex Portal's complexes with two members or more in it; the lines with
  a problem. Errors in words.
- **The cell's network** (`PNET.fromRows`: a `PDATA.make` and `PSIDES.of` model): proteins of the map keep the map's
  places, reliability and sides; the lookup's bring theirs; judged with sides and gates as the map, grouped by the
  page's communities, drawn with every limit, switch and pick; the support steps by score where it has one (any, and
  its median, upper quarter and top tenth where they leave links out, each with its count), else by kinds; complexes
  drawn where two members or more are in it. The panes say *Your network: <name>* and *in your network*; *Back to the
  built-in network*. The story's morph is not needed and not made.
- **Kept only when asked**: *Keep on this device* puts its name and text into this browser's IndexedDB
  (`ppicell-own`, guarded: a private window may refuse); *Open the kept one*, *Forget it*. Never sent anywhere: no
  fetch but the package's own files, nothing in a log, a note's context, the address or `state()` (a developer note
  recorded on purpose in developer mode takes pictures of the screen, as ever: what is on show is in them).
- **In a shared room** it is this device's alone: while it shows its own network, `collabState()` gives the built-in
  network's state as it was (`X.bi`) and `collabApply()` keeps the room's newer state there instead of applying it; going
  back to the built-in network applies that state (limits, picks, switches). The tab says so. Sharing it: stage 3.
- **The example** (`data/example.txt`, `src/data/gen_example.mjs`): GRB2 and its 421 partners with two kinds of
  evidence or more in the map, and the 1,864 links among them with two or more: symbols in the first column, UniProt
  accessions in the second, the number of kinds as a score, the first contact kind as a word.
- **Tests**: `test-pnet.mjs` (the parser: header, comments, separators, duplicates, a self-link, bad lines named, the
  size limit; the mapping with and without the lookup: a gene number, an Ensembl id with a version, an isoform's
  accession, a gene outside the map; eight verdicts checked by hand: GRB2-SOS1 possible, CALR-RELA through a gate,
  APOH-GRB2 impossible, CYCS-SLC25A4 possible, CYCS-RELA and APOH-CALR through a gate, EGFR-GRB2 possible, TP53 with
  itself possible; the example read whole). The headless run (the scratchpad's `flow.mjs`, not in the repository):
  limits at two settings, grouping off, Reset, the example chosen and its report, limits on it, a protein and a complex
  picked in it, the headset's tab drawn, Keep, back to the built-in network with the story's counts, a room's state
  arriving meanwhile kept and applied on the way back, a reload offering the kept one and opening it, Forget it, an
  address with limits; no console errors.

### Stage 3, the room and the relay (done, v208)

- **Live control in a room** (the built-in network): stage 1's limits were already the station's (`lim`). Checked with two
  pages at a station (`tools/collab.mjs --net`): the reliability levels, the places, grouping, the Sides switch, a place
  picked and *Reset limits* on one reach the other's cell and both its panes; while the other builds, its old drawing
  stays (`NET.busy`); no writes while nobody changes anything. Nothing needed fixing.
- **Sharing your network** (the Network tab, `SNET` in `src/engine/e4b_network.js`, both panes): while a network of your
  own is on show and the relay this page knows keeps shared networks (`/api/ping` `nets: true`; `HOST.collab.relayFind`,
  its password as a header, never in an address; a 401 brings up the shell's password prompts through `relaySaw`):
  *Share with this room* (in a relay's room) or *Put on the relay* (outside a room), each with its sentence (where it
  goes: the relay's host; who can read it: everyone at the station, and anyone who can open this relay's rooms or has
  the link, until it is removed) and the size it may have. Without such a relay the button is absent and a line says
  why: *Sharing a network needs a relay* (a peer-to-peer or on-device room; no relay known), *... that keeps them* (a
  relay without scenes or `--nets`, with `--no-nets`, or older than v208), or that it needs its password. *Remove from the
  relay* while a shared one is on show. Only on the press does anything leave the browser, and only the pairs, scores
  and kinds as stage 2 read them.
- **What goes** (`PNET.toDoc`, checked by `PNET.docError` and the relay's `parseNet`): `{ v: 1, name (the file's), prot:
  [the proteins' symbols, the map's or the lookup's, in the network's order], kinds: [its kinds' words, at most 7], a, b:
  [each link's proteins as numbers into prot], k: [each link's kind bits], s: [each link's score or null] only when it
  has scores }`. A symbol the map gives twice (HBD, TEC) is that name's n-th protein by its order. Read back by
  `PNET.fromDoc` (a generator, the same `build` as `fromRows`): the same network to the last link, its order, kinds,
  scores, sides and complexes (`test-pnet.mjs`); a name not found leaves its links out and the tab says how many.
- **The store** (`relay/nets.mjs`; `relay/README.md`, "Shared networks"): a small store of its own beside the scenes'
  and the notes', not a story's copy (`HOST.arrange`'s scenes are the owner's, want the password and a scene name, and
  hold an arrangement of a timeline, not data): `.nets/` in the scenes' folder, `<R2_PREFIX>.nets/` in R2, or `--nets
  <dir>`; off with `--no-nets` and on a public relay without a password (the notes' rule). Kept gzipped (`<id>/net.json.gz`,
  then `<id>/meta.json`), addressed by an id made from the content (the first 60 bits of the SHA-256 of the network as
  kept, its fields in a fixed order, in 12 base-32 letters and digits): the same network is the same id and is never
  written twice, and no other can overwrite it. At most 12 MB as sent and 250,000 links (the page's own limit), 500
  networks; under `--public` 30 a minute from one address (a burst of 60). `POST /api/nets`, `GET /api/nets` (newest
  first: name, proteins, links), `GET /api/nets/<id>`, `POST /api/nets/<id>/delete`; never a name or a protein in a log.
- **The station's state**: `net` (the id; absent for the built-in network) beside `lim`, the switches and the pick: the
  story's own `v` 5, `FORMAT` `networks-59`. Every device at the station fetches it from the relay (*Fetching...*; the
  lookup too when it names proteins outside the map), builds it 4 ms at a time between frames (*Building it (n %)*), and
  shows it; the room's state that came meanwhile (`SNET.pend`) is what `collabState()` gives, so nothing is sent back,
  and it is applied once the network is on show (picks checked against its proteins and complexes, limits against its
  steps). Picks, limits and switches then work across devices as on the built-in network. *Back to the built-in
  network* on any device sets it for all (the station's state: no lock refuses it, as no lock refuses a pick). A device
  that cannot have it (no relay, a relay without the store, the network removed) says so in words (*This room shows a
  shared network this device could not have (why): you see the built-in network, and what you change here is not
  shared*, *Try again*) and keeps the room's state untouched. A device showing a network only its own behaves as stage 2
  built it.
- **Opening one**: `#ppicell&explore&net=<id>` (outside a room too: the relay the page knows). The headset's Network
  tab lists the relay's networks (newest first, by name and size, at most 12) with the built-in one and the kept one;
  the page's tab lists them too (*Networks on <host>*).
- **Measured** (headless Chromium, SwiftShader at 1280 x 800, frames about 240 ms, one relay on this machine; from
  `netOpen` to the network on show, then to the cell's drawing done): the example (1,864 links): 24.7 KB as sent, 7.7 KB
  kept, 0.5 s and 1.7 s; the built-in map as pairs (141,296 links): 1.88 MB, 0.71 MB kept, 4.2 s and 15 s; 250,000
  random links with scores: 5.2 MB, 2.2 MB kept, 7.7 s and 18 s. The longest frame meanwhile was 55 ms (the map) and 48
  ms (250,000) longer than the longest before (reading the JSON and the steps not sliced); the median frame 20 ms
  longer. Hence the limit: 250,000 links (as stage 2) and 12 MB as sent (room for scores at full precision). On a Quest:
  untested (the fetch, the build's seconds and its frames, the memory of a large one).
- **Tests**: `node relay/test.mjs --nets` (the store: off without scenes or `--nets`, `--no-nets`, `--public` without a
  password; put, the same again, the same in another field order, list, get gzipped or not, twelve bad bodies, a body
  over 12 MB, no such network, other methods, remove and put again, the password with Bearer and `?token=`, a restart,
  507 past 500, 429 under `--public`, R2 against the stand-in S3 with the scenes' listing limit); `test-pnet.mjs` (the
  shared form read back the same for the example, a gene outside the map, the hand-picked pairs, scores, a name not
  found, bad forms, the map itself); `node tools/collab.mjs --net` (two pages and a late joiner at a station: the
  built-in network's limits, switch and pick, the example shared and followed, limits and a pick both ways, no echo, the
  headset's tab drawn, back to the built-in network, the address, Remove; and a relay with `--no-nets`).
- **After the review (v209)**: the score pattern was quadratic (`RE.num`; 80,000 digits took 10.7 s): now linear, and a
  line over 4,000 characters, an identifier over 64 or a score or kind over 100 is a bad line by its number before any
  pattern runs (a 1 MB field refused in milliseconds; `test-pnet.mjs`). *Remove from the relay* only in the browser that
  put the network there (`netMine`, per relay origin in `localStorage` `ppicellNetsPut`), its sentence saying that it goes
  for everyone who uses it, other rooms too, and asked once (*Yes, remove it for everyone* / *Keep it*, both panes).
  Every call to the relay gives up (`netFetch`, an `AbortController` and a timer that `dispose()` clears: the ping 10 s,
  a call 20 s plus a second for every 100 kB of its body or of the network fetched, at most 3 minutes; the shell's
  `relayFind` 15 s) with *The relay did not answer* and *Try again*, the busy states cleared on every path. A file chosen
  while another is still read wins (`OWNN.gen`). The relay: the rate token taken before the body (back only for
  `again`), puts one at a time with a cap on the store's total (`--nets-max`, 512 MB), and removals that never leave a
  listed network without its data.

## Sides: the owner's decisions after stage A (25 November 2026)

- **Carried, not named** (the owner: "I would say carried"): the told story judges with a side wherever the protein's own
  build gives one (UniProt's location where it names the Atlas's place; elsewhere its spans, anchors and signal
  peptide, and no signal peptide taken as the cytosol's side). The story says once that this last rule is a textbook
  rule with exceptions. *Named only* stays as a switch in explore mode, and so does the old judgement without sides.
- **The Complex Portal's terms**: not confirmed yet; "we will confirm the terms later" (the owner). Its memberships stay
  in the generated `src/sets/sides.js` on `dev` with credit in the panel and the README; to be confirmed before the
  story moves to `main`.
- **A new chapter** *Machines* (complexes) between *Can they meet?* and *Why red?*; the script is the main
  conversation's (25 November 2026) and is in `src/engine/e3_story.js` once stage B is built.

### Stage B, the story (done, v205, 25 November 2026)

- **In the build**: `sides.js` and `psides.js` after `pdata.js`; the story judges with carried sides, the unknown ones
  strict: 83,847 possible, 14,445 through a gate, 1,187 impossible of 99,479 (generous 85,792 / 12,821 / 866); without
  sides 81,131 / 15,390 / 2,958 and 88,456 / 11,023 / 0; the sides settle 6,499 of the 8,736 links that hung on the
  reading (74 %); 300 links fare worse than without sides (170 possible to a gate, 78 possible and 52 gate to
  impossible). All computed as the page runs.
- **Complexes** (carried, strict): 1,243 inside a space, 96 on a face, 157 through a membrane, 243 listed apart (231 a
  gate apart, 12 no way to meet: `PSIDES.cxGate`, counted in `test-sides.mjs`; 200 with a single member the odd one
  out), 387 with fewer than two placed. The examples hold in the data: the 39S mitochondrial ribosomal subunit (inside,
  the matrix; the script's "the ribosome of the mitochondria"), the COPII coat (on a face, the cytosol), the nuclear
  pore and ATP synthase (through a membrane), the 26S proteasome (listed apart, a gate apart: 19 parts listed in the
  nucleus and the cytosol, 5 only in the nucleus, 5 only in the cytosol), HSPA5 listed only in the cytosol.
- **Drawn**: a complex's placed members as dots of their own on a small disk where it sits (inside: at its best
  connected member's dot, in a mitochondrion or small organelle at its middle; on a face or through: on the membrane
  at a member's own dot, each member off the skin by the side it reaches), one ring round them, its links inside in
  their verdicts' colours; listed apart, a disk per space (the nucleoplasm and cytosol parts facing each other across
  the envelope) and an amber (one gate) or red (no way) tie between. The mitochondria's gap is space 9 (judged, with
  its gates) and drawn between the two skins.
- **The voice**: not made on the cloud machine (no Kokoro); the v204 recording (old words) is kept unserved as
  `src/narration-v204-old.mp3`, and the story runs on subtitles with a table laid out by `narrate.mjs --dry` on
  estimated durations; `node tools/voice/narrate.mjs ppicell` and `check.mjs ppicell` where Kokoro is (README.md).
