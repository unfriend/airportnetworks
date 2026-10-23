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
  at the front. It is drawn as two meshes: its near side, and its far side at 0.45 of that strength (one double-sided
  mesh at one strength looked like a hollow scoop from below).
- **Also drawn**, faint so the network stays the subject:
  - the gallbladder (bile green). Its fundus shows below the notch; its body and neck, up under the liver, stay dimmer.
  - the falciform ligament: a pale line up the front from the notch, fading over the dome.
- **Patches**: a regular grid with the step (0.0525) chosen so that at least 3,000 grid points lie well inside (a
  first step from the organ's volume, corrected by the count's cube root; the few nearest the surface are then dropped,
  so exactly 3,000 stay). The organ lies obliquely in the body, so the grid is turned against the liver's axes. Each
  node is drawn somewhere inside its own grid cell, not at the grid point: one per cell keeps them evenly spread, and
  no rows line up from any side (a strictly regular grid showed starbursts and stripes from the front and the back).
  Near the surface the shift is halved (up to three times, then none) until the node is as far inside as its grid
  point had to be, so no patch pokes out of the organ.
- **Stand-in uptake** (log scale): smooth noise in three octaves, plus a warmer patch high in the right lobe (+0.36)
  and a cooler one where the lobes meet (−0.28), plus a little noise per patch, as in any scan. Nodes are coloured in
  the hot-iron map, as the body set draws the scan.
- **Links**: two patches up to 2.45 grid steps apart (80 grid neighbours each; 96,077 pairs inside the organ) are
  linked when one's uptake exceeds the other's by more than a ratio threshold θ. This is the poster's rule for organs,
  applied to patches. A link is directed from the brighter patch to the dimmer one. θ is the two-decimal ratio that
  leaves closest to 20,000 links: **θ = 1.14, 19,715 links** (96,071 candidate pairs), on average 13.1 per patch
  (most 65). Links are faint additive lines in the paper's link blue (`#4c7cff`), brighter the more the ratio exceeds
  θ. A glint runs along each one from the brighter end to the dimmer end. Links crowd where uptake changes: round the
  warmer and the cooler patch. Up close (closer than about the organ's size, as in a headset) the strong links grow up
  to 1.6 times brighter and the weak ones step back to 0.7, so the web keeps its structure. Hidden links (and hidden
  patches) cost no draw call.
- **Best connected**: the top 5 % of patches by number of links (150). They cluster on and around the cooler and the
  warmer patch (59 within 0.3 of the cooler one, 44 of the warmer), where uptake changes, with some elsewhere; on
  average their uptake is a little below the organ's. The anchor `top` is where they crowd most (the hub with the most
  hubs within 0.15), at present at the cooler patch.
- **Cost**: 6 draw calls (the shell's near and far sides, the gallbladder, the ligament, the points, the lines; 4
  while the patches are hidden), 65,224 triangles (the shell's 31,352 twice, each side culled), 3,000 points and
  19,715 line segments. Build time about 180–230 ms in headless Chromium (while other agents were running), of which
  the shell is about 100 ms. `update` only sets uniforms and the visibility of the points and the lines.

## Params

| Param | Range, default | Meaning |
| --- | --- | --- |
| `liver_a` | 0..1, 1 | fade (applied by the engine) |
| `liver_grow` | 0..1, 1 | patches appear from the middle of the patches outwards, with a cyan front (not white: it must not read as the hottest tissue); at 0 only the glassy organ shows, a little brighter |
| `liver_links` | 0..1, 1 | the links appear (from the middle out, in a loose order); the patches dim a little and the shell, the gallbladder and the ligament step back |
| `liver_top` | 0..1, 0 | the best-connected 5 % stand out: each keeps its own hot-iron colour (its uptake) inside a slowly pulsing orange-yellow ring (`#ffb020`), a little larger and brighter, with their links in amber; every other patch turns grey and dim, and the organ steps back further |
| `liver_spin` | turns, 0 | turns the organ about its vertical axis (0.25 = a quarter turn); anchors follow |

Suggested story keys (one chapter of about 20 s):
- start with `liver_grow` 0 (the organ alone);
- `liver_grow` 0 → 1 over 4 s ("3,000 patches");
- `liver_links` 0 → 1 over 4 s ("links where one patch outshines another");
- `liver_top` 0 → 1 over 2 s ("the best connected");
- for depth, `liver_spin` 0 → 0.08 in the `default` or `front` views; bring it back to 0 before a `close` shot (its
  target is the warmer patch at spin 0: at 0.08 it is about 0.2 off, at 0.3 the patch leaves the frame).

## Anchors

Points are in the set's frame and follow the spin (all but `centre`). Each anchor returns the same array every call
(the engine copies it).

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
- `web`: the front surface over the warmer patch, where the links crowd (the links label; aimed nearly straight
  forward, so the label stays in frame in the `close` and `side` views).

## Labels

- **3,000 patches** (the count is computed) at `right`: with `liver_grow`, gone once the links come.
- **Links:** uptake ratio above the threshold (cyan) at `web`: with `liver_links` (the spec's wording, 32 characters
  in its second line).
- **Best connected** the top 5 % of patches (amber) at `top`: with `liver_top`.

## Cam views

| View | Value | What it shows |
| --- | --- | --- |
| `default` | [-16, 9, 3.1, 0, -0.02, 0] | three-quarter front view, the whole organ |
| `front` | [0, 3, 3.1, 0, 0, 0] | straight at the front, the atlas view: both lobes, the notches and the gallbladder's fundus |
| `close` | [-34, 12, 1.7, warm] | into the web round the warmer patch (only for `liver_spin` 0: a cam view is fixed) |
| `below` | [-12, -52, 3.1, 0, -0.05, 0] | the underside: the gallbladder in its bed |
| `side` | [-90, 6, 3.0, 0, 0, 0] | from the patient's right: the right lobe's wedge-shaped profile |

Final shots (`tools/pet/shots/liver-final-<k>.png`, 800x500): 0 the default view with links, 1 the front view with
patches, 2 the hubs, 3 the `close` view, 4 growing (`liver_grow` 0.55), 5 the empty organ from `below`, 6 the empty
organ from the `front`, 7 inside the web at 0.45 from the warmer patch (as in a headset).

## Controls and explore

- Controls: View (Patches / Links / Hubs).
- `explore(c)` returns `liver_grow` 1, `liver_links` 0 for Patches (else 1), `liver_top` 1 for Hubs (else 0) and
  `liver_spin` 0.
- `api()` returns one frozen object, made once: `{ patches: 3000, links: 19715, theta: 1.14, hubs: 150, step: 0.0525,
  pairs: 96071, meanLinks: 13.1, maxLinks: 65 }` (step to five decimals, meanLinks to one), for text that quotes the
  numbers.

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
- **Exact numbers** come from `api()` (3,000 patches, θ = 1.14, 19,715 links, 150 best connected). Say "about 20,000
  links".

## Sources

- The rule: the poster "Shaping a New Era in Nuclear Medicine" (Geist et al.; Division of Nuclear Medicine,
  Medical University of Vienna; LBI for Network Medicine). It links organ i to organ j when the ratio of their uptakes
  exceeds a threshold; here the same rule is applied to patches.
- The idea of organs shown as networks of patches: the authors' VR viewer (spec).
- The anatomy: standard atlas front and underside views of the liver (lobes, inferior border, gallbladder fossa and
  fundus, falciform and round ligaments, groove of the vena cava).
