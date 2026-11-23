// The miniatures of the story package proteins (Proteins): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/proteins/minis.js with
// the kit named below (tools/lowpoly/kit-b.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'proteins.<set>'.
// kit: b
  def('proteins.cell', 'Cell of proteins', 'A see-through cell with a faint nucleus and a loose cloud of proteins through it, coloured by their community and linked where they interact.', 1058, (M, g, r) => {
    const COMM = [[1.00, 0.42, 0.22], [0.30, 0.58, 1.00], [1.00, 0.84, 0.18], [0.25, 0.90, 0.45], [0.80, 0.38, 1.00], [0.15, 0.92, 0.92], [1.00, 0.38, 0.68], [0.62, 1.00, 0.25], [1.00, 0.70, 0.52], [0.92, 0.94, 1.00]];
    const cy = 1.0;
    M.frame([0, cy, 0]);
    M.add('veil', g.sph(1, 12, 8), '#59bff2');
    M.add('glass', g.sph(0.3, 10, 6), '#bf8cff');
    // no organelles: the communities spread loosely through the whole cell, linked within and across
    const P = [];
    COMM.forEach((c, k) => {
      const y = 1 - (k + 0.5) / 10 * 2, a = k * 2.39996, s = Math.sqrt(1 - y * y), d = 0.42 + 0.3 * (k % 3) / 2;
      const ctr = [d * s * Math.cos(a), d * y * 0.7, d * s * Math.sin(a)], g0 = P.length;
      for (let i = 0; i < 5; i++) {
        const p = add3(ctr, [(r() - 0.5) * 0.3, (r() - 0.5) * 0.24, (r() - 0.5) * 0.3]);
        P.push(p); M.add('glow', g.oct(0.05), c, p);
        if (i) M.add('glow', g.rod(P[g0 + Math.floor(r() * i)], p, 0.008, 3), '#c4d3f0');
      }
    });
    for (let k = 0; k < 16; k++) { const a = P[(k * 7 + 3) % P.length], b = P[(k * 13 + 11) % P.length]; if (a !== b) M.add('glow', g.rod(a, b, 0.005, 3), '#7d8cad'); }
    cellStand(M, g, cy);
  });
