// =============================================================== TRACKERS ==
// The owner, 8 November 2026: "i have a lot of them and it would make sense to implement them also for props and camera
// tracking and things like that, and also for live puppetry"; "we go for 1 and 3 with mixamo rigs for now". Phase 1
// (tools/trackers/SPEC.md, "The studio, phase 1: props that follow a tracker"): an object, a shape or an empty may follow
// one of the PC's Vive trackers. The shell brings them (the relay's @trk stream, HOST.collab.trackers(): each { id (its
// serial), name, p, q, ok, k } in room coordinates, interpolated, a tracker not seen keeping its last pose), and at a studio
// station the scene's frame is the room's (v125: the scene stands on the room's frame there, its circle only the way in),
// so a tracker's room pose is the scene's: nothing to turn or move. Elsewhere (no room, a page not at a studio circle)
// there are no trackers here.
//
// The record's trk: { id: <serial>, o: [x, y, z], q: [x, y, z, w] }, the item's pose in the tracker's frame (metres to the
// mm, turned but not scaled; 4 decimals), kept only when set. Drawn through the pose pipeline as its base stage (POSE.base,
// as behaviours are, e6g_behave.js: set only while the scene has an item on a tracker or a behaviour): the tracker's pose
// times the offset, at the item's own scale; its recorded path and its motion draw over it, and the record never changes.
// A tracker not seen: its last pose held; never seen here: the item where it is placed. Like everything that moves it rests
// at its placed pose while held here or paused (motionRests, v122). A sound may follow such an item as any other. Choosing
// a tracker keeps the item where it stands now (the offset from the tracker's pose now); Snap onto it puts it right on the
// tracker; None leaves it where the tracker had it. A copy (Duplicate, a group's) follows no tracker: it is new, to be put
// where it goes. Switched to its GLB, its offset's turn takes the baked turn (switchedRec), so it stays where it was.
const TRK_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,39}$/;   // (a tracker's serial, LHR-XXXXXXXX)
// a trk as a record keeps it (null: bad, which makes the record bad): its tracker's id required, the offset's place and
// turn [0, 0, 0] and none when left out
function normTrk(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x) || typeof x.id !== 'string' || !TRK_ID.test(x.id)) return null;
  const o = x.o === undefined ? [0, 0, 0] : vecOf(x.o, 3, 1000), q = x.q === undefined ? [0, 0, 0, 1] : quatOf(x.q);
  if (!o || !q) return null;
  return { id: x.id, o: o.map(v => nz(r3(v))), q };
}

