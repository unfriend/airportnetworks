# Moving the stories into packages (the plan)

The owner, 23 November 2026: every story becomes a story package "like the new ppicell"; the studio stays in the shell
for now. This file is the plan: where things end up, what has to be built first, the order of the moves, the risks, the
cost and the questions only the owner can answer. Nothing in it is done yet.

Checked in the code on 23 November 2026 (v184, `FORMAT` `networks-55`). Anything marked *to check* was not.

## Decided route (the owner, 23 November 2026, after the review)

These decisions override the sections below where they differ.

- **Lean** (the review's, `docs/packages-migration-review.md`): no `FORMAT` bump and no per-station copy record (**G4
  dropped**: `needs`, `HOST.unknown` and `HOST.live` cover mixed copies). **G3 deferred**: shared sources stay where
  they are (`tools/lbi/sets/body.js` ...); a moved story's build finds them by path; a shared library comes later.
- **The three hand-written stories** (airports, proteins, spatial) are **wrapped** as packages later in the migration
  (the file moved, its paths patched), not rewritten (R1 to R3 dropped for now; a later rewrite may take the unified look).
- **Order**: one hand-written list, `packages/order.json` (every story, moved or not, in the Stories screen's order;
  the tutorial last, `intro` kept). The scan copies it into the index (`order`), the shell sorts `HOST.list` by it.
