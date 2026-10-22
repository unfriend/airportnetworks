// The multiplex network of the muscle story (slide 8 of the talk): 71 layers of gene links stacked into a tower, the
// same genes at the same spot in every layer, threads joining a gene's copies. The hero of the story and the base of
// its explore mode. Everything is read from NMD_DATA; looks are decided in the shaders from two small textures (one
// per gene, rewritten only when the selection changes; one per layer, 71 texels), so no big buffer is ever rebuilt.
SETS.tower = function (K) {
  const { THREE, smooth, clamp, lerp, prog, rng, rgb } = K;
  const set = K.newSet('tower');
  const D = NMD_DATA, GR = D.groups, LAY = D.layers, GN = GR.length, LN = LAY.length, PN = D.ppi.length;
  const W = D.walk || {}, ZMIN = W.zMin || 1.645, RESTART = W.restart || 0.7, SWITCH = W.switch || 0.5;
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- decode the data
  const bytes = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const termList = ids => (ids ? ids.split('.').map(k => D.terms[+k]) : []);
  const genes = D.genes.map(row => {
    const f = row.split('|'), seed = +f[2], added = +f[3];
    return { sym: f[0], endo: f[1].split('.').map(Number), seed, added, groups: seed | added,
      go: termList(f[4]), hpo: termList(f[5]), kegg: termList(f[6]), ppi: f[7] === '1' };
  });
  const N = genes.length;
  const inG = (i, g) => g >= 0 && (genes[i].groups >> g & 1) === 1, isSeed = (i, g) => g >= 0 && (genes[i].seed >> g & 1) === 1;
  const nGroups = i => { let c = 0; for (let x = genes[i].groups; x; x &= x - 1) c++; return c; };
  const PB = new Int16Array(bytes(D.pos).buffer), BX = new Float32Array(N), BZ = new Float32Array(N);
  for (let i = 0; i < N; i++) { BX[i] = PB[2 * i] / 32000; BZ[i] = -PB[2 * i + 1] / 32000; }
  const HEAT = D.heat.map(s => Float32Array.from(bytes(s), v => v / 255));
  const MEM = GR.map((_, g) => genes.map((G, i) => i).filter(i => inG(i, g)));
  const SEEDS = GR.map((_, g) => MEM[g].filter(i => isSeed(i, g)));
  // endotype members: ENDO[g][c] = gene indices
  const ENDO = GR.map((G, g) => { const o = {}; for (const e of G.endo) o[e.c] = []; for (const i of MEM[g]) { const c = genes[i].endo[g]; if (c) (o[c] = o[c] || []).push(i); } return o; });

  // links of every layer, whatever its category: protein layers from edges (a bit per protein layer), the rest from
  // extra (one tower layer each). A layer that gets links later just shows them.
  const PPI_OF = new Int16Array(LN).fill(-1); D.ppi.forEach((l, p) => { PPI_OF[l] = p; });
  const EB = bytes(D.edges), EW = new Uint32Array(EB.buffer, 0, EB.length >> 2);
  const XB = bytes(D.extra), XW = new Uint16Array(XB.buffer, 0, XB.length >> 1);
  const LC = new Int32Array(LN);
  for (let k = 0; k < EW.length; k += 2) for (let m = EW[k + 1], p = 0; m; m >>>= 1, p++) if (m & 1) LC[D.ppi[p]]++;
  for (let k = 0; k < XW.length; k += 3) LC[XW[k + 2]]++;
  const LL = Array.from(LC, n => new Uint16Array(2 * n)), LF = new Int32Array(LN);
  for (let k = 0; k < EW.length; k += 2) {
    const a = EW[k] >>> 16, b = EW[k] & 65535;
    for (let m = EW[k + 1], p = 0; m; m >>>= 1, p++) if (m & 1) { const l = D.ppi[p]; LL[l][LF[l]++] = a; LL[l][LF[l]++] = b; }
  }
  for (let k = 0; k < XW.length; k += 3) { const l = XW[k + 2]; LL[l][LF[l]++] = XW[k]; LL[l][LF[l]++] = XW[k + 1]; }
  // neighbours per layer (CSR)
  const ADJ = LL.map(arr => {
    const off = new Int32Array(N + 1);
    for (let k = 0; k < arr.length; k++) off[arr[k] + 1]++;
    for (let i = 0; i < N; i++) off[i + 1] += off[i];
    const nb = new Uint16Array(arr.length), f = off.slice(0, N);
    for (let k = 0; k < arr.length; k += 2) { const a = arr[k], b = arr[k + 1]; nb[f[a]++] = b; nb[f[b]++] = a; }
    return { off, nb };
  });
  const deg = (i, l) => ADJ[l].off[i + 1] - ADJ[l].off[i];
  const edgeCount = LC.reduce((s, n) => s + n, 0);
  const hasData = Array.from(LC, n => n > 0);
  // layer-links inside each group's module
  const MODL = GR.map((_, g) => { let n = 0; for (let l = 0; l < LN; l++) { const a = LL[l]; for (let k = 0; k < a.length; k += 2) if ((genes[a[k]].groups & genes[a[k + 1]].groups) >> g & 1) n++; } return n; });

  // ---------------------------------------------------------------- geometry of the tower
  const CATN = { pheno: 'Phenotypes', path: 'Pathways', drug: 'Drug targets', ess: 'Essential genes', coex: 'Co-expression', ppi: 'Protein interactions' };
  const CATC = { ppi: '#46d9ff', coex: '#3ee08f', pheno: '#ff5ad9', path: '#ffb43b', drug: '#ff5a4b', ess: '#b07bff' };
  const CATL = { ppi: 'cyn', coex: 'grn', pheno: 'mag', path: 'amb', drug: '', ess: '' };
  const H = 2.2, GAP = 0.08;
  let nGap = 0; for (let l = 1; l < LN; l++) if (LAY[l].cat !== LAY[l - 1].cat) nGap++;
  const SP = (H - nGap * GAP) / (LN - 1), LY = new Float32Array(LN);
  for (let l = 0, y = H / 2; l < LN; l++) { if (l && LAY[l].cat !== LAY[l - 1].cat) y -= GAP; LY[l] = y; y -= SP; }
  const LI = {}; LAY.forEach((L, l) => { LI[L.key] = l; });
  const cats = []; LAY.forEach((L, l) => { const c = cats.find(x => x.cat === L.cat); if (c) c.ls.push(l); else cats.push({ cat: L.cat, ls: [l] }); });
  for (const c of cats) c.y = (LY[c.ls[0]] + LY[c.ls[c.ls.length - 1]]) / 2;
  const blockMid = cat => { const c = cats.find(x => x.cat === cat); return c ? c.y : 0; };
  const PPI_TOP = D.ppi.length ? Math.max(...D.ppi.map(l => LY[l])) : 0;
  // directions: bars stick out to the left of the default view, category labels sit on its right rim
  const CAM_AZ = 24 * Math.PI / 180, RIGHT = [Math.cos(CAM_AZ), -Math.sin(CAM_AZ)], BAR = [-Math.cos(CAM_AZ), Math.sin(CAM_AZ)];
  const BARS = 0.065;                 // bar length per unit of z
  const PCX = 0.62, PR = 0.44;        // pair mode: tower centres at x = -PCX / +PCX, radius PR
  const ROOM = 0.45;                  // room mode: inner radius of the annulus
  // grid mode: the stack squashes around the protein block, so the endotype blocks read as a grid and not as long
  // columns that perspective splays into a funnel
  const FLAT = 0.1, FLAT_Y = () => blockMid('ppi'), flatY = l => FLAT_Y() + (LY[l] - FLAT_Y()) * FLAT;
  const PRES = new Uint8Array(N * LN);
  for (let l = 0; l < LN; l++) for (let i = 0; i < N; i++) if (deg(i, l)) PRES[i * LN + l] = 1;

  // ---------------------------------------------------------------- colours
  const ENDO_PAL = ['#46d9ff', '#ff5ad9', '#ffb43b', '#3ee08f', '#ff5a4b', '#b07bff', '#4d94ff', '#e6d23c', '#2fc4b2', '#ff8a3d',
    '#9be15d', '#ff8fb8', '#7f8cff', '#7ff0f0', '#d77bff', '#c9a66b', '#b5f5c8', '#ffb199', '#a8c8ff', '#f2e394'];
  const endoColour = c => ENDO_PAL[((Math.max(1, c | 0) - 1) % ENDO_PAL.length + ENDO_PAL.length) % ENDO_PAL.length];
  const GOLD = rgb('#ffe2a0'), MUTED = rgb('#56657d'), AMBER = rgb('#ffb43b'), NEUTRAL = rgb('#8396b3');
  const GC = GR.map(G => rgb(G.col));

  // ---------------------------------------------------------------- layouts: grid (per group) and pair
  const GRID = [], GRIDC = [];
  function gridLayout(g) {
    if (GRID[g]) return GRID[g];
    const out = new Float32Array(2 * N), E = GR[g].endo.slice().sort((a, b) => a.c - b.c), ne = Math.max(1, E.length);
    const cols = Math.ceil(Math.sqrt(ne)), rows = Math.ceil(ne / cols), cell = 1.5 / cols, hv = HEAT[g];
    const maxN = Math.max(1, ...E.map(e => (ENDO[g][e.c] || []).length));
    const sp = Math.min(0.05, cell * 0.6 / Math.ceil(Math.sqrt(maxN)));
    const centres = {};
    E.forEach((e, k) => {
      const row = Math.floor(k / cols), inRow = Math.min(cols, ne - row * cols), col = k % cols;
      const cx = (col - (inRow - 1) / 2) * cell, cz = (row - (rows - 1) / 2) * cell;
      centres[e.c] = [cx, cz, row, cell];
      const mem = (ENDO[g][e.c] || []).slice().sort((a, b) => hv[b] - hv[a] || a - b), m = Math.ceil(Math.sqrt(mem.length)) + 1;
      const slots = [];
      for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) slots.push([a - (m - 1) / 2, b - (m - 1) / 2]);
      slots.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]) || p[1] - q[1] || p[0] - q[0]);
      mem.forEach((i, j) => { out[2 * i] = cx + slots[j][0] * sp; out[2 * i + 1] = cz + slots[j][1] * sp; });
    });
    // everyone else waits on a faint ring at the rim
    const r = rng(500 + g);
    for (let i = 0; i < N; i++) if (!inG(i, g) || !genes[i].endo[g]) {
      const a = Math.atan2(BZ[i], BX[i]), rr = 0.955 + 0.03 * r();
      out[2 * i] = rr * Math.cos(a); out[2 * i + 1] = rr * Math.sin(a);
    }
    GRIDC[g] = centres;
    return (GRID[g] = out);
  }
  const BASE = new Float32Array(2 * N); for (let i = 0; i < N; i++) { BASE[2 * i] = BX[i]; BASE[2 * i + 1] = BZ[i]; }

  // pair: Congenital Myopathies left, Hereditary Cardiomyopathies right, genes in both in a narrow column between
  const PG = (D.overlap && D.overlap.groups) || [5, 11], PGL = PG[0], PGR = PG[1];
  const PCLS = new Uint8Array(N), PPOS = new Float32Array(2 * N), PFLAG = new Uint8Array(N);
  for (let i = 0; i < N; i++) PCLS[i] = (inG(i, PGL) ? 1 : 0) | (inG(i, PGR) ? 2 : 0);
  for (const side of [1, 2]) {
    const mem = [...Array(N).keys()].filter(i => PCLS[i] === side), cx = side === 1 ? -PCX : PCX;
    let mx = 0, mz = 0; for (const i of mem) { mx += BX[i]; mz += BZ[i]; } mx /= mem.length || 1; mz /= mem.length || 1;
    mem.sort((a, b) => Math.hypot(BX[a] - mx, BZ[a] - mz) - Math.hypot(BX[b] - mx, BZ[b] - mz));
    mem.forEach((i, k) => {
      const r = Math.sqrt((k + 0.5) / mem.length) * PR * 0.97, a = Math.atan2(BZ[i] - mz, BX[i] - mx);
      PPOS[2 * i] = cx + r * Math.cos(a); PPOS[2 * i + 1] = r * Math.sin(a);
    });
  }
  const BOTH = [...Array(N).keys()].filter(i => PCLS[i] === 3).sort((a, b) => BZ[a] - BZ[b] || a - b);
  const bRows = Math.ceil(BOTH.length / 2), bStep = Math.min(0.05, 0.76 / Math.max(1, bRows));
  BOTH.forEach((i, k) => { PPOS[2 * i] = ((k % 2) - 0.5) * 0.045; PPOS[2 * i + 1] = (Math.floor(k / 2) - (bRows - 1) / 2) * bStep; });
  for (let i = 0; i < N; i++) if (!PCLS[i]) { PPOS[2 * i] = BX[i] * 1.06; PPOS[2 * i + 1] = BZ[i] * 1.06; }
  // shared endotypes: pairs of endotypes (one per group) that share at least SHARE_MIN genes
  const SHARE_MIN = 3, pairCount = new Map();
  for (const i of BOTH) { const a = genes[i].endo[PGL], b = genes[i].endo[PGR]; if (a && b) pairCount.set(a + ',' + b, (pairCount.get(a + ',' + b) || 0) + 1); }
  const pairEndo = [...pairCount].map(([k, n]) => { const [a, b] = k.split(',').map(Number); return { left: a, right: b, genes: n, shared: n >= SHARE_MIN }; })
    .sort((x, y) => y.genes - x.genes || x.left - y.left || x.right - y.right);
  const shL = new Set(pairEndo.filter(p => p.shared).map(p => p.left)), shR = new Set(pairEndo.filter(p => p.shared).map(p => p.right));
  for (let i = 0; i < N; i++) {
    const c = PCLS[i]; if (!c) continue;
    const sd = ((c & 1) && isSeed(i, PGL)) || ((c & 2) && isSeed(i, PGR));
    const sh = ((c & 1) && shL.has(genes[i].endo[PGL])) || ((c & 2) && shR.has(genes[i].endo[PGR]));
    PFLAG[i] = (sd ? 1 : 0) + (sh ? 2 : 0);
  }
  // links in pair mode: both modules squeezed into small discs, so each is drawn fainter
  const PKF = Math.round(0.55 * clamp(Math.sqrt(2500 / Math.max(1, (MODL[PGL] || 0) + (MODL[PGR] || 0))), 0.3, 1) * 1000) / 1000;
  const GLOW_KEYS = ['HP', 'coex_HRA', 'coex_HRV', 'ppi_skeletal_muscle'].filter(k => LI[k] !== undefined);
  const PAIR_GLOW = new Uint8Array(LN); for (const k of GLOW_KEYS) PAIR_GLOW[LI[k]] = 1;

  // ---------------------------------------------------------------- gene texture
  // rows per slot s (0 = the previous selection, 1 = the current one; the looks cross-fade): 4s+0 grid x, z, pick mask,
  // gene ring; 4s+1 colour, member; 4s+2 endotype colour, seed; 4s+3 heat, join rank. Row 8: pair x, z, class, flags.
  // Row 9: layout x, z.
  const GT_ROWS = 10, gtd = new Float32Array(N * GT_ROWS * 4);
  const GT = new THREE.DataTexture(gtd, N, GT_ROWS, THREE.RGBAFormat, THREE.FloatType);
  GT.magFilter = GT.minFilter = THREE.NearestFilter; GT.generateMipmaps = false;
  const gset = (i, r, a, b, c, d) => { const o = (r * N + i) * 4; gtd[o] = a; gtd[o + 1] = b; gtd[o + 2] = c; gtd[o + 3] = d; };
  const gget = (i, r, k) => gtd[(r * N + i) * 4 + k];
  for (let i = 0; i < N; i++) { gset(i, 8, PPOS[2 * i], PPOS[2 * i + 1], PCLS[i], PFLAG[i]); gset(i, 9, BX[i], BZ[i], 0, 0); }
  const SL = [new THREE.Vector4(), new THREE.Vector4()];   // per slot: selected, pick on, gene on, heat on
  let slotGen = 0;                                          // counts slot changes (the highlighted links follow them)
  const PICKC = Array.from({ length: 8 }, () => new THREE.Color(1, 1, 1));
  const slotInfo = [null, null];
  function writeSlot(s, eff) {
    const g = eff.group, grid = g >= 0 ? gridLayout(g) : BASE, hv = eff.heat || (g >= 0 ? HEAT[g] : null);
    const picks = (eff.pick || []).slice(0, 8);
    // module join order: the group's added genes by heat
    const rank = new Float32Array(N).fill(2);
    if (g >= 0) {
      const add = MEM[g].filter(i => !isSeed(i, g)).sort((a, b) => (hv ? hv[b] - hv[a] : 0) || a - b);
      add.forEach((i, k) => { rank[i] = (k + 1) / add.length; });
      for (const i of SEEDS[g]) rank[i] = 0;
    }
    for (let i = 0; i < N; i++) {
      let mask = 0; picks.forEach(([pg, pc], k) => { if (pg >= 0 && pg < GN && genes[i].endo[pg] === pc) mask += 1 << k; });
      gset(i, 4 * s, grid[2 * i], grid[2 * i + 1], mask, i === eff.gene ? 1 : 0);
      let col, mem, seed, ec;
      if (g >= 0) {
        mem = inG(i, g) ? 1 : 0; seed = isSeed(i, g) ? 1 : 0;
        col = mem ? GC[g] : MUTED; ec = mem && genes[i].endo[g] ? rgb(endoColour(genes[i].endo[g])) : col;
      } else {
        mem = 1; seed = genes[i].seed ? 1 : 0;
        col = nGroups(i) > 1 ? GOLD : GC[Math.max(0, 31 - Math.clz32(genes[i].groups))]; ec = col;
      }
      gset(i, 4 * s + 1, col[0], col[1], col[2], mem);
      gset(i, 4 * s + 2, ec[0], ec[1], ec[2], seed);
      gset(i, 4 * s + 3, hv ? hv[i] : 0, rank[i], 0, 0);
    }
    SL[s].set(g >= 0 ? 1 : 0, picks.length ? 1 : 0, eff.gene >= 0 ? 1 : 0, hv ? 1 : 0);
    // big modules have thousands of links per layer: each is drawn fainter
    TU.uMK.value.setComponent(s, g >= 0 ? clamp(Math.sqrt(2500 / Math.max(1, MODL[g])), 0.3, 1) : 1);
    TU.uHot.value.setComponent(s, hotMin(hv));
    if (s === 1) picks.forEach(([, pc], k) => PICKC[k].set(endoColour(pc)));
    slotInfo[s] = eff; slotGen++;
    GT.needsUpdate = true;
  }
  function shiftSlots() {
    gtd.copyWithin(0, 4 * N * 4, 8 * N * 4);
    SL[0].copy(SL[1]); slotInfo[0] = slotInfo[1]; TU.uMK.value.x = TU.uMK.value.y; TU.uHot.value.x = TU.uHot.value.y; slotGen++;
  }

  // ---------------------------------------------------------------- layer texture (71 texels x 4 rows, per frame)
  // row 0: y, content alpha, rim alpha, fill alpha; row 1: rim colour, link weight; row 2: bar length, bar alpha, rest y,
  // rise; row 3: dashed, informative, point weight, context link weight
  const ltd = new Float32Array(LN * 4 * 4), ltn = new Float32Array(LN * 4 * 4);
  const LT = new THREE.DataTexture(ltd, LN, 4, THREE.RGBAFormat, THREE.FloatType);
  LT.magFilter = LT.minFilter = THREE.NearestFilter; LT.generateMipmaps = false;
  const LYC = new Float32Array(LN), LCONT = new Float32Array(LN), LFr = new Float32Array(3 * LN);   // current y and content alpha (for the CPU side)

  // ---------------------------------------------------------------- shared shader code
  const TU = {
    uGT: { value: GT }, uLT: { value: LT }, uX: { value: 1 }, uSl0: { value: SL[0] }, uSl1: { value: SL[1] },
    uSeeds: { value: 0 }, uHeat: { value: 0 }, uModule: { value: 0 }, uEndo: { value: 0 }, uGrid: { value: 0 },
    uPair: { value: 0 }, uSeedOnly: { value: 0 }, uRoom: { value: 0 }, uDrop: { value: 0 }, uZ: { value: 0 },
    uPL: { value: new THREE.Color(GR[PGL] ? GR[PGL].col : '#46d9ff') }, uPR: { value: new THREE.Color(GR[PGR] ? GR[PGR].col : '#ff5ad9') },
    uPickC: { value: PICKC }, uMK: { value: new THREE.Vector2(1, 1) }, uWalk: { value: 0 }, uHot: { value: new THREE.Vector2(2, 2) },
  };
  const uni = extra => Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, TU, extra || {});
  const f1 = x => (Number.isInteger(x) ? x.toFixed(1) : String(x));
  const LOOK = `
uniform sampler2D uGT, uLT;
uniform float uA, uX, uSeeds, uHeat, uModule, uEndo, uGrid, uPair, uSeedOnly, uRoom, uDrop, uZ, uWalk;
uniform vec4 uSl0, uSl1;
uniform vec2 uMK, uHot;
uniform vec3 uPL, uPR, uPickC[8];
vec4 gt(float g, float r) { return texture2D(uGT, vec2((g + 0.5) / ${f1(N)}, (r + 0.5) / ${f1(GT_ROWS)})); }
vec4 lt(float l, float r) { return texture2D(uLT, vec2((l + 0.5) / ${f1(LN)}, (r + 0.5) / 4.0)); }
float bit(float m, float k) { return mod(floor(m / pow(2.0, k) + 0.001), 2.0); }
vec3 pickCol(float m) {
  vec3 c = vec3(1.0); float found = 0.0;
  for (int k = 0; k < 8; k++) { float b = bit(m, float(k)) * (1.0 - found); c = mix(c, uPickC[k], b); found = max(found, b); }
  return c;
}
float heatAt(float g) { return mix(gt(g, 3.0).x * uSl0.w, gt(g, 7.0).x * uSl1.w, uX); }
vec3 heatCol(float h) { return h < 0.5 ? mix(vec3(0.05, 0.12, 0.42), vec3(0.27, 0.85, 1.0), h * 2.0) : mix(vec3(0.27, 0.85, 1.0), vec3(1.0), h * 2.0 - 1.0); }
// one slot's look of gene g: colour; q = (dot alpha, link part, thread, seed); xz; m = (pick mask, ringed)
void slotLook(float g, float s, vec4 sl, vec2 base, out vec3 col, out vec4 q, out vec2 xz, out vec2 m) {
  vec4 a = gt(g, s * 4.0), b = gt(g, s * 4.0 + 1.0), c = gt(g, s * 4.0 + 2.0), d = gt(g, s * 4.0 + 3.0);
  float member = b.w, seed = c.w * member, heat = d.x, rank = d.y, sel = sl.x;
  float joined = smoothstep(rank, rank + 0.025, uModule * 1.03);
  float mv = member * (seed > 0.5 ? 1.0 : 1.0 - uSeeds * (1.0 - joined));
  float flash = (1.0 - seed) * member * joined * (1.0 - smoothstep(0.0, 0.06, uModule * 1.03 - rank)) * step(0.001, uModule) * uSeeds;
  col = mix(b.rgb, c.rgb, uEndo * sel);
  float hv = uHeat * sl.w;
  col = mix(col, heatCol(heat), hv);
  float vis = sel > 0.5 ? mix(0.09, 1.0, mv) : 0.3;
  vis = mix(vis, max(vis * 0.35, heat * (0.25 + 0.75 * mv)), hv) + flash;
  col = mix(col, vec3(1.0), flash * 0.6);
  float lk = sel > 0.5 ? mv : 1.0;
  float hi = sel * mv * (0.07 + 0.4 * uDrop + 0.35 * seed * uSeeds);
  if (sl.y > 0.5) {
    if (a.z > 0.5) { col = pickCol(a.z); vis = 1.0; lk = 1.0; hi = 0.7; }
    else { vis *= 0.25; lk = 0.0; hi = 0.0; col = mix(col, vec3(0.42, 0.5, 0.62), 0.6); }
  }
  if (sl.z > 0.5 && a.w > 0.5) { col = mix(col, vec3(1.0), 0.5); vis = 1.0; hi = 1.0; }
  q = vec4(vis, lk, hi, seed);
  xz = mix(base, a.xy, uGrid);
  m = a.zw;
}
void look(float g, out vec3 col, out vec4 q, out vec2 xz, out vec2 m) {
  vec2 base = gt(g, 9.0).xy; float r = length(base);
  base *= mix(1.0, (${f1(ROOM)} + ${f1(1 - ROOM)} * r) / max(r, 0.0001), uRoom);
  slotLook(g, 1.0, uSl1, base, col, q, xz, m);
  if (uX < 0.999) {
    vec3 c0; vec4 q0; vec2 x0, m0;
    slotLook(g, 0.0, uSl0, base, c0, q0, x0, m0);
    col = mix(c0, col, uX); q = mix(q0, q, uX); xz = mix(x0, xz, uX); m = uX > 0.5 ? m : m0;
  }
  if (uPair > 0.001) {
    vec4 p = gt(g, 8.0);
    float cls = p.z, inP = step(0.5, cls), ps = mod(p.w, 2.0), sh = step(1.5, p.w), both = step(2.5, cls);
    vec3 pc = cls < 1.5 ? uPL : cls < 2.5 ? uPR : vec3(1.0, 0.94, 0.84);
    pc = mix(pc, vec3(1.0, 0.71, 0.23), sh);
    float pv = inP * (ps > 0.5 ? 1.0 : 1.0 - uSeedOnly * 0.9);
    col = mix(col, pc, uPair);
    q = mix(q, vec4(pv, inP * (ps > 0.5 ? 1.0 : 1.0 - uSeedOnly), inP * max(sh * 0.45, both * 0.7) * (ps > 0.5 ? 1.0 : 1.0 - uSeedOnly), ps * inP), uPair);
    xz = mix(xz, p.xy, uPair);
  }
}
`;

  // ---------------------------------------------------------------- layer discs: rims and fills
  // vertex position = (angle 0..1, layer, copy): copy 0 the main disc (the left tower in pair mode), 1 the right tower,
  // 2 the narrow middle column, 3 the inner rim of the room annulus
  const RING_GLSL = `
vec3 ringPos(float u, float l, float cp, float rr, float y) {
  float a = u * 6.2831853, ca = cos(a), sa = sin(a);
  vec2 c = vec2(0.0); float r = 1.0;
  if (cp < 0.5) { c = vec2(-${f1(PCX)} * uPair, 0.0); r = mix(mix(rr, ${f1(ROOM)} + ${f1(1 - ROOM)} * rr, uRoom), ${f1(PR + 0.03)} * rr, uPair); }
  else if (cp < 1.5) { c = vec2(${f1(PCX)}, 0.0); r = ${f1(PR + 0.03)} * rr; }
  else if (cp < 2.5) { return vec3(0.055 * sign(ca) * pow(abs(ca), 0.35), y, 0.43 * sign(sa) * pow(abs(sa), 0.35)); }
  else { r = ${f1(ROOM - 0.02)}; }
  return vec3(c.x + r * ca, y, c.y + r * sa);
}
float copyA(float cp) { return cp < 0.5 ? 1.0 : cp < 2.5 ? uPair : uRoom * (1.0 - uPair); }
`;
  const RSEG = [96, 96, 40, 64];
  let nRing = 0; for (const n of RSEG) nRing += n * LN;
  const ringGeo = new THREE.BufferGeometry(), rp = new Float32Array(nRing * 6);
  { let o = 0; for (let l = 0; l < LN; l++) RSEG.forEach((n, cp) => { for (let k = 0; k < n; k++) { rp.set([k / n, l, cp, (k + 1) / n, l, cp], o); o += 6; } }); }
  ringGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const ringMat = new THREE.ShaderMaterial({
    uniforms: uni(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: LOOK + RING_GLSL + `
varying vec3 vC; varying float vA, vU, vDash;
void main() {
  float u = position.x, l = position.y, cp = position.z;
  vec4 L0 = lt(l, 0.0), L1 = lt(l, 1.0), L3 = lt(l, 3.0);
  vec3 p = ringPos(u, l, cp, 1.0, L0.x);
  vC = L1.rgb; vA = L0.z * copyA(cp) * uA * (cp > 2.5 ? 0.6 : 1.0); vU = u * (cp > 0.5 && cp < 1.5 ? 0.5 : 1.0) * (cp > 1.5 && cp < 2.5 ? 0.3 : 1.0); vDash = L3.x;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `varying vec3 vC; varying float vA, vU, vDash;
void main() { if (vDash > 0.5 && fract(vU * 72.0) > 0.42) discard; gl_FragColor = vec4(vC, vA); }`,
  });
  set.mats.push(ringMat);
  const rings = new THREE.LineSegments(ringGeo, ringMat); rings.frustumCulled = false; rings.renderOrder = 1;

  // fills: two rings of vertices per disc (centre, rim); copies 0 (main/left) and 1 (right)
  const FSEG = 48, fp = new Float32Array(LN * 2 * FSEG * 6 * 3), fr = new Float32Array(LN * 2 * FSEG * 6);
  { let o = 0, q = 0; for (let l = 0; l < LN; l++) for (let cp = 0; cp < 2; cp++) for (let k = 0; k < FSEG; k++) {
    const a = k / FSEG, b = (k + 1) / FSEG;
    for (const [u, r] of [[a, 0], [a, 1], [b, 1], [a, 0], [b, 1], [b, 0]]) { fp.set([u, l, cp], o); o += 3; fr[q++] = r; }
  } }
  const fillGeo = new THREE.BufferGeometry();
  fillGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fillGeo.setAttribute('aR', new THREE.BufferAttribute(fr, 1));
  const fillMat = new THREE.ShaderMaterial({
    uniforms: uni(), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: LOOK + RING_GLSL + `
attribute float aR;
varying vec3 vC; varying float vA, vR;
void main() {
  float l = position.y, cp = position.z;
  vec4 L0 = lt(l, 0.0), L1 = lt(l, 1.0);
  vec3 p = ringPos(position.x, l, cp, max(aR, 0.001), L0.x);
  vC = L1.rgb; vA = L0.w * copyA(cp) * uA; vR = aR;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  if (vA < 0.0005) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `varying vec3 vC; varying float vA, vR;
void main() { gl_FragColor = vec4(vC, vA * (0.25 + 0.75 * vR * vR)); }`,
  });
  set.mats.push(fillMat);
  const fills = new THREE.Mesh(fillGeo, fillMat); fills.frustumCulled = false; fills.renderOrder = 0;

  // ---------------------------------------------------------------- genes: a point per gene and layer it has links in
  let nPts = 0; for (let k = 0; k < PRES.length; k++) nPts += PRES[k];
  const pp = new Float32Array(nPts * 3);
  { let o = 0; for (let l = 0; l < LN; l++) for (let i = 0; i < N; i++) if (PRES[i * LN + l]) { pp[o++] = i; pp[o++] = l; pp[o++] = 0; } }
  const ptGeo = new THREE.BufferGeometry(); ptGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const ptMat = new THREE.ShaderMaterial({
    uniforms: uni(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: K.GLSL + LOOK + `
varying vec3 vC; varying float vA, vS;
void main() {
  float g = position.x, l = position.y;
  vec3 col; vec4 q; vec2 xz, m; look(g, col, q, xz, m);
  vec4 L0 = lt(l, 0.0), L3 = lt(l, 3.0);
  float pulse = 0.5 + 0.5 * sin(uTime * 3.1 + g * 1.7);
  vC = col; vS = q.w; vA = (1.0 - 0.4 * uWalk) * clamp(q.x, 0.0, 1.4) * L0.y * uA * mix(L3.z, 1.0, max(q.w, m.y)) * (1.0 + 0.5 * q.w * uSeeds * pulse);
  vec4 mv = modelViewMatrix * vec4(xz.x, L0.x, xz.y, 1.0);
  gl_Position = projectionMatrix * mv;
  float sz = 0.0125 * (0.75 + 0.4 * min(q.x, 1.0)) * (1.0 + 0.45 * q.w + q.w * uSeeds * (0.35 + 0.3 * pulse)) * (1.0 + 0.6 * m.y);
  gl_PointSize = pointPx(sz, mv);
  if (vA < 0.006) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `varying vec3 vC; varying float vA, vS;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.2, d), glow = pow(1.0 - d * 2.0, 1.6);
  float a = max(core * 0.8, glow * 0.6);
  vec3 col = mix(vC, vec3(1.0), smoothstep(0.24, 0.0, d) * (0.25 + 0.65 * vS));
  gl_FragColor = vec4(col, vA * a);
}`,
  });
  set.mats.push(ptMat);
  const pts = new THREE.Points(ptGeo, ptMat); pts.frustumCulled = false; pts.renderOrder = 3;

  // ---------------------------------------------------------------- links: ribbons a little wider than a pixel
  // Every layer-link is drawn as a quad that faces the camera (one pixel lines all but vanished, more so in a headset),
  // from a list of entries (gene a, gene b, layer, rank) in one instanced geometry:
  // - the context links, chosen once: in each layer a share of its links, the same gene pairs in every layer (so a
  //   block of stacked layers shows one web and not a fog), short links (neighbourhoods) before long ones. Their rank
  //   (0..1) thins them a little more while something is selected; they turn a neutral blue-grey then;
  // - the highlighted links (rank + 2), listed again only when the selection changes: the module, the picked
  //   endotypes, the ringed gene, the walk's hottest links and, in the pair view, both groups. Where a link has both
  //   entries they add up to the brighter of its two looks.
  const LA = new Uint16Array(edgeCount), LB = new Uint16Array(edgeCount), LLY = new Uint8Array(edgeCount), CQ = new Float32Array(edgeCount);
  const CTX_N = { ppi: 400 }, CTX_DEF = 700;   // context links per layer, about (fewer in the protein block: 27 layers)
  const pairHash = (a, b) => {
    let h = Math.imul(Math.min(a, b) + 1, 0x9e3779b1) ^ Math.imul(Math.max(a, b) + 7, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  };
  // a pair's weight: short links first, pairs of hubs less often (each gene keeps about the square root of its links)
  // and fewer where genes crowd (the middle of the layout), so the web reads evenly across the disc instead of burning
  // out in the middle
  const DAV = new Float32Array(N), RHO = new Float32Array(N);
  for (let i = 0; i < N; i++) { let d = 0, n = 0; for (let l = 0; l < LN; l++) if (PRES[i * LN + l]) { d += deg(i, l); n++; } DAV[i] = n ? d / n : 1; }
  for (let i = 0; i < N; i++) for (let j = 0; j < i; j++) {
    const d2 = (BX[i] - BX[j]) ** 2 + (BZ[i] - BZ[j]) ** 2;
    if (d2 < 0.09) { const w = Math.exp(-d2 / 0.02); RHO[i] += w; RHO[j] += w; }
  }
  for (let i = 0; i < N; i++) RHO[i] = DAV[i] * (1 + RHO[i]);
  let nCtx = 0;
  { let k = 0;
    for (let l = 0; l < LN; l++) {
      const arr = LL[l], k0 = k; let ws = 0;
      for (let j = 0; j < arr.length; j += 2, k++) {
        const a = arr[j], b = arr[j + 1], dx = BX[a] - BX[b], dz = BZ[a] - BZ[b];
        LA[k] = a; LB[k] = b; LLY[k] = l;
        ws += CQ[k] = lerp(1.5, 0.35, smooth((Math.sqrt(dx * dx + dz * dz) - 0.15) / 0.7)) / Math.sqrt(RHO[a] * RHO[b]);
      }
      const share = (CTX_N[LAY[l].cat] || CTX_DEF) / Math.max(1e-9, ws);
      for (k = k0; k < k0 + arr.length / 2; k++) {
        const q = pairHash(LA[k], LB[k]) / (share * CQ[k]);
        CQ[k] = q < 1 ? q : 1.5;
        if (q < 1) nCtx++;
      }
    } }
  const lnBuf = new Float32Array(4 * (nCtx + edgeCount));
  { let o = 0; for (let k = 0; k < edgeCount; k++) if (CQ[k] < 1) { lnBuf[o] = LA[k]; lnBuf[o + 1] = LB[k]; lnBuf[o + 2] = LLY[k]; lnBuf[o + 3] = CQ[k]; o += 4; } }
  // a quad: position x = end (0 at a, 1 at b), y = side (-1, 1)
  const quadGeo = () => {
    const g = new THREE.InstancedBufferGeometry();
    g.setIndex([0, 2, 1, 1, 2, 3]); g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0], 3));
    return g;
  };
  const lnGeo = quadGeo(), lnAttr = new THREE.InstancedBufferAttribute(lnBuf, 4);
  lnAttr.setUsage(THREE.DynamicDrawUsage); lnGeo.setAttribute('aLink', lnAttr); lnGeo.instanceCount = nCtx;
  // a ribbon from a to b (local coordinates) facing the camera, w local units wide but kept between wMin and wMax
  // pixels as point sizes are (uPx is half the view's height in pixels times the world's scale)
  const RIBBON = `
varying float vS;
vec4 ribbon(vec3 a, vec3 b, float end, float side, float w, float wMin, float wMax) {
  vec4 A = modelViewMatrix * vec4(a, 1.0), B = modelViewMatrix * vec4(b, 1.0);
  vec3 P = mix(A.xyz, B.xyz, end), n = cross(B.xyz - A.xyz, P);
  float nl = length(n), sc = length(modelViewMatrix[0].xyz);
  n = nl > 1e-12 ? n / nl : vec3(0.0);
  float pxU = uPx / sc * projectionMatrix[1][1] / max(-P.z, 0.01);
  float px = clamp(w * sc * pxU, wMin, wMax);
  vS = side;
  return projectionMatrix * vec4(P + n * (side * 0.5 * px / pxU), 1.0);
}
`;
  // across the ribbon: full in the middle, soft at the edges
  const RIBBON_FRAG = `varying vec3 vC; varying float vA, vS;
void main() { float a = vA * (1.0 - abs(vS * vS * vS)); if (a < 0.0015) discard; gl_FragColor = vec4(vC, a); }`;
  const LK = { ctx: 0.11, busy: 0.8, sel: 0.85, down: 0.4, mod: 0.36, seed: 0.6, pair: 0.6, hot: 0.25, within: 0.5, betw: 0.42, gene: 0.5,
    wCtx: 0.0062, wHi: 0.0105, wMin: 1.1, wMaxC: 2.2, wMaxH: 3.6 };
  const lnMat = new THREE.ShaderMaterial({
    uniforms: uni(), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: K.GLSL + LOOK + RIBBON + `
attribute vec4 aLink;
varying vec3 vC; varying float vA;
void main() {
  float g = aLink.x, o = aLink.y, l = aLink.z, hiE = step(1.5, aLink.w), q = aLink.w - 2.0 * hiE, e = position.x;
  vec4 L0 = lt(l, 0.0), L1 = lt(l, 1.0), L3 = lt(l, 3.0);
  float live = L0.y * uA;
  vA = 0.0; vC = vec3(0.0); vS = 0.0;
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  if (live > 0.002) {
    vec3 ca, cb; vec4 qa, qb; vec2 xa, xb, ma, mb;
    look(g, ca, qa, xa, ma); look(o, cb, qb, xb, mb);
    float sel = mix(uSl0.x, uSl1.x, uX), pk = mix(uSl0.y, uSl1.y, uX), gn = mix(uSl0.z, uSl1.z, uX), hv = uHeat * mix(uSl0.w, uSl1.w, uX);
    vec3 pa = vec3(xa.x, L0.x, xa.y), pb = vec3(xb.x, L0.x, xb.y);
    // long links cross the whole disc: they are dimmed a little, the short ones (neighbourhoods) carry the picture
    float len = distance(xa, xb), near = mix(1.0, 0.45, smoothstep(0.25, 0.95, len)), nearM = mix(1.0, 0.7, smoothstep(0.3, 1.1, len));
    // looking down the tower, the copies of a gene pair in a block's layers fall on one line
    float down = smoothstep(0.6, 0.97, abs(dot(normalize(modelViewMatrix[1].xyz), normalize((modelViewMatrix * vec4(pa, 1.0)).xyz))));
    // context: in the genes' colours at rest, blue-grey (and a little thinner) while something is selected
    float busy = max(max(sel, pk), max(hv, uPair));
    float frac = mix(1.0, ${f1(LK.sel)}, sel) * (1.0 - 0.25 * pk) * (1.0 - 0.6 * uGrid) * (1.0 - uPair);
    float ctxA = (1.0 - smoothstep(frac - 0.12, frac, q)) * ${f1(LK.ctx)} * mix(1.0, ${f1(LK.busy)}, busy) * L3.w * near * mix(1.0, ${f1(LK.down)}, down);
    vec3 na = mix(ca, vec3(0.42, 0.56, 0.82), busy), nb = mix(cb, vec3(0.42, 0.56, 0.82), busy);
    // highlighted: the module (its seeds' links brighter), the pair view's two groups
    float both = qa.y * qb.y, sb = qa.w * qb.w;
    float mod_ = both * (${f1(LK.mod)} * mix(uMK.x, uMK.y, uX) + ${f1(LK.seed)} * sb * max(uSeeds, uSeedOnly * uPair)) * nearM * (1.0 - 0.2 * uWalk);
    float hiA = sel * mod_ * (1.0 - uPair) + uPair * both * ${f1(Math.round(LK.pair * PKF * 1000) / 1000)} * nearM;
    // the walk: the links between the genes it visits most, in the heat's colours (those between start genes less: the
    // walk found the others)
    float h0 = mix(uHot.x, uHot.y, uX), hm = hv > 0.0 ? min(heatAt(g), heatAt(o)) : 0.0;
    float hot = clamp((hm - h0) / max(0.05, 0.3 * (1.0 - h0)), 0.0, 1.0);
    hiA = max(hiA, hv * (1.0 - uPair) * hot * hot * (3.0 - 2.0 * hot) * ${f1(LK.hot)} * (1.0 - 0.6 * step(0.999, hm)));
    vec3 ka = ca, kb = cb;
    // picked endotypes: links within one in its colour, links between two in amber
    if (pk > 0.001) {
      float within = 0.0, any_a = step(0.5, ma.x), any_b = step(0.5, mb.x);
      for (int k = 0; k < 8; k++) within = max(within, bit(ma.x, float(k)) * bit(mb.x, float(k)));
      float betw = any_a * any_b * (1.0 - within);
      hiA = mix(hiA, within * ${f1(LK.within)} + betw * ${f1(LK.betw)}, pk);
      ka = mix(ka, vec3(1.0, 0.71, 0.23), betw * pk); kb = mix(kb, vec3(1.0, 0.71, 0.23), betw * pk);
    }
    float gq = max(ma.y, mb.y) * gn;
    hiA = max(hiA, gq * ${f1(LK.gene)});
    float wide = smoothstep(0.04, 0.3, hiA);   // before the layer's weight: a module link is as wide in the protein block
    // from above, or in the squashed grid, the copies of a link in the stacked layers fall on one line
    hiA *= L1.w * mix(1.0, 0.55, max(down, uGrid));
    ka = mix(ka, mix(ca, vec3(1.0), 0.45), gq); kb = mix(kb, mix(cb, vec3(1.0), 0.45), gq);
    float a = (hiE > 0.5 ? max(0.0, hiA - ctxA) : ctxA) * live;
    if (a > 0.002) {
      vA = a; vC = hiE > 0.5 ? mix(ka, kb, e) : mix(na, nb, e);
      float w = hiE > 0.5 ? mix(${f1(LK.wCtx)}, ${f1(LK.wHi)}, wide) : ${f1(LK.wCtx)};
      gl_Position = ribbon(pa, pb, e, position.y, w, ${f1(LK.wMin)}, hiE > 0.5 ? ${f1(LK.wMaxH)} : ${f1(LK.wMaxC)});
    }
  }
}`,
    fragmentShader: RIBBON_FRAG,
  });
  set.mats.push(lnMat);
  const links = new THREE.Mesh(lnGeo, lnMat); links.frustumCulled = false; links.renderOrder = 2;

  // the walk's hottest links: the least heat both ends need so that at most HOTN links that reach beyond the start
  // genes qualify (a histogram of the smaller end's heat, counted from the top); links between start genes (heat 1)
  // always do (Cardiomyopathies' 115 seeds have 3,789)
  const HOTN = 1500;
  function hotMin(hv) {
    if (!hv) return 2;
    const H = new Int32Array(256);
    for (let k = 0; k < edgeCount; k++) { const m = Math.min(hv[LA[k]], hv[LB[k]]); if (m < 1) H[Math.floor(m * 256)]++; }
    let n = 0, b = 255;
    while (b > 0 && n + H[b] <= HOTN) n += H[b--];
    return Math.max(0.15, (b + 1) / 256);
  }
  // list the highlighted entries again (after the context ones) when the slots, the pair view or the heat change, and
  // once the cross-fade from the previous selection (slot 0) is over. Per gene and slot: bit 1 module member, 2 picked,
  // 4 ringed, 8 hot (slot 1 four bits up). A link is listed when both ends share a bit of 1, 2 or 8, or one end is
  // ringed, or (pair view) both ends are in one of the two groups.
  const GF = new Uint8Array(N);
  let listKey = '', nHi = 0;
  function listLinks(pairOn, heatOn, fading) {
    const key = slotGen + (pairOn ? 'p' : '') + (heatOn ? 'h' : '') + (fading ? 'f' : '');
    if (key === listKey) return;
    listKey = key; GF.fill(0);
    for (let s = fading ? 0 : 1; s < 2; s++) {
      const e = slotInfo[s]; if (!e) continue;
      const g = e.group, hv = heatOn ? e.heat || (g >= 0 ? HEAT[g] : null) : null, h0 = TU.uHot.value.getComponent(s);
      for (let i = 0; i < N; i++) {
        const f = (inG(i, g) ? 1 : 0) | (gget(i, 4 * s, 2) > 0.5 ? 2 : 0) | (i === e.gene ? 4 : 0) | (hv && hv[i] > h0 ? 8 : 0);
        GF[i] |= f << (4 * s);
      }
    }
    let o = 4 * nCtx;
    for (let k = 0; k < edgeCount; k++) {
      const a = LA[k], b = LB[k], fa = GF[a], fb = GF[b];
      if ((fa & fb & 0xbb) || ((fa | fb) & 0x44) || (pairOn && PCLS[a] && PCLS[b])) {
        lnBuf[o] = a; lnBuf[o + 1] = b; lnBuf[o + 2] = LLY[k]; lnBuf[o + 3] = 2 + CQ[k]; o += 4;
      }
    }
    nHi = o / 4 - nCtx;
    lnAttr.updateRange.offset = 4 * nCtx; lnAttr.updateRange.count = Math.max(4, 4 * nHi); lnAttr.needsUpdate = true;
    lnGeo.instanceCount = nCtx + nHi;
  }

  // ---------------------------------------------------------------- threads: one vertical ribbon per gene, top to bottom copy
  const TOPL = new Int16Array(N).fill(-1), BOTL = new Int16Array(N).fill(-1);
  for (let i = 0; i < N; i++) for (let l = 0; l < LN; l++) if (PRES[i * LN + l]) { if (TOPL[i] < 0) TOPL[i] = l; BOTL[i] = l; }
  const thr = [...Array(N).keys()].filter(i => TOPL[i] >= 0 && BOTL[i] > TOPL[i]);
  const tp = new Float32Array(thr.length * 4);
  thr.forEach((i, k) => tp.set([i, TOPL[i], BOTL[i], 0], 4 * k));
  const thGeo = quadGeo(); thGeo.setAttribute('aThr', new THREE.InstancedBufferAttribute(tp, 4)); thGeo.instanceCount = thr.length;
  const thMat = new THREE.ShaderMaterial({
    uniforms: uni(), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: K.GLSL + LOOK + RIBBON + `
attribute vec4 aThr;
varying vec3 vC; varying float vA;
void main() {
  float g = aThr.x, e = position.x;
  vec3 col; vec4 q; vec2 xz, m; look(g, col, q, xz, m);
  vec4 T2 = lt(aThr.y, 2.0), B2 = lt(aThr.z, 2.0);
  vC = col; vA = q.z * 0.7 * mix(T2.w, B2.w, e) * uA; vS = 0.0;
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  if (q.z * uA > 0.004) gl_Position = ribbon(vec3(xz.x, T2.z, xz.y), vec3(xz.x, B2.z, xz.y), e, position.y, 0.0055, 1.0, 2.4);
}`,
    fragmentShader: RIBBON_FRAG,
  });
  set.mats.push(thMat);
  const threads = new THREE.Mesh(thGeo, thMat); threads.frustumCulled = false; threads.renderOrder = 2;

  // ---------------------------------------------------------------- z bars: a box sticking out of the rim of each protein layer
  const zLayers = D.ppi.slice();
  const bv = [], bn = [], bl = [];
  { const C = [[0, -1, -1], [1, -1, -1], [1, 1, -1], [0, 1, -1], [0, -1, 1], [1, -1, 1], [1, 1, 1], [0, 1, 1]];
    const F = [[0, 1, 2, 3, [0, 0, -1]], [5, 4, 7, 6, [0, 0, 1]], [4, 0, 3, 7, [-1, 0, 0]], [1, 5, 6, 2, [1, 0, 0]], [3, 2, 6, 7, [0, 1, 0]], [4, 5, 1, 0, [0, -1, 0]]];
    for (const l of zLayers) for (const [a, b, c, d, n] of F) for (const v of [a, b, c, a, c, d]) { bv.push(...C[v]); bn.push(...n); bl.push(l); } }
  const barGeo = new THREE.BufferGeometry();
  barGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bv), 3));
  barGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(bn), 3));
  barGeo.setAttribute('aL', new THREE.BufferAttribute(new Float32Array(bl), 1));
  const barMat = new THREE.ShaderMaterial({
    uniforms: uni({ uC: { value: new THREE.Color(1, 1, 1) } }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: LOOK + `
attribute float aL;
uniform vec3 uC;
varying vec3 vC; varying float vA;
void main() {
  vec4 L0 = lt(aL, 0.0), L2 = lt(aL, 2.0), L3 = lt(aL, 3.0);
  vec2 d = vec2(${f1(BAR[0])}, ${f1(BAR[1])}), s = vec2(-d.y, d.x);
  float r = 1.015 + position.x * L2.x;
  vec2 xz = d * r + s * position.z * 0.012;
  float hgt = ${f1(SP * 0.36)};
  vec3 n = normalize(vec3(d.x * normal.x + s.x * normal.z, normal.y, d.y * normal.x + s.y * normal.z));
  float sh = 0.55 + 0.45 * max(0.0, dot(n, normalize(vec3(-0.4, 0.7, 0.6))));
  vC = mix(vec3(0.45, 0.52, 0.64), uC, L3.y) * sh * (0.6 + 0.4 * position.x);
  vA = L2.y * mix(0.35, 0.95, L3.y) * uA;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(xz.x, L0.x + position.y * hgt, xz.y, 1.0);
  if (vA < 0.004 || L2.x < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `varying vec3 vC; varying float vA;
void main() { gl_FragColor = vec4(vC, vA); }`,
  });
  set.mats.push(barMat);
  const bars = new THREE.Mesh(barGeo, barMat); bars.frustumCulled = false; bars.renderOrder = 4;
  // the significance threshold: a dashed vertical line where the bars pass z = 1.645
  const zr = 1.015 + ZMIN * BARS, zTop = PPI_TOP + SP, zBot = D.ppi.length ? Math.min(...D.ppi.map(l => LY[l])) - SP : 0, zp = [];
  for (let k = 0, n = 24; k < n; k++) { const y0 = lerp(zBot, zTop, k / n), y1 = lerp(zBot, zTop, (k + 0.55) / n); zp.push(BAR[0] * zr, y0, BAR[1] * zr, BAR[0] * zr, y1, BAR[1] * zr); }
  const zlGeo = new THREE.BufferGeometry(); zlGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(zp), 3));
  const zlMat = K.fade(set, new THREE.LineBasicMaterial({ color: 0xffb43b, depthWrite: false, blending: THREE.AdditiveBlending }), 0.6);
  const zline = new THREE.LineSegments(zlGeo, zlMat); zline.renderOrder = 4;

  // ---------------------------------------------------------------- walkers and the gene ring (small, rewritten per frame)
  const NW = 20, TR = 7, wGeo = K.pointsGeo(NW * TR), wMat = K.points(set);
  const walkers = new THREE.Points(wGeo, wMat); walkers.frustumCulled = false; walkers.renderOrder = 5;
  const ringPts = K.pointsGeo(LN);
  const ringPMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: K.GLSL + `
attribute vec3 aCol; attribute float aSize, aA; uniform float uA; varying vec3 vC; varying float vA;
void main() { vC = aCol; vA = aA * uA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize, mv); if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }`,
    fragmentShader: `varying vec3 vC; varying float vA;
void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.42, d) * smoothstep(0.28, 0.36, d); if (a < 0.01) discard; gl_FragColor = vec4(vC, vA * a); }`,
  });
  set.mats.push(ringPMat);
  const geneRing = new THREE.Points(ringPts, ringPMat); geneRing.frustumCulled = false; geneRing.renderOrder = 5;
  set.group.add(fills, rings, links, threads, pts, bars, zline, walkers, geneRing);

  // ---------------------------------------------------------------- CPU mirror of the shader (anchors, pick, walkers)
  const U = n => TU[n].value;
  function slotPos(i, s, bx, bz) {
    const g = U('uGrid'), o = (4 * s * N + i) * 4;
    return [lerp(bx, gtd[o], g), lerp(bz, gtd[o + 1], g)];
  }
  // a gene's current spot (x, z) in every layer
  function genePos(i) {
    let bx = BX[i], bz = BZ[i]; const r = Math.hypot(bx, bz), f = lerp(1, (ROOM + (1 - ROOM) * r) / Math.max(r, 1e-4), U('uRoom'));
    bx *= f; bz *= f;
    let p = slotPos(i, 1, bx, bz); const X = U('uX');
    if (X < 0.999) { const p0 = slotPos(i, 0, bx, bz); p = [lerp(p0[0], p[0], X), lerp(p0[1], p[1], X)]; }
    const P = U('uPair');
    return P > 0.001 ? [lerp(p[0], PPOS[2 * i], P), lerp(p[1], PPOS[2 * i + 1], P)] : p;
  }
  function slotVis(i, s) {
    const sl = SL[s], member = gget(i, 4 * s + 1, 3), seed = gget(i, 4 * s + 2, 3) * member, heat = gget(i, 4 * s + 3, 0), rank = gget(i, 4 * s + 3, 1);
    const joined = smooth((U('uModule') * 1.03 - rank) / 0.025), mv = member * (seed > 0.5 ? 1 : 1 - U('uSeeds') * (1 - joined));
    let vis = sl.x > 0.5 ? lerp(0.09, 1, mv) : 0.42;
    const hv = U('uHeat') * sl.w; vis = lerp(vis, Math.max(vis * 0.35, heat * (0.25 + 0.75 * mv)), hv);
    if (sl.y > 0.5) vis = gget(i, 4 * s, 2) > 0.5 ? 1 : vis * 0.25;
    if (sl.z > 0.5 && gget(i, 4 * s, 3) > 0.5) vis = 1;
    return vis;
  }
  function geneVis(i) {
    let v = slotVis(i, 1); const X = U('uX'); if (X < 0.999) v = lerp(slotVis(i, 0), v, X);
    const P = U('uPair');
    if (P > 0.001) { const pv = PCLS[i] ? ((PFLAG[i] & 1) ? 1 : 1 - U('uSeedOnly') * 0.9) : 0; v = lerp(v, pv, P); }
    return v;
  }

  // ---------------------------------------------------------------- the random walk with restart (explore)
  function defaultWeights(g, on) {
    const w = new Float64Array(LN);
    if (g >= 0) for (let p = 0; p < PN; p++) { const z = GR[g].z[p]; if (z >= ZMIN) w[D.ppi[p]] = z; }
    if (!w.some(x => x > 0)) for (const l of D.ppi) w[l] = 1;
    for (let l = 0; l < LN; l++) if ((on && !on[l]) || !hasData[l]) w[l] = 0;
    return w;
  }
  const effGroup = () => (slotInfo[1] ? slotInfo[1].group : -1);
  function walk(seeds, opts = {}) {
    seeds = [...new Set((seeds || []).filter(i => i >= 0 && i < N))];
    const on = opts.on || Array.from({ length: LN }, (_, l) => !state.off.has(l));
    let w;
    if (opts.weights) { w = Float64Array.from({ length: LN }, (_, l) => (on[l] && hasData[l] ? Math.max(0, +opts.weights[l] || 0) : 0)); }
    else w = defaultWeights(opts.group !== undefined ? opts.group : effGroup(), on);
    const act = []; for (let l = 0; l < LN; l++) if (w[l] > 0) act.push(l);
    const heat = new Float32Array(N), top = [];
    if (!seeds.length || !act.length) return { heat, top, weights: Array.from(w) };
    const WS = w.reduce((s, x) => s + x, 0); for (const l of act) w[l] /= WS;
    const A = act.length, p0 = new Float64Array(A * N);
    let s0 = 0;
    for (const s of seeds) {
      let t = 0; act.forEach(l => { if (deg(s, l)) t += w[l]; });
      if (t > 0) act.forEach((l, a) => { if (deg(s, l)) { p0[a * N + s] += w[l] / t; s0 += w[l] / t; } });
    }
    if (s0 > 0) for (let k = 0; k < p0.length; k++) p0[k] /= s0;
    // at each gene: the summed weight of the active layers it has links in (where a switch can go)
    const wsum = new Float64Array(N);
    for (let i = 0; i < N; i++) act.forEach(l => { if (deg(i, l)) wsum[i] += w[l]; });
    let x = p0.slice(), nx = new Float64Array(A * N); const sw = new Float64Array(N);
    for (let it = 0; it < 80; it++) {
      nx.fill(0); sw.fill(0); let lost = 0;
      for (let a = 0; a < A; a++) {
        const l = act[a], { off, nb } = ADJ[l];
        for (let i = 0; i < N; i++) {
          const m = x[a * N + i]; if (!m) continue;
          const move = m * (1 - RESTART);
          if (wsum[i] <= 0) { lost += move; continue; }
          sw[i] += move * SWITCH;
          const st = move * (1 - SWITCH), d0 = off[i], d1 = off[i + 1];
          if (d1 === d0) { lost += st; continue; }
          const dv = st / (d1 - d0); for (let k = d0; k < d1; k++) nx[a * N + nb[k]] += dv;
        }
      }
      // the switched mass moves to the layers of its gene by weight, then steps to a neighbour there
      for (let i = 0; i < N; i++) {
        if (!sw[i]) continue;
        for (let a = 0; a < A; a++) {
          const l = act[a]; if (!deg(i, l)) continue;
          const { off, nb } = ADJ[l], d0 = off[i], d1 = off[i + 1], dv = sw[i] * w[l] / wsum[i] / (d1 - d0);
          for (let k = d0; k < d1; k++) nx[a * N + nb[k]] += dv;
        }
      }
      let diff = 0;
      for (let k = 0; k < nx.length; k++) { const v = nx[k] + (RESTART + lost) * p0[k]; diff += Math.abs(v - x[k]); nx[k] = v; }
      const tmp = x; x = nx; nx = tmp;
      if (diff < 1e-9) break;
    }
    const score = new Float64Array(N);
    for (let a = 0; a < A; a++) for (let i = 0; i < N; i++) score[i] += x[a * N + i];
    const seedSet = new Set(seeds); let mx = 0;
    for (let i = 0; i < N; i++) if (!seedSet.has(i)) mx = Math.max(mx, score[i]);
    for (let i = 0; i < N; i++) heat[i] = seedSet.has(i) ? 1 : mx > 0 ? Math.min(254 / 255, (254 / 255) * Math.sqrt(score[i] / mx)) : 0;
    for (let i = 0; i < N; i++) if (!seedSet.has(i) && score[i] > 1e-12) top.push(i);
    top.sort((a, b) => heat[b] - heat[a] || a - b);
    lastWalk = { seeds, w: Array.from(w), id: ++walkId };
    return { heat, top, weights: Array.from(w) };
  }
  let lastWalk = null, walkId = 0;

  // walkers: ~20 sparks with planned, seeded paths. Events: 0 hop along a link, 1 switch layer along the thread,
  // 2 restart (flash back to a seed)
  let plan = null, planKey = '';
  function makePlan(seeds, w, member, key) {
    const R = rng(9001 + key.length * 131 + seeds.length * 7 + (seeds[0] || 0));
    const pickL = i => { let t = 0; for (let l = 0; l < LN; l++) if (w[l] > 0 && deg(i, l)) t += w[l]; if (t <= 0) return -1;
      let x = R() * t; for (let l = 0; l < LN; l++) if (w[l] > 0 && deg(i, l)) { x -= w[l]; if (x <= 0) return l; } return -1; };
    const nbrs = (i, l) => { const { off, nb } = ADJ[l], o = []; for (let k = off[i]; k < off[i + 1]; k++) if (!member || member[nb[k]]) o.push(nb[k]); return o; };
    const starts = seeds.filter(s => pickL(s) >= 0);
    if (!starts.length) return null;
    const out = [];
    for (let k = 0; k < NW; k++) {
      let a = starts[Math.floor(R() * starts.length)], la = pickL(a), t = 0;
      const ev = [];
      for (let n = 0; n < 48; n++) {
        if (n > 0 && R() < RESTART) {
          const b = starts[Math.floor(R() * starts.length)], lb = pickL(b);
          ev.push([a, la, b, lb, 2, t, 0.32]); t += 0.32; a = b; la = lb; continue;
        }
        if (R() < SWITCH) { const lb = pickL(a); if (lb >= 0 && lb !== la) { ev.push([a, la, a, lb, 1, t, 0.38]); t += 0.38; la = lb; } }
        const nb = nbrs(a, la);
        if (!nb.length) { const b = starts[Math.floor(R() * starts.length)], lb = pickL(b); ev.push([a, la, b, lb, 2, t, 0.32]); t += 0.32; a = b; la = lb; continue; }
        const b = nb[Math.floor(R() * nb.length)];
        ev.push([a, la, b, la, 0, t, 0.55]); t += 0.55; a = b;
      }
      out.push({ ev, T: t, ph: R() * t });
    }
    return out;
  }
  function ensurePlan(g, live) {
    const key = live && lastWalk ? 'w' + lastWalk.id : 'g' + g;
    if (key === planKey) return plan;
    planKey = key;
    if (live && lastWalk) plan = makePlan(lastWalk.seeds, lastWalk.w, null, key);
    else if (g >= 0) { const m = new Uint8Array(N); for (const i of MEM[g]) m[i] = 1; plan = makePlan(SEEDS[g], defaultWeights(g, null), m, key); }
    else plan = null;
    return plan;
  }
  function walkerAt(wk, tt) {
    const T = wk.T; tt = ((tt % T) + T) % T;
    let lo = 0, hi = wk.ev.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (wk.ev[m][5] <= tt) lo = m; else hi = m - 1; }
    const [a, la, b, lb, kind, t0, du] = wk.ev[lo], f = clamp((tt - t0) / du, 0, 1);
    const pa = genePos(a), pb = genePos(b);
    if (kind === 2) return { p: f < 0.5 ? [pa[0], LYC[la], pa[1]] : [pb[0], LYC[lb], pb[1]], kind, f, ev: lo };
    const e = smooth(f);
    return { p: [lerp(pa[0], pb[0], e), lerp(LYC[la], LYC[lb], e), lerp(pa[1], pb[1], e)], kind, f, ev: lo };
  }

  // ---------------------------------------------------------------- explore state
  const state = { group: -1, gene: -1, pick: [], off: new Set(), heat: null, walk: false };
  let pending = null, heatId = 0;
  function setState(p) {
    pending = Object.assign(pending || {}, p || {});
    if (p && 'heat' in p) pending.heatId = ++heatId;
  }
  const offT = new Float64Array(LN).fill(-1e9), offOn = new Uint8Array(LN);
  let sig = null, tChange = 0, lastT = 0;
  // drop order: a fixed random order, the last five are protein layers (so the module has somewhere to stay lit)
  const DROP = (() => {
    const R = rng(1645), sh = a => { for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(R() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
    const keep = sh(D.ppi.slice()).slice(0, 5), rest = sh([...Array(LN).keys()].filter(l => !keep.includes(l)));
    const o = new Int16Array(LN); rest.concat(keep).forEach((l, k) => { o[l] = k; }); return o;
  })();
  const zOf = (g, l) => (g >= 0 && PPI_OF[l] >= 0 && GR[g].z ? GR[g].z[PPI_OF[l]] : undefined);
  const cur = { group: -1, t: 0, S: null };

  // ---------------------------------------------------------------- update
  const NEU = NEUTRAL, CC = {}; for (const c in CATC) CC[c] = rgb(CATC[c]);
  function update(S, t) {
    if (pending) {
      const p = pending; pending = null;
      if ('group' in p) state.group = p.group === null || p.group === undefined ? -1 : p.group | 0;
      if ('gene' in p) state.gene = p.gene === null || p.gene === undefined ? -1 : p.gene | 0;
      if ('pick' in p) state.pick = (p.pick || []).map(x => [x[0] | 0, x[1] | 0]);
      if ('heat' in p) { state.heat = p.heat || null; state.heatId = p.heatId; }
      if ('walk' in p) state.walk = !!p.walk;
      if ('off' in p) {
        const nu = new Set(p.off ? [...p.off].map(Number) : []);
        for (let l = 0; l < LN; l++) { const v = nu.has(l) ? 1 : 0; if (v !== offOn[l]) { offOn[l] = v; offT[l] = t; } }
        state.off = nu;
      }
    }
    if (t < lastT - 0.5) { tChange = Math.min(tChange, t - 10); for (let l = 0; l < LN; l++) offT[l] = Math.min(offT[l], t - 10); }
    // a jump of the clock (a seek) shows the new selection at once: a cross-fade begun then would wait, paused, half done
    const jumped = Math.abs(t - lastT) > 0.5;
    lastT = t;
    // the selection: explore state wins over the params
    const g = state.group >= 0 && state.group < GN ? state.group : clamp(Math.round(S.tower_group || 0), 0, GN) - 1;
    const eff = { group: g, gene: state.gene, pick: state.pick, heat: state.heat };
    const s2 = [g, state.gene, JSON.stringify(state.pick), state.heat ? state.heatId : 0].join('|');
    if (sig === null) { writeSlot(1, eff); shiftSlots(); sig = s2; tChange = t - 10; }
    else if (s2 !== sig) { shiftSlots(); writeSlot(1, eff); sig = s2; tChange = jumped ? t - 10 : t; }
    const X = clamp((t - tChange) / 0.7, 0, 1);
    TU.uX.value = smooth(X);
    const P = smooth(clamp(S.tower_pair, 0, 1)), Z = clamp(S.tower_z, 0, 1) * (1 - P);
    TU.uSeeds.value = clamp(S.tower_seeds, 0, 1); TU.uHeat.value = clamp(S.tower_heat, 0, 1); TU.uModule.value = clamp(S.tower_module, 0, 1);
    TU.uEndo.value = clamp(S.tower_endo, 0, 1); TU.uGrid.value = smooth(clamp(S.tower_grid, 0, 1)) * (1 - P); TU.uPair.value = P;
    TU.uSeedOnly.value = clamp(S.tower_seedonly, 0, 1); TU.uRoom.value = smooth(clamp(S.tower_room, 0, 1)); TU.uDrop.value = clamp(S.tower_drop, 0, 1);
    TU.uZ.value = Z; TU.uWalk.value = Math.max(clamp(S.tower_walk, 0, 1), state.walk ? 1 : 0) * (1 - P);
    listLinks(P > 0.001, TU.uHeat.value > 0.001, X < 1);
    const g0 = slotInfo[0] ? slotInfo[0].group : -1, g1 = g, XX = TU.uX.value;
    // layers
    const rise = clamp(S.tower_rise === undefined ? 1 : S.tower_rise, 0, 1), catsT = clamp(S.tower_cats, 0, 1), drop = TU.uDrop.value;
    const gcol = g1 >= 0 ? GC[g1] : [1, 1, 1], Gr = TU.uGrid.value;
    // a block's layers lie on top of each other on screen: links are weighted by the live layers of their block, so
    // the stack never burns out (and the few layers left at the end of the drop shine brighter)
    const LF0 = LFr, liveCat = {};
    for (let l = 0; l < LN; l++) {
      const fb = (LN - 1 - l) / LN, f = smooth(clamp((rise * 1.12 - fb) / 0.12, 0, 1));
      const df = smooth(clamp(drop * (LN - 5) - DROP[l], 0, 1));
      const ofF = offOn[l] ? smooth((t - offT[l]) / 0.5) : 1 - smooth((t - offT[l]) / 0.5);
      LF0[3 * l] = f; LF0[3 * l + 1] = df; LF0[3 * l + 2] = ofF;
      if (hasData[l]) liveCat[LAY[l].cat] = (liveCat[LAY[l].cat] || 0) + f * (1 - df) * (1 - ofF);
    }
    for (let l = 0; l < LN; l++) {
      const fb = (LN - 1 - l) / LN, f = LF0[3 * l], df = LF0[3 * l + 1], ofF = LF0[3 * l + 2];
      // z: cross-fades with the selection
      const z0 = zOf(g0, l), z1 = zOf(g1, l), zv = lerp(z0 === undefined ? 0 : z0, z1 === undefined ? 0 : z1, XX);
      const has0 = z0 !== undefined, has1 = z1 !== undefined, hasZ = lerp(has0 ? 1 : 0, has1 ? 1 : 0, XX);
      const zn = clamp(zv / 8, 0, 1), inf = zv >= ZMIN ? 1 : 0;
      const pg = PAIR_GLOW[l] * P;
      const ry = lerp(LY[l], flatY(l), Gr), y = ry - 0.13 * df * (1 - 0.8 * Gr) - 0.1 * (1 - f);
      const live = f * (1 - df);
      const content = live * (1 - ofF);
      let rimA = live * (hasData[l] ? 0.3 : 0.2) * (1 - 0.55 * ofF);
      rimA *= 1 + Z * hasZ * (inf ? 0.2 + 1.6 * zn : -0.5);
      rimA *= 1 + pg * 2.2 - P * (1 - PAIR_GLOW[l]) * 0.25;
      rimA *= 1 - 0.82 * Gr;          // squashed together, 71 rims would make one glaring ring
      let fillA = live * (1 - ofF) * (hasData[l] ? 0.011 : 0.004) * (1 + 0.6 * catsT);
      fillA += live * (Z * hasZ * inf * zn * 0.007 + pg * 0.03);
      fillA *= 1 - 0.85 * Gr;
      const tint = CC[LAY[l].cat] || NEU, cm = 0.25 + 0.75 * catsT;
      let c = [lerp(NEU[0], tint[0], cm), lerp(NEU[1], tint[1], cm), lerp(NEU[2], tint[2], cm)];
      const zc = Z * hasZ * inf * (0.25 + 0.6 * zn); c = [lerp(c[0], gcol[0], zc), lerp(c[1], gcol[1], zc), lerp(c[2], gcol[2], zc)];
      if (pg > 0) c = [lerp(c[0], 1, pg * 0.35), lerp(c[1], 1, pg * 0.35), lerp(c[2], 1, pg * 0.35)];
      let lw = lerp(1, hasZ > 0.5 ? (inf ? 0.55 + 0.45 * zn / 0.6 : 0.3) : 1, Z);
      lw *= 1 + pg * 0.8 - P * (1 - PAIR_GLOW[l]) * 0.15;
      // the context links are thinned per layer already: they are weighted less steeply
      const lc = Math.max(1, liveCat[LAY[l].cat] || 1), cw = lw * clamp(Math.sqrt(4 / lc), 0.3, 0.75);
      lw *= clamp(4 / lc, 0.18, 1);
      // bars rise up the tower one after another
      const grow = smooth(clamp((Z * 1.4 - fb * 0.4) / 1.0, 0, 1)) * hasZ;
      const o = l * 4;
      ltn.set([y, content, rimA, fillA], o);
      ltn.set([c[0], c[1], c[2], lw], LN * 4 + o);
      ltn.set([zv * BARS * grow, grow * live, ry, f], 2 * LN * 4 + o);
      ltn.set([hasData[l] ? 0 : 1, inf, clamp(9 / lc, 0.35, 1), cw], 3 * LN * 4 + o);
      LYC[l] = y; LCONT[l] = content;
    }
    let ch = false; for (let k = 0; k < ltn.length; k++) if (ltn[k] !== ltd[k]) { ch = true; break; }
    if (ch) { ltd.set(ltn); LT.needsUpdate = true; }
    barMat.uniforms.uC.value.setRGB(gcol[0], gcol[1], gcol[2]);
    bars.visible = Z > 0.003 && g1 >= 0;
    zline.visible = bars.visible; zlMat.opacity = 0.55 * Z * set.uA.value;
    threads.visible = true;
    // walkers
    const liveW = state.walk && lastWalk, wv = Math.max(clamp(S.tower_walk, 0, 1), state.walk ? 1 : 0) * (1 - P);
    walkers.visible = false;
    if (wv > 0.003 && (liveW || g1 >= 0)) {
      const pl = ensurePlan(g1, liveW);
      if (pl) {
        walkers.visible = true;
        const pa = wGeo.attributes.position.array, ca = wGeo.attributes.aCol.array, sa = wGeo.attributes.aSize.array, aa = wGeo.attributes.aA.array;
        const tint = liveW ? [0.6, 0.95, 1] : gcol;
        pl.forEach((wk, k) => {
          const h = walkerAt(wk, t + wk.ph);
          for (let j = 0; j < TR; j++) {
            const q = j ? walkerAt(wk, t + wk.ph - j * 0.045) : h, n = k * TR + j;
            // a trail never spans a restart
            const ok = j === 0 || (q.ev === h.ev && h.kind !== 2) || (q.ev === h.ev - 1 && q.kind !== 2 && h.kind !== 2);
            pa[3 * n] = q.p[0]; pa[3 * n + 1] = q.p[1] + 0.004; pa[3 * n + 2] = q.p[2];
            const fl = h.kind === 2 && h.f >= 0.5 && j === 0 ? 1 - (h.f - 0.5) * 2 : 0;
            const fade = h.kind === 2 && h.f < 0.5 && j === 0 ? 1 - h.f * 2 : 1;
            const cl = j === 0 ? [1, 0.97, 0.88] : tint;
            ca.set(cl, 3 * n);
            sa[n] = j === 0 ? 0.05 + 0.07 * fl : 0.036 * (1 - 0.7 * j / TR);
            aa[n] = (ok ? (j === 0 ? 1 : 0.75 * (1 - j / TR)) : 0) * wv * fade;
          }
        });
        for (const a of ['position', 'aCol', 'aSize', 'aA']) wGeo.attributes[a].needsUpdate = true;
      }
    }
    // the ringed gene in every layer
    geneRing.visible = state.gene >= 0 && state.gene < N;
    if (geneRing.visible) {
      const xz = genePos(state.gene), pa = ringPts.attributes.position.array;
      for (let l = 0; l < LN; l++) {
        pa[3 * l] = xz[0]; pa[3 * l + 1] = LYC[l]; pa[3 * l + 2] = xz[1];
        ringPts.attributes.aCol.array.set([1, 0.93, 0.75], 3 * l);
        ringPts.attributes.aSize.array[l] = PRES[state.gene * LN + l] ? 0.055 : 0.035;
        ringPts.attributes.aA.array[l] = LCONT[l] * (PRES[state.gene * LN + l] ? 1 : 0.35) * TU.uX.value;
      }
      for (const a of ['position', 'aCol', 'aSize', 'aA']) ringPts.attributes[a].needsUpdate = true;
    }
    cur.group = g1; cur.t = t; cur.S = S;
  }

  // ---------------------------------------------------------------- explore API helpers
  function pick(origin, dir) {
    const A = v => (Array.isArray(v) ? v : [v.x, v.y, v.z]), o = A(origin), d0 = A(dir), dl = Math.hypot(d0[0], d0[1], d0[2]) || 1;
    const d = [d0[0] / dl, d0[1] / dl, d0[2] / dl];
    let best = -1, bs = 1e9;
    const vis = new Float32Array(N), xz = new Float32Array(2 * N);
    for (let i = 0; i < N; i++) { vis[i] = geneVis(i); const p = genePos(i); xz[2 * i] = p[0]; xz[2 * i + 1] = p[1]; }
    for (let l = 0; l < LN; l++) {
      if (LCONT[l] < 0.2) continue;
      const y = LYC[l];
      for (let i = 0; i < N; i++) {
        if (!PRES[i * LN + l] || vis[i] * LCONT[l] < 0.2) continue;
        const wx = xz[2 * i] - o[0], wy = y - o[1], wz = xz[2 * i + 1] - o[2], tt = wx * d[0] + wy * d[1] + wz * d[2];
        if (tt <= 0) continue;
        const px = wx - d[0] * tt, py = wy - d[1] * tt, pz = wz - d[2] * tt, perp = Math.hypot(px, py, pz), tol = 0.008 + 0.012 * tt;
        if (perp > tol) continue;
        const sc = perp / tol + tt * 0.02 - vis[i] * 0.2;
        if (sc < bs) { bs = sc; best = i; }
      }
    }
    return best;
  }
  function linksOf(i) {
    const out = [];
    if (!(i >= 0 && i < N)) return out;
    for (let l = 0; l < LN; l++) {
      const { off, nb } = ADJ[l]; if (off[i + 1] === off[i]) continue;
      out.push({ layer: l, key: LAY[l].key, name: LAY[l].name, cat: LAY[l].cat, partners: Array.from(nb.subarray(off[i], off[i + 1])).sort((a, b) => a - b) });
    }
    return out;
  }
  function linkStats(pk) {
    pk = (pk || state.pick || []).slice(0, 8);
    const n = pk.length, mask = new Uint16Array(N);
    for (let i = 0; i < N; i++) pk.forEach(([g, c], k) => { if (g >= 0 && g < GN && genes[i].endo[g] === c) mask[i] |= 1 << k; });
    const sizes = pk.map((_, k) => { let s = 0; for (let i = 0; i < N; i++) if (mask[i] >> k & 1) s++; return s; });
    const layers = [];
    const tw = new Array(n).fill(0), tb = {};
    for (let l = 0; l < LN; l++) {
      const arr = LL[l], within = new Array(n).fill(0), bt = {};
      for (let k = 0; k < arr.length; k += 2) {
        const ma = mask[arr[k]], mb = mask[arr[k + 1]];
        if (!ma || !mb) continue;
        for (let p = 0; p < n; p++) {
          if ((ma >> p & 1) && (mb >> p & 1)) within[p]++;
          for (let q = p + 1; q < n; q++) if (((ma >> p & 1) && (mb >> q & 1)) || ((ma >> q & 1) && (mb >> p & 1))) bt[p + ',' + q] = (bt[p + ',' + q] || 0) + 1;
        }
      }
      const between = Object.keys(bt).map(k => { const [p, q] = k.split(',').map(Number); tb[k] = (tb[k] || 0) + bt[k]; return [p, q, bt[k]]; });
      within.forEach((v, p) => { tw[p] += v; });
      layers.push({ layer: l, key: LAY[l].key, name: LAY[l].name, cat: LAY[l].cat, within, between });
    }
    return { pick: pk, sizes, layers, total: { within: tw, between: Object.keys(tb).map(k => { const [p, q] = k.split(',').map(Number); return [p, q, tb[k]]; }) } };
  }

  // ---------------------------------------------------------------- anchors
  const centroid = (mem, y) => {
    if (!mem || !mem.length) return [0, y, 0];
    let x = 0, z = 0; for (const i of mem) { const p = genePos(i); x += p[0]; z += p[1]; }
    return [x / mem.length, y, z / mem.length];
  };
  const layerIdx = k => (typeof k === 'number' ? clamp(k | 0, 0, LN - 1) : LI[k] !== undefined ? LI[k] : 0);
  const rimAt = (l, dir, r = 1.02) => {
    const P = U('uPair'), R = lerp(r, (PR + 0.03) * r, P);
    return [-PCX * P + R * dir[0], LYC[l] || LY[l], R * dir[1]];
  };
  const ppiY = () => (D.ppi.length ? LYC[D.ppi[0]] || PPI_TOP : 0) + 0.03;
  const anchors = {
    top: () => [0, LY[0] + 0.06, 0],
    bottom: () => [0, LY[LN - 1] - 0.04, 0],
    mid: [0, 0, 0],
    ppi: () => [0, blockMid('ppi'), 0],
    coex: () => [0, blockMid('coex'), 0],
    pheno: () => [0, blockMid('pheno'), 0],
    layer: k => rimAt(layerIdx(k), RIGHT),
    zbar: k => { const l = layerIdx(k), z = zOf(cur.group, l) || 0; const r = 1.015 + z * BARS; return [BAR[0] * r, LYC[l] || LY[l], BAR[1] * r]; },
    zline: () => [BAR[0] * zr, zTop + 0.02, BAR[1] * zr],
    group: g => centroid(MEM[g], blockMid('ppi')),
    endo: (g, c) => centroid(ENDO[g] && ENDO[g][c], ppiY()),
    gene: (i, layer) => { const p = genePos(i), l = layer === undefined ? (TOPL[i] >= 0 ? TOPL[i] : 0) : layerIdx(layer); return [p[0], LYC[l] || LY[l], p[1]]; },
    pairLeft: [-PCX, 0, 0], pairRight: [PCX, 0, 0], pairMid: [0, 0, 0],
  };

  // ---------------------------------------------------------------- labels
  const labels = [];
  const trunc = (s, n) => { if (s.length <= n) return s; const c = s.slice(0, n), k = c.lastIndexOf(' '); return (k > 8 ? c.slice(0, k) : c).replace(/[ ,.]+$/, '') + '…'; };
  const endoOn = S => Math.max(prog(S.tower_endo, 0.5, 0.7), prog(S.tower_grid, 0.5, 0.7));
  // category names on the right rim, spread so the small blocks at the top do not overlap
  { const ys = cats.map(c => c.y), lab = ys.slice();
    for (let k = lab.length - 2; k >= 0; k--) lab[k] = Math.max(lab[k], lab[k + 1] + 0.15);
    cats.forEach((c, k) => {
      const n = c.ls.length;
      labels.push({ text: [CATN[c.cat] || c.cat, `${n} layer${n === 1 ? '' : 's'}`], cls: CATL[c.cat] || '',
        at: () => { const p = rimAt(c.ls[Math.floor(n / 2)], RIGHT, 1.05); p[1] = lab[k] + (LYC[c.ls[0]] - LY[c.ls[0]]); return p; },
        alpha: S => prog(S.tower_cats, 0.5, 0.7) * (1 - prog(S.tower_pair, 0.1, 0.4)) * (1 - prog(S.tower_z, 0.1, 0.4)) * (1 - endoOn(S)) * prog(S.tower_rise === undefined ? 1 : S.tower_rise, 0.85, 1) });
    }); }
  const selOf = () => cur.group;
  GR.forEach((G, g) => {
    labels.push({ text: [G.short, `${MEM[g].length} genes, ${SEEDS[g].length} seeds`], cls: '', at: () => [0, LY[0] + 0.12, 0],
      alpha: S => (selOf() === g ? TU.uX.value : 0) * (1 - prog(S.tower_pair, 0.05, 0.3)) * (1 - prog(S.tower_room, 0.2, 0.5)) });
    const big = G.endo.slice().sort((a, b) => b.n - a.n || a.c - b.c).slice(0, 6);
    // in the tower the endotypes overlap on screen: their names stack up the right rim as a legend
    const endoA = S => (selOf() === g ? TU.uX.value : 0) * endoOn(S) * (1 - prog(S.tower_pair, 0.05, 0.3)) * (state.pick.length ? 0.4 : 1);
    big.forEach((e, k) => labels.push({ text: [String(e.c), '· ' + trunc(e.name || 'Endotype', 28)], cls: '',
      at: () => { const r = rimAt(D.ppi[0] || 0, RIGHT, 1.06); return [r[0], PPI_TOP + 0.08 + (big.length - 1 - k) * 0.13, r[2]]; },
      alpha: S => endoA(S) * (1 - prog(U('uGrid'), 0.2, 0.6)) }));
    // in the grid they sit just behind their blocks (above them on screen); blocks named in the same row step down a
    // little one after another, so neighbouring names do not run into each other
    big.forEach((e, k) => labels.push({ text: [String(e.c), '· ' + trunc(e.name || 'Endotype', 17)], cls: '',
      at: () => { const a = anchors.endo(g, e.c), C = GRIDC[g] && GRIDC[g][e.c];
        if (!C) return a;
        const j = big.filter(b => GRIDC[g][b.c] && GRIDC[g][b.c][2] === C[2] && GRIDC[g][b.c][0] < C[0]).length;
        return [a[0] - 0.4 * C[3], (LYC[0] || LY[0]) + 0.02, a[2] - C[3] * (0.48 - 0.3 * j)]; },
      alpha: S => endoA(S) * prog(U('uGrid'), 0.6, 0.9) }));
  });
  const pairA = S => prog(S.tower_pair, 0.7, 0.95);
  if (GR[PGL] && GR[PGR]) labels.push(
    { text: [GR[PGL].short, `${MEM[PGL].length} genes`], cls: 'cyn', at: () => [-PCX - PR - 0.04, LY[0] + 0.15, 0], alpha: pairA },
    { text: [GR[PGR].short, `${MEM[PGR].length} genes`], cls: 'mag', at: () => [PCX - PR * 0.55, LY[0] + 0.15, 0], alpha: pairA },
    { text: ['In both', `${BOTH.length} genes`], cls: 'amb', at: () => [0.03, LY[LN - 1] - 0.1, 0.45], alpha: pairA });
  // the glowing layers' names on the right of the right tower, spread apart where layers sit close together
  { const ly = GLOW_KEYS.map(k => LY[LI[k]]), lab = ly.slice();
    for (let k = 1; k < lab.length; k++) lab[k] = Math.min(lab[k], lab[k - 1] - 0.17);
    GLOW_KEYS.forEach((k, j) => {
      const L = LAY[LI[k]], m = /^(.*?)\s*\((.*)\)$/.exec(L.name);
      const rest = m ? m[2] : L.cat === 'coex' ? 'co-expression' : L.cat === 'ppi' ? 'interactions' : '';
      labels.push({ text: [m ? m[1] : L.name, rest], cls: CATL[L.cat] || '',
        at: () => [PCX + PR + 0.06, lab[j] + (LYC[LI[k]] - LY[LI[k]]), 0], alpha: pairA });
    }); }

  // ---------------------------------------------------------------- views, params, controls
  const cam = {
    default: [24, 16, 5.6, 0, -0.03, 0],
    ppi: [30, 20, 2.9, 0, blockMid('ppi'), 0],
    top: [24, 86, 3.7, 0, 0, 0],
    side: [90, 1, 4.6, 0, 0, 0],
    grid: [15, 64, 3.8, 0, blockMid('ppi') + 0.05, 0],
    z: [-20, 10, 3.6, BAR[0] * 0.55, blockMid('ppi') + 0.05, BAR[1] * 0.55],
    pair: [0, 12, 5.4, 0.18, 0, 0],
    inside: [0, 30, 0.95, 0, -0.75, -0.8],
  };
  const params = { tower_a: 1, tower_rise: 1, tower_cats: 0.4, tower_group: 0, tower_seeds: 0, tower_walk: 0, tower_heat: 0,
    tower_module: 0, tower_z: 0, tower_endo: 0, tower_grid: 0, tower_pair: 0, tower_seedonly: 0, tower_drop: 0, tower_room: 0 };
  const controls = [
    { key: 'view', label: 'View', options: [['tower', 'Tower'], ['grid', 'Endotype grid'], ['pair', 'Two groups'], ['room', 'Room']] },
    { key: 'colour', label: 'Colour', options: [['groups', 'Groups'], ['endo', 'Endotypes'], ['heat', 'Walk heat']] },
    { key: 'show', label: 'Show', options: [['module', 'Module'], ['seeds', 'Seeds'], ['walk', 'Walk'], ['z', 'Layer scores'], ['drop', 'Robustness']] },
  ];
  function explore(c) {
    const o = Object.assign({}, params), t = c.t || 0;
    delete o.tower_a;
    o.tower_cats = c.view === 'tower' ? 0.6 : 0.4;
    if (c.view === 'grid') o.tower_grid = 1;
    if (c.view === 'pair') o.tower_pair = 1;
    if (c.view === 'room') o.tower_room = 1;
    if (c.colour === 'endo') o.tower_endo = 1;
    if (c.colour === 'heat') o.tower_heat = 1;
    // seeds first, then the walk's genes join the module one by one
    if (c.show === 'seeds') { o.tower_seeds = 1; o.tower_module = clamp((t - 2) / 10, 0, 1); if (c.view === 'pair') o.tower_seedonly = 1; }
    if (c.show === 'walk') { o.tower_walk = 1; o.tower_heat = Math.max(o.tower_heat, clamp((t - 3) / 6, 0, 1)); }
    if (c.show === 'z') o.tower_z = 1;
    if (c.show === 'drop') o.tower_drop = clamp((t - 1) / 14, 0, 1);
    return o;
  }

  // first frame state so that the API works before any update
  writeSlot(1, { group: -1, gene: -1, pick: [], heat: null }); shiftSlots();
  for (let l = 0; l < LN; l++) { LYC[l] = LY[l]; LCONT[l] = 1; }

  const groups = GR.map((G, g) => Object.assign({}, G, { index: g, members: MEM[g].length, seedGenes: SEEDS[g].slice(),
    informative: G.z.filter(z => z >= ZMIN).length }));
  const layers = LAY.map((L, l) => Object.assign({}, L, { index: l, links: LC[l], genes: (() => { let s = 0; for (let i = 0; i < N; i++) s += PRES[i * LN + l]; return s; })(), y: LY[l] }));
  return Object.assign(set, {
    params, update, anchors, labels, cam, controls, explore,
    genes, groups, layers, ppi: D.ppi.slice(), N, edgeCount, pairs: EW.length / 2,
    endoCount: GR.reduce((s, G) => s + G.endo.length, 0), endoColour, state, setState, walk, pick, links: linksOf, linkStats,
    members: g => (MEM[g] || []).slice(), seeds: g => (SEEDS[g] || []).slice(), endoGenes: (g, c) => ((ENDO[g] && ENDO[g][c]) || []).slice(),
    heatOf: g => (HEAT[g] ? HEAT[g].slice() : null), genePos,
    pair: { left: PGL, right: PGR, both: BOTH.slice(), endo: pairEndo, glow: GLOW_KEYS.slice(), shareMin: SHARE_MIN },
    zMin: ZMIN, drop: Array.from(DROP),
  });
};
