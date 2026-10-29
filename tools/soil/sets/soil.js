// soil: a cut-away block of soil with a wheat plant, its roots and root hairs; fertiliser dissolving into ammonium, part
// of it climbing the roots, the rest turned by the microbes' relay into nitrate that sinks out of the block or into
// nitrous oxide that rises from it; the relay itself in a soil pore, magnified; the BNI halo round the roots that slows
// the relay; the chromosome segment from the wild grass; one marked nitrogen atom's path. All illustrative.
// TODO(soil A): a stub that keeps the contract of SPEC.md ("The sets": soil): its params, anchors, views, controls and
// explore hook are final unless the SPEC changes; build the scene. The placeholder box only shows where the block is.
SETS.soil = function (K) {
  const { THREE } = K;
  const set = K.newSet('soil');
  // placeholder: the block's outline (1.2 x 0.7 x 0.8, the surface at y = 0) and the plant's axis
  const box = new THREE.Box3(new THREE.Vector3(-0.6, -0.7, -0.4), new THREE.Vector3(0.6, 0, 0.4));
  const ph = new THREE.Box3Helper(box, new THREE.Color(SLOOK.SOIL.sand));
  ph.material = K.fade(set, new THREE.LineBasicMaterial({ color: SLOOK.SOIL.sand, transparent: true }));
  set.group.add(ph);
  const anchors = {
    surface: [0, 0, 0], ear: [0, 0.85, 0], stem: [0, 0.4, 0], roots: [0, -0.35, 0.1], fert: [-0.25, 0.02, 0.15],
    nh4: [-0.2, -0.08, 0.2], no3: [0.3, -0.68, 0.2], n2o: [-0.3, 0.3, 0.1], halo: [0, -0.3, 0.12],
    pore: [0.18, -0.28, 0.25], aoa: [0.1, -0.2, 0.3], aob: [0.22, -0.18, 0.3], nob: [0.26, -0.32, 0.3], comammox: [0.12, -0.36, 0.3],
    grass: [-0.75, 0.4, -0.1], chromGrass: [-0.55, 0.7, 0.2], chromWheat: [0.35, 0.7, 0.2], segment: [-0.1, 0.8, 0.2], tracer: [0, 0, 0],
  };
  return Object.assign(set, {
    params: { soil_a: 1, soil_grow: 1, soil_cut: 1, soil_fert: 0, soil_flow: 0, soil_plant: 0.45, soil_inhibit: 0, soil_halo: 0,
      soil_dcd: 0, soil_pore: 0, soil_relay: 0, soil_grass: 0, soil_chrom: 0, soil_tracer: 0, soil_pick: -1 },
    log: [],
    update(S, t, dt) { /* TODO(soil A) */ },
    anchors,
    labels: [],
    cam: {
      default: [-28, 18, 3.2, 0, 0.05, 0], plant: [-20, 10, 2.4, 0, 0.45, 0], roots: [-15, 4, 1.9, 0, -0.3, 0.15],
      surface: [-30, 22, 2.2, -0.1, 0.05, 0.1], pore: [-10, 6, 1.5, 0.18, -0.28, 0.25], relay: [0, 4, 1.2, 0.18, -0.28, 0.25],
      chrom: [-5, 8, 2.4, -0.1, 0.7, 0.2], tracer: [-25, 12, 2.8, 0, 0, 0],
    },
    controls: [
      { key: 'view', label: 'View', options: [['default', 'The block'], ['roots', 'The roots'], ['pore', 'A soil pore'], ['chrom', 'The chromosome']] },
      { key: 'fert', label: 'Fertiliser', options: [['on', 'Spread'], ['off', 'None']] },
      { key: 'wheat', label: 'Wheat', options: [['bni', 'BNI wheat'], ['ctrl', 'Control wheat']] },
      { key: 'dcd', label: 'Inhibitor', options: [['off', 'None'], ['on', 'DCD']] },
    ],
    explore(c) {
      // TODO(soil A): the Nitrogen sketch (SPEC.md): replay the flows from c.t, as the other sets do
      const bni = c.wheat === 'bni', dcd = c.dcd === 'on', fert = c.fert !== 'off';
      return { soil_grow: 1, soil_cut: 1, soil_fert: fert ? K.prog(c.t, 0, 2) : 0, soil_flow: fert ? K.prog(c.t, 1, 3) : 0,
        soil_halo: bni ? 1 : 0, soil_dcd: dcd ? 1 : 0, soil_inhibit: Math.min(1, (bni ? 0.6 : 0) + (dcd ? 0.8 : 0)),
        soil_pore: c.view === 'pore' ? 1 : 0, soil_relay: c.view === 'pore' ? 4 : 0, soil_grass: c.view === 'chrom' ? 1 : 0,
        soil_chrom: c.view === 'chrom' ? K.prog(c.t, 0.5, 3) : 0, soil_tracer: 0 };
    },
  });
};
