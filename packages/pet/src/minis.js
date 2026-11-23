// The miniatures of the story package pet (One scan, one system): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/pet/minis.js with
// the kit named below (tools/lowpoly/kit-a.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'pet.<set>'.
// kit: a
  add('pet.scan', 'PET/CT scanner', 'A glossy white scanner with its ring-shaped gantry, the blue band round the bore and the couch that slides the patient in.', b => {
    const W = 0.29, B = 0.06, TOP = 0.66, BC = 0.36, sh = [[-W + 0.05, B]];
    // the gantry's outline: lines cut so the bore's ring of points stays round, and quadratic corners and dome
    const L = (x, y, n) => { const [x0, y0] = sh[sh.length - 1]; for (let i = 1; i <= n; i++) sh.push([lerp(x0, x, i / n), lerp(y0, y, i / n)]); };
    const Q = (cx, cy, x, y, n) => { const [x0, y0] = sh[sh.length - 1]; for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; sh.push([u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y]); } };
    L(W - 0.05, B, 4); Q(W, B, W, B + 0.05, 2); L(W, TOP - 0.17, 4); Q(W, TOP, 0, TOP, 5); Q(-W, TOP, -W, TOP - 0.17, 5); L(-W, B + 0.05, 4); Q(-W, B, -W + 0.05, B, 2); sh.pop();
    b.add('shiny', at(extrude(sh, 0.36, { bt: 0.02, bs: 0.018, k: 1, c: [0, BC], hole: 0.15 }), [0, 0, -0.2]), '#eef1f5');
    b.add('solid', cyl(0.131, 0.131, 0.4, 16, [0, BC, -0.02], [Math.PI / 2, 0, 0], true), '#c3cedb');   // bore lining (the bevel narrows the hole)
    b.add('shiny', tor(0.178, 0.03, 4, 20, [0, BC, 0.18]), '#4e7fc4');                                   // the satin blue band
    for (const s of [-1, 1]) b.add('shiny', sph(0.06, 6, 4, [0.205 * s, BC, 0.185], [0.5, 1, 0.35]), '#5c86c0');
    for (const x of [-0.05, 0, 0.05]) b.add('glow', box(0.022, 0.01, 0.006, [x, 0.6, 0.183]), '#ffb43b');  // status lights
    b.add('solid', box(0.5, 0.06, 0.38, [0, 0.03, -0.02]), '#a9b2bc');                                   // plinth
    b.add('shiny', box(0.17, 0.035, 0.78, [0, 0.29, 0.27]), '#f2f4f6');                                  // the couch
    b.add('solid', box(0.15, 0.014, 0.7, [0, 0.314, 0.28]), '#d5dde8');
    b.add('soft', box(0.004, 0.014, 0.74, [0.087, 0.29, 0.27]), '#2f6fd8');
    b.add('soft', box(0.004, 0.014, 0.74, [-0.087, 0.29, 0.27]), '#2f6fd8');
    b.add('shiny', box(0.12, 0.03, 0.4, [0, 0.258, 0.44]), '#e8ebef');
    b.add('shiny', cyl(0.05, 0.1, 0.2, 4, [0, 0.145, 0.46], [0, Math.PI / 4, 0]), '#eef1f5');
    b.add('shiny', box(0.24, 0.03, 0.3, [0, 0.015, 0.46]), '#dde2e8');
  });

  add('pet.organs', 'Organ network', 'The body\'s organs as coloured rings linked by how their uptake rises and falls together, across hundreds of scans.', b => {
    plinth(b, 0.3);
    const F = [0, 0.04, 0], fb = { add: (k, g, c) => b.add(k, at(g, F), c) };
    figure(fb, 'glass', '#8fb1d8', 5);
    const O = { brain: [0, 0.97, '#a78bfa'], thyroid: [0.17, 0.86, '#22d3ee'], lungs: [-0.2, 0.76, '#60a5fa'], heart: [0.14, 0.7, '#f43f5e'], liver: [-0.25, 0.6, '#f97316'],
      spleen: [0.26, 0.6, '#d946ef'], kidneys: [-0.2, 0.47, '#fb7185'], intestine: [-0.04, 0.4, '#f9a8d4'], muscle: [0.18, 0.36, '#4ade80'] };
    const P = {};
    for (const k in O) {
      const [x, y, c] = O[k], p = add3(F, [x, y, 0.12]); P[k] = p;
      b.add('glow', tor(0.036, 0.0065, 3, 10, p), c);
      b.add('solid', disc(0.033, 10, p), '#0a1222');
    }
    const POS = [['liver', 'spleen'], ['heart', 'lungs'], ['lungs', 'liver'], ['intestine', 'muscle'], ['brain', 'thyroid'], ['heart', 'spleen'], ['kidneys', 'intestine'], ['lungs', 'brain'], ['liver', 'kidneys'], ['thyroid', 'heart']];
    const NEG = [['liver', 'heart'], ['kidneys', 'muscle'], ['brain', 'spleen']];
    const link = (a, c, colour) => { const d = norm3(add3(P[c], mul3(P[a], -1))), e = 0.038; b.add('soft', rod(add3(P[a], mul3(d, e)), add3(P[c], mul3(d, -e)), 0.0045, 0.0045, 3), colour); };
    POS.forEach(([a, c]) => link(a, c, '#4d8cff')); NEG.forEach(([a, c]) => link(a, c, '#ff5a4b'));
  });

  add('pet.liver', 'Liver network', 'A glass liver filled with small patches in hot-iron colours, linked where one takes up more sugar than its neighbour.', b => {
    const r = rng(8), OUT = [[-0.42, 0.04], [-0.4, 0.18], [-0.3, 0.28], [-0.12, 0.32], [0.08, 0.3], [0.25, 0.24], [0.38, 0.16], [0.45, 0.1], [0.3, 0.07], [0.12, 0.03], [0.02, -0.01], [-0.1, -0.04], [-0.14, -0.08], [-0.27, -0.11], [-0.38, -0.08]];
    const Y0 = 0.22, D = 0.2;
    plinth(b, 0.3);
    b.add('glass', at(extrude(OUT, D, { bt: 0.05, bs: 0.045, k: 2, c: [-0.1, 0.12] }), [0, Y0, -D / 2]), '#f97316');
    const inside = (x, y) => { let c = false; for (let i = 0, j = OUT.length - 1; i < OUT.length; j = i++) { const [xi, yi] = OUT[i], [xj, yj] = OUT[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    const P = [], V = [];
    while (P.length < 46) {
      const x = -0.42 + 0.86 * r(), y = -0.1 + 0.42 * r(), z = (r() - 0.5) * (D + 0.04);
      if (!inside(x, y) || !inside(x + 0.04, y) || !inside(x - 0.04, y) || !inside(x, y + 0.04) || !inside(x, y - 0.04)) continue;
      const v = 0.45 + 0.18 * Math.sin(5 * x + 2) * Math.cos(6 * y) + (x < -0.2 && y > 0.12 ? 0.22 : 0) + 0.12 * r();
      P.push([x, Y0 + y, z]); V.push(v);
      b.add('glow', octa(0.019, [x, Y0 + y, z]), ramp(IRON, Math.min(1, v)));
    }
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++)
      if (dist(P[i], P[j]) < 0.115 && Math.abs(V[i] - V[j]) > 0.06) b.add('soft', rod(P[i], P[j], 0.0042, 0.0042, 3), V[i] > V[j] ? '#ffc27a' : '#ff9a5a');
    b.add('soft', sph(0.04, 6, 4, [-0.13, Y0 - 0.07, D / 2 + 0.02], [0.8, 1.2, 0.8]), '#6c9a46');   // gallbladder
  });

  // triangles of each build, measured (the build and the harness list any that no longer match)
  tris({ 'pet.scan': 816, 'pet.organs': 1142, 'pet.liver': 980 });
