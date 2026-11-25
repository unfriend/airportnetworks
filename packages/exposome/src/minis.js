// The package's miniatures (tools/packages/SPEC.md, "Miniatures"): its sets in small, at most 1,200 triangles each, for
// its stations' icon in a shared room and the design room's table: two substances (amber and cyan) with threads to the
// proteins of the genes they disturb, three of them shared, the story's idea in one piece.
// node tools/lowpoly/build.mjs writes packages/exposome/minis.js (the fourth argument of def must match its triangles).
// kit: b
  def('exposome.threads', 'Invisible threads', 'Two substances, amber and cyan, each tied by glowing threads to the proteins of the genes it disturbs; the three proteins both touch sit between them, on a dark stand.', 548,
    (M, g, r) => {
      plinth(M, 0.3, 0.05);
      const A = [-0.2, 0.5, 0], B = [0.22, 0.38, 0.04];   // the two substances
      M.add('glow', g.ball(0.085, 1), '#f0a35e', A);
      M.add('glow', g.ball(0.06, 1), '#46d9ff', B);
      // the proteins: A's own (left), B's own (right), the three both touch (between); blue as the cell's proteins
      const own = (c, n, rad, y0, a0) => Array.from({ length: n }, (_, i) => { const a = a0 + i * 2 * PI / n; return [c[0] + Math.cos(a) * rad, y0 + (i % 2 ? 0.07 : -0.05), c[2] + Math.sin(a) * rad]; });
      const PA = own(A, 5, 0.2, 0.52, 1.2), PB = own(B, 4, 0.16, 0.34, -0.6), PS = [[0.02, 0.62, 0.12], [0.03, 0.42, -0.14], [0.0, 0.26, 0.1]];
      const dot = (p, col) => M.add('glow', g.ball(0.026, 0), col, p);
      PA.concat(PB).forEach(p => dot(p, '#8fb3ff'));
      PS.forEach(p => dot(p, '#ffffff'));
      const thread = (a, b, col) => M.add('glow', g.rod(a, b, 0.0055, 3), col);
      PA.forEach(p => thread(A, p, '#ffe08a'));
      PB.forEach(p => thread(B, p, '#9be8ff'));
      PS.forEach(p => { thread(A, p, '#ffe08a'); thread(B, p, '#9be8ff'); });
      // the one thread the map ties between the two
      M.add('glow', g.rod(A, B, 0.011, 5), '#ffffff');
    });
