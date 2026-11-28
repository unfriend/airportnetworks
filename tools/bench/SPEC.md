# The headset bench (`HOST.bench`, `bench.js`, v232)

The owner, 28 November 2026: a way for the cloud session to test things on the real Quest 3 by itself. "We just put the
Quest into some mode, and then it accepts commands from you or from some JSON file from the relay so you can test
whatever you just need", built "with and without adb"; "my headset is set to 4 hours anyway and the sensor is covered".
So the owner opens the test site, enters AR once by hand and sets the headset down; it stays awake for hours unworn.

This file is the design: the decisions, the JSON, the endpoints, the split between the two builders. Builder ONE builds
the app's module, the relay's part, the cloud's tool, probes, plans and docs; builder TWO builds `tools/bench/adb/`
only. Everything builder TWO needs from builder ONE is fixed here (sections 4, 5, 8, 9); a change to those sections
after both have started is agreed in the main conversation first.

## 1. Decisions, with reasons

1. **Only committed code runs on the headset** (but for script jobs, below). A job is JSON: a list of steps from a fixed
   list of commands (section 5). A `probe` step names a script file in the repository (`bench/probes/<name>.js`), loaded
   from the page's own origin; no other step carries script text, and a probe never turns a job's arguments into code (no `eval`, `Function`,
   `HOST.cur.peek` of an argument). Why: the relay's password is shared by every device of the owner's; with it alone
   nobody should be able to run code of their own on a headset in the owner's home. **The one exception** (the owner,
   28 November 2026: "can also be uncommitted code if that makes things faster"): a `script` step carries its own code,
   and runs only on a relay started with a second switch, `--bench-scripts` (section 14).
2. **The test relay only.** The relay's bench is off unless started with `--bench`, needs the relay's password (section
   4.1), and a page takes jobs only while bench mode is on at that device in developer mode. Never on the main site:
   the main site's relay never gets `--bench`, and the page refuses bench mode on the host `stories.lbi-netmed.com`
   (`BENCH_DENY`), whatever the relay says. Why: the main site is the public one, and a room there must never meet a
   headset that someone else drives.
3. **adb is an extra.** Bench mode works with nothing but the page and the relay: the owner enters AR once by hand.
   The adb helper (section 9) adds pressing Enter AR again after a reload, the headset's own frame statistics, and
   device screenshots. Why: the owner's computer is not always on, and the cloud must not depend on it.
4. **The page asks by HTTP long poll, not the room connection.** `GET /api/bench/next` held up to 20 s. Why: bench
   mode refuses shared rooms, so there is no socket to ride on; plain HTTP is what the notebook's run logs already use
   (`relayFind`, the password as a Bearer header), it survives the relay restarting on every push to `dev`, and the
   cloud's tool and the adb helper use the same endpoints with `fetch` and no packages. Each ask is also the page's
   heartbeat (last seen).
5. **No room key, no `FORMAT` change, nothing in `state()`.** Bench mode is this device's own, like developer mode
   and the performance run. A job that would change what a room sends is impossible because bench mode is refused in
   a room (section 3).
6. **Reuse, do not copy.** Segments are measured by `perfrun.js`'s own recorder (section 6), pictures read back as
   the developer notebook reads them (`notes.js` `grabXR`), pretend rays go through the controllers three.js already
   owns (section 7). The bench adds no second measuring or picture path.
7. **Pictures are read back, not rendered again.** The eye picture is the left eye's viewport of the XR layer's
   framebuffer, read right after the story's frame (the notebook's way, v148), not a second render into a target:
   no extra render pass, no camera of the shell's or three.js's touched, and so the rule "the headset's eyes are the
   shell's" holds untouched. It is never the passthrough camera: the page cannot read it, and in AR the picture's
   background is black where the room would be.

## 2. Files

| File | Owner | What |
| --- | --- | --- |
| `bench.js` (app root) | ONE | the module, loaded on demand by `HOST.mods` (name `bench`), stamped in `MODS_FP`, in `sw.js` `SHELL`, the relay's `APP_FILES`, the shell's fingerprint and `--watch`'s shell files, as `perfrun.js` is |
| `index.html`, `shared.js`, `perfrun.js`, `notes.js`, `sw.js` | ONE | hooks only (sections 3, 6, 7) |
| `bench/probes/<name>.js`, `bench/plans/<name>.json` | ONE | served by the site (section 10) |
| `relay/server.mjs`, `relay/bench.mjs`, `relay/test.mjs`, `relay/README.md` | ONE | section 4 |
| `tools/bench/bench.mjs`, `tools/bench/test.mjs` | ONE | section 8; the page and relay test |
| `tools/bench/adb/` (`adb.mjs`, `test.mjs`, `shim/`, `README.md`) | TWO | section 9 |
| `tools/bench/SPEC.md` | this design | ONE adds what it learns while building, below section 12 |
| docs (`docs/agents/shell.md` a section *The headset bench*, `testing.md`, `layout.md`, `AGENTS.md` at most two lines, `README.txt`), `whatsnew.json`, `version.json`, `whatsnew/` | ONE | release `networks-v232` |

Names: the module `HOST.bench`; `localStorage` keys `benchOn`, `benchId`, `benchXr`, `benchPlan`, `benchBorrow`,
`benchSig`, `benchJob`; the relay's store folder `.bench/` beside `.logs/`.

## 3. Bench mode in the app

**Switching on.** Only with developer mode on (`HOST.dev.on()`): the menu's Debug tab row *Bench mode: on/off* (under
*Performance run*), a card on the Experiments set in developer mode (*Headset bench*, beside the performance run's
two), or the address `#bench=on` (with `#dev=on` before it in one link: `#dev=on&bench=on`). Options in the address:
`benchxr=ar|vr` (what `#benchEnter` asks for; default `ar`), `benchplan=<name>|none` (the plan run after an update,
default `dev`). On, it is kept (`benchOn` = `{ until }`, twelve hours from switching on) so a reload keeps it.
**Switching off:** the same row and card, the page's bar button `#benchOff`, `#bench=off`, developer mode going off,
and the twelve hours passing. Off ends a running job (`failed`, `why: 'bench mode was switched off'`), puts borrowed
settings back and stops asking the relay.

**The headset's id.** `benchId`: eight characters `[a-z0-9]`, made once per device, shown on the bar and the line, sent
as `hs` with every ask. Not a secret and not personal; it tells two headsets apart.

