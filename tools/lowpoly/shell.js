// The shell's own miniatures (lowpoly.js): the station icon of the page that is not a story (the studio's stage) and of
// the shell's own circles (All stories, Back to the lobby: shared.js's KINDS). Not props: the design room's table leaves
// them out (tools/design/build.mjs, ICONS). The design room's own icon, design.table, went with the room when it was
// parked (v217): it is in this file at v216 (tools/design/README.md). Built with tools/lowpoly/kit-b.js
// into lowpoly.js by node tools/lowpoly/build.mjs; a story's miniatures are its package's (packages/<key>/src/minis.js).
// kit: b
  // ================================================================== the studio (its station icon, not a prop)
  // stories/studio.js: your own models placed life size, trigger cubes that show and hide them, sounds placed in the room.
  // A low stage with the studio's floor grid, a small figure on it (a placed model), a see-through trigger cube's
  // glowing edges and a little speaker on a post sending out sound, its full-volume ring on the floor
  def('studio.stage', 'Studio stage', 'The studio: a low stage with a floor grid, a small figure standing on it, a see-through trigger cube\'s glowing edges and a little speaker on a post sending out sound, its ring on the floor.', 870, (M, g) => {
    const TOP = 0.06, R = 0.5, BEIGE = '#e2c28f', CLAY = '#ece4d6', CUBE = '#46d9ff', SOUND = '#ffb43b';
    M.add('gloss', g.cyl(R, R * 1.04, TOP, 16), NAVY, [0, TOP / 2, 0]);           // the stage
    M.add('glow', g.tor(R, 0.012, 3, 20), BEIGE, [0, TOP, 0], [PI / 2, 0, 0]);    // its rim, in the studio's colour
    // the floor's grid (in VR the studio's floor has a faint 1 m grid): three lines each way, inside the rim
    for (const k of [-1, 0, 1]) {
      const o = k * 0.24, len = 2 * Math.sqrt(R * R - o * o) * 0.94;
      M.add('flat', g.plane(len, 0.007), '#3c5072', [0, TOP + 0.002, o], [-PI / 2, 0, 0]);
      M.add('flat', g.plane(0.007, len), '#3c5072', [o, TOP + 0.002, 0], [-PI / 2, 0, 0]);
    }
    // the figure (a placed, rigged model): legs, a body, arms (the right one raised, waving) and a head, light clay
    const F = [-0.2, TOP, -0.02], K = 1.18, at = (x, y, z) => [F[0] + x * K, F[1] + y * K, F[2] + z * K];   // (K: its size, to read as an icon)
    for (const s of [-1, 1]) M.add('gloss', g.rod(at(s * 0.036, 0.235, 0), at(s * 0.046, 0.008, 0.01), 0.022 * K, 6, true), CLAY);
    M.add('gloss', g.cyl(0.064 * K, 0.046 * K, 0.17 * K, 8), CLAY, at(0, 0.32, 0));
    M.add('gloss', g.rod(at(-0.07, 0.385, 0), at(-0.105, 0.235, 0.02), 0.016 * K, 6, true), CLAY);
    M.add('gloss', g.rod(at(0.07, 0.385, 0), at(0.15, 0.5, 0.03), 0.016 * K, 6, true), CLAY);
    M.add('gloss', g.ball(0.05 * K, 1), CLAY, at(0, 0.46, 0));
    // the trigger cube: faint see-through faces, glowing edges and a ball at each corner (as the studio draws one)
    const C = [0.17, TOP + 0.185, -0.14], E = 0.36, h = E / 2;
    M.add('veil', g.box(E, E, E), CUBE, C);
    const cn = []; for (const x of [-h, h]) for (const y of [-h, h]) for (const z of [-h, h]) cn.push([C[0] + x, C[1] + y, C[2] + z]);
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
      const d = Math.abs(cn[i][0] - cn[j][0]) + Math.abs(cn[i][1] - cn[j][1]) + Math.abs(cn[i][2] - cn[j][2]);
      if (Math.abs(d - E) < 1e-6) M.add('glow', g.rod(cn[i], cn[j], 0.008, 4), '#a6ecff');   // (the twelve edges: neighbours one side apart)
    }
    for (const p of cn) M.add('glow', g.oct(0.016), '#e2f8ff', p);
    // the speaker: a small box on a post at the front with its driver and two arcs of sound going out ahead, a little
    // turned to the figure, and the ring on the floor where it is at full volume
    const S = [0.21, TOP, 0.26];
    M.add('glow', g.tor(0.13, 0.005, 3, 16), SOUND, [S[0], TOP + 0.004, S[2]], [PI / 2, 0, 0]);
    M.frame(S, [0, -0.45, 0]);
    M.add('gloss', g.cyl(0.04, 0.045, 0.014, 8), NAVY, [0, 0.007, 0]);
    M.add('gloss', g.rod([0, 0.014, 0], [0, 0.12, 0], 0.011, 4), '#8a96a3');
    M.add('gloss', g.box(0.11, 0.15, 0.09), '#4a5874', [0, 0.195, 0]);
    M.add('glow', g.cone(0.04, 0.03, 10), SOUND, [0, 0.18, 0.052], [-PI / 2, 0, 0]);   // the driver, opening forward
    M.add('glow', g.ball(0.014, 0), '#ffe2b0', [0, 0.243, 0.047]);                   // and a tweeter over it
    for (const [rad, arc] of [[0.08, 1.3], [0.125, 1.2]]) M.add('glow', g.tor(rad, 0.007, 3, 8, arc), SOUND, [0, 0.185, 0.045], [PI / 2, 0, PI / 2 - arc / 2]);
    M.frame();
  });

  // ================================================================== the shell's own circles (their station icons, not props)
  // shared.js's two kinds of circle that are not stories (KINDS: their entries name these as their icons); story 'all'
  // is no story, so the design room's table (parked since v217) leaves them out (tools/design/build.mjs)
  def('all.stories', 'All stories', 'The All stories circle: the Stories screen in miniature, sixteen cards in two rows on an arc, one in each story\'s colour, under its header, on a small stand.', 620, (M, g) => {
    // the stories' colours (stories/list.js) round the colour wheel, so the cards read as every story
    const COLS = ['#ff5c5c', '#ff7a59', '#ffb43b', '#ffe066', '#b0a83c', '#c3e85a', '#3ee08f', '#5fe0c8', '#46d9ff', '#4d8dff', '#9db4ff', '#7d74ff', '#c08cff', '#ff5fd2', '#ff9ec4', '#ff6f91'];
    plinth(M, 0.3, 0.05);
    M.add('glow', g.tor(0.3, 0.012, 3, 20), '#cfeeff', [0, 0.05, 0], [PI / 2, 0, 0]);   // a pale rim
    M.add('gloss', g.cyl(0.03, 0.05, 0.21, 8, true), NAVY, [0, 0.155, 0]);                // the post
    // the arc, deep enough to keep its curve from the side as the icon turns: its middle R behind C, its ends forward;
    // cards CW x CH in two rows of eight, the lower row's foot at Y0, each turned to C (as the Stories screen's to you)
    const R = 0.42, SPAN = 2.5, CW = 0.115, CH = 0.15, GAP = 0.018, Y0 = 0.27, C = [0, 0, 0.27];
    const on = (phi, y) => [C[0] + R * Math.sin(phi), y, C[2] - R * Math.cos(phi)];
    for (let row = 0; row < 2; row++) for (let i = 0; i < 8; i++) {
      const phi = (i - 3.5) / 7 * (SPAN - CW / R), y = Y0 + CH / 2 + (1 - row) * (CH + GAP);
      M.frame(on(phi, y), [0, -phi, 0]);
      M.add('glow', g.box(CW, CH, 0.01), COLS[row * 8 + i]);   // lit from within, as the screen's cards (and brighter in the icon)
      M.add('flat', g.plane(CW - 0.024, 0.022), '#f4f8ff', [0, CH / 2 - 0.026, 0.0055]);    // its title
      M.add('flat', g.plane(CW - 0.03, 0.028), '#1a2a44', [0, -CH / 2 + 0.03, 0.0055]);    // and its Start button
      M.frame();
    }
    // the header over the cards (a band of light, as the screen's title), a rail under them and the arm to the post
    const top = Y0 + 2 * CH + GAP;
    M.add('glow', g.cyl(R, R, 0.045, 20, true, PI - SPAN / 2, SPAN), '#e8f4ff', [C[0], top + 0.04, C[2]]);
    const rail = []; for (let k = 0; k <= 8; k++) rail.push(on((k / 8 - 0.5) * SPAN, Y0 - 0.012));
    M.add('gloss', g.tube(rail, 0.012, 16, 4), NAVY);
    M.add('gloss', g.rod([0, 0.25, 0], on(0, Y0 - 0.012), 0.016, 6), NAVY);
  });

  def('all.lobby', 'Back to the lobby', 'The Back to the lobby circle: an open doorway on a round floor plate, warm light in it, stepping stones up to it and a curved arrow turning back over it: the way back to the start.', 760, (M, g) => {
    const GOLD = '#f0d58c', LIGHT = '#fff3d0';
    M.add('gloss', g.cyl(0.5, 0.52, 0.05, 20), NAVY, [0, 0.025, 0]);                    // the floor plate
    M.add('glow', g.tor(0.5, 0.014, 3, 24), GOLD, [0, 0.05, 0], [PI / 2, 0, 0]);        // its gold rim
    // the doorway: two posts, a round arch, a step, and the light of the lobby filling it
    const DW = 0.34, DH = 0.42, P = 0.07, F = 0.05, Z = -0.08, AR = DW / 2 + P / 2;
    for (const s of [-1, 1]) M.add('gloss', g.box(P, DH, 0.1), '#e9eef6', [s * AR, F + DH / 2, Z]);
    M.add('gloss', g.tor(AR, P / 2, 4, 10, PI), '#e9eef6', [0, F + DH, Z], [0, 0, 0], [1, 1, 1.43]);
    M.add('gloss', g.box(DW + 2 * P + 0.04, 0.025, 0.18), '#c9d3e2', [0, F + 0.0125, Z]);
    M.add('glow', g.plane(DW, DH), LIGHT, [0, F + DH / 2, Z]);
    M.add('glow', g.disc(DW / 2, 10, 0, PI), LIGHT, [0, F + DH, Z]);
    // stepping stones up to it: walk in
    for (const [x, z] of [[0.05, 0.38], [-0.04, 0.25], [0.02, 0.12]]) M.add('gloss', g.cyl(0.05, 0.055, 0.014, 8), '#c9d3e2', [x, F + 0.007, z], 0, [1.25, 1, 1]);
    // the arrow, a turn back (as an undo sign): from behind the door on the right, up over the arch and down in front of
    // it on the left, so it keeps its curve from the side too
    const R = 0.37, Y0 = F + DH, th0 = -0.15, th1 = PI + 0.42, at = th => [R * Math.cos(th), Y0 + R * Math.sin(th), Z - 0.22 * Math.cos(th)];
    const pts = []; for (let k = 0; k <= 8; k++) pts.push(at(th0 + (th1 - th0) * k / 8));
    M.add('glow', g.tube(pts, 0.024, 24, 6), GOLD);
    const e = at(th1), d = (() => { const p = at(th1 - 0.05), v = [e[0] - p[0], e[1] - p[1], e[2] - p[2]], n = Math.hypot(...v); return v.map(x => x / n); })();
    M.add('glow', g.cone(0.08, 0.16, 8), GOLD, add3(e, d, 0.06), [Math.acos(d[1]), Math.atan2(d[0], d[2]), 0, 'YXZ']);
  });
