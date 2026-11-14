// ================================================================ PAINTINGS ==
// The owner, 14 November 2026 (tools/studio/SPEC.md, "Paintings: drawing in the air"): "Paint mode in studio mode,
// optionally with brushes and a spraycan etc?" A painting (kind d, the state's d.<id>, layout.json's paintings) is a set of
// strokes drawn in the air: a ribbon, a tube, a glow pen or a spray can, in a colour and a width, kept in the painting's own
// frame so it moves, turns, sizes, shows and hides, groups, locks and is deleted as one item. The strokes are in the record
// (at most 4,000 points in all a scene's paintings) or, past that, in a file of the scene, paintings/<name>-<n>.json, as
// v125's recordings are (a relay that takes uploads). Editing only. Drawn in at most four opaque meshes a painting.

const PNT = { brushes: ['ribbon', 'tube', 'glow', 'spray'], widths: [0.002, 0.005, 0.01, 0.02, 0.04, 0.08], rec: 4000, perPainting: 200000, fileBytes: 3500000, strokes: 2000, strokePts: 2000,
  maxDots: 6000, dotsPerM: 4000, simp: 0.0015, minMove: 0.003, minTurn: 10 * Math.PI / 180, tip: 0.06, files: 5 };
const PAINT = { on: false, brush: 'ribbon', colour: '#ff5a4b', width: 0.01, drawing: null, last: null, note: '', noteC: 'muted', arm: null, pg: null, sess: false, keep: new Map(), t0: 0, did: false, seed: 0 };
const okPaintFile = s => okFile(s) && /^paintings\/[^/]/.test(s) && /\.json$/.test(s) && s.split('/').length <= 5 && s.split('/').every(n => n && !n.startsWith('.') && !/(~|\.(tmp|temp|part|partial|crdownload|download|swp|swx))$/i.test(n));

// ---------------------------------------------------------------- the record --
// a stroke: { b, c, w, k, sd }: the brush, its colour (#rrggbb, lower case), its width in metres (0.002 to 0.2, to the mm), its
// points [x, y, z, f] (a ribbon's [x, y, z, f, nx, ny, nz]: its face's normal, 2 decimals), 2 to 2,000 of them, and a spray's
// seed (1 to 2^31). null: not one
function normStroke(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  if (!PNT.brushes.includes(x.b) || typeof x.c !== 'string' || !/^#[0-9a-f]{6}$/i.test(x.c) || !fin(x.w) || x.w <= 0) return null;
  if (!Array.isArray(x.k) || x.k.length < 2 || x.k.length > PNT.strokePts) return null;
  const rib = x.b === 'ribbon', n = rib ? 7 : 4, k = [];
  for (const q of x.k) {
    if (!Array.isArray(q) || q.length !== n || !q.every(fin) || Math.abs(q[0]) > 1000 || Math.abs(q[1]) > 1000 || Math.abs(q[2]) > 1000) return null;
    const pt = [nz(r3(q[0])), nz(r3(q[1])), nz(r3(q[2])), r2(clamp(q[3], 0.1, 1))];
    if (rib) {
      const L = Math.hypot(q[4], q[5], q[6]);
      if (L < 1e-6) return null;
      const k2 = Math.abs(L - 1) > 0.03 ? 1 / L : 1;
      pt.push(nz(r2(q[4] * k2)), nz(r2(q[5] * k2)), nz(r2(q[6] * k2)));
    }
    k.push(pt);
  }
  const r = { b: x.b, c: x.c.toLowerCase(), w: r3(clamp(x.w, 0.002, 0.2)), k };
  if (x.b === 'spray') {
    const sd = x.sd === undefined ? 1 : x.sd;
    if (!Number.isInteger(sd) || sd < 1 || sd > 2147483648) return null;
    r.sd = sd;
  }
  return r;
}
// { name, p, q, s, strokes | src (+ n, pts), locked, shows } (the spec's "The record"); a bad stroke makes it bad
function normPainting(x, P, has, name, one) {
  const q = has('q') ? quatOf(x.q) : [0, 0, 0, 1];
  if (!q || (has('s') && !(fin(x.s) && x.s > 0)) || (x.strokes != null && x.src != null)) return null;
  const r = { name: name('Painting'), p: P, q, s: has('s') ? +clamp(x.s, 0.05, 20).toPrecision(4) : 1 };
  if (x.src != null) {
    if (!okPaintFile(x.src) || !Number.isInteger(x.n) || x.n < 0 || x.n > PNT.strokes || !Number.isInteger(x.pts) || x.pts < 0 || x.pts > PNT.perPainting) return null;
    r.src = x.src; r.n = x.n; r.pts = x.pts;
  } else {
    const L = x.strokes == null ? [] : x.strokes;
    if (!Array.isArray(L) || L.length > PNT.strokes) return null;
    const S = L.map(normStroke);
    if (S.includes(null) || ptsOf(S) > PNT.rec) return null;
    r.strokes = S;
  }
  return lockOf(x, showsOf(x, r));
}
const ptsOf = S => S.reduce((a, s) => a + s.k.length, 0);
const paintN = r => (r.src ? r.n : r.strokes.length), paintP = r => (r.src ? r.pts : ptsOf(r.strokes));
// the points kept in records (not files) in all the scene's paintings but one (a record's strokes only)
const paintInRecord = but => [...STU.items.values()].reduce((a, it) => a + (it.kind === 'd' && it.id !== but && it.rec.strokes ? ptsOf(it.rec.strokes) : 0), 0);
function sameStrokes(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const s = a[i], t = b[i];
    if (s.b !== t.b || s.c !== t.c || s.w !== t.w || s.sd !== t.sd || s.k.length !== t.k.length) return false;
    for (let j = 0; j < s.k.length; j++) { const u = s.k[j], v = t.k[j]; for (let m = 0; m < u.length; m++) if (u[m] !== v[m]) return false; }
  }
  return true;
}

// ------------------------------------------------------------------- spray --
// the dots of a spray stroke: a fixed function of its points, width and seed (the same on every device): along each segment
// about 40 dots a centimetre at full pressure (fewer with it), within a disc of the stroke's width across the path, each
// segment's own seeded generator (so a stroke grown point by point has the same dots as a whole one), at most 6,000 a stroke
function mulberry(a) { a >>>= 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function sprayEstimate(st) {
  let e = 0;
  for (let i = 1; i < st.k.length; i++) { const a = st.k[i - 1], b = st.k[i]; e += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * PNT.dotsPerM * (a[3] + b[3]) / 2; }
  return e;
}
const _sd = new THREE.Vector3(), _su = new THREE.Vector3(), _sv2 = new THREE.Vector3();
// segment i - 1 to i of st: its dots pushed into out (x, y, z, ...), at most up to limit dots in all; rate scales their number
function sprayDots1(st, i, rate, out, limit) {
  const a = st.k[i - 1], b = st.k[i];
  _sd.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const L = _sd.length();
  if (L < 1e-9) return;
  _sd.divideScalar(L);
  _su.set(0, 1, 0); if (Math.abs(_sd.y) > 0.9) _su.set(1, 0, 0);
  _su.crossVectors(_sd, _su).normalize(); _sv2.crossVectors(_sd, _su);
  const rnd = mulberry((st.sd + Math.imul(i, 0x9E3779B1)) | 0), cnt = L * PNT.dotsPerM * (a[3] + b[3]) / 2 * rate, n = Math.floor(cnt) + (rnd() < cnt - Math.floor(cnt) ? 1 : 0);
  for (let d = 0; d < n && out.length / 3 < limit; d++) {
    const t = rnd(), r = st.w * Math.sqrt(rnd()), th = rnd() * Math.PI * 2, c = Math.cos(th) * r, s = Math.sin(th) * r;
    out.push(a[0] + (b[0] - a[0]) * t + _su.x * c + _sv2.x * s, a[1] + (b[1] - a[1]) * t + _su.y * c + _sv2.y * s, a[2] + (b[2] - a[2]) * t + _su.z * c + _sv2.z * s);
  }
}
function sprayDots(st) {
  const out = [], rate = Math.min(1, PNT.maxDots / Math.max(1, sprayEstimate(st)));
  for (let i = 1; i < st.k.length; i++) sprayDots1(st, i, rate, out, PNT.maxDots);
  return out;
}

// -------------------------------------------------------------- simplifying --
// a point kept where leaving it out would move the line more than 1.5 mm (Douglas and Peucker); the first and last stay; a
// ribbon's turn counts too (a point where its face has turned 10 degrees from the last kept one stays)
function simplify(pts, tol, rib) {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let far = -1, md = tol;
    const A = pts[a], B = pts[b], dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], L2 = dx * dx + dy * dy + dz * dz;
    for (let i = a + 1; i < b; i++) {
      const P = pts[i];
      let t = L2 > 0 ? ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy + (P[2] - A[2]) * dz) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(P[0] - A[0] - dx * t, P[1] - A[1] - dy * t, P[2] - A[2] - dz * t);
      if (d > md) { md = d; far = i; }
    }
    if (far >= 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  if (rib) {
    let last = 0;
    for (let i = 1; i < n; i++) {
      if (keep[i]) { last = i; continue; }
      const A = pts[last], B = pts[i], c = A[4] * B[4] + A[5] * B[5] + A[6] * B[6];
      if (Math.acos(Math.max(-1, Math.min(1, c))) >= PNT.minTurn) { keep[i] = 1; last = i; }
    }
  }
  return pts.filter((_, i) => keep[i]);
}

