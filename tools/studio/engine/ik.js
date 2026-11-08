// ================================================================ IK ==
// The puppet's solver (tools/trackers/SPEC.md, "The studio, phase 3" and "The solver (ik.js)"): a character rigged by
// Mixamo worn with trackers, a headset and controllers. A plain module like convert.js and images.js: one function of
// THREE, no DOM, nothing fetched or drawn, run in Node by tools/studio/test-ik.mjs (not yet in tools/studio/build.mjs: the
// studio does not use it yet). Everything is in three.js's world frame (the targets, the floor at y = cal.floor, up +y);
// the caller turns room or scene coordinates into it. A pose is { p: [x, y, z], q: [x, y, z, w] } (or Vector3 and
// Quaternion). makeIK(THREE) gives:
//   rigOf(root)         the humanoid's bones under root, found by Mixamo's names (mixamorig:Hips ... as three.js names
//                       them, mixamorigHips; leniently: any case, no prefix, mixamorig1:) -> { ok: true, bones, parts,
//                       rest, ... } with its rest pose (the bones' local place and turn as they are now: call it on the
//                       model as loaded, before a clip plays; rig.toRest() puts them back), or { ok: false, why } (a
//                       sentence for the card)
//   SETUPS              the three ways to wear it and their parts: 'full' (trackers on the hips, head, both hands and both
//                       feet; the chest, elbows and knees if worn), 'feet' (a tracker on each foot; the head and hands from
//                       a headset and its controllers), 'head' (a headset and two controllers: the feet stepped)
//   assign(rig, targets, setup, o)   which target is which part, from a T-pose facing the character's way (targets
//                       { id: pose }): the highest the head, the lowest two the feet, the two furthest out the hands, left
//                       and right by the character's facing, then the hips, chest, elbows and knees nearest where they
//                       would be -> { ok, map: { slot: id }, left: [ids not used], why }. 'feet' gives the feet only and
//                       'head' nothing: the caller names the headset and controllers
//   calibrate(rig, targets, map, setup, o)   the performer in a T-pose facing the character's way, standing in it: the
//                       scale (s: the character's hips as high as the performer's, or for 'feet' and 'head' its eyes as high
//                       as the headset; o.scale false keeps its size), and each part's offset from its target's pose to
//                       its bone's world pose at rest with the character scaled by s about its origin (o.floor: the
//                       floor's height, else the origin's) -> { ok, v, setup, s, floor, map, cal: { slot: [x, y, z, qx,
//                       qy, qz, qw] } } (plain JSON, for a shared record), or { ok: false, why }. The caller then scales
//                       the character by s (its holder about its origin) before solving
//   solve(rig, cal, targets, dt, state)   the bones for this frame: the hips placed and turned (from their tracker, else
//                       worked out below the head so the head is where its target is, turned with the head and the feet,
//                       and for 'feet' lowered when a foot could not be reached), the spine bent from the hips to the
//                       chest (or half way to the head), the neck half way and the head turned as its target, the arms and
//                       legs by two-bone inverse kinematics to the hands and feet (the elbows and knees towards their
//                       trackers where worn, else a natural bend: elbows down and back, knees forward), the hands and feet
//                       turned as their targets; 'head' steps its feet (each planted until the hips have left it behind,
//                       then moved in a short arc to a new place, one foot at a time). state ({} to start) carries what
//                       must last between frames (the planted feet, the hips' heading, the last poses seen). Deterministic:
//                       the same targets, dt and state give the same pose on every device. The toes and the top of the head
//                       go back to rest; bones it does not know (fingers) keep their pose. -> { ok, why } (for 'head',
//                       state.started is the foot that began a step this frame, or -1, state.n the steps so far)
//   restPose(rig, part) a part's world pose at rest where the character stands now ('eye': the point a headset is worn at)
//   sample(rig, t), clipOf(samples, name, fps)   the bones' local turns and the hips' place, to be taken 30 times a second
//                       while solving, made into a THREE.AnimationClip (a take)
// Assumptions: uniform scales (bones scaled 1, as Mixamo's); the elbows bend forward and the knees back (their hinges are
// worked out from the character's facing at rest, as Mixamo's T-pose has them); world up is +y.
function makeIK(THREE) {
  const T = THREE, V = () => new T.Vector3(), Q = () => new T.Quaternion(), UP = new T.Vector3(0, 1, 0);
  // ---- the parts, by Mixamo's names without their prefix (lower case, letters and digits)
  const NAMES = {
    hips: 'Hips', spine: 'Spine', spine1: 'Spine1', spine2: 'Spine2', neck: 'Neck', head: 'Head', headtop: 'HeadTop_End',
    lsh: 'LeftShoulder', larm: 'LeftArm', lfore: 'LeftForeArm', lhand: 'LeftHand', lup: 'LeftUpLeg', lleg: 'LeftLeg', lfoot: 'LeftFoot', ltoe: 'LeftToeBase',
    rsh: 'RightShoulder', rarm: 'RightArm', rfore: 'RightForeArm', rhand: 'RightHand', rup: 'RightUpLeg', rleg: 'RightLeg', rfoot: 'RightFoot', rtoe: 'RightToeBase',
  };
  const KEY = Object.fromEntries(Object.entries(NAMES).map(([p, n]) => [n.toLowerCase().replace(/[^a-z0-9]/g, ''), p]));
  const NEED = ['hips', 'spine', 'head', 'larm', 'lfore', 'lhand', 'rarm', 'rfore', 'rhand', 'lup', 'lleg', 'lfoot', 'rup', 'rleg', 'rfoot'];
  const keyOf = n => String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^mixamorig\d*/, '');
  const mix = p => 'mixamorig:' + NAMES[p];
  const words = a => (a.length < 2 ? a.join('') : a.length > 3 ? `${a.slice(0, 3).join(', ')} and ${a.length - 3} more` : `${a.slice(0, -1).join(', ')} or ${a[a.length - 1]}`);
  // the chains: [part, its parent part (the first that the rig has)]
  const CHAIN = [['spine', ['hips']], ['spine1', ['spine']], ['spine2', ['spine1', 'spine']], ['neck', ['spine2', 'spine1', 'spine']], ['head', ['neck', 'spine2', 'spine1', 'spine']],
    ['headtop', ['head']], ...['l', 'r'].flatMap(s => [[s + 'sh', ['spine2', 'spine1', 'spine']], [s + 'arm', [s + 'sh', 'spine2', 'spine1', 'spine']], [s + 'fore', [s + 'arm']],
      [s + 'hand', [s + 'fore']], [s + 'up', ['hips']], [s + 'leg', [s + 'up']], [s + 'foot', [s + 'leg']], [s + 'toe', [s + 'foot']]])];
  // the slots a target drives, and the bone each is lined up with (the elbows and knees: the joint, the forearm's and the
  // shin's origin, rigid with either bone it is strapped to)
  const SLOT_BONE = { hips: 'hips', head: 'head', chest: 'chest', lhand: 'lhand', rhand: 'rhand', lfoot: 'lfoot', rfoot: 'rfoot', lelbow: 'lfore', relbow: 'rfore', lknee: 'lleg', rknee: 'rleg' };
  const SLOT_WORD = { hips: 'hips', head: 'head', chest: 'chest', lhand: 'left hand', rhand: 'right hand', lfoot: 'left foot', rfoot: 'right foot', lelbow: 'left elbow', relbow: 'right elbow', lknee: 'left knee', rknee: 'right knee' };
  const SETUPS = {
    full: { need: ['hips', 'head', 'lhand', 'rhand', 'lfoot', 'rfoot'], may: ['chest', 'lelbow', 'relbow', 'lknee', 'rknee'] },
    feet: { need: ['head', 'lhand', 'rhand', 'lfoot', 'rfoot'], may: [] },
    head: { need: ['head', 'lhand', 'rhand'], may: [] },
  };
  const fin = x => typeof x === 'number' && isFinite(x);
  const r4 = x => Math.round(x * 1e4) / 1e4, r5 = x => Math.round(x * 1e5) / 1e5;
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const wrap = a => { a = (a + Math.PI) % (2 * Math.PI); return a < 0 ? a + Math.PI : a - Math.PI; };
  const yawOf = v => Math.atan2(v.x, v.z);   // (about +y, from +z towards +x)
  const yawQ = (a, out) => out.setFromAxisAngle(UP, a);
  // (a turn from two directions: x along d, y along h made square to it; their frame at rest gives the bone's turn)
  const M4 = new T.Matrix4(), BX = V(), BY = V(), BZ = V();
  function basisQ(d, h, out) {
    BX.copy(d).normalize(); BY.copy(h).addScaledVector(BX, -BY.dot(BX));
    if (BY.lengthSq() < 1e-16) { BY.set(BX.y, -BX.x, 0); if (BY.lengthSq() < 1e-12) BY.set(0, BX.z, -BX.y); }
    BY.normalize(); BZ.crossVectors(BX, BY);
    return out.setFromRotationMatrix(M4.makeBasis(BX, BY, BZ));
  }

  // ---- rigOf: the bones, the chains and the rest pose
  function rigOf(root) {
    if (!root || !root.traverse) return { ok: false, why: 'Nothing to wear: no model.' };
    const bones = {};
    let n = 0;
    root.traverse(o => { if (!o.isBone) return; n++; const p = KEY[keyOf(o.name)]; if (p && !bones[p]) bones[p] = o; });
    if (!n) return { ok: false, why: 'This model has no bones: only a character rigged by Mixamo can be worn.' };
    const miss = NEED.filter(p => !bones[p]);
    if (miss.length) return { ok: false, why: `Not a Mixamo rig: no bone named ${words(miss.map(mix))}.` };
    // each part's parent: the first of its possible parents the rig has, which must be its bone's own parent
    const PAR = { hips: '' };
    for (const [p, ps] of CHAIN) {
      if (!bones[p]) continue;
      const par = ps.find(x => bones[x]);
      if (!par || bones[p].parent !== bones[par]) {
        if (p === 'headtop' || /toe$/.test(p)) { delete bones[p]; continue; }   // (an end the solver only carries along)
        return { ok: false, why: `Its bones are not in Mixamo's order: ${mix(p)} is not under ${mix(par || ps[0])}.` };
      }
      PAR[p] = par;
    }
    const parts = Object.keys(PAR).filter(p => bones[p]);   // (parents before children: CHAIN's order)
    const spines = ['spine', 'spine1', 'spine2'].filter(p => bones[p]), chest = spines[spines.length - 1];
    // the rest pose: each bone's local place, turn and scale, and its place and turn in the hips' parent's frame (P)
    const rest = {}, rp = {}, rq = {}, rs = {};
    for (const p of parts) {
      const b = bones[p], r = rest[p] = { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.x }, par = PAR[p];
      if (!par) { rp[p] = r.p.clone(); rq[p] = r.q.clone(); rs[p] = r.s; continue; }
      rp[p] = r.p.clone().multiplyScalar(rs[par]).applyQuaternion(rq[par]).add(rp[par]);
      rq[p] = rq[par].clone().multiply(r.q); rs[p] = rs[par] * r.s;
    }
    // its own axes at rest (in P): up from its feet to its head, left from its right side to its left (arms and hips),
    // forward = left x up (Mixamo's faces +z with its left at +x)
    const up = rp.head.clone().sub(rp.lfoot.clone().add(rp.rfoot).multiplyScalar(0.5)).normalize();
    const left = rp.larm.clone().sub(rp.rarm).add(rp.lup.clone().sub(rp.rup));
    left.addScaledVector(up, -left.dot(up)).normalize();
    const fwd = V().crossVectors(left, up);
    // the two-bone chains: lengths in the upper's and the lower's own units, each bone's direction to the next and the
    // hinge (the elbows bend forward, the knees back) in its own frame, and their frames at rest
    const limb = (u, l, e, bend) => {
      const dir = rp[l].clone().sub(rp[u]).normalize(), hinge = V().crossVectors(dir, bend).normalize();
      const L = { u, l, e, a: rest[l].p.length(), b: rest[e].p.length(), hinge, dU: rest[l].p.clone().normalize(), dL: rest[e].p.clone().normalize() };
      L.hU = hinge.clone().applyQuaternion(rq[u].clone().invert()); L.hL = hinge.clone().applyQuaternion(rq[l].clone().invert());
      L.bU = basisQ(L.dU, L.hU, Q()).invert(); L.bL = basisQ(L.dL, L.hL, Q()).invert();
      return L;
    };
    const back = fwd.clone().negate();
    const limbs = { larm: limb('larm', 'lfore', 'lhand', fwd), rarm: limb('rarm', 'rfore', 'rhand', fwd), lleg: limb('lup', 'lleg', 'lfoot', back), rleg: limb('rup', 'rleg', 'rfoot', back) };
    // the eyes (where a headset is worn: for the scale of 'feet' and 'head'): above the head bone by nearly half its
    // height to the top of the head, else by 6 % of its height over the ankles
    const above = bones.headtop ? 0.45 * rp.headtop.clone().sub(rp.head).dot(up) : 0.06 * rp.head.clone().sub(rp.lfoot.clone().add(rp.rfoot).multiplyScalar(0.5)).dot(up);
    const eye = rp.head.clone().addScaledVector(up, above);
    // the names a clip's tracks bind by (three.js's PropertyBinding takes no . [ ] : / in a name: then the bone's uuid)
    const track = {};
    for (const p of parts) track[p] = /[[\].:/]/.test(bones[p].name) || !bones[p].name ? bones[p].uuid : bones[p].name;
    const rig = { ok: true, root, bones, parts, PAR, spines, chest, rest, rp, rq, rs, up, left, fwd, limbs, eye, track };
    rig.toRest = () => { for (const p of parts) { const b = bones[p], r = rest[p]; b.position.copy(r.p); b.quaternion.copy(r.q); b.scale.setScalar(r.s); } };
    return rig;
  }

  // ---- frames and poses
  // the hips' parent's frame in the world (its place, turn and uniform scale)
  const TS = V();
  function frameOf(rig, F) {
    F = F || { p: V(), q: Q(), s: 1 };
    const par = rig.bones.hips.parent;
    if (!par) { F.p.set(0, 0, 0); F.q.identity(); F.s = 1; return F; }
    par.updateWorldMatrix(true, false);
    par.matrixWorld.decompose(F.p, F.q, TS);
    F.s = (TS.x + TS.y + TS.z) / 3;
    return F;
  }
  // a part's world pose at rest in frame F (p in P, turned and scaled into the world)
  const restAt = (rig, F, p, q, out) => { out.p.copy(p).multiplyScalar(F.s).applyQuaternion(F.q).add(F.p); out.q.copy(F.q).multiply(q); return out; };
  function restPose(rig, part) {
    const F = frameOf(rig), o = { p: V(), q: Q() };
    if (part === 'eye') return restAt(rig, F, rig.eye, rig.rq.head, o);
    const b = part === 'chest' ? rig.chest : part;
    return rig.rp[b] ? restAt(rig, F, rig.rp[b], rig.rq[b], o) : null;
  }
  // a target's pose read (arrays or three.js objects), or null
  function poseOf(t, out) {
    if (!t) return null;
    const p = t.p || t.position, q = t.q || t.quaternion;
    if (!p || !q) return null;
    if (Array.isArray(p)) out.p.fromArray(p); else out.p.copy(p);
    if (Array.isArray(q)) out.q.fromArray(q); else out.q.copy(q);
    if (![out.p.x, out.p.y, out.p.z, out.q.x, out.q.y, out.q.z, out.q.w].every(fin) || out.q.lengthSq() < 1e-8) return null;
    out.q.normalize();
    return out;
  }
  const newPose = () => ({ p: V(), q: Q() });

  // ---- assign: which target is which part, from a T-pose
  function assign(rig, targets, setup, o) {
    o = o || {};
    if (!rig || !rig.ok) return { ok: false, map: null, why: (rig && rig.why) || 'Not a rig.' };
    if (!SETUPS[setup]) return { ok: false, map: null, why: `No such way to wear it: ${setup}.` };
    const pts = Object.keys(targets || {}).map(id => ({ id, p: (poseOf(targets[id], newPose()) || {}).p })).filter(x => x.p);
    if (setup === 'head') return { ok: true, map: {}, left: pts.map(x => x.id) };
    const F = frameOf(rig), L = rig.left.clone().applyQuaternion(F.q);
    L.y = 0; L.normalize();
    const map = {}, used = new Set(), byY = pts.slice().sort((a, b) => a.p.y - b.p.y);
    const side = (a, b) => (a.p.dot(L) >= b.p.dot(L) ? [a, b] : [b, a]);   // ([the left one, the right one])
    if (setup === 'feet') {
      if (byY.length < 2) return { ok: false, map: null, why: `A tracker on each foot: ${byY.length} seen.` };
      const [l, r] = side(byY[0], byY[1]);
      return { ok: true, map: { lfoot: l.id, rfoot: r.id }, left: pts.filter(x => x !== l && x !== r).map(x => x.id) };
    }
    if (byY.length < 6) return { ok: false, map: null, why: `Six trackers at least for the whole body (the hips, head, both hands and both feet): ${byY.length} seen.` };
    const head = byY[byY.length - 1], [lf, rf] = side(byY[0], byY[1]);
    const floor = fin(o.floor) ? o.floor : rig.root.getWorldPosition(V()).y, H = head.p.y - floor;
    const mid = lf.p.clone().add(rf.p).multiplyScalar(0.5).add(head.p).multiplyScalar(0.5);
    mid.y = floor;
    const lat = x => x.p.clone().sub(mid).dot(L);
    let rest = byY.slice(2, -1);
    const lh = rest.reduce((m, x) => (!m || lat(x) > lat(m) ? x : m), null), rh = rest.reduce((m, x) => (!m || lat(x) < lat(m) ? x : m), null);
    if (!(H > 0.3) || !lh || !rh || lh === rh || lat(lh) < 0.2 * H || lat(rh) > -0.2 * H) {
      return { ok: false, map: null, why: 'Stand in a T-pose facing the character\'s way, arms out to the sides: no hand found on both sides.' };
    }
    Object.assign(map, { head: head.id, lfoot: lf.id, rfoot: rf.id, lhand: lh.id, rhand: rh.id });
    for (const x of [head, lf, rf, lh, rh]) used.add(x);
    rest = rest.filter(x => !used.has(x));
    // where the others would be: the hips at 56 % of the head's height, the chest at 77 %, the elbows half way from the
    // shoulders to the hands, the knees above the feet at 29 %
    const at = (base, lateral, h) => base.clone().addScaledVector(L, lateral).setY(floor + h);
    const shoulder = (hand, s) => at(mid, s * 0.11 * H, hand.p.y - floor);
    const want = { hips: at(mid, 0, 0.56 * H), chest: at(mid, 0, 0.77 * H), lelbow: shoulder(lh, 1).add(lh.p).multiplyScalar(0.5), relbow: shoulder(rh, -1).add(rh.p).multiplyScalar(0.5),
      lknee: lf.p.clone().setY(floor + 0.29 * H), rknee: rf.p.clone().setY(floor + 0.29 * H) };
    const pairs = [];
    for (const s in want) for (const x of rest) pairs.push([want[s].distanceTo(x.p), s, x]);
    pairs.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1));
    for (const [d, s, x] of pairs) if (!map[s] && !used.has(x) && (s === 'hips' || d < 0.25 * H)) { map[s] = x.id; used.add(x); }
    if (!map.hips) return { ok: false, map: null, why: 'No tracker at the hips: wear one on a belt.' };
    return { ok: true, map, left: pts.filter(x => !used.has(x)).map(x => x.id) };
  }

  // ---- calibrate: the scale and each part's offset
  function calibrate(rig, targets, map, setup, o) {
    o = o || {};
    if (!rig || !rig.ok) return { ok: false, why: (rig && rig.why) || 'Not a rig.' };
    const S = SETUPS[setup];
    if (!S) return { ok: false, why: `No such way to wear it: ${setup}.` };
    const use = {}, got = {};
    for (const sl of S.need.concat(S.may)) {
      const id = map && map[sl], t = id != null ? poseOf(targets && targets[id], newPose()) : null;
      if (t) { use[sl] = id; got[sl] = t; } else if (S.need.includes(sl)) return { ok: false, why: `Nothing tracks the ${SLOT_WORD[sl]}${id != null ? ` (${id} is not seen)` : ''}.` };
    }
    const F = frameOf(rig);
    rig.root.updateWorldMatrix(true, false);
    const R0 = rig.root.getWorldPosition(V()), floor = fin(o.floor) ? o.floor : R0.y;
    let k = 1;
    if (o.scale !== false) {
      const full = setup === 'full', have = (full ? got.hips : got.head).p.y - floor;
      const mine = (full ? restAt(rig, F, rig.rp.hips, rig.rq.hips, newPose()) : restAt(rig, F, rig.eye, rig.rq.head, newPose())).p.y - floor;
      // (a person's hips stand 0.4 to 1.5 m over the floor and their eyes 0.6 to 2.3 m, kneeling to tall; the character may
      // be any size)
      if (!(full ? have >= 0.4 && have <= 1.5 : have >= 0.6 && have <= 2.3)) {
        return { ok: false, why: `Stand in a T-pose facing the character's way: ${full ? 'the hips tracker is' : 'the headset is'} ${have.toFixed(2)} m over the floor.` };
      }
      if (!(mine > 1e-3)) return { ok: false, why: `The character's ${full ? 'hips' : 'eyes'} are not above its origin: stand it on the floor.` };
      k = r4(have / mine);
    }
    const cal = {}, W = newPose(), off = newPose(), iq = Q();
    for (const sl in use) {
      const b = SLOT_BONE[sl] === 'chest' ? rig.chest : SLOT_BONE[sl], t = got[sl];
      restAt(rig, F, rig.rp[b], rig.rq[b], W);
      W.p.sub(R0).multiplyScalar(k).add(R0);
      iq.copy(t.q).invert();
      off.p.copy(W.p).sub(t.p).applyQuaternion(iq);
      off.q.copy(iq).multiply(W.q).normalize();
      cal[sl] = [r4(off.p.x), r4(off.p.y), r4(off.p.z), r5(off.q.x), r5(off.q.y), r5(off.q.z), r5(off.q.w)];
    }
    return { ok: true, v: 1, setup, s: k, floor: r4(floor), map: Object.assign({}, use), cal };
  }

  // ---- solve
  // (scratch, kept between calls: one solve at a time)
  const F0 = { p: V(), q: Q(), s: 1 }, G = {}, WP = {}, WQ = {}, WS = {}, RWQ = {};
  for (const s of Object.keys(SLOT_BONE)) G[s] = newPose();
  for (const p of Object.keys(NAMES)) { WP[p] = V(); WQ[p] = Q(); RWQ[p] = Q(); }
  const QI = Q(), q1 = Q(), q2 = Q(), Dh = Q(), Dc = Q(), Dhd = Q(), Dn = Q(), Dq = Q(), v1 = V(), v2 = V(), v3 = V(), hip = V();
  const FW = V(), UW = V(), LW = V(), HD = V(), E = V(), UU = V(), VV = V(), HH = V(), HC = V(), PL = V(), PC = V(), KP = V(), H1 = V(), H2 = V();
  const OFF = newPose(), TG = newPose();
  // a goal: the target's pose times its offset (the bone's pose)
  const goal = (t, c, out) => { OFF.p.set(c[0], c[1], c[2]); OFF.q.set(c[3], c[4], c[5], c[6]).normalize(); out.q.copy(t.q).multiply(OFF.q); out.p.copy(OFF.p).applyQuaternion(t.q).add(t.p); return out; };
  // a part's place, from its parent's (its rest offset turned and scaled by the parent)
  const fk = (rig, p) => { const par = rig.PAR[p]; WP[p].copy(rig.rest[p].p).multiplyScalar(WS[par]).applyQuaternion(WQ[par]).add(WP[par]); WS[p] = WS[par] * rig.rest[p].s; };
  // the heading of a turn D (its yaw from the rig's forward at rest): from where its forward and its up lean, so a head
  // looking down still has one
  const headingOf = D => { H1.copy(FW).applyQuaternion(D).add(H2.copy(UW).applyQuaternion(D)); H1.y = 0; return H1.lengthSq() > 1e-10 ? wrap(yawOf(H1) - yawOf(H2.copy(FW).setY(0))) : 0; };
  // a delta between two deltas: a * slerp(1, a^-1 b, f)
  const between = (a, b, f, out) => { q2.copy(a).invert().multiply(b); out.copy(QI).slerp(q2, f); return out.premultiply(a); };
  // two bones from S to the end's goal H: lengths a and b, the side the middle joint points to (pole), the hinge carried
  // from rest (for a limb nearly straight); sets the upper's and lower's world turns. Returns the end actually reached
  function twoBone(rig, L, S, H, a, b, pole, carried) {
    HD.copy(H).sub(S);
    let d = HD.length();
    if (d < 1e-9) { HD.copy(pole); d = 1e-9; }
    HD.normalize();
    d = Math.min(Math.max(d, Math.abs(a - b) + 1e-6), a + b - 1e-6);
    const ca = (a * a + d * d - b * b) / (2 * a * d), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
    // the side the middle joint goes to: the pole's, leaning towards the side the hinge carried from rest bends it to
    // ((d x h) x d = h) as the pole comes within 3 degrees of the line, so a pole on the line (a straight limb, rounding)
    // never picks a side by chance
    PL.copy(pole).normalize(); PL.addScaledVector(HD, -PL.dot(HD));
    const m = PL.length();
    if (m < 0.05) { PC.crossVectors(HD, carried); if (PC.lengthSq() > 1e-12) PL.addScaledVector(PC.normalize(), 0.05 - m); }
    if (PL.lengthSq() < 1e-12) { PL.set(HD.y, -HD.x, 0); if (PL.lengthSq() < 1e-12) PL.set(0, HD.z, -HD.y); }
    PL.normalize();
    E.copy(S).addScaledVector(HD, a * ca).addScaledVector(PL, a * sa);
    UU.copy(E).sub(S).normalize();
    VV.copy(S).addScaledVector(HD, d).sub(E).normalize();
    // the hinge: from the bend where there is one, from rest where the limb is nearly straight
    HH.crossVectors(UU, VV);
    const bend = Math.acos(Math.min(1, Math.max(-1, UU.dot(VV)))), w = smooth(0.03, 0.1, bend);
    if (HH.lengthSq() > 1e-16) HH.normalize(); else HH.crossVectors(PL, HD).normalize();
    if (w < 1) { HC.copy(carried).addScaledVector(UU, -carried.dot(UU)).normalize(); HH.multiplyScalar(w).addScaledVector(HC, 1 - w).normalize(); }
    basisQ(UU, HH, WQ[L.u]).multiply(L.bU);
    basisQ(VV, HH, WQ[L.l]).multiply(L.bL);
    return v1.copy(S).addScaledVector(HD, d);
  }

  function solve(rig, cal, targets, dt, state) {
    if (!rig || !rig.ok) return { ok: false, why: (rig && rig.why) || 'Not a rig.' };
    if (!cal || !cal.ok || !SETUPS[cal.setup]) return { ok: false, why: 'Not lined up with a performer yet.' };
    const st = state || {}, setup = cal.setup, S = SETUPS[setup];
    dt = fin(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
    // the goals: each slot's bone pose this frame (a target not seen this frame: its last pose seen)
    st.seen = st.seen || {};
    const have = {};
    for (const sl in cal.cal) {
      const id = cal.map[sl], t = poseOf(targets && targets[id], TG) || (st.seen[sl] && poseOf(st.seen[sl], TG));
      if (!t) { if (S.need.includes(sl)) return { ok: false, why: `Nothing tracks the ${SLOT_WORD[sl]} yet.` }; continue; }
      st.seen[sl] = { p: t.p.toArray(), q: t.q.toArray() };
      goal(t, cal.cal[sl], G[sl]); have[sl] = true;
    }
    const F = frameOf(rig, F0), B = rig.bones, R = rig.rest;
    for (const p of rig.parts) RWQ[p].copy(F.q).multiply(rig.rq[p]);
    FW.copy(rig.fwd).applyQuaternion(F.q); UW.copy(rig.up).applyQuaternion(F.q); LW.copy(rig.left).applyQuaternion(F.q);
    // the turns, as deltas from rest in the world: the head's, the hips' (from their tracker, or a heading only), the
    // chest's (from its tracker, or half way from the hips to the head), the spine's spread between them, the neck's half
    // way from the chest to the head
    Dhd.copy(G.head.q).multiply(q1.copy(RWQ.head).invert());
    if (have.hips) Dh.copy(G.hips.q).multiply(q1.copy(RWQ.hips).invert());
    else {
      let yaw = headingOf(Dhd);
      if (setup === 'feet') {
        Dq.copy(G.lfoot.q).multiply(q1.copy(RWQ.lfoot).invert()); v2.copy(FW).applyQuaternion(Dq);
        Dq.copy(G.rfoot.q).multiply(q1.copy(RWQ.rfoot).invert()); v2.add(v3.copy(FW).applyQuaternion(Dq)); v2.y = 0;
        if (v2.lengthSq() > 1e-10) yaw += 0.6 * wrap(yawOf(v2) - yawOf(v3.copy(FW).setY(0)) - yaw);
      } else {
        // ('head': the hips follow the head's heading a little behind it, never more than 0.7 rad from it)
        if (!fin(st.yaw)) st.yaw = yaw;
        st.yaw += wrap(yaw - st.yaw) * (1 - Math.exp(-dt / 0.4));
        const off = wrap(yaw - st.yaw);
        if (Math.abs(off) > 0.7) st.yaw = yaw - Math.sign(off) * 0.7;
        yaw = st.yaw = wrap(st.yaw);
      }
      yawQ(yaw, Dh);
    }
    if (have.chest) Dc.copy(G.chest.q).multiply(q1.copy(RWQ[rig.chest]).invert());
    else between(Dh, Dhd, 0.5, Dc);
    between(Dc, Dhd, 0.5, Dn);
    WQ.hips.copy(Dh).multiply(RWQ.hips);
    rig.spines.forEach((p, i) => { between(Dh, Dc, (i + 1) / rig.spines.length, Dq); WQ[p].copy(Dq).multiply(RWQ[p]); });
    if (B.neck) WQ.neck.copy(Dn).multiply(RWQ.neck);
    WQ.head.copy(G.head.q);
    for (const s of ['lsh', 'rsh']) if (B[s]) WQ[s].copy(Dc).multiply(RWQ[s]);
    // the places down the spine from the hips at the origin; then the hips: their tracker's, else under the head so that
    // the head is where its target is
    WP.hips.set(0, 0, 0); WS.hips = F.s * R.hips.s;
    for (const p of rig.parts) if (p !== 'hips' && !/^(l|r)(fore|hand|leg|foot|toe)$/.test(p) && p !== 'headtop') fk(rig, p);
    if (have.hips) hip.copy(G.hips.p);
    else hip.copy(G.head.p).sub(WP.head);
    // ('feet': the hips lowered as far as both feet need to be reached)
    if (setup === 'feet') {
      let drop = 0;
      for (const s of ['l', 'r']) {
        const Lg = rig.limbs[s + 'leg'], reach = (WS[Lg.u] * Lg.a + WS[Lg.u] * R[Lg.l].s * Lg.b) * 0.9995;
        v2.copy(G[s + 'foot'].p).sub(v3.copy(WP[Lg.u]).add(hip));
        if (v2.length() > reach) { const h = v2.y, q = h * h - v2.lengthSq() + reach * reach; drop = Math.max(drop, q >= 0 ? -h - Math.sqrt(q) : -h); }
      }
      if (drop > 0) hip.y -= drop;
    }
    for (const p of rig.parts) WP[p].add(hip);
    // the feet: their targets, or ('head') stepped
    if (setup === 'head') steps(rig, cal, st, dt);
    // the arms and legs
    const sides = [['l', 1], ['r', -1]];
    for (const [s, sg] of sides) {
      const L = rig.limbs[s + 'arm'];
      const a = WS[L.u] * L.a, b = WS[L.u] * R[L.l].s * L.b;
      if (have[s + 'elbow']) KP.copy(G[s + 'elbow'].p).sub(WP[L.u]);
      else KP.copy(UW).multiplyScalar(-0.55).addScaledVector(FW, -0.75).addScaledVector(LW, 0.35 * sg).applyQuaternion(Dc);
      HC.copy(L.hinge).applyQuaternion(F.q).applyQuaternion(Dc);   // (the hinge at rest, carried by the chest)
      twoBone(rig, L, WP[L.u], G[s + 'hand'].p, a, b, KP, v2.copy(HC));
      WQ[L.e].copy(G[s + 'hand'].q);
    }
    for (const [s, sg] of sides) {
      const L = rig.limbs[s + 'leg'];
      const a = WS[L.u] * L.a, b = WS[L.u] * R[L.l].s * L.b;
      if (have[s + 'knee']) KP.copy(G[s + 'knee'].p).sub(WP[L.u]);
      else { Dq.copy(G[s + 'foot'].q).multiply(q1.copy(RWQ[L.e]).invert()); KP.copy(FW).applyQuaternion(Dh).add(v2.copy(FW).applyQuaternion(Dq)).addScaledVector(v3.copy(LW).applyQuaternion(Dh), 0.1 * sg); }
      HC.copy(L.hinge).applyQuaternion(F.q).applyQuaternion(Dh);
      twoBone(rig, L, WP[L.u], G[s + 'foot'].p, a, b, KP, v2.copy(HC));
      WQ[L.e].copy(G[s + 'foot'].q);
    }
    // the bones' local turns (and the hips' place); the others at rest
    q1.copy(F.q).invert();
    B.hips.position.copy(hip).sub(F.p).applyQuaternion(q1).divideScalar(F.s);
    B.hips.quaternion.copy(q1).multiply(WQ.hips);
    for (const p of rig.parts) {
      const b = B[p], r = R[p];
      b.scale.setScalar(r.s);
      if (p === 'hips') continue;
      b.position.copy(r.p);
      if (p === 'headtop' || /toe$/.test(p)) { b.quaternion.copy(r.q); continue; }
      b.quaternion.copy(WQ[rig.PAR[p]]).invert().multiply(WQ[p]);
    }
    B.hips.updateMatrixWorld(true);
    return { ok: true };
  }

  // ---- 'head': the stepping feet. Each foot is planted (on the floor, where it was put down) until the hips have left it
  // behind (its home, under the hips as at rest, more than STEP of the legs' length away, or turned more than 0.6 rad from
  // it, or the leg cannot reach it); then it steps, in a short arc over STEP_T, to its home a little ahead of where the hips
  // are going. One foot at a time, by turns, unless a planted one cannot be reached at all
  const STEP = 0.16, STEP_A = 0.6, STEP_T = 0.3, LIFT = 0.08, REACH = 0.006;
  const HOME = [newPose(), newPose()], RF = newPose(), RH = newPose(), FL = V();
  function steps(rig, cal, st, dt) {
    const F = F0, sides = ['l', 'r'], rootY = rig.root.getWorldPosition(v3).y;
    restAt(rig, F, rig.rp.hips, rig.rq.hips, RH);
    const legs = sides.map(s => rig.limbs[s + 'leg']);
    const len = legs.map(L => WS[L.u] * L.a + WS[L.u] * rig.rest[L.l].s * L.b);
    // the feet's homes: as at rest, under the hips (turned with them), on the floor
    sides.forEach((s, i) => {
      restAt(rig, F, rig.rp[s + 'foot'], rig.rq[s + 'foot'], RF);
      FL.copy(RF.p).sub(RH.p); FL.y = 0; FL.applyQuaternion(Dh);
      HOME[i].p.set(hip.x, cal.floor + RF.p.y - rootY, hip.z).add(FL);
      HOME[i].q.copy(Dh).multiply(RF.q);
    });
    // the hips' velocity along the floor, smoothed
    if (!st.v) st.v = [0, 0];
    if (st.prev && dt > 0) {
      const k = 1 - Math.exp(-dt / 0.12);
      st.v[0] += ((hip.x - st.prev[0]) / dt - st.v[0]) * k; st.v[1] += ((hip.z - st.prev[2]) / dt - st.v[1]) * k;
    }
    st.prev = hip.toArray();
    if (!st.feet) { st.feet = HOME.map(h => ({ p: h.p.toArray(), q: h.q.toArray(), on: true, k: 0, f: null, fq: null })); st.last = 1; st.n = 0; }
    st.started = -1; st.forced = false;
    const P = st.feet.map(f => ({ p: V().fromArray(f.p), q: Q().fromArray(f.q) }));
    const need = [0, 0], over = [0, 0];
    sides.forEach((s, i) => {
      const f = st.feet[i];
      if (!f.on) return;
      v2.copy(P[i].p).sub(WP[legs[i].u]);
      over[i] = v2.length() - len[i];
      v2.copy(P[i].p).sub(HOME[i].p); v2.y = 0;
      need[i] = v2.length() / (STEP * len[i]) + Math.abs(headingOf(q1.copy(P[i].q).multiply(q2.copy(HOME[i].q).invert()))) / STEP_A;
    });
    const stepping = st.feet.some(f => !f.on);
    const forced = [0, 1].filter(i => st.feet[i].on && over[i] > REACH * len[i]);
    let go = -1;
    if (forced.length) go = forced.length === 2 ? (over[0] >= over[1] ? 0 : 1) : forced[0];
    else if (!stepping) {
      const want = [0, 1].filter(i => need[i] >= 1);
      if (want.length === 2) go = Math.abs(need[0] - need[1]) < 0.25 * Math.max(need[0], need[1]) ? 1 - st.last : (need[0] > need[1] ? 0 : 1);
      else if (want.length) go = want[0];
    }
    if (go >= 0) {
      const f = st.feet[go];
      Object.assign(f, { on: false, k: 0, f: f.p.slice(), fq: f.q.slice() });
      st.last = go; st.n++; st.started = go; st.forced = forced.includes(go);
    }
    // the feet on their way: towards home plus where the hips will be by the time it lands
    sides.forEach((s, i) => {
      const f = st.feet[i];
      if (f.on) return;
      f.k = Math.min(1, f.k + dt / STEP_T);
      const lead = Math.min(0.3 * len[i], Math.hypot(st.v[0], st.v[1]) * STEP_T * 0.6), sp = Math.hypot(st.v[0], st.v[1]) || 1;
      v2.copy(HOME[i].p); v2.x += st.v[0] / sp * lead; v2.z += st.v[1] / sp * lead;
      const e = smooth(0, 1, f.k);
      v3.fromArray(f.f);
      P[i].p.copy(v3).lerp(v2, e); P[i].p.y += LIFT * len[i] * Math.sin(Math.PI * f.k);
      P[i].q.fromArray(f.fq).slerp(HOME[i].q, e);
      if (f.k >= 1) { P[i].p.copy(v2); P[i].q.copy(HOME[i].q); f.on = true; f.f = f.fq = null; }
      f.p = P[i].p.toArray(); f.q = P[i].q.toArray();
    });
    sides.forEach((s, i) => { G[s + 'foot'].p.copy(P[i].p); G[s + 'foot'].q.copy(P[i].q); });
  }

  // ---- takes: the bones as solved, sampled, made into a clip
  function sample(rig, t) {
    const s = { t: fin(t) ? t : null, h: rig.track.hips, p: rig.bones.hips.position.toArray(), q: {} };
    for (const p of rig.parts) s.q[rig.track[p]] = rig.bones[p].quaternion.toArray();
    return s;
  }
  function clipOf(samples, name, fps) {
    fps = fps || 30;
    if (!samples || !samples.length) return null;
    const n = samples.length, t0 = fin(samples[0].t) ? samples[0].t : 0;
    const times = new Float32Array(n);
    samples.forEach((s, i) => { times[i] = fin(s.t) ? s.t - t0 : i / fps; });
    const tracks = [new T.VectorKeyframeTrack(samples[0].h + '.position', times, samples.flatMap(s => s.p))];
    for (const k of Object.keys(samples[0].q)) {
      const v = new Float32Array(n * 4);
      let px = 0, py = 0, pz = 0, pw = 1;
      samples.forEach((s, i) => {
        let [x, y, z, w] = s.q[k];
        if (i && x * px + y * py + z * pz + w * pw < 0) { x = -x; y = -y; z = -z; w = -w; }   // (the short way between keys)
        v.set([x, y, z, w], i * 4); px = x; py = y; pz = z; pw = w;
      });
      tracks.push(new T.QuaternionKeyframeTrack(k + '.quaternion', times, v));
    }
    return new T.AnimationClip(name || 'Take', -1, tracks);
  }

  return { rigOf, SETUPS, assign, calibrate, solve, restPose, sample, clipOf, NAMES };
}
