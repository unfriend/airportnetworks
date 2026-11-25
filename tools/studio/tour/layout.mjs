import { STEP, rect, disc, yawOf, shapeTops, flatClashes, overhangs } from './checks.mjs';
// The studio tour's layout.json and the words of its signs (tools/studio/tour/README.md).
// A hall 7.6 m wide down -z from where you start (the scene's origin, facing -z): two boards at the entrance (welcome, and
// what else the studio does that a scene cannot show), then 26 stands, odd numbers on the left and even on the right, two
// metres apart along each side (the right side half a stand further on), in the order that teaches: the basics (blue),
// what reacts to you (green), what moves (amber); at the end the shuttle (violet). Each stand: its sign at the wall's side
// (the studio's name for the feature, one sentence on what it does, what to do here), the thing itself working in front
// of it, and where a cube does something a pad on the floor that marks it (its cube on the pad, floor to 2.2 m, so walking
// down the middle sets nothing off). Everything is the studio's own records; the engine's norm reads them back unchanged
// (the smoke test's 'studio tour' block).
// makeLayout(parts, files) -> { layout, errors, partOf }: parts by name ({ file, tris, draws, clips, box }), the scene's files.
// SIGNS: every sign's words and size (the generator's page draws them: parts.js, TOUR.signs). BANDS: the sections along
// the floor's edges (TOUR.bands).
const r4 = v => Math.round(v * 1e4) / 1e4 || 0, r3 = v => Math.round(v * 1e3) / 1e3 || 0;
const D2R = Math.PI / 180;
const yawQ = a => [0, r4(Math.sin(a / 2)), 0, r4(Math.cos(a / 2))];
const FLAT = [-0.7071, 0, 0, 0.7071];   // (a plane laid on the floor, facing up)
const PITCH = 2, Z0 = -3, STAGGER = 1;   // (two metres between stands along a side; the right side a metre further on)
const SHUTTLE_Z = -33.5;   // (the cabin's middle: the world outside it, 4.8 m round, keeps clear of every stand)
// (v203) the floor's tiles have their tops FLOOR_Y up, over the stage's own floor (y = 0), and the pads PAD_Y, a centimetre
// more: no two faces that overlap seen from above lie closer than checks.mjs's STEP, so none flickers in a headset
const FLOOR_Y = 0.012, PAD_Y = 0.024;

