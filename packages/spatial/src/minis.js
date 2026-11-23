// The miniatures of the story package spatial (Cell map): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/spatial/minis.js with
// the kit named below (tools/lowpoly/kit-b.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'spatial.<set>'.
// kit: b
  def('spatial.cell', 'Model cell', 'The model cell cut open to its compartments, each in its own colour: the nucleus and its nucleolus, the ER, the Golgi, mitochondria, vesicles, lysosomes and peroxisomes, a few proteins at their places.', 1148, (M, g, r) => {
    const cy = 1.0;
    M.frame([0, cy, 0]);
    // solid compartments in the cell map's colours, the membrane and the nucleus cut open at the front to show them
    M.add('glass', g.sph(1, 14, 8, CUT[0], CUT[1]), PL.pm, 0, 0, [1, 0.74, 1]);
    M.add('flat', g.sph(0.36, 12, 8, CUT[0], CUT[1]), PL.nuc, [0, -0.02, -0.06]);
    M.add('gloss', g.ball(0.14, 1), PL.nucl, [0.02, 0.02, 0.0]);
    for (let k = 0; k < 3; k++) M.add('flat', g.cyl(0.47 + 0.06 * k, 0.47 + 0.06 * k, 0.07, 10, true, 1.2 + 0.4 * k, 2.4), PL.er, [0, -0.02 + 0.13 * (k - 1), -0.06]);   // ER sheets round the nucleus
    for (let k = 0; k < 4; k++) M.add('gloss', g.tor(0.17 + 0.05 * k, 0.03, 3, 6, 1.3), PL.golgi, [0.54, -0.08, 0.3], [0.2, 0.75, -0.6], [1, 1, 0.5]);
    for (let k = 0; k < 3; k++) { const a = 2.5 + k * 1.2, p = [0.72 * Math.cos(a), (k - 1) * 0.2, 0.72 * Math.sin(a)]; M.add('gloss', g.sph(1, 6, 4), PL.mito, p, [0.4 * k, a, 0.3], [0.15, 0.06, 0.06]); }
    const blob = (n, col, rad, a0) => { for (let k = 0; k < n; k++) { const a = a0 + k * 0.7, b = (k - n / 2) * 0.35, d = 0.62 + 0.1 * (k % 2); M.add('gloss', g.ball(rad), col, [d * Math.cos(a) * Math.cos(b), d * 0.74 * Math.sin(b), d * Math.sin(a) * Math.cos(b)]); } };
    blob(3, PL.lyso, 0.06, 4.2); blob(4, PL.endo, 0.05, 0.2); blob(2, PL.perox, 0.045, 5.6);   // lysosomes, vesicles, peroxisomes
    for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.3, b = (k % 3 - 1) * 0.5, d = [Math.cos(a) * Math.cos(b), 0.74 * Math.sin(b), Math.sin(a) * Math.cos(b)]; M.add('mat', g.rod(d.map(v => v * 0.38), d.map(v => v * 0.97), 0.008), PL.cytosk); }   // the cytoskeleton
    const prot = [[0.6, 0.62, 0.3, PL.pm], [-0.7, 0.4, 0.4, PL.pm], [0.3, 0.45, 0.1, PL.cyto], [-0.35, -0.4, 0.3, PL.cyto], [0.1, 0.38, -0.02, PL.nuc], [-0.2, -0.3, -0.1, PL.nuc],
      [0.45, -0.12, 0.22, PL.er], [0.55, 0.1, 0.42, PL.golgi], [-0.62, 0.05, -0.38, PL.mito], [0.15, -0.55, 0.45, PL.cyto]];
    prot.forEach(([x, y, z, c]) => M.add('glow', g.oct(0.04), c, [x, y, z]));
    for (const [i, j] of [[0, 2], [2, 4], [1, 3], [6, 7]]) M.add('glow', g.rod(prot[i].slice(0, 3), prot[j].slice(0, 3), 0.006, 3), '#e7eef8');
    cellStand(M, g, cy);
  });
