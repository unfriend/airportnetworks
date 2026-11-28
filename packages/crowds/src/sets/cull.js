// The culling's sums on the grid, apart from three.js so node can test them (src/test-cull.mjs). The balls are sorted
// into G x G x G cells (index i + G * (j + G * k)); each cell has an opacity, how much of a line of sight one cell long
// its balls block on average: count * pi * mean(r^2) / h^2, the optical depth of balls scattered at random (a line
// through a cloud of n balls a unit volume, each of cross-section s, meets on average n * s of them a unit length).
const CULL = (() => {
  // each cell's opacity -> the least of its 3 x 3 x 3 neighbourhood, outside the grid counting as empty: a line of sight
  // that only grazes a cell, or runs along the cube's skin, is never credited with more than its thinnest neighbour
  function erode(op, G) {
    const out = new Float32Array(G * G * G);
    for (let k = 0; k < G; k++) for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      let m = Infinity;
      for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const x = i + di, y = j + dj, z = k + dk;
        const v = x < 0 || y < 0 || z < 0 || x >= G || y >= G || z >= G ? 0 : op[x + G * (y + G * z)];
        if (v < m) m = v;
      }
      out[i + G * (j + G * k)] = m;
    }
    return out;
  }
  // tau[c]: the least optical depth in front of cell c as seen from the eye e (in cell units, [x, y, z], anywhere): a
  // sweep outwards from the eye's cell, each cell taking the least of its neighbours one step towards the eye (along
  // any of the axes on which the eye lies beyond it: the 26-neighbour steps a line of sight from the eye to any point of
  // the cell can take) plus that neighbour's opacity; a neighbour outside the grid gives 0 (nothing in front). As many
  // steps as the larger of a line's spans in cells is never more than its length in cells, so on an even crowd this is
  // a lower bound on every line of sight into the cell; uneven ones are covered by the eroded opacity. O(cells).
  function sweep(op, G, e, tau) {
    const ei = [Math.floor(e[0]), Math.floor(e[1]), Math.floor(e[2])], ord = [], st = [];
    for (let a = 0; a < 3; a++) {
      const c = Math.min(G - 1, Math.max(0, ei[a])), o = [c], s = new Int8Array(G);
      for (let d = 1; d < G; d++) { if (c - d >= 0) o.push(c - d); if (c + d < G) o.push(c + d); }
      for (let i = 0; i < G; i++) s[i] = i === ei[a] ? 0 : i < ei[a] ? 1 : -1;
      ord.push(o); st.push(s);
    }
    const [ox, oy, oz] = ord, [sx, sy, sz] = st;
    for (const k of oz) for (const j of oy) for (const i of ox) {
      const dx = sx[i], dy = sy[j], dz = sz[k], c = i + G * (j + G * k);
      if (!dx && !dy && !dz) { tau[c] = 0; continue; }
      let m = Infinity;
      for (let b = 1; b < 8; b++) {
        const x = i + (b & 1 ? dx : 0), y = j + (b & 2 ? dy : 0), z = k + (b & 4 ? dz : 0);
        if ((b & 1 && !dx) || (b & 2 && !dy) || (b & 4 && !dz)) continue;
        if (x < 0 || y < 0 || z < 0 || x >= G || y >= G || z >= G) { m = 0; break; }
        const p = x + G * (y + G * z), v = tau[p] + op[p];
        if (v < m) m = v;
      }
      tau[c] = m;
    }
    return tau;
  }
  // how deep a cell must lie (in optical depth) to be left out as hidden: a line of sight through a random crowd gets
  // through depth tau with chance exp(-tau), and the eroded opacity and the step count both err the safe way
  // (src/test-cull.mjs casts rays to check that no first hit is in a hidden cell). A packed crowd is not random: its
  // molecules leave channels between them, and at 12 the sweep found a hole of some 170 pixels inside a million balls
  // (a ball seen through a channel between near ones), so 18 (none found; src/README.md, "What the sweep says")
  const TAU = 18;
  return { erode, sweep, TAU };
})();
if (typeof module !== 'undefined') module.exports = CULL;