// --------------------------------------------------------------- the meshers --
// a growing set of vertices and triangles (fixed capacity: a preview's buffers are made once; a painting's are sized from its strokes)
function accNew(V, I, sized) {
  return { pos: new Float32Array(3 * V), nor: new Float32Array(3 * V), col: new Float32Array(3 * V), siz: sized ? new Float32Array(V) : null, idx: new Uint32Array(I), v: 0, i: 0, cap: V, icap: I, f0: 0, i0: 0 };
}
function accV(A, x, y, z, nx, ny, nz, r, g, b) {
  if (A.v >= A.cap) return A.v - 1;
  const o = 3 * A.v;
  A.pos[o] = x; A.pos[o + 1] = y; A.pos[o + 2] = z; A.nor[o] = nx; A.nor[o + 1] = ny; A.nor[o + 2] = nz; A.col[o] = r; A.col[o + 1] = g; A.col[o + 2] = b;
  return A.v++;
}
function accT(A, a, b, c) { if (A.i + 3 > A.icap) return; A.idx[A.i++] = a; A.idx[A.i++] = b; A.idx[A.i++] = c; }
const _WHITE = new THREE.Color(1, 1, 1), _mc = new THREE.Color();
// a stroke's colour as it is drawn: a glow pen's is lifted towards white (it is unlit)
function strokeRGB(st) { _mc.set(st.c); if (st.b === 'glow') _mc.lerp(_WHITE, 0.45); return [_mc.r, _mc.g, _mc.b]; }
const TUBE_SIDES = 8;
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _t3 = new THREE.Vector3();
function perpTo(t, out) { out.set(0, 1, 0); if (Math.abs(t.y) > 0.9) out.set(1, 0, 0); return out.crossVectors(t, out).normalize(); }
// a tube or a glow tube along a stroke, ring by ring (parallel transported), round caps; rings are made as the next point comes,
// so a stroke grown point by point shows all but its last point until it ends
function tubeMesher(A, st) {
  const [cr, cg, cb] = strokeRGB(st), glow = st.b === 'glow', P = [], u = new THREE.Vector3(), t = new THREE.Vector3();
  let ring0 = -1, prev = -1, have = false;
  const ring = (j, tx, ty, tz) => {
    t.set(tx, ty, tz); if (t.lengthSq() < 1e-18) t.set(0, 1, 0); t.normalize();
    if (!have) { perpTo(t, u); have = true; } else { u.addScaledVector(t, -u.dot(t)); if (u.lengthSq() < 1e-8) perpTo(t, u); u.normalize(); }
    const v = _t3.crossVectors(t, u), p = P[j], r = st.w * p[3] / 2, s0 = A.v;
    for (let s = 0; s < TUBE_SIDES; s++) {
      const th = s / TUBE_SIDES * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th), dx = c * u.x + sn * v.x, dy = c * u.y + sn * v.y, dz = c * u.z + sn * v.z, k = glow && (s & 1) ? 0.82 : 1;
      accV(A, p[0] + r * dx, p[1] + r * dy, p[2] + r * dz, dx, dy, dz, cr * k, cg * k, cb * k);
    }
    if (prev >= 0) for (let s = 0; s < TUBE_SIDES; s++) { const s1 = (s + 1) % TUBE_SIDES; accT(A, prev + s, prev + s1, s0 + s1); accT(A, prev + s, s0 + s1, s0 + s); }
    else {
      ring0 = s0;
      const ap = accV(A, p[0] - t.x * r, p[1] - t.y * r, p[2] - t.z * r, -t.x, -t.y, -t.z, cr, cg, cb);
      for (let s = 0; s < TUBE_SIDES; s++) accT(A, s0 + (s + 1) % TUBE_SIDES, s0 + s, ap);
    }
    prev = s0;
  };
  const cap = j => {
    const p = P[j], r = st.w * p[3] / 2, ap = accV(A, p[0] + t.x * r, p[1] + t.y * r, p[2] + t.z * r, t.x, t.y, t.z, cr, cg, cb);
    for (let s = 0; s < TUBE_SIDES; s++) accT(A, prev + s, prev + (s + 1) % TUBE_SIDES, ap);
  };
  return {
    push(pt) {
      P.push(pt); const i = P.length - 1;
      if (i === 1) ring(0, P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]);
      else if (i >= 2) ring(i - 1, P[i][0] - P[i - 2][0], P[i][1] - P[i - 2][1], P[i][2] - P[i - 2][2]);
    },
    end() { const i = P.length - 1; if (i >= 1) { ring(i, P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]); cap(i); } },
  };
}
// a ribbon: a flat strip along the path whose face turns as the hand held it (the controller's up), lit from both sides
function ribbonMesher(A, st) {
  const [cr, cg, cb] = strokeRGB(st), P = [], b = new THREE.Vector3(), n = new THREE.Vector3(), t = new THREE.Vector3();
  let prev = -1, haveB = false;
  const pair = (j, tx, ty, tz) => {
    t.set(tx, ty, tz); if (t.lengthSq() < 1e-18) t.set(0, 1, 0); t.normalize();
    const p = P[j]; n.set(p[4], p[5], p[6]);
    _t1.crossVectors(t, n);
    if (_t1.lengthSq() < 1e-6) { if (!haveB) perpTo(t, b); else { b.addScaledVector(t, -b.dot(t)); if (b.lengthSq() < 1e-8) perpTo(t, b); b.normalize(); } }
    else b.copy(_t1).normalize();
    haveB = true;
    n.crossVectors(b, t).normalize();
    const h = st.w * p[3] / 2, s0 = A.v;
    accV(A, p[0] - b.x * h, p[1] - b.y * h, p[2] - b.z * h, n.x, n.y, n.z, cr, cg, cb);
    accV(A, p[0] + b.x * h, p[1] + b.y * h, p[2] + b.z * h, n.x, n.y, n.z, cr, cg, cb);
    if (prev >= 0) { accT(A, prev, prev + 1, s0 + 1); accT(A, prev, s0 + 1, s0); }
    prev = s0;
  };
  return {
    push(pt) {
      P.push(pt); const i = P.length - 1;
      if (i === 1) pair(0, P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]);
      else if (i >= 2) pair(i - 1, P[i][0] - P[i - 2][0], P[i][1] - P[i - 2][1], P[i][2] - P[i - 2][2]);
    },
    end() { const i = P.length - 1; if (i >= 1) pair(i, P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]); },
  };
}
// the vertices and triangles a stroke takes (the buffers' sizes), per look
function strokeSize(st) {
  const k = st.k.length;
  if (st.b === 'ribbon') return { look: 'ribbon', v: 2 * k, i: 6 * (k - 1) };
  if (st.b === 'spray') return { look: 'spray', v: Math.min(PNT.maxDots, Math.ceil(sprayEstimate(st)) + k), i: 0 };
  return { look: st.b, v: (TUBE_SIDES * k) + 2, i: 6 * TUBE_SIDES * (k - 1) + 6 * TUBE_SIDES };
}
// a whole stroke into the accumulators (a painting's build)
function meshStroke(AC, st) {
  const sd = AC.spray;
  if (st.b === 'spray') {
    const dots = [], rate = Math.min(1, PNT.maxDots / Math.max(1, sprayEstimate(st)));
    for (let i = 1; i < st.k.length; i++) sprayDots1(st, i, rate, dots, PNT.maxDots);
    _mc.set(st.c);
    for (let d = 0; d < dots.length; d += 3) { const k = sd.v; accV(sd, dots[d], dots[d + 1], dots[d + 2], 0, 1, 0, _mc.r, _mc.g, _mc.b); sd.siz[k] = st.w * 0.12; }
    return;
  }
  const M = st.b === 'ribbon' ? ribbonMesher(AC.ribbon, st) : tubeMesher(AC[st.b], st);
  for (const q of st.k) M.push(q);
  M.end();
}

