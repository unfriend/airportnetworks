// Media Player with its visualiser: a dark player whose tall green bars are real 3D bars jumping out of its screen
// (clip Bars: each bar its own node, one geometry and one material for all). Our own playlist.
(function () {
  const T = THREE, I = XP.icons;
  XP.part('media-player', { file: 'models/media-player.glb', build() {
    const raised = [];
    const F = XP.face(0.92, 0.66, 832, { back: '#101a33' });
    const L = XP.luna(F, { title: 'Media Player', icon: I.play, body: '#0b1426' });
    const { g, W, fh } = F, c = L.client, s = Math.round(W * 0.024);
    const side = c.w * 0.17, list = c.w * 0.25, foot = c.h * 0.16;
    g.fillStyle = XP.grad(g, c.x, 0, c.x + side, 0, [[0, '#1d3c86'], [1, '#132a63']]); g.fillRect(c.x, c.y, side, c.h - foot);
    ['Now Playing', 'Library', 'Radio', 'Burn', 'Sync'].forEach((t, i) => { const y = c.y + s * (1.2 + i * 2.2); if (!i) { g.fillStyle = '#3c6fd6'; XP.rr(g, c.x + 4, y - s * 1.1, side - 8, s * 1.7, 4); g.fill(); } XP.text(g, t, c.x + 12, y, { size: Math.round(s * 0.9), weight: i ? '' : 'bold', color: '#fff', max: side - 20 }); });
    const vx = c.x + side + 6, vw = c.w - side - list - 12, vh = c.h - foot - 6;
    g.fillStyle = '#000'; g.fillRect(vx, c.y + 3, vw, vh);
    XP.text(g, 'Bars and Waves: Bars', vx + 8, c.y + vh - 6, { size: Math.round(s * 0.75), color: '#5d7aa8' });
    g.fillStyle = XP.grad(g, c.x + c.w - list, 0, c.x + c.w, 0, [[0, '#14254f'], [1, '#0d1a3a']]); g.fillRect(c.x + c.w - list, c.y, list, c.h - foot);
    XP.text(g, 'Playlist', c.x + c.w - list + 10, c.y + s * 1.3, { size: Math.round(s * 0.95), weight: 'bold', color: '#fff' });
    [['Rolling Hills', '4:20'], ['Blue Sky', '3:41'], ['Clouds', '3:05'], ['Startup Swell', '2:58'], ['Grass', '3:33'], ['Night Shift', '3:12']].forEach(([t, d], i) => {
      const y = c.y + s * (3.2 + i * 1.7); if (!i) { g.fillStyle = '#2d55b5'; g.fillRect(c.x + c.w - list + 4, y - s * 1.1, list - 8, s * 1.5); }
      XP.text(g, t, c.x + c.w - list + 10, y, { size: Math.round(s * 0.82), color: i ? '#c9d6f2' : '#fff', max: list - s * 3.6 }); XP.text(g, d, c.x + c.w - 10, y, { size: Math.round(s * 0.82), align: 'right', color: '#c9d6f2' });
    });
    const fy = c.y + c.h - foot;
    g.fillStyle = XP.grad(g, 0, fy, 0, c.y + c.h, [[0, '#2a3f6e'], [1, '#0f1b38']]); g.fillRect(c.x, fy, c.w, foot);
    g.fillStyle = '#5d7aa8'; g.fillRect(c.x + c.w * 0.05, fy + foot * 0.18, c.w * 0.9, 4); g.fillStyle = '#9fe03a'; g.fillRect(c.x + c.w * 0.05, fy + foot * 0.18, c.w * 0.37, 4);
    const bs = foot * 0.56, by = fy + foot * 0.34;
    [['prev', 0.36], ['play', 0.46], ['stop', 0.57], ['next', 0.66]].forEach(([k, at]) => {
      const S = k === 'play' ? bs * 1.15 : bs * 0.8, x = c.x + c.w * at, y = by + (bs - S) / 2;
      g.fillStyle = XP.grad(g, 0, y, 0, y + S, k === 'play' ? [[0, '#c9f27a'], [1, '#4f9a12']] : [[0, '#dfe8f8'], [1, '#7f93bd']]); g.beginPath(); g.arc(x + S / 2, y + S / 2, S / 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#111'; g.beginPath();
      if (k === 'play') { g.moveTo(x + S * 0.38, y + S * 0.28); g.lineTo(x + S * 0.72, y + S * 0.5); g.lineTo(x + S * 0.38, y + S * 0.72); }
      else if (k === 'stop') g.rect(x + S * 0.32, y + S * 0.32, S * 0.36, S * 0.36);
      else { const d = k === 'next' ? 1 : -1, m = x + S / 2; g.moveTo(m - d * S * 0.22, y + S * 0.3); g.lineTo(m + d * S * 0.08, y + S * 0.5); g.lineTo(m - d * S * 0.22, y + S * 0.7); g.moveTo(m + d * S * 0.12, y + S * 0.3); g.lineTo(m + d * S * 0.18, y + S * 0.3); g.lineTo(m + d * S * 0.18, y + S * 0.7); g.lineTo(m + d * S * 0.12, y + S * 0.7); }
      g.fill(); raised.push([x, y, x + S, y + S, 0.006]);
    });
    // (the bars' green, bright on top, in the strip under the face)
    g.fillStyle = XP.grad(g, 0, fh, 0, fh + 8, [[0, '#f2ffb0'], [0.25, '#b6ff2a'], [1, '#4f9a00']]); g.fillRect(40, fh, 40, 8);
    const parts = [XP.slab(F, 0.03, { r: [L.bar * 0.32 / W * F.w, L.bar * 0.32 / W * F.w, 0.004, 0.004] }), XP.raise(F, L.fr * 0.5, 1, W - L.fr * 0.5, L.bar + L.fr * 0.6, 0.004, 0.03, { chamfer: 0.003 })];
    for (const [, x0, y0, x1, y1] of L.btns) parts.push(XP.raise(F, x0, y0, x1, y1, 0.006, 0.034, { chamfer: 0.0035 }));
    for (const r of raised) parts.push(XP.raise(F, r[0], r[1], r[2], r[3], r[4], 0.03));
    const geo = XP.merge(parts); parts.forEach(p => p.dispose());
    const mat = XP.flat(XP.tex(F.cv)), root = XP.group('media-player', XP.mesh(geo, mat, 'player'));
    // the bars: N nodes, each a bar standing on the screen's foot, its height its scale
    const N = 10, [x0] = F.px(vx + vw * 0.06, 0), [x1] = F.px(vx + vw * 0.94, 0), [, yb] = F.px(0, c.y + vh - s * 1.6), [, yt] = F.px(0, c.y + 3 + vh * 0.06);
    const bw = (x1 - x0) / N * 0.72, bh = yt - yb;
    const bar = XP.chip(bw, bh, 0.05, [41 / W, 1 - (fh + 7) / F.H, 79 / W, 1 - (fh + 1) / F.H], 0.004); bar.translate(0, bh / 2, 0);
    const R = XP.rng(64), tracks = [], P = 2.4, K = 24;
    for (let i = 0; i < N; i++) {
      const name = 'bar' + i, m = XP.mesh(bar, mat, name); m.position.set(x0 + (i + 0.5) * (x1 - x0) / N, yb, 0.03); root.add(m);
      const hs = Array.from({ length: K }, () => 0.15 + R() * 0.85 * (1 - Math.abs(i - N * 0.4) / N * 0.6)); hs.push(hs[0]);
      tracks.push(XP.vTrack(name, 'scale', hs.map((_, k) => +(k / K * P).toFixed(4)), hs.map(h => [1, h, 1])));
      m.scale.set(1, hs[0], 1);
    }
    return { root, clips: [new T.AnimationClip('Bars', P, tracks)] };
  } });
})();
