// The tracker guide's layout.json, the words of its signs and its spoken lines (tools/studio/tracker-guide/README.md).
// A floor 8 m wide down -z from where you start (the scene's origin, facing -z) with a walkway down its middle: the welcome
// at the entrance (the robot waving on the right, the sign on the left), then six stands, odd numbers on the left and even
// on the right, 3.4 m apart along each side (the right side 1.7 m further on), from the fullest way to wear trackers to the
// lightest, and at the end a robot to try. Each stand: its robot on a disc, life size, facing the walkway, and its sign
// nearer you, turned towards you as you come. With the spoken lines rendered (voice.mjs: voice/*.mp3) each stand also has a
// pad on the floor at the walkway's side whose cube (each person's own) plays its line as you step on, and pointing at a
// sign and pressing plays it again for you alone. Everything is the studio's own records.
// makeLayout(parts, files, about) -> { layout, errors, partOf } (about: GUIDE.info(), the sizes the lining up gave). SIGNS: every sign's words (the tour's sign maker draws them).
// SCRIPT (script.json): the spoken lines.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SCRIPT = JSON.parse(fs.readFileSync(path.join(HERE, 'script.json'), 'utf8')).lines;
const r4 = v => Math.round(v * 1e4) / 1e4 || 0, r3 = v => Math.round(v * 1e3) / 1e3 || 0;
const D2R = Math.PI / 180;
const yawQ = a => [0, r4(Math.sin(a / 2)), 0, r4(Math.cos(a / 2))];
const FLAT = [-0.7071, 0, 0, 0.7071];   // (a plane laid on the floor, facing up)
const Z0 = -3.5, PITCH = 3.4, STAGGER = 1.7, END = -14.6;

// ------------------------------------------------------------------ the words --
// n, title, what (paragraphs: the key points and exact numbers), here (what to look at)
const STANDS = [
  [1, 'Whole body: 11 trackers', ['On the front of the head. On the front of the chest. At the back of the hips, on the belt. On the back of each hand. On each upper arm, just above the elbow. On each thigh, just above the knee. On top of each foot, at the front.', 'Nothing is guessed: the elbows and knees go where yours go.'],
    'Each puck is tagged with its part. The robot moves from the pucks alone.'],
  [2, 'Lining up: the T-pose', ['The character stands in a T-pose and you copy it, facing its way. In a headset you step into it (it is sized to you first); without one it comes to you after a 5 s countdown and is sized to you.', 'Every device you wear (tracker, controller, headset) is tied to the part it is nearest to: a line for each. Change one if it looks wrong. A part with nothing on it is worked out.'],
    'Here the robot wears 11 trackers and no headset, so the orange character comes to it.'],
  [3, 'Whole body: 6 trackers', ['Head, hips, both hands and both feet still give the whole body.', 'The chest, elbows and knees are worked out: elbows bend down and back, knees forward. It looks natural, but it is a guess.'],
    'Compare with stand 1: nothing on the chest, the arms or the thighs.'],
  [4, 'Feet and headset', ['A headset and its two controllers give the head and the hands. Add one tracker on top of each foot.', 'The hips are worked out below the head, turned with the head and the feet, and everything in between follows.'],
    'The quick way to get real footwork.'],
  [5, 'Headset and controllers', ['No trackers at all: the head and the hands come from the headset and its two controllers.', 'The feet are made up: each stays put until the hips leave it behind, then steps, one foot at a time.', 'This is how you see other people in a shared room, in a headset.'],
    'Watch the feet as it leans and walks round.'],
  [6, 'Headset and tracked hands', ['No controllers: the headset sees your bare hands, and the body follows your wrists in their place.', 'Shared rooms do this already. Not yet tried on a headset: a wrist is turned unlike a controller, so a hand may sit a little turned.', 'Keep your hands where the headset can see them.'],
    'The rings mark the wrists the headset sees.'],
];
const SLUG = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28).replace(/-$/, '');
export function signs(voice) {
  const hear = voice ? ' Step on the pad to hear the robot; point at a sign and press to hear it again.' : '';
  return [
    ...STANDS.map(([n, title, what, here]) => ({ part: 'sign-' + n, file: `signs/${String(n).padStart(2, '0')}-${SLUG(title)}.glb`, section: 'guide', n, title, what, here, w: 1.1, h: 0.95, size: 29, mid: 1.5 })),
    { part: 'sign-0', file: 'signs/00-welcome.glb', section: 'board', title: 'Tracker guide', w: 1.2, h: 1.0, px: 768, size: 30, mid: 1.5,
      what: ['A tracker is a small puck that knows where it is in the room. Strap a few to your body and a character moves as you move.',
        'Six stands, from the fullest way to wear them to the lightest, then a robot to try. The tutorial\'s robot stands in for you; every move it makes is worked out from the pucks by the app\'s own solver.'],
      here: 'Start at stand 1, on your left.' + hear },
    { part: 'sign-7', file: 'signs/07-try-it-yourself.glb', section: 'try', n: 7, title: 'Try it yourself', w: 1.2, h: 1.15, px: 768, size: 27, mid: 1.55,
      what: ['In a shared room whose relay has trackers switched on, at the studio\'s circle, open this scene from the Scene pane\'s Examples (the Tracker guide card only visits). Turn on Edit and select the robot.',
        'Put on whatever you have: trackers, a headset, controllers. Step into the robot, face its way, and choose Line up with the performer.',
        'With only a headset you can also switch on My body in the settings (VR), and look down.'],
      here: 'Until someone lines up with it, it stands still.' },
  ];
}

