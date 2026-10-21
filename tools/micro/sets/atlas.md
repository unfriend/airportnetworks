# `atlas`: the slide library, the atlas of 40 sections, the tile cloud, ageing and trajectories

File `sets/atlas.js` (`SETS.atlas`). One set, five pictures that share one stage (y up, viewer towards +z):
a curved wall of slides at the back, a 10 x 4 arc of sections in front of it, a cloud of tiles in the middle, and the
volcano or the trajectories in the middle when they are shown (the sections and the wall dim behind them).

Build about 250 to 300 ms in headless Chromium; at most 8 draw calls, about 133,000 triangles, no per-frame buffer uploads
beyond 40 x 2 uniforms, 5 head points and the 8-segment age gauge.

- The library: 24,945 slides in one instanced draw (a portrait glass quad: frosted label end, a tissue blob from one of
  8 shape textures in a 512 x 512 canvas atlas, coloured in shader by its tissue's eosin colour and nuclear density).
- The sections: 29,952 tiles in one instanced draw (two triangles each), plus one instanced draw for the 40 plates and
  their captions (canvas text). The same tiles are the cloud's points: as `atlas_umap` rises each tile leaves its
  section, turns from a square into a glowing dot (premultiplied blending: normal for the squares, the dots part
  additive, part over, so a dense core keeps its colour instead of adding up to white) and flies to the cloud.

## Params

| Param | Range | Meaning | Suggested keys |
| --- | --- | --- | --- |
| `atlas_a` | 0..1 | fade | |
| `atlas_lib` | 0..1 | the library: slides burst from the stage's middle onto the wall in waves (the centre columns first); glints sweep the glass | 0 -> 1 over 6 to 8 s (library chapter); rest 1 |
| `atlas_map` | 0..1 | the atlas: each tissue's section leaves its column on the wall and comes forward to the arc as an H&E section (0.0 to 0.6), then its domain colours wash in (0.55 to 0.95); the wall dims to about a quarter | 0 -> 1 over 4 s |
| `atlas_umap` | 0..1 | the tile cloud: tiles rise out of the sections (staggered, an arc upwards) into the embedding; plates and captions fade | 0 -> 1 over 4 to 5 s |
| `atlas_focus` | 0..40 | tissue index + 1 (0 none): that section comes forward big, the others recede and dim. Eased inside the set (5/s, on the engine's real frame time `dt`, so it eases while paused too; snaps on the first frame, without a `dt`, after a frame longer than 0.3 s and when `t` jumps by more than 0.3 s beyond `dt`: a seek, story to explore), so the engine may step it. In the cloud, a focus lights that tissue's tiles and dims the rest | step |
| `atlas_age` | 0..1 | age 20 -> 70 for every section's domains; a gauge with a marker runs along the top of a focused section (shown when the focused tissue is one of the examples, or once the age moves) | 0 -> 1 over 4 to 6 s |
| `atlas_volcano` | 0..1 | the volcano: axes and grid (0 to 0.35), bubbles pop in (0.15 to 0.8), significant ones light up (0.68 to 0.95); the significance plane | 0 -> 1 over 3 s |
| `atlas_curves` | 0..1 | trajectories: five lanes draw from age 20 to 70 (each lane a little after the one before; lane j is done at 0.75 + 0.05 j) | 0 -> 1 over 6 s |

With `atlas_volcano` or `atlas_curves` on and a section focused, the plot moves left and the section sits right at
radius 0.33, so both fit the `age` view: the volcano at x -0.5, scale 0.8, the section at (0.74, 0.04, 0.5); the curves
at x -0.69, scale 0.66, the section at (0.84, 0.04, 0.5), and the lanes' labels give the name alone.

The trajectories: each lane fills its own height (from zero, to its own maximum: lanes are not comparable in height).
An example lane that falls (submucosa 42.9 to 34.5 %, adenohypophysis 82.6 to 67.9 %) stands on its own floor
(2.3 times its change below its lowest value), so its fall takes 30 % of the lane's height (18 to 20 % from zero) and
reads as a fall rather than a bar; its label gives the numbers. Rising lanes start from zero.

Resting look (all defaults): the library wall, nothing else.

## Tissues (order of `api().tissues`, `atlas_focus` = index + 1)

The 40 GTEx tissues, alphabetical by their GTEx names: 0 Adipose - Subcutaneous, 1 Adipose - Visceral (Omentum),
2 Adrenal Gland, 3 Artery - Aorta, 4 Artery - Coronary, 5 Artery - Tibial, 6 Bladder, 7 Brain - Cerebellum,
8 Brain - Cortex, 9 Breast - Mammary Tissue, 10 Cervix - Ectocervix, 11 Cervix - Endocervix, 12 Colon - Sigmoid,
13 Colon - Transverse, 14 Esophagus - Gastroesophageal Junction, 15 Esophagus - Mucosa, 16 Esophagus - Muscularis,
17 Fallopian Tube, 18 Heart - Atrial Appendage, 19 Heart - Left Ventricle, 20 Kidney - Cortex, 21 Kidney - Medulla,
22 Liver, 23 Lung, 24 Minor Salivary Gland, 25 Muscle - Skeletal, 26 Nerve - Tibial, 27 Ovary, 28 Pancreas,
29 Pituitary, 30 Prostate, 31 Skin - Not Sun Exposed (Suprapubic), 32 Skin - Sun Exposed (Lower leg),
33 Small Intestine - Terminal Ileum, 34 Spleen, 35 Stomach, 36 Testis, 37 Thyroid, 38 Uterus, 39 Vagina.

The examples: ovary 27 (focus 28), the gut's submucosa on Colon - Transverse 13 (focus 14), pituitary 29 (focus 30)
(`api().examples` = `[27, 13, 29]`).

## Anchors

`library` (wall centre), `libTop`, `libBase`, `libAge` (the wall's left edge), `libAge20` and `libAge70` (the left edge's
bottom and top row: age 20 and 70), `atlas` (the arc's centre), `atlasTop`,
`umap`, `umapTop`, `focus` (the focused section's centre, or the atlas's centre), `focusTop`, `age` / `ageMark` (the
gauge's marker), `age20`, `age70` (the gauge's ends), `volcano`, `volcanoTop`, `vLeft`, `vRight`, `ex0`..`ex2` (the
examples' bubbles), `exDom0`..`exDom2` (where the example's domain lies in its focused section), `curves`, `curveAxis`,
`curve0`..`curve4` (each lane's drawing head: 0 calcified plaques, 1 infarct tissue, 2 corpus albicans, 3 submucosa,
4 adenohypophysis), `curveTag0`..`curveTag4` (each lane's right end, a lane apart: the short names beside a section), `sec0`..`sec39` (each section's centre) and `secTop0`..`secTop39` (just above it).

## Labels (at most six at once)

- Library (`atlas_lib` near 1, nothing else on): "24,945 slides", "40 tissues of 29 organs", "983 people, aged 20 to 70",
  and the rows' direction at the wall's left edge: "70 years" (top) and "20 years" (bottom; both `minor`).
- Atlas: "218 domains in 74 types". Cloud: "162 million tiles, 218 domains".
- Volcano: "28 % of domains change with age", the three examples by name and place ("Corpus albicans ovary",
  "Submucosa gut", "Adenohypophysis pituitary"; no numbers there, see below; an example's own label goes while its
  section stands beside the plot, whose label names it), "Falls with age" and "Rises with age" (hidden while a section
  is focused).
- A focused example: its domain with the preprint's numbers ("Corpus albicans 1.4 % -> 11.9 %"; beside the volcano the
  shorter "Corpus albicans 1.4 -> 11.9 %"; beside the curves none, the lane says it), and the gauge's ends "20 years"
  and "70 years" (hidden while a plot shows).
- Curves: each lane's name ("Calcified plaques arteries", "Infarct tissue heart", "Corpus albicans 1.4 -> 11.9 %",
  "Submucosa 42.9 -> 34.5 %", "Adenohypophysis 82.6 -> 67.9 %"; beside a focused section the name alone) and "Age 20
  to 70". Lanes 2 and 3 end close together: their full labels may touch (the engine nudges overlapping labels apart); the
  short names sit at `curveTag<j>`, a lane apart.
- Every number comes from `MICRO_DATA` (`facts`, `examples`).

## Cam views (`[az, el, dist, tx, ty, tz]`)

`default` and `library` [0, 6, 3.4, 0, 0, -0.12]; `atlas` [0, 3, 3.2, 0, 0, 0.14]; `umap` [24, 14, 3.3, 0, 0.05, 0.08];
`focus` [0, 4, 1.95, 0, 0, 0.72] (the focused section alone); `volcano` [-6, 9, 3.1, 0.24, 0.02, 0.1];
`curves` [-20, 14, 3.4, 0.33, -0.04, 0.08]; `age` [0, 6, 3.4, 0.2, 0.02, 0.3] (volcano or curves with a focused section);
`slides` [-8, 6, 0.75, -0.1, 0.22, -0.49] (close to the wall's middle: single slides, each a glass with its tissue; the
`library` view shows the whole wall, where a slide is 1 to 2 pixels and the wall reads as a texture). At 640 x 400 every
view holds its parts and labels inside the frame.

## Controls and explore

View: Library / Atlas / Tiles / Age / Pathology (`library`, `atlas`, `tiles`, `age`, `pathology`); Age: 20 years / 70
years (`20`, `70`, drives `atlas_age`). `explore(c)` never sets `atlas_focus` (the engine does). Age shows the volcano;
Pathology the trajectories (over the dimmed atlas).

`api()`: `tissues` (the 40 GTEx names), `short` (short British names, as in the captions), `organs` (the organ of each),
`examples` (tissue index per example, -1 if not found), `pick(raycaster)` -> tissue index or -1 (a section of the atlas
or the focused one; in the library, a tissue's column of slides), `domainColour(name)` (hex), `domains(i)` ->
`[{ name, at20, at70, colour }]` (shares in % as drawn), `tissuesOf(organ)` -> indices, `volcanoFromFigure`,
`slides` (per tissue), `tiles`.

## Domain colours

`domainColour(name)` is one colour per domain name for every set (names are matched without case; the talk's legend
spellings such as "Peyer's pathches", "medula", "adventita", "blood vessels /hemorrhage" are mapped to one spelling;
"muscularis inner", "lymphoid", "vessels" fall back to the nearest name). The talk's sections reuse one palette per
section (the same colour means different domains), so names get fixed colours instead: the gut as in its panel f
(mucosa blue, submucosa green, muscularis orange), the ovary as in panel g (corpus albicans green, ovarian cortex red,
ovarian stroma purple), connective tissue gold; the rest picked so that no two domains of a section look alike.

## Where the numbers come from (what is real, what is drawn)

- Real: 24,945 slides, 40 tissues of 29 organs, 983 people aged 20 to 70, 162 million tiles, 218 domains in 74 types,
  28 % (`MICRO_DATA.facts`); the three examples' from and to (`MICRO_DATA.examples`, the preprint's); the domains and
  their shares in 29 sections (`MICRO_DATA.figures.atlas`, pixel shares of one section each in the talk); the volcano's
  31 significant points (27 labelled and 4 unlabelled, read off the talk); the calcified-plaque and infarct curves (read
  off the talk, 5-year steps).
- Drawn or illustrative: every slide, section and tile (procedural shapes from the figure's descriptions, never the
  GTEx images); the slides per tissue (GTEx sample counts scaled to the preprint's total) and the donors' ages (GTEx's
  decades, approximately); the domains and shares of the 11 tissues the talk does not show (Adipose - Subcutaneous,
  Artery - Tibial, Cervix - Endocervix, Colon - Sigmoid, the three oesophagus tissues, Heart - Atrial Appendage,
  Kidney - Cortex, Lung, Skin - Sun Exposed); the volcano's 97 dim points (the talk's grey dots are not all readable:
  the preprint's 128 pairs); the bubbles' depth; each domain's drift with age outside the examples (the volcano's
  slope where it lists that domain and tissue, connective tissue +0.3 points a decade elsewhere); the tile cloud's
  layout (clustered by domain name, shared domains between their tissues: not the authors' embedding).
- The examples' bubbles sit where the talk draws them (the pituitary at -1.71 % a decade, where the preprint's text says
  -3.42); so the volcano's labels give no numbers. The age morph and the curves use the preprint's from and to.
- The example lanes are straight lines from the preprint's from to its to (the talk's panels are straight regression
  lines too). The pathology curves' tissue is not named in the talk's panel (a vessel is drawn): the labels say
  arteries for plaques and heart for infarct tissue, as the preprint does.

## What a narrator may say, and must not

- May: "each column is a tissue, each row a donor's age, from 20 at the bottom to 70 at the top"; "older donors are the
  majority" (the wall is fuller at the top); "each section is cut into tiles, and the tiles of all slides together form
  a cloud where tiles of the same kind of domain gather"; "connective tissue sits in the middle, shared by many
  tissues"; "the corpus albicans, scars of old follicles, grows from 1.4 to 11.9 % of the ovary".
- Must not: say the slides or sections are the GTEx images or real patients' tissue; read numbers off the cloud, the
  dim volcano points or the drawn shares of the 11 illustrative tissues; say the cloud is the authors' UMAP; give a
  per-decade number for the pituitary from the volcano.
