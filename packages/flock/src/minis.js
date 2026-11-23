// The miniatures of the story package flock (Flock): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/flock/minis.js with
// the kit named below (tools/lowpoly/kit-b.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'flock.<set>'.
// kit: b
  def('flock.flock', 'Starlings at dusk', 'A murmuration of starlings over a dark field with reeds, a lake and a ring of trees, against a dusk sky glowing low where the sun sets.', 609, (M, g, r) => {
    M.add('mat', g.cyl(1, 1.03, 0.06, 16), (w, n) => n.y > 0.5 ? M.jit('#22201a', 0.03)() : NAVY, [0, 0.03, 0]);
    M.add('glow', g.disc(1, 12), '#8a4f3c', [0.15, 0.062, -0.45], [-PI / 2, 0, 0], [0.45, 0.25, 1]);   // the lake mirrors the sunset
    for (let k = 0; k < 9; k++) { const a = PI / 2 + 0.25 + k * (PI - 0.5) / 8, h = 0.16 + 0.08 * r(); M.add('mat', g.cone(0.06, h, 5), '#0f1410', [0.9 * Math.sin(a), 0.06 + h / 2, 0.9 * Math.cos(a)]); }
    for (let k = 0; k < 16; k++) { const x = (r() - 0.5) * 1.1, z = 0.45 + r() * 0.4, h = 0.1 + 0.1 * r(); M.add('mat', g.cone(0.012, h, 3), '#3a3020', [x, 0.06 + h / 2, z], [(r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5]); }
    const sky = [[0, '#ff9a58'], [0.14, '#e88a6a'], [0.3, '#9a7a9a'], [0.5, '#4a5888'], [0.75, '#26336a'], [1, '#121c42']].map(([t, c]) => [t, M.rgb(c)]);
    M.add('glow', g.cyl(0.98, 0.98, 1.1, 12, true, PI / 2 + 0.15, PI - 0.3), smooth((w, n, lc) => { const t = (lc.y + 0.55) / 1.1; let i = 0; while (i < sky.length - 2 && t > sky[i + 1][0]) i++; return lerp(sky[i][1], sky[i + 1][1], Math.min(1, (t - sky[i][0]) / (sky[i + 1][0] - sky[i][0]))); }), [0, 0.61, 0]);
    const sa = PI - 0.25;   // the sun sets towards -z, a little to the right
    M.add('glow', g.disc(0.08, 10), '#ffe0a8', [0.95 * Math.sin(sa), 0.2, 0.95 * Math.cos(sa)], [0, sa + PI, 0]);
    for (let i = 0; i < 110; i++) {   // the murmuration: a bent, swelling cloud of birds flying one way
      const u = r(), c = [-0.45 + 0.9 * u, 0.66 + 0.15 * Math.sin(3 * u), -0.1 + 0.2 * Math.cos(2.5 * u)], rr = (0.06 + 0.13 * Math.sin(PI * u)) * Math.cbrt(r());
      const a = r() * 2 * PI, b = Math.acos(2 * r() - 1), p = [c[0] + rr * Math.sin(b) * Math.cos(a), c[1] + rr * Math.cos(b) * 0.7, c[2] + rr * Math.sin(b) * Math.sin(a)];
      const rot = [(r() - 0.5) * 0.8, 0.4 + (r() - 0.5) * 0.6, 0, 'YXZ'];
      M.add('flat', g.tri([0.014, 0, 0], [-0.014, 0, 0], [-0.005, 0.01, -0.035]), '#0b0b12', p, rot);
      M.add('flat', g.tri([0.014, 0, 0], [-0.014, 0, 0], [-0.005, 0.01, 0.035]), '#0b0b12', p, rot);
    }
  });
