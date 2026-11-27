# The switch that sticks: 3D sets, data and engine spec

> This is the builder's brief from when the story was made, so it is written in the future tense ("we are adding...", "copy ... and rename").
> It is not how the story is now: the `README.md` beside it (where there is one), the package's `README.md` and
> `docs/agents/stories.md` say that, and where they differ from this file they are right.

A story package of the app (`packages/cdk5/`, v189; written on a fork at v135 as `tools/cdk5/` and `stories/cdk5.js`):
`packages/cdk5/main.js`, built from `packages/cdk5/src/` like the soil story is built from `packages/soil/src/`. It tells the story of **CDK5**, a kinase of neurons, and how it relates to neurodevelopmental and
neurological diseases, from the Menche lab's repository **CDK5_data** (github.com/menchelab/CDK5_data, Christiane
Hütter): its **CDK5_analytics** VR project, six scenes on the whole human interactome made with the lab's cartoGRAPHs.
Everything the story shows comes from there (`CDK5_DATA`, below); nothing else from the repository is needed. Two
builders start from this: **A** builds the `net` set; **B** builds the `core` set and the engine (story, explore,
panels). An integrator adds the story to the app afterwards (`stories/list.js`, `sw.js`, the smoke and shared-room
tests, the station icon, the design room's props, the narration, `AGENTS.md`, `CLAUDE.md`, `HANDOVER.md`, the docs):
builders do not touch those files.

Card (`HOST.list`, for the integrator; `story.json` holds today's): key `cdk5`, kick "Brain kinase", title **The switch that sticks**, colour
`#7bdc4f`, desc "CDK5 is a switch in neurons that two partners turn on. Among 16,376 human proteins, follow it from
healthy signalling to the cut that leaves it stuck on, as in Alzheimer's disease, and into a landscape of diseases
where it sits with disorders of the developing brain.", page "The switch that sticks: CDK5, its network and brain
diseases", brand "The switch that sticks", sub "CDK5, its network and brain diseases", aria "Interactive 3D story of the
kinase CDK5 among the human interactome: its activators, its healthy signalling, how calpain makes it hyperactive, its
pathway in Alzheimer's disease and the diseases its network points to", thing `map`, loading "Placing 16,376 proteins",
icon the integrator's (`lowpoly.js`), len from the narration.

## The rework (v191, the owner, 23 November 2026)

The owner asked to follow the colleague's scene document (scenes 0 to 9), add the three subnetworks the story lacked,
show real protein structures at the small subnetworks in the middle, replace the narration with a new script (one
speaker, the cell as a city and CDK5 as a messenger) and "make it clean and presentation like". This section overrides
the v189 brief (`docs/history/specs/cdk5-superseded.md`) wherever they differ (the two decisions marked *superseded*).

- **Nine scenes** (`CDATA.SCENES`): `bioproc`, `subunits`, `partners`, `ntrk2`, `sema`, `npas4`, `calpain`,
  `alzheimer`, `disease`. `partners` (CDK5's 205 partners as the authors' star, a spring layout), `sema` (Reactome's
  Semaphorin interactions: 56 of its 63 proteins in the map, the piece their links join) and `npas4` (Transcriptional
  regulation by NPAS4: 25 of its 33 and CDK5, with the line the authors drew from CDK5 to NPAS4, which the interactome
  does not have) come from the second project, `CDK5_minimal_new`, decoded by `data/gen_data.py` (its header: the 311
  proteins told apart by their links and scenes; six pairs with the very same links in every scene, `CDATA.ambiguous`,
  may be the other way round, and the About pane says so). The net's moves: into `alzheimer` the wave, into `disease`
  the peel, every other move seeded at random. Pathways lit (`net_path`): 0 NTRK2, 1 the Alzheimer's, 2 Semaphorin
  interactions, 3 NPAS4.
- **Chapters** (`CH`, keys and the scene each ends on): `title` (the map of processes; the search for CDK5),
  `activators` (`subunits`), `partners` (`partners`), `ntrk2`, `sema`, `npas4`, `calpain`, `reach` (still `calpain`: the
  view back to the whole map, CDK5's lines to its partners, towards the side where they crowd; no mechanism named for
  why CDK5 moves), `alzheimer`, `landscape` (`disease`; Parkinson's disease, then cancer lit as Disease Ontology terms)
  and `learn`. Presentation-like: a heading and at most two key points at once (`turns`), small print muted, one thing
  shown at a time, names and structures appearing as the voice says them (their params), what a chapter is not about
  faded or hidden, calm camera moves between lines.
- **Narration**: the script's VOICE lines word for word (`data-say`), one cue per line; a line with no key point of its
  own is a cue mark (`vo`: an empty mark in the panel). Recorded with `node tools/voice/narrate.mjs cdk5` (8:27),
  checked by `node tools/voice/check.mjs cdk5`. `K_T` is 1.
- **Structures** at the centre (`core`, `src/models.json`, built by `tools/mol/build.py` into `packages/cdk5/models/`,
  about 2 MB; fetched once the close-up first shows, a ball standing in until a file arrives; three levels of detail each,
  by size on screen). CDK5 and p35's gripping part (1H4L) share one scale and dock as in the crystal (`core_dock`); the
  rest of p35 (no known shape) is a small ball that the cut takes away (p35 becomes p25); calpain-1's protease core
  (1ZCM); BDNF (1BND, one chain of a BDNF and NT-3 pair); NTRK2's binding domain d5 (1HCF, there with NT-4/5); SEMA4D and
  PLXNB1's first two domains (3OL2); mouse NPAS4 (7XI3); and a Tau filament (5O3L), beside the centre, its line to
  CDK5 the interactome's link (Tau, MAPT, is a partner of CDK5, not in the Alzheimer's pathway's list). p39 has no
  structure: a ball. Not to scale with the map or each other ("close-ups not to scale"); the PDB ids on the About tab.
- **Decided wording**: calpain cuts p35, not CDK5 (the owner answered C2); scene 7 names no mechanism for CDK5's move
  (asked of the author: `docs/questions-for-authors.md`); the NPAS4 scene's tie to the body's clock is "reported, not
  shown here".

## The v189 brief (moved)

The rest of the v189 brief, about 350 lines, is in `docs/history/specs/cdk5-superseded.md`, word for word, under its old
headings: "Decisions", "Look", "The repository, in short", "The data", "The sets" (`net`, `core`), "The engine" and
"Testing" (code comments that say `SPEC.md, "The data"` or `"Look"` mean those). The rework above overrides it
wherever they differ; `packages/cdk5/src/README.md` and `docs/agents/stories.md` say how the story is now.

## A structure for every node of the small subnetworks (waiting; the owner, 25 November 2026)

- **The idea** (the owner): "add proteins for every node in the small subnetworks". **Decided**: "let's wait with this
  one for now".
- **What it would take, when taken up**: most nodes have no full experimental structure, so AlphaFold's predicted ones
  (CC BY 4.0), labelled as predicted, the low-confidence stretches cut or drawn as a thread (Tau and other disordered
  proteins); only the coarsest level, loaded per subnetwork; shown in a subnetwork's close view only, since the layout
  is the authors' and is never laid out again; the nodes counted first; Christiane Hütter (the story's author) asked.
- **Status**: not started (checked 26 November 2026, v212: `packages/cdk5/models/` holds only the nine models of the centre).

### Counted and estimated (25 November 2026; the owner: "count the nodes and estimate the filesize / total triangle count, do not start yet, wait for my go")

Nothing is built. Counted from `CDATA.pathways` (the members) and the scenes; lengths from UniProt (reviewed human
entries, by gene name); sizes scaled from this story's nine models (`models/*.mol`: about 13.4 bytes a triangle over
their three levels, 800 to 1,400 triangles at the coarsest).

| Subnetwork | Proteins | Drawn in its scene | Triangles, coarsest level | Size |
| --- | --- | --- | --- | --- |
| Signalling by NTRK2 | 25 | 25 | 37,000 | 0.5 MB |
| Deregulated CDK5 in Alzheimer's disease models | 22 | 22 | 30,000 | 0.4 MB |
| Semaphorin interactions | 63 | 56 | 108,000 | 1.4 MB |
| Transcriptional regulation by NPAS4 | 33 | 25, and CDK5 | 52,000 | 0.7 MB |
| CDK5, p35, p39, calpain-1 | 4 | 4 | | |
| **Distinct proteins of the small subnetworks** | **135** | about 120 | **217,000** | **2.8 MB** |
| CDK5's 205 partners (the star) | 205 | 205 | 277,000 | 3.6 MB |
| Everything (distinct) | 325 | | 472,000 | 6.2 MB |

- **The rule behind the triangles** (ours, fitted to the nine models; the real builder may come out 30 % either way):
  coarsest level = 800 x (length / 119)^0.4, between 800 and 3,000, so it grows slowly with length. All three levels
  would be about 16 times the coarsest (about 46 MB for the 135): ship the coarsest only.
- **Full-length proteins are far larger than today's cut-out domains**: median 670 amino acids among the 135, eight of
  about 2,000 or more (TLN1 2,541, CREBBP 2,442, PLXNB1 2,135, DOCK3 2,030, MYH14, MYH10, MYH11, TNRC6A). Disordered
  stretches cut or drawn as a thread would lower the count (not subtracted here).
- **On screen**: the Semaphorin scene is the heaviest, 56 structures and about 96,000 triangles at once: within what
  the app draws, but 56 models are more draw calls than any scene has now (instance or merge them; the frame rate in a
  headset to be measured).
- **AlphaFold** splits entries above about 2,700 amino acids into pieces: none of the 135; one of the 205 partners
  (2,752).
- **Names**: ARNTL (now BMAL1) among the 135, and PARK2 (PRKN), HIST4H4, HBA1, HIST1H1C, H1F0, HIST1H1E among the
  partners, did not match UniProt's current gene names: to be matched by hand.
- **Not tried**: `tools/mol/build.py`'s Python setup on a cloud machine, and its reading of AlphaFold's files (it reads
  PDB entries today).

