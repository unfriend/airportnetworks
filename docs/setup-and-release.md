# Setting up, testing and releasing

For the developer who takes the app over: how to set up a machine, run the app and its tests, publish a new
version, and undo one. Start with [HANDOVER.md](../HANDOVER.md). [AGENTS.md](../AGENTS.md) holds the full rules
(structure, conventions, every shared-room detail) and is the reference wherever this page is short. Facts marked
*checked 22 October 2026* were read from GitHub or the live site on that day.

## 1. Setting up a machine

| Tool | Version used | Needed for |
| --- | --- | --- |
| Node | 22 (the relay alone runs on 18 or newer) | the build scripts, the data generators (all but one), the relay and every test. `relay/test.mjs` uses Node's own WebSocket client, which is on by default from Node 22 |
| Playwright, with its Chromium | 1.56 | every browser test: smoke, sound, update, shared rooms, the set harnesses, and `tools/narration.mjs` |
| Python 3 | 3.13 | optional: serving the folder (`python3 -m http.server`). Needed for the data generators of the endotype story (3.11 or newer) the tissue topology and soil stories (3.10 or newer), see below |
| `http-server` | any | optional: another way to serve the folder (`npx` fetches it) |
| `openssl` | any | only for the relay's `--lan` mode (see [relay/README.md](../relay/README.md)) |
| `ffmpeg` | any | optional, on the machine that runs the relay with `--scenes` (a folder or `r2`): it makes long sounds uploaded to the studio mono MP3 (without it they are kept as given; `brew install ffmpeg`, `sudo apt install ffmpeg`, `winget install ffmpeg`; the relay's Docker image installs it). `relay/test.mjs` uses a real one when the machine has it, else a stand-in |
| git | any | a checkout. The update test also needs a second, older checkout |
| uv (or Python 3 and pyopenvr) | uv any; Python 3.11 or newer on Windows | optional, only on the Windows PC with SteamVR that runs the relay for the Vive trackers: `uv run tools/trackers/bridge.py` (uv fetches Python and pyopenvr by itself, at the versions in `bridge.py.lock`; without uv, `pip install openvr` and `python`; `--fake` needs neither SteamVR nor pyopenvr). Setting it up: [tools/trackers/README.md](../tools/trackers/README.md) |

```sh
git clone https://github.com/unfriend/airportnetworks.git   # changes if the repository moves (section 7)
cd airportnetworks
mkdir -p node_modules               # so npm installs here, not in a folder further up that already has one
npm i --no-save playwright@1.56     # into node_modules/ only: writes no package.json
npx playwright install chromium     # the Chromium build this Playwright expects
```

On a bare Linux machine, `npx playwright install --with-deps chromium` also installs the system libraries that
Chromium needs (it asks for sudo).

**A global install instead.** Every browser tool loads Playwright with
`import(process.env.PLAYWRIGHT_MODULE || 'playwright')`, and it starts the Chromium in `CHROMIUM_PATH` when that is set:

```sh
npm i -g playwright@1.56 && playwright install chromium
export PLAYWRIGHT_MODULE="$(npm root -g)/playwright/index.mjs"   # must name a file: a folder does not import
export CHROMIUM_PATH=/path/to/chrome                             # only to use another Chromium build
```

**`node_modules/`, and why there is no `package.json`.** The app needs no packages (three.js is kept in the
repository as `three.min.js`). The tools use only Node's own modules, except that the browser tests use Playwright.
So there is no `package.json` and no lock file, on purpose. `node_modules/` is git-ignored and holds only what you
installed above. Never commit a `package.json` or a `package-lock.json`.

**Python for the endotype data.** You only need this when the authors send a new run. The script is
`tools/endo/data/gen_data.py`. Its header asks for:

- Python 3.11 or newer
- EndotypY (github.com/menchelab/EndotypY), installed without its dependencies (the script does not need its
  clustering library)
- numpy, pandas, networkx, scipy, gseapy and openpyxl

It downloads Enrichr libraries, so it needs the internet. It also reads two of the authors' files that are not in the
repository: `run.pkl` and `seeds.xlsx` (ask the owner for them). Work in a virtual environment outside the repository:

```sh
python3 -m venv ~/venvs/endo && . ~/venvs/endo/bin/activate
pip install numpy pandas networkx scipy gseapy openpyxl
pip install --no-deps git+https://github.com/menchelab/EndotypY
python -I tools/endo/data/gen_data.py run.pkl seeds.xlsx   # a few minutes; writes tools/endo/sets/data.js
node tools/endo/build.mjs
```

**Python for the tissue topology data.** You only need this when the authors send new data or topocyte changes. The
script is `tools/topo/data/gen_data.py`; it runs the authors' package topocyte (GPL-3, run here only, none of its code
goes into the app) and the poster's own figure scripts. Its header asks for:

