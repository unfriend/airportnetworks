Networks, in four stories - installable web app
  1. Network theory, told with the world's airports  (stories/airports.js)
  2. Network medicine, told with the proteins in a cell  (stories/proteins.js)
  3. Spatial interactome, where proteins meet in a cell  (stories/spatial.js)
  4. A glimpse into the future of network medicine: a 3D tour of the Ludwig
     Boltzmann Institute for Network Medicine  (stories/lbi.js)

index.html is the app: it shows a start screen to pick a story, and the Stories
button (top bar, and the panel in VR/AR) brings it back. Stories are loaded into
the same page, so changing story never ends a VR or AR session; entering VR or
AR from the start screen opens a Stories screen in the headset (one panel per
story); entering from inside a story resumes it where you were.
The start screen is the landing page (no hash, or #stories). The address
follows you: #stories on the Stories screen (page or headset), #airports,
#proteins, #spatial or #lbi in a story, so links can be shared and open that story
directly (proteins.html and spatial.html forward there). Taking the headset off and on returns to the Stories menu.
Repeat all and Repeat one on the Stories screen (page and headset) keep the app
playing for an exhibition: Repeat all plays the stories one after another
without end, Repeat one plays the story you pick again and again. Press the lit
button to turn it off. It is remembered on the device; a link ending in
#airports&repeat=all (or repeat=one) sets it.

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
(cell map) and audio/narration-lbi.mp3 (the tour); see the note in the audio folder for chapter timings. It plays in
sync with the story, follows pause, seeking and chapter jumps, and has a Sound
on/off button (top bar and VR panel). Browsers only start sound after a tap or
click: the first one in the app (Enter VR counts) turns sound on for every
story, also when you change story inside the headset. If the button says Play
sound, press it. Without the file the story runs silently.

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

Files: index.html (the app), stories/ (the four stories), proteins.html and
spatial.html (forward to the app), manifest.webmanifest, sw.js (offline cache), audio/,
AGENTS.md and CLAUDE.md (notes for AI coding agents), tools/smoke.mjs (headless test),
tools/lbi/ (sources of the tour; node tools/lbi/build.mjs writes stories/lbi.js),
icons/, three.min.js (three.js r128, MIT licence, see three.LICENSE.txt).
