# `flock` - starlings at dusk, all around you (sets/flock.js)

Life size: 1 unit is 1 m, the viewer stands at the origin, the ground is y = 0, the sun sets towards -z (a little to
the right). Unlike other sets the flock is a live simulation, so `update` depends on what came before, not only on
the params and the time.

- **Sky**: a dome drawn at the far plane; dusk blue overhead, a warm band low down (strongest towards the sun), the
  sun's glow, streaks of cloud. The same sky function colours the haze of the land and the distance of the birds.
- **Land**: a dark field running into the haze, a lake towards the sunset that mirrors the sky (with a ripple), a
  ring of dark trees at about 620 m, and 2,600 swaying reeds within 32 m of where you stand (scale, and ground under
  your feet).
- **Birds**: 200 by default (up to 400), one instanced batch: a body, a short square tail and two broad triangular
  wings (span 0.4 m, as a starling's) that flap, now and then glide, and bank with the bird; faster beats when
  alarmed. Further birds pale into the sky.
- **Simulation** (steps of 1/30 s; between steps the birds glide on along their velocity in the shader): each bird
  finds its seven nearest neighbours (a grid of 1.1 m cells round the viewer, birds sorted by cell, nearest cells
  first) and matches their heading (strongly), keeps a little apart (about 1.3 m), stays with them, and with the
  flock as a whole. Two pulls act on the flock as one body: a weak one towards a roost in front of the viewer
  (towards the sunset, 13-19 m out and 6-12 m up, wandering slowly left and right) and the flock's whim, a heading
  that turns now left, now right; so the flock wheels and doubles back instead of circling the viewer. Every 88 s
  (first at 72 s of flight, the story's last chapter) the roost comes in low and close for about ten seconds and
  wins over the whim: the flock flies round the viewer. Two satellite points near the roost pull a few birds aside,
  so the flock stretches and folds. Birds keep within 24 m of the viewer and above 3.5 m, give the viewer's head
  (2.6 m) and hands (2.2 m) a wide berth, and bank into turns. Measured over two minutes from where you stand: the
  flock is 8-29 m away (median 19), its bearing changes by about 18 degrees a second (median) and turns back about
  every ten seconds.
- **Falcon**: a larger bird that comes in fast from about 70 m, homes on the flock's main body (or first on where it
  was sent), stoops once straight through it and climbs away (about 10 s; never below 2 m). Birds within 8 m flee and
  raise the alarm; alarm passes from
  neighbour to neighbour, a little weaker each time, at the pace of a turn, so a wave runs through the flock: alarmed
  birds fly faster and all bank the same way (a dark band). It comes by itself every 40-80 s when `flock_falcon` is
  on, whenever `flock_hunt` passes a whole number, or when sent (`scatter`).
- **Shared rooms**: `see(head, hands, spot)` with `spot` true makes the flock roost round this frame's origin (the
  station's spot) instead of round the viewer. `flight()` gives `{ t, m, v }` (its flight time, middle and mean
  velocity); `follow({ t, m, v })` takes another flock's flight time and steers the whole flock to its middle (all
  at once when more than 12 m off; `null`: lead again; a second argument, the real time since the last call, eases
  the time), and while following, or hushed (`hush(true)`: new at a station), the set sends no falcons of its own.
  `onLaunch(f)` (set by the engine) hears every falcon launched here as `{ p, v, aim }`; `falcon(f)` launches
  exactly that one (from another device).
- **Network**: each bird's link to the seven it follows (cyan, additive; fainter with distance).

## Params

| param | default | meaning |
| --- | --- | --- |
| `flock_a` | 1 | fade (engine) |
| `flock_birds` | 200 | how many birds (50-400; new ones join beside a bird already flying) |
| `flock_links` | 0 | the network: 0 hidden, 1 shown |
| `flock_sky` | 1 | the sky, land and reeds; below 0.5 (passthrough AR) they are hidden and the flock flies in your room at a third of life size |
| `flock_falcon` | 1 | above 0.5 a falcon comes now and then |
| `flock_hunt` | 0 | a falcon each time this passes a whole number (for the story) |

## Exports beyond the set contract

`see(head, hands)`: where the viewer is, in the set's frame (the engine calls it every frame). `scatter(dir)`: send a
falcon where `dir` points (none: from anywhere); false while one is hunting. `birds()`, `falconOn()`, `state()` (for
tests).

## Anchors, labels, views, controls

Anchors `flock` (3 m above the middle of the flock's main body: a mean shift over the birds within 9 m, so a flock
split by the falcon is not looked for in the empty sky between its parts) and `falcon`. Label: **Falcon** (amber)
while it comes in. Views: `default` [0, -26, 0.25, 0, 1.6, 0] (standing where you do, looking a little up; the engine
turns it to the flock), `up` (looking up), `afar` [20, 6, 17, 0, 9, -4] (the engine aims it at the flock). Controls: View (Follow the flock,
Look around, From afar), Birds (200, 100, 400), Network (Off, Who follows whom), Falcon (Now and then, Off).

## Science

May say: starlings gather in flocks of hundreds or thousands at dusk before roosting; no bird leads; each follows a
set number of nearest neighbours, about seven, whatever the distance (Ballerini et al., PNAS 2008); a turn can spread
across the whole flock however big it is (Cavagna et al., PNAS 2010); a falcon sets off waves of turning that run
through the flock, seen as dark bands of birds banking together (Procaccini et al., Animal Behaviour 2011). Must not
say the simulation's numbers (speeds, distances, the wave's pace) are measured: they are tuned to look right.
