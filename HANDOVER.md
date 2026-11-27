# Start here: handing over Networks

An installable web app that teaches network science in twenty narrated 3D stories (the tutorial among them), each followed by an explore mode,
on desktops, phones and VR/AR headsets (built for Meta Quest Browser). Several headsets can share one room. There is
no build step and no framework: plain HTML and JavaScript with a vendored three.js, deployed by copying the folder to
any HTTPS host. This page is for the colleagues taking it over: what there is, what state it is in, what is still open,
and where to read on.

**Warning: Claude Code runs without asking here.** This repository's `.claude/settings.json` allows every command, file
edit, web fetch and agent without a permission prompt (the owner, 14 November 2026, for a cloud machine used only by
Claude). Anyone who runs Claude Code on their own computer with this repository gets the same. If you do not want that,
delete or edit `.claude/settings.json` (or override it in your own `.claude/settings.local.json`) before you start.

## What to read, by role

| You will... | Read |
| --- | --- |
| show the stories (screens, kiosk, headsets) | [README.md](README.md) (installing, using), [docs/event-runbook.md](docs/event-runbook.md), [relay/README.md](relay/README.md) for shared rooms |
| check or answer for the science | [docs/data-and-permissions.md](docs/data-and-permissions.md), [docs/questions-for-authors.md](docs/questions-for-authors.md), the story's `packages/<key>/src/SPEC.md` |
| record a narration | [docs/narration.md](docs/narration.md) (the words and times), [docs/narration-timings.txt](docs/narration-timings.txt); a synthetic voice: [tools/voice/README.md](tools/voice/README.md) |
| change the code | this page, then [docs/setup-and-release.md](docs/setup-and-release.md) and [AGENTS.md](AGENTS.md) (the core: structure, rules, conventions, testing) and its detail files in [docs/agents/](docs/agents/) (every shared-room rule, the studio, each story, every test) |
| work with an AI coding agent | [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md) are written for agents too; see "Working with AI agents" below |
| run the studio, its scenes and uploads | [tools/studio/README.md](tools/studio/README.md), [relay/README.md](relay/README.md) (scenes, R2, the upload page) |
| set up the PC with the Vive trackers and the Index | [tools/trackers/README.md](tools/trackers/README.md), [tools/trackers/SPEC.md](tools/trackers/SPEC.md), [relay/README.md](relay/README.md) ("The PC's Vive trackers") |
| release (and write the *What is new* box) | [docs/setup-and-release.md](docs/setup-and-release.md); `whatsnew.json` is rewritten by hand at every release |

## The twenty stories

The order on the Stories screen is `packages/order.json`; five stories sit on the Experiments set (`proteins`, `flock`,
`robots`, `cdk5`, `exposome`; the cell stress test and the example `hello` too), the rest on the main cards.

