// The screens: the boot screen with its running blocks, the welcome screen, "It's now safe to turn off your computer."
// and the painted wallpaper for AR walls. Our own emblem and word, never another's logo or wordmark.
(function () {
  const T = THREE;

  // a small box whose faces all show one rectangle of a picture (u0, v0, u1, v1), chamfered (a progress block, a chip)
  XP.chip = (w, h, d, uvr, ch) => {
    const c = Math.min(ch === undefined ? d * 0.5 : ch, w * 0.3, h * 0.3), x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2, P = [];
    const A = [[x0 + c, y0 + c], [x1 - c, y0 + c], [x1 - c, y1 - c], [x0 + c, y1 - c]], B = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const quad = (a, b, cc, dd) => P.push(...a, ...b, ...cc, ...a, ...cc, ...dd);
    quad([...A[0], d], [...A[1], d], [...A[2], d], [...A[3], d]);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad([...B[i], 0], [...B[j], 0], [...A[j], d], [...A[i], d]); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
    return XP.paint(g, (x, y, z, nx, ny, nz) => [uvr[0] + (XP.clamp(x, x0, x1) - x0) / w * (uvr[2] - uvr[0]), uvr[1] + (XP.clamp(y, y0, y1) - y0) / h * (uvr[3] - uvr[1]), XP.shade(nx, ny, nz)]);
  };

  // ---- the boot screen: black, the emblem and "bliss", a track whose three blue blocks run along it (clip Boot)
  XP.part('boot', { file: 'models/boot-screen.glb', build() {
    const w = 1.2, h = 0.72, F = XP.face(w, h, 1024, { back: '#202020' }), { g, W, fh } = F;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, fh);
    const es = fh * 0.22, ex = W * 0.5 - es * 1.55, ey = fh * 0.3;
    XP.emblem(g, ex, ey, es);
    XP.text(g, 'bliss', ex + es * 1.18, ey + es * 0.82, { size: Math.round(es * 0.95), style: 'italic', weight: 'bold', font: XP.F.big, color: '#fff' });
    XP.text(g, 'starting up', W * 0.5, fh * 0.93, { size: Math.round(fh * 0.03), align: 'center', color: '#8a8a8a' });
    // the track: a rounded outline, black inside
    const tw = W * 0.2, th = fh * 0.04, tx = (W - tw) / 2, ty = fh * 0.72;
    g.fillStyle = '#000'; XP.rr(g, tx, ty, tw, th, th * 0.3); g.fill(); g.lineWidth = Math.max(2, th * 0.1); g.strokeStyle = '#b3b3b3'; g.stroke();
    // (a block's colours, in the strip under the face, for the blocks' own faces)
    g.fillStyle = XP.grad(g, 0, fh, 0, fh + 8, [[0, '#a8c4ff'], [0.3, '#3c6cff'], [1, '#0a2fc8']]); g.fillRect(40, fh, 40, 8);
    const parts = [XP.slab(F, 0.03, { r: [0.012, 0.012, 0.012, 0.012] })];
    const geo = XP.merge(parts); parts.forEach(p => p.dispose());
    const mat = XP.flat(XP.tex(F.cv));
    const root = XP.group('boot', XP.mesh(geo, mat, 'screen'));
    // the blocks: three, each its own node (one geometry, one material), running through the track and narrowing into
    // its ends, so they come out of the left and go into the right as on the real screen
    const [tx0] = F.px(tx + th * 0.25, 0), [tx1] = F.px(tx + tw - th * 0.25, 0), [, tyc] = F.px(0, ty + th / 2);
    const bw = (th * 0.85) / W * w, bh = (th * 0.7) / fh * h, L = tx1 - tx0;
    const uvr = [41 / W, 1 - (fh + 7) / F.H, 79 / W, 1 - (fh + 1) / F.H];
    const chip = XP.chip(bw, bh, 0.006, uvr, 0.002);
    const tracks = [], P = 2.2;
    for (let i = 0; i < 3; i++) {
      const node = XP.mesh(chip, mat, 'block' + i);
      node.position.set(tx0, tyc, 0.03);
      root.add(node);
      const ph = i * bw * 1.25 / (L + bw), tw0 = (1 - ph) * P;   // (behind one another, a little apart; tw0: when it wraps)
      const keys = new Set();
      for (let k = 0; k <= 66; k++) keys.add(+(k / 66 * P).toFixed(4));
      if (tw0 < P - 1e-3) { keys.add(+tw0.toFixed(4)); keys.add(+(tw0 + 1e-3).toFixed(4)); }
      const ts = [...keys].sort((a, b) => a - b), pos = [], sc = [];
      for (const t of ts) {
        const a = t / P + ph; let u = a - Math.floor(a);
        if (t > 0 && u < 1e-4) u = 1;   // (at the wrap itself still at the right end: it jumps back unseen)
        const x = tx0 + u * L, s = Math.max(0.001, Math.min(1, u * L / bw * 1.6, (1 - u) * L / bw * 1.6));
        pos.push([x, tyc, 0.03]); sc.push([s, 1, 1]);
      }
      tracks.push(XP.vTrack('block' + i, 'position', ts, pos), XP.vTrack('block' + i, 'scale', ts, sc));
    }
    return { root, clips: [new T.AnimationClip('Boot', P, tracks)] };
  } });

  // ---- the welcome screen: the duck "You" and Clippy as the users, the emblem, Turn off computer
  XP.part('welcome', { file: 'models/welcome-screen.glb', build() {
    const raised = [];
    const mesh = XP.panel({ w: 1.6, h: 0.96, W: 1024, d: 0.03, r: 0.012, back: '#1b3f9a', name: 'welcome', draw(F) {
      const { g, W, fh } = F, top = fh * 0.12, bot = fh * 0.86;
      g.fillStyle = XP.grad(g, 0, 0, W, 0, [[0, '#5a7edc'], [0.5, '#6f8fe4'], [1, '#4a6fd6']]); g.fillRect(0, 0, W, fh);
      g.fillStyle = '#00309c'; g.fillRect(0, 0, W, top); g.fillRect(0, bot, W, fh - bot);
      g.fillStyle = XP.grad(g, 0, 0, W, 0, [[0, 'rgba(255,255,255,0.1)'], [0.3, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0.1)']]); g.fillRect(0, top - 3, W, 3);
      g.fillStyle = XP.grad(g, 0, 0, W, 0, [[0, 'rgba(255,160,40,0.2)'], [0.3, '#ff9b2f'], [1, 'rgba(255,160,40,0.2)']]); g.fillRect(0, bot, W, 3);
      // the line down the middle, fading at its ends
      g.fillStyle = XP.grad(g, 0, top, 0, bot, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.75)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(W * 0.5, top + 20, 2, bot - top - 40);
      // the left: the emblem and its word (the big "welcome back." stands in front of it in 3D), the hint
      const es = fh * 0.12;
      XP.emblem(g, W * 0.12, fh * 0.2, es);
      XP.text(g, 'bliss', W * 0.12 + es * 1.15, fh * 0.2 + es * 0.78, { size: Math.round(es * 0.8), style: 'italic', weight: 'bold', font: XP.F.big, color: '#fff' });
      XP.text(g, 'To begin, click your user name', W * 0.46, fh * 0.66, { size: Math.round(fh * 0.034), align: 'right', color: '#fff' });
      // the right: two users
      const tile = (y, name, line, pic, sel) => {
        const x = W * 0.54, tw = W * 0.4, th = fh * 0.19;
        if (sel) { g.fillStyle = XP.grad(g, x, 0, x + tw, 0, [[0, '#00309c'], [1, 'rgba(0,48,156,0)']]); XP.rr(g, x, y, tw, th, th * 0.18); g.fill(); }
        const ps = th * 0.8, px = x + th * 0.1, py = y + th * 0.1;
        g.fillStyle = '#fff'; XP.rr(g, px, py, ps, ps, ps * 0.12); g.fill();
        g.lineWidth = ps * 0.05; g.strokeStyle = sel ? '#ffc23a' : '#cfd8f0'; g.stroke();
        g.save(); XP.rr(g, px + ps * 0.06, py + ps * 0.06, ps * 0.88, ps * 0.88, ps * 0.08); g.clip();
        g.fillStyle = XP.grad(g, 0, py, 0, py + ps, [[0, '#cfe6ff'], [1, '#7fb0f0']]); g.fillRect(px, py, ps, ps); pic(g, px + ps * 0.1, py + ps * 0.08, ps * 0.8); g.restore();
        XP.text(g, name, px + ps * 1.2, y + th * 0.45, { size: Math.round(th * 0.24), color: '#fff' });
        if (line) XP.text(g, line, px + ps * 1.2, y + th * 0.72, { size: Math.round(th * 0.14), color: '#d8e4ff' });
        raised.push([x, y, x + tw, y + th, 0.008]);
      };
      tile(fh * 0.26, 'You', '', XP.icons.duck, true);
      tile(fh * 0.5, 'Clippy', '2 programs running', XP.icons.clippy, false);
      // the foot: Turn off computer, and a line of our own
      const bs = fh * 0.06, bx = W * 0.04, by = bot + (fh - bot - bs) / 2;
      g.fillStyle = XP.grad(g, 0, by, 0, by + bs, [[0, '#ff9a7a'], [1, '#d5361a']]); XP.rr(g, bx, by, bs, bs, bs * 0.2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = bs * 0.1; g.beginPath(); g.arc(bx + bs / 2, by + bs * 0.55, bs * 0.26, -Math.PI * 0.3, Math.PI * 1.3); g.moveTo(bx + bs / 2, by + bs * 0.2); g.lineTo(bx + bs / 2, by + bs * 0.52); g.stroke();
      XP.text(g, 'Turn off computer', bx + bs * 1.3, by + bs * 0.7, { size: Math.round(bs * 0.5), color: '#fff' });
      raised.push([bx, by, bx + bs, by + bs, 0.006]);
      XP.text(g, 'After you log on, the grass is still there.', W * 0.96, by + bs * 0.4, { size: Math.round(fh * 0.022), align: 'right', color: '#c8d6ff' });
      XP.text(g, 'Go outside now and then.', W * 0.96, by + bs * 0.95, { size: Math.round(fh * 0.022), align: 'right', color: '#c8d6ff' });
      return raised;
    } });
    return { root: XP.group('welcome', mesh) };
  } });

  // ---- "It's now safe to turn off your computer.": orange letters standing off a black slab (no picture at all)
  XP.part('safe-off', { file: 'models/safe-off.glb', build() {
    const w = 1.1, h = 0.5, d = 0.03;
    const slab = XP.extrude(XP.rrShape(w - 0.012, h - 0.012, 0.01), d, 0.006, (x, y, z, nx, ny, nz) => [0, 0, XP.shade(nx, ny, nz) * (nz > 0.9 ? 0.05 : 0.18), [1, 1, 1]], { curve: 4 });
    const parts = [slab], col = [1, 0.58, 0.1];
    // (both lines one size, the longer filling 88 % of the slab's width)
    const lines = [["It's now safe to turn off", 0.075], ['your computer.', -0.085]].map(([s, y]) => [XP.textShapes(s, `bold $px ${XP.F.ui}`, 0.1, { tol: 1.4, px: 140 }), y]);
    const k = Math.min(1, w * 0.88 / Math.max(...lines.map(([T]) => T.box.max.x - T.box.min.x)));
    for (const [{ shapes, box }, y] of lines) {
      const t = XP.extrude(shapes, 0.012, 0, (x, yy, z, nx, ny, nz) => [0, 0, XP.shade(nx, ny, nz), col]);
      t.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, 0); t.scale(k, k, 1); t.translate(0, y, d);
      parts.push(t);
    }
    const geo = XP.merge(parts, { bare: true }); parts.forEach(p => p.dispose());
    return { root: XP.group('safe', XP.mesh(geo, XP.flat(null), 'safe')) };
  } });

  // ---- the wallpaper for a wall in AR: our painted hill in a slim dark bezel
  XP.part('wallpaper', { file: 'models/wallpaper.glb', build() {
    const mesh = XP.panel({ w: 3.0, h: 1.69, W: 1024, d: 0.035, r: 0.02, back: '#1a1d22', name: 'wallpaper', draw(F) {
      const { g, W, fh } = F, b = Math.round(W * 0.014);
      g.fillStyle = '#16191e'; g.fillRect(0, 0, W, fh);
      XP.hill(g, b, b, W - 2 * b, fh - 2 * b, { seed: 21, clouds: 7 });
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; g.strokeRect(b - 1, b - 1, W - 2 * b + 2, fh - 2 * b + 2);
      return [];
    } });
    return { root: XP.group('wallpaper', mesh), view: null };
  } });
})();
