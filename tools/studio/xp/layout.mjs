// The Bliss XP room's layout.json: a walk through the video in a room of about 5 x 5 m round the scene's origin (where
// you stand at first, -z ahead; walls at about +-2.5 m). The desktop on the front wall (the boot and welcome screens,
// the AR wallpaper, the icons, the taskbar and the balloons by its clock), chats and notes on the left wall, the door
// outside on the right wall, the way out on the back wall, the grass in the middle, Clippy chilling in the front left
// corner, clouds under the ceiling, the hill and the sky (VR) round it all. Wall items carry the studio's wall behaviour
// (v137's contract: in AR they go onto the walls the headset finds), so the room maps onto each headset's own room;
// trigger cubes make it a walk: some for everyone at the circle (all: true), most for each person.
// makeLayout(parts, files) -> { layout, errors, partOf }: parts by name ({ file, tris, clips, box }), the scene's files.
const W = 2.5;   // (the walls of the room it is designed in)
const r4 = v => Math.round(v * 1e4) / 1e4 || 0, r3 = v => Math.round(v * 1e3) / 1e3 || 0;
const yawQ = a => [0, r4(Math.sin(a / 2)), 0, r4(Math.cos(a / 2))];
const turn = (a, [x, y, z]) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];   // (about the vertical, as yawQ)
const plus = (a, b) => a.map((v, i) => r3(v + b[i]));
// where a wall item stands: its back the gap off the wall, facing into the room
const front = (x, y, gap) => ({ p: [r3(x), r3(y), r3(-W + gap)], q: [0, 0, 0, 1] });
const back = (x, y, gap) => ({ p: [r3(x), r3(y), r3(W - gap)], q: yawQ(Math.PI) });
const left = (z, y, gap) => ({ p: [r3(-W + gap), r3(y), r3(z)], q: yawQ(Math.PI / 2) });
const right = (z, y, gap) => ({ p: [r3(W - gap), r3(y), r3(z)], q: yawQ(-Math.PI / 2) });
const floor = (x, z, a) => ({ p: [r3(x), 0, r3(z)], q: yawQ(a), a });
const facing = (x, z) => Math.atan2(-x, -z);   // (the yaw that turns its front, +z, to the scene's origin)
// the wall behaviour (v137): onto the wall in its placed direction, the nearest wall, or the wall nearest a person
const wall = (at, gap, o = {}) => Object.assign({ kind: 'wall', at }, at === 'person' ? { who: o.who || 'nearest', range: o.range || 3, speed: o.speed || 0.6 } : {}, gap !== undefined && gap !== 0.03 ? { gap } : {});

