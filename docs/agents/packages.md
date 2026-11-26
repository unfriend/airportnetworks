# Story packages

A story in one folder, `packages/<key>/`, written by a colleague or someone the owner trusts and brought in through git
(a pull request, or a fork they host themselves): the owner, 18 November 2026, "all contained within a folder and
independent from the rest of the app". The contract is `tools/packages/SPEC.md`; this file says how the app keeps it.
Since v187 the app's own stories (sixteen then; twenty in `packages/order.json` now, with the Experiments set's `cellstress`
and `hello` beside them, `packages/index.json` lists 22 packages) are packages too (`docs/packages-migration.md`);
only the design room and the studio stay in `stories/`.

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
the default; `"experiments"`, v188: on the Experiments set of cards, `HOST.menu`; or `"hidden"`) and `needs` (the oldest shell release). Any other field is wrong, `icon` among them (its
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
  runs. The boot waits for it only when the address names something that is not one of the app's own (`#<key>` of a
  package: at most 4 s, `HOST.packages.ready(4000)`); an ordinary start never waits, and a slow or missing file does not
  hold the start. An index that comes later is still merged (its
  cards appear). A missing or bad file, or a bad entry, means no package (or no such package), quietly; on `file:` none.
- Each entry becomes a list entry with the fields of `stories/list.js` (`page`, `brand`, `sub`, `aria`, `thing`,
  `loading` defaulting from `title` and `kick`), plus `pkg: true`, `base: 'packages/<key>/'`, `fp`, `api`, `list`,
  `files` and `iconUrl` when the folder has `icon.png`. `list: "stories"` packages go into `HOST.list` after the app's own
  (`HOST.listRev` moves, the cards are drawn again); `list: "experiments"` ones into `HOST.packages.experiments()` (the
  Experiments set of cards, in the index's order: `HOST.menu`, `docs/agents/shell.md`); hidden ones only into
  `HOST.packages.hidden()`. `HOST.meta(key)`
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
  `HOST.menu.cards()` (the set on show; `HOST.list` on a shell without it) and draws kick, title, description, length and colour, so a listed package's card is there like a story's
  (no picture: no story card has one in the headset), a refused one says so in its length line, and hidden packages are
  not on it (open them by address or `HOST.go`).
- `HOST.live`: every check (about once a minute, on coming back into view, after a new service worker) reads the index
  again too, and so does every reading of `stories/list.js` (`reread`: the relay's `--watch` `list` and reconnects).
  `take` keeps the listed packages after the app's own. A package already run here whose `fp` changed is taken as a
  story file that changed (`HOST.live.changed`): on show, swapped in place at a quiet moment; otherwise fetched fresh at
  its next start. A package on show that left the index keeps its entry until another story starts. The page's
  `listFp` (compared with `version.json`'s `list`) leaves the packages out.

## The service worker (`sw.js`)

Packages are not in `SHELL`. Anything under `packages/` is fetched network first (`cache: 'no-cache'`; after 4 s
without an answer a cached copy of the same address, version included) and kept, under its whole address with its
`?v=<fp>` (storing one version drops that file's others, so a slow network never gets an older file for a newer
address), in a cache of its own, `networks-packages` (`PKG`), which a new `VERSION` does not clear (as `NARR`): a package changes
without an app release, and one opened once works offline. The rule comes before the narration's, so a package's
`audio/narration*.mp3` is never taken for (or cached as) the app's. `packages/index.json` is the server's whenever the
network answers, however slowly (`cache: 'no-store'`; the cached copy only offline). A byte range (the audio element) is
fetched from the network, or offline cut from the cached whole file. Old packages' files stay in `PKG` until the browser
clears it. A fresh fetch (`HOST.load`'s `&fresh=<time>`: a package that changed while the page ran) is kept without its
`fresh`, at the address an offline start asks for, and never answered from the cache while the network is slow (v193:
it was kept under its one-off address, dropping the real one's copy, so the package had no offline copy until the app
was opened again).

**At install (v185)** the worker also takes every listed package's `main.js` (`takeMains`: the index read, each
`main.js?v=<the package's fp>`, never failing the install), as `SHELL` takes each `stories/<key>.js`, so an installed
copy opens every story offline, moved into a package or not.

**Take all stories (v185, `takeAll`; the page's `HOST.offline`).** A page posts `{ type: 'take', hidden }`; the worker
reads the index and takes every file of every listed package (hidden ones too in developer mode) into `PKG` at the
address the app asks for (`main.js` with the package's fp, the rest with their own: `pkgAddr`), and every narration
still in `audio/` (`AUDIO`) into `NARR`; files already held are passed by, so a take broken off (the browser stopped the
worker) carries on where it was, and a changed package takes only its changed files. First the room: what is missing
(the index's `bytes`, a narration's `Content-Length`) and a fifth more against `navigator.storage.estimate()`; too
little says so (`state: 'full'`). Two files at a time, each tried twice; progress `{ type: 'take', state: 'run' | 'done'
| 'full' | 'off', done, total, bytes, need, failed }` to every page. The page: a *Take all stories* button in the
Stories screen's row (its label the progress), `navigator.storage.persist()` asked on a press; automatic 20 s after the
start on an installed app (standalone display) or a device that took them once (`localStorage.pkgAll`), and 3 s after
`appinstalled`; asked again when a take stops moving for 45 s and whenever the packages' index changes. The headset
menu has no row yet (an installed app takes them by itself; Quest Browser's page has the button).

## The relay (`relay/server.mjs`)

`--watch` (v185) follows `packages/` too: a package's `main.js` is told as a story (`story { key, fp }`, swapped in
place), `packages/index.json` as the list; with `--build`, a change under `packages/<key>/src/` runs its
`src/build.mjs` (and a shared source of `tools/` it names, as `'../<dir>/'` or `tools/<dir>/`), then the scan.

`packages` is in `APP_DIRS` and `APP_DEEP`: served as `examples/` is, `packages/<key>/<at most 4 folders>/<file>`, with
the app's types; `packages/index.json` with `Cache-Control: no-store`, everything else `no-cache`. No endpoint writes
there: the relay refuses to start with a `--scenes` folder at, inside or above the app's `packages/` (this copy's or the
one `--static` serves), so no save or upload can reach a package.

## Shared rooms

A listed package is a story to the shared rooms: Arrange all and the station picker take it (both read `HOST.list`). A
package runs at a station like a story. Its station's icon is the miniature its `story.json` names (`icon`, from its own
`minis.js` since v190: `tools/packages/SPEC.md`, "Miniatures"), loaded when the icon first shows; until then, and with
no `icon`, the plain glowing shape every key without one gets (shared.js, `fallbackDef`), in its colour. A device whose
index lacks the package tries its `minis.js` all the same and shows the miniature marked `icon` there. Its `collab.state()` is
its own: `FORMAT` is the app's and does not change for a package; a package changes the shape of its state only together
with a field `v` that its `apply()` checks. A device whose index lacks a station's package (or that runs an older copy of
the app) gets `HOST.unknown`'s stand-in: the station's card says *Not on this device* (title *Another story*) and the
story never runs there; `HOST.live.missing` reads the index and `version.json` again, starts it if it has come, and asks
for an update only when the latest release has that key (a package no update brings is not asked about). `shared.js` is
unchanged for packages.

## Miniatures (v190)

A package's miniatures are its own (`tools/packages/SPEC.md`, "Miniatures"): `src/minis.js` (a kit's `def`/`add` calls,
`// kit: a|b`) and `src/props.json` (the design room's cards), built by `node tools/lowpoly/build.mjs` into the file
`story.json`'s `minis` names (`minis.js`, listed in the index like any file; `icon` names the station's). The shell's
`HOST.lowpoly(name)` loads the file that holds a miniature (`index.html`, after `HOST.pkgUrl`), `HOST.lowpoly('*')`
every listed package's and `lowpoly.js` (the shell's own four: the design room's, the studio's and the two circles'
icons); `shared.js`'s station icons ask for theirs and show the plain shape until it comes; the design room loads them
all before laying out its table (`takeCards`, `TABLE_ORDER`). The scan leaves out a package whose `icon` is in no file;
the check fails on a name without the package's key and, with `--build`/`--load`, on a wrong `tris` or more than 1,200;
the harnesses (`tools/lowpoly/harness-a.html`, `harness-b.html`, `load.js`) show the sources as they are edited. The
service worker's install takes each listed package's `minis` file with its `main.js`. Every story's miniatures moved
there in v190 (names unchanged); `packages/hello/` and `tools/packages/template/minis.js` show how.