// ------------------------------------------------------------- materials --
let PMAT = null, DOT_TEX = null;
function paintMats() {
  if (PMAT) return PMAT;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(16, 16, 15, 0, 7); x.fill();
  DOT_TEX = new THREE.CanvasTexture(c); DOT_TEX.generateMipmaps = false; DOT_TEX.minFilter = THREE.LinearFilter;
  PMAT = {
    ribbon: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, side: THREE.DoubleSide }),
    tube: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  };
  return PMAT;
}
// a spray's dots: round (alphaTest, nothing see-through), each its own size in metres (aSize), the painting's size on top
function sprayMat(s) {
  paintMats();
  const m = new THREE.PointsMaterial({ vertexColors: true, map: DOT_TEX, alphaTest: 0.5, size: s || 1, sizeAttenuation: true });
  m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('void main() {', 'attribute float aSize;\nvoid main() {').replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;'); };
  m.customProgramCacheKey = () => 'studio-paint-dots-1';
  return m;
}
function geoOf(A, spray) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(A.pos.subarray(0, 3 * A.v), 3));
  g.setAttribute('color', new THREE.BufferAttribute(A.col.subarray(0, 3 * A.v), 3));
  if (spray) g.setAttribute('aSize', new THREE.BufferAttribute(A.siz.subarray(0, A.v), 1));
  else { g.setAttribute('normal', new THREE.BufferAttribute(A.nor.subarray(0, 3 * A.v), 3)); g.setIndex(new THREE.BufferAttribute(A.idx.subarray(0, A.i), 1)); }
  g.computeBoundingSphere();
  return g;
}

