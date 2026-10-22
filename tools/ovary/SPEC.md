# The aging ovary: 3D sets and engine spec

The thirteenth story of the web app in `/home/user/airportnetworks`: `stories/ovary.js`, built from `tools/ovary/` like
the microanatomy story `stories/micro.js` is built from `tools/micro/`. It turns a poster into a narrated, about
five-minute 3D story (about seven after `tools/pace.mjs`) with an explore mode, on desktop, phones and in VR/AR headsets
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
| `engine/*.js` | the engine, **copied unchanged from the microanatomy story** (only the header and the register key changed): part 2 adapts it |
| `build.mjs` | assembles `stories/ovary.js`: kit, data, look, `tools/micro/sets/organs.js` (ORGAN3D, unchanged), `tools/lbi/sets/body.js` (unchanged), organ, section, charts, engine |
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
`organ_agelab` 0..1 the age readout label; `organ_side` 0..1 to the left and smaller (for the charts beside it).
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
network over the objects (it changes with `section_age`).

Params: `section_age` 20..70 (default 30; section A); `section_pair` 0..1 younger and older side by side;
`section_vessel`, `section_macrophage`, `section_albicans`, `section_follicle`, `section_cyst` 0..1 picked out (the
poster's colors, the poster-like overlay; the rest dims); `section_tiles`, `section_feat`, `section_forest` (0 to 1 is a
whole vote: in 0.12, features flow 0.1 to 0.45, the trees answer 0.35 to 0.85, the verdict flies back 0.8 to 0.95),
`section_pred`; `section_mask` (the sweep); `section_net`. Anchors: `vessel`, `macrophage`, `albicans`, `follicle`,
`cyst`, `center`, `young`, `old`, `barYoung`, `barOld`, `tiles`, `tile`, `feat`, `forest`, `uni`, `pred`, `mask` (the
sweep), `net`. Cam: `default`, `close` (a follicle), `pair`, `tiles`, `feat`, `forest`, `mask`, `net`. Controls: View
(Section, Young and old, Tiles, Forest, Masks, Network), Age, Pick out. API `api()`: `kinds`, `pick(raycaster)` -> the
kind index of the object under the ray (or −1), `count(age, 'A'|'B')`, `objects`, `views`, `tiles`, `links`.

### `charts` (sets/charts.js, charts.md): the poster's charts in 3D