**States** (`HOST.bench.state().phase`) and what the person sees. On a page: a bar fixed at the top, `#benchBar`, one
line and the button *Switch off* (`#benchOff`); while a session is wanted, a card `#benchCard` with the big button
`#benchEnter`. In a headset: one line drawn by `shared.js` as the performance run's read-out is (`OV.benchHud`, same
size and place, 26 degrees under the gaze), its text changed only between steps; and a Debug-tab row.

| `phase` | When | Line |
| --- | --- | --- |
| `off` | bench mode off | nothing |
| `held` | on but cannot listen: `why` one of `in a shared room`, `main site`, `developer mode is off`, `no relay`, `the relay has no bench`, `the relay wants its password` | *Bench mode is on but waiting: `<why>`. Switch off: menu, Debug.* |
| `idle` | listening | *Bench mode is on (`<hs>`): the cloud may run tests here. Switch off: menu, Debug, Bench mode.* |
| `busy` | a job runs | *Bench: `<label>`, step 2 of 5 (`<cmd>`). Switch off: menu, Debug.* |
| `enter` | jobs wait that need a session and there is none | page: card *Bench mode is waiting for the headset view* with `#benchEnter` (*Enter AR* or *Enter VR*) |
| `lost` | the relay did not answer three asks in a row | *Bench: the relay does not answer; trying again.* (asks every 30 s) |

Pressing `#benchEnter` does what the start page's Enter AR (or VR) does, inside the press (`HOST.bare` or the
story's own button, as the performance run's card does). Each press is counted in `state().press = { n, trusted, at,
err }` (`trusted` the event's `isTrusted`, `err` the session request's rejection message): the adb helper reads it.

**Refusals.** In a shared room bench mode stays `held` (`in a shared room`); joining a room while a job runs fails the
job (`why: 'a shared room was joined'`); the room is never told anything. The performance run and the bench never run
at once: a job refuses while `HOST.perfRun.on()` (`error: 'the performance run is on'`), and the bench does not ask
for jobs while it runs; the other way, `perfrun.js`'s `start()` (and a run waiting on its card for a session) refuses
while `HOST.bench.hold()`, with the shell's notice *The performance run waits while a bench job runs*.

**Holds while a job runs** (`HOST.bench.hold()`, true only while `busy`), beside the performance run's in
`index.html`: no slideshow stop, no Repeat (`HOST.ended`), no live swap or reload (`HOST.live` `quiet()`,
`HOST.reloadIfUpdated`, the relay's `--watch`), sound quiet through `HOST.audio`'s `muted()` unless the job says
`sound: true` (never stored). `HOST.perf`'s `meas()` is true while busy. Between jobs nothing is held.

**Across stories and reloads.** The module is the shell's (`HOST.quietly`), so a story change or swap keeps it and its
timers; jobs open stories themselves. The job running is kept in `benchJob` (`{ id, step, at }`); after a reload (a
crash, a new shell) the bench posts that job's result as `failed`, `why: 'the page reloaded during step <n>'`, puts
borrowed settings back (section 6.3), and listens again.

**Updates.** Package updates and new story files are taken by `HOST.live` as ever, between jobs. A new shell version:
while idle, the bench takes `HOST.live`'s question itself (`HOST.live.reload('bench')`, the place kept); the page
reloads, the session ends, bench mode is still on, and the page shows `#benchEnter`. Without adb the bench then says
`phase: 'enter'` in its report and waits for a person; jobs whose `need` is `page` or `any` run meanwhile. With the
adb helper the button is pressed for it (section 9).

**The plan after an update.** `HOST.live.sig()` (new, `index.html`): `{ shell: HOST.shell.id, pk: <fingerprint over
the package index's fingerprints as last read> }`. When it differs from `benchSig` and the bench has been idle for
20 s with nothing queued for it, the bench fetches `bench/plans/<benchPlan>.json` and posts it as a job
(`from: 'auto'`, `why: 'update: <shell n or the packages changed>'`), then writes `benchSig`. The relay hands it back
like any job. A plan with `page` steps (section 5.3) is posted as two jobs: its `page` part (`need: 'page'`) at once,
its main part as written. `benchplan=none` turns this off. What the relay answered to the last automatic plan
(`{ at, status, err }`: a 507 or 429 among them) is the report's `auto`, so the cloud's `status` and `show` see it.

## 4. The relay (`--bench`)

**4.1 On and off.** `node relay/server.mjs ... --bench`. Refused at start (a plain message, exit 1) without a password
(`COLLAB_TOKEN` or `--token`) unless the relay listens only on a loopback address (the tests), and without one behind
`--proxy` even on loopback (a reverse proxy in front makes it public). With no password, a request carrying an `Origin`
that is not the relay's own (or an `--origin`) is refused 403, so no web page of another origin can use the bench
through the API's `Access-Control-Allow-Origin: *`. Kept beside the notes
(the notebook must be on: `--bench` with `--no-notes` is refused): `<notes>/.bench/` in a folder, `.notes/.bench/` in
R2, with the stores of `relay/notes.mjs`'s style (`benchFolderStore`, `benchR2Store` in `relay/bench.mjs`, parsing and
limits there, routes in `server.mjs` as `benchApi`). `/api/ping` adds `bench: true` and `benchScripts: true|false`. Without `--bench` every
`/api/bench` path answers 404 `{ error: 'this relay has no bench' }`. Everything is behind the password (the API's
`authOk`, as every endpoint but `/api/health`); CORS as the rest of the API.

**4.2 Endpoints.** JSON in and out unless said; `no-store`. `hs` is `^[a-z0-9]{8}$`; a job id is the notes' id pattern
(`NOTE_ID`, `20261128-142233-ab3x`).

