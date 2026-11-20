# The tutorial (`stories/tutorial.js`)

A robot guide stands in your room and shows you how the app works in a headset: pointing, playing a story, explore mode,
the menu, Recenter, shared rooms (about three and a half minutes), then explore mode is practice: seven small tasks the
guide reacts to. It is first in `stories/list.js` with `intro: true`: an introduction, not one of the sixteen stories
(the shell skips it for the default start, Repeat all and `HOST.count()`). The plan is `SPEC.md`; built like the flock:
edit the sources here, then

```sh
node tools/tutorial/test-script.mjs          # the script's rules (speeds, distances, keys, tags, sounds, degrees); --words counts the spoken words
node tools/tutorial/build.mjs                # writes stories/tutorial.js
node tools/tutorial/build.mjs --check        # exits 1 if stories/tutorial.js is out of date
```

and bump `VERSION` in `sw.js`. After the text changes: `node tools/voice/narrate.mjs tutorial` and
`node tools/voice/check.mjs tutorial` once the voice is recorded (until then `node tools/pace.mjs <url> --write tutorial`
paces it), then `test-script.mjs` again (it checks the speeds in real time with the new `NARRATION_SYNC`).

| Path | What it is |
| --- | --- |
| `sets/script.js` | the guide's timeline as data (`SCRIPT`, by chapter, in seconds from the chapter's start) and its evaluator (`compileScript`, `evalGuide`, `GUIDE`: places, the network, the chapters); plain maths, no THREE, loaded by Node in `test-script.mjs` |
| `sets/guide.js` | the one set, `guide`: the figure (a draw set of `HOST.bodies` of its own, else the plain figure), the props (ray, target, markers, network, mini menu, copy, boot trails, card, the narration hold's sign), the floor, the labels, practice's clock and reactions (manifest: `sets/guide.md`) |
| `engine/` | the flock's engine parts, adapted: one scene (practice), life size in a headset on the floor the session reports (else 1.6 m below your head), the viewer's head, ray and the panel's buttons told to the guide every frame (`tellGuide`), the narration hold (`HOLD`), practice's tasks, bar and shared state (`e4_explore.js`), a signal as an effect |
| `build.mjs` | puts the shared kit, the script, the set and the engine parts together |
| `test-script.mjs` | the script's checks in Node (a cheap check: run on `dev` too) |
| `harness.html`, `shot.mjs`, `sweep.mjs` | the set on its own (`harness.html?set=guide&t=60&view=side`; `mode=1` practice, `nofvt` the plain figure, `eye=x,y,z` the viewer's head; it loads `ik.js` and `bodies.js` itself) and screenshots, as in `tools/flock` |

Serve the repository root (`python3 -m http.server 8123`, or another port with `PORT=<port>`) and run the tools from this
folder (`node shot.mjs guide "t=9|t=39|t=95&view=net" <prefix>`, `node sweep.mjs <prefix> "4,9,39,60,95,117,155,172"`); shots go
to `shots/` (or `SHOTS=<folder>`).
