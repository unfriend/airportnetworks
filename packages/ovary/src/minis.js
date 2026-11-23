// The miniatures of the story package ovary (The aging ovary): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/ovary/minis.js with
// the kit named below (tools/lowpoly/kit-b.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'ovary.<set>'.
// kit: b
  def('ovary.organ', 'Cut-away ovary', 'An ovary cut open on its hilum: cortex round the medulla, follicles, a golden corpus luteum, pale scars and coiled vessels.', 1070, (M, g) => {
    const ax = 0.95, ay = 0.55, az = 0.45, cy = 0.8, COR = '#b98ab0', MED = '#e2a3a6';
    M.add('mat', g.sph(1, 14, 8, PI, PI), M.jit('#d9adb2', 0.06), [0, cy, 0], 0, [ax, ay, az]);           // the back, intact
    M.add('mat', g.sph(1, 7, 8, 0, PI / 2), M.jit('#d9adb2', 0.06), [0, cy, 0], 0, [ax, ay, az]);         // the front left
    M.add('flat', g.disc(1, 12, -PI / 2, PI), COR, [0, cy, 0.002], 0, [ax, ay, 1]);                        // cut face: cortex
    M.add('flat', g.disc(1, 12, -PI / 2, PI), MED, [0.02, cy - 0.04, 0.005], 0, [ax * 0.68, ay * 0.6, 1]);  // and medulla
    M.add('flat', g.disc(1, 8, PI / 2, PI), COR, [0.002, cy, 0], [0, PI / 2, 0], [az, ay, 1]);             // the side wall
    M.add('flat', g.disc(1, 8, PI / 2, PI), MED, [0.005, cy - 0.04, 0], [0, PI / 2, 0], [az * 0.6, ay * 0.6, 1]);
    for (const [x, y, rr] of [[0.55, 0.2, 0.13], [0.8, 0.03, 0.085], [0.32, -0.3, 0.09], [0.22, 0.35, 0.07]]) {   // antral follicles
      M.add('gloss', g.disc(rr, 10), '#c4ccff', [x, cy + y, 0.008]);
      M.add('mat', g.tor(rr, 0.022, 3, 8), '#8e66b8', [x, cy + y, 0.01]);
      M.add('gloss', g.ball(rr * 0.3), '#f4b3cb', [x + rr * 0.45, cy + y - rr * 0.35, 0.03]);
    }
    for (const t of [-1.35, -0.6, 0.95, 1.4]) M.add('mat', g.ball(0.035), '#8e66b8', [0.86 * ax * Math.cos(t), cy + 0.86 * ay * Math.sin(t), 0.005]);
    M.add('gloss', g.ball(1, 1), M.jit('#f0b545', 0.14), [0.62, cy - 0.3, 0.02], 0, [0.13, 0.11, 0.06]);    // corpus luteum
    M.add('mat', g.ball(1), M.jit('#d8bccb', 0.06), [0.12, cy - 0.42, 0.01], 0, [0.08, 0.06, 0.03]);       // corpora albicantia
    M.add('mat', g.ball(1), M.jit('#d8bccb', 0.06), [0.42, cy + 0.4, 0.01], 0, [0.07, 0.05, 0.03]);
    const z = 0.022;
    M.add('gloss', g.tube([[0.12, cy - 0.64, z], [0.14, cy - 0.4, z], [0.08, cy - 0.15, z], [0.22, cy + 0.05, z], [0.42, cy + 0.03, z]], 0.018, 10), '#c0353f');
    M.add('gloss', g.tube([[0.13, cy - 0.33, z], [0.3, cy - 0.2, z], [0.48, cy - 0.12, z]], 0.014, 6), '#c0353f');
    M.add('gloss', g.tube([[0.04, cy - 0.64, z], [0.03, cy - 0.3, z], [0.06, cy, z], [0.12, cy + 0.22, z]], 0.016, 8), '#59649e');
    M.add('mat', g.cyl(0.09, 0.14, 0.3, 8), '#c46a6e', [0.08, 0.17, 0]);   // the hilum
    plinth(M, 0.34, 0.04);
  });

  def('ovary.section', 'Ovary section', 'A drawn H&E section in relief: eosin-pink stroma with follicles, vessels, macrophages, corpora albicantia and a cyst.', 1016, (M, g, r) => {
    const out = [], inn = [];
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * 2 * PI, k = 1 + 0.06 * Math.sin(3 * a + 0.4) + 0.04 * Math.cos(5 * a);
      out.push([0.95 * k * Math.cos(a), 0.75 * k * Math.sin(a)]); inn.push([0.05 + 0.55 * k * Math.cos(a), -0.05 + 0.42 * k * Math.sin(a)]);
    }
    M.frame([0, 0.8, 0], [-0.25, 0, 0]);   // leaning back on its stand
    M.add('mat', g.ext(out, 0.04), M.jit('#e88bb0', 0.07));                // cortex, denser at the rim
    M.add('mat', g.ext(inn, 0.046), M.jit('#f3b9cf', 0.05));               // medulla, paler
    const F = 0.05;
    for (const [x, y, rr] of [[-0.5, 0.3, 0.15], [0.4, 0.38, 0.11], [-0.1, -0.5, 0.09]]) {   // antral follicles
      M.add('gloss', g.disc(rr, 10), '#f7e6ef', [x, y, F]);
      M.add('mat', g.tor(rr, 0.028, 3, 10), M.jit('#8e66b8', 0.08), [x, y, F]);
      M.add('gloss', g.ball(rr * 0.28), '#f4b3cb', [x + rr * 0.42, y - rr * 0.3, F + 0.02]);
    }
    for (const [x, y] of [[0.68, -0.05], [-0.76, -0.2], [0.05, 0.52]]) {   // secondary follicles
      M.add('mat', g.ball(0.06), M.jit('#8e66b8', 0.08), [x, y, F], 0, [1, 1, 0.55]);
      M.add('gloss', g.ball(0.022), '#fbe8f1', [x, y, F + 0.035]);
    }
    for (const [x, y] of [[0, 0], [0.45, -0.42], [-0.42, -0.22], [0.25, -0.08]]) {   // blood vessels: a wall round a pale lumen
      M.add('mat', g.tor(0.045, 0.017, 3, 8), '#c0353f', [x, y, F], 0, [1.35, 1, 1]);
      M.add('gloss', g.disc(0.04, 6), '#fbf4f7', [x, y, F - 0.002], 0, [1.3, 0.95, 1]);
    }
    for (const [x, y, s] of [[0.15, 0.25, 0.13], [0.62, -0.25, 0.11]]) M.add('mat', g.ball(1), M.jit('#d6b3d6', 0.08), [x, y, F], [0, 0, r() * 3], [s, s * 0.75, 0.035]);
    M.add('gloss', g.disc(0.09, 10), '#fbf4f7', [-0.64, 0.02, F]);   // a cyst
    M.add('mat', g.tor(0.09, 0.01, 3, 10), '#f0d9a8', [-0.64, 0.02, F]);
    for (const [x, y] of [[-0.25, 0.1], [0.2, -0.28], [0.75, 0.3], [-0.35, -0.45], [-0.05, 0.36], [0.55, 0.12]]) M.add('gloss', g.ball(0.026), '#8a5a3e', [x, y, F]);
    M.frame();
    M.add('gloss', g.box(1.5, 0.08, 0.36), NAVY, [0, 0.04, 0]);
  });

  def('ovary.charts', 'Donors histogram', 'The donors\' glass slides stacked into the age histogram, 20 bars from 21 to 70, in front of its backdrop.', 1080, (M, g) => {
    const counts = [9, 6, 10, 5, 7, 6, 3, 5, 13, 10, 9, 25, 15, 25, 15, 14, 12, 21, 25, 20];   // OVARY_DATA.hist
    const slide = (w, nn) => nn.y > 0.5 ? '#efcfe0' : '#e3ebf7';   // the tissue shows from above, the glass from the side
    counts.forEach((c, i) => { for (let k = 0; k < Math.max(1, Math.round(c / 3)); k++) M.add('gloss', g.box(0.082, 0.045, 0.16), slide, [-0.95 + i * 0.1, 0.0925 + k * 0.062, 0]); });
    M.add('mat', g.box(2.08, 0.75, 0.03), '#141c2c', [0, 0.445, -0.14]);
    for (let k = 0; k < 4; k++) M.add('glow', g.box(2.0, 0.008, 0.01), '#34405a', [0, 0.22 + k * 0.15, -0.12]);
    M.add('gloss', g.box(2.12, 0.07, 0.38), NAVY, [0, 0.035, -0.02]);
  });
