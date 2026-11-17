// ================================================================== TRAILS ==
// Trails (v158; the owner, 17 November 2026: trails "for both [items and people's hands] and show to everyone at the
// circle"; tools/output/SPEC.md "v158" section 3 is the contract, tools/studio/SPEC.md "Trails" the studio's part). An
// object's, a shape's, an empty's or a sound's record may carry
//   trail: { len, w, col }   (len 0.5..10 s, w 0.005..0.1 m, col '#rrggbb': absent the kind's own colour)
// and the scene's settings may carry hands: { len, w } (people's hand trails, in their colours; absent: off). Each device
// draws them from what it draws (nothing is sent): behind the item's middle as drawn here (motions, paths, behaviours,
// carries, trackers), and from the hands of the people in a headset at this circle (the shell's persons(), smoothed
// presence) and this device's own controllers. One batched draw: a ribbon facing the camera (two vertices a sample, opened
// in view space in the vertex shader, so each eye of a headset sees it face on), fading to black with age and blended in
// the ships' way (colour One/One, alpha Zero/One: it adds light, never darkens, and leaves the layer's alpha alone in AR),
// depth-tested, writing no depth. At most 16,384 vertices a frame: past it, the oldest samples of the longest trails go
// first (counted). A trail jumps (no line across) where its item jumps more than 1 m in a frame or is hidden.
const TRAIL_MAX = 16384, TRAIL_DT = 1 / 60, TRAIL_STEP = 0.02, TRAIL_JUMP = 1, TRAIL_KINDS = ['o', 'p', 'e', 's'];
const TRAIL_LENS = [0.5, 1, 2, 3, 5, 7.5, 10], TRAIL_WS = [0.005, 0.01, 0.02, 0.03, 0.05, 0.075, 0.1];
const TRAIL_COL = { o: '#46d9ff', e: '#ffb43b', s: '#3ee08f' };   // (the kind's own colour; a shape takes its own)
// the trails here: key ('i:<id>', 'h:<member>:l') -> { pts: [{ x, y, z, t, s }] (oldest first; s: its stretch, a jump
// starts another), seg, last: [x, y, z] (last frame's place), col, len, w, head: { x, y, z } | null, seen }
const TRL = { map: new Map(), mesh: null, geo: null, cap: TRAIL_MAX, dropped: 0, verts: 0, items: 0, hands: 0, fake: null };
let trailClock = () => performance.now();