// ------------------------------------------------------------------ the words --
// n, section, title (the studio's own name for it), what (one sentence or two), here (what to do here)
export const STANDS = [
  [1, 'basics', 'Models', 'A model is a GLB file of your own, with its pictures, parts and animations (clips). Place as many as you like.', 'A robot of ours plays its clip Wave. Turn on Edit and select it to see its card.'],
  [2, 'basics', 'Textures', 'A model brings its pictures with it. The studio finds them, reads TIFF, TGA and more, and can compress them for headsets.', 'A painting of ours on an easel: a picture on a model.'],
  [3, 'basics', 'Tint and brightness', 'Any model can be tinted with a colour and made brighter or darker, without changing its file.', 'One vase three ways: as it is, tinted blue and brighter, tinted orange and darker.'],
  [4, 'basics', 'Faces', 'Some files draw only the outside of a thing, so it looks hollow from within. Faces: Both sides draws the inside too.', 'Look into both bowls. The left is as in the file, the right has Both sides.'],
  [5, 'basics', 'Shapes', 'Boxes, balls, cylinders and planes in any colour, from the Add pane. A shape set to Hides things lets the real room (AR) or the stage (VR) show through.', 'The four shapes, and a box that hides things, cutting a hole in the green panel.'],
  [6, 'basics', 'Groups and empties', 'A group moves, turns and locks as one. An empty is an invisible point that sounds and other items can follow.', 'Turn on Edit and select a cup: the table and its cups are one group. The small cross above them is an empty.'],
  [7, 'basics', 'Lock in place', 'A locked item refuses every move, size and delete, so nobody knocks it out of place by accident.', 'Turn on Edit and try to move the orange box: it says no.'],
  [8, 'basics', 'Cut-outs', 'A cut-out is a box that cuts a hole in a model, for a door or a window. A trigger cube can open and close it.', 'Step onto the pad: a window opens in the wall.'],
  [9, 'basics', 'On a wall, AR or VR only', 'In AR an item can go onto your real walls (behaviour On a wall), and any item can be shown only in AR or only in VR.', 'In VR you see the blue ball, in AR the orange box. In AR the purple poster goes onto your nearest real wall.'],
  [10, 'basics', 'Paintings', 'With editing on you can paint in the air with four brushes: ribbon, tube, glow and spray.', 'A painting of ours. Turn on Edit and pick Paint to add your own strokes.'],
  [11, 'react', 'Trigger cubes', 'A trigger cube is an invisible box. While you are inside, it shows some items and hides others, for you alone.', 'Step onto the pad: the light comes on and the grey box goes.'],
  [12, 'react', 'Cubes for everyone', 'Most cubes act for each person alone. A cube set to work for everyone acts for all as soon as anyone is inside.', 'Blue pad: only you see its ball. Gold pad: everyone sees its ball.'],
  [13, 'react', 'Cubes that start things', 'A cube can start a model\'s clip, a sound, a recorded path or a motion as you walk in or out.', 'Step onto the pad: the robot jumps, a bell rings and the top spins.'],
  [14, 'react', 'Cubes that change textures', 'A cube can swap a picture on a model while you are inside.', 'Step onto the pad: the painting turns from day to night.'],
  [15, 'react', 'Cubes that switch cubes', 'Cubes, presses and sequences can switch a cube off and on. A cube that is off reacts to nobody.', 'Press green to switch the pad on, red to switch it off, then step onto the pad.'],
  [16, 'react', 'Moved by anyone, cubes with a key', 'An item marked Moved by anyone can be carried with the grip, editing off. A cube with a key reacts to that item, not to people.', 'Grab the red ball and put it in the basket.'],
  [17, 'react', 'Sounds', 'A sound is a file placed at a point, louder as you come near. It can follow a moving model, and a cube can start it as you come close.', 'Step onto the pad: the music box plays and the buzz follows the bee round it.'],
  [18, 'react', 'Press and hover', 'An item can react when it is pressed (for everyone) and while it is pointed at (for you alone).', 'Point at the red button: it pulses. Press it (trigger, or click): a bell rings and the box spins.'],
  [19, 'react', 'Sequences', 'A sequence is a timeline of what happens: items shown and hidden, clips, sounds, paths, motions, other sequences.', 'Press the button: three lights and three notes in turn.'],
  [20, 'react', 'Screens', 'A screen plays videos or sounds from the scene\'s files, the same moment for everyone, with play, pause and next on its bar.', 'A player with two short tunes of ours: use its bar. For a video, upload an MP4 of your own and add a screen.'],
  [21, 'react', 'Sends to the output page', 'Cubes, presses and sequences can send MIDI notes and OSC to music software, through the output page on a PC.', 'With the output page open, standing on the pad holds note 60 (middle C). Without it nothing happens.'],
  [22, 'move', 'Motions', 'Six simple motions for any item, at any speed: Spin, Wobble, Bob, Pulse, Orbit and Sway.', 'All six, in that order, from the left.'],
  [23, 'move', 'Behaviours', 'Items can react to people: Look at, Follow, Keep away, or follow another item.', 'Walk up: the eye watches you, the robot comes to you, the red ball keeps away and the small ball follows it.'],
  [24, 'move', 'Recorded paths, As it moves', 'Record a path by carrying an item, then it plays it back. With As it moves, a model\'s walk keeps pace with the ground it covers.', 'The robot walks its path, stops, and walks on.'],
  [25, 'move', 'The ghost and the timeline', 'While editing, anything that moves leaves a grey ghost where it is placed, and a selected model shows a timeline to pause and scrub.', 'Turn on Edit and select the dancing robot.'],
  [26, 'move', 'Trails', 'A trail of light can follow any item as it moves. The scene\'s Hand trails give people\'s hands trails too.', 'Two balls drawing trails in the air.'],
].map(([n, section, title, what, here]) => ({ n, section, title, what, here }));
const SLUG = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28).replace(/-$/, '');
export const SIGNS = [
  ...STANDS.map(s => Object.assign({ part: 'sign-' + s.n, file: `signs/${String(s.n).padStart(2, '0')}-${SLUG(s.title)}.glb`, mid: 1.55 }, s)),
  { part: 'sign-welcome', file: 'signs/00-welcome.glb', section: 'board', title: 'Studio tour', w: 1.3, h: 1.0, px: 768, mid: 1.5, size: 31,
    what: ['One stand for each thing the studio does, in order down the hall: the basics (blue), things that react to you (green), things that move (amber), and at the end a shuttle.',
      'Walk, or move with the sticks. Most stands work with editing off; where a sign says Turn on Edit, use Edit on the Scene pane.'],
    here: 'Start at stand 1, on your left.' },
  { part: 'sign-also', file: 'signs/00-also.glb', section: 'board', title: 'Also in the studio', w: 1.3, h: 1.1, px: 768, mid: 1.5, size: 27,
    what: ['Uploads: drop models, pictures and sounds on the upload page; models become GLB.', 'Fewer triangles and Change texture: lighter models for a headset.',
      'The room scan: your real room as a model. Trackers: props and a character worn with Vive trackers.', 'Live sound: a sound input heard in the room.',
      'The output page: streams of movement to MIDI and OSC, loops on the beat.', 'Editing itself: the cards, Undo, Save, the colour picker, Copy to the relay.'] },
  { part: 'sign-shuttle', file: 'signs/27-the-shuttle.glb', section: 'shuttle', n: 27, title: 'The shuttle', mid: 1.55,
    what: 'Room for four. Its cabin is a trigger cube: inside it, for you alone, the hall goes and a world outside comes.', here: 'Walk in through the door and sit down. VR goggles are on the shelf.' },
  { part: 'sign-goggles', file: 'signs/27-goggles.glb', section: 'shuttle', title: 'VR goggles', w: 0.66, h: 0.7, px: 512, post: false, mid: 1.62, size: 27, small: true,
    what: 'Sit or stand still. Take them with the grip and bring them to your face: a flight through a cell.',
    here: 'Each grip is a throttle (both: full speed), either stick steers, the trigger scans. Controllers, not hands. Off: grip at your face and pull away.' },
  { part: 'sign-game', file: 'signs/27-game-screen.glb', section: 'shuttle', title: 'Game screen', w: 0.9, h: 0.34, px: 640, post: false, mid: 1.0, size: 30, small: true,
    what: 'The goggles\' flight for everyone here: who flies, what they scanned, the links they followed, where to next.' },
];

// ------------------------------------------------------------------ the stands --
// a stand's frame: u out from the hall's middle towards its wall, w along the hall away from you (to the shuttle); its
// side s (-1 left, +1 right), its middle z
const standAt = n => { const i = Math.floor((n - 1) / 2), s = n % 2 ? -1 : 1; return { s, z: Z0 - i * PITCH - (s > 0 ? STAGGER : 0) }; };
const AT = (n, u, w, y = 0) => { const { s, z } = standAt(n); return [r3(s * u), r3(y), r3(z - w)]; };
const FACE = n => (standAt(n).s < 0 ? 90 : -90) * D2R;   // (the yaw that turns a thing's front, +z, to the hall's middle)
const SIGN_YAW = n => (standAt(n).s < 0 ? 65 : -65) * D2R;   // (its sign turned a little towards you as you come)
export const BANDS = (() => {
  const zs = sec => STANDS.filter(s => s.section === sec).map(s => standAt(s.n).z);
  return ['basics', 'react', 'move'].map(sec => [r3(Math.max(...zs(sec)) + 0.9), r3(Math.min(...zs(sec)) - 0.9), sec]).concat([[r3(SHUTTLE_Z + 3.4), -38.4, 'shuttle']]);
})();

