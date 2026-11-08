// node tools/studio/test-ik.mjs
// The trackers' solver (tools/studio/engine/ik.js; tools/trackers/SPEC.md, "The solver (ik.js)") in Node, in seconds,
// without a browser. The puppet test scene's rig (tools/studio/test/scenes/puppet/rig.glb, made by
// tools/studio/test/make.mjs: our own humanoid with Mixamo's bone names and a walk) is loaded twice by three.js's own
// GLTFLoader: one walks (the truth, a performer), the other is solved. Trackers, a headset and controllers are fixed to the
// truth's bones with random offsets (seeded), the solver is lined up from the rest pose (a T-pose), then solves every
// frame at 30 a second and is checked against the truth:
//   rigOf      the parts found (also by lenient names), a model that is not a Mixamo rig and one with no bones refused in
//              words, a chain out of Mixamo's order refused
//   assign     the parts found from a T-pose with the trackers in random order (6 and 11, the performer turned and moved),
//              the feet of 'feet', too few refused
//   'full'     6 trackers: the hands and feet within 5 mm, the hips, head, hands and feet turned within 3 degrees, the knees
//              bent as the truth's; 11 trackers: also the chest, upper arms, forearms, thighs and shins within 3 degrees;
//              a performer 1.1 times the character's size (the scale found, the hands and feet within 5 mm); scale: false
//   'feet'     a tracker on each foot, a headset and controllers: the feet within 5 mm, the hands within 1 cm, the hips 8 cm
//   'head'     a headset and controllers only, standing, walking 2.4 m along a curve and standing again: the head exact,
//              the hands within 1 cm, the hips within 10 cm, a planted foot never moving more than 1 cm, steps by turns
//              while the hips move on, none standing still
//   the same output twice (determinism), the calibration plain JSON, a take (sample, clipOf) replaying the solved pose
//   within 1 mm
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '../..');
const require = createRequire(import.meta.url);
const THREE = require(path.join(ROOT, 'three.min.js'));
globalThis.THREE = THREE;
new Function(fs.readFileSync(path.join(HERE, 'vendor/GLTFLoader.js'), 'utf8'))();
const makeIK = new Function(fs.readFileSync(path.join(HERE, 'engine/ik.js'), 'utf8') + '\nreturn makeIK;')();
const IK = makeIK(THREE);
let fails = 0, checks = 0;
const ok = (c, what, more) => { checks++; if (!c) { fails++; console.log('FAIL ' + what + (more ? ': ' + more : '')); } };
const t0 = Date.now();

// ---- loading
const load = file => new Promise((res, rej) => {
  const b = fs.readFileSync(path.join(HERE, 'test/scenes', file));
  new THREE.GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), '', res, rej);
});
const truth = await load('puppet/rig.glb'), puppet = await load('puppet/rig.glb');
const TR = IK.rigOf(truth.scene), PR = IK.rigOf(puppet.scene);

// ---- small helpers: seeded numbers, turns, errors
let seed = 20261108;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rr = (a, b) => a + (b - a) * rnd();
const randQ = () => { const u = rnd(), v = rnd() * 2 * Math.PI, w = rnd() * 2 * Math.PI, a = Math.sqrt(1 - u), b = Math.sqrt(u); return new THREE.Quaternion(a * Math.sin(v), a * Math.cos(v), b * Math.sin(w), b * Math.cos(w)); };
const tiltQ = deg => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize(), rr(0, deg) * Math.PI / 180);
const deg = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b)))) * 180 / Math.PI;
const world = b => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); b.matrixWorld.decompose(p, q, s); return { p, q }; };
const mm = x => (x * 1000).toFixed(2) + ' mm', dg = x => x.toFixed(3) + '°';
const stats = a => { const s = a.slice().sort((x, y) => x - y); return { max: s[s.length - 1] || 0, med: s[Math.floor(s.length / 2)] || 0 }; };

