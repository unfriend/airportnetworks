// field: the trial's 24 plots under netting (2 wheat lines x 3 regimes x 4 replicates, the replicates drawn as four
// blocks), the wheat growing over the five sampling dates with each plot's leaves coloured by its measured chlorophyll,
// nitrate seeping down as blue light under each plot, jars of each date's soil breathing out N2O as the slides' curves
// say, soil cores lifting out of the plots and stacking into the design's 30 groups, and the plots lit by a module of
// the network. Real numbers from SOIL_DATA (SDATA); the plots' layout is illustrative.
// TODO(soil A): a stub that keeps the contract of SPEC.md ("The sets": field): its params, anchors, views, controls, api
// and explore hook are final unless the SPEC changes; build the scene. The placeholder shows where the field lies.
SETS.field = function (K) {
  const { THREE } = K;
  const set = K.newSet('field');
  // the plots: 4 blocks (rows along z, the replicates) of 6 plots (along x); in each block the six treatments in an
  // order of their own (seeded: a randomised block design, as a field trial is laid out; the real map is not known)
  const PW = 0.24, PD = 0.2, GX = 0.06, GZ = 0.1, rnd = K.rng(16), order = [];
  for (let r = 0; r < 4; r++) {
    const o = [0, 1, 2, 3, 4, 5];
    for (let i = 5; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    order.push(o);
  }
  const plotXZ = p => {
    const { line, fert, rep } = SDATA.ofPlot(p), k = order[rep].indexOf(line * 3 + fert);
    return [(k - 2.5) * (PW + GX), 0, (rep - 1.5) * (PD + GZ)];
  };
  // placeholder: one outline per plot
  const mat = K.fade(set, new THREE.LineBasicMaterial({ color: SLOOK.SOIL.straw, transparent: true }));
  for (let p = 0; p < 24; p++) {
    const [x, , z] = plotXZ(p), h = new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(x - PW / 2, -0.02, z - PD / 2), new THREE.Vector3(x + PW / 2, 0, z + PD / 2)));
    h.material = mat;
    set.group.add(h);
  }
  const anchors = {
    centre: [0, 0, 0], field: [0, 0.35, 0], net: [0, 0.42, 0], under: [0, -0.2, 0.45], jars: [1.3, 0.12, 0], stack: [0, 0.55, -0.95],
    bni: () => plotXZ(SDATA.plot(0, 0, 0)), ctrl: () => plotXZ(SDATA.plot(1, 0, 0)), cloud: [0, 1.3, 0],
  };
  return Object.assign(set, {
    params: { field_a: 1, field_grow: 1, field_date: 0, field_net: 1, field_chl: 0, field_nh4: 0, field_no3: 0, field_jars: 0,
      field_jday: 0, field_inc: 0, field_cores: 0, field_stack: 0, field_module: -1, field_mlit: 0, field_pick: -1, field_tags: 0,
      field_show: 0, field_life: 0 },
    log: [],
    update(S, t, dt) { /* TODO(soil A) */ },
    anchors,
    labels: [],
    cam: {
      default: [-24, 30, 4.2, 0, 0.05, 0], low: [-18, 9, 2.6, 0, 0.12, 0.1], plots: [-30, 40, 2.4, 0, 0, 0],
      under: [-20, 4, 3.2, 0, -0.12, 0], jars: [-55, 16, 1.9, 1.3, 0.15, 0], stack: [-15, 18, 3.4, 0, 0.45, -0.5],
      cloud: [-20, 12, 4.4, 0, 0.8, 0], stand: [0, 2, 0.6, 0, 0.15, 0.55],
    },
    controls: [
      { key: 'view', label: 'View', options: [['default', 'The field'], ['low', 'Among the wheat'], ['under', 'Under the field'], ['jars', 'The jars'], ['stack', 'The samples']] },
      { key: 'date', label: 'Date', options: [['0', 'Day 1'], ['1', 'Day 15'], ['2', 'Day 24'], ['3', 'Day 53'], ['4', 'Day 70']] },
      { key: 'show', label: 'Show', options: [['chl', 'Chlorophyll'], ['nh4', 'Ammonium'], ['no3', 'Nitrate'], ['n2o', 'N2O'], ['ph', 'pH']] },
      { key: 'line', label: 'Wheat', options: [['both', 'Both'], ['0', 'BNI wheat'], ['1', 'Control wheat']] },
      { key: 'fert', label: 'Regime', options: [['all', 'All'], ['0', 'Not fertilised'], ['1', 'Fertilised'], ['2', 'Fertilised + DCD']] },
    ],
    explore(c) {
      // TODO(soil A): the Field pane (SPEC.md); the field grows in from c.t
      return { field_grow: 1, field_date: +c.date || 0, field_net: 1, field_chl: 1, field_no3: c.show === 'no3' ? 1 : 0,
        field_nh4: c.show === 'nh4' ? 1 : 0, field_jars: c.view === 'jars' || c.show === 'n2o' ? 1 : 0, field_jday: +c.date || 0,
        field_inc: K.prog(c.t, 0.5, 6), field_cores: c.view === 'stack' ? 1 : 0, field_stack: c.view === 'stack' ? K.prog(c.t, 0.5, 3) : 0,
        field_tags: 1, field_show: ['chl', 'nh4', 'no3', 'n2o', 'ph'].indexOf(c.show) };
    },
    api() { return { plotXZ, order }; },
  });
};
