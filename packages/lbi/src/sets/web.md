# `web` - networks are everywhere (slides 6-7)

File `sets/web.js`, one set, two looks:

1. **The internet**: a tree-like network of 15,938 nodes and 16,359 links that grows out of
   10 hubs. It is drawn in the style of the Opte Project maps: the hubs glow white-hot, the long
   trunks yellow and the twigs orange to deep red. You see two giant starbursts and eight smaller
   hubs, with filaments, feathers, forks, dandelion tufts and brushes of leaves, filling the frame
   as a carpet of red twigs. 420 long cross links show that the internet is not quite a tree.
   Slow pulses of traffic run outwards along the trunks.
2. **Friendships around the world**: a dark globe (radius 1). The bright lights are the 3,214
   airport cities of the airports story (real positions). About 18,800 fainter lights round them
   (suburbs, and towns along the shortest ties) are illustrative. About 11,800 blue friendship
   ties run as arcs above the surface. Most are local (nearest neighbours), some are regional and
   about 650 are long arcs between big cities, each with a travelling glint. Where ties are dense,
   a soft blue glow comes up. The continents show only through the density of lights and ties.
   There are no borders or textures.

## Params

| param | default | meaning |
| --- | --- | --- |
| `web_a` | 1 | Fade of the whole set (applied by the engine). The globe fades smoothly at any value: its far side is hidden in the shaders, not by depth. |
| `web_net` | 1 | Internet growth. 0 shows nothing. Rising, the hubs pop in one after another (the giant first). Links then grow out of them with hot white tips, and new nodes flare as they appear. A cross link fades in whole once both of its routers are there. 1 shows the full network. Falling, it retracts. The growth time is part distance from the hub, part rank, so the amount on show grows evenly. |
| `web_globe` | 0 | The globe. A dark sphere grows out of the internet's core, reaching full size at about 0.6. It is opaque from about 0.1-0.2 and hides the part of the network inside or behind it, so it swallows what is left. Rising globe values also fade the internet out (gone by about 0.7). City lights switch on from about 0.25 (big cities first) and are all on by about 0.95. |
| `web_ties` | 0 | Friendship ties. Local ties draw first (from 0.04; 99% are in by 0.23, the odd long tie of a lonely city by 0.37). Regional ties follow (0.26 to 0.55), and the long ocean-crossing arcs draw out from one city to the other last (from 0.25; half are in by 0.53, all by 0.97). The blue glow over dense regions comes up softly with the ties. The ties need the globe (`web_globe` > ~0.2). |
| `web_spin` | 0 | Globe rotation in turns about the polar axis. Positive values turn it the way the Earth turns: Europe moves to the right and the Atlantic and the Americas come in from the left. 0.12 ≈ 43°. |

The resting look (defaults) is the full internet.

Suggested story keys (these are the ones already in `eng/e3_story.js` for the chapter `everywhere`,
and they work as they are):
- `web_net` 0 → 1 over ~7 s (the network grows), hold, then 1 → 0 over ~2.5 s while
  `web_globe` 0 → 1 over ~2.5 s, starting half a second later. During this cross-fade the dark
  globe grows out of the core and the network retracts into it. Leaving `web_net` at 1 during
  the cross-fade also works: the globe swallows the network as it fades.
- `web_ties` 0 → 1 over ~8 s once the globe is in. Holding at ~0.24 for a moment shows the local
  ties alone ("most friendships are local") before the long arcs come.
- `web_spin` 0 → 0.12 across the chapter, with the camera on `globe` going from az -10 to +10.
  This keeps Europe and the Atlantic in view and brings the east of the Americas round.

## Anchors (set-local coordinates)

