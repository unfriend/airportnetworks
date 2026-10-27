// The tree set of the mutation story: the family tree in 3D (MMATH.familyTree: three levels of splits, eight tips, every
// mutation simulated exactly under the story's example model) and the poster's species tree ((s1, s2), s3;
// MMATH.speciesTree), crossfading. Branches are glass tubes, thick at the root and thin towards the tips, with a soft
// glowing core; they grow from the root as a level of change rises through the crown (heights are change: a branch rises
// by its length in expected swaps per letter), and the ancestor's eight letters ride up every branch as a small row of
// tiles: where a mutation happens it flashes, the letter changes (framed white: it differs from the ancestor) and a band
// in the new letter's colour stays on the branch. The tips show their sequences. A long and a short branch can be lit
// with their lengths; a gear sits on every branch (the circuit for one branch, turned as far as MMATH.turnAngle says),
// packets flow up through them and the tips write new sequences that follow the rule. On the species tree the gears are
// coupling gears and a glass "?" waits at the root. The stems at the species' tips are the stem set's (same frame).
// Everything follows the params and t. Rows of tiles turn round the vertical to face the viewer as one (the camera seen
// at the last frame), as the look's single tiles do.
SETS.tree = function (K) {
  const { THREE, clamp, lerp, prog } = K;
  const set = K.newSet('tree');
  const M = MMATH, LK = MLOOK(K, set), PI = Math.PI, UP = [0, 1, 0];
  const MODEL = M.DEFAULT, SPEEDS = [0.5, 1, 2, 4];
  const RAD = [0.046, 0.032, 0.023, 0.015];        // a branch's radius where each depth starts (it thins as it climbs)
  const SRAD = [0.05, 0.036, 0.026];               // the species tree's (two levels)
  const GEAR_U = 0.3, GEAR_R = [0.064, 0.054, 0.046], SGEAR_R = [0.075, 0.062];
  const NS = 32, RS = 10;                          // samples along a branch, sides round it
  const TS = 0.034, TP = 0.039, LIFT = 0.06, OUT = 0.035;   // the rows of letters: tile size, pitch, above and before the branch
  const FLASH = 0.12;                              // how far up a branch (in u) a mutation's flash lasts
  const RISE = 0.55, GAP = 1.1;                    // the machines' packets: rise per second, the height between two
  const L8 = 8;

  // ---------------------------------------------------------------- a curve's height and where it reaches a height
  // (MMATH.curve's height: a cubic Bezier through y0, y0 + dy / 2, y3 - 0.35 dy, y3, so it rises monotonically)
  function yAt(tr, b, u) {
    const B = tr.branches[b], y0 = tr.nodes[B.from].pos[1], y3 = tr.nodes[B.to].pos[1], dy = y3 - y0, v = 1 - u;
    return v * v * v * y0 + 3 * v * v * u * (y0 + 0.5 * dy) + 3 * v * u * u * (y3 - 0.35 * dy) + u * u * u * y3;
  }
  function uAt(tr, b, h) {
    const B = tr.branches[b], y0 = tr.nodes[B.from].pos[1], y3 = tr.nodes[B.to].pos[1];
    if (h <= y0) return 0;
    if (h >= y3) return 1;
    let lo = 0, hi = 1;
    for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (yAt(tr, b, m) < h) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  // ---------------------------------------------------------------- the branches: glass tubes with a glowing core
  // one merged mesh per tree: per branch an outer shell and a thin core (aCore), aU along it (0 at the parent), aB its
  // index; per-branch uniforms: how far it has grown (uG, in u), its colour (uC) and brightness (uL)
  function branchMat(n) {
    const m = new THREE.ShaderMaterial({
      uniforms: { uA: set.uA, uK: { value: 1 }, uG: { value: new Float32Array(n) }, uL: { value: new Float32Array(n) },
        uC: { value: Array.from({ length: n }, () => new THREE.Vector3(1, 1, 1)) } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `
#define NBR ${n}
attribute float aU, aB, aCore;
uniform float uA, uK, uG[NBR], uL[NBR]; uniform vec3 uC[NBR];
varying vec3 vN, vV, vC; varying float vA, vU, vCore, vF;
void main() {
  int b = int(aB + 0.5);
  float g = uG[b];
  vC = uC[b]; vA = uA * uK * uL[b]; vU = g - aU; vCore = aCore;
  vF = (1.0 - smoothstep(0.0, 0.07, g - aU)) * step(g, 0.999);   // the growing tip glows
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
  if (g <= 0.0 || vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragmentShader: `
varying vec3 vN, vV, vC; varying float vA, vU, vCore, vF;
void main() {
  if (vU < 0.0) discard;
  vec3 n = normalize(vN), v = normalize(vV);
  float f = gl_FrontFacing ? 1.0 : 0.4, r = pow(1.0 - abs(dot(n, v)), 2.0);
  vec3 col; float a;
  if (vCore > 0.5) { col = mix(vC, vec3(1.0), 0.4) * (0.8 + 0.8 * vF); a = vA * f * (0.38 + 0.3 * (1.0 - r) + 0.5 * vF); }
  else { col = vC * (0.32 + 1.3 * r) + vec3(0.85, 1.0, 1.0) * vF * 0.7; a = vA * f * (0.05 + 0.75 * r + 0.35 * vF); }
  gl_FragColor = vec4(col, a);
}`,
    });
    set.mats.push(m);
    return m;
  }
  function branchGeo(tr, rad) {
    const nb = tr.branches.length, ring = (NS + 1) * RS, nv = nb * 2 * ring;
    const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), au = new Float32Array(nv), ab = new Float32Array(nv), ac = new Float32Array(nv), idx = [];
    const p = [0, 0, 0], tg = [0, 0, 0], T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
    for (const br of tr.branches) {
      const r0 = rad[br.depth - 1], r1 = rad[br.depth];
      for (let i = 0; i <= NS; i++) {
        const u = i / NS;
        M.curve(tr, br.id, u, p); M.tangent(tr, br.id, u, tg);
        T.set(tg[0], tg[1], tg[2]).normalize();
        if (i === 0) N.set(1, 0, 0);
        N.addScaledVector(T, -N.dot(T)).normalize();   // carried along the curve, so the tube never twists
        B.crossVectors(T, N);
        const r = lerp(r0, r1, u) * (1 + 0.25 * Math.pow(1 - u, 6) * (br.depth === 1 ? 1 : 0));   // (a little flare at the root)
        for (let c = 0; c < 2; c++) for (let j = 0; j < RS; j++) {
          const a = j / RS * 2 * PI, cx = Math.cos(a), sx = Math.sin(a), rr = c ? r * 0.3 : r, v = (br.id * 2 + c) * ring + i * RS + j;
          const nx = cx * N.x + sx * B.x, ny = cx * N.y + sx * B.y, nz = cx * N.z + sx * B.z;
          pos[3 * v] = p[0] + nx * rr; pos[3 * v + 1] = p[1] + ny * rr; pos[3 * v + 2] = p[2] + nz * rr;
          nrm[3 * v] = nx; nrm[3 * v + 1] = ny; nrm[3 * v + 2] = nz;
          au[v] = u; ab[v] = br.id; ac[v] = c;
        }
      }
      for (let c = 0; c < 2; c++) for (let i = 0; i < NS; i++) for (let j = 0; j < RS; j++) {
        const o = (br.id * 2 + c) * ring, a = o + i * RS + j, b = o + i * RS + (j + 1) % RS, cc = a + RS, d = b + RS;
        idx.push(a, b, cc, b, d, cc);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('aU', new THREE.BufferAttribute(au, 1));
    g.setAttribute('aB', new THREE.BufferAttribute(ab, 1));
    g.setAttribute('aCore', new THREE.BufferAttribute(ac, 1));
    g.setIndex(idx);
    return g;
  }
  const famMat = branchMat(14), spMat = branchMat(4);
  const famMesh = new THREE.Mesh(new THREE.BufferGeometry(), famMat), spMesh = new THREE.Mesh(new THREE.BufferGeometry(), spMat);
  famMesh.frustumCulled = spMesh.frustumCulled = false;
  famMesh.renderOrder = spMesh.renderOrder = 1;   // (after the solid pieces: glass glows over what is behind it, never hides it)
  set.group.add(famMesh, spMesh);

  // ---------------------------------------------------------------- the trees
  const SP = M.speciesTree();
  spMesh.geometry = branchGeo(SP, SRAD);
  const geoBySeed = new Map(), trees = new Map();
  // a family tree by seed and speed (the speed changes the lengths and the mutations, never the drawing)
  function family(seed, speed) {
    const key = `${seed}|${speed}`;
    let F = trees.get(key);
    if (F) return F;
    const tr = M.familyTree(seed, speed, MODEL);
    if (!geoBySeed.has(seed)) geoBySeed.set(seed, branchGeo(tr, RAD));
    const anc = M.toIdx(tr.nodes[tr.root].seq), P = tr.branches.map(b => M.P(MODEL, b.len));
    const top = Math.max(...tr.nodes.map(n => n.pos[1]));
    const turn = tr.branches.map(b => M.turnAngle(MODEL, b.len));
    F = { tr, seed, speed, geo: geoBySeed.get(seed), anc, P, top, turn, idx: tr.nodes.map(n => M.toIdx(n.seq)) };
    trees.set(key, F);
    return F;
  }
  const spTurn = SP.branches.map(b => M.turnAngle(MODEL, b.len)), spTop = Math.max(...SP.nodes.map(n => n.pos[1]));

  // the sequences a packet of the machines writes (packet k): every branch's child read out letter by letter from row
  // `parent` of P(len) (MMATH.sample, seeded by the packet, the branch and the tree), parents before children. A small
  // ring of the last few packets, so nothing is allocated while they flow
  const PK = Array.from({ length: 8 }, () => ({ F: null, k: -1, seqs: Array.from({ length: 15 }, () => new Uint8Array(L8)) }));
  let pkNext = 0;
  function packet(F, k) {
    for (let i = 0; i < PK.length; i++) if (PK[i].F === F && PK[i].k === k) return PK[i].seqs;
    const e = PK[pkNext]; pkNext = (pkNext + 1) % PK.length;
    e.F = F; e.k = k;
    e.seqs[0].set(F.anc);
    for (const b of F.tr.branches) {
      const par = e.seqs[b.from], ch = e.seqs[b.to], Pm = F.P[b.id];
      for (let s = 0; s < L8; s++) ch[s] = M.sample(Pm.subarray(par[s] * 4, par[s] * 4 + 4), k * 7919 + b.id * 131 + F.seed * 104729 + 17, s);
    }
    return e.seqs;
  }

  // ---------------------------------------------------------------- the pieces drawn every frame
  const tiles = LK.tiles(210), tubes = LK.tubes(80), balls = LK.balls(60), halos = LK.halos(170), rings = LK.rings(70), glass = LK.glass(4), gears = LK.gears(20);
  set.group.add(tiles.mesh, tubes.mesh, balls.mesh, halos.mesh, rings.mesh, glass.mesh, gears.mesh);
  // the camera, seen as the last frame was drawn (rows of tiles turn to face it)
  const camW = new THREE.Vector3(0, 0, 40), camL = new THREE.Vector3();
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    const probe = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
    probe.frustumCulled = false;
    probe.onBeforeRender = (r, s, cam) => { camW.setFromMatrixPosition(cam.matrixWorld); };   // (no vertices: never drawn)
    set.group.add(probe);
  }
  const yawTo = (p) => Math.atan2(camL.x - p[0], camL.z - p[2]);

  const _p = [0, 0, 0], _t = [0, 0, 0], _a = [0, 0, 0], _b = [0, 0, 0], _c = [0, 0, 0], _q = [0, 0, 0, 1], _s = new Uint8Array(L8), _col = [0, 0, 0];
  const WHITE = LK.WHITE, GLASSC = [0.55, 0.78, 1.0], HOT = [0.75, 0.95, 1.0];
  const OPT_PAIR = { pair: true }, OPT_PICK = { glow: 0.9, rim: LK.CYAN }, OPT_PAIRPICK = { pair: true, glow: 0.9, rim: LK.CYAN };
  // a row of eight letters centred at c, turned to face the viewer; letters differing from the ancestor framed white,
  // glow (per site, or null) lights the tiles that just changed
  function row(c, seq, anc, alpha, glow, size) {
    const yaw = yawTo(c), cx = Math.cos(yaw), sz = -Math.sin(yaw), sp = (size || TS) / TS * TP;
    LK.quat(_q, UP, yaw);
    for (let s = 0; s < L8; s++) {
      const o = (s - 3.5) * sp;
      _a[0] = c[0] + cx * o; _a[1] = c[1]; _a[2] = c[2] + sz * o;
      tiles.add(_a, _q, size || TS, seq[s], alpha, seq[s] !== anc[s] ? 1 : 0, glow ? glow[s] : 0);
    }
  }
  // a point lifted above p and moved a little towards the viewer (where a row hangs)
  function rowAt(p, out) {
    const yaw = yawTo(p);
    out[0] = p[0] + Math.sin(yaw) * OUT; out[1] = p[1] + LIFT; out[2] = p[2] + Math.cos(yaw) * OUT;
    return out;
  }
  const GL = new Float32Array(L8);
  // how far a branch rises (its length): a dashed line out at the parent's height, then up to the child, with ticks
  function rise(tr, b, col, a) {
    const B = tr.branches[b], p0 = tr.nodes[B.from].pos, p1 = tr.nodes[B.to].pos;
    _a[0] = p1[0]; _a[1] = p0[1]; _a[2] = p1[2];
    tubes.add(p0, _a, 0.0045, col, 0.7 * a, 10);
    tubes.add(_a, p1, 0.007, col, 0.95 * a, 0);
    for (let k = 0; k < 2; k++) {
      const y = k ? p1[1] : p0[1];
      _b[0] = p1[0] - 0.04; _b[1] = y; _b[2] = p1[2]; _c[0] = p1[0] + 0.04; _c[1] = y; _c[2] = p1[2];
      tubes.add(_b, _c, 0.006, col, 0.95 * a, 0);
    }
  }
  // a gear on every branch grown past it (a machine per branch): turned as far as its branch is long, and turning on
  // while the machines run (faster on longer branches)
  function drawGears(tr, us, turn, alpha, radii, pair, pickF, gearA, flow, t) {
    const wind = prog(gearA, 0.25, 1);
    for (const B of tr.branches) {
      if (us[B.id] < GEAR_U) continue;
      const b = B.id, picked = b === pickF, a = alpha * (pickF >= 0 && !picked ? 0.45 : 1);
      if (a <= 0.003) continue;
      M.curve(tr, b, GEAR_U, _p); M.tangent(tr, b, GEAR_U, _t);
      const ang = 2.4 * turn[b] * wind + flow * t * 1.6 * turn[b];
      gears.add(_p, _t, radii[B.depth - 1], ang, LK.BLUE, a, pair ? (picked ? OPT_PAIRPICK : OPT_PAIR) : (picked ? OPT_PICK : undefined));
    }
  }
  // the packets flowing up: one every GAP of height, rising RISE a second, a bead where each crosses a grown branch
  function beads(tr, us, top, alpha, t) {
    for (let k = Math.floor(t * RISE / GAP); k >= 0; k--) {
      const hk = -1 + t * RISE - k * GAP;
      if (hk > top + 0.05) break;
      for (const B of tr.branches) {
        if (us[B.id] < 1) continue;
        const y0 = tr.nodes[B.from].pos[1], y1 = tr.nodes[B.to].pos[1];
        if (hk <= y0 || hk > y1) continue;
        M.curve(tr, B.id, uAt(tr, B.id, hk), _p);
        balls.add(_p, 0.017, WHITE, alpha);
        halos.add(_p, 0.12, LK.CYAN, 0.7 * alpha);
      }
    }
  }

  // what the frame shows now (for anchors, labels and the api)
  const now = { F: null, u: new Float32Array(14), su: new Float32Array(4), h: -1, pick: -1, hiA: 0, fam: 1, sp: 0 };
  now.F = family(1, 1);
  famMesh.geometry = now.F.geo;
  const branchMid = (tr, b, out) => M.curve(tr, b, 0.5, out);

  function update(S, t) {
    LK.depth();
    set.group.updateMatrixWorld();
    camL.copy(camW); set.group.worldToLocal(camL);
    const sp = clamp(S.tree_species, 0, 1), fa = 1 - sp, sa = sp;
    const seed = Math.max(1, Math.round(S.tree_seed)), speed = SPEEDS[clamp(Math.round(S.tree_speed), 0, SPEEDS.length - 1)];
    const F = family(seed, speed), tr = F.tr;
    if (famMesh.geometry !== F.geo) famMesh.geometry = F.geo;
    now.F = F; now.fam = fa; now.sp = sa;
    const grow = clamp(S.tree_grow, 0, 1), seqA = clamp(S.tree_seq, 0, 1), hi = clamp(S.tree_hi, 0, 1);
    const gearA = clamp(S.tree_gears, 0, 1), flow = clamp(S.tree_flow, 0, 1), qA = clamp(S.tree_q, 0, 1);
    const pick = Math.round(S.tree_pick), pickF = pick >= 0 && pick < tr.branches.length ? pick : -1;
    now.pick = pickF; now.hiA = hi;
    // the level of change reached: it rises from the root past the highest tip
    const h = -1 + grow * (Math.max(F.top, spTop) + 1.001);
    now.h = h;
    tiles.begin(); tubes.begin(); balls.begin(); halos.begin(); rings.begin(); glass.begin(); gears.begin();

    // ---- the family tree
    const U = famMat.uniforms, HL = tr.highlight, focus = pickF >= 0 ? 1 : hi;
    famMat.uniforms.uK.value = fa; famMesh.visible = fa > 0.003;
    for (const B of tr.branches) {
      const b = B.id, u = uAt(tr, b, h), lit = pickF >= 0 ? b === pickF : (b === HL.long || b === HL.short);
      now.u[b] = u;
      U.uG.value[b] = u;
      U.uL.value[b] = lit ? 1 + 0.4 * focus : 1 - 0.62 * focus;
      const c = lit ? LK.mix(GLASSC, pickF >= 0 ? LK.CYAN : LK.GREENLIT, focus, _col) : GLASSC;
      U.uC.value[b].set(c[0], c[1], c[2]);
    }
    if (fa > 0.003) {
      const anc = F.anc;
      // the root, the ancestor's letters round it, the nodes reached
      glass.add(tr.nodes[tr.root].pos, 0.055, HOT, fa * 0.9);
      halos.add(tr.nodes[tr.root].pos, 0.32, HOT, fa * 0.45);
      if (seqA > 0.003) {
        const yaw = yawTo(tr.nodes[tr.root].pos), R0 = 0.25, dA = TP * 2.05 / R0;
        for (let s = 0; s < L8; s++) {
          const a = yaw + (s - 3.5) * dA;
          _a[0] = Math.sin(a) * R0; _a[1] = -1.06; _a[2] = Math.cos(a) * R0;
          LK.quat(_q, UP, a);
          tiles.add(_a, _q, TS * 2, anc[s], fa * seqA, 0, 0.15);
        }
      }
      for (const n of tr.nodes) {
        if (n.parent < 0 || now.u[n.branch] < 1) continue;
        const tip = n.tip >= 0;
        balls.add(n.pos, tip ? 0.016 : 0.022, HOT, fa);
        halos.add(n.pos, tip ? 0.09 : 0.14, HOT, fa * 0.45);
      }
      // the level of change rising through the crown
      const lv = Math.sin(PI * clamp(grow, 0, 1)) * fa;
      _a[0] = 0; _a[1] = h; _a[2] = 0;
      if (lv > 0.01) rings.add(_a, UP, 1.28, 0.004, LK.GREEN, 0.6 * lv, 56);
      // growing tips, mutation bands and flashes, and the letters riding up
      const flowOn = flow > 0.003;
      for (const B of tr.branches) {
        const b = B.id, u = now.u[b];
        if (u <= 0) continue;
        const lit = pickF >= 0 ? b === pickF : (b === HL.long || b === HL.short), dim = lit ? 1 : 1 - 0.55 * focus;
        if (u < 1) { M.curve(tr, b, u, _p); halos.add(_p, 0.13, HOT, 0.8 * fa); }
        GL.fill(0);
        for (const mu of B.muts) {
          if (mu.at > u) break;
          M.curve(tr, b, mu.at, _p); M.tangent(tr, b, mu.at, _t);
          const r = lerp(RAD[B.depth - 1], RAD[B.depth], mu.at) * 1.6;
          rings.add(_p, _t, r, 0.0065, LK.LCOL[mu.to], fa * dim, 0);
          const x = (u - mu.at) / FLASH;
          if (x < 1 && u < 1) {
            halos.add(_p, 0.16 + 0.22 * x, LK.LCOL[mu.to], fa * (1 - x) * 0.95);
            halos.add(_p, 0.07, WHITE, fa * (1 - x));
            GL[mu.site] = Math.max(GL[mu.site], 1 - x);
          }
        }
        if (seqA > 0.003 && u < 1 && !flowOn) {
          M.curve(tr, b, u, _p);
          row(rowAt(_p, _c), M.seqAt(tr, b, u, _s), anc, fa * seqA, GL);
        }
      }
      // the tips' sequences: the tree's own, or while the machines run the last packet that reached each tip
      if (seqA > 0.003) for (const n of tr.nodes) {
        if (n.tip < 0 || now.u[n.branch] < 1) continue;
        let seq = F.idx[n.id], g = null;
        if (flowOn) {
          const k = Math.floor((t * RISE - (n.pos[1] + 1)) / GAP);
          if (k >= 0) {
            seq = packet(F, k)[n.id];
            const age = ((t * RISE - (n.pos[1] + 1)) / GAP - k) * GAP / RISE;   // seconds since it arrived
            GL.fill(Math.max(0, 1 - age / 0.6)); g = GL;
          }
        }
        row(rowAt(n.pos, _c), seq, anc, fa * seqA, g);
      }
      // the long and the short branch (or the picked one): how far each rises, in green (cyan when picked)
      if (focus > 0.01) {
        if (pickF >= 0) rise(tr, pickF, LK.CYAN, focus * fa);
        else { rise(tr, HL.long, LK.GREENLIT, focus * fa); rise(tr, HL.short, LK.GREENLIT, focus * fa); }
      }
    }

    // ---- the species tree
    spMat.uniforms.uK.value = sa; spMesh.visible = sa > 0.003;
    for (const B of SP.branches) {
      const u = uAt(SP, B.id, h);
      now.su[B.id] = u;
      spMat.uniforms.uG.value[B.id] = u; spMat.uniforms.uL.value[B.id] = 1;
      spMat.uniforms.uC.value[B.id].set(GLASSC[0], GLASSC[1], GLASSC[2]);
    }
    if (sa > 0.003) {
      const root = SP.nodes[SP.root].pos;
      halos.add(root, 0.32, HOT, sa * 0.45 * (1 - qA));
      for (const n of SP.nodes) {
        if (n.parent < 0 || now.su[n.branch] < 1) continue;
        balls.add(n.pos, n.tip >= 0 ? 0.02 : 0.026, HOT, sa);
        halos.add(n.pos, 0.14, HOT, sa * 0.45);
      }
      for (const B of SP.branches) { const u = now.su[B.id]; if (u > 0 && u < 1) { M.curve(SP, B.id, u, _p); halos.add(_p, 0.13, HOT, 0.8 * sa); } }
      // the unknown ancestor: a glass "?" at the root
      if (qA > 0.003) {
        _a[0] = root[0]; _a[1] = root[1] + 0.02; _a[2] = root[2];
        glass.add(_a, 0.12, LK.CYAN, sa * qA);
        tiles.add(_a, null, 0.11, 4, sa * qA, 0, 0.55 + 0.25 * Math.sin(t * 2.4));
        halos.add(_a, 0.45, LK.CYAN, 0.35 * sa * qA);
      } else glass.add(root, 0.055, HOT, sa * 0.9);
    }

    // ---- the machines: a gear on every branch (coupling gears on the species tree), packets flowing up through them
    if (gearA > 0.003) {
      if (fa > 0.003) drawGears(tr, now.u, F.turn, fa * gearA, GEAR_R, false, pickF, gearA, flow, t);
      if (sa > 0.003) drawGears(SP, now.su, spTurn, sa * gearA, SGEAR_R, true, -1, gearA, flow, t);
    }
    if (flow > 0.003) {
      if (fa > 0.003) beads(tr, now.u, F.top, fa * flow, t);
      if (sa > 0.003) beads(SP, now.su, spTop, sa * flow, t);
    }
    tiles.end(); tubes.end(); balls.end(); halos.end(); rings.end(); glass.end(); gears.end();
  }

  // ---------------------------------------------------------------- anchors, labels, views
  const mid = b => () => { const o = [0, 0, 0]; branchMid(now.F.tr, b(), o); return o; };
  const tipNode = j => now.F.tr.nodes.find(n => n.tip === j);
  const anchors = {
    root: [0, -1, 0], below: [0, -1.18, 0.12], crown: () => [0, now.F.top, 0], level: () => [1.28, now.h, 0],
    long: mid(() => now.F.tr.highlight.long), short: mid(() => now.F.tr.highlight.short),
    pick: mid(() => Math.max(0, now.pick)),
    gear: () => { const o = [0, 0, 0]; M.curve(now.F.tr, 0, GEAR_U, o); o[0] += 0.07; return o; },
    tips: () => { const n = tipNode(2) || tipNode(0); return [n.pos[0], n.pos[1] + 0.12, n.pos[2]]; },
    q: [0, -0.86, 0], n1: SP.nodes[1].pos, sgear: () => { const o = [0, 0, 0]; M.curve(SP, 1, GEAR_U, o); o[0] += 0.08; return o; },
  };
  for (let j = 0; j < 8; j++) anchors['tip' + j] = () => { const n = tipNode(j); return [n.pos[0], n.pos[1] + 0.12, n.pos[2]]; };
  SP.tipIds.forEach((id, j) => { anchors['s' + (j + 1)] = SP.nodes[id].pos; });
  const fmt2 = v => v.toFixed(2);
  const swaps = n => `${n} swap${n === 1 ? '' : 's'}`;
  const lenTag = b => { const B = now.F.tr.branches[b]; return [`${fmt2(B.len)} swaps per letter`, ` · ${swaps(B.muts.length)} here`]; };
  const labels = [
    { text: () => ['Ancestor', ' · ' + now.F.tr.nodes[now.F.tr.root].seq], at: 'below', cls: 'cyn',
      alpha: S => (1 - clamp(S.tree_species, 0, 1)) * clamp(S.tree_seq, 0, 1) * (1 - prog(S.tree_grow, 0.55, 0.8)) * (1 - clamp(S.tree_hi, 0, 1)) * (Math.round(S.tree_pick) >= 0 ? 0 : 1) },
    { text: ['Descendants', ' · their sequences today'], at: 'tips', cls: '',
      alpha: S => (1 - clamp(S.tree_species, 0, 1)) * clamp(S.tree_seq, 0, 1) * prog(S.tree_grow, 0.92, 1) * (1 - clamp(S.tree_hi, 0, 1)) * (1 - clamp(S.tree_gears, 0, 1)) * (Math.round(S.tree_pick) >= 0 ? 0 : 1) },
    { text: () => lenTag(now.F.tr.highlight.long), at: 'long', cls: 'grn',
      alpha: S => (1 - clamp(S.tree_species, 0, 1)) * prog(S.tree_hi, 0.4, 1) * (Math.round(S.tree_pick) >= 0 ? 0 : 1) },
    { text: () => lenTag(now.F.tr.highlight.short), at: 'short', cls: 'grn',
      alpha: S => (1 - clamp(S.tree_species, 0, 1)) * prog(S.tree_hi, 0.4, 1) * (Math.round(S.tree_pick) >= 0 ? 0 : 1) },
    { text: () => { const b = Math.max(0, now.pick), t = lenTag(b); return [`Branch ${b + 1}`, ` · ${t[0]} · ${swaps(now.F.tr.branches[b].muts.length)}`]; }, at: 'pick', cls: 'cyn',
      alpha: S => (1 - clamp(S.tree_species, 0, 1)) * (Math.round(S.tree_pick) >= 0 ? 1 : 0) },
    { text: ['One machine per branch', ''], at: 'gear', cls: 'cyn',
      alpha: S => (1 - clamp(S.tree_species, 0, 1)) * prog(S.tree_gears, 0.5, 1) * (Math.round(S.tree_pick) >= 0 ? 0 : 1) },
    { text: ['Coupling gears', ' · one per branch'], at: 'sgear', cls: 'cyn', alpha: S => clamp(S.tree_species, 0, 1) * prog(S.tree_gears, 0.5, 1) * (1 - clamp(S.tree_flow, 0, 1)) },
    { text: ['?', ' · their shared ancestor'], at: 'q', cls: 'amb', alpha: S => clamp(S.tree_species, 0, 1) * prog(S.tree_q, 0.4, 1) },
  ];
  // views: the family tree whole, from low as it grows, the crown, the long and the short branch (the story's tree,
  // seed 1), the machines, standing tall in a headset, looking up from the root; the species tree
  const T1 = family(1, 1).tr, lp = [0, 0, 0], spt = [0, 0, 0];
  branchMid(T1, T1.highlight.long, lp); branchMid(T1, T1.highlight.short, spt);
  const pairView = (() => {
    // look across the line from one to the other, from the front side, so both stand clear at the sides
    const dx = lp[0] - spt[0], dz = lp[2] - spt[2];
    let az = Math.atan2(-dz, dx) * 180 / PI;
    if (Math.cos(az * PI / 180) < 0) az += 180;
    return [Math.round(((az + 540) % 360) - 180), 14, 4.6, +((lp[0] + spt[0]) / 2).toFixed(2), +((lp[1] + spt[1]) / 2).toFixed(2), +((lp[2] + spt[2]) / 2).toFixed(2)];
  })();
  const near = p => { const az = Math.atan2(p[0], p[2]) * 180 / PI; return [Math.round(az + 12), 12, 2.4, +p[0].toFixed(2), +p[1].toFixed(2), +p[2].toFixed(2)]; };
  const cam = {
    default: [24, 12, 5.0, 0, -0.02, 0],
    grow: [18, 5, 4.6, 0, -0.32, 0],
    crown: [30, 30, 4.5, 0, 0.42, 0],
    pair: pairView, long: near(lp), short: near(spt),
    gears: [28, 14, 3.9, 0, -0.28, 0],
    stand: [20, 4, 1.45, 0, 0.35, 0],
    up: [20, -50, 1.7, 0, 0.22, 0],
    species: [18, 16, 3.9, 0, -0.42, 0.1],
    what: [36, 12, 4.4, 0, -0.38, 0],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['tree', 'Family tree'], ['machines', 'Machines'], ['species', 'Species tree']] },
    { key: 'seed', label: 'Tree', options: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']] },
    { key: 'speed', label: 'Letters change', options: [['0', 'Slowly'], ['1', 'As in the story'], ['2', 'Twice as fast'], ['3', 'Four times']] },
    { key: 'run', label: 'Machines', options: [['off', 'Still'], ['on', 'Running']] },
  ];
  function explore(c) {
    const v = c.view || 'tree', sp = v === 'species' ? 1 : 0;
    return {
      tree_species: sp, tree_grow: 1, tree_seq: 1, tree_hi: 0, tree_gears: v === 'tree' ? 0 : 1, tree_flow: v !== 'tree' && c.run === 'on' ? 1 : 0,
      tree_q: sp, tree_seed: Math.max(1, parseInt(c.seed, 10) || 1), tree_speed: c.speed == null ? 1 : clamp(parseInt(c.speed, 10) || 0, 0, 3), tree_pick: -1,
    };
  }

  // ---------------------------------------------------------------- picking and what explore reads
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  // the branch a ray (a THREE.Raycaster in world coordinates) points at, on the tree on show
  function pick(rc) {
    const ray = rc.ray, species = now.sp > 0.5, tr = species ? SP : now.F.tr, us = species ? now.su : now.u;
    set.group.updateMatrixWorld();
    const Mw = set.group.matrixWorld, s0 = Mw.getMaxScaleOnAxis(), p = [0, 0, 0];
    let best = null, bt = Infinity;
    for (const B of tr.branches) {
      if (us[B.id] <= 0) continue;
      for (let i = 1; i <= 16; i++) {
        const u = i / 16 * us[B.id];
        M.curve(tr, B.id, u, p);
        _v.set(p[0], p[1], p[2]).applyMatrix4(Mw);
        const d = _w.copy(_v).sub(ray.origin).dot(ray.direction), r = 0.07 * s0;
        if (d > 0 && d < bt && ray.distanceSqToPoint(_v) < r * r) { bt = d; best = { kind: 'branch', b: B.id, species }; }
      }
    }
    return best;
  }
  // a branch in words: its length, its swaps (1-based sites), its gear's turn and the circuit's angles at that length
  function branch(b, species) {
    const tr = species ? SP : now.F.tr, B = tr.branches[b];
    if (!B) return null;
    return {
      b, species: !!species, depth: B.depth, len: B.len, from: tr.nodes[B.from].seq, to: tr.nodes[B.to].seq,
      swaps: B.muts.length, muts: B.muts.map(m => ({ at: m.at, site: m.site + 1, from: M.LETTERS[m.from], to: M.LETTERS[m.to] })),
      turn: M.turnAngle(MODEL, B.len), angles: Array.from(M.angles(MODEL, B.len)),
    };
  }
  const API = {
    speeds: SPEEDS, model: MODEL, tree: () => now.F.tr, species: () => SP, highlight: () => now.F.tr.highlight,
    branch, pick, mid: (b, species) => branchMid(species ? SP : now.F.tr, b, [0, 0, 0]), tips: () => now.F.tr.nodes.filter(n => n.tip >= 0).map(n => ({ tip: n.tip, seq: n.seq, pos: n.pos })),
  };
  return Object.assign(set, {
    params: { tree_a: 1, tree_species: 0, tree_grow: 1, tree_seq: 1, tree_hi: 0, tree_gears: 0, tree_flow: 0, tree_q: 0, tree_seed: 1, tree_speed: 1, tree_pick: -1 },
    update, anchors, labels, cam, controls, explore,
    api: () => API,
  });
};
