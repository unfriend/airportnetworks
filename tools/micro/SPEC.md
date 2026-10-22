# The microanatomy story: 3D sets and engine spec

We are adding a tenth story to the web app in `/home/user/airportnetworks`: `stories/micro.js`, built from
`tools/micro/` like the PET story `stories/pet.js` is built from `tools/pet/`. It turns a preprint, a poster and a
talk into a narrated, about five-minute 3D story with an explore mode, on desktop, phones and in VR/AR headsets
(Meta Quest Browser). Bold and beautiful, as the other stories.

- **The preprint**: Buljan I, Bago-Horvath Z, Rendeiro AF, "Systematic mapping of human tissue microanatomy reveals
  age-associated remodeling and resilience", bioRxiv 2025, doi 10.1101/2025.10.13.682110 (CC BY-NC).
- **The poster** "Microanatomical organization of the human body and its changes with age" and **the talk**
  "Microanatomical principles of tissue organization and their change with age" (Iva Buljan, Rendeiro group; LBI for
  Network Medicine, CeMM, Medical University of Vienna).
- **Iva Buljan's network of organ architecture** (organs, tissues, tissue types, domains), in the data.

Card: kick "Tissue microanatomy", title **Tissue and time**, tagline "how organs are built, and how they age", colour
`#ff9ec4`. Story key `micro`.

**The rules for sets are those of the tour**: read `tools/lbi/SPEC.md` from the top down to (and including)
"Palette and look", and `tools/lbi/kit.js`. Everything there holds here, with these differences:

- Set files live in `tools/micro/sets/`, the harness is `tools/micro/harness.html` (same query syntax) and the
  screenshot tool `tools/micro/shot.mjs` (run it from `tools/micro`; shots go to `tools/micro/shots/`, ignored by
  git, or to the folder in `SHOTS`; `cam=` takes a view of the set by name too). The server on port 8123 (or `PORT`)
  serves the repository root (check with `curl -sI http://127.0.0.1:8123/ | head -1`;
  if it is down: `setsid nohup python3 -m http.server 8123 --bind 127.0.0.1 --directory /home/user/airportnetworks
  >/dev/null 2>&1 < /dev/null &`).
- The data is the global `MICRO_DATA` (`tools/micro/sets/data.js`, made by `tools/micro/data/gen_data.mjs`; never
  edit by hand; its header documents every field; it may be regenerated with the figures' readings, same shape).
- Reused unchanged (never edit them): the tour's **tissue** set (`tools/lbi/sets/tissue.js`, manifest
  `tools/lbi/sets/tissue.md`: an H&E-stained section of stomach wall of about 18,600 cells, with mucosa, submucosa
  and muscle, a cell network, multiplexed colours and a 3D embedding) and the tour's **body** set (the PET body:
  `tools/lbi/sets/body.md`). The harness always loads them (`set=tissue` or `set=body` shows one alone), and a set may
  make its own instance (`SETS.tissue(K)`).