| Story | Key | Source | Narration | Data |
| --- | --- | --- | --- | --- |
| Network theory: Airports | `airports` | `packages/airports/main.js` (hand-written) | recorded | real (OpenFlights routes) |
| Network medicine: Proteins | `proteins` | `packages/proteins/main.js` (hand-written) | synthetic (Kokoro, `af_heart`) | curated proteins and interactions |
| Spatial interactome: Cell map | `spatial` | `packages/spatial/main.js` (hand-written) | synthetic (Kokoro, `af_heart`) | curated, laid out at load time |
| LBI Network Medicine: The future | `lbi` | `packages/lbi/src/` (built) | synthetic (Kokoro, `af_heart`) | illustrative scenes, some real data |
| Rare muscle diseases: Muscle and heart | `nmd` | `packages/nmd/src/` (built) | synthetic (Kokoro, `af_heart`) | the authors' files (kept out of the repository since 3 November 2026), some stand-ins |
| Disease endotypes: Endotypes | `endo` | `packages/endo/src/` (built) | synthetic (Kokoro, `af_heart`) | the authors' EndotypY run (kept out of the repository) |
| Whole-body PET: One scan, one system | `pet` | `packages/pet/src/` (built) | synthetic (Kokoro, `af_heart`) | the paper's tables and figures, some stand-ins |
| Tissue microanatomy: Tissue and time | `micro` | `packages/micro/src/` (built) | synthetic (Kokoro, `af_heart`) | the preprint's numbers, Iva Buljan's network (kept out) |
| Ovarian aging: The aging ovary | `ovary` | `packages/ovary/src/` (built) | synthetic (Kokoro, `af_heart`) | the poster's numbers typed in and values read off its figures (the ovary's count tags: approximate); the neighbor network illustrative |
| Quantum network compression: Three qubits | `qubits` | `packages/qubits/src/` (built) | synthetic (Kokoro, `af_heart`) | example networks computed live; the real run's summary numbers from Joel Hancock's brief (his method and figures) |
| Quantum phylogenetics: The mutation machine | `mutation` | `packages/mutation/src/` (built) | synthetic (Kokoro, `af_heart`) | example numbers computed live, as in the authors' own test; the poster's numbers typed in, shown only as "in the authors' test"; the coupling computed live is our stand-in for their circuit |
| Tissue topology: The shape of tissue | `topo` | `packages/topo/src/` (built) | synthetic (Kokoro, `af_heart`) | every number computed by the authors' package topocyte on their GTEx liver cohort (the files kept out of the repository; only the numbers in it); the poster's numbers all reproduced; the genes and proteins of the last chapter are sketches |
| Soil microbes: Holding on to nitrogen | `soil` | `packages/soil/src/` (built) | synthetic (Kokoro, `af_heart`) | the field trial's data (16S read counts, their taxonomy, the field metadata; the files kept out of the repository, only the numbers in it); the slides' charts read off (approximate); the soil block, its flows and the field's layout illustrative; the co-occurrence network built for this story |
| Brain kinase: The switch that sticks (on the Experiments set since v189; written by Christiane Hütter on a fork) | `cdk5` | `packages/cdk5/src/` (built) | synthetic (Kokoro, `af_heart`) | real (the Menche lab's public CDK5_data: the interactome, every layout, colour and link decoded from its VR project's textures, through `CDATA`; never laid out again in the app); the close-ups, tags and the process knots' names ours, said so |
| Networks for everyone: Pass it on | `pass` | `packages/pass/src/` (built; its globe and cell cut out of `packages/airports/main.js` and `packages/spatial/main.js` at build time) | synthetic (Kokoro `af_heart`; German: Piper, Thorsten) | the airports' routes and the cell map's proteins as in those stories; the fish and the outbreak are simulations; English and German |
| Collective motion: Flock | `flock` | `packages/flock/src/` (built) | synthetic (Kokoro, `af_heart`) | a live simulation |
| Swarm robotics: Robot gang | `robots` | `packages/robots/` (a story package, built from its `src/`) | synthetic (Kokoro, `af_heart`) | a live simulation |
| Spatial interactome: Back into the cell (on the main cards since v188) | `ppicell` | `packages/ppicell/src/` (built) | synthetic (Kokoro, `af_heart`; 15:08, the longest) | the interactome of Menche et al. 2015 (13,460 proteins, 141,296 links), the Human Protein Atlas's places, since v205 UniProt's membrane sides and the Complex Portal's complexes (its terms to confirm before `main`); the judgement is the story's own method; the model cell is illustrative; since v207 your own network in explore |
| Chemical exposome: Invisible threads (on the Experiments set since v212) | `exposome` | `packages/exposome/src/` (built; its cell is cut out of `packages/ppicell/src/sets/cell.js` and its globe out of `packages/airports/main.js` at build time) | synthetic (Kokoro, `af_heart`; 9:48) | the authors' public Zenodo deposit (CC BY 4.0), derived numbers only: 9,887 substances, the network of 9,764, 6,177 diseases, 32 countries; built on CTD, DisGeNET (non-commercial terms) and the Global Burden of Disease (IHME): whether those terms allow showing derived numbers publicly is open (`docs/data-and-permissions.md`) |
| Introduction: Your guide | `tutorial` | `packages/tutorial/src/` (built; `intro: true`, the last card since v180) | synthetic (Kokoro, `af_heart`; 3:35, then seven practice tasks) | none: a robot guide (the people's armour figure, posed by code) shows how the app works |

"Built" stories are generated: edit `packages/<key>/src/` and run `node packages/<key>/src/build.mjs`, then `node
tools/packages/scan.mjs` (`--check` says whether the built file is in step); never edit a built `packages/<key>/main.js`
by hand (airports, proteins and spatial are hand-written: their `main.js` is the source). What is real and what is a stand-in, story by story, is
in [docs/data-and-permissions.md](docs/data-and-permissions.md).

## Where things stand

<!-- state (tools/release.mjs) -->
The current release is `networks-v226` (shell 226), the room format `networks-61`, released 27 November 2026. (Written by `node tools/release.mjs`, checked by its `--check`.)
<!-- /state -->

**The state is read, not typed here.** The current release is `version.json` (its `version`, `shell` and `date`; `sed -n 3p
sw.js` is the same number) and what it brought is `whatsnew.json` (the same box developer mode shows: what is new, what to
test, what is untested); every earlier release has its own `whatsnew/networks-v<n>.json`. The room format is
`grep -n "FORMAT = " shared.js | head -2`. Which commit each branch is at: `git fetch origin && git log --oneline -1
origin/main origin/dev`. All twenty stories are packages (`packages/order.json`). `dev` is the test place and goes ahead of
`main`; `main` (what visitors get) moves only after the owner has tried `dev` and the full suites have run (as of 26
November 2026 `main` was still at v135, so everything since is on `dev` only). The developer notebook's open notes:
`node tools/notes/notes.mjs list` ("No new notes." on 26 November 2026).

The log of every release from v96 to v213 (what it built, who asked, what was tested and what not) and the state as it was
told then are in [docs/history/releases.md](docs/history/releases.md) (`^## v<N>` finds one); newer ones are in
`whatsnew/`, [docs/history.md](docs/history.md) and `git log`. The owner's decisions that are built or made are in
[docs/history/decided.md](docs/history/decided.md).

### Open points

One list, last checked against the code and the newer docs on 26 November 2026 (v213); nothing in it was run on that day.
Where a line says "last recorded", the state may have changed since. Each entry's own *Untested* is in
[docs/history/releases.md](docs/history/releases.md).

*Waiting on the owner*

1. The whole release run (smoke, relay, collab, update, live, sound) before `main` moves: no release since v135 has had it
   beyond each builder's own blocks; the studio smoke block holds a stick check edited at v202 and not run. Full suites run
   only before `main` moves (`AGENTS.md`, "Testing").
2. Terms: the EBI Complex Portal and the Human Protein Atlas (complex memberships in
   `packages/ppicell/src/sets/sides.js`, places in `data.js` and `data/lookup.json`: "we will confirm the terms later",
   `docs/data-and-permissions.md`); DisGeNET's and the Global Burden of Disease's (IHME) non-commercial terms, whether they
   allow showing the exposome story's derived numbers on the public site (`docs/data-and-permissions.md`, the exposome rows
   and checklist); terms from gene-set libraries in Back into the cell (`packages/ppicell/src/SPEC.md`, "Terms from gene-set
   libraries").
3. The goggles' flight status sent to the room (the ephemeral effect `gog`, v203: counts and protein names, no pose), which
   changed the rule that the goggles send nothing: built without asking, to keep or to remove.
4. The knee trackers' place in the tracker guide (on the thigh just above the knee: an assumption, `KNEE` in
   `tools/studio/tracker-guide/parts.js`); the other places are the owner's.
