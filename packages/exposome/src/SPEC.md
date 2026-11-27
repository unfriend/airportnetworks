# Invisible threads (the exposome story): the contract

> This is the builder's brief from when the story was made, so it is written in the future tense ("we are adding...", "copy ... and rename").
> It is not how the story is now: the `README.md` beside it (where there is one), the package's `README.md` and
> `docs/agents/stories.md` say that, and where they differ from this file they are right.

Key `exposome`, a story package (`packages/exposome/`, `#exposome`), title *Invisible threads*, kick *Chemical exposome*.
On the Experiments set (`story.json` `"list": "experiments"`, in `packages/order.json` after cdk5; integrated 25 November
2026). The script is `src/SCRIPT.md` (the main conversation's): chapters, keys, order and
words are kept; this file says what the data gives, what each scene shows and who builds what.

Builders A (this file, the data, the skeleton), B and C (the sets) are done, and one review's fixes are in (section 11).
Everything here is binding unless it says *suggested*.

## Contents

1. The data (generator, files, sizes, `XDATA`)
2. Numbers: the script's brackets against the data
3. Findings that change the script
4. Chapters: times, lines and the scene track
5. The sets and their interfaces
6. Who owns what
7. Explore mode
8. Headset, shared rooms, sound
9. Reuse: the model cell and the globe
10. Checks, sizes, integration
11. After the review

## 1. The data

**Source**: the authors' deposit, Zenodo record 18793297 (v5, 2026-02-26; one zip, `Exposurome_withfiles/`; CC BY 4.0),
read by `src/data/gen_data.py <deposit folder> <cell.json>` (Python 3.10+, numpy, pandas, openpyxl:
`src/data/requirements.txt`; the pickles through a restricted unpickler; nothing from the deposit is run). `cell.json`
comes from `node src/data/gen_cell.mjs` (Back into the cell's model cell run in Node, see 9). Outputs (generated, never
edited by hand; derived numbers only):

| File | Size | Loaded | Holds |
| --- | --- | --- | --- |
| `src/sets/data.js` (`EXPO_DATA`) | 961 KB | embedded in `main.js` | counts, substances (labels, two layouts, families, communities, pattern, hazard, counts), communities (ids, sizes, parents, colours, labels, terms), 45,000 drawn links, countries, the story's examples |
| `data/targets.bin` | 1.47 MB | on demand | every substance's genes: all 573,673 pairs (CSR), 25,579 gene symbols, each gene's number of substances and its interactome protein |
| `data/ppi.bin` | 0.53 MB | on demand | the interactome: 18,815 proteins (best connected first), degree, place in the model cell, two arrangements (in the cell; sorted), 30,000 drawn contacts (the true count 482,935 in its header) |
| `data/diseases.bin` | 1.69 MB | on demand | 6,177 diseases (names, genes as interactome proteins, number of significantly close substances), the 176,259 close pairs (z < -5) with z and PubMed co-citations, by substance then z |
| `data/names.json` | 0.20 MB | on demand | every substance's CTD id, and its full name where the label shortens it |
| `src/data/terms.json` | | generator only | each community's top enriched terms (FDR) and a sample of members: what `labels.json` is written from |
| `src/data/labels.json` | | hand-written | plain words for 21 top, 18 middle and 1 fine community; read by the generator |

Embedded 961 KB (target under 1.5 MB); on demand 3.88 MB together (target under 4 MB). `main.js` is 1.18 MB with stubs.

**Substances** are numbered `0 .. N-1` (N = 9,887, every substance with a human gene in CTD): the network's NN = 9,764
nodes first in the authors' VR order (row i of `output/VR/Exposurome_properties.csv` and of their layout files), then
the 123 substances that have genes but no link (no layout, no community). Labels: the CTD name; a drug combination's
words shortened ("drospirenone and ethinyl estradiol"); longer than 34 characters cut at a word with "…" (1,339 of
them, mostly IUPAC names). Never a CTD synonym (often brand names). The full name is in `names.json`.

**Layouts** (all in `[-1, 1]`, y up):
- `XDATA.pos` (3·NN): the authors' own 3D layout of the network (`Exposuromepos3d_louvain.csv`, centred and scaled by
  its largest extent, proportions kept). Never laid out again in the app.
