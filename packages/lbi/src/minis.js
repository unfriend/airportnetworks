// The miniatures of the story package lbi (The future): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/lbi/minis.js with
// the kit named below (tools/lowpoly/kit-a.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'lbi.<set>'.
// kit: a
  add('lbi.int', 'Interactome', 'A cloud of human protein interactions with no edge to it: a white-hot centre, knots of proteins out to the rim, the curated modules in their colours and TP53 the biggest hub.', b => {
    const r = rng(7), C = [0, 0.36, 0], P = [], cols = [];
    // the set's module colours (p53's gold is TP53's own, below)
    const MODS = ['#ff6b38', '#4d94ff', '#40e673', '#cc61ff', '#ff61ad'];
    plinth(b, 0.2);
    const node = (p, c, s, big) => { P.push(p); cols.push(col(c)); b.add('glow', big ? ico(s, add3(C, p)) : octa(s, add3(C, p)), c); return P.length - 1; };
    const link = (i, j, k, w) => b.add('glow', rod(add3(C, P[i]), add3(C, P[j]), w || 0.005, w || 0.005, 3), mix(cols[i], cols[j], 0.5).multiplyScalar(k || 0.7));
    const near = (p, i0, n) => { let best = i0; for (let j = i0 + 1; j < n; j++) if (dist(p, P[j]) < dist(p, P[best])) best = j; return best; };
    const shade = d => d < 0.5 ? mix('#f4f8ff', '#8fb0ff', d * 2) : mix('#8fb0ff', '#8a74f0', (d - 0.5) * 2);   // white-hot to violet, as the set
    for (let i = 0; i < 30; i++) { const p = mul3(unit(r), 0.015 + 0.085 * Math.cbrt(r())); node(p, i % 4 ? '#f4f8ff' : '#c9d8ff', 0.021); if (i % 4 === 1) link(i, near(p, 0, i), 1); }   // the dense white-hot centre
    // no shell round it: seven knots of proteins stand out from the centre on faint filaments, so its outline is lumpy
    for (let f = 0; f < 7; f++) {
      const y = 0.8 - (f + 0.5) / 7 * 1.6, a = f * 2.39996 + 0.4, s = Math.sqrt(1 - y * y), dir = [s * Math.cos(a), y * 0.85, s * Math.sin(a)];
      const tip = mul3(dir, 0.25 + 0.06 * r()), mid = add3(mul3(dir, 0.15), mul3(unit(r), 0.025));
      const m = node(mid, shade(0.4), 0.017), t0 = P.length;
      link(near(mid, 0, 30), m, 0.5);
      for (let k = 0; k < 6; k++) { const i = node(add3(tip, mul3(unit(r), 0.01 + 0.035 * r())), shade(0.72 + 0.28 * r()), 0.019); if (k < 3) link(k ? near(P[i], t0, i) : m, i, 0.5); }
    }
    // the curated modules half way out, three proteins each in their colour
    for (let q = 0; q < 5; q++) {
      const c = mul3(unit(r), 0.15), t0 = P.length;
      for (let k = 0; k < 3; k++) { const i = node(add3(c, mul3(unit(r), 0.028)), MODS[q], 0.023); link(k ? near(P[i], t0, i) : near(P[i], 0, 30), i, 1.1, 0.0055); }
    }
    // TP53, the biggest curated hub, in p53's gold beside the centre, with its spokes
    const p53 = [0.06, 0.05, 0.07], h = node(p53, '#ffd62e', 0.042, true), by = P.map((q, i) => [dist(p53, q), i]).filter(([, i]) => i !== h).sort((u, v) => u[0] - v[0]);
    for (let k = 0; k < 4; k++) link(h, by[k * 3 + 2][1], 1, 0.006);
  });

  add('lbi.mac', 'Classic computer', 'A beige all-in-one computer with its keyboard and mouse, before it is taken apart.', b => {
    const BE = '#cdc4ad', BE2 = '#b3aa94', BE3 = '#9a927e', KEY = '#bab19a', DARK = '#1a1b1d', INNER = '#3c3a36';
    b.add('solid', box(0.42, 0.52, 0.46, [0, 0.3, -0.06]), BE);
    b.add('solid', box(0.43, 0.04, 0.44, [0, 0.02, -0.06]), BE3);
    b.add('solid', box(0.33, 0.28, 0.008, [0, 0.405, 0.172]), BE2);              // the sloping surround, read as a recess
    b.add('solid', box(0.28, 0.225, 0.008, [0, 0.405, 0.176]), INNER);
    b.add('glow', box(0.25, 0.19, 0.006, [0, 0.405, 0.18]), '#8e9aa5');           // the light grey desktop
    b.add('glow', box(0.25, 0.016, 0.004, [0, 0.49, 0.183]), '#e8edf1');          // menu bar
    b.add('glow', box(0.13, 0.09, 0.004, [-0.03, 0.395, 0.184]), '#e2e8ec');      // the "Network" window
    b.add('solid', box(0.13, 0.014, 0.005, [-0.03, 0.44, 0.185]), '#4c5260');
    for (const p of [[-0.07, 0.38], [-0.03, 0.41], [0.0, 0.37], [-0.045, 0.36]]) b.add('solid', box(0.012, 0.012, 0.005, [p[0], p[1], 0.186]), '#2a2d33');
    b.add('solid', box(0.022, 0.018, 0.005, [0.095, 0.46, 0.184]), '#6d7480');    // disk and bin icons
    b.add('solid', box(0.016, 0.022, 0.005, [0.095, 0.345, 0.184]), '#6d7480');
    b.add('solid', box(0.09, 0.009, 0.006, [0.07, 0.19, 0.172]), DARK);           // floppy slot
    b.add('solid', box(0.42, 0.004, 0.004, [0, 0.13, 0.171]), BE3);
    b.add('solid', box(0.2, 0.006, 0.05, [0, 0.561, -0.2]), INNER);              // carrying handle
    b.add('solid', box(0.3, 0.06, 0.006, [0, 0.12, -0.291]), INNER);             // the port panel and vents at the back
    for (let k = 0; k < 4; k++) b.add('solid', box(0.26, 0.008, 0.006, [0, 0.4 + 0.03 * k, -0.291]), BE3);
    b.add('solid', box(0.44, 0.022, 0.17, [0, 0.011, 0.37], [0.05, 0, 0]), BE);  // keyboard
    for (let k = 0; k < 4; k++) for (let c = 0; c < 10; c++) b.add('solid', box(0.032, 0.012, 0.028, [-0.171 + c * 0.038, 0.027 - 0.0017 * k, 0.306 + k * 0.034]), KEY);
    b.add('solid', box(0.2, 0.012, 0.028, [0, 0.02, 0.442]), KEY);
    for (const x of [-0.17, -0.132, 0.132, 0.17]) b.add('solid', box(0.032, 0.012, 0.028, [x, 0.02, 0.442]), BE3);
    b.add('solid', sph(0.04, 8, 5, [0.31, 0.014, 0.38], [0.75, 0.35, 1.2]), BE);  // mouse
    b.add('solid', box(0.04, 0.006, 0.02, [0.31, 0.024, 0.345]), BE3);
    b.add('solid', tube([[0.31, 0.01, 0.33], [0.29, 0.01, 0.26], [0.24, 0.02, 0.2], [0.21, 0.08, 0.05]], 8, 0.004, 3), BE3);
  });

  add('lbi.web', 'Internet map', 'The internet as trees of links growing out of white-hot hubs into yellow trunks and red twigs.', b => {
    // thick, bright links and white-hot hubs over a faint glowing core, so it reads at 12 cm (thin and dark before)
    const r = rng(5), CY = 0.46, COL = ['#fff0a0', '#ffb040', '#ff5a2a'], RAD = [0.015, 0.011, 0.0078];
    plinth(b, 0.22);
    const flat = d => norm3([d[0], d[1] * 0.7, d[2]]);
    function grow(p, d, len, depth) {
      const q = add3(p, mul3(d, len));
      b.add('glow', rod(p, q, RAD[depth], RAD[depth] * 0.8, 3), COL[depth]);
      if (depth < 2) for (let k = 0; k < 2; k++) grow(q, flat(add3(d, mul3(unit(r), 0.75))), len * 0.62, depth + 1);
    }
    const hubs = [[-0.15, CY + 0.03, 0.06, 6, 0, 0.19], [0.17, CY - 0.03, -0.06, 6, 0, 0.18], [-0.02, CY + 0.12, -0.28, 4, 1, 0.14],
      [0.3, CY + 0.06, 0.2, 4, 1, 0.13], [-0.33, CY - 0.07, -0.17, 4, 1, 0.13], [0.04, CY - 0.1, 0.31, 4, 1, 0.14]];
    for (const [x, y, z, n, d0, len] of hubs) {
      const a0 = r() * 6.28;
      for (let k = 0; k < n; k++) { const a = a0 + 6.2832 * k / n; grow([x, y, z], flat([Math.cos(a), (r() - 0.5) * 0.8, Math.sin(a)]), len, d0); }
      b.add('glow', ico(d0 ? 0.03 : 0.046, [x, y, z]), '#ffffff');
      if (!d0) b.add('haze', sph(0.09, 6, 4, [x, y, z]), '#ffd27a');            // the white-hot glow of a big hub
    }
    b.add('haze', sph(0.24, 8, 6, [0.01, CY, 0], [1.2, 0.5, 0.9]), '#d89040');      // a faint glowing core
    for (const [i, j] of [[0, 1], [0, 4], [1, 3], [2, 5]]) b.add('soft', rod(hubs[i], hubs[j], 0.005, 0.005, 3), '#ff9a50');
  });

  add('lbi.dna', 'DNA double helix', 'A double helix with its coloured base pairs, beside a chromosome it coils up into.', b => {
    const BASE = { A: '#3ee08f', T: '#ff5a4b', G: '#ffb43b', C: '#4f9dff' }, PAIRS = ['AT', 'GC', 'TA', 'CG', 'AT', 'GC', 'CG', 'TA'];
    const X0 = -0.07, Y0 = 0.09, H = 0.86, R = 0.1, TURNS = 2.1, PH = [0, 2.3];
    const at3 = (s, u) => { const a = 6.2832 * TURNS * u + PH[s]; return [X0 + R * Math.cos(a), Y0 + H * u, R * Math.sin(a)]; };
    plinth(b, 0.28);
    for (const s of [0, 1]) b.add('soft', tube(Array.from({ length: 25 }, (_, k) => at3(s, k / 24)), 30, 0.016, 4), ['#6f93cf', '#9180c8'][s]);
    for (let j = 0; j < 16; j++) {
      const u = (j + 0.5) / 16, a = at3(0, u), c = at3(1, u), m = mul3(add3(a, c), 0.5), pr = PAIRS[j % 8];
      b.add('soft', rod(a, m, 0.011, 0.011, 4), BASE[pr[0]]); b.add('soft', rod(m, c, 0.011, 0.011, 4), BASE[pr[1]]);
    }
    const CC = [0.17, 0.22, 0.06];                                                // an X-shaped chromosome, banded
    for (const [dx, dy] of [[-0.045, 0.13], [0.045, 0.13], [-0.055, -0.13], [0.055, -0.13]]) {
      const g = at(cylF(0.026, 0.026, Math.hypot(dx, dy), 6, 3, false), [CC[0] + dx / 2, CC[1] + dy / 2, CC[2]], [0, 0, -Math.atan2(dx, dy)]);
      b.add('soft', g, (x, y) => (Math.floor(Math.abs(y - CC[1]) / 0.03) % 2 ? '#b9a6ff' : '#5aa0ff'));
    }
  });

  add('lbi.atp', 'ATP synthase', 'The molecular machine in its membrane: the turning ring, the central stalk and the head that makes ATP.', b => {
    b.add('solid', at(cylF(0.42, 0.42, 0.1, 20, 3, false), [0, 0.05, 0]), (x, y) => (Math.abs(y - 0.05) < 0.03 ? '#8a6640' : '#d4b27c'));   // the lipid bilayer: heads outside, tails inside
    b.add('soft', cyl(0.1, 0.1, 0.17, 10, [0, 0.085, 0]), '#ec8396');             // c-ring
    b.add('soft', sph(0.07, 6, 4, [0.17, 0.11, 0.03], [1, 1.3, 1]), '#7e4a3c');   // subunit a
    b.add('soft', cyl(0.035, 0.035, 0.27, 6, [0, 0.3, 0]), '#5adcc7');            // gamma, the central stalk
    b.add('soft', sph(0.05, 6, 4, [0, 0.19, 0]), '#3ebfaf');                      // delta and epsilon
    for (let k = 0; k < 6; k++) {                                                 // alpha3 beta3, alternating
      const a = k * Math.PI / 3;
      b.add('soft', sph(0.088, 7, 5, [0.105 * Math.cos(a), 0.5, 0.105 * Math.sin(a)], [1, 1.35, 1]), k % 2 ? '#3184dc' : '#1db0a2');
    }
    b.add('soft', sph(0.07, 7, 5, [0.03, 0.665, 0.01], [1.1, 0.8, 1.1]), '#9283d0');          // OSCP
    b.add('soft', tube([[0.18, 0.14, 0.04], [0.245, 0.3, 0.05], [0.235, 0.48, 0.04], [0.12, 0.645, 0.02]], 12, 0.028, 5), '#a33d4b');   // peripheral stalk
  });

  add('lbi.crowd', 'Crowd of patients', 'A crowd of people, one of them lit red under a beam of light: one patient among many rare diseases.', b => {
    const r = rng(9), F = [0, 0, 0.86], ROWS = [4, 5, 6, 5];
    b.add('solid', cyl(0.4, 0.41, 0.02, 16, [0, 0.01, 0.06]), '#0b1424');
    const person = (p, red) => {
      const c = red ? '#ff5a4b' : mix('#5f6b7c', '#99a5b6', r()), k = red ? 'glow' : 'solid';
      b.add(k, lathe([[0, 0], [0.042, 0], [0.033, 0.08], [0.012, 0.104]], 5, [p[0], 0.02, p[2]]), c);
      b.add(k, sph(0.022, 5, 3, [p[0], 0.149, p[2]]), c);
    };
    ROWS.forEach((n, k) => {
      const R = 0.6 + 0.13 * k;
      for (let j = 0; j < n; j++) {
        const a = (j - (n - 1) / 2) * 0.17 + (r() - 0.5) * 0.04, p = [F[0] + R * Math.sin(a), 0, F[2] - R * Math.cos(a)], red = k === 0 && j === 1;
        person(p, red);
        if (red) {
          b.add('glow', disc(0.075, 12, [p[0], 0.022, p[2]], [-Math.PI / 2, 0, 0]), '#b02a20');   // a red pool round their feet
          b.add('haze', cyl(0.022, 0.07, 0.6, 10, [p[0], 0.32, p[2]], null, true), '#ffd9b0');   // the beam of light
        }
      }
    });
  });

  add('lbi.sankey', 'Sankey diagram', 'Clinical categories on the left flowing as coloured ribbons into molecular clusters on the right.', b => {
    const CL = ['#4bb8d6', '#f39a3c', '#e3534c', '#b07fd9', '#43b6c6', '#a2544f', '#8d8d8d', '#e2c64a', '#e0535b'];
    const MO = ['#8a8f98', '#9b6bd6', '#e0453a', '#3fae5a', '#2f9e44', '#8c3b2e', '#6d7784', '#c84fd0', '#d9c63a', '#2d8fd6', '#7d6b5d', '#a855d8', '#c73fa0', '#1f7ac2', '#8a4b2a', '#5aa86c', '#9aa4ad', '#d6303a', '#c0c4c9'];
    const M = [   // genes from clinical category (row) to molecular cluster (column), as the set has them (illustrative)
      [1, 8, 7, 0, 8, 4, 0, 0, 0, 0, 0, 0, 0, 2, 9, 0, 0, 1, 0], [0, 6, 0, 1, 2, 0, 1, 1, 1, 1, 5, 0, 0, 0, 0, 1, 0, 0, 0],
      [0, 2, 0, 1, 3, 0, 1, 2, 0, 1, 5, 6, 3, 3, 0, 0, 0, 0, 0], [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 2, 10, 1, 0, 7, 1, 6, 0, 1, 1, 3, 0, 1, 0, 0], [0, 1, 0, 0, 4, 1, 0, 0, 0, 0, 1, 3, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 3, 0, 0, 1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0], [0, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 22, 1]];
    const rowS = M.map(r => r.reduce((s, v) => s + v, 0)), colS = MO.map((_, j) => M.reduce((s, r) => s + r[j], 0)), TOP = 0.92, HH = 0.84;
    const uL = (HH - 8 * 0.014) / 173, uR = (HH - 18 * 0.008) / 173;
    const topL = [], topR = [];
    let y = TOP; rowS.forEach((n, i) => { topL[i] = y; b.add('soft', box(0.08, n * uL, 0.14, [-0.42, y - n * uL / 2, 0]), CL[i]); y -= n * uL + 0.014; });
    y = TOP; colS.forEach((n, j) => { topR[j] = y; b.add('soft', box(0.08, n * uR, 0.14, [0.42, y - n * uR / 2, 0]), MO[j]); y -= n * uR + 0.008; });
    b.add('solid', box(1.0, 0.02, 0.3, [0, 0.01, 0]), '#0f1b2e');
    b.add('glow', box(1.0, 0.004, 0.004, [0, 0.019, 0.15]), '#2397c4');
    const offL = rowS.map(() => 0), offR = colS.map(() => 0);
    for (let j = 0; j < 19; j++) for (let i = 0; i < 9; i++) if (M[i][j]) {     // right ends stacked by category
      M[i][j] = [M[i][j], offR[j]]; offR[j] += M[i][j][0] * uR;
    }
    for (let i = 0; i < 9; i++) for (let j = 0; j < 19; j++) if (M[i][j]) {
      const [m, oR] = M[i][j], yl = topL[i] - offL[i] - m * uL / 2, yr = topR[j] - oR - m * uR / 2, z0 = (4 - i) * 0.024, SEG = 6;
      offL[i] += m * uL;
      const pt = t => { const s = smooth(t), e = t < 0.35 ? smooth(t / 0.35) : t > 0.65 ? smooth((1 - t) / 0.35) : 1, h = lerp(m * uL, m * uR, s) / 2, yc = lerp(yl, yr, s);
        return [[-0.38 + 0.76 * t, yc + h, z0 * e], [-0.38 + 0.76 * t, yc - h, z0 * e]]; };
      const g = mesh();
      for (let k = 0; k < SEG; k++) { const [a, c] = pt(k / SEG), [d, e] = pt((k + 1) / SEG); ftri(g, a, c, d); ftri(g, d, c, e); }
      b.add('two', g, CL[i]);
    }
  });

  add('lbi.scale', 'Tower of scales', 'A glass tower of eight glowing floors, from DNA at the bottom to the whole body at the top.', b => {
    plinth(b, 0.31);
    b.add('glass', cyl(0.29, 0.29, 0.92, 14, [0, 0.5, 0], null, true), '#2a8fb0');
    b.add('glow', cyl(0.292, 0.292, 0.008, 14, [0, 0.96, 0], null, true), '#46d9ff');
    // the emblems 1.5 times their first size (1.25 times upwards, so each stays under the floor above)
    const Y = k => 0.1 + k * 0.112, G = 'soft', Z = 1.5, ZY = 1.25, E = (k, d) => add3([0, Y(k) + 0.004, 0], [d[0] * Z, d[1] * ZY, d[2] * Z]);
    for (let k = 0; k < 8; k++) {
      b.add('haze', disc(0.25, 12, [0, Y(k), 0], [-Math.PI / 2, 0, 0]), '#0f5f78');          // a holographic floor
      b.add('glow', cyl(0.252, 0.252, 0.01, 12, [0, Y(k), 0], null, true), '#46d9ff');
    }
    // a small lit emblem on each floor
    b.add(G, rod(E(0, [-0.04, 0.005, 0]), E(0, [0.04, 0.09, 0]), 0.011 * Z, 0.011 * Z, 4), '#3ee08f');                  // DNA bases
    b.add(G, rod(E(0, [0.04, 0.005, 0]), E(0, [-0.04, 0.09, 0]), 0.011 * Z, 0.011 * Z, 4), '#ff5a4b');
    for (const y of [0.025, 0.07]) b.add(G, rod(E(0, [-0.03, y, 0]), E(0, [0.03, y, 0]), 0.008 * Z, 0.008 * Z, 4), y < 0.05 ? '#ffb43b' : '#4f9dff');
    b.add(G, ico(0.045 * Z, E(1, [0, 0.05, 0]), [1, 1.15 * ZY / Z, 1]), '#3a7bd5');                                       // a protein
    b.add(G, rod(E(1, [0.03, 0.07, 0]), E(1, [0.07, 0.095, 0.01]), 0.008 * Z, 0.005 * Z, 4), '#ffd23a');
    b.add(G, cyl(0.032 * Z, 0.032 * Z, 0.025 * ZY, 6, E(2, [0, 0.014, 0])), '#ec8396');                                     // a complex
    b.add(G, rod(E(2, [0, 0.025, 0]), E(2, [0, 0.05, 0]), 0.009 * Z, 0.009 * Z, 4), '#5adcc7');
    b.add(G, sph(0.034 * Z, 6, 4, E(2, [0, 0.068, 0]), [1, ZY / Z, 1]), '#1db0a2');
    b.add(G, sph(0.04 * Z, 6, 4, E(3, [0, 0.04, 0]), [1.7, 0.8 * ZY / Z, 0.8]), '#ffa36b');                                 // a mitochondrion
    b.add('haze', sph(0.052 * Z, 6, 4, E(4, [0, 0.052, 0]), [1, ZY / Z, 1]), '#7fe3ff');                                    // a cell
    b.add(G, ico(0.022 * Z, E(4, [0, 0.052, 0])), '#b98bff');
    b.add(G, cyl(0.052 * Z, 0.052 * Z, 0.03 * ZY, 6, E(5, [0, 0.016, 0])), '#f19aa7');                                      // tissue
    for (const s of [-1, 1]) b.add(G, sph(0.042 * Z, 6, 4, E(6, [0.022 * s, 0.045, 0]), [0.8, 0.85 * ZY / Z, 1.15]), '#f2a7b5');   // a brain
    b.add(G, cyl(0.015 * Z, 0.022 * Z, 0.065 * ZY, 6, E(7, [0, 0.035, 0])), '#e2eaf6');                                      // the body
    b.add(G, ico(0.017 * Z, E(7, [0, 0.085, 0])), '#e2eaf6');
  });

  add('lbi.body', 'PET body network', 'A whole-body PET scan in glowing hot-iron colours, with the network of its organs wound round it.', b => {
    const HOT = [[[0, 0.9, 0], 0.07, 0.55], [[0.03, 0.69, 0.04], 0.06, 0.35], [[-0.06, 0.6, 0.03], 0.07, 0.15], [[0.06, 0.55, -0.03], 0.05, 0.25], [[-0.06, 0.55, -0.03], 0.05, 0.25], [[0, 0.47, 0.04], 0.05, 0.4]];
    const heat = (x, y, z) => ramp(IRON, 0.31 + HOT.reduce((s, [c, w, a]) => s + a * Math.exp(-((x - c[0]) ** 2 + (y - 0.04 - c[1]) ** 2 + (z - c[2]) ** 2) / (2 * w * w)), 0));
    plinth(b, 0.24);
    const F = [0, 0.04, 0];
    const fb = { add: (k, g, c) => b.add(k, at(g, F), c) };
    figure(fb, 'glow', heat, 6);
    b.add('glow', sph(0.032, 6, 4, add3(F, [0.035, 0.69, 0.06])), '#ff9a2a');     // heart
    b.add('glow', sph(0.028, 6, 4, add3(F, [0, 0.47, 0.055])), '#ffe680');        // bladder
    const N = [[0.3, 0.5], [1.4, 0.62], [2.4, 0.46], [3.3, 0.7], [4.3, 0.54], [5.3, 0.78], [0.8, 0.82], [2.9, 0.38]].map(([a, y]) => add3(F, [0.21 * Math.sin(a), y, 0.17 * Math.cos(a)]));
    for (const p of N) b.add('glow', ico(0.018, p), '#f6f8ff');
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [0, 4], [7, 2]]) {
      const m = mul3(add3(N[i], N[j]), 0.5), out = norm3([m[0], 0, m[2]]);           // bands bow outwards round the body
      b.add('glow', tube([N[i], add3(m, add3(mul3(out, 0.07), [0, 0.03, 0])), N[j]], 6, 0.0045, 3), '#e9eef8');
    }
  });

  add('lbi.tissue', 'Tissue section', 'A stained section of stomach wall on a glass slide, its layers in purple and pink, with a cell nucleus in every dot.', b => {
    const r = rng(4), L = 0.46, zc = x => 0.05 * Math.sin(x * 2.4) + 0.01, Y0 = 0.02, tb = easel(b, 0.5, 0.19, 0.44);
    tb.add('glass', box(1.0, 0.02, 0.38, [0, 0.01, 0]), '#cfe8f0');
    const lay = (w0, w1, h, c) => tb.add('solid', slab(band(L, zc, () => w0, x => w1 + (w1 > 0.12 ? 0.008 * Math.sin(x * 70) : 0), 18), h, Y0), c);
    lay(-0.13, -0.075, 0.04, '#cf4f82');       // outer muscle, lengthwise
    lay(-0.075, -0.02, 0.045, '#e2729d');      // inner muscle, circular
    lay(-0.02, 0.07, 0.05, '#e9a2c3');         // submucosa
    lay(0.07, 0.13, 0.06, '#9b66c2');          // mucosa
    const tp = x => Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(x) / L, 6)));
    for (let i = 0; i < 24; i++) { const x = (r() * 2 - 1) * 0.4, w = (0.08 + 0.042 * r()) * tp(x); tb.add('solid', octa(0.012, [x, Y0 + 0.061, zc(x) + w], [1, 0.4, 1]), '#4b2a75'); }
    for (let i = 0; i < 5; i++) { const x = (r() * 2 - 1) * 0.36, w = (0.005 + 0.05 * r()) * tp(x); tb.add('solid', octa(0.012, [x, Y0 + 0.051, zc(x) + w], [1, 0.45, 1]), '#b8283c'); }
    tb.add('solid', sph(0.034, 6, 4, [-0.12, Y0 + 0.058, zc(-0.12) + 0.085], [1, 0.35, 1]), '#3d2266');   // a lymphoid aggregate
  });

  // triangles of each build, measured (the build and the harness list any that no longer match)
  tris({ 'lbi.int': 1198, 'lbi.mac': 940, 'lbi.web': 1184, 'lbi.dna': 1024, 'lbi.atp': 808, 'lbi.crowd': 996, 'lbi.sankey': 1056, 'lbi.scale': 800, 'lbi.body': 1048, 'lbi.tissue': 860 });
