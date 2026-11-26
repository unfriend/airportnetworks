# Moving the stories into packages (the plan)

The owner, 23 November 2026: every story becomes a story package "like the new ppicell"; the studio stays in the shell
for now. This file holds what was decided and what is left. The plan as written at v184 (where things end up, what had to be built
first, the order of the moves, the risks, the cost, the questions) is a record, `docs/history/plans/packages-migration-plan.md`.
Since v187 every story is a package; what is left is in "Status" and "Left for later" below.

Checked in the code on 23 November 2026 (v184, `FORMAT` `networks-55`). Anything marked *to check* was not.

## Decided route (the owner, 23 November 2026, after the review)

These decisions override the plan of v184 (the record) where they differ.

- **Lean** (the review's, `docs/packages-migration-review.md`): no `FORMAT` bump and no per-station copy record (**G4
  dropped**: `needs`, `HOST.unknown` and `HOST.live` cover mixed copies). **G3 deferred**: shared sources stay where
  they are (`tools/lbi/sets/body.js` ...); a moved story's build finds them by path; a shared library comes later.
- **The three hand-written stories** (airports, proteins, spatial) are **wrapped** as packages later in the migration
  (the file moved, its paths patched), not rewritten (R1 to R3 dropped for now; a later rewrite may take the unified look).
- **Order**: one hand-written list, `packages/order.json` (every story, moved or not, in the Stories screen's order;
  the tutorial last, `intro` kept). The scan copies it into the index (`order`), the shell sorts `HOST.list` by it.
