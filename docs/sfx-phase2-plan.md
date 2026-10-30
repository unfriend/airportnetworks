# Sound effects, phase 2: sounds inside the stories (plan)

Written 29 October 2026, read-only against the repository as it stood during the v98 release round. The owner listened
to phase 1 ("sounds are fine, go on"): effects are **on by default** from the next release (v99), and phase 2 adds
sounds inside the sixteen stories and the design room ("nice sound effects to everything"). Build after v98 lands.

Sources read: `sfx.js` (whole), `index.html` (HOST.audio's `fx`, `speaking`, `zone`), `shared.js` (its `sfx()` helper,
`HOST.sfx.listen` from `tick`), every built engine's `e3_story.js` timeline keys and chapters, the tour's and flock's
`e5_xr.js`/`e7_app.js`, the hand-written three (`stories/airports.js`, `proteins.js`, `spatial.js`) by line ranges, the
set manifests' anchors, `tools/audio.mjs`, `tools/sfx.html`, `tools/sfx-render.mjs`, `tools/pass/build.mjs`
(`ORIGINALS`), AGENTS.md and CLAUDE.md.

---------------------------------------------------------------------------------------------------------------------

## 0. Decisions for the owner (each has a default the builders follow unless told otherwise)

1. **On by default, but a device that turned effects off keeps them off.** `S.on = get('sfxOn') !== 'off'` (today:
   `=== 'on'`). The key stays `sfxOn`; nobody had a reason to save "off" except on purpose. (Alternative: a new key
   `sfxOn2` that turns every device on once; not recommended.)
2. **The bar's Sound button (and the headset panel's sound button) silences the effects too.** With effects on by
   default, a visitor who presses "sound off" expects silence. Done in `sfx.js`'s app adapter:
   `fx: () => (H.audio.muted ? null : H.audio.fx())`, so the background fades out (0.3 s) and nothing plays while muted.
   Sound check's *Sound effects: on/off* stays the finer switch (effects without narration is not possible then;
   narration without effects is). Default: yes.