## The rules a package keeps

The story rules of `AGENTS.md` hold for a package as for a story: `HOST.makeRenderer`, `HOST.go`, sound only through
`HOST.audio`, never navigating, never reading A or X, `dispose()` clearing its timers, the shared hooks. `SPEC.md`, "The
rules a package keeps", lists what `tools/packages/check.mjs` fails on.

## The app's own stories as packages (v185)

The plan and its decided route: `docs/packages-migration.md`. What is in place:

- `packages/order.json` (hand-written) orders every story, moved or not (`tools/packages/SPEC.md`, "The order"); the
  shell sorts `HOST.list` by the index's copy and waits 1.5 s at most for the index when no story is named (the first
  screen's cards). Its packages are `app: true` (a story's card, not a package's tile), take `icon` (since v190 one of
  their own miniatures, `minis`: their stations keep theirs, by the same name) and `intro`.
- `tools/stories.mjs` is how every test and tool finds a story's file, sources, build and narrations (smoke's
  `STORY_KEYS` from `HOST.list`, collab's `STORIES`, narration, pace, the voice tools, sfx-render, the relay test).
- `tools/release.mjs` writes `packages: { <key>: { fp, needs } }` into `version.json` for the moved ones (each needs
  `needs`: the release that moved it, so an older shell refuses it and `HOST.live` asks for the reload), accepts a
  shrinking `STORY_LIST` and runs the scan's `--check` in its own. `tools/engine/all.mjs` builds them too.
