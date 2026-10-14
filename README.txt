Networks, in two stories - installable web app
  1. Network theory, told with the world's airports  (index.html)
  2. Network medicine, told with the proteins in a cell  (proteins.html)

Opening the app shows a start screen to pick a story; each page also has a
button in the top bar to switch to the other one. index.html#airports skips
the start screen.

Upload the whole folder to any HTTPS web server (GitHub Pages, Netlify,
your university web space ...). Installing and VR both need https://.

Install:
- Meta Quest Browser: open the page, then use the Install button in the
  address bar (or the "Install" button in the page's top bar if shown).
  The app then appears in your Library under "Unknown sources"/apps.
- Chrome / Edge (desktop, Android): Install button in the top bar or the
  install icon in the address bar.
- iPhone/iPad Safari: Share > Add to Home Screen.

Narration: put your recordings at audio/narration.mp3 (airports) and
audio/narration-proteins.mp3 (proteins); see the note in the audio folder
for chapter timings. It plays in sync with the story, follows
pause, seeking and chapter jumps, and has a Sound on/off button (top bar and
VR panel). Without the file the story runs silently.

After changing any file (including adding or replacing a narration file),
bump VERSION in sw.js so installed copies update.

Protein data: an illustrative, hand-curated subnetwork of 254 well-documented
human proteins and 375 interactions (complexes and pathways from the
literature), not the full interactome. Essential genes follow DepMap common
essentials; disease genes are a small textbook set. Statistics were computed
with NetworkX (Louvain modules, betweenness). Good for teaching, not research.

Files: index.html (airport story), proteins.html (protein story), manifest.webmanifest, sw.js (offline cache), audio/,
icons/, three.min.js (three.js r128, MIT licence, see three.LICENSE.txt).
