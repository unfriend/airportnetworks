// ================================================================= PUPPET ==
// Phase 3 of the trackers (tools/trackers/SPEC.md, "The studio, phase 3: a Mixamo character worn with trackers"; the
// owner, 8 November 2026: "we go for 1 and 3 with mixamo rigs for now"): an object whose model is rigged by Mixamo may be
// worn by a performer, its bones solved every frame by the solver (ik.js, makeIK) from the PC's trackers, on every device
// alike (nothing per bone is sent: the same tracker stream and the same record give the same pose).
//
// Worn with any mix of devices (v201; the owner, 25 November 2026: each device attached to the bone it is nearest to, any
// mix of devices, the figure stepped into): the PC's trackers (up to 11: head, chest, hips, hands, elbows, knees, feet), a
// headset and its controllers or tracked hands, from the PC's Index (by 'index': its headset and controllers come with the
// trackers, kinds 'h', 'l' and 'r') or the performer's own headset (by: their member id; this device's own poses when it is
// the performer, else HOST.collab.body(by), their presence's head and hands), or none (trackers only). Whatever part has a
// device follows it; ik.js works out the rest (the hips under the head, the spine, natural elbows and knees, feet that step
// by themselves, hands that hang). Records lined up before v201 ('full', 'feet') are worn as they were.
// The object's record gains puppet: { on, rig: 'any' (or an older 'full' | 'feet'), by, map: { slot: <a tracker's id, or
// '@head', '@l', '@r' for the performer's own headset> }, cal: { slot: [x, y, z, qx, qy, qz, qw] }, s, floor }, kept only
// when set: which device drives which part, each part's offset from its device to its bone found at the lining up, the
// object's scale then and the floor's height (the scene's: 0). Line up with the performer (its card): the character stands
// in its T-pose and the performer copies it, facing its way: in a headset they step into it (sized at once so its eyes are
// as high as the headset), with none it comes to them after a 5 s countdown (ik.js's fit: moved along the floor and sized);
// then every device is tied to the part it is nearest to (ik.js's match) and shown, a line from each to its part and the
// list on the card, to be changed there or taken: each part's offset taken, its place and size with it, one change, one
// Undo step.
// While it is on and lined up its own clip is off and its bones are solved (the parts the solver knows; fingers keep their
// rest pose); not solvable now (the head and hips never seen here), it stands at rest and the card says why. Its holder
// stays where it is placed (the pointer finds it there, a ghost shows it while editing): the solver puts the bones where
// the devices are.
//
// Record a take (its card): a 3 s countdown, then the solved bones sampled 30 times a second on the room's clock until Stop
// (at most 120 s), made into a clip (Take n) and the object's GLB made again with its clips and the new one through the
// converter (convertFile with take: with a relay that takes uploads into models/, the old file kept under originals/ when
// it was already there, every object of that file switched, a new picture; else downloaded). The take then plays as any
// clip (the card's Animation row, with wearing off).
const IK = makeIK(THREE);
const PUP_RIGS = ['full', 'feet', 'any'];   // ('any' since v201: what a lining up makes; 'full' and 'feet', older records', still worn as they were)
const PUP_SLOTS = ['hips', 'head', 'chest', 'lhand', 'rhand', 'lfoot', 'rfoot', 'lelbow', 'relbow', 'lknee', 'rknee'];
const PUP_WORD = { hips: 'Hips', head: 'Head', chest: 'Chest', lhand: 'Left hand', rhand: 'Right hand', lfoot: 'Left foot', rfoot: 'Right foot', lelbow: 'Left elbow', relbow: 'Right elbow', lknee: 'Left knee', rknee: 'Right knee' };
const PUP_RIG_WORD = { full: 'whole body, lined up before v201', feet: 'feet and headset, lined up before v201', any: 'any mix of devices' };
const PUP_PART = { hips: 'hips', head: 'head', chest: 'chest', lhand: 'lhand', rhand: 'rhand', lfoot: 'lfoot', rfoot: 'rfoot', lelbow: 'lfore', relbow: 'rfore', lknee: 'lleg', rknee: 'rleg' };   // (the bone each part is lined up with: ik.js's)
const PUP_BODY = /^@(head|l|r)$/;   // (the performer's own headset's head and hands)
const PUP_COUNT = 5000, TAKE_COUNT = 3000, TAKE_FPS = 30, TAKE_MAX = 120;
const r5 = v => Math.round(v * 1e5) / 1e5;
// a puppet as a record keeps it (null: bad, which makes the record bad): on (false when left out), its rig ('full' when left
// out), by ('' none), map (each slot a tracker's id or one of the headset's), cal (seven numbers a slot: a place within 100 m
// to 0.1 mm, a turn to 5 decimals; an offset for a slot nothing drives dropped), s (the object's scale then, 4 significant
// figures) and floor (m), each kept only when set
function normPuppet(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const has = k => x[k] !== undefined && x[k] !== null;
  if (has('on') && typeof x.on !== 'boolean') return null;
  const rig = has('rig') ? x.rig : 'full';
  if (!PUP_RIGS.includes(rig)) return null;
  const r = { on: !!x.on, rig };
  if (has('by')) {
    if (typeof x.by !== 'string' || !(x.by === '' || /^[A-Za-z0-9_-]{1,40}$/.test(x.by))) return null;
    if (x.by) r.by = x.by;
  }
  if (has('map')) {
    if (typeof x.map !== 'object' || Array.isArray(x.map)) return null;
    const m = {};
    for (const s of PUP_SLOTS) {
      const v = x.map[s];
      if (v === undefined) continue;
      if (typeof v !== 'string' || !(TRK_ID.test(v) || PUP_BODY.test(v))) return null;
      m[s] = v;
    }
    if (Object.keys(m).length) r.map = m;
  }
  if (has('cal')) {
    if (typeof x.cal !== 'object' || Array.isArray(x.cal)) return null;
    const c = {};
    for (const s of PUP_SLOTS) {
      const v = x.cal[s];
      if (v === undefined) continue;
      const a = vecOf(v, 7, 100);
      if (!a || Math.hypot(a[3], a[4], a[5], a[6]) < 1e-6) return null;
      if (r.map && r.map[s]) c[s] = a.map((n, i) => nz(i < 3 ? r4(n) : r5(n)));
    }
    if (Object.keys(c).length) r.cal = c;
  }
  if (has('s')) { if (!(fin(x.s) && x.s > 0)) return null; r.s = +Math.min(1e4, Math.max(1e-4, x.s)).toPrecision(4); }
  if (has('floor')) { if (!fin(x.floor) || Math.abs(x.floor) > 1000) return null; r.floor = nz(r4(x.floor)); }
  return r;
}
// lined up: every part its way of wearing needs has a tracker and an offset
// ('any': the head or the hips at least)
const pupReady = P => !!(P && P.map && P.cal && (P.rig === 'any' ? ['head', 'hips'].some(s => P.map[s] && P.cal[s]) : IK.SETUPS[P.rig].need.every(s => P.map[s] && P.cal[s])));

