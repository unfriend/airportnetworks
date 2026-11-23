// CLOOK: the CDK5 story's palette and the colour rules its sets and the engine share (SPEC.md, "Look"). The authors'
// own colours from their notebook (CDK5_BioStory_NEW.ipynb), as the textures hold them: CDK5 bright green while it
// works normally and red once it is hyperactive, the NTRK2 pathway cyan, calpain yellow, the Alzheimer's pathway orange,
// the map's links green and the landscape's orange; the map's proteins coloured by their degree (palettes in CDATA.pal).
// Plain constants and small functions: colours as '#rrggbb' strings and as [r, g, b] in 0..1 (rgb()). Shapes come from
// TLOOK (the tissue topology story's look, unchanged: tubes, rings, balls, boxes, halos, cones, glass).
const CLOOK = (() => {
  const rgb = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const mix = (a, b, t, out) => { const o = out || [0, 0, 0]; for (let j = 0; j < 3; j++) o[j] = a[j] + (b[j] - a[j]) * t; return o; };
  const C = {
    cdk5: '#2aff00',      // CDK5 working normally (the notebook's rgba_green_highlighted, 42 255 0)
    hyper: '#ff2a1a',     // CDK5 hyperactive (the notebook's red, 255 0 0, a touch softer so it glows rather than burns)
    activator: '#9be07a', // p35 and p39 (CDK5R1, CDK5R2): the close-up's own light green (the notebook leaves them in
                          // their degree colour in its scene; its seven-scene project gives them a dark green, 53 112 11)
    p25: '#ffd27a',       // p25, the piece of p35 calpain leaves (words only: no protein of its own in the interactome)
    pathway: '#00fff0',   // Signalling by NTRK2 (0 255 240)
    calpain: '#ffff00',   // calpain, CAPN1 (255 255 0)
    alz: '#ffa500',       // the Alzheimer's pathway (255 165 0)
    linkMap: '#2aff00',   // the map of processes' links (42 255 0, alpha 100)
    linkLand: '#ffa500',  // the landscape's links (255 165 0, alpha 100)
    grey: '#505050',      // proteins without a GO process (the map) or without a disease (the landscape)
    pick: '#46d9ff',      // the app's cyan, for a protein picked in explore and its partners
    partner: '#bfefff',   // CDK5's (or a picked protein's) partners lit across the map
    term: '#ff5ad9',      // a disease term's proteins lit in explore (magenta, apart from every scene colour)
  };
  const RGB = {}; for (const k in C) RGB[k] = rgb(C[k]);
  // label classes the engine knows ('' white, cyn, amb, grn, mag): which one a colour's tag uses
  const CLS = { cdk5: 'grn', hyper: 'mag', activator: 'grn', pathway: 'cyn', calpain: 'amb', alz: 'amb', term: 'mag', pick: 'cyn' };
  return { rgb, mix, C, RGB, CLS };
})();
