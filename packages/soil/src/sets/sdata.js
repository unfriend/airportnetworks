// SDATA: SOIL_DATA decoded once, and the lookups the sets and the engine share. No science here: every number is the
// trial's (SOIL_DATA, written by data/gen_data.py) or read off the slides (SOIL_DATA.figs); these only decode the typed
// arrays and look things up by the design's indices.
// Indices (the same everywhere): line 0 BNI, 1 control; fert 0 not fertilised (N), 1 fertilised (F), 2 fertilised + DCD
// (S); time 0..4 the five sampling dates (T1..T5); rep 0..3 the replicate, which the field draws as its block (a row);
// a group g = (line * 3 + fert) * 5 + time (30); a sample's slot s = g * 4 + rep (120; the missing sample's is null in
// every per-sample list: SOIL_DATA.src.missing.slot); a plot p = (line * 3 + fert) * 4 + rep (24).
//   b64(str, Type)              a base64 string as a typed array
//   group(line, fert, time), slot(line, fert, time, rep), plot(line, fert, rep), ofGroup(g), ofSlot(s), ofPlot(p)
//   missing                     the missing sample's slot (BNI, fertilised + DCD, T4, rep 0)
//   meta(key, line, fert, time) { mean, sd, n } of a field measure (nh4, no3, n2o, chl, ph, water) in a group
//   value(key, s)               a sample's own value (null where it was not measured)
//   lineTest(key, fert, time)   [mean BNI, mean control, p] (time -1: the whole season)
//   phylumShare(g, i)           % of reads of phylum i (SOIL_DATA.phyla.names) in group g
//   guild(key, g)               % of reads of a nitrifier guild (SOIL_DATA.guilds.keys) in group g
//   cloud                       n, rank (Int32Array, 1 = most abundant), phy, prev, guild (Uint8Array), ab (Float32Array:
//                               log10 of the mean share of reads)
//   common                      n, idx (Uint16Array: cloud index), flags (Uint8Array: 1 fertiliser, 2 date, 4 line, 8 plot),
//                               cls, fam, gen (Uint16Array into SOIL_DATA.common.names), name(i) (genus, or "unnamed
//                               <family or class>")
//   net                         n, node (Uint16Array: common index), cloudOf(i) (the node's cloud index), mod (Uint8Array,
//                               255 none), deg (Uint16Array), xyz (Float32Array x 3, the stored layout, radius about 1),
//                               links (number), ij (Uint16Array pairs, strongest first), rho (Float32Array), split
//                               (Uint8Array bits: SOIL_DATA.net.splitBits), cut(rho) (how many of the strongest links have
//                               |rho| >= rho: exact at the stored cuts 0.6, 0.65, 0.7, 0.75, 0.8; between them counted on the
//                               stored rho, to 1/127), members(m) (the nodes of module m), score(m, s), share(m, g)
//   n2o(day, fert, line)        the incubation curve read off slide 7: [v at each of SOIL_DATA.figs.n2o.times] (ppm)
//   qpcr(kind, fert, day, line) { v, err } read off slide 9 (kind 'aoa' or 'aob'; copies per g dry soil)
//   chl70(fert, line)           { v, err } read off slide 6: chlorophyll on day 70
const SDATA = (() => {
  const D = typeof SOIL_DATA !== 'undefined' ? SOIL_DATA : null;
  const b64 = (s, Type) => {
    const bin = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Type(bytes.buffer, 0, bytes.length / Type.BYTES_PER_ELEMENT);
  };
  const group = (line, fert, time) => (line * 3 + fert) * 5 + time;
  const slot = (line, fert, time, rep) => group(line, fert, time) * 4 + rep;
  const plot = (line, fert, rep) => (line * 3 + fert) * 4 + rep;
  const ofGroup = g => ({ line: Math.floor(g / 15), fert: Math.floor(g / 5) % 3, time: g % 5 });
  const ofSlot = s => Object.assign(ofGroup(Math.floor(s / 4)), { rep: s % 4 });
  const ofPlot = p => ({ line: Math.floor(p / 12), fert: Math.floor(p / 4) % 3, rep: p % 4 });
  if (!D) return { b64, group, slot, plot, ofGroup, ofSlot, ofPlot };
  const M = D.meta;
  const meta = (key, line, fert, time) => { const g = group(line, fert, time), m = M[key]; return { mean: m.mean[g], sd: m.sd[g], n: m.n[g] }; };
  const value = (key, s) => M[key].values[s];
  const lineTest = (key, fert, time) => (time < 0 ? M[key].line.byFert[fert] : M[key].line.byGroup[fert * 5 + time]);
  const phylumShare = (g, i) => D.phyla.group[g][i];
  const guild = (key, g) => D.guilds[key].group[g];
  // the cloud
  const C = D.cloud, steps = b64(C.rank, Uint8Array), rank = new Int32Array(C.n);
  for (let i = 0, r = 0; i < C.n; i++) { r += steps[i]; rank[i] = r; }
  const abq = b64(C.ab, Uint8Array), ab = new Float32Array(C.n), [a0, a1] = C.abRange;
  for (let i = 0; i < C.n; i++) ab[i] = a0 + (a1 - a0) * abq[i] / 255;
  const cloud = { n: C.n, of: C.of, rank, ab, phy: b64(C.phy, Uint8Array), prev: b64(C.prev, Uint8Array), guild: b64(C.guild, Uint8Array) };
  // the common kinds
  const CM = D.common, cls = b64(CM.cls, Uint16Array), fam = b64(CM.fam, Uint16Array), gen = b64(CM.gen, Uint16Array);
  const name = i => (gen[i] ? CM.names.gen[gen[i]] : fam[i] ? `unnamed ${CM.names.fam[fam[i]]}` : cls[i] ? `unnamed ${CM.names.cls[cls[i]]}` : 'unnamed');
  const common = { n: CM.n, idx: b64(CM.idx, Uint16Array), flags: b64(CM.flags, Uint8Array), cls, fam, gen, name };
  // the network
  const N = D.net, node = b64(N.node, Uint16Array), xq = b64(N.xyz, Int16Array), xyz = new Float32Array(xq.length);
  for (let i = 0; i < xq.length; i++) xyz[i] = xq[i] * N.xyzScale;
  const wq = b64(N.w, Int8Array), rho = new Float32Array(wq.length);
  for (let i = 0; i < wq.length; i++) rho[i] = wq[i] * N.wScale;
  const mod = b64(N.mod, Uint8Array);
  function cut(r) {
    for (const [x, n] of N.cuts) if (Math.abs(x - r) < 1e-6) return n;
    let n = 0;
    while (n < rho.length && Math.abs(rho[n]) >= r - 1e-6) n++;
    return n;
  }
  const members = m => { const out = []; for (let i = 0; i < mod.length; i++) if (mod[i] === m) out.push(i); return out; };
  const net = { n: N.n, node, cloudOf: i => common.idx[node[i]], mod, deg: b64(N.deg, Uint16Array), xyz, links: N.links,
    ij: b64(N.ij, Uint16Array), rho, split: b64(N.split, Uint8Array), cut, members,
    score: (m, s) => N.mods[m].score[s], share: (m, g) => N.mods[m].share[g] };
  // the slides' readings
  const F = D.figs;
  const n2o = (day, fert, line) => F.n2o.curves[day][fert][line];
  const qpcr = (kind, fert, day, line) => F.qpcr[kind][fert][day][line];
  const chl70 = (fert, line) => F.chl70[fert][line];
  return { b64, group, slot, plot, ofGroup, ofSlot, ofPlot, missing: D.src.missing.slot, meta, value, lineTest, phylumShare, guild,
    cloud, common, net, n2o, qpcr, chl70 };
})();
if (typeof module !== 'undefined') module.exports = SDATA;
