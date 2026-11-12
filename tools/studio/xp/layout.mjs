// The Bliss XP room's layout.json: a walk through the video, designed so that it maps onto rooms from about 3 x 3 m to
// 5 x 5 m (in AR each headset's own walls, by the studio's wall behaviour) and stands round you in VR as placed (a room of
// 5 x 5 m: walls at +-2.5 m round the scene's origin, where you stand at first, -z ahead).
// - The front wall is the desktop: the taskbar's bar on the wall's middle (wall, 'direction'), and riding on it (the
//   behaviour 'item': they keep their offsets from it, so the desktop stays one piece in any room) its buttons, the
//   Start menu, the balloons by its clock, the wallpaper (AR), the boot and welcome screens, the titles, the icons and
//   the hourglass. The other walls hold clusters the same way: one anchor on the wall, its neighbours riding on it (the
//   left wall: Clippy's corner, the notes, Paint and the player; the right wall: the pages with the bin under them, the
//   door outside, the picture viewer; the back wall: Task Manager, the solitaire win, the way out, Remote Assistance and
//   the window trail with the error dialog). Anchors are placed along the ray that, in the smallest room (3 x 3 m), meets
//   their wall where they are meant to be, so in a bigger room the clusters spread with the walls and never pile up.
// - The grass, the glass CRT, the duck watching it, the flip phone and the clouds stand round the middle (inside the
//   smallest room); the giant cursor follows you at your right; the hill, the sky's clouds, the starfield and the wind are
//   VR only, the wallpaper AR only.
// - Trigger cubes make it a walk: most reach from inside the smallest room out past the walls of the biggest, so they are
//   walked into in any of them; the entry and the grass stand in the middle. Some are for everyone at the circle (all:
//   true), most for each person. What a cube starts is on something no cube hides there (checkLayout).
// makeLayout(parts, files) -> { layout, errors, partOf }: parts by name ({ file, tris, clips, box }), the scene's files.
const D0 = 2.5;   // (the walls of the room it is placed in, for VR)
const SMALL = 1.5;   // (the smallest room's walls, 3 x 3 m round its middle: where the clusters are designed)
const r4 = v => Math.round(v * 1e4) / 1e4 || 0, r3 = v => Math.round(v * 1e3) / 1e3 || 0;
const yawQ = a => [0, r4(Math.sin(a / 2)), 0, r4(Math.cos(a / 2))];
const turn = (a, [x, y, z]) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];   // (about the vertical, as yawQ)
const plus = (a, b) => a.map((v, i) => r3(v + b[i]));
// each wall: a point of it at `along` (world x on the front and back walls, world z on the sides), its normal into the
// room along the floor, and the turn that faces a thing's front (+z) out of it
const WALL = {
  front: { at: a => [a, -D0], n: [0, 1], yaw: 0 },
  back: { at: a => [a, D0], n: [0, -1], yaw: Math.PI },
  left: { at: a => [-D0, a], n: [1, 0], yaw: Math.PI / 2 },
  right: { at: a => [D0, a], n: [-1, 0], yaw: -Math.PI / 2 },
};
// the wall behaviour (v137): onto the wall in its placed direction, the nearest wall, or the wall nearest a person
const wall = (at, gap, o = {}) => Object.assign({ kind: 'wall', at }, at === 'person' ? { who: o.who || 'nearest', range: o.range || 3, speed: o.speed || 0.6 } : {}, gap !== undefined && gap !== 0.03 ? { gap } : {});
// riding on another item (the behaviour 'item'), quickly, so a cluster moves as one
const ride = target => ({ kind: 'item', target, speed: 3 });

