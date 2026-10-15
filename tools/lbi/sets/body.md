# `body` - whole-body networks (sets/body.js)

Slides 34-35. A standing figure, arms raised with the hands crossed above the head, shown as a total-body PET scan:
about 52k glowing points in the hot-iron colour map, drawn with **max blending**, so every pixel shows the
brightest point along its ray. That is a true maximum-intensity projection (MIP), which is how the scans on the
slides are shown, and it stays correct from any angle and in stereo. Then 12 organ nodes rise out of their organs
onto a cage around the body. White bands (width = link strength) wind around the figure between them, and the
links rewire between a healthy and a disease network.

Size: feet at y -0.95, hands at +0.95 (1.9 tall). The body faces +z; the person's left is +x. The network cage
spans y -0.42 to 0.8 and, with its labels, is about 1.3 units wide.

## Params

| param | default | meaning |
| --- | --- | --- |
| `body_a` | 1 | fade (engine) |
| `body_pet` | 1 | **Tracer time**: 0 is the injection, 1 the steady scan. 0-0.05: the bolus runs up a vein of the right arm while a faint outline of the whole body appears. 0.04-0.12: right heart, then the lungs flash. 0.09-0.45: the arteries light up from the heart out to the head, hands and feet. 0.1-0.35: kidneys, liver and spleen. 0.12-0.75: heart muscle, brain, tissue and bone. 0.26-0.8: urine collects (renal pelvis, ureters). 0.5-0.96: the bladder fills. At exactly 0 nothing is drawn. Every value gives a valid picture, so the param can be scrubbed. |
| `body_net` | 0 | The organ network. 0-0.45: nodes pop out of the organs one by one and fly to the cage; thin tethers stay. 0.42-1: the bands draw on, staggered. The scan cools and dims to a ghost as this param rises. |
| `body_state` | 0 | 0 is the healthy network and scan, 1 the disease network and scan. Lost links retract and thin; new links draw on from one organ to the other, tinted amber; shared links change width. Node size follows the organ's total link strength. The scan morphs too (illustrative, after slide 35): tissue and muscle take up more (+0.02 to +0.10), the heart muscle about 45% less, the kidneys and urinary tract about 18% less. |
| `body_blank` | 0 | Only for the explore loop: it blacks out the scan while the tracer clock rewinds. The story can leave it at 0. |

The story timing in `eng/e3_story.js` (pet a+0.5..a+6, net a+10..a+13, state a+17..a+20) fits well. A pet ramp
slower than about 4 s lets the viewer see the blood flash before the organs light up.

## Anchors

`brain`, `thyroid`, `lungs`, `heart`, `liver`, `stomach`, `spleen`, `pancreas`, `kidneys`, `intestine`,
`bladder`, `marrow` (bone marrow), `head`, `feet`, `injection` (the injection site in the right forearm, where
the tracer goes in) and `aorta` (its arch above the heart, where the arteries light up from).
The organ anchors are **functions**. They sit on the organ while `body_net` is 0 and follow the node out to the
cage as the network appears. The same anchor therefore works for "the brain takes up the most" during the scan
and for the network label later. `lungs` and `kidneys` are anchored on the person's **right** organ (screen
left in the front view), and `marrow` on the left side of the pelvis.

## Labels

12 organ names (`Brain`, `Thyroid`, `Lungs`, `Heart`, `Liver`, `Stomach`, `Spleen`, `Pancreas`, `Kidneys`,
`Intestine`, `Bladder`, `Bone marrow`), cls '', alpha `prog(body_net, 0.5, 0.8)`. The cage layout (angle, height
and radius per node) comes from a search in `tools/body_cage.cjs`. It projects the label boxes, with a 2 px
margin, from the front half (az -40 to 60, el 4 to 25), both sides (az ±75 to ±120) and the back. I checked the
result in screenshots from az 0, 14, 30, -40 and 90: no label covers another one or a node.

## Cam views

- `default` = `front` `[0, 4, 3.75, 0, 0, 0]`: the whole figure, from the front.
- `side` `[90, 4, 3.75, 0, 0, 0]`: profile.
- `net` `[14, 6, 3.0, 0, 0.17, 0]`: the whole network with all 12 labels and a margin, on a landscape screen.
- `netTall` `[14, 6, 5.8, 0.1, 0.17, 0]`: the same on a portrait phone screen. The cage with its labels is about
  1.3 units wide, so a portrait screen needs about twice the distance. Labels sit to the right of their nodes,
  hence the target offset of +0.1. If the engine scales the distance by aspect itself, use `net`.

## Controls (explore)

- View: Scan / Network -> `body_net` 0 / 1 (`body_pet` stays 1).
- State: Healthy / Disease -> `body_state` 0 / 1. It works in both views: in Scan view the scan itself changes.
- Tracer: Taken up / Arriving. Arriving replays the arrival of the tracer in a 12 s loop using `c.t`:
  1 s blank, 7 s of arrival (`body_pet` 0 -> 1), about 3 s holding the steady scan, then 0.8 s of blank.
  `body_blank` hides the scan while the engine's easing (k = 1 - e^(-3.5 dt)) brings `body_pet` back from 1
  to 0, so the arrival is never seen playing backwards.

