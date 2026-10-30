# Sound effects, phase 2: the lines every story keeps (for builders B and C)

> **Since v100 (30 October 2026, the owner after listening):** the continuous `machine` hum and every background but
> the flock's (`dusk`) and the pass story's (`sea`) are gone; `vacuum` is the only continuous sound left. The `machine`
> spans and beds below are history: a story that asks for them now hears nothing. AGENTS.md ("Sound effects") is current.

Written by builder A, 29 October 2026. The references are **the flock** (`tools/flock/engine/`, built engines) and **the
airports** (`stories/airports.js`, hand-written). Copy the lines below **character for character**; only `sfxPos` of
the hand-written three, the cue calls, the explore action lines and `sfxLive` are each story's own. The plan
(`PLAN.md` next to this file) has every story's cue table (section 3).

## 0. What the shell gives (sfx.js)

- `HOST.sfx.play(name, o)`: o `{ at: [x, y, z], pan, gain, delay, force, pitch, dur, n, rise }`. `pitch` is a frequency
  factor (default 1), `dur` a length in seconds for textures and sweeps (`grow`, `whoosh`, `rise`, `flutter`, `rush`,
  `patter`, `ratchet`; each has its own default), `n` the ratchet's clicks (8), `rise: true` each click a little higher.
  Unknown names play nothing (null).
- Story sounds (each with its gap in ms): `grow` 400 (dur 4), `link` 60, `snap` 120, `whoosh` 150 (dur 0.9; pitch > 1
  sweeps up, < 1 down), `bubble` 50, `pick` 60, `ping` 300, `step` 60, `rise` 600 (dur 2), `knock` 200, `heart` 800,
  `flutter` 300 (dur 0.6), `rush` 300 (dur 1.2), `patter` 300 (dur 1.5), `spark` 120, `pulse` 400, `clink` 80,
  `ratchet` 300 (dur 2, n 8). The shell's own (`click`, `hover`, `place` ...) are usable too.
- `HOST.sfx.drone(id, name, o)`: continuous `vacuum` or `machine`, kept going while it is called every frame (stories
  use `sfxHold` instead, below; the robots call it from `sfxLive`, ids `robots.v0`, `robots.v1`). o `{ at, pan, gain,
  pitch }`.
- `SFX_LIB.length(name, o)`: a sound's length with those options (the cue checker uses it).

## 1. The slideshow's two lines (every story)

In the `SLIDE` object, `from: 0` at the end:

```js
const SLIDE = { at: -1, go: -1, last: 0, lt: 0, lp: false, tail: null, from: 0 };
```

In `slideStep`, right after the `const from = ...` line:

```js
  SLIDE.from = from;   // (the sound effects' cues cross by the same rule: sfxStep)
```

## 2. The block (every story, identical): right after the slideshow block (after `slideDOM`), before the APP header

Built engines: in `engine/e7_app.js`. Hand-written: the same place in the story file.

