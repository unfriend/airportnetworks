// The miniatures of the story package endo (Endotypes): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/endo/minis.js with
// the kit named below (tools/lowpoly/kit-a.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'endo.<set>'.
// kit: a
  add('endo.syn', 'Neuromuscular junction', 'A nerve ending full of vesicles over the folded muscle membrane it signals to, with receptors on the crests.', b => {
    for (let k = 0; k < 4; k++) b.add('solid', cyl(0.045, 0.045, 0.92, 8, [0, 0.045, -0.18 + 0.12 * k], [0, 0, Math.PI / 2]), k % 2 ? '#e2758f' : '#f08aa6');   // myofibrils
    b.add('soft', box(0.9, 0.08, 0.48, [0, 0.13, 0]), '#b9476a');
    const RC = ['#ffb43b', '#7fe0ff', '#3ee08f'];
    for (let k = 0; k < 7; k++) {
      const x = -0.36 + 0.12 * k;
      b.add('soft', box(0.09, 0.15, 0.48, [x, 0.245, 0]), '#e27a96');           // the crests between the junctional folds
      for (let j = 0; j < 3; j++) b.add('glow', octa(0.017, [x, 0.325, -0.14 + 0.14 * j], [1.2, 0.45, 1.2]), RC[(k + j) % 3]);
    }
    b.add('glass', box(0.8, 0.004, 0.44, [0, 0.345, 0]), '#bfe6ff');            // basement membrane in the cleft
    const B0 = [0, 0.36, 0], r = rng(6);
    b.add('glass', at(sphF(0.27, 12, 5, Math.PI / 2), B0, null, [1, 0.78, 0.85]), '#8fd0ff');   // the bouton
    b.add('glow', at(torF(0.27, 0.006, 3, 16, Math.PI * 2), B0, [Math.PI / 2, 0, 0], [1, 0.85, 1]), '#7fe3ff');
    for (let i = 0; i < 16; i++) { const a = r() * 6.28, d = 0.2 * Math.sqrt(r()), p = [d * Math.cos(a), 0.385 + 0.12 * r() * r(), d * Math.sin(a) * 0.8]; b.add('glow', ico(0.022, p), '#5d9dff'); }
    b.add('soft', sph(0.035, 6, 4, [-0.08, 0.5, -0.03], [2, 0.8, 0.8], [0, 0.4, 0.2]), '#e05ad0');   // a mitochondrion
    const AX = [[0, 0.56, 0], [-0.1, 0.7, -0.02], [-0.28, 0.84, -0.04], [-0.44, 0.95, -0.05]];
    b.add('glass', tube(AX, 8, 0.045, 6), '#7fc8ff');                            // the motor axon in its myelin
    b.add('glow', tube(AX, 8, 0.014, 3), '#ffe08a');
  });

  add('endo.net', 'Protein network cloud', 'A deep, round cloud of proteins in a glass shell, the disease genes lit inside as seeds with halos, their groups joined by glowing arcs.', b => {
    const r = rng(12), C = [0, 0.52, 0], core = [];
    plinth(b, 0.28);
    for (let i = 0; i < 15; i++) b.add('soft', octa(0.015, add3(C, mul3(unit(r), 0.29 + 0.11 * r()))), '#8ea4cf');
    for (let i = 0; i < 20; i++) { const p = mul3(unit(r), 0.21 * Math.cbrt(r())); core.push(p); b.add('glow', octa(0.017, add3(C, p)), mix('#9fb3ee', '#e4ebff', r())); }
    for (let i = 1; i < 20; i++) { let best = 0; for (let j = 0; j < i; j++) if (dist(core[i], core[j]) < dist(core[i], core[best])) best = j; b.add('soft', rod(add3(C, core[i]), add3(C, core[best]), 0.004, 0.004, 3), '#7f96d8'); }
    // the cloud is round and deep: a glass shell with a bright equator round its far shell of genes, haze inside
    b.add('glass', sph(0.42, 10, 7, C), '#34509c');
    b.add('glow', cyl(0.422, 0.422, 0.006, 16, C, null, true), '#4f8fe0');
    b.add('haze', sph(0.3, 8, 6, C), '#2a3f8f');
    const S = [[0.14, 0.06, 0.05], [0.06, -0.1, 0.12], [-0.12, 0.08, 0.09], [-0.04, 0.15, -0.1], [0.13, -0.08, -0.08], [-0.15, -0.09, -0.04], [-0.17, -0.02, -0.02]].map(p => add3(C, p));
    S.forEach((p, i) => { const pink = i >= 5; b.add('glow', ico(0.03, p), pink ? '#ff5ad9' : '#ffb43b'); if (!pink) b.add('haze', sph(0.058, 6, 4, p), '#ffb43b'); });
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [5, 6]]) {
      const m = mul3(add3(S[i], S[j]), 0.5), out = norm3(add3(m, mul3(C, -1)));
      b.add('glow', tube([S[i], add3(m, mul3(out, 0.06)), S[j]], 6, 0.0055, 3), i === 5 ? '#ff5ad9' : '#ffc960');
    }
  });

  add('endo.tree', 'Endotype tree', 'A tree of the module genes beside their rows of terms, cut and coloured into the twelve endotypes.', b => {
    const EN = [[9, '#9aa3b5'], [29, '#a98bea'], [47, '#3cc4e6'], [26, '#34d1a8'], [12, '#c7d65a'], [35, '#e3a03c'], [13, '#e2557a'], [17, '#8f9bb0'], [15, '#58d06a'], [25, '#5d86f0'], [34, '#f07b5a'], [131, '#e070d0']];
    b.add('solid', box(1.0, 0.03, 0.32, [0, 0.015, 0]), '#0f1b2e');
    b.add('glow', box(1.0, 0.004, 0.004, [0, 0.026, 0.16]), '#2397c4');
    b.add('solid', box(0.46, 0.86, 0.025, [0.25, 0.47, -0.02]), '#0d1626');      // the gene x term matrix
    const u = 0.82 / 393, Y = [];
    let y = 0.88;
    EN.forEach(([n, c]) => { const h = n * u; Y.push(y - h / 2); b.add('soft', box(0.42, h - 0.004, 0.006, [0.25, y - h / 2, -0.005]), c); y -= h; });
    // a dendrogram from the root on the left to a leaf per endotype, curving towards you in 3D
    const node = (lo, hi, depth) => {
      if (hi - lo === 1) return { x: 0, y: Y[lo], z: 0, c: EN[lo][1], leaf: true };
      const mid = lo + Math.ceil((hi - lo) / 2), a = node(lo, mid, depth + 1), c = node(mid, hi, depth + 1);
      const h = Math.max(a.h || 0, c.h || 0) + 1, n = { x: -0.05 - 0.085 * h, y: (a.y + c.y) / 2, z: 0.03 * h, h, kids: [a, c] };
      b.add('soft', rod([n.x, a.y, n.z], [n.x, c.y, n.z], 0.004, 0.004, 4), '#5fd7c0');
      for (const k of n.kids) b.add('soft', rod([n.x, k.y, n.z], [k.x, k.y, k.z], 0.004, 0.004, 4), k.leaf ? k.c : '#5fd7c0');
      b.add('glow', ico(0.015, [n.x, n.y, n.z]), '#9ff5e2');
      return n;
    };
    node(0, 12, 0);
    Y.forEach((y, i) => b.add('glow', octa(0.012, [0, y, 0]), EN[i][1]));
  });

  // triangles of each build, measured (the build and the harness list any that no longer match)
  tris({ 'endo.syn': 1108, 'endo.net': 1186, 'endo.tree': 760 });
