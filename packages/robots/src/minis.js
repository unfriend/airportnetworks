// The miniatures of the story package robots (Robot gang): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/robots/minis.js with
// the kit named below (tools/lowpoly/kit-b.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'robots.<set>'.
// kit: b
  def('robots.robots', 'Robot vacuum gang', 'A model living room cut away like a doll\'s house, six robot vacuums with their coloured LED rings following each other in a conga line.', 864, (M, g) => {
    const F = 0.08;
    const floor = g.plane(2.4, 2.0, 8, 1); floor.rotateX(-PI / 2);
    M.add('mat', floor, w => Math.floor((w.x + 1.2) / 0.3) % 2 ? '#b98a5a' : '#a97c4f', [0, F + 0.001, 0]);
    M.add('mat', g.box(2.4, F, 2.0), '#6e5136', [0, F / 2, 0]);
    M.add('mat', g.box(2.4, 0.95, 0.06), '#efe6d8', [0, F + 0.475, -1.03]);
    M.add('mat', g.box(0.06, 0.95, 2.06), '#e6dccb', [-1.23, F + 0.475, 0]);
    M.add('glow', g.box(0.6, 0.4, 0.02), '#9fc8e8', [0.5, 0.62, -0.995]);   // the window
    M.add('mat', g.box(0.3, 0.22, 0.02), '#d9a441', [-0.5, 0.68, -0.995]);
    M.add('mat', g.box(1.1, 0.01, 0.8), '#3f5d7a', [0.15, F + 0.006, 0.12]);   // the painted rug
    M.add('mat', g.box(0.38, 0.14, 0.9), '#5d7d8a', [-1.0, F + 0.07, -0.05]);  // sofa
    M.add('mat', g.box(0.12, 0.32, 0.9), '#68899a', [-1.14, F + 0.16, -0.05]);
    for (const s of [-1, 1]) M.add('mat', g.box(0.38, 0.22, 0.08), '#5d7d8a', [-1.0, F + 0.11, -0.05 + s * 0.46]);
    M.add('mat', g.box(0.1, 0.12, 0.2), '#d9a441', [-1.05, F + 0.2, -0.25]); M.add('mat', g.box(0.1, 0.12, 0.2), '#c9694a', [-1.05, F + 0.2, 0.15]);
    M.add('mat', g.box(0.42, 0.14, 0.4), '#c98f3e', [0.75, F + 0.07, -0.68]);  // armchair
    M.add('mat', g.box(0.42, 0.32, 0.1), '#d49c4c', [0.75, F + 0.16, -0.88]);
    M.add('mat', g.box(0.52, 0.04, 0.32), '#b98a5a', [0.05, F + 0.24, 0.1]);   // coffee table: robots pass under it
    for (const s of [-1, 1]) M.add('mat', g.box(0.04, 0.22, 0.28), '#8a6440', [0.05 + s * 0.22, F + 0.11, 0.1]);
    M.add('mat', g.box(0.62, 0.42, 0.16), '#e8e2d6', [-0.5, F + 0.21, -0.92]);  // bookcase
    ['#3f5d7a', '#c9694a', '#6f8f6a'].forEach((c, k) => M.add('mat', g.box(0.08, 0.15, 0.1), c, [-0.68 + k * 0.1, F + 0.5, -0.92]));
    M.add('mat', g.cyl(0.07, 0.055, 0.14, 6), '#b8613e', [1.05, F + 0.07, -0.85]); M.add('mat', g.ball(0.13), '#4f8f4a', [1.05, F + 0.25, -0.85]);   // plant
    M.add('gloss', g.box(0.32, 0.06, 0.1), '#2b2f36', [0.05, F + 0.03, -0.95]); M.add('glow', g.box(0.2, 0.012, 0.02), '#46d9ff', [0.05, F + 0.06, -0.89]);   // dock
    const GANG = ['#46d9ff', '#ff5ad9', '#ffb43b', '#3ee08f', '#ff5a4b', '#9d7bff'];
    GANG.forEach((c, i) => {   // a conga line across the rug, each following the one ahead
      const a = 3.6 + i * 0.42, x = 0.2 + 0.62 * Math.cos(a), z = 0.15 - 0.55 * Math.sin(a);
      M.frame([x, F, z], [0, Math.atan2(-0.55 * Math.cos(a), 0.62 * Math.sin(a)), 0]);   // heading along the line
      M.add('gloss', g.cyl(0.12, 0.12, 0.05, 10), '#2b2f36', [0, 0.025, 0]);
      M.add('glow', g.cyl(0.123, 0.123, 0.012, 10, true), c, [0, 0.045, 0]);
      M.add('mat', g.cyl(0.126, 0.126, 0.03, 8, true, 0, PI), '#8a96a3', [0, 0.02, 0], [0, -PI / 2, 0]);   // bumper round the front
      M.add('glow', g.box(0.025, 0.018, 0.07), '#e7f6ff', [0.07, 0.055, 0]);   // the eyes' visor
      M.frame();
    });
  });