// ---- the truth: at rest or walking, its root placed (a performer standing somewhere, turned, maybe taller)
const mixer = new THREE.AnimationMixer(truth.scene), walkClip = truth.animations.find(a => a.name === 'Walk'), walk = mixer.clipAction(walkClip);
function truthAt(t, o) {
  o = o || {};
  const r = truth.scene;
  r.position.set(o.x || 0, 0, o.z || 0); r.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.yaw || 0); r.scale.setScalar(o.scale || 1);
  if (o.walking) { if (!walk.isRunning()) walk.play(); mixer.setTime(t); } else { walk.stop(); TR.toRest(); }
  r.updateMatrixWorld(true);
}
const placeRig = (o, rig) => { const r = rig.root; o = o || {}; r.position.set(o.x || 0, 0, o.z || 0); r.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.yaw || 0); r.scale.setScalar(o.scale || 1); r.updateMatrixWorld(true); };

// ---- what is worn: each a bone of the truth and an offset (in that bone's frame, unscaled), made from where it sits on
// the body at rest (the rig's own axes: x its left, y up, z forward) and a turn
truthAt(0);
const restQ = part => world(TR.bones[part]).q;
function wear(part, at, turn) { return { part, o: at.clone().applyQuaternion(restQ(part).invert()), q: restQ(part).invert().multiply(turn) }; }
const eye = IK.restPose(TR, 'eye'), headAt = world(TR.bones.head).p;
const WORN = {
  hips: wear('hips', new THREE.Vector3(rr(-0.08, 0.08), 0, rr(-0.15, -0.1)), randQ()),            // (a belt at the back, at hip height)
  head: wear('head', new THREE.Vector3(rr(-0.04, 0.04), rr(0.1, 0.14), rr(-0.04, 0.04)), randQ()),
  chest: wear('spine2', new THREE.Vector3(rr(-0.03, 0.03), rr(-0.05, 0.05), rr(0.1, 0.14)), randQ()),
  lhand: wear('lhand', new THREE.Vector3(rr(-0.06, -0.03), rr(-0.02, 0.04), rr(-0.03, 0.03)), randQ()),
  rhand: wear('rhand', new THREE.Vector3(rr(0.03, 0.06), rr(-0.02, 0.04), rr(-0.03, 0.03)), randQ()),
  lfoot: wear('lfoot', new THREE.Vector3(rr(-0.02, 0.02), rr(0.03, 0.06), rr(0.02, 0.08)), randQ()),
  rfoot: wear('rfoot', new THREE.Vector3(rr(-0.02, 0.02), rr(0.03, 0.06), rr(0.02, 0.08)), randQ()),
  lelbow: wear('larm', new THREE.Vector3(rr(0.24, 0.26), rr(0.03, 0.06), rr(-0.05, -0.03)), randQ()),   // (the upper arm, near the elbow)
  relbow: wear('rarm', new THREE.Vector3(rr(-0.26, -0.24), rr(0.03, 0.06), rr(-0.05, -0.03)), randQ()),
  lknee: wear('lleg', new THREE.Vector3(rr(-0.02, 0.02), rr(-0.1, -0.06), rr(0.05, 0.08)), randQ()),     // (the shin, under the knee)
  rknee: wear('rleg', new THREE.Vector3(rr(-0.02, 0.02), rr(-0.1, -0.06), rr(0.05, 0.08)), randQ()),
  // a headset at the eyes (a little to either side, turned a little) and the controllers in the hands
  hmd: wear('head', eye.p.clone().sub(headAt).add(new THREE.Vector3(rr(-0.01, 0.01), 0, rr(-0.01, 0.01))), tiltQ(8)),
  lctl: wear('lhand', new THREE.Vector3(rr(0.04, 0.08), rr(-0.03, 0), rr(0.02, 0.06)), randQ()),
  rctl: wear('rhand', new THREE.Vector3(rr(-0.08, -0.04), rr(-0.03, 0), rr(0.02, 0.06)), randQ()),
};
const ID = Object.fromEntries(Object.keys(WORN).map(k => [k, 'LHR-' + Math.floor(rnd() * 0xffffff).toString(16).toUpperCase().padStart(6, '0')]));
// the targets now: { id: { p, q } }, in a random order
function targets(names) {
  const out = {}, list = names.slice().sort(() => rnd() - 0.5);
  for (const k of list) {
    const w = WORN[k], b = world(TR.bones[w.part]);
    out[ID[k]] = { p: w.o.clone().applyQuaternion(b.q).add(b.p).toArray(), q: b.q.clone().multiply(w.q).toArray() };
  }
  return out;
}
const SIX = ['hips', 'head', 'lhand', 'rhand', 'lfoot', 'rfoot'], ELEVEN = SIX.concat(['chest', 'lelbow', 'relbow', 'lknee', 'rknee']);
const mapOf = names => Object.fromEntries(names.map(k => [{ hmd: 'head', lctl: 'lhand', rctl: 'rhand' }[k] || k, ID[k]]));