// ------------------------------------------------------------- the rig --
// its bones by Mixamo's names (ik.js's rigOf), found once per model built, at its rest pose (as loaded), or why not
function pupRest(it) { if (it.model) for (const [n, p, q, s] of it.model.rest) { n.position.copy(p); n.quaternion.copy(q); n.scale.copy(s); } }
function pupRig(it) {
  if (!it || it.kind !== 'o' || !it.model) return null;
  if (it.rigFor !== it.model) {
    const was = it.model.rest.map(([n]) => [n, n.position.clone(), n.quaternion.clone(), n.scale.clone()]);
    pupRest(it);
    it.rig = IK.rigOf(it.model.o); it.rigFor = it.model; it.pst = {}; it.pstRec = null; it.pupOn = false;
    for (const [n, p, q, s] of was) { n.position.copy(p); n.quaternion.copy(q); n.scale.copy(s); }   // (its pose as it was)
  }
  return it.rig;
}

// ------------------------------------------------------------ the poses --
// the scene's frame in the world, where the solver works (GL.items; life size: its scale 1 in practice)
const _pw = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
function pupW() { GL.items.updateWorldMatrix(true, false); GL.items.matrixWorld.decompose(_pw.p, _pw.q, _pw.s); return _pw; }
const _pp1 = new THREE.Vector3(), _pq1 = new THREE.Quaternion(), _pS = new THREE.Vector3();
const worldPose = (P, Q, W) => ({ p: P.clone().multiplyScalar(W.s.x).applyQuaternion(W.q).add(W.p).toArray(), q: W.q.clone().multiply(Q).toArray() });
// a pose given as { p, q } (arrays or three.js's) or as seven numbers, into P and Q
function poseIn(v, P, Q) {
  if (!v) return false;
  let p = null, q = null;
  if (Array.isArray(v)) { if (v.length >= 7) { p = v.slice(0, 3); q = v.slice(3, 7); } }
  else if (typeof v === 'object') { p = trkArr(v.p, 3); q = trkArr(v.q, 4); }
  if (!p || !q || !p.concat(q).every(fin) || Math.hypot(...q) < 1e-6) return false;
  P.fromArray(p); Q.fromArray(q).normalize();
  return true;
}
// the performer's own headset's head or a hand (part 'head', 'l', 'r') in the scene's frame: this device's own when it is
// the performer, in its session (its head, and the controller in that hand: its ray's pose), else the shell's word for it
// (HOST.collab.body(by): their presence, in room coordinates, which are the scene's at a station)
function bodyPose(by, part, P, Q) {
  if (!by || by === 'index') return false;
  let me = '';
  try { me = (HOST.collab && HOST.collab.id) || ''; } catch (e) { me = ''; }
  if (by === me && XR.on && GL.renderer.xr.isPresenting) {
    if (part === 'head') { P.copy(XR.head); Q.copy(XR.headQ); }
    else {
      const c = XR.ctrls.find(x => x.src && x.src.handedness === (part === 'l' ? 'left' : 'right'));
      if (!c) return false;
      c.g.matrix.decompose(P, Q, _pS);
    }
    const W = pupW(), iq = W.q.clone().invert();
    P.sub(W.p).applyQuaternion(iq).divideScalar(W.s.x); Q.premultiply(iq);
    return true;
  }
  let B = null;
  try { B = HOST.collab && HOST.collab.body ? HOST.collab.body(by) : null; } catch (e) { B = null; }
  if (!B || typeof B !== 'object') return false;
  const hands = Array.isArray(B.hands) ? B.hands : [];
  return poseIn(part === 'head' ? B.head : part === 'l' ? B.l || B.lhand || B.left || hands[0] : B.r || B.rhand || B.right || hands[1], P, Q);
}
// the targets of a map now, in the world: { id: { p, q } } (a tracker not seen: its last pose; never seen here: none)
function pupTargets(by, map, W) {
  const out = {};
  for (const id of Object.values(map || {})) {
    if (out[id]) continue;
    const ok = PUP_BODY.test(id) ? bodyPose(by, id.slice(1), _pp1, _pq1) : trkPose(id, _pp1, _pq1);
    if (ok) out[id] = worldPose(_pp1, _pq1, W);
  }
  return out;
}
const pupCal = (P, W) => ({ ok: true, setup: P.rig, map: P.map, cal: P.cal, floor: (P.floor || 0) * W.s.x + W.p.y });
// the room's clock (s): at a station the relay's, so a take's times are the tracker stream's; else this page's
function pupClock() {
  try { if (atStation() && HOST.collab.now) return HOST.collab.now() / 1000; } catch (e) { /* not in a room */ }
  return performance.now() / 1000;
}