export function makeLayout(parts, files) {
  const errors = [], have = new Set(files), partOf = {};
  for (const [n, p] of Object.entries(parts)) partOf[p.file] = n;
  const objects = [], cubes = [], sounds = [], cuts = [], groups = [], shapes = [], empties = [], sequences = [], screens = [], paintings = [];
  const clipsOf = n => (parts[n] ? parts[n].clips.map(c => c.name) : []);
  // an object (fields in the studio's order, each kept only when set)
  const obj = (id, name, part, p, yaw, o = {}) => {
    const P = parts[part];
    if (!P) { errors.push(`${id}: no part ${part}`); return null; }
    if (!have.has(P.file)) errors.push(`${id}: ${P.file} is not in the scene`);
    const clip = o.clip || '';
    if (clip && !clipsOf(part).includes(clip)) errors.push(`${id}: ${part} has no clip ${clip}`);
    if (o.idle && !clipsOf(part).includes(o.idle)) errors.push(`${id}: ${part} has no clip ${o.idle}`);
    const r = { id, name, file: P.file, p: p.map(r3), q: yawQ(yaw || 0), s: 1, light: 'lit', clip, anim: o.anim || (clip ? 'loop' : 'loop'), start: 'always' };
    for (const k of ['idle', 'faces', 'tint', 'bright', 'behaviour', 'motion', 'path', 'press', 'trail', 'shows']) if (o[k] !== undefined) r[k] = o[k];
    if (o.grab) r.grab = true;
    if (o.locked) r.locked = true;
    objects.push(r);
    return r;
  };
  const shape = (id, name, kind, p, size, colour, o = {}) => {
    const r = { id, name, shape: kind, p: p.map(r3), q: o.q || yawQ(o.yaw || 0), size: size.map(r3), colour, look: o.look || 'colour' };
    for (const k of ['behaviour', 'motion', 'path', 'press', 'trail', 'shows']) if (o[k] !== undefined) r[k] = o[k];
    if (o.grab) r.grab = true;
    if (o.locked) r.locked = true;
    shapes.push(r);
    return r;
  };
  const cube = (id, name, p, size, o = {}) => {
    const r = { id, name, p: p.map(r3), yaw: 0, size: size.map(r3), mode: o.mode || 'while', show: o.show || [], hide: o.hide || [] };
    for (const k of ['tex', 'plays', 'send']) if (o[k]) r[k] = o[k];
    if (o.all) r.all = true;
    if (o.key) r.key = o.key;
    cubes.push(r);
    return r;
  };
  const sound = (id, name, file, p, o = {}) => {
    if (!have.has(file)) errors.push(`${id}: ${file} is not in the scene`);
    const r = { id, name, file, p: p.map(r3), vol: o.vol || 1, r: o.r || 1.5, loop: !!o.loop, start: 'always' };
    if (o.on) r.on = o.on;
    sounds.push(r);
    return r;
  };
  const run = (on, what, how, o = {}) => Object.assign({ on, what }, o.clip ? { clip: o.clip } : {}, { how: how || 'once' });
  const sign = (n, id) => obj(id || 'sg' + String(n).padStart(4, '0'), `Sign ${n}: ${STANDS[n - 1].title}`.slice(0, 60), 'sign-' + n, AT(n, 3.3, 0), SIGN_YAW(n), { locked: true });
  // a pad on the floor (a flat plane, locked: it marks the cube) and its cube on it, floor to 2.2 m
  const pad = (n, id, name, w, colour, o = {}) => {
    const side = o.side || 0.9;
    shape('pd' + id.slice(2), `Pad: ${name}`.slice(0, 60), 'plane', AT(n, 1.95, w, PAD_Y), [side, side, 0.01], colour, { q: FLAT, locked: true });
    return cube(id, name, AT(n, 1.95, w, 1.1), [side, 2.2, side], o);
  };
  const robot = (id, name, n, u, w, o) => obj(id, name, 'robot', AT(n, u, w), o.yaw !== undefined ? o.yaw : FACE(n), o);

  // ---- the entrance: the welcome board on the left, Also in the studio on the right, turned towards you
  obj('hall01', 'Hall', 'hall', [0, 0, 0], 0, { locked: true });
  obj('sgwelc', 'Sign: Studio tour', 'sign-welcome', [-2.3, 0, -0.9], 35 * D2R, { locked: true });
  obj('sgalso', 'Sign: Also in the studio', 'sign-also', [2.3, 0, -0.9], -35 * D2R, { locked: true });
  for (const s of STANDS) sign(s.n);

  // ---- the basics
  robot('rbt001', 'Robot (Models)', 1, 2.7, 0.75, { clip: 'Wave' });
  obj('esl002', 'Easel (Textures)', 'easel', AT(2, 2.7, 0.75), FACE(2));
  // (a table's size [along the hall, height, across it]: its own x runs along the hall, FACE; checks below: nothing overhangs)
  shape('pl0003', 'Plinth (Tint)', 'cube', AT(3, 2.6, 0, 0.35), [1.2, 0.7, 0.4], '#4a5568', { yaw: FACE(3), locked: true });
  obj('vas03a', 'Vase as it is', 'vase', AT(3, 2.6, -0.4, 0.7), FACE(3));
  obj('vas03b', 'Vase tinted blue, brighter', 'vase', AT(3, 2.6, 0, 0.7), FACE(3), { tint: '#5aa9ff', bright: 1.6 });
  obj('vas03c', 'Vase tinted orange, darker', 'vase', AT(3, 2.6, 0.4, 0.7), FACE(3), { tint: '#ff8a3d', bright: 0.6 });
  shape('pl0004', 'Plinth (Faces)', 'cube', AT(4, 2.6, 0, 0.35), [1.1, 0.7, 0.5], '#4a5568', { yaw: FACE(4), locked: true });
  obj('bwl04a', 'Bowl as in the file', 'bowl', AT(4, 2.6, -0.3, 0.7), FACE(4));
  obj('bwl04b', 'Bowl with both sides', 'bowl', AT(4, 2.6, 0.3, 0.7), FACE(4), { faces: 'both' });
  shape('shp05a', 'Box', 'cube', AT(5, 2.5, -0.6, 0.15), [0.3, 0.3, 0.3], '#46d9ff', { yaw: FACE(5) });
  shape('shp05b', 'Ball', 'sphere', AT(5, 2.5, -0.15, 0.15), [0.3, 0.3, 0.3], '#ffb43b');
  shape('shp05c', 'Cylinder', 'cylinder', AT(5, 2.5, 0.3, 0.25), [0.25, 0.5, 0.25], '#c08cff');
  shape('shp05d', 'Plane (green panel)', 'plane', AT(5, 3.0, 0.55, 0.65), [0.6, 0.5, 0.01], '#3ee08f', { yaw: FACE(5) });
  shape('shp05e', 'Box that hides things', 'cube', AT(5, 2.85, 0.55, 0.65), [0.2, 0.2, 0.2], '#ffffff', { yaw: FACE(5), look: 'hide' });
  shape('tbl006', 'Table', 'cube', AT(6, 2.6, 0, 0.3), [0.8, 0.6, 0.5], '#8a5a34', { yaw: FACE(6) });
  shape('cup06a', 'Cup 1', 'cylinder', AT(6, 2.5, -0.22, 0.65), [0.09, 0.1, 0.09], '#f1efe9');
  shape('cup06b', 'Cup 2', 'cylinder', AT(6, 2.65, 0.05, 0.65), [0.09, 0.1, 0.09], '#5aa9ff');
  shape('cup06c', 'Cup 3', 'cylinder', AT(6, 2.5, 0.25, 0.65), [0.09, 0.1, 0.09], '#ff8a3d');
  empties.push({ id: 'emp006', name: 'Empty above the table', p: AT(6, 2.6, 0, 1.0), q: [0, 0, 0, 1] });
  groups.push({ id: 'gtable', name: 'Table and cups', items: ['tbl006', 'cup06a', 'cup06b', 'cup06c'] });
  shape('crt007', 'Locked box', 'cube', AT(7, 2.6, 0, 0.25), [0.5, 0.5, 0.5], '#ff8a3d', { yaw: FACE(7), locked: true });
  obj('wal008', 'Low wall (Cut-outs)', 'low-wall', AT(8, 2.75, 0), FACE(8));
  cuts.push({ id: 'cut008', name: 'Window', on: 'wal008', p: [0, 0.55, 0], q: [0, 0, 0, 1], size: [0.5, 0.4, 0.4] });
  shape('bal008', 'Ball behind the wall', 'sphere', AT(8, 3.05, 0, 0.55), [0.25, 0.25, 0.25], '#ffd34d');
  pad(8, 'cub008', 'Window opens', 0, '#3ee08f', { show: ['cut008'] });
  shape('pst009', 'Poster on a wall (AR)', 'plane', AT(9, 3.0, -0.55, 0.8), [0.45, 0.35, 0.01], '#c08cff', { yaw: FACE(9), behaviour: { kind: 'wall', at: 'nearest' } });
  shape('vrb009', 'Blue ball (VR only)', 'sphere', AT(9, 2.6, 0.3, 0.2), [0.3, 0.3, 0.3], '#2f6fd6', { shows: 'vr' });
  shape('arb009', 'Orange box (AR only)', 'cube', AT(9, 2.6, 0.3, 0.15), [0.3, 0.3, 0.3], '#ff8a3d', { yaw: FACE(9), shows: 'ar' });
  paintings.push({ id: 'pnt010', name: 'Painting', p: AT(10, 2.65, 0, 0.6), q: yawQ(FACE(10)), s: 1, strokes: strokes() });

  // ---- what reacts to you
  shape('pst11a', 'Lamp post', 'cylinder', AT(11, 2.65, -0.35, 0.3), [0.06, 0.6, 0.06], '#5b6472', { locked: true });
  shape('lmp011', 'Lamp (shown)', 'sphere', AT(11, 2.65, -0.35, 0.72), [0.24, 0.24, 0.24], '#ffd34d');
  shape('box011', 'Grey box (hidden)', 'cube', AT(11, 2.65, 0.4, 0.18), [0.36, 0.36, 0.36], '#8a95a8', { yaw: FACE(11) });
  pad(11, 'cub011', 'Show and hide', 0, '#3ee08f', { show: ['lmp011'], hide: ['box011'] });
  shape('bl012a', 'Your own ball', 'sphere', AT(12, 2.75, -0.45, 0.5), [0.26, 0.26, 0.26], '#2f6fd6');
  shape('bl012b', 'Everyone\'s ball', 'sphere', AT(12, 2.75, 0.45, 0.5), [0.26, 0.26, 0.26], '#ffd34d');
  pad(12, 'cub12a', 'Your own (blue pad)', -0.45, '#2f6fd6', { side: 0.8, show: ['bl012a'] });
  pad(12, 'cub12b', 'For everyone (gold pad)', 0.45, '#ffd34d', { side: 0.8, show: ['bl012b'], all: true });
  robot('rbt013', 'Robot (Cubes that start things)', 13, 2.75, 0.7, { clip: 'Idle' });
  shape('top013', 'Spinning top', 'cylinder', AT(13, 2.6, -0.4, 0.2), [0.3, 0.4, 0.3], '#ffb43b', { motion: { kind: 'spin', speed: 60, amount: 0, axis: 'y', start: 'always' } });
  sound('snd013', 'Bell (Cubes that start things)', 'sounds/bell.wav', AT(13, 2.7, 0, 1.0), { r: 2 });
  pad(13, 'cub013', 'Starts things', 0, '#3ee08f', { plays: [run('rbt013', 'clip', 'once', { clip: 'Jump' }), run('snd013', 'sound'), run('top013', 'motion', 'loop')] });
  obj('esl014', 'Easel (Change textures)', 'easel', AT(14, 2.7, 0.75), FACE(14));
  pad(14, 'cub014', 'Day to night', 0, '#3ee08f', { tex: [{ on: 'esl014', mat: 0, slot: 'map', file: 'pictures/night.jpg' }] });
  shape('dsk015', 'Button desk', 'cube', AT(15, 2.6, -0.65, 0.45), [0.5, 0.9, 0.3], '#5b6472', { yaw: FACE(15), locked: true });
  shape('pst15b', 'Lamp post 2', 'cylinder', AT(15, 2.7, 0.45, 0.3), [0.06, 0.6, 0.06], '#5b6472', { locked: true });
  shape('lmp015', 'Lamp (pad switched on)', 'sphere', AT(15, 2.7, 0.45, 0.72), [0.24, 0.24, 0.24], '#3ee08f');
  const sw = pad(15, 'cub015', 'Switched pad', 0, '#3ee08f', { show: ['lmp015'] });
  shape('btn15a', 'Green button: switch on', 'cylinder', AT(15, 2.6, -0.78, 0.92), [0.13, 0.05, 0.13], '#3ee08f', { press: { do: [{ on: sw.id, what: 'show' }] } });
  shape('btn15b', 'Red button: switch off', 'cylinder', AT(15, 2.6, -0.52, 0.92), [0.13, 0.05, 0.13], '#ff5a4b', { press: { do: [{ on: sw.id, what: 'hide' }] } });
  shape('pst016', 'Ball stand', 'cylinder', AT(16, 2.45, -0.5, 0.4), [0.1, 0.8, 0.1], '#5b6472', { locked: true });
  shape('bal016', 'Red ball (anyone may carry it)', 'sphere', AT(16, 2.45, -0.5, 0.89), [0.18, 0.18, 0.18], '#ff5a4b', { grab: true });
  shape('bsk016', 'Basket', 'cylinder', AT(16, 2.7, 0.45, 0.12), [0.5, 0.24, 0.5], '#8a5a34', { locked: true });
  shape('str016', 'Star (the ball is in)', 'sphere', AT(16, 2.7, 0.45, 0.95), [0.16, 0.16, 0.16], '#ffd34d', { motion: { kind: 'pulse', speed: 60, amount: 0.3, axis: 'y', start: 'always' } });
  sound('snd016', 'Pop (basket)', 'sounds/pop.wav', AT(16, 2.7, 0.45, 0.4), { r: 2 });
  cube('cub016', 'Basket: reacts to the red ball', AT(16, 2.7, 0.45, 0.4), [0.6, 0.8, 0.6], { key: 'bal016', show: ['str016'], plays: [run('snd016', 'sound')] });
  shape('pst017', 'Music box stand', 'cylinder', AT(17, 2.65, 0, 0.36), [0.36, 0.72, 0.36], '#5b6472', { locked: true });
  shape('mbx017', 'Music box', 'cube', AT(17, 2.65, 0, 0.81), [0.24, 0.18, 0.18], '#8a5a34', { yaw: FACE(17) });
  obj('bee017', 'Bee', 'bee', AT(17, 2.65, 0, 1.0), FACE(17), { clip: 'Fly', motion: { kind: 'orbit', speed: 10, amount: 0.35, axis: 'y', start: 'always' } });
  sound('snd17a', 'Music box', 'sounds/music-box.wav', AT(17, 2.65, 0, 0.81), { vol: 0.6, r: 0.8, loop: true });
  sound('snd17b', 'Buzz (follows the bee)', 'sounds/buzz.wav', AT(17, 2.65, 0, 1.0), { vol: 0.5, r: 0.6, loop: true, on: 'bee017' });
  pad(17, 'cub017', 'Sounds play', 0, '#3ee08f', { plays: [run('snd17a', 'sound', 'loop'), run('snd17b', 'sound', 'loop')] });
  shape('pst018', 'Button stand', 'cube', AT(18, 2.5, -0.4, 0.45), [0.3, 0.9, 0.3], '#5b6472', { yaw: FACE(18), locked: true });
  shape('spn018', 'Box that spins', 'cube', AT(18, 2.75, 0.45, 0.25), [0.3, 0.3, 0.3], '#ff8a3d', { yaw: FACE(18), motion: { kind: 'spin', speed: 60, amount: 0, axis: 'y', start: 'always' } });
  sound('snd018', 'Bell (Press)', 'sounds/bell.wav', AT(18, 2.6, 0, 1.0), { r: 2 });
  shape('btn018', 'Red button: press me', 'cylinder', AT(18, 2.5, -0.4, 0.93), [0.2, 0.06, 0.2], '#ff5a4b', {
    motion: { kind: 'pulse', speed: 90, amount: 0.15, axis: 'y', start: 'always' },
    press: { do: [run('snd018', 'sound'), run('spn018', 'motion')], hover: [run('btn018', 'motion', 'loop')] } });
  shape('pst019', 'Button stand 2', 'cube', AT(19, 2.5, -0.6, 0.45), [0.3, 0.9, 0.3], '#5b6472', { yaw: FACE(19), locked: true });
  const LAMPS = [['lmp19a', 'Red light', '#ff5a4b', -0.05, 'snd19a', 'note-c'], ['lmp19b', 'Green light', '#3ee08f', 0.25, 'snd19b', 'note-e'], ['lmp19c', 'Blue light', '#46d9ff', 0.55, 'snd19c', 'note-g']];
  // (v203: each light on a thin post of its own, no block under them)
  for (const [id, name, c, w, sid, f] of LAMPS) { shape('pst' + id.slice(3), `Post (${name.toLowerCase()})`, 'cylinder', AT(19, 2.72, w, 0.365), [0.05, 0.73, 0.05], '#5b6472', { locked: true }); shape(id, name, 'sphere', AT(19, 2.72, w, 0.82), [0.18, 0.18, 0.18], c); sound(sid, `Note (${name.toLowerCase()})`, `sounds/${f}.wav`, AT(19, 2.72, w, 0.82), { r: 2 }); }
  sequences.push({ id: 'seq019', name: 'Lights and notes', len: 3.5, ev: [
    ...LAMPS.flatMap(([id, , , , sid], i) => [{ t: i * 0.6, on: id, what: 'show' }, { t: i * 0.6, on: sid, what: 'sound', how: 'once' }]),
    ...LAMPS.map(([id]) => ({ t: 3, on: id, what: 'hide' }))] });
  shape('btn019', 'Button: play the sequence', 'cylinder', AT(19, 2.5, -0.6, 0.93), [0.2, 0.06, 0.2], '#3ee08f', { press: { do: [{ on: 'seq019', what: 'seq', how: 'once' }] } });
  shape('pl0020', 'Plinth (Screens)', 'cube', AT(20, 2.65, 0, 0.35), [0.4, 0.7, 0.6], '#4a5568', { yaw: FACE(20), locked: true });
  screens.push({ id: 'scr020', name: 'Player with two tunes', p: AT(20, 2.65, 0, 0.86), q: yawQ(FACE(20)), w: 0.6, look: 'audio', list: ['sounds/tune-1.wav', 'sounds/tune-2.wav'], loop: 'all', vol: 0.8, r: 2, ctl: 'any' });
  // (the keys run along the hall, left to right for whoever stands on the pad)
  shape('pst021', 'Keyboard stand', 'cube', AT(21, 2.65, 0, 0.36), [0.8, 0.72, 0.3], '#5b6472', { yaw: FACE(21), locked: true });
  shape('key021', 'Keys', 'cube', AT(21, 2.65, 0, 0.75), [0.7, 0.06, 0.22], '#f1efe9', { yaw: FACE(21) });
  pad(21, 'cub021', 'Sends note 60', 0, '#3ee08f', { send: [{ on: 'enter', note: 60, val: 100, hold: true }] });

  // ---- what moves
  shape('shf022', 'Shelf (Motions)', 'cube', AT(22, 2.65, 0, 0.3), [1.5, 0.6, 0.4], '#4a5568', { yaw: FACE(22), locked: true });
  const MOT = [['spin', 'cube', { speed: 20, amount: 0 }], ['wobble', 'cylinder', { speed: 30, amount: 20 }], ['bob', 'sphere', { speed: 30, amount: 0.1 }],
    ['pulse', 'sphere', { speed: 40, amount: 0.3 }], ['orbit', 'sphere', { speed: 20, amount: 0.1 }], ['sway', 'cube', { speed: 30, amount: 30 }]];
  MOT.forEach(([k, kind, m], i) => {
    const w = -0.6 + i * 0.24, size = k === 'sway' ? [0.04, 0.24, 0.04] : k === 'orbit' ? [0.08, 0.08, 0.08] : [0.14, 0.14, 0.14];
    shape('mo22' + k.slice(0, 2), k[0].toUpperCase() + k.slice(1), kind, AT(22, 2.65, w, 0.62 + size[1] / 2 + (k === 'bob' ? 0.1 : 0)), size, ['#46d9ff', '#ffb43b', '#3ee08f', '#ff5a4b', '#c08cff', '#ffd34d'][i],
      { yaw: kind === 'cube' ? FACE(22) : 0, motion: Object.assign({ kind: k }, m, { axis: k === 'sway' ? 'x' : 'y', start: 'always' }) });
  });
  obj('eye023', 'Eye (Look at)', 'eye', AT(23, 2.75, -0.65), FACE(23), { behaviour: { kind: 'look', who: 'nearest', range: 4 } });
  robot('rbt023', 'Robot (Follow)', 23, 2.6, 0.15, { clip: 'Walk', anim: 'move', idle: 'Idle', behaviour: { kind: 'follow', who: 'nearest', range: 1.5, dist: 0.9, speed: 0.45 } });
  shape('avd023', 'Red ball (Keep away)', 'sphere', AT(23, 2.55, 0.75, 0.13), [0.26, 0.26, 0.26], '#ff5a4b', { behaviour: { kind: 'avoid', who: 'nearest', range: 1.5, dist: 1, speed: 0.8, area: 0.8 } });
  shape('itm023', 'Small ball (follows the red one)', 'sphere', AT(23, 2.55, 0.75, 0.45), [0.12, 0.12, 0.12], '#ffd34d', { behaviour: { kind: 'item', target: 'avd023', speed: 1.5 } });
  robot('rbt024', 'Robot (Recorded path)', 24, 2.25, 0, { yaw: 0, clip: 'Walk', anim: 'move', idle: 'Idle', path: ovalPath(standAt(24).s) });
  robot('rbt025', 'Robot (Dancing)', 25, 2.65, 0.7, { clip: 'Dance', path: swayPath() });
  shape('tr026a', 'Ball with a trail (orbit)', 'sphere', AT(26, 2.6, -0.35, 0.8), [0.08, 0.08, 0.08], '#ffd34d', { motion: { kind: 'orbit', speed: 20, amount: 0.3, axis: 'y', start: 'always' }, trail: { len: 2, w: 0.02 } });
  shape('tr026b', 'Ball with a trail (path)', 'sphere', AT(26, 2.6, 0.4, 0.7), [0.08, 0.08, 0.08], '#46d9ff', { path: eightPath(), trail: { len: 3, w: 0.015, col: '#46d9ff' } });

  // ---- the shuttle (one group: the shuttle, its cube, the world outside it, the goggles, its signs and its whoosh)
  const SZ = SHUTTLE_Z, X = (x, y, z) => [x, y, r3(SZ + z)];
  obj('shtl01', 'Shuttle', 'shuttle', X(0, 0, 0), 0);
  obj('elsew1', 'Somewhere else (round the shuttle)', 'elsewhere', X(0, 0, 0), 0);
  obj('sg0027', 'Sign 27: The shuttle', 'sign-shuttle', X(-1.25, 0, 2.6), 20 * D2R, { locked: true });
  // (the inside signs on the front wall's lining, their backs on it: the lining's face is at z = -1.9 + 0.08 + 0.011)
  const WALL_Z = -1.9 + 0.08 + 0.012;
  obj('sggogg', 'Sign: VR goggles', 'sign-goggles', X(0.85, 0, WALL_Z), 0);
  // (v203: the game's screen, its picture the studio's own as it runs (a material named GameScreen: e6z_goggles.js), and
  // its sign under it)
  obj('gscr27', 'Game screen (the goggles\' flight)', 'game-screen', X(-0.45, 0, WALL_Z), 0, { locked: true });
  obj('sggame', 'Sign: Game screen', 'sign-game', X(-0.45, 0, WALL_Z), 0);
  shape('gog027', 'VR goggles', 'goggles', X(0.85, 1.065, -1.69), [0.18, 0.09, 0.1], '#ffffff');
  sound('snd027', 'Whoosh (the shuttle starts)', 'sounds/whoosh.wav', X(0, 1.5, 0), { r: 3 });
  cube('cbn027', 'Shuttle cabin: somewhere else', X(0, 1.2, 0.05), [2.6, 2.3, 3.6], { show: ['elsew1'], hide: ['hall01', 'sg0027'], plays: [run('snd027', 'sound')] });
  groups.push({ id: 'gshutl', name: 'Shuttle', items: ['shtl01', 'elsew1', 'sg0027', 'sggogg', 'gscr27', 'sggame', 'gog027', 'snd027', 'cbn027'] });

  // ---- checks: ids, what cubes and groups name, the world outside the shuttle clear of every stand
  const ids = new Set(), all = [objects, cubes, sounds, cuts, groups, shapes, empties, sequences, screens, paintings].flat();
  for (const x of all) { if (!/^[a-z0-9]{6}$/.test(x.id)) errors.push(`${x.id}: not six letters and digits`); if (ids.has(x.id)) errors.push(`${x.id}: used twice`); ids.add(x.id); if (!x.name || x.name.length > 60) errors.push(`${x.id}: its name (${x.name.length} characters, at most 60)`); }
  for (const c of cubes) for (const k of [...c.show, ...c.hide, ...(c.plays || []).map(e => e.on), ...(c.tex || []).map(e => e.on), c.key].filter(Boolean)) if (!ids.has(k)) errors.push(`${c.id}: names ${k}, not in the scene`);
  for (const g of groups) for (const k of g.items) if (!ids.has(k)) errors.push(`${g.id}: names ${k}, not in the scene`);
  for (const c of cubes) for (const e of c.plays || []) if (e.what === 'clip') { const t = objects.find(o => o.id === e.on); if (!t || !clipsOf(partOf[t.file]).includes(e.clip)) errors.push(`${c.id}: starts ${e.clip} on ${e.on}, which has no such clip`); }
  for (const c of cubes) for (const e of c.tex || []) if (!have.has(e.file)) errors.push(`${c.id}: ${e.file} is not in the scene`);
  for (const v of screens) for (const f of v.list) if (!have.has(f)) errors.push(`${v.id}: ${f} is not in the scene`);
  const R = 4.8;
  for (const x of [...objects, ...shapes, ...sounds].filter(x => !['shtl01', 'elsew1', 'sg0027', 'sggogg', 'gscr27', 'sggame', 'gog027', 'snd027', 'hall01'].includes(x.id))) if (Math.hypot(x.p[0], x.p[2] - SZ) < R + 0.5) errors.push(`${x.id} stands inside the world round the shuttle`);
  // ---- (v203) what stands where: nothing overhangs its table, no two faces facing up overlap closer than STEP in height
  errors.push(...standChecks(parts, objects, shapes, screens));
  const layout = { studio: 1, scene: 'studio-tour', saved: '2026-11-24T12:00:00.000Z', objects, cubes, sounds, cuts, groups, shapes, empties, sequences, screens, paintings,
    settings: { others: 'shown', real: 'device', grid: 'hidden' } };
  return { layout, errors, partOf };
}