- **Moving one:** `node tools/packages/move.mjs <key> [--needs <n>] [--dry]` (a built story; the tree clean): `git mv`
  of `tools/<key>/` to `packages/<key>/src/` and of `stories/<key>.js` to `packages/<key>/main.js`, its build patched
  (parts and shared sources from `tools/`, the target), its narration(s) to `packages/<key>/audio/narration[-<lang>].mp3`
  with `narrationFile()` through `HOST.pkgUrl`, `story.json` from its list entry, a `README.md`, its entry out of
  `stories/list.js`, `.gitignore`'s and `props.json`'s paths; then it builds, compares the new `main.js` with the old
  built file (only the lines naming the narration or the folders may differ) and runs the scan and the design room's
  build. Then by hand: the `VERSION` bump and the release, `node tools/narration.mjs <url>`, the story's docs.
- **Its readers** (v187): when a story whose sources others read moves (lbi: body, tissue, web; micro: organs; nmd:
  motor and data; topo: look), every other source folder whose `build.mjs` or `harness.html` reads it by path follows:
  `'../<key>/'` becomes `'../../packages/<key>/src/'` (from `tools/<dir>/` and, through a moved build's `src()`, from
  `packages/<dir>/src/` alike), a moved harness's `'../../../tools/<key>/'` becomes `'../../../packages/<key>/src/'`, the
  reader's notes name the new place, and the readers are built again. The relay's `--build` maps each build to the
  packages whose sources it names (`packages/<key>/src/`), so a change there rebuilds its readers too;
  `tools/engine/all.mjs` builds every one.
