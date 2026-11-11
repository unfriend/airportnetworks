# airportnetworks

**Networks, in sixteen stories**: an installable web app that teaches network
science through sixteen short, animated stories. Each story takes a few minutes
(the tour about ten and a half) and ends in an explore mode where the network is yours
to play with.
It runs in any modern browser, on phones, and in VR and AR headsets (built for
Meta Quest Browser).

**Taking it over? Start here:** [`HANDOVER.md`](HANDOVER.md), then
[`docs/setup-and-release.md`](docs/setup-and-release.md),
[`docs/data-and-permissions.md`](docs/data-and-permissions.md),
[`docs/questions-for-authors.md`](docs/questions-for-authors.md),
[`docs/event-runbook.md`](docs/event-runbook.md) and
[`docs/narration.md`](docs/narration.md).

| Story | What you see | Ideas |
| --- | --- | --- |
| **Airports** (network theory) | 3,214 airports and 18,858 routes on a globe | nodes and edges, degree and hubs, shortest paths, betweenness, communities, robustness when airports close |
| **Proteins** (network medicine) | 254 proteins and 375 interactions inside a cell | essential hubs, modules, disease modules, drug targets, knockouts |
| **Cell map** (spatial interactome) | 249 proteins in 13 compartments of a model human cell | where proteins meet, proteins in several places, signals crossing the cell, proteins that move, proximity labelling, proteins in the wrong place |
| **Muscle and heart** (rare muscle diseases) | 1,182 genes of 13 groups of neuromuscular disorders in a tower of 71 layers, after the ISMB 2026 talk by Iker Núñez-Carpintero and Philipp Friedrich (LBI Network Medicine), on their data | the motor unit from nerve to sarcomere, a multiplex network, a random walk with restart, disease modules, endotypes, the overlap of congenital myopathies and cardiomyopathies, a stress test on a supercomputer; explore: pick a group, search a gene, run your own walk, knock out layers, pick endotypes, stand inside the tower |
| **Endotypes** (disease endotypes) | one junction between nerve and muscle close up, the 35 genes of congenital myasthenic syndromes, their protein network of 18,306 proteins and 12 endotypes, after the ISMB 2026 EndotypY poster by Chloé Bûcheron, Iker Núñez-Carpintero, Enes Sakalli, Mathilde Meyenberg, Julia Guthrie and Jörg Menche (LBI Network Medicine), on their run | fatigable weakness, seed genes, a random walk with restart, a disease module, functional neighbourhoods, a tree whose splits are tested, endotypes and where they act in the synapse; explore: every endotype and gene, the method step by step, stand in the gap |
| **One scan, one system** (whole-body PET) | a PET/CT scanner and how it sees, the tour's glowing PET body, its organs outlined and measured, and the networks of the organs' metabolism from 658 whole-body scans, after the paper by Barbara K Geist and colleagues (Med, 2025) and their poster "Shaping a New Era in Nuclear Medicine" (Medical University of Vienna and LBI Network Medicine) | positrons and coincidences, uptake, partial correlations, network density and disorder, hubs, health eroding into disease |
| **Tissue and time** (tissue microanatomy) | an H&E-stained section and the working units (microanatomical domains) a method finds in it, a library of 24,945 slides of 40 tissues, an atlas of their domains, the network of how organs are built, after the preprint by Iva Buljan, Zsuzsanna Bago-Horvath and André Rendeiro (bioRxiv, 2025) | tiles, features, message passing and clustering without labels; domains shared and specific; which change with age; pathology; contacts between domains that stay or change |
| **The aging ovary** (ovarian aging) | the tour's body and a drawn cut-away ovary that ages, 255 donors aged 20 to 70 (GTEx), a drawn H&E section with blood vessels, macrophages, corpora albicantia and follicles, after the poster by Parijat Chakraborty, Samir Moustafa and André Rendeiro (LBI Network Medicine, CeMM, University of Vienna) | the reserve of follicles that is never refilled, what a section shows, two methods (tiles with UNI2 features and a random forest; SegFormer's masks) and their scores, the trends with age (follicles toward none by about 60, fewer vessels, more scars), whether the methods agree, and a spatial neighbor network as the next step; explore: pick a kind of object, move the age, compare the methods. American spelling |
| **Three qubits** (quantum network compression) | example gene networks cut into eight cells on three qubits, the coarse operator on a cube, its building blocks (Pauli strings) and the toolbox a quantum computer runs well, after the method and figures of Joel Hancock; the real run's summary numbers on STRING | why pairs of genes, two walkers on a map, bisections and bit codes, the coarse operator A_c, Pauli strings, a Lie algebra and the residual it leaves, the honest result by depth, a Trotter step as a circuit; explore: four example networks, found or random cuts, 1 to 3 bits, every brick, add them up, so(6) or so(7) |
| **The mutation machine** (Quantum phylogenetics) | a text in four letters copied with swaps, a family tree in 3D that you walk round and look up into, a letter's two qubits, a rule of change as a path through a pyramid of mixes, the machine of gears for one branch and its circuit, an RNA stem, and the ancestor of three species rebuilt three ways, after the poster by Enes Berk Sakalli (LBI Network Medicine) and Arndt von Haeseler (CIBIV, Max Perutz Labs) | mutations and family trees, branch length, a letter in two qubits, superposition and read-out, a substitution model (GTR) as a dynamical system, a compiler from a rule to a circuit (copy, then turn), one machine per branch, letters that change together coupled, rebuilding an ancestor and what its shares mean; explore: any letter or mix and its read-outs, three rules, the branch length, five trees and any branch, the pair favour, rebuild again. Example numbers, computed live |
| **The shape of tissue** (tissue topology) | the tour's body with its liver lifted out, a slice of healthy liver drawn from its real cells, balls growing round 110 of them until pieces join and loops open and close, the tower of scales, 123 liver slides as a rack of glass slides with their curves, a classifier's wall and the scales it weighs, and a new slide scored cell by cell, after the poster by Simon Schindler, André Rendeiro and Jörg Menche (LBI Network Medicine, CeMM, Medical University of Vienna, Max Perutz Labs), on their data | where cells sit as data in any modality, one scale or every scale, a network with triangles (the alpha complex), persistent homology: pieces and loops, the barcode and the Betti curves, comparing the slides' curves (functional PCA), a classifier read back as a weight for every radius, a fair test on slides it never saw, every cell a centre (local persistent homology), cirrhosis-like and healthy-like cells; explore: any radius, any slide, a window of radii of your own, any cell and its neighbourhood. Every number computed by the authors' package topocyte |
| **Holding on to nitrogen** (soil microbes) | a cut-away block of soil where less than half the fertiliser reaches the wheat and the microbes' relay turns the rest into nitrate and nitrous oxide, a wheat given a piece of a wild grass's chromosome to slow the relay, the hop to a field trial in Japan (24 plots under netting, five dates, 119 samples), the BNI wheat greener and leaking less nitrate, the jars' nitrous oxide, and a crowd of about 100,000 kinds of microbe with the network of those that rise and fall together, after the slides and field trial of Marina Montserrat Díez, Christa Schleper and colleagues (University of Vienna, JIRCAS, University of Thessaly, Université Lyon 1) | nitrification as a relay of microbes, biological nitrification inhibition (BNI), a field trial's design (two wheat lines, three regimes, five dates, four replicates), measured against read off the slides, a co-occurrence network from 16S data (correlation, not interaction), a shuffle that leaves no link, modules that follow the fertiliser and the plots, the samples split by wheat line against random halves; strong indications, not yet proof; explore: any date and measure, the sketch's switches, any kind, any module, a threshold, the shuffle and the split |
| **Pass it on** (networks for everyone; in English and German) | a school of fish all around you (in a headset, life size; in passthrough, in your room), the airports story's globe with an outbreak on its routes, and the cell map story's cell, for the Ludwig Boltzmann Institute for Network Medicine's outreach (about 12 and up) | no fish is in charge: each watches a few neighbours, and a warning races through the school faster than the shark; one neighbour each and the school falls apart; an infection travels along the flight routes, slowly, then through the hubs everywhere at once (a simple model, not a forecast); a signal passes hand to hand in a cell, and a protein in the wrong place stops it; explore: be the shark, change who watches whom, start an outbreak in any city and change how it spreads, the cell's proteins and moves |
| **Flock** (collective motion) | 200 starlings at dusk flying all around you (in a headset, life size), over a field by a lake | no leader: each bird follows its seven nearest neighbours, so the flock is a network that changes from moment to moment; a falcon sets off a wave that runs through the whole flock; explore: as many birds as you like (100 to 400), who follows whom, send a falcon; then it flies on for as long as you stay |
| **Robot gang** (swarm robotics) | a gang of 6 to 24 robot vacuums in a model living room; in a headset, in your own room (its floor, walls and furniture from the headset's room setup) | bump and turn: no map, yet the floor gets clean; then one rule, follow, on two networks of who follows whom: a star (all follow you) and a chain (a conga line). Click the floor to walk; in a headset the trigger on the floor spills crumbs |
| **The future** (LBI Network Medicine) | a 3D tour in ten scenes, after the Ludwig Boltzmann Institute for Network Medicine's welcome talk | the whole is more than its parts, networks everywhere, genes and protein shapes, a protein machine (ATP synthase) assembling and running, the interactome as a city map, rare diseases and inborn errors of immunity, network propagation for diagnosis, networks across scales, the institute's research groups, whole-body PET and organ networks, tissue as a network of cells |

## Using it

- The **Stories screen** is the landing page. Pick a story; the **Stories**
  button in the top bar brings the screen back at any time.
- **Repeat all** and **Repeat one** on the page's Stories screen (in a headset
  the *Repeat* row on the menu's Settings tab) keep it playing, for an
  exhibition or a kiosk: with *Repeat all* each story is followed by the next,
  and the last by the first; with *Repeat one* the story you pick starts again
  each time it ends. Press the lit button to turn
  it off. The choice is remembered on the device, and a link such as
  `index.html#airports&repeat=all` sets it.
- Each story plays by itself. Pause, scrub the timeline or jump between
  chapters, or press **Explore now** to search, trace shortest paths and try
  the story's tools (closing airports, knocking out proteins, starting
  protein moves, proximity labelling ...).
