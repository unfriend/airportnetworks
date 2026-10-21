// One H&E section, the method and the domains (the microanatomy story; Buljan, Bago-Horvath & Rendeiro, bioRxiv 2025),
// drawn over the tour's tissue set (tools/lbi/sets/tissue.js) in its frame: the section is cut into tiles; five tiles
// are described by numbers (features) that fly to a feature matrix; each tile mixes in its neighbours' descriptions
// (message passing); tiles with similar mixed descriptions form the domains (the layers of the gut wall); and the
// domain map changes from age 20 to 70 as in the preprint's gut submucosa example.
// Everything on the section is drawn by two shaders over one mesh that follows the slab: the tiles' outlines, colours
// and borders (one draw call) and the network of neighbouring tiles a little in front of it (another). The domains
// wash in tile by tile, but their borders follow the tissue set's layers, the patch and the vessels to the pixel (the
// real tiles are far smaller than these).
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
    tiles.push({ i, j, keep: inside >= 0.3 * SUB * SUB, fr: fr.map(x => x / tot), dom, slot: -1 });
  }
  const kept = tiles.filter(t => t.keep);
  const nb4 = t => [T(t.i - 1, t.j), T(t.i + 1, t.j), T(t.i, t.j - 1), T(t.i, t.j + 1)].filter(n => n && n.keep);

  // features: each tile is described by 16 numbers, from what it holds (its mix of domains) and some noise; message
  // passing mixes in its neighbours' (two rounds, half its own each time)
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

  // the five tiles lifted for their features: one per main domain, spread along the section, purest first
  const pickTile = (dom, ci) => kept.filter(t => t.dom === dom).sort((a, b) => (b.fr[dom] - a.fr[dom]) * 4 + (Math.abs(a.i - ci) - Math.abs(b.i - ci)) * 0.05)[0];
  const LIFT = [pickTile(0, 5), pickTile(4, 11), pickTile(1, 18), pickTile(2, 27), pickTile(3, 33)].filter(Boolean);
  LIFT.forEach((t, k) => { t.slot = k; });
  const tileC = t => [(t.i + 0.5) * TS, D0 + (t.j + 0.5) * TS];

  // ------------------------------------------------------- the tile texture
  // NP pages of NX x NY texels: 0 own tint + kept, 1 mixed tint + domain order, 2 draw-on order, the lifted slot
  const TT = new Uint8Array(NX * NY * NP * 4);
  const texT = new THREE.DataTexture(TT, NX, NY * NP, THREE.RGBAFormat);
  texT.magFilter = texT.minFilter = THREE.NearestFilter; texT.generateMipmaps = false;
  const b8 = x => Math.round(clamp(x, 0, 1) * 255);
  for (const t of tiles) {
    const put = (p, r, g, b, a) => { const o = 4 * (t.i + NX * (p * NY + t.j)); TT[o] = b8(r); TT[o + 1] = b8(g); TT[o + 2] = b8(b); TT[o + 3] = b8(a); };
    if (!t.keep) { for (let p = 0; p < NP; p++) put(p, 0, 0, 0, 0); continue; }
    put(0, ...t.tint, 1); put(1, ...t.tintM, t.dord);
    put(2, t.ord, 0, t.slot < 0 ? 0 : (t.slot + 1) / 8, 1);
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
  const HEAT = `
vec3 heat(float v) {
  vec3 c = mix(vec3(0.05, 0.03, 0.16), vec3(0.42, 0.07, 0.52), smoothstep(0.0, 0.35, v));
  c = mix(c, vec3(0.96, 0.3, 0.58), smoothstep(0.3, 0.65, v));
  c = mix(c, vec3(1.0, 0.72, 0.28), smoothstep(0.6, 0.85, v));
  return mix(c, vec3(1.0, 0.96, 0.82), smoothstep(0.85, 1.0, v));
}
vec4 over(vec4 acc, vec3 c, float a) { return vec4(c * a + acc.rgb * (1.0 - a), a + acc.a * (1.0 - a)); }`;
  const TILEGL = `
uniform sampler2D tT;
const float NX = ${NX}.0, NY = ${NY}.0, NP = ${NP}.0;
vec4 tt(vec2 ij, float p) { vec2 c = clamp(ij, vec2(0.0), vec2(NX - 1.0, NY - 1.0)); return texture2D(tT, vec2((c.x + 0.5) / NX, (p * NY + c.y + 0.5) / (NP * NY))); }
float kept(vec2 ij) { return step(0.0, ij.x) * step(ij.x, NX - 1.0) * step(0.0, ij.y) * step(ij.y, NY - 1.0) * step(0.5, tt(ij, 0.0).a); }`;

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
  const GRIDV = off => `
uniform float uBK;
attribute vec2 aG, aTB; attribute vec4 aL;
varying vec2 vG, vTB; varying vec4 vL;
void main() {
  vG = aG; vTB = aTB; vL = aL;
  vec3 n = normalize(vec3(-2.0 * uBK * position.x, 0.0, 1.0));
  vec4 mv0 = modelViewMatrix * vec4(position, 1.0);
  float side = dot(normalMatrix * n, -mv0.xyz) >= 0.0 ? 1.0 : -1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + n * side * ${(TH / 2 + off).toFixed(4)}, 1.0);
}`;
  const U = { uA: set.uA, uTime: K.U.uTime, tT: { value: texT }, uBK: { value: BK }, uTiles: { value: 0 }, uFeat: { value: 0 }, uSink: { value: 1 },
    uAdj: { value: 0 }, uDom: { value: 0 }, uAge: { value: 0 }, uFoc: { value: 0 }, uG: { value: 0 },
    // the domains: colours, how much the submucosa thins by 70, the patch and the vessels (centre and half axes in tile
    // units; a vessel's turn as cos, sin)
    uCol: { value: uCol }, uFS: { value: FS }, uAGe: { value: new THREE.Vector4(AG.s / TS, (AG.d - D0) / TS, AG.A / TS, AG.B / TS) },
    uVe: { value: VES.map(v => new THREE.Vector4(v.s / TS, (v.d - D0) / TS, v.A / TS, v.B / TS)) }, uVr: { value: VES.map(v => new THREE.Vector2(v.c, v.sn)) } };
  const washMat = pm(new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide, extensions: { derivatives: true },
    vertexShader: GRIDV(0.0016),
    fragmentShader: TILEGL + HEAT + `
const float TSZ = ${TS.toFixed(6)}, DARK = ${DARK.toFixed(3)}, WA = ${WA.toFixed(3)};
uniform float uA, uTime, uTiles, uFeat, uSink, uAdj, uDom, uAge, uFoc, uFS;
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
  float slot = floor(p2.b * 8.0 + 0.5) - 1.0, isL = step(0.0, slot);
  float lk = isL * smoothstep(0.0, 1.0, clamp((uFeat - 0.03 * slot) / 0.15, 0.0, 1.0)) * uSink;
  vec4 acc = vec4(0.0);
  // the tile's description as a colour (its own, then mixed with its neighbours'), then the domains' colours, which
  // wash in tile by tile; under them the slide darkens a little, so they read as themselves on its pink (the small
  // patch and vessels a little stronger)
  float dp = dpr(p1.a), fa = max(dp, fsel);
  vec3 tint = mix(p0.rgb, p1.rgb, smoothstep(0.25, 0.85, uAdj));
  float ta = 0.42 * smoothstep(0.0, 0.25, uAdj);
  acc = over(acc, vec3(0.0), DARK * fa * inT);
  acc = over(acc, mix(tint, dc, fa), mix(ta, WA + 0.16 * (wa + wv) + 0.12 * fsel, fa) * (1.0 - 0.5 * (foc - fsel)) * inT);
  // focus: the other domains dim
  acc = over(acc, vec3(0.01, 0.018, 0.035), 0.6 * (foc - fsel) * inT);
  // a lifted tile leaves a dark gap
  acc = over(acc, vec3(0.01, 0.02, 0.04), 0.7 * lk * inT);
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
  float hl = isL * smoothstep(0.0, 0.1, uFeat) * uSink;   // the lifted tiles' places stay marked in amber
  vec3 oc = mix(vec3(0.55, 0.9, 1.0), vec3(1.0, 0.72, 0.25), hl);
  acc.rgb += oc * ln * (0.55 + 1.3 * head) * (1.0 - 0.82 * fa + 0.9 * hl);
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

  // the network of neighbouring tiles (spatial adjacency), a little in front of the tiles: a node per tile in its
  // tint, links to the four neighbours, and messages running both ways along every link
  const graphMat = pm(new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide, extensions: { derivatives: true },
    vertexShader: GRIDV(0.011),
    fragmentShader: TILEGL + HEAT + `
uniform float uA, uTime, uAdj, uG;
varying vec2 vG, vTB;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 ij = floor(vG), f = vG - ij, c = f - 0.5;
  if (tt(ij, 0.0).a < 0.5) discard;
  vec2 fw = max(fwidth(vG), vec2(1e-5)); float px = max(fw.x, fw.y);
  vec3 tint = mix(tt(ij, 0.0).rgb, tt(ij, 1.0).rgb, smoothstep(0.25, 0.85, uAdj));
  float kx = c.x > 0.0 ? kept(ij + vec2(1.0, 0.0)) : kept(ij - vec2(1.0, 0.0));
  float ky = c.y > 0.0 ? kept(ij + vec2(0.0, 1.0)) : kept(ij - vec2(0.0, 1.0));
  float dx = abs(c.y) / fw.y, dy = abs(c.x) / fw.x, lw = max(0.3, 0.005 / px);
  float lh = kx * (1.0 - smoothstep(lw, lw + 1.0, dx)), lv = ky * (1.0 - smoothstep(lw, lw + 1.0, dy));
  // u: 0 at the left (upper) tile's centre, 1 at the right (lower) one's
  float uh = c.x > 0.0 ? c.x : c.x + 1.0, uv = c.y > 0.0 ? c.y : c.y + 1.0;
  vec2 hid = c.x > 0.0 ? ij : ij - vec2(1.0, 0.0), vid = c.y > 0.0 ? ij : ij - vec2(0.0, 1.0);
  float sp = 0.32, pw = 0.075;
  float h1 = fract(uTime * sp + hash(hid)), h2 = fract(uTime * sp + hash(hid + 7.1));
  float v1 = fract(uTime * sp + hash(vid + 3.3)), v2 = fract(uTime * sp + hash(vid + 9.7));
  float ph = exp(-pow((uh - h1) / pw, 2.0)) + exp(-pow((1.0 - uh - h2) / pw, 2.0));
  float pv = exp(-pow((uv - v1) / pw, 2.0)) + exp(-pow((1.0 - uv - v2) / pw, 2.0));
  float gw = max(1.0, 0.016 / px);
  float gl = kx * ph * exp(-pow(dx / gw, 2.0)) + ky * pv * exp(-pow(dy / gw, 2.0));
  float rn = max(0.085, 1.5 * px), dn = length(c);
  float node = 1.0 - smoothstep(rn - px * 0.7, rn + px * 0.7, dn);
  float ring = (1.0 - smoothstep(rn + px * 0.6, rn + px * 2.0, dn)) * (1.0 - node);
  vec4 acc = vec4(0.0);
  // dark links and bright messages read on a pale slide as on a dark one
  acc = over(acc, vec3(0.04, 0.1, 0.2), 0.7 * max(lh, lv));
  acc = over(acc, vec3(0.15, 0.85, 1.0), clamp(gl * 1.2, 0.0, 0.95));
  acc.rgb += vec3(0.3, 0.6, 0.7) * 0.35 * gl;
  acc = over(acc, vec3(0.01, 0.02, 0.04), 0.75 * ring);
  acc = over(acc, mix(tint, vec3(1.0), 0.2), node);
  gl_FragColor = acc * uA * uG;
}`,
  }));
  const graph = new THREE.Mesh(gridGeo, graphMat);
  graph.renderOrder = 6;
  set.group.add(graph);

  // ------------------------------------------------- the five lifted tiles
  // a small H&E picture of what each holds (drawn, as the section is), lifted towards the viewer in an amber frame
  const LQ = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  const lGeo = new THREE.BufferGeometry(), lN = LIFT.length * 4;
  const la = { position: new Float32Array(lN * 3), aN: new Float32Array(lN * 3), aT: new Float32Array(lN * 3), aB: new Float32Array(lN * 3), aQ: new Float32Array(lN * 2), aK: new Float32Array(lN), aDom: new Float32Array(lN) };
  const LC = LIFT.map(t => {
    const [s, d] = tileC(t), p = P3(s, d), n = nrm(p[0]);
    return { s, d, p, n, ts: v3.norm(v3.sub(P3(s + 0.01, d), P3(s - 0.01, d))), td: v3.norm(v3.sub(P3(s, d + 0.01), P3(s, d - 0.01))) };
  });
  const lIdx = [];
  LIFT.forEach((t, k) => {
    const c = LC[k];
    for (let q = 0; q < 4; q++) {
      const o = 4 * k + q;
      la.position.set(c.p, 3 * o); la.aN.set(c.n, 3 * o); la.aT.set(c.ts, 3 * o); la.aB.set(c.td, 3 * o);
      la.aQ.set(LQ[q], 2 * o); la.aK[o] = k; la.aDom[o] = t.dom;
    }
    lIdx.push(4 * k, 4 * k + 1, 4 * k + 2, 4 * k, 4 * k + 2, 4 * k + 3);
  });
  for (const k of Object.keys(la)) lGeo.setAttribute(k, new THREE.BufferAttribute(la[k], k === 'aQ' ? 2 : k === 'aK' || k === 'aDom' ? 1 : 3));
  lGeo.setIndex(lIdx);
  lGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.3);
  const LIFTH = 0.14, LIFTS = 1.2;   // how far a tile lifts off the slab, and how much it grows
  const liftMat = pm(new THREE.ShaderMaterial({
    uniforms: Object.assign({ uTS: { value: TS }, uTH: { value: TH }, uLH: { value: LIFTH }, uLS: { value: LIFTS } }, U), transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `
uniform float uFeat, uSink, uTS, uTH, uLH, uLS;
attribute vec3 aN, aT, aB; attribute vec2 aQ; attribute float aK, aDom;
varying vec2 vQ; varying float vDom, vL;
void main() {
  float lk = smoothstep(0.0, 1.0, clamp((uFeat - 0.03 * aK) / 0.15, 0.0, 1.0)) * uSink;
  vL = lk; vQ = aQ + 0.5; vDom = aDom;
  vec3 p = position + aN * (uTH * 0.5 + 0.003 + uLH * lk) + (aT * aQ.x + aB * aQ.y) * uTS * (1.0 + uLS * lk);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  if (lk < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA;
varying vec2 vQ; varying float vDom, vL;
vec3 he(float H, float E) { return exp(-(H * vec3(1.31, 1.37, 0.62) + E * vec3(0.16, 1.05, 0.6))); }
vec2 h2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
// distance to the nearest of a jittered grid of points (n per unit); st stretches the metric (spindles)
float near(vec2 q, float n, vec2 st) {
  vec2 g = q * n, b = floor(g); float best = 9.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = b + vec2(float(x), float(y)), dd = (g - o - 0.15 - 0.7 * h2(o)) * st;
    best = min(best, dot(dd, dd));
  }
  return sqrt(best) / n;
}
void main() {
  vec2 q = vQ;
  int k = int(vDom + 0.5);
  vec3 col = he(0.06, 0.34), nuc = he(1.3, 0.35);
  float nu = 0.0, wh = 0.0;
  if (k == 0) {          // mucosa: gland cells round small lumens
    col = he(0.62, 0.44); wh = 1.0 - smoothstep(0.03, 0.04, near(q, 3.2, vec2(1.0)));
    nu = 1.0 - smoothstep(0.016, 0.022, near(q + 0.31, 13.0, vec2(1.0)));
  } else if (k == 1) {   // submucosa: loose wavy collagen with clefts, a few spindle cells
    col = he(0.06, 0.34); wh = smoothstep(0.78, 0.92, sin(q.y * 46.0 + 4.0 * sin(q.x * 7.0 + q.y * 3.0)));
    nu = 1.0 - smoothstep(0.01, 0.016, near(q, 6.0, vec2(0.45, 2.2)));
  } else if (k == 2) {   // inner muscle, cut across: round nuclei in polygonal bundles
    col = he(0.04, 0.92); wh = 0.6 * smoothstep(0.9, 0.97, sin(q.x * 19.0 + 2.0 * sin(q.y * 9.0)));
    nu = 1.0 - smoothstep(0.012, 0.018, near(q, 11.0, vec2(1.0)));
  } else if (k == 3) {   // outer muscle, cut along: long nuclei
    col = he(0.04, 0.9); wh = 0.6 * smoothstep(0.92, 0.98, sin(q.y * 17.0 + 1.5 * sin(q.x * 6.0)));
    nu = 1.0 - smoothstep(0.012, 0.017, near(q, 8.0, vec2(0.28, 1.7)));
  } else if (k == 4) {   // lymphoid: lymphocytes packed tight
    col = he(0.34, 0.3); nu = 1.0 - smoothstep(0.016, 0.021, near(q, 21.0, vec2(1.0)));
  } else {               // a vessel: a pink wall round a pale lumen
    float r = length(q - vec2(0.45, 0.55));
    col = mix(he(0.06, 0.4), he(0.05, 1.05), smoothstep(0.32, 0.29, r)); wh = smoothstep(0.19, 0.17, r);
    nu = 1.0 - smoothstep(0.012, 0.018, near(q, 9.0, vec2(1.0)));
  }
  col = mix(col, vec3(0.97, 0.95, 0.97), wh);
  col = mix(col, nuc, nu * (1.0 - wh));
  float e = min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y));
  col = mix(col, vec3(1.0, 0.74, 0.3), 1.0 - smoothstep(0.02, 0.05, e));
  float a = vL * uA;
  gl_FragColor = vec4(col * a, a);
}`,
  }));
  const lifted = new THREE.Mesh(lGeo, liftMat);
  lifted.renderOrder = 7; lifted.frustumCulled = false;
  set.group.add(lifted);

  // ------------------------------------------------------- the feature matrix
  // tiles (columns) x features (rows), above the section, turned a little towards a viewer above it; the five lifted
  // tiles' columns land in it, the others fill in (sorted by domain: similar tiles have similar descriptions). Every
  // column is another tile (the matrix stands for tiles of many slides): where this section has too few of a kind (the
  // patch, the vessels), a tile of that kind from elsewhere, described as its kind is plus noise
  const MC = 32, CS = 0.025, MW = MC * CS, MH = NF * CS, MCEN = [0.1, 0.7, 0.12], MROT = -0.12;
  const BLOCK = [[0, 7], [4, 3], [1, 8], [5, 2], [2, 6], [3, 6]];   // [domain, columns] in order
  const cols = [], slotCol = [];
  for (const [dom, n] of BLOCK) {
    const pool = kept.filter(t => t.dom === dom && t.slot < 0), mid = Math.floor(n / 2), own = LIFT.find(t => t.dom === dom);
    for (let c = 0; c < n; c++) {
      if (own && c === mid) { slotCol[own.slot] = cols.length; cols.push({ t: own, slot: true }); continue; }
      const t = pool.length ? pool.splice(Math.floor(R() * pool.length), 1)[0] : { f: featOf([0, 1, 2, 3, 4, 5].map(k => (k === dom ? 0.8 : k === 1 ? 0.2 : 0))) };
      cols.push({ t, slot: false });
    }
  }
  const MV = new Uint8Array(MC * NF * 4);
  cols.forEach((c, x) => {
    const near = Math.min(...slotCol.map(s => Math.abs(s - x)));
    for (let f = 0; f < NF; f++) { const o = 4 * (x + MC * (NF - 1 - f)); MV[o] = b8(c.t.f[f]); MV[o + 1] = b8(near / 8); MV[o + 2] = c.slot ? 255 : 0; MV[o + 3] = 255; }
  });
  const texV = new THREE.DataTexture(MV, MC, NF, THREE.RGBAFormat);
  texV.magFilter = texV.minFilter = THREE.NearestFilter; texV.generateMipmaps = false; texV.needsUpdate = true;
  const MARG = 0.04;
  const matU = Object.assign({ tV: { value: texV }, uIn: { value: 0 }, uOut: { value: 1 } }, U);
  const matMat = pm(new THREE.ShaderMaterial({
    uniforms: matU, transparent: true, depthWrite: false, side: THREE.DoubleSide, extensions: { derivatives: true },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: HEAT + `