- **Wrapping a hand-written story** (v187: airports, proteins, spatial): the same command, for a story with no
  `tools/<key>/build.mjs`. Its file moves as it is to `packages/<key>/main.js` (it is its own source: no `src/`, no build),
  its narration to `packages/<key>/audio/narration.mp3` (the airports' `audio/narration.mp3` too) and its
  `HOST.audio.narration(...)` literal through `HOST.pkgUrl`; every source folder that names `stories/<key>.js` (the pass
  story's `ORIGINALS`, the tour's data scripts) names the new place and is built again.
- The robot gang (`packages/robots/`) moved first (v185), eight more in v186, the last eight in v187; the design room
  and the studio stay in the shell. `stories/list.js`'s `STORY_LIST` is empty (old shells read the file); `index.html`
  loads it as `stories/list.js?v=<its fingerprint>` (stamped by `tools/release.mjs`), so a browser's ten-minute copy never
  gives a new page an old list naming stories that have moved.

## Publishing a package's change (v193: `tools/packages/publish.mjs`)

**What a change to a package's files alone needs** (found from the code and checked headless, v193). Not a new
`VERSION`: the new fingerprint in `packages/index.json` reaches everything, and `tools/release.mjs --check` asks only that
`version.json`'s entry for the package follows it.

- *Running pages and headsets*: `HOST.live.check` (about once a minute, when the page comes back into view, when a new
  worker takes over) reads `packages/index.json` again (`HOST.packages.read`, `no-store`) whatever `version.json` says; a
  package already run here whose `fp` changed is `HOST.live.changed`: on show, swapped at a quiet moment (in a headset:
  the Stories screen, away from every station, or the menu open); otherwise fetched fresh at its next start. Its files'
  addresses carry their fingerprints (`main.js?v=<fp>`, `HOST.pkgUrl`), so no browser or host cache serves an old one.
  `version.json`'s `packages` are read only by `HOST.live.missing` (a room's station of a story this copy lacks).
- *Installed copies*: `sw.js` does not change, so no new worker installs; package files are network first in their own
  cache (`networks-packages`), so online they get the new files; offline they run the version they last opened (since
  v193 also one fetched fresh: "The service worker" above). A device that took all stories takes the changed files when
  the index changes (`HOST.offline.again`).
- *`tools/release.mjs`*: run with the same `VERSION`, it rewrites only `version.json`'s `packages.<key>.fp` (the shell's
  id and `n` unchanged, `whatsnew.json` still naming this release); `--check` then passes. So `whatsnew.json` and
  `whatsnew/` do not move; the change is described in its commit, and the next app release's box can mention it.
- A package whose change needs a newer shell (its `story.json` `needs` raised, or code calling something the shell
  lacks) is not a package-only change: that is a release, the maintainer's.
- Checked by a headless test (a copy served like GitHub Pages, a page under the service worker; `packages/flock/main.js`
  changed and only the scan run): the page read the new fingerprint, ran the new file at its next start with no new
  worker, and (after the v193 fix) opened it offline after a reload; `release.mjs` with the same `VERSION` then made
  `--check` pass. `tools/live.mjs`'s "changed story" rounds do the same without a `VERSION` bump.

**The command** (for a story's author; her guide is `docs/working-on-a-story.md`):

```sh
node tools/packages/publish.mjs <key> "<what changed, one sentence>" [--test "<what to try>"] [--dry] [--allow-other]
```

In order, stopping with a plain sentence at the first problem:

1. Refuses when not on `dev`, in an unfinished merge, for a key that is not a folder of `packages/` with a `story.json`,
   or when tracked files outside `packages/<key>/` are changed, in the working tree or in commits not yet on GitHub
   (listed; `--allow-other` lets them through and commits them too). Allowed besides the package: what the command
   writes (`packages/index.json`, `version.json`, the built files of the builds that read its sources). New untracked
   files outside the package are left alone, never committed.
2. `git fetch origin dev` (a dry run goes on without GitHub).
3. Builds `packages/<key>/src/build.mjs` (none: `main.js` is hand-written), the miniatures (`tools/lowpoly/build.mjs
   --only <key>`) when `src/minis.js` or `src/props.json` changed, every build that names `packages/<key>/src/` (as the
   relay's `--build` finds readers); runs `src/test-*.mjs`; `node --check` on the built files; the scan (stops if it left
   the package out); `node tools/release.mjs` with the same `VERSION` (if it would also write `index.html`, `sw.js` or
   `whatsnew/`, the app has unreleased changes: put back, and stops); then the build's, the scan's and the release's
   `--check`, and `tools/packages/check.mjs packages/<key>` (with `--load` when Playwright with Chromium is there; else
   says it skipped that).
4. The spoken words, for a package with `audio/narration*.mp3`: when its text source (`src/engine/e3_story.js`, else
   `main.js`) changed, it opens the story headless twice (its `main.js` at the commit that last changed `audio/`, then
   now; a server of its own, no service worker) and compares each cue's voice line (`data-say`, else its text; small
   print left out). Changed lines are listed with how to record again (`tools/voice/narrate.mjs <key>`, then
   `check.mjs <key> --quick`; Kokoro, `tools/voice/README.md`) or to ask the maintainer. It never fails the run. Without
   Playwright it says only that the text source changed.
