# `organs` - organs, uptake and the network of the cohort (sets/organs.js)

Drawn in **the body set's frame**: feet at y -0.95, 1.9 tall, faces +z, the person's left is +x, and the figure is
slimmed across by the body set's `XS` = 0.9. Show `body` (same transform) under it whenever it shows.

- **Segmentation**: a cyan scan plane sweeps down from above the head to the thighs. The body's outline at that
  height (trunk or head, thighs, arms, from the body set's own shape) glows on it. Above the plane the organs' shells
  appear: translucent, fresnel-rimmed, in the organ's colour, with faint slice bands like a segmentation mask. Where
  the plane cuts a shell, a bright white contour shows the "AI" outlining that slice.
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
  A dashed line marks 1 (÷ aorta), and there is an axis with ticks at 0 to 4.
- **The cohort slab**: the 11 bars of `f2` shrink into one person's row of cells, and their icons fly to head the
  columns. Then 657 more rows (`synth.rows`) stack behind it, front to back. The result is a glowing table of 658 x 11
  cells (height and hot-iron colour by value) at chest height to the body's right (x 0.47 to 1.13, z 0.17 back to
  -0.9).
- **Partial correlation**: a square dark-glass panel stands above the slab's front edge. The 658 stand-in people fly
  up out of the slab's rows as dots. x is organ a and y is organ b, both in standard units, so the fitted line's slope
  is r itself. With `organs_partial` the dots glide to their residuals (also standardised) and the line turns to the
  partial r. The line is blue when positive and red when negative, as in the network. Fractional `organs_pair`
  values glide the dots from one pair to the next.
- **The network**: each organ's node (a dark disc with its icon and a ring in its colour) rises out of its organ,
  tethered, onto a shallow dome in front of the body (z about 0.35 to 0.46). Each node sits near its organ's height
  and is placed so that a label to its right has room. Every possible pair has an arcing tube. Its width, brightness
  and sign (blue `#4c7cff` positive, red `#ff4d4d` negative) come from the current network, and it draws on organ by
  organ (from the organ nearer the head). Hubs fill orange-yellow `#ffb020` with a slowly pulsing halo. Organs the
  network does not have fade out, and isolated ones stay without links.
- **Strength and disorder**: to the right of the network (x 0.88 to 1.56) is a chart of the current network's
  strengths (sum of |w|), sorted high to low. The bars are outlined in the organ's colour (hubs orange), each has its
  icon below, and a gold ribbon shows the exponential fit `fitA · exp(-disorder · rank)`. Changing `organs_which`
  slides the bars to their new ranks.
- **Lesion**: a white-hot blob with a pulsing orange halo in the right lung (x -0.099, y 0.42, z 0.03). Two crossed
  rings close in on it and turn.

## Params

| param | default | meaning, suggested keys |
| --- | --- | --- |
| `organs_a` | 1 | fade (engine) |
| `organs_seg` | 1 | the sweep. At 0 no shells, at 1 all of them (the resting look). The plane shows between 0 and 1 (in by 0.04, out from 0.9). Key it to 0 before the organs chapter, then 0 -> 1 over about 14 s (90-104). |
| `organs_suv` | 0 | the uptake bars grow head to toe (0.03 apart, each over 0.36), with icons, leaders, the unit line and labels. Key 0 -> 1 over about 4 s (106-110). |
| `organs_focus` | 0 | organ index + 1 in `PET_DATA.organs` order (brain 1 ... aorta 14), 0 for none. That organ's shell (shown even before the sweep reaches it), bar, node, links and chart bar brighten, and the rest dim. A fractional value crossfades between neighbours, so **key it back to 0 between organs** (1 -> 0 -> 5 -> 0 -> 11) or the ones in between flash. |
| `organs_lesion` | 0 | the tumour hot spot and its rings. Key 0 -> 1 late in the body chapter (about 76-79), and back to 0 before the sweep. |
| `organs_rows` | 0 | 0-0.28: the f2 bars become one row (the others fade). 0.2-0.32: the slab's first row. 0.36-0.92: the other 657 rows stack. Key 0 -> 1 over about 10 s (129-140). Without `organs_suv` the row simply appears. |
| `organs_pair` | 0 | 0 -> 1: the dots rise out of the slab into the panel (pair 1). 1..4: `synth.pairs` index + 1 (1 liver/spleen, 2 heart/lungs, 3 lungs/liver, 4 intestine/marrow). Fractional values glide between pairs. Key 0 -> 1 over 3 s (142-145). |
| `organs_partial` | 0 | 0 the raw values and r, 1 the residuals and the partial r. Key 0 -> 1 over 3 s (150-153). |
| `organs_net` | 0 | 0-0.48: the nodes rise (head to toe, 0.028 apart). 0.46-1: the links draw on, organ by organ. The bars, slab and panel fade by 0.35, and the shells dim to half. Key 0 -> 1 over about 10 s (158-168). |
| `organs_which` | 0 | which network: 0 `full`, 1 `FDG_healthy`, 2 `A_low`, 3 `A_high`, 4 `B_low`, 5 `B_high`, 6 `C_low`, 7 `C_mid`, 8 `C_high`, 9 `HK2`, 10 `GLUT`; extras 11 `vena`, 12 `dose_standard`, 13 `dose_ultralow`, 14 `dose_virtual`. Fractional values crossfade: links of one shrink while the other's grow, and sizes, presence, hubs and chart ranks follow. Easing across several indices passes through the networks in between (for 3 -> 6, 4 and 5 flash by), so key neighbours or make such steps quick. |
| `organs_strength` | 0 | the chart: panel and axes by 0.5, bars grow 0.15-0.75, the fit draws 0.5-1. |
| `organs_ghost` | 0 | **harness only**: an instance of `SETS.body` (`body_pet` 1) under the shells at this alpha, for checking the fit. The engine leaves it at 0 and shows the real body set. Built on first use. |

