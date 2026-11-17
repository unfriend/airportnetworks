// node tools/studio/dub/make.mjs [--check]
// Makes the dub techno desk, the studio's second example scene (examples/dub-techno/; tools/studio/dub/README.md): a room of
// about 5 x 5 m round the scene's origin with a mixing desk of studio shapes whose movements are streamed to the output page
// as MIDI (v158: streams, trails, a beat-locked loop, sends), to play a dub techno patch in Cardinal (VCV Rack as a plugin)
// on its own 120 bpm clock, put back to bar 1 by the output page's MIDI Start. Only shapes and cubes: no model, picture or
// sound file, so it is made in plain Node. Deterministic: run it again and nothing changes. Then examples/index.json and examples/dub-techno/files.json by
// tools/studio/scan.mjs.
//   --check   says whether examples/dub-techno/layout.json is what this makes (byte for byte), checks the layout against the
//             studio's limits and record rules (the subset this scene uses: ids, kinds, streams, sends, presses, the path,
//             trails, settings; the engine's own norm is run by the smoke test's page), then scan.mjs --check; exits 1 when
//             something is not right
// THE MIDI MAP (the contract with the Cardinal patch, tools/output/cardinal/; channel 1 for
// everything):
//   CC 20 Filter (fader A's x)          CC 21 Echo feedback (fader B's x)     CC 22 Space (the turntable's yaw)
//   CC 23 Stab decay (the orb's height)  CC 24 Hats (people on the dance floor) CC 25 Throw (the dub wand's speed)
//   CC 26 Wobble (the orbiting sphere's x, a loop of 8 beats)
//   note 48 Stab (pad A)   note 38 Rim (pad B)   note 51 Siren (pad C, and the wand past 0.7 m/s)
//   note 36 Kick off (held while anyone stands in the drop zone)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { layoutText } from '../../../relay/scenes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../../..');
const SCENE = 'dub-techno', EXAMPLES = path.join(REPO, 'examples');
const check = process.argv.slice(2).includes('--check');
const BPM = 120, LOOP_BEATS = 8;   // (the room's clock: the output page's Tempo 120; the sphere's loop is 8 beats, 4 s)

// ------------------------------------------------------------------ helpers --
const r3 = v => { const x = Math.round(v * 1000) / 1000; return x === 0 ? 0 : x; };
const r4 = v => { const x = Math.round(v * 1e4) / 1e4; return x === 0 ? 0 : x; };
const P = a => a.map(r3);
const flat = [r4(-Math.SQRT1_2), 0, 0, r4(Math.SQRT1_2)];   // (a plane laid on the floor, facing up)
const yawQ = deg => { const h = deg * Math.PI / 360; return [0, r4(Math.sin(h)), 0, r4(Math.cos(h))]; };
const COL = { desk: '#1b2230', rail: '#5c6878', a: '#46d9ff', b: '#3ee08f', turn: '#ffb43b', orb: '#c08cff', padA: '#ffb43b', padB: '#ff5a4b', padC: '#c08cff', wand: '#ffffff', sphere: '#46d9ff', floor: '#c08cff', drop: '#ff5a4b', speaker: '#1b2230', cone: '#5c6878' };
// a shape's record, its fields in the studio's order (norm in e6_items.js: name, shape, p, q, size, colour, look, then
// behaviour, motion, path, trk, press, stream, trail, then grab, shows, locked)
function shape(id, name, kind, p, size, colour, more = {}) {
  const r = { id, name, shape: kind, p: P(p), q: more.q || [0, 0, 0, 1], size: P(size), colour, look: 'colour' };
  for (const k of ['path', 'press', 'stream', 'trail']) if (more[k]) r[k] = more[k];
  if (more.grab) r.grab = true;
  if (more.locked) r.locked = true;
  return r;
}

