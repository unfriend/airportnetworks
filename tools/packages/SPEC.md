# Story packages (step 2 of the packages plan): a story in one folder

The owner, 18 November 2026: colleagues and people the owner trusts may write their own stories; each is "all contained
within a folder and independent from the rest of the app"; they come in through git (pull requests, or a fork they host
themselves). Since v185 the app's own stories move into packages too (`docs/packages-migration.md`; the robot gang
first, all sixteen by v187): the same contract, plus `packages/order.json`, `icon` and `intro` below. Since v190 a
package carries its own miniatures (`minis`, "Miniatures" below).

A package is code from a trusted person running with the app's full rights (it is not a sandbox). Only the folder in git
(or on the host serving the app) is ever run: never anything from the relay's scenes, an upload or a link.

## The folder

```
packages/<key>/
  story.json      what the shell needs to list and load it (below)
  main.js         the story: HOST.register('<key>', function (HOST) { ... }), the same contract as stories/<key>.js
  icon.png        optional: its card's picture (square, at most 512 px, at most 200 KB)
  minis.js        optional (v190): its miniatures, built from src/minis.js ("Miniatures" below)
  audio/ data/ models/ ...   anything else it loads, by HOST.pkgUrl('<key>', 'data/x.bin')
  src/            optional: its sources and build (tools/packages/template is a start), served but never run
  README.md       who made it, what it shows, where its data comes from and the permission to show it
```

`<key>` is the folder's name: `^[a-z][a-z0-9-]{1,30}$`, never a key of `stories/list.js` (stories and `STORY_EXTRA`) and
never a word the address already uses (`s`, `t`, `explore`, `tab`, `scene`, `view`, `panels`, `slides`, `repeat`,
`anchor`, `labels`, `cards`, `free`, `subs`, `fps`, `body`, `hz`, `fov`, `scale`, `aq`, `walk`, `occl`, `sfx`, `voice`,
`sound`, `focus`, `dev`, `soundcheck`, `output`, `visit`, `scenes`, `net`, `now`, `camera`, `debug`, `peer`, `relay`,
`stories`, `all`, `lobby`, `experiments`). `node tools/packages/scan.mjs` reads this list from here.

### story.json

```json
{
  "key": "hello", "api": 1, "version": "1.0.0",
  "title": "Six handshakes", "kick": "Small worlds", "col": "#8fd3ff",
  "desc": "One sentence for its card.", "len": "Story 1:30",
  "page": "...", "brand": "...", "sub": "...", "aria": "...", "thing": "...", "loading": "...",
  "authors": "Name, Name", "life": false, "list": "stories", "minis": "minis.js", "icon": "hello.ring", "needs": 169
}
```

- `key` equals the folder's name. `api` is the Story API version it was written for (1 now; the shell refuses a package
  whose `api` is above its own `HOST.storyApi`). `version` is the package's own, free text.
- `title` ... `loading`, `len`, `life`: the same meaning as an entry of `stories/list.js` (its comment says each).
  `page` ... `loading` default from `title` and `kick` when left out.
- `list`: `"stories"` (default: on the Stories screen's main set of cards, after the app's own, and in Arrange all),
  `"experiments"` (v188: on the Experiments set of cards, which the main set's last card opens, page and headset; not
  in Arrange all; Add and an All stories circle take it) or `"hidden"` (opened only by its address `#<key>` or
  `HOST.go`, and listed on the Stories screen in developer mode).
