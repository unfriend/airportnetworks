// The taskbar as separate pieces to place apart (grouped in layout.json): the glossy blue bar, the green start button,
// quick launch, the task buttons, the tray with its clock; and the Start menu above the start button.
(function () {
  const T = THREE;
  // a piece of a face cut out as a slab of its own (px0..py1 in the face's pixels), its picture where it lies on the face
  XP.subSlab = (F, px0, py0, px1, py1, d, r, z0, bevel) => {
    const [x0, y1] = F.px(px0, py0), [x1, y0] = F.px(px1, py1), b = bevel === undefined ? Math.min(0.004, d / 3) : bevel;
    const sh = XP.rrShape(x1 - x0 - 2 * b, y1 - y0 - 2 * b, (Array.isArray(r) ? r : [r, r, r, r]).map(v => Math.max(0, v - b)));
    const g = XP.extrude(sh, d, b, (x, y, z, nx, ny, nz) => (nz < -0.6 ? [...F.back, 0.55] : [...F.uv(x + (x0 + x1) / 2, y + (y0 + y1) / 2), XP.shade(nx, ny, nz)]), { curve: 4 });
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, z0 || 0);
    return g;
  };
  const BAR = [[0, '#3f8cf3'], [0.08, '#2a6ee8'], [0.15, '#245edb'], [0.85, '#1f56d2'], [1, '#163d9c']];
  const one = (F, parts, name) => { const geo = XP.merge(parts); parts.forEach(p => p.dispose()); return XP.mesh(geo, XP.flat(XP.tex(F.cv)), name); };

  XP.part('taskbar-bar', { file: 'models/taskbar-bar.glb', build() {
    const mesh = XP.panel({ w: 3.0, h: 0.14, W: 1024, d: 0.025, r: 0.006, back: '#163d9c', name: 'bar', draw(F) {
      const { g, W, fh } = F; g.fillStyle = XP.grad(g, 0, 0, 0, fh, BAR); g.fillRect(0, 0, W, fh); return [];
    } });
    return { root: XP.group('taskbar-bar', mesh) };
  } });

  XP.part('taskbar-start', { file: 'models/taskbar-start.glb', build() {
    const w = 0.42, h = 0.14, F = XP.face(w, h, 512, { back: '#1d6e1d' }), { g, W, fh } = F;
    g.fillStyle = XP.grad(g, 0, 0, 0, fh, [[0, '#7fd17f'], [0.12, '#4caf4c'], [0.5, '#3a9b3a'], [0.9, '#2f8a2f'], [1, '#1d6e1d']]); g.fillRect(0, 0, W, fh);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, fh * 0.06, W, fh * 0.08);
    XP.emblem(g, fh * 0.2, fh * 0.2, fh * 0.6);
    XP.text(g, 'start', fh * 1.0, fh * 0.72, { size: Math.round(fh * 0.62), style: 'italic', weight: 'bold', font: XP.F.big, color: '#fff', shadow: 'rgba(0,40,0,0.7)', sd: 3 });
    const r = h * 0.5, body = XP.slab(F, 0.035, { r: [0.004, r, r, 0.004], curve: 8 }), mesh = one(F, [body], 'start');
    return { root: XP.group('taskbar-start', mesh) };
  } });

  XP.part('taskbar-quick', { file: 'models/taskbar-quick.glb', build() {
    const raised = [], mesh = XP.panel({ w: 0.3, h: 0.11, W: 512, d: 0.02, r: 0.006, back: '#163d9c', name: 'quick', draw(F) {
      const { g, W, fh } = F; g.fillStyle = XP.grad(g, 0, 0, 0, fh, BAR); g.fillRect(0, 0, W, fh);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(6, fh * 0.15, 3, fh * 0.7);
      [XP.icons.computer, XP.icons.globe, XP.icons.play].forEach((ic, i) => { const s = fh * 0.66, x = 30 + i * W * 0.31, y = (fh - s) / 2; ic(g, x, y, s); raised.push([x - 4, y - 4, x + s + 4, y + s + 4, 0.008]); });
      return raised;
    } });
    return { root: XP.group('taskbar-quick', mesh) };
  } });

  XP.part('taskbar-tasks', { file: 'models/taskbar-tasks.glb', build() {
    const w = 1.62, h = 0.11, F = XP.face(w, h, 1024, { back: '#163d9c' }), { g, W, fh } = F, parts = [], bw = W / 3;
    [['Clippy - Conversation', XP.icons.clippy, true], ['diary.txt - Notepad', XP.icons.note], ['hill.bmp - Paint', XP.icons.paint]].forEach(([t, ic, on], i) => {
      const x = i * bw + 4, x1 = x + bw - 8;
      g.fillStyle = XP.grad(g, 0, 0, 0, fh, on ? [[0, '#1e52b7'], [1, '#1846a8']] : [[0, '#5f9cf8'], [0.1, '#3c81f3'], [0.9, '#2d6ee3'], [1, '#1d58c8']]);
      g.fillRect(x, 0, x1 - x, fh);
      ic(g, x + fh * 0.18, fh * 0.17, fh * 0.66);
      XP.text(g, t, x + fh * 1.0, fh * 0.64, { size: Math.round(fh * 0.4), color: '#fff', max: x1 - x - fh * 1.15 });
      parts.push(XP.subSlab(F, x, 0, x1, fh, on ? 0.016 : 0.024, 0.008));
    });
    return { root: XP.group('taskbar-tasks', one(F, parts, 'tasks')) };
  } });

  XP.part('taskbar-tray', { file: 'models/taskbar-tray.glb', build() {
    const raised = [], mesh = XP.panel({ w: 0.56, h: 0.14, W: 512, d: 0.028, r: 0.006, back: '#0b5fb0', name: 'tray', draw(F) {
      const { g, W, fh } = F;
      g.fillStyle = XP.grad(g, 0, 0, 0, fh, [[0, '#4fc3ff'], [0.1, '#17a4ef'], [0.85, '#0f8fdd'], [1, '#0b6fb8']]); g.fillRect(0, 0, W, fh);
      g.fillStyle = 'rgba(0,30,90,0.5)'; g.fillRect(0, 0, 3, fh); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(3, 0, 2, fh);
      [XP.icons.speaker, XP.icons.network, XP.icons.shield].forEach((ic, i) => { const s = fh * 0.46, x = 18 + i * s * 1.3, y = (fh - s) / 2; ic(g, x, y, s); raised.push([x - 3, y - 3, x + s + 3, y + s + 3, 0.006]); });
      XP.text(g, '9:41 AM', W - 16, fh * 0.64, { size: Math.round(fh * 0.38), align: 'right', color: '#fff' });
      return raised;
    } });
    return { root: XP.group('taskbar-tray', mesh) };
  } });

  XP.part('start-menu', { file: 'models/start-menu.glb', build() {
    const raised = [];
    const mesh = XP.panel({ w: 0.62, h: 0.82, W: 640, d: 0.03, r: [0.02, 0.02, 0.004, 0.004], back: '#1f4fbf', name: 'start-menu', draw(F) {
      const { g, W, fh } = F, hh = fh * 0.12, fb = fh * 0.09, lw = W * 0.56;
      g.fillStyle = '#1d5cd8'; g.fillRect(0, 0, W, fh);
      g.fillStyle = XP.grad(g, 0, 0, 0, hh, [[0, '#2a74e8'], [0.4, '#1b5fd8'], [1, '#1550c6']]); g.fillRect(0, 0, W, hh);
      const as = hh * 0.74; g.fillStyle = '#fff'; XP.rr(g, hh * 0.13, hh * 0.13, as, as, as * 0.14); g.fill();
      g.save(); XP.rr(g, hh * 0.13 + 4, hh * 0.13 + 4, as - 8, as - 8, as * 0.1); g.clip(); g.fillStyle = '#bfe0ff'; g.fillRect(0, 0, W, hh); XP.icons.duck(g, hh * 0.18, hh * 0.18, as * 0.9); g.restore();
      raised.push([hh * 0.13, hh * 0.13, hh * 0.13 + as, hh * 0.13 + as, 0.008]);
      XP.text(g, 'You', hh * 1.05, hh * 0.64, { size: Math.round(hh * 0.36), weight: 'bold', color: '#fff', shadow: 'rgba(0,0,60,0.6)', sd: 2 });
      g.fillStyle = XP.grad(g, 0, 0, W, 0, [[0, 'rgba(255,140,30,0.2)'], [0.5, '#ff9b2f'], [1, 'rgba(255,140,30,0.2)']]); g.fillRect(0, hh, W, 3);
      g.fillStyle = '#fff'; g.fillRect(4, hh + 3, lw - 4, fh - hh - fb - 3);
      g.fillStyle = '#d3e5fa'; g.fillRect(lw, hh + 3, W - lw - 4, fh - hh - fb - 3);
      g.fillStyle = '#95bdee'; g.fillRect(lw, hh + 3, 2, fh - hh - fb - 3);
      const row = (x, y, ic, t, sub, bold, colw) => { const s = fh * 0.05; ic(g, x, y, s); XP.text(g, t, x + s * 1.3, y + s * (sub ? 0.45 : 0.72), { size: Math.round(fh * 0.026), weight: bold ? 'bold' : '', color: bold ? '#000' : '#1a1a1a', max: colw - s * 1.5 }); if (sub) XP.text(g, sub, x + s * 1.3, y + s * 0.95, { size: Math.round(fh * 0.02), color: '#6d6d6d', max: colw - s * 1.5 }); };
      let y = hh + fh * 0.03;
      row(12, y, XP.icons.globe, 'Internet', 'Browser', true, lw - 20); y += fh * 0.075;
      row(12, y, XP.icons.note, 'E-mail', 'Mail', true, lw - 20); y += fh * 0.08;
      g.fillStyle = '#d6dbe4'; g.fillRect(16, y - fh * 0.012, lw - 32, 2);
      for (const [ic, t] of [[XP.icons.note, 'Notepad'], [XP.icons.paint, 'Paint'], [XP.icons.play, 'Media Player'], [XP.icons.folder, 'Solitaire'], [XP.icons.clippy, 'Clippy'], [XP.icons.computer, 'On-Screen Keyboard']]) { row(12, y, ic, t, '', false, lw - 20); y += fh * 0.064; }
      g.fillStyle = '#d6dbe4'; g.fillRect(16, y, lw - 32, 2);
      XP.text(g, 'All Programs', lw * 0.42, y + fh * 0.05, { size: Math.round(fh * 0.026), weight: 'bold', color: '#000' });
      g.fillStyle = '#3aa63a'; g.beginPath(); const ax = lw * 0.82, ay = y + fh * 0.04; g.moveTo(ax, ay - 10); g.lineTo(ax + 16, ay); g.lineTo(ax, ay + 10); g.closePath(); g.fill();
      y = hh + fh * 0.03;
      for (const [ic, t, b] of [[XP.icons.folder, 'My Documents', 1], [XP.icons.folder, 'My Pictures', 1], [XP.icons.folder, 'My Music', 1], [XP.icons.computer, 'My Computer', 1], [XP.icons.network, 'Network', 0], [XP.icons.shield, 'Control Panel', 0], [XP.icons.question, 'Help and Support', 0], [XP.icons.globe, 'Search', 0], [XP.icons.note, 'Run...', 0]]) { row(lw + 10, y, ic, t, '', b, W - lw - 16); y += fh * 0.066; if (t === 'My Computer') { g.fillStyle = '#a9c6ec'; g.fillRect(lw + 12, y - fh * 0.01, W - lw - 28, 2); y += fh * 0.012; } }
      g.fillStyle = XP.grad(g, 0, fh - fb, 0, fh, [[0, '#2a6ee8'], [1, '#1550c6']]); g.fillRect(0, fh - fb, W, fb);
      const fbtn = (x, col, t) => { const s = fb * 0.56, y0 = fh - fb + (fb - s) / 2; g.fillStyle = col; XP.rr(g, x, y0, s, s, s * 0.2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); XP.text(g, t, x + s * 1.25, y0 + s * 0.72, { size: Math.round(fb * 0.3), color: '#fff' }); raised.push([x, y0, x + s, y0 + s, 0.006]); };
      fbtn(W * 0.36, '#f0a02a', 'Log Off');
      fbtn(W * 0.62, '#e2431e', 'Turn Off Computer');
      return raised;
    } });
    return { root: XP.group('start-menu', mesh) };
  } });
})();
