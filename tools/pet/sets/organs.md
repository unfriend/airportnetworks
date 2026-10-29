# `organs` - organs, uptake and the network of the cohort (sets/organs.js)

Drawn in **the body set's frame**: feet at y -0.95, 1.9 tall, faces +z, the person's left is +x, and the figure is
slimmed across by the body set's `XS` = 0.9. Show `body` (same transform) under it whenever it shows.

- **Segmentation**: a cyan scan plane sweeps down from above the head to the thighs. The body's outline at that
  height (trunk or head, thighs, arms, from the body set's own shape) glows on it. Above the plane the organs' shells
  appear: translucent, fresnel-rimmed, in the organ's colour, with faint slice bands like a segmentation mask. Where
  the plane cuts a shell, a bright white contour shows the "AI" outlining that slice. The shells are drawn
  premultiplied: each adds its glow and also dims what lies behind it a little (its rim most), so the outlines still
  read over the PET body's own bright glow.
  - Shells fitted to where the body set fills each organ, from smooth signed distance fields polygonised by surface
    nets: brain (with cerebellum and the midline cleft), thyroid (two lobes and the isthmus), lungs (the heart's notch
    cut from the left lung), heart (both ventricles and atria), liver (both lobes, cut as the body set cuts them),
    spleen, kidneys (with the hilum), adrenal glands (caps on the kidneys), muscle (both gluteus maximus muscles,
    kept under the skin).
  - Built directly: the pancreas (a tapered tube, head thicker), the intestine (the body set's own seeded coil plus
    the colon, as tubes), the aorta (arch to the split into the iliac arteries), the marrow (L1 to L5 as drums at the
    body set's vertebrae 20 to 24) and the fat (a band 5 to 17 mm under the skin from just above L1 to just below
    L5). The fat band glows at half strength and the marrow at 0.55, so they do not drown the others.
- **Uptake**: 14 neon bars to the body's right (x 0.40 to about 1.1), head to toe, with the aorta (the unit) last and
  set apart. Each bar has its icon disc and a leader line to its organ (paired organs: the left one, nearer the bars).
  A dashed line marks 1 (÷ aorta), and there is an axis with ticks at 0 to 4. Six bars carry a name with the value
  ("Brain · 4.4×"), never two neighbours.
- **The cohort slab**: the 11 bars of `f2` shrink into one person's row of cells, and their icons fly to head the
  columns. Then 657 more rows (`synth.rows`) stack behind it, front to back. The result is a glowing table of 658 x 11
  cells (height and hot-iron colour by value) at chest height to the body's right (x 0.47 to 1.13, z 0.17 back to
  -0.9).
- **Partial correlation**: a square dark-glass panel stands above the slab's front edge. The 658 stand-in people fly
  up out of the slab's rows as dots. x is organ a and y is organ b, both in standard units, so the fitted line's slope
  is r itself. With `organs_partial` the explained part is taken out: first the cloud shrinks to the residuals (what
  the other organs do not explain), then the residuals are rescaled to standard units and the line turns to the
  partial r. The line is blue when positive, red when negative and pale grey near 0.
  - Pairs 1 to 4 are the data's (`synth.pairs`: liver/spleen, heart/lungs, lungs/liver, intestine/marrow), all direct
    links of Figure 2A.
  - Pair 5 is found here in the stand-in cohort (unless the data already has such a pair): the pair with no link in
    Figure 2A whose plain correlation is largest while its partial correlation is about 0. With today's data that is
    **intestine and liver: r = 0.29, partial r = 0.00** (labelled "(paper: no link)"). It shows what a partial
    correlation is for: a link that only passes through other organs vanishes.