export function makeLayout(parts, files) {
  const errors = [], have = new Set(files), partOf = {};
  for (const [n, p] of Object.entries(parts)) partOf[p.file] = n;
  const objects = [], sounds = [], cubes = [], groups = [], byId = {};
  const clipsOf = n => (parts[n] ? parts[n].clips.map(c => c.name) : []);
  // a part's box: its middle, how far its back is behind its middle (its front is +z), its half height
  const boxOf = (part, s) => {
    const b = parts[part] && parts[part].box;
    if (!b) { errors.push(`no box for ${part}`); return { c: [0, 0, 0], back: 0, hh: 0 }; }
    const c = [0, 1, 2].map(j => (b[0][j] + b[1][j]) / 2);
    return { c, back: s * (c[2] - b[0][2]), hh: s * (b[1][1] - b[0][1]) / 2 };
  };
  // an object: its part, where it stands, and what it does
  const obj = (id, name, part, pose, o = {}) => {
    const P = parts[part];
    if (!P) { errors.push(`${id}: no part ${part}`); return; }
    if (!have.has(P.file)) errors.push(`${id}: ${P.file} is not in the scene`);
    const clips = clipsOf(part), clip = o.clip !== undefined ? o.clip : clips[0] || '';
    if (clip && !clips.includes(clip)) errors.push(`${id}: ${part} has no clip ${clip} (${clips.join(', ') || 'none'})`);
    const r = { id, name, file: P.file, p: pose.p.map(r3), q: pose.q, s: o.s || 1, light: 'lit', clip, anim: o.anim || (clip ? 'loop' : 'off'), start: o.start || 'always' };
    if (o.behaviour) r.behaviour = o.behaviour;
    if (o.motion) r.motion = o.motion;
    if (o.shows) r.shows = o.shows;
    if (o.locked) r.locked = true;
    objects.push(r); byId[id] = { r, part, pose };
    return r;
  };
  // a thing against a wall: its middle `along` the wall, at height y (null: standing on the floor), its back `gap` off it
  const poseOn = (part, side, along, y, gap, s) => {
    const W = WALL[side], B = boxOf(part, s), d = gap + B.back, [wx, wz] = W.at(along);
    const M = [wx + W.n[0] * d, y === null ? B.hh : y, wz + W.n[1] * d], off = turn(W.yaw, B.c.map(v => v * s));
    return { p: M.map((v, j) => v - off[j]), q: yawQ(W.yaw), a: W.yaw };
  };
  // a cluster's anchor on a wall (wall, 'direction'): `along` is where it meets its wall in the smallest room; placed on
  // that ray in the room it is placed in, so in any room the ray from the walls' middle takes it to the same share of
  // its wall
  const anchor = (id, name, part, side, along, y, gap, o = {}) => {
    const s = o.s || 1, B = boxOf(part, s), at = along / SMALL * (D0 - gap - B.back);
    const r = obj(id, name, part, poseOn(part, side, at, y, gap, s), Object.assign({ behaviour: wall('direction', gap) }, o));
    if (r) byId[id].along = along, byId[id].at = at;
    return r;
  };
  // a neighbour riding on an anchor of the same wall: `along` in the smallest room, so its offset from the anchor is the
  // same in every room
  const rider = (id, name, part, target, along, y, gap, o = {}) => {
    const A = byId[target];
    if (!A || A.along === undefined) { errors.push(`${id}: no anchor ${target}`); return; }
    const side = Object.keys(WALL).find(k => WALL[k].yaw === A.pose.a);
    return obj(id, name, part, poseOn(part, side, A.at + along - A.along, y, gap, o.s || 1), Object.assign({ behaviour: ride(target) }, o));
  };
  // a thing riding on an anchor at an offset in the anchor's own frame (from where the anchor's placed origin is)
  const onAnchor = (id, name, part, target, off, o = {}) => {
    const A = byId[target];
    return obj(id, name, part, { p: plus(A.pose.p, turn(A.pose.a, off)), q: A.pose.q }, Object.assign({ behaviour: ride(target) }, o));
  };
  // a thing standing on the floor in the room, turned by a
  const floor = (x, z, a) => ({ p: [x, 0, z], q: yawQ(a) });
  const facing = (x, z, tx = 0, tz = 0) => Math.atan2(tx - x, tz - z);   // (the yaw that turns its front, +z, towards (tx, tz))
  // an object's middle in the scene's frame (its pose turned about the vertical)
  const yawOf = q => 2 * Math.atan2(q[1], q[3]);
  const mid = id => { const X = byId[id], s = X.r.s, B = boxOf(X.part, s); return plus(X.r.p, turn(yawOf(X.r.q), B.c.map(v => v * s))); };
  // a sound: an emitter at its object (on), so it comes from there; `at`: on an object that is always shown, but placed at
  // the middle of another (one a cube shows as it starts the sound: following that one, the sound would start faded out
  // with it, its level being its own fade times its object's)
  const snd = (id, name, file, on, o = {}) => {
    const t = objects.find(x => x.id === on);
    if (!t) { errors.push(`${id}: no object ${on} to follow`); return; }
    if (!have.has(file)) errors.push(`${id}: ${file} is not in the scene`);
    const q = t.q, a = yawOf(q), off = o.at ? turn(-a, mid(o.at).map((v, j) => v - t.p[j])).map(r3) : o.o || [0, 0, 0];
    const r = { id, name, file, p: plus(t.p, turn(a, off)), vol: o.vol || 1, r: o.r || 2, loop: !!o.loop, start: o.start || 'always', on };
    if (off.some(v => v)) r.o = off;
    if (o.shows) r.shows = o.shows;
    sounds.push(r);
  };
  // a trigger cube from its corners along the floor (x0..x1, z0..z1), floor to 2.2 m
  const cube = (id, name, [x0, x1, z0, z1], o) => {
    const r = Object.assign({ id, name, p: [r3((x0 + x1) / 2), 1.1, r3((z0 + z1) / 2)], yaw: 0, size: [r3(x1 - x0), 2.2, r3(z1 - z0)], mode: o.mode || 'while', show: o.show || [], hide: o.hide || [] }, o.plays ? { plays: o.plays } : {}, o.all ? { all: true } : {});
    cubes.push(r);
  };

  // ---- the front wall: the desktop, riding on the taskbar's bar
  const TB = 0.85;   // (the taskbar a little smaller than made, so it fits a 3 m wall)
  anchor('tbbar1', 'Taskbar', 'taskbar-bar', 'front', 0, 0.3, 0.02, { s: TB });
  rider('tbstrt', 'Start button', 'taskbar-start', 'tbbar1', -1.08, 0.3, 0.04, { s: TB });
  rider('tbquik', 'Quick launch', 'taskbar-quick', 'tbbar1', -0.75, 0.3, 0.04, { s: TB });
  rider('tbtask', 'Task buttons', 'taskbar-tasks', 'tbbar1', 0.1, 0.3, 0.04, { s: TB });
  rider('tbtray', 'Tray and clock', 'taskbar-tray', 'tbbar1', 1.03, 0.3, 0.04, { s: TB });
  rider('stmenu', 'Start menu', 'start-menu', 'tbbar1', -1.04, 0.81, 0.26);   // (in front of the icons, as the menu covers them)
  rider('blcurs', 'Balloon: Cursor is now connected', 'balloon-cursor', 'tbbar1', 0.97, 0.63, 0.06, { anim: 'once', start: 'shown' });
  rider('blgras', 'Balloon: Found New Hardware', 'balloon-grass', 'tbbar1', 1.06, 0.95, 0.06, { anim: 'once', start: 'shown' });
  rider('wallpa', 'Wallpaper (AR)', 'wallpaper', 'tbbar1', 0, 1.35, 0.01, { shows: 'ar' });
  rider('bootsc', 'Boot screen', 'boot', 'tbbar1', 0, 1.42, 0.06);
  rider('welcom', 'Welcome screen', 'welcome', 'tbbar1', 0, 1.42, 0.06, { s: 0.9 });
  rider('twelco', 'Title: welcome back.', 'title-welcome', 'tbbar1', -0.3, 1.67, 0.16);
  rider('tbliss', 'Title: bliss', 'title-bliss', 'tbbar1', 0, 2.12, 0.05);
  rider('icmyco', 'My Computer', 'icon-computer', 'tbbar1', -1.12, 2.08, 0.02);
  rider('icmydo', 'My Documents', 'icon-documents', 'tbbar1', -1.12, 1.72, 0.02);
  rider('icinte', 'Internet', 'icon-internet', 'tbbar1', -1.12, 1.36, 0.02);
  rider('icmedi', 'Media Player', 'icon-media', 'tbbar1', -1.12, 1.0, 0.02);
  rider('hourgl', 'Hourglass', 'hourglass', 'tbbar1', 1.05, 2.0, 0.3, { motion: { kind: 'spin', speed: 6, amount: 0, axis: 'y', start: 'always' } });

  // ---- the left wall: Clippy's corner, the notes, Paint and the player
  anchor('clloun', "Clippy's lounge", 'clippy-lounge', 'left', -0.8, null, 0.04);
  onAnchor('clippy', 'Clippy', 'clippy', 'clloun', [0, 0.1, -0.02], { clip: 'Chill' });
  onAnchor('clbal1', 'Clippy: trying to go outside?', 'clippy-balloon-outside', 'clloun', [0.2, 0.76, 0.02], { anim: 'once', start: 'shown' });
  onAnchor('clbal2', 'Clippy: trying to be happy?', 'clippy-balloon-happy', 'clloun', [-0.3, 1.12, 0.06], { anim: 'once', start: 'shown' });
  rider('chatdk', 'Chat: Duck - Conversation', 'chat-duck', 'clloun', -0.8, 1.98, 0.06, { anim: 'off' });
  anchor('notepd', 'diary.txt - Notepad', 'notepad-diary', 'left', 0.02, 1.72, 0.05);
  rider('keybrd', 'On-Screen Keyboard', 'keyboard', 'notepd', 0.02, 1.05, 0.05);
  rider('replce', 'Confirm File Replace', 'confirm-replace', 'notepd', -0.34, 1.32, 0.13);
  anchor('paintw', 'hill.bmp - Paint', 'paint-hill', 'left', 0.92, 1.72, 0.05, { s: 0.9 });
  rider('mediap', 'Media Player', 'media-player', 'paintw', 0.92, 0.9, 0.05, { s: 0.9 });
  // (Clippy's chat window slides along the walls to the person nearest it, low and a little smaller, so it passes under
  // the windows it meets and never covers the welcome screen; at home by the notes)
  obj('chatcl', 'Chat: Clippy - Conversation', 'chat-clippy', poseOn('chat-clippy', 'left', -0.45 / SMALL * D0, 0.72, 0.12, 0.8), { s: 0.8, anim: 'off', behaviour: wall('person', 0.12) });

  // ---- the right wall: the pages and the bin, the door outside, the picture viewer
  const PG = 0.8;   // (the pages a little smaller than made, so they fit beside the door on a 3 m wall)
  anchor('browsr', 'the bliss network - Internet', 'browser-bliss', 'right', -0.96, 1.0, 0.03, { s: PG });
  rider('searcw', 'how to go outside - Search', 'search-outside', 'browsr', -0.96, 1.76, 0.18, { s: PG });   // (over the door's frame)
  rider('recycl', 'Recycle Bin', 'recycle-bin', 'browsr', -1.08, null, 0.05);
  anchor('door01', 'Door outside', 'door', 'right', 0, null, 0.01, { clip: 'Open', anim: 'off' });
  rider('hand01', 'Hand cursor', 'cursor-hand', 'door01', 0.36, 1.02, 0.28, { motion: { kind: 'bob', speed: 40, amount: 0.04, axis: 'x', start: 'always' } });
  rider('blgo01', 'Balloon: Go. Click the door', 'balloon-go', 'door01', -0.86, 1.62, 0.26, { anim: 'once', start: 'shown' });
  rider('blhill', 'Balloon: Bliss, a painted hill', 'balloon-hill', 'door01', 0.86, 1.6, 0.26, { anim: 'once', start: 'shown' });
  rider('wreal1', 'Window: Bliss is a real place', 'win-real-place', 'door01', 0, 2.31, 0.08);
  anchor('viewbl', 'Bliss.jpg - Picture and Fax Viewer', 'viewer-bliss', 'right', 0.95, 1.76, 0.18, { s: PG });

  // ---- the back wall: Task Manager, the solitaire win, the way out, Remote Assistance and the error corner
  anchor('taskmg', 'Task Manager', 'task-manager', 'back', -1.0, 1.5, 0.05);
  const SOL = 0.8, solB = boxOf('solitaire', SOL);
  anchor('solita', 'Solitaire win', 'solitaire', 'back', -0.55, 0.03 + solB.hh, 0.02, { s: SOL, start: 'shown' });   // (its cards bounce down to the floor)
  anchor('turnof', 'Turn off computer', 'turn-off', 'back', 0, 1.55, 0.06);
  rider('safeof', 'You can switch off now.', 'safe-off', 'turnof', 0, 0.95, 0.06);
  rider('wingrs', 'Window: Go touch the grass', 'win-grass', 'turnof', 0, 2.08, 0.04);
  // (the error corner one cluster on Remote Assistance, which is always shown: its ding can come from there)
  anchor('remote', 'Remote Assistance', 'remote-assistance', 'back', 0.95, 1.78, 0.05);
  rider('wclose', 'Window: Close all your windows', 'win-close-all', 'remote', 0.95, 2.2, 0.05);
  rider('trail1', 'Window trail', 'trail', 'remote', 0.8, 1.0, 0.02);
  rider('errorc', 'Error: Cursor stumbled', 'error-cursor', 'remote', 0.8, 1.0, 0.56);   // (where the trail comes out of the wall)

  // ---- in the middle: the grass, the glass CRT and the duck watching it, the flip phone; the giant cursor
  obj('grass1', 'Grass', 'grass-patch', floor(0.2, 0.7, 0.3));
  obj('grass2', 'Grass 2', 'grass-patch', floor(-0.75, 0.3, 2.1));
  obj('grass3', 'Grass strip', 'grass-strip', floor(0.65, 0.05, 1.25));
  obj('glcrt1', 'Glass CRT', 'glass-crt', floor(0.3, 0.85, facing(0.3, 0.85, -0.1, 0.3)));
  obj('duck01', 'Rubber duck (You)', 'duck', floor(-0.1, 0.3, facing(-0.1, 0.3, 0.3, 0.85)));
  obj('phone1', 'Flip phone', 'flip-phone', floor(-0.7, 0.55, facing(-0.7, 0.55)));
  // (the giant cursor rolled 80 degrees about its front, so at your right its face looks back at you)
  obj('cursor', 'Giant cursor', 'cursor-arrow', { p: [0.9, 1.3, -0.6], q: [0, 0, -0.6428, 0.766] },
    { behaviour: { kind: 'follow', who: 'nearest', range: 3, dist: 0.9, speed: 0.6, side: 'right', face: 'along' } });

  // ---- clouds over the middle, under the ceiling (both), big ones far in the sky (VR)
  const orbit = (amount, speed) => ({ kind: 'orbit', speed, amount, axis: 'y', start: 'always' });
  obj('cloud1', 'Cloud', 'cloud-a', { p: [-0.7, 2.0, -0.6], q: [0, 0, 0, 1] }, { s: 0.5, motion: orbit(0.25, 1.2) });
  obj('cloud2', 'Cloud 2', 'cloud-b', { p: [0.75, 2.05, -0.3], q: yawQ(0.8) }, { s: 0.55, motion: orbit(0.2, -1.5) });
  obj('cloud3', 'Cloud 3', 'cloud-c', { p: [0.2, 2.0, 0.9], q: yawQ(2) }, { s: 0.45, motion: orbit(0.25, 0.8) });
  obj('cloud4', 'Cloud 4', 'cloud-b', { p: [-0.8, 2.05, 0.8], q: yawQ(-1) }, { s: 0.5, motion: orbit(0.2, 1.8) });
  obj('cloud5', 'Cloud 5', 'cloud-a', { p: [0.9, 2.0, 0.95], q: yawQ(2.6) }, { s: 0.45, motion: orbit(0.2, -1) });
  obj('vcld01', 'Sky cloud (VR)', 'cloud-c', { p: [-14, 13, -28], q: yawQ(0.4) }, { s: 7, shows: 'vr', motion: orbit(3, 0.4) });
  obj('vcld02', 'Sky cloud 2 (VR)', 'cloud-a', { p: [22, 16, -18], q: yawQ(-1) }, { s: 8, shows: 'vr', motion: orbit(4, -0.3) });
  obj('vcld03', 'Sky cloud 3 (VR)', 'cloud-b', { p: [6, 12, 30], q: yawQ(2.4) }, { s: 7, shows: 'vr', motion: orbit(3, 0.35) });
  obj('vcld04', 'Sky cloud 4 (VR)', 'cloud-c', { p: [-26, 15, 12], q: yawQ(1.4) }, { s: 9, shows: 'vr', motion: orbit(4, -0.25) });
  obj('landsc', 'Bliss landscape (VR)', 'landscape', { p: [0, 0, 0], q: [0, 0, 0, 1] }, { shows: 'vr', locked: true });
  obj('stars1', 'Starfield (VR)', 'starfield', { p: [0, 0, 0], q: yawQ(Math.PI) }, { shows: 'vr', locked: true });   // (towards the way out: you fly into it)

  // ---- sounds, each an emitter at its object
  // (the startup swell is shown by the entry cube, as the welcome screen, so it plays once as it is first shown and never
  // again while the cube stays, though the cube is walked through again on the way to the desktop)
  snd('sstart', 'Startup swell', 'sounds/startup.wav', 'tbbar1', { r: 3, at: 'welcom', start: 'shown' });
  snd('sshutd', 'Shutdown', 'sounds/shutdown.wav', 'wingrs', { r: 3, at: 'turnof' });
  snd('sding1', 'Ding', 'sounds/ding.wav', 'remote', { r: 2.5, at: 'errorc' });
  snd('scrit1', 'Critical stop', 'sounds/critical-stop.wav', 'taskmg', { r: 2 });
  snd('spop01', 'Balloon pop', 'sounds/balloon-pop.wav', 'clippy', { r: 1.5, at: 'clbal1' });
  snd('spop02', 'Balloon pop 2', 'sounds/balloon-pop.wav', 'clippy', { r: 1.5, at: 'clbal2' });
  snd('schime', 'New message', 'sounds/new-message.wav', 'chatcl', { r: 2 });
  snd('snudge', 'Nudge', 'sounds/nudge.wav', 'chatcl', { r: 2 });
  snd('stypin', 'Typing', 'sounds/typing.wav', 'keybrd', { r: 1.5, vol: 0.7, loop: true });
  snd('shwin1', 'Hardware in', 'sounds/hardware-in.wav', 'tbtray', { r: 2.5 });
  snd('shwout', 'Hardware out', 'sounds/hardware-out.wav', 'tbtray', { r: 2.5 });
  snd('sclick', 'Click (door)', 'sounds/click.wav', 'door01', { r: 1.5, o: [0.35, -0.05, 0.1] });
  snd('sclik2', 'Click (start)', 'sounds/click.wav', 'tbstrt', { r: 1.5 });
  snd('sout01', 'Outdoors through the door', 'sounds/outdoors.wav', 'door01', { r: 1.5, vol: 0.9, loop: true, o: [0, 0, -0.4] });
  snd('scrump', 'Recycle crumple', 'sounds/recycle.wav', 'recycl', { r: 1.5 });
  snd('sflips', 'Solitaire flips', 'sounds/solitaire-flips.wav', 'solita', { r: 2, vol: 0.8, loop: true });
  snd('sambie', 'Wind and birds (VR)', 'sounds/outdoors.wav', 'landsc', { r: 8, vol: 0.5, loop: true, o: [0, 2.5, 0], shows: 'vr' });

  // ---- the walk: trigger cubes, most reaching from inside the smallest room (3 x 3 m) out past the walls of the biggest
  const once = (on, what, o = {}) => Object.assign({ on, what }, o.clip ? { clip: o.clip } : {}, { how: o.how || 'once' }, o.when ? { when: o.when } : {});
  cube('cuentr', 'Entry (everyone, once)', [-0.8, 0.8, -1.25, -0.6], { mode: 'stay', all: true, show: ['welcom', 'twelco', 'cursor', 'blcurs', 'sstart'], hide: ['bootsc'] });
  cube('custrt', 'Start menu', [-1.6, -0.4, -2.7, -1.0], { show: ['stmenu'], plays: [once('sclik2', 'sound')] });
  cube('cuclip', 'Clippy', [-2.7, -0.75, -2.2, -0.5], { show: ['clbal1'], plays: [once('clippy', 'clip', { clip: 'Wave' }), once('spop01', 'sound')] });
  cube('curecy', 'Recycle Bin', [0.75, 2.7, -2.7, -1.05], { plays: [once('scrump', 'sound')] });
  cube('cuchat', 'Chat', [-2.7, -0.75, -0.45, 0.55], { plays: [once('schime', 'sound'), once('snudge', 'sound'), once('chatcl', 'clip', { clip: 'Nudge' }), once('stypin', 'sound', { how: 'loop' })] });
  cube('cudoor', 'Door', [0.8, 2.7, -0.65, 0.65], { show: ['blgo01', 'blhill'], hide: ['hand01', 'sambie'], plays: [once('door01', 'clip', { clip: 'Open', how: 'hold' }), once('sclick', 'sound'), once('sout01', 'sound', { how: 'loop' })] });
  cube('cugras', 'Grass (everyone)', [-0.5, 0.9, 0.25, 1.15], { all: true, show: ['blgras', 'clbal2'], plays: [once('shwin1', 'sound'), once('shwout', 'sound', { when: 'leave' }), once('clippy', 'clip', { clip: 'Dance', how: 'loop' }), once('spop02', 'sound')] });
  // (Task Manager's critical stop as you come towards the back left, then nearer the wall the solitaire win under it: two
  // bands, side by side and never one inside the other, Task Manager shown in both)
  cube('cutask', 'Task Manager', [-2.7, -0.55, 0.55, 0.9], { plays: [once('scrit1', 'sound')] });
  cube('cusoli', 'Solitaire', [-2.7, -0.55, 0.9, 2.7], { show: ['solita'], plays: [once('sflips', 'sound', { how: 'loop' })] });
  cube('cuexit', 'Way out', [-0.45, 0.45, 1.0, 2.7], { show: ['turnof', 'safeof', 'stars1'], hide: ['landsc'], plays: [once('sshutd', 'sound')] });
  cube('cuerro', 'Error corner (everyone)', [0.55, 2.7, 0.9, 2.7], { all: true, show: ['errorc', 'trail1', 'wclose'], hide: ['cursor'], plays: [once('sding1', 'sound')] });

  // ---- groups: things that move together in the studio
  groups.push({ id: 'gtaskb', name: 'Desktop', items: ['tbbar1', 'tbstrt', 'tbquik', 'tbtask', 'tbtray', 'stmenu', 'blcurs', 'blgras', 'wallpa', 'bootsc', 'welcom', 'twelco', 'tbliss', 'icmyco', 'icmydo', 'icinte', 'icmedi', 'hourgl'] });
  groups.push({ id: 'gclipy', name: "Clippy's corner", items: ['clloun', 'clippy', 'clbal1', 'clbal2', 'chatdk'] });
  groups.push({ id: 'gnotes', name: 'Notes', items: ['notepd', 'keybrd', 'replce'] });
  groups.push({ id: 'gpaint', name: 'Paint and the player', items: ['paintw', 'mediap'] });
  groups.push({ id: 'gpages', name: 'The pages', items: ['browsr', 'searcw', 'recycl'] });
  groups.push({ id: 'gdoor1', name: 'The door', items: ['door01', 'hand01', 'blgo01', 'blhill', 'wreal1', 'viewbl'] });
  groups.push({ id: 'gerror', name: 'The error corner', items: ['remote', 'wclose', 'trail1', 'errorc'] });
  groups.push({ id: 'gwayot', name: 'The way out', items: ['turnof', 'safeof', 'wingrs'] });

  // ---- checks: the clips the cubes start are there; then the rules every layout of the room keeps (checkLayout)
  for (const c of cubes) for (const e of c.plays || []) if (e.what === 'clip') { const t = objects.find(o => o.id === e.on); if (t && !clipsOf(partOf[t.file]).includes(e.clip)) errors.push(`${c.id}: ${e.on} has no clip ${e.clip}`); }
  const layout = { studio: 1, scene: 'bliss-xp', saved: '2026-11-11T12:00:00.000Z', objects, cubes, sounds, groups };
  errors.push(...checkLayout(layout));
  return { layout, errors, partOf };
}