// ------------------------------------------------------------ the stream --
// at: the trackers the shell gives this frame, by id ({ id, name, k ('t' a tracker, 'h' the Index, 'l' and 'r' its
// controllers), p, q, ok }); last: each one's last pose seen here ({ p, q }), held while it is not seen; names: the names
// the room gave them; st: the station they were seen at (another: none seen here yet); any: an item follows one
const TRK = { at: new Map(), last: new Map(), names: new Map(), st: '', any: false };
const trkKind = x => { const k = x.k || x.kind || 't'; return k === 'h' || k === 'hmd' ? 'h' : k === 'l' || k === 'r' ? k : k === 'ctl' ? (x.h === 'l' || x.h === 'r' ? x.h : 'c') : k === 'base' ? 'base' : 't'; };
const trkArr = (v, n) => (Array.isArray(v) ? (v.length === n ? v : null) : v && typeof v === 'object' ? (n === 3 ? [v.x, v.y, v.z] : [v.x, v.y, v.z, v.w]) : null);
// what the shell gives now (an older shell, or none: nothing)
function trkRead() {
  let L = null;
  try { L = HOST.collab && HOST.collab.trackers ? HOST.collab.trackers() : null; } catch (e) { L = null; }
  if (!Array.isArray(L)) return [];
  const out = [];
  for (const x of L.slice(0, 64)) {
    if (!x || typeof x.id !== 'string' || !TRK_ID.test(x.id)) continue;
    const k = trkKind(x);
    if (k === 'base') continue;   // (base stations: never a prop's)
    const p = trkArr(x.p, 3), q = trkArr(x.q, 4), n = q ? Math.hypot(...q) : 0;
    const good = !!p && !!q && p.every(v => fin(v) && Math.abs(v) < 1e4) && q.every(fin) && n > 1e-6;
    out.push({ id: x.id, name: typeof x.name === 'string' ? words(x.name, 24) : '', k, p: good ? p.slice() : null, q: good ? q.map(v => v / n) : null, ok: good && x.ok !== false && x.ok !== 0 });
  }
  return out;
}
// every frame, first of all (behaveStep): the trackers here now, and whether the pipeline's base stage is needed for them
function trkStep(pn) {
  TRK.any = [...STU.items.values()].some(it => MOTION_ITEMS.includes(it.kind) && it.rec.trk);
  const sid = atStation() ? stationId() || 'here' : '';
  if (sid !== TRK.st) { TRK.st = sid; TRK.last.clear(); }
  TRK.at.clear();
  if (sid) for (const x of trkRead()) {
    TRK.at.set(x.id, x);
    if (x.name) TRK.names.set(x.id, x.name);
    if (x.p) TRK.last.set(x.id, { p: x.p, q: x.q, k: x.k });
  }
  pupTick(pn);   // (the puppet's countdowns: e6l_puppet.js)
}
// a tracker's pose in the scene's frame (held while it is not seen), or false: never seen here
function trkPose(id, P, Q) {
  const L = TRK.last.get(id);
  if (!L) return false;
  P.fromArray(L.p); Q.fromArray(L.q);
  return true;
}
const trkSeen = id => { const x = TRK.at.get(id); return !!(x && x.ok); };
const TRK_KIND = { h: 'Index headset', l: 'left controller', r: 'right controller', c: 'controller', t: 'tracker' };
const trkWord = id => TRK.names.get(id) || id;
// the trackers known here (seen now, or held), by name: what the card offers
function trkKnown() {
  const ids = new Set([...TRK.at.keys(), ...TRK.last.keys()]);
  return [...ids].map(id => ({ id, k: (TRK.at.get(id) || TRK.last.get(id) || {}).k || 't', ok: trkSeen(id) })).sort((a, b) => trkWord(a.id).localeCompare(trkWord(b.id)));
}

// ------------------------------------------------------- the base stage --
// the pipeline's base stage (POSE.base, e6e_motion.js): an item on a tracker, the tracker's pose times its offset at its own
// scale; else a behaviour's (behaveBase); false: neither, its placed pose. Set by behaveStep while the scene has either
const _tkP = new THREE.Vector3(), _tkQ = new THREE.Quaternion(), _tkO = new THREE.Vector3(), _tkR = new THREE.Quaternion();
function trkBase(it, out) {
  const t = it.rec && it.rec.trk;
  if (!t || !trkPose(t.id, _tkP, _tkQ)) return false;
  _tkO.fromArray(t.o).applyQuaternion(_tkQ).add(_tkP);
  out.compose(_tkO, _tkR.fromArray(t.q).premultiply(_tkQ), it.holder.scale);
  return true;
}
function poseBase(it, now, clockS, out) { return trkBase(it, out) || behaveBase(it, now, clockS, out); }
// where it stands now, as a pose in the scene's frame: where its tracker has it (seen or held), else where it is placed
const _tkM = new THREE.Matrix4(), _tkS = new THREE.Vector3();
function trkStands(it, P, Q) {
  if (!trkBase(it, _tkM)) _tkM.compose(it.holder.position, it.holder.quaternion, it.holder.scale);
  _tkM.decompose(P, Q, _tkS);
}