```js
// ---------------------------------------------------------- sound effects --
// Sounds inside the story (the shell's HOST.sfx, sfx.js; phase 2). Cues are set beside the keys in buildStory, in story
// time (sfxCue), and play as the clock crosses them while the story plays, by the slideshow's crossing rule
// (SLIDE.from): the same cues at the same moment on every device at a station, none on a jump, a scrub, a slideshow
// stop's seek or a late joiner's start. A span (sfxHold) keeps a continuous sound while the clock is inside it and
// playing. Explore and headset actions call sfxAct (explore mode only) or sfxPlay where the story already handles them.
// A sound comes from a place (a set's anchor, sfxPos): in a headset through an HRTF panner, on a screen panned by where
// it shows. An older shell (no HOST.sfx, or a sound it does not know) plays nothing. Never in collab.state(): each
// device plays its own. SFXQ.log keeps what was asked for (also when nothing can play: before a tap), for the tests
const SFXQ = { cues: [], spans: [], hi: -1, t: 0, n: 0, log: [] };
const sfxCue = (t, name, set, at, o) => { SFXQ.cues.push({ t, n: narrT(t), name, set, at, o: o || {} }); };
const sfxHold = (t0, t1, name, set, at, o) => { SFXQ.spans.push({ id: XR_HERE + '.' + SFXQ.spans.length, t0, t1, n0: narrT(t0), n1: narrT(t1), name, set, at, o: o || {} }); };
const sfxN = () => SFXQ.n + (HOST.sfx && HOST.sfx.count ? HOST.sfx.count() : 0);
const _sfv = new THREE.Vector3();
// where a sound comes from: [x, y, z] in the scene's (the reference space's) coordinates and, on a screen, a pan
function sfxWhere(set, at) {
  if (set === 'world') { if (!at) return {}; if (Array.isArray(at)) _sfv.fromArray(at); else _sfv.copy(at); }   // a point already in the scene's coordinates (a ray's hit)
  else if (!sfxPos(set, at, _sfv)) return {};
  const o = { at: [_sfv.x, _sfv.y, _sfv.z] };
  if (!(XR.on && GL.renderer.xr.isPresenting)) { _sfv.project(GL.camera); o.pan = clamp(_sfv.x, -1, 1) * 0.6 * (_sfv.z > 1 ? -1 : 1); }
  return o;
}
function sfxPlay(name, set, at, o) {
  SFXQ.n++;
  if (name !== 'hover') { SFXQ.log.push([name, Math.round(APP.t * 100) / 100, APP.mode]); if (SFXQ.log.length > 64) SFXQ.log.shift(); }
  if (!HOST.sfx || !HOST.sfx.play) return null;
  try { return HOST.sfx.play(name, Object.assign(sfxWhere(set, at), o)); } catch (e) { return null; }
}
// nothing of the story sounds while it is hidden: behind a Stories screen (page or headset), or a headset away from its station
const sfxHidden = () => !!(HOST.picking || XR.stories || xrAway());
// an explore action's sound (a pick, a result, a knockout): only in explore mode (a room's state applied while the story
// plays is silent)
const sfxAct = (name, set, at, o) => (APP.mode === 'explore' && !sfxHidden() ? sfxPlay(name, set, at, o) : null);
// every frame, right after slideStep (`was`: the story was playing as the frame began): the cues crossed since the
// slideshow's `from` (at most 1.5 s back: the narration's clock can leap ahead as it starts after a jump, and its cues
// then play a moment late, not a burst of old ones; never twice: the narration or a room's clock may pull the clock back
// a hair, SFXQ.hi, forgotten once the clock is put back further), the spans the clock is in, and the live parts
// (sfxLive, where a story has them)
function sfxStep(was, dt) {
  const t = APP.t, from = SLIDE.from, quiet = APP.mode !== 'story' || sfxHidden();
  if (from < SFXQ.t - 0.5 || t < SFXQ.hi - 0.5) SFXQ.hi = -1;   // back to earlier: Replay, Repeat, a jump back
  if (was && !quiet && t > from) {
    const hi = SFXQ.hi;
    for (const c of SFXQ.cues) if (c.n > from && c.n <= t && c.n > hi && t - c.n < 1.5) { SFXQ.hi = Math.max(SFXQ.hi, c.n); sfxPlay(c.name, c.set, c.at, c.o); }
  }
  if (APP.playing && !quiet && HOST.sfx && HOST.sfx.drone) {
    for (const s of SFXQ.spans) if (t >= s.n0 && t < s.n1) { try { HOST.sfx.drone(s.id, s.name, Object.assign(sfxWhere(s.set, s.at), s.o)); } catch (e) { /* an older shell */ } }
  }
  if (typeof sfxLive === 'function' && !sfxHidden()) sfxLive(dt);
  SFXQ.t = t;
}
```

## 3. `sfxPos`, right after the block

Built engines (identical in every built engine; the line after the block):

```js
// a sound's place (sound effects): a set's anchor (a name, a function, or [x, y, z] in its frame) in the scene's
// coordinates; no set: GL.world's origin. Sets may hang under a life-size holder: each group's own world matrix
function sfxPos(set, at, out) {
  const s = set && GL.sets[set];
  if (!s) out.set(0, 0, 0).applyMatrix4(GL.world.matrixWorld);
  else { const p = anchorOf(set, at); out.set(p[0], p[1], p[2]).applyMatrix4(s.group.matrixWorld); }
  return isFinite(out.x + out.y + out.z);
}
```