// ------------------------------------------------------------------- looks --
const PN_EDGE = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), PN_COL = '#ff8a6b';
function paintLook(id) {
  const body = new THREE.Group(), deco = new THREE.Group(), col = LOOKS.colOf(id), meshes = new THREE.Group();
  const hit = new THREE.Mesh(BOX1, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
  const line = LOOKS.batched(new THREE.LineSegments(PN_EDGE, new THREE.LineBasicMaterial({ color: 0xffffff })), 'line'); line.renderOrder = 6; line.visible = false;
  hit.scale.setScalar(0.1); line.scale.setScalar(0.1);
  body.add(meshes, hit, line);
  const name = LOOKS.tag(30); deco.add(name);
  const L = { body, deco, name, hit, line, meshes, col, bb: new THREE.Box3(new THREE.Vector3(-0.05, -0.05, -0.05), new THREE.Vector3(0.05, 0.05, 0.05)),
    // hot: the pointer on it, selected, editing, hid: a cube hides it from you (not drawn: its box's edges show where it is while editing)
    look(o) {
      meshes.visible = !o.hid && o.a > 0.5;
      line.visible = !!o.editing && (o.hid || o.hot || o.selected);
      line.material.color.set(col).lerp(new THREE.Color(1, 1, 1), o.selected || o.hot ? 0.6 : 0.1);
      name.visible = !!o.editing && !(o.hot || o.selected);
    },
    clear() { for (const m of meshes.children.slice()) { meshes.remove(m); m.geometry.dispose(); if (m.userData.own) m.material.dispose(); } },
    drop() { L.clear(); hit.material.dispose(); line.material.dispose(); name.userData.drop(); },
  };
  return L;
}
// a record taken (applyRec): its words, its size on the dots, whether its strokes changed (the meshes then built again)
function paintRec(it, was) {
  const r = it.rec, L = it.look;
  L.name.userData.set(tagName(r) + ` · ${paintN(r)} stroke${paintN(r) === 1 ? '' : 's'}`, L.col, 0.075);
  it.tagR = r;
  if (!was || (was.src || r.src ? was.src !== r.src : !sameStrokes(was.strokes, r.strokes))) it.pbVer = (it.pbVer || 0) + 1;
  for (const m of L.meshes.children) if (m.userData.own) m.material.size = r.s;
}
function paintDrop(it) {
  if (it.pb) it.pb = null;
  PAINT.keep.delete(it.id);
}
// its box in the items' frame (its strokes' bounds, as it is placed and shown now)
const _pbm = new THREE.Matrix4(), _pbv = new THREE.Vector3();
function paintBox(it, out) {
  const b = it.look.bb, H = it.holder;
  _pbm.compose(H.position, H.quaternion, H.scale);
  out.makeEmpty();
  for (let i = 0; i < 8; i++) out.expandByPoint(_pbv.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(_pbm));
  return out;
}
// as its record puts it (not as shown): for On the floor
function paintBoxRec(it, out) {
  const b = it.look.bb, r = it.rec;
  _pbm.compose(_pbv.fromArray(r.p), _pq.fromArray(r.q), _ps.setScalar(r.s));
  out.makeEmpty();
  for (let i = 0; i < 8; i++) out.expandByPoint(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(_pbm));
  return out;
}

// ------------------------------------------------------------ the files --
// PNF: a painting file's strokes by its path ({ k, state: 'loading' | 'ok' | 'bad', at, own, gen, err, failAt })
const PNF = new Map();
const pnPeek = r => { const f = r.src && PNF.get(r.src); return f && f.gen === STU.gen && f.k ? f.k : null; };
function pnK(r) {
  if (!r.src) return r.strokes;
  let f = PNF.get(r.src);
  if (f && f.gen !== STU.gen) { PNF.delete(r.src); f = null; }
  if (f && f.own) return f.k;
  const L = STU.fileMap.get(r.src) || { at: 0 };
  if (STU.scene && (!f || (f.state !== 'loading' && (f.at !== L.at || (f.state === 'bad' && performance.now() - f.failAt > 10000))))) pnLoad(r.src, L);
  return f && f.k ? f.k : null;
}
async function pnLoad(src, L) {
  const gen = STU.gen, was = PNF.get(src), e = { k: was && was.gen === gen ? was.k : null, state: 'loading', at: L.at, own: false, gen, err: '', failAt: 0 };
  PNF.set(src, e);
  try {
    const j = await getJSON(fileUrl(src));
    if (gen !== STU.gen || PNF.get(src) !== e) return;
    const list = j && typeof j === 'object' && !Array.isArray(j) && Array.isArray(j.strokes) && j.strokes.length <= PNT.strokes ? j.strokes.map(normStroke) : null;
    if (!list || list.includes(null) || ptsOf(list) > PNT.perPainting) throw new Error('its strokes could not be read');
    e.k = list; e.state = 'ok';
  } catch (err) {
    if (gen !== STU.gen || PNF.get(src) !== e) return;
    e.state = 'bad'; e.failAt = performance.now();
    e.err = `Its file ${src} could not be read (${err.status === 404 ? 'it is not in the scene' : err.status === 401 ? 'the relay wants its password' : err.message}).`;
  }
  dirty();
}
// the first free name: paintings/<base>-<n>.json
function pnNumbered(base, past) {
  const m = past ? /-(\d+)\.json$/.exec(past) : null;
  for (let n = m ? +m[1] + 1 : 1; ; n++) { const p = `${base}-${n}.json`; if (!STU.fileMap.has(p) && !PNF.has(p)) return p; }
}
async function pnFile(name, strokes, onP) {
  const scene = STU.scene, gen = STU.gen, base = 'paintings/' + safeSeg(words(name, 60));
  const text = JSON.stringify({ studio: 1, painting: 1, strokes });
  let p = pnNumbered(base);
  for (let tries = 0; ; tries++) {
    try {
      const j = await upSend(fileApi(scene, p, false), new Blob([text], { type: 'application/json' }), onP);
      const out = (j && j.path) || p;
      if (gen === STU.gen) { PNF.set(out, { k: strokes, state: 'ok', at: 0, own: true, gen, err: '', failAt: 0 }); refreshFiles(new Set([out])); }
      return out;
    } catch (e) { if (e.status !== 409 || tries > 20) throw e; p = pnNumbered(base, p); }
  }
}

// ------------------------------------------------------------- building --
// every frame, in a slice (about 1 ms in a headset, 3 ms on a page, shared by every painting): a painting's strokes into its
// meshes (a ribbon, a tube, a glow and a spray draw: at most four), built again only when its strokes change; the old meshes
// stay until the new are ready
function paintBuildStart(it, strokes, key) {
  const need = { ribbon: [0, 0], tube: [0, 0], glow: [0, 0], spray: [0, 0] };
  for (const st of strokes) { const z = strokeSize(st); need[z.look][0] += z.v; need[z.look][1] += z.i; }
  const AC = {};
  for (const k of ['ribbon', 'tube', 'glow']) AC[k] = accNew(need[k][0], need[k][1], false);
  AC.spray = accNew(need.spray[0], 0, true);
  it.pb = { key, strokes, i: 0, AC };
}
function paintBuildSlice(it, budget) {
  const B = it.pb;
  if (!B || B.i >= B.strokes.length) return;
  const t0 = performance.now();
  while (B.i < B.strokes.length) {
    if (PAINT.did && performance.now() - PAINT.t0 >= budget) return;
    meshStroke(B.AC, B.strokes[B.i++]);
    PAINT.did = true;
    if (performance.now() - t0 >= budget) break;
  }
}
function paintBuildDone(it) {
  const B = it.pb, L = it.look, M = paintMats(), stats = [], bb = new THREE.Box3();
  L.clear();
  for (const k of ['ribbon', 'tube', 'glow']) {
    const A = B.AC[k];
    if (!A.i) continue;
    const m = new THREE.Mesh(geoOf(A, false), M[k]); m.frustumCulled = false;
    L.meshes.add(m); stats.push({ look: k, tris: A.i / 3, draws: 1 });
    bb.union(m.geometry.boundingBox || (m.geometry.computeBoundingBox(), m.geometry.boundingBox));
  }
  const S = B.AC.spray;
  if (S.v) {
    const m = new THREE.Points(geoOf(S, true), sprayMat(it.rec.s)); m.frustumCulled = false; m.userData.own = true;
    L.meshes.add(m); stats.push({ look: 'spray', tris: 0, draws: 1 });
    m.geometry.computeBoundingBox(); bb.union(m.geometry.boundingBox);
  }
  // (the strokes' widths past the bounds of their points, and a minimum size so an empty painting can be pointed at)
  const wmax = B.strokes.reduce((a, s) => Math.max(a, s.w), 0.02);
  if (bb.isEmpty()) bb.set(new THREE.Vector3(-0.05, 0, -0.05), new THREE.Vector3(0.05, 0.1, 0.05));
  bb.expandByScalar(wmax);
  const sz = bb.getSize(new THREE.Vector3()).max(new THREE.Vector3(0.06, 0.06, 0.06)), c = bb.getCenter(new THREE.Vector3());
  L.bb.setFromCenterAndSize(c, sz);
  L.hit.position.copy(c); L.hit.scale.copy(sz); L.line.position.copy(c); L.line.scale.copy(sz);
  it.pbStats = { meshes: stats, dots: S.v, built: true };
  it.pbKey = B.key; it.pb = null; it.pbDone = true;
  const fzs = PNV.fz.get(it.id); if (fzs) { PNV.fz.delete(it.id); fzs.forEach(pvThaw); }
  STU.rev++;
}
// a painting each frame (itemsStep): the strokes it shows (its record's, or its file's once read), built when they changed; its
// look, name and box
const _pbb = new THREE.Box3(), _pqi = new THREE.Quaternion();
function paintItemStep(it, editing) {
  const L = it.look, r = it.rec, H = it.holder;
  const strokes = r.strokes || pnK(r), key = r.src ? 'f:' + r.src : 'r:' + it.pbVer;
  if (strokes && it.pbKey !== key && !(it.pb && it.pb.key === key)) paintBuildStart(it, strokes, key);
  if (it.pb) { paintBuildSlice(it, XR.on ? 1 : 3); if (it.pb && it.pb.i >= it.pb.strokes.length) paintBuildDone(it); }
  H.visible = true;
  L.look({ a: it.a, hid: it.hid, editing, hot: editing && STU.hover === it.id, selected: editing && STU.sel === it.id });
  L.deco.visible = editing;
  if (!editing) return;
  const h = it.shown ? '' : hidWord(it);
  if (it.tagH !== h || it.tagR !== r) { it.tagR = r; it.tagH = h; L.name.userData.set(tagName(r) + ` · ${paintN(r)} stroke${paintN(r) === 1 ? '' : 's'}` + (r.src && !strokes ? ' · reading its file' : '') + h, L.col, 0.075); }
  decoAt(H, L.deco);
  const b = paintBox(it, _pbb);
  L.name.position.set(0, b.max.y - L.deco.position.y + 0.04, 0).applyQuaternion(_pqi.copy(L.deco.quaternion).invert());
}
// finishes every build now (the tests; a painting just made)
function paintBuildAll() {
  for (const it of STU.items.values()) {
    if (it.kind !== 'd') continue;
    const r = it.rec, strokes = r.strokes || pnPeek(r), key = r.src ? 'f:' + r.src : 'r:' + it.pbVer;
    if (strokes && it.pbKey !== key && !(it.pb && it.pb.key === key)) paintBuildStart(it, strokes, key);
    if (it.pb) { while (it.pb.i < it.pb.strokes.length) meshStroke(it.pb.AC, it.pb.strokes[it.pb.i++]); paintBuildDone(it); }
  }
}

// -------------------------------------------------------- the stroke drawn --
// the stroke being drawn is this device's alone (the others see it once it is let go): its own small geometry, grown in place
// (buffers made once, only the new vertices sent), in the items' frame
const PNV = { m: new Map(), tip: null, froze: new Set(), fz: new Map() };
function pvGet(look) {
  let e = PNV.m.get(look);
  if (e) return e;
  const sp = look === 'spray', A = sp ? accNew(PNT.maxDots, 0, true) : accNew(look === 'ribbon' ? 2 * PNT.strokePts : TUBE_SIDES * PNT.strokePts + 2, look === 'ribbon' ? 6 * PNT.strokePts : 6 * TUBE_SIDES * PNT.strokePts + 6 * TUBE_SIDES, false);
  const g = new THREE.BufferGeometry(), dyn = a => { a.setUsage(THREE.DynamicDrawUsage); return a; };
  g.setAttribute('position', dyn(new THREE.BufferAttribute(A.pos, 3))); g.setAttribute('color', dyn(new THREE.BufferAttribute(A.col, 3)));
  if (sp) g.setAttribute('aSize', dyn(new THREE.BufferAttribute(A.siz, 1)));
  else { g.setAttribute('normal', dyn(new THREE.BufferAttribute(A.nor, 3))); g.setIndex(dyn(new THREE.BufferAttribute(A.idx, 1))); }
  g.setDrawRange(0, 0);
  const m = sp ? new THREE.Points(g, sprayMat(1)) : new THREE.Mesh(g, paintMats()[look]);
  m.frustumCulled = false; m.visible = false; if (sp) m.userData.own = true;
  GL.items.add(m);
  PNV.m.set(look, e = { mesh: m, A, sp });
  return e;
}
// the new vertices sent (updateRange), the draw range grown
function pvFlush(e) {
  const g = e.mesh.geometry, A = e.A;
  const up = (a, from, n, stride) => { if (n > 0) { a.updateRange.offset = from * stride; a.updateRange.count = n * stride; a.needsUpdate = true; } };
  up(g.attributes.position, A.f0, A.v - A.f0, 3); up(g.attributes.color, A.f0, A.v - A.f0, 3);
  if (e.sp) { up(g.attributes.aSize, A.f0, A.v - A.f0, 1); g.setDrawRange(0, A.v); }
  else { up(g.attributes.normal, A.f0, A.v - A.f0, 3); up(g.index, A.i0, A.i - A.i0, 1); g.setDrawRange(0, A.i); }
  A.f0 = A.v; A.i0 = A.i;
}
// a drawing's mesher: grows the preview with each point kept
function pvStart(D) {
  const e = pvGet(D.look); e.A.v = e.A.i = e.A.f0 = e.A.i0 = 0; e.mesh.geometry.setDrawRange(0, 0); e.mesh.visible = true;
  D.pv = e;
  const st = { b: D.brush, c: D.colour, w: D.width, k: [], sd: D.sd };
  D.st = st;
  if (!e.sp) D.M = D.brush === 'ribbon' ? ribbonMesher(e.A, st) : tubeMesher(e.A, st);
  else { _mc.set(D.colour); e.mesh.material.size = 1; }
}
function pvPush(D, pt) {
  const e = D.pv, st = D.st;
  st.k.push(pt);
  if (!e.sp) D.M.push(pt);
  else if (st.k.length >= 2 && e.A.v < PNT.maxDots) {
    const dots = [];
    sprayDots1(st, st.k.length - 1, 1, dots, PNT.maxDots - e.A.v);
    for (let d = 0; d < dots.length; d += 3) { const k = e.A.v; accV(e.A, dots[d], dots[d + 1], dots[d + 2], 0, 1, 0, _mc.r, _mc.g, _mc.b); e.A.siz[k] = st.w * 0.12; }
  }
  D.dirty = true;
}
function pvHide(D) { if (D && D.pv) { D.pv.mesh.visible = false; D.pv.mesh.geometry.setDrawRange(0, 0); } }
// the preview kept on show while its stroke's file goes into the scene: a copy of what was drawn
function pvFreeze(D) {
  const e = D.pv;
  if (!e || !e.A.v) return null;
  pvFlush(e);
  const g = e.mesh.geometry.clone(), m = e.sp ? new THREE.Points(g, sprayMat(1)) : new THREE.Mesh(g, e.mesh.material);
  m.frustumCulled = false; m.userData.own = e.sp; g.setDrawRange(0, e.sp ? e.A.v : e.A.i);
  GL.items.add(m); PNV.froze.add(m);
  return m;
}
function pvThaw(m) { if (!m) return; PNV.froze.delete(m); GL.items.remove(m); m.geometry.dispose(); if (m.userData.own) m.material.dispose(); }

// ---------------------------------------------------------------- drawing --
// why nothing can be painted now ('' it can): painting is for editing, not a visitor's, not a locked story's
function paintWhy() {
  if (OPT.visit) return 'Painting is for editing: not in a visitor\'s view.';
  if (!STU.scene) return 'Open a scene to paint in.';
  if (editLocked()) return 'This story is locked: nothing can be painted until it is unlocked.';
  if (!STU.edit) return 'Turn editing on to paint.';
  if (STU.listing !== 'ok') return 'The scene\'s files are not listed yet.';
  return '';
}
const paintTarget = () => { const it = STU.items.get(STU.sel); return it && it.kind === 'd' ? it : null; };
const paintSay = (text, c) => { PAINT.note = text; PAINT.noteC = c || 'muted'; dirty(true); };
function paintOn(it) {
  const w = paintWhy();
  if (w) { paintSay(w, 'amber'); return false; }
  if (it && it.kind === 'd') { if (STU.sel !== it.id) select(it.id); }
  PAINT.on = true; PAINT.sess = XR.on; PAINT.note = '';
  if (typeof X !== 'undefined') X.tab = 'paint';
  tcAttach();
  sfxAct('pick', 'stage', 'centre');
  dirty(true);
  return true;
}
function paintOff(tab) {
  if (!PAINT.on) return;
  paintCancel();
  PAINT.on = false; PAINT.arm = null;
  if (PNV.tip) PNV.tip.visible = false;
  if (typeof X !== 'undefined' && X.tab === 'paint') X.tab = tab || (STU.sel ? 'item' : 'add');
  tcAttach();
  sfxAct('click', 'stage', 'centre');
  dirty(true);
}
// a selection that is not a painting ends paint mode (select, e6_items.js); a painting keeps the Paint pane
function paintSelected(id) {
  if (!PAINT.on) return;
  const it = STU.items.get(id);
  if (id && !(it && it.kind === 'd')) { paintOff('item'); if (typeof X !== 'undefined') X.tab = 'item'; return; }
  if (typeof X !== 'undefined') X.tab = 'paint';
}
function paintCancel() {
  for (const c of XR.ctrls || []) if (c.pnD) { paintEnd(c.pnD, true); c.pnD = null; c.pnDown = false; }
  if (PAINT.pg) { paintEnd(PAINT.pg.D, true); PAINT.pg = null; }
  if (PAINT.drawing) paintEnd(PAINT.drawing, true);
}
// a stroke begins at pt (the items' frame; f the pressure, n a ribbon's face): null when it cannot (said why)
function paintBegin(by, pt, f, n) {
  const w = paintWhy();
  if (!PAINT.on || PAINT.drawing || w) { if (w && PAINT.on) paintSay(w, 'amber'); return null; }
  const T = paintTarget(), erase = PAINT.brush === 'eraser';
  if (T && lockWhy(T)) { paintSay(`${T.rec.name} is locked in place: nothing can be painted on it until it is unlocked.`, 'amber'); sfxAct('knock', 'world', null, { gain: 0.5 }); return null; }
  if (!erase && !T && !canAdd('d')) { paintSay(`The scene has ${LIMITS.d} paintings: the most it can hold.`, 'amber'); return null; }
  const D = { by, erase, brush: erase ? 'eraser' : PAINT.brush, look: erase ? '' : PAINT.brush, colour: PAINT.colour, width: PAINT.width, pts: [], pre: [], T: T ? T.id : '', gen: STU.gen, sd: 1 + Math.floor(Math.random() * 2147483647), dirty: false, over: 0 };
  if (PAINT.seed) { D.sd = PAINT.seed; }
  PAINT.drawing = D; PAINT.note = '';
  if (!erase) pvStart(D);
  paintAdd(D, pt, f, n);
  return D;
}
const _pn1 = new THREE.Vector3();
// a sample: kept when the tip moved 3 mm (a ribbon: or its face turned 10 degrees) from the last kept
function paintAdd(D, pt, f, n) {
  if (!D || D !== PAINT.drawing) return false;
  const P = D.pts, last = P[P.length - 1];
  const nn = n ? _pn1.copy(n).normalize() : _pn1.set(0, 1, 0), rib = D.brush === 'ribbon';
  if (last) {
    const moved = Math.hypot(pt.x - last[0], pt.y - last[1], pt.z - last[2]);
    const turned = rib ? Math.acos(Math.max(-1, Math.min(1, last[4] * nn.x + last[5] * nn.y + last[6] * nn.z))) : 0;
    if (moved < PNT.minMove && turned < PNT.minTurn) return false;
  }
  if (D.erase) { P.push([pt.x, pt.y, pt.z, 1]); paintEraseAt(D, pt); return true; }
  if (P.length >= PNT.strokePts) { D.over++; return false; }
  const q = [pt.x, pt.y, pt.z, clamp(f === undefined ? 1 : f, 0.1, 1)];
  if (rib) q.push(nn.x, nn.y, nn.z);
  P.push(q); pvPush(D, q);
  return true;
}
// the eraser: strokes within its width of the tip (the selected painting's, else any painting's), noted as it passes
const _ev = new THREE.Vector3(), _em = new THREE.Matrix4();
function distSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L2 = dx * dx + dy * dy + dz * dz;
  let t = L2 > 0 ? ((p.x - a[0]) * dx + (p.y - a[1]) * dy + (p.z - a[2]) * dz) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - a[0] - dx * t, p.y - a[1] - dy * t, p.z - a[2] - dz * t);
}
function distSegSeg(a0, a1, b0, b1) {
  // closest distance between segments a0-a1 and b0-b1 (arrays of 3), by sampling the first along its length against the second
  const L = Math.hypot(a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]), n = Math.min(24, Math.max(1, Math.ceil(L / 0.004)));
  let m = Infinity;
  for (let i = 0; i <= n; i++) { const t = i / n; _esp.set(a0[0] + (a1[0] - a0[0]) * t, a0[1] + (a1[1] - a0[1]) * t, a0[2] + (a1[2] - a0[2]) * t); m = Math.min(m, distSeg(_esp, b0, b1)); }
  return m;
}
const _esp = new THREE.Vector3();
function paintEraseAt(D, pt) {
  const list = D.T ? [STU.items.get(D.T)] : [...STU.items.values()].filter(it => it.kind === 'd');
  for (const it of list) {
    if (!it || it.rec.locked) continue;
    const S = it.rec.strokes || pnPeek(it.rec);
    if (!S) continue;
    _em.compose(_ev.fromArray(it.rec.p), _pq.fromArray(it.rec.q), _ps.setScalar(it.rec.s)).invert();
    const l = pt.clone().applyMatrix4(_em), thr = D.width / it.rec.s, pl = (D.lastL || (D.lastL = {}))[it.id] || null, cur = [l.x, l.y, l.z];
    D.lastL[it.id] = cur;
    S.forEach((st, i) => {
      const reach = thr + st.w / 2;
      for (let j = 1; j < st.k.length; j++) if ((pl ? distSegSeg(pl, cur, st.k[j - 1], st.k[j]) : distSeg(l, st.k[j - 1], st.k[j])) <= reach) { if (!D.hitMap) D.hitMap = new Map(); if (!D.hitMap.has(it.id)) D.hitMap.set(it.id, new Set()); D.hitMap.get(it.id).add(i); break; }
    });
  }
}
// the stroke let go (or cancelled): simplified, put into the painting's strokes (a new painting made with the first one),
// one change; a stroke of fewer than 2 points after simplifying is dropped. Returns what happened
function paintEnd(D, cancel) {
  if (!D || D !== PAINT.drawing) return null;
  PAINT.drawing = null;
  const out = { ok: false, brush: D.brush, id: '' };
  if (D.pv && D.dirty) pvFlush(D.pv);
  if (cancel) { pvHide(D); PAINT.last = Object.assign(out, { cancelled: true }); return out; }
  if (D.erase) { out.erased = paintEraseCommit(D); PAINT.last = out; return out; }
  const rib = D.brush === 'ribbon';
  let pts = D.pts;
  if (pts.length >= 2) pts = simplify(pts, PNT.simp, rib);
  if (pts.length < 2) { pvHide(D); out.dropped = true; PAINT.last = out; return out; }
  Object.assign(out, paintCommitStroke(D, pts));
  PAINT.last = out;
  return out;
}
// the points into the painting's frame and a stroke made of them; the painting it goes into (the one selected), or a new one
// (its p at the first point on the floor below it, its turn facing you level)
const _fp = new THREE.Vector3();
function paintCommitStroke(D, pts) {
  const T = D.T ? STU.items.get(D.T) : null;
  if (D.T && !T) { pvHide(D); return { why: 'the painting is gone' }; }
  const p = T ? T.rec.p : [pts[0][0], 0, pts[0][2]], q = T ? T.rec.q : facingQ(p), s = T ? T.rec.s : 1;
  _em.compose(_fp.fromArray(p), _pq.fromArray(q), _ps.setScalar(s)).invert();
  const iq = new THREE.Quaternion().fromArray(q).invert(), rib = D.brush === 'ribbon', v = new THREE.Vector3();
  const k = pts.map(a => {
    v.set(a[0], a[1], a[2]).applyMatrix4(_em);
    const o = [v.x, v.y, v.z, a[3]];
    if (rib) { v.set(a[4], a[5], a[6]).applyQuaternion(iq); o.push(v.x, v.y, v.z); }
    return o;
  });
  const st = normStroke({ b: D.brush, c: D.colour, w: D.width / s, k, sd: D.sd });
  if (!st) { pvHide(D); return { why: 'the stroke could not be made' }; }
  let base = [];
  if (T) { base = T.rec.strokes || pnPeek(T.rec); if (!base) { pvHide(D); paintSay('Its file is not read yet: wait a moment and paint again.', 'amber'); return { why: 'its file is not read yet' }; } }
  const mk = T ? null : { name: nameFor('Painting'), p, q, s };
  return paintStore(T ? T.id : '', mk, base.concat([st]), D, st);
}
// a new painting faces you: level, its front (+z) towards your head
function facingQ(p) {
  const c = viewerAt(), yaw = Math.atan2(c.x - p[0], c.z - p[2]);
  return new THREE.Quaternion().setFromAxisAngle(_yUp, Number.isFinite(yaw) ? yaw : 0).toArray().map(v => nz(r4(v)));
}
// the strokes a painting should hold, put into its record, or (past 4,000 points in all the scene's records) into a file of the
// scene (a relay that takes uploads), else refused in words; one change. mk: a new painting's place (made with these); D: the
// drawing whose preview comes off (kept on show while a file goes in)
function paintStore(id, mk, strokes, D, added) {
  const n = strokes.length, pts = ptsOf(strokes);
  const fail = text => { pvHide(D); paintSay(text, 'amber'); sfxAct('knock', 'world', null, { gain: 0.5 }); return { why: text }; };
  if (n > PNT.strokes) return fail(`A painting holds ${PNT.strokes.toLocaleString('en')} strokes at most.`);
  if (pts > PNT.perPainting) return fail(`A painting holds ${PNT.perPainting.toLocaleString('en')} points at most.`);
  if (!id && !canAdd('d')) return fail(`The scene has ${LIMITS.d} paintings: the most it can hold.`);
  const bytes = JSON.stringify(strokes).length;
  if (bytes > PNT.fileBytes) return fail(`This painting is too big to keep (about ${Math.round(bytes / 1e6 * 10) / 10} MB): start a new painting.`);
  // (in the record only while the points fit and the whole shared state stays under the recorded paths' limit: one relay value)
  const inRec = pts + paintInRecord(id) <= PNT.rec && JSON.stringify(collabState()).length + bytes <= PATH_MAX.state;
  if (inRec) {
    let nid = id;
    change(() => { if (mk) { nid = newId(); putItem(nid, 'd', norm('d', Object.assign({}, mk, { strokes }))); } else setRec(id, { strokes, src: undefined, n: undefined, pts: undefined }); });
    if (mk && STU.items.has(nid)) select(nid);
    // (the preview stays on show until the painting's own meshes are built, so the stroke never blinks out)
    const fz0 = D ? pvFreeze(D) : null;
    pvHide(D);
    if (fz0) { (PNV.fz.get(nid) || PNV.fz.set(nid, []).get(nid)).push(fz0); setTimeout(() => pvThaw(fz0), 8000); }
    sfxAct('place', 'world', null, { gain: 0.5 });
    return { ok: true, id: nid, strokes: n, pts, where: 'record' };
  }
  if (!canUpload()) return fail('More strokes need a relay that takes uploads: a scene\'s paintings keep 4,000 points in all in its layout, the rest in a file of the scene.');
  const nid = id || newId(), fz = D ? pvFreeze(D) : null;
  pvHide(D);
  paintKeep(nid, mk, strokes, fz);
  return { ok: true, id: nid, strokes: n, pts, where: 'file', pending: true };
}
async function paintKeep(id, mk, strokes, fz) {
  const gen = STU.gen, name = mk ? mk.name : (STU.items.get(id) || { rec: { name: 'Painting' } }).rec.name, K = { text: 'Keeping the painting: its file goes into the scene...' };
  PAINT.keep.set(id, K); dirty(true);
  let src = '';
  try {
    src = await pnFile(name, strokes, f => { const t = `Keeping the painting: its file goes into the scene (${Math.round(f * 100)} %)...`; if (t !== K.text) { K.text = t; dirty(); } });
  } catch (e) {
    PAINT.keep.delete(id); pvThaw(fz);
    if (gen === STU.gen) paintSay(`The painting could not be kept (nothing changed): ${e.status === 401 ? AUTH_NOTE : e.message}`, 'amber');
    return;
  }
  PAINT.keep.delete(id);
  if (gen !== STU.gen || GL.gone) { pvThaw(fz); return; }
  let ok = false;
  change(() => {
    const patch = { strokes: undefined, src, n: strokes.length, pts: ptsOf(strokes) };
    if (mk && !STU.items.has(id)) ok = !!putItem(id, 'd', norm('d', Object.assign({}, mk, patch)));
    else ok = !!setRec(id, patch);
  });
  pvThaw(fz);
  if (!ok) { paintSay('The painting could not be kept.', 'amber'); return; }
  if (mk) select(id);
  paintSay(`Kept: ${strokes.length} stroke${strokes.length === 1 ? '' : 's'} in ${ptsOf(strokes).toLocaleString('en')} points, as the file ${src}.`, 'green');
  sfxAct('rise', 'world', null, { dur: 0.5, gain: 0.5 });
}
// the eraser's press ended: every stroke it passed removed, in one step
function paintEraseCommit(D) {
  const M = D.hitMap;
  if (!M || !M.size) return 0;
  let total = 0, refused = '';
  change(() => {
    for (const [id, set] of M) {
      const it = STU.items.get(id);
      if (!it || it.rec.locked) continue;
      const S = it.rec.strokes || pnPeek(it.rec);
      if (!S) continue;
      const left = S.filter((_, i) => !set.has(i));
      if (left.length === S.length) continue;
      const pts = ptsOf(left);
      if (pts + paintInRecord(id) <= PNT.rec) { setRec(id, { strokes: left, src: undefined, n: undefined, pts: undefined }); total += S.length - left.length; }
      else refused = 'What is left of a painting kept as a file is still more than the layout holds: erasing there needs a relay that takes uploads.';
    }
  });
  if (refused && !total) paintSay(refused, 'amber');
  if (total) sfxAct('snap', 'world', null, { gain: 0.5 });
  return total;
}