5. Commits what changed in the package and the generated files (`<key>: <sentence>`; body: *To try:* the `--test`
   sentence or *Open <title> and check the change.*, *Untested: not tried on a headset.*, and the release line: the
   package's fp, no app release). If GitHub's `dev` moved on, merges it (`git merge --no-edit origin/dev`): a conflict
   only in generated files (`packages/index.json`, `version.json`, `whatsnew*`, a built `main.js`/`minis.js`,
   `lowpoly.js`, `stories/design.js`/`studio.js`; `sw.js` and `index.html` only when nothing but `VERSION` or the
   stamps differ) takes GitHub's copy and builds again; a conflict in a source file runs `git merge --abort` and stops,
   the commit kept. Then `git push -u origin dev`, never forced; a rejected push fetches, merges, builds and pushes once
   more. Prints `https://stories.lab.lbi-netmed.com/#<key>` and that the site takes a minute or two.
6. `--dry`: steps 1 to 4, then says what a real run would commit and writes back every file it changed (it never
   deletes: a file it made is named instead).

Her work is committed before the merge (not merged first, as one might expect), so a conflict never touches her
uncommitted edits. Tested (v193) with `--dry` on cdk5 after a one-word change to a spoken line (the line found, the
files put back), and in throw-away clones of a bare copy: a clean publish, a publish behind GitHub with a conflict only in
`packages/index.json` and `version.json` (taken, rebuilt, pushed; every `--check` passing after), a conflict in
`e3_story.js` (stopped, merge aborted, commit kept), nothing to publish; the refusals (a changed `sw.js`, a wrong key,
another branch, no sentence). Not tried on Windows or macOS; the push's access is the owner's to give (GitHub).

**The preview while editing** (hot reload): `node relay/server.mjs --static . --watch --build`, then
`http://localhost:8787/#<key>`. A save in `packages/<key>/src/` builds the story (well under a second for cdk5), the
scan runs, and every page showing it swaps it in place within about a second or two (story time and explore state
kept); a shell file reloads the page. Checked for cdk5 (v193): a source saved, swapped in place without a reload. On
Linux, Node's recursive `fs.watch` stops seeing a file once an editor has saved it by replacing it (write a copy, then
rename, as some editors and tools do): a second save of that file is then missed; restart the relay. macOS and Windows
watch natively. In a headset on the same network: `--lan` (HTTPS, `docs/agents/shell.md`).

## Writing one

`SPEC.md`, "Writing one": `tools/packages/template/` is a package's `src/`, built into `main.js` from the app's kit and
engine parts as the built stories are; `packages/hello/` is the example (hidden: developer mode, or `#hello`).

Protein models (`tools/mol/`, `README.md` there): a package's `src/models.json`, built by
`~/molenv/bin/python tools/mol/build.py packages/<key>/src/models.json packages/<key>/models` into `models/` (`.mol`
files and `index.json`, fingerprinted by the scan like any file), loaded with `molReady(f => pkgUrl('models/' + f),
[...])` in a set's `prep` and drawn by `molMesh` / `molInstanced` (the parts `MOLS molLoad molParse molMaterial molMesh
molInstanced` on the package's `e2_scene.js` `//#use` line). Credit each entry and its paper where it is shown.

