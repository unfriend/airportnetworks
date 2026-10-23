# The aging ovary: 3D sets and engine spec

The thirteenth story of the web app in `/home/user/airportnetworks`: `stories/ovary.js`, built from `tools/ovary/` like
the microanatomy story `stories/micro.js` is built from `tools/micro/`. It turns a poster into a narrated, about
four-and-a-half-minute 3D story (about six and a half after `tools/pace.mjs`) with an explore mode, on desktop, phones and in VR/AR headsets
(Meta Quest Browser).

- **The poster**: "Mapping the histological landscape of human ovarian aging", Parijat Chakraborty (1), Samir Moustafa
  (2, 3), André Rendeiro (1, 3). (1) Ludwig Boltzmann Institute for Network Medicine at the University of Vienna; (2)
  CeMM Research Center for Molecular Medicine of the Austrian Academy of Sciences; (3) Faculty of Computer Science,
  University of Vienna. Support: CeMM and the European Research Council (ERC). Data: GTEx. Public; the owner confirmed
  (2026-10-22) that it may be used.
- Card: kick "Ovarian aging", title **The aging ovary**, tagline "what 255 ovaries show about aging", colour `#ff6f91`;
  after the microanatomy story in `HOST.list`. Story key `ovary`.
- **American spelling in this story only** (aging, color, gray, center, hematoxylin, tumor, fiber, neighbor), as the
  qubits story; English only. The rest of the app stays British.
- Everything is drawn: no GTEx image and no image from the poster is used or copied into the repository.

The rules for sets are the tour's (`tools/lbi/SPEC.md` down to "Palette and look", and `tools/lbi/kit.js`), with the
microanatomy story's additions (sets that build between frames export `idle()` and `finish()`; a label's `text` may be a
function returning `[bold, rest]`, read again while it shows, as the qubits story's `labelText`).

## Files

| Path | What |
| --- | --- |
| `data/figures.json` | the poster's figures as read (trend lines, bands and shares at zero by decade, comparison lines, axis notes; disagreements between the two readers resolved by a third reading, listed in `resolved`) |
| `data/gen_data.mjs` | writes `sets/data.js` (`OVARY_DATA`): the poster's numbers typed in, the readings, the illustrative cohort |
| `sets/data.js` | `OVARY_DATA` (generated; its header documents every field) |
| `sets/look.js` | `OVARY_TREND` (lookups) and `OVARY_LOOK` (the shared look), pasted before the sets |
| `sets/organ.js`, `sets/section.js`, `sets/charts.js` | the three sets, each with a manifest `sets/<name>.md` |
| `engine/*.js` | the engine, adapted from the microanatomy story's (see "The engine" below) |
| `build.mjs` | assembles `stories/ovary.js`: kit, data, look, `tools/lbi/sets/body.js` (unchanged), organ, section, charts, engine |
| `harness.html`, `shot.mjs`, `sweep.mjs` | one set alone (`?set=organ&with=body&p=...&cam=<view or six numbers>`; `nofinish=1` leaves what builds between frames unbuilt), its screenshots, screenshots of the whole story |

## Data (`OVARY_DATA`, `OVARY_TREND`)