| Method, path | Who | Body or query | Answer |
| --- | --- | --- | --- |
| `GET /api/bench` | cloud, helper | | `{ now, headsets: [{ hs, seen, ago, phase, why, xr, job, adb: { seen, ago } \| null, report }], queued, running, scripts }` (a headset is listed for 10 minutes after it was last seen; `scripts`: `--bench-scripts` is on) |
| `POST /api/bench/hello` | page | `{ hs, report }` (report at most 32 KB) | `{ ok, now }`; sent at start, on every phase change, after each job and every 60 s |
| `GET /api/bench/next?hs=&xr=vr\|ar\|&wait=20` | page | `xr` empty: no session | 200 `{ job }` (state now `running`, `hs` set) or 204 after `wait` seconds (at most 25) with nothing; a job is handed only when its `need` is met and its `hs` (if any) matches |
| `GET /api/bench/next?role=adb&hs=&wait=20` | adb helper | `hs` the page's id, or `adb` (or none) before the helper has read it | 200 `{ job }` of `to: 'adb'` (as `adb`: only jobs with no `hs`), or 204; also marks the helper seen |
| `POST /api/bench/jobs` | cloud, page (auto plan) | a job (section 5), at most 64 KB (a script step's code counted) | 201 `{ id }`; 400 `{ error }` naming the first bad field (also a script step in a job `from: 'auto'`); 403 a script step without `--bench-scripts`; 507 when 1000 jobs are kept and none has ended; 429 when 50 are queued |
| `GET /api/bench/jobs?state=&limit=50` | cloud | | `{ jobs: [summary] }`, newest first (a script step's code only as `scripts: [{ i, bytes, sha }]`) |
| `GET /api/bench/jobs/<id>` | cloud, helper | | the whole record (section 5.4), a script step's code with it |
| `POST /api/bench/jobs/<id>/progress` | page, helper | `{ hs, step, of, note }` | `{ ok, cancel }`: `cancel: true` when the job was cancelled; also the job's heartbeat |
| `POST /api/bench/jobs/<id>/result` | page, helper | `{ hs, ok, why, t0, t1, steps, report }` at most 1 MB | `{ ok }`; 409 when the job is not `running` for that `hs` |
| `POST /api/bench/jobs/<id>/pic?n=1` | page | `image/jpeg`, at most 1 MB, n 1 to 20 | `{ ok, n }` |
| `GET /api/bench/jobs/<id>/pic/<n>` | cloud | | the JPEG (`nosniff`) |
| `POST /api/bench/jobs/<id>/adb` | adb helper | `{ vrapi, notes }` at most 512 KB (section 9.5) | `{ ok }`; kept as the job's `adb` field, replacing an earlier one |
| `POST /api/bench/jobs/<id>/devshot?n=1` | adb helper | `image/png` or `image/jpeg`, at most 4 MB, n 1 to 5 | `{ ok, n }` |
| `GET /api/bench/jobs/<id>/devshot/<n>` | cloud | | the image |
| `POST /api/bench/jobs/<id>/cancel` | cloud | | `{ ok, state }`; a queued job becomes `cancelled` at once, a running one when the page next asks (`progress` or `next`) |
| `POST /api/bench/jobs/<id>/delete` | cloud | | `{ ok }`, its pictures with it |

**Keeping and limits.** An ended job (`done`, `failed`, `cancelled`, `expired`) is deleted with its pictures 14 days
after it ended (the 5 s sweep). A new job that would make 1001 deletes the oldest ended job first; a picture or device
screenshot that would take the jobs past 1 GB (pictures, device screenshots, results' and helper lines' JSON) deletes
the oldest ended jobs first, and is refused 507 only when the queued and running ones alone fill it. In memory: at most
32 headsets and 32 helper ids (the one heard from longest ago makes room; any not heard from in ten minutes is dropped
by the sweep), and at most 16 long polls held at once (another `next` is answered after one look, as `wait=0`).

**4.3 Job states** (`state`): `queued` → `running` → `done` | `failed` | `cancelled` | `expired`. `expired`: queued
longer than its `ttl` (default 900 s, at most 24 h), or running longer than its `limit` plus 60 s with no progress
(`why: 'no word from the headset'`). A relay restart keeps every job (they are in the store); a `running` job's result
is still taken after a restart. The queue is the stored jobs in `queued`, oldest first. A headset (`hs` and its
last report) and the helper's last ask live in memory only.

**4.4 What a log line may say.** `bench job <id> queued <n> steps`, `bench job <id> taken by <hs>`, `bench job <id>
<state> <ms>`, `bench job <id> deleted (old)`, `bench <hs> listening` (once on the first ask after ten minutes away). Never a step's fields (a script's code among them), a result, a
report, a picture's size beyond bytes, a URL with its query, or the password; the `scrub` of URLs as now.

## 5. Jobs and results

**5.1 A job** (what is posted; the relay adds the rest of 5.4):

```json
{ "v": 1, "label": "cdk5 explore picking", "to": "page", "need": "xr", "hs": "",
  "with": { "auto": false, "occl": "off" }, "sound": false, "limit": 600, "ttl": 900, "adb": true,
  "steps": [ { "cmd": "open", "story": "cdk5" }, { "cmd": "explore", "tab": 0 },
             { "cmd": "rays", "preset": "sweep", "sec": 20, "measure": true }, { "cmd": "pic" } ] }
```

`label` at most 80 characters; `to` `page` (default) or `adb`; `need` `xr` (a session, VR or AR), `ar`, `vr`, `page`
(no session needed; also runs in one) or `any` (default for `report`-only jobs; else `xr`); `hs` empty for any
headset; `with` settings borrowed for the whole job (6.3); `limit` seconds the whole job may take (default 300, at most
3600); `adb` false asks the helper not to attach its lines; `from` `cloud` (default) or `auto`; `why` at most 120
characters. At most 200 steps. Unknown fields: 400.

**5.2 The commands** (a step: `{ cmd, ...fields }`; every step may have `label`). A step's out is at most 64 KB.

| `cmd` | Fields | Does | `out` |
| --- | --- | --- | --- |
| `report` | | reads the facts | the report (5.5) |
| `open` | `story` (a key), or `scene` and `src` (`examples` default, or `relay`) | opens it as the performance run does (`HOST.start`, the studio at `#studio&scenes=<examples>&scene=<name>`), waits until loaded (90 s story, 75 s scene) | `{ key, load, build, was }` (perfrun's load figures) |
| `seek` | `chapter` (index from 0) or `t` (story seconds); `play` (default false) | `APP.seek`, settle 1 s | `{ mode, chapter, t, playing }` |
| `play`, `pause` | | `APP` as the shell's own buttons | `{ t, playing }` |
| `explore` | `tab` (index or the tab's `data-tab` id, optional) | `APP.enterExplore`, then `showTab` | `{ tabs, tab }` |
| `set` | `name`, `value` (6.3 table) | borrows one setting until the job ends | `{ name, was, now }` |
| `measure` | `sec` (1 to 600), `name` | a segment of the recorder (section 6) | a segment (6.2) |
| `rays` | `hand` 0 or 1 (default 1), `preset` (`sweep`, `circle`, `still`) or `path`, `sec`, `press` (list of `{ at, down }`), `measure` (bool) | pretend controller rays (section 7) | `{ frames, hovers, pressed }` and, measured, the segment |
| `pic` | `w` (320 to 1280, default 960), `q` (0.5 to 0.92, default 0.8) | the left eye's picture (section 1.7), posted as `pic?n=` | `{ n, w, h, bytes }` or `err` |
| `probe` | `name` (`^[a-z][a-z0-9-]{0,31}$`), `args` (JSON, at most 8 KB) | runs `bench/probes/<name>.js` (section 10) | what the probe returns, at most 64 KB |
| `script` | `code` (text: the body of an async function `(api, args)`), `args` (JSON, at most 8 KB), `limit` (seconds, 1 to 3600, optional) | runs the code as a probe runs (section 14); only on a relay with `--bench-scripts` | what the code returns, at most 64 KB |
| `wait` | `sec` (0 to 600), or `until` `quiet` (`!HOST.busy`, 60 s at most) | waits | `{ waited }` |
| `reload` | | `HOST.live.reload('bench')`: ends the session; last step only | none (the result is posted before) |

`to: 'adb'` jobs have their own commands (section 9.4): `devshot` (`n`), `enter`, `open`, `vrapi` (`from`, `to`, and
`job`: the id of the job the statistics go onto).

**5.3 A plan** is a file `bench/plans/<name>.json`: a job without `hs`, plus optional `page` (steps for no session).
`tools/bench/bench.mjs run <name|file>` posts it as a job. Builder ONE ships `bench/plans/dev.json` (every story
opened, one chapter measured 10 s, explore mode with pretend rays swept 10 s measured, one picture; the studio's
`bliss-xp` 10 s; about 15 minutes) and `bench/plans/picking.json` (cdk5 and the exposome in explore mode, rays swept 20 s
measured: the explore-picking fault of v231).

**5.4 The record** (`GET /api/bench/jobs/<id>`): the job plus `{ id, state, why, at, taken, ended, hs, progress: { step,
of, note, at }, result, pics: [{ n, bytes }], adb, devshots: [{ n, bytes, type }] }`. A summary: `{ id, label, state,
why, at, ended, hs, steps, ok }`. The `result` posted by the page:

```json
{ "hs": "k3v9q2ma", "ok": true, "why": "", "t0": 1795850000123, "t1": 1795850042000,
  "report": { "...": "5.5, at the start" },
  "steps": [ { "i": 0, "cmd": "open", "ok": true, "t0": 1795850000130, "t1": 1795850006400, "out": { "key": "cdk5", "load": 5900 } },
             { "i": 2, "cmd": "rays", "ok": false, "t0": 0, "t1": 0, "err": "needs a headset session" } ] }
```

`t0`, `t1` are the headset's `Date.now()` (ms): the adb helper reads logcat on the same clock. A step that fails ends
the job (`ok: false`, `why` its error) unless it has `soft: true`. Errors are plain sentences: `needs a headset session`,
`no such story: <key>`, `no such probe`, `the probe threw: <message>`, `the script threw: <message>`, `the script does
not compile: <message>`, `scripts are off at this relay (it was not started with --bench-scripts)`, `no picture: <why>`, `timed out after <n> s`,
`cancelled`, `the performance run is on`, `a shared room was joined`.

**5.5 The report**: `{ release (HOST.shell's, networks-vN), served (version.json's), shell: { n, id }, packages: { <key>:
fp } (the index's), loaded: { <key>: fp } (HOST.fp), device, model, browser, ua (200 chars), xr ('', 'vr', 'ar'),
visibility, hz, hzList, eyeW, eyeH, fbScale, fov, battery ('87', '87+' charging), settings (perfrun's info().settings
plus labels, cards, free, subs, walk, sharp, occlSmooth), story (HOST.curKey), mode ('story', 'explore', 'stories'),
chapter, t, playing, phase, press, mods (HOST.mods.loaded()), errs (count since the last report) }`. Built from
`perfrun.js`'s `info()` (exposed, section 6) and the bench's own reads.

## 6. Measuring, and borrowed settings

**6.1 The recorder.** `perfrun.js` exposes `HOST.perfRun.rec`: `{ open(kind, story, key), close(why) → segment,
on() , info(), errors(on) → { list } }`, the same `segOpen`, `segClose`, `info`, and the v231 error catching it uses,
able to record while no run is on: its `frame()` measures while `R.on` or a recorder segment is open. A bench segment
is not sent as a run log event and not kept in `perfRun`; `close` returns it. The error catching runs while a bench
job runs and its distinct messages (`cleanMsg`, at most 60) go into the job's `measure` steps' `errlist`.

**6.2 A segment** is perfrun's (`{ kind: 'bench', story, key, why, dur, n, mean, p50, p95, p99, max, miss, stall, long,
hz, calls, tri, js, heap, q, q0, qch, errs }`) plus what the log lacks today, read at the segment's end unless said:
`lines`, `pts` (mean a story frame: `HOST.perf`'s `last()` gains `lines` from `renderer.info.render.lines`; `pts` is
there), `tex` and `geo` (`renderer.info.memory.textures`, `.geometries`), `prog` (`renderer.info.programs.length`), and
`errlist` `[{ n, lvl, msg }]`.

**6.3 Borrowed settings.** The headset settings are the device's; a job borrows them. `with` (whole job) and `set`
(from that step to the job's end) take:

| name | values | through |
| --- | --- | --- |
| `occl` | `off`, `hands`, `room`, `both` (occlusion's modes) | `HOST.occlusion.set` (`xrOccl`) |
| `occlSmooth` | bool | `HOST.occlusion.setSmooth` (`xrOcclSmooth`) |
| `auto` | bool | `HOST.xr.setAuto` (`xrAuto`) |
| `hz` | 30 to 240 | `HOST.xr.setHz` (`xrHz`) |
| `fps` | bool | `HOST.xr.setFps` (`xrFps`) |
| `labels`, `cards` | the label modes | `HOST.xr.setLabels`, `setCards` (the own look) |
| `free`, `subs`, `sfx` | bool | `HOST.xr.setFree`, `setSubsDevice`, `setSfx` |
| `walk` | bool | `HOST.xr.setWalk` (`xrWalk`) |
| `sharp` | the sharp text modes | `HOST.xr.setSharp` |
| `scale`, `fov` | as the setters take | `HOST.xr.setScale`, `setFov` (next session) |
| `body` | bool | `HOST.xr.setBody` (`xrBody`) |

Before the first change the raw `localStorage` values of every key the job will touch are written to `benchBorrow`
(`{ job, at, raw: { key: value or null } }`), then the setter is called. At the job's end, on a failure, a cancel or a
switch-off, the raw values are written back, the setters called again with the old values, and `benchBorrow` removed.
On every boot, before anything else of the bench, a `benchBorrow` left by a crash or reload is put back the same way
(and said in the next result's `why`). Builder ONE confirms each setter's key from the code; a setting not in the
table is refused (`error: 'not a setting the bench may borrow: <name>'`). Never in a room (the bench is not in one).

## 7. Pretend rays: the seam

**What stories read** (read before deciding): every story's controller is `GL.renderer.xr.getController(i)` (three.js's
`Group`, `tools/engine/e5_xr.js` `xrController`; the three hand-written stories and the studio likewise). A ray is
read from that group's `matrix` (`xrPoint`: `c.o.setFromMatrixPosition(g.matrix)`, `c.d ... transformDirection(g.matrix)`),
only while `c.src` is set and `g.visible`. `c.src` comes from the group's `connected` event (or `HOST.inputs` in
`xrAdopt`); presses come from the group's `selectstart` and `selectend` events, the grip from `squeezestart` and
`squeezeend`. three.js r128 writes the group's `matrix` (and `visible`) each XR frame in `WebXRController.update`,
before it calls the animation loop's callback. `tools/smoke.mjs`'s pretend headset writes `c.g.matrix` from inside
the story (`HOST.cur.peek`); the bench must not touch story code.

**The seam** (`index.html`, `makeRenderer`'s `setAnimationLoop` wrapper, the only change): before calling the
wrapped frame, `if (HOST.bench && HOST.bench.pre) HOST.bench.pre(t, fr)` (try, never in the way). While a `rays` step
runs, `pre` does for its hand, every frame after three.js's update and before the story's frame:

- the pose at this frame's time from the path, in the room's frame: the head's pose at the step's start (the session's
  viewer pose from `fr.getViewerPose(HOST.renderer.xr.getReferenceSpace())`) times the path's local pose (so a path is
  written relative to where the headset lies, as the tests' seats are);
- writes it into the group: `position`, `quaternion` (scale 1), `matrix.compose(...)`, `matrixWorld` copied (the group is
  a child of the scene, whose world is the room's), `visible = true`;
- at the step's start dispatches `{ type: 'connected', data: SRC }` on the group (after `disconnected` for the real
  source there, if any), where `SRC = { handedness: 'right'|'left', targetRayMode: 'tracked-pointer', profiles:
  ['bench'], gamepad: { buttons: six { pressed, touched, value }, axes: [0, 0, 0, 0] }, bench: true }`; a `press` at its
  time dispatches `selectstart` then, at `down: false`, `selectend` with `data: SRC`;
- at the step's end (also on a throw, a cancel or the session's end): `disconnected` with `SRC`, then `connected` again
  for the real source at that index in `HOST.session.inputSources` if there is one, and `pre` does nothing again.

The real controllers (lying unused) stay on the other hand. Nothing of the story changes, the shell's menu and its
`HOST.collab.ray` wrap see the same ray, and the seam is idle (one property read) when no `rays` step runs. Presets
(relative to the head, 0.25 m right, 0.3 m down, 0.2 m forward): `sweep` yaw -40 to 40 degrees and pitch -20 to 15
degrees, a slow raster of four rows over `sec`; `circle` a 15-degree cone once every 4 s; `still` straight ahead.
`path`: at most 600 points `{ at (s), p: [x, y, z], q: [x, y, z, w] }` or `{ at, p, look: [x, y, z] }`, eased linearly.
`out.hovers`: how many frames the story's ray hit something, read after the story's frame from whether its dot was
visible (`HOST.cur.peek('XR.ctrls[0].dot.visible')` and `[1]`: two fixed expressions, no job text; the built stories
and the studio have them, a hand-written story without them gives `hovers: null`).
Needs a session (`needs a headset session` otherwise).

## 8. The cloud's tool (`tools/bench/bench.mjs`)

Node 22, no packages; `NOTES_RELAY` (default the test place) and `NOTES_TOKEN` as `tools/notes/notes.mjs` takes them
(the password never printed, written or put in an address). Commands:

- `status`: the headsets (id, seen ago, phase, why, session, story, release, battery) and the helper (seen ago) as a
  Markdown table; exit 3 with *No headset is listening: put bench mode on at the headset (developer mode, Debug tab).*
  when none was seen in the last 60 s.
- `send <cmd> [key=value ...] [--need xr] [--with occl=off,auto=false] [--hs id] [--wait 300] [--no-wait]`: one step
  as a job; values parsed as JSON where they parse, else strings. Waits for the result (polling the record every 2 s)
  and prints it.
- `run <plan name|file.json> [--wait s]`: a plan (a name reads `bench/plans/<name>.json` from the checkout). A script
  step in a plan may say `"file": "<path>"` (beside the plan, or absolute) instead of `code`: the tool reads it in.
- `script <file.js> [--args '<json>'] [--open <story>] [--need xr|page|any] [--limit s]`: one job, an `open` step
  first when `--open` says, then the file as a `script` step (section 14); waits and prints as `run` does. `--limit` is
  the script step's own; the job's limit is at least 300 s and leaves room for it. Exit 2 with *This relay runs no
  scripts* when the relay was not started with `--bench-scripts` (asked before sending, and on a 403).
- `jobs [--state s]` (a script step as its code's length and hash), `show <id> [--md out.md] [--json]`: a job's steps
  as a table (cmd, ok, seconds, the main figures; a script's out as a probe's, its code's length and hash above);
  `measure` and measured `rays` steps as perfrun's segment table plus `lines`, `pts`, `tex`, `geo`, `prog`; the
  helper's `vrapi` summary when there is one; errors.
- `pic <id> [n] [--out dir]`, `devshot <id> [n] [--out dir]`: saves the images (default the system's temporary
  folder) and prints their paths.
- `cancel <id>`.
- `delete <id> [<id> ...]`, or `delete --state done,failed,cancelled,expired` (ended states only): the jobs and their
  pictures, gone for good. The relay also deletes ended jobs itself (section 4.2, "Keeping and limits").
- `send <cmd> ... --to adb`: one step for the adb helper (`devshot n=1`, `enter`, `open`, `vrapi from= to= job=`);
  exit 3 with *The adb helper is not listening* when the helper has not asked in the last minute.

Exits: 0 done, 1 a job failed or a usage error, 2 the relay refused (401, 404 *this relay has no bench*, a script on a
relay without `--bench-scripts`), 3 no
headset listening (checked before sending, and again when a wait times out with the job still queued).

## 9. The adb helper (`tools/bench/adb/`, builder TWO)

Runs on the owner's computer (Windows, macOS, Linux), Node 22, no packages; `adb` on the `PATH` or `--adb <path>`.
`node tools/bench/adb/adb.mjs [--site https://stories.lab.lbi-netmed.com/] [--relay <url>] [--serial <s>] [--no-awake]
[--watch] [--once]`; `NOTES_RELAY` and `NOTES_TOKEN` as the cloud's tool (the relay defaults to the site's origin).

**9.1 What it reads.** From adb: `adb devices -l` (finds the headset: a model of `Quest`; more than one asks for
`--serial`), `adb shell cat /proc/net/unix` (the DevTools socket: `@chrome_devtools_remote` or a name ending
`_devtools_remote` of the browser's process), `adb logcat -v epoch` filtered to the tag `VrApi`. From the page, over
DevTools (`adb forward tcp:<free port> localabstract:<socket>`, then `http://127.0.0.1:<port>/json/list`, the page whose
URL begins with `--site`, its WebSocket): `Runtime.evaluate` of exactly `HOST.bench && HOST.bench.state()` (returned by
value) and of `EXPR_RECT` in `adb.mjs`: `#benchEnter`'s `getBoundingClientRect()` with `innerWidth`, `innerHeight`,
`devicePixelRatio` and `visualViewport`'s `scale`, `offsetLeft`, `offsetTop`, `width`, `height`, as one JSON string (or
null with no button). Nothing else is evaluated in the page.

`HOST.bench.state()` (fixed for builder TWO): `{ on, phase, why, hs, xr, want ('ar'|'vr'), job: { id, step, of } | null,
press: { n, trusted, at, err }, rel (HOST.shell's release), url, now (the headset's Date.now()) }`.

**9.2 The address it opens.** `<site>#dev=on&bench=on&benchxr=ar` with `adb shell am start -a
android.intent.action.VIEW -d '<address>' com.oculus.browser`: at its start when no page of the site is open, and
again when an `open` job asks. The page needs the relay's password already kept in that browser (`relayTokens`): the
helper never gives the page a password; a page `held` with `why` *the relay wants its password* is reported plainly
(*Put the headset on once and enter the relay's password in the menu.*).

**9.3 Pressing Enter AR.** Whenever the page's `phase` is `enter` (after every page load, a new shell's reload among
them): the button's rectangle's centre, then DevTools `Input.dispatchMouseEvent` `mousePressed` and `mouseReleased`
(button left, clickCount 1, CSS pixels), at most once in 15 s. A centre outside the visible part of the page (the
visual viewport) is never pressed: *The Enter button is out of view* (with the pinch zoom, when there is one). Pinch-
zoomed, the presses take the layout's place and the visual viewport's in turn (desktop Chromium takes the first; Quest
Browser unknown). Quest Browser's own page zoom cannot be seen from the page: a press that does not reach the page
says it may be that, and to set it back to 100 %. Then `state().press` tells what happened: `n` grown and
`xr` set within 10 s, done; `err` set, reported with the message; `n` grown, no `err` and no session after 10 s:
*The browser may be asking a question on the headset (to allow AR for this site). Put it on and allow it once.*;
`n` not grown, *the press did not reach the page*. A JavaScript dialog (`Page.javascriptDialogOpening`) is reported
and never answered.

**9.4 Its own jobs** (`to: 'adb'`, taken with `GET /api/bench/next?role=adb&hs=<hs>`, `hs=adb` until the helper has
read the page's id, so a job for no headset in particular, an `open` among them, is taken with no page; a refusal other
than 401 or 404 waits 10 s, not a minute; answered with `progress` and
`result` as the page's are): `devshot` (`n` 1 to 5: `adb shell am startservice -n
com.oculus.metacam/.capture.CaptureService -a TAKE_SCREENSHOT`, the newest file of `/sdcard/Oculus/Screenshots` pulled,
else `adb exec-out screencap -p`; posted to `devshot?n=`; `out: { how }`); `enter` (9.3 once now); `open` (9.2);
`vrapi` (`from`, `to` ms on the headset's clock: the lines of that window posted as 9.5 onto the job named by `job`,
else onto this adb job's own record; `out: { onto, n, all, notes }`). A device screenshot may show the owner's room
through passthrough: taken only when a job asks, kept only on the test relay.

**9.5 The headset's frame statistics.** The helper keeps the last 30 minutes of `VrApi` lines (logcat on the headset's
clock, `-v epoch`: the same clock as the page's `Date.now()`). The computer's clock may differ by seconds or minutes:
the helper takes the headset's from `state().now` over a round trip under a second (else from the newest `VrApi`
lines' times as they come, else none) and compares a job's `t0`, `t1` and the lines only with that (`hNow()`); an
unreadable line is stamped on it as it comes. Each `GET /api/bench/jobs?state=done` (every 5 s in
watch mode) gives the jobs ended since it last looked; for each of its headset's (`hs`) with `adb` not false and no
`adb` field yet, it posts `POST /api/bench/jobs/<id>/adb`:

```json
{ "vrapi": { "from": 1795850000123, "to": 1795850042000, "n": 42, "per": [
    { "i": 2, "t0": 0, "t1": 0, "fps": 71.8, "fpsMin": 60, "stale": 3, "cpuLvl": 4, "gpuLvl": 4, "cpuPct": 0.41, "gpuPct": 0.88, "tempC": 36.5 } ],
  "all": { "fps": 71.2, "fpsMin": 54, "stale": 9, "cpuLvl": 4, "gpuLvl": 4, "cpuPct": 0.43, "gpuPct": 0.86, "tempC": 36.8, "freeMB": 1500 },
  "rows": [[1795850001000, 72, 0, 4, 4, 0.41, 0.88, 36.5]], "cols": ["t", "fps", "stale", "cpuLvl", "gpuLvl", "cpuPct", "gpuPct", "tempC"] },
  "notes": "parsed 42 VrApi lines; 0 unreadable" }
```

`per`: one entry for each step (its `t0`, `t1` from the result); `rows` at most 3600. A line it cannot read is counted,
never sent. No `VrApi` lines in the window: `{ vrapi: null, notes: 'no VrApi lines in the job's seconds' }`.

**9.6 Awake.** Unless `--no-awake`: `adb shell am broadcast -a com.oculus.vrpowermanager.prox_close` at the start and
every 5 minutes, and `adb shell am broadcast -a com.oculus.vrpowermanager.automation_disable` on exit (Ctrl+C,
`SIGTERM`, an error); it changes no stored setting.

**9.7 Its test** (`tools/bench/adb/test.mjs`, no headset): a shim `adb` (`tools/bench/adb/shim/adb.mjs` with
`adb.cmd` and an executable `adb` beside it) answering `devices -l`, `shell cat /proc/net/unix`, `forward`,
`shell am start` (navigating the stand-in browser by DevTools), `shell am broadcast` (logged), `logcat -v epoch` (canned
`VrApi` lines stamped with the present time, one a second), `exec-out screencap -p` (a small PNG); a local headless
Chromium (Playwright's, `--remote-debugging-port`) standing in for Quest Browser's DevTools, its page the app served by
a relay started on a free port with `--static . --bench --token <random>`; checks: it finds the headset, opens the
address, presses `#benchEnter` with a trusted event (`press.trusted`; headless has no WebXR, so `press.err` is
expected and reported as such), attaches `vrapi` to a job a fake page posted (by HTTP, as the page would), posts a
devshot, and puts the awake broadcast back on exit. Every real-device behaviour stays untested (section 12).

## 10. Probes and plans: where they live

`bench/` at the app root (not under `tools/`, which the relay does not serve and must not start serving): `bench/probes/
<name>.js`, `bench/plans/<name>.json`. The relay serves them as an app folder (`APP_DIRS` and `APP_DEEP` gain `bench`).
`sw.js` passes `bench/` through to the network uncached (`no-store`, as `version.json` and `whatsnew/`); they are not in
`SHELL`. GitHub Pages serves them too; harmless, since the main site's relay has no bench.

**A probe** is a file that calls `HOST.bench.probe('<name>', async (api, args) => { ...; return { ... }; })`; the
bench loads it fresh (`?t=`) as a `<script>` from its own origin under `HOST.quietly`, once a page, and refuses a name
that is not the file's. `api`: `{ args (a copy), story () → HOST.curKey, app () → { mode, t, playing, chapter } , peek
(expr) → HOST.cur.peek(expr) (fixed strings in the probe only), frames (n) → Promise, wait (ms), until (fn, ms), measure
(sec) → segment, renderer () → { info } (read only), log (text) (into the step's out, at most 50 lines) }`. A probe
returns plain JSON (at most 64 KB) within the job's limit; a throw fails the step. Builder ONE ships
`bench/probes/picks.js` (the explore pick cache's size and refills for cdk5 and the exposome: `peek` of fixed
expressions) and `bench/probes/scene.js` (the scene's object, mesh and material counts).

## 11. Tests (builder ONE)

`relay/test.mjs --bench`: refused without a password off loopback or behind `--proxy`; with no password, another
origin refused (a read and a `text/plain` post); the pruning (age, bytes, room for one, a picture's own job kept, never
a queued or running job) and an old ended job deleted by the sweep after a restart; the helper asking as `adb`; a
`vrapi` step's `job`; 16 long polls at most; 404 without `--bench`; 401 without the password;
a job posted, handed by `next` only to a matching `need` and `hs`, progress, result, pics, `adb` and `devshot`
attached, cancel queued and running, expiry, limits (64 KB, 200 steps, 50 queued, 1 MB result, 1 MB picture), a restart
keeping jobs, and no step field, result or password in the log. `tools/bench/test.mjs`: a relay on a free port with
`--static . --bench --token`, headless Chromium at `#dev=on&bench=on`, `relayTokens` set by an init script; checks the
bar and the phases (`held` in a room, on the main site's host by an init-script stand-in), a page job (`report`,
`open`, `seek`, `explore`, `measure` with `lines`, `tex`, `prog`, `probe`, `set` and its put-back also after a reload
mid-job), and a pretend session (the smoke test's way) for `rays` (hovers counted, the real source connected again
after) and `pic`. Script jobs (section 14): `relay/test.mjs --bench` checks the two start refusals, the 403, the
fields, the listing's length and hash, an automatic plan refused and a log without the code; `tools/bench/test.mjs`
checks exit 2 without the flag and, on a second relay with it, a script's JSON (with `--open`, `--args`, `api.log`), a
throw, a compile error, a script over its own limit and a job after it, a plan's script `file`, the page's refusal when
the relay's ping says scripts are off (the ping answered by Playwright), and a log without the code. The smoke test gains a block `bench` (`--only bench`): the module loads, the seam is idle.

## 12. Open risks (all untested until the owner tries them on the Quest 3)

- **A DevTools click as a user gesture.** `Input.dispatchMouseEvent` gives trusted events and user activation in
  desktop Chromium; whether Quest Browser lets that activation start `requestSession('immersive-ar')` is unknown. If
  not, adb's `input tap` at the button's place on the browser's panel is the next try (needs the panel's place in the
  headset's view: unknown), else a person.
- **The permission question.** Quest Browser may ask to allow VR or AR for the site, outside the page; the helper can
  only say so. Usually asked once per site.
- **VrApi lines for the browser.** Quest Browser's immersive pages may log `VrApi` lines from another process, under
  another tag, or (on newer system versions, OpenXR) not at all; the helper then attaches `vrapi: null` and says why.
- **The eye picture.** Reading the layer's framebuffer inside the frame works in the notebook's design, but on the
  Quest it may stall the frame (a GPU read), read back empty with multisampling, or miss the story panel drawn as a
  Sharp text layer (the notebook waits for `sharpPause`); the picture step is never inside a measured stretch.
- **Pretend rays and real controllers.** Taking a hand's group from a connected real controller and giving it back
  relies on three.js r128 re-mapping sources only on `inputsourceschange`; a controller waking meanwhile may fight the
  seam for a frame. Hand tracking (no controllers) gives `hand` sources: the seam still writes the group.
- **Hours unworn.** The headset's own sleep, the browser freezing a page it thinks hidden (`visibilityState`
  `hidden` when the sensor is covered or uncovered), Wi-Fi saving power, and the session ending by itself; the bench
  says `phase: 'enter'` then and waits.
- **Long poll through the test place's proxy.** A 20 s held request may be cut by Coolify's proxy; the page treats a
  cut as an empty answer and asks again, falling back to a 5 s poll after three cuts.
- **Device screenshots** may be black for an immersive page, or include the room through passthrough.
- **Browser zoom.** Quest Browser's own page zoom changes what a CSS pixel is for DevTools' input and cannot be read
  from the page; the helper says so when a press does not land. Pinch zoom is handled (9.3), tried only in desktop
  Chromium.
- **The first try (about ten minutes, with the helper):** on the computer, first `export NOTES_TOKEN='<password>'`
  (PowerShell: `$env:NOTES_TOKEN='<password>'`: `check` asks the relay too and exits 2 without it); `adb devices`
  shows the Quest; in the checkout, `node tools/bench/adb/adb.mjs check`, then `node tools/bench/adb/adb.mjs --watch`;
  it opens the site, and on the headset the owner allows USB debugging once and, if asked, AR for the site; then from
  the cloud `node tools/bench/bench.mjs status`, `node tools/bench/bench.mjs send report`, `node tools/bench/bench.mjs
  send pic`, `node tools/bench/bench.mjs run picking`. Without the helper: open the test site on the headset, developer
  mode on, Debug tab, *Bench mode: on*, Enter AR, set it down, and the same cloud commands. The step by step list is
  `tools/bench/adb/README.md`.

## 13. What builder ONE learnt while building (v232)

None of sections 4, 5, 8 and 9's names or shapes changed; these are additions and the places the code settles what the
text left open.

- **The relay without notes** keeps the bench in memory (a startup line says so), so a test relay started as 9.7 says
  (`--static . --bench --token <random>`, no `--notes`) has a bench; `--bench` with `--no-notes` is still refused.
- **The record's `adb`** is the job's own `true` or `false` (whether the helper should attach its lines) until the helper
  posts them; then it is the posted object (`{ vrapi, notes, at }`). So the helper attaches when `adb === true`.
- **The record's `why`** is the state's (a failure's reason, `cancelled`, an expiry's); a job's own `why` (an automatic
  plan's reason) is kept as `asked`.
- **A 204 from `next`** carries `X-Bench-Waiting: <n>`: jobs queued for this headset that wait for a session.
- **`GET /api/bench`** also lists the helper by itself: `adb: [{ hs, seen, ago }]`. **`GET /api/bench/jobs?state=`**
  takes a comma list, and `ended` for done, failed, cancelled and expired.
- **`progress`** on a job that is not running for that `hs` answers 200 `{ ok: false, cancel, state }`; **`cancel`**
  answers `{ ok, state, cancel }` (`cancel: true` while a running job waits for the page's next word).
- **`phase: 'enter'`** whenever bench mode listens without a session (not only when a job waits for one): the adb helper
  presses after every page load, and a page without WebXR records `press.err` (`this browser has no WebXR`). `held`
  also says `the performance run is on`.
- **Occlusion's modes** are `off`, `depth`, `room`, `both` (occlusion.js), not `hands`.
- **Pretend rays** are relative to the head's place and heading at the step's start, not its pitch and roll: a headset
  lying on a table points anywhere. Presses also dispatch `select` before `selectend`.
- **`pic` on a page** reads the canvas (the notebook's `grabPage`); its `out` says `xr`. The headset's menu is closed as a
  job begins in a session (developer mode opens it on What is new), so pictures show the story.
- **The probe API** adds `rays(o)` (a `rays` step from inside a probe: `hand`, `preset`, `sec`, `measure`) and
  `session()` (`''`, `'vr'`, `'ar'`). The probes shipped: `picks` (the explore pick's cost a frame: the story's `pickWith`
  timed by fixed expressions and put back; the caches themselves live inside the sets and are not read), `scene`
  (counts by set, lines and points among them), `loads` (`LOAD.ms`). Plans: `quick`, `dev`, `picking`.
- **The test's pretend headset** steps its session on the page's clock (`F.time = performance.now() - 1000 / 72` before
  each step): FPS_FAKE's own clock starts at 0, and a segment fed both clocks measured nonsense. A real session's frame
  times are the page's clock.

## 14. Script jobs (`--bench-scripts`, v232)

The owner, 28 November 2026, of trying a probe on the headset: "can also be uncommitted code if that makes things
faster". So the cloud can send a probe's body as text and try it at once, without committing and deploying it first.

**The step.** `{ cmd: 'script', code: '<text>', args: {...}, limit?: seconds }`. The code is the body of an async
function `(api, args)` that returns JSON. It runs through the probe's own path (`runProbe` in `bench.js`): the same
`api` object (section 10, and 13's `rays`, `session`), the same `args` copy, the same out (an object as it is, anything
else as `{ value }`, `log` lines added, at most 64 KB as every step) and the same error handling (`the script threw:
<message>`; a cancel or switch-off still stops the job). It is compiled with the `AsyncFunction` constructor as the
step starts (`the script does not compile: <message>`). Its time is the job's limit, or `limit` when given (`timed out
after <n> s`: the step fails, the page goes on with the next job). Only waits through `api` or other awaits are bounded:
a script that blocks the page's thread (an endless loop) hangs the page until the headset reloads it, as a probe would.

**Three switches.**

1. The relay: `--bench-scripts`, which needs `--bench` (else it refuses to start: *--bench-scripts is a part of the
   headset bench: give --bench with it*) and always the relay's password, on a loopback address too (*--bench-scripts
   needs the relay's password ...*). Without it a job holding a script step answers 403 *this relay runs no scripts: a
   script step needs a relay started with --bench-scripts*. `/api/ping` says `benchScripts: true|false` (with
   `bench: true`), `GET /api/bench` says `scripts`. A job `from: 'auto'` holding a script step is refused 400.
2. The page: `bench.js` runs a script step only while bench mode is on and not held (never in a shared room, never on
   the main site, never with developer mode off), and only after asking the relay it took the job from (`/api/ping`,
   fresh for every script step) and hearing `benchScripts: true`; else the step fails *scripts are off at this relay*.
3. The automatic plan: a plan in `bench/plans/` that a headset posts by itself after an update never runs a script
   step: the page refuses the whole plan (its report's `auto.err` says so) and the relay refuses one from `auto`.

**What the relay keeps and says.** The code is part of the job's record (in the 64 KB job limit), handed to the page by
`next` and given by `GET /api/bench/jobs/<id>` (behind the password, as everything). The listing gives each script step
as `{ i, bytes, sha }` (sha256, the first 12 hex digits), never the text; `bench.mjs show` and `jobs` print the same.
No log line holds the code (4.4).

**The trade-off.** With `--bench-scripts`, anyone holding the relay's password can run anything on a page in bench mode,
in the owner's home, with the page's own reach (its origin's storage and the relay's password kept there; not the
passthrough camera, which no page can read). That is why it is a second switch, always behind the password, and never on the main
site's relay; turn it on for the test place only while trying probes, and commit a probe once it works.
