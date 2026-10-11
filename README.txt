Network theory, told with the world's airports - installable web app

Upload the whole folder to any HTTPS web server (GitHub Pages, Netlify,
your university web space ...). Installing and VR both need https://.

Install:
- Meta Quest Browser: open the page, then use the Install button in the
  address bar (or the "Install" button in the page's top bar if shown).
  The app then appears in your Library under "Unknown sources"/apps.
- Chrome / Edge (desktop, Android): Install button in the top bar or the
  install icon in the address bar.
- iPhone/iPad Safari: Share > Add to Home Screen.

Narration: put your recording at audio/narration.mp3 (see the note in the
audio folder for chapter timings). It plays in sync with the story, follows
pause, seeking and chapter jumps, and has a Sound on/off button (top bar and
VR panel). Without the file the story runs silently.

After changing any file (including adding or replacing narration.mp3),
bump VERSION in sw.js so installed copies update.

Files: index.html (the app), manifest.webmanifest, sw.js (offline cache), audio/,
icons/, three.min.js (three.js r128, MIT licence, see three.LICENSE.txt).
