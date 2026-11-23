# The switch that sticks: 3D sets, data and engine spec

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

## The rework (v190, the owner, 23 November 2026)

The owner asked to follow the colleague's scene document (scenes 0 to 9), add the three subnetworks the story lacked,
show real protein structures at the small subnetworks in the middle, replace the narration with a new script (one
speaker, the cell as a city and CDK5 as a messenger) and "make it clean and presentation like". This section overrides
the v189 brief below wherever they differ (the two decisions marked *superseded*).

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

## Decisions (the owner's, 18 November 2026)

- *Superseded at v190 (above).* **The analytics project only**: its six scenes (below), on the whole interactome. The repository's seven-scene
  standalone project (`CDK5_minimal_new`: the Semaphorin and NPAS4 pathways, the 205-partner star) is **not** used.
- *Superseded at v190 for the structures at the centre (above).* **Networks only**: nothing drawn beyond the networks and their numbers (no neuron, no molecules, no cell). Explain the
  biology in words; the networks carry the pictures.
- **Take the data, the scene descriptions and the data representations from the repository**: its layouts (the
  sphere of processes, the scenes' centres, the disease landscape), its colours (CDK5 green, hyperactive red, NTRK2 cyan,
  calpain yellow, Alzheimer's orange, the palettes by degree), its links per scene. They are all in `CDK5_DATA`, decoded
  from the authors' own textures, exactly. Our additions are labelled: the close-ups at the centre (the `core` set: its
  balls, tubes and names are a clearer drawing of the scene's centre proteins, at the authors' relative places, scaled
  up), tags with numbers, and the over-representation counts the generator computes (`CDK5_DATA.diseases`).
- Permission: the repository is the lab's own (the owner's group), public on GitHub; only derived numbers go into ours.
- **British spelling**, English only. Plain words for a lay audience; the technical layer in small print.

Words: "protein" (gene symbols as names; small print: Entrez genes), "partners" (proteins it is known to bind: the
interactome's links; small print: protein-protein interactions), "the map" or "the map of processes" (the sphere:
proteins placed by the Gene Ontology biological processes they take part in), "the disease landscape" (proteins placed
by the Disease Ontology diseases they are linked to), "kinase" (an enzyme that adds phosphate to other proteins,
switching them on or off), "p35" and "p39" (small print: CDK5R1, CDK5R2), "p25" (the piece of p35 calpain leaves),
"calpain" (CAPN1, a calcium-switched enzyme that cuts proteins), "hyperactive", "NTRK2" (the receptor of the growth
factor BDNF; small print: TrkB), "pathway" (small print: Reactome).

