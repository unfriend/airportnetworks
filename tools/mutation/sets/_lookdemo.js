// Throwaway: shows MLOOK's pieces for a look check (deleted after).
SETS._lookdemo = function (K) {
  const set = K.newSet('_lookdemo'), LK = MLOOK(K, set);
  const tubes = LK.tubes(64), rings = LK.rings(64), balls = LK.balls(64), halos = LK.halos(64), cones = LK.cones(32), glass = LK.glass(16), tiles = LK.tiles(32), gears = LK.gears(8);
  for (const P of [tubes, rings, balls, halos, cones, glass, tiles, gears]) set.group.add(P.mesh);
  const Qp = { glass, rings, tubes, cones, balls, halos };
  const q = [0, 0, 0, 1], qb = [0, 0, 0, 1], PAIR = { pair: true }, tip = [0, 0, 0];
  const codes = [[1, 1], [1, -1], [-1, 1], [-1, -1]], b3 = [0, 0, 0];
  const O0 = {}, O1 = { col: LK.GREENLIT, glow: 0.6, tip };
  return Object.assign(set, {
    params: { _lookdemo_a: 1, _lookdemo_turn: 0 },
    update(S, t) {
      LK.depth();
      for (const P of [tubes, rings, balls, halos, cones, glass, tiles, gears]) P.begin();
      // tiles A C G T: A turned a little, C framed, G seen from behind (glowing), T facing the camera; a small '?'
      LK.quat(q, [0, 1, 0], 0.35);
      tiles.add([-0.9, 0.85, 0], q, 0.32, 0, 1);
      tiles.add([-0.3, 0.85, 0], q, 0.32, 1, 1, 1);
      tiles.add([0.9, 0.85, 0], null, 0.32, 3, 1);
      LK.quat(qb, [0, 1, 0], Math.PI + 0.45 + S._lookdemo_turn * t);
      tiles.add([0.3, 0.85, 0], qb, 0.32, 2, 1, 0, 0.5);
      tiles.add([1.4, 0.85, 0], q, 0.2, 4, 1);
      // under each tile its two qubits (the code)
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
        b3[0] = 0; b3[1] = 0; b3[2] = codes[i][j];
        LK.qubit(Qp, [-0.9 + 0.6 * i + (j ? 0.13 : -0.13), 0.3, 0], 0.11, b3, 1, O0);
      }
      // a tilted, shortened one
      LK.qubit(Qp, [-1.35, -0.45, 0], 0.3, [0.5, 0, 0.38], 1, O1);
      // two gears meshing, the second the coupling one
      const R = 0.3, a = 0.5 + t * 0.6;
      gears.add([-0.55, -0.45, 0], [0, 0, 1], R, a, LK.BLUE, 1);
      gears.add([-0.55 + 1.8 * R, -0.45, 0], [0, 0, 1], R, -a + gears.pitch / 2, LK.BLUE, 1, PAIR);
      gears.add([0.62, -0.75, -0.2], [0.5, 0.6, 0.6], 0.16, a, LK.GREEN, 1);
      // arrows
      const AR = [[[0.9, -0.2, 0], [1, 0.3, 0], LK.CYAN], [[0.9, -0.45, 0], [1, 0, 0.6], LK.GREENLIT], [[0.9, -0.7, 0], [1, -0.4, 0], LK.RED]];
      for (const [p, d, c] of AR) {
        const l = Math.hypot(d[0], d[1], d[2]), e = [p[0] + d[0] / l * 0.45, p[1] + d[1] / l * 0.45, p[2] + d[2] / l * 0.45];
        tubes.add(p, e, 0.014, c, 1);
        cones.add(e, d, 0.09, 0.035, c, 1);
      }
      halos.add(tip, 0.1, LK.GREENLIT, 0.3);
      for (const P of [tubes, rings, balls, halos, cones, glass, tiles, gears]) P.end();
    },
    anchors: { a: [-0.9, 1.08, 0] },
    labels: [{ text: ['A', ' · |00⟩'], at: 'a', cls: 'cyn' }],
    cam: {
      default: [0, 8, 4.4, 0.05, 0.12, 0],
      tiles: [-30, 10, 2.0, 0.25, 0.8, 0],
      gears: [25, 30, 1.7, -0.28, -0.45, 0],
      qubit: [20, 15, 1.5, -1.35, -0.45, 0],
    },
    controls: [],
    explore() { return {}; },
  });
};