## Also exported

`organs`: `[{ key, name }]` in node order.

## For the narrator and panel

- Fine to say: a total-body PET scanner images the whole body at once. The tracer is a radioactive sugar (FDG).
  The brain, the heart muscle and the kidneys and bladder (where the tracer is cleared into the urine) light up
  most; the liver and spleen are medium, muscle and bone faint. Organs whose activity rises and falls together
  form a network, and in disease that network is different (sparser, rewired).
- The injection into the right arm and the order of arrival (right heart, lungs, arteries, organs, urine) follow
  standard FDG physiology, as does the steady-state pattern. The timing is compressed and illustrative.
- **Do not** present the links or their strengths as measured data. The 12 organs and both link sets are
  illustrative, loosely after the two circular networks on slide 35, which use a slightly different list of
  organs (their icons include muscle, adipose tissue and the adrenal glands). Do not name a specific disease for
  the disease network or the disease scan. The change in the scan is illustrative too.

Sources: Reed et al., NeuroImage (2023) (whole-body metabolic connectivity with total-body PET); Geist et al.,
Med (2025) (as cited on slides 34-35). Anatomy at textbook level; colour map: the standard PET hot-iron scale.

## Implementation notes

- Max blending uses `THREE.CustomBlending` with `blendEquation: THREE.MaxEquation` (core in WebGL2,
  `EXT_blend_minmax` in WebGL1). The hot-iron map rises in every channel with intensity, so a per-channel max
  stays on the map. The output alpha is the brightest channel, so in passthrough AR the scan should show as a
  glow over the room (untested on a headset).
- Every point carries a steady intensity, an uptake window, a blood transient (amplitude and arrival) and a
  disease response, so `body_pet` and `body_state` are evaluated in the vertex shader. `update` only sets
  uniforms, 24 node values and 12 tethers.
- **Fill rate.** Sprite sizes are in local units, but below 1.6 units from the camera they shrink with distance,
  down to half size. They are also capped at about 1.4 degrees on screen, so the cap is the same on a phone and
  in a headset. Tissue sprites are 0.021 (up to 1.4 times larger in thin parts such as the forearms and feet)
  and the skin glow sprites 0.03 at intensity 0.05. Two thirds of the tissue deeper than 0.045 is dropped,
  because under max blending it is no brighter than the tissue above it. Overdraw, measured as the reviewer did
  (flat additive 1/255 shader, readPixels, `tools/body_od.mjs`), in fragments per covered pixel, with fragments
  per screen pixel in brackets:

  | view | before | after |
  | --- | --- | --- |
  | default view | 43 | 28 (2.1) |
  | torso close-up `[25, 5, 0.8, 0, 0.22, 0]` | 80 (54) | 13 (5.2) |
  | knee at 0.5 units | - | 5.7 (2.2) |
  | head at 0.45 units | - | 9.9 (3.3) |

  The frame rate on a real headset (Quest 2 or 3, in stereo) is **untested**.
- **Footprint.** Small sprites (the usual views) have a flat top and a soft edge, so neighbours merge into smooth
  regions. Sprites larger than about 7 to 15 px (close-ups and the headset) fade from the middle,
  `1 - smoothstep(0.15, 1, d)`, so they read as soft grains rather than flat discs with rims. I tried a pure
  Gaussian (`exp(-3 d²)`), but it turned close-ups into a field of separate beads, so I did not use it. At the
  very closest views (0.5 units from a leg) small gaps between the grains remain; with this point budget that
  is inherent to a point cloud. The knee joints are 0.018 sprites with a soft edge (`soft(..., 0.4)`) at 0.27.
- The legs and arms have a faint muscle pattern (±0.03, low frequency, drawn out along each limb). The long bones
  of the limbs are at 0.26, so they show as faint lines.
- The bands use premultiplied additive blending (One, One), so a fragment's brightness is exactly its alpha
  times its colour.
- Budget when fully shown: 52,394 points (scan) + 24 (nodes), 12,160 triangles, 12 line segments, 4 draw calls
  (1 while `body_net` is 0). Build time in headless Chromium is about 120-150 ms on a quiet machine. While other
  agents shared the 4 CPUs (load average 16-17) I saw 150-880 ms.
- Deviation from the spec: the organ nodes do not stay inside the organs. They lift out of them, tethered, onto a
  cage around the body. Inside the torso, 8 of the 12 organs lie within about 0.25 units of each other, and their
  nodes, bands and labels piled up into a knot that could not be read.
- Review notes I did not follow exactly. The fixed 18 px sprite cap became an angular cap, for the reason given
  under Fill rate. The suggested net view `[14, 6, 2.5, 0, 0.28, 0]` no longer fits, because the cage is now
  taller so that its labels stay apart; `net` is `[14, 6, 3.0, 0, 0.17, 0]`. Instead of showing the network for
  Disease in Scan view, the scan itself now changes with State.
- Helpers, not needed at runtime: `tools/body_cage.cjs` (cage and label layout search), `tools/body_od.mjs`
  (overdraw) and `tools/body_stats.cjs` (point counts, NaN check and anchors).