**The rules for sets are the tour's**: `packages/lbi/src/SPEC.md` from the top down to "Palette and look", and
`tools/engine/kit.js`, with these differences (as the soil story's, `packages/soil/src/SPEC.md`):
- Set files live in `packages/cdk5/src/sets/`; the harness is `packages/cdk5/src/harness.html`
  (`?set=<name>&p=k:v,...&t=..&cam=<view or six numbers>&anim=1&with=<second set>`) and the screenshot tool
  `packages/cdk5/src/shot.mjs` (run it from `packages/cdk5/src`; `SHOTS=<dir>` and `PORT=<port>`). The harness always loads
  `CDK5_DATA`, `CDATA`, `CLOOK` and `TLOOK`. Use `&with=core` (or `&with=net`) to see both sets in one frame.
- Shared globals before the sets (the build pastes them inside the story's closure in this order): `CDK5_DATA`
  (`sets/data.js`, generated: never edit), `CDATA` (`sets/cdata.js`: decoders and lookups, no science; **read its
  header**, it is the data's API), `CLOOK` (`sets/look.js`: the story's palette), `TLOOK` (`packages/topo/src/sets/look.js`,
  **unchanged**: lit instanced tubes, rings, balls, boxes, halos, cones, glass; read its header), then this story's sets:
  `net`, `core`.
- **Copied and adapted** (not included): the soil story's `net` set (`packages/soil/src/sets/net.js`, itself from the endotype
  story's) for its points, cloud shader, links, picking and labels (builder A); the soil story's engine
  (`packages/soil/src/engine/`) for the engine (builder B).
- Labels may have `text` as a function returning `[bold, rest]` (re-read while the label shows). **Step params**
  (integers, never eased) are listed in each manifest and in the engine's `STEP`. A set may export `api()` (picking,
  lookups) and `finish()` if it builds in slices.
- Budget per set: build under 400 ms in headless Chromium (software GL; the net set decodes 16,376 places and may take
  its first layouts from `CDATA`, which caches them), at most 20 draw calls and 150k triangles at any moment, no
  allocation per frame in `update` (refill pools). Seeking must work: what a set shows depends only on its params and
  `t`. A Quest draws this at 72 fps: 16,376 points and a few thousand line segments are fine; never all 309,355 links.
- Each set gets a manifest `sets/<name>.md` (params, keyframes it expects, anchors, labels, views, explore, cost).

## Look

The app's dark, glowing 3D. The authors' colours (`CLOOK.C`, `CDATA.col`, `CDATA.pal`):
- **The map's proteins**: those with a GO process by the authors' palette by degree (`CDATA.pal.go`: dark green for the
  least linked to pale yellow for the hubs, alpha 100/255), the others grey (`col.grey`, alpha 50/255): **use
  `CDATA.colours(k)`**, which gives every protein's RGBA in scene k exactly as the authors' texture holds it. Alpha
  becomes brightness (additive points) or size, not see-through layers.
- **The landscape's proteins**: those with a disease by `CDATA.pal.dz` (dark red for the least linked to pale yellow),
  the others grey (`col.greyD`).
- **CDK5**: bright green `#2aff00` while it works normally (chapters 1 to 4), red `#ff2a1a` once hyperactive (chapters
  5 to 8; the authors' red, 255 0 0, softened a touch so it glows). Its activators p35 and p39 in the close-up light
  green `#9be07a`; NTRK2's pathway cyan `#00fff0`; calpain yellow `#ffff00`; the Alzheimer's pathway orange `#ffa500`.
- **Links**: the map's green (`col.greenL`), the highlighted ones bright green (`col.green`), NTRK2's cyan, the
  Alzheimer's pathway's orange (`col.orange`), the landscape's orange (`col.orangeL`): each scene's link classes come
  with their colour (`CDATA.scene(k).links[].rgba`).
- Explore's own highlights: a picked protein and its partners the app's cyan `#46d9ff` (partners `#bfefff`); a disease
  term's proteins magenta `#ff5ad9`.
- Labels as the other stories' (`cls` `''`, `cyn`, `amb`, `grn`, `mag`; `CLOOK.CLS` suggests which).

Frames (y up, the story faces +z): `net` and `core` share one frame (`FRAME = { core: 'net' }`), the map centred on
the origin: the sphere of processes at radius about 1 (proteins with a GO process at 0.82 to 1.08, the others on an
outer shell at 1.2), each scene's centre proteins within radius 0.42 of the origin (`CDATA.CENTRE_R`), the disease
landscape's 6,538 proteins with a disease gathered round about (0, 0.16, 0.34) (median radius 0.27, a few outliers to
1) and the 9,838 without one on a sphere of radius 1.2 round that middle (`CDATA.layout('disease')`; checked by builder
A, who targets the landscape's views at the bulk). On a screen the default view sees the whole sphere; in a headset 1 unit is
about 0.5 m at the default size (the map about 1.2 m across, floating in front of you), and "Stand inside" puts you at
its middle, the sphere about 2.5 m round you (below).

## The repository, in short (what the story tells)

The README and the notebook (`CDK5_BioStory_NEW.ipynb`) say: CDK5 is a cyclin-dependent kinase primarily expressed in
neurons. It is activated by binding to regulatory subunits (p35, p39: not cyclins) and takes part in neurite outgrowth,
synapse formation and neurotransmitter release. Dysregulation of CDK5 is implicated in neurological disorders:
overactivation is linked to neurodegenerative diseases like Alzheimer's and Parkinson's, while reduced activity is
linked to intellectual disability and impaired cognitive function. The analytics project's six scenes:

0. **00-BIOPROC**: all 16,376 proteins on a sphere by their GO biological processes (UMAP onto a sphere: the 13,003
   with a process on an inner shell, jittered, the 3,373 without on an outer shell), coloured by degree; links drawn
   only between proteins with a process that sit close (3,964 of 309,355).
1. **01-CDK5-subunits**: CDK5 and its regulatory subunits p35 (CDK5R1) and p39 (CDK5R2) pulled into the sphere's
   centre (their two links bright green); the rest as scene 0.
2. **02-CDK5active-Signalling_by_NTRK2** ("physiological condition: CDK5:p35"): the 25 proteins of Reactome's
   Signalling by NTRK2 (BDNF, NTF3, NTF4, NTRK2, FRS2, FRS3, GRB2, SOS1, SHC1, PTPN11, KRAS, NRAS, HRAS, PLCG1, PIK3CA,
   PIK3R1, GAB1, FYN, SRC, GRIN2B, DOCK3, TIAM1, RAC1, CDK5, CDK5R1) pulled into the centre in cyan, with their 83 links
   (CDK5's 3 bright green); only those links show.
3. **03-CDK5p35-CALPAIN** ("CALPAIN cleaves p35 -> p25 -> CDK5:p25 hyperactive"): CDK5 (red) and calpain (CAPN1,
   yellow) at the centre; every link of CDK5 and of calpain removed and one link CDK5 - calpain added (the interactome has
   none: calpain acts on p35, not on CDK5; the authors draw the link for the scene; say so in small print); the map's
   other links as scene 0.
4. **04-CDK5-hyperactive-alzheimers**: the proteins of Reactome's "Deregulated CDK5 triggers multiple neurodegenerative
   pathways in Alzheimer's disease models" (our reading of the file's name `neurodegenerativepathwaysAlzheimers.tsv`; 22
   proteins: the calpains CAPN1, CAPN2, CAPNS1, CAPNS2 and their inhibitor CAST; CDK5, CDK5R1; CDC25A, CDC25B, CDC25C;
   GOLGA2; LMNA, LMNB1; PRDX1, PRDX2, SOD2; FOXO3, YWHAE, BCL2L11, FASLG; JUN; APP) pulled into the centre in orange,
   CDK5 red, their 39 links orange (only those show); the map recoloured by disease: proteins with a disease association
   by the disease palette, the others grey.
5. **05-CDK5-hyperactive_diseaseInference**: the disease landscape: every protein re-placed by UMAP of its Disease
   Ontology associations (the 6,538 with a disease in the middle, the others pushed out to a sphere round them), CDK5 red, links
   between interacting proteins with a disease that sit close (1,283).

What the story may say about the biology, beyond the repository (textbook, keep it to this): CDK5 adds phosphate groups
to other proteins; it is switched on not by cyclins but by p35 or p39, mostly in neurons, which no longer divide; it
helps neurons migrate, grow, wire and signal; calcium switches on calpain, which cuts p35 into p25 (Lee et al., Nature
2000; Patrick et al., Nature 1999); CDK5 bound to p25 is longer-lived and mislocalised, so its activity is too high and
in the wrong places; Reactome's pathway lists the processes its targets belong to (cell-cycle proteins CDC25, the Golgi's
GOLGA2, the nuclear envelope's lamins, peroxiredoxins and SOD2 against oxidative stress, FOXO3 and its targets BCL2L11
and FASLG for cell death); mutations of CDK5 itself are linked to lissencephaly (a "smooth brain") with a small
cerebellum. Never claim more than "in this map" for anything counted on the network.

## The data: `CDK5_DATA` (`sets/data.js`, generated; never edit) and `CDATA` (`sets/cdata.js`)

Written by `python3 -I packages/cdk5/src/data/gen_data.py <folder of the CDK5_data clone>` (seconds; numpy, Pillow, scipy;
its header says where every field comes from), about 1.1 MB; checked by `node packages/cdk5/src/test-data.mjs`. **Read the
header of `sets/cdata.js`: it is the API.** In short:
- 16,376 proteins (indices, the authors' order), 309,355 links (`CDATA.nb(i)`, `deg(i)`, `linked(i, j)`), gene symbols
  (`sym`, `find`, `search`), whether each has a GO process (`bp(i)`) or a disease (`dis(i)`).
- The six scenes (`CDATA.SCENES`, `scene(k)`): each one's places for every protein (`layout(k)`: a Float32Array(3n) in
  the story's frame, cached), colours (`colours(k)`: Float32Array(4n), RGBA 0..1), its centre proteins (`centre`), the
  proteins it colours specially (`colours`: `{ green: [...], cyan: [...], red: [...], ... }`) and its links by class
  (`links: [{ cls, rgba, pairs }]`). Shown links per scene: bioproc 3,964; subunits 3,966; ntrk2 83; calpain 3,958;
  alzheimer 39; disease 1,283.
- The two pathways (`pathways.ntrk2`, `pathways.alzheimer`: names, members, the shown ones).
- Diseases (`terms`: 88 Disease Ontology terms offered in explore, each with its proteins (`genes`), whether CDK5 is in
  it, how many of CDK5's partners are (`partners`, expected `expP`, p `pP`) and how many of its 30 nearest proteins in the
  landscape (`near`, `expN`, `pN`); `termsOf(i)`; `diseases.cdk5Terms` (CDK5's own 48, ancestors included);
  `diseases.partnerTop` and `nearTop` (the most over-represented terms, with q); `diseases.near` (the 30 nearest)).
  Over-representation is within the proteins that have any disease association (6,538; 126 of CDK5's 205 partners), so
  that well-studied proteins do not count twice; say "in this map" and that well-studied proteins have more known partners
  and diseases.
- `facts`: counts, CDK5's degree (205) and rank (396th of 16,376), the hub (APP, 2,123), the CDK family's angles from
  CDK5 on the sphere (CDK2, CDK3, CDK4, CDK6, CDK7, CDK8, CDK9 within 5.2 degrees of it; CDK1 73), the activators' (p35
  98.9 degrees away, p39 171.6), each scene's links, the pathways' sizes.

Numbers the story uses (all from `CDATA`, computed at load, never typed): 16,376 proteins; 309,355 links; 13,003 with a
process; 3,964 links on the map; 205 partners; rank 396; APP 2,123; the family within 5 degrees; p35 99 and p39 172
degrees away; 25 proteins and 83 links in NTRK2's pathway; 22 in the Alzheimer's pathway, 39 links; 6,538 proteins with
a disease; 1,283 links in the landscape; CDK5's own terms (lissencephaly, pontocerebellar hypoplasia, intellectual
disability, schizophrenia, neurodegenerative disease among them); 126 of 205 partners with a disease; Parkinson's
disease 9 partners against about 1.5 expected; psychotic disorder 38 against about 20; several cancers too (the top of
`partnerTop`: say so, honestly); 27 of CDK5's 30 nearest proteins in the landscape share its lissencephaly and
pontocerebellar hypoplasia terms (`nearTop`).

What is real, what is drawn (say so in the story):
- Real (the authors'): the interactome, every layout, every colour, every scene's links, the pathways' members, the
  proteins' Disease Ontology associations. The layouts' places mean "similar processes" or "similar diseases" only
  roughly (UMAP): distances on them are not measurements.
- Ours: the over-representation counts (the generator's, documented), the close-ups' balls, tubes and names (`core`),
  the tags.
- The authors' one addition, the CDK5 - calpain link of scene 3, is not an interaction in the interactome: say so.

## The sets

### `net` (builder A; every chapter; explore's every tab)

The interactome in the authors' six arrangements: 16,376 points that move from one arrangement to the next, the
scenes' links, and highlights. Copy the soil story's `net` set (points with a custom shader: size, glow, twinkle; picking;
labels; the links as `LineSegments` with per-vertex colour) and rebuild it round `CDATA`.
- **The scene** (`net_scene` 0..5, eased by the engine between integers): every protein's place is the mix of the two
  neighbouring scenes' `CDATA.layout(k)`; each protein travels on its own small delay (a seeded stagger, at most a
  third of the move, so the map flows rather than jumps; the delay is a function of `net_scene` only); colours mix the
  same way (`CDATA.colours(k)`). The links of the two neighbouring scenes cross-fade by the fraction, their ends
  following the moving places (refill the line buffers only while `net_scene` is not an integer or the links change; no
  allocation per frame). From 4 to 5 the sphere opens into the landscape: the move to show off.
- **Points**: sized and lit by their colour's alpha (the authors' 100, 90, 80, 50 /255 become brightness and a little
  size, so the grey ones are faint but there); the proteins with a GO process twinkle a little (a function of `t`); the
  outer shell (`net_shell` 0..1, 1 by default) can be dimmed.
- **CDK5** (`net_cdk5` 0..1): CDK5's point grows into a glowing halo (TLOOK halo) in its state's colour (green
  `CLOOK.C.cdk5` until `net_hyper` 0..1 turns it to `CLOOK.C.hyper`), with its label ("CDK5", and "hyperactive" once
  `net_hyper` > 0.5); always findable, whatever the scene.
- **Its partners** (`net_partners` 0..1): lines from CDK5 to each of its 205 partners at their current places (pale
  green, `CLOOK.C.partner` tinted), the partners brighten; a tag "205 partners". In explore the same for any picked
  protein (`net_pick` step: -1 none, or a protein index; its ring, its label with its degree, its partners' lines in
  `CLOOK.C.pick`); the story keys `net_pick` -1.
- **The process knots** (`net_clouds` 0..1; added 19 November 2026 at the owner's request: "annotate the protein clouds in
  the very first layout"): `CDATA.clouds`, 14 knots where one GO biological process gathers on the map (4 to 14 proteins
  each, 5 to 81 times chance), tagged with the process and "n of size here", knots brightened; scene 0 only. Named from a
  current GO release (`CDATA.go`), not the authors' own GO matrix (not in their repository); today's GO shows the map's
  big dense clouds mixing many processes, so the knots, not the big clouds, are labelled: say so in small print.
- **The CDK family** (`net_family` 0..1): CDK1 to CDK20 (`CDATA.facts.family`) light with small tags; those within 5
  degrees of CDK5 crowd round it, CDK1 and others elsewhere; a tag "its cousins: kinases of cell division".
- **The activators' homes** (`net_homes` 0..1): in scene 0 (before they are pulled in), p35 and p39 light where they sit
  on the sphere with tags ("p35 · 99 degrees away", "p39 · 172 degrees away") and faint arcs from CDK5 to them over the
  sphere (great circles).
- **A pathway lit** (`net_path` step: -1, 0 NTRK2's, 1 the Alzheimer's): its members brighten wherever they are (in
  explore, on any scene).
- **A disease term** (`net_term` step: -1, or an index into `CDATA.terms`; `net_termA` 0..1): its proteins light in
  `CLOOK.C.term`, the rest dim; a tag with the term's name and size.
- **CDK5's neighbours in the landscape** (`net_near` 0..1): the 30 nearest (`CDATA.diseases.near`) light round CDK5 with
  a few names, and a tag "27 of its 30 nearest share its brain-development terms" (`nearTop[0]`).
- **The veil** (`net_veil` 0..1): while the core shows, the points between the viewer and the map's centre fade (by
  each point's depth against the centre's, in the camera's frame: a uniform with the camera's position in the set's
  frame, set by the engine each frame through `api().eye(x, y, z)`), so the close-up reads through the sphere; in a
  headset the same with the head's position. `net_core` 0..1: the current scene's centre proteins' own points fade (the
  `core` set draws them).