// ------------------------------------------------------------------ the floor and the checks --
// (v203) the hall's floor as tiles that never overlap, all with their tops at FLOOR_Y: in x, a strip by each wall, the
// sections' bands (their ends cut half way where two sections' bands would overlap), the floor and the walkway down the
// middle (from 1 m in from the entrance's wall); each tile [x0, x1, z0, z1, colour: 'floor', 'walk' or a section]
const HALL = { X: 3.8, Z0: 2.5, Z1: -38.5, walk: 1.3, band: [3.15, 3.65], walkZ: 1.5 };
export const FLOOR = (() => {
  const T = [], B = BANDS.map(b => b.slice()).sort((a, b) => b[0] - a[0]);
  for (let i = 1; i < B.length; i++) if (B[i][0] > B[i - 1][1]) { const m = r3((B[i][0] + B[i - 1][1]) / 2); B[i][0] = B[i - 1][1] = m; }
  for (const sx of [-1, 1]) {
    const xs = (a, b) => (sx < 0 ? [-b, -a] : [a, b]);
    T.push([...xs(HALL.band[1], HALL.X), HALL.Z0, HALL.Z1, 'floor'], [...xs(HALL.walk, HALL.band[0]), HALL.Z0, HALL.Z1, 'floor']);
    let z = HALL.Z0;
    for (const [z0, z1, c] of B) { if (z0 < z) T.push([...xs(...HALL.band), z, z0, 'floor']); T.push([...xs(...HALL.band), z0, z1, c]); z = z1; }
    if (z > HALL.Z1) T.push([...xs(...HALL.band), z, HALL.Z1, 'floor']);
  }
  T.push([-HALL.walk, HALL.walk, HALL.Z0, HALL.walkZ, 'floor'], [-HALL.walk, HALL.walk, HALL.walkZ, HALL.Z1, 'walk']);
  return T.map(t => t.map(v => (typeof v === 'number' ? r3(v) : v)));
})();
export { FLOOR_Y };
// every item that stands on a table stands wholly on it; no two faces facing up (the floor's tiles, the stage's floor, the
// pads, the tops of boxes and cylinders) overlap at heights closer than STEP
function standChecks(parts, objects, shapes, screens) {
  const items = [], supports = [];
  for (const s of shapes) {
    const [x, y, z] = s.p, [sx, sy, sz] = s.size, yaw = yawOf(s.q), m = s.motion, grow = m && m.kind === 'pulse' ? 1 + m.amount : 1, swing = m && m.kind === 'orbit' ? m.amount : 0;
    if (s.shape === 'cube') { items.push({ id: s.id, foot: y - sy / 2, poly: rect(x, z, sx * grow + 2 * swing, sz * grow + 2 * swing, yaw) }); supports.push({ id: s.id, top: y + sy / 2, kind: 'rect', x, z, w: sx, d: sz, yaw }); }
    else if (s.shape === 'cylinder') { items.push({ id: s.id, foot: y - sy / 2, poly: disc(x, z, sx / 2 * grow + swing) }); supports.push({ id: s.id, top: y + sy / 2, kind: 'disc', x, z, r: sx / 2 }); }
  }
  for (const o of objects) {
    const P = parts[Object.keys(parts).find(n => parts[n].file === o.file)];
    if (!P || !P.box) continue;
    const [[x0, y0, z0], [x1, , z1]] = P.box, yaw = yawOf(o.q), c = Math.cos(yaw), sn = Math.sin(yaw), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    items.push({ id: o.id, foot: o.p[1] + y0 * o.s, poly: rect(o.p[0] + (mx * c + mz * sn) * o.s, o.p[2] + (-mx * sn + mz * c) * o.s, (x1 - x0) * o.s, (z1 - z0) * o.s, yaw) });
  }
  for (const v of screens) {
    const pw = v.look === 'audio' ? 0.3 : v.w, ph = v.look === 'audio' ? 0.3 : v.w * 9 / 16;
    items.push({ id: v.id, foot: v.p[1] - ph / 2, poly: rect(v.p[0], v.p[2], pw, 0.01, yawOf(v.q)) });
  }
  const tops = [{ id: 'the stage\'s floor', y: 0, poly: rect(0, -18, 200, 200) },
    ...FLOOR.map(([x0, x1, z0, z1, c], i) => ({ id: `the hall's floor (${c} ${i})`, y: FLOOR_Y, poly: rect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z0 - z1) })),
    ...shapeTops(shapes)];
  return [...overhangs(items, supports), ...flatClashes(tops, STEP)];
}

