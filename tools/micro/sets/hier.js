// The hier set of the microanatomy story: organ architecture as a network of four levels (organs, tissues, tissue
// types, domains: MICRO_DATA.graph, Iva Buljan's network, the talk's Figure 5a in 3D) and one organ's network of
// contacts between its domains, changing with age (the preprint's findings; MICRO_DATA.figures.interactions when it
// holds readings). The levels are stacked rings, wide at the top (organs), narrow at the tissue types and wide again
// at the domains, so the tissue types sit at the waist of an hourglass; links hang between the rings as soft threads.
// Everything follows the params; only the switch from one focused node or organ to the next eases in its own time
// (a jump to another index crossfades for 0.3 s; a seek or the first frame shows the new one at once).
SETS.hier = function (K) {
  const { THREE, clamp, lerp, prog, smooth, v3, rgb } = K;
  const set = K.newSet('hier');
  const PI = Math.PI, TAU = 2 * PI;
  const D = MICRO_DATA, G = D.graph, NN = G.nodes.length;
  const LVN = D.levels || ['organ', 'tissue', 'tissue type', 'domain'];
  const NAME = G.nodes.map(n => n[0]), LEV = G.nodes.map(n => n[1]), AB = G.nodes.map(n => +n[2] || 0);
  const LCOL = ['#1f8a4c', '#7ccf7e', '#ef8f7a', '#5aa9ff'].map(rgb);   // organs, tissues, tissue types, domains (Figure 5)
  const ids = [...Array(NN).keys()], byLev = [0, 1, 2, 3].map(L => ids.filter(i => LEV[i] === L));
  const find = s => { const q = String(s || '').trim().toLowerCase(); return NAME.findIndex(n => n.toLowerCase() === q); };
  const short = s => String(s).replace(/\s*\(.*\)\s*$/, '');

  // ---------------------------------------------------------------- the graph: links from the upper level to the lower
  // (the graph's five tissue type-tissue type links are loops of a type to itself: left out)
  const EU = [];
  {
    const seen = new Set();
    for (const [a, b] of G.edges) {
      if (a === b || LEV[a] === LEV[b]) continue;
      const u = LEV[a] < LEV[b] ? a : b, v = u === a ? b : a;
      if (!seen.has(u * NN + v)) { seen.add(u * NN + v); EU.push([u, v]); }
    }
  }
  const NE = EU.length, UP = ids.map(() => []), DN = ids.map(() => []);
  EU.forEach(([u, v]) => { DN[u].push(v); UP[v].push(u); });
  const DEG = ids.map(i => UP[i].length + DN[i].length);
  // the organs a tissue type is found in (directly or through one of the organ's tissues)
  const ORGS = ids.map(i => (LEV[i] !== 2 ? [] : [...new Set(UP[i].flatMap(u => (LEV[u] === 1 ? UP[u] : [u])))].filter(o => LEV[o] === 0)));
  const CONN = (j => (j >= 0 ? j : byLev[2].reduce((m, t) => (ORGS[t].length > ORGS[m].length ? t : m), byLev[2][0])))(find('connective tissue'));

  // ---------------------------------------------------------------- layout: four rings, ordered so threads hang short
  const ANG = new Float64Array(NN), RAW = new Float64Array(NN);
  const norm = a => ((a % TAU) + TAU) % TAU;
  const cmean = list => { let x = 0, z = 0; for (const [a, w] of list) { x += Math.cos(a) * w; z += Math.sin(a) * w; } return norm(Math.atan2(z, x)); };
  // sort by the wished-for angle, then space evenly round the ring, turned to fit the wishes best
  const spread = list => {
    const s = list.slice().sort((a, b) => RAW[a] - RAW[b]), n = s.length;
    let x = 0, z = 0;
    s.forEach((i, k) => { const d = RAW[i] - TAU * k / n; x += Math.cos(d); z += Math.sin(d); });
    const off = Math.atan2(z, x);
    s.forEach((i, k) => { ANG[i] = norm(TAU * k / n + off); });
  };
  {
    const T = byLev[2], sh = (a, b) => UP[a].filter(u => UP[b].includes(u)).length;
    const order = [CONN];   // tissue types: each next to the one it shares most organs and tissues with
    while (order.length < T.length) {
      const last = order[order.length - 1];
      let best = -1, bs = -1;
      for (const t of T) if (!order.includes(t)) { const s = sh(last, t) + 0.01 * UP[t].length; if (s > bs) { bs = s; best = t; } }
      order.push(best);
    }
    order.forEach((t, k) => { ANG[t] = TAU * k / T.length; });
    const tw = t => 1 / Math.sqrt(Math.max(1, UP[t].length));   // a rare tissue type pulls harder than connective tissue
    for (let it = 0; it < 4; it++) {
      for (const i of byLev[1]) RAW[i] = cmean(DN[i].map(t => [ANG[t], tw(t)]));
      for (const i of byLev[0]) RAW[i] = cmean(DN[i].map(j => [LEV[j] === 1 ? RAW[j] : ANG[j], LEV[j] === 1 ? 1 : tw(j)]));
      spread(byLev[0]);
      for (const i of byLev[1]) RAW[i] = cmean([[ANG[UP[i][0]], 3], ...DN[i].map(t => [ANG[t], tw(t) * 0.5])]);
      spread(byLev[1]);
      if (it < 3) { for (const t of T) RAW[t] = cmean(UP[t].map(u => [ANG[u], 1])); spread(T); }
    }
    // domains: in arcs under their tissue type
    const dm = byLev[3].slice().sort((a, b) => NAME[a].localeCompare(NAME[b]));
    for (const i of dm) RAW[i] = UP[i].length ? ANG[UP[i][0]] : 0;
    spread(dm);
    // turn the whole so connective tissue faces you
    const rot = -ANG[CONN];
    for (const i of ids) ANG[i] = norm(ANG[i] + rot);
  }
  const RING = [[0.9, 0.66], [0.7, 0.28], [0.4, -0.1], [1.02, -0.62]];   // [radius, height] per level
  const GS = [0, 0.22, 0.44, 0.66];   // when each level starts to grow (hier_grow)
  const POS = ids.map(i => { const [R, y] = RING[LEV[i]], a = ANG[i]; return [R * Math.sin(a), y, R * Math.cos(a)]; });
  const RAD = ids.map(i => (LEV[i] === 3 ? 0.013 + 0.0026 * Math.sqrt(AB[i]) : LEV[i] === 2 ? 0.028 + 0.0075 * Math.sqrt(DEG[i]) : 0.024 + 0.007 * Math.sqrt(DEG[i])));
  const SW = ids.map(i => 0.08 * norm(ANG[i] + PI) / TAU);   // each ring grows round from the back

  // ---------------------------------------------------------------- the domain-contact networks
  // Organs with contact findings. Their domains (names as in the graph; calcified plaque is not a domain of the graph)
  // and contacts are illustrative: layers that touch, with a share of contacts (0..1) for the band's width. The
  // findings (MICRO_DATA.findings.interactions) say which contacts change with age and which way; values read off the
  // talk's figures (MICRO_DATA.figures.interactions) set by how much, where present. axis: the surface layer and the
  // deepest, drawn top and bottom.
  const CO = [
    { name: 'Colon', organ: 'Colon', tissue: 'Colon - Transverse', re: /colon/i, axis: [0, 4],
      dom: ['mucosa epithelium', 'mucosa lamina propria', 'submucosa', 'muscularis', 'adventitia subserosa', 'lymphoid tissue', 'blood vessels'],
      con: [[0, 1, 0.85], [1, 2, 0.55], [2, 3, 0.5], [3, 4, 0.6], [1, 5, 0.22], [2, 5, 0.3], [2, 6, 0.3], [4, 6, 0.2]] },
    { name: 'Skin', organ: 'Skin', tissue: 'Skin - Sun Exposed (Lower leg)', re: /skin/i, axis: [0, 4],
      dom: ['epidermis', 'papillary dermis', 'reticular dermis', 'subdermis', 'fat', 'blood vessels'],
      con: [[0, 1, 0.85], [1, 2, 0.7], [2, 3, 0.5], [3, 4, 0.55], [1, 5, 0.2], [2, 5, 0.3], [3, 5, 0.15]] },
    { name: 'Ovary', organ: 'Ovary', re: /ovar/i, axis: [0, 3],
      dom: ['ovarian cortex', 'ovarian stroma', 'corpus albicans', 'fibromuscular tissue', 'mucosa', 'blood vessels'],
      con: [[0, 1, 0.8], [1, 2, 0.35], [1, 3, 0.35], [3, 4, 0.25], [1, 5, 0.35], [0, 5, 0.12], [3, 5, 0.15]] },
    { name: 'Fallopian tube', organ: 'Fallopian Tube', re: /fallopian/i, axis: [0, 2],
      dom: ['mucosa', 'muscularis', 'fibromuscular tissue', 'blood vessels', 'fat'],
      con: [[0, 1, 0.7], [1, 2, 0.6], [0, 2, 0.22], [2, 3, 0.35], [2, 4, 0.35], [1, 3, 0.2]] },
    { name: 'Uterus', organ: 'Uterus', re: /uter/i, axis: [0, 2], shift: ['endometrium', 'connective tissue and adipose tissue'],
      dom: ['endometrium', 'myometrium', 'connective tissue and adipose tissue', 'vessels and connective tissue', 'blood vessels'],
      con: [[0, 1, 0.75], [1, 2, 0.45], [1, 3, 0.4], [0, 2, 0.15], [3, 4, 0.35], [1, 4, 0.2]] },
    { name: 'Coronary artery', organ: 'Artery', tissue: 'Artery - Coronary', re: /coronary/i, axis: [0, 3],
      dom: ['tunica intima', 'tunica media', 'tunica adventitia', 'fat', 'myocardium', 'calcified plaque'],
      con: [[0, 1, 0.85], [1, 2, 0.75], [2, 3, 0.55], [2, 4, 0.2], [3, 4, 0.15], [5, 0, 0.06], [5, 1, 0.05]] },
  ].map(o => Object.assign(o, { dom: o.dom.slice(), con: o.con.map(c => c.slice()), ch: [] }));
  const NCO = CO.length;
  // a change: [a, b, dir (1 more contacts with age, -1 fewer), d (share gained by age 70), from figures?]
  function addChange(co, a, b, dir, d, fig) {
    const di = n => {
      let j = co.dom.findIndex(x => x.toLowerCase() === String(n).trim().toLowerCase());
      if (j < 0 && co.dom.length < 8 && find(n) >= 0 && LEV[find(n)] === 3) { co.dom.push(NAME[find(n)]); j = co.dom.length - 1; }
      return j;
    };
    const ia = di(a), ib = di(b);
    if (ia < 0 || ib < 0 || ia === ib || !dir) return;
    let c = co.con.find(x => (x[0] === ia && x[1] === ib) || (x[0] === ib && x[1] === ia));
    if (!c) { c = [ia, ib, 0.3]; co.con.push(c); }
    const old = co.ch.find(x => x.c === c);
    if (old && !fig) return;
    const ch = old || { c, a: co.dom[ia], b: co.dom[ib] };
    Object.assign(ch, { dir: Math.sign(dir), d: d !== null ? d : Math.sign(dir) * 0.26, fig: !!fig });
    if (!old) co.ch.push(ch);
  }
  for (const f of (D.findings && D.findings.interactions) || []) {
    const co = CO.find(o => o.organ.toLowerCase() === String(f.organ || '').toLowerCase());
    if (!co) continue;
    let a = f.a, b = f.b, dir = f.dir;
    if ((!a || !b) && co.shift && /connective/i.test(f.note || '')) { [a, b] = co.shift; dir = 1; }   // "the endometrium turns towards connective tissue"
    if (a && b) addChange(co, a, b, dir, null, false);
  }
  // readings of the talk's figure of contact changes, if any: rows { organ or tissue, a and b or pair 'a-b', change per
  // decade (percentage points of border contact), or from and to (% at 20 and 70) }
  {
    const FI = D.figures && D.figures.interactions;
    const rows = Array.isArray(FI) ? FI : FI && typeof FI === 'object'
      ? (['points', 'rows', 'pairs', 'data'].map(k => FI[k]).find(Array.isArray)
        || Object.entries(FI).flatMap(([org, v]) => (Array.isArray(v) ? v.map(r => Object.assign({ organ: org }, r)) : [])))
      : [];
    const num = x => (typeof x === 'number' && isFinite(x) ? x : null);
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      const org = String(r.organ || r.tissue || r.group || ''), co = CO.find(o => o.re.test(org));
      if (!co) continue;
      let a = r.a, b = r.b;
      if (!a || !b) { const p = String(r.pair || r.name || r.label || '').split('-'); if (p.length === 2) [a, b] = p; }
      if (!a || !b) continue;
      const pd = num(r.perDecade) ?? num(r.change) ?? num(r.slope) ?? num(r.delta) ?? num(r.x);
      const fr = num(r.from), to = num(r.to);
      const d = fr !== null && to !== null ? (to - fr) / 100 : pd !== null ? pd * 5 / 100 : null;
      if (d === null || !d) continue;
      addChange(co, a, b, Math.sign(d), d, true);
      if (fr !== null) { const ch = co.ch[co.ch.length - 1]; if (ch) ch.c[2] = clamp(fr / 100, 0.03, 0.98); }
    }
  }
  // the preprint's examples of change with age, for the nodes' sizes (corpus albicans, the gut's submucosa ...)
  const exFor = (co, name) => (D.examples || []).find(e => e.domain.toLowerCase() === name.toLowerCase()
    && (co.re.test(e.tissue) || (co.organ === 'Colon' && /gastro|intestin|colon|gut/i.test(e.tissue))));
  // domain colours: the atlas set's (the engine may hand them over as K.domainColour, or later through api().useColours),
  // else the talk's colours of tissue types (Figure 5b), a little varied per domain
  const TYPEC = { 'adipose tissue': '#9fd3f2', 'cardiac muscle': '#3f86d6', 'connective tissue': '#b5dc8f', 'glandular tissue': '#45b05e',
    'lining epithelium': '#f4a3ab', 'lymphoid structure': '#e2363a', 'neuronal tissue': '#f6c27a', 'skeletal muscle': '#d77a3c',
    'smooth muscle': '#f2861f', 'vascular tissue': '#c9a9e6' };
  const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
  function ownColour(name) {
    const i = find(name), t = i >= 0 && UP[i].length ? NAME[UP[i][0]] : '';
    if (!TYPEC[t]) return rgb('#e9e1cf');   // calcified plaque: bone white
    const c = rgb(TYPEC[t]), k = 0.88 + 0.24 * (((hash(name) % 100) + 100) % 100) / 100;
    return c.map(x => clamp(x * k, 0, 1));
  }
  let domainColour = typeof K.domainColour === 'function' ? n => rgb(K.domainColour(n)) : ownColour;
  // a small force layout per organ, in the plane facing you, the surface layer on top, a little depth for parallax
  const CEN = [0, 0.02, 0.45], CR = 0.5;
  for (const [k, co] of CO.entries()) {
    const n = co.dom.length, r = K.rng(31 + 7 * k);
    let P = co.dom.map((_, i) => [Math.cos(TAU * i / n) * 0.5, Math.sin(TAU * i / n) * 0.5]);
    for (let it = 0; it < 500; it++) {
      const F = P.map(() => [0, 0]), st = 0.06 * (1 - it / 560);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1], d2 = Math.max(1e-4, dx * dx + dy * dy), f = 0.03 / d2, d = Math.sqrt(d2);
        F[i][0] -= f * dx / d; F[i][1] -= f * dy / d; F[j][0] += f * dx / d; F[j][1] += f * dy / d;
      }
      for (const [a, b, w] of co.con) {
        const dx = P[b][0] - P[a][0], dy = P[b][1] - P[a][1], d = Math.max(1e-3, Math.hypot(dx, dy)), f = 0.6 * (d - (0.62 - 0.3 * w));
        F[a][0] += f * dx / d; F[a][1] += f * dy / d; F[b][0] -= f * dx / d; F[b][1] -= f * dy / d;
      }
      P = P.map((p, i) => [p[0] + clamp(F[i][0] - 0.05 * p[0], -1, 1) * st, p[1] + clamp(F[i][1] - 0.05 * p[1], -1, 1) * st]);
    }
    // turn so the surface layer is on top and the deepest at the bottom; centre and size
    const [s0, s1] = co.axis, ax = [P[s0][0] - P[s1][0], P[s0][1] - P[s1][1]], th = PI / 2 - Math.atan2(ax[1], ax[0]);
    P = P.map(([x, y]) => [x * Math.cos(th) - y * Math.sin(th), x * Math.sin(th) + y * Math.cos(th)]);
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sc = Math.min(2 * CR * 1.15 / Math.max(1e-3, x1 - x0), 2 * CR * 0.85 / Math.max(1e-3, y1 - y0), 2.5);
    co.P = P.map(p => [CEN[0] + (p[0] - (x0 + x1) / 2) * sc, CEN[1] + (p[1] - (y0 + y1) / 2) * sc, CEN[2] + (r() - 0.5) * 0.22]);
    co.top = CEN[1] + (y1 - y0) / 2 * sc;
    co.gi = co.dom.map(find).map(i => (i >= 0 && LEV[i] === 3 ? i : -1));
    co.gOrgan = find(co.organ); co.gTissue = co.tissue ? find(co.tissue) : -1;
    co.col = co.dom.map(domainColour);
    co.ex = co.dom.map(nm => exFor(co, nm) || null);
    const str = co.dom.map((_, i) => co.con.reduce((s, c) => s + (c[0] === i || c[1] === i ? c[2] : 0), 0));
    co.rad = str.map(s => 0.046 + 0.026 * Math.sqrt(s / Math.max(...str)));
    // the bands: a gentle arc bowing away from the middle and towards you
    co.bands = co.con.map(c => {
      const A = co.P[c[0]], B = co.P[c[1]], M = v3.lerp(A, B, 0.5), len = v3.dist(A, B);
      let out = [M[0] - CEN[0], M[1] - CEN[1], 0];
      if (v3.len(out) < 0.05) out = [-(B[1] - A[1]), B[0] - A[0], 0];
      const C = v3.add(M, v3.add(v3.mul(v3.norm(out), 0.07 * len), [0, 0, 0.05 * len]));
      return { c, A, B, C, mid: [0, 1, 2].map(q => 0.25 * A[q] + 0.5 * C[q] + 0.25 * B[q]), ch: co.ch.find(x => x.c === c) || null };
    });
    const core = co.bands.filter(b => !b.ch).sort((x, y) => y.c[2] - x.c[2])[0] || co.bands[0];
    co.core = core.mid;
    co.change = (co.bands.find(b => b.ch) || core).mid;
  }
  const NCN = CO.reduce((s, o) => s + o.dom.length, 0);
  CO.reduce((o0, co) => { co.o = o0; return o0 + co.dom.length; }, 0);

  // ---------------------------------------------------------------- the network's threads (tubes, in the hierarchy's group)
  const hg = new THREE.Group();   // the four-level network: moves back and shrinks as a contact network comes forward
  set.group.add(hg);
  const TS = 18, TR = 4, EV = (TS + 1) * TR;
  const thrGeo = new THREE.BufferGeometry();
  const aH = new Float32Array(NE * EV);
  {
    const nv = NE * EV, C = new Float32Array(nv * 3), Nr = new Float32Array(nv * 3), T = new Float32Array(nv), S0 = new Float32Array(nv),
      L0 = new Float32Array(nv), L1 = new Float32Array(nv), PH = new Float32Array(nv), idx = [];
    let v = 0;
    const pt = (u, v0, w0, dA) => {
      const [RA, yA] = RING[LEV[v0]], [RB, yB] = RING[LEV[w0]], s = smooth(u), R = lerp(RA, RB, s), a = ANG[v0] + dA * s;
      return [R * Math.sin(a), lerp(yA, yB, u), R * Math.cos(a)];
    };
    EU.forEach(([a, b], e) => {
      let dA = ANG[b] - ANG[a];
      dA = dA > PI ? dA - TAU : dA < -PI ? dA + TAU : dA;
      const v0 = v, ph = K.rng(e + 5)() * TAU, st = GS[LEV[b]] - 0.06 + SW[b];
      for (let s = 0; s <= TS; s++) {
        const u = s / TS, p = pt(u, a, b, dA), q = pt(Math.min(1, u + 0.01), a, b, dA), q0 = pt(Math.max(0, u - 0.01), a, b, dA);
        const t = v3.norm(v3.sub(q, q0)), radial = v3.norm([p[0], 0, p[2]]);
        let n1 = v3.cross(t, radial); if (v3.len(n1) < 1e-4) n1 = [1, 0, 0]; n1 = v3.norm(n1);
        const n2 = v3.norm(v3.cross(t, n1));
        for (let r = 0; r < TR; r++) {
          const th = r / TR * TAU, d = v3.add(v3.mul(n1, Math.cos(th)), v3.mul(n2, Math.sin(th)));
          C.set(p, 3 * v); Nr.set(d, 3 * v); T[v] = u; S0[v] = st; L0[v] = LEV[a]; L1[v] = LEV[b]; PH[v] = ph; v++;
        }
      }
      for (let s = 0; s < TS; s++) for (let r = 0; r < TR; r++) {
        const a0 = v0 + s * TR + r, a1 = v0 + s * TR + (r + 1) % TR;
        idx.push(a0, a0 + TR, a1, a1, a0 + TR, a1 + TR);
      }
    });
    thrGeo.setAttribute('position', new THREE.BufferAttribute(C, 3));
    thrGeo.setAttribute('aNrm', new THREE.BufferAttribute(Nr, 3));
    thrGeo.setAttribute('aT', new THREE.BufferAttribute(T, 1));
    thrGeo.setAttribute('aS', new THREE.BufferAttribute(S0, 1));
    thrGeo.setAttribute('aL0', new THREE.BufferAttribute(L0, 1));
    thrGeo.setAttribute('aL1', new THREE.BufferAttribute(L1, 1));
    thrGeo.setAttribute('aPh', new THREE.BufferAttribute(PH, 1));
    thrGeo.setAttribute('aH', new THREE.BufferAttribute(aH, 1).setUsage(THREE.DynamicDrawUsage));
    thrGeo.setIndex(idx);
  }
  const thrMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uGrow: { value: 1 }, uK: { value: 1 }, uF: { value: 0 }, uLC: { value: LCOL.map(c => new THREE.Color(...c)) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aNrm; attribute float aT, aS, aL0, aL1, aPh, aH;
uniform float uGrow, uF, uK; uniform vec3 uLC[4];
varying vec3 vC; varying float vA, vT, vPh, vH;
void main() {
  // drawn from the upper node down to the lower one as the lower level grows; the growing end tapers
  float g = clamp((uGrow - aS) / 0.12, 0.0, 1.0), on = step(aT, g + 0.0001), tip = g > 0.999 ? 1.0 : smoothstep(g, g - 0.15, aT);
  float h = aH * uF;
  float r = 0.0026 * (1.0 + 0.9 * h) * on * mix(0.3, 1.0, tip);
  vC = mix(uLC[int(aL0 + 0.5)], uLC[int(aL1 + 0.5)], aT); vT = aT; vPh = aPh; vH = h;
  vA = on * uK * (0.34 * (1.0 - 0.82 * uF) + 0.8 * h);
  vec4 mv = modelViewMatrix * vec4(position + aNrm * r, 1.0);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `
uniform float uA, uTime;
varying vec3 vC; varying float vA, vT, vPh, vH;
void main() {
  if (vA < 0.003) discard;
  // a light runs down each thread now and then (organ to domain)
  float run = pow(0.5 + 0.5 * sin(vT * 7.0 - uTime * 1.4 + vPh), 12.0);
  vec3 col = mix(vC, vec3(1.0), 0.18 + 0.25 * vH) * (0.75 + 0.9 * run);
  gl_FragColor = vec4(col, vA * uA);
}`,
  });
  set.mats.push(thrMat);
  const threads = new THREE.Mesh(thrGeo, thrMat);
  threads.frustumCulled = false; threads.renderOrder = 2;
  hg.add(threads);
  // the four rings, drawn round as their level grows
  const RS = 120, ringGeo = K.linesGeo(4 * RS);
  {
    const P = ringGeo.attributes.position.array, Cc = ringGeo.attributes.aCol.array, A = ringGeo.attributes.aA.array, Tt = ringGeo.attributes.aT.array;
    for (let L = 0; L < 4; L++) for (let s = 0; s < RS; s++) for (let e = 0; e < 2; e++) {
      const k = (L * RS + s) * 2 + e, a = TAU * (s + e) / RS + PI, [R, y] = RING[L];
      P.set([R * Math.sin(a), y, R * Math.cos(a)], 3 * k); Cc.set(LCOL[L].map(x => Math.min(1, x * 1.3 + 0.05)), 3 * k);
      A[k] = 0.32; Tt[k] = GS[L] + 0.16 * (s + e) / RS;
    }
  }
  const ringMat = K.lines(set, { uniforms: { uK: { value: 1 } }, head: 'uniform float uK;', vertex: 'vA *= uK;' });
  const rings = new THREE.LineSegments(ringGeo, ringMat);
  rings.frustumCulled = false; rings.renderOrder = 1;
  hg.add(rings);

  // ---------------------------------------------------------------- nodes: lit spheres and additive halos
  // one instance per network node (0..NN-1) and per contact-network node (NN..NN+NCN-1)
  const NI = NN + NCN;
  const sphGeo = new THREE.SphereGeometry(1, 14, 10);
  const nCol = new THREE.InstancedBufferAttribute(new Float32Array(NI * 3), 3), nA = new THREE.InstancedBufferAttribute(new Float32Array(NI), 1);
  nCol.setUsage(THREE.DynamicDrawUsage); nA.setUsage(THREE.DynamicDrawUsage);
  sphGeo.setAttribute('aCol', nCol); sphGeo.setAttribute('aA', nA);
  const nodeMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA }, transparent: true, depthWrite: true,
    vertexShader: `
attribute vec3 aCol; attribute float aA;
varying vec3 vC, vN, vV; varying float vA;
void main() {
  vC = aCol; vA = aA;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
  if (aA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA;
varying vec3 vC, vN, vV; varying float vA;
void main() {
  float a = vA * uA;
  if (a < 0.02) discard;
  vec3 n = normalize(vN), v = normalize(vV), l = normalize(vec3(-0.45, 0.6, 0.65));
  float df = max(dot(n, l), 0.0), fr = pow(1.0 - max(dot(n, v), 0.0), 2.2), sp = pow(max(dot(reflect(-l, n), v), 0.0), 24.0);
  vec3 col = vC * (0.45 + 0.75 * df) + mix(vC, vec3(1.0), 0.5) * fr * 0.6 + vec3(sp * 0.3);
  gl_FragColor = vec4(col, a);
}`,
  });
  set.mats.push(nodeMat);
  const nodes = new THREE.InstancedMesh(sphGeo, nodeMat, NI);
  nodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  nodes.frustumCulled = false; nodes.renderOrder = 3;
  nodes.raycast = () => {};   // (pick() knows the nodes)
  set.group.add(nodes);
  const IM = nodes.instanceMatrix.array;
  const haloGeo = new THREE.InstancedBufferGeometry();
  haloGeo.setIndex([0, 1, 2, 0, 2, 3]);
  haloGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  const HA = {};
  for (const [name, k] of [['aP', 3], ['aCol', 3], ['aSize', 1], ['aA', 1], ['aRing', 1]]) {
    HA[name] = new THREE.InstancedBufferAttribute(new Float32Array(NI * k), k);
    HA[name].setUsage(THREE.DynamicDrawUsage);
    haloGeo.setAttribute(name, HA[name]);
  }
  haloGeo.instanceCount = NI;
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aP, aCol; attribute float aSize, aA, aRing;
uniform float uA;
varying vec3 vC; varying float vA, vR; varying vec2 vQ;
void main() {
  vC = aCol; vA = aA * uA; vR = aRing; vQ = position.xy;
  vec4 mv = modelViewMatrix * vec4(aP, 1.0);
  mv.xy += position.xy * 3.2 * aSize * length(modelViewMatrix[0].xyz);
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uTime;
varying vec3 vC; varying float vA, vR; varying vec2 vQ;
void main() {
  float d = length(vQ);
  if (d > 1.0) discard;
  float rr = d * 3.2;   // in node radii
  float glow = exp(-max(rr - 0.95, 0.0) * 1.8) * smoothstep(1.0, 0.7, d);
  float ring = vR * smoothstep(0.14, 0.0, abs(rr - 1.75 - 0.12 * sin(uTime * 3.0)));
  vec3 col = vC * glow * 0.6 + mix(vC, vec3(1.0), 0.45) * ring;
  gl_FragColor = vec4(col, vA * max(glow * 0.55, ring));
}`,
  });
  set.mats.push(haloMat);
  const halos = new THREE.Mesh(haloGeo, haloMat);
  halos.frustumCulled = false; halos.renderOrder = 4;
  halos.raycast = () => {};
  set.group.add(halos);

  // ---------------------------------------------------------------- the contact bands (tubes; width and colour per frame)
  const BS = 22, BR = 6, NBD = CO.reduce((s, o) => s + o.bands.length, 0);
  const bandGeo = new THREE.BufferGeometry();
  {
    const nv = NBD * (BS + 1) * BR, C = new Float32Array(nv * 3), Nr = new Float32Array(nv * 3), T = new Float32Array(nv), Bi = new Float32Array(nv), idx = [];
    let v = 0, bi = 0;
    for (const co of CO) for (const b of co.bands) {
      const v0 = v, { A, B, C: Cp } = b;
      for (let s = 0; s <= BS; s++) {
        const u = s / BS, w = 1 - u, p = [0, 1, 2].map(i => w * w * A[i] + 2 * u * w * Cp[i] + u * u * B[i]);
        const t = v3.norm([0, 1, 2].map(i => 2 * w * (Cp[i] - A[i]) + 2 * u * (B[i] - Cp[i])));
        let n1 = v3.cross(t, [0, 0, 1]); if (v3.len(n1) < 1e-4) n1 = [1, 0, 0]; n1 = v3.norm(n1);
        const n2 = v3.norm(v3.cross(t, n1));
        for (let q = 0; q < BR; q++) {
          const th = q / BR * TAU, d = v3.add(v3.mul(n1, Math.cos(th)), v3.mul(n2, Math.sin(th)));
          C.set(p, 3 * v); Nr.set(d, 3 * v); T[v] = u; Bi[v] = bi; v++;
        }
      }
      for (let s = 0; s < BS; s++) for (let q = 0; q < BR; q++) {
        const a0 = v0 + s * BR + q, a1 = v0 + s * BR + (q + 1) % BR;
        idx.push(a0, a0 + BR, a1, a1, a0 + BR, a1 + BR);
      }
      b.bi = bi++;
    }
    bandGeo.setAttribute('position', new THREE.BufferAttribute(C, 3));
    bandGeo.setAttribute('aNrm', new THREE.BufferAttribute(Nr, 3));
    bandGeo.setAttribute('aT', new THREE.BufferAttribute(T, 1));
    bandGeo.setAttribute('aB', new THREE.BufferAttribute(Bi, 1));
    bandGeo.setIndex(idx);
  }
  const UB = Array.from({ length: NBD }, () => new THREE.Vector4());   // x radius, y warmth (-1 cool .. 1 warm), z alpha, w reveal
  const bandMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uB: { value: UB }, uCore: { value: new THREE.Color(...rgb('#eadff5')) },
      uWarm: { value: new THREE.Color(...rgb('#ffb43b')) }, uCool: { value: new THREE.Color(...rgb('#46d9ff')) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aNrm; attribute float aT, aB;
uniform vec4 uB[${NBD}];
varying vec3 vN, vW; varying float vT, vY, vZ;
void main() {
  vec4 B = uB[int(aB + 0.5)];
  // drawn from both ends to the middle
  float m = min(aT, 1.0 - aT) * 2.0, on = step(m, B.w + 0.0001);
  float r = B.x * on;
  vT = aT; vY = B.y; vZ = B.z * on;
  vN = normalize(mat3(modelMatrix) * aNrm);
  vec4 wp = modelMatrix * vec4(position + aNrm * r, 1.0); vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: `
uniform float uA, uTime; uniform vec3 uCore, uWarm, uCool;
varying vec3 vN, vW; varying float vT, vY, vZ;
void main() {
  if (vZ < 0.003) discard;
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float c = abs(dot(n, v));
  vec3 base = mix(uCore, vY > 0.0 ? uWarm : uCool, min(1.0, abs(vY)));
  float flow = 0.85 + 0.3 * sin(vT * 16.0 - uTime * 2.2);   // contacts as a quiet flow along the band
  vec3 col = base * (0.45 + 0.75 * c) * flow + vec3(1.0) * 0.12 * pow(c, 6.0);
  gl_FragColor = vec4(col, (0.3 + 0.6 * c) * vZ * uA);
}`,
  });
  set.mats.push(bandMat);
  const bands = new THREE.Mesh(bandGeo, bandMat);
  bands.frustumCulled = false; bands.renderOrder = 2;
  set.group.add(bands);

  // ---------------------------------------------------------------- focus: what lights up with a node
  // 1 for the node and its direct links, 0.6 two steps, 0.35 three, up and down the levels (not sideways); an edge
  // lights as far as the walk that reached its lower or upper end went along it
  const REL = new Map();
  function relOf(k) {
    if (REL.has(k)) return REL.get(k);
    const wt = [1, 1, 0.6, 0.35], walk = nb => {
      const w = new Float32Array(NN); w[k] = 1;
      let front = [k];
      for (let s = 1; s <= 3 && front.length; s++) {
        const nx = [];
        for (const u of front) for (const v of nb[u]) if (!w[v]) { w[v] = wt[s]; nx.push(v); }
        front = nx;
      }
      return w;
    };
    const wu = walk(UP), wd = walk(DN), w = new Float32Array(NN), e = new Float32Array(NE);
    for (const i of ids) w[i] = Math.max(wu[i], wd[i]);
    EU.forEach(([u, v], j) => { e[j] = Math.max(wd[u] && wd[v] ? Math.min(wd[u], wd[v]) : 0, wu[u] && wu[v] ? Math.min(wu[u], wu[v]) : 0); });
    const r = { w, e };
    REL.set(k, r);
    return r;
  }
  // up to six nodes named round a focused one: its direct links (none when it has more than 8), then for an organ the
  // tissue types of its tissues
  const LABN = new Map();
  function labFor(k) {
    if (LABN.has(k)) return LABN.get(k);
    const out = [], direct = [...UP[k], ...DN[k]];
    if (direct.length <= 8) {
      for (const j of direct.slice().sort((a, b) => LEV[a] - LEV[b] || DEG[b] - DEG[a])) if (out.length < 6) out.push(j);
      if (LEV[k] === 0) for (const ti of DN[k]) if (LEV[ti] === 1) for (const t of DN[ti]) if (!out.includes(t) && out.length < 6) out.push(t);
    }
    LABN.set(k, out);
    return out;
  }
  // the shown focus and organ: a crossfade from index a to b (m 0..1); a fractional param crossfades by its fraction
  const FS = { a: -1, b: -1, m: 1, fresh: true }, OS = { a: 0, b: 0, m: 1, fresh: true };
  function stepSel(st, v0, dt, lo, hi) {
    const v = clamp(isFinite(v0) ? v0 : lo, lo, hi), iv = Math.round(v);
    if (Math.abs(v - iv) > 0.001) { st.a = Math.floor(v); st.b = Math.ceil(v); st.m = v - st.a; st.fresh = false; return; }
    if (st.fresh || !(dt > 0) || dt > 0.25) { st.a = st.b = iv; st.m = 1; st.fresh = false; return; }
    if (iv !== st.b) { st.a = st.m >= 0.5 ? st.b : st.a; st.b = iv; st.m = 0; }
    st.m = Math.min(1, st.m + dt * 3.5);
  }
  const wOf = (st, k) => (st.b === k ? smooth(st.m) : 0) + (st.a === k ? 1 - smooth(st.m) : 0);

  // ---------------------------------------------------------------- per frame
  const cur = { c: 0, cl: 0, fon: 0, age: 0, hz: 0, hs: 1, hy: 0, fw: new Float32Array(NN), nl: new Float32Array(NN), vis: new Float32Array(NN),
    cw: new Float32Array(NCO), cp: CO.map(o => o.P.map(p => p.slice())), dom: 0, sig: '' };
  const posOf = i => [POS[i][0] * cur.hs, POS[i][1] * cur.hs + cur.hy, POS[i][2] * cur.hs + cur.hz];
  const hw = new Float32Array(NN), eh = new Float32Array(NE);
  function setInst(k, p, s, col, a, halo, ring) {
    const o = 16 * k;
    IM[o] = s; IM[o + 1] = 0; IM[o + 2] = 0; IM[o + 3] = 0; IM[o + 4] = 0; IM[o + 5] = s; IM[o + 6] = 0; IM[o + 7] = 0;
    IM[o + 8] = 0; IM[o + 9] = 0; IM[o + 10] = s; IM[o + 11] = 0; IM[o + 12] = p[0]; IM[o + 13] = p[1]; IM[o + 14] = p[2]; IM[o + 15] = 1;
    nCol.array.set(col, 3 * k); nA.array[k] = a;
    HA.aP.array.set(p, 3 * k); HA.aCol.array.set(col, 3 * k); HA.aSize.array[k] = s; HA.aA.array[k] = a * halo; HA.aRing.array[k] = ring;
  }
  const _c = [0, 0, 0];
  function update(S, t, dt) {
    const g = clamp(S.hier_grow === undefined ? 1 : S.hier_grow, 0, 1), c = smooth(clamp(S.hier_contacts || 0, 0, 1)), age = clamp(S.hier_age || 0, 0, 1);
    stepSel(FS, S.hier_focus === undefined ? -1 : S.hier_focus, dt, -1, NN - 1);
    stepSel(OS, S.hier_organ || 0, dt, 0, NCO - 1);
    const fon = 1 - wOf(FS, -1);
    cur.c = c; cur.fon = fon; cur.age = age; cur.cl = prog(clamp(S.hier_contacts || 0, 0, 1), 0.55, 0.9);
    for (let k = 0; k < NCO; k++) cur.cw[k] = wOf(OS, k);
    cur.dom = cur.cw[OS.b] >= 0.5 ? OS.b : OS.a;
    // the network steps back as the contacts come forward
    cur.hz = -0.85 * c; cur.hs = 1 - 0.2 * c; cur.hy = 0.06 * c;
    hg.position.set(0, cur.hy, cur.hz); hg.scale.setScalar(cur.hs);
    thrMat.uniforms.uGrow.value = g; thrMat.uniforms.uF.value = fon; thrMat.uniforms.uK.value = lerp(1, 0.1, c);
    ringMat.uniforms.uReveal.value = g; ringMat.uniforms.uK.value = lerp(1, 0.25, c);
    // what the focus lights
    hw.fill(0); eh.fill(0); cur.fw.fill(0); cur.nl.fill(0);
    for (const k of FS.a === FS.b ? [FS.a] : [FS.a, FS.b]) {
      const w = wOf(FS, k);
      if (k < 0 || w <= 0) continue;
      const r = relOf(k);
      for (let i = 0; i < NN; i++) hw[i] += w * r.w[i];
      for (let j = 0; j < NE; j++) eh[j] += w * r.e[j];
      cur.fw[k] += w;
      for (const j of labFor(k)) cur.nl[j] += w;
    }
    const sig = `${FS.a},${FS.b},${FS.m.toFixed(3)}`;
    if (sig !== cur.sig) {
      cur.sig = sig;
      for (let j = 0; j < NE; j++) aH.fill(Math.min(1, eh[j]), j * EV, (j + 1) * EV);
      thrGeo.attributes.aH.needsUpdate = true;
    }
    // the network's nodes
    const leave = prog(c, 0, 0.12);   // contact domains leave their ring as they fly
    for (let i = 0; i < NN; i++) {
      const L = LEV[i], ga = prog(g, GS[L] + SW[i], GS[L] + SW[i] + 0.1);
      let og = 0, gone = 0;
      for (let k = 0; k < NCO; k++) {
        const w = cur.cw[k];
        if (!w) continue;
        if (i === CO[k].gOrgan || i === CO[k].gTissue) og += w;
        if (CO[k].gi.includes(i)) gone += w * leave;
      }
      const lit = 1 - 0.8 * fon * (1 - Math.min(1, hw[i]));
      let vis = ga * lit * (1 - gone);
      vis *= lerp(1, 0.12 + 0.75 * og, c);
      cur.vis[i] = vis;
      const br = (0.5 + 0.5 * lit) * (1 + 0.3 * cur.fw[i]) * lerp(1, 0.6 + 0.6 * og, c);
      for (let q = 0; q < 3; q++) _c[q] = Math.min(1, LCOL[L][q] * br);
      const s = RAD[i] * (0.25 + 0.75 * ga) * (1 + 0.5 * cur.fw[i]) * (1 + 0.4 * og * c) * cur.hs;
      setInst(i, posOf(i), s, _c, vis, 0.55 + 0.45 * Math.min(1, hw[i]) * fon, cur.fw[i] * (1 - c));
    }
    // the contact networks
    let bi = 0;
    for (let k = 0; k < NCO; k++) {
      const co = CO[k], w = cur.cw[k], n = co.dom.length;
      for (let j = 0; j < n; j++) {
        const ii = NN + co.o + j;
        if (w <= 0 || c <= 0) { nA.array[ii] = 0; HA.aA.array[ii] = 0; continue; }
        const f = prog(c, 0.04 + 0.06 * j / n, 0.5 + 0.06 * j / n), gi = co.gi[j];
        const st = gi >= 0 ? posOf(gi) : posOf(co.gTissue >= 0 ? co.gTissue : Math.max(0, co.gOrgan));
        const p = v3.lerp(st, co.P[j], f);
        p[1] += 0.12 * Math.sin(PI * f);
        cur.cp[k][j] = p;
        const ex = co.ex[j], grow = ex ? Math.cbrt(lerp(ex.from, ex.to, age) / ex.from) : 1;
        const s = lerp(gi >= 0 ? RAD[gi] * cur.hs : 0.02, co.rad[j] * grow, f);
        const col = v3.lerp(LCOL[3], co.col[j], f);
        setInst(ii, p, s, col, w * prog(c, 0, 0.12), 0.8, 0);
      }
      const rv = prog(clamp(S.hier_contacts || 0, 0, 1), 0.55, 0.95);
      for (const b of co.bands) {
        const ch = b.ch, sh = ch ? clamp(b.c[2] + ch.d * age, 0.03, 0.98) : b.c[2];
        UB[bi++].set(0.003 + 0.042 * sh, ch ? ch.dir * (0.35 + 0.65 * age) : 0, w * (c > 0 ? 1 : 0), rv);
      }
    }
    nodes.instanceMatrix.needsUpdate = true; nCol.needsUpdate = true; nA.needsUpdate = true;
    for (const k in HA) HA[k].needsUpdate = true;
    nodeMat.depthWrite = set.uA.value > 0.9;
  }

  // ---------------------------------------------------------------- anchors, labels, views
  const dco = () => CO[cur.dom];
  const anchors = {
    top: () => [0, (RING[0][1] + 0.06) * cur.hs + cur.hy, cur.hz],
    bottom: () => [0, (RING[3][1] - 0.04) * cur.hs + cur.hy, cur.hz],
    connective: () => posOf(CONN),
    focus: () => { const k = FS.m >= 0.5 ? FS.b : FS.a; return k >= 0 ? posOf(k) : [0, 0, 0]; },
    contacts: () => [CEN[0] - 0.14, dco().top + 0.13, CEN[2]],
    change: () => dco().change,
    core: () => dco().core,
    age: [CEN[0] - CR - 0.12, CEN[1] - CR * 0.85, CEN[2]],
  };
  for (let L = 0; L < 4; L++) anchors['lv' + L] = () => [(RING[L][0] + 0.05) * cur.hs, RING[L][1] * cur.hs + cur.hy, cur.hz];
  const CLS = ['grn', 'grn', 'amb', 'cyn'];
  const lvOn = (S, L) => prog(clamp(S.hier_grow === undefined ? 1 : S.hier_grow, 0, 1), GS[L] + 0.04, GS[L] + 0.14) * (1 - cur.fon) * (1 - cur.c);
  const nTis = i => DN[i].filter(j => LEV[j] === 1).length;
  const nTyp = i => new Set(DN[i].flatMap(j => (LEV[j] === 1 ? DN[j] : [j])).filter(j => LEV[j] === 2)).size;
  const cap = s => s.replace(/^./, x => x.toUpperCase());
  const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const rest = i => (LEV[i] === 0 ? (nTis(i) ? ` · ${pl(nTis(i), 'tissue')}, ${pl(nTyp(i), 'type')}` : ` · ${pl(nTyp(i), 'tissue type')}`)
    : LEV[i] === 1 ? ` · ${pl(nTyp(i), 'tissue type')}`
    : LEV[i] === 2 ? ` · ${ORGS[i].length} organs, ${pl(DN[i].length, 'domain')}`
    : UP[i].length ? ` · ${NAME[UP[i][0]]}` : '');
  const labels = [
    { text: ['Organs', ` · ${byLev[0].length}`], at: 'lv0', cls: 'grn', alpha: S => lvOn(S, 0) },
    { text: ['Tissues', ` · ${byLev[1].length} in this map`], at: 'lv1', cls: 'grn', alpha: S => lvOn(S, 1) },
    { text: ['Tissue types', ` · ${byLev[2].length}`], at: 'lv2', cls: 'amb', alpha: S => lvOn(S, 2) },
    { text: ['Domains', ` · ${byLev[3].length} in this map`], at: 'lv3', cls: 'cyn', alpha: S => lvOn(S, 3) },
    { text: [cap(NAME[CONN]), ` · in ${ORGS[CONN].length} of ${byLev[0].length} organs`], at: 'connective', cls: 'amb',
      alpha: S => prog(clamp(S.hier_grow === undefined ? 1 : S.hier_grow, 0, 1), 0.8, 0.95) * (1 - cur.fon) * (1 - cur.c) },
  ];
  for (const i of ids) {
    labels.push({ text: [cap(short(NAME[i])), rest(i)], at: () => posOf(i), cls: CLS[LEV[i]], alpha: () => cur.fw[i] * (1 - cur.c) });
    labels.push({ text: [cap(short(NAME[i])), ''], at: () => posOf(i), cls: '', minor: true, alpha: () => clamp(cur.nl[i], 0, 1) * cur.vis[i] * (1 - cur.c) });
  }
  CO.forEach((co, k) => {
    const on = () => cur.cw[k] * cur.cl;
    labels.push({ text: [co.name, ' · domain contacts'], at: 'contacts', cls: '', alpha: on });
    co.dom.forEach((nm, j) => labels.push({ text: [nm, ''], at: () => cur.cp[k][j], cls: '', minor: true, alpha: on }));
    co.bands.filter(b => b.ch).forEach(b => labels.push({ text: [`${cap(b.ch.a)}–${b.ch.b}`, b.ch.dir > 0 ? ' · more with age' : ' · fewer with age'],
      at: b.mid, cls: b.ch.dir > 0 ? 'amb' : 'cyn', alpha: on }));
  });
  labels.push({ text: ['The core stays', ''], at: 'core', cls: 'grn', alpha: () => cur.cl * prog(cur.age, 0.05, 0.4) });
  for (let d = 0; d <= 5; d++) labels.push({ text: [`${20 + 10 * d} years`, ''], at: 'age', cls: '', minor: true, alpha: () => cur.cl * clamp(1 - Math.abs(cur.age * 5 - d) * 2, 0, 1) });

  const cam = {
    default: [0, 12, 4.15, 0, -0.03, 0],
    net: [28, 38, 4.3, 0, -0.1, 0],
    contacts: [0, 6, 2.3, CEN[0], CEN[1] + 0.03, CEN[2]],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['network', 'Network'], ['contacts', 'Contacts']] },
    { key: 'organ', label: 'Organ', options: CO.map((o, k) => [String(k), o.name]), when: v => v.view === 'contacts' },
    { key: 'age', label: 'Age', options: [['20', '20 years'], ['70', '70 years']], when: v => v.view === 'contacts' },
  ];
  function explore(c) {
    return { hier_grow: 1, hier_contacts: c.view === 'contacts' ? 1 : 0, hier_organ: clamp(parseInt(c.organ, 10) || 0, 0, NCO - 1),
      hier_age: c.age === '70' ? 1 : 0 };
  }
  // picking: the node nearest along the ray within a little more than its radius
  const _p = new THREE.Vector3(), _d = new THREE.Vector3();
  function pick(rc) {
    const ray = rc.ray;
    set.group.updateMatrixWorld();
    const M = set.group.matrixWorld, sc = M.getMaxScaleOnAxis();
    let best = -1, bt = Infinity;
    const test = (p, r, id) => {
      _p.set(p[0], p[1], p[2]).applyMatrix4(M);
      const tt = _d.copy(_p).sub(ray.origin).dot(ray.direction), rr = Math.max(r * 1.6, 0.03) * sc;
      if (tt > 0 && tt < bt && ray.distanceSqToPoint(_p) < rr * rr) { bt = tt; best = id; }
    };
    if (cur.c > 0.5) { const co = dco(); co.dom.forEach((_, j) => test(cur.cp[cur.dom][j], co.rad[j], co.gi[j])); }
    else for (let i = 0; i < NN; i++) if (cur.vis[i] > 0.15) test(posOf(i), RAD[i], i);
    return best;
  }
  const API = {
    nodes: ids.map(i => ({ i, name: NAME[i], level: LEV[i], levelName: LVN[LEV[i]] })),
    levels: LVN.slice(),
    pick,
    find,
    linked: i => ({ up: UP[i] ? UP[i].slice() : [], down: DN[i] ? DN[i].slice() : [] }),
    organsOfType: i => (ORGS[i] || []).slice(),
    contactOrgans: CO.map(co => ({ name: co.name, organ: co.gOrgan, tissue: co.gTissue, domains: co.dom.slice(),
      changes: co.ch.map(ch => ({ a: ch.a, b: ch.b, dir: ch.dir, from: ch.c[2], to: clamp(ch.c[2] + ch.d, 0.03, 0.98), fig: ch.fig })) })),
    levelColour: L => '#' + new THREE.Color(...LCOL[L]).getHexString(),
    useColours(fn) { if (typeof fn !== 'function') return; domainColour = n => rgb(fn(n)); for (const co of CO) co.col = co.dom.map(domainColour); },
  };

  return Object.assign(set, {
    params: { hier_a: 1, hier_grow: 1, hier_focus: -1, hier_contacts: 0, hier_organ: 0, hier_age: 0 },
    update, anchors, labels, cam, controls, explore,
    api: () => API,
  });
};