// --------------------------------------------------------- the headset's trigger --
// the right trigger paints from a point 6 cm ahead of the controller along its ray; its pressure sets the width factor; the
// left hand keeps the menu and panels (a ray on a panel presses the panel, never paints). Called each frame with each
// controller (xrPoint, e8_xr.js)
const _pxt = new THREE.Vector3(), _pxn = new THREE.Vector3(), _pxq = new THREE.Quaternion();
function paintHand(c) {
  const hs = XR.ctrls.filter(k => k.src && k.g.visible && k.src.gamepad);
  const r = hs.find(k => k.src.handedness === 'right');
  return (r || hs[0]) === c;
}
function paintXR(c, gp, dt) {
  if (!PAINT.on || !XR.on || !c.src || !gp) return;
  if (!paintHand(c)) return;
  GL.world.updateMatrixWorld(true);
  const tip = GL.world.worldToLocal(_pxt.copy(c.o).addScaledVector(c.d, PNT.tip));
  const tp = paintTip();
  tp.visible = !!PAINT.on;
  tp.position.copy(tip); tp.scale.setScalar(Math.max(0.003, PAINT.width / 2));
  tp.material.color.set(PAINT.brush === 'eraser' ? '#ffffff' : PAINT.colour);
  const b = gp.buttons && gp.buttons[0], down = !!b && (b.pressed || b.value > 0.1), f = b ? clamp(b.value > 0 ? b.value : b.pressed ? 1 : 0, 0.1, 1) : 1;
  GL.world.getWorldQuaternion(_pxq).invert();
  _pxn.set(0, 1, 0).transformDirection(c.g.matrix).applyQuaternion(_pxq);
  if (down && !c.pnDown) {
    c.pnDown = true;
    const h = c.hover;
    if (!(h && (h.kind === 'panel' || h.kind === 'shell' || h.kind === 'bar'))) c.pnD = paintBegin('xr', tip, f, _pxn);
  } else if (down && c.pnD) paintAdd(c.pnD, tip, f, _pxn);
  else if (!down && c.pnDown) { c.pnDown = false; if (c.pnD) { paintEnd(c.pnD); c.pnD = null; } }
}
function paintLetGo(c) { if (c.pnD) { paintEnd(c.pnD); c.pnD = null; } c.pnDown = false; }
function paintTip() {
  if (PNV.tip) return PNV.tip;
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  m.visible = false; m.frustumCulled = false; GL.items.add(m);
  return (PNV.tip = m);
}
// a trigger press the shell would take for a selection: in paint mode only a panel's (or the shell's) is a press
const paintKeepsPress = h => PAINT.on && !(h && (h.kind === 'panel' || h.kind === 'shell' || h.kind === 'bar'));

