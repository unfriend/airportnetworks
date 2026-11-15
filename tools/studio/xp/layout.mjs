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
// - Things to press (v146): the start button and the menu, the four desktop icons and the red close buttons of the windows
//   they open, Clippy, the balloons, Media Player's play and stop, the welcome screen. A press is a record on the object
//   (`press`: what it starts, a sequence or a clip, a show or a hide) and a sequence is a record of its own (`sequences`:
//   events on a timeline); both are shared on the room's clock, for everyone at the circle. Pointing at a button or at Clippy
//   is each person's own (`press.hover`). Cards and old pages lie on the floor for anyone to pick up (`grab`); dropped in the
//   Recycle Bin (a low cube round where the bin stands in any room from 3 x 3 m to 5 x 5 m, with the thing as its key) they
//   crumple.
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
  const objects = [], sounds = [], cubes = [], groups = [], sequences = [], byId = {};
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
    if (o.grab) r.grab = true;
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
    const h = o.h || 2.2, r = Object.assign({ id, name, p: [r3((x0 + x1) / 2), r3(h / 2), r3((z0 + z1) / 2)], yaw: 0, size: [r3(x1 - x0), h, r3(z1 - z0)], mode: o.mode || 'while', show: o.show || [], hide: o.hide || [] }, o.plays ? { plays: o.plays } : {}, o.all ? { all: true } : {}, o.key ? { key: o.key } : {});
    cubes.push(r);
  };

  // ---- the front wall: the desktop, riding on the taskbar's bar
  const TB = 0.85;   // (the taskbar a little smaller than made, so it fits a 3 m wall)
  anchor('tbbar1', 'Taskbar', 'taskbar-bar', 'front', 0, 0.3, 0.02, { s: TB });
  rider('tbstrt', 'Start button', 'taskbar-start', 'tbbar1', -1.08, 0.3, 0.04, { s: TB, anim: 'off' });
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
  rider('icmyco', 'My Computer', 'icon-computer', 'tbbar1', -1.12, 2.08, 0.02, { anim: 'off' });
  rider('icmydo', 'My Documents', 'icon-documents', 'tbbar1', -1.12, 1.72, 0.02, { anim: 'off' });
  rider('icinte', 'Internet', 'icon-internet', 'tbbar1', -1.12, 1.36, 0.02, { anim: 'off' });
  rider('icmedi', 'Media Player', 'icon-media', 'tbbar1', -1.12, 1.0, 0.02, { anim: 'off' });
  rider('hourgl', 'Hourglass', 'hourglass', 'tbbar1', 1.05, 2.0, 0.3, { anim: 'off', motion: { kind: 'spin', speed: 6, amount: 0, axis: 'y', start: 'always' } });

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
  rider('mediap', 'Media Player', 'media-player', 'paintw', 0.92, 0.9, 0.05, { s: 0.9, anim: 'off' });
  // (Clippy's chat window slides along the walls to the person nearest it, low and a little smaller, so it passes under
  // the windows it meets and never covers the welcome screen; at home by the notes)
  obj('chatcl', 'Chat: Clippy - Conversation', 'chat-clippy', poseOn('chat-clippy', 'left', -0.45 / SMALL * D0, 0.72, 0.12, 0.8), { s: 0.8, anim: 'off', behaviour: wall('person', 0.12) });

  // ---- the right wall: the pages and the bin, the door outside, the picture viewer
  const PG = 0.8;   // (the pages a little smaller than made, so they fit beside the door on a 3 m wall)
  anchor('browsr', 'the bliss network - Internet', 'browser-bliss', 'right', -0.96, 1.0, 0.03, { s: PG });
  rider('searcw', 'how to go outside - Search', 'search-outside', 'browsr', -0.96, 1.76, 0.18, { s: PG });   // (over the door's frame)
  rider('recycl', 'Recycle Bin', 'recycle-bin', 'browsr', -1.08, null, 0.05, { anim: 'off' });
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

  // ---- on the windows that open (v146): each one's red close button, standing over the drawn one, its loading hourglass in
  // front of its face, and the Media Player's play and stop buttons; all riding on their window (so in any room they stay on
  // its title bar or face), placed from where the window parts say their buttons are (`info.marks`), never typed
  const marks = n => (parts[n] && parts[n].marks) || {};
  const onWindow = (id, name, part, win, off, s, o = {}) => {
    const W = byId[win];
    if (!W || W.pose.a === undefined) { errors.push(`${id}: no window ${win}`); return; }
    const sw = W.r.s, a = W.pose.a;
    return obj(id, name, part, { p: plus(W.r.p, turn(a, off.map(v => v * sw))), q: W.pose.q }, Object.assign({ s: +s.toPrecision(4), behaviour: ride(win), anim: 'off' }, o));
  };
  const closeOf = (id, name, win) => {
    const m = marks(byId[win].part).close;
    if (!m) { errors.push(`${id}: ${byId[win].part} reports no close button`); return; }
    return onWindow(id, name, 'close-button', win, [m[0], m[1], m[3]], r4(m[2] * byId[win].r.s / 0.03));
  };
  const loaderOf = (id, name, win) => onWindow(id, name, 'hourglass', win, [0, 0, 0.028 + 0.12 / byId[win].r.s], 0.6);
  for (const [w, c, h, label] of [['viewbl', 'clsco1', 'hgldco', 'the picture viewer'], ['notepd', 'clsdo1', 'hglddo', 'the notes'], ['searcw', 'clsin1', 'hgldin', 'the search'], ['mediap', 'clsmp1', 'hgldmp', 'the player']]) {
    closeOf(c, `Close button: ${label}`, w);
    loaderOf(h, `Loading hourglass: ${label}`, w);
  }
  for (const [id, name, part, k] of [['mdplay', 'Media Player: play', 'media-play', 'play'], ['mdstop', 'Media Player: stop', 'media-stop', 'stop']]) {
    const m = marks('media-player')[k];
    if (!m) { errors.push(`${id}: media-player reports no ${k} button`); continue; }
    onWindow(id, name, part, 'mediap', [m[0], m[1], m[3]], r4(m[2] * byId.mediap.r.s / 0.04));
  }

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

  // ---- on the floor for anyone to pick up (v146; `grab`): four playing cards in front of the solitaire (inside the smallest room)
  // and two old printed pages by the right wall; no behaviour (floor things in the middle stay where they are, as the grass)
  [['cardh1', 'Playing card: ace of hearts', 'card-hearts', -0.9, 1.1, 0.35], ['cards1', 'Playing card: seven of spades', 'card-spades', -0.78, 1.19, -0.2],
    ['cardd1', 'Playing card: three of diamonds', 'card-diamonds', -0.66, 1.1, 0.1], ['cardc1', 'Playing card: ten of clubs', 'card-clubs', -0.56, 1.17, -0.45]]
    .forEach(([id, name, part, x, z, a]) => obj(id, name, part, { p: [x, 0.01, z], q: yawQ(a) }, { anim: 'off', grab: true }));
  obj('paper1', 'Old page: plans for today', 'paper-draft', { p: [0.9, 0.003, -0.45], q: yawQ(0.5) }, { anim: 'off', grab: true });
  obj('paper2', 'Old page: plans for today 2', 'paper-draft', { p: [1.05, 0.003, -0.2], q: yawQ(-0.7) }, { anim: 'off', grab: true });

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
  // (v146: what a press starts, each on its object; the bursts on their balloons, which are shown when they can be pressed, the
  // closing clicks on their close buttons, which are shown while they can be pressed, the music on the open player)
  [['sbur01', 'blcurs'], ['sbur02', 'blgras'], ['sbur03', 'clbal1'], ['sbur04', 'clbal2'], ['sbur05', 'blgo01'], ['sbur06', 'blhill']].forEach(([id, on], i) => snd(id, `Balloon burst ${i + 1}`, 'sounds/balloon-burst.wav', on, { r: 1.5 }));
  snd('sgiggl', 'Clippy giggles', 'sounds/clippy-giggle.wav', 'clippy', { r: 1.5 });
  snd('smusic', 'Media Player music', 'sounds/media-music.wav', 'mediap', { r: 2.5, vol: 0.9, loop: true });
  snd('sclkmp', 'Click (player)', 'sounds/click.wav', 'mediap', { r: 1.5 });
  [['sclkco', 'icmyco'], ['sclkdo', 'icmydo'], ['sclkin', 'icinte'], ['sclkme', 'icmedi']].forEach(([id, on]) => snd(id, `Click (${byId[on].r.name})`, 'sounds/click.wav', on, { r: 1.5 }));
  [['sclcco', 'clsco1'], ['sclcdo', 'clsdo1'], ['sclcin', 'clsin1'], ['sclcmp', 'clsmp1']].forEach(([id, on]) => snd(id, `Click (close, ${byId[on].r.name.replace('Close button: ', '')})`, 'sounds/click.wav', on, { r: 1.5 }));
  snd('sclkwl', 'Click (welcome)', 'sounds/click.wav', 'tbbar1', { r: 3, at: 'welcom' });
  snd('sambie', 'Wind and birds (VR)', 'sounds/outdoors.wav', 'landsc', { r: 8, vol: 0.5, loop: true, o: [0, 2.5, 0], shows: 'vr' });

  // ---- the walk: trigger cubes, most reaching from inside the smallest room (3 x 3 m) out past the walls of the biggest
  const once = (on, what, o = {}) => Object.assign({ on, what }, o.clip ? { clip: o.clip } : {}, { how: o.how || 'once' }, o.when ? { when: o.when } : {});
  cube('cuentr', 'Entry (everyone, once)', [-0.8, 0.8, -1.25, -0.6], { mode: 'stay', all: true, show: ['cursor', 'blcurs', 'sstart'], hide: ['bootsc'] });
  // (the welcome screen and its text have no cube source: they are shown by default and only Log in hides them, so every device agrees whoever walks in or reloads later)
  // (no Start cube since v146: the start button and the menu are pressed, so a cube showing the menu as you stood there would fight them)
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

  // ---- the Recycle Bin takes what is dropped in (v146): a low cube round where the bin stands, one per thing anyone may pick up,
  // reacting to that thing (its key), not to people: the thing crumples and is held crumpled while it is in the bin, the bin
  // gulps, the crumple sounds; carried out, it smooths. The bin rides on the browser on the right wall, so its place depends on
  // the room: worked out here for the smallest room (walls 1.5 m from the middle) and the biggest (2.5 m) the way the wall
  // behaviour places the browser (a ray from the middle along where it is placed meets the wall; its back a gap off it), the
  // bin riding at its fixed offset from it; the cubes cover the line between the two places and 0.18 m round it, from the floor to
  // 0.5 m, so a card carried at hand height over the corner does nothing and one lowered into the bin does
  const binAt = Rw => {
    const A = byId.browsr, mA = mid('browsr'), mB = mid('recycl'), g = A.r.behaviour.gap !== undefined ? A.r.behaviour.gap : 0.03, bk = boxOf(A.part, A.r.s).back;
    const nx = Rw - g - bk, nz = mA[2] * Rw / mA[0];
    return [mB[0] + (nx - mA[0]), mB[2] + (nz - mA[2])];
  };
  const bins = [binAt(1.5), binAt(2.5)], BM = 0.18;
  // (one set of tight cubes per room size, round that room's place of the bin: the cube holds the bin and BM round it, no wider)
  const KEYS = [['h1', 'Bin: ace of hearts', 'cardh1'], ['s1', 'Bin: seven of spades', 'cards1'], ['d1', 'Bin: three of diamonds', 'cardd1'], ['c1', 'Bin: ten of clubs', 'cardc1'],
    ['p1', 'Bin: old page', 'paper1'], ['p2', 'Bin: old page 2', 'paper2']];
  const binBoxes = bins.map(b => [b[0] - BM, b[0] + BM, b[1] - BM, b[1] + BM].map(r3));
  binBoxes.forEach((bx, i) => KEYS.forEach(([sfx, name, key]) => cube(`cuk${'ab'[i]}${sfx}`, `${name} (${i ? 5 : 3} x ${i ? 5 : 3} m room)`, bx, { h: 0.5, key, plays: [once(key, 'clip', { clip: 'Crumple', how: 'hold' }), once('scrump', 'sound'), once('recycl', 'clip', { clip: 'Gulp' })] })));
  for (const [i, b] of bins.entries()) { const bx = binBoxes[i]; if (!(b[0] > bx[0] && b[0] < bx[1] && b[1] > bx[2] && b[1] < bx[3])) errors.push(`the bin's middle in the ${i ? 5 : 3} x ${i ? 5 : 3} m room (${b.map(r3)}) is outside the key cubes`); }

  // ---- sequences: timelines of what a press starts (record kind q: events at a time, on an item), on the room's clock for
  // everyone at the circle; a show or a hide is one more source of the cubes' "started last decides"; `cut` at once. Clicks
  // are sounds on items that are shown when the press is made (the icon, the close button, the bar, the balloon).
  const ev = (t, on, what, o = {}) => {
    const e = { t, on, what };
    if (['clip', 'sound', 'path', 'motion'].includes(what)) { if (o.clip) e.clip = o.clip; e.how = o.how || 'once'; }
    else if (what === 'seq') e.how = o.how || 'once';
    else if (o.cut) e.fade = 'cut';
    return e;
  };
  const seq = (id, name, len, events) => sequences.push({ id, name, len, ev: events });
  seq('sqstao', 'Start open', 1, [ev(0, 'stmenu', 'show', { cut: true }), ev(0, 'sclik2', 'sound')]);
  seq('sqstac', 'Start close', 1, [ev(0, 'stmenu', 'hide', { cut: true }), ev(0, 'sclik2', 'sound')]);
  // (each window: the icon's click, its loading hourglass (and the desktop's) turning for 1.2 s, then the window and its
  // close button)
  const OPEN = [['sqopco', 'viewbl', 'clsco1', 'hgldco', 'sclkco', 'the picture viewer', []], ['sqopdo', 'notepd', 'clsdo1', 'hglddo', 'sclkdo', 'the notes', []],
    ['sqopin', 'searcw', 'clsin1', 'hgldin', 'sclkin', 'the search', []], ['sqopmp', 'mediap', 'clsmp1', 'hgldmp', 'sclkme', 'the player', ['mdplay', 'mdstop']]];
  for (const [id, w, c, h, k, label, extra] of OPEN) seq(id, `Open ${label}`, 1.5, [
    ev(0, h, 'show', { cut: true }), ev(0, h, 'clip', { clip: 'Load' }), ev(0, 'hourgl', 'clip', { clip: 'Load' }), ev(0, k, 'sound'),
    ev(1.2, h, 'hide', { cut: true }), ev(1.2, `sqsh${id.slice(4)}`, 'seq')]);
  // (the window and its buttons are shown by a sequence of their own that a press only starts again at the same instant it
  // shows them, so pressing the icon of an open window never leaves it without a show source)
  for (const [id, w, c, h, k, label, extra] of OPEN) seq(`sqsh${id.slice(4)}`, `Show ${label}`, 1, [ev(0, w, 'show'), ev(0, c, 'show'), ...extra.map(x => ev(0, x, 'show'))]);
  const CLOSE = [['sqclco', 'viewbl', 'clsco1', 'sclcco', 'the picture viewer', []], ['sqcldo', 'notepd', 'clsdo1', 'sclcdo', 'the notes', []], ['sqclin', 'searcw', 'clsin1', 'sclcin', 'the search', []],
    ['sqclmp', 'mediap', 'clsmp1', 'sclcmp', 'the player', ['mdplay', 'mdstop']]];
  for (const [id, w, c, k, label, extra] of CLOSE) seq(id, `Close ${label}`, 1, [ev(0, k, 'sound'), ev(0, w, 'hide'), ev(0, c, 'hide'), ...extra.map(x => ev(0, x, 'hide')), ...(id === 'sqclmp' ? [ev(0, 'sqmuof', 'seq')] : [])]);
  seq('sqdanc', 'Clippy dances', 2.5, [ev(0, 'clippy', 'clip', { clip: 'Dance' }), ev(0, 'sgiggl', 'sound')]);
  [['sqbur1', 'blcurs', 'sbur01'], ['sqbur2', 'blgras', 'sbur02'], ['sqbur3', 'clbal1', 'sbur03'], ['sqbur4', 'clbal2', 'sbur04'], ['sqbur5', 'blgo01', 'sbur05'], ['sqbur6', 'blhill', 'sbur06']]
    .forEach(([id, b, k]) => seq(id, `Burst ${byId[b].r.name}`, 1, [ev(0, b, 'clip', { clip: 'Burst' }), ev(0, k, 'sound')]));
  // (the music runs as long as its sequence does: ten minutes, or until Music off or closing the player stops it)
  seq('sqmuon', 'Music on', 600, [ev(0, 'mediap', 'clip', { clip: 'Bars', how: 'loop' }), ev(0, 'smusic', 'sound', { how: 'loop' }), ev(0, 'sclkmp', 'sound')]);
  seq('sqmuof', 'Music off', 1, [ev(0, 'mediap', 'clip', { how: 'stop' }), ev(0, 'smusic', 'sound', { how: 'stop' }), ev(0, 'sqmuon', 'seq', { how: 'stop' }), ev(0, 'sclkmp', 'sound')]);
  seq('sqlogn', 'Log in', 1, [ev(0, 'sclkwl', 'sound'), ev(0, 'welcom', 'hide'), ev(0, 'twelco', 'hide')]);

  // ---- what is pressed (record `press` on an object: `do`, for everyone at the circle) and what happens while it is pointed
  // at (`hover`, each person's own): a press starts a sequence; a button lifts out while it is pointed at and Clippy waves
  const lifts = id => [{ on: id, what: 'clip', clip: 'Lift', how: 'hold' }], starts = id => [{ on: id, what: 'seq', how: 'once' }];
  const press = (id, d, h) => { const r = byId[id] && byId[id].r; if (!r) { errors.push(`press: no object ${id}`); return; } r.press = Object.assign(d ? { do: d } : {}, h ? { hover: h } : {}); };
  press('tbstrt', starts('sqstao'), lifts('tbstrt'));
  press('stmenu', starts('sqstac'));
  OPEN.forEach(([sid, w, c, h, k], i) => { const icon = ['icmyco', 'icmydo', 'icinte', 'icmedi'][i]; press(icon, starts(sid), lifts(icon)); });
  CLOSE.forEach(([sid, w, c], i) => press(c, starts(sid), lifts(c)));
  press('mdplay', starts('sqmuon'), lifts('mdplay'));
  press('mdstop', starts('sqmuof'), lifts('mdstop'));
  press('clippy', starts('sqdanc'), [{ on: 'clippy', what: 'clip', clip: 'Wave', how: 'loop' }]);
  [['blcurs', 'sqbur1'], ['blgras', 'sqbur2'], ['clbal1', 'sqbur3'], ['clbal2', 'sqbur4'], ['blgo01', 'sqbur5'], ['blhill', 'sqbur6']].forEach(([b, sid]) => press(b, starts(sid)));
  press('welcom', starts('sqlogn'));

  // ---- groups: things that move together in the studio
  groups.push({ id: 'gtaskb', name: 'Desktop', items: ['tbbar1', 'tbstrt', 'tbquik', 'tbtask', 'tbtray', 'stmenu', 'blcurs', 'blgras', 'wallpa', 'bootsc', 'welcom', 'twelco', 'tbliss', 'icmyco', 'icmydo', 'icinte', 'icmedi', 'hourgl'] });
  groups.push({ id: 'gclipy', name: "Clippy's corner", items: ['clloun', 'clippy', 'clbal1', 'clbal2', 'chatdk'] });
  groups.push({ id: 'gnotes', name: 'Notes', items: ['notepd', 'keybrd', 'replce', 'clsdo1', 'hglddo'] });
  groups.push({ id: 'gpaint', name: 'Paint and the player', items: ['paintw', 'mediap', 'clsmp1', 'hgldmp', 'mdplay', 'mdstop'] });
  groups.push({ id: 'gpages', name: 'The pages', items: ['browsr', 'searcw', 'recycl', 'clsin1', 'hgldin'] });
  groups.push({ id: 'gdoor1', name: 'The door', items: ['door01', 'hand01', 'blgo01', 'blhill', 'wreal1', 'viewbl', 'clsco1', 'hgldco'] });
  groups.push({ id: 'gerror', name: 'The error corner', items: ['remote', 'wclose', 'trail1', 'errorc'] });
  groups.push({ id: 'gcards', name: 'Cards', items: ['cardh1', 'cards1', 'cardd1', 'cardc1'] });
  groups.push({ id: 'gdraft', name: 'Drafts', items: ['paper1', 'paper2'] });
  groups.push({ id: 'gwayot', name: 'The way out', items: ['turnof', 'safeof', 'wingrs'] });

  // ---- checks: the clips the cubes start are there; then the rules every layout of the room keeps (checkLayout)
  for (const c of cubes) for (const e of c.plays || []) if (e.what === 'clip') { const t = objects.find(o => o.id === e.on); if (t && !clipsOf(partOf[t.file]).includes(e.clip)) errors.push(`${c.id}: ${e.on} has no clip ${e.clip}`); }
  // (the clips the sequences' events and the presses name are on their parts too)
  const clipOn = (what, id, clip, e) => { const t = objects.find(o => o.id === id); if (t && clip && !clipsOf(partOf[t.file]).includes(clip)) errors.push(`${what}: ${id} has no clip ${clip}`); };
  for (const q of sequences) for (const e of q.ev) if (e.what === 'clip') clipOn(q.id, e.on, e.clip);
  for (const o of objects) if (o.press) for (const e of [...(o.press.do || []), ...(o.press.hover || [])]) if (e.what === 'clip') clipOn(o.id, e.on, e.clip);
  const layout = { studio: 1, scene: 'bliss-xp', saved: '2026-11-15T12:00:00.000Z', objects, cubes, sounds, groups, sequences };
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
  // ---- v146: sequences and presses (rules 1 to 8 of the v146 spec)
  const seqs = new Map((L.sequences || []).map(q => [q.id, q])), byObj = new Map((L.objects || []).map(o => [o.id, o]));
  for (const x of L.sequences || []) { if (!/^[a-z0-9]{6}$/.test(x.id)) out.push(`${x.id}: not six letters and digits`); if (ids.has(x.id)) out.push(`${x.id}: used twice`); ids.add(x.id); }
  const have = id => items.has(id) || seqs.has(id);
  const KIND = { clip: o => objs.has(o), sound: o => (L.sounds || []).some(x => x.id === o), seq: o => seqs.has(o), show: have, hide: have, path: have, motion: have };
  const sees = (what, on) => (KIND[what] || (() => false))(on);
  for (const q of L.sequences || []) for (const e of q.ev || []) {
    if (!sees(e.what, e.on)) out.push(`${q.id}: an event at ${e.t} s ${e.what}s ${e.on}, which is not in the room (or not the right kind)`);
    if (e.what === 'seq' && e.on === q.id) out.push(`${q.id} starts itself`);
  }
  for (const o of L.objects || []) for (const [list, entries] of [['do', (o.press || {}).do], ['hover', (o.press || {}).hover]]) for (const e of entries || []) if (!sees(e.what, e.on)) out.push(`${o.id}: a press (${list}) ${e.what}s ${e.on}, which is not in the room (or not the right kind)`);
  for (const o of L.objects || []) if (o.press && !(o.press.do || o.press.hover || []).length) out.push(`${o.id}: a press with nothing in it`);
  // (a sound a sequence starts once is never on something the same sequence shows at the same moment or later: it would start
  // as that thing fades in)
  for (const q of L.sequences || []) for (const e of q.ev || []) if (e.what === 'sound' && e.how === 'once') {
    const S = soundOf(e.on), on = S && S.on;
    if (on && (q.ev || []).some(f => f.what === 'show' && f.on === on && f.t >= e.t)) out.push(`${q.id} starts ${e.on} once on ${on}, which it shows at ${e.t} s or later`);
  }
  // (what is pressed or pointed at can be pressed: an object, never a cube; a loop in a press toggles, a hold is for pointing)
  for (const o of L.objects || []) for (const e of (o.press || {}).do || []) if (e.how === 'hold') out.push(`${o.id}: a hold in a press (it is for pointing at)`);
  // (every window an icon opens has a close button riding on it that its Close sequence hides, and its loading hourglass rides on it)
  for (const q of L.sequences || []) if (/^sqop/.test(q.id)) {
    const sh = (q.ev || []).find(e => e.t > 0 && e.what === 'seq' && e.on === 'sqsh' + q.id.slice(4)), shq = sh && [...seqs.values()].find(r => r.id === sh.on), sev = (shq && shq.ev) || [];
    const w = sev.find(e => e.t === 0 && e.what === 'show' && e.fade === undefined && /^(viewbl|notepd|searcw|mediap)$/.test(e.on));
    const c = w && sev.find(e => e.t === w.t && e.what === 'show' && /^cls/.test(e.on)), h = (q.ev || []).find(e => e.what === 'hide' && /^hgld/.test(e.on));
    const close = [...seqs.values()].find(r => /^sqcl/.test(r.id) && (r.ev || []).some(e => e.what === 'hide' && w && e.on === w.on));
    if (!w || !c || !h) { out.push(`${q.id}: it should show a window and its close button and hide its loading hourglass`); continue; }
    const ride = id => byObj.get(id) && byObj.get(id).behaviour && byObj.get(id).behaviour.kind === 'item' ? byObj.get(id).behaviour.target : null;
    if (ride(c.on) !== w.on) out.push(`${c.on} does not ride on ${w.on}`);
    if (ride(h.on) !== w.on) out.push(`${h.on} does not ride on ${w.on}`);
    if (!close || !close.ev.some(e => e.what === 'hide' && e.on === c.on)) out.push(`no Close sequence hides ${w.on} and ${c.on} together`);
  }
  // (what has a clip only for a press or for pointing at has anim off, so nothing loops by itself; no cube shows the Start menu)
  for (const id of ['tbstrt', 'icmyco', 'icmydo', 'icinte', 'icmedi', 'recycl', 'hourgl', 'mediap', 'clsco1', 'clsdo1', 'clsin1', 'clsmp1', 'mdplay', 'mdstop', 'cardh1', 'cards1', 'cardd1', 'cardc1', 'paper1', 'paper2'])
    if (byObj.has(id) && byObj.get(id).anim !== 'off') out.push(`${id} should have anim off`);
  for (const c of L.cubes || []) if ((c.show || []).includes('stmenu')) out.push(`${c.id} shows the Start menu: presses own it`);
  // (a key cube's key is an object anyone may move, standing outside every key cube; a key cube reaches no higher than 0.6 m)
  const keyed = (L.cubes || []).filter(c => c.key), inside = (c, p) => [0, 2].every(j => Math.abs(p[j] - c.p[j]) < c.size[j] / 2);
  for (const c of keyed) {
    const k = byObj.get(c.key);
    if (!k) out.push(`${c.id}: its key ${c.key} is not an object in the room`);
    else if (!k.grab) out.push(`${c.id}: its key ${c.key} is not an item anyone may move`);
    else for (const d of keyed) if (inside(d, k.p)) out.push(`${c.key} starts inside ${d.id}`);
    if (c.p[1] + c.size[1] / 2 > 0.6) out.push(`${c.id} reaches ${(c.p[1] + c.size[1] / 2).toFixed(2)} m high (at most 0.6)`);
  }
  return out;
}