- **The organs in 3D** (`sets/organs.js`, manifest `sets/organs.md`; it replaced the PET story's flat line icons, which
  this story no longer uses; an organ's model is found by its name, `ORGAN3D.idOf`): a small
  lit procedural model of each of the 29 organs (`ORGAN3D`: a signed distance field of a few blended primitives,
  polygonised by surface nets, about 1,000 to 3,000 triangles each, built between frames from the start, one organ
  after another, model then picture, the one a pane or the body shows first). The sets draw them as meshes
  (the network's organ ring, the atlas's plates; the engine on the body, beside the picked organ's point) and the
  panes as pictures drawn once onto a 2D canvas (no WebGL, so also inside a headset session). The harness always
  loads them; `set=organs` shows them all (`organs_pics:1`: the pictures).
- No patient data: the slides shown are drawn (procedural), never the GTEx images; the numbers are the preprint's
  and values read off the talk's figures (summaries).

## Shared facts (use exactly; the engine's `FACTS` reads them from `MICRO_DATA.facts`)

- Microanatomical domains: recurring arrangements of cells that do one job in an organ (for example the gut's
  mucosa, submucosa, muscle layers and lymphoid patches). They are the units between cells and organs.
- H&E (haematoxylin and eosin): the standard stain of pathology; haematoxylin colours nuclei purple-blue, eosin
  colours cytoplasm and fibres pink. Slides are cheap, plentiful and show a wide field.
- GTEx (the Genotype-Tissue Expression project): tissue from 983 people who died aged 20 to 70 (971 in the
  analysis), 40 tissues of 29 organs, 24,945 whole-slide images (the talk says 25,713 images and ages 20 to 80; use
  the preprint's numbers).
- H&E-UTAG, the authors' method, without labels: each slide is cut into tiles (162 million in all); a deep-learning
  vision model describes each tile with numbers (features); each tile then mixes in its neighbours' descriptions
  (message passing over the tiles' spatial adjacency); tiles with similar mixed descriptions are clustered, across
  all slides. The clusters are the domains, named afterwards by a pathologist. It agrees with pathologists' notes
  (salivary gland r = 0.91, stomach mucosa r = 0.76).
- 218 domains in 74 types (and 10 classes; whether these are the network's 10 tissue types is unconfirmed, see
  `docs/questions-for-authors.md`); 16 % of domain types are shared by 3 or more tissues, 69 % belong to one
  tissue.
- Age is the strongest of 111 donor variables in explaining how domains vary. 28 % of domains change with age (37 of
  128 domain-tissue pairs with more than 1 % abundance), mostly by less than 3 % per decade. Examples: in the ovary
  the corpus albicans (scars of old follicles) rises from 1.4 % to 11.89 % of the section (3.51 % per decade); the
  submucosa of the gut falls from 42.9 % to 34.5 % (-0.98 % per decade); the pituitary's adenohypophysis (its gland
  part) from 82.6 % to 67.9 % (-3.42 % per decade). Connective tissue rises in many organs. Skin and reproductive
  tissues change most, nerve and muscle least.
- Pathology: 9,643 pathologists' notes of 54 kinds in GTEx. Calcified plaques in arteries rise with age, faster
  after about 40; infarct tissue in the heart steeply after about 60. Disease and healthy ageing often remodel
  different parts of a tissue (abundance, shape or both: testicular atrophy changes the tubules' shape, arterial
  fibrosis the amount of adventitia, cirrhosis both).
- Contacts between domains form a network per organ. Its core stays with age (resilience); some contacts change:
  muscularis-submucosa contacts fall in the colon, subdermis-reticular dermis in the skin; mucosa-fibromuscular rise
  in the ovary; in the uterus the endometrium turns towards connective tissue; calcified plaques touch the tunica
  intima more in coronary and tibial arteries.
- Organ architecture as a network of four levels: 29 organs, their tissues, 10 tissue types, domains (in
  `MICRO_DATA.graph`); connective tissue is the tissue type shared most widely.

Note on the figures' readings (`MICRO_DATA.figures`, read off the talk's slides): the atlas's sections, colours and
shares, the volcano's labelled points (its y axis is a natural log of the adjusted p; threshold 3.0), 16 trajectories,
the coronary artery's contact network at five ages, and the fallopian tube's contacts. Some example panels are drawn in
other units than the preprint's text (the pituitary panel goes 0.40 to 0.33, the ovary panel 0 to 0.15): whenever the
story or a label states the three examples, use the preprint's numbers (`MICRO_DATA.examples`); use the panels only for
shapes. The talk shows no stomach-versus-uterus network.

## Palette and look

The tour's dark look; everything a lit 3D object (no flat cards or 1-pixel drawings as the main picture). Features
(numbers) in an even colour scale: indigo `#4d33b8` (low), teal `#1f9ec7`, green `#59db73`, yellow `#ffe647` (high). H&E
colours for slides: haematoxylin `#4b3b8f` to `#7d6bc4` (nuclei), eosin `#e88bb0` to
`#f6c4d6` (cytoplasm, fibres), white `#fbf4f7` (fat, lumen). Domain colours: as in the talk's figures (from
`MICRO_DATA.figures.atlas` when present), otherwise a fixed categorical palette per domain name, the same in every
set (export the function `domainColour(name)` from the atlas set's API so the others can use it; the engine copies
it). The network levels: organs `#1f8a4c` (dark green), tissues `#7ccf7e` (green), tissue types `#ef8f7a` (salmon),
domains `#5aa9ff` (blue), as in the talk's Figure 5.

## The sets

### `slide` - one section, the method, the domains (file `sets/slide.js`)

Drawn in **the tour's tissue set's frame** (a slab about 2.1 long, up to 0.6 deep, facing +z, mucosa on top,
muscle below; read `tools/lbi/sets/tissue.js` and `tissue.md` for where its layers are and copy what you need: do not
edit it). The engine shows `tissue` and `slide` together.
The method is drawn in the tour's visual language for its tissue (its cell network on the section, the colours that
light up cell by cell, the lift into a 3D embedding), on the tour's own tissue set: tiles as nodes joined to their
spatial neighbours on the tissue, the features shown per tile, the message passing as light running along the links,
the mixed descriptions gathering in a 3D map, and the groups colouring the tissue as domains.
- `slide_tiles` 0..1: a grid of square tiles (about 40 x 12 over the slab, following its curve, a hair in front of
  it) draws on, tile by tile, as thin bright outlines; "Tiles" label.
