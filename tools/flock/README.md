# The flock (`stories/flock.js`)

Starlings at dusk, flying all around you: a short story (about two minutes), then the flock flies on in explore mode for
as long as you stay. Built like the tour and the muscle story: edit the sources here, then

```sh
node tools/flock/build.mjs          # writes stories/flock.js
node tools/flock/build.mjs --check  # exits 1 if stories/flock.js is out of date
```

and bump `VERSION` in `sw.js`.

| Path | What it is |
| --- | --- |
| `sets/flock.js` | the one set: the simulation, the birds and the falcon, the sky, the land, the reeds, the network links (manifest: `sets/flock.md`) |
| `engine/` | the tour's engine parts, adapted: one scene and no Proteins tab, life-size placement in a headset, a camera that follows the flock on a screen, the trigger or a click sends a falcon |
| `build.mjs` | puts the tour's kit (`../lbi/kit.js`), the set and the engine parts together |
| `harness.html`, `shot.mjs`, `sweep.mjs` | the set on its own (`harness.html?set=flock&cam=0,-26,0.25,0,1.6,0&follow=1&anim=1`; `follow` aims at the flock, `fov` sets the lens) and screenshots, as in `tools/lbi` |

Serve the repository root (`python3 -m http.server 8123`) and run the tools from this folder
(`node shot.mjs flock "<query>|<query>" <prefix>`, `node sweep.mjs <prefix> "3,28,45"`); shots go to `shots/`.
