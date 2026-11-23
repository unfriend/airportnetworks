// From tissue to cells (slides 36-41; Rendeiro et al., Nature 2021; Abila et al., Nature Medicine 2026): an
// H&E-stained section of stomach wall built from about 18,600 cells, the network of neighbouring cells, multiplexed
// imaging (cells coloured by type) and tissue regions lifting off into a low-dimensional embedding.
// The section is a thin curved slab. Its colour comes from stain maps made at load: the extracellular matrix
// (collagen, muscle, lumens, fat) and a pre-averaged copy of the cells for far views. Every cell is a splat that
// lies on the slab (an ellipse that turns with it) with its own nucleus, so close views stay sharp.
SETS.tissue = function (K) {
  const { THREE, v3, smooth, clamp, prog } = K;
  const set = K.newSet('tissue');
  const R = K.rng(4036), rr = (a, b) => a + (b - a) * R(), PI = Math.PI;

  // ------------------------------------------------------------- the section
  // Strip coordinates: s along the section (0..L), d depth below the lumen surface. In its own plane the strip
  // follows a gentle arc (lumen side outside) and is tilted a little; both ends bend towards the viewer (z = BK x^2).
  const L = 2.1, TH = 0.008, BK = 0.1, RA = 2.7, TILT = -0.15;
  // stain maps cover s in [MS0, MS0 + MSL], d in [MD0, MD0 + MDL]: matrix MW x MH texels, cell averages CW x CH
  const MS0 = -0.03, MSL = 2.16, MD0 = -0.03, MDL = 0.66, MW = 1024, MH = 512, CW = 512, CH = 256;
  const TS = MSL / MW, TD = MDL / MH;
  // seeded smooth noise in [-1, 1]
  function noise1(seed) {
    const r = K.rng(seed), v = new Float32Array(256);
    for (let i = 0; i < 256; i++) v[i] = r() * 2 - 1;
    return x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = v[i & 255]; return a + (v[(i + 1) & 255] - a) * u; };
  }
  function noise2(seed) {
    const r = K.rng(seed), v = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) v[i] = r() * 2 - 1;
    return (x, y) => {
      const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
      const a = v[(i & 63) | ((j & 63) << 6)], b = v[((i + 1) & 63) | ((j & 63) << 6)];
      const c = v[(i & 63) | (((j + 1) & 63) << 6)], e = v[((i + 1) & 63) | (((j + 1) & 63) << 6)];
      return a + (b - a) * u + (c - a) * w + (a - b - c + e) * u * w;
    };
  }
  const gs = (x, m, w) => Math.exp(-((x - m) / w) * ((x - m) / w));
  const nM = noise1(11), nS = noise1(12), nP = noise1(13), nT = noise1(14), nW = noise1(15);
  // layer boundaries at s: lumen surface, mucosa / submucosa (b1), submucosa / muscle (b2), inner / outer muscle (bm),
  // serosa; the cut ends are rounded
  function layers(s) {
    const top0 = 0.005 * nT(s * 7);
    const b1 = top0 + 0.158 + 0.012 * nM(s * 4) + 0.006 * nM(s * 13 + 40);
    const b2 = b1 + 0.12 + 0.09 * gs(s, 0.8, 0.55) + 0.03 * nS(s * 3) + 0.03 * gs(s, 1.9, 0.2);
    const bot0 = b2 + (0.17 + 0.08 * gs(s, 1.25, 0.6) + 0.03 * nP(s * 3.3)) * smooth((1.97 - s) / 0.3);
    const mid = (top0 + bot0) / 2, cl = 0.15, cr = 0.11;
    let e = 1;
    if (s < cl) e = Math.sqrt(Math.max(0, 1 - ((cl - s) / cl) ** 2));
    else if (s > L - cr) e = Math.sqrt(Math.max(0, 1 - ((s - L + cr) / cr) ** 2));
    return { top: mid - (mid - top0) * e, bot: mid + (bot0 - mid) * e, top0, b1, b2, bm: b2 + 0.42 * (bot0 - b2), e };
  }
  const cT = Math.cos(TILT), sT = Math.sin(TILT);
  let CX = 0, CY = 0, CZ = 0;
  function plane(s, d) {
    const a = (s - L / 2) / RA, q = RA - d, x = q * Math.sin(a), y = q * Math.cos(a) - RA;
    return [x * cT - y * sT - CX, x * sT + y * cT - CY];
  }
  const P3 = (s, d) => { const p = plane(s, d); return [p[0], p[1], BK * p[0] * p[0] - CZ]; };
  const nrm = x => v3.norm([-2 * BK * x, 0, 1]);
  // centre the section on the origin
  {
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (let k = 0; k <= 200; k++) {
      const s = L * k / 200, ly = layers(s);
      for (const d of [ly.top, ly.bot]) { const p = plane(s, d); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    }
    CX = (x0 + x1) / 2; CY = (y0 + y1) / 2;
    CZ = BK * ((x1 - x0) / 2) ** 2 / 2;
  }
  // gastric pits (foveolae) open on the surface; between them the surface rises in small rounded tips
  const pits = [];
  for (let s = 0.025; s < L - 0.02; s += 0.0145 + 0.006 * R()) pits.push(s);
  function notch(s) {
    let lo = 0, hi = pits.length - 1;
    if (s <= pits[0] || s >= pits[hi]) return 0;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pits[m] <= s) lo = m; else hi = m; }
    return 0.0075 * Math.pow(1 - Math.sin(PI * (s - pits[lo]) / (pits[hi] - pits[lo])), 3);
  }

  // ------------------------------------------------- the matrix (stain map)
  // one RGBA byte map, used as the texture as it is: R eosin (pink; 204 = 1), G empty space (lumens, fat, clefts),
  // B and A the fibre direction (doubled angle, 0.5 = 0) times its strength
  const MAT = new Uint8ClampedArray(MW * MH * 4), EB = 204;
  const ti = s => (s - MS0) / MSL * MW - 0.5, tj = d => (d - MD0) / MDL * MH - 0.5;
  const vAt = (s, d) => MAT[4 * (clamp(Math.round(ti(s)), 0, MW - 1) + MW * clamp(Math.round(tj(d)), 0, MH - 1)) + 1] / 255;
  const setV = (k, v) => { if (v * 255 > MAT[4 * k + 1]) MAT[4 * k + 1] = v * 255; };
  const nB = noise2(22);
  const fibreAng = (s, d) => 0.9 * nB(s * 9, d * 9);
  const LY = [];
  for (let i = 0; i < MW; i++) LY.push(layers(clamp(MS0 + (i + 0.5) * TS, 0, L)));
  // the collagen direction in the submucosa varies slowly: evaluate it every 4 texels and interpolate
  const FW = MW / 4 + 1, FH = MH / 4 + 1, FC = new Float32Array(FW * FH), FS = new Float32Array(FW * FH);
  function fibreField() {
    for (let i = 0; i < FW; i++) for (let j = 0; j < FH; j++) {
      const th = 2 * fibreAng(MS0 + 4 * i * TS, MD0 + 4 * j * TD);
      FC[i * FH + j] = Math.cos(th); FS[i * FH + j] = Math.sin(th);
    }
  }
  fibreField();
  // (hot loops live in small functions so the engine can optimise them)
  function fillColumn(i) {
    const s = MS0 + (i + 0.5) * TS, ly = LY[i], wav = 0.25 * nW(s * 9), top = ly.top, bot = ly.bot, mm = ly.b1 - 0.012, b1 = ly.b1, b2 = ly.b2, bm = ly.bm;
    const cw = 127.5 + 108 * Math.cos(2 * wav), sw = 127.5 + 108 * Math.sin(2 * wav), co = 127.5 + 108 * Math.cos(1.2 * wav), so = 127.5 + 108 * Math.sin(1.2 * wav);
    const fi = i / 4, i0 = Math.min(FW - 2, Math.floor(fi)), u = fi - i0;
    for (let j = 0; j < MH; j++) {
      let d = MD0 + (j + 0.5) * TD;
      if (d < top) d = top; else if (d > bot) d = bot;
      const k = 4 * (i + MW * j);
      if (d < mm) { MAT[k] = 0.4 * EB; MAT[k + 2] = 112; MAT[k + 3] = 128; }               // lamina propria between the glands
      else if (d < b1) { MAT[k] = 0.98 * EB; MAT[k + 2] = cw; MAT[k + 3] = sw; }           // muscularis mucosae
      else if (d < b2) {                                                                   // loose submucosa
        const fj = j / 4, j0 = Math.min(FH - 2, Math.floor(fj)), w = fj - j0, n0 = i0 * FH + j0, n1 = n0 + FH;
        const c = (FC[n0] * (1 - u) + FC[n1] * u) * (1 - w) + (FC[n0 + 1] * (1 - u) + FC[n1 + 1] * u) * w;
        const sn = (FS[n0] * (1 - u) + FS[n1] * u) * (1 - w) + (FS[n0 + 1] * (1 - u) + FS[n1 + 1] * u) * w;
        const l = 95 / (Math.sqrt(c * c + sn * sn) + 1e-6);
        MAT[k] = 0.36 * EB; MAT[k + 2] = 127.5 + c * l; MAT[k + 3] = 127.5 + sn * l;
      } else if (d < bm) { MAT[k] = 0.95 * EB; MAT[k + 2] = 102; MAT[k + 3] = 128; }      // inner muscle, fibres cut across
      else { MAT[k] = 0.97 * EB; MAT[k + 2] = co; MAT[k + 3] = so; }                       // outer muscle, fibres along the cut
    }
  }
  for (let i = 0; i < MW; i++) fillColumn(i);
  const layerAt = s => LY[clamp(Math.round(ti(s)), 0, MW - 1)];
  // paint an ellipse (centre s, d; semi-axes a, b; angle): fn(texel, rho) wherever rho (1 at the rim) < lim
  function paintEll(s, d, a, b, ang, lim, fn) {
    const ext = Math.max(a, b) * lim + 0.002, c = Math.cos(ang), sn = Math.sin(ang);
    const i0 = Math.max(0, Math.floor(ti(s - ext))), i1 = Math.min(MW - 1, Math.ceil(ti(s + ext)));
    const j0 = Math.max(0, Math.floor(tj(d - ext))), j1 = Math.min(MH - 1, Math.ceil(tj(d + ext)));
    for (let j = j0; j <= j1; j++) {
      const dd = MD0 + (j + 0.5) * TD - d;
      for (let i = i0; i <= i1; i++) {
        const ds = MS0 + (i + 0.5) * TS - s, u = (ds * c + dd * sn) / a, w = (dd * c - ds * sn) / b, rho = Math.sqrt(u * u + w * w);
        if (rho < lim) fn(i + MW * j, rho);
      }
    }
  }
  const SOFT = 0.0016;   // soft edges of painted shapes, in local units
  const voidEll = (s, d, a, b, ang, str = 1) => {
    const ew = SOFT / Math.min(a, b);
    paintEll(s, d, a, b, ang, 1 + ew, (k, rho) => setV(k, str * clamp((1 - rho) / ew + 0.5, 0, 1)));
  };
  // a vertical slit (a pit or gland lumen) from d0 to d1 around the axis sx(d), half-width hw(d)
  function voidSlit(sx, d0, d1, hw, str = 1) {
    for (let j = Math.max(0, Math.floor(tj(d0))); j <= Math.min(MH - 1, Math.ceil(tj(d1))); j++) {
      const d = MD0 + (j + 0.5) * TD, c = sx(d), w = hw(d), f = clamp((d - d0) / 0.002, 0, 1) * clamp((d1 - d) / 0.002, 0, 1);
      for (let i = Math.max(0, Math.floor(ti(c - w - 0.003))); i <= Math.min(MW - 1, Math.ceil(ti(c + w + 0.003))); i++) {
        setV(i + MW * j, str * f * clamp(0.5 - (Math.abs(MS0 + (i + 0.5) * TS - c) - w) / SOFT, 0, 1));
      }
    }
  }

  // ------------------------------------------------------------------ cells
  // cell: [s, d, angle, a, b, nucleus a, nucleus b, nucleus offset (along a, in units of a), cytoplasm rgb, alpha,
  //        nucleus rgb, type, foam]; types: 0 epithelial, 1 immune, 2 stromal, 3 endothelial, 4 smooth muscle, 5 red blood
  //        cell; foam (0..1): pale, bubbly cytoplasm, as in the mucus-filled gland cells
  const cells = [];
  const OG = 0.006, OW = Math.ceil(MSL / OG) + 2, OH = Math.ceil(MDL / OG) + 2;
  const occHead = new Int32Array(OW * OH).fill(-1), occNext = [];
  const oc = (s, d) => clamp(Math.floor((s - MS0) / OG), 0, OW - 1) + OW * clamp(Math.floor((d - MD0) / OG), 0, OH - 1);
  function free(s, d, rm) {
    const i0 = clamp(Math.floor((s - MS0) / OG), 1, OW - 2), j0 = clamp(Math.floor((d - MD0) / OG), 1, OH - 2);
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      for (let k = occHead[i + OW * j]; k >= 0; k = occNext[k]) {
        const c = cells[k];
        if ((c[0] - s) ** 2 + (c[1] - d) ** 2 < rm * rm) return false;
      }
    }
    return true;
  }
  // Beer-Lambert stain colours: optical densities of haematoxylin (purple) and eosin (pink)
  // (haematoxylin OD 1.31, 1.37, 0.62; eosin OD 0.16, 1.05, 0.6, fitted to the slides)
  const he = (H, Eo) => [Math.exp(-(H * 1.31 + Eo * 0.16)), Math.exp(-(H * 1.37 + Eo * 1.05)), Math.exp(-(H * 0.62 + Eo * 0.6))];
  const inside = (s, d) => { if (s < 0.004 || s > L - 0.004) return false; const ly = layerAt(s); return d > ly.top + 0.0015 && d < ly.bot - 0.0015; };
  function addCell(s, d, ang, a, b, na, nb, no, cyt, ca, nuc, type, foam = 0) {
    if (!inside(s, d)) return null;
    const c = [s, d, ang, a, b, na, nb, no, cyt[0], cyt[1], cyt[2], ca, nuc[0], nuc[1], nuc[2], type, foam];
    const o = oc(s, d);
    occNext.push(occHead[o]); occHead[o] = cells.length; cells.push(c);
    return c;
  }
  // gland bodies: one splat per acinus drawn under its cells (its 'nucleus' is the white lumen); not a cell
  const fills = [];
  const addFill = (s, d, ang, a, b, na, nb, col) => { if (inside(s, d)) fills.push([s, d, ang, a, b, na, nb, 0, ...col, 0.9, 0.96, 0.94, 0.96, 6, 0]); };
  const vary = x => x * rr(0.88, 1.12);
  const NUC = () => he(vary(1.3), 0.35);
  // the kinds of cell, as they look in H&E
  const foveolar = (s, d, ang) => addCell(s, d, ang, 0.0035, 0.0019, 0.0012, 0.0008, 0.5, he(vary(0.36), vary(0.3)), 0.85, NUC(), 0, 0.5);
  const neck = (s, d, ang) => addCell(s, d, ang, 0.0032, 0.0021, 0.0011, 0.0009, 0.45, he(vary(0.5), vary(0.44)), 0.82, NUC(), 0, 0.7);
  const chief = (s, d, ang) => addCell(s, d, ang, 0.0033, 0.0025, 0.0012, 0.0011, 0.5, he(vary(0.58), vary(0.44)), 0.8, NUC(), 0, 1);
  const parietal = (s, d, ang) => addCell(s, d, ang, 0.0034, 0.003, 0.0011, 0.0011, 0.05, he(vary(0.08), vary(0.62)), 0.85, NUC(), 0);
  const smc = (s, d, ang, a = 0.0066, b = 0.0015) => addCell(s, d, ang, a, b, a * 0.42, 0.00075, rr(-0.25, 0.25), he(0.04, vary(0.85)), 0.8, NUC(), 4);
  const lympho = (s, d) => addCell(s, d, R() * PI, 0.0019, 0.0018, 0.00165, 0.0016, 0, he(0.3, 0.3), 0.7, he(vary(1.35), 0.35), 1);
  const plasma = (s, d) => addCell(s, d, R() * 2 * PI, 0.0025, 0.0019, 0.0013, 0.0013, 0.35, he(0.42, 0.3), 0.8, he(vary(1.25), 0.3), 1);
  const fibro = (s, d, ang) => addCell(s, d, ang, 0.0048, 0.0011, 0.0034, 0.0008, 0, he(0.04, 0.5), 0.35, he(vary(1.15), 0.3), 2);
  const endo = (s, d, ang) => addCell(s, d, ang, 0.0034, 0.0009, 0.0026, 0.0007, 0, he(0.05, 0.5), 0.6, he(vary(1.1), 0.3), 3);
  const rbc = (s, d) => addCell(s, d, 0, 0.0017, 0.0017, 0, 0, 0, [rr(0.82, 0.9), rr(0.2, 0.28), rr(0.22, 0.28)], 0.9, [0, 0, 0], 5);

  // a lymphoid aggregate at the base of the mucosa (glands give way to it)
  const AG = { s: 0.6, d: layerAt(0.6).b1 - 0.008, a: 0.046, b: 0.032 };
  const inAgg = (s, d, m = 0) => ((s - AG.s) / (AG.a + m)) ** 2 + ((d - AG.d) / (AG.b + m)) ** 2 < 1;
  // the packed lymphocytes push the muscularis mucosae and the collagen aside: loose, fibre-free matrix under it
  paintEll(AG.s, AG.d, AG.a, AG.b, 0, 1.1, (k, rho) => {
    const w = clamp((1.1 - rho) / 0.15, 0, 1);
    MAT[4 * k] += (0.4 * EB - MAT[4 * k]) * w; MAT[4 * k + 2] += (127.5 - MAT[4 * k + 2]) * w; MAT[4 * k + 3] += (127.5 - MAT[4 * k + 3]) * w;
  });
  // the zoom patch: deep glands above, the muscularis mucosae, loose tissue with an artery and a vein below
  const sZ = 1.27, dZ = layerAt(sZ).b1 + 0.004, DM = 1.3;   // DM: about the farthest any cell is from it

  // mucosa: pits lined by pale mucous cells, then straight gland necks with pink parietal cells, then the coiled
  // gland bases cut across as round acini of purple chief cells
  // an acinus: the coiled base of a gland cut across, a ring of chief cells (a few parietal cells) round a tiny lumen
  function acinus(cs, cd, ra, base) {
    if (cd + ra > base || inAgg(cs, cd, ra)) return;
    voidEll(cs, cd, 0.0011, 0.0011, 0, 0.9);
    addFill(cs, cd, 0, ra - 0.0006, (ra - 0.0006) * rr(0.9, 1), 0.0011, 0.0011, he(rr(0.48, 0.56), rr(0.4, 0.48)));
    const rc = ra - 0.0031, n = Math.round(2 * PI * rc / 0.0041), p0 = R() * 6.28;
    for (let k = 0; k < n; k++) {
      const t = p0 + 2 * PI * k / n, x = cs + Math.cos(t) * rc, y = cd + Math.sin(t) * rc;
      if (!free(x, y, 0.0031)) continue;
      if (R() < 0.1) parietal(x, y, t); else chief(x, y, t);
    }
  }
  // a straight stretch of gland (pit or neck) along ax(d) from d0 to d1: its body, with the lumen as a slit
  // (in short overlapping pieces, so it can bend)
  const tubeFill = (ax, d0, d1, b, lw, col) => {
    const n = Math.max(1, Math.round((d1 - d0) / 0.011)), h = (d1 - d0) / n;
    for (let q = 0; q < n; q++) {
      const da = d0 + q * h, db = da + h, a = Math.hypot(h, ax(db) - ax(da)) / 2 + 0.0028;
      addFill((ax(da) + ax(db)) / 2, (da + db) / 2, Math.atan2(h, ax(db) - ax(da)), a, b, a * 0.97, lw, col);
    }
  };
  function glands() {
    for (let k = 0; k < pits.length; k++) {
      const s0 = pits[k], ly = layerAt(s0);
      const top = ly.top0, base = ly.b1 - 0.013, M = base - top;
      const pd = top + M * rr(0.27, 0.36), nd = top + M * rr(0.55, 0.62), sl = rr(-0.06, 0.06);
      const am = rr(0.0008, 0.0022), fq = rr(60, 120), ph = R() * 6.28;
      const ax = d => s0 + sl * (d - top) + am * Math.sin((d - top) * fq + ph);
      const across = d => Math.atan2(-(sl + am * fq * Math.cos((d - top) * fq + ph)), 1);   // perpendicular to the gland
      const pw = d => 0.0008 + 0.0005 * clamp(1 - (d - top) / (pd - top), 0, 1);
      voidSlit(ax, top - 0.012, pd, pw, 0.85);
      tubeFill(ax, top, pd, 0.0076, 0.0009, he(rr(0.42, 0.52), rr(0.32, 0.4)));
      for (let d = top + 0.0025; d < pd; d += 0.0041) {
        const w = pw(d) + 0.0035, t = across(d);
        foveolar(ax(d) - w, d, t + PI); foveolar(ax(d) + w, d, t);
      }
      if (inAgg(s0, nd, 0.004)) continue;
      voidSlit(ax, pd, nd, () => 0.0006);
      tubeFill(ax, pd, nd, 0.0074, 0.0007, he(rr(0.46, 0.54), rr(0.42, 0.5)));
      for (let d = pd + 0.002; d < nd; d += 0.0042 + 0.0008 * R()) {
        const t = across(d);
        for (const sd of [-1, 1]) {
          if (inAgg(ax(d), d, 0.004)) continue;
          if (R() < 0.3) parietal(ax(d) + sd * 0.0043, d + rr(-0.001, 0.001), t + (sd > 0 ? 0 : PI));
          else neck(ax(d) + sd * 0.004, d, t + (sd > 0 ? 0 : PI));
        }
      }
      // gland bases: acini under this pit and, staggered, between it and the next
      for (let d = nd; d < base;) { const ra = rr(0.0074, 0.0096); acinus(ax(nd) + rr(-0.002, 0.002), d + ra, ra, base); d += 2 * ra * rr(0.9, 1); }
      if (k + 1 < pits.length) {
        const sm = (s0 + pits[k + 1]) / 2;
        for (let d = nd + rr(0.006, 0.01); d < base;) { const ra = rr(0.007, 0.009); if (R() < 0.55) acinus(sm + rr(-0.001, 0.001), d + ra, ra, base); d += 2 * ra * rr(1, 1.15); }
      }
    }
  }
  glands();
  function mucosaMuscle() {
    // muscularis mucosae: three rows of smooth muscle along the section
    for (let r = 0; r < 3; r++) {
      for (let s = 0.01 + r * 0.0045 + R() * 0.004; s < L; s += 0.0135 + R() * 0.002) {
        const ly = layerAt(s), d = ly.b1 - 0.0022 - r * 0.0034 + rr(-0.0006, 0.0006);
        if (inAgg(s, d)) continue;
        smc(s, d, 0.25 * nW(s * 9) + rr(-0.08, 0.08));
      }
    }
  }
  mucosaMuscle();

  // submucosa: vessels (artery, vein, lymphatic) with their wall cells and a pale shrinkage halo, red cells in some
  const vessels = [];
  const lyZ = layerAt(sZ);
  vessels.push({ s: sZ + 0.034, d: lyZ.b1 + 0.031, r: 0.0165, asp: 1.15, ang: 0.3, kind: 0 });
  vessels.push({ s: sZ - 0.05, d: lyZ.b1 + 0.044, r: 0.013, asp: 2.3, ang: -0.25, kind: 1 });
  function placeVessels() {
    for (let n = 0; n < 900 && vessels.length < 30; n++) {
      const s = rr(0.22, 1.92), ly = layerAt(s), r = rr(0.006, 0.012) + 0.012 * R() * R(), asp = rr(1, 2.6);
      const d = rr(ly.b1 + r + 0.012, ly.b2 - r - 0.01);
      if (!(d > ly.b1) || inAgg(s, d, 1.6 * r + 0.004) || vessels.some(v => Math.hypot(v.s - s, v.d - d) < v.r * 1.4 + r * 1.4 + 0.02)) continue;
      vessels.push({ s, d, r, asp, ang: rr(-0.6, 0.6), kind: R() < 0.4 ? 0 : R() < 0.8 ? 1 : 2 });
    }
  }
  placeVessels();
  const ellPt = (v, rho, t) => {   // a point on the vessel's ellipse scaled by rho, at parameter t
    const A = v.r * Math.sqrt(v.asp), B = v.r / Math.sqrt(v.asp), x = A * rho * Math.cos(t), y = B * rho * Math.sin(t);
    const c = Math.cos(v.ang), sn = Math.sin(v.ang);
    return [v.s + x * c - y * sn, v.d + x * sn + y * c, Math.atan2(-A * Math.sin(t) * sn + B * Math.cos(t) * c, -A * Math.sin(t) * c - B * Math.cos(t) * sn)];
  };
  function vesselParts(v) {
    const A = v.r * Math.sqrt(v.asp), B = v.r / Math.sqrt(v.asp), lr = [0.42, 0.72, 0.88][v.kind];
    // matrix: lumen empty, wall deep pink, a thin shrinkage gap around it
    paintEll(v.s, v.d, A, B, v.ang, 1 + 0.0042 / B, (k, rho) => {
      if (rho > 1) setV(k, 0.5 * clamp((rho - 1) / (0.001 / B), 0, 1) * clamp((1 + 0.0042 / B - rho) / (0.0016 / B), 0, 1));
      else MAT[4 * k] = Math.max(MAT[4 * k], 1.05 * EB * clamp((1 - rho) / (0.0008 / B), 0, 1));
    });
    voidEll(v.s, v.d, A * lr, B * lr, v.ang, 1);
    const per = rho => PI * (A + B) * rho;   // rough circumference
    // endothelium lines the lumen
    for (let n = Math.max(5, Math.round(per(lr) / 0.0062)), k = 0; k < n; k++) {
      const p = ellPt(v, lr + 0.0011 / B, 2 * PI * (k + R() * 0.3) / n);
      endo(p[0], p[1], p[2]);
    }
    // smooth muscle rings (several in arteries, one in veins, none in lymphatics)
    if (v.kind < 2) {
      for (let rho = lr + 0.0035 / B; rho < 1 - 0.0012 / B; rho += 0.0034 / B) {
        const n = Math.max(5, Math.round(per(rho) / 0.0092)), o = R();
        for (let k = 0; k < n; k++) { const p = ellPt(v, rho, 2 * PI * (k + o) / n); smc(p[0], p[1], p[2], 0.0045, 0.0015); }
        if (v.kind === 1) break;
      }
    }
    // red blood cells left in some lumens
    const fill = R() < 0.6 ? rr(0.05, 0.35) : 0, nr = Math.round(fill * PI * A * B * lr * lr / (PI * 0.0018 * 0.0018));
    for (let k = 0; k < nr; k++) {
      const t = R() * 2 * PI, rho = Math.sqrt(R()) * lr * 0.85, p = ellPt(v, rho, t);
      if (free(p[0], p[1], 0.0026)) rbc(p[0], p[1]);
    }
  }
  vessels.forEach(vesselParts);
  const nearVessel = (s, d, m) => vessels.some(v => Math.hypot(v.s - s, v.d - d) < v.r * Math.sqrt(v.asp) + m);
  function fat() {
    // fat: lobules of large empty adipocytes with thin pink walls
    const fatCells = [];
    for (const F of [{ s: 1.0, a: 0.075, b: 0.04 }, { s: 0.36, a: 0.05, b: 0.03 }]) {
      const ly = layerAt(F.s); F.d = (ly.b1 + ly.b2) / 2 + 0.01;
      for (let n = 0; n < 700; n++) {
        const s = F.s + rr(-1, 1) * F.a, d = F.d + rr(-1, 1) * F.b, r = rr(0.0052, 0.0075);
        if (((s - F.s) / F.a) ** 2 + ((d - F.d) / F.b) ** 2 > 1 || nearVessel(s, d, r + 0.004)) continue;
        if (fatCells.some(f => Math.hypot(f[0] - s, f[1] - d) < f[2] + r + 0.0011)) continue;
        fatCells.push([s, d, r]);
      }
    }
    for (const [s, d, r] of fatCells) {
      voidEll(s, d, r, r * rr(0.85, 1), R() * PI, 1);
      if (R() < 0.3) { const t = R() * 2 * PI; fibro(s + Math.cos(t) * (r + 0.0006), d + Math.sin(t) * (r + 0.0006), t + PI / 2); }
    }
  }
  fat();
  function holes() {
    // loose tissue: many small clefts and spaces between the collagen bundles
    for (let n = 0, made = 0; n < 4000 && made < 320; n++) {
      const s = rr(0.05, L - 0.05), ly = layerAt(s), a = 0.0025 + 0.016 * Math.pow(R(), 2.4), asp = rr(1.3, 3.5) + (R() < 0.15 ? 5 : 0);
      const d = rr(ly.b1 + 0.004, ly.b2 - 0.004);
      if (d - a / asp < ly.b1 + 0.003 || d + a / asp > ly.b2 - 0.002 || nearVessel(s, d, a + 0.006) || inAgg(s, d, a + 0.004)) continue;
      voidEll(s, d, a, a / asp, fibreAng(s, d) + rr(-0.3, 0.3), rr(0.75, 1));
      made++;
    }
  }
  holes();
  function tears() {
    // tears along the submucosa / muscle boundary
    for (let k = 0; k < 7; k++) {
      const s0 = rr(0.15, 1.7), len = rr(0.06, 0.22);
      for (let s = s0; s < s0 + len; s += TS) {
        const ly = layerAt(s), w = 0.0018 * Math.sin(PI * (s - s0) / len);
        for (let j = Math.floor(tj(ly.b2 - 0.004)); j <= Math.ceil(tj(ly.b2 + 0.004)); j++) {
          const i = Math.round(ti(s)), x = Math.abs(MD0 + (j + 0.5) * TD - ly.b2 - 0.001) - w;
          if (i >= 0 && i < MW && j >= 0 && j < MH) setV(i + MW * j, 0.9 * clamp(0.5 - x / SOFT, 0, 1));
        }
      }
    }
  }
  tears();
  // muscle: thin pale septa between the fascicles (polygons where the fibres are cut across, long streaks where
  // they run along the section) and a septum between the two layers
  const SG = 0.03, SA = 2.4, SGW = Math.ceil(L / SA / SG) + 2, SGH = Math.ceil(MDL / SG) + 1, SX = new Float32Array(SGW * SGH), SY = new Float32Array(SGW * SGH);
  for (let i = 0; i < SGW; i++) for (let j = 0; j < SGH; j++) { SX[i * SGH + j] = (i + 0.15 + 0.7 * R()) * SG; SY[i * SGH + j] = MD0 + (j + 0.15 + 0.7 * R()) * SG; }
  const nG = noise1(31), nG2 = noise1(32);
  function septaColumn(i) {
    const s = MS0 + (i + 0.5) * TS, ly = LY[i], s2 = s / SA, gi = Math.floor(s2 / SG);
    for (let j = Math.max(0, Math.floor(tj(ly.b2))); j < MH; j++) {
      const d = MD0 + (j + 0.5) * TD, k = i + MW * j;
      if (d > ly.bot + 0.003) break;
      if (d < ly.b2 - 0.003) continue;
      let x;
      if (d < ly.bm) {   // distance to the nearest Voronoi border of the fascicle seeds
        let d1 = 9, d2 = 9, k1 = -1, k2 = -1;
        const gj = Math.floor((d - MD0) / SG);
        for (let a = Math.max(0, gi - 1); a <= Math.min(SGW - 1, gi + 1); a++) {
          for (let b = Math.max(0, gj - 1); b <= Math.min(SGH - 1, gj + 1); b++) {
            const n = a * SGH + b, q = (SX[n] - s2) * (SX[n] - s2) + (SY[n] - d) * (SY[n] - d);
            if (q < d1) { d2 = d1; k2 = k1; d1 = q; k1 = n; } else if (q < d2) { d2 = q; k2 = n; }
          }
        }
        x = k2 >= 0 && (k1 * 7 + k2 * 13) % 5 > 1 ? (d2 - d1) / (2 * Math.hypot(SX[k2] - SX[k1], SY[k2] - SY[k1])) - 0.0005 : 1;
      } else {
        // clefts between bundles cut along: rows about 0.024 apart, each wandering on its own and broken into
        // staggered streaks that taper at their ends and vary in width (not unbroken parallel lines)
        const e = d - ly.bm + 0.012 * nG2(s * 6) + 0.004 * nG2(s * 23 + 9), r0 = Math.round(e / 0.024);
        x = 1;
        for (let rf = r0 - 1; rf <= r0 + 1; rf++) {
          const g = nG(s * 6.5 + 17 * rf), tp = clamp((g + 0.05) / 0.3, 0, 1);
          if (tp <= 0) continue;
          const c = rf * 0.024 + 0.0055 * nG2(s * 2.6 + 7.1 * rf + 3), hw = 0.0011 * (0.25 + 0.75 * (0.5 + 0.5 * nG(s * 17 + 5 * rf))) * tp;
          x = Math.min(x, Math.abs(e - c) - hw + (1 - tp) * 0.0016);
        }
      }
      x = Math.min(x, Math.abs(d - ly.bm) - 0.0012);
      const sv = clamp(0.5 - x / SOFT, 0, 1);
      if (sv > 0) { const inner = d < ly.bm; setV(k, (inner ? 0.3 : 0.75) * sv); MAT[4 * k] *= 1 - (inner ? 0.25 : 0.5) * sv; }
    }
  }
  for (let i = 0; i < MW; i++) septaColumn(i);
  function muscleCells() {
    // muscle cells: round profiles where cut across, long spindles where cut along
    for (let s = 0.004; s < L; s += 0.0056 * 0.866) {
      const ly = layerAt(s), off = (Math.round(s / (0.0056 * 0.866)) & 1) * 0.0028;
      for (let d = ly.b2 + 0.003 + off; d < ly.bm - 0.0015; d += 0.0056) {
        const x = s + rr(-0.0017, 0.0017), y = d + rr(-0.0017, 0.0017);
        if (R() < 0.25 || vAt(x, y) > 0.3) continue;
        // only some of the cut fibres show their nucleus
        const a = rr(0.0024, 0.0031), nu = R() < 0.55 ? rr(0.0008, 0.0011) : 0;
        addCell(x, y, R() * PI, a, a * rr(0.7, 1), nu, nu * rr(0.8, 1), 0, he(0.04, vary(0.95)), 0.4, NUC(), 4);
      }
    }
    for (let row = 0; row < 200; row++) {
      let any = false;
      for (let s = R() * 0.0165; s < L; s += 0.0165 + rr(-0.002, 0.002)) {
        const ly = layerAt(s), d = ly.bm + 0.0024 + row * 0.0042 + rr(-0.0005, 0.0005);
        if (d > ly.bot - 0.002) continue;
        any = true;
        if (vAt(s, d) > 0.3) continue;
        smc(s, d, 0.15 * nW(s * 9) + rr(-0.06, 0.06), 0.0072, 0.0016);
      }
      if (!any && row > 10) break;
    }
  }
  muscleCells();
  function fillers() {
    // the lymphoid aggregate: lymphocytes packed densely and irregularly (random positions, nuclei almost touching),
    // thinning out towards a lumpy edge
    const nAg = noise2(42);
    for (let n = 0; n < 4500; n++) {
      const x = AG.s + rr(-1.1, 1.1) * AG.a, y = AG.d + rr(-1.1, 1.1) * AG.b, u = (x - AG.s) / AG.a, w = (y - AG.d) / AG.b, h = Math.hypot(u, w);
      const rho = h / (1 + 0.16 * nAg(1.3 * u / (h + 1e-6) + 20, 1.3 * w / (h + 1e-6) + 20));
      if (rho < 1.06 && vAt(x, y) < 0.3 && free(x, y, 0.0029 + 0.0032 * smooth((rho - 0.62) / 0.44))) lympho(x, y);
    }
    // lamina propria: immune cells and a few fibroblasts between the glands
    for (let n = 0; n < 9000; n++) {
      const s = rr(0.02, L - 0.02), ly = layerAt(s), d = rr(ly.top0 + 0.004, ly.b1 - 0.013);
      if (vAt(s, d) > 0.3 || !free(s, d, 0.0036)) continue;
      const u = R();
      if (u < 0.62) lympho(s, d); else if (u < 0.82) plasma(s, d); else fibro(s, d, PI / 2 + rr(-0.4, 0.4));
    }
    // submucosa: spindle fibroblasts along the collagen, a few immune cells and capillaries
    for (let n = 0; n < 9000; n++) {
      const s = rr(0.02, L - 0.02), ly = layerAt(s), d = rr(ly.b1 + 0.002, ly.b2 - 0.002);
      if (vAt(s, d) > 0.25 || !free(s, d, 0.0085)) continue;
      const u = R();
      if (u < 0.84) fibro(s, d, fibreAng(s, d) + rr(-0.25, 0.25)); else if (u < 0.94) lympho(s, d); else endo(s, d, fibreAng(s, d));
    }
  }
  fillers();

  // --------------------------------------------------------- the stain maps
  const TYPE_COL = ['#ffd84a', '#ff5a4b', '#3ee08f', '#ff5ad9', '#4d94ff', '#ff5a4b', '#5a4c1a'].map(K.rgb);
  cells.unshift(...fills);   // gland bodies first, so their cells draw over them
  const TYPE_NAME = ['Epithelial', 'Immune', 'Stromal', 'Endothelial', 'Smooth muscle'];
  // the cells, pre-averaged for far views (premultiplied colour and coverage), in stain and in fluorescence
  const cHE = new Float32Array(CW * CH * 4), cMK = new Float32Array(CW * CH * 4), tArea = (MSL / CW) * (MDL / CH);
  const FOOT = [0.25, 0.5, 0.25];   // a 3x3 footprint, about the size of a cell
  function rasterCell(c) {
    const ac = PI * c[3] * c[4], an = PI * c[5] * c[6], wc = c[11] * (ac - an) / tArea, wn = 0.95 * an / tArea, tc = TYPE_COL[c[15]];
    const wm = c[15] === 5 ? 0 : (0.64 * (ac - an) + 0.27 * an) / tArea, i = Math.round((c[0] - MS0) / MSL * CW - 0.5), j = Math.round((c[1] - MD0) / MDL * CH - 0.5);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = i + dx, y = j + dy;
      if (x < 0 || y < 0 || x >= CW || y >= CH) continue;
      const k = 4 * (x + CW * y), wt = FOOT[dx + 1] * FOOT[dy + 1];
      cHE[k] += (c[8] * wc + c[12] * wn) * wt; cHE[k + 1] += (c[9] * wc + c[13] * wn) * wt; cHE[k + 2] += (c[10] * wc + c[14] * wn) * wt;
      cHE[k + 3] += (wc + wn) * wt;
      if (wm) { cMK[k] += tc[0] * wm * wt; cMK[k + 1] += tc[1] * wm * wt; cMK[k + 2] += tc[2] * wm * wt; cMK[k + 3] += (wc + wn) * wt; }
    }
  }
  for (const c of cells) rasterCell(c);
  function pack(f) {   // premultiplied colour and coverage, coverage capped at 1, to bytes
    const out = new Uint8Array(f.length);
    for (let k = 0; k < f.length; k += 4) {
      const n = f[k + 3] > 1 ? 255 / f[k + 3] : 255;
      out[k] = Math.min(255, f[k] * n); out[k + 1] = Math.min(255, f[k + 1] * n); out[k + 2] = Math.min(255, f[k + 2] * n); out[k + 3] = Math.min(255, f[k + 3] * n);
    }
    return out;
  }
  const dataTex = (arr, w, h) => {
    const t = new THREE.DataTexture(arr, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; t.needsUpdate = true;
    return t;
  };
  const texM = dataTex(MAT, MW, MH), texHE = dataTex(pack(cHE), CW, CH), texMK = dataTex(pack(cMK), CW, CH);

  // --------------------------------------------------------------- the slab
  const NC = 840, NR = 12, NV = (NC + 1) * (NR + 1);
  const nVert = NV * 2 + (NC + 1) * 4, sPos = new Float32Array(nVert * 3), sUv = new Float32Array(nVert * 2), sWall = new Float32Array(nVert);
  const idx = new Uint32Array(NC * NR * 12 + NC * 12);
  let vi = 0, ii = 0;
  function put(s, d, side, w) {
    const a = (s - L / 2) / RA, q = RA - d, x0 = q * Math.sin(a), y0 = q * Math.cos(a) - RA;
    const x = x0 * cT - y0 * sT - CX, y = x0 * sT + y0 * cT - CY, nx = -2 * BK * x, nl = Math.sqrt(nx * nx + 1), o = side * TH / 2 / nl;
    sPos[3 * vi] = x + nx * o; sPos[3 * vi + 1] = y; sPos[3 * vi + 2] = BK * x * x - CZ + o;
    sUv[2 * vi] = (s - MS0) / MSL; sUv[2 * vi + 1] = (d - MD0) / MDL; sWall[vi] = w;
    return vi++;
  }
  const tri = (a, b, c) => { idx[ii++] = a; idx[ii++] = b; idx[ii++] = c; };
  function buildSlab() {
    const tops = new Float32Array(NC + 1), bots = new Float32Array(NC + 1);
    for (let c = 0; c <= NC; c++) { const s = L * c / NC, ly = layers(s); tops[c] = ly.top + notch(s) * ly.e ** 4; bots[c] = ly.bot; }
    for (const side of [1, -1]) for (let c = 0; c <= NC; c++) for (let r = 0; r <= NR; r++) put(L * c / NC, tops[c] + (bots[c] - tops[c]) * r / NR, side, 0);
    for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
      const a = c * (NR + 1) + r, b = a + NR + 1;
      tri(a, a + 1, b + 1); tri(a, b + 1, b);                             // front (faces +z)
      tri(NV + a, NV + b + 1, NV + a + 1); tri(NV + a, NV + b, NV + b + 1); // back
    }
    for (const r of [0, NR]) {   // the cut edges of the slab: lumen side and serosa side
      const base = vi;
      for (let c = 0; c <= NC; c++) { const s = L * c / NC, d = r ? bots[c] : tops[c]; put(s, d, 1, 1); put(s, d, -1, 1); }
      for (let c = 0; c < NC; c++) {
        const f0 = base + 2 * c, b0 = f0 + 1, f1 = f0 + 2, b1 = f0 + 3;
        if (r === 0) { tri(f0, f1, b1); tri(f0, b1, b0); } else { tri(f0, b1, f1); tri(f0, b0, b1); }
      }
    }
  }
  buildSlab();
  const slabGeo = new THREE.BufferGeometry();
  slabGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  slabGeo.setAttribute('uv', new THREE.BufferAttribute(sUv, 2));
  slabGeo.setAttribute('aWall', new THREE.BufferAttribute(sWall, 1));
  slabGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  slabGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.2);
  const slabU = { uA: set.uA, tM: { value: texM }, tC: { value: texHE }, tK: { value: texMK }, uMark: { value: 0 }, uCells: { value: 1 },
    uGhost: { value: 0 }, uSz: { value: new THREE.Vector2(MSL, MDL) }, uZ: { value: new THREE.Vector2(sZ - MS0, dZ - MD0) },
    uAg: { value: new THREE.Vector4(AG.s - MS0, AG.d - MD0, AG.a, AG.b) } };
  // premultiplied blending: opaque as a section, a faint glassy glow as a ghost (never a dark pane, also in AR)
  const slabMat = new THREE.ShaderMaterial({
    uniforms: slabU, transparent: true, extensions: { derivatives: true },
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `attribute float aWall; varying vec2 vUv; varying float vWall;
void main() { vUv = uv; vWall = aWall; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tM, tC, tK; uniform float uA, uMark, uCells, uGhost; uniform vec2 uSz, uZ; uniform vec4 uAg;
varying vec2 vUv; varying float vWall;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
// wavy fibres: noise stretched along three fixed directions, blended by the local fibre direction fv (doubled
// angle), so the pattern stays continuous wherever the direction turns
float fibres(vec2 p, vec2 fv, float fa, float fc) {
  float acc = 0.0, ws = 0.0;
  for (int k = 0; k < 3; k++) {
    float a = float(k) * 1.0472, w = dot(fv, vec2(cos(2.0 * a), sin(2.0 * a))) + 0.15;
    if (w <= 0.0) continue;
    vec2 d = vec2(cos(a), sin(a)), q = vec2(dot(p, d), dot(p, vec2(-d.y, d.x)));
    acc += w * vn(vec2(q.x * fa, q.y * fc + 2.5 * vn(q * fa * 1.7)));
    ws += w;
  }
  return acc / ws;
}
void main() {
  vec2 sd = vUv * uSz, fw = fwidth(sd);
  float px = max(max(fw.x, fw.y), 1e-6);                // local units per pixel
  vec4 m = texture2D(tM, vUv);
  float E = m.r * 1.25, V = m.g;
  vec2 fv = m.ba * 2.0 - 1.0; float fs = length(fv);
  E *= 0.9 + 0.2 * vn(sd * 26.0);                         // uneven staining
  // collagen bundles and muscle fibres, faded out where they would be finer than a pixel
  float kb = fs * smoothstep(0.5, 0.2, px * 420.0);
  if (kb > 0.01) {
    float b = fibres(sd, fv / max(fs, 1e-3), 40.0, 420.0);
    E *= 1.0 + kb * (b - 0.5) * 0.9;
    V = max(V, kb * smoothstep(0.34, 0.12, b) * smoothstep(0.8, 0.45, E));   // white gaps in loose tissue
  }
  float kg = smoothstep(0.6, 0.25, px * 1200.0);
  if (kg > 0.01) E *= 1.0 + kg * (vn(sd * 1200.0) - 0.5) * 0.3;
  // the edges of empty spaces sharpen as you come close
  float sw = clamp(px / 0.0016, 0.06, 0.5);
  V = smoothstep(0.5 - sw, 0.5 + sw, V);
  // the lymphoid aggregate: nuclei packed above and below the cut add a diffuse haematoxylin density
  float ag = smoothstep(1.05, 0.7, length((sd - uAg.xy) / uAg.zw) + 0.3 * (vn(sd * 150.0) - 0.5));
  vec3 he = exp(-E * vec3(0.16, 1.05, 0.60) - ag * 0.6 * vec3(1.31, 1.37, 0.62));
  he = mix(he, vec3(0.96, 0.94, 0.96), V);
  // far away the cells come from their pre-averaged map; close up they are drawn one by one
  float lod = smoothstep(1.0, 2.6, 0.005 / px);
  vec4 c = texture2D(tC, vUv) * (uCells * (1.0 - lod));
  he = he * (1.0 - c.a) + c.rgb;
  vec4 k = texture2D(tK, vUv) * (uCells * (1.0 - lod));
  vec3 fl = vec3(0.012, 0.016, 0.03) + vec3(0.02, 0.06, 0.05) * E * (1.0 - V) + vec3(0.05, 0.01, 0.008) * ag;   // faint stroma
  fl = fl * (1.0 - k.a) + k.rgb;
  float mk = smoothstep(0.0, 1.0, clamp((uMark * 1.4 - 0.7 * sqrt(min(length(sd - uZ) / ${DM.toFixed(2)}, 1.0)) - 0.15) / 0.4, 0.0, 1.0));
  vec3 col = mix(he, fl, mk) * mix(1.0, 0.62, vWall);
  // the ghost: mostly see-through, keeping a dim tint of its look and a faint cool sheen so its outline reads
  col = col * (1.0 - 0.75 * uGhost) + vec3(0.025, 0.04, 0.07) * uGhost * (1.0 + 2.0 * vWall);
  gl_FragColor = vec4(col * uA, uA * (1.0 - 0.85 * uGhost));
}`,
  });
  set.mats.push(slabMat);
  const slab = new THREE.Mesh(slabGeo, slabMat);
  set.group.add(slab);

  // ---------------------------------------------- regions and the embedding
  // 300 regions (patches of tissue); each is described by its mix of cell types (centred log-ratios), and a PCA
  // places it in 3D; loading arrows show where each cell type pulls
  const N = cells.length, PX = new Float32Array(N), PY = new Float32Array(N);
  function toPlane(i) {
    const c = cells[i], a = (c[0] - L / 2) / RA, q = RA - c[1], x = q * Math.sin(a), y = q * Math.cos(a) - RA;
    PX[i] = x * cT - y * sT - CX; PY[i] = x * sT + y * cT - CY;
  }
  for (let i = 0; i < N; i++) toPlane(i);
  const zp = plane(sZ, dZ);
  const typed = cells.map((c, i) => (c[15] < 5 ? i : -1)).filter(i => i >= 0);
  // regions: seeds spread like a Poisson disc over the section, each cell belongs to its nearest seed
  const RS = 0.043, G = 0.05, gx0 = -1.3, gy0 = -0.8, gw = Math.ceil(2.6 / G), gh = Math.ceil(1.6 / G), grid = Array.from({ length: gw * gh }, () => []);
  const gcell = (x, y) => clamp(Math.floor((x - gx0) / G), 0, gw - 1) + gw * clamp(Math.floor((y - gy0) / G), 0, gh - 1);
  const seedsR = [];
  function nearSeed(x, y, rad) {   // nearest seed within rad (grid rings), or -1
    const a = clamp(Math.floor((x - gx0) / G), 0, gw - 1), b = clamp(Math.floor((y - gy0) / G), 0, gh - 1), w = Math.ceil(rad / G);
    let best = -1, bd = rad * rad;
    for (let u = Math.max(0, a - w); u <= Math.min(gw - 1, a + w); u++) for (let v = Math.max(0, b - w); v <= Math.min(gh - 1, b + w); v++) {
      for (const r of grid[u + gw * v]) { const j = seedsR[r], q = (PX[j] - x) * (PX[j] - x) + (PY[j] - y) * (PY[j] - y); if (q < bd) { bd = q; best = r; } }
    }
    return best;
  }
  function seedRegions() {
    for (let n = 0; n < 20000 && seedsR.length < 300; n++) {
      const i = typed[Math.floor(R() * typed.length)];
      if (nearSeed(PX[i], PY[i], RS) < 0) { grid[gcell(PX[i], PY[i])].push(seedsR.length); seedsR.push(i); }
    }
  }
  seedRegions();
  const NRg = seedsR.length, region = new Int32Array(N).fill(-1), comp = Array.from({ length: NRg }, () => [0, 0, 0, 0, 0]);
  function assignRegions() {
    for (const i of typed) {
      let r = nearSeed(PX[i], PY[i], 0.07);
      if (r < 0) r = nearSeed(PX[i], PY[i], 0.4);
      region[i] = r; comp[r][cells[i][15]]++;
    }
  }
  assignRegions();
  const clr = comp.map(c => { const n = c.reduce((x, y) => x + y, 0), l = c.map(x => Math.log((x + 0.5) / (n + 2.5))), m = l.reduce((x, y) => x + y, 0) / 5; return l.map(x => x - m); });
  const mean = [0, 1, 2, 3, 4].map(t => clr.reduce((x, c) => x + c[t], 0) / NRg);
  const X = clr.map(c => c.map((x, t) => x - mean[t]));
  const C = [0, 1, 2, 3, 4].map(a => [0, 1, 2, 3, 4].map(b => X.reduce((x, r) => x + r[a] * r[b], 0) / (NRg - 1)));
  function eig(A) {   // Jacobi rotations for a small symmetric matrix: [values], [vectors]
    const n = A.length, a = A.map(r => r.slice()), v = a.map((r, i) => r.map((_, j) => +(i === j)));
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
      if (off < 1e-16) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-14) continue;
        const t = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(t), s = Math.sin(t);
        for (let k = 0; k < n; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
        for (let k = 0; k < n; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
        for (let k = 0; k < n; k++) { const x = v[k][p], y = v[k][q]; v[k][p] = c * x - s * y; v[k][q] = s * x + c * y; }
      }
    }
    const ord = a.map((r, i) => i).sort((i, j) => a[j][j] - a[i][i]);
    return [ord.map(i => a[i][i]), ord.map(i => { const e = v.map(r => r[i]), m = e.reduce((x, y) => (Math.abs(y) > Math.abs(x) ? y : x), 0); return e.map(x => x * Math.sign(m)); })];
  }
  const [lam, vec] = eig(C);
  // axis scales: each component a little closer to equal spread, so the cloud reads in 3D
  const ax = [0, 1, 2].map(k => Math.pow(Math.max(lam[k], 1e-6), -0.5) * Math.pow(Math.max(lam[k], 1e-6) / lam[0], 0.2));
  const Z = X.map(r => [0, 1, 2].map(k => r.reduce((x, y, t) => x + y * vec[k][t], 0) * ax[k]));
  const rad = Z.map(z => Math.hypot(z[0], z[1], z[2])).sort((a, b) => a - b)[Math.floor(NRg * 0.95)];
  const O = [0, 0.03, 0.6], ES = 0.45 / rad;
  // (plus a little scatter: real samples differ in more ways than their mix of five cell types)
  const regPos = Z.map(z => [O[0] + z[0] * ES + 0.045 * K.gauss(R), O[1] + z[1] * ES + 0.045 * K.gauss(R), O[2] + (z[2] * ES + 0.045 * K.gauss(R)) * 0.85]);
  const regType = comp.map(c => c.indexOf(Math.max(...c)));
  const regDelay = seedsR.map(i => Math.hypot(PX[i] - zp[0], PY[i] - zp[1]));
  const maxDel = Math.max(...regDelay);
  for (let r = 0; r < NRg; r++) regDelay[r] /= maxDel;
  const load = [0, 1, 2, 3, 4].map(t => [0, 1, 2].map(k => vec[k][t] * Math.sqrt(lam[k]) * ax[k] * (k === 2 ? 0.85 : 1)));
  const lmax = Math.max(...load.map(l => Math.hypot(...l)));
  const tips = load.map(l => { const n = Math.hypot(...l); return l.map(x => x / n * 0.52 * Math.pow(n / lmax, 0.35)); });

  // -------------------------------------------------------------- the cells
  const cGeo = new THREE.BufferGeometry();
  const aP = new Float32Array(N * 3), aDir = new Float32Array(N * 3), aShape = new Float32Array(N * 4), aCyt = new Float32Array(N * 4),
    aNuc = new Float32Array(N * 3), aInfo = new Float32Array(N * 4), aEmb = new Float32Array(N * 3);
  function cellAttrs(i) {
    const c = cells[i], x = PX[i], y = PY[i], r = region[i];
    // the cell's long axis in the plane: d/ds and d/dd of the strip mapping, turned by the tilt
    const a = (c[0] - L / 2) / RA, sa = Math.sin(a), ca = Math.cos(a), k = (RA - c[1]) / RA, cg = Math.cos(c[2]), sg = Math.sin(c[2]);
    const ux = cg * k * ca - sg * sa, uy = -cg * k * sa - sg * ca, dx = ux * cT - uy * sT, dy = ux * sT + uy * cT, dl = Math.hypot(dx, dy);
    aP[3 * i] = x; aP[3 * i + 1] = y; aP[3 * i + 2] = BK * x * x - CZ; aDir[3 * i] = dx / dl; aDir[3 * i + 1] = dy / dl;
    // when the cell switches to its fluorescence colour: outwards from the zoom patch, each cell on its own
    aDir[3 * i + 2] = 0.7 * Math.sqrt(Math.min(1, Math.hypot(x - zp[0], y - zp[1]) / DM)) + 0.3 * R();
    aShape[4 * i] = c[3]; aShape[4 * i + 1] = c[4]; aShape[4 * i + 2] = c[5] / c[3]; aShape[4 * i + 3] = c[6] / c[4];
    for (let q = 0; q < 4; q++) aCyt[4 * i + q] = c[8 + q];
    for (let q = 0; q < 3; q++) aNuc[3 * i + q] = c[12 + q];
    aInfo[4 * i] = c[7]; aInfo[4 * i + 1] = c[15] + 0.4 * c[16];   // (foam rides on the type: int(type + 0.5) still finds it)
    if (r >= 0) {
      const z = R() * 2 - 1, t = R() * 2 * PI, j = 0.012 * Math.cbrt(R()), w = Math.sqrt(1 - z * z) * j, p = regPos[r];
      aInfo[4 * i + 2] = regType[r]; aInfo[4 * i + 3] = 0.55 * regDelay[r] + 0.03 * R();
      aEmb[3 * i] = p[0] + w * Math.cos(t); aEmb[3 * i + 1] = p[1] + z * j; aEmb[3 * i + 2] = p[2] + w * Math.sin(t);
    } else { aInfo[4 * i + 2] = 5; aInfo[4 * i + 3] = 0.55 * Math.min(1, Math.hypot(x - zp[0], y - zp[1]) / maxDel); }   // (stays: fades as its patch lifts)
  }
  for (let i = 0; i < N; i++) cellAttrs(i);
  cGeo.setAttribute('position', new THREE.BufferAttribute(aP, 3));
  cGeo.setAttribute('aDir', new THREE.BufferAttribute(aDir, 3));
  cGeo.setAttribute('aShape', new THREE.BufferAttribute(aShape, 4));
  cGeo.setAttribute('aCyt', new THREE.BufferAttribute(aCyt, 4));
  cGeo.setAttribute('aNuc', new THREE.BufferAttribute(aNuc, 3));
  cGeo.setAttribute('aInfo', new THREE.BufferAttribute(aInfo, 4));
  cGeo.setAttribute('aEmb', new THREE.BufferAttribute(aEmb, 3));
  const common = { uBK: { value: BK }, uTH: { value: TH }, uMark: { value: 0 }, uEmbed: { value: 0 } };
  const cellMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime, uTC: { value: TYPE_COL.map(c => new THREE.Color(...c)) } }, common),
    transparent: true, depthWrite: false,
    vertexShader: K.GLSL + `
attribute vec3 aDir, aNuc, aEmb; attribute vec4 aShape, aCyt, aInfo;
uniform float uA, uMark, uEmbed, uBK, uTH; uniform vec3 uTC[7];
varying vec4 vM, vN; varying vec3 vCy, vNu, vFo; varying float vCa, vA, vPS, vMk;
void main() {
  int ty = int(aInfo.y + 0.5), rt = int(aInfo.z + 0.5);
  float foam = aInfo.y - float(ty);
  vec3 n = normalize(vec3(-2.0 * uBK * position.x, 0.0, 1.0));
  vec4 mv0 = modelViewMatrix * vec4(position, 1.0);
  // lie on whichever face of the slab the camera sees
  float side = dot(normalMatrix * n, -mv0.xyz) >= 0.0 ? 1.0 : -1.0;
  vec3 p0 = position + n * side * (uTH * 0.5 + 0.0012);
  // lift off into the embedding along a curve that rises a little from the slab and heads off sideways towards its
  // place at once (not straight out of the slab, where the close-up cameras are)
  float f = ty >= 5 ? 0.0 : smoothstep(0.0, 1.0, clamp((uEmbed - aInfo.w) / 0.42, 0.0, 1.0));
  vec3 pos = (1.0 - f) * (1.0 - f) * p0 + 2.0 * f * (1.0 - f) * (mix(position, aEmb, 0.35) + n * 0.1) + f * f * aEmb;
  // once lifted, each cell drifts gently round its place, so the cloud feels alive
  float ph = aDir.z * 41.0;
  pos += f * 0.005 * vec3(sin(uTime * 0.8 + ph), sin(uTime * 0.67 + 1.7 * ph), cos(uTime * 0.73 + 2.3 * ph));
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float iz = 1.0 / max(-mv.z, 1e-4), k = uPx * projectionMatrix[1][1] * iz;
  // the cell's ellipse, projected: its two axes in pixels
  vec2 w = mv.xy * iz;
  vec3 d3 = normalize(vec3(aDir.xy, 2.0 * uBK * position.x * aDir.x));
  vec3 e1 = normalize(mat3(modelViewMatrix) * d3), e2 = normalize(mat3(modelViewMatrix) * cross(n, d3));
  vec2 A1 = (e1.xy + w * e1.z) * aShape.x * k, A2 = (e2.xy + w * e2.z) * aShape.y * k;
  // (a lifted cell is a small round spark: capped in size, so one passing near the eye never fills the view)
  float q = smoothstep(0.0, 0.35, f), rd = min(0.0042 * k, 9.0);
  A1 = mix(A1, vec2(rd, 0.0), q); A2 = mix(A2, vec2(0.0, rd), q);
  float det = A1.x * A2.y - A2.x * A1.y;
  vPS = 2.0 * max(length(vec2(A1.x, A2.x)), length(vec2(A1.y, A2.y))) + 2.0;
  gl_PointSize = vPS;
  vM = vec4(A2.y, -A2.x, -A1.y, A1.x) / (abs(det) < 1e-6 ? 1e-6 : det);
  vN = vec4(mix(max(aShape.zw, vec2(0.001)), vec2(0.001), q), aInfo.x, clamp(1.3 / max(min(length(A1), length(A2)), 0.01), 0.02, 1.0));
  // stain colours, then fluorescence by cell type (switching cell by cell), then the colour of the region once lifted
  float mk = smoothstep(0.0, 1.0, clamp((uMark * 1.4 - aDir.z) / 0.4, 0.0, 1.0));
  vec3 tc = uTC[ty];
  vCy = mix(mix(aCyt.rgb, tc, mk), uTC[rt] * 0.85, q);
  vNu = mix(aNuc, tc * 0.28, mk);
  vCa = mix(mix(aCyt.a, 0.92, mk), 1.0, q);
  vMk = mk * (1.0 - q);
  // (the foam only shows once its bubbles are a few pixels across: at low power the gland cells read deep purple)
  vFo = vec3(foam * (1.0 - mk) * (1.0 - q) * 2.5 * smoothstep(14.0, 34.0, vPS), aDir.z * 41.0, aDir.z * 73.0);
  float lod = mix(smoothstep(1.0, 2.6, 0.005 * k), 1.0, q);
  // red blood cells and gland bodies are not cells of the network: they stay behind (red cells carry no markers)
  vA = uA * lod * (ty >= 5 ? (1.0 - smoothstep(aInfo.w, aInfo.w + 0.12, uEmbed)) * (ty == 5 ? 1.0 - mk : 1.0) : 1.0);
  // a flat ellipse is a good stand-in only while the cell's depth range is small against its distance: close and
  // edge-on it would smear into a huge streak, so fade it there; also fade splats that grow huge, and cull very near
  float g = (abs(e1.z) * aShape.x + abs(e2.z) * aShape.y) * iz * (1.0 - q);
  vA *= (1.0 - smoothstep(0.08, 0.2, g)) * (1.0 - smoothstep(250.0, 400.0, vPS));
  if (-mv.z < 3.0 * aShape.x * (1.0 - q)) vA = 0.0;
  // in flight, cells fade out near the camera: the swarm never flies through the viewer's head
  vA *= mix(1.0, smoothstep(0.06, 0.22, -mv.z), smoothstep(0.0, 0.08, f));
  // a small depth bias towards the camera so splats never sink into the slab
  gl_Position = projectionMatrix * vec4(mv.xyz * (1.0 - (1.0 - q) * 0.004 * iz), 1.0);
  if (vA < 0.004 || abs(det) < 0.05) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `varying vec4 vM, vN; varying vec3 vCy, vNu, vFo; varying float vCa, vA, vPS, vMk;
