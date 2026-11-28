// The culling's sums on the grid, apart from three.js so node can test them (src/test-cull.mjs). The balls are sorted
// into G x G x G cells (index i + G * (j + G * k)); each cell has an opacity, how much of a line of sight one cell long
// its balls block on average: count * pi * mean(r^2) * shadow / h^2, the optical depth of things scattered at random (a
// line through a cloud of n things a unit volume, each hiding an area s, meets on average n * s of them a unit length).
// shadow: 1 for the made-up cloud (lone balls); for the packed crowd each kind's share of its balls' discs that its
// molecule really hides (its balls overlap one another: CROWDS.shadow), so the count is of molecules, not balls.
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
  // (the sweep's orders and steps, kept for the grid's size: nothing is made a frame)
  const SC = { G: 0, o: null, s: null };
  // tau[c]: the least optical depth in front of cell c as seen from the eye e (in cell units, [x, y, z], anywhere): a
  // sweep outwards from the eye's cell, each cell taking the least of its neighbours one step towards the eye (along any
  // of the axes on which the eye lies beyond it: the 26-neighbour steps a line of sight from the eye to any point of the
  // cell can take) plus that neighbour's opacity. A neighbour outside the grid gives 0 (nothing in front), and so does
  // the eye's own cell: the eye may stand at its far face, so a line leaving it need cross none of it. Why it is a lower
  // bound: a line from the eye to a cell D steps away (the most cells it moves along any one axis) crosses D - 1 whole
  // slabs of cells between them along that axis, each for at least a cell's length, and within a slab it stays inside
  // the 3 x 3 x 3 neighbourhood of a cell of some chain of steps, so the least over every chain, each step charged its
  // cell's eroded (least of the neighbourhood) opacity, is never more than the line's own depth on an even crowd.
  // (A ball of the cell may reach out of it by its radius, a few hundredths of a cell: what that shortens is in the
  // threshold's margin.) O(cells), allocating nothing.
  function sweep(op, G, e, tau) {
    if (SC.G !== G) SC.G = G, SC.o = [new Int16Array(G), new Int16Array(G), new Int16Array(G)], SC.s = [new Int8Array(G), new Int8Array(G), new Int8Array(G)];
    const ex = Math.floor(e[0]), ey = Math.floor(e[1]), ez = Math.floor(e[2]);
    for (let a = 0; a < 3; a++) {
      const ea = a === 0 ? ex : a === 1 ? ey : ez, c = Math.min(G - 1, Math.max(0, ea)), o = SC.o[a], s = SC.s[a];
      let n = 0;
      o[n++] = c;
      for (let d = 1; d < G; d++) { if (c - d >= 0) o[n++] = c - d; if (c + d < G) o[n++] = c + d; }
      for (let i = 0; i < G; i++) s[i] = i === ea ? 0 : i < ea ? 1 : -1;
    }
    const inGrid = ex >= 0 && ey >= 0 && ez >= 0 && ex < G && ey < G && ez < G, eyeC = inGrid ? ex + G * (ey + G * ez) : -1;
    const [ox, oy, oz] = SC.o, [sx, sy, sz] = SC.s;
    for (let kk = 0; kk < G; kk++) for (let jj = 0; jj < G; jj++) for (let ii = 0; ii < G; ii++) {
      const i = ox[ii], j = oy[jj], k = oz[kk], dx = sx[i], dy = sy[j], dz = sz[k], c = i + G * (j + G * k);
      if (!dx && !dy && !dz) { tau[c] = 0; continue; }
      let m = Infinity;
      for (let b = 1; b < 8; b++) {
        if ((b & 1 && !dx) || (b & 2 && !dy) || (b & 4 && !dz)) continue;
        const x = i + (b & 1 ? dx : 0), y = j + (b & 2 ? dy : 0), z = k + (b & 4 ? dz : 0);
        if (x < 0 || y < 0 || z < 0 || x >= G || y >= G || z >= G) { m = 0; break; }
        const p = x + G * (y + G * z), v = tau[p] + (p === eyeC ? 0 : op[p]);
        if (v < m) m = v;
      }
      tau[c] = m;
    }
    return tau;
  }
  // how deep a cell must lie (in optical depth) to be left out as hidden, from what it means: a line of sight through a
  // random crowd gets through depth tau with chance exp(-tau) at most, and no more lines end in hidden cells than there
  // are pixels, so with tau = ln(pixels / EPS) the pixels wrongly left empty number EPS a frame at most, on average
  // (both eyes' pixels in a headset: a 1280 x 800 page gives about 18.4, a Quest's two eyes about 20.3). The bound holds
  // for a random crowd (src/test-cull.mjs casts rays into random and packed ones to check it); a packed crowd's
  // molecules are not random (their balls overlap, which the shadow share takes out; they leave channels between them),
  // so it is a well-founded rule there, checked by pictures, not a proof.
  const EPS = 0.01, tauFor = px => Math.log(Math.max(1, px) / EPS);
  return { erode, sweep, tauFor, EPS };
})();
if (typeof module !== 'undefined') module.exports = CULL;