// ================================================================ rigOf
ok(PR.ok && PR.parts.length === 23 && PR.spines.join() === 'spine,spine1,spine2' && PR.chest === 'spine2' && PR.bones.lfore.name === 'mixamorigLeftForeArm',
  'rigOf finds the 23 parts of a Mixamo rig (the ends HeadTop_End and the toes carried along)', JSON.stringify(PR.why || PR.parts));
{
  const dancer = IK.rigOf((await load('rig/dancer.glb')).scene), box = IK.rigOf(new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry())));   // (a box: no bones)
  ok(!dancer.ok && /^Not a Mixamo rig: no bone named mixamorig:Spine, mixamorig:LeftArm, mixamorig:LeftForeArm and \d+ more\.$/.test(dancer.why), 'a rig in other names refused in words', dancer.why);
  ok(!box.ok && /no bones/.test(box.why), 'a model with no bones refused in words', box.why);
  // lenient names: a clone renamed as other exports name them; and a chain out of Mixamo's order
  const forms = [n => n.replace('mixamorig', 'mixamorig1:'), n => n.replace('mixamorig', 'MIXAMORIG_').toUpperCase(), n => n.replace('mixamorig', '')];
  let lenient = true;
  for (const f of forms) {
    const s = puppet.scene.clone(true);
    s.traverse(o => { if (o.isBone) o.name = f(o.name); });
    const r = IK.rigOf(s);
    if (!r.ok || r.parts.length !== 23) lenient = false;
  }
  ok(lenient, 'rigOf matches leniently (mixamorig1:Hips, MIXAMORIG_HIPS, Hips)');
  const bad = puppet.scene.clone(true);
  let hand = null, chest = null;
  bad.traverse(o => { if (o.name === 'mixamorigLeftHand') hand = o; if (o.name === 'mixamorigSpine2') chest = o; });
  chest.add(hand);
  const br = IK.rigOf(bad);
  ok(!br.ok && /not in Mixamo's order: mixamorig:LeftHand is not under mixamorig:LeftForeArm/.test(br.why), 'a chain out of Mixamo\'s order refused in words', br.why);
}

// ================================================================ assign
{
  const at = { x: 1.2, z: -0.5, yaw: 0.6 };
  truthAt(0, at); placeRig(at, PR);
  const a6 = IK.assign(PR, targets(SIX), 'full'), a11 = IK.assign(PR, targets(ELEVEN), 'full'), af = IK.assign(PR, targets(['lfoot', 'rfoot']), 'feet');
  const same = (got, names) => got && names.every(k => got[k] === ID[k]) && Object.keys(got).length === names.length;
  ok(a6.ok && same(a6.map, SIX), 'assign: six trackers in a T-pose, in random order, the performer turned and moved', JSON.stringify(a6));
  ok(a11.ok && same(a11.map, ELEVEN), 'assign: eleven trackers (the chest, elbows and knees too)', JSON.stringify(a11));
  ok(af.ok && same(af.map, ['lfoot', 'rfoot']), '\'feet\': the left and right foot by the facing', JSON.stringify(af));
  const few = IK.assign(PR, targets(['head', 'lhand', 'rhand', 'lfoot', 'rfoot']), 'full');
  ok(!few.ok && /Six trackers at least .*: 5 seen/.test(few.why), 'assign: five trackers refused in words', few.why);
  const hd = IK.assign(PR, targets(['hmd', 'lctl']), 'head');
  ok(hd.ok && !Object.keys(hd.map).length, '\'head\': nothing to assign (the caller names the headset and controllers)');
  placeRig({}, PR);
}

