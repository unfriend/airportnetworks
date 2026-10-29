# The PET story: 3D sets and engine spec

**Changed in October 2026, after feedback on the story:** the poster's one-scan network, its index, survival and the
immunotherapy test were taken out (they did not match the poster), with the set `people` and explore's One scan and
People tabs (the explore-only `liver` scene went too and came back the same day); the Network chapter goes straight from the organs' values to the network of all scans on the
body (no matrix of all scans, no scatter plot); the vision row's chevron arrows became flowing light. **Changed again on
28 October 2026:** the last chapter, Vision, went (its credits and the Explore button close Health; the vision row stays
in the intro), the second chapter is "How PET sees" (FDG as one tracer among others, no brackets in its text, the
photons and the line in one step, no "Millions of such lines"), the organ labels of the third are names only, the AI is
"Segmentation algorithms", the intro's note is shorter, and the scanner hands its patient over to the body set in one
move (below). **Changed again on 29 October 2026**, after two comparisons with the poster (`docs/pet-poster-comparison.md`):
the intro says "From PET scans to a network of organs" and captions the vision row as the aim (prognosis and
medication: goals, not yet shown; the row's labels say "a goal"); FDG is "mostly" not taken back; a tumour as a hot
spot is "the main application of PET scans in routine care: finding and staging cancer"; the Network chapter opens with
"a network like this needs many scans" (the paper's networks, each of a group of scans; "across scans", not people); the
Health chapter speaks of groups ("in the heavier group, the brain is a hub"; "groups with more tumour load have thinner
networks"; healthy against cancer "compared within this one set of scans"), shows the tumour-load networks (`B_low`,
`B_high`) instead of the CRP thirds (they mix healthy people and patients; within either group CRP made no clear
difference, Table 2) and drops the CRP line; the credits say the numbers are the paper's and the intro's pictures the
vision slide's; the liver scene's rule is "a rule like the poster's, applied here to patches of one organ, as an
illustration". The story is now six chapters, about six and a half minutes (6:33). This spec says what is built now;
the parts taken out are in git history.

We are adding a ninth story to the web app in `/home/user/airportnetworks`: `stories/pet.js`, built from `tools/pet/`
like the endotype story `stories/endo.js` is built from `tools/endo/`. It turns a paper, a poster and a vision slide
into a narrated, about five-and-a-half-minute 3D story with an explore mode, on desktop, phones and in VR/AR headsets
(Meta Quest Browser). Be bold and beautiful, as in the tour, the muscle story and the endotype story.

- **The paper**: Geist et al., "The metabolic organ connectome: A novel approach to measure allostatic load during
  health-to-disease transition", *Med* 6, 100881 (2025), open access (CC BY 4.0). 658 whole-body FDG-PET scans;
  each organ's glucose uptake; partial correlation networks (PCNs) of the organs across a cohort; two measures,
  density and disorder; healthy people have dense, even networks, people with cancer, obesity or inflammation sparse
  ones dominated by a few hubs (muscle and subcutaneous fat).
- **The poster** "Shaping a New Era in Nuclear Medicine" (Barbara K Geist, Alexander Grentner, Joel Fischer, Josef
  Yu, Dato Tsomaia, Adna Smajlovic, Stefan Grünert, Marcus Hacker; Division of Nuclear Medicine, Medical University
  of Vienna; LBI for Network Medicine): the next step, **one network per scan** (pairwise organ uptake ratios with a
  threshold), two measures on it (Clearance: how the kidneys handle the tracer; Heterogeneity), and from them a
  **metabolic displacement index** that separates disease states and predicts survival and response to immunotherapy.
- **The vision slide** ("The vision of One Scan, One System"): PET scanner -> the glowing body -> a network of
  organs -> prognosis and medication. Its scanner is the look for our scanner (see `scan`).

Card: kick "Whole-body PET", title **One scan, one system**, tagline "the body as a metabolic network", colour
`#ffe066`. Story key `pet`.

**The rules for sets are those of the tour**: read `tools/lbi/SPEC.md` from the top down to (and including)
"Palette and look", and `tools/lbi/kit.js`. Everything there holds here (runtime, code style, pure `update`, exports,
labels, controls, camera views, performance budget, harness, palette), with these differences:

- Your set files live in `tools/pet/sets/`, the harness is `tools/pet/harness.html` (same query syntax) and the
  screenshot tool is `tools/pet/shot.mjs` (run it from `tools/pet`; shots go to `tools/pet/shots/`, ignored by git).
  Serve the repository root on port 8123 first (`python3 -m http.server 8123` from the root; check first whether
  one is already running: `curl -sI http://127.0.0.1:8123/ | head -1`). Playwright: `node_modules` is linked into the
  repository root, so the tools find it.
- The data is the global constant `PET_DATA` (`tools/pet/sets/data.js`, made by `node tools/pet/data/gen_data.mjs`
  from the paper's tables and `tools/pet/data/figures.json`; never edit it by hand). Its header comment documents
  every field. It may be regenerated while you work (refined figure readings), with the same shape.
- The organ icons are the global `PET_ICONS` (`tools/pet/sets/icons.js`, see "Organ icons"); the harness loads it.
- The tour's PET body set (`tools/lbi/sets/body.js`, manifest `tools/lbi/sets/body.md`) is used unchanged: never
  edit it. The harness always loads it (`harness.html?set=body` shows it alone), so a set may also make its own
  instance with `SETS.body(K)` (it returns `{ group, params, update, setAlpha, ... }`: add its group as a child,
  drive its params in your `update`, call its `setAlpha`).
- No patient data anywhere: everything shown is the paper's printed numbers, values read off its figures and the
  poster's plots (group summaries only, never single patients' points), or labelled stand-ins.

## The data, in short (read the header of `sets/data.js`)

- `organs` (14): the 13 organs of the paper in this order: brain, thyroid, lungs, heart, liver, spleen, pancreas,
  kidneys, adrenal (adrenal glands), intestine, muscle (the gluteus maximus), marrow (bone marrow, between the
  vertebrae L1 and L5), fat (subcutaneous fat, L1 to L5); then the aorta (the blood-pool reference every organ is
  divided by). Each has `col` (its colour everywhere), `measure` (how the paper measures it), `pos` (a home point in
  the body set's frame) and `suv` (a typical uptake relative to the aorta, illustrative).
- `nets`: the networks: `full` (Figure 2A, all 658 scans, 11 organs, printed weights, density 12 %, disorder 0.17),
  `vena` (the same normalised to the vena cava), and read off the figures: `A_low` / `A_high` (healthy people by BMI,
  27 % / 7 %, the brain a hub at high BMI), `B_low` / `B_high` (cancer by tumour load, 18 % / 8 %), `C_low` / `C_mid`
  / `C_high` (CRP thirds, 11 % / 7 % / 3 %), `FDG_healthy`, `HK2`, `GLUT` (Figure 4). Edges `[a, b, w]`: w the signed
  partial correlation (positive blue, negative red). The nets read off figures may arrive later (empty edges until
  then): code must work with any subset of organs and any number of edges, including none.
- `table2`: every comparison of the paper's Table 2 (groups with n, density %, disorder; p values; a `note` where the printed row needs a word); `table3` the
  protein networks; `strength`: Figure 3D's strength distributions; `synth`: a stand-in cohort of 658 people with
  Figure 2A's partial correlations (`rows`, and `pairs` for the partial-correlation explainer).

## Shared facts (use exactly; the engine's `FACTS` reads them from `PET_DATA`)

- FDG (fluorodeoxyglucose) is a sugar carrying radioactive fluorine-18. Cells take it up like glucose; hexokinase
  traps it inside (it cannot be used further). Its positrons travel about a millimetre, meet an electron and turn
  into two gamma photons of 511 keV flying off in opposite directions; the scanner's ring of detectors registers both
  at once (a coincidence), and the line between them (the line of response) passes through where the sugar was.
  Millions of such lines make the image.
- Protocol (the paper): at least 6 h fasting, 250 to 300 MBq of FDG, about 60 min resting, then the scan; the image
  is a map of glucose uptake (SUV, the standardised uptake value).
- Brain and heart take up the most sugar; the kidneys and the bladder glow because FDG leaves the body in the urine
  (it is filtered, mostly not reabsorbed). A tumour shows as a hot spot: usually that is all a scan is read for.
- The paper: 658 scans of 548 people: 241 scans of healthy volunteers, 417 of people with cancer (165 lung cancer,
  252 head and neck cancer). Organs found by an AI (MOOSE, an nnU-Net model), checked by a doctor; every organ's
  uptake divided by the aorta's (the blood pool).
- A partial correlation: how two organs vary together once what all the other organs explain is taken out (each
  regressed on the rest; the correlation of what is left). It keeps direct links and drops ones that only pass
  through a third organ. Only significant ones (p < 0.05) are drawn; blue positive, red negative.
- Strength of an organ: the sum of its links' weights. Density: all strengths together as a share of the most
  possible, N (N - 1) (the full cohort: 12 %). Disorder: how fast the strengths fall when sorted (an exponential
  fit; 0 even, higher a few hubs). A hub: strength z-score above 1.7 (orange in the paper's figures).
- Healthy vs cancer: density 30 % vs 7 % (p < 0.001), disorder 0.19 vs 0.29 (p = 0.014), muscle a hub in cancer.
  BMI (healthy people, split at 24.4): 27 % vs 7 %, the brain a hub. CRP thirds: 11 %, 7 %, 3 %; disorder 0.10, 0.17,
  0.27. Tumour load: 18 % vs 8 %. Norepinephrine (stress, 40 healthy people): 14 % vs 4 %. In sparse networks muscle
  and subcutaneous fat dominate (the hubs). Robust: test-retest (6 weeks), dose (down to a tenth), scanner, sex,
  aorta or vena cava: no significant differences. Hexokinase 2's network (from GTEx tissue of 946 people) is the
  only one of the proteins tested that resembles the FDG network (r = 0.42).
- The poster (no longer shown): 630 baseline scans (healthy 80, obese 36, after a heart attack 45, lung cancer 162, head and neck cancer
  250, prostate cancer 57) and 84 follow-up scans (no intervention 47, bariatric surgery 18, immunotherapy before
  surgery 19). One network per scan: seven organs (liver, aorta, spleen, pancreas,
  kidneys, fat, muscle), pairwise uptake ratios, a threshold. Clearance and Heterogeneity; the metabolic
  displacement index (MDI) separates cancer, dyslipidaemia and health; its thirds (near healthy, intermediate,
  remote) differ in survival (median not reached, 79 and 27 months; 1-year survival 80 %, 84 %, 63 %); in 19 people
  with lung cancer given immune checkpoint inhibitors before surgery it told good from poor responders better than
  CRP, tumour stage or age (a first test in 19 people: say so). After surgery and immunotherapy the index moved towards
  the healthy range. **`PET_DATA.poster.cohort` and `PET_DATA.poster.prognosis` are gone**: the current `data.js` keeps
  only the poster's citation. They are in git as they were before commit b7053fb (`git show b7053fb^:tools/pet/sets/data.js`,
  under `poster`; the generator that wrote them: `git show b7053fb^:tools/pet/data/gen_data.mjs`). A rebuild of the
  second half around the poster would take them from there (HANDOVER.md item 8; the open points are in
  `docs/questions-for-authors.md`, P4 to P11).
- Stand-ins (say so where they show): typical organ uptakes; the 658 synthetic people behind explore's matrix and
  scatter views.

## Palette and look

The tour's dark look. The scan in the hot-iron map (black, deep red, orange, yellow, white), drawn as in the body set.
Organ colours from `PET_DATA.organs[i].col` everywhere an organ appears (shells, bars, node rings, labels' borders).
Network links as in the paper: positive `#4c7cff` (blue), negative `#ff4d4d` (red), width and brightness by |w|; hubs
glow orange-yellow `#ffb020`. Poster groups: cancer `#d9dde6` (light grey: the poster's black on our dark ground),
cancer + dyslipidaemia `#9b5de5` (purple), dyslipidaemia `#ff4fd8` (magenta), healthy `#38bdf8` (blue); survival
thirds: near healthy `#38bdf8`, intermediate `#a78bfa`, remote `#d9dde6`. The scanner: clinical glossy white with a
blue ring (see `scan`).

## Organ icons (`sets/icons.js`)

`PET_ICONS` (a global object) draws simple line icons for the 14 ids of `PET_DATA.organs`, in the style of the paper's
legend (a clean single-weight outline per organ: brain, butterfly-shaped thyroid, lungs, heart with an ECG trace,
liver, spleen, pancreas, kidney pair, adrenal glands as small caps on kidneys, intestine loops, flexed arm for
muscle, bone with marrow, belly outline for subcutaneous fat, aorta arch):
- `PET_ICONS.ids` (the 14 ids in `PET_DATA.organs` order), `PET_ICONS.draw(ctx, id, cx, cy, size, opts)` draws one
  icon centred at (cx, cy) in a square of side `size` on a 2D canvas context (`opts`: `{ color, width, glow }`, white
  by default; `glow` adds a neon blur);
- `PET_ICONS.atlas(THREE, px = 128)` returns `{ texture, canvas, uv(id) -> [u0, v0, u1, v1] }`: all icons white on
  transparent in one CanvasTexture (a 4 x 4 grid), for sprites or instanced quads (tint them in the shader). Cache it:
  calling it twice returns the same object.
Until the real icons arrive, a stub draws a circle with the organ's initials; the API stays the same.

## The sets

All sets: the tour's contract (`K.newSet(key)`, params `<key>_...`, pure `update(S, t)`, anchors, labels, cam,
controls, `explore(c)`), and a function `api()` on the set object where the engine needs more. A control may carry
`when(values)` (the scene's control values by key): the panes offer it only while that is true, so no control sits there
doing nothing; the shared state keeps every control all the same.

### `scan` - the scanner and how PET sees (file `sets/scan.js`) - the hero of the opening

**The scanner** looks like the one on the vision slide (`/tmp/claude-0/-home-user-airportnetworks/8bba4ed7-929d-5a78-8ae2-366fa273d147/scratchpad/s9/vision.png`,
the left of the image): a modern PET/CT in glossy clinical white: a big gantry whose front face is a softly rounded
square (slightly taller than wide, rounded top corners, generous fillets everywhere, no sharp edges) around a deep
round **bore** (the tunnel), the bore's mouth framed by a recessed **light-blue ring** (a satin steel-blue band,
softly glowing) with a darker grey inner tunnel; a thick housing behind the face (the gantry is deep: CT ring in
front, PET ring behind), panel seams, a slim grey plinth at the floor; a small dark status panel high on the front
(a few soft lights, no brand name or text); a **patient couch** in front: a long white table top with a soft pad,
on a grey pedestal with a curved skirt, reaching out of the bore towards the viewer; a glossy dark floor with a soft
reflection (a mirrored, faded copy is fine). Smooth geometry (lathe, extrude with bevels, rounded boxes; enough
segments that it reads as moulded plastic). Lit like a product shot: a soft key light, rim lights, fresnel.

Scale and frame: **1 unit = 1 m**, origin at the centre of the bore; the bore's axis is z (the couch comes out
towards +z, the viewer's side); the floor is at y = -1.05 (export `floorY: -1.05`). Gantry about 2.0 wide, 2.1 tall,
1.6 deep; bore diameter 0.78; couch top at about y = -0.22, 2.2 long out of the bore.

**The patient**: a person lies on the couch, head first into the bore, as a soft translucent shell (blue-grey glass,
rim-lit), with the PET image inside: make an instance of the tour's body set (`SETS.body(K)`), lay it down (rotated,
scaled to about 1.75 m long), and drive its `body_pet` with `scan_image` (the image builds as the counts come in).

**The ring and the physics** (cut-away: `scan_cut` fades the gantry's outer skin from the top half so the inside
shows): the **detector ring** around the bore: blocks of small crystals (instanced; about 48 blocks around, 4 to 8
rings deep along z), dark glassy, each crystal able to flash. **Events**: at random points in the patient, weighted
by uptake (brain, heart, kidneys, bladder brightest; a tumour in the right lung), a positron spirals out (a tiny
squiggle, about 1 mm made visible), meets an electron: a flash, and two gamma photons (bright short streaks) fly
off in exactly opposite directions at a visible speed (cross the ring in about 0.4 s), each hitting a crystal, which
flashes (scintillation); a faint **line of response** joins the two crystals and stays, so lines accumulate into a
glowing web (they fade slowly; at most a few thousand). The events must be deterministic in `t` (each event's time,
place and direction from a hash of its index), so seeking works.

Params:
- `scan_a` fade. `scan_bed` 0..1: the couch slides into the bore with the patient (0 out, 1 in; the head at the
  ring's centre plane at 1).
- `scan_cut` 0..1: the outer skin of the upper half fades and the detector ring shows.
- `scan_events` 0..1: events per second (0 none, 1 about 25 visible events per second in the camera view, plenty
  of lines).
- `scan_lines` 0..1: how many lines of response stay (0 none, 1 up to about 3,000 at once).
- `scan_image` 0..1: the image forms: the lines fade and the patient's PET image (the body instance, `body_pet`)
  glows up inside the shell.
- `scan_vision` 0..1: **the vision row** of the slide: the scanner moves to the left and shrinks a little, and to its
  right appear, linked by flowing light (a glowing arc between each two, pulses running along it left to right; the
  slide's chevron arrows looked heavy in 3D): a standing glowing PET
  body (a second body instance, or the same one stood up), a **neon network of organs** (brain, lungs, heart, liver,
  kidneys from `PET_ICONS` drawn neon: glowing coloured outlines with filled translucent shapes, linked by glowing
  lines with coloured nodes, as on the slide), and on the right **prognosis** (three glowing horizontal bars of
  different lengths, orange, red and yellow, no text) above **medication** (a glowing orange bar chart in a frame).
  At 1 the row is complete, about 6 units wide, centred on the origin's height; the engine's title card goes over it.
  Every element fades in left to right.
Anchors: `centre` (the bore's centre), `bore`, `ring` (top of the detector ring), `couch`, `patient` (the chest),
`head`, `tumour`, `event` (a function: the latest event's point), `vision_scan`, `vision_body`, `vision_net`,
`vision_prog`, `vision_med` (the row's elements), `floor` (the floor under the bore).
Labels: "PET/CT scanner", "Detector ring", "Two gamma photons, 511 keV" (near the event anchor while events run),
"Line of response", "FDG in the patient"; in the vision row "PET scan", "One body", "One network", "Prognosis",
"Medication".
Cam: `default` (three-quarter view of scanner and couch, slightly from above), `front` (straight at the bore), `ring`
(close to the cut ring, the lines inside), `side`, `inside` (in the bore looking along the patient), `vision` (the
whole row), `life` (for the headset: the scanner from 2.5 m, eye height).
Controls: View (Scanner / Ring / Inside / Vision), Events (Off / On), Image (Lines / Image).
Performance: Quest-ready: instance the crystals, lines in one buffer (ring of reusable slots), photons as points;
under 120 draw calls (the body instance included).

### `body` - the tour's PET body (file `tools/lbi/sets/body.js`, unchanged)

Read `tools/lbi/sets/body.md`. The story uses `body_pet` (the tracer arriving: injection, blood, organs, urine) and
the views `front` and `side`. Its own organ network (`body_net`, `body_state`) is the tour's illustration: this story
leaves `body_net` at 0 and draws the paper's networks with `organs` instead.

### `organs` - organs, uptake and the network of the cohort (file `sets/organs.js`)

Drawn in **the body set's frame** (feet at y -0.95, 1.9 tall, faces +z, the person's left +x; x of the body set's
modelling coordinates multiplied by its `XS` = 0.9: read `tools/lbi/sets/body.js` for where its organs are filled,
and match them), so the engine shows `body` and `organs` together, one over the other.
- **Segmentation** (`organs_seg` 0..1): a glowing horizontal scan plane sweeps down from the head to the thighs (an AI
  outlining organs slice by slice); as it passes each organ, the organ's shell appears: a smooth translucent surface
  in the organ's colour (fresnel rim, faint contour bands like a segmentation mask), fitted to where the body set
  puts that organ (signed distance fields polygonised once at load, as the muscle story's heart is: see `heart` in
  `tools/nmd/sets/motor.js`; or smooth ellipsoids and tubes where that is enough). The 13 organs and the aorta: the
  kidneys and lungs both sides, the adrenal glands as small caps on the kidneys, muscle = both gluteus maximus muscles
  (buttocks), marrow = the vertebral bodies L1 to L5, fat = a shell just under the skin of the belly and back between
  L1 and L5 (a band), the aorta from its arch down to where it splits.
- **Uptake** (`organs_suv` 0..1): each organ's value (`suv`, relative to the aorta) as a glowing bar in a column of
  bars beside the body (to its right, x > 0.35), sorted like the organs from head to toe, length by value, in the
  organ's colour, each with a thin leader line to its organ and its icon (`PET_ICONS`); the aorta's bar is the unit
  (a dashed line through all bars at 1).
- `organs_focus` 0..14 (organ index + 1, 0 none): that organ glows and its bar, node and links brighten; the rest dim.
- `organs_lesion` 0..1: a tumour hot spot in the right lung (a white-hot blob with a halo) and a ring marker round it.
- **The cohort matrix** (`organs_rows` 0..1): the bars collapse into one row of 11 cells (the organs of `f2`), the
  row slides back and 657 more rows stack behind it (`synth.rows`, cells coloured hot-iron by value): a glowing slab of
  658 people x 11 organs beside the body (or in front of it, lying like a table). Label "658 scans × 11 organs".
- **Partial correlation explainer** (`organs_pair` 0..4: `synth.pairs` index + 1, 0 none; `organs_partial` 0..1): a
  square scatter plot panel (glowing dots, the 658 stand-in people; axes labelled with the two organs' names and
  icons): x = organ a, y = organ b (`xy` raw values) with a fitted line; as `organs_partial` goes to 1 the dots glide
  to their residual positions (what the other organs do not explain) and the line turns to the partial correlation;
  a label "r = 0.44" becomes "partial r = 0.40 (paper: 0.42)".
- **The network** (`organs_net` 0..1): the organs' nodes (discs with the organ's icon, ring in its colour, size by
  strength) rise out of the organs onto a 3D arrangement around and in front of the body (readable from the front,
  good in stereo: for example a shallow dome in front of the torso, each node near the height of its organ), thin
  tethers back to the organs; links as glowing bands or tubes (blue positive, red negative, width and brightness by
  |w|), drawn on organ by organ as `organs_net` rises. Organs absent from the current network fade out.
- `organs_which` 0..10: which network, an index into this list (fractional values crossfade: links of the one grow
  while the other's shrink, node sizes follow): 0 `full`, 1 `FDG_healthy`, 2 `A_low`, 3 `A_high`, 4 `B_low`,
  5 `B_high`, 6 `C_low`, 7 `C_mid`, 8 `C_high`, 9 `HK2`, 10 `GLUT`. A network that is missing or has no edges yet
  shows its nodes only. Hubs (only the network's `hubs`: those the paper colours; never computed ones, which differ: the paper draws no hub in
  the network of all scans) glow orange-yellow and pulse slowly.
- **Density and disorder** (`organs_measures` 0..1): the current network's printed density and disorder as a tag under
  its title ("density 12 % · disorder 0.17"). The strength distribution beside the network (bars and an exponential
  fit) was taken out on 29 October 2026 (the owner: no chart beside the body, in the story or in explore).
Anchors: each organ id (on the organ while `organs_net` is 0, following its node as the network rises, like the body
set's), `bars`, `matrix`, `scatter`, `net` (the network's centre), `measures`, `lesion`, `hub` (a function: the
current network's strongest hub, or the network's centre).
Labels: organ names (with `organs_seg` and `organs_suv`; with `organs_net` on the nodes; at most about eight at
once: the focused one, hubs and the largest), "÷ aorta" at the unit line, "658 scans × 11 organs", the explainer's
r labels, density and disorder labels, the current network's title (`nets[i].title`, short).
Cam: `default` (the body from the front, all of it), `seg`, `bars` (body and bars), `matrix`, `scatter`, `net` (the
network), `lesion`.
Controls: View (Organs / Uptake / Matrix / Partial / Network), Network (the eleven above, short names:
All scans / Healthy / BMI low / BMI high / Tumour low / Tumour high / CRP low / CRP mid / CRP high / HK2 / GLUT).
Explore API `api()`: `pick(raycaster)` -> organ id or null (nodes, shells, bars), `netIds` (the list above),
`setFocus(id or null)`.
Performance: under 150 draw calls; shells merged per organ; the matrix as one instanced mesh or points.

### `liver` - an organ is a network too (file `sets/liver.js`, small)

The authors' VR viewer also shows one organ as a network of small patches. Illustrative, built from scratch (no
patient data): a liver shape (a smooth signed distance field, the right shape: big right lobe, smaller left lobe,
the notch), about 1.6 units wide, filled with about 3,000 **patches** on a regular grid (nodes as small soft points),
each with a stand-in uptake (smooth noise, a cooler patch and a warmer patch); links between patches whose uptake
ratio exceeds a threshold, within a few grid steps (about 20,000 links, faint additive lines); the best-connected
patches (top 5 %) glow brighter. Params: `liver_a` fade, `liver_grow` 0..1 (patches appear, from the centre out),
`liver_links` 0..1, `liver_top` 0..1 (the best-connected patches glow, the rest dim), `liver_spin` (turns). Anchors
`centre`, `top`. Labels "3,000 patches", "links: uptake ratio above the threshold". Cam `default`, `close`. Controls:
View (Patches / Links / Hubs). Under 20 draw calls.

## The engine (`tools/pet/engine/`, copied from the endotype story; adapt it)

Rename everything from the endotype story to this one: `HOST.register('pet', ...)`, the header comment (the paper,
the poster and the authors above), `audio/narration-pet.mp3`, `SET_ORDER = ['scan', 'body', 'organs', 'liver']` (the build includes the sets in that order), the shared-room hooks unchanged (see "Shared rooms" in
`AGENTS.md`: keep every hook line exactly), the headset code (`e5_xr.js`) unchanged except for "Life size" (below).
`body` and `organs` share one frame: wherever the story or explore mode shows `organs`, show `body` too (same
transform), with `body_pet` at 1 unless the story says otherwise.

**Chapters** (about 6:33 at the pace `tools/pace.mjs` sets; `CH` keys and story times; the narration may later be
recorded to these):
1. `title` 0-16: `scan` with `scan_vision` 1 (the vision row); title card "One scan, one system" with the tagline
   "the body as a metabolic network", the line "From PET scans to a network of organs, from health to disease" and the
   row's caption "The aim: from a scan to one network of the body, then prognosis and medication (goals, not yet
   shown)". Then the row draws back into the scanner (`scan_vision` 1 -> 0).
2. `scanner` 16-52, "How PET sees": `scan`: the couch slides in (`scan_bed`), the tracer explained (FDG, the most
   common, a glucose look-alike carrying fluorine-18; fasting, an hour's rest), `scan_cut` shows the ring, `scan_events` on: positron, annihilation, two photons,
   coincidence, line of response (one step: "Two photons, one line"); lines accumulate (`scan_lines`), then
   `scan_image`: the image.
3. `body` 52-90: one continuous move, no jump of the camera or the body (the owner's note, October 2026: hide the
   scanner, stand the body up, fade the organs, then the sugar): the scanner goes and leaves the patient's image
   (`scan_rise` 0-0.25, 1.5 s, the camera holding), which stands up and turns to exactly where, and as large as, `body`
   stands in its front view, the camera easing to that view in step (0.25-0.75, 3.5 s; the scan set's `riseTo.yaw` is
   the turn `buildCamera` gives `body` at the hand-over), then its glow cools to dark (0.75-1, 1.5 s) while `body` fades
   in, dark at `body_pet` 0, and `scan` out; then `body_pet` 0 -> 1 over about 8 s (the tracer arriving, from 6.5 s,
   with the first paragraph), with `organs` (`organs_lesion` on later). Text: where the sugar goes (brain and heart most; kidneys and bladder because
   FDG leaves in the urine, mostly not taken back); a tumour shows as a hot spot: "This is the main application of PET scans in routine care: finding and staging cancer". Labels: Brain, Heart, Kidneys,
   Bladder, Tumour, names only. "Yet the scan holds
   every organ's metabolism at once."
4. `organs` 90-128: `organs_seg` (segmentation algorithms outline up to 13 organs, a doctor checks), `organs_suv` (each organ's uptake divided
   by the aorta's), a moment of focus on two or three organs (brain, liver, muscle).
5. `cohort` 128-146: the organs' bars make way (`organs_suv` 1 -> 0) and the network of all 658 scans grows on the
   body (`organs_net` 0 -> 1, `organs_which` 0); text: a network like this needs many scans (one scan gives one row of
   numbers; these networks are the paper's, each of a group of scans), the paper's 658 scans (241 of healthy
   volunteers, 417 with cancer), what a link means (organs rising and falling together across scans; a partial
   correlation, unlikely to be chance, blue or red) in one paragraph, then the network (11 organs, 25 links, density
   12 %).
6. `health` 146-200: `organs_which` to 1 (healthy, if read; else stay) then the comparisons: BMI (2 -> 3: 27 % to 7 %,
   in the heavier group the brain is a hub), tumour load (4 -> 5, `B_low` and `B_high`: 18 % to 8 %, among people
   with cancer; "so do groups with more stress hormone", among healthy people; not the CRP thirds, which mix healthy
   people and patients), with `organs_measures` (density, disorder: an even network vs one with hubs; muscle and fat
   dominate in sparse networks, muscle a hub); healthy 30 % vs cancer 7 % stated in text, "compared within this one
   set of scans"; group wording throughout, never individual or causal; robustness in one line (6 weeks apart, a tenth of the dose, another scanner: the same network); HK2 in one
   line.
   It ends (from 47.5 s into the chapter, 200 in all) with the credits: the poster's authors, the Division of Nuclear
   Medicine (Medical University of Vienna) and the LBI for Network Medicine, the Explore button, and the small print
   "Numbers and networks: the paper ... (of all 658 scans printed there, the others read off its figures). Poster: ...
   The intro's pictures: the vision slide. Organ values: illustrative."
   (The Vision chapter that followed, the row again with prognosis and medication, went on 28 October 2026.)

Text: plain British English, short sentences, no jargon without a gloss; every number from `PET_DATA` (`FACTS`), none
hard-coded; chapter panels with `data-at` fade-ins as in the endotype story. Story labels on set anchors.

**Explore mode** tabs (HTML and canvas twins, as in the endotype story):
- **Networks** (the paper): a list of comparisons (Table 2's rows, grouped "Is it robust?" (`part` 'test') and "Health
  to disease" (`part` 'health')); picking one shows its groups with n, density and disorder (and which differences
  are significant), and, where a network was drawn (`nets`: full, healthy, BMI, tumour load, CRP thirds), shows it
  in `organs` (`organs_which`), its density and disorder under its title; a line on hubs, one on its strongest organs. Also the protein networks (Table 3)
  as a short list.
- **Organs**: the 14 organs as chips (icon, colour, name); picking one shows how it is measured (`measure`), its
  links in the network of all scans (Figure 2A, with weights and signs), whether it is a hub in any drawn network,
  and focuses it (`organs_focus`).
- **Scenes**: Scanner (`scan` controls), Body (`body` controls), Organs (`organs`), Liver (`liver`, only here).
URL hashes: `#pet&t=120`, `#pet&explore&tab=networks&cmp=7` (a Table 2 row), `&net=C_high`, `&organ=muscle`,
`&scene=scan&view=ring`, `&life` (life size).
`collab.state()`: `{ tab, scene, ctl (every scene's controls), cmp, net, organ }` (plain JSON, the same on every device;
`apply(state())` gives the same state back).

**Life size** (the endotype story's *Stand in the gap*, adapted; an Explore view control and in the Scenes tab):
on screen a view from 2.5 m at eye height; in a headset the `scan` set life size (1 unit = 1 m) standing on your
floor (its `floorY` at the floor: 1.6 m below your eyes, as the flock's land is placed), about 1.5 m in front of you,
the couch towards you, events running: walk round it, look into the bore. In AR the floor reflection is hidden.

## Deliverables

For each set: `sets/<file>.js`, `sets/<file>.md` (manifest: params with meaning and suggested story keyframes,
anchors, labels, cam views, controls, explore API, what a narrator may and must not say), final screenshots
`shots/<key>-final-<k>.png` (small: 640x400). Test in the harness only (never run the whole app's smoke test; that is
the integrator's job). The engine: `engine/*.js` adapted, `node tools/pet/build.mjs` builds `stories/pet.js`.
