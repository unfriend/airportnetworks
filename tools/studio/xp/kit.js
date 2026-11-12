// The Bliss XP room's kit: what every part (parts/*.js) builds with, in the generator's page (page.html, run by make.mjs).
// Everything here is our own: canvas-drawn pictures, procedural paintings, geometry built in code. A part registers with
// XP.part(name, { file, build }) and build() returns { root, clips } (a THREE.Group, metres, Y up, its front +z; its
// clips' tracks name its nodes). Deterministic: every random number comes from XP.rng(seed).
(function () {
  const T = THREE;
  const XP = window.XP = { parts: {}, order: [] };
  XP.part = (name, def) => { XP.parts[name] = def; XP.order.push(name); };

  // ------------------------------------------------------------ numbers --
  XP.rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  XP.seed = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  XP.clamp = clamp;

  // -------------------------------------------------------------- fonts --
  // (XP drew its title bars in Trebuchet MS bold and the rest in Tahoma: the nearest here are Liberation Sans bold and
  // DejaVu Sans, a wide humanist sans like Tahoma)
  XP.F = { ui: '"DejaVu Sans"', title: '"Liberation Sans"', big: '"Liberation Sans"', mono: '"DejaVu Sans Mono"' };
  XP.fonts = () => Promise.all(['14px "DejaVu Sans"', 'bold 14px "DejaVu Sans"', 'bold 14px "Liberation Sans"', 'italic bold 14px "Liberation Sans"', '14px "Liberation Sans"', '14px "DejaVu Sans Mono"'].map(f => document.fonts.load(f)));

  // -------------------------------------------------------- canvases --
  XP.canvas = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return { cv, g: cv.getContext('2d') }; };
  // a texture from a canvas: opaque ones are written as JPEG (RGBFormat), see-through ones as PNG; drawn as the picture is
  XP.tex = (cv, alpha) => {
    const t = new T.CanvasTexture(cv);
    t.format = alpha ? T.RGBAFormat : T.RGBFormat;
    t.encoding = T.LinearEncoding;
    t.anisotropy = 4;
    return t;
  };
  XP.rr = (g, x, y, w, h, r) => {   // a rounded rectangle's path (r a number or [tl, tr, br, bl])
    const [a, b, c, d] = Array.isArray(r) ? r : [r, r, r, r];
    g.beginPath(); g.moveTo(x + a, y); g.lineTo(x + w - b, y); g.quadraticCurveTo(x + w, y, x + w, y + b); g.lineTo(x + w, y + h - c);
    g.quadraticCurveTo(x + w, y + h, x + w - c, y + h); g.lineTo(x + d, y + h); g.quadraticCurveTo(x, y + h, x, y + h - d); g.lineTo(x, y + a);
    g.quadraticCurveTo(x, y, x + a, y); g.closePath();
  };
  XP.grad = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) gr.addColorStop(o, c); return gr; };
  // text: fitted into a width when asked (made narrower, then smaller), with an optional shadow
  XP.text = (g, s, x, y, o = {}) => {
    const size = o.size || 16;
    g.font = `${o.style || ''} ${o.weight || ''} ${size}px ${o.font || XP.F.ui}`.trim();
    g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'alphabetic';
    let sx = 1;
    if (o.max) { const w = g.measureText(s).width; if (w > o.max) sx = o.max / w; }
    g.save(); g.translate(x, y); g.scale(sx, 1);
    if (o.shadow) { g.fillStyle = o.shadow; g.fillText(s, o.sd || 1.5, o.sd || 1.5); }
    if (o.stroke) { g.lineWidth = o.lw || 2; g.strokeStyle = o.stroke; g.lineJoin = 'round'; g.strokeText(s, 0, 0); }
    g.fillStyle = o.color || '#000'; g.fillText(s, 0, 0);
    g.restore();
    return g.measureText(s).width * sx;
  };
  // words wrapped into lines no wider than w (returns the lines)
  XP.wrap = (g, s, w) => {
    const out = [];
    for (const para of s.split('\n')) {
      let line = '';
      for (const word of para.split(' ')) { const t = line ? line + ' ' + word : word; if (line && g.measureText(t).width > w) { out.push(line); line = word; } else line = t; }
      out.push(line);
    }
    return out;
  };
  XP.para = (g, s, x, y, w, o = {}) => {
    const size = o.size || 16;
    g.font = `${o.style || ''} ${o.weight || ''} ${size}px ${o.font || XP.F.ui}`.trim();
    const lines = XP.wrap(g, s, w), lh = o.lh || size * 1.3;
    lines.forEach((l, i) => XP.text(g, l, x, y + i * lh, o));
    return y + lines.length * lh;
  };

  // ------------------------------------------------------ the paintings --
  // our own rolling green hill under a blue sky with clouds (never the photograph): day, night or sunset
  const SKY = {
    day: ['#1f5fd4', '#3f86e6', '#7db6f0', '#c4e0f8'],
    night: ['#050c2b', '#0d1d55', '#243a86', '#4a5fa8'],
    sunset: ['#2b2468', '#7b3d8e', '#e0708a', '#ffc27a'],
  };
  XP.cloud = (g, cx, cy, w, h, R, o = {}) => {   // a soft painted cloud: overlapping puffs, lit above, a bluish belly
    const n = o.n || 7, puffs = [];
    for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); puffs.push([cx + (t - 0.5) * w * (0.85 + R() * 0.2), cy - Math.sin(t * Math.PI) * h * (0.35 + R() * 0.3), h * (0.38 + R() * 0.3) * (0.6 + Math.sin(t * Math.PI) * 0.6)]); }
    for (const [x, y, r] of puffs) {   // the belly's shade first, a little lower
      const gr = g.createRadialGradient(x, y + r * 0.35, r * 0.1, x, y + r * 0.35, r);
      gr.addColorStop(0, o.shade || 'rgba(160,185,220,0.55)'); gr.addColorStop(1, 'rgba(160,185,220,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y + r * 0.35, r, 0, Math.PI * 2); g.fill();
    }
    for (const [x, y, r] of puffs) {
      const gr = g.createRadialGradient(x - r * 0.2, y - r * 0.3, r * 0.05, x, y, r);
      gr.addColorStop(0, o.light || 'rgba(255,255,255,0.98)'); gr.addColorStop(0.6, o.mid || 'rgba(246,250,255,0.8)'); gr.addColorStop(1, 'rgba(240,246,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  };
  XP.hill = (g, x, y, w, h, o = {}) => {
    const R = XP.rng(o.seed || 7), sky = SKY[o.mode || 'day'];
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = XP.grad(g, 0, y, 0, y + h * 0.7, [[0, sky[0]], [0.35, sky[1]], [0.75, sky[2]], [1, sky[3]]]);
    g.fillRect(x, y, w, h);
    if (o.mode === 'night') for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.7})`; const s = R() < 0.1 ? 2 : 1; g.fillRect(x + R() * w, y + R() * h * 0.55, s * w / 600, s * w / 600); }
    if (o.mode === 'sunset') { const gr = g.createRadialGradient(x + w * 0.72, y + h * 0.56, 0, x + w * 0.72, y + h * 0.56, w * 0.25); gr.addColorStop(0, 'rgba(255,240,190,0.95)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gr; g.fillRect(x, y, w, h); }
    const clouds = o.clouds === undefined ? 5 : o.clouds;
    const cl = o.mode === 'night' ? { light: 'rgba(120,140,200,0.35)', mid: 'rgba(90,110,170,0.2)', shade: 'rgba(20,30,70,0.3)' } : o.mode === 'sunset' ? { light: 'rgba(255,214,200,0.9)', mid: 'rgba(240,170,170,0.6)', shade: 'rgba(120,70,130,0.45)' } : {};
    for (let i = 0; i < clouds; i++) {
      const cw = w * (0.12 + R() * 0.2);
      XP.cloud(g, x + w * (0.05 + R() * 0.9), y + h * (0.1 + R() * 0.32), cw, cw * (0.35 + R() * 0.2), R, cl);
    }
    // the far hill on the right, bluer
    const far = o.mode === 'night' ? ['#16315a', '#0c2140'] : o.mode === 'sunset' ? ['#5d6a3a', '#3a4428'] : ['#6aa24a', '#3f7a33'];
    g.fillStyle = XP.grad(g, 0, y + h * 0.5, 0, y + h * 0.75, [[0, far[0]], [1, far[1]]]);
    g.beginPath(); g.moveTo(x + w * 0.35, y + h); g.bezierCurveTo(x + w * 0.55, y + h * 0.58, x + w * 0.8, y + h * 0.5, x + w, y + h * 0.56); g.lineTo(x + w, y + h); g.closePath(); g.fill();
    // the main hill: a crest left of the middle, a long gentle slope to the right
    const main = o.mode === 'night' ? ['#2f5a2a', '#1a3a1c', '#0d2412'] : o.mode === 'sunset' ? ['#9fae3e', '#5d7a26', '#2f4a17'] : ['#b5e04a', '#5fa82c', '#2e7019'];
    const crest = y + h * (o.crest || 0.5);
    g.fillStyle = XP.grad(g, 0, crest, 0, y + h, [[0, main[0]], [0.35, main[1]], [1, main[2]]]);
    g.beginPath(); g.moveTo(x, y + h * 0.68);
    g.bezierCurveTo(x + w * 0.15, crest + h * 0.02, x + w * 0.32, crest - h * 0.04, x + w * 0.46, crest);
    g.bezierCurveTo(x + w * 0.62, crest + h * 0.05, x + w * 0.85, y + h * 0.66, x + w, y + h * 0.72);
    g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); g.fill();
    // the grass's sheen along the slope and a cloud's shadow drifting over it
    g.save(); g.clip();
    g.globalAlpha = 0.18;
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = R() < 0.5 ? '#e8ff9a' : '#1d4a12'; g.lineWidth = w * (0.002 + R() * 0.004);
      const yy = crest + h * (0.04 + R() * 0.5), xx = x + w * R();
      g.beginPath(); g.moveTo(xx - w * 0.2, yy + h * 0.03); g.quadraticCurveTo(xx, yy - h * 0.03, xx + w * 0.25, yy + h * 0.02); g.stroke();
    }
    g.globalAlpha = 1;
    const sh = g.createRadialGradient(x + w * 0.75, y + h * 0.8, 0, x + w * 0.75, y + h * 0.8, w * 0.3);
    sh.addColorStop(0, 'rgba(0,30,0,0.28)'); sh.addColorStop(1, 'rgba(0,30,0,0)');
    g.fillStyle = sh; g.fillRect(x, y, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,200,0.07)' : 'rgba(0,40,0,0.08)'; g.fillRect(x + R() * w, crest + R() * h * 0.55, w * 0.004, w * 0.004); }
    g.restore();
    g.restore();
  };
  // a meadow close up: blades of grass in greens over a strip of sky
  XP.meadow = (g, x, y, w, h, seed) => {
    const R = XP.rng(seed || 11);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = XP.grad(g, 0, y, 0, y + h, [[0, '#7fbcf2'], [0.25, '#c6e3fa'], [0.3, '#8cc63f'], [1, '#2c6a17']]); g.fillRect(x, y, w, h);
    for (let i = 0; i < 520; i++) {
      const bx = x + R() * w, by = y + h * (0.3 + R() * 0.75), bh = h * (0.08 + R() * 0.3) * (by - y) / h, lean = (R() - 0.5) * bh * 0.6;
      const c = 90 + R() * 120 | 0;
      g.strokeStyle = `rgb(${c * 0.45 | 0},${c},${c * 0.25 | 0})`; g.lineWidth = w * (0.002 + R() * 0.004); g.lineCap = 'round';
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + lean * 0.3, by - bh * 0.6, bx + lean, by - bh); g.stroke();
    }
    g.restore();
  };
  // the emblem: a little green hill under a blue sky in a rounded square (ours, never another's logo)
  XP.emblem = (g, x, y, s) => {
    g.save(); XP.rr(g, x, y, s, s, s * 0.22); g.clip();
    XP.hill(g, x, y, s, s, { clouds: 1, seed: 3, crest: 0.48 });
    g.restore();
    g.save(); XP.rr(g, x, y, s, s, s * 0.22); g.lineWidth = s * 0.04; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.stroke(); g.restore();
    const hl = g.createLinearGradient(0, y, 0, y + s * 0.5); hl.addColorStop(0, 'rgba(255,255,255,0.45)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.save(); XP.rr(g, x + s * 0.06, y + s * 0.05, s * 0.88, s * 0.42, s * 0.18); g.fillStyle = hl; g.fill(); g.restore();
  };
  // Clippy in 2D (a welcome tile's picture, the task buttons' icons): his wire and big eyes
  XP.clippy2d = (g, x, y, s) => {   // (x, y the top left of an s x s box)
    const P = XP.clippyPath(), u = s / 32, ox = x + s * 0.5, oy = y + s * 0.95;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [lw, col] of [[u * 1.9, '#5b6470'], [u * 1.2, '#c9d1da'], [u * 0.4, '#ffffff']]) {
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
      P.forEach(([px, py], i) => { const X = ox + px * u, Y = oy - py * u; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
      g.stroke();
    }
    for (const sx of [-1, 1]) {
      const ex = ox + sx * 3.4 * u + u * 0.6, ey = oy - 20.5 * u;
      g.fillStyle = '#fff'; g.strokeStyle = '#333'; g.lineWidth = u * 0.5; g.beginPath(); g.ellipse(ex, ey, 3 * u, 3.6 * u, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#111'; g.beginPath(); g.arc(ex + u * 0.6, ey + u * 0.6, 1.3 * u, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#222'; g.lineWidth = u * 0.9; g.beginPath(); g.arc(ex, ey - 2.8 * u, 3 * u, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
    g.restore();
  };
  // his wire's middle line in cm (front view, y up from his foot): the classic two nested loops, the free end inside
  XP.clippyPath = () => {
    const pts = [], arc = (cx, cy, r, a0, a1, n) => { for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
    const line = (x0, y0, x1, y1, n) => { for (let i = 1; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]); };
    pts.push([1, 11]);
    line(1, 11, 1, 21, 4);                       // up the inner right leg
    arc(0, 21, 1, 0, Math.PI, 8);                // over the small top loop
    line(-1, 21, -1, 4, 6);                      // down the inner left leg to the foot
    arc(0.9, 4, 1.9, Math.PI, Math.PI * 2, 12);  // round the bottom loop
    line(2.8, 4, 2.8, 25, 8);                    // up the outer right leg
    arc(0.4, 25, 2.4, 0, Math.PI, 14);           // over the big top loop
    line(-2.0, 25, -2.0, 12, 5);                 // down the outer left leg, its end free
    return pts;
  };

  // ---------------------------------------------------- geometry kit --
  // a rounded rectangle as a Shape, centred (r a number or [tl, tr, br, bl], in metres)
  XP.rrShape = (w, h, r) => {
    const [a, b, c, d] = (Array.isArray(r) ? r : [r, r, r, r]).map(v => clamp(v || 0, 0, Math.min(w, h) / 2));
    const s = new T.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + d, y); s.lineTo(x + w - c, y); if (c) s.quadraticCurveTo(x + w, y, x + w, y + c);
    s.lineTo(x + w, y + h - b); if (b) s.quadraticCurveTo(x + w, y + h, x + w - b, y + h);
    s.lineTo(x + a, y + h); if (a) s.quadraticCurveTo(x, y + h, x, y + h - a);
    s.lineTo(x, y + d); if (d) s.quadraticCurveTo(x, y, x + d, y);
    return s;
  };
  // an extruded shape (its back at z = 0, its front at z = d), bevelled; non-indexed with flat normals; uv and colour
  // set by fn(x, y, z, nx, ny, nz) -> [u, v, shade] for each corner
  XP.extrude = (shape, d, bevel, fn, o = {}) => {
    const b = Math.max(0, Math.min(bevel || 0, d / 2.2));
    const g0 = new T.ExtrudeGeometry(shape, { depth: Math.max(1e-4, d - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: o.bevelSize !== undefined ? o.bevelSize : b, bevelSegments: o.seg || 1, curveSegments: o.curve || 4 });
    g0.translate(0, 0, b);
    const g = g0.index ? g0.toNonIndexed() : g0;
    g.computeVertexNormals();
    return XP.paint(g, fn);
  };
  XP.paint = (g, fn) => {
    const P = g.attributes.position, N = g.attributes.normal, n = P.count, uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = fn(P.getX(i), P.getY(i), P.getZ(i), N.getX(i), N.getY(i), N.getZ(i));
      uv[i * 2] = r[0]; uv[i * 2 + 1] = r[1];
      const k = r[2] === undefined ? 1 : r[2], c = r[3] || [1, 1, 1];
      col[i * 3] = c[0] * k; col[i * 3 + 1] = c[1] * k; col[i * 3 + 2] = c[2] * k;
    }
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.clearGroups();
    return g;
  };
  // the light baked into an unlit surface's corners: the front full, edges by which way they face, the back dim
  XP.shade = (nx, ny, nz) => (nz > 0.92 ? 1 : nz < -0.6 ? 0.5 : clamp(0.66 + 0.26 * ny + 0.12 * nz - 0.06 * nx, 0.35, 1));
  // a picture on a slab's face: canvas W x H px, the face its top fh rows (the rest a strip of plain colours for backs),
  // spanning w x h metres
  XP.face = (w, h, W, o = {}) => {
    W = W || clamp(Math.round(w * 900 / 64) * 64, 256, 1024);
    const fh = Math.round(W * h / w), H = fh + 8, { cv, g } = XP.canvas(W, H);
    g.fillStyle = o.back || '#9aa7b8'; g.fillRect(0, fh, W, 8);
    const F = { cv, g, W, H, fh, w, h };
    F.uv = (x, y) => [(x + w / 2) / w, 1 - ((h / 2 - y) / h * fh) / H];
    F.back = [4 / W, 1 - (fh + 4) / H];
    F.px = (px, py) => [px / W * w - w / 2, h / 2 - py / fh * h];   // a pixel of the face, in metres
    return F;
  };
  // a slab with F's picture on its front and edges, the strip's colour on its back
  XP.slab = (F, d, o = {}) => {
    const b = o.bevel !== undefined ? o.bevel : Math.min(0.006, d / 3);
    const shape = o.shape || XP.rrShape(F.w - 2 * b, F.h - 2 * b, (o.r || [0, 0, 0, 0]).map(v => Math.max(0, v - b)));
    return XP.extrude(shape, d, b, (x, y, z, nx, ny, nz) => (nz < -0.6 ? [...F.back, 0.55] : [...F.uv(x, y), XP.shade(nx, ny, nz)]), { curve: o.curve || 4 });
  };
  // a part of F's picture raised off its front by hgt (a button, a title bar, a key): a box whose front shows that part
  // of the picture and whose chamfered edges carry its border's colours. px0..py1 in the face's pixels; z0 where it stands
  XP.raise = (F, px0, py0, px1, py1, hgt, z0, o = {}) => {
    const [x0, y1] = F.px(px0, py0), [x1, y0] = F.px(px1, py1);
    const w = x1 - x0, h = y1 - y0, ch = Math.min(o.chamfer !== undefined ? o.chamfer : hgt * 0.8, w * 0.3, h * 0.3), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const P = [], N = [];
    // front face inset by the chamfer, four chamfered sides down to the full rectangle at z0
    const A = [[x0 + ch, y0 + ch], [x1 - ch, y0 + ch], [x1 - ch, y1 - ch], [x0 + ch, y1 - ch]], B = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], zt = z0 + hgt;
    const quad = (a, b, c, d) => { P.push(...a, ...b, ...c, ...a, ...c, ...d); };
    quad([...A[0], zt], [...A[1], zt], [...A[2], zt], [...A[3], zt]);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad([...B[i], z0], [...B[j], z0], [...A[j], zt], [...A[i], zt]); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    g.computeVertexNormals();
    // (the sides show the picture's border just inside the rectangle, so a button's edge is its own colour)
    return XP.paint(g, (x, y, z, nx, ny, nz) => [...F.uv(clamp(x, x0 + ch * 0.5, x1 - ch * 0.5), clamp(y, y0 + ch * 0.5, y1 - ch * 0.5)), XP.shade(nx, ny, nz) * (o.k || 1)]);
  };
  // geometries welded into one indexed geometry (position, normal, uv, colour; missing ones filled), each optionally
  // moved by a matrix first
  XP.merge = (list, o = {}) => {
    const P = [], N = [], U = [], C = [], I = [], map = new Map();
    const v = new T.Vector3(), nm = new T.Matrix3();
    for (const it of list) {
      const g0 = it.isBufferGeometry ? it : it.geo, m = it.isBufferGeometry ? null : it.m;
      const g = g0.index ? g0.toNonIndexed() : g0;
      if (!g.attributes.normal) g.computeVertexNormals();
      if (m) nm.getNormalMatrix(m);
      const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, c = g.attributes.color;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i); if (m) v.applyMatrix4(m);
        const px = v.x, py = v.y, pz = v.z;
        v.fromBufferAttribute(n, i); if (m) v.applyMatrix3(nm).normalize();
        const nx = v.x, ny = v.y, nz = v.z;
        const u0 = uv ? uv.getX(i) : 0, u1 = uv ? uv.getY(i) : 0;
        const k = it.c || null, c0 = (c ? c.getX(i) : 1) * (k ? k[0] : 1), c1 = (c ? c.getY(i) : 1) * (k ? k[1] : 1), c2 = (c ? c.getZ(i) : 1) * (k ? k[2] : 1);
        const key = [px, py, pz].map(q => Math.round(q * 1e5)).join() + '|' + (o.smooth ? '' : [nx, ny, nz].map(q => Math.round(q * 200)).join()) + '|' + [u0, u1].map(q => Math.round(q * 1e5)).join() + '|' + [c0, c1, c2].map(q => Math.round(q * 400)).join();
        let idx = map.get(key);
        if (idx === undefined) { idx = P.length / 3; map.set(key, idx); P.push(px, py, pz); N.push(nx, ny, nz); U.push(u0, u1); C.push(c0, c1, c2); }
        I.push(idx);
      }
      if (g !== g0) g.dispose();
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    out.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
    out.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
    out.setAttribute('color', new T.Float32BufferAttribute(C, 3));
    out.setIndex(I);
    if (o.smooth) out.computeVertexNormals();   // (corners shared wherever they meet: smooth, but for where colours part)
    if (o.bare || o.noUV) out.deleteAttribute('uv');   // (no picture: no texture coordinates)
    if (o.bare) out.deleteAttribute('normal');   // (an unlit mesh with no picture needs no normals either)
    return out;
  };
  // a geometry moved and turned (a copy's matrix)
  XP.at = (geo, x, y, z, rx, ry, rz, s) => ({ geo, m: new T.Matrix4().compose(new T.Vector3(x || 0, y || 0, z || 0), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)), new T.Vector3(s || 1, s || 1, s || 1)) });
  // a solid coloured piece for a lit model (its colour in its corners, so one material serves many colours)
  XP.solid = (geo, col, m) => ({ geo, m: m || null, c: new T.Color(col).toArray() });
  // materials: an unlit one for screens and pictures (its texture times its corners' baked light), a lit one for things
  XP.flat = (tex, o = {}) => new T.MeshBasicMaterial(Object.assign({ map: tex || null, vertexColors: true }, o));
  XP.lit = (o = {}) => new T.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.6, metalness: 0 }, o));
  XP.mesh = (geo, mat, name) => { const m = new T.Mesh(geo, mat); m.name = name || 'mesh'; return m; };
  XP.group = (name, ...kids) => { const g = new T.Group(); g.name = name; for (const k of kids) g.add(k); return g; };

  // --------------------------------------------------------- the Luna look --
  // a Luna window's frame painted on a face: blue frame, glossy title bar with its icon and title, the three title
  // buttons (or only Close); returns where its client area and buttons are (px)
  XP.LUNA = { bar: ['#0058ee', '#3a93ff', '#0b62f0', '#0450e0', '#0144c9', '#003dc0'], frame: '#0831d9', body: '#ece9d8' };
  XP.luna = (F, o = {}) => {
    const { g, W, fh } = F, bar = o.bar || Math.round(W * 0.05), fr = Math.max(3, Math.round(W * 0.006));
    g.fillStyle = XP.LUNA.frame; g.fillRect(0, 0, W, fh);
    const L = XP.LUNA.bar;
    g.fillStyle = XP.grad(g, 0, 0, 0, bar, [[0, L[0]], [0.07, L[1]], [0.2, L[2]], [0.55, L[3]], [0.88, L[4]], [1, L[5]]]);
    XP.rr(g, 0, 0, W, bar + fr, [bar * 0.32, bar * 0.32, 0, 0]); g.fill();
    // a light along its top edge
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(bar * 0.3, 1, W - bar * 0.6, Math.max(1, bar * 0.04));
    let tx = fr + bar * 0.2;
    if (o.icon) { o.icon(g, tx, bar * 0.18, bar * 0.64); tx += bar * 0.8; }
    const btns = (o.buttons || ['min', 'max', 'close']), bs = Math.round(bar * 0.72), gap = Math.round(bar * 0.08), by = Math.round((bar - bs) / 2 + fr * 0.3), out = [];
    let bx = W - fr - bar * 0.12 - bs;
    for (let i = btns.length - 1; i >= 0; i--) { out.unshift([btns[i], bx, by, bx + bs, by + bs]); bx -= bs + gap; }
    XP.text(g, o.title || '', tx, bar * 0.68, { size: Math.round(bar * 0.5), weight: 'bold', font: XP.F.title, color: '#fff', shadow: '#0a2a8a', sd: Math.max(1, bar * 0.04), max: bx - tx - bar * 0.2 });
    for (const [k, x0, y0, x1] of out) XP.titleButton(g, k, x0, y0, x1 - x0);
    const client = { x: fr, y: bar + fr, w: W - 2 * fr, h: fh - bar - 2 * fr };
    g.fillStyle = o.body || XP.LUNA.body; g.fillRect(client.x, client.y, client.w, client.h);
    return { bar, fr, client, btns: out };
  };
  XP.titleButton = (g, k, x, y, s) => {
    const red = k === 'close';
    g.fillStyle = XP.grad(g, 0, y, 0, y + s, red ? [[0, '#f0a08a'], [0.25, '#e8603c'], [1, '#c2361a']] : [[0, '#8ab6ff'], [0.25, '#3a7bf0'], [1, '#1d55d5']]);
    XP.rr(g, x, y, s, s, s * 0.18); g.fill();
    g.lineWidth = Math.max(1, s * 0.06); g.strokeStyle = '#fff'; g.stroke();
    g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, s * 0.12); g.lineCap = 'square';
    const m = s * 0.28;
    g.beginPath();
    if (k === 'min') { g.moveTo(x + m, y + s - m); g.lineTo(x + s * 0.55, y + s - m); }
    else if (k === 'max') { g.rect(x + m, y + m, s - 2 * m, s - 2 * m); g.moveTo(x + m, y + m + s * 0.06); g.lineTo(x + s - m, y + m + s * 0.06); }
    else if (k === 'help') { g.font = `bold ${s * 0.7}px ${XP.F.ui}`; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('?', x + s / 2, y + s * 0.78); }
    else { g.moveTo(x + m, y + m); g.lineTo(x + s - m, y + s - m); g.moveTo(x + s - m, y + m); g.lineTo(x + m, y + s - m); }
    g.stroke();
  };
  // an XP push button (Yes, No, Send Error Report...): returns its rectangle, for raising it
  XP.button = (g, x, y, w, h, label, o = {}) => {
    g.fillStyle = XP.grad(g, 0, y, 0, y + h, [[0, '#ffffff'], [0.85, '#ecebe6'], [1, '#d6d0c5']]);
    XP.rr(g, x, y, w, h, h * 0.16); g.fill();
    g.lineWidth = Math.max(1, h * 0.05); g.strokeStyle = '#003c74'; g.stroke();
    if (o.def) { g.strokeStyle = '#6a93e9'; g.lineWidth = Math.max(1, h * 0.06); XP.rr(g, x + h * 0.08, y + h * 0.08, w - h * 0.16, h - h * 0.16, h * 0.12); g.stroke(); }
    XP.text(g, label, x + w / 2, y + h * 0.66, { size: Math.round(h * 0.45), align: 'center', color: '#000', max: w - h * 0.3 });
    return [x, y, x + w, y + h];
  };
  // a menu bar (File Edit ...)
  XP.menubar = (g, c, items, o = {}) => {
    const h = o.h || Math.round(c.w * 0.04);
    g.fillStyle = o.bg || XP.LUNA.body; g.fillRect(c.x, c.y, c.w, h);
    let x = c.x + h * 0.4;
    for (const it of items) x += XP.text(g, it, x, c.y + h * 0.7, { size: Math.round(h * 0.55), color: o.color || '#000' }) + h * 0.7;
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(c.x, c.y + h - 1, c.w, 1);
    return h;
  };
  // the system's little icons, drawn in a box (x, y, s)
  XP.icons = {
    info: (g, x, y, s) => { g.fillStyle = XP.grad(g, 0, y, 0, y + s, [[0, '#7fb2ff'], [1, '#1d4fcf']]); g.beginPath(); g.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = s * 0.06; g.stroke(); XP.text(g, 'i', x + s / 2, y + s * 0.78, { size: Math.round(s * 0.72), weight: 'bold', font: 'serif', align: 'center', color: '#fff' }); },
    error: (g, x, y, s) => { g.fillStyle = XP.grad(g, 0, y, 0, y + s, [[0, '#ff8a6a'], [1, '#c2160a']]); g.beginPath(); g.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = s * 0.12; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + s * 0.32, y + s * 0.32); g.lineTo(x + s * 0.68, y + s * 0.68); g.moveTo(x + s * 0.68, y + s * 0.32); g.lineTo(x + s * 0.32, y + s * 0.68); g.stroke(); },
    question: (g, x, y, s) => { g.fillStyle = XP.grad(g, 0, y, 0, y + s, [[0, '#9fc4ff'], [1, '#2a5cd8']]); g.beginPath(); g.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); g.fill(); XP.text(g, '?', x + s / 2, y + s * 0.76, { size: Math.round(s * 0.7), weight: 'bold', align: 'center', color: '#fff' }); },
    warn: (g, x, y, s) => { g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(x + s / 2, y); g.lineTo(x + s, y + s * 0.92); g.lineTo(x, y + s * 0.92); g.closePath(); g.fill(); g.strokeStyle = '#8a6a00'; g.lineWidth = s * 0.05; g.stroke(); XP.text(g, '!', x + s / 2, y + s * 0.82, { size: Math.round(s * 0.62), weight: 'bold', align: 'center', color: '#000' }); },
    folder: (g, x, y, s) => { g.fillStyle = '#e8b73c'; g.fillRect(x, y + s * 0.18, s * 0.45, s * 0.2); g.fillStyle = XP.grad(g, 0, y + s * 0.25, 0, y + s, [[0, '#ffe08a'], [1, '#e2a62a']]); XP.rr(g, x, y + s * 0.28, s, s * 0.64, s * 0.06); g.fill(); },
    note: (g, x, y, s) => { g.fillStyle = '#fff'; g.fillRect(x + s * 0.15, y + s * 0.05, s * 0.7, s * 0.9); g.strokeStyle = '#4a6fa5'; g.lineWidth = s * 0.05; g.strokeRect(x + s * 0.15, y + s * 0.05, s * 0.7, s * 0.9); g.fillStyle = '#7aa0d6'; for (let i = 0; i < 4; i++) g.fillRect(x + s * 0.25, y + s * (0.25 + i * 0.16), s * 0.5, s * 0.05); },
    paint: (g, x, y, s) => { g.fillStyle = '#f2e6c8'; g.beginPath(); g.ellipse(x + s / 2, y + s / 2, s * 0.48, s * 0.4, 0, 0, Math.PI * 2); g.fill(); for (const [dx, dy, c] of [[0.3, 0.35, '#e33'], [0.5, 0.28, '#2a2'], [0.68, 0.38, '#36f'], [0.35, 0.6, '#fd0']]) { g.fillStyle = c; g.beginPath(); g.arc(x + s * dx, y + s * dy, s * 0.08, 0, Math.PI * 2); g.fill(); } },
    globe: (g, x, y, s) => { g.fillStyle = XP.grad(g, 0, y, 0, y + s, [[0, '#6fc3ff'], [1, '#1557c0']]); g.beginPath(); g.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); g.fill(); g.fillStyle = '#4caf3a'; g.beginPath(); g.ellipse(x + s * 0.4, y + s * 0.4, s * 0.18, s * 0.12, 0.5, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(x + s * 0.62, y + s * 0.66, s * 0.14, s * 0.1, -0.4, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#ffd23f'; g.lineWidth = s * 0.07; g.beginPath(); g.ellipse(x + s / 2, y + s / 2, s * 0.55, s * 0.18, -0.4, 0, Math.PI * 2); g.stroke(); },
    play: (g, x, y, s) => { g.fillStyle = XP.grad(g, 0, y, 0, y + s, [[0, '#ffb03a'], [1, '#e2620a']]); g.beginPath(); g.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + s * 0.4, y + s * 0.28); g.lineTo(x + s * 0.74, y + s * 0.5); g.lineTo(x + s * 0.4, y + s * 0.72); g.closePath(); g.fill(); },
    computer: (g, x, y, s) => { g.fillStyle = '#e9e2cf'; g.fillRect(x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.62); g.fillStyle = '#2a6ad8'; g.fillRect(x + s * 0.16, y + s * 0.15, s * 0.68, s * 0.46); g.fillStyle = '#cfc7b2'; g.fillRect(x + s * 0.3, y + s * 0.74, s * 0.4, s * 0.1); g.fillRect(x + s * 0.18, y + s * 0.84, s * 0.64, s * 0.08); },
    duck: (g, x, y, s) => { g.fillStyle = '#ffd21f'; g.beginPath(); g.ellipse(x + s * 0.5, y + s * 0.66, s * 0.4, s * 0.26, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x + s * 0.38, y + s * 0.34, s * 0.2, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ff8a1a'; g.beginPath(); g.ellipse(x + s * 0.16, y + s * 0.38, s * 0.12, s * 0.06, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(x + s * 0.34, y + s * 0.3, s * 0.035, 0, Math.PI * 2); g.fill(); },
    clippy: (g, x, y, s) => XP.clippy2d(g, x, y, s),
    speaker: (g, x, y, s) => { g.fillStyle = '#dfe6f0'; g.fillRect(x + s * 0.15, y + s * 0.35, s * 0.22, s * 0.3); g.beginPath(); g.moveTo(x + s * 0.37, y + s * 0.35); g.lineTo(x + s * 0.62, y + s * 0.15); g.lineTo(x + s * 0.62, y + s * 0.85); g.lineTo(x + s * 0.37, y + s * 0.65); g.fill(); g.strokeStyle = '#dfe6f0'; g.lineWidth = s * 0.06; g.beginPath(); g.arc(x + s * 0.62, y + s * 0.5, s * 0.22, -0.8, 0.8); g.stroke(); },
    network: (g, x, y, s) => { for (const [dx, dy] of [[0.05, 0.1], [0.38, 0.45]]) { g.fillStyle = '#cfe0f7'; g.fillRect(x + s * dx, y + s * dy, s * 0.5, s * 0.36); g.fillStyle = '#2a6ad8'; g.fillRect(x + s * (dx + 0.05), y + s * (dy + 0.05), s * 0.4, s * 0.24); } },
    shield: (g, x, y, s) => { g.fillStyle = '#e83a2a'; g.beginPath(); g.moveTo(x + s * 0.5, y + s * 0.05); g.lineTo(x + s * 0.9, y + s * 0.2); g.quadraticCurveTo(x + s * 0.85, y + s * 0.75, x + s * 0.5, y + s * 0.95); g.quadraticCurveTo(x + s * 0.15, y + s * 0.75, x + s * 0.1, y + s * 0.2); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(x + s * 0.45, y + s * 0.25, s * 0.1, s * 0.5); g.fillRect(x + s * 0.3, y + s * 0.42, s * 0.4, s * 0.1); },
  };

  // a Luna window as a 3D slab: o = { w, h (m), W (px), title, icon, buttons, d (m), draw(F, L) -> raised rectangles,
  // raiseBar } returns one mesh (one texture, one draw)
  XP.window = o => {
    const F = XP.face(o.w, o.h, o.W, { back: o.back || '#7d93b8' });
    const L = XP.luna(F, o);
    const raised = (o.draw && o.draw(F, L)) || [];
    const d = o.d || 0.028, parts = [XP.slab(F, d, { r: [L.bar * 0.32 / F.W * F.w, L.bar * 0.32 / F.W * F.w, 0.004, 0.004] })];
    const z = d;
    if (o.raiseBar !== false) parts.push(XP.raise(F, L.fr * 0.5, 1, F.W - L.fr * 0.5, L.bar + L.fr * 0.6, 0.004, z, { chamfer: 0.003 }));
    const zb = z + (o.raiseBar !== false ? 0.004 : 0);
    for (const [, x0, y0, x1, y1] of L.btns) parts.push(XP.raise(F, x0, y0, x1, y1, 0.006, zb, { chamfer: 0.0035 }));
    for (const r of raised) parts.push(XP.raise(F, r[0], r[1], r[2], r[3], r[4] || 0.006, z + (r[5] || 0), { chamfer: r[6] }));
    const geo = XP.merge(parts);
    parts.forEach(p => p.dispose());
    const mesh = XP.mesh(geo, XP.flat(XP.tex(F.cv)), o.name || 'window');
    mesh.userData.face = F;
    return mesh;
  };
  // a plain panel with a picture on its front (no title bar): o = { w, h, W, d, r, draw(F) -> raised }
  XP.panel = o => {
    const F = XP.face(o.w, o.h, o.W, { back: o.back });
    const raised = (o.draw && o.draw(F)) || [];
    const d = o.d || 0.03, r = o.r === undefined ? 0.01 : o.r, parts = [XP.slab(F, d, { r: Array.isArray(r) ? r : [r, r, r, r], bevel: o.bevel })];
    for (const q of raised) parts.push(XP.raise(F, q[0], q[1], q[2], q[3], q[4] || 0.006, d + (q[5] || 0), { chamfer: q[6] }));
    const geo = XP.merge(parts);
    parts.forEach(p => p.dispose());
    return XP.mesh(geo, XP.flat(XP.tex(F.cv)), o.name || 'panel');
  };

  // a balloon tip's or speech balloon's outline: a rounded rectangle with a tail (m; tip = [x, y] of the tail's point,
  // tail its base's x on the bottom edge and its width)
  XP.balloonShape = (w, h, r, tail) => {
    const s = new T.Shape(), x = -w / 2, y = -h / 2, [tx, tw, px, py] = tail;
    s.moveTo(x + r, y);
    s.lineTo(tx - tw / 2, y); s.lineTo(px, py); s.lineTo(tx + tw / 2, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  // a balloon: o = { w, h (the body, m), tail: [x of its base, width, tip x, tip y] (m, from the body's middle), colour,
  // draw(F, box) } -> { root, clips } with a Pop clip that grows it out of its tail's tip
  XP.balloon = o => {
    const tipY = o.tail[3], fullH = o.h / 2 - tipY, fullW = o.w;   // (the face covers the body and the tail)
    const F = XP.face(fullW, fullH, o.W, { back: '#c9c3a0' }), g = F.g;
    const k = F.W / fullW, bodyPx = Math.round(o.h * k), r = (o.r || 0.02);
    g.fillStyle = '#000'; g.fillRect(0, 0, F.W, F.fh);
    // the outline drawn as the shape is, so its edge shows on the bevel
    const toPx = (x, y) => [(x + fullW / 2) * k, (o.h / 2 - y) * k];
    g.save(); g.beginPath();
    const S = XP.balloonShape(o.w, o.h, r, o.tail), pts = S.getPoints(8);
    pts.forEach((p, i) => { const [X, Y] = toPx(p.x, p.y); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
    g.closePath(); g.fillStyle = o.colour || '#ffffe1'; g.fill();
    g.lineWidth = Math.max(3, F.W * 0.006); g.strokeStyle = '#1a1a1a'; g.stroke();
    g.restore();
    const box = { x: F.W * 0.04, y: F.W * 0.035, w: F.W * 0.92, h: bodyPx - F.W * 0.07 };
    const raised = (o.draw && o.draw(F, box)) || [];
    // (the face's middle is the body's middle moved up by the tail: shift the shape into the face's frame)
    const dy = (o.h / 2) - fullH / 2;
    const shape = XP.balloonShape(o.w, o.h, r, o.tail);
    const d = o.d || 0.012;
    const body = XP.extrude(shape, d, 0.003, (x, y, z, nx, ny, nz) => (nz < -0.6 ? [...F.back, 0.6] : [...F.uv(x, y - dy), XP.shade(nx, ny, nz)]), { curve: 5 });
    const parts = [body];
    for (const q of raised) { const rg = XP.raise(F, q[0], q[1], q[2], q[3], q[4] || 0.004, d); rg.translate(0, dy, 0); parts.push(rg); }
    const geo = XP.merge(parts); parts.forEach(p => p.dispose());
    const mesh = XP.mesh(geo, XP.flat(XP.tex(F.cv)), 'balloon');
    // the pivot at the tail's tip: the balloon grows out of it
    const pivot = XP.group('pop', mesh), root = XP.group(o.name || 'balloon', pivot);
    pivot.position.set(o.tail[2], o.tail[3], 0);
    mesh.position.set(-o.tail[2], -o.tail[3], 0);
    return { root, clips: [XP.popClip('pop')], face: F };
  };
  // a pop: grows from nothing past its size and settles
  XP.popClip = node => new T.AnimationClip('Pop', 0.45, [
    new T.VectorKeyframeTrack(node + '.scale', [0, 0.16, 0.27, 0.36, 0.45], [0.02, 0.02, 0.02, 1.14, 1.14, 1.14, 0.94, 0.94, 0.94, 1.03, 1.03, 1.03, 1, 1, 1]),
  ]);

  // ---------------------------------------------------------- clips kit --
  // tracks: XP.qTrack(node, times, eulers [[x, y, z], ...]), XP.vTrack(node, prop, times, values [[x, y, z], ...])
  XP.qTrack = (node, times, eul) => {
    const v = [], q = new T.Quaternion();
    for (const e of eul) { q.setFromEuler(new T.Euler(e[0], e[1], e[2])); v.push(q.x, q.y, q.z, q.w); }
    return new T.QuaternionKeyframeTrack(node + '.quaternion', times, v);
  };
  XP.vTrack = (node, prop, times, vals) => new T.VectorKeyframeTrack(node + '.' + prop, times, vals.flat());
  // a smooth loop sampled: f(t) -> value for each of n+1 keys from 0 to dur (the last equal to the first)
  XP.sample = (dur, n, f) => { const t = [], v = []; for (let i = 0; i <= n; i++) { const s = i / n * dur; t.push(+s.toFixed(4)); v.push(f(i === n ? 0 : s)); } return [t, v]; };

  // ------------------------------------------------- text traced to 3D --
  // a line of text drawn big on a canvas, traced along its edge (marching squares), simplified, and turned into Shapes
  // (outlines with their holes), height in metres; returns { shapes, w, h }
  XP.textShapes = (s, font, height, o = {}) => {
    const px = o.px || 180, pad = px * 0.3;
    const probe = XP.canvas(8, 8).g; probe.font = `${font.replace('$', px)}`;
    const tw = Math.ceil(probe.measureText(s).width + pad * 2), th = Math.ceil(px * 1.5 + pad);
    const { cv, g } = XP.canvas(tw, th);
    g.fillStyle = '#000'; g.fillRect(0, 0, tw, th); g.fillStyle = '#fff'; g.font = font.replace('$', px); g.textBaseline = 'alphabetic';
    g.fillText(s, pad, px * 1.1 + pad * 0.5);
    const D = g.getImageData(0, 0, tw, th).data, V = (x, y) => (x < 0 || y < 0 || x >= tw || y >= th ? 0 : D[(y * tw + x) * 4] / 255);
    // marching squares: segments from where the inside begins to where it ends, clockwise round each cell, keyed by edge
    const segs = new Map(), pts = new Map(), iso = 0.5;
    const ekey = (x, y, side) => side === 'h' ? `h${x},${y}` : `v${x},${y}`;   // h: the edge from (x,y) to (x+1,y); v: (x,y) to (x,y+1)
    const ept = (x, y, side) => {
      const k = ekey(x, y, side);
      if (!pts.has(k)) { const a = V(x, y), b = side === 'h' ? V(x + 1, y) : V(x, y + 1), t = clamp((iso - a) / ((b - a) || 1e-6), 0, 1); pts.set(k, side === 'h' ? [x + t, y] : [x, y + t]); }
      return k;
    };
    for (let y = -1; y < th; y++) for (let x = -1; x < tw; x++) {
      const c = [V(x, y) > iso, V(x + 1, y) > iso, V(x + 1, y + 1) > iso, V(x, y + 1) > iso];   // tl, tr, br, bl
      if (c[0] === c[1] && c[1] === c[2] && c[2] === c[3]) continue;
      // the cell's edges clockwise: top (tl->tr), right (tr->br), bottom (br->bl), left (bl->tl)
      const E = [[0, 1, ekey(x, y, 'h'), () => ept(x, y, 'h')], [1, 2, ekey(x + 1, y, 'v'), () => ept(x + 1, y, 'v')], [2, 3, ekey(x, y + 1, 'h'), () => ept(x, y + 1, 'h')], [3, 0, ekey(x, y, 'v'), () => ept(x, y, 'v')]];
      const outs = [], ins = [];   // in->out and out->in crossings, by their order round the cell
      E.forEach(([a, b, , mk], i) => { if (c[a] && !c[b]) outs.push([i, mk()]); else if (!c[a] && c[b]) ins.push([i, mk()]); });
      // each out->in crossing joins the next in->out crossing clockwise
      for (const [i, k] of ins) {
        let best = null;
        for (const [j, kk] of outs) { const dd = (j - i + 4) % 4; if (!best || dd < best[0]) best = [dd, kk]; }
        if (best) segs.set(k, best[1]);
      }
    }
    const loops = [], used = new Set();
    for (const start of segs.keys()) {
      if (used.has(start)) continue;
      const L = []; let k = start;
      while (k && !used.has(k)) { used.add(k); L.push(pts.get(k)); k = segs.get(k); }
      if (L.length > 4) loops.push(L);
    }
    // simplified (Douglas-Peucker on the closed loop, split at its farthest point), in metres with y up
    const tol = o.tol || 0.6, sc = height / px;
    const dp = (P, a, b, keep) => {
      let m = -1, mi = -1; const [ax, ay] = P[a], [bx, by] = P[b], L = Math.hypot(bx - ax, by - ay) || 1e-9;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (ay - P[i][1]) - (ax - P[i][0]) * (by - ay)) / L; if (d > m) { m = d; mi = i; } }
      if (m > tol) { dp(P, a, mi, keep); keep.push(mi); dp(P, mi, b, keep); }
    };
    const simp = L => { let far = 0, fd = -1; for (let i = 1; i < L.length; i++) { const d = Math.hypot(L[i][0] - L[0][0], L[i][1] - L[0][1]); if (d > fd) { fd = d; far = i; } } const P = L.concat([L[0]]), keep = [0]; dp(P, 0, far, keep); keep.push(far); dp(P, far, P.length - 1, keep); return keep.map(i => P[i]); };
    const base = px * 1.1 + pad * 0.5;
    const polys = loops.map(simp).filter(p => p.length >= 3).map(p => p.map(([x, y]) => new T.Vector2((x - pad) * sc, (base - y) * sc)));
    const area = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i].x * q.y - q.x * p[i].y; } return a / 2; };
    const A = polys.map(area), big = A.reduce((m, a, i) => (Math.abs(a) > Math.abs(A[m]) ? i : m), 0), sign = Math.sign(A[big]);
    const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
    const outers = polys.map((p, i) => ({ p, a: Math.abs(A[i]), i })).filter(x => Math.sign(A[x.i]) === sign && x.a > (px * sc * 0.02) ** 2);
    const shapes = outers.map(x => new T.Shape(x.p));
    polys.forEach((p, i) => {
      if (Math.sign(A[i]) === sign || Math.abs(A[i]) < (px * sc * 0.015) ** 2) return;
      let best = -1, ba = Infinity;
      outers.forEach((x, j) => { if (x.a < ba && inside(p[0], x.p)) { best = j; ba = x.a; } });
      if (best >= 0) shapes[best].holes.push(new T.Path(p));
    });
    const bb = new T.Box2(); polys.forEach(p => p.forEach(v => bb.expandByPoint(v)));
    return { shapes, box: bb };
  };
  // a title as extruded 3D letters with a shadow behind them (one lit material, its colours in its corners)
  XP.title3d = (s, o = {}) => {
    const H = o.height || 0.3, d = o.depth || H * 0.14, font = o.font || `italic bold $px ${XP.F.big}`;
    const { shapes, box } = XP.textShapes(s, font, H, { tol: o.tol || 0.7 });
    const cx = (box.min.x + box.max.x) / 2, cy = (box.min.y + box.max.y) / 2;
    const front = XP.extrude(shapes, d, d * 0.3, (x, y, z, nx, ny, nz) => [0, 0, 1, nz > 0.9 ? o.col || [1, 1, 1] : o.side || [0.82, 0.88, 1]], { curve: 2, bevelSize: H * 0.012 });
    const shadow = XP.extrude(shapes, d * 0.5, 0, () => [0, 0, 1, o.shadow || [0.04, 0.12, 0.42]]);
    front.translate(-cx, -cy, d * 0.5 + H * 0.02);
    shadow.translate(-cx + H * 0.035, -cy - H * 0.045, 0);
    const geo = XP.merge([front, shadow], { smooth: true, noUV: true }); front.dispose(); shadow.dispose();
    const mesh = XP.mesh(geo, XP.lit({ roughness: 0.35, metalness: 0.05 }), o.name || 'title');
    return { mesh, w: box.max.x - box.min.x, h: box.max.y - box.min.y };
  };
  // -------------------------------------------- lit solids: small helpers --
  XP.box = (w, h, d) => new T.BoxGeometry(w, h, d);
  XP.cyl = (rt, rb, h, n) => new T.CylinderGeometry(rt, rb, h, n || 16);
  XP.sphere = (r, a, b) => new T.SphereGeometry(r, a || 16, b || 12);
  XP.rbox = (w, h, d, r, seg) => {   // a rounded box: a rounded rectangle extruded with a round bevel
    const b = Math.min(r, d / 2.2, w / 2.2, h / 2.2);
    const g = XP.extrude(XP.rrShape(w - 2 * b, h - 2 * b, Math.max(0, r - b) || 0.0001), d, b, () => [0, 0, 1], { seg: seg || 2, curve: 3 });
    g.translate(0, 0, -d / 2);
    return g;
  };

  // ------------------------------------------------- export and check --
  const b64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); };
  // (JPEG pictures at our quality: the exporter asks the canvas with none, which is 0.92)
  const toBlob0 = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function (cb, type, q) { return toBlob0.call(this, cb, type, type === 'image/jpeg' && q === undefined ? XP.jpegQ : q); };
  XP.jpegQ = 0.8;
  const dispose = root => root.traverse(n => {
    if (n.geometry) n.geometry.dispose();
    for (const m of [].concat(n.material || [])) { for (const k of ['map', 'emissiveMap', 'alphaMap', 'normalMap']) if (m[k]) m[k].dispose(); m.dispose(); }
  });
  let R = null, ENV = null;
  const renderer = () => {
    if (R) return R;
    R = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: false });
    R.setPixelRatio(1); R.setSize(512, 512, false);
    return R;
  };
  // the studio's own soft room for glTF's metal and gloss (e2_scene.js envMap): its pictures are lit as the studio lights
  const env = () => {
    if (ENV) return ENV;
    const room = new T.Scene(), geo = new T.BoxGeometry(1, 1, 1), wall = new T.MeshBasicMaterial({ color: 0x5a6070, side: T.BackSide });
    const box = new T.Mesh(geo, wall); box.scale.set(12, 6, 12); box.position.y = 2; room.add(box);
    for (const [x, y, z, sx, sy, sz, c] of [[0, 4.9, 0, 6, 0.1, 6, 0xffffff], [-5.9, 2.5, 0, 0.1, 2, 5, 0xc8d8ff], [5.9, 2, 1, 0.1, 1.5, 3, 0xffe2c0], [0, -0.9, 0, 12, 0.1, 12, 0x2a2f3a]]) {
      const p = new T.Mesh(geo, new T.MeshBasicMaterial({ color: c })); p.position.set(x, y, z); p.scale.set(sx, sy, sz); room.add(p);
    }
    const pm = new T.PMREMGenerator(renderer());
    ENV = pm.fromScene(room, 0.04).texture;
    pm.dispose();
    return ENV;
  };
  // the picture for the studio's Add pane (tools/studio/SPEC.md, "Pictures in the Add pane"): lit as the studio lights a
  // scene, a little above and in front, framed on its box, drawn at twice the size and made smaller, on a dark ground
  XP.picture = (root, view) => {
    const S = 512, r = renderer(), sc = new T.Scene(), cam = new T.PerspectiveCamera(30, 1, 0.01, 1000);
    sc.add(new T.HemisphereLight(0xe8eeff, 0x2a2f3a, 0.9));
    const sun = new T.DirectionalLight(0xffffff, 0.9); sun.position.set(1.5, 3, 2.2); sc.add(sun);
    const rim = new T.DirectionalLight(0x9fc8ff, 0.35); rim.position.set(-2, 1.5, -2.5); sc.add(rim);
    sc.environment = env();
    root.traverse(n => { for (const m of [].concat(n.material || [])) { if (m.isMeshStandardMaterial && !m.envMap) { m.envMap = env(); m.envMapIntensity = 0.8; } for (const k of ['map', 'emissiveMap']) if (m[k]) { m[k].encoding = T.LinearEncoding; m.needsUpdate = true; } } });
    sc.add(root); root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(root);
    if (view && view.box) box.set(new T.Vector3(...view.box[0]), new T.Vector3(...view.box[1]));
    if (view && view.cam) {   // (a view from a given place: a landscape seen from within)
      cam.position.fromArray(view.cam[0]); cam.lookAt(new T.Vector3(...view.cam[1])); cam.fov = view.cam[2] || 60; cam.near = 0.05; cam.far = 500; cam.updateProjectionMatrix();
    } else {
    const c = box.getCenter(new T.Vector3()), d = new T.Vector3(...((view && view.dir) || [0.75, 0.5, 1])).normalize(), up = new T.Vector3(0, 1, 0);
    const right = new T.Vector3().crossVectors(up, d).normalize(), u = new T.Vector3().crossVectors(d, right), th = Math.tan(15 * Math.PI / 180);
    let D = 0, zmax = -Infinity, zmin = Infinity;
    for (let i = 0; i < 8; i++) {
      const v = new T.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(c), z = v.dot(d);
      D = Math.max(D, z + Math.max(Math.abs(v.dot(right)), Math.abs(v.dot(u))) / th); zmax = Math.max(zmax, z); zmin = Math.min(zmin, z);
    }
    D = Math.max(1e-3, D * 1.08);
    cam.position.copy(c).addScaledVector(d, D); cam.up.copy(up); cam.lookAt(c);
    cam.near = Math.max(D * 1e-4, (D - zmax) * 0.5); cam.far = Math.max(cam.near * 10, (D - zmin) * 2 + 1e-3); cam.updateProjectionMatrix();
    }
    const rt = new T.WebGLRenderTarget(S, S), px = new Uint8Array(S * S * 4);
    r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(); r.render(sc, cam); r.readRenderTargetPixels(rt, 0, 0, S, S, px); r.setRenderTarget(null); rt.dispose();
    sc.remove(root);
    const big = XP.canvas(S, S), bx = big.g, gr = bx.createRadialGradient(S / 2, S * 0.42, S * 0.05, S / 2, S / 2, S * 0.75);
    gr.addColorStop(0, '#1d2c44'); gr.addColorStop(1, '#070c16'); bx.fillStyle = gr; bx.fillRect(0, 0, S, S);
    const im = bx.getImageData(0, 0, S, S), o = im.data;
    for (let y = 0; y < S; y++) {
      const src = (S - 1 - y) * S * 4, dst = y * S * 4;
      for (let x = 0; x < S * 4; x += 4) { const a = px[src + x + 3] / 255, k = 1 - a; o[dst + x] = Math.min(255, px[src + x] + o[dst + x] * k); o[dst + x + 1] = Math.min(255, px[src + x + 1] + o[dst + x + 1] * k); o[dst + x + 2] = Math.min(255, px[src + x + 2] + o[dst + x + 2] * k); }
    }
    bx.putImageData(im, 0, 0);
    const small = XP.canvas(256, 256); small.g.imageSmoothingEnabled = true; small.g.imageSmoothingQuality = 'high'; small.g.drawImage(big.cv, 0, 0, 256, 256);
    return small.cv.toDataURL('image/jpeg', 0.86).split(',')[1];
  };
  // what a loaded model holds: triangles, draws, its pictures' sizes, its clips, its box
  XP.inspect = gltf => {
    let tris = 0, draws = 0; const tex = [], seen = new Set();
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(n => {
      if (!n.isMesh) return;
      draws++;
      tris += (n.geometry.index ? n.geometry.index.count : n.geometry.attributes.position.count) / 3;
      for (const m of [].concat(n.material)) for (const k of ['map', 'emissiveMap', 'normalMap', 'alphaMap']) { const t = m[k]; if (t && t.image && !seen.has(t.image)) { seen.add(t.image); tex.push([t.image.width, t.image.height]); } }
    });
    const box = new T.Box3().setFromObject(gltf.scene);
    return { tris, draws, tex, clips: gltf.animations.map(a => ({ name: a.name, duration: +a.duration.toFixed(3) })), box: [box.min.toArray().map(v => +v.toFixed(3)), box.max.toArray().map(v => +v.toFixed(3))] };
  };
  // one part: built, written as a binary glTF with its clips, read back, checked and pictured
  XP.make = async name => {
    const def = XP.parts[name];
    if (!def) throw new Error('no part ' + name);
    const built = def.build();
    const root = built.root;
    root.name = root.name || name;
    const glb = await new Promise((res, rej) => { try { new T.GLTFExporter().parse(root, res, { binary: true, animations: built.clips || [], onlyVisible: true, truncateDrawRange: true, embedImages: true, maxTextureSize: 1024 }); } catch (e) { rej(e); } });
    dispose(root);
    const gltf = await new Promise((res, rej) => new T.GLTFLoader().parse(glb.slice(0), '', res, rej));
    const info = XP.inspect(gltf);
    info.bytes = glb.byteLength;
    const pic = XP.picture(gltf.scene, def.view);
    dispose(gltf.scene);
    return { glb: b64(glb), pic, info, file: def.file };
  };
  XP.list = () => XP.order.map(n => ({ name: n, file: XP.parts[n].file }));
})();