// ================================================================ a run: calibrate at rest, then solve frames
// frames: [t, truth placement]; the character stands where the performer stands at the first frame (the performer steps
// into it to line up), at rest; returns per-frame errors and what the checks need
const PARTS = ['hips', 'head', 'spine2', 'larm', 'lfore', 'lhand', 'rarm', 'rfore', 'rhand', 'lup', 'lleg', 'lfoot', 'rup', 'rleg', 'rfoot'];
function run(setup, names, frames, o) {
  o = o || {};
  const at = Object.assign({}, frames[0][1], { walking: false, scale: 1 });
  truthAt(0, Object.assign({}, at, { scale: frames[0][1].scale }));
  PR.toRest(); placeRig(at, PR);
  const cal = IK.calibrate(PR, targets(names), mapOf(names), setup, o.cal);
  if (!cal.ok) return { cal };
  at.scale = cal.s; placeRig(at, PR);
  const st = {}, out = { cal, st, at, err: {}, rot: {}, frames: [], samples: [], locals: [] };
  for (const p of PARTS) { out.err[p] = []; out.rot[p] = []; }
  let prev = null;
  for (const [t, at] of frames) {
    truthAt(t, at);
    const r = IK.solve(PR, cal, targets(names), prev === null ? 0 : t - prev, st);
    prev = t;
    if (!r.ok) { out.why = r.why; break; }
    for (const p of PARTS) {
      const a = world(TR.bones[p]), b = world(PR.bones[p]);
      out.err[p].push(a.p.distanceTo(b.p)); out.rot[p].push(deg(a.q, b.q));
    }
    const f = { t, started: st.started, forced: st.forced, on: st.feet ? st.feet.map(x => x.on) : null, foot: ['lfoot', 'rfoot'].map(p => world(PR.bones[p]).p) };
    // the knees' bend (truth and solved)
    const bend = (R, s) => { const h = world(R.bones[s + 'up']).p, k = world(R.bones[s + 'leg']).p, a = world(R.bones[s + 'foot']).p; return k.clone().sub(h).angleTo(a.clone().sub(k)) * 180 / Math.PI; };
    f.knee = ['l', 'r'].map(s => Math.abs(bend(TR, s) - bend(PR, s)));
    out.frames.push(f);
    if (o.sample) out.samples.push(Object.assign(IK.sample(PR, t), { world: PR.parts.map(p => world(PR.bones[p]).p) }));
    if (o.locals) out.locals.push(PR.parts.map(p => PR.bones[p].quaternion.toArray().concat(PR.bones[p].position.toArray())).flat());
  }
  return out;
}
const at30 = (from, to, place) => { const f = []; for (let i = 0; from + i / 30 <= to + 1e-9; i++) { const t = from + i / 30; f.push([t, place(t)]); } return f; };
const report = (name, r, parts, kind) => parts.map(p => { const s = stats((kind === 'rot' ? r.rot : r.err)[p]); return `${p} ${kind === 'rot' ? dg(s.max) : mm(s.max)}`; }).join(', ');

