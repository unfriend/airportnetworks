// ================================================================= PUPPET ==
// Phase 3 of the trackers (tools/trackers/SPEC.md, "The studio, phase 3: a Mixamo character worn with trackers"; the
// owner, 8 November 2026: "we go for 1 and 3 with mixamo rigs for now"): an object whose model is rigged by Mixamo may be
// worn by a performer, its bones solved every frame by the solver (ik.js, makeIK) from the PC's trackers, on every device
// alike (nothing per bone is sent: the same tracker stream and the same record give the same pose).
//
// Two ways to wear it (the third, a headset alone, waits: the owner, "skip that part for now"):
// - 'full': trackers on the hips (a belt), head, both wrists and both feet (6), and if worn the chest, both elbows and both
//   knees (up to 11);
// - 'feet': a tracker on each foot; the head and hands from a headset and its controllers: the PC's Index (by 'index': its
//   headset and controllers come with the trackers, kinds 'h', 'l' and 'r') or the performer's own headset (by: their
//   member id; this device's own poses when it is the performer, else HOST.collab.body(by), their presence's head and hands).
// The object's record gains puppet: { on, rig: 'full' | 'feet', by, map: { slot: <a tracker's id, or '@head', '@l', '@r'
// for the performer's own headset> }, cal: { slot: [x, y, z, qx, qy, qz, qw] }, s, floor }, kept only when set: which
// tracker drives which part, each part's offset from its tracker to its bone found at the lining up, the object's scale then
// and the floor's height (the scene's: 0). Line up with the performer (its card): a 5 s countdown with the performer in a
// T-pose in front of it facing its way; the trackers given their parts (ik.js's assign: highest the head, lowest two the
// feet...), the character moved along the floor to where the performer stands (its parts at rest, on average, where their
// trackers are), scaled so its
// hips (or for 'feet' its eyes) are as high as the performer's, and each part's offset taken: one change, one Undo step.
// While it is on and lined up its own clip is off and its bones are solved (the parts the solver knows; fingers keep their
// rest pose); not solvable now (a part never seen here), it stands at rest and the card says why. Its holder stays where it
// is placed (the pointer finds it there, a ghost shows it while editing): the solver puts the bones where the trackers are.
//
// Record a take (its card): a 3 s countdown, then the solved bones sampled 30 times a second on the room's clock until Stop
// (at most 120 s), made into a clip (Take n) and the object's GLB made again with its clips and the new one through the
// converter (convertFile with take: with a relay that takes uploads into models/, the old file kept under originals/ when
// it was already there, every object of that file switched, a new picture; else downloaded). The take then plays as any
// clip (the card's Animation row, with wearing off).
const IK = makeIK(THREE);
const PUP_RIGS = ['full', 'feet'];
const PUP_SLOTS = ['hips', 'head', 'chest', 'lhand', 'rhand', 'lfoot', 'rfoot', 'lelbow', 'relbow', 'lknee', 'rknee'];
const PUP_WORD = { hips: 'Hips', head: 'Head', chest: 'Chest', lhand: 'Left hand', rhand: 'Right hand', lfoot: 'Left foot', rfoot: 'Right foot', lelbow: 'Left elbow', relbow: 'Right elbow', lknee: 'Left knee', rknee: 'Right knee' };
const PUP_RIG_WORD = { full: 'whole body', feet: 'feet and headset' };
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
const pupReady = P => !!(P && P.map && P.cal && IK.SETUPS[P.rig].need.every(s => P.map[s] && P.cal[s]));

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
// PUP.line: a lining up counting down ({ id, at (performance.now() when it is done), keep: the parts as they are });
// PUP.take: a take ({ id, phase: 'count' | 'rec' | 'make', at, t0, next, samples, name }); the last word on an item's
// lining up or take (note, noteC, noteId); sec: the countdown's second shown
const PUP = { line: null, take: null, note: '', noteC: 'muted', noteId: '', sec: -1 };
const pupSay = (id, s, c) => { PUP.note = s; PUP.noteC = c || 'muted'; PUP.noteId = id; dirty(true); };
// every frame (trkStep): the countdowns, the card redrawn each second
function pupTick(pn) {
  const L = PUP.line, T = PUP.take;
  const sec = L ? Math.ceil((L.at - pn) / 1000) : T && T.phase === 'count' ? Math.ceil((T.at - pn) / 1000) : T && T.phase === 'rec' ? Math.floor(pupClock() - T.t0) : -1;
  if (sec !== PUP.sec) { PUP.sec = sec; dirty(); }
  if (L && pn >= L.at) {
    PUP.line = null;
    const it = STU.items.get(L.id);
    if (it) {
      const why = !editOn() ? 'Editing is off: not lined up.' : lockWhy(it) ? `${it.rec.name} is locked in place: not lined up.` : pupLineUp(it, L.keep);
      pupSay(it.id, why || `Lined up with the performer: ${PUP_RIG_WORD[it.rec.puppet.rig]}, ${Object.keys(it.rec.puppet.map).length} parts, scale ${it.rec.s}.`, why ? 'red' : 'green');
      sfxAct(why ? 'knock' : 'ping', 'world', null);
    }
  }
  if (T && T.phase === 'count' && pn >= T.at) { T.phase = 'rec'; T.t0 = pupClock(); T.next = 0; dirty(true); }
}
function pupLineStart(it, keep) {
  const P = it.rec.puppet;
  if (!P || !STU.items.has(it.id)) return;
  PUP.line = { id: it.id, at: performance.now() + PUP_COUNT, keep: !!keep && !!P.map };
  pupSay(it.id, '', 'muted');
}
// the lining up itself (the countdown's end): '' done (one change, one Undo step), else why not, in words
function pupLineUp(it, keep) {
  const P = it.rec.puppet, rig = P && pupRig(it);
  if (!P) return 'It is not worn with trackers.';
  if (!rig || !rig.ok) return rig ? rig.why : 'Its model is not here yet.';
  if (!TRK.st) return 'No trackers here: line up at the studio\'s circle in a room that uses the PC\'s trackers.';
  // the character at rest where it is placed; the floor (the scene's, y = 0) in the world
  pupRest(it); poseRest(it); it.holder.updateMatrixWorld(true);
  const W = pupW(), floor = W.p.y;
  // the trackers seen now (worn ones by their place; the Index's headset and controllers by their kind)
  const worn = {}, idx = {};
  for (const x of TRK.at.values()) {
    if (!x.ok) continue;
    if (x.k === 't') worn[x.id] = worldPose(_pp1.fromArray(x.p), _pq1.fromArray(x.q), W); else idx[x.k] = x.id;
  }
  let map;
  if (keep && P.map) map = Object.assign({}, P.map);
  else {
    const a = IK.assign(rig, worn, P.rig, { floor });
    if (!a.ok) return a.why;
    map = a.map;
    if (P.rig === 'feet') {
      if (P.by === 'index') {
        if (!idx.h || !idx.l || !idx.r) return 'The PC\'s Index and both its controllers must be seen with the trackers (or choose This headset).';
        Object.assign(map, { head: idx.h, lhand: idx.l, rhand: idx.r });
      } else if (P.by) Object.assign(map, { head: '@head', lhand: '@l', rhand: '@r' });
      else return 'Choose where the head and hands come from: the PC\'s Index, or the performer\'s own headset.';
    }
  }
  const T = pupTargets(P.by, map, W);
  if (!T[map.lfoot] || !T[map.rfoot]) return 'Both feet\'s trackers must be seen.';
  // moved along the floor to where the performer stands: so that its parts at rest are, on average, where their trackers are
  // (each tracker sits off the bone it is strapped to, a belt's behind the hips, a foot's in front of the ankle, a headset in
  // front of the eyes: on average they mostly cancel out; the parts' offsets taken below keep what is left)
  const d = new THREE.Vector3();
  let n = 0;
  for (const sl of Object.keys(map)) {
    const t = T[map[sl]], r = IK.restPose(rig, sl === 'head' && P.rig === 'feet' ? 'eye' : PUP_PART[sl]);
    if (!t || !r) continue;
    d.x += t.p[0] - r.p.x; d.z += t.p[2] - r.p.z; n++;
  }
  d.multiplyScalar(1 / n).applyQuaternion(W.q.clone().invert()).divideScalar(W.s.x);
  const H = it.holder, p0 = H.position.clone(), s0 = H.scale.clone();
  const back = () => { H.position.copy(p0); H.scale.copy(s0); H.updateMatrixWorld(true); };
  const np = p0.clone().add(d).toArray().map(v => nz(r3(clamp(v, -1000, 1000))));
  H.position.fromArray(np); H.updateMatrixWorld(true);
  // sized (the hips, or the eyes, as high as the performer's), its offsets taken at the size the record keeps
  let c = IK.calibrate(rig, T, map, P.rig, { floor });
  if (!c.ok) { back(); return c.why; }
  const s = +Math.min(1e4, Math.max(1e-4, it.rec.s * c.s)).toPrecision(4);
  H.scale.setScalar(s); H.updateMatrixWorld(true);
  c = IK.calibrate(rig, T, map, P.rig, { floor, scale: false });
  back();
  if (!c.ok) return c.why;
  change(() => setRec(it.id, { p: np, s, puppet: Object.assign({}, P, { on: true, map: c.map, cal: c.cal, s, floor: 0 }) }));
  return '';
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
// the default for 'feet': the PC's Index when it is seen with the trackers, else this headset (in a session, in a room)
function pupMe() { try { return XR.on && GL.renderer.xr.isPresenting && HOST.collab && HOST.collab.joined ? HOST.collab.id || '' : ''; } catch (e) { return ''; } }
const pupByDefault = () => ([...TRK.at.values()].some(x => x.k === 'h') ? 'index' : pupMe() || 'index');
const pupSrcWord = (P, id) => (id === '@head' ? 'the performer\'s headset' : id === '@l' ? 'their left controller' : id === '@r' ? 'their right controller' : trkWord(id));
// Worn with trackers (an object's card, page and headset, editing on): for a model rigged by Mixamo; others told why not
function puppetBlocks(it, B, dis, mv) {
  const E = it.E;
  if (it.kind !== 'o' || !it.model || !E || !E.info || !E.info.rigged) return;
  const rig = pupRig(it), P = it.rec.puppet;
  if (!rig) return;
  if (!rig.ok) {
    B.push({ label: 'Worn with trackers', row: [{ id: 'pwear:full', label: 'Wear it with trackers', act: 'i:pwear', v: 'full', dis: true }] },
      { p: rig.why + ' Only a character rigged by Mixamo can be worn with trackers for now.', c: 'faint' });
    return;
  }
  if (!P) {
    B.push({ label: 'Worn with trackers', row: [{ id: 'pwear:full', label: 'Wear it: whole body', act: 'i:pwear', v: 'full', dis }, { id: 'pwear:feet', label: 'Wear it: feet and headset', act: 'i:pwear', v: 'feet', dis }] },
      { p: 'A performer moves it live, for everyone here: trackers on the hips, head, wrists and feet (6; up to 11 with the chest, elbows and knees), or a tracker on each foot with a headset and its controllers. Then line it up with the performer.', c: 'faint' });
    return;
  }
  const ready = pupReady(P), L = PUP.line && PUP.line.id === it.id ? PUP.line : null, T = PUP.take && PUP.take.id === it.id ? PUP.take : null, pn = performance.now();
  B.push({ label: 'Worn with trackers', row: PUP_RIGS.map(k => ({ id: 'pwear:' + k, label: k === 'full' ? 'Whole body' : 'Feet and headset', act: 'i:pwear', v: k, on: P.rig === k, dis: dis || !!L || !!T }))
    .concat({ id: 'pwear:none', label: 'Stop wearing', act: 'i:pwear', v: 'none', dis: dis || !!T }) });
  if (P.rig === 'feet') {
    const me = pupMe(), other = P.by && P.by !== 'index' && P.by !== me;
    B.push({ label: 'Head and hands from', row: [{ id: 'pby:index', label: 'The PC\'s Index', act: 'i:pupby', v: 'index', on: P.by === 'index', dis: dis || !!L },
      { id: 'pby:me', label: 'This headset', act: 'i:pupby', v: me, on: !!me && P.by === me, dis: dis || !!L || !me }].concat(other ? [{ id: 'pby:other', label: 'Another headset', act: 'i:pupby', v: P.by, on: true, dis: true }] : []) });
    if (!me && P.by !== 'index') B.push({ p: 'This headset: press it in the performer\'s own headset, in the room.', c: 'faint' });
  }
  B.push({ kv: [['Lined up', ready ? `yes: ${Object.keys(P.map).length} parts, scale ${P.s}` + (P.s && Math.abs(P.s - it.rec.s) > 1e-9 ? ` (sized since to ${it.rec.s}: line up again)` : '') : 'not yet'],
    ['Moves', P.on && ready ? 'with the performer (its own animation off)' : 'by its own animation']] });
  B.push({ label: 'With the performer', row: [{ id: 'pupon:on', label: 'On', act: 'i:pupon', v: 'on', on: P.on && ready, dis: dis || !ready }, { id: 'pupon:off', label: 'Off', act: 'i:pupon', v: 'off', on: !(P.on && ready), dis }] });
  if (L) B.push({ p: `Stand in a T-pose in front of it, facing its way, arms out to the sides: lining up in ${Math.max(0, Math.ceil((L.at - pn) / 1000))} s.`, c: 'amber' }, { row: [{ id: 'pupcancel', label: 'Cancel', act: 'i:pupcancel' }] });
  else B.push({ row: [{ id: 'pupline', label: 'Line up with the performer', act: 'i:pupline', primary: !ready, dis: dis || mv || !!T }].concat(P.map ? [{ id: 'pupkeep', label: 'Line up again, these parts', act: 'i:pupkeep', dis: dis || mv || !!T }] : []) },
    { p: 'A 5 s countdown: the performer stands in a T-pose in front of it, facing its way. Then the trackers find their parts, and the character goes to where the performer stands, sized to them. One Undo step.', c: 'faint' });
  if (PUP.noteId === it.id && PUP.note) B.push({ p: PUP.note, c: PUP.noteC });
  if (P.on && ready && it.pupWhy) B.push({ p: it.pupWhy + ' It stands at rest meanwhile.', c: 'amber' });
  // the parts (a press opens the trackers to choose from: the part is then lined up again, with these parts)
  if (P.map) {
    B.push({ label: 'Its parts', list: PUP_SLOTS.filter(s => P.map[s]).map(s => {
      const id = P.map[s], seen = PUP_BODY.test(id) ? true : trkSeen(id);
      return { id: 'pslot:' + s, label: PUP_WORD[s], sub: pupSrcWord(P, id) + (seen ? '' : ' · not seen') + (P.cal && P.cal[s] ? '' : ' · not lined up'), act: 'i:pupslot', v: s, on: STU.pupSlot === s, dis: dis || PUP_BODY.test(id) };
    }) });
    if (STU.pupSlot && P.map[STU.pupSlot]) {
      const s = STU.pupSlot, ks = ['head', 'lhand', 'rhand'].includes(s) && P.rig === 'feet' ? ['h', 'l', 'r'] : ['t'];
      const L2 = trkKnown().filter(x => ks.includes(x.k));
      B.push(L2.length ? { list: L2.map(x => ({ id: `pset:${s}:${x.id}`, label: trkWord(x.id), sub: (x.ok ? 'seen' : 'not seen now') + (Object.keys(P.map).find(k => P.map[k] === x.id && k !== s) ? ' · ' + PUP_WORD[Object.keys(P.map).find(k => P.map[k] === x.id)] + ' now' : ''), act: 'i:pupset', v: s + ':' + x.id, on: P.map[s] === x.id, dis })) }
        : { p: 'No other tracker here.', c: 'faint' }, { p: 'Another tracker for this part (two parts swap theirs); then Line up again, these parts.', c: 'faint' });
    }
  }
  // a take
  if (T && T.phase === 'count') B.push({ p: `Recording a take in ${Math.max(0, Math.ceil((T.at - pn) / 1000))} s.`, c: 'amber' }, { row: [{ id: 'takecancel', label: 'Cancel', act: 'i:takecancel' }] });
  else if (T && T.phase === 'rec') B.push({ p: `Recording a take: ${Math.floor(pupClock() - T.t0)} s of at most ${TAKE_MAX}.`, c: 'amber' }, { row: [{ id: 'takestop', label: 'Stop', act: 'i:takestop', primary: true }, { id: 'takecancel', label: 'Cancel', act: 'i:takecancel' }] });
  else if (T) B.push({ p: `Making ${T.name || 'the take'}: ${CV.note || 'into its GLB...'}`, c: 'muted' });
  else if (P.on && ready) B.push({ label: 'Takes', row: [{ id: 'take', label: 'Record a take', act: 'i:take', dis: dis || !!CV.busy || !!L }] },
    { p: `The bones as the performer moves them, 30 times a second, up to ${TAKE_MAX} s after a 3 s countdown, then made into a clip (Take 1, Take 2...) in its GLB` + (canUpload() ? ' (into models/; every object of the file switches to it)' : ' (downloaded: put it in the scene\'s models/ folder)') + '. It plays as any clip, with wearing off.', c: 'faint' });
}
// the card's actions (one Undo step each, but for the countdowns, the list of parts and the takes: this device's own)
Object.assign(ITEM_ACT, {
  pwear: (it, v) => {
    if (it.kind !== 'o') return;
    if (PUP.line && PUP.line.id === it.id) PUP.line = null;
    if (v === 'none') { if (it.rec.puppet) setRec(it.id, { puppet: undefined }); return; }
    const P = it.rec.puppet, rig = pupRig(it);
    if (!PUP_RIGS.includes(v) || (P && P.rig === v) || !rig || !rig.ok) return;
    setRec(it.id, { puppet: { on: false, rig: v, by: v === 'feet' ? (P && P.by) || pupByDefault() : undefined } });
  },
  pupon: (it, v) => { const P = it.rec.puppet, on = v === 'on'; if (P && (!on || pupReady(P)) && P.on !== on) setRec(it.id, { puppet: Object.assign({}, P, { on }) }); },
  // where the head and hands come from ('feet'): the feet's trackers kept, the rest lined up again
  pupby: (it, v) => {
    const P = it.rec.puppet;
    if (!P || P.rig !== 'feet' || !v || P.by === v) return;
    setRec(it.id, { puppet: { on: false, rig: P.rig, by: v, map: P.map && P.map.lfoot && P.map.rfoot ? { lfoot: P.map.lfoot, rfoot: P.map.rfoot } : undefined } });
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
  pupslot: (it, s) => { STU.pupSlot = STU.pupSlot === s ? '' : s; },
  pupline: it => pupLineStart(it, false),
  pupkeep: it => pupLineStart(it, true),
  pupcancel: () => { PUP.line = null; },
  take: it => takeStart(it),
  takestop: () => takeStop(true),
  takecancel: () => takeStop(false),
});
PANE_ONLY.push('pupslot', 'pupline', 'pupkeep', 'pupcancel', 'take', 'takestop', 'takecancel');
MOVE_ACTS.push('pupline', 'pupkeep');   // (lining up moves and sizes it: refused while it is locked in place)
// (for tests and the console, STUDIO.puppet)
function pupState(id) {
  const it = STU.items.get(id), rig = it && it.kind === 'o' ? pupRig(it) : null, P = it && it.rec.puppet, T = PUP.take;
  return { rig: rig ? (rig.ok ? 'ok' : rig.why) : null, rec: P || null, ready: pupReady(P), on: !!(it && it.pupOn), why: (it && it.pupWhy) || '', line: PUP.line ? { id: PUP.line.id, left: PUP.line.at - performance.now(), keep: PUP.line.keep } : null,
    take: T ? { id: T.id, phase: T.phase, n: T.samples.length, name: T.name } : null, note: PUP.noteId === id ? PUP.note : '', clip: !!(it && it.action) };
}
