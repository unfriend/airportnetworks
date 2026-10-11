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

After changing any file, bump VERSION in sw.js so installed copies update.

Files: index.html (the app), manifest.webmanifest, sw.js (offline cache),
icons/, three.min.js (three.js r128, MIT licence, see three.LICENSE.txt).