255 glass slides (drawn) fan out and stack into the age histogram (one slide per donor, the poster's bars); the four
trend panels (2 x 2 in the poster's order; illustrative dots in two layers, RF in front; the poster's lines drawn on up
to an age cursor; bands; r and p printed on each panel as on the poster); the four comparison panels (the dots fly
there; the fitted line as read and the dashed diagonal; r and p); score bars (RF precision, recall, F1 per object;
SegFormer IoU per object with the cyst).

Params: `charts_slides`, `charts_hist`, `charts_trend` (default 1), `charts_sweep` 20..70 (default 70), `charts_focus`
0..4 (0 all; 1 vessel, 2 albicans, 3 follicle, 4 macrophage, big in the middle), `charts_rf`, `charts_seg` (each
method's alpha), `charts_band`, `charts_cmp`, `charts_side` (to the right and smaller, with `organ_side` on the left),
`charts_score`, `charts_iou`. Anchors: `hist`, `histTop`, `fan`, `slides`, `t0`..`t3` (panel titles; also by kind key),
`p0`..`p3` (r and p), `end0`..`end3` (the Seg line at the cursor), `rfScores`, `iouScores`, `cyst`. Cam: `default`,
`hist`, `fan`, `trends`, `focus`, `scores`, `rf`, `iou`, `side`. Controls: Chart (Donors, Trends, Methods agree?,
Scores), Object (All, Vessels, Scars, Follicles, Macrophages), Method (Both, Random forest, Segmentation). API `api()`:
`order`, `line(kind, method, age)`, `cohortR`.

## The engine (`engine/`, copied from the microanatomy story: adapt it)

- `HOST.register('ovary', ...)` (done), `audio/narration-ovary.mp3`, `SET_ORDER = ['body', 'organ', 'section',
  'charts']`; drop what is the microanatomy story's own (MICRO_DATA, slide/atlas/hier/tissue, the Organs/Domains tabs,
  the dots on the body if not wanted; ORGAN3D may stay for a small ovary picture in the panes, `ORGAN3D.idOf('Ovary')`,
  or go with `tools/micro/sets/organs.js` from `build.mjs`). The shared-room hooks and the headset code unchanged.
- `organ` and `section` build between frames: call `idle()` while hidden (as the engine does for the motor set's heart)
  and `finish()` in the sweep and smoke tools (`sweep.mjs` already calls every set's `finish`).
- `organ` and `body` share one frame: show them together for the first shot (`body_pet` 1, `organ_body` 1,
  `organ_grow` 0), then fade the body as `organ_grow` rises.
- Chapter 5: `organ_side` 1 and `charts_side` 1 show the ovary (left) beside the charts (right), `organ_age` following
  `charts_sweep`.
- Labels with function text: `organ`'s age readout, `charts`' panel titles (they switch to the comparison's r).
- Text: plain American English, short sentences, glosses; every number from `OVARY_DATA` (`FACTS`), none hard-coded;
  `data-at` fade-ins as in the microanatomy story; frame the 3D clear of the panel.

### Chapters (about 5:15 of story time; keys, times, suggested keyframes)

1. `reserve` 0-45, the ovary and its reserve: `body_a` 1, `body_pet` 1, `organ_a` 1, `organ_body` 1, `organ_grow` 0,
   `organ_open` 0 (cam `organ.pelvis`); 8-20 `organ_grow` 0->1 while `body_a` 1->0 (cam to `organ.default`); 20-28
   `organ_open` 0->1; 28-45 `organ_parts` 1 (cam `face`, then `cortex`). "Every ovary starts with a reserve of follicles
   that is never refilled." The reserve cannot be measured directly; AMH and FSH only hint at it (`message.reserve`);
   textbook background with "about" (`background`).
2. `donors` 45-80, 255 donors: `charts_a` 1, `charts_trend` 0, `charts_slides` 0->1 (45-55, cam `fan`), `charts_hist`
   0->1 (58-68, cam `hist`); label "255 donors". H&E in one line, GTEx in one line.
3. `section` 80-125, what's in a section: `section_a` 1, `section_age` 26; pick out one kind after another with its
   annotated count (`section_vessel` 86-92, `section_macrophage` 92-98, `section_albicans` 98-104, `section_follicle`
   104-110; cam `close` for the follicle), all at once 110-114, none; `section_pair` 0->1 115-121 (cam `pair`: older,
   large corpora albicantia, almost no follicles; the scale bars).
4. `methods` 125-185, two methods: `section_tiles` 0->1 127-132 (cam `tiles`), `section_feat` 0->1 133-140 (cam `feat`),
   `section_forest` 0->1 141-158 (cam `forest`), `section_pred` 0->1 158-163; `section_mask` 0->1 164-174 (cam `mask`);
   then `charts` scores: `charts_score` and `charts_iou` 0->1 174-185 (cam `scores`; the cyst's 0.15: "hard"). Precision,
   recall, F1 and IoU in one plain line each.
5. `trends` 185-245, trends with age: `charts_trend` 1, `charts_side` 1, `organ_side` 1 (`organ_open` 1,
   `organ_agelab` 1), `charts_sweep` 20->70 with `organ_age` = the same (190-232); `charts_focus` 3 (follicles) 232-245.
   Follicles fall toward zero by about 60; vessels fall; corpora albicantia rise; macrophages flat by one method,
   falling by the other. Small print: the dots are illustrative.
6. `agree` 245-280, do the methods agree: `charts_cmp` 0->1 247-255 (`charts_side` 0, `organ_a` 0); follicles and
   vessels agree well (r +0.94, +0.78), corpora albicantia and macrophages less (segmentation finds far fewer).
7. `network` 280-315, next, a network: `section_a` 1, `section_net` 0->1 282-290 (cam `net`; label "illustrative"),
   `section_age` 25->65 292-308 (nodes and links come and go). The poster's future directions (`message.future`); the
   microanatomy story's domain contacts are the same idea. Credits (authors, affiliations, CeMM and ERC support, GTEx);
   small print: the dots and the network are illustrative; the sections are drawn, not GTEx images.

### Explore mode (tabs, HTML and canvas twins)

- **Objects**: pick one of the four, and the cyst (segmentation only): its look (`section_<kind>` and `organ_<kind>`),
  annotated count, RF scores, IoU, its trend (r, p, both methods; `charts_focus`), its comparison.
- **Age**: a slider 20 to 70: `organ_age`, `section_age`, `charts_sweep`; the expected count of each object at that age
  from each method's line, `OVARY_TREND.line` ("on the poster's trend line").
- **Methods**: tiles and the forest, or the masks, on the section; their scores.
- **Scenes**: Ovary (`organ`), Section (`section`), Charts (`charts`), with their controls.

`collab.state()`: `{ tab, scene, ctl, kind, age, method }` (never the camera or anything per device); a shared-room
entry in `tools/collab.mjs`, FORMAT `networks-16`, Arrange all with thirteen stations (seven and six).

## Open points (for `docs/questions-for-authors.md`)

Pearson or Spearman r; the y-axis scale of the trend charts (it reads as log10 with 0 at the place of 0.5); the fitted
lines (they read as straight lines in counts: linear fits?); the blood vessel F1 (0.86 shown, 0.84 from its precision
and recall); how many donors the follicle comparison has (p = 1.4e-13 with r = 0.94 suggests about 30); what counts as a
cyst; whether per-decade counts could be shared to replace the illustrative dots.
