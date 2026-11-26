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
// Mirror the visitor (v204; the owner, 25 November 2026, at the tracker guide's end: "a third robot here that is controlled
// just with a headset and controllers or hands so that everyone can really try this"): puppet.mirror (m) makes it each
// headset's own mirror, no lining up: MIRROR below.
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
  // (v204) the visitor's mirror: how far in front of it (m) the visitor stands, the mirror's plane half way
  if (has('mirror')) { if (!fin(x.mirror) || x.mirror < 0.5 || x.mirror > 10) return null; r.mirror = Math.round(x.mirror * 100) / 100; }
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
  if (it.rec.puppet && it.rec.puppet.mirror) return mirStep(it, dt);   // (the visitor's mirror: MIRROR)
  if (it.mir) mirOff(it);
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
    if (!it || !it.rec.puppet) pupEnd(it);   // (gone, or worn no more: Undo, another device's edit; its place and size put back)
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
    // (its eyes over its own base, the holder's height: on a platform the size it has on the floor, v206)
    const h = D[hmd].p[1] - W.p.y, e = IK.restPose(rig, 'eye').p.y - pupBase(it);
    if (h < 0.6 || h > 2.3) { pupSay(it.id, `Stand up straight in the headset: it is ${h.toFixed(2)} m over the floor.`, 'red'); return; }
    if (e > 1e-3) L.s = +Math.min(1e4, Math.max(1e-4, it.rec.s * h / e)).toPrecision(4);
  }
  PUP.line = L;
  pupShow(it, L);
  pupSay(it.id, '', 'muted');
}
// the height its own base stands at in the world (its holder's: a platform), for ik.js's o.base
const pupBase = it => it.holder.getWorldPosition(new THREE.Vector3()).y;
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
  // ('Line up again, these parts': a headset or controller of the PC's chosen by hand for a part is kept, whatever the
  // Headset row says; a part whose device is not seen now is named on the card, L.lost)
  if (L.keep) {
    for (const s of PUP_SLOTS) {
      const id = P.map[s], x = id && !T[id] && !PUP_BODY.test(id) ? TRK.at.get(id) : null;
      if (x && x.ok && x.p) T[id] = worldPose(_pp1.fromArray(x.p), _pq1.fromArray(x.q), W);
    }
    L.lost = PUP_SLOTS.filter(s => P.map[s] && !T[P.map[s]]).map(s => ({ s, id: P.map[s] }));
  }
  if (!Object.keys(T).length) return 'Nothing is seen: no tracker here, and no headset (choose where a headset comes from).';
  L.lift = pupBase(it) - floor;   // (on a platform: matched as if on the floor; the lines drawn up to it)
  L.why = '';
  if (!L.head) {
    const f = IK.fit(rig, T, { floor, base: pupBase(it), origin: it.holder.getWorldPosition(new THREE.Vector3()) });
    if (!f.k) return f.why;
    // (sized and moved, but nothing near its head or hips, or nothing near it at all: the card is shown all the same, red,
    // Take these off, saying so; a device can be chosen for the head or the hips there)
    if (!f.ok) L.why = f.why;
    const d = new THREE.Vector3().fromArray(f.t).applyQuaternion(W.q.clone().invert()).divideScalar(W.s.x);
    L.p = it.holder.position.clone().add(d).toArray().map(v => nz(r3(clamp(v, -1000, 1000))));
    L.s = +Math.min(1e4, Math.max(1e-4, L.s * f.k)).toPrecision(4);
    pupShow(it, L);
  }
  const m = IK.match(rig, T, { floor, base: pupBase(it) });
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
  const c = IK.calibrate(rig, L.T, L.map, 'any', { floor: pupW().p.y, base: pupBase(it), scale: false });
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
      if (s) seg(A, local([L.m.at[s][0], L.m.at[s][1] + (L.lift || 0), L.m.at[s][2]], Bv), c);
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

