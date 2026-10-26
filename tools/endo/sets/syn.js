// The neuromuscular junction, close up: a cut-away section through one junction, the hero of the endotype story.
// Up (+y) is the nerve, down the muscle; the cut face (z = ZC) looks towards +z. A glassy nerve ending (bouton)
// under a thin Schwann cell cap, its myelinated axon arriving from above left; inside, synaptic vesicles clustered
// over four active zones (dense bars opposite the mouths of the junctional folds, a few vesicles docked), three
// mitochondria cut open to show their cristae, endosomes and a faint actin mesh. Across the synaptic cleft runs the
// basement membrane (a glowing fibrous sheet of laminin crosses and collagen threads, acetylcholinesterase on
// collagen-Q tails, agrin strands from the nerve), dipping into each of six deep junctional folds of the muscle
// membrane. Acetylcholine receptors (five-subunit rosettes) carpet the crests with rapsyn under them and MuSK/LRP4
// pairs among them; sodium channels line the troughs. Inside the fibre: two of the junction's own nuclei (one cut
// open), endoplasmic reticulum and a Golgi stack, mitochondria, and striated myofibrils with desmin round their
// Z-discs. Params: assembly, firing, fatigue, the 35 seed genes where they act, an endotype's place, the endotypes
// arriving. Data: ENDO_DATA (endotype colours, places and seeds). Sizes are exaggerated where they would vanish.
SETS.syn = function (K) {
  const { THREE, clamp, lerp, prog, smooth, rng, gauss, v3 } = K;
  const set = K.newSet('syn');
  const PI = Math.PI, TAU = 2 * PI;
  const R = rng(4711);
  const f4 = x => x.toFixed(4);   // numbers for GLSL

  // ------------------------------------------------------------------ the layout (local units: 1 micrometre is about 0.5)
  const ZC = 0.34, ZB = -0.62, XS = 1.2;            // the cut plane, the back of the section, its half width
  const YP = 0.13, YL = 0.06;                        // the nerve's membrane over the cleft; the basement membrane's middle
  const BC = [0, 0.2, -0.12], BRX = 0.9, BRU = 0.78, BRD = 0.07, BRZ = 0.62;   // the bouton: a superellipsoid round BC
  const NF = 6, FX = [0, 1, 2, 3, 4, 5].map(i => -0.625 + 0.25 * i), FD = [0.34, 0.42, 0.38, 0.41, 0.44, 0.33], FW = 0.022;
  const AZ = [1, 2, 3, 4];                           // active zones over the mouths of the four middle folds
  const ZP = 0.42;                                   // Z-disc spacing of the myofibrils (shorter than life)
  const NA = [-0.5, -0.6, 0.2], NAR = [0.28, 0.13, 0.2];      // nucleus A (cut open) and B (whole)
  const NB = [0.66, -0.6, -0.2], NBR = [0.22, 0.11, 0.15];
  const GO = [-0.07, -0.6, 0.16];                    // the Golgi stack, at nucleus A's right end
  const MYO = [];                                    // myofibrils: [y, z], along x
  for (const y of [-0.9, -1.06]) for (const z of [0.22, 0.05, -0.12, -0.29, -0.46]) MYO.push([y + (z === 0.05 ? 0.012 : 0), z]);
  const MYR = 0.06;

  // ------------------------------------------------------------------ endotypes and places (from the data)
  // place slots (index into uG/uD): 0 neutral, 1 mito, 2 lamina, 3 golgi, 4 channels, 5 er, 6 endosome, 7 vesicles,
  // 8 scaffold, 9 junction (the synaptic membranes), 10 nucleus
  const PLACES = ['', 'mito', 'lamina', 'golgi', 'channels', 'er', 'endosome', 'vesicles', 'scaffold', 'junction'];
  const SLOT = {}; PLACES.forEach((p, i) => { if (p) SLOT[p] = i; });
  const ED = ENDO_DATA, EN = ED.endo, ECOL = EN.map(e => K.rgb(e.col));
  const SCOL = [...Array(12)].map(() => new THREE.Vector3(1, 1, 1));
  EN.forEach(e => { if (SLOT[e.place] !== undefined) SCOL[SLOT[e.place]].set(...ECOL[e.id]); });
  const GENDO = {}; EN.forEach(e => e.seeds.forEach(s => { GENDO[s] = e.id; }));

  // ------------------------------------------------------------------ shared uniforms
  const SU = {
    uTime: K.U.uTime, uG: { value: new Array(12).fill(0) }, uD: { value: new Array(12).fill(1) }, uSC: { value: SCOL },
    uStage: { value: [1, 1, 1, 1, 1, 1] }, uNerveY: { value: 0 },
    uPh: { value: 9 }, uFire: { value: 0 }, uWave: { value: 0 }, uTw: { value: 0 }, uFuse: { value: new Array(16).fill(0) }, uShell: { value: 1 },
  };
  // aS: place slot, build stage (0 fibre, 1 membrane, 2 basement membrane, 3 receptors, 4 nerve, 5 Schwann cell and
  // matrix proteins), moves with the arriving nerve (0/1), cut at the cut plane (0/1).
  // aQ: when the impulse (or the muscle's wave) passes in the firing cycle, its kind (0 none, 1 nerve, 2 muscle wave,
  // 3 wave with striations, 4 fibrous sheet, 5 striated myofibril), and a brightness gain
  const VH = `
attribute vec4 aS; attribute vec3 aQ;
uniform float uG[12], uD[12], uStage[6], uNerveY, uPh, uFire, uWave, uTw; uniform vec3 uSC[12];
varying vec3 vGC, vL; varying float vDm, vK, vP, vKind, vClip;`;
  const VB = `
{ int si = int(aS.x + 0.5); int st = int(aS.y + 0.5); vGC = uSC[si] * uG[si]; vDm = uD[si]; vK = uStage[st]; vClip = aS.w; vKind = aQ.y;
  float pd = uPh - aQ.x; vP = (aQ.y < 0.5 || aQ.y > 3.5) ? 0.0 : (aQ.y < 1.5 ? uFire : uWave) * exp(-pd * pd / 0.0018); vL = position; }`;
  // the receptors open where acetylcholine lands: e = (release site, squared distance to it, a random threshold)
  const OPEN = `
uniform float uFuse[16];
float openR(vec3 e) {
  float f = uFuse[int(e.x + 0.5)], env = smoothstep(0.31, 0.37, uPh) * (1.0 - smoothstep(0.52, 0.74, uPh));
  return f * env * step(e.z, exp(-e.y / 0.0065));
}`;

  // translucent membranes (bouton, axon, myelin, Schwann cell, muscle membrane, organelle envelopes, the fibre's
  // surface, the cut edges and the basement membrane's sheet): additive glass that glows at the rim. Its colour adds
  // up as light; its alpha is only as much as it glows (plain additive blending wrote alpha 1 under every faint
  // sheet, so over the room in passthrough AR the glass showed as a black box; in VR the canvas is opaque anyway)
  const glassMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA }, SU),
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `attribute vec3 color;` + VH + `
varying vec3 vN, vW, vC; varying float vGA, vSc;
void main() {` + VB + `
  vC = color; vGA = aQ.z; vSc = length(modelMatrix[0].xyz);
  vec3 p = position; p.y += aS.z * uNerveY;
  vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `uniform float uA, uShell;
varying vec3 vN, vW, vC, vGC, vL; varying float vDm, vK, vP, vKind, vClip, vGA, vSc;
void main() {
  float sh = vKind > 2.5 && vKind < 3.5 ? uShell : 1.0;   // the fibre's wide surface fades with syn_shell
  if (vK < 0.003 || sh < 0.003 || (vClip > 0.5 && vL.z > ${f4(ZC)})) discard;
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW); float r = pow(1.0 - abs(dot(n, v)), 2.2), pat = 1.0;
  if (vKind > 1.5 && vKind < 4.5) r = min(r, 0.55);   // wide sheets seen edge-on would add up to white
  if (vKind > 3.5 && vKind < 4.5) {   // the basement membrane: a fibrous mesh
    vec2 q = vec2(vL.x + vL.y, vL.z) * 70.0;
    pat = 0.2 + 0.8 * pow(abs(sin(q.x + 1.7 * sin(q.y * 0.53)) * sin(q.y * 0.8 + 1.3 * sin(q.x * 0.41))), 0.7); r = 0.18 + 0.4 * r;
  } else if (vKind > 2.5) { pat = 0.65 + 0.35 * smoothstep(0.2, 0.6, abs(fract(vL.x / ${f4(ZP)}) - 0.5) * 2.0); r = 0.2 + 0.8 * r; }   // the fibre's surface: a base tint, striated
  vec3 pc = vKind < 1.5 ? vec3(0.25, 0.42, 0.5) : vec3(1.0, 0.68, 0.32);
  float a0 = (vKind > 1.5 && vKind < 4.5) ? 0.012 : 0.03;   // sheets seen face-on through many folds stay faint
  vec3 col = (vC * (0.45 + 0.85 * r) * vDm * pat + vGC * (0.5 + 1.2 * r) * pat) * (a0 + 0.42 * r) + pc * vP * (0.35 + 0.8 * r);
  // glass right in front of the eye fades (in the set's own units, so also at life size in a headset)
  col *= vGA * vK * sh * smoothstep(0.03, 0.3, distance(cameraPosition, vW) / vSc) * uA;
  gl_FragColor = vec4(col, min(0.85, 1.4 * max(col.r, max(col.g, col.b))));
}`,
  });
  set.mats.push(glassMat);

  // lit surfaces with the set's hooks: place glow and dimming, build stage, the nerve arriving, the cut, rim light
  const FH = `
