Networks, in sixteen stories - installable web app
  1. Network theory, told with the world's airports  (stories/airports.js)
  2. Network medicine, told with the proteins in a cell  (stories/proteins.js)
  3. Spatial interactome, where proteins meet in a cell  (stories/spatial.js)
  4. A glimpse into the future of network medicine: a 3D tour of the Ludwig
     Boltzmann Institute for Network Medicine  (stories/lbi.js)
  5. Muscle and heart: rare diseases of nerves and muscles in a 71-layer
     network, after Iker Núñez-Carpintero and Philipp Friedrich  (stories/nmd.js)
  6. Endotypes: one rare disease of the junction between nerve and muscle, 35
     genes and 12 hidden mechanisms, after the EndotypY poster by Chloé Bûcheron
     and colleagues  (stories/endo.js)
  7. One scan, one system: a PET scanner, the body's organs and the network of
     their metabolism from 658 scans, after Barbara K Geist and colleagues
     (stories/pet.js)
  8. Tissue and time: the small working units organs are built from, in 24,945
     slides, and how they change with age, after Iva Buljan and colleagues
     (stories/micro.js)
  9. The aging ovary: what 255 ovaries show about aging, from the reserve of
     follicles to two deep-learning methods and the trends with age, after the
     poster by Parijat Chakraborty, Samir Moustafa and André Rendeiro
     (stories/ovary.js)
  10. Three qubits: how a gene network is shrunk to fit on a tiny quantum
     computer, and broken into building blocks it runs well, after Joel
     Hancock's method and figures  (stories/qubits.js)
  11. The mutation machine: how DNA changes letter by letter along a family
     tree, and how a rule for those changes becomes a quantum circuit, one
     machine per branch; after the poster by Enes Berk Sakalli and Arndt von
     Haeseler  (stories/mutation.js)
  12. The shape of tissue: where cells sit in slides of liver, read at every
     scale at once (persistent homology), and which scales tell cirrhosis from
     healthy tissue, down to every cell; after the poster by Simon Schindler,
     André Rendeiro and Jörg Menche, on their data  (stories/topo.js)
  13. Holding on to nitrogen: a wheat, its soil and the microbes in between;
     a wheat that slows the soil's microbes stays greener and leaks less
     nitrate in a field trial in Japan, while the crowd of microbes follows the
     fertiliser far more than the wheat; after the slides and field trial of
     Marina Montserrat Díez, Christa Schleper and colleagues  (stories/soil.js)
  14. Pass it on (Weitersagen!): how warnings, viruses and signals spread, from
     a school of fish to the world's flights to a cell; for everyone, in
     English and German  (stories/pass.js)
  15. Flock: 200 starlings at dusk flying all around you, each following its
     seven nearest neighbours  (stories/flock.js)
  16. Robot gang: robot vacuums in your room that bump and turn, follow you
     about or form a conga line; in a headset they find your floor and walls
     (stories/robots.js)

Besides the stories, the design room (#design, stories/design.js; not on the
Stories screen) is a table with a small model of every prop of the stories,
a plate per story: point at one for its name, put it on the stage for its card
(what it shows, its params, views and source), and in a headset pick it up.
In a headset, Design room in the menu (the clock on the left wrist) opens it;
in a shared room, Design room here puts the table at your feet as a circle
(Add a station on the page offers it too; Arrange all leaves it alone), and
over every circle its story's small model turns, so circles tell apart.