// ---------------------------------------------------------- every frame --
// in place of its animation (itemsStep): on and lined up, its bones solved from the trackers (true: its own clip off); else
// false, and its clip plays as ever
function pupStep(it, now, dt) {
  // (lining up: it stands at rest, in its T-pose, for the performer to copy; its clip off)
  if (PUP.line && PUP.line.id === it.id && it.rec.puppet && pupRig(it) && it.rig.ok) {
    if (!it.pupOn) { if (it.mixer) it.mixer.stopAllAction(); it.action = null; it.animKey = ''; it.tl = null; it.pupOn = true; }
    pupRest(it); it.pst = {}; it.pstRec = null; it.pupWhy = '';
    return true;
  }
  const P = it.rec.puppet, rig = P && P.on && pupReady(P) ? pupRig(it) : null;
  if (!rig || !rig.ok) { if (it.pupOn) pupOff(it); it.pupWhy = rig ? rig.why : ''; return false; }
  if (!it.pupOn) { if (it.mixer) it.mixer.stopAllAction(); it.action = null; it.animKey = ''; it.tl = null; pupRest(it); it.pupOn = true; it.pst = {}; it.pstRec = null; }   // (a cube's clips on it too: none while worn, e6n_plays.js)
  if (motionsPaused()) return true;   // (Pause: it holds the pose it shows, as the models' animations hold their frame)
  if (it.pstRec !== P) { it.pstRec = P; it.pst = {}; }   // (a new record: the solve starts afresh)
  const W = pupW(), r = IK.solve(rig, pupCal(P, W), pupTargets(P.by, P.map, W), dt, it.pst);
  it.pupWhy = r.ok ? '' : r.why;
  if (!r.ok) rig.toRest();
  if (PUP.take && PUP.take.id === it.id) takeStep(rig, r.ok);
  return true;
}
// worn no more: its clip again (animStep starts it afresh), from its rest pose
function pupOff(it) { it.pupOn = false; it.animKey = ''; it.pupWhy = ''; pupRest(it); }