// ---- 'full', six trackers
{
  const r = run('full', SIX, at30(0, 3.3, () => ({ walking: true })), { locals: true });
  ok(r.cal.ok && r.cal.s === 1, '\'full\': calibrated from the rest pose (scale 1: the hips tracker at hip height)', JSON.stringify(r.cal.why || r.cal.s));
  ok(r.cal.ok && JSON.stringify(JSON.parse(JSON.stringify(r.cal))) === JSON.stringify(r.cal) && Object.keys(r.cal.cal).sort().join() === SIX.slice().sort().join() &&
    Object.values(r.cal.cal).every(a => a.length === 7 && a.every(Number.isFinite)), 'the calibration is plain JSON: a slot\'s offset is seven numbers');
  const pos = Math.max(...['lhand', 'rhand', 'lfoot', 'rfoot'].map(p => stats(r.err[p]).max)), rot = Math.max(...['hips', 'head', 'lhand', 'rhand', 'lfoot', 'rfoot'].map(p => stats(r.rot[p]).max));
  const knee = stats(r.frames.flatMap(f => f.knee)).max;
  console.log(`'full', 6 trackers, ${r.frames.length} frames: places ${report('', r, ['lhand', 'rhand', 'lfoot', 'rfoot', 'hips'])}; turns ${report('', r, ['hips', 'head', 'lhand', 'lfoot', 'larm', 'lfore', 'lup', 'lleg'], 'rot')}; knees' bend within ${dg(knee)}`);
  ok(!r.why && pos <= 0.005, '\'full\' (6): the hands and feet within 5 mm of the truth', mm(pos));
  ok(rot <= 3, '\'full\' (6): the hips, head, hands and feet turned within 3 degrees', dg(rot));
  ok(knee <= 3, '\'full\' (6): the knees bent as the truth\'s, within 3 degrees', dg(knee));
  // the same again from a fresh state: the same pose, number for number
  const r2 = run('full', SIX, at30(0, 1.1, () => ({ walking: true })), { locals: true });
  ok(r2.locals.every((l, i) => l.every((v, k) => v === r.locals[i][k])), '\'full\': the same targets give the same pose (twice, number for number)');
  // a tracker not seen for a moment: its last pose held (the hand stays where it was while the body moves on)
  truthAt(0.5, { walking: true });
  IK.solve(PR, r2.cal, targets(SIX), 1 / 30, r2.st);
  const held = world(PR.bones.lhand).p;
  truthAt(0.55, { walking: true });
  const partial = targets(SIX);
  delete partial[ID.lhand];
  const h1 = IK.solve(PR, r2.cal, partial, 1 / 30, r2.st), moved = world(PR.bones.lhand).p.distanceTo(held), body = world(PR.bones.hips).p.distanceTo(world(TR.bones.hips).p);
  ok(h1.ok && moved <= 0.001 && body <= 0.001, 'a tracker not seen this frame: its last pose held, the rest solved', JSON.stringify([h1, mm(moved), mm(body)]));
  const never = IK.solve(PR, r2.cal, partial, 1 / 30, {});
  ok(!never.ok && never.why === 'Nothing tracks the left hand yet.', 'a part never seen: not solved, said in words', JSON.stringify(never));
  ok(!IK.solve(PR, null, targets(SIX), 0, {}).ok && !IK.solve({ ok: false, why: 'x' }, r2.cal, targets(SIX), 0, {}).ok, 'nothing solved without a rig or a calibration');
}