- **Sources** are served alongside each package (`packages/<key>/src/`, as ppicell).
- **The design room and the studio stay in the shell.** A package's `story.json` names its station's miniature
  (`icon: "<key>.<set>"`), which stays in `lowpoly.js` for now (**G5 deferred**: a later step moves the miniatures
  into `packages/<key>/src/mini.js` and the design room's build reads them there).
- **Narrations move into the packages** (`packages/<key>/audio/narration.mp3`; headsets download them again).
- **Offline (G6, decided):** the worker's install takes every listed package's `main.js`; an installed app (standalone
  display, or the `appinstalled` event) takes **all** stories in the background (every listed package's files, its
  narration included, and the narrations still in `audio/`: about 85 MB), resumable, never blocking first use; a *Take
  all stories* row on the Stories screen (and the headset menu's Settings tab) does the same with progress in a browser.
  Storage is checked (`navigator.storage.estimate`, `persist`) and a failure is soft.
- **First slice:** G2 (`tools/stories.mjs`), G1-lite and G7-lite, the offline download, the pilot **robots** (not flock:
  flock is collab's `HEADSET_STORY`) and `tools/packages/move.mjs` for the next moves. Then the built stories tail first
  in batches, the tutorial last of them, then the three wrapped, airports last; cleanup (Z) at the end.

### Status (v185) and how the next stories move

Done in the first slice (v185): `tools/stories.mjs` and the tools on it; `packages/order.json`, `icon`/`intro`/`bytes`,
`HOST.list` in one order, the 1.5 s boot wait; `version.json`'s `packages`; the relay's `--watch`/`--build` of
`packages/`; `tools/engine/all.mjs` over the app's packages; the worker's install of every listed `main.js` and *Take
all stories* (page button; automatic on an installed app); the robot gang moved (`packages/robots/`). Not done: a
headset menu row for *Take all stories* (an installed headset app takes them by itself), a `packages order` / `take all`
smoke block, a package case in `tools/live.mjs`.

Done in v186 (batches A and B's readers): qubits, mutation, flock, tutorial, endo, pet, ovary and soil moved with
`move.mjs` (each new `main.js` differs from the old built file only in comment and narration lines naming the folders).
`move.mjs` now also rewrites `tools/<key>` named without a slash and a tool's root (`path.join(here, '../..')` in any
`.mjs`). The readers' builds needed no patch: their `src()` reads `'../lbi/...'`, `'../micro/...'`, `'../nmd/...'`,
`'../topo/...'` from `tools/`, where those sources stay. `tools/live.mjs` uses the flock as a package (its copy, its
second flock, `--build` as `pkg:flock`; the list-touched case changes the airports card); `tools/update.mjs` plays
narrations still in `audio/`; `relay/test.mjs` asks for `packages/flock/main.js`. Left for the next batches: micro and
topo (owners of `organs.js` and `look.js`: when they move, patch pet's, topo's and soil's `src()` and harness paths
from `'../micro/'`/`'../topo/'` to `'../../packages/<key>/src/'`), nmd and lbi (owners of motor, body, tissue, web),
then pass, then the three wrapped.

Moving a built story (one commit each, or a batch; the tree clean):

1. `node tools/packages/move.mjs <key> --dry`, then `node tools/packages/move.mjs <key>` (`--needs <n>`: the oldest
   shell it works with, default the shell's release now, `index.html`'s `HOST.shell` `n`: `VERSION` + 1 refused the
   v186 moves on a shell still 185, since a release that leaves the shell alone keeps its number). It stops (exit 1) when the new `main.js` differs from the old built file in
   any line but those naming the narration or the folders, and notes any `audio/narration-<key>...` left in the engine
   (the pass story's German: its `AUDIO` map's `de` entry, by hand to `HOST.pkgUrl('pass',
   'audio/narration-de.mp3')`; the voice tools already write a package's languages there).
2. Builds that read other stories' files keep working: shared sources (`'../lbi/sets/body.js'` ...) are read from
   `tools/` by the patched build's `src()`; a build that reads `stories/<other>.js` (pass: airports, spatial) is
   untouched. But a story whose sources others read (lbi: body, tissue, web; micro: organs; nmd: motor and data; topo:
   look) must stay in `tools/` until the shared library (G3) exists, or the readers' paths change with it: move the
   readers first (endo, pet, ovary, soil, then micro, topo), and lbi, nmd last of the built ones, each with its readers'
   builds patched (`'../lbi/'` becomes `'../../packages/lbi/src/'` in their `src()`), or do G3 first.
3. Checks: `node packages/<key>/src/build.mjs --check`, `node tools/engine/all.mjs --check`, `node tools/packages/scan.mjs
   --check`, `node tools/packages/check.mjs packages/<key> --load`, the story's data test where it has one; then the
   `VERSION` bump, `whatsnew.json`, `node tools/release.mjs`, `node tools/narration.mjs <url>`, the story's docs
   (`docs/agents/stories.md`, `layout.md`, the AGENTS.md table, `README.txt`, `README.md`, `HANDOVER.md`).
4. Before `main`: the smoke test, `node tools/collab.mjs --quick`, `node relay/test.mjs`, `tools/update.mjs` (it opens
   the first moved story offline), `tools/live.mjs`, and `tools/audio.mjs` for a story it names (robots, lbi, soil).

Batches: A (no shared sources used from them) qubits, mutation, flock (collab's `HEADSET_STORY`: run the whole collab
suite), tutorial (`intro`, `needs`, `tools/tutorial/test-script.mjs`); B the readers endo, pet, ovary, soil, then
micro and topo, then nmd and lbi (or G3 first); C pass (its `ORIGINALS` stay in `stories/` until the wrap); then the
three hand-written stories wrapped (`git mv stories/<key>.js packages/<key>/main.js`, its narration literal through
`HOST.pkgUrl`, `story.json` by hand, pass's `ORIGINALS` paths), airports last.

## 0. What is there now (the facts the plan rests on)

- Packages work today (`docs/agents/packages.md`, `tools/packages/SPEC.md`): `packages/<key>/{story.json, main.js,
  files}`, `packages/index.json` from `tools/packages/scan.mjs` (`fp` per file and per package), `HOST.packages`,
  `HOST.load` (`packages/<key>/main.js?v=<fp>`), `HOST.pkgUrl`, the `networks-packages` cache (`PKG`) in `sw.js`,
  `packages` in the relay's `APP_DIRS`/`APP_DEEP`, `HOST.unknown` (*Not on this device*). `packages/ppicell/src/build.mjs`
  is the template's build: kit + its own sets + `tools/engine/` parts, key from `story.json`.
- A package's key may never be one of `stories/list.js` (`appKey` in `HOST.packages.entry`, and the scan refuses it). So
  a story moves in one commit: its entry leaves `stories/list.js` and its folder appears in `packages/`. Both forms
  already run side by side.
- Built stories (14 + the design room + the studio) are pasted together by `tools/<key>/build.mjs`; shared sets are read
  by relative path: `../lbi/sets/body` (pet, micro, ovary, topo), `../lbi/sets/tissue` (micro), `../lbi/sets/web` (soil),
  `../micro/sets/organs` (pet, topo; pet cuts its gallery), `../nmd/sets/motor` and `../nmd/sets/data.js` (endo, the
  latter read at build time), `../topo/sets/look` (soil). `tools/pass/build.mjs` cuts the globe and the cell out of
  `stories/airports.js` and `stories/spatial.js` by line markers (`ORIGINALS`).
- Hand-written: `stories/airports.js` (3,588 lines, 700 KB, of which lines 5 to 7 are 486 KB of embedded data),
  `stories/proteins.js` (3,591 lines, 240 KB, the same skeleton as airports: "globe interaction", "globe pose"),
  `stories/spatial.js` (4,838 lines, 270 KB). Airports has the one human recording (`audio/narration.mp3`, the story
  clock *is* the recording's: no `NARRATION_SYNC`, chapter times in recording seconds, `NARRATION_ENDS` measured by
  silencedetect).
- `HOST.swap(key)` re-loads the file fresh (`HOST.load(key, true)`), keeps `HOST.place()` and runs it again; at a
  station the room's clock and state apply as it attaches. `HOST.live`'s `story(key)` swaps the story on show at a
  quiet moment (`quiet()`: in a headset session only the Stories screen, away from every station, or the menu open)
  and marks others stale. `HOST.packages.read()` calls `HOST.live.changed(key)` for a package run here whose `fp` moved.
- `sw.js` install precaches `SHELL` (every `stories/<key>.js`, written by `tools/release.mjs` from `stories/list.js`)
  and refreshes only the narrations a device already holds (`AUDIO`, `NARR`). Packages are cached only when fetched.
- Station icons: `meta(key).icon` names a `LOWPOLY_MODELS` key (`shared.js` `iconOf`, `iconDef`, `fallbackDef` for
  none). `lowpoly.js` holds 54 miniatures (lbi 10; most stories 3 or 4; flock, robots, tutorial, airports, proteins,
  spatial 1; design, studio 1; `all` 2). The design room's cards are built from `tools/design/props.json` and the
  miniatures' names (`tools/design/build.mjs`, `ICONS`).
- The tutorial is `intro: true` (three places in `index.html`: the default start skips it, Repeat all passes it,
  `HOST.count()` leaves it out); its narration hold reads `localStorage.tutorialHold`; it uses `HOST.bodies`.

## 1. Decisions in this plan

| Question | Recommendation |
| --- | --- |
| Which stories move | All sixteen, the tutorial included. The studio and the design room stay (below). |
| Sources | In the package: `packages/<key>/src/` (as ppicell). `tools/<key>/` is emptied by `git mv`. |
| Shared parts | Pasted in at build time from one library folder, `tools/lib/` (not loaded at run time). |
| Order on the Stories screen | A hand-written `packages/order.json`; the scan writes each entry's place into the index. |
| Station icons | The package's own miniatures, `packages/<key>/mini.js`, named by a new `icon` field in `story.json`. |
| Offline | *Take all stories* (download all) on the Stories screen and in the headset menu, done by the service worker. |
| Shared rooms | `FORMAT` goes up once (G4). A station records the package's `rev` and `fp`; the newest copy wins, swapped in place. |

### The tutorial: moves

It is a built story like the others (`tools/tutorial/`, sets `script`, `guide`), and the shell refers to it only through
`intro: true` and the `tutorialHold` switch, never by file. `story.json` gains `intro` (G1). It moves in batch C, after
the order file exists, so it stays the last card. Its narration hold and `HOST.bodies` work unchanged from a package.

### The design room: stays (for now)

It is not a story (`STORY_EXTRA`, a menu button by key in `shared.js`, `DESIGN = 'design'`), and it is the catalogue of
everyone's props: its build reads `tools/design/props.json` (418 KB) and every miniature's name. Moving it gains nothing
and would make it the one package that depends on all the others. It stays in `stories/design.js` beside the studio; its
build learns to read the packages' miniatures (G5). Revisit when third-party packages want cards on the table.

## 2. The target layout

```
packages/order.json            hand-written: { "order": ["airports", "lbi", ..., "robots", "tutorial"] }
packages/index.json            the scan's: entries in that order, each with pos, rev, bytes, icon, intro
packages/<key>/
  story.json                   + icon ("<key>.<set>"), intro (tutorial), page/brand/... as list.js had them
  main.js                      built (never edited)
  mini.js                      built: its miniatures (LOWPOLY_MODELS['<key>.<set>'])
  audio/narration.mp3          its recording (pass: narration-de.mp3 beside it); airports' human one too
  models/, data/ ...           anything else it loads by HOST.pkgUrl
  src/build.mjs                the template's build + LIB (below) + --check
  src/engine/e1..e7, src/sets/, src/data/ (generators), src/mini.js, harness.html, shot.mjs, sweep.mjs, SPEC.md
  README.md
tools/lib/                     the shared library, build time only (no build.mjs: the relay would take it for a story's)
  sets/body.js tissue.js web.js organs.js motor.js look.js   (from lbi, micro, nmd, topo)
  data/nmd.js                  NMD_DATA (endo reads it at build time)
  sets/globe.js cell.js        the airports globe and the cell map's cell, once rewritten (step R)
  mini.js                      the miniatures' helpers (rng, ramp, mix ... from tools/lowpoly/models-a.js)
  deps.mjs                     who uses what; all.mjs and the relay's --build read it
tools/engine/                  unchanged (kit.js, parts); all.mjs also builds packages/*/src/build.mjs
stories/list.js                STORY_LIST empty at the end (kept: old shells read it), STORY_EXTRA: design, studio
stories/design.js, studio.js   stay
lowpoly.js                     the shell's own miniatures only (design, studio, all)
audio/                         empty at the end (PUT-narration.mp3-HERE.txt moves to docs/)
proteins.html, spatial.html    stay (redirects to #proteins, #spatial: the keys stay)
```

### Shared parts: build time against run time

- **Pasted in at build time** (as `tools/engine/` parts and today's `../lbi/sets/body`): each `main.js` holds all it
  needs, its `fp` covers it, a room compares one fingerprint per story, offline needs nothing extra, and a library change
  reaches a package only when it is rebuilt (`--check` says which). Cost: the bytes are repeated (body.js 41 KB in four
  packages, organs.js 45 KB in three: under 300 KB in all, small beside one narration).
- **One library file loaded at run time** (`HOST.lib('body')`): smaller downloads, but a second thing to version, cache,
  download for offline and compare in a room (a station would need the library's fingerprint too), a new shell API
  (`api` 2), and a library change could break a package nobody rebuilt.
- **Recommended: build time.** `tools/lib/` is a source folder like `tools/engine/`. Each package's `src/build.mjs` names
  what it takes (`LIB = ['sets/body', 'sets/organs']`), read with `fileURLToPath`, pasted in the order given (pet keeps its
  `cutGallery` of organs.js in its own build). Rule (AGENTS.md "Rebuild the dependants"): after changing `tools/lib/`,
  `node tools/engine/all.mjs` (it builds every `tools/<key>/build.mjs` and every `packages/<key>/src/build.mjs` that
  imports `tools/engine/parts.mjs`); `--check` fails while any is out of step. `node tools/lib/deps.mjs` prints who uses
  each file. The relay's `--build` maps `tools/lib/<file>` and `packages/<key>/src/` to builds the same way.

## 3. Groundwork (before any story moves)

Each step is one branch merged to `dev`, with the cheap checks there (`node --check` on changed files, every
`build --check`, `node tools/packages/scan.mjs --check`, `node tools/release.mjs --check`) and its own test named below,
which goes into the release run before `main`.

**G1. The index and `story.json` grow (scan, check, shell).**
Files: `tools/packages/scan.mjs`, `check.mjs`, `SPEC.md`, `index.html` (`HOST.packages.entry`, `merge`, `HOST.live`'s
`take`), `docs/agents/packages.md`.
- `story.json` may hold `icon` (a `<key>.<set>` its `mini.js` defines) and `intro` (true only). The "no `icon` field"
  rule goes.
- `packages/order.json` (hand-written) gives the order; the scan writes the index in it (packages not named after, by
  key) with `pos`, `rev` (the previous index's `rev` + 1 whenever `fp` changes; 1 for a new package), `bytes` (the sum of
  its `files`). `--check` fails on a key in `order.json` with no folder.
- The shell merges the app's own `STORY_LIST` entries and the listed packages **in one order**: the index's `pos`, with
  `STORY_LIST` entries keeping their place by an `order.json` that names them too (so a moved story keeps its place on
  the day it moves). Rule: `order.json` names every story, moved or not; `release.mjs --check` fails if not.
- `intro` copied into the list entry, so the three `intro` places in `index.html` work for a package.
- The boot: a start with no `#key` waits for the index too (`HOST.packages.ready(1500)`, cached by the service worker
  offline), because the first story without `intro` may soon be a package. Without an index the first `STORY_LIST`
  entry, as now; once `STORY_LIST` is empty, the Stories screen opens with what there is.
Test: `node tools/packages/check.mjs packages/hello --load`, a new smoke block `packages order` (a package named early
in `order.json` shows in its place on both Stories screens and in `HOST.list` order for Arrange all; `intro` skipped by
the default start and Repeat all). The headset's Stories screen draws `HOST.list` (`drawLandCard`), so order follows.

**G2. One way for tools to find a story (`tools/stories.mjs`).**
New `tools/stories.mjs`: `stories(root)` gives `[{ key, pkg, file, src, build, narrations: [..], list entry }]` in screen
order, from `stories/list.js` and `packages/index.json` (+ `order.json`); `storyUrl(meta)` for pages (`meta.pkg ?
meta.base + 'main.js' : 'stories/' + key + '.js'`). Then every tool uses it (section 6 lists them). The page-side
twin is a one-liner inside each test's `evaluate` (`HOST.meta(k)`).
Test: each changed tool's own run on today's tree gives today's result (nothing has moved yet).

**G3. The library (`tools/lib/`), byte for byte.**
`git mv` the six shared sets and `tools/nmd/sets/data.js`'s build-time use (endo) into `tools/lib/`; every `build.mjs`
reads from there; `tools/lib/deps.mjs`; `tools/engine/all.mjs` and the relay's `buildMap` learn `tools/lib` and
`packages/*/src/build.mjs`. The owners' harnesses (`tools/lbi/harness.html` etc.) get their new paths.
Test: every `build --check` passes **unchanged** (no built file changes; no `VERSION` bump needed), `node
tools/engine/all.mjs --check`, `relay/test.mjs` (its `--build` part, *to check* that it has one).

**G4. Shared rooms: the one `FORMAT` bump and the copy guard.**
Files: `shared.js`, `index.html` (`HOST.live`), `tools/engine/e4_explore.js` part for `COLLAB_V` (every built story),
`docs/agents/shared-rooms.md`.
- Every story's `collab.state()` carries `v` (the built stories through the shared engine part `COLLAB_V = 1`, checked in
  `collabApply`; airports, proteins and spatial by hand until rewritten). A device ignores a state of another `v` (as the
  packages do).
- A new room key per station, `st.<id>.pk = { r, f }`: the `rev` and `fp` of the package the station runs (absent for a
  `stories/` story). `FORMAT` goes to `networks-56` once, here; moves after this change no key shape, and a story whose
  state changes shape bumps its own `v` only.
- The guard (design below). Test: `node relay/test.mjs`, `node tools/collab.mjs --quick` plus a new round `--copies`
  (two pages, one served a package with a higher `rev`: the older swaps in place without a reload; the newer never
  downgrades; with the newer copy unreachable, the card). Untested until tried: the swap's hitch in a headset.

**G5. Miniatures in packages (`mini.js`).**
Files: `tools/lowpoly/build.mjs` (helpers to `tools/lib/mini.js`, pasted into `lowpoly.js` and each `mini.js`),
`index.html` (`HOST.lowpoly(key)`: `lowpoly.js`, then the package's `mini.js` when its `files` list it, once each),
`shared.js` (`iconDef` asks `HOST.lowpoly(key)` for a package's key; while it loads, `fallbackDef` as now),
`tools/design/build.mjs` (cards for miniatures from `packages/*/src/mini.js` + `props.json` as now; a package miniature
with no `props.json` entry gets a short card from its own `name`/`shows`), `stories/design.js` (its table loads every
listed package's `mini.js`), `tools/packages/check.mjs` (`mini.js` entries: `story` = key, `tris` exact and ≤ 1,200).
`packages/hello` gets a ring miniature as the example.
Test: smoke `design`, a new smoke step (a station of `hello` shows its miniature, not the fallback), the lowpoly
harnesses. A miniature's look on a headset: untested until tried.

**G6. The service worker and *Take all stories* (offline).** Design in section 5.
Files: `sw.js`, `index.html` (`HOST.offline`, the Stories screen row), `shared.js` (the menu's Settings row), `tools/release.mjs`.
Test: a new smoke block `take all` (offline after taking: every listed package starts; progress events; a changed `fp`
refreshes), `tools/update.mjs` (rewritten to use a package, section 6). Quest Browser's storage and `persist()`: untested.

**G7. `tools/release.mjs` knows the app's packages.**
`version.json` gains `packages: { <key>: { fp, rev, needs } }` for the packages named in `order.json`; `needs` as for a
story (its own, else the shell of the release in which its `fp` last changed), written back into its `story.json` (then
the scan again) so the shell's existing refusal holds. `--check` also runs `scan.mjs --check` and every package build's
`--check`. `release.mjs` no longer fails on an empty `STORY_LIST`. `HOST.live`: `version.json`'s `packages` lets
`missing(key)` ask for an update when the latest release has that package.
Test: `node tools/live.mjs` (a package added and changed while a page runs, section 6).

Groundwork releases as one `VERSION` (v185 or so) after G1 to G7 are on `dev` and the owner has tried a headset.

## 4. Shared rooms: the copy guard, without a reload

The owner: no page reload where possible; the device holding another copy fetches the station's copy and swaps it in
place, automatically if safe; the card only when that cannot be done.

Which copy wins: **the higher `rev`** (the scan raises it on every change, so it orders the copies of one repository;
after a merge of two branches the scan is run again and takes the larger + 1). Never a downgrade. Equal `rev`, other `fp`
(two hosts with forked copies, or `--watch` while editing): each runs its own, a note in developer mode only.

On a device, for a station of a package (`shared.js`, where a station's story is chosen, and `HOST.live`):

1. **Entering the station** (before `HOST.start`, while the story is not yet on show): compare `st.<id>.pk` with
   `HOST.packages.get(key)`. Same `fp`: start. Room's `r` higher: `await HOST.packages.read()` (`packages/index.json`,
   `no-store`, served fresh by the service worker); if the index now has that `fp`, start: `HOST.load` fetches
   `main.js?v=<new fp>` (a new address, never the cache's older copy). No swap is needed at all: the story simply starts
   as the new copy. This is the common case and is safe (a story change happens anyway).
2. **The station's record moves up while this device is in it** (another device wrote a higher `r`): read the index;
   if it has the copy, `HOST.packages.read()` already calls `HOST.live.changed(key)`, which swaps at a quiet moment.
   Verified in `index.html`: `quiet()` in a headset session is only the Stories screen, away from every station, or the
   menu open; on a page, paused, explore mode, the Stories screen or a chapter's end. `HOST.swap` keeps `HOST.place()`
   and, at a station, takes the room's clock and state as the story attaches. New: in a room, a swap of the station's
   own story may also count a station's slideshow stop as quiet (*to decide in G4*: otherwise a headset in a playing
   story waits until it leaves the circle).
3. **This device's copy is newer** (its `rev` higher than the record): it writes `st.<id>.pk` up (with `ts`, as any
   write by hand) when it enters or when its index reads a newer one; the others then follow 1 or 2. A device never
   writes a lower `r`.
4. **The newer copy cannot be fetched** (this device's host has an older index, e.g. opened from GitHub Pages while the
   others came from the relay; or offline): the story runs as this device's copy; the station's card and the update
   bar say *This story has an update* (*Reload* only when `HOST.live` sees a newer `version.json`; otherwise *Its host
   has an older copy*). The state's `v` keeps a mismatched shape out.
5. **The new copy needs a newer shell** (`needs` above `HOST.shell.n`, the entry `refused`): the existing path,
   `HOST.live`'s `ask('needs', key)`, Reload now or Later, which keeps the place (`livePlace`).
6. A device without the package at all: `HOST.unknown`, *Not on this device*, unchanged; `HOST.live.missing` reads the
   index and `version.json` (G7) again.

Untested until tried on a headset: the swap's hitch at a quiet moment, the timing of 1 in a room of several headsets,
and that a headset reading the index on entering a circle does not stall the circle's walk-in.

## 5. Offline: *Take all stories*

What it takes: for every listed package (hidden ones too in developer mode), every file in its index entry (`main.js`,
`mini.js`, `audio/*.mp3`, `models/`, `data/`, `icon.png`), whole files at their `?v=<fp>` addresses; plus the app's
remaining `audio/` narrations while any story is still in `stories/`. Today about 13 MB of story code and 60 MB of
narrations; ppicell adds 12 MB. `bytes` in the index gives the size before starting.

- **Who does it:** the service worker, not the page (it outlives story changes and a headset session): the page posts
  `{ type: 'take', urls }`; the worker fetches two at a time into `PKG` (the same rule as a package fetched while
  playing: one version per file), and posts `{ done, total, bytes, failed }` to every client. A failed file is tried
  again once; the rest go on.
- **Where:** the page's Stories screen, a row under the cards: *Take all stories (about 85 MB) for offline use* with a
  progress bar and, when done, *All stories on this device*; each card a small *on this device* mark (the page checks
  `caches.open('networks-packages')` against the index). The headset menu's Settings tab: a row *Stories offline: take
  all* with its percentage (drawn by `shared.js`). The existing install button (`btnInstall`, `beforeinstallprompt`)
  moves into that row on the page, so the two event-day steps sit together.
- **Storage:** before taking, `navigator.storage.estimate()`; refuse with a sentence when the free quota is smaller than
  `bytes` + 20 %; ask `navigator.storage.persist()` (so the browser does not evict it). Quest Browser's answer to
  `persist()`: *to check*.
- **Keeping it current:** taking all sets `localStorage.pkgAll = 'on'` on that device. Every index read
  (`HOST.packages.read`) then posts the files of packages whose `fp` changed to the worker, in the background (one at a
  time). Old versions are dropped as each new one is stored.
- **Install time:** today `SHELL` precaches every story's code at install. To keep that promise after the move, the
  worker's install also takes each listed package's `main.js` and `mini.js` from the index (not audio or models), so an
  installed copy that is offline still opens every story, silent until its narration is taken.
- **The event runbook** (`docs/event-runbook.md`, "Before the event", once per device): open the live copy (or the
  relay's address), *Install*, then *Take all stories* and wait for *All stories on this device*; before each event,
  open it once online so it refreshes. The line *Pages from the relay have no offline copy* stays true for the relay's
  pages (another origin): take all from the relay's address on shared-room headsets too.

## 6. Tests and tools that assume `stories/<key>.js` or `audio/narration-<key>.mp3`

All move to `tools/stories.mjs` (G2) or the page's `HOST.meta`. What changes, each:

| Tool | Today | Change |
| --- | --- | --- |
| `tools/smoke.mjs` | `STORY_KEYS` from `self.STORY_LIST`; 8 blocks fetch `'stories/' + k + '.js'` to check the shared hook lines (lines 13635 to 16557) | keys from `HOST.list` (listed, not `intro`-filtered where the block wants every story); fetch through `HOST.meta(k)`; `EXTRA` stays `STORY_EXTRA`; the studio's own line stays. New blocks: `packages order`, `take all` |
| `tools/collab.mjs` | reads `stories/list.js` with `vm` to prune `STORIES`; `HEADSET_STORY = 'flock'` (last), `OTHER_STORY = 'spatial'`, `PICK_STORY = 'proteins'`, `MOVE_STORY = 'nmd'` | the list from `tools/stories.mjs`; the per-story `change`/`back` expressions are code inside each story and must be rewritten for airports, proteins and spatial at step R; new round `--copies` (G4) |
| `tools/audio.mjs` | needs `audio/narration.mp3` | the airports narration at `packages/airports/audio/narration.mp3` after R3; until then either |
| `tools/sfx-cues.mjs` | `HOST.list` + `STORY_EXTRA` | none (it asks the page); check hidden packages stay out |
| `tools/sfx-render.mjs` | `audio/narration.mp3`, `audio/narration-lbi.mp3` | through `tools/stories.mjs` |
| `tools/perf.mjs` | `HOST.list` | none |
| `tools/update.mjs` | reads `stories/airports.js` of two trees; fetches `audio/narration-endo.mp3`, `-lbi.mp3`, `narration.mp3` | a package's `main.js` and narration for the moved case; a new case: an old tree with `stories/flock.js` updated to a tree with `packages/flock/` (the move itself must leave no broken mix) |
| `tools/live.mjs` | writes `stories/flock2.js`, touches `stories/proteins.js`, `airports.js` | a package copy `packages/flock2/` and touched `main.js` files (the scan run in between); keep one `stories/` case while any story is there |
| `tools/narration.mjs` | `fileOf` (`audio/narration[-key].mp3`), `stories/<k>.js` | both through `tools/stories.mjs` (main.js of a package); `docs/narration.md` regenerated at each move |
| `tools/pace.mjs` | `srcOf`: `tools/<k>/engine/e3_story.js` or `stories/<k>.js`; `fileOf` as narration.mjs | add `packages/<k>/src/engine/e3_story.js`, as `tools/voice/narrate.mjs` already does |
| `tools/voice/narrate.mjs`, `check.mjs` | already know packages (`PKG(k)`, `srcOf`, `fileOf`) | the airports refusal by key stays; check `check.mjs` reads the package path (*to check*) |
| `tools/release.mjs` | `stories/<key>.js` per `STORY_LIST`+`STORY_EXTRA`; `AUDIO` from `audio/`; fails on an empty list | G7 |
| `relay/server.mjs` | `--watch` `hello()` and `changedFile` watch `stories/`; `buildMap` reads `tools/*/build.mjs` | watch `packages/index.json` (send `list`) and `packages/*/main.js` (send `story`); builds from `packages/*/src/build.mjs` and `tools/lib/` (G3) |
| `relay/test.mjs` | `/stories/flock.js`, `/audio/narration.mp3` (lines 1998 to 2036) | keep one `stories/` file (design.js) and serve a package's mp3 with ranges |
| `tools/engine/same.mjs`, `xrsame.mjs`, `panelsame.mjs` | open stories by hash in two trees; `KEYS` default lists the built stories | none for opening (`#flock` works for both forms: *to check*); `--keys` gains airports, proteins, spatial for R |
| `tools/design/build.mjs` | `ICONS`, `props.json`, `tools/lowpoly/models-*.js` | G5 |
| `tools/lowpoly/build.mjs`, harnesses | `models-a.js`, `models-b.js` | the moved stories' miniatures leave them per move; harnesses load `packages/*/src/mini.js` too |
| `tools/<key>/shot.mjs`, `sweep.mjs`, `harness.html` | paths relative to `tools/<key>/` | move with the sources into `src/`; their output folder stays outside the repository |
| `tools/qubits/test-qmath.mjs`, `mutation/test-mmath.mjs`, `topo/test-data.mjs`, `soil/test-data.mjs`, `pass/test-sets.mjs`, `tutorial/test-script.mjs` | `require('./sets/...')` | move into `src/`, same relative paths |
| `tools/engine/all.mjs` | `tools/*/build.mjs` | also `packages/*/src/build.mjs` (G3) |

## 7. Narration files, old addresses and installed copies

- **Addresses stay:** `#<key>` (a package's key is its folder), `proteins.html` and `spatial.html` (redirects to
  `#proteins`, `#spatial`; the worker's `navigate` rule keeps them), `#<key>&explore&...` deep links (the package's
  `initEnd` reads the same words: kept identical in each move), shared-room station keys.
- **Narrations move with their story:** `git mv audio/narration-<key>.mp3 packages/<key>/audio/narration.mp3` (pass:
  `narration-pass-de.mp3` to `narration-de.mp3`; airports: `audio/narration.mp3`). Bytes unchanged, so the timing
  tables are unchanged. `narrationFile()` becomes `pkgUrl('audio/narration.mp3')`, played only when the index lists it.
- **What the worker does on the release that moves a story:** `release.mjs` drops it from `SHELL` and `AUDIO` (already
  automatic from `stories/list.js` and `audio/`). The new worker's install fetches nothing of the moved story (the
  page fetches the package as it starts); `activate` deletes old `VERSION` caches as now. The old `NARR` copy of a moved
  narration stays one release (an old page still running the old story file plays from it), and the cleanup release
  (step Z) prunes from `NARR` every entry not in `AUDIO`.
- **Never a mix of page and story file:** a moved story is never loaded from `stories/` by a new shell (its key is gone
  from `STORY_LIST`), and an old shell (v166 or later knows packages) sees it in the index; the package's `needs` is
  the release that moved it, so an old shell refuses it (*Needs a newer version of the app*) and `HOST.live` asks for
  the reload. An old page whose story on show was moved keeps running its old file until a quiet moment and the reload.
  Shells older than v166 (no packages): `HOST.live` already asks them about the new shell; they cannot open a moved
  story before reloading (acceptable; *to check* how many devices could still be that old).
- **Old `stories/<key>.js` files on the host:** removed in the move's commit (`git mv` into the package's sources would
  be wrong: the built file is not a source). An old page that asks for one after the move gets 404 and its bar's
  *Could not load*; `HOST.live` has asked for the reload by then.

## 8. The order of the moves

One story's move, the same each time (one Opus builder, about one session):

1. `git mv tools/<key>/* packages/<key>/src/`; `src/build.mjs` from the template's (`LIB`, `--root`, key from
   `story.json`), producing `main.js` (the engine files gain `KEY`, `pkgUrl`, `pkgMeta`; `narrationFile()` through
   `pkgUrl`; `XR_HERE` stays the key).
2. `story.json` from its `stories/list.js` entry (+ `icon`, `intro`, `needs`), `README.md` from its tools README and
   `docs/data-and-permissions.md`; its line in `order.json` stays.
3. Its narration(s) `git mv`'d; its miniatures from `tools/lowpoly/models-*.js` into `src/mini.js`.
4. Remove its `stories/list.js` entry and `stories/<key>.js`; `node packages/<key>/src/build.mjs`; `scan.mjs`;
   `tools/lowpoly/build.mjs`; `tools/design/build.mjs`; `tools/narration.mjs`; dependants (pass reads airports/spatial).
5. Proof it is the same story: `node tools/engine/same.mjs <worktree of dev> . --keys <key>` (0 everywhere, the live
   ones in explore mode only), `xrsame.mjs`, `panelsame.mjs`, `check.mjs packages/<key> --load --phone`, the story's own
   data test, `smoke.mjs --only` its blocks.
6. Docs: its section moves from `docs/agents/stories.md` to `docs/agents/packages.md` (or a new `docs/agents/
   packages-app.md`, *to decide*), its `layout.md` entries, the AGENTS.md table's file column.

| Step | Stories | Why this order | Cheap checks on `dev` | Suites before `main` |
| --- | --- | --- | --- | --- |
| P (pilot) | flock | smallest built story (229 KB), no shared sets, life size, narration, `HEADSET_STORY` in collab | as above | smoke, collab (all: it is the headset story), audio, update, live, relay test |
| A | robots, qubits, mutation, nmd | no shared sets used *from* them except motor/data (in `tools/lib` since G3); qubits and mutation have maths tests | same | smoke, collab `--quick`, audio |
| B | lbi, endo, pet, micro, ovary, topo, soil | the `tools/lib` users; lbi first (it owns body, tissue, web) | same + `all.mjs --check` | smoke, collab `--quick`, audio, the data tests |
| C | tutorial, pass | tutorial: `intro`, last card; pass: still cuts `stories/airports.js` and `spatial.js` until R | same + `tutorial/test-script.mjs`, `pass/test-sets.mjs` | smoke, collab `--quick`, audio, `same.mjs --keys pass` |
| R1 | spatial (rewrite) | its cell becomes `tools/lib/sets/cell.js`, used by pass and cellstress/ppicell's copied code | R checks below | full: smoke, collab (all), relay, audio, live, update |
| R2 | proteins (rewrite) | the airports skeleton on a cell: a dry run for airports with a synthetic narration | R checks | full |
| R3 | airports (rewrite) | the human recording, the largest data, `PICK_STORY`-like collab uses | R checks + `audio.mjs` | full |
| Z | cleanup | empty `STORY_LIST`, prune `NARR`, `audio/` gone, docs, `CLAUDE.md`/`AGENTS.md` tables | all `--check` | full |

Each batch releases to `dev` with a `VERSION` bump and `whatsnew.json`; `main` moves only after the owner has tried it
on a headset, as now. A batch can be split into single stories if a builder runs long.

### The rewrites (R1 to R3)

Each becomes a built package: `src/sets/` (airports: `globe`, `routes`, `pillars`, `labels`; proteins and spatial: `cell`
and its network), `src/engine/e1..e7` from the template with the shared parts, the explore panes as `render*` and
`draw*` twins, the headset code from the shared `e5_xr` and `e6_panels` instead of their own 1,500 lines of WebXR.

- **Data:** the embedded strings (airports lines 5 to 7, 486 KB of base64; proteins' 25 KB line 3594; spatial's tables)
  go into `src/sets/data.js` unchanged (or `data/*.bin` loaded by `pkgUrl`, *to decide*: a binary file is smaller and
  cached apart, but a load step more). A generator only if the original source is in the repository (*to check*).
- **Narration and timing:** proteins and spatial are synthetic (Kokoro): `NARRATION_SYNC` and the chapter times come
  over as they are, and `tools/voice/narrate.mjs <key>` + `check.mjs` after any text change. Airports: the story clock is
  the recording (`NARRATION_SYNC` the identity, `[[0, 0], [end, end]]`), its `CH` times and `NARRATION_ENDS` copied
  exactly; `tools/audio.mjs` and a table test (every chapter's start in the old and new file equal to the millisecond).
  The recording is never re-encoded.
- **Proving the rewrite is the old story** (a format test as much as a port):
  - pictures: `same.mjs <old tree> . --keys airports` at fixed moments (each chapter's start + 2 s, and `#airports&t=60`
    style hashes) on desktop and phone; a threshold, not 0 (the shared engine's panels and framing differ a little): the
    reviewer looks at the contact sheet of every pair above 1 % and lists each difference as meant or not;
  - state: a list of explore states (tabs, a picked airport, closures, communities, view) through old `state()`, each
    written in the new `v` shape by a small converter in the test, `apply()` then `state()` equal; `apply(state())`
    stable;
  - the smoke blocks for that story and the shared hook lines (every check of them), `collab.mjs`'s per-story round with
    rewritten `change`/`back`, `xrsame.mjs` and `panelsame.mjs` for the headset panels (against another built story's
    as the reference, since the old ones were hand-made);
  - pass rebuilt from `tools/lib/sets/globe.js`/`cell.js` instead of `ORIGINALS`, and `same.mjs --keys pass` at 0.
- What will change and must be said: the headset panels become the shared ones (the same look as the other stories),
  some hand-made details may go; the owner decides per difference (one review round).

## 9. Docs and rules to rewrite

- `AGENTS.md`: the stories table's file column (`packages/<key>/`), Layout (`stories/` holds the list, the design room
  and the studio; `packages/`; `tools/lib/`), the built-files rule (built: `packages/<key>/main.js` and `mini.js`, each
  `node packages/<key>/src/build.mjs`; the index by `scan.mjs`), "Rebuild the dependants" (from `tools/lib/<file>` with
  `tools/lib/deps.mjs`), "Things that are easy to forget" (the per-story rebuild lines shrink to one rule), the narration
  line (`packages/<key>/audio/`), "A new file the app needs goes into `SHELL`" (not for packages).
- `CLAUDE.md`: the built-files table (one row for packages, one for `tools/lib`, design, studio, lowpoly), "When a change
  touches the headset code, apply it to all sixteen stories" (they are packages now; the rule stands), the
  `stories/airports.js` is ~640 KB line (now `packages/airports/src/sets/data.js`).
- `docs/agents/packages.md` and `tools/packages/SPEC.md`: "The app's own sixteen stories stay in `stories/`" goes;
  `icon`, `intro`, `order.json`, `rev`, `bytes`, `mini.js`, the copy guard, *Take all stories*; "neither all.mjs nor
  --build runs it" changes for packages in this repository.
- `docs/agents/stories.md` (per-story sections move), `layout.md`, `testing.md` (new blocks and rounds, changed tools),
  `shell.md` (boot waiting for the index, offline), `shared-rooms.md` (`st.<id>.pk`, `FORMAT` 56), `docs/history.md`
  (why), `docs/event-runbook.md` (section 5), `docs/setup-and-release.md` (what to copy: `packages/`),
  `audio/PUT-narration.mp3-HERE.txt` (to `docs/`), `README.md`/`README.txt` (structure), `HANDOVER.md`.

## 10. Risks and how each is caught

| Risk | Caught by |
| --- | --- |
| A move changes what a story draws or does | `same.mjs`/`xrsame.mjs`/`panelsame.mjs` at 0 for built stories; the smoke test's hook-line checks |
| Offline regression: an installed device opens a story it never played and gets *Could not load* | the worker's install takes every listed `main.js` (G6); the `take all` smoke block offline |
| A first start waits on `packages/index.json` (slow host, headset at an event) | a short wait (1.5 s) then the Stories screen fills when it comes; the worker serves the cached index offline; smoke `phones` timing |
| Page and package from different versions | `needs` stamped by `release.mjs` (G7); the versioned `?v=<fp>` addresses; `tools/update.mjs`' move case |
| Two devices in a room on different copies | `st.<id>.pk` and the guard (section 4); `collab.mjs --copies`; state `v` |
| Shell change breaks an older built package (the app's or a colleague's) | every in-repo package rebuilt by `all.mjs` with the shell; smoke loads every listed package; a breaking change bumps `HOST.storyApi` |
| The airports recording drifts from the rewritten timeline | chapter-start table test; `audio.mjs`; the owner listens (unheard until then) |
| `rev` collisions after merging branches | `scan.mjs --check` after a merge; equal `rev` with other `fp` only a note |
| Storage quota or eviction on Quest | `estimate()` before taking, `persist()`; untested until tried on a Quest |
| `tools/<key>` paths in scripts, harnesses, docs and notes left behind | a grep for `tools/<key>/` and `stories/<key>.js` in each move's review; `node --check` |
| The pass story breaks when airports/spatial are rewritten | pass rebuilt in the same step from `tools/lib`; `same.mjs --keys pass` |
| A moved narration orphaned in `NARR` (60 MB on a headset) | the cleanup release's prune; `tools/update.mjs` checks the cache list |

## 11. Cost (rough) and models

Per the repository's rule: Opus builds and integrates; Sonnet reviews, runs tests, sweeps screenshots and writes docs;
Haiku for mechanical checks. One review and one fix round per step.

| Step | Opus (build) | Sonnet (review, tests, docs) | Sessions |
| --- | --- | --- | --- |
| G1 index, order, intro, boot | 0.4M | 0.15M | 1 |
| G2 `tools/stories.mjs` and tools | 0.4M | 0.2M (running each tool) | 1 |
| G3 `tools/lib` | 0.15M | 0.05M (Haiku: `--check`s) | 0.5 |
| G4 rooms: `FORMAT`, `v`, guard, `--copies` | 0.8M | 0.3M | 1 to 2 |
| G5 miniatures in packages | 0.5M | 0.2M | 1 |
| G6 worker and *Take all stories* | 0.7M | 0.25M | 1 |
| G7 release, version.json, live | 0.3M | 0.15M | 0.5 |
| P flock | 0.4M | 0.2M | 1 |
| A (4 stories) | 0.8M | 0.4M | 2 |
| B (7 stories) | 1.4M | 0.6M | 3 |
| C (2 stories) | 0.5M | 0.25M | 1 |
| R1 spatial | 1.5M | 0.5M | 2 to 3 |
| R2 proteins | 1.2M | 0.4M | 2 |
| R3 airports | 2.0M | 0.6M | 3 |
| Z cleanup and docs | 0.2M | 0.4M | 1 |
| **Total** | **about 11M** | **about 4.5M** | **about 22 to 25** |

The main conversation (Fable) only reads the reports. The suites before each `main` cost nothing to run; chasing their
red results is not in these numbers (100k to 1M each time, by the record in AGENTS.md).

## 12. Questions for the owner

1. The rewrites will make airports, proteins and spatial look like the built stories in a headset (the shared panels,
   menus and framing). Is that wanted, or must each keep its own look where they differ (more work, and a weaker test of
   the format)?
2. *Take all stories*: is about 85 MB per headset acceptable, and should a device that took all keep itself current in
   the background on every visit (section 5), or only when the button is pressed again?
3. Sources in `packages/<key>/src/` are served by the host (GitHub Pages, the relay) like ppicell's. Fine for the data
   generators and READMEs to be reachable there, or keep the sources in `tools/<key>/` and only the built files in
   `packages/<key>/`?
4. The order of the Stories screen in one `packages/order.json`: fine, or a number in each `story.json`?
5. May the design room stay in the shell (section 1), or should it also become a package now?
