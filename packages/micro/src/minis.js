// The miniatures of the story package micro (Tissue and time): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/micro/minis.js with
// the kit named below (tools/lowpoly/kit-a.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'micro.<set>'.
// kit: a
  add('micro.slide', 'Section in tiles', 'A tissue section cut into tiles, coloured by the domains a network of neighbouring tiles finds in it.', b => {
    const zc = x => 0.05 * Math.sin(x * 2.4) + 0.01, slope = x => 0.12 * Math.cos(x * 2.4), Y0 = 0.02, tb = easel(b, 0.5, 0.2, 0.44);
    const DOM = [['#52a83c', 0.034], ['#1c7a3c', 0.044], ['#9b2b22', 0.04], ['#b8741f', 0.056]], W = [-0.105, -0.035, 0.035, 0.105];
    tb.add('glass', box(1.0, 0.02, 0.4, [0, 0.01, 0]), '#cfe8f0');
    const top = {}, r = rng(3);
    for (let c = 0; c < 12; c++) for (let w = 0; w < 4; w++) {
      if ((c === 0 || c === 11) && (w === 0 || w === 3)) continue;
      const x = -0.44 + c * 0.08, z = zc(x) + W[w], [colour, h0] = DOM[w], h = h0 + 0.006 * r();
      tb.add('soft', box(0.072, h, 0.066, [x, Y0 + h / 2, z], [0, -Math.atan(slope(x)), 0]), w === 3 && c === 4 ? '#1a78b6' : colour);
      top[c + ',' + w] = [x, Y0 + 0.12, z];
    }
    const N = Object.keys(top).filter(k => +k.split(',')[0] % 2 === 0);
    for (const k of N) {                                                         // the network of neighbouring tiles over the section
      const [c, w] = k.split(',').map(Number), p = top[k], colour = mix(w === 3 && c === 4 ? '#1a78b6' : DOM[w][0], '#ffffff', 0.4);
      tb.add('glow', octa(0.015, p), colour);
      for (const q of [(c + 2) + ',' + w, c + ',' + (w + 1)]) if (top[q] && N.includes(q)) tb.add('soft', rod(p, top[q], 0.0035, 0.0035, 3), '#cfe6ff');
    }
  });

  add('micro.atlas', 'Slide library', 'A curved wall of glass slides with their tissue on shelves, one shelf for each decade of age.', b => {
    const r = rng(14), RC = 1.0, A = 0.48, SH = [0.0, 0.17, 0.34, 0.51, 0.68], TIS = ['#d986b0', '#b46aa8', '#e8a0a0', '#c45a7a', '#d79a6a', '#a77bd0'];
    const back = at(cylF(RC, RC, 0.8, 12, 2, true, Math.PI - A, 2 * A), [0, 0.4, RC]);
    b.add('two', back, (x, y) => mix('#0e2140', '#284a80', (1 - Math.abs(x) / 0.5) * (1 - Math.abs(y - 0.4) / 0.4)));
    for (const y of SH) {
      b.add('solid', at(ringF(RC - 0.07, RC, 12, Math.PI - A, 2 * A), [0, y, RC]), '#122440');
      b.add('glow', at(cylF(RC - 0.07, RC - 0.07, 0.008, 12, 1, true, Math.PI - A, 2 * A), [0, y + 0.004, RC]), '#5f8fd0');   // the shelf's bright lip
    }
    for (const f of [-0.32, -0.16, 0.16, 0.32]) b.add('solid', box(0.012, 0.68, 0.05, [(RC - 0.035) * Math.sin(f), 0.34, RC - (RC - 0.035) * Math.cos(f)], [0, -f, 0]), '#0b1626');
    for (let k = 0; k < 4; k++) for (let j = 0; j < 13; j++) {
      const f = -0.44 + j * 0.88 / 12 + (r() - 0.5) * 0.01, R = RC - 0.035, yc = SH[k] + 0.065, tis = TIS[Math.floor(j / 13 * 6)];
      b.add('soft', at(boxF(0.042, 0.1, 0.007), [R * Math.sin(f), yc, RC - R * Math.cos(f)], [(r() - 0.5) * 0.15, -f + (r() - 0.5) * 0.25, (r() - 0.5) * 0.1]),
        (x, y) => (y > yc + 0.026 ? '#e3eaf0' : mix(tis, '#9fd0d8', 0.25)));
    }
  });

  add('micro.hier', 'Organ architecture network', 'Organs, tissues, tissue types and domains as four rings, joined into an hourglass network.', b => {
    const LV = [[0.92, 0.42, '#1f8a4c', 10, 0.03], [0.66, 0.31, '#7ccf7e', 8, 0.022], [0.4, 0.14, '#ef8f7a', 5, 0.032], [0.12, 0.42, '#5aa9ff', 14, 0.015]];
    plinth(b, 0.46);
    const pos = LV.map(([y, R, c, n], l) => Array.from({ length: n }, (_, i) => {
      const a = l === 3 ? 6.2832 * (Math.floor(i / 3) + 0.25 * (i % 3) - 0.25) / 5 + 0.3 : 6.2832 * i / n + 0.3 * l;
      return [R * Math.sin(a), y, R * Math.cos(a)];
    }));
    LV.forEach(([y, R, c, n, s], l) => {
      b.add('glow', cyl(R, R, 0.006, 20, [0, y, 0], null, true), c);
      b.add('glass', disc(R, 20, [0, y, 0], [-Math.PI / 2, 0, 0]), c);
      pos[l].forEach(p => b.add(l === 3 ? 'glow' : 'soft', l === 3 ? octa(s, p) : ico(s, p), c));
    });
    const link = (l, i, j) => { const a = pos[l][i], c = pos[l + 1][j], ca = LV[l][2], cc = LV[l + 1][2];
      b.add('soft', rod(a, c, 0.004, 0.004, 3), (x, y) => mix(cc, ca, (y - c[1]) / (a[1] - c[1]))); };
    for (let i = 0; i < 10; i++) { link(0, i, Math.round(i * 0.8) % 8); if (i % 3 === 0) link(0, i, (Math.round(i * 0.8) + 1) % 8); }
    for (let i = 0; i < 8; i++) { link(1, i, Math.floor(i * 5 / 8)); if (i % 2) link(1, i, (Math.floor(i * 5 / 8) + 2) % 5); }
    for (let i = 0; i < 14; i++) link(2, Math.min(4, Math.floor(i / 3)), i);
  });

  add('micro.organs', 'Organ models', 'Small 3D models of the organs the slides come from: a heart, a kidney and a brain.', b => {
    plinth(b, 0.42);
    const H = [-0.2, 0.04, 0.08];                                                   // the heart, apex down and to its left
    b.add('solid', lathe([[0, 0], [0.04, 0.025], [0.09, 0.08], [0.12, 0.15], [0.12, 0.21], [0.09, 0.26], [0, 0.28]], 8, add3(H, [0, 0.02, 0]), [1, 1, 0.85], [0, 0, 0.35]), '#c23a44');
    b.add('solid', sph(0.06, 6, 4, add3(H, [-0.03, 0.27, -0.02])), '#b33748');
    b.add('solid', sph(0.055, 6, 4, add3(H, [0.08, 0.25, -0.03])), '#b33748');
    b.add('solid', tube([add3(H, [0.02, 0.24, 0.03]), add3(H, [0.03, 0.36, 0.02]), add3(H, [0.1, 0.39, 0]), add3(H, [0.15, 0.32, -0.03])], 8, 0.03, 5), '#dd5a61');
    for (const d of [-0.015, 0.03, 0.07]) b.add('solid', rod(add3(H, [d + 0.03, 0.37, 0.01]), add3(H, [d + 0.03, 0.44, 0.01]), 0.012, 0.01, 6), '#efe2d2');
    b.add('solid', rod(add3(H, [-0.09, 0.2, 0.03]), add3(H, [-0.1, 0.37, 0.02]), 0.025, 0.025, 6, false), '#6d77d6');
    const K = [0.08, 0.04, 0.2];                                                     // the kidney, a bean on end, its hilum inwards
    b.add('solid', tor(0.05, 0.066, 6, 10, add3(K, [0.0, 0.14, 0]), [0, 0, Math.PI * 0.2], Math.PI * 1.6), '#8f2f2c');
    for (const a of [Math.PI * 0.2, Math.PI * 1.8]) b.add('solid', sph(0.066, 6, 4, add3(K, [0.05 * Math.cos(a), 0.14 + 0.05 * Math.sin(a), 0])), '#8f2f2c');
    b.add('solid', tube([add3(K, [-0.045, 0.12, 0.01]), add3(K, [-0.08, 0.07, 0.02]), add3(K, [-0.07, 0.0, 0.03])], 6, 0.011, 3), '#e8d2ad');
    const Bn = [0.17, 0.04, -0.14], r = rng(21);                                      // the brain, two hemispheres
    for (const s of [-1, 1]) b.add('solid', sph(0.14, 9, 6, add3(Bn, [0.038 * s, 0.17, 0]), [0.48, 0.72, 1]), () => mix('#e8b2b7', '#c98c95', r() * 0.6));
    b.add('solid', sph(0.06, 6, 4, add3(Bn, [0, 0.09, -0.1]), [1.3, 0.7, 0.9]), '#d49ba3');
    b.add('solid', rod(add3(Bn, [0, 0.11, -0.03]), add3(Bn, [0, 0.0, -0.04]), 0.022, 0.016, 6, false), '#e6c2b6');
  });

  // triangles of each build, measured (the build and the harness list any that no longer match)
  tris({ 'micro.slide': 940, 'micro.atlas': 960, 'micro.hier': 1148, 'micro.organs': 856 });
