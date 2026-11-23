// The miniatures of the story package nmd (Muscle and heart): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/nmd/minis.js with
// the kit named below (tools/lowpoly/kit-a.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'nmd.<set>'.
// kit: a
  add('nmd.tower', 'Multiplex tower', 'Seventy-one layers of gene links stacked into a tower, coloured by kind and threaded through by each gene.', b => {
    const r = rng(2), CAT = [['#46d9ff', 6], ['#3ee08f', 6], ['#a77bff', 1], ['#ff5a4b', 1], ['#ffb43b', 1], ['#ff5ad9', 2]];
    plinth(b, 0.44);
    let y = 0.08, ys = [];
    CAT.forEach(([c, n], k) => {
      if (k) y += 0.035;
      for (let i = 0; i < n; i++, y += 0.045) {
        ys.push(y);
        b.add('glass', disc(0.4, 16, [0, y, 0], [-Math.PI / 2, 0, 0]), c);
        b.add('glow', cyl(0.4, 0.4, 0.006, 16, [0, y, 0], null, true), c);
      }
    });
    const y0 = ys[0], y1 = ys[ys.length - 1];
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = 0.08 + 0.26 * Math.sqrt(r()); b.add('soft', rod([d * Math.cos(a), y0, d * Math.sin(a)], [d * Math.cos(a), y1, d * Math.sin(a)], 0.004, 0.004, 4), '#bfe9ff'); }
    b.add('glow', rod([0.02, y0, -0.01], [0.02, y1, -0.01], 0.008, 0.008, 4), '#ffd77a');   // the disease module's thread
  });

  add('nmd.motor', 'Motor unit', 'The spinal cord, a motor neuron and its axon, and the striated muscle fibres it drives, with the heart above.', b => {
    stand(b, 1.0, 0.34);
    b.add('glass', cyl(0.12, 0.12, 0.11, 12, [-0.36, 0.3, 0], [Math.PI / 2, 0, 0]), '#dfe8f2');      // the spinal cord, cut face to the front
    for (const s of [-1, 1]) b.add('solid', box(0.13, 0.03, 0.008, [-0.36, 0.3, 0.057], [0, 0, 0.6 * s]), '#8d86a0');   // grey matter butterfly
    b.add('glow', sph(0.026, 6, 4, [-0.31, 0.27, 0.062]), '#ffe27a');                                   // motor neuron
    for (const d of [[-0.06, 0.05], [0.03, 0.06], [-0.05, -0.04], [0.0, -0.06]]) b.add('glow', rod([-0.31, 0.27, 0.062], [-0.31 + d[0], 0.27 + d[1], 0.062], 0.005, 0.0025, 3), '#ffe27a');
    const AX = [[-0.31, 0.27, 0.062], [-0.24, 0.22, 0.065], [-0.17, 0.12, 0.07], [-0.03, 0.09, 0.08], [0.07, 0.14, 0.08], [0.1, 0.21, 0.08]];
    b.add('glow', tube(AX, 16, 0.007, 3), '#fff1b0');
    b.add('glass', tube(AX.slice(1), 14, 0.02, 5), '#9fe4ff');                                          // myelin sheath
    b.add('glass', sph(0.036, 6, 4, [-0.42, 0.13, 0.04]), '#cfe0f0');                                    // dorsal root ganglion
    b.add('glow', tube([[-0.42, 0.13, 0.04], [-0.34, 0.14, 0.065], [-0.24, 0.17, 0.07]], 6, 0.005, 3), '#7fe3ff');
    const HEX = [[0, 0], [0.06, 0], [-0.06, 0], [0.03, 0.052], [-0.03, 0.052], [0.03, -0.052], [-0.03, -0.052]];
    HEX.forEach(([dy, dz], k) => b.add('solid', cyl(0.036, 0.036, 0.44, 8, [0.26, 0.26 + dy, dz], [0, 0, Math.PI / 2]), k % 2 ? '#e8697c' : '#f07c8a'));
    for (const e of [[0.15, 0.3, 0.083], [0.24, 0.235, 0.088], [0.33, 0.3, 0.083]]) {                  // neuromuscular junctions
      b.add('glow', rod([0.1, 0.21, 0.08], e, 0.005, 0.005, 3), '#fff1b0');
      b.add('glow', octa(0.022, e, [1, 0.6, 0.5]), '#ffb43b');
    }
    const HC = [0.26, 0.56, -0.04];                                                                      // the heart
    b.add('solid', sph(0.1, 8, 6, HC, [1, 1.2, 0.9], [0, 0, 0.5]), '#c23a44');
    b.add('solid', sph(0.056, 6, 4, add3(HC, [-0.06, 0.085, -0.01])), '#b33748');
    b.add('solid', sph(0.052, 6, 4, add3(HC, [0.05, 0.095, -0.035])), '#b33748');
    b.add('solid', tube([add3(HC, [0, 0.07, 0.02]), add3(HC, [0, 0.18, 0.02]), add3(HC, [0.06, 0.2, 0]), add3(HC, [0.095, 0.14, -0.05])], 8, 0.021, 5), '#dd5a61');
    b.add('solid', rod(add3(HC, [-0.085, 0.05, 0.02]), add3(HC, [-0.095, 0.2, 0.02]), 0.019, 0.019, 6, false), '#5b6bd2');
  });

  add('nmd.hpc', 'Supercomputer', 'A hall of dark computer racks with blinking blue and green fronts and a lit cold aisle, and the small towers it computes.', b => {
    b.add('solid', box(1.0, 0.03, 0.82, [0, 0.015, 0]), '#0b1626');
    for (const z of [-0.3, -0.1, 0.1, 0.3]) b.add('soft', box(1.0, 0.002, 0.004, [0, 0.031, z]), '#1f5f9a');
    for (const x of [-0.25, 0, 0.25]) b.add('soft', box(0.004, 0.002, 0.82, [x, 0.031, 0]), '#1f5f9a');
    b.add('glow', box(0.78, 0.004, 0.1, [0, 0.032, 0]), '#2f8fe8');                                 // the cold aisle
    [[-0.27, -1], [-0.11, 1], [0.11, -1], [0.27, 1]].forEach(([z, f], k) => {
      for (let i = 0; i < 4; i++) {
        const x = -0.27 + 0.18 * i, fz = z + f * 0.0615;
        b.add('solid', box(0.17, 0.34, 0.12, [x, 0.2, z]), '#141a24');
        b.add('glow', box(0.012, 0.27, 0.003, [x - 0.035, 0.205, fz]), '#3a9cff');                 // rows of lights on the front
        b.add('glow', box(0.012, 0.27, 0.003, [x + 0.035, 0.205, fz]), (i + k) % 2 ? '#3ee08f' : '#3a9cff');
      }
      b.add('solid', box(0.76, 0.012, 0.04, [0, 0.43, z]), '#3a4250');                              // cable tray
      b.add('glow', rod([-0.38, 0.442, z - 0.008], [0.38, 0.442, z - 0.008], 0.004, 0.004, 4), '#ffc23a');
      b.add('glow', rod([-0.38, 0.442, z + 0.008], [0.38, 0.442, z + 0.008], 0.004, 0.004, 4), '#3a8cff');
    });
    const TC = ['#46d9ff', '#3ee08f', '#a77bff', '#ffb43b', '#ff5ad9'];
    for (let i = 0; i < 6; i++) {                                                                   // tiny towers in the field round the hall
      const x = -0.42 + i * 0.168, z = i % 2 ? 0.385 : -0.385, g = cylF(0.022, 0.022, 0.1, 6, 3, true);
      b.add('glow', at(g, [x, 0.08, z]), (px, py) => TC[Math.max(0, Math.min(4, Math.floor((py - 0.03) / 0.022)))]);
    }
  });

  // triangles of each build, measured (the build and the harness list any that no longer match)
  tris({ 'nmd.tower': 992, 'nmd.motor': 1022, 'nmd.hpc': 1012 });