- `needs` (optional): the oldest shell release it works with (`HOST.shell.n`); refused on an older shell, as a story.
- `minis` (optional, v190): the file of its miniatures, `minis.js` (a `.js` file of the folder; "Miniatures" below).
- `icon` (optional, v185): its stations' miniature in a shared room, a miniature's name `<key>.<set>`: one of its own
  (in its `minis` file: the usual case), or another package's or the shell's (`lowpoly.js`), which shows only where
  that one is listed (the cell stress test's `spatial.cell`; the check warns). The scan leaves out a package whose `icon`
  is in no such file. Without it its station has no miniature (the ring, the card and the plain glowing shape every key
  without one gets, in its colour). Its card on the page shows `icon.png` when the folder has one, else a plain tile in
  its colour (one of the app's own stories, named in `packages/order.json`, a story's card).
- `intro` (optional, `true` only, v185): an introduction, not one of the stories (the tutorial), as in `stories/list.js`.

## Miniatures (v190)

A package's sets in small: low-poly models, each at most 1,200 triangles, standing on the design room's table (every
listed package's, not the hidden ones) and, the one `icon` names, over its stations' rings in a shared room. Until v190
they were the shell's (`lowpoly.js`); now each story's are in its package, and adding a package with miniatures needs no
change to the shell, `tools/lowpoly/` or the design room.

- **The built file** (what the shell loads; `story.json`'s `minis`, `minis.js`): a classic script that adds entries to
  the global `LOWPOLY_MODELS` (`var LOWPOLY_MODELS = LOWPOLY_MODELS || {};`, then everything inside one function) and
  does nothing else when it runs. Each entry is `LOWPOLY_MODELS['<key>.<set>'] = { story: '<key>', set, name, shows, tris,
  build(THREE), card, icon }`: `build` returns a `THREE.Group` centred on x and z, standing on y = 0 and fitting a 1 x 1 x
  1 box (the caller scales it), with three.js r128 only; `tris` is its triangle count, exact; `card` (optional) is what
  the design room's card shows (`tools/design/SPEC.md`: `{ story, set, name, tris, id, shows, size, frame, params, views,
  reusedBy, reuses, file, manifest, note }`; without one the miniature is not on the table); `icon: true` on the one
  `story.json`'s `icon` names (a device without the package's entry in its index finds the icon by it). Every name
  starts with the package's key. It never needs the story's `main.js`: a station's icon shows for a story that is not
  loaded, and on a device whose list lacks it.
- **Its source** (the app's own packages, and the template's way): `src/minis.js`, a list of `def(...)` (kit b) or
  `add(...)` (kit a) calls with the helpers they need, and a line `// kit: a` or `// kit: b` naming the kit
  (`tools/lowpoly/kit-<x>.js`: the shapes, the materials and `def`, pasted before it). `node tools/lowpoly/build.mjs`
  builds every `packages/<key>/src/minis.js` (and the shell's `lowpoly.js` from `tools/lowpoly/shell.js`) into the file
  `minis` names, with each miniature's `card` from the catalogue (`src/props.json`: `{ "sets": [...] }` entries of
  `docs/props.md`'s shape, or `{ "handwritten": {...} }` for a hand-written story; a miniature with no entry gets a
  short card of its own name and shows) and `icon: true` from `story.json`. It builds each one with three.js in Node and
  fails on a wrong `tris`, more than 1,200, a name without the package's key or a missing field; `--check` says whether
  every file is current; `tools/engine/all.mjs` runs it too, and the relay's `--build` after a change to `src/minis.js`
  or `src/props.json`. A package may also ship a `minis.js` made another way (no source): the built file's contract is
  all the shell reads.
- **The harnesses** (`tools/lowpoly/harness-a.html`, `harness-b.html`, through `load.js`) put each source together as the
  build does, straight from `src/minis.js` (no build needed while editing; `?pkg=<key>` one package, `?built` the built
  files), and mark a miniature whose listed `tris` is wrong in red.
- **The shell**: `HOST.lowpoly(name)` loads the file that holds a miniature (`'<key>.<set>'` or a package's key: its
  `minis` file through `HOST.pkgUrl`, so a new version is fetched anew; the shell's own from `lowpoly.js`), each file
  once, by a script tag the shell owns; `HOST.lowpoly('*')` loads `lowpoly.js` and every listed package's (not hidden),
  each failure soft. A station's icon (shared.js, "station icons") asks for its file the first time it shows (again 30 s
  after a failure) and is the plain glowing shape in the story's colour until the file is here, then the miniature (built
  one a frame); every device that has the file shows the same one, from the same room keys (nothing about miniatures is
  in a room key). For a key this device does not list (*Not on this device*) it tries `packages/<key>/minis.js` and takes
  the entry marked `icon`, tinted in that card's grey; with no such file, the plain shape.
- **The design room** loads every listed package's file before it lays out its table (`HOST.lowpoly('*')`, at most 8 s;
  `takeCards`): each miniature with a `card` stands on its package's plate, the packages in the table's order before v190
  and any other after them in the index's order. `tools/design/props.json` keeps only the shell's own part of the
  catalogue (none yet).
