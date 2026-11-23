# A story package's sources (the template)

This folder is the `src/` of a story package (`tools/packages/SPEC.md`): a story in one folder, `packages/<key>/`, that
the app lists and loads beside its own. Its build makes the package's `main.js` from the app's kit
(`tools/engine/kit.js`), the shared engine parts (`tools/engine/`) and the sets and engine files here, as the app's built
stories are made (`docs/agents/stories.md`). `packages/hello/` is a whole example made from it.

## Starting

1. Pick a key: the folder's name, a lower-case letter then 1 to 30 lower-case letters, digits or `-`; not a key of
   `stories/list.js` and not one of the words the address uses (the list in `SPEC.md`).
2. Copy this folder to `packages/<key>/src/`.
3. Write `packages/<key>/story.json` (`SPEC.md`, "story.json": at least `key`, `api` 1, `title`, `kick`, `col`, `desc`;
   `"list": "hidden"` while you work on it, so it opens only by `#<key>` or from developer mode's Stories screen), and a
   `packages/<key>/README.md`: who made it, what it shows, where its data comes from and the permission to show it.
4. Build and list it:

   ```
   node packages/<key>/src/build.mjs          # writes packages/<key>/main.js (--check: is it current?)
   node tools/packages/scan.mjs               # writes packages/index.json
   node tools/packages/check.mjs packages/<key> --load
   ```

5. Serve the app's folder (`npx http-server -p 8123 -c-1 .`) and open `http://127.0.0.1:8123/#<key>`. It now shows the
   template's set (points in a ball) in a two-chapter story.

## Making it yours

- `sets/`: one file per set (`SETS.<name> = function (K) { ... }`, the contract in `packages/lbi/src/SPEC.md`, "What a set
  exports"), listed in `build.mjs`'s `SET_FILES`; a file of helpers the sets share (the example's `net.js`) goes first.
  Replace `orb.js` with your own.
- `engine/e2_scene.js`: `SET_ORDER`, the sets in the order the story shows them (and `FRAME` for a set drawn on another).
- `engine/e3_story.js`: the chapters (`CH`), each chapter's text, and `buildStory`: when sets fade in and out (`show`),
  their params keyed on the timeline (`ramp`, `key`), the camera's waypoints (`cam`), sound effects (`sfxCue`) and labels.
- `engine/e4_explore.js`: explore mode: its scenes (`SCENES`), tabs (`TABS`), what the panes pick (`X`) and show
  (`render*`), the shared state (`collabState`, `collabApply`, with its `v`), and picking in the scene (`pickWith` ...).
- `engine/e6_panels.js`: the headset's panel: each tab's pane drawn on a canvas (`drawTabPane`), the twin of its HTML
  pane: keep both in step.
- `engine/e7_app.js`: what happens on entering explore mode and at start (a link's `#<key>&explore&...`).
- `engine/e1_head.js` and `e5_xr.js`: the head and the headset's code, all from the shared parts: leave them be.
- Lines `//#use name ...` are the shared engine parts (`tools/engine/<the same file name>.js`), pasted in by the build.
  Replace a name by your own code only where your story needs it.

## The rules

The app's story rules hold (`AGENTS.md`, "The shell and stories", "Sound", "Shared rooms"), and `tools/packages/check.mjs`
checks those it can read off the code: the renderer only from `HOST.makeRenderer`, sound only through `HOST.audio` (the
template's narration and `sfxCue`, never an `AudioContext`), no navigating (`HOST.go(key)` to change story), never A or
X, nothing loaded from another origin: everything the package loads goes through `pkgUrl('data/x.bin')`
(`HOST.pkgUrl`). A set's `update` depends only on its params and the time; numbers shown are computed, not typed in,
wherever possible. Narration: none by default; `audio/narration.mp3` in the package is played once the index lists it
(`e7_app.js`), with `NARRATION_SYNC` in `e3_story.js` to match it.

The built `main.js` holds all it needs: later changes to the app's engine reach the package only when it is built
again (then check it again).