- Python 3.10 or newer
- numpy, scipy, anndata, pandas, scikit-learn, gudhi and h5py
- checkouts of the authors' topocyte and topocyte_data repositories on the path (installed into the virtual
  environment, or on `PYTHONPATH` when Python runs without `-I`, which ignores it)
- the authors' files, which are not in the repository (ask the owner for them): the cohort's cells (`cells.h5ad`) and
  the poster's figure project (`fig1/`, with `real.py` and `simplify.py`)

It needs about 14 GB of memory (it packs the pieces and the loops in processes of their own) and takes about 30
minutes the first time; the cohort's persistence and models are kept in a cache folder (by default `fig1_cache/`
next to `fig1/`), so later runs are quicker. Only the numbers it writes go into the repository: no slide ids, no
donor details, no images.

```sh
python3 -m venv ~/venvs/topo && . ~/venvs/topo/bin/activate
pip install numpy scipy anndata pandas scikit-learn gudhi h5py
python -I tools/topo/data/gen_data.py cells.h5ad fig1/   # topocyte and topocyte_data importable; writes tools/topo/sets/data.js
node tools/topo/test-data.mjs                            # the data and its decoders against the poster's numbers
node tools/topo/build.mjs
```

**Python for the soil story's data.** Only when the authors send new data. The script is `tools/soil/data/gen_data.py`
(Python 3.10 or newer with numpy, pandas, scipy and networkx: `tools/soil/data/requirements.txt`); it reads the authors'
three CSVs (`Soil_ASVs.csv`, `ASV_Identifiers.csv`, `Field_Metadata.csv`, kept out of the repository: ask the owner for
them) from a folder, builds the co-occurrence network and takes about five minutes. The slides' readings are
reconciled by `tools/soil/data/reconcile.py` from two readers' files (not kept). Only the numbers go into the
repository: kinds numbered, no ASV ids or sequences, no pictures from the slides.

```sh
python3 -m venv ~/venvs/soil && . ~/venvs/soil/bin/activate
pip install -r tools/soil/data/requirements.txt
python -I tools/soil/data/gen_data.py <folder with the three CSVs>   # writes tools/soil/sets/data.js
node tools/soil/test-data.mjs                                       # the data, its decoders and the story's key numbers
node tools/soil/build.mjs
```

