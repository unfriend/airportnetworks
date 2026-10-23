# `scan` - the scanner and how PET sees (sets/scan.js)

The hero of the opening. A modern PET/CT after the one on the vision slide: a glossy clinical-white gantry whose front
is a softly rounded square (straight sides, a domed top, tight bottom corners, a 10 cm fillet all round) around a deep
bore, the bore's mouth in a recessed satin steel-blue band that swells into two lens-shaped pods at its sides (grey
control panels in them: a small dark screen, six buttons, a red status light), a dark status arc high on the face
with three amber lights (no brand, no text), a front cover (the CT) and a slightly larger, boxier rear housing (the
PET) with a seam between them and vertical panel grooves, a slim grey plinth, and a patient couch (a thick white table
top with a blue stripe and a soft pad, on a white carriage, a flared pedestal and a floor base). A glossy dark floor
with contact shadows and a soft mirrored reflection. Lit like a product shot (a custom "studio" shader: key over the
viewer's left shoulder, fill, sky, a clear coat reflecting a softbox studio, fresnel, a cool rim).

A person lies on the couch, head first, as a soft blue-grey glass shell (the body set's own figure, arms raised, as
for a real PET scan), with the tour's PET body set (an instance, unchanged) inside it as the image.

Cut-away (`scan_cut`): a plane sweeps down and takes away the housing's upper half (a glowing cyan edge where it cuts,
softer on the bore's cover; the dark inside of the housing showing), including the CT drum and the detector
electronics, so the **detector ring** shows: 192 x 24 dark-glass crystals (4,608, instanced; 48 blocks of 4 x 4
around, 6 deep, 33 cm long axially) on two support rings; the bore's cover opens over the ring so the crystals below
show too. Each crystal can flash (a per-instance glow, set for the few struck ones).

**Events**: a positron (magenta zigzag, about a millimetre made visible as 2 cm) leaves the sugar, meets an electron
(a white flash), and two 511 keV photons (gold streaks) fly apart in exactly opposite directions at 2.2 m/s (from
side to side of the ring in about 0.4 s); each stops where its hit shows (the crystal's face where the bore's cover is open,
else the cover), the struck crystal glows cyan and a flash stands just in front of it (scintillation); when the
second arrives (the coincidence) an orange **line of response** joins the two crystals (snapped to them round the
ring; along the axis the line keeps its exact place, so it glides with the couch) and fades. Events come only from
the slice of the patient inside the ring (a conventional ring: only that slice is seen): an event's annihilation
point is fixed in the body's frame (the first of 20 hashed pool points, moved by its positron's path, that lies in
the slice), so it moves with the patient, and none come from outside. The **featured events** (one every 2 s, which
the labels follow) come from the hottest source inside the slice (brain, heart, bladder, liver, kidneys, tumour, in
that order; jittered by a centimetre), fly slowly (1.1 m/s, as comets of seven points) and roughly sideways, rising
a little to the right (8 to 16 degrees), so the labels stay put; their line of response is a soft glowing beam that
stays faintly until the next one is drawn. The **web**: a faster stream of lines (200 a second, standing for the
millions a real scan records; every 8th of them is one of the animated events, the same event, so a line you saw
drawn stays) accumulates in one buffer of 3,000 reusable slots; drawn additively, the lines pile up into a glowing
knot where the sugar is (a simple backprojection: the dense crossings are the hot spots), fainter towards the
slice's edges (as a ring's axial sensitivity is). The web's shader places each line from the couch's pose (a
uniform), so a moving couch moves the web with the patient; the CPU only re-picks the few lines whose point leaves
the slice (about 10 a frame at the story's pace). Everything is a function of the event's index and the current
params, so seeking works (checked: two histories give identical buffers).

**The image** (`scan_image`): the couch carries the patient on through the ring to the thighs (`scan_pass` goes on
to 1 over `scan_image` 0-0.6, inside the set); the counts light up one by one in hot iron, only where the patient has
passed through the ring (a grainy first image, weighted by uptake), the lines and events fade, then the smooth image
(the body set at steady state) glows up inside the shell (0.5-0.95), which darkens to give it a dark ground; a
tumour glows in the right lung (the body set has none). With the pass done the head is just out of the gantry's
back, as in a real whole-body scan.

**The vision row** (`scan_vision`): the scanner moves left, shrinks to 0.55 and turns 31 degrees to show its side; the
patient rises off the couch and stands up as the glowing body (the same instance, its shell turned into a warm
orange fill and a bright orange rim, as on the slide; the image's hot organs show above it); to its right, linked by
flowing light (between each two stages a glowing arc of soft points, cyan to light blue, with two pulses running along
it left to right, each a bright head with a fading tail, timed from the clock so a seek shows them in place): a neon network of organs (brain, lungs, heart, liver
and kidneys from `PET_ICONS`, drawn glowing in each organ's colour with a soft fill; 12 small nodes, nine other
organs once each in their colours and three neutral white; links in their nodes' colours), then three glowing
prognosis bars (orange 80 %, red 40 %, yellow 90 % of their frames, no text) above a framed medication chart (five
neon orange bars rising from an axis). Every element fades in left to right. At 1 the row spans x -3.1 (the couch's
end) to +2.91, y -0.76 to 0.84, centred on the origin's height.

Frame: 1 unit = 1 m. Origin = the centre of the bore; its axis is z; the couch comes out towards +z; the floor is at
y = -1.05 (exported as `set.floorY`). Gantry 2.02 wide, 2.1 tall (1.05 above the bore's centre, its plinth on the
floor), 1.6 deep (front face z = +0.8, back z = -0.8); bore diameter 0.78; couch top (the pad) at y = -0.215, the table
2.3 long. The detector ring's centre plane is z = 0.

## Params

| param | default | meaning |
| --- | --- | --- |
| `scan_a` | 1 | fade (engine) |
| `scan_bed` | 0 | the couch slides in: 0 the table's head end at the gantry's face (the patient outside), 1 the head (its centre) at the ring's centre plane (travel 1.15 m) |
| `scan_pass` | 0 | **added**: the couch goes on through the ring, 0 the head in the ring, 0.4 the chest (heart and the lung tumour), 1 the pelvis to the thighs (travel 0.85 m; continuous bed motion, as modern scanners do; the paper's scans took 3 to 5 bed positions). Events come from whatever slice is in the ring; a moving couch moves the web with the patient (no rebuild). `scan_image` takes it on to 1 by itself |
| `scan_cut` | 0 | the housing's upper half goes (plane from y 1.12 down to 0.015); from 0.5 the bore's cover opens over the ring. Lights dim to 62 % with it (and with events). Closes by itself as `scan_vision` rises |
| `scan_events` | 0 | 0 none; from about 0.03 the **featured** event (one every 2 s: slow, comets, a beam for its line; the labels follow it); above 0.08 the others join, their share growing with the square of the rest ((e - 0.08) / 0.92)^2: about 1.4 a second at 0.3, 6 at 0.6, 25 at 1 |
| `scan_lines` | 0 | how many lines of the web stay: 0 none, 1 the newest 3,000 (15 s of the stream); rising, it uncovers older lines, so the web grows. Keep `scan_events` on while it rises |
| `scan_image` | 0 | 0-0.6 the couch carries the patient on through the ring (`scan_pass` to 1) and the counts light up behind it (grainy); the lines and events fade (gone by about 0.55); 0.5-0.95 the smooth image glows up; 0.62-0.95 the grains give way to it; the tumour shows from 0.45 |
| `scan_vision` | 0 | the vision row: 0-0.45 the scanner moves left; 0.08-0.5 the body rises and stands; the flowing light between the stages from 0.12, 0.36, 0.62; network 0.44-0.68; prognosis bars 0.7-0.94; medication 0.8-1 |
| `scan_floor` | 1 | **added**: the floor and its reflection; set 0 in passthrough AR |

Suggested story keys (chapters of SPEC.md):
- `title` 0-16: `scan_vision` 1 from the start (bed 0); 12 -> 16: `scan_vision` 1 -> 0 (the body lies back down, the row
  draws back into the scanner). Cam `vision`, then towards `default`.
- `scanner` 16-52: 16-22 `scan_bed` 0 -> 1 (cam `default`); 24-27 `scan_cut` 0 -> 1 and `scan_pass` 0 -> 0.4 (cam
  `ring`); 28 `scan_events` 0.05 (one clear event every 2 s with its two labels: positron, flash, two photons,
  coincidence, line of response; 0.3 adds about one other event a second); 36 `scan_events` 0.05 -> 1; 38-46
  `scan_lines` 0 -> 1 (the web grows; the knot is the heart, a second one the tumour); 46-51 `scan_image` 0 -> 1 (cam
  from about [30, 28, 3.2, 0, -0.1, 0.4]; the couch moves on by itself, the image ends up about 0.3-0.5 m further
  into the gantry than at pass 0.4-0.6). Moving `scan_pass` while lines show is fine: the web moves with the patient.
  The featured event's source follows the slice: the brain at pass 0, the tumour from about 0.25, the heart from
  about 0.35.
- `vision` 305-330: `scan_vision` 0 -> 1 over about 8 s (and `scan_cut`, `scan_events`, `scan_lines`, `scan_image`
  back to 0, `scan_bed` 0 for the slide's look).
- Explore and story rest: all at their defaults is the calm resting look (the scanner, the patient on the couch).

## Anchors (all functions or points in the set's frame; they follow the scanner when it moves in the vision row)

`centre` (bore centre), `bore` (its mouth, z 0.8), `ring` (just above the detector ring's top), `gantry` (the
gantry's top right, for "PET/CT scanner"), `couch` (the table's side near its foot end, moves with it), `patient`
(the chest), `head`, `tumour` (right lung), `event` (15 cm above the latest featured event's annihilation point, so
its label sits above the photons' paths; 10 cm above the bore's centre when none), `lor` (8 cm below the left-hand
end of the latest featured line of response that is drawn, so its label sits under the line, which rises to the
right; [-0.36, -0.2, 0] when none), `floor` (under the bore), `vision_scan`, `vision_body`, `vision_net`,
`vision_prog`, `vision_med` (above or at the top left of each row element, for labels). All but the `vision_*` points
are functions.

## Labels

"PET/CT scanner" (cyn; at rest, until the cut or the image), "Detector ring" (cyn; with the cut), "Two gamma photons
· 511 keV each" (amb; from `scan_events` 0.005, full while the featured photons fly and 0.6 s after, 45 % between)
and "Line of response" (amb; from `scan_events` 0.01, once a featured line is drawn; both gone as `scan_lines` passes
0.3-0.7 and with the image, and only while a featured event exists: alpha reads the set's state, so call it after
`update`), "FDG in the patient" (amb; image 0.5-0.9); in the row "PET scan", "One body", "One network",
"Prognosis", "Medication" (each as its element appears). At most five at once.

## Cam views

- `default` [34, 13, 7.2, 0, -0.25, 0.95]: three-quarter view of scanner and couch, slightly from above (the slide's angle).
- `front` [0, 4, 6.4, 0, -0.1, 0.4]: straight at the bore.
- `ring` [28, 22, 2.4, 0, -0.02, 0]: close to the cut ring, the web and the events inside (needs `scan_cut` 1).
- `side` [90, 6, 7.6, 0, -0.25, 0.9].
- `inside` [0, 18, 1.1, 0, -0.08, -0.35]: in the bore (26 cm above its axis, 10 cm inside its mouth) looking along
  the patient to the head (best with events and lines; the body set's image is coarse this close, so show the image
  from `ring`, `default` or the cam in the story keys). The flashes show on the bore's cover there (the housing is
  closed).
- `vision` [0, 3, 8.2, 0, -0.02, 0]: the whole row on a landscape screen with a margin (on a portrait phone it needs
  about twice the distance).
- `life` [20, 12.4, 2.56, 0, 0, 0.8]: the scanner from 2.5 m at eye height (1.6 m above the floor).

## Controls (explore)

- View: Scanner / Ring / Inside / Vision (cams: default, `ring`, `inside`, `vision`). Every view but Vision: bed 1,
  pass 0.4 (the chest in the ring), so switching views never moves the couch; Ring opens the cut, and so does Scanner
  while Events or Image is on (closed, the housing hid them); Vision shows the row (bed 0, all else off).
- Events: Off / On (`scan_events` 0 / 1). Events and Image are offered in every view but Vision (`when`).
- Image: Lines / Image (with Events on, Lines grows the web; Image forms the image and hides lines and events; the
  couch rides on to the thighs as it forms).

## API

`set.floorY` (-1.05) and `api()` -> `{ floorY, event() (the `event` anchor: 15 cm above the latest featured event's
annihilation point, in the set's frame, or null when there is none), live: { vis, img, ev } }` (`live`: the current
`scan_vision`, `scan_image`, `scan_events`). For life size in a headset put `floorY` on the floor; set `scan_floor` 0
in AR (the engine does: e7_app).

## Performance (harness, headless Chromium, software GL; other agents were sharing the 4 CPUs)

- Build: 300-540 ms cold in this round (other agents loading the CPUs; about 290 typical before), of which the body
  set's instance is about 80-140 ms; the shell's surface nets sample only blocks near the surface.
- Draw calls: 7 at rest, 9 with the image, 11-13 with the cut, events (and the featured beam) and lines, 13 in the
  vision row (4 with `scan_floor` 0). Triangles: 127k at rest (housing and couch 41.7k plus their reflection, shell
  19.8k drawn twice), 212k with the cut open (the CT, electronics and supports 29.7k and the crystals 55.3k are hidden
  until it opens). Points: body 52.4k, counts 4.4k, events up to 640. Lines: web 3,000, events up to 1,000 (packed,
  `drawRange` and `updateRange`).
- `update()` (harness): about 0.26 ms a frame with events and lines on, 0.27-0.31 ms while the couch moves (it was
  2.5 ms: the web was rebuilt every frame); p90 under 1 ms over a second of the story's couch ramp. A frame writes
  the newest web slots (about 3), re-picks the few whose point left the slice (about 10), uploads the struck
  crystals' glow (4,608 floats, only while any glows) and the packed event buffers. No arrays are made per event.
- The reflection's fragments stop where it has faded (above about 1.5 m over the floor).
- Frame time in the harness 18-100 ms (software GL, shared CPUs; not a guide to real speed). Headset frame rate and
  fill rate (the gantry's studio shader runs twice, for the reflection): untested; hiding `scan_floor` in a headset
  would halve it.

## Drawing order (renderOrder) and blending

Floor -3, reflections -2, solids 0 (depth-writing at full fade), the shell's dark pass 1, the body set's image 2 (its
points blend by maximum, so they need the dark ground the shell gives inside the bore), the shell's rim 3, counts 4,
web 5, event lines and the featured beam 6, event points 7, the row 8-9. The scanner's solids are double-sided: back
faces are the dark inside of the housing, seen through the cut; while the set fades (`scan_a` below 0.97) they are
dropped, so the fading scanner is a light ghost rather than a charcoal one showing its inside (a depth pre-pass would
have hidden the next set fading in inside the bore).

## For the narrator

- Fine to say: FDG is a sugar carrying radioactive fluorine-18; cells take it up like glucose and hexokinase traps
  it. Its positron travels about a millimetre, meets an electron, and both turn into two gamma photons of 511 keV that
  fly off in opposite directions; the ring of detectors registers both at once (a coincidence), and the line between
  the two crystals passes through where the sugar was. Millions of such lines make the image; where they cross most,
  the sugar is. Brain and heart take up the most; the kidneys and bladder glow because FDG leaves in the urine; a
  tumour shows as a hot spot. A PET/CT has a CT ring in front of the PET ring; the couch carries the patient through.
- Must not say: that the drawing is to scale in time (photons travel at the speed of light; the positron's path is
  drawn 20 times larger; a real scan records millions of coincidences a second, not 25); that the 3,000 lines are a
  reconstruction (they show the idea of backprojection; real images are reconstructed by iterative methods such as
  OSEM, as in the paper); that the network in the vision row is measured data (it is the slide's picture, illustrative);
  that the prognosis or medication bars carry numbers.
- The scanner is generic (after the slide's image): no make or model.

## Deviations from the spec, and why

- `scan_pass` and `scan_floor` added (see Params). With the head at the ring's centre plane (`scan_bed` 1), a
  conventional ring sees only the head; `scan_pass` brings the chest (heart, lung tumour) or the pelvis into the ring.
- `body_pet` is held at 1: an hour after injection the tracer is at steady state, so the image forms from counts (the
  grains) and the body set's image fades in, rather than replaying the tracer's arrival.
- The cut also takes the CT drum, its X-ray tube and the detector electronics above the plane (they hid the ring), and
  opens the bore's cover over the ring.
- Events are not uptake-weighted over the whole body at once: only the slice inside the ring is seen. Within it they
  are weighted by uptake (brain, heart muscle, kidneys, bladder, the tumour, the liver; most counts come from ordinary
  tissue, as in a real scan). Each line keeps its point in the body, so the web moves with the patient as the couch
  moves; lines whose point leaves the slice give way to new ones from it.
- `scan_image` moves the couch on (to `scan_pass` 1) as the counts come in, and the smooth image waits for the pass
  (0.5-0.95): the counts showed head to feet at once while only the chest was in the ring.
- `scan_events` grows the share of other events with its square (the story's 0.3 at the teaching moment gave about
  six other events a second around the featured one; now about one).

Sources: Geist et al., Med 6, 100881 (2025) (protocol; scanners Siemens Biograph TruePoint and Vision, GE Discovery ST; OSEM reconstruction);
standard PET physics (positron range about 1 mm in tissue for F-18, 511 keV annihilation photons, coincidence
detection, LSO-type crystal blocks); the vision slide for the scanner's look and the row.
