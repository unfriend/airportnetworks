# Data and permissions

What each story shows, where it comes from, what may not go into the app or the repository, and what still has to be
agreed before anything is shown more widely. The stories' own credits are in [README.md](../README.md) ("Data") and in
each `tools/<story>/README.md`; the open questions on the sources are in
[questions-for-authors.md](questions-for-authors.md). Blanks the owner has to fill are marked **TO FILL (owner)**.

## Rules

They hold for every story, and for anything added later. Ask before you add data or a figure: **TO FILL (owner):** who
decides on data and privacy questions.

| Rule | Why | Written down in |
| --- | --- | --- |
| No patient data and no genetic variants, in any story. | They are personal health data and can identify a person. The app is public and keeps an offline copy on every device that opens it, so nothing shown can be taken back. (The tour's "patient" and its rare variants are invented.) | `AGENTS.md`, `tools/nmd/SPEC.md`, `tools/endo/SPEC.md`, `tools/pet/SPEC.md`, `tools/micro/SPEC.md`, `tools/lbi/SPEC.md` |
| Nothing about zebrafish (muscle and endotype stories). | **TO FILL (owner):** the reason; it is not written down anywhere. | `AGENTS.md`, `tools/nmd/README.md`, `tools/nmd/SPEC.md`, `tools/endo/SPEC.md` |
| Never use the PET authors' `Network_VR` repository or anything from it: never fetch, copy, publish or commit it. | It holds a real patient's CT surface and PET/CT volume. Its ideas (organs as a network in the body, an organ as a network of patches) were redrawn from scratch. | `tools/pet/README.md` |
| The PET poster's patients only as group summaries. | Single points are single patients. (The story no longer shows the poster's population; its readings stay in `figures.json`, unused.) | `tools/pet/data/figures.json` |
| Never the GTEx slide images: slides, sections and tiles are drawn. No GTEx sample or donor ids and no donor details either: the tissue topology story numbers its slides. | They are images and records of real donors' tissue; the stories need only the preprint's and the posters' numbers (and, for the tissue topology story, the cells' positions and types). | `tools/micro/SPEC.md`, `tools/micro/README.md`, `tools/ovary/SPEC.md`, `tools/topo/SPEC.md`, `tools/topo/README.md` |
| Inputs kept out of the repository stay out; only the numbers a story needs go in (`tools/<story>/sets/data.js`). | They are the authors' unpublished work, shared for this app. A pickle (the endotype run) can run code, so its generator only unpickles the classes it expects. | headers of `tools/endo/data/gen_data.py`, `tools/micro/data/gen_data.mjs` and `tools/topo/data/gen_data.py` |
| topocyte (GPL-3) is only run, offline, to make the tissue topology story's numbers; none of its code goes into the app or the repository. | Its code copied into the app would bring the GPL's terms with it. The app only looks up the numbers it wrote. | header of `tools/topo/data/gen_data.py`, `tools/topo/SPEC.md` |
| Say "in this map" for statistics computed on the curated sets. | The sets are small and chosen by hand: their statistics are not facts about the whole interactome. | `AGENTS.md` ("Conventions") |
| Only well-documented interactions and locations (complexes, textbook pathways, Human Protein Atlas / UniProt). | The content is illustrative but must be correct. | `AGENTS.md` ("Conventions") |
| A stand-in is called a stand-in in the story itself. | So that nobody quotes it as a result. | each story's `SPEC.md` and `README.md` |
| Headset logs (`relay/logs/`) never go into the repository. | File names and contents hold people's first names and room codes. | `.gitignore`, [relay/README.md](../relay/README.md) ("Logs") |
| A shared room without a relay runs peer to peer, and then third parties see each device's IP address (below). Agreed by the owner on 28 October 2026. Rooms on this network (29 October 2026) use a 24-bit hash of the network's address, never the address itself (below). | The devices are introduced by PeerJS's public server and learn their own addresses from Cloudflare's STUN server; then they talk to each other directly. | `AGENTS.md` ("Shared rooms"), [event-runbook.md](event-runbook.md) |

## Story by story

