# `fish` - a school of fish all around you (sets/fish.js)

New for this story, after the flock (`tools/flock/sets/flock.js`, whose simulation it adapts). Life size: 1 unit is 1 m,
the viewer floats at the origin with eyes at 1.6 m (`ME.head`), the seabed is 6.5 m below the origin, the surface 15 m
above, the sun is up and a little towards -z. Like the flock, a live simulation: `update` depends on what came before,
and seeking the story only changes the params.

- **Water**: a dome drawn at the far plane (dark below, deep blue all round, lighter towards the surface, the sky through
  a rippling bright window overhead, the sun's glow); the surface far above (seen from above, as the camera rises, a dark
  sea); the seabed with sand and moving caustics, 26 rocks and 1,400 swaying blades of seagrass within 25 m; 18 slanted
  light shafts from the surface (soft edges, swaying, flickering, none right in your eyes); 1,800 drifting specks that
  always stay round your head. Everything fades into the blue with distance (the same water colour on the fish).
- **Fish**: 300 by default (30-600), one instanced batch, 0.27 m long: a counter-shaded body (dark back, silver flanks
  that glint when they turn towards the surface, pale belly), a forked tail and a dorsal fin; a wave runs down the body
  to the tail (each fish at its own pace, wider when warned); they roll into turns, and hard when warned (showing the
  silver flank). Lit by the water's own light (custom shader; the scene's lights are not used).
- **Simulation** (steps of 1/30 s; between steps the fish glide on): each fish finds its `fish_k` nearest neighbours
  (1-12, default 7) whatever the distance (a grid of 0.8 m cells round the viewer, searched in growing shells until the
  nearest are certain) and swims their way, keeps a little apart (0.45 m) and stays with them; it also wanders a little
  of its own accord (smooth per-fish noise). Nothing but the neighbours holds the school together, except three weak
  pulls: fish more than 4 m from the middle of all the fish are drawn back (so groups that parted find each other again
  once they watch enough neighbours), every fish leans gently towards a home 3-6 m in front of you that wanders slowly,
  and fish beyond 7 m from you turn back. Fish stay between 4.5 m below the origin and 6 m above it and keep 1.3 m from
  your head and 0.9 m from your hands (a hand that comes close also startles them a little). Measured in
  `test-sets.mjs`: with seven neighbours one school (98 % in one group, local order 0.85, 2.4 m spread); after 40 s with
  one neighbour each, 16 groups, local order 0.52, 3.4 m spread (it falls apart within about 10 s); 40 s after going back
  to seven, one school again (86 %). Tuned to look right: the numbers (speeds, distances, the warning's pace) are not
  measured on real fish.
- **Shark**: one larger fish (2.3 m, grey, a tall dorsal fin, a long upper tail lobe, pectoral fins, slow beats). It
  comes in from 22 m at 3.2 m/s, homes on the school's main body (or first on where it was sent), bursts through at
  5 m/s, then swims away and is gone (about 14 s). Fish within 4.5 m flee and are warned; the warning passes from
  neighbour to neighbour (a little weaker each time, 0.94 per step of the chain) at about 10 m/s, twice the shark's best
  speed, and every fish flashes silver as it reaches it (and its links warm from cyan to white). It comes when
  `fish_hunt` passes a whole number, now and then when `fish_shark` is on (every 30-55 s), or when sent (`scatter`).
  **Steered** (`steer(p)`, explore's "be the shark"): it swims after the point at up to 5.5 m/s for as long as it is
  steered; let go, it swims away.
- **Network**: each fish's link to the fish it watches (cyan, additive, fainter with distance from you), warming to
  white where the warning is.
- **Passthrough** (`fish_water` below 0.5): the water, light, seabed and specks are hidden and the school swims in your
  room at a third of life size (0.34), as the flock does.

## Params

| param | default | meaning |
| --- | --- | --- |
| `fish_a` | 1 | fade (engine) |
| `fish_n` | 300 | how many fish (30-600; new ones join beside a fish already swimming) |
| `fish_k` | 7 | neighbours each fish watches (rounded, 1-12) |
| `fish_links` | 0 | the network: 0 hidden, 1 shown (fades) |
| `fish_water` | 1 | the water and everything in it; below 0.5 (passthrough AR) hidden, the school at a third of life size |
| `fish_shark` | 0 | above 0.5 a shark comes now and then (explore) |
| `fish_hunt` | 0 | a shark each time this passes a whole number (for the story) |
| `fish_scale` | 1 | the whole set's size on top of life size (for the rise to the globe: towards 0 the sea, dome and all, shrinks to a dot at the origin) |

Suggested story keys: chapter 1 the defaults; chapter 2 `fish_links` 0 -> 1 at +4 s, `fish_hunt` 0 -> 1 at about +18 s
(the shark reaches the school 4-6 s later); chapter 3 `fish_k` 7 -> 1 at +5 s (links on: pairs), back to 7 at about +28 s.
`fish_k`, `fish_n` and `fish_hunt` are best stepped, not eased.

## Exports beyond the set contract

`see(head, hands, spot)`: where the viewer is, in the set's frame (call every frame; `spot` true at a station in a shared
room: the school stays round the station's spot). `steer(p)`: the shark chases `p` (set frame) until `steer(null)`.
`scatter(dir)`: send a shark where `dir` points (from the head; none: from anywhere); false while one is about. Shared
rooms, as the flock's: `flight()` `{ t, m, v }`, `follow(o, dt)`, `hush(on)`, `following()`, `onLaunch` (set by the
engine: hears each shark launched here as `{ p, v, aim }`), `shark(f)` (launch exactly that one); `falcon` and
`falconOn` are the same as `shark` and `sharkOn`, so the flock engine's code ports as it is. `sharkOn()`, `fish()`,
`neighbours()`, `state()` and `watch(f)` (hear each fish the warning reaches) for tests. `setLang('en' | 'de')`.

## Anchors, labels, views, controls

Anchors `school` (0.6 m above the middle of the school's main body: a mean shift over the fish within 4 m) and `shark`.
Label: **Shark** / **Hai** (amber) while it comes in. Views: `default` [0, -6, 0.25, 0, 1.6, 0] (floating where you
are, looking ahead; the engine turns it to the school, as the flock's `followView`), `up` (to the light), `afar`
[25, 10, 13, 0, 1.6, -4] (the whole school from outside; aim at `school`), `above` [0, 80, 40, 0, 1.6, -4] (looking down
from above the surface). Controls (getter, in the set's language): View (Follow the school, Look around, From afar),
Neighbours watched (7, 1, 3, 12), Network (Off, Who watches whom), Shark (Off, Now and then).

## Science

May say: in a school no fish leads; each fish reacts to a few of its nearest neighbours; when a predator comes, the fish
nearest it turn away first and the turn spreads through the school faster than the predator swims (Rosenthal et al.,
PNAS 2015, "Revealing the hidden networks of interaction in mobile animal groups"; Handegard et al., Current Biology
2012, on herring schools passing on a predator's attack); silvery fish flash as they turn. "About seven neighbours"
is the starlings' finding (Ballerini et al., PNAS 2008): for fish say "a few", and "in our school, seven". Must not say
the simulation's numbers (speeds, distances, the warning's pace) are measured.
