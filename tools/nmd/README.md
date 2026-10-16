# tools/nmd: the sources of the muscle story (`stories/nmd.js`)

"Hidden connections in rare diseases of nerves and muscles", after the ISMB 2026 talk by Iker Núñez-Carpintero
and Philipp Friedrich (with Julia Guthrie and Jörg Menche, LBI Network Medicine), on their data in `ikerdata/`.
Built like the tour (`tools/lbi/`), with the tour's kit and set contract. Never edit `stories/nmd.js` by hand.

```sh
node tools/nmd/data/gen_data.mjs   # ikerdata/ -> sets/data.js (about a minute; only after the data changes)
node tools/nmd/build.mjs           # writes stories/nmd.js
node tools/nmd/build.mjs --check   # exits 1 if stories/nmd.js is out of date
```

| Path | What it is |
| --- | --- |
| `data/gen_data.mjs` | reads `ikerdata/` (13 group files, the nodes and edges of the protein layers, the overlap network) and writes `sets/data.js`; computes layer z-scores, walk visits, endotype names and the layout |
| `sets/data.js` | the constant `NMD_DATA` (generated; its header documents the fields) |
| `sets/tower.js`, `sets/motor.js`, `sets/hpc.js` | the three 3D sets; each has a manifest `sets/<name>.md` |
| `engine/e1_head.js` ... `e7_app.js` | the story engine, adapted from the tour: chapters and text (`e3_story.js`), explore mode (`e4_explore.js`), headset code (`e5_xr.js`, shared with the other stories), headset panels (`e6_panels.js`), narration and frame loop (`e7_app.js`) |
| `SPEC.md` | what each set must do; read with `tools/lbi/SPEC.md` |
| `build.mjs` | the assembler |
| `harness.html`, `shot.mjs` | render one set alone, take screenshots (run `shot.mjs` from this folder; shots go to `shots/`, ignored by git) |
| `sweep.mjs` | screenshots of the whole story at chosen story seconds, from one page load (`node sweep.mjs <prefix> "6,46,300"`) |

When the authors send more data (the other layers' links, their own z-scores, endotype names), add it to
`ikerdata/`, extend `gen_data.mjs` to read it, and rebuild: layers fill in without changes to the sets.
No patient data, no variants and nothing about zebrafish belong in this story.