// -------------------------------------------------------------- the page's pointer --
// a press and drag on the scene paints where the pointer's ray meets the scene's surfaces (models, shapes, the floor), 3 mm out
// along the surface's normal, else at the distance where the drag began; Orbit view only (the wheel still zooms)
const _pr = new THREE.Raycaster(), _pinv = new THREE.Matrix4(), _pn = new THREE.Vector3();
function paintSurface(rc, depth, fast) {
  GL.world.updateMatrixWorld(true);
  let best = null;
  const consider = h => {
    if (!h || (best && h.distance >= best.distance)) return;
    const nrm = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : rc.ray.direction.clone().negate();
    if (nrm.dot(rc.ray.direction) > 0) nrm.negate();
    best = { distance: h.distance, point: h.point.clone(), normal: nrm };
  };
  if (!fast) for (const it of STU.items.values()) {
    if (!it.holder.visible || it.hid || !it.shown) continue;
    if (it.kind === 'o' && it.model && rc.intersectObject(it.proxy, false).length) consider(modelHits(it.model.o, rc)[0]);
    else if (it.kind === 'p' && it.rec.look !== 'hide' && it.look.mesh) consider(rc.intersectObject(it.look.mesh, false)[0]);
  }
  _pinv.copy(GL.items.matrixWorld).invert();
  const r = rc.ray.clone().applyMatrix4(_pinv), fl = r.intersectPlane(_rp, new THREE.Vector3());
  if (fl) { const w = GL.items.localToWorld(fl.clone()), d = w.distanceTo(rc.ray.origin); if (!best || d < best.distance) best = { distance: d, point: w, normal: new THREE.Vector3(0, 1, 0).transformDirection(GL.items.matrixWorld) }; }
  if (best) {
    const p = GL.items.worldToLocal(best.point.clone().addScaledVector(best.normal, 0.003));
    const n = best.normal.clone().transformDirection(_pinv);
    return { p, n, distance: best.distance };
  }
  const w = rc.ray.origin.clone().addScaledVector(rc.ray.direction, depth || 3);
  return { p: GL.items.worldToLocal(w), n: rc.ray.direction.clone().negate().transformDirection(_pinv), distance: depth || 3 };
}
function paintDown(ev) {
  if (!PAINT.on || PAINT.pg || APP.mode !== 'explore' || XR.on || X.view !== 'orbit' || ev.button !== 0 || ev.shiftKey || (GL.tc && GL.tc.axis)) return false;
  if (paintWhy()) { paintSay(paintWhy(), 'amber'); return true; }
  const rc = pointerRay(ev.clientX, ev.clientY), s = paintSurface(rc, 0);
  const D = paintBegin('page', s.p, ev.pointerType === 'pen' && ev.pressure > 0 ? ev.pressure : 1, s.n);
  PAINT.pg = { pid: ev.pointerId, D, depth: s.distance };
  return true;
}
function paintMove(ev) {
  const G = PAINT.pg;
  if (!G || !G.D) return;
  // (the models are raycast only for the latest of a batch of coalesced events: a ray against a big scan costs tens of ms; the
  // others in between use the floor or the depth the drag began at)
  const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [];
  const L = evs.length ? evs : [ev];
  L.forEach((e, i) => {
    const s = paintSurface(pointerRay(e.clientX, e.clientY), G.depth, i < L.length - 1);
    paintAdd(G.D, s.p, e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 1, s.n);
  });
}
function paintUp() { const G = PAINT.pg; PAINT.pg = null; if (G && G.D) paintEnd(G.D); }

