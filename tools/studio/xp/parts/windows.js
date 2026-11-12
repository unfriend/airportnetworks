// The Luna windows as thin 3D slabs: a bevelled frame, the title bar and its buttons in relief, their contents as
// pictures with their own buttons raised. Our own words in every one (the chats, the pages, the diary's one line).
(function () {
  const T = THREE, I = XP.icons;
  const sz = F => Math.round(F.W * 0.026);   // (body text: about 2 cm on a window)
  // pieces of a window's client area
  const status = (F, c, words, o = {}) => { const g = F.g, h = Math.round(sz(F) * 1.6); g.fillStyle = XP.LUNA.body; g.fillRect(c.x, c.y + c.h - h, c.w, h); g.fillStyle = '#c5c2b2'; g.fillRect(c.x, c.y + c.h - h, c.w, 1); words.forEach((w, i) => { const x = c.x + 8 + i * c.w * (o.step || 0.35); if (i) { g.fillStyle = '#c5c2b2'; g.fillRect(x - 6, c.y + c.h - h + 3, 1, h - 6); } XP.text(g, w, x, c.y + c.h - h * 0.3, { size: Math.round(sz(F) * 0.8), color: '#000', max: c.w * (o.step || 0.35) - 12 }); }); return h; };
  const scrollbars = (F, c, x, y, w, h) => {   // XP's light blue scroll bars on the right and the foot
    const g = F.g, s = Math.round(F.W * 0.024);
    g.fillStyle = '#f4f3ee'; g.fillRect(x + w - s, y, s, h); g.fillRect(x, y + h - s, w, s);
    for (const [bx, by, bw, bh] of [[x + w - s, y, s, s], [x + w - s, y + h - 2 * s, s, s], [x, y + h - s, s, s], [x + w - 2 * s, y + h - s, s, s], [x + w - s, y + s * 1.2, s, h * 0.35]]) { g.fillStyle = XP.grad(g, bx, 0, bx + bw, 0, [[0, '#c8d9fb'], [1, '#a9c2f2']]); XP.rr(g, bx + 1, by + 1, bw - 2, bh - 2, 3); g.fill(); g.strokeStyle = '#7f9fdb'; g.lineWidth = 1; g.stroke(); }
    return s;
  };
  const field = (F, x, y, w, h, words, o = {}) => { const g = F.g; g.fillStyle = '#fff'; g.fillRect(x, y, w, h); g.strokeStyle = '#7f9db9'; g.lineWidth = 1.5; g.strokeRect(x, y, w, h); if (words) XP.text(g, words, x + 6, y + h * 0.7, { size: o.size || Math.round(h * 0.55), color: o.color || '#000', max: w - 12 }); };
  const toolbarIcon = (F, x, y, s, draw, label, raised) => { draw(F.g, x, y, s); if (label) XP.text(F.g, label, x + s / 2, y + s + s * 0.42, { size: Math.round(s * 0.32), align: 'center', color: '#000' }); raised.push([x - 2, y - 2, x + s + 2, y + s + 2, 0.005]); };
  const arrow = (dir, col) => (g, x, y, s) => { g.fillStyle = XP.grad(g, 0, y, 0, y + s, [[0, '#9fe08a'], [1, col || '#2a9a2a']]); g.beginPath(); g.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); const m = s * 0.25; if (dir < 0) { g.moveTo(x + m, y + s / 2); g.lineTo(x + s - m * 1.3, y + m); g.lineTo(x + s - m * 1.3, y + s - m); } else { g.moveTo(x + s - m, y + s / 2); g.lineTo(x + m * 1.3, y + m); g.lineTo(x + m * 1.3, y + s - m); } g.closePath(); g.fill(); };
  const win = (name, file, o) => XP.part(name, { file, build: () => ({ root: XP.group(name, XP.window(Object.assign({ name }, o))), clips: o.clips }) });

  // ---- chat windows: our own short lines, the avatars on the right, a raised Send
  const chat = (who, pic, lines, typing) => (F, L) => {
    const { g } = F, c = L.client, raised = [], s = sz(F);
    let y = c.y + XP.menubar(g, c, ['File', 'Edit', 'Actions', 'Tools', 'Help']);
    const tb = Math.round(c.h * 0.13); g.fillStyle = XP.grad(g, 0, y, 0, y + tb, [[0, '#eaf2ff'], [1, '#c6d9f7']]); g.fillRect(c.x, y, c.w, tb);
    [['Invite', I.duck], ['Send Files', I.folder], ['Voice', I.speaker], ['Games', I.play], ['Nudge', I.warn]].forEach(([t, ic], i) => toolbarIcon(F, c.x + 14 + i * c.w * 0.14, y + 4, tb * 0.52, ic, t, raised));
    y += tb;
    g.fillStyle = '#f0f4fb'; g.fillRect(c.x, y, c.w, s * 1.6); XP.text(g, `To: ${who} <${who.toLowerCase()}@bliss.desktop>`, c.x + 10, y + s * 1.15, { size: Math.round(s * 0.85), color: '#333' }); y += s * 1.6;
    const aw = c.w * 0.22, mx = c.x + 8, mw = c.w - aw - 24, mh = c.h - (y - c.y) - s * 4.8;
    g.fillStyle = '#fff'; g.fillRect(mx, y + 4, mw, mh); g.strokeStyle = '#7f9db9'; g.strokeRect(mx, y + 4, mw, mh);
    let ly = y + s * 1.6;
    for (const [w, t] of lines) { XP.text(g, `${w} says:`, mx + 10, ly, { size: Math.round(s * 0.82), color: '#808080', max: mw - 20 }); ly += s * 1.1; ly = XP.para(g, t, mx + 22, ly, mw - 34, { size: s, color: w === 'You' ? '#0a246a' : '#000', lh: s * 1.2 }) + s * 0.4; }
    for (const [k, p] of [[0, pic], [1, I.duck]]) { const ax = c.x + c.w - aw - 8, ay = y + 4 + k * (mh * 0.55), as = Math.min(aw, mh * 0.45); g.fillStyle = '#fff'; XP.rr(g, ax, ay, as, as, 6); g.fill(); g.strokeStyle = '#7f9db9'; g.stroke(); g.save(); XP.rr(g, ax + 4, ay + 4, as - 8, as - 8, 4); g.clip(); g.fillStyle = XP.grad(g, 0, ay, 0, ay + as, [[0, '#d9ecff'], [1, '#9cc3f5']]); g.fillRect(ax, ay, as, as); p(g, ax + as * 0.12, ay + as * 0.1, as * 0.76); g.restore(); raised.push([ax, ay, ax + as, ay + as, 0.006]); }
    const iy = y + mh + 10, ih = s * 3.4; field(F, mx, iy, mw - s * 5.4, ih, typing, { size: s });
    const bx = mx + mw - s * 5, by = iy + ih * 0.15; raised.push(XP.button(g, bx, by, s * 4.8, ih * 0.7, 'Send', { def: true }).concat([0.007]));
    return raised;
  };
  win('chat-clippy', 'models/chat-clippy.glb', { w: 0.8, h: 0.66, title: 'Clippy - Conversation', icon: I.clippy, draw: chat('Clippy', I.clippy, [['Clippy', 'Hi! It looks like you are chatting.'], ['You', 'I have 100 windows open'], ['Clippy', 'Have you tried the grass?'], ['You', 'brb']], 'touching grass, back soon'),
    clips: [new T.AnimationClip('Nudge', 0.9, [XP.vTrack('chat-clippy', 'position', [0, 0.08, 0.16, 0.24, 0.32, 0.4, 0.48, 0.56, 0.64, 0.9], [[0, 0, 0], [-0.03, 0.01, 0], [0.03, -0.01, 0], [-0.025, -0.012, 0], [0.028, 0.01, 0], [-0.02, 0.008, 0], [0.018, -0.006, 0], [-0.01, 0.004, 0], [0.005, 0, 0], [0, 0, 0]])])] });
  win('chat-duck', 'models/chat-duck.glb', { w: 0.72, h: 0.6, title: 'Duck - Conversation', icon: I.duck, draw: chat('Duck', I.duck, [['Duck', 'quack'], ['You', 'did you just nudge me?'], ['Duck', 'quack quack'], ['You', 'the sky is very blue today']], 'see you on the hill'),
    clips: [new T.AnimationClip('Nudge', 0.9, [XP.vTrack('chat-duck', 'position', [0, 0.08, 0.16, 0.24, 0.32, 0.4, 0.48, 0.56, 0.64, 0.9], [[0, 0, 0], [0.03, -0.01, 0], [-0.03, 0.01, 0], [0.025, 0.012, 0], [-0.028, -0.01, 0], [0.02, -0.008, 0], [-0.018, 0.006, 0], [0.01, -0.004, 0], [-0.005, 0, 0], [0, 0, 0]])])] });

  // ---- Notepad: the diary's one line, a caret after it
  win('notepad-diary', 'models/notepad-diary.glb', { w: 0.8, h: 0.6, title: 'diary.txt - Notepad', icon: I.note, draw(F, L) {
    const { g } = F, c = L.client, s = sz(F), mb = XP.menubar(g, c, ['File', 'Edit', 'Format', 'View', 'Help']);
    g.fillStyle = '#fff'; g.fillRect(c.x, c.y + mb, c.w, c.h - mb);
    scrollbars(F, c, c.x, c.y + mb, c.w, c.h - mb);
    const w = XP.text(g, 'The first time I got a mouse,', c.x + 12, c.y + mb + s * 1.5, { size: Math.round(s * 1.05), font: XP.F.mono, color: '#000' });
    g.fillStyle = '#000'; g.fillRect(c.x + 14 + w, c.y + mb + s * 0.45, 2, s * 1.3);
    return [];
  } });

  // ---- the On-Screen Keyboard: every key raised
  win('keyboard', 'models/keyboard.glb', { w: 0.96, h: 0.4, title: 'On-Screen Keyboard', icon: I.computer, draw(F, L) {
    const { g } = F, c = L.client, raised = [], mb = XP.menubar(g, c, ['File', 'Keyboard', 'Settings', 'Help']);
    const rows = [['esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'], ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'bksp'], ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'], ['caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'ent'], ['shft', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'shft'], ['ctrl', 'win', 'alt', ' ', 'alt', 'ctrl']];
    const top = c.y + mb + 8, kh = (c.h - mb - 16) / rows.length, unit = (c.w - 24) / 15;
    rows.forEach((row, r) => {
      const wide = k => (k === ' ' ? 6.5 : ['bksp', 'caps', 'ent', 'shft'].includes(k) ? 1.9 : ['tab', 'ctrl'].includes(k) ? 1.5 : 1);
      const total = row.reduce((a, k) => a + wide(k), 0), k0 = (c.w - 24) / unit;
      let x = c.x + 12 + (r === 0 ? 0 : (k0 - total) * unit / 2);
      for (const k of row) {
        const kw = wide(k) * unit * (r === 0 ? 0.98 : 1) - 5, y = top + r * kh;
        g.fillStyle = XP.grad(g, 0, y, 0, y + kh - 5, [[0, '#ffffff'], [1, '#d8d4c8']]); XP.rr(g, x, y, kw, kh - 5, 4); g.fill(); g.strokeStyle = '#8a8a8a'; g.lineWidth = 1.5; g.stroke();
        XP.text(g, k, x + kw / 2, y + kh * 0.62, { size: Math.round(kh * 0.36), align: 'center', color: '#000', max: kw - 6 });
        raised.push([x, y, x + kw, y + kh - 5, 0.007]);
        x += wide(k) * unit;
      }
    });
    return raised;
  } });

  // ---- Confirm File Replace: Yes / Yes to All / No / Cancel
  win('confirm-replace', 'models/confirm-replace.glb', { w: 0.64, h: 0.36, title: 'Confirm File Replace', icon: I.folder, buttons: ['close'], draw(F, L) {
    const { g } = F, c = L.client, s = sz(F) * 1.1, raised = [];
    I.folder(g, c.x + 14, c.y + 14, s * 2.6);
    XP.para(g, "This folder already contains a file named 'bliss.bmp'.", c.x + s * 3.6, c.y + s * 1.6, c.w - s * 4, { size: Math.round(s), color: '#000' });
    XP.text(g, 'Would you like to replace the existing file', c.x + s * 3.6, c.y + s * 3.5, { size: Math.round(s), color: '#000', max: c.w - s * 4 });
    I.paint(g, c.x + s * 4.2, c.y + s * 4.1, s * 1.6); XP.text(g, '1.4 MB, changed today', c.x + s * 6.2, c.y + s * 5.1, { size: Math.round(s * 0.9), color: '#333' });
    XP.text(g, 'with this one?', c.x + s * 3.6, c.y + s * 6.7, { size: Math.round(s), color: '#000' });
    I.paint(g, c.x + s * 4.2, c.y + s * 7.3, s * 1.6); XP.text(g, '1.4 MB, changed in 1996', c.x + s * 6.2, c.y + s * 8.3, { size: Math.round(s * 0.9), color: '#333' });
    const bw = c.w * 0.2, bh = s * 1.9, by = c.y + c.h - bh - 10;
    ['Yes', 'Yes to All', 'No', 'Cancel'].forEach((t, i) => raised.push(XP.button(g, c.x + c.w * 0.12 + i * (bw + 8), by, bw, bh, t, { def: !i }).concat([0.007])));
    return raised;
  } });

  // ---- Paint: our hill on its canvas, its tools and its palette raised
  win('paint-hill', 'models/paint-hill.glb', { w: 0.86, h: 0.66, title: 'hill.bmp - Paint', icon: I.paint, draw(F, L) {
    const { g } = F, c = L.client, raised = [], mb = XP.menubar(g, c, ['File', 'Edit', 'View', 'Image', 'Colors', 'Help']), st = status(F, c, ['For Help, click Help Topics on the Help Menu.'], { step: 1 });
    const tw = c.w * 0.09, top = c.y + mb + 6, ph = c.h * 0.13, bottom = c.y + c.h - st - ph;
    const ts = (tw - 14) / 2;
    for (let i = 0; i < 16; i++) { const x = c.x + 6 + (i % 2) * (ts + 2), y = top + Math.floor(i / 2) * (ts + 2); g.fillStyle = XP.grad(g, 0, y, 0, y + ts, [[0, '#fff'], [1, '#dcd8cc']]); g.fillRect(x, y, ts, ts); g.strokeStyle = '#999'; g.strokeRect(x, y, ts, ts); g.fillStyle = ['#333', '#555', '#c33', '#36c', '#3a3', '#c90', '#666', '#933'][i % 8]; g.fillRect(x + ts * 0.3, y + ts * 0.3, ts * 0.4, ts * 0.4); raised.push([x, y, x + ts, y + ts, 0.005]); }
    g.fillStyle = '#808080'; g.fillRect(c.x + tw, top - 6, c.w - tw, bottom - top + 6);
    const px = c.x + tw + 10, py = top + 6, pw = c.w - tw - 28, phh = bottom - top - 18;
    XP.hill(g, px, py, pw, phh, { seed: 31, clouds: 3 });
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px + 4, py + phh, pw, 4); g.fillRect(px + pw, py + 4, 4, phh);
    const sw = (c.w - tw - 30) / 14, cols = ['#000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000', '#fff', '#c0c0c0', '#f00', '#ff0', '#0f0', '#0ff', '#00f', '#f0f', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040'];
    g.fillStyle = '#000'; g.fillRect(c.x + 8, bottom + 6, tw - 14, ph - 12); g.fillStyle = '#fff'; g.fillRect(c.x + 14, bottom + 14, tw - 30, ph - 30);
    cols.forEach((col, i) => { const x = c.x + tw + 6 + (i % 14) * sw, y = bottom + 6 + Math.floor(i / 14) * (ph - 12) / 2; g.fillStyle = col; g.fillRect(x + 1, y + 1, sw - 3, (ph - 12) / 2 - 3); g.strokeStyle = '#555'; g.strokeRect(x + 1, y + 1, sw - 3, (ph - 12) / 2 - 3); raised.push([x + 1, y + 1, x + sw - 2, y + (ph - 12) / 2 - 2, 0.005]); });
    return raised;
  } });

  // ---- Picture and Fax Viewer: Bliss.jpg (our painting), its round buttons raised
  win('viewer-bliss', 'models/viewer-bliss.glb', { w: 0.86, h: 0.66, title: 'Bliss.jpg - Picture and Fax Viewer', icon: I.paint, draw(F, L) {
    const { g } = F, c = L.client, raised = [], bar = c.h * 0.12;
    g.fillStyle = '#eef3fa'; g.fillRect(c.x, c.y, c.w, c.h);
    const pw = c.w * 0.9, ph = (c.h - bar) * 0.86, px = c.x + (c.w - pw) / 2, py = c.y + (c.h - bar - ph) / 2;
    XP.hill(g, px, py, pw, ph, { seed: 7, clouds: 5 }); g.strokeStyle = '#9aa'; g.strokeRect(px, py, pw, ph);
    const s = bar * 0.62, y = c.y + c.h - bar + (bar - s) / 2, icons = [arrow(-1), arrow(1), I.globe, I.computer, I.folder, I.paint, I.question];
    icons.forEach((ic, i) => toolbarIcon(F, c.x + c.w * 0.18 + i * s * 1.55, y, s, ic, '', raised));
    return raised;
  } });

  // ---- a browser's chrome, for the two pages
  const browser = (page, address) => (F, L) => {
    const { g } = F, c = L.client, raised = [], s = sz(F);
    let y = c.y + XP.menubar(g, c, ['File', 'Edit', 'View', 'Favorites', 'Tools', 'Help']);
    const tb = Math.round(c.h * 0.09); g.fillStyle = XP.grad(g, 0, y, 0, y + tb, [[0, '#f8f7f2'], [1, '#e6e3d6']]); g.fillRect(c.x, y, c.w, tb);
    [arrow(-1), arrow(1), I.error, I.globe, I.computer, I.question].forEach((ic, i) => toolbarIcon(F, c.x + 10 + i * tb * 1.05, y + tb * 0.12, tb * 0.7, ic, '', raised));
    y += tb;
    const ab = Math.round(s * 1.9); g.fillStyle = XP.LUNA.body; g.fillRect(c.x, y, c.w, ab);
    XP.text(g, 'Address', c.x + 8, y + ab * 0.66, { size: Math.round(s * 0.85), color: '#666' });
    field(F, c.x + s * 4.4, y + 3, c.w - s * 8.5, ab - 6, address, { size: Math.round(s * 0.9) });
    raised.push(XP.button(g, c.x + c.w - s * 3.6, y + 3, s * 3.2, ab - 6, 'Go').concat([0.005]));
    y += ab;
    const st = status(F, c, ['Done', 'Internet'], { step: 0.7 });
    const P = { x: c.x, y, w: c.w, h: c.y + c.h - st - y };
    g.save(); g.beginPath(); g.rect(P.x, P.y, P.w, P.h); g.clip(); page(F, P, raised, s); g.restore();
    return raised;
  };
  win('browser-bliss', 'models/browser-bliss.glb', { w: 1.0, h: 0.78, title: 'the bliss network - Internet', icon: I.globe, draw: browser((F, P, raised, s) => {
    const g = F.g;
    for (let y = 0; y < P.h; y += 24) for (let x = 0; x < P.w; x += 24) { g.fillStyle = ((x + y) / 24) % 2 ? '#dbe9ff' : '#cfe1ff'; g.fillRect(P.x + x, P.y + y, 24, 24); }
    XP.emblem(g, P.x + 16, P.y + 12, s * 3.6);
    XP.text(g, 'the bliss network', P.x + s * 4.6, P.y + s * 2.9, { size: Math.round(s * 2.1), weight: 'bold', style: 'italic', font: XP.F.big, color: '#5a2fb0', shadow: '#ffd23f', sd: 3 });
    g.fillStyle = '#000'; g.fillRect(P.x + 12, P.y + s * 4.8, P.w - 24, s * 1.6);
    XP.text(g, '*** Welcome! You are visitor number 000137 *** Sign the guestbook! ***', P.x + 20, P.y + s * 5.95, { size: Math.round(s * 0.9), color: '#3f3', font: XP.F.mono, max: P.w - 40 });
    let y = P.y + s * 7.6;
    for (const t of ['Home', 'Hills', 'Clouds', 'Grass', 'Skies', 'Guestbook', 'Webring']) { XP.text(g, t, P.x + 18, y, { size: s, color: '#0000ee' }); g.fillStyle = '#0000ee'; g.fillRect(P.x + 18, y + 3, g.measureText(t).width, 1.5); y += s * 1.7; }
    XP.text(g, 'Today on the network', P.x + P.w * 0.25, P.y + s * 7.6, { size: Math.round(s * 1.2), weight: 'bold', color: '#222' });
    XP.para(g, 'A hill, a sky and you. Pictures of the best hill on the net, updated daily.', P.x + P.w * 0.25, P.y + s * 9.1, P.w * 0.38, { size: Math.round(s * 0.95), color: '#222' });
    const iw = P.w * 0.3, ih = iw * 0.62; XP.hill(g, P.x + P.w * 0.66, P.y + s * 6.9, iw, ih, { seed: 51, mode: 'sunset', clouds: 3 }); g.strokeStyle = '#5a2fb0'; g.lineWidth = 3; g.strokeRect(P.x + P.w * 0.66, P.y + s * 6.9, iw, ih);
    const cy = P.y + P.h - s * 2.6; for (let x = 0; x < P.w * 0.6; x += 28) { g.fillStyle = (x / 28) % 2 ? '#111' : '#ffd400'; g.beginPath(); g.moveTo(P.x + P.w * 0.25 + x, cy); g.lineTo(P.x + P.w * 0.25 + x + 28, cy); g.lineTo(P.x + P.w * 0.25 + x + 14, cy + s * 1.4); g.lineTo(P.x + P.w * 0.25 + x - 14, cy + s * 1.4); g.fill(); }
    XP.text(g, 'UNDER CONSTRUCTION', P.x + P.w * 0.25 + P.w * 0.3, cy - s * 0.4, { size: Math.round(s * 0.95), weight: 'bold', align: 'center', color: '#c00' });
  }, 'http://bliss.network/') });
  win('search-outside', 'models/search-outside.glb', { w: 1.06, h: 0.82, title: 'how to go outside - Search - Internet', icon: I.globe, draw: browser((F, P, raised, s) => {
    const g = F.g;
    g.fillStyle = '#fff'; g.fillRect(P.x, P.y, P.w, P.h);
    XP.emblem(g, P.x + 16, P.y + 10, s * 2.6);
    XP.text(g, 'Search', P.x + s * 3.5, P.y + s * 2.5, { size: Math.round(s * 2), weight: 'bold', style: 'italic', font: XP.F.big, color: '#1d4fcf' });
    let x = P.x + s * 12; for (const t of ['Web', 'Images', 'Groups', 'Directory', 'News']) x += XP.text(g, t, x, P.y + s * 1.6, { size: Math.round(s * 0.85), color: '#0000cc' }) + s * 1.2;
    field(F, P.x + s * 12, P.y + s * 2.2, P.w * 0.42, s * 1.9, 'how to go outside', { size: s });
    raised.push(XP.button(g, P.x + s * 12 + P.w * 0.43, P.y + s * 2.2, s * 5, s * 1.9, 'Search').concat([0.006]));
    g.fillStyle = '#e5ecf9'; g.fillRect(P.x, P.y + s * 4.6, P.w, s * 1.6); XP.text(g, 'Results 1 - 10 of about 4,200,000 for how to go outside.', P.x + 10, P.y + s * 5.75, { size: Math.round(s * 0.85), color: '#000' });
    let y = P.y + s * 7.6;
    for (const [t, d, u] of [['Outside - the place with the grass', 'Doors open from the inside too. The sky comes free.', 'www.outside.example/'], ['10 easy steps to going outside (2001)', 'Step 1: stand up. Step 2: find the door. The rest is optional.', 'www.steps2001.example/'], ['Is the hill on the wallpaper real?', 'Yes. It is a real place, and you can stand on it.', 'www.bliss-hill.example/']]) {
      XP.text(g, t, P.x + 12, y, { size: Math.round(s * 1.05), weight: 'bold', color: '#0000cc', max: P.w - 24 }); g.fillStyle = '#0000cc'; g.fillRect(P.x + 12, y + 3, Math.min(P.w - 24, g.measureText(t).width), 1.5);
      XP.text(g, d, P.x + 12, y + s * 1.25, { size: Math.round(s * 0.9), color: '#000', max: P.w - 24 });
      XP.text(g, u + ' - 4k - Cached', P.x + 12, y + s * 2.4, { size: Math.round(s * 0.85), color: '#008000', max: P.w - 24 });
      y += s * 3.6;
    }
    const iw = (P.w - 60) / 3, ih = Math.min(iw * 0.6, P.y + P.h - y - s * 2);
    [['hill_day.jpg', 'day', 61], ['bliss.bmp', 'day', 7], ['on_the_hill.jpg', 'sunset', 71]].forEach(([n, m, sd], i) => { const ix = P.x + 12 + i * (iw + 18); XP.hill(g, ix, y - s * 0.4, iw, ih, { mode: m, seed: sd, clouds: 2 }); g.strokeStyle = '#0000cc'; g.lineWidth = 2; g.strokeRect(ix, y - s * 0.4, iw, ih); XP.text(g, n, ix + iw / 2, y + ih + s * 0.5, { size: Math.round(s * 0.8), align: 'center', color: '#0000cc' }); raised.push([ix, y - s * 0.4, ix + iw, y - s * 0.4 + ih, 0.006]); });
  }, 'http://search.example/?q=how+to+go+outside') });

  // ---- Task Manager: clippy.exe at 100 % CPU
  win('task-manager', 'models/task-manager.glb', { w: 0.62, h: 0.78, title: 'Task Manager', icon: I.computer, draw(F, L) {
    const { g } = F, c = L.client, s = sz(F), raised = [];
    let y = c.y + XP.menubar(g, c, ['File', 'Options', 'View', 'Shut Down', 'Help']) + 6;
    let x = c.x + 8;
    for (const [t, on] of [['Applications'], ['Processes', 1], ['Performance'], ['Networking'], ['Users']]) { g.font = `${Math.round(s * 0.82)}px ${XP.F.ui}`; const tw = g.measureText(t).width + s; g.fillStyle = on ? '#fff' : '#f4f3ee'; XP.rr(g, x, y + (on ? 0 : 3), tw, s * 1.6, [4, 4, 0, 0]); g.fill(); g.strokeStyle = on ? '#e6a53a' : '#919b9c'; g.lineWidth = on ? 2 : 1; g.stroke(); XP.text(g, t, x + s * 0.5, y + s * 1.15, { size: Math.round(s * 0.82), color: '#000' }); x += tw + 2; }
    y += s * 1.6;
    const lx = c.x + 10, lw = c.w - 20, lh = c.h - (y - c.y) - s * 6.5;
    g.fillStyle = '#fff'; g.fillRect(lx, y + 6, lw, lh); g.strokeStyle = '#7f9db9'; g.strokeRect(lx, y + 6, lw, lh);
    const cols = [[0, 'Image Name'], [0.36, 'User Name'], [0.62, 'CPU'], [0.76, 'Mem Usage']];
    g.fillStyle = XP.grad(g, 0, y + 6, 0, y + 6 + s * 1.5, [[0, '#fff'], [1, '#ebeadb']]); g.fillRect(lx + 1, y + 7, lw - 2, s * 1.5);
    for (const [k, t] of cols) XP.text(g, t, lx + 6 + k * lw, y + 6 + s * 1.1, { size: Math.round(s * 0.8), color: '#000' });
    let ry = y + 6 + s * 2.6; const R = XP.rng(33);
    for (let i = 0; i < 13; i++) {
      const name = i === 9 ? 'grass.exe' : 'clippy.exe', user = i === 9 ? 'You' : 'Clippy', cpu = i === 0 ? '100' : '00', mem = (24000 + Math.floor(R() * 30000)).toLocaleString('en-GB') + ' K';
      if (i === 0) { g.fillStyle = '#316ac5'; g.fillRect(lx + 2, ry - s * 0.95, lw - 4, s * 1.25); }
      for (const [k, t] of [[0, name], [0.36, user], [0.62, cpu], [0.76, mem]]) XP.text(g, t, lx + 6 + k * lw, ry, { size: Math.round(s * 0.8), color: i === 0 ? '#fff' : '#000' });
      ry += s * 1.32; if (ry > y + lh) break;
    }
    const by = y + 6 + lh + 8;
    g.fillStyle = '#fff'; g.fillRect(lx, by + 4, s * 0.9, s * 0.9); g.strokeStyle = '#1c5180'; g.strokeRect(lx, by + 4, s * 0.9, s * 0.9); g.strokeStyle = '#21a121'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(lx + 3, by + 4 + s * 0.45); g.lineTo(lx + s * 0.38, by + 4 + s * 0.8); g.lineTo(lx + s * 0.8, by + 8); g.stroke();
    XP.text(g, 'Show processes from all users', lx + s * 1.3, by + s * 1.1, { size: Math.round(s * 0.8), color: '#000' });
    raised.push(XP.button(g, lx + lw - s * 7.5, by, s * 7.5, s * 1.9, 'End Process').concat([0.007]));
    status(F, c, ['Processes: 73', 'CPU Usage: 100%', 'Commit Charge: 1024M'], { step: 0.3 });
    return raised;
  } });

  // ---- Remote Assistance: Clippy asks
  win('remote-assistance', 'models/remote-assistance.glb', { w: 0.62, h: 0.34, title: 'Remote Assistance', icon: I.network, buttons: ['close'], draw(F, L) {
    const { g } = F, c = L.client, s = sz(F) * 1.1, raised = [];
    I.network(g, c.x + 14, c.y + 14, s * 3);
    let y = XP.para(g, 'Clippy would like to share control of your computer to help solve the problem.', c.x + s * 4, c.y + s * 1.6, c.w - s * 4.6, { size: Math.round(s), color: '#000' });
    XP.para(g, 'Do you want to let Clippy share control?', c.x + s * 4, y + s * 0.6, c.w - s * 4.6, { size: Math.round(s), weight: 'bold', color: '#000' });
    const bw = c.w * 0.2, bh = s * 1.9, by = c.y + c.h - bh - 12;
    raised.push(XP.button(g, c.x + c.w * 0.5 - bw - 6, by, bw, bh, 'Yes', { def: true }).concat([0.007]), XP.button(g, c.x + c.w * 0.5 + 6, by, bw, bh, 'No').concat([0.007]));
    return raised;
  } });

  // ---- Turn off computer: Stand By, Turn Off, Restart as round raised buttons (not a Luna window: its own look)
  XP.part('turn-off', { file: 'models/turn-off.glb', build() {
    const w = 0.66, h = 0.46, F = XP.face(w, h, 704, { back: '#0b2f8a' }), { g, W, fh } = F, parts = [];
    const top = fh * 0.2, bot = fh * 0.8;
    g.fillStyle = XP.grad(g, 0, 0, 0, top, [[0, '#0a3fb5'], [1, '#0b2f8a']]); g.fillRect(0, 0, W, top);
    XP.text(g, 'Turn off computer', W * 0.05, top * 0.65, { size: Math.round(top * 0.42), color: '#fff' });
    XP.emblem(g, W - top * 0.95, top * 0.15, top * 0.7);
    g.fillStyle = XP.grad(g, 0, top, 0, bot, [[0, '#6c93ec'], [0.5, '#4f7be4'], [1, '#2f5fd6']]); g.fillRect(0, top, W, bot - top);
    g.fillStyle = XP.grad(g, 0, 0, W, 0, [[0, 'rgba(255,255,255,0.1)'], [0.5, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0.1)']]); g.fillRect(0, top, W, 2);
    g.fillStyle = XP.grad(g, 0, bot, 0, fh, [[0, '#0b2f8a'], [1, '#0a2470']]); g.fillRect(0, bot, W, fh - bot);
    const bs = (bot - top) * 0.42;
    [['Stand By', ['#ffe07a', '#d9a20d'], 'moon'], ['Turn Off', ['#ff9c7a', '#d33a14'], 'power'], ['Restart', ['#9fe08a', '#2a9a2a'], 'turn']].forEach(([t, col, k], i) => {
      const cx = W * (0.22 + i * 0.28), cy = top + (bot - top) * 0.42, x = cx - bs / 2, y = cy - bs / 2;
      g.fillStyle = XP.grad(g, 0, y, 0, y + bs, [[0, col[0]], [1, col[1]]]); g.beginPath(); g.arc(cx, cy, bs / 2, 0, Math.PI * 2); g.fill(); g.lineWidth = bs * 0.05; g.strokeStyle = '#fff'; g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = bs * 0.1; g.lineCap = 'round'; g.beginPath();
      if (k === 'power') { g.arc(cx, cy + bs * 0.04, bs * 0.22, -Math.PI * 0.3, Math.PI * 1.3); g.moveTo(cx, cy - bs * 0.28); g.lineTo(cx, cy); }
      else if (k === 'moon') { g.arc(cx, cy, bs * 0.22, Math.PI * 0.6, Math.PI * 1.9); g.stroke(); g.beginPath(); g.fillStyle = col[0]; }
      else { g.arc(cx, cy, bs * 0.22, Math.PI * 1.7, Math.PI * 1.2); g.moveTo(cx + bs * 0.12, cy - bs * 0.32); g.lineTo(cx + bs * 0.13, cy - bs * 0.2); }
      g.stroke();
      XP.text(g, t, cx, top + (bot - top) * 0.88, { size: Math.round((bot - top) * 0.11), align: 'center', color: '#fff' });
      parts.push(XP.subSlab(F, x, y, x + bs, y + bs, 0.012, F.w * bs / W / 2 - 0.0001, 0.03, 0.004));
    });
    const cb = XP.button(g, W * 0.76, bot + (fh - bot) * 0.22, W * 0.18, (fh - bot) * 0.56, 'Cancel');
    parts.unshift(XP.slab(F, 0.03, { r: [0.01, 0.01, 0.01, 0.01] }));
    parts.push(XP.raise(F, cb[0], cb[1], cb[2], cb[3], 0.006, 0.03));
    const geo = XP.merge(parts); parts.forEach(p => p.dispose());
    return { root: XP.group('turn-off', XP.mesh(geo, XP.flat(XP.tex(F.cv)), 'turn-off')) };
  } });

  // ---- the error: the cursor stumbled (our own words, not the old error report's)
  win('error-cursor', 'models/error-cursor.glb', { w: 0.68, h: 0.34, title: 'Cursor', icon: I.error, buttons: ['close'], draw(F, L) {
    const { g } = F, c = L.client, s = sz(F) * 1.05, raised = [];
    g.fillStyle = '#fff'; g.fillRect(c.x, c.y, c.w, c.h * 0.48);
    I.error(g, c.x + 14, c.y + 12, s * 2.4);
    XP.para(g, 'Cursor stumbled and has to stop for a moment. Sorry about that.', c.x + s * 3.4, c.y + s * 1.4, c.w - s * 4, { size: Math.round(s), weight: 'bold', color: '#000' });
    XP.para(g, 'Tell your desktop what happened? We wrote it all down on a little note for you.', c.x + 14, c.y + c.h * 0.48 + s * 1.5, c.w - 28, { size: Math.round(s * 0.9), color: '#000' });
    const bh = s * 1.9, by = c.y + c.h - bh - 10;
    raised.push(XP.button(g, c.x + c.w - s * 16.5, by, s * 9.5, bh, 'Send the note', { def: true }).concat([0.007]), XP.button(g, c.x + c.w - s * 6.5, by, s * 6, bh, 'Keep it').concat([0.007]));
    return raised;
  } });

  // ---- windows named by the video's short phrases
  win('win-grass', 'models/win-grass.glb', { w: 0.82, h: 0.58, title: 'Go touch the grass', icon: I.paint, draw(F, L) { const c = L.client; XP.meadow(F.g, c.x, c.y, c.w, c.h, 13); return []; } });
  const typed = (name, file, words, w) => win(name, file, { w, h: 0.2, title: words + ' |', icon: I.note, bar: Math.round(XP.clamp(Math.round(w * 900 / 64) * 64, 256, 1024) * 0.1), draw(F, L) { const { g } = F, c = L.client; g.fillStyle = '#fff'; g.fillRect(c.x + 6, c.y + 6, c.w - 12, c.h - 12); g.strokeStyle = '#7f9db9'; g.strokeRect(c.x + 6, c.y + 6, c.w - 12, c.h - 12); return []; } });
  typed('win-close-all', 'models/win-close-all.glb', 'Close all your windows', 0.74);
  typed('win-real-place', 'models/win-real-place.glb', 'Bliss is a real place', 0.7);
})();
