// Organ icons for the PET story: a clean single-weight line icon per organ in the style of the legend of the paper's
// Figure 2 (Geist et al., Med 2025), neon on request (the vision slide's organ network). Vector paths on a 2D canvas.
// PET_ICONS.ids, PET_ICONS.draw(ctx, id, cx, cy, size, opts), PET_ICONS.atlas(THREE, px, opts) -> { texture, canvas, uv(id) }
// Every icon is drawn in a 100 x 100 box (y down); see icons.md.
const PET_ICONS = (function () {
  const ids = PET_DATA.organs.map(o => o.id), short = new Map(PET_DATA.organs.map(o => [o.id, o.short || o.id]));
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x), r2 = v => Math.round(v * 100) / 100;
  const pt = p => r2(p[0]) + ' ' + r2(p[1]), nums = d => d.match(/-?\d*\.?\d+/g).map(Number);

  // mirror an absolute SVG path (M L C Q A H V Z) about x = 50
  function mir(d) {
    const tk = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g); let cmd = '', k = 0;
    return tk.map(s => {
      if (/[A-Za-z]/.test(s)) { cmd = s; k = 0; return s; }
      const v = +s, i = k++;
      if (cmd === 'A') { const j = i % 7; return j === 5 ? r2(100 - v) : j === 4 ? 1 - v : v; }
      if (cmd === 'H') return r2(100 - v);
      if (cmd === 'V') return v;
      return i % 2 === 0 ? r2(100 - v) : v;
    }).join(' ');
  }
  const both = d => d + ' ' + mir(d);
  // a symmetric closed outline from its left half: 'M x y C ...' (cubics only) from a point on x = 50 to another
  function sym(d) {
    const c = nums(d); let out = d;
    for (let b = c.length - 8; b >= 0; b -= 6) out += ` C ${pt([100 - c[b + 4], c[b + 5]])} ${pt([100 - c[b + 2], c[b + 3]])} ${pt([100 - c[b], c[b + 1]])}`;
    return out + ' Z';
  }
  // turn a path of M L C Q commands by deg (clockwise on screen) about (cx, cy), then move it by (dx, dy)
  function rot(d, deg, cx, cy, dx, dy) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), tk = d.match(/[A-Za-z]|-?\d*\.?\d+/g), out = [];
    for (let i = 0; i < tk.length; i++) {
      if (/[A-Za-z]/.test(tk[i])) { out.push(tk[i]); continue; }
      const x = +tk[i] - cx, y = +tk[++i] - cy;
      out.push(pt([cx + x * c - y * s + (dx || 0), cy + x * s + y * c + (dy || 0)]));
    }
    return out.join(' ');
  }
  const ell = (x, y, rx, ry) => `M ${r2(x - rx)} ${r2(y)} A ${rx} ${ry} 0 1 0 ${r2(x + rx)} ${r2(y)} A ${rx} ${ry} 0 1 0 ${r2(x - rx)} ${r2(y)} Z`;
  // points along a chain of cubic Béziers c = [x0, y0, (c1x, c1y, c2x, c2y, x, y)...] (or 'M x y C ...'), 20 per curve
  function bez(c) {
    if (typeof c === 'string') c = nums(c);
    const P = [];
    for (let b = 0; b + 7 < c.length; b += 6) for (let s = b ? 1 : 0; s <= 20; s++) {
      const u = s / 20, v = 1 - u, A = v * v * v, B = 3 * v * v * u, C = 3 * v * u * u, D = u * u * u;
      P.push([A * c[b] + B * c[b + 2] + C * c[b + 4] + D * c[b + 6], A * c[b + 1] + B * c[b + 3] + C * c[b + 5] + D * c[b + 7]]);
    }
    return P;
  }
  // the polyline P (from its first point on) redrawn as small lobes about step long and amp deep, bulging to the side
  // (-ty, tx) of the way it runs when sg = 1 (the other side when -1)
  function wave(P, step, amp, sg) {
    let len = 0; const S = [0];
    for (let k = 1; k < P.length; k++) S.push(len += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
    const n = Math.max(1, Math.round(len / step)), Q = [];
    for (let i = 0, k = 0; i <= n; i++) { while (k < P.length - 1 && S[k] < len * i / n) k++; Q.push(P[k]); }
    let out = '';
    for (let i = 1; i < Q.length; i++) {
      const a = Q[i - 1], b = Q[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      out += ` Q ${pt([(a[0] + b[0]) / 2 - sg * (b[1] - a[1]) / l * amp * 2, (a[1] + b[1]) / 2 + sg * (b[0] - a[0]) / l * amp * 2])} ${pt(b)}`;
    }
    return out;
  }

  // a tube along a chain of cubic Béziers (as for bez); w its width, or a function (u 0..1 along it, side +1 / -1) ->
  // width; caps 'round', 'flat' or 'cut' (a cut vessel: an ellipse); bump [step, amp] makes both sides lumpy (scallop).
  // Returns { shape, open, rim, L, R, P } (outline, the outline left open at a flat start, cut rims, both edges, centre).
  function tube(c, w, cap0, cap1, bump) {
    const P = bez(c), wf = typeof w === 'function' ? w : () => w;
    const S = [0];
    for (let k = 1; k < P.length; k++) S.push(S[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
    const L = [], R = [], T = [];
    P.forEach((p, k) => {
      const a = P[Math.max(0, k - 1)], e = P[Math.min(P.length - 1, k + 1)], l = Math.hypot(e[0] - a[0], e[1] - a[1]) || 1;
      const tx = (e[0] - a[0]) / l, ty = (e[1] - a[1]) / l, u = S[k] / S[S.length - 1], hl = wf(u, 1) / 2, hr = wf(u, -1) / 2;
      T.push([tx, ty]); L.push([p[0] - ty * hl, p[1] + tx * hl]); R.push([p[0] + ty * hr, p[1] - tx * hr]);
    });
    let rim = '';
    // a cap from the edge point 'side' round the centre p, bulging along t, to the other edge
    const cap = (p, t, side, kind) => {
      if (kind === 'flat') return '';
      const nx = side[0] - p[0], ny = side[1] - p[1], h = Math.hypot(nx, ny), f = kind === 'cut' ? 0.32 : 1; let s = '';
      for (let i = 1; i < 12; i++) { const ph = Math.PI * i / 12; s += ` L ${pt([p[0] + nx * Math.cos(ph) + t[0] * h * f * Math.sin(ph), p[1] + ny * Math.cos(ph) + t[1] * h * f * Math.sin(ph)])}`; }
      if (kind === 'cut') {
        rim += ` M ${pt(side)}`;
        for (let i = 1; i <= 12; i++) { const ph = Math.PI * i / 12; rim += ` L ${pt([p[0] + nx * Math.cos(ph) - t[0] * h * f * Math.sin(ph), p[1] + ny * Math.cos(ph) - t[1] * h * f * Math.sin(ph)])}`; }
      }
      return s;
    };
    const n = P.length - 1, Rr = R.slice().reverse();
    const edge = E => (bump ? pt(E[0]) + wave(E, bump[0], bump[1], 1) : E.map(pt).join(' L '));
    const open = 'M ' + edge(L) + cap(P[n], T[n], L[n], cap1 || 'round') + ' L ' + edge(Rr) + cap(P[0], [-T[0][0], -T[0][1]], R[0], cap0 || 'round');
    return { shape: open + ' Z', open, rim, L, R, P };
  }
  // a closed cubic outline ('M x y C ...') redrawn as small outward lobes about step long, amp deep
  function scallop(d, step, amp) {
    const P = bez(d); let A = 0;
    for (let k = 1; k < P.length; k++) A += P[k - 1][0] * P[k][1] - P[k][0] * P[k - 1][1];
    return 'M ' + pt(P[0]) + wave(P, step, amp, A > 0 ? -1 : 1) + ' Z';
  }

  // a kidney bean centred at (x, y), h tall, w wide, its hilum facing side (+1 right, -1 left)
  function bean(x, y, w, h, side) {
    const q = [[0.08, -0.5], [-0.3, -0.52], [-0.52, -0.28], [-0.5, 0], [-0.48, 0.3], [-0.28, 0.52], [0.06, 0.5], [0.36, 0.49],
      [0.5, 0.34], [0.38, 0.18], [0.27, 0.07], [0.21, 0.03], [0.21, 0], [0.21, -0.03], [0.27, -0.07], [0.38, -0.18],
      [0.5, -0.34], [0.36, -0.49], [0.08, -0.5]].map(p => pt([x + p[0] * w * side, y + p[1] * h]));
    let d = 'M ' + q[0];
    for (let i = 1; i < q.length; i += 3) d += ` C ${q[i]} ${q[i + 1]} ${q[i + 2]}`;
    return d + ' Z';
  }
  // the renal pelvis inside a bean: a funnel from the hilum (where the ureter leaves) widening into the kidney, its wide
  // end a hollow between two calyces (a closed, crescent-like wedge)
  function pelvis(x, y, w, h, side) {
    const p = (a, b) => pt([x + a * w * side, y + b * h]);
    return `M ${p(0.21, -0.035)} C ${p(0.08, -0.05)} ${p(-0.04, -0.12)} ${p(-0.11, -0.21)} C ${p(-0.14, -0.25)} ${p(-0.2, -0.22)} ${p(-0.17, -0.16)}` +
      ` C ${p(-0.1, -0.06)} ${p(-0.1, 0.08)} ${p(-0.17, 0.19)} C ${p(-0.2, 0.25)} ${p(-0.14, 0.28)} ${p(-0.11, 0.24)}` +
      ` C ${p(-0.04, 0.15)} ${p(0.08, 0.06)} ${p(0.21, 0.045)}`;
  }
  // a cobblestone of irregular cells (a honeycomb whose shared corners are nudged by a hash of where they are), to be clipped
  function comb(x0, y0, x1, y1, R) {
    const hx = Math.sqrt(3) * R, hy = 1.5 * R, j = R * 0.22;
    const nud = (x, y) => { const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, g = Math.sin(x * 39.346 + y * 11.135) * 24634.6345; return [x + (h - Math.floor(h) - 0.5) * 2 * j, y + (g - Math.floor(g) - 0.5) * 2 * j]; };
    let d = '';
    for (let r = 0, y = y0; y <= y1 + hy; r++, y += hy) for (let x = x0 - (r % 2 ? hx / 2 : 0); x <= x1 + hx; x += hx) {
      d += ' M';
      for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k - Math.PI / 2, v = nud(r2(x + R * Math.cos(a)), r2(y + R * Math.sin(a))); d += (k ? ' L ' : ' ') + pt(v); }
      d += ' Z';
    }
    return d;
  }
  // The icons. Each returns a list of parts: { s: path } a closed outline (stroked; filled with opts.fill), { l: path } a
  // line, { a: path } a fill-only area (fade: [y0, y1] fades it in downwards), { f: path, o: alpha } a solid fill in every
  // style; hi: true (only with detail: from 40 pixels up; a number: from that many) or lo: true (only below 40; a
  // number: below that many), w (line width factor), clip (a path the part is clipped to).
  const DEF = {
    brain() {
      // the left hemisphere: a scalloped outline from the top of the midline round to its bottom, then up the midline
      const n = 7, q = [];
      for (let i = 0; i <= n; i++) { const th = 0.13 + (Math.PI - 0.27) * i / n; q.push([50 - 40 * Math.sin(th), 51 - 37 * Math.cos(th)]); }
      let d = 'M ' + pt(q[0]);
      for (let i = 0; i < n; i++) {
        const a = q[i], b = q[i + 1], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, l = Math.hypot(mx - 50, my - 51);
        d += ` Q ${pt([mx + (mx - 50) / l * 7.5, my + (my - 51) / l * 7.5])} ${pt(b)}`;
      }
      d += ` C 47 76, 48.5 64, 47.5 51 C 46.5 38, 48 26, ${pt(q[0])} Z`;
      const g = 'M 26 24 C 31 23, 36 27, 35 33 M 15 42 C 21 39, 28 41, 29 47 M 38 41 C 33 45, 34 52, 40 55' +
        ' M 20 60 C 26 56, 33 59, 32 66 M 38 66 C 42 70, 42 76, 38 80 M 22 74 C 26 76, 28 79, 27 83';
      return [{ s: both(d) }, { l: both(g), hi: true }, { l: both('M 22 48 C 27 47, 31 51, 30 56 M 31 26 C 35 27, 38 31, 37 35'), lo: true }];
    },
    thyroid() {
      // the butterfly (bow tie): two lobes tapering to their upper poles, joined low down by a narrow isthmus
      const d = sym('M 50 64 C 46 64, 43 60, 41.5 52 C 40 42, 37 24, 32 12 C 30.5 8.5, 27.5 9, 26 12.5 C 20 25, 12.5 44, 12.5 62' +
        ' C 12.5 76, 18 88, 29 89 C 37 89.5, 42 82, 45 77 C 46.5 75, 48 74.5, 50 74.5');
      return [{ s: d }, { l: comb(10, 8, 90, 92, 5.6), hi: 56, w: 0.45, clip: d }, { l: comb(4, 16, 96, 92, 12), lo: 56, w: 0.55, clip: d }];
    },
    lungs() {
      const lung = 'M 39 22 C 30 22, 22 32, 18 45 C 14 57, 12 70, 12.5 80 C 13 87, 18 89, 24 86.5 C 30 84, 37 82.5, 42 84.5 C 44.5 85.5, 45.5 83, 45.5 79 L 45.5 36 C 45.5 27, 43 22, 39 22 Z';
      const right = 'M 61 22 C 70 22, 78 32, 82 45 C 86 57, 88 70, 87.5 80 C 87 87, 82 89, 76 86.5 C 70 84, 63 82.5, 58 84.5 C 55.5 85.5, 54.5 83, 54.5 79' +
        ' L 54.5 71 C 60 68, 61 60, 54.5 56 L 54.5 36 C 54.5 27, 57 22, 61 22 Z';
      // the windpipe: a narrow tube with its cartilage rings (a single line when small), the main bronchi from its foot
      const pipe = 'M 46.5 33 L 46.5 6 L 53.5 6 L 53.5 33', bron = 'M 46.5 33 C 45 37, 43 40, 40 44 M 53.5 33 C 55 37, 57 40, 60 44';
      const rings = 'M 46.5 12 Q 50 14.5, 53.5 12 M 46.5 19 Q 50 21.5, 53.5 19 M 46.5 26 Q 50 28.5, 53.5 26';
      const fine = both('M 40 44 C 35 48, 32 54, 30 62 M 36 49 C 32 47, 28 46, 25 47 M 32 56 C 34 61, 36 65, 37 70 M 30 62 C 27 66, 24 70, 22 75');
      return [{ s: lung }, { s: right }, { l: 'M 50 6 L 50 36 M 50 36 C 48 39, 44 41, 40 44 M 50 36 C 52 39, 56 41, 60 44', lo: true },
        { l: pipe + ' ' + bron, hi: true }, { l: rings, hi: true, w: 0.55 }, { l: fine, hi: true, w: 0.8 }];
    },
    heart() {
      const d = 'M 50 87 C 34 76, 10 60, 10 37 C 10 22, 20 13, 32 13 C 41 13, 47 18.5, 50 25 C 53 18.5, 59 13, 68 13 C 80 13, 90 22, 90 37 C 90 60, 66 76, 50 87 Z';
      return [{ s: d }, { l: 'M 12.5 50 L 31 50 L 37 39 L 45 64 L 53 30 L 60 57 L 64.5 50 L 87.5 50' }];
    },
    liver() {
      const d = 'M 11 33 C 17 22, 38 19, 60 20 C 75 21, 87 24, 93 30 C 91 36, 78 43, 64 50.5 C 59 53.5, 56.5 57, 53 61 C 45 69.5, 34 79, 24 82' +
        ' C 16 84, 11.5 78, 10 67 C 8.5 55, 8 42, 11 33 Z';
      // the vena cava passing through the top (its walls run on into the liver); the gall bladder tucked under the lower
      // edge, only its tip showing
      const ivc = tube('M 42 28 C 42 21, 42 15, 42 10', 8, 'flat', 'cut');
      const gall = 'M 47.9 66.2 C 51 69, 52 73.5, 49 75 C 46 76.5, 42.5 74, 42.2 71.2';
      return [{ s: d }, { l: 'M 63 20.5 C 61 31, 59 41, 57 54' }, { l: ivc.open, hi: true }, { l: ivc.rim, hi: true }, { l: gall, hi: true }];
    },
    spleen() {
      // an upright bean leaning to the midline: the convex outer border, the hilum a hollow in the inner face with the
      // splenic vessels coming in from the left and branching up into it
      const d = 'M 53 8 C 71 8, 82 28, 82 51 C 82 75, 70 92, 52 92 C 37 92, 28 84, 28 75 C 28 67, 35 64, 39 57 C 43 49, 32 43, 32 31' +
        ' C 32 17, 40 8, 53 8 Z';
      const T = s => rot(s, -12, 55, 50, -4.5, 0);
      return [{ s: T(d) }, { l: T('M 28 66 C 32 63.5, 36 61, 41 59 M 41 59 C 44 53, 46 46, 46 38 M 41 59 C 46 55.5, 51 53, 57 52'), w: 0.85 },
        { l: T('M 44 56.5 C 49 58, 53 60.5, 56 64.5 M 44.5 50.5 C 47 48, 49 46.5, 52 45.5'), hi: true, w: 0.75 }, { l: T('M 63 15 C 72 20, 76 31, 77 43'), hi: true, w: 0.8 }];
    },
    pancreas() {
      // head on the left (in the curve of the duodenum), body and tail rising to the right; lobulated when detailed
      const d = 'M 12 53 C 9.5 41, 18 33, 29 34 C 36 34.5, 41 32.5, 47 30 C 55 26.5, 63 27.5, 71 24.5 C 79 21.5, 89 20, 92.5 27' +
        ' C 95 33.5, 88.5 38.5, 80 40.5 C 71 42.5, 63 44.5, 56 47.5 C 48.5 51, 44 56, 42 64 C 40 72.5, 33 79, 24.5 77 C 15.5 75, 13.5 63, 12 53 Z';
      return [{ s: d, lo: true }, { s: scallop(d, 8.2, 1.5), hi: true }, { l: 'M 22.5 64 C 28 55, 40 47.5, 54 42 C 66 37.5, 78 34, 87 30', hi: true, w: 0.7 }];
    },
    kidneys() {
      const L = bean(26, 43, 33, 52, 1), R = bean(74, 43, 33, 52, -1);
      const ur = 'M 33 45 C 41 52, 44 70, 45 92 M 67 45 C 59 52, 56 70, 55 92';
      return [{ s: L }, { s: R }, { l: ur }, { l: pelvis(26, 43, 33, 52, 1) + ' ' + pelvis(74, 43, 33, 52, -1), hi: true, w: 0.8 }];
    },
    adrenal() {
      // a kidney with the adrenal gland on its upper pole (cortex filled, the medulla as an inner line)
      // (drawn about (45, 64), moved by (4, -4) to sit in the middle of its square)
      const M = s => rot(s, 0, 0, 0, 4, -4), k = bean(49, 60, 38, 56, 1);
      const capD = M('M 26 46.5 C 23.5 35, 31.5 21, 45 18.5 C 58.5 16.5, 69 29, 68 41.5 C 61.5 35.5, 55 32.5, 47 32.5 C 38 32.5, 30.5 37.5, 26 46.5 Z'), lump = scallop(capD, 7.2, 1.25);
      return [{ s: k }, { s: capD, lo: true }, { s: lump, hi: true }, { f: capD, o: 0.7, lo: true }, { f: lump, o: 0.4, hi: true }, { l: M('M 53 66 C 61 72, 64 82, 64 95') },
        { l: pelvis(49, 60, 38, 56, 1), hi: true, w: 0.8 }];
    },
    intestine() {
      // the colon as a lumpy frame (its haustra), cut at the rectum; inside, the small intestine winding
      const fr = [23, 84, 23, 66, 23, 48, 23, 31, 23, 25, 27, 21, 32, 21, 46, 21, 56, 21, 69, 21, 74, 21, 78, 25, 78, 30,
        78, 44, 78, 58, 78, 70, 78, 77, 74, 80, 66, 81.5, 59, 83, 55.5, 86, 55.5, 93];
      const c = tube(fr, 13, 'round', 'cut', [8.5, 1.4]);
      const s = 'M 36 34 C 42 31, 46 37, 52 34 C 58 31, 62 37, 66 34 C 70 32, 71 41, 66 42.5 C 61 44, 57 39, 51 42 C 45 45, 41 39, 36.5 43' +
        ' C 32 46.5, 35 52, 39 51 C 45 49.5, 48 55, 54 52 C 60 49, 64 54, 66 53 C 71 52, 71 61, 66 62.5 C 61 64, 57 59, 51 62' +
        ' C 45 65, 42 59, 37.5 63 C 33.5 66.5, 34 71, 29.5 72';
      // small: three bold upright runs (horizontal ones read as lines of text)
      const sl = 'M 40 69 L 40 40 C 40 33, 51 33, 51 40 L 51 61 C 51 68, 62 68, 62 61 L 62 33';
      return [{ s: c.shape }, { l: c.rim, hi: true }, { l: sl, lo: true }, { s: tube(s, 5.2, 'round', 'flat').shape, hi: true, w: 0.8 }];
    },
    muscle() {
      // a flexed arm as in the paper's legend: the fist on top, the forearm a band down to the elbow on the left, the
      // upper arm along the bottom to the shoulder, the biceps bulging above it
      const d = 'M 30 27 L 15 66 C 11 76, 14 86, 25 86.5 C 42 87.5, 66 89, 83 86.5 C 92 85, 95 74, 94 62 C 93 47, 83 35, 69.5 35' +
        ' C 56.5 35, 47.5 45, 43.5 58 L 52.5 32.5 C 58.5 32, 63 28, 62 22.5 C 65 18.5, 64 11, 58 8.5 C 52 6, 41 5.5, 35 8.5 C 28.5 12, 26.5 21, 30 27 Z';
      const curl = 'M 45 13 C 51 10.5, 57.5 12.5, 57.5 17.5 C 57.5 22, 52 24, 47.5 21.5';
      return [{ s: d }, { l: curl, hi: true, w: 0.8 }, { l: 'M 43.5 58 C 44 64, 48 68, 54 69.5', hi: true, w: 0.8 }];
    },
    marrow() {
      const d = 'M 38 41 C 29 37.5, 20.5 30, 24 19.5 C 27.5 9.5, 43 8.5, 50 17 C 57 8.5, 72.5 9.5, 76 19.5 C 79.5 30, 71 37.5, 62 41 L 62 86 A 12 4.2 0 0 1 38 86 Z';
      const cav = 'M 44 44 L 44 84 M 56 44 L 56 84';
      return [{ s: d }, { l: 'M 38 86 A 12 4.2 0 0 1 62 86' }, { f: ell(50, 86, 6.5, 2.2), o: 1 },
        { f: 'M 45 44 L 55 44 L 55 84 L 45 84 Z', o: 0.5, lo: true },
        { l: cav, hi: true, w: 0.7 }, { l: comb(42, 42, 58, 86, 3.4), hi: 64, w: 0.45, clip: 'M 44 44 L 56 44 L 56 84 L 44 84 Z' },
        { l: 'M 34 22 C 36 18, 40 16, 44 17', hi: true, w: 0.7 }];
    },
    fat() {
      // a belly: the waist, the belly bulging out below the navel, the waistband of the briefs and the legs below
      const side = 'M 28 6 C 28 16, 24.5 23, 22 31 C 19.5 39, 13.5 48, 13.5 60 C 13.5 68, 18 71, 20 75 C 21.5 79, 20.5 87, 19.5 95';
      const brief = 'M 20 74 C 34 77, 66 77, 80 74 M 20.5 79 C 33 82, 43 86, 46 93 L 54 93 C 57 86, 67 82, 79.5 79';
      const area = 'M 28 6 C 28 16, 24.5 23, 22 31 C 19.5 39, 13.5 48, 13.5 60 C 13.5 68, 18 71, 20 74 C 34 77, 66 77, 80 74' +
        ' C 82 71, 86.5 68, 86.5 60 C 86.5 48, 80.5 39, 78 31 C 75.5 23, 72 16, 72 6 Z';
      return [{ a: area, fade: [8, 40] }, { l: both(side) + ' ' + brief }, { f: ell(50, 53, 2.6, 3.6), o: 1, lo: true }, { l: ell(50, 53, 2.2, 3.4), hi: true }];
    },
    aorta() {
      // the arch as a cut vessel: the ascending aorta rising from its bulging root, the descending aorta running on
      // down; the three branches on top
      const root = u => 14 + 4 * Math.exp(-Math.pow((u - 0.04) / 0.035, 2));
      const c = tube('M 33 72 C 33 58, 29 42, 39 31 C 48 21, 64 21, 68 35 C 69.5 43, 69 52, 69 60 C 69 70, 69 82, 69 94', root, 'cut', 'cut');
      const out = [{ s: c.shape }, { l: c.rim }];
      [[42, -0.45], [51, 0.04], [59.5, 0.42]].forEach(([x, lean]) => {
        let b = c.R[0];
        for (const q of c.R) if (q[1] < 30 && Math.abs(q[0] - x) < Math.abs(b[0] - x)) b = q;
        const top = [b[0] + lean * 9, b[1] - 12.5];
        const t = tube([b[0], b[1] + 2, b[0], b[1] - 4, top[0], top[1] + 5, top[0], top[1]], 5.2, 'flat', 'cut');
        out.push({ s: t.shape, w: 0.8 }, { l: t.rim, w: 0.8 });
      });
      return out;
    },
  };

  // per id: { parts (paths built once, on first use), th (the pixel thresholds of its parts), memo (parts in use) }
  const cache = new Map();
  function icon(id) {
    if (cache.has(id)) return cache.get(id);
    if (!own(DEF, id) || typeof Path2D === 'undefined') { cache.set(id, null); return null; }
    const th = new Set(), parts = DEF[id]().map(p => {
      const q = Object.assign({}, p, {
        s: p.s && new Path2D(p.s), l: p.l && new Path2D(p.l), a: p.a && new Path2D(p.a),
        f: p.f && new Path2D(p.f), clip: p.clip && new Path2D(p.clip),
        hi: p.hi === true ? 40 : p.hi || 0, lo: p.lo === true ? 40 : p.lo || 0,
      });
      if (q.hi) th.add(q.hi); if (q.lo) th.add(q.lo);
      return q;
    });
    const I = { parts, th: [...th].sort((a, b) => a - b), memo: {} };
    cache.set(id, I);
    return I;
  }
  // the parts shown for a forced detail (true / false) or at vis pixels
  function pick(I, det, vis) {
    const key = det != null ? (det ? 'T' : 'F') : I.th.filter(t => vis >= t).length;
    if (I.memo[key]) return I.memo[key];
    const on = t => (det != null ? !!det : vis >= t);
    return (I.memo[key] = I.parts.filter(p => (p.lo ? !on(p.lo) : !p.hi || on(p.hi))));
  }
  const hex = c => { const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(c).trim()); if (!m) return null; let h = m[1]; if (h.length === 3) h = h.replace(/./g, x => x + x); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  // a colour's rgb (hex colours only) and its neon core (70 % towards white), kept per colour
  const cols = new Map();
  function colour(col) {
    let v = cols.get(col);
    if (v) return v;
    const c3 = hex(col);
    v = { c3, core: c3 ? rgba(c3.map(x => Math.round(x + (255 - x) * 0.7)), 1) : '#ffffff' };
    if (cols.size > 64) cols.clear();
    cols.set(col, v);
    return v;
  }

  // the stand-in for an id without an icon: a circle with its initials
  function stub(ctx, id, cx, cy, size, o) {
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle = o.color || '#ffffff';
    ctx.lineWidth = o.width || Math.max(1, size * 0.05);
    if (o.glow) { ctx.shadowColor = o.color || '#ffffff'; ctx.shadowBlur = size * 0.12; }
    ctx.beginPath(); ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `600 ${Math.round(size * 0.26)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((short.get(id) || String(id)).slice(0, 2), cx, cy);
    ctx.restore();
  }
  function strokes(ctx, use, lw, style, alpha) {
    ctx.strokeStyle = style; ctx.globalAlpha = alpha;
    for (const p of use) {
      const path = p.s || p.l; if (!path) continue;
      if (p.clip) { ctx.save(); ctx.clip(p.clip); }
      ctx.lineWidth = lw * (p.w || 1);
      ctx.stroke(path);
      if (p.clip) ctx.restore();
    }
  }

  // draw one icon centred at (cx, cy) in a square of side size (in the context's units). opts: color (CSS colour,
  // white), width (line width in the context's units; by default bolder at small sizes), glow (neon: a coloured blur,
  // a translucent fill and a light core), fill (0..1 alpha of the outlines' fill; 0, or 0.4 with glow),
  // detail (true/false: inner lines; by default from 40 pixels up), alpha (0..1). Sizes in pixels count a device
  // pixel ratio of up to 1.25 (an icon small on a phone's screen stays simple), the thinnest line is 1.15 device pixels.
  function draw(ctx, id, cx, cy, size, opts) {
    const o = opts || {}, I = icon(id);
    if (!I) return stub(ctx, id, cx, cy, size, o);
    const m = ctx.getTransform ? ctx.getTransform() : null, dpr = m ? Math.hypot(m.a, m.b) || 1 : 1;
    const px = size * dpr, vis = size * Math.min(dpr, 1.25), k = size / 100;
    const w = (o.width || Math.max(1.15 / dpr, size * (0.068 - 0.028 * clamp((vis - 24) / 56, 0, 1)))) / k;
    const col = o.color || '#ffffff', C = colour(col), c3 = C.c3, fill = o.fill != null ? o.fill : o.glow ? 0.4 : 0;
    const a0 = ctx.globalAlpha * (o.alpha != null ? o.alpha : 1), use = pick(I, o.detail, vis);
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(k, k);
    ctx.lineCap = ctx.lineJoin = 'round';
    // translucent fill of the outlines (a soft top-to-bottom gradient) and the parts that are always filled
    if (fill > 0) {
      const g = c3 ? ctx.createLinearGradient(0, 0, 0, 100) : null;
      if (g) { g.addColorStop(0, rgba(c3, Math.min(1, fill * 1.5))); g.addColorStop(1, rgba(c3, fill * 0.55)); }
      ctx.fillStyle = g || col; ctx.globalAlpha = a0 * (g ? 1 : fill);
      for (const p of use) {
        if (!(p.a || p.s)) continue;
        if (p.fade && c3) { const h = ctx.createLinearGradient(0, p.fade[0], 0, p.fade[1]); h.addColorStop(0, rgba(c3, 0)); h.addColorStop(1, rgba(c3, fill)); ctx.fillStyle = h; }
        ctx.fill(p.a || p.s);
        ctx.fillStyle = g || col;
      }
    }
    ctx.fillStyle = col;
    for (const p of use) if (p.f) { ctx.globalAlpha = a0 * p.o * (o.glow ? 0.85 : 1); ctx.fill(p.f); }
    if (o.glow) {
      ctx.shadowColor = col;
      ctx.shadowBlur = px * 0.16; strokes(ctx, use, w * 1.5, col, a0 * 0.55);
      ctx.shadowBlur = px * 0.05; strokes(ctx, use, w, col, a0);
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      strokes(ctx, use, w * 0.42, C.core, a0 * 0.9);
    } else strokes(ctx, use, w, col, a0);
    ctx.restore();
  }

  // all icons white on transparent in one CanvasTexture, a 4 x 4 grid of px-pixel cells (tint them in the shader);
  // px is rounded to a power of two from 16 to 512 (mipmaps on WebGL 1 too), the icons fill 86 % of a cell, the last
  // cell stays empty. Made for small sprites by default: bold lines (opts.width, a fraction of the icon: 0.075), the
  // simple shapes (opts.detail: false); { detail: true } bakes the inner lines with thin lines (0.04) for close views.
  const atlases = new Map();
  function atlas(THREE, px, opts) {
    const o = opts || {}, s = Math.pow(2, Math.round(Math.log2(clamp(px || 128, 16, 512))));
    const det = !!o.detail, wf = o.width > 0 ? o.width : det ? 0.04 : 0.075, key = s + ' ' + det + ' ' + wf;
    if (atlases.has(key)) return atlases.get(key);
    const G = ids.length < 16 ? 4 : Math.pow(2, Math.ceil(Math.log2(Math.sqrt(ids.length + 1)))), cv = document.createElement('canvas');
    cv.width = cv.height = s * G;
    const ctx = cv.getContext('2d');
    ids.forEach((id, i) => draw(ctx, id, (i % G + 0.5) * s, (Math.floor(i / G) + 0.5) * s, s * 0.86, { detail: det, width: s * 0.86 * wf }));
    const texture = new THREE.CanvasTexture(cv);
    texture.anisotropy = 4;
    // unknown ids get the last (empty) cell
    const uv = id => { let i = ids.indexOf(id); if (i < 0) i = G * G - 1; const x = i % G, y = Math.floor(i / G); return [x / G, 1 - (y + 1) / G, (x + 1) / G, 1 - y / G]; };
    const A = { texture, canvas: cv, uv };
    atlases.set(key, A);
    return A;
  }
  return { ids, draw, atlas };
})();
