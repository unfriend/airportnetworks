// The miniatures of the story package topo (The shape of tissue): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/topo/minis.js with
// the kit named below (tools/lowpoly/kit-b.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'topo.<set>'.
// kit: b
  def('topo.slide', 'Liver on a glass slide', 'A piece of liver drawn in H&E from its cells, pink plates of hepatocytes round a white central vein, on a glass slide with its frosted label.', 622, (M, g, r) => {
    M.add('gloss', g.ext([[-0.68, 0], [0.7, 0], [0.7, 0.62], [-0.68, 0.06]], 2.5), NAVY, [-1.25, 0, 0], [0, PI / 2, 0]);   // a wedge stand that tilts it to you
    M.frame([0, 0.34, -0.04], [0.4, 0, 0]);
    M.add('glass', g.box(2.6, 0.04, 1.36), '#cfefff', [0, 0.02, 0]);
    M.add('mat', g.box(0.62, 0.044, 1.34), '#c9d3dd', [-0.98, 0.022, 0]);
    const vx = 0.55, vz = -0.05, Y = 0.044;
    const tis = g.plane(1.26, 1.26, 8, 8); tis.rotateX(-PI / 2);
    M.add('flat', tis, w => Math.hypot(w.x - vx, w.z - vz) < 0.1 ? '#fbf4f7' : lerp(M.rgb('#d4779f'), M.rgb('#e597ba'), r()), [0.6, Y, 0]);
    for (let k = 0; k < 12; k++) {   // cords of hepatocytes run out from the vein, their nuclei along them
      const a = k / 12 * 2 * PI + 0.2, d = [Math.cos(a), 0, Math.sin(a)], len = 0.42 + 0.14 * r();
      const p0 = [vx + d[0] * 0.12, Y + 0.003, vz + d[2] * 0.12], p1 = [vx + d[0] * len, Y + 0.003, vz + d[2] * len];
      M.add('flat', g.strip([p0, lerp(p0, p1, 0.5), p1], [-d[2], 0, d[0]], 0.07), '#cf7aa2');
      for (let j = 0; j < 5; j++) M.add('flat', g.disc(0.024, 6), '#3b2a7a', lerp(p0, p1, (j + 0.5) / 5).map((v, i) => i === 1 ? Y + 0.006 : v), [-PI / 2, 0, 0]);
    }
    for (let k = 0; k < 10; k++) M.add('flat', g.disc(0.018, 5), k < 6 ? '#2a1d5c' : '#d9455f', [0.02 + r() * 1.16, Y + 0.006, -0.6 + r() * 1.16], [-PI / 2, 0, 0]);   // lymphocytes and red cells
    M.frame();
  });

  def('topo.map', 'Scored cells relief', 'Every cell of the new slide scored and raised as a relief, red for cirrhosis-like and blue for healthy-like, with one cell\'s glass dome and bars.', 758, (M, g) => {
    const f = (x, z) => Math.max(-1, Math.min(1, 0.55 * Math.sin(3.1 * x + 0.7) * Math.cos(2.7 * z - 0.4) + 0.4 * Math.sin(5.3 * x + 4.1 * z) + 0.3));
    const Y0 = 0.14, H = 0.12, hy = (x, z) => Y0 + H * f(x, z), col = (x, z) => ramp(RDBU, (f(x, z) + 1) / 2);
    const rel = g.plane(1.6, 1.6, 14, 14); rel.rotateX(-PI / 2);
    const rp = rel.attributes.position; for (let i = 0; i < rp.count; i++) rp.setY(i, hy(rp.getX(i), rp.getZ(i))); rel.computeVertexNormals();
    M.add('mat', rel, w => col(w.x, w.z));
    for (const [ax, s] of [['x', -0.8], ['x', 0.8], ['z', -0.8], ['z', 0.8]]) {   // the relief's sides down to the slide
      const pts = [];
      for (let i = 0; i <= 14; i++) { const u = -0.8 + i * 1.6 / 14, x = ax === 'x' ? s : u, z = ax === 'x' ? u : s; pts.push([x, hy(x, z), z]); }
      const sk = [];
      for (let i = 0; i < 14; i++) { const a = pts[i], b = pts[i + 1], a0 = [a[0], 0.04, a[2]], b0 = [b[0], 0.04, b[2]]; sk.push(...a0, ...b0, ...a, ...a, ...b0, ...b); }
      M.add('flat', g.mesh(sk), w => lerp(col(w.x, w.z), [0.35, 0.3, 0.38], 0.45));
    }
    M.add('glass', g.box(2.1, 0.04, 1.9), '#cfefff', [0, 0.02, 0]);
    const cx = -0.2, cz = 0.3, cyy = hy(cx, cz);   // the poster's cell: its 50 um dome, its bars behind it
    M.add('glass', g.sph(0.26, 10, 4, 0, 2 * PI, 0, PI / 2), '#46d9ff', [cx, cyy, cz]);
    M.add('glow', g.tor(0.26, 0.012, 3, 14), '#46d9ff', [cx, cyy, cz], [PI / 2, 0, 0]);
    M.add('glow', g.ball(0.03), '#46d9ff', [cx, cyy + 0.02, cz]);
    [0.42, 0.3, 0.22, 0.16, 0.12].forEach((l, i) => M.add('glow', g.rod([cx - 0.12 + i * 0.05, cyy + 0.05, cz - 0.38], [cx - 0.12 + i * 0.05, cyy + 0.05 + l, cz - 0.38], 0.01, 4), '#ffb43b'));
    M.add('glow', g.cone(0.025, 0.05, 4), '#ffb43b', [cx - 0.12, cyy + 0.5, cz - 0.38]);
    [[0.12, 0.2], [0.18, 0.3]].forEach(([b, d], i) => M.add('glow', g.rod([cx + 0.17 + i * 0.05, cyy + 0.05 + b, cz - 0.38], [cx + 0.17 + i * 0.05, cyy + 0.05 + d, cz - 0.38], 0.01, 4), '#ff7a3c'));
  });

  def('topo.tower', 'Tower of scales', 'The patch\'s cells on a glass plate with their balls, and the tower above: threads joining piece by piece into one amber trunk, loops as orange rings.', 1064, (M, g, r) => {
    M.add('glass', g.box(1.5, 0.04, 1.5), '#8cc6ff', [0, 0.02, 0]);
    M.add('mat', g.box(1.5, 0.046, 0.2), '#5f7fa6', [0, 0.023, 0.68]);   // frosted label, tinted as the healthy slides
    const cells = [];
    while (cells.length < 16) { const p = [(r() - 0.5) * 1.2, (r() - 0.5) * 1.05 - 0.08]; if (cells.every(q => Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.17)) cells.push(p); }
    const PAL = ['#7cc0ff', '#3ee08f', '#ff8fd8', '#b9a6ff', '#ffd166', '#7df0c8', '#ff9e6b', '#c9d2ff'];
    cells.forEach(([x, z]) => { M.add('glow', g.oct(0.032), '#ffe8b0', [x, 0.07, z]); M.add('glass', g.disc(0.1, 8), '#9fe8ff', [x, 0.045, z], [-PI / 2, 0, 0]); });
    // single linkage as gudhi joins the pieces: each piece a thread from its first cell, bridging into its elder at the join
    const E = [];
    for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) E.push([Math.hypot(cells[i][0] - cells[j][0], cells[i][1] - cells[j][1]), i, j]);
    E.sort((a, b) => a[0] - b[0]);
    const up = cells.map((_, i) => i), find = i => up[i] === i ? i : (up[i] = find(up[i])), size = cells.map(() => 1), joins = [];
    for (const [d, i, j] of E) { const a = find(i), b = find(j); if (a !== b) { joins.push([d, a, b]); if (size[a] < size[b] || (size[a] === size[b] && a > b)) { up[a] = b; size[b] += size[a]; joins[joins.length - 1].push(a, b); } else { up[b] = a; size[a] += size[b]; joins[joins.length - 1].push(b, a); } } }
    const d0 = joins[0][0], d1 = joins[joins.length - 1][0], hy = d => 0.12 + 1.2 * Math.log(d / d0) / Math.log(d1 / d0);
    const sz = cells.map(() => 1);
    joins.forEach(([d, , , young, elder]) => {
      const y = hy(d), A = cells[young], B = cells[elder], col = PAL[young % PAL.length];
      M.add('glow', g.rod([A[0], 0.07, A[1]], [A[0], y, A[1]], 0.006 + 0.003 * Math.sqrt(sz[young]), 3), col);
      M.add('glow', g.tube([[A[0], y, A[1]], [(A[0] + B[0]) / 2, y + 0.05, (A[1] + B[1]) / 2], [B[0], y, B[1]]], 0.007, 4, 3), col);
      sz[elder] += sz[young];
    });
    const last = find(0), T = cells[last], top = 1.55;
    M.add('glow', g.rod([T[0], 0.07, T[1]], [T[0], top, T[1]], 0.026, 6), '#ffb43b');   // the trunk: one piece left
    M.add('glow', g.cone(0.05, 0.1, 6), '#ffb43b', [T[0], top + 0.05, T[1]]);
    for (const [y, k, R] of [[0.48, 3, 0.2], [0.78, 7, 0.16], [1.02, 11, 0.24]]) {   // loops alive at their heights
      const c = cells[k], at = [c[0] * 0.5, y, c[1] * 0.5];
      M.add('glow', g.tor(R, 0.013, 3, 12), '#ff7a3c', at, [PI / 2, 0, 0]);
      if (k === 3) M.add('glass', g.cyl(R, R, 0.3, 10, true), '#ff7a3c', [at[0], y + 0.15, at[2]]);   // the big loop's chimney
    }
    M.add('glow', g.rod([-0.85, 0.04, -0.7], [-0.85, top, -0.7], 0.008, 4), '#e7eef8');   // the log ruler
    for (let k = 0; k < 5; k++) M.add('glow', g.box(0.08, 0.008, 0.008), '#e7eef8', [-0.81, 0.12 + k * 0.33, -0.7]);
  });

  def('topo.cohort', 'Slide rack', 'The cohort\'s glass slides standing in two stepped rows, healthy with blue labels and cirrhotic with red, each with its orange curve; the mean curves in front.', 920, (M, g, r) => {
    const curve = (u, peak, h) => h * Math.exp(-((u - peak) ** 2) / 0.05) + 0.12 * h * u;
    [[-0.5, '#4d9de0', '#7cc0ff', 0.3, 0.75], [0.5, '#e0504d', '#ff7a6b', 0.5, 1.0]].forEach(([gx, lab, mean, peak, hh]) => {
      const prof = [[0.56, 0]];
      for (let i = 0; i <= 8; i++) prof.push([0.56 - i * 0.12, 0.06 + i * 0.045], [0.44 - i * 0.12, 0.06 + i * 0.045]);   // the rack's steps, z against y
      prof.push([0.44 - 8 * 0.12, 0]);
      for (let i = 8; i >= 0; i--) {   // back rows first: their glass is drawn behind the front's
        const z = 0.5 - i * 0.12, y0 = 0.06 + i * 0.045;
        M.add('glass', g.box(0.85, 0.28, 0.012), '#cfefff', [gx, y0 + 0.14, z]);
        M.add('mat', g.box(0.16, 0.28, 0.016), lab, [gx - 0.345, y0 + 0.14, z]);
        const pts = [];
        for (let k = 0; k <= 6; k++) { const u = k / 6; pts.push([gx - 0.25 + u * 0.62, y0 + 0.03 + curve(u, peak + (r() - 0.5) * 0.08, hh * (0.18 + 0.06 * r())), z + 0.009]); }
        M.add('glow', g.strip(pts, [0, 1, 0], 0.022), '#ff7a3c');
      }
      M.add('mat', g.ext(prof, 0.88), '#202a3e', [gx + 0.44, 0, 0], [0, -PI / 2, 0]);
      const mp = []; for (let k = 0; k <= 8; k++) { const u = k / 8; mp.push([gx - 0.3 + u * 0.66, 0.04 + curve(u, peak, hh * 0.24), 0.72]); }
      M.add('glow', g.tube(mp, 0.016, 10), mean);
    });
  });
