// net: the soil's microbes as a deep cloud (20,000 kinds: the 3,384 common ones in a bright core, the rare ones a faint
// shell, coloured by phylum, each phylum a sector), the nitrifiers flaring, the co-occurrence network of 1,564 kinds and
// 22,348 links pulling out of the core, a shuffle dissolving it, its modules in colour, and the two wheat lines' networks
// side by side (and the three regimes', and a random split's). Drawn in the field set's frame, floating over the field.
// Real numbers from SOIL_DATA (SDATA); the cloud's places and the network's layout are a drawing.
// Adapted from the endotype story's net set (tools/endo/sets/net.js: the cloud with its core and shell, the glowing
// seeds, the module pulling out, the colours, the focus and picking), without its walkers, heat and k.
SETS.net = function (K) {
  const { THREE, smooth, clamp, prog } = K;
  const set = K.newSet('net');
  const D = SOIL_DATA, SD = SDATA, CL = SD.cloud, NT = SD.net, CM = SD.common;
  const C = [0, 1.3, 0], RC = 0.7, RN = 0.6;   // the cloud's centre (over the field) and radius; the network's radius
  const NCL = CL.n, NN = NT.n, NL = NT.links, NM = D.net.mods.length, NP = D.phyla.names.length, GK = D.guilds.keys;
  const R = K.rng(100116);
  const fmt = n => Math.round(n).toLocaleString('en-GB');

  // ---------------------------------------------------------------- who is who
  const nodeOf = new Int32Array(NCL).fill(-1), comOf = new Int32Array(NCL).fill(-1);
  for (let i = 0; i < NN; i++) nodeOf[NT.cloudOf(i)] = i;
  for (let c = 0; c < CM.n; c++) comOf[CM.idx[c]] = c;

  // ---------------------------------------------------------------- the cloud's places (a drawing)
  // Each phylum a sector of the sphere about the vertical (wider for phyla with more kinds in the cloud); the common
  // kinds in a core of radius 0.06 to 0.38 (the most abundant innermost), the rare ones in a shell from 0.42 to 0.7.
  const P = new Float32Array(3 * NCL), RAD = new Float32Array(NCL);
  {
    const cnt = new Float64Array(NP);
    for (let i = 0; i < NCL; i++) cnt[CL.phy[i]]++;
    const w = Array.from(cnt, c => Math.pow(c, 0.55)), W = w.reduce((s, x) => s + x, 0), a0 = [];
    let acc = 0;
    for (let p = 0; p < NP; p++) { a0.push(acc / W * Math.PI * 2); acc += w[p]; }
    let nc = 0, nr = 0;
    const NR = NCL - CM.n;
    for (let i = 0; i < NCL; i++) {
      const p = CL.phy[i], az = a0[p] + (0.06 + 0.88 * R()) * (w[p] / W) * Math.PI * 2, y = (2 * R() - 1) * 0.94, s = Math.sqrt(1 - y * y);
      let r;
      if (comOf[i] >= 0) r = 0.06 + 0.32 * Math.pow(nc++ / CM.n, 0.75);
      else r = 0.42 + 0.28 * Math.pow(nr++ / NR, 0.9);
      r = clamp(r + K.gauss(R) * 0.018, 0.02, RC);
      RAD[i] = r;
      P[3 * i] = C[0] + r * s * Math.sin(az); P[3 * i + 1] = C[1] + r * y; P[3 * i + 2] = C[2] + r * s * Math.cos(az);
    }
  }
  // the network's own layout (stored: linked kinds sit close, modules apart), scaled to radius RN round the centre; each
  // module spread out round its middle (the stored modules are tight balls, whose links between them drew thick bars:
  // still a drawing where linked kinds sit close)
  const LAY = new Float32Array(3 * NN);
  {
    const mc = Array.from({ length: NM }, () => [0, 0, 0, 0]);
    for (let i = 0; i < NN; i++) { const m = NT.mod[i]; if (m >= NM) continue; for (let a = 0; a < 3; a++) mc[m][a] += NT.xyz[3 * i + a]; mc[m][3]++; }
    for (const v of mc) for (let a = 0; a < 3; a++) v[a] /= v[3] || 1;
    for (let i = 0; i < NN; i++) {
      const m = NT.mod[i], c = m < NM ? mc[m] : null, f = !c ? 1 : c[3] >= 30 ? 1.85 : 1.4;
      for (let a = 0; a < 3; a++) { const x = NT.xyz[3 * i + a]; LAY[3 * i + a] = C[a] + RN * (c ? c[a] + (x - c[a]) * f : x); }
    }
  }
  // each kind leaves the core at its own moment as the network pulls out (the far travellers last)
  const ST = new Float32Array(NN);
  {
    let far = 0;
    const dd = new Float32Array(NN);
    for (let i = 0; i < NN; i++) { const c = 3 * NT.cloudOf(i); dd[i] = Math.hypot(LAY[3 * i] - P[c], LAY[3 * i + 1] - P[c + 1], LAY[3 * i + 2] - P[c + 2]); far = Math.max(far, dd[i]); }
    for (let i = 0; i < NN; i++) ST[i] = 0.3 * dd[i] / far + 0.08 * R();
  }
  // a direction for each kind to scatter in while the samples are shuffled
  const SC = new Float32Array(3 * NN);
  for (let i = 0; i < NN; i++) SC.set(K.unit(R), 3 * i);
  // per node: its strongest link (the threshold leaves a node lit while it keeps one), and the halves whose own network
  // keeps one of its links (bits, as the links')
  const MINI = new Float32Array(NN).fill(1e9), NBIT = new Uint8Array(NN);
  for (let e = 0; e < NL; e++) for (const n of [NT.ij[2 * e], NT.ij[2 * e + 1]]) { if (e < MINI[n]) MINI[n] = e; NBIT[n] |= NT.split[e]; }
  // how crowded each node's surroundings are in the layout: the middle of a module would burn out to white, so points and
  // links dim with the crowd (as the endotype story's)
  const CROWD = (() => {
    const G = 40, H = G / 2, cs = 0.06, cnt = new Uint16Array(G * G * G), cell = new Int32Array(3 * NN), out = new Float32Array(NN);
    const c = (x, a) => clamp(Math.floor((x - C[a]) / cs) + H, 0, G - 1);
    for (let i = 0; i < NN; i++) { for (let a = 0; a < 3; a++) cell[3 * i + a] = c(LAY[3 * i + a], a); cnt[(cell[3 * i] * G + cell[3 * i + 1]) * G + cell[3 * i + 2]]++; }
    for (let i = 0; i < NN; i++) {
      let s = 0;
      for (let a = Math.max(0, cell[3 * i] - 1); a <= Math.min(G - 1, cell[3 * i] + 1); a++) for (let b = Math.max(0, cell[3 * i + 1] - 1); b <= Math.min(G - 1, cell[3 * i + 1] + 1); b++)
        for (let d = Math.max(0, cell[3 * i + 2] - 1); d <= Math.min(G - 1, cell[3 * i + 2] + 1); d++) s += cnt[(a * G + b) * G + d];
      out[i] = s;
    }
    return out;
  })();
  const dimP = d => Math.pow(10 / Math.max(10, d), 0.5), dimL = d => Math.pow(10 / Math.max(10, d), 0.7);
  // modules' middles in the layout
  const MCTR = Array.from({ length: NM }, () => [0, 0, 0]), MTOP = new Float32Array(NM).fill(-9);
  { const n = new Float64Array(NM); for (let i = 0; i < NN; i++) { const m = NT.mod[i]; if (m >= NM) continue; n[m]++; for (let a = 0; a < 3; a++) MCTR[m][a] += LAY[3 * i + a]; MTOP[m] = Math.max(MTOP[m], LAY[3 * i + 1]); }
    for (let m = 0; m < NM; m++) if (n[m]) for (let a = 0; a < 3; a++) MCTR[m][a] /= n[m]; }

  // ---------------------------------------------------------------- shared uniforms and GLSL
  const col3 = (arr, list) => { list.forEach((c, i) => arr.set(K.rgb(c), 3 * i)); return arr; };
  const U = {
    uCloud: { value: 1 }, uNitro: { value: 0 }, uPull: { value: 0 }, uLinks: { value: 0 }, uCut: { value: NL }, uShuf: { value: 0 },
    uMods: { value: 0 }, uFocus: { value: -1 }, uFocusOn: { value: 0 }, uSplit: { value: 0 }, uKindN: { value: -1 }, uKindC: { value: -1 }, uKindOn: { value: 0 },
    uCtr: { value: new THREE.Vector3(C[0], C[1], C[2]) },
    uModCol: { value: col3(new Float32Array(3 * NM), Array.from({ length: NM }, (_, m) => SLOOK.module(m))) },
    uPhyCol: { value: col3(new Float32Array(3 * NP), D.phyla.names.map((n, i) => SLOOK.phylum(n, i))) },
    uGuildCol: { value: col3(new Float32Array(18), ['#8e98ab', ...GK.map(k => SLOOK.GUILD[k])]) },
    uPos: { value: new THREE.Color(SLOOK.LINK.pos) }, uNeg: { value: new THREE.Color(SLOOK.LINK.neg) },
  };
  const LOOK = `
uniform float uCloud, uNitro, uPull, uLinks, uCut, uShuf, uMods, uFocus, uFocusOn, uSplit, uKindN, uKindC, uKindOn;
uniform vec3 uCtr, uModCol[${NM}], uPhyCol[${NP}], uGuildCol[6], uPos, uNeg;
// one copy of the network (split: side by side): its offset, size, which half's bit it keeps (-1 all) and its fade
uniform vec3 uOff; uniform float uSc, uBitL, uCA;
vec3 modCol(float m) { return m > ${NM - 1}.5 ? vec3(0.45, 0.5, 0.6) : uModCol[int(m + 0.5)]; }
vec3 phyCol(float p) { return uPhyCol[int(clamp(p, 0.0, ${NP - 1}.0) + 0.5)]; }
vec3 guildCol(float g) { return uGuildCol[int(clamp(g, 0.0, 5.0) + 0.5)]; }
float bitAt(float m, float l) { return l < -0.5 ? 1.0 : mod(floor(m / exp2(l) + 0.001), 2.0); }
// a kind of the network on its way out of the core: eased (st: its start), with a sideways bow about the vertical, to its
// place in this copy; scattered a little while the samples are shuffled
vec3 morph(vec3 cl, vec3 lay, float st, vec3 sc) {
  float e = clamp((uPull - st) / 0.6, 0.0, 1.0); e = e * e * (3.0 - 2.0 * e);
  vec3 q = uCtr + (lay - uCtr) * uSc + uOff, d = q - cl;
  return cl + d * e + vec3(-d.z, 0.0, d.x) * (0.3 * sin(3.14159265 * e)) + sc * (0.07 * uShuf * e);
}
// brighter in front of the set's middle, darker behind (depth)
float depthCue(vec4 mv) { vec4 o = modelViewMatrix * vec4(uCtr, 1.0); float s = length(modelViewMatrix[0].xyz); return clamp(1.0 - (o.z - mv.z) / s * 0.5, 0.45, 1.35); }
`;
  const copyU = () => ({ uOff: { value: new THREE.Vector3() }, uSc: { value: 1 }, uBitL: { value: -1 }, uCA: { value: 1 } });
  const mat = (vs, fs, own) => {
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, U, own || copyU()),
      vertexShader: K.GLSL + LOOK + vs, fragmentShader: fs,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    set.mats.push(m);
    return m;
  };
  const attr = (g, name, arr, n) => g.setAttribute(name, new THREE.BufferAttribute(arr, n));
  const BS = new THREE.Sphere(new THREE.Vector3(C[0], C[1], C[2]), 2.2);
  const GLOW_FS = `
varying vec3 vC; varying float vA, vHot;
void main() {
  vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0;
  if (d > 1.0) discard;
  float core = smoothstep(0.62, 0.12, d), halo = pow(1.0 - d, 2.0);
  gl_FragColor = vec4(vC * (0.6 + 0.55 * core) + vec3(0.95) * vHot * smoothstep(0.45, 0.0, d), vA * (core * 0.75 + halo * (0.45 + 0.35 * vHot)));
}`;

  // ---------------------------------------------------------------- the cloud: every kind not in the network
  const CN = NCL - NN, cIdx = new Int32Array(CN);
  { let k = 0; for (let i = 0; i < NCL; i++) if (nodeOf[i] < 0) cIdx[k++] = i; }
  const cloudGeo = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(3 * CN), I = new Float32Array(4 * CN), Q = new Float32Array(4 * CN);
    const [a0, a1] = D.cloud.abRange;
    for (let k = 0; k < CN; k++) {
      const i = cIdx[k], com = comOf[i] >= 0, ab = clamp((CL.ab[i] - a0) / (a1 - a0), 0, 1);
      pos.set(P.subarray(3 * i, 3 * i + 3), 3 * k);
      I[4 * k] = CL.phy[i]; I[4 * k + 1] = CL.guild[i]; I[4 * k + 2] = com ? 1 : 0; I[4 * k + 3] = i;
      Q[4 * k] = com ? 0.011 + 0.016 * ab * ab : 0.0065 + 0.004 * ab; Q[4 * k + 1] = RAD[i] / RC; Q[4 * k + 2] = R(); Q[4 * k + 3] = 0.72 + 0.25 * RAD[i] / RC;
    }
    attr(cloudGeo, 'position', pos, 3); attr(cloudGeo, 'aI', I, 4); attr(cloudGeo, 'aQ', Q, 4);
    cloudGeo.boundingSphere = BS;
  }
  const cloudMat = mat(`
attribute vec4 aI, aQ;
uniform float uA; varying vec3 vC; varying float vA, vHot;
void main() {
  float com = aI.z, gu = aI.y, isG = step(0.5, gu), rv = aQ.y;
  vec3 c = phyCol(aI.x) * mix(0.62, 1.0, com);
  float sz = aQ.x, br = mix(0.42, 1.0, com);
  // the nitrifiers flare in their guild's colour, the rest steps back
  c = mix(c, guildCol(gu) * 1.3, uNitro * isG); sz *= 1.0 + 1.6 * uNitro * isG; br *= mix(1.0, mix(0.3, 1.6, isG), uNitro);
  // as the network pulls out, the rest of the cloud recedes to a faint shell round it (and fades as the network splits)
  vec3 d = position - uCtr; float r = length(d);
  vec3 pos = uCtr + d * (mix(r, aQ.w, uPull) / max(r, 1e-4));
  br *= mix(1.0, 0.32, uPull) * (1.0 - 0.85 * uSplit) * (1.0 - 0.4 * uFocusOn);
  // the picked kind
  float me = uKindOn * (1.0 - step(0.5, abs(aI.w - uKindC)));
  c = mix(c, vec3(1.0), me * 0.6); sz *= 1.0 + 1.5 * me; br = max(br, me);
  br *= 1.0 - 0.6 * uKindOn * (1.0 - me);
  // the cloud appears from the centre outwards, with a bright front; a slow twinkle
  float u = uCloud * 1.05, ap = smoothstep(rv, rv + 0.035, u), fl = uCloud < 0.999 ? exp(-pow((u - rv - 0.025) / 0.03, 2.0)) : 0.0;
  br *= (0.84 + 0.16 * sin(uTime * 1.3 + aQ.z * 6.2832)) * (1.0 + 1.6 * fl);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(sz * ap * (1.0 + 0.8 * fl), mv);
  vC = c * br * depthCue(mv); vHot = me;
  vA = uA * ap;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, GLOW_FS);
  const cloud = new THREE.Points(cloudGeo, cloudMat);
  cloud.renderOrder = 2; set.group.add(cloud);

  // ---------------------------------------------------------------- the network's kinds (three copies for the split)
  const NB = new Float32Array(NN);   // 1: a neighbour of the picked kind
  const nodeGeo = new THREE.BufferGeometry();
  {
    const cl = new Float32Array(3 * NN), I = new Float32Array(4 * NN), Q = new Float32Array(4 * NN);
    const [a0, a1] = D.cloud.abRange;
    for (let i = 0; i < NN; i++) {
      const c = NT.cloudOf(i), ab = clamp((CL.ab[c] - a0) / (a1 - a0), 0, 1);
      cl.set(P.subarray(3 * c, 3 * c + 3), 3 * i);
      I[4 * i] = i; I[4 * i + 1] = NT.mod[i] === 255 ? NM : NT.mod[i]; I[4 * i + 2] = CL.phy[c]; I[4 * i + 3] = CL.guild[c];
      Q[4 * i] = (0.012 + 0.016 * ab * ab) * (1 + 0.25 * Math.min(1, NT.deg[i] / 60)); Q[4 * i + 1] = ST[i]; Q[4 * i + 2] = MINI[i]; Q[4 * i + 3] = NBIT[i];
    }
    const B = new Float32Array(NN); for (let i = 0; i < NN; i++) B[i] = dimP(CROWD[i]);
    attr(nodeGeo, 'position', LAY, 3); attr(nodeGeo, 'aCl', cl, 3); attr(nodeGeo, 'aI', I, 4); attr(nodeGeo, 'aQ', Q, 4); attr(nodeGeo, 'aSc', SC, 3);
    attr(nodeGeo, 'aB', B, 1); attr(nodeGeo, 'aNb', NB, 1);
    nodeGeo.boundingSphere = BS;
  }
  const NODE_VS = `
attribute vec3 aCl, aSc; attribute vec4 aI, aQ; attribute float aB, aNb;
uniform float uA; varying vec3 vC; varying float vA, vHot;
void main() {
  float id = aI.x, m = aI.y, gu = aI.w, isG = step(0.5, gu);
  vec3 pos = morph(aCl, position, aQ.y, aSc);
  float e = clamp((uPull - aQ.y) / 0.6, 0.0, 1.0);
  vec3 c = phyCol(aI.z);
  float sz = aQ.x, br = 1.0, hi = 0.0;
  c = mix(c, guildCol(gu) * 1.3, uNitro * isG); sz *= 1.0 + 1.6 * uNitro * isG; br *= mix(1.0, mix(0.3, 1.6, isG), uNitro * (1.0 - uPull));
  // modules: each kind in its module's colour; one module in focus, the rest dims
  c = mix(c, modCol(m) * 1.2, uMods);
  float fw = 1.0 - step(0.5, abs(m - uFocus));
  br *= mix(1.0, 0.1 + 0.9 * fw, uFocusOn); sz *= 1.0 + 0.4 * fw * uFocusOn; hi = max(hi, fw * uFocusOn);
  // the threshold: a kind left without a link dims; a split copy: a kind whose half keeps none of its links goes
  float keep = clamp(uCut - aQ.z, 0.0, 1.0) * bitAt(aQ.w, uBitL);
  br *= mix(1.0, mix(0.12, 1.0, keep), uLinks * e);
  // the picked kind and its neighbours
  float me = uKindOn * (1.0 - step(0.5, abs(id - uKindN))), nb = uKindOn * aNb;
  c = mix(c, vec3(0.45, 0.92, 1.0), nb * 0.7 * (1.0 - me)); c = mix(c, vec3(1.0), me * 0.6);
  sz *= 1.0 + 1.5 * me + 0.4 * nb; hi = max(hi, max(me, nb));
  br *= 1.0 - 0.7 * uKindOn * (1.0 - hi);
  // crowded middles dim (less where something is lit); in the cloud the kinds take its look
  br *= mix(1.0, mix(aB, 1.0, hi * 0.6), uPull);
  float rv = length(aCl - uCtr) / ${RC.toFixed(2)}, u = uCloud * 1.05, ap = smoothstep(rv, rv + 0.035, u);
  br *= 0.86 + 0.14 * sin(uTime * 1.3 + id * 0.73);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(sz * ap, mv);
  vC = c * br * depthCue(mv); vHot = me;
  vA = uA * uCA * ap;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
  // ---------------------------------------------------------------- the links (three copies for the split)
  const linkGeo = new THREE.BufferGeometry();
  {
    const n = 2 * NL, pos = new Float32Array(3 * n), cl = new Float32Array(3 * n), E = new Float32Array(4 * n), Nn = new Float32Array(4 * n), sc = new Float32Array(3 * n);
    for (let e = 0; e < NL; e++) {
      const a = NT.ij[2 * e], b = NT.ij[2 * e + 1], ma = NT.mod[a], mb = NT.mod[b];
      const len = Math.hypot(LAY[3 * a] - LAY[3 * b], LAY[3 * a + 1] - LAY[3 * b + 1], LAY[3 * a + 2] - LAY[3 * b + 2]);
      const al = (ma === mb ? 0.03 + 0.14 / (1 + (len / 0.1) ** 2) : 0.014 + 0.05 / (1 + (len / 0.1) ** 2)) * dimL(0.5 * (CROWD[a] + CROWD[b])) * (0.55 + 0.6 * (Math.abs(NT.rho[e]) - 0.6) / 0.4);
      for (let j = 0; j < 2; j++) {
        const s = j ? b : a, o = j ? a : b, v = 2 * e + j, ca = 3 * NT.cloudOf(s);
        pos.set(LAY.subarray(3 * s, 3 * s + 3), 3 * v); cl.set(P.subarray(ca, ca + 3), 3 * v); sc.set(SC.subarray(3 * s, 3 * s + 3), 3 * v);
        E[4 * v] = e; E[4 * v + 1] = NT.rho[e]; E[4 * v + 2] = NT.split[e]; E[4 * v + 3] = ma === mb && ma !== 255 ? ma : NM;
        Nn[4 * v] = s; Nn[4 * v + 1] = o; Nn[4 * v + 2] = ST[s]; Nn[4 * v + 3] = al;
      }
    }
    attr(linkGeo, 'position', pos, 3); attr(linkGeo, 'aCl', cl, 3); attr(linkGeo, 'aE', E, 4); attr(linkGeo, 'aN', Nn, 4); attr(linkGeo, 'aSc', sc, 3);
    linkGeo.boundingSphere = BS;
  }
  const LINK_VS = `
attribute vec3 aCl, aSc; attribute vec4 aE, aN;
uniform float uA; varying vec3 vC; varying float vA;
void main() {
  float idx = aE.x, rho = aE.y, m = aE.w;
  vec3 pos = morph(aCl, position, aN.z, aSc);
  // a link shivers while the samples are shuffled
  pos += vec3(sin(uTime * 37.0 + idx), cos(uTime * 41.0 + idx * 1.7), sin(uTime * 29.0 + idx * 2.3)) * 0.012 * uShuf;
  vec3 c = rho > 0.0 ? uPos : uNeg;
  float a = aN.w * (rho > 0.0 ? 1.0 : 0.7), hi = 0.0;
  // modules: a link inside one in its colour; one between two steps back
  float inside = 1.0 - step(${NM - 0.5}, m);
  c = mix(c, mix(vec3(0.5, 0.56, 0.68), modCol(m) * 1.1, inside), uMods); a *= mix(1.0, 0.3 + 0.9 * inside, uMods);
  float fw = inside * (1.0 - step(0.5, abs(m - uFocus)));
  a *= mix(1.0, 0.06 + 1.4 * fw, uFocusOn); hi = max(hi, fw * uFocusOn);
  // the picked kind's links
  float mine = uKindOn * max(1.0 - step(0.5, abs(aN.x - uKindN)), 1.0 - step(0.5, abs(aN.y - uKindN)));
  c = mix(c, vec3(0.55, 0.95, 1.0), mine); a *= mix(1.0, 0.1 + 4.0 * mine, uKindOn);
  // the threshold (the strongest first: a link shows while its rank is under the cut), the half this copy keeps, the
  // shuffle that leaves none
  a *= clamp(uCut - idx, 0.0, 1.0) * bitAt(aE.z, uBitL) * (1.0 - smoothstep(0.1, 0.75, uShuf));
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  vC = c * depthCue(mv); vA = uA * uCA * uLinks * a * clamp((uPull - aN.z - 0.35) / 0.4, 0.0, 1.0);
}`;
  const LINK_FS = `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.002) discard; gl_FragColor = vec4(vC, vA); }`;
  const copies = [0, 1, 2].map(k => {
    const own = copyU();
    const nodes = new THREE.Points(nodeGeo, mat(NODE_VS, GLOW_FS, own));
    const links = new THREE.LineSegments(linkGeo, mat(LINK_VS, LINK_FS, own));
    nodes.renderOrder = 3; links.renderOrder = 1;
    set.group.add(links, nodes);
    if (k) nodes.visible = links.visible = false;
    return { u: own, nodes, links };
  });

  // ---------------------------------------------------------------- depth: a haze of big faint sprites and soft glow shells
  {
    const n = 260, g = new THREE.BufferGeometry(), pos = new Float32Array(3 * n), h = new Float32Array(4 * n);
    for (let k = 0; k < n; k++) {
      const i = k < 120 ? CM.idx[Math.floor(R() * CM.n)] : Math.floor(R() * NCL);
      for (let a = 0; a < 3; a++) pos[3 * k + a] = P[3 * i + a] + K.gauss(R) * 0.03;
      h[4 * k] = RAD[i] / RC; h[4 * k + 1] = (k < 120 ? 0.14 : 0.2) + 0.1 * R(); h[4 * k + 2] = k < 120 ? 1 : 0; h[4 * k + 3] = k < 120 ? 0.05 : 0.03;
    }
    attr(g, 'position', pos, 3); attr(g, 'aH', h, 4);
    g.boundingSphere = BS;
    const m = mat(`
attribute vec4 aH;
uniform float uA; varying vec3 vC; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aH.y, mv);
  vC = mix(vec3(0.42, 0.5, 0.36), vec3(0.62, 0.78, 0.42), aH.z);
  vA = uA * aH.w * smoothstep(aH.x, aH.x + 0.12, uCloud * 1.05) * (1.0 - 0.7 * uPull) * (1.0 - 0.5 * uNitro) * (1.0 - uSplit);
  if (vA < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA;
void main() { vec2 q = gl_PointCoord - 0.5; float d2 = dot(q, q) * 4.0; if (d2 > 1.0) discard; gl_FragColor = vec4(vC, vA * exp(-d2 * 3.5) * (1.0 - d2)); }`);
    const pts = new THREE.Points(g, m); pts.renderOrder = 0; set.group.add(pts);
  }
  const glowMat = mat(`
uniform float uA; varying vec3 vN, vW;
void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`, `
uniform float uA, uCloud, uPull, uSplit; varying vec3 vN, vW;
void main() {
  float f = abs(dot(normalize(vN), normalize(cameraPosition - vW)));
  float a = pow(f, 3.0) * uA * smoothstep(0.0, 0.45, uCloud) * (1.0 - 0.6 * uPull) * (1.0 - uSplit);
  gl_FragColor = vec4(mix(vec3(0.5, 0.62, 0.38), vec3(0.88, 0.95, 0.8), f * f), a * 0.05);
}`);
  {
    const sg = new THREE.SphereGeometry(1, 28, 18);
    for (const r of [0.3, 0.72]) { const m = new THREE.Mesh(sg, glowMat); m.scale.setScalar(r); m.position.set(C[0], C[1], C[2]); m.renderOrder = 0; set.group.add(m); }
  }
  // the picked kind's bubble
  const bubMat = K.rim(set, { color: '#46d9ff', a0: 0.04, a1: 0.65 });
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), bubMat);
  bubble.renderOrder = 6; bubble.visible = false; set.group.add(bubble);

  // ---------------------------------------------------------------- the split's copies: offsets and sizes
  // 0 by wheat line (two copies: BNI left, control right), 1 by fertiliser (three: not fertilised, fertilised, + DCD),
  // 2 at random (two: half A, half B); copy k keeps the links whose bit (SOIL_DATA.net.splitBits) its half has
  const BIT = { BNI: 0, Ctrl: 1, N: 2, F: 3, S: 4, randomA: 5, randomB: 6 };
  const SPLITS = [
    { n: 2, bits: [BIT.BNI, BIT.Ctrl], x: [-0.6, 0.6], s: 0.72 },
    { n: 3, bits: [BIT.N, BIT.F, BIT.S], x: [-0.8, 0, 0.8], s: 0.55 },
    { n: 2, bits: [BIT.randomA, BIT.randomB], x: [-0.6, 0.6], s: 0.72 },
  ];
  // where copy k of split `by` stands at split amount f (into out); copy 0 is the whole network when f is 0
  function copyPose(by, k, f, out) {
    const sp = SPLITS[by] || SPLITS[0];
    out.x = k < sp.n ? sp.x[k] * f : 0; out.s = 1 + (sp.s - 1) * f; out.bit = f > 0.002 && k < sp.n ? sp.bits[k] : -1;
    out.a = k === 0 ? 1 : k < sp.n ? prog(f, 0.15, 0.7) : 0;
    return out;
  }
  const _cp = { x: 0, s: 1, bit: -1, a: 1 };

  // ---------------------------------------------------------------- the picked kind
  let kindC = -2;
  function setKind(c) {
    kindC = c;
    NB.fill(0);
    const n = c >= 0 ? nodeOf[c] : -1;
    if (n >= 0) for (let e = 0; e < NL; e++) { const a = NT.ij[2 * e], b = NT.ij[2 * e + 1]; if (a === n) NB[b] = 1; else if (b === n) NB[a] = 1; }
    nodeGeo.attributes.aNb.needsUpdate = true;
  }

  // ---------------------------------------------------------------- update
  const cur = { pull: 0, shuf: 0, split: 0, by: 0, kind: -1, focus: -1, cut: NL, nitro: 0, mods: 0, links: 0, cloud: 1, rho: 0.6 };
  const _p = [0, 0, 0];
  let lastRho = -1, cutNow = NL;
  function update(S) {
    const cl = clamp(S.net_cloud, 0, 1), pull = clamp(S.net_pull, 0, 1), sp = clamp(S.net_split, 0, 1), by = clamp(Math.round(S.net_splitBy || 0), 0, 2);
    const fo = S.net_focus >= -0.5 ? Math.round(S.net_focus) : -1, kc = S.net_kind >= -0.5 ? Math.round(S.net_kind) : -1, rho = clamp(S.net_rho || 0.6, 0.6, 0.8);
    Object.assign(cur, { pull, shuf: clamp(S.net_shuffle, 0, 1), split: sp, by, focus: fo >= 0 && fo < NM ? fo : -1, kind: kc >= 0 && kc < NCL ? kc : -1,
      nitro: clamp(S.net_nitro, 0, 1), mods: clamp(S.net_mods, 0, 1), links: clamp(S.net_links, 0, 1), cloud: cl, rho });
    if (rho !== lastRho) { lastRho = rho; cutNow = NT.cut(rho); }
    cur.cut = cutNow;
    if (cur.kind !== kindC) setKind(cur.kind);
    U.uCloud.value = cl; U.uNitro.value = cur.nitro; U.uPull.value = pull; U.uLinks.value = cur.links; U.uCut.value = cur.cut; U.uShuf.value = cur.shuf;
    U.uMods.value = cur.mods; U.uFocus.value = cur.focus; U.uFocusOn.value = cur.focus >= 0 ? 1 : 0; U.uSplit.value = sp;
    const kn = cur.kind >= 0 ? nodeOf[cur.kind] : -1;
    U.uKindN.value = kn; U.uKindC.value = kn >= 0 ? -1 : cur.kind; U.uKindOn.value = cur.kind >= 0 ? 1 : 0;
    for (let k = 0; k < 3; k++) {
      const c = copies[k], p = copyPose(by, k, sp, _cp);
      c.u.uOff.value.set(p.x, 0, 0); c.u.uSc.value = p.s; c.u.uBitL.value = p.bit; c.u.uCA.value = p.a;
      c.nodes.visible = c.links.visible = p.a > 0.003;
    }
    bubble.visible = cur.kind >= 0;
    if (bubble.visible) { posOf(cur.kind, _p); bubble.position.set(_p[0], _p[1], _p[2]); bubble.scale.setScalar(0.035); bubMat.uniforms.uK.value = cl; }
  }

  // ---------------------------------------------------------------- places (the shaders' morph, mirrored) and anchors
  // where cloud kind c is now (into out): a network kind on its way to copy 0's place, the rest receding with the pull
  function posOf(c, out) {
    const n = nodeOf[c];
    if (n < 0) {
      const r = RAD[c], d = Math.max(r, 1e-4), to = r + (0.72 + 0.25 * r / RC - r) * cur.pull;
      for (let a = 0; a < 3; a++) out[a] = C[a] + (P[3 * c + a] - C[a]) * to / d;
      return out;
    }
    const p = copyPose(cur.by, 0, cur.split, _cp), e = smooth((cur.pull - ST[n]) / 0.6), c3 = 3 * c;
    const q0 = C[0] + (LAY[3 * n] - C[0]) * p.s + p.x, q1 = C[1] + (LAY[3 * n + 1] - C[1]) * p.s, q2 = C[2] + (LAY[3 * n + 2] - C[2]) * p.s;
    const dx = q0 - P[c3], dy = q1 - P[c3 + 1], dz = q2 - P[c3 + 2], b = 0.3 * Math.sin(Math.PI * e);
    out[0] = P[c3] + dx * e - dz * b; out[1] = P[c3 + 1] + dy * e; out[2] = P[c3 + 2] + dz * e + dx * b;
    return out;
  }
  const own = f => { const o = [0, 0, 0]; return () => f(o); };
  // a module's middle (in copy 0, as it stands), and its top
  const modAt = (m, top, o) => {
    const p = copyPose(cur.by, 0, cur.split, _cp), M = MCTR[m] || C;
    o[0] = C[0] + (M[0] - C[0]) * p.s + p.x; o[1] = C[1] + ((top ? MTOP[m] + 0.04 : M[1]) - C[1]) * p.s; o[2] = C[2] + (M[2] - C[2]) * p.s;
    return o;
  };
  const copyTopAt = (k, o) => { const p = copyPose(cur.by, k, cur.split, _cp); o[0] = C[0] + p.x; o[1] = C[1] + RN * p.s * 1.02; o[2] = C[2]; return o; };
  const copyTop = k => own(o => copyTopAt(k, o));
  // each guild's tag hangs on its most abundant kind in the cloud
  // (among its 40 most abundant kinds, the one farthest from the tags placed before, so the five tags spread round the
  // cloud; the most abundant itself for the first)
  const GTOP = [];
  GK.forEach((_, g) => {
    const cand = [];
    for (let i = 0; i < NCL && cand.length < 40; i++) if (CL.guild[i] === g + 1) cand.push(i);
    let best = cand[0] || 0, bd = -1;
    if (GTOP.length) for (const c of cand) {
      let d = Infinity;
      for (const o of GTOP) d = Math.min(d, Math.hypot(P[3 * c] - P[3 * o], P[3 * c + 1] - P[3 * o + 1], P[3 * c + 2] - P[3 * o + 2]));
      if (d > bd) { bd = d; best = c; }
    }
    GTOP.push(best);
  });
  const anchors = {
    cloud: [C[0] + 0.32, C[1] + 0.62, C[2] + 0.18], core: [C[0] + 0.12, C[1] + 0.2, C[2] + 0.1], top: [C[0], C[1] + 0.72, C[2]],
    net: [C[0], C[1], C[2]], netTop: [C[0] - 0.1, C[1] + 0.66, C[2] + 0.1], under: [C[0], C[1] - 0.68, C[2]],
    left: copyTop(0), mid: copyTop(1), right: own(o => copyTopAt(SPLITS[cur.by].n - 1, o)),
    pick: own(o => (cur.kind >= 0 ? posOf(cur.kind, o) : (o[0] = C[0], o[1] = C[1], o[2] = C[2], o))),
    module: m => modAt(m, false, [0, 0, 0]),
  };
  GK.forEach((k, g) => { anchors['g_' + k] = own(o => posOf(GTOP[g], o)); });
  for (let m = 0; m < NM; m++) anchors['m' + m] = own(o => modAt(m, true, o));
  for (let k = 0; k < 3; k++) anchors['copy' + k] = copyTop(k);

  // ---------------------------------------------------------------- labels (the set's own, by its params)
  const mods = D.net.mods, big = mods.map((m, i) => i).filter(i => mods[i].n >= 100);
  const WHAT = { fert: 'the fertiliser', time: 'the date', line: 'the wheat line', plot: 'the plots' };
  const follows = m => { const r = mods[m].r2; let best = 'fert'; for (const k in WHAT) if (r[k] > r[best]) best = k; return WHAT[best]; };
  const sp = D.net.splits, kinds100k = Math.round(D.src.kinds / 1000) * 1000;
  const quiet = S => (1 - clamp(S.net_split, 0, 1)) * (1 - clamp(S.net_shuffle, 0, 1));
  const kindOn = () => (cur.kind >= 0 ? 1 : 0);
  const SPLIT_TAGS = [
    [['BNI wheat', sp.line[0]], ['Control wheat', sp.line[1]]],
    [['Not fertilised', sp.fert[0]], ['Fertilised', sp.fert[1]], ['Fertilised + DCD', sp.fert[2]]],
    [['Random half A', { links: sp.random[0][0] }], ['Random half B', { links: sp.random[0][1] }]],
  ];
  const nodesAt = () => { let n = 0; for (let i = 0; i < NN; i++) if (MINI[i] < cur.cut) n++; return n; };
  const labels = [
    { text: [`About ${fmt(kinds100k)} kinds`, ' · of microbe in this soil'], cls: 'cyn', at: 'cloud',
      alpha: S => prog(S.net_cloud, 0.6, 1) * (1 - clamp(S.net_pull, 0, 1) * 2) * (1 - clamp(S.net_nitro, 0, 1)) * (1 - kindOn()) },
    { text: [`${fmt(CM.n)} common kinds`, ` · ${Math.round(100 * D.common.readShare)} % of the reads`], cls: 'amb', at: 'core', minor: false,
      alpha: S => prog(S.net_cloud, 0.8, 1) * (1 - clamp(S.net_pull, 0, 1) * 2) * (1 - clamp(S.net_nitro, 0, 1)) * (1 - kindOn()) },
    ...GK.map((k, g) => {
      const G = D.guilds[k], bf = G.byFert;
      const rest = k === 'nsp' ? ` · ${bf[0].toFixed(2)} % of reads, ${bf[1].toFixed(2)} % with fertiliser` : k === 'mnd' ? ` · ${fmt(G.kinds)} kinds · role unknown`
        : k === 'aoa' ? ` · ${fmt(G.kinds)} kinds · ${G.share.toFixed(1)} % of reads` : ` · ${fmt(G.kinds)} kinds · ${G.share.toFixed(2)} %`;
      return { text: [G.name, rest], cls: k === 'aoa' ? 'mag' : k === 'nit' ? 'cyn' : k === 'mnd' ? '' : 'amb', at: 'g_' + k, minor: k === 'nsm' || k === 'mnd',
        alpha: S => prog(S.net_nitro, 0.5, 1) * (1 - clamp(S.net_pull, 0, 1)) * (1 - kindOn()) };
    }),
    { text: () => [`${fmt(nodesAt())} kinds`, ` · ${fmt(cur.cut)} links`], cls: 'cyn', at: 'netTop',
      alpha: S => prog(S.net_links, 0.5, 1) * (1 - clamp(S.net_mods, 0, 1)) * quiet(S) * (1 - kindOn()) },
    { text: ['Shuffled', ' · not one link is left'], cls: 'amb', at: 'netTop', alpha: S => prog(S.net_shuffle, 0.55, 0.9) * prog(S.net_links, 0.5, 1) },
    ...big.map(m => ({ text: [`${fmt(mods[m].n)} kinds`, ` · follow ${follows(m)}`], cls: '', at: 'm' + m,
      alpha: S => prog(S.net_mods, 0.5, 1) * quiet(S) * (cur.focus < 0 || cur.focus === m ? 1 : 0) * (1 - kindOn()) })),
    // a small module in focus has its tag too
    ...mods.map((M, m) => m).filter(m => mods[m].n < 100).map(m => ({ text: [`${fmt(mods[m].n)} kinds`, ` · follow ${follows(m)}`], cls: '', at: 'm' + m,
      alpha: S => (cur.focus === m ? 1 : 0) * prog(S.net_mods, 0.5, 1) * quiet(S) * (1 - kindOn()) })),
    ...[0, 1, 2].flatMap(by => SPLIT_TAGS[by].map(([name, o], k) => ({ text: [name, ` · ${fmt(o.links)} links`], cls: by === 0 ? (k ? 'amb' : 'cyn') : '', at: 'copy' + k,
      alpha: S => prog(S.net_split, 0.6, 1) * (cur.by === by ? 1 : 0) }))),
    { text: [`${fmt(sp.lineDiff)} links apart`, ` · random halves: ${fmt(sp.randomDiff[0])} to ${fmt(sp.randomDiff[1])}`], cls: 'amb', at: 'under',
      alpha: S => prog(S.net_split, 0.75, 1) * (cur.by === 0 ? 1 : 0) },
    { text: () => kindText(cur.kind), cls: 'cyn', at: 'pick', alpha: () => kindOn() },
  ];
  // a kind in words, for its tag: [bold, rest]
  function kindText(c) {
    if (c < 0) return ['', ''];
    const I = info(c);
    return [`Kind ${fmt(I.rank)}`, ` · ${I.name ? I.name + ' · ' : ''}${I.phylum}`];
  }
  // a kind's numbers (the explore panes): its abundance rank among all 100,116, phylum, name (a common kind's genus, or
  // what it is known as), guild, in how many samples, its mean share of reads, what it differs by, and in the network its
  // module and links
  const FLAG = [[1, 'fertiliser'], [2, 'date'], [4, 'wheat line'], [8, 'plot']];
  function info(c) {
    const ci = comOf[c], n = nodeOf[c], fl = ci >= 0 ? CM.flags[ci] : 0;
    return { cloud: c, rank: CL.rank[c], phylum: D.phyla.names[CL.phy[c]], name: ci >= 0 ? CM.name(ci) : '', guild: CL.guild[c] ? D.guilds.names[CL.guild[c] - 1] : '',
      guildKey: CL.guild[c] ? GK[CL.guild[c] - 1] : '', prev: CL.prev[c], samples: D.src.samples, share: 100 * Math.pow(10, CL.ab[c]), common: ci >= 0,
      differs: ci >= 0 ? FLAG.filter(([b]) => fl & b).map(([, w]) => w) : null, node: n, module: n >= 0 && NT.mod[n] !== 255 ? NT.mod[n] : -1, links: n >= 0 ? NT.deg[n] : 0 };
  }

  // ---------------------------------------------------------------- views and explore
  const cam = { default: [-20, 12, 4.4, 0, 1.3, 0], cloud: [-20, 12, 4.4, 0, 1.3, 0], core: [-15, 8, 2.4, 0, 1.3, 0],
    net: [-12, 10, 2.8, 0, 1.3, 0], module: [-12, 20, 3.8, 0, 0.85, 0], split: [0, 8, 3.6, 0, 1.3, 0], over: [-24, 38, 4.6, 0, 0.6, 0] };
  const controls = [
    { key: 'view', label: 'View', options: [['cloud', 'The crowd'], ['net', 'The network'], ['split', 'Split']] },
    { key: 'colour', label: 'Colour', options: [['phylum', 'Phylum'], ['module', 'Module'], ['guild', 'Nitrifiers']] },
    { key: 'by', label: 'Split by', options: [['line', 'Wheat line'], ['fert', 'Fertiliser'], ['random', 'At random']], when: v => v.view === 'split' },
  ];
  function explore(c) {
    const net = c.view !== 'cloud', t = c.t;
    return { net_cloud: 1, net_nitro: c.colour === 'guild' ? 1 : 0, net_pull: net ? 1 : 0, net_links: net ? prog(t, 0.6, 1.8) : 0,
      net_shuffle: 0, net_mods: c.colour === 'module' ? 1 : 0, net_split: c.view === 'split' ? 1 : 0,
      net_splitBy: { line: 0, fert: 1, random: 2 }[c.by] || 0 };
  }

  // ---------------------------------------------------------------- picking
  const _inv = new THREE.Matrix4(), _ray = new THREE.Ray(), _q = [0, 0, 0];
  // a ray (a THREE.Raycaster in world coordinates) to the nearest kind it passes close to: in the cloud any kind, once the
  // network has pulled out only the network's (the rest is a faint shell); none while the network is split
  function pick(raycaster) {
    if (cur.split > 0.3 || set.uA.value < 0.5) return null;
    set.group.updateMatrixWorld();
    _ray.copy(raycaster.ray).applyMatrix4(_inv.copy(set.group.matrixWorld).invert());
    const o = _ray.origin, d = _ray.direction, netOnly = cur.pull > 0.5;
    let best = -1, bs = 1;
    const test = c => {
      posOf(c, _q);
      const x = _q[0] - o.x, y = _q[1] - o.y, z = _q[2] - o.z, along = x * d.x + y * d.y + z * d.z;
      if (along <= 0) return;
      const off = Math.sqrt(Math.max(0, x * x + y * y + z * z - along * along)), tol = 0.008 + 0.006 * along, s = off / tol;
      if (s < bs) { bs = s; best = c; }
    };
    if (netOnly) { for (let i = 0; i < NN; i++) if (MINI[i] < cur.cut) test(NT.cloudOf(i)); } else for (let c = 0; c < NCL; c++) test(c);
    return best >= 0 ? { kind: 'kind', i: best } : null;
  }
  const API = {
    n: NCL, nodes: NN, centre: C,
    pick, pos: c => posOf(c, [0, 0, 0]), info, kindText,
    module: m => modAt(m, false, [0, 0, 0]),
    nodeOf: c => (c >= 0 && c < NCL ? nodeOf[c] : -1),
    cloudOfNode: i => NT.cloudOf(i),
    // a module's kinds, most linked first (cloud indices), for the panes
    members: m => SD.net.members(m).sort((a, b) => NT.deg[b] - NT.deg[a]).map(i => NT.cloudOf(i)),
    follows, nodesAt: rho => { const cut = NT.cut(rho); let n = 0; for (let i = 0; i < NN; i++) if (MINI[i] < cut) n++; return n; },
    // the most abundant kind of a guild (for the panes' "show one")
    guildTop: k => GTOP[GK.indexOf(k)],
  };
  return Object.assign(set, {
    params: { net_a: 1, net_cloud: 1, net_nitro: 0, net_pull: 0, net_links: 0, net_shuffle: 0, net_mods: 0, net_rho: 0.6,
      net_focus: -1, net_split: 0, net_splitBy: 0, net_kind: -1 },
    log: [],
    update, anchors, labels, cam, controls, explore, api: () => API,
  });
};
