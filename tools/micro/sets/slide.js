// One H&E section, the method and the domains (the microanatomy story; Buljan, Bago-Horvath & Rendeiro, bioRxiv 2025),
// drawn over the tour's tissue set (tools/lbi/sets/tissue.js) in its frame, in the tour's visual language for its cell
// network: the section is cut into tiles; every tile grows a little skyline of 16 bars, its description (features);
// a network floats over the tiles, each joined to its neighbours, with light running along the links (message
// passing) while the skylines and colours mix; the nodes lift off into a 3D map of their mixed descriptions where
// alike tiles gather (the groups), take their group's colour and fly back down to colour the section: the domains
// (the layers of the gut wall). Then the domain map changes from age 20 to 70 as in the preprint's gut submucosa
// example. The tiles' outlines, colours and borders are one shader over a mesh that follows the slab; the domains wash
// in tile by tile, but their borders follow the tissue set's layers, the patch and the vessels to the pixel (the real
// tiles are far smaller than these).
SETS.slide = function (K) {
  const { THREE, v3, smooth, clamp, prog, lerp } = K;
  const set = K.newSet('slide');
  const PI = Math.PI;
  const MD = MICRO_DATA, EX = MD.examples.find(e => e.domain === 'submucosa') || { from: 42.9, to: 34.5 };
  const AGES = (MD.facts && MD.facts.ages) || [20, 70];

  // ------------------------------------------------- the tissue set's frame
  // (copied from tools/lbi/sets/tissue.js, which this set must match: the strip's layers and its curve in space)
  const L = 2.1, TH = 0.008, BK = 0.1, RA = 2.7, TILT = -0.15;
  function noise1(seed) {
    const r = K.rng(seed), v = new Float32Array(256);
    for (let i = 0; i < 256; i++) v[i] = r() * 2 - 1;
    return x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = v[i & 255]; return a + (v[(i + 1) & 255] - a) * u; };
  }
  const gs = (x, m, w) => Math.exp(-((x - m) / w) * ((x - m) / w));
  const nM = noise1(11), nS = noise1(12), nP = noise1(13), nT = noise1(14);
  // s along the section (0..L), d depth below the lumen: lumen surface, mucosa / submucosa (b1), submucosa / muscle
  // (b2), inner / outer muscle (bm), serosa
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
  {
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (let k = 0; k <= 200; k++) {
      const s = L * k / 200, ly = layers(s);
      for (const d of [ly.top, ly.bot]) { const p = plane(s, d); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    }
    CX = (x0 + x1) / 2; CY = (y0 + y1) / 2; CZ = BK * ((x1 - x0) / 2) ** 2 / 2;
  }
  const P3 = (s, d) => { const p = plane(s, d); return [p[0], p[1], BK * p[0] * p[0] - CZ]; };
  const nrm = x => v3.norm([-2 * BK * x, 0, 1]);
  const front = (s, d, o = 0.004) => { const p = P3(s, d); return v3.add(p, v3.mul(nrm(p[0]), TH / 2 + o)); };
  // the lymphoid aggregate and the zoom patch's artery and vein (tissue.js: AG, vessels[0..1]); a vessel's halo counts
  // as vessel, as its wall and the loose tissue round it do in a tile
  const AG = { s: 0.6, d: layers(0.6).b1 - 0.008, a: 0.046, b: 0.032 };
  const bZ = layers(1.27).b1;
  const VES = [{ s: 1.304, d: bZ + 0.031, r: 0.0165, asp: 1.15, ang: 0.3 }, { s: 1.22, d: bZ + 0.044, r: 0.013, asp: 2.3, ang: -0.25 }];
  AG.A = AG.a * Math.sqrt(1.1); AG.B = AG.b * Math.sqrt(1.1);
  for (const v of VES) { v.A = v.r * Math.sqrt(v.asp) * 1.6; v.B = v.r / Math.sqrt(v.asp) * 1.6 + 0.006; v.c = Math.cos(v.ang); v.sn = Math.sin(v.ang); }
  const inAG = (s, d) => ((s - AG.s) / AG.A) ** 2 + ((d - AG.d) / AG.B) ** 2 < 1;
  const inVes = (s, d) => VES.some(v => {
    const x = (s - v.s) * v.c + (d - v.d) * v.sn, y = (d - v.d) * v.c - (s - v.s) * v.sn;
    return (x / v.A) ** 2 + (y / v.B) ** 2 < 1;
  });

  // ------------------------------------------------------------- the domains
  // names as in MICRO_DATA.graph (so the explore panels can match them), labels as shown. Colours as in the talk's
  // atlas (MICRO_DATA.figures.atlas): its stomach map (glands orange, submucosa red, muscularis green) and its small
  // intestine's lymphoid patches (blue); the talk draws the muscularis as one domain, so the outer layer takes a lighter
  // green, and the vessels the palette's next colour. Without the figures, a fixed palette.
  const ATL = Array.isArray(MD.figures && MD.figures.atlas) ? MD.figures.atlas : [];
  const isHex = c => /^#[0-9a-f]{6}$/i.test(c || '');
  const figOf = (tre, dre) => { const t = ATL.find(x => tre.test(x.tissue || '')), d = t && (t.domains || []).find(x => dre.test(x.name || '')); return d && isHex(d.colour) ? d.colour : null; };
  const DOM = [
    { name: 'mucosa', title: 'Mucosa', label: ['Mucosa', ''], cls: 'amb', css: figOf(/stomach/i, /gland/i) || '#f58020' },
    { name: 'submucosa', title: 'Submucosa', label: ['Submucosa', ''], cls: 'mag', css: figOf(/stomach/i, /submucosa/i) || '#d82a2a' },
    { name: 'inner circular smooth muscle', title: 'Inner circular muscle', label: ['Muscle', 'inner, circular'], cls: 'grn', css: figOf(/stomach/i, /muscularis/i) || '#2ca249' },
    { name: 'outer longitudinal smooth muscle', title: 'Outer lengthwise muscle', label: ['Muscle', 'outer, lengthwise'], cls: 'grn', css: '#9bd14b' },
    { name: 'lymphoid tissue', title: 'Lymphoid patch', label: ['Lymphoid', 'patch'], cls: 'cyn', css: figOf(/small intestine/i, /peyer/i) || '#1a78b6' },
    { name: 'blood vessels', title: 'Blood vessels', label: ['Blood vessels', ''], cls: '', css: '#9268ad' },
  ];
  // any other name: the talk's colour where it names that domain (the first section that does), else a fixed
  // categorical colour per name. (The atlas set owns the story's domainColour; the engine may hand it over with
  // api().recolour(fn).)
  const FIGC = {};
  for (const t of ATL) for (const d of t.domains || []) { const n = String(d.name || '').toLowerCase(); if (isHex(d.colour) && !FIGC[n]) FIGC[n] = d.colour; }
  const CAT = ['#1a78b6', '#f58020', '#2ca249', '#d82a2a', '#9268ad', '#8c574c', '#d87ab2', '#939598', '#46d9ff', '#ffb43b', '#3ee08f', '#ff5ad9'];
  function domainColour(name) {
    const n = String(name || '').toLowerCase(), own = DOM.find(d => d.name === n);
    if (own) return own.css;
    if (FIGC[n]) return FIGC[n];
    let h = 7;
    for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
    return CAT[h % CAT.length];
  }

  // ------------------------------------------------- the domains, to the pixel
  // the domain at (s, d) at age a (0 = 20, 1 = 70), as drawn: the lymphoid patch, then the two vessels, then the
  // layers. With age the submucosa / muscle border rises (the inner muscle takes the submucosa's loss) and the inner /
  // outer muscle border rises by 0.4 of that (so both muscle layers thicken: illustrative); the change runs along the
  // section in a gentle wave, and not where the strip has no muscle (its right end)
  const wm = s => smooth((1.97 - s) / 0.3);
  const apAt = (s, a) => smooth(clamp((a - 0.15 - 0.15 * Math.sin(s * 2.7 + 1)) / 0.7, 0, 1));
  let FS = 0;   // how much of its thickness the submucosa loses by 70 (set below from the preprint's example)
  function bordersAt(s, a, ly) {
    const sh = apAt(s, a) * FS * (ly.b2 - ly.b1) * wm(s);
    return [ly.b1, ly.b2 - sh, ly.bm - 0.4 * sh];
  }
  function domAt(s, d, a, ly = layers(s)) {
    if (s < 0 || s > L || d < ly.top || d > ly.bot) return -1;
    if (inAG(s, d)) return 4;
    if (inVes(s, d)) return 5;
    const b = bordersAt(s, a, ly);
    return d < b[0] ? 0 : d < b[1] ? 1 : d < b[2] ? 2 : 3;
  }
  // each domain's share of the drawn section (by area on the slab: a strip's length scales with its radius)
  function sharesAt(a) {
    const n = [0, 0, 0, 0, 0, 0], NS = 420, DD = 0.003;
    let tot = 0;
    for (let k = 0; k < NS; k++) {
      const s = L * (k + 0.5) / NS, ly = layers(s);
      for (let d = ly.top + DD / 2; d < ly.bot; d += DD) { const w = (RA - d) / RA, c = domAt(s, d, a, ly); n[c] += w; tot += w; }
    }
    return n.map(x => 100 * x / tot);
  }
  // the submucosa thins by the same fraction as in the preprint's gut example (42.9 % -> 34.5 % of the slides: about
  // a fifth of itself); the shifted strip lies clear of the patch and the vessels, so its area is linear in FS
  const SH20 = sharesAt(0);
  {
    let band = 0, tot = 0;
    for (let k = 0; k < 420; k++) {
      const s = L * (k + 0.5) / 420, ly = layers(s), bw = (ly.b2 - ly.b1) * wm(s);
      band += bw / 0.003 * (RA - ly.b2) / RA;
      for (let d = ly.top + 0.0015; d < ly.bot; d += 0.003) tot += (RA - d) / RA;
    }
    FS = clamp(SH20[1] * (1 - EX.to / EX.from) / (100 * band / tot || 1), 0, 0.5);
  }
  const SH70 = sharesAt(1);

  // ---------------------------------------------------------------- the tiles
  // NX x NY square tiles over the strip in (s, d); a tile is kept when at least 30 % of it is tissue. A tile's domain
  // (for its features, its lift and the matrix) is the main one in it at 20; small structures count 2.4 times
  const NX = 40, NY = 12, TS = L / NX, D0 = -0.004, NP = 3;
  const R = K.rng(1310), rr = (a, b) => a + (b - a) * R();
  const SUB = 8, LYS = [];
  for (let i = 0; i < NX * SUB; i++) LYS.push(layers((i + 0.5) * TS / SUB));
  const tiles = [];
  const T = (i, j) => (i < 0 || j < 0 || i >= NX || j >= NY ? null : tiles[i + NX * j]);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const fr = [0, 0, 0, 0, 0, 0];
    let inside = 0;
    for (let a = 0; a < SUB; a++) {
      const s = (i + (a + 0.5) / SUB) * TS, ly = LYS[i * SUB + a];
      for (let b = 0; b < SUB; b++) {
        const d = D0 + (j + (b + 0.5) / SUB) * TS;
        if (s < 0.004 || s > L - 0.004 || d < ly.top || d > ly.bot) continue;
        inside++;
        fr[domAt(s, d, 0, ly)]++;
      }
    }
    const tot = Math.max(1, inside), W = [1, 1, 1, 1, 2.4, 2.4];
    let dom = 0;
    for (let k = 1; k < 6; k++) if (fr[k] * W[k] > fr[dom] * W[dom]) dom = k;
    tiles.push({ i, j, keep: inside >= 0.3 * SUB * SUB, fr: fr.map(x => x / tot), dom });
  }
  const kept = tiles.filter(t => t.keep);
  const nb4 = t => [T(t.i - 1, t.j), T(t.i + 1, t.j), T(t.i, t.j - 1), T(t.i, t.j + 1)].filter(n => n && n.keep);

  // features: each tile is described by 16 numbers, from what it holds (its mix of domains) and some noise; message
  // passing mixes in its neighbours' (two rounds, half its own each time; the network drawn has eight neighbours a
  // tile, the mixing uses the four that share an edge)
  const NF = 16, HI = [[0, 3, 7, 12], [2, 5, 10, 13], [6, 8, 11, 14], [6, 8, 9, 15], [1, 3, 9, 14], [4, 5, 11, 15]];
  const proto = HI.map(h => Array.from({ length: NF }, (_, f) => (h.includes(f) ? rr(0.72, 0.95) : rr(0.08, 0.26))));
  const featOf = fr => proto[0].map((_, f) => clamp(fr.reduce((a, w, k) => a + w * proto[k][f], 0) + 0.13 * K.gauss(R), 0, 1));
  for (const t of kept) t.f = featOf(t.fr);
  for (const t of kept) t.m = t.f.slice();
  for (let round = 0; round < 2; round++) {
    const next = kept.map(t => { const ns = nb4(t); return t.m.map((v, f) => (ns.length ? 0.5 * v + 0.5 * ns.reduce((a, n) => a + n.m[f], 0) / ns.length : v)); });
    kept.forEach((t, k) => { t.m = next[k]; });
  }
  // a tile's description as a colour: three fixed random projections of its features, stretched to a bright range
  const WP = [0, 1, 2].map(() => Array.from({ length: NF }, () => K.gauss(R)));
  const proj = f => WP.map(w => w.reduce((a, x, k) => a + x * f[k], 0));
  const lo = [9, 9, 9].map(() => 1e9), hi = [0, 0, 0].map(() => -1e9);
  for (const t of kept) proj(t.f).forEach((v, c) => { lo[c] = Math.min(lo[c], v); hi[c] = Math.max(hi[c], v); });
  const tintOf = f => {
    const p = proj(f).map((v, c) => clamp((v - lo[c]) / (hi[c] - lo[c] + 1e-6), 0, 1));
    const g = (p[0] + p[1] + p[2]) / 3;
    return p.map(v => clamp(0.22 + 0.72 * (g + (v - g) * 1.5), 0.05, 1));
  };
  for (const t of kept) {
    t.tint = tintOf(t.f); t.tintM = tintOf(t.m);
    t.ord = clamp(0.8 * (t.i + 0.6 * t.j) / (NX + 0.6 * NY) + 0.2 * R(), 0, 1);   // tiles draw on in a sweep
    t.dord = clamp(0.35 * (t.i / NX) + 0.65 * R(), 0, 1);                          // and take their domain colours
  }

  const tileC = t => [(t.i + 0.5) * TS, D0 + (t.j + 0.5) * TS];
  // the close-up: a tile on the mucosa / submucosa border; every step spreads outwards from it, as the tour's cell
  // network draws outwards from its zoom patch
  const CL = T(16, 3), CLc = tileC(CL);
  const dCL = t => Math.hypot((t.i - CL.i) / NX * 2.4, (t.j - CL.j) / NY * 0.7);
  { const mx = Math.max(...kept.map(dCL)); for (const t of kept) t.wave = clamp(0.62 * dCL(t) / mx + 0.08 * R(), 0, 0.7); }
  // each kept tile's place on the slab: centre, the slab's normal, unit tangents along the section and in depth
  for (const t of kept) {
    const [s, d] = tileC(t), p = P3(s, d);
    t.p = p; t.ts = v3.norm(v3.sub(P3(s + 0.01, d), P3(s - 0.01, d))); t.td = v3.norm(v3.sub(P3(s, d + 0.01), P3(s, d - 0.01)));
  }

  // ------------------------------------------------------- the tile texture
  // NP pages of NX x NY texels: 0 own tint + kept, 1 mixed tint + domain order, 2 draw-on order
  const TT = new Uint8Array(NX * NY * NP * 4);
  const texT = new THREE.DataTexture(TT, NX, NY * NP, THREE.RGBAFormat);
  texT.magFilter = texT.minFilter = THREE.NearestFilter; texT.generateMipmaps = false;
  const b8 = x => Math.round(clamp(x, 0, 1) * 255);
  for (const t of tiles) {
    const put = (p, r, g, b, a) => { const o = 4 * (t.i + NX * (p * NY + t.j)); TT[o] = b8(r); TT[o + 1] = b8(g); TT[o + 2] = b8(b); TT[o + 3] = b8(a); };
    if (!t.keep) { for (let p = 0; p < NP; p++) put(p, 0, 0, 0, 0); continue; }
    put(0, ...t.tint, 1); put(1, ...t.tintM, t.dord);
    put(2, t.ord, 0, 0, 1);
  }
  texT.needsUpdate = true;

  // the domains' colours as drawn: the slide is darkened a little under them (DARK), and each colour is pushed away
  // from the stain it lies on (BASE: the tissue set's colour there, read off a render) so that, laid over it at WA,
  // it reads as itself and not as a mix with pink (green on pink went olive)
  const DARK = 0.2, WA = 0.58;
  const BASE = ['#a671a2', '#e7a6c7', '#d05f91', '#d05f91', '#503775', '#e0a0c0'].map(K.rgb);
  const uCol = DOM.map(() => new THREE.Vector3());
  function fillCols() {
    DOM.forEach((d, k) => {
      const c = K.rgb(d.css), b = BASE[k].map(x => x * (1 - DARK)), g = (b[0] + b[1] + b[2]) / 3;
      uCol[k].set(...c.map((x, i) => clamp(x + 0.85 * (1 - WA) / WA * (g - b[i]), 0, 1)));
    });
  }
  fillCols();

  // premultiplied blending: one material can both lay a translucent colour over the slide and add glow
  const pm = m => { m.blending = THREE.CustomBlending; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendEquation = THREE.AddEquation; set.mats.push(m); return m; };
  const OVER = 'vec4 over(vec4 acc, vec3 c, float a) { return vec4(c * a + acc.rgb * (1.0 - a), a + acc.a * (1.0 - a)); }';
  // a feature's value as a colour (the usual even scale for numbers: indigo for low, through teal, to yellow for
  // high), bright enough to glow on the darkened slide
  const ICE = `
vec3 ice(float v) {
  vec3 c = mix(vec3(0.3, 0.2, 0.72), vec3(0.12, 0.62, 0.78), smoothstep(0.05, 0.5, v));
  c = mix(c, vec3(0.35, 0.86, 0.45), smoothstep(0.45, 0.75, v));
  return mix(c, vec3(1.0, 0.9, 0.28), smoothstep(0.7, 1.0, v));
}`;
  const TILEGL = `
uniform sampler2D tT;
const float NX = ${NX}.0, NY = ${NY}.0, NP = ${NP}.0;
vec4 tt(vec2 ij, float p) { vec2 c = clamp(ij, vec2(0.0), vec2(NX - 1.0, NY - 1.0)); return texture2D(tT, vec2((c.x + 0.5) / NX, (p * NY + c.y + 0.5) / (NP * NY))); }`;
  // which face of the slab the camera sees (+1 front, -1 back), at a point of the slab: things stand on that face
  const SIDE = `
float slabSide(vec3 p) { vec3 n = normalize(vec3(-2.0 * uBK * p.x, 0.0, 1.0)); return dot(normalMatrix * n, -(modelViewMatrix * vec4(p, 1.0)).xyz) >= 0.0 ? 1.0 : -1.0; }
vec3 slabN(vec3 p) { return normalize(vec3(-2.0 * uBK * p.x, 0.0, 1.0)); }`;

  // ------------------------------------------------- the mesh over the slab
  // a grid in (s, d) that follows the strip (4 x 5 quads per tile, only under kept tiles), drawn on whichever face
  // of the slab the camera sees, a hair in front of it
  const QS = 4, QD = 5, NC = NX * QS, NR = NY * QD;
  // (aL: the layers' borders at this s in tile units, and where there is muscle, for the domains to the pixel)
  const nv = (NC + 1) * (NR + 1), gPos = new Float32Array(nv * 3), gG = new Float32Array(nv * 2), gTB = new Float32Array(nv * 2), gUv = new Float32Array(nv * 2), gL = new Float32Array(nv * 4);
  for (let c = 0; c <= NC; c++) {
    const s = L * c / NC, ly = layers(s), lv = [(ly.b1 - D0) / TS, (ly.b2 - D0) / TS, (ly.bm - D0) / TS, wm(s)];
    for (let r = 0; r <= NR; r++) {
      const d = D0 + NY * TS * r / NR, p = P3(s, d), k = c * (NR + 1) + r;
      gPos.set(p, 3 * k); gG.set([s / TS, (d - D0) / TS], 2 * k); gL.set(lv, 4 * k);
      gTB.set([(ly.top + 0.002 - D0) / TS, (ly.bot - D0) / TS], 2 * k); gUv.set([s / L, r / NR], 2 * k);
    }
  }
  const gIdx = [];
  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    if (!T(Math.floor(c / QS), Math.floor(r / QD)).keep) continue;
    const a = c * (NR + 1) + r, b = a + NR + 1;
    gIdx.push(a, a + 1, b + 1, a, b + 1, b);
  }
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  gridGeo.setAttribute('aG', new THREE.BufferAttribute(gG, 2));
  gridGeo.setAttribute('aTB', new THREE.BufferAttribute(gTB, 2));
  gridGeo.setAttribute('aL', new THREE.BufferAttribute(gL, 4));
  gridGeo.setAttribute('uv', new THREE.BufferAttribute(gUv, 2));
  gridGeo.setIndex(gIdx);
  gridGeo.computeBoundingSphere();
  const U = { uA: set.uA, uTime: K.U.uTime, tT: { value: texT }, uBK: { value: BK }, uTiles: { value: 0 }, uAdj: { value: 0 }, uDom: { value: 0 }, uAge: { value: 0 },
    uFoc: { value: 0 }, uNet: { value: 0 }, uDim: { value: 0 }, uFeat: { value: 0 }, uGrp: { value: 0 }, uLand: { value: 0 }, uOut: { value: 1 },
    // the domains: colours, how much the submucosa thins by 70, the patch and the vessels (centre and half axes in tile
    // units; a vessel's turn as cos, sin)
    uCol: { value: uCol }, uFS: { value: FS }, uAGe: { value: new THREE.Vector4(AG.s / TS, (AG.d - D0) / TS, AG.A / TS, AG.B / TS) },
    uVe: { value: VES.map(v => new THREE.Vector4(v.s / TS, (v.d - D0) / TS, v.A / TS, v.B / TS)) }, uVr: { value: VES.map(v => new THREE.Vector2(v.c, v.sn)) } };
  const washMat = pm(new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide, extensions: { derivatives: true },
    vertexShader: `
uniform float uBK;
attribute vec2 aG, aTB; attribute vec4 aL;
varying vec2 vG, vTB; varying vec4 vL;
${SIDE}
void main() {
  vG = aG; vTB = aTB; vL = aL;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + slabN(position) * slabSide(position) * ${(TH / 2 + 0.0016).toFixed(4)}, 1.0);
}`,
    fragmentShader: TILEGL + OVER + `
const float TSZ = ${TS.toFixed(6)}, DARK = ${DARK.toFixed(3)}, WA = ${WA.toFixed(3)};
uniform float uA, uTime, uTiles, uAdj, uDom, uAge, uFoc, uFS, uDim, uFeat;
uniform vec3 uCol[6]; uniform vec4 uAGe, uVe[2]; uniform vec2 uVr[2];
varying vec2 vG, vTB; varying vec4 vL;
float dpr(float o) { return smoothstep(0.0, 1.0, clamp((uDom - 0.55 * o) / 0.45, 0.0, 1.0)); }
// an ellipse (centre, half axes; turned by r = cos, sin): 1 at its centre, 0 on its edge
float ell(vec4 e, vec2 r) { vec2 o = vG - e.xy, q = vec2(o.x * r.x + o.y * r.y, o.y * r.x - o.x * r.y) / e.zw; return 1.0 - dot(q, q); }
// 0 -> 1 across x = 0 in about a pixel (fx: how much x changes per pixel); a line along x = 0, w pixels each side
float side(float x, float fx) { return clamp(x / fx + 0.5, 0.0, 1.0); }
float line(float x, float fx, float w) { return 1.0 - smoothstep(w, w + 1.0, abs(x) / fx); }
float sel(float k) { return max(0.0, 1.0 - abs(uFoc - k - 1.0)); }
void main() {
  vec2 ij = floor(vG), f = vG - ij, c = f - 0.5;
  vec2 fw = max(fwidth(vG), vec2(1e-5)); float px = max(fw.x, fw.y);
  // the domains here, to the pixel: the layers' borders (the lower two rise with age, in a wave along the section),
  // then the vessels and the lymphoid patch over them
  float ap = smoothstep(0.0, 1.0, clamp((uAge - 0.15 - 0.15 * sin(vG.x * TSZ * 2.7 + 1.0)) / 0.7, 0.0, 1.0));
  float sh = ap * uFS * (vL.y - vL.x) * vL.w;
  float e1 = vG.y - vL.x, e2 = vG.y - vL.y + sh, e3 = vG.y - vL.z + 0.4 * sh;
  float qa = ell(uAGe, vec2(1.0, 0.0)), q0 = ell(uVe[0], uVr[0]), q1 = ell(uVe[1], uVr[1]);
  float f1 = max(fwidth(e1), 1e-5), f2 = max(fwidth(e2), 1e-5), f3 = max(fwidth(e3), 1e-5);
  float fqa = max(fwidth(qa), 1e-5), fq0 = max(fwidth(q0), 1e-5), fq1 = max(fwidth(q1), 1e-5);
  vec4 p0 = tt(ij, 0.0);
  if (p0.a < 0.5) discard;
  vec4 p1 = tt(ij, 1.0), p2 = tt(ij, 2.0);
  float h1 = side(e1, f1), h2 = side(e2, f2), h3 = side(e3, f3);
  float wa = side(qa, fqa), vv = max(side(q0, fq0), side(q1, fq1)), wv = vv * (1.0 - wa), lay = (1.0 - wa) * (1.0 - vv);
  float w0 = (1.0 - h1) * lay, w1 = max(0.0, h1 - h2) * lay, w2 = max(0.0, h2 - h3) * lay, w3 = h3 * lay;
  vec3 dc = uCol[0] * w0 + uCol[1] * w1 + uCol[2] * w2 + uCol[3] * w3 + uCol[4] * wa + uCol[5] * wv;
  float foc = clamp(uFoc, 0.0, 1.0);
  float fsel = (w0 * sel(0.0) + w1 * sel(1.0) + w2 * sel(2.0) + w3 * sel(3.0) + wa * sel(4.0) + wv * sel(5.0)) * foc;
  // the wash stays on the tissue; the outlines are whole squares
  float inT = smoothstep(vTB.x - fw.y, vTB.x + fw.y, vG.y) * (1.0 - smoothstep(vTB.y - fw.y, vTB.y + fw.y, vG.y));
  vec4 acc = vec4(0.0);
  // the tile's description as a colour (its own, then mixed with its neighbours'), then the domains' colours, which
  // wash in tile by tile; under them the slide darkens a little, so they read as themselves on its pink (the small
  // patch and vessels a little stronger). While the network floats over it, the slide dims, so its light reads.
  float dp = dpr(p1.a), fa = max(dp, fsel);
  vec3 tint = mix(p0.rgb, p1.rgb, smoothstep(0.25, 0.85, uAdj));
  float ta = 0.3 * smoothstep(0.0, 0.25, uAdj);
  acc = over(acc, vec3(0.012, 0.02, 0.045), max(0.45 * uDim, 0.42 * uFeat) * (1.0 - fa) * inT);
  acc = over(acc, vec3(0.0), DARK * fa * inT);
  acc = over(acc, mix(tint, dc, fa), mix(ta, WA + 0.16 * (wa + wv) + 0.12 * fsel, fa) * (1.0 - 0.5 * (foc - fsel)) * inT);
  // focus: the other domains dim
  acc = over(acc, vec3(0.01, 0.018, 0.035), 0.6 * (foc - fsel) * inT);
  // the outline draws on round the tile, tiles one after another
  float tp = clamp((uTiles * 1.3 - p2.r) / 0.3, 0.0, 1.0);
  float m = max(abs(c.x), abs(c.y));
  float e = abs(0.455 - m) / (abs(c.x) > abs(c.y) ? fw.x : fw.y);
  float per = atan(c.x, c.y) / 6.28318 + 0.5;
  float show = 1.0 - smoothstep(tp * 1.04 - 0.03, tp * 1.04, per);
  float head = exp(-pow((per - tp * 1.04) / 0.05, 2.0)) * step(0.001, tp) * (1.0 - step(0.999, tp));
  // thin and faint from afar (a fine mesh over the slide), brighter once a tile is big on screen; kept on the tissue
  float near = smoothstep(14.0, 70.0, 1.0 / px);
  float inO = smoothstep(vTB.x - 0.04 - fw.y, vTB.x - 0.04, vG.y) * (1.0 - smoothstep(vTB.y + 0.04, vTB.y + 0.04 + fw.y, vG.y));
  float ln = (1.0 - smoothstep(0.15 + 0.2 * near, 0.95 + 0.2 * near, e)) * show * inO * (0.42 + 0.3 * near) * (1.0 - 0.5 * smoothstep(0.0, 0.3, uAdj));
  acc.rgb += vec3(0.55, 0.9, 1.0) * ln * (0.55 + 1.3 * head) * (1.0 - 0.82 * fa);
  acc.rgb += vec3(0.2, 0.45, 0.6) * 0.28 * sin(3.14159 * tp) * inT;
  // clean light borders where two domains meet (the layers' lines stop at the patch and the vessels)
  if (uDom + uFoc > 0.001) {
    float bw = max(0.6, 0.016 / px);
    float bd = max(max(line(e1, f1, bw), line(e2, f2, bw)), line(e3, f3, bw)) * lay;
    bd = max(bd, max(line(qa, fqa, bw), max(line(q0, fq0, bw), line(q1, fq1, bw)) * (1.0 - wa)));
    acc = over(acc, mix(dc, vec3(1.0), 0.55), bd * 0.9 * fa * (1.0 - 0.7 * (foc - fsel)) * inT);
    // the focused domain glows
    acc.rgb += (dc * (0.14 + 0.05 * sin(uTime * 2.2)) + mix(dc, vec3(1.0), 0.5) * bd * 0.7) * fsel * inT;
  }
  gl_FragColor = acc * uA;
}`,
  }));
  const wash = new THREE.Mesh(gridGeo, washMat);
  wash.renderOrder = 5;
  set.group.add(wash);

  // ------------------------------------------------------- features: 16 glowing blocks on every tile
  // (a 4 x 4 mosaic of low blocks on the tile, each as bright and as tall as one of its numbers, as the tour's cells
  // light up in its fluorescence view: the slide darkens, and the mosaics light up in a wave from the close-up tile;
  // as the tiles listen to their neighbours they settle to the mixed numbers, so neighbouring mosaics grow alike)
  const NB = kept.length * NF, HB = 0.016, H0 = 0.0012;
  const boxGeo = new THREE.InstancedBufferGeometry();
  {
    // a box without its floor: x, y across (-0.5..0.5), z up (0..1), with flat normals
    const P = [], N = [], I = [];
    const face = (o, u, v, n) => { const b = P.length / 3; for (const [a, c] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { P.push(o[0] + u[0] * a + v[0] * c, o[1] + u[1] * a + v[1] * c, o[2] + u[2] * a + v[2] * c); N.push(...n); } I.push(b, b + 1, b + 2, b, b + 2, b + 3); };
    face([-0.5, -0.5, 1], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    face([-0.5, -0.5, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0]); face([0.5, 0.5, 0], [-1, 0, 0], [0, 0, 1], [0, 1, 0]);
    face([0.5, -0.5, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]); face([-0.5, 0.5, 0], [0, -1, 0], [0, 0, 1], [-1, 0, 0]);
    boxGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); boxGeo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); boxGeo.setIndex(I);
    const aC = new Float32Array(NB * 3), aS = new Float32Array(NB * 3), aD = new Float32Array(NB * 3), aI = new Float32Array(NB * 4);
    kept.forEach((t, k) => {
      for (let b = 0; b < NF; b++) {
        const o = k * NF + b;
        aC.set(t.p, 3 * o); aS.set(t.ts, 3 * o); aD.set(t.td, 3 * o);
        aI.set([b, t.f[b], t.m[b], t.wave + 0.012 * b], 4 * o);
      }
    });
    for (const [n, a, w] of [['aC', aC, 3], ['aS', aS, 3], ['aD', aD, 3], ['aI', aI, 4]]) boxGeo.setAttribute(n, new THREE.InstancedBufferAttribute(a, w));
    boxGeo.instanceCount = NB;
    boxGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.4);
  }
  const barMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uTS: { value: TS }, uTH: { value: TH } }, U), transparent: true, depthWrite: true,
    vertexShader: `
uniform float uBK, uTS, uTH, uFeat, uAdj, uOut;
attribute vec3 aC, aS, aD; attribute vec4 aI;
varying vec3 vN, vV, vC; varying float vAl, vTop;
${SIDE}
${ICE}
void main() {
  float sd = slabSide(aC); vec3 n = slabN(aC) * sd;
  float g = smoothstep(0.0, 1.0, clamp((uFeat * 1.45 - aI.w) / 0.45, 0.0, 1.0));
  float v = mix(aI.y, aI.z, smoothstep(0.2, 0.85, uAdj));
  float h = (${H0.toFixed(4)} + ${HB.toFixed(4)} * pow(v, 1.6)) * g * uOut * (1.0 - 0.45 * smoothstep(0.0, 0.5, uAdj));
  float bx = mod(aI.x, 4.0), by = floor(aI.x / 4.0), bw = uTS * 0.25 * 0.66 * (1.0 - 0.3 * smoothstep(0.0, 0.6, uAdj));
  vec3 o = aC + n * (uTH * 0.5 + 0.0018) + aS * ((bx + 0.5) * 0.25 - 0.5) * uTS * 0.86 + aD * ((by + 0.5) * 0.25 - 0.5) * uTS * 0.86;
  vec3 p = o + aS * position.x * bw - aD * position.y * bw * sd + n * position.z * h;   // (aS, -aD, n) is right-handed: the faces wind outwards
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * (aS * normal.x - aD * normal.y * sd + n * normal.z)); vV = -mv.xyz;
  vC = ice(v) * (0.75 + 0.5 * v); vAl = step(0.0005, h); vTop = position.z;
  gl_Position = projectionMatrix * mv;
  if (vAl < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA;
varying vec3 vN, vV, vC; varying float vAl, vTop;
void main() {
  vec3 n = normalize(vN), v = normalize(vV), l = normalize(vec3(-0.45, 0.6, 0.65));
  float df = max(dot(n, l), 0.0), fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 col = vC * (0.5 + 0.7 * df) * mix(0.5, 1.15, vTop) + mix(vC, vec3(1.0), 0.5) * fr * 0.25;
  gl_FragColor = vec4(col, uA);
}`,
  });
  set.mats.push(barMat);
  const bars = new THREE.Mesh(boxGeo, barMat);
  bars.frustumCulled = false; bars.renderOrder = 6;
  set.group.add(bars);

  // ------------------------------------------------------- the network of neighbouring tiles
  // A node floats over each tile (a lit sphere in the tile's colour: its description, its own and then mixed), joined
  // to its eight neighbours by glowing tubes; light runs both ways along them (the messages), and the colours mix.
  // Then the nodes lift off into a 3D map of their mixed descriptions (the first three principal components), where
  // alike tiles gather; there they take their group's colour (a domain), and fly back down to colour the section.
  const HN = 0.05;   // how high the network floats over the slab (above the tallest bars)
  // the map: principal components of the mixed descriptions (power iteration, deflated), scaled to a ball
  const ECEN = [0.04, 0.55, 0.34], ER = 0.42;
  {
    const n = kept.length, mu = new Array(NF).fill(0);
    for (const t of kept) for (let f = 0; f < NF; f++) mu[f] += t.m[f] / n;
    const Cv = Array.from({ length: NF }, () => new Array(NF).fill(0));
    for (const t of kept) for (let a = 0; a < NF; a++) for (let b = 0; b < NF; b++) Cv[a][b] += (t.m[a] - mu[a]) * (t.m[b] - mu[b]) / n;
    const PC = [];
    for (let k = 0; k < 3; k++) {
      let w = Array.from({ length: NF }, (_, i) => Math.sin(i * 1.7 + k));
      for (let it = 0; it < 60; it++) {
        const x = Cv.map(r => r.reduce((s, c, j) => s + c * w[j], 0));
        for (const p of PC) { const d = x.reduce((s, c, j) => s + c * p.w[j], 0); for (let j = 0; j < NF; j++) x[j] -= d * p.w[j]; }
        const l = Math.hypot(...x) || 1; w = x.map(c => c / l);
      }
      const lam = Cv.map(r => r.reduce((s, c, j) => s + c * w[j], 0)).reduce((s, c, j) => s + c * w[j], 0);
      PC.push({ w, lam });
    }
    const Z = kept.map(t => PC.map(p => t.m.reduce((s, v, f) => s + (v - mu[f]) * p.w[f], 0) / Math.sqrt(Math.max(p.lam, 1e-9))));
    const rad = Z.map(z => Math.hypot(...z)).sort((a, b) => a - b)[Math.floor(n * 0.95)] || 1;
    // (each drawn 45 % of the way towards its own kind's middle, so the groups read apart: illustrative, the method
    // clusters in the full description)
    const mid = DOM.map((_, d) => { const m = [0, 0, 0]; let c = 0; kept.forEach((t, k) => { if (t.dom === d) { for (let q = 0; q < 3; q++) m[q] += Z[k][q]; c++; } }); return m.map(v => v / Math.max(1, c)); });
    kept.forEach((t, k) => { const z = Z[k].map((v, q) => v + 0.45 * (mid[t.dom][q] - v)); t.e = [ECEN[0] + z[0] / rad * ER * 1.2, ECEN[1] + z[1] / rad * ER * 0.8, ECEN[2] + z[2] / rad * ER * 0.7]; t.ph = R() * 6.28; t.gw = 0.5 * R(); });
  }
  // nodes (instanced lit spheres) and their halos (instanced quads facing the camera)
  const NK = kept.length;
  const nodeGeo = new THREE.InstancedBufferGeometry();
  {
    const s = new THREE.IcosahedronGeometry(1, 1);
    nodeGeo.setAttribute('position', s.attributes.position); nodeGeo.setAttribute('normal', s.attributes.normal);
    if (s.index) nodeGeo.setIndex(s.index);
  }
  const haloGeo = new THREE.InstancedBufferGeometry();
  haloGeo.setIndex([0, 1, 2, 0, 2, 3]);
  haloGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  const NA = { aC: 3, aE: 3, aT0: 3, aT1: 3, aDc: 3, aW: 4 }, nAttr = {};
  for (const k in NA) nAttr[k] = new THREE.InstancedBufferAttribute(new Float32Array(NK * NA[k]), NA[k]);
  function fillNodes() {
    kept.forEach((t, k) => {
      nAttr.aC.array.set(t.p, 3 * k); nAttr.aE.array.set(t.e, 3 * k); nAttr.aT0.array.set(t.tint, 3 * k); nAttr.aT1.array.set(t.tintM, 3 * k);
      nAttr.aDc.array.set([uCol[t.dom].x, uCol[t.dom].y, uCol[t.dom].z].map(x => clamp(x * 1.15, 0, 1)), 3 * k);
      nAttr.aW.array.set([t.wave, 0.45 * dCL(t) / 1.4 + t.gw * 0.35, t.ph, t.dord], 4 * k);
    });
    for (const k in nAttr) nAttr[k].needsUpdate = true;
  }
  fillNodes();
  for (const k in NA) { nodeGeo.setAttribute(k, nAttr[k]); haloGeo.setAttribute(k, nAttr[k]); }
  nodeGeo.instanceCount = haloGeo.instanceCount = NK;
  nodeGeo.boundingSphere = haloGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.6);
  // where a node is (in the vertex shaders): over its tile, in flight, in the map, or back down; its colour and size
  const NODEGL = `
uniform float uBK, uTH, uAdj, uNet, uGrp, uLand, uTime;
attribute vec3 aC, aE, aT0, aT1, aDc; attribute vec4 aW;
${SIDE}
vec3 nodeAt(out vec3 col, out float vis) {
  float sd = slabSide(aC); vec3 n = slabN(aC) * sd, home = aC + n * (uTH * 0.5 + ${HN.toFixed(3)});
  // appears in a wave from the close-up tile; lifts (staggered), arcs out towards you and up into the map, drifts there
  float on = smoothstep(0.0, 1.0, clamp((uNet * 1.5 - aW.x) / 0.5, 0.0, 1.0));
  float g = smoothstep(0.0, 1.0, clamp((uGrp * 1.6 - aW.y) / 0.6, 0.0, 1.0)), ld = smoothstep(0.0, 1.0, clamp((uLand * 1.6 - aW.y) / 0.6, 0.0, 1.0));
  vec3 e = aE + 0.012 * vec3(sin(uTime * 0.7 + aW.z), sin(uTime * 0.55 + aW.z * 1.3), cos(uTime * 0.6 + aW.z));
  vec3 mid = mix(home, e, 0.5) + vec3(0.0, 0.06, 0.18);
  float u = g * (1.0 - ld);
  vec3 p = mix(mix(home, mid, u), mix(mid, e, u), u);
  // its colour: its own description, then the mixed one; in the map its group's colour; down again, it melts into the wash
  col = mix(mix(aT0, aT1, smoothstep(0.25, 0.85, uAdj)), aDc, smoothstep(0.35, 0.9, g));
  vis = max(on, step(0.001, uGrp) * 1.0) * (1.0 - smoothstep(0.7, 1.0, ld));
  return p;
}`;
  const nodeMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uR: { value: 0.0062 } }, U), transparent: true, depthWrite: true,
    vertexShader: NODEGL + `
uniform float uR;
varying vec3 vN, vV, vC; varying float vA;
void main() {
  vec3 col; float vis;
  vec3 p = nodeAt(col, vis);
  vec4 mv = modelViewMatrix * vec4(p + position * uR * (0.4 + 0.6 * vis) * (1.0 + 0.9 * smoothstep(0.3, 1.0, uGrp) * (1.0 - uLand)), 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz; vC = col; vA = vis;
  gl_Position = projectionMatrix * mv;
  if (vis < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA;
varying vec3 vN, vV, vC; varying float vA;
void main() {
  vec3 n = normalize(vN), v = normalize(vV), l = normalize(vec3(-0.45, 0.6, 0.65));
  float df = max(dot(n, l), 0.0), fr = pow(1.0 - max(dot(n, v), 0.0), 2.2), sp = pow(max(dot(reflect(-l, n), v), 0.0), 24.0);
  vec3 col = vC * (0.45 + 0.75 * df) + mix(vC, vec3(1.0), 0.5) * fr * 0.6 + vec3(sp * 0.35);
  gl_FragColor = vec4(col, uA * vA);
}`,
  });
  set.mats.push(nodeMat);
  const nodes = new THREE.Mesh(nodeGeo, nodeMat);
  nodes.frustumCulled = false; nodes.renderOrder = 8;
  set.group.add(nodes);
  const haloMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uR: { value: 0.0062 } }, U), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: NODEGL + `
uniform float uR;
varying vec3 vC; varying float vA; varying vec2 vQ;
void main() {
  vec3 col; float vis;
  vec3 p = nodeAt(col, vis);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * uR * 3.6 * (1.0 + 0.9 * smoothstep(0.3, 1.0, uGrp) * (1.0 - uLand)) * length(modelViewMatrix[0].xyz);
  vC = col; vA = vis; vQ = position.xy;
  gl_Position = projectionMatrix * mv;
  if (vis < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA;
varying vec3 vC; varying float vA; varying vec2 vQ;
void main() {
  float d = length(vQ);
  if (d > 1.0) discard;
  float g = exp(-max(d * 3.6 - 0.9, 0.0) * 1.5) * smoothstep(1.0, 0.55, d);
  gl_FragColor = vec4(mix(vC, vec3(1.0), 0.2) * g * 0.7, g * 0.6 * vA * uA);
}`,
  });
  set.mats.push(haloMat);
  const halos = new THREE.Mesh(haloGeo, haloMat);
  halos.frustumCulled = false; halos.renderOrder = 9;
  set.group.add(halos);

  // the links: a ribbon per pair of neighbours (eight around a tile), turned to face the camera and shaded as a round
  // tube, its colour running from one end's tile to the other's; messages are bright pulses running both ways
  const LK = [];
  for (const t of kept) for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [1, -1]]) { const u = T(t.i + di, t.j + dj); if (u && u.keep) LK.push([t, u, di && dj ? 1 : 0]); }
  const linkGeo = new THREE.InstancedBufferGeometry();
  linkGeo.setIndex([0, 1, 2, 0, 2, 3]);
  linkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3));
  {
    const n = LK.length, at = {};
    for (const k of ['aA', 'aB', 'aA0', 'aA1', 'aB0', 'aB1']) at[k] = new Float32Array(n * 3);
    at.aW = new Float32Array(n * 4);
    LK.forEach(([a, b, dg], k) => {
      at.aA.set(a.p, 3 * k); at.aB.set(b.p, 3 * k); at.aA0.set(a.tint, 3 * k); at.aA1.set(a.tintM, 3 * k); at.aB0.set(b.tint, 3 * k); at.aB1.set(b.tintM, 3 * k);
      at.aW.set([Math.min(a.wave, b.wave), R(), R(), dg], 4 * k);
    });
    for (const k in at) linkGeo.setAttribute(k, new THREE.InstancedBufferAttribute(at[k], k === 'aW' ? 4 : 3));
    linkGeo.instanceCount = n;
    linkGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.4);
  }
  const linkMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uW: { value: 0.0029 } }, U), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
