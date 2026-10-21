// `people`: one scan, one network; then the people on its index (the PET story). The poster's panels 3 and 4: one
// person's organ uptakes (bars), the 7 x 7 field of their pairwise log ratios (glowing columns), a glass threshold
// plane, the lit columns flying up to become this person's directed network on a ring, its two measures (Clearance,
// Heterogeneity) on gauges and the metabolic displacement index on a dial. Then the poster's results, as group
// summaries only: 593 stand-in dots on a map of the two measures that slide onto the index axis (the strip plot),
// survival by the index's thirds, the immunotherapy test (two summary bands and the AUC bars) and follow-up.
// The one-scan maths is the stand-in of tools/pet/data/gen_data.mjs (the poster names the measures; its formulas are not
// published). The dots are drawn (seeded) to follow each group's summary, never real patients. Everything is built
// once; update() sets uniforms, a few dozen instances and, when a value changes, the gauges' small readout.
// Frame: y up, the viewer at +z. One scan around the origin (bars left, ring of seven above the field, gauges right);
// the population in the same place (map, then strip), survival on a panel to the left, immunotherapy to the right.
SETS.people = function (K) {
  const { THREE, clamp, lerp, prog, rgb } = K;
  const set = K.newSet('people');
  const D = PET_DATA, S1 = D.single || {}, PO = D.poster || {}, PI = Math.PI, TAU = 2 * PI;
  const ICONS = typeof PET_ICONS !== 'undefined' ? PET_ICONS : null;
  const R = K.rng(5930);
  const sat = x => clamp(Number.isFinite(x) ? x : 0, 0, 1);
  const hexOf = c => '#' + c.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);

  // ---------------------------------------------------------------- the organs, the profiles, the maths
  const ONE = (S1.organs || ['liver', 'aorta', 'spleen', 'pancreas', 'kidneys', 'fat', 'muscle']).slice(), N = ONE.length;
  const ORG = ONE.map(id => (D.organs || []).find(o => o.id === id) || { id, name: id, short: cap(id), col: '#9aa3b5' });
  const OCOL = ORG.map(o => rgb(o.col));
  const KID = ONE.indexOf('kidneys');
  const PROF = ['healthy', 'cancer', 'both', 'dys'];
  const PROFN = { healthy: 'Healthy', cancer: 'Cancer', both: 'Cancer + dyslipidaemia', dys: 'Dyslipidaemia' };
  const SP = S1.profiles || {}, P0 = SP.healthy || { u: ONE.map(() => 1), C: 0, H: 0 };
  const PU = PROF.map(k => (SP[k] || P0).u.slice());
  const PROJ = S1.proj || { m: 0, a: 1, b: 0 }, SOFT = S1.soft || 0.08, THETA = S1.theta || 2;
  const GKEY = ['cancer', 'both', 'dys', 'healthy'];                    // people_group 1..4
  const GHEX = { cancer: '#d9dde6', both: '#9b5de5', dys: '#ff4fd8', healthy: '#38bdf8' };
  const GCOL = GKEY.map(k => rgb(GHEX[k]));
  const THIRD = ['#38bdf8', '#a78bfa', '#d9dde6'].map(rgb);
  const WARM = rgb('#ffb43b'), HUBC = rgb('#ffb020'), CYAN = rgb('#46d9ff'), INK = rgb('#e7eef8'), MUTED = rgb('#95a6bd'), CLIN = rgb('#8d97aa');
  const GOOD = rgb('#38bdf8'), POOR = rgb('#d9dde6'), PANEL = [0.022, 0.04, 0.075];

  // the poster's one-scan network with the stand-in maths of gen_data.mjs (exactly): link i -> j weighs
  // sigmoid((ln(u_i / u_j) - ln theta) / soft); Clearance = mean of the kidneys' outgoing links; Heterogeneity = Gini
  // coefficient of the strengths (in + out); index = m + a C + b H, between 0 and 10
  const sig = x => 1 / (1 + Math.exp(-x));
  function measure(u, theta) {
    const lt = Math.log(theta > 0 ? theta : THETA), uu = ONE.map((_, i) => Math.max(1e-3, +u[i] || 0));
    const e = uu.map(() => new Array(N).fill(0)), s = new Array(N).fill(0);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j) {
      const v = sig((Math.log(uu[i] / uu[j]) - lt) / SOFT);
      e[i][j] = v; s[i] += v; s[j] += v;
    }
    const C = KID < 0 ? 0 : e[KID].reduce((a, v, j) => a + (j === KID ? 0 : v), 0) / (N - 1);
    const m = s.reduce((a, v) => a + v, 0) / N;
    let g = 0;
    for (const a of s) for (const b of s) g += Math.abs(a - b);
    const H = m > 0 ? g / (2 * N * N * m) : 0;
    return { e, s, C, H, mdi: clamp(PROJ.m + PROJ.a * C + PROJ.b * H, 0, 10) };
  }
  // the uptakes on show: the profiles blended (people_profile 0..3), or the custom values
  function uptakes(S, out) {
    const p = clamp(Number.isFinite(S.people_profile) ? S.people_profile : 0, 0, 3), lo = Math.floor(p), hi = Math.min(3, lo + 1), f = p - lo;
    const c = sat(S.people_custom);
    for (let i = 0; i < N; i++) {
      let v = lerp(PU[lo][i], PU[hi][i], f);
      const cu = S['people_u' + i];
      if (c > 0 && Number.isFinite(cu)) v = lerp(v, clamp(cu, 0.1, 5), c);
      out[i] = v;
    }
    return out;
  }

  // ---------------------------------------------------------------- shared GLSL and builders
  // per-link values (49 of them) and group alphas travel as packed vec4 arrays (few uniform registers)
  const PK = `
float pk(vec4 v, float r) { return r < 0.5 ? v.x : (r < 1.5 ? v.y : (r < 2.5 ? v.z : v.w)); }
#define GET(A, I) pk(A[int((I) * 0.25 + 0.01)], (I) - 4.0 * floor((I) * 0.25 + 0.01))
`;
  const NL = N * N, NB = Math.ceil(NL / 4);
  const packed = n => new Float32Array(4 * Math.ceil(n / 4));
  const V = new THREE.Vector3();
  const tr = (obj, p, out) => { V.set(p[0], p[1], p[2]).applyMatrix4(obj.matrix); out = out || [0, 0, 0]; out[0] = V.x; out[1] = V.y; out[2] = V.z; return out; };
  const l3 = (a, b, f) => [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const nrm3 = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const crs3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sub = (parent, x, y, z, yaw) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw || 0; g.updateMatrix(); parent.add(g); return g; };

  // lines whose alpha is set per group (aG) each frame
  function lineSet(parent, ng, order, additive = true) {
    const P = [], C = [], A = [], G = [], nb = Math.ceil(ng / 4);
    const api = {
      seg(a, b, c, al, g) { P.push(a[0], a[1], a[2], b[0], b[1], b[2]); C.push(...c, ...c); A.push(al, al); G.push(g, g); return api; },
      dash(a, b, n, c, al, g) { for (let k = 0; k < n; k++) api.seg(l3(a, b, k / n), l3(a, b, (k + 0.55) / n), c, al, g); return api; },
      build() {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        geo.setAttribute('aCol', new THREE.Float32BufferAttribute(C, 3));
        geo.setAttribute('aA', new THREE.Float32BufferAttribute(A, 1));
        geo.setAttribute('aG', new THREE.Float32BufferAttribute(G, 1));
        const m = new THREE.ShaderMaterial({
          uniforms: { uA: set.uA, uG: { value: new Float32Array(nb * 4) } },
          transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
          vertexShader: `${PK}
attribute vec3 aCol; attribute float aA, aG;
uniform float uA; uniform vec4 uG[${nb}];
varying vec3 vC; varying float vA;
void main() { vC = aCol; vA = aA * uA * GET(uG, aG); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: 'varying vec3 vC; varying float vA; void main() { if (vA < 0.003) discard; gl_FragColor = vec4(vC, vA); }',
        });
        set.mats.push(m);
        const ls = new THREE.LineSegments(geo, m);
        ls.frustumCulled = false; ls.renderOrder = order; parent.add(ls);
        api.g = m.uniforms.uG.value;
        return api;
      },
    };
    return api;
  }

  // rounded rectangles, pills and dots (instanced quads in their parent's x-y plane): centre, half extents, corner
  // radius, glow; colour and alpha; fill (0..1) and stroke width
  const PILL_V = `
attribute vec3 iP; attribute vec4 iS, iC; attribute vec2 iE;
varying vec2 vQ; varying vec4 vS, vC; varying vec2 vE;
void main() {
  vec2 h = iS.xy + iS.w;
  vQ = position.xy * 2.0 * h; vS = iS; vC = iC; vE = iE;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(iP + vec3(vQ, 0.0), 1.0);
  if (iC.a < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
  const PILL_F = `
uniform float uA;
varying vec2 vQ; varying vec4 vS, vC; varying vec2 vE;
void main() {
  float rr = min(vS.z, min(vS.x, vS.y));
  vec2 q = abs(vQ) - (vS.xy - rr);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rr;
  float aa = max(fwidth(d), 1e-5);
  float inside = 1.0 - smoothstep(-aa, aa, d);
  float stroke = vE.y > 0.0 ? 1.0 - smoothstep(vE.y - aa, vE.y + aa, abs(d)) : 0.0;
  float glow = vS.w > 0.0 ? exp(-max(d, 0.0) / (0.38 * vS.w)) * (1.0 - inside) * 0.5 : 0.0;
  float core = 1.0 - smoothstep(0.0, vS.y, abs(vQ.y));
  vec3 col = mix(vC.rgb, vec3(1.0), 0.16 * core * inside * vE.x + 0.35 * stroke);
  float a = max(max(inside * vE.x, stroke), glow) * vC.a * uA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
}`;
  function pillSet(parent, n, order, additive) {
    const base = new THREE.PlaneGeometry(1, 1), geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index; geo.setAttribute('position', base.attributes.position);
    const iP = new Float32Array(3 * n), iS = new Float32Array(4 * n), iC = new Float32Array(4 * n), iE = new Float32Array(2 * n);
    const at = { iP: new THREE.InstancedBufferAttribute(iP, 3), iS: new THREE.InstancedBufferAttribute(iS, 4), iC: new THREE.InstancedBufferAttribute(iC, 4), iE: new THREE.InstancedBufferAttribute(iE, 2) };
    for (const k in at) { at[k].setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, at[k]); }
    geo.instanceCount = n;
    const m = new THREE.ShaderMaterial({ uniforms: { uA: set.uA }, vertexShader: PILL_V, fragmentShader: PILL_F, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, extensions: { derivatives: true } });
    set.mats.push(m);
    const mesh = new THREE.Mesh(geo, m);
    mesh.frustumCulled = false; mesh.renderOrder = order; parent.add(mesh);
    const base0 = new Float32Array(n);   // each instance's resting alpha
    return {
      mesh,
      put(k, x, y, z, hx, hy, rr, glow, col, a, fill = 1, stroke = 0) {
        iP[3 * k] = x; iP[3 * k + 1] = y; iP[3 * k + 2] = z;
        iS[4 * k] = hx; iS[4 * k + 1] = hy; iS[4 * k + 2] = rr; iS[4 * k + 3] = glow;
        iC[4 * k] = col[0]; iC[4 * k + 1] = col[1]; iC[4 * k + 2] = col[2]; iC[4 * k + 3] = 0; base0[k] = a;
        iE[2 * k] = fill; iE[2 * k + 1] = stroke;
      },
      x(k, x, hx) { iP[3 * k] = x; iS[4 * k] = hx; },
      col(k, c) { iC[4 * k] = c[0]; iC[4 * k + 1] = c[1]; iC[4 * k + 2] = c[2]; },
      a(k, f) { iC[4 * k + 3] = base0[k] * f; },
      flush() { for (const k in at) at[k].needsUpdate = true; },
    };
  }

  // a canvas texture on a plane (square power-of-two canvas, so mipmaps work everywhere): draw(ctx, X, Y, px)
  // gets x and y in the plane's local units; the plane's alpha is set with .k
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const font = (w, px) => `${w} ${Math.round(px)}px ${FONT}`;
  function textPlane(parent, cx, cy, z, w, h, size, order, draw) {
    const cv = document.createElement('canvas'); cv.width = size; cv.height = Math.round(size * h / w);
    const ctx = cv.getContext('2d'), px = size / w;
    if (draw) draw(ctx, x => (x - (cx - w / 2)) * px, y => (cy + h / 2 - y) * px, px);
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    const m = new THREE.ShaderMaterial({
      uniforms: { uA: set.uA, uK: { value: 0 }, uMap: { value: tex } }, transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D uMap; uniform float uA, uK; varying vec2 vUv; void main() { vec4 c = texture2D(uMap, vUv); float a = c.a * uA * uK; if (a < 0.003) discard; gl_FragColor = vec4(c.rgb, a); }',
    });
    set.mats.push(m);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.position.set(cx, cy, z); mesh.renderOrder = order; mesh.frustumCulled = false;
    parent.add(mesh);
    return { mesh, m, ctx, cv, tex, px, set k(v) { m.uniforms.uK.value = v; mesh.visible = v > 0.003; } };
  }

  // ---------------------------------------------------------------- sub-frames
  const gBars = sub(set.group, 0, 0, 0), gRing = sub(set.group, 0, 0, 0), gField = sub(set.group, 0, 0, 0);
  const gMet = sub(set.group, 1.08, 0.33, 0.14, -0.24), gPop = sub(set.group, 0, 0, 0);
  const gKM = sub(set.group, -2.38, 0.2, 0.5, 0.52), gAUC = sub(set.group, 2.38, 0.2, 0.5, -0.52);
  const gFloor = new THREE.Group(); gFloor.rotation.x = -PI / 2; gField.add(gFloor);   // local (x, y, z) -> (x, z, -y)

  // ---------------------------------------------------------------- icons: node discs, bar icons, the field's headers
  const ATL = ICONS ? ICONS.atlas(THREE, 128) : null;
  const icoMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uPx: K.U.uPx, uMap: { value: ATL ? ATL.texture : null }, uHas: { value: ATL ? 1 : 0 }, uHub: { value: new THREE.Color(...HUBC) } },
    transparent: true, depthWrite: false,
    vertexShader: K.GLSL + `
attribute vec3 aCol; attribute float aSize, aA, aHub, aDisc; attribute vec4 aUV;
uniform float uA;
varying vec3 vC; varying float vA, vHub, vDisc; varying vec4 vUV;
void main() {
  vC = aCol; vA = aA * uA; vHub = aHub; vDisc = aDisc; vUV = aUV;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize, mv);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform sampler2D uMap; uniform vec3 uHub; uniform float uHas;
varying vec3 vC; varying float vA, vHub, vDisc; varying vec4 vUV;
void main() {
  vec2 pc = gl_PointCoord; float d = length(pc - 0.5) * 2.0;
  if (d > 1.0) discard;
  vec2 q = (pc - 0.5) / mix(0.92, 0.66, vDisc) + 0.5;
  float ic = 0.0;
  if (uHas > 0.5 && q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0) ic = texture2D(uMap, vec2(mix(vUV.x, vUV.z, q.x), mix(vUV.w, vUV.y, q.y))).a;
  float ring = (smoothstep(0.74, 0.8, d) - smoothstep(0.93, 1.0, d)) * vDisc;
  float disc = (1.0 - smoothstep(0.94, 1.0, d)) * vDisc;
  vec3 fill = mix(vec3(0.025, 0.045, 0.085), uHub, vHub * 0.85);
  vec3 ink = mix(mix(vec3(0.95, 0.97, 1.0), vC, 0.3 + 0.5 * (1.0 - vDisc)), vec3(0.16, 0.08, 0.0), vHub);
  vec3 col = mix(mix(fill, ink, ic), mix(vC, vec3(1.0, 0.86, 0.5), vHub * 0.7), ring);
  gl_FragColor = vec4(col, max(disc * 0.92, max(ic, ring)) * vA);
}`,
  });
  set.mats.push(icoMat);
  function iconPoints(parent, list, order) {   // list: [{ p, oi, size, disc }]
    const geo = K.pointsGeo(list.length);
    geo.setAttribute('aUV', new THREE.BufferAttribute(new Float32Array(4 * list.length), 4));
    geo.setAttribute('aHub', new THREE.BufferAttribute(new Float32Array(list.length), 1));
    geo.setAttribute('aDisc', new THREE.BufferAttribute(new Float32Array(list.length).fill(1), 1));
    list.forEach((L, k) => {
      geo.attributes.position.array.set(L.p, 3 * k);
      geo.attributes.aCol.array.set(OCOL[L.oi], 3 * k);
      geo.attributes.aSize.array[k] = L.size;
      geo.attributes.aDisc.array[k] = L.disc === undefined ? 1 : L.disc;
      if (ATL) geo.attributes.aUV.array.set(ATL.uv(ONE[L.oi]), 4 * k);
    });
    for (const n of ['aA', 'aSize', 'aHub']) geo.attributes[n].setUsage(THREE.DynamicDrawUsage);
    const pts = new THREE.Points(geo, icoMat);
    pts.frustumCulled = false; pts.renderOrder = order; parent.add(pts);
    return geo;
  }

  // ================================================================ ONE SCAN
  // ---------------------------------------------------------------- the bars (poster's panel 3)
  const BY = k => 0.66 - k * 0.1, BX0 = 0.075, BK = 0.16, BTRK = 5 * BK;    // rows, the track's start, units per SUV
  const bPill = pillSet(gBars, 2 * N + 1, 3, false);
  bPill.put(2 * N, 0.46, BY((N - 1) / 2), -0.02, 0.56, 0.38, 0.05, 0, PANEL, 0.55, 1, 0.0025);
  for (let i = 0; i < N; i++) {
    bPill.put(i, BX0 + BTRK / 2, BY(i), -0.004, BTRK / 2, 0.021, 0.021, 0, [0.16, 0.2, 0.28], 0.55);
    bPill.put(N + i, BX0, BY(i), 0, 0.001, 0.021, 0.021, 0.022, OCOL[i], 1);
  }
  const bIco = iconPoints(gBars, ONE.map((id, i) => ({ p: [0, BY(i), 0.004], oi: i, size: 0.078, disc: 0 })), 6);
  const bLines = lineSet(gBars, 4, 2);
  for (let v = 1; v <= 5; v++) bLines.seg([BX0 + v * BK, BY(N - 1) - 0.05, -0.006], [BX0 + v * BK, BY(0) + 0.045, -0.006], MUTED, v % 2 ? 0.12 : 0.2, 0);
  bLines.build();

  // ---------------------------------------------------------------- the ratio field, the threshold plane
  const FY = -0.62, FZ = 0.3, FP = 0.155, HS = 0.3, HMAX = 0.98, CW = 0.104;   // floor, centre z, pitch, height per ln unit
  const cellX = j => (j - (N - 1) / 2) * FP, cellZ = i => FZ + (i - (N - 1) / 2) * FP;
  const fPill = pillSet(gFloor, NL + 1, 1, false);
  fPill.put(NL, 0, -FZ, FY - 0.002, (N * FP) / 2 + 0.05, (N * FP) / 2 + 0.05, 0.05, 0, PANEL, 0.82, 1, 0.003);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const k = i * N + j;
    fPill.put(k, cellX(j), -cellZ(i), FY, FP * 0.44, FP * 0.44, 0.016, 0, i === j ? OCOL[i].map(v => v * 0.35) : [0.07, 0.1, 0.16], i === j ? 0.9 : 0.75);
  }
  const plPill = pillSet(gFloor, 1, 4, false);
  plPill.put(0, 0, -FZ, FY, (N * FP) / 2 + 0.07, (N * FP) / 2 + 0.07, 0.04, 0.03, CYAN, 0.16, 1, 0.004);
  // the columns: one box each, its base on the floor; the part above the plane glows
  const colGeo = new THREE.BoxGeometry(1, 1, 1); colGeo.translate(0, 0.5, 0);
  const colMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uK: { value: 0 }, uPlane: { value: FY }, uThr: { value: 0 } },
    transparent: true, depthWrite: true,
    vertexShader: `
attribute vec4 iCol; attribute float iF;
varying vec3 vC, vN; varying float vY, vE, vF; varying vec2 vUv;
void main() {
  vec4 p = vec4(position, 1.0);
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
#endif
  vY = p.y; vC = iCol.rgb; vE = iCol.a; vF = iF; vUv = uv; vN = normal;
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`,
    fragmentShader: `
uniform float uA, uK, uPlane, uThr;
varying vec3 vC, vN; varying float vY, vE, vF; varying vec2 vUv;
void main() {
  float above = smoothstep(uPlane - 0.004, uPlane + 0.004, vY);
  float sh = 0.5 + 0.5 * clamp(dot(normalize(vN), normalize(vec3(-0.35, 0.85, 0.45))), 0.0, 1.0);
  vec2 e2 = abs(vUv - 0.5); float edge = smoothstep(0.34, 0.5, max(e2.x, e2.y));
  float lit = mix(0.85, mix(0.3, 0.55 + 1.05 * vE * (1.0 - 0.45 * vF), above), uThr);
  vec3 col = vC * lit * (sh + 0.55 * edge) + vec3(1.0, 0.95, 0.85) * step(0.5, vN.y) * above * uThr * vE * 0.35 * (1.0 - 0.5 * vF);
  gl_FragColor = vec4(col, uA * uK * mix(0.9, 0.97, above));
}`,
  });
  set.mats.push(colMat);
  const cols = new THREE.InstancedMesh(colGeo, colMat, NL);
  const iCol = new THREE.InstancedBufferAttribute(new Float32Array(4 * NL), 4), iF = new THREE.InstancedBufferAttribute(new Float32Array(NL), 1);
  iCol.setUsage(THREE.DynamicDrawUsage); iF.setUsage(THREE.DynamicDrawUsage);
  colGeo.setAttribute('iCol', iCol); colGeo.setAttribute('iF', iF);
  cols.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cols.frustumCulled = false; cols.renderOrder = 2;
  gField.add(cols);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) iCol.array.set(OCOL[i], 4 * (i * N + j));
  // the headers: row i (the numerator) on the left edge, column j (the denominator) on the front edge
  const fIco = iconPoints(gField, [
    ...ONE.map((id, i) => ({ p: [cellX(0) - 0.13, FY + 0.05, cellZ(i)], oi: i, size: 0.092 })),
    ...ONE.map((id, j) => ({ p: [cellX(j), FY + 0.05, cellZ(N - 1) + 0.13], oi: j, size: 0.092 })),
  ], 6);

  // ---------------------------------------------------------------- the ring of seven and the directed links
  const RC = [0, 0.43, -0.05], RR = 0.42, TILT = 12 * PI / 180, RN = [0, Math.sin(TILT), Math.cos(TILT)];
  // the poster's example network, read round: kidneys right, aorta and pancreas over them, liver and spleen left,
  // fat and muscle below
  const RING = ['kidneys', 'aorta', 'pancreas', 'liver', 'spleen', 'fat', 'muscle'];
  const ORDER = RING.filter(id => ONE.includes(id)).concat(ONE.filter(id => !RING.includes(id)));
  const NODE = ONE.map(id => {
    const a = ORDER.indexOf(id) / N * TAU;
    return [RC[0] + RR * Math.cos(a), RC[1] + RR * Math.sin(a) * Math.cos(TILT), RC[2] - RR * Math.sin(a) * Math.sin(TILT)];
  });
  // each ordered pair i -> j: a quadratic curve bowed towards the viewer and to its own side (i -> j and j -> i apart)
  const BZ = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (i === j) { BZ.push(null); continue; }
    const a = NODE[i], b = NODE[j], c = sub3(b, a), L = Math.hypot(c[0], c[1], c[2]), side = nrm3(crs3(RN, c)), mid = l3(a, b, 0.5);
    BZ.push([a, [mid[0] + RN[0] * (0.05 + 0.2 * L) + side[0] * 0.08 * L, mid[1] + RN[1] * (0.05 + 0.2 * L) + side[1] * 0.08 * L, mid[2] + RN[2] * (0.05 + 0.2 * L) + side[2] * 0.08 * L], b]);
  }
  const bez = (z, s) => { const u = 1 - s; return [u * u * z[0][0] + 2 * u * s * z[1][0] + s * s * z[2][0], u * u * z[0][1] + 2 * u * s * z[1][1] + s * s * z[2][1], u * u * z[0][2] + 2 * u * s * z[1][2] + s * s * z[2][2]]; };
  // links as glowing tubes whose width and brightness follow the weight (uT) and the Clearance highlight (uB)
  const LIGHT = [1, 0.93, 0.8];
  let tubeMat;
  {
    const NS = 24, NRAD = 5, pos = [], off = [], col = [], ls = [], idx = [];
    let v0 = 0;
    for (let L = 0; L < NL; L++) {
      const z = BZ[L]; if (!z) continue;
      const i = Math.floor(L / N);
      for (let q = 0; q <= NS; q++) {
        const s = q / NS, c = bez(z, s), c2 = bez(z, Math.min(1, s + 0.01)), c1 = bez(z, Math.max(0, s - 0.01));
        const T = nrm3(sub3(c2, c1)), n1 = nrm3(crs3(T, RN)), n2 = crs3(T, n1), cc = l3(OCOL[i], LIGHT, 0.25 + 0.55 * s);
        for (let r = 0; r < NRAD; r++) {
          const th = r / NRAD * TAU, o = [Math.cos(th) * n1[0] + Math.sin(th) * n2[0], Math.cos(th) * n1[1] + Math.sin(th) * n2[1], Math.cos(th) * n1[2] + Math.sin(th) * n2[2]];
          pos.push(...c); off.push(...o); col.push(...cc); ls.push(L, s);
        }
      }
      for (let q = 0; q < NS; q++) for (let r = 0; r < NRAD; r++) {
        const a = v0 + q * NRAD + r, b = v0 + q * NRAD + (r + 1) % NRAD, c = a + NRAD, d = b + NRAD;
        idx.push(a, c, b, b, c, d);
      }
      v0 += (NS + 1) * NRAD;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aOff', new THREE.Float32BufferAttribute(off, 3));
    geo.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aLS', new THREE.Float32BufferAttribute(ls, 2));
    geo.setIndex(idx);
    tubeMat = new THREE.ShaderMaterial({
      uniforms: { uA: set.uA, uTime: K.U.uTime, uR0: { value: 0.0085 }, uT: { value: packed(NL) }, uB: { value: packed(NL) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `${PK}
attribute vec3 aOff, aCol; attribute vec2 aLS;
uniform float uA, uR0, uTime; uniform vec4 uT[${NB}], uB[${NB}];
varying vec3 vC, vN, vW; varying float vA;
void main() {
  float T = GET(uT, aLS.x), B = GET(uB, aLS.x);
  vec3 p = position + aOff * uR0 * (0.35 + 0.65 * min(T, 1.0)) * (0.8 + 0.5 * B);
  float flow = 0.62 + 0.38 * sin(6.2832 * (aLS.y * 2.0 - uTime * 0.85));
  vC = aCol * (0.55 + 0.6 * B); vA = uA * min(T, 1.0) * flow * min(B, 1.6);
  vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * aOff);
  gl_Position = projectionMatrix * viewMatrix * w;
  if (T < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragmentShader: `
varying vec3 vC, vN, vW; varying float vA;
void main() {
  float f = abs(dot(normalize(vN), normalize(cameraPosition - vW)));
  float core = pow(f, 1.3);
  gl_FragColor = vec4(vC * (0.55 + 0.9 * core), vA * (0.2 + 0.8 * core));
}`,
    });
    set.mats.push(tubeMat);
    const mesh = new THREE.Mesh(geo, tubeMat);
    mesh.frustumCulled = false; mesh.renderOrder = 4; gRing.add(mesh);
  }
  // flowing particles: three comets on each link (a head and five fading behind it); while the network forms they
  // fly up from their column in the field
  const NPK = 3, NTR = 6, NPP = NPK * NTR;
  const partMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime, uPlane: { value: FY }, uE: { value: packed(NL) }, uF: { value: packed(NL) }, uH: { value: packed(NL) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: K.GLSL + PK + `
attribute vec3 aP0, aP1, aP2, aSt, aCol; attribute vec3 aD;
uniform float uA, uPlane; uniform vec4 uE[${NB}], uF[${NB}], uH[${NB}];
varying vec3 vC; varying float vA;
void main() {
  float E = GET(uE, aD.x), F = GET(uF, aD.x), top = GET(uH, aD.x);
  float s = clamp(fract(aD.y + uTime * 0.23) - aD.z * 0.017, 0.0, 1.0), u = 1.0 - s;
  vec3 lp = u * u * aP0 + 2.0 * u * s * aP1 + s * s * aP2;
  vec3 st = vec3(aSt.x, mix(uPlane, max(uPlane, top), aSt.z), aSt.y);
  float f = smoothstep(0.0, 1.0, F);
  vec3 pos = mix(st, lp, f); pos.y += sin(f * 3.14159) * 0.22;
  float head = 1.0 - aD.z / ${NTR}.0;
  vC = mix(aCol, vec3(1.0), 0.45 * head);
  vA = uA * E * smoothstep(0.0, 0.06, F) * head * mix(1.0, smoothstep(0.0, 0.05, s) * smoothstep(1.0, 0.9, s), f);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(0.03 * (0.45 + 0.55 * head), mv);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
varying vec3 vC; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  float a = max(smoothstep(0.5, 0.15, d) * 0.9, pow(1.0 - d * 2.0, 1.5) * 0.6);
  gl_FragColor = vec4(vC, a * vA);
}`,
  });
  set.mats.push(partMat);
  {
    const n = (NL - N) * NPP, geo = new THREE.BufferGeometry(), A = {};
    for (const [k, w] of [['position', 3], ['aP0', 3], ['aP1', 3], ['aP2', 3], ['aSt', 3], ['aCol', 3], ['aD', 3]]) A[k] = new Float32Array(n * w);
    let q = 0;
    for (let L = 0; L < NL; L++) {
      const z = BZ[L]; if (!z) continue;
      const i = Math.floor(L / N), j = L % N;
      for (let pkt = 0; pkt < NPK; pkt++) {
        const ph = (pkt + R() * 0.6) / NPK, yf = 0.2 + 0.8 * R(), jx = (R() - 0.5) * CW * 0.6, jz = (R() - 0.5) * CW * 0.6;
        for (let tr = 0; tr < NTR; tr++, q++) {
          A.aP0.set(z[0], 3 * q); A.aP1.set(z[1], 3 * q); A.aP2.set(z[2], 3 * q);
          A.aSt.set([cellX(j) + jx, cellZ(i) + jz, yf], 3 * q);
          A.aCol.set(l3(OCOL[i], LIGHT, 0.3), 3 * q);
          A.aD.set([L, ph, tr], 3 * q);
        }
      }
    }
    for (const k in A) geo.setAttribute(k, new THREE.BufferAttribute(A[k], 3));
    const pts = new THREE.Points(geo, partMat);
    pts.frustumCulled = false; pts.renderOrder = 5; gRing.add(pts);
  }
  // the nodes: a halo (strength, hubs, the kidneys' star) under a disc with the organ's icon
  const haloGeo = K.pointsGeo(N + 1);
  NODE.forEach((p, i) => { haloGeo.attributes.position.array.set(p, 3 * i); haloGeo.attributes.aCol.array.set(OCOL[i], 3 * i); });
  if (KID >= 0) { haloGeo.attributes.position.array.set(NODE[KID], 3 * N); haloGeo.attributes.aCol.array.set(OCOL[KID], 3 * N); }
  for (const n of ['aA', 'aSize', 'aCol']) haloGeo.attributes[n].setUsage(THREE.DynamicDrawUsage);
  const halos = new THREE.Points(haloGeo, K.points(set, {}));
  halos.frustumCulled = false; halos.renderOrder = 6; gRing.add(halos);
  const nIco = iconPoints(gRing, ONE.map((id, i) => ({ p: [NODE[i][0], NODE[i][1], NODE[i][2] + 0.01], oi: i, size: 0.13 })), 7);
  const rLines = lineSet(gRing, 4, 3);
  for (let k = 0; k < 96; k++) {
    const a0 = k / 96 * TAU, a1 = (k + 0.6) / 96 * TAU;
    const p = a => [RC[0] + RR * Math.cos(a), RC[1] + RR * Math.sin(a) * Math.cos(TILT), RC[2] - RR * Math.sin(a) * Math.sin(TILT) - 0.004];
    rLines.seg(p(a0), p(a1), CYAN, 0.16, 0);
  }
  rLines.build();

  // ---------------------------------------------------------------- the two measures and the index (poster's panel 4)
  const GAUGE_V = 'varying vec2 vP; uniform float uS; void main() { vP = position.xy * uS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const GAUGE_F = `
uniform float uA, uK, uVal, uFillK, uTicks, uMinor; uniform vec3 uZ; uniform vec4 uMkF; uniform vec3 uMkC[4]; uniform vec3 uFill;
varying vec2 vP;
const float PI = 3.14159265;
float sweepOf(vec2 p) { float a = degrees(atan(p.y, p.x)); if (a < -90.0) a += 360.0; return (210.0 - a) / 240.0; }
void main() {
  vec2 p = vP; float r = length(p);
  if (r > 1.13) discard;
  float f = sweepOf(p), inS = step(0.0, f) * step(f, 1.0), aa = max(fwidth(r), 1e-4) * 1.2;
  vec3 col = vec3(0.0); float al = 0.0;
  // the dial's face: a dark disc
  float face = 1.0 - smoothstep(0.99 - aa, 0.99 + aa, r);
  col = vec3(0.022, 0.04, 0.075); al = face * 0.7;
  // the band: track, shaded zones (the index dial), the value's fill
  float band = smoothstep(0.78 - aa, 0.78 + aa, r) * (1.0 - smoothstep(0.93 - aa, 0.93 + aa, r)) * inS;
  float zone = uZ.z * (step(f, uZ.x) + step(uZ.y, f));
  vec3 track = mix(vec3(0.12, 0.17, 0.26), vec3(0.3, 0.32, 0.36), zone);
  float filled = step(f, uVal * uFillK);
  vec3 fill = uFill * (0.6 + 0.65 * f);
  col = mix(col, mix(track, fill, filled), band); al = max(al, band * mix(0.85, 1.0, filled));
  // ticks
  float ft = floor(f * uTicks + 0.5) / uTicks, dT = abs(f - ft) * 4.18879 * r;
  float tick = (1.0 - smoothstep(0.012 - aa, 0.012 + aa, dT)) * smoothstep(0.64 - aa, 0.64 + aa, r) * (1.0 - smoothstep(0.74 - aa, 0.74 + aa, r)) * inS;
  float fm = floor(f * uMinor + 0.5) / uMinor, dM = abs(f - fm) * 4.18879 * r;
  tick = max(tick, 0.5 * (1.0 - smoothstep(0.007 - aa, 0.007 + aa, dM)) * smoothstep(0.69 - aa, 0.69 + aa, r) * (1.0 - smoothstep(0.74 - aa, 0.74 + aa, r)) * inS);
  col = mix(col, vec3(0.82, 0.88, 0.96), tick * 0.85); al = max(al, tick);
  // the dashed range of the index dial
  if (uZ.z > 0.5) for (int i = 0; i < 2; i++) {
    float fz = i == 0 ? uZ.x : uZ.y, dz = abs(f - fz) * 4.18879 * r;
    float dash = (1.0 - smoothstep(0.006 - aa, 0.006 + aa, dz)) * step(0.5, fract(r * 14.0)) * step(0.12, r) * (1.0 - smoothstep(0.93, 0.93 + aa, r));
    col = mix(col, vec3(0.9), dash * 0.7); al = max(al, dash * 0.7);
  }
  // the groups' medians round the dial
  for (int i = 0; i < 4; i++) {
    float fg = i == 0 ? uMkF.x : (i == 1 ? uMkF.y : (i == 2 ? uMkF.z : uMkF.w));
    if (fg < 0.0) continue;
    float ag = radians(210.0 - 240.0 * fg); vec2 pg = vec2(cos(ag), sin(ag)) * 1.035;
    float m = 1.0 - smoothstep(0.05 - aa, 0.05 + aa, length(p - pg));
    col = mix(col, uMkC[i], m); al = max(al, m);
  }
  // the needle and its hub
  float an = radians(210.0 - 240.0 * clamp(uVal, 0.0, 1.0)); vec2 nd = vec2(cos(an), sin(an));
  float tN = clamp(dot(p, nd), 0.0, 0.86), wN = mix(0.05, 0.012, tN / 0.86);
  float needle = (1.0 - smoothstep(wN - aa, wN + aa, length(p - nd * tN))) * uFillK;
  col = mix(col, vec3(1.0, 0.96, 0.88), needle); al = max(al, needle);
  float hub = 1.0 - smoothstep(0.085 - aa, 0.085 + aa, r), hubR = hub * (1.0 - smoothstep(0.05 - aa, 0.05 + aa, r));
  col = mix(col, mix(uFill, vec3(0.05, 0.06, 0.08), hubR), hub); al = max(al, hub);
  float a = al * uA * uK;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
}`;
  function gauge(x, y, r, ticks, minor, zones, marks) {
    const mk = [-1, -1, -1, -1], mc = [0, 1, 2, 3].map(() => new THREE.Vector3());
    (marks || []).slice(0, 4).forEach((m, k) => { mk[k] = m[0]; mc[k].set(...m[1]); });
    const m = new THREE.ShaderMaterial({
      uniforms: { uA: set.uA, uK: { value: 0 }, uS: { value: 1.15 }, uVal: { value: 0 }, uFillK: { value: 0 }, uTicks: { value: ticks }, uMinor: { value: minor },
        uZ: { value: new THREE.Vector3(zones ? zones[0] : 0, zones ? zones[1] : 1, zones ? 1 : 0) }, uMkF: { value: new THREE.Vector4(...mk) }, uMkC: { value: mc },
        uFill: { value: new THREE.Vector3(...WARM) } },
      vertexShader: GAUGE_V, fragmentShader: GAUGE_F, transparent: true, depthWrite: false, extensions: { derivatives: true },
    });
    set.mats.push(m);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * r * 1.15, 2 * r * 1.15), m);
    m.uniforms.uS.value = 1.15 / (r * 1.15);   // plane units -> dial units (the band's outer edge at 0.93)
    mesh.position.set(x, y, 0); mesh.renderOrder = 3; gMet.add(mesh);
    return m;
  }
  const MD = PO.mdi || {}, MG = GKEY.map(k => (MD.groups || []).find(g => g.key === k) || null);
  const ZONE = Array.isArray(MD.dashed) && MD.dashed.length === 2 ? MD.dashed : null;
  const GA = { C: [-0.24, 0.4, 0.2], H: [0.24, 0.4, 0.2], X: [0, -0.2, 0.32] };
  const gC = gauge(GA.C[0], GA.C[1], GA.C[2], 5, 10);
  const gH = gauge(GA.H[0], GA.H[1], GA.H[2], 6, 12);
  const gX = gauge(GA.X[0], GA.X[1], GA.X[2], 10, 20, ZONE ? [ZONE[0] / 10, ZONE[1] / 10] : null,
    MG.map((g, k) => (g && Number.isFinite(g.centre) ? [g.centre / 10, GCOL[k]] : [-1, [0, 0, 0]])));
  const HMAXG = 0.6;     // the Heterogeneity gauge reads 0 to 0.6
  // the readouts: one canvas, four cells (Clearance, Heterogeneity, index), redrawn when a value's text changes
  const RO = textPlane(gMet, 0, 0, 0.004, 1, 0.125, 1024, 4, null);
  RO.mesh.visible = false;
  RO.mesh.geometry.dispose();
  {
    const cells = [[GA.C[0], GA.C[1] - 0.115, 0.15], [GA.H[0], GA.H[1] - 0.115, 0.15], [GA.X[0], GA.X[1] - 0.175, 0.2]];
    const pos = [], uv = [], idx = [];
    cells.forEach(([x, y, w], k) => {
      const h = w / 2, u0 = k / 4, u1 = (k + 1) / 4;
      pos.push(x - w / 2, y - h / 2, 0, x + w / 2, y - h / 2, 0, x + w / 2, y + h / 2, 0, x - w / 2, y + h / 2, 0);
      uv.push(u0, 0, u1, 0, u1, 1, u0, 1);
      idx.push(4 * k, 4 * k + 1, 4 * k + 2, 4 * k, 4 * k + 2, 4 * k + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    RO.mesh.geometry = geo; RO.mesh.position.set(0, 0, 0.004);
  }
  const roText = ['', '', ''];
  function readout(k, txt) {
    if (roText[k] === txt) return;
    roText[k] = txt;
    const c = RO.ctx, w = RO.cv.width / 4, h = RO.cv.height;
    c.clearRect(k * w, 0, w, h);
    c.font = font(700, h * 0.72); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = k === 2 ? hexOf(WARM) : hexOf(INK);
    c.fillText(txt, k * w + w / 2, h * 0.54);
    RO.tex.needsUpdate = true;
  }

  // ================================================================ THE POPULATION
  // ---------------------------------------------------------------- stand-in dots that follow the poster's summaries
  // each group's index values come from its quantiles (min, p10, p25, median, p75, p90, max; or a normal spread from
  // its error bar), stratified so the summary is met; each dot's two measures are placed so that m + a C + b H gives
  // its value: along the index's gradient from the group's illustrative profile, with a spread along the iso-line
  const probit = p => { p = clamp(p, 1e-4, 1 - 1e-4); const q = p < 0.5 ? p : 1 - p, t = Math.sqrt(-2 * Math.log(q)); const x = t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t); return p < 0.5 ? -x : x; };
  function quantFn(g) {
    const q = g.q || {}, err = Array.isArray(g.err) ? g.err : null, kn = [];
    const add = (u, v) => { if (Number.isFinite(v)) kn.push([u, v]); };
    add(0, g.min); add(0.1, q.p10); add(0.25, Number.isFinite(q.p25) ? q.p25 : err && err[0]); add(0.5, Number.isFinite(q.p50) ? q.p50 : g.centre);
    add(0.75, Number.isFinite(q.p75) ? q.p75 : err && err[1]); add(0.9, q.p90); add(1, g.max);
    for (let i = 1; i < kn.length; i++) kn[i][1] = Math.max(kn[i][1], kn[i - 1][1]);
    if (kn.length >= 3 && kn[0][0] === 0 && kn[kn.length - 1][0] === 1) return u => {
      for (let i = 1; i < kn.length; i++) if (u <= kn[i][0]) return lerp(kn[i - 1][1], kn[i][1], (u - kn[i - 1][0]) / (kn[i][0] - kn[i - 1][0]));
      return kn[kn.length - 1][1];
    };
    const c = Number.isFinite(g.centre) ? g.centre : 5, sd = err ? Math.max(0.05, (err[1] - err[0]) / 1.349) : 0.8;
    return u => clamp(c + sd * probit(u), 0, 10);
  }
  const strat = (n, k) => (n === 1 ? 0.5 : k === 0 ? 0 : k === n - 1 ? 1 : (k + R()) / n);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const GAa = PROJ.a, GBb = PROJ.b, G2 = GAa * GAa + GBb * GBb || 1, GLn = Math.sqrt(G2), ISO = [-GBb / GLn, GAa / GLn], SPREAD = 0.06;
  const QF = MG.map(g => (g ? quantFn(g) : null));
  const DOTS = [];
  GKEY.forEach((key, g) => {
    const s = MG[g]; if (!s || !(s.n > 0)) return;
    const n = Math.round(s.n), pc = SP[key] || P0, m0 = PROJ.m + GAa * pc.C + GBb * pc.H;
    const vals = shuffle(Array.from({ length: n }, (_, k) => QF[g](strat(n, k))));
    for (const v of vals) {
      const t = (v - m0) / G2, b = K.gauss(R) * SPREAD;
      DOTS.push({ g, v, C: pc.C + GAa * t + ISO[0] * b, H: pc.H + GBb * t + ISO[1] * b, k: R(), jy: R() - 0.5, jz: R() - 0.5, mz: R() - 0.5 });
    }
  });
  const NDOT = DOTS.length;
  // the map: Clearance across, Heterogeneity up, scaled to the dots (the stand-ins have no units to show)
  let c0 = Infinity, c1 = -Infinity, h0 = Infinity, h1 = -Infinity;
  for (const d of DOTS) { c0 = Math.min(c0, d.C); c1 = Math.max(c1, d.C); h0 = Math.min(h0, d.H); h1 = Math.max(h1, d.H); }
  if (!(c1 > c0)) { c0 = 0; c1 = 1; } if (!(h1 > h0)) { h0 = 0; h1 = 0.5; }
  const MAPR = { x0: -1.0, x1: 1.0, y0: -0.28, y1: 0.86 };
  const MX = C => lerp(MAPR.x0, MAPR.x1, (C - c0) / (c1 - c0)), MY = H => lerp(MAPR.y0, MAPR.y1, (H - h0) / (h1 - h0));
  // the strip: the index axis (0 to the poster's 10.7) and four rows, the poster's order from the top
  const AXMAX = (Array.isArray(MD.axis) && MD.axis[1] > 1) ? MD.axis[1] : 10.7, SX0 = -1.32, SW = 2.64, SK = SW / AXMAX, AXY = -0.3;
  const SX = v => SX0 + v * SK;
  const ORDERG = (Array.isArray(MD.order) && MD.order.length ? MD.order : ['dys', 'healthy', 'both', 'cancer']).filter(k => GKEY.includes(k));
  GKEY.forEach(k => { if (!ORDERG.includes(k)) ORDERG.push(k); });
  const ROWY = GKEY.map(k => 0.45 - ORDERG.indexOf(k) * 0.19);
  // follow-up (illustrative): the poster's follow-up groups; surgery and immunotherapy move towards the healthy range
  const FU = ((PO.cohort || {}).followup || []).map(f => ({ name: cap(String(f.group || '')).replace(/^Neoadjuvant ICI$/i, 'Immunotherapy before surgery'), n: Math.round(+f.n || 0),
    from: /bariatric|obes/i.test(f.group) ? 2 : /ici|immuno|lung/i.test(f.group) ? 0 : -1 })).filter(f => f.n > 0).slice(0, 3);
  const FUY = FU.map((f, k) => 0.9 - k * 0.12);
  const POOL = DOTS.map(d => d.v).sort((a, b) => a - b);
  const QH = QF[3] || (u => 4.5);
  const FDOTS = [];
  FU.forEach((f, k) => {
    for (let q = 0; q < f.n; q++) {
      const u = strat(f.n, q), v0 = f.from >= 0 && QF[f.from] ? QF[f.from](u) : POOL.length ? POOL[Math.min(POOL.length - 1, Math.floor(u * POOL.length))] : 4.5;
      const v1 = f.from >= 0 ? lerp(v0, QH(0.15 + 0.7 * R()), 0.75) : v0;
      FDOTS.push({ f: k, v0, v1, k: R(), jy: R() - 0.5, jz: R() - 0.5, col: f.from >= 0 ? GCOL[f.from] : MUTED });
    }
  });
  const NFD = FDOTS.length;

  // ---------------------------------------------------------------- the dots (one draw: map, strip, follow-up rings)
  const dotMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uPx: K.U.uPx, uMap: { value: 0 }, uMdi: { value: 0 }, uFol: { value: 0 }, uDim: { value: 1 }, uGF: { value: new Float32Array(8) },
      uOrig: { value: new THREE.Vector3(...RC) }, uHealthy: { value: new THREE.Vector3(...GCOL[3]) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: K.GLSL + PK + `
attribute vec3 aMap, aStr, aEnd, aCol; attribute vec4 aD;
uniform float uA, uMap, uMdi, uFol, uDim; uniform vec4 uGF[2]; uniform vec3 uOrig, uHealthy;
varying vec3 vC; varying float vA, vPx, vRing; varying vec2 vCH;
void main() {
  float g = aD.x, k = aD.y, gf = GET(uGF, g), sz = 0.024, a;
  vec3 pos; vC = aCol; vRing = 0.0; vCH = aD.zw;
  if (g < 3.5) {
    float r = smoothstep(k * 0.45, k * 0.45 + 0.55, uMap);
    pos = mix(uOrig, aMap, r); pos.z += sin(3.14159 * r) * 0.3;
    float q = smoothstep(k * 0.35, k * 0.35 + 0.65, uMdi);
    pos = mix(pos, aStr, q); pos.z += sin(3.14159 * q) * 0.12;
    a = smoothstep(0.0, 0.2, r) * min(gf, 1.0) * uDim * (1.0 - 0.62 * uFol);
    sz *= 0.75 + 0.35 * gf;
  } else {
    float s = smoothstep(0.3 + 0.25 * k, 0.72 + 0.25 * k, uFol);
    pos = mix(aStr, aEnd, s);
    a = smoothstep(0.0, 0.25, uFol) * uMdi * uDim * gf;
    vC = mix(aCol, uHealthy, s * step(0.001, distance(aEnd, aStr)));
    vRing = 1.0; sz = 0.034;
  }
  vA = a * uA;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(sz, mv); vPx = gl_PointSize;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
varying vec3 vC; varying float vA, vPx, vRing; varying vec2 vCH;
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  vec2 c = gl_PointCoord - 0.5; c.y = -c.y; float d = length(c);
  if (d > 0.5) discard;
  float glow = pow(max(0.0, 1.0 - d * 2.0), 1.6), core = smoothstep(0.5, 0.18, d);
  float a = max(core * 0.85, glow * 0.6);
  vec3 col = mix(vC, vec3(1.0), smoothstep(0.22, 0.0, d) * 0.35);
  if (vRing > 0.5) { a = smoothstep(0.5, 0.42, d) * smoothstep(0.25, 0.32, d) + glow * 0.25; col = vC; }
  // close up (a big point: a headset near the strip) a dot becomes its person's mini network: seven nodes on a ring,
  // the kidneys' spokes by Clearance, one node grown by Heterogeneity
  float net = smoothstep(16.0, 30.0, vPx) * (1.0 - vRing);
  if (net > 0.0) {
    float m = 0.0, px = 1.6 / vPx, spokes = floor(vCH.x * 6.0 + 0.5);
    vec2 n0 = vec2(0.0, 0.33);
    for (int i = 0; i < 7; i++) {
      float an = 1.5708 + 6.2832 * float(i) / 7.0;
      vec2 p = 0.33 * vec2(cos(an), sin(an)), q = 0.33 * vec2(cos(an + 0.8976), sin(an + 0.8976));
      float rad = i == 4 ? 0.045 + 0.2 * vCH.y : 0.045;
      m = max(m, smoothstep(rad + px, rad - px, length(c - p)));
      if (i > 0 && float(i) <= spokes) m = max(m, 0.8 * smoothstep(0.018 + px, 0.018 - px, seg(c, n0, p)));
      m = max(m, 0.3 * smoothstep(0.01 + px, 0.01 - px, seg(c, p, q)));
    }
    a = mix(a, m + 0.12 * glow, net); col = mix(col, mix(vC, vec3(1.0), 0.25), net);
  }
  gl_FragColor = vec4(col, a * vA);
}`,
  });
  set.mats.push(dotMat);
  const DMAP = [], DSTR = [], STATS = GKEY.map(() => ({ n: 0, x: 0, y: 0, z: 0 }));
  {
    const n = NDOT + NFD, geo = new THREE.BufferGeometry(), A = { position: new Float32Array(3 * n), aMap: new Float32Array(3 * n), aStr: new Float32Array(3 * n), aEnd: new Float32Array(3 * n), aCol: new Float32Array(3 * n), aD: new Float32Array(4 * n) };
    DOTS.forEach((d, q) => {
      const mp = [MX(d.C), MY(d.H), d.mz * 0.08], sp = [SX(d.v), ROWY[d.g] + d.jy * 0.13, d.jz * 0.12];
      DMAP.push(mp); DSTR.push(sp);
      const st = STATS[d.g]; st.n++; st.x += mp[0]; st.y += mp[1]; st.z += mp[2];
      A.aMap.set(mp, 3 * q); A.aStr.set(sp, 3 * q); A.aEnd.set(sp, 3 * q); A.aCol.set(GCOL[d.g], 3 * q);
      A.aD.set([d.g, d.k, clamp((d.C - c0) / (c1 - c0), 0, 1), clamp((d.H - h0) / (h1 - h0), 0, 1)], 4 * q);
    });
    FDOTS.forEach((d, q0) => {
      const q = NDOT + q0, y = FUY[d.f] + d.jy * 0.07, z = d.jz * 0.08;
      A.aStr.set([SX(d.v0), y, z], 3 * q); A.aEnd.set([SX(d.v1), y, z], 3 * q); A.aMap.set([SX(d.v0), y, z], 3 * q);
      A.aCol.set(d.col, 3 * q); A.aD.set([4 + d.f, d.k, 0, 0], 4 * q);
    });
    for (const k in A) geo.setAttribute(k, new THREE.BufferAttribute(A[k], k === 'aD' ? 4 : 3));
    const pts = new THREE.Points(geo, dotMat);
    pts.frustumCulled = false; pts.renderOrder = 5; gPop.add(pts);
  }
  STATS.forEach(s => { if (s.n) { s.x /= s.n; s.y /= s.n; s.z /= s.n; } });
  // follow-up trails: from where each ring started to where it is
  const trailMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uFol: { value: 0 }, uK: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aStr, aEnd, aCol; attribute vec2 aW;
uniform float uA, uFol, uK;
varying vec3 vC; varying float vA;
void main() {
  float s = smoothstep(0.3 + 0.25 * aW.y, 0.72 + 0.25 * aW.y, uFol);
  vec3 p = mix(aStr, mix(aStr, aEnd, s), aW.x);
  vC = mix(aCol, vec3(0.22, 0.74, 0.97), s * aW.x); vA = uA * uK * mix(0.06, 0.5, aW.x) * step(0.001, distance(aEnd, aStr)) * smoothstep(0.0, 0.1, s);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,
    fragmentShader: 'varying vec3 vC; varying float vA; void main() { if (vA < 0.003) discard; gl_FragColor = vec4(vC, vA); }',
  });
  set.mats.push(trailMat);
  if (NFD) {
    const geo = new THREE.BufferGeometry(), A = { position: new Float32Array(6 * NFD), aStr: new Float32Array(6 * NFD), aEnd: new Float32Array(6 * NFD), aCol: new Float32Array(6 * NFD), aW: new Float32Array(4 * NFD) };
    FDOTS.forEach((d, q) => {
      const y = FUY[d.f] + d.jy * 0.07, z = d.jz * 0.08, s = [SX(d.v0), y, z], e = [SX(d.v1), y, z];
      for (let w = 0; w < 2; w++) { A.aStr.set(s, 6 * q + 3 * w); A.aEnd.set(e, 6 * q + 3 * w); A.aCol.set(d.col, 6 * q + 3 * w); A.aW.set([w, d.k], 4 * q + 2 * w); }
    });
    for (const k in A) geo.setAttribute(k, new THREE.BufferAttribute(A[k], k === 'aW' ? 2 : 3));
    const ls = new THREE.LineSegments(geo, trailMat);
    ls.frustumCulled = false; ls.renderOrder = 4; gPop.add(ls);
  }
  // the person shown in the one-scan network: a white-ringed dot among the others
  const perGeo = K.pointsGeo(2);
  for (const n of ['position', 'aCol', 'aA', 'aSize']) perGeo.attributes[n].setUsage(THREE.DynamicDrawUsage);
  const person = new THREE.Points(perGeo, K.points(set, { additive: false, hard: true }));
  person.frustumCulled = false; person.renderOrder = 8; gPop.add(person);

  // ---------------------------------------------------------------- the strip's and the map's frames, summaries
  const pPill = pillSet(gPop, 16, 7, false), bgPill = pillSet(gPop, 5, 1, false);
  // the map's legend (the poster's): a swatch per group, its label beside it
  const LEG = k => [MAPR.x1 - 0.6, MAPR.y1 - 0.01 - k * 0.1, 0.02];
  GKEY.forEach((key, k) => { const p = LEG(k); pPill.put(12 + k, p[0] - 0.03, p[1], p[2], 0.016, 0.016, 0.016, 0.012, GCOL[k], 1); });
  const P_MAP = 0, P_STRIP = 1, P_SH0 = 2, P_SH1 = 3, P_HB = 4;
  bgPill.put(P_MAP, (MAPR.x0 + MAPR.x1) / 2, (MAPR.y0 + MAPR.y1) / 2, -0.12, (MAPR.x1 - MAPR.x0) / 2 + 0.13, (MAPR.y1 - MAPR.y0) / 2 + 0.12, 0.05, 0, PANEL, 0.6, 1, 0.0025);
  bgPill.put(P_STRIP, SX0 + SW / 2, 0.21, -0.12, SW / 2 + 0.08, 0.58, 0.05, 0, PANEL, 0.6, 1, 0.0025);
  const shaded = Array.isArray(MD.shaded) ? MD.shaded : [];
  [P_SH0, P_SH1].forEach((k, q) => {
    const r = shaded[q];
    if (r) bgPill.put(k, SX((r[0] + r[1]) / 2), (AXY + 0.56) / 2, -0.1, (r[1] - r[0]) * SK / 2, (0.56 - AXY) / 2, 0.003, 0, [0.42, 0.46, 0.54], 0.1);
  });
  const HQ = MG[3] ? (Array.isArray(MG[3].err) ? MG[3].err : [QH(0.25), QH(0.75)]) : [4.1, 5];
  bgPill.put(P_HB, SX((HQ[0] + HQ[1]) / 2), (AXY + 0.98) / 2, -0.09, (HQ[1] - HQ[0]) * SK / 2, (0.98 - AXY) / 2, 0.012, 0, GCOL[3], 0.12, 1, 0.003);
  // each group: the p10-p90 whisker, the interquartile bar (the poster's error bar) and the median (its big dot)
  MG.forEach((g, k) => {
    if (!g) return;
    const y = ROWY[k], z = 0.08, q = g.q || {}, e = Array.isArray(g.err) ? g.err : [QF[k](0.25), QF[k](0.75)];
    const w0 = Number.isFinite(q.p10) ? q.p10 : QF[k](0.1), w1 = Number.isFinite(q.p90) ? q.p90 : QF[k](0.9);
    pPill.put(3 * k, SX((w0 + w1) / 2), y, z, (w1 - w0) * SK / 2, 0.0045, 0.0045, 0, GCOL[k], 0.7);
    pPill.put(3 * k + 1, SX((e[0] + e[1]) / 2), y, z + 0.002, (e[1] - e[0]) * SK / 2, 0.019, 0.019, 0.014, GCOL[k], 0.95);
    pPill.put(3 * k + 2, SX(Number.isFinite(g.centre) ? g.centre : QF[k](0.5)), y, z + 0.004, 0.04, 0.04, 0.04, 0.022, GCOL[k], 1, 1, 0.007);
  });
  // lines: map axes (group 0), strip axis and ticks (1), dashed lines (2), follow-up row guides (3)
  const pLines = lineSet(gPop, 4, 2);
  {
    const x0 = MAPR.x0 - 0.06, y0 = MAPR.y0 - 0.06;
    pLines.seg([x0, y0, -0.1], [MAPR.x1 + 0.05, y0, -0.1], INK, 0.6, 0).seg([x0, y0, -0.1], [x0, MAPR.y1 + 0.05, -0.1], INK, 0.6, 0);
    pLines.seg([MAPR.x1 + 0.05, y0, -0.1], [MAPR.x1 + 0.02, y0 + 0.015, -0.1], INK, 0.6, 0).seg([MAPR.x1 + 0.05, y0, -0.1], [MAPR.x1 + 0.02, y0 - 0.015, -0.1], INK, 0.6, 0);
    pLines.seg([x0, MAPR.y1 + 0.05, -0.1], [x0 - 0.015, MAPR.y1 + 0.02, -0.1], INK, 0.6, 0).seg([x0, MAPR.y1 + 0.05, -0.1], [x0 + 0.015, MAPR.y1 + 0.02, -0.1], INK, 0.6, 0);
    pLines.seg([SX0, AXY, -0.08], [SX0 + SW, AXY, -0.08], INK, 0.7, 1);
    for (let v = 0; v <= Math.floor(AXMAX); v++) pLines.seg([SX(v), AXY, -0.08], [SX(v), AXY - 0.025, -0.08], INK, 0.7, 1);
    for (let v = 0.5; v < AXMAX; v += 1) pLines.seg([SX(v), AXY, -0.08], [SX(v), AXY - 0.012, -0.08], INK, 0.4, 1);
    (Array.isArray(MD.dashed) ? MD.dashed : []).forEach(v => pLines.dash([SX(v), AXY, -0.09], [SX(v), 0.56, -0.09], 18, INK, 0.45, 2));
    FUY.forEach(y => pLines.seg([SX0, y - 0.055, -0.1], [SX0 + SW, y - 0.055, -0.1], MUTED, 0.12, 3));
  }
  pLines.build();
  const sTex = textPlane(gPop, SX0 + SW / 2, AXY - 0.06, -0.08, SW + 0.24, (SW + 0.24) / 16, 1024, 3, (c, X, Y, px) => {
    c.font = font(600, 0.085 * px); c.fillStyle = hexOf(l3(MUTED, INK, 0.4)); c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let v = 0; v <= Math.floor(AXMAX); v++) c.fillText(String(v), X(SX(v)), Y(AXY - 0.068));
  });

  // ---------------------------------------------------------------- survival by the index's thirds (poster's Kaplan-Meier)
  const KMD = PO.km || {}, KC = (KMD.curves || []).slice(0, 3), KT = KMD.table || [];
  const KMAX = (Array.isArray(KMD.months) && KMD.months[1] > 0) ? KMD.months[1] : 140;
  const KX0 = -0.6, KW = 1.32, KY0 = -0.38, KH = 0.86;
  const kx = m => KX0 + m / KMAX * KW, ky = s => KY0 + clamp(s, 0, 1) * KH;
  const thirdName = (c, k) => { const s = String((c && c.label) || ''); return /near healthy/i.test(s) ? 'Near healthy' : /intermediate/i.test(s) ? 'Intermediate' : /remote/i.test(s) ? 'Remote' : ['Near healthy', 'Intermediate', 'Remote'][k]; };
  // a staircase through the read-off points: the value holds, then drops in small steps between two readings
  function stair(pts) {
    const out = [[pts[0][0], pts[0][1]]];
    for (let k = 1; k < pts.length; k++) {
      const [m0, s0] = pts[k - 1], [m1, s1] = pts[k];
      if (Math.abs(s1 - s0) < 1e-4) { out.push([m1, s0]); continue; }
      const n = Math.max(1, Math.round((m1 - m0) / 2.5));
      for (let q = 1; q <= n; q++) {
        const md = m0 + (m1 - m0) * (q - 0.7 + 0.4 * R()) / n, v0 = s0 + (s1 - s0) * (q - 1) / n, v1 = s0 + (s1 - s0) * q / n;
        out.push([md, v0], [md, v1]);
      }
      out.push([m1, s1]);
    }
    return out;
  }
  const stairAt = (st, m) => { let v = st[0][1]; for (const p of st) { if (p[0] > m) break; v = p[1]; } return v; };
  const kmSt = KC.map(c => (Array.isArray(c.s) && c.s.length > 1 ? stair(c.s) : null));
  // ribbons (curves, with a soft glow) and bands, each vertex with its month (reveal) and its curve (alpha)
  const ribMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uGA: { value: new Float32Array(8) }, uGR: { value: new Float32Array(8) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `${PK}
attribute vec3 aCol; attribute vec4 aD;   // across (-1..1), month (0..1), curve, glow
uniform float uA; uniform vec4 uGA[2], uGR[2];
varying vec3 vC; varying float vA, vV, vT, vR, vGl;
void main() {
  vC = aCol; vV = aD.x; vT = aD.y; vGl = aD.w; vA = uA * GET(uGA, aD.z); vR = GET(uGR, aD.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `
varying vec3 vC; varying float vA, vV, vT, vR, vGl;
void main() {
  if (vT > vR) discard;
  float e = abs(vV);
  float a = vGl > 1.5 ? 0.17 : (vGl > 0.5 ? exp(-e * 3.0) * 0.22 : 1.0 - smoothstep(0.55, 1.0, e));
  a *= vA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(vC, vec3(1.0), vGl < 0.5 ? 0.25 * (1.0 - e) : 0.0), a);
}`,
  });
  set.mats.push(ribMat);
  {
    const P = [], C = [], A = [], idx = [];
    let nv = 0;
    const quad = (a, b, c, d, col, across, t, g, gl) => {
      [a, b, c, d].forEach((p, q) => { P.push(p[0], p[1], p[2]); C.push(...col); A.push(across[q], t[q], g, gl); });
      idx.push(nv, nv + 1, nv + 2, nv, nv + 2, nv + 3); nv += 4;
    };
    // a ribbon along one straight piece (horizontal or vertical), square ends so the corners meet
    const ribbon = (m0, s0, m1, s1, w, col, g, gl) => {
      const x0 = kx(m0), y0 = ky(s0), x1 = kx(m1), y1 = ky(s1), z = gl ? 0.002 : 0.006;
      const t0 = m0 / KMAX, t1 = m1 / KMAX;
      if (Math.abs(y1 - y0) < 1e-6) quad([x0 - w, y0 - w, z], [x1 + w, y0 - w, z], [x1 + w, y0 + w, z], [x0 - w, y0 + w, z], col, [-1, -1, 1, 1], [t0, t1, t1, t0], g, gl);
      else quad([x0 - w, y0 + w, z], [x0 + w, y0 + w, z], [x0 + w, y1 - w, z], [x0 - w, y1 - w, z], col, [-1, 1, 1, -1], [t0, t0, t0, t0], g, gl);
    };
    KC.forEach((c, k) => {
      const st = kmSt[k]; if (!st) return;
      // the band between the lower and upper limits, in half-month slices
      if (Array.isArray(c.lo) && Array.isArray(c.hi) && c.lo.length > 1 && c.hi.length > 1) {
        const lo = stair(c.lo), hi = stair(c.hi), mEnd = Math.min(c.lo[c.lo.length - 1][0], c.hi[c.hi.length - 1][0]);
        for (let m = 0; m < mEnd; m += 0.5) {
          const m2 = Math.min(mEnd, m + 0.5), a = stairAt(lo, m + 0.25), b = stairAt(hi, m + 0.25);
          quad([kx(m), ky(a), 0], [kx(m2), ky(a), 0], [kx(m2), ky(b), 0], [kx(m), ky(b), 0], THIRD[k], [0, 0, 0, 0], [m / KMAX, m2 / KMAX, m2 / KMAX, m / KMAX], 3 + k, 2);
        }
      }
      for (let q = 1; q < st.length; q++) {
        const [m0, s0] = st[q - 1], [m1, s1] = st[q];
        if (Math.abs(m1 - m0) < 1e-6 && Math.abs(s1 - s0) < 1e-6) continue;
        ribbon(m0, s0, m1, s1, 0.005, THIRD[k], k, 0);
        ribbon(m0, s0, m1, s1, 0.016, THIRD[k], k, 1);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P.length ? P : [0, 0, 0], 3));
    geo.setAttribute('aCol', new THREE.Float32BufferAttribute(C.length ? C : [0, 0, 0], 3));
    geo.setAttribute('aD', new THREE.Float32BufferAttribute(A.length ? A : [0, 0, 0, 0], 4));
    if (idx.length) geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, ribMat);
    mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.visible = idx.length > 0; gKM.add(mesh);
  }
  const kPill = pillSet(gKM, 4, 1, false), KLEG = k => [kx(KMAX * 0.56), ky(0.95 - k * 0.085), 0.01];
  kPill.put(0, 0.04, 0.05, -0.02, 0.86, 0.66, 0.05, 0, PANEL, 0.78, 1, 0.0025);
  [0, 1, 2].forEach(k => { const p = KLEG(k); kPill.put(1 + k, p[0] - 0.05, p[1], p[2], 0.035, 0.006, 0.006, 0.012, THIRD[k], 1); });
  const kLines = lineSet(gKM, 2, 2);
  kLines.seg([KX0, KY0, 0], [KX0 + KW, KY0, 0], INK, 0.7, 0).seg([KX0, KY0, 0], [KX0, KY0 + KH, 0], INK, 0.7, 0);
  for (let m = 0; m <= KMAX + 1e-6; m += 20) kLines.seg([kx(m), KY0, 0], [kx(m), KY0 - 0.018, 0], INK, 0.7, 0);
  for (let s = 0.2; s <= 1.0001; s += 0.2) { kLines.seg([KX0, ky(s), 0], [KX0 - 0.018, ky(s), 0], INK, 0.7, 0); kLines.seg([KX0, ky(s), -0.002], [KX0 + KW, ky(s), -0.002], MUTED, 0.1, 0); }
  kLines.build();
  const kTex = textPlane(gKM, 0.04, 0.05, -0.008, 1.8, 1.8, 1024, 2, (c, X, Y, px) => {
    c.textBaseline = 'middle';
    c.font = font(700, 0.06 * px); c.fillStyle = hexOf(INK); c.textAlign = 'left';
    c.fillText('Survival by thirds of the index', X(KX0), Y(KY0 + KH + 0.125));
    c.font = font(500, 0.036 * px); c.fillStyle = hexOf(l3(MUTED, INK, 0.3));
    c.fillText(`${KC.length ? KC.map(x => x.n).join(', ') + ' people' : 'People'} by the index's thirds: the poster's curves and table`, X(KX0), Y(KY0 + KH + 0.06));
    c.font = font(600, 0.042 * px); c.textAlign = 'center';
    for (let m = 0; m <= KMAX + 1e-6; m += 20) c.fillText(String(m), X(kx(m)), Y(KY0 - 0.048));
    c.textAlign = 'right';
    for (let s = 0; s <= 1.0001; s += 0.2) c.fillText(s.toFixed(1), X(KX0 - 0.03), Y(ky(s)));
    c.font = font(600, 0.044 * px); c.fillStyle = hexOf(INK); c.textAlign = 'center';
    c.fillText('Months', X(KX0 + KW / 2), Y(KY0 - 0.115));
    c.save(); c.translate(X(KX0 - 0.13), Y(KY0 + KH / 2)); c.rotate(-PI / 2); c.fillText('Survival', 0, 0); c.restore();
    // the poster's table, inside the chart's lower left
    if (KT.length) {
      const x0 = KX0 + 0.035, cw = [0.25, 0.13, 0.13, 0.19], rh = 0.056, y0 = KY0 + 0.022 + rh * 4;
      const hdr = ['Third', 'Deaths', '1 year', 'Median'];
      c.fillStyle = 'rgba(4,9,18,0.82)'; c.fillRect(X(x0 - 0.01), Y(y0 + 0.008), (cw.reduce((a, b) => a + b, 0) + 0.02) * px, (rh * 4 + 0.016) * px);
      const cell = (txt, k, row, w, col) => { let x = x0; for (let q = 0; q < k; q++) x += cw[q]; c.font = font(w, 0.034 * px); c.fillStyle = col; c.textAlign = k ? 'center' : 'left'; c.fillText(txt, X(k ? x + cw[k] / 2 : x + 0.035), Y(y0 - rh * (row + 0.5))); };
      hdr.forEach((h, k) => cell(h, k, 0, 700, hexOf(MUTED)));
      KT.slice(0, 3).forEach((r, q) => {
        c.fillStyle = hexOf(THIRD[q]); c.globalAlpha = 0.16; c.fillRect(X(x0), Y(y0 - rh * (q + 1) - 0.002), (cw.reduce((a, b) => a + b, 0)) * px, (rh - 0.006) * px); c.globalAlpha = 1;
        c.fillStyle = hexOf(THIRD[q]); c.fillRect(X(x0 + 0.004), Y(y0 - rh * (q + 1.5) + 0.012), 0.022 * px, 0.024 * px);
        const pct = s => String(s).replace(/\s*%$/, ' %'), med = String(r.median) === 'NR' ? 'not reached' : `${r.median} mo`;
        cell(thirdName(KC[q], q), 0, q + 1, 600, hexOf(INK)); cell(pct(r.deaths), 1, q + 1, 600, hexOf(INK)); cell(pct(r.oneYear), 2, q + 1, 600, hexOf(INK)); cell(med, 3, q + 1, 600, hexOf(INK));
      });
    }
  });

  // ---------------------------------------------------------------- the immunotherapy test (poster's response strip and AUCs)
  const PG = PO.prognosis || {}, PST = PG.strip || {}, AUC = (PG.auc || []).slice(0, 6);
  const RAX = (Array.isArray(PST.axis) && PST.axis[1] > 0) ? PST.axis[1] : 6.85, RX0 = -0.42, RX1 = 0.8, rx = v => RX0 + v / RAX * (RX1 - RX0), RAY = 0.3;
  const AA0 = 0.45, AA1 = 1.0, AX0 = -0.2, AX1 = 0.56, ax = v => AX0 + (v - AA0) / (AA1 - AA0) * (AX1 - AX0), AAY = -0.46;
  const aRowY = r => 0.05 - r * 0.083 - (r >= 3 ? 0.035 : 0);
  const isNet = a => a.group === 'network' || /index|heterogen|clearance/i.test(a.label);
  const aPill = pillSet(gAUC, 1 + 2 * 6 + 5, 3, false);
  aPill.put(0, 0.0, 0.08, -0.02, 0.92, 0.7, 0.05, 0, PANEL, 0.78, 1, 0.0025);
  AUC.forEach((a, r) => {
    aPill.put(1 + r, (AX0 + AX1) / 2, aRowY(r), -0.004, (AX1 - AX0) / 2, 0.03, 0.006, 0, [0.14, 0.18, 0.26], 0.4);
    aPill.put(7 + r, AX0, aRowY(r), 0, 0.001, 0.03, 0.006, 0.02, isNet(a) ? WARM : CLIN, 1);
  });
  // the two summary bands: good response (min to max, the quartiles, the median), poor response (min to max, median)
  const RG = PST.good || null, RB = PST.bad || PST.poor || null, RGY = 0.5, RBY = 0.4;
  // pills k (min to max), k + 1 (the quartiles, when given) and the last (the median)
  const band = (k, s, y, col) => {
    if (!s || !Number.isFinite(s.min) || !Number.isFinite(s.max)) return;
    const q = Number.isFinite(s.q1) && Number.isFinite(s.q3);
    aPill.put(k, rx((s.min + s.max) / 2), y, 0.002, (s.max - s.min) / RAX * (RX1 - RX0) / 2, 0.012, 0.012, 0.01, col, 0.75);
    if (q && k + 2 < 18) aPill.put(k + 1, rx((s.q1 + s.q3) / 2), y, 0.004, (s.q3 - s.q1) / RAX * (RX1 - RX0) / 2, 0.026, 0.006, 0.012, col, 0.95);
    if (Number.isFinite(s.median)) aPill.put(q ? k + 2 : k + 1, rx(s.median), y, 0.006, 0.007, 0.045, 0.006, 0.01, [1, 1, 1], 1, 1, 0);
  };
  band(13, RG, RGY, GOOD); band(16, RB, RBY, POOR);
  const aLines = lineSet(gAUC, 2, 2);
  aLines.seg([RX0, RAY, 0], [RX1, RAY, 0], INK, 0.7, 0);
  for (let v = 0; v <= Math.floor(RAX); v++) aLines.seg([rx(v), RAY, 0], [rx(v), RAY - 0.018, 0], INK, 0.7, 0);
  (Array.isArray(PST.dashed) ? PST.dashed : []).forEach(v => aLines.dash([rx(v), RAY, -0.002], [rx(v), 0.58, -0.002], 12, GOOD, 0.5, 0));
  aLines.seg([AX0, AAY, 0], [AX1, AAY, 0], INK, 0.7, 1);
  for (let v = 0.5; v <= AA1 + 1e-6; v += 0.1) aLines.seg([ax(v), AAY, 0], [ax(v), AAY - 0.018, 0], INK, 0.7, 1);
  const CH = Number.isFinite(PG.chance) ? PG.chance : 0.5;
  aLines.dash([ax(CH), AAY, 0.008], [ax(CH), aRowY(0) + 0.06, 0.008], 16, INK, 0.55, 1);
  aLines.build();
  const aTex = textPlane(gAUC, 0, 0.08, -0.008, 1.84, 1.84, 1024, 2, (c, X, Y, px) => {
    c.textBaseline = 'middle';
    c.font = font(700, 0.06 * px); c.fillStyle = hexOf(INK); c.textAlign = 'left';
    c.fillText('Immunotherapy before surgery', X(-0.84), Y(0.715));
    c.font = font(500, 0.036 * px); c.fillStyle = hexOf(l3(MUTED, INK, 0.3));
    c.fillText(`${PG.n ? PG.n + ' people' : 'People'} with lung cancer: a first test`, X(-0.84), Y(0.665));
    c.font = font(600, 0.04 * px); c.textAlign = 'center'; c.fillStyle = hexOf(l3(MUTED, INK, 0.3));
    for (let v = 0; v <= Math.floor(RAX); v++) c.fillText(String(v), X(rx(v)), Y(RAY - 0.045));
    c.font = font(500, 0.033 * px);
    if (PST.label) c.fillText(cap(PST.label), X((RX0 + RX1) / 2), Y(RAY - 0.095));
    c.font = font(600, 0.04 * px);
    for (let v = 0.5; v <= AA1 + 1e-6; v += 0.1) c.fillText(v.toFixed(1), X(ax(v)), Y(AAY - 0.045));
    c.font = font(500, 0.034 * px); c.fillText('AUC: good from poor responders (0.5 is chance)', X((AX0 + AX1) / 2 - 0.14), Y(AAY - 0.1));
    c.textAlign = 'right';
    AUC.forEach((a, r) => {
      c.font = font(isNet(a) ? 700 : 600, 0.042 * px); c.fillStyle = hexOf(isNet(a) ? WARM : INK);
      const txt = a.label.replace(/^Metabolic displacement index$/i, 'Displacement index');
      c.fillText(txt, X(AX0 - 0.03), Y(aRowY(r)));
    });
    c.font = font(700, 0.032 * px); c.textAlign = 'left';
    c.fillStyle = hexOf(WARM); c.fillText('network measures', X(-0.84), Y(aRowY(0) + 0.07));
    c.fillStyle = hexOf(CLIN); c.fillText('clinical measures', X(-0.84), Y(aRowY(3) + 0.065));
  });

  // ---------------------------------------------------------------- state, anchors, labels
  const U = new Array(N).fill(1);
  const cur = { bars: 0, ratio: 0, thr: 0, one: 0, met: 0, map: 0, mdi: 0, km: 0, resp: 0, fol: 0, theta: THETA, m: measure(PU[0], THETA), plane: FY, prof: 0,
    top: new Float32Array(NL), hub: -1, person: [0, 0, 0], pRow: 3, ring: 1, ringT: 0 };
  const own = f => { const o = [0, 0, 0]; return () => f(o); };
  const cp = (o, p) => { o[0] = p[0]; o[1] = p[1]; o[2] = p[2]; return o; };
  const kmAnchor = k => tr(gKM, KLEG(k));
  const groupAt = (k, o) => (cur.mdi > 0.5 ? tr(gPop, [SX(MG[k] && Number.isFinite(MG[k].centre) ? MG[k].centre : 5), ROWY[k], 0.08], o) : cp(o, [STATS[k].x, STATS[k].y, STATS[k].z]));
  const anchors = {
    one: own(o => tr(gRing, RC, o)),
    profile: own(o => tr(gRing, [RC[0] - 0.24, RC[1] + RR + 0.17, RC[2]], o)),
    bars: own(o => tr(gBars, [0, BY(0) + 0.08, 0], o)),
    field: [0, FY + 0.05, FZ],
    example: own(o => { const i = ONE.indexOf('kidneys'), j = ONE.indexOf('fat'); return i < 0 || j < 0 ? cp(o, [0, FY, FZ]) : cp(o, [cellX(j), cur.top[i * N + j] + 0.04, cellZ(i)]); }),
    plane: own(o => cp(o, [cellX(N - 1) + FP * 0.65, cur.plane + 0.01, cellZ(N - 1) + FP * 0.65])),
    metrics: tr(gMet, [0, 0.1, 0]),
    clearance: tr(gMet, [GA.C[0] - 0.19, GA.C[1] + GA.C[2] + 0.08, 0]),
    hetero: tr(gMet, [GA.H[0] - 0.19, GA.H[1] + GA.H[2] + 0.08, 0]),
    dial: tr(gMet, [GA.X[0] - 0.3, GA.X[1] - GA.X[2] - 0.07, 0]),
    note: tr(gMet, [GA.X[0] - 0.3, GA.X[1] - GA.X[2] - 0.2, 0]),
    map: [(MAPR.x0 + MAPR.x1) / 2, (MAPR.y0 + MAPR.y1) / 2, 0],
    mapNote: [MAPR.x0 - 0.04, MAPR.y1 + 0.13, 0],
    mapX: [MAPR.x1 - 0.32, MAPR.y0 - 0.12, 0],
    mapY: [MAPR.x0 - 0.04, MAPR.y1 + 0.05, 0],
    strip: [SX0 + SW / 2, 0.15, 0],
    axis: [SX(AXMAX / 2) - 0.45, AXY - 0.16, 0],
    person: own(o => cp(o, cur.person)),
    km: tr(gKM, [KX0 + KW / 2, KY0 + KH / 2, 0]),
    auc: tr(gAUC, [0, 0.08, 0]),
    good: tr(gAUC, [rx(RG && Number.isFinite(RG.max) ? RG.max : 4.7) + 0.03, RGY, 0.01]),
    poor: tr(gAUC, [rx(RB && Number.isFinite(RB.max) ? RB.max : 5.5) + 0.03, RBY, 0.01]),
    healthy: [SX(HQ[1]), 0.98, 0],
  };
  ONE.forEach((id, i) => {
    anchors[id] = own(o => tr(gRing, [NODE[i][0], NODE[i][1] + 0.0, NODE[i][2] + 0.02], o));
    anchors['bar_' + id] = own(o => tr(gBars, [BX0 + BTRK + 0.02, BY(i), 0], o));
  });
  GKEY.forEach((k, q) => {
    anchors['g' + (q + 1)] = own(o => groupAt(q, o));
    anchors['lab_g' + (q + 1)] = own(o => cp(o, l3(LEG(q), [SX(Math.min(AXMAX - 2.6, 8.0)), ROWY[q], 0.02], prog(cur.mdi, 0.2, 0.8))));
  });
  [0, 1, 2].forEach(k => { anchors['km' + (k + 1)] = own(o => cp(o, kmAnchor(k))); });
  AUC.forEach((a, r) => { anchors['auc' + (r + 1)] = tr(gAUC, [ax(a.auc) + 0.025, aRowY(r), 0.01]); });
  FU.forEach((f, k) => { anchors['f' + (k + 1)] = [SX(Math.min(AXMAX - 2.6, 8.0)), FUY[k], 0.02]; });

  const near = (x, k) => sat(1 - Math.abs(x - k) * 2.2);
  const S_ = (S, n) => sat(S[n]);
  const oneOff = S => 1 - S_(S, 'people_map');                                  // the one-scan part gives way to the people
  const popQuiet = S => 1 - prog(Math.max(S_(S, 'people_km'), S_(S, 'people_response')), 0, 0.5);
  const labels = [];
  ORG.forEach((o, i) => {
    labels.push({ text: [o.short || o.name, ''], at: 'bar_' + o.id, cls: '', alpha: S => S_(S, 'people_bars') * (1 - prog(S_(S, 'people_one'), 0.2, 0.5)) * (1 - S_(S, 'people_metrics')) * oneOff(S) });
    labels.push({ text: [o.short || o.name, ''], at: o.id, cls: '', minor: o.id !== 'kidneys', alpha: S => prog(S_(S, 'people_one'), 0.55, 0.9) * (1 - prog(S_(S, 'people_metrics'), 0, 0.35)) * oneOff(S) });
  });
  labels.push({ text: ['Uptake', ' · mean SUV, one scan'], at: 'bars', cls: '', alpha: S => S_(S, 'people_bars') * (1 - prog(S_(S, 'people_one'), 0.2, 0.5)) * oneOff(S) });
  labels.push({ text: ['Kidneys ÷ fat', ' · one ratio'], at: 'example', cls: 'amb', alpha: S => prog(S_(S, 'people_ratio'), 0.6, 0.95) * (1 - prog(S_(S, 'people_one'), 0, 0.3)) * oneOff(S) });
  labels.push({ text: ['Threshold', ''], at: 'plane', cls: 'cyn', alpha: S => prog(S_(S, 'people_thresh'), 0.3, 0.8) * (1 - prog(S_(S, 'people_one'), 0.5, 0.9)) * oneOff(S) });
  PROF.forEach((p, k) => labels.push({ text: [PROFN[p], ' · illustrative uptakes'], at: 'profile', cls: '', alpha: S => near(S.people_profile || 0, k) * (1 - S_(S, 'people_custom')) * S_(S, 'people_one') * oneOff(S) }));
  labels.push({ text: ['Your uptakes', ''], at: 'profile', cls: 'amb', alpha: S => S_(S, 'people_custom') * S_(S, 'people_one') * oneOff(S) });
  labels.push({ text: ['Clearance', ''], at: 'clearance', cls: 'amb', alpha: S => prog(S_(S, 'people_metrics'), 0.05, 0.4) * oneOff(S) });
  labels.push({ text: ['Heterogeneity', ''], at: 'hetero', cls: 'amb', alpha: S => prog(S_(S, 'people_metrics'), 0.3, 0.65) * oneOff(S) });
  labels.push({ text: ['Displacement index', ' · 0 to 10'], at: 'dial', cls: 'amb', alpha: S => prog(S_(S, 'people_metrics'), 0.55, 0.9) * oneOff(S) });
  labels.push({ text: ['Illustrative maths', ' · formulas not yet published'], at: 'note', cls: '', alpha: S => prog(S_(S, 'people_metrics'), 0.6, 1) * oneOff(S) });
  // the people
  MG.forEach((g, k) => {
    if (!g) return;
    labels.push({ text: [g.name || PROFN[GKEY[k]], ` · n = ${g.n}`], at: 'lab_g' + (k + 1), cls: { healthy: 'cyn', dys: 'mag' }[GKEY[k]] || '',
      alpha: S => { const sel = clamp(S.people_group || 0, 0, 4), hi = sat(1 - Math.abs(sel - (k + 1))); return prog(S_(S, 'people_map'), 0.6, 1) * lerp(1, 0.35 + 0.65 * hi, sat(sel)) * popQuiet(S) * (1 - 0.4 * S_(S, 'people_follow')); } });
  });
  labels.push({ text: ['Clearance', ' →'], at: 'mapX', cls: '', alpha: S => prog(S_(S, 'people_map'), 0.6, 1) * (1 - prog(S_(S, 'people_mdi'), 0, 0.4)) });
  labels.push({ text: ['Heterogeneity', ' ↑'], at: 'mapY', cls: '', alpha: S => prog(S_(S, 'people_map'), 0.6, 1) * (1 - prog(S_(S, 'people_mdi'), 0, 0.4)) });
  labels.push({ text: [`${fmt(NDOT)} people`, ' · stand-in dots, group summaries'], at: 'mapNote', cls: '', alpha: S => prog(S_(S, 'people_map'), 0.6, 1) * (1 - prog(S_(S, 'people_mdi'), 0, 0.4)) });
  labels.push({ text: ['This scan', ''], at: 'person', cls: 'amb', alpha: S => prog(S_(S, 'people_map'), 0.5, 0.9) * (1 - prog(S_(S, 'people_mdi'), 0, 0.5)) * (1 - S_(S, 'people_one')) });
  labels.push({ text: ['Metabolic displacement index', ''], at: 'axis', cls: '', alpha: S => prog(S_(S, 'people_mdi'), 0.5, 1) * S_(S, 'people_map') * popQuiet(S) });
  KC.forEach((c, k) => {
    labels.push({ text: [thirdName(c, k), ` · n = ${c.n}`], at: 'km' + (k + 1), cls: ['cyn', '', ''][k], alpha: S => prog(S_(S, 'people_km'), 0.55 + 0.1 * k, 0.85 + 0.1 * k) });
  });
  if (RG) labels.push({ text: ['Good response', ` · n = ${RG.n}`], at: 'good', cls: 'cyn', alpha: S => prog(S_(S, 'people_response'), 0.05, 0.3) });
  if (RB) labels.push({ text: ['Poor response', ` · n = ${RB.n}`], at: 'poor', cls: '', alpha: S => prog(S_(S, 'people_response'), 0.1, 0.35) });
  AUC.forEach((a, r) => labels.push({ text: [`AUC ${a.auc}`, Number.isFinite(a.p) ? ` · P = ${a.p}` : ''], at: 'auc' + (r + 1), cls: isNet(a) ? 'amb' : '',
    alpha: S => prog(S_(S, 'people_response'), 0.4 + 0.08 * r, 0.6 + 0.08 * r) }));
  FU.forEach((f, k) => labels.push({ text: [f.name, ` · n = ${f.n}`], at: 'f' + (k + 1), cls: f.from >= 0 ? 'amb' : '', alpha: S => prog(S_(S, 'people_follow'), 0.1, 0.4) * S_(S, 'people_mdi') }));

  // ---------------------------------------------------------------- update
  const st0 = (i, j) => 0.42 * i / N + 0.06 * j / N;     // when a column's links fly up (people_one)
  const uE = partMat.uniforms.uE.value, uF = partMat.uniforms.uF.value, uH = partMat.uniforms.uH.value, uT = tubeMat.uniforms.uT.value, uB = tubeMat.uniforms.uB.value;
  const M4 = new THREE.Matrix4(), Q0 = new THREE.Quaternion(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3();
  let lastKey = '';
  function update(S, t) {
    const bars = S_(S, 'people_bars'), ratio = S_(S, 'people_ratio'), thr = S_(S, 'people_thresh'), one = S_(S, 'people_one'), met = S_(S, 'people_metrics');
    const map = S_(S, 'people_map'), mdi = S_(S, 'people_mdi'), km = S_(S, 'people_km'), resp = S_(S, 'people_response'), fol = S_(S, 'people_follow');
    const theta = clamp(Number.isFinite(S.people_theta) ? S.people_theta : THETA, 1.01, 10);
    uptakes(S, U);
    const M = measure(U, theta);
    Object.assign(cur, { bars, ratio, thr, one, met, map, mdi, km, resp, fol, theta, m: M, prof: clamp(S.people_profile || 0, 0, 3) });
    const lt = Math.log(theta);
    cur.plane = FY + HS * lt * thr;

    // the bars: in the middle at first, then to the left as the network forms
    const sl = prog(one, 0.05, 0.5);
    gBars.position.set(lerp(-0.47, -1.6, sl), lerp(-0.02, 0.02, sl), lerp(0, 0.16, sl));
    gBars.rotation.y = 0.22 * sl; gBars.scale.setScalar(lerp(1, 0.94, sl)); gBars.updateMatrix();
    const ba = bars;
    bPill.a(2 * N, prog(ba, 0, 0.3));
    for (let i = 0; i < N; i++) {
      const g = prog(ba, 0.1 + 0.06 * i, 0.55 + 0.06 * i), len = Math.max(0.002, Math.min(U[i], 5.2) * BK * g);
      bPill.a(i, prog(ba, 0, 0.3));
      bPill.x(N + i, BX0 + len / 2, len / 2); bPill.a(N + i, prog(ba, 0.05, 0.3));
      bIco.attributes.aA.array[i] = prog(ba, 0, 0.3);
    }
    bPill.flush(); bIco.attributes.aA.needsUpdate = true;
    bLines.g[0] = prog(ba, 0, 0.4);

    // the field: columns rise to ln(u_i / u_j); the plane rises to ln(theta); lit columns become links
    const fa = prog(ratio, 0, 0.3);
    for (let k = 0; k <= NL; k++) fPill.a(k, fa);
    fPill.flush();
    plPill.a(0, prog(thr, 0, 0.2)); plPill.flush();
    plPill.mesh.position.set(0, 0, cur.plane - FY);
    const key = U.map(v => v.toFixed(4)).join(',') + '|' + ratio.toFixed(4);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const L = i * N + j, r = i === j ? 0 : Math.max(0, Math.log(U[i] / U[j]));
      const rise = prog(ratio, 0.12 + 0.4 * (i + j) / (2 * N - 2), 0.5 + 0.4 * (i + j) / (2 * N - 2));
      const h = Math.min(HMAX, HS * r) * rise;
      cur.top[L] = FY + h;
      const e = i === j ? 0 : M.e[i][j], F = i === j ? 0 : prog(one, st0(i, j), st0(i, j) + 0.5);
      iCol.array[4 * L + 3] = e; iF.array[L] = F;
      uH[L] = FY + h; uF[L] = F;
      if (key !== lastKey) { M4.compose(P3.set(cellX(j), FY, cellZ(i)), Q0, S3.set(CW, Math.max(1e-4, h), CW)); cols.setMatrixAt(L, M4); }
    }
    if (key !== lastKey) { cols.instanceMatrix.needsUpdate = true; lastKey = key; }
    iCol.needsUpdate = true; iF.needsUpdate = true;
    colMat.uniforms.uK.value = fa; colMat.uniforms.uPlane.value = cur.plane + 1e-4; colMat.uniforms.uThr.value = prog(thr, 0.2, 0.8);
    cols.visible = fa > 0.003;
    fIco.attributes.aA.array.fill(fa); fIco.attributes.aA.needsUpdate = true;

    // the ring: it shrinks into this person's dot as the people rise
    const rT = prog(map, 0, 0.6), sc = lerp(1, 0.06, rT), ringVis = 1 - prog(map, 0.45, 0.7);
    const pm = [clamp(MX(M.C), MAPR.x0 - 0.08, MAPR.x1 + 0.08), clamp(MY(M.H), MAPR.y0 - 0.08, MAPR.y1 + 0.08), 0.06];
    const tg = l3(RC, pm, rT);
    gRing.position.set(tg[0] - RC[0] * sc, tg[1] - RC[1] * sc, tg[2] - RC[2] * sc); gRing.scale.setScalar(sc); gRing.updateMatrix();
    cur.ring = ringVis; cur.ringT = rT;
    const kd = prog(met, 0, 0.45), hk = prog(met, 0.25, 0.7);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const L = i * N + j;
      if (i === j) { uE[L] = 0; uT[L] = 0; uB[L] = 0; continue; }
      const e = M.e[i][j], arrive = prog(one, st0(i, j) + 0.3, st0(i, j) + 0.55);
      uE[L] = e * ringVis * prog(ratio, 0.3, 0.6);
      uT[L] = e * arrive * ringVis;
      uB[L] = i === KID ? 1 + 0.9 * kd : 1 - 0.5 * kd;
    }
    // node sizes by strength (Heterogeneity), hubs (strength z-score above 1.7) glow orange-yellow, the kidneys' halo
    const na = prog(one, 0.05, 0.4) * ringVis, sm = M.s.reduce((a, v) => a + v, 0) / N;
    const sd = Math.sqrt(M.s.reduce((a, v) => a + (v - sm) * (v - sm), 0) / N) || 1;
    let hub = -1;
    for (let i = 0; i < N; i++) {
      const rel = sm > 0 ? M.s[i] / sm : 1, z = (M.s[i] - sm) / sd, isHub = z > 1.7 ? 1 : 0;
      if (isHub && (hub < 0 || M.s[i] > M.s[hub])) hub = i;
      const size = 0.13 * clamp(1 + hk * (rel - 1) * 0.55, 0.55, 1.9);
      nIco.attributes.aA.array[i] = na; nIco.attributes.aSize.array[i] = size; nIco.attributes.aHub.array[i] = isHub * hk * (0.75 + 0.25 * Math.sin(t * 2.2));
      haloGeo.attributes.aA.array[i] = na * (0.35 + 0.4 * hk);
      haloGeo.attributes.aSize.array[i] = size * (1.7 + 0.5 * hk * rel);
      haloGeo.attributes.aCol.array.set(isHub && hk > 0 ? l3(OCOL[i], HUBC, hk) : OCOL[i], 3 * i);
    }
    cur.hub = hub;
    haloGeo.attributes.aA.array[N] = KID >= 0 ? na * kd * (0.55 + 0.25 * Math.sin(t * 3)) : 0;
    haloGeo.attributes.aSize.array[N] = 0.42;
    for (const n of ['aA', 'aSize', 'aCol']) haloGeo.attributes[n].needsUpdate = true;
    for (const n of ['aA', 'aSize', 'aHub']) nIco.attributes[n].needsUpdate = true;
    rLines.g[0] = na;

    // the gauges and the dial
    const off = 1 - map;
    const gk = [prog(met, 0, 0.45), prog(met, 0.25, 0.7), prog(met, 0.5, 0.95)];
    gC.uniforms.uK.value = gk[0] * off; gC.uniforms.uVal.value = M.C; gC.uniforms.uFillK.value = gk[0];
    gH.uniforms.uK.value = gk[1] * off; gH.uniforms.uVal.value = M.H / HMAXG; gH.uniforms.uFillK.value = gk[1];
    gX.uniforms.uK.value = gk[2] * off; gX.uniforms.uVal.value = M.mdi / 10; gX.uniforms.uFillK.value = gk[2];
    readout(0, M.C.toFixed(2)); readout(1, M.H.toFixed(2)); readout(2, M.mdi.toFixed(1));
    RO.k = met * off;

    // the people
    const sel = clamp(S.people_group || 0, 0, 4), any = sat(sel), gf = dotMat.uniforms.uGF.value;
    for (let g = 0; g < 4; g++) { const hi = sat(1 - Math.abs(sel - (g + 1))); gf[g] = lerp(1, 0.16 + 1.04 * hi, any); }
    for (let g = 4; g < 8; g++) gf[g] = 1;
    const dim = 1 - 0.6 * Math.max(km, resp);
    dotMat.uniforms.uMap.value = map; dotMat.uniforms.uMdi.value = mdi; dotMat.uniforms.uFol.value = fol; dotMat.uniforms.uDim.value = dim;
    trailMat.uniforms.uFol.value = fol; trailMat.uniforms.uK.value = mdi * dim;
    // this person's dot: from the ring to the map, then onto its profile's row of the strip
    const pRow = Math.round(cur.prof), gi = GKEY.indexOf(PROF[pRow]);
    const sp = [SX(M.mdi), ROWY[gi >= 0 ? gi : 3], 0.12];
    const pa = l3(l3(RC, pm, prog(map, 0.05, 0.6)), sp, prog(mdi, 0.2, 0.9));
    cp(cur.person, pa);
    const pal = prog(map, 0.15, 0.5) * (1 - 0.5 * fol) * dim * (1 - 0.6 * one);
    perGeo.attributes.position.array.set(pa, 0); perGeo.attributes.position.array.set(pa, 3);
    perGeo.attributes.aCol.array.set([1, 1, 1], 0); perGeo.attributes.aCol.array.set(GCOL[gi >= 0 ? gi : 3], 3);
    perGeo.attributes.aSize.array[0] = 0.07; perGeo.attributes.aSize.array[1] = 0.05;
    perGeo.attributes.aA.array[0] = pal; perGeo.attributes.aA.array[1] = pal;
    for (const n of ['position', 'aCol', 'aA', 'aSize']) perGeo.attributes[n].needsUpdate = true;
    // frames, summaries, shading
    const stripA = map * prog(mdi, 0.3, 0.9) * dim;
    bgPill.a(P_MAP, prog(map, 0, 0.4) * (1 - prog(mdi, 0.2, 0.8)));
    bgPill.a(P_STRIP, prog(mdi, 0.2, 0.8) * map);
    bgPill.a(P_SH0, stripA); bgPill.a(P_SH1, stripA); bgPill.a(P_HB, prog(fol, 0, 0.35) * stripA);
    bgPill.flush();
    for (let k = 0; k < 4; k++) {
      const hi = sat(1 - Math.abs(sel - (k + 1))), f = lerp(1, 0.25 + 0.75 * hi, any) * (1 - 0.55 * fol);
      for (let q = 0; q < 3; q++) pPill.a(3 * k + q, prog(mdi, 0.55 + 0.05 * q, 0.95) * map * dim * f);
      pPill.a(12 + k, prog(map, 0.6, 1) * (1 - prog(mdi, 0, 0.3)) * lerp(1, 0.3 + 0.7 * hi, any));
    }
    pPill.flush();
    pLines.g[0] = prog(map, 0.2, 0.6) * (1 - prog(mdi, 0, 0.4)); pLines.g[1] = stripA; pLines.g[2] = stripA; pLines.g[3] = prog(fol, 0, 0.3) * stripA;
    sTex.k = stripA;

    // survival: the curves draw left to right, the bands with them
    const gaK = ribMat.uniforms.uGA.value, grK = ribMat.uniforms.uGR.value;
    for (let k = 0; k < 3; k++) { const rv = prog(km, 0.08 + 0.1 * k, 0.75 + 0.1 * k) * 1.02; gaK[k] = prog(km, 0, 0.2); gaK[3 + k] = prog(km, 0, 0.2); grK[k] = rv; grK[3 + k] = rv; }
    kPill.a(0, prog(km, 0, 0.25)); for (let k = 0; k < 3; k++) kPill.a(1 + k, prog(km, 0.55 + 0.1 * k, 0.85 + 0.1 * k)); kPill.flush();
    kLines.g[0] = prog(km, 0, 0.3); kTex.k = prog(km, 0.1, 0.4);
    gKM.visible = km > 0.003;

    // the immunotherapy test: the two bands, then the AUC bars from the top down
    aPill.a(0, prog(resp, 0, 0.25));
    for (let k = 13; k < 18; k++) aPill.a(k, prog(resp, 0.05, 0.3));
    AUC.forEach((a, r) => {
      const g = prog(resp, 0.3 + 0.08 * r, 0.55 + 0.08 * r), len = Math.max(0.002, (ax(a.auc) - AX0) * g);
      aPill.a(1 + r, prog(resp, 0.2, 0.4)); aPill.x(7 + r, AX0 + len / 2, len / 2); aPill.a(7 + r, prog(resp, 0.3 + 0.08 * r, 0.36 + 0.08 * r));
    });
    aPill.flush();
    aLines.g[0] = prog(resp, 0, 0.3); aLines.g[1] = prog(resp, 0.25, 0.5); aTex.k = prog(resp, 0.05, 0.35);
    gAUC.visible = resp > 0.003;
  }

  // ---------------------------------------------------------------- views, controls, explore API
  const cam = {
    default: [-4, 15, 4.0, -0.14, 0.08, 0.1],
    one: [-4, 15, 4.0, -0.14, 0.08, 0.1],
    field: [-24, 34, 2.55, 0.0, -0.45, 0.3],
    metrics: [-24, 8, 2.9, 0.72, 0.3, 0.1],
    map: [0, 5, 3.4, 0.05, 0.28, 0],
    strip: [0, 4, 3.5, 0.12, 0.22, 0],
    km: [30, 4, 2.75, -2.38 + 0.02, 0.24, 0.5],
    auc: [-30, 4, 2.8, 2.38, 0.2, 0.5],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['one', 'One scan'], ['field', 'Ratios'], ['map', 'People'], ['strip', 'Index'], ['km', 'Survival'], ['auc', 'Immunotherapy']] },
    { key: 'profile', label: 'Profile', options: PROF.map(p => [p, PROFN[p]]) },
  ];
  function explore(c) {
    const v = c.view || 'one', pop = !(v === 'one' || v === 'field'), o = {
      people_bars: pop ? 0 : 1, people_ratio: pop ? 0 : 1, people_thresh: pop ? 0 : 1, people_one: v === 'one' ? 1 : 0, people_metrics: v === 'one' ? 1 : 0,
      people_map: pop ? 1 : 0, people_mdi: pop && v !== 'map' ? 1 : 0, people_km: v === 'km' ? 1 : 0, people_response: v === 'auc' ? 1 : 0, people_follow: 0,
    };
    const pi = PROF.indexOf(c.profile);
    if (pi >= 0) o.people_profile = pi;
    return o;
  }
  // what a ray points at: an organ (a node, a bar, a header) or a group (its row on the strip, or its cloud on the map)
  const _inv = new THREE.Matrix4(), _ray = new THREE.Ray(), _pl = new THREE.Plane(), _hit = new THREE.Vector3(), _w = new THREE.Vector3();
  function pick(raycaster) {
    set.group.updateMatrixWorld();
    _ray.copy(raycaster.ray).applyMatrix4(_inv.copy(set.group.matrixWorld).invert());
    const o = _ray.origin, d = _ray.direction;
    let best = null, bt = Infinity;
    const tryPt = (p, rad, res) => {
      const x = p[0] - o.x, y = p[1] - o.y, z = p[2] - o.z, along = x * d.x + y * d.y + z * d.z;
      if (along <= 0) return;
      const off = Math.sqrt(Math.max(0, x * x + y * y + z * z - along * along));
      if (off < rad && along < bt) { bt = along; best = res; }
    };
    if (cur.one > 0.5 && cur.ring > 0.5) ONE.forEach((id, i) => tryPt(tr(gRing, NODE[i]), 0.075, { organ: id }));
    if (cur.bars > 0.5) ONE.forEach((id, i) => { for (let s = 0; s <= 4; s++) tryPt(tr(gBars, [s * 0.2, BY(i), 0]), 0.05, { organ: id }); });
    if (cur.ratio > 0.5) ONE.forEach((id, i) => { tryPt([cellX(0) - 0.13, FY + 0.05, cellZ(i)], 0.055, { organ: id }); tryPt([cellX(i), FY + 0.05, cellZ(N - 1) + 0.13], 0.055, { organ: id }); });
    if (cur.map > 0.5 && !best) {
      _pl.set(_w.set(0, 0, 1), 0);
      if (_ray.intersectPlane(_pl, _hit)) {
        if (cur.mdi > 0.5) {
          if (_hit.x > SX0 - 0.05 && _hit.x < SX0 + SW + 0.05) GKEY.forEach((k, q) => { if (Math.abs(_hit.y - ROWY[q]) < 0.09) best = { group: q + 1 }; });
        } else {
          let bd = 0.3;
          STATS.forEach((s, q) => { if (!s.n) return; const dd = Math.hypot(_hit.x - s.x, _hit.y - s.y); if (dd < bd) { bd = dd; best = { group: q + 1 }; } });
        }
      }
    }
    return best;
  }
  const API = {
    measure, organs: ONE.slice(), pick, profiles: PROF.slice(), groups: GKEY.slice(),
    current: () => ({ u: U.slice(), theta: cur.theta, C: cur.m.C, H: cur.m.H, mdi: cur.m.mdi, links: cur.m.e.reduce((a, r) => a + r.filter(v => v > 0.5).length, 0), hub: cur.hub >= 0 ? ONE[cur.hub] : null }),
    dots: NDOT, followUp: NFD,
  };
  const params = { people_a: 1, people_bars: 1, people_ratio: 1, people_thresh: 1, people_one: 1, people_metrics: 1, people_profile: 0, people_custom: 0, people_theta: THETA,
    people_map: 0, people_mdi: 0, people_group: 0, people_km: 0, people_response: 0, people_follow: 0 };
  ONE.forEach((id, i) => { params['people_u' + i] = PU[0][i]; });
  return Object.assign(set, { params, update, anchors, labels, cam, controls, explore, api: () => API });
};
