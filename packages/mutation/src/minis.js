// The miniatures of the story package mutation (The mutation machine): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/mutation/minis.js with
// the kit named below (tools/lowpoly/kit-b.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'mutation.<set>'.
// kit: b
  def('mutation.letters', 'DNA helix and letters', 'A double helix with rungs in the four letters\' colours, the ancestor\'s eight letter tiles, and a letter opened into its two qubits.', 1036, (M, g) => {
    const R = 0.28, cy = 0.62, turn = 2 * PI / 10.5, n = 16, off = 140 / 180 * PI;   // B-DNA: 10.5 pairs a turn, grooves
    const at = (x, a) => [x, cy + R * Math.cos(a), R * Math.sin(a)];
    const s1 = [], s2 = [];
    for (let i = 0; i <= 24; i++) { const u = i / 24, x = -1 + 2 * u, a = u * n * turn; s1.push(at(x, a)); s2.push(at(x, a + off)); }
    M.add('gloss', g.tube(s1, 0.035, 28, 4), '#9fb6d6'); M.add('gloss', g.tube(s2, 0.035, 28, 4), '#9fb6d6');
    const top = 'GTCAACGTTAGCATGC', pair = { A: 'T', T: 'A', C: 'G', G: 'C' };   // the ancestor ACGTTAGC in the middle
    for (let k = 0; k < n; k++) {
      const x = -1 + 2 * (k + 0.5) / n, a = (k + 0.5) / n * n * turn, p = at(x, a), q = at(x, a + off), m = lerp(p, q, 0.5);
      M.add('glow', g.rod(p, m, 0.022, 4), LET[top[k]]); M.add('glow', g.rod(m, q, 0.022, 4), LET[pair[top[k]]]);
    }
    'ACGTTAGC'.split('').forEach((c, i) => M.add('gloss', g.box(0.18, 0.18, 0.05), LET[c], [-0.77 + i * 0.22, 0.14, 0.66]));
    for (const [x, up] of [[-0.86, 1], [-0.62, -1]]) {   // the first letter's two qubits: arrow up for 0, down for 1
      M.add('glass', g.sph(0.1, 8, 6), '#8cc6ff', [x, 0.42, 0.66]);
      M.add('glow', g.rod([x, 0.42 - up * 0.06, 0.66], [x, 0.42 + up * 0.04, 0.66], 0.012, 4), '#46d9ff');
      M.add('glow', g.cone(0.028, 0.05, 4), '#46d9ff', [x, 0.42 + up * 0.065, 0.66], [up > 0 ? 0 : PI, 0, 0]);
    }
    M.add('gloss', g.box(2.3, 0.05, 1.0), NAVY, [0, 0.025, 0.28]);
    for (const x of [-1.08, 1.08]) M.add('gloss', g.rod([x, 0.05, 0], [x, cy, 0], 0.022, 6), NAVY);
  });

  def('mutation.tree', 'Family tree in 3D', 'The family tree grown up out of its root in all directions: glass branches with a machine gear on each first branch and the tips\' new sequences.', 1064, (M, g, r) => {
    const root = [0, 0.1, 0], nodes = [], pos = (az, rad, y) => [rad * Math.sin(az), y, rad * Math.cos(az)];
    const branch = (P, Q, rad, letter) => {
      const mid = [P[0] + (Q[0] - P[0]) * 0.3, P[1] + (Q[1] - P[1]) * 0.7, P[2] + (Q[2] - P[2]) * 0.3];   // up first, then out
      const c = g.curve([P, mid, Q]);
      M.add('glow', g.tube(c, rad, 5, 4), '#6cb4ee');
      if (letter) { const a = c.getPoint(0.5), b = c.getPoint(0.6); M.add('glow', g.rod([a.x, a.y, a.z], [b.x, b.y, b.z], rad + 0.012, 6), LET[letter]); }
      return c;
    };
    const L1 = [0.33, 0.33 + PI].map((az, i) => pos(az, 0.22, 0.48 + 0.1 * i));
    L1.forEach((q, i) => {
      const c = branch(root, q, 0.05, i ? 'G' : null), p = c.getPoint(0.55);
      M.add('glow', g.gear(0.1, 8, 0.03), '#0072b2', [p.x, p.y - 0.015, p.z]);   // one machine per branch
      [-0.78, 0.78].forEach((d, j) => {
        const az = [0.33, 0.33 + PI][i] + d, q2 = pos(az, 0.52, q[1] + 0.3 + 0.15 * r());
        branch(q, q2, 0.035, (i + j) % 3 === 1 ? 'T' : null);
        [-0.39, 0.39].forEach((d2, k) => {
          const a3 = az + d2, tip = pos(a3, 0.8, q2[1] + 0.25 + 0.32 * r());
          branch(q2, tip, 0.024, (i + j + k) % 4 === 0 ? 'C' : null);
          nodes.push([tip, a3]);
        });
      });
    });
    const seqs = ['ACGT', 'ACGC', 'GCGT', 'ACAT', 'TCGT', 'ACGG', 'ATGT', 'CCGT'];
    nodes.forEach(([p, az], i) => M.add('flat', g.plane(0.24, 0.065, 4, 1), w => { const u = (w.x - p[0]) * Math.cos(az) - (w.z - p[2]) * Math.sin(az); return LET[seqs[i][Math.max(0, Math.min(3, Math.floor((u + 0.12) / 0.06)))]]; }, [p[0], p[1] + 0.07, p[2]], [0, az, 0]));
    'ACGTTAGC'.split('').forEach((c, i) => { const a = -1.2 + i * 0.34; M.add('gloss', g.box(0.07, 0.07, 0.02), LET[c], [0.27 * Math.sin(a), 0.1, 0.27 * Math.cos(a)], [0, a, 0]); });
    plinth(M, 0.4, 0.05);
  });

  def('mutation.rule', 'Pyramid of mixes', 'The four letters at the corners of a glass pyramid, the mix gliding along its green path to the long-run mix, on the compiler drum.', 952, (M, g) => {
    const lift = 0.62, C = [[0, 0.98, 0], [-0.8, -0.327, 0.462], [0, -0.327, -0.924], [0.8, -0.327, 0.462]].map(p => [p[0], p[1] + lift, p[2]]);   // MMATH.CORNERS: A, C, G, T
    const L = 'ACGT', cen = lerp(lerp(C[0], C[1], 0.5), lerp(C[2], C[3], 0.5), 0.5);
    [0.17, 0.15, 0.16, 0.14].forEach((rad, i) => M.add('gloss', g.ball(rad, 1), LET[L[i]], C[i]));   // as big as each letter's long-run share
    for (const [a, b, c] of [[0, 1, 3], [0, 3, 2], [0, 2, 1], [1, 2, 3]]) M.add('glass', g.tri(C[a], C[b], C[c]), '#8cc6ff');
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) M.add('glow', g.rod(C[a], C[b], 0.018, 6), '#4fb0ff');
    const P = [lerp(C[1], cen, 0.15), lerp(lerp(C[1], C[0], 0.3), cen, 0.45), lerp(cen, C[0], 0.2), add3(cen, [0.06, -0.05, 0.04])];
    M.add('glow', g.tube(P, 0.016, 12), '#3fd6a6');   // the path, a bright green trail
    for (const p of [P[1], P[2]]) M.add('glow', g.tor(0.05, 0.008, 3, 8), '#f2f6ff', p);
    M.add('glow', g.tor(0.07, 0.008, 3, 10), '#46d9ff', P[3]);   // the long-run mix
    const mix = lerp(P[2], P[3], 0.4);
    M.add('glow', g.ball(0.04), '#f2f6ff', mix);
    for (let i = 0; i < 4; i++) { M.add('glow', g.tor(0.075, 0.012, 3, 3, PI / 2), LET[L[i]], mix, [0, 0, i * PI / 2]); M.add('glow', g.rod(mix, C[i], 0.004, 3), '#c6d4ea'); }
    M.add('gloss', g.cyl(0.85, 0.9, 0.2, 14), '#123563', [0, 0.1, 0]);   // the compiler's drum with its gear
    M.add('glow', g.gear(0.6, 10, 0.04), '#0072b2', [0, 0.2, 0]);
  });

  def('mutation.stem', 'RNA stem', 'An RNA strand folded back into a stem of six pairs and a loop, white rungs, and the coupling gear over the pair that changes together.', 748, (M, g) => {
    const R = 0.24, seq = 'GTTACTGAAAAGTAGT', tiles = [];
    const at = (k, side) => { const a = k * 2 * PI / 11 + side * PI; return [R * Math.cos(a), 0.22 + k * 0.2, R * Math.sin(a)]; };
    for (let k = 0; k < 6; k++) tiles.push(at(k, 0));
    const t5 = at(5, 0), b5 = at(5, 1), up = 1.38;
    tiles.push(lerp(t5, [0, up, 0], 0.55), [t5[0] * 0.5, up + 0.1, t5[2] * 0.5 + 0.12], [b5[0] * 0.5, up + 0.1, b5[2] * 0.5 + 0.12], lerp(b5, [0, up, 0], 0.55));   // the loop
    for (let k = 5; k >= 0; k--) tiles.push(at(k, 1));
    M.add('gloss', g.tube(tiles, 0.028, 40, 4), '#9fb6d6');
    tiles.forEach((p, i) => M.add('gloss', g.box(0.12, 0.12, 0.04), LET[seq[i]], [p[0] * 1.1, p[1], p[2] * 1.1], [0, Math.atan2(p[0], p[2]), 0]));
    for (let k = 0; k < 6; k++) M.add('glow', g.rod(at(k, 0), at(k, 1), 0.016, 4), '#f2f6ff');
    const c4 = lerp(at(4, 0), at(4, 1), 0.5);   // the pair that changes together: the coupling gear and its double band
    M.add('glow', g.gear(0.11, 8, 0.03), '#0072b2', [c4[0], c4[1] + 0.07, c4[2]]);
    for (const s of [-1, 1]) M.add('glow', g.rod(add3(at(4, 0), [0, s * 0.03, 0]), add3(at(4, 1), [0, s * 0.03, 0]), 0.008, 4), '#3fd6a6');
    plinth(M, 0.36, 0.05);
  });
