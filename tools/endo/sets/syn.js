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
  const MYR = 0.07;

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
    uPh: { value: 9 }, uFire: { value: 0 }, uWave: { value: 0 }, uTw: { value: 0 }, uFuse: { value: new Array(16).fill(0) },
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
  float f = uFuse[int(e.x + 0.5)], env = smoothstep(0.29, 0.35, uPh) * (1.0 - smoothstep(0.5, 0.72, uPh));
  return f * env * step(e.z, exp(-e.y / 0.0065));
}`;

  // translucent membranes (bouton, axon, myelin, Schwann cell, muscle membrane, organelle envelopes, the fibre's
  // surface, the cut edges and the basement membrane's sheet): additive glass that glows at the rim
  const glassMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA }, SU),
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 color;` + VH + `
varying vec3 vN, vW, vC; varying float vGA;
void main() {` + VB + `
  vC = color; vGA = aQ.z;
  vec3 p = position; p.y += aS.z * uNerveY;
  vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `uniform float uA;
varying vec3 vN, vW, vC, vGC, vL; varying float vDm, vK, vP, vKind, vClip, vGA;
void main() {
  if (vK < 0.003 || (vClip > 0.5 && vL.z > ${f4(ZC)})) discard;
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW); float r = pow(1.0 - abs(dot(n, v)), 2.2), pat = 1.0;
  if (vKind > 3.5) {   // the basement membrane: a fibrous mesh
    vec2 q = vec2(vL.x + vL.y, vL.z) * 70.0;
    pat = 0.2 + 0.8 * pow(abs(sin(q.x + 1.7 * sin(q.y * 0.53)) * sin(q.y * 0.8 + 1.3 * sin(q.x * 0.41))), 0.7); r = 0.35 + 0.65 * r;
  } else if (vKind > 2.5) pat = 0.65 + 0.35 * smoothstep(0.2, 0.6, abs(fract(vL.x / ${f4(ZP)}) - 0.5) * 2.0);
  vec3 pc = vKind < 1.5 ? vec3(0.55, 0.9, 1.0) : vec3(1.0, 0.68, 0.32);
  vec3 col = (vC * (0.45 + 0.85 * r) * vDm * pat + vGC * (0.5 + 1.2 * r) * pat) * (0.03 + 0.42 * r) + pc * vP * (0.22 + 0.7 * r);
  gl_FragColor = vec4(col * vGA * vK, uA);
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
totalEmissiveRadiance += diffuseColor.rgb * uSelf + uRimC * (uRimK * rimF * vDm) + vGC * (0.3 + 0.9 * rimF) + vec3(1.0, 0.72, 0.4) * vP * 0.9;` + (o.fe || ''));
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

  // @@NEXT
};