- `XDATA.shelf` (3·N): ours, chapter 1's "by chemistry": one horizontal ring per chemical family, its own height
  (`y` from -0.75 at the largest family's ring to 0.75), radius 0.92 to 1.0, rows of at most 900 points (0.03 apart);
  each substance on the ring of the *rarest* of its families (`XDATA.prim`, so a small family keeps its members).
  Order of rings: `XDATA.meta.shelves` (family indices, largest first). Deterministic (a hash of the id).
- `XDATA.ppi.cell` (3·P, P = 18,815): where *Back into the cell* draws each protein (its main place's dot; 13,190 of
  the 18,815 are in that story's interactome, 9,790 with a place); a protein that story has without a place stands
  where it puts it, outside; a protein not in that story stands on a shell of its own just outside the membrane
  (radius 1.18, a golden spiral). `XDATA.ppi.place[p]`: 0-12 the cell's places (`XDATA.ppi.places`), 13 in that story
  without a place, 14 not in that story.
- `XDATA.ppi.sorted` (3·P): ours, chapter 5's sorting: each protein in its direction from the cell's centre (from its
  `cell` position), at radius `0.1 + 0.9 (1 - ln deg / ln maxdeg)^0.8` (±3 %): the best connected in the middle,
  loners at the rim. Say "our drawing" where it matters; it is not the authors'.

**Colours**: chemical families ours (`LOOK.family`, `src/sets/look.js`: twelve clearly different colours, the eight
largest families from the Okabe-Ito set; the authors' Source Data Fig1A colours, `XDATA.classes.col`, gave the three
largest families three light blues, so "mixed right through" did not show), used on the shelves, in chapter threads and
in the Substances tab; communities the authors' VR colours (`XDATA.comm.col`; the VR file colours every node by its
top-level community, 16 colours reused); the rest `LOOK`.

**Communities (Louvain)**: the authors' dendrogram (`Exp_fin_4_Louvain_Clustering`, resolution 0.9) has three levels:
**125 top, 152 middle, 456 fine** communities (the paper's "125/152/456"); the generator renames them exactly as the
notebook does (tops numbered by size `1..125`; a level that does not split keeps its parent's name; else `_1, _2` by
size), and checks that its fine level equals the deposit's `weighted_ji_fine_grained_communities_dict.pickle`. The
deposit's **13 broad / 50 middle** are the subsets of those that split further (their enrichment is filed under them);
the four largest top groups (1,463, 1,439, 1,202 and 974 substances) are not among the 13. So the story speaks of the
**20 top groups of 50 or more** (95.8 % of the network's substances); the rest are 105 small ones (46 down to 1).
Labels: plain words where the terms support them (`labels.json`), else `XDATA.comm.words(k)` falls back to the top
term (technical; explore only).

**Diseases and proximity** (`Exp_fin_10_Diseases`): disease gene sets are DisGeNET's with score > 0.4, genes in the
interactome (6,177 diseases, 11,922 pairs). The authors measured all 9,852 × 6,177 = **60,855,804** substance-disease
pairs (closest distance, z against random sets of the same sizes). **1,601,884** = the pairs with FDR < 0.05 (a
one-sided p from z, Benjamini-Hochberg): "significantly close" (per substance `XDATA.near`, per disease
`dis.near(d)`). **176,259** = the pairs with z < -5 ("a reasonable number for p = 0.05 corrected", their words; the
"real significant" pickle and `exp_dis_cit_df.tsv`, with co-citation counts): shipped pair by pair in `diseases.bin`.
**28,403** = pairs found by shared genes alone (hypergeometric + FDR).

**Countries**: 32 countries (EEA E-PRTR releases 2007-2020); each one's substances far above the European level, to
air (`air`, the authors' `air_country_selected_chem_id_dict`) and to water (`water`, `country_selected_chem_id_water_dict`)
as substance indices; `risk` for the 27 with a score (`Country_risk.tsv`: substances, close diseases, average max
degree, the score as a share of the total); `pa`, `pw`: Source Data Fig4E (air) and Fig4F (water), each country's mean
incidence z of close and of distant diseases and the one-sided Mann-Whitney p (recomputed; close more frequent when
p < 0.05 and the mean is higher). `lat`, `lon`: approximate centres (ours, in the generator). Endrin in Italy: Source
Data Fig4G (GBD incidence, normalised, 20 years each; the ratio of the means), for the seven cancers the authors
plotted: `XDATA.ex.endrinItaly.gbd[cause] = [Italy / global, Italy / western Europe]`. No other GBD number is shipped.

### `XDATA` (src/sets/xdata.js): the accessor

Everything a set or a pane reads goes through it. It is a plain constant inside the story's closure and a module in Node
(`src/test-data.mjs`).

```
XDATA.meta                       counts (below), classes, levels (bigMin 50), pattern, hazard, ppi (drawn), dis (zClose -5),
                                 countries, cited (chemVsGenes, overlapVsGO, pubmed.records, eprtr.from/to), drawn
XDATA.ex                         the story's examples: bap, ozone, endrin, crocin (substance indices), ozoneAsthma
                                 { z, cit, disease, diseaseGenes, asthmaCloseSubs, ozoneClose }, clot { id '11_2_1',
                                 comm (index among the fine), members [21], genes [[sym, n] by n], serpinc1 [5 indices] },
                                 endrinClose [[disease, z, cit] x 13], endrinItaly { gbd, inAir, inWater }
XDATA.N, XDATA.NN                9,887 substances; the first 9,764 are the network's
XDATA.label[i]                   a substance's label;  XDATA.full(i), XDATA.id(i): once names.json is in
XDATA.pos, XDATA.shelf           Float32Array layouts (above)
XDATA.cls[i]                     bit c: in family c (XDATA.classes.names[c], .count[c], .col[c]); XDATA.prim[i] its shelf
XDATA.commOf(i, lv)              its community at level lv (0 top, 1 middle, 2 fine), -1 without links
XDATA.comm                       { n, lv[], id[], size[], parent[], col[], label[], terms[] (top 3), counts [125,152,456],
                                   byLevel[lv] (community numbers), find(lv, id), words(k) }
XDATA.members(k)                 a community's substances
XDATA.pattern(i)                 0 central module, 1 hubs, 2 module at the edge, 3 scattered, -1 none
XDATA.hazard(i)                  0..1 (NORMAN), -1 none
XDATA.ngenes, nppi, maxdeg, deg  genes; of them in the interactome; their best connected one's degree; links in the network
XDATA.near, XDATA.close          diseases significantly close (FDR); of them z < -5
XDATA.links, XDATA.lw            the drawn links (pairs of node indices, strongest first) and their weights 0..1
XDATA.find(q, n)                 substances whose label (or full name) holds q, best studied first
XDATA.countries                  [{ name, lat, lon, air [i], water [i], risk [nChem, nDis, avgMaxDeg, share] | null, pa, pw }]
XDATA.load(name, pkgUrl)         a promise of 'targets', 'ppi', 'diseases' or 'names' (fetched once)
XDATA.need(names, pkgUrl)        true once all are in (or have failed): a set's prep (below) or a pane's render
XDATA.ready(name)
XDATA.targets(i)                 gene indices (most studied genes first)        needs 'targets'
XDATA.targetsPPI(i)              its genes as interactome proteins              needs 'targets'
XDATA.subsOfGene(sym)            the substances that touch a gene (a scan; ~10 ms)  needs 'targets'
XDATA.gene                       { N, sym(g), find(sym), nsub(g), ppi(g) }      needs 'targets'
XDATA.ppi                        { N, head, sym(p), find(sym), deg, place, places, cell, sorted, links }   needs 'ppi'
XDATA.dis                        { N, name(d), find(name), search(q, n), genes(d) (interactome proteins), near(d),
                                   closeOf(i) [{ s, d, z, cit }] closest first, closeTo(d) }               needs 'diseases'
```

A set that needs a file declares `SETS.<key>.prep = () => XDATA.need([...], pkgUrl)`: the load step waits for it
(`buildSet`), so the set is built with the data in. A file that fails (offline, not taken) lets the set build without
it: draw nothing for the missing part, never throw. Panes call `XDATA.load(name, pkgUrl).then(renderAll)` and show "…"
meanwhile.

## 2. Numbers: SCRIPT.md's brackets against the data

All computed by the generator from the deposit and checked by `node src/test-data.mjs` (154 checks).

| Script | Paper | Data | Verdict |
| --- | --- | --- | --- |
| {N} substances | 9,887 | 9,887 | matches |
| {organic} {hetero} {poly} | 5,594 / 3,950 / 1,621 | the same | matches |
| {bap} benzo(a)pyrene's genes | 16,470 | 16,470 | matches (the most of any) |
| {median} | (none) | 3 | data: half of all substances touch **3 or fewer** genes ("fewer than {median}" would be wrong: worded "or fewer") |
| {links} curated links | 573,674 | 573,673 | differs by one (the deposit's `chem_gene_ref_df.tsv`) |
| {genes} | 25,580 | 25,579 | differs by one |
| {casp3} | 1,701 | 1,701 | matches |
| {g2}, {g3} | BCL2 1,078; BAX 968 | TNF 1,208; BCL2 1,078 (BAX is 7th, 968) | differs: the next two genes are TNF and BCL2; the panel shows the data's |
| {nodes} {edges} | 9,764 / 736,470 | the same | matches |
| "nearly fifty million pairs" | | 48,868,941 (9,887 choose 2) | matches |
| "the strongest tenth" | | 736,470 of 6,864,096 significant = 10.7 % | matches |
| {rho} chemistry vs effect | 0.005 | not in the deposit's small files: the notebooks' outputs give Tanimoto vs shared genes Spearman -0.0009, Pearson 0.036 (Exp_fin_3, cell 31); 0.005 is shared genes vs GO similarity among MeSH-related pairs (cell 27) | not derivable; cited as printed in the notebook (`meta.cited`); the panel shows 0.04 (Pearson): "almost unrelated" holds |
| {broad} | 13 | 125 top groups; 20 of 50 or more (95.8 %); the deposit's "13 broad" are those that split down to three levels | differs in meaning: the panel says "20 large ones hold 96 %" |
| {l1} {l2} {l3} | 125 / 152 / 456 | 125 / 152 / 456 (top, middle, fine) | matches |
| {n} the clotting group | 21 | 21 (fine `11_2_1`) | matches, members as the paper names them |
| {P} {L} interactome | 18,815 / 482,935 | the same (478,345 without self-links) | matches |
| {central} {hub} {peri} {scat} | 43 / 15 / 8 / 34 % | 43.0 / 14.8 / 8.0 / 34.2 % of 9,852 | matches |
| {haz} with a hazard score | 47 % | 3,165 of 9,852 = **32 %** have a score; 4,669 (47 %) were *found* in the NORMAN list, with or without a score (Exp_fin_9, cells 23-24) | differs: the panel says 32 % (and the voice "about a third") |
| {r} hazard vs best connected target | 0.24 | 0.2389 (Pearson, 3,165) | matches |
| {D} diseases | 6,177 | 6,177 | matches |
| {pairs} {near} {overlap} | 60,855,804 / 1,601,884 / 28,403 | the same | matches |
| 42 million PubMed records | 42 M | not in the data | as printed in the paper (`meta.cited.pubmed`) |
| {C} countries | 32 | 32 | matches |
| about seven to air, eight to water | | 6.9 and 8.0 on average | matches |
| {it} Italy's substances | 57 | 57 (`Country_risk.tsv`) | matches |
| {x} {w} colon and rectum cancer | 4.05 / 1.14 | 4.051 / 1.145 (Source Data Fig4G, ratio of 20-year means) | matches |
| {a}/{A} air | 17 / 24 | 17 / 24 (Fig4E, one-sided Mann-Whitney p < 0.05) | matches |
| {b}/{B} water | 16 / 23 | **15** / 23 (Fig4F; Norway p 0.031, Romania 0.037, Finland 0.040 in; Sweden 0.061, Belgium 0.065, Ireland 0.067 out) | differs by one: the panel shows 15 |
| {rho} countries | 0.26 | 0.25 from Fig4D's binned values; the notebook's unbinned Spearman is -0.265 (Exp_fin_10, cell 236) | close: the panel shows 0.25 (the data's) |
| ozone-asthma "close" | | z = -5.74, 1,374 co-citations; among ozone's 75 closest (z < -5) and asthma's 973 | in the data: the example stands (z = -5.74 on the panel) |
| endrin (D004732), colon cancer close | | endrin's 13 close diseases include Colorectal Carcinoma (z -6.12); endrin stands out in Italy's **water** releases | matches |

## 3. Findings that change the script

- Chapter 2: "half of them fewer than {median}" is now "half of them three or fewer" (median 3). "then BCL2 and BAX" is
  now the data's next two: TNF (1,208) and BCL2 (1,078).
- Chapter 3: the correlation 0.005 is not chemistry against effect; the data's nearest number for that is Spearman
  -0.001 / Pearson 0.04 (Tanimoto against shared genes, from the notebook; the pair tables are 1 GB pickles not
  shipped). The panel shows 0.04, cited in `meta.cited`.
- Chapter 4: "13 broad" becomes "20 large ones (50 or more substances) hold 96 %"; the three named in the voice come
  from `SORT_EXAMPLES` (`e3_story.js`: top groups 3, 9, 16 = "the immune system and its signals", "how the body
  handles fat", "how the body clears drugs", after the review); the script's "how cells divide" is not supported by
  any group's terms.
  The clotting group: fine `11_2_1` (in middle `11_2`, top `11`), 21 substances: argatroban, melagatran, ximelagatran,
  lepirudin, hirudins, calcium heparin, dalteparin, the combined pill (and norgestimate / drospirenone with ethinyl
  estradiol, norpregnenes), clobazam, ioxaglic acid, quinapril, three phosphatidylinositol phosphates, two quercetin
  sulphates, S 2238, variegin. SERPINC1 is touched by 5 of them: calcium heparin, dalteparin, the combined pill,
  ioxaglic acid and clobazam (the script's four all do). The group's most shared gene is **F2** (prothrombin, 19 of
  21); then SERPINC1 (5), F5, SERPIND1, TBXA2R (2 each). Its terms: Common pathway of fibrin clot formation (FDR
  1.6e-8), formation of fibrin clot, hemostasis. Top group 18 ("blood clotting", 91) is a second clotting group.
- Chapter 5: hazard scores for 32 %, not 47 % (the voice says "about a third"). Hazard by pattern (mean): central
  0.169, hubs 0.135, scattered 0.117, edge module 0.109: "a central module, then hubs" holds.
- Chapter 6: ozone-asthma is in the data (z -5.74, 1,374 co-citations): kept.
- Chapter 7: water 15 of 23 (the paper 16); correlation 0.25 (binned; the paper's 0.26 from unbinned z). Endrin stands
  out in Italy's water releases (not air).
- Good "chemically unlike, same group" examples (for explore's Groups tab, or a later line): middle `13_1` (nerve
  signals: acetylcholine): acetylcholine, the muscle relaxant pancuronium, the plant alkaloid physostigmine, the
  Alzheimer's drug rivastigmine and the organophosphate isoflurophate; middle `13_2` (carbon dioxide and bicarbonate):
  the glaucoma drug acetazolamide with plain bicarbonates and carbonates; top `9` (how the body handles fat): the
  cholesterol drug ciprofibrate, the plasticiser diisodecyl phthalate and the flame retardant TCIPP.
- Example substances for the four patterns a lay person knows (chapter 5): **central module** cadmium (1,804 genes,
  hazard 0.75), arsenic, formaldehyde, paracetamol (acetaminophen), ozone; **hubs** triclosan (2,214 genes; soaps,
  toothpaste), the herbicide diuron; **module at the edge** thallium (14 genes), hydrochlorothiazide, pancuronium;
  **scattered** scopolamine (seasickness), metoclopramide, strychnine. *Suggested* for the scene: cadmium, triclosan,
  thallium, scopolamine (`ppi_pat` below).

## 4. Chapters: times, lines and the scene track

Story time (the timeline, seconds). `NARRATION_SYNC` is provisional (`tools/pace.mjs`'s rule, 9:50 on the clock)
until the voice is rendered; key everything on story time (`C.<key>.a + s`), where `s` is a line's `data-at`. Each line
below: its `data-at` and what the scene shows then. **Owner**: B or C (the track function that keys it).

### 1. `cloud` 0-50 (B) — Ten thousand substances
- 0.6 title, 1.6 lede (silent). 3: breath, exhaust, smoke, perfume, breakfast, pill. 12: the exposome. The scene: a slow
  cloud of 9,764 points all round you (the camera inside, the set scaled up), drifting; warm light. *Suggested*: the
  cloud's points come from far away in the first seconds as the voice names air, food, medicines.
- 22 "every dot is one substance": the dots in one soft colour; 31 "each colour one chemical family": colours by family (`cloud_col` 0 = family) fade in, then the points fly to the shelves
  (`cloud_shelf` 0 -> 1 over 31-38); labels of the 3-5 largest families with their counts (`XDATA.classes`).
- 42 "it is tidy, but": the shelves turn slowly round you.
- Camera: inside the cloud (`cam: inside`), turning slowly; at the end out a little to see the rings.

### 2. `reach` 50-115 (C) — One substance reaches in
- 0.6 title. 1.5 benzo(a)pyrene comes forward (the cloud fades by `C.reach.a + 4`, B's key; one bright dot stays: C's
  cell set draws the substance as its own point, outside the cell, at `anchors.substance`).
- 11 the model cell appears (skins first, then the proteins: 18,815 dots where *Back into the cell* puts them).
- 19 "watch: every thread is one gene": threads grow from the substance to each target protein (`cell_thr`), up and
  down not told apart (the data has no direction).
- 26 "about sixteen thousand genes": all of BaP's 16,470 genes, the 12,000-odd in the interactome as threads (cap the
  drawn number if needed, say so in a comment; the panel's number is the data's).
- 36 the collection: threads from many substances at once, faint (*suggested*).
- 49 CASP3: one protein glows, threads run back out from it to its 1,701 substances (points on a ring or a shell
  outside the cell, `cell_rev`); 59 "two substances, the same genes?": two of CASP3's substances light.
- Camera: the cell from outside, closing in a little at 19-36; at 49 on CASP3.

### 3. `threads` 115-170 (B) — Tying the threads
- 1.5 two substances (`pair`: *suggested* benzo(a)pyrene and another with many shared genes; B picks two well-known
  ones from the data, e.g. two the reader met: BaP and a substance from CASP3's ring), their gene threads compared;
  the shared ones glow and fold into one thread between the two (`pair_genes`, `pair_share`, `pair_tie`).
- 13 "every pair ... keep only the strongest": the cloud returns on its shelves (`cloud_shelf` 1, `cloud_net` 0), the
  drawn links appear (`cloud_links`).
- 25 "let the threads pull": the shelves fall apart into the authors' layout (`cloud_net` 0 -> 1 over 27-37), colours
  still the families.
- 37 "the families are mixed right through": hold, turn; 48 "new neighbours".
- Camera: the pair close (0.5-23), then the whole network from outside, turning.

### 4. `sort` 170-250 (B) — Sorted by what they do
- 1.5 colours change from family to community (`cloud_col` 0 -> 1, level 0: the 20 large top groups in their colours,
  the small ones grey or dim); the groups separate a little (`cloud_split`).
- 12 the three examples' labels come up one by one as the voice names them (`SORT_EXAMPLES` = top 3, 9, 16, in that
  order, about 4 s apart; `cloud_names`), the others' labels faint or after.
- 22 "smaller groups, and smaller ones again": the colours step to the middle then the fine level (`cloud_level`),
  and the camera flies towards top group 11.
- 30 the clotting group `11_2_1` (`clot`): its 21 substances; the four named come forward one by one as the voice names
  them (30-41: heparin = calcium heparin, the pill = "Contraceptives, Oral, Combined", the dye = ioxaglic acid, the
  sedative = clobazam), with their labels.
- 42 SERPINC1 appears among them, threads from the four to it; "blood clotting" as the group's label.
- 54, 63 hold on the group; 73 "which are dangerous?": pull back.
- Camera: the network turning (1.5-28), a fly-in to top 11 and the fine group (22-31), the group close (31-79).

### 5. `centre` 250-335 (C) — Where it hits
- 1.5 back in the cell; the contacts appear (`ppi_links`: 30,000 drawn of 482,935; the panel states the true count).
- 13 the proteins leave the cell and settle sorted (`ppi_sort` 0 -> 1): hubs in the middle, loners at the rim.
- 23, 31, 37, 43: the four patterns, one example substance each (`ppi_pat` 0..3 and `ppi_sub`), its targets lit in the
  pattern's colour (`LOOK.pattern`), its contacts among them drawn; a tag with the substance's name.
- 53 "a hazard score": every substance with a score becomes a small flare at its targets' centre (or at its best
  connected target), the brighter the more harmful (`ppi_haz`); 62 the central ones brightest; 71 "pull a thread in the
  middle": a ripple from the centre outwards (*suggested*); 79 "and disease?".
- Camera: as chapter 2 at first, then out to see the sorted ball, turning.

### 6. `disease` 335-400 (C) — Disease neighbourhoods
- 1.5 asthma's 38 genes light as a neighbourhood (`ppi_dis` = asthma).
- 9 "measure a distance": from each of ozone's targets the step to the nearest asthma protein drawn (`ppi_paths`).
- 17 ozone's targets (`ppi_sub` = ozone; 2,112 genes) light in the substance colour beside asthma's; tag "z = -5.74".
- 31 "sixty million pairs": many pairs flash (`ppi_pairs`; close ones bright): *suggested* from `diseases.bin`'s close
  pairs, a few hundred at a time.
- 42 the literature check (no scene change, or co-citation counts as tags), 55 "real populations?".
- Camera: close on the asthma neighbourhood (1.5-30), out (31-65).

### 7. `europe` 400-485 (C) — Out into the world
- 1.5 the interactome shrinks to a point and we rise to the globe, turned to Europe (`globe_turn`).
- 9 the 32 countries get a marker (`globe_marks`); their elevated substances rise above them as points (`globe_subs`).
- 18 Italy: its 57 (`globe_country`); endrin among them (`globe_sub` = endrin).
- 26 threads down from endrin to its close diseases (`globe_threads`): colon and rectum cancer named (from
  `XDATA.ex.endrinClose`); 35 the two ratios as tags (4.05 times the world, 1.14 times western Europe).
- 49 "every country, every substance": all countries, close (bright) against distant (dim) per country (`pa`, `pw`)
  *suggested*; 58 the 17 of 24 and 15 of 23 marked; 67 "a tendency, not a proof".
- 75 the columns (`globe_cols`): each country's risk share as a column (27 countries; the five without a score get
  none).
- Camera: from far out onto Europe (1.5-9), close on Italy (18-48), Europe whole (49-85).

### 8. `end` 485-530 (C until +8, then B) — A map to look with
- 0-8 (C): the globe falls away; the interactome passes by small (*suggested*); 6-10 (B): the network of substances all
  around you again in its communities' colours (`cloud_col` 1, `cloud_level` 0, `cloud_net` 1).
- 23 "a place for every substance", 32 "now it is yours": turn slowly; 36 Explore button; 38 credits.

## 5. The sets and their interfaces

The set contract is `packages/lbi/src/SPEC.md`, "What a set exports": `SETS.<key> = function (K)`, `K.newSet`, `params`
(names start with `<key>_`; `<key>_a` the engine's fade), `update(S, t, dt)` depending only on params and time (never
on frames or random draws: seeking must work; step params never eased), `anchors`, `labels`, `cam` (`default`
required), `controls` + `explore(c)` for explore mode, `api()` for panes. All sets are centred on the origin, radius
about 1, y up. The params below are the **interface the skeleton keys and explore uses**: keep them (meaning and
range); add any you need (document them in your set's header comment). Picking params (substance, community, disease,
country, pattern) are steps: `jump`, never `ramp`.

| Set (file) | Owner | Params (default) | Meaning |
| --- | --- | --- | --- |
| `cloud` (`sets/cloud.js`) | B | `cloud_shelf` 0, `cloud_net` 1 | layout: drift cloud -> shelves (`XDATA.shelf`) -> the authors' layout (`XDATA.pos`) |
| | | `cloud_links` 0 | the drawn links' strength (0-1) |
| | | `cloud_col` 0, `cloud_level` 0 | colour: family (0) -> community (1) at level 0/1/2 (step) |
| | | `cloud_split` 0 | communities pulled apart a little (0-1) |
| | | `cloud_names` 0 | community labels (0-1; `SORT_EXAMPLES` first) |
| | | `cloud_focus` -1, `cloud_pick` -1 | a community lit, the rest dimmed (step, `XDATA.comm` index); a substance picked (step) |
| | | `cloud_drift` 0 | the slow drift / turn of chapter 1 |
| `pair` (`sets/pair.js`) | B | `pair_s1`, `pair_s2` (steps), `pair_genes`, `pair_share`, `pair_tie` (0-1) | two substances, their threads, the shared ones, the one thread between |
| `clot` (`sets/clot.js`) | B | `clot_in`, `clot_four`, `clot_gene`, `clot_label` (0-1) | the fine group gathers, four come forward named, SERPINC1, the label |
| `cell` (`sets/cell.js`) | C | `cell_shell` 1, `cell_sub` (step, BaP), `cell_thr` 0, `cell_gene` -1 (step, a protein), `cell_rev` 0 | the model cell, a substance's threads in, a gene's threads out to its substances |
| `ppi` (`sets/ppi.js`) | C | `ppi_links` 0, `ppi_sort` 1, `ppi_pat` -1 (step 0..3), `ppi_sub` -1 (step), `ppi_haz` 0, `ppi_dis` -1 (step), `ppi_paths` 0, `ppi_pairs` 0 | the interactome: contacts, cell -> sorted, a pattern's example, a substance's targets, hazard flares, a disease's neighbourhood, the steps between, pairs flashing |
| `globe` (`sets/globe.js`) | C | `globe_turn` 1, `globe_marks` 1, `globe_subs` 0, `globe_country` -1 (step), `globe_sub` -1 (step), `globe_threads` 0, `globe_cols` 0 | Europe, the markers, the substances above each country, one country and one substance, threads to close diseases, the score columns |

`SET_ORDER` (`engine/e2_scene.js`): `cloud, cell, pair, clot, ppi, globe`. A builder adding a set lists it in
`build.mjs`'s `SET_FILES` and `SET_ORDER` in one small commit and says so in their report (both files are A's, see 6).

## 6. Who owns what

Disjoint files: each builder edits only its own, and commits only its own by explicit path.

| Files | Owner |
| --- | --- |
| `sets/cloud.js`, `sets/pair.js`, `sets/clot.js` (and any new `sets/b-*.js`); `engine/e3b_substances.js` (`trackSubstances`); `engine/e4b_substances.js` (`SCENES_B`, `XB`, `stateB`/`applyB`, `renderSubstances`, `renderGroups`, `pickWithB` ..., `actB`, `inputB`, `hashB`); `engine/e6b_substances.js` (`drawSubstancesPane`, `drawGroupsPane`) | **B** |
| `sets/cell.js`, `sets/ppi.js`, `sets/globe.js` (and any new `sets/c-*.js`, e.g. `c-cut.mjs` for the cutter); `engine/e3c_world.js` (`trackWorld`); `engine/e4c_world.js` (`SCENES_C`, `XC`, `stateC`/`applyC`, `renderDiseases`, `renderCountries`, `pickWithC` ..., `actC`, `inputC`, `hashC`); `engine/e6c_world.js` (`drawDiseasesPane`, `drawCountriesPane`) | **C** |
| `build.mjs`, `engine/e1_head.js`, `e2_scene.js`, `e3_story.js` (chapters, every panel and `data-say` line, `NARRATION_SYNC`, `SORT_EXAMPLES`), `e4_explore.js`, `e5_xr.js`, `e6_panels.js`, `e7_app.js`, `sets/data.js`, `sets/xdata.js`, `sets/look.js`, `src/data/*`, `test-data.mjs`, `story.json`, `README.md`, `minis.js`, this file | **A / the main conversation** (a builder that needs a change there asks in its report, or makes one small separate commit naming it; never both builders in one file) |
| `packages/index.json` | either (the scan); on a merge conflict take either side and run `node tools/packages/scan.mjs` again |
| `packages/exposome/main.js`, `minis.js` | built: either builder rebuilds and commits; on a conflict rebuild |

Words on the panel and in the voice are the main conversation's (`e3_story.js`): a builder whose scene cannot show what
a line says tells the main conversation; it never edits the line. Story labels a builder adds (`label(...)` in its
track) are short tags of what the scene shows (a name, a number from `XDATA`), British spelling.

## 7. Explore mode

Tabs (`TABS`, A's): **Scene** (the sets' controls: `SCENES = [...SCENES_B, ...SCENES_C]`), **Substances**, **Groups**
(B), **Diseases**, **Countries** (C). Each pane twice: HTML (`render<Tab>`) and the headset's canvas
(`draw<Tab>Pane`), kept in step. Picks:

- Substances (B): search (`XDATA.find`, then `names.json` for full names), a substance's card: label, full name,
  families, its three communities (with their words), pattern, hazard, genes (`ngenes`; its top genes once
  `targets.bin` is in), its links in the network (`deg`), diseases close (`near`; the closest from `dis.closeOf`).
  Picking one shows it in the cloud (`cloud_pick`) and lets the reader open C's scenes on it (see "Across builders").
- Groups (B): the 20 large top groups with their words and sizes, then their middle and fine groups; a group's card
  (words, size, top terms with FDR, best-known members); picking one sets `cloud_focus`.
- Diseases (C): search (`dis.search`), a disease's card: genes, its neighbourhood lit in the interactome
  (`ppi_dis`), its closest substances (`dis.closeTo`, z and co-citations), how many are significantly close.
- Countries (C): the 32 on the globe, a country's card: its elevated substances to air and to water (labels), its
  score (where it has one), close against distant (`pa`, `pw`, said in words: "more frequent" when p < 0.05), its
  substances' close diseases.

**Across builders**: a substance picked in B's tab is `XB.sub`; C's scenes show it when the reader opens them (C's
sets' `explore(c)` read `XB.sub` for `cell_sub` / `ppi_sub`; B never writes C's params or `XC`). A disease or country picked in C's tab is `XC.dis` / `XC.country`; B may read them (e.g. to list a
country's substances in the cloud) but never writes them.

**Shared rooms**: `collabState()` = `{ v: COLLAB_V, tab, scene, ctl, b: stateB(), c: stateC() }`; plain outcomes only
(indices of what is picked; never typed text, the camera, hover or a search's results). `applyB`/`applyC` check every
field and ignore unknown ones; `apply(state())` gives the same state back. A builder that changes its part's shape says
so in its report: the integration bumps `COLLAB_V` (and `FORMAT` in `shared.js` if needed).

**Address**: `#exposome&explore&scene=<set>&tab=<tab>` (the frame's) plus each builder's own keys read in `hashB` /
`hashC` (*suggested*: `&sub=<label or CTD id>`, `&group=<id>`, `&dis=<name>`, `&country=<name>`).

## 8. Headset, shared rooms, sound

- Not life size (`"life": false`): every set floats in front of you at the default size (`xrPlace`, `xrCap`); the grip
  moves and turns the scene (template behaviour). Chapter 1's "you stand inside the cloud": on a screen the camera
  goes inside (`cam: inside`); in a headset *suggested* as the CDK5 story does (standing inside by scale: the cloud set
  large, the head at its centre), no keepClear on points.
- `keepClear` (no close view nearer than 0.35 m): `cell`, `ppi` and `globe` export it; `e5_xr.js` takes the engine's
  `xrCap~2` (with `XR_NEAR`, `xrSampler`, `xrPrep`, `xrClear`) and calls it with the frame's time, as the engine's
  `xrPlace` does; the sampling (`xrPrep`) runs from `frameFloor` (this story keeps the engine's plain `frame`, which
  calls neither). The interactome's points move in their shaders, so `ppi` adds a hidden stand-in (every protein in the
  cell and sorted) for the sampling. The cloud, which you stand inside, is not keepClear: its shader fades points
  within 0.35 m of your head.
- Labels: few at once (at most about 6), short (bold 1-3 words, rest under ~30 characters).
- Sound: only `sfxCue` lines in the tracks (`HOST.audio.fx` through the template); no background, no hum, never an
  `AudioContext`. *Suggested* cues: `whoosh` on the big moves (shelves, network, sort, out to the globe), `step` on a
  pick. Report how they sound as unheard.
- Nothing about people: countries by their rates only. No health advice. Never "causes": substances *disturb* or
  *touch* genes, diseases are *close* in the map, *more common where*.

## 9. Reuse: the model cell and the globe

- **The model cell** (*Back into the cell*): the proteins' places are already in `ppi.bin` (`src/data/gen_cell.mjs`
  runs `packages/ppicell/src/sets/cell.js` in Node through `packages/ppicell/src/export-wwiznet.mjs`'s `loadCell()` and
  takes each protein's dot). The **skins** (membrane, nucleus, ER, Golgi, mitochondria, small organelles; the cell
  map's numbers and shaders) are C's to take at build time, read-only, from `packages/ppicell/src/sets/cell.js`: the
  section from the line `  // ------------------------------------------------------------ the cell (the cell map's
  CELL, its numbers kept)` up to the line `  // ------------------------------------------------------------ places,
  spaces and faces` (`CELL`, `shellMaterial`, `mergeCopies`, the `shells` group), pasted inside a function that gives
  it what it reads (`K`, `THREE`, `clamp`, `v3`, `set`, `mul`, `perp`), as the soil story reads
  `packages/topo/src/sets/look.js` (a shared source named in `build.mjs` as `'/packages/ppicell/src/sets/cell.js'`
  cut by markers). The cut fails the build loudly when a marker is missing (as `packages/pass/src/build.mjs`'s
  `lineStart` does). Never edit `packages/ppicell/`. After a change there, rebuild this story (a reader of a shared
  source: name it in `docs/agents/stories.md` at integration).
- **The globe** (the airports story's): as `packages/pass/src/build.mjs` does (`ORIGINALS`, `PASS_AIRPORTS`): cut
  whole sections and declarations out of `packages/airports/main.js` and paste them inside a function of their own.
  C copies the cutter (`declEnd`, `lineStart`, the section and name cuts) into a file of its own (e.g. `src/c-cut.mjs`,
  imported by `build.mjs`: the one line in `build.mjs` C may add, said in its report) and takes only what the globe
  needs: the land and lakes (`LAND_B64`, `LAKES_B64`, about 133 KB) and the globe's shaders and scene; *not* the routes
  (`NET_B64`, 353 KB) unless `buildScene` cannot do without them. Budget: `main.js` under about 2.2 MB in all
  (now 1.18 MB). Never edit `packages/airports/main.js` (nor `packages/pass/`). The pass story's `sets/globe.md` says
  how its original is driven (its uniforms, its light, dot sizes in a headset).

## 10. Checks, sizes, integration

Cheap checks only (no smoke test, no shared-room run): `node --check` on changed files; `node
packages/exposome/src/build.mjs --check`; `node packages/exposome/src/test-data.mjs`; `node tools/packages/scan.mjs
--check`; `PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs node tools/packages/check.mjs
packages/exposome --load` (loads, plays and explores in headless Chromium). A play-through without console errors:
serve with `timeout 600 python3 -m http.server 8123` and seek with `HOST.cur.peek('APP').seek(t)` (a 404 for
`/api/ping` is the shell's relay check on a plain server: expected).

Sizes: embedded data 961 KB; `main.js` at most about 2.2 MB with the globe and the cell skins; `data/` 3.88 MB (do not
add to it without asking).

At integration: `story.json` `"list": "experiments"`; `packages/order.json` names it (after cdk5: the app's own
stories are all there, whichever set they are on, so `tools/engine/all.mjs` builds it and `version.json` lists it); the voice (`tools/voice/narrate.mjs exposome`,
which writes `NARRATION_SYNC` and `NARRATION_ENDS`), `len`; `relay/server.mjs` needs nothing (packages are served
whole); `tools/collab.mjs` `STORIES` an entry; `NOTICE.md` the deposit's licence (CC BY 4.0) and its sources' terms
(`docs/data-and-permissions.md`); `docs/agents/stories.md` (A wrote the section; B and C add their sets' lines);
`VERSION`, `tools/release.mjs`, `whatsnew.json`.

## 11. After the review (25 November 2026)

- Panels and panes take every number from the data (`meta.drawn`, `meta.ppi.drawn`, `meta.dis.zClose`,
  `meta.levels.bigMin`, `meta.cited.pubmed`, `meta.cited.eprtr`); the panels say "in this map" or "here" for the
  statistics on the substances' network and the interactome, and what is ours or a sample: "on our shelves", "our
  arrangement", "drawn together here", "A sample", "N threads drawn", "the 45,000 strongest drawn", "by chance you would
  expect about 3".
- Chapter reach ends with chapter threads' pair lit (diethylstilbestrol and zearalenone: both touch CASP3 in the data,
  `PAIR_NAMES` in `sets/pair.js`); in chapter threads each has a plain tag ("a synthetic hormone, once a medicine", "a
  toxin from mould on grain").
- Chapter sort's dive: the focus tag says "A larger group" / "A smaller group" with the size in the story (explore names
  the group). The threads step back at "look at the colours" (`cloud_links` to 0.3).
- The hand-over from sort to centre overlaps (the cloud and the clotting group fade out to `C.centre.a + 0.5`, the cell
  comes in from `C.centre.a - 1.4`, its picks keyed at `- 1.6` while hidden).
- Italy's two ratios are two short tags stacked above it ("4× the world's rate", "1.1× western Europe's"); the score
  columns' tags say "of the total score".
- Explore: `&dis=` and `&country=` open their tab and scene; the headset's panes show their notes with a card too, *No
  substance* in Diseases and *Show on the globe* in Countries; `applyC` bounds the disease by the count.