### The template (`tools/packages/template/`)

Copy it to `packages/<key>/src/`, write `packages/<key>/story.json` and `README.md`, then `node
packages/<key>/src/build.mjs` (its `README.md` says each step). It holds:

- `build.mjs`: finds the app's folder by walking up from its own (`fileURLToPath`, to the first folder holding
  `tools/engine/parts.mjs`; `--root <dir>` for a copy outside it), takes the key from `../story.json` (it must be the
  folder's name; the template itself, without one, says to copy it first), reads the kit (`tools/engine/kit.js`, its Node
  export cut as `packages/flock/src/build.mjs` does), pastes the sets (`SET_FILES`, each one's Node export line `if (typeof
  module !== 'undefined') module.exports = ...` cut, so a helper can be tested with `node`), expands the engine files'
  `//#use` lines with `tools/engine/parts.mjs`'s `expand`, puts the key where `e1_head.js` says `@@KEY@@`, and writes
  `../main.js`; `--check` exits 1 when `main.js` is not what it makes. It is not a `tools/<dir>/build.mjs`, so neither
  `tools/engine/all.mjs` nor the relay's `--build` runs it: a package takes the app's engine changes only when its author
  builds it again.
- `engine/e1_head.js` ... `e7_app.js`: the engine of the newest built stories (copied from the qubits story's choices:
  not life size, the shared `frame`, the shared headset code whole) with a small story's own constants and hooks in the
  template's own files (`docs/agents/stories.md`, "Shared engine parts"): `KEY`, `pkgUrl(file)` (`HOST.pkgUrl(KEY,
  file)`) and `pkgMeta()` (the index's entry) in `e1_head.js`; `SET_ORDER`, `STRIP_FIT` and the shared `FRAME` in
  `e2_scene.js`; `CH`, `NARRATION_SYNC` (no recording: the story's own clock, `[[0, 0], [end, end]]`), `FIT` (none),
  `NARROW`, `MORPH` and `buildStory` in `e3_story.js`; one tab (`scenes`: each set's controls as chips), `X`, `STEP`,
  `CAM_ALIAS`, `exploreTargets`, `ctlSound`, the shared state `{ v: 1, tab, scene, ctl }` (`COLLAB_V`, which `collabApply`
  checks), `buildExplore`, `renderScenes` and the picking hooks (nothing to pick) in `e4_explore.js`; `XR_HERE = KEY`,
  `XR_TITLE` (story.json's title), `sigMainS`, `sigMainX`, `drawTabPane` and `drawScenesPane` in `e6_panels.js`; `APP`
  (entering explore mode from the story's moment, as qubits does), `frameLife` and the others off, `initEnd` (a link's
  `&explore&scene=&<control>=&tab=&now`) and the returned contract in `e7_app.js`. `e5_xr.js` is all shared parts.
- Narration: none by default (`AUD` stays null, as in the design room). `narrationFile()` is
  `pkgUrl('audio/narration.mp3')`, and `audioInit` starts it only when the index lists that file for the package
  (`pkgMeta().files`), so a package without one never asks for it (no 404).
- `sets/orb.js`: a small set to replace (points that gather into a ball, a lit core, two controls).

Built as it is (`story.json` with the key `tmpl`), the template loads, plays and explores without errors (checked with
`check.mjs --load --phone` on a copy outside the tree).

### The example (`packages/hello/`)

*Six handshakes* (kick *Small worlds*, `list: "experiments"` since v188 (was `"hidden"`), `needs` the shell release in `index.html`'s `HOST.shell.n`
when it was made, 166): 60 people on a ring, each knowing their four nearest; a few links rewired at random (seeded)
make everyone close while the ring still looks local (Watts and Strogatz, Nature 1998). About a minute and a half in
four chapters (*Ring*, *Far*, *Shortcuts*, *Small world*), captions only, then explore mode with one tab (*Network*).
`src/` is the template with:

- `sets/net.js`: `HELLO`, the network and its numbers: the links in Watts and Strogatz's order, each with its own seeded
  draw `u` and new far end `t`, rewired when `u < p`, so raising `p` only adds shortcuts; the rewiring level (0 to 1,
  what the story keys and eases) gives `p = (1000^level - 1) / 999`; `stats(p)` (average handshakes over linked pairs,
  the most, pairs apart, the clustering coefficient, shortcuts), `path(p, a, b)` (breadth first, friends in order, the
  same on every device), `pos(i)` and `arc(i, j, n)` (a ring link a chord, a shortcut an arch over the ring). Testable
  with `node` (`require('./packages/hello/src/sets/net.js')`).
- `sets/ring.js`: the people (instanced balls with a glow), every link's ring chord and shortcut arch drawn at once (each
  link's alpha follows how far the level has passed its own, the chord fading as the arch grows: the network on show
  flips at the half), and the counter (a stack of discs as high as the average handshakes, a label over it). Params
  `ring_people`, `ring_links`, `ring_rw`, `ring_count`; controls `rw` (None, 1 %, 5 %, 10 %, 30 %, All) and `view`;
  `api().pick(rc)` (the person nearest a ray).
- `sets/path.js`: the chain from A to B on the network the ring shows (it reads `ring_rw`), hop by hop as `path_show`
  grows, A and B ringed and labelled; drawn in the ring's frame (`FRAME = { path: 'ring' }`).
- The story's numbers (`FACTS`: none, a few shortcuts at `p = 0.05`, all) and explore mode's are computed from `HELLO`
  as the page runs ("in this example"). Explore mode: the rewiring chips, two people picked on the ring (click, or point
  and press in a headset: the first is A, the next B, a third starts again; *Across the ring*, *Clear*), the numbers,
  the view; its headset twin is `drawNetworkPane`. Shared state `{ v: 1, tab, scene, ctl, a, b }`. Its address:
  `#hello&explore&rw=0.1&a=1&b=31&view=top`.
