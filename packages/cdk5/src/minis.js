// The miniatures of the story package cdk5 (The switch that sticks): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/cdk5/minis.js with
// the kit named below (tools/lowpoly/kit-b.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'cdk5.<set>'.
// kit: b
  // the authors' colours: the map's proteins by degree (YlGn, dark green to pale yellow), its links green, CDK5 bright
  // green, NTRK2's pathway cyan, calpain yellow, the Alzheimer's pathway orange, hyperactive CDK5 red
  const YLGN = hexes(['#004529', '#238443', '#78c679', '#d9f0a3', '#ffffe5']);
  def('cdk5.net', 'Map of 16,376 proteins', 'The interactome as a sphere of glowing proteins placed by what they do, coloured by how many partners each has and linked in green where neighbours bind; CDK5 shines bright green on its face, a faint outer shell of proteins with no known process round it, and at its centre a small cyan knot: a pathway pulled into the middle.', 1140, (M, g, r) => {
    plinth(M, 0.3, 0.05);
    const C = [0, 0.55, 0], R = 0.42, dots = [];
    M.add('veil', g.ball(R * 0.97, 1), '#3f9a4a', C);   // the sphere's body, faint
    const onSphere = rad => { const u = 2 * r() - 1, a = r() * 2 * PI, s = Math.sqrt(1 - u * u); return [s * Math.cos(a) * rad, u * rad, s * Math.sin(a) * rad]; };
    for (let i = 0; i < 64; i++) {   // the inner shell: proteins with a GO process, coloured by degree
      const d = onSphere(R * (0.93 + 0.12 * r())), x = Math.pow(r(), 2.2);
      dots.push(d); M.add('glow', g.oct(0.016 + 0.014 * x), ramp(YLGN, 0.15 + 0.85 * x), add3(C, d));
    }
    for (let i = 0; i < 8; i++) M.add('glow', g.oct(0.011), '#505050', add3(C, onSphere(R * 1.18)));   // the outer shell: no known process
    // green links between near neighbours on the shell
    let links = 0;
    for (let i = 0; i < dots.length && links < 26; i++) for (let j = i + 1; j < dots.length && links < 26; j++) {
      const d = Math.hypot(dots[i][0] - dots[j][0], dots[i][1] - dots[j][1], dots[i][2] - dots[j][2]);
      if (d < 0.17) { M.add('glow', g.rod(add3(C, dots[i]), add3(C, dots[j]), 0.004, 3), '#2aff00'); links++; }
    }
    // CDK5 on the sphere's face, glowing, with a ring round it
    const k5 = add3(C, [0.12, 0.08, R * 0.97]);
    M.add('glow', g.ball(0.045, 1), '#2aff00', k5);
    M.add('glow', g.tor(0.07, 0.006, 3, 16), '#9bff7a', k5);
    // the centre: a pathway's knot in cyan with CDK5's link to it
    const knot = [[0, 0, 0], [0.07, 0.03, 0.02], [-0.06, 0.04, -0.03], [0.02, -0.07, 0.04], [-0.04, -0.04, 0.06], [0.05, -0.02, -0.07], [-0.02, 0.08, 0.05]].map(p => add3(C, p));
    knot.forEach((p, i) => M.add('glow', g.oct(i ? 0.022 : 0.03), i ? '#00fff0' : '#2aff00', p));
    [[0, 1], [0, 2], [0, 3], [1, 5], [2, 6], [3, 4], [4, 2], [1, 6]].forEach(([a, b]) => M.add('glow', g.rod(knot[a], knot[b], 0.005, 3), '#00fff0'));
  });
  def('cdk5.core', 'CDK5 at the centre', 'The close-up at the centre of the map: CDK5 as a big ball, green on its working side and red where calpain has made it hyperactive, its activators p35 and p39 beside it in light green, calpain in yellow, and the proteins of the NTRK2 pathway in cyan and of the Alzheimer\'s pathway in orange, linked by glowing tubes.', 768, (M, g, r) => {
    plinth(M, 0.24, 0.05);
    const C = [0, 0.5, 0];
    // CDK5: green turning red (two half balls)
    M.add('glow', g.sph(0.09, 10, 6, 0, PI), '#2aff00', C);
    M.add('glow', g.sph(0.09, 10, 6, PI, PI), '#ff2a1a', C);
    const ball = (p, rad, col) => M.add('gloss', g.ball(rad, 0), col, add3(C, p));
    const tube = (a, b, col) => M.add('glow', g.rod(add3(C, a), add3(C, b), 0.008, 4), col);
    // p35 and p39, and calpain cutting in
    [[-0.17, 0.08, 0.05], [-0.14, -0.1, 0.08]].forEach(p => { ball(p, 0.045, '#9be07a'); tube([0, 0, 0], p, '#2aff00'); });
    ball([0.18, -0.05, 0.1], 0.05, '#ffff00'); tube([0.06, -0.02, 0.04], [0.18, -0.05, 0.1], '#ffff00');
    // NTRK2's pathway above, cyan; the Alzheimer's below, orange
    const ring = (n, y, rad, col, seed) => {
      const P = [];
      for (let i = 0; i < n; i++) { const a = seed + i / n * 2 * PI; P.push([Math.cos(a) * rad, y + (r() - 0.5) * 0.06, Math.sin(a) * rad]); }
      P.forEach((p, i) => { ball(p, 0.032, col); tube(p, P[(i + 1) % n], col); if (i % 2 === 0) tube(p, P[(i + 3) % n], col); });
      tube([0, 0, 0], P[0], col);
      return P;
    };
    ring(7, 0.22, 0.2, '#00fff0', 0.4);
    ring(6, -0.24, 0.19, '#ffa500', 1.3);
  });
