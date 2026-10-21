# `liver`: an organ is a network too (file `sets/liver.js`)

The authors' VR viewer also shows a single organ as a network of small patches. This set is an illustrative stand-in
built from scratch: a liver filled with 3,000 patches, linked into a network by the poster's rule. It uses no patient
data. It reads only the liver's colour from `PET_DATA.organs`; everything else is generated, seeded and deterministic.

## How it is built

- **Frame**: seen from the front, as an anatomy atlas or a doctor shows it. x is the patient's left, so the right lobe
  is on your left when you face it. y is up and z is forward (anterior). The organ is centred on the origin (by its
  bounding box) and measures 1.65 wide, 0.99 tall and 0.77 deep (about 1 unit = 13 cm).
- **The shape**: one smooth surface, a signed distance field polygonised by surface nets at load. It shows:
  - the big right lobe under a broad dome, with a rounded right border;
  - the smaller, thinner left lobe tapering to a blunt tip;
  - the sharp inferior border rising from the bottom of the right lobe to the tip of the left lobe;
  - the gallbladder's notch in that border, and the round ligament's notch where the falciform ligament divides the lobes;
  - underneath, the gallbladder's bed and the fissure of the round ligament;
  - at the back, the groove of the vena cava.

  The outline is a smooth curve drawn from an atlas front view. Depth comes from two surfaces: the front bulges
  forward, and the back (visceral) surface slopes forward over the lower part, so the inferior border is a thin edge
  at the front.
- **Also drawn**, faint so the network stays the subject:
  - the gallbladder (bile green). Its fundus shows below the notch; its body and neck, up under the liver, stay dimmer.
  - the falciform ligament: a pale line up the front from the notch, fading over the dome.
- **Patches**: a regular grid with the step (0.0525) chosen so that exactly 3,000 grid points lie inside (the few
  nearest the surface are dropped). The organ lies obliquely in the body, so the grid is turned against the liver's
  axes. Each node is drawn somewhere inside its own grid cell, not at the grid point: one per cell keeps them evenly
  spread, and no rows line up from any side.
- **Stand-in uptake** (log scale): smooth noise in three octaves, plus a warmer patch high in the right lobe (+0.36)
  and a cooler one where the lobes meet (−0.28), plus a little noise per patch, as in any scan. Nodes are coloured in
  the hot-iron map, as the body set draws the scan.
- **Links**: two patches up to 2.45 grid steps apart (80 grid neighbours each; 96,077 pairs inside the organ) are
  linked when one's uptake exceeds the other's by more than a ratio threshold θ. This is the poster's rule for organs,
  applied to patches. A link is directed from the brighter patch to the dimmer one. θ is the two-decimal ratio that
  leaves closest to 20,000 links: **θ = 1.14, 19,933 links**, on average 13.3 per patch (most 65). Links are faint
  additive blue lines, brighter the more the ratio exceeds θ. A glint runs along each one from the brighter end to the
  dimmer end. Links crowd where uptake changes: round the warmer and the cooler patch.
- **Best connected**: the top 5 % of patches by number of links (150). They ring the cooler and the warmer patch
  (where uptake changes fastest), with some elsewhere. The anchor `top` is where they crowd most (the hub with the
  most hubs within 0.15), at present at the cooler patch.
- **Cost**: 5 draw calls, 33,872 triangles (the shell, drawn double sided, plus the gallbladder and the
  ligament), 3,000 points and 19,933 line segments. Build time about 210–280 ms in headless Chromium (while other
  agents were running), of which the shell is about 110 ms. `update` only sets uniforms.

## Params

| Param | Range, default | Meaning |
| --- | --- | --- |
| `liver_a` | 0..1, 1 | fade (applied by the engine) |
| `liver_grow` | 0..1, 1 | patches appear from the middle of the patches outwards, with a white-hot front; at 0 only the glassy organ shows |
| `liver_links` | 0..1, 1 | the links appear (from the middle out, in a loose order); the patches dim a little and the shell steps back |
| `liver_top` | 0..1, 0 | the best-connected 5 % glow orange-yellow (`#ffb020`), larger and slowly pulsing, with their links in amber; everything else dims |
| `liver_spin` | turns, 0 | turns the organ about its vertical axis (0.25 = a quarter turn); anchors follow |

