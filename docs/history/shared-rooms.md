# Shared rooms: history

Moved word for word out of `docs/agents/shared-rooms.md` on 27 November 2026 (the v224 checkout): sentences that say which version did what, what the owner said when, what was tried and dropped, and what a log once showed. Each stands under the heading it came from; the rule it stood beside stays in that file. The version history as a whole is in `docs/history.md`, the owner's words behind the rules in `docs/history/decided.md`.

## Shared rooms (`shared.js`, `relay/`)

- What followed "networks-61 (`shared.js`;" in the room's keys, after the current `FORMAT`: v215: `look`'s `subs` the
  room's default for subtitles, each headset's own choice over it; networks-60, v214: the room's key `menus`;
  networks-59, v208: the cell story's `collab.state()` gains `net`, a network shared through the relay, below;
  networks-58, v207, its `lim`; networks-57, v205, its `cx` and sides; networks-56, v197, the VR goggles' shape;
  networks-55, v172, a circle's `ask`; networks-54, v170: a station's `st.<id>.arr`, the copy of its story it runs;
  before it networks-53, v164: a studio object's `anim: 'move'` and its `idle` and `strideK`, "As it moves" in
  `tools/studio/SPEC.md`; before it networks-52, v158: the studio's `stream` and `trail` fields, a path's
  `sync`/`beats`, a sequence's `beats` and its events `press` and `send`, the scene's `hands`, `bt.bar`, "The output
  page" below and `tools/output/SPEC.md` "v158"; before it networks-51, the output page, MIDI and OSC: the studio's
  `send` entries, a motion's `beat`, its state's `sw.<id>` and `bt`, the effect `send`, and `out` in hello and
  presence; "The output page" below)

## The output page (MIDI and OSC)

- What followed "FORMAT networks-51;" in the section's first line: the owner, 16 November 2026: "make it opt in by
  default and say who entered", "both", "in and out", "output page and then midi or local relay for osc and trackers i
  guess?")

### The page, its sends and its limits

- Fixed while integrating: an item named in an incoming mapping just after it was added was refused until the output
  page's item list (read once a second) caught up; a name not found now reads the list again at once.

## The room's floor, the shared space and calibration

- Why: two Quest 3s on Quest Browser 152 with Physical space features off were in two spaces 2.6 m and 11 degrees
  apart under one id, neither its own floor, so nothing but the tape could tell.

### Floor spots

- Why (the relay's logs of two Quest 3s in one room): the shared space came with the same id on both at once but was
  at first just one headset's own floor, jumped by 40 cm and 74 degrees when colocation found something, then stayed
  0.9 m and 19 degrees out against the tape, and sometimes reported the head's pose; one headset's floor was 28 cm too
  low (its head at 2 m), and its origin later jumped 5.5 m and 0.7 m down; `local-floor` moves with a recentre without
  a reset event.

### The shared space

- Why: a Quest 3 that left AR and entered it again got its space back under the same id but as its own floor, while
  the other's stayed where it was; it took its own earlier frame through the new space and stood the room elsewhere
  (both Quest Browser 152).

### Standby with the shared space in use

- (Two rules from this round were taken out again after two Quest 3s could not align: a reset of the floor with no
  wake before it started a hold too, and another headset in the room since earlier counted as someone here, so a
  headset first in the shared space but later in the room never became the room.) Why: no logs of the night; two
  independent readings of the code found that the headset that woke second would follow last night's frame through a
  space made again around the other, which matches what was seen.

## The explore view and others' moves

### Others' moves, smooth

- Before, each new value (ten a second, the view five) started a glide from where the thing stood, so a steady spin
  sped up and slowed down at every arrival, and inside a large network a small step of a spin is a big jump at its far
  side.

## The relay

### Updating a room

- Why rooms were lost: a room's version is the app's `FORMAT` and never changed once made (before v136); a deploy
  restarts the relay (1001), the pages still running the old app came back within a second and made the room again
  under the old version (`revive`), and every device that took the update was refused (4006) and stopped trying, for
  as long as the room lived (6 hours after it emptied); peer to peer the room's id names the version, so the first
  updated device hosted a second room.

## Talk (v178, `shared.js` "talk: shared", "talk: sending", "talk: hearing")

- The owner (20 November 2026): "lets try open mic with mute row? yes talk only in relay rooms is ok for now", "lets
  go".
