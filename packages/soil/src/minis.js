// The miniatures of the story package soil (Holding on to nitrogen): its sets in small, for the design room's table and its
// stations' icon (story.json: minis, icon; tools/packages/SPEC.md, "Miniatures"). Built into packages/soil/minis.js with
// the kit named below (tools/lowpoly/kit-b.js, pasted before this) by node tools/lowpoly/build.mjs; the harnesses
// (tools/lowpoly/harness-a.html, harness-b.html) show it as you edit. Each key is 'soil.<set>'.
// kit: b
  // in the story's own colours (its SLOOK): soil from humus to subsoil, cream roots, leaves by chlorophyll, ripe ears
  // gold; nitrogen amber (ammonium), rose (nitrite), blue (nitrate), lilac (N2O), green (taken up); the regimes green,
  // purple and yellow, the wheat lines teal (BNI) and orange (control)
  const SOILC = { humus: '#4a3424', loam: '#634631', sub: '#86663f', root: '#e8dcc0', hair: '#f5eedc', ear: '#e3c15a', awn: '#cdb46a', stem: '#7cb85a',
    nh4: '#ffb43b', no2: '#ff7ab8', no3: '#7cc0ff', n2o: '#b9a6ff', up: '#7bd389', halo: '#5ff2e0', grain: '#f1eee2', net: '#cfd8e6', post: '#8a7a64' };   // (N2O a deeper lilac: the glow washes pale ones out)
  const FERTC = ['#5cc96b', '#a77bff', '#f2d14b'], LINEC = ['#2ec4b6', '#f08a3c'];
  // a tiller of wheat from the base b: its stem leaning (lean) towards the angle turn, two leaves arching out, the ear of
  // spikelets with its awns (the story's wheat, as the soil block and the field draw it)
  const tiller = (M, g, b, h, lean, turn, leaf) => {
    const dir = [Math.sin(turn) * lean, 1, Math.cos(turn) * lean], top = add3(b, dir, h / Math.hypot(...dir));
    M.add('mat', g.rod(b, top, 0.014, 4), SOILC.stem);
    [0.3, 0.55].forEach((f, j) => {
      const p0 = lerp(b, top, f), a = turn + (j ? PI : 0) + 0.7, d = [Math.sin(a), 0, Math.cos(a)];
      M.add('flat', g.strip([p0, add3(p0, [d[0] * 0.15, 0.1, d[2] * 0.15]), add3(p0, [d[0] * 0.3, 0.03, d[2] * 0.3])], [-d[2], 0, d[0]], 0.05), leaf[j]);
    });
    const rot = [Math.cos(turn) * lean, 0, -Math.sin(turn) * lean], ear = add3(top, dir, 0.075);
    M.add('gloss', g.sph(1, 6, 4), M.jit(SOILC.ear, 0.1), ear, rot, [0.034, 0.1, 0.034]);
    for (let k = 0; k < 4; k++) {   // the awns, splaying up from the ear
      const a = k / 4 * 2 * PI + turn, o = [Math.cos(a) * 0.022, 0.05, Math.sin(a) * 0.022], tip = add3(ear, [Math.cos(a) * 0.06 + dir[0] * 0.1, 0.17, Math.sin(a) * 0.06 + dir[2] * 0.1]);
      M.add('flat', g.tri(add3(ear, o), add3(ear, [o[0] * 0.3, 0.02, o[2] * 0.3]), tip), SOILC.awn);
    }
  };

  def('soil.soil', 'Cut-away soil block', 'A block of soil cut open at the front: the wheat on top with its ears, its roots reaching down through the glass half inside the teal halo of the BNI roots, ammonium glowing amber in the top soil, the relay\'s rose and blue further down, nitrate leaving at the bottom and a lilac wisp of nitrous oxide rising.', 1120, (M, g, r) => {
    const W = 1.2, D = 0.8, H = 0.7, B = 0.05, S = B + H, inGlass = () => [(r() - 0.5) * (W - 0.12), 0, 0.05 + r() * (D / 2 - 0.1)];
    M.add('gloss', g.box(W + 0.12, B, D + 0.12), NAVY, [0, B / 2, 0]);   // the plinth
    // the back half solid, its cut face the profile (humus, loam, a lighter subsoil, mottled); the front half glass
    [[0, 0.15, SOILC.humus], [0.15, 0.4, SOILC.loam], [0.4, H, SOILC.sub]].forEach(([a, b, c]) => M.add('mat', g.box(W, b - a, D / 2, 4, 1, 2), M.jit(c, 0.07), [0, S - (a + b) / 2, -D / 4]));
    M.add('glass', g.box(W, H, D / 2), '#cfe8ff', [0, B + H / 2, D / 4]);
    for (const [a, b] of [[[-1, B, 1], [1, B, 1]], [[-1, S, 1], [1, S, 1]], [[-1, B, 1], [-1, S, 1]], [[1, B, 1], [1, S, 1]], [[-1, S, 0], [-1, S, 1]], [[1, S, 0], [1, S, 1]]])
      M.add('glow', g.rod([a[0] * W / 2, a[1], a[2] * D / 2], [b[0] * W / 2, b[1], b[2] * D / 2], 0.007, 3), '#e7eef8');   // the glass's pale edges
    for (let k = 0; k < 9; k++) { const p = inGlass(); p[1] = B + 0.04 + r() * (H - 0.1); M.add('mat', g.oct(0.03 + 0.02 * r()), M.jit(k % 3 ? '#7a5a3c' : '#a88a62', 0.06), p, [r(), r(), r()]); }   // grains left in front
    for (let k = 0; k < 3; k++) M.add('mat', g.ball(0.035 + 0.02 * r()), M.jit(SOILC.post, 0.08), [-0.45 + 0.35 * k + 0.1 * r(), S + 0.01, -0.12 - 0.2 * r()], [r(), r(), r()], [1, 0.6, 1]);   // stones
    // the roots: main roots fanning down through the glass half, with laterals
    const R0 = [0, S - 0.01, 0.03];
    for (let k = 0; k < 6; k++) {
      const a = -1.15 + k * 0.46, z = () => 0.06 + r() * 0.24;
      const pts = [R0, [Math.sin(a) * 0.1, S - 0.12, 0.05 + 0.04 * r()], [Math.sin(a) * 0.26, S - 0.32 - 0.06 * r(), z()], [Math.sin(a) * 0.34 + (r() - 0.5) * 0.06, B + 0.08 + 0.06 * r(), z()]];
      M.add('mat', g.tube(pts, 0.011, 6, 3), SOILC.root);
      for (let j = 1; j < 3; j++) { const p = lerp(pts[j], pts[j + 1], 0.4); M.add('mat', g.rod(p, add3(p, [Math.sin(a) * 0.1 + (r() - 0.5) * 0.08, -0.09 - 0.05 * r(), 0.03 + 0.05 * r()]), 0.005, 3), SOILC.hair); }
    }
    M.add('veil', g.ball(1, 1), SOILC.halo, [0, S - 0.3, 0.16], 0, [0.42, 0.32, 0.2]);   // the BNI halo round the roots
    // nitrogen on its way: fertiliser grains on the surface, ammonium in the top soil, nitrite and nitrate below, some
    // climbing a root as green, nitrate leaving at the bottom, an N2O wisp rising
    for (let k = 0; k < 5; k++) M.add('mat', g.oct(0.02), SOILC.grain, [-0.48 + 0.24 * k + 0.08 * r(), S + 0.012, -0.05 - 0.25 * r()]);
    for (let k = 0; k < 7; k++) { const p = inGlass(); p[1] = S - 0.03 - 0.1 * r(); M.add('glow', g.oct(0.03), SOILC.nh4, p); }
    for (let k = 0; k < 3; k++) { const p = inGlass(); p[1] = S - 0.22 - 0.12 * r(); M.add('glow', g.oct(0.026), SOILC.no2, p); }
    for (let k = 0; k < 5; k++) { const p = inGlass(); p[1] = B + 0.03 + 0.18 * r(); M.add('glow', g.oct(0.03), SOILC.no3, p); }
    for (const f of [0.35, 0.6]) M.add('glow', g.oct(0.02), SOILC.up, [Math.sin(-0.23) * 0.26 * f, S - 0.32 * f, 0.07]);
    M.add('glow', g.tube([[-0.36, S, 0.22], [-0.42, S + 0.14, 0.24], [-0.34, S + 0.28, 0.22], [-0.41, S + 0.42, 0.2]], 0.014, 8, 3), SOILC.n2o);
    // the wheat: three tillers, leaves still green, ears ripe
    tiller(M, g, [0, S, 0], 0.7, 0.05, 0.4, ['#3f9a3a', '#53a03a']);
    tiller(M, g, [0.02, S, -0.01], 0.62, 0.16, 2.3, ['#53a03a', '#2f8a3a']);
    tiller(M, g, [-0.02, S, 0.01], 0.58, 0.17, -1.9, ['#2f8a3a', '#7fb23e']);
  });

  def('soil.field', 'Field trial under netting', 'The trial\'s 24 plots in four blocks, each edged in its regime\'s colour with a stake in its wheat\'s, the leaves by their chlorophyll on day 70 (the BNI wheat still green where the control wheat yellows without fertiliser), netting on posts over them, nitrate dripping blue from the slab and jars breathing nitrous oxide on a bench.', 1053, (M, g, r) => {
    const PW = 0.26, PD = 0.2, GAP = 0.05, Y = 0.14, X0 = -(6 * PW + 5 * GAP) / 2 + PW / 2, Z0 = -(4 * PD + 3 * GAP) / 2 + PD / 2;
    M.add('gloss', g.box(2.36, 0.04, 1.36), NAVY, [0.22, 0.02, 0]);   // the plinth
    M.add('mat', g.box(1.86, 0.1, 1.12), (w, n) => n.y > 0.5 ? '#3b2a1e' : '#2a1d14', [0, 0.09, 0]);   // the soil slab
    // day 70's leaves: deep green, but the control wheat yellowing where it had no fertiliser (the slides' picture)
    const leaf = (line, fert) => (line ? (fert ? '#53a03a' : '#c9b44a') : (fert ? '#2f8a3a' : '#3f9a3a'));
    for (let b = 0; b < 4; b++) {   // four blocks (the replicates), each with the six treatments in a seeded order
      const order = [0, 1, 2, 3, 4, 5];
      for (let i = 5; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      order.forEach((t, i) => {
        const line = Math.floor(t / 3), fert = t % 3, x = X0 + i * (PW + GAP), z = Z0 + b * (PD + GAP);
        M.add('mat', g.box(PW, 0.03, PD), FERTC[fert], [x, Y + 0.015, z]);
        M.add('mat', g.box(PW - 0.05, 0.08, PD - 0.05), (w, n) => n.y > 0.5 ? M.jit(leaf(line, fert), 0.05)() : lerp(M.rgb(leaf(line, fert)), [0.1, 0.12, 0.08], 0.35), [x, Y + 0.07, z]);
        M.add('glow', g.rod([x - PW / 2 + 0.015, Y + 0.03, z + PD / 2 - 0.015], [x - PW / 2 + 0.015, Y + 0.15, z + PD / 2 - 0.015], 0.009, 3), LINEC[line]);
      });
    }
    // the netting on its posts, drawn across the field
    const NX = 3 * PW + 2.5 * GAP + 0.06, NZ = 2 * PD + 1.5 * GAP + 0.06, NY = Y + 0.3;
    for (const x of [-NX, 0, NX]) for (const z of [-NZ, NZ]) M.add('mat', g.rod([x, Y, z], [x, NY, z], 0.012, 4), SOILC.post);
    M.add('veil', g.plane(2 * NX, 2 * NZ), SOILC.net, [0, NY, 0], [-PI / 2, 0, 0]);
    for (let k = 0; k <= 6; k++) { const x = -NX + k * NX / 3; M.add('glow', g.rod([x, NY, -NZ], [x, NY, NZ], 0.004, 3), SOILC.net); }
    for (let k = 0; k <= 3; k++) { const z = -NZ + k * 2 * NZ / 3; M.add('glow', g.rod([-NX, NY, z], [NX, NY, z], 0.004, 3), SOILC.net); }
    for (let k = 0; k < 5; k++) M.add('glow', g.oct(0.02), SOILC.no3, [-0.75 + 0.36 * k + 0.08 * r(), 0.05 + 0.04 * r(), 0.57]);   // nitrate seeping out
    // the jars on a bench: soil from each wheat in fertilised soil breathing N2O (the BNI wheat's far less), and DCD's
    M.add('gloss', g.box(0.28, 0.06, 0.8), '#5d6878', [1.2, 0.07, 0]);
    [[-0.26, 0.26], [0, 0.09], [0.26, 0.04]].forEach(([z, h]) => {
      M.add('glass', g.cyl(0.07, 0.07, 0.18, 8, true), '#cfefff', [1.2, 0.19, z]);
      M.add('mat', g.cyl(0.072, 0.072, 0.03, 8, true), '#8a96a3', [1.2, 0.29, z]);
      M.add('glow', g.cone(0.05, h + 0.06, 5), '#b9a6ff', [1.2, 0.31 + (h + 0.06) / 2, z]);
    });
  });

  def('soil.net', 'Microbe cloud and network', 'The soil\'s crowd of microbes as a cloud over a small field: kinds coloured by phylum in a faint shell, and the network of those that rise and fall together pulled out of its core, its big modules in their colours, the plots where one is strong lit below.', 1012, (M, g, r) => {
    // the field small below: twelve plots, three of them lit where the red module is strong
    M.add('gloss', g.box(1.0, 0.05, 0.72), NAVY, [0, 0.025, 0]);
    M.add('mat', g.box(0.9, 0.04, 0.62), '#3b2a1e', [0, 0.07, 0]);
    const lit = [], LEAFS = ['#2f8a3a', '#53a03a', '#7fb23e', '#3f9a3a'];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const p = [-0.315 + i * 0.21, 0.092, -0.19 + j * 0.19], on = (i + 2 * j) % 5 === 1;
      M.add(on ? 'glow' : 'mat', g.plane(0.17, 0.15), on ? '#e8443f' : LEAFS[(i * 3 + j) % 4], p, [-PI / 2, 0, 0]);
      if (on) lit.push(p);
    }
    const C = [0, 0.95, 0];
    M.add('veil', g.ball(0.5, 1), '#9fb8ff', C);   // the cloud's faint shell
    const PHY = ['#5aa9ff', '#ffb347', '#7bd389', '#ff7eb6', '#c39bff', '#4dd0c8', '#ff5ad9', '#8e98ab'];
    const onShell = (r0, r1) => { const u = 2 * r() - 1, a = r() * 2 * PI, s = Math.sqrt(1 - u * u), d = r0 + (r1 - r0) * r(); return add3(C, [d * s * Math.cos(a), d * u, d * s * Math.sin(a)]); };
    for (let i = 0; i < 46; i++) M.add('glow', g.oct(0.013 + 0.007 * r()), PHY[i % PHY.length], onShell(0.36, 0.48));   // the rare kinds, by phylum
    // the network: five big modules round the core, their kinds linked within (pale cyan), a few links between them
    // (faint red: one rises as the other falls)
    const MOD = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#cc5de8'], nodes = [];
    MOD.forEach((c, m) => {
      const y = 0.6 - m * 0.3, a = m * 2.4, s = Math.sqrt(1 - y * y), mc = add3(C, [0.25 * s * Math.cos(a), 0.25 * y, 0.25 * s * Math.sin(a)]), own = [];
      for (let i = 0; i < 6; i++) {
        const p = add3(mc, [(r() - 0.5) * 0.2, (r() - 0.5) * 0.17, (r() - 0.5) * 0.2]);
        M.add('glow', g.oct(0.036), c, p);
        if (own.length) M.add('glow', g.rod(own[Math.floor(r() * own.length)], p, 0.006, 3), '#9fe8ff');
        if (own.length > 2) M.add('glow', g.rod(own[Math.floor(r() * own.length)], p, 0.006, 3), '#9fe8ff');
        own.push(p);
      }
      nodes.push(own);
    });
    for (let k = 0; k < 4; k++) M.add('glow', g.rod(nodes[k][k % 6], nodes[k + 1][(k + 3) % 6], 0.004, 3), '#ff7a6b');
    // light rising from the lit plots towards the red module
    for (const p of lit) M.add('glow', g.rod(add3(p, [0, 0.005, 0]), lerp(p, nodes[0][0], 0.78), 0.008, 3), '#ff6b6b');
  });
