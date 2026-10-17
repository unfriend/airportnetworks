Networks, in seven stories - installable web app
  1. Network theory, told with the world's airports  (stories/airports.js)
  2. Network medicine, told with the proteins in a cell  (stories/proteins.js)
  3. Spatial interactome, where proteins meet in a cell  (stories/spatial.js)
  4. A glimpse into the future of network medicine: a 3D tour of the Ludwig
     Boltzmann Institute for Network Medicine  (stories/lbi.js)
  5. Muscle and heart: rare diseases of nerves and muscles in a 71-layer
     network, after Iker Núñez-Carpintero and Philipp Friedrich  (stories/nmd.js)
  6. Flock: 200 starlings at dusk flying all around you, each following its
     seven nearest neighbours  (stories/flock.js)
  7. Robot gang: robot vacuums in your room that bump and turn, follow you
     about or form a conga line; in a headset they find your floor and walls
     (stories/robots.js)

index.html is the app: it shows a start screen to pick a story, and the Stories
button (top bar, and the panel in VR/AR) brings it back. Stories are loaded into
the same page, so changing story never ends a VR or AR session; entering VR or
AR from the start screen opens a Stories screen in the headset (one panel per
story); entering from inside a story resumes it where you were.
The start screen is the landing page (no hash, or #stories). The address
follows you: #stories on the Stories screen (page or headset), #airports,
#proteins, #spatial, #lbi, #nmd, #flock or #robots in a story, so links can be shared and open that story
directly (proteins.html and spatial.html forward there). Taking the headset off and on returns to the Stories menu
(and, unless Anchor is on, places everything in front of the next wearer).
Repeat all and Repeat one on the Stories screen (page and headset) keep the app
playing for an exhibition: Repeat all plays the stories one after another
without end, Repeat one plays the story you pick again and again. Press the lit
button to turn it off. It is remembered on the device; a link ending in
#airports&repeat=all (or repeat=one) sets it.
Anchor (headset Stories screen) keeps the network and the panels at one spot
in the real room, for every story: through taking the headset off and on (the
next wearer still starts on the Stories menu), recentring, leaving VR and
reloading. While anchored the grip moves nothing; Place again puts everything
in front of you and anchors it there. To arrange things first, leave Anchor off,
move them with the grip, then press Anchor. It uses the Quest Browser's room
anchors (not in private browsing; clearing the site's data forgets the place);
without them the place holds until you leave VR. #anchor=on (or #anchor=off) in
a link sets it.
Shared rooms (Shared button, top bar and Stories screen; in a headset a small
Shared panel beside the story panel): several headsets and screens join one
room and see the same stations, a story each at a spot in the room, in step on
every device (anyone can play, pause, jump or change a control; the last action
wins). A headset runs the station it stands at; the others show as rings on the
floor with a card, and pointing at one and pulling the trigger goes there too.
People in the room calibrate every headset on the same two tape marks
(Calibrate: touch mark A, then mark B, with the ring at the front of a
controller; orange crosses then show where the headset puts the marks, and two
anchors keep the calibration for next time). A headset's own calibration is
never overridden, and the room's floor comes from the marks, so a headset
with a wrong floor still shows things at the same height. Quest Browser's
experimental shared space is only used when asked for on the Shared panel (it
was too far out in our test). The relay keeps the headsets' logs in
relay/logs/ for checking alignment. People elsewhere and
screens
see the stations round their own spot. Screens get a room map and Follow a
station. The flock's birds and the robots move separately on each device; their
controls, falcons and crumbs are shared. Rooms need the relay (relay/, Node, no
packages), which GitHub Pages cannot run: for now it runs on a machine on the
same Wi-Fi as the headsets and serves the app itself (node relay/server.mjs --lan
prints the https:// address to open on each headset; see relay/README.md).
GitHub Pages serves everything else; a copy there can join a relay elsewhere
with &relay=wss://... in the room link. #s=XYZ in a link joins room XYZ.
Nothing changes for anyone not in a room. Not yet tried on headsets.

Upload the whole folder to any HTTPS web server (GitHub Pages, Netlify,
your university web space ...). Installing and VR both need https://.

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
audio/narration-flock.mp3 and audio/narration-robots.mp3; see the note in the audio folder for chapter timings. It plays in
sync with the story, follows pause, seeking and chapter jumps, and has a Sound
on/off button (top bar and VR panel). Browsers only start sound after a tap or
click: the first one in the app (Enter VR counts) turns sound on for every
story, also when you change story inside the headset. If the button says Play
sound, press it. Without the file the story runs silently.
No sound? Open Sound check on the Stories screen (on the page, or in the headset
under the title): it shows what the sound system is doing, plays a test beep
through each of the app's two ways to play sound (Web Audio and an audio
element) and lets you choose the one you hear. Reset clears the saved choices.
A link ending in #soundcheck opens it.

After changing any file (including adding or replacing a narration file),
bump VERSION in sw.js so installed copies update. Online, the app always fetches
its files fresh (the cache is for offline use); a copy that is open while an
update arrives reloads itself the next time you are on the Stories screen.

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

Files: index.html (the app), stories/ (the seven stories), proteins.html and
spatial.html (forward to the app), manifest.webmanifest, sw.js (offline cache), audio/,
shared.js (shared rooms), relay/ (the shared rooms' server), docs/ (the shared rooms' plan),
AGENTS.md and CLAUDE.md (notes for AI coding agents), tools/smoke.mjs (headless test),
tools/collab.mjs (headless test of shared rooms; node relay/test.mjs tests the relay),
tools/lbi/ (sources of the tour; node tools/lbi/build.mjs writes stories/lbi.js),
tools/nmd/ and ikerdata/ (sources and data of the muscle story; node tools/nmd/build.mjs
writes stories/nmd.js), tools/flock/ (sources of the flock; node tools/flock/build.mjs
writes stories/flock.js), tools/robots/ (sources of the robot gang;
node tools/robots/build.mjs writes stories/robots.js),
icons/, three.min.js (three.js r128, MIT licence, see three.LICENSE.txt).
