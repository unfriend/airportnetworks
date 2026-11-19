# Story packages

A story in one folder, `packages/<key>/`, written by a colleague or someone the owner trusts and brought in through git
(a pull request, or a fork they host themselves): the owner, 18 November 2026, "all contained within a folder and
independent from the rest of the app". The contract is `tools/packages/SPEC.md`; this file says how the app keeps it.
The app's own sixteen stories stay in `stories/<key>.js`; nothing here changes them.

A package is code from a trusted person running with the app's full rights: it is not a sandbox. Only the folder in git
(or on the host that serves the app) is ever run, never anything from the relay's scenes, an upload or a link.

## The folder

```
packages/index.json   the index (tools/packages/scan.mjs writes it; committed)
packages/<key>/
  story.json          what the shell needs to list and load it
  main.js             HOST.register('<key>', function (HOST) { ... }), the same contract as stories/<key>.js
  icon.png            optional: its card's picture (square, at most 512 px, at most 200 KB)
  audio/ data/ ...    anything else it loads, by HOST.pkgUrl('<key>', 'data/x.bin')
  src/                optional: its sources and build (served, never run)
  README.md           who made it, what it shows, its data and the permission to show it
```

`<key>` is the folder's name: `^[a-z][a-z0-9-]{1,30}$`, never a key of `stories/list.js` (`STORY_LIST` or
`STORY_EXTRA`) and never one of the words the address uses (the list in `SPEC.md`, which the scan reads: the shell's hash
words such as `dev`, `panels` and `s`, the studio's `scenes`, and `stories`, `all`, `lobby`, the landing page's and the
shared rooms' two circles).

`story.json` holds `key`, `api` (the Story API it was written for: 1), `title`, `kick`, `col`, `desc` (all needed), and
optionally `version`, `len`, `page`, `brand`, `sub`, `aria`, `thing`, `loading`, `authors`, `life`, `list` (`"stories"`,
the default, or `"hidden"`) and `needs` (the oldest shell release). Any other field is wrong, `icon` among them (its
picture is `icon.png`).

## The index: `tools/packages/scan.mjs`

`node tools/packages/scan.mjs` writes `packages/index.json`: `{ "api": 1, "packages": [ { ...story.json, "fp", "files" } ]
}`, sorted by key; `--check` writes nothing and exits 1 while the file is not current or a folder is left out (`--root
<dir>` for another copy). `files` maps each file's path in the folder to its fingerprint (index.html's `HOST.fingerprint`,
as `tools/release.mjs` takes a story's: a text file's text without a BOM, so `main.js`'s is the one `HOST.load` computes;
a binary file's bytes one character each); `fp` is the fingerprint of that list, so it changes when any file does. `src/`,
`README.md` (at the folder's top), dot-files and links are left out of `files`, and so is a file more than four folders
deep (the relay serves no deeper). A folder is left out, with a line saying why, when its `story.json` is missing, not
JSON, lacks a field or has a wrong one, its key differs from the folder's name, is taken or reserved, or it has no
`main.js`. With no packages the index is `{ "api": 1, "packages": [] }`, committed, so the app's fetch always finds it.

Run it after adding, changing or removing anything in a package (a package's author does, and commits the index with
the folder). `node tools/packages/check.mjs packages/<key>` checks a package's rules (`SPEC.md`, "The rules a package
keeps").

## The shell (`index.html`, `HOST.packages`)

- `HOST.storyApi = 1`. `HOST.packages` reads `packages/index.json` (`cache: 'no-store'`) as soon as the shell's script
  runs; the boot waits for it at most 0.8 s (`HOST.packages.ready(800)`) before it picks the first story, so `#<key>`
  opens a package and a slow or missing file does not hold the start. An index that comes later is still merged (its
  cards appear). A missing or bad file, or a bad entry, means no package (or no such package), quietly; on `file:` none.
- Each entry becomes a list entry with the fields of `stories/list.js` (`page`, `brand`, `sub`, `aria`, `thing`,
  `loading` defaulting from `title` and `kick`), plus `pkg: true`, `base: 'packages/<key>/'`, `fp`, `api`, `list`,
  `files` and `iconUrl` when the folder has `icon.png`. `list: "stories"` packages go into `HOST.list` after the app's own
  (`HOST.listRev` moves, the cards are drawn again); hidden ones only into `HOST.packages.hidden()`. `HOST.meta(key)`
  finds every package. An entry whose key is one of the app's own is ignored.
- `HOST.load(key)` loads a package's `packages/<key>/main.js?v=<fp>` (fresh: `&fresh=`), then everything as a story's:
  the fingerprint of its text in `HOST.fp`, the factory kept when a new file does not register. `HOST.packages.ran(key)`
  is the `fp` it last ran with; a fresh load of a package whose `main.js` is unchanged but whose `fp` moved runs again
  (its data's addresses changed).
- A package whose `api` is above `HOST.storyApi`, or whose `needs` is above the shell's release (`HOST.shell.n`, on a
  released shell), is never loaded (`refused: true`): its card's length line says *Needs a newer version of the app*
  (also on the headset's Stories screen, which draws `len`), and `HOST.start` says it on the bar and, with nothing on
  show, opens the Stories screen (a link to it lands there).
- `HOST.pkgUrl(key, path)` is `packages/<key>/<path>?v=<the file's fp>`, plain for a file the index does not list. A
  package loads its data, models and narration through it (`HOST.audio.narration` takes any address).
- The Stories screen on the page: a package's card is a story's card with a picture at its top right, `icon.png` or a
  plain tile in its colour; its text is escaped. In developer mode (`HOST.dev`) the hidden packages follow the list,
  dashed and marked *hidden package*; switching developer mode draws the cards again.
- The headset's Stories screen is each story's own code (`tools/engine/e6_panels.js`, `drawLandCard`): it reads
  `HOST.list` and draws kick, title, description, length and colour, so a listed package's card is there like a story's
  (no picture: no story card has one in the headset), a refused one says so in its length line, and hidden packages are
  not on it (open them by address or `HOST.go`).
- `HOST.live`: every check (about once a minute, on coming back into view, after a new service worker) reads the index
  again too, and so does every reading of `stories/list.js` (`reread`: the relay's `--watch` `list` and reconnects).
  `take` keeps the listed packages after the app's own. A package already run here whose `fp` changed is taken as a
  story file that changed (`HOST.live.changed`): on show, swapped in place at a quiet moment; otherwise fetched fresh at
  its next start. A package on show that left the index keeps its entry until another story starts. The page's
  `listFp` (compared with `version.json`'s `list`) leaves the packages out.

## The service worker (`sw.js`)

Packages are not in `SHELL`. Anything under `packages/` is fetched network first (`fresh`, `cache: 'no-cache'`) and kept
in a cache of its own, `networks-packages` (`PKG`), which a new `VERSION` does not clear (as `NARR`): a package changes
without an app release, and one opened once works offline. The rule comes before the narration's, so a package's
`audio/narration*.mp3` is never taken for (or cached as) the app's. `packages/index.json` is the server's whenever the
network answers, however slowly (`cache: 'no-store'`; the cached copy only offline). A byte range (the audio element) is
fetched from the network, or offline cut from the cached whole file. Old packages' files stay in `PKG` until the browser
clears it.

## The relay (`relay/server.mjs`)

`packages` is in `APP_DIRS` and `APP_DEEP`: served as `examples/` is, `packages/<key>/<at most 4 folders>/<file>`, with
the app's types; `packages/index.json` with `Cache-Control: no-store`, everything else `no-cache`. No endpoint writes
there: the relay refuses to start with a `--scenes` folder at, inside or above the app's `packages/` (this copy's or the
one `--static` serves), so no save or upload can reach a package.

## Shared rooms

A listed package is a story to the shared rooms: Arrange all and the station picker take it (both read `HOST.list`). A
package runs at a station like a story. Its station has no miniature (no `icon` field): the stations' icon falls back to
the plain glowing shape every key without one gets (shared.js, `fallbackDef`), with its colour. Its `collab.state()` is
its own: `FORMAT` is the app's and does not change for a package; a package changes the shape of its state only together
with a field `v` that its `apply()` checks. A device whose index lacks a station's package (or that runs an older copy of
the app) gets `HOST.unknown`'s stand-in: the station's card says *Not on this device* (title *Another story*) and the
story never runs there; `HOST.live.missing` reads the index and `version.json` again, starts it if it has come, and asks
for an update only when the latest release has that key (a package no update brings is not asked about). `shared.js` is
unchanged for packages.

## The rules a package keeps

The story rules of `AGENTS.md` hold for a package as for a story: `HOST.makeRenderer`, `HOST.go`, sound only through
`HOST.audio`, never navigating, never reading A or X, `dispose()` clearing its timers, the shared hooks. `SPEC.md`, "The
rules a package keeps", lists what `tools/packages/check.mjs` fails on.

## Writing one

`SPEC.md`, "Writing one": `tools/packages/template/` is a package's `src/`, built into `main.js` from the app's kit and
engine parts as the built stories are; `packages/hello/` is the example (hidden: developer mode, or `#hello`).
