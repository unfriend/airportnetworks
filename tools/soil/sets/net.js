// net: the soil's microbes as a deep cloud (20,000 kinds: the common ones in a bright core, the rare ones a faint shell,
// coloured by phylum), the nitrifiers flaring, the co-occurrence network of 1,564 kinds and 22,348 links pulling out of
// the core, a shuffle dissolving it, its modules in colour, and the two wheat lines' networks side by side (and a
// random split's). Drawn in the field set's frame, floating over the field. Real numbers from SOIL_DATA (SDATA).
// Adapted from the endotype story's net set (tools/endo/sets/net.js: the cloud with its core and shell, the glowing
// seeds, the module pulling out, the colours, the focus and picking), without its walkers, heat and k.
// TODO(soil B): a stub that keeps the contract of SPEC.md ("The sets": net): its params, anchors, views, controls, api
// and explore hook are final unless the SPEC changes; build the scene from a copy of tools/endo/sets/net.js.
SETS.net = function (K) {
  const { THREE } = K;
  const set = K.newSet('net');
  const C = [0, 1.3, 0];   // the cloud's centre, over the field (the field set's frame)
  // placeholder: the network's stored layout as points
  const N = SDATA.net, g = new THREE.BufferGeometry(), p = new Float32Array(N.n * 3);
  for (let i = 0; i < N.n; i++) for (let j = 0; j < 3; j++) p[3 * i + j] = C[j] + 0.6 * N.xyz[3 * i + j];
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  set.group.add(new THREE.Points(g, K.fade(set, new THREE.PointsMaterial({ color: SLOOK.UI.cyan, size: 0.012, transparent: true }))));
  const anchors = { cloud: C, core: C, top: [0, 2.0, 0], net: C, left: [-0.6, 1.3, 0], right: [0.6, 1.3, 0], pick: [0, 1.3, 0] };
  return Object.assign(set, {
    params: { net_a: 1, net_cloud: 1, net_nitro: 0, net_pull: 0, net_links: 0, net_shuffle: 0, net_mods: 0, net_rho: 0.6,
      net_focus: -1, net_split: 0, net_splitBy: 0, net_kind: -1 },
    log: [],
    update(S, t, dt) { /* TODO(soil B) */ },
    anchors,
    labels: [],
    cam: { default: [-20, 12, 4.4, 0, 1.3, 0], cloud: [-20, 12, 4.4, 0, 1.3, 0], core: [-15, 8, 2.4, 0, 1.3, 0],
      net: [-12, 10, 2.6, 0, 1.3, 0], module: [-12, 20, 3.6, 0, 0.8, 0], split: [0, 8, 3.2, 0, 1.3, 0], over: [-24, 38, 4.6, 0, 0.6, 0] },
    controls: [
      { key: 'view', label: 'View', options: [['cloud', 'The crowd'], ['net', 'The network'], ['split', 'Split']] },
      { key: 'colour', label: 'Colour', options: [['phylum', 'Phylum'], ['module', 'Module'], ['guild', 'Nitrifiers']] },
      { key: 'by', label: 'Split by', options: [['line', 'Wheat line'], ['fert', 'Fertiliser'], ['random', 'At random']] },
    ],
    explore(c) {
      // TODO(soil B): the Microbes and Network panes (SPEC.md)
      const net = c.view !== 'cloud';
      return { net_cloud: 1, net_nitro: c.colour === 'guild' ? 1 : 0, net_pull: net ? K.prog(c.t, 0, 2) : 0, net_links: net ? 1 : 0,
        net_shuffle: 0, net_mods: c.colour === 'module' ? 1 : 0, net_split: c.view === 'split' ? 1 : 0,
        net_splitBy: { line: 0, fert: 1, random: 2 }[c.by] || 0 };
    },
    api() { return { centre: C }; },
  });
};
