# tools/lbi: the sources of the tour (`stories/lbi.js`)

`stories/lbi.js` is assembled from the files in this folder. Edit these, then
rebuild; never edit `stories/lbi.js` by hand, and commit both together.

```sh
node tools/lbi/build.mjs           # writes stories/lbi.js
node tools/lbi/build.mjs --check   # exits 1 if stories/lbi.js is out of date
```

| Path | What it is |
| --- | --- |
| `kit.js` | `makeKit(THREE)`: the shared helpers and materials every set uses |
| `sets/<name>.js` | one 3D set each (`crowd` and `sankey` share `clinic.js`); `sets/<name>.md` is its manifest: params, anchors, labels, views, controls, sources, what a narrator may say |
| `sets/demo.js` | a tiny example set |
| `engine/e1_head.js` ... `e7_app.js` | the story engine: scene and camera, story text and keyframes (`e3_story.js`), explore mode, headset code, headset panels, narration and the frame loop; the start in steps that yield, each set built (`buildSet`) and its shaders compiled (`warm`) on its own, reported to the shell's loading bar (`LOAD` in `e7_app.js`, the same lines in every engine; AGENTS.md "Inside a story") |
| `SPEC.md` | the contract for sets: API, rules, performance budget, palette, shared facts. Read it before adding or changing a set |
| `build.mjs` | the assembler |
| `harness.html`, `shot.mjs` | render one set on its own with chosen params and camera; screenshots |
| `sweep.mjs` | screenshots of the whole tour at chosen story seconds, from one page load |
| `data/` | generators: `extract_proteins.mjs` and `extract_airports.mjs` read the other stories; `gen_int.mjs` writes the data block of `sets/int.js`; `body_cage.cjs` placed the organ network's nodes |

## Changing something

- **Panel text, timing, camera path:** `engine/e3_story.js` (`html`, the `ramp`/`key`/`show` calls, the `cam` waypoints).
- **A 3D scene:** its `sets/<name>.js`; keep `update(S, t)` pure in the params and time, and the manifest in step.
- **Headset panels:** `engine/e5_xr.js` and `engine/e6_panels.js`; shared panel code must stay identical to the other three stories.

Test a set alone first (cheap), then the story:

```sh
npx http-server -p 8123 -c-1 .                                     # from the repository root
cd tools/lbi && node shot.mjs atp "p=atp_build:1&t=2" check        # one set, one look
node sweep.mjs check "118,215,431"                                 # the tour at a few seconds
cd ../.. && node tools/lbi/build.mjs && node tools/smoke.mjs        # build, then the smoke test
```

The Playwright scripts read `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` like `tools/smoke.mjs`. Screenshots go to
`tools/lbi/shots/` (ignored by git). See "Working economically" in `AGENTS.md` before starting large reviews.