// ================================================================ MIRROR ==
// (v204) Mirror the visitor (tools/trackers/SPEC.md, "The mirror"): an object whose record has puppet.mirror (m) is each
// headset's own mirror. In a headset it copies its wearer at once, with no Edit and no lining up, visiting too: the
// headset, each controller's grip (or a tracked hand's wrist) and, at a station, the room's trackers near the body, each
// reflected in a plane half way between where it stands and the spot puppet.mirror m in front of it (a true mirror image:
// your left hand drives its right hand, which is on your left as you face it), then solved by ik.js's 'any'. No T-pose:
// the headset's and the hands' offsets are the ones people's bodies use (bodies.js: the headset at the eyes, the grips in
// the fists of its T-pose); a tracker's is taken from the pose it has when the set of devices changes (match, posed: each
// tied to the part it is nearest to; one too far from every part ignored; a part a headset or hand drives keeps it). Sized
// to the wearer's eye height as bodies.js sizes people, its feet on the scene's floor. A puck with a tag at each device
// that drives it, in its mirrored place. This device's own: nothing of it is sent, saved or in state(), and its record
// never changes (its model's root is scaled, its bones solved). With no headset it plays its own clip.
const MIR = { want: false, g: [null, null], hand: [false, false], fake: null, own: { head: null, l: null, r: null, hand: null }, D: [1.2, 1.6, 2, 2.5] };
const MIR_EYE = { dt: 0.5, n: 60, p: 0.9, lo: 1.0, hi: 2.05, tau: 1 };   // (as bodies.js's EYE: a high percentile of the head's height over 30 s)
// (as bodies.js: the headset ahead of the eyes, the fist's middle from the wrist, at the mannequin's size, its eyes 1.62 m
// up; WebXR's grip in a T-pose, palms down, its -z out along the arm (v216: a controller held naturally has its grip's -z
// ahead along the hand, +y up; before, +y was taken to run up the arm and the hands came out a quarter turn off); a
// headset looking along +z)
const MIR_K = { eye: 1.62, ahead: 0.08, fist: [0.055, -0.015, 0] };
const mirBasis = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...x), new THREE.Vector3(...y), new THREE.Vector3(...z)));
const MIR_GRIP = { l: mirBasis([0, -1, 0], [0, 0, 1], [-1, 0, 0]), r: mirBasis([0, 1, 0], [0, 0, 1], [1, 0, 0]) };
// a tracked hand's wrist joint (the Hand Input spec: -z towards the palm's middle, +y out of the back of the hand) as the
// grip that hand would have (-z along the hand, +x out of the back of the right hand and the palm of the left, the fist's
// middle 5.5 cm on and 1.5 cm into the palm): only where a hand gives no grip space
const MIR_WRIST = [0, 1].map(k => new THREE.Matrix4().makeRotationZ(k ? Math.PI / 2 : -Math.PI / 2).setPosition(0, -0.015, -0.055));
const _mrW = new THREE.Matrix4(), _mrWp = new THREE.Vector3(), _mrWq = new THREE.Quaternion(), _mrWs = new THREE.Vector3();
const MIR_EYEQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const MIR_BODY = { head: '@head', rhand: '@l', lhand: '@r' };   // (the part each of your own devices drives: mirrored)
const MIR_SWAP = s => (s[0] === 'l' ? 'r' + s.slice(1) : s[0] === 'r' ? 'l' + s.slice(1) : s);
const MIR_COL = { dev: '#3ee08f', trk: '#ffb547' };
// from the shell's frame (xrBegin): this headset's grips, or a tracked hand's grip or wrist, as the reference space has
// them (read only while a mirror asked for them the frame before)
function mirGrips(frame, ref) {
  MIR.g[0] = MIR.g[1] = null;
  if (!MIR.want || !frame || !ref) return;
  MIR.want = false;
  let src = [];
  try { src = (XR.session && XR.session.inputSources) || []; } catch (e) { src = []; }
  for (let i = 0; i < src.length; i++) {
    const x = src[i], k = !x ? -1 : x.handedness === 'left' ? 0 : x.handedness === 'right' ? 1 : -1;
    if (k < 0) continue;
    let p = null, wr = false;
    try { p = x.gripSpace ? frame.getPose(x.gripSpace, ref) : x.hand && frame.getJointPose ? (wr = true, frame.getJointPose(x.hand.get('wrist'), ref)) : null; } catch (e) { p = null; }
    if (!p) continue;
    let P = p.transform.position, Q = p.transform.orientation;
    if (wr) { _mrW.fromArray(p.transform.matrix).multiply(MIR_WRIST[k]).decompose(_mrWp, _mrWq, _mrWs); P = _mrWp; Q = _mrWq; }
    MIR.g[k] = [P.x, P.y, P.z, Q.x, Q.y, Q.z, Q.w]; MIR.hand[k] = !!x.hand;
  }
}
// your own head and hands now, in the scene's frame (seven numbers each; a hand not seen null), or null with no headset.
// MIR.fake (the tests: { head, l, r, hand }, already in the scene's frame) in their place
const _mrP = new THREE.Vector3(), _mrQ = new THREE.Quaternion(), _mrQ2 = new THREE.Quaternion(), _mrV = new THREE.Vector3();
function mirOwn(W) {
  MIR.want = true;
  if (MIR.fake) return MIR.fake;
  let on = false;
  try { on = !!(XR.on && GL.renderer.xr.isPresenting); } catch (e) { on = false; }
  if (!on) return null;
  const O = MIR.own, iq = _mrQ2.copy(W.q).invert();
  const into = (P, Q, out) => { P.sub(W.p).applyQuaternion(iq).divideScalar(W.s.x); Q.premultiply(iq); out = out || []; P.toArray(out); Q.toArray(out, 3); return out; };
  O.head = into(_mrP.copy(XR.head), _mrQ.copy(XR.headQ), O.head);
  for (let k = 0; k < 2; k++) {
    const g = MIR.g[k], key = k ? 'r' : 'l';
    O[key] = g ? into(_mrP.fromArray(g), _mrQ.fromArray(g, 3), O[key + 'b'] || (O[key + 'b'] = [])) : null;
  }
  O.hand = MIR.hand;
  return O;
}
// the mirror's plane in the scene's frame (MIR_S: the reflection; MIR_F its normal, MIR_C a point on it): half way between where it
// stands and the spot puppet.mirror m in front of it
const MIR_S = new THREE.Matrix4(), MIR_L = new THREE.Matrix4().makeScale(-1, 1, 1), MIR_F = new THREE.Vector3(), MIR_C = new THREE.Vector3(), _mrM = new THREE.Matrix4();
function mirPlane(it) {
  MIR_F.set(0, 0, 1).applyQuaternion(_mrQ.fromArray(it.rec.q)); MIR_F.y = 0;
  if (MIR_F.lengthSq() < 1e-8) MIR_F.set(0, 0, 1);
  MIR_F.normalize();
  MIR_C.fromArray(it.rec.p).addScaledVector(MIR_F, it.rec.puppet.mirror / 2);
  const x = MIR_F.x, z = MIR_F.z;
  MIR_S.set(1 - 2 * x * x, 0, -2 * x * z, 0, 0, 1, 0, 0, -2 * x * z, 0, 1 - 2 * z * z, 0, 0, 0, 0, 1);
}
// a pose (seven numbers, the scene's frame) reflected: out.s (the scene's frame: the pucks) and out.p, out.q (the world:
// the solver's). Its turn reflected and made a turn again by flipping its own x (S M L): a left grip's frame becomes a
// right grip's, a headset looking at the mirror one looking back
function mirPose(a, W, out) {
  _mrP.fromArray(a); _mrQ.fromArray(a, 3).normalize();
  _mrP.addScaledVector(MIR_F, -2 * _mrV.copy(_mrP).sub(MIR_C).dot(MIR_F));
  _mrM.makeRotationFromQuaternion(_mrQ).premultiply(MIR_S).multiply(MIR_L);
  _mrQ.setFromRotationMatrix(_mrM);
  out.s = out.s || []; _mrP.toArray(out.s); _mrQ.toArray(out.s, 3);
  _mrP.multiplyScalar(W.s.x).applyQuaternion(W.q).add(W.p); _mrQ.premultiply(W.q);
  out.p = _mrP.toArray(out.p || []); out.q = _mrQ.toArray(out.q || []);
  return out;
}
// a mirror's start: the offsets of the headset and hands from the character at rest, as if a person stood in it in its
// T-pose (bodies.js's), its eye height and its root's scale as loaded; null when it cannot be (its eyes not above the floor)
function mirNew(it, rig) {
  pupRest(it);
  const W = pupW(), par = rig.bones.hips.parent, Fq = new THREE.Quaternion();
  if (par) { par.updateWorldMatrix(true, false); par.getWorldQuaternion(Fq); }
  // (the character's own axes in the world: Mixamo's faces +z with its left at +x, as ik.js finds them)
  const R = mirBasis(rig.left.clone().applyQuaternion(Fq).toArray(), rig.up.clone().applyQuaternion(Fq).toArray(), rig.fwd.clone().applyQuaternion(Fq).toArray());
  const eye = IK.restPose(rig, 'eye').p, eye0 = (eye.y - pupBase(it)) / W.s.x, u = eye0 / MIR_K.eye;   // (over its own base, v206)
  if (!(eye0 > 0.3)) return null;
  const tg = { hmd: { p: eye.clone().add(new THREE.Vector3(0, 0, MIR_K.ahead * u * W.s.x).applyQuaternion(R)).toArray(), q: R.clone().multiply(MIR_EYEQ).toArray() } };
  for (const s of ['l', 'r']) {
    const w = IK.restPose(rig, s + 'hand').p, sg = s === 'l' ? 1 : -1;
    tg[s] = { p: w.clone().add(new THREE.Vector3(MIR_K.fist[0] * sg, MIR_K.fist[1], MIR_K.fist[2]).multiplyScalar(u * W.s.x).applyQuaternion(R)).toArray(), q: R.clone().multiply(MIR_GRIP[s]).toArray() };
  }
  const c = IK.calibrate(rig, tg, { head: 'hmd', lhand: 'l', rhand: 'r' }, 'any', { floor: W.p.y, scale: false });
  if (!c.ok) return null;
  const r0 = it.model.rest.find(([n]) => n === it.model.o);
  return { model: it.model, cal0: c.cal, eye0, s0: r0 ? r0[3].clone() : it.model.o.scale.clone(), k: 1, eye: { ring: [], at: MIR_EYE.dt, want: 0, now: 0 },
    st: {}, key: '', n: 0, tmap: {}, tcal: {}, hp: null, T: {}, C: { ok: true, setup: 'any', map: {}, cal: {}, floor: 0 }, list: [] };
}
// the eye height (the scene's): a high percentile of the head's height over the last 30 s, eased
function mirEye(M, y, dt) {
  const E = M.eye;
  E.at += dt;
  if (E.at >= MIR_EYE.dt) {
    E.at = 0; E.ring.push(y); if (E.ring.length > MIR_EYE.n) E.ring.shift();
    const s = E.ring.slice().sort((a, b) => a - b);
    E.want = Math.min(MIR_EYE.hi, Math.max(MIR_EYE.lo, s[Math.floor(MIR_EYE.p * (s.length - 1))]));
  }
  E.now = E.now ? E.now + (E.want - E.now) * (dt > 0 ? 1 - Math.exp(-dt / MIR_EYE.tau) : 1) : E.want;
  return E.now;
}
const mirOK = a => Array.isArray(a) && a.length === 7 && a.every(fin) && Math.hypot(a[3], a[4], a[5], a[6]) > 1e-6;
// every frame in place of its animation (pupStep): with a headset its bones solved from your mirrored devices (true: its
// own clip off); else false, and its clip plays
function mirStep(it, dt) {
  const W = pupW(), own = mirOwn(W), rig = own && mirOK(own.head) && it.model ? pupRig(it) : null;
  if (!rig || !rig.ok) { if (it.mir) mirOff(it); it.pupWhy = rig ? rig.why : ''; return false; }
  if (it.mir && it.mir.model !== it.model) mirOff(it);
  if (!it.mir) {
    const M = mirNew(it, rig);
    if (!M) { it.pupWhy = 'Its eyes are not above the floor: stand it on the floor.'; return false; }
    if (it.mixer) it.mixer.stopAllAction();
    it.action = null; it.animKey = ''; it.tl = null; it.pupOn = true; it.pupWhy = ''; it.mir = M;
  }
  const M = it.mir;
  if (motionsPaused()) return true;   // (Pause: it holds the pose it shows)
  mirPlane(it);
  // (a jump, the sticks or a new place: the feet planted again under it)
  const hp = _mrV.fromArray(own.head);
  if (M.hp && M.hp.distanceTo(hp) > 1) M.st = {};
  (M.hp || (M.hp = new THREE.Vector3())).copy(hp);
  // its size: its eyes at your eye height
  M.k = mirEye(M, own.head[1], dt) / M.eye0;
  it.model.o.scale.copy(M.s0).multiplyScalar(M.k);
  // the devices, reflected: yours, and the room's trackers here (at a station)
  const T = M.T, seen = [];
  for (const id in T) T[id].on = false;
  const put = (id, a) => { mirPose(a, W, T[id] || (T[id] = {})).on = true; seen.push(id); };
  put('@head', own.head);
  if (mirOK(own.l)) put('@l', own.l);
  if (mirOK(own.r)) put('@r', own.r);
  for (const x of TRK.at.values()) if (x.k === 't' && x.ok && x.p) put(x.id, x.p.concat(x.q));
  const D = {};
  for (const id of seen) D[id] = T[id];
  // a new set of devices: the trackers tied to the parts they are nearest to as it stands now (once it has stood a moment)
  const key = seen.slice().sort().join();
  if (key !== M.key && M.n > 5) {
    M.key = key; M.tmap = {}; M.tcal = {};
    const m = IK.match(rig, D, { floor: W.p.y, posed: true }), taken = new Set(PUP_SLOTS.filter(s => MIR_BODY[s] && D[MIR_BODY[s]]));
    for (const sl in m.map || {}) {
      const id = m.map[sl];
      if (PUP_BODY.test(id) || taken.has(sl)) continue;
      const b = rig.bones[sl === 'chest' ? rig.chest : PUP_PART[sl]], t = D[id], bp = new THREE.Vector3(), bq = new THREE.Quaternion();
      b.matrixWorld.decompose(bp, bq, _pS);
      const iq = new THREE.Quaternion().fromArray(t.q).invert(), off = bp.sub(_mrP.fromArray(t.p)).applyQuaternion(iq).divideScalar(M.k);
      bq.premultiply(iq).normalize();
      M.tmap[sl] = id; M.tcal[sl] = [off.x, off.y, off.z, bq.x, bq.y, bq.z, bq.w];
    }
  }
  // its parts this frame: each with a device now, its offset at this size; the rest worked out
  const C = M.C;
  for (const s in C.map) delete C.map[s];
  for (const s of PUP_SLOTS) {
    const id = MIR_BODY[s] && D[MIR_BODY[s]] ? MIR_BODY[s] : M.tmap[s] && D[M.tmap[s]] ? M.tmap[s] : '';
    if (!id) { delete C.cal[s]; continue; }
    const c0 = id[0] === '@' ? M.cal0[s] : M.tcal[s], c = C.cal[s] || (C.cal[s] = [0, 0, 0, 0, 0, 0, 1]);
    for (let j = 0; j < 7; j++) c[j] = j < 3 ? c0[j] * M.k : c0[j];
    C.map[s] = id;
  }
  C.floor = W.p.y;
  const r = IK.solve(rig, C, D, dt, M.st);
  it.pupWhy = r.ok ? '' : r.why;
  if (!r.ok) rig.toRest();
  M.n++; M.hand = own.hand || [false, false];
  mirPucks(it, M, D);
  return true;
}
// the pucks: one at each device that drives a part, where the mirror sees it, with a tag naming it (yours: your headset,
// your left controller or hand ...; a tracker by the part it is on, on you). Opaque, never hit by the pointer
const MIR_PUCK = { geo: null, mat: {} }, MIR_FACE = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);   // (the disc's face from the grip's +y to its -z)
function mirPucks(it, M, D) {
  let G = it.mirG;
  if (!G) {
    G = it.mirG = { g: new THREE.Group(), p: [], t: [] };
    G.g.matrixAutoUpdate = false; G.g.name = 'mirror pucks';
    it.holder.add(G.g);
    if (!MIR_PUCK.geo) { MIR_PUCK.geo = new THREE.CylinderGeometry(0.038, 0.038, 0.022, 20); for (const k in MIR_COL) MIR_PUCK.mat[k] = new THREE.MeshStandardMaterial({ color: MIR_COL[k], roughness: 0.5, metalness: 0.1 }); }
  }
  // (the group in the scene's frame: the pucks' places are the scene's)
  GL.items.updateWorldMatrix(true, false); it.holder.updateWorldMatrix(true, false);
  G.g.matrix.copy(it.holder.matrixWorld).invert().multiply(GL.items.matrixWorld);
  G.g.matrixWorldNeedsUpdate = true; G.g.visible = true;
  const L = M.list; L.length = 0;
  for (const s of PUP_SLOTS) {
    const id = M.C.map[s];
    if (!id) continue;
    const word = id === '@head' ? 'Headset' : id === '@l' ? (M.hand[0] ? 'Left hand' : 'Left controller') : id === '@r' ? (M.hand[1] ? 'Right hand' : 'Right controller') : PUP_WORD[MIR_SWAP(s)] + ' tracker';
    L.push({ slot: s, id, word, at: D[id].s });
  }
  L.forEach((x, i) => {
    let P = G.p[i], tg = G.t[i];
    if (!P) {
      P = G.p[i] = new THREE.Mesh(MIR_PUCK.geo, MIR_PUCK.mat.dev); P.raycast = () => {}; G.g.add(P);
      tg = G.t[i] = LOOKS.tag(30); tg.raycast = () => {}; G.g.add(tg);
    }
    P.material = MIR_PUCK.mat[x.id[0] === '@' ? 'dev' : 'trk'];
    P.position.fromArray(x.at); P.quaternion.fromArray(x.at, 3); P.visible = true;
    if (x.id === '@l' || x.id === '@r') P.quaternion.multiply(MIR_FACE);   // (a hand's puck faces the way it points, v216)
    tg.userData.set(x.word, MIR_COL[x.id[0] === '@' ? 'dev' : 'trk'], 0.06);
    tg.position.fromArray(x.at); tg.position.y += 0.05; tg.visible = true;
  });
  for (let i = L.length; i < G.p.length; i++) G.p[i].visible = G.t[i].visible = false;
}
// a mirror no more (no headset, its record changed, its model again): its clip again, from its rest pose, the pucks hidden
function mirOff(it) {
  it.mir = null;
  if (it.mirG) it.mirG.g.visible = false;
  if (it.model) pupOff(it); else it.pupOn = false;
}
// the item gone: its pucks' tags given back
function mirDrop(it) {
  if (!it.mirG) return;
  for (const t of it.mirG.t) t.userData.drop();
  if (it.mirG.g.parent) it.mirG.g.parent.remove(it.mirG.g);
  it.mirG = null; it.mir = null;
}
// (for tests and the console, STUDIO.mirror: where it is, its size, which device drives which part, the pucks' words and
// places, and its hands' and head's places in the scene's frame; v216: aim, each hand's way along the hand (the forearm's
// way at rest, turned as the hand is turned from rest) and palm (its palm's, down at rest), unit vectors in the scene's frame)
function mirState(id) {
  const it = STU.items.get(id), M = it && it.mir;
  if (!it) return null;
  const at = b => { if (!it.rig || !it.rig.ok || !it.rig.bones[b]) return null; const v = it.rig.bones[b].getWorldPosition(new THREE.Vector3()); return GL.items.worldToLocal(v).toArray().map(n => Math.round(n * 1e4) / 1e4); };
  const hand = (s, palm) => {
    const rig = it.rig;
    if (!M || !rig || !rig.ok || !rig.bones[s + 'hand']) return null;
    const h = IK.restPose(rig, s + 'hand'), f = IK.restPose(rig, s + 'fore'), gq = new THREE.Quaternion();
    GL.items.getWorldQuaternion(gq);
    const par = rig.bones.hips.parent, fq = par ? par.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
    const v = palm ? rig.up.clone().negate().applyQuaternion(fq) : h.p.clone().sub(f.p);
    v.applyQuaternion(h.q.clone().invert()).applyQuaternion(rig.bones[s + 'hand'].getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(gq.invert()).normalize();
    return v.toArray().map(n => Math.round(n * 1e3) / 1e3);
  };
  return { rec: it.rec.puppet || null, on: !!M, why: it.pupWhy || '', clip: !!it.action, k: M ? M.k : 0, eye: M ? M.eye.now : 0, map: M ? Object.assign({}, M.C.map) : {},
    pucks: M ? M.list.map(x => ({ word: x.word, slot: x.slot, at: x.at.slice(0, 3) })) : [], shown: !!(it.mirG && it.mirG.g.visible),
    bones: M ? { head: at('head'), lhand: at('lhand'), rhand: at('rhand'), hips: at('hips'), lfoot: at('lfoot'), rfoot: at('rfoot') } : null,
    aim: M ? { lhand: hand('l'), rhand: hand('r') } : null, palm: M ? { lhand: hand('l', true), rhand: hand('r', true) } : null };
}

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
    B.push({ label: 'Worn with trackers', row: [{ id: 'pwear:any', label: 'Wear it with trackers', act: 'i:pwear', v: 'any', dis }, { id: 'pmirror:on', label: 'Mirror the visitor', act: 'i:pmirror', v: '1.6', dis }] },
      { p: 'Worn: a performer moves it live, for everyone here, with any mix of devices: trackers (up to 11: head, chest, hips, hands, elbows, knees, feet), a headset, its controllers or tracked hands. Then line it up with the performer. Mirror: in a headset it copies whoever wears it, like a mirror, with no lining up; each person sees their own.', c: 'faint' });
    return;
  }
  if (P.mirror) {
    const M = it.mir;
    B.push({ label: 'Mirror the visitor', row: [{ id: 'pmirror:off', label: 'Stop mirroring', act: 'i:pmirror', v: 'off', dis }] },
      { label: 'You stand', row: MIR.D.map(d => ({ id: 'pmirror:' + d, label: `${d} m in front`, act: 'i:pmirror', v: String(d), on: P.mirror === d, dis })) },
      { kv: [['Now', M ? `mirroring you: ${M.list.map(x => x.word).join(', ')}` : 'its own animation (no headset here)'], ['Size', M ? `your eyes ${M.eye.now.toFixed(2)} m up, ${M.k.toFixed(2)} times its own` : 'as placed']] },
      { p: 'In a headset it stands opposite you and copies you at once, like a mirror: your left hand moves the hand on your left. It sees your headset, your controllers or bare hands, and the room\'s trackers near your body where there are any (a puck and a tag at each); whatever it cannot see it works out. Each person sees their own: nothing of it is sent or saved. Without a headset it plays its own animation.', c: 'faint' });
    if (it.pupWhy) B.push({ p: it.pupWhy, c: 'amber' });
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
    if (L.lost && L.lost.length) B.push({ p: 'Not seen now, so not lined up: ' + L.lost.map(x => `the ${PUP_WORD[x.s].toLowerCase()} (${pupSrcWord(P, x.id)}${PUP_BODY.test(x.id) && (!P.by || P.by === 'index') ? ': the Headset row chooses where a headset comes from' : ''})`).join('; ') + '. Choose a device for it above, or it is worked out.', c: 'amber' });
    if (!ok) B.push({ p: (L.m.why || L.why || 'Nothing is tied to the head or the hips: one of them must be.') + ' Choose a device for the head or the hips above, or line up again.', c: 'red' });
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
  // (v204) the visitor's mirror: on (how far in front of it you stand, m) or off
  pmirror: (it, v) => {
    if (it.kind !== 'o') return;
    if (PUP.line && PUP.line.id === it.id) pupEnd(it);
    const P = it.rec.puppet, d = +v;
    if (v === 'off') { if (P && P.mirror) setRec(it.id, { puppet: undefined }); return; }
    const rig = pupRig(it);
    if (!MIR.D.includes(d) || !rig || !rig.ok || (P && !P.mirror) || (P && P.mirror === d)) return;
    setRec(it.id, { puppet: { on: false, rig: 'any', mirror: d } });
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
