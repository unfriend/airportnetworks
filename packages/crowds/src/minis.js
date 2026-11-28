// The package's miniatures (tools/packages/SPEC.md, "Miniatures"): its set in small, for its stations' icon in a shared
// room and the design room's table. node tools/lowpoly/build.mjs writes packages/crowds/minis.js.
// kit: b
  // the crowd: a cube of balls in the crowd's five muted colours, its edges lit, on a dark stand
  def('crowds.cube', 'Protein crowd', 'A cube packed with small balls in five muted colours, its edges lit, on a dark stand.', 732,
    (M, g, r) => {
      plinth(M, 0.34, 0.05);
      const cols = ['#8cb89a', '#c2b28c', '#c79eb8', '#8c9ecc', '#a8b2c2'], S = 0.56, n = 3;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
        const p = [i, j, k].map(q => (q + 0.5) / n - 0.5);
        M.add('gloss', g.ball(0.075 + 0.025 * r(), 0), cols[Math.floor(r() * 5)], [p[0] * S + 0.03 * (r() - 0.5), 0.36 + p[1] * S, p[2] * S + 0.03 * (r() - 0.5)]);
      }
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
        const pos = [0, 0, 0]; pos[a] = s1 * S / 2; pos[b] = s2 * S / 2;
        const c = 3 - a - b, d = [0.012, 0.012, 0.012]; d[c] = S;
        M.add('glow', g.box(...d), '#9fd8ff', [pos[0], 0.36 + pos[1], pos[2]]);
      }
    });
