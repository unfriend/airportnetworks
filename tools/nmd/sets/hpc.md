# `hpc` - the stress test (sets/hpc.js)

Slides 9-10 of the talk: the robustness test on a supercomputer. A hall of racks (four rows of 14 dark cabinets, a
cold aisle down the middle with glowing perforated floor tiles, fronts of blinking blue and green lights, cable trays
with yellow and blue cables above, light bars, a glass door at the far end of the aisle), and the field of tiny towers
it computes: a grid on the floor around the hall, out to a horizon about 22 units away. Each near tower (about 4,300,
instanced) is a stack of 20 thin glowing discs (the multiplex in miniature: cyan protein layers at the bottom, green
co-expression, then violet, amber, magenta) with a gold-white core thread and a gold dot at each disc's centre (the
disease module). Beyond about 8.8 units each tower is one point (about 25,000). No data is read; no brand marks.

Scale: 1 unit is about 4 m (racks 2 m tall, 60 cm wide); floor at y = -0.3; the hall fits in |x|, |z| < 0.85. The
field goes far beyond the usual radius-1.1 sphere on purpose (to the horizon).

Cost: build 50-100 ms in headless Chromium; 11 draw calls; 176k triangles (172k of them the towers' disc quads);
25.2k points (far towers, the stream, aisle dust); 4.2k line segments (core threads). Nothing is rebuilt per frame;
the 56 rack and 112 panel instance matrices are rewritten only while `hpc_racks` changes.

## Params

| param | meaning | suggested keys |
| --- | --- | --- |
| `hpc_a` | fade | |
| `hpc_racks` | the racks rise out of the floor, nearest first, then their lights power on; trays, lights and glass come in last (default 1) | 0 → 1 over 3-4 s when the hall first appears |
| `hpc_field` | the field spreads from the hall to the horizon: a cyan ring runs across the floor, sparks stream out of the hall to it, towers build disc by disc as it passes (default 0) | 0 → 1 over 6-10 s, with the camera going from `racks` to `field` |
| `hpc_remove` | in a wave from the hall outwards (an amber ring on the floor), discs vanish from each tower in its own order (a brief flash, then they widen and fade). The core thread stays, and gets slightly brighter; at 1 every tower keeps exactly 5 of its 20 discs. Far points shrink to their gold core | 0 → 1 over 8-12 s with `hpc_field` 1; hold at 1 |

The waves are shaped so that the `near` tower is halfway through both at 0.5.

## Anchors

`racks` (above the hall's middle), `field` (above the field, between hall and near tower), `near` (the middle of the
tower the `near` view frames, at about [1.8, -0.19, 3.0]).

## Labels

- **MareNostrum 5** Barcelona Supercomputing Center (cyan) at `racks`, while `hpc_racks` > 0.6 and fading out as
  `hpc_field` goes from 0.35 to 0.7.
- **680,000 networks** (amber) at `field`, as `hpc_field` goes from 0.55 to 0.9.

## Cam views

- `default` [38, 24, 3.6, 0, -0.12, 0]: the hall from above, three-quarter view.
- `racks` [0, 4, 1.4, 0, -0.03, -0.62]: standing in the cold aisle at eye height, on its centre line, looking down
  it to the far door.
- `aisle` [0, 6, 2.1, 0, -0.03, -0.62]: on the same line, just outside the aisle's open end: the way in and out.
  Turning about a target down the aisle swings the camera through the racks, so a path into the aisle goes through
  `aisle` and stays on the line (the story walks down it by moving the target, not by turning).
- `field` [24, 19, 7.5, 0, -0.3, -1]: high and wide, the hall in the middle, towers to the horizon.
- `near` [53, 18, 1, 1.8, -0.19, 3]: one tower close, its neighbours receding towards the hall.

Towers closer than about 0.4 units to the camera fade out, so a camera can fly through the field.

The set exports `keepOut(p)` and `still(p)` (the engine's camera guard, `keepCamera` in `engine/e2_scene.js`): the
camera never enters a rack row or the far glass door; over one it is lifted to 0.2 above the racks, near one it rises
smoothly (6 units up per unit closer), so a dragged view glides over the rows. While the camera is in the hall
explore mode stops its sway.

## Controls (explore)

- View: Racks / Field (`racks` and `field` are also cam view names, so the engine flies there).
- Removed: None / Half / Most (`hpc_remove` 0, 0.5, 1; Half or Most also shows the field).

## Narration

May say: the robustness test removed layers at random and redid the analysis: 10,000 multiplex networks for each
number of removed layers, 680,000 multilayer networks in all, about 45 hours on MareNostrum 5 at the Barcelona
Supercomputing Center (jobs of 25 nodes with 112 cores each); disease modules keep their originally detected genes
until most layers are gone. Each tiny tower stands for one of those networks; its discs are layers, its core thread
the disease module.

Must not say: that the picture shows the real machine's layout or the real number of towers (it is illustrative;
about 30,000 towers stand for 680,000), that a tower has 71 discs (it has 20, a miniature), or any statistic not in
SPEC.md's shared facts. No brand or vendor names for the hardware.

## Sources

Slides 9-10 of the ISMB 2026 talk (Núñez-Carpintero, Friedrich, Guthrie, Menche); numbers from `tools/nmd/SPEC.md`
"Shared facts". The hall is generic (no MareNostrum 5 floor plan).