Every number the story states comes from `OVARY_DATA` (typed in exactly as the poster prints it) or `OVARY_TREND`
(lookups on it). Fields (see the header of `sets/data.js`): `source` (title, authors with affiliation indexes,
affiliations, support, data), `facts` (255 donors, ages 20 to 70, the data GTEx gives, the scale bars 1.58 mm and
791 µm), `hist` (20 bars from 21, 2.45 years wide: 9, 6, 10, 5, 7, 6, 3, 5, 13, 10, 9, 25, 15, 25, 15, 14, 12, 21, 25,
20), `kinds` (vessel, macrophage, albicans, follicle in the poster's table order, then cyst: name, plural, title, the
poster's color, annotated count, RF precision/recall/F1, IoU, trend r and p per method, comparison r and p), `chartOrder`
(vessel, albicans, follicle, macrophage: the 2 x 2 of the charts), `axes`, `methods` (rf, seg: names, colors, steps),
`trends` and `compare` (read off the figures), `message` (why, reserve, approach, future), `background` (textbook, to
be said with "about"), `cohort` (ILLUSTRATIVE dots, see below), `checks` (the F1 check: blood vessel 0.86 printed, 0.84
computed from its precision and recall; show 0.86).

`OVARY_TREND`: `line(kind, method, age)` the poster's fitted line (objects per section; the lines read as straight lines
in counts, drawn on a log axis; the follicle lines reach 0 at about 58.5 and 59); `level(kind, age)` the relative
amount at an age (each method's line over its value at 21, the two averaged; the methods disagree on macrophages);
`crossing(kind, x, rising)`; `Y(count)` the trend charts' axis (log10, 0 drawn at the place of 0.5); `rText(r)`
('+0.40', '−0.24'), `pText(p)` ('2.1×10⁻⁴', '0.497').

`OVARY_LOOK`: colors (`C`: H&E and the organ's; `KIND`: the poster's colors per kind; `GLOW`: the same lifted for the
dark scene; `KI`: kind key -> index), the lit shader (`LIT`), a mesh builder (`builder()`: merged objects that grow,
shrink or fade with the age and light up in their kind's color: `objMat(set, opts)`, `maskMat(set, opts)`, `setHi(mat,
hi, dim)`), shapes (`blob`, `ring`, `sphere`), surface nets (`nets`) and value noise (`noise3`).

**The illustrative cohort** (`OVARY_DATA.cohort`): the poster plots one dot per donor; the story draws 255 donors with
the poster's ages (filling the histogram's bars) and per kind and method a count drawn (seeded) from the bands read off
the charts (about the 10th, 50th and 90th percentiles per decade and the share at zero), the two methods tied so the
comparison gives the poster's r, the spread scaled so the trend gives the poster's r (Pearson's r on counts; with the
bands unscaled Pearson's r on counts comes closest to the printed values: ranks or log counts give follicle r near
−0.7). `cohort.r` lists what the dots give (all within 0.01 of the printed r). **The small print must say: the dots are
drawn to match the poster's trends, not the donors' values.** The lines, r and p are the poster's.

## The sets (details in each manifest)

### `organ` (sets/organ.js, organ.md): the ovary in 3D

A large cut-away ovary (about 1.9 long; signed distance fields polygonised by surface nets, built between frames, about
0.3 s of work): cortex (mauve, with follicles: primordial specks, primary and secondary follicles, antral follicles cut
open with a fluid-filled antrum and an oocyte on its mound), a corpus luteum, corpora albicantia (pale scars), the
medulla (pink) with coiled arteries and veins from the hilum, vessels cut across. Small in the tour's body (the body
set's frame: the ovary at x −0.06, y −0.06, beside its partner and the uterus) and growing out of it; the front wedge of
the cut lifts away.

Params: `organ_grow` 0 small in the body, 1 large at the centre (default 1); `organ_body` 0..1 the pelvis (the other
ovary, uterus, tubes) while small; `organ_open` 0 closed, 1 cut open (default 1); `organ_age` 20..70 (default 30: the
follicles, scars, vessels and size along `OVARY_TREND`); `organ_follicle`, `organ_albicans`, `organ_vessel`,
`organ_luteum` 0..1 picked out in the poster's colors (the rest dims); `organ_parts` 0..1 the part labels;
`organ_agelab` 0..1 the age readout label; `organ_counts` 0..1 three tags (follicles, corpora albicantia, blood
vessels) with each method's count on the poster's line at the age ("Follicles · RF 32 · Seg 43": whole numbers under
100, the nearest ten above; "none left on the lines" once both are about zero).
Anchors: `cortex`, `medulla`, `follicle`, `oocyte`, `primordial`, `secondary`, `luteum`, `albicans`, `vessel`, `hilum`,
`surface`, `blister`, `top`, `age`, `small` (the ovary's centre while small), `pelvis`. Cam: `default`, `face`, `cortex`,
`medulla`, `whole` (the intact end), `open`, `pelvis` (the body's pelvis, close), `body`. Controls: View (Cut open,
Closed, In the body), Age (20 ... 70), Show (All, Follicles, Scars, Vessels). API: `shown(age)` the counts the model
shows at an age (antral, growing, primordial, scars, vessels, luteum), `built()`.

### `section` (sets/section.js, section.md): a drawn H&E section

An H&E ovary section in 3D relief (section A, about 1.9 x 1.5, facing +z): pink stroma in whorls, purple nuclei
(denser in the cortex), and the four kinds (counts by the age along `OVARY_TREND`): vessels (a wall round a pale
lumen), macrophages (small brown cells), corpora albicantia (large pale wavy bodies), follicles (granulosa beads round
an oocyte; antral ones round an antrum; a theca that fades with them), and two cysts. Section B (an older ovary, 66,
large scars, no follicles) beside it. Method 1: tiles, UNI2 features as glowing blocks, a grove of five decision trees
voting (paths light up; one tree errs), predictions washing the tiles. Method 2: SegFormer's masks sweep across
(follicle masks a little off, IoU 0.70; the cyst's mask mostly misses it, IoU 0.15). The illustrative spatial neighbor
network over the objects (it changes with `section_age`); with `section_lift` the slab tips back about 70 degrees and
the nodes rise off it, with `section_kinds` they gather into five glowing hubs by kind (a hub's size: how many of its
objects are alive at the age) and the links into bands between kinds (a band's width: how many drawn links join those
two kinds), a slow flow along them; no numbers on them, labelled illustrative.

Params: `section_age` 20..70 (default 30; section A); `section_pair` 0..1 younger and older side by side;
`section_vessel`, `section_macrophage`, `section_albicans`, `section_follicle`, `section_cyst` 0..1 picked out (the
poster's colors, the poster-like overlay; the rest dims); `section_tiles`, `section_feat`, `section_forest` (0 to 1 is a
whole vote: in 0.12, features flow 0.1 to 0.45, the trees answer 0.35 to 0.85, the verdict flies back 0.8 to 0.95),
`section_pred`; `section_mask` (the sweep); `section_net`; `section_lift`, `section_kinds` (both need `section_net`);
`section_names` (the hubs' names). Anchors: `vessel`, `macrophage`, `albicans`, `follicle`,
`cyst`, `center`, `young`, `old`, `barYoung`, `barOld`, `tiles`, `tile`, `feat`, `forest`, `uni`, `pred`, `mask` (the
sweep), `net`, `kinds` (the middle of the hubs), `hub_vessel`, `hub_macrophage`, `hub_albicans`, `hub_follicle`,
`hub_cyst`, `tag_vessel`, `tag_macrophage`, `tag_albicans`, `tag_follicle`, `tag_cyst` (the score tags' objects). Cam:
`default`, `close` (a follicle), `pair`, `tiles`, `feat`, `forest`, `mask`, `net`, `kinds`. Controls:
View (Section, Young and old, Tiles, Forest, Masks, Network, By kind), Age, Pick out. API `api()`: `kinds`, `pick(raycaster)` -> the
kind index of the object under the ray (or −1), `count(age, 'A'|'B')`, `objects`, `views`, `tiles`, `links`.

### `charts` (sets/charts.js, charts.md): the donors in 3D

255 glass slides (drawn) fan out and stack into the age histogram (one slide per donor, the poster's bars): the story's
one graph, in passing (chapter 2 only; not a scene of explore mode). The trend, comparison and score charts and their
illustrative dots were taken out (October 2026, the owner's rule against 2D graphs): the trends are told on the ovary
(`organ_counts`) and in words, the scores as tags on the section's objects, and explore lists every number as text.

Params: `charts_slides`, `charts_hist`. Anchors: `hist`, `histTop`, `fan`, `slides`. Cam: `default`, `hist`, `fan`. No
controls.

## The engine (`engine/`, adapted from the microanatomy story's)

- `HOST.register('ovary', ...)`, `audio/narration-ovary.mp3`, `SET_ORDER = ['body', 'organ', 'section', 'charts']`,
  `FRAME = { body: 'organ' }` (one frame: the ovary sits in the body's pelvis); the microanatomy story's own parts
  (MICRO_DATA, its sets, the organ points and models, the Organs/Domains tabs) are gone, and `build.mjs` no longer
  includes `tools/micro/sets/organs.js`. The shared-room hooks, the headset code, the slideshow and the narration lines
  are the shared ones, unchanged (the headset arc and its title now make room for thirteen stories, in every story).
- `organ` and `section` build between frames: the engine calls `idle()` while a set is hidden; `sweep.mjs` and the
  smoke test call `finish()`.
- The story (`e3_story.js`): `FACTS` and the text helpers read `OVARY_DATA` and `OVARY_TREND` (`KD` by kind, `KCOL` the
  poster's colors lifted for the dark scene, `KINDS4`, `CHART`, `onLine(kind, method, age)`); `FIT` and `NARROW` frame
  each view beside the panel; labels whose text is a function are read again while they show (`labelText`, the qubits
  story's: the ovary's age and its count tags).
- `NARRATION_SYNC` is written by `node tools/pace.mjs <url> --write ovary`; run it again after the text
  changes, then the length in `HOST.list`, `audio/PUT-narration.mp3-HERE.txt` and `docs/narration.md`.
- Explore (`e4_explore.js`, canvas twins in `e6_panels.js`): `X = { tab, scene, ctl, kind, age, method }`; setters
  `selectKind(key | null, ui)` (by hand it also sets the section's and the ovary's Pick out / Show), `setAge(n)`, `setMethod('rf' | 'seg', ui)` (by hand it brings up the section's Forest or Masks view and
  plays it again), `openScene(k)`, `setCtl(k, key, v)`, `showView(k, option)`, `pickTab(k)`. The sets' own Age controls
  give way to the age slider, which drives `organ_age` and `section_age` to the year (on the Age tab the cut-away ovary
  shows its count tags, `organ_counts`). Pointing at an object on the section picks its kind (`pickWith`, the section's `api().pick`).
- Hashes: `#ovary&t=200`, `#ovary&explore&kind=follicle`, `#ovary&explore&tab=age&age=60`,
  `#ovary&explore&scene=section&view=forest` or `view=kinds` (any control by its key: `view`, `show`),
  `#ovary&explore&method=seg`, `&now` (no easing).

### Chapters (4:30 of story time; keys, times, suggested keyframes)

1. `reserve` 0-45, the ovary and its reserve: `body_a` 1, `body_pet` 1, `organ_a` 1, `organ_body` 1, `organ_grow` 0,
   `organ_open` 0 (cam `organ.pelvis`); 8-20 `organ_grow` 0->1 while `body_a` 1->0 (cam to `organ.default`); 20-28
   `organ_open` 0->1; 28-45 `organ_parts` 1 (cam `face`, then `cortex`). "Every ovary starts with a reserve of follicles
   that is never refilled." The reserve cannot be measured directly; AMH and FSH only hint at it (`message.reserve`);
   textbook background with "about" (`background`). (`organ_grow` stays 1 from 18.5: no later key may ease it back.)
2. `donors` 45-80, 255 donors: `charts_a` 1, `charts_slides` 0->1 (45-55, cam `fan`), `charts_hist` 0->1 (58-68, cam
   `hist`); label "255 donors". H&E in one line, GTEx in one line.
3. `section` 80-125, what's in a section: `section_a` 1, `section_age` 26; pick out one kind after another with its
   annotated count (`section_vessel` 86-92, `section_macrophage` 92-98, `section_albicans` 98-104, `section_follicle`
   104-110; cam `close` for the follicle), all at once 110-114, none; `section_pair` 0->1 115-121 (cam `pair`: older,
   large corpora albicantia, almost no follicles; the scale bars).
4. `methods` 125-185, two methods: `section_tiles` 0->1 127-132 (cam `tiles`), `section_feat` 0->1 133-140 (cam `feat`),
   `section_forest` 0->1 141-158 (cam `forest`), `section_pred` 0->1 158-163; `section_mask` 0->1 164-173 (cam `mask`,
   turning over the masked section to the end). From 174.5 story labels on the section's own objects (the set's `tag_*`
   anchors, spread over the section so the five read side by side): "Follicle · F1
   0.83 · IoU 0.70" and the same for blood vessels, macrophages and corpora albicantia, then "Cyst · IoU 0.15: the mask
   misses most of it" (all from `OVARY_DATA`). Precision, recall, F1 and IoU in one plain line each.