uniform sampler2D tV; uniform float uA, uFeat, uIn, uOut;
varying vec2 vUv;
const float MC = ${MC}.0, NF = ${NF}.0, M = ${(MARG / (MW + 2 * MARG)).toFixed(4)}, MV = ${(MARG / (MH + 2 * MARG)).toFixed(4)};
void main() {
  vec2 r = (vUv - vec2(M, MV)) / (1.0 - 2.0 * vec2(M, MV));
  vec2 g = r * vec2(MC, NF), b = floor(g), f = g - b;
  vec2 fw = max(fwidth(g), vec2(1e-5));
  float inM = step(0.0, r.x) * step(r.x, 1.0) * step(0.0, r.y) * step(r.y, 1.0);
  vec4 t = texture2D(tV, (clamp(b, vec2(0.0), vec2(MC - 1.0, NF - 1.0)) + 0.5) / vec2(MC, NF));
  float rev = clamp((uFeat - 0.68 - 0.24 * t.g * 8.0 / 6.0) / 0.08, 0.0, 1.0) * (1.0 - step(0.5, t.b)) * inM;
  float e = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
  float cell = smoothstep(0.05, 0.11, e);
  // the frame of the matrix and of the five landing columns
  vec2 ed = min(r, 1.0 - r) * vec2(MC, NF) / fw;
  float fr = (1.0 - smoothstep(0.6, 1.6, abs(min(ed.x, ed.y)))) * step(-0.02, min(r.x, r.y)) * step(max(r.x, r.y), 1.02);
  float sl = step(0.5, t.b) * inM * (1.0 - smoothstep(0.5, 1.5, min(f.x, 1.0 - f.x) / fw.x));
  vec4 acc = vec4(0.0);
  acc = over(acc, vec3(0.015, 0.03, 0.06), 0.6);
  acc.rgb += heat(t.r) * 1.05 * cell * rev + vec3(0.45, 0.8, 1.0) * 0.5 * fr + vec3(1.0, 0.72, 0.28) * 0.6 * sl;
  gl_FragColor = acc * uA * uIn * uOut;
}`,
  }));
  const matrix = new THREE.Mesh(new THREE.PlaneGeometry(MW + 2 * MARG, MH + 2 * MARG), matMat);
  matrix.position.set(...MCEN); matrix.rotation.x = MROT; matrix.renderOrder = 7;
  set.group.add(matrix);
  matrix.updateMatrix();
  const mR = new THREE.Vector3(1, 0, 0).applyQuaternion(matrix.quaternion), mU = new THREE.Vector3(0, 1, 0).applyQuaternion(matrix.quaternion);
  const M0 = new THREE.Vector3(...MCEN).addScaledVector(mR, -MW / 2).addScaledVector(mU, -MH / 2);

  // the feature bars: a column of 16 per lifted tile (a little bar code: length and brightness are the numbers),
  // which flies up into the matrix and becomes its column there
  const bN = LIFT.length * NF, bGeo = new THREE.BufferGeometry();
  const ba = { position: new Float32Array(bN * 12), aQ: new Float32Array(bN * 8), aK: new Float32Array(bN * 4), aF: new Float32Array(bN * 4), aV: new Float32Array(bN * 4) };
  const bIdx = [];
  LIFT.forEach((t, k) => {
    for (let f = 0; f < NF; f++) {
      const o = k * NF + f;
      for (let q = 0; q < 4; q++) {
        const w = 4 * o + q;
        ba.aQ.set([q === 1 || q === 2 ? 1 : 0, q >= 2 ? 1 : 0], 2 * w); ba.aK[w] = k; ba.aF[w] = f; ba.aV[w] = t.f[f];
      }
      bIdx.push(4 * o, 4 * o + 1, 4 * o + 2, 4 * o, 4 * o + 2, 4 * o + 3);
    }
  });
  for (const k of Object.keys(ba)) bGeo.setAttribute(k, new THREE.BufferAttribute(ba[k], k === 'position' ? 3 : k === 'aQ' ? 2 : 1));
  bGeo.setIndex(bIdx);
  const uS = LIFT.map(() => new THREE.Vector3()), uE = LIFT.map((t, k) => M0.clone().addScaledVector(mR, (slotCol[k] + 0.08) * CS).addScaledVector(mU, (NF - 1 + 0.08) * CS));
  const barU = Object.assign({ uS: { value: uS }, uE: { value: uE }, uMR: { value: mR }, uMU: { value: mU }, uCS: { value: CS }, uOut: matU.uOut }, U);
  const barMat = pm(new THREE.ShaderMaterial({
    uniforms: barU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `
