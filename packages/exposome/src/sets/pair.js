// Two substances and their genes (builder B): the idea behind the map, close up. Substance A stands on the left, B on
// the right; between them every gene either disturbs (XDATA.targets: the genes it has been seen to touch), as a small
// bead with a thread from its substance. A's own genes gather left of the middle, B's right of it, and the genes both
// touch on a disc in the middle, threaded from both sides. Then the shared ones glow and the others step back, and the
// shared ones draw in to the line between the two: their threads fold into one, the thread the map ties between A and
// B. The two are diethylstilbestrol (a synthetic oestrogen, once a medicine) and zearalenone (an oestrogen-like toxin of a
// mould on grain): chemically unlike, 92 genes in common where chance would give about 3 (269 x 262 / 25,579 genes),
// a strong link in the authors' network. The counts come from targets.bin; without it the set shows the two and the
// tie only (prep: the load waits for it).
// Params: pair_a (fade); pair_s1, pair_s2 (steps: the two substances); pair_genes 0..1 the threads grow out to the genes
// (each after its own delay); pair_share 0..1 the shared genes glow, the rest step back; pair_tie 0..1 the shared ones
// draw in and their threads fold into one, the rest fade, the one thread between the two brightens.
// Anchors: left, right (the two), tie (above the middle), shared (the shared genes' disc). One draw each: points, threads,
// the tie (a thin glowing tube).
// the pair (also the two lit at the end of chapter reach, sets/cell.js: both touch CASP3 in the data) and their tags
const PAIR_NAMES = ['Diethylstilbestrol', 'Zearalenone'];
const PAIR_NOTE = { Diethylstilbestrol: 'a synthetic hormone, once a medicine', Zearalenone: 'a toxin from mould on grain' };
SETS.pair = function (K) {
  const { THREE, clamp, smooth } = K;
  const set = K.newSet('pair');
  const X = XDATA, G = X.meta.nGenes;
  const byName = nm => X.label.indexOf(nm);
  const S1 = Math.max(0, byName(PAIR_NAMES[0])), S2 = Math.max(0, byName(PAIR_NAMES[1]));
  const PA = [-0.85, 0, 0], PB = [0.85, 0, 0];
  const CA = K.rgb(LOOK.substance), CB = K.rgb('#ffb43b'), CS = K.rgb(LOOK.thread);
  const CAP = 1400;   // (genes drawn at most; any pair of the network's middle sizes fits: the two here have 439)
  const hash = i => { const s = Math.sin(i * 91.345 + 17.2) * 43758.5453; return s - Math.floor(s); };

  // ---------------------------------------------------------------- geometry (filled for a pair: build)
  const pg = K.pointsGeo(CAP + 2), PP = pg.attributes.position.array, PC = pg.attributes.aCol.array, PS = pg.attributes.aSize.array, PAl = pg.attributes.aA.array;
  const pts = new THREE.Points(pg, K.points(set));
  pts.renderOrder = 4; set.group.add(pts);
  const lg = K.linesGeo(2 * CAP), LP = lg.attributes.position.array, LC = lg.attributes.aCol.array, LA = lg.attributes.aA.array;
  const lines = new THREE.LineSegments(lg, K.lines(set));
  lines.renderOrder = 3; set.group.add(lines);
  // the tie: a thin tube from A to B, glowing (additive), brightening with pair_tie
  const tieMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...CS), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  K.fade(set, tieMat, 1);
  const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 1.7, 10, 1, true).rotateZ(Math.PI / 2), tieMat);
  tie.renderOrder = 5; set.group.add(tie);

  let cur = { s1: -1, s2: -1, n: 0, nA: 0, nB: 0, shared: 0 };
  // each gene: its home (where it stands), its side (0 A only, 1 B only, 2 both), its delay
  const HOME = new Float32Array(3 * CAP), SIDE = new Uint8Array(CAP), DEL = new Float32Array(CAP);
  function build(s1, s2) {
    cur = { s1, s2, n: 0, nA: 0, nB: 0, shared: 0 };
    const ta = X.targets(s1), tb = X.targets(s2);
    if (!ta || !tb) return;
    const A = new Set(ta), B = new Set(tb), all = [...new Set([...ta, ...tb])].slice(0, CAP);
    const ga = Math.PI * (3 - Math.sqrt(5));
    let ka = 0, kb = 0, ks = 0;
    const nS = all.filter(x => A.has(x) && B.has(x)).length, nA = all.filter(x => A.has(x) && !B.has(x)).length, nB = all.length - nS - nA;
    all.forEach((gn, j) => {
      const side = A.has(gn) && B.has(gn) ? 2 : A.has(gn) ? 0 : 1, k = side === 2 ? ks++ : side ? kb++ : ka++, m = side === 2 ? nS : side ? nB : nA;
      // a disc facing along the line between the two (golden angle), the shared ones in the middle, each side's own
      // a little towards its substance and wider
      const rad = (side === 2 ? 0.42 : 0.55) * Math.sqrt((k + 0.5) / Math.max(1, m)), a = k * ga;
      const x = side === 2 ? (hash(gn) - 0.5) * 0.05 : (side ? 1 : -1) * (0.36 + 0.12 * hash(gn));
      HOME[3 * j] = x; HOME[3 * j + 1] = rad * Math.cos(a) * 0.9; HOME[3 * j + 2] = rad * Math.sin(a);
      SIDE[j] = side; DEL[j] = hash(gn + 3);
    });
    Object.assign(cur, { n: all.length, nA: ta.length, nB: tb.length, shared: nS });
  }
  const _g = [0, 0, 0];
  // where gene j stands now: at home, drawn in to the line between the two as the tie closes
  function geneAt(j, tieE, out) {
    const k = SIDE[j] === 2 ? tieE : 0;
    out[0] = HOME[3 * j] * (1 - k); out[1] = HOME[3 * j + 1] * (1 - 0.94 * k); out[2] = HOME[3 * j + 2] * (1 - 0.94 * k);
    return out;
  }
  let S = { pair_s1: S1, pair_s2: S2 };

  return Object.assign(set, {
    params: { pair_a: 1, pair_s1: S1, pair_s2: S2, pair_genes: 1, pair_share: 1, pair_tie: 1 },
    update(s, t) {
      S = s;
      const s1 = Math.round(s.pair_s1), s2 = Math.round(s.pair_s2);
      if ((s1 !== cur.s1 || s2 !== cur.s2 || (!cur.n && X.ready('targets'))) && s1 >= 0 && s2 >= 0 && s1 < X.N && s2 < X.N) build(s1, s2);
      const gr = clamp(s.pair_genes, 0, 1), sh = clamp(s.pair_share, 0, 1), te = smooth(clamp(s.pair_tie, 0, 1));
      // the two substances (with a slow breath)
      const pulse = 1 + 0.06 * Math.sin(t * 2.2);
      PP.set(PA, 0); PP.set(PB, 3); PC.set(CA, 0); PC.set(CB, 3); PS[0] = PS[1] = 0.09 * pulse; PAl[0] = PAl[1] = 1;
      for (let j = 0; j < cur.n; j++) {
        // grow: the thread runs out from its substance, then the bead appears
        const e = smooth(clamp((gr - 0.5 * DEL[j]) / 0.5, 0, 1)), side = SIDE[j], both = side === 2;
        geneAt(j, te, _g);
        const lit = both ? sh : 0, away = both ? 1 : 1 - 0.75 * sh - 0.25 * te;
        PP.set(_g, 3 * (j + 2));
        const c = both ? [0.75 + 0.25 * CS[0] * lit, 0.75 + 0.25 * CS[1] * lit, 0.8 * (1 - lit) + CS[2] * lit] : side ? CB : CA;
        PC.set(c, 3 * (j + 2));
        PS[j + 2] = (0.018 + 0.016 * lit) * (both ? 1 - 0.55 * te : 1);
        PAl[j + 2] = e * away * (0.75 + 0.5 * lit) * (both ? 1 - 0.6 * te : 1);
        // its thread (or two, for a shared gene: one from each side); the gene end grows out
        for (let q = 0; q < 2; q++) {
          const L = 2 * j + q;
          const from = q === 0 ? (side === 1 ? PB : PA) : PB, on = q === 0 || both;
          for (let m = 0; m < 3; m++) { LP[6 * L + m] = from[m]; LP[6 * L + 3 + m] = from[m] + (_g[m] - from[m]) * e; }
          const lc = both ? [CS[0] * (0.5 + 0.5 * lit), CS[1] * (0.5 + 0.5 * lit), CS[2] * (0.5 + 0.5 * lit) + 0.3 * (1 - lit)] : side ? CB : CA;
          LC.set(lc, 6 * L); LC.set(lc, 6 * L + 3);
          const la = on ? (both ? 0.22 + 0.5 * lit : 0.2 * away) : 0;
          LA[2 * L] = la; LA[2 * L + 1] = la * 0.6;
        }
      }
      for (let j = cur.n; j < CAP; j++) { PAl[j + 2] = 0; LA[4 * j] = LA[4 * j + 1] = LA[4 * j + 2] = LA[4 * j + 3] = 0; }
      pg.setDrawRange(0, cur.n + 2); lg.setDrawRange(0, 4 * Math.max(cur.n, 1));
      for (const a of ['position', 'aCol', 'aSize', 'aA']) pg.attributes[a].needsUpdate = true;
      for (const a of ['position', 'aCol', 'aA']) lg.attributes[a].needsUpdate = true;
      // the one thread: it brightens as the shared ones close in (a slow shimmer while it is there)
      tieMat.opacity = set.uA.value * te * (0.55 + 0.15 * Math.sin(t * 3));
      tie.visible = te > 0.01;
      tie.scale.set(1, 0.6 + 0.8 * te, 0.6 + 0.8 * te);
    },
    anchors: { left: [-0.85, -0.13, 0], right: [0.85, -0.13, 0], leftNote: [-0.85, -0.27, 0], rightNote: [0.85, -0.27, 0], tie: [0, 0.5, 0], shared: [0, 0.47, 0], centre: [0, 0, 0] },
    labels: [
      { at: 'left', text: () => [X.label[cur.s1] || '', cur.nA ? ` · ${fmt(cur.nA)} genes` : ''], alpha: s => clamp(s.pair_genes * 3, 0, 1) },
      { at: 'right', text: () => [X.label[cur.s2] || '', cur.nB ? ` · ${fmt(cur.nB)} genes` : ''], alpha: s => clamp(s.pair_genes * 3, 0, 1) },
      // what the two are, in a few plain words (documented facts; only for the story's own pair)
      { at: 'leftNote', text: () => ['', PAIR_NOTE[X.label[cur.s1]] || ''], alpha: s => clamp(s.pair_genes * 3, 0, 1) * (1 - clamp(s.pair_tie * 3 - 1.5, 0, 1)) },
      { at: 'rightNote', text: () => ['', PAIR_NOTE[X.label[cur.s2]] || ''], alpha: s => clamp(s.pair_genes * 3, 0, 1) * (1 - clamp(s.pair_tie * 3 - 1.5, 0, 1)) },
      // the shared genes against chance: the two lists' sizes, drawn at random from every gene with a known substance
      { at: 'shared', text: () => (cur.n ? [`${fmt(cur.shared)} shared`, ` · by chance you would expect about ${Math.max(1, Math.round(cur.nA * cur.nB / G))}`] : ['', '']),
        alpha: s => clamp(s.pair_share * 3 - 1, 0, 1) * (1 - clamp(s.pair_tie * 3 - 1.5, 0, 1)) },
      { at: 'tie', text: () => ['One thread', cur.n ? ` · ${fmt(cur.shared)} genes in common` : ''], alpha: s => clamp(s.pair_tie * 3 - 1.5, 0, 1) },
    ],
    cam: { default: [-10, 9, 3.3, 0, 0.02, 0] },
  });
};
SETS.pair.prep = () => XDATA.need(['targets'], pkgUrl);