- `slide_feat` 0..1: the slide darkens and every tile lights up with a 4 x 4 mosaic of glowing blocks, each as bright and
  as tall as one of its 16 numbers (an even colour scale, indigo to teal to yellow), in a wave from the close-up tile.
  Label "Features · a list of numbers a tile".
- `slide_adj` 0..1: a network floats over the tiles: a lit node over each tile (in the tile's colour: its description),
  glowing tubes to its eight neighbours (spatial adjacency), light pulses running both ways along them (message
  passing); the nodes' colours and the mosaics settle to the mixed descriptions. Label "Each tile listens to its
  neighbours".
- `slide_group` 0..2: 0 to 1 the nodes lift off, arc towards you and gather in a 3D map of their mixed descriptions
  above the section (the first three principal components), where alike tiles form groups and take their group's
  (domain's) colour; 1 to 2 they fly back down onto their tiles and melt into the wash. Label "Alike tiles · gather: a
  domain each".
- `slide_domain` 0..1: tiles take their domain colours (mucosa, submucosa, muscularis inner and outer, lymphoid,
  blood vessels; from where the tissue set's layers are), as a translucent wash over the H&E, with clean borders
  between domains; labels with the domain names.
- `slide_age` 0..1: the same section at age 20 (0) and at 70 (1): the domain borders shift so the submucosa's share
  goes from 42.9 % to 34.5 % (the others take up the rest) and the muscle and connective parts thicken a little; a
  small gauge "Submucosa 42.9 % -> 34.5 %" and an age readout "20 years" to "70 years".
- `slide_focus` 0..6 (domain index + 1, 0 none): one domain glows, the rest dim.
Anchors: `tiles`, `feat`, `listen`, `close`, `cloud`, `cloudC`, `mucosa`, `submucosa`, `muscularis`, `lymphoid`,
`vessels`, `gauge`. Labels as above (at most about six at once). Cam: `default` (the whole slab, like the tissue
set's `section`), `tiles`, `matrix` (the features, a slant close-up), `close` (the network over a few tiles), `group`
(the section and the map above it), `domains`, `age`. Controls: View (Section / Tiles / Features / Neighbours /
Groups / Domains / Age), Age (20 / 70). Explore API `api()`: `domains` (names in order), `pick(raycaster)` -> domain
index or -1, `domainColour(name)` (or use the atlas set's).

### `atlas` - the slide library, the atlas, ageing and pathology (file `sets/atlas.js`)

- `atlas_lib` 0..1: **the slide library**: 24,945 glass slides (instanced: a thin glass box with a tissue blob on
  it, tinted in H&E colours, its shape and colours from its tissue; the same few procedural textures in an atlas)
  in a great curved wall or a slow helix: columns by tissue (40), rows by donor age from 20 at the bottom to 70 at
  the top; they fly in in waves; faint glints; labels "24,945 slides", "40 tissues", "983 people, aged 20 to 70".
  They stand in a lit rack (a back panel, a shelf at every decade, a post between tissues), so the wall reads in
  depth from afar, where a slide is a pixel or two.
- `atlas_map` 0..1: **the atlas**: one larger procedural section per tissue (40; their shapes and domains from
  `MICRO_DATA.figures.atlas` when present, else from `MICRO_DATA.graph`'s domains of that tissue's organ, with
  plausible shapes: a folded strip for gut, a ring for artery, round for ovary, lobed for gland), each a disc of
  domain-coloured patches, arranged on a grid or an arc, with tissue names; they come forward from the library.
- `atlas_umap` 0..1: **the tile cloud**: about 30,000 points (tiles) in a 3D embedding, clustered by domain type
  (coloured by domain; shared types such as connective tissue and blood vessels form bridges between tissues),
  rising out of the sections. Label "162 million tiles, 218 domains".
- `atlas_focus` 0..40 (tissue index + 1; 0 none): that tissue's section comes forward big, the others dim.
- `atlas_age` 0..1: with a focused section of the ovary, pituitary or a gut tissue, its domains morph from age 20 to
  70 by the preprint's examples (`MICRO_DATA.examples`); other tissues by small illustrative drifts (connective tissue
  up). An age readout.
- `atlas_volcano` 0..1: **the volcano plot** in 3D: bubbles (x: abundance change in % per decade, y: -log10 p, size by
  abundance), from `MICRO_DATA.figures.volcano` when present (else the three examples and illustrative points,
  marked so); the significance line; significant ones bright, the rest dim; labels of the examples. Label "28 % of
  domains change with age".
- `atlas_curves` 0..1: **trajectories over age** (20 to 70): the three examples and the pathology curves
  (calcified plaques, infarct tissue; from `MICRO_DATA.figures.trajectories` when present, else the shapes the
  preprint describes), as glowing ribbons on a panel with axes.
Anchors: `library`, `atlas`, `umap`, `focus` (the focused section, or the atlas's centre), `volcano`, `curves`,
`ex0`..`ex2` (the examples' bubbles). Cam: `default` (the library), `library`, `atlas`, `umap`, `focus`, `volcano`,
`curves`. Controls: View (Library / Atlas / Tiles / Age / Pathology), Tissue (none; the engine sets `atlas_focus`).
Explore API `api()`: `tissues` (names in order), `pick(raycaster)` -> tissue index or -1, `domainColour(name)`.

### `hier` - organ architecture and domain contacts (file `sets/hier.js`)

- `hier_grow` 0..1: **the four-level network** from `MICRO_DATA.graph` (the talk's Figure 5a, in 3D): organs on top
  (each as its small 3D model), then tissues, tissue types and domains below, as stacked rings (each level the glowing
  rim of a faint plate; links between levels as soft glowing tubes with a colour gradient and a light running down
  them), nodes coloured by level (palette above), sized by degree; grows top to bottom.
- `hier_focus` -1..N-1 (a node index; -1 none): that node and everything linked to it (up and down the levels)
  light up; the rest dims; its name and its links' names as labels.
- `hier_contacts` 0..1 with `hier_organ` (0..k-1: an index into the organs with contact data: colon, skin, ovary,
  fallopian tube, uterus, coronary artery; from `MICRO_DATA.findings.interactions` and `MICRO_DATA.figures.interactions`)
  and `hier_age` 0..1 (20 to 70): one organ's **domain-contact network**: its domains as nodes (from the graph, plus
  the domains the findings name), links as bands whose width is the share of contacts; as `hier_age` goes to 1 the
  links the preprint says change grow or shrink (rising ones warm, falling ones cool) while the core stays: label
  "The core stays" and the changing contact's name.
Anchors: `top` (organs), `bottom` (domains), `focus`, `contacts`, `change` (the changing link). Cam: `default`, `net`,
`contacts`. Controls: View (Network / Contacts), Organ (the organs with contact data), Age (20 / 70). Explore API
`api()`: `nodes` (names and levels), `pick(raycaster)` -> node index or -1, `contactOrgans`.

## The engine (`tools/micro/engine/`, copied from the PET story's; adapt it)

Rename everything from the PET story: `HOST.register('micro', ...)`, the header comment (the preprint, the poster and
the talk above), `audio/narration-micro.mp3`, `SET_ORDER = ['body', 'tissue', 'slide', 'atlas', 'hier']`, the
shared-room hooks unchanged (see "Shared rooms" in `AGENTS.md`), the headset code unchanged except that the PET
story's Life size mode goes (no room mode in this story). `tissue` and `slide` share one frame: wherever the story
or explore shows `slide`, show `tissue` too (same transform).

**Chapters** (about 5:05; `CH` keys and times):
1. `title` 0-14: the tour's body (`body_pet` 1) with the 29 organs' points lit; title card "Tissue and time" with the
   tagline and the line "How the body's organs are built from small working units, and how they change as we age".
2. `slide` 14-50: dive into one organ: crossfade to `tissue` (section view, then zoom): an H&E slide (what the stain
   shows), cells arranged into working units; `slide_domain` washes the mucosa, submucosa, muscle and lymphoid patch
   in: microanatomical domains.
3. `library` 50-85: `atlas_lib`: GTEx: 983 people aged 20 to 70, 40 tissues of 29 organs, 24,945 slides.
4. `method` 85-130: back at the section: `slide_tiles`, `slide_feat`, `slide_adj`, `slide_group` and `slide_domain`
   (H&E-UTAG in four steps, built as the tour builds its cell network; 162 million tiles; no labels needed, named
   afterwards; agrees with pathologists); then `atlas_umap`.
5. `atlas` 130-170: `atlas_map` (218 domains in 74 types; 16 % shared by 3 or more tissues, 69 % in one), then `hier`
   (`hier_grow`: organs, tissues, tissue types, domains; connective tissue everywhere).
6. `age` 170-215: age is the strongest driver (of 111 variables); 28 % change; `atlas_volcano`; the three examples
   (`atlas_focus` ovary with `atlas_age`; the gut submucosa with `slide_age`; the pituitary), connective tissue up.
7. `pathology` 215-250: `atlas_curves`: GTEx's pathologists' notes (9,643 of 54 kinds); calcified plaques after
   about 40, infarct after 60; disease and healthy ageing remodel different parts.
8. `contacts` 250-285: `hier_contacts` (the colon's network: muscularis-submucosa contacts fall; then the coronary
   artery: plaques meet the intima more): a resilient core, a few contacts that change.
9. `next` 285-305: what for (ageing biology, early signs of disease, a map of how organs are built); credits (the
   three authors, the Rendeiro group, LBI Network Medicine, CeMM, Medical University of Vienna, GTEx); small print:
   "Slides, sections and tiles are drawn, not the GTEx images; the domain maps, the volcano's other points and the
   contact networks are illustrative where the figures give no numbers."

Text: plain British English, short sentences, glosses for jargon; every number from `MICRO_DATA` (`FACTS`), none
hard-coded; chapter panels with `data-at` fade-ins as in the PET story; story labels on set anchors. Frame the 3D
content clear of the panel (the PET story's `FIT`).

**Explore mode** tabs (HTML and canvas twins):
- **Organs**: the 29 organs as chips; picking one lists its tissues and domains (from the graph), shows its section
  (`atlas_focus` on one of its tissues) and lights it in the network (`hier_focus`).
- **Domains**: search the domains; one shows its tissue type, the organs it is found in, and lights it in the network.
- **Age**: the three examples (each shows its section and the age morph), an age slider (20 to 70, drives
  `atlas_age`, `slide_age`, `hier_age`), the volcano and the pathology curves.
- **Method**: the four steps as a stepper (Tiles, Features, Neighbours, Domains: the slide's views Tiles, Features,
  Neighbours and Groups) with one sentence each.
- **Scenes**: Body, Section (`tissue` with `slide`), Library and atlas (`atlas`), Network (`hier`), with their controls.
URL hashes: `#micro&t=120`, `#micro&explore&organ=Ovary`, `&domain=submucosa`, `&tab=age&age=70`, `&tab=method&step=2`,
`&scene=atlas&view=volcano`. `collab.state()`: `{ tab, scene, ctl, organ, domain, age, step }`.

## Deliverables

For each set: `sets/<file>.js`, `sets/<file>.md` (manifest: params, suggested keyframes, anchors, labels, cam views,
controls, explore API, what a narrator may and must not say), final screenshots `shots/<key>-final-<k>.png` (640x400).
Test in the harness only. The engine: `engine/*.js` adapted; `node tools/micro/build.mjs` builds `stories/micro.js`.
