# The design room (`stories/design.js`)

A table standing in the room with a small low-poly model of every prop (3D set) of the fifteen stories, a plate per
story, and a stage where the one you pick stands bigger and turns, its card on the panel. Not one of the stories: it is
in `STORY_EXTRA` in `stories/list.js` (not on the Stories screens), opened by `#design` or `HOST.go('design')`. Built
like the flock: edit the sources here, then

```sh
node tools/design/build.mjs          # writes stories/design.js
node tools/design/build.mjs --check  # exits 1 if stories/design.js is out of date
```

and bump `VERSION` in `sw.js`. Rebuild after changing `props.json` or the miniatures' names (`tools/lowpoly/`): the
cards are made from both at build time. The models themselves load at run time from `lowpoly.js`
(`node tools/lowpoly/build.mjs`, `HOST.lowpoly()` in `index.html`).

| Path | What it is |
| --- | --- |
| `props.json` | the catalogue of the stories' sets (`docs/props.md` is its page); the build takes from it only what a card shows |
| `sets/table.js` | the one set: the floor, the table, the plates and place cards, the miniatures' homes, records and glides, the stage (manifest: `sets/table.md`) |
| `engine/` | the flock's engine parts, adapted: one short intro line instead of chapters, explore mode as the room, the Prop and All props panes (HTML and canvas), the grip on a miniature |
| `build.mjs` | the kit (`../lbi/kit.js`), the cards (`DESIGN_CARDS`), the set and the engine put together |
| `SPEC.md` | the contract: the layout, the cards, the shared state, the headset |

Useful hashes: `#design` (the table), `#design&pick=lbi.atp` (a prop on the stage, its card shown), `&tab=prop|all`,
`&view=default|stage|above|group:<story>` (`group:pet`: a story's plate close up), `&now` (no camera flight),
`#design&t=2` (the intro, paused). In the console: `HOST.cur.peek('collabState()')`.