uniform float uBK, uTH, uNet, uAdj, uGrp, uW;
attribute vec3 aA, aB, aA0, aA1, aB0, aB1; attribute vec4 aW;
varying vec3 vCA, vCB; varying vec2 vQ; varying float vVis, vPh, vSp, vLen;
${SIDE}
void main() {
  float sa = slabSide(aA), sb = slabSide(aB);
  vec3 A = aA + slabN(aA) * sa * (uTH * 0.5 + ${HN.toFixed(3)}), B = aB + slabN(aB) * sb * (uTH * 0.5 + ${HN.toFixed(3)});
  float on = smoothstep(0.0, 1.0, clamp((uNet * 1.5 - aW.x - 0.06) / 0.5, 0.0, 1.0)) * (1.0 - smoothstep(0.0, 0.25, uGrp));
  vec4 a = modelViewMatrix * vec4(A, 1.0), b = modelViewMatrix * vec4(B, 1.0);
  vec3 dir = b.xyz - a.xyz, mid = mix(a.xyz, b.xyz, position.x);
  vec3 sideV = normalize(cross(dir, mid));
  vec4 mv = vec4(mid + sideV * position.y * uW * (aW.w > 0.5 ? 0.75 : 1.0) * length(modelViewMatrix[0].xyz), 1.0);
  float m = smoothstep(0.25, 0.85, uAdj);
  vCA = mix(aA0, aA1, m); vCB = mix(aB0, aB1, m);
  vQ = position.xy; vVis = on * (aW.w > 0.5 ? 0.6 : 1.0); vPh = aW.y; vSp = aW.z; vLen = length(dir);
  gl_Position = projectionMatrix * mv;
  if (vVis < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA, uTime, uAdj;
varying vec3 vCA, vCB; varying vec2 vQ; varying float vVis, vPh, vSp, vLen;
void main() {
  float r = abs(vQ.y), core = 1.0 - r * r;
  // messages: two pulses on each link, one each way, while the tiles listen to their neighbours
  float t1 = fract(uTime * (0.32 + 0.12 * vSp) + vPh), t2 = fract(uTime * (0.32 + 0.12 * vSp) + vPh + 0.5);
  float msg = (exp(-pow((vQ.x - t1) / 0.08, 2.0)) + exp(-pow((1.0 - vQ.x - t2) / 0.08, 2.0))) * smoothstep(0.0, 0.3, uAdj) * (1.0 - smoothstep(0.85, 1.0, uAdj) * 0.6);
  vec3 c = mix(vCA, vCB, smoothstep(0.15, 0.85, vQ.x));
  vec3 col = mix(c, vec3(1.0), 0.25 + 0.5 * pow(core, 4.0)) * (0.5 + 2.4 * msg);
  float a = pow(core, 1.5) * vVis * (0.45 + 0.55 * msg);
  gl_FragColor = vec4(col * a, a) * uA;
}`,
  });
  set.mats.push(linkMat);
  const links = new THREE.Mesh(linkGeo, linkMat);
  links.frustumCulled = false; links.renderOrder = 7;
  set.group.add(links);

  // ------------------------------------------------------------- the gauge
  // the submucosa's share of the gut's slides in the preprint (its example; not of this drawn section, whose submucosa
  // thins by the same fraction) and the age, on a small slab of dark glass above the section (its face drawn on a
  // canvas, its edges lit)
  const GW = 0.68, GH = 0.26, GD = 0.022, GCEN = [-0.5, 0.57, 0.06];
  const gCan = document.createElement('canvas'); gCan.width = 512; gCan.height = 196;
  const gTex = new THREE.CanvasTexture(gCan);
  gTex.minFilter = THREE.LinearFilter; gTex.generateMipmaps = false;
  const gaugeU = { uA: set.uA, uK: { value: 0 }, tMap: { value: gTex } };
  const gaugeMat = new THREE.ShaderMaterial({
    uniforms: gaugeU, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; varying vec3 vN, vV; void main() { vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `
uniform sampler2D tMap; uniform float uA, uK; varying vec2 vUv; varying vec3 vN, vV;
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  float fr = pow(1.0 - abs(dot(n, v)), 2.0), df = max(dot(n, normalize(vec3(-0.45, 0.6, 0.65))), 0.0);
  vec4 c = abs(n.z) > 0.9 && gl_FrontFacing ? texture2D(tMap, vUv) : vec4(vec3(0.06, 0.1, 0.18) * (0.6 + 0.8 * df) + vec3(0.5, 0.65, 0.9) * fr, 0.92);
  gl_FragColor = vec4(c.rgb, c.a * uA * uK);
}`,
  });
  set.mats.push(gaugeMat);
  const gauge = new THREE.Mesh(new THREE.BoxGeometry(GW, GH, GD), gaugeMat);
  gauge.position.set(...GCEN); gauge.rotation.x = -0.1; gauge.renderOrder = 10;
  set.group.add(gauge);
  const fmt = x => x.toFixed(1);
  let gKey = '';
  function drawGauge(share, age) {
    const key = fmt(share) + '|' + Math.round(age) + '|' + DOM[1].css;
    if (key === gKey) return;
    gKey = key;
    const g = gCan.getContext('2d'), W = gCan.width, H = gCan.height, col = DOM[1].css;
    g.clearRect(0, 0, W, H);
    const rnd = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    g.fillStyle = 'rgba(4,9,18,0.94)'; g.fillRect(0, 0, W, H);
    rnd(3, 3, W - 6, H - 6, 14); g.lineWidth = 3; g.strokeStyle = col; g.globalAlpha = 0.75; g.stroke(); g.globalAlpha = 1;
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#e7eef8'; g.font = 'bold 38px sans-serif'; g.textAlign = 'left'; g.fillText('Submucosa', 24, 56);
    g.fillStyle = col; g.font = 'bold 50px sans-serif'; g.textAlign = 'right'; g.fillText(fmt(share) + ' %', W - 24, 60);
    // the share as a bar, with ticks at the two ages' values
    const x0 = 24, x1 = W - 24, y = 84, bh = 22, X = v => x0 + (x1 - x0) * v / 100;
    rnd(x0, y, x1 - x0, bh, 8); g.fillStyle = '#1a2536'; g.fill();
    rnd(x0, y, Math.max(16, X(share) - x0), bh, 8); g.fillStyle = col; g.fill();
    g.fillStyle = '#e7eef8';
    for (const v of [EX.from, EX.to]) g.fillRect(X(v) - 1.5, y - 7, 3, bh + 14);
    g.fillStyle = '#95a6bd'; g.font = '30px sans-serif'; g.textAlign = 'left'; g.fillText('of gut slides at', 24, 162);
    g.fillStyle = '#e7eef8'; g.font = 'bold 44px sans-serif'; g.textAlign = 'right'; g.fillText(Math.round(age) + ' years', W - 24, 166);
    gTex.needsUpdate = true;
  }
  drawGauge(EX.from, AGES[0]);

  // -------------------------------------------- a ghost of the tissue set (harness only)
  // slide_ghost > 0 draws the tour's tissue set under the overlay (the engine shows the real one: it leaves this at 0)
  let ghost = null;
  const ghostS = { tissue_a: 1, tissue_graph: 0, tissue_mark: 0, tissue_embed: 0 };

  // ------------------------------------------------------ anchors and views
  const LA = { mucosa: 0.22, submucosa: 0.2, inner: 0.6, outer: 1.34 };   // where along the section
  // the domains' labels: each at the middle of its layer (at 20) where it is clear of the others' in the domains and
  // age views (the mucosa, submucosa and inner muscle stacked on the left, the patch, the vessels and the outer
  // muscle along the section)
  const bandMid = (s, k) => { const ly = layers(s), e = [ly.top, ly.b1, ly.b2, ly.bm, ly.bot]; return front(s, (e[k] + e[k + 1]) / 2); };
  const DA = [bandMid(LA.mucosa, 0), bandMid(LA.submucosa, 1), bandMid(LA.inner, 2), bandMid(LA.outer, 3),
    front(AG.s + AG.A * 0.6, AG.d), front(VES[0].s + 0.01, VES[0].d)];
  const above = (t, h, ds) => v3.add(v3.add(t.p, v3.mul(nrm(t.p[0]), TH / 2 + h)), v3.mul(t.ts, ds || 0));
  const anchors = {
    tiles: front(5.5 * TS, D0 + 0.004),
    feat: above(CL, HB + 0.012, TS * 0.55), listen: above(CL, HN), close: above(CL, 0.012),
    cloud: [ECEN[0] + ER * 0.95, ECEN[1] + ER * 0.62, ECEN[2]], cloudC: ECEN.slice(),
    mucosa: DA[0], submucosa: DA[1], inner: DA[2], outer: DA[3], lymphoid: DA[4], vessels: DA[5],
    muscularis: front(1.05, (layers(1.05).b2 + layers(1.05).bot) / 2),
    gauge: [GCEN[0] + GW / 2 + 0.01, GCEN[1] + 0.04, GCEN[2]],
  };
  const azAt = p => { const n = nrm(p[0]); return Math.atan2(n[0], n[2]) * 180 / PI; };
  const Tc = front(0.72, 0.2), Fc = above(CL, 0.016), Nc = above(CL, 0.03, TS * 0.5);

  const DK = ['mucosa', 'submucosa', 'inner', 'outer', 'lymphoid', 'vessels'];
  const gaugeOn = S => Math.max(S.slide_gauge || 0, prog(S.slide_age, 0, 0.05));
  const domA = (k, S) => {
    const f = S.slide_focus, sel = f < 0.05 ? 1 : Math.max(0, 1 - Math.abs(f - k - 1));
    return Math.max(prog(S.slide_domain, 0.62, 0.95), clamp(f, 0, 1)) * sel * (k >= 4 ? 1 - gaugeOn(S) : 1);
  };
  let lastAge = 0;
  const VIEWS = ['section', 'tiles', 'matrix', 'close', 'group', 'domains', 'age'];

  return Object.assign(set, {
    params: { slide_a: 1, slide_tiles: 0, slide_feat: 0, slide_adj: 0, slide_group: 0, slide_domain: 0, slide_age: 0, slide_focus: 0, slide_gauge: 0, slide_ghost: 0 },
    update(S, t, dt) {
      const tl = S.slide_tiles, ft = S.slide_feat, ad = S.slide_adj, gr = clamp(S.slide_group || 0, 0, 2), dm = S.slide_domain, ag = S.slide_age, fc = S.slide_focus;
      U.uTiles.value = tl; U.uAdj.value = ad; U.uDom.value = dm; U.uAge.value = ag; U.uFoc.value = fc;
      U.uGrp.value = clamp(gr, 0, 1); U.uLand.value = clamp(gr - 1, 0, 1);
      // the network shows with the neighbours (and while the nodes are in the map); the bars from the features on, until
      // the tiles group
      U.uNet.value = Math.max(ad, gr > 0 && gr < 2 ? 1 : 0);
      U.uFeat.value = ft * (1 - prog(gr, 0, 0.3));
      U.uOut.value = 1 - prog(gr, 0, 0.25);
      U.uDim.value = ad * (1 - prog(gr, 0, 0.3));
      // hidden parts are not drawn at all
      wash.visible = tl + ft + ad + dm + fc > 0.001;
      bars.visible = ft > 0.001 && U.uOut.value > 0.003;
      links.visible = ad > 0.001 && gr < 0.25;
      nodes.visible = halos.visible = (ad > 0.001 || gr > 0.001) && gr < 1.999;
      const gv = gaugeOn(S);
      gaugeU.uK.value = gv; gauge.visible = gv > 0.003;
      if (gauge.visible) drawGauge(lerp(EX.from, EX.to, ag), lerp(AGES[0], AGES[1], ag));
      lastAge = ag;
      // the harness's ghost of the tissue set under the overlay
      if (S.slide_ghost > 0.001 && !ghost && SETS.tissue) { ghost = SETS.tissue(K); set.group.add(ghost.group); }
      if (ghost) { ghost.setAlpha(S.slide_ghost); if (S.slide_ghost > 0.003) ghost.update(ghostS, t, dt); }
    },
    anchors,
    labels: [
      { text: ['Tiles', ''], at: 'tiles', cls: 'cyn', alpha: S => prog(S.slide_tiles, 0.15, 0.45) * (1 - prog(S.slide_feat, 0.05, 0.25)) * (1 - prog(Math.max(S.slide_adj, S.slide_domain), 0, 0.2)) },
      { text: ['Features', 'a list of numbers a tile'], at: 'feat', cls: 'cyn', alpha: S => prog(S.slide_feat, 0.45, 0.75) * (1 - prog(Math.max(S.slide_adj, S.slide_group || 0, S.slide_domain), 0.05, 0.3)) },
      { text: ['Each tile', 'listens to its neighbours'], at: 'listen', cls: 'cyn', alpha: S => prog(S.slide_adj, 0.3, 0.6) * (1 - prog(Math.max(S.slide_group || 0, S.slide_domain), 0.02, 0.2)) },
      // the method's last step: alike tiles gather in the map of their descriptions
      { text: ['Alike tiles', 'gather: a domain each'], at: 'cloud', cls: 'cyn', alpha: S => prog(S.slide_group || 0, 0.6, 0.9) * (1 - prog(S.slide_group || 0, 1.05, 1.35)) * (1 - clamp(S.slide_focus, 0, 1)) },
      ...DOM.map((d, k) => ({ text: d.label, at: DK[k], cls: d.cls, alpha: S => domA(k, S) })),
      // (the numbers are on the gauge)
      { text: ['Gut submucosa', 'thins with age'], at: 'gauge', cls: 'mag', alpha: S => gaugeOn(S) },
    ],
    cam: {
      default: [0, 6, 3.2, 0, 0, 0], section: [0, 6, 3.2, 0, 0, 0],
      tiles: [azAt(Tc) - 24, 12, 1.7, ...Tc],
      // (the features and the network from a slant, so the bars and the floating network stand out of the slide)
      matrix: [azAt(Fc) - 22, 20, 0.56, ...Fc],
      close: [azAt(Nc) - 14, 24, 0.66, ...Nc],
      group: [-14, 10, 2.15, ECEN[0] - 0.02, ECEN[1] * 0.62, ECEN[2] * 0.7],
      domains: [5, 5, 2.85, 0.02, -0.02, 0],
      age: [0, 8, 3.25, -0.06, 0.12, 0],
    },
    controls: [
      { key: 'view', label: 'View', options: [['section', 'Section'], ['tiles', 'Tiles'], ['matrix', 'Features'], ['close', 'Neighbours'], ['group', 'Groups'], ['domains', 'Domains'], ['age', 'Age']] },
      { key: 'age', label: 'Age', options: [['20', '20'], ['70', '70']] },
    ],
    explore(c) {
      const i = VIEWS.indexOf(c.view);
      return {
        slide_tiles: i >= 1 ? 1 : 0, slide_feat: i === 2 || i === 3 ? 1 : 0, slide_adj: i >= 3 ? 1 : 0, slide_group: i === 4 ? 1 : i >= 5 ? 2 : 0,
        slide_domain: i >= 4 ? 1 : 0, slide_age: i >= 5 && c.age === '70' ? 1 : 0, slide_gauge: i === 6 ? 1 : 0,
      };
    },
    api() {
      return {
        domains: DOM.map(d => d.name), titles: DOM.map(d => d.title), colours: DOM.map(d => d.css),
        // the preprint's example (from, to: % of gut slides) and this drawn section's shares at 20 and 70 (% of its area,
        // in the order of domains)
        shares: { from: EX.from, to: EX.to, tiles: kept.length, here20: SH20.map(x => +x.toFixed(1)), here70: SH70.map(x => +x.toFixed(1)) },
        // the domain under the ray (at the age now shown), or -1
        pick(rc) {
          if (!set.group.visible) return -1;
          const hits = [];
          wash.raycast(rc, hits);
          hits.sort((a, b) => a.distance - b.distance);
          for (const h of hits) {
            if (!h.uv) continue;
            const k = domAt(h.uv.x * L, D0 + h.uv.y * NY * TS, lastAge);
            if (k >= 0) return k;
          }
          return -1;
        },
        domainColour,
        // take another set's palette (fn(name) -> '#rrggbb' or [r, g, b])
        recolour(fn) {
          DOM.forEach(d => { const c = fn(d.name); if (c) d.css = Array.isArray(c) ? '#' + c.map(x => b8(x).toString(16).padStart(2, '0')).join('') : c; });
          fillCols(); fillNodes(); gKey = '';
        },
      };
    },
    textures: [texT, gTex],
    dispose() { if (ghost) ghost.dispose(); K.dispose(set); texT.dispose(); gTex.dispose(); },
    tileCount: kept.length, linkCount: LK.length,
  });
};
