# The design room (`stories/design.js`)

> **Parked since v217** (the owner, 26 November 2026: "remove the whole design room for now"). It is out of the app: no
> entry in `STORY_EXTRA`, not precached by `sw.js`, not served by the relay (`PARKED` in `relay/server.mjs`), not built
> or checked by `node tools/engine/all.mjs` or the relay's `--build`, and its smoke block, shared-room round
> (`tools/collab.mjs --design`) and perf scene are gone. These sources stay, and `node tools/design/build.mjs` still
> works by hand. To bring it back: put its entry back into `STORY_EXTRA` in `stories/list.js` (the first, before the
> studio; the entry is in that file at v216, commit `ef4db56`), put its icon `design.table` back into
> `tools/lowpoly/shell.js` (also there at v216) and run `node tools/lowpoly/build.mjs`, take `stories/design.js` out of
> `PARKED` in `relay/server.mjs`, give the headset menu's Settings tab its Design room button again (`shared.js`
> `PAGE_ROW`, `pageRow`, `HOST.collab.design`, all at v216), rebuild, bump `VERSION` and run `node tools/release.mjs`;
> its tests are in `tools/smoke.mjs`, `tools/collab.mjs` and `tools/perf.mjs` at v216.

A table standing in the room with a small low-poly model of every prop (3D set) of the sixteen stories, a plate per
story, and a stage where the one you pick stands bigger and turns, its card on the panel. Not one of the stories: it is
in `STORY_EXTRA` in `stories/list.js` (not on the Stories screens), opened by `#design` or `HOST.go('design')`. Built
like the flock: edit the sources here, then

```sh
node tools/design/build.mjs          # writes stories/design.js
node tools/design/build.mjs --check  # exits 1 if stories/design.js is out of date
```

and bump `VERSION` in `sw.js`. Rebuild after changing `props.json` or the shell's miniatures' names
(`tools/lowpoly/shell.js`). Since v190 the stories' miniatures and their cards are their packages'
(`packages/<key>/minis.js`, built by `node tools/lowpoly/build.mjs` from `src/minis.js` and `src/props.json`), loaded at
run time (`HOST.lowpoly('*')` in `index.html`) before the table is laid out: a new package needs no rebuild here. The design room's own miniature, `design.table`, is
only its station icon in a shared room (the build skips it: not a prop on the table), and so are the shell's two
circles' miniatures, `all.stories` and `all.lobby` (story `all`, skipped too). In a room the headset menu's
*Design room here* (or Add a station on the page) puts the table at a circle, never Arrange all (`shared.js`; docs/agents/shared-rooms.md
"Shared rooms", "The design room in a room").

| Path | What it is |
| --- | --- |
| `props.json` | the shell's own part of the catalogue of sets (none yet; each story's part is its package's `src/props.json` since v190; `docs/props.md` is the page); the build takes from it only what a card shows |
| `sets/table.js` | the one set: the floor, the table, the plates and place cards, the miniatures' homes, records and glides, the stage (manifest: `sets/table.md`) |
| `engine/` | the flock's engine parts, adapted: one short intro line instead of chapters, explore mode as the room, the Prop and All props panes (HTML and canvas), the grip on a miniature; the start in steps for the shell's loading bar (`LOAD` in `e7_app.js`, as in every engine; the plates and the first view in `sceneJoin`) |
| `build.mjs` | the kit (`../engine/kit.js`), the cards (`DESIGN_CARDS`), the set and the engine put together |
| `SPEC.md` | the contract: the layout, the cards, the shared state, the headset |

Useful hashes: `#design` (the table), `#design&pick=lbi.atp` (a prop on the stage, its card shown), `&tab=prop|all`,
`&view=default|stage|above|group:<story>` (`group:pet`: a story's plate close up), `&now` (no camera flight),
`#design&t=2` (the intro, paused). In the console: `HOST.cur.peek('collabState()')`.