// checkLayout(layout) -> a list of what is wrong (also the smoke test's, on the layout as served): ids of six letters and
// digits, each once; every id a cube, a sound, a group or a behaviour names is in the room; and the walk works: what a
// cube starts is seen and heard only while the object it is on is shown (an emitter's level is its own fade times its
// object's, e6_items.js), so no cube that overlaps the cube (itself included) hides that object or the sound, and a
// sound a cube starts once is never on an object a cube shows (it would start as that object fades in, its attack lost)
export function checkLayout(L) {
  const out = [], ids = new Set(), all = [...(L.objects || []), ...(L.sounds || []), ...(L.cubes || []), ...(L.groups || [])];
  for (const x of all) { if (!/^[a-z0-9]{6}$/.test(x.id)) out.push(`${x.id}: not six letters and digits`); if (ids.has(x.id)) out.push(`${x.id}: used twice`); ids.add(x.id); }
  const items = new Set([...(L.objects || []), ...(L.sounds || []), ...(L.cubes || [])].map(x => x.id)), objs = new Set((L.objects || []).map(o => o.id));
  for (const c of L.cubes || []) for (const k of [...(c.show || []), ...(c.hide || []), ...(c.plays || []).map(e => e.on)]) if (!items.has(k)) out.push(`${c.id}: names ${k}, which is not in the room`);
  for (const g of L.groups || []) for (const k of g.items || []) if (!items.has(k)) out.push(`${g.id}: names ${k}, which is not in the room`);
  for (const x of L.sounds || []) if (x.on && !objs.has(x.on)) out.push(`${x.id}: follows ${x.on}, which is not in the room`);
  for (const o of L.objects || []) if (o.behaviour && o.behaviour.kind === 'item' && !objs.has(o.behaviour.target)) out.push(`${o.id}: rides on ${o.behaviour.target}, which is not in the room`);
  // (two cubes overlap when their boxes share some floor: they stand floor to ceiling, level)
  const over = (a, b) => [0, 2].every(j => Math.abs(a.p[j] - b.p[j]) < (a.size[j] + b.size[j]) / 2 - 1e-6);
  const soundOf = id => (L.sounds || []).find(x => x.id === id);
  for (const c of L.cubes || []) for (const e of c.plays || []) {
    const S = e.what === 'sound' ? soundOf(e.on) : null, on = S ? S.on : null;
    for (const d of L.cubes || []) if (over(c, d)) for (const k of [e.on, on].filter(Boolean)) if ((d.hide || []).includes(k)) out.push(`${c.id} starts ${e.on}, but ${d === c ? 'it' : d.id}${d === c ? '' : ', which overlaps it,'} hides ${k}: where both are active it is not ${S ? 'heard' : 'seen'}`);
    if (S) for (const d of L.cubes || []) if ((d.show || []).includes(e.on)) out.push(`${c.id} starts ${e.on}, which ${d.id} shows: it waits hidden until then`);
    if (S && on && e.how === 'once') for (const d of L.cubes || []) if ((d.show || []).includes(on)) out.push(`${c.id} starts ${e.on} once on ${on}, which ${d.id} shows: it would start as ${on} fades in`);
  }
  return out;
}