// ------------------------------------------------------------------ the room --
// The desk stands in front of you as you start at the scene's middle facing -z; the dance floor behind you (+z), the drop zone
// at its left, the orbiting sphere above the dance floor. Desk top at 0.85 m.
const TOP = 0.85, RAIL = { x0: -1.15, x1: -0.15 };
const shapes = [
  shape('dkdesk', 'Desk', 'cube', [0, TOP / 2, -1.2], [2.6, TOP, 0.8], COL.desk, { locked: true }),
  // fader A: Filter (CC 20). The rail lies along x; the knob slides on it and its x is the controller across the rail's ends.
  shape('dkraia', 'Rail A (Filter)', 'cube', [(RAIL.x0 + RAIL.x1) / 2, TOP + 0.01, -0.98], [RAIL.x1 - RAIL.x0, 0.02, 0.04], COL.rail, { locked: true }),
  shape('dkfada', 'Fader A: Filter (CC 20)', 'cube', [-0.55, TOP + 0.045, -0.98], [0.07, 0.05, 0.11], COL.a, {
    stream: [{ v: 'x', min: RAIL.x0, max: RAIL.x1, smooth: 0.25, cc: 20 }], trail: { len: 1, w: 0.01 }, grab: true }),
  // fader B: Echo feedback (CC 21)
  shape('dkraib', 'Rail B (Echo feedback)', 'cube', [(RAIL.x0 + RAIL.x1) / 2, TOP + 0.01, -1.3], [RAIL.x1 - RAIL.x0, 0.02, 0.04], COL.rail, { locked: true }),
  shape('dkfadb', 'Fader B: Echo feedback (CC 21)', 'cube', [-0.75, TOP + 0.045, -1.3], [0.07, 0.05, 0.11], COL.b, {
    stream: [{ v: 'x', min: RAIL.x0, max: RAIL.x1, smooth: 0.25, cc: 21 }], trail: { len: 1, w: 0.01 }, grab: true }),
  // the turntable: Space (CC 22) from its turn about the vertical; a square platter so its turn shows
  shape('dkturn', 'Turntable: Space (CC 22)', 'cube', [0.35, TOP + 0.02, -1.15], [0.34, 0.03, 0.34], COL.turn, {
    stream: [{ v: 'yaw', smooth: 0.25, cc: 22 }], grab: true }),
  shape('dkspin', 'Turntable base', 'cylinder', [0.35, TOP + 0.005, -1.15], [0.42, 0.01, 0.42], COL.rail, { locked: true }),
  // three pads: notes 48, 38, 51 when pressed (editing off)
  shape('dkpada', 'Pad A: Stab (note 48)', 'cylinder', [0.95, TOP + 0.02, -0.95], [0.14, 0.04, 0.14], COL.padA, { press: { send: [{ on: 'press', note: 48, val: 100 }] } }),
  shape('dkpadb', 'Pad B: Rim (note 38)', 'cylinder', [0.95, TOP + 0.02, -1.2], [0.14, 0.04, 0.14], COL.padB, { press: { send: [{ on: 'press', note: 38, val: 100 }] } }),
  shape('dkpadc', 'Pad C: Siren (note 51)', 'cylinder', [0.95, TOP + 0.02, -1.45], [0.14, 0.04, 0.14], COL.padC, { press: { send: [{ on: 'press', note: 51, val: 100 }] } }),
  // the orb: Stab decay (CC 23) from its height, 0.8 to 2.0 m
  shape('dkorbb', 'Orb: Stab decay (CC 23)', 'sphere', [1.65, 1.2, -0.7], [0.2, 0.2, 0.2], COL.orb, {
    stream: [{ v: 'y', min: 0.8, max: 2, smooth: 0.25, cc: 23 }], trail: { len: 2, w: 0.02 }, grab: true }),
  // the dub wand: Throw (CC 25) from its speed while carried, and the Siren (note 51) past 0.7 m/s, louder the faster
  shape('dkwand', 'Dub wand: Throw (CC 25), Siren (note 51)', 'cylinder', [-1.65, 1.05, -0.7], [0.035, 0.6, 0.035], COL.wand, {
    stream: [{ v: 'speed', max: 2.5, smooth: 0.6, cc: 25 }, { v: 'speed', max: 2.5, note: 51, at: 0.28, vel: 'speed' }],
    trail: { len: 3, w: 0.03, col: '#ffb43b' }, grab: true }),
  // the dance floor and the drop zone, marked on the floor (their cubes are drawn only while editing)
  shape('dkflor', 'Dance floor (Hats, CC 24)', 'plane', [0.5, 0.005, 1.1], [2, 1.6, 0.01], COL.floor, { q: flat, locked: true }),
  shape('dkdrpm', 'Drop zone (kick off, note 36)', 'plane', [-1.6, 0.005, 1.5], [1, 1, 0.01], COL.drop, { q: flat, locked: true }),
  // two speaker stacks behind the desk, to read as a sound system
  shape('dkspkl', 'Speaker left', 'cube', [-1.9, 0.75, -2.1], [0.6, 1.5, 0.5], COL.speaker, { locked: true }),
  shape('dkconl', 'Speaker left cone', 'cylinder', [-1.9, 0.55, -1.84], [0.38, 0.02, 0.38], COL.cone, { q: [r4(Math.SQRT1_2), 0, 0, r4(Math.SQRT1_2)], locked: true }),
  shape('dkspkr', 'Speaker right', 'cube', [1.9, 0.75, -2.1], [0.6, 1.5, 0.5], COL.speaker, { locked: true }),
  shape('dkconr', 'Speaker right cone', 'cylinder', [1.9, 0.55, -1.84], [0.38, 0.02, 0.38], COL.cone, { q: [r4(Math.SQRT1_2), 0, 0, r4(Math.SQRT1_2)], locked: true }),
];

