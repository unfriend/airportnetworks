// The package's miniatures (tools/packages/SPEC.md, "Miniatures"): its sets in small, at most 1,200 triangles each, for
// its stations' icon in a shared room and the design room's table. Rename yourkey to the package's key (each is
// '<key>.<set>'), name the file and the icon in story.json ("minis": "minis.js", "icon": "<key>.orb"), then
// node tools/lowpoly/build.mjs (it writes packages/<key>/minis.js and counts each one's triangles: the fourth argument of
// def must match) and node tools/packages/scan.mjs. Optional: without it the stations show a plain glowing shape in the
// story's colour. A card for the design room: src/props.json (packages/hello/src/props.json is an example).
// The line below names the kit pasted before this (tools/lowpoly/kit-b.js: def, M.add, the shapes in M.g, plinth ...).
// kit: b
  // the template's set: points in a ball round a lit core, on a dark stand
  def('yourkey.orb', 'Ball of points', 'Points gathered into a ball round a glowing amber core, on a dark stand.', 608,
    (M, g, r) => {
      plinth(M, 0.3, 0.05);
      M.add('glow', g.ball(0.14, 1), '#ffb43b', [0, 0.45, 0]);
      for (let i = 0; i < 60; i++) {
        const z = 2 * r() - 1, a = r() * 2 * PI, s = Math.sqrt(1 - z * z), d = 0.28 + 0.06 * r();
        M.add('glow', g.oct(0.016), r() < 0.5 ? '#46d9ff' : '#ff5ad9', [s * Math.cos(a) * d, 0.45 + z * d, s * Math.sin(a) * d]);
      }
    });
