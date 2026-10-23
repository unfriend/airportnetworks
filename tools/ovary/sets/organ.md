# `organ`: the ovary in 3D (file `sets/organ.js`)

A large cut-away ovary for chapter 1 and the age sweep of chapter 5 (Age), and the same ovary small in the tour's body for the
first shot. Lit 3D throughout (no flat cards). Sizes are exaggerated where a real one would be invisible (primordial
follicles are about 0.04 mm; here they are specks): say "drawn", never "to scale".

## What it is

- **The organ**: an almond about 1.9 long (x), 1.1 tall, 0.9 deep, gently bent, its surface (the tunica albuginea)
  pale with faint vessels; a stub at the bottom (the hilum, where vessels enter). The front of its right two thirds is
  cut away (z > 0 for x > −0.32): the cut face shows the **cortex** (a mauve band about 0.2 deep, dense, speckled) round
  the **medulla** (pink, looser). Built from signed distance fields by surface nets (`OVARY_LOOK.nets`), two meshes
  (the organ and the cut-away wedge), between frames (`idle()`, `update` while shown; `finish()` builds at once; about
  0.3 s of work in a browser). Until built, a smooth stand-in.
- **Follicles** (all in the cortex): antral follicles cut in half (holes in the face lined with granulosa cells, a
  darker theca ring round them, a glossy see-through fluid surface, the oocyte in its zona on a mound of cells, the
  cumulus), secondary and primary follicles (purple domes of granulosa cells with the oocyte showing), primordial
  follicles (about 560 specks in a band under the surface, the resting reserve), and follicles bulging the intact
  surface (blisters).
- **Corpus luteum**: one golden folded body (shown until about 50: menopause is on average about 51).
- **Corpora albicantia**: pale wavy scars in the face and puckering the surface; more with age.
- **Vessels**: coiled (helicine) arteries and veins in relief on the face, from the hilum up through the medulla, with
  branches; vessels cut across (a wall round a dark lumen).
- **In the body**: in the body set's frame (feet at y −0.95, facing +z, the person's left +x) the ovary sits small at
  x −0.06, y −0.06 (scale 0.028, turned 57°), with its partner, the uterus and the fallopian tubes.

## Age (`organ_age`, 20..70)

Each object has an age it goes by (follicles, vessels cut across) or comes at (scars), chosen so that the count follows
the poster's trend lines (`OVARY_TREND.level`: each method's line over its value at 21, the two averaged): follicles
near none by about 59, scars about 3.4 times as many at 70 as at 21, vessels cut across about 40 % fewer. A cut antral
follicle closes as it goes (its floor rises to the face, its theca fades); others shrink into their centres (over 3
years). The ovary shrinks by 16 % from 45 to 68. `shown(age)` gives what the model shows (at 20: 5 antral, 24 growing,
556 primordial, 6 scars, 36 vessels cut across, the luteum; at 60: no follicles, 18 scars, 24 vessels).

## Params

| Param | Range, default | Meaning |
| --- | --- | --- |
| `organ_a` | 0..1, 1 | fade |
| `organ_grow` | 0..1, 1 | 0 small in the body, 1 large at the centre (position, scale and turn ease between) |
| `organ_body` | 0..1, 0 | the pelvis while small: the other ovary, the uterus, the tubes (fades as `organ_grow` passes 0.3) |
| `organ_open` | 0..1, 1 | 0 closed (the wedge in place), 1 cut open (the wedge lifts up and right, fading from 0.45) |
| `organ_age` | 20..70, 30 | the age (see above) |
| `organ_follicle`, `organ_albicans`, `organ_vessel`, `organ_luteum` | 0..1, 0 | picked out in the poster's colors (lifted for the dark scene; the luteum golden), glowing a little; the rest dims |
| `organ_parts` | 0..1, 0 | the part labels |
| `organ_agelab` | 0..1, 0 | the age readout label ("Age · 35 years", a function label) |
| `organ_counts` | 0..1, 0 | three tags with each method's count on the poster's line at `organ_age` (function labels, see below) |

Suggested keyframes: chapter 1: `body_pet` 1 with `organ_body` 1, `organ_grow` 0, `organ_open` 0 (cam `pelvis`), then
`organ_grow` 0->1 (body fading), `organ_open` 0->1, `organ_parts` 1 (cams `default`, `face`, `cortex`). Chapter 5
(Age): the ovary alone, `organ_agelab` 1, `organ_counts` 1, `organ_age` 20->70 (cams `default`, `face`).

## Anchors, labels, cams, controls

- Anchors (follow the ovary's place, size and turn): `cortex` (right-hand end of the band), `medulla`, `follicle` (the
  largest antral follicle, the one that lasts longest), `oocyte`, `primordial`, `secondary`, `luteum`, `albicans` (the
  scar there earliest), `vessel`, `hilum`, `surface`, `blister`, `top`, `age`, `small` (the ovary's centre), `pelvis`.
- Labels (with `organ_parts`, once grown and open): Cortex "where the follicles are", Medulla "vessels, loose tissue",
  Follicle "fluid-filled" (while it shows), Primordial follicles "the reserve" (until about 50), Corpus albicans "a pale
  scar", Corpus luteum (until 50); the age readout with `organ_agelab`; with `organ_counts` three tags at `follicle`,
  `albicans` and `vessel`: "Follicles · RF 32 · Seg 43", "Corpora albicantia · RF 75 · Seg 16", "Blood vessels · RF
  1,000 · Seg 1,090" at 20 (`OVARY_TREND.line` per method at the age, rounded: whole numbers under 100, the nearest ten
  above; "none left on the lines" once both lines are about zero, the follicles from about 59). The lines are read off
  the poster's figures: say approximate. Macrophages have no tag (not drawn in this ovary; the two methods disagree).
- Cam: `default` [24, 14, 3.5], `face` (the cut face square on), `cortex` (close on the largest follicle), `medulla`,
  `whole` (the intact end), `open` (for the wedge lifting), `pelvis` (the body's pelvis, close), `body` (the whole body).
- Controls: View (Cut open, Closed, In the body), Age (20, 30, 40, 50, 60, 70), Show (All, Follicles, Scars, Vessels).

## Say, and do not say

- Say: follicles mature from primordial to primary, secondary and antral; after ovulation a follicle becomes a corpus
  luteum, which shrinks to a pale scar, the corpus albicans, so scars pile up over the years; about one to two million
  follicles at birth, about 300,000 to 400,000 at puberty, about a thousand at menopause (on average around 51)
  (`OVARY_DATA.background`). The model's counts follow the poster's trend lines.
- Do not say the model is to scale, or that its counts are measured: it is drawn, the counts follow the lines. The
  tags' numbers are the lines' (read off the figures, approximate), not counts of this drawn ovary.

Performance: about 60,000 to 82,000 triangles and 6 or 7 draw calls when shown (the pelvis and partner only while
small), 560 points; construction about 100 ms, the meshes about 0.3 s more between frames.
