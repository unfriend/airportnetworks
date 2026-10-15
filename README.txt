Networks, in three stories - installable web app
  1. Network theory, told with the world's airports  (stories/airports.js)
  2. Network medicine, told with the proteins in a cell  (stories/proteins.js)
  3. Spatial interactome, where proteins meet in a cell  (stories/spatial.js)

index.html is the app: it shows a start screen to pick a story, and the Stories
button (top bar, and the panel in VR/AR) brings it back. Stories are loaded into
the same page, so changing story never ends a VR or AR session; entering VR or
AR from the start screen opens a Stories screen in the headset (one panel per
story); entering from inside a story resumes it where you were.
The start screen is the landing page (no hash, or #stories). The address
follows you: #stories on the Stories screen (page or headset), #airports,
#proteins or #spatial in a story, so links can be shared and open that story
directly (proteins.html and spatial.html forward there). Taking the headset off and on returns to the Stories menu.

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
audio/narration-proteins.mp3 (proteins) and audio/narration-spatial.mp3
(cell map); see the note in the audio folder for chapter timings. It plays in
sync with the story, follows pause, seeking and chapter jumps, and has a Sound
on/off button (top bar and VR panel). Without the file the story runs silently.

After changing any file (including adding or replacing a narration file),
bump VERSION in sw.js so installed copies update.

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

Files: index.html (the app), stories/ (the three stories), proteins.html and
spatial.html (forward to the app), manifest.webmanifest, sw.js (offline cache), audio/,
AGENTS.md and CLAUDE.md (notes for AI coding agents), tools/smoke.mjs (headless test),
icons/, three.min.js (three.js r128, MIT licence, see three.LICENSE.txt).