- **Offline**: the service worker's install takes every listed package's `main.js` and its `minis` file; *Take all
  stories* takes every file of the package, the miniatures among them; the relay serves them as the rest of `packages/`.
- **The checks** (`tools/packages/check.mjs`): `minis` names a `.js` file of the package; every `add`/`def` name in it starts
  with `<key>.`; a package with `src/minis.js` names its `minis`; its own `icon` is one of its miniatures (another's is
  warned). With `--build` or `--load` (they run the package's code) it also builds each one with three.js in a Node
  sandbox: a field missing, a wrong `tris` or more than 1,200 fail, and `tools/lowpoly/build.mjs --check --only <key>`
  says whether the built file is current.
- **Names stay**: a miniature's name is `<key>.<set>` wherever it lives, so the design room's shared state (its moved
  miniatures, by name) and the stations' icons read the same before and after a story's miniatures moved.

## Discovery: packages/index.json

`node tools/packages/scan.mjs` writes `packages/index.json` from the folders (`--check` exits 1 when it is not current,
like the builds). It holds `{ "api": 1, "packages": [ { ...story.json, "fp": "<16 hex>", "files": { "<path>": "<16
hex>" } } ] }`, in `packages/order.json`'s order, then by key; `fp` is a hash of every file's own fingerprint (`files`), so a package's `fp` changes when
any of its files does. A folder whose `story.json` is missing or wrong, whose key is taken or reserved, or without
`main.js`, is left out with a line saying why (and `--check` fails while one is). `src/`, `README.md` and dot-files are
listed in `files` only if the story loads them (never: they are left out of `files`).

`bytes` (v185): the sum of its files' sizes, what taking it for offline use costs.

### The order: packages/order.json

Hand-written, `{ "order": [<key>, ...] }`: every one of the app's own stories in the Stories screen's order, moved into
a package or still in `stories/list.js` (the tutorial last). The scan copies it into the index (`order`) and lists its
packages first; `--check` fails on a key there that is neither a package nor a story of `stories/list.js`, and on a
story of `stories/list.js` it leaves out. The shell sorts `HOST.list` by it; the packages it names are the app's own
(`app: true` in their list entries), built by `tools/engine/all.mjs` and listed in `version.json`'s `packages`
(`tools/release.mjs`, which needs their `needs`). Other people's packages come after, by key.

## The shell

- `HOST.storyApi = 1`.
- At start, before the first story is chosen, the shell reads `packages/index.json` (`cache: 'no-store'`; a missing or
  bad file means no packages, quietly). Each package becomes an entry of `HOST.list` (after the app's own, `list:
  "stories"` only), of the Experiments set (`HOST.packages.experiments()`) or of the hidden packages (`HOST.meta(key)` finds both), with `pkg: true`, `base: 'packages/<key>/'`,
  `fp`, and `iconUrl` when it has `icon.png`. `HOST.listRev` changes when the list does. A hidden package shows on the
  page's Stories screen in developer mode (the headset's Stories screen is each story's own code and lists `HOST.list`
  only).
- `HOST.load(key)`: a package's file is `packages/<key>/main.js?v=<fp>`; everything else as for a story (fingerprint, the
  factory kept on failure). A package whose `api` is above `HOST.storyApi` or whose `needs` is above the shell's release is
  never loaded: its card says *Needs a newer version of the app*.
- `HOST.pkgUrl(key, path)` gives `packages/<key>/<path>?v=<the file's fp>` (plain `packages/<key>/<path>` for a file not in
  `files`): a package loads its data, models and narration through it (`HOST.audio.narration` takes that address).
- The Stories screen (page and headset) shows a package's card like a story's: on the page with `icon.png` or the plain
  tile; in the headset as every story's card there, which has no picture (`tools/engine/e6_panels.js`, `drawLandCard`).
  A refused package's length line says *Needs a newer version of the app* (so the headset's card says it too).