uniform float uSelf, uRimK; uniform vec3 uRimC;
varying vec3 vGC, vL; varying float vDm, vK, vP, vKind, vClip;`;
  function lit(key, o = {}) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.rough === undefined ? 0.5 : o.rough, metalness: 0, side: o.side || THREE.FrontSide });
    K.fade(set, m, 1);
    m.extensions = { derivatives: true };
    const un = { uSelf: { value: o.self === undefined ? 0.14 : o.self }, uRimK: { value: o.rimK === undefined ? 0.35 : o.rimK }, uRimC: { value: new THREE.Color(...(o.rimC || [0.6, 0.8, 1])) } };
    m.userData.u = un;
    m.customProgramCacheKey = () => 'syn-' + key;
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, SU, un, o.uniforms || {});
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + VH + (o.vh || ''))
        .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position);' + VB + '\n' + (o.vb || '') + '\ntransformed.y += aS.z * uNerveY;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + FH + (o.fh || ''))
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (vK < 0.003 || (vClip > 0.5 && vL.z > ${f4(ZC)})) discard;` + (o.fc || ''))
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + (o.fcol || '') + '\ndiffuseColor.rgb *= 0.3 + 0.7 * vDm;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float rimF = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);
totalEmissiveRadiance += diffuseColor.rgb * uSelf + uRimC * (uRimK * rimF * vDm) + vGC * (0.3 + 0.9 * rimF) + vec3(1.0, 0.72, 0.4) * vP * (0.12 + 0.4 * rimF);` + (o.fe || ''));
    };
    return m;
  }

  // ------------------------------------------------------------------ geometry helpers
  const V = a => new THREE.Vector3(a[0], a[1], a[2]);
  // collects geometries into one indexed geometry with the attributes in spec ({ name: size }); vals give each
  // attribute a constant, a function (x, y, z, i) of the (transformed) vertex, or nothing (the geometry's own, or
  // zeros); m an optional Matrix4 applied on the way
  function Builder(spec) {
    const B = { items: [], n: 0, ni: 0 }, keys = Object.keys(spec), nm = new THREE.Matrix3();
    B.add = (geo, vals = {}, m) => { B.items.push([geo, vals, m]); B.n += geo.attributes.position.count; B.ni += geo.index ? geo.index.array.length : geo.attributes.position.count; };
    B.geo = () => {
      const PP = new Float32Array(B.n * 3), NN = new Float32Array(B.n * 3), II = B.n > 65535 ? new Uint32Array(B.ni) : new Uint16Array(B.ni);
      const AA = keys.map(k => new Float32Array(B.n * spec[k]));
      let o = 0, oi = 0;
      for (const [geo, vals, m] of B.items) {
        const P = geo.attributes.position.array, N = geo.attributes.normal.array, cnt = geo.attributes.position.count, base = o;
        const hs = keys.map((k, h) => {
          const v = vals[k], sz = spec[k], ga = geo.attributes[k];
          if (typeof v === 'function') return [1, v, sz, AA[h]];
          if (v === undefined) return ga && ga.itemSize === sz ? [2, ga.array, sz, AA[h]] : [0, null, sz, AA[h]];
          return [3, typeof v === 'number' ? [v] : v, sz, AA[h]];
        });
        const e = m ? m.elements : null, q = m ? nm.getNormalMatrix(m).elements : null;
        for (let i = 0; i < cnt; i++, o++) {
          let x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
          if (e) {
            const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14];
            x = X; y = Y; z = Z;
            const a = q[0] * nx + q[3] * ny + q[6] * nz, b = q[1] * nx + q[4] * ny + q[7] * nz, c = q[2] * nx + q[5] * ny + q[8] * nz, l = Math.hypot(a, b, c) || 1;
            nx = a / l; ny = b / l; nz = c / l;
          }
          PP[o * 3] = x; PP[o * 3 + 1] = y; PP[o * 3 + 2] = z; NN[o * 3] = nx; NN[o * 3 + 1] = ny; NN[o * 3 + 2] = nz;
          for (let h = 0; h < hs.length; h++) {
            const H = hs[h], kind = H[0], v = H[1], sz = H[2], arr = H[3], w = o * sz;
            if (kind === 3) for (let c = 0; c < sz; c++) arr[w + c] = v[c];
            else if (kind === 2) for (let c = 0; c < sz; c++) arr[w + c] = v[i * sz + c];
            else if (kind === 1) { const r = v(x, y, z, i); if (sz === 1) arr[w] = +r; else for (let c = 0; c < sz; c++) arr[w + c] = r[c]; }
          }
        }
        if (geo.index) { const ix = geo.index.array; for (let i = 0; i < ix.length; i++) II[oi++] = ix[i] + base; }
        else for (let i = 0; i < cnt; i++) II[oi++] = base + i;
      }
      B.items = null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(PP, 3)); g.setAttribute('normal', new THREE.BufferAttribute(NN, 3));
      keys.forEach((k, h) => g.setAttribute(k, new THREE.BufferAttribute(AA[h], spec[k])));
      g.setIndex(new THREE.BufferAttribute(II, 1));
      g.computeBoundingSphere();
      return g;
    };
    return B;
  }
  // a tube along an explicit centre line f(u), u 0..1 (frames by parallel transport), radius r(u) or r(u, angle)
  function tubeFn(f, seg, rad, r) {
    const nv = (seg + 1) * (rad + 1), P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv);
    const idx = new Uint32Array(seg * rad * 6), cs = [], sn = [];
    for (let j = 0; j <= rad; j++) { cs.push(-Math.cos(j / rad * TAU)); sn.push(Math.sin(j / rad * TAU)); }
    let nr = null, o = 0;
    const C = []; for (let i = 0; i <= seg; i++) C.push(f(i / seg));
    for (let i = 0; i <= seg; i++) {
      const u = i / seg, c = C[i], t = v3.norm(v3.sub(C[Math.min(seg, i + 1)], C[Math.max(0, i - 1)]));
      if (!nr) nr = v3.norm(v3.cross(t, Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      else nr = v3.norm(v3.sub(nr, v3.mul(t, v3.dot(nr, t))));
      const bn = v3.cross(t, nr), r2 = typeof r === 'function' && r.length > 1, r1 = r2 ? 0 : typeof r === 'function' ? r(u) : r;
      for (let j = 0; j <= rad; j++) {
        const rr = r2 ? r(u, j / rad * TAU) : r1;
        const nx = cs[j] * nr[0] + sn[j] * bn[0], ny = cs[j] * nr[1] + sn[j] * bn[1], nz = cs[j] * nr[2] + sn[j] * bn[2];
        P[o * 3] = c[0] + rr * nx; P[o * 3 + 1] = c[1] + rr * ny; P[o * 3 + 2] = c[2] + rr * nz;
        N[o * 3] = nx; N[o * 3 + 1] = ny; N[o * 3 + 2] = nz; U[o] = u; o++;
      }
    }
    let k = 0;
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) { const a = i * (rad + 1) + j, b = a + rad + 1; idx[k++] = a; idx[k++] = b; idx[k++] = a + 1; idx[k++] = b; idx[k++] = b + 1; idx[k++] = a + 1; }
    const at = (array, itemSize) => ({ array, itemSize, count: array.length / itemSize });
    return { attributes: { position: at(P, 3), normal: at(N, 3), aU: at(U, 1) }, index: { array: idx } };
  }
  // a grid surface from rows of points (each row the same length); normals from the mesh
  function rowsGeo(rows, closed) {
    const nr = rows.length, nc = rows[0].length, P = new Float32Array(nr * nc * 3), idx = [];
    rows.forEach((row, j) => row.forEach((p, i) => P.set(p, (j * nc + i) * 3)));
    for (let j = 0; j < nr - 1; j++) for (let i = 0; i < nc - 1; i++) { const a = j * nc + i, b = a + nc; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    if (closed) for (let j = 0; j < nr - 1; j++) { const a = j * nc + nc - 1, b = a + nc; idx.push(a, b, j * nc, b, (j + 1) * nc, j * nc); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // a closed surface f(u, v) -> [x, y, z], u 0..1 pole to pole, v 0..1 around
  function surf(nu, nv, f) {
    const rows = [];
    for (let i = 0; i <= nu; i++) { const row = []; for (let j = 0; j < nv; j++) row.push(f(i / nu, j / nv)); rows.push(row); }
    return rowsGeo(rows, true);
  }
  // matrix mapping the unit cylinder (y -0.5..0.5, radius 1) onto a strut from a to b of radius r
  function strutM(a, b, r) {
    const d = v3.sub(b, a), L = v3.len(d), y = v3.norm(d);
    const x = v3.norm(Math.abs(y[0]) < 0.9 ? v3.cross(y, [1, 0, 0]) : v3.cross(y, [0, 1, 0])), z = v3.cross(x, y);
    const m = new THREE.Matrix4();
    m.makeBasis(V(v3.mul(x, r)), V(v3.mul(y, L)), V(v3.mul(z, r)));
    m.setPosition(...v3.mul(v3.add(a, b), 0.5));
    return m;
  }
  // a matrix that puts a template's +y along n at p, turned by a about n, scaled s
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _Y = new THREE.Vector3(0, 1, 0);
  function orient(p, n, a, s, out) {
    _q.setFromUnitVectors(_Y, V(n).normalize()).multiply(_q2.setFromAxisAngle(_Y, a));
    return (out || new THREE.Matrix4()).compose(V(p), _q, new THREE.Vector3(s, s, s));
  }
  const ellipsoid = (c, r, nu, nv, wob) => surf(nu, nv, (u, v) => {
    const th = u * PI, ph = v * TAU, w = wob ? 1 + wob(th, ph) : 1;
    return [c[0] + r[0] * w * Math.sin(th) * Math.cos(ph), c[1] + r[1] * w * Math.cos(th), c[2] + r[2] * w * Math.sin(th) * Math.sin(ph)];
  });
  const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

  // ------------------------------------------------------------------ shapes
  // the bouton: rounder on top, flat underneath (the side facing the cleft); bR(d) its radius in unit direction d
  function bR(d) {
    const n = 2.1 + 1.5 * smooth(-d[1] * 1.6), ry = d[1] > 0 ? BRU : BRD;
    return Math.pow(Math.pow(Math.abs(d[0]) / BRX, n) + Math.pow(Math.abs(d[1]) / ry, n) + Math.pow(Math.abs(d[2]) / BRZ, n), -1 / n);
  }
  const bWob = d => 1 + 0.03 * smooth(d[1] * 2 + 0.2) * Math.sin(Math.atan2(d[2], d[0]) * 3 + 1.1) * Math.sin(Math.acos(clamp(d[1], -1, 1)) * 2.4);
  const bIn = (p, m = 0, w) => { const q = v3.sub(p, BC), l = v3.len(q) || 1e-6, d = v3.mul(q, 1 / l); return l < bR(d) * (w ? bWob(d) : 1) - m; };
  const bPt = (d, off = 0) => v3.add(BC, v3.mul(d, bR(d) * bWob(d) + off));
  // the underside's height at (x, z)
  function bBot(x, z) { let lo = BC[1] - BRD - 0.02, hi = BC[1]; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (bIn([x, m, z])) hi = m; else lo = m; } return hi; }
  const AXP = [[-2.9, 2.3, -0.55], [-2.2, 1.86, -0.46], [-1.5, 1.42, -0.36], [-0.98, 1.1, -0.26], [-0.58, 0.88, -0.18], [-0.3, 0.72, -0.13]];
  const axC = new THREE.CatmullRomCurve3(AXP.map(V));
  const axAt = u => axC.getPointAt(clamp(u, 0, 1)).toArray();
  const AXE = axAt(0.86);   // where the impulse enters the bouton

  // the muscle membrane: the folds wander a little along z, and their depth changes
  const fX = (i, z) => FX[i] + 0.008 * Math.sin(z * 4.1 + i * 1.9) + 0.003 * Math.sin(z * 9.3 + i);
  const fD = (i, z) => FD[i] * (1 + 0.07 * Math.sin(z * 3.3 + i * 2.7));
  const lip = x => 0.24 * smooth((Math.abs(x) - 0.82) / 0.38);   // the gutter's walls round the bouton
  // the profile across x at depth z: crests at y0, the gutter's walls, and six folds (half width w at the mouth,
  // wider at the bottom, dd shallower than the membrane's folds); dip rounds the mouths. 252 points at every z
  function profile(z, y0, w, dd, dip) {
    const P = [];
    const crest = (xa, xb, n, skip) => {
      for (let k = skip ? 1 : 0; k <= n; k++) {
        const x = lerp(xa, xb, k / n); let y = y0 + lip(x);
        for (let i = 0; i < NF; i++) { const e = Math.abs(x - fX(i, z)) - w; if (e < 0.03) y -= dip * smooth(1 - e / 0.03); }
        P.push([x, y, z]);
      }
    };
    let x0 = -XS;
    for (let i = 0; i < NF; i++) {
      const cx = fX(i, z), D = fD(i, z) - dd;
      crest(x0, cx - w, i ? 7 : 18, i > 0); P.pop();
      for (let k = 0; k <= 30; k++) {
        const s = 0.5 - 0.5 * Math.cos(PI * k / 30), sn = Math.sin(PI * s);
        P.push([cx - w * (1 + 0.4 * Math.pow(sn, 4)) * Math.cos(PI * s), y0 - dip - (D + y0 - dip) * Math.pow(sn, 0.32), z]);
      }
      x0 = cx + w;
    }
    crest(x0, XS, 18, true);
    return P;
  }
  const memProf = z => profile(z, 0, FW, 0, 0.015);
  const lamProf = z => profile(z, YL, 0.008, 0.018, 0.03);
  // points every 'step' along a profile (arc length, starting at 'off'), with the outward normal (into the cleft)
  function along(P, step, off) {
    const out = [];
    let acc = -off;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 1e-9) continue;
      const n = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L, 0];
      while (acc + L >= 0) { const f = -acc / L; out.push({ p: [lerp(a[0], b[0], f), lerp(a[1], b[1], f), a[2]], n }); acc -= step; }
      acc += L;
    }
    return out;
  }
  const nearFold = x => { let k = 0; for (let i = 1; i < NF; i++) if (Math.abs(x - FX[i]) < Math.abs(x - FX[k])) k = i; return k; };
  // when the muscle's wave passes a point of its membrane (from the end plate outwards and down into the folds)
  const waveT = (x, y) => 0.42 + 0.35 * Math.max(0, Math.abs(x) - 0.45) + 0.25 * Math.max(0, -y);

  // ------------------------------------------------------------------ glass: every translucent membrane in one mesh
  const glass = Builder({ color: 3, aS: 4, aQ: 3 });
  const gAdd = (geo, col, s, q, m) => glass.add(geo, { color: col, aS: s, aQ: q }, m);
  const ring = (pts, closed) => u => {   // a polyline as a function u 0..1 -> point
    const n = closed ? pts.length : pts.length - 1, x = clamp(u, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
    return v3.lerp(pts[i], pts[(i + 1) % pts.length], f);
  };
  // the bouton (pale cyan), the impulse spreading from where the axon enters
  gAdd(surf(44, 72, (u, v) => { const th = u * PI, ph = v * TAU; return bPt([Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]); }),
    [0.5, 0.8, 1.0], [9, 4, 1, 1], (x, y, z) => [0.14 + 0.1 * v3.dist([x, y, z], AXE), 1, 1]);
  // the axon, its myelin (two internodes and a node of Ranvier between them) and the terminal Schwann cell's sleeve
  gAdd(tubeFn(axAt, 90, 12, u => 0.072 + 0.1 * smooth((u - 0.8) / 0.2)), [0.55, 0.85, 1.0], [0, 4, 1, 1], (x, y, z, i) => [0.16 * Math.floor(i / 13) / 90, 1, 1.1]);
  for (const [u0, u1] of [[0.0, 0.37], [0.4, 0.72]]) {
    gAdd(tubeFn(u => axAt(lerp(u0, u1, u)), 40, 14, u => 0.074 + 0.06 * Math.pow(Math.sin(PI * u), 0.35)), [0.82, 0.8, 1.0], [0, 4, 1, 1], (x, y, z, i) => [0.16 * lerp(u0, u1, Math.floor(i / 15) / 40), 1, 0.75]);
  }
  gAdd(tubeFn(u => axAt(lerp(0.73, 0.9, u)), 16, 14, u => 0.1 + 0.03 * Math.sin(PI * u) + 0.06 * smooth(u)), [1.0, 0.86, 0.66], [0, 5, 1, 1], [0, 0, 0.7]);
  // the Schwann cell's cap over the bouton's top, with a ragged edge
  const capMax = ph => 0.42 * PI + 0.07 * Math.sin(3 * ph + 0.5) + 0.04 * Math.sin(7 * ph);
  const SND = v3.norm([0.28, 1, -0.32]);   // where the Schwann cell's nucleus bulges its cap
  const capPt = (th, ph) => { const d = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
    return bPt(d, 0.035 + 0.012 * Math.sin(5 * ph + 2 * th) + 0.075 * Math.exp(-(1 - v3.dot(d, SND)) / 0.012)); };
  gAdd(surf(18, 72, (u, v) => capPt(u * capMax(v * TAU), v * TAU)), [1.0, 0.86, 0.66], [0, 5, 1, 1], [0, 0, 0.8]);
  // the muscle membrane over the folds (rose), fading at the back and the sides; the wave runs along it
  const memRows = []; for (let j = 0; j <= 18; j++) memRows.push(memProf(lerp(ZB, ZC, j / 18)));
  gAdd(rowsGeo(memRows), [1.0, 0.58, 0.7], [9, 1, 0, 0], (x, y, z) => [waveT(x, y), 2, 1.05 * smooth((z - ZB) / 0.22) * (0.3 + 0.7 * smooth((XS - Math.abs(x)) / 0.2)) * (0.3 + 0.4 * smooth((y + 0.06) / 0.06))]);
  // the basement membrane: a fibrous sheet through the middle of the cleft and down into every fold
  const lamRows = []; for (let j = 0; j <= 18; j++) lamRows.push(lamProf(lerp(ZB, ZC, j / 18)));
  gAdd(rowsGeo(lamRows), [0.35, 0.85, 1.0], [2, 2, 0, 0], (x, y, z) => [0, 4, 0.9 * smooth((z - ZB) / 0.22) * (0.3 + 0.7 * smooth((XS - Math.abs(x)) / 0.2)) * (0.3 + 0.7 * smooth((y + 0.02) / 0.07))]);
  // the fibre's surface round the junction (a wide cylinder along x), cut away where the section is: a mesh of its own,
  // which syn_shell fades and hides (so a headset keeping the scene clear of your head leaves it out when it is off)
  const shell = Builder({ color: 3, aS: 4, aQ: 3 });
  {
    const RF = 3.2, yc = 0.2 - RF, aB = Math.asin(ZB / RF), xs = [], as = [];
    for (let k = 0; k <= 22; k++) xs.push(lerp(-5, -XS, k / 22));
    for (let k = 1; k <= 8; k++) xs.push(lerp(-XS, XS, k / 8));
    for (let k = 1; k <= 22; k++) xs.push(lerp(XS, 5, k / 22));
    for (let k = 0; k <= 10; k++) as.push(lerp(-1.05, aB, k / 10));
    for (let k = 1; k <= 14; k++) as.push(lerp(aB, 1.05, k / 14));
    const rows = as.map(a => xs.map(x => [x, yc + RF * Math.cos(a), RF * Math.sin(a)]));
    const g = rowsGeo(rows), ix = g.index.array, keep = [], nc = xs.length;
    for (let q = 0; q < ix.length; q += 3) {
      const c = [ix[q], ix[q + 1], ix[q + 2]].map(i => [xs[i % nc], as[Math.floor(i / nc)]]);
      const mx = (c[0][0] + c[1][0] + c[2][0]) / 3, ma = (c[0][1] + c[1][1] + c[2][1]) / 3;
      if (!(Math.abs(mx) < XS && ma > aB)) keep.push(ix[q], ix[q + 1], ix[q + 2]);
    }
    g.setIndex(keep);
    shell.add(g, { color: [1.0, 0.6, 0.7], aS: [0, 1, 0, 0], aQ: (x, y, z) => [0.4 + 0.1 * Math.max(0, Math.abs(x) - 0.9), 3, 0.45 * smooth((5 - Math.abs(x)) / 1.6) * smooth((3.2 * 0.87 - Math.abs(z)) / 0.8)] });
  }
  // the fibre's cut face under the membrane's profile: a translucent, lit section of muscle (its mesh is made below);
  // aQ.z is the membrane's height above each point, so the shader knows how deep under the membrane it is
  const cutB = Builder({ color: 3, aS: 4, aQ: 3 });
  {
    const top = memProf(ZC - 0.002), nc = top.length, rows = [top, top.map(p => [p[0], -1.18, p[2]])];
    cutB.add(rowsGeo(rows), { color: [0.58, 0.15, 0.23], aS: [0, 0, 0, 0], aQ: (x, y, z, i) => [0, 6, top[i % nc][1]] });
  }
  // cut edges, where the cut plane meets the bouton, the Schwann cell, the muscle membrane and the basement membrane
  const edge = (pts, closed, col, s, gain) => gAdd(tubeFn(ring(pts, closed), pts.length * 2, 4, 0.0045), col, s, [0, 0, gain]);
  const BCUT = [];
  for (let k = 0; k < 140; k++) {
    const a = k / 140 * TAU, dir = [Math.cos(a), Math.sin(a)];
    let lo = 0, hi = 1.2;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (bIn([dir[0] * m, BC[1] + dir[1] * m, ZC], 0, true)) lo = m; else hi = m; }
    BCUT.push([dir[0] * lo, BC[1] + dir[1] * lo, ZC]);
  }
  edge(BCUT, true, [0.6, 0.9, 1.0], [9, 4, 1, 0], 2.4);
  {   // the cap's edge: the bouton's cut, pushed out, where the cap covers it
    let run = [];
    const flush = () => { if (run.length > 3) edge(run, false, [1.0, 0.85, 0.65], [0, 5, 1, 0], 2.0); run = []; };
    for (const p of BCUT) {
      const q = v3.sub(p, BC), d = v3.norm(q), th = Math.acos(clamp(d[1], -1, 1)), ph = Math.atan2(d[2], d[0]);
      if (th < capMax(ph) - 0.03) { const l = Math.hypot(q[0], q[1]) || 1; run.push([p[0] + q[0] / l * 0.04, p[1] + q[1] / l * 0.04, ZC]); } else flush();
    }
    flush();
  }
  edge(memProf(ZC), false, [1.0, 0.68, 0.8], [9, 1, 0, 0], 2.2);
  edge(lamProf(ZC), false, [0.45, 0.9, 1.0], [2, 2, 0, 0], 1.6);

  // ------------------------------------------------------------------ solid parts (lit), one mesh
  const solid = Builder({ color: 3, aS: 4, aQ: 3, aCtr: 3 });
  const sAdd = (geo, col, s, ctr, m) => solid.add(geo, { color: col, aS: s, aQ: [0, 0, 1], aCtr: ctr }, m);
  const PTS = [];   // static points (rapsyn, chromatin, pores, ribosomes) and effects, filled below
  // pt(position, colour, size, alpha, kind (0 still, 1 receptor pore, 2 acetylcholine, 3 calcium), [slot, stage, moves], kind data, target)
  const pt = (p, col, size, a, k, sk, e, to) => PTS.push({ p, col, size, a, k, sk: sk || [0, 0, 0], e: e || [0, 0, 0], to: to || p });
  // a mitochondrion: outer membrane (glass), inner membrane (solid, seen from inside where it is cut) and lamellar
  // cristae from alternate walls, across its long axis
  const MITO = [];
  function mito(c, ax, r, h, site, stage, mv) {
    const a = v3.norm(ax), e1 = v3.norm(v3.cross(a, Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), e2 = v3.cross(a, e1);
    const at = (s, ph, k) => {
      const rho = r * k * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(s), 2.6))), b = 0.18 * r * (1 - s * s);
      return v3.add(v3.add(c, v3.mul(a, s * (h + r))), v3.add(v3.mul(e1, rho * Math.cos(ph) + b), v3.mul(e2, rho * Math.sin(ph))));
    };
    gAdd(surf(26, 22, (u, v) => at(2 * u - 1, v * TAU, 1)), [0.8, 0.62, 1.0], [site, stage, mv, 1], [0, 0, 1.3]);
    sAdd(surf(22, 20, (u, v) => at(2 * u - 1, v * TAU, 0.86)), [0.5, 0.36, 0.78], [site, stage, mv, 1], c);
    const nc = Math.round((h + r) / 0.028);
    for (let k = 0; k < nc; k++) {
      const s = lerp(-0.74, 0.74, (k + 0.5) / nc), side = k % 2 ? 1 : -1, rho = r * 0.86 * Math.sqrt(1 - Math.pow(Math.abs(s), 2.6));
      const cc = v3.add(at(s, 0, 0), v3.mul(e1, side * 0.4 * rho));
      const m = new THREE.Matrix4().makeBasis(V(e1), V(a), V(e2)).setPosition(...cc);
      sAdd(ellipsoid([0, 0, 0], [0.52 * rho, 0.0055, 0.74 * rho], 5, 12), [0.86, 0.62, 1.0], [site, stage, mv, 1], c, m);
    }
    MITO.push({ c, a, r, h, at });
  }
  mito([-0.3, 0.5, ZC - 0.01], [1, 0.15, -0.12], 0.07, 0.15, 1, 4, 1);
  mito([0.31, 0.55, ZC - 0.035], [1, -0.22, 0.18], 0.064, 0.13, 1, 4, 1);
  mito([0.05, 0.44, -0.22], [0.35, 0.12, 1], 0.06, 0.13, 1, 4, 1);
  mito([0.3, -0.63, 0.16], [1, -0.08, 0.22], 0.052, 0.13, 0, 0, 0);    // and three in the muscle fibre
  mito([-1.0, -0.6, 0.06], [0.25, 0.05, 1], 0.05, 0.12, 0, 0, 0);
  mito([0.98, -0.72, 0.18], [1, 0.12, -0.1], 0.048, 0.12, 0, 0, 0);
  // endosomes: larger, lumpy, darker vesicles in the nerve ending
  const ENDS = [[0.56, 0.34, 0.12, 0.058], [-0.55, 0.3, 0.06, 0.05], [0.2, 0.62, -0.26, 0.068]];
  for (const [x, y, z, r] of ENDS) {
    const k = R() * TAU;
    sAdd(ellipsoid([x, y, z], [r * 1.15, r * 0.85, r], 14, 18, (th, ph) => 0.16 * Math.sin(2 * th + k) * Math.sin(3 * ph + k) + 0.06 * Math.sin(5 * ph)), [0.4, 0.56, 0.47], [6, 4, 1, 1], [x, y, z]);
  }
  // active zones: dense bars on the nerve's membrane, over the mouths of the folds, with knobs (dense projections)
  const azF = AZ.map(i => u => { const z = lerp(-0.32, 0.3, u), x = fX(i, z); return [x, bBot(x, z) + 0.005, z]; });
  azF.forEach(f => sAdd(tubeFn(f, 40, 6, (u, a) => (0.011 + 0.0025 * Math.cos(2 * a)) * (1 + 0.3 * Math.max(0, Math.sin(u * 60))) * Math.min(1, Math.sin(PI * u) * 5)),
    [0.34, 0.38, 0.54], [7, 4, 1, 0], f(0.5)));
  // agrin: strands from the nerve's side through the cleft to the muscle's crests, beaded with its domains
  const AGR = [];
  for (let k = 0; k < 22; k++) {
    const i = Math.floor(R() * 5), x0 = lerp(FX[i], FX[i + 1], 0.22 + 0.56 * R()), z0 = lerp(-0.42, 0.28, R());
    const top = [x0 + gauss(R) * 0.02, bBot(x0, z0) - 0.002, z0], bot = [x0 + gauss(R) * 0.03, 0.008, z0 + gauss(R) * 0.03], ph = R() * TAU;
    const f = u => { const p = v3.lerp(top, bot, u), s = Math.sin(PI * u); return [p[0] + 0.012 * s * Math.sin(u * 9 + ph), p[1], p[2] + 0.012 * s * Math.cos(u * 7 + ph)]; };
    sAdd(tubeFn(f, 14, 4, 0.0015), [0.5, 0.95, 0.86], [2, 5, 0, 0], bot); AGR.push(f(0.42));
    for (const u of [0.18, 0.42, 0.66, 0.88]) sAdd(new THREE.IcosahedronGeometry(0.0042, 1).translate(...f(u)), [0.62, 1.0, 0.9], [2, 5, 0, 0], bot);
  }
  // the Schwann cell's nucleus, under its cap
  { const p = bPt(SND, 0.07); sAdd(ellipsoid(p, [0.15, 0.035, 0.1], 10, 20), [0.62, 0.5, 0.38], [0, 5, 1, 1], p); }
  // the junction's own nuclei: a double envelope (glass), the inside where nucleus A is cut, a nucleolus, chromatin
  for (const [c, r, cut] of [[NA, NAR, true], [NB, NBR, false]]) {
    gAdd(ellipsoid(c, r, 26, 40), [0.55, 0.6, 1.0], [10, 0, 0, 1], [0, 0, 1.0]);
    gAdd(ellipsoid(c, r.map(x => x - 0.011), 26, 40), [0.55, 0.6, 1.0], [10, 0, 0, 1], [0, 0, 0.6]);
    if (cut) sAdd(ellipsoid(c, r.map(x => x - 0.015), 22, 36), [0.22, 0.2, 0.42], [10, 0, 0, 1], c);
    const nu = [c[0] + 0.25 * r[0], c[1] - 0.15 * r[1], c[2] - 0.3 * r[2]];
    sAdd(ellipsoid(nu, [0.05, 0.042, 0.045].map(x => x * r[0] / 0.28), 10, 14, (th, ph) => 0.08 * Math.sin(3 * ph) * Math.sin(2 * th)), [0.5, 0.36, 0.72], [10, 0, 0, 1], c);
    for (let k = 0; k < (cut ? 520 : 300); k++) {   // chromatin, denser under the envelope; pores in the envelope
      const d = K.unit(R), q = k % 3 ? 0.8 + 0.16 * R() : Math.cbrt(R()) * 0.9, p = [c[0] + d[0] * r[0] * q, c[1] + d[1] * r[1] * q, c[2] + d[2] * r[2] * q];
      if (p[2] < ZC - 0.004) pt(p, [0.5, 0.45, 0.95], 0.011 + 0.008 * R(), 0.5, 0, [10, 0, 0]);
    }
    for (let k = 0; k < 80; k++) {
      const d = K.unit(R), p = [c[0] + d[0] * (r[0] - 0.005), c[1] + d[1] * (r[1] - 0.005), c[2] + d[2] * (r[2] - 0.005)];
      if (p[2] < ZC - 0.003) pt(p, [0.75, 0.85, 1.0], 0.009, 0.8, 0, [10, 0, 0]);
    }
  }
  {   // nucleus A's cut edge
    const s = Math.sqrt(1 - Math.pow((ZC - NA[2]) / NAR[2], 2)), e = [];
    for (let k = 0; k < 80; k++) { const a = k / 80 * TAU; e.push([NA[0] + NAR[0] * s * Math.cos(a), NA[1] + NAR[1] * s * Math.sin(a), ZC]); }
    edge(e, true, [0.6, 0.66, 1.0], [10, 0, 0, 0], 2.0);
  }
  // endoplasmic reticulum: three wavy sheets wrapped round nucleus A's left half, studded with ribosomes
  const ERP = [];
  for (let k = 0; k < 3; k++) {
    const off = 0.035 + 0.034 * k, rows = [];
    for (let i = 0; i <= 16; i++) {
      const th = lerp(0.3 * PI, 0.8 * PI, i / 16), row = [];
      for (let j = 0; j <= 26; j++) {
        const ph = lerp(0.56 * PI, 1.5 * PI, j / 26), w = off + 0.007 * Math.sin(th * 9 + k) * Math.sin(ph * 7 + 2 * k);
        const d = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
        const p = [NA[0] + (NAR[0] + w) * d[0], NA[1] + (NAR[1] + w * 0.8) * d[1], NA[2] + (NAR[2] + w) * d[2]];
        row.push(p);
        if (p[2] < ZC - 0.005 && R() < 0.5) { const q = v3.add(p, v3.mul(d, R() < 0.5 ? 0.006 : -0.006)); pt(q, [0.95, 0.6, 0.7], 0.008, 0.6, 0, [5, 0, 0]); if (k === 2) ERP.push(q); }
      }
      rows.push(row);
    }
    sAdd(rowsGeo(rows), [0.78, 0.45, 0.55], [5, 0, 0, 1], NA);
  }
  // the Golgi stack at nucleus A's right end: five curved cisternae, convex towards the nucleus, budding vesicles
  const GOR = [0.12, 0.13, 0.13, 0.12, 0.1];
  GOR.forEach((Rk, k) => {
    const x0 = GO[0] - 0.052 + 0.026 * k;
    sAdd(surf(8, 24, (u, v) => {
      const th = u * PI, ph = v * TAU, s = Math.sin(th), y = Rk * s * Math.cos(ph) * 0.75, z = Rk * s * Math.sin(ph);
      return [x0 + 0.0075 * Math.cos(th) + 1.4 * (y * y + z * z) + 0.006 * Math.sin(ph * 3 + k), GO[1] + y, GO[2] + z];
    }), [0.42, 0.74, 0.66], [3, 0, 0, 1], GO);
  });
  for (let k = 0; k < 16; k++) {
    const a = R() * TAU, rr = 0.125 + 0.025 * R(), y = rr * Math.cos(a) * 0.75, z = rr * Math.sin(a), x = GO[0] + lerp(-0.05, 0.08, R()) + 1.4 * (y * y + z * z);
    sAdd(new THREE.SphereGeometry(0.011, 8, 6).translate(x, GO[1] + y, GO[2] + z), [0.5, 0.82, 0.72], [3, 0, 0, 1], GO);
  }

  // ------------------------------------------------------------------ the myofibrils, desmin and plectin (they twitch)
  const myo = Builder({ color: 3, aS: 4, aQ: 3, aCtr: 3 });
  const ZX = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map(n => n * ZP);   // the Z-discs
  const CYLX = new THREE.CylinderGeometry(MYR, MYR, 2 * XS - 0.04, 24, 1, false).rotateZ(PI / 2);
  for (const [y, z] of MYO) myo.add(CYLX.clone().translate(0, y, z), { color: [0.46, 0.22, 0.28], aS: [8, 0, 0, 0], aQ: [0, 5, 1], aCtr: [0, y, z] });
  const STRUT = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true);
  const mAdd = (geo, col, ctr, m) => myo.add(geo, { color: col, aS: [8, 0, 0, 0], aQ: [0, 0, 1], aCtr: ctr }, m);
  const DES = [0.95, 0.8, 0.6], PLE = [1.0, 0.68, 0.36];
  for (const x of ZX) {
    for (const [y, z] of MYO) mAdd(new THREE.TorusGeometry(MYR + 0.005, 0.0038, 4, 26).rotateY(PI / 2).translate(x, y, z), DES, [x, y, z]);
    for (let i = 0; i < MYO.length; i++) for (let j = i + 1; j < MYO.length; j++) {   // links between neighbouring rings
      const [ya, za] = MYO[i], [yb, zb] = MYO[j], d = Math.hypot(yb - ya, zb - za);
      if (d > 0.2) continue;
      const u = [(yb - ya) / d, (zb - za) / d], a = [x, ya + u[0] * (MYR + 0.006), za + u[1] * (MYR + 0.006)], b = [x, yb - u[0] * (MYR + 0.006), zb - u[1] * (MYR + 0.006)];
      mAdd(STRUT, DES, a, strutM(a, b, 0.0032));
      if ((i + j + Math.round(x * 10)) % 3 === 0) mAdd(new THREE.IcosahedronGeometry(0.0075, 0).translate(...v3.lerp(a, b, 0.5)), PLE, a);
    }
  }
  // plectin: from the top row's desmin rings up to the nuclei, a mitochondrion and the bottoms of the folds
  const PLX = [];
  for (const [x0, z0, to] of [[ZX[1], 0.22, [NA[0] - 0.05, NA[1] - NAR[1], 0.2]], [ZX[2], 0.05, [NA[0] + 0.12, NA[1] - NAR[1] * 0.9, 0.12]], [ZX[3], 0.22, [0.3, -0.68, 0.16]],
    [ZX[4], -0.12, [NB[0], NB[1] - NBR[1], NB[2]]], [ZX[3], -0.29, [fX(3, -0.29), -fD(3, -0.29) - 0.01, -0.29]], [ZX[1], -0.12, [fX(1, -0.12), -fD(1, -0.12) - 0.01, -0.12]],
    [ZX[4], 0.05, [fX(4, 0.05), -fD(4, 0.05) - 0.01, 0.05]]]) {
    const yTop = MYO.find(m => m[1] === z0)[0] + MYR + 0.005, a = [x0, yTop, z0], ph = R() * TAU;
    const f = u => { const p = v3.lerp(a, to, u), s = Math.sin(PI * u); return [p[0] + 0.02 * s * Math.sin(u * 8 + ph), p[1], p[2] + 0.015 * s * Math.cos(u * 6 + ph)]; };
    mAdd(tubeFn(f, 20, 4, 0.0032), PLE, a);
    for (const u of [0.0, 0.5, 1.0]) mAdd(new THREE.IcosahedronGeometry(0.008, 0).translate(...f(u)), PLE, a);
    PLX.push(f(0.5));
  }

  // ------------------------------------------------------------------ instanced parts
  const IB = () => Builder({ color: 3, aS: 4, aQ: 3 });
  const iAdd = (B, geo, col, s, m) => B.add(geo, { color: col, aS: s, aQ: [0, 0, 1] }, m);
  // a tapered n-sided prism along y (a subunit), with a top cap
  function prism(n, r0, r1, y0, y1) {
    const P = [], idx = [];
    for (const [r, y] of [[r0, y0], [r1, y1]]) for (let k = 0; k < n; k++) { const a = k / n * TAU; P.push(r * Math.cos(a), y, r * Math.sin(a)); }
    for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; idx.push(k, n + k, k1, k1, n + k, n + k1); }
    for (let k = 1; k < n - 1; k++) idx.push(n, n + k + 1, n + k);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function inst(geo, mat, mats, order) {
    const m = new THREE.InstancedMesh(geo, mat, mats.length);
    mats.forEach((M, i) => m.setMatrixAt(i, M));
    m.frustumCulled = false; m.renderOrder = order || 1; set.group.add(m);
    return m;
  }
  const grow = 'transformed *= vK;';

  // synaptic vesicles: four clusters over the active zones, four docked at each (the release sites)
  const DOCK = [];
  AZ.forEach(i => [-0.14, -0.02, 0.1, 0.22].forEach((z, k) => { const x = fX(i, z) + (k % 2 ? 0.032 : -0.032); DOCK.push([x, bBot(x, z) + 0.022, z]); }));
  const VES = DOCK.map(p => p.slice());
  for (let n = 0; VES.length < 166 && n < 30000; n++) {
    const pool = R() < 0.25, j = Math.floor(R() * 4);
    const p = [fX(AZ[j], 0) + gauss(R) * (pool ? 0.22 : 0.09), YP + 0.048 + Math.abs(gauss(R)) * (pool ? 0.25 : 0.11), lerp(-0.55, ZC - 0.024, Math.sqrt(R()))];
    if (!bIn(p, 0.035) || VES.some(q => v3.dist(p, q) < 0.045)) continue;
    VES.push(p);
  }
  const vb = IB(); iAdd(vb, new THREE.IcosahedronGeometry(0.021, 1), [0.42, 0.6, 0.92], [7, 4, 0, 0]);
  const vesMat = lit('ves', { self: 0.12, rimK: 0.4, rimC: [0.55, 0.85, 1.0], rough: 0.35, vb: grow });
  const vesMesh = inst(vb.geo(), vesMat, VES.map(p => new THREE.Matrix4().makeTranslation(...p)), 2);
  VES.forEach((p, i) => vesMesh.setColorAt(i, new THREE.Color().setScalar(0.88 + 0.16 * R())));
  const VPH = VES.map(() => R() * TAU);

  // acetylcholine receptors: five subunits round a pore (alpha, epsilon, alpha, delta, beta, faintly coloured),
  // packed on the crests and down the folds' upper walls; rapsyn under each; a few MuSK/LRP4 pairs among them
  const SUB = [[1.0, 0.45, 0.5], [0.5, 0.6, 1.0], [1.0, 0.45, 0.5], [0.45, 0.95, 0.6], [1.0, 0.9, 0.4]].map(c => v3.mul(v3.lerp([0.95, 0.72, 0.5], c, 0.3), 0.72));
  const rb = IB();
  SUB.forEach((c, k) => { const a = k / 5 * TAU; iAdd(rb, prism(5, 0.0048, 0.0036, -0.005, 0.0135).translate(0.0063 * Math.cos(a), 0, 0.0063 * Math.sin(a)), c, [4, 3, 0, 0]); });
  iAdd(rb, new THREE.OctahedronGeometry(0.0045, 0).scale(1.3, 0.7, 1.3).translate(0, -0.011, 0), [0.7, 0.55, 0.95], [9, 3, 0, 0]);   // rapsyn, under it
  const REC = [], MUSK = [];
  for (let z = ZB + 0.06, row = 0; z < ZC - 0.012; z += 0.032, row++) {
    for (const s of along(memProf(z), 0.032, (row % 2) * 0.016 + 0.004)) {
      const [x, y] = s.p;
      if (Math.abs(x) > 0.79 || y < -0.065) continue;
      const p = [x + gauss(R) * 0.0025, y, z + gauss(R) * 0.004];
      (y > -0.004 && R() < 0.03 ? MUSK : REC).push({ p, n: s.n });
    }
  }
  const nearDock = p => { let b = 0, bd = 9; DOCK.forEach((q, s) => { const d = (p[0] - q[0]) ** 2 + p[1] ** 2 + (p[2] - q[2]) ** 2; if (d < bd) { bd = d; b = s; } }); return [b, bd]; };
  const aR = new Float32Array(REC.length * 3), aOff = new Float32Array(REC.length * 3);
  REC.forEach((r, i) => {
    const [s, d] = nearDock(r.p), rnd = R();
    aR.set([s, d, rnd], i * 3); aOff.set([gauss(R) * 0.22, 0, gauss(R) * 0.22], i * 3);
    pt(v3.add(r.p, v3.mul(r.n, 0.017)), [1.0, 0.92, 0.65], 0.017, 1, 1, [4, 3, 0], [s, d, rnd]);         // the pore, lit when open
  });
  const rg = rb.geo();
  rg.setAttribute('aR', new THREE.InstancedBufferAttribute(aR, 3)); rg.setAttribute('aOff', new THREE.InstancedBufferAttribute(aOff, 3));
  const recMat = lit('rec', { self: 0.12, rimK: 0.2, rimC: [1.0, 0.85, 0.6], vh: 'attribute vec3 aR, aOff;' + OPEN,
    // they gather from all over the membrane as the junction builds (each a little later than the last), and light up when open
    vb: `{ float k = clamp(vK * 1.6 - aR.z * 0.6, 0.0, 1.0); transformed = transformed * smoothstep(0.0, 0.25, k) + aOff * (1.0 - smoothstep(0.0, 1.0, k));
  vGC += vec3(1.0, 0.88, 0.55) * openR(aR) * 0.85; }` });
  const recMesh = inst(rg, recMat, REC.map(r => orient(r.p, r.n, R() * TAU, 1)), 1);
  // MuSK/LRP4: LRP4 (agrin's receptor) a tall stalk ending in beta-propellers, MuSK a shorter one with Ig domains and
  // its kinase inside, DOK7 under it
  const mb = IB(), LR = [0.72, 1.0, 0.6], MK = [0.55, 0.95, 0.85];
  const lrF = u => [0.006 + 0.004 * Math.sin(u * 3), -0.004 + 0.036 * u, 0.002 * Math.sin(u * 5)], mkF = u => [-0.006, -0.004 + 0.024 * u, 0.001];
  iAdd(mb, tubeFn(lrF, 8, 4, 0.0016), LR, [9, 3, 0, 0]);
  for (const u of [0.38, 0.62, 0.84, 1.0]) iAdd(mb, new THREE.IcosahedronGeometry(0.0052, 0).translate(...lrF(u)), LR, [9, 3, 0, 0]);
  iAdd(mb, tubeFn(mkF, 6, 4, 0.0014), MK, [9, 3, 0, 0]);
  for (const u of [0.45, 0.75, 1.0]) iAdd(mb, new THREE.IcosahedronGeometry(0.0038, 0).translate(...mkF(u)), MK, [9, 3, 0, 0]);
  iAdd(mb, new THREE.IcosahedronGeometry(0.0068, 0).translate(-0.006, -0.014, 0), [0.95, 0.9, 0.55], [9, 3, 0, 0]);
  iAdd(mb, new THREE.IcosahedronGeometry(0.005, 0).translate(-0.003, -0.025, 0.004), [1.0, 0.72, 0.5], [9, 3, 0, 0]);
  const muskMesh = inst(mb.geo(), lit('musk', { self: 0.25, rimK: 0.5, vb: grow }), MUSK.map(r => orient(r.p, r.n, R() * TAU, 1)), 1);

  // sodium channels (Nav1.4) in the troughs: four domains round a pore; they light as the wave passes
  const NAV = [];
  for (let z = ZB + 0.05, row = 0; z < ZC - 0.012; z += 0.05, row++) {
    for (const s of along(memProf(z), 0.05, (row % 2) * 0.025)) {
      const [x, y] = s.p, i = nearFold(x);
      if (Math.abs(x - fX(i, z)) > 0.06 || y > -0.45 * fD(i, z)) continue;
      NAV.push({ p: [x, y + gauss(R) * 0.01 * Math.abs(s.n[0]), z + gauss(R) * 0.012], n: s.n, w: waveT(x, y) });
    }
  }
  const nb = IB();
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; iAdd(nb, prism(5, 0.0044, 0.0036, -0.01, 0.01).translate(0.006 * Math.cos(a), 0, 0.006 * Math.sin(a)), [0.72, 0.66, 0.88], [4, 3, 0, 0]); }
  const ng = nb.geo(); ng.setAttribute('aW', new THREE.InstancedBufferAttribute(new Float32Array(NAV.map(c => c.w)), 1));
  const navMesh = inst(ng, lit('nav', { self: 0.25, rimK: 0.5, rimC: [1.0, 0.85, 0.6], vh: 'attribute float aW;',
    vb: grow + ' { float d = uPh - aW; vGC += vec3(1.0, 0.75, 0.35) * uWave * 3.2 * exp(-d * d / 0.0025); }' }), NAV.map(c => orient(c.p, c.n, R() * TAU, 1)), 1);

  // the basement membrane's laminin: crosses (one long arm ending in a globular head, three short arms) lying in it
  const lb = IB(), LC = [0.18, 0.55, 0.8], LE = [0.35, 0.78, 1.0], ST3 = new THREE.CylinderGeometry(1, 1, 1, 3, 1, true);
  for (const [e, r, cr] of [[[0.046, 0, 0.004], 0.0011, 0.0052], [[-0.022, 0, 0.003], 0.0009, 0.0032], [[0.002, 0, 0.022], 0.0009, 0.0032], [[0.001, 0, -0.022], 0.0009, 0.0032]]) {
    iAdd(lb, ST3, LC, [2, 2, 0, 0], strutM([0, 0, 0], e, r));
    iAdd(lb, new THREE.TetrahedronGeometry(cr, 0).translate(...e), LE, [2, 2, 0, 0]);
  }
  const LAMI = [];
  for (let z = ZB + 0.04; z < ZC - 0.01; z += 0.095) {
    for (const s of along(lamProf(z), 0.085, R() * 0.085)) {
      if (Math.abs(s.p[0]) > XS - 0.05) continue;
      const p = v3.add(s.p, v3.mul(s.n, gauss(R) * 0.006)); p[2] = Math.min(ZC - 0.012, p[2] + (R() - 0.5) * 0.07);
      LAMI.push(orient(p, v3.norm(v3.add(s.n, [gauss(R) * 0.15, 0, gauss(R) * 0.15])), R() * TAU, 0.85 + 0.3 * R()));
    }
  }
  const lamMesh = inst(lb.geo(), lit('lam', { self: 0.3, rimK: 0.25, rimC: [0.4, 0.85, 1.0], vb: grow }), LAMI, 1);

  // acetylcholinesterase: three globular enzymes on the triple-helix tail of collagen Q, anchored in the basement membrane
  const ab = IB();
  for (let s = 0; s < 3; s++) iAdd(ab, tubeFn(u => { const a = u * 9 + s * TAU / 3; return [0.0022 * Math.cos(a), u * 0.05, 0.0022 * Math.sin(a)]; }, 18, 3, 0.0011), [0.6, 0.9, 1.0], [2, 5, 0, 0]);
  for (let s = 0; s < 3; s++) { const a = s * TAU / 3; iAdd(ab, new THREE.IcosahedronGeometry(0.0062, 1).translate(0.0085 * Math.cos(a), 0.056 + 0.003 * s, 0.0085 * Math.sin(a)), [0.74, 1.0, 0.7], [2, 5, 0, 0]); }
  const ACHE = [];
  for (let n = 0; ACHE.length < 34 && n < 500; n++) {
    const x = lerp(-0.76, 0.76, R()), z = lerp(ZB + 0.08, ZC - 0.03, R());
    if (FX.some((f, i) => Math.abs(x - fX(i, z)) < 0.045)) continue;
    const up = R() < 0.6, n3 = v3.norm([gauss(R) * 0.35, up ? 1 : -1, gauss(R) * 0.35]);
    ACHE.push({ p: [x, YL + lip(x) + (up ? 0.004 : -0.004), z], n: n3 });
  }
  const acheMesh = inst(ab.geo(), lit('ache', { self: 0.3, rimK: 0.5, vb: grow }), ACHE.map(a => orient(a.p, a.n, R() * TAU, 1)), 1);

  // ------------------------------------------------------------------ lines: collagen IV and XIII, actin, microtubules
  const LS = [];
  const seg = (a, b, col, al, s) => LS.push([a, b, col, al, s]);
  {   // collagen IV: a chicken-wire net in the basement membrane
    let prev = null;
    for (let z = ZB + 0.03, j = 0; z < ZC - 0.005; z += 0.045, j++) {
      const row = along(lamProf(z), 0.05, (j % 2) * 0.025).map(s => v3.add(s.p, [gauss(R) * 0.004, gauss(R) * 0.004, gauss(R) * 0.008]));
      for (let i = 1; i < row.length; i++) if (Math.abs(row[i][0]) < XS - 0.04) seg(row[i - 1], row[i], [0.4, 0.82, 1.0], 0.07, [2, 2, 0]);
      if (prev) for (let i = 0; i < row.length; i++) { const q = prev[Math.min(prev.length - 1, Math.round(i * prev.length / row.length))]; if (v3.dist(q, row[i]) < 0.09 && Math.abs(q[0]) < XS - 0.04) seg(q, row[i], [0.4, 0.82, 1.0], 0.05, [2, 2, 0]); }
      prev = row;
    }
  }
  for (let k = 0; k < 60; k++) {   // collagen XIII: rods from the muscle's surface into the cleft
    const x = (R() < 0.5 ? -1 : 1) * lerp(0.1, 0.95, R()), z = lerp(ZB + 0.05, ZC - 0.02, R());
    if (FX.some((f, i) => Math.abs(x - fX(i, z)) < 0.04)) continue;
    const a = [x, lip(x) + 0.004, z], n = v3.norm([gauss(R) * 0.4 - Math.sign(x) * lip(x) * 2, 1, gauss(R) * 0.4]);
    seg(a, v3.add(a, v3.mul(n, 0.035 + 0.02 * R())), [0.6, 1.0, 0.86], 0.55, [2, 2, 0]);
  }
  for (let k = 0, n = 0; k < 460 && n < 5000; n++) {   // actin in the nerve ending, densest under its membrane
    const d = K.unit(R), cortex = R() < 0.6, q = cortex ? 0.8 + 0.16 * R() : Math.cbrt(R()) * 0.9, p = v3.add(BC, v3.mul(d, bR(d) * q));
    const e = v3.add(p, v3.mul(K.unit(R), 0.05 + 0.06 * R()));
    if (p[2] > ZC - 0.01 || e[2] > ZC - 0.01 || !bIn(p, 0.012) || !bIn(e, 0.012)) continue;
    seg(p, e, [0.72, 0.74, 1.0], 0.12, [0, 4, 1]); k++;
  }
  for (let k = 0; k < 6; k++) {   // microtubules along the axon
    const o = [0, 0.04 * Math.cos(k * 1.05), 0.04 * Math.sin(k * 1.05)];
    for (let i = 0; i < 44; i++) seg(v3.add(axAt(i / 50), o), v3.add(axAt((i + 1) / 50), o), [0.6, 0.86, 1.0], 0.3, [0, 4, 1]);
  }
  const lg = K.linesGeo(LS.length), lK = new Float32Array(LS.length * 8);
  LS.forEach(([a, b, c, al, s], i) => {
    lg.attributes.position.array.set(a, i * 6); lg.attributes.position.array.set(b, i * 6 + 3);
    lg.attributes.aCol.array.set(c, i * 6); lg.attributes.aCol.array.set(c, i * 6 + 3);
    lg.attributes.aA.array[i * 2] = lg.attributes.aA.array[i * 2 + 1] = al;
    lK.set([...s, 0, ...s, 0], i * 8);
  });
  lg.setAttribute('aK', new THREE.BufferAttribute(lK, 4));
  const PU = { uG: SU.uG, uD: SU.uD, uSC: SU.uSC, uStage: SU.uStage, uNerveY: SU.uNerveY, uPh: SU.uPh, uFire: SU.uFire, uFuse: SU.uFuse };
  const lnMat = K.lines(set, { uniforms: PU,
    head: 'attribute vec4 aK; uniform float uG[12], uD[12], uStage[6], uNerveY; uniform vec3 uSC[12];',
    vertex: `{ int si = int(aK.x + 0.5); int st = int(aK.y + 0.5); pos.y += aK.z * uNerveY;
  vA *= uStage[st] * (0.3 + 0.7 * uD[si]); vC = vC * (0.4 + 0.6 * uD[si]) + uSC[si] * uG[si] * 1.2;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0); }` });
  const lnObj = new THREE.LineSegments(lg, lnMat); lnObj.frustumCulled = false; lnObj.renderOrder = 6; set.group.add(lnObj);

  // ------------------------------------------------------------------ points: still ones and the firing's effects
  DOCK.forEach((q, s) => {
    for (let k = 0; k < 18; k++) {   // acetylcholine: a puff from each release site across the cleft onto the crests and into the folds
      const x = q[0] + gauss(R) * 0.045, z = clamp(q[2] + gauss(R) * 0.045, ZB, ZC - 0.01), i = nearFold(x), inFold = Math.abs(x - fX(i, z)) < FW * 0.8;
      pt([q[0] + gauss(R) * 0.006, q[1] - 0.02, q[2] + gauss(R) * 0.006], [1.0, 0.95, 0.72], 0.016, 1, 2, [9, 4, 0], [s, R(), 0], [x, inFold ? -R() * 0.07 : 0.022 + R() * 0.012, z]);
    }
    pt([q[0] + (s % 2 ? 0.012 : -0.012), YP + 0.004, q[2]], [0.6, 1.0, 0.75], 0.065, 1, 3, [7, 4, 1]);   // calcium rushing in beside it
  });
  const pg = K.pointsGeo(PTS.length), pK = new Float32Array(PTS.length * 4), pE = new Float32Array(PTS.length * 3), pTo = new Float32Array(PTS.length * 3);
  PTS.forEach((q, i) => {
    pg.attributes.position.array.set(q.p, i * 3); pg.attributes.aCol.array.set(q.col, i * 3);
    pg.attributes.aSize.array[i] = q.size; pg.attributes.aA.array[i] = q.a;
    pK.set([q.k, ...q.sk], i * 4); pE.set(q.e, i * 3); pTo.set(q.to, i * 3);
  });
  pg.setAttribute('aK', new THREE.BufferAttribute(pK, 4)); pg.setAttribute('aE', new THREE.BufferAttribute(pE, 3)); pg.setAttribute('aTo', new THREE.BufferAttribute(pTo, 3));
  const ptMat = K.points(set, { uniforms: PU,
    head: 'attribute vec4 aK; attribute vec3 aE, aTo; uniform float uG[12], uD[12], uStage[6], uNerveY, uPh, uFire; uniform vec3 uSC[12];' + OPEN,
    vertex: `{ int si = int(aK.y + 0.5); int st = int(aK.z + 0.5); float g = 1.0; vec3 p = position; p.y += aK.w * uNerveY;
  if (aK.x > 0.5 && aK.x < 1.5) g = 1.3 * openR(aE);
  else if (aK.x > 1.5 && aK.x < 2.5) {
    float tt = clamp((uPh - 0.27) / 0.2, 0.0, 1.0), e = 1.0 - (1.0 - tt) * (1.0 - tt);
    p = mix(position, aTo, e) + 0.005 * tt * vec3(sin(uTime * 23.0 + aE.y * 40.0), sin(uTime * 19.0 + aE.y * 17.0), cos(uTime * 21.0 + aE.y * 29.0));
    g = 1.6 * uFuse[int(aE.x + 0.5)] * smoothstep(0.26, 0.29, uPh) * (1.0 - smoothstep(0.47, 0.64, uPh));
  } else if (aK.x > 2.5) { float d = uPh - 0.235; g = 2.0 * uFire * exp(-d * d / 0.0011); }
  vC = vC * (0.35 + 0.65 * uD[si]) + uSC[si] * uG[si] * 0.9;
  vA *= g * uStage[st] * (0.3 + 0.7 * uD[si]);
  mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = pointPx(aSize, mv);
  if (aK.x > 0.5 && aK.x < 2.5) gl_PointSize = min(gl_PointSize, 10.0); }` });   // tiny molecules stay tiny up close
  const ptObj = new THREE.Points(pg, ptMat); ptObj.frustumCulled = false; ptObj.renderOrder = 7; set.group.add(ptObj);

  // ------------------------------------------------------------------ the 35 seed genes where they act
  const front = a => a.reduce((b, x) => (x[2] > b[2] ? x : b));
  const vesNear = x0 => front(VES.slice(16).filter(p => Math.abs(p[0] - x0) < 0.08 && p[2] < ZC - 0.03));
  const mu = MUSK.reduce((b, m) => (m.p[2] > b.p[2] ? m : b)), ac = ACHE.reduce((b, m) => (m.p[2] > b.p[2] ? m : b));
  const na = NAV.filter(c => Math.abs(c.p[0] - FX[3]) < 0.07).reduce((b, m) => (m.p[2] > b.p[2] ? m : b));
  const erF = ERP.filter(p => p[2] > 0.2).sort((a, b) => a[1] - b[1]);
  const pent = (k, r) => { const a = k / 5 * TAU + 0.3; return [0.005 + r * Math.cos(a), 0.03, 0.27 + r * Math.sin(a) * 0.8]; };
  const ncut = a => [NA[0] + NAR[0] * 0.714 * Math.cos(a), NA[1] + NAR[1] * 0.714 * Math.sin(a), ZC - 0.006];
  const GG = [   // [label bold, rest, [symbol, position] ...]
    ['CHAT · SLC5A7 · SLC18A3', 'making and recycling acetylcholine', ['CHAT', [0.02, 0.66, 0.24]], ['SLC5A7', [-0.25, bBot(-0.25, 0.3) + 0.004, 0.3]], ['SLC18A3', v3.add(vesNear(0.13), [0, 0.022, 0.006])]],
    ['SYT2 · VAMP1 · SNAP25 · UNC13A · RPH3A', 'release', ['SYT2', v3.add(DOCK[15], [0.012, 0.012, 0.016])], ['VAMP1', v3.add(DOCK[7], [-0.016, -0.004, 0.016])],
      ['SNAP25', [fX(AZ[2], 0.29) + 0.03, bBot(fX(AZ[2], 0.29) + 0.03, 0.29) + 0.004, 0.29]], ['UNC13A', azF[0](0.97)], ['RPH3A', v3.add(vesNear(-0.37), [0, 0.022, 0.006])]],
    ['SLC25A1', 'mitochondrion', ['SLC25A1', MITO[0].at(0.25, -PI / 2, 0.9)]],
    ['PREPL · MYO9A', 'nerve ending', ['PREPL', [0.45, 0.38, 0.27]], ['MYO9A', bPt(v3.norm([-0.6, 0.7, 0.45]), -0.05)]],
    ['COLQ · AGRN · LAMB2 · LAMA5 · COL13A1', 'basement membrane', ['COLQ', v3.add(ac.p, v3.mul(ac.n, 0.03))], ['AGRN', front(AGR)],
      ['LAMB2', [0.25, YL + 0.004, 0.29]], ['LAMA5', [fX(4, 0.27) - 0.008, -0.2, 0.27]], ['COL13A1', [0.7, 0.025, 0.28]]],
    ['CHRNA1 · B1 · D · E · G', 'receptor', ['CHRNA1', pent(0, 0.036)], ['CHRNE', pent(1, 0.036)], ['CHRNG', pent(1, 0.07)], ['CHRND', pent(3, 0.036)], ['CHRNB1', pent(4, 0.036)]],
    ['RAPSN · MUSK · LRP4 · DOK7', 'clustering', ['RAPSN', [-0.25, -0.014, 0.29]], ['MUSK', v3.add(mu.p, v3.add(v3.mul(mu.n, 0.022), [-0.006, 0, 0]))],
      ['LRP4', v3.add(mu.p, v3.add(v3.mul(mu.n, 0.04), [0.008, 0, 0]))], ['DOK7', v3.add(mu.p, v3.mul(mu.n, -0.03))]],
    ['SCN4A', 'sodium channel', ['SCN4A', v3.add(na.p, v3.mul(na.n, 0.012))]],
    ['DPAGT1 · ALG2 · ALG14 · GFPT1 · GMPPB', 'sugar chains', ['DPAGT1', erF[0]], ['ALG2', erF[Math.floor(erF.length / 2)]], ['ALG14', erF[erF.length - 1]],
      ['GFPT1', [-0.9, -0.72, 0.28]], ['GMPPB', [-0.86, -0.48, 0.3]]],
    ['PLEC · DES', 'scaffold', ['PLEC', PLX[2]], ['DES', [ZX[3], MYO[0][0], 0.22 + MYR + 0.008]]],
    ['TOR1AIP1 · CHD8', 'nucleus', ['TOR1AIP1', ncut(2.2)], ['CHD8', [NA[0] + 0.06, NA[1] - 0.01, ZC - 0.05]]],
  ];
  const GPOS = {}, GLAB = [], GENES = [];
  let genePts, endoPts;
  GG.forEach(([b, r, ...gs], g) => {
    const c = [0, 0, 0];
    for (const [sym, p] of gs) { GPOS[sym] = p; GENES.push([sym, p, g]); for (let k = 0; k < 3; k++) c[k] += p[k] / gs.length; }
    GLAB.push({ b, r, at: c, g, syms: gs.map(x => x[0]) });
  });
  const EU = { uGenes: { value: 0 }, uEndo: { value: 0 }, uEW: { value: new Array(12).fill(1) } };
  const geneStart = g => 0.04 + 0.07 * g;   // the groups light up one after another: nerve, cleft, membrane, inside
  {
    const gg = K.pointsGeo(GENES.length * 2), aG = new Float32Array(GENES.length * 6);
    GENES.forEach(([sym, p, g], i) => {
      const e = GENDO[sym] === undefined ? 0 : GENDO[sym], c = ECOL[e];
      for (const [h, size, a, col] of [[0, 0.1, 0.5, c], [1, 0.036, 1, v3.lerp(c, [1, 1, 1], 0.3)]]) {
        const j = i * 2 + h;
        gg.attributes.position.array.set(p, j * 3); gg.attributes.aCol.array.set(col, j * 3);
        gg.attributes.aSize.array[j] = size; gg.attributes.aA.array[j] = a; aG.set([g, e, i * 0.7], j * 3);
      }
    });
    gg.setAttribute('aG', new THREE.BufferAttribute(aG, 3));
    const gm = K.points(set, { uniforms: EU, head: 'attribute vec3 aG; uniform float uGenes, uEW[12];',
      vertex: `{ float s = 0.04 + 0.07 * aG.x, k = smoothstep(s, s + 0.12, uGenes);
  vA *= k * uEW[int(aG.y + 0.5)] * (0.82 + 0.18 * sin(uTime * 3.0 + aG.z)); gl_PointSize *= 0.5 + 0.5 * k; }` });
    const o = new THREE.Points(gg, gm); o.frustumCulled = false; o.renderOrder = 9; set.group.add(o); genePts = o;
  }

  // ------------------------------------------------------------------ the endotypes arrive
  // each a cloud of its genes (as many as it has, up to 40) in its colour, from a ring above the scene (the tree's
  // view of the endotypes); those with a place settle round it, those without one (0, 4, 7) hover loose above
  const PLC = { mito: [], lamina: [], golgi: [], channels: [], er: [], endosome: [], vesicles: [], scaffold: [], junction: [] };
  MITO.slice(0, 3).forEach(m => { for (let k = 0; k < 30; k++) { const p = m.at(lerp(-0.8, 0.8, R()), R() * TAU, 1.3); if (p[2] < ZC + 0.03) PLC.mito.push(p); } });
  for (let z = -0.1; z < ZC - 0.01; z += 0.05) along(lamProf(z), 0.03, R() * 0.03).forEach(s => { if (Math.abs(s.p[0]) < 1.0) PLC.lamina.push(s.p); });
  for (let k = 0; k < 40; k++) { const d = K.unit(R); PLC.golgi.push([GO[0] + 0.02 + d[0] * 0.09, GO[1] + d[1] * 0.13, GO[2] + d[2] * 0.16]); }
  REC.forEach(r => { if (r.p[2] > -0.1 && R() < 0.15) PLC.channels.push(v3.add(r.p, v3.mul(r.n, 0.028))); });
  NAV.forEach(c => { if (c.p[2] > -0.1) PLC.channels.push(v3.add(c.p, v3.mul(c.n, 0.014))); });
  ERP.forEach(p => { if (p[2] > -0.05) PLC.er.push(p); });
  ENDS.forEach(([x, y, z, r]) => { for (let k = 0; k < 20; k++) PLC.endosome.push(v3.add([x, y, z], v3.mul(K.unit(R), r * 1.45))); });
  VES.forEach(p => { if (p[2] > -0.15) PLC.vesicles.push(v3.add(p, v3.mul(K.unit(R), 0.026))); });
  MYO.slice(0, 5).forEach(([y, z]) => { for (let k = 0; k < 16; k++) { const a = lerp(-1.3, 1.3, R()); PLC.scaffold.push([lerp(-1.0, 1.0, R()), y + (MYR + 0.022) * Math.cos(a), z + (MYR + 0.022) * Math.sin(a)]); } });
  for (let k = 0; k < 90; k++) { const x = lerp(-0.95, 0.95, R()), z = lerp(-0.2, 0.3, R()); PLC.junction.push(k % 2 ? [x * 0.72, bBot(x * 0.72, z) + 0.02, z] : [x, lip(x) + 0.035, z]); }
  const HOV = { 0: [0.62, 1.14, 0.08], 4: [0.98, 0.98, -0.1], 7: [0.32, 1.3, -0.18] };
  const ECEN = [];
  {
    const ECL = [];
    EN.forEach(e => {
      const n = Math.min(40, e.n), th = PI / 2 + (11 - e.id) * TAU / 12, from = [0.85 * Math.cos(th), 1.95 + 0.55 * Math.sin(th), 0];
      const L = PLC[e.place], hov = HOV[e.id] || [0.6 + 0.1 * e.id % 3, 1.1, 0], rr = 0.045 + 0.011 * Math.sqrt(n), cen = [0, 0, 0];
      for (let k = 0; k < n; k++) {
        const to = L ? v3.add(L[Math.floor(R() * L.length)], v3.mul(K.unit(R), 0.012)) : v3.add(hov, v3.mul(K.unit(R), 0.08 * Math.cbrt(R())));
        ECL.push({ to, from: v3.add(from, v3.mul(K.unit(R), rr * Math.cbrt(R()))), e: [e.id, R(), L ? 0 : 1] });
        for (let c = 0; c < 3; c++) cen[c] += to[c] / n;
      }
      ECEN.push(cen);
    });
    const eg = K.pointsGeo(ECL.length), aF = new Float32Array(ECL.length * 3), aE = new Float32Array(ECL.length * 3);
    ECL.forEach((q, i) => {
      eg.attributes.position.array.set(q.to, i * 3); eg.attributes.aCol.array.set(v3.lerp(ECOL[q.e[0]], [1, 1, 1], 0.15), i * 3);
      eg.attributes.aSize.array[i] = 0.024; aF.set(q.from, i * 3); aE.set(q.e, i * 3);
    });
    eg.setAttribute('aFrom', new THREE.BufferAttribute(aF, 3)); eg.setAttribute('aE', new THREE.BufferAttribute(aE, 3));
    const em = K.points(set, { uniforms: EU, head: 'attribute vec3 aFrom, aE; uniform float uEndo, uEW[12];',
      vertex: `{ float k = smoothstep(0.0, 1.0, clamp((uEndo - aE.x * 0.04) / 0.5, 0.0, 1.0)), ph = aE.y * 6.2832, arc = sin(k * 3.1416);
  vec3 a = aFrom + 0.025 * vec3(sin(uTime * 0.8 + ph), cos(uTime * 0.7 + ph * 1.3), sin(uTime * 0.6 + ph * 0.7));
  vec3 b = pos + (0.008 + 0.03 * aE.z) * vec3(sin(uTime * 1.1 + ph * 2.0), sin(uTime * 0.9 + ph * 1.7), cos(uTime * 1.2 + ph));
  vec3 p = mix(a, b, k) + arc * 0.12 * vec3(sin(ph), 0.3, cos(ph));   // the cloud loosens on the way and gathers again
  vA *= smoothstep(0.0, 0.06, uEndo) * uEW[int(aE.x + 0.5)];
  mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = pointPx(aSize * (1.0 + 0.5 * arc), mv); }` });
    const o = new THREE.Points(eg, em); o.frustumCulled = false; o.renderOrder = 10; set.group.add(o); endoPts = o;
  }

  // ------------------------------------------------------------------ the meshes
  const mk = (B, mat, order, parent) => { const m = new THREE.Mesh(B.geo(), mat); m.frustumCulled = false; m.renderOrder = order; (parent || set.group).add(m); return m; };
  const fromCtr = 'transformed = aCtr + (transformed - aCtr) * vK;';   // a part grows from its middle as it builds
  mk(solid, lit('solid', { side: THREE.DoubleSide, vh: 'attribute vec3 aCtr;', vb: fromCtr }), 1);
  const myoG = new THREE.Group(); set.group.add(myoG);
  // myofibrils striated in the shader (I-band light, A-band dark, H-zone, M-line, Z-line; fading where it would alias)
  mk(myo, lit('myo', { side: THREE.DoubleSide, self: 0.06, rimK: 0.22, rimC: [1.0, 0.7, 0.75], vh: 'attribute vec3 aCtr;', vb: fromCtr, fh: 'uniform float uTw;',
    fcol: `if (vKind > 4.5) {
  float x = vL.x / ${f4(ZP)}, q = fract(x - 0.5), w = fwidth(x) * 1.5, m = abs(q - 0.5), fa = clamp(1.0 - w * 4.0, 0.0, 1.0);
  float A = smoothstep(0.3 + w, 0.3 - w, m), H = smoothstep(0.08 + w, 0.08 - w, m), M = smoothstep(0.012 + w, 0.012 - w, m), Z = smoothstep(0.02 + w, 0.02 - w, 0.5 - m);
  diffuseColor.rgb *= mix(1.0, 1.15 - 0.5 * A + 0.22 * H - 0.25 * M, fa);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.45, 0.9), Z * 0.85 * fa);
}`, fe: '\ntotalEmissiveRadiance += diffuseColor.rgb * uTw * 0.7;' }), 1, myoG);
  mk(glass, glassMat, 5);
  const shellMesh = mk(shell, glassMat, 5);
  {   // the muscle membrane's skin: semi-opaque, so the receptors sit on a surface and the crests hide what is under them
    const sk = Builder({ color: 3, aS: 4, aQ: 3, aCtr: 3 });
    sk.add(rowsGeo(memRows.map(r => r.map(p => [p[0], p[1] - 0.004, p[2]]))), { color: [0.48, 0.26, 0.33], aS: [9, 1, 0, 0], aQ: (x, y) => [waveT(x, y), 2, 1], aCtr: [0, 0, 0] });
    const m = lit('skin', { side: THREE.DoubleSide, self: 0.1, rimK: 0.12, rimC: [1.0, 0.6, 0.7], vh: 'attribute vec3 aCtr;', vb: 'transformed.y -= (1.0 - vK) * 0.3;' });
    m.userData.base = 0.62; mk(sk, m, 3);
  }
  let cutMesh;
  {   // the cut face: deep rose-red muscle, paler just under the membrane, faintly striated where the myofibrils run and
    // mottled, fading towards the sides and the bottom. Half see-through and writing no depth, so the nuclei,
    // organelles and myofibrils behind it show through it; it thins while a place glows (the rest dims) and as you
    // come close (in the set's units, so also at life size), so the close views look into the fibre unveiled
    const m = lit('cut', { side: THREE.DoubleSide, self: 0.2, rimK: 0, rough: 0.85, vh: 'varying float vTop, vScl;',
      vb: 'vTop = aQ.z; vScl = length(modelMatrix[0].xyz);', fh: 'varying float vTop, vScl;',
      fcol: `{
  float d = vTop - vL.y, x = vL.x / ${f4(ZP)}, w = fwidth(x) * 1.5, m = abs(fract(x - 0.5) - 0.5);
  float A = (1.0 - smoothstep(0.3 - w, 0.3 + w, m)) * clamp(1.0 - w * 4.0, 0.0, 1.0) * (1.0 - smoothstep(-0.86, -0.76, vL.y));
  float mot = sin(vL.x * 23.0 + 2.0 * sin(vL.y * 17.0)) * sin(vL.y * 19.0 + 1.3 * sin(vL.x * 13.0));
  diffuseColor.rgb *= (1.0 - 0.2 * A) * (1.0 + 0.07 * mot) * (0.85 + 0.15 * smoothstep(-1.18, -0.5, vL.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.62, 0.66), 0.55 * (1.0 - smoothstep(0.0, 0.07, d)));
  diffuseColor.a *= vK * (0.45 + 0.55 * vDm) * smoothstep(0.0, 0.35, ${f4(XS)} - abs(vL.x)) * (0.3 + 0.7 * smoothstep(-1.18, -0.78, vL.y))
    * (0.25 + 0.75 * smoothstep(1.2, 4.0, length(vViewPosition) / vScl));
}` });
    m.userData.base = 0.55; m.depthWrite = false; cutMesh = mk(cutB, m, 4);
  }

  // ------------------------------------------------------------------ update
  const G = SU.uG.value, D = SU.uD.value, ST = SU.uStage.value, FU = SU.uFuse.value, EW = EU.uEW.value;
  const RUN = [1, 0.7, 0.5, 0.36, 0.27, 0.2];   // release per impulse in the tired run-down (six, then two at rest)
  const fused = new Array(16).fill(0), FOC = new Array(12).fill(0);
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _S = new THREE.Vector3(), _Q0 = new THREE.Quaternion();
  // the vesicles jiggle; docked ones that fuse sink and flatten into the membrane, and new ones dock before the next impulse
  function vesicles(t, ph, amp) {
    const fa = smooth(clamp(amp * 2, 0, 1));
    for (let i = 0; i < VES.length; i++) {
      const p = VES[i], w = VPH[i];
      let x = p[0], y = p[1], z = p[2], sxz = 1, sy = 1;
      if (i >= 16) { x += 0.003 * Math.sin(t * 1.3 + w); y += 0.003 * Math.sin(t * 1.1 + 2 * w); z += 0.003 * Math.cos(t * 0.9 + w); }
      else if (fused[i] && fa > 0) {
        let dy = 0, s1 = 1, s2 = 1;
        if (ph < 0.39) { const k = prog(ph, 0.24, 0.35), e = prog(ph, 0.32, 0.39); dy = -0.016 * k; s1 = (1 + 0.6 * k) * (1 - e); s2 = (1 - 0.85 * k) * (1 - e); }
        else if (ph < 0.8) s1 = s2 = 0;
        else { const r = prog(ph, 0.8, 0.98); dy = 0.07 * (1 - r); s1 = s2 = 0.4 + 0.6 * r; }
        y += dy * fa; sxz = Math.max(1e-4, lerp(1, s1, fa)); sy = Math.max(1e-4, lerp(1, s2, fa));
      }
      vesMesh.setMatrixAt(i, _M.compose(_P.set(x, y, z), _Q0, _S.set(sxz, sy, sxz)));
    }
    vesMesh.instanceMatrix.needsUpdate = true;
  }
  let cur = { place: 0 };
  function update(S, t) {
    // assembly: the fibre, its membrane, the basement membrane, the receptors gather, the nerve arrives, the Schwann cell
    const b = clamp(S.syn_build, 0, 1);
    ST[0] = prog(b, 0, 0.3); ST[1] = prog(b, 0.05, 0.35); ST[2] = prog(b, 0.25, 0.5); ST[3] = prog(b, 0.4, 0.7); ST[4] = prog(b, 0.5, 0.85); ST[5] = prog(b, 0.8, 1);
    const ny = 0.6 * Math.pow(1 - ST[4], 2);
    SU.uNerveY.value = ny; vesMesh.position.y = ny;
    SU.uShell.value = clamp(S.syn_shell, 0, 1); shellMesh.visible = SU.uShell.value > 0.003; cutMesh.visible = ST[0] > 0;
    // firing: one impulse a second; tired, each of six impulses releases less (the twitch shrinks, then fails), two rest
    const fire = clamp(S.syn_fire, 0, 1), tired = clamp(S.syn_tired, 0, 1);
    const n = Math.floor(t), ph = t - n, kc = ((n % 8) + 8) % 8;
    const amp = fire * (kc < 6 ? 1 : 1 - tired) * ST[4], rel = kc < 6 ? lerp(1, RUN[kc], tired) : 1;
    SU.uPh.value = ph; SU.uFire.value = amp; SU.uWave.value = amp * prog(rel, 0.3, 0.55) * ST[1];
    const dd = ph - 0.52, tw = dd > 0 ? amp * prog(rel, 0.24, 0.7) * (dd / 0.08) * Math.exp(1 - dd / 0.08) : 0;
    SU.uTw.value = tw; myoG.scale.x = 1 - 0.035 * tw;
    for (let s = 0; s < 16; s++) { fused[s] = amp > 0.001 && hash(n, s) < 0.12 + 0.48 * rel ? 1 : 0; FU[s] = fused[s] * amp; }
    vesicles(t, ph, amp);
    // an endotype's place glows in its colour and the rest dims; an endotype without a place dims everything a little
    const sp = clamp(S.syn_place, 0, 12), breath = 0.85 + 0.15 * Math.sin(t * 2.4);
    G.fill(0); FOC.fill(0);
    let wp = 0, wn = 0;
    for (let id = 0; id < 12; id++) {
      const w = clamp(1 - Math.abs(sp - id - 1), 0, 1), sl = SLOT[EN[id].place];
      if (w <= 0) continue;
      if (sl !== undefined) { G[sl] += 1.1 * w * breath; FOC[sl] += w; wp += w; } else wn += w;
    }
    const gd = 1 - 0.22 * prog(S.syn_genes, 0, 0.3) - 0.15 * prog(S.syn_endo, 0, 0.5);
    for (let k = 0; k < 12; k++) D[k] = (1 - 0.66 * (wp - FOC[k]) - 0.22 * wn) * gd;
    for (let id = 0; id < 12; id++) EW[id] = 1 - 0.65 * (wp + wn) + 0.85 * clamp(1 - Math.abs(sp - id - 1), 0, 1);
    EU.uGenes.value = clamp(S.syn_genes, 0, 1); EU.uEndo.value = clamp(S.syn_endo, 0, 1);
    // what is not there costs nothing
    genePts.visible = EU.uGenes.value > 0.04; endoPts.visible = EU.uEndo.value > 0.001;
    vesMesh.visible = ST[4] > 0; recMesh.visible = muskMesh.visible = navMesh.visible = ST[3] > 0; lamMesh.visible = ST[2] > 0; acheMesh.visible = ST[5] > 0;
    cur.place = sp;
  }

  // ------------------------------------------------------------------ anchors, labels, views, explore
  const anchors = {
    axon: axAt(0.45), terminal: [0.05, 0.8, 0.12], vesicles: [-0.1, 0.3, 0.26], activezone: azF[1](0.92), mito: MITO[0].at(0, -PI / 2, 1),
    endosome: ENDS[0].slice(0, 3), cleft: [0.25, 0.08, 0.3], lamina: [0.5, YL + 0.005, 0.3], receptors: [0.25, 0.022, 0.28],
    folds: [fX(4, 0.3), -0.18, 0.3], channels: v3.add(na.p, v3.mul(na.n, 0.01)), nucleus: [NA[0], NA[1] + 0.06, ZC], er: ERP.length ? erF[0] : NA,
    golgi: [GO[0], GO[1] + 0.12, GO[2]], scaffold: [0.1, MYO[0][0] + MYR, 0.24], fibre: [0.95, -0.5, 0.3], gap: [0, 0.085, 0.05],
    junction: [0, 0.05, 0], loose: [0.62, 1.22, 0],
  };
  EN.forEach(e => { anchors['e' + e.id] = ECEN[e.id]; });
  // the current syn_place: its endotype's place, or its loose cloud; the junction when none
  anchors.place = () => { const id = Math.round(cur.place) - 1; return id < 0 ? anchors.junction : anchors[EN[id].place] || ECEN[id]; };
  const quiet = S => (1 - prog(S.syn_genes, 0, 0.12)) * (1 - prog(S.syn_endo, 0, 0.12)) * (1 - clamp(S.syn_place, 0, 1));
  const at = (b0, b1) => S => quiet(S) * prog(S.syn_build, b0, b1);
  const labels = [
    { text: ['Nerve ending', 'of a motor axon'], at: 'terminal', cls: 'cyn', alpha: at(0.8, 0.95) },
    { text: ['Synaptic vesicles', 'full of acetylcholine'], at: 'vesicles', cls: '', alpha: at(0.85, 0.95) },
    { text: ['Mitochondrion', ''], at: 'mito', cls: 'mag', alpha: at(0.85, 0.95) },
    { text: ['Basement membrane', 'in the cleft'], at: 'lamina', cls: 'cyn', alpha: at(0.45, 0.55) },
    { text: ['Acetylcholine receptors', 'on the crests'], at: 'receptors', cls: 'grn', alpha: at(0.65, 0.75) },
    { text: ['Junctional folds', ''], at: 'folds', cls: 'amb', alpha: at(0.3, 0.4) },
    { text: ['Muscle fibre', ''], at: 'fibre', cls: '', alpha: at(0.2, 0.3) },
  ];
  const GCLS = ['cyn', 'cyn', 'cyn', 'cyn', '', 'amb', 'amb', 'amb', 'mag', 'mag', 'mag'];
  // each group's label pinned near its markers, spread so they stack tidily when all show
  const GLA = [[0.02, 0.74, 0.24], [0.12, 0.2, 0.3], [-0.3, 0.58, ZC], [0.45, 0.42, 0.27], [0.62, 0.07, 0.3], [0.05, 0.03, 0.27],
    [-0.25, -0.01, 0.3], [FX[3], -0.36, 0.3], [-0.86, -0.6, 0.3], [0.3, -0.84, 0.28], [-0.45, -0.56, ZC]];
  GLAB.forEach(L => labels.push({ text: [L.b, L.r], at: GLA[L.g], cls: GCLS[L.g],
    alpha: S => prog(S.syn_genes, geneStart(L.g), geneStart(L.g) + 0.1) * (1 - prog(S.syn_endo, 0, 0.12)) * (1 - clamp(S.syn_place, 0, 1)) }));
  EN.forEach(e => labels.push({ text: ['Endotype ' + e.id, e.name], at: e.place && anchors[e.place] ? e.place : 'e' + e.id, cls: '',
    alpha: S => clamp(1 - Math.abs(S.syn_place - e.id - 1), 0, 1) }));
  const LOOSE = EN.filter(e => !e.place).map(e => e.id);
  labels.push({ text: ['No shared place', 'endotypes ' + LOOSE.slice(0, -1).join(', ') + ' and ' + LOOSE[LOOSE.length - 1]], at: 'loose', cls: '',
    alpha: S => prog(S.syn_endo, 0.35, 0.6) * (1 - clamp(S.syn_place, 0, 1)) });
  const cam = {
    default: [26, 16, 5.8, -0.05, 0.05, 0],
    terminal: [22, 14, 2.1, 0, 0.42, 0.1],
    cleft: [62, 4, 1.05, 0.1, 0.06, 0.15],
    receptors: [6, 48, 0.32, 0.25, 0.0, 0.27],
    folds: [10, 6, 1.45, 0.1, -0.18, 0.2],
    nucleus: [-16, 10, 1.45, -0.32, -0.66, 0.15],
    gap: [-90, 0, 1.1, 0.35, 0.092, 0.1],
    wide: [24, 20, 8.2, -0.25, -0.25, -0.2],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['default', 'Junction'], ['terminal', 'Nerve ending'], ['cleft', 'Cleft'], ['folds', 'Folds'], ['nucleus', 'Inside the fibre']] },
    { key: 'fire', label: 'Firing', options: [['still', 'Still'], ['firing', 'Firing'], ['tired', 'Until tired']] },
    { key: 'genes', label: 'Genes', options: [['off', 'Off'], ['on', 'On']] },
  ];
  let placeSel = -1;   // the endotype the engine asked to show (showPlace), or -1
  function explore(c) {
    const pl = c.place !== undefined ? c.place : placeSel;
    return { syn_build: 1, syn_fire: c.fire === 'firing' || c.fire === 'tired' ? 1 : 0, syn_tired: c.fire === 'tired' ? 1 : 0,
      syn_genes: c.genes === 'on' ? 1 : 0, syn_place: pl >= 0 ? pl + 1 : 0, syn_endo: pl >= 0 ? 1 : 0, syn_shell: 0 };   // (no view here needs the fibre's wide surface)
  }
  return Object.assign(set, {
    params: { syn_a: 1, syn_build: 1, syn_fire: 0, syn_tired: 0, syn_genes: 0, syn_place: 0, syn_endo: 0, syn_shell: 1 },
    update, anchors, labels, cam, controls, explore,
    // drawn where its geometry is, but for the cut-away (a point past the cut plane, of a part cut there): a headset keeps
    // the rest clear of your head
    keepClear: o => { const a = o.geometry.attributes.aS; return a && a.itemSize === 4 ? (x, y, z, i) => !(a.array[4 * i + 3] > 0.5 && z > ZC) : null; },
    showPlace: id => { placeSel = id >= 0 && id < 12 ? id : -1; },
    genePos: sym => GPOS[sym] || null,                                       // where a seed gene acts (local coordinates)
    geneGroups: GLAB.map(L => ({ text: [L.b, L.r], genes: L.syms, at: L.at, from: geneStart(L.g) })),   // in the order they light
  });
};