3. **Density.** About one story cue every 12 to 25 s on average (a chapter's start, its visual turns), short sequences
   allowed (a path's hops, a circuit's gates, the eight codes on the chip), soft textures under the voice. Every story
   can be listened to as a render before release (`tools/sfx-render.mjs --story <key>`, section 4).
4. **Ten headsets at one station** play the same cues within the room's 0.25 s drift; open-ear speakers may let
   neighbours hear a slight flam. Story cues are soft and rounded for this reason; untested until an event.

## 1. The mechanism

### 1.1 Shell side (`sfx.js`; builder A)

- **On by default** (decision 1) and **muted with the narration** (decision 2). Docs and `tools/audio.mjs` follow.
- **`play(name, o)` gains three options** the recipes read: `pitch` (a frequency factor, default 1: `x.k`), `dur` (for
  textures and sweeps, seconds: `x.dur`, default the recipe's own) and `n` (a count, the ratchet's clicks: `x.o.n`).
  Unknown names still return null (an older story on a newer shell, or the reverse, plays nothing and breaks nothing).
  `renderSound(name, o)` takes the same options.
- **`SOUNDS` gains the story sounds** (section 2), `kind: 'story'`, with a `uses` line (which stories, what for) for the
  sound board; `ORDER_STORY` lists them for the board and the renders. `demo()` (Try them) keeps the interface sounds
  and adds six story ones at the end (grow, link, whoosh, pulse, rise, knock).
- **Continuous sounds, `HOST.sfx.drone(id, name, o)`** (new; `DRONES` recipes: `vacuum`, `machine`). A story calls it
  every frame (or at least every 250 ms) while the sound should go on; `o: { at, pan, gain, pitch }`. The engine makes it
  on first call (fade in 0.3 s), follows `at`/`pan`/`gain`/`pitch` smoothly (`setTargetAtTime`, 0.08 s), and fades it out
  over 0.4 s once it has not been called for 0.3 s (checked in `step()`), and at once (0.3 s) when the effects go off,
  the context goes (`fx()` null: hidden, muted, the `<audio>` engine) or a new context is built. At most 4 at once (a
  fifth replaces the quietest). Drones go through `G.fx` (volume, duck, safety curve) but are not counted in the 16
  voices; `state()` lists them (`drones: [{ id, name, gain }]`), `line()` says how many. Nothing in a story has to stop
  them: a story that goes (another story, a swap, explore mode, a pause) simply stops calling. A hot swap keeps the
  same ids (`<key>.<n>`), so a drone running through a swap carries on.
- **`SFX_LIB.length(name, o)`**: a sound's length from a dry run on a probe context (as `renderSound` measures it), for
  the tests' overlap check.
- Untouched: the hum, both engines, the watchdog, the beds, ducking (-9 dB), the voice limit (16), the gaps.

### 1.2 Story side: the same lines in every story (all sixteen and the design room)

Built engines: a block in `e7_app.js` right after the slideshow block (identical in all fourteen built engines), one
line in `slideStep`, two lines in `frame()`, one story-specific function (`sfxPos`, identical in every built engine; the
hand-written three each have their own), cue calls in `buildStory` (`e3_story.js`), one line in `xrRelease` and one in
`xrPoint` (`e5_xr.js`), action lines in `e4_explore.js`. Names checked free in every engine and story (`sfxSpan` is
taken: the pass story's suffix span; `SND`, `snd`, `cue*` are taken; `SFXQ`, `sfxCue`, `sfxHold`, `sfxPlay`,
`sfxStep`, `sfxWhere`, `sfxPos`, `sfxLive`, `sfxN` are free).

```js
// ------------------------------------------------------------- sound effects --
// Sounds inside the story (the shell's HOST.sfx, sfx.js; phase 2). Cues are set beside the keys in buildStory, in story
// time (sfxCue), and play as the clock crosses them while the story plays, by the slideshow's crossing rule
// (SLIDE.from): the same cues at the same moment on every device at a station, none on a jump, a scrub, a slideshow
// stop's seek or a late joiner's start. A span (sfxHold) keeps a continuous sound while the clock is inside it and
// playing. Explore and headset actions call sfxPlay where the story already handles them. A sound comes from a place
// (a set's anchor): in a headset through an HRTF panner, on a screen panned by where it shows. An older shell (no
// HOST.sfx, or a sound it does not know) plays nothing. Never in collab.state(): each device plays its own.
const SFXQ = { cues: [], spans: [], hi: -1, n: 0, log: [] };
const sfxCue = (t, name, set, at, o) => { SFXQ.cues.push({ t, n: narrT(t), name, set, at, o: o || {} }); };
const sfxHold = (t0, t1, name, set, at, o) => { SFXQ.spans.push({ id: XR_HERE + '.' + SFXQ.spans.length, t0, t1, n0: narrT(t0), n1: narrT(t1), name, set, at, o: o || {} }); };
const sfxN = () => (HOST.sfx && HOST.sfx.count ? HOST.sfx.count() : 0);
const _sfv = new THREE.Vector3();
// where a sound comes from: [x, y, z] in the scene's (the reference space's) coordinates and, on a screen, a pan
function sfxWhere(set, at) {
  if (set === 'world') _sfv.copy(at);   // a point already in the scene's coordinates (a ray's hit)
  else if (!sfxPos(set, at, _sfv)) return {};
  const o = { at: [_sfv.x, _sfv.y, _sfv.z] };
  if (!(XR.on && GL.renderer.xr.isPresenting)) { _sfv.project(GL.camera); o.pan = clamp(_sfv.x, -1, 1) * 0.6 * (_sfv.z > 1 ? -1 : 1); }
  return o;
}
function sfxPlay(name, set, at, o) {
  SFXQ.n++; SFXQ.log.push([name, Math.round(APP.t * 100) / 100]); if (SFXQ.log.length > 64) SFXQ.log.shift();   // (the tests read it)
  if (!HOST.sfx || !HOST.sfx.play) return null;
  try { return HOST.sfx.play(name, Object.assign(sfxWhere(set, at), o)); } catch (e) { return null; }
}
const sfxQuiet = () => APP.mode !== 'story' || HOST.picking || XR.stories || xrAway();
// every frame, right after slideStep (`was`: the story was playing as the frame began): the cues crossed since the
// slideshow's `from` (at most 0.5 s back: a long frame plays what is near, not a burst; never twice: the narration may
// pull the clock back a hair, SFXQ.hi), the spans the clock is in, and the live parts (sfxLive, where a story has them)
function sfxStep(was, dt) {
  const t = APP.t, from = SLIDE.from;
  if (t < SFXQ.hi - 0.5) SFXQ.hi = -1;   // back to earlier: Replay, Repeat, a jump back
  if (was && !sfxQuiet() && t > from) {
    const hi = SFXQ.hi;
    for (const c of SFXQ.cues) if (c.n > from && c.n <= t && c.n > hi && t - c.n < 0.5) { SFXQ.hi = Math.max(SFXQ.hi, c.n); sfxPlay(c.name, c.set, c.at, c.o); }
  }
  if (APP.playing && !sfxQuiet() && HOST.sfx && HOST.sfx.drone) {
    for (const s of SFXQ.spans) if (t >= s.n0 && t < s.n1) HOST.sfx.drone(s.id, s.name, Object.assign(sfxWhere(s.set, s.at), s.o));
  }
  if (typeof sfxLive === 'function' && !(HOST.picking || XR.stories || xrAway())) sfxLive(dt);
}
```

- `slideStep`: one line after `from` is computed: `SLIDE.from = from;` (and `from: 0` in the `SLIDE` object).
- `frame()`: before the clock moves, `const was = APP.mode === 'story' && APP.playing;`; right after `slideStep(t0);`,
  `sfxStep(was, dt);`. (Before the end check, so a cue in the last frame plays; positions use last frame's matrices,
  which is fine.)
- `sfxPos(set, at, out)`, built engines (sets may hang under the life-size holders, so the group's own world matrix):

```js
// a set's anchor (a name, a function, or [x, y, z] in its frame) in the scene's coordinates; no set: GL.world's origin
function sfxPos(set, at, out) {
  const s = set && GL.sets[set];
  if (!s) out.set(0, 0, 0).applyMatrix4(GL.world.matrixWorld);
  else { const p = anchorOf(set, at); out.set(p[0], p[1], p[2]).applyMatrix4(s.group.matrixWorld); }
  return isFinite(out.x + out.y + out.z);
}
```

  Hand-written: airports and proteins take an index or a code/symbol (`A(code)`), the point on the globe or in the cell
  (`NET.P[3i..]` times `1 + LIFT`; proteins' `nodePos`), then `GL.world.matrixWorld`; spatial a copy id or `CP('SYM@place')`
  (`nodePos`), or `{ org: k }` for an organelle (its `orgAnchor`).
- Headset story panels (`e5_xr.js`):
  - `xrRelease`: `if (r && r.id === p.id && r.fn) { buzz(c); const n = sfxN(); r.fn(); if (sfxN() === n) sfxPlay('click', 'world', h.point); }`
    (a press that made a sound of its own, such as a pick, gets no click: the shell's rule for page buttons).
  - `xrPoint`: a soft `hover` tick when a controller's hover moves onto a new panel region with a `fn` (the shell's menu
    does the same; the sound's 70 ms gap keeps it quiet).
- Page buttons need nothing: the shell's global click listener already clicks, and skips a press whose handler made a
  sound (`count()` moved).
- `dispose` needs nothing (drones fade by themselves; no timers).

**Rules for cue tables** (every builder): times are story time (`C.<ch>.a + s`, beside the `key()` calls they belong to);
a cue lands **0.2 to 0.5 s before** the `data-at` line it belongs to when the visual and the words start together (the
sound announces, the voice follows), or in the pause after a line; a chapter's opening cue lands in the 0.6 s before its
heading; textures under speech get `gain` 0.3 to 0.45; no two cues of the same sound closer than its gap; no more than 4
onsets in any 3 s except a marked sequence (`seq: true` in `o`); at most 6 cue voices overlapping (the static test).
Sequences that come from data (hops, codes, gates) are generated by loops next to the keys that make them.

### 1.3 Explore and headset actions

One line where the story already handles the action, `sfxPlay(name, set, anchor)`; per story in section 3. The roles:
pick something (a node, gene, cell, plot, organ): `pick` at it; a result shown (a path found, a top candidate, a score):
`ping`; a scene change in explore: `whoosh`; a knockout, a closure, a removal: `knock`; undoing it: `rise` (short);
a shuffle or a cut: `snap` (+ `patter`); a simulation started (a walk, an outbreak, a rebuild): `pulse`; a slider
crossing a named stop (a decade, a poster's radius): `step` (rate-limited by its gap). Toggles and plain buttons already
click (page) or get the panel click (headset).

### 1.4 Live simulations (the flock, the robots, the pass story's fish)

`function sfxLive(dt)` in the story's `e4_explore.js` (only these three define it), rate-limited by its own timers, no
set changes except one for the robots:

- **Flock**: the falcon by polling `falconOn()` (false to true): `whoosh` (pitch 1.4, a dive) at the `falcon` anchor, and
  0.4 s later `flutter` at `flock` (the flock bursts away). Polling covers the story's falcon, *Now and then*, a falcon you
  send and one from another device (`falcon` effect) alike, so every device at a station hears each falcon as it already
  sees it. The flock passing near: the `flock` anchor within 7 m of the head (`see()`'s head, in the set's frame), at most
  every 6 s: `flutter` (gain by nearness). Wingbeats are not sounded per bird.
- **Robots**: `vacuum` drones for the two robots nearest the head that are moving (`state()` positions, read at most every
  100 ms; gain and pitch by speed; ids `robots.v0/1`, given to whichever two are nearest). Bumps: the set gains an
  optional `onBump(i, x, z, why)` callback (one line where `BUMPS++` is, set by the engine as `onLaunch` is elsewhere;
  manifest updated): `knock` (pitch 1.8, gain 0.25, a little plastic bonk) at the robot, at most one per robot per 0.3 s
  and four a second in all. Crumbs spilled (yours, from another device `crumbsIn`, or explore's) and eaten: `patter` at
  the pile; `bubble` (pitch 1.6, "nom") when one is eaten, at most twice a second. Dust spread again: `patter` (pitch 0.6).
- **Pass, the fish**: the shark by polling `sharkOn()`: `rush` (dur 1.4) at `shark`, and 0.5 s later `rush` (pitch 1.3,
  dur 1) at `school` (the warning racing through it); the school passing within 3 m of the head, at most every 10 s:
  `rush` soft (gain 0.3). Steering the shark (explore) starts with a `rush`.
- In passthrough AR the life-size sounds are the same; a headset away from its station hears nothing (paused, `xrAway`).

### 1.5 Shared rooms, guards, older shells

- Nothing goes into `collab.state()`, no new effect, no `FORMAT` bump. Each device fires its own cues off the station's
  clock (the crossing rule makes a catch-up step of up to 0.35 s count as playing, a jump not): the same cues at the same
  story time everywhere. Effects other people cause sound as they arrive (the falcon and shark by polling, crumbs in
  `crumbsIn`).
- A headset walked out of its circle keeps its station and its cues, which come from the station's scene and fade with
  distance (HRTF, inverse distance). Away from every station the story is paused: nothing.
- `HOST.sfx` missing, `play` missing, `drone` missing or a name unknown: nothing plays, nothing throws (every call is
  guarded or try/catch). An older story on a newer shell: no cues, phase 1 only.
- `SFXQ.log` records each cue and action even when no sound can play (before the first tap, headless pages): the tests
  count intent; `HOST.sfx.state()` says what really played.

## 2. The new sounds (`sfx.js`, procedural, phase 1's building blocks)

Eighteen one-shots and two continuous sounds, each reused across stories. Levels: story sounds aim at a loudest 400 ms
of about -24 LUFS at full effects volume (textures -28 to -32), well under the narration (-13 to -16) before the -9 dB
duck; nothing low below about 150 Hz (a headset's speakers). `pitch` (k) and `dur` as in 1.1.

| Name | gap ms | What it is (desc) | How (blocks) | Used for |
| --- | --- | --- | --- | --- |
| `grow` | 400 | A network growing: a soft shimmer of glassy grains that thickens and rises over `dur` (default 4 s) | 10 + 6/s tiny bells on an A-major pentatonic over two octaves, density and pitch rising (t = dur * sqrt(u)), random pans (StereoPanner per grain on screens), a faint band of air swelling under them | nodes and links appearing in every network story |
| `link` | 60 | A link snapping on: a bright tick with a short glassy ring (0.25 s) | `tap` at 2.4 kHz k + `bell` 1760 k, short | one edge drawn, two things meeting, a part clicking into place |
| `snap` | 120 | A link breaking: a dry crack and a short falling tone (0.3 s) | highpass `hiss` burst + triangle 900 to 300 k | a pair breaks, a cut, a shuffle, CFTR stuck |
| `whoosh` | 150 | Air moving past: a swish whose band sweeps up (k > 1) or down (k < 1) over `dur` (default 0.9 s) | two `swish` bands, slightly detuned, reverb send | flights between scenes, things flying in, a set opening |
| `bubble` | 50 | A bubble: a quick rising blip with a soft pop (0.12 s) | sine 420 k gliding to 900 k + tiny tap | things appearing one by one, organelles, jars |
| `pick` | 60 | Something picked: a soft pluck with a short ring (0.2 s) | triangle with a fast decay + bandpass noise tap, its own timbre (not `join`'s mallet) | explore's picks, a thing singled out in the story |
| `ping` | 300 | A result: a small two-note chime going up a fifth (0.9 s) | two `bell`s, A6 k and E7 k, little reverb (higher and drier than `notice`) | a top candidate, a score, an answer shown |
| `step` | 60 | One step of a sequence: a short glassy tick whose pitch is set per step (0.1 s) | triangle 1320 k + `tap` | hops of a path, codes, gates, dates, decades |
| `rise` | 600 | A reveal: a soft swell that rises a fourth over `dur` (default 2 s) and fades | detuned triangle chord into an opening lowpass (as `enter`, brighter, with an upward glide) | a set or a big structure appearing |
| `knock` | 200 | A closure or knockout: a soft low thud with a dull knock (0.35 s) | phase 1's `thud` at 190 k to 95 k, darker | airports closing, layers falling, cores lifting, a robot's bump (k 1.8) |
| `heart` | 800 | A heartbeat: lub-dub, two low thuds 0.16 s apart (0.6 s) | two lowpassed `thud`s | the heart in the motor unit |
| `flutter` | 300 | Wings: a fast flutter of feathered air passing by (0.6 s, `dur`) | bandpass noise through a 14 to 18 Hz amplitude flutter, band sweeping, swell and fade | the flock near you, after a falcon |
| `rush` | 300 | Water rushing: a deep swell of noise that opens and closes (1.2 s, `dur`) | brown + pink noise, lowpass 300 to 1400 to 400 Hz k | the shark, the school turning, flows (Sankey, nitrogen) |
| `patter` | 300 | Many small things landing: a patter of tiny clicks over `dur` (default 1.5 s), thinning at the end | ~25/s taps at 2 to 5 kHz k, random levels and pans | fertiliser, crumbs, slides onto a wall, read-outs piling up |
| `spark` | 120 | A nerve impulse or signal: a quick crackle and a falling zap (0.25 s) | three 3 ms highpass bursts + square 2.4 kHz to 600 Hz k through a lowpass | impulses, a junction firing, a signal's relay |
| `pulse` | 400 | A signal spreading: a soft round ping with a slight fall and a long tail (1.2 s) | sine 660 k to 620 k + a quiet fifth, reverb send 0.3 | a module glowing, walkers, a disease neighbourhood |
| `clink` | 80 | Glass: a high, bright clink with an inharmonic ring (0.4 s) | `bell` with partials 1, 2.76, 5.4, 8.9 at 2.1 kHz k | glass slides, the qubits' little cubes |
| `ratchet` | 300 | A mechanism turning: `n` small clicks with a body, evenly over `dur` (default 2 s), each a little higher if `rise` | taps alternating two pitches | gears, slices scanned, stacks filling, a sum built brick by brick |
| `vacuum` (drone) | - | A robot vacuum: a soft motor whine and brushed air; `pitch` follows its speed | sawtooth 220 k into a lowpass 900 Hz + bandpass noise 1.5 kHz, slight wobble | the robots |
| `machine` (drone) | - | A machine running: a low-mid hum with air and a slow beat; `pitch` sets its speed | detuned triangles 180 k and 270 k, bandpass noise 600 Hz, an amplitude beat at 2 k Hz | the supercomputer's hall, the PET scanner's ring, ATP synthase's rotor, the mutation machine's turn |

## 3. Every story's cues

Notation: `ch+s` is `C.ch.a + s` in story time (as in `buildStory`); "where" is `set: anchor` (built) or the node (hand-
written); `(opt)` cues may go if the story's render sounds busy. Options in brackets are `sfxCue`'s `o`. "Explore" lists
the action lines. Every story keeps its phase 1 background.

### airports (Network theory; recorded narration, 3:36)

| When | Sound | Where | What happens |
| --- | --- | --- | --- |
| title+0.2 | rise (dur 2.5, gain 0.5) | globe (no set) | the globe appears |
| nodes+1.8 | grow (dur 8, gain 0.45) | globe | 3,214 airports light up |
| edges+3.4 | whoosh (dur 3, pitch 1.2) | LHR | the London to New York route draws |
| edges+6.6 | link | JFK | it lands |
| edges+8 | grow (dur 11, pitch 0.8, gain 0.35) | globe | 18,858 routes weave in |
| degree+3 | grow (dur 4, pitch 1.3, gain 0.4) | AMS | Amsterdam's routes fan out |
| degree+6 | rise (dur 5, pitch 1.2) | globe | pillars grow by degree |
| paths+3.2 | pick | the path's start | the shortest path's first airport |
| each of `ST.hopEnds` (seq) | step (pitch rising two semitones a hop, gain 0.5) | the hop's airport | the path hops, 4 to 6 times |
| betweenness+6 | whoosh (dur 4, pitch 0.8) | globe | pillars switch to betweenness |
| betweenness+19.2 | link (pitch 0.8) | ANC | Anchorage, the bridge, its routes light |
| communities+2 | grow (dur 3, pitch 0.7) | globe | the regions wash into colour |
| robustness+7.2 | patter (dur 2.8, gain 0.35) | globe | 100 random airports close: barely a dent |
| robustness+18.8, +21.8, +24.8, +27.8 | knock (pitch 1, 0.94, 0.89, 0.84) | globe | the most central close, 25 at a time |
| outro+0.8 | rise (dur 3.6, gain 0.5) | globe | every airport opens again |

Explore: `selectAirport` (click, ray, search) pick at it; `renderPathResult` a path found: `step` along its hops
(`delay` 0.12 s each, `force`), then `ping` at its end; closing airports `knock` (one per action), reopening `rise`
(dur 1); isolating a community `grow` (dur 1.5, pitch 0.7).

### proteins (Network medicine, 3:32)

| When | Sound | Where | What happens |
| --- | --- | --- | --- |
| title+0.2 | rise (dur 2.5) | centre | the network appears |
| nodes+1.8 | grow (dur 8, gain 0.45) | centre | 254 proteins light |
| edges+3 | whoosh (dur 3, pitch 1.2) | TP53 | TP53 to MDM2 draws |
| edges+6 | link | MDM2 | it lands |
| edges+8 | grow (dur 11, pitch 0.8, gain 0.35) | centre | 375 interactions |
| degree+2 | grow (dur 4, pitch 1.3, gain 0.4) | TP53 | TP53's partners fan out |
| degree+6 | rise (dur 5, pitch 1.2) | centre | pillars by degree |
| essential+4.5 | pulse | POLR2A | essential proteins glow |
| communities+2 | grow (dur 3, pitch 0.7) | centre | modules take colour |
| disease+1.5 | pulse (pitch 0.8) | BRCA1 | the breast cancer module glows |
| disease+4 | grow (dur 4, pitch 1.2, gain 0.4) | BRCA1 | its links light |
| paths+4.5 | link (pitch 1.2) | PARP1 | olaparib's target next to the module |
| paths+9.6 | pick | the path's start (BACE1) | the drug path begins |
| each of `ST.hopEnds` (seq) | step (rising) | the hop's protein | the path hops |
| robustness+7.2 | patter (dur 2.8, gain 0.35) | centre | random removals |
| robustness+18.8, +20.8, +22.8, +24.8 | knock (descending) | centre | hubs removed |
| outro+0.8 | rise (dur 3.6) | centre | back again |

Explore: `selectProtein` pick; a path `step`s then `ping`; removals `knock`, restore `rise`.

### spatial (Cell map, 4:51)

| When | Sound | Where | What happens |
| --- | --- | --- | --- |
| title+0.4 | rise (dur 2.5) | cell | organelles appear |
| rooms+1.5 + 2(k-1), k = 1..12 (seq) | bubble (pitch by organelle, gain 0.25) | the organelle (`orgAnchor`) | each compartment in turn |
| address+1.8 | grow (dur 7, gain 0.4) | cell | proteins arrive at their addresses |
| local+2.8 | grow (dur 9, pitch 0.85, gain 0.35) | cell | links only where proteins meet |
| local+10.3 | link | EGFR@pm | EGF meets EGFR |
| multi+6.8 | pulse | CTNNB1's copies | three copies of CTNNB1 glow |
| signal+5.3 | spark | EGF | the signal starts |
| `ST.hopEnds` of the relay (seq) | step (rising, gain 0.35); the move into the nucleus (hop 8) a whoosh (dur 0.8) | the hop's protein | the relay to the nucleus |
| move+7 | spark (pitch 0.8) | TNF | the inflammation signal arrives |
| move+13 | whoosh (dur 4, pitch 0.9) | RELA@nuc | NF-kB travels into the nucleus |
| move+17.4 | ping | RELA@nuc | new partners there |
| prox+4 | pulse (pitch 0.8) | the bait | the labelling cloud spreads |
| disease+5 | snap | CFTR@er | CFTR caught in the ER |
| disease+13 | whoosh (dur 4, pitch 0.8) | TARDBP@nuc | TDP-43 leaves the nucleus |
| disease+16.8 | knock (pitch 1.3, gain 0.5) | TARDBP@cyto | it clumps |
| outro+0.6 | rise | cell | recap |

Explore: `selectProtein` pick; a path `step`s, `ping`; a move played (`renderMoves`) `whoosh` at its protein, `snap`
for a failing move; proximity bait set `pulse`.

### lbi (The future, 10:41, synthetic narration; about 3 a chapter)

| When | Sound | Where | What happens |
| --- | --- | --- | --- |
| title+0.5 | grow (dur 6.5) | int: core | the interactome grows |
| title+7, +10, +13, +16 | pulse (gain 0.3) | int: mod5, mod3, mod8, mod1 | pathways light one after another |
| whole+7 | whoosh (dur 5.5, pitch 0.9) | mac: board | the computer comes apart |
| whole+11.5 | patter (dur 1.5) | mac: screws | its pieces land on the table |
| whole+16 | spark | mac: wires | the circuit is wired |
| whole+25 | grow (dur 4.5) | mac: wires | a network remains |
| everywhere+0.5 | grow (dur 7.5) | web: hub | the internet |
| everywhere+10 | whoosh (dur 2.5) | web | the globe comes |
| everywhere+12 | grow (dur 8, pitch 0.8, gain 0.35) | web: tuft | friendships round the world |
| blocks+0.3 | rise (dur 3) | dna: helix | the helix |
| blocks+8 | whoosh (dur 5, pitch 0.8) | dna: chrom1 | chromosomes |
| blocks+16 | grow (dur 5, pitch 1.4) | dna | proteins fold |
| complex+0.3 | patter (dur 2) | atp: matrix | 13 parts arrive |
| complex+10, +12.5, +15 (seq) | link | atp: head, stalk, ring | the machine assembles |
| span complex+18 to +30 | machine drone (pitch 1.4, gain 0.35) | atp: rotor | protons turn the rotor |
| complex+30 | grow (dur 3) | atp | as a network |
| complex+36 | whoosh (dur 4, pitch 0.7) | int: atp | it shrinks into the interactome |
| map+2 | rise (dur 8) | int: core | the city builds |
| map+14 | pulse | int: pinRed | a hub in the centre |
| map+28 | grow (dur 3, pitch 0.8) | int: mod0 | neighbourhoods |
| map+42 | whoosh (dur 5, pitch 1.2) | int | a route across town |
| rare+3 | pick | crowd: red | one patient |
| rare+5 (opt) | patter (dur 5, pitch 0.7, gain 0.3) | crowd: far | the crowd grows |
| rare+13 | pulse | int: rare | the disease neighbourhood |
| iei+1 | grow (dur 4) | int | the clusters |
| iei+21 | whoosh | sankey | the diagram |
| iei+26 | rush (dur 6, pitch 1.3, gain 0.35) | sankey | flows between categories and clusters |
| treat+3, +5.5, +8 (seq) | link (pitch 1.2) | int: treat | drugs dock |
| treat+11 | grow (dur 10, pitch 0.7, gain 0.35) | int: seed | the signal spreads |
| treat+22 | ping | int: causal | the broken gene on top |
| scales+0.3 | rise (dur 9) | scale: floor0 | the tower of scales |
| scales+15 | grow (dur 7) | scale: floor4 | networks on every floor |
| lbi+2 | grow (dur 8, pitch 1.2) | scale | four research groups |
| body+0.5 | rise (dur 5, pitch 0.9) | body: heart | the PET body glows |
| body+10 | grow (dur 3) | body | the network of organs |
| tissue+11 | grow (dur 5, pitch 1.2) | tissue: zoom | cells joined into a network |
| tissue+22 | whoosh (dur 4.5) | tissue: embed | each sample a point |
| mission+12.5 | whoosh | int | back to the interactome |
| mission+14 | grow (dur 6.5, pitch 1.2) | int: core | every pathway alight |
| mission+20.5 | ping | int: core | the end |

Explore: Scenes `whoosh`; a scene's controls (page or panel) as clicks; Proteins tab: a search or click `pick`, a
route `step`s and `ping`; the ATP scene's "run" `machine` drone while it turns (a span-like hold from explore's own
state).

### nmd (Muscle and heart, 7:34)

| When | Sound | Where | What happens |
| --- | --- | --- | --- |
| title+0.5 | rise (dur 9.5, gain 0.5) | tower: mid | the tower rises layer by layer |
| motor+0.3 | grow (dur 6, pitch 0.9) | motor: cord | the motor unit builds |
| motor+7, +7.6 (seq) | spark | motor: axon, junction | impulses run |
| motor+17 | whoosh (dur 4, pitch 1.2) | motor: sarcomere | the sarcomere opens |
| motor+23 | whoosh (dur 1.5, pitch 0.7) | motor: fibre | the muscle contracts |
| motor+31 | pulse | motor: junction | disease groups light on the unit |
| motor+40, +41 (seq) | heart (gain 0.5) | motor: heart | the heart lights |
| why+0.3 | whoosh | tower | back to the tower, from above |
| tower+2 | grow (dur 3, pitch 0.8) | tower | the categories come up |
| walk+1 | pulse | tower: group(CMg) | seeds of congenital myopathies |
| walk+8 | patter (dur 3, pitch 1.3, gain 0.3) | tower: group(CMg) | walkers set out |
| walk+18 | grow (dur 12, pitch 0.7, gain 0.3) | tower: group(CMg) | the heat spreads |
| walk+34 | rise (dur 10) | tower: group(CMg) | the module grows |
| layers+3, +15, +24 (seq) | step (pitch 1, 1.12, 1.26) | tower | each group's z-scores |
| endo+2 | grow (dur 4, pitch 1.1) | tower | endotypes in colour |
| endo+12 | ratchet (n 8, dur 6, gain 0.3) | tower | gathered on a grid |
| overlap+2 | whoosh (dur 5) | tower: pairMid | two towers |
| overlap+34 | pulse (pitch 0.8) | tower: pairMid | seeds alone |
| stress+2, +5, +8 (seq) | knock (descending) | tower | layers fall away; the module holds |
| span stress+13 to stress+33 | machine drone (pitch 0.9, gain 0.3) | hpc: racks | the supercomputer's hall |
| stress+18 | grow (dur 5) | hpc: field | the sea of towers |
| next+2 | rise (dur 6) | tower | the tower opens round you |

Explore: a group picked `pick` at `group(g)`; a gene `pick`; Walk started `pulse` at the seeds (and `patter` while
walkers start); a layer knocked out `knock`, back `rise` (dur 1); endotypes picked `pick`; *Stand inside* `rise`.

### endo (Endotypes, 6:56)

| When | Sound | Where | What happens |
| --- | --- | --- | --- |
| title+0.5 | grow (dur 7.5, pitch 0.9) | motor | the motor unit builds |
| title+5 | spark | motor: axon | impulses |
| tired+7 | whoosh (dur 1.6) | motor: junction | the dive into an end plate |
| tired+11, +11.6 (seq) | spark | syn: activezone | the junction fires |
| tired+17, +19, +21 (seq) | spark (gain 0.45, 0.28, 0.15) | syn: activezone | and tires |
| genes+4, +10, +13, +17, +22 (seq) | step (rising) | syn: terminal, cleft, receptors, folds, channels | gene groups light where they act |
| cloud+0.3 | grow (dur 6) | net: cloud | 18,306 proteins |
| cloud+9 | pulse | net: seeds | the 35 seeds |
| cloud+17 | grow (dur 12, pitch 1.2, gain 0.3) | net: seeds | neighbourhoods grow |
| walk+2 | pulse | net: seeds | walkers set out |
| walk+10 | grow (dur 10, pitch 0.7, gain 0.3) | net: module | heat |
| walk+23 | rise (dur 8) | net: module | the module pulls together |
| hood+2 | pick | net: gene | one gene |
| hood+16 | whoosh | tree: matrix | to the matrix |
| hood+18 | patter (dur 10, gain 0.25) | tree: matrix | the matrix fills |
| split+1 | grow (dur 8, pitch 0.8) | tree: tree | the tree grows from its leaves |
| split+28 | whoosh | tree: mds | genes by tree distance |
| endotypes+1 | rise (dur 4) | tree: meta | the endotype network |
| four endotypes at +9, +19, +29, +38 (seq) | ping (gain 0.4) | tree: meta | each endotype told |
| endotypes+50 + 2.6 j (seq) | bubble (gain 0.3) | syn | each endotype flies to its place |
| next+3 | rise (gain 0.4) | syn | every endotype in place |

Explore: an endotype `ping`; a gene `pick`; Method steps `step` (pitch by step); Scenes `whoosh`; *Stand in the gap*
`rise`.

### pet (One scan, one system, 6:33)

| When | Sound | Where | What happens |
| --- | --- | --- | --- |
| title+0.3 | rise | scan: vision_scan | the vision row |
| title+10 | whoosh (dur 5, pitch 0.8) | scan: centre | it draws back into the scanner |
| span scanner+1 to scanner+34 | machine drone (pitch 1.3, gain 0.22) | scan: ring | the scanner's ring |
| scanner+1 | whoosh (dur 6, pitch 0.6, gain 0.4) | scan: couch | the couch slides in |
| scanner+9 | whoosh (dur 2, pitch 1.3) | scan: ring | the skin opens on the ring |
| scanner+12 | patter (dur 1.5, pitch 1.4, gain 0.3) | scan: event | first coincidences |
| scanner+16 | grow (dur 11, pitch 1.3, gain 0.3) | scan: lor | lines of response |
| scanner+27 | rise (dur 5) | scan: patient | the image forms |
| body+1.5 | whoosh (dur 3.5, pitch 0.8) | body | the patient stands up and turns |
| body+6.5 | grow (dur 8, pitch 0.9) | body | the tracer arrives: hot organs |
| body+24 | pulse (pitch 0.8) | organs: lesion (the tumour) | a tumour |
| organs+1 | ratchet (n 20, dur 10, pitch 1.5, gain 0.22) | organs | outlined slice by slice |
| organs+15 | rise (dur 6) | organs | each organ's uptake as a bar |
| organs+23, +27, +31 (seq) | pick | organs: brain, liver, muscle | three organs in turn |
| cohort+3 | grow (dur 5) | organs | the network of 658 scans grows on the body |
| health: each `goNet` (+7, +10, +21, +27, +36, +41.5) | grow (dur 1.8, gain 0.35, pitch alternating 0.85 / 1.15) | organs | each network from the one before |

Explore: an organ `pick`; a network (Table 2 row) `grow` short; Scenes `whoosh`; life size `rise`; the scanner's views:
its explore scene holds the `machine` drone while shown.

### micro (Tissue and time, 7:07)

| When | Sound | Where | What happens |
| --- | --- | --- | --- |
| title+0.3 | rise | body | the PET body |
| title+3 | patter (dur 4, pitch 1.4, gain 0.3) | body | organs' points light one by one |
| title+11.5 (slide−2.5) | pick | body: stomach | the stomach's point glows |
| slide+1.2 | whoosh (dur 2) | slide | into the stomach, the section |
| slide+22.5, +24.5, +26.5, +27.5, +28.5 (seq) | step (rising) | slide: mucosa, submucosa, inner, outer, lymphoid | domains wash in |
| library+1 | clink | atlas: library | the first slide |
| library+1.5 | patter (dur 11, gain 0.35) | atlas: library | 24,945 slides burst onto the wall |
| method+2 | grow (dur 6, pitch 1.2) | slide: tiles | tiles |
| method+9.5 | grow (dur 6, pitch 1.5, gain 0.35) | slide: feat | features light up |
| method+18, +20, +22 (seq) | pulse (gain 0.3) | slide: listen | messages along the links |
| method+26.5 | whoosh (dur 4, pitch 1.2) | slide: cloudC | the lift into a map |
| method+33 | whoosh (dur 2.5, pitch 0.7) | slide | back down onto the slide |
| method+37.5 | rise (dur 5) | atlas | the tile cloud of all slides |
| atlas+15 | rise (dur 16, gain 0.4) | hier: top | the atlas turns into the network |
| atlas+20 | whoosh (dur 3) | hier: top | organs fly up to their nodes |
| atlas+30 | ping | hier: focus | the tissue type shared most widely |
| age+0.3 | grow (dur 6) | atlas | the volcano |
| age+14 | pick | atlas | the ovary |
| age+17 | rise (dur 6, pitch 0.8) | atlas | 20 to 70 |
| age+27 | rise (dur 6, pitch 0.8) | slide: submucosa | the gut ages |
| pathology+1.5 | grow (dur 5, pitch 0.8) | atlas | the trajectories |
| contacts+0.5 | whoosh | hier: contacts | the colon's contacts |
| contacts+7 | rise (dur 7, pitch 0.8) | hier: change | 20 to 70 |
| contacts+16 | whoosh (dur 1.5) | hier | the switch to the artery |
| next+0.5 | rise (gain 0.4) | body | tissue and time |

Explore: an organ `pick`; the age slider `step` on each decade crossed; a domain `pick`; method steps `step`; Scenes
`whoosh`.

### ovary (The aging ovary, 6:27)

| When | Sound | Where | What happens |
| --- | --- | --- | --- |
| title+0.3 | rise (gain 0.4) | body | the body |
| title+9.5 | rise (dur 9, pitch 0.9) | organ: small | the ovary grows out of the body |
| title+20 | whoosh (dur 7, pitch 0.7) | organ: cortex | it opens |
| title+27 | ping | organ: follicle | its parts named |
| donors+1 | clink | charts: slides | the first slide |
| donors+1.5 | patter (dur 9) | charts: fan | 255 slides fly in and fan out |
| donors+13 | ratchet (n 12, dur 10, pitch 0.8, gain 0.3) | charts: hist | they stack into the age histogram |
| section+6, +12, +18, +24 (seq) | pick | section: vessel, macrophage, albicans, follicle | each kind picked out |
| section+30.5 | grow (dur 1.5) | section: center | all four |
| section+35 | whoosh | section: young | a younger and an older section |
| methods+2 | grow (dur 5, pitch 1.2) | section: center | tiles |
| methods+8 | grow (dur 6, pitch 1.5, gain 0.35) | section | UNI2 features |
| methods+16 | patter (dur 6, pitch 0.8, gain 0.3) | section | a grove of trees grows |
| methods+28 | ratchet (n 10, dur 4) | section | they vote |
| methods+33 | ping | section | the predictions |
| methods+39.5 | whoosh (dur 3) | section | SegFormer's masks wash in |
| trends+3 | pick | organ | the count tags |
| trends+5 + 6.4 k, k = 0..5 (seq) | step (pitch falling a tone each decade, gain 0.3) | organ: follicle | the ovary ages 20 to 70: the reserve shrinks |
| network+2 | grow (dur 7) | section: center | the neighbour network over the section |
| network+10 | whoosh (dur 4, pitch 1.2) | section | it tips up off the section |
| network+14.5 | rise (dur 4.5) | section | it gathers into hubs by kind |
| network+20 + 5.3 k, k = 0..3 (seq) | step (falling, gain 0.25) | section | it ages 25 to 65 |

Explore: a kind `pick` (also by pointing at an object); the age slider `step` per decade; the method switch `whoosh`;
*By kind* `rise`.

### qubits (Three qubits, 9:03)

| When | Sound | Where | What happens |
| --- | --- | --- | --- |
| title+1 | patter (dur 2, pitch 1.3, gain 0.3) | pairs: genes0 | a few genes |
| title+6 | grow (dur 12, gain 0.35) | pairs: tri | the grid of all pairs grows |
| title+18 | rise (dur 5) | pairs: tri | until it fills the view |
| walkers+0.3 | whoosh | pairs: map | the map |
| walkers+5, +5.6 (seq) | pulse | pairs: walker0, walker1 | two walkers set out |
| walkers+14 | grow (dur 4, pitch 0.6) | pairs: valley0 | the valleys (illustrative) |
| walkers+22 | rise (dur 6, pitch 0.8) | pairs: valley1 | where they settle |
| shrink+2 | rise | pairs: chip | the chip with three qubits |
| shrink+10 | whoosh (dur 8, pitch 0.7) | pairs: map | the map folds into eight |
| shrink+18 + 1.1 c, c = 0..7 (seq) | step (pitch per code 000..111, a major scale) | pairs: hood c | each neighbourhood's code on the chip |
| cut+0.5 | whoosh | cube: genes | the network in 3D |
| cut+8, +18, +28 (seq) | snap | cube: genes | cut in two, four, eight |
| coarse+0.3 | rise (dur 8) | cube: cube | A_c grows on the cube |
| bricks+5 + 3 i, i = 0..7 (seq) | clink (gain 0.3) | cube: top | each Pauli string in turn |
| bricks+34 | ratchet (n 10, dur 16, rise, gain 0.25) | cube: cube | the ten largest added one by one |
| toolbox+2 | snap (pitch 0.7) | cube | strings outside the algebra go grey |
| toolbox+9 | whoosh (dur 6, pitch 0.8) | cube | the cube keeps only those inside |
| toolbox+23 | whoosh | chart: chart | the chart |
| toolbox+27 | grow (dur 10, pitch 0.8, gain 0.35) | chart: ours | the residual by depth |
| toolbox+38 | ping | chart: ex3 | the example's point |
| circuit+0.3 | whoosh | chart: circuit | the circuit |
| circuit+3 + 1.67 g, g = 0..5 (seq) | step (pitch by wire) | chart: circuit | six gates in time order |
| circuit+14 | ping | chart: circuit | the recipe |

Explore: a network or cut `grow` / `snap`; bits `step`; a brick picked `clink`; the sum slider `step` per brick; gallery
`whoosh`; Depth tab `whoosh`; the example on `ping`.

### mutation (The mutation machine, 8:24)

| When | Sound | Where | What happens |
| --- | --- | --- | --- |
| title+0.3 | rise | letters: helix | the helix |
| title+6 | whoosh (dur 5, pitch 1.1) | letters: ancestor | the strand peels into the ancestor's row |
| title+13 | patter (dur 2) | letters: copy1 | copy one |
| title+15.5 | pick (pitch 1.5) | letters: swap1 | a swap |
| title+18.5 | patter (dur 2) | letters: copy2 | copy two |
| title+21 | pick (pitch 1.5) | letters: swap2 | a swap |
| tree+4 | grow (dur 18, pitch 0.9, gain 0.35) | tree: root | the family tree grows |
| tree+24 | ping | tree: long | a long and a short branch |
| qubits+2 | whoosh (dur 1.5) | letters: ancestor | a tile opens into two qubits |
| qubits+9, +12, +15 (seq) | step (pitch 1.12, 1.26, 1.41) | letters | the four codes |
| qubits+19 | whoosh (pitch 1.3) | letters | the tilt into a mix |
| qubits+24 | patter (dur 10, gain 0.3) | letters | read-outs pile up |
| rule+1 | grow (dur 5) | rule: pyramid | balls and arrows |
| rule+16 | rise (dur 5) | rule: pyramid | the pyramid of mixes |
| rule+22 | pick | rule: ballA | the path starts at A |
| rule+35 | ping | rule: mix | it reaches the long-run mix |
| machine+0.3 | ratchet (n 8, dur 4) | rule | the compiler |
| machine+4 | rise (dur 4) | rule | the machine |
| machine+8 | whoosh | rule | the copy |
| span machine+13 to machine+20 | machine drone (pitch 1.2, gain 0.3) | rule | the turn |
| machine+29 | ratchet (n 14, dur 3) | tree: crown | a machine on every branch |
| pairs+6 | whoosh (dur 6, pitch 0.8) | stem: stem | the strand folds into a stem |
| pairs+14 | snap | stem: brk | a pair breaks |
| pairs+21 | link | stem: gear | the coupling keeps one |
| pairs+28, +31, +33 (seq) | step (rising) | stem: square | the count of combinations |
| rebuild+0.3 | grow (dur 6) | tree | the species tree |
| rebuild+14 | patter (dur 10, gain 0.3) | stem | fields of rebuilt ancestors |
| rebuild+18, +21, +24 (seq) | step | stem | each field lit |
| rebuild+31 | ping | stem | the true ancestor |
| what+2 | ratchet (n 10, dur 4, gain 0.25) | tree | the machines running |

Explore: Letters 1 more `step`, 100 more `patter`; a rule `grow`; a branch picked `pick`; machines running `ratchet`;
the pair favour slider `step`; Rebuild again `patter`; Scenes `whoosh`.

### topo (The shape of tissue, 8:44)

| When | Sound | Where | What happens |
| --- | --- | --- | --- |
| title+0.3 | rise (gain 0.4) | body | the body |
| title+3.5 | whoosh (dur 5, pitch 0.8) | body: liver | the liver lifts out and turns |
| title+9 | whoosh (dur 0.6, pitch 1.5) | body: liver | a thin slice |
| title+12 | knock (pitch 1.4, gain 0.4) | slide | it falls flat |
| title+21, +25.5 (seq) | whoosh (dur 1.5) | slide | other modalities sweep in |
| title+29.5 | patter (dur 2, pitch 1.3) | slide | every cell becomes a bead |
| scale+4, +11, +17 (seq) | step (rising) | slide: square | three fixed scales |
| scale+23 | pick | slide: patch | the poster's patch |
| balls+3 | grow (dur 5, pitch 1.4) | tower: plate | cells shrink into beads |
| balls+`SNAP_AT[k]`, k = 0..3 (seq) | pulse (pitch rising) | tower: plate | the balls stop at the poster's four snapshots |
| balls+46 | whoosh | tower | the radius to 60 µm |
| tower+1 | rise (dur 9) | tower: top | the tower rises |
| tower+12 | whoosh (dur 5, pitch 1.2) | tower | the plane sweeps up |
| tower+17 | link | tower: hole | the big loop just closed |
| tower+29 | grow (dur 11, pitch 0.8, gain 0.35) | tower | the barcode |
| cohort+1 | clink | cohort: rack | 123 glass slides |
| cohort+1.5 | grow (dur 14, gain 0.3) | cohort: rack | curves light one after another |
| cohort+22 | whoosh | cohort: phi1 | the two main shapes |
| cohort+31 | patter (dur 6) | cohort | slides fly into the cube of scores |
| scales+1 | rise | cohort | the classifier's wall |
| scales+11 | grow (dur 12, gain 0.3) | cohort | the weight for every radius |
| scales+25 | patter (dur 7, pitch 0.7, gain 0.3) | cohort | bands drop into the gap |
| scales+34 | ratchet (n 12, dur 8) | cohort | the held-out stacks |
| cells+0.3 | clink | slide: window | a new slide |
| cells+4 | whoosh (dur 6) | slide: window | the zoom |
| cells+11 | pick | map: cell | one cell |
| cells+13 | grow (dur 8, pitch 1.2) | map: dome | its network grows with the balls |
| cells+27 | ping | map: score | its score |
| cells+33 | rise (dur 10, gain 0.4) | map: sweep | every cell scored, a relief |
| next+2 | whoosh (dur 8) | map | the two groups and their piles |
| next+18, +25 (seq) | whoosh (dur 2) | map | the genes and proteins sketches |

Explore: the radius slider `step` at the poster's four stops; a slide picked `clink`; a window of radii `step`; a cell
picked `pick`; Scenes `whoosh`.

### soil (Holding on to nitrogen, 8:42; background: wind)

| When | Sound | Where | What happens |
| --- | --- | --- | --- |
| title+0.5 | rise (dur 6) | soil: stem | the wheat grows from a seedling |
| title+6 | patter (dur 5) | soil: fert | fertiliser falls |
| title+12 | rush (dur 10, pitch 0.8, gain 0.3) | soil: nh4 | the flows: up, down, out |
| relay+2 | whoosh (dur 5) | soil: pore | a pore, magnified |
| relay+8, +16, +24, +33 (seq) | pick (pitch rising) | soil: aoa, aob, nob, comammox | the four relay runners |
| relay+49 | whoosh (dur 4, pitch 0.7) | soil: pore | the pore shrinks back |
| bni+2 | rise | soil: grass | the wild grass |
| bni+9 | whoosh | soil: chromGrass | two chromosomes |
| bni+21 | link | soil: chromWheat | the segment lands in the wheat's |
| bni+26 | pulse | soil: halo | the halo round the roots |
| bni+28 | pulse (pitch 0.7, gain 0.35) | soil: pore | the relay slows |
| trial+2 | whoosh (dur 9, pitch 0.6) | web | the globe turns east, the hop to Japan |
| trial+11 | ping | web | Japan |
| trial+14.5 | whoosh | field | down to the field |
| trial+16 | rise (dur 8) | field | the wheat grows |
| trial+26, +29.5, +33, +36.5 (seq) | knock (pitch 1.4, gain 0.35) | field | each date, a core lifts from every plot |
| trial+41 | patter (dur 9) | field: stack | the cores fly into the stack |
| leaks+3 | rise (dur 4, pitch 1.2) | field | leaves by their chlorophyll |
| leaks+8 | pick | field: bni | the BNI plots picked |
| leaks+22 | whoosh (dur 4, pitch 0.7) | field | back to day 24 |
| leaks+23 | rush (dur 5, pitch 0.6, gain 0.3) | field: under | nitrate seeping |
| leaks+28.5 | pick | field: bni | the fertilised BNI plots |
| leaks+42, +42.4, +42.8 (seq) | bubble | field: jars | the jars |
| leaks+45, +48, +51, +54 (seq) | bubble (pitch 0.7, gain 0.3) | field: jars | breathing N2O |
| crowd+2 | grow (dur 7, pitch 0.9) | net: cloud | 20,000 kinds |
| crowd+24 | pulse (pitch 1.2) | net: cloud | the nitrifiers flare |
| together+2 | whoosh (dur 8) | net: net | kinds fly out to their layout |
| together+7 | grow (dur 6) | net: net | links fade in |
| together+19 | snap | net: net | the shuffle |
| together+19.3 | patter (dur 3.5, gain 0.3) | net: net | the links dissolve |
| together+31 | grow (dur 4, pitch 1.2) | net: net | modules take colours |
| together+38, +45 (seq) | pulse (pitch 1, 0.8) | field | a module lights its plots |
| together+56 | whoosh (dur 6) | net: mid | the two wheat lines' networks |
| know+1 | rise (gain 0.4) | soil | back in the block |
| know+5, +9, +13, +18, +23 (seq) | step (rising) | soil: tracer | one marked atom: grain, soil, microbe, root, leaf |
| know+24 | ping | soil: ear | into the leaf |

Explore: a group of plots `pick`; a measure `grow` (dur 1); N2O brings the jars `bubble`; Nitrogen's switches
(page or panel click) and a `rush` (dur 1.5) as the flows change; a kind `pick`; a module `pulse`; the threshold `step`;
Shuffle `snap` + `patter`; Split `whoosh`; Scenes `whoosh`.

### pass (Pass it on, 7:01; English and German; background: sea; live: the shark, the school)

| When | Sound | Where | What happens |
| --- | --- | --- | --- |
| fish+6 | bubble (gain 0.3) | fish: school | the school named |
| watch+4 | grow (dur 3) | fish: school | who watches whom |
| (watch+20: the story's shark is live: no cue, so it is not heard twice) | | | |
| links+5 | snap | fish: school | one neighbour each: the school falls apart |
| links+5.4 | rush (pitch 1.2, dur 1) | fish: school | |
| links+24 | link | fish: school | seven again |
| links+24.4 | rise (dur 3) | fish: school | it comes together |
| sky+2 | whoosh (dur 7, pitch 1.3) | fish | out of the water |
| sky+8 | grow (dur 6) | globe | the globe |
| sky+18 | pulse | globe: start | the outbreak starts in Vienna |
| sky+22 | grow (dur 12, pitch 0.7, gain 0.3) | globe | it spreads along the routes |
| sky+44 | rise (dur 3) | globe | the hubs' pillars |
| cell+2 | whoosh (dur 3) | cell | into the cell |
| cell+3 + 1.2 k, k = 0..9 (seq) | bubble (pitch by organelle, gain 0.25) | cell: the organelle | organelles one by one |
| cell+15 | link | cell | two proteins meet |
| cell+23 | spark | cell | the relay begins |
| cell+29 | whoosh (dur 4, pitch 0.9) | cell: org_nuc | NF-kB into the nucleus |
| cell+42 | snap | cell: CFTR | CFTR stuck on its way |
| med+0.3 | pulse (pitch 0.8) | cell | the network stands out, CFTR's links lost |

Live (1.4): the shark, the warning, the school near you. Explore: be the shark `rush`; neighbours watched `step`; the
school's size `patter`; an airport picked `pick`; Play the outbreak `pulse`; a city looked up `pick`; a protein `pick`;
a move `whoosh`; the language switch clicks (page or panel).

### flock (Flock, 1:12; background: dusk; live)

| When | Sound | Where | What happens |
| --- | --- | --- | --- |
| seven+7 | grow (dur 2, pitch 1.2, gain 0.35) | flock: flock | each bird's seven links |
| (wave+1: the story's falcon is live: no cue) | | | |
| around+0.3 | rise (gain 0.4) | flock: flock | round you |

Live (1.4): the falcon's dive and the burst, the flock passing near. Explore: a falcon sent (sky click or trigger) is
heard through the live hook; the birds slider `flutter`.

### robots (Robot gang, 1:24; background: room; live)

| When | Sound | Where | What happens |
| --- | --- | --- | --- |
| title+2 | grow (dur 9, pitch 0.8, gain 0.3) | robots: floor | the room is found |
| title+10.4 | ping (gain 0.4) | robots: dock | the dock |
| bump+0.3 | rise (dur 1.5, pitch 1.2) | robots: dock | the gang wakes |
| follow+0.3 | ping (pitch 1.2, gain 0.35) | robots: you | follow you |
| follow+6 | grow (dur 2) | robots: gang | the links: a star |
| chain+0.3 | ping (pitch 0.9, gain 0.35) | robots: gang | follow the one ahead |
| chain+12 | patter (dur 1.5) | robots: crumbs | crumbs |
| gang+0.3 | ping (gain 0.35) | robots: you | your gang |

Live (1.4): the vacuums, bumps, crumbs eaten. Explore: a rule `ping`; robots added `bubble` (one per robot, at most
six); crumbs `patter` (in the spill path, so the effect from another device sounds too); a click to walk `pick` at the
target.

### design (the props table; not a story)

| When | Sound | Where | What happens |
| --- | --- | --- | --- |
| table+0.2 | rise (dur 2, gain 0.4) | table | the table fades in |

Explore: pointing at a miniature: the shell's `hover` tick (at it); a pick (click, trigger, pinch) `pick` at it and
`rise` (dur 0.8, pitch 1.3) at the stage; the grip `grab` and letting go `drop` (phase 1's room sounds) at the
miniature; *Tidy the table* `place` per miniature moved back (delays 0.07 s, `force`, at most 12, as Arrange all does);
All props / a story's plate `whoosh`.

## 4. Testing without ears

### 4.1 A cue checker, `tools/sfx-cues.mjs` (builder A, first deliverable; reused by smoke and audio)

`node tools/sfx-cues.mjs [url] [keys|all]`: loads each story headless, reads `HOST.cur.peek('SFXQ.cues')` and
`SFXQ.spans`, and checks: every name is a known sound or drone (`SFX_LIB.SOUNDS`, `DRONES`); every position resolves to
finite numbers (`sfxPos`); times within `[0, T_END]`, sorted after build; between 6 and 60 cues (the tour's limit
higher); the density rules of 1.2 (no 3 s window with more than 4 onsets unless `seq`; no same-name pair closer than its
gap); the static overlap: with each cue's length from `SFX_LIB.length(name, o)`, at most 6 cue voices at any moment and
at most 2 story drones; prints each story's busiest moment (time and count). Fast (no audio, seconds per story); the
builders run it on their stories instead of the whole smoke test while working.

### 4.2 `tools/smoke.mjs`

For every story it already loads: the cue checker's static checks (one `peek` each); playing a stretch (the smoke
test's scrub and play already happen): `SFXQ.log` grows by exactly the cues crossed; a scrub across cues adds none; the
slideshow part: no cue after a stop until Next, then the next one; explore actions (where the smoke test exercises
them) add a `pick` or `ping` to the log; with a pretend headset, a press on a story panel button logs a `click`.

### 4.3 `tools/audio.mjs` (real Web Audio after a tap)

- On by default (no `sfxOn`: on; `sfxOn` = off: off; `#sfx=off`; `#sfx=on`); the bar's Sound button mutes the effects
  and the background too, and unmuting brings them back (decision 2).
- A cue at its time: open `#airports&t=<2 s before nodes+1.8>`, play: `SFXQ.log` gets `grow` within 0.15 s of its
  time, `HOST.sfx.state().last` is `grow`, the output's level rises; pause: nothing more; a seek over three cues: none;
  playing on: the next one; Replay: the first cue again (`hi` reset).
- A span: the tour at `complex+17`, play: `state().drones` has the rotor while inside, gone (faded) 0.6 s after a
  pause and after a seek out of it; a hot swap mid-span keeps the drone.
- The voice limit in each story's busiest moment (from the cue checker): jump just before it, play 6 s, `voices` never
  above 16 and `cut` unchanged (no story cue had to cut another), for the airports, the tour, the soil story and the
  robots (live: the vacuums and bumps; the drone count at most 4).
- Explore: a pick plays `pick`; a pretend headset's panel press plays `click` at the hit point through an HRTF panner
  (`state().spatial`).
- Nothing before a tap; nothing with the `<audio>` element engine (as phase 1's checks).

### 4.4 `tools/collab.mjs` (the same cues on every device at a station)

In the per-story part, for the first story only (cheap): two pages following the station play 12 s; their `SFXQ.log`
lists hold the same names at story times within 0.3 s; a pause on one stops cues on both; a page that joins mid-play
logs nothing for the past; a slideshow stop there stops both at the same cue. The flock: each falcon (one page leading)
logs `whoosh` and `flutter` on every page. The robots: crumbs from one page log `patter` on the others.

### 4.5 Levels by rendering, and listening (`tools/sfx.html`, `tools/sfx-render.mjs`)

- The sound board gains **Story sounds** (each with its description, where it is used, `pitch` and `dur` sliders where
  the recipe reads them), **Continuous sounds** (start, stop, a pitch slider), and **A story's sounds**: pick a story,
  and the board renders its whole sound track (its cues at their recording times, its spans, its background under them,
  and its narration where it has a recording, the effects ducked where the voice speaks) and plays it with a seek bar.
  The cue list comes from the app in a hidden frame (as `tools/icons.html` does).
- `node tools/sfx-render.mjs [url] [out]` renders the new sounds (`sfx-<name>.mp3`; the drones 4 s each) into
  `sfx-all.mp3` and `levels.txt` as before, and flags a story sound whose loudest 400 ms is outside -32 to -20 LUFS.
- `--story <key,key|all>` writes `story-<key>.mp3` and `story-<key>.txt` (each cue: mm:ss, chapter, sound, where), so
  the owner can hear each story's sound design against its narration without a headset. Rendered in 60 s chunks
  (with 3 s of pre-roll, cut) and joined by ffmpeg, so a ten-minute story never needs one huge offline buffer.
- How it sounds, and how it sounds on a headset, is unheard until the owner listens (report so).

## 5. Split, order and estimate

**A, the shell side and the tests** (strongest model for the recipes; owns `sfx.js`, `index.html` if needed,
`tools/sfx.html`, `tools/sfx-render.mjs`, `tools/sfx-cues.mjs`, `tools/audio.mjs`, the sound parts of
`tools/smoke.mjs` and `tools/collab.mjs`, AGENTS.md's and CLAUDE.md's sound notes, README.txt, HANDOVER.md):

1. First, in about 45 minutes: the interface (default on, the mute, `pitch`/`dur`/`n`, `drone`, `SFX_LIB.length`), every
   new name registered with a stand-in recipe, the story block of 1.2 written into **the flock's engine as the
   reference** and into **airports.js as the hand-written reference**, and `tools/sfx-cues.mjs`. B and C copy from those
   two, character for character.
2. Then the real recipes (section 2), the sound board, the renders (`--story`), the audio tests; render every new sound
   and post the files for the owner to listen to before the stories are done.

**B, eight stories** (owns their sources): `stories/airports.js`, `proteins.js`, `spatial.js`, `tools/lbi/`,
`tools/nmd/`, `tools/endo/`, `tools/pet/`, `tools/micro/` (engine parts only; no set changes, so nothing that other
stories include changes). Never edit the parts of `airports.js` and `spatial.js` that the pass story cuts
(`ORIGINALS` in `tools/pass/build.mjs`: airports' lines from `const NET_B64=` to `// Narration timing` and from
`const COMM_NAMES` to the camera section's header; spatial's from `// Spatial interactome data` to its camera header,
plus the named declarations listed there): the new lines go next to `slideStep` and in `buildStory`, which lie outside.

**C, eight stories and the design room**: `tools/ovary/`, `tools/qubits/`, `tools/mutation/`, `tools/topo/`,
`tools/soil/`, `tools/pass/`, `tools/flock/` (after A's reference lands there), `tools/robots/` (engine, and the one
`onBump` line in `sets/robots.js` and its manifest), `tools/design/`. After B finishes, run
`node tools/pass/build.mjs --check` (it must still be current: B touched nothing the pass story takes).

Shared rules for B and C: the block of 1.2 identical everywhere (`diff` against the reference), `sfxPos` identical in
every built engine; cues next to the keys they belong to; run each build with `--check` afterwards; run
`tools/sfx-cues.mjs` on each story, and the smoke test once at the end (one builder at a time: headless work is heavy on
this machine). Bump nothing (`VERSION`, `release.mjs`): that is the integrator's.

**Order on this 4-CPU machine (two agents at once):** A starts alone; B starts as soon as A's reference lines land
(about 45 minutes in); C starts when A finishes (A's step 2 overlaps B). Then one review on Sonnet (the cue tables
against this plan, the shared lines' identity, guards, the pass cut), one fix round only if it finds something, then
the integrator's single test round: `tools/sfx-cues.mjs all`, `tools/smoke.mjs`, `tools/audio.mjs`, `relay/test.mjs`
and `tools/collab.mjs` (hooks untouched, but the per-story part gains the cue check), `tools/live.mjs` (a swap mid-span),
`tools/update.mjs` (sw.js changes), then `VERSION`, `node tools/release.mjs`, docs, push.

**Estimate**: A about 3 h and 1.2 to 1.5M tokens; B about 2.5 h and 0.9 to 1.1M; C about 3 h and 1.0 to 1.3M (the live
parts); review 0.25M; fix round 0.2M; integration and tests about 1.5 h and 0.4M. In all about 6 to 7 hours of wall
time and 4 to 4.7M tokens. The owner can listen to the new sounds (A's renders) after about 2.5 hours, and to every
story's track (`--story all`) before the release.

## 6. Docs to update, and what stays untested

- AGENTS.md: "Sound effects" (phase 2 built, on by default, the mute, `pitch`/`dur`/`n`, drones, the new sounds and where
  each is used, the cue checker, `--story` renders), "Inside a story" (the sound effects block, `sfxCue`/`sfxHold`
  beside the keys, `sfxLive`), Testing (the new checks), the robots' `onBump`. CLAUDE.md: the sound line (on by default;
  after changing a story's cues run `tools/sfx-cues.mjs <key>` and `tools/sfx-render.mjs --story <key>`; report how it
  sounds as unheard). README.txt (effects on by default; off in Sound check; the Sound button silences everything).
  HANDOVER.md (phase 2 done; open: the owner's listening of each story). `docs/event-runbook.md` (effects on by default
  at an event; the volume step in the headset menu).
- Untested until tried on headsets: how the story sounds sound on a Quest's speakers, HRTF placement of scene sounds,
  ten headsets at one station (the flam), the vacuums and the flock in passthrough, the click on story panels in the
  headset. Unheard until the owner listens: every new sound and every story's track.