// ------------------------------------------------------------ lining up --
// (v201, the owner, 25 November 2026: each device attached to the bone it is nearest to, any mix of devices, the figure
// stepped into.) PUP.line: a lining up ({ id, phase: 'count' (counting down, at: performance.now() when it is done) or
// 'check' (the matches shown, waiting to be taken or changed), keep: the parts as they are, head: the performer wears a
// headset (the character sized by it and stepped into), p and s: where it stands and its size while lining up (shown,
// not yet its record's), p0 and s0: its holder's as they were, T: the devices' poses at the countdown's end (the world),
// m: ik.js's match there (at: each part's point), map: the matches as they stand (changed on the card) });
// PUP.take: a take ({ id, phase: 'count' | 'rec' | 'make', at, t0, next, samples, name }); the last word on an item's
// lining up or take (note, noteC, noteId); sec: the countdown's second shown
const PUP = { line: null, take: null, note: '', noteC: 'muted', noteId: '', sec: -1 };
const pupSay = (id, s, c) => { PUP.note = s; PUP.noteC = c || 'muted'; PUP.noteId = id; dirty(true); };
// every frame (trkStep): the countdowns, the card redrawn each second, the character shown where and as big as the lining
// up has it, the lines
function pupTick(pn) {
  const L = PUP.line, T = PUP.take;
  const sec = L && L.phase === 'count' ? Math.ceil((L.at - pn) / 1000) : T && T.phase === 'count' ? Math.ceil((T.at - pn) / 1000) : T && T.phase === 'rec' ? Math.floor(pupClock() - T.t0) : -1;
  if (sec !== PUP.sec) { PUP.sec = sec; dirty(); }
  if (L) {
    const it = STU.items.get(L.id);
    if (!it || !it.rec.puppet) { PUP.line = null; pupLook(); }
    else if (!editOn() || lockWhy(it)) { pupEnd(it); pupSay(it.id, !editOn() ? 'Editing is off: not lined up.' : `${it.rec.name} is locked in place: not lined up.`, 'red'); }
    else {
      pupShow(it, L);
      if (L.phase === 'count' && pn >= L.at) {
        const why = !editOn() ? 'Editing is off: not lined up.' : lockWhy(it) ? `${it.rec.name} is locked in place: not lined up.` : pupCheck(it, L);
        if (why) { pupEnd(it); pupSay(it.id, why, 'red'); sfxAct('knock', 'world', null); } else sfxAct('ping', 'world', null);
      }
    }
  }
  if (GL.pupLines) GL.pupLines.visible = !!(PUP.line && PUP.line.phase === 'check' && editOn());
  if (GL.pupTags) GL.pupTags.forEach((t, i) => { t.visible = GL.pupLines.visible && i < GL.pupN; });
  if (T && T.phase === 'count' && pn >= T.at) { T.phase = 'rec'; T.t0 = pupClock(); T.next = 0; dirty(true); }
}
// every device here now, in the world: the PC's trackers, the PC's Index and its controllers (by 'index'), the
// performer's own headset and hands (by a member: '@head', '@l', '@r', their controllers or tracked wrists)
function pupDevices(by, W) {
  const out = {};
  for (const x of TRK.at.values()) {
    if (!x.ok || !x.p || !(x.k === 't' || (by === 'index' && (x.k === 'h' || x.k === 'l' || x.k === 'r')))) continue;
    out[x.id] = worldPose(_pp1.fromArray(x.p), _pq1.fromArray(x.q), W);
  }
  if (by && by !== 'index') for (const k of ['head', 'l', 'r']) if (bodyPose(by, k, _pp1, _pq1)) out['@' + k] = worldPose(_pp1, _pq1, W);
  return out;
}
// the headset among them ('' none)
const pupHmd = (by, D) => (by === 'index' ? Object.keys(D).find(id => (TRK.at.get(id) || {}).k === 'h') || '' : D['@head'] ? '@head' : '');
// Line up with the performer (its card): the character stands at rest, in its T-pose, for the performer to copy. A
// performer in a headset: the character sized at once so its eyes are as high as the headset's, where it stands, for them
// to step into it. A 5 s countdown either way
function pupLineStart(it, keep) {
  const P = it.rec.puppet, rig = P && pupRig(it);
  if (!P || !STU.items.has(it.id) || !rig || !rig.ok) return;
  if (PUP.line) pupEnd(STU.items.get(PUP.line.id));
  pupRest(it); poseRest(it); it.holder.updateMatrixWorld(true);
  const W = pupW(), D = pupDevices(P.by, W), hmd = pupHmd(P.by, D);
  const L = { id: it.id, phase: 'count', at: performance.now() + PUP_COUNT, keep: !!keep && !!P.map, head: !!hmd, p: it.rec.p.slice(), s: it.rec.s, p0: it.holder.position.clone(), s0: it.holder.scale.clone() };
  if (hmd) {
    const h = D[hmd].p[1] - W.p.y, e = IK.restPose(rig, 'eye').p.y - W.p.y;
    if (h < 0.6 || h > 2.3) { pupSay(it.id, `Stand up straight in the headset: it is ${h.toFixed(2)} m over the floor.`, 'red'); return; }
    if (e > 1e-3) L.s = +Math.min(1e4, Math.max(1e-4, it.rec.s * h / e)).toPrecision(4);
  }
  PUP.line = L;
  pupShow(it, L);
  pupSay(it.id, '', 'muted');
}
// (the character drawn where and as big as the lining up has it, not yet its record's)
function pupShow(it, L) {
  const H = it.holder;
  H.position.fromArray(L.p); H.scale.setScalar(L.s); H.updateMatrixWorld(true);
}
// the lining up ended (taken, cancelled, refused): the character as its record has it, the lines gone
function pupEnd(it) {
  const L = PUP.line;
  PUP.line = null; STU.pupSlot = '';
  if (it && L && L.id === it.id) { it.holder.position.copy(L.p0); it.holder.scale.copy(L.s0); it.holder.updateMatrixWorld(true); }
  pupLook();
}
// the countdown's end: the devices' poses taken; with no headset the character moved along the floor and sized to stand in
// the performer (ik.js's fit); then each device tied to the part it is nearest to (match; 'Line up again, these parts':
// the parts as they are, for the devices seen). '' (the matches shown) or why not, in words
function pupCheck(it, L) {
  const P = it.rec.puppet, rig = pupRig(it);
  if (!rig || !rig.ok) return rig ? rig.why : 'Its model is not here yet.';
  pupRest(it); poseRest(it); pupShow(it, L);
  const W = pupW(), floor = W.p.y, T = pupDevices(P.by, W);
  if (!Object.keys(T).length) return 'Nothing is seen: no tracker here, and no headset (choose where a headset comes from).';
  if (!L.head) {
    const f = IK.fit(rig, T, { floor, origin: it.holder.getWorldPosition(new THREE.Vector3()) });
    if (!f.k) return f.why;
    const d = new THREE.Vector3().fromArray(f.t).applyQuaternion(W.q.clone().invert()).divideScalar(W.s.x);
    L.p = it.holder.position.clone().add(d).toArray().map(v => nz(r3(clamp(v, -1000, 1000))));
    L.s = +Math.min(1e4, Math.max(1e-4, L.s * f.k)).toPrecision(4);
    pupShow(it, L);
  }
  const m = IK.match(rig, T, { floor });
  L.T = T; L.m = m; L.phase = 'check';
  L.map = {};
  if (L.keep) { for (const s of PUP_SLOTS) if (P.map[s] && T[P.map[s]]) L.map[s] = P.map[s]; } else Object.assign(L.map, m.map);
  pupLook();
  pupSay(it.id, '', 'muted');
  return '';
}
// the matches taken (its card: Take these): each part's offset from its device (calibrate), its place and size, worn by
// 'any': one change, one Undo step. '' or why not
function pupTake(it) {
  const L = PUP.line, P = it.rec.puppet, rig = pupRig(it);
  if (!L || L.id !== it.id || L.phase !== 'check' || !P) return 'Nothing to take: line up first.';
  if (!rig || !rig.ok) return rig ? rig.why : 'Its model is not here yet.';
  pupRest(it); poseRest(it); pupShow(it, L);
  const c = IK.calibrate(rig, L.T, L.map, 'any', { floor: pupW().p.y, scale: false });
  pupEnd(it);
  if (!c.ok) return c.why;
  setRec(it.id, { p: L.p, s: L.s, puppet: Object.assign({}, P, { on: true, rig: 'any', map: c.map, cal: c.cal, s: L.s, floor: 0 }) });
  return '';
}
// the lines while the matches are shown (editing): from each device to the part it is tied to (green; the part chosen on
// the card blue), a small cross at each device (amber where it is left out), and a tag on each naming its part. Opaque
// lines and tags, over everything, as editing draws (v131)
const PUP_LINE = [0.24, 0.88, 0.56], PUP_PICK = [0.27, 0.85, 1], PUP_OUT = [1, 0.76, 0.29];
function pupLook() {
  const L = PUP.line && PUP.line.phase === 'check' ? PUP.line : null;
  if (!L && !GL.pupLines) return;
  if (!GL.pupLines) {
    const g = new THREE.BufferGeometry(), n = 256;
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    GL.pupLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false }));
    GL.pupLines.frustumCulled = false; GL.pupLines.renderOrder = 8; GL.pupLines.visible = false;
    GL.edit.add(GL.pupLines); GL.pupTags = [];
  }
  const pos = GL.pupLines.geometry.attributes.position, col = GL.pupLines.geometry.attributes.color, A = new THREE.Vector3(), Bv = new THREE.Vector3();
  let n = 0, k = 0;
  const seg = (a, b, c) => { if (n > pos.count - 2) return; pos.setXYZ(n, a.x, a.y, a.z); col.setXYZ(n++, ...c); pos.setXYZ(n, b.x, b.y, b.z); col.setXYZ(n++, ...c); };
  const local = (arr, out) => { GL.edit.updateWorldMatrix(true, false); return GL.edit.worldToLocal(out.fromArray(arr)); };
  if (L) {
    const slotOf = id => PUP_SLOTS.find(s => L.map[s] === id) || '';
    for (const id of Object.keys(L.T)) {
      const s = slotOf(id), c = !s ? PUP_OUT : STU.pupSlot === s ? PUP_PICK : PUP_LINE;
      local(L.T[id].p, A);
      for (const ax of [[0.025, 0, 0], [0, 0.025, 0], [0, 0, 0.025]]) seg(Bv.copy(A).add(new THREE.Vector3(...ax)), new THREE.Vector3().copy(A).sub(new THREE.Vector3(...ax)), c);
      if (s) seg(A, local(L.m.at[s], Bv), c);
      if (!GL.pupTags[k]) { GL.pupTags[k] = LOOKS.tag(30); GL.edit.add(GL.pupTags[k]); }
      const t = GL.pupTags[k++];
      t.userData.set(`${s ? PUP_WORD[s] : 'Left out'} · ${pupSrcWord(it0(L), id)}`, s ? '#3ee08f' : '#ffc24a', 0.06);
      t.position.copy(A); t.position.y += 0.06; t.visible = true;
    }
  }
  GL.pupN = k;
  for (; k < (GL.pupTags || []).length; k++) GL.pupTags[k].visible = false;
  GL.pupLines.geometry.setDrawRange(0, n); pos.needsUpdate = col.needsUpdate = true;
  GL.pupLines.visible = !!L && editOn();
}
const it0 = L => (STU.items.get(L.id) || { rec: {} }).rec.puppet || {};