### What each story shows

| Story | Shows | Source, as the repository cites it | Real, read off a figure, or stand-in |
| --- | --- | --- | --- |
| Airports (`airports`) | 3,214 airports, 18,858 routes on a globe | OpenFlights.org routes, 2014 snapshot; Natural Earth coastlines (credit line in `stories/airports.js`) | real; statistics computed with NetworkX on the full graph |
| Proteins (`proteins`) | 254 proteins, 375 interactions | hand-curated from the literature (complexes, pathways); essential genes after DepMap common essentials; NetworkX (Louvain modules, betweenness) | curated, illustrative subnetwork ("in this map") |
| Cell map (`spatial`) | 249 proteins in 13 compartments (282 copies), 252 interactions, seven moves | places after the Human Protein Atlas and UniProt; interactions from the literature | curated; the cell model and the layout are illustrative, built at load time |
| Tour (`lbi`) | ten 3D scenes after the LBI's welcome talk | the proteins story's 254 proteins; the airports story's airport positions; Guthrie et al., Science Advances 2023 (the Sankey's totals); further credits in each scene's panel (`tools/lbi/engine/e3_story.js`) | mostly illustrative: the other proteins of the interactome, the friendship ties, disease modules, the patient, the organ network, the stomach section |
| Muscle and heart (`nmd`) | 13 disease groups, 1,182 genes, 71 layers, 15,246 protein links | ISMB 2026 talk (Iker Núñez-Carpintero, Philipp Friedrich, Julia Guthrie, Jörg Menche) and their analysis files in `ikerdata/`: the 2024 Gene Table of Neuromuscular Disorders, IID interactions, GO, HPO and KEGG terms | real: groups, genes, endotypes, links. Stand-ins until the authors send theirs: layer z-scores, walk visits, endotype names. 33 layers have no links yet. Motor unit and supercomputer illustrative |
| Endotypes (`endo`) | 35 genes of congenital myasthenic syndromes in a network of 18,306 proteins (316,613 links), a module of 393 genes, 12 endotypes | ISMB 2026 poster "Introducing EndotypY" (Chloé Bûcheron, Iker Núñez-Carpintero, Enes Sakalli, Mathilde Meyenberg, Julia Guthrie, Jörg Menche) and their EndotypY run | real: network, seeds, module, endotypes. Re-run with the package's defaults: the steps before the endotypes; the tree is drawn to agree. Endotype names are the story's own. The synapse is illustrative |
| PET (`pet`) | the organs and networks of 658 whole-body scans, from health to disease | Geist et al., Med 6, 100881 (2025); poster "Shaping a New Era in Nuclear Medicine"; vision slide "One Scan, One System" | printed: Tables 1 to 3 and Figure 2A's matrices (typed in). Read off: Figures 3 and 4 (`tools/pet/data/figures.json`, each read twice; it also holds readings of the poster's plots, no longer used). Stand-ins, said so: typical organ uptakes, a synthetic cohort. Scanner, body and liver illustrative. The poster's one-scan network and results were taken out in October 2026 (they did not match the poster) |
| Microanatomy (`micro`) | GTEx slides of 40 tissues, 218 domains, how they change with age; the network of organ architecture | preprint Buljan, Bago-Horvath, Rendeiro, bioRxiv 2025, doi 10.1101/2025.10.13.682110; its poster and talk; Iva Buljan's network | typed in: the preprint's numbers. Read off: the talk's figures (`tools/micro/data/figures.json`). Real: the network (29 organs, 24 tissues, 10 tissue types, 70 domains). Drawn: slides, sections, tiles. Pictures without numbers behind them are illustrative |
| Ovarian aging (`ovary`) | 255 GTEx donors' ovaries; four kinds of object (and cysts), two methods and their scores, the trends with age, the methods compared | the poster "Mapping the histological landscape of human ovarian aging" (Parijat Chakraborty, Samir Moustafa, André Rendeiro; LBI Network Medicine, CeMM, Faculty of Computer Science of the University of Vienna; supported by CeMM and the ERC; data GTEx): public, and the owner confirmed on 2026-10-22 that it may be used | typed in: the poster's numbers (`tools/ovary/sets/data.js`). Read off: the trend lines, bands, shares at zero and comparison lines (`tools/ovary/data/figures.json`, two readers, reconciled; disagreements decided by a third reading); the story uses the lines, the shares at zero and the comparison lines' slopes (the bands and axes are kept there, unused). Approximate: the count tags on the ovary (each method's line read off the figures) and "the segmentation finds fewer" (from the read slopes), both said so in the story. Illustrative: the spatial neighbor network (the poster's next step). No dots: the charts and their illustrative cohort went in October 2026; the data keeps only the donors' ages, filling the histogram's bars, for its slides. Drawn: the ovary, the slides and the sections (no GTEx image and no picture from the poster) |
| Qubits (`qubits`) | example gene networks (320 genes in 8 hidden groups at three strengths of mixing, and a random one) cut into 8 cells on 3 qubits; the coarse operator, its Pauli strings, the toolbox (so(6), so(7)) and the residual; the real run's residual by depth and its 3-qubit circuit | the method and figures of Joel Hancock: his brief for this visualization ("Prompt: visualize network compression and the Pauli decomposition", 21 Oct 2026), his figure of Pauli strings on a cube, his 3-qubit card and notes on the runs (none in the repository) | computed in the page: everything about the example networks (`tools/qubits/sets/qmath.js`). Typed in from the brief, shown only as "in the real network": the run's summary numbers on STRING v12.5 (16,064 genes; 8 bits, 256 cells; 61 % on cube edges; the 3-bit weights; so(7) 66 % and 73 %; the residual by depth, ours and random; the circuit's angles) in `tools/qubits/sets/data.js`. No STRING data, no gene names, no data term D. Stand-ins, said so: the cut (for the authors' beam search) and the walkers' valleys |
| The mutation machine (`mutation`) | a text in four letters copied with swaps; a family tree in 3D; a letter's two qubits and their read-outs; a rule of change and its path through the pyramid of mixes; the machine (the circuit) for one branch; an RNA stem, its pairs and their coupling; the ancestor of three species rebuilt three ways | the poster "Converting Mutation into a Machinery: DNA Substitution Models as Quantum Circuits" by Enes Berk Sakalli (Ludwig Boltzmann Institute for Network Medicine at the University of Vienna) and Arndt von Haeseler (CIBIV, Max Perutz Labs, University of Vienna and Medical University of Vienna), a draft of 26 Oct 2026 (not in the repository), and the first author's answers of 27 Oct 2026; the poster's six references, shortened, in the last chapter | computed in the page from example numbers, as in the authors' own test (`tools/mutation/sets/mmath.js`): the rules of change and their paths, the circuit's angles, the family trees and their swaps, the ancestors rebuilt in "this example". Typed in from the poster, shown only as "in the authors' test": Figure 1's sequences, Figure 5's stems (three species, the true ancestor, one rebuilt per method) and the shares of 2,000 rebuilt ancestors with all six pairs intact (10 %, 43 %, 20 %), in `tools/mutation/sets/data.js`. Stand-in, said so: the coupling computed live (our picture of the authors' coupled circuit). The test is synthetic: no patient data. The poster's figures are redrawn in 3D; its pictures are never shown |
| The shape of tissue (`topo`) | the poster's patch (110 real cells of a healthy liver) with its balls, network with triangles, pieces, loops and tower of scales; 123 GTEx liver slides (66 healthy, 57 with cirrhosis, 30.8 million cells), their curves, main shapes, scores, classifier, held-out test and weight for every radius; a healthy tile (945 cells) and a new slide's window (6,716 cells) with every cell scored | the poster "topocyte: scale-resolved topological phenotyping of tissue architecture across spatial modalities" by Simon Schindler, André Rendeiro and Jörg Menche (Ludwig Boltzmann Institute for Network Medicine at the University of Vienna; University of Vienna; CeMM; Medical University of Vienna; Max Perutz Labs), shown at the Evaluation of the LBI for Network Medicine 2026, and the package's documentation (topocyte.lab.lbi-netmed.com); the authors' GTEx liver cohort (cells found by HistoPLUS, CC BY 4.0), their package topocyte and the poster's figure scripts | real: every number, computed by topocyte and the figure scripts on the authors' data (`tools/topo/sets/data.js`, all the poster's numbers reproduced); the cells' positions and types are real, their H&E look is drawn from them. Sketches, said so: the genes and proteins of the last chapter. Illustrative: the tour's body and the microanatomy story's liver model |
| Pass it on (`pass`) | a school of fish; the airports' globe with an outbreak on its routes; the cell map's cell, its NF-κB relay and CFTR in the wrong place | the airports story's data (OpenFlights.org routes, 2014 snapshot; Natural Earth coastlines) and the cell map story's lists (Human Protein Atlas and UniProt places; the literature), taken unchanged from `stories/airports.js` and `stories/spatial.js` at build time; schooling after Rosenthal et al., PNAS 2015 and Handegard et al., Current Biology 2012 | real: the airports, routes, proteins and places, as in their stories. The fish: a live simulation, not data. The outbreak: a seeded S/E/I/R model on the real route network, said to be a simple model, not a forecast (every route counts the same, an airport stands for its city, no real disease's numbers) |
| Flock (`flock`) | 200 starlings | after Ballerini et al., PNAS 2008; Procaccini et al., Animal Behaviour 2011; Cavagna et al., PNAS 2010 | a live simulation, not data |
| Robot gang (`robots`) | 6 to 24 robot vacuums | after Olfati-Saber, Fax and Murray, Proceedings of the IEEE 2007 | a live simulation, not data; speeds tuned to look right |

### Rebuilding and rights

After regenerating a story's data, rebuild it (`node tools/<story>/build.mjs`, then `--check`), bump `VERSION` in
`sw.js` and run the smoke test ([AGENTS.md](../AGENTS.md), "Testing"). Never edit a `sets/data.js` by hand.

| Story | Regenerate the data | Inputs not in the repository | Licence or terms, where the repository states one | Permission to show publicly |
| --- | --- | --- | --- | --- |
| `airports` | not possible: the data is embedded in `stories/airports.js` (`NET_B64`) and its generator is not in the repository (`tools/lbi/data/extract_airports.mjs` only reads it back out) | the OpenFlights files and the conversion script | routes: Open Database License (ODbL); coastlines: public domain | by those licences, with their conditions (see "Licence"); the narration recording: see the record below |
| `proteins` | not possible: hand-edited data block `PPI` in `stories/proteins.js` | the curation notes, if any | none stated | see the record below |
| `spatial` | edit `PLACES`, `PROTEINS`, `LINKS`, `TOGETHER`, `MOVES` in `stories/spatial.js`; the layout is made at load | the curation notes, if any | none stated (Human Protein Atlas, UniProt) | see the record below |
| `lbi` | `node tools/lbi/data/extract_proteins.mjs`, then `node tools/lbi/data/gen_int.mjs` | the welcome talk | the airport lights: ODbL, as above | see the record below |
| `nmd` | `node tools/nmd/data/gen_data.mjs` (reads `ikerdata/`, about a minute) | the talk's slides (`ikerdata/` itself is committed) | none stated | see the record below |
| `endo` | `python -I tools/endo/data/gen_data.py run.pkl seeds.xlsx` (Python 3.11+ with EndotypY; downloads Enrichr libraries) | `run.pkl`, `seeds.xlsx`, the poster | EndotypY package: MIT (`tools/endo/SPEC.md`); the run: none stated | see the record below |
| `pet` | `node tools/pet/data/gen_data.mjs` | the poster, the vision slide (and `Network_VR`, never to be used) | paper: CC BY 4.0 (credited in the story); poster: none stated | see the record below |
| `micro` | `node tools/micro/data/gen_data.mjs <graphml>` | the GraphML, the poster, the talk | preprint: CC BY-NC; poster, talk, network: none stated | see the record below |
| `ovary` | `node tools/ovary/data/gen_data.mjs` (from the typed-in numbers in it and `tools/ovary/data/figures.json`) | the poster and the crops of its figures that were read (kept out of the repository) | none stated; the poster is public, used with the owner's OK of 2026-10-22 | see the record below |
| `qubits` | nothing to regenerate: the example networks are computed in the page; the real run's numbers are typed into `tools/qubits/sets/data.js` (by hand, from the brief: its header says where each comes from) | the brief, the figures and the notes (Joel Hancock) | none stated | see the record below |
| `mutation` | nothing to regenerate: the examples are computed in the page; the poster's numbers are typed into `tools/mutation/sets/data.js` (by hand, from the poster and the first author's answers: its header says where each comes from) | the poster (a draft) | none stated | see the record below |
| `topo` | `python -I tools/topo/data/gen_data.py cells.h5ad fig1/` (Python 3.10+ with topocyte, topocyte_data, gudhi and the rest; about 14 GB of memory, about 30 minutes the first time; see [setup-and-release.md](setup-and-release.md)), then `node tools/topo/test-data.mjs` | the cohort's cells (`cells.h5ad`), the poster's figure project (`fig1/`), the topocyte and topocyte_data checkouts, the poster | the cells (HistoPLUS on GTEx slides): CC BY 4.0; topocyte: GPL-3 (run offline only, none of its code in the repository); the poster: none stated | see the record below |
| `pass` | nothing of its own: rebuild it (`node tools/pass/build.mjs`) after the airports or cell map story changes, and it takes their data again | as for `airports` and `spatial` | routes: ODbL; coastlines: public domain (as `airports`); the cell: as `spatial` | as for `airports` and `spatial`; the German text is the project's own |
| `flock` | nothing to regenerate | none | the project's own code | no third-party data |
| `robots` | nothing to regenerate | none | the project's own code | no third-party data |

### Record of permissions

**TO FILL (owner):** one row per source: who agreed (name, role), when and how (meeting, message), whether public
hosting is allowed, any embargo or condition, and the scientific contact for questions. Nothing about this is
written down in the repository yet.

| Story | Material | Agreed by | When, how | Public hosting | Conditions, embargo | Scientific contact |
| --- | --- | --- | --- | --- | --- | --- |
| `airports` | the narration recording (`audio/narration.mp3`): the speaker | | | | | |
| `proteins`, `spatial` | the project's own curation of published facts: is anyone's agreement needed? | | | | | |
| `lbi` | the LBI welcome talk | | | | | |
| `nmd` | the ISMB 2026 talk; the files in `ikerdata/` (public in the repository already) | | | | | |
| `endo` | the ISMB 2026 poster; the numbers from the authors' EndotypY run | | | | | |
| `pet` | the poster and the vision slide (the paper is CC BY 4.0) | | | | | |
| `micro` | the poster, the talk, Iva Buljan's network (the preprint is CC BY-NC) | | | | | |
| `ovary` | the poster "Mapping the histological landscape of human ovarian aging" (public) | the project's owner (the poster is public) | 2026-10-22, in the brief for this story | yes: a public poster | values read off its figures and the illustrative network are said to be so | **TO FILL (owner)** |
| `qubits` | Joel Hancock's brief, figures and the real run's summary numbers (STRING itself is CC BY 4.0) | | | | | |
| `mutation` | the poster "Converting Mutation into a Machinery: DNA Substitution Models as Quantum Circuits" (a draft) and its first author's answers | | | | | |
| `topo` | the poster; the authors' cohort data and code, shared for this story (the cells are CC BY 4.0, topocyte GPL-3) | the poster's authors (T1, T2 in [questions-for-authors.md](questions-for-authors.md)) | by 28 Oct 2026; **TO FILL (owner):** how | **TO FILL (owner)** | only derived numbers in the repository; no slide ids, donor details or images; topocyte run offline only | **TO FILL (owner)** |
| `pass` | the LBI's name as the outreach story's author; its German text (who checked it) | | | | | |

## Inputs not in the repository

| Input | Story | Read by | Held by | Kept where | Without it |
| --- | --- | --- | --- | --- | --- |
| `network_with_tissue_types_hierarchical.graphml` (Iva Buljan's network of organ architecture) | `micro` | `tools/micro/data/gen_data.mjs <graphml>` | Iva Buljan | **TO FILL (owner)** | The story still builds from the committed `tools/micro/sets/data.js`, but nothing in it can be regenerated: the generator needs this file even to apply a change to the typed-in numbers or to `figures.json`. |
| `run.pkl` (the authors' saved EndotypY run: network, 35 seeds, 12 endotypes) | `endo` | `tools/endo/data/gen_data.py` | the endotype poster's authors | **TO FILL (owner)** | The story still builds; `ENDO_DATA` cannot be regenerated. |
| `seeds.xlsx` (the Gene Table's genes of congenital myasthenic syndromes) | `endo` | `tools/endo/data/gen_data.py` | the endotype poster's authors | **TO FILL (owner)** | As above. |
| Enrichr libraries `GO_Cellular_Component_2026`, `Jensen_COMPARTMENTS` | `endo` | `tools/endo/data/gen_data.py` downloads them | public (Enrichr) | downloaded at each run | The generator needs a network connection; a newer library may give other numbers. |
| Joel Hancock's brief for the visualization, his figures (the Pauli strings on a cube, the 3-qubit card) and his notes on the runs | `qubits` | read by hand; the real run's numbers are typed into `tools/qubits/sets/data.js` | Joel Hancock | **TO FILL (owner)** | The story is unaffected (its example networks are computed in the page); you cannot re-check a typed-in number. |
| The poster "Converting Mutation into a Machinery: DNA Substitution Models as Quantum Circuits" (a draft of 26 Oct 2026) and Enes Berk Sakalli's answers to our questions | `mutation` | read by hand; its numbers are typed into `tools/mutation/sets/data.js` | Enes Berk Sakalli, Arndt von Haeseler | **TO FILL (owner)** | The story still builds from the committed `tools/mutation/sets/data.js`; a later version of the poster could not be checked against the draft. |
| The authors' GTEx liver cohort (`cells.h5ad`: HistoPLUS centroids and cell types of 594 GTEx liver slides, CC BY 4.0, of which the 123 labelled healthy or cirrhosis are read), the poster's figure project (`fig1/`: `real.py`, `simplify.py`), checkouts of topocyte and topocyte_data, and the poster | `topo` | `tools/topo/data/gen_data.py` | the poster's authors (Simon Schindler, André Rendeiro, Jörg Menche) | **TO FILL (owner)** | The story still builds from the committed `tools/topo/sets/data.js`; `TOPO_DATA` cannot be regenerated, and no number in it can be checked again. |
| `Network_VR` (the PET authors' VR viewer, with a patient's scan) | `pet` | nothing, ever | the PET authors | not needed: never fetch or copy it | Nothing: it is not used. |
| The posters, talks and slides behind the stories (muscle talk, endotype poster, PET poster and vision slide, microanatomy poster and talk, the LBI welcome talk) | `nmd`, `endo`, `pet`, `micro`, `lbi` | read by hand; the readings are in `tools/*/data/figures.json` and the story specs | their authors | Google Drive folders the owner shared: ask the owner for the link | The stories are unaffected; you cannot re-check a reading or answer a question about a figure. |
| The OpenFlights 2014 files and the script that made `NET_B64` | `airports`, `lbi` | not in the repository | OpenFlights (public); script: **TO FILL (owner):** whether it still exists and where | | The routes cannot be updated or rebuilt. |
| Curation notes for the proteins and the cell map (which paper backs each interaction and place) | `proteins`, `spatial`, `lbi` | not in the repository | **TO FILL (owner):** whether such notes exist, and who has them | | An interaction cannot be traced to its source except by searching the literature again. |

The two published sources need nothing private: the PET paper (doi 10.1016/j.medj.2025.100881) and the microanatomy
preprint (doi 10.1101/2025.10.13.682110).

## Before the repository or the site is public

**Both are public already.** Checked on 22 October 2026: GitHub reports `unfriend/airportnetworks` as public, and
GitHub Pages serves it at `https://unfriend.github.io/airportnetworks/` with the same version as `main`
(`networks-v64`; nine stories, the microanatomy story is not on `main` yet). GitHub Pages serves every file of the
branch, not only the app: a file of `ikerdata/` downloads from the site. (The relay serves only the app's own files,
see `APP_FILES` in `relay/server.mjs`; the Docker image leaves out `ikerdata/`, `tools/`, `docs/` and the logs, see
`.dockerignore`.) So check these now; each is the owner's decision. Deleting branches or rewriting history cannot be
undone for clones and forks made before (GitHub showed no forks on 22 October 2026).

- [ ] **Log branches.** `logs-2026-10-17`, `logs-2026-10-19`, `logs-2026-10-20`, `logs-2026-10-20-new`,
  `logs-2026-10-20-new2`, `logs-2026-10-20-new3` and `logs-2026-10-20-new4` hold `relay/logs/*.jsonl`. Their file
  names and contents include people's first names and room codes. Keep a copy where the team keeps such logs
  (**TO FILL (owner):** where), then delete the branches on GitHub. [relay/README.md](../relay/README.md) ("Logs")
  already says never to push logs to a public repository: keep to that.
- [ ] **`ikerdata/`.** 17 TSV files, 88 MB, the muscle story's authors' analysis files, committed in full (commit
  `4d7aacc`, 16 October 2026) and downloadable from the site. Get the authors' agreement (record above), or remove
  the folder from the published branch and from the history. The generator reads it at `ikerdata/`, so whoever
  regenerates the muscle story needs a copy there.
- [ ] **Screenshots in the history.** `tools/micro/shots/*.png` were committed in `d7c7862`, `e548fa0` and `e3f6b4f`
  and removed in `bdc8a8e`. They show drawn content only. Decide whether to leave them.
- [ ] **Ignored folders stay ignored**: `relay/logs/` (names, room codes) and `relay/.lan/` (the relay's certificate
  and private key) in `.gitignore` and `.dockerignore`; `tools/*/shots/` in `.gitignore`.
- [ ] **No kept-out input in any branch.** On 22 October 2026 no GraphML, `.pkl`, `.xlsx` or `Network_VR` file was in
  the history of any branch. To check again (reads only):
  `git log --all --name-only --format= | grep -i -E 'graphml|\.pkl$|\.xlsx$|network_vr' | sort -u`
- [ ] **The microanatomy story** goes onto the site when `main` is next moved forward; its sources are already public
  on the work branch. Have its authors' agreement first.
- [ ] **The authors' permissions** recorded for `lbi`, `nmd`, `endo`, `pet` and `micro` (record above).
- [ ] **The narration's speaker** agreed to `audio/narration.mp3` being published (record above).
- [ ] **A project licence** (below).
- [ ] **The web font.** `index.html` loads B612 from Google Fonts, so every visitor's browser contacts Google's
  servers. Decide whether that is acceptable for an Institute site, or serve the font with the app.

### Who sees what in a peer-to-peer room

A shared room that runs without a relay (the copy on GitHub Pages, or a relay that cannot be reached) runs peer to
peer. The owner agreed on 28 October 2026 that these see each device's IP address:

- **PeerJS's public introduction server** (`0.peerjs.com`, run by the PeerJS project): every device in such a room
  connects to it to be introduced to the others. It sees the device's IP address, the room's id there
  (`lbinet-<format>-<room code>`, for example `lbinet-networks-23-ABC`) and a random id for each guest, and passes on
  the offers and network candidates the devices swap to link up (these hold their local and public addresses). It
  never sees what the room holds: stations, names, positions and effects go over the direct links. A link with
  `&peer=` uses another server instead, such as the relay's own (`/peerjs`), and `&peer=off` turns peer to peer off.
- **Cloudflare's STUN server** (`stun.cloudflare.com:3478`): each device asks it for its public address once a link
  is made. It sees the device's IP address and nothing else.
- **The other devices in the room**: they link to each other directly and so see each other's IP addresses (on a
  local network the local ones). Everything a room shares goes between them: names and colours, the stations, where
  each headset is and points, the clock and the stories' controls, as with a relay.

There is no TURN server (nothing relays the traffic): devices on networks that block direct links cannot meet. The
owner brings a router for events.

### Rooms on this network: the network id

To list the rooms on a device's network and to join a room again by itself (AGENTS.md "Shared rooms"), the app works
out a **network id**: the first 6 hex digits (24 bits) of SHA-256 of a fixed salt and the network's address (a public
address as it is; a private one by its /24; IPv6 by its /64). One id stands for about 256 public addresses, so it does
not name an address; but anyone who knows an address can work out its id, so it is a convenience, not a secret.

- **No address is kept.** With a relay, the relay hashes the address it sees for each request and socket and keeps
  only the ids, in memory, with the rooms (gone when a room expires or the relay restarts); no answer holds an address (a
  device is told only its own id), and no log line holds an address or an id (a slot's id shows with `******` in the
  log). Behind a reverse proxy it reads the
  address from `X-Forwarded-For` only when started with `--proxy`.
- **Without a relay** the page asks Cloudflare's STUN server for its public address (as in a peer-to-peer room
  above), hashes it at once and forgets it. It asks only when the Shared dialog or the headset's menu lists rooms,
  when a room is joined, or when the app opens with a room used in the last week.
- **On the device**, the id is kept with each of the 8 rooms it keeps (`localStorage`, `collabRoom.<code>`), with when
  it was last used.
- **Peer to peer**, a room's host holds a slot named after the id on the introduction server
  (`lbinet-near-<format>-<id>-<0..7>`, PeerJS's public one by default) while the room is shown on its network, and
  tells whoever asks there its code, its name, how many people and stations; *Show on this network: off* (a switch
  per room) takes it off. On a big shared network (eduroam, a campus, a conference's Wi-Fi) strangers share the address,
  so they may see such a room listed; nobody joins a room by itself that it was never in.

## Licence

**The project has no licence.** There is no `LICENSE` file, and GitHub reports none, so nobody else has a clear right
to reuse, copy or change the code. **TO FILL (owner):** choose a licence (with the Institute if it owns the work), add
`LICENSE` at the root and mention it in `README.md` and `README.txt`. The data in the stories keeps its own terms
whatever licence the code gets, so the content may need a different licence from the code.

Third-party material:

| What | Where | Licence or terms |
| --- | --- | --- |
| three.js r128 | `three.min.js` | MIT; the notice is `three.LICENSE.txt` and must ship with it |
| PeerJS 1.5.5 | `peerjs.min.js` (loaded only for a peer-to-peer room) | MIT; the notice is `PEERJS-LICENSE.txt` and must ship with it |
| B612 font | loaded from Google Fonts (`index.html`), cached by `sw.js` | Google Fonts lists it under the SIL Open Font License; the repository does not say so |
| App icons | `icons/` | **TO FILL (owner):** who made them, and on what terms |
| OpenFlights routes, 2014 | embedded in `stories/airports.js`; positions reused in `stories/lbi.js` | ODbL: credit OpenFlights (the story does), and a database adapted from it and used in public, such as the embedded routes, has to be offered under the ODbL too. Check how this fits the project licence |
| Natural Earth coastlines | `stories/airports.js` | public domain |
| Geist et al., Med 2025 | `tools/pet/` | CC BY 4.0: credit the authors (the story does) |
| Buljan et al., bioRxiv 2025 | `tools/micro/` | CC BY-NC: credit, and no commercial use |
| EndotypY | used by `tools/endo/data/gen_data.py` only, not shipped | MIT |
| Kokoro-82M v1.0 (hexgrad), its American voice `af_heart` | the tour's narration, `audio/narration-lbi.mp3`, made by `tools/voice/` (the model is not shipped) | Apache-2.0: the recordings it makes are ours to use; no speaker to ask. The story's credits say the narration is a synthetic voice (Kokoro). kokoro-onnx (MIT), espeak-ng and phonemizer (GPL-3) only run offline to make it: nothing of them ships |
