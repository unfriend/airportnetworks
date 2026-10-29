// Checks that SDATA decodes SOIL_DATA and that the data holds the numbers the story tells. No science: the numbers are
// the trial's (sets/data.js, written by data/gen_data.py) or read off the slides (data/figures.json); this only checks that
// the data, its decoders and the story's key numbers agree.
// usage (from the repository root): node tools/soil/test-data.mjs
import fs from 'fs';
import path from 'path';
import vm from 'vm';
const here = path.dirname(new URL(import.meta.url).pathname);
const src = fs.readFileSync(path.join(here, 'sets/data.js'), 'utf8');
const ctx = { Buffer, console };
vm.createContext(ctx);
vm.runInContext(src + '\nthis.SOIL_DATA = SOIL_DATA;', ctx);
vm.runInContext(fs.readFileSync(path.join(here, 'sets/sdata.js'), 'utf8').replace("if (typeof module !== 'undefined') module.exports = SDATA;\n", '') + '\nthis.SDATA = SDATA;', ctx);
vm.runInContext(fs.readFileSync(path.join(here, 'sets/look.js'), 'utf8') + '\nthis.SLOOK = SLOOK;', ctx);
const { SOIL_DATA: D, SDATA: S, SLOOK: L } = ctx;
let fails = 0;
const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails++; };
const near = (a, b, e = 0.006) => Math.abs(a - b) <= e;
const N = D.net;

// size and privacy
ok(src.length < 500 * 1024, `the data block is ${(src.length / 1024).toFixed(0)} KB (under 500)`);
const strings = [];
(function walk(x) { if (typeof x === 'string') strings.push(x); else if (x && typeof x === 'object') for (const k in x) walk(x[k]); })(D);
ok(!/ASV_\d/.test(src) && !strings.some(x => /^[ACGTU]{30,}$/.test(x)), 'no ASV ids and no sequences in the data');
ok(!/@/.test(src), 'no e-mail addresses in the data');

// the table and the design
ok(D.src.samples === 119 && D.src.kinds === 100116, `119 samples, 100,116 kinds (${D.src.samples}, ${D.src.kinds})`);
ok(D.design.n.reduce((a, b) => a + b, 0) === 119 && D.design.n.length === 30, '30 groups holding 119 samples');
const m = D.src.missing;
ok(m.line === 0 && m.fert === 2 && m.time === 3 && m.rep === 0 && S.missing === m.slot && m.slot === S.slot(0, 2, 3, 0),
  'the missing sample: BNI, fertilised + DCD, T4, replicate 1');
ok(D.design.n[S.group(0, 2, 3)] === 3, 'its group has 3 samples');
for (const k of ['nh4', 'no3', 'n2o', 'chl', 'ph', 'water']) {
  const v = D.meta[k].values;
  ok(v.length === 120 && v[S.missing] === null, `${k}: 120 slots, the missing one null`);
}
ok(D.meta.nh4.values.filter(x => x !== null).length === 119 && D.meta.n2o.values.filter(x => x !== null).length === 119, 'ammonium and N2O for every sample');
ok(D.meta.ph.values.filter(x => x !== null).length === 72, 'pH for 72 samples (T2, T3, T5)');
ok(D.design.times.map(t => t.dap).join() === '129,144,153,182,199' && D.design.times.map(t => t.day).join() === '1,15,24,53,70',
  'the dates: days 129 to 199 after planting; the slides\' days 1 to 70');
// N2O in the metadata within fertilised soil: BNI 0.81 against control 0.98, p = 0.58
const nf = S.lineTest('n2o', 1, -1);
ok(near(nf[0], 0.81, 0.005) && near(nf[1], 0.98, 0.005) && near(nf[2], 0.58, 0.005), `N2O (metadata), fertilised: ${nf.join(' / ')} (0.81, 0.98, p 0.58)`);
// nitrate in fertilised soil on day 24 (T3): lower under the BNI wheat, as on slide 6
const no3 = S.meta('no3', 0, 1, 2).mean, no3c = S.meta('no3', 1, 1, 2).mean;
ok(no3 < no3c && near(no3, 39.9, 0.1) && near(no3c, 60.9, 0.1), `nitrate, fertilised, day 24: BNI ${no3}, control ${no3c}`);