// ------------------------------------------------------------ every frame --
// (itemsStep, after the items: the preview's new vertices sent; the tip; paint mode ended when editing is, or a session begins
// or ends)
function paintTick(editing) {
  PAINT.t0 = performance.now(); PAINT.did = false;
  if (PAINT.on && (!editing || !!PAINT.sess !== !!XR.on || !STU.scene)) paintOff();
  const D = PAINT.drawing;
  if (D && D.dirty && D.pv) { pvFlush(D.pv); D.dirty = false; }
  if (PNV.tip && (!PAINT.on || !XR.on)) PNV.tip.visible = false;
}
function paintDispose() {
  paintCancel();
  for (const e of PNV.m.values()) { GL.items.remove(e.mesh); e.mesh.geometry.dispose(); if (e.sp) e.mesh.material.dispose(); }
  PNV.m.clear();
  for (const m of [...PNV.froze]) pvThaw(m);
  if (PNV.tip) { GL.items.remove(PNV.tip); PNV.tip.geometry.dispose(); PNV.tip.material.dispose(); PNV.tip = null; }
  for (const a of PNV.fz.values()) a.forEach(pvThaw);
  PNV.fz.clear();
  if (PMAT) { for (const k in PMAT) PMAT[k].dispose(); PMAT = null; }
  if (DOT_TEX) { DOT_TEX.dispose(); DOT_TEX = null; }
  PAINT.on = false; PAINT.keep.clear(); PNF.clear();
}

// ------------------------------------------------------------- the panes --
// a test or a tool drawing a stroke from given tip samples, as the trigger would: [x, y, z, f?, nx?, ny?, nz?] in the scene's
// frame; o: { brush, colour, width, seed } for this stroke alone. Paint mode must be on
PAINT.fake = (points, o) => {
  o = o || {};
  const keep = { brush: PAINT.brush, colour: PAINT.colour, width: PAINT.width, seed: PAINT.seed };
  if (o.brush) PAINT.brush = o.brush; if (o.colour) PAINT.colour = o.colour; if (o.width) PAINT.width = o.width; PAINT.seed = o.seed || 0;
  try {
    const V = a => new THREE.Vector3(a[0], a[1], a[2]), N = a => (a[4] === undefined ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(a[4], a[5], a[6]));
    const D = paintBegin('fake', V(points[0]), points[0][3] === undefined ? 1 : points[0][3], N(points[0]));
    if (!D) return { ok: false, refused: true, note: PAINT.note };
    for (let i = 1; i < points.length; i++) paintAdd(D, V(points[i]), points[i][3] === undefined ? 1 : points[i][3], N(points[i]));
    return paintEnd(D);
  } finally { Object.assign(PAINT, keep, { seed: keep.seed }); }
};
// settles a file wait in the tests: the painting kept so far (its file in, its record written)
PAINT.build = id => { paintBuildAll(); return id ? paintingState(id) : null; };
PAINT.brushes = ['ribbon', 'tube', 'glow', 'spray', 'eraser'];