5. `trends` 185-225, trends with age: the big cut-away ovary alone (`organ_agelab` 1, `organ_counts` 1), `organ_age`
   20->70 (190-222; cams `default`, then `face`). Text: different donors at each age, not one ovary followed over time;
   all eight trend r (follicles fall, none on the lines by about 60, the share of donors in their 60s with none;
   vessels fall; corpora albicantia rise; macrophages no trend by the random forest, p 0.497, falling by segmentation,
   not drawn in this ovary); compare each method with itself; every other trend has p below 0.001 (computed); then, in
   a second turn, the agreement donor by donor (the four comparison r; the segmentation finds fewer), what r and p mean,
   and small print (r and p the poster's; the agreement's p range; the tags read off the lines: approximate).
6. `network` 225-270, next, a network: `section_a` 1, `section_age` 25, `section_net` 0->1 227-234 (cam `net`; label
   "illustrative"), `section_lift` 0->1 235-239, `section_kinds` 0->1 239.5-244 and `section_names` (cam `kinds`; label
   "Neighbor network by kind · illustrative"), `section_age` 25->65 245-261 (the follicles' hub fades by about 59, the
   scars' swells). "Gather the nodes by kind and the links become bands: which kinds lie next to which." The poster's
   future directions (`message.future`); the microanatomy story's domain contacts are the same idea. Credits (authors,
   affiliations, CeMM and ERC support, GTEx); small print: the network is illustrative; the sections are drawn, not
   GTEx images; the tags' numbers are read off the poster's lines (approximate).