// ------------------------------------------------------------------ paths and strokes --
// keys [t, dx, dy, dz, qx, qy, qz, qw] from where the item is placed
const key = (t, x, y, z, yaw) => [r3(t), r3(x), r3(y), r3(z), 0, r4(Math.sin((yaw || 0) / 2)), 0, r4(Math.cos((yaw || 0) / 2))];
// the robot's walk: round an oval 0.5 m across (out from the hall) and 1.2 m along it, 0.4 m/s, facing the way it goes,
// standing still for 1.5 s where it is placed (on the oval's side nearest the hall's middle, facing along the hall); its
// placed turn none, so its keys are in the scene's frame
function ovalPath(s) {
  const a = 0.25, b = 0.6, n = 32, v = 0.4, K = [key(0, 0, 0, 0, Math.PI), key(1.5, 0, 0, 0, Math.PI)];
  const pt = th => [s * (a - a * Math.cos(th)), -b * Math.sin(th)];   // (dx out from the middle, dz along the hall: -z)
  let t = 1.5, prev = pt(0);
  for (let i = 1; i <= n; i++) {
    const th = i / n * 2 * Math.PI, p = pt(th);
    t += Math.hypot(p[0] - prev[0], p[1] - prev[1]) / v;
    const yaw = Math.atan2(s * a * Math.sin(th), -b * Math.cos(th));   // (its front, +z, along the way it goes)
    K.push(i === n ? key(t, 0, 0, 0, Math.PI) : key(t, p[0], 0, p[1], yaw));
    prev = p;
  }
  return { k: K, play: 'loop', start: 'always', speed: 1 };
}
// the dancing robot's sway: 0.3 m along the hall and back, 4 s (Back and forth); in its placed frame (turned to the hall's
// middle, so its +x is along the hall, away from you)
function swayPath() { return { k: [key(0, 0, 0, 0), key(2, 0.3, 0, 0)], play: 'bounce', start: 'always', speed: 1 }; }
// a figure of eight, 0.5 m wide and 0.3 m high, upright along the hall, 4 s round
function eightPath() {
  const n = 40, K = [];
  for (let i = 0; i <= n; i++) { const th = i / n * 2 * Math.PI; K.push(key(i / n * 4, 0, 0.15 * Math.sin(2 * th), -0.25 * Math.sin(th))); }
  return { k: K, play: 'loop', start: 'always', speed: 1 };
}
// our own painting (in its own frame: x along its face, y up, z out of it), four strokes, one a brush: a ribbon spiral,
// a tube wave, a glow star, a spray cloud (about 400 points in all; the records' limit is 4,000 a scene)
function strokes() {
  const S = [], P = (x, y, z, f) => [r3(x), r3(y), r3(z), Math.round(f * 100) / 100];
  const rib = [];
  for (let i = 0; i <= 80; i++) { const t = i / 80, a = t * 4 * Math.PI, r = 0.08 + 0.18 * t; rib.push([...P(-0.25 + r * Math.cos(a), 0.05 + r * Math.sin(a), 0.02 * Math.sin(a * 2), 0.5 + 0.5 * Math.sin(t * Math.PI)), 0, 0, 1]); }
  S.push({ b: 'ribbon', c: '#ff8a3d', w: 0.05, k: rib });
  const tube = [];
  for (let i = 0; i <= 60; i++) { const t = i / 60; tube.push(P(-0.5 + t, -0.38 + 0.08 * Math.sin(t * 6 * Math.PI), 0.05, 0.8)); }
  S.push({ b: 'tube', c: '#46d9ff', w: 0.025, k: tube });
  const star = [];
  for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + i / 10 * 2 * Math.PI, r = i % 2 ? 0.08 : 0.2; star.push(P(0.28 + r * Math.cos(a), 0.2 + r * Math.sin(a), 0, 1)); }
  S.push({ b: 'glow', c: '#ffd34d', w: 0.02, k: star });
  const spray = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24; spray.push(P(0.15 + 0.3 * t, -0.12 + 0.05 * Math.sin(t * 5), 0, 0.7)); }
  S.push({ b: 'spray', c: '#c08cff', w: 0.08, k: spray, sd: 24117 });
  return S;
}
