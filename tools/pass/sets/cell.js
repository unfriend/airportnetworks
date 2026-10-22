// The cell map story's cell (stories/spatial.js: its compartments, 249 proteins in their places, their links, the
// dotted links between copies of one protein, its moves and signals and the wrong-place cases, cut out of that story at
// build time as PASS_SPATIAL and built by its own buildScene, unchanged) behind the set contract. What the cell map's
// story and explore mode drive (applyUniforms, exploreStep's travelling proteins, updateLight) is redone here from
// params, in that story's own words where it can be. Radius 1 (a cell about 20 micrometres across), centred on the
// origin, as in the cell map story.
SETS.cell = function (K) {
  const { THREE, clamp, smooth } = K;
  const set = K.newSet('cell');
  let LANG = 'en';
  const T = (en, de) => (LANG === 'de' ? de : en);

  // ---------------------------------------------------------------- the original, built as in its own story
  const O = PASS_SPATIAL({ makeRenderer: () => ({ xr: {}, setPixelRatio() {} }) });
  O.buildScene(null);
  const G = O.GL, NET = O.NET, MOVES = O.MOVES, POS = O.POS, CP = O.CP, A = O.A;
  set.group.add(G.world);
  // every shader of the original fades with the set (its alpha times the set's fade, appended to its fragment shader
  // before it is first compiled); the cytoskeleton's lines fade by their opacity
  const faded = new WeakSet();
  function fadeMat(m) {
    if (!m || !m.isShaderMaterial || faded.has(m)) return;
    faded.add(m);
    m.uniforms.uSetA = set.uA;
    m.fragmentShader = 'uniform float uSetA;\n' + m.fragmentShader.replace(/\}\s*$/, '  gl_FragColor.a *= uSetA;\n}\n');
  }
  G.world.traverse(o => fadeMat(o.material));
  const highlight = (key, pairs, color, opts) => { const m = O.setHighlight(key, pairs, color, opts); if (m) fadeMat(m.material); return m; };
  const pairsOf = list => list.slice(0, -1).map((c, k) => [c, list[k + 1]]), hopsOf = list => list.slice(0, -1).map((_, k) => k + 1);

  // the story's highlights, as the cell map story makes them: two proteins meeting (EGF, its receptor and GRB2), the
  // growth signal from EGF outside the cell to SRF in the nucleus, and the relay TNF starts towards NF-kB
  const MV = Object.fromEntries(MOVES.map((m, k) => [m.key, k]));
  const PATH = ['EGF', 'EGFR@pm', 'GRB2', 'SOS1', 'KRAS', 'RAF1', 'MAP2K1', 'MAPK1@cyto', 'MAPK1@nuc', 'ELK1', 'SRF'].map(CP);
  const CUE = MOVES[MV.nfkb].cueCopies;
  highlight('ex', [[CP('EGF'), CP('EGFR@pm')], [CP('EGFR@pm'), CP('GRB2')]], O.SIG, { radius: 0.0045, fade: O.SIG_A });
  highlight('cue', pairsOf(CUE), O.SIG, { radius: 0.004, fade: O.SIG_A, hops: hopsOf(CUE) });
  highlight('path', pairsOf(PATH), O.SIG, { radius: 0.0055, fade: O.SIG_A, hops: hopsOf(PATH) });

  // the original's updateLight, for this set: the organelles lit from over the viewer's left shoulder (turning with
  // the camera on a screen, fixed in the room in a headset), and the proteins' size (on a screen it follows the
  // camera's distance; in a headset they keep their size in the cell). Run just before the set is drawn.
  const LV = new THREE.Vector3(), _q = new THREE.Quaternion(), _c = new THREE.Vector3(), _m = new THREE.Matrix4();
  function look(renderer, cam) {
    const xr = !!(renderer.xr && renderer.xr.isPresenting), rig = set.group.parent && set.group.parent.parent;
    if (xr && rig) rig.getWorldQuaternion(_q); else cam.getWorldQuaternion(_q);
    LV.set(-0.55, 0.42, 1.0).normalize().applyQuaternion(_q);
    for (const mats of G.orgMats) for (const m of mats) if (m.uniforms) m.uniforms.uL.value.copy(LV);
    const U = G.U, AU = G.actorMat.uniforms;
    if (xr) { U.uScale.value = AU.uScale.value = 1; U.uPx.value = AU.uPx.value = 0.0028 * K.U.uPx.value * set.group.scale.x; return; }
    U.uPx.value = AU.uPx.value = 0;
    _c.setFromMatrixPosition(cam.matrixWorld).applyMatrix4(_m.copy(G.world.matrixWorld).invert());
    U.uScale.value = AU.uScale.value = renderer.getPixelRatio() * clamp(3.6 / Math.max(_c.length(), 1e-3), 0.75, 2.4);
  }
  const probe = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  probe.frustumCulled = false; probe.renderOrder = -100;
  probe.onBeforeRender = (renderer, scene, cam) => look(renderer, cam);
  set.group.add(probe);

  // ---------------------------------------------------------------- German (the original's names are English)
  const PLACE_DE = { ext: ['Außerhalb der Zelle', 'außerhalb der Zelle'], pm: ['Zellmembran', 'Membran'], cyto: ['Zellplasma', 'Zellplasma'],
    cytosk: ['Zellskelett', 'Zellskelett'], nuc: ['Zellkern', 'Zellkern'], nucl: ['Kernkörperchen', 'Kernkörperchen'], ne: ['Kernhülle', 'Kernhülle'],
    er: ['Endoplasmatisches Retikulum', 'ER'], golgi: ['Golgi-Apparat', 'Golgi-Apparat'], mito: ['Mitochondrien', 'Mitochondrien'],
    lyso: ['Lysosomen', 'Lysosom'], endo: ['Endosomen und Bläschen', 'Bläschen'], perox: ['Peroxisomen', 'Peroxisom'] };
  const ORGS_DE = ['Zellmembran', 'Zellkern', 'Kernkörperchen', 'Endoplasmatisches Retikulum', 'Golgi-Apparat', 'Mitochondrien', 'Lysosomen',
    'Endosomen und Bläschen', 'Peroxisomen', 'Zellskelett'];
  const MOVES_DE = {
    nfkb: ['Entzündung', 'TNF schickt NF-κB in den Zellkern', 'TNF draußen vor der Zelle startet eine Staffel bis zu den IKK-Kinasen. Sie markieren IκBα, und IκBα wird abgebaut. Befreit wandert NF-κB in den Zellkern und schaltet Gene für eine Entzündung an.'],
    apop: ['Zelltod', 'Mitochondrien lassen Todessignale frei', 'BAX wandert auf die Mitochondrien und macht mit BAK Löcher in ihre äußere Hülle. Cytochrom c und SMAC entkommen: Cytochrom c baut mit APAF1 das Apoptosom, SMAC schaltet XIAP aus, und Caspasen bauen die Zelle ab.'],
    tfeb: ['Hunger', 'TFEB verlässt das Lysosom', 'Solange es Nährstoffe gibt, sitzt mTORC1 auf den Lysosomen und hält TFEB aus dem Zellkern fern. Geht das Futter aus, lässt mTORC1 los: TFEB wandert in den Zellkern und schaltet Gene für neue Lysosomen und fürs Recycling an.'],
    glut4: ['Insulin', 'GLUT4 geht an die Oberfläche', 'Insulin schaltet AKT2 an, und AKT2 löst die Bremse AS160. Bläschen mit dem Zuckerkanal GLUT4 verschmelzen mit der Membran, und Muskel- und Fettzellen holen sich Zucker aus dem Blut.'],
    nrf2: ['Oxidativer Stress', 'NRF2 entkommt KEAP1', 'Normalerweise gibt KEAP1 NRF2 zum Abbau weiter. Oxidantien schalten KEAP1 aus: NRF2 sammelt sich an, wandert in den Zellkern und schaltet mit MafG Gene an, die die Zelle vor Oxidantien schützen.'],
    als: ['ALS', 'TDP-43 verlässt den Zellkern', 'Bei fast allen Menschen mit ALS verschwindet TDP-43 aus dem Zellkern der Nervenzellen, die Muskeln steuern, und verklumpt im Zellplasma. Seine Partner beim Spleißen verlieren es; dafür binden p62, Ubiquilin und Proteine aus Stressgranula daran.'],
    cf: ['Mukoviszidose', 'CFTR bleibt im ER hängen', 'Die häufigste Mutation bei Mukoviszidose, F508del, lässt CFTR falsch falten. Die Qualitätskontrolle im ER (Calnexin, HSC70, CHIP, RNF5) fängt es ab und schickt es zum Abbau: An der Membran kommt es nie an.'],
  };
  const placeName = k => (LANG === 'de' ? PLACE_DE[NET.PK[k]][0] : O.placeName(k));
  const placeShort = k => (LANG === 'de' ? PLACE_DE[NET.PK[k]][1] : O.placeShort(k));
  const orgName = k => (LANG === 'de' ? ORGS_DE[k] : O.ORGS[k]);
  const moveText = m => { const d = MOVES_DE[m.key]; return LANG === 'de' && d ? { name: d[0], title: d[1], text: d[2] } : { name: m.name, title: m.title, text: m.text }; };

  // ---------------------------------------------------------------- params, update
  // cell_<move>: how far each of the cell map's moves has gone (its s0 ... s6), keyed by the move's key
  const MKEYS = MOVES.map(m => 'cell_' + m.key);
  const params = { cell_a: 1, cell_org: O.ORGS.length, cell_shell: 1, cell_reveal: 1, cell_links: 1, cell_ids: 1, cell_multi: 0, cell_focus: 0,
    cell_ex: 0, cell_cue: 0, cell_cue_a: 1, cell_path: 0, cell_path_a: 1, cell_names: 0 };
  for (const k of MKEYS) params[k] = 0;
  let SEL = -1, selProg = 0, ISO = -1, FOCUS = null, MOVED = new Array(8).fill(0);
  const setFocus = (list, stepped) => { FOCUS = list; O.setFocus(list, stepped); };
  setFocus(PATH, true);
  function update(S, t, dt) {
    const U = G.U, RU = G.RU, IU = G.IU, multi = clamp(S.cell_multi, 0, 1);
    // (the cell map's applyUniforms, from this set's params)
    U.uReveal.value = S.cell_reveal; U.uWPlace.value = 1 - multi; U.uWMulti.value = multi; U.uWDeg.value = 0;
    U.uFocus.value = S.cell_focus; U.uPathProg.value = S.cell_path;
    MOVES.forEach((m, k) => { const s = clamp(S[MKEYS[k]], 0, 1); U.uScen.value[k] = s; MOVED[k] = s; O.SCEN[k] = s; });
    U.uIso.value = ISO; U.uSel.value = SEL; U.uProxOn.value = 0;
    RU.uReveal.value = S.cell_reveal; RU.uAlpha.value = 0.55 * S.cell_links; RU.uWPlace.value = 1 - multi;
    RU.uIso.value = ISO; RU.uFocus.value = S.cell_focus; RU.uProxOn.value = 0;
    IU.uReveal.value = S.cell_ids; IU.uAlpha.value = 0.75 * clamp(S.cell_ids, 0, 1); IU.uIso.value = ISO; IU.uSel.value = SEL; IU.uFocus.value = S.cell_focus * 0.6;
    const isoOrg = ISO >= 0 ? O.ORG_OF_PLACE[NET.PK[ISO]] : -2;
    G.orgMats.forEach((mats, k) => {
      let a = clamp(S.cell_org - k, 0, 1) * clamp(S.cell_shell, 0, 1);
      if (isoOrg > -2) a *= k === isoOrg || k === 0 ? 1 : 0.25;
      for (const m of mats) {
        if (m.uniforms) m.uniforms.uA.value = a;
        else { m.opacity = m.userData.base * a * set.uA.value; m.visible = a * set.uA.value > 0.01; }
      }
    });
    G.bubble.visible = false;
    const H = G.highlights;
    const hl = (k, p, a) => { const m = H[k]; if (!m) return; m.material.uniforms.uProg.value = p; m.material.uniforms.uAlpha.value = a; m.visible = a > 0.003 && p > 0.001; };
    hl('ex', S.cell_ex, 1);
    hl('cue', S.cell_cue * (CUE.length - 1), S.cell_cue_a);
    hl('path', S.cell_path, S.cell_path_a);
    if (SEL >= 0) selProg = Math.min(1, selProg + (dt || 0) * 0.7);
    hl('sel', selProg, SEL >= 0 ? 0.9 : 0);
    // travelling proteins (the cell map's exploreStep): while a move is under way its proteins travel, and one that
    // fails (CFTR) turns red and stops; and ERK on the growth signal's way into the nucleus
    const list = [];
    MOVES.forEach((m, j) => {
      const s = MOVED[j];
      if (s <= 0.002 || s >= 0.998) return;
      const a = Math.min(smooth(s / 0.08), smooth((1 - s) / 0.08));
      m.travelers.forEach(([f, to]) => list.push({ from: f, to, x: s, a, col: [1.0, 0.82, 0.3] }));
      m.fails.forEach(([f, to]) => list.push({ from: f, to, x: s, a: 1, col: [1.0, 0.82, 0.3], fail: true }));
    });
    for (let k = 0; k < PATH.length - 1; k++) {
      if (NET.cProt[PATH[k]] !== NET.cProt[PATH[k + 1]]) continue;
      const x = clamp(S.cell_path - k, 0, 1);
      if (x > 0.001 && x < 0.999 && S.cell_path_a > 0.01) list.push({ from: PATH[k], to: PATH[k + 1], x, a: S.cell_path_a, col: O.SIG_DOT });
    }
    O.setActors(list);
  }

  // ---------------------------------------------------------------- anchors, labels, views
  const cpos = c => [POS[3 * c], POS[3 * c + 1], POS[3 * c + 2]];
  const anchors = {};
  const ORG_KEYS = ['pm', 'nuc', 'nucl', 'er', 'golgi', 'mito', 'lyso', 'endo', 'perox', 'cytosk'];
  ORG_KEYS.forEach((k, i) => { anchors['org_' + k] = G.orgAnchor[i]; });
  // every protein's copies by 'SYMBOL@place', and 'SYMBOL' for its usual place
  for (let c = 0; c < NET.NC; c++) { const s = NET.sym[NET.cProt[c]]; anchors[s + '@' + NET.PK[NET.cPlace[c]]] = cpos(c); if (!anchors[s]) anchors[s] = cpos(c); }
  // the travelling protein of a move, where it is now (for a label that rides along)
  const lab = (at, cls, en, de, alpha, bold) => ({ text: () => [bold || at.split('@')[0], T(en, de)], at, cls, alpha });
  const mv = (S, k) => S['cell_' + k];
  const labels = [
    // the organelles, as they appear
    ...ORG_KEYS.map((k, i) => ({ text: () => [orgName(i), ''], at: 'org_' + k, cls: '', alpha: S => K.prog(S.cell_org - i, 0.4, 1) * K.prog(S.cell_names, 0.5, 1) })),
    // two proteins meet, and the growth signal passes from hand to hand into the nucleus
    lab('EGF', 'tl', 'growth signal', 'Wachstumssignal', S => Math.max(K.prog(S.cell_ex, 0.2, 0.6), K.prog(S.cell_path, 0.05, 0.4) * S.cell_path_a)),
    lab('EGFR@pm', 'tl', 'receptor', 'Rezeptor', S => Math.max(K.prog(S.cell_ex, 0.5, 0.9), K.prog(S.cell_path, 0.8, 1) * S.cell_path_a), 'EGFR'),
    lab('MAPK1@nuc', 'tl', 'in the nucleus', 'im Zellkern', S => K.prog(S.cell_path, 7.8, 8) * S.cell_path_a, 'ERK'),
    lab('SRF', 'tl', 'gene switch', 'Genschalter', S => K.prog(S.cell_path, 9.8, 10) * S.cell_path_a),
    // NF-kB: the signal from outside, the protein waiting, its brake, and where it goes
    lab('TNF', 'tl', 'inflammation signal', 'Entzündungssignal', S => K.prog(S.cell_cue, 0.02, 0.15) * S.cell_cue_a),
    lab('RELA@cyto', 'amb', 'NF-κB, waiting', 'NF-κB wartet', S => K.prog(S.cell_cue, 0.02, 0.2) * S.cell_cue_a * (1 - K.prog(mv(S, 'nfkb'), 0.05, 0.3)), 'RELA'),
    lab('NFKBIA', 'amb', 'its brake', 'seine Bremse', S => K.prog(S.cell_cue, 0.6, 0.9) * S.cell_cue_a * (1 - K.prog(mv(S, 'nfkb'), 0.3, 0.6)), 'IκBα'),
    lab('RELA@nuc', 'amb', 'in the nucleus', 'im Zellkern', S => K.prog(mv(S, 'nfkb'), 0.85, 1), 'RELA'),
    // the wrong places: CFTR never reaches the membrane; TDP-43 leaves the nucleus
    lab('CFTR@er', 'red', 'caught in the ER', 'im ER hängen geblieben', S => K.prog(mv(S, 'cf'), 0.25, 0.5), 'CFTR'),
    lab('CFTR@pm', 'red', 'never arrives', 'kommt nie an', S => K.prog(mv(S, 'cf'), 0.5, 0.8), 'CFTR'),
    lab('TARDBP@nuc', 'red', 'leaves the nucleus', 'verlässt den Zellkern', S => K.prog(mv(S, 'als'), 0.05, 0.25) * (1 - K.prog(mv(S, 'als'), 0.85, 1)), 'TDP-43'),
    lab('TARDBP@cyto', 'red', 'clumps in the cytoplasm', 'verklumpt im Zellplasma', S => K.prog(mv(S, 'als'), 0.85, 1), 'TDP-43'),
    // a protein picked in explore mode
    { text: () => (SEL >= 0 ? [NET.sym[SEL], NET.name[SEL] !== NET.sym[SEL] ? NET.name[SEL] : ''] : ['', '']), at: () => (SEL >= 0 ? cpos(SELC) : [0, 0, 0]), cls: 'cyn', alpha: () => (SEL >= 0 ? 1 : 0) },
  ];
  let SELC = -1;
  // views [az, el, dist, tx, ty, tz]: the whole cell, the nucleus, and each signal or move seen from the side, so its
  // way across the cell runs across the picture (from the side of the cell it is nearer to, a little from above)
  const v3 = O.v3, mean = cs => cs.reduce((s, c) => v3.add(s, cpos(c)), [0, 0, 0]).map(x => x / cs.length);
  function sideView(cs, dist) {
    const p = mean(cs), ax = v3.sub(cpos(cs[cs.length - 1]), cpos(cs[0]));
    let d = v3.norm(v3.cross(ax, [0, 1, 0]));
    if (v3.dot(d, p) < 0) d = v3.mul(d, -1);
    d = v3.norm(v3.add(d, [0, 0.3, 0]));
    return [Math.atan2(d[0], d[2]) / Math.PI * 180, Math.asin(d[1]) / Math.PI * 180, dist, p[0], p[1], p[2]];
  }
  const cam = {
    default: [108, 18, 3.9, 0, 0, 0],                                    // the cell map's explore view, a little closer
    nucleus: [70, 20, 1.9, ...O.CELL.nuc.c],
    signal: sideView(PATH, 2.7),                                         // the growth signal, from the surface in
    nfkb: sideView(CUE.concat([CP('RELA@nuc')]), 2.6),
    cf: sideView([CP('CFTR@er'), CP('CFTR@pm')], 2.2),
    als: sideView([CP('TARDBP@nuc'), CP('TARDBP@cyto')], 2.0),
  };
  const CTL = {
    en: [
      { key: 'view', label: 'View', options: [['default', 'Whole cell'], ['nucleus', 'Nucleus'], ['signal', 'From the surface']] },
      { key: 'shell', label: 'Organelles', options: [['on', 'On'], ['faint', 'Faint'], ['off', 'Off']] },
      { key: 'color', label: 'Colour', options: [['place', 'By place'], ['multi', 'Number of places']] },
      { key: 'move', label: 'Move', options: [['none', 'None'], ['nfkb', 'Inflammation'], ['cf', 'Cystic fibrosis'], ['als', 'ALS']] },
    ],
    de: [
      { key: 'view', label: 'Ansicht', options: [['default', 'Ganze Zelle'], ['nucleus', 'Zellkern'], ['signal', 'Von der Oberfläche']] },
      { key: 'shell', label: 'Organellen', options: [['on', 'An'], ['faint', 'Schwach'], ['off', 'Aus']] },
      { key: 'color', label: 'Farbe', options: [['place', 'Nach Ort'], ['multi', 'Zahl der Orte']] },
      { key: 'move', label: 'Bewegung', options: [['none', 'Keine'], ['nfkb', 'Entzündung'], ['cf', 'Mukoviszidose'], ['als', 'ALS']] },
    ],
  };
  // (a move plays out over three seconds from the moment it is picked: c.t counts from when the scene was opened)
  function explore(c) {
    const tg = { cell_shell: c.shell === 'off' ? 0 : c.shell === 'faint' ? 0.35 : 1, cell_multi: c.color === 'multi' ? 1 : 0 };
    for (const m of MOVES) tg['cell_' + m.key] = c.move === m.key ? 1 : 0;
    if (c.move === 'nfkb') tg.cell_cue = 1;
    return tg;
  }

  // ---------------------------------------------------------------- explore: picking, a protein, moves
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _inv = new THREE.Matrix4();
  // the protein copy nearest a ray (a THREE.Raycaster, world coordinates): the cell map's pickCopyRay, in this frame
  function pick(ray) {
    set.group.updateWorldMatrix(true, true);
    _inv.copy(G.world.matrixWorld).invert();
    const o = _o.copy(ray.ray.origin).applyMatrix4(_inv), d = _d.copy(ray.ray.direction).transformDirection(_inv);
    const { NC, cDeg, maxCDeg } = NET;
    let best = -1, bs = Infinity;
    for (let c = 0; c < NC; c++) {
      if (!O.isThere(c) || (ISO >= 0 && NET.cPlace[c] !== ISO)) continue;
      const vx = POS[3 * c] - o.x, vy = POS[3 * c + 1] - o.y, vz = POS[3 * c + 2] - o.z, t = vx * d.x + vy * d.y + vz * d.z;
      if (t <= 0) continue;
      const ang = Math.sqrt(Math.max(0, vx * vx + vy * vy + vz * vz - t * t)) / t;
      if (ang > 0.026) continue;
      const sc = ang - 0.008 * Math.sqrt(cDeg[c] / maxCDeg) + t * 0.004;
      if (sc < bs) { bs = sc; best = c; }
    }
    return best;
  }
  // a protein's partners before and after a move (the cell map's delta), by protein index
  function partnersOf(p, scen) {
    const out = new Set();
    for (const c of NET.pCopies[p]) {
      if (!O.present(c, scen)) continue;
      for (let k = NET.adjS[c]; k < NET.adjS[c + 1]; k++) if (NET.adjT[k] === 0 && O.present(NET.adj[k], scen)) out.add(NET.cProt[NET.adj[k]]);
    }
    return out;
  }
  function moveDelta(key) {
    const k = MV[key], m = MOVES[k], rest = new Array(8).fill(0), on = rest.slice(); on[k] = 1;
    const prots = [...new Set([...m.travelers, ...m.fails].map(([f]) => NET.cProt[f]))];
    return prots.map(p => { const a = partnersOf(p, rest), b = partnersOf(p, on); return { p, sym: NET.sym[p], lost: [...a].filter(x => !b.has(x)), gained: [...b].filter(x => !a.has(x)) }; });
  }
  function info(p) {
    if (p < 0) return null;
    const by = O.partnersByPlace(p), partners = [];
    by.forEach((list, k) => partners.push({ place: k, name: placeName(k), list: list.map(x => ({ p: x.p, sym: NET.sym[x.p], here: x.here, across: x.across >= 0 ? placeName(x.across) : null })) }));
    return { p, sym: NET.sym[p], name: NET.name[p], role: NET.role[p], places: NET.pPlaces[p].map(k => ({ k, name: placeName(k) })), partners, degree: NET.pDeg[p],
      moves: MOVES.filter(m => [...m.travelers.flat(), ...m.fails.flat()].some(c => NET.cProt[c] === p)).map(m => m.key) };
  }
  function select(p, copy) {
    SEL = p >= 0 ? p : -1; selProg = 0;
    if (SEL < 0) { SELC = -1; highlight('sel', null); return; }
    const cs = NET.pCopies[SEL];
    SELC = copy !== undefined && copy >= 0 ? copy : (cs.find(O.isThere) ?? cs[0]);
    const pairs = [];
    for (const c of cs) for (let k = NET.adjS[c]; k < NET.adjS[c + 1]; k++) if (NET.adjT[k] === 0) pairs.push([c, NET.adj[k]]);
    highlight('sel', pairs, [0.30, 0.88, 1.0], { radius: 0.0016, spread: 0.5, seed: SEL + 1 });
  }
  const api = {
    pick, info, select, selected: () => SEL, moveDelta,
    protein: s => (typeof s === 'number' ? s : (A(String(s).toUpperCase()) ?? O.findProtein(String(s)))),
    copyOf: s => CP(s), proteinOf: c => NET.cProt[c], pos: c => cpos(c),
    search: (q, n) => O.matches(q, n || 8),
    moves: () => MOVES.map(m => Object.assign({ key: m.key, disease: !!m.disease }, moveText(m))),
    move: key => { const m = MOVES[MV[key]]; return m ? Object.assign({ key: m.key, disease: !!m.disease }, moveText(m)) : null; },
    path: (a, b) => O.bestPath(a, b),          // (over the copies there now: the moves as far as they have gone)
    highlight, setFocus,
    isolate: k => { ISO = k === undefined || k === null ? -1 : k; },
    placeName, placeShort, orgName, places: () => NET.PK.map((k, i) => ({ k, i, name: placeName(i) })),
    growthPath: () => PATH.slice(), relay: () => CUE.slice(),
    counts: () => ({ proteins: NET.P, copies: NET.NC, links: NET.E, places: NET.PK.length, organelles: O.ORGS.length }),
    original: O,   // (the cut-out cell map story itself: NET, CELL, MOVES, bestPath, reachInfo, placeStats ...)
  };
  const out = Object.assign(set, { params, update, anchors, labels, cam, explore, api, setLang: l => { LANG = l === 'de' ? 'de' : 'en'; } });
  Object.defineProperty(out, 'controls', { get: () => CTL[LANG], enumerable: true });
  return out;
};
