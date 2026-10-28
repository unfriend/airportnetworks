// TDATA: TOPO_DATA decoded once, and the lookups the sets and the engine share. No science here: every number is
// topocyte's (TOPO_DATA, written by data/gen_data.py); these only decode, filter by stored radius, count stored bars and
// add stored shares. Radii are in µm throughout.
//   b64(str, Type)        a base64 string as a typed array
//   r(code)               a one-byte radius: 0.5 x 240^(code / 255) µm (255: 120 µm or more)
//   u(r), rOf(u)          the poster's log ruler of r (1.5 to 60 µm) as 0..1 and back (u may run outside 0..1)
//   height(r)             the tower's height for a radius: u(r) clamped to 0..1
//   betti(bars, r)        how many of the stored bars [birth, death, birth, death, ...] are alive at r (birth <= r < death)
//   deaths(list, r)       how many of the stored death radii (pieces born at 0) are still alive at r: those above r
//   share(dim, r0, r1)    the sum of the stored fine shares of the windows from r0 to r1 (dim 0 or 1; r1 Infinity for
//                         "and above"; both on the 0.5 µm grid of TOPO_DATA.h<dim>.shares.edges)
//   colour(lo, limit, out) the poster's map colour (RdBu_r, its 11 stops) for a log-odds, as [r, g, b] in 0..1
//   TYPES                 the legend's colours by cell type name; typeColour(name)
//   patch, tile, slide    decoded: x, y (Float32Array, µm), type (Uint8Array), and for the slide lo50, lo100
//                         (Float32Array, NaN where a cell has no local curve), the complex (edges: i, j, r; tris: i, j,
//                         k, r) and each cell's own bars (localH0(i) -> radii at which its pieces join; localH1(i) ->
//                         [birth, death, ...])
const TDATA = (() => {
  const D = typeof TOPO_DATA !== 'undefined' ? TOPO_DATA : null;
  const b64 = (s, Type) => {
    const bin = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Type(bytes.buffer, 0, bytes.length / Type.BYTES_PER_ELEMENT);
  };
  const [RLO, RHI] = D ? D.src.rcode : [0.5, 120], RK = Math.log(RHI / RLO) / 255;
  const r = c => (c >= 255 ? Infinity : RLO * Math.exp(c * RK));
  const [ULO, UHI] = D ? D.src.ruler : [1.5, 60], UK = Math.log(UHI / ULO);
  const u = x => Math.log(x / ULO) / UK, rOf = v => ULO * Math.exp(v * UK);
  const height = x => (x <= 0 ? 0 : Math.min(1, Math.max(0, u(x))));
  const betti = (bars, x) => { let n = 0; for (let i = 0; i < bars.length; i += 2) if (bars[i] <= x && x < bars[i + 1]) n++; return n; };
  const deaths = (list, x) => { let n = 0; for (let i = 0; i < list.length; i++) if (list[i] > x) n++; return n; };
  function share(dim, r0, r1) {
    const S = D[dim ? 'h1' : 'h0'].shares, E = S.edges;
    let s = 0;
    for (let i = 0; i < S.delta.length; i++) {
      const lo = E[i], hi = E[i + 1] === null ? Infinity : E[i + 1];
      if (lo >= r0 - 1e-9 && hi <= r1 + 1e-9) s += S.delta[i];
    }
    return s;
  }
  const STOPS = ['053061', '2065AB', '4393C3', '90C4DD', 'D1E5F0', 'F7F6F6', 'FDDBC7', 'F3A481', 'D6604D', 'B1182B', '67001F']
    .map(h => [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]);
  function colour(lo, limit, out) {
    out = out || [0, 0, 0];
    const f = Math.min(1, Math.max(0, (lo / limit + 1) / 2)) * (STOPS.length - 1), k = Math.min(STOPS.length - 2, Math.floor(f)), w = f - k;
    for (let j = 0; j < 3; j++) out[j] = STOPS[k][j] * (1 - w) + STOPS[k + 1][j] * w;
    return out;
  }
  const TYPES = { 'Fibroblasts': '#2e9e57', 'Apoptotic Body': '#d4c34a', 'Epithelial': '#9b59b6', 'Lymphocytes': '#3f8fd6',
    'Cancer cell': '#a8a8b8', 'other': '#d8d8d8' };
  const typeColour = name => TYPES[name] || TYPES.other;
  function cells(src) {
    const xy = b64(src.xy, Int16Array), n = xy.length / 2, x = new Float32Array(n), y = new Float32Array(n);
    for (let i = 0; i < n; i++) { x[i] = xy[2 * i] / 10; y[i] = xy[2 * i + 1] / 10; }
    return { n, x, y, type: b64(src.type, Uint8Array), types: src.types };
  }
  const out = { D, b64, r, u, rOf, height, betti, deaths, share, STOPS, colour, TYPES, typeColour };
  if (!D) return out;
  const P = D.patch;
  out.patch = { n: P.pts.length / 2, x: Float32Array.from(P.pts.filter((_, i) => i % 2 === 0)),
    y: Float32Array.from(P.pts.filter((_, i) => i % 2 === 1)), side: P.side };
  out.tile = cells(D.tile);
  const S = D.slide, sl = out.slide = cells(S);
  const lo = (s) => { const a = b64(s, Int16Array), f = new Float32Array(a.length); for (let i = 0; i < a.length; i++) f[i] = a[i] === -32768 ? NaN : a[i] / 100; return f; };
  sl.lo50 = lo(S.lo50); sl.lo100 = lo(S.lo100);
  const ij = b64(S.edges.ij, Uint16Array), er = b64(S.edges.r, Uint8Array), ijk = b64(S.tris.ijk, Uint16Array), tr = b64(S.tris.r, Uint8Array);
  sl.edges = { n: S.edges.n, i: new Uint16Array(S.edges.n), j: new Uint16Array(S.edges.n), r: new Float32Array(S.edges.n) };
  for (let e = 0; e < S.edges.n; e++) { sl.edges.i[e] = ij[2 * e]; sl.edges.j[e] = ij[2 * e + 1]; sl.edges.r[e] = r(er[e]); }
  sl.tris = { n: S.tris.n, i: new Uint16Array(S.tris.n), j: new Uint16Array(S.tris.n), k: new Uint16Array(S.tris.n), r: new Float32Array(S.tris.n) };
  for (let t = 0; t < S.tris.n; t++) { sl.tris.i[t] = ijk[3 * t]; sl.tris.j[t] = ijk[3 * t + 1]; sl.tris.k[t] = ijk[3 * t + 2]; sl.tris.r[t] = r(tr[t]); }
  const off0 = b64(S.local.off0, Uint32Array), h0 = b64(S.local.h0, Uint8Array), off1 = b64(S.local.off1, Uint32Array), h1 = b64(S.local.h1, Uint8Array);
  sl.localH0 = i => { const a = []; for (let k = off0[i]; k < off0[i + 1]; k++) a.push(r(h0[k])); return a; };
  sl.localH1 = i => { const a = []; for (let k = 2 * off1[i]; k < 2 * off1[i + 1]; k++) a.push(r(h1[k])); return a; };
  return out;
})();
if (typeof module !== 'undefined') module.exports = TDATA;
