// The miniatures of the story package tutorial (Your guide): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/tutorial/minis.js with
// the kit named below (tools/lowpoly/kit-b.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'tutorial.<set>'.
// kit: b
  def('tutorial.guide', 'Tutorial robot', 'The guide: a small armoured robot with a glowing visor and the network badge on its chest.', 696, (M, g) => {
    const PL = '#3a4250', SUIT = '#1c222c', LT = '#e8eef8';
    M.add('gloss', g.cyl(0.42, 0.44, 0.05, 12), NAVY, [0, 0.025, 0]);
    M.add('glow', g.cyl(0.43, 0.43, 0.012, 12, true), '#6f8fb0', [0, 0.05, 0]);   // the floor marker's rim
    for (const s of [-1, 1]) {   // legs, knees, boots and their lights
      M.add('mat', g.box(0.1, 0.06, 0.2), PL, [s * 0.08, 0.08, 0.02]);
      M.add('glow', g.box(0.1, 0.012, 0.012), LT, [s * 0.08, 0.06, 0.125]);
      M.add('mat', g.cyl(0.04, 0.035, 0.24, 6), SUIT, [s * 0.08, 0.23, 0]);
      M.add('mat', g.box(0.075, 0.2, 0.07), PL, [s * 0.08, 0.23, 0.02]);
      M.add('glow', g.box(0.012, 0.16, 0.012), LT, [s * 0.08, 0.23, 0.058]);
      M.add('mat', g.cyl(0.045, 0.04, 0.24, 6), SUIT, [s * 0.08, 0.47, 0]);
      M.add('mat', g.box(0.085, 0.18, 0.08), PL, [s * 0.08, 0.48, 0.015]);
    }
    M.add('mat', g.box(0.24, 0.1, 0.15), PL, [0, 0.62, 0]);   // hips and belt
    M.add('glow', g.box(0.24, 0.012, 0.012), LT, [0, 0.66, 0.08]);
    M.add('mat', g.box(0.3, 0.34, 0.18), PL, [0, 0.84, 0]);   // the chest plate, its collar and V of light
    M.add('glow', g.rod([-0.11, 0.98, 0.095], [0, 0.88, 0.095], 0.007, 3), LT); M.add('glow', g.rod([0.11, 0.98, 0.095], [0, 0.88, 0.095], 0.007, 3), LT);
    const B = [[0, 0.8, 0.1], [0, 0.85, 0.1], [-0.045, 0.775, 0.1], [0.045, 0.775, 0.1]];   // the badge: a hub and three nodes
    B.forEach((p, i) => M.add('glow', g.cyl(i ? 0.014 : 0.019, i ? 0.014 : 0.019, 0.01, 6), LT, p, [PI / 2, 0, 0]));
    for (const i of [1, 2, 3]) M.add('glow', g.rod(B[0], B[i], 0.004, 3), LT);
    for (let k = 0; k < 4; k++) M.add('glow', g.oct(0.016), LT, [0, 0.96 - k * 0.07, -0.1]);   // the spine nodes
    for (const s of [-1, 1]) M.add('mat', g.box(0.1, 0.07, 0.15), PL, [s * 0.2, 0.98, 0]);   // shoulders
    M.add('mat', g.rod([0.2, 0.95, 0], [0.24, 0.72, 0.04], 0.035, 6), SUIT);   // its left arm down
    M.add('mat', g.box(0.07, 0.07, 0.07), PL, [0.245, 0.69, 0.045]);
    M.add('mat', g.rod([-0.2, 0.97, 0], [-0.3, 1.14, 0.05], 0.035, 6), SUIT);   // its right arm raised, as in a wave
    M.add('mat', g.rod([-0.3, 1.14, 0.05], [-0.31, 1.33, 0.08], 0.032, 6), SUIT);
    M.add('glow', g.rod([-0.305, 1.17, 0.085], [-0.31, 1.3, 0.11], 0.008, 3), LT);
    M.add('mat', g.box(0.07, 0.08, 0.07), PL, [-0.31, 1.38, 0.08]);
    M.add('mat', g.cyl(0.05, 0.06, 0.06, 6), SUIT, [0, 1.04, 0]);   // the neck, the helmet, its crest and visor
    M.add('mat', g.box(0.19, 0.2, 0.2), PL, [0, 1.17, 0]);
    M.add('mat', g.box(0.03, 0.05, 0.2), PL, [0, 1.29, 0]);
    M.add('glow', g.box(0.16, 0.035, 0.02), LT, [0, 1.18, 0.105]);
    for (const s of [-1, 1]) M.add('glow', g.cyl(0.03, 0.03, 0.02, 8), LT, [s * 0.1, 1.15, 0], [0, 0, PI / 2]);   // ear pods
  });
