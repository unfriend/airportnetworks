// The window-drag trail: one dialog smeared into a cascade of twelve copies along a curve that comes out of the wall
// towards you (one texture, one draw: the copies share the picture, merged into one mesh).
(function () {
  const T = THREE, I = XP.icons;
  XP.part('trail', { file: 'models/window-trail.glb', build() {
    const w = 0.5, h = 0.3, F = XP.face(w, h, 512, { back: '#7d93b8' });
    const L = XP.luna(F, { title: 'Close all your |', icon: I.folder, bar: Math.round(512 * 0.075) });
    const { g } = F, c = L.client, s = Math.round(F.W * 0.03);
    XP.menubar(g, c, ['File', 'Edit', 'View', 'Help']);
    g.fillStyle = '#fff'; g.fillRect(c.x + 8, c.y + s * 2, c.w - 16, c.h - s * 2.6);
    ['grass.jpg - Picture and Fax Viewer', 'sky.jpg - Picture and Fax Viewer', 'diary.txt - Notepad', 'hill.bmp - Paint', 'Clippy - Conversation'].forEach((t, i) => { I.note(g, c.x + 14, c.y + s * (2.4 + i * 1.5), s * 1.1); XP.text(g, t, c.x + 14 + s * 1.5, c.y + s * (3.25 + i * 1.5), { size: Math.round(s * 0.85), color: '#000', max: c.w - s * 3 }); });
    const one = [XP.slab(F, 0.02, { r: [L.bar * 0.32 / F.W * w, L.bar * 0.32 / F.W * w, 0.003, 0.003] })];
    for (const [, x0, y0, x1, y1] of L.btns) one.push(XP.raise(F, x0, y0, x1, y1, 0.005, 0.02, { chamfer: 0.003 }));
    const copy = XP.merge(one); one.forEach(p => p.dispose());
    const list = [];
    for (let i = 0; i < 12; i++) {
      const t = i / 11, x = -0.32 + t * 0.62, y = 0.18 - t * 0.34 + Math.sin(t * Math.PI) * 0.06, z = t * 0.42, ry = -0.25 * t;
      list.push(XP.at(copy, x, y, z, 0, ry, 0));
    }
    const geo = XP.merge(list); copy.dispose();
    return { root: XP.group('trail', XP.mesh(geo, XP.flat(XP.tex(F.cv)), 'trail')) };
  } });
})();