- `HOST.live` (a release taking over a running page) reads `packages/index.json` again with `stories/list.js`; a package
  whose `fp` changed is loaded fresh at its next start, exactly as a story whose file changed.

## The service worker

- `packages/` is fetched network first (`fresh`, checked with the server) and kept in a cache of its own,
  `networks-packages`, which a new `VERSION` does not clear (as `NARR`): a package changes without an app release, and a
  package opened once works offline. `packages/index.json` is never taken from the cache while the network answers.
  A file fetched fresh (`HOST.load`'s `&fresh=`) is kept at its address without `fresh` (v193), so it works offline too.
- So publishing a change to a package's files needs only the scan (and, for one of the app's own packages, named in
  `packages/order.json`, `node tools/release.mjs` with the same `VERSION`, for `version.json`'s entry); no new `VERSION`.
  `node tools/packages/publish.mjs <key> "<what changed>"` does it for a package's author (`docs/agents/packages.md`,
  "Publishing a package's change").
- A package's own narration (`packages/<key>/audio/*.mp3`) goes through the same rule as the rest of its folder, never
  the app's narration cache.

## The relay

`packages` is an app folder served deep, as `examples/` (`APP_DIRS`, `APP_DEEP`), with the app's own types. Its scenes
API, uploads and saves never write to `packages/`.

## Shared rooms

A package runs at a station like a story (its key is the station's story). Its `collab.state()` is its own business:
`FORMAT` is the app's and does not change for a package; a package changes the shape of its state only together with a
field `v` in it that its `apply()` checks (an older copy on another device ignores a state of another `v`). A device
whose `packages/index.json` lacks the station's package shows the station as *Not on this device* and does not run it.

## The rules a package keeps (checked by `node tools/packages/check.mjs packages/<key>`)

The story rules of `AGENTS.md` hold for a package as for a story. The check reads `story.json` and `main.js` and fails
on: a missing or wrong field; `main.js` not calling `HOST.register('<key>', ...)` with its own key; `new AudioContext` or
`webkitAudioContext` (sound is the shell's: `HOST.audio`); `new THREE.WebGLRenderer` (`HOST.makeRenderer`);
`location.href =`, `location.assign`, `location.replace`, `history.pushState` (stories never navigate); `HOST.start(`
(`HOST.go`); `buttons[4]` (the spaceship's boost); `eval(` or `new Function(` outside the engine's own `peek`; a fetch or
import of anything not on the app's own origin (`http://`, `https://`, `//` addresses in code); a file over 16 MB, or the
folder over 64 MB. It warns on a `main.js` over 4 MB and on a folder without `README.md`. With `--load` it also serves
the app, opens the package headless (as `tools/engine/same.mjs` does), waits for it to load, plays a moment, opens explore
mode and fails on any console error.

## Writing one

`tools/packages/template/` is a package's `src/` (its `minis.js` an example miniature: rename `yourkey`): copy it to
`packages/<key>/src/`, rename, and `node
packages/<key>/src/build.mjs` writes `packages/<key>/main.js` from the app's kit (`tools/engine/kit.js`), the shared engine
parts (`tools/engine/`) and its own sets and story, as the built stories are made (`docs/agents/stories.md`). The built
`main.js` holds everything it needs: the app's later changes to the engine reach a package only when its author builds it
again. `packages/hello/` is the example (on the Experiments set, or `#hello`).

A hand-written package is allowed too: `main.js` written by hand, no `src/` build (`src/` is optional; the checks are
the same, on `main.js` itself). The app's airports, proteins and spatial stories are such packages (v187, wrapped as they
were in `stories/`): edit `main.js`, then `node tools/packages/scan.mjs`. Their `src/` holds only their miniatures'
sources (`src/minis.js`, `src/props.json`: `node tools/lowpoly/build.mjs`).
