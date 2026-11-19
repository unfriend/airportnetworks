# Story packages (step 2 of the packages plan): a story in one folder

The owner, 18 November 2026: colleagues and people the owner trusts may write their own stories; each is "all contained
within a folder and independent from the rest of the app"; they come in through git (pull requests, or a fork they host
themselves). The app's own sixteen stories stay where they are (`stories/<key>.js`); nothing here changes them.

A package is code from a trusted person running with the app's full rights (it is not a sandbox). Only the folder in git
(or on the host serving the app) is ever run: never anything from the relay's scenes, an upload or a link.

## The folder

```
packages/<key>/
  story.json      what the shell needs to list and load it (below)
  main.js         the story: HOST.register('<key>', function (HOST) { ... }), the same contract as stories/<key>.js
  icon.png        optional: its card's picture (square, at most 512 px, at most 200 KB)
  audio/ data/ models/ ...   anything else it loads, by HOST.pkgUrl('<key>', 'data/x.bin')
  src/            optional: its sources and build (tools/packages/template is a start), served but never run
  README.md       who made it, what it shows, where its data comes from and the permission to show it
```

`<key>` is the folder's name: `^[a-z][a-z0-9-]{1,30}$`, never a key of `stories/list.js` (stories and `STORY_EXTRA`) and
never a word the address already uses (`s`, `t`, `explore`, `tab`, `scene`, `view`, `panels`, `slides`, `repeat`,
`anchor`, `labels`, `cards`, `free`, `subs`, `fps`, `body`, `hz`, `fov`, `scale`, `aq`, `walk`, `occl`, `sfx`, `voice`,
`sound`, `focus`, `dev`, `soundcheck`, `output`, `visit`, `scenes`, `net`, `now`, `camera`, `debug`, `peer`, `relay`,
`stories`, `all`, `lobby`). `node tools/packages/scan.mjs` reads this list from here.

### story.json

```json
{
  "key": "hello", "api": 1, "version": "1.0.0",
  "title": "Six handshakes", "kick": "Small worlds", "col": "#8fd3ff",
  "desc": "One sentence for its card.", "len": "Story 1:30",
  "page": "...", "brand": "...", "sub": "...", "aria": "...", "thing": "...", "loading": "...",
  "authors": "Name, Name", "life": false, "list": "stories", "needs": 168
}
```

- `key` equals the folder's name. `api` is the Story API version it was written for (1 now; the shell refuses a package
  whose `api` is above its own `HOST.storyApi`). `version` is the package's own, free text.
- `title` ... `loading`, `len`, `life`: the same meaning as an entry of `stories/list.js` (its comment says each).
  `page` ... `loading` default from `title` and `kick` when left out.
- `list`: `"stories"` (default: on the Stories screen after the app's own, and in Arrange all) or `"hidden"` (opened only
  by its address `#<key>` or `HOST.go`, and listed on the Stories screen in developer mode).
- `needs` (optional): the oldest shell release it works with (`HOST.shell.n`); refused on an older shell, as a story.
- No `icon` field: its card shows `icon.png` when the folder has one, else a plain tile in its colour; in a shared room
  its station has no miniature (the ring, the card and the plain glowing shape every key without one gets, in its colour).

## Discovery: packages/index.json

`node tools/packages/scan.mjs` writes `packages/index.json` from the folders (`--check` exits 1 when it is not current,
like the builds). It holds `{ "api": 1, "packages": [ { ...story.json, "fp": "<16 hex>", "files": { "<path>": "<16
hex>" } } ] }`, sorted by key; `fp` is a hash of every file's own fingerprint (`files`), so a package's `fp` changes when
any of its files does. A folder whose `story.json` is missing or wrong, whose key is taken or reserved, or without
`main.js`, is left out with a line saying why (and `--check` fails while one is). `src/`, `README.md` and dot-files are
listed in `files` only if the story loads them (never: they are left out of `files`).

## The shell

- `HOST.storyApi = 1`.
- At start, before the first story is chosen, the shell reads `packages/index.json` (`cache: 'no-store'`; a missing or
  bad file means no packages, quietly). Each package becomes an entry of `HOST.list` (after the app's own, `list:
  "stories"` only) or of the hidden packages (`HOST.meta(key)` finds both), with `pkg: true`, `base: 'packages/<key>/'`,
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

`tools/packages/template/` is a package's `src/`: copy it to `packages/<key>/src/`, rename, and `node
packages/<key>/src/build.mjs` writes `packages/<key>/main.js` from the app's kit (`tools/lbi/kit.js`), the shared engine
parts (`tools/engine/`) and its own sets and story, as the built stories are made (`docs/agents/stories.md`). The built
`main.js` holds everything it needs: the app's later changes to the engine reach a package only when its author builds it
again. `packages/hello/` is the example (hidden: developer mode, or `#hello`).