const PAINT_BRUSH = { ribbon: 'Ribbon', tube: 'Tube', glow: 'Glow', spray: 'Spray can', eraser: 'Eraser' };
const mmWords = w => (w * 1000).toFixed(w < 0.0095 ? (w < 0.0025 ? 0 : 1) : 0).replace(/\.0$/, '') + ' mm';
// the Add pane's Paint row
function paintAddBlocks(B, full) {
  const w = paintWhy();
  B.push({ label: 'Paint', row: [{ id: 'paint:on', label: PAINT.on ? 'Painting: on (Done in the Paint pane)' : 'Paint', act: 'pnOn', on: PAINT.on, dis: !!w || (full('d') && !paintTarget()) }] },
    { p: 'Draw in the air with a ribbon, a tube, a glow pen or a spray can (and an eraser): in a headset the right trigger paints from just ahead of the controller, on a page a drag on the scene. Strokes go into the painting selected, else a new painting; it moves, turns, sizes, shows and hides and groups as anything else.', c: 'faint' });
  if (w && !PAINT.on) B.push({ p: w, c: 'amber' });
}
// the Paint pane (shown while paint mode is on)
function paintBlocks(B) {
  const T = paintTarget(), w = paintWhy(), dis = !PAINT.on;
  B.push({ h: 'Paint', sub: 'Drawing in the air' });
  if (!PAINT.on) { B.push({ p: 'Paint mode is off: Paint on the Add pane (or Paint on it on a painting\'s card) turns it on.', c: 'muted' }); return; }
  if (w) B.push({ p: w, c: 'amber' });
  B.push({ p: T ? `Strokes go into ${T.rec.name}${T.rec.locked ? ' (locked in place: refused)' : ''}.` : 'The next stroke makes a new painting.', c: T && T.rec.locked ? 'amber' : 'muted' });
  B.push({ label: 'Brush', row: PAINT.brushes.map(k => ({ id: 'pnbrush:' + k, label: PAINT_BRUSH[k], act: 'pnBrush', v: k, on: PAINT.brush === k })) },
    { label: 'Colour', row: SHAPE_COLS.map(([c, n]) => ({ id: 'pncol:' + c, label: n, act: 'pnColour', v: c, on: PAINT.colour === c, sw: c })) },
    { page: true, colour: { id: 'stuPaintCol', act: 'pnColour', value: PAINT.colour, label: 'Any colour' } },
    { label: `Width: ${mmWords(PAINT.width)}`, row: [{ id: 'pnw:-', label: 'Thinner', act: 'pnWidth', v: -1, dis: PAINT.width <= PNT.widths[0] }, { id: 'pnw:+', label: 'Thicker', act: 'pnWidth', v: 1, dis: PAINT.width >= PNT.widths[PNT.widths.length - 1] }] },
    { row: [{ id: 'pn:new', label: 'New painting', act: 'pnNew', dis: !STU.sel }, { id: 'pn:done', label: 'Done', act: 'pnDone', primary: true }] });
  B.push({ p: XR.on ? 'The right trigger paints from a little ahead of the controller; pressing harder is a wider stroke. The grip still carries things. Done, or selecting something that is not a painting, ends it.' : 'Drag on the scene (Orbit view) to paint where the pointer meets its surfaces; the wheel still zooms, a right drag pans. Done, or selecting something that is not a painting, ends it.', c: 'faint' });
  if (PAINT.brush === 'eraser') B.push({ p: 'The eraser removes every stroke it passes within its width of, in the painting selected (else any painting): one Undo step for one press.', c: 'faint' });
  for (const [, K] of PAINT.keep) B.push({ p: K.text, c: 'muted' });
  if (PAINT.note) B.push({ p: PAINT.note, c: PAINT.noteC });
  if (PAINT.last && PAINT.last.ok) B.push({ p: `Last stroke: ${PAINT.last.strokes} stroke${PAINT.last.strokes === 1 ? '' : 's'} in the painting, ${PAINT.last.pts.toLocaleString('en')} points.`, c: 'faint' });
}
// a painting's card
function paintingBlocks(it, B, dis, mv) {
  const r = it.rec, n = paintN(r), pts = paintP(r), K = PAINT.keep.get(it.id), f = r.src && PNF.get(r.src), sz = it.look.bb.getSize(new THREE.Vector3()).multiplyScalar(r.s), armed = PAINT.arm && PAINT.arm.id === it.id && performance.now() - PAINT.arm.at < 3000;
  B.push({ h: r.name, sub: 'Painting' + hiddenSub(it, it.shown) },
    { kv: [['Strokes', `${n} · ${pts.toLocaleString('en')} points`], ['Kept', r.src ? 'in the file ' + r.src : 'in the scene\'s layout'], ['Size', `${metres(sz.x)} × ${metres(sz.y)} × ${metres(sz.z)} (x, height, z)`], ['Scale', '× ' + r.s]] });
  if (r.src && f && f.state === 'bad') B.push({ p: f.err, c: 'amber' });
  else if (r.src && !pnPeek(r)) B.push({ p: 'Its file is being read: it shows once it is in.', c: 'faint' });
  if (K) B.push({ p: K.text, c: 'muted' });
  B.push({ label: 'Paint', row: [{ id: 'pn:paint', label: PAINT.on && STU.sel === it.id ? 'Painting on it (Done in the Paint pane)' : 'Paint on it', act: 'i:pnOnIt', on: PAINT.on && STU.sel === it.id, dis }] },
    { label: 'Size, every side', row: [0.5, 0.9, 1.1, 2].map(k => ({ id: 'dsize:' + k, label: '×' + k, act: 'i:dsize', v: k, dis: mv })) },
    { label: 'Place', row: [{ id: 'turn', label: 'Turn 90°', act: 'i:turn', dis: mv }, { id: 'floor', label: 'On the floor', act: 'i:floor', dis: mv }] },
    { label: 'Strokes', row: [{ id: 'pn:clear', label: armed ? 'Clear: press again' : 'Clear', act: armed ? 'i:pclear' : 'i:pclearArm', on: armed, dis: dis || !n, col: 'red' }] },
    { p: 'The strokes are in its own frame, so it moves, turns and sizes as one. Clear takes every stroke away (two presses, one Undo step); the painting stays, empty, until deleted.', c: 'faint' });
  if (PAINT.note && PAINT.on === false) B.push({ p: PAINT.note, c: PAINT.noteC });
}
const paintSub = r => `Painting · ${paintN(r)} stroke${paintN(r) === 1 ? '' : 's'}`;
// the Items pane's tile: its strokes' colours (the first four)
const paintCols = r => { const S = r.strokes || []; return [...new Set(S.map(s => s.c))].slice(0, 4); };
function paintSig() { return [PAINT.on, PAINT.brush, PAINT.colour, PAINT.width, PAINT.note, PAINT.keep.size, PAINT.arm && PAINT.arm.id, PAINT.last && PAINT.last.strokes, [...PNF.values()].map(f => f.state).join('')].join(); }

const PAINT_ACT = {
  pnOn: () => { if (PAINT.on) paintOff(); else paintOn(null); },
  pnBrush: v => { if (PAINT.brushes.includes(v)) { PAINT.brush = v; PAINT.note = ''; } },
  pnColour: v => { if (/^#[0-9a-f]{6}$/i.test(v)) { PAINT.colour = String(v).toLowerCase(); if (PAINT.brush === 'eraser') PAINT.brush = 'ribbon'; } },
  pnWidth: v => { PAINT.width = stepOf(PNT.widths, PAINT.width, +v); },
  pnNew: () => { if (STU.sel) select(''); if (typeof X !== 'undefined') X.tab = 'paint'; },
  pnDone: () => paintOff(),
};
Object.assign(ITEM_ACT, {
  // a painting: its size (every side alike, about its foot), paint mode into it, Clear (two presses)
  dsize: (it, k) => {
    if (it.kind !== 'd' || !(+k > 0)) return;
    const b0 = paintBoxRec(it, new THREE.Box3()), s = +clamp(it.rec.s * k, 0.05, 20).toPrecision(4);
    const r0 = it.rec; it.rec = Object.assign({}, r0, { s }); const b1 = paintBoxRec(it, new THREE.Box3()); it.rec = r0;
    setRec(it.id, { s, p: [it.rec.p[0] + (b0.min.x + b0.max.x - b1.min.x - b1.max.x) / 2, it.rec.p[1] + b0.min.y - b1.min.y, it.rec.p[2] + (b0.min.z + b0.max.z - b1.min.z - b1.max.z) / 2] });
  },
  pnOnIt: it => { if (it.kind === 'd') paintOn(it); },
  pclearArm: it => { PAINT.arm = { id: it.id, at: performance.now() }; later(() => dirty(true), 3100); },
  pclear: it => {
    if (it.kind !== 'd') return;
    PAINT.arm = null;
    if (PAINT.on && PAINT.drawing) return;
    setRec(it.id, { strokes: [], src: undefined, n: undefined, pts: undefined });
  },
});

// for the tests (STUDIO.paint() and STUDIO.painting(id))
function paintState() {
  const D = PAINT.drawing, T = paintTarget();
  return { on: PAINT.on, brush: PAINT.brush, colour: PAINT.colour, width: PAINT.width, painting: T ? T.id : '', drawing: D ? { n: D.pts.length, brush: D.brush, by: D.by } : null, last: PAINT.last, note: PAINT.note, keeping: [...PAINT.keep.keys()], why: paintWhy() };
}
function paintingState(id) {
  const it = STU.items.get(id);
  if (!it || it.kind !== 'd') return null;
  const st = it.pbStats || { meshes: [], dots: 0 }, S = it.rec.strokes || pnPeek(it.rec);
  return { rec: it.rec, strokes: S ? S.length : -1, meshes: st.meshes.slice(), dots: st.dots, built: !!it.pbDone && !it.pb, ver: it.pbVer, shown: it.shown, a: it.a, hid: it.hid, drawn: it.look.meshes.children.map(m => m.visible && it.look.meshes.visible),
    bb: it.look.bb.toArray ? [it.look.bb.min.toArray(), it.look.bb.max.toArray()] : null, materials: it.look.meshes.children.map(m => ({ transparent: m.material.transparent, depthWrite: m.material.depthWrite, depthTest: m.material.depthTest, opacity: m.material.opacity })) };
}

// ------------------------------------------------------------- duplicating --
// the points a set of copies would add to the records (a scene's paintings keep 4,000 in all); '' they fit
function paintCopyWhy(recs) {
  const add = recs.reduce((a, r) => a + (r.strokes ? ptsOf(r.strokes) : 0), 0);
  const bytes = recs.reduce((a, r) => a + (r.strokes ? JSON.stringify(r.strokes).length : 0), 0);
  if (add && JSON.stringify(collabState()).length + bytes > PATH_MAX.state) return `No room for its copy: with its strokes the scene would be too big to share in a room (more than ${PATH_MAX.state >> 10} KB).`;
  return add && add + paintInRecord('') > PNT.rec ? `No room for its copy: a scene's paintings keep ${PNT.rec.toLocaleString('en')} points in all in its layout (the rest go in files of the scene).` : '';
}
// Duplicate (beside it): its strokes copied into the record when they fit, else into a new file of the scene
function duplicatePainting(it) {
  const r = it.rec, S = r.strokes || pnPeek(r);
  if (!S) { paintSay('Its file is not read yet: try again in a moment.', 'amber'); return ''; }
  const nid = newId(), mk = { name: nameFor(r.name.replace(/ \d+$/, '')), p: [r.p[0] + 0.5, r.p[1], r.p[2]], q: r.q, s: r.s };   // (a copy is never locked)
  if (r.shows) mk.shows = r.shows;
  if (ptsOf(S) + paintInRecord('') <= PNT.rec) {
    change(() => putItem(nid, 'd', norm('d', Object.assign({}, mk, { strokes: S }))));
    if (STU.items.has(nid)) select(nid);
    sfxAct('place', 'world', null);
    return nid;
  }
  if (!canUpload()) { paintSay('More strokes need a relay that takes uploads: a copy of this painting does not fit the 4,000 points the layout keeps.', 'amber'); return ''; }
  paintKeep(nid, mk, S, null);
  return nid;
}