// ------------------------------------------------------------- the card --
// Follows a tracker (an object's, a shape's and an empty's card, page and headset, editing on): None, the tracker it follows
// (a press opens the list of those known here, by name or serial), Snap onto it; and how it stands
function trkBlocks(it, B, dis) {
  if (!MOTION_ITEMS.includes(it.kind)) return;
  const t = it.rec.trk, L = trkKnown(), open = STU.trkList === it.id;
  B.push({ label: 'Follows a tracker', row: [{ id: 'trk:none', label: 'None', act: 'i:trk', v: 'none', on: !t, dis },
    { id: 'trklist', label: (t ? trkWord(t.id) : 'A tracker') + (open ? ' ▾' : ' ▸'), act: 'i:trkpick', on: !!t || open, dis: dis || (!L.length && !t) }]
    .concat(t ? [{ id: 'trksnap', label: 'Snap onto it', act: 'i:trksnap', dis }] : []) });
  if (open) {
    B.push(L.length ? { list: L.map(x => ({ id: 'trkto:' + x.id, label: trkWord(x.id), sub: (x.k !== 't' ? TRK_KIND[x.k] + ' · ' : '') + (TRK.names.has(x.id) ? x.id + ' · ' : '') + (x.ok ? 'seen' : 'not seen now'), act: 'i:trk', v: x.id, on: !!t && t.id === x.id, dis })) }
      : { p: 'No trackers here.', c: 'faint' });
  }
  if (t) {
    const word = trkWord(t.id);
    B.push(trkSeen(t.id) ? { p: `It moves with ${word}, keeping where it stood on it (Snap onto it puts it right on the tracker). Carried here or paused, it rests where it is placed.`, c: 'faint' }
      : TRK.last.has(t.id) ? { p: `${word} is not seen now: it holds where the tracker was last seen.`, c: 'amber' }
        : { p: `${word} has not been seen here: it stands where it is placed until it is (the PC's trackers reach a studio circle in a room that uses them).`, c: 'amber' });
  } else if (!L.length) B.push({ p: 'One of the PC\'s Vive trackers can carry it: at a studio circle in a room whose Shared dialog uses the PC\'s trackers. None here now.', c: 'faint' });
  else B.push({ p: 'Choose a tracker and it moves with it from where it stands now.', c: 'faint' });
}
// the card's actions (one Undo step each): a tracker chosen (the offset from its pose now, so the item stays where it
// stands), none (it stays where the tracker had it), snapped onto it; the list opened (this device's own)
Object.assign(ITEM_ACT, {
  trk: (it, v) => {
    if (!MOTION_ITEMS.includes(it.kind)) return;
    STU.trkList = '';
    const t = it.rec.trk, P = new THREE.Vector3(), Q = new THREE.Quaternion();
    trkStands(it, P, Q);
    if (v === 'none' || !v) { if (t) setRec(it.id, { trk: undefined, p: P.toArray(), q: Q.toArray() }); return; }
    if (!TRK_ID.test(v) || (t && t.id === v)) return;
    const TP = new THREE.Vector3(), TQ = new THREE.Quaternion();
    if (!trkPose(v, TP, TQ)) return;   // (not seen here: no pose to keep it against)
    const iq = TQ.clone().invert();
    setRec(it.id, { trk: { id: v, o: P.sub(TP).applyQuaternion(iq).toArray(), q: iq.multiply(Q).normalize().toArray() } });
  },
  trksnap: it => { const t = it.rec.trk; if (t && (t.o.some(v => v) || t.q[3] !== 1)) setRec(it.id, { trk: { id: t.id, o: [0, 0, 0], q: [0, 0, 0, 1] } }); },
  trkpick: it => { STU.trkList = STU.trkList === it.id ? '' : it.id; },
});
PANE_ONLY.push('trkpick');
MOVE_ACTS.push('trk', 'trksnap');   // (locked in place: it follows no new tracker)
// (for tests and the console, STUDIO.trk: the trackers here and an item's pose on its tracker)
function trkState(id) {
  const it = id ? STU.items.get(id) : null, m = new THREE.Matrix4();
  return { st: TRK.st, any: TRK.any, base: POSE.base === poseBase, at: [...TRK.at.values()].map(x => ({ id: x.id, k: x.k, ok: x.ok, name: x.name })), held: [...TRK.last.keys()],
    item: it ? { trk: it.rec.trk || null, on: !!(it.rec.trk && trkBase(it, m)), pose: it.rec.trk && trkBase(it, m) ? m.toArray() : null, seen: !!(it.rec.trk && trkSeen(it.rec.trk.id)) } : null };
}