index.html is the app: it shows a start screen to pick a story, and the Stories
button (top bar, and the panel in VR/AR) brings it back. Stories are loaded into
the same page, so changing story never ends a VR or AR session; entering VR or
AR from the start screen opens a Stories screen in the headset (one panel per
story); entering from inside a story resumes it where you were. In a shared
room a headset has no Stories screen: you walk to a story's station instead.
The start screen is the landing page (no hash, or #stories). The address
follows you: #stories on the Stories screen (page or headset), #airports,
#proteins, #spatial, #lbi, #nmd, #endo, #pet, #micro, #ovary, #qubits, #mutation, #topo, #soil, #pass, #flock or #robots in a story, so links can be shared and open that story
directly (proteins.html and spatial.html forward there). Taking the headset off and on returns to the Stories menu
(and, unless Anchor is on, places everything in front of the next wearer).
A story builds in steps while it loads: the page shows a thin bar and the step
under its loading line, and a headset shows a card with the story's name and a
bar in front of you and a ring on your left wrist until the story appears.
Repeat all and Repeat one on the Stories screen (page and headset) keep the app
playing for an exhibition: Repeat all plays the stories one after another
without end, Repeat one plays the story you pick again and again. Press the lit
button to turn it off. It is remembered on the device; a link ending in
#airports&repeat=all (or repeat=one) sets it.
Slideshow: a story stops at the end of each chapter, with all its text shown,
until you press Next (or Play, or A or X in a headset). The narration finishes
the chapter's last words before it waits. Next is at the foot of the story
panel (on a phone, beside Play), and in a headset under the panel where the
chapter's name was. Turn it on for one story
with "Slideshow: off/on" at the foot of the story panel (in a headset, beside
the clock under the panel), or for every story with
Slideshow on the Stories screen (in a headset, in the menu on the left hand).
It is remembered on the device; #slides=on (or #slides=off) in a link sets it
for every story. In a shared room a stop pauses the station for everyone there,
like a pause by hand.
Anchor (headset Stories screen) keeps the network and the panels at one spot
in the real room, for every story: through taking the headset off and on (the
next wearer still starts on the Stories menu), recentring, leaving VR and
reloading. While anchored the grip moves nothing; Place again puts everything
in front of you and anchors it there. To arrange things first, leave Anchor off,
move them with the grip, then press Anchor. It uses the Quest Browser's room
anchors (not in private browsing; clearing the site's data forgets the place);
without them the place holds until you leave VR. #anchor=on (or #anchor=off) in
a link sets it.
Shared rooms (Shared button, top bar and Stories screen; in a headset the menu:
the clock on your left wrist): several headsets and screens join one
room and see the same stations, a story each at a spot in the room, in step on
every device (anyone can play, pause, jump or change a control; the last action
wins). A headset runs only the station it stands at: walk into a station's
circle and after a second its story plays there; the others show as rings on the
floor with a card, and over each ring a small turning model of its story in its
colour, so you can tell the circles apart from across the room. Away from every station no story shows, only the rings, the
cards, the other people and the menu; walk out of a circle and its story hides
and pauses on your headset (it plays on for the others), walk back in and it
carries on as the station has it. Pointing at a card and pulling the trigger
does not take you there: walk into its circle. A headset in a room never shows
the Stories screen (leave the room in the menu and it comes back); in a room
with no stations yet the menu opens by itself, with Arrange all.
People in the room calibrate every headset on the same two tape marks
(Calibrate: touch mark A, then mark B, with the ring at the front of a
controller; orange crosses then show where the headset puts the marks, and two
anchors keep the calibration for next time and after the headset was off; if
the panel says the anchor store is full, clearing Quest Browser's site data may
help, see relay/README.md; if after standby it says to leave AR and enter it
again, do that: the headset finds its marks again in a new AR session). A headset's own calibration is
never overridden, and the room's floor comes from the marks, so a headset
with a wrong floor still shows things at the same height. Headsets without
marks line up through Quest Browser's experimental shared space (on unless
switched off in the menu; every headset needs the same browser version
and the WebXR experiments flag), and line up again after standby; if one is
still off, press Re-align in its menu (it lines that headset up again
from the start). If two calibrated headsets find the shared space puts them
far apart (each headset can keep its own copy of it), Fresh shared space in the
menu (twice) moves the whole room to a new address where the headsets
make a new one: start AR on one headset first, then the others. The relay keeps the headsets' logs in
relay/logs/ for checking alignment. People elsewhere and
screens
see the stations round their own spot. Screens get a room map and Follow a
station, or Follow a person in a headset (in the Shared dialog's people list:
the screen shows whichever station they stand at, switching as they walk, for
people watching without a headset). In a headset you stay in a story once you
have walked into its circle, wherever you walk, until you walk into another
circle; while you are in one, the other circles show only their rings (point at
a ring to see its card and model), and other people are drawn only when they are
at your circle (People: everyone in the menu shows them all). Over each station's ring a small 3D model of its story turns, in its
colour, so you can tell the circles apart from across the room. A station moves with the grip on its ring or card in a headset (point
to swing it round, raise or lower to push or pull, twist to turn it), or by
dragging its dot (or its square, to turn it) on the room map; everyone sees it
move. Lock circles (headset menu or Shared dialog) then keeps them where they are,
until someone unlocks it. At a station in a headset the grip moves the scene
or the story panel and both grips resize the scene, during the story too, for
everyone at once (unless that story is locked: Lock this story in the menu at its
circle, or Lock story per station in the Shared dialog; among the fish of Pass it on the
grip in the sea moves the school, for everyone there too); each station keeps
its story, so the story panel has no Stories button there: another story is
another station. In a headset the menu is closed at first: only a clock shows, worn
like a watch on your left wrist (on the left controller, or on your wrist with
hand tracking; beside the story panel without either). Touch it with the right
controller's tip or your right index finger, click the left stick, or point at
it and pull the trigger, to open the menu above it; the same closes it again.
Inside: Exit (leaves VR or AR; the story panels have none), Slideshow for every
story, Sound check, four headset settings for every story, and the shared room. With hand
tracking a fingertip presses its buttons too, or pinch while pointing. Labels,
the small labels inside the scenes: on top (the default: drawn over
everything), in 3D (signs in the scene turned to you, hidden by what is in
front of them) or hidden. Cards, the larger ones (the story's text panel and
its play and pause bar, the stations' cards over the circles and people's name
tags): in 3D (the default: they stand in the scene, hidden by what is in front
of them), on top (drawn over everything, as before) or hidden (no story panels
at all, in the story and in explore mode, no station cards and no name tags; A
or X still plays and pauses, and the menu on your wrist brings them back). The
two are independent; each press goes to the next. Moving:
free (the default: the grip holds the scene like a real object and turns it
with your hand, two hands turn it too; the story panel can tilt; Recenter
puts things back) or facing you (things you move keep facing you and the
panel stays upright). Subtitles: off (the default) or on (the narration's words
in a strip low in your view while a story plays, following your head when you
turn away; #subs=on in a link turns them on). In a shared room all four
settings are the room's, the same for everyone in it (also set in the Shared
dialog; the locks do not stop them), and a scene turned at a station is
turned for everyone there.
#labels=face|fixed|hidden, #cards=face|fixed|hidden and #free=on|off in a link set them. Panels, a fifth
row, is for the story on show only: shown, controls only (just the play bar
under the panel, good with subtitles) or hidden (A or X still plays); each story
keeps its own, in a shared room each station's, for everyone at its circle (also
per station in the Shared dialog); #panels=controls in a link sets it for the
story the link opens.
At a station the flock flies round the station's spot, roughly in the same place for everyone (one device leads, the others follow it), with the
same falcons. The robots move separately on each device; their controls and crumbs are shared. Others join a room through the relay
(relay/, Node, no packages), which GitHub Pages cannot run: for now it runs on a
machine on the same Wi-Fi as the headsets and serves the app itself (node
relay/server.mjs --lan prints the https:// address to open on each headset; see
relay/README.md). GitHub Pages serves everything else; a copy there can join a
relay elsewhere with &relay=wss://... in the room link. #s=XYZ in a link joins
room XYZ. Without a relay (none known, or none answers) a room runs peer to
peer: one page hosts it and the others link to it directly (PeerJS, vendored;
its public introduction server and Cloudflare's STUN server introduce the
devices, and they and the other devices see each device's IP address). The
dialog and the menu say "peer to peer · hosted here" or "hosted by" a name.
Start such a room on a laptop or desktop page that stays awake (a headset that
starts one hands it to the first such page that joins); when the host leaves,
the one longest in the room takes over within seconds (up to about a minute
when it vanished without leaving). It needs internet access and a network that
lets devices reach each other directly (bring your own router; the test page
p2p/ checks a network first). There is no Fresh shared space and no stored logs
then. &peer=host:port/path in a link uses another introduction server (the
relay has one at /peerjs), &peer=off none. When peer to peer cannot be had
either, a room still works on
the device alone: Start a room here in the headset's menu places the stories in
your room (Arrange all, moving them, Lock circles, calibrating); the room is kept
on the device, and once a relay answers it moves there and others can join it.
Rooms on this network (the same router or internet address) are listed in the
Shared dialog and the headset's menu, one press to join; a device that was in a
room joins it again by itself when the app opens on that network within a week
(never one it left or was never in; elsewhere it offers Start room XYZ again,
and Show on this network hides a room). Only a short hash of the network's
address is used, never the address itself.
Nothing changes for anyone not in a room. Tried on two Quest 3 headsets in one
room several times; what they did, and what is still unconfirmed, is in
docs/quest-shared-space-findings.md.

Upload the whole folder to any HTTPS web server (GitHub Pages, Netlify,
your university web space ...). Installing and VR both need https://.

VR asks the headset for less than AR (no room scan, no shared space): a Quest 3
left VR for its home at once when asked for everything. If VR still closes by
itself within 10 seconds, press Enter VR again: each such try asks for less.
Sound check shows what VR asks for now.

Install:
- Meta Quest Browser: open the page, then use the Install button in the
  address bar (or the "Install" button in the page's top bar if shown).
  The app then appears in your Library under "Unknown sources"/apps.
- Chrome / Edge (desktop, Android): Install button in the top bar or the
  install icon in the address bar.
- iPhone/iPad Safari: Share > Add to Home Screen.

Narration: put your recordings at audio/narration.mp3 (airports),
audio/narration-proteins.mp3 (proteins), audio/narration-spatial.mp3
(cell map), audio/narration-lbi.mp3 (the tour), audio/narration-nmd.mp3,
audio/narration-endo.mp3, audio/narration-pet.mp3, audio/narration-micro.mp3,
audio/narration-ovary.mp3, audio/narration-qubits.mp3, audio/narration-mutation.mp3, audio/narration-topo.mp3, audio/narration-soil.mp3, audio/narration-pass.mp3, audio/narration-flock.mp3 and audio/narration-robots.mp3 (the airports
one is recorded; the tour's is a synthetic voice, made by tools/voice/, which
can narrate the others too); see the note in the audio folder for chapter timings
and how to record one, and docs/narration.md for the words. It plays in
sync with the story, follows pause, seeking and chapter jumps, and has a Sound
on/off button (top bar and VR panel). Browsers only start sound after a tap or
click: the first one in the app (Enter VR counts) turns sound on for every
story, also when you change story inside the headset. If the button says Play
sound, press it. Without the file the story runs silently, at a pace that leaves time
to read its panel (tools/pace.mjs sets it from the words).
No sound? Open Sound check on the Stories screen (on the page, or in the headset
under the title; in a shared room in the headset's menu): it shows what the sound system is doing, plays a test beep
through each of the app's two ways to play sound (Web Audio and an audio
element) and lets you choose the one you hear. Reset clears the saved choices.
A link ending in #soundcheck opens it.
Sound effects (clicks and chimes for buttons and the shared room, each story's
own sounds at its moments and in explore mode, and a quiet background for the
flock and Pass it on only, all made in code) are on unless turned off. Two
switches, each for every story at once: Sound effects and Narration (off: the
narration is silent and the story runs on its own clock; subtitles and effects
go on). They are in the headset's menu, the page's Shared dialog and Sound check,
and #sfx=off or #voice=off in a link sets them; in a shared room they are the
room's, for every page and headset in it, once someone there sets them (until
then each device keeps its own). The effects' volume (Sound check, the
headset's menu) is each device's own. The Sound button silences the narration
and the effects together on that device, and the effects dip under the
narration while it plays. tools/sfx.html is a sound board that plays every one and renders a
story's whole sound track; node tools/sfx-render.mjs writes them to files
(--story <key> for a story's track), and node tools/sfx-cues.mjs checks every
story's sound cues.

After changing any file (including adding or replacing a narration file),
bump VERSION in sw.js so installed copies update, then run node
tools/release.mjs (it writes version.json). Online, the app always fetches
its files fresh (the cache is for offline use). A copy that is open picks up
a release by itself, about once a minute: new and changed stories are taken
without losing your place (the story on show is swapped at a quiet moment),
and a new shell asks first (Reload now or Later; on the Stories screen it
reloads by itself). While developing, node relay/server.mjs --static . --watch swaps a
saved story in place on every page and headset showing it.

Protein data: an illustrative, hand-curated subnetwork of 254 well-documented
human proteins and 375 interactions (complexes and pathways from the
literature), not the full interactome. Essential genes follow DepMap common
essentials; disease genes are a small textbook set. Statistics were computed
with NetworkX (Louvain modules, betweenness). Good for teaching, not research.

Cell map data (spatial.html): an illustrative, hand-curated set of 249
well-documented human proteins in 13 compartments of a model cell. Proteins
found in several places get one copy per place (282 copies), joined by dotted
lines; 252 documented interactions join copies that meet (same compartment, or
across a membrane they share). Places follow the Human Protein Atlas and
UniProt. Seven "moves" (NF-kB, apoptosis, TFEB, GLUT4, NRF2, and the disease
cases ALS and cystic fibrosis) switch copies on and off. The lists PROTEINS,
LINKS, TOGETHER and MOVES sit at the top of stories/spatial.js and can be
edited; the cell model and protein positions are built when the page loads.
Good for teaching, not research.

Tour data (stories/lbi.js): mostly illustrative and built when the story
loads. The interactome has about 9,100 proteins and 22,100 interactions, of which
the 254 named proteins (in ten groups) are the curated set of the
network-medicine story. The friendship globe uses the real positions of the
3,214 airports; its ties are illustrative. ATP synthase follows the textbook
structure (13 of its proteins, two of them assembly helpers that leave;
8-subunit c-ring, 8 protons and 3 ATP per turn). The immunity Sankey uses the totals of Guthrie et al. 2023 (173 genes,
9 clinical categories, 19 clusters); the flows between them are illustrative,
as are the disease modules, the patient, the organ network and the tissue.

Muscle story data (stories/nmd.js): the authors' analysis files in ikerdata/
(no patient data): 13 disease groups of the 2024 Gene Table of Neuromuscular
Disorders, their known genes, the genes the random walk added and their
endotypes; 15,246 links among 1,182 genes in the 27 protein layers, and the
phenotype and co-expression layers for the overlap of congenital myopathies and
cardiomyopathies. The other layers show no links yet. Layer z-scores and walk
visits are computed in this map on the protein layers; endotype names are the
most typical GO process of their genes. The motor unit and the supercomputer
are illustrative.

Endotype story data (stories/endo.js): the authors' EndotypY run on congenital
myasthenic syndromes (no patient data): the 35 genes of the Gene Table of
Neuromuscular Disorders, their protein network (18,306 proteins, 316,613
links) and their 12 endotypes of 393 genes. Only the numbers the story needs
are in the repository (tools/endo/sets/data.js), not the authors' files. The
steps before the endotypes (seed groups, the walk, neighbourhoods, the GO
annotation, the tree) are re-run with the package's default settings to show
the method; the tree is drawn to agree with the authors' endotypes. Endotype
names follow their strongest COMPARTMENTS term. The synapse is illustrative.

PET story data (stories/pet.js): the paper by Geist et al. (Med 6, 100881,
2025; CC BY 4.0) and the poster "Shaping a New Era in Nuclear Medicine". No
patient data: the network of all 658 scans is printed in the paper (Figure 2A);
the other networks are read off its figures (tools/pet/data/figures.json).
Typical organ uptakes and the synthetic cohort behind explore's matrix and
scatter views are illustrative stand-ins. node tools/pet/data/gen_data.mjs
writes tools/pet/sets/data.js.

Microanatomy story data (stories/micro.js): the preprint by Buljan, Bago-Horvath
and Rendeiro (bioRxiv 2025, CC BY-NC), its poster and talk, and Iva Buljan's
network of organ architecture (kept out of the repository; only the numbers
are in tools/micro/sets/data.js, from node tools/micro/data/gen_data.mjs). The
slides and sections are drawn, not the GTEx images.

Aging ovary story data (stories/ovary.js): the poster "Mapping the histological
landscape of human ovarian aging" by Chakraborty, Moustafa and Rendeiro
(public; data GTEx). Its numbers are typed in (tools/ovary/sets/data.js, from
node tools/ovary/data/gen_data.mjs), values read off its figures are in
tools/ovary/data/figures.json. Its neighbor network is illustrative, and the
counts on the ovary are read off the poster's lines (approximate); the ovary,
slides and sections are drawn, not GTEx images.

Qubits story (stories/qubits.js): after Joel Hancock's method and figures
(network compression onto qubits and the Pauli decomposition). The networks it
shows are examples made up for the story and computed in the page (no STRING
data, no gene names, no patient data); the real run's summary numbers (on
STRING v12.5) are typed in from his brief (tools/qubits/sets/data.js) and shown
only as "in the real network". The cut stands in for the authors' beam search,
and the walkers' valleys are illustrative. This story alone uses American
spelling, as its author asked.

The mutation machine (stories/mutation.js): after the poster "Converting
Mutation into a Machinery: DNA Substitution Models as Quantum Circuits" by Enes
Berk Sakalli and Arndt von Haeseler (a draft) and the first author's answers to
our questions. As in the authors' own test, the numbers drawn are examples,
computed in the page (tools/mutation/sets/mmath.js); the poster's numbers are
typed in (tools/mutation/sets/data.js) and shown only as "in the authors' test".
The coupling computed live is our stand-in for their circuit, and says so. The
test is synthetic (no patient data); the poster's figures are redrawn in 3D, its
pictures never shown.

The shape of tissue (stories/topo.js): after the poster "topocyte:
scale-resolved topological phenotyping of tissue architecture across spatial
modalities" by Simon Schindler, André Rendeiro and Jörg Menche, and the
package's documentation (topocyte.lab.lbi-netmed.com). Every number is computed
by the authors' package topocyte and the poster's own figure scripts on the
authors' GTEx liver cohort (123 slides, 66 healthy and 57 with cirrhosis, 30.8
million cells found by HistoPLUS, CC BY 4.0), by tools/topo/data/gen_data.py;
the page only looks the numbers up (tools/topo/sets/data.js). The authors'
files, slide ids, donor details and images are not in the repository: slides
are numbered, and the tissue is drawn from the cells' positions and types.
topocyte (GPL-3) is run offline only, none of its code is in the app. The cell
types are the cell classifier's labels; the genes and proteins of the last
chapter are sketches of the workflow, not data.

