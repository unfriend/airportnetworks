# setup-and-release.md: text taken out on 26 November 2026 (v217)

This file is a record: the typed numbers, the hand-kept lists and the table of `docs/setup-and-release.md` that went stale, kept word for word; each section says where it was. The file now names the command that prints the number or the place where the list lives.

## Hot reload row, --build

a source in `tools/<key>/` is built first

## Step 4, the version numbers typed on 26 November 2026

(`networks-v212` on `dev` and `networks-v135` on `main` on 26 November 2026, so `networks-v213` next; a change to

## Step 4, the hand-kept list of files the app serves

after any change to a file the app
   serves: `index.html`, `sfx.js`, `occlusion.js`, `ships.js`, `notes.js`, `shared.js`, `sw.js`, `manifest.webmanifest`, `three.min.js`, `three.LICENSE.txt`,
   `proteins.html`, `spatial.html`, `README.txt`, `lowpoly.js`, and anything in `stories/`, `packages/` or `icons/`. For a new
   file

## Step 5, the format numbers typed on 26 November 2026

(`networks-59` on `dev` and `networks-41` on `main` on 26 November 2026)

## Step 3, the dependants table (a wrong third copy: organs.js lacked pet, look.js lacked cdk5)

3. **Rebuild.** If the data changed, run the data generator first (see the story's README), then rebuild the
   stories. Some parts feed several stories:

   | Source | Stories built from it |
   | --- | --- |
   | `tools/engine/kit.js` | every built package (19 with a `src/build.mjs`: all but airports, proteins and spatial), the design room, the studio |
   | `tools/lowpoly/kit-a.js`, `kit-b.js` | every `packages/<key>/minis.js` of that kit, `lowpoly.js` (kit b) |
   | `packages/lbi/src/sets/body.js` | lbi, pet, micro, ovary, topo |
   | `packages/lbi/src/sets/tissue.js` | lbi, micro |
   | `packages/nmd/src/sets/motor.js`, `packages/nmd/src/sets/data.js` | nmd, endo |
   | `packages/pet/src/sets/icons.js` | pet |
   | `packages/micro/src/sets/organs.js` | micro, topo |
   | `packages/lbi/src/sets/web.js` | lbi, soil (its globe) |
   | `packages/topo/src/sets/look.js` | topo, soil |

## Section 7, "no licence"

there is no licence, either on GitHub
or in the repository (see "Decisions for the owner" in [HANDOVER.md](../HANDOVER.md)).

## Section 3, the test table's "When to run it" column (Test | When)

Test | When to run it
Build check | after any change in `tools/` or a package's `src/`, and before every release
Smoke | before every release to `main` (since 7 November 2026; not for `dev`)
Sound | after touching sound (`HOST.audio` in `index.html`, a story's narration code, how `sw.js` serves the narration)
Update | after changing `sw.js` or how files load, and before every release
Live updates | after touching `HOST.live`, `HOST.swap` or `HOST.load` in `index.html`, `tools/release.mjs`, `stories/list.js`'s shape or the relay's `--watch`; before every release
Release file | before every release (step 7 below)
Relay | after touching `shared.js`, `relay/`, or a story's shared-room hooks or `state()`; before every release (the whole of it, its `--trackers` part included)
Room and depth test | after changing `room-test/`
Introduction server | after touching the relay's `/peerjs` or `p2p/`
Shared rooms | as for the relay test
Studio listings | after changing the studio's test scene (`node tools/studio/test/make.mjs` remakes it) or `relay/scenes.mjs`
Trackers | after touching `relay/trackers.mjs`, `tools/trackers/`, the trackers in `shared.js` or the studio's `e6k_trk.js` and `e6l_puppet.js`. Both are in the whole runs too
The trackers' solver | after changing `ik.js` or the puppet in `tools/studio/test/make.mjs`
The picture reader | after changing `tools/studio/engine/images.js` or `tools/studio/test/pictures.mjs`
A model to GLB | not a routine test: to convert the owner's models in a batch, or to try the converter on real files after changing `tools/studio/engine/convert.js`
One set | while you change a 3D set
A whole story | after changing a built story's text, timing or camera