5. Recordings unheard: Back into the cell's new voice (15:08, the longest story: trim if too long; JAK2 is spelt out and BiP
   read "bye pee"; the old one is kept as `packages/ppicell/src/narration-v204-old.mp3` until then), the exposome story's
   voice (9:48) and its sound cues; the CDK5 story's voice. Nothing of the exposome story has been in a headset or a shared
   room (v212's `whatsnew.json`).
6. Every device in a room must be on one release (FORMAT went 55 to 59 from v196 to v208); the main relay gets the shared
   networks' store only when `main` moves.
7. The CDK5 story: its row in `docs/data-and-permissions.md` is marked **TO FILL**; a structure for every node of its small
   subnetworks (`packages/cdk5/src/SPEC.md`: counted and estimated, 135 proteins, about 217,000 triangles and 2.8 MB at the
   coarsest level; not started, waiting on the owner's word). In Back into the cell in AR the interactome ball looked half
   bright and half dark (probably real-world occlusion: retry with occlusion off) and some blue and white dots showed in
   front (probably really in front: re-check); a real *Record a run* log is wanted (the only one on the relay is a
   one-second desktop test).
8. The decisions below ("Decisions for the owner"): the authors' permission (item 2), who holds the repository and the live
   site's accounts (items 3 and 5), the history's public files (item 4), who to ask (item 6), the licence's holder (item 1),
   which sounds to keep (item 12), the PET story's second half waiting on the poster (item 8). **What the next person
   needs from the owner** (no passwords or keys are in the repository, and none should be): access to the GitHub repository
   (`unfriend/airportnetworks`, a personal account), to the two Coolify resources (the test place and the main site's relay:
   their `RELAY_ARGS`, `COLLAB_TOKEN` and `R2_*` settings), to the Cloudflare R2 bucket and its keys, the two relays'
   passwords, the domain `lbi-netmed.com` and its `lab` names, the authors' data files (kept by the owner; needed only to
   make a story's data again: `docs/data-and-permissions.md`, "Inputs not in the repository"), the owner's own studio scenes
   (in R2, never in the repository), the headsets and the trackers' PC. **TO FILL (owner):** who holds each of these and how
   the next person gets it.
9. An idea, not started: a paper on Back into the cell's layout method (the owner, 23 November 2026;
   `packages/ppicell/src/SPEC.md`, "A paper on the layout method (idea)").

*Waiting on the authors and the colleague*

10. The authors' answers (`docs/questions-for-authors.md`): C1 and C3 to C10 (the colleague Christiane Hütter's, for the
    CDK5 story; in particular C8, why CDK5 with p25 leaves its place: the story names no mechanism until answered, and C9,
    two spoken lines the data does not back: CDK5's say in NPAS4's pathway, whose only link was drawn by the authors, and
    "even in the nucleus"), S1 to S9, MM1, MM5, MM6, T5, P4 to P11. Blanks to fill besides: the CDK5 row and the exposome row
    in `docs/data-and-permissions.md`, the licence's holder (item 1), who to ask (item 6).

*Parked or not started* (the file's own estimates; all under "Decisions for the owner", item 7, except where named)

11. glTF round trips, about 1.2 to 2M tokens; snapping in the studio; quicker hot reload; "Line up with someone", about 1 to
    1.5M tokens; a voice assistant, 9 to 12 hours and 4.5 to 6M tokens; German for every story, 1.5 to 2 days (and 1 to 1.5
    more for explore); circles that load code from a link, 5 to 8 hours; the studio's *Real room* look, 2 to 3 hours; see
    through their eyes, 3 to 4 hours; the real-world-to-virtual slider, 2 to 3 hours; uploading from Google Drive, 3 to 4
    hours; Talk in peer-to-peer rooms; a probe of Quest Browser's WebXR body tracking, 1 to 2 hours; a performance round (the
    cell's models pinned to their finest level, memory made each frame in ovary, endo and micro, overdraw, downloads). Dropped:
    a texture cube's crossfade (the owner, "no crossfade needed"), the invisible stand-ins for other headset wearers, the
    player for stories written as data. Built since they were listed: a character worn with a headset and controllers alone
    (v164, v201, v204).

*Untested on a device* (everything a device alone can show: controllers, placement, comfort, shared spaces, calibration,
anchors, trackers, sound zones, occlusion, ships, the studio's grips, sticks and emitters, frame rate; how sounds and voices
sound)

12. Since v184: the stories loaded from packages with their narration; *Take all stories* in Quest Browser; the two sets of
    cards (main and Experiments) and their Open and back cards; leaving AR with a pop-up open (v188); the G protein at 48,000
    triangles in Back into the cell's Walls; station icons from the packages' `minis.js` (v190); the reworked CDK5 story
    (structures, docking, frame rate with 16,376 points; its voice unheard). Everything from v200 to v213 (the tracker guide,
    a studio character worn with any mix of devices, the mirror robot, the sharp text, the tour, Back into the cell's sides,
    complexes and your own network, the exposome story, the font) has not been tried on a headset, with trackers or on the
    owner's relays.

*Known bugs and noisy tests* (none blocks a release; each is a few hours or less; last recorded in v191 and v178 and not
re-run since)

13. Tests: the smoke step `studio sequences` is red (the page that started a sequence and a page given its state differ by
    one frame of the 0.4 s fade just after a show at 1.5 s; cause not found); `flock: anchored placement` ("no word while
    the saved place is being looked for") has been red since before v187, also for the robot gang, on unchanged code, run
    alone, the airports pass (the test's or the shared engine's, unknown); `smoke.mjs --only studio` stops at the main studio
    block's ninth step with "Cannot read properties of null (reading 'target')" in `carry` (a pretend headset's grip let go
    before the step uses it); the full `node tools/collab.mjs` run has not reached its end on the cloud machine (smooth,
    walk, welcome and the relay-clock checks fail only in long runs under software drawing; `--all`, `--ask` and `--design`
    pass alone); `tools/output/test-page.mjs` says "cannot be checked here" for live sound's pace (to be tried on a real
    output page); the robots do not dock in the smoke test about one run in eight (a robot still driving after 20 s, or
    standing still away from its spot after 40 s; worth a look in `packages/robots/src/sets/robots.js`, how a robot gives up
    on a blocked path). Known noisy, not app bugs as far as anyone found: peer-to-peer timing in the shared-room run, the
    shared-room run under heavy load, the studio behaviours round's Pause and looker checks, "a circle made for one scene" in
    the studio round (likely the race fixed in v179).
14. The Index lined up by the trackers (`trkEstimate` in `shared.js`): the trackers' samples carry the time the bridge read
    them, the head its predicted pose for the display; with the stillness gate at 0.5 m/s (`TRK_FR.speed` in `shared.js`) a slow
    drift could pair them 2 to 3 cm apart. Fix idea: a tighter gate (0.1 m/s, 0.3 rad/s) and a test with a fixed lag. How far
    a tracker's pose origin lies from the Index's eye centre is unknown.
15. Tracker names: the room's `trk` key is one value, so two pages naming different trackers at the same moment can lose one
    name (the last writer wins). A take from a model in centimetres (an FBX): whether the converter scales the hips' place
    keys when it bakes the model's scale is unchecked.