// the wobble sphere: a circle of radius 0.6 m above the dance floor, a recorded path locked to the room's beat (8 beats, 4 s at
// 120 bpm), its keys every 1/8 of a beat (0.0625 s at 120 bpm: 65 keys, the last at the first's place), its x streamed
const C = [0.5, 2.1, 1.1], R = 0.6, SPB = 60 / BPM, LOOP_S = LOOP_BEATS * SPB, STEPS = 64;
const keys = [];
for (let i = 0; i <= STEPS; i++) {
  const a = (i / STEPS) * 2 * Math.PI;
  keys.push([r3((i / STEPS) * LOOP_S), r3(R * Math.cos(a)), 0, r3(-R * Math.sin(a)), 0, 0, 0, 1]);
}
shapes.push(shape('dkwobl', 'Wobble sphere (CC 26, loops every 8 beats)', 'sphere', C, [0.16, 0.16, 0.16], COL.sphere, {
  path: { k: keys, play: 'loop', start: 'always', speed: 1, sync: 'beat', beats: LOOP_BEATS },
  stream: [{ v: 'x', min: r3(C[0] - R), max: r3(C[0] + R), smooth: 0.1, cc: 26 }],
  trail: { len: 4, w: 0.02 } }));

// a cube's record (norm: name, p, yaw, size, mode, show, hide, then send, all, stream, then locked)
function cube(id, name, p, size, more = {}) {
  const r = { id, name, p: P(p), yaw: 0, size: P(size), mode: 'while', show: [], hide: [] };
  if (more.send) r.send = more.send;
  if (more.all) r.all = true;
  if (more.stream) r.stream = more.stream;
  return r;
}
const cubes = [
  // the dance floor: how many people stand on it, for everyone at the circle (count 0..3 -> CC 24, Hats)
  cube('dkcflr', 'Dance floor: Hats (CC 24)', [0.5, 1.1, 1.1], [2, 2.2, 1.6], { all: true, stream: [{ v: 'count', max: 3, hz: 10, cc: 24 }] }),
  // the drop zone: a cube for everyone, so note 36 is held while anyone stands in it (on as the first enters, off 0.3 s after
  // the last has left: one held note, not one per device), and the patch mutes its kick meanwhile
  cube('dkcdrp', 'Drop zone: kick off (note 36 held)', [-1.6, 1.1, 1.5], [1, 2.2, 1], { all: true, send: [{ on: 'enter', note: 36, val: 100, hold: true }] }),
];