Suggested story keys (one chapter of about 20 s):
- start with `liver_grow` 0 (the organ alone);
- `liver_grow` 0 → 1 over 4 s ("3,000 patches");
- `liver_links` 0 → 1 over 4 s ("links where one patch outshines another");
- `liver_top` 0 → 1 over 2 s ("the best connected");
- throughout, `liver_spin` 0 → 0.08 for depth.

## Anchors

Points are in the set's frame and follow the spin.

- `centre`: the middle of the organ, [0, 0, 0].
- `core`: the middle of the patches, where growth starts (in the right lobe).
- `top`: where the best-connected patches crowd most.
- `right`: the right lobe, its upper outer front (the "3,000 patches" label).
- `left`: the left lobe's front.
- `dome`: the top of the dome.
- `notch`: just below the gallbladder's notch, at the fundus.
- `teres`: the round ligament's notch.
- `warm`: the warmer patch's centre.
- `cool`: the cooler patch's centre.
- `web`: the front surface over the warmer patch, where the links crowd (the links label).

## Labels

- **3,000 patches** (the count is computed) at `right`: with `liver_grow`, gone once the links come.
- **Links:** uptake ratio above the threshold (cyan) at `web`: with `liver_links`.
- **Best connected** the top 5 % of patches (amber) at `top`: with `liver_top`.

## Cam views

| View | Value | What it shows |
| --- | --- | --- |
| `default` | [-16, 9, 3.1, 0, -0.02, 0] | three-quarter front view, the whole organ |
| `front` | [0, 3, 3.1, 0, 0, 0] | straight at the front, the atlas view: both lobes, the notches and the gallbladder's fundus |
| `close` | [-34, 12, 1.5, warm] | into the web round the warmer patch (for spin 0) |
| `below` | [-12, -52, 3.1, 0, -0.05, 0] | the underside: the gallbladder in its bed |
| `side` | [-90, 6, 3.0, 0, 0, 0] | from the patient's right: the right lobe's wedge-shaped profile |

## Controls and explore

- Controls: View (Patches / Links / Hubs).
- `explore(c)` returns `liver_grow` 1, `liver_links` 0 for Patches (else 1), `liver_top` 1 for Hubs (else 0) and
  `liver_spin` 0.
- `api()` returns `{ patches: 3000, links: 19933, theta: 1.14, hubs: 150, step: 0.0525, pairs: 96077, meanLinks: 13.3,
  maxLinks: 65 }`, for text that quotes the numbers.

## For the narrator

- **May say**:
  - an organ can be read as a network too: the scan's voxels grouped into a few thousand patches;
  - two patches are linked when one takes up clearly more sugar than the other (the same ratio-and-threshold rule as
    the one-scan network of organs);
  - links gather where uptake changes;
  - a few patches are far better connected than the rest;
  - the authors' VR viewer shows organs like this.
- **Must say or show**: that this liver is illustrative ("an illustration", "stand-in values").
- **Must not say**:
  - that the patches, uptakes, links, hubs or the warmer and cooler patches are measured, are a patient's, or mean
    anything clinically;
  - anything about the liver's real metabolism read off this picture;
  - that the warmer patch is a tumour or a lesion.
- **Exact numbers** come from `api()` (3,000 patches, θ = 1.14, 19,933 links, 150 best connected). Say "about 20,000
  links".

## Sources

- The rule: the poster "Shaping a New Era in Nuclear Medicine" (Geist et al.; Division of Nuclear Medicine,
  Medical University of Vienna; LBI for Network Medicine). It links organ i to organ j when the ratio of their uptakes
  exceeds a threshold; here the same rule is applied to patches.
- The idea of organs shown as networks of patches: the authors' VR viewer (spec).
- The anatomy: standard atlas front and underside views of the liver (lobes, inferior border, gallbladder fossa and
  fundus, falciform and round ligaments, groove of the vena cava).