- **Dim** (`net_dim` 0..1): everything not highlighted dims (for the partners, a term, a pathway, the near ones).
- **Growing in** (`net_grow` 0..1): the map grows from the centre at the start (points from the origin to their places,
  staggered by radius), the links after.
- **Stand inside** (explore, and chapters 1 and 2 in a headset, the engine's): nothing special in the set: the engine's
  view `inside` puts the camera at the origin; points must not pop near the camera (fade those within 0.15 of it).
- Anchors: `centre` [0, 0, 0], `cdk5` (a function: CDK5's current place), `top`, `p35`, `p39`, `capn1`, `app` (the hub),
  `near` (the middle of the 30 near ones in the landscape), `pick` (the picked protein), `term` (the term's middle in the
  current layout); add `pos(i)` (any protein's current place) to `api()`.
- Labels (the set's own, by params): "CDK5" (always, while `net_cdk5` > 0), "APP · 2,123 partners" (the hub, chapter 2
  only: `net_hub` 0..1), the family's tags, the activators' tags, "13,003 with a known process" and "3,373 without" on
  the two shells (`net_shells` 0..1), "Proteins with a disease" and "None known: pushed to the walls" in the landscape
  (`net_landTags` 0..1), the term's tag, the near tag, the picked protein's tag.
- Views: `default` (the whole sphere from the front, slightly above), `side`, `cdk5` (close to CDK5 on the sphere, the
  family round it), `centre` (the centre close-up seen through the veil: the core about 0.85 units across fills the
  view), `inside` (from the origin, looking out at CDK5's side), `land` (the whole landscape), `landCdk5` (close to CDK5
  in the landscape, its near ones round it).
- `api()`: `pick(rc)` (a ray from the engine's raycaster, or `{ origin, direction }`: the protein nearest the ray within a
  small angle, -1 none: brute force over 16,376 places is fine on a click), `pos(i, out)`, `eye(x, y, z)`, `scene()`
  (the eased scene now), `term(i)` (its middle in the current layout).
- Explore: the controls the engine shows per scene (below) are mostly the engine's; the set offers `net_links` 0..1 (the
  scene's links on or off), `net_shell`.

### `core` (builder B; chapters 3 to 6; explore's scenes with a centre)

The close-up at the map's centre: each scene's centre proteins (`CDATA.scene(k).centre`, at their places in
`CDATA.layout(k)`) as lit balls (TLOOK balls) in their scene colours with their names, the scene's links among them as
lit tubes (TLOOK tubes) in the links' colours, cross-fading with `core_scene` (the engine keys it with `net_scene`;
from 1 to 4; at 0 and 5 nothing). Sizes: CDK5's ball about 0.045, others 0.028 (the map's centre is 0.84 across).
- **Names**: every centre protein its gene symbol (labels: the set's own, by params, `core_names` 0..1); the key ones
  with a short role ("BDNF · growth factor", "NTRK2 · its receptor", "p35 · CDK5R1", "p39 · CDK5R2", "calpain · CAPN1",
  "APP", "LMNB1 · nuclear envelope", "FOXO3", "GOLGA2 · Golgi", "PRDX1 · against oxidative stress"); not all at once on a
  phone (`core_names` 1 all, 0.5 the key ones only).
- **CDK5's state** (`core_hyper` 0..1): green to red, its ball glowing brighter and pulsing faster as it turns (a function
  of `t`).
- **The cut** (`core_cut` 0..1, chapter 5; networks only, so no molecule drawn): the CDK5 - calpain link appears and
  flashes once; a tag "p35 cut into p25 · CDK5 stays on" by CDK5; the tag "a link the authors drew: calpain acts on
  p35" in small type.
- **The signal** (`core_flow` 0..1, chapter 4): small bright pulses run along NTRK2's links outwards from BDNF and NTF4
  through NTRK2 to the rest (a breadth-first order by links, a function of `t`), so the pathway visibly carries a
  message; and through Alzheimer's links in orange in chapter 6 from CDK5 outwards.
- The proteins left at the centre from an earlier scene that the scene does not colour (p39 in scenes 2 and 4): faint
  small balls without a name.
- Anchors: `centre`, `cdk5`, `capn1`, `bdnf`, `ntrk2`, `app`, `top` (above the close-up); views `default` (the centre
  close-up, about 0.9 across), `low`.
- Explore: nothing of its own (it follows the scene); picking a centre ball picks that protein (`api().pick(rc)`).

## The engine (`packages/cdk5/src/engine/`, copied from the soil story's; builder B)

(Since the move into a package, v189: the engine files hold only the story's own parts and `//#use` lines for the
shared engine parts, `tools/engine/`, as `packages/soil/src/engine/` does; what follows is the original brief.)

Copy `packages/soil/src/engine/` and adapt it: `e1_head.js` (the header: what the story is, `HOST.register('cdk5', ...)`),
`e2_scene.js` (`SET_ORDER = ['net', 'core']`, `FRAME = { core: 'net' }`, no hop), `e3_story.js` (chapters, `DEF`,
`buildStory`, `FACTS`, labels, credits, `XR_HERE = 'cdk5'`, the narration file `packages/cdk5/audio/narration.mp3`, a
placeholder `NARRATION_SYNC` and `NARRATION_ENDS` until the integrator narrates it), `e4_explore.js` and `e6_panels.js`
(the panes, HTML and canvas twins), `e7_app.js` (the load steps, `openStart`, the hash). **Keep every shared line
identical** (the headset code in `e5_xr.js`, the shared-room hooks, the slideshow, `fitTitle`, the landing screen, the
headset settings, the panels setting, captions, the loading step queue, the sound-effect lines: `AGENTS.md`, "Shared
rooms", "Sounds inside the stories" and "Inside a story"); before finishing, diff the shared parts against the
then-current `packages/soil/src/engine/` and `tools/flock/engine/` and take any changes. `FACTS` holds every number the text
shows, from `CDATA`; none is typed in.

**Chapters** (about 7.5 minutes before narration; `CH` keys and story times; the first key is `title`). Every chapter:
one or two plain sentences first, then the technical layer in smaller print. The text below is a draft: keep its
meaning and its plainness, shorten freely.

1. `title` 0-55, **Sixteen thousand proteins** (`net`: `net_grow` 0 to 1, scene 0, `net_shells`; then `net_cdk5`). "A
   human cell runs on thousands of proteins. Here are 16,376 of them, placed so that proteins with similar jobs sit
   close together, and joined where two are known to bind. Somewhere among them is CDK5." Small print: the map of
   processes (GO biological processes, UMAP onto a sphere, cartoGRAPHs); 13,003 with a known process inside, 3,373
   without outside; the interactome's 309,355 links, of which the map shows the 3,964 between near neighbours; colours by
   the number of partners; the Menche lab's CDK5 project.
2. `kinase` 55-120, **A kinase among its cousins** (`net_cdk5`, view `cdk5`, `net_family`, then `net_partners`,
   `net_hub`). "CDK5 is a kinase: it switches other proteins on or off by adding phosphate to them. On the map it sits
   with its cousins, the kinases that drive cell division. But CDK5 works in neurons, which no longer divide, and its
   205 partners are spread all over the map." Small print: cyclin-dependent kinases; the angles; 205 partners, 396th of
   16,376 by partners; APP has the most, 2,123.
3. `activators` 120-180, **Two partners switch it on** (`net_homes`, then scene 0 to 1; `core` in with the activators).
   "Its cousins are switched on by cyclins. CDK5 is not. Two proteins found in neurons, p35 and p39, switch it on and
   hold it where it works. On the map they live far apart; here they come together at the centre." Small print: CDK5R1
   (p35), CDK5R2 (p39); 99 and 172 degrees away; the authors' scene "CDK5 + regulatory subunits".
4. `signal` 180-245, **Healthy signalling** (scene 1 to 2, `core_flow`, `net_veil`). "In a healthy neuron the growth
   factor BDNF docks on its receptor, NTRK2. A chain of proteins passes the message on, and CDK5 with p35 is one of the
   links: the neuron grows, survives and connects." Small print: Reactome's Signalling by NTRK2: 25 proteins, 83 links
   among them in the interactome (only these show); TrkB; the RAS, PI3K and PLCG1 branches; CDK5 with TIAM1 and RAC1, the
   cell's skeleton.
5. `calpain` 245-305, **A cut that sticks** (scene 2 to 3, `core_cut`, `net_hyper` and `core_hyper` 0 to 1). "When a
   neuron is under stress, calcium floods in and wakes calpain, an enzyme that cuts proteins. Calpain cuts p35 into a
   shorter piece, p25. CDK5 bound to p25 stays switched on, for longer and in the wrong places: it is hyperactive."
   Small print: CAPN1; Lee et al., Nature 2000; Patrick et al., Nature 1999; the link drawn between CDK5 and calpain is
   the authors' (calpain acts on p35, not on CDK5); p25 has no point of its own in the interactome.
6. `alzheimer` 305-370, **Stuck on in Alzheimer's** (scene 3 to 4, `core_flow` in orange, the map recoloured by
   disease). "A switch stuck on does damage. In Alzheimer's disease models, hyperactive CDK5 sets off several harmful
   paths at once: it disturbs proteins of the cell cycle, the Golgi, the nuclear envelope, the defences against oxidative
   stress, and turns on signals for the cell's death." Small print: Reactome's "Deregulated CDK5 triggers multiple
   neurodegenerative pathways in Alzheimer's disease models" (our reading of the file's name): 22 proteins, 39 links; the
   map's colours now by disease: 6,538 proteins with a disease association; the rest grey.