The hand-written three each have their own, with the same name, comment style and contract
(`sfxPos(set, at, out)`: put the place in the scene's coordinates into the Vector3 `out`, return whether it is finite).
The airports' (`set` unused; `at` an airport's index or code, or `[x, y, z]` in the globe's frame):

```js
// a sound's place (sound effects): an airport (its index, or its code) on the globe, or [x, y, z] in the globe's frame;
// none: the globe's middle
function sfxPos(set, at, out) {
  const i = typeof at === 'string' ? A(at) : at;
  if (Number.isInteger(i) && i >= 0 && i < NET.N) out.set(NET.P[3 * i], NET.P[3 * i + 1], NET.P[3 * i + 2]).multiplyScalar(1 + LIFT);
  else if (Array.isArray(at)) out.fromArray(at);
  else out.set(0, 0, 0);
  out.applyMatrix4(GL.world.matrixWorld);
  return isFinite(out.x + out.y + out.z);
}
```

Proteins: a protein's index or gene symbol (its node position, as its labels use it), `[x, y, z]`, none the cell's
middle. Spatial: a copy id or `'SYM@place'` (`CP`), `{ org: k }` for an organelle (its anchor), `[x, y, z]`, none the
cell's middle. Always `.applyMatrix4(GL.world.matrixWorld)` at the end (the scene's coordinates are the headset's).

## 4. `frame()`: two lines (every story)

Right after `const t0 = APP.t;`:

```js
  const was = APP.mode === 'story' && APP.playing;   // (sound effects: the story was playing as the frame began)
```

Right after the `slideStep(t0);` line:

```js
  sfxStep(was, dt);   // sound effects: the cues the clock crossed, the spans it is in, the live sounds
```

## 5. The headset's story panels (`e5_xr.js`; the hand-written three the same lines)

In `xrRelease`, the panel press line becomes:

```js
      // (a soft click at the button, unless the press made a sound of its own: the shell's rule for page buttons)
      if (r && r.id === p.id && r.fn) { buzz(c); const n = sfxN(); r.fn(); if (sfxN() === n) sfxPlay('click', 'world', h.point); }
```

In `xrPoint`, right after `c.hover = hit;`:

```js
  // a soft tick as the ray comes onto a button of the story's panels (as on the shell's menu)
  const hr = hit && hit.kind === 'panel' && hit.P.at(hit.x, hit.y), hk = hr && hr.fn ? XR.panels.indexOf(hit.P) + '.' + hr.id : '';
  if (hk && hk !== c.hk) sfxPlay('hover', 'world', hit.point);
  c.hk = hk;
```

(If a story's `xrRelease` press line or `xrPoint` differ from the flock's, keep the story's own code and add exactly the
sound parts: `const n = sfxN();` before `r.fn()`, `if (sfxN() === n) sfxPlay('click', 'world', h.point);` after it,
and the three hover lines after `c.hover = hit;`.)

## 6. Cues (each story's own): in `buildStory`, beside the keys they belong to

```js
sfxCue(t, name, set, at, o)        // t: story time (C.<ch>.a + s, as the keys); set: a set key (or null: GL.world's
                                   // origin); at: one of its anchors (a name, a function, [x, y, z] in its frame);
                                   // o: play's options (pitch, dur, gain, n, rise) and seq: true for a marked sequence
sfxHold(t0, t1, name, set, at, o)  // a continuous sound (vacuum, machine) while the clock is in [t0, t1) and playing
```

The flock's (e3_story.js):

```js
  sfxCue(C.seven.a + 6.8, 'grow', 'flock', 'flock', { dur: 2, pitch: 1.2, gain: 0.35 });   // each bird's seven links
  sfxCue(C.around.a + 0.3, 'rise', 'flock', 'flock', { gain: 0.4 });                        // all around you
```

The airports' cues are under `// ---- sound effects` at the end of the timeline keys in its `buildStory` (a sequence
from data: `ST.hopEnds.forEach((t, k) => sfxCue(t, 'step', null, code[path[k + 1]], { pitch: Math.pow(2, 2 * k / 12), gain: 0.5, seq: true }))`).

Rules (the plan, 1.2): a cue lands 0.2 to 0.5 s before the `data-at` line it belongs to when the visual and the words
start together, or in the pause after a line; a chapter's opening cue in the 0.6 s before its heading; textures under
speech get `gain` 0.3 to 0.45; no two cues of one sound closer than its gap; at most 4 onsets in any 3 s unless marked
`seq: true`; at most 6 cue voices sounding at once (`node tools/sfx-cues.mjs <url> <key>` checks all of this).

## 7. Explore and headset actions (each story's own lines, where the story already handles the action)

```js
sfxAct(name, set, at, o)   // plays only in explore mode and while the story shows (a room's state applied while the
                           // story plays stays silent); the airports: sfxAct('pick', null, i) in selectAirport
sfxPlay(name, set, at, o)  // plays whatever the mode (the live parts, the panel's click); 'world' as set: `at` is a
                           // point in the scene's coordinates already (a ray's hit)
```

