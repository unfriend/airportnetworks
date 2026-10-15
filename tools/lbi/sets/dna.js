// The building blocks of life (slides 9-12): a long DNA double helix coils up into the 23 chromosomes, genes on them
// give 25 protein chains that fold in the AlphaFold style, and those become a tiny patch in a field of about 20,000.
SETS.dna = function (K) {
  const { THREE, clamp, prog } = K;
  const set = K.newSet('dna');
  const PI = Math.PI, D2R = PI / 180;

  // ------------------------------------------------------------- helpers --
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const madd = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  const { dot, cross } = K.v3, mix3 = K.v3.lerp;
  // (Math.hypot is slow, and these run hundreds of thousands of times at load)
  const len = a => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  const norm = a => { const l = 1 / (len(a) || 1); return [a[0] * l, a[1] * l, a[2] * l]; };
  const dist = (a, b) => { const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); };
  // two unit vectors perpendicular to d, with u x v = d
  const basis = d => { const u = norm(cross(d, Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])); return [u, cross(d, u)]; };
  // rotate v about the unit axis k by angle a
  const rot = (v, k, a) => {
    const c = Math.cos(a), s = Math.sin(a), x = cross(k, v), d = dot(k, v) * (1 - c);
    return [v[0] * c + x[0] * s + k[0] * d, v[1] * c + x[1] * s + k[1] * d, v[2] * c + x[2] * s + k[2] * d];
  };
  // the same rotation as a matrix (rows), for turning many points at once
  const rotM = (k, a) => [rot([1, 0, 0], k, a), rot([0, 1, 0], k, a), rot([0, 0, 1], k, a)];
  const mulM = (M, v) => [M[0][0] * v[0] + M[1][0] * v[1] + M[2][0] * v[2], M[0][1] * v[0] + M[1][1] * v[1] + M[2][1] * v[2], M[0][2] * v[0] + M[1][2] * v[1] + M[2][2] * v[2]];
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const X0 = [1, 0, 0], Y0 = [0, 1, 0], Z0 = [0, 0, 1];

  // A mesh under construction: typed float attributes by name (item sizes in sz) that grow as needed, and indices
  const mesh0 = (sz, nv, ni) => { const b = { sz, a: {}, cap: 0, nv: 0, idx: new Uint32Array(ni || 4096), ni: 0 }; grow(b, nv || 4096, 0); return b; };
  function grow(b, nv, ni) {
    if (b.nv + nv > b.cap) {
      let cap = Math.max(4096, b.cap * 2);
      while (cap < b.nv + nv) cap *= 2;
      for (const k in b.sz) { const a = new Float32Array(cap * b.sz[k]); if (b.a[k]) a.set(b.a[k]); b.a[k] = a; }
      b.cap = cap;
    }
    if (b.ni + ni > b.idx.length) { let c = b.idx.length * 2; while (c < b.ni + ni) c *= 2; const x = new Uint32Array(c); x.set(b.idx); b.idx = x; }
  }
  function geoOf(b) {
    const g = new THREE.BufferGeometry();
    for (const k in b.sz) g.setAttribute(k, new THREE.BufferAttribute(b.a[k].subarray(0, b.nv * b.sz[k]), b.sz[k]));
    g.setIndex(new THREE.BufferAttribute(b.nv > 65535 ? b.idx.subarray(0, b.ni) : Uint16Array.from(b.idx.subarray(0, b.ni)), 1));
    return g;
  }
  // set attribute k of vertices v0..v1-1 to the constant c
  const fill = (b, k, v0, v1, c) => { const a = b.a[k], s = b.sz[k]; for (let v = v0; v < v1; v++) for (let q = 0; q < s; q++) a[v * s + q] = c[q]; };
  const set3 = (a, v, x, y, z) => { a[3 * v] = x; a[3 * v + 1] = y; a[3 * v + 2] = z; };
  const tangents = C => C.map((p, i) => {
    const q = C[Math.min(i + 1, C.length - 1)], o = C[Math.max(i - 1, 0)], x = q[0] - o[0], y = q[1] - o[1], z = q[2] - o[2], l = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
    return [x * l, y * l, z * l];
  });
  // ring normals along a curve by parallel transport, pulled towards targets G[i] with weights W[i] (for ribbons)
  function frames(C, T, G, W) {
    const N = [];
    let [nx, ny, nz] = basis(T[0])[0];
    for (let i = 0; i < C.length; i++) {
      const [tx, ty, tz] = T[i];
      let d = nx * tx + ny * ty + nz * tz;
      nx -= tx * d; ny -= ty * d; nz -= tz * d;
      let l = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (l < 1e-6) [nx, ny, nz] = basis(T[i])[0]; else { nx /= l; ny /= l; nz /= l; }
      const g = G && W[i] > 0 && G[i];
      if (g) {
        d = g[0] * tx + g[1] * ty + g[2] * tz;
        let gx = g[0] - tx * d, gy = g[1] - ty * d, gz = g[2] - tz * d;
        l = Math.sqrt(gx * gx + gy * gy + gz * gz);
        if (l > 1e-6) {
          if (gx * nx + gy * ny + gz * nz < 0) l = -l;
          const w = W[i];
          gx = nx + (gx / l - nx) * w; gy = ny + (gy / l - ny) * w; gz = nz + (gz / l - nz) * w;
          l = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
          nx = gx / l; ny = gy / l; nz = gz / l;
        }
      }
      N.push([nx, ny, nz]);
    }
    return N;
  }
  // sweep an elliptical ring of R vertices along centres C: half-axes AB[i] = [across (T x N), along N]; writes
  // position and normal, and put(v, i, j) the vertex's other attributes; returns the first vertex
  const RING = {};
  for (const R of [6, 8, 10]) RING[R] = [...Array(R).keys()].map(j => [Math.cos(2 * PI * j / R), Math.sin(2 * PI * j / R)]);
  function sweep(b, C, T, N, AB, R, put) {
    const m = C.length, base = b.nv, ring = RING[R];
    grow(b, m * R, (m - 1) * R * 6);
    const P = b.a.position, NN = b.a.normal, I = b.idx;
    for (let i = 0; i < m; i++) {
      const n = N[i], t = T[i], c0 = C[i], a = AB[i][0], e = AB[i][1];
      const wx = t[1] * n[2] - t[2] * n[1], wy = t[2] * n[0] - t[0] * n[2], wz = t[0] * n[1] - t[1] * n[0];
      for (let j = 0; j < R; j++) {
        const v = base + i * R + j, c = ring[j][0], s = ring[j][1];
        set3(P, v, c0[0] + (wx * a * c + n[0] * e * s), c0[1] + (wy * a * c + n[1] * e * s), c0[2] + (wz * a * c + n[2] * e * s));
        const nx = wx * e * c + n[0] * a * s, ny = wy * e * c + n[1] * a * s, nz = wz * e * c + n[2] * a * s, l = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
        set3(NN, v, nx * l, ny * l, nz * l);
        if (put) put(v, i, j);
      }
    }
    let q = b.ni;
    for (let i = 0; i < m - 1; i++) for (let j = 0; j < R; j++) {
      const a0 = base + i * R + j, a1 = base + i * R + (j + 1) % R;
      I[q++] = a0; I[q++] = a0 + R; I[q++] = a1; I[q++] = a1; I[q++] = a0 + R; I[q++] = a1 + R;
    }
    b.ni = q; b.nv += m * R;
    return base;
  }

  // A lit material whose vertices move in GLSL (onBeforeCompile on MeshStandardMaterial, so the scene's lights apply).
  // o: uniforms, head (vertex declarations), normal (replaces beginnormal: declare objectNormal and set dnaP),
  // fhead, fmain (start of the fragment main), emis (added emissive)
  function litMat(name, params, o) {
    const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.5, metalness: 0 }, params));
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, o.uniforms || {});
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + (o.head || ''))
        .replace('#include <beginnormal_vertex>', o.normal || '#include <beginnormal_vertex>\nvec3 dnaP = position;')
        .replace('#include <begin_vertex>', 'vec3 transformed = dnaP;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + (o.fhead || ''))
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + (o.fmain || ''))
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += vec3(0.12, 0.18, 0.3) * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
  ${o.emis || ''}`);
    };
    m.customProgramCacheKey = () => 'dna-' + name;
    K.fade(set, m, 1);
    return m;
  }
  const ROT_GLSL = 'vec3 dnaRot(vec3 v, vec3 k, float a) { float c = cos(a), s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }\n';
  // 'chain order' colours as in structure viewers: the N-terminus blue, through green and yellow, to the C-terminus red
  const RB_GLSL = 'vec3 dnaRb(float u) { vec3 k = clamp(abs(mod(4.0 * (1.0 - u) + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return mix(vec3(1.0), k, 0.85) * 0.95; }\n';
  const uRb = { value: 0 };

  // ================================================================ DNA ====
  // B-DNA in proportion: radius 1 nm, 10.5 base pairs per turn of 3.4 nm; the strands sit 140° apart around the
  // axis, which opens the wide major and narrow minor grooves. The helix lies along x, from -3 to 3.
  const HX = { r: 0.16, rise: 0.0518, half: 3 };
  const NBP = Math.round(2 * HX.half / HX.rise), TW = 2 * PI / 10.5, GROOVE = 140 * D2R;
  const SEQ = [];
  { const r = K.rng(21); for (let i = 0; i < NBP; i++) SEQ.push(r() < 0.41 ? (r() < 0.5 ? 'G' : 'C') : (r() < 0.5 ? 'A' : 'T')); }
  const PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' };
  const BASE = { A: K.rgb('#3ee08f'), T: K.rgb('#ff5a4b'), G: K.rgb('#ffb43b'), C: K.rgb('#4f9dff') };
  const BB = [K.rgb('#6f93cf'), K.rgb('#9180c8')];
  const bpX = i => -HX.half + (i + 0.5) * HX.rise;
  const hb = mesh0({ position: 3, normal: 3, color: 3, aS: 1, aB: 1 }, 13000, 51000);
  const hpts = K.pointsGeo(NBP * 2), hS = new Float32Array(NBP * 2);
  // the two sugar-phosphate backbones: glossy tubes
  for (let s = 0; s < 2; s++) {
    const C = [], AB = [];
    for (let k = 0; k <= NBP * 3; k++) {
      const u = k / 3, a = (u - 0.5) * TW + s * GROOVE;
      C.push([-HX.half + u * HX.rise, HX.r * Math.cos(a), HX.r * Math.sin(a)]); AB.push([0.024, 0.024]);
    }
    const T = tangents(C);
    sweep(hb, C, T, frames(C, T), AB, 10, v => { set3(hb.a.color, v, BB[s][0], BB[s][1], BB[s][2]); hb.a.aS[v] = Math.abs(hb.a.position[3 * v]) / HX.half; });
  }
  // a flat slab (a base) from p0 to p1, thickness h along up, width w; flat-shaded faces
  function slab(b, p0, p1, up, w, h, col, s) {
    const d = sub(p1, p0), side = mul(norm(cross(d, up)), w / 2), u = mul(norm(up), h / 2);
    const c = [];
    for (const e of [0, 1]) for (const y of [-1, 1]) for (const x of [-1, 1]) c.push(add(add(e ? p1 : p0, mul(side, x)), mul(u, y)));
    // faces as corner indices (counter-clockwise from outside) with normals
    const F = [[[0, 2, 3, 1], mul(norm(d), -1)], [[4, 5, 7, 6], norm(d)], [[0, 1, 5, 4], mul(norm(u), -1)], [[2, 6, 7, 3], norm(u)],
      [[0, 4, 6, 2], mul(norm(side), -1)], [[1, 3, 7, 5], norm(side)]];
    for (const [q, n] of F) {
      grow(b, 4, 6);
      const v = b.nv;
      q.forEach((k, z) => { b.a.position.set(c[k], 3 * (v + z)); b.a.normal.set(n, 3 * (v + z)); b.a.color.set(col, 3 * (v + z)); b.a.aS[v + z] = s; b.a.aB[v + z] = 1; });
      b.idx.set([v, v + 1, v + 2, v, v + 2, v + 3], b.ni);
      b.ni += 6; b.nv += 4;
    }
  }
  for (let i = 0; i < NBP; i++) {
    const x = bpX(i), a1 = i * TW, a2 = a1 + GROOVE, r = HX.r * 0.9;
    const e1 = [x, r * Math.cos(a1), r * Math.sin(a1)], e2 = [x, r * Math.cos(a2), r * Math.sin(a2)];
    const m = mix3(e1, e2, 0.5), g = mul(norm(sub(e2, e1)), 0.004), s = Math.abs(x) / HX.half;
    slab(hb, e1, sub(m, g), X0, 0.042, 0.017, BASE[SEQ[i]], s);
    slab(hb, e2, add(m, g), X0, 0.042, 0.017, BASE[PAIR[SEQ[i]]], s);
    for (let k = 0; k < 2; k++) {
      const a = k ? a2 : a1, j = 2 * i + k;
      hpts.attributes.position.array.set([x, HX.r * Math.cos(a), HX.r * Math.sin(a)], 3 * j);
      hpts.attributes.aCol.array.set(mix3(BB[k], [0.4, 0.7, 1], 0.5), 3 * j);
      hpts.attributes.aSize.array[j] = 0.11; hpts.attributes.aA.array[j] = 0.22; hS[j] = Math.abs(x) / HX.half;
    }
  }
  hpts.setAttribute('aS', new THREE.BufferAttribute(hS, 1));
  const uRev = { value: 1 }, uRead = { value: 0 }, uHv = { value: 1 };
  const hMat = litMat('helix', { roughness: 0.26, metalness: 0.05 }, {
    uniforms: { uRev, uRead, uHv },
    head: 'attribute float aS, aB; varying float vS, vX, vB;',
    normal: '#include <beginnormal_vertex>\nvec3 dnaP = position; vS = aS; vX = position.x; vB = aB;',
    fhead: 'uniform float uRev, uRead, uHv; varying float vS, vX, vB;',
    fmain: 'if (vS > uRev) discard;',
    // a soft self-glow (stronger on the thin base slabs, so the letters read by colour), a bright seam where the
    // helix is still being written (fading out as it completes), a glow that runs along it as if reading, and a
    // lift while it fades into the thread (so it goes as a light sheath, not dark smudges)
    emis: `totalEmissiveRadiance += diffuseColor.rgb * (0.12 + 0.3 * vB + 0.55 * exp(-pow((vX - uRead) / 0.35, 2.0)) + 0.6 * (1.0 - uHv))
    + vec3(0.7, 0.9, 1.0) * smoothstep(0.07, 0.0, uRev - vS) * (1.0 - smoothstep(0.93, 1.0, uRev));`,
  });
  const hg = new THREE.Group();
  const hMesh = new THREE.Mesh(geoOf(hb), hMat);
  // the halo fades with the helix (uHv)
  const hGlow = new THREE.Points(hpts, K.points(set, { uniforms: { uRev, uHv }, head: 'attribute float aS; uniform float uRev, uHv;', vertex: 'vA *= step(aS, uRev) * uHv;' }));
  // draw order of the see-through moments: the protein threads, then the chromosome thread, then the helix around it
  hMesh.renderOrder = 2; hGlow.renderOrder = 3;
  hg.add(hMesh, hGlow);
  set.group.add(hg);

  // ======================================================== chromosomes ====
  // lengths (Mb, GRCh38) and centromere position (fraction of the length from the tip of the short arm p)
  const CHR = [[248, .50], [242, .39], [198, .46], [190, .26], [181, .27], [171, .35], [159, .37], [145, .31], [138, .32],
    [134, .30], [135, .39], [133, .27], [114, .15], [107, .16], [102, .18], [90, .41], [83, .30], [80, .23], [59, .44],
    [64, .44], [47, .26], [51, .28], [156, .38]];
  const ROWS = [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9, 10, 11], [12, 13, 14, 15, 16, 17], [18, 19, 20, 21, 22]];
  const MB = 0.52 / 248, PITCH = 0.021, RC = 0.0155, RT = 0.0105, HW = 0.0275, SPACE = 0.265;
  const KAR = [];
  {
    let y = 0;
    const rows = ROWS.map(row => {
      const up = Math.max(...row.map(k => CHR[k][0] * MB * CHR[k][1])), dn = Math.max(...row.map(k => CHR[k][0] * MB * (1 - CHR[k][1])));
      y -= up; const yc = y; y -= dn + 0.1; return yc;
    });
    const top = 0, bottom = y + 0.1, shift = -(top + bottom) / 2;
    ROWS.forEach((row, rw) => row.forEach((k, j) => {
      const x = (j - (row.length - 1) / 2) * SPACE, yc = rows[rw] + shift;
      KAR[k] = { ctr: [x, yc, -0.22 * x * x], L: CHR[k][0] * MB, c: CHR[k][1] };
    }));
  }
  // spectral karyotyping paints each chromosome in its own colour
  const KCOL = CHR.map((_, k) => { const c = new THREE.Color().setHSL((0.55 + k * 0.618034) % 1, 0.62, 0.62); return [c.r, c.g, c.b]; });
  const cb = mesh0({ position: 3, normal: 3, color: 3, aP0: 3, aN0: 3, aC: 4, aPh: 1 }, 34000, 204000);
  {
    const total = 2 * CHR.reduce((s, c) => s + c[0], 0) * MB, sc = 2 * HX.half / total;
    let xc = -HX.half;
    const cr = K.rng(5);
    for (let k = 0; k < 23; k++) {
      const { ctr, L, c } = KAR[k], delay = 0.26 + 0.3 * k / 22, bow = (cr() - 0.5) * 0.04, lean = (cr() - 0.5) * 0.05;
      for (const side of [-1, 1]) {
        const seg = L * sc, x0 = xc; xc += seg;
        const turns = L / PITCH, m = Math.ceil(turns * 8) + 1, C = [], AB = [], CO = [], TR = [], lc = L * Math.max(c, 1 - c);
        for (let i = 0; i < m; i++) {
          const s = i / (m - 1), arm = Math.abs(s - c) * L, tip = Math.min(s, 1 - s) * L;
          // the sister chromatids splay apart towards their tips (in proportion to each arm, so small ones open too)
          const ax = side * (HW + (0.016 + 0.06 * L) * Math.pow(arm / lc, 1.5)) + lean * (c - s), az = bow * Math.sin(PI * s);
          const rc = RC * (1 - 0.5 * Math.exp(-((arm / 0.02) ** 2))) * Math.sqrt(clamp(tip / 0.018, 0.08, 1));
          const ph = side * 2 * PI * turns * s;
          C.push([ctr[0] + ax + rc * Math.cos(ph), ctr[1] + (c - s) * L, ctr[2] + az + rc * Math.sin(ph)]);
          const rt = RT * (0.55 + 0.45 * Math.sqrt(clamp(tip / 0.012, 0, 1)));
          AB.push([rt, rt]); TR.push(0.018 * (0.6 + 0.4 * Math.sqrt(clamp(tip / 0.01, 0, 1))));
          CO.push(mul(KCOL[k], 1 - 0.45 * Math.exp(-((arm / 0.03) ** 2))));
        }
        const T = tangents(C);
        // the uncoiled thread lies along the DNA's axis, each chromatid in its turn (a cord thick enough to read)
        const v0 = sweep(cb, C, T, frames(C, T), AB, 6, (v, i, j) => {
          const cs = RING[6][j][0], sn = RING[6][j][1];
          const co = CO[i]; set3(cb.a.color, v, co[0], co[1], co[2]); set3(cb.a.aP0, v, x0 + seg * i / (m - 1), TR[i] * sn, TR[i] * cs); set3(cb.a.aN0, v, 0, sn, cs);
        });
        fill(cb, 'aC', v0, cb.nv, [ctr[0], ctr[1], ctr[2], delay]); fill(cb, 'aPh', v0, cb.nv, [k * 1.7]);
      }
    }
  }
  const uC = { value: 0 }, uT = { value: 0 };
  const cMat = litMat('chrom', { roughness: 0.42 }, {
    uniforms: { uC, uT },
    head: 'attribute vec3 aP0, aN0; attribute vec4 aC; attribute float aPh; uniform float uC, uT;\n' +
      'vec3 dnaRotY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }',
    // each chromosome coils up from the thread in its turn, flying a little towards you on the way, then sways
    normal: `float ck = smoothstep(aC.w, aC.w + 0.42, uC);
  float sw = 0.4 * sin(uT * 0.3 + aPh) * ck;
  vec3 dnaP = mix(aP0, aC.xyz + dnaRotY(position - aC.xyz, sw), ck) + vec3(0.0, 0.0, 0.35) * sin(3.14159 * ck);
  vec3 objectNormal = normalize(mix(aN0, dnaRotY(normal, sw), ck));`,
    emis: 'totalEmissiveRadiance += diffuseColor.rgb * 0.16;',
  });
  const cMesh = new THREE.Mesh(geoOf(cb), cMat);
  cMesh.frustumCulled = false; cMesh.renderOrder = 1;
  set.group.add(cMesh);
  // a point on chromosome k's axis, a fraction s from the tip of its short arm
  const onChrom = (k, s) => { const { ctr, L, c } = KAR[k]; return [ctr[0], ctr[1] + (c - s) * L, ctr[2]]; };

  // ============================================================ proteins ===
  // Chains are built as in real structures, in ångström: α-helices (3.6 residues per turn, 1.5 Å rise, Cα on a
  // 2.3 Å radius, right-handed), β-strands (3.3 Å per residue) in twisted sheets 4.8 Å apart, helices packed about
  // 10 Å from each other and from sheets, loops that bulge outwards, and floppy low-confidence tails.
  function helix(S, D, n, ph) {
    const [u, v] = basis(D), ca = [], ori = [];
    for (let i = 0; i < n; i++) {
      const a = ph + i * 100 * D2R, o = add(mul(u, Math.cos(a)), mul(v, Math.sin(a)));
      ca.push(add(madd(S, D, 1.5 * i), mul(o, 2.3))); ori.push(o);
    }
    return { t: 'H', ca, ori };
  }
  const helixAt = (C, D, n, ph) => { D = norm(D); return helix(madd(C, D, -0.75 * (n - 1)), D, n, ph || 0); };
  function strandAt(C, D, n, N) {
    D = norm(D);
    const S = madd(C, D, -1.65 * (n - 1)), ca = [], ori = [];
    for (let i = 0; i < n; i++) { ca.push(madd(S, D, 3.3 * i)); ori.push(N); }
    return { t: 'E', ca, ori };
  }
  const Lp = (n, q, w) => ({ t: 'L', n, q, w });   // a loop of n residues (undefined: as many as it needs)
  const tails = (r, a, b, c, d) => [{ t: 'N', n: ri(r, a, b) }, { t: 'C', n: ri(r, c, d) }];
  const wrap = (els, tl) => [tl[0], ...els, tl[1]];
  // a twisted sheet along A with strands spaced along X: specs [{ p: position, d: ±1, n: residues }]
  // (β-sheets twist left-handed seen across the strands, about -18° per strand)
  function sheet(A, X, specs) {
    const Zs = cross(A, X);
    return specs.map(s => strandAt(mul(X, 4.8 * s.p), rot(mul(A, s.d), X, -18 * D2R * s.p), s.n || 5, rot(Zs, X, -18 * D2R * s.p)));
  }
  const moveEls = (els, f, fv) => els.map(e => (e.ca ? Object.assign({}, e, { ca: e.ca.map(f), ori: e.ori.map(fv) }) : e));
  const placeEls = (els, k, a, T) => moveEls(els, p => add(rot(p, k, a), T), v => rot(v, k, a));
  // bend elements along x around a centre Rb below (a curved helix or solenoid)
  const bendEls = (els, Rb) => els.map(e => (e.ca ? Object.assign({}, e, {
    ca: e.ca.map(p => add([0, -Rb, 0], rot([0, Rb + p[1], p[2]], Z0, -p[0] / Rb))), ori: e.ori.map((v, i) => v && rot(v, Z0, -e.ca[i][0] / Rb)) }) : e));
  const core = els => els.filter(e => e.ca);

  // α/β sheets: strands in chain order; a crossover between parallel strands runs through a helix on the face that
  // makes it right-handed (as in nearly all real proteins), neighbours with opposite directions get hairpins
  function sheetFold(r, specs, o = {}) {
    const A = Y0, X = X0, Zs = cross(A, X), sh = sheet(A, X, specs), els = [], used = { 1: [], '-1': [] };
    specs.forEach((s, k) => {
      if (k) {
        const p = specs[k - 1];
        if (s.d === p.d) {
          const face = -Math.sign(s.d * (s.p - p.p)) || 1;
          let hp = (s.p + p.p) / 2 + (r() - 0.5) * 0.3;
          for (let it = 0; it < 8 && used[face].some(u => Math.abs(u - hp) < 2.1); it++) hp += (it % 2 ? -1 : 1) * 1.1 * (it + 1);
          used[face].push(hp);
          const D = rot(mul(A, -s.d), Zs, (r() - 0.5) * 50 * D2R);
          els.push(Lp(), helixAt(add(mul(X, 4.8 * hp), mul(Zs, 10 * face)), D, ri(r, o.h0 || 10, o.h1 || 15), r() * 6), Lp());
        } else els.push(Lp(Math.abs(s.p - p.p) <= 1 ? ri(r, 2, 4) : undefined));
      }
      els.push(sh[k]);
    });
    return els;
  }
  const RECIPES = {
    // SRP9-like α-β-β-β-α: two helices packed on one face of a three-stranded antiparallel sheet
    abm(r, o = {}) {
      const Zs = cross(Y0, X0), sl = o.sl || [ri(r, 5, 7), ri(r, 6, 8), ri(r, 5, 7)];
      const sh = sheet(Y0, X0, [{ p: -1, d: 1, n: sl[0] }, { p: 0, d: -1, n: sl[1] }, { p: 1, d: 1, n: sl[2] }]);
      const h1 = helixAt(add(mul(X0, -5.3), mul(Zs, 10)), rot([0, -1, 0], Zs, 25 * D2R), o.h1 || ri(r, 12, 16), r() * 6);
      const h2 = helixAt(add(mul(X0, 5.3), mul(Zs, 10)), rot([0, -1, 0], Zs, -20 * D2R), o.h2 || ri(r, 13, 17), r() * 6);
      return wrap([h1, Lp(o.l1), sh[0], Lp(ri(r, 2, 3)), sh[1], Lp(ri(r, 2, 3)), sh[2], Lp(o.l2), h2], o.tl || tails(r, 0, 6, 0, 10));
    },
    // Rossmann-like: five parallel strands in the order 3-2-1-4-5, helices on both faces
    ross(r) {
      const n = () => ri(r, 4, 6);
      return wrap(sheetFold(r, [{ p: 0, d: 1, n: n() }, { p: -1, d: 1, n: n() }, { p: -2, d: 1, n: n() }, { p: 1, d: 1, n: n() }, { p: 2, d: 1, n: n() }]), tails(r, 0, 8, 0, 12));
    },
    // flavodoxin-like: parallel strands 2-1-3-4-5
    flav(r) {
      const n = () => ri(r, 4, 6);
      return wrap(sheetFold(r, [{ p: -1, d: 1, n: n() }, { p: -2, d: 1, n: n() }, { p: 0, d: 1, n: n() }, { p: 1, d: 1, n: n() }, { p: 2, d: 1, n: n() }]), tails(r, 2, 14, 0, 6));
    },
    // ferredoxin-like βαββαβ, antiparallel sheet 4-1-3-2, both helices on one face
    fdx(r) {
      const n = () => ri(r, 5, 7);
      return wrap(sheetFold(r, [{ p: -0.5, d: -1, n: n() }, { p: 1.5, d: -1, n: n() }, { p: 0.5, d: 1, n: n() }, { p: -1.5, d: 1, n: n() }], { h0: 11, h1: 15 }), tails(r, 0, 12, 0, 16));
    },
    // a mixed sheet: wander across 4-5 strand positions; jumps go through helices
    mix(r) {
      const m = ri(r, 4, 5), left = [...Array(m).keys()], specs = [];
      let p = left.splice(ri(r, 0, m - 1), 1)[0], d = 1;
      specs.push({ p, d, n: ri(r, 4, 7) });
      while (left.length) {
        const adj = left.filter(q => Math.abs(q - p) === 1);
        const q = adj.length && r() < 0.65 ? adj[ri(r, 0, adj.length - 1)] : left[ri(r, 0, left.length - 1)];
        left.splice(left.indexOf(q), 1);
        d = Math.abs(q - p) === 1 && r() < 0.8 ? -d : d; p = q;
        specs.push({ p, d, n: ri(r, 4, 7) });
      }
      specs.forEach(s => { s.p -= (m - 1) / 2; });
      const els = sheetFold(r, specs);
      if (r() < 0.5) els.unshift(helixAt([0, 0, -11], rot([1, 0, 0], Y0, (r() - 0.5) * 0.8), ri(r, 12, 18), 0), Lp());
      return wrap(els, tails(r, 0, 14, 0, 14));
    },
    // up-and-down helix bundles (three or four helices, slightly supercoiled)
    bun(r, o = {}) {
      const nH = o.n || ri(r, 3, 4), rad = nH === 3 ? 5.8 : 7.1, ln = o.len || ri(r, 15, 24), els = [];
      for (let k = 0; k < nH; k++) {
        const a = k * 2 * PI / nH, u = [Math.cos(a), 0, Math.sin(a)];
        if (k) els.push(Lp(ri(r, 2, 5)));
        els.push(helixAt(madd(mul(u, rad), Y0, (r() - 0.5) * 4), rot([0, k % 2 ? -1 : 1, 0], u, -14 * D2R), ln + ri(r, -3, 3), r() * 6));
      }
      return o.bare ? els : wrap(els, tails(r, 0, 14, 0, 18));
    },
    // globin-like all-α: 6-8 helices of different lengths around a core
    glob(r, o = {}) {
      const nH = o.n || ri(r, 6, 8), R = o.R || 9.5, cs = [], els = [];
      let u = K.unit(r), prevEnd = null;
      for (let k = 0; k < nH; k++) {
        if (k) {
          let best = u, bs = -1;
          for (let it = 0; it < 16; it++) {
            const c = rot(u, norm(cross(u, K.unit(r))), (62 + 25 * r()) * D2R);
            const s = Math.min(...cs.map(q => Math.acos(clamp(dot(q, c), -1, 1))));
            if (s > bs) { bs = s; best = c; }
          }
          u = best;
        }
        cs.push(u);
        const n = o.len ? ri(r, o.len[0], o.len[1]) : ri(r, 8, 19), c = mul(u, R), [t1, t2] = basis(u), a = r() * PI;
        let D = add(mul(t1, Math.cos(a)), mul(t2, Math.sin(a)));
        if (prevEnd && dist(madd(c, D, -0.75 * n), prevEnd) > dist(madd(c, D, 0.75 * n), prevEnd)) D = mul(D, -1);
        const h = helixAt(c, D, n, r() * 6);
        if (k) els.push(Lp());
        els.push(h); prevEnd = h.ca[n - 1];
      }
      return o.bare ? els : wrap(els, tails(r, 0, 10, 0, 12));
    },
    // Ig-like β-sandwich: two sheets packed face to face
    ig(r) {
      const Zs = cross(Y0, X0), A2 = rot(Y0, Zs, -30 * D2R), X2 = rot(X0, Zs, -30 * D2R);
      const seq = [[1, 1], [1, 0], [2, 0], [2, 1], [1, 2], [1, 3], [2, 2]], els = [];
      seq.forEach(([sh, p], k) => {
        const A = sh === 1 ? Y0 : A2, X = sh === 1 ? X0 : X2, ps = sh === 1 ? p - 1.5 : p - 1, z = sh === 1 ? 5 : -5;
        const d = k % 2 ? -1 : 1, n = ri(r, 6, 9), a = -18 * D2R * ps;
        if (k) els.push(Lp());
        els.push(strandAt(add(mul(X, 4.8 * ps), mul(Zs, -z)), rot(mul(A, d), X, a), n, rot(Zs, X, a)));
      });
      return wrap(els, tails(r, 0, 10, 0, 14));
    },
    // small β-barrel (SH3/OB-like): five strands on a cylinder, tilted
    bar(r) {
      const els = [];
      for (let k = 0; k < 5; k++) {
        const th = k * 72 * D2R, rad = [Math.cos(th), 0, Math.sin(th)];
        if (k) els.push(Lp(k === 3 ? undefined : ri(r, 2, 4)));
        els.push(strandAt(mul(rad, 7.5), rot([0, k % 2 ? -1 : 1, 0], rad, 40 * D2R), ri(r, 5, 8), rad));
      }
      if (r() < 0.5) els.push(Lp(), helixAt([0, -13, 2], [1, 0.2, 0.3], ri(r, 9, 13), 0));
      return wrap(els, tails(r, 0, 12, 0, 16));
    },
    // TIM barrel: eight parallel strands inside, eight helices outside, right-handed βα crossovers
    tim(r) {
      const els = [];
      for (let i = 0; i < 8; i++) {
        const th = -i * 45 * D2R, rad = [Math.cos(th), 0, Math.sin(th)], t2 = th - 22.5 * D2R, rad2 = [Math.cos(t2), 0, Math.sin(t2)];
        if (i) els.push(Lp());
        els.push(strandAt(mul(rad, 7.3), rot(Y0, rad, 36 * D2R), 5, rad), Lp(), helixAt(mul(rad2, 16.5), rot([0, -1, 0], rad2, -18 * D2R), ri(r, 11, 14), r() * 6));
      }
      return wrap(els, tails(r, 0, 8, 0, 10));
    },
    // α-solenoid (HEAT-like): stacked helix pairs, twisting and curving
    sol(r) {
      const k = ri(r, 5, 7), els = [];
      for (let j = 0; j < k; j++) {
        const x = 9.6 * (j - (k - 1) / 2), g = j * 14 * D2R, tw = p => rot(p, X0, g);
        if (j) els.push(Lp(ri(r, 3, 5)));
        els.push(helixAt(tw([x, 0, -5]), tw([0.15, 1, 0]), ri(r, 11, 14), r() * 6), Lp(ri(r, 2, 4)),
          helixAt(tw([x + 1.5, 0, 5]), tw([0.1, -1, 0]), ri(r, 11, 14), r() * 6));
      }
      return wrap(bendEls(els, 55), tails(r, 0, 10, 0, 14));
    },
    // seven transmembrane helices in a ring (receptor-like): N-terminus outside, a short helix 8 inside, then the tail
    tm7(r) {
      const els = [];
      for (let k = 0; k < 7; k++) {
        const th = (k * 360 / 7 + 10 * (r() - 0.5)) * D2R, u = [Math.cos(th), 0, Math.sin(th)];
        if (k) els.push(k === 5 ? Lp(ri(r, 10, 15), -25, 2) : Lp(ri(r, 3, 6)));
        els.push(helixAt([12 * u[0], 0, 9.5 * u[2]], rot([0, k % 2 ? 1 : -1, 0], u, (r() - 0.5) * 30 * D2R), ri(r, 21, 25), r() * 6));
      }
      const e = els[els.length - 1].ca, end = e[e.length - 1], out = norm([end[0], 0, end[2]]);
      els.push(Lp(3), helixAt(add(add(end, [0, -5, 0]), mul(cross(Y0, out), -7)), cross(Y0, out), ri(r, 9, 11), 0));
      return wrap(els, tails(r, 14, 26, 10, 22));
    },
    // C2H2 zinc fingers: β-hairpin plus helix, three or four in a row along a spiral
    znf(r) {
      const nf = ri(r, 3, 4), els = [];
      for (let j = 0; j < nf; j++) {
        const a = j * 100 * D2R, T = [10 * Math.cos(a), j * 11 - (nf - 1) * 5.5, 10 * Math.sin(a)];
        const f = [strandAt([-2.4, 2, 0], Y0, 3, Z0), Lp(2), strandAt([2.4, 2, 0], [0, -1, 0], 3, Z0), Lp(2), helixAt([1, 0, -8.5], [0.2, 1, 0.1], 12, r() * 6)];
        if (j) els.push(Lp(5, -10));
        els.push(...placeEls(f, Y0, a + PI / 2, T));
      }
      return wrap(els, tails(r, 6, 18, 4, 14));
    },
    // leucine-rich repeats: a horseshoe, parallel strands inside, helices outside
    lrr(r) {
      const n = ri(r, 9, 12), dp = 4.8 / 20, els = [];
      for (let j = 0; j < n; j++) {
        const p = (j - (n - 1) / 2) * dp, u = [Math.cos(p), Math.sin(p), 0], u2 = [Math.cos(p + dp / 2), Math.sin(p + dp / 2), 0];
        if (j) els.push(Lp(ri(r, 3, 4)));
        els.push(strandAt(mul(u, 20), Z0, 3, u), Lp(ri(r, 3, 4)), helixAt(mul(u2, 30), [0, 0, -1], ri(r, 6, 8), r() * 6));
      }
      return wrap(placeEls(els, Z0, 0, [-25, 0, 0]), tails(r, 0, 8, 0, 10));
    },
    // calmodulin-like dumbbell: two four-helix lobes joined by a long central helix
    cam(r) {
      const l1 = RECIPES.glob(r, { n: 4, R: 7, len: [9, 12], bare: true }), l2 = RECIPES.glob(r, { n: 4, R: 7, len: [9, 12], bare: true });
      const c = helixAt([0, 0, 0], [1, 0.1, 0], ri(r, 22, 28), 0);
      return wrap([...placeEls(l1, Y0, 0, [-28, -3, 0]), Lp(), c, Lp(), ...placeEls(l2, Y0, PI, [28, 3, 0])], tails(r, 0, 8, 0, 6));
    },
    // two helices in an antiparallel coiled-coil hairpin, with floppy ends
    cc(r) {
      const n = ri(r, 24, 32);
      return wrap([helixAt([-4.8, 0, 0], rot(Y0, Z0, 9 * D2R), n, 0), Lp(ri(r, 3, 5)), helixAt([4.8, 0, 0], rot([0, -1, 0], Z0, -9 * D2R), n, 1)], tails(r, 6, 20, 10, 28));
    },
    // two domains on a flexible linker
    two(r) {
      const a = RECIPES.bun(r, { n: 3, len: ri(r, 13, 17), bare: true });
      const b = r() < 0.5 ? RECIPES.abm(r).slice(1, -1) : RECIPES.bar(r).slice(1, -1);
      return wrap([...placeEls(a, K.unit(r), r() * 6, [-17, -2, 0]), Lp(ri(r, 9, 14), -30, 3), ...placeEls(b, K.unit(r), r() * 6, [17, 3, 2])], tails(r, 0, 12, 0, 12));
    },
    // mostly disordered, with a small folded core
    dis(r) {
      return wrap(RECIPES.bun(r, { n: 3, len: ri(r, 10, 13), bare: true }), tails(r, 24, 40, 20, 34));
    },
    // a single long, gently curved helix with floppy ends (GNG5-like)
    lhx(r, o = {}) {
      const n = o.n || ri(r, 30, 44);
      return wrap(bendEls([helixAt([0, 0, 0], X0, n, 0)], 70), o.tl || tails(r, 4, 12, 8, 22));
    },
  };
  // the long helix of GNG5 is surer in its middle than at its ends
  const confFns = {
    GNG5: (e, i, m) => (e.t === 'H' ? 1 - 18 * Math.pow(Math.abs(2 * i / (m - 1) - 1), 1.5) : 0),
  };

  // fill in loops and tails, and give every residue a confidence (pLDDT, 0-100) as AlphaFold would
  function loopPts(A, dA, B, dB, n, C, r, w) {
    const d = dist(A, B);
    n = Math.max(n === undefined ? Math.round(d / 3.4) + ri(r, 1, 2) : n, Math.ceil(d / 3.7) - 1, 1);
    const target = 3.8 * (n + 1), ch = norm(sub(B, A)), mid = mix3(A, B, 0.5);
    let out = sub(mid, C);
    out = sub(out, mul(ch, dot(out, ch)));
    out = len(out) < 1 ? basis(ch)[0] : norm(out);
    const h = Math.min(6, 0.25 * d + 2.5);
    // a cubic Bézier leaving A along dA and arriving at B along dB, bulged outwards until it is long enough
    const bez = (bulge, m) => {
      const P1 = madd(madd(A, dA, h), out, bulge), P2 = madd(madd(B, dB, -h), out, bulge), pts = [];
      for (let k = 0; k <= m; k++) {
        const t = k / m, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t;
        pts.push([a * A[0] + b * P1[0] + c * P2[0] + e * B[0], a * A[1] + b * P1[1] + c * P2[1] + e * B[1], a * A[2] + b * P1[2] + c * P2[2] + e * B[2]]);
      }
      return pts;
    };
    let bulge = 0;
    for (let it = 0; it < 16; it++) {
      const q = bez(bulge, 12);
      let L = 0; for (let k = 1; k < q.length; k++) L += dist(q[k], q[k - 1]);
      if (L >= target * 0.96) break;
      bulge += Math.max(1.2, (target - L) * 0.45);
    }
    const pts = bez(bulge, 24);
    // resample n points at equal arc length strictly between A and B
    const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + dist(pts[k], pts[k - 1]));
    const out2 = [];
    for (let k = 1, j = 1; k <= n; k++) {
      const s = cum[cum.length - 1] * k / (n + 1);
      while (cum[j] < s && j < cum.length - 1) j++;
      const f = (s - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
      out2.push(madd(mix3(pts[j - 1], pts[j], f), K.unit(r), (0.35 + w) * r()));
    }
    return out2;
  }
  function tailPts(P, dir, n, C, Rc, r) {
    const pts = [], turn = 0.2 + 0.25 * r();
    let p = P, d = norm(add(norm(dir), norm(sub(P, C)))), ax = K.unit(r);
    for (let i = 0; i < n; i++) {
      ax = norm(madd(ax, K.unit(r), 0.7));
      d = rot(d, ax, turn);
      const o = sub(p, C), ro = len(o);
      if (ro > Rc + 11) d = norm(madd(d, o, -0.9 / ro));
      else if (ro < Rc * 0.85) d = norm(madd(d, o, 1.0 / ro));
      p = madd(p, d, 3.8); pts.push(p);
    }
    return pts;
  }
  const startDir = e => (e.t === 'H' ? norm(sub(e.ca[Math.min(4, e.ca.length - 1)], e.ca[0])) : norm(sub(e.ca[e.ca.length - 1], e.ca[0])));
  const endDir = e => (e.t === 'H' ? norm(sub(e.ca[e.ca.length - 1], e.ca[Math.max(0, e.ca.length - 5)])) : norm(sub(e.ca[e.ca.length - 1], e.ca[0])));
  function chain(els, r, o = {}) {
    const cs = core(els);
    let C = [0, 0, 0], cnt = 0, Rc = 0;
    for (const e of cs) for (const p of e.ca) { C = add(C, p); cnt++; }
    C = mul(C, 1 / cnt);
    for (const e of cs) for (const p of e.ca) Rc = Math.max(Rc, dist(p, C));
    const ca = [], ss = [], ori = [], pl = [], q0 = o.q || 0, cf = o.cf || (() => 0);
    els.forEach((e, k) => {
      if (e.ca) {
        const m = e.ca.length;
        e.ca.forEach((p, i) => { ca.push(p); ss.push(e.t); ori.push(e.ori[i]); pl.push((i === 0 || i === m - 1 ? 84 + 8 * r() : 90 + 7 * r()) + q0 + cf(e, i, m)); });
      } else if (e.t === 'L') {
        const a = els[k - 1], b = els[k + 1], pts = loopPts(a.ca[a.ca.length - 1], endDir(a), b.ca[0], startDir(b), e.n, C, r, e.w || 0), m = pts.length;
        pts.forEach((p, i) => {
          const mid = Math.sin(PI * (i + 1) / (m + 1)) * clamp((m - 4) / 9, 0, 1);
          ca.push(p); ss.push('L'); ori.push(null); pl.push(87 + 6 * r() - 26 * mid + (e.q || 0) + q0);
        });
      }
    });
    const tail = (e, P, d) => tailPts(P, d, e.n, C, Rc, r).map((p, i) => [p, 70 - 44 * Math.pow((i + 1) / e.n, 0.8) + 8 * (r() - 0.5) + q0 * 0.5]);
    const f = els[0], l = els[els.length - 1];
    if (f.t === 'N' && f.n > 0) {
      const t = tail(f, ca[0], mul(startDir(cs[0]), -1)).reverse();
      ca.unshift(...t.map(x => x[0])); pl.unshift(...t.map(x => x[1])); ss.unshift(...t.map(() => 'L')); ori.unshift(...t.map(() => null));
    }
    if (l.t === 'C' && l.n > 0) {
      const t = tail(l, ca[ca.length - 1], endDir(cs[cs.length - 1]));
      ca.push(...t.map(x => x[0])); pl.push(...t.map(x => x[1])); ss.push(...t.map(() => 'L')); ori.push(...t.map(() => null));
    }
    return { ca, ss, ori, pl: pl.map(v => clamp(v, 20, 98)) };
  }

  // the 25 chains of the grid: three real proteins (in the shape of their AlphaFold models), then 22 illustrative folds
  function srp9(r) {   // 86 residues
    return chain(RECIPES.abm(r, { sl: [7, 8, 7], h1: 17, h2: 18, l1: 4, l2: 5, tl: [{ t: 'N', n: 2 }, { t: 'C', n: 12 }] }), r);
  }
  function lenep(r) {   // 61 residues (UniProt Q9Y5L5), mostly disordered: two short helices of low confidence
    const h1 = helixAt([-6, 2, 0], [1, 0.3, 0.2], 12, 0), h2 = helixAt([6, -5, 4], [-0.2, 1, 0.4], 9, 1);
    h1.q = -28; h2.q = -22;
    return chain([{ t: 'N', n: 19 }, h1, Lp(9, -32, 2.5), h2, { t: 'C', n: 12 }], r, { cf: e => e.q || 0 });
  }
  function gng5(r) {   // 68 residues: one long helix with floppy ends
    return chain(RECIPES.lhx(r, { n: 38, tl: [{ t: 'N', n: 9 }, { t: 'C', n: 21 }] }), r, { cf: confFns.GNG5 });
  }
  const GRID_KINDS = ['tim', 'bun', 'ig', 'tm7', 'ross', 'cc', 'lrr', 'glob', 'bar', 'sol', 'fdx', 'znf', 'cam', 'mix', 'two',
    'flav', 'dis', 'glob', 'ig', 'mix', 'bar', 'bun'];
  const NAMES = ['SRP9', 'LENEP', 'GNG5'];
  const GENES = [[0, 0.907], [0, 0.622], [0, 0.34]];   // all three on chromosome 1: 1q42.12, 1q21.3, 1p22.3
  const folds = [srp9(K.rng(901)), lenep(K.rng(902)), gng5(K.rng(903))];
  GRID_KINDS.forEach((k, i) => { const r = K.rng(1000 + i * 17); folds.push(chain(RECIPES[k](r), r, { q: r() < 0.3 ? -6 : 0 })); });
  const MINI_KINDS = ['tim', 'bun', 'ig', 'tm7', 'ross', 'cc', 'lrr', 'glob', 'bar', 'sol', 'fdx', 'znf', 'cam', 'mix', 'two', 'flav', 'dis', 'abm', 'lhx'];

  // AlphaFold confidence colours: very high, confident, low, very low
  const AF = ['#0053d6', '#65cbf3', '#ffdb13', '#ff7d45'].map(K.rgb);
  const afCol = p => AF[p >= 90 ? 0 : p >= 70 ? 1 : p >= 50 ? 2 : 3];
  // centre on the confident core and size to fit; returns a copy turned by the rotation (k, a)
  function fit(ch, target, k, a) {
    if (!ch.fit) {
      let C = [0, 0, 0], n = 0;
      ch.ca.forEach((p, i) => { if (ch.pl[i] >= 70) { C = add(C, p); n++; } });
      C = mul(C, 1 / Math.max(n, 1));
      const ds = ch.ca.map(p => dist(p, C)).sort((x, y) => x - y), R90 = ds[Math.floor(ds.length * 0.9)], Rm = ds[ds.length - 1];
      ch.fit = { C, s: Math.min(1 / R90 * Math.pow(R90 / 22, 0.3), 1.25 / Rm) };
    }
    const [cx, cy, cz] = ch.fit.C, M = rotM(k, a);
    return { ca: ch.ca.map(p => mulM(M, [p[0] - cx, p[1] - cy, p[2] - cz])), ori: ch.ori.map(v => v && mulM(M, v)), ss: ch.ss, pl: ch.pl, s: ch.fit.s * target };
  }
  // the cartoon: samples along a Catmull-Rom spline through the Cα atoms with ribbon targets, half-axes and colours
  const PROF = { H: [1.5, 0.38, 1], E: [1.6, 0.38, 1], L: [0.5, 0.5, 0] };   // half-axes in Å, and ribbon or not
  const crs = (P, i, f) => {
    const p0 = P[Math.max(i - 1, 0)], p1 = P[i], p2 = P[Math.min(i + 1, P.length - 1)], p3 = P[Math.min(i + 2, P.length - 1)], f2 = f * f, f3 = f2 * f;
    const q = k => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * f3);
    return [q(0), q(1), q(2)];
  };
  function cartoon(ch, sh, so, sc) {
    const n = ch.ca.length, xs = [], ends = [];
    for (let i = 0; i < n; i++) if (ch.ss[i] === 'E' && ch.ss[i + 1] !== 'E') ends.push(i);
    for (let i = 0; i < n - 1; i++) {
      const m = ch.ss[i] === 'H' || ch.ss[i + 1] === 'H' ? sh : so;
      for (let j = 0; j < m; j++) xs.push(i + j / m);
    }
    xs.push(n - 1);
    for (const e of ends) if (e >= 1.05) xs.push(e - 1.04);   // a crisp arrow base
    xs.sort((a, b) => a - b);
    for (let i = xs.length - 1; i > 0; i--) if (xs[i] - xs[i - 1] < 0.01) xs.splice(i, 1);
    const C = [], G = [], W = [], AB = [], COL = [];
    for (const x of xs) {
      const i = Math.min(Math.floor(x), n - 2), f = x - i, a = PROF[ch.ss[i]], b = PROF[ch.ss[i + 1]], c = crs(ch.ca, i, f);
      C.push([c[0] * sc, c[1] * sc, c[2] * sc]);
      const oa = ch.ori[i], ob = ch.ori[i + 1];
      G.push(oa && ob ? mix3(oa, ob, f) : oa || ob);
      W.push((a[2] ? 1 - f : 0) + (b[2] ? f : 0));
      let ab0 = a[0] + (b[0] - a[0]) * f, ab1 = a[1] + (b[1] - a[1]) * f;
      for (const e of ends) if (x >= e - 1 && x <= e + 0.6) { const u = (x - e + 1) / 1.6; ab0 = 2.5 + (0.5 - 2.5) * u; ab1 = 0.38 + 0.12 * u; }
      AB.push([ab0 * sc, ab1 * sc]);
      COL.push(afCol(ch.pl[Math.round(x)]));
    }
    return { C, G, W, AB, COL, xs };
  }

  // ---- the 5 x 5 grid, on a gently curved wall facing +z
  const GRID = 0.42, FOLD_N = 25;
  const gridAt = k => { const x = (k % 5 - 2) * GRID, y = (2 - Math.floor(k / 5)) * GRID; return [x, y, -0.14 * (x * x + y * y)]; };
  const gb = mesh0({ position: 3, normal: 3, color: 3, aP0: 3, aN0: 3, aG: 3, aCtr: 3, aSpin: 4, aK: 2, aU: 1 }, 64000, 380000);
  const geneOf = [];
  {
    const gr = K.rng(77), tot = CHR.reduce((s, c) => s + c[0], 0);
    for (let k = 0; k < FOLD_N; k++) {
      let g = GENES[k];
      if (!g) { let x = gr() * tot, c = 0; while (x > CHR[c][0]) x -= CHR[c++][0]; g = [c, 0.05 + 0.9 * gr()]; }
      geneOf.push(onChrom(g[0], g[1]));
    }
  }
  folds.slice(0, FOLD_N).forEach((ch, k) => {
    const r = K.rng(300 + k), ctr = gridAt(k);
    // turn each chain to show its best side; the three named ones are set by hand
    const turn = [[[0, 1, 0], 0.5], [[1, 0, 0], 0.4], [[0, 0, 1], 0.6]][k] || [K.unit(r), r() * 6];
    const f = fit(ch, 0.165, turn[0], turn[1]), s = f.s, cart = cartoon(f, 3, 2, s), C = cart.C, AB = cart.AB, T = tangents(C), N = frames(C, T, cart.G, cart.W);
    const spin = norm([(r() - 0.5) * 0.3, 1, (r() - 0.5) * 0.3]), sp = (0.1 + 0.1 * r()) * (r() < 0.5 ? -1 : 1);
    // (the last chain leaves its gene before the chromosomes fade, at dna_fold 0.36)
    const delay = 0.04 + 0.3 * k / (FOLD_N - 1), ph = r() * 6;
    // the unfolded chain: a thin wavy thread at its gene, about to fold
    const n = f.ca.length, Lu = 0.12 + 0.18 * Math.sqrt(n / 120), du = norm([1, (r() - 0.5) * 0.6, (r() - 0.5) * 0.4]), [w1, w2] = basis(du), rr = 0.5 * s;
    const U0 = cart.xs.map(x => { x /= n - 1; return add(madd(mul(du, (x - 0.5) * Lu), w1, 0.012 * Math.sin(x * 19 + k)), mul(w2, 0.01 * Math.cos(x * 13 + k))); });
    const O = RING[8].map(([cs, sn]) => add(mul(w1, cs), mul(w2, sn)));
    const v0 = sweep(gb, C, T, N, AB, 8, (v, i, j) => {
      const u = U0[i], o = O[j];
      const co = cart.COL[i]; set3(gb.a.color, v, co[0], co[1], co[2]); set3(gb.a.aP0, v, u[0] + o[0] * rr, u[1] + o[1] * rr, u[2] + o[2] * rr); set3(gb.a.aN0, v, o[0], o[1], o[2]);
      gb.a.aU[v] = cart.xs[i] / (n - 1);
    });
    fill(gb, 'aG', v0, gb.nv, geneOf[k]); fill(gb, 'aCtr', v0, gb.nv, ctr); fill(gb, 'aSpin', v0, gb.nv, [...spin, sp]); fill(gb, 'aK', v0, gb.nv, [delay, ph]);
  });
  const uF = { value: 0 }, uFld = { value: 0 };
  const fMat = litMat('fold', { roughness: 0.48 }, {
    uniforms: { uF, uT, uFld, uRb },
    head: 'attribute vec3 aP0, aN0, aG, aCtr; attribute vec4 aSpin; attribute vec2 aK; attribute float aU; uniform float uF, uT, uRb;\n' + ROT_GLSL + RB_GLSL,
    // threads grow out of their genes, fly to their places and fold, slowly turning
    normal: `float fk = smoothstep(aK.x, aK.x + 0.5, uF);
  float gr = smoothstep(aK.x * 0.3, aK.x * 0.3 + 0.08, uF);
  float ang = aK.y + uT * aSpin.w;
  vec3 dnaP = mix(aG + aP0 * gr, aCtr + dnaRot(position, aSpin.xyz, ang), fk) + vec3(0.0, 0.0, 0.3) * sin(3.14159 * fk);
  vec3 objectNormal = normalize(mix(aN0, dnaRot(normal, aSpin.xyz, ang), fk));
  #ifdef USE_COLOR
  vColor = mix(vec3(0.85, 0.9, 1.0), mix(vColor, dnaRb(aU), uRb), smoothstep(0.35, 0.9, fk));
  #endif`,
    fhead: 'uniform float uFld;',
    emis: 'totalEmissiveRadiance += diffuseColor.rgb * (0.22 + 0.5 * uFld);',
  });
  const fMesh = new THREE.Mesh(geoOf(gb), fMat);
  fMesh.frustumCulled = false;
  set.group.add(fMesh);

  // ================================================================ field ==
  // About 20,000 proteins: the 25, 40 more as small cartoons near the camera's path, 200 as chains of Cα beads,
  // and the rest as points, further and further out. A tunnel along the field views keeps the grid in sight.
  const FAZ = 12, FEL = 8;
  const fdir = az => [Math.cos(FEL * D2R) * Math.sin(az * D2R), Math.sin(FEL * D2R), Math.cos(FEL * D2R) * Math.cos(az * D2R)];
  const inTunnel = (p, rad) => {
    const az = clamp(Math.atan2(p[0], p[2]) / D2R, FAZ - 8, FAZ + 24), d = fdir(az), al = dot(p, d);
    if (al <= 0) return false;
    const x = p[0] - d[0] * al, y = p[1] - d[1] * al, z = p[2] - d[2] * al, q = rad + 0.05 * al;
    return x * x + y * y + z * z < q * q;
  };
  const inGrid = p => Math.abs(p[0]) < 1.45 && Math.abs(p[1]) < 1.45 && Math.abs(p[2]) < 0.75;
  const reveal = rad => 0.92 * Math.pow(clamp((rad - 1.5) / 13, 0, 1), 0.75);
  const fr = K.rng(4242), placed = [];
  function spot(r0, r1, pw, tun, gap) {
    for (let it = 0; it < 400; it++) {
      const p = mul(K.unit(fr), r0 + (r1 - r0) * Math.pow(fr(), pw));
      if (inGrid(p) || inTunnel(p, tun) || placed.some(q => dist(p, q) < gap)) continue;
      placed.push(p); return p;
    }
    return mul(K.unit(fr), r1 + 2);
  }
  // mini cartoons (merged into one mesh; each one a different fold)
  const MINI_N = 32, BEAD_N = 200, FIELD_N = 20000;
  const mb = mesh0({ position: 3, normal: 3, color: 3, aCtr: 3, aSpin: 4, aK: 2, aU: 1 }, 48000, 280000);
  const traces = folds.slice(0, FOLD_N);
  for (let k = 0; k < MINI_N; k++) {
    const r = K.rng(5000 + k * 31), kind = MINI_KINDS[ri(r, 0, MINI_KINDS.length - 1)], ch = chain(RECIPES[kind](r), r, { q: r() < 0.3 ? -8 : 0 });
    traces.push(ch);
    const f = fit(ch, 0.165, K.unit(r), r() * 6), cart = cartoon(f, 2, 1, f.s), C = cart.C, AB = cart.AB, T = tangents(C), N = frames(C, T, cart.G, cart.W);
    const ctr = spot(1.75, 3.9, 0.8, 1.6, 0.55), spin = K.unit(r), sp = (0.08 + 0.1 * r()) * (r() < 0.5 ? -1 : 1), th = reveal(len(ctr)), ph = r() * 6;
    const v0 = sweep(mb, C, T, N, AB, 6, (v, i) => { const co = cart.COL[i]; set3(mb.a.color, v, co[0], co[1], co[2]); mb.a.aU[v] = cart.xs[i] / (f.ca.length - 1); });
    fill(mb, 'aCtr', v0, mb.nv, ctr); fill(mb, 'aSpin', v0, mb.nv, [...spin, sp]); fill(mb, 'aK', v0, mb.nv, [th, ph]);
  }
  const mMat = litMat('mini', { roughness: 0.5 }, {
    uniforms: { uFld, uT, uRb },
    head: 'attribute vec3 aCtr; attribute vec4 aSpin; attribute vec2 aK; attribute float aU; uniform float uFld, uT, uRb;\n' + ROT_GLSL + RB_GLSL,
    normal: `float ang = aK.y + uT * aSpin.w, gv = smoothstep(aK.x, aK.x + 0.07, uFld);
  vec3 dnaP = aCtr + dnaRot(position, aSpin.xyz, ang) * gv;
  vec3 objectNormal = dnaRot(normal, aSpin.xyz, ang);
  #ifdef USE_COLOR
  vColor = mix(vColor, dnaRb(aU), uRb);
  #endif`,
    emis: 'totalEmissiveRadiance += diffuseColor.rgb * 0.22;',
  });
  const mMesh = new THREE.Mesh(geoOf(mb), mMat);
  mMesh.frustumCulled = false;
  set.group.add(mMesh);
  // Cα bead chains, then single points
  const beadOf = k => traces[(k * 7) % traces.length];
  const nBeads = (() => { let s = 0; for (let k = 0; k < BEAD_N; k++) s += beadOf(k).ca.length; return s; })();
  const FAR_N = FIELD_N - FOLD_N - MINI_N - BEAD_N;
  const pg = K.pointsGeo(nBeads + FAR_N);
  const pCtr = new Float32Array((nBeads + FAR_N) * 3), pSpin = new Float32Array((nBeads + FAR_N) * 4), pK = new Float32Array((nBeads + FAR_N) * 2);
  const pU = new Float32Array(nBeads + FAR_N).fill(-1);   // place along the chain (beads), -1 for single points
  {
    const P = pg.attributes.position.array, Cc = pg.attributes.aCol.array, Sz = pg.attributes.aSize.array, Aa = pg.attributes.aA.array;
    let o = 0;
    for (let k = 0; k < BEAD_N; k++) {
      const r = K.rng(7000 + k), ch = beadOf(k), f = fit(ch, 0.165, K.unit(r), r() * 6);
      const ctr = spot(2.6, 7.5, 0.9, 1.6, 0.45), spin = K.unit(r), sp = (0.08 + 0.1 * r()) * (r() < 0.5 ? -1 : 1), th = reveal(len(ctr)), ph = r() * 6;
      f.ca.forEach((p, i) => {
        set3(P, o, p[0] * f.s, p[1] * f.s, p[2] * f.s); Cc.set(afCol(f.pl[i]), 3 * o); Sz[o] = 0.034; Aa[o] = 0.75;
        pCtr.set(ctr, 3 * o); pSpin.set(spin, 4 * o); pSpin[4 * o + 3] = sp; pK[2 * o] = th; pK[2 * o + 1] = ph; pU[o] = i / (f.ca.length - 1); o++;
      });
    }
    // the rest: one point each, coloured by the share of confident structure
    for (let k = 0; k < FAR_N; k++, o++) {
      let p, rad;
      for (let it = 0; it < 30; it++) { rad = 3.4 + 11.5 * Math.pow(fr(), 1.25); p = mul(K.unit(fr), rad); if (!inTunnel(p, 1.5) && !inGrid(p)) break; }
      const u = fr(), c = AF[u < 0.5 ? 0 : u < 0.8 ? 1 : u < 0.92 ? 2 : 3], b = 0.65 + 0.35 * fr();
      set3(pCtr, o, p[0], p[1], p[2]); set3(Cc, o, c[0] * b, c[1] * b, c[2] * b); Sz[o] = 0.06 + 0.08 * fr(); Aa[o] = 0.6;
      pSpin[4 * o + 1] = 1; pK[2 * o] = reveal(rad);
    }
  }
  pg.setAttribute('aCtr', new THREE.BufferAttribute(pCtr, 3));
  pg.setAttribute('aSpin', new THREE.BufferAttribute(pSpin, 4));
  pg.setAttribute('aK', new THREE.BufferAttribute(pK, 2));
  pg.setAttribute('aU', new THREE.BufferAttribute(pU, 1));
  const pMat = K.points(set, {
    uniforms: { uFld, uT, uRb },
    head: 'attribute vec3 aCtr; attribute vec4 aSpin; attribute vec2 aK; attribute float aU; uniform float uFld, uT, uRb;\n' + ROT_GLSL + RB_GLSL,
    // appear outwards with the zoom, and fade where they would pass right by the eye
    vertex: `if (aU >= 0.0) vC = mix(vC, dnaRb(aU), uRb);
  pos = aCtr + dnaRot(position, aSpin.xyz, aK.y + uT * aSpin.w);
  mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize, mv);
  vA *= smoothstep(aK.x, aK.x + 0.07, uFld) * smoothstep(1.0, 4.0, -mv.z);`,
  });
  const pts = new THREE.Points(pg, pMat);
  pts.frustumCulled = false; pts.renderOrder = 2;
  set.group.add(pts);

  // a glowing frame marks the 25 as a patch in the field
  const FR = 2 * GRID + 0.27, frg = K.linesGeo(40);
  {
    const zc = (x, y) => -0.14 * (x * x + y * y) + 0.02, P = frg.attributes.position.array, Cl = frg.attributes.aCol.array;
    let o = 0;
    for (let e = 0; e < 4; e++) for (let k = 0; k < 10; k++) {
      const q = [k / 10, (k + 1) / 10].map(u => { const a = -FR + 2 * FR * u; return [[a, -FR], [FR, a], [-a, FR], [-FR, -a]][e]; });
      for (const [x, y] of q) { set3(P, o, x, y, zc(x, y)); set3(Cl, o, 0.27, 0.85, 1); frg.attributes.aT.array[o] = (e * 10 + k + 1) / 40; frg.attributes.aA.array[o] = 0.7; o++; }
    }
  }
  const frm = K.lines(set);
  const frame = new THREE.LineSegments(frg, frm);
  frame.renderOrder = 2;
  set.group.add(frame);

  // =============================================================== update ==
  const cur = { rot: 0, sq: 1 };   // the helix's turn and squeeze, for the base-pair anchor
  function update(S, t) {
    // the proteins count as folded in the field look too (explore can ease params in any order)
    const f = Math.max(S.dna_fold, S.dna_field), a = set.uA.value;
    uT.value = t; uC.value = S.dna_chrom; uF.value = f; uFld.value = S.dna_field;
    // the helix writes itself from the middle outwards, turns slowly, and thins into a thread as it coils up
    const hv = S.dna_helix > 0.001 ? (1 - prog(S.dna_chrom, 0.17, 0.3)) * (1 - prog(f, 0, 0.12)) : 0;
    // the chromosomes stay until the last protein thread has left its gene
    const cv = prog(S.dna_chrom, 0.1, 0.24) * (1 - prog(f, 0.36, 0.7));
    uRev.value = S.dna_helix * 1.03; uRead.value = (t * 0.7) % 9 - 4.5; uHv.value = hv; uRb.value = S.dna_rainbow || 0;
    // (squeezed onto the chromosome thread, which it hands over to)
    cur.rot = -t * 0.22; cur.sq = 1 - 0.84 * prog(S.dna_chrom, 0, 0.3);
    hg.rotation.x = cur.rot; hg.scale.set(1, cur.sq, cur.sq);
    hg.visible = hv > 0.003;
    hMat.opacity = a * hv;
    cMesh.visible = cv > 0.003; cMat.opacity = a * cv;
    fMesh.visible = f > 0.001;
    mMesh.visible = pts.visible = S.dna_field > 0.001;
    frame.visible = S.dna_field > 0.15; frm.uniforms.uReveal.value = prog(S.dna_field, 0.15, 0.6);
    // solid shapes write depth (so they never show their insides) unless they are fading out on their own, when
    // they would cut what lies inside them (the thread in the helix, the protein threads in the chromosomes)
    fMat.depthWrite = mMat.depthWrite = a > 0.3;
    hMat.depthWrite = a > 0.3 && hv > 0.7;
    cMat.depthWrite = a > 0.3 && cv > 0.7;
  }

  // ============================================================== exports ==
  const top = k => { const { ctr, L, c } = KAR[k]; return [ctr[0] + 0.04, ctr[1] + c * L + 0.01, ctr[2]]; };
  const cell = k => { const c = gridAt(k); return [c[0] - 0.15, c[1] + 0.19, c[2]]; };
  const anchors = {
    helix: [0.6, 0.2, 0],
    // a base pair near the middle, as the helix turns
    bp: () => {
      const i = Math.round(NBP / 2) + 4, x = bpX(i), a1 = i * TW, r = HX.r * 0.9 * cur.sq;
      const y = r * (Math.cos(a1) + Math.cos(a1 + GROOVE)) / 2, z = r * (Math.sin(a1) + Math.sin(a1 + GROOVE)) / 2, c = Math.cos(cur.rot), s = Math.sin(cur.rot);
      return [x, y * c - z * s, y * s + z * c];
    },
    // chromosome 21's label floats above it, clear of X's long short arm, so it covers neither 22 nor X
    chrom1: top(0), chrom21: [KAR[20].ctr[0] - 0.03, KAR[22].ctr[1] + KAR[22].c * KAR[22].L + 0.085, KAR[20].ctr[2]], chromX: top(22),
    fold0: cell(0), fold1: cell(1), fold2: cell(2),
    karyotype: [0, 0, 0], grid: [0, 0, 0],
    field: [3.4, 2.4, 0.5],
  };
  for (let k = 0; k < 23; k++) anchors['chr' + (k < 22 ? k + 1 : 'X')] = KAR[k].ctr.slice();
  for (let k = 0; k < FOLD_N; k++) anchors['p' + k] = gridAt(k);
  const inFold = S => K.prog(Math.max(S.dna_fold, S.dna_field), 0.85, 1) * (1 - K.prog(S.dna_field, 0, 0.25));
  const inChrom = S => K.prog(S.dna_chrom, 0.85, 1) * (1 - K.prog(Math.max(S.dna_fold, S.dna_field), 0, 0.1));
  return Object.assign(set, {
    params: { dna_a: 1, dna_helix: 1, dna_chrom: 0, dna_fold: 0, dna_field: 0, dna_rainbow: 0 },
    update,
    anchors,
    labels: [
      { text: ['Base pair', 'A–T or G–C'], at: 'bp', cls: 'amb', alpha: S => K.prog(S.dna_helix, 0.9, 1) * (1 - K.prog(S.dna_chrom, 0, 0.1)) },
      { text: ['Chromosome 1', '248 million base pairs'], at: 'chrom1', cls: 'cyn', alpha: inChrom },
      { text: ['Chromosome 21', 'smallest, 47 million'], at: 'chrom21', cls: 'cyn', alpha: inChrom },
      { text: ['SRP9', ''], at: 'fold0', cls: 'cyn', alpha: inFold },
      { text: ['LENEP', ''], at: 'fold1', cls: 'cyn', alpha: inFold },
      { text: ['GNG5', ''], at: 'fold2', cls: 'cyn', alpha: inFold },
      { text: ['About 20,000', 'kinds of human protein'], at: 'field', cls: 'amb', alpha: S => K.prog(S.dna_field, 0.8, 1) },
    ],
    cam: {
      default: [35, 12, 3.9, 0, 0, 0],
      helix: [40, 8, 2.6, 0.3, 0, 0],
      chrom: [0, 4, 4.4, 0, -0.02, 0],
      fold: [0, 3, 4.6, 0, 0.03, 0],
      field: [FAZ, FEL, 17, 0, 0, 0],
    },
    controls: [
      { key: 'view', label: 'Show', options: [['helix', 'DNA'], ['chrom', 'Chromosomes'], ['fold', 'Proteins'], ['field', 'All proteins']] },
      { key: 'colour', label: 'Colour', options: [['conf', 'Confidence'], ['chain', 'Chain order']] },
    ],
    explore(c) {
      const i = ['helix', 'chrom', 'fold', 'field'].indexOf(c.view);
      return { dna_helix: 1, dna_chrom: i >= 1 ? 1 : 0, dna_fold: i >= 2 ? 1 : 0, dna_field: i >= 3 ? 1 : 0, dna_rainbow: c.colour === 'chain' ? 1 : 0 };
    },
    proteins: NAMES.map((n, k) => ({ sym: n, residues: folds[k].ca.length })),
    counts: { chromosomes: 23, basePairs: 3e9, genes: 20000, proteins: FIELD_N },
  });
};
