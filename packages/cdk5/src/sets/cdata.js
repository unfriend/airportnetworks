// CDATA: CDK5_DATA decoded once, and the lookups the sets and the engine share. No science here: every layout, colour,
// link and number is the authors' (CDK5_DATA, written by data/gen_data.py from their VR project's textures and input
// files) or the generator's documented counts; these only decode the strings and look things up.
// Proteins are indices 0..n-1 (the authors' order, the same in every texture); scenes are by key, in the story's order:
// 'bioproc' (the map of processes), 'subunits' (CDK5 and its activators), 'ntrk2' (Signalling by NTRK2), 'calpain'
// (calpain and CDK5), 'alzheimer' (the Alzheimer's pathway), 'disease' (the disease landscape).
// The story's frame: the authors' 0..1 cube centred on the origin and scaled by SCALE (2.4), so the map of processes is
// a sphere of radius about 1 (the proteins with a GO process at 0.82 to 1.08, the others on an outer shell at 1.2). The
// disease landscape is shifted by LAND_SHIFT, the middle of the bounding box of the proteins with a disease (outliers
// included, so their bulk, median radius 0.27, sits about (0, 0.16, 0.34) from the origin); the 9,838 without a disease
// lie on a sphere of radius 1.2 round the middle of those with one, as in the authors' scene. Each scene's centre (the proteins it pulls into the middle of the map,
// in the authors' spring layouts) is scaled up about CDK5's middle place to radius CENTRE_R, so it can be read; the
// layout's other proteins are where the authors put them.
//   n, e, cdk5, r1, r2, capn1      counts and the four proteins' indices
//   sym[i], find(name)             a protein's gene symbol; an index by symbol (any case), -1 none
//   search(text, max)              indices whose symbol starts with text (then contains it), CDK5 first, at most max
//   nb(i), deg(i)                  a protein's partners (a Uint16Array view, ascending) and how many
//   linked(i, j)                   whether two proteins interact in the interactome
//   bp(i), dis(i)                  has a GO biological process (the sphere's inner shell); has a disease association
//   SCENES                         the scene keys in order; scene(k): { key, title, layout, centre (indices), moved,
//                                  colours ({ name: [indices] }), links ([{ cls, rgba, pairs (Uint16Array, flat) }]) }
//   layout(k)                      a Float32Array(3n): every protein's place in scene k, in the story's frame (cached)
//   base(name)                     the bare layouts, 'sphere' or 'landscape' (Float32Array(3n), cached)
//   colours(k)                     a Float32Array(4n): every protein's RGBA in scene k, 0..1 (the authors' texture)
//   col                            the named colours (RGBA 0..1): grey, greyL, greyD, green, greenL, cyan, red, yellow,
//                                  orange, orangeL
//   pal                            { go, dz } the two palettes by degree ([r, g, b] 0..1, index 0 least linked)
//   gidx, didx                     Uint8Array(n): a protein's class in each palette (255 none)
//   pathways                       { ntrk2, alzheimer }: name, source, members (indices) and, for alzheimer, shown
//   terms                          the Disease Ontology terms offered: [{ id, name, n, genes (Uint16Array), cdk5,
//                                  partners, expP, pP, near, expN, pN }]
//   termsOf(i)                     indices into terms of the terms protein i is in
//   diseases                       { annotated, partnersAnnotated, cdk5Terms (names), partnerTop, near (indices),
//                                  nearTop, method }
//   clouds                         the map of processes' knots: [{ id, name (a GO biological process), size (its proteins
//                                  on the map), n (in its knot), share and fold (how often its proteins' 15 nearest
//                                  neighbours share it, and that against chance), centre ([x, y, z], the knot's middle in
//                                  the story's frame, on the sphere), knot and members (Uint16Array) }], [] without them
//   go                             { release, annotated, source, method } of the GO release the knots are named from, or
//                                  null: the authors' own GO matrix is not in their repository (data/gen_data.py's header)
//   facts                          CDK5_DATA.facts: counts, CDK5's degree and rank, the hub, the CDK family's angles
//                                  from CDK5 on the sphere, the activators' angles, each scene's links, pathway sizes
const CDATA = (() => {
  const D = typeof CDK5_DATA !== 'undefined' ? CDK5_DATA : null;
  if (!D) return null;
  const bytesOf = s => {
    const bin = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  };
  const b64 = (s, Type) => { const b = bytesOf(s); return new Type(b.buffer, 0, b.length / Type.BYTES_PER_ELEMENT); };
  // unsigned varints
  const varints = (b, out) => { let v = 0, sh = 0, k = 0; for (let i = 0; i < b.length; i++) { v += (b[i] & 127) * Math.pow(2, sh); if (b[i] & 128) sh += 7; else { out[k++] = v; v = 0; sh = 0; } } return k; };
  const idxList = s => { const b = bytesOf(s), tmp = new Uint32Array(b.length), k = varints(b, tmp), out = new Uint16Array(k); let a = 0; for (let i = 0; i < k; i++) { a += tmp[i]; out[i] = a; } return out; };
  const n = D.n, SCALE = 2.4, CENTRE_R = 0.42;
  const sym = D.sym.split(',');
  const bySym = new Map(sym.map((s, i) => [s.toUpperCase(), i]));
  const bits = s => { const b = bytesOf(s); return i => (b[i >> 3] >> (i & 7)) & 1; };
  const bp = bits(D.bp), dis = bits(D.dis);
  const gidx = b64(D.gidx, Uint8Array), didx = b64(D.didx, Uint8Array);
  // the interactome: each link once from its lower end in the data; here both ways (CSR)
  const raw = bytesOf(D.adj), vals = new Uint32Array(raw.length), nv = varints(raw, vals);
  const cnt = new Uint32Array(n + 1), lo = [];
  { let p = 0; for (let i = 0; i < n; i++) { const k = vals[p++]; let a = i; for (let j = 0; j < k; j++) { a += vals[p++]; lo.push(i, a); cnt[i]++; cnt[a]++; } } if (p !== nv) throw new Error('CDK5_DATA.adj: bad length'); }
  const off = new Uint32Array(n + 1); for (let i = 0; i < n; i++) off[i + 1] = off[i] + cnt[i];
  const nbs = new Uint16Array(off[n]), fill = off.slice(0, n);
  for (let j = 0; j < lo.length; j += 2) { const a = lo[j], b = lo[j + 1]; nbs[fill[a]++] = b; nbs[fill[b]++] = a; }
  for (let i = 0; i < n; i++) nbs.subarray(off[i], off[i + 1]).sort();
  const nb = i => nbs.subarray(off[i], off[i + 1]);
  const deg = i => off[i + 1] - off[i];
  const linked = (i, j) => { const a = nb(i); let l = 0, h = a.length - 1; while (l <= h) { const m = (l + h) >> 1; if (a[m] === j) return true; if (a[m] < j) l = m + 1; else h = m - 1; } return false; };
  // layouts
  const rgba = c => [c[0] / 255, c[1] / 255, c[2] / 255, c[3] / 255];
  const col = {}; for (const k in D.col) col[k] = rgba(D.col[k]);
  const pal = { go: D.pal.go.map(c => [c[0] / 255, c[1] / 255, c[2] / 255]), dz: D.pal.dz.map(c => [c[0] / 255, c[1] / 255, c[2] / 255]) };
  const bases = {};
  const LAND_SHIFT = [0, 0, 0];
  function base(name) {
    if (bases[name]) return bases[name];
    const u = b64(D.pos[name], Uint16Array), out = new Float32Array(3 * n);
    for (let i = 0; i < 3 * n; i++) out[i] = (u[i] / 65535 - 0.5) * SCALE;
    if (name === 'landscape') {   // centre the proteins with a disease on the origin (their box's middle)
      const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (let i = 0; i < n; i++) if (dis(i)) for (let j = 0; j < 3; j++) { mn[j] = Math.min(mn[j], out[3 * i + j]); mx[j] = Math.max(mx[j], out[3 * i + j]); }
      for (let j = 0; j < 3; j++) LAND_SHIFT[j] = -(mn[j] + mx[j]) / 2;
      for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) out[3 * i + j] += LAND_SHIFT[j];
    }
    return (bases[name] = out);
  }
  const SCN = D.scenes.map(s => ({
    key: s.key, title: s.title, layout: s.layout, centre: s.centre, moved: s.moved, colours: s.colours,
    links: Object.keys(s.links).map(c => ({ cls: c, rgba: col[c], pairs: b64(s.links[c], Uint16Array) })),
    nlinks: s.nlinks, xyz: s.xyz,
  }));
  const byKey = {}; for (const s of SCN) byKey[s.key] = s;
  const SCENES = SCN.map(s => s.key);
  const scene = k => byKey[k];
  const lays = {}, cols = {};
  function layout(k) {
    if (lays[k]) return lays[k];
    const s = byKey[k], out = base(s.layout).slice();
    if (s.moved.length) {
      // the authors' centre places (story frame), scaled up about CDK5's middle place (0.5, 0.5, 0.5 -> the origin)
      const P = s.xyz.map(p => p.map(v => (v / 65535 - 0.5) * SCALE));
      let r = 0; for (const p of P) r = Math.max(r, Math.hypot(p[0], p[1], p[2]));
      const f = r > 0 ? CENTRE_R / r : 1;
      s.moved.forEach((i, j) => { for (let a = 0; a < 3; a++) out[3 * i + a] = P[j][a] * f; });
      s.fit = f;
    }
    return (lays[k] = out);
  }
  function colours(k) {
    if (cols[k]) return cols[k];
    const s = byKey[k], out = new Float32Array(4 * n);
    const grey = col[{ bioproc: 'grey', subunits: 'greyL', ntrk2: 'greyL', calpain: 'greyD' }[k] || 'greyD'];
    const dzs = k === 'alzheimer' || k === 'disease';
    for (let i = 0; i < n; i++) {
      let c;
      if (!dzs) c = bp(i) ? [...pal.go[gidx[i]], 100 / 255] : grey;
      else c = dis(i) ? [...pal.dz[didx[i]], 90 / 255] : grey;
      out.set(c, 4 * i);
    }
    for (const name in s.colours) for (const i of s.colours[name]) out.set(col[name], 4 * i);
    return (cols[k] = out);
  }
  function find(name) { const i = bySym.get(String(name || '').trim().toUpperCase()); return i === undefined ? -1 : i; }
  function search(text, max = 12) {
    const q = String(text || '').trim().toUpperCase(); if (!q) return [];
    const a = [], b = [];
    for (let i = 0; i < n && a.length < max; i++) { const s = sym[i].toUpperCase(); if (s.startsWith(q)) a.push(i); else if (b.length < max && s.includes(q)) b.push(i); }
    const out = a.concat(b).slice(0, max);
    out.sort((x, y) => (x === D.cdk5 ? -1 : y === D.cdk5 ? 1 : (sym[x].toUpperCase() === q ? -1 : sym[y].toUpperCase() === q ? 1 : sym[x].length - sym[y].length || (sym[x] < sym[y] ? -1 : 1))));
    return out;
  }
  const terms = D.diseases.terms.map(t => Object.assign({}, t, { genes: idxList(t.genes) }));
  let tOf = null;
  function termsOf(i) {
    if (!tOf) { tOf = new Map(); terms.forEach((t, j) => { for (const g of t.genes) { if (!tOf.has(g)) tOf.set(g, []); tOf.get(g).push(j); } }); }
    return tOf.get(i) || [];
  }
  const clouds = (D.clouds || []).map(c => Object.assign({}, c, { knot: idxList(c.knot), members: idxList(c.members) }));
  const pathways = D.pathways;
  return {
    n, e: D.e, cdk5: D.cdk5, r1: D.r1, r2: D.r2, capn1: D.capn1, SCALE, CENTRE_R, LAND_SHIFT,
    sym, find, search, nb, deg, linked, bp, dis, SCENES, scene, layout, base, colours, col, pal, gidx, didx,
    pathways, terms, termsOf, diseases: D.diseases, facts: D.facts, about: D.about, clouds, go: D.go || null,
  };
})();
if (typeof module !== 'undefined') module.exports = CDATA;