// the slides' readings
const c70 = [S.chl70(0, 0).v, S.chl70(0, 1).v];
ok(near(c70[0], 62.1, 0.2) && near(c70[1], 49.3, 0.2), `chlorophyll on day 70, not fertilised: BNI ${c70[0]}, control ${c70[1]} (read off slide 6)`);
ok(near(S.meta('chl', 0, 0, 3).mean, c70[0], 0.1) && near(S.meta('chl', 1, 0, 3).mean, c70[1], 0.1), 'the metadata\'s T4 chlorophyll matches the slides\' day 70 (not fertilised)');
const pk = D.figs.n2o.peaks[0][1];
ok(near(pk[0], 0.41, 0.03) && near(pk[1], 1.33, 0.03), `N2O incubation, fertilised, day 1: peaks BNI ${pk[0]}, control ${pk[1]} ppm (read off slide 7)`);
ok(S.n2o(0, 1, 0).length === D.figs.n2o.times.length && S.n2o(0, 1, 0).every(v => v !== null), 'every incubation curve is complete (hidden points take the other line\'s)');
ok(near(S.qpcr('aoa', 1, 2, 0).v, 5.65e7, 0.1e7) && near(S.qpcr('aoa', 1, 2, 1).v, 7.88e7, 0.1e7), 'qPCR, archaea, fertilised, day 24: about 5.6e7 against 7.9e7 (read off slide 9)');

// the microbes
ok(D.common.n === 3384 && near(D.common.readShare, 0.946, 0.001), `3,384 common kinds with 94.6 % of the reads (${D.common.readShare})`);
ok(D.phyla.names.length === 14 && near(D.phyla.share.reduce((a, b) => a + b, 0), 100, 0.2), 'phyla: 14 entries whose shares add up to 100 %');
ok(D.phyla.names.every((n, i) => L.phylum(n, i)), 'every phylum has a colour');
const ns = D.guilds.nsp.byFert;
ok(ns[1] / ns[0] > 1.9 && ns[1] / ns[0] < 2.5, `Nitrosospira: ${ns.join(' / ')} % (not fertilised, fertilised, + DCD): fertiliser roughly doubles it`);
ok(D.guilds.nsp.p.line > 0.5 && D.guilds.aoa.p.line > 0.5, 'the nitrifiers do not differ by wheat line');
ok(D.common.diff.line === 2 && D.common.diff.fert === 1646 && D.common.diff.time === 580, `kinds that differ: by line ${D.common.diff.line}, fertiliser ${D.common.diff.fert}, date ${D.common.diff.time}`);
const fl = S.common.flags, bits = b => fl.reduce((a, f) => a + ((f & b) ? 1 : 0), 0);
ok(bits(1) === D.common.diff.fert && bits(2) === D.common.diff.time && bits(4) === 2 && bits(8) === D.common.diff.plot, 'the flags give the same counts');
ok(D.common.lineKinds.length === 2 && D.common.lineKinds.every(k => fl[k.common] & 4), 'the two kinds that differ by line are flagged');
// the cloud
const C = S.cloud;
ok(C.n === 20000 && C.rank[0] === 1 && C.rank.every((r, i) => !i || r > C.rank[i - 1]) && C.rank[C.n - 1] <= 100116, 'the cloud: 20,000 kinds by rank from 1');
ok(new Set(S.common.idx).size === 3384 && S.common.idx.every(i => i < C.n && C.prev[i] >= 24), 'the common kinds are all in the cloud, each in 24 or more samples');
ok(C.phy.every(p => p < 14) && C.guild.every(g => g <= 5), 'the cloud\'s phyla and guilds are in range');
ok(D.guilds.aoa.kinds === 293 && D.guilds.nsp.kinds === 12 && D.guilds.nsm.kinds === 7 && D.guilds.nit.kinds === 631, 'guild sizes: 293, 12, 7, 631');