// ---- the bends: in a T-pose with a hand 12 cm nearer its shoulder and a foot 12 cm higher, the elbow bends down and
// back and the knee forward (no tracker on them); an elbow tracker lying right on the line from the shoulder to the hand
// bends it the way the hinge carried from rest does (back)
{
  truthAt(0); PR.toRest(); placeRig({}, PR);
  const cal6 = IK.calibrate(PR, targets(SIX), mapOf(SIX), 'full'), cal11 = IK.calibrate(PR, targets(ELEVEN), mapOf(ELEVEN), 'full');
  // (a target that puts a slot's bone at a given place with a given turn, by a calibration's offset)
  const put = (cal, sl, p, q) => { const c = cal.cal[sl], tq = q.clone().multiply(new THREE.Quaternion(c[3], c[4], c[5], c[6]).normalize().invert()); return { p: p.clone().sub(new THREE.Vector3(c[0], c[1], c[2]).applyQuaternion(tq)).toArray(), q: tq.toArray() }; };
  // (how far a joint stands off the line from a to b: its offset square to it)
  const off = (j, a, b) => { const p = world(PR.bones[j]).p.sub(a), d = b.clone().sub(a).normalize(); return p.sub(d.multiplyScalar(p.dot(d))); };
  const sh = world(TR.bones.larm).p, hand = world(TR.bones.lhand), foot = world(TR.bones.lfoot);
  const handTo = hand.p.clone().lerp(sh, 0.12 / hand.p.distanceTo(sh)), footTo = foot.p.clone().add(new THREE.Vector3(0, 0.12, 0));
  const six = targets(SIX);
  six[ID.lhand] = put(cal6, 'lhand', handTo, hand.q); six[ID.lfoot] = put(cal6, 'lfoot', footTo, foot.q);
  IK.solve(PR, cal6, six, 0, {});
  const el = off('lfore', sh, handTo), kn = off('lleg', world(PR.bones.lup).p, footTo);
  const reached = Math.max(world(PR.bones.lhand).p.distanceTo(handTo), world(PR.bones.lfoot).p.distanceTo(footTo));
  ok(el.z < -0.01 && el.y < -0.01 && kn.z > 0.03 && reached < 1e-3, 'a natural bend: the elbow down and back, the knee forward, the hand and foot reached',
    JSON.stringify({ elbow: el.toArray().map(mm), knee: kn.toArray().map(mm), reached: mm(reached) }));
  // the elbow tracker on the line from the shoulder to the hand
  const all = targets(ELEVEN);
  all[ID.lhand] = put(cal11, 'lhand', handTo, hand.q); all[ID.lfoot] = put(cal11, 'lfoot', footTo, foot.q);
  all[ID.lelbow] = put(cal11, 'lelbow', sh.clone().lerp(handTo, 0.5), world(TR.bones.lfore).q);
  IK.solve(PR, cal11, all, 0, {});
  const el2 = off('lfore', sh, handTo);
  ok(el2.z < -0.03 && Math.abs(el2.y) < 0.01 && world(PR.bones.lhand).p.distanceTo(handTo) < 1e-3, 'an elbow tracker right on the line: bent the way the hinge carried from rest bends it (back)',
    JSON.stringify(el2.toArray().map(mm)));
}

// ---- 'full', eleven trackers (and a take recorded)
let take = null;
{
  // (the performer and the character away from the origin and turned: the rig's frame is not the world's)
  const r = run('full', ELEVEN, at30(0, 2.2, () => ({ walking: true, x: 1.2, z: -0.5, yaw: 0.6 })), { sample: true });
  take = r;
  const pos = Math.max(...['lhand', 'rhand', 'lfoot', 'rfoot'].map(p => stats(r.err[p]).max));
  const rotParts = ['hips', 'head', 'spine2', 'larm', 'lfore', 'lhand', 'rarm', 'rfore', 'rhand', 'lup', 'lleg', 'lfoot', 'rup', 'rleg', 'rfoot'];
  const rot = Math.max(...rotParts.map(p => stats(r.rot[p]).max));
  console.log(`'full', 11 trackers, the performer 1.3 m from the origin and turned 0.6 rad: places ${report('', r, ['lhand', 'lfoot', 'lfore', 'lleg', 'spine2'])}; turns ${report('', r, rotParts, 'rot')}`);
  ok(!r.why && pos <= 0.005, '\'full\' (11): the hands and feet within 5 mm', mm(pos));
  ok(rot <= 3, '\'full\' (11): the hips, chest, head, upper arms, forearms, hands, thighs, shins and feet turned within 3 degrees', dg(rot));
}

