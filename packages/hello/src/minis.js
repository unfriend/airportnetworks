// The miniatures of the example story package hello (Six handshakes): its ring in small, for its stations' icon in a
// shared room and (were it not hidden) the design room's table (story.json: minis, icon; tools/packages/SPEC.md,
// "Miniatures"). Built into packages/hello/minis.js with the kit named below (tools/lowpoly/kit-b.js, pasted before
// this: def, Mini's shapes M.g, plinth, NAVY ...) by node tools/lowpoly/build.mjs, which counts each one's triangles
// (the fourth argument must match: the build and the harness say when it does not). Each key is 'hello.<set>'.
// kit: b
  // the ring of people, each a small figure in the story's colour, linked to the two beside them, and a few shortcuts
  // across it in amber (the rewired links)
  def('hello.ring', 'Ring of people', 'Sixteen people standing in a ring on a dark plate, each linked to the two beside them, and three shortcuts across the ring in amber.', 864,
    (M, g) => {
      plinth(M, 0.5, 0.05);
      const N = 16, R = 0.4, Y = 0.05, at = i => { const a = i / N * 2 * PI; return [R * Math.cos(a), Y, R * Math.sin(a)]; };
      for (let i = 0; i < N; i++) {
        const p = at(i);
        M.add('gloss', g.cyl(0.018, 0.026, 0.07, 5, true), '#8fd3ff', [p[0], Y + 0.035, p[2]]);   // a body
        M.add('glow', g.sph(0.017, 5, 3), '#d8f1ff', [p[0], Y + 0.09, p[2]]);               // a head
        const q = at(i + 1);
        M.add('glow', g.rod([p[0], Y + 0.04, p[2]], [q[0], Y + 0.04, q[2]], 0.005, 3), '#5aa8d8');
      }
      for (const [i, j] of [[0, 7], [3, 12], [10, 14]]) {   // the shortcuts, arching over the middle
        const a = at(i), b = at(j), mid = [(a[0] + b[0]) / 2, Y + 0.2, (a[2] + b[2]) / 2];
        M.add('glow', g.tube([[a[0], Y + 0.06, a[2]], mid, [b[0], Y + 0.06, b[2]]], 0.007, 10, 4), '#ffb43b');
      }
    });