## Anchors

- Every organ id (all 14): a function. It sits on the organ (`PET_DATA.organs[i].pos`) while `organs_net` is 0 and
  follows the node as it rises (at the node's right edge, so labels clear the disc). The aorta has no node and stays
  on the organ.
- `bar_<id>` (14): the tip of that organ's bar.
- Also: `bars` (above the column), `unit` (top of the ÷ aorta line), `matrix` (right end of the slab's first row),
  `scatter` (above the panel), `axisX`, `axisY` (the panel's axis ends), `fit` (the fitted line's right end), `net`
  (the network's middle), `title` (above the network, left), `strength` (above the chart, left), `lesion`, `plane`
  (the scan plane's right edge, moving), and `hub` (the current network's strongest hub, or `net`).

## Labels (105 entries; the rules keep about eight at once)

- During the sweep: the plane's "AI segmentation · slice by slice", and each organ's full name for a short stretch
  as the plane passes the organ's top. Usually 1 to 4 show at once; the adrenal and pancreas names are `minor`.
- With focus: the focused organ's name on its organ.
- Bar labels (short names) for brain, heart, liver, kidneys, muscle, fat and aorta (others when focused), and
  "÷ aorta · the blood pool = 1".
- "658 scans × 11 organs · stand-in values" (hidden once the panel rises), "658 people · stand-ins".
- Per pair: organ a "→" at `axisX`, organ b "↑" at `axisY`, "r = 0.44", then "partial r = 0.40 (paper: 0.42)".
  All numbers come from `synth.pairs`.
- On the network: hubs as "Muscle · hub" (amber), plus the six strongest (short names), and a focused one. The
  title, with its Table 2 group as the rest (for example "Healthy, higher BMI · BMI 24.4 or more", "CRP, highest
  third · 0.74 to 40.1 mg/dL", "All 658 scans · normalised to the aorta").
- With the chart: "density 27 % · disorder 0.13". Density is as printed (`nets[i].density`). Disorder is as
  printed: the net's own `disorder`, else its Table 2 group's. If neither exists (FDG_healthy, HK2, GLUT) it is the
  fit to the drawn links, shown as "≈ 0.09".
- "Tumour · a hot spot" (amber) with the lesion.

## Cam views

`default` [0, 4, 3.75, 0, 0, 0] (the body, all of it) · `seg` [18, 16, 2.4, 0, 0.28, 0] (the torso, the plane seen
from a little above) · `bars` [-6, 4, 3.0, 0.42, 0.24, 0] · `matrix` [32, 30, 2.5, 0.76, 0.1, -0.32] · `scatter`
[8, 6, 2.1, 0.76, 0.52, 0.2] · `net` [8, 6, 2.6, 0.06, 0.28, 0.4] · `strength` [-6, 4, 3.3, 0.5, 0.26, 0.36]
(network and chart together) · `lesion` [-24, 8, 1.15, -0.099, 0.42, 0.03]. Landscape framings: on a portrait
phone, `net` and `strength` need about twice the distance.

## Controls (explore)

- View: Organs / Uptake / Matrix / Partial / Network / Strength. Each sets `organs_seg` 1 and one stage on.
  Partial also keeps the slab, and loops through the four pairs every 10 s (4 s raw, 6 s residuals, from `c.t`).
  Strength is the network plus the chart.
- Network: All scans / Healthy / BMI low / BMI high / Tumour low / Tumour high / CRP low / CRP mid / CRP high / HK2 /
  GLUT -> `organs_which` 0..10.

## Explore API: `set.api()`

- `pick(raycaster)` -> an organ id or null. It tries the network's nodes first (once `organs_net` > 0.4), then the
  bars, then the shells (rough ellipsoids per organ; the fat band only when nothing else is hit; organs not yet
  swept are skipped).
- `netIds`: the 11 ids above (index = `organs_which`). `extraNetIds`: `vena`, `dose_standard`, `dose_ultralow`,
  `dose_virtual` (indices 11 to 14), for the Networks tab's robustness rows.
- `setFocus(id or null)`: like `organs_focus`, eased over about 0.3 s (used when the param is 0).
- `stats()` -> `{ built, jobMs, verts, tris, per }` (the shell job).
- Also on the set: `idle()` (the engine calls it while the set is hidden; see Performance) and `finish()` (build the
  shells now: the harness, tests, sweeps).

## For the narrator and panel

- Fine to say: an AI (MOOSE) outlines each organ and a doctor checks it. Each organ's uptake is divided by the
  aorta's (the blood pool). One row per scan: 658 scans × 11 organs. A partial correlation is what two organs share
  once the other organs are taken out (the paper's liver-spleen 0.42). Density and disorder as labelled. Hubs as
  marked: the brain at higher BMI (Figure 3A), muscle at high tumour load and in the highest CRP third (Figures 3B,
  3C). Healthy, low-BMI and low-tumour-load networks are dense and even; the others are sparse with hubs.
- **Do not** present as measured:
  - the bar lengths: typical uptakes, illustrative (`organs[i].suv`); say "typical".
  - the slab's values and the 658 dots: stand-ins, synthetic people with Figure 2A's partial correlations; the
    labels say so.
  - the shells: our anatomy fitted to the tour's body, not the paper's segmentations.
  - the dome layout of the nodes: ours; the paper lays out each network differently.
- Links of Figures 3 and 4 and the dose networks are **read off the figures** (approximate weights). Only `full` and
  `vena` are printed (Figure 2A).
- `full`'s hubs (heart and lungs) and `vena`'s (lungs) are not marked in the paper's Figure 2A. They come from
  applying the paper's rule (strength z-score above 1.7) to the printed weights. Say "by the paper's rule" or leave
  hubs out there.
- `FDG_healthy` (index 1) is Figure 4's FDG network of the 241 healthy people on the **9 organs matched to GTEx
  tissues** (no brain, heart, kidneys or marrow). Its density is 9 %. Do not call it the healthy network of Table 2
  (30 % vs 7 % for cancer): that comparison has no drawn network.
- The chart's curve is the fit to the shown strengths (`computed`), so it can differ a little from the printed
  disorder in the label. For example, the full network's printed disorder is 0.17, while the fit to its printed
  weights gives 0.22.

Sources: Geist et al., Med 6, 100881 (2025): Figure 2A (printed matrices), Figures 2B, 3A-C and 4 (read off), Table 2
(densities, disorders, group labels). Organ colours and positions from `PET_DATA.organs`; anatomy fitted to
`tools/lbi/sets/body.js`.

## Performance (headless Chromium, SwiftShader, 4 CPUs shared with other agents)

- Load: the constructor takes 15-21 ms.
- The shells (30,428 vertices, 58,672 triangles, one merged mesh, one draw call) are a job.
  - Hidden: `idle()` runs it in 4 ms slices, about 35 frames in all; the largest single step is about 13 ms (a
    tube organ or the final upload).
  - Visible but unbuilt (explore opened straight on it): `update` runs 12 ms slices, and the shells appear when done.
  - The whole job takes 96-266 ms, depending on load.
- Worst case, everything on (slab, panel, rising network, chart, bars): 11 draw calls, about 146k triangles (the slab
  is 87k: 7,238 instanced boxes), 708 points, 115 line segments, about 6 ms a frame in the harness. With the ghost
  body: 15 calls, 52k more points.
- No buffer is rebuilt per frame. Per frame the set updates:
  - 78 link uniforms (vec4), 14 + 13 instance matrices, the chart's fit ribbon (61 x 2 vertices), 50 icons,
    13 halos and 42 moving line segments;
  - the static lines' alphas (115 segments);
  - the scan plane's six section ellipses.

## Implementation notes

- Shells: per organ, a field on a grid. 4-cell blocks far from the surface are filled from their centre. There is one
  vertex per crossed cell, with its normal from the grid's central differences, blended. The steps are 2.9-7.8 mm.
  Tubes, lathes and the band are built directly. All are merged into one geometry with a per-vertex organ index; the
  shader dims or brightens organs through a uniform array `uFoc[14]`.
- The scan plane reveals the shells per fragment by height; the plane's own outline uses the body set's trunk rings,
  head ellipsoid and limb cones.
- Links are one mesh of 78 arcing tubes (22 x 6). Their width, sign, draw-on and brightness live in `uL[78]`
  (vec4), and the vertex shader moves each vertex out from the centre line by the width.
- Icons are point sprites from `PET_ICONS.atlas` (normal blending, drawn last, so the discs cover the links as in the
  paper). The atlas is a uniform, not `.map`, so disposing this set leaves the shared texture alone.
- Hubs: a figure-read network uses the hubs its figure marks (`nets[i].hubs`). An exact one (Figure 2A) uses the
  paper's rule applied to its printed weights (`computed.hubs`).
- What the data lacked or this set does not use:
  - No printed disorder for the FDG, HK2 and GLUT networks (Table 3 gives density only).
  - Figure 3D's mean strength distributions (`strength.high`, `strength.low`) are not drawn: the chart shows the
    current network's own.
  - The body set has no glow of its own for the gluteus, the subcutaneous fat or the adrenal glands; those shells are
    placed anatomically inside its outline.
- Untested: a real headset (comfort, the point-sprite discs up close, where a sprite caps at 160 px) and the narrow
  phone framing of the network with labels.