### Explore mode (tabs, HTML and canvas twins)

- **Objects**: pick one of the four, and the cyst (segmentation only): its look (`section_<kind>` and `organ_<kind>`),
  annotated count, RF scores, IoU, its trend (r, p, both methods), the methods' agreement donor by donor: as text.
- **Age**: a slider 20 to 70: `organ_age`, `section_age` (the ovary shows its count tags; picking the tab by hand brings
  up the cut-away ovary); the count of each object at
  that age on each method's line, `OVARY_TREND.line` ("on the poster's trend line", rounded as the tags).
- **Methods**: tiles and the forest, or the masks, on the section; their scores as text.
- **Scenes**: Ovary (`organ`), Section (`section`, with the network By kind), with their controls. No charts anywhere in
  explore mode.

`collab.state()`: `{ tab, scene, ctl, kind, age, method }` (never the camera or anything per device); a shared-room
entry in `tools/collab.mjs`, FORMAT `networks-19` (the charts' controls went), Arrange all with thirteen stations (seven
and six).

## Open points (for `docs/questions-for-authors.md`)

Pearson or Spearman r; the y-axis scale of the poster's trend charts (it reads as log10 with 0 at the place of 0.5); the fitted
lines (they read as straight lines in counts: linear fits?); the blood vessel F1 (0.86 shown, 0.84 from its precision
and recall); how many donors the follicle comparison has (p = 1.4e-13 with r = 0.94 suggests about 30); what counts as a
cyst; whether per-decade counts could be shared (the illustrative dots are no longer drawn).