// ---------------------------------------------------------------- takes --
function takeStart(it) {
  const P = it.rec.puppet;
  if (!P || !P.on || !pupReady(P) || (PUP.take && PUP.take.phase === 'make')) return;
  PUP.take = { id: it.id, phase: 'count', at: performance.now() + TAKE_COUNT, t0: 0, next: 0, samples: [], name: '' };
  pupSay(it.id, '', 'muted');
}
// the bones as solved (each part's local turn, and the hips' place), keyed by part
const pupSample = (rig, t) => ({ t, p: rig.bones.hips.position.toArray(), q: Object.fromEntries(rig.parts.map(p => [p, _pq1.copy(rig.bones[p].quaternion).normalize().toArray()])) });
// after each solve while a take records: a sample each thirtieth of a second of the room's clock (frames permitting); at
// 120 s it stops by itself and is kept
function takeStep(rig, ok) {
  const T = PUP.take;
  if (T.phase !== 'rec') return;
  const t = pupClock() - T.t0;
  if (ok && t >= T.next - 1e-6) { T.samples.push(pupSample(rig, r4(t))); T.next = (Math.floor(t * TAKE_FPS + 1e-6) + 1) / TAKE_FPS; }
  if (t >= TAKE_MAX) takeStop(true);
}
// Stop (keep) or Cancel: kept, the take made into the object's GLB
function takeStop(keep) {
  const T = PUP.take;
  if (!T) return;
  if (!keep || T.phase !== 'rec') { if (T.phase !== 'make') PUP.take = null; dirty(true); return; }
  const it = STU.items.get(T.id);
  if (!it || T.samples.length < 2) { PUP.take = null; pupSay(T.id, 'Too short to keep: record for a moment at least.', 'amber'); return; }
  T.phase = 'make'; dirty(true);
  takeMake(it, T).finally(() => { if (PUP.take === T) PUP.take = null; dirty(true); });
}
// Take n (the first free name among its file's clips), into the GLB with its clips: through the converter (convertFile with
// take: into the same GLB when it is one of models/, the old one kept under originals/; else a GLB in models/, every object
// of the file switched to it; without a relay that takes uploads, downloaded)
async function takeMake(it, T) {
  const file = it.rec.file, have = new Set(((it.E && it.E.clips) || []).map(c => c.name));
  let n = 1;
  while (have.has('Take ' + n)) n++;
  T.name = 'Take ' + n;
  CV.item = it.id;
  const into = extOf(file) === 'glb' && /^models\//i.test(file) ? file : '';
  const ok = await convertFile(file, { take: { name: T.name, samples: T.samples }, into, label: `Making ${T.name}`, any: true });
  pupSay(it.id, ok ? `${T.name} (${(T.samples[T.samples.length - 1].t - T.samples[0].t).toFixed(1)} s, ${T.samples.length} keys) is in the model: ${CV.note}` : `${T.name} was not made: ${CV.note || 'the converter is busy.'}`, ok ? 'green' : 'red');
  return ok;
}
// (convertFile: the take as a clip of the model the converter read, bound by its bones' own names, beside its own clips)
function takeInto(m, take) {
  const R = IK.rigOf(m.root);
  if (!R.ok) throw new Error(R.why);
  const S = take.samples.map(s => ({ t: s.t, h: R.track.hips, p: s.p, q: Object.fromEntries(Object.entries(s.q).filter(([p]) => R.track[p]).map(([p, q]) => [R.track[p], q])) }));
  m.clips = (m.clips || []).filter(c => c.name !== take.name).concat(IK.clipOf(S, take.name, TAKE_FPS));
}