- **VR and AR**: press *Enter VR* or *Enter AR*. From the Stories screen you
  land on a Stories screen in the headset, with one card per story; from
  inside a story you carry on where you were. The network floats in front of
  you with a side panel you point at. Controls: trigger (or pinch) to click,
  grip to move the network or the panel, the stick to spin and zoom it in
  explore mode. Play and pause are on the story's panels and on the menu's
  *Story* tab (no story uses A or X since v125). Click either stick to open the
  headset's menu (with tracked hands: two quick pinches of the left hand,
  pointing at nothing). In VR, the left stick clicked twice turns **moving with the
  sticks** on or off (this headset's own, off by default; not in AR, and not in a
  shared room except in the studio): the left stick moves you where you face, the
  right stick turns you 30 degrees. How that feels on a Quest is untested.
  Changing story inside the headset keeps you in VR or AR and keeps the layout
  where you put it; *Recenter* (on the story panel and the menu's Settings tab)
  puts it back in front of you.
- **Anchor** (*Anchor: on/off*, a row on the headset menu's Settings tab) keeps
  the network and the panels at one spot in the real room, for every story: they stay there
  when the headset is taken off and put on again (the next wearer still starts
  on the Stories screen), when it recentres, after leaving VR and after a
  reload. While anchored the grip moves nothing; *Place again* puts everything
  in front of you and anchors it there. To arrange things first, leave Anchor
  off, move them with the grip, then press Anchor. It uses the Quest Browser's
  room anchors (not in private browsing; clearing the site's data forgets the
  place); where a headset has none, the place holds until you leave VR. A link
  with `#anchor=on` (or `#anchor=off`) sets it, for a kiosk.
- **Shared rooms** (the *Shared* button in the top bar and on the Stories
  screen; in a headset the menu's *Circles* tab): several
  headsets and screens join one room and see the same **stations**, each a
  story at a spot in the room (its circle), in step on every device. A room
  starts as a shared Stories screen (an arc of story cards that anyone can drag);
  once another circle is added or *Arrange all* is pressed it becomes an
  ordinary *All stories* circle. Anyone can play, pause, jump or change a
  control; the last action wins. A headset goes into a circle by pointing at
  its card or model and pressing *Go in* (the circles ask first by default since
  v120; *Circles: walk in* makes standing in a circle enough) and keeps it until
  it goes into another (in a circle the other stations show only their small 3D
  models; pointing at one shows its card). Each station's narration comes from
  where it stands, and you see the people at your circle and where they point.
  *Lock circles* keeps the stations where they are; *Lock this story* (the menu
  at a circle) keeps its scene and panel; *Panels* in the menu shows a story's
  panels, only its controls, or none. People in the room line up on two tape
  crosses on the floor (next item); people
  elsewhere and screens see the stations round their own spot. Screens get a
  room map and *Follow* a station or a person in a headset (the page then
  follows whichever circle they are at). *Rooms on this network* lists the
  rooms nearby, and a device that was in a room joins it again by itself
  when the app opens on the same network. The robots move separately on each
  device (their controls and crumbs are shared); the flock's birds and Pass it
  on's fish follow one device at the station, bird by bird and fish by fish.
  `#s=XYZ` in a link joins room XYZ. Nothing changes for anyone not in
  a room. Tried with ten headsets through a local relay (see `HANDOVER.md`), and on two Quest 3
  headsets in one room several times; what they did, and what is still
  unconfirmed, is in `docs/quest-shared-space-findings.md`.
- **Lining up a room** (the menu's *Room setup*, which opens by itself as a
  headset enters a shared room): two tape crosses on the floor, A and B, about
  2 m apart (1 m at least). *Calibrate*: the controller pointing down, its tip on
  spot A on the floor, the trigger, then spot B. Since v122 the two spots set the
  room's floor too, whatever the headset's own floor says. The first headset's
  calibration makes them the room's; the others calibrate on them or line up
  through Quest's shared space. **The check by eye** (v119): in AR, at the start
  of each session, after waking and whenever the room may have moved in it, the
  headset shows two orange crosses where it puts the spots and asks *Are both
  crosses on your spots?* (*Yes*, or *No, calibrate again*). *Check at A*
  measures one headset against a spot, *Check here* (Touch the spot) two
  headsets against each other. The tip's height over the floor (2 cm) and the
  4 cm limit between the spots' heights are guesses until measured on headsets.
  Steps for an event: `docs/event-runbook.md`.
- **Camera mode** (v124): an Android phone with AR (Chrome), lined up on the
  same two spots, shows the room through its camera as a headset at a circle
  sees it (the stories, the circles, the people in headsets), for filming with
  Android's own screen recorder. *Camera mode* in the phone's Shared dialog, or
  `&camera` in a room's link; it writes nothing to the room. The owner has tried
  the recording; how closely a phone lines up on a tape cross is untested.
- **Phones and tablets**: focus mode (on by default there: the 3D alone, a
  small bar and subtitles; *Text* brings the panel back) and *Enter AR* where
  the phone has it (Android's Chrome with ARCore). In a phone's AR session one
  round menu button at the top right (v125) opens a sheet with the headset
  menu's main switches and *The full menu*. Untested on a real phone.
- **Vive trackers** (v126, untested with real hardware): on the Windows PC that
  runs SteamVR, the relay with `--trackers` and `tools/trackers/bridge.py` send
  the trackers' poses to the rooms that turn them on (the Shared dialog's *Use
  the PC's trackers in this room*, lined up by laying a tracker on spot A and
  then spot B). In the studio a prop can follow a tracker, and a Mixamo
  character can be worn by a performer, its moves recorded as takes. Setting it
  up: `tools/trackers/README.md`.
- The address shows where you are, so you can share it: `#stories` on the
  Stories screen (on the page or in the headset), `#airports`, `#proteins`,
  `#spatial`, `#lbi`, `#nmd`, `#endo`, `#pet`, `#micro`, `#ovary`, `#qubits`, `#mutation`, `#topo`, `#soil`, `#pass`, `#flock` or `#robots`
  in a story. A story link opens that story directly; a link without
  a hash lands on the Stories screen. Old links to `proteins.html` and
  `spatial.html` still work.
- **Developer mode** (for testers; off by default, this device's own): the small
  switch at the foot of the Stories screen (also in *More* on a phone, and in a
  headset in the menu's Settings tab), or `#dev=on` in a link. While it is on, a
  box says what is new in this release and what to test: over the Stories screen
  when the app opens, and in a headset at the start of each session, after the
  welcome. *Got it* hides it until the next release on this device; *Later* until
  the app opens again (in a headset, the next session). *What is new* shows it any
  time. Its lists are `whatsnew.json`, rewritten at every release.

## Running and deploying

There is no build step. Upload the whole folder to any HTTPS web server
(GitHub Pages, Netlify, university web space ...). Installing the app and VR/AR
both need `https://`. To try it locally, serve the folder, for example
`python3 -m http.server 8123`, and open `http://127.0.0.1:8123/`.

Installing:
- **Meta Quest Browser**: open the page, then use the Install button in the
  address bar (or the *Install* button in the top bar if shown). The app then
  appears in your Library under unknown sources / apps.
- **Chrome / Edge** (desktop, Android): the *Install* button in the top bar or
  the install icon in the address bar.
- **iPhone / iPad Safari**: Share > Add to Home Screen.

Shared rooms work best through the relay (`relay/server.mjs`, Node 18 or newer, no
packages), which GitHub Pages cannot run; without one a room runs peer to peer
(one page hosts it; see `docs/event-runbook.md`). The owner's Coolify runs two
relays: the test place, branch `dev`, at `https://stories.lab.lbi-netmed.com/`
(it serves the app too and is deployed on every push to `dev`), and branch
`main` as the main site's relay at `https://main.lab.lbi-netmed.com/`, which the
main site (`https://stories.lbi-netmed.com/`, GitHub Pages from `main`) offers in
its Shared dialog: a device with its password runs its rooms there, one without
it peer to peer. At an event the relay can also run on a machine on the
same Wi-Fi as the headsets and serve the app itself:
`node relay/server.mjs --lan` makes an HTTPS server with a certificate of its
own and prints the address to open on each headset (accept the certificate
warning once). The Wi-Fi must let devices reach each other (use your own router
or a phone hotspot, not eduroam). `relay/README.md` has the step-by-step guide
and the alternatives (`adb reverse`, a public server on Coolify with `--public`). Everything else
stays on GitHub Pages; a copy there can join a relay elsewhere with
`&relay=wss://host:port` in the room link.

After changing any file (including adding or replacing a narration file), bump
`VERSION` in `sw.js` so installed copies and headsets pick up the change, then
run `node tools/release.mjs` and rewrite `whatsnew.json` (see
`docs/setup-and-release.md`). The
app always fetches its files fresh when online (the cache is only for offline
use), and a copy left open takes a release within about a minute: new and
changed stories by themselves (the story on show at a quiet moment), a new
shell after asking (*Reload now* or *Later*; on the page's Stories screen
outside a headset it reloads by itself).

## Narration

Every story has a narration in `audio/`: `narration.mp3` for the airports (a
human recording) and `narration-<key>.mp3` for the others (synthetic, made with
`tools/voice/`: Kokoro's American voice `af_heart`; Pass it on also has
`narration-pass-de.mp3`, in German with Piper's Thorsten voice; see
`tools/voice/README.md`). A narration plays in sync with its story and follows
pausing, seeking and chapter jumps. Without the file the story runs silently on
the same timing.

**Sound by mode** (v124): on a page nothing plays, narration or effects, until
*Sound* is pressed (the device keeps the choice); in a headset session (VR or AR)
the sound effects play from the start and the narration is off until that
headset turns it on (the story panel's *Narration* button or the menu's
*Narration* row), which it then remembers. In a shared room *Narration for
everyone here* (the menu's Circles tab) or *Narration* in the Shared dialog sets
every headset at once. Browsers start sound only after a tap or click (*Enter
VR* counts).

**No sound?** Open **Sound check** on the Stories screen (on the page; in a
headset it is a page of the menu's Debug tab). It shows what the sound system is doing, plays a test
beep through each of the two ways the app can play sound (Web Audio and an audio
element), and lets you choose the one you hear; *Reset* clears the saved
choices. The app also switches to the audio element by itself when Web Audio
fails. A link ending in `#soundcheck` opens it directly.

Chapter timings and how to record and re-sync a new recording are in
`audio/PUT-narration.mp3-HERE.txt`. `NARRATION_SYNC` is in
`tools/<story>/engine/e3_story.js` for the thirteen built stories (rebuild after
changing it) and in `stories/<story>.js` for airports, proteins and spatial.
After a narrated story's text changes, `node tools/voice/narrate.mjs <key>`
speaks the changed lines again and re-times the story from the audio, then
`node tools/voice/check.mjs <key>` checks it (the models and their Python stay
outside the repository). The words, chapter by chapter with times, are in
`docs/narration.md` (made by `node tools/narration.mjs`). A new story is paced
from its words until it is narrated: `node tools/pace.mjs <url> --write <key>`.

## Data

- **Airports**: the world airline network (airports and scheduled routes).
- **Proteins**: an illustrative, hand-curated subnetwork of 254 well-documented
  human proteins and 375 interactions (complexes and pathways from the
  literature), not the full interactome. Essential genes follow DepMap common
  essentials; disease genes are a small textbook set. Statistics were computed
  with NetworkX (Louvain modules, betweenness).
- **Cell map**: an illustrative, hand-curated set of 249 well-documented human
  proteins in 13 compartments of a model cell. Proteins found in several places
  get one copy per place (282 copies), joined by dotted lines; 252 documented
  interactions join copies that meet, in one compartment or across a membrane
  they share. Places follow the Human Protein Atlas and UniProt. Seven moves
  (NF-κB, apoptosis, TFEB, GLUT4, NRF2, and the disease cases ALS and cystic
  fibrosis) switch copies on and off. The lists `PROTEINS`, `LINKS`,
  `TOGETHER` and `MOVES` at the top of `stories/spatial.js` can be edited; the
  cell model and the protein positions are built when the story loads.

- **The tour** (`stories/lbi.js`), after the welcome talk of the Ludwig
  Boltzmann Institute for Network Medicine: most of it is illustrative and
  built when the story loads.
  - The interactome shows about 9,100 proteins and 22,100 interactions. 254 of
    them are the named, curated proteins of the network-medicine story, in their
    ten groups; the others are drawn to show the size and shape of the whole map.
  - The friendship globe puts lights at the real positions of the airports
    story's 3,214 airports; its ties are illustrative.
  - The ATP synthase follows the textbook structure, shown with 13 of the
    proteins that build it (two are assembly helpers that leave): an 8-subunit
    c-ring, 8 protons and 3 ATP per turn.
  - The immunity Sankey uses the totals of Guthrie et al. (Science Advances
    2023) for inborn errors of immunity that mainly cause autoimmunity or
    autoinflammation: 173 genes, 9 clinical categories, 19 interactome clusters. The flows
    between them are illustrative.
  - The disease modules, the patient for network propagation, the organ
    network, the stomach section and its embedding are illustrative too.

- **Muscle and heart** (`stories/nmd.js`), after the ISMB 2026 talk "Deep
  integrative multiplex network-based analysis of rare neuromuscular
  disorders" (Iker Núñez-Carpintero, Philipp Friedrich, Julia Guthrie, Jörg
  Menche), on the authors' data (kept out of the repository; no patient data): the 13
  disease groups of the 2024 Gene Table of Neuromuscular Disorders with their
  known genes, the genes the random walk added and their endotypes; 15,246
  links among the 1,182 module genes in the 27 protein-interaction layers
  (IID), and, for the overlap of congenital myopathies and cardiomyopathies, the
  phenotype and co-expression layers. The other layers of the 71 show no links
  yet. Layer z-scores and the walk's visits are computed in this map on the
  protein layers (`tools/nmd/data/gen_data.mjs`); endotype names are the most
  typical GO process of their genes. The motor unit and the supercomputer are
  illustrative.

- **Endotypes** (`stories/endo.js`), after the ISMB 2026 poster "Introducing
  EndotypY: a Python package for network-based disease endotyping" (Chloé
  Bûcheron, Iker Núñez-Carpintero, Enes Sakalli, Mathilde Meyenberg, Julia
  Guthrie, Jörg Menche; github.com/menchelab/EndotypY), on the authors' run on
  congenital myasthenic syndromes (no patient data): the 35 genes of the Gene
  Table of Neuromuscular Disorders, their protein network (18,306 proteins,
  316,613 links) and their 12 endotypes of 393 genes. Only the numbers the story
  needs are in the repository (`tools/endo/sets/data.js`, made by
  `tools/endo/data/gen_data.py`). The steps before the endotypes (seed groups,
  the walk, each gene's neighbourhood, its GO cellular-component terms, the
  tree) are re-run with the package's default settings to show the method; the
  tree is drawn to agree with the authors' endotypes. Endotype names follow
  their strongest COMPARTMENTS term. The synapse is illustrative.

- **One scan, one system** (`stories/pet.js`), after the paper "The metabolic
  organ connectome: A novel approach to measure allostatic load during
  health-to-disease transition" (Geist et al., Med 6, 100881, 2025; CC BY 4.0)
  and the poster "Shaping a New Era in Nuclear Medicine" (Barbara K Geist,
  Alexander Grentner, Joel Fischer, Josef Yu, Dato Tsomaia, Adna Smajlovic,
  Stefan Grünert, Marcus Hacker). No patient data: the networks of all 658 scans
  are the paper's printed numbers (its Figure 2A), the others are read off its
  figures (`tools/pet/data/figures.json`), and `tools/pet/data/gen_data.mjs`
  writes `tools/pet/sets/data.js`. Illustrative stand-ins, said so in the story:
  typical organ uptakes and a synthetic cohort for explore's matrix and scatter
  views. The scanner, the body and the liver's patches (explore mode) are
  illustrative. (The poster's one-scan network and its results were taken
  out: they did not match the poster.)

- **Tissue and time** (`stories/micro.js`), after the preprint "Systematic mapping of human tissue microanatomy
  reveals age-associated remodeling and resilience" (Iva Buljan, Zsuzsanna Bago-Horvath, André F. Rendeiro;
  bioRxiv 2025, doi 10.1101/2025.10.13.682110, CC BY-NC), its poster and talk, and Iva Buljan's network of organ
  architecture (only the numbers the story needs are in the repository, `tools/micro/sets/data.js`, made by
  `tools/micro/data/gen_data.mjs`). The slides, sections and tiles are drawn, not the GTEx images; values read off
  the talk's figures are in `tools/micro/data/figures.json`, and stand-ins are said to be so.

- **The aging ovary** (`stories/ovary.js`), after the poster "Mapping the histological landscape of human ovarian aging"
  (Parijat Chakraborty, Samir Moustafa, André Rendeiro; LBI Network Medicine, CeMM, Faculty of Computer Science of the
  University of Vienna; supported by CeMM and the ERC; data GTEx), public, used with the owner's OK. Its numbers are
  typed in (`tools/ovary/sets/data.js`, made by `tools/ovary/data/gen_data.mjs`), values read off its figures are in
  `tools/ovary/data/figures.json` (the counts on the ovary come from its lines, so they are approximate); the
  neighbor network is illustrative, and the ovary, slides and sections are drawn, not GTEx images.

- **Three qubits** (`stories/qubits.js`), after the method and figures of Joel Hancock (network compression onto
  qubits and the Pauli decomposition). The networks shown are examples made up for the story and computed in the
  page (`tools/qubits/sets/qmath.js`): no STRING data, gene names or patient data. The real run's summary numbers
  (on STRING v12.5) are typed in from his brief (`tools/qubits/sets/data.js`) and shown only as "in the real
  network"; the cut stands in for the authors' beam search, and the walkers' valleys are illustrative. This story
  uses American spelling, as its author asked (so does the aging ovary story, as the owner asked).

- **The mutation machine** (`stories/mutation.js`), after the poster "Converting Mutation into a Machinery: DNA
  Substitution Models as Quantum Circuits" by Enes Berk Sakalli (Ludwig Boltzmann Institute for Network Medicine) and
  Arndt von Haeseler (CIBIV, Max Perutz Labs, University of Vienna and Medical University of Vienna), a draft, and the
  first author's answers to our questions. As in the authors' own test, the numbers drawn are examples, computed in the
  page (`tools/mutation/sets/mmath.js`): the rules of change, the family trees and their swaps, the circuit's angles and
  the rebuilt ancestors. The poster's numbers (its sequences and the shares of its test) are typed in
  (`tools/mutation/sets/data.js`) and shown only as "in the authors' test"; the coupling computed live is our stand-in
  for their circuit, and says so. The test is synthetic: no patient data. The poster's pictures are not shown: its
  figures are redrawn in 3D.

- **The shape of tissue** (`stories/topo.js`), after the poster "topocyte: scale-resolved topological phenotyping of
  tissue architecture across spatial modalities" by Simon Schindler, André Rendeiro and Jörg Menche (Ludwig Boltzmann
  Institute for Network Medicine at the University of Vienna; University of Vienna; CeMM Research Center for Molecular
  Medicine of the Austrian Academy of Sciences; Medical University of Vienna; Max Perutz Labs, Vienna BioCenter), and
  the package's documentation (topocyte.lab.lbi-netmed.com). Every number is computed by the authors' package topocyte
  and the poster's own figure scripts, run by `tools/topo/data/gen_data.py` on the authors' GTEx liver cohort (123
  slides, 66 healthy and 57 with cirrhosis, 30.8 million cells found by HistoPLUS, CC BY 4.0); the page only looks the
  numbers up. Only the numbers are kept (`tools/topo/sets/data.js`): the authors' files, slide ids, donor details and
  images are not in the repository, the slides are numbered, and the tissue is drawn from the cells' positions and
  types. topocyte (GPL-3) is run offline only; none of its code is in the app. The cell types are the cell
  classifier's labels, not a pathologist's; the genes and proteins of the last chapter are sketches of the workflow,
  not data.

- **Holding on to nitrogen** (`stories/soil.js`), after the slides "Exploring the Effects of Biological Nitrification
  Inhibition on the Rhizosphere Microbiome of a BNI-enabled Winter Wheat" by Marina Montserrat Díez, Tadashi Yoshihashi,
  Guntur Subbarao Ventaka, Eleftheria Bachtsevani, Dimitrios Karpouzas, Christina Hazard, Melina Kerou and Christa
  Schleper (University of Vienna; University of Thessaly; Université Lyon 1 Claude Bernard; JIRCAS, Japan International
  Research Center for Agricultural Sciences), and their field trial's data, shown with the authors' permission; made for
  the Global Peter Drucker Forum in Vienna. The field measures, the microbes and the co-occurrence network are the
  trial's data (the network built for this story with a standard method: correlation, not interaction), read by
  `tools/soil/data/gen_data.py` from the authors' files, which are not in the repository; day 70's chlorophyll, the
  jars' nitrous oxide and the qPCR counts are read off the slides (approximate); the soil block, its flows, the relay,
  the chromosome and the field's layout are illustrative, and the story says so. Kinds of microbe are numbered, never
  named by their ids; none of the slides' pictures is shown. The wheat line after Subbarao et al., PNAS.

- **Pass it on** (`stories/pass.js`), an outreach story of the Ludwig Boltzmann Institute for Network Medicine
  (LBI-NetMed), in English and German. Its globe is the airports story's (OpenFlights.org routes, 2014 snapshot, Open
  Database License; Natural Earth coastlines) and its cell the cell map story's (Human Protein Atlas and UniProt
  places; ideas from Thul et al. 2017, Go et al. 2021, Cho et al. 2022, Qin et al. 2021, Lundberg & Borner 2019),
  taken unchanged from those stories when it is built. The fish are a live simulation after the flock's (schooling:
  Rosenthal et al. 2015, Handegard et al. 2012), and the outbreak a seeded S/E/I/R model on the real route network,
  said to be a simple model, not a forecast.