Holding on to nitrogen (stories/soil.js): after the slides "Exploring the
Effects of Biological Nitrification Inhibition on the Rhizosphere Microbiome of
a BNI-enabled Winter Wheat" by Marina Montserrat Díez, Tadashi Yoshihashi,
Guntur Subbarao Ventaka, Eleftheria Bachtsevani, Dimitrios Karpouzas, Christina
Hazard, Melina Kerou and Christa Schleper (University of Vienna, University of
Thessaly, Université Lyon 1, JIRCAS), and their field trial's data, shown with
the authors' permission (made for the Global Peter Drucker Forum in Vienna).
The field measures, the microbes and the network are the trial's data (the
network built for this story with a standard method: correlation, not
interaction); day 70's chlorophyll, the jars' nitrous oxide and the qPCR counts
are read off the slides; the soil block, its flows, the relay and the field's
layout are illustrative, and the story says so. The authors' files are not in
the repository (tools/soil/data/gen_data.py reads them); kinds of microbe are
numbered, and none of the slides' pictures is shown.

Pass it on (stories/pass.js): an outreach story of the Ludwig Boltzmann
Institute for Network Medicine, in English and German (a switch, EN | DE, on the
story panel and above the explore tabs; German when the device's language is,
remembered on the device; #pass&lang=de in a link). The globe is the airports
story's own (OpenFlights routes, Natural Earth coastlines) and the cell the cell
map story's own (Human Protein Atlas, UniProt), taken unchanged from those
stories when it is built. The fish are a live simulation, and the outbreak is a
simple model on the real route network, not a forecast (every route counts the
same, an airport stands for its city, no real disease's numbers).

Flock (stories/flock.js): a live simulation, not data. Each bird follows its
seven nearest neighbours (Ballerini et al. 2008) and keeps its distance; the
flock as a whole wheels about in front of you and now and then swoops round you;
a falcon sets off a wave of alarm that passes from neighbour to neighbour. Sky, land and birds are illustrative.

Robot gang (stories/robots.js): a live simulation, not data, and no particular
brand of robot. On a screen the robots live in a model living room and you click
the floor to walk. In a headset they use your own room: every story asks the
headset for the floor, walls and furniture of its room setup (WebXR plane and
mesh detection, an optional feature; the Quest Browser may ask you to allow
it). Without a room setup they get a virtual room round you, and the panel
offers Set up your room. Point at the floor and pull the trigger to spill
crumbs. Speeds and cleaning times are tuned to look right, not measured.

Files: index.html (the app), stories/ (the sixteen stories, and list.js: the list of them),
version.json (the latest release: running copies pick up new and changed stories from it, written by
tools/release.mjs), proteins.html and
spatial.html (forward to the app), manifest.webmanifest, sw.js (offline cache), audio/,
shared.js (shared rooms), sfx.js (sound effects; tools/sfx.html is its sound board), peerjs.min.js (PeerJS, MIT: peer-to-peer rooms), p2p/ (a test page: do devices link
directly? Two laptops on a local network did, 29 October 2026), relay/ (the shared rooms' server), docs/ (the shared rooms' plan and the handover notes), HANDOVER.md (start here when taking the project over),
AGENTS.md and CLAUDE.md (notes for AI coding agents), tools/smoke.mjs (headless test),
tools/collab.mjs (headless test of shared rooms, peer to peer too; node relay/test.mjs tests the relay),
tools/lbi/ (sources of the tour; node tools/lbi/build.mjs writes stories/lbi.js),
tools/nmd/ and ikerdata/ (sources and data of the muscle story; node tools/nmd/build.mjs
writes stories/nmd.js), tools/endo/ (sources of the endotype story; node
tools/endo/build.mjs writes stories/endo.js), tools/pet/ (sources of the PET story; node
tools/pet/build.mjs writes stories/pet.js), tools/micro/ (sources of the microanatomy story; node
tools/micro/build.mjs writes stories/micro.js), tools/ovary/ (sources of the aging ovary story; node
tools/ovary/build.mjs writes stories/ovary.js), tools/qubits/ (sources of the qubits story; node
tools/qubits/build.mjs writes stories/qubits.js), tools/mutation/ (sources of the mutation story;
node tools/mutation/build.mjs writes stories/mutation.js), tools/topo/ (sources of the tissue topology
story; node tools/topo/build.mjs writes stories/topo.js; its data from the authors' files, not in the repository),
tools/soil/ (sources of the soil story; node tools/soil/build.mjs writes stories/soil.js; its data from the
authors' files, not in the repository),
tools/pass/ (sources of the pass story; node
tools/pass/build.mjs writes stories/pass.js from them and from the airports and cell map stories), tools/flock/ (sources of the flock; node tools/flock/build.mjs
writes stories/flock.js), tools/robots/ (sources of the robot gang;
node tools/robots/build.mjs writes stories/robots.js), tools/design/ (sources of the design room; node
tools/design/build.mjs writes stories/design.js), tools/lowpoly/ (the miniatures; node tools/lowpoly/build.mjs writes
lowpoly.js, the miniatures the design room and the stations' icons use), tools/voice/ (a
synthetic narration: node tools/voice/narrate.mjs <story>), tools/release.mjs (writes version.json), tools/live.mjs
(headless test of live updates), tools/icons.html (the stations' icons side by side),
icons/, three.min.js (three.js r128, MIT licence, see three.LICENSE.txt).