export function makeLayout(parts, files) {
  const errors = [], have = new Set(files), partOf = {};
  for (const [n, p] of Object.entries(parts)) partOf[p.file] = n;
  const objects = [], sounds = [], cubes = [], groups = [];
  const clipsOf = n => (parts[n] ? parts[n].clips.map(c => c.name) : []);
  // an object: its part, where it stands, and what it does
  const obj = (id, name, part, pose, o = {}) => {
    const P = parts[part];
    if (!P) { errors.push(`${id}: no part ${part}`); return; }
    if (!have.has(P.file)) errors.push(`${id}: ${P.file} is not in the scene`);
    const clips = clipsOf(part), clip = o.clip !== undefined ? o.clip : clips[0] || '';
    if (clip && !clips.includes(clip)) errors.push(`${id}: ${part} has no clip ${clip} (${clips.join(', ') || 'none'})`);
    const r = { id, name, file: P.file, p: pose.p, q: pose.q, s: o.s || 1, light: 'lit', clip, anim: o.anim || (clip ? 'loop' : 'off'), start: o.start || 'always' };
    if (o.behaviour) r.behaviour = o.behaviour;
    if (o.motion) r.motion = o.motion;
    if (o.shows) r.shows = o.shows;
    if (o.locked) r.locked = true;
    objects.push(r);
    return r;
  };
  // a sound: an emitter at its object (on), so it comes from there
  const snd = (id, name, file, on, o = {}) => {
    const t = objects.find(x => x.id === on);
    if (!t) { errors.push(`${id}: no object ${on} to follow`); return; }
    if (!have.has(file)) errors.push(`${id}: ${file} is not in the scene`);
    const off = o.o || [0, 0, 0], q = t.q, a = 2 * Math.atan2(q[1], q[3]);
    const r = { id, name, file, p: plus(t.p, turn(a, off)), vol: o.vol || 1, r: o.r || 2, loop: !!o.loop, start: o.start || 'always', on };
    if (off.some(v => v)) r.o = off;
    if (o.shows) r.shows = o.shows;
    sounds.push(r);
  };
  const cube = (id, name, p, size, o) => {
    const r = Object.assign({ id, name, p, yaw: 0, size, mode: o.mode || 'while', show: o.show || [], hide: o.hide || [] }, o.plays ? { plays: o.plays } : {}, o.all ? { all: true } : {});
    cubes.push(r);
  };

  // ---- the front wall: the desktop
  obj('wallpa', 'Wallpaper (AR)', 'wallpaper', front(0, 1.32, 0.01), { shows: 'ar', behaviour: wall('direction', 0.01) });
  obj('bootsc', 'Boot screen', 'boot', front(0, 1.36, 0.06), { behaviour: wall('direction', 0.06) });
  obj('welcom', 'Welcome screen', 'welcome', front(0, 1.36, 0.06), { behaviour: wall('direction', 0.06) });
  obj('twelco', 'Title: welcome back.', 'title-welcome', front(-0.38, 1.44, 0.17), { behaviour: wall('direction', 0.17) });
  obj('tbliss', 'Title: bliss', 'title-bliss', front(0, 2.3, 0.05), { behaviour: wall('direction', 0.05) });
  obj('tbbar1', 'Taskbar', 'taskbar-bar', front(0, 0.3, 0.02), { behaviour: wall('nearest', 0.02) });
  obj('tbstrt', 'Start button', 'taskbar-start', front(-1.27, 0.3, 0.04), { behaviour: wall('nearest', 0.04) });
  obj('tbquik', 'Quick launch', 'taskbar-quick', front(-0.88, 0.3, 0.04), { behaviour: wall('nearest', 0.04) });
  obj('tbtask', 'Task buttons', 'taskbar-tasks', front(0.12, 0.3, 0.04), { behaviour: wall('nearest', 0.04) });
  obj('tbtray', 'Tray and clock', 'taskbar-tray', front(1.21, 0.3, 0.04), { behaviour: wall('nearest', 0.04) });
  obj('stmenu', 'Start menu', 'start-menu', front(-1.16, 0.8, 0.06), { behaviour: wall('nearest', 0.06) });
  obj('icmyco', 'My Computer', 'icon-computer', front(-2.05, 1.95, 0.02), { behaviour: wall('direction', 0.02) });
  obj('icmydo', 'My Documents', 'icon-documents', front(-2.05, 1.5, 0.02), { behaviour: wall('direction', 0.02) });
  obj('icinte', 'Internet', 'icon-internet', front(-2.05, 1.05, 0.02), { behaviour: wall('direction', 0.02) });
  obj('icmedi', 'Media Player', 'icon-media', front(-2.05, 0.6, 0.02), { behaviour: wall('direction', 0.02) });
  obj('viewbl', 'Bliss.jpg - Picture and Fax Viewer', 'viewer-bliss', front(2.0, 1.5, 0.05), { behaviour: wall('direction', 0.05) });
  obj('blcurs', 'Balloon: Cursor is now connected', 'balloon-cursor', front(0.46, 0.63, 0.06), { anim: 'once', start: 'shown', behaviour: wall('nearest', 0.06) });
  obj('blgras', 'Balloon: Found New Hardware', 'balloon-grass', front(1.0, 0.62, 0.06), { anim: 'once', start: 'shown', behaviour: wall('nearest', 0.06) });
  obj('hourgl', 'Hourglass', 'hourglass', { p: [1.55, 1.8, -1.95], q: [0, 0, 0, 1] }, { motion: { kind: 'spin', speed: 6, amount: 0, axis: 'y', start: 'always' } });
  obj('recycl', 'Recycle Bin', 'recycle-bin', floor(1.95, -1.95, facing(1.95, -1.95)));
  obj('duck01', 'Rubber duck (You)', 'duck', floor(0.62, -1.85, facing(0.62, -1.85)));

  // ---- the left wall: chats and notes
  obj('chatcl', 'Chat: Clippy - Conversation', 'chat-clippy', left(-1.0, 1.45, 0.05), { anim: 'off', behaviour: wall('person', 0.05) });
  obj('chatdk', 'Chat: Duck - Conversation', 'chat-duck', left(-1.95, 1.15, 0.08), { anim: 'off', behaviour: wall('direction', 0.08) });
  obj('notepd', 'diary.txt - Notepad', 'notepad-diary', left(0.25, 1.55, 0.05), { behaviour: wall('direction', 0.05) });
  obj('keybrd', 'On-Screen Keyboard', 'keyboard', left(0.25, 0.95, 0.05), { behaviour: wall('direction', 0.05) });
  obj('replce', 'Confirm File Replace', 'confirm-replace', left(-0.2, 1.18, 0.13), { behaviour: wall('direction', 0.13) });
  obj('paintw', 'hill.bmp - Paint', 'paint-hill', left(1.2, 1.62, 0.05), { behaviour: wall('direction', 0.05) });
  obj('mediap', 'Media Player', 'media-player', left(2.0, 0.95, 0.05), { behaviour: wall('direction', 0.05) });

  // ---- the right wall: the pages, the door outside, the error corner
  obj('browsr', 'the bliss network - Internet', 'browser-bliss', right(-1.3, 1.32, 0.03), { behaviour: wall('direction', 0.03) });
  obj('searcw', 'how to go outside - Search', 'search-outside', right(-1.62, 1.58, 0.09), { behaviour: wall('direction', 0.09) });
  obj('door01', 'Door outside', 'door', right(0, 1.115, 0.005), { clip: 'Open', anim: 'off', behaviour: wall('direction', 0.005) });
  obj('hand01', 'Hand cursor', 'cursor-hand', { p: [2.24, 1.13, 0.36], q: yawQ(-Math.PI / 2) }, { motion: { kind: 'bob', speed: 40, amount: 0.04, axis: 'x', start: 'always' } });
  obj('blgo01', 'Balloon: Go. Click the door', 'balloon-go', right(-0.85, 1.55, 0.06), { anim: 'once', start: 'shown', behaviour: wall('direction', 0.06) });
  obj('blsono', 'Balloon: Bliss, Sonoma County', 'balloon-sonoma', right(0.88, 1.55, 0.06), { anim: 'once', start: 'shown', behaviour: wall('direction', 0.06) });
  obj('wreal1', 'Window: Bliss is a real place', 'win-real-place', right(0, 2.34, 0.05), { behaviour: wall('direction', 0.05) });
  obj('errorc', 'Error: Cursor has encountered a problem', 'error-cursor', right(1.85, 1.35, 0.08), { behaviour: wall('direction', 0.08) });
  obj('wclose', 'Window: Close all your windows', 'win-close-all', right(1.55, 2.1, 0.05), { behaviour: wall('direction', 0.05) });

  // ---- the back wall: the way out
  obj('solita', 'Solitaire win', 'solitaire', back(-1.75, 1.0, 0.02), { start: 'shown', behaviour: wall('direction', 0.02) });
  obj('taskmg', 'Task Manager', 'task-manager', back(-0.75, 1.5, 0.05), { behaviour: wall('direction', 0.05) });
  obj('turnof', 'Turn off computer', 'turn-off', back(0.32, 1.56, 0.06), { behaviour: wall('direction', 0.06) });
  obj('safeof', "It's now safe to turn off your computer.", 'safe-off', back(0.32, 0.98, 0.06), { behaviour: wall('direction', 0.06) });
  obj('wingrs', 'Window: Go touch the grass', 'win-grass', back(0.32, 2.15, 0.04), { behaviour: wall('direction', 0.04) });
  obj('remote', 'Remote Assistance', 'remote-assistance', back(1.25, 0.78, 0.05), { behaviour: wall('direction', 0.05) });
  obj('trail1', 'Window trail', 'trail', back(1.75, 1.6, 0.02), { behaviour: wall('direction', 0.02) });

  // ---- the floor: Clippy's corner, the grass and what stands in it
  const lounge = floor(-1.8, -1.7, facing(-1.8, -1.7)), at = off => plus(lounge.p, turn(lounge.a, off));
  obj('clloun', "Clippy's lounge", 'clippy-lounge', lounge);
  obj('clippy', 'Clippy', 'clippy', { p: at([0, 0.1, -0.02]), q: lounge.q }, { clip: 'Chill' });
  obj('clbal1', 'Clippy: trying to go outside?', 'clippy-balloon-outside', { p: at([0.2, 0.76, 0.02]), q: lounge.q }, { anim: 'once', start: 'shown' });
  obj('clbal2', 'Clippy: trying to be happy?', 'clippy-balloon-happy', { p: at([0.44, 1.12, -0.04]), q: lounge.q }, { anim: 'once', start: 'shown' });
  obj('grass1', 'Grass', 'grass-patch', floor(0.15, 0.95, 0.3));
  obj('grass2', 'Grass strip', 'grass-strip', floor(-0.9, 1.5, -0.4));
  obj('grass3', 'Grass 2', 'grass-patch', floor(1.0, 1.4, 1.2));
  obj('grass4', 'Grass 3', 'grass-patch', floor(-1.55, 0.45, 2.1));
  obj('glcrt1', 'Glass CRT', 'glass-crt', floor(0.35, 1.25, facing(0.35, 1.25)));
  obj('phone1', 'Flip phone', 'flip-phone', floor(-0.42, 1.2, facing(-0.42, 1.2)));
  obj('cursor', 'Giant cursor', 'cursor-arrow', { p: [0.9, 1.3, -0.6], q: [0, 0, 0, 1] }, { behaviour: { kind: 'follow', who: 'nearest', range: 3, dist: 0.9, speed: 0.6, side: 'right', face: 'along' } });

  // ---- clouds under the ceiling (both), big ones far in the sky (VR)
  const orbit = (amount, speed) => ({ kind: 'orbit', speed, amount, axis: 'y', start: 'always' });
  obj('cloud1', 'Cloud', 'cloud-a', { p: [-1.2, 2.25, -1.0], q: [0, 0, 0, 1] }, { motion: orbit(0.5, 1.2) });
  obj('cloud2', 'Cloud 2', 'cloud-b', { p: [1.3, 2.3, -0.4], q: yawQ(0.8) }, { motion: orbit(0.4, -1.5) });
  obj('cloud3', 'Cloud 3', 'cloud-c', { p: [0.1, 2.3, 1.4], q: yawQ(2) }, { motion: orbit(0.6, 0.8) });
  obj('cloud4', 'Cloud 4', 'cloud-b', { p: [-1.5, 2.2, 1.3], q: yawQ(-1) }, { motion: orbit(0.3, 1.8) });
  obj('cloud5', 'Cloud 5', 'cloud-a', { p: [1.5, 2.25, 1.6], q: yawQ(2.6) }, { motion: orbit(0.45, -1) });
  obj('vcld01', 'Sky cloud (VR)', 'cloud-c', { p: [-14, 13, -28], q: yawQ(0.4) }, { s: 7, shows: 'vr', motion: orbit(3, 0.4) });
  obj('vcld02', 'Sky cloud 2 (VR)', 'cloud-a', { p: [22, 16, -18], q: yawQ(-1) }, { s: 8, shows: 'vr', motion: orbit(4, -0.3) });
  obj('vcld03', 'Sky cloud 3 (VR)', 'cloud-b', { p: [6, 12, 30], q: yawQ(2.4) }, { s: 7, shows: 'vr', motion: orbit(3, 0.35) });
  obj('vcld04', 'Sky cloud 4 (VR)', 'cloud-c', { p: [-26, 15, 12], q: yawQ(1.4) }, { s: 9, shows: 'vr', motion: orbit(4, -0.25) });
  obj('landsc', 'Bliss landscape (VR)', 'landscape', { p: [0, 0, 0], q: [0, 0, 0, 1] }, { shows: 'vr', locked: true });
  obj('stars1', 'Starfield (VR)', 'starfield', { p: [0, 0, 0], q: yawQ(Math.PI) }, { shows: 'vr', locked: true });   // (towards the way out: you fly into it)

  // ---- sounds, each an emitter at its object
  snd('sstart', 'Startup swell', 'sounds/startup.wav', 'welcom', { r: 3 });
  snd('sshutd', 'Shutdown', 'sounds/shutdown.wav', 'turnof', { r: 3 });
  snd('sding1', 'Ding', 'sounds/ding.wav', 'errorc', { r: 2.5 });
  snd('scrit1', 'Critical stop', 'sounds/critical-stop.wav', 'taskmg', { r: 2 });
  snd('spop01', 'Balloon pop', 'sounds/balloon-pop.wav', 'clbal1', { r: 1.5 });
  snd('spop02', 'Balloon pop 2', 'sounds/balloon-pop.wav', 'clbal2', { r: 1.5 });
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

  // ---- the walk: trigger cubes
  const once = (on, what, o = {}) => Object.assign({ on, what }, o.clip ? { clip: o.clip } : {}, { how: o.how || 'once' }, o.when ? { when: o.when } : {});
  cube('cuentr', 'Entry (everyone, once)', [0, 1.1, -1.1], [1.6, 2.2, 0.8], { mode: 'stay', all: true, show: ['welcom', 'twelco', 'cursor', 'blcurs'], hide: ['bootsc'], plays: [once('sstart', 'sound')] });
  cube('custrt', 'Start menu', [-0.85, 1.1, -2.05], [0.9, 2.2, 0.8], { show: ['stmenu'], plays: [once('sclik2', 'sound')] });
  cube('cuclip', 'Clippy', [-1.9, 1.1, -1.65], [1.1, 2.2, 1.3], { show: ['clbal1'], plays: [once('clippy', 'clip', { clip: 'Wave' }), once('spop01', 'sound')] });
  cube('curecy', 'Recycle Bin', [1.9, 1.1, -1.85], [1.1, 2.2, 1.1], { plays: [once('scrump', 'sound')] });
  cube('cuchat', 'Chat', [-1.9, 1.1, 0], [1.1, 2.2, 1.2], { plays: [once('schime', 'sound'), once('snudge', 'sound'), once('chatcl', 'clip', { clip: 'Nudge' }), once('stypin', 'sound', { how: 'loop' })] });
  cube('cudoor', 'Door', [1.9, 1.1, 0], [1.1, 2.2, 1.2], { show: ['blgo01', 'blsono'], hide: ['hand01'], plays: [once('door01', 'clip', { clip: 'Open', how: 'hold' }), once('sclick', 'sound'), once('sout01', 'sound', { how: 'loop' })] });
  cube('cugras', 'Grass (everyone)', [0.1, 1.1, 1.0], [1.4, 2.2, 1.0], { all: true, show: ['blgras', 'clbal2'], plays: [once('shwin1', 'sound'), once('shwout', 'sound', { when: 'leave' }), once('clippy', 'clip', { clip: 'Dance', how: 'loop' }), once('spop02', 'sound')] });
  cube('cusoli', 'Solitaire', [-1.85, 1.1, 1.85], [1.2, 2.2, 1.2], { show: ['solita'], plays: [once('sflips', 'sound', { how: 'loop' })] });
  cube('cutask', 'Task Manager', [-0.75, 1.1, 2.05], [0.8, 2.2, 0.8], { plays: [once('scrit1', 'sound')] });
  cube('cuexit', 'Way out', [0.35, 1.1, 2.05], [0.9, 2.2, 0.8], { show: ['turnof', 'safeof', 'stars1'], hide: ['landsc'], plays: [once('sshutd', 'sound')] });
  cube('cuerro', 'Error corner (everyone)', [1.85, 1.1, 1.9], [1.2, 2.2, 1.1], { all: true, show: ['errorc', 'trail1', 'wclose'], hide: ['cursor'], plays: [once('sding1', 'sound')] });

  // ---- groups: things that move together
  groups.push({ id: 'gtaskb', name: 'Taskbar', items: ['tbbar1', 'tbstrt', 'tbquik', 'tbtask', 'tbtray'] });
  groups.push({ id: 'gclipy', name: "Clippy's corner", items: ['clloun', 'clippy', 'clbal1', 'clbal2'] });
  groups.push({ id: 'gdoor1', name: 'The door', items: ['door01', 'hand01', 'blgo01', 'blsono'] });

  // ---- checks: unique ids of six letters and digits, every id named exists
  const ids = new Set();
  for (const x of [...objects, ...sounds, ...cubes, ...groups]) { if (!/^[a-z0-9]{6}$/.test(x.id)) errors.push(`${x.id}: not six letters and digits`); if (ids.has(x.id)) errors.push(`${x.id}: used twice`); ids.add(x.id); }
  for (const c of cubes) for (const k of [...c.show, ...c.hide, ...(c.plays || []).map(e => e.on)]) if (!ids.has(k)) errors.push(`${c.id}: names ${k}, which is not in the room`);
  for (const g of groups) for (const k of g.items) if (!ids.has(k)) errors.push(`${g.id}: names ${k}, which is not in the room`);
  for (const c of cubes) for (const e of c.plays || []) if (e.what === 'clip') { const t = objects.find(o => o.id === e.on); if (t && !clipsOf(partOf[t.file]).includes(e.clip)) errors.push(`${c.id}: ${e.on} has no clip ${e.clip}`); }
  const layout = { studio: 1, scene: 'bliss-xp', saved: '2026-11-11T12:00:00.000Z', objects, cubes, sounds, groups };
  return { layout, errors, partOf };
}
