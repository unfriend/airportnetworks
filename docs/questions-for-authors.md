# Questions for the authors

Open items found while building the six stories that rest on colleagues' work: places where the sources disagree,
and stand-ins waiting for the authors' own values. Each item says where it is in the source, what the story shows now
and where that is in the code or data. Whether the authors agreed to their material being shown at all is a separate
matter: see [data-and-permissions.md](data-and-permissions.md).

**Until an author answers, the story keeps what it shows now.** Do not "fix" a number in the code on your own: the PET
story deliberately shows the paper's printed values, and the microanatomy story the preprint's. When an answer comes:

1. change the generator (`tools/<story>/data/gen_data.*`) or the figures' readings (`tools/<story>/data/figures.json`),
   never `sets/data.js` by hand;
2. regenerate the data, rebuild with `node tools/<story>/build.mjs` (then `--check`), bump `VERSION` in `sw.js` and run
   the smoke test ([AGENTS.md](../AGENTS.md), "Testing");
3. set the item's status here to `answered`, with the date and the answer in a few words.

## PET: One scan, one system (`pet`)

Sources: Geist et al., "The metabolic organ connectome: A novel approach to measure allostatic load during
health-to-disease transition", Med 6, 100881 (2025), doi 10.1016/j.medj.2025.100881; the poster "Shaping a New Era in
Nuclear Medicine". Who to ask: the paper's authors (first author Barbara Katharina Geist, last author Marcus Hacker).
Contact person: **TO FILL (owner)**.

| # | Item | Where in the source | What the story shows now | Status |
| --- | --- | --- | --- | --- |
| P1 | The survival row reads inverted: the shorter survivors' network is the denser one (density 23 % against 7 %, disorder 0.14 against 0.23), unlike the paper's other results, and the text does not discuss it. | Table 2, "Survival" (people with cancer, split at the median of 34 months) | The row as printed, with a note saying so, in explore mode only (Networks tab); the narration does not use it. `T2` in `tools/pet/data/gen_data.mjs`; shown by `tools/pet/engine/e4_explore.js` and `e6_panels.js`. | open |
| P2 | Leukocytes, full cohort split at the median: p = 0.12 in Table 2, p = 0.012 in the text. | Table 2, "Leukocytes"; the paper's text | p = 0.12 as printed (not significant), with a note giving the text's value; explore mode only. Same places as P1. | open |
| P3 | Hexokinase 2: p = 0.1 in the text, p = 0.01 in the figure and the table (**TO FILL (owner):** the repository has only Table 3's p = 0.01; where the text's p = 0.1 comes from, and whether Figure 4 shows it). | the paper's text; Table 3 (Figure 4: unchecked) | "similar (p = 0.01)" and r = 0.42 with FDG's network (explore mode, Networks tab); the narration says only that HK2's network resembles FDG's (r = 0.42). `T3` in `tools/pet/data/gen_data.mjs`; `tools/pet/engine/e3_story.js`. | open |
| P4 | The one-scan network's formulas: the poster names Clearance, Heterogeneity and the metabolic displacement index, but their formulas are not published. | the poster | Nothing: the one-scan part was taken out of the story in October 2026 (it did not match the poster). | closed (2026-10-23): no longer shown |

P4 came from the generator's own note rather than from a reading of the paper; it matters again only if the one-scan
part comes back.

## Microanatomy: Tissue and time (`micro`)

Sources: Buljan I, Bago-Horvath Z, Rendeiro AF, "Systematic mapping of human tissue microanatomy reveals
age-associated remodeling and resilience", bioRxiv 2025, doi 10.1101/2025.10.13.682110; the poster "Microanatomical
organization of the human body and its changes with age"; the talk "Microanatomical principles of tissue organization
and their change with age"; Iva Buljan's network of organ architecture. Where the sources differ, the story uses the
preprint's numbers (`tools/micro/SPEC.md`, "Shared facts"). Who to ask: Iva Buljan (first author, the talk and the
network) and the Rendeiro group. Contact person: **TO FILL (owner)**.