// ------------------------------------------------------------- the card --
// where a headset comes from, by default: the PC's Index when it is seen with the trackers, else this headset (in a
// session, in a room), else none (trackers only)
function pupMe() { try { return XR.on && GL.renderer.xr.isPresenting && HOST.collab && HOST.collab.joined ? HOST.collab.id || '' : ''; } catch (e) { return ''; } }
const pupByDefault = () => ([...TRK.at.values()].some(x => x.k === 'h') ? 'index' : pupMe());
const pupSrcWord = (P, id) => (id === '@head' ? 'the performer\'s headset' : id === '@l' ? 'their left hand' : id === '@r' ? 'their right hand' : trkWord(id));
// a device left out, in words (ik.js's match: beside another on the same part, or too far from every part)
const pupOutWord = (P, x) => `${pupSrcWord(P, x.id)} (${x.why === 'twice' ? `beside ${pupSrcWord(P, x.by)} at the ${PUP_WORD[x.slot].toLowerCase()}: the nearer is tied` : 'too far from every part'})`;
// Worn with trackers (an object's card, page and headset, editing on): for a model rigged by Mixamo; others told why not
function puppetBlocks(it, B, dis, mv) {
  const E = it.E;
  if (it.kind !== 'o' || !it.model || !E || !E.info || !E.info.rigged) return;
  const rig = pupRig(it), P = it.rec.puppet;
  if (!rig) return;
  if (!rig.ok) {
    B.push({ label: 'Worn with trackers', row: [{ id: 'pwear:any', label: 'Wear it with trackers', act: 'i:pwear', v: 'any', dis: true }] },
      { p: rig.why + ' Only a character rigged by Mixamo can be worn with trackers for now.', c: 'faint' });
    return;
  }
  if (!P) {
    B.push({ label: 'Worn with trackers', row: [{ id: 'pwear:any', label: 'Wear it with trackers', act: 'i:pwear', v: 'any', dis }] },
      { p: 'A performer moves it live, for everyone here, with any mix of devices: trackers (up to 11: head, chest, hips, hands, elbows, knees, feet), a headset, its controllers or tracked hands. Then line it up with the performer.', c: 'faint' });
    return;
  }
  const ready = pupReady(P), L = PUP.line && PUP.line.id === it.id ? PUP.line : null, T = PUP.take && PUP.take.id === it.id ? PUP.take : null, pn = performance.now();
  B.push({ label: 'Worn with trackers', row: [{ id: 'pwear:none', label: 'Stop wearing', act: 'i:pwear', v: 'none', dis: dis || !!T }] });
  // where a headset comes from (the PC's Index, this headset, or none)
  const me = pupMe(), other = P.by && P.by !== 'index' && P.by !== me;
  B.push({ label: 'Headset', row: [{ id: 'pby:index', label: 'The PC\'s Index', act: 'i:pupby', v: 'index', on: P.by === 'index', dis: dis || !!L },
    { id: 'pby:me', label: 'This headset', act: 'i:pupby', v: me, on: !!me && P.by === me, dis: dis || !!L || !me }].concat(other ? [{ id: 'pby:other', label: 'Another headset', act: 'i:pupby', v: P.by, on: true, dis: true }] : [],
    [{ id: 'pby:none', label: 'None', act: 'i:pupby', v: 'none', on: !P.by, dis: dis || !!L }]) });
  if (!me && P.by !== 'index') B.push({ p: 'This headset: press it in the performer\'s own headset, in the room. With a headset the character is sized to it and stepped into; with none it comes to the performer.', c: 'faint' });
  B.push({ kv: [['Lined up', ready ? `yes: ${Object.keys(P.cal).length} parts tied, scale ${P.s}` + (P.rig !== 'any' ? ` (${PUP_RIG_WORD[P.rig]})` : '') + (P.s && Math.abs(P.s - it.rec.s) > 1e-9 ? ` (sized since to ${it.rec.s}: line up again)` : '') : 'not yet'],
    ['Moves', P.on && ready ? 'with the performer (its own animation off)' : 'by its own animation']] });
  if (!L) B.push({ label: 'With the performer', row: [{ id: 'pupon:on', label: 'On', act: 'i:pupon', v: 'on', on: P.on && ready, dis: dis || !ready }, { id: 'pupon:off', label: 'Off', act: 'i:pupon', v: 'off', on: !(P.on && ready), dis }] });
  if (L && L.phase === 'count') {
    B.push({ p: L.head ? `Step into it: stand where it stands, facing its way, arms out to the sides, as it stands. Lining up in ${Math.max(0, Math.ceil((L.at - pn) / 1000))} s.`
      : `Stand in a T-pose facing its way, arms out to the sides, as it stands: it comes to you. Lining up in ${Math.max(0, Math.ceil((L.at - pn) / 1000))} s.`, c: 'amber' },
    { row: [{ id: 'pupcancel', label: 'Cancel', act: 'i:pupcancel' }] });
  } else if (L) {
    // the matches, before they are taken: each part and its device (a press: another device for it, or none)
    const used = new Set(Object.values(L.map)), out = Object.keys(L.T).filter(id => !used.has(id)), ok = L.map.head || L.map.hips;
    B.push({ p: 'Each device is tied to the part it is nearest to: a line runs from each to its part. Change one if a line looks wrong, then take them. A part with nothing on it is worked out.', c: 'faint' });
    B.push({ label: 'Tied', list: PUP_SLOTS.map(s => {
      const id = L.map[s], d = id && L.m.at[s] ? Math.hypot(...L.T[id].p.map((v, k) => v - L.m.at[s][k])) : 0;
      return { id: 'pslot:' + s, label: PUP_WORD[s], sub: id ? `${pupSrcWord(P, id)} · ${Math.round(d * 100)} cm` : 'worked out', act: 'i:pupslot', v: s, on: STU.pupSlot === s, dis };
    }) });
    if (STU.pupSlot) {
      const s = STU.pupSlot;
      B.push({ list: Object.keys(L.T).map(id => ({ id: `pfix:${s}:${id}`, label: pupSrcWord(P, id), sub: PUP_SLOTS.find(k => L.map[k] === id) ? PUP_WORD[PUP_SLOTS.find(k => L.map[k] === id)] + ' now' : 'left out now', act: 'i:pupfix', v: s + ':' + id, on: L.map[s] === id, dis }))
        .concat({ id: `pfix:${s}:`, label: 'Nothing', sub: 'worked out', act: 'i:pupfix', v: s + ':', on: !L.map[s], dis }) },
      { p: `A device for the ${PUP_WORD[s].toLowerCase()} (one tied elsewhere swaps with it).`, c: 'faint' });
    }
    if (out.length) B.push({ p: 'Left out: ' + out.map(id => { const x = (L.m.out || []).find(y => y.id === id); return x ? pupOutWord(P, x) : `${pupSrcWord(P, id)} (changed on this card)`; }).join('; ') + '.', c: 'amber' });
    if (!ok) B.push({ p: L.m.why || 'Nothing is tied to the head or the hips: one of them must be.', c: 'red' });
    B.push({ row: [{ id: 'pupok', label: 'Take these', act: 'i:pupok', primary: true, dis: dis || mv || !ok }, { id: 'pupagain', label: 'Line up again', act: 'i:pupagain', dis: dis || mv }, { id: 'pupcancel', label: 'Cancel', act: 'i:pupcancel' }] });
  } else B.push({ row: [{ id: 'pupline', label: 'Line up with the performer', act: 'i:pupline', primary: !ready, dis: dis || mv || !!T }].concat(P.map ? [{ id: 'pupkeep', label: 'Line up again, these parts', act: 'i:pupkeep', dis: dis || mv || !!T }] : []) },
    { p: 'A 5 s countdown: the character stands in a T-pose and the performer copies it, facing its way (in a headset, standing in it: it is sized to them first; with none, it comes to them). Then each device is tied to the part it is nearest to, shown before it is taken. One Undo step.', c: 'faint' });
  if (PUP.noteId === it.id && PUP.note) B.push({ p: PUP.note, c: PUP.noteC });
  if (P.on && ready && it.pupWhy && !L) B.push({ p: it.pupWhy + ' It stands at rest meanwhile.', c: 'amber' });
  // the parts (a press opens the devices to choose from: the part is then lined up again, with these parts)
  if (P.map && !L) {
    B.push({ label: 'Its parts', list: PUP_SLOTS.filter(s => P.map[s]).map(s => {
      const id = P.map[s], seen = PUP_BODY.test(id) ? true : trkSeen(id);
      return { id: 'pslot:' + s, label: PUP_WORD[s], sub: pupSrcWord(P, id) + (seen ? '' : ' · not seen') + (P.cal && P.cal[s] ? '' : ' · not lined up'), act: 'i:pupslot', v: s, on: STU.pupSlot === s, dis: dis || PUP_BODY.test(id) };
    }) });
    if (STU.pupSlot && P.map[STU.pupSlot]) {
      const s = STU.pupSlot, ks = P.rig === 'any' ? ['t', 'h', 'l', 'r'] : ['head', 'lhand', 'rhand'].includes(s) && P.rig === 'feet' ? ['h', 'l', 'r'] : ['t'];
      const L2 = trkKnown().filter(x => ks.includes(x.k));
      B.push(L2.length ? { list: L2.map(x => ({ id: `pset:${s}:${x.id}`, label: trkWord(x.id), sub: (x.ok ? 'seen' : 'not seen now') + (Object.keys(P.map).find(k => P.map[k] === x.id && k !== s) ? ' · ' + PUP_WORD[Object.keys(P.map).find(k => P.map[k] === x.id)] + ' now' : ''), act: 'i:pupset', v: s + ':' + x.id, on: P.map[s] === x.id, dis })) }
        : { p: 'No other tracker here.', c: 'faint' }, { p: 'Another tracker for this part (two parts swap theirs); then Line up again, these parts.', c: 'faint' });
    }
  }
  // a take
  if (T && T.phase === 'count') B.push({ p: `Recording a take in ${Math.max(0, Math.ceil((T.at - pn) / 1000))} s.`, c: 'amber' }, { row: [{ id: 'takecancel', label: 'Cancel', act: 'i:takecancel' }] });
  else if (T && T.phase === 'rec') B.push({ p: `Recording a take: ${Math.floor(pupClock() - T.t0)} s of at most ${TAKE_MAX}.`, c: 'amber' }, { row: [{ id: 'takestop', label: 'Stop', act: 'i:takestop', primary: true }, { id: 'takecancel', label: 'Cancel', act: 'i:takecancel' }] });
  else if (T) B.push({ p: `Making ${T.name || 'the take'}: ${CV.note || 'into its GLB...'}`, c: 'muted' });
  else if (P.on && ready && !L) B.push({ label: 'Takes', row: [{ id: 'take', label: 'Record a take', act: 'i:take', dis: dis || !!CV.busy }] },
    { p: `The bones as the performer moves them, 30 times a second, up to ${TAKE_MAX} s after a 3 s countdown, then made into a clip (Take 1, Take 2...) in its GLB` + (canUpload() ? ' (into models/; every object of the file switches to it)' : ' (downloaded: put it in the scene\'s models/ folder)') + '. It plays as any clip, with wearing off.', c: 'faint' });
}
// the card's actions (one Undo step each, but for the countdowns, the matches shown, the list of parts and the takes:
// this device's own)
Object.assign(ITEM_ACT, {
  pwear: (it, v) => {
    if (it.kind !== 'o') return;
    if (PUP.line && PUP.line.id === it.id) pupEnd(it);
    if (v === 'none') { if (it.rec.puppet) setRec(it.id, { puppet: undefined }); return; }
    const P = it.rec.puppet, rig = pupRig(it);
    if (v !== 'any' || P || !rig || !rig.ok) return;
    setRec(it.id, { puppet: { on: false, rig: 'any', by: pupByDefault() || undefined } });
  },
  pupon: (it, v) => { const P = it.rec.puppet, on = v === 'on'; if (P && (!on || pupReady(P)) && P.on !== on) setRec(it.id, { puppet: Object.assign({}, P, { on }) }); },
  // where a headset comes from ('none': trackers only): the trackers' parts kept, the rest lined up again
  pupby: (it, v) => {
    const P = it.rec.puppet, by = v === 'none' ? '' : v;
    if (!P || typeof by !== 'string' || (P.by || '') === by) return;
    const keep = Object.fromEntries(Object.entries(P.map || {}).filter(([, id]) => !PUP_BODY.test(id) && !['h', 'l', 'r'].includes((TRK.last.get(id) || TRK.at.get(id) || {}).k)));
    setRec(it.id, { puppet: { on: false, rig: P.rig, by: by || undefined, map: Object.keys(keep).length ? keep : undefined } });
  },
  // another tracker for a part (one that drives another part swaps with it): not lined up until Line up again
  pupset: (it, v) => {
    const P = it.rec.puppet, [s, id] = String(v).split(/:(.*)/s);
    STU.pupSlot = '';
    if (!P || !P.map || !P.map[s] || !TRK_ID.test(id || '') || P.map[s] === id) return;
    const map = Object.assign({}, P.map), other = Object.keys(map).find(k => map[k] === id);
    if (other) map[other] = map[s];
    map[s] = id;
    setRec(it.id, { puppet: Object.assign({}, P, { on: false, map, cal: undefined }) });
  },
  pupslot: (it, s) => { STU.pupSlot = STU.pupSlot === s ? '' : s; pupLook(); },
  // (the matches shown: another device for a part, or none; one tied elsewhere swaps with it)
  pupfix: (it, v) => {
    const L = PUP.line, [s, id] = String(v).split(/:(.*)/s);
    STU.pupSlot = '';
    if (!L || L.id !== it.id || L.phase !== 'check' || !PUP_SLOTS.includes(s) || (id && !L.T[id])) { pupLook(); return; }
    const other = id ? PUP_SLOTS.find(k => L.map[k] === id && k !== s) : '';
    if (other) { if (L.map[s]) L.map[other] = L.map[s]; else delete L.map[other]; }
    if (id) L.map[s] = id; else delete L.map[s];
    pupLook();
  },
  pupline: it => pupLineStart(it, false),
  pupkeep: it => pupLineStart(it, true),
  pupagain: it => { const keep = !!(PUP.line && PUP.line.keep); pupEnd(it); pupLineStart(it, keep); },
  pupok: it => { const why = pupTake(it); pupSay(it.id, why || `Lined up with the performer: ${Object.keys(it.rec.puppet.cal).length} parts tied, scale ${it.rec.s}.`, why ? 'red' : 'green'); },
  pupcancel: it => { pupEnd(it); },
  take: it => takeStart(it),
  takestop: () => takeStop(true),
  takecancel: () => takeStop(false),
});
PANE_ONLY.push('pupslot', 'pupfix', 'pupline', 'pupkeep', 'pupagain', 'pupcancel', 'take', 'takestop', 'takecancel');
MOVE_ACTS.push('pupline', 'pupkeep', 'pupagain', 'pupok');   // (lining up moves and sizes it: refused while it is locked in place)
// (for tests and the console, STUDIO.puppet)
function pupState(id) {
  const it = STU.items.get(id), rig = it && it.kind === 'o' ? pupRig(it) : null, P = it && it.rec.puppet, T = PUP.take, L = PUP.line;
  return { rig: rig ? (rig.ok ? 'ok' : rig.why) : null, rec: P || null, ready: pupReady(P), on: !!(it && it.pupOn), why: (it && it.pupWhy) || '',
    line: L ? { id: L.id, phase: L.phase, left: L.at - performance.now(), keep: L.keep, head: L.head, p: L.p, s: L.s, map: L.map || null, out: L.m ? L.m.out : null, why: L.m ? L.m.why : '', lines: GL.pupLines && GL.pupLines.visible ? GL.pupLines.geometry.drawRange.count / 2 : 0 } : null,
    take: T ? { id: T.id, phase: T.phase, n: T.samples.length, name: T.name } : null, note: PUP.noteId === id ? PUP.note : '', clip: !!(it && it.action) };
}