void main() {
  vec2 q = (gl_PointCoord - 0.5) * vPS; q.y = -q.y;
  vec2 e = vec2(dot(vM.xy, q), dot(vM.zw, q));      // in the cell's own frame (unit circle = membrane)
  float r = length(e);
  if (r > 1.0) discard;
  float cm = smoothstep(1.0, 1.0 - vN.w, r);
  float rn = length(vec2((e.x - vN.z) / vN.x, e.y / vN.y));
  float nm = smoothstep(1.0, 1.0 - vN.w / min(vN.x, vN.y), rn);
  vec3 cy = mix(vCy * (1.0 - 0.18 * vCa * vCa * smoothstep(0.55, 1.0, r)), vCy * (0.42 + 0.8 * smoothstep(0.5, 0.95, r)), vMk);
  float ca = vCa;
  if (vFo.x > 0.01) {
    // mucus-filled gland cells: pale bubbles in a fine lilac mesh (slide 39); the mesh is where the two nearest of a
    // few jittered points are about equally near
    vec2 g = e * 2.3 + vFo.yz, b0 = floor(g - 0.5);
    float f1 = 9.0, f2 = 9.0;
    for (int u = 0; u < 2; u++) for (int v = 0; v < 2; v++) {
      vec2 c = b0 + vec2(float(u), float(v));
      float h = fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.55);
      float d = length(g - c - 0.5 - (vec2(h, fract(h * 7.31)) - 0.5) * 0.6);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    float b = smoothstep(0.04, 0.16, f2 - f1) * smoothstep(0.95, 0.72, r);
    cy = mix(cy, vec3(0.91, 0.87, 0.94), vFo.x * (0.3 + 0.4 * b));
    ca = mix(ca, 1.0, 0.4 * vFo.x * b);
  }
  gl_FragColor = vec4(mix(cy, vNu, nm), max(ca * cm, 0.95 * nm) * vA);
}`,
  });
  set.mats.push(cellMat);
  const cellPts = new THREE.Points(cGeo, cellMat);
  cellPts.frustumCulled = false; cellPts.renderOrder = 1;
  set.group.add(cellPts);

  // ------------------------------------------- the network of neighbouring cells
  // nuclei near the zoom patch joined into a Delaunay triangulation (as on slide 40, right across the glands), drawn
  // outwards from the centre. Candidates are each nucleus's nearest neighbours; an edge a-b passes the Delaunay test
  // when some circle through a and b holds no other nucleus nearby, which is when the largest angles it subtends on its
  // two sides add up to at most pi. The ring of cells round an acinus lies on one circle, so every chord across it
  // passes; the shortest that cross no edge already taken are kept, which triangulates the gland.
  // (the vertices are the nuclei, as on the slide: nucleus centres in strip coordinates, mapped onto the plane)
  const NX = new Float32Array(N), NY = new Float32Array(N);
  for (let i = 0; i < N; i++) { const c = cells[i], p = plane(c[0] + Math.cos(c[2]) * c[7] * c[3], c[1] + Math.sin(c[2]) * c[7] * c[3]); NX[i] = p[0]; NY[i] = p[1]; }
  const RG = 0.16, gN = typed.filter(i => (NX[i] - zp[0]) ** 2 + (NY[i] - zp[1]) ** 2 < RG * RG);
  function neighbourEdges(ids) {
    const n = ids.length, KN = 12, G = 0.028, x0 = zp[0] - RG - G, y0 = zp[1] - RG - G, gw2 = Math.ceil((2 * RG) / G) + 3;
    const head = new Int32Array(gw2 * gw2).fill(-1), next = new Int32Array(n), nb = new Int32Array(n * KN).fill(-1), nd = new Float32Array(KN);
    const X = new Float32Array(n), Y = new Float32Array(n), gx = new Int32Array(n), gy = new Int32Array(n);
    for (let a = 0; a < n; a++) {
      X[a] = NX[ids[a]]; Y[a] = NY[ids[a]]; gx[a] = Math.floor((X[a] - x0) / G); gy[a] = Math.floor((Y[a] - y0) / G);
      const c = gx[a] + gw2 * gy[a]; next[a] = head[c]; head[c] = a;
    }
    for (let a = 0; a < n; a++) {   // the KN nearest within G, by insertion
      nd.fill(G * G);
      for (let u = gx[a] - 1; u <= gx[a] + 1; u++) for (let v = gy[a] - 1; v <= gy[a] + 1; v++) {
        for (let b = head[u + gw2 * v]; b >= 0; b = next[b]) {
          if (b === a) continue;
          const q = (X[b] - X[a]) * (X[b] - X[a]) + (Y[b] - Y[a]) * (Y[b] - Y[a]);
          if (q >= nd[KN - 1]) continue;
          let m = KN - 1;
          while (m > 0 && nd[m - 1] > q) { nd[m] = nd[m - 1]; nb[a * KN + m] = nb[a * KN + m - 1]; m--; }
          nd[m] = q; nb[a * KN + m] = b;
        }
      }
    }
    // the Delaunay test over the nuclei both ends know: with alpha and beta the largest angles a-r-b on either side,
    // alpha + beta <= pi exactly when cot(alpha) + cot(beta) >= 0 (with a little slack for nearly round rings)
    function delaunayOk(a, b) {
      let kL = 1e9, kR = 1e9;   // the smallest cotangent (largest angle) on the left and on the right of a-b
      for (let h = 0; h < 2 * KN; h++) {
        const r = nb[(h < KN ? a : b) * KN + h % KN];
        if (r < 0 || r === a || r === b) continue;
        const ax = X[a] - X[r], ay = Y[a] - Y[r], bx = X[b] - X[r], by = Y[b] - Y[r], cr = ax * by - ay * bx, dt = ax * bx + ay * by;
        const ct = Math.abs(cr) > 1e-14 ? dt / Math.abs(cr) : dt > 0 ? 1e9 : -1e9;
        if (cr > 0) { if (ct < kL) kL = ct; } else if (ct < kR) kR = ct;
      }
      return kL + kR > -0.2;
    }
    const cA = [], cB = [], cL = [];
    for (let a = 0; a < n; a++) for (let m = 0; m < KN; m++) {
      const b = nb[a * KN + m];
      if (b < 0) continue;
      // each pair once: from the smaller index, or from the only side that lists the other
      let mutual = false;
      for (let q = 0; q < KN; q++) if (nb[b * KN + q] === a) mutual = true;
      if (mutual && b < a) continue;
      if (delaunayOk(a, b)) { cA.push(a); cB.push(b); cL.push(Math.sqrt((X[b] - X[a]) * (X[b] - X[a]) + (Y[b] - Y[a]) * (Y[b] - Y[a]))); }
    }
    // shortest first, skipping any edge that crosses one already kept: a planar triangulation
    const ord = cA.map((_, i) => i).sort((i, j) => cL[i] - cL[j]), MD = 24;
    const deg = new Int32Array(n), adj = new Int32Array(n * MD), out = [];
    const side = (p, q, r) => (X[q] - X[p]) * (Y[r] - Y[p]) - (Y[q] - Y[p]) * (X[r] - X[p]);
    function noCross(a, b, l) {
      // an edge that crosses a-b and is no longer has both ends within 1.5 l of its midpoint
      const mx = (X[a] + X[b]) / 2, my = (Y[a] + Y[b]) / 2, rq = 1.5 * l, r2 = rq * rq;
      const u0 = Math.max(0, Math.floor((mx - rq - x0) / G)), u1 = Math.min(gw2 - 1, Math.floor((mx + rq - x0) / G));
      const v0 = Math.max(0, Math.floor((my - rq - y0) / G)), v1 = Math.min(gw2 - 1, Math.floor((my + rq - y0) / G));
      for (let u = u0; u <= u1; u++) for (let v = v0; v <= v1; v++) {
        for (let c = head[u + gw2 * v]; c >= 0; c = next[c]) {
          if (c === a || c === b || (X[c] - mx) * (X[c] - mx) + (Y[c] - my) * (Y[c] - my) > r2) continue;
          const sc = side(a, b, c);
          for (let k = 0; k < deg[c]; k++) {
            const d = adj[c * MD + k];
            if (d === a || d === b) continue;
            if (sc * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return false;
          }
        }
      }
      return true;
    }
    for (const e of ord) {
      const a = cA[e], b = cB[e];
      if (deg[a] >= MD || deg[b] >= MD || !noCross(a, b, cL[e])) continue;
      adj[a * MD + deg[a]++] = b; adj[b * MD + deg[b]++] = a;
      out.push([ids[a], ids[b]]);
    }
    return out;
  }
  const edges = neighbourEdges(gN);
  const lGeo = K.linesGeo(edges.length);
  const lP = lGeo.attributes.position.array, lA = lGeo.attributes.aA.array, lT = lGeo.attributes.aT.array;
  let eLen = 0;
  edges.forEach(([i, j], k) => {
    const dm = Math.hypot((NX[i] + NX[j]) / 2 - zp[0], (NY[i] + NY[j]) / 2 - zp[1]) / RG;
    lP.set([NX[i], NY[i], BK * NX[i] * NX[i] - CZ, NX[j], NY[j], BK * NX[j] * NX[j] - CZ], 6 * k);
    eLen += Math.hypot(NX[i] - NX[j], NY[i] - NY[j]) / edges.length;
    lA[2 * k] = lA[2 * k + 1] = 1 - smooth((dm - 0.7) / 0.3); lT[2 * k] = lT[2 * k + 1] = dm;
  });
  const lineU = { uBK: common.uBK, uTH: common.uTH, uMark: common.uMark, uLA: { value: 0 } };
  const lineMat = K.lines(set, {
    additive: false, uniforms: lineU, head: 'uniform float uBK, uTH, uMark, uLA;',
    vertex: `vec3 nn = normalize(vec3(-2.0 * uBK * position.x, 0.0, 1.0));
  float sd = dot(normalMatrix * nn, -mv.xyz) >= 0.0 ? 1.0 : -1.0;
  mv = modelViewMatrix * vec4(position + nn * sd * (uTH * 0.5 + 0.0016), 1.0);
  gl_Position = projectionMatrix * vec4(mv.xyz * (1.0 - 0.003 / length(mv.xyz)), 1.0);
  float mk = smoothstep(0.0, 1.0, clamp((uMark * 1.4 - 0.7 * sqrt(aT * ${(RG / DM).toFixed(4)}) - 0.15) / 0.4, 0.0, 1.0));
  // faint pulses run outwards through the network, edge by edge
  float pu = pow(0.5 + 0.5 * cos(6.2832 * (aT * 1.6 - uTime * 0.22)), 14.0) * smoothstep(0.0, 0.15, aT);
  vC = mix(mix(vec3(0.1, 0.04, 0.15), vec3(0.85, 0.9, 1.0), mk), mix(vec3(0.3, 0.2, 0.75), vec3(0.45, 0.95, 1.0), mk), 0.7 * pu);
  vA *= uLA * mix(0.85, 0.5, mk) * (1.0 + 0.6 * pu * mk);
  // lines fade before they crowd together at a distance (an edge under a few pixels long), the cells carry the look
  vA *= smoothstep(2.0, 6.0, ${eLen.toFixed(4)} * uPx * projectionMatrix[1][1] / max(-mv.z, 1e-3));`,
  });
  const graph = new THREE.LineSegments(lGeo, lineMat);
  graph.frustumCulled = false; graph.renderOrder = 2;
  set.group.add(graph);

  // ------------------------------------------------ the embedding's furniture
  const glowGeo = K.pointsGeo(NRg), del = new Float32Array(NRg);
  for (let r = 0; r < NRg; r++) {
    glowGeo.attributes.position.array.set(regPos[r], 3 * r);
    glowGeo.attributes.aCol.array.set(TYPE_COL[regType[r]], 3 * r);
    glowGeo.attributes.aSize.array[r] = 0.035 + 0.02 * Math.sqrt(comp[r].reduce((x, y) => x + y, 0) / 120);
    glowGeo.attributes.aA.array[r] = 0.22;
    del[r] = 0.55 * regDelay[r] + 0.03;
  }
  glowGeo.setAttribute('aDel', new THREE.BufferAttribute(del, 1));
  const glowMat = K.points(set, { uniforms: { uEm: common.uEmbed }, head: 'attribute float aDel; uniform float uEm;',
    vertex: 'vA *= smoothstep(0.85, 1.0, (uEm - aDel) / 0.42) * (0.75 + 0.25 * sin(uTime * 1.3 + aDel * 47.0));' });   // once its cells have arrived; breathing
  const glow = new THREE.Points(glowGeo, glowMat);
  glow.frustumCulled = false; glow.renderOrder = 3;
  set.group.add(glow);
  // axes through the origin of the embedding
  const axGeo = K.linesGeo(3);
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((a, k) => {
    axGeo.attributes.position.array.set([...v3.add(O, v3.mul(a, -0.55)), ...v3.add(O, v3.mul(a, 0.55))], 6 * k);
    axGeo.attributes.aCol.array.set([0.55, 0.65, 0.8, 0.55, 0.65, 0.8], 6 * k);
    axGeo.attributes.aA.array.set([0.4, 0.4], 2 * k);
  });
  const axU = { uK: { value: 0 } };
  const axMat = K.lines(set, { uniforms: axU, head: 'uniform float uK;', vertex: 'vA *= uK;' });
  const axes = new THREE.LineSegments(axGeo, axMat);
  axes.frustumCulled = false;
  set.group.add(axes);
  // loading arrows, one per cell type
  const arrowParts = [];
  tips.forEach((tp, t) => {
    const l = Math.hypot(...tp), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...tp).normalize());
    const shaft = new THREE.CylinderGeometry(0.0032, 0.0032, l - 0.035, 8, 1, true).translate(0, (l - 0.035) / 2, 0);
    const head = new THREE.ConeGeometry(0.011, 0.035, 12, 1).translate(0, l - 0.0175, 0);
    for (const g of [shaft, head]) { g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)); arrowParts.push(K.paint(g, TYPE_COL[t])); }
  });
  // (base just under 0.97: additive glow never writes depth, so it cannot hide other sets' see-through parts)
  const arrowMat = K.fade(set, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending }), 0.96);
  const arrows = new THREE.Mesh(K.merge(arrowParts), arrowMat);
  arrows.position.set(...O); arrows.renderOrder = 4;
  set.group.add(arrows);

  // ------------------------------------------------------- anchors and views
  const front = (s, d, o = 0.003) => { const p = P3(s, d), n = nrm(p[0]); return v3.add(p, v3.mul(n, TH / 2 + o)); };
  const lyA = layerAt(0.5), lyB = layerAt(0.95), lyC = layerAt(1.42);
  const bigV = vessels.slice(2).sort((a, b) => b.r - a.r)[0];
  const nearest = (t, ds, dd) => {
    let best = -1, bd = 1e9;
    for (let i = 0; i < N; i++) { if (cells[i][15] !== t) continue; const q = (cells[i][0] - sZ - ds) ** 2 + (cells[i][1] - dZ - dd) ** 2; if (q < bd) { bd = q; best = i; } }
    return front(cells[best][0], cells[best][1]);
  };
  const anchors = {
    mucosa: front(0.5, lyA.top0 + 0.06), submucosa: front(0.95, (lyB.b1 + lyB.b2) / 2), muscle: front(1.42, (lyC.b2 + lyC.bot) / 2),
    vessel: front(bigV.s, bigV.d), zoom: front(sZ, dZ, 0), embed: O.slice(),
    // (spread over the zoom view's corners, so the labels stay apart; the labels run to the right of their anchors)
    epi: nearest(0, -0.08, -0.043), imm: nearest(1, 0.045, -0.047), str: nearest(2, -0.085, 0.05), endo: nearest(3, 0.034, 0.027),
    smc: nearest(4, -0.02, -0.009),
  };
  tips.forEach((tp, t) => { anchors['load' + t] = v3.add(O, v3.mul(tp, 1.08)); });
  const zn = nrm(anchors.zoom[0]), azN = Math.atan2(zn[0], zn[2]) * 180 / PI, Zm = anchors.zoom;
  // The five cell-type labels only make sense while their cells are spread over the view (close to the zoom patch).
  // How far apart their anchors are on screen is measured at each render, in units of the view's tangent (so it
  // means the same in a headset), and the labels fade out before they would pile up in a wider view: in the story
  // as the camera pulls back, in explore while it flies in, and whenever someone zooms out.
  const LA = ['epi', 'imm', 'str', 'endo', 'smc'].map(k => anchors[k]), _m = new THREE.Matrix4();
  let near = 0;
  cellPts.onBeforeRender = (r, sc, cam) => {
    const e = _m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).multiply(cellPts.matrixWorld).elements, P = cam.projectionMatrix.elements;
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const p of LA) {
      const w = e[3] * p[0] + e[7] * p[1] + e[11] * p[2] + e[15];
      if (w < 1e-3) { near = 0; return; }
      const x = (e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12]) / (w * P[0]), y = (e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13]) / (w * P[5]);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    near = prog(Math.hypot(x1 - x0, y1 - y0), 0.2, 0.3);
  };
  const mkA = S => near * prog(S.tissue_mark, 0.5, 1) * (1 - prog(S.tissue_embed, 0, 0.04));
  const emA = S => prog(S.tissue_embed, 0.75, 1);
  const CLS = ['amb', '', 'grn', 'mag', 'cyn'];

  return Object.assign(set, {
    params: { tissue_a: 1, tissue_graph: 0, tissue_mark: 0, tissue_embed: 0 },
    update(S) {
      const mk = S.tissue_mark, em = S.tissue_embed, gr = S.tissue_graph;
      common.uMark.value = mk; common.uEmbed.value = em;
      slabU.uMark.value = mk;
      slabU.uCells.value = 1 - prog(em, 0.05, 0.6);
      slabU.uGhost.value = prog(em, 0, 0.7);
      // a see-through ghost must not hide what lies behind it
      slabMat.depthWrite = slabU.uGhost.value < 0.02 && S.tissue_a > 0.97;   // (nor while it fades with the set)
      lineMat.uniforms.uReveal.value = gr * 1.02;
      lineU.uLA.value = smooth(gr * 4) * (1 - prog(em, 0, 0.3));
      axU.uK.value = prog(em, 0.35, 0.85);
      const ga = prog(em, 0.5, 0.95);
      arrows.visible = ga > 0.01; arrows.scale.setScalar(Math.max(0.01, ga));
      // hidden parts are not drawn at all
      graph.visible = lineU.uLA.value > 0.003; glow.visible = em > 0.3; axes.visible = axU.uK.value > 0.003;
    },
    anchors,
    labels: [
      { text: ['Epithelial', 'gland cells'], at: 'epi', cls: CLS[0], alpha: mkA },
      { text: ['Immune', 'cells'], at: 'imm', cls: CLS[1], alpha: mkA },
      { text: ['Stromal', 'fibroblasts'], at: 'str', cls: CLS[2], alpha: mkA },
      { text: ['Endothelial', 'vessel lining'], at: 'endo', cls: CLS[3], alpha: mkA },
      { text: ['Smooth muscle', ''], at: 'smc', cls: CLS[4], alpha: mkA },
      ...TYPE_NAME.map((nm, t) => ({ text: [nm, ''], at: 'load' + t, cls: CLS[t], alpha: emA })),
    ],
    cam: {
      default: [0, 6, 3.2, 0, 0, 0], section: [0, 6, 3.2, 0, 0, 0],
      zoom: [azN, 3, 0.25, ...Zm], graph: [azN + 8, 5, 0.28, ...Zm], mark: [azN - 8, 5, 0.42, ...Zm],
      embed: [-18, 14, 2.4, ...O],
    },
    controls: [{ key: 'view', label: 'View', options: [['section', 'Tissue'], ['graph', 'Cell network'], ['mark', 'Markers'], ['embed', 'Embedding']] }],
    explore(c) {
      const v = c.view;
      // (the lift-off waits a moment, so the camera is already pulling back from the close-up when the cells fly)
      return { tissue_graph: v === 'graph' || v === 'mark' ? 1 : 0, tissue_mark: v === 'mark' || v === 'embed' ? 1 : 0, tissue_embed: v === 'embed' && !(c.t < 0.4) ? 1 : 0 };
    },
    // the stain maps live in uniforms, which K.dispose does not reach: free them here too
    textures: [texM, texHE, texMK],
    dispose() { K.dispose(set); texM.dispose(); texHE.dispose(); texMK.dispose(); },
    cellCount: typed.length, regionCount: NRg, types: TYPE_NAME.map((n, t) => ({ name: n, css: ['#ffd84a', '#ff5a4b', '#3ee08f', '#ff5ad9', '#4d94ff'][t] })),
  });
};