// ---- a performer 1.1 times the character's size; and the size kept
{
  const r = run('full', SIX, at30(0, 1.1, () => ({ walking: true, scale: 1.1 })));
  const pos = Math.max(...['lhand', 'rhand', 'lfoot', 'rfoot'].map(p => stats(r.err[p]).max));
  console.log(`'full', a performer 1.1 times as big: scale ${r.cal.s}, the hands and feet within ${mm(pos)}`);
  ok(r.cal.ok && r.cal.s === 1.1 && pos <= 0.005, 'a performer 1.1 times the size: the scale found (1.1) and the hands and feet within 5 mm', JSON.stringify([r.cal.s, mm(pos)]));
  truthAt(0, { scale: 1.1 }); PR.toRest(); placeRig({}, PR);
  const keep = IK.calibrate(PR, targets(SIX), mapOf(SIX), 'full', { scale: false });
  ok(keep.ok && keep.s === 1, 'scale: false keeps the character\'s size');
  truthAt(0, { scale: 2.6 });
  const odd = IK.calibrate(PR, targets(SIX), mapOf(SIX), 'full');
  ok(!odd.ok && /T-pose.*2\.60 m over the floor/.test(odd.why), 'a performer out of reason (hips 2.6 m up) refused in words', odd.why);
  truthAt(0);
  const none = IK.calibrate(PR, targets(['hips', 'head', 'lhand', 'rhand', 'lfoot']), mapOf(SIX), 'full');
  ok(!none.ok && /Nothing tracks the right foot \(LHR-[0-9A-F]{6} is not seen\)/.test(none.why), 'a part not tracked refused in words', none.why);
}

// ---- 'feet': a tracker on each foot, a headset and controllers
{
  truthAt(0); PR.toRest(); placeRig({}, PR);
  const names = ['hmd', 'lctl', 'rctl', 'lfoot', 'rfoot'];
  const r = run('feet', names, at30(0, 3.3, () => ({ walking: true })));
  const feet = Math.max(stats(r.err.lfoot).max, stats(r.err.rfoot).max), hands = Math.max(stats(r.err.lhand).max, stats(r.err.rhand).max), hips = stats(r.err.hips).max;
  console.log(`'feet': scale ${r.cal.s}; feet within ${mm(feet)}, hands ${mm(hands)}, hips ${mm(hips)} (median ${mm(stats(r.err.hips).med)}), head ${mm(stats(r.err.head).max)}`);
  ok(r.cal.ok && Math.abs(r.cal.s - 1) < 1e-3, '\'feet\': calibrated (scale 1: the headset at the eyes)', JSON.stringify(r.cal.why || r.cal.s));
  ok(!r.why && feet <= 0.005, '\'feet\': the feet within 5 mm', mm(feet));
  ok(hands <= 0.01, '\'feet\': the hands within 1 cm', mm(hands));
  ok(hips <= 0.08, '\'feet\': the hips within 8 cm', mm(hips));
}