- **Flock** (`stories/flock.js`): a live simulation, not data. Each bird
  matches the heading of its seven nearest neighbours (topological interaction,
  after Ballerini et al., PNAS 2008) and keeps its distance; the flock as a
  whole wheels about in front of you and now and then swoops round you; alarm
  passes from neighbour to neighbour when a
  falcon comes (after Procaccini et al., Animal Behaviour 2011; Cavagna et al.,
  PNAS 2010 on how far a change spreads in a flock). Sky, land and birds are
  illustrative.

- **Robot gang** (`stories/robots.js`): a live simulation, not data, and no
  particular brand of robot. Early robot vacuums had no map and much of the
  time drove until they bumped into something, turned and drove on; in swarm
  robotics each robot often follows a few others, and the network of who
  follows whom shapes what the group does (Olfati-Saber, Fax and Murray,
  Proceedings of the IEEE 2007). Speeds and cleaning times are tuned to look
  right, not measured. In a headset the room comes from the headset's room
  setup (WebXR plane and mesh detection; every story asks for it, as an
  optional feature, when it enters AR; VR asks for no room scan); without one
  the robots get a virtual room round you.

The protein data is meant for teaching, not research.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | the app: Stories screen, shared page layout, loads and swaps the stories |
| `stories/airports.js`, `stories/proteins.js`, `stories/spatial.js`, `stories/lbi.js`, `stories/nmd.js`, `stories/endo.js`, `stories/pet.js`, `stories/micro.js`, `stories/ovary.js`, `stories/qubits.js`, `stories/mutation.js`, `stories/topo.js`, `stories/soil.js`, `stories/pass.js`, `stories/flock.js`, `stories/robots.js` | the sixteen stories, with their data, explore modes and headset panels |
| `stories/design.js`, `stories/studio.js` | two pages that are not stories (on no Stories screen): the design room (`#design`, a table with a small model of every prop) and the studio (`#studio`, your own models, trigger cubes and sounds placed in the room, served and saved by the relay's `--scenes`, with an upload page at `<relay>/upload`; see `tools/studio/README.md`) |
| `stories/list.js` | the list of stories (their cards), read at the start and again while the app runs |
| `version.json` | the latest release, written by `node tools/release.mjs`: running copies take new and changed stories from it, and ask before a new shell (see `AGENTS.md`, "Hot reload and live updates") |
| `whatsnew.json` | what is new in the latest release, what to test and what is untested, written by hand at every release: developer mode shows it (see `AGENTS.md`, "Developer mode"; `node tools/release.mjs --check` fails while it names another release) |
| `proteins.html`, `spatial.html` | forward old links to the app |
| `sw.js`, `manifest.webmanifest`, `icons/` | offline cache and app install |
| `audio/` | the narrations (the airports' recorded, the others synthetic, from `tools/voice/`) |
| `three.min.js` | three.js r128 (MIT licence, see `three.LICENSE.txt`) |
| `shared.js` | shared rooms: the client (rooms, stations, the clock, the room frame in a headset, presence, the Shared dialog and headset panel) |
| `sfx.js` | the shell's sound effects (`HOST.sfx`: clicks, chimes, room sounds and the stories' own sounds, made in code, through the narration's context; on by default, silent on a page until *Sound* is pressed; a quiet background only for the flock and Pass it on); `tools/sfx.html` is its sound board, `tools/sfx-render.mjs` renders every sound to MP3 |
| `occlusion.js` | real-world occlusion in AR (`HOST.occlusion`): real people, hands and the room scan hide what stands behind them (on by default; untested in the app on a Quest) |
| `ships.js` | the spaceships (`HOST.ships`, v132): a little ship flown with the right controller like a joystick, or with its thumbstick (v133; the right stick clicked twice), shield and health, drones, drifting targets and pickups fought together in a shared room; nothing stored (untested on a headset) |
| `relay/` | the shared rooms' server (`server.mjs`, no packages), its test, Dockerfile and guide (`README.md`) |
| `relay/trackers.mjs` | the relay's part for the PC's Vive trackers (`--trackers`, only on the PC with SteamVR): takes the bridge's readings on UDP 127.0.0.1 and sends them, lined up, to the rooms that use them (`relay/README.md`, "The PC's Vive trackers") |
| `HANDOVER.md` | start here when taking the project over |
| `docs/` | the shared rooms' plan (`shared-space-plan.md`), the lessons it applies (`multiplayer.md`, `shared-spaces.md`) and what two Quest 3s did (`quest-shared-space-findings.md`); for the handover: data sources and permissions (`data-and-permissions.md`), open questions for the authors (`questions-for-authors.md`), setup, tests and release (`setup-and-release.md`), running a session with headsets (`event-runbook.md`) and the narration scripts (`narration.md`) |
| `tools/smoke.mjs` | headless test: loads every story and fails on page errors |
| `tools/collab.mjs` | headless test of shared rooms: a relay and several pages, and a pretend headset, in one room |
| `tools/update.mjs` | update test: an older version installed, then this one deployed (see `AGENTS.md`) |
| `tools/release.mjs` | a release step: writes `version.json` and stamps the shell's release into `index.html` (`--check` says whether they are current, and whether `whatsnew.json` names this release) |
| `tools/live.mjs` | test of hot reload and live updates: a copy of the app changed as a release or an editor would, on a static host and through the relay's `--watch` |
| `tools/audio.mjs` | narration test under the headset browsers' sound rule, with faults that make the fallback take over (needs `audio/narration.mp3`) |
| `tools/narration.mjs` | writes `docs/narration.md` from the running stories (serve the folder first) |
| `tools/pace.mjs` | paces the stories without a recording: writes their `NARRATION_SYNC` from the words on their panels (`--write`; serve the folder first) |
| `tools/lbi/` | sources of the tour: its 3D sets, engine parts and build script (`node tools/lbi/build.mjs` writes `stories/lbi.js`) |
| `tools/nmd/` | sources of the muscle story (`node tools/nmd/data/gen_data.mjs <the authors' folder>`, then `node tools/nmd/build.mjs` writes `stories/nmd.js`) |
| `tools/endo/` | sources of the endotype story (`node tools/endo/build.mjs` writes `stories/endo.js`; data from `tools/endo/data/gen_data.py` and the authors' files, which are not in the repository) |
| `tools/pet/` | sources of the PET story (`node tools/pet/data/gen_data.mjs`, then `node tools/pet/build.mjs` writes `stories/pet.js`) |
| `tools/micro/` | sources of the microanatomy story (`node tools/micro/build.mjs` writes `stories/micro.js`; data from `tools/micro/data/gen_data.mjs` and Iva Buljan's network file, which is not in the repository) |
| `tools/ovary/` | sources of the aging ovary story (`node tools/ovary/data/gen_data.mjs`, then `node tools/ovary/build.mjs` writes `stories/ovary.js`) |
| `tools/qubits/` | sources of the qubits story (`node tools/qubits/build.mjs` writes `stories/qubits.js`; `node tools/qubits/test-qmath.mjs` checks its maths) |
| `tools/mutation/` | sources of the mutation story (`node tools/mutation/build.mjs` writes `stories/mutation.js`; `node tools/mutation/test-mmath.mjs` checks its maths) |
| `tools/topo/` | sources of the tissue topology story (`node tools/topo/build.mjs` writes `stories/topo.js`; `node tools/topo/test-data.mjs` checks its data against the poster's numbers; data from `tools/topo/data/gen_data.py` and the authors' files, which are not in the repository) |
| `tools/soil/` | sources of the soil story (`node tools/soil/build.mjs` writes `stories/soil.js`; `node tools/soil/test-data.mjs` checks its data, decoders and key numbers; data from `tools/soil/data/gen_data.py` and the authors' files, which are not in the repository) |
| `tools/pass/` | sources of the pass story (`node tools/pass/build.mjs` writes `stories/pass.js`, cutting its globe and cell out of `stories/airports.js` and `stories/spatial.js`; `node tools/pass/test-sets.mjs` checks its sets) |
| `tools/flock/` | sources of the flock (`node tools/flock/build.mjs` writes `stories/flock.js`) |
| `tools/robots/` | sources of the robot gang (`node tools/robots/build.mjs` writes `stories/robots.js`) |
| `tools/studio/` | sources of the studio (`node tools/studio/build.mjs` writes `stories/studio.js`; `convert.mjs` turns a model into a GLB on a computer, `scan.mjs` describes a plain folder of scenes; its `README.md` is the formats guide) |
| `tools/trackers/` | the Vive trackers' bridge (`bridge.py`: SteamVR's poses to the relay on the same Windows PC; Python 3 and pyopenvr, `--fake` without SteamVR), a fake bridge in Node (`fake.mjs`), the setup on the PC (`README.md`) and the contracts as built (`SPEC.md`) |
| `tools/voice/` | the synthetic narrations: `narrate.mjs <key>` speaks a story's words (Kokoro; German with Piper) and re-times the story, `check.mjs <key>` checks the result (models and Python outside the repository; see its `README.md`) |
| `AGENTS.md`, `CLAUDE.md` | notes on the architecture and conventions for AI coding agents (and people) |
| `README.txt` | the same notes in plain text |

## Developing

Plain HTML and JavaScript, no framework or dependencies. `AGENTS.md` explains
how the app shell and the stories fit together, the conventions, and the
things that are easy to forget. Before a release to `main`, serve the folder and run the
smoke test (pushes to `dev` get only the cheap checks; needs Playwright and its Chromium; setting up a machine, every test
and the release routine are in `docs/setup-and-release.md`):

```sh
npx http-server -p 8123 -c-1 .
node tools/smoke.mjs http://127.0.0.1:8123/
```

The tour (`stories/lbi.js`) is generated from `tools/lbi/`; edit the sources
there and rebuild with `node tools/lbi/build.mjs` (see `tools/lbi/README.md`).
The muscle story (`stories/nmd.js`) is generated the same way from `tools/nmd/`
(see `tools/nmd/README.md`), the endotype story (`stories/endo.js`) from
`tools/endo/`, the PET story (`stories/pet.js`) from `tools/pet/`, the
microanatomy story (`stories/micro.js`) from `tools/micro/`, the aging ovary story (`stories/ovary.js`) from
`tools/ovary/`, the qubits story (`stories/qubits.js`) from
`tools/qubits/`, the mutation story (`stories/mutation.js`) from `tools/mutation/`, the tissue topology story (`stories/topo.js`) from `tools/topo/`, the soil story (`stories/soil.js`) from `tools/soil/`, the pass story (`stories/pass.js`) from `tools/pass/` (with the airports' globe and the cell map's
cell taken from their stories at build time), the flock
(`stories/flock.js`) from `tools/flock/` and the robot gang
(`stories/robots.js`) from `tools/robots/`, each with `node tools/<key>/build.mjs`
(`--check` says whether the built file is out of step).
`AGENTS.md` also has advice on working economically with AI coding agents.

After changing shared rooms (`shared.js`, `relay/` or a story's shared-room
hooks), also run `node relay/test.mjs` and `node tools/collab.mjs` (it starts
its own relay).

Headset behaviour can only be checked on a device.