// ---------------------------------------------------------------- the record --
// a trail as a record keeps it: len and w always (rounded, held at their limits), col only when set (lower case); null a bad
// one (not an object, a length or a width that is not a number, a colour that is not #rrggbb)
function normTrail(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const has = k => x[k] !== undefined && x[k] !== null;
  if ((has('len') && !fin(x.len)) || (has('w') && !fin(x.w)) || (has('col') && !(typeof x.col === 'string' && /^#[0-9a-f]{6}$/i.test(x.col)))) return null;
  const r = { len: has('len') ? r2(clamp(x.len, 0.5, 10)) : 3, w: has('w') ? r3(clamp(x.w, 0.005, 0.1)) : 0.02 };
  if (has('col')) r.col = x.col.toLowerCase();
  return r;
}
// a given record's trail: kept when given (undefined: none); null a bad one
const trailKeep = x => (x == null ? undefined : normTrail(x));
// the hands' setting as the scene's settings keep it: { len, w } (undefined: off; null: bad)
function normHands(x) {
  if (x == null || x === false) return undefined;
  if (x === true) return { len: 3, w: 0.02 };
  const t = normTrail(x);
  return t && x.col === undefined ? { len: t.len, w: t.w } : null;
}

// --------------------------------------------------------------- every frame --
const _tv = new THREE.Vector3(), _tm = new THREE.Matrix4();
function trailBuild() {
  const g = TRL.geo = new THREE.BufferGeometry(), n = TRAIL_MAX;
  const side = new Float32Array(n);
  for (let i = 0; i < n; i++) side[i] = i % 2 ? 1 : -1;
  const dyn = (a, k) => { const b = new THREE.BufferAttribute(a, k); b.setUsage(THREE.DynamicDrawUsage); return b; };
  g.setAttribute('position', dyn(new Float32Array(n * 3), 3));
  g.setAttribute('aDir', dyn(new Float32Array(n * 3), 3));
  g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  g.setAttribute('aW', dyn(new Float32Array(n), 1));
  g.setAttribute('color', dyn(new Float32Array(n * 3), 3));
  g.setIndex(dyn(new Uint16Array((n / 2) * 6), 1));
  g.setDrawRange(0, 0);
  const m = new THREE.ShaderMaterial({
    vertexShader: `attribute vec3 aDir; attribute float aSide; attribute float aW; attribute vec3 color; varying vec3 vC;
      void main() {
        vC = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 t = (modelViewMatrix * vec4(aDir, 0.0)).xyz, v = normalize(-mv.xyz), n = cross(t, v);
        float l = length(n);
        n = l > 1e-6 ? n / l : vec3(0.0, 1.0, 0.0);
        mv.xyz += n * aSide * aW;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec3 vC; void main() { gl_FragColor = vec4(vC, 1.0); }`,
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  const mesh = TRL.mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false; mesh.renderOrder = 8; mesh.visible = false; mesh.name = 'trails';
  mesh.raycast = () => {};   // (never pointed at)
  GL.items.add(mesh);
}
// a trail's state, made as needed
function trailOf(key, col, len, w) {
  let T = TRL.map.get(key);
  if (!T) { T = { pts: [], seg: 0, last: null, col: new THREE.Color(), len, w, head: null, seen: 0 }; TRL.map.set(key, T); }
  T.col.set(col); T.len = len; T.w = w; T.seen = TRL.gen;
  return T;
}
// where it is now (p, the scene's frame), or null (hidden: the trail breaks): a sample when 1/60 s has passed since the last
// and it moved 2 cm (or a quarter second went by); a jump of more than 1 m in a frame breaks it
function trailFeed(T, p, t) {
  if (!p) { T.head = null; T.last = null; T.seg++; return; }
  if (T.last && Math.hypot(p.x - T.last[0], p.y - T.last[1], p.z - T.last[2]) > TRAIL_JUMP) T.seg++;
  T.last = [p.x, p.y, p.z];
  const L = T.pts[T.pts.length - 1];
  const fresh = !L || L.s !== T.seg;
  const take = fresh || (t - L.t >= TRAIL_DT * 1000 - 2 && (Math.hypot(p.x - L.x, p.y - L.y, p.z - L.z) >= TRAIL_STEP || t - L.t >= 250));
  if (take) T.pts.push({ x: p.x, y: p.y, z: p.z, t, s: T.seg });
  T.head = take ? null : { x: p.x, y: p.y, z: p.z, t, s: T.seg };   // (where it is now, between samples)
}
// the hands to trail now: [key, colour, p] (the scene's frame): the people in a headset at this circle (their presence,
// in room coordinates, which are the scene's at a station) and this device's own controllers in its session
function trailHands(out) {
  const sid = stationId();
  let L = null;
  try { L = sid && HOST.collab && HOST.collab.persons ? HOST.collab.persons() : null; } catch (e) { L = null; }
  if (Array.isArray(L)) for (const P of L) {
    if (!P || P.st !== sid || !P.body || !Array.isArray(P.body.hands)) continue;
    P.body.hands.forEach((h, i) => { if (Array.isArray(h) && h.length >= 3 && h.slice(0, 3).every(fin)) out.push(['h:' + P.id + ':' + 'lr'[i], cssHex(P.color), new THREE.Vector3(h[0], h[1], h[2])]); });
  }
  if (Array.isArray(TRL.fake)) for (const f of TRL.fake) out.push(['h:' + f.id + ':' + f.hand, cssHex(f.color), new THREE.Vector3().fromArray(f.p)]);
  if (XR.on && GL.renderer.xr.isPresenting) {
    let me = '#46d9ff';
    try { if (HOST.collab && HOST.collab.color) me = cssHex(HOST.collab.color); } catch (e) { /* not in a room */ }
    _tm.copy(GL.items.matrixWorld).invert();
    for (const c of XR.ctrls) {
      if (!c.src || !c.g || !(c.src.handedness === 'left' || c.src.handedness === 'right')) continue;
      out.push(['h:me:' + c.src.handedness[0], me, new THREE.Vector3().setFromMatrixPosition(c.g.matrixWorld).applyMatrix4(_tm)]);
    }
  }
  return out;
}
const cssHex = c => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : '#46d9ff');
function trailStep() {
  const S = STU.settings, now = trailClock();
  TRL.gen = (TRL.gen || 0) + 1;
  let any = false;
  const away = !STU.scene || GL.gone || xrAway() || XR.stories;
  if (!away) {
    GL.items.updateWorldMatrix(true, false);
    for (const it of STU.items.values()) {
      const tr = TRAIL_KINDS.includes(it.kind) && it.rec.trail;
      if (!tr) continue;
      any = true;
      const T = trailOf('i:' + it.id, tr.col || (it.kind === 'p' ? it.rec.colour : TRAIL_COL[it.kind]), tr.len, tr.w);
      const vis = it.shown && !it.notHere && it.holder;
      trailFeed(T, vis ? itemTopInto(it, _tv, true) : null, now);
    }
    if (S.hands) for (const [k, col, p] of trailHands([])) { any = true; trailFeed(trailOf(k, col, S.hands.len, S.hands.w), p, now); }
  }
  // (trails no longer asked for go; those that are fade out with age)
  for (const [k, T] of TRL.map) {
    if (T.seen !== TRL.gen) { T.head = null; T.last = null; }
    const old = now - T.len * 1000;
    while (T.pts.length && T.pts[0].t < old) T.pts.shift();
    if (!T.pts.length && T.seen !== TRL.gen) TRL.map.delete(k);
  }
  if (!any && !TRL.map.size) { if (TRL.mesh) TRL.mesh.visible = false; TRL.verts = TRL.items = TRL.hands = 0; return; }
  trailDraw(now);
}
// the cap: while the trails' vertices pass it, the oldest samples of the longest trail go (counted)
function trailCapNow() {
  const L = [...TRL.map.values()];
  const n = T => T.pts.length + (T.head ? 1 : 0);
  let total = L.reduce((a, T) => a + n(T) * 2, 0);
  while (total > TRL.cap) {
    let A = null, B = 0;
    for (const T of L) { const k = n(T); if (!A || k > n(A)) { if (A) B = Math.max(B, n(A)); A = T; } else B = Math.max(B, k); }
    if (!A || !A.pts.length) break;
    const cut = Math.min(A.pts.length, Math.max(1, Math.min(Math.ceil((total - TRL.cap) / 2), n(A) - B)));
    A.pts.splice(0, cut); TRL.dropped += cut; total -= cut * 2;
  }
}
function trailDraw(now) {
  if (!TRL.mesh) trailBuild();
  trailCapNow();
  const g = TRL.geo, P = g.attributes.position.array, D = g.attributes.aDir.array, W = g.attributes.aW.array, C = g.attributes.color.array, I = g.index.array;
  let v = 0, ix = 0, items = 0, hands = 0;
  for (const [k, T] of TRL.map) {
    const pts = T.head && (!T.pts.length || T.pts[T.pts.length - 1] !== T.head) ? T.pts.concat([T.head]) : T.pts;
    if (pts.length < 2) continue;
    if (k[0] === 'i') items++; else hands++;
    const hw = T.w / 2, r = T.col.r, gg = T.col.g, b = T.col.b;
    for (let i = 0; i < pts.length; i++) {
      if (v + 2 > TRL.cap) break;
      const p = pts[i], a = pts[i > 0 && pts[i - 1].s === p.s ? i - 1 : i], c = pts[i + 1 < pts.length && pts[i + 1].s === p.s ? i + 1 : i];
      const age = clamp(1 - (now - p.t) / (T.len * 1000), 0, 1), f = age * age;
      for (let s = 0; s < 2; s++) {
        const j = v + s;
        P[j * 3] = p.x; P[j * 3 + 1] = p.y; P[j * 3 + 2] = p.z;
        D[j * 3] = c.x - a.x; D[j * 3 + 1] = c.y - a.y; D[j * 3 + 2] = c.z - a.z;
        W[j] = hw; C[j * 3] = r * f; C[j * 3 + 1] = gg * f; C[j * 3 + 2] = b * f;
      }
      if (i > 0 && pts[i - 1].s === p.s && v >= 2) { I[ix++] = v - 2; I[ix++] = v - 1; I[ix++] = v; I[ix++] = v - 1; I[ix++] = v + 1; I[ix++] = v; }
      v += 2;
    }
  }
  TRL.verts = v; TRL.items = items; TRL.hands = hands;
  for (const k of ['position', 'aDir', 'aW', 'color']) { const A = g.attributes[k]; A.updateRange.offset = 0; A.updateRange.count = v * A.itemSize; A.needsUpdate = true; }
  g.index.updateRange.offset = 0; g.index.updateRange.count = ix; g.index.needsUpdate = true;
  g.setDrawRange(0, ix);
  TRL.mesh.visible = ix > 0;
}
// gone with the studio (dispose) or the scene (another opened)
function trailClear() { TRL.map.clear(); if (TRL.mesh) { TRL.mesh.visible = false; TRL.geo.setDrawRange(0, 0); } }

// -------------------------------------------------------------------- the card --
// Trail: Off / On, its length and width (− / +) and its colour (the kind's own, or the shapes' ten); one Undo step each,
// for everyone at the circle. Not refused by a lock in place (a look, as a tint)
function trailBlocks(it, B) {
  if (!TRAIL_KINDS.includes(it.kind) || !editOn()) return;
  const t = it.rec.trail, own = it.kind === 'p' ? it.rec.colour : TRAIL_COL[it.kind];
  B.push({ label: 'Trail' + (t ? `: ${t.len} s, ${Math.round(t.w * 1000)} mm` : ''), row: [{ id: 'trail:off', label: 'Off', act: 'i:trail', v: 'off', on: !t }, { id: 'trail:on', label: 'On', act: 'i:trail', v: 'on', on: !!t }] });
  if (!t) { B.push({ p: 'A trail of light behind it as it moves, which everyone at this circle sees.', c: 'faint' }); return; }
  B.push({ label: `Length: ${t.len} s`, row: [{ id: 'trlen:-', label: '−', act: 'i:trailLen', v: -1, dis: t.len <= TRAIL_LENS[0] }, { id: 'trlen:+', label: '+', act: 'i:trailLen', v: 1, dis: t.len >= 10 }] },
    { label: `Width: ${Math.round(t.w * 1000)} mm`, row: [{ id: 'trw:-', label: '−', act: 'i:trailW', v: -1, dis: t.w <= TRAIL_WS[0] }, { id: 'trw:+', label: '+', act: 'i:trailW', v: 1, dis: t.w >= 0.1 }] },
    { label: 'Trail colour', row: [{ id: 'trcol:own', label: 'Its own', act: 'i:trailCol', v: '', on: !t.col, sw: own }].concat(SHAPE_COLS.map(([c, n]) => ({ id: 'trcol:' + c, label: n, act: 'i:trailCol', v: c, on: t.col === c, sw: c }))) });
}
// the next step up or down a ladder from x
const ladder = (L, x, d) => (d > 0 ? L.find(v => v > x + 1e-9) || L[L.length - 1] : [...L].reverse().find(v => v < x - 1e-9) || L[0]);
Object.assign(ITEM_ACT, {
  trail: (it, v) => { if (TRAIL_KINDS.includes(it.kind)) setRec(it.id, { trail: v === 'on' ? (it.rec.trail || { len: 3, w: 0.02 }) : undefined }); },
  trailLen: (it, d) => { const t = it.rec.trail; if (t) setRec(it.id, { trail: Object.assign({}, t, { len: ladder(TRAIL_LENS, t.len, +d) }) }); },
  trailW: (it, d) => { const t = it.rec.trail; if (t) setRec(it.id, { trail: Object.assign({}, t, { w: ladder(TRAIL_WS, t.w, +d) }) }); },
  trailCol: (it, v) => {
    const t = it.rec.trail;
    if (!t || (v && !/^#[0-9a-f]{6}$/.test(v))) return;
    const n = Object.assign({}, t); if (v) n.col = v; else delete n.col;
    setRec(it.id, { trail: n });
  },
});
// the Scene pane's row (while editing): Hand trails: Off / On, length, width (the scene's setting, one Undo step)
function handsBlocks(B, who) {
  const H = STU.settings.hands;
  B.push({ label: 'Hand trails' + who, row: [{ id: 'set:hands:off', label: 'Off', act: 'setting', v: 'hands:off', on: !H }, { id: 'set:hands:on', label: 'On', act: 'setting', v: 'hands:on', on: !!H }] });
  if (H) B.push({ label: `Hand trails: ${H.len} s`, row: [{ id: 'set:hands:len:-', label: '−', act: 'setting', v: 'hands:len:-1', dis: H.len <= TRAIL_LENS[0] }, { id: 'set:hands:len:+', label: '+', act: 'setting', v: 'hands:len:1', dis: H.len >= 10 }] },
    { label: `Hand trails: ${Math.round(H.w * 1000)} mm wide`, row: [{ id: 'set:hands:w:-', label: '−', act: 'setting', v: 'hands:w:-1', dis: H.w <= TRAIL_WS[0] }, { id: 'set:hands:w:+', label: '+', act: 'setting', v: 'hands:w:1', dis: H.w >= 0.1 }] });
  B.push({ p: 'On: each person in a headset at this circle leaves a trail of light from each hand, in their colour. Saved with the scene.', c: 'faint' });
}
// a Hand trails press ('hands:on', 'hands:off', 'hands:len:-1', 'hands:w:1'): the settings it gives (setSetting)
function handsSetting(v) {
  const p = String(v).split(':'), H = STU.settings.hands, S = Object.assign({}, STU.settings);
  if (p[1] === 'off') delete S.hands;
  else if (p[1] === 'on') S.hands = H || { len: 3, w: 0.02 };
  else if (H && (p[1] === 'len' || p[1] === 'w')) S.hands = Object.assign({}, H, { [p[1]]: ladder(p[1] === 'len' ? TRAIL_LENS : TRAIL_WS, H[p[1]], +p[2]) });
  else return null;
  return normSettings(S);
}
// for tests: STUDIO.trails() ({ items, hands, verts, dropped }: the trails drawn this frame, their vertices, the samples the
// cap dropped), STUDIO.trailCap(n) (the cap, null the default), STUDIO.trailFake([{ id, hand, color, p }]) (pretend hands),
// and the clock (STUDIO.trailClock, ms)
const trailState = () => ({ items: TRL.items, hands: TRL.hands, verts: TRL.verts, dropped: TRL.dropped, map: [...TRL.map].map(([k, T]) => [k, T.pts.length, T.head ? 1 : 0]) });