The other data generators are Node scripts (each story's `tools/<key>/README.md` lists them). The microanatomy
generator also needs Iva Buljan's GraphML file, which is kept out of the repository.

## 2. Running it locally

```sh
python3 -m http.server 8123         # or: npx http-server -p 8123 -c-1 .
```

Open `http://127.0.0.1:8123/`. A hash opens a story at a given point, for example `#pet&t=40` or
`#nmd&explore&group=Cardiomyopathies` (the full list is "Useful URL hashes" in AGENTS.md "Testing"). The browser
treats `127.0.0.1` as a secure address, so the service worker (the script that keeps the offline copy) runs here too.
It asks the server first for every file, so a reload shows your edits.

Shared rooms run on the relay when there is one, and the relay can serve the app as well. Without one they run peer
to peer (PeerJS's public introduction server, which needs the internet); to try that on one machine without it, serve
the app from the plain server and point the pages at the relay's own introduction server: run
`node relay/server.mjs --static .` too and open `http://127.0.0.1:8123/#stories&peer=127.0.0.1:8787/peerjs` in two
browser profiles (the plain server's page knows no relay, so its rooms run peer to peer).

| You want | Run | Then open |
| --- | --- | --- |
| rooms between desktop pages on this machine | `node relay/server.mjs --static .` | `http://localhost:8787/` |
| headsets on the same Wi-Fi | `node relay/server.mjs --lan` (HTTPS, with a certificate it makes itself) | the address it prints |
| one headset over USB, no certificate | `node relay/server.mjs --static .`, then `adb reverse tcp:8787 tcp:8787` | `http://localhost:8787/` on the headset |
| the studio with your own scenes (models, sounds, saved layouts, the upload page) | `node relay/server.mjs --static . --scenes <folder>` (each subfolder a scene; keep the owner's scenes outside the repository, or in the git-ignored `tools/studio/test/local/`) | `http://localhost:8787/#studio`, and `/upload` to add files. Without a relay, the committed test scene: `http://127.0.0.1:8123/#studio&scenes=tools/studio/test/scenes&scene=test&edit` |
| your edits to show by themselves while you work (hot reload) | add `--watch` (and `--build` for the built stories) to any of these, for example `node relay/server.mjs --lan --watch --build` | the same address: a story you save is swapped in place on every page and headset showing it (its place kept), a source in `tools/<key>/` is built first, and a change to `index.html`, `shared.js`, `sw.js`, three.js or PeerJS reloads the pages with their place (a headset then shows Enter VR to continue) |

The flags and troubleshooting are in [relay/README.md](../relay/README.md). The relay's introduction server for peer
to peer is at `/peerjs` (on by default; `--no-peer` turns it off): the tests use it, and so can an event that wants
its own (`&peer=<address>:8787/peerjs` in a room's link).

**The peer-to-peer test page** `p2p/` (not part of the app; served by GitHub Pages and by the relay) checks a network
before an event: open it on two or more devices, give them the same code and press **Start**. It shows whether they
link directly, how fast, and whether the link keeps running inside VR or AR, with a report to copy. `&peer=host:port`
(path `/peerjs` by default) points it at another introduction server, such as the relay's.

**The room and depth test page** `room-test/` (not part of the app; served by GitHub Pages and by the relay) finds out
what a Quest 3 gives a web page about the real room (depth sensing, the room scan's planes and meshes) and whether the
app's renderer can use it to hide virtual things behind a real hand, person, wall or table. How to run it on a headset:
[event-runbook.md](event-runbook.md), section 8. Untested on a real Quest.

## 3. Tests

There is no unit-test suite and no CI (no automatic test runs on GitHub): you run these tests yourself, before `main`
moves (a push to `dev` gets only the cheap checks: `node --check` on the changed files, the build check and the
release file check; section 4). The browser
tests use headless Chromium, which draws in software here and is slow, so run them one at a time. In the table,
"server" means the folder served on port 8123, as in section 2. The times are for a machine with 4 CPUs.

| Test | Command | Needs | When to run it | Time | A failure usually means |
| --- | --- | --- | --- | --- | --- |
| Build check | `for k in lbi nmd endo pet micro ovary qubits mutation topo soil pass flock robots lowpoly design studio; do node tools/$k/build.mjs --check; done` | Node | after any change in `tools/`, and before every release | under 1 s | a built story no longer matches its sources: run its `build.mjs` and commit both |
| Smoke | `node tools/smoke.mjs http://127.0.0.1:8123/` | server, Playwright | before every release to `main` (since 7 November 2026; not for `dev`) | about 20 min | a page or console error in a story (they are printed at the end). A 404 for a missing narration MP3 is expected and ignored. `--only <words>` (v124) runs only the steps whose names start with them, such as `--only studio` or `--only trackers`: for a builder's own steps; the release run is the whole test, with no `--only` |
| Sound | `node tools/audio.mjs http://127.0.0.1:8123/` | server, Playwright, `audio/narration.mp3` | after touching sound (`HOST.audio` in `index.html`, a story's narration code, how `sw.js` serves the narration) | a few minutes | the narration no longer starts after a tap or a story change, or the `<audio>` fallback no longer takes over |
| Update | `git worktree add /tmp/old origin/main`, then `node tools/update.mjs /tmp/old .`, then `git worktree remove /tmp/old` | Playwright, port 8125 free (it serves both versions itself) | after changing `sw.js` or how files load, and before every release | under 1 min | `VERSION` was not bumped, a new file is missing from `SHELL`, or the page and its stories came from different versions. If it says the two versions look the same, the old checkout is not older |
| Live updates | `node tools/live.mjs` | Playwright, ports 8126 and 8127 free (it copies the app to a temporary folder, serves it like Pages and through a relay with `--watch --build`) | after touching `HOST.live`, `HOST.swap` or `HOST.load` in `index.html`, `tools/release.mjs`, `stories/list.js`'s shape or the relay's `--watch`; before every release | a few minutes | a story added live without its card, a swap that loses the place or happens mid-chapter, a shell change not asked about, a reload that loses the place, `version.json` cached, or the watch channel silent |
| Release file | `node tools/release.mjs --check` | Node | before every release (step 7 below) | under 1 s | `version.json` or `index.html`'s stamp is not current: run `node tools/release.mjs` and commit both; or `whatsnew.json` names another release: rewrite it (step 5c) |
| Relay | `node relay/test.mjs` | Node 22 | after touching `shared.js`, `relay/`, or a story's shared-room hooks or `state()`; before every release (the whole of it, its `--trackers` part included) | seconds (the studio's scenes and uploads about 15 s more) | the protocol changed, the relay does not serve a file that `sw.js` caches (`APP_FILES` and `APP_DIRS` in `relay/server.mjs`), or the studio's scenes, saving, watch, uploads, `ffmpeg` or `/upload` no longer answer as `relay/README.md` says |
| Room and depth test | `node tools/room-test.mjs` | Playwright, port 8131 free (it starts its own relay) | after changing `room-test/` | about a minute | the pretend headset's depth no longer hides the test things where it should (three.js r128's external texture, the per-eye pass), or the report misses a field |
| Introduction server | `node tools/peer.mjs` | Playwright (it starts its own relay) | after touching the relay's `/peerjs` or `p2p/` | seconds | two pages of the test page no longer link through the relay's introduction server |
| Shared rooms | `node tools/collab.mjs` (`--quick` runs only the last story in the per-story part; `--p2p` only the peer-to-peer part, about 2 min; `--design` only the design room in a room, a few minutes; `--near` only rooms on this network, `--follow` only following a person, `--circles` only the ten-headset round's circles and locks, `--token` only the relay's password (not in the main run), `--studio` only the studio in a room, its saving, uploads and password, about 3 min; `--shots <dir>` saves pictures) | Playwright (it starts its own relay; the peer-to-peer part uses its `/peerjs`, never the internet) | as for the relay test | about 15 to 18 min | a story's hooks no longer match its pointer code, a `state()` that changes when it is applied, `FORMAT` not bumped, a timing check (see below), or a peer-to-peer room that no longer hosts, links or takes over |
| Studio listings | `node tools/studio/scan.mjs tools/studio/test/scenes --check` | Node | after changing the studio's test scene (`node tools/studio/test/make.mjs` remakes it) or `relay/scenes.mjs` | under 1 s | the test scene's `index.json` or `files.json` is not what the relay would answer: run it without `--check` (or `make.mjs`) and commit them |
| Trackers | `node relay/test.mjs --trackers` (seconds; with the fake bridge, and `bridge.py --fake` where `python3` is), then `node tools/collab.mjs --trackers` (3 to 5 min: the bridge's, the shell's and the studio's parts together through a real relay) | Node 22; Playwright for the second | after touching `relay/trackers.mjs`, `tools/trackers/`, the trackers in `shared.js` or the studio's `e6k_trk.js` and `e6l_puppet.js`. Both are in the whole runs too | as said | the relay no longer lines the fake's trackers up within 1 mm, a device's trackers or a prop on one are off, or the worn character no longer follows the performer. Nothing here has SteamVR: see [tools/trackers/README.md](../tools/trackers/README.md), "Tests" |
| The trackers' solver | `node tools/studio/test-ik.mjs` | Node | after changing `tools/studio/engine/ik.js` or the puppet in `tools/studio/test/make.mjs` | under a second | the solver no longer finds a Mixamo rig's parts or follows the walking test rig |
| The picture reader | `node tools/studio/test-images.mjs` | Node | after changing `tools/studio/engine/images.js` or `tools/studio/test/pictures.mjs` | seconds | a TIFF, PSD or DDS no longer reads back as the pixels it was made from, or a broken file is no longer refused in words |
| A model to GLB | `node tools/studio/convert.mjs <model> [out.glb] [--max-texture 4096] [--shots <dir>]` | Playwright | not a routine test: to convert the owner's models in a batch, or to try the converter on real files after changing `tools/studio/engine/convert.js` | seconds a model | it says what did not come through (an animation, a skin, a texture) and writes nothing |
| One set | `cd tools/<key> && node shot.mjs <set> "<query>|<query>|..." <prefix> [width height]` | server | while you change a 3D set | short | check the pictures in `tools/<key>/shots/` (git-ignored); page errors are printed |
| A whole story | `cd tools/<key> && node sweep.mjs <prefix> "t1,t2,..." [width height]` | server | after changing a built story's text, timing or camera | one page load | as for one set |

Worked examples of `shot.mjs` and `sweep.mjs` are in [tools/lbi/README.md](../tools/lbi/README.md) ("Changing
something"). After changing a story's text, also run `node tools/voice/narrate.mjs <key>` (every story but the airports
has a synthetic narration: it speaks the changed lines again and re-times the story from the recording; update its length
in `stories/list.js` from what it prints; then `node tools/voice/check.mjs <key>`; see
[tools/voice/README.md](../tools/voice/README.md)) and then `node tools/narration.mjs http://127.0.0.1:8123/`. Neither is a
test: they write the story's recording, `NARRATION_SYNC` and [narration.md](narration.md) again from the running stories.
`node tools/pace.mjs http://127.0.0.1:8123/ --write <key>` paces a new story from its words until it is narrated.

**Timing checks.** Some checks in the shared-room test are timed: play has to reach a following page within 5 s, and
a playing station has to keep to the relay's clock. Under software WebGL, long frames sometimes kept the page's timers
from running, so a following page fell behind and the clock check failed now and then. That is fixed: the shell's
pump in `shared.js` now also runs on each animation frame, and the test reads the clock five times. If a timing
check still fails once on a busy machine, run the test once more. A second failure is real.

**What these tests cannot show.** Anything that needs a real headset: controllers, placement, anchors, calibration,
shared spaces, and whether sound comes out. Report those as untested. What two Quest 3 headsets showed is in
[quest-shared-space-findings.md](quest-shared-space-findings.md) and AGENTS.md "Shared rooms".

## 4. Release checklist

`main` is what visitors get, because GitHub Pages publishes it (section 5). Since v116 work goes first to **`dev`**,
the test place: the owner's Coolify builds it at `https://stories.lab.lbi-netmed.com/` with every push (a webhook),
served by its relay, with the studio's scenes in R2. The tested working branch is pushed there (`git push origin
HEAD:dev`, a fast-forward, as for `main`), the owner tries it, and only then does `main` move forward to it (step 9).
Work happens on one working branch. `main` and `dev` only move forward by fast-forwards (they take the branch's commits
as they are, with no merge commit). `dev` moves after the cheap checks (`node --check` on the changed files, the builds'
`--check`, `node tools/release.mjs --check`); `main` only after the full tests pass (step 7; the owner, 7 November 2026:
"only running when pushing to main makes sense for now"). No pull requests are used. The `CNAME` file stays: it
is GitHub Pages' custom domain for `main`.

1. **Start up to date.** Run `git fetch origin`, then `git merge-base --is-ancestor origin/main HEAD && echo ok`. If
   it prints nothing, merge `origin/main` into your branch first.
2. **Edit the sources, never a built story.** Thirteen stories are built from `tools/<key>/`: lbi, nmd, endo, pet,
   micro, ovary, qubits, mutation, topo, soil, pass, flock and robots (pass also takes its globe and cell from `stories/airports.js` and
   `stories/spatial.js`: rebuild it after changing either). So are the design room (`stories/design.js` from
   `tools/design/`) and the miniatures (`lowpoly.js` from `tools/lowpoly/`, which the design room's names come from:
   rebuild the design room after changing them), and the studio (`stories/studio.js` from `tools/studio/`, with three.js
   r128's own add-ons from `tools/studio/vendor/`, never edited). `stories/airports.js`, `stories/proteins.js` and `stories/spatial.js` are edited by hand.
   Search them rather than reading them whole, because they are large.
3. **Rebuild.** If the data changed, run the data generator first (see the story's README), then rebuild the
   stories. Some parts feed several stories:

   | Source | Stories built from it |
   | --- | --- |
   | `tools/lbi/kit.js` | all thirteen built stories, the design room, the studio |
   | `tools/lowpoly/models-a.js`, `models-b.js` | `lowpoly.js` (the studio's icon, `studio.stage`, too), the design room |
   | `tools/lbi/sets/body.js` | lbi, pet, micro, ovary, topo |
   | `tools/lbi/sets/tissue.js` | lbi, micro |
   | `tools/nmd/sets/motor.js`, `tools/nmd/sets/data.js` | nmd, endo |
   | `tools/pet/sets/icons.js` | pet |
   | `tools/micro/sets/organs.js` | micro, topo |
   | `tools/lbi/sets/web.js` | lbi, soil (its globe) |
   | `tools/topo/sets/look.js` | topo, soil |

   Rebuilding all of them takes a few seconds:
   `for k in lbi nmd endo pet micro ovary qubits mutation topo soil pass flock robots lowpoly design studio; do node tools/$k/build.mjs; done`
4. **Bump `VERSION` in `sw.js`** (`networks-v127` on `dev` now, `main` at `networks-v121`, so `networks-v128` next) after any change to a file the app
   serves: `index.html`, `sfx.js`, `occlusion.js`, `shared.js`, `sw.js`, `manifest.webmanifest`, `three.min.js`, `three.LICENSE.txt`,
   `proteins.html`, `spatial.html`, `README.txt`, `lowpoly.js`, and anything in `stories/`, `audio/` or `icons/`. For a new file the
   app needs, add it to `SHELL` in `sw.js`. A narration goes in `AUDIO`, which already lists all sixteen file names. If
   the new file is not directly inside `stories/`, `audio/` or `icons/`, also add it to `APP_FILES` in
   `relay/server.mjs`. A new story goes in `stories/list.js` (its card), and `stories/<key>.js` in `SHELL`.
5. **Bump `FORMAT` in `shared.js`** (`networks-39` on `dev` now; `main` has `networks-35`) when the shared keys, or the shape of a story's
   `collab.state()`, change. A room refuses pages that have another format, so every device in a room has to update
   together. A new story alone no longer needs it: a device that does not know it yet shows its station as needing an
   update.
5b. **Write the release file:** `node tools/release.mjs`, after the `VERSION` bump. It writes `version.json` (the
   release, the format, the shell's fingerprint and per story its file's fingerprint and the oldest shell it needs)
   and stamps the shell's release into `index.html` (`HOST.shell`); commit both. Running pages read it about once a
   minute and take the release: new and changed stories by themselves (a changed story on show at a quiet moment),
   a new shell or format after asking (Reload now or Later). It refuses a changed shell without a new `VERSION`. A
   story that only works with the new shell gets it as its `needs` by itself; give a story an older `needs` in
   `stories/list.js` only when you know it runs on older shells.
5c. **Write what is new:** rewrite `whatsnew.json` by hand for the new `VERSION`: `{ "version": "networks-vNNN",
   "date": "...", "new": [...], "test": [...], "untested": [...] }`, short plain sentences (what changed, what the owner
   should try on a headset and a phone, what nobody could check here; a handful each, so the headset's page stays
   readable). Developer mode shows it on pages and at the start of each headset session (AGENTS.md, "Developer mode").
   It is fetched fresh every time and is not in `SHELL`, so it needs no `VERSION` bump of its own;
   `node tools/release.mjs` warns, and `--check` fails, while it names another release. `--check` is also one of
   `dev`'s cheap checks, so `whatsnew.json` must name the release before a push to `dev` too.
6. **Update the docs.**
   - AGENTS.md first: it is the single source of truth for structure.
   - README.md and README.txt: they hold the same notes, so keep them in step.
   - The story's `tools/<key>/README.md`, its `SPEC.md` and the set manifests.
   - The chapter timings in `audio/PUT-narration.mp3-HERE.txt`.
   - [narration.md](narration.md) (with `tools/narration.mjs`) if a story's text changed.
7. **Run the tests** before `main` moves (for `dev`, only `node --check` on the changed files, the build check and
   `node tools/release.mjs --check`): the build check, `node tools/release.mjs --check`, smoke, update, live updates,
   relay and shared rooms, plus sound if you touched sound and the room test if you touched it. All of them must pass.

   **The first release run after v121 must be whole.** `main` is `networks-v121`; v122 to v127 are on `dev` only, and
   the full suites have not run whole on v124 to v127. Before `main` moves to them, run all of these (section 3 has
   what each needs):

   ```sh
   for k in lbi nmd endo pet micro ovary qubits mutation topo soil pass flock robots lowpoly design studio; do node tools/$k/build.mjs --check; done
   node tools/release.mjs --check
   node tools/studio/scan.mjs tools/studio/test/scenes --check
   node tools/smoke.mjs http://127.0.0.1:8123/          # the whole test: no --only
   git worktree add /tmp/old origin/main && node tools/update.mjs /tmp/old . && git worktree remove /tmp/old
                                                        # against v121: sw.js changed (whatsnew.json passes through it)
   node tools/live.mjs                                  # tools/release.mjs changed
   node relay/test.mjs                                  # its --trackers part included
   node tools/collab.mjs                                # every round, the --trackers round included
   node tools/collab.mjs --token                        # the relay's password: not in the main run
   node tools/audio.mjs http://127.0.0.1:8123/          # sound changed in v124
   node tools/studio/test-ik.mjs
   node tools/studio/test-images.mjs
   ```
8. **Commit on the working branch**, sources and built files together.
9. **Fast-forward main, then push the branch:**

   ```sh
   git push origin HEAD:main     # refused if main has moved on: go back to step 1
   git push origin HEAD          # the working branch too
   ```

   Never push to main with `--force`.
10. **Check the live copy.** After about a minute, the repository's Actions tab shows a finished "pages build and
    deployment" run, and `curl -s https://stories.lbi-netmed.com/sw.js | sed -n 3p` shows the new `VERSION`. The test
    place shows `dev`'s at `https://stories.lab.lbi-netmed.com/sw.js` a minute or two after `dev` is pushed.

**What visitors and headsets then get** (see `sw.js`, and `HOST.live` and `HOST.reloadIfUpdated` in `index.html`;
AGENTS.md "Hot reload and live updates"):

| Who | What happens |
| --- | --- |
| a new visitor | the new version |
| a returning visitor who is online | the new version on the first load. The page and story files are checked with the server on every load (Pages lets browsers keep files for ten minutes, but the service worker asks anyway). The new service worker installs, takes over at once and deletes the old offline copy |
| a page left open (a kiosk, an installed app, a headset browser) | within about a minute (or as it comes back into view): a new story's card appears, a changed story is fetched fresh next time it starts, and the story on show is swapped in place at a quiet moment (paused, explore mode, a Stories screen, a chapter's end), keeping its place. A new shell or format (or a story that needs one) is asked about first, on the page as a bar and in a headset as a panel: Reload now keeps the place (in a headset the reload ends VR or AR, so the page shows one button, Enter VR to continue); on the page's Stories screen outside a headset it reloads by itself |
| someone offline | the copy saved at their last visit online |
| headsets that use a relay's `--lan` address | they get no service worker there (the certificate is self-signed), so they get whatever files the relay machine's checkout holds. Update that checkout with `git pull`: the relay reads each file from disk when it is asked for |

Installed copies play narrations from their offline copy, so a replaced narration only reaches them with a new
`VERSION`.

## 5. Deploying

### GitHub Pages (the live copy)

*Checked 22 October 2026:*

- The repository is public. Pages publishes branch `main`: each push to main starts a "pages build and deployment"
  run (see the Actions tab), which deploys to the `github-pages` environment.
- The site's root is the repository's root. `https://unfriend.github.io/airportnetworks/` served `sw.js` with
  `networks-v64`, which was main's `VERSION` that day.
- Since 2 November 2026 the site has a custom domain, `stories.lbi-netmed.com` (the `CNAME` file on main, added by the
  owner); the github.io address redirects there (301). Everything a browser keeps (the installed app, settings, an
  anchored place, calibrations and their anchors, rooms kept on a device, Quest's shared space) belongs to the address,
  so it started afresh at the new one.
- **The test place** (v116; the owner, 5 November 2026: the main site "will stay on github pages, deployed from main and
  works as it always worked", and branch `dev` goes to the owner's Coolify, at `stories.lab.lbi-netmed.com`, with a
  webhook, saving the studio's models to Cloudflare R2): see [relay/README.md](../relay/README.md), "The test place on
  Coolify". Since v120 the owner's Coolify also runs `main` as the main site's relay at `main.lab.lbi-netmed.com`, which
  the main site offers (`HOME_RELAY` in `shared.js`): a device with its password runs its rooms there, one without it peer
  to peer (as every device did from v116 to v119).
- Pages publishes **everything** on main, not only the app. `tools/` and `docs/` can be downloaded from the live site
  too (and `ikerdata/` could, until it was removed from the repository on 3 November 2026). The relay, and its Docker image, serve only the app's files.
- Pages sends `Cache-Control: max-age=600` and ETags (tags that let a browser ask whether a file changed). The update
  test copies this behaviour.

**TO FILL (owner):** in Settings > Pages, confirm the source (Deploy from a branch: `main`, folder `/ (root)`) and
any custom domain, and say who has admin rights to change them.

### Another HTTPS host

Copy the files listed in step 4 of section 4 to any static HTTPS host. A sub-folder works, because every path in the
app is relative. Installing the app, and VR and AR, need HTTPS. Each host is a separate address: installed copies,
saved settings and headset calibrations do not carry over from one address to another.

### The relay

- **For an event**, see [relay/README.md](../relay/README.md) ("A session on one Wi-Fi, step by step") and
  [event-runbook.md](event-runbook.md). The relay serves the app from its own checkout. Bring it up to date with
  `git pull` before an event, not during one.
- **The Pages copy** (the main site) runs its rooms peer to peer (PeerJS's public introduction server and Cloudflare's STUN server; see
  [data-and-permissions.md](data-and-permissions.md) for what they see), or joins a relay somewhere else
  (`&relay=wss://...` in the room link). Both must have the same `FORMAT`. It cannot use a relay, or a relay's
  introduction server (`&peer=`), with a self-signed certificate.
- **Public hosting** with Docker or Coolify: see [relay/README.md](../relay/README.md) ("Public hosting on
  Coolify": a step-by-step guide). On the internet the relay runs with `--public` (only the app's pages may connect,
  no list of open rooms and no names, limits per address, logs only with a token), set in Coolify's environment as
  `RELAY_ARGS="--proxy 1 --public"`, and its shared password as a secret variable, `COLLAB_TOKEN` (every device enters
  it once; relay/README.md, "The shared password"; empty: no password). Locally: `docker build -f relay/Dockerfile -t networks-relay .`, then
  `docker run -p 8787:8787 networks-relay` (as on a laptop), or with `-e RELAY_ARGS=--public -e COLLAB_TOKEN=<word>`
  (as on the server). The image's health check asks `/api/health`, which needs no password.
  After touching the relay, run `node relay/test.mjs`, and after touching the password in `shared.js`,
  `node tools/collab.mjs --token` (a minute or two).
- **The studio's scenes** (v111): the relay serves them from a folder with `--scenes <folder>` (relay/README.md, "Your
  own scenes (the studio)"): at an event `node relay/server.mjs --lan --scenes <folder>`; on Coolify a *Persistent
  Storage* volume the user `node` may write to (say at `/scenes`) and `--scenes /scenes` added to `RELAY_ARGS` (or
  `COLLAB_SCENES=/scenes`). On the internet (`--public`) it refuses to start with scenes and no password
  (`COLLAB_TOKEN`). The image installs `ffmpeg` for long uploaded sounds (a layer of about 133 MB; built only as a
  scratch variant so far, not on Coolify). The owner's scene files never go into the repository. After touching the
  scenes or uploads, run `node relay/test.mjs` and `node tools/collab.mjs --studio`.
- **The studio's scenes in Cloudflare R2** (v114; the owner, 5 November 2026: the relay on Coolify on Hetzner, the scenes
  in R2): `--scenes r2` in `RELAY_ARGS`, the bucket and its keys as Coolify secrets (`R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and `R2_JURISDICTION=eu` for a bucket made in the EU), the
  bucket's CORS rule pasted from relay/README.md ("Scenes in Cloudflare R2", the owner's steps), no *Persistent Storage*
  volume. The start lines say whether the keys work, how the CORS rule answers a browser and what the bucket says to an
  upload link (`R2 upload links: ...`); in the container's terminal `node relay/server.mjs --scenes r2 --r2-check` checks
  the same and stops. A bucket that does not answer at the start (R2 away for a moment) does not stop the relay: the
  rooms work, the scenes answer 502 until it answers, and the log says when it does. With more than about 1,000 objects
  in the bucket and a studio page left open, set `R2_POLL=15` or more (each listing costs one Class A operation per
  1,000 objects). Scenes move between the bucket and a folder
  with `node tools/studio/r2sync.mjs` (`push ~/scenes --all` once to fill the bucket; `pull --all ~/scenes` before an
  event with no internet). After touching `relay/r2.mjs`, the store in `relay/server.mjs` or `r2sync.mjs`, run
  `node relay/test.mjs` (it runs `relay/test-r2.mjs`, the signer against AWS's published examples) and
  `node tools/collab.mjs --studio` (its R2 part runs against the stand-in S3, `relay/s3fake.mjs`). Untested with a
  real bucket until the owner's is set up.
  **Public relays now** (decided): two run on the owner's Coolify, both with `--proxy 1 --public --scenes r2` and a
  password of their own: the test place (branch `dev`, `https://stories.lab.lbi-netmed.com/`, which serves the app
  too) and the main site's relay (branch `main`, `https://main.lab.lbi-netmed.com/`, which the main site offers; its
  scenes under its own `R2_PREFIX`). Each redeploys on a push to its branch (relay/README.md, "The test place on
  Coolify"). Neither runs `--trackers`: the Vive trackers need the relay on the PC with SteamVR.

## 6. Rolling back

Never move main backwards: no force push and no reset. Instead, add a commit that undoes the bad one, with a new
`VERSION`, so installed copies take the old files again:

```sh
git fetch origin
git switch -c rollback origin/main
git revert --no-edit <bad commit>         # for several commits, newest first
# in sw.js, set VERSION to a number never used before (the revert brings back an old one)
git commit -am "Roll back <what>; VERSION networks-vNN"
git worktree add /tmp/old origin/main && node tools/update.mjs /tmp/old . && git worktree remove /tmp/old
# serve the folder and run the smoke test too
git push origin HEAD:main
git switch <working branch> && git merge origin/main   # so the next fast-forward works
```

- Pages publishes the rollback about a minute later. Open pages and headsets pick it up as the table in section 4
  describes. On a relay machine, run `git pull`.
- If the bad release changed `FORMAT`, the rooms made with it will refuse the rolled-back pages, so start new rooms.

## 7. The repository and its owner

*Checked 22 October 2026:* the repository is `github.com/unfriend/airportnetworks`. It is on a personal account,
public, with `main` as its default branch. Pages is on, forking is allowed, and there is no licence, either on GitHub
or in the repository (see "Decisions for the owner" in [HANDOVER.md](../HANDOVER.md)).

| Branch on GitHub | What it is |
| --- | --- |
| `main` | the live copy (GitHub Pages at `https://stories.lbi-netmed.com/`, and the main site's relay on Coolify) |
| `dev` | the test place, `https://stories.lab.lbi-netmed.com/`, deployed by Coolify on every push; work goes here before `main` (section 4) |
| `claude/trusting-hypatia-ca5qv0` | the agents' working branch up to the handover (the same commit as `dev` on 9 November 2026) |
| `claude/affectionate-pasteur-stzjl3` | an older agent branch; its last commit, `28ce276` of 22 October 2026, is already in `main` and `dev` |
| `logs-2026-10-17` to `logs-2026-10-20-new4` (seven branches) | headset alignment logs pushed for analysis ([relay/README.md](../relay/README.md), "Logs"). Their file names and contents hold people's first names and room codes. Whether to keep or delete them is the owner's decision |
| `copilot/assess-code-quality-security` | its last commit is already in main |

- **TO FILL (owner):** the institute organisation the repository moves to, and when.
- **TO FILL (owner):** who gets admin rights and who gets write access.
- **TO FILL (owner):** whether main gets a rule against force pushes and deletion (Settings > Rules).

**Moving the repository.** The owner does this in Settings > General > Danger Zone > Transfer ownership, and needs
the right to create repositories in the organisation. After the move:

- GitHub redirects the old repository address. Even so, update each clone (`git remote set-url origin <new address>`)
  and the clone line in [relay/README.md](../relay/README.md).
- The Pages address follows the owner: `<owner>.github.io/airportnetworks/`. GitHub's documentation on transfers says
  Pages sites are not redirected, so check this at the time.
- A new address starts empty in every browser and headset. Installed apps, the mute and Repeat settings, an anchored
  place, room calibrations and their anchors, rooms kept on a device, and Quest's shared space all belong to the
  address. Tell people the new address, install the app again, and calibrate the headsets again. A custom domain
  would keep one address through any later move.