- `icon.png`: the ring from above with two shortcuts and the chain, rendered headless (the page's canvas only, 256 px,
  about 40 KB).

### The cell stress test (`packages/cellstress/`)

*Cell stress test* (kick *Measuring*, `list: "experiments"` since v188 (was `"hidden"`), `needs` 178; from 21 November 2026): a test bed, not a story.
The cell map's model cell (`packages/spatial/main.js`: its `CELL` numbers, organelle skins and `shellMaterial`, `nodeMaterial`
and `routeMaterial` copied into `src/sets/cell.js`) with made-up proteins and a made-up database of links. Its first
headset test (the owner): 20k dots fine, links heavy from 5k (inside the cell) and too much to read above about 2k;
curved links not needed. Then cables between places were tried and removed (the owner: links between compartments
hardly exist in a real cell). Now it tries out the method for putting an interactome back into the cell (`README.md`,
"The method"): spaces (`INNER`, `OUTER`, `MEMB`, faces `FACE_OF`, `spacesOf`), true links only between copies sharing a
space (each of the many mitochondria, lysosomes, endosomes and peroxisomes its own: `MANY`; two membranes only at a
contact site: `CONTACT`), modules (`pMod`; four in five true links inside one, scored higher), dots where links happen (`dotOf`, `dotIn`: a module round its own spot in a large place; `dotBeside`, `dotToward`, `siteOf`: a long link inside a place, and a contact site, get a dot beside the partner; no possible link is drawn longer than about 0.2), a database with artefacts and missing locations (controls `art`, `miss`: 0, 0.1, 0.3; the dots are the listed
copies), and each database link judged from the lists as possible, through a gate (`GATES`) or impossible; the truth's
answer in the pane (`truthLine`). Controls `np`, `nl`, `art`, `miss`, `show` (0 possible, 1 + gates, 2 + impossible),
`budget` (links at most, 1k to 3k, `share()` by the square root of counts), `shells`, `view`; all but the last two are
`STEP` params (`cell_*`), and the set builds again when one changes (about 100 ms at 10k proteins and 40k links,
headless). Amber and red links are their own draw (`flagMat`). A *Pick* tab: a protein (click a dot, or point and press:
`api().pick`, the nearest listed copy to the ray) shows its places and faces, its truly missing places and all its
database links in their colours, with dotted ties between its copies, over a dimmed cell (the cell's `aFocus`, `uSel`);
a place shows its possible links inside, at most 2,000 (`uIso`). The pick is `X.pp`/`X.pc`, the params
`cell_pp`/`cell_pc`, shared as `{ v: 2, ..., pp, pc }`, and the address `&pp=<from 1>` or `&pc=<0 to 12>`. Not the
address words `proteins` or `links`: `proteins` is a story's key, and the shell takes the first story key in the
address. Address: `#cellstress&explore&show=2&art=0.3&miss=0.3`.

### Back into the cell (`packages/ppicell/`, in development)

*Back into the cell* (`list: "stories"` and in `packages/order.json` since v188, before the tutorial, its stations'
miniature the cell map's `spatial.cell`; it was `"hidden"`; the receptor's G protein built finer and drawn at its finest
level, v188; `needs` 178; from 22 November 2026): the interactome of Menche et al. (2015)
(13,460 proteins, 141,296 links, seven kinds of evidence) put back into the cell map's model cell with the Human Protein
Atlas's locations, each link judged by the method `packages/cellstress` tried out. Its plan is `src/SPEC.md`; its data
`src/sets/data.js` (`PPI_DATA`, derived numbers only) from `src/data/gen_data.py <folder>` (the three source files stay
out of the repository: `docs/data-and-permissions.md`), decoded by `src/sets/pdata.js` (`PDATA`: the places, the links,
the rules `spaces`, `judge`, `contact`; the locations `lProt`, `lPlace`, `lOf` and their communities `com`), checked by
`node packages/ppicell/src/data/test-data.mjs`. Communities: label propagation within each place over the contact links,
modularity-seeking (Barber and Clark; `GAMMA` 2, plain propagation swallows most of the cytosol into one), a fixed LCG
order, so `--check` is stable. The set `cell` (`src/sets/cell.js`, from cellstress's) reads `PDATA`: every location a dot
(17,935, plus the copies drawn links need: about 18.6k to 19k; 21.9k with the 3,555 unplaced proteins outside the cell at
`show=3`), a link drawn between the best pair of its proteins' places (`PAIR`), MANY's instance and a large place's spot
from the community, faces for drawing from the reading (`faceOf`: plasma membrane and nuclear envelope in the membrane,
facing their inner side (strict) or both (generous); organelle proteins inside (strict) or on the membrane facing both
(generous)), importance = number of evidence kinds then the paper's order (`ORDER`), 2,000 links shared as cellstress.
Controls `show` (0 to 3: + not judged, grey), `faces` (strict, generous), `kind` (-1 all, 0 to 6), `shells`, `view`;
the *Pick* tab adds a symbol box on the page. Shared `{ v: 2, tab, scene, ctl, p, place, copies }` (`&copies=off` in the address); address
`#ppicell&explore&show=2&faces=0&kind=1&p=TP53&place=4` (`p` by symbol, any case, wins over `place`; either opens the Pick
tab). A link of a protein with itself counts once (GRB2 871 links, TP53 449). The story (`e3_story.js`) is a one-chapter
placeholder until builder B's.

### Checking one (`tools/packages/check.mjs`)

`node tools/packages/check.mjs packages/<key> [--load] [--phone] [--shots <dir>]` (`docs/agents/testing.md`, "Story
packages"): the rules of `SPEC.md`, statically and with `--load` headless. A package's author runs it after building;
`packages/hello` passes it with `--load --phone`, and a copy with the rules broken fails on each.