| # | Item | Where in the source | What the story shows now | Status |
| --- | --- | --- | --- | --- |
| M1 | Donors: 983 in the abstract, 971 analysed. | preprint: abstract and results | Both: "GTEx collected tissue from 983 people" and, in the small print, "971 people's slides were analysed". `FACTS.donors`, `FACTS.donorsAnalysed` in `tools/micro/data/gen_data.mjs`; `tools/micro/engine/e3_story.js`. | open |
| M2 | Ages 20 to 70 (preprint) against 20 to 80 (talk). | preprint; talk | 20 to 70 (`FACTS.ages`). | open |
| M3 | Slides: 24,945 (preprint) against 25,713 (talk). | preprint; talk | 24,945 (`FACTS.slides`). | open |
| M4 | Domains that change with age: 28 % (preprint) against 27 %. | preprint; **TO FILL (owner):** which source says 27 %, and where | 28 %, "37 of 128 pairs of a domain and a tissue" over 1 % abundance (`FACTS.ageChange`, `FACTS.agePairs`). | open |
| M5 | Two trajectory panels are drawn in other units than the text: adenohypophysis (pituitary) 0.40 to 0.33 against 82.6 % to 67.9 % (-3.42 % per decade); corpus albicans (ovary) 0 to 0.15 against 1.4 % to 11.89 % (3.51 % per decade). Our reader's guess, not stated anywhere: per slide area against per tissue area. | the talk's trajectory panels (`tools/micro/data/figures.json`, trajectories "adenohypophysis (Pituitary)" and "corpus albicans (Ovary)"); the text | The text's numbers (called the preprint's in `tools/micro/SPEC.md`; `figures.json` calls them the talk's) wherever a number is stated (`EXAMPLES` in `tools/micro/data/gen_data.mjs`); the panels only for the curves' shapes. | open |
| M6 | The drawn regression lines do not have the slopes printed beside them: four are 35 to 60 % steeper (submucosa of the transverse colon, both testis panels, vagina), two are 6 % and 15 % shallower (corpus albicans, adenohypophysis). Perhaps the printed slope comes from a model with covariates. | the talk's trajectory panels (`figures.json`, its `notes`) | The printed slopes as the numbers; the drawn lines only for shapes. | open |
| M7 | No stomach-versus-uterus network in the talk: its contact-network figure shows the stomach, small intestine, breast and minor salivary gland; the uterus appears only among the domain pairs. Is there one, and where? | the talk (`figures.json`, its `notes`); `tools/micro/SPEC.md` | No such comparison. Contact networks of the colon, skin, ovary, fallopian tube, uterus and coronary artery (`tools/micro/sets/hier.js`). | open |
| M8 | The co-authors' first names are unconfirmed, and so is the spelling with or without accents. | the bylines of the preprint and the poster | Story credits: "Iva Buljan, Z. Bagó-Horváth and A. F. Rendeiro" (`tools/micro/engine/e3_story.js`). Citations in the data: "Bago-Horvath Z" (preprint) and "Bagó-Horváth Z" (poster) (`tools/micro/data/gen_data.mjs`). `README.md` and `tools/micro/README.md` write the first names out ("Zsuzsanna", "André F."): unconfirmed too. | open |
| M9 | "10 classes": are the preprint's 10 classes of domain types the 10 tissue types of Iva Buljan's network? | preprint; the network (GraphML) | "218 domains of 74 types, in 10 classes" (`FACTS.superclasses`); the network shows 10 tissue types (adipose tissue, cardiac muscle, connective tissue, glandular tissue, lining epithelium, lymphoid structure, neuronal tissue, skeletal muscle, smooth muscle, vascular tissue). | open |

## Ovarian aging: The aging ovary (`ovary`)

Source: the poster "Mapping the histological landscape of human ovarian aging" by Parijat Chakraborty (1), Samir Moustafa
(2, 3) and André Rendeiro (1, 3): (1) Ludwig Boltzmann Institute for Network Medicine at the University of Vienna, (2)
CeMM Research Center for Molecular Medicine of the Austrian Academy of Sciences, (3) Faculty of Computer Science,
University of Vienna; data GTEx. The story types in the poster's numbers (`tools/ovary/data/gen_data.mjs`) and reads its
charts' lines off the figures (`tools/ovary/data/figures.json`); the story draws no charts of its own (only the age histogram). Who to ask: Parijat
Chakraborty (first author) and the Rendeiro group. Contact person: **TO FILL (owner)**.