16. The solver (`ik.js`): with six trackers the upper arms' and forearms' twist can be up to 12 degrees off (only bends about
    the elbow and knee hinges are tested); `IK.calibrate` works the scale out from the size the character has now (the studio
    calibrates again at its record's scale, so it holds there); the headset alone with stepping legs (`'head'`) is used
    since v164 (people's bodies) and v201 (the studio's `rig: 'any'`) with the stepping calmed (`GLIDE` in `ik.js`); how it
    looks on a real character is untested.
17. From v125: a two-hand carry of a group while moving with the sticks in the studio may drift; the room-frame block's Undo
    check in `collab --studio` may count a following sound; a take recorded on a page that draws in software gets only a few
    keys a second.

*Next*: the release flow (`docs/setup-and-release.md`, section 4): try what is on `dev` on the devices (a Quest, an Android
phone, the Windows PC with SteamVR and the trackers: `tools/trackers/README.md`); then, at the owner's word, `main` gets `dev`
after the full suites (what each change adds to that run is in the `AGENTS.md` and `docs/agents/` "run ... after touching"
lines and `docs/agents/testing.md`). Closed on 26 November 2026 (v213): the web font no longer loads from Google Fonts (B612
is served from `fonts/`, SIL OFL 1.1; `docs/data-and-permissions.md`).

## Decisions for the owner

Before handing over (or making anything more public), someone has to decide these; the docs mark each place with
**TO FILL (owner)**. For a handover the first to fill are 2 (the authors' permission) and 6 (who to ask), and 1's holder (the licence is chosen).

1. **Licence: chosen, the holder still to clarify.** Since 20 November 2026 `LICENSE` is MIT for the code and
   `NOTICE.md` puts the stories' words, the narrations (the airports' recorded by its speaker, the owner, who agreed),
   the documentation and the icons under CC BY 4.0, the data under its sources' terms (the table in
   [docs/data-and-permissions.md](docs/data-and-permissions.md)) and the parts written by others under theirs. `LICENSE` names Martin Chiettini for now (the owner: "add martin chiettini for now, leave it in to clarify
   for later"): an employer may hold the rights to software written at work (§ 40b of the Austrian copyright act,
   UrhG), so the copyright line (and `NOTICE.md`'s credit) may change once the employer has answered.
2. **The authors' permission** to show their data, figures, posters and talks publicly (muscle, endotype, PET,
   microanatomy, mutation machine (a draft poster), tissue topology (the authors' cohort data and code), soil (the
   slides and the field trial's data, unpublished: given through the owner on 29 October 2026; whether it may be public
   before publication is still to say) and tour stories). Record what was agreed, and with whom, in the same
   document.
3. **The repository**: it is public, on a personal GitHub account (`unfriend/airportnetworks`), licensed since 20
   November 2026 (item 1).
   Every pushed branch is public too, the working branch included. Decide whether it moves to an Institute
   organisation, who gets admin rights, and whether it stays public.
4. **Things already public** that may not belong there: the `logs-2026-10-*` branches (headset logs whose file names
   carry people's first names and room codes), the muscle story's authors' files (`ikerdata/`, 88 MB: removed from the
   repository on 3 November 2026, so the live site no longer serves them; they are still in the history, from
   `4d7aacc`, which only a rewrite would take out) and screenshots in the history (commits
   `d7c7862`, `e548fa0` and `e3f6b4f`, removed in `bdc8a8e`; drawn content only). Deleting branches or rewriting
   history cannot be undone for those who already fetched them: decide first. *Decided for the branches* (the owner, 20
   November 2026): delete the `logs-2026-10-*` branches, and the old agents' branch `claude/affectionate-pasteur-stzjl3`
   (nothing on it that `dev` lacks); a cloud session may push only `dev`, so they are deleted on GitHub by hand. *Done, as far as the repository shows* (26
   November 2026: `git ls-remote --heads origin` lists only `claude/trusting-hypatia-ca5qv0`,
   `copilot/assess-code-quality-security`, `dev`, `main` and `unity-importer`: the `logs-2026-10-*` branches and
   `claude/affectionate-pasteur-stzjl3` are gone). The history behind the other points of this item is unchanged. The checklist is in
   [docs/data-and-permissions.md](docs/data-and-permissions.md).
5. **The live site**. *As it is now (9 November 2026):* the main site is GitHub Pages from `main` at
   https://stories.lbi-netmed.com/ (`lbi-netmed.com` is at Namecheap; the `CNAME` file stays). The owner's Coolify (on
   Hetzner) runs two copies of the relay, both with `--proxy 1 --public --scenes r2`, a password and the R2 keys in
   their environment: branch `dev` at https://stories.lab.lbi-netmed.com/ (the test place) and branch `main` at
   https://main.lab.lbi-netmed.com/ (the main site's relay, offered there behind its password; its own `R2_PREFIX`).
   Every name under `lab.lbi-netmed.com` points at that server with a wildcard certificate (a DNS challenge through
   Hetzner); a domain changed in Coolify needs a redeploy. The history of how it was decided (the relay on a public server and its password, free hosting, the 5 November decision) is in [docs/history/decided.md](docs/history/decided.md).
   GitHub Pages publishes `main` at the owner's custom domain, https://stories.lbi-netmed.com/ (the
   `CNAME` file on main, 2 November 2026); https://unfriend.github.io/airportnetworks/ now redirects there (301). A new
   address starts empty in every browser and headset: install the app again there, and calibrate the headsets again. Confirm the settings and who may change them (see [docs/setup-and-release.md](docs/setup-and-release.md)).
