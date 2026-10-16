// The motor unit (slide 2 of the talk), from nerve to sarcomere, and the heart. Read from left to right: a short
// section of spinal cord (its axis along z, the cut face towards you; ventral points right, lateral points down)
// with a motor neuron in the anterior horn and a sensory neuron in a dorsal root ganglion; the ventral and dorsal
// roots join into the spinal nerve, whose myelinated axons (nodes of Ranvier between the sleeves) reach a fascicle
// of 20 striated muscle fibres; the motor axon branches to six neuromuscular junctions (its motor unit) and the
// sensory axon coils round a muscle spindle. One fibre opens to its myofibrils, and one myofibril's last sarcomere
// magnifies into a hexagonal lattice of actin, myosin (with heads) and titin between Z-discs, the M-band in the
// middle. Above floats a beating heart whose window shows the same striated muscle.
SETS.motor = function (K) {
  const { THREE, clamp, lerp, prog, smooth, rng, v3 } = K;
  const set = K.newSet('motor');
  const PI = Math.PI, TAU = 2 * PI;
  const R = rng(2026);

  // ------------------------------------------------------------------ disease groups by site (from the data)
  const GR = NMD_DATA.groups;
  const SITES = ['neuron', 'nerve', 'junction', 'muscle', 'heart'];   // motor_site 1..5
  const SCOL = SITES.map(s => GR.filter(g => g.site === s).map(g => K.rgb(g.col)));
  const sc = (k, i) => { const L = SCOL[k - 1]; return L.length ? L[i % L.length] : [0.9, 0.9, 0.9]; };
  const ncol = k => Math.max(1, SCOL[k - 1].length);

  // ------------------------------------------------------------------ shared uniforms
  // site slots: 1..5 the five sites; 6 and 7 the sarcomere's thin and thick parts (glow as muscle and heart,
  // dim only when neither is chosen, since skeletal and heart muscle share the sarcomere)
  const SU = {
    uTime: K.U.uTime, uBuildX: { value: 10 }, uSiteG: { value: [0, 0, 0, 0, 0, 0, 0, 0] }, uSiteD: { value: [1, 1, 1, 1, 1, 1, 1, 1] },
    uTw: { value: 0 }, uOpen: { value: 0 }, uOpenDir: { value: new THREE.Vector3(0, 0, 1) },
    uPh: { value: 0 }, uP: { value: 1.7 }, uSig: { value: 0 },
  };
  const VH = `
attribute float aSite; attribute vec3 aGC;
uniform float uSiteG[8], uSiteD[8], uBuildX, uTime;
varying float vGlow, vDim, vBX; varying vec3 vGC;`;
  const VT = `
{ int si = int(aSite + 0.5); vGlow = uSiteG[si]; vDim = uSiteD[si]; vGC = aGC; vBX = uBuildX - position.x; }`;
  const FH = `
uniform float uSelf, uRimK, uTint; uniform vec3 uRimC;
varying float vGlow, vDim, vBX; varying vec3 vGC;`;
  const FC = `
#ifdef BUILD
if (vBX < 0.0) discard;
#endif`;
  const FE = `
float rimF = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);
totalEmissiveRadiance += diffuseColor.rgb * uSelf + uRimC * (uRimK * rimF * vDim) + vGC * (vGlow * (0.1 * uTint + 0.55 * rimF));
#ifdef BUILD
totalEmissiveRadiance += vec3(0.55, 0.9, 1.0) * smoothstep(0.035, 0.0, vBX) * 1.4;
#endif`;
  // the twitch of the motor unit's fibres (and what sits on them): shorter about the fascicle's middle, thicker
  const TWV = `
attribute vec4 aTwA; uniform float uTw, uOpen;`;
  // an impulse passing: the membrane lights up (aPT = 20 + the time it passes)
  const PLV = `
attribute float aPT; uniform float uPh, uP, uSig; varying float vPulse;`;
  const PLB = `
{ float d = uPh - (aPT - 20.0); d -= uP * floor(d / uP + 0.5); vPulse = aPT > 1.0 ? uSig * exp(-d * d / 0.0025) : 0.0; }`;
  const PLF = `varying float vPulse;`, PLE = `totalEmissiveRadiance += (diffuseColor.rgb * 1.3 + 0.22) * vPulse;`;
  const TWB = `
vec3 ax = aTwA.xyz; float tw = uTw * aTwA.w; vec3 rd = transformed - ax;`;
  const TWE = `
ax.x = 0.15 + (ax.x - 0.15) * (1.0 - 0.03 * tw);
transformed = ax + rd * (1.0 + 0.1 * tw);`;
  // a lit surface material with the set's hooks: build reveal along x, site glow (coloured light) and dimming, rim
  function lit(key, o = {}) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.rough === undefined ? 0.55 : o.rough, metalness: 0, side: o.side || THREE.FrontSide });
    K.fade(set, m, o.base === undefined ? 1 : o.base);
    if (o.build !== false) m.defines = { BUILD: '' };
    m.extensions = { derivatives: true };
    const un = Object.assign({ uSelf: { value: o.self === undefined ? 0.15 : o.self }, uRimK: { value: o.rimK === undefined ? 0.25 : o.rimK }, uTint: { value: o.tint === undefined ? 1 : o.tint },
      uRimC: { value: new THREE.Color(...(o.rimC || [0.6, 0.8, 1])) } }, o.uniforms || {});
    m.userData.u = un;
    m.customProgramCacheKey = () => 'motor-' + key;
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, SU, un);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + VH + (o.vh || ''))
        .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position);\n' + (o.vb || '') + '\n' + VT);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + FH + (o.fh || ''))
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + FC + '\n' + (o.fc || ''))
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + (o.fcol || '') + '\ndiffuseColor.rgb *= vDim;\ndiffuseColor.rgb = mix(diffuseColor.rgb, vGC * (0.35 + 0.65 * vDim), clamp(0.45 * vGlow * uTint, 0.0, 0.55));')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>' + FE + '\n' + (o.fe || ''));
    };
    return m;
  }
  // opacity on top of the set's fade (setAlpha runs before update every frame)
  function show(mat, mesh, k) {
    const b = mat.userData.base, o = b * set.uA.value * k;
    mat.opacity = o; mat.depthWrite = o > 0.97 && b > 0.97; mesh.visible = k > 0.003;
  }

  // ------------------------------------------------------------------ geometry helpers
  const V = a => new THREE.Vector3(a[0], a[1], a[2]);
  // a tube through pts (CatmullRom) whose radius r(u) varies; adds aAxis (ring centre) and aU (0..1 along)
  function tubeR(pts, seg, rad, r, closed) {
    const curve = new THREE.CatmullRomCurve3(pts.map(V), !!closed);
    const fr = curve.computeFrenetFrames(seg, !!closed);
    const nv = (seg + 1) * (rad + 1), P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), A = new Float32Array(nv * 3), U = new Float32Array(nv);
    const c = new THREE.Vector3(), idx = [];
    let o = 0;
    for (let i = 0; i <= seg; i++) {
      const u = i / seg; curve.getPointAt(closed && i === seg ? 0 : u, c);
      const rr = typeof r === 'function' ? r(u) : r, nn = fr.normals[i % (closed ? seg : seg + 1)], bb = fr.binormals[i % (closed ? seg : seg + 1)];
      for (let j = 0; j <= rad; j++) {
        const a = j / rad * TAU, cs = -Math.cos(a), sn = Math.sin(a);
        const nx = cs * nn.x + sn * bb.x, ny = cs * nn.y + sn * bb.y, nz = cs * nn.z + sn * bb.z;
        P[o * 3] = c.x + rr * nx; P[o * 3 + 1] = c.y + rr * ny; P[o * 3 + 2] = c.z + rr * nz;
        N[o * 3] = nx; N[o * 3 + 1] = ny; N[o * 3 + 2] = nz;
        A[o * 3] = c.x; A[o * 3 + 1] = c.y; A[o * 3 + 2] = c.z; U[o] = u; o++;
      }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j, b = (i + 1) * (rad + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('aAxis', new THREE.BufferAttribute(A, 3)); g.setAttribute('aU', new THREE.BufferAttribute(U, 1));
    g.setIndex(idx); g.userData.curve = curve;
    return g;
  }
  // a closed surface f(u, v) -> [x, y, z], u 0..1 pole to pole, v 0..1 around; smooth normals across the seam
  function surf(nu, nv, f) {
    const P = [], idx = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) P.push(...f(i / nu, (j % nv) / nv));
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); g.setIndex(idx); g.computeVertexNormals();
    const n = g.attributes.normal.array, avg = list => { const s = [0, 0, 0]; for (const k of list) for (let c = 0; c < 3; c++) s[c] += n[k * 3 + c]; const l = Math.hypot(...s) || 1; for (const k of list) for (let c = 0; c < 3; c++) n[k * 3 + c] = s[c] / l; };
    for (let i = 0; i <= nu; i++) avg([i * (nv + 1), i * (nv + 1) + nv]);
    avg([...Array(nv + 1).keys()]); avg([...Array(nv + 1).keys()].map(j => nu * (nv + 1) + j));
    return g;
  }
  // collects many geometries into one indexed geometry with the attributes in spec ({ name: size });
  // vals give each attribute a constant, a function (x, y, z, i) of the (transformed) vertex, or nothing (then the
  // geometry's own attribute of that name, or zeros); m an optional Matrix4 applied on the way
  function Builder(spec) {
    // adds are queued and written into typed arrays once, in geo()
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
  // a fast tube along an explicit centre line f(u), u 0..1 (frames by parallel transport), radius r(u) or r(u, angle);
  // returns a plain geometry-like object for Builder.add
  function tubeFn(f, seg, rad, r) {
    const nv = (seg + 1) * (rad + 1), P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), A = new Float32Array(nv * 3), U = new Float32Array(nv);
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
        N[o * 3] = nx; N[o * 3 + 1] = ny; N[o * 3 + 2] = nz;
        A[o * 3] = c[0]; A[o * 3 + 1] = c[1]; A[o * 3 + 2] = c[2]; U[o] = u; o++;
      }
    }
    let k = 0;
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) { const a = i * (rad + 1) + j, b = a + rad + 1; idx[k++] = a; idx[k++] = b; idx[k++] = a + 1; idx[k++] = b; idx[k++] = b + 1; idx[k++] = a + 1; }
    const at = (array, itemSize) => ({ array, itemSize, count: array.length / itemSize });
    return { attributes: { position: at(P, 3), normal: at(N, 3), aAxis: at(A, 3), aU: at(U, 1) }, index: { array: idx } };
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
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true), CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  // a smooth octahedron (6 vertices): stretched, it makes a myosin head
  const OCT = (() => { const d = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].flat(), A = a => ({ array: new Float32Array(a), itemSize: 3, count: 6 });
    return { attributes: { position: A(d), normal: A(d) }, index: { array: [0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 4, 2, 1, 3, 4, 1, 5, 3, 1, 2, 5] } }; })();
  const sphere = (c, r, w, h) => new THREE.SphereGeometry(r, w || 14, h || 10).translate(c[0], c[1], c[2]);
  // samples of a curve every ds: [{ p, s }] with s the arc length
  function sampleCurve(curve, ds, from = 0, to) {
    const L = curve.getLength(), e = to === undefined ? L : to, out = [];
    for (let s = from; s <= e + 1e-9; s += ds) out.push({ p: curve.getPointAt(clamp(s / L, 0, 1)).toArray(), s });
    return out;
  }
  const NOTW = [0, 0, 0, 0];

  // ------------------------------------------------------------------ layout (local units)
  const CC = [-1.0, 0.0, 0.0], CRX = 0.18, CRY = 0.22, CHL = 0.085;   // cord centre, semi-axes (ventral, lateral), half length
  const MS = [-0.90, -0.085, 0.0];                                     // motor neuron soma, in the anterior horn
  const SG = [-1.10, -0.36, 0.0];                                      // dorsal root ganglion
  const FCN = [0.15, -0.30, 0.0], FX0 = -0.25, FX1 = 0.55, RF = 0.034; // fascicle centre, fibre ends, fibre radius
  const HC = [0.30, 0.29, -0.12];                                      // heart
  const SC = [1.0, -0.05, 0.0];                                        // magnified sarcomere
  const PER = 0.018;                                                   // sarcomere length in the fibres
  const IL = 0.066, NG = 0.0085;                                       // internode length, node gap
  const TM0 = 0.5, vM = 3.35, vS = 5.8, vC = 6.9, P_ = 1.7;             // motor neuron fires; conduction speeds; reflex period

  // ------------------------------------------------------------------ builders and materials
  const LITS = { color: 3, aSite: 1, aGC: 3 }, LITT = Object.assign({ aTwA: 4, aPT: 1 }, LITS);   // aPT: 20 + the time an impulse passes (0: never)
  const glass = Builder({ color: 3, aSite: 1, aGC: 3, aGA: 1 });
  const greyB = Builder(LITS), somaB = Builder(LITT), nucB = Builder(LITS), neuB = Builder(LITT), myeB = Builder(LITS);
  const fibB = Builder(Object.assign({ aF: 3 }, LITT));
  const rings = Builder({ aGC: 3, aR: 3 });
  const PTS = [];   // { p, c, s (size), a, q: [kind, time, site] }; kinds: 0 pulse, 1 vesicle, 2 transmitter, 3 halo, 4 heart glow
  const pt = (p, c, s, a, q) => PTS.push({ p, c, s, a, q });
  const ring = (ctr, nrm, rad, tr, col, site, speed, seg) => {
    const n = v3.norm(nrm), a = v3.norm(Math.abs(n[1]) < 0.9 ? v3.cross(n, [0, 1, 0]) : v3.cross(n, [1, 0, 0])), b = v3.cross(n, a), pts = [];
    for (let i = 0; i < 24; i++) { const t = i / 24 * TAU; pts.push(v3.add(ctr, v3.add(v3.mul(a, rad * Math.cos(t)), v3.mul(b, rad * Math.sin(t))))); }
    const g = tubeR(pts, seg || 64, 4, tr, true);
    rings.add(g, { aGC: col, aR: (x, y, z, i) => [site, g.attributes.aU.array[i], speed] });
  };

  // ------------------------------------------------------------------ spinal cord: white matter (glass) and the grey butterfly
  {
    // half outline (ventral is +u, lateral |v|): anterior horn, lateral horn, posterior horn reaching the surface
    const HALF = [[0.015, 0], [0.02, 0.025], [0.06, 0.03], [0.11, 0.04], [0.145, 0.065], [0.15, 0.10], [0.12, 0.125], [0.075, 0.12],
      [0.04, 0.127], [0.015, 0.115], [-0.015, 0.085], [-0.05, 0.07], [-0.095, 0.08], [-0.14, 0.10], [-0.16, 0.112], [-0.163, 0.098],
      [-0.13, 0.072], [-0.08, 0.045], [-0.04, 0.022], [-0.02, 0]];
    const loop = HALF.concat(HALF.slice(1, -1).reverse().map(p => [p[0], -p[1]]));
    const shp = new THREE.Shape();
    shp.moveTo(loop[0][0], loop[0][1]);
    shp.splineThru(loop.slice(1).concat([loop[0]]).map(p => new THREE.Vector2(p[0], p[1])));
    const hole = new THREE.Path(); hole.absarc(0, 0, 0.006, 0, TAU, true); shp.holes.push(hole);   // central canal
    const gg = new THREE.ExtrudeGeometry(shp, { depth: 2 * CHL - 0.034, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 2, curveSegments: 3 });
    gg.translate(CC[0], CC[1], -(CHL - 0.017));
    greyB.add(gg, { color: K.rgb('#c99ac4'), aSite: 1, aGC: sc(1, 0) });
  }

  // ------------------------------------------------------------------ motor neuron: soma, nucleus, dendrites
  const GOLD = K.rgb('#ffc35a'), TEAL = K.rgb('#5ee0d2'), PLATE = K.rgb('#ff8fb0');
  {
    const dirs = [];
    for (let k = 0; k < 7; k++) {
      const a = 1.2 + k / 7 * TAU * 0.86 + (R() - 0.5) * 0.4;   // around, leaving the axon's side (towards +x, -y) free
      dirs.push(v3.norm([Math.cos(a), Math.sin(a), (R() - 0.5) * 0.5]));
    }
    const sg = new THREE.SphereGeometry(1, 28, 20), P = sg.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const n = [P.getX(i), P.getY(i), P.getZ(i)];
      let r = 0.036;
      for (const d of dirs) r += 0.008 * Math.pow(Math.max(0, v3.dot(n, d)), 8);
      r += 0.007 * Math.pow(Math.max(0, v3.dot(n, v3.norm([0.86, -0.5, 0]))), 6);
      P.setXYZ(i, MS[0] + n[0] * r, MS[1] + n[1] * r * 0.92, MS[2] + n[2] * r * 0.9);
    }
    sg.computeVertexNormals();
    somaB.add(sg, { color: GOLD, aSite: 1, aGC: sc(1, 0), aTwA: NOTW, aPT: 20 + TM0 - 0.01 });
    nucB.add(sphere(v3.add(MS, [-0.004, 0.003, 0.004]), 0.0135, 18, 12), { color: K.rgb('#7f8cff'), aSite: 1, aGC: sc(1, 0) });
    nucB.add(sphere(v3.add(MS, [-0.001, 0.006, 0.0145]), 0.0045, 10, 8), { color: [0.95, 0.96, 1], aSite: 1, aGC: sc(1, 0) });
    const dend = (p, d, len, r, depth, k) => {
      const pts = [p]; let q = p, dd = d;
      for (let i = 0; i < 3; i++) { dd = v3.norm(v3.add(dd, v3.mul(K.unit(R), 0.3))); dd[2] *= 0.5; dd = v3.norm(dd); q = v3.add(q, v3.mul(dd, len / 3)); pts.push(q); }
      neuB.add(tubeR(pts, 9, 6, u => r * (depth ? 1 - 0.4 * u : 1 - 0.85 * u)), { color: GOLD, aSite: 1, aGC: sc(1, k), aTwA: NOTW });
      if (depth > 0) for (let s = 0; s < 2; s++) dend(q, v3.norm(v3.add(dd, v3.mul(K.unit(R), 0.85))), len * 0.68, r * 0.58, depth - 1, k);
    };
    dirs.forEach((d, k) => dend(v3.add(MS, v3.mul(d, 0.024)), d, 0.055 + R() * 0.02, 0.0095, 2, k));
  }

  // ------------------------------------------------------------------ axons, myelin, nodes of Ranvier
  const nodes = [];   // { p, time } of every node (pulse flashes)
  function myelinate(curve, s0, s1, rAx, rMy, site, list) {
    const L = curve.getLength();
    let s = s0;
    while (s + 0.025 < s1) {
      const e = Math.min(s + IL, s1), pts = [];
      for (let i = 0; i <= 6; i++) pts.push(curve.getPointAt((s + (e - s) * i / 6) / L).toArray());
      myeB.add(tubeR(pts, 16, 12, u => { const w = Math.min(u, 1 - u) * (e - s); return rAx * 1.06 + (rMy - rAx) * Math.sqrt(smooth(w / 0.01)); }),
        { color: [0.9, 0.94, 1.0], aSite: typeof site === 'function' ? site : site, aGC: sc(2, 0) });
      list.push((s + e) / 2);
      s = e + NG;
      if (s < s1) nodes.push({ s: s - NG / 2, curve });
    }
  }
  const midSheath = [];   // centres of internodes (for anchors)
  // motor axon: soma, hillock, ventral root, spinal nerve, to the branch point in front of the fascicle
  const MP = [MS, [-0.875, -0.10, 0.0], [-0.855, -0.125, 0.0], [-0.845, -0.15, 0.002], [-0.828, -0.24, 0.006], [-0.81, -0.33, 0.01],
    [-0.78, -0.41, 0.014], [-0.70, -0.45, 0.02], [-0.58, -0.46, 0.04], [-0.45, -0.45, 0.07], [-0.33, -0.415, 0.12], [-0.22, -0.37, 0.225],
    [-0.12, -0.30, 0.25], [-0.05, -0.26, 0.255]];
  const axM = tubeR(MP, 300, 7, u => 0.0085 + 0.0075 * (1 - smooth(u / 0.04)));
  const cM = axM.userData.curve, LM = cM.getLength();
  neuB.add(axM, { color: GOLD, aSite: (x) => (x < -0.83 ? 1 : 2), aGC: (x) => (x < -0.83 ? sc(1, 0) : sc(2, 0)), aTwA: NOTW, aPT: (x, y, z, i) => 20 + TM0 + axM.attributes.aU.array[i] * LM / vM });
  const nodeM0 = nodes.length;
  myelinate(cM, 0.07, LM - 0.006, 0.0085, 0.0148, x => (x < -0.83 ? 1 : 2), midSheath);
  const nodeM1 = nodes.length;

  // sensory neuron: soma in the ganglion, stem to a T, central branch to the dorsal horn and on to the motor neuron
  // (the stretch reflex), peripheral branch along the nerve to an annulospiral ending round a muscle spindle
  const SS = v3.add(SG, [-0.014, 0.004, 0.006]), TJ = v3.add(SG, [0.012, -0.004, 0]);
  somaB.add(sphere(SS, 0.019, 20, 14), { color: TEAL, aSite: 1, aGC: sc(1, 1), aTwA: NOTW });
  nucB.add(sphere(v3.add(SS, [-0.002, 0.002, 0.004]), 0.0075, 14, 10), { color: K.rgb('#7f8cff'), aSite: 1, aGC: sc(1, 1) });
  neuB.add(tubeR([v3.add(SS, [0.012, -0.006, 0.004]), v3.add(SG, [0.006, -0.014, 0.008]), v3.add(SG, [0.012, -0.012, 0.004]), TJ], 12, 6, 0.0042),
    { color: TEAL, aSite: 1, aGC: sc(1, 1), aTwA: NOTW });
  const SPA = x => [x, FCN[1] - 0.205 * 0.6, FCN[2] + 0.205 * 0.8];   // spindle axis
  const SOD = [0, -0.6, 0.8], SE = v3.cross([1, 0, 0], SOD);
  const PP = [TJ, [-1.09, -0.42, 0.0], [-1.04, -0.47, 0.0], [-0.95, -0.495, 0.0], [-0.86, -0.50, 0.0], [-0.70, -0.478, 0.008],
    [-0.58, -0.487, 0.028], [-0.45, -0.477, 0.058], [-0.33, -0.447, 0.112], [-0.22, -0.412, 0.212], [-0.10, -0.44, 0.205],
    [0.03, -0.443, 0.193], [0.10, -0.437, 0.181]];
  const axP = tubeR(PP, 280, 6, 0.0055), cP = axP.userData.curve, LP = cP.getLength();
  const nodeP0 = nodes.length;
  myelinate(cP, 0.02, LP - 0.07, 0.0055, 0.0115, 2, []);
  const nodeP1 = nodes.length;
  const COIL = [PP[PP.length - 1]];
  for (let i = 0; i <= 44; i++) { const u = i / 44, a = TAU * 5 * u; COIL.push(v3.add(SPA(0.13 + 0.08 * u), v3.add(v3.mul(SOD, 0.0115 * Math.cos(a)), v3.mul(SE, 0.0115 * Math.sin(a))))); }
  const axK = tubeR(COIL, 220, 5, 0.0026), cK = axK.userData.curve, LK = cK.getLength();
  neuB.add(axP, { color: TEAL, aSite: 2, aGC: sc(2, 0), aTwA: NOTW, aPT: (x, y, z, i) => 20 + ((1 - axP.attributes.aU.array[i]) * LP + LK) / vS });
  neuB.add(axK, { color: TEAL, aSite: 2, aGC: sc(2, 0), aTwA: NOTW, aPT: (x, y, z, i) => 20 + (1 - axK.attributes.aU.array[i]) * LK / vS });

  const TS1 = (LP + LK) / vS;   // the sensory impulse reaches the T (it bypasses the cell body)
  const CP = [TJ, [-1.105, -0.30, 0.0], [-1.13, -0.22, 0.0], [-1.152, -0.15, 0.0], [-1.15, -0.118, 0.0], [-1.10, -0.095, 0.004],
    [-1.03, -0.078, 0.008], [-0.965, -0.076, 0.012], [-0.93, -0.08, 0.014]];
  const axC = tubeR(CP, 90, 6, 0.0055), cC = axC.userData.curve, LC = cC.getLength();
  neuB.add(axC, { color: TEAL, aSite: x => (x < -1.14 ? 2 : 1), aGC: x => (x < -1.14 ? sc(2, 0) : sc(1, 1)), aTwA: NOTW, aPT: (x, y, z, i) => 20 + TS1 + axC.attributes.aU.array[i] * LC / vC });
  const nodeC0 = nodes.length;
  myelinate(cC, 0.025, 0.2, 0.0055, 0.0115, 2, []);
  const nodeC1 = nodes.length;
  somaB.add(sphere([-0.927, -0.081, 0.015], 0.0068, 10, 8), { color: TEAL, aSite: 1, aGC: sc(1, 1), aTwA: NOTW, aPT: 20 + TS1 + LC / vC });

  // glass: white matter of the cord, ganglion capsule, spinal nerve sheath (epineurium), fascicle sheath (perimysium), spindle capsule
  {
    const prof = [], rr = 0.16, hr = 0.035;
    prof.push(new THREE.Vector2(0.0001, -CHL));
    for (let i = 0; i <= 6; i++) { const a = -PI / 2 + i / 6 * PI / 2; prof.push(new THREE.Vector2(1 - rr + rr * Math.cos(a), -CHL + hr + hr * Math.sin(a))); }
    for (let i = 0; i <= 6; i++) { const a = i / 6 * PI / 2; prof.push(new THREE.Vector2(1 - rr + rr * Math.cos(a), CHL - hr + hr * Math.sin(a))); }
    prof.push(new THREE.Vector2(0.0001, CHL));
    const g = new THREE.LatheGeometry(prof, 48);
    g.rotateX(PI / 2); g.scale(CRX, CRY, 1); g.translate(CC[0], CC[1], CC[2]);
    glass.add(g, { color: [0.62, 0.78, 1.0], aSite: 1, aGC: sc(1, 2), aGA: 1 });
    glass.add(new THREE.SphereGeometry(1, 22, 16).scale(0.044, 0.062, 0.044).translate(SG[0], SG[1], SG[2]), { color: [0.55, 0.95, 0.95], aSite: 1, aGC: sc(1, 1), aGA: 1.2 });
    const NS = [[-0.79, -0.44, 0.004], [-0.70, -0.465, 0.014], [-0.58, -0.474, 0.034], [-0.45, -0.464, 0.064], [-0.33, -0.431, 0.116], [-0.235, -0.393, 0.205]];
    glass.add(tubeR(NS, 48, 20, u => 0.04 * (0.55 + 0.45 * Math.sqrt(smooth(Math.min(u, 1 - u) / 0.08)))), { color: [0.75, 0.85, 1.0], aSite: 2, aGC: sc(2, 0), aGA: 0.8 });
    const fs = new THREE.CylinderGeometry(0.199, 0.199, FX1 - FX0 + 0.02, 56, 1, true);
    fs.rotateZ(PI / 2); fs.translate((FX0 + FX1) / 2, FCN[1], FCN[2]);
    glass.add(fs, { color: [1.0, 0.7, 0.78], aSite: 4, aGC: sc(4, 0), aGA: 0.55 });
    glass.add(tubeR([SPA(0.02), SPA(0.17), SPA(0.32)], 30, 14, u => 0.0035 + 0.0145 * Math.pow(Math.sin(PI * u), 0.8)), { color: [0.7, 0.95, 1.0], aSite: 4, aGC: sc(4, 1), aGA: 1.1 });
  }

  // ------------------------------------------------------------------ the fascicle: 20 striated fibres
  const fib = [];
  {
    const add = (rho, a) => fib.push({ dy: Math.cos(a), dz: Math.sin(a), y: FCN[1] + rho * Math.cos(a), z: FCN[2] + rho * Math.sin(a),
      r: RF * (0.93 + 0.09 * R()), p1: R() * TAU, p2: R() * TAU, x1: FX1 + (R() - 0.5) * 0.03, outer: rho > 0.12 });
    add(0.004, 0.3);
    for (let k = 0; k < 7; k++) add(0.0807 + (R() - 0.5) * 0.004, k / 7 * TAU + 0.2);
    for (let k = 0; k < 12; k++) add(0.152 + (R() - 0.5) * 0.005, k / 12 * TAU + 0.05);
  }
  const fAx = (f, x) => [x, f.y + 0.003 * Math.sin(x * 7 + f.p1), f.z + 0.003 * Math.cos(x * 5 + f.p2)];
  const outerIdx = fib.map((f, i) => i).filter(i => fib[i].outer);
  const byDot = (d) => outerIdx.slice().sort((a, b) => (fib[b].dy * d[0] + fib[b].dz * d[1]) - (fib[a].dy * d[0] + fib[a].dz * d[1]));
  const IO = byDot(v3.norm([0.3, 0.95, 0]))[0];                 // the fibre that opens (front, a little up)
  fib[IO].x1 = 0.585;
  const JF = byDot([0.62, 0.78]).slice(0, 6);                     // the motor unit's fibres (upper front)
  const isJ = new Set(JF);
  fib.forEach((f, k) => {
    const pts = []; for (let i = 0; i <= 8; i++) pts.push(fAx(f, lerp(FX0, f.x1, i / 8)));
    const role = k === IO ? 1 : 0, tw = isJ.has(k) ? 1 : 0, col = v3.mul(K.rgb('#d65a6f'), 0.92 + 0.12 * R());
    const t = tubeR(pts, 22, 20, f.r);
    fibB.add(t, { color: col, aSite: 4, aGC: sc(4, k), aF: x => [x, 0, role], aTwA: (x, y, z, i) => [t.attributes.aAxis.array[i * 3], t.attributes.aAxis.array[i * 3 + 1], t.attributes.aAxis.array[i * 3 + 2], tw] });
    for (const end of [0, 1]) {
      const c = fAx(f, end ? f.x1 : FX0), cap = new THREE.CircleGeometry(f.r, 20).rotateY(end ? PI / 2 : -PI / 2).translate(c[0], c[1], c[2]);
      fibB.add(cap, { color: v3.mul(col, 0.85), aSite: 4, aGC: sc(4, k), aF: x => [x, 0, role && end ? 2 : role], aTwA: [c[0], c[1], c[2], tw] });
    }
  });
  // myofibrils of the opened fibre (hex packed, in register), protruding from its cut end; one ends in the sarcomere
  const FO = fib[IO], ODIR = v3.norm([0, FO.dy + 0.25, FO.dz + 0.7]);
  SU.uOpenDir.value.set(ODIR[0], ODIR[1], ODIR[2]);
  const MY = [];
  {
    const e2 = [0, 0, 1], e3 = [0, 1, 0];
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.abs(i + j) <= 2) MY.push([0.0125 * (i + j / 2), 0.0125 * j * Math.sqrt(3) / 2]);
    let hi = 0, best = -1;
    MY.forEach((m, k) => { const d = m[0] * ODIR[1] + m[1] * ODIR[2]; if (Math.hypot(m[0], m[1]) < 0.02 && d > best) { best = d; hi = k; } });
    MY.forEach((m, k) => {
      const x1 = k === hi ? 0.706 : 0.615 + R() * 0.06;
      const pts = []; for (let i = 0; i <= 6; i++) { const x = lerp(0.24, x1, i / 6), a = fAx(FO, x); pts.push([x, a[1] + m[0] * e3[1], a[2] + m[1] * e2[2]]); }
      const t = tubeR(pts, 16, 8, 0.0056), tw = isJ.has(IO) ? 1 : 0;
      const aT = (x, y, z, i) => [t.attributes.aAxis.array[i * 3], t.attributes.aAxis.array[i * 3 + 1], t.attributes.aAxis.array[i * 3 + 2], tw];
      fibB.add(t, { color: K.rgb('#ef7b8f'), aSite: 4, aGC: sc(4, IO), aF: x => [x, 0, 3], aTwA: aT });
      const c = pts[pts.length - 1];
      fibB.add(new THREE.CircleGeometry(0.0056, 10).rotateY(PI / 2).translate(c[0], c[1], c[2]), { color: K.rgb('#ef7b8f'), aSite: 4, aGC: sc(4, IO), aF: [c[0], 0, 3], aTwA: [c[0], c[1], c[2], tw] });
      if (k === hi) MY.hi = { y: c[1], z: c[2] };
    });
  }
  // intrafusal fibres of the spindle (thin, striated)
  for (const o of [-0.005, 0.005]) {
    const pts = [0.025, 0.17, 0.315].map(x => v3.add(SPA(x), v3.mul(SE, o)));
    fibB.add(tubeR(pts, 24, 8, u => 0.0045 * (0.6 + 0.4 * Math.sin(PI * u))), { color: K.rgb('#f08aa0'), aSite: 4, aGC: sc(4, 1), aF: x => [x, 2, 0], aTwA: NOTW });
  }

  // ------------------------------------------------------------------ the motor axon's terminal branches and junctions
  const JX = [0.0, 0.045, 0.09, 0.13, 0.17, 0.21];
  const JN = JF.map((fi, j) => {
    const f = fib[fi], n = v3.norm([0, f.dy, f.dz + 0.25]), t1 = [1, 0, 0], t2 = v3.cross(n, t1), x = JX[j] + (R() - 0.5) * 0.02;
    const A = fAx(f, x);
    // a point on the fibre surface: a along the fibre, b around it, h above the surface
    const J = (a, b, h) => { const ang = b / f.r, rd = v3.add(v3.mul(n, Math.cos(ang)), v3.mul(t2, Math.sin(ang))); return v3.add(v3.add(A, [a, 0, 0]), v3.mul(rd, f.r + h)); };
    return { fi, f, n, t2, A, J, x, rot: (R() - 0.5) * 0.8, flip: R() < 0.5 ? -1 : 1 };
  });
  const B0 = MP[MP.length - 1];
  // push a point out of the fascicle (radially from its axis) to at least radius rm
  const outside = (p, rm) => { const dy = p[1] - FCN[1], dz = p[2] - FCN[2], r = Math.hypot(dy, dz); return r >= rm ? p : [p[0], FCN[1] + dy / r * rm, FCN[2] + dz / r * rm]; };
  // pairs of junctions share a primary branch
  const BR = [];
  for (let k = 0; k < 3; k++) {
    const a = JN[2 * k], b = JN[2 * k + 1], qa = a.J(-0.03, 0, 0.012), qb = b.J(-0.03, 0, 0.012);
    const Pk = v3.add(v3.mul(v3.add(qa, qb), 0.5), v3.add(v3.mul(v3.norm(v3.add(a.n, b.n)), 0.035), [-0.025, 0, 0]));
    const pts = [B0, outside(v3.add(v3.lerp(B0, Pk, 0.5), [0, 0.01, 0.012]), 0.25), outside(Pk, 0.235)];
    const t = tubeR(pts, 30, 6, 0.0052), c = t.userData.curve, L = c.getLength();
    neuB.add(t, { color: GOLD, aSite: 3, aGC: sc(3, 0), aTwA: NOTW, aPT: (x, y, z, i) => 20 + TM0 + LM / vM + t.attributes.aU.array[i] * L / 2.2 });
    const n0 = nodes.length;
    if (L > 0.06) myelinate(c, 0.006, L - 0.008, 0.0052, 0.0098, 3, []);
    BR.push({ c, L, Pk: pts[2], n0, n1: nodes.length });
  }
  const plateB = new THREE.LatheGeometry([[0.0005, 0.0012], [0.010, 0.0014], [0.015, 0.0024], [0.0185, 0.0048], [0.0205, 0.0062], [0.0228, 0.0056],
    [0.0245, 0.003], [0.0255, -0.0012], [0.02, -0.003], [0.0005, -0.003]].map(p => new THREE.Vector2(p[0], p[1])), 28);
  JN.forEach((jn, j) => {
    const { J, n, f } = jn, axT = x => { const a = fAx(f, x); return [a[0], a[1], a[2], 1]; };
    // end plate: a shallow cup with junctional folds, wrapped onto the fibre
    const g = plateB.clone(), P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), rho = Math.hypot(x, z), ph = Math.atan2(z, x);
      const h = y + (rho < 0.016 && y > 0 ? 0.0007 * Math.cos(ph * 14) : 0);
      const p = J(x, z * 0.72, h); P.setXYZ(i, p[0], p[1], p[2]);
      const ang = z * 0.72 / f.r, nr = v3.add(v3.mul(n, Math.cos(ang)), v3.mul(jn.t2, Math.sin(ang))), tb = v3.cross([1, 0, 0], nr);
      const nn = v3.norm(v3.add(v3.add(v3.mul([1, 0, 0], N.getX(i)), v3.mul(nr, N.getY(i))), v3.mul(tb, -N.getZ(i))));
      N.setXYZ(i, nn[0], nn[1], nn[2]);
    }
    neuB.add(g, { color: PLATE, aSite: 3, aGC: sc(3, j), aTwA: x => axT(x) });
    // terminal: from the branch point to the edge of the cup, then branches over it (en plaque) with swellings
    const br = BR[j >> 1], q0 = J(-0.03, 0, 0.012), q1 = J(-0.02, 0, 0.0052);
    const qo = J(-0.045, 0, 0.03), tt = tubeR([br.Pk, outside(v3.lerp(br.Pk, qo, 0.5), 0.228), qo, q0, q1], 30, 6, 0.0038);
    jn.tpath = [br.Pk, outside(v3.lerp(br.Pk, qo, 0.5), 0.228), qo, q0, q1];
    const twW = (x, y, z) => { const a = fAx(f, x); return [a[0], a[1], a[2], clamp(1 - (Math.hypot(y - a[1], z - a[2]) - f.r) / 0.02, 0, 1)]; };
    const Lt = tt.userData.curve.getLength(), tb = TM0 + LM / vM + br.L / 2.2;
    neuB.add(tt, { color: GOLD, aSite: 3, aGC: sc(3, j), aTwA: twW, aPT: (x, y, z, i) => 20 + tb + tt.attributes.aU.array[i] * Lt / 1.4 });
    const cs = Math.cos(jn.rot), sn = Math.sin(jn.rot) * jn.flip, rot = (a, b) => [a * cs - b * sn, (a * sn + b * cs) * jn.flip];
    const lobes = [[[-0.02, 0], [-0.008, 0.004], [0.004, 0.009], [0.013, 0.006]], [[-0.02, 0], [-0.006, -0.004], [0.008, -0.007], [0.017, -0.002]], [[-0.008, 0.004], [-0.002, -0.0005], [0.006, 0.0005]]];
    for (const lb of lobes) {
      const pts = lb.map(([a, b]) => { const r = rot(a + 0.02, b); return J(r[0] - 0.02, r[1], 0.0048); });
      somaB.add(tubeR(pts, 12, 8, u => 0.0031 * (1 + 0.22 * Math.sin(PI * u * 3))), { color: GOLD, aSite: 3, aGC: sc(3, j), aTwA: x => axT(x), aPT: 20 + tb + Lt / 1.4 });
      const e = pts[pts.length - 1];
      somaB.add(sphere(e, 0.0041, 10, 8), { color: GOLD, aSite: 3, aGC: sc(3, j), aTwA: axT(e[0]), aPT: 20 + tb + Lt / 1.4 });
      jn.lobes = (jn.lobes || []).concat([lb.map(([a, b]) => rot(a + 0.02, b))]);
    }
    ring(J(0.002, 0, 0.004), n, 0.032, 0.0018, sc(3, j), 3, 0.35, 48);
  });

  // ------------------------------------------------------------------ impulses, vesicles, transmitter (points)
  const TM1 = TM0 + LM / vM;
  const PCM = [1, 0.85, 0.45], PCS = [0.55, 0.95, 1];
  const nearNode = (s, list) => list.some(q => Math.abs(q - s) < NG * 0.7);
  const nodeS = (a, b) => nodes.slice(a, b).map(q => q.s);
  {
    const nm = nodeS(nodeM0, nodeM1);
    for (const { p, s } of sampleCurve(cM, 0.006)) pt(p, PCM, 0.03, nearNode(s, nm) ? 1 : 0.4, [0, TM0 + s / vM, p[0] < -0.83 ? 1 : 2]);
    for (const q of nm) pt(cM.getPointAt(q / LM).toArray(), PCM, 0.085, 1, [0, TM0 + q / vM, 2]);
    pt(MS, PCM, 0.11, 0.7, [0, TM0 - 0.01, 1]);
    const ns = nodeS(nodeP0, nodeP1);
    for (const { p, s } of sampleCurve(cK, 0.006)) pt(p, PCS, 0.018, 0.6, [0, (LK - s) / vS, 2]);
    for (const { p, s } of sampleCurve(cP, 0.006)) pt(p, PCS, 0.026, nearNode(s, ns) ? 1 : 0.4, [0, (LP - s + LK) / vS, 2]);
    for (const q of ns) pt(cP.getPointAt(q / LP).toArray(), PCS, 0.075, 1, [0, (LP - q + LK) / vS, 2]);
    const nc = nodeS(nodeC0, nodeC1);
    for (const { p, s } of sampleCurve(cC, 0.006)) pt(p, PCS, 0.024, nearNode(s, nc) ? 1 : 0.4, [0, TS1 + s / vC, p[0] < -1.14 ? 2 : 1]);
    JN.forEach((jn, j) => {
      const br = BR[j >> 1], tb = TM1 + br.L / 2.2;
      if (j % 2 === 0) for (const { p, s } of sampleCurve(br.c, 0.006)) pt(p, PCM, 0.014, 0.5, [0, TM1 + s / 2.2, 3]);
      const tc = new THREE.CatmullRomCurve3(jn.tpath.map(V)), Lt = tc.getLength();
      for (const { p, s } of sampleCurve(tc, 0.006)) pt(p, PCM, 0.008, 0.45, [0, tb + s / 1.4, 3]);
      jn.time = tb + Lt / 1.4;
      // vesicles in the swellings, near the membrane that faces the muscle; transmitter in the cleft
      for (const lb of jn.lobes) for (let k = 0; k < 11; k++) {
        const u = R() * (lb.length - 1), i0 = Math.floor(u), f = u - i0, a = lerp(lb[i0][0], lb[Math.min(i0 + 1, lb.length - 1)][0], f), b = lerp(lb[i0][1], lb[Math.min(i0 + 1, lb.length - 1)][1], f);
        pt(jn.J(a - 0.02 + (R() - 0.5) * 0.003, b + (R() - 0.5) * 0.003, 0.0036 + (R() - 0.5) * 0.0016), [1, 0.95, 0.78], 0.0021, 0.9, [1, jn.time + 0.015, 3]);
        if (k < 7) pt(jn.J(a - 0.02 + (R() - 0.5) * 0.005, b + (R() - 0.5) * 0.005, 0.0016), [0.7, 1, 0.8], 0.0017, 0.9, [2, jn.time + 0.03, 3]);
      }
    });
  }
  const TJm = JN.reduce((s, j) => s + j.time, 0) / JN.length;

  // ------------------------------------------------------------------ disease halos and rings
  {
    for (let i = 0; i < ncol(1); i++) {
      const a = i / ncol(1) * TAU;
      pt(v3.add(MS, [0.02 * Math.cos(a), 0.02 * Math.sin(a), 0.03]), sc(1, i), 0.2, 0.32, [3, 0, 1]);
      ring(MS, [[0.3, 1, 0.4], [1, -0.2, 0.6], [-0.5, 0.4, 1]][i % 3], 0.052 + 0.009 * i, 0.003, sc(1, i), 1, 0.25 + 0.08 * i);
    }
    ring(SG, [0, 1, 0], 0.056, 0.003, sc(1, 1), 1, 0.3);
    pt(SG, sc(1, 1), 0.15, 0.3, [3, 0, 1]);
    const NSc = new THREE.CatmullRomCurve3([[-0.79, -0.44, 0.004], [-0.58, -0.474, 0.034], [-0.33, -0.431, 0.116], [-0.235, -0.393, 0.205]].map(V));
    for (let i = 0; i < 3; i++) {
      const u = 0.2 + 0.28 * i, p = NSc.getPointAt(u).toArray(), tg = NSc.getTangentAt(u).toArray();
      ring(p, tg, 0.05, 0.0035, sc(2, i), 2, 0.45);
      if (i < ncol(2) || i === 1) pt(p, sc(2, i), 0.22, 0.28, [3, 0, 2]);
    }
    const jc = v3.mul(JN.reduce((s, j) => v3.add(s, j.J(0, 0, 0.03)), [0, 0, 0]), 1 / JN.length);
    for (let i = 0; i < ncol(3); i++) pt(v3.add(jc, [0.03 * i, 0, 0.02]), sc(3, i), 0.2, 0.3, [3, 0, 3]);
    const nmu = ncol(4);
    for (let i = 0; i < nmu; i++) {
      const x = lerp(FX0 + 0.05, FX1 - 0.05, nmu > 1 ? i / (nmu - 1) : 0.5);
      ring([x, FCN[1], FCN[2]], [1, 0, 0], 0.214, 0.0042, sc(4, i), 4, 0.15 + 0.05 * (i % 3));
      pt([x, FCN[1] + 0.13, FCN[2] + 0.17], sc(4, i), 0.15, 0.22, [3, 0, 4]);
    }
    for (let i = 0; i < Math.max(2, ncol(5)); i++) ring(HC, [[0.2, 1, 0.25], [-0.25, 1, -0.1]][i % 2], 0.31 + 0.035 * i, 0.005, sc(5, i), 5, 0.2 + 0.1 * i, 96);
    for (let i = 0; i < ncol(5); i++) pt(v3.add(HC, [0, 0.03 * i, 0]), sc(5, i), 0.6, 0.25, [3, 0, 5]);
    pt(HC, [1, 0.45, 0.8], 0.9, 0.8, [4, 0, 5]);   // the glow the heart appears from
  }

  // ------------------------------------------------------------------ the heart
  // One smooth surface: a signed distance field, polygonised by surface nets, so the ventricles, atria, auricles and
  // great vessels merge with soft grooves instead of meeting as separate shapes. The coronary vessels are tubes laid
  // into those grooves; a window cut into the right ventricle's front wall shows branched, striated heart muscle
  // cells lying on its floor. Local frame: x the patient's left, y up, z forward. The field is defined here; the
  // heavy part (polygonising, the coronaries) is a job run in short slices between frames (heartStep), while the set
  // is hidden or the heart not yet wanted, and in longer ones once it is; the heart fades in when it is ready.
  const hg = new THREE.Group(); hg.position.set(HC[0], HC[1], HC[2]);
  const heartB = Builder(Object.assign({ aM: 3 }, LITS)), hfB = Builder(Object.assign({ aF: 3 }, LITT));
  const V0 = [0, -0.03, 0], AX = v3.norm([0.42, -0.85, 0.32]);    // the ventricles' centre of the beat, and their axis (base to apex)
  const E1 = v3.norm(v3.sub([0, 0, 1], v3.mul(AX, AX[2]))), EL = v3.cross(E1, AX);   // across the axis: forward, and to the left
  const vp = (t, f, l) => [0, 1, 2].map(c => V0[c] + AX[c] * t + E1[c] * f + EL[c] * l);
  const MYO = K.rgb('#8f2430'), ATR = K.rgb('#86283f'), AOR = K.rgb('#d0404a'), PUL = K.rgb('#5a5fd4'), VEN = K.rgb('#4a66d8'), PVN = K.rgb('#b3334a');
  const H5 = { aSite: 5, aGC: sc(5, 0) };
  // primitives: k 0 a cone with round ends (from a to b, radii r1 to r2), 1 an ellipsoid (centre c, axes u v w,
  // radii r); g the tissue for the beat (0 ventricles, 1 atria, 2 vessels), col its colour, cuts its open ends
  const HP = [];
  const rcone = (a, b, r1, r2, g, col) => { const ba = v3.sub(b, a), l2 = v3.dot(ba, ba), rr = r1 - r2;
    HP.push({ k: 0, a, b, ba, r1, r2, l2, rr, a2: l2 - rr * rr, il2: 1 / l2, g, col, cuts: null }); return HP.length - 1; };
  const ellip = (c, u, v, r, g, col) => { u = v3.norm(u); const w = v3.norm(v3.cross(u, v)); v = v3.cross(w, u);
    HP.push({ k: 1, c, u, v, w, r, g, col, cuts: null }); return HP.length - 1; };
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  function hd(q, x, y, z) {
    let d;
    if (q.k === 0) {   // round cone (after Inigo Quilez)
      const px = x - q.a[0], py = y - q.a[1], pz = z - q.a[2], b = q.ba, l2 = q.l2, yy = px * b[0] + py * b[1] + pz * b[2], zz = yy - l2;
      const qx = px * l2 - b[0] * yy, qy = py * l2 - b[1] * yy, qz = pz * l2 - b[2] * yy, x2 = qx * qx + qy * qy + qz * qz;
      const kk = Math.sign(q.rr) * q.rr * q.rr * x2;
      if (Math.sign(zz) * q.a2 * zz * zz * l2 > kk) d = Math.sqrt(x2 + zz * zz * l2) * q.il2 - q.r2;
      else if (Math.sign(yy) * q.a2 * yy * yy * l2 < kk) d = Math.sqrt(x2 + yy * yy * l2) * q.il2 - q.r1;
      else d = (Math.sqrt(x2 * q.a2 * q.il2) + yy * q.rr) * q.il2 - q.r1;
    } else {           // ellipsoid (a close bound)
      const px = x - q.c[0], py = y - q.c[1], pz = z - q.c[2], r = q.r;
      const a = (px * q.u[0] + py * q.u[1] + pz * q.u[2]) / r[0], b = (px * q.v[0] + py * q.v[1] + pz * q.v[2]) / r[1], c = (px * q.w[0] + py * q.w[1] + pz * q.w[2]) / r[2];
      const k0 = Math.sqrt(a * a + b * b + c * c), k1 = Math.sqrt(a * a / (r[0] * r[0]) + b * b / (r[1] * r[1]) + c * c / (r[2] * r[2]));
      d = k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(r[0], r[1], r[2]);
    }
    if (q.cuts) for (const c of q.cuts) {   // a flat open end (the plane through e across the vessel) with its lumen, rims a little rounded
      d = smax(d, (x - c.e[0]) * c.n[0] + (y - c.e[1]) * c.n[1] + (z - c.e[2]) * c.n[2], 0.004);
      if (c.rl) {
        const px = x - c.l0[0], py = y - c.l0[1], pz = z - c.l0[2], s = clamp((px * c.n[0] + py * c.n[1] + pz * c.n[2]) / c.ll, 0, 1) * c.ll;
        d = smax(d, c.rl - Math.hypot(px - c.n[0] * s, py - c.n[1] * s, pz - c.n[2] * s), 0.004);
      }
    }
    return d;
  }
  const VES = [];
  // a vessel through control points [x, y, z, r], sampled into round cones; kj how softly it joins what it meets,
  // open lists its cut ends (0 start, 1 end); the wider ones show their lumen
  function vessel(ctrl, col, kj, open) {
    const cv = new THREE.CatmullRomCurve3(ctrl.map(q => V(q)), false, 'centripetal'), m = ctrl.length - 1;
    const at = t => { const s = t * m, j = Math.min(m - 1, Math.floor(s)); return [cv.getPoint(t).toArray(), lerp(ctrl[j][3], ctrl[j + 1][3], s - j)]; };
    const n = Math.max(2, Math.ceil(cv.getLength() / 0.03)), i0 = HP.length, ends = [];
    for (let i = 0; i < n; i++) { const [a, r1] = at(i / n), [b, r2] = at((i + 1) / n); rcone(a, b, r1, r2, 2, col); }
    for (const e of open || []) {
      const [p, r] = at(e), tn = v3.norm(v3.sub(p, at(e ? 1 - 0.5 / n : 0.5 / n)[0]));   // outward along the vessel
      const c = { e: p, n: tn, r };
      if (r >= 0.022) Object.assign(c, { l0: v3.sub(p, v3.mul(tn, 1.3 * r)), ll: 2.3 * r, rl: 0.64 * r });
      ends.push(c);
      // cutting the cones near the end is enough (the cut distributes over the vessel's minimum)
      for (let i = i0; i < HP.length; i++) { const q = HP[i]; if (Math.min(v3.dist(q.a, p), v3.dist(q.b, p)) < 1.6 * r + 0.03) (q.cuts = q.cuts || []).push(c); }
    }
    // a bounding sphere, so blocks far from the vessel skip its cones
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], rm = 0;
    for (let i = i0; i < HP.length; i++) for (const p of [HP[i].a, HP[i].b]) { lo = lo.map((v, c) => Math.min(v, p[c])); hi = hi.map((v, c) => Math.max(v, p[c])); rm = Math.max(rm, HP[i].r1, HP[i].r2); }
    VES.push({ i0, i1: HP.length, k: kj, ends, col, bc: v3.lerp(lo, hi, 0.5), br: v3.dist(lo, hi) / 2 + rm });
  }
  // the ventricles: the left a blunt cone ending in the apex, rounded at its left border; the right wrapped round its
  // front (where they meet, the interventricular grooves); a plane across the axis is their base, on which the
  // atria sit; the right ventricle's outflow tract rises to the pulmonary valve
  const TB = -0.068;
  const LV = rcone(vp(-0.05, -0.03, 0.035), vp(0.205, -0.01, 0.02), 0.11, 0.032, 0, MYO);
  const LVB = ellip(vp(0.05, -0.02, 0.045), AX, E1, [0.12, 0.085, 0.095], 0, MYO);
  const RV = ellip(vp(0.035, 0.068, -0.04), AX, E1, [0.15, 0.072, 0.105], 0, MYO);
  const CON = rcone(vp(-0.02, 0.075, 0.015), [0.03, 0.125, 0.07], 0.055, 0.036, 0, MYO);
  // the atria: the right between the venae cavae, the left at the back; each with its auricle, a flat curved flap
  // (flattened ellipsoids), the right one over the aortic root, the left beside the pulmonary trunk
  const RA = ellip([-0.125, 0.065, -0.03], [0.1, 1, 0.1], [1, 0, 0], [0.08, 0.062, 0.066], 1, ATR);
  const LAT = ellip([0.025, 0.095, -0.115], [1, 0, 0], [0, 1, 0], [0.095, 0.055, 0.055], 1, ATR);
  const RAU = [ellip([-0.095, 0.105, 0.04], [0.7, 0.2, 0.68], [0, 1, 0], [0.048, 0.036, 0.014], 1, ATR),
    ellip([-0.055, 0.115, 0.072], [0.88, 0.12, 0.45], [0, 1, 0], [0.032, 0.026, 0.011], 1, ATR),
    ellip([-0.028, 0.12, 0.085], [1, 0.05, 0.25], [0, 1, 0], [0.018, 0.014, 0.008], 1, ATR)];
  const LAU = [ellip([0.11, 0.115, -0.035], [0.15, 0.05, 1], [0, 1, 0], [0.048, 0.03, 0.02], 1, ATR),
    ellip([0.105, 0.112, 0.01], [-0.25, -0.05, 1], [0, 1, 0], [0.042, 0.026, 0.017], 1, ATR),
    ellip([0.085, 0.105, 0.045], [-0.6, -0.15, 0.78], [0, 1, 0], [0.03, 0.02, 0.013], 1, ATR)];
  const BODY = [LV, LVB, RV, CON, RA, LAT, ...RAU, ...LAU], NBD = HP.length;
  // aorta (ascending, arch, descending) and the arch's three branches; pulmonary trunk and arteries (the right one
  // passes behind the aorta and the superior vena cava); venae cavae; four pulmonary veins into the left atrium
  vessel([[-0.005, 0.06, -0.02, 0.037], [-0.012, 0.13, 0, 0.04], [-0.022, 0.19, 0.01, 0.035], [-0.012, 0.245, 0, 0.034], [0.025, 0.28, -0.035, 0.032],
    [0.075, 0.28, -0.09, 0.03], [0.1, 0.24, -0.15, 0.028], [0.108, 0.15, -0.2, 0.027], [0.105, 0.04, -0.215, 0.026], [0.1, -0.07, -0.215, 0.026]], AOR, 0.014, [1]);
  vessel([[0, 0.275, -0.02, 0.015], [-0.018, 0.33, -0.02, 0.0145], [-0.04, 0.38, -0.015, 0.0135]], AOR, 0.008, [1]);
  vessel([[0.038, 0.29, -0.05, 0.0095], [0.042, 0.34, -0.055, 0.0092], [0.046, 0.385, -0.055, 0.009]], AOR, 0.007, [1]);
  vessel([[0.07, 0.285, -0.085, 0.0108], [0.09, 0.33, -0.095, 0.0105], [0.115, 0.37, -0.1, 0.0102]], AOR, 0.007, [1]);
  vessel([[0.025, 0.105, 0.065, 0.034], [0.04, 0.155, 0.055, 0.033], [0.05, 0.19, 0.02, 0.031], [0.045, 0.2, -0.03, 0.028]], PUL, 0.012);
  vessel([[0.045, 0.2, -0.03, 0.024], [0.08, 0.212, -0.06, 0.022], [0.108, 0.205, -0.095, 0.02], [0.135, 0.19, -0.115, 0.019]], PUL, 0.01, [1]);
  vessel([[0.045, 0.2, -0.03, 0.024], [0, 0.192, -0.07, 0.022], [-0.06, 0.185, -0.085, 0.021], [-0.115, 0.172, -0.1, 0.019]], PUL, 0.01, [1]);
  vessel([[-0.105, 0.36, -0.015, 0.026], [-0.11, 0.28, -0.012, 0.027], [-0.12, 0.2, -0.02, 0.028], [-0.125, 0.12, -0.025, 0.029]], VEN, 0.016, [0]);
  vessel([[-0.125, 0.02, -0.06, 0.028], [-0.12, -0.05, -0.085, 0.028], [-0.115, -0.13, -0.1, 0.027]], VEN, 0.016, [1]);
  for (const [x0, s, y] of [[-0.02, -1, 0.13], [-0.02, -1, 0.075], [0.09, 1, 0.13], [0.09, 1, 0.075]])
    vessel([[x0, y, -0.13, 0.013], [x0 + s * 0.045, y + 0.003, -0.155, 0.0122], [x0 + s * 0.085, y + 0.006, -0.185, 0.011]], PVN, 0.01, [1]);
  const NP = HP.length, HDS = new Float64Array(NP), HDV = new Float64Array(VES.length);
  const ALL = { b: BODY, v: VES.map((q, j) => [j, [...Array(q.i1 - q.i0).keys()].map(i => q.i0 + i)]) };
  let WIN = null;   // the window, once placed: centre c on the surface, normal n, radius r, depth dep
  const winD = (x, y, z) => { const W = WIN, px = x - W.c[0], py = y - W.c[1], pz = z - W.c[2], s = px * W.n[0] + py * W.n[1] + pz * W.n[2];
    const dr = Math.sqrt(Math.max(0, px * px + py * py + pz * pz - s * s)) - W.r, da = -W.dep - s;
    return Math.hypot(Math.max(dr, 0), Math.max(da, 0)) + Math.min(Math.max(dr, da), 0); };
  const baseD = (x, y, z) => TB - ((x - V0[0]) * AX[0] + (y - V0[1]) * AX[1] + (z - V0[2]) * AX[2]);
  // the field at a point, from the primitives in act ({ b: body ids, v: [vessel, its cones], w: the window matters };
  // the rest are too far to matter); fills HDS (body) and HDV (vessels), and out (if given) with the ventricles and
  // atria alone
  function field(x, y, z, act, out) {
    for (let i = 0; i < NBD; i++) HDS[i] = 1e9;
    for (let j = 0; j < act.b.length; j++) { const i = act.b[j]; HDS[i] = hd(HP[i], x, y, z); }
    // the groove between the ventricles fades out towards the apex, so the apex is one rounded tip
    const kv = 0.03 + 0.07 * clamp((TB - baseD(x, y, z) - 0.08) / 0.09, 0, 1);
    const v0 = smin(smax(smin(smin(HDS[LV], HDS[LVB], 0.05), HDS[RV], kv), baseD(x, y, z), 0.05), HDS[CON], 0.035);
    const v = WIN && act.w !== false ? smax(v0, -winD(x, y, z), 0.007) : v0;   // the window cuts the ventricles only
    const ra = smin(smin(smin(HDS[RAU[0]], HDS[RAU[1]], 0.025), HDS[RAU[2]], 0.012), HDS[RA], 0.03);
    const la = smin(smin(smin(HDS[LAU[0]], HDS[LAU[1]], 0.02), HDS[LAU[2]], 0.015), HDS[LAT], 0.022);
    const a = smin(ra, la, 0.03);
    let f = smin(v, a, 0.02);
    if (out) { out.v = v0; out.a = a; }
    HDV.fill(1e9);
    for (let j = 0; j < act.v.length; j++) {
      const vi = act.v[j][0], segs = act.v[j][1]; let m = 1e9;
      for (let s = 0; s < segs.length; s++) { const d = hd(HP[segs[s]], x, y, z); if (d < m) m = d; }
      HDV[vi] = m; f = smin(f, m, VES[vi].k);
    }
    return f;
  }
  // the gradient (tetrahedral differences) of f(x, y, z), not normalised; a Newton step onto f = 0
  const grad = (f, p, e = 0.0012) => { const a = f(p[0] + e, p[1] - e, p[2] - e), b = f(p[0] - e, p[1] - e, p[2] + e), c = f(p[0] - e, p[1] + e, p[2] - e), d = f(p[0] + e, p[1] + e, p[2] + e);
    return [(a - b - c + d) / (4 * e), (-a - b + c + d) / (4 * e), (-a + b - c + d) / (4 * e)]; };
  const newton = (f, p, lim = 0.02) => { const d = f(p[0], p[1], p[2]), g = grad(f, p), l2 = v3.dot(g, g) || 1, s = clamp(d / l2, -lim, lim); return v3.sub(p, v3.mul(g, s)); };
  // the window: on the right ventricle's front, its axis along the surface normal there
  {
    const fAll = (x, y, z) => field(x, y, z, ALL);
    let p = vp(0.06, 0.2, -0.035);
    for (let it = 0; it < 10; it++) p = newton(fAll, p);
    WIN = { c: p, n: v3.norm(grad(fAll, p)), r: 0.05, dep: 0.03 };
  }
  // a vertex's colour and tissue weights for the beat ([r, g, b, ventricles, atria]), from the distances field()
  // left in HDS and HDV: a soft blend of the nearest parts, cut ends with a dark lumen, the window's walls and floor,
  // and a faint mottle
  function heartVertex(p, act, out) {
    const x = p[0], y = p[1], z = p[2], bd = baseD(x, y, z), cand = [];
    for (const i of act.b) cand.push([i === LV || i === LVB || i === RV ? Math.max(HDS[i], bd) : HDS[i], HP[i]]);
    for (const [vi] of act.v) cand.push([HDV[vi] - 0.005, HP[VES[vi].i0]]);   // vessels win where they meet the body
    let dm = 1e9; for (const c of cand) dm = Math.min(dm, c[0]);
    let sw = 0; const col = [0, 0, 0], wt = [0, 0, 0];
    for (const [d, q] of cand) { const w = Math.exp(-(d - dm) / 0.0018); if (w < 1e-4) continue; sw += w; wt[q.g] += w; for (let c = 0; c < 3; c++) col[c] += q.col[c] * w; }
    for (let c = 0; c < 3; c++) { col[c] /= sw; wt[c] /= sw; }
    let k = 1 + 0.07 * Math.sin(71 * x + 1.3) * Math.sin(63 * y + 0.7) * Math.sin(57 * z + 2.1) + 0.04 * Math.sin(173 * x + 2 * y) * Math.sin(151 * z - 3 * y);
    for (const [vi] of act.v) for (const e of VES[vi].ends) {
      const px = x - e.e[0], py = y - e.e[1], pz = z - e.e[2], s = px * e.n[0] + py * e.n[1] + pz * e.n[2];
      if (s < -1.5 * e.r - 0.005 || s > 0.006) continue;
      const rho = Math.sqrt(Math.max(0, px * px + py * py + pz * pz - s * s));
      if (e.rl && rho < e.rl + 0.003) k = 0.22;                                                    // inside the lumen
      else if (s > -0.003 && rho < e.r + 0.003) k = e.rl ? 1.25 : rho < 0.6 * e.r ? 0.25 : 1.25;   // the cut face
    }
    if (WIN && act.w !== false && Math.abs(winD(x, y, z)) < 0.005 && out.v < -0.0015) {   // the window's walls (cut muscle) and floor
      const s = v3.dot(v3.sub(p, WIN.c), WIN.n);
      if (s < -WIN.dep + 0.003) col.splice(0, 3, 0.2, 0.025, 0.05); else col.splice(0, 3, 0.66, 0.2, 0.26);
      wt[0] = 1; wt[1] = wt[2] = 0;
    }
    return [col[0] * k, col[1] * k, col[2] * k, wt[0], wt[1]];
  }
  let HAT = () => ALL, HSURF = null;   // the primitives that matter near a point (once polygonised); the surface's geometry
  // polygonise: blocks of 4 cells are classified from their centres (outside, inside, or near the surface with the
  // primitives that can matter there), and only blocks near the surface are sampled; then surface nets, each vertex
  // pulled onto the surface, with the field's gradient as its normal, darkened in the grooves
  const HJ = { until: 0 }, late = () => performance.now() > HJ.until;
  function* polygonise() {
    const h = 0.0065, lo = [-0.24, -0.275, -0.265], hi = [0.245, 0.46, 0.175], BS = 4;
    const nx = Math.ceil((hi[0] - lo[0]) / h) + 1, ny = Math.ceil((hi[1] - lo[1]) / h) + 1, nz = Math.ceil((hi[2] - lo[2]) / h) + 1;
    const F = new Float32Array(nx * ny * nz).fill(1), done = new Uint8Array(nx * ny * nz), id = (i, j, k) => (i * ny + j) * nz + k;
    const bx = Math.ceil((nx - 1) / BS), by = Math.ceil((ny - 1) / BS), bz = Math.ceil((nz - 1) / BS), bid = (i, j, k) => (i * by + j) * bz + k;
    const ACT = new Array(bx * by * bz).fill(null), rb = Math.sqrt(3) * BS * h / 2, dc = new Float64Array(NP), hot = [];
    for (let I = 0; I < bx; I++) for (let J = 0; J < by; J++) {
      for (let L = 0; L < bz; L++) {
        if (late()) yield;
        const cx = lo[0] + (I + 0.5) * BS * h, cy = lo[1] + (J + 0.5) * BS * h, cz = lo[2] + (L + 0.5) * BS * h, bd = baseD(cx, cy, cz);
        let low = 1e9, up = 1e9;
        for (let j = 0; j < NBD; j++) {
          const d = dc[j] = hd(HP[j], cx, cy, cz); if (d < low) low = d;
          const u = j === LV || j === LVB || j === RV ? Math.max(d, bd) + 0.013 : d; if (u < up) up = u;   // the base cuts the ventricles
        }
        const near = [];
        for (let j = 0; j < VES.length; j++) {
          const q = VES[j], c = q.bc; if (Math.hypot(cx - c[0], cy - c[1], cz - c[2]) - q.br - rb > up + rb + q.k) continue;
          for (let i = q.i0; i < q.i1; i++) { const d = dc[i] = hd(HP[i], cx, cy, cz); if (d < low) low = d; if (d < up) up = d; }
          near.push(j);
        }
        if (low - rb > 0.045) continue;   // outside, beyond what any blend can pull in
        const lim = up + rb, act = { b: BODY.filter(i => dc[i] - rb <= lim + 0.05), v: [], w: winD(cx, cy, cz) < rb + 0.01 };
        for (const j of near) { const q = VES[j], segs = []; for (let i = q.i0; i < q.i1; i++) if (dc[i] - rb <= lim + q.k) segs.push(i); if (segs.length) act.v.push([j, segs]); }
        // the field changes no faster than the distance (a little faster near flat ellipsoids): no surface in the
        // block unless its centre is within reach
        const fc = field(cx, cy, cz, act);
        if (fc > 1.5 * rb) continue;
        const i1 = Math.min(I * BS + BS, nx - 1), j1 = Math.min(J * BS + BS, ny - 1), k1 = Math.min(L * BS + BS, nz - 1);
        if (fc < -1.5 * rb) {   // inside: mark what no sampled block has written
          for (let i = I * BS; i <= i1; i++) for (let j = J * BS; j <= j1; j++) for (let k = L * BS; k <= k1; k++) if (F[id(i, j, k)] === 1) F[id(i, j, k)] = -1;
          continue;
        }
        ACT[bid(I, J, L)] = act; hot.push([I, J, L]);
        for (let i = I * BS; i <= i1; i++) for (let j = J * BS; j <= j1; j++) for (let k = L * BS; k <= k1; k++) {
          const q = id(i, j, k); if (!done[q]) { F[q] = field(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h, act); done[q] = 1; }
        }
      }
    }
    HAT = p => { const I = Math.floor((p[0] - lo[0]) / (BS * h)), J = Math.floor((p[1] - lo[1]) / (BS * h)), L = Math.floor((p[2] - lo[2]) / (BS * h));
      return (I < 0 || J < 0 || L < 0 || I >= bx || J >= by || L >= bz ? null : ACT[bid(I, J, L)]) || ALL; };
    const gridAt = (x, y, z, open) => {   // trilinear, from sampled values only (outside the sampled shell: open, inside: shut)
      const u = (x - lo[0]) / h, v = (y - lo[1]) / h, w = (z - lo[2]) / h, i = Math.floor(u), j = Math.floor(v), k = Math.floor(w);
      if (i < 0 || j < 0 || k < 0 || i >= nx - 1 || j >= ny - 1 || k >= nz - 1) return open;
      const a = u - i, b = v - j, c = w - k; let s = 0;
      for (let q = 0; q < 8; q++) { const val = F[id(i + (q & 1), j + (q >> 1 & 1), k + (q >> 2 & 1))]; if (val === 1) return open; if (val === -1) return -0.01; s += val * (q & 1 ? a : 1 - a) * (q & 2 ? b : 1 - b) * (q & 4 ? c : 1 - c); }
      return s;
    };
    const ny1 = ny - 1, nz1 = nz - 1, VI = new Int32Array((nx - 1) * ny1 * nz1).fill(-1), cid = (i, j, k) => (i * ny1 + j) * nz1 + k;
    const P = [], N = [], C = [], M = [], out = {}, cv = new Float64Array(8);
    const EG = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (let b = 0; b < hot.length; b++) {
      if (late()) yield;
      const [I, J, L] = hot[b], act = ACT[bid(I, J, L)], f = (x, y, z) => field(x, y, z, act);
      for (let i = I * BS; i < Math.min(I * BS + BS, nx - 1); i++) for (let j = J * BS; j < Math.min(J * BS + BS, ny - 1); j++) for (let k = L * BS; k < Math.min(L * BS + BS, nz - 1); k++) {
        let neg = 0;
        for (let c = 0; c < 8; c++) { cv[c] = F[id(i + (c & 1), j + (c >> 1 & 1), k + (c >> 2 & 1))]; if (cv[c] < 0) neg++; }
        if (neg === 0 || neg === 8) continue;
        let sx = 0, sy = 0, sz = 0, ne = 0;
        for (const [a, b] of EG) {
          if ((cv[a] < 0) === (cv[b] < 0)) continue;
          const t = cv[a] / (cv[a] - cv[b]);
          sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += (a >> 1 & 1) + ((b >> 1 & 1) - (a >> 1 & 1)) * t; sz += (a >> 2 & 1) + ((b >> 2 & 1) - (a >> 2 & 1)) * t; ne++;
        }
        const p0 = [lo[0] + (i + sx / ne) * h, lo[1] + (j + sy / ne) * h, lo[2] + (k + sz / ne) * h];
        const d = field(p0[0], p0[1], p0[2], act, out), col = heartVertex(p0, act, out);
        const g = grad(f, p0), l2 = v3.dot(g, g) || 1, p = v3.sub(p0, v3.mul(g, clamp(d / l2, -h, h))), n = v3.norm(g);
        let occ = 0, w0 = 1;   // occlusion: how far the field stays below the distance along the normal
        for (let s = 1; s <= 3; s++) { const dd = 0.013 * s; occ += Math.max(0, dd - gridAt(p[0] + n[0] * dd, p[1] + n[1] * dd, p[2] + n[2] * dd, dd)) * w0; w0 *= 0.6; }
        const ko = clamp(1 - 10 * occ, 0.4, 1);
        VI[cid(i, j, k)] = P.length / 3; P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); C.push(col[0] * ko, col[1] * ko, col[2] * ko); M.push(col[3], col[4], 0);
      }
    }
    // faces: one quad round every grid edge the surface crosses, wound to face out
    const I3 = [];
    const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) I3.push(a, c, b, a, d, c); else I3.push(a, b, c, a, c, d); };
    for (let b = 0; b < hot.length; b++) {
      if (late()) yield;
      const [I, J, L] = hot[b];
      for (let i = I * BS; i < Math.min(I * BS + BS, nx - 1); i++) for (let j = J * BS; j < Math.min(J * BS + BS, ny - 1); j++) for (let k = L * BS; k < Math.min(L * BS + BS, nz - 1); k++) {
      const v0 = F[id(i, j, k)] < 0;
      if (j > 0 && k > 0 && v0 !== F[id(i + 1, j, k)] < 0) quad(VI[cid(i, j - 1, k - 1)], VI[cid(i, j, k - 1)], VI[cid(i, j, k)], VI[cid(i, j - 1, k)], !v0);
      if (i > 0 && k > 0 && v0 !== F[id(i, j + 1, k)] < 0) quad(VI[cid(i - 1, j, k - 1)], VI[cid(i - 1, j, k)], VI[cid(i, j, k)], VI[cid(i, j, k - 1)], !v0);
      if (i > 0 && j > 0 && v0 !== F[id(i, j, k + 1)] < 0) quad(VI[cid(i - 1, j - 1, k)], VI[cid(i, j - 1, k)], VI[cid(i, j, k)], VI[cid(i - 1, j, k)], !v0);
      }
    }
    // the surface's own geometry, written a few arrays per slice
    const g = HSURF = new THREE.BufferGeometry(), put = (k, a, n) => g.setAttribute(k, new THREE.BufferAttribute(a, n)), nv = P.length / 3;
    put('position', new Float32Array(P), 3); yield 'slice';
    put('normal', new Float32Array(N), 3); put('color', new Float32Array(C), 3); yield 'slice';
    put('aM', new Float32Array(M), 3); put('aSite', new Float32Array(nv).fill(H5.aSite), 1);
    const gc = new Float32Array(nv * 3); for (let i = 0; i < nv; i++) gc.set(H5.aGC, i * 3); put('aGC', gc, 3); yield 'slice';
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(I3), 1)); g.computeBoundingSphere(); yield 'slice';
  }
  // coronary vessels in their grooves: guesses pulled onto the crease between two parts, then onto the surface; each
  // tapers at its ends and sinks into the surface there
  const PO = {}, fNear = (x, y, z) => field(x, y, z, HAT([x, y, z]));
  const creaseIV = (x, y, z) => { field(x, y, z, HAT([x, y, z])); return HDS[RV] - smin(HDS[LV], HDS[LVB], 0.05); };   // between the ventricles
  const creaseAV = (x, y, z) => { field(x, y, z, HAT([x, y, z]), PO); return PO.a - PO.v; };                         // between atria and ventricles
  function groove(guess, crease, n) {
    const cv = new THREE.CatmullRomCurve3(guess.map(V)), out = [];
    for (let i = 0; i <= n; i++) {
      let p = cv.getPoint(i / n).toArray();
      for (let it = 0; it < 6; it++) { if (crease) p = newton(crease, p, 0.01); p = newton(fNear, p, 0.01); }
      out.push(p);
    }
    return out;
  }
  const wts = p => { field(p[0], p[1], p[2], HAT(p), PO); const m = Math.min(PO.a, PO.v), a = Math.exp(-(PO.a - m) / 0.006), v = Math.exp(-(PO.v - m) / 0.006); return [v / (a + v), a / (a + v), 0]; };
  const CA = K.rgb('#ee5a48'), CV = K.rgb('#8a7cf0');
  const taper = u => Math.sqrt(clamp(Math.min(u, 1 - u) / 0.06, 0, 1));
  const cor = (pts, r, col) => {
    const lifted = pts.map((p, i) => { const tp = taper(i / (pts.length - 1)); return v3.add(p, v3.mul(v3.norm(grad(fNear, p)), r * (0.45 * tp - 0.8 * (1 - tp)))); });
    const t = tubeR(lifted, Math.max(12, pts.length * 3), 8, u => r * (1 - 0.45 * u) * Math.max(0.15, taper(u))), P = t.attributes.position.array, A = new Float32Array(P.length);
    for (let i = 0; i < P.length; i += 3) A.set(wts([P[i], P[i + 1], P[i + 2]]), i);
    t.setAttribute('aM', new THREE.BufferAttribute(A, 3));
    heartB.add(t, Object.assign({ color: col }, H5));
    return pts;
  };
  function* coronaries() {
    const LAD = cor([...groove([vp(-0.04, 0.13, 0.07), vp(0.02, 0.13, 0.06), vp(0.08, 0.12, 0.05), vp(0.14, 0.1, 0.04)], creaseIV, 12),
      ...groove([vp(0.175, 0.07, 0.03), vp(0.21, 0.03, 0.01)], null, 3)], 0.0062, CA);
    yield 'slice';
    cor(groove([vp(0.0, 0.11, 0.08), vp(0.06, 0.09, 0.11), vp(0.12, 0.05, 0.12)], null, 8), 0.0045, CA);                            // a diagonal branch
    yield 'slice';
    cor(groove([[0.085, 0.085, 0.045], [0.135, 0.06, -0.02], [0.145, 0.04, -0.09], [0.1, 0.02, -0.15]], creaseAV, 10), 0.0052, CA);   // circumflex
    yield 'slice';
    cor(groove([[-0.05, 0.085, 0.085], [-0.11, 0.035, 0.08], [-0.16, -0.005, 0.02], [-0.15, -0.03, -0.06], [-0.09, -0.06, -0.11]], creaseAV, 14), 0.0056, CA);   // right coronary
    yield 'slice';
    cor(LAD.slice(0, 13).map(p => newton(fNear, newton(fNear, v3.add(p, v3.mul(EL, 0.012)), 0.01), 0.01)), 0.0042, CV);         // anterior interventricular vein
    yield 'slice';
  }
  // the window's cells: branched, striated heart muscle cells side by side on its floor, running on into its walls
  {
    const W = WIN, ua = v3.norm(v3.cross(W.n, Math.abs(W.n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), ub = v3.cross(W.n, ua);
    const e = v3.add(v3.mul(ua, Math.cos(0.5)), v3.mul(ub, Math.sin(0.5))), side = v3.cross(W.n, e), rc = 0.0068;
    const mid = v3.sub(W.c, v3.mul(W.n, W.dep - rc - 0.0005)), CELL = K.rgb('#d4566a'), rows = [];
    const band = (o, d, s0) => (x, y, z) => [v3.dot(v3.sub([x, y, z], o), d) + s0, 1, 0];
    for (let o = -W.r + 0.008, n = 0; o <= W.r - 0.008; o += 0.0172, n++) {
      const hl = Math.sqrt(Math.max(0, (W.r + 0.005) ** 2 - o * o)), c = v3.add(mid, v3.mul(side, o));
      hfB.add(tubeR([v3.sub(c, v3.mul(e, hl)), c, v3.add(c, v3.mul(e, hl))], 24, 10, rc), { color: CELL, aSite: 5, aGC: sc(5, 0), aF: band(c, e, n * 0.031), aTwA: NOTW });
      rows.push({ c, hl: Math.sqrt(Math.max(0, (W.r - 0.006) ** 2 - o * o)) });
    }
    for (let k = 0; k + 1 < rows.length; k++) {   // branches joining neighbouring cells
      const s0 = ((k * 3) % 5 - 2) * 0.008, lim = Math.min(rows[k].hl, rows[k + 1].hl) - 0.012;
      if (Math.abs(s0) > lim) continue;
      const a = v3.add(rows[k].c, v3.mul(e, s0 - 0.009)), b = v3.add(rows[k + 1].c, v3.mul(e, s0 + 0.009));
      hfB.add(tubeR([a, v3.lerp(a, b, 0.5), b], 8, 8, rc * 0.62), { color: CELL, aSite: 5, aGC: sc(5, 0), aF: band(a, v3.norm(v3.sub(b, a)), 0), aTwA: NOTW });
    }
  }
  // the job: polygonise, then the coronaries, then let go of the grids. heartStep(ms) runs it for about ms, ending a
  // slice early where a step asks for one ('slice'); when it is done, the meshes take their geometry (heartDone)
  let heartJob = (function* () { yield* polygonise(); yield* coronaries(); HAT = () => ALL; })(), heartDone = null, heartIn = 0;
  function heartStep(ms) {
    if (!heartJob) return;
    HJ.until = performance.now() + ms;
    try {
      for (let r = heartJob.next(); !r.done; r = heartJob.next()) if (r.value === 'slice' || late()) return;
    } catch (e) { console.error('motor: the heart could not be built', e); heartJob = null; return; }
    heartJob = null;
    if (heartDone) heartDone();
  }
  const sliceMs = dt => clamp((dt || 0.016) * 120, 1, 2.5);   // about an eighth of a frame

  // ------------------------------------------------------------------ the sarcomere (hexagonal lattice)
  const LA = 0.054, SL = 0.27, TL = 0.20, BZ = 0.024, THN = 0.17;
  const sarB = Builder(Object.assign({ aM: 3 }, LITS));
  const sgp = new THREE.Group();
  const thick = [], thin = [], has = new Set(), key = (i, j) => i + ',' + j, axl = (i, j) => [LA * (i + j / 2), LA * j * Math.sqrt(3) / 2];
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (Math.abs(i + j) <= 3) { thick.push(axl(i, j)); has.add(key(i, j)); }
  for (const k of has) {
    const [i, j] = k.split(',').map(Number), c3 = l => l.reduce((s, q) => [s[0] + axl(...q)[0] / 3, s[1] + axl(...q)[1] / 3], [0, 0]);
    if (has.has(key(i + 1, j)) && has.has(key(i, j + 1))) thin.push(c3([[i, j], [i + 1, j], [i, j + 1]]));
    if (has.has(key(i + 1, j)) && has.has(key(i, j + 1)) && has.has(key(i + 1, j + 1))) thin.push(c3([[i + 1, j], [i, j + 1], [i + 1, j + 1]]));
  }
  const ACT = K.rgb('#4cc7ff'), MYS = K.rgb('#ffb43b'), HEAD = K.rgb('#ff9c52'), TTN = K.rgb('#3ee08f'), ZD = K.rgb('#b07bff'), MB = K.rgb('#c9b8ff');
  const S6 = { aSite: 6, aGC: sc(4, 0) }, S7 = { aSite: 7, aGC: sc(5, 0) };
  const HD = { P: [], N: [], M: [], I: [] };
  // head half-sizes: long axis and the two short ones (kept small so the inside-lattice camera sees a corridor, not blobs)
  const HA = 0.0036, HB = 0.0024, HC_ = 0.0021;
  // thick filaments (myosin): backbone, bare zone in the middle, heads in a three-stranded helix pointing to the Z-discs
  thick.forEach(([y, z], fi) => {
    sarB.add(tubeFn(u => [lerp(-TL, TL, u), y, z], 20, 6, u => 0.0062 * (1 - 0.5 * smooth((Math.abs(2 * u - 1) - 0.9) / 0.1))), Object.assign({ color: MYS, aM: [0, 0, 0] }, S7));
    // (all heads go into one plain geometry, written directly: 3,108 small adds would be slow)
    const a0 = R() * TAU, OP = OCT.attributes.position.array;
    for (const sx of [-1, 1]) for (let k = 0; k < 14; k++) for (let h = 0; h < 3; h++) {
      const a = a0 + k * 0.698 + h * TAU / 3, rr = [0, Math.cos(a), Math.sin(a)], x = sx * (BZ + 0.004 + k * 0.0125);
      const dir = v3.norm(v3.add(v3.mul(rr, Math.cos(0.6)), [sx * Math.sin(0.6), 0, 0])), p1 = v3.norm(v3.cross(dir, [1, 0, 0])), p2 = v3.cross(dir, p1);
      const c = v3.add(v3.add([x, y, z], v3.mul(rr, 0.0064)), v3.mul(dir, 0.0046)), ph = R(), base = HD.P.length / 3;
      for (let q = 0; q < 6; q++) {
        const ox = OP[q * 3], oy = OP[q * 3 + 1], oz = OP[q * 3 + 2];
        const px = c[0] + dir[0] * ox * HA + p1[0] * oy * HB + p2[0] * oz * HC_, py = c[1] + dir[1] * ox * HA + p1[1] * oy * HB + p2[1] * oz * HC_,
          pz = c[2] + dir[2] * ox * HA + p1[2] * oy * HB + p2[2] * oz * HC_;
        const nx = dir[0] * ox / HA + p1[0] * oy / HB + p2[0] * oz / HC_, ny = dir[1] * ox / HA + p1[1] * oy / HB + p2[1] * oz / HC_,
          nz = dir[2] * ox / HA + p1[2] * oy / HB + p2[2] * oz / HC_, nl = Math.hypot(nx, ny, nz);
        HD.P.push(px, py, pz); HD.N.push(nx / nl, ny / nl, nz / nl);
        HD.M.push(0, clamp((Math.hypot(py - y, pz - z) - 0.006) / 0.009, 0, 1), ph);
      }
      for (const ix of OCT.index.array) HD.I.push(base + ix);
    }
    // titin: from the Z-disc, a spring through the I-band, then along the thick filament to the M-band
    for (const sx of [-1, 1]) {
      const a = R() * TAU, rd = [0, Math.cos(a), Math.sin(a)], t2 = [0, -Math.sin(a), Math.cos(a)], UC = 0.62;
      const tf = u => {
        if (u < UC) { const v = u / UC, x = sx * lerp(SL, TL, v), rho = lerp(0.013, 0.0085, v), w = TAU * 5 * v;
          return v3.add([x, y, z], v3.add(v3.mul(rd, rho + 0.0028 * Math.cos(w)), v3.mul(t2, 0.0028 * Math.sin(w)))); }
        const v = (u - UC) / (1 - UC), e0 = v3.add([sx * TL, y, z], v3.mul(rd, 0.0113));
        return v3.lerp(e0, v3.add([sx * 0.012, y, z], v3.mul(rd, 0.0078)), smooth(Math.min(1, v * 1.15)) * 0.98 + v * 0.02);
      };
      sarB.add(tubeFn(tf, 56, 3, 0.0013), Object.assign({ color: TTN, aM: x => [clamp((Math.abs(x) - TL) / (SL - TL), 0, 1), 0, 0] }, S6));
    }
  });
  {
    const at = (arr, n) => ({ array: new Float32Array(arr), itemSize: n, count: arr.length / n });
    sarB.add({ attributes: { position: at(HD.P, 3), normal: at(HD.N, 3), aM: at(HD.M, 3) }, index: { array: HD.I } }, Object.assign({ color: HEAD }, S7));
  }
  // thin filaments (actin): two beaded strands twisting round each other (one tube with a two-lobed, beaded
  // cross-section), from each Z-disc towards the middle
  thin.forEach(([y, z]) => {
    for (const sx of [-1, 1]) {
      const ph = R() * TAU, NB = 23;
      const ar = (u, a) => {
        const tw = TAU * u * THN / 0.075 + ph, tip = 1 - 0.6 * smooth((u - 0.965) / 0.035);
        let best = 0;
        for (let s = 0; s < 2; s++) {
          const rb = (0.002 + 0.0004 * Math.cos(TAU * (u * NB + s * 0.5))) * tip, dp = a - tw - s * PI, d = 0.0017 * tip, sn = d * Math.sin(dp);
          best = Math.max(best, d * Math.cos(dp) + Math.sqrt(Math.max(0, rb * rb - sn * sn)));
        }
        return best;
      };
      sarB.add(tubeFn(u => [sx * (SL - u * THN), y, z], NB * 2, 8, ar), Object.assign({ color: ACT, aM: [1, 0, 0] }, S6));
    }
  });
  // Z-discs: two zigzag layers of struts joining the thin filaments' ends, posts between them, a hexagonal frame
  const near = (list, d0) => { const out = []; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (Math.hypot(list[i][0] - list[j][0], list[i][1] - list[j][1]) < d0) out.push([list[i], list[j]]); return out; };
  const zE = near(thin, LA / Math.sqrt(3) * 1.15), mE = near(thick, LA * 1.1);
  for (const sx of [-1, 1]) {
    for (const [lay, off] of [[0, -0.0035], [1, 0.0035]]) zE.forEach(([a, b], k) => {
      if ((k + lay) % 2) sarB.add(CYL, Object.assign({ color: ZD, aM: [1, 0, 0] }, S6), strutM([sx * (SL + off), a[0], a[1]], [sx * (SL + off), b[0], b[1]], 0.0017));
      else sarB.add(CYL, Object.assign({ color: ZD, aM: [1, 0, 0] }, S6), strutM([sx * (SL + off), a[0], a[1]], [sx * (SL - off), b[0], b[1]], 0.0015));
    });
    thin.forEach(([y, z]) => sarB.add(CYL, Object.assign({ color: ZD, aM: [1, 0, 0] }, S6), strutM([sx * (SL - 0.005), y, z], [sx * (SL + 0.005), y, z], 0.0026)));
    const cr = [[3, 0], [0, 3], [-3, 3], [-3, 0], [0, -3], [3, -3]].map(q => v3.mul(axl(...q), (3 * LA + 0.024) / (3 * LA)));
    for (let k = 0; k < 6; k++) { const a = cr[k], b = cr[(k + 1) % 6]; sarB.add(CYL6, Object.assign({ color: ZD, aM: [1, 0, 0] }, S6), strutM([sx * SL, a[0], a[1]], [sx * SL, b[0], b[1]], 0.0032)); }
    for (let k = 0; k < 6; k++) { const a = cr[k], c = thin.reduce((best, q) => (Math.hypot(q[0] - a[0], q[1] - a[1]) < Math.hypot(best[0] - a[0], best[1] - a[1]) ? q : best), thin[0]);
      sarB.add(CYL, Object.assign({ color: ZD, aM: [1, 0, 0] }, S6), strutM([sx * SL, a[0], a[1]], [sx * SL, c[0], c[1]], 0.0017)); }
  }
  // M-band: cross-links between neighbouring thick filaments, three layers
  for (const x of [-0.006, 0.006]) mE.forEach(([a, b], k) => sarB.add(CYL, Object.assign({ color: MB, aM: [0, 0, 0] }, S7), strutM([x, a[0], a[1]], [-x, b[0], b[1]], 0.0012)));

  // ------------------------------------------------------------------ meshes
  const greyMat = lit('grey', { base: 0.5, self: 0.32, rimK: 0.2, rimC: [0.95, 0.7, 0.95] });
  const somaMat = lit('soma', { base: 0.66, self: 0.32, rimK: 0.75, rimC: [1, 0.85, 0.5], vh: TWV + PLV, vb: TWB + TWE + PLB, fh: PLF, fe: PLE });
  const nucMat = lit('nuc', { self: 0.35, rimK: 0.4 });
  const neuMat = lit('neu', { self: 0.28, rimK: 0.45, rimC: [1, 0.85, 0.55], vh: TWV + PLV, vb: TWB + TWE + PLB, fh: PLF, fe: PLE });
  const myeMat = lit('mye', { base: 0.5, rough: 0.2, self: 0.1, rimK: 0.75, rimC: [0.75, 0.88, 1] });
  const STRI = `
float bb = vBand / 0.018; float fw = fwidth(bb); float fr = fract(bb); float dz = min(fr, 1.0 - fr);
float aB = smoothstep(0.2 - fw, 0.2 + fw, dz), hB = smoothstep(0.37 - fw, 0.37 + fw, dz), mB = smoothstep(0.465 - fw, 0.465 + fw, dz);
float zB = 1.0 - smoothstep(0.03, 0.03 + 1.5 * fw, dz);
float shd = mix(1.14, 0.7, aB) + 0.1 * hB - 0.1 * mB - 0.38 * zB;
if (vKind > 0.5 && vKind < 1.5) { float q = fract(bb / 7.0); float qd = min(q, 1.0 - q) * 7.0; shd += 0.55 * (1.0 - smoothstep(0.05, 0.05 + 1.5 * fw, qd)); }
shd = mix(0.88, shd, 1.0 - smoothstep(0.2, 0.42, fw));
diffuseColor.rgb *= shd;
if (!gl_FrontFacing) diffuseColor.rgb *= 0.4;`;
  const fibreMat = (key, build) => lit(key, { build, self: 0.13, rimK: 0.3, rimC: [1, 0.6, 0.7], side: THREE.DoubleSide, rough: 0.6,
    vh: TWV + `attribute vec3 aF; varying vec3 vRad; varying float vBand, vKind, vRole, vXo, vTw;`,
    vb: TWB + `if (aF.z > 2.5) rd *= smoothstep(0.05, 0.5, uOpen);` + TWE + `vRad = rd; vBand = aF.x; vKind = aF.y; vRole = aF.z; vXo = position.x; vTw = tw;`,
    fh: `uniform float uOpen; uniform vec3 uOpenDir; varying vec3 vRad; varying float vBand, vKind, vRole, vXo, vTw;`,
    fc: `
float oS = smoothstep(0.0, 0.5, uOpen);
if (vRole > 0.5 && vRole < 1.5 && vXo > 0.27 && dot(normalize(vRad), uOpenDir) > 1.0 - 1.5 * oS) discard;
if (vRole > 1.5 && vRole < 2.5 && oS > 0.3) discard;`,
    fcol: STRI, fe: `totalEmissiveRadiance += diffuseColor.rgb * 0.5 * vTw;` });
  const fibMat = fibreMat('fib', true), hfMat = fibreMat('hfib', false);
  const sarU = { uShift: { value: 0 }, uStroke: { value: 0 } };
  const sarMat = lit('sar', { build: false, self: 0.26, rimK: 0.45, rimC: [0.7, 0.85, 1], uniforms: sarU,
    vh: `attribute vec3 aM; uniform float uShift, uStroke;`,
    vb: `float sx = position.x < 0.0 ? -1.0 : 1.0;
transformed.x -= sx * aM.x * uShift;
transformed.x -= sx * aM.y * uStroke * (0.5 + 0.5 * sin(uTime * 7.0 + aM.z * 6.2832)) * 0.006;` });
  // the beat: aM weighs each vertex between ventricles (x) and atria (y); vessels stay still
  const heartU = { uSys: { value: 0 }, uAtr: { value: 0 }, uV0: { value: V(V0) }, uAc: { value: V([-0.05, 0.09, -0.07]) } };
  const heartMat = lit('heart', { build: false, self: 0.06, rimK: 0.3, rimC: K.rgb('#ff6d8f'), side: THREE.DoubleSide, rough: 0.48, tint: 0.3, uniforms: heartU,   // the disease colour mostly at the rim, so the anatomy stays
    vh: `attribute vec3 aM; uniform float uSys, uAtr; uniform vec3 uV0, uAc;`,
    vb: `transformed += aM.x * (uV0 - transformed) * (0.065 * uSys) + aM.y * (uAc - transformed) * (0.07 * uAtr);`,
    fcol: `if (!gl_FrontFacing) diffuseColor.rgb *= 0.3;` });
  const glassMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uBuildX: SU.uBuildX, uSiteG: SU.uSiteG, uSiteD: SU.uSiteD },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 color, aGC; attribute float aSite, aGA;
uniform float uSiteG[8], uSiteD[8], uBuildX;
varying vec3 vN, vW, vC, vGC; varying float vGl, vDm, vBX, vGA;
void main() { int si = int(aSite + 0.5); vGl = uSiteG[si]; vDm = uSiteD[si]; vC = color; vGC = aGC; vGA = aGA; vBX = uBuildX - position.x;
  vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uA; varying vec3 vN, vW, vC, vGC; varying float vGl, vDm, vBX, vGA;
void main() { if (vBX < 0.0) discard;
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW); float r = pow(1.0 - abs(dot(n, v)), 2.2);
  vec3 col = vC * (0.5 + 0.8 * r) * vDm + vGC * vGl * (0.12 + 0.6 * r) + vec3(0.55, 0.9, 1.0) * smoothstep(0.035, 0.0, vBX);
  gl_FragColor = vec4(col, (0.03 + 0.42 * r) * vGA * uA); }`,
  });
  set.mats.push(glassMat);
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uSiteG: SU.uSiteG, uBuildX: SU.uBuildX },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aGC, aR; uniform float uSiteG[8], uBuildX; varying vec3 vC; varying float vG, vU, vS, vBX;
void main() { vC = aGC; vG = uSiteG[int(aR.x + 0.5)]; vU = aR.y; vS = aR.z; vBX = uBuildX - position.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uA, uTime; varying vec3 vC; varying float vG, vU, vS, vBX;
void main() { if (vBX < 0.0 || vG < 0.003) discard; float c = pow(fract(vU - uTime * vS), 6.0);
  gl_FragColor = vec4(vC * (0.8 + 0.9 * c) + c * 0.2, (0.28 + 0.6 * c) * vG * uA); }`,
  });
  set.mats.push(ringMat);
  const PU = { uPh: SU.uPh, uP: SU.uP, uSig: SU.uSig, uHeartG: { value: 0 }, uBuildX: SU.uBuildX, uSiteG: SU.uSiteG, uSiteD: SU.uSiteD };
  const ptMat = K.points(set, { uniforms: PU,
    head: `attribute vec3 aQ; uniform float uPh, uP, uSig, uHeartG, uBuildX; uniform float uSiteG[8], uSiteD[8];`,
    vertex: `
float k = aQ.x, g = 1.0; int si = int(aQ.z + 0.5);
float d = uPh - aQ.y; d -= uP * floor(d / uP + 0.5);
if (k < 0.5) { g = uSig * exp(-d * d / 0.0022) * 1.6; gl_PointSize *= 0.6 + 0.6 * min(g, 1.0);
  mv.xyz += normalize(-mv.xyz) * 0.022 * length(modelViewMatrix[0].xyz); gl_Position = projectionMatrix * mv; }
else if (k < 1.5) g = 0.55 + 2.4 * uSig * exp(-d * d / 0.0025);
else if (k < 2.5) { float e = d > 0.0 ? d : 10.0; g = uSig * 1.6 * exp(-e / 0.06) * smoothstep(0.0, 0.012, e); }
else if (k < 3.5) g = uSiteG[si];
else g = uHeartG;
vA *= g * (k < 3.5 && k > 2.5 ? 1.0 : uSiteD[si]);
if (position.x > uBuildX) vA = 0.0;` });
  const ptGeo = K.pointsGeo(PTS.length), aQ = new Float32Array(PTS.length * 3);
  PTS.forEach((q, i) => {
    ptGeo.attributes.position.array.set(q.p, i * 3); ptGeo.attributes.aCol.array.set(q.c, i * 3);
    ptGeo.attributes.aSize.array[i] = q.s; ptGeo.attributes.aA.array[i] = q.a; aQ.set(q.q, i * 3);
  });
  ptGeo.setAttribute('aQ', new THREE.BufferAttribute(aQ, 3));
  ptGeo.computeBoundingSphere();
  const mesh = (B, mat, order, parent) => { const m = new THREE.Mesh(B.geo(), mat); m.frustumCulled = false; m.renderOrder = order; (parent || set.group).add(m); return m; };
  mesh(neuB, neuMat, 1); mesh(nucB, nucMat, 1); mesh(fibB, fibMat, 1);
  const sarMesh = mesh(sarB, sarMat, 2, sgp); set.group.add(sgp);
  // the heart's surface and its coronary vessels take their geometry when the job is done; the window's cells are ready now
  const heartMesh = new THREE.Mesh(new THREE.BufferGeometry(), heartMat), corMesh = new THREE.Mesh(new THREE.BufferGeometry(), heartMat), hfMesh = mesh(hfB, hfMat, 2, hg);
  for (const o of [heartMesh, corMesh]) { o.frustumCulled = false; o.renderOrder = 2; hg.add(o); }
  set.group.add(hg);
  heartDone = () => { heartMesh.geometry.dispose(); heartMesh.geometry = HSURF; corMesh.geometry.dispose(); corMesh.geometry = heartB.geo(); HSURF = null; };
  mesh(greyB, greyMat, 4); mesh(somaB, somaMat, 5); mesh(myeB, myeMat, 6);
  const glassMesh = new THREE.Mesh(glass.geo(), glassMat); glassMesh.renderOrder = 7; glassMesh.frustumCulled = false; set.group.add(glassMesh);
  const ringMesh = new THREE.Mesh(rings.geo(), ringMat); ringMesh.renderOrder = 8; ringMesh.frustumCulled = false; set.group.add(ringMesh);
  const ptsObj = new THREE.Points(ptGeo, ptMat); ptsObj.renderOrder = 9; ptsObj.frustumCulled = false; set.group.add(ptsObj);
  // magnifier lines from the myofibril's last sarcomere to the big one
  const NL = 28, lnGeo = K.linesGeo(NL), lnMat = K.lines(set);
  for (let i = 0; i < NL * 2; i++) lnGeo.attributes.aCol.array.set([0.6, 0.9, 1.0], i * 3);
  const lnObj = new THREE.LineSegments(lnGeo, lnMat); lnObj.renderOrder = 9; lnObj.frustumCulled = false; set.group.add(lnObj);
  const SRC = [0.693, MY.hi.y, MY.hi.z], SRCS = PER / (2 * SL);

  // ------------------------------------------------------------------ update
  const G = SU.uSiteG.value, D = SU.uSiteD.value;
  const bump = (x, a, b) => (x < a || x > b ? 0 : Math.pow(Math.sin(PI * (x - a) / (b - a)), 2));
  let cur = { e: 0, s: SRCS, shift: 0, hv: 0 };
  function update(S, t, dt) {
    const b = clamp(S.motor_build, 0, 1);
    SU.uBuildX.value = b >= 0.999 ? 10 : lerp(-1.32, 1.36, b);
    // disease sites: chosen one glows, the rest dims
    const s = clamp(S.motor_site, 0, 5), g = clamp(S.motor_groups, 0, 1), w0 = clamp(1 - s, 0, 1), breath = 0.88 + 0.12 * Math.sin(t * 2.2);
    // the heart builds faster once it is wanted, and fades in when it is ready
    heartStep(S.motor_heart > 0.001 ? 12 : sliceMs(dt));
    if (!heartJob) heartIn = Math.min(1, heartIn + clamp(dt || 0, 0, 0.1) / 0.5);
    const hv = prog(S.motor_heart, 0.2, 0.75) * prog(b, 0.75, 1) * heartIn;
    for (let k = 1; k <= 5; k++) {
      const wk = clamp(1 - Math.abs(s - k), 0, 1);
      G[k] = g * (0.6 * w0 + 1.1 * wk) * breath * (k === 5 ? hv : 1);
      D[k] = 1 - 0.7 * (1 - w0 - wk);
    }
    G[6] = G[4]; G[7] = g * (0.6 * w0 + 1.1 * clamp(1 - Math.abs(s - 5), 0, 1)) * breath;   // the sarcomere glows for the heart even without it
    D[6] = D[7] = Math.max(D[4], D[5]);
    // impulses: the spindle fires, the motor neuron answers (a stretch reflex), the junctions release, the fibres twitch
    const sig = clamp(S.motor_signal, 0, 1), ph = ((t % P_) + P_) % P_;
    PU.uPh.value = ph; PU.uSig.value = sig;
    const dd = (((ph - TJm - 0.04) % P_) + P_) % P_, tw0 = (dd / 0.11) * Math.exp(1 - dd / 0.11);
    SU.uTw.value = sig * tw0;
    const c = clamp(S.motor_contract, 0, 1), amt = c * lerp(1, 0.2 + 0.8 * tw0, prog(sig, 0.5, 0.7));
    sarU.uShift.value = 0.055 * amt; sarU.uStroke.value = c;
    // the opened fibre and the magnified sarcomere
    const o = clamp(S.motor_open, 0, 1), e = prog(o, 0.35, 1), sz = Math.exp(lerp(Math.log(SRCS), 0, e));
    SU.uOpen.value = o;
    sgp.position.set(lerp(SRC[0], SC[0], e), lerp(SRC[1], SC[1], e), lerp(SRC[2], SC[2], e)); sgp.scale.setScalar(sz);
    show(sarMat, sarMesh, prog(o, 0.3, 0.55) * prog(b, 0.85, 1));
    // the heart, from a glow, beating
    const hs = 0.55 + 0.45 * prog(S.motor_heart, 0.1, 1);
    hg.scale.setScalar(hs);
    show(heartMat, heartMesh, hv); show(hfMat, hfMesh, hv); corMesh.visible = heartMesh.visible;
    PU.uHeartG.value = prog(S.motor_heart, 0, 0.3) * (1 - 0.75 * hv) * prog(b, 0.75, 1);
    const bp = ((t * 1.15) % 1 + 1) % 1, sys = bump(bp, 0.18, 0.52) * hv, atr = bump(bp, 0, 0.16) * hv;
    heartU.uSys.value = sys; heartU.uAtr.value = atr;
    const vs = 1 - 0.065 * sys; hfMesh.scale.setScalar(vs); hfMesh.position.set(V0[0] * (1 - vs), V0[1] * (1 - vs), V0[2] * (1 - vs));
    heartMat.userData.u.uRimK.value = 0.3 + 1.6 * (1 - hv);
    // magnifier lines
    const la = prog(o, 0.4, 0.75), P = lnGeo.attributes.position.array, A = lnGeo.attributes.aA.array;
    let n = 0;
    const seg = (p, q, a) => { P.set(p, n * 6); P.set(q, n * 6 + 3); A[n * 2] = A[n * 2 + 1] = a; n++; };
    const zx = [SRC[0] - PER / 2, SRC[0] + PER / 2], r0 = 0.009, big = (sx, a) => [sgp.position.x + sx * (SL - 0.055 * amt) * sz, sgp.position.y + Math.cos(a) * 0.16 * sz, sgp.position.z + Math.sin(a) * 0.16 * sz];
    for (const x of zx) for (let k = 0; k < 12; k++) { const a0 = k / 12 * TAU, a1 = (k + 1) / 12 * TAU; seg([x, SRC[1] + r0 * Math.cos(a0), SRC[2] + r0 * Math.sin(a0)], [x, SRC[1] + r0 * Math.cos(a1), SRC[2] + r0 * Math.sin(a1)], la * 0.9); }
    for (const [k, a] of [[0, PI / 2], [0, -PI / 2], [1, PI / 2], [1, -PI / 2]]) seg([zx[k], SRC[1] + r0 * Math.cos(a), SRC[2] + r0 * Math.sin(a)], big(k ? 1 : -1, a), la * 0.45 * e);
    lnGeo.attributes.position.needsUpdate = true; lnGeo.attributes.aA.needsUpdate = true;
    cur = { e, s: sz, shift: 0.055 * amt, hv, o };
  }

  // ------------------------------------------------------------------ anchors, labels, views, explore
  const sAt = (p) => [sgp.position.x + p[0] * cur.s, sgp.position.y + p[1] * cur.s, sgp.position.z + p[2] * cur.s];
  const nodeMid = nodes[nodeM0 + Math.floor((nodeM1 - nodeM0) * 0.55)];
  const ms = midSheath[Math.floor(midSheath.length * 0.62)];
  const anchors = {
    cord: [CC[0] - 0.03, CC[1] + CRY + 0.01, 0.06],
    soma: [MS[0], MS[1] + 0.035, MS[2] + 0.01],
    ganglion: [SG[0] - 0.01, SG[1] - 0.05, SG[2] + 0.03],
    axon: cM.getPointAt(nodeMid.s / LM).toArray(),
    myelin: cM.getPointAt(ms / LM).toArray(),
    nerve: [-0.5, -0.47, 0.06],
    junction: JN[2].J(0, 0, 0.008),
    spindle: SPA(0.17),
    fibre: [0.42, FCN[1] + 0.2, 0.05],
    myofibril: [0.66, MY.hi.y, MY.hi.z],
    sarcomere: () => sAt([0, 0.17, 0]),
    zdisc: () => sAt([SL - cur.shift, 0.15, 0]),
    mband: () => sAt([0, 0.16, 0]),
    heart: [HC[0] + 0.04, HC[1] + 0.27, HC[2]],
  };
  // which labels show: at most five; by motor_site (0 = overview), motor_open and motor_heart
  const SHOW = {
    cord: [x => (1 - x.o) * (1 - x.h), 1, 0, 0, 0, 0], soma: [1, 1, 1, 0, 0, 0], ganglion: [0, 1, 1, 0, 0, 0],
    axon: [x => 1 - x.o, 0, 1, 0, 0, 0], junction: [1, 0, 0, 1, 0, 0], fibre: [1, 0, 0, 1, 1, 0],
    sarcomere: [x => x.o, 0, 0, 0, x => x.o, x => x.o], heart: [x => x.h, 0, 0, 0, 0, x => x.h],
  };
  const lab = (name, at, xb) => S => {
    const x = { o: prog(S.motor_open, 0.3, 0.6), h: prog(S.motor_heart, 0.5, 0.8) }, s = clamp(S.motor_site, 0, 5);
    let a = 0;
    for (let k = 0; k <= 5; k++) { const w = clamp(1 - Math.abs(s - k), 0, 1), r = SHOW[name][k]; if (w > 0) a += w * (typeof r === 'function' ? r(x) : r); }
    const bx = clamp(S.motor_build, 0, 1) >= 0.999 ? 10 : lerp(-1.32, 1.36, S.motor_build);
    return a * clamp((bx - xb) / 0.15, 0, 1);
  };
  const labels = [
    { text: ['Spinal cord', 'grey matter inside'], at: 'cord', cls: '', alpha: lab('cord', 'cord', -1.0) },
    { text: ['Motor neuron', 'in the anterior horn'], at: 'soma', cls: 'amb', alpha: lab('soma', 'soma', -0.88) },
    { text: ['Sensory neuron', 'dorsal root ganglion'], at: 'ganglion', cls: 'cyn', alpha: lab('ganglion', 'ganglion', -1.08) },
    { text: ['Axon', 'in its myelin sheath'], at: 'myelin', cls: '', alpha: lab('axon', 'myelin', -0.5) },
    { text: ['Neuromuscular junction', ''], at: 'junction', cls: 'grn', alpha: lab('junction', 'junction', 0.1) },
    { text: ['Muscle fibre', 'striated'], at: 'fibre', cls: '', alpha: lab('fibre', 'fibre', 0.45) },
    { text: ['Sarcomere', 'actin, myosin, titin'], at: 'sarcomere', cls: 'cyn', alpha: lab('sarcomere', 'sarcomere', 0.9) },
    { text: ['Heart', 'the same sarcomere'], at: 'heart', cls: 'mag', alpha: lab('heart', 'heart', 0.8) },
  ];
  // a view from a camera position to a target, as [az, el, dist, tx, ty, tz]
  const look = (from, to) => { const d = v3.sub(from, to), L = v3.len(d); return [Math.atan2(d[0], d[2]) * 180 / PI, Math.asin(d[1] / L) * 180 / PI, L, to[0], to[1], to[2]]; };
  const edge = [LA / 2, 0];   // midway between two thick filaments: a corridor with no filament ahead (x 0.012: past the
  // M-band struts, which cross this point at x 0, and 0.016 before the first heads)
  const cam = {
    default: [-20, 14, 3.35, 0.05, 0.05, 0],
    cord: [-24, 12, 0.95, -0.95, -0.15, 0],
    junction: [20, 26, 0.42, ...JN[2].J(0.01, 0, 0.004)],
    fibre: [32, 16, 1.0, 0.5, -0.2, 0.08],
    sarcomere: look([SC[0] + 0.012, SC[1] + edge[0], SC[2] + edge[1]], [SC[0] + 0.27, SC[1] + edge[0] + 0.012, SC[2] + edge[1] + 0.01]),
    heart: [-10, 8, 1.35, HC[0], HC[1] + 0.05, HC[2]],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['default', 'Motor unit'], ['junction', 'Junction'], ['sarcomere', 'Sarcomere'], ['heart', 'Heart']] },
    { key: 'show', label: 'Show', options: [['off', 'Diseases off'], ['on', 'Diseases on']] },
    { key: 'motion', label: 'Motion', options: [['still', 'Still'], ['impulses', 'Impulses'], ['contraction', 'Contraction']] },
  ];
  function explore(c) {
    const v = c.view, on = c.show === 'on';
    return {
      motor_build: 1, motor_open: v === 'junction' ? 0 : 1, motor_heart: v === 'default' || v === 'heart' ? 1 : 0,
      motor_groups: on ? 1 : 0, motor_site: on ? { default: 0, junction: 3, sarcomere: 4, heart: 5 }[v] : 0,
      motor_signal: c.motion === 'still' ? 0 : 1, motor_contract: c.motion === 'contraction' ? 1 : 0,
    };
  }
  return Object.assign(set, {
    params: { motor_a: 1, motor_build: 1, motor_signal: 0, motor_open: 0, motor_contract: 0, motor_heart: 0, motor_groups: 0, motor_site: 0 },
    update, anchors, labels, cam, controls, explore,
    idle: dt => { heartStep(sliceMs(dt)); if (!heartJob) heartIn = 1; },   // while the set is hidden, the heart goes on building
    finish: () => { while (heartJob) heartStep(Infinity); heartIn = 1; },     // for screenshots and tests: build it now
  });
};
