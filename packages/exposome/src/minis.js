// The package's miniatures (tools/packages/SPEC.md, "Miniatures"): its sets in small, at most 1,200 triangles each, for
// its stations' icon in a shared room and the design room's table. A PLACEHOLDER (builder A): a cloud of substances in
// the families' colours round an amber knot of threads; the builders or the integration may draw the real ones.
// node tools/lowpoly/build.mjs writes packages/exposome/minis.js (the fourth argument of def must match its triangles).
// kit: b
  def('exposome.cloud', 'Cloud of substances', 'Points in the chemical families\' colours round an amber knot of threads, on a dark stand.', 608,
    (M, g, r) => {
      plinth(M, 0.3, 0.05);
      M.add('glow', g.ball(0.14, 1), '#f0a35e', [0, 0.45, 0]);
      const cols = ['#6DC5F1', '#73A6C2', '#4DAAE8', '#BDBDC0', '#F0B357', '#DF643B'];
      for (let i = 0; i < 60; i++) {
        const z = 2 * r() - 1, a = r() * 2 * PI, s = Math.sqrt(1 - z * z), d = 0.28 + 0.06 * r();
        M.add('glow', g.oct(0.016), cols[i % cols.length], [s * Math.cos(a) * d, 0.45 + z * d, s * Math.sin(a) * d]);
      }
    });