6. **Who to ask**: **TO FILL (owner):** the people for the code, each story's science, the headsets and the relay.
7. **Deferred** (what of the earlier list was built is in [docs/history/decided.md](docs/history/decided.md)):
   - **Performance: what a review found (maybe later; the owner, 24 November 2026: "the performance is fine in the
     headset atm but still good to know").** Measured with `node tools/perf.mjs --only story: --frames 60` at v193 (the
     pretend Quest, software drawing: counts and script time, no GPU time; both eyes together). Fine already: 20 to 76
     draw calls a frame in every story, script 0.2 to 2.6 ms a frame, hardly any textures in the stories and the
     studio's compressed (KTX2). Left, none of it started:
     - *Triangle spikes in a few chapters* (most scenes are 50,000 to 220,000): endo at 25 % 689,000, ppicell at 25 %
       524,000, micro at 50 % 496,000 and at 25 % 310,000, pet at 25 % 424,000. The ppicell one is known:
       `packages/ppicell/src/sets/sites.js` pins its protein models to their finest level (`lod: 0`, 18,000 to 48,000
       triangles each) though they are 0.09 to 0.12 units wide; `molMesh`'s own `'auto'` would do (still so on 26 November
       2026: `sites.js` lines 20 to 114 pass `lod: 0`). The endo, pet and micro ones are not traced to a set yet.
     - *Memory made each frame* (garbage collection pauses, which a headset shows as dropped frames): ovary 0.9 to 1.7
       MB a frame while its story plays, endo 0.6 to 0.8 MB, micro about 0.6 MB; the other stories 0.03 to 0.15 MB.
       Ovary also sends 80 to 127 KB of texture a frame. The causes are not traced.
     - *Overdraw* (not measurable here, probably the real cost on a Quest): the kit's glowing points and lines are all
       additive and see-through, points up to 160 px wide; the spatial, proteins and pass cells nest several
       see-through shells that fill the view close up, each a sphere of 128 by 80 segments (about 20,000 triangles;
       half the segments would not be seen). Automatic quality covers it; a run log from a headset (*Record a run*)
       would say which chapters drop frames.
     - *Labels*: each headset label is its own sprite, texture and draw; an atlas would batch them, a small gain at
       these draw counts.
     - *Downloads*: the airports narration is 160 kbit/s mono (4.6 MB), every other 64 kbit/s (about 2.7 MB saved by
       encoding it again); the relay does not gzip the `.mol` protein models (8.4 MB, about 28 % smaller gzipped);
       every page start loads about 2.3 MB of script before any story, of which `shared.js` (1 MB) could load later
       for people in no room (a risky change to the shell).
     - Not worth doing: merging more draws, compressing the stories' textures, or moving on from three.js r128 for
       multiview.
   - **glTF round trips: Blender and Unity (nice to have; the owner, 16 November 2026: "note all of this down as nice to
     have for later").** Export a studio scene as one GLB (each item a node with its studio record in `extras`), edit it in
     Blender, import it back by id; Unity scenes through UnityGLTF and the same import. `layout.json` keeps its own names
     (its `p`, `q`, `s` already are glTF's translation, rotation, scale), so no layout file is rewritten. The standards
     looked at, the decisions and rough costs (about 1.2 to 2M tokens for all three pieces): `docs/agents/studio.md`, "Nice
     to have, later: glTF round trips (Blender, Unity)".
   - **Snapping in the studio (maybe later, still not built on 26 November 2026: the studio's code never calls
     `TransformControls`' snap setters; the owner, 14 November 2026: "put snapping on the for later list for now").** As discussed: a setting of this device's own in the Scene pane while editing (never saved or shared): move
     off / 1 / 5 / 10 / 25 / 50 cm, turn off / 5 / 15 / 45 / 90 degrees, size off / 10 / 25 %, and a drop onto the floor
     within a few cm. On a page through `TransformControls`' own `setTranslationSnap`, `setRotationSnap` and
     `setScaleSnap` (Alt to move freely); in a headset applied where the grip and the sticks let go, so carrying stays
     smooth. The grid on the scene's frame (the room's at a circle). Open: snapping one item to another (face to face,
     onto a table), a few times the work.
   - **Quicker hot reload on the test place (maybe later; the owner, 13 November 2026: "Can we have hot reload so
     changes can happen right away in the same session?", then "hold the hot reload work for now and put it down for
     maybe later").** What exists: `HOST.live` swaps a changed story in place (a headset stays in its session) and asks
     before a new shell, whose reload ends a headset session (*Enter VR to continue*). Proposed: (1) with developer mode
     on, ask for `version.json` every 15 s instead of every minute and swap a story at once rather than at a quiet
     moment; (2) after a shell reload in a headset, enter VR or AR again by itself through Quest Browser's WebXR
     navigation (`navigator.xr`'s `sessiongranted`), keeping today's *Enter VR to continue* as the fallback; whether a
     reload counts as such a navigation can only be found on a Quest. Swapping the shell's own code without a reload is
     not realistic (`shared.js` holds the room, the alignment and the session's state in one closure). Still not built on 26
     November 2026 (no `sessiongranted` in the code; `HOST.live` as described above).
   - **Lining up without tape: "Line up with someone" (left as it is for now; the owner, 16 November 2026: "Can we get a
     quick sync mode for conferences etc where we wont scan the room, for example just have two people high five each
     other twice while pressing a button, something like that… ( or we do a tutorial where to start they have to put
     their hands in two real world places)", then "ok lets leave it as it is for now").** The second idea is built: the
     floor spots (two tape crosses at least 1 m apart, each headset touching spot A then B, the room setup guide). As the
     code reads they need no room scan (only the shared space and anchors do), but without one a headset touches A and B
     again each session (untested on a Quest with no scan at all). The high five exists only as a check (Touch the spot).
     The design discussed: two people touch controllers at one place, step at least 1 m apart and touch again; each pair
     of touches matched by the relay's time as Touch the spot already does; the second headset takes the first's frame
     (two shared points and the floor's up give the turn and the shift). A 3 cm miss turns the room by about 2 degrees
     (about 15 cm off at 5 m), and a group lines up in a chain, so errors add up: fine for walking about, worse than the
     spots (why v109 chose fixed spots). About 1 to 1.5M tokens. Still as it is on 26 November 2026 (no
     high-five line-up in the code; Touch the spot only checks).
   - **Uploading from Google Drive** (skipped for now, the owner, 8 November 2026: not built on 26 November 2026, no Google Picker in the code; about 3 to 4 hours and 1 to 1.5M tokens, an import on the relay from a share link 2 to 3 hours more; the plan, its setup and the other ideas of that day are in [docs/history/decided.md](docs/history/decided.md), "The ideas of 8 November 2026").
   - **a voice assistant** (not started; estimated on 29 October 2026): Claude through the owner's API key, with a
     small bridge on a laptop that does speech to text locally and speaks the answers with Kokoro (as the narrations
     are made). Phase 1, ask and hear (a question about the story on show, answered aloud): about 6 to 8 hours and 3 to
     4M tokens. Phase 2, Claude acts on the scene (picks, explore controls, a circle): about 3 to 4 hours and 1.5 to 2M
     more. The microphone inside a Quest session is untested (the studio's voice recorder, v125, asks for it on the 2D
     page first; Talk, v178, and the notebook's recording, v148, also use it: untried on a Quest). Not started on 26
     November 2026 (no code or doc elsewhere mentions it);
   - collecting alignment logs from fresh headsets (a test plan is in the runbook);
   - **German for every story** (on hold, the owner, 29 October 2026: keep it low for now). The stories' text in German
     with a German voice and subtitles: about 1.5 to 2 days of agent work; explore mode in German too: about 1 to 1.5
     days more. In a shared room everyone keeps one timeline, so each stretch lasts the longer of its two languages (as
     the pass story, already in English and German, does). Still on hold on 26 November 2026: the pass story is the only
     one in German (`packages/pass/audio/narration-de.mp3`);
   - **circles that load code from a link** (on hold, the owner, 29 October 2026; the design agreed, not to build
     yet). The owner's aim: the whole office as one shared room, where colleagues add circles of their own, with their
     own logic, from a web page or a GitHub repository. How: a station whose story is a script from a web address
     (their own site, GitHub Pages or jsDelivr), loaded into the running page as our stories are, so nobody leaves AR;
     it gets the circle, the room's clock, the controllers and hands, a shared state, subtitles and the people. A whole
     other web page cannot run inside the headset session (one page owns it; opening another ends it), so their page
     carries one script written for the circle; a starter template that also runs on its own as a normal page. Trust:
     the code runs with the app's rights on each device (it can see the room's people and positions and move circles),
     so each device asks once per address ("Load code from this address? It can see and change this room") and the
     circle shows where its code comes from; a sealed sandbox for strangers' code is a bigger step (about 2 days). Also:
     "Add a circle from a link" in the page's Shared dialog (the headset lists the room's saved links), a `FORMAT`
     bump, tests with a local example circle. Office scale: "Add a circle here" where you stand and an office-sized
     room map; a walk test with a headset first (does one calibration hold across rooms and doorways; Quest's
     passthrough outside the scanned room). About 5 to 6 hours, plus 1 to 2 hours for office-scale placing. Not started on 26 November 2026 (no "Load
     code from this address" or "Add a circle from a link" in `shared.js`, `index.html` or the docs);
   - **occlusion by the real world**: steps 2 and 4 below were built in v119 (the room's geometry and live depth, on by
     default in AR, each headset's own setting: docs/agents/shell.md "Real-world occlusion"; untested on a Quest in the app).
     Still open on 26 November 2026: step 3, the studio's *Real room* look (about 2 to 3 hours; nothing by that name in
     the studio's code: a shape's `look: 'hide'`, which draws into the depth alone, is the nearest thing, for shapes only;
     since then the default became the live depth alone, v195 and v196, so a room scan hides only when asked). As planned (the owner, 4 November 2026:
     "i would really like to work with the real rooms
     geometry as well as have people and object oclusions from the real world"; the plan agreed the same day, its first
     step, the test page `room-test/`, built in v112). What a Quest gives a web page: the room from Space Setup (walls,
     floor, ceiling, furniture boxes, a rough mesh; the app already asks for it in AR and the robots use it; it does not
     move and needs Space Setup run), live depth from the front cameras on Quest 3 and 3S only (about 320 x 320 a eye,
     0.2 to 5 m, AR only; three.js r128 predates it, so whether it comes to our kind of session is what the test page
     finds out) and no camera image (so no recognising people). Next, once the test page's report is back:
     (2) occlusion by the room's geometry, **for the whole app** (the owner: "we should do this once for the whole app so
     that also circles etc get ocluded the way they should be"): stories, circles, cards and icons hidden behind real
     walls and furniture, a Settings switch per device, never hiding the menu, the Stories screen or name tags (about 2
     to 3 hours); (3) the studio's *Real room* look, later: a placed model that is the real room (the atelier scan), lined
     up with the room's two spots, not drawn in AR but hiding what stands behind it, faint while editing, feeding step
     2 once that exists (about 2 to 3 hours); (4) live depth occlusion of people and hands, once the test shows it works
     (about 3 to 4 hours; hard edges first); (5) invisible stand-ins for other headset wearers: dropped (the owner: "we
     wont need this if the regular occlusion works the way it should");
   - **see through their eyes** (optional, later; the owner, 29 October 2026): a laptop's camera follows that wearer's
     head at their circle (a view for a projector). About 3 to 4 hours (each story places its scene differently in a
     headset). Not built on 26 November 2026: a page's *Follow* (v97) follows the circle a person is at, not their head,
     and the preview camera (v153) stands at a fixed spot;
   - **a real-world-to-virtual slider** (later; the owner, 29 October 2026: "when I am in a circle I have a slider on
     my watch where I can fade out the real world and fade into VR"): inside the same AR session, so the room's
     alignment, the circle, the people, the sync and the sound carry on. A slider in the clock menu while at a circle
     (*Real world ↔ Virtual*: drag with a fingertip or the ray, or steps of 0, 25, 50, 75 and 100 %) fades the story's
     own surroundings in over the passthrough (the dark backdrop; the flock's dusk sky and land, the fish's sea, the
     robots' model room), per headset and remembered per story. Safety: walking out of your circle (beyond about
     1.5 m) fades the real world back in by itself, and stepping back in returns to the setting (the Quest may not show
     its boundary in an AR session, and a room may hold ten people). Untested until tried on a headset: how partial
     passthrough looks, and whether the boundary shows. About 2 to 3 hours (the slider, the same few lines in all
     sixteen stories and the design room, tests, docs). Not built on 26 November 2026 (no slider in `shared.js` or
     `index.html`);
8. **The PET story ("One scan, one system"): its second half waits for the poster** (October 2026). Done on 28 October:
   the scanner hands its patient to the body in one move (the scanner goes, the body stands up, its glow fades, then
   the sugar), the organ labels are names only, the Vision chapter is gone, the second chapter is "How PET sees" with
   the owner's text changes, and the intro is 2 s shorter (6:13 in all). Still open from the owner's notes:
   - The text from the Network chapter on (about 3:52 then) "does not match the poster" (owner, 28 October; set aside
     for now). The poster's PDF is needed in the session to rewrite it.
   - The network and the prognosis need far more 3D: done in v104 for the opening scene (the vision row: the microanatomy
     story's 3D organs and a bone marrow model in the network, prognosis as glass tubes, medication as pills, in the
     story's cyan and amber); the Network chapter's own network on the body is unchanged.
   - The story is a bit dry: less statistics, more story (the 29 October fixes took a few numbers out).

   **Compared with the poster (29 October).** Two independent comparisons of the story with the poster "Shaping a New
   Era in Nuclear Medicine" ([docs/pet-poster-comparison.md](docs/pet-poster-comparison.md)) found that the story
   follows the poster up to the Organs chapter and then tells the paper (Geist et al., Med 2025); every number it gives
   is right for the paper. None of the poster's own results is in it (one network per scan from seven tissues, Clearance
   and Heterogeneity, the metabolic displacement index, the four groups on its scale, survival by thirds, the response
   to immunotherapy, the follow-up scans); of the poster it keeps the title, the authors and the general framing (the
   vision row is the vision slide's). The version before commit b7053fb (23 October) told this poster's story with its
   numbers (`git show b7053fb^:tools/pet/sets/data.js`, under `poster`), so the colleague's note that it "did not
   match the poster" may have meant another poster, or the made-up formulas and profiles of that version.

   **Fixed now (29 October, the owner's go; 6:33 in all):** the intro says "From PET scans to a network of organs" and
   captions the vision row as the aim (prognosis and medication: goals, not yet shown); FDG is "mostly" not taken back;
   PET's main use is "in routine care: finding and staging cancer"; the Network chapter opens with "a network like this
   needs many scans" (one scan gives one row of numbers; these networks are the paper's, each of a group of scans;
   "across scans", since the 658 include repeat scans); the Health chapter speaks of groups ("in the heavier group, the
   brain is a hub", "groups with more tumour load have thinner networks", healthy against cancer "compared within this
   one set of scans"), and the CRP thirds went (they mix healthy people and patients; within either group CRP made no
   clear difference, Table 2): that turn shows the tumour-load networks instead; the credits say the numbers are the
   paper's; explore's liver uses "a rule like the poster's, applied here to patches of one organ, as an illustration".
   Later that day the strength chart beside the body went (the owner: "remove that from the story and the interactive
   mode"): the density and disorder stay as a tag under the network's title, explore's Network view replaces Strength,
   and its Networks pane names the strongest organs in words instead of bars (the story's words and its 6:33 unchanged).

   **Open question to the colleague** (the owner is asking): which poster was meant, and was the note about the content
   or how it was drawn? **The rebuild waits for that answer** and for the authors' open points (P4 to P11 in
   [docs/questions-for-authors.md](docs/questions-for-authors.md): the threshold and the ratios' direction, the formulas,
   the index scale's direction, the dashed lines, means or medians, the counts, the p values, the follow-up results).
   **The plan, in short:** keep the story to the Organs chapter; one bridge line with the paper's two or three key
   numbers (healthy groups dense, cancer sparse); then the poster in 3D: a person's network from seven tissues on their
   body (pairwise ratios, a threshold, links; labelled illustrative), Clearance and Heterogeneity folding into the
   index, the four groups standing along its scale, the cancer patients' thirds and their survival as crowds that thin,
   the 19 people's response (all p above 0.05: a first hint) and the follow-up claim labelled "the poster reports";
   group summaries only, never a single patient's points. The poster's numbers come back from `b7053fb^`; explore's
   old One scan and People tabs are the starting point there.
9 to 11. The fourteenth, fifteenth and sixteenth stories (the mutation machine, the shape of tissue, holding on to
    nitrogen) are built and released; their entries are in [docs/history/decided.md](docs/history/decided.md). What is still
    open about them is in [docs/questions-for-authors.md](docs/questions-for-authors.md) (MM1, MM5, MM6, T5 and the soil
    questions) and `docs/data-and-permissions.md`.
12. **Sound effects: listen to the stories' tracks (phase 2 built, 29 October 2026).** Phase 1 was approved ("sounds
    are fine, go on"): effects are on by default and phase 2 is built (see `docs/history/releases.md`). The owner listened on
    30 October: the backgrounds and the machines' hum went (but the flock's and Pass it on's), and the two switches came
    (v100, see `docs/history/releases.md`). **TO FILL (owner):**
    listen to each story's track (`node tools/sfx-render.mjs <url> <folder> --story all`: `story-<key>.mp3` with its cue
    list, at the default volume, under the narration where there is one) and to the new sounds (`sfx2-all.mp3` and its
    index), and say which cues to keep, move or drop and whether any story is too busy or too quiet. Phase 1's notes
    follow. The shell's sounds and the stories' backgrounds were built off by default (see `docs/history/releases.md`). Nobody has heard them yet: the
    recipes were judged by measurement only (levels, spectra, no clipping). To listen: the sound board
    (`tools/sfx.html`, served next to the app: every sound with a button, every story's background, a 3D demo for
    headphones, the ducking demo, the voice limit), or the rendered files (`node tools/sfx-render.mjs [url] [folder]`:
    one MP3 per sound, `sfx-all.mp3` with its index, `levels.txt`), or in the app with `#sfx=on` (in a headset:
    *Sound effects* in the menu's Settings tab (click a stick to open it), and *Try the sound effects* on its Sound check
    page under Debug). Levels: the
    interface sounds peak at -30 to -15 dBFS (the loudest 400 ms -54 to -30 LUFS), the backgrounds -35 LUFS, against the
    narration's -13 to -16 LUFS; the default volume is 75 % (5 dB lower). **TO FILL (owner):** which sounds to keep,
    change or drop, whether the backgrounds are wanted, and then whether sound effects go on by default. **Phase 2**
    (sounds inside the stories, tied to their timelines) starts only after that.

## How work is done

- One working branch, pushed to `dev` first (a fast-forward) after the cheap checks only: `node --check` on the
  changed files, the builds' `--check` and `node tools/release.mjs --check`. A push to `dev` redeploys the test place,
  https://stories.lab.lbi-netmed.com/. The owner tries it there; then the full suites run, and only when they pass does
  `main` move (`git push origin HEAD:main`, a fast-forward; the owner, 7 November 2026: "only running when pushing
  to main makes sense for now"). `main` is what visitors get (GitHub Pages) and also redeploys the main site's relay.
  No force pushes, no pull requests so far. Each release: bump `VERSION` in `sw.js`, rewrite `whatsnew.json` by hand,
  run `node tools/release.mjs`, commit both. The full checklist, rollback included, is in
  [docs/setup-and-release.md](docs/setup-and-release.md).
- After any change to app files, bump `VERSION` in `sw.js`, or installed copies and headsets keep the old files.
  Bump `FORMAT` in `shared.js` when a story's shared state changes shape.
- The story files are large (`packages/airports/main.js` is about 700 KB with its data): search them, never read them whole.
- Headset behaviour can only be confirmed on a device: say so when reporting a change.

## Adding another story

Since v187 a new story is a story package: a folder `packages/<key>/` with `story.json`, `main.js` (built from
`packages/<key>/src/`), `icon.png`, its narration `audio/narration.mp3` and its miniatures. How it is made is in
[docs/agents/packages.md](docs/agents/packages.md) (the folder, `story.json`, the scan, how the shell loads it, the rules),
[tools/packages/SPEC.md](tools/packages/SPEC.md) (the contract; `tools/packages/template/` is a package's `src/`) and
[docs/working-on-a-story.md](docs/working-on-a-story.md) (an author's way: edit, check, publish to `dev` with
`node tools/packages/publish.mjs`). Start from the closest existing story: `packages/topo/src/` for a story whose numbers come
from the authors' own code run on their data, `packages/mutation/src/` or `packages/qubits/src/` for numbers computed live,
`packages/micro/src/` or `packages/ovary/src/` for a data story, `packages/flock/src/` for a live simulation, `packages/pass/src/`
for a story that reuses another's models and has two languages; the newest are `exposome` (`packages/exposome/src/SPEC.md`)
and `cdk5`. `git show --stat` on the commit that added one shows every file it touched.

What a new story touches besides its package (a list to check, not the steps):

- Tests: an entry in `STORIES` in `tools/collab.mjs` (its `HEADSET_STORY` stays last); the smoke test reads the story keys from
  the shell and needs no entry, but an explore step is worth adding; `node tools/packages/check.mjs packages/<key> --load`.
- Docs: `AGENTS.md` (the story's line), `docs/agents/stories.md` (a section of its own), `docs/agents/shared-rooms.md` (the
  shared-state table), `docs/agents/testing.md` (URL hashes), `docs/agents/layout.md`, `README.md` and `README.txt`,
  `docs/data-and-permissions.md`, `docs/questions-for-authors.md`, `relay/README.md` if Arrange all needs more floor;
  regenerate `docs/narration.md` with `node tools/narration.mjs`.
- `index.html`'s head (title, meta description, link previews) and `manifest.webmanifest` say what the app is in words for
  search engines and installs: update them if the new story changes that.
- Release: bump `VERSION` in `sw.js` (a change to one package's files alone needs none: its fingerprint in
  `packages/index.json` reaches pages and headsets), `node tools/release.mjs`, `FORMAT` in `shared.js` only if the shared keys
  change (a device that does not know the new story yet shows its station as needing an update); run every test the change
  touches (`AGENTS.md`, "Testing"), then merge as above.

The older steps (before packages) are kept in [docs/history/releases.md](docs/history/releases.md), at its end.

## Working with AI agents

Most of the code was written with Claude Code, following `CLAUDE.md` and `AGENTS.md`; both are plain rules a person can
follow too. Two habits are worth keeping either way: sources and generators stay in the repository (so nothing has to
be rediscovered), and every story is checked by the same tests. For agents, AGENTS.md "Working economically" says how
to keep the cost down: a new story built economically took about 3M tokens (cheaper models for reviews and checks,
one review round); building the tour with the strongest model throughout took about 16M.

- **Without an agent** nothing changes: every step is a script (the builds, `node --check`, `node tools/release.mjs`,
  the suites in [docs/setup-and-release.md](docs/setup-and-release.md)).
- **With one**, start it in the repository: it reads `CLAUDE.md`, which takes in `AGENTS.md`. How the last rounds were
  run (v109 to v126): a written spec or brief first; builders in parallel lanes, each in a git worktree of its own on
  the strongest model; one review per lane on a cheaper model, one fix round only where a review found something
  serious; then one integrator merging the lanes, writing the docs and releasing to `dev`. Since v175 the agents'
  cloud sessions work on `dev` itself (a new person can start a branch of their own). Rules the agents kept: no model ids in commits or code, no pull requests unless asked, no history rewritten,
  the `logs-*` branches left alone, never a password or key in chat, a link, a log or the repository, and never the
  authors' files or the owner's own scenes in the repository.
- **What an agent cannot judge**: anything on a headset, a phone or the trackers' PC, and how anything sounds. It must
  report those as untested; the owner tries them (developer mode's *What is new* lists them for each release).
- **The machine**: the cloud machines had 4 CPUs, and headless Chromium draws in software, so the full shared-room
  run takes long and fails more often when other tests run beside it: run the suites one at a time.

## Map of the repository

[docs/agents/layout.md](docs/agents/layout.md) (summed up under "Layout" in [AGENTS.md](AGENTS.md)) lists every file and folder. In short:

- The shell: `index.html`, `shared.js` (shared rooms, the menu, the trackers), `sfx.js`, `occlusion.js`, `sw.js`.
- `packages/`: one folder a story (v187: all of them), `packages/<key>/main.js` built from `packages/<key>/src/` (airports,
  proteins and spatial hand-written), its narration `packages/<key>/audio/narration.mp3`; `packages/order.json` (by hand) their order.
- `stories/`: the studio (`studio.js`, built from `tools/studio/`) and `list.js` (by hand; it lists only the studio). The design room (`design.js`, from `tools/design/`) is parked since v217: out of the app, its sources kept.
- `tools/`: the shared engine (`tools/engine/`), `tools/packages/` (the packages' contract, scan and checks); `tools/studio/` (the studio, its test scenes), `tools/trackers/`
  (the bridge and the fake), `tools/voice/` (the narrations), `tools/lowpoly/` (the miniatures' kits and build; each story's miniatures are in its package since v190); the test scripts.
- `relay/`: the server (rooms, scenes, R2, trackers), its tests and Dockerfile.
- `docs/` (`docs/history/` the records), `room-test/` and `p2p/` (test pages).
- Generated, never edited by hand: the built `stories/studio.js` and `packages/<key>/main.js`, `lowpoly.js` and `packages/<key>/minis.js`, `version.json`, `docs/narration.md`.
  Written by hand at every release: `whatsnew.json`.
- Outside the repository on purpose: the authors' data files, the voice models, the owner's own studio scenes (in R2,
  or `tools/studio/test/local/`, which git ignores) and the relay's logs.
