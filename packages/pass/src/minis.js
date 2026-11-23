// The miniatures of the story package pass (Pass it on): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/pass/minis.js with
// the kit named below (tools/lowpoly/kit-b.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'pass.<set>'.
// kit: b
  // fish: a body (a stretched diamond) and a tail fin, counter-shaded as the set's: dark back, silver flanks, pale belly
  const fish = (M, g, p, head, bank, s, cols, fin) => {
    const rot = [bank, head, 0, 'YXZ'], c = cols || ['#3d6a86', '#cfdde6', '#eef4f6'];
    M.add('gloss', g.oct(1), (w, n) => n.y > 0.35 ? c[0] : n.y < -0.35 ? c[2] : c[1], p, rot, [0.075 * s, 0.028 * s, 0.02 * s]);
    M.add('flat', g.tri([-0.065 * s, 0, 0], [-0.11 * s, 0.032 * s, 0], [-0.11 * s, -0.032 * s, 0]), c[0], p, rot);
    if (fin) M.add('flat', g.tri([0.012 * s, 0.022 * s, 0], [-0.03 * s, 0.022 * s, 0], [-0.022 * s, 0.06 * s, 0]), c[0], p, rot);
  };
  def('pass.fish', 'School of fish', 'A school of fish swirling round under a dome of sea over sand, rocks and seagrass, a shark passing on the outside.', 802, (M, g, r) => {
    M.add('mat', g.cyl(1, 1.04, 0.1, 16), (w, n) => n.y > 0.5 ? M.jit('#4c564c', 0.06)() : NAVY, [0, 0.05, 0]);
    for (let k = 0; k < 4; k++) { const a = r() * 2 * PI, d = 0.3 + 0.5 * r(); M.add('mat', g.ball(1), M.jit('#3a4248', 0.08), [d * Math.cos(a), 0.12, d * Math.sin(a)], [r(), r(), r()], [0.14, 0.09, 0.12]); }
    for (let k = 0; k < 14; k++) { const a = r() * 2 * PI, d = 0.2 + 0.7 * r(), h = 0.2 + 0.18 * r(); M.add('mat', g.cone(0.025, h, 3), k % 2 ? '#3f6b4a' : '#4f7f52', [d * Math.cos(a), 0.1 + h / 2, d * Math.sin(a)], [(r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4]); }
    for (let i = 0; i < 44; i++) {   // the school circles: each fish heads along the ring
      const a = i / 44 * 2 * PI + r() * 0.2, rad = 0.42 + (r() - 0.5) * 0.28, y = 0.72 + (r() - 0.5) * 0.3 + 0.08 * Math.sin(3 * a);
      fish(M, g, [rad * Math.cos(a), y, rad * Math.sin(a)], -a - PI / 2, (r() - 0.5) * 0.6, 1.45);
    }
    fish(M, g, [0.84 * Math.cos(2.4), 0.5, 0.84 * Math.sin(2.4)], -2.4 - PI / 2, 0.3, 3.4, ['#4a5560', '#7d8994', '#c9d1d6'], true);   // the shark
    M.add('veil', g.sph(1, 14, 5, 0, 2 * PI, 0, PI / 2), '#2a8fb8', [0, 0.1, 0]);
  });

  def('pass.globe', 'Globe with an outbreak', 'The airports\' globe with an outbreak spreading from Vienna: a red cluster of infectious cities round it and a ring of spread moving out, exposed cities amber along the routes, recovered grey.', 1156, (M, g) => {
    const lon0 = 25, R = '#ff3b2a', O = '#ff8a2a', A = '#ffb43b', vu = unit(...AP.VIE), V = ll(...AP.VIE, lon0, 1);
    const from = (lat, lon) => { const u = unit(lat, lon); return Math.acos(Math.min(1, u[0] * vu[0] + u[1] * vu[1] + u[2] * vu[2])) / D2R; };   // degrees from Vienna
    // the land round Vienna glows red, then orange, where the infection has reached
    const cy = globe(M, g, lon0, [['VIE', 'LHR', R], ['VIE', 'IST', R], ['VIE', 'CDG', O], ['IST', 'DXB', O], ['LHR', 'JFK', A], ['DXB', 'DEL', A], ['IST', 'CAI', A], ['VIE', 'PEK', A], ['SIN', 'SYD'], ['MAD', 'GRU']], '#bfe0ff',
      (lat, lon, land) => { const d = from(lat, lon); return !land ? null : d < 9 ? '#d8402a' : d < 16 ? '#c8763a' : null; });
    const city = (k, col, rad) => M.add('glow', g.oct(rad), col, ll(...AP[k], lon0, 1.012));
    city('VIE', R, 0.07); for (const k of ['MUC', 'ZRH', 'PRG', 'BUD', 'FRA', 'MXP']) city(k, R, 0.048);
    for (const k of ['LHR', 'IST', 'CDG']) city(k, A, 0.045);
    for (const k of ['WAW', 'AMS', 'MAD']) city(k, '#8a94a3', 0.034);
    ringOn(M, g, V, 0.2, 0.013, '#ff5a2a'); ringOn(M, g, V, 0.34, 0.008, '#ffa060');   // the spread, moving out
    globeStand(M, g, cy);
  });

  def('pass.cell', 'The cell, a relay', 'The cell map\'s cell, its organelles dim, with the NF-kB relay lit: a signal caught at the membrane, passed hand to hand and carried into the nucleus; CFTR stuck on its way (red).', 1016, (M, g, r) => {
    const cy = 1.0;
    M.frame([0, cy, 0]);
    M.add('veil', g.sph(1, 12, 8), PL.pm, 0, 0, [1, 0.74, 1]);
    M.add('glass', g.sph(0.37, 10, 6), PL.nuc, [0.05, -0.04, -0.05]);
    M.add('glass', g.sph(0.52, 12, 5, 0.4, 1.4 * PI, 0.55, 2.0), PL.er, [0.05, -0.04, -0.05], [0.3, 0, 0], [1, 0.8, 1]);   // the organelles dim, as glass
    for (let k = 0; k < 3; k++) M.add('glass', g.tor(0.2 + 0.055 * k, 0.034, 3, 6, 1.3), PL.golgi, [-0.5, -0.1, 0.34], [0.2, -0.75, 0.6], [1, 1, 0.5]);
    for (let k = 0; k < 3; k++) { const a = 3.4 + k * 1.1, p = [0.66 * Math.cos(a), -0.25 + 0.2 * k, 0.66 * Math.sin(a)]; M.add('glass', g.sph(1, 6, 4), PL.mito, p, [r() * 3, r() * 3, r() * 3], [0.13, 0.05, 0.05]); }
    // the relay: TNF outside, its receptor in the membrane, hand to hand through the cytoplasm, NF-kB into the nucleus
    const relay = [[0.38, 0.82, 0.32], [0.36, 0.66, 0.3], [0.42, 0.46, 0.3], [0.34, 0.28, 0.22], [0.22, 0.16, 0.12], [0.1, 0.06, 0.04]];
    M.add('glow', g.ball(0.07), '#ffe08a', [0.42, 0.98, 0.36]);
    M.add('glow', g.tube(relay, 0.02, 12, 4), '#2fd2c0');
    relay.forEach((p, k) => M.add('glow', g.ball(k ? 0.045 : 0.06), k === relay.length - 1 ? '#b8fff4' : '#7df0e0', p));
    M.add('glow', g.tor(0.11, 0.012, 3, 12), '#7df0e0', [0.13, 0.08, 0.06], [-0.5, 0.6, 0, 'YXZ']);   // where it enters the nucleus
    M.add('glow', g.ball(0.06), '#ff3b30', [-0.55, -0.3, 0.5]);   // CFTR, failed a third of the way to the membrane
    for (let k = 1; k <= 3; k++) M.add('glow', g.oct(0.018), '#ff8a80', [-0.55 + 0.1 * k, -0.3 - 0.04 * k, 0.5 - 0.09 * k]);
    cellStand(M, g, cy);
  });