uniform float uA, uFeat, uOut, uCS; uniform vec3 uS[${LIFT.length}], uE[${LIFT.length}], uMR, uMU;
attribute vec2 aQ; attribute float aK, aF, aV;
varying vec2 vQ; varying float vV, vG, vAl;
void main() {
  int k = int(aK + 0.5);
  vec3 S = uS[k] + vec3(0.0, (15.0 - aF) * 0.015, 0.0), E = uE[k] - uMU * (aF * uCS);
  float g = smoothstep(0.0, 1.0, clamp((uFeat - 0.42 - 0.05 * aK - 0.005 * aF) / 0.2, 0.0, 1.0));
  float grow = clamp((uFeat - 0.15 - 0.03 * aK - 0.008 * (15.0 - aF)) / 0.05, 0.0, 1.0);
  vec3 C = 0.5 * (S + E) + vec3(0.0, 0.05, 0.22);
  vec3 P = (1.0 - g) * (1.0 - g) * S + 2.0 * (1.0 - g) * g * C + g * g * E;
  float w = mix(0.01 + 0.075 * aV, uCS * 0.84, g) * grow, h = mix(0.012, uCS * 0.84, g);
  vec3 R = normalize(mix(vec3(1.0, 0.0, 0.0), uMR, g)), U = normalize(mix(vec3(0.0, 1.0, 0.0), uMU, g));
  P += R * (aQ.x * w) + U * (aQ.y * h);
  vQ = aQ; vV = aV; vG = g; vAl = uA * uOut * step(0.001, grow);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(P, 1.0);
  if (vAl < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: HEAT + `
varying vec2 vQ; varying float vV, vG, vAl;
void main() {
  vec3 bar = mix(vec3(0.25, 0.7, 1.0), vec3(0.9, 1.0, 1.0), vV) * (0.5 + 0.9 * vV);
  vec3 col = mix(bar, heat(vV) * 1.05, vG);
  float e = min(min(vQ.x, 1.0 - vQ.x), min(vQ.y, 1.0 - vQ.y));
  gl_FragColor = vec4(col * smoothstep(0.0, mix(0.2, 0.1, vG), e) * vAl, 0.0);
}`,
  }));
  const bars = new THREE.Mesh(bGeo, barMat);
  bars.renderOrder = 8; bars.frustumCulled = false;
  set.group.add(bars);

  // ------------------------------------------------------------- the gauge
  // the submucosa's share of the gut's slides in the preprint (its example; not of this drawn section, whose submucosa
  // thins by the same fraction) and the age, on a small panel above the section
  const GW = 0.68, GH = 0.26, GCEN = [-0.5, 0.57, 0.06];
  const gCan = document.createElement('canvas'); gCan.width = 512; gCan.height = 196;
  const gTex = new THREE.CanvasTexture(gCan);
  gTex.minFilter = THREE.LinearFilter; gTex.generateMipmaps = false;
  const gaugeU = { uA: set.uA, uK: { value: 0 }, tMap: { value: gTex } };
  const gaugeMat = new THREE.ShaderMaterial({
    uniforms: gaugeU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tMap; uniform float uA, uK; varying vec2 vUv; void main() { vec4 c = texture2D(tMap, vUv); gl_FragColor = vec4(c.rgb, c.a * uA * uK); }',
  });
  set.mats.push(gaugeMat);
  const gauge = new THREE.Mesh(new THREE.PlaneGeometry(GW, GH), gaugeMat);
  gauge.position.set(...GCEN); gauge.rotation.x = -0.1; gauge.renderOrder = 9;
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
    rnd(3, 3, W - 6, H - 6, 18); g.fillStyle = 'rgba(4,9,18,0.86)'; g.fill(); g.lineWidth = 3; g.strokeStyle = col; g.globalAlpha = 0.75; g.stroke(); g.globalAlpha = 1;
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
  const LA = { mucosa: 0.22, submucosa: 0.2, inner: 0.6, outer: 1.34, group: 1.15 };   // where along the section
  // the domains' labels: each at the middle of its layer (at 20) where it is clear of the others' in the domains and
  // age views (the mucosa, submucosa and inner muscle stacked on the left, the patch, the vessels and the outer
  // muscle along the section)
  const bandMid = (s, k) => { const ly = layers(s), e = [ly.top, ly.b1, ly.b2, ly.bm, ly.bot]; return front(s, (e[k] + e[k + 1]) / 2); };
  const DA = [bandMid(LA.mucosa, 0), bandMid(LA.submucosa, 1), bandMid(LA.inner, 2), bandMid(LA.outer, 3),
    front(AG.s + AG.A * 0.6, AG.d), front(VES[0].s + 0.01, VES[0].d)];
  const liftNow = LIFT.map(() => 0);
  const liftPos = k => { const c = LC[k]; return v3.add(c.p, v3.mul(c.n, TH / 2 + 0.003 + LIFTH * liftNow[k])); };
  const CL = T(16, 3), clS = (CL.i + 0.5) * TS, clD = D0 + (CL.j + 0.5) * TS;   // the close-up: a tile on the mucosa / submucosa border
  const anchors = {
    tiles: front(5.5 * TS, D0 + 0.004),
    matrix: [MCEN[0] + MW / 2 + 0.02, MCEN[1] + MH / 2 - 0.02, MCEN[2] + 0.03],
    mucosa: DA[0], submucosa: DA[1], inner: DA[2], outer: DA[3], lymphoid: DA[4], vessels: DA[5],
    muscularis: front(1.05, (layers(1.05).b2 + layers(1.05).bot) / 2),
    gauge: [GCEN[0] + GW / 2 + 0.01, GCEN[1] + 0.04, GCEN[2]],
    listen: front(clS, clD, 0.011), close: front(CL.i * TS, D0 + CL.j * TS, 0.006),
    group: front(LA.group, layers(LA.group).top + 0.01),
  };
  LIFT.forEach((t, k) => { anchors['feat' + k] = () => liftPos(k); });
  const azAt = p => { const n = nrm(p[0]); return Math.atan2(n[0], n[2]) * 180 / PI; };
  const Cc = anchors.close, Tc = front(0.72, 0.2);

  const DK = ['mucosa', 'submucosa', 'inner', 'outer', 'lymphoid', 'vessels'];
  const gaugeOn = S => Math.max(S.slide_gauge || 0, prog(S.slide_age, 0, 0.05));
  const domA = (k, S) => {
    const f = S.slide_focus, sel = f < 0.05 ? 1 : Math.max(0, 1 - Math.abs(f - k - 1));
    return Math.max(prog(S.slide_domain, 0.62, 0.95), clamp(f, 0, 1)) * sel * (k >= 4 ? 1 - gaugeOn(S) : 1);
  };
  let lastAge = 0;
  const _o = [0, 0, 0];

  return Object.assign(set, {
    params: { slide_a: 1, slide_tiles: 0, slide_feat: 0, slide_adj: 0, slide_domain: 0, slide_age: 0, slide_focus: 0, slide_gauge: 0, slide_ghost: 0 },
    update(S, t, dt) {
      const tl = S.slide_tiles, ft = S.slide_feat, ad = S.slide_adj, dm = S.slide_domain, ag = S.slide_age, fc = S.slide_focus;
      const later = Math.max(ad, dm), sink = 1 - prog(later, 0, 0.25);
      U.uTiles.value = tl; U.uFeat.value = ft; U.uSink.value = sink; U.uAdj.value = ad; U.uDom.value = dm; U.uAge.value = ag; U.uFoc.value = fc;
      U.uG.value = prog(ad, 0, 0.25) * (1 - prog(dm, 0.1, 0.45));
      matU.uIn.value = prog(ft, 0.35, 0.55); matU.uOut.value = 1 - prog(later, 0.1, 0.45);
      // hidden parts are not drawn at all
      wash.visible = tl + ft + ad + dm + fc > 0.001;
      graph.visible = U.uG.value > 0.003;
      lifted.visible = ft > 0.001 && sink > 0.001;
      matrix.visible = matU.uIn.value * matU.uOut.value > 0.003;
      bars.visible = ft > 0.15 && matU.uOut.value > 0.003;
      for (let k = 0; k < LIFT.length; k++) {
        liftNow[k] = smooth(clamp((ft - 0.03 * k) / 0.15, 0, 1)) * sink;
        const c = LC[k], sc = TS * (1 + LIFTS * liftNow[k]) / 2, h = TH / 2 + 0.003 + LIFTH * liftNow[k];
        for (let i = 0; i < 3; i++) _o[i] = c.p[i] + c.n[i] * h;
        uS[k].set(_o[0] - sc, _o[1] + sc + 0.012, _o[2]);
      }
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
      { text: ['Features', 'from a vision model'], at: 'matrix', cls: 'amb', alpha: S => prog(S.slide_feat, 0.6, 0.85) * (1 - prog(Math.max(S.slide_adj, S.slide_domain), 0.05, 0.3)) },
      { text: ['Each tile', 'listens to its neighbours'], at: 'listen', cls: 'cyn', alpha: S => prog(S.slide_adj, 0.3, 0.6) * (1 - prog(S.slide_domain, 0.1, 0.3)) },
      // the method's last step (only after the steps before it: on its own the wash is just the domains)
      { text: ['Similar tiles', 'group into domains'], at: 'group', cls: 'cyn', alpha: S => prog(S.slide_domain, 0.12, 0.35) * (1 - prog(S.slide_domain, 0.5, 0.64)) * prog(S.slide_tiles, 0.5, 1) * (1 - clamp(S.slide_focus, 0, 1)) },
      ...DOM.map((d, k) => ({ text: d.label, at: DK[k], cls: d.cls, alpha: S => domA(k, S) })),
      // (the numbers are on the gauge)
      { text: ['Gut submucosa', 'thins with age'], at: 'gauge', cls: 'mag', alpha: S => gaugeOn(S) },
    ],
    cam: {
      default: [0, 6, 3.2, 0, 0, 0], section: [0, 6, 3.2, 0, 0, 0],
      tiles: [azAt(Tc) - 24, 12, 1.7, ...Tc],
      matrix: [4, 9, 3.9, 0.06, 0.28, 0.05],
      close: [azAt(Cc) - 12, 9, 0.42, ...Cc],
      domains: [5, 5, 2.85, 0.02, -0.02, 0],
      age: [0, 8, 3.25, -0.06, 0.12, 0],
    },
    controls: [
      { key: 'view', label: 'View', options: [['section', 'Section'], ['tiles', 'Tiles'], ['matrix', 'Features'], ['close', 'Neighbours'], ['domains', 'Domains'], ['age', 'Age']] },
      { key: 'age', label: 'Age', options: [['20', '20'], ['70', '70']] },
    ],
    explore(c) {
      const v = c.view, i = ['section', 'tiles', 'matrix', 'close', 'domains', 'age'].indexOf(v);
      return {
        slide_tiles: i >= 1 ? 1 : 0, slide_feat: i === 2 ? 1 : 0, slide_adj: i >= 3 ? 1 : 0, slide_domain: i >= 4 ? 1 : 0,
        slide_age: i >= 4 && c.age === '70' ? 1 : 0, slide_gauge: i === 5 ? 1 : 0,
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
          fillCols(); gKey = '';
        },
      };
    },
    textures: [texT, texV, gTex],
    dispose() { if (ghost) ghost.dispose(); K.dispose(set); texT.dispose(); texV.dispose(); gTex.dispose(); },
    tileCount: kept.length,
  });
};