// the network
ok(N.n === 1564 && N.links === 22348 && N.pos === 18216, `the network: ${N.n} kinds, ${N.links} links, ${N.pos} positive`);
ok(N.modules === 17 && N.mods.length === 17 && N.mods.every(x => x.n >= 3), '17 modules of 3 or more kinds');
ok(N.mods.filter(x => x.n >= 100).length === 5, `five big modules (${N.mods.slice(0, 6).map(x => x.n).join(', ')})`);
ok(N.louvain.modules[0] <= 17 && 17 <= N.louvain.modules[1], `Louvain over 30 seeds gives ${N.louvain.modules.join(' to ')} modules`);
const counts = new Array(17).fill(0);
for (const x of S.net.mod) if (x < 255) counts[x]++;
ok(counts.every((c, k) => c === N.mods[k].n), 'the nodes\' modules agree with the modules\' sizes');
ok(S.net.node.every(i => i < 3384) && S.net.xyz.length === 3 * N.n, 'nodes index the common kinds; a layout point each');
let maxR = 0;
for (let i = 0; i < N.n; i++) maxR = Math.max(maxR, Math.hypot(S.net.xyz[3 * i], S.net.xyz[3 * i + 1], S.net.xyz[3 * i + 2]));
ok(near(maxR, 1, 0.01), `the layout fits radius 1 (${maxR.toFixed(3)})`);
const ij = S.net.ij, deg = new Uint16Array(N.n);
let bad = 0;
for (let e = 0; e < ij.length; e += 2) { if (ij[e] >= N.n || ij[e + 1] >= N.n || ij[e] === ij[e + 1]) bad++; deg[ij[e]]++; deg[ij[e + 1]]++; }
ok(ij.length === 2 * N.links && !bad, 'the links join two different nodes');
ok(deg.every((d, i) => d === S.net.deg[i] && d > 0), 'the stored degrees are the links\' counts, none zero');
ok(S.net.rho.every((r, i) => !i || Math.abs(r) <= Math.abs(S.net.rho[i - 1]) + 1e-6), 'the links are sorted from the strongest');
ok(S.net.rho.filter(r => r > 0).length === N.pos && S.net.rho.every(r => Math.abs(r) >= 0.6 - 0.005), 'their rho: as many positive, all 0.6 or more');
ok(S.net.cut(0.6) === 22348 && S.net.cut(0.7) === 4267 && S.net.cut(0.8) === 449, `the stricter networks are prefixes: 0.7 ${S.net.cut(0.7)}, 0.8 ${S.net.cut(0.8)}`);
const th = Object.fromEntries(N.thresholds.map(x => [x.rho, x.links]));
ok(th[0.5] === 84506 && th[0.7] === 4267 && th[0.8] === 449, 'thresholds 0.5, 0.7 and 0.8: 84,506, 4,267 and 449 links');
ok(N.null.links === 0, 'shuffled, not one link is left');
const sp = N.splits, bit = b => S.net.split.reduce((a, f) => a + ((f & b) ? 1 : 0), 0);
ok(sp.line[0].links === 38653 && sp.line[1].links === 30276 && sp.lineDiff === 8377, 'the wheat lines\' own networks: 38,653 and 30,276 links (8,377 apart)');
ok(sp.randomDiff[0] <= sp.lineDiff && sp.lineDiff <= sp.randomDiff[1], `random halves differ by ${sp.randomDiff.join(' to ')}: the lines' gap lies inside`);
ok(sp.line.every(x => x.null === 0) && sp.fert.every(x => x.null === 0), 'every group\'s shuffled network is empty');
ok(bit(1) === sp.line[0].keeps && bit(2) === sp.line[1].keeps && bit(4) === sp.fert[0].keeps && bit(32) === sp.randomKeeps[0],
  'the split bits give each half\'s share of this network\'s links');
ok(N.mods.every(x => x.score.length === 120 && x.score[S.missing] === null && x.share.length === 30), 'each module: a score per sample, a share per group');
const big = N.mods.filter(x => x.n >= 100);
ok(big.every(x => Math.max(x.r2.fert, x.r2.plot) > 0.5 && x.r2.line < 0.02), 'the big modules follow the fertiliser or the plots, not the wheat line');
ok(near(N.fertNodes, 0.659, 0.002) && near(N.fertAll, 0.486, 0.002), `kinds that differ by fertiliser: ${N.fertNodes} of the network, ${N.fertAll} of all common`);
ok(N.residual.group.links === 22348 && N.residual.group.shared === 9931 && N.residual.plot.links === 1024, 'with the groups\' means out: 22,348 links (9,931 shared); with the plots\' too: 1,024');

// the palette
ok(L.chl(45).every((v, i) => near(v, L.rgb('#c9b44a')[i], 1e-6)) && L.chl(65).every((v, i) => near(v, L.rgb('#2f8a3a')[i], 1e-6)), 'leaf colours from SPAD 45 to 65');
ok(D.open.length >= 8, `${D.open.length} open questions recorded`);
console.log(fails ? `${fails} check(s) failed` : 'all checks passed');
process.exit(fails ? 1 : 0);