7. `landscape` 370-440, **A landscape of diseases** (scene 4 to 5, the big move; then view `landCdk5`, `net_near`, then
   `net_partners`). "Now place every protein by the diseases it is linked to. CDK5 lands among proteins of disorders of
   the developing brain: 27 of its 30 nearest share its links to lissencephaly, a smooth brain, and to pontocerebellar
   hypoplasia. Its partners lean towards the brain too: more of them than chance would give are linked to Parkinson's
   disease and to psychotic disorders." Small print: the Disease Ontology (ancestors included); UMAP in 3D; 1,283 links
   between near, interacting proteins; over-representation within the 6,538 proteins with a disease, 126 of CDK5's 205
   partners (9 against 1.5 expected for Parkinson's, 38 against 20 for psychotic disorders; several cancers too); well-
   studied proteins have more known partners and diseases; in this map.
8. `learn` 440-490, **Too little, too much** (the landscape, CDK5 glowing; `net_partners` out; a slow turn). "CDK5 shows
   why a network view helps. Too little CDK5, and the brain does not build itself properly. Too much, stuck on by
   calpain's cut, and neurons are damaged. Explore the map yourself: follow any protein, any pathway, any disease." Small
   print: the credits (the Menche lab's CDK5_data repository and its CDK5_analytics VR project, Christiane Hütter;
   cartoGRAPHs; the interactome; Reactome; the Gene Ontology; the Disease Ontology; what is ours: the close-ups, the tags,
   the over-representation counts).

In a headset: chapters 1 and 2 stand you inside the map (the engine's `standView` by story time, as the tissue topology
story's tower: the map's middle at your head's height, the sphere about 2.5 m round you, CDK5's side in front), and
from chapter 3 the map floats in front of you again at the default size, its centre about 1.3 m away, the core readable
through the veil (`net_veil` follows the head). Nothing comes within 0.35 m of the eyes in either.

**Explore mode** tabs (HTML and canvas twins, as every story):
- **Scenes**: the six (Map of processes, Activators, NTRK2 signalling, Calpain, Alzheimer's pathway, Disease
  landscape), each the authors' scene (`net_scene`, `core_scene`, CDK5's state: green in 0 to 2, red in 3 to 5); per
  scene the switches Links (on, off) and, on the sphere, the outer shell (shown, faint); a line on what the scene is; and
  *Stand inside* (view `inside`; in a headset the map about 2.5 m round you).