// ------------------------------------------------------------------ the stands --
// a stand's frame: u out from the walkway's middle towards its side, w along it away from you; its side s, its middle z
const standAt = n => { const i = Math.floor((n - 1) / 2), s = n % 2 ? -1 : 1; return { s, z: Z0 - i * PITCH - (s > 0 ? STAGGER : 0) }; };
const AT = (n, u, w, y = 0) => { const { s, z } = standAt(n); return [r3(s * u), r3(y), r3(z - w)]; };
const FACE = n => (standAt(n).s < 0 ? 90 : -90) * D2R;   // (a thing's front, +z, to the walkway)
const SIGN_YAW = n => (standAt(n).s < 0 ? 60 : -60) * D2R;

export function makeLayout(parts, files, about) {
  const errors = [], have = new Set(files), partOf = {};
  for (const [n, p] of Object.entries(parts)) partOf[p.file] = n;
  const objects = [], cubes = [], sounds = [], shapes = [], groups = [];
  const clipsOf = n => (parts[n] ? parts[n].clips.map(c => c.name) : []);
  const obj = (id, name, part, p, yaw, o = {}) => {
    const P = parts[part];
    if (!P) { errors.push(`${id}: no part ${part}`); return null; }
    if (!have.has(P.file)) errors.push(`${id}: ${P.file} is not in the scene`);
    const clip = o.clip || '';
    if (clip && !clipsOf(part).includes(clip)) errors.push(`${id}: ${part} has no clip ${clip}`);
    const r = { id, name, file: P.file, p: p.map(r3), q: yawQ(yaw || 0), s: o.s || 1, light: 'lit', clip, anim: 'loop', start: 'always' };
    for (const k of ['press', 'puppet']) if (o[k] !== undefined) r[k] = o[k];
    if (o.locked) r.locked = true;
    objects.push(r);
    return r;
  };
  const shape = (id, name, kind, p, size, colour, o = {}) => {
    const r = { id, name, shape: kind, p: p.map(r3), q: o.q || yawQ(o.yaw || 0), size: size.map(r3), colour, look: 'colour' };
    if (o.locked) r.locked = true;
    shapes.push(r);
    return r;
  };
  const voice = n => { const f = `sounds/voice-${String(n).padStart(2, '0')}.mp3`; return have.has(f) ? f : null; };
  const said = id => ({ do: [{ on: id, what: 'sound', how: 'once' }], who: 'own' });
  // a spoken line: its sound at the robot's head, a pad on the floor and its cube (each person's own), floor to 2.2 m
  const speak = (n, at, pad, side) => {
    const f = voice(n);
    if (!f) return null;
    const sid = 'vo' + String(n).padStart(4, '0');
    sounds.push({ id: sid, name: `Voice ${n}: ${SCRIPT[n].title}`.slice(0, 60), file: f, p: at.map(r3), vol: 1, r: 2.5, loop: false, start: 'always' });
    shape('pv' + String(n).padStart(4, '0'), `Pad: hear stand ${n}`, 'plane', [pad[0], 0.01, pad[2]], [side[0], side[1], 0.01], '#178f86', { q: FLAT, locked: true });
    cubes.push({ id: 'cv' + String(n).padStart(4, '0'), name: `Speaks: stand ${n}`, p: [r3(pad[0]), 1.1, r3(pad[2])], yaw: 0, size: [r3(side[0]), 2.2, r3(side[1])], mode: 'while', show: [], hide: [],
      plays: [{ on: sid, what: 'sound', how: 'once' }] });
    return sid;
  };

  // ---- the floor and the walkway (locked)
  shape('flr001', 'Floor', 'plane', [0, 0.004, -7.2], [8, 18.4, 0.01], '#252d3a', { q: FLAT, locked: true });
  shape('wlk001', 'Walkway', 'plane', [0, 0.006, -7.2], [1.0, 18.4, 0.01], '#34414f', { q: FLAT, locked: true });

  // ---- the welcome: the robot waving on the right, its sign on the left, both turned to you
  const v0 = speak(0, [1.3, 1.6, -1.0], [0, 0, -0.9], [1.0, 0.8]);
  obj('rbt000', 'Robot (welcome)', 'robot', [1.3, 0, -1.0], Math.atan2(-1.3, 1.0), { clip: 'Wave', s: (about.cal.Wave || {}).s });
  shape('dsc000', 'Disc (welcome)', 'cylinder', [1.3, 0.02, -1.0], [1.2, 0.04, 1.2], '#3d4b60', { locked: true });
  obj('sgn000', 'Sign: Tracker guide', 'sign-0', [-1.4, 0, -1.0], Math.atan2(1.4, 1.0), Object.assign({ locked: true }, v0 ? { press: said(v0) } : {}));

  // ---- the six stands: the robot (robot.glb, the stand's clip, sized as the lining up sized it), the pucks it wears
  // (the stand's own model, the same clip: one clock for both) and at stand 2 the orange character (character.glb)
  const STAND = { 1: 'Eleven trackers', 2: 'Line up', 3: 'Six trackers', 4: 'Feet and headset', 5: 'Headset and controllers', 6: 'Headset and hands' };
  for (let n = 1; n <= 6; n++) {
    const clip = STAND[n], id = String(n).padStart(4, '0'), w = n === 2 ? -0.65 : 0;
    const sid = speak(n, AT(n, 2.4, 0, 1.6), AT(n, 1.1, 0), [1.3, 2.4]);
    const s = n === 2 ? 1 : (about.cal[clip] || {}).s;
    if (!s) errors.push(`stand ${n}: no scale for ${clip}`);
    obj('rb' + id, `Robot ${n}: ${STANDS[n - 1][1]}`.slice(0, 60), 'robot', AT(n, 2.4, w), FACE(n), { clip, s, locked: true });
    obj('pk' + id, `Pucks ${n}: ${STANDS[n - 1][1]}`.slice(0, 60), 'pucks-' + n, AT(n, 2.4, w), FACE(n), { clip, locked: true });
    if (n === 2) obj('ch0002', 'Character 2: the one worn (orange)', 'character', AT(n, 2.4, w), FACE(n), { clip, locked: true });
    // (the disc under it; the lining-up stand's longer, the walking one's under its circle)
    const big = n === 2 ? [2.9, 0.04, 1.5] : n === 5 ? [2.0, 0.04, 2.0] : [1.6, 0.04, 1.6];
    shape('ds' + id, `Disc ${n}`, 'cylinder', AT(n, 2.4, n === 2 ? 0 : n === 5 ? 0.4 : 0, 0.02), big, '#3d4b60', { yaw: FACE(n), locked: true });
    obj('sg' + id, `Sign ${n}: ${STANDS[n - 1][1]}`.slice(0, 60), 'sign-' + n, AT(n, 2.9, n === 2 ? -1.6 : -1.25), SIGN_YAW(n), Object.assign({ locked: true }, sid ? { press: said(sid) } : {}));
  }

  // ---- try it yourself: one robot with its wearing ready for any mix of devices (v201; nobody's yet: Line up with the
  // performer on its card)
  const v7 = speak(7, [0, 1.6, END], [0, 0, END + 1.6], [1.6, 1.0]);
  obj('try001', 'Try: any mix of devices', 'robot', [0, 0, END], 0, { clip: 'Idle', s: (about.cal.Idle || {}).s, puppet: { on: false, rig: 'any' } });
  shape('dsc07a', 'Disc: try it', 'cylinder', [0, 0.02, END], [1.2, 0.04, 1.2], '#ffd34d', { locked: true });
  obj('sgn007', 'Sign 7: Try it yourself', 'sign-7', [-1.5, 0, END + 0.2], Math.atan2(1.5, 1.2), Object.assign({ locked: true }, v7 ? { press: said(v7) } : {}));
  groups.push({ id: 'gtry07', name: 'Try it yourself', items: ['try001', 'dsc07a', 'sgn007'] });

  // ---- checks
  const ids = new Set(), all = [objects, cubes, sounds, shapes, groups].flat();
  for (const x of all) { if (!/^[a-z0-9]{6}$/.test(x.id)) errors.push(`${x.id}: not six letters and digits`); if (ids.has(x.id)) errors.push(`${x.id}: used twice`); ids.add(x.id); if (!x.name || x.name.length > 60) errors.push(`${x.id}: its name (${x.name.length} characters, at most 60)`); }
  for (const c of cubes) for (const e of c.plays || []) if (!ids.has(e.on)) errors.push(`${c.id}: names ${e.on}, not in the scene`);
  for (const g of groups) for (const k of g.items) if (!ids.has(k)) errors.push(`${g.id}: names ${k}, not in the scene`);
  for (const s of sounds) if (!have.has(s.file)) errors.push(`${s.id}: ${s.file} is not in the scene`);
  const layout = { studio: 1, scene: 'tracker-guide', saved: '2026-11-25T12:00:00.000Z', objects, cubes, sounds, cuts: [], groups, shapes, empties: [], sequences: [], screens: [], paintings: [],
    settings: { others: 'shown', real: 'device', grid: 'hidden' } };
  return { layout, errors, partOf };
}