| # | Item | Where in the source | What the story shows now | Status |
| --- | --- | --- | --- | --- |
| O1 | Is r Pearson's or Spearman's? | the trend and comparison charts | The printed r and p in words (Age, and explore's Objects pane), with no word on which (`OVARY_DATA.kinds[].trend`, `.compare`). The illustrative dots drawn until October 2026 were tuned to give the printed r as Pearson's r on counts, which came closest with the bands as read (ranks gave follicle r near −0.7); no dots are drawn now. | open |
| O2 | The trend charts' y axis: it reads as log10 of the count, with 0 drawn as a row at the place of 0.5 (ticks 0, 2, 10, 50, 200, 1000). Is that the scale? | the trend charts | No trend charts any more (October 2026), but the lines were read on that scale (`axis` in `figures.json`), so the count tags on the ovary and the explore Age pane depend on it. | open |
| O3 | The fitted lines read as straight lines in counts (curving on the log axis; the follicle lines reach 0 at about 58.5 and 59). Are they linear fits of count on age? | the trend charts | Straight lines in counts, as read (`trends` in `figures.json`); "toward none by about 60" in the story. | open |
| O4 | Blood vessel F1: 0.86 is printed, but its precision (0.81) and recall (0.88) give 0.84. | the random forest performance table | The printed 0.86; the Objects pane notes the 0.84 (`OVARY_DATA.checks.f1`). | open |
| O5 | How many donors does the follicle comparison have? r = 0.94 with p = 1.4×10⁻¹³ suggests about 30, not 255. | the method comparison, follicle panel | The printed r and p, said "donor by donor" in Age and in explore's Objects pane. | open |
| O6 | What counts as a cyst (only the segmentation has it, IoU 0.15)? | the SegFormer scores | "Fluid-filled sacs. Only the segmentation looks for them"; two drawn cysts on the section that stay with age (`tools/ovary/sets/section.js`). | open |
| O7 | Could per-decade counts (or the donors' counts without identifiers) be shared, to replace the illustrative dots? | the trend and comparison charts | No dots since the charts went (October 2026; the data keeps only the donors' ages, for the histogram's slides). The count tags on the ovary come from the read lines: such counts would make them exact. | open |
| O8 | The story's last chapter pictures the poster's next step ("study the spatial relationships between ovarian features") as a spatial neighbor network: each object a node, linked to the objects near it, then gathered by kind into five hubs joined by bands as the section ages. Is a spatial network what you plan? May the story show it, labelled illustrative, and say "This is where network medicine comes in"? | the poster's future directions (it names no network) | The Next chapter: the heading "Next: a network", the neighbor network and its hubs by kind (labelled illustrative; the bands come from the drawn section, not from data), "As the ovary ages, the network changes", the poster's three plans in its words, and "This is where network medicine comes in: as in Tissue and time, a tissue becomes a network of neighbors" (`tools/ovary/engine/e3_story.js`, `tools/ovary/sets/section.js`). The owner chose to ask first (2026-10-26). If the answer is no, the chapter ends on the poster's three plans; if yes, the network stays, worded as the authors' plan. | open |

## Qubits: Three qubits (`qubits`)

Sources: Joel Hancock's brief "Prompt: visualize network compression and the Pauli decomposition" (21 Oct 2026), his
figure of Pauli strings on a cube, his 3-qubit card and his notes on the runs (none in the repository). As he asked,
the story shows example networks throughout (computed in the page) and leaves out the data term D and the
Walsh-Hadamard step; the real run's numbers are in `tools/qubits/sets/data.js`, shown only as "in the real network".
Who to ask: Joel Hancock. Contact person: **TO FILL (owner)**.

| # | Item | Where in the source | What the story shows now | Status |
| --- | --- | --- | --- | --- |
| Q1 | How to credit him: affiliation, and whether co-authors or a paper should be named. | the brief names no affiliation | "After the method and figures of Joel Hancock" (first chapter's small print), "Method and figures: Joel Hancock" (last chapter), the Network and Depth panes (`tools/qubits/engine/e3_story.js`, `e4_explore.js`). | open |
| Q2 | The cut is a stand-in for the authors' beam search (spectral grouping into 8 equal cells, then the codes with the most coupling on cube edges). Is that a fair picture of the method, and is "a beam search that also favors the toolbox" the right gloss? | brief, "2. Bisections" | Said so in the cut chapter's small print and the last chapter's credits (`tools/qubits/sets/qmath.js`, `cut()`). | open |
| Q3 | The example networks: 8 groups of 40 genes (the synthetic check had 48), an uneven variant as the story's default, a strongly mixed one and a random one. Acceptable as illustrations? | `notes-05`, "Synthetic check (hypercube SBM)" | `QMATH.NETS` in `tools/qubits/sets/qmath.js`; the story computes its numbers from "Uneven groups" (cube edges 79 %, residual 0.34 in so(7) at 3 bits). | open |
| Q4 | The circuit runs time downward, as the 3-qubit card does, with RX on q0, q1, q2 first. Is the gates' order the one meant? | brief, "Optional closing frame"; the 3-qubit card | The brief's order and angles (`QUBITS_DATA.circuit`). | open |
| Q5 | The walkers' map: the valleys are illustrative and the text says the walkers are "drawn to pairs that are broken together in patients more often than in healthy people". Is that plain reading of V right? | brief, "Why we do this", glossary | `tools/qubits/engine/e3_story.js`, chapter "walkers". | open |

## Muscle and heart (`nmd`)

Sources: the ISMB 2026 talk "Deep integrative multiplex network-based analysis of rare neuromuscular disorders reveals
overlapping multiscale endotypes involved in cardiac and skeletal muscle myopathies" (Iker Núñez-Carpintero, Philipp
Friedrich, Julia Guthrie, Jörg Menche) and their analysis files in `ikerdata/`. Who to ask: Iker Núñez-Carpintero and
Philipp Friedrich. Contact person: **TO FILL (owner)**. What to do when new files arrive: [tools/nmd/README.md](../tools/nmd/README.md).

| # | Item | Where in the source | What the story shows now | Status |
| --- | --- | --- | --- | --- |
| N1 | The authors' own layer z-scores. | their analysis (not in `ikerdata/`) | Stand-ins computed here, in this map, on the protein layers only: the largest connected group of a disease's known genes against 1,000 random gene sets with the same numbers of links (`tools/nmd/data/gen_data.mjs`; the story's small print says so). | open |
| N2 | The authors' random walk: its settings and visits. | their analysis | Computed here: restart 0.7, layer switch 0.5, layers weighted by the z-scores ("After Buphamalai et al. (2021)" in the small print). `heat` in `tools/nmd/sets/data.js`, from `gen_data.mjs`. | open |
| N3 | The authors' names for the endotypes. | their analysis | Each endotype is named after the most typical GO process of its genes (`gen_data.mjs`); the story says so. | open |
| N4 | The links of the other layers: 33 of the 71 layers have none yet, and 11 have links only for the overlap of congenital myopathies and cardiomyopathies. | their analysis | Those layers are drawn empty (`data: ''` in `layers`); they fill in without code changes once the files are in `ikerdata/` and `gen_data.mjs` reads them. | open |
| N5 | May the files in `ikerdata/` stay public? They are committed in full and served by the public site. | — | See [data-and-permissions.md](data-and-permissions.md), "Before the repository or the site is public". | open |

## Endotypes (`endo`)

Sources: the ISMB 2026 poster "Introducing EndotypY: a Python package for network-based disease endotyping" (Chloé
Bûcheron, Iker Núñez-Carpintero, Enes Sakalli, Mathilde Meyenberg, Julia Guthrie, Jörg Menche), EndotypY
(github.com/menchelab/EndotypY) and the authors' saved run on congenital myasthenic syndromes. Who to ask: the poster's
authors (first author Chloé Bûcheron). Contact person: **TO FILL (owner)**.

| # | Item | Where in the source | What the story shows now | Status |
| --- | --- | --- | --- | --- |
| E1 | The authors' settings for the steps before the endotypes: the seed groups, the walk, each gene's neighbourhood, its annotation and the tree. | their run (the saved run holds the network, seeds and endotypes, not these settings) | Re-run with the package's defaults: restart probability 0.8, a neighbourhood of the top 1 % of the network, GO cellular-component terms (`GO_Cellular_Component_2026`); the tree is drawn to agree with the authors' endotypes. Said so in the small print and in explore mode's Method tab. `R`, `PCT`, `KS`, `FEAT_LIB` in `tools/endo/data/gen_data.py`; `ENDO_DATA.facts`. | open |
| E2 | The endotypes' names and places: are the story's acceptable, or do the authors have their own? | the poster's figure (the colours follow it) | The story's own short names after each endotype's strongest Jensen COMPARTMENTS term (for example "Mitochondria", "Basement membrane", "Golgi"); three endotypes with no significant term are called "No shared place"; each is placed where it acts in the drawn synapse. `LOOK` in `tools/endo/data/gen_data.py`. | open |

E2 follows from the story's own choices in the generator rather than from a reading of the poster.

## The mutation machine (`mutation`)

Source: the poster "Converting Mutation into a Machinery: DNA Substitution Models as Quantum Circuits" (Enes Berk
Sakalli, Arndt von Haeseler; a draft of 26 Oct 2026, not in the repository). Enes Berk Sakalli answered MM2 to MM4 on 27 Oct
2026 (through the owner); the story follows those answers. Who to ask: Enes Berk Sakalli. Contact person: **TO FILL (owner)**.

| # | Item | Where in the source | What the story would show | Status |
| --- | --- | --- | --- | --- |
| MM1 | Is the poster final? Its footer still has placeholders (conference, contact, funding); numbers or figures may change. | footer | the draft's numbers | open |
| MM2 | The values behind the figures: the substitution rates and long-run mix (Figure 2), the pair model and the coupling's strength, the tree's branch lengths (Figure 5). Or are example values, computed in the page and said so, fine? | Figures 2, 4, 5 | example values, labelled | answered 27 Oct 2026: example numbers (rates, long-run mix, branch lengths); matching pairs eight times as likely as mismatched ones. Fine for a test of the method; a real result would estimate them from real sequences. |
| MM3 | How the turn is built as gates (for example a rotation on the first qubit and a controlled one on the second, the parent's letter copied first), so the circuit is drawn right. | section 3, Figure 4 | copy, turn, join as the poster draws them | answered 27 Oct 2026: the parent's letter is copied onto the child, then the child is turned by single-qubit rotations plus two-qubit steps that make the turn depend on the parent's letter; the angles depend only on the branch length, and the steps are the same on every branch. |
| MM4 | How to word the result: the true ancestor has one broken pair, so "all six pairs intact" is not "right"; and the coupled circuit (43 %) beats the exact pair model (20 %). How often did each method rebuild the true ancestor, and how should the story say this without claiming the circuit is simply better? | section 4, Figure 5 | "coupling changes pairing in the rebuilt ancestors", the three percentages | answered 27 Oct 2026: a mismatched pair in the true ancestor is normal (allowed, only rarer; only about a quarter of ancestors have all six pairs matched). With coupling 43 % of the rebuilt ancestors have all pairs matched, without 10 %; the exact calculation gives 20 %, so the coupled model favours matching pairs too strongly: believable ancestors, but its percentages are not true probabilities. |
| MM5 | Credit: both authors and their institutes as on the poster, and the title "The mutation machine"? | header | as on the poster | open |

## Pass it on (`pass`)

The lab's own outreach story, so the questions are for the owner and whoever checks it for the institute, not for
outside authors. Its globe and cell are the airports and cell map stories' own (their sources are theirs); the fish and
the outbreak are simulations. Contact person: **TO FILL (owner)**.

| # | Item | Where | What the story shows now | Status |
| --- | --- | --- | --- | --- |
| P1 | The German text: written for a 12-year-old ("du"), not a word-for-word translation. Should a German speaker at the institute read it through? | `STR` in `tools/pass/engine/e2_text.js`; the sets' own words (`tools/pass/sets/*.js`) | every word in both languages | open |
| P2 | In German, the cell's protein names and the airports' city and country names stay as in their stories (English; scientific and OpenFlights names); about 35 well-known cities are given in German (Wien, München, Peking ...), and every protein's role is in German (`ROLE_DE`). Translate the rest of the names, or keep them? | `CITY_DE` in `tools/pass/sets/globe.js`; the cell map's `PROTEINS` | English names, said so in the Cell tab's note | open |
| P3 | The credit line: "An outreach story of the Ludwig Boltzmann Institute for Network Medicine (LBI-NetMed)". Is that how the institute wants to be named, and should a person be named? | the first and last chapters' small print | as written | open |
| P4 | The outbreak's numbers (spread chances 0.025 / 0.06 / 0.14 a day, incubation 5 and infectious 7 days in the story) are chosen to look right, not taken from any disease; the story says "a simple model, not a forecast". Enough? | `tools/pass/sets/globe.js` | from Vienna: 47 cities by day 10, 676 by day 20, 1,673 by day 30 | open |