- **The network**: each organ's node (a dark disc with its icon and a ring in its colour) rises out of its organ,
  tethered, onto a shallow dome in front of the body (z about 0.35 to 0.46). Each node sits near its organ's height
  and is placed so that a label to its right has room. Every possible pair has an arcing tube. Its width, brightness
  and sign (blue `#4c7cff` positive, red `#ff4d4d` negative) come from the current network, and it draws on organ by
  organ (from the organ nearer the head). Hubs fill orange-yellow `#ffb020` with a slowly pulsing halo. Organs the
  network does not have fade out, and isolated ones stay without links. The node discs and halos are camera-facing
  quads sized in local units, so they keep growing as you lean in (point sprites stop at 160 px).
- **Density and disorder**: a tag under the network's title, at its left ("density 8 % · disorder 0.30"), as
  printed. There is no chart of the strengths: the one that stood to the right of the network (ranked bars and an
  exponential fit) was taken out on 29 October 2026 (the owner: "remove that from the story and the interactive
  mode"; it is in the history, with the `strength` view).
- **Lesion**: a white-hot blob with a pulsing orange halo in the right lung (x -0.099, y 0.42, z 0.03). Two crossed
  rings close in on it and turn.

## Params

| param | default | meaning, suggested keys |
| --- | --- | --- |
| `organs_a` | 1 | fade (engine) |
| `organs_seg` | 1 | the sweep. At 0 no shells, at 1 all of them (the resting look). The plane shows between 0 and 1 (in by 0.04, out from 0.9). Key it to 0 before the organs chapter, then 0 -> 1 over about 11 to 14 s. |
| `organs_suv` | 0 | the uptake bars grow head to toe (0.03 apart, each over 0.36), with icons, leaders, the unit line and labels. Key 0 -> 1 over about 4 to 6 s. |
| `organs_focus` | 0 | organ index + 1 in `PET_DATA.organs` order (brain 1 ... aorta 14), 0 for none. That organ's shell (shown even before the sweep reaches it), bar, node and links brighten, and the rest dim. A fractional value crossfades between neighbours, so **jump it** (or key it back to 0 between organs). |
| `organs_lesion` | 0 | the tumour hot spot and its rings. Key 0 -> 1 late in the body chapter, and back to 0 before the sweep. |
| `organs_rows` | 0 | 0-0.28: the f2 bars become one row (the others fade). 0.2-0.32: the slab's first row. 0.36-0.92: the other 657 rows stack. Key 0 -> 1 over about 10 s. Without `organs_suv` the row simply appears. |
| `organs_pair` | 0 | which explainer pair: 1..5 (`api().pairs` index + 1; 1 liver/spleen, 2 heart/lungs, 3 lungs/liver, 4 intestine/marrow, 5 intestine/liver, the indirect one). 0 -> 1 is also the rise (the dots fly out of the slab into the panel) unless `organs_scatter` does it. Fractional values glide the dots between neighbouring pairs, and past the last back to the first: **`NPR + 1` (6) is pair 1 again**, so to go from pair 1 to pair 5 without passing 2 to 4, jump 1 -> 6 and ramp 6 -> 5. |
| `organs_scatter` | 1 | the rise of the dots and the panel, multiplied with `min(organs_pair, 1)`. Leave it at 1 and ramp `organs_pair` 0 -> 1 over about 3 s, or jump `organs_pair` and ramp this 0 -> 1 over 3 s. (A jump of `organs_pair` 0 -> 1 with this at 1 makes the panel, dots and line appear at once.) |
| `organs_partial` | 0 | 0 the raw values and r; 0-0.55 the cloud shrinks to the residuals; 0.55-1 they are rescaled and the line turns to the partial r. The "r =" label goes by 0.4, "partial r =" comes from 0.65. Key 0 -> 1 over about 6 s. |
| `organs_net` | 0 | 0-0.48: the nodes rise (head to toe, 0.028 apart). 0.46-1: the links draw on, organ by organ. The bars, slab and panel fade by 0.35, and the shells dim to half. Key 0 -> 1 over about 9 s. |
| `organs_which` | 0 | which network: 0 `full`, 1 `FDG_healthy`, 2 `A_low`, 3 `A_high`, 4 `B_low`, 5 `B_high`, 6 `C_low`, 7 `C_mid`, 8 `C_high`, 9 `HK2`, 10 `GLUT`; extras 11 `vena`, 12 `dose_standard`, 13 `dose_ultralow`, 14 `dose_virtual`. A fractional value crossfades its two neighbours (links of one shrink while the other's grow; sizes, presence and hubs follow). **Do not ramp it across several indices** (3 -> 6 would flash 4 and 5, titles included): use `organs_prev` and `organs_mix`. |
| `organs_prev` | 0 | the network crossfaded from (an index as above, rounded). |
| `organs_mix` | 1 | 0 shows `organs_prev`, 1 shows `organs_which`, between a direct crossfade of the two. **A change of network**: at t set `organs_prev` to the old index and `organs_which` to the new one, and take `organs_mix` from 0 to 1 over 2 s (see "For the engine"). Titles, density labels and node names show only for the network holding most of the weight (never two at once; none right at the middle). |
| `organs_measures` | 0 | the density and disorder tag under the network's title (in by 0.4-0.8, only with the network: `organs_net`). Key 0 -> 1 over about 3 s. |
| `organs_ghost` | 0 | **harness only**: an instance of `SETS.body` (`body_pet` 1) under the shells at this alpha, for checking the fit. The engine leaves it at 0 and shows the real body set. Built on first use. |

### For the engine (what it does today and what it should do)

- Story, network changes: `goNet` ramps `organs_which` from the old index to the new one, so 3 -> 6, 8 -> 1 and
  1 -> 9 flash the networks between. Instead, for a change at t from index w to n (every track held by its own keys,
  so nothing drifts between changes):
  `jump('organs_prev', t, w, w); key('organs_prev', t + 2, w); jump('organs_which', t, w, n);`
  `jump('organs_mix', t, 1, 0); key('organs_mix', t + 2, 1); w = n;` (and `start` them with `organs_prev: 0,
  organs_mix: 1`).
- Story, the explainer: `jump('organs_pair', a + 15, 0, 1)` shows everything at once. Use
  `ramp('organs_pair', a + 15, a + 18, 0, 1)` (and `ramp('organs_pair', a + 32, a + 33, 1, 0)` at the end). To show the
  indirect pair after the first, at t (pair 1's partial done): `jump('organs_pair', t, 1, 6)` (the same pair),
  `ramp('organs_pair', t, t + 1.5, 6, 5)` with `ramp('organs_partial', t, t + 1, 1, 0)`, then
  `ramp('organs_partial', t + 2, t + 5, 0, 1)` (r 0.29 becomes 0.00; `api().pairs[4]` has the numbers). End it by
  fading the panel, not by ramping `organs_pair` down through the other pairs: `ramp('organs_scatter', e, e + 1, 1, 0)`
  and `jump('organs_pair', e + 1, 5, 0)`.
- Explore: add `organs_which`, `organs_prev` and `organs_mix` to `STEP` (passed on unchanged, not eased): `explore(c)`
  returns the crossfade itself (`organs_prev` the network before, `organs_mix` rising over 1.2 s of `c.t`, which the
  engine restarts when a control changes). Keep `organs_pair` in `STEP`: `explore(c)` makes it change smoothly in
  time. Eased, `organs_which` passes through the networks between, and an eased `organs_mix` barely moves.
- The engine's own hub list (`hubsOf` in `engine/e3_story.js`) falls back to computed hubs, which gives `fat` for
  `C_low` and `C_mid` and heart and lungs for `full`. The paper marks none there: use `nets[i].hubs` only.
- The engine's `NET_SHORT` still calls `FDG_healthy` "Healthy": use "FDG, 9 organs" (as this set's control does).

## Anchors

- Every organ id (all 14): a function. It sits on the organ (`PET_DATA.organs[i].pos`) while `organs_net` is 0 and
  follows the node as it rises (at the node's right edge, so labels clear the disc). The aorta has no node and stays
  on the organ.
- `bar_<id>` (14): the tip of that organ's bar.
- `seg_<id>` (14): where the sweep names the organ: on it, but never below the plane while the plane moves (nothing
  is outlined there yet); fat on its flank (x 0.135), as its home point is the body's middle.
- Also: `bars` (above the column), `unit` (the foot of the ÷ aorta line, under the axis), `matrix` (right end of the
  slab's first row), `scatter` (above the panel), `axisX`, `axisY` (the panel's axis ends), `fit` (the fitted line's
  right end, moving), `net` (the network's middle), `title` (above the network, left: [-0.62, 0.985, 0.34]),
  `measures` (under the title, left of the brain's node and above the lungs': [-0.62, 0.74, 0.34]), `lesion`, `plane` (the scan plane's
  front corner, moving), and `hub` (the current network's strongest marked hub, else `net`).

## Labels (122 entries; the rules keep at most six names on the network at once)

- During the sweep: the plane's "AI segmentation · slice by slice" (while it passes the head and chest), and each
  organ's full name for a short stretch as the plane passes the organ's top (fat a little after the marrow). Usually
  1 to 3 show at once (up to 4 in the abdomen); the adrenal and pancreas names are `minor`.
- With focus: the focused organ's name on its organ.
- Bar labels with the value for brain, heart, kidneys, fat, muscle and aorta (others when focused), and
  "÷ aorta · blood pool = 1 · typical values" under the column.
- "658 scans × 11 organs · stand-in values" (hidden once the panel rises), "658 scans · stand-ins".
- Per pair: organ a "→" at `axisX`, organ b "↑" at `axisY`, "r = 0.44", then "partial r = 0.40 (paper: 0.42)"; for
  the indirect pair "partial r = 0.00 (paper: no link)". Numbers from `synth.pairs` (pair 5: computed from
  `synth.rows`).
- On the network: hubs as "Muscle · hub" (amber; only the hubs the paper marks), plus the strongest (short names, six
  names in all), and a focused one. A node shows its plain name or its hub name, never both.
- The title with a subtitle: "All 658 scans · normalised to the aorta", "Healthy, higher BMI · BMI 24.4 or more",
  "High tumour load · tumour uptake above the median", "Inflammation, highest third · CRP 0.74 to 40.1 mg/dL",
  "FDG, 9 organs · Figure 4 · 241 scans of healthy volunteers", "Hexokinase 2 · tissue of 946 people (GTEx)".
- With `organs_measures`: "density 27 % · disorder 0.13" under the title (density as printed, `nets[i].density`;
  disorder as printed, the net's own or its Table 2 group's; none for FDG, HK2 and GLUT, which Table 3 gives density
  only).
- "Tumour" (amber) with the lesion.

## Cam views

`default` [0, 4, 3.75, 0, 0, 0] (the body, all of it) · `seg` [18, 16, 2.4, 0, 0.28, 0] (the torso, the plane seen
from a little above) · `bars` [-6, 4, 3.0, 0.42, 0.2, 0] · `matrix` [32, 30, 2.5, 0.76, 0.1, -0.32] · `scatter`
[8, 6, 2.1, 0.76, 0.52, 0.2] · `net` [8, 6, 3.1, 0.05, 0.37, 0.4] (room above the network for its title, 50 px clear
of the top bar at 400 px tall; the story's Health chapter uses it from the front, at -14 to -4 degrees, while the
measures are explained) · `lesion` [-24, 8, 1.15, -0.099, 0.42, 0.03]. Landscape framings: on a portrait phone, `net`
needs about twice the distance.

## Controls (explore)

- View (`view`): Organs / Uptake / Matrix / Partial / Network (`organs`, `uptake`, `matrix`, `partial`, `network`).
  Each sets `organs_seg` 1 and one stage on. Matrix and Partial keep the slab; Partial loops through the five pairs
  (each raw for 4 s, its residuals for 5 s, then a 1 s glide to the next, from the last back to the first; from
  `c.t`). Network shows the density and disorder tag too (`organs_measures` 1). An old link's `view=strength` is
  ignored.
- Network (`network`): All scans / FDG, 9 organs / BMI low / BMI high / Tumour low / Tumour high / CRP low / CRP mid /
  CRP high / HK2 / GLUT -> `organs_which` 0..10 (ids `full` ... `GLUT`). A change crossfades from the network before
  (`organs_prev`, `organs_mix` over 1.2 s).

## Explore API: `set.api()`

- `pick(raycaster)` -> an organ id or null. It tries the network's nodes first (once `organs_net` > 0.4), then the
  bars, then the shells (rough ellipsoids per organ; the fat band only when nothing else is hit; organs not yet
  swept are skipped). The quads of the nodes and halos ignore three.js raycasts.
- `netIds`: the 11 ids above (index = `organs_which`). `extraNetIds`: `vena`, `dose_standard`, `dose_ultralow`,
  `dose_virtual` (indices 11 to 14), for the Networks tab's robustness rows.
- `pairs`: the explainer's pairs (index + 1 = `organs_pair`): `{ a, b, r, pr, paper, indirect }`, `paper` null where
  Figure 2A has no link, `indirect` true for the one found here.
- `setFocus(id or null)`: like `organs_focus`, eased over about 0.3 s (used when the param is 0).
- `stats()` -> `{ built, jobMs, verts, tris, per, yr }` (the shell job; `yr` each shell's height range).
- Also on the set: `idle()` (the engine calls it while the set is hidden; see Performance) and `finish()` (build the
  shells now: the harness, tests, sweeps).

## For the narrator and panel

- Fine to say: an AI (MOOSE) outlines each organ and a doctor checks it. Each organ's uptake is divided by the
  aorta's (the blood pool). One row per scan: 658 scans × 11 organs. A partial correlation is what two organs share
  once the other organs are taken out: the liver and spleen keep their link (0.44 becomes 0.40; the paper: 0.42),
  while the intestine and liver, which rise together only through other organs (0.29), lose it (0.00; the paper draws
  no link). Density and disorder as labelled. Hubs as marked: the brain at higher BMI (Figure 3A), muscle at high
  tumour load and in the highest CRP third (Figures 3B, 3C). The network of all scans has no marked hub. Healthy,
  low-BMI and low-tumour-load networks are dense and even; the others are sparse with hubs.
- **Do not** present as measured:
  - the bar lengths: typical uptakes, illustrative (`organs[i].suv`); the label says "typical values".
  - the slab's values and the 658 dots: stand-ins, synthetic people with Figure 2A's partial correlations; the
    labels say so. The intestine/liver pair is found in these stand-ins (its "no link" is Figure 2A's).
  - the shells: our anatomy fitted to the tour's body, not the paper's segmentations.
  - the dome layout of the nodes: ours; the paper lays out each network differently.
- Links of Figures 3 and 4 and the dose networks are **read off the figures** (approximate weights). Only `full` and
  `vena` are printed (Figure 2A).
- `FDG_healthy` (index 1) is Figure 4's FDG network of the 241 scans of healthy volunteers on the **9 organs matched to GTEx
  tissues** (no brain, heart, kidneys or marrow). Its density is 9 %. Do not call it the healthy network of Table 2
  (30 % vs 7 % for cancer): that comparison has no drawn network. The control and title say "FDG, 9 organs".
- FDG, HK2 and GLUT have no printed disorder: their tag gives the density only.

Sources: Geist et al., Med 6, 100881 (2025): Figure 2A (printed matrices), Figures 2B, 3A-C and 4 (read off), Table 2
(densities, disorders, group labels). Organ colours and positions from `PET_DATA.organs`; anatomy fitted to
`tools/lbi/sets/body.js`.

## Performance (headless Chromium, SwiftShader, 4 CPUs shared with other agents)

- Load: the constructor takes 13-36 ms (it also finds the indirect pair: a 10 x 10 least-squares fit over 658 rows).
- The shells (30,428 vertices, 58,672 triangles, one merged mesh, one draw call) are a job.
  - Hidden: `idle()` runs it in 4 ms slices, 12 to 50 calls in all (49-311 ms of work, by load); a single step can
    run over (a tube organ or the final upload: up to about 8 ms on a quiet machine).
  - Visible but unbuilt (explore opened straight on it): `update` runs 5 ms slices (11 to 16 frames, at most about
    10 ms each), and the shells fade in over 0.5 s once done.
- Worst case, everything on (slab, panel, rising network, bars, lesion): 11 draw calls (the chart took 3), about
  147k triangles (the slab is 87k: 7,238 instanced boxes), 719 points, 105 line segments. With the ghost body, 52k
  more points.
- `update` takes about 0.05-0.1 ms, the 122 label rules 0.012 ms. Nothing is allocated per frame: colours are written
  straight into the arrays, the plane's section uses scratch arrays, attribute lists are kept.
- No buffer is rebuilt per frame. Per frame the set updates 78 link uniforms (vec4), 14 instance matrices, 38 icon
  quads, 14 halo quads, 42 moving line segments, the static lines' alphas (105 segments) and the scan plane's six
  section ellipses.
- `update` is pure: after any other history, the same params give the same buffers, uniforms, anchors and labels
  (checked in 7 cases, including crossfades and the pair glide). The only state: the shell job (and its fade-in),
  `setFocus`'s easing, and in `explore` the network asked for last.
- Robust to missing data: no edges, no networks, three organs, unknown ids and self-loops, no pairs, no rows, no
  `table2`, no `synth`.

## Implementation notes

- Shells: per organ, a field on a grid. 4-cell blocks far from the surface are filled from their centre. There is one
  vertex per crossed cell, with its normal from the grid's central differences, blended. The steps are 2.9-7.8 mm.
  Tubes, lathes and the band are built directly. All are merged into one geometry with a per-vertex organ index; the
  shader dims or brightens organs through a uniform array `uFoc[14]`. Blending: `ONE, ONE_MINUS_SRC_ALPHA` with the
  glow premultiplied and a darkening alpha of at most 0.8.
- The scan plane reveals the shells per fragment by height; the plane's own outline uses the body set's trunk rings,
  head ellipsoid and limb cones.
- The slab writes depth only while fully shown (a fading slab does not hide what is behind it).
- Links are one mesh of 78 arcing tubes (22 x 6). Their width, sign, draw-on and brightness live in `uL[78]`
  (vec4), and the vertex shader moves each vertex out from the centre line by the width.
- Networks on show: up to three with weights (`organs_prev` by `1 - organs_mix`, and `organs_which`'s two neighbours
  by `organs_mix`); every blended value (link weights, presence, strengths, hubs) is their
  weighted sum. A node's name shows while the networks that name it hold more than half the weight.
- Icons (bar icons, column heads, nodes, panel axes) and the halos are instanced camera-facing quads
  (one draw call each) from `PET_ICONS.atlas` (normal blending, drawn last, so the discs cover the links as in the
  paper). The atlas is a uniform, not `.map`, so disposing this set leaves the shared texture alone.
- Hubs: only `nets[i].hubs` (those the paper colours); `computed.hubs` is never used.
- What the data lacked or this set does not use:
  - No printed disorder for the FDG, HK2 and GLUT networks (Table 3 gives density only).
  - Figure 3D's mean strength distributions (`strength.high`, `strength.low`) are not drawn, nor is any network's
    (no charts beside the body: the owner, 29 October 2026). Explore's Networks pane names the three strongest organs
    in words.
  - The body set has no glow of its own for the gluteus, the subcutaneous fat or the adrenal glands; those shells are
    placed anatomically inside its outline.
- Untested: a real headset (comfort, the node quads up close, the shells' darkening over the body in stereo) and the
  narrow phone framing of the network with labels. In the abdomen up to four sweep names show at once on one row
  (lungs and aorta too); the engine nudges overlapping labels apart.