Roles: a pick `pick` at it; a result shown `ping`; a scene change `whoosh`; a knockout, closure, removal `knock`, undone
`rise` (dur 1); a shuffle or a cut `snap` (+ `patter`); a simulation started `pulse`; a slider crossing a named stop
`step`. Page buttons need nothing (the shell clicks; it skips a press whose handler made a sound). Put a pick's sound
where the user's pick lands, not where the story re-renders (the airports: only when `fly`, never from `updateClosures`).

## 8. Live (only the flock, the robots and the pass story's fish)

`function sfxLive(dt) { ... }` in `engine/e4_explore.js`; the block calls it every frame unless the story is hidden
(`sfxHidden()`), in story and explore mode. The flock's (poll, never hook: so falcons from other devices sound too):

```js
const SFL = { fo: false, far: true, near: 0 };
function sfxLive() {
  const s = GL.sets.flock, fo = s.falconOn(), pn = performance.now();
  if (fo && !SFL.fo) { sfxPlay('whoosh', 'flock', 'falcon', { pitch: 1.4, dur: 1.1 }); sfxPlay('flutter', 'flock', 'flock', { delay: 0.4, dur: 0.9 }); }
  SFL.fo = fo;
  const h = s.state().me.head, f = s.anchors.flock(), d = Math.hypot(f[0] - h[0], f[1] - h[1], f[2] - h[2]);
  if (d > 10) SFL.far = true;
  else if (d < 7 && SFL.far && pn - SFL.near > 6000) { SFL.far = false; SFL.near = pn; sfxPlay('flutter', 'flock', 'flock', { gain: clamp(1.25 - d / 7, 0.3, 1) * 0.8 }); }
}
```

## 9. Checks

```sh
blk() { awk '/^\/\/ -+ sound effects --$/{f=1} /^\/\/ a sound.s place/{f=0} f' "$1"; }
diff <(blk stories/flock.js) <(blk stories/<key>.js) && echo block identical
pos() { awk '/^\/\/ a sound.s place/{f=1} f{print} f&&/^}/{exit}' "$1"; }
diff <(pos stories/flock.js) <(pos stories/<key>.js) && echo sfxPos identical    # built engines only
node tools/<key>/build.mjs --check
node tools/sfx-cues.mjs http://127.0.0.1:8123/ <key>      # names, places, times, density, overlap; seconds
```

What the tests read: `HOST.cur.peek('SFXQ.cues')`, `SFXQ.spans`, `SFXQ.log` (`[name, APP.t, mode]` of everything
asked for, hover ticks aside, even when nothing can play) and `HOST.sfx.state()` (what really played: `played`, `last`,
`voices`, `drones`).

## 10. What the tests expect of your stories

- `tools/smoke.mjs`, per story (`${key}: sound effects: ...`): the block present; every cue's name known, place finite,
  time within the story; a paused scrub across six cues plays none (live stories aside); a stretch played from 0.5 s
  before a cue plays exactly the cues it crosses; a pretend headset's press on the foot panel's `next` (or first) button
  logs a `click`; at a slideshow stop no cue past it (`SFXQ.hi`), and after Next the next cue when it comes within 3 s.
  **Add one explore action per story to `SFX_PICK`** at the top of the smoke test's per-story loop:
  `key: ['code run inside the story', 'the sound it asks for']` (the airports: `['selectAirport(A("SYD"))', 'pick']`).
- `tools/audio.mjs`: the busiest moment (by the cue table) of the tour, the soil story and the robots, played 6 s: never
  more than 16 voices, nothing cut, at most 4 continuous sounds.
- `tools/collab.mjs`: the robots' crumbs spilled on one page must log `patter` on the others (its `crumbsIn` path, as the
  plan says: `STORIES.robots.sound`); the flock's falcon logs `whoosh` and `flutter` on the others (done).
- `tools/sfx-cues.mjs <url> <key>`: as section 9.
- `node tools/sfx-render.mjs <url> <out> --story <key>` renders your story's track for the owner (with its cue list).

Levels (measured, `levels.txt`): the story sounds' accents sound at about -27 LUFS (loudest 400 ms) at full effects
volume, short ones peak at -9 to -15 dBFS; textures under speech take `gain` 0.3 to 0.45 as the plan says. `machine` at
gain 1 is about -29 LUFS, `vacuum` about -34.