- **Proteins**: a search (gene symbol; CDK5 suggested first; on the headset the shell's keypad,
  `HOST.collab.keypad`, guarded); the picked protein (also by clicking or pointing at a point or a ball): its symbol, its
  partners (count; the first dozen named, its links drawn), whether it has a GO process, its diseases among the 88 terms
  (`termsOf`) and whether it has any, whether it is in either pathway, its place in the landscape (a button: show it
  there); *Back to CDK5*.
- **Diseases**: the 88 terms (CDK5's own first, then the rest alphabetically; on the headset a paged list): the picked
  term's proteins lit (`net_term`) on the current scene (best on the landscape: a button *Show on the landscape*), its
  size, how many of CDK5's partners are in it against the expected (`partners`, `expP`, `pP`) and how many of its 30
  nearest (`near`, `expN`, `pN`), CDK5's own or not; small print on the method and its caveats.
- **About**: the repository, the six scenes' names as the authors call them, what is the authors' and what is ours.

`collab.state()`: the tab, the scene, every scene's switches (links, shell), the picked protein (`prot`, -1), the picked
term (`term`, -1), the search text is not shared. Never the camera or anything per device; `apply(state())` gives
`state()` back. Suggested hashes: `#cdk5&t=100`, `#cdk5&explore&scene=disease`, `#cdk5&explore&scene=ntrk2&links=off`,
`#cdk5&explore&tab=proteins&q=CDK5R1`, `#cdk5&explore&tab=diseases&term=lissencephaly`, `#cdk5&explore&inside`, `&now=1`
skips the glide.

Sound cues (`sfxCue`, `sfxHold`: AGENTS.md, "Sounds inside the stories"; the soil story's block): the map growing in
(`grow`), CDK5 found (`ping`), the partners (`link` as a short sequence), the activators pulled in (`whoosh`, `link`),
the signal (`pulse`), the cut (`snap`, then `spark`), CDK5 turning red (`knock`), the sphere opening into the landscape
(`whoosh`, `rise`), the near ones (`ping`); explore's pick `pick`, a scene change `whoosh`. 6 to 60 cues; check with
`node tools/sfx-cues.mjs http://127.0.0.1:8123/ cdk5` once the integrator has listed the story.

## Testing

- `node packages/cdk5/src/test-data.mjs` (a second) after the data or the decoders change; `node packages/cdk5/src/build.mjs --check`.
- A set alone: `node shot.mjs <set> "<query>|..." <prefix> 640 400` from `packages/cdk5/src` (serve the repository root on
  8123), e.g. `node shot.mjs net "p=net_scene:0,net_cdk5:1&cam=default|p=net_scene:4.5&cam=default" n`.
- The story: `node sweep.mjs <prefix> "30,100,200"` once the story is in `HOST.list` (the integrator lists it before
  the builders finish: ask if it is not there), then the smoke test (`node tools/smoke.mjs http://127.0.0.1:8123/ --only
  cdk5` runs the story's own steps once the integrator has added them).
- Keep screenshots in `/private/tmp/claude-501/-Users-chris-Desktop-Github-XRdatastories-Chiettini-airportnetworks/67a63163-d030-49e3-bacf-2b013ee6df76/scratchpad/cdk5-shots/` (outside the repository; `SHOTS=<that folder>`), small (640 x 400), at most about 20 per builder.
- Report headset behaviour (sizes, standing inside, the veil) as untested.
