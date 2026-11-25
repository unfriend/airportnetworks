// The airports story's globe (its land and lakes, LAND_B64 and LAKES_B64, and its two shaders, cut at build time from
// packages/airports/main.js by src/c-cut.mjs: EXPO_GLOBE, unchanged; the land texture made as that story makes it; not
// its routes), turned to Europe. On it the 32 countries with data (EEA E-PRTR, 2007-2020); above each, its substances
// far above the European level rising as two columns of dots, to air (light) and to water (deep blue); one country and
// one substance picked, threads down from it to the diseases close to it in the map (laid round the country's foot);
// each country's close and distant diseases compared (a dot for air and one for water: lit where the close ones are
// more frequent, p < 0.05; Source Data Fig4E, F); and the authors' risk score as a column (27 countries; a share of
// the total). A country is never "dirty": its releases, weighted. Radius 1, y up; lon 0 towards +x, 90 E towards -z
// (the airports story's), the whole turned in an inner group so that Europe faces +z.
// Draws: the globe, its glow, the markers, the substances, the comparison, the columns, the diseases and their threads.
// Params (src/SPEC.md, "The sets"; keyed in engine/e3c_world.js):
//   globe_turn 1      turned from the Atlantic to Europe (0..1)       globe_marks 1    the countries' markers (0..1)
//   globe_subs 0      each country's elevated substances rise (0..1)  globe_country -1 a country (step, XDATA.countries)
//   globe_sub -1      a substance (step) lit wherever it stands out     globe_threads 0  its threads to its close diseases (0..1)
//   globe_cols 0      the risk scores as columns (0..1)               globe_close 0    close against distant diseases (0..1)
const GLOBE_PRE = { stage: 0 };
// the land texture, as the airports story draws it (Natural Earth's land, then its lakes, into an equirectangular mask;
// sent as one channel), a slice a step of the load: 2048 wide in a headset's browser or on a small screen, else 4096
function globePrep() {
  const P = GLOBE_PRE;
  if (P.stage === 'done') return true;
  try {
    if (P.stage === 0) {
      P.O = EXPO_GLOBE();
      P.W = /OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent) || Math.min(screen.width, screen.height) <= 700 ? 2048 : 4096;
      P.cv = document.createElement('canvas'); P.cv.width = P.W; P.cv.height = P.W / 2;
      P.ctx = P.cv.getContext('2d', { willReadFrequently: true });
      P.ctx.fillStyle = '#000'; P.ctx.fillRect(0, 0, P.W, P.W / 2);
      P.stage = 1; return false;
    }
    const draw = (rings, color) => {
      const ctx = P.ctx, W = P.W;
      ctx.fillStyle = color; ctx.beginPath();
      for (const r of rings) {
        for (let k = 0; k < r.length; k += 2) { const x = (r[k] + 180) / 360 * W, y = (90 - r[k + 1]) / 180 * (W / 2); if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.closePath();
      }
      ctx.fill('evenodd');
    };
    if (P.stage === 1) { draw(P.O.decodeRings(P.O.LAND_B64), '#fff'); P.stage = 2; return false; }
    if (P.stage === 2) { draw(P.O.decodeRings(P.O.LAKES_B64), '#000'); P.mask = new Uint8Array(P.W * P.W / 2); P.row = 0; P.stage = 3; return false; }
    if (P.stage === 3) {
      // (the picture's red channel, rows from the bottom as a texture has them, a band at a time)
      const W = P.W, H = W / 2, band = 256, y0 = P.row, y1 = Math.min(H, y0 + band), px = P.ctx.getImageData(0, y0, W, y1 - y0).data;
      for (let y = y0; y < y1; y++) { const o = (H - 1 - y) * W, i = (y - y0) * W * 4; for (let x = 0; x < W; x++) P.mask[o + x] = px[i + x * 4]; }
      P.row = y1;
      if (y1 < H) return false;
      P.cv.width = P.cv.height = 0; P.cv = P.ctx = null;
      P.stage = 'done'; return true;
    }
  } catch (e) { console.warn('exposome globe: no land', e); P.O = P.O || EXPO_GLOBE(); P.mask = null; P.stage = 'done'; return true; }
  return true;
}
SETS.globe = function (K) {
  const { THREE, clamp, smooth, v3 } = K;
  const set = K.newSet('globe');
  const P = GLOBE_PRE, O = P.O || EXPO_GLOBE();
  const R = new THREE.Group();   // (turned to Europe)
  set.group.add(R);
  // the globe and its glow: the original's shaders, each faded with the set (its alpha times the set's fade, appended)
  const fadeMat = m => {
    m.uniforms.uSetA = set.uA;
    m.fragmentShader = 'uniform float uSetA;\n' + m.fragmentShader.replace(/\}\s*$/, '  gl_FragColor.a *= uSetA;\n}\n');
    m.transparent = true;
    set.mats.push(m);
    return m;
  };
  const W = P.W || 2048, mask = P.mask || new Uint8Array(W * W / 2);
  const tex = new THREE.DataTexture(mask, W, W / 2, THREE.LuminanceFormat, THREE.UnsignedByteType);
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4; tex.wrapS = THREE.RepeatWrapping; tex.needsUpdate = true;
  const globeMat = fadeMat(O.globeMaterial(tex));
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 100), globeMat);
  sphere.renderOrder = 1;
  R.add(sphere);
  // (the glow's mesh as the original builds it: a sphere, and a ring turned to the viewer)
  const atmMat = fadeMat(O.atmosphereMaterial());
  {
    const atmG = new THREE.SphereGeometry(1.055, 96, 64), nv0 = atmG.attributes.position.count, RS = 128;
    const ap = new Float32Array((nv0 + 2 * RS) * 3), ar = new Float32Array((nv0 + 2 * RS) * 4), ai = Array.from(atmG.index.array);
    ap.set(atmG.attributes.position.array);
    for (let i = 0; i < RS; i++) {
      const a = i / RS * Math.PI * 2, v = nv0 + 2 * i, w = nv0 + 2 * ((i + 1) % RS);
      ar.set([Math.cos(a), Math.sin(a), 0.94, 1], 4 * v); ar.set([Math.cos(a), Math.sin(a), 1.06, 1], 4 * (v + 1));
      ai.push(v, w, v + 1, w, w + 1, v + 1);
    }
    atmG.setAttribute('position', new THREE.BufferAttribute(ap, 3)); atmG.setAttribute('aRing', new THREE.BufferAttribute(ar, 4)); atmG.setIndex(ai);
    const atm = new THREE.Mesh(atmG, atmMat); atm.renderOrder = 30; atm.frustumCulled = false;
    R.add(atm);
  }
  // the light from over the viewer's left shoulder (in a headset it stays in the room), and the glow's centre and size,
  // set just before the globe is drawn, for each eye (as the pass story drives the same original)
  const LVg = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  const probe = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  probe.frustumCulled = false; probe.renderOrder = -100;
  probe.onBeforeRender = (renderer, scene, cam) => {
    const mw = R.matrixWorld, xr = !!(renderer.xr && renderer.xr.isPresenting), rig = set.group.parent && set.group.parent.parent;
    atmMat.uniforms.uCenter.value.setFromMatrixPosition(mw);
    atmMat.uniforms.uRadius.value = _s.setFromMatrixScale(mw).x;
    if (xr && rig) rig.getWorldQuaternion(_q); else cam.getWorldQuaternion(_q);
    LVg.set(-0.55, 0.42, 1.0).normalize().applyQuaternion(_q);
    globeMat.uniforms.uL.value.copy(LVg);
  };
  set.group.add(probe);

  // ------------------------------------------------------------ places on the globe
  const C = XDATA.countries, nc = C.length;
  const ll = (lat, lon, r) => { const a = lat * D2R, b = lon * D2R; return [r * Math.cos(a) * Math.cos(b), r * Math.sin(a), -r * Math.cos(a) * Math.sin(b)]; };
  // Europe (about 50 N, 12 E) to +z: turned about up, then tilted about x (Euler XYZ: y first)
  const EU = [50, 12], TH = -(90 + EU[1]) * D2R, PH = EU[0] * D2R, TH0 = TH + 75 * D2R, PH0 = 12 * D2R;
  const turnTo = x => R.rotation.set(PH0 + (PH - PH0) * x, TH0 + (TH - TH0) * x, 0, 'XYZ');
  turnTo(1); R.updateMatrix();
  const M1 = R.matrix.clone();
  const inSet = p => new THREE.Vector3(...p).applyMatrix4(M1).toArray();   // a point on the globe, turned to Europe, in the set's frame
  const nrm = C.map(c => v3.norm(ll(c.lat, c.lon, 1)));
  const east = nrm.map(u => v3.norm(v3.cross([0, 1, 0], u)));
  const significant = v => !!(v && v[2] < 0.05 && v[0] > v[1]);

  // the markers
  const mg = K.pointsGeo(nc), MC = K.rgb('#ffd9a0'), MC0 = K.rgb('#8a93a3');
  C.forEach((c, i) => {
    mg.attributes.position.array.set(v3.mul(nrm[i], 1.004), 3 * i);
    const has = c.air.length + c.water.length > 0;
    mg.attributes.aCol.array.set(has ? MC : MC0, 3 * i); mg.attributes.aSize.array[i] = has ? 0.022 : 0.015;
  });
  const MU = { uK: { value: 1 }, uSel: { value: -1 } };
  mg.setAttribute('aIdx', new THREE.BufferAttribute(Float32Array.from(C.map((_, i) => i)), 1));
  const marks = new THREE.Points(mg, K.points(set, { uniforms: MU, head: 'attribute float aIdx; uniform float uK, uSel;', vertex: `
  float me = 1.0 - step(0.5, abs(aIdx - uSel));
  vA *= uK * (uSel >= 0.0 ? 0.55 + 0.45 * me : 1.0) * (1.0 + me);
  gl_PointSize = pointPx(aSize * (1.0 + 1.2 * me), mv);` }));
  marks.renderOrder = 20;
  R.add(marks);

  // each country's substances far above Europe's level, rising: air on its west side, water on its east
  const AIR = K.rgb('#aee9ff'), WAT = K.rgb('#3f86ff'), STEP_H = 0.0048;
  const entries = [];
  C.forEach((c, i) => {
    c.air.forEach((s, k) => entries.push({ c: i, s, k, w: 0 }));
    c.water.forEach((s, k) => entries.push({ c: i, s, k, w: 1 }));
  });
  const ne = entries.length, eg = K.pointsGeo(Math.max(1, ne)), EP = eg.attributes.position.array;
  const ePos = e => { const u = nrm[e.c], h = 0.012 + e.k * STEP_H; return v3.add(v3.mul(u, 1.003 + h), v3.mul(east[e.c], e.w ? 0.0062 : -0.0062)); };
  entries.forEach((e, j) => { eg.attributes.aCol.array.set(e.w ? WAT : AIR, 3 * j); eg.attributes.aSize.array[j] = 0.008; });
  const subDots = new THREE.Points(eg, K.points(set)); subDots.renderOrder = 21; subDots.frustumCulled = false;
  R.add(subDots);
  // (where a substance's dot is in a country's column, in the globe's own frame)
  const entryAt = (ci, s) => { const e = entries.find(x => x.c === ci && x.s === s); return e ? ePos(e) : null; };

  // close against distant diseases: a dot for air (west) and one for water (east) beside each marker
  const cg = K.pointsGeo(2 * nc), LIT = K.rgb('#ffb43b'), DIM = K.rgb('#6b7484');
  C.forEach((c, i) => [c.pa, c.pw].forEach((v, w) => {
    const j = 2 * i + w;
    cg.attributes.position.array.set(v3.add(v3.mul(nrm[i], 1.005), v3.mul(east[i], w ? 0.016 : -0.016)), 3 * j);
    cg.attributes.aCol.array.set(significant(v) ? LIT : DIM, 3 * j);
    cg.attributes.aSize.array[j] = significant(v) ? 0.026 : 0.014;
    cg.attributes.aA.array[j] = v ? 1 : 0;
  }));
  const CU = { uK: { value: 0 } };
  const closeDots = new THREE.Points(cg, K.points(set, { uniforms: CU, head: 'uniform float uK;', vertex: 'vA *= uK;' }));
  closeDots.renderOrder = 22; R.add(closeDots);

  // the risk scores as columns (a share of the total over the 27 countries with one)
  const withRisk = C.map((c, i) => (c.risk ? i : -1)).filter(i => i >= 0);
  const colG = new THREE.CylinderGeometry(1, 1, 1, 14, 1, false); colG.translate(0, 0.5, 0);
  const colMat = K.fade(set, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }), 0.92);
  const cols = new THREE.InstancedMesh(colG, colMat, Math.max(1, withRisk.length));
  const maxShare = Math.max(...withRisk.map(i => C[i].risk[3]), 1e-6), HZC = LOOK.hazard.map(([t, c]) => [t, K.rgb(c)]);
  withRisk.forEach((i, k) => cols.setColorAt(k, new THREE.Color(...K.ramp(HZC, 0.25 + 0.75 * Math.sqrt(C[i].risk[3] / maxShare)))));
  if (cols.instanceColor) cols.instanceColor.needsUpdate = true;
  cols.frustumCulled = false; cols.renderOrder = 23;
  R.add(cols);
  const colH = i => 0.015 + 1.35 * C[i].risk[3];
  const _m = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _n = new THREE.Vector3(), _p = new THREE.Vector3(), _sc = new THREE.Vector3();
  function placeCols(x) {
    withRisk.forEach((i, k) => {
      const g = smooth(clamp(x * 1.6 - (k / withRisk.length) * 0.6, 0, 1));
      _n.fromArray(nrm[i]); _qq.setFromUnitVectors(_up, _n); _p.copy(_n).multiplyScalar(1.001);
      _sc.set(0.009, Math.max(1e-4, colH(i) * g), 0.009);
      cols.setMatrixAt(k, _m.compose(_p, _qq, _sc));
    });
    cols.instanceMatrix.needsUpdate = true;
  }
  placeCols(0);

  // one substance's close diseases laid round the country's foot, and threads down to them from its dot
  const DMAX = 10, dg = K.pointsGeo(DMAX), tgeo = K.linesGeo(DMAX * 8);
  const DU = { uK: { value: 0 } };
  const disDots = new THREE.Points(dg, K.points(set, { uniforms: DU, head: 'uniform float uK;', vertex: 'vA *= uK;' })); disDots.renderOrder = 24; disDots.frustumCulled = false; R.add(disDots);
  const thrL = new THREE.LineSegments(tgeo, K.lines(set)); thrL.renderOrder = 24; thrL.frustumCulled = false; R.add(thrL);
  let shownCS = '', disList = [], disAt = [], crcK = -1;
  // (the substance's close diseases: diseases.bin's when it is in, else the story's own list for endrin)
  const closeList = s => {
    const L = XDATA.ready('diseases') ? XDATA.dis.closeOf(s) : null;
    if (L) return L.slice(0, DMAX).map(e => [XDATA.dis.name(e.d), e.z]);
    return s === XDATA.ex.endrin ? XDATA.ex.endrinClose.slice(0, DMAX).map(e => [e[0], e[1]]) : [];
  };
  function showThreads(ci, s) {
    shownCS = ci + ':' + s;
    disList = []; disAt = []; crcK = -1;
    const top = ci >= 0 && s >= 0 ? entryAt(ci, s) : null;
    if (!top) { dg.setDrawRange(0, 0); tgeo.setDrawRange(0, 0); return; }
    disList = closeList(s);
    const u = nrm[ci], e = east[ci], nth = v3.norm(v3.cross(u, e)), m = disList.length, col = K.rgb(LOOK.disease), tc = K.rgb(LOOK.thread);
    let v = 0;
    disList.forEach(([name, z], k) => {
      const a = (k + 0.5) / m * Math.PI * 2 + 0.6, rr = 0.032 + 0.006 * (k % 2);
      const p = v3.add(v3.mul(u, 1.004), v3.add(v3.mul(e, Math.cos(a) * rr), v3.mul(nth, Math.sin(a) * rr)));
      disAt.push(p);
      if (/colorectal|colon/i.test(name) && crcK < 0) crcK = k;
      dg.attributes.position.array.set(p, 3 * k); dg.attributes.aCol.array.set(col, 3 * k); dg.attributes.aSize.array[k] = 0.012;
      // a thread from the substance's dot, bowed out, down to the disease: 8 segments, grown by globe_threads
      const mid = v3.add(v3.lerp(top, p, 0.5), v3.mul(v3.norm(v3.sub(p, v3.mul(u, v3.dot(p, u)))), 0.012));
      let q0 = top;
      for (let j = 1; j <= 8; j++) {
        const x = j / 8, y = 1 - x, q1 = [0, 1, 2].map(c => y * y * top[c] + 2 * y * x * mid[c] + x * x * p[c]);
        tgeo.attributes.position.array.set(q0, 6 * v); tgeo.attributes.position.array.set(q1, 6 * v + 3);
        tgeo.attributes.aCol.array.set(tc, 6 * v); tgeo.attributes.aCol.array.set(j === 8 ? col : tc, 6 * v + 3);
        tgeo.attributes.aT.array[2 * v] = 0.08 * k / m + 0.85 * (j - 1) / 8; tgeo.attributes.aT.array[2 * v + 1] = 0.08 * k / m + 0.85 * j / 8;
        tgeo.attributes.aA.array[2 * v] = tgeo.attributes.aA.array[2 * v + 1] = k === crcK ? 0.95 : 0.55;
        q0 = q1; v++;
      }
    });
    dg.setDrawRange(0, m); tgeo.setDrawRange(0, 2 * v);
    for (const G of [dg, tgeo]) for (const k in G.attributes) G.attributes[k].needsUpdate = true;
  }

  // ------------------------------------------------------------ labels, views
  let S0 = {};
  const sel = () => Math.round(S0.globe_country === undefined ? -1 : S0.globe_country);
  const inR = p => new THREE.Vector3(...p).applyMatrix4(R.matrix).toArray();   // (the globe's frame as turned now -> the set's)
  const italy = C.findIndex(c => c.name === 'Italy');
  const byShare = withRisk.slice().sort((a, b) => C[b].risk[3] - C[a].risk[3]).slice(0, 3);
  const colTop = k => () => { const i = byShare[k]; return inR(v3.mul(nrm[i], 1.004 + colH(i) * smooth(clamp(S0.globe_cols || 0, 0, 1)))); };
  const view = (ci, d, el) => { const p = inSet(v3.mul(nrm[ci], 1.0)); return [Math.atan2(p[0], p[2]) / D2R, (el || 0) + Math.asin(clamp(p[1], -1, 1)) / D2R, d, p[0] * 0.98, p[1] * 0.98, p[2] * 0.98]; };
  const pct = x => (x >= 0.01 ? `${Math.round(100 * x)} %` : 'under 1 %');
  return Object.assign(set, {
    params: { globe_a: 1, globe_turn: 1, globe_marks: 1, globe_subs: 0, globe_country: -1, globe_sub: -1, globe_threads: 0, globe_cols: 0, globe_close: 0 },
    keepClear: true,   // the globe is drawn where its geometry is: a headset keeps it clear of your head
    update(S) {
      S0 = S;
      turnTo(smooth(clamp(S.globe_turn, 0, 1)));
      MU.uK.value = clamp(S.globe_marks, 0, 1); MU.uSel.value = sel();
      // the columns of substances: each country's rising in turn, the picked country's bright, the others dim
      const x = clamp(S.globe_subs, 0, 1), ci = sel(), s = Math.round(S.globe_sub);
      subDots.visible = x > 0.003;
      if (subDots.visible) {
        entries.forEach((e, j) => {
          const g = smooth(clamp(x * 1.5 - (e.c / nc) * 0.5, 0, 1)), u = nrm[e.c], h = (0.012 + e.k * STEP_H) * g;
          const p = v3.add(v3.mul(u, 1.003 + h), v3.mul(east[e.c], e.w ? 0.0062 : -0.0062));
          EP[3 * j] = p[0]; EP[3 * j + 1] = p[1]; EP[3 * j + 2] = p[2];
          const me = e.s === s && (ci < 0 || e.c === ci);
          eg.attributes.aA.array[j] = g * (ci < 0 || e.c === ci ? 1 : 0.22) * (s >= 0 && !me ? 0.6 : 1) + (me ? 0.6 : 0);
          eg.attributes.aSize.array[j] = me ? 0.026 : 0.008;
          if (me) eg.attributes.aCol.array.set([1, 0.97, 0.85], 3 * j); else eg.attributes.aCol.array.set(e.w ? WAT : AIR, 3 * j);
        });
        K.upload(eg.attributes.position, ne); K.upload(eg.attributes.aA, ne); K.upload(eg.attributes.aSize, ne); K.upload(eg.attributes.aCol, ne);
      }
      if (ci + ':' + s !== shownCS) showThreads(ci, s);
      const th = clamp(S.globe_threads, 0, 1);
      thrL.material.uniforms.uReveal.value = th; thrL.visible = disDots.visible = th > 0.003 && disList.length > 0;
      DU.uK.value = K.prog(th, 0.75, 1);
      CU.uK.value = clamp(S.globe_close, 0, 1); closeDots.visible = S.globe_close > 0.003;
      cols.visible = S.globe_cols > 0.003;
      if (cols.visible || cols.userData.x !== 0) { const c = clamp(S.globe_cols, 0, 1); if (c !== cols.userData.x) { placeCols(c); cols.userData.x = c; } }
    },
    anchors: {
      centre: [0, 0, 0],
      europe: () => inR(ll(EU[0], EU[1], 1.05)),
      italy: () => (italy >= 0 ? inR(v3.mul(nrm[italy], 1.02)) : [0, 0, 1]),
      country: () => (sel() >= 0 ? inR(v3.mul(nrm[sel()], 1.01)) : [0, 0, 1]),
      sub: () => { const p = sel() >= 0 && S0.globe_sub >= 0 ? entryAt(sel(), Math.round(S0.globe_sub)) : null; return p ? inR(p) : [0, 0, 1]; },
      crc: () => (crcK >= 0 ? inR(disAt[crcK]) : [0, 0, 1]),
      north: () => inR(ll(67, -8, 1.02)),
      top0: colTop(0), top1: colTop(1), top2: colTop(2),
    },
    labels: [
      { text: () => (sel() >= 0 ? [C[sel()].name, ` · ${fmt(C[sel()].risk ? C[sel()].risk[0] : C[sel()].air.length + C[sel()].water.length)} substances stand out`] : ['', '']), at: 'country', cls: 'amb',
        alpha: S => (S.globe_country >= 0 ? clamp(S.globe_marks, 0, 1) * (1 - clamp(S.globe_cols, 0, 1)) : 0) * (S.globe_sub >= 0 ? 0 : 1) },
      { text: () => { const s = Math.round(S0.globe_sub), e = sel() >= 0 && s >= 0 ? entries.find(x => x.c === sel() && x.s === s) : null; return [s >= 0 ? XDATA.label[s] : '', e ? (e.w ? ' · to water' : ' · to air') : '']; },
        at: 'sub', cls: 'cyn', alpha: S => (S.globe_sub >= 0 && S.globe_country >= 0 ? clamp(S.globe_subs * 2, 0, 1) : 0) },
      { text: () => [crcK >= 0 ? cap(String(disList[crcK][0]).toLowerCase()) : '', crcK >= 0 ? ` · close (z ${f2(disList[crcK][1])})` : ''], at: 'crc', cls: 'mag',
        alpha: S => (crcK >= 0 ? K.prog(S.globe_threads, 0.85, 1) : 0) },
      { text: () => ['Close diseases more frequent', ` · air ${XDATA.meta.countries.airSig} of ${XDATA.meta.countries.airOf}, water ${XDATA.meta.countries.waterSig} of ${XDATA.meta.countries.waterOf}`],
        at: 'north', cls: 'amb', alpha: S => K.prog(S.globe_close, 0.6, 1) },
      ...[0, 1, 2].map(k => ({ text: () => (byShare[k] >= 0 ? [C[byShare[k]].name, ` · ${pct(C[byShare[k]].risk[3])} of the total score`] : ['', '']), at: 'top' + k, alpha: S => K.prog(S.globe_cols, 0.7, 1) })),
    ],
    cam: {
      default: [0, 6, 2.9, 0, 0.03, 0],
      far: [0, 12, 8.5, 0, 0, 0],
      italy: italy >= 0 ? view(italy, 1.15, 14) : [0, 6, 2.9, 0, 0, 0],
      wide: [0, 8, 3.6, 0, 0.05, 0],
      cols: [0, 40, 2.2, 0, -0.04, 0.98],
    },
    controls: [
      { key: 'show', label: 'Show', options: [['subs', 'Releases'], ['close', 'Close against distant'], ['cols', 'Scores']] },
    ],
    explore(c) {
      stepC();
      const ci = XC.country, s = pickSubC(-1), here = ci >= 0 && s >= 0 && !!entryAt(ci, s);
      return { globe_turn: 1, globe_marks: 1, globe_subs: c.show === 'subs' ? 1 : 0, globe_close: c.show === 'close' ? 1 : 0, globe_cols: c.show === 'cols' ? 1 : 0,
        globe_country: ci, globe_sub: here ? s : -1, globe_threads: here && c.show === 'subs' ? 1 : 0 };
    },
    api: () => ({
      // the country nearest where a ray meets the globe (within about 3 degrees), or -1
      pick: rc => {
        R.updateWorldMatrix(true, false);
        const r = rc.ray.clone().applyMatrix4(new THREE.Matrix4().copy(R.matrixWorld).invert()), hitP = new THREE.Vector3();
        if (!r.intersectSphere(new THREE.Sphere(new THREE.Vector3(), 1.01), hitP)) return -1;
        hitP.normalize();
        let best = -1, bd = Math.cos(3.2 * D2R);
        nrm.forEach((u, i) => { const d = u[0] * hitP.x + u[1] * hitP.y + u[2] * hitP.z; if (d > bd) { bd = d; best = i; } });
        return best;
      },
      pos: i => inR(v3.mul(nrm[i], 1.01)),
      view: i => view(i, 1.6, 12),
    }),
  });
};
SETS.globe.prep = () => XDATA.need(['diseases'], pkgUrl) && globePrep();