- **Sources** are served alongside each package (`packages/<key>/src/`, as ppicell).
- **The design room and the studio stay in the shell.** A package's `story.json` names its station's miniature
  (`icon: "<key>.<set>"`), which stays in `lowpoly.js` for now (**G5 deferred**: a later step moves the miniatures
  into `packages/<key>/src/mini.js` and the design room's build reads them there).
- **Narrations move into the packages** (`packages/<key>/audio/narration.mp3`; headsets download them again).
- **Offline (G6, decided):** the worker's install takes every listed package's `main.js`; an installed app (standalone
  display, or the `appinstalled` event) takes **all** stories in the background (every listed package's files, its
  narration included, and the narrations still in `audio/`: about 85 MB), resumable, never blocking first use; a *Take
  all stories* row on the Stories screen (and the headset menu's Settings tab) does the same with progress in a browser.
  Storage is checked (`navigator.storage.estimate`, `persist`) and a failure is soft.
- **First slice:** G2 (`tools/stories.mjs`), G1-lite and G7-lite, the offline download, the pilot **robots** (not flock:
  flock is collab's `HEADSET_STORY`) and `tools/packages/move.mjs` for the next moves. Then the built stories tail first
  in batches, the tutorial last of them, then the three wrapped, airports last; cleanup (Z) at the end.

### Status (v185) and how the next stories move

What was done at v185, v186, v187 and v190, release by release, is in `docs/history/plans/packages-migration-plan.md` ("What was done"); the plan as written at v184 (sections 0 to 12, the old "Moving a built story" steps) is there too, a record.

- **`stories/list.js`**: `STORY_LIST` is empty and nothing of this release needs it but `STORY_EXTRA` (the design room
  and the studio): the shell, the scan, the check, `tools/stories.mjs`, `tools/release.mjs` and the tools all read it as
  possibly empty, and the stories come from `packages/index.json`. It stays because shells before v187 read
  `STORY_LIST` for their cards (an empty one leaves them with no cards until they update) and every shell reads
  `STORY_EXTRA` from it. It can go (`STORY_EXTRA` moving into `index.html` or the index, and `index.html`'s
  `stories/list.js?v=` script, `tools/release.mjs`'s list fingerprint, `scan.mjs`'s and `check.mjs`'s taken keys and
  `tools/stories.mjs` following) once no device runs a shell before v187: in practice after `main` has carried v187 or
  later for a while (a release cycle or two) and the owner's headsets have taken it. Until then keep the file.

What is left: see "Left for later" below (the shared library, G3, and the rewrites of the hand-written three, R1 to R3),
and, small: a headset menu row for *Take all stories* (an installed headset app takes them by itself), `collab.mjs`'s
per-story expressions for the wrapped three (unchanged: they run in the page), and the hidden packages `ppicell` and
`cellstress` naming `tools/lbi/SPEC.md` and `stories/spatial.js` in comments (theirs to rebuild; the shared engine part
`tools/engine/e7_app.js` still says `audio/narration-<key>.mp3` in a comment, which every built story would take on
its next build).

## Left for later (the owner, 23 November 2026: "leave for later for now, add to docs")

### (a) The shared library (G3)

**Today.** Sets that several stories draw live in the package of the story that first made them, and the readers' builds
paste them in by path (`'../../packages/<owner>/src/...'`, rewritten by `tools/packages/move.mjs` as each owner moved):

| Shared source | Owner | Read by (pasted in at build time) | Size |
| --- | --- | --- | --- |
| `packages/lbi/src/sets/body.js` (the PET body) | lbi | pet, micro, ovary, topo | 41 KB |
| `packages/lbi/src/sets/tissue.js` (the H&E section) | lbi | micro | 66 KB |
| `packages/lbi/src/sets/web.js` (the internet and the globe) | lbi | soil | 48 KB |
| `packages/micro/src/sets/organs.js` (ORGAN3D) | micro | pet (cuts its gallery), topo | 45 KB |
| `packages/nmd/src/sets/motor.js` (the motor unit) | nmd | endo | 93 KB |
| `packages/nmd/src/sets/data.js` (NMD_DATA, generated) | nmd | endo (read at build time) | 436 KB |
| `packages/topo/src/sets/look.js` (the shared looks) | topo | soil, cdk5 | 54 KB |
| `packages/airports/main.js`, `packages/spatial/main.js` (hand-written) | airports, spatial | pass (its globe and cell cut out by line markers, `ORIGINALS` in `packages/pass/src/build.mjs`) | 700 KB, 270 KB |
| `tools/engine/kit.js`, `tools/engine/e*.js` (the kit and the engine parts) | the shell's tools | every built story (and the design room, the studio's kit) | |
| `tools/lowpoly/kit-a.js`, `kit-b.js` (v190: the miniatures' helpers, with the airports' globe and the cell for kit b) | the shell's tools | every package's `minis.js` of that kit, `lowpoly.js` | 25 KB, 16 KB |

Who reads what is in the builds themselves; the relay's `--build` (`buildMap`, `pkgs`) and `tools/engine/all.mjs`
follow them, and AGENTS.md's "Rebuild the dependants" lists them.

**What a library would hold.** One folder of build-time sources, `tools/lib/` (no `build.mjs` in it: the relay would take
it for a story's), with `sets/body.js tissue.js web.js organs.js motor.js look.js`, `data/nmd.js` (NMD_DATA, still
written by `packages/nmd/src/data/gen_data.mjs`), later `sets/globe.js` and `sets/cell.js` (once R3 and R1 have made
the globe and the cell sets of their own), and `deps.mjs` (who uses what: `node tools/lib/deps.mjs` prints it; `all.mjs`
and the relay's `--build` read it). Each reader's build names what it takes (`LIB = ['sets/body', 'sets/organs']`),
read with `fileURLToPath`, pasted in its order (pet keeps its `cutGallery`). Pasted at build time, not loaded at run
time: each `main.js` keeps everything it needs, its `fp` covers it, offline needs nothing more (section 2 weighs this).

**What moves.** `git mv` of the seven files above into `tools/lib/` (their manifests `*.md` with them); each reader's and
owner's `build.mjs` `src()` and harness paths; `tools/engine/all.mjs` and the relay's `buildMap`; the owners'
`SPEC.md`/`README.md` paths, AGENTS.md's dependants line, `docs/props.md`'s and the catalogues' `file` fields
(`packages/<key>/src/props.json`), the design room's cards (rebuild the miniatures). The test is that every build's
`--check` passes **unchanged**: no built file may change (no `VERSION` bump needed for the move itself).

**Risks.** A path missed in one reader fails only that build (`all.mjs --check` catches it); harnesses and `shot.mjs`
tools find sets by relative path and fail quietly (open each harness once); a package from outside that pasted an
owner's set by path breaks (none does today; `SPEC.md` should say the library is the app's, not a package API); the
owners' own `README`s describe their sets as theirs (say where they went); `move.mjs`'s readers logic becomes dead code.
Cost, by the plan's own numbers: about 0.5M on the strongest model plus 0.2M for checks, one session.

### (b) Rewriting airports, proteins and spatial onto the shared engine (R1 to R3)

**Today.** The three are wrapped, not rewritten (v187): each `packages/<key>/main.js` is its old hand-written file, its
own source (no `src/` build; since v190 `src/` holds only its miniatures). They keep their own headset code (about
1,500 lines of WebXR each: their panels, menus, landing cards and framing), their own explore panes and their own
skeleton (airports and proteins share one: "globe interaction", "globe pose"; spatial its own), while every built story
takes the shared engine parts (`tools/engine/`: `e5_xr`, `e6_panels` ... with the shared hooks).

**The unified look** (decided route, 23 November 2026, and question 1 of section 12): a rewrite makes each look and act
like the built stories in a headset: the shared panels, menus, landing cards, framing and explore panes (`render*` and
`draw*` twins), so one fix to the engine reaches all of them. Some hand-made details of their panels may go; the owner
decides per difference (one review round). What each keeps of its own, unchanged: the airports' globe (3,214 airports,
18,858 routes, pillars, arcs, communities, closures, shortest paths; 486 KB of embedded data) and its human recording,
whose clock *is* the story clock (no `NARRATION_SYNC` beyond the identity; `CH` and `NARRATION_ENDS` in recording
seconds, copied exactly; the recording never re-encoded); proteins' 254 curated proteins and 375 interactions in a cell
on the airports skeleton (synthetic narration); spatial's model cell (13 compartments, 249 proteins, 252 links, laid out
at load time; synthetic narration). Their `collab.state()` shapes change (a `v` and a converter in the test, or a
`FORMAT` bump if a room key's shape changes).

**The pass story depends on them.** `packages/pass/src/build.mjs` cuts the globe and the cell out of the two
`main.js` files by line markers (`ORIGINALS`); a rewrite must give it a set to take instead (`tools/lib/sets/globe.js`,
`cell.js`: do G3 first), and `same.mjs --keys pass` must stay at 0 difference. `ppicell` and `cellstress` copied
spatial's code once and are not affected. The miniatures (`airports.globe`, `proteins.cell`, `spatial.cell`) and kit b's
globe and cell helpers are not touched by a rewrite.

**Suggested order** (section 8): G3 first; then R1 spatial (its cell becomes the library's `cell.js`, used by pass),
R2 proteins (the airports skeleton on a cell: a dry run for airports with a synthetic narration), R3 airports last (the
human recording, the largest data). Each a built package from the template (`src/sets/`, `src/engine/e1..e7`, data in
`src/sets/data.js` or `data/*.bin` through `pkgUrl`), proved the old story by pictures (`same.mjs <old tree> . --keys
<key>` at each chapter's start, desktop and phone, every pair above 1 % looked at), by state (old explore states through
a converter, `apply()` then `state()` equal), by the smoke blocks and the shared hook lines, `collab.mjs`'s per-story
round, `xrsame.mjs` and `panelsame.mjs`, and for airports `tools/audio.mjs` and a table test (every chapter's start equal
to the millisecond).

**Rough cost** (section 11): R1 about 1.5M on the strongest model plus 0.5M for checks (2 to 3 sessions), R2 1.2M plus
0.4M (2), R3 2.0M plus 0.6M (3): about 4.7M plus 1.5M in all, with G3 0.7M before them; the full suites before `main`
after each.
