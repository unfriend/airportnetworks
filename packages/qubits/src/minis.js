// The miniatures of the story package qubits (Three qubits): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/qubits/minis.js with
// the kit named below (tools/lowpoly/kit-b.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'qubits.<set>'.
// kit: b
  def('qubits.pairs', 'City map and chip', 'The gene network as a city map with two amber valleys, two walkers settled in them as a pair, and the three-qubit chip.', 1052, (M, g, r) => {
    const V1 = [-0.5, -0.35], V2 = [0.55, 0.4], Y0 = 0.32;
    const h = (x, z) => Y0 - 0.2 * Math.exp(-((x - V1[0]) ** 2 + (z - V1[1]) ** 2) / 0.09) - 0.2 * Math.exp(-((x - V2[0]) ** 2 + (z - V2[1]) ** 2) / 0.09) + 0.012 * Math.sin(7 * x) * Math.cos(6 * z);
    const ground = g.plane(2, 2, 10, 10); ground.rotateX(-PI / 2);
    const gp = ground.attributes.position; for (let i = 0; i < gp.count; i++) gp.setY(i, h(gp.getX(i), gp.getZ(i))); ground.computeVertexNormals();
    M.add('glow', ground, w => lerp(M.rgb('#1a2238'), M.rgb('#e0b54e'), Math.min(1, Math.max(0, (Y0 - w.y) / 0.17)) ** 1.5));   // valleys glow amber
    for (const [x, z, sx, sz] of [[0, 1.01, 2.04, 0.02], [0, -1.01, 2.04, 0.02], [1.01, 0, 0.02, 2], [-1.01, 0, 0.02, 2]]) M.add('mat', g.box(sx, Y0, sz), '#2a3552', [x, Y0 / 2, z]);
    const N = [];
    for (let i = 0; i < 40; i++) {   // genes: some gathered round the valleys, the rest across the map
      const c = i < 10 ? V1 : i < 20 ? V2 : [(r() - 0.5) * 1.7, (r() - 0.5) * 1.7], s = i < 20 ? 0.3 : 0;
      const x = Math.max(-0.92, Math.min(0.92, c[0] + (r() - 0.5) * 2 * s)), z = Math.max(-0.92, Math.min(0.92, c[1] + (r() - 0.5) * 2 * s));
      N.push([x, h(x, z) + 0.03, z]);
      M.add('glow', g.oct(0.045), '#c9d2ff', N[i]);
    }
    const seen = new Set();
    N.forEach((p, i) => N.map((q, j) => [j, (p[0] - q[0]) ** 2 + (p[2] - q[2]) ** 2]).filter(d => d[0] !== i).sort((a, b) => a[1] - b[1]).slice(0, 2).forEach(([j]) => {
      const k = Math.min(i, j) + ',' + Math.max(i, j); if (seen.has(k) || seen.size >= 32) return; seen.add(k);
      M.add('glow', g.rod(p, N[j], 0.008, 3), '#8a93e8');
    }));
    const W1 = [V1[0], h(V1[0], V1[1]) + 0.07, V1[1]], W2 = [V2[0], h(V2[0], V2[1]) + 0.07, V2[1]];
    M.add('glow', g.ball(0.07), '#ff5ad9', W1); M.add('glow', g.ball(0.07), '#46d9ff', W2);
    M.add('glow', g.tube([W1, [0.02, 0.85, 0.02], W2], 0.014, 14), '#ffb43b');   // the pair
    M.add('mat', g.box(0.5, 0.3, 0.5), '#1e2433', [1.4, 0.15, 0.55]);            // the chip on its block
    for (let k = 0; k < 4; k++) for (const s of [-1, 1]) M.add('gloss', g.box(0.05, 0.02, 0.07), '#d9b45a', [1.24 + k * 0.105, 0.31, 0.55 + s * 0.27]);
    for (let k = 0; k < 3; k++) M.add('glow', g.ball(0.06), '#9a90ff', [1.27 + k * 0.13, 0.37, 0.55]);
  });

  def('qubits.cube', 'Coarse operator cube', 'The coarse operator on a cube: eight neighbourhoods at the corners in their colours, a loop at each, and couplings as purple edges.', 824, (M, g, r) => {
    const CELL = ['#46d9ff', '#3ee08f', '#ffd166', '#ff8fd8', '#b9a6ff', '#7df0c8', '#ff9e6b', '#8fb8ff'];   // QMATH.CELL_COLORS
    const P = [];
    for (let c = 0; c < 8; c++) P.push([c & 4 ? 0.8 : -0.8, c & 1 ? 0.17 : 1.77, c & 2 ? -0.8 : 0.8]);   // left/right, front/back, top/bottom
    for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) {   // an edge between every two corners, as wide as their coupling
      const d = [1, 2, 4].filter(k => (a ^ b) & k).length;
      M.add('glow', g.rod(P[a], P[b], [0.032, 0.017, 0.009][d - 1] * (0.6 + 0.7 * r()), 5), '#9a90ff');
    }
    P.forEach((p, c) => {
      const s = [Math.sign(p[0]), p[1] > 1 ? 1 : -1, Math.sign(p[2])];
      M.add('gloss', g.ball(0.14), CELL[c], p);
      M.add('glow', g.tor(0.11, 0.02, 3, 8), CELL[c], add3(p, s, 0.13), [0, Math.atan2(s[0], s[2]) + PI / 2, 0]);
    });
  });

  def('qubits.chart', 'Residual chart and circuit', 'The residual by depth, our cuts in cyan under the random ones in grey, beside the three-wire circuit of six gates.', 740, (M, g) => {
    const ours = [0, 0.44, 0.52, 0.56, 0.68, 0.74, 0.81, 0.88], rand = [0, 0.57, 0.75, 0.86, 0.92, 0.95, 0.97, 0.99];   // QUBITS_DATA.residual
    const X = b => -1.0 + b * 0.18, Y = v => 0.24 + v * 0.85;
    M.add('mat', g.box(1.62, 1.18, 0.03), '#121a2a', [-0.37, 0.7, -0.06]);
    for (let k = 0; k <= 4; k++) M.add('glow', g.box(1.45, 0.008, 0.01), '#34405a', [-0.37, Y(k / 4), -0.04]);
    const ser = (v, z, col, rad) => { const pts = v.map((y, b) => [X(b), Y(y), z]); M.add('glow', g.tube(pts, rad, 14), col); pts.forEach(p => M.add('glow', g.ball(0.028), col, p)); };
    ser(rand, -0.01, '#8e98ab', 0.01);
    ser(ours, 0.03, '#46d9ff', 0.014);
    M.add('mat', g.box(0.64, 1.18, 0.03), '#121a2a', [0.9, 0.7, -0.06]);
    const wx = [0.72, 0.9, 1.08];   // q2, q1, q0; time runs down
    wx.forEach(x => { M.add('glow', g.rod([x, 0.16, 0], [x, 1.22, 0], 0.008, 4), '#8e98ab'); M.add('glow', g.ball(0.022), '#46d9ff', [x, 0.42 + x * 0.3, 0.012]); });
    wx.forEach(x => M.add('gloss', g.box(0.12, 0.09, 0.05), '#ff5a4b', [x, 1.06, 0]));     // RX on each wire
    M.add('gloss', g.box(0.3, 0.09, 0.05), '#4d94ff', [0.81, 0.82, 0]);                     // RZZ q2 q1
    M.add('gloss', g.box(0.3, 0.09, 0.05), '#4d94ff', [0.99, 0.58, 0]);                     // RZZ q1 q0
    M.add('gloss', g.box(0.12, 0.09, 0.05), '#4d94ff', [0.72, 0.34, 0]);                    // RZ q2
    M.add('gloss', g.box(2.5, 0.08, 0.38), NAVY, [-0.07, 0.04, -0.02]);
  });