- `hub`: the biggest internet hub (the yellow-white giant; the engine's label "A hub of the
  internet" goes here). `hub2`: the second giant. `tuft`: the biggest dandelion tuft.
- `globe`: the centre.
- `europe` (50°N 10°E), `americas` (39°N 90°W, the middle of North America), `asia` (33°N 108°E,
  China): just above the surface. These are functions that turn with `web_spin`. They always
  give the full-size globe position, even during its short growth.
- `atlantic`: above the North Atlantic, half-way between London and New York, at the height of
  the long arcs (turns with `web_spin`).

## Labels

`Europe`, `Americas` and `Asia` (cyan). Each shows when `web_globe` > 0.6 and `web_ties` > 0.1,
and only while its place is on the side of the globe facing the camera. The set reads the
camera's position when the globe is drawn, so these labels hide behind the horizon from any
view, in the story, in explore mode and in the headset.

The set has no label of its own for the internet hub, because the story already puts one on
`hub`. In explore mode the internet view therefore has no label. If you want one there, add an
explore-only label on `hub`.

## Camera views

- `default` = `net` `[-18, 12, 3.4, 0, 0, 0]`: the whole internet, filling most of the frame. Both
  giants show side by side, and it looks good from any azimuth.
- `hub` `[-30, 14, 1.5, <hub>]`: close on the giant hub, with spokes all around (good in the
  headset).
- `globe` `[0, 24, 4.1, 0, 0, 0]`: the globe facing Europe and the Atlantic at `web_spin` 0. Europe
  is upper right, Africa in the middle, the Americas on the left limb, and the long arcs fit in.
- `europe` `[26, 38, 1.9, …]`: close over Europe. This view is only right at `web_spin` 0.

## Explore

Two controls:
- `view`: `net` (Internet) or `globe` (Friendships). The option values match the cam names, so the
  engine flies to the right view. Choosing a view (or reopening the scene) replays its growth,
  using `c.t`: `net`: `web_net` 0 → 1 over 6 s; `globe`: `web_globe` 0 → 1 over 1.5 s, then
  `web_ties` up between 1 s and 7 s; `web_spin` 0.
- `ties`: `all` (All) or `local` (Local only). In the globe view, Local only stops `web_ties` at
  0.24: 99% of the local ties are drawn and no regional or long one, so you see the continents drawn by
  local ties alone and that most ties are local. Switching Ties alone does not replay the globe:
  Local only takes the ties back to the local ones, All draws the rest from there over 4 s. The
  net view ignores this control.

## Numbers for the story text

`netNodes` 15,938, `netLinks` 16,359, `cities` 3,214, `tieCount` 11,794. `localShare` 0.798:
about 80% of the ties in this map are shorter than 1,000 km.

## What the narrator can say / must not say

- The internet look is **illustrative**. It is a synthetic network drawn after the Opte Project
  maps (Barrett Lyon), not real routing data. "A network of computers and cables, held together
  by a few giant hubs" is fine. Do not give it real numbers or name real networks.
- Friendships: **the bright lights are the 3,214 airport cities (real positions, from the
  airports story / OpenFlights); the fainter lights around and between them are illustrative**,
  and so are the ties. Most ties join nearby cities, a few cross oceans, after Paul Butler's
  Facebook friendship map (December 2010). Do not call it Facebook data, and do not say how many
  friendships it shows. "In this map most ties are local" is fine.
- **Integrator, please change** in `eng/e3_story.js`: the panel line "Each light is a city" to
  "Each bright light is a city", and the credit "City positions from the airports story; ties
  illustrative." to "Bright city lights from the airports story; fainter lights and ties
  illustrative."

## Performance (headless Chromium, software GL)

- Build: 110-250 ms when the machine is not overloaded (6 fresh loads: 110-148 ms at 400 × 300,
  147-241 ms at 1100 × 700). With other agents loading the 4 CPUs to a load average of 12-21 it
  rose to 240-590 ms (once 880 ms); in the same conditions the `int` set took 850-1,300 ms.
  Cold build in Node, by section: internet ~35-45 ms, its buffers ~20-25 ms, ties ~35-45 ms,
  tie arcs ~20-30 ms, lights ~15-20 ms, globe meshes ~10-15 ms (144-176 ms in all).
- Internet alone: 2 draw calls, 15,938 points, 16,359 segments.
- Globe alone: 4 draw calls, 25,191 points (3,214 city lights, 3,214 glow points, ~18,800 faint
  lights), 32,228 segments, 13.5k triangles (the sea sphere and the atmosphere rim).
- Cross-fade (both shown): 6 calls, 41,129 points, 48,587 segments.
- Whichever look is hidden is switched off (`visible = false`). Nothing is rebuilt per frame:
  `update` only sets uniforms, the globe's rotation and its scale. Pulses, glints and twinkles run
  on `uTime`. `update` is pure (checked: same S and t give the same uniforms and transforms).

## Implementation notes

- Deterministic, with seeded `K.rng` only. Growth, fades and reveals are all in shaders
  (per-vertex times compared with a front uniform), so any scrub position renders correctly.
- The globe hides its far side analytically: `horizon()` in the light, tie and internet shaders
  tests whether the ray from the camera to the vertex passes through the (scaled, turned) globe,
  with a soft edge at the limb. So the fade is smooth at any `web_a`, and the lights skip the
  depth test, so glow sprites at the limb are not cut by the curved sea. The sea writes depth
  only when nearly opaque (globe fade × `web_a` > 0.97), and then only to hide other sets
  behind the globe.
- The globe has an orientation: longitude -12° faces +z at spin 0, and north is +y.
- The airport positions are embedded (the 13 KB compact string, at the bottom of the file in
  `airports()`). Airports are in the airports story's order, sorted by number of routes, so a
  city's size comes from its rank through a small table of route-count quantiles.
- Towns are strung only along local ties of 3° or less, with a scatter of 4% of the tie's
  angle, so they stay on land.

## Review round 1: what changed

All points were taken:
- Major (pop at the fade midpoint, lights cut at the limb): fixed with the horizon test above;
  checked at `web_a` 0.52, 0.48 and 0.2 (no far side shows) and at the limb.
- Density glow: `smoothstep(0.25, 0.4, uL)` instead of a step.
- Wording: towns only along ties ≤ 3°, scatter 0.04 × angle; manifest and header comment say
  which lights are real; panel changes requested above.
- Cross links: both ends take the later router's time, so they fade in whole.
- Denser leaves: point alpha 0.6 + 0.35x, base size 0.011, leaf link alpha 0.45, dandelions
  15%, brushes up to 8 leaves, default camera dist 3.4.
- Build time: typed-array hash for tie pairs, lights written straight into the final buffers;
  the numbers above are the observed ones.
- Explore: a second control (Ties: All / Local only). To make Local only exact, regional ties
  now start after the local ones (none of them is drawn at 0.24; before, about a quarter were).
- Long lines wrapped (at most 145 characters, apart from the embedded data string).

## Sources

- Opte Project internet maps (Barrett Lyon), the style of slide 6.
- Paul Butler, "Visualizing friendships", Facebook, December 2010, the style of slide 7.
- Airport positions: the app's airports story (OpenFlights data).