// ---- 'head': a headset and controllers only; standing, walking along a curve, standing again (the walk's clip runs on
// the frame's time, so it starts at its own 1 s: any phase does)
{
  const names = ['hmd', 'lctl', 'rctl'], V0 = 0.6, W0 = 0.15;
  const place = t => {
    const w = Math.min(Math.max(t - 1, 0), 4), yaw = W0 * w, x = (V0 / W0) * (1 - Math.cos(W0 * w)), z = (V0 / W0) * Math.sin(W0 * w);
    return t > 1 && t < 5 ? { walking: true, x, z, yaw } : { x, z, yaw };
  };
  const frames = at30(0, 7, place), r = run('head', names, frames, { locals: true });
  const head = stats(r.err.head).max, headRot = stats(r.rot.head).max, hands = Math.max(stats(r.err.lhand).max, stats(r.err.rhand).max), hips = stats(r.err.hips).max;
  // planted feet: from the frame a foot is put down until it lifts, its place as solved never moves more than 1 cm
  let slide = 0, plant = [null, null];
  const lands = [[], []];   // (where each foot was put down)
  const started = [], phase = t => (t <= 1 ? 0 : t < 5 ? 1 : 2);
  r.frames.forEach(f => {
    if (f.started >= 0) started.push([f.t, f.started, f.forced]);
    for (const k of [0, 1]) {
      if (!f.on || !f.on[k] || f.started === k) { plant[k] = null; continue; }
      if (!plant[k]) { plant[k] = f.foot[k].clone(); lands[k].push(plant[k]); } else slide = Math.max(slide, plant[k].distanceTo(f.foot[k]));
    }
  });
  const byPhase = [0, 1, 2].map(ph => started.filter(s => phase(s[0]) === ph));
  const walked = byPhase[1], alt = walked.slice(1).filter((s, i) => s[1] !== walked[i][1]).length / Math.max(1, walked.length - 1);
  const lastStep = started.length ? started[started.length - 1][0] : 0;
  const strides = stats(lands.flatMap(l => l.slice(1).map((p, i) => Math.hypot(p.x - l[i].x, p.z - l[i].z)))), gaps = stats(walked.slice(1).map((s, i) => s[0] - walked[i][0]));
  console.log(`'head': scale ${r.cal.s}; head within ${mm(head)} and ${dg(headRot)}, hands ${mm(hands)}, hips ${mm(hips)} (median ${mm(stats(r.err.hips).med)}); ` +
    `steps standing ${byPhase[0].length}, walking ${walked.length} (${walked.filter(s => s[2]).length} forced, ${Math.round(alt * 100)} % by turns, ` +
    `a foot moved ${mm(strides.med)} a step (at most ${mm(strides.max)}), ${gaps.med.toFixed(2)} s apart), after ${byPhase[2].length} (the last at ${lastStep.toFixed(2)} s); a planted foot moved at most ${mm(slide)}`);
  ok(r.cal.ok && !r.why, '\'head\': calibrated and solved every frame', r.why || r.cal.why);
  ok(head <= 0.001 && headRot <= 0.1, '\'head\': the head exact (within 1 mm and 0.1 degrees)', mm(head) + ', ' + dg(headRot));
  ok(hands <= 0.01, '\'head\': the hands within 1 cm', mm(hands));
  ok(hips <= 0.1, '\'head\': the hips within 10 cm', mm(hips));
  ok(slide <= 0.01, '\'head\': a planted foot never slides (under 1 cm)', mm(slide));
  ok(byPhase[0].length === 0, '\'head\': no steps while standing still', JSON.stringify(byPhase[0]));
  ok(walked.length >= 6 && alt >= 0.8, '\'head\': steps while the hips move on (2.4 m), by turns', JSON.stringify({ steps: walked.length, alt }));
  ok(lastStep <= 6, '\'head\': standing again, the feet settle within a second', lastStep.toFixed(2));
  // the same again from a fresh state: the same pose, number for number
  const r2 = run('head', names, frames, { locals: true });
  ok(r2.locals.length === r.locals.length && r2.locals.every((l, i) => l.every((v, k) => v === r.locals[i][k])), '\'head\': the same targets and steps give the same pose (twice, number for number)');
}

// ---- a take: the solved bones sampled and made a clip, played back on the rig
{
  const clip = IK.clipOf(take.samples, 'Take 1');
  PR.toRest(); placeRig(take.at, PR);
  const m = new THREE.AnimationMixer(puppet.scene), a = m.clipAction(clip);
  a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; a.play();
  let worst = 0;
  take.samples.forEach(s => {
    m.setTime(s.t - take.samples[0].t); puppet.scene.updateMatrixWorld(true);
    PR.parts.forEach((p, k) => { worst = Math.max(worst, world(PR.bones[p]).p.distanceTo(s.world[k])); });
  });
  console.log(`a take: ${clip.tracks.length} tracks, ${take.samples.length} keys over ${clip.duration.toFixed(2)} s, replayed within ${mm(worst)}`);
  ok(clip.name === 'Take 1' && clip.tracks.length === PR.parts.length + 1 && Math.abs(clip.duration - 2.2) < 1e-3, 'clipOf: a clip with a turn track per bone and the hips\' place', JSON.stringify([clip.tracks.length, clip.duration]));
  ok(worst <= 0.001, 'clipOf: the take replays the solved pose within 1 mm', mm(worst));
}

console.log(`${checks} checks, ${fails} failed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fails ? 1 : 0);