const groups = [{ id: 'dkgdsk', name: 'Desk', items: ['dkdesk', 'dkraia', 'dkraib', 'dkspin'], locked: true }];

const layout = {
  studio: 1, scene: SCENE, saved: '2026-11-17T12:00:00.000Z',
  objects: [], cubes, sounds: [], cuts: [], groups, shapes, empties: [],
  settings: { others: 'shown', real: 'device', hands: { len: 3, w: 0.02 } },
};

// ------------------------------------------------------------------ checks --
// the studio's limits and rules for what this scene uses (e6_items.js, e6v_stream.js, e6u_send.js, e6t_press.js, e6f_path.js,
// e6x_trails.js, e4_files.js LIMITS)
function lint(L) {
  const errs = [], ids = new Set(), STREAM_V = ['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'speed', 'vx', 'vy', 'vz', 'acc', 'spin', 'size', 'shown', 'clip', 'path', 'motion', 'near', 'count'];
  const LIMITS = { cubes: 100, shapes: 200, groups: 50 }, int = (x, a, b) => Number.isInteger(x) && x >= a && x <= b;
  let streams = 0, pathKeys = 0;
  for (const k of Object.keys(LIMITS)) if (L[k].length > LIMITS[k]) errs.push(`${k}: ${L[k].length} (at most ${LIMITS[k]})`);
  for (const it of [...L.shapes, ...L.cubes, ...L.groups]) {
    if (!/^[a-z0-9]{6}$/.test(it.id) || ids.has(it.id)) errs.push(`bad or repeated id ${it.id}`);
    ids.add(it.id);
    if (typeof it.name !== 'string' || !it.name.trim() || it.name.length > 60) errs.push(`${it.id}: name of ${it.name.length} characters (at most 60)`);
    const kind = L.cubes.includes(it) ? 'c' : 'p';
    if (it.size && it.size.some(v => v < (kind === 'c' ? 0.05 : 0.01))) errs.push(`${it.id}: a side under the studio's least`);
    if (it.stream) {
      if (it.stream.length > 8) errs.push(`${it.id}: ${it.stream.length} streams (at most 8)`);
      streams += it.stream.length;
      for (const s of it.stream) {
        if (!STREAM_V.includes(s.v) || (s.v === 'count' && kind !== 'c')) errs.push(`${it.id}: stream v ${s.v}`);
        if ((s.cc != null) === (s.note != null)) errs.push(`${it.id}: a stream needs cc or note, not both`);
        if (s.cc != null && !int(s.cc, 0, 127)) errs.push(`${it.id}: cc ${s.cc}`);
        if (s.note != null && !int(s.note, 0, 127)) errs.push(`${it.id}: note ${s.note}`);
        if (s.min != null && s.min === s.max) errs.push(`${it.id}: a stream's range of nothing`);
        // (a range end at the value's own is not written by the studio: written here, the scene would read as changed)
        const own = { x: [-3, 3], y: [0, 2.5], yaw: [-180, 180], speed: [0, 3], count: [0, 4] }[s.v] || [];
        if (s.min === own[0] || s.max === own[1]) errs.push(`${it.id}: a stream's range end at the value's own (leave it out)`);
        if (s.smooth != null && !(s.smooth > 0 && s.smooth <= 0.95)) errs.push(`${it.id}: smooth ${s.smooth}`);
        if (s.hz != null && !int(s.hz, 1, s.v === 'count' || s.v === 'near' ? 15 : 60)) errs.push(`${it.id}: hz ${s.hz}`);
        if (s.at != null && !(s.at >= 0.01 && s.at <= 0.99 && s.note != null)) errs.push(`${it.id}: at ${s.at}`);
      }
    }
    for (const e of (it.send || []).concat(it.press && it.press.send || [])) {
      if (!(kind === 'c' ? ['enter', 'leave', 'on', 'off'] : ['press', 'hover', 'unhover']).includes(e.on)) errs.push(`${it.id}: send on ${e.on}`);
      if (e.hold && !['enter', 'on', 'hover', 'start'].includes(e.on)) errs.push(`${it.id}: a hold on ${e.on}`);
      if (!int(e.note, 0, 127) || !int(e.val, 0, 127)) errs.push(`${it.id}: send note or val`);
    }
    if (it.trail && !(it.trail.len >= 0.5 && it.trail.len <= 10 && it.trail.w >= 0.005 && it.trail.w <= 0.1)) errs.push(`${it.id}: trail`);
    if (it.path) {
      const K = it.path.k;
      pathKeys += K.length;
      if (K.length < 2 || K.length > 600 || K[0][0] !== 0 || K[K.length - 1][0] > 120 || K.some((k, i) => k.length !== 8 || (i && !(k[0] > K[i - 1][0])))) errs.push(`${it.id}: path keys`);
      if (it.path.sync !== 'beat' || !int(it.path.beats, 1, 256)) errs.push(`${it.id}: path not on the beat`);
    }
  }
  for (const g of L.groups) for (const i of g.items) if (!ids.has(i)) errs.push(`group ${g.id} names ${i}, not in the scene`);
  if (streams > 64) errs.push(`${streams} streams (at most 64 a scene)`);
  if (pathKeys > 6000) errs.push(`${pathKeys} path keys (at most 6,000 a scene)`);
  // every entry of the shared map is here
  const ccs = new Set(L.shapes.concat(L.cubes).flatMap(i => (i.stream || []).filter(s => s.cc != null).map(s => s.cc)));
  for (const c of [20, 21, 22, 23, 24, 25, 26]) if (!ccs.has(c)) errs.push(`no stream on CC ${c}`);
  const notes = new Set(L.shapes.concat(L.cubes).flatMap(i => (i.send || []).concat(i.press && i.press.send || []).concat((i.stream || []).filter(s => s.note != null)).map(e => e.note)));
  for (const n of [36, 38, 48, 51]) if (!notes.has(n)) errs.push(`nothing sends note ${n}`);
  return { errs, streams, pathKeys };
}

const text = layoutText(layout), Lc = lint(layout);
for (const e of Lc.errs) console.log('LAYOUT: ' + e);
console.log(`the room: ${layout.shapes.length} shapes, ${layout.cubes.length} cubes, ${layout.groups.length} group; ${Lc.streams} streams, ${Lc.pathKeys} path keys`);
const dir = path.join(EXAMPLES, SCENE), file = path.join(dir, 'layout.json');
const scan = extra => execFileSync(process.execPath, [path.join(REPO, 'tools/studio/scan.mjs'), EXAMPLES, ...extra], { stdio: 'inherit' });
if (Lc.errs.length) { console.log('nothing written: the layout breaks the studio\'s rules (above)'); process.exitCode = 1; }
else if (check) {
  let stale = 0;
  const have = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (have !== text) { console.log(`NOT CURRENT examples/${SCENE}/layout.json`); stale++; }
  const extra = fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => n !== 'layout.json' && n !== 'files.json') : [];
  for (const n of extra) { console.log(`NOT MADE examples/${SCENE}/${n}`); stale++; }
  try { scan(['--check']); } catch { stale++; }
  if (stale) { console.log(`examples/${SCENE} is not current: run node tools/studio/dub/make.mjs`); process.exitCode = 1; }
  else console.log(`examples/${SCENE} is current`);
} else {
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) console.log(`unchanged examples/${SCENE}/layout.json`);
  else { fs.writeFileSync(file, text); console.log(`wrote examples/${SCENE}/layout.json`); }
  scan([]);
}
