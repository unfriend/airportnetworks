// The atlas set of the microanatomy story (stories/micro.js): the GTEx slide library, the atlas of 40 sections and
// their domains, the tile cloud, ageing (the volcano and the examples' morph) and trajectories over age. Manifest:
// atlas.md. Slides, sections and tiles are drawn (procedural), never the GTEx images; shares, the volcano and the
// curves come from MICRO_DATA (the preprint's numbers and readings of the talk's figures), stand-ins where it has none.
// Everything is drawn as lit 3D objects: each slide a thin glass box with its tissue on it, each section a slab of tiles
// standing in relief (each domain its own height), the tiles flying into the cloud as small lit cubes, the volcano's
// bubbles as lit spheres over a glass floor with their shadows, the trajectories as lit ribbons over glass lanes.
SETS.atlas = function (K) {
  const { THREE, clamp, lerp, prog, rng, gauss } = K;
  const set = K.newSet('atlas');
  const MD = typeof MICRO_DATA !== 'undefined' ? MICRO_DATA : {};
  const F = MD.facts || {}, FIG = MD.figures || {}, EX = MD.examples || [], GR = MD.graph || { nodes: [], edges: [] };
  const PI = Math.PI, c01 = x => clamp(x, 0, 1), sm = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const fmt = n => Number(n).toLocaleString('en-GB'), cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const AGES = F.ages || [20, 70], f1 = x => String(+(+x).toFixed(1));
  const hex = c => '#' + c.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');

  // ---------------------------------------------------------------- the 40 GTEx tissues and their domains
  // [GTEx name, short name, organ, slide weight (GTEx sample counts, scaled to the preprint's total: illustrative),
  //  name in the talk's atlas figure, shape, domains [name, % (the figure's share replaces it), mode, options]]
  // modes: E rim, P patches, S specks, L layers by depth (from the surface or the lumen inwards, in the order given).
  // Domains of the 11 tissues the talk's figure does not show are illustrative.
  const TT = [
    ['Adipose - Subcutaneous', 'Adipose, under skin', 'Adipose', 663, '', { k: 'lobes', n: 9 }, [['tissue edge', 5, 'E'], ['blood vessels', 3, 'S', { n: 8 }], ['adipose tissue', 72, 'L'], ['connective tissue', 20, 'L']]],
    ['Adipose - Visceral (Omentum)', 'Adipose, omentum', 'Adipose', 541, 'adipose - visceral', { k: 'lobes', n: 13, lacy: 0.3 }, [['lymph node', 13, 'P', { n: 1, s: 0.3 }], ['blood vessels and hemorrhage', 1, 'S', { n: 6 }], ['connective tissue', 86, 'L']]],
    ['Adrenal Gland', 'Adrenal gland', 'Adrenal Gland', 258, 'adrenal gland', { k: 'round', sx: 0.66, sy: 0.95, w: 0.3 }, [['tissue edge', 14, 'E'], ['adrenal cortex', 33, 'L'], ['fibroadipose tissue', 53, 'L']]],
    ['Artery - Aorta', 'Aorta', 'Artery', 432, 'aorta', { k: 'strip', amp: 0.05, w: 0.17, rot: 0.12, fq: 0.8 }, [['tunica intima', 13, 'L'], ['tunica media', 75, 'L'], ['tunica adventitia', 12, 'L']]],
    ['Artery - Coronary', 'Coronary artery', 'Artery', 240, 'artery coronary', { k: 'ring', rin: 0.55, w: 0.1, ecc: 0.08 }, [['calcified plaques', 0.6, 'P', { n: 2, s: 0.25, d: [0, 0.3], keep: 1 }], ['tunica intima', 38, 'L'], ['tunica media', 38, 'L'], ['tunica adventitia', 24, 'L']]],
    ['Artery - Tibial', 'Tibial artery', 'Artery', 663, '', { k: 'ring', rin: 0.4, w: 0.1, ecc: 0.04 }, [['calcified plaques', 0.6, 'P', { n: 2, s: 0.22, d: [0, 0.3] }], ['tunica intima', 15, 'L'], ['tunica media', 50, 'L'], ['tunica adventitia', 34.4, 'L']]],
    ['Bladder', 'Bladder', 'Bladder', 21, 'bladder', { k: 'strip', amp: 0.1, w: 0.3, rot: 1.45, fq: 1 }, [['mucosa', 9, 'L'], ['muscularis', 63, 'L'], ['adventitia subserosa', 28, 'L']]],
    ['Brain - Cerebellum', 'Cerebellum', 'Brain', 241, 'cerebellum', { k: 'folia', n: 12, dp: 0.42 }, [['molecular layer', 51, 'L'], ['granular layer', 37, 'L'], ['cerebral medulla', 12, 'L']]],
    ['Brain - Cortex', 'Brain cortex', 'Brain', 255, 'brain cortex', { k: 'folia', n: 3, dp: 0.36 }, [['tissue edge', 10, 'E'], ['gray matter', 37, 'L'], ['white matter', 53, 'L']]],
    ['Breast - Mammary Tissue', 'Breast', 'Breast', 459, 'breast', { k: 'lobes', n: 9, lacy: 0.5, sy: 0.7 }, [['ductal tissue', 8, 'S', { n: 7 }], ['fibromuscular tissue', 26, 'P', { n: 3 }], ['connective tissue', 62, 'L'], ['adipose tissue', 4, 'L']]],
    ['Cervix - Ectocervix', 'Ectocervix', 'Cervix', 9, 'ectocervix', { k: 'round', sx: 0.62, sy: 0.95, w: 0.4 }, [['tissue edge', 11, 'E'], ['fibromuscular tissue', 1, 'P', { n: 2, s: 0.2, d: [0.5, 1] }], ['squamous epithelium', 9, 'L'], ['cervical stroma', 79, 'L']]],
    ['Cervix - Endocervix', 'Endocervix', 'Cervix', 10, '', { k: 'round', sx: 0.9, sy: 0.72, w: 0.35 }, [['endocervical epithelium', 15, 'E'], ['cervical stroma', 70, 'L'], ['fibromuscular tissue', 15, 'L']]],
    ['Colon - Sigmoid', 'Colon, sigmoid', 'Colon', 373, '', { k: 'strip', amp: 0.18, w: 0.34, rot: 0.3, fold: 0.07, fq: 1.3 }, [['mucosa', 15, 'L'], ['submucosa', 25, 'L'], ['muscularis', 60, 'L']]],
    ['Colon - Transverse', 'Colon, transverse', 'Colon', 406, 'colon', { k: 'strip', amp: 0.24, w: 0.27, rot: 1.25, fold: 0.11, fq: 1.7 }, [['mucosa', 41, 'L'], ['submucosa', 36, 'L'], ['muscularis', 22, 'L']]],
    ['Esophagus - Gastroesophageal Junction', 'Oesophagus, junction', 'Esophagus', 375, '', { k: 'strip', amp: 0.1, w: 0.4, rot: -0.2, fold: 0.05 }, [['mucosa', 12, 'L'], ['submucosa', 18, 'L'], ['muscularis', 70, 'L']]],
    ['Esophagus - Mucosa', 'Oesophagus, mucosa', 'Esophagus', 555, '', { k: 'strip', amp: 0.16, w: 0.26, rot: 0.1, fold: 0.04, fq: 1.8 }, [['squamous epithelium', 45, 'L'], ['mucosa lamina propria', 30, 'L'], ['submucosa', 25, 'L']]],
    ['Esophagus - Muscularis', 'Oesophagus, muscle', 'Esophagus', 515, '', { k: 'strip', amp: 0.06, w: 0.5, rot: 0.5 }, [['connective tissue', 10, 'E'], ['inner circular smooth muscle', 45, 'L'], ['outer longitudinal smooth muscle', 45, 'L']]],
    ['Fallopian Tube', 'Fallopian tube', 'Fallopian Tube', 9, 'fallopian tube', { k: 'ring', rin: 0.48, w: 0.12, fold: 0.42, nf: 7 }, [['mucosa', 32, 'L'], ['muscularis', 42, 'L'], ['fibromuscular tissue', 27, 'L']]],
    ['Heart - Atrial Appendage', 'Heart, atrium', 'Heart', 429, '', { k: 'lobes', n: 7, lacy: 0.35 }, [['fibroadipose tissue', 20, 'E'], ['cardiac muscle', 65, 'L'], ['connective tissue', 15, 'L']]],
    ['Heart - Left Ventricle', 'Heart, left ventricle', 'Heart', 432, 'heart', { k: 'ring', rin: 0.34, w: 0.3, ecc: 0.25, sq: 1 }, [['fibroadipose tissue', 1, 'S', { n: 3, d: [0.7, 1] }], ['cardiac muscle', 91, 'L'], ['connective tissue', 8, 'L']]],
    ['Kidney - Cortex', 'Kidney cortex', 'Kidney', 85, '', { k: 'block', sx: 0.85, sy: 0.8, w: 0.2 }, [['connective tissue', 10, 'E'], ['renal glomeruli', 12, 'S', { n: 22, s: 0.07 }], ['renal tubules', 78, 'L']]],
    ['Kidney - Medulla', 'Kidney medulla', 'Kidney', 4, 'kidney medulla', { k: 'block', sx: 0.86, sy: 0.86, w: 0.15 }, [['connective tissue', 12, 'E'], ['medulla', 5, 'S', { n: 5, s: 0.1 }], ['renal glomeruli', 24, 'L'], ['medulla kidney tubules', 59, 'L']]],
    ['Liver', 'Liver', 'Liver', 226, 'liver', { k: 'block', sx: 0.86, sy: 0.88, w: 0.2 }, [['connective tissue', 17, 'E'], ['portal vein', 9, 'S', { n: 12, s: 0.08 }], ['liver parenchyma', 74, 'L']]],
    ['Lung', 'Lung', 'Lung', 578, '', { k: 'lobes', n: 18 }, [['blood vessels', 6, 'S', { n: 6 }], ['fibroadipose tissue', 6, 'P', { n: 2 }], ['connective tissue', 8, 'P', { n: 3 }], ['alveolar space', 42, 'L'], ['lung parenchyma', 38, 'L']]],
    ['Minor Salivary Gland', 'Salivary gland', 'Minor Salivary Gland', 162, 'minor salivary gland', { k: 'lobes', n: 8, sx: 0.55 }, [['mucosa', 8, 'E'], ['muscularis', 9, 'P', { n: 1, at: [0, 0.75] }], ['glandular and ductal elements', 28, 'L'], ['submucosa', 23, 'L'], ['fibroadipose tissue', 32, 'L']]],
    ['Muscle - Skeletal', 'Skeletal muscle', 'Muscle', 803, 'skeletal muscle', { k: 'lobes', n: 6, lacy: 0.12 }, [['skeletal muscle', 69, 'L'], ['fibroadipose tissue', 31, 'L']]],
    ['Nerve - Tibial', 'Tibial nerve', 'Nerve', 619, 'tibial nerve', { k: 'fasc', n: 6 }, [['nerve fibers', 48, 'L'], ['epineurium', 52, 'L']]],
    ['Ovary', 'Ovary', 'Ovary', 180, 'ovary', { k: 'round', sx: 0.95, sy: 0.85, w: 0.2, flat: -0.45 }, [['tissue edge', 7, 'E'], ['corpus albicans', 44, 'P', { n: 4, s: 0.32, d: [0.4, 1] }], ['fibrovascular tissue', 3, 'S', { n: 5, s: 0.08 }], ['ovarian cortex', 27, 'L'], ['ovarian stroma', 20, 'L']]],
    ['Pancreas', 'Pancreas', 'Pancreas', 328, 'pancreas', { k: 'lobes', n: 11 }, [['pancreatic parenchyma', 75, 'L'], ['connective tissue', 25, 'L']]],
    ['Pituitary', 'Pituitary', 'Pituitary', 283, 'pituitary', { k: 'round', sx: 0.92, sy: 0.82, w: 0.2 }, [['fibromuscular tissue', 6, 'E'], ['neurohypophysis', 12, 'P', { n: 1, s: 0.5, at: [0.55, -0.45] }], ['adenohypophysis', 83, 'L']]],
    ['Prostate', 'Prostate', 'Prostate', 245, 'prostate', { k: 'block', sx: 0.9, sy: 0.85, w: 0.2 }, [['prostatic acini', 43, 'S', { n: 26, s: 0.12 }], ['fibromuscular tissue', 57, 'L']]],
    ['Skin - Not Sun Exposed (Suprapubic)', 'Skin', 'Skin', 604, 'skin', { k: 'strip', amp: 0.08, w: 0.22, rot: 1.5 }, [['epidermis', 9, 'L'], ['papillary dermis', 27, 'L'], ['reticular dermis', 38, 'L'], ['subdermis', 27, 'L']]],
    ['Skin - Sun Exposed (Lower leg)', 'Skin, sun-exposed', 'Skin', 701, '', { k: 'strip', amp: 0.1, w: 0.3, rot: 1.6 }, [['epidermis', 7, 'L'], ['papillary dermis', 16, 'L'], ['reticular dermis', 50, 'L'], ['subdermis', 27, 'L']]],
    ['Small Intestine - Terminal Ileum', 'Small intestine', 'Small Intestine', 187, 'small intestine', { k: 'strip', amp: 0.38, w: 0.3, fq: 1.5, fold: 0.13, rot: 0.2 }, [['lymphoid Peyer patches', 22, 'P', { n: 3, s: 0.32, d: [0.3, 0.55] }], ['mucosa', 15, 'L'], ['submucosa', 26, 'L'], ['muscularis', 37, 'L']]],
    ['Spleen', 'Spleen', 'Spleen', 241, 'spleen', { k: 'block', sx: 0.68, sy: 0.95, w: 0.15 }, [['tissue edge', 5, 'E'], ['connective tissue', 10, 'S', { n: 10, s: 0.1 }], ['stroma', 85, 'L']]],
    ['Stomach', 'Stomach', 'Stomach', 359, 'stomach', { k: 'strip', amp: 0.05, w: 0.55, rot: 1.57 }, [['gastric foveolae', 13, 'L'], ['gastric glands', 21, 'L'], ['submucosa', 16, 'L'], ['muscularis', 50, 'L']]],
    ['Testis', 'Testis', 'Testis', 361, 'testis', { k: 'round', sx: 0.95, sy: 0.85, w: 0.3 }, [['seminiferous tubules', 62, 'S', { n: 28, s: 0.13 }], ['connective tissue', 38, 'L']]],
    ['Thyroid', 'Thyroid', 'Thyroid', 653, 'thyroid', { k: 'round', sx: 0.75, sy: 0.95, w: 0.25 }, [['cyst', 1, 'P', { n: 1, s: 0.2 }], ['thyroid follicles', 63, 'S', { n: 30, s: 0.11 }], ['connective tissue', 37, 'L']]],
    ['Uterus', 'Uterus', 'Uterus', 142, 'uterus', { k: 'ring', rin: 0.26, w: 0.3, sq: 1, ecc: 0.1 }, [['endometrium', 14, 'L'], ['myometrium', 77, 'L'], ['connective tissue', 8, 'L']]],
    ['Vagina', 'Vagina', 'Vagina', 156, 'vagina', { k: 'strip', amp: 0.12, w: 0.42, rot: 1.4 }, [['squamous epithelium', 9, 'L'], ['lamina propria', 41, 'L'], ['muscularis', 42, 'L'], ['connective tissue', 8, 'L']]],
  ];
  const NT = TT.length;
  const NAMES = TT.map(r => r[0]), SHORT = TT.map(r => r[1]), ORGAN = TT.map(r => r[2]);

  // one spelling per domain (the figure's legends keep the slides' spellings)
  const canon = s => String(s || '').toLowerCase().replace(/\s*\/\s*/g, ' and ').replace(/peyer'?s? pat\w*/, 'lymphoid peyer patches')
    .replace(/^lymphoid lymphoid/, 'lymphoid').replace(/\bmedula\b/g, 'medulla').replace(/adventita/, 'adventitia').replace(/pia matter/, 'pia mater')
    .replace(/calcified plaque$/, 'calcified plaques').replace(/\s+/g, ' ').trim();
  const tissueIx = s => { const n = String(s || '').toLowerCase(); if (!n) return -1;
    let i = NAMES.findIndex(m => m.toLowerCase() === n); if (i < 0) i = NAMES.findIndex(m => m.toLowerCase().startsWith(n));
    if (i < 0) i = TT.findIndex(r => r[4] === n || r[1].toLowerCase() === n); if (i < 0) i = ORGAN.findIndex(o => o.toLowerCase() === n); return i; };

  // the talk's atlas: domains and shares of 29 sections (pixel shares of its maps)
  const FA = Array.isArray(FIG.atlas) ? FIG.atlas : [];
  const figIx = s => { const n = String(s || '').toLowerCase(), i = TT.findIndex(r => r[4] && r[4] === n); return i >= 0 ? i : tissueIx(s); };
  // the talk's volcano: significant changes, used as each domain's drift with age (points a decade, illustrative)
  const VP = (FIG.volcano && Array.isArray(FIG.volcano.points)) ? FIG.volcano.points : [];
  const driftOf = (ti, nm) => { const p = VP.find(q => q.significant !== false && q.tissue && tissueIx(q.tissue) === ti && canon(q.domain) === nm);
    return p ? +p.x : nm === 'connective tissue' ? 0.3 : 0; };

  // the preprint's three examples: which tissue and domain they morph
  const exT = EX.map(e => { let i = tissueIx(e.tissue); if (i < 0 && /gastro|gut|intestin|colon|digest/i.test(e.tissue || '')) i = NAMES.indexOf('Colon - Transverse'); return i; });

  const REC = TT.map((row, ti) => {
    let doms = row[6].map(d => ({ name: canon(d[0]), f20: d[1], mode: d[2], o: d[3] || {} }));
    const fa = FA.find(a => figIx(a.tissue) === ti);
    if (fa && Array.isArray(fa.domains) && fa.domains.length) {
      const sum = fa.domains.reduce((s, d) => s + (+d.share || 0), 0), k = sum > 1.5 ? 1 : 100;
      const fd = fa.domains.map(d => ({ name: canon(d.name), share: Math.max(0.5, (+d.share || 0) * k) }));
      doms = doms.filter(d => d.o.keep || fd.some(q => q.name === d.name));
      for (const d of doms) { const q = fd.find(x => x.name === d.name); if (q) d.f20 = q.share; }
      for (const q of fd) if (!doms.some(d => d.name === q.name)) doms.push({ name: q.name, f20: q.share, mode: q.share < 8 ? 'P' : 'L', o: {} });
    }
    const tot = doms.reduce((s, d) => s + d.f20, 0);
    for (const d of doms) { d.f20 *= 100 / tot; const dr = driftOf(ti, d.name); if (dr) d.f70 = Math.max(0.3, d.f20 + dr * (AGES[1] - AGES[0]) / 10); }
    EX.forEach((e, k) => { if (exT[k] !== ti) return; const nm = canon(e.domain); let d = doms.find(x => x.name === nm);
      if (!d) { d = { name: nm, f20: 0, mode: 'P', o: { n: 3 } }; doms.unshift(d); } d.f20 = +e.from; d.f70 = +e.to; d.ex = k; });
    // the others fill the rest at 20 (the figure's section is one donor's; the example's numbers are the preprint's)
    const exs = doms.reduce((s, d) => s + (d.ex !== undefined ? d.f20 : 0), 0), os = doms.reduce((s, d) => s + (d.ex === undefined ? d.f20 : 0), 0);
    if (exs > 0 && os > 0) for (const d of doms) if (d.ex === undefined) { d.f20 *= (100 - exs) / os; delete d.f70; }
    return doms;
  });
  // shares at age a (0 = 20, 1 = 70). In an example's section only the example changes (the preprint's numbers) and
  // the rest scale to fill; elsewhere the domains that drift follow their line and all are scaled back to 100 %
  function shares(doms, a) {
    const e = doms.find(d => d.ex !== undefined);
    if (e) { const v = lerp(e.f20, e.f70, a), k = (100 - v) / Math.max(1e-6, 100 - e.f20); return doms.map(d => (d === e ? v : d.f20 * k)); }
    const v = doms.map(d => (d.f70 !== undefined ? lerp(d.f20, d.f70, a) : d.f20)), tot = v.reduce((s, x) => s + x, 0) || 1;
    return v.map(x => x * 100 / tot);
  }

  // ---------------------------------------------------------------- domain types, H&E looks and colours
  const GT = {};
  { const N = GR.nodes || []; for (const [a, b] of GR.edges || []) { const A = N[a], B = N[b]; if (!A || !B) continue;
    if (A[1] === 3 && B[1] === 2) GT[canon(A[0])] = B[0]; if (B[1] === 3 && A[1] === 2) GT[canon(B[0])] = A[0]; } }
  const typeOf = nm => GT[nm] || (/edge/.test(nm) ? 'other' : /plaque/.test(nm) ? 'vascular tissue' : /skeletal/.test(nm) ? 'skeletal muscle'
    : /cardiac|myocard/.test(nm) ? 'cardiac muscle' : /adipose|fat/.test(nm) ? 'adipose tissue' : /lymph/.test(nm) ? 'lymphoid structure'
    : /muscle|muscularis/.test(nm) ? 'smooth muscle' : /foveol|epitheli|mucosa/.test(nm) ? 'lining epithelium'
    : /gland|cyst|tubul|acini|parenchyma|follic/.test(nm) ? 'glandular tissue' : /vessel|vein/.test(nm) ? 'vascular tissue'
    : /matter|nerve|layer/.test(nm) ? 'neuronal tissue' : 'connective tissue');
  // H&E: eosin base and nuclear density by tissue type (eosin #e88bb0..#f6c4d6, haematoxylin #4b3b8f..#7d6bc4, white #fbf4f7)
  const HE = { 'connective tissue': ['#f4b9cf', 0.14], 'smooth muscle': ['#e88bb0', 0.24], 'skeletal muscle': ['#e57fa9', 0.1], 'cardiac muscle': ['#e57fa9', 0.14],
    'lining epithelium': ['#d79cc8', 0.6], 'glandular tissue': ['#dca2cc', 0.48], 'lymphoid structure': ['#a892d4', 0.95], 'neuronal tissue': ['#e2b7da', 0.28],
    'vascular tissue': ['#ec8fac', 0.22], 'adipose tissue': ['#fbf4f7', 0.03], other: ['#f6c4d6', 0.1] };
  const heOf = nm => (/space|cyst|lumen/.test(nm) ? ['#fbf4f7', 0.04] : /granular/.test(nm) ? ['#9d8ad0', 0.9] : /white matter/.test(nm) ? ['#f2cade', 0.1]
    : /squamous|epidermis/.test(nm) ? ['#c99ccc', 0.62] : /plaque/.test(nm) ? ['#c7b7e0', 0.5] : HE[typeOf(nm)] || HE.other);
  const HAE = K.rgb('#5a49a6');

  // one colour per domain name, the same in every set. The talk's sections reuse one palette per section (the same
  // colour means different domains), so names get fixed colours: the gut and ovary ones as in its panels f and g
  const CUR = {
    'mucosa': '#4f8dff', 'mucosa epithelium': '#6fa3ff', 'mucosa lamina propria': '#9db7ff', 'lamina propria': '#a58bff', 'submucosa': '#3ee08f',
    'muscularis': '#ff8a3d', 'inner circular smooth muscle': '#ffa04d', 'outer longitudinal smooth muscle': '#ff6a3d',
    'lymphoid peyer patches': '#c070ff', 'lymphoid tissue': '#c070ff', 'lymph node': '#c070ff', 'blood vessels': '#ff3d6e',
    'blood vessels and hemorrhage': '#ff3d6e', 'portal vein': '#ff4f86', 'connective tissue': '#ffd84a', 'fibroadipose tissue': '#f2e2a0',
    'adipose tissue': '#fff3cf', 'fat': '#fff3cf', 'fibromuscular tissue': '#ff9db5', 'fibrovascular tissue': '#e58bd0', 'tissue edge': '#8a9bb3',
    'corpus albicans': '#9be05a', 'ovarian cortex': '#ff6a5a', 'ovarian stroma': '#b98cff', 'adenohypophysis': '#46a8ff', 'neurohypophysis': '#3ee0c8',
    'tunica intima': '#ffb43b', 'tunica media': '#ff5ad9', 'tunica adventitia': '#46d9ff', 'calcified plaques': '#f4f1e8',
    'epidermis': '#c070ff', 'papillary dermis': '#ff8fb0', 'reticular dermis': '#3ee08f', 'subdermis': '#ffb43b',
    'gray matter': '#3ee08f', 'white matter': '#b98cff', 'molecular layer': '#ff5a6e', 'granular layer': '#46d9ff', 'cerebral medulla': '#ffa04d',
    'squamous epithelium': '#ff5a6e', 'endometrium': '#3ee08f', 'myometrium': '#ff5a6e', 'cardiac muscle': '#4f8dff', 'myocardium': '#4f8dff',
    'skeletal muscle': '#ff6a3d', 'nerve fibers': '#ffa04d', 'epineurium': '#46a8ff', 'seminiferous tubules': '#ff8a3d', 'thyroid follicles': '#3ee08f',
    'liver parenchyma': '#ff9a52', 'pancreatic parenchyma': '#ffa86b', 'prostatic acini': '#ff7a59', 'stroma': '#3ee08f',
  };
  const PAL = ['#46d9ff', '#ff5ad9', '#ffb43b', '#3ee08f', '#4f8dff', '#ff8a3d', '#b98cff', '#ff5a6e', '#9be05a', '#3ee0c8', '#ffd84a', '#ff9db5', '#7a7dff', '#c98a5a', '#a0e8ff', '#e58bd0'];
  const COL = {};
  for (const k in CUR) COL[k] = CUR[k];
  { const use = {}, dist = (a, b) => { const x = K.rgb(a), y = K.rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
    for (const doms of REC) for (const d of doms) if (!COL[d.name]) {
      const here = doms.filter(e => COL[e.name]).map(e => COL[e.name]);
      let best = PAL[0], bs = -9;
      for (const c of PAL) { const s = (here.length ? Math.min(...here.map(h => dist(c, h))) : 1) - 0.04 * (use[c] || 0); if (s > bs) { bs = s; best = c; } }
      COL[d.name] = best; use[best] = (use[best] || 0) + 1;
    } }
  function domainColour(name) {
    let n = canon(name);
    if (!COL[n]) { if (/inner/.test(n) && /musc/.test(n)) n = 'inner circular smooth muscle'; else if (/outer/.test(n) && /musc/.test(n)) n = 'outer longitudinal smooth muscle';
      else if (/lymph/.test(n)) n = 'lymphoid tissue'; else if (/vessel/.test(n)) n = 'blood vessels'; else if (/muscularis/.test(n)) n = 'muscularis'; }
    if (COL[n]) return COL[n];
    let h = 2166136261; for (let i = 0; i < n.length; i++) h = Math.imul(h ^ n.charCodeAt(i), 16777619);
    return PAL[(h >>> 0) % PAL.length];
  }

  // ---------------------------------------------------------------- section shapes (local coords, about [-1, 1])
  const vnoise = seed => {
    const h = (i, j) => { let n = (i * 374761393 + j * 668265263 + seed * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
    return (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      return lerp(lerp(h(i, j), h(i + 1, j), sx), lerp(h(i, j + 1), h(i + 1, j + 1), sx), sy) * 2 - 1; };
  };
  // st(x, y): 0 outside, 1 tissue, 2 lumen; depth(x, y) (optional): 0 at the surface or lumen, 1 deepest
  function makeShape(i, sp) {
    const r = rng(7001 + i * 131), nz = vnoise(i * 7 + 3);
    const harm = (w) => { const a = [], ph = []; for (let k = 2; k <= 6; k++) { a.push(w * (0.3 + 0.7 * r()) / k); ph.push(r() * 2 * PI); }
      const f = th => { let s = 1; for (let k = 0; k < a.length; k++) s += a[k] * Math.cos((k + 2) * th + ph[k]); return s; };
      let mx = 0; for (let k = 0; k < 96; k++) mx = Math.max(mx, f(k / 96 * 2 * PI)); return th => f(th) / mx; };
    const kd = sp.k;
    if (kd === 'ring') {
      const ho = harm(sp.w || 0.12), hi = harm(0.2), ex = (r() - 0.5) * 2 * (sp.ecc || 0), rin = sp.rin || 0.45, nf = sp.nf || 0, fold = sp.fold || 0, ph = r() * 6.28;
      return { hole: true, st: (x, y) => {
        const th = Math.atan2(y, x), q = sp.sq ? Math.pow(Math.pow(Math.abs(x / 0.95), 4) + Math.pow(Math.abs(y / 0.85), 4), 0.25) : Math.hypot(x, y);
        if (q > 0.96 * ho(th) * (1 + 0.03 * nz(x * 7, y * 7))) return 0;
        const thi = Math.atan2(y, x - ex), ri = rin * hi(thi) * (1 - fold * Math.pow(Math.max(0, Math.sin(nf * thi + ph)), 2));
        return Math.hypot(x - ex, y) < ri ? 2 : 1; } };
    }
    if (kd === 'strip') {
      const rot = sp.rot || 0, cr = Math.cos(rot), sr = Math.sin(rot), amp = sp.amp || 0, fq = sp.fq || 1.2, ph = r() * 6.28, w = sp.w || 0.3, fold = sp.fold || 0;
      const e = w + amp + fold, ac = Math.abs(cr), as = Math.abs(sr);
      const L = Math.min(0.95, ac > 0.01 ? (0.97 - e * as) / ac : 9, as > 0.01 ? (0.97 - e * ac) / as : 9);
      const cen = u => amp * Math.sin(fq * u + ph), fo = u => fold * Math.pow(Math.max(0, Math.sin(u * 24 + ph)), 1.5);
      return { st: (x, y) => {
        const u = x * cr + y * sr, v = -x * sr + y * cr; if (Math.abs(u) > L) return 0;
        const t = Math.max(0, (Math.abs(u) - L + 0.12) / 0.12), wf = Math.sqrt(Math.max(0, 1 - t * t)), c = cen(u) + 0.02 * nz(u * 5, 3);
        return v < c + (w + fo(u)) * wf && v > c - w * wf ? 1 : 0; },
      depth: (x, y) => { const u = x * cr + y * sr, v = -x * sr + y * cr; return c01((cen(u) + w - v) / (2 * w)); } };
    }
    if (kd === 'lobes') {
      const hb = harm(0.25), sx = sp.sx || 0.92, sy = sp.sy || 0.92, n = sp.n || 8, C = [], md = 1.4 / Math.sqrt(n);
      for (let g = 0; C.length < n && g < 5000; g++) {
        const x = (r() * 2 - 1) * sx, y = (r() * 2 - 1) * sy;
        if (Math.hypot(x / sx, y / sy) > 0.85 * hb(Math.atan2(y / sy, x / sx))) continue;
        if (C.some(c => Math.hypot(c[0] - x, c[1] - y) < md * (g > 2500 ? 0.6 : 1))) continue;
        C.push([x, y, r() < (sp.lacy || 0)]);
      }
      const vor = (x, y) => { let d1 = 9, d2 = 9, i1 = 0; for (let k = 0; k < C.length; k++) { const d = Math.hypot(C[k][0] - x, C[k][1] - y); if (d < d1) { d2 = d1; d1 = d; i1 = k; } else if (d < d2) d2 = d; } return [d1 / (0.5 * (d1 + d2)), i1]; };
      return { st: (x, y) => { const u = x / sx, v = y / sy; if (Math.hypot(u, v) > 0.97 * hb(Math.atan2(v, u)) * (1 + 0.03 * nz(x * 7, y * 7))) return 0;
          if (sp.lacy) { const [d, k] = vor(x, y); if (d > 0.84 || C[k][2]) return 0; } return 1; },
        depth: (x, y) => c01(vor(x, y)[0] + 0.06 * nz(x * 9, y * 9)) };
    }
    if (kd === 'fasc') {
      const C = [];
      for (let g = 0; C.length < (sp.n || 6) && g < 4000; g++) {
        const rr = 0.2 + 0.14 * r(), a = r() * 6.28, q = r() * (0.82 - rr), x = q * Math.cos(a), y = q * Math.sin(a) * 0.9;
        if (C.some(c => Math.hypot(c[0] - x, c[1] - y) < c[2] + rr + 0.06)) continue;
        C.push([x, y, rr]);
      }
      const near = (x, y) => { let b = 9; for (const c of C) b = Math.min(b, Math.hypot(c[0] - x, c[1] - y) / c[2]); return b; };
      return { st: (x, y) => { for (const c of C) if (Math.hypot(c[0] - x, c[1] - y) < c[2] + 0.11 + 0.04 * nz(x * 6, y * 6)) return 1; return 0; },
        depth: (x, y) => c01(near(x, y) * 0.5) };
    }
    if (kd === 'folia') {
      const hb = harm(0.16), n = sp.n || 8, dp = sp.dp || 0.3, ph = r() * 6.28;
      return { st: (x, y) => { const th = Math.atan2(y, x), q = Math.hypot(x / 0.96, y / 0.9);
        return q < 0.97 * hb(th) * (1 - dp * Math.pow(Math.abs(Math.cos(n * th / 2 + ph)), 10)) ? 1 : 0; } };
    }
    // round or block (a rounded square)
    const hb = harm(sp.w || 0.2), sx = sp.sx || 0.9, sy = sp.sy || 0.9, p = kd === 'block' ? 4 : 2;
    return { st: (x, y) => { if (sp.flat !== undefined && y < sp.flat) return 0;
      const u = x / sx, v = y / sy, q = Math.pow(Math.pow(Math.abs(u), p) + Math.pow(Math.abs(v), p), 1 / p);
      return q < 0.97 * hb(Math.atan2(v, u)) * (1 + 0.04 * nz(x * 6, y * 6)) ? 1 : 0; } };
  }
  // chamfer distance (in cells) from the cells where src is 1
  function chamfer(nx, ny, src) {
    const d = new Float32Array(nx * ny), D2 = 1.414;
    for (let k = 0; k < d.length; k++) d[k] = src[k] ? 0 : 1e9;
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { const k = y * nx + x; let v = d[k]; if (!v) continue;
      if (x > 0) v = Math.min(v, d[k - 1] + 1);
      if (y > 0) { v = Math.min(v, d[k - nx] + 1); if (x > 0) v = Math.min(v, d[k - nx - 1] + D2); if (x < nx - 1) v = Math.min(v, d[k - nx + 1] + D2); }
      d[k] = v; }
    for (let y = ny - 1; y >= 0; y--) for (let x = nx - 1; x >= 0; x--) { const k = y * nx + x; let v = d[k]; if (!v) continue;
      if (x < nx - 1) v = Math.min(v, d[k + 1] + 1);
      if (y < ny - 1) { v = Math.min(v, d[k + nx] + 1); if (x < nx - 1) v = Math.min(v, d[k + nx + 1] + D2); if (x > 0) v = Math.min(v, d[k + nx - 1] + D2); }
      d[k] = v; }
    return d;
  }

  // ---------------------------------------------------------------- the sections: tiles, domains at 20 and 70
  const TARGET = 620, NAGE = 16;
  const SEC = TT.map((row, ti) => {
    const sh = makeShape(ti, row[5]), nz = vnoise(500 + ti), r = rng(900 + ti * 37), doms = REC[ti];
    let cnt = 0; const G0 = 36;
    for (let y = 0; y < G0; y++) for (let x = 0; x < G0; x++) if (sh.st(-1 + (x + 0.5) * 2 / G0, -1 + (y + 0.5) * 2 / G0) === 1) cnt++;
    const cell = Math.sqrt(4 * Math.max(cnt, 40) / (G0 * G0) / TARGET), nx = Math.ceil(2.1 / cell) + 2, ny = nx, h0 = (nx - 1) / 2;
    const st = new Uint8Array(nx * ny), PX = new Float32Array(nx * ny), PY = new Float32Array(nx * ny);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { const k = y * nx + x, px = (x - h0) * cell, py = (y - h0) * cell;
      PX[k] = px; PY[k] = py; st[k] = Math.abs(px) > 1.02 || Math.abs(py) > 1.02 ? 0 : sh.st(px, py); }
    const de = chamfer(nx, ny, st.map(v => (v === 0 ? 1 : 0))), dh = sh.hole ? chamfer(nx, ny, st.map(v => (v === 2 ? 1 : 0))) : null;
    const T = []; for (let k = 0; k < st.length; k++) if (st[k] === 1) T.push(k);
    const N = T.length; let mxe = 1; for (const k of T) mxe = Math.max(mxe, de[k]);
    const x = new Float32Array(N), y = new Float32Array(N), dep = new Float32Array(N), edg = new Float32Array(N);
    T.forEach((k, j) => { x[j] = PX[k]; y[j] = PY[k];
      const d = sh.depth ? sh.depth(PX[k], PY[k]) : dh ? dh[k] / (dh[k] + de[k]) : (de[k] - 1) / Math.max(1, mxe - 1);
      dep[j] = d + 0.045 * nz(PX[k] * 4, PY[k] * 4); edg[j] = de[k] + 0.7 * nz(PX[k] * 5 + 9, PY[k] * 5); });
    // the order in which each rim, patch or speck domain takes tiles
    const ord = doms.map(d => {
      if (d.mode === 'L') return null;
      const idx = Array.from({ length: N }, (_, j) => j);
      if (d.mode === 'E') return idx.sort((a, b) => edg[a] - edg[b]);
      const o = d.o, n = o.n || (d.mode === 'S' ? 14 : 3), s = o.s || (d.mode === 'S' ? 0.09 : 0.26), band = o.d || [0, 1], seeds = [];
      if (o.at) seeds.push([o.at[0], o.at[1]]);
      for (let g = 0; seeds.length < n && g < 400; g++) { const j = Math.floor(r() * N); if (dep[j] >= band[0] && dep[j] <= band[1] || g > 300) seeds.push([x[j], y[j]]); }
      const fld = new Float32Array(N);
      for (let j = 0; j < N; j++) { let m = 0; for (const c of seeds) m = Math.max(m, Math.exp(-((x[j] - c[0]) ** 2 + (y[j] - c[1]) ** 2) / (s * s))); fld[j] = m * (0.85 + 0.15 * nz(x[j] * 8 + 3, y[j] * 8)); }
      return idx.sort((a, b) => fld[b] - fld[a]);
    });
    const byDepth = Array.from({ length: N }, (_, j) => j).sort((a, b) => dep[a] - dep[b]);
    const assign = fr => {
      const out = new Int16Array(N).fill(-1);
      doms.forEach((d, k) => { if (!ord[k]) return; let need = Math.round(fr[k] / 100 * N); for (const j of ord[k]) { if (need <= 0) break; if (out[j] < 0) { out[j] = k; need--; } } });
      const rest = byDepth.filter(j => out[j] < 0), Ls = doms.map((d, k) => k).filter(k => !ord[k]);
      const fl = Ls.reduce((s, k) => s + fr[k], 0) || 1; let c = 0, at = 0;
      Ls.forEach((k, q) => { c += fr[k]; const to = q === Ls.length - 1 ? rest.length : Math.round(c / fl * rest.length); for (; at < to; at++) out[rest[at]] = k; });
      for (const j of rest) if (out[j] < 0) out[j] = Ls.length ? Ls[Ls.length - 1] : 0;
      return out;
    };
    const d0 = assign(shares(doms, 0)), d1 = assign(shares(doms, 1)), flip = new Float32Array(N).fill(2);
    for (let s = 1; s <= NAGE; s++) { const ds = s === NAGE ? d1 : assign(shares(doms, s / NAGE)); for (let j = 0; j < N; j++) if (flip[j] > 1.5 && ds[j] !== d0[j] && d1[j] !== d0[j]) flip[j] = (s - 0.5) / NAGE; }
    // where each example domain lies (for its label)
    const exAt = doms.map((d, k) => { let sx = 0, sy = 0, n = 0; for (let j = 0; j < N; j++) if (d1[j] === k) { sx += x[j]; sy += y[j]; n++; } return n ? [sx / n, sy / n] : [0, 0]; });
    return { N, x, y, cell, d0, d1, flip, exAt };
  });

  // ---------------------------------------------------------------- the tile cloud (an embedding by domain)
  // tissues sit round a sphere grouped by organ system; a domain found in one tissue clusters beside it, one shared by
  // several sits between them (connective tissue near the middle), and its tiles stretch towards their own tissues
  const SYS = [['Esophagus', 'Stomach', 'Small Intestine', 'Colon', 'Liver', 'Pancreas', 'Minor Salivary Gland'], ['Spleen'], ['Kidney', 'Bladder'],
    ['Ovary', 'Uterus', 'Cervix', 'Vagina', 'Fallopian Tube', 'Testis', 'Prostate', 'Breast'], ['Skin', 'Adipose'], ['Muscle'], ['Artery', 'Heart'],
    ['Lung'], ['Brain', 'Nerve'], ['Pituitary', 'Thyroid', 'Adrenal Gland']];
  const HOME = new Array(NT);
  { const ns = SYS.length, cen = SYS.map((_, s) => { const yy = 1 - 2 * (s + 0.5) / ns, rr = Math.sqrt(1 - yy * yy), th = s * 2.39996; return [rr * Math.cos(th), yy, rr * Math.sin(th)]; });
    SYS.forEach((orgs, s) => { const mem = []; for (let i = 0; i < NT; i++) if (orgs.includes(ORGAN[i])) mem.push(i);
      const c = cen[s], t1 = K.v3.norm(K.v3.cross(c, Math.abs(c[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), t2 = K.v3.cross(c, t1);
      mem.forEach((i, k) => { const a = k / Math.max(1, mem.length) * 2 * PI, rad = mem.length > 1 ? 0.28 + 0.03 * mem.length : 0;
        const p = K.v3.norm(K.v3.add(c, K.v3.add(K.v3.mul(t1, rad * Math.cos(a)), K.v3.mul(t2, rad * Math.sin(a)))));
        HOME[i] = [p[0] * 0.82, p[1] * 0.62, p[2] * 0.7]; }); }); }
  const DT = {};   // domain name -> tissues it is found in
  REC.forEach((doms, ti) => doms.forEach(d => { (DT[d.name] = DT[d.name] || []).includes(ti) || DT[d.name].push(ti); }));
  const DC = {};
  for (const nm in DT) { const ts = DT[nm], r = rng(nm.length * 97 + nm.charCodeAt(0) * 13 + nm.charCodeAt(nm.length - 1));
    if (ts.length === 1) { const h = HOME[ts[0]], u = K.unit(r); DC[nm] = K.v3.add(K.v3.mul(h, 1.12), K.v3.mul(u, 0.12)); }
    else { let m = [0, 0, 0]; for (const t of ts) m = K.v3.add(m, HOME[t]); m = K.v3.mul(m, 1 / ts.length);
      DC[nm] = K.v3.add(K.v3.mul(m, 0.8 / (1 + 0.1 * (ts.length - 2))), K.v3.mul(K.unit(r), 0.05)); } }

  // ---------------------------------------------------------------- layout: the wall, the atlas grid, focus
  const WR = 1.25, WC = 0.75, TH = 62 * PI / 180, WH = 1.12, NR = 80, GAP = 0.8;   // wall radius, centre z, half arc, height, rows
  const wallAt = (th, y) => [WR * Math.sin(th), y, WC - WR * Math.cos(th)];
  const COLS = 10, RA = 1.7, ZA = 1.8, DA = 0.165, S0 = 0.125;
  const gridAt = i => { const c = i % COLS, rw = Math.floor(i / COLS), th = (c - (COLS - 1) / 2) * DA; return { p: [RA * Math.sin(th), 0.5 - rw * 0.335, ZA - RA * Math.cos(th)], yaw: -th }; };
  const GRID = TT.map((_, i) => gridAt(i));

  // slides per tissue (the total is the preprint's), their columns on the wall and their rows by donor age
  const TOTAL = F.slides || 24945;
  const AGEB = [0.085, 0.08, 0.16, 0.33, 0.345];   // GTEx donors by decade, 20s to 60s (approximate: they lean old, median 56)
  const wsum = TT.reduce((s, r) => s + r[3], 0);
  const NSL = TT.map(r => Math.max(30, Math.round(r[3] / wsum * TOTAL)));
  { let d = TOTAL - NSL.reduce((s, n) => s + n, 0), k = 0; while (d !== 0 && k < 9999) { const i = k++ % NT; if (d > 0 || NSL[i] > 31) { NSL[i] += Math.sign(d); d -= Math.sign(d); } } }
  const WCOLS = NSL.map(n => Math.max(1, Math.ceil(n * 1.6 / NR)));
  const WST = []; let U = 0; for (let i = 0; i < NT; i++) { WST.push(U); U += WCOLS[i] + (i < NT - 1 ? GAP : 0); }
  const uTh = u => (u / U - 0.5) * 2 * TH;
  // the rows by age stand in a rack: a shelf at every decade (16 rows each), SG rows' height apart
  const SG = 1.6, RT = NR + 6 * SG, rowY = rw => ((rw + 0.5 + SG * (1 + Math.floor(rw / 16))) / RT - 0.5) * WH, shelfY = k => ((16 * k + SG * (k + 0.5)) / RT - 0.5) * WH;
  const WALLMID = TT.map((_, i) => wallAt(uTh(WST[i] + WCOLS[i] / 2), 0));

  // ---------------------------------------------------------------- textures: slides (one per shape), captions
  const SHAPES = ['strip', 'ring', 'round', 'lobes', 'block', 'lacy', 'folia', 'fasc'];
  const varOf = sp => { const k = sp.k === 'lobes' && sp.lacy > 0.25 ? 'lacy' : sp.k; return Math.max(0, SHAPES.indexOf(k)); };
  function slideTexture() {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
    const g = cv.getContext('2d'), r = rng(31);
    g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512); g.globalCompositeOperation = 'lighter';
    SHAPES.forEach((k, v) => {
      const ox = (v % 4) * 128, oy = Math.floor(v / 4) * 256, cx = ox + 64, cy = oy + 150, P = new Path2D();
      g.fillStyle = 'rgb(0,0,255)'; g.fillRect(ox + 12, oy + 10, 104, 46);   // the frosted label end
      const blob = (rx, ry, w, n) => { const ph = r() * 6; for (let a = 0; a <= 64; a++) { const t = a / 64 * 2 * PI, q = 1 + w * Math.sin(n * t + ph) + 0.5 * w * Math.sin((n + 3) * t);
        const px = cx + rx * q * Math.cos(t), py = cy + ry * q * Math.sin(t); a ? P.lineTo(px, py) : P.moveTo(px, py); } P.closePath(); };
      if (k === 'strip') { for (let a = 0; a <= 40; a++) { const t = a / 40, py = oy + 72 + t * 168, px = cx + 22 * Math.sin(t * 5) - 16; a ? P.lineTo(px, py) : P.moveTo(px, py); }
        for (let a = 40; a >= 0; a--) { const t = a / 40, py = oy + 72 + t * 168, px = cx + 22 * Math.sin(t * 5) + 20 + 4 * Math.sin(t * 40); P.lineTo(px, py); } P.closePath(); }
      else if (k === 'ring') { P.arc(cx, cy, 46, 0, 2 * PI); P.moveTo(cx + 26, cy); P.arc(cx, cy, 26, 0, 2 * PI); }
      else if (k === 'round') blob(46, 62, 0.06, 3);
      else if (k === 'block') { P.rect(cx - 42, cy - 62, 84, 124); }
      else if (k === 'folia') blob(44, 64, 0.16, 9);
      else if (k === 'fasc') { for (let a = 0; a < 6; a++) { const t = a * 1.05, q = a ? 30 : 0; P.moveTo(cx + q * Math.cos(t) + 20, cy + q * 1.4 * Math.sin(t)); P.arc(cx + q * Math.cos(t), cy + q * 1.4 * Math.sin(t), 20, 0, 2 * PI); } }
      else { const n = k === 'lacy' ? 11 : 8; for (let a = 0; a < n; a++) { const px = cx + (r() - 0.5) * 70, py = cy + (r() - 0.5) * 120, rr = k === 'lacy' ? 9 + r() * 9 : 16 + r() * 8; P.moveTo(px + rr, py); P.arc(px, py, rr, 0, 2 * PI); } }
      g.fillStyle = 'rgb(255,0,0)'; g.fill(P, k === 'ring' ? 'evenodd' : 'nonzero');
      g.fillStyle = 'rgb(0,150,0)';
      for (let a = 0; a < 520; a++) { const px = ox + 8 + r() * 112, py = oy + 64 + r() * 186; if (!g.isPointInPath(P, px, py, k === 'ring' ? 'evenodd' : 'nonzero')) continue;
        g.beginPath(); g.arc(px, py, 0.9 + r() * 1.6, 0, 2 * PI); g.fill(); }
    });
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
  }
  function captionTexture() {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 1024;
    const g = cv.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#e7eef8';
    SHORT.forEach((s, i) => { const cx = (i % 2) * 256 + 128, cy = Math.floor(i / 2) * 48 + 24; let fs = 26;
      do { g.font = `600 ${fs}px "Inter", "Segoe UI", system-ui, sans-serif`; fs--; } while (g.measureText(s).width > 240 && fs > 12);
      g.fillText(s, cx, cy); });
    return new THREE.CanvasTexture(cv);
  }

  // ---------------------------------------------------------------- a box as the three faces the camera sees
  // Slides and tiles are boxes; a box is drawn as three quads (its broad face, a side, an end), each turned in the
  // vertex shader to the side of the box that faces the camera, so a box costs 6 triangles instead of 12 and is right
  // from every side (in a headset each eye picks its own). position = (a, b, face) with a, b in -0.5..0.5; the broad
  // face comes first, so a draw range of 6 indices draws only it (a box seen from afar)
  const BOXQ = { P: [], I: [] };
  for (let fc = 0; fc < 3; fc++) { const b = BOXQ.P.length / 3; BOXQ.P.push(-0.5, -0.5, fc, 0.5, -0.5, fc, 0.5, 0.5, fc, -0.5, 0.5, fc); BOXQ.I.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  const boxGeo = g => { g.setIndex(BOXQ.I); g.setAttribute('position', new THREE.Float32BufferAttribute(BOXQ.P, 3)); return g; };
  // (X, Y, Z: the box's half-to-half axes, scaled; c its centre; out: the point's offset from c and the face's normal)
  const BOXGL = `
vec3 boxAt(vec3 q, vec3 c, vec3 X, vec3 Y, vec3 Z, out vec3 nrm, out vec2 fuv) {
  vec3 V = cameraPosition - (modelMatrix * vec4(c, 1.0)).xyz; mat3 M = mat3(modelMatrix);
  float sx = dot(V, M * X) >= 0.0 ? 1.0 : -1.0, sy = dot(V, M * Y) >= 0.0 ? 1.0 : -1.0, sz = dot(V, M * Z) >= 0.0 ? 1.0 : -1.0;
  vec3 l; fuv = q.xy + 0.5;
  if (q.z < 0.5) { l = vec3(q.x, q.y, 0.5 * sz); nrm = normalize(Z) * sz; }
  else if (q.z < 1.5) { l = vec3(0.5 * sx, q.x, q.y); nrm = normalize(X) * sx; }
  else { l = vec3(q.x, 0.5 * sy, q.y); nrm = normalize(Y) * sy; }
  return X * l.x + Y * l.y + Z * l.z;
}`;

  // ---------------------------------------------------------------- the slide library (one instanced draw)
  const NW = NSL.reduce((s, n) => s + n, 0);
  const wallGeo = boxGeo(new THREE.InstancedBufferGeometry());
  const aW = new Float32Array(NW * 4), aWR = new Float32Array(NW * 4);
  { const r = rng(4242); let o = 0;
    TT.forEach((row, ti) => {
      const n = NSL[ti], cols = WCOLS[ti], occ = new Int16Array(NR), ages = [];
      for (let k = 0; k < n; k++) { let u = r(), b = 0; while (b < 4 && u > AGEB[b]) { u -= AGEB[b]; b++; } ages.push(AGES[0] + 10 * b + 10 * r()); }
      ages.sort((a, b) => a - b);
      const vi = varOf(row[5]);
      for (const a of ages) {
        let rw = clamp(Math.floor((a - AGES[0]) / (AGES[1] - AGES[0]) * NR), 0, NR - 1);
        for (let s = 0; s < NR * 2 && occ[rw] >= cols; s++) { const t = rw + (s % 2 ? -1 : 1) * Math.ceil((s + 1) / 2); if (t >= 0 && t < NR && occ[t] < cols) { rw = t; break; } }
        const c = occ[rw]++, u = WST[ti] + c + 0.5, th = uTh(u), y = rowY(rw);
        aW.set([th, y, ti, vi + (r() < 0.5 ? 0 : 8)], o * 4);
        aWR.set([r(), 0.42 * Math.abs(th) / TH + 0.12 * rw / NR + 0.1 * r(), r(), a], o * 4);
        o++;
      }
    });
    wallGeo.setAttribute('aW', new THREE.InstancedBufferAttribute(aW, 4));
    wallGeo.setAttribute('aR', new THREE.InstancedBufferAttribute(aWR, 4));
    wallGeo.instanceCount = NW;
    wallGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 3);
  }
  // per tissue: eosin colour and nuclear density, from its domains
  const TIS = TT.map((row, ti) => { let c = [0, 0, 0], nu = 0, w = 0; REC[ti].forEach(d => { const h = heOf(d.name), k = d.f20; c = K.v3.add(c, K.v3.mul(K.rgb(h[0]), k)); nu += h[1] * k; w += k; });
    c = K.v3.mul(c, 1 / w); return new THREE.Vector4(c[0], c[1], c[2], nu / w); });
  const slideTex = slideTexture();
  const wallMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uLib: { value: 1 }, uVis: { value: 1 }, uTex: { value: slideTex }, uTis: { value: TIS },
      uSW: { value: (WR * 2 * TH / U) * 0.8 }, uSH: { value: WH / RT * 0.88 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, extensions: { derivatives: true },
    vertexShader: BOXGL + `
attribute vec4 aW, aR;
uniform float uLib, uVis, uA, uTime, uSW, uSH;
uniform vec4 uTis[${NT}];
varying vec2 vUv, vCell; varying vec4 vT; varying float vA, vGl, vFace; varying vec3 vN, vV;
void main() {
  float th = aW.x, y = aW.y;
  vec3 home = vec3(${WR.toFixed(3)} * sin(th), y, ${WC.toFixed(3)} - ${WR.toFixed(3)} * cos(th));
  vec3 src = vec3(home.x * 0.22, y * 0.4, ${(WC - 0.15).toFixed(3)});
  float k = clamp((uLib * 1.45 - aR.y) / 0.45, 0.0, 1.0); k = k * k * (3.0 - 2.0 * k);
  vec3 c = mix(src, home, k);
  c.y += sin(k * 3.14159) * 0.16 * (aR.x - 0.35);
  float ang = (1.0 - k) * (aR.z * 7.0 - 3.5), ca = cos(ang), sa = sin(ang), sc = mix(0.3, 1.0, k);
  float fl = aW.w > 7.5 ? -1.0 : 1.0;
  // a glass slide: its broad face in the wall's surface (turned in its plane while it flies), a little thickness
  vec3 rgt = vec3(cos(th), 0.0, sin(th)), up = vec3(0.0, 1.0, 0.0), nw = vec3(-sin(th), 0.0, cos(th));
  // (each slide a little askew in its place, so the light glints off the glass here and there, as off a real rack)
  float ty = (aR.x - 0.5) * 0.36 * k, tx = (fract(aR.z * 7.3) - 0.5) * 0.22 * k, cy = cos(ty), sy = sin(ty), cx = cos(tx), sx = sin(tx);
  vec3 r2 = rgt * cy + nw * sy, n2 = -rgt * sy + nw * cy; up = vec3(0.0, cx, 0.0) + n2 * sx; nw = n2 * cx - vec3(0.0, sx, 0.0); rgt = r2;
  vec3 X = (rgt * uSW * ca + up * uSH * sa) * sc, Y = (-rgt * uSW * sa + up * uSH * ca) * sc, Z = nw * uSW * 0.16 * sc;
  vec3 nrm; vec2 fuv;
  vec3 p = c + boxAt(position, c, X, Y, Z, nrm, fuv);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vN = normalize(normalMatrix * nrm); vV = -mv.xyz; vFace = position.z;
  float vi = mod(aW.w, 8.0);
  vUv = fuv; vCell = vec2(mod(vi, 4.0), floor(vi / 4.0));
  vUv.x = fl > 0.0 ? vUv.x : 1.0 - vUv.x;
  vT = uTis[int(aW.z + 0.5)];
  vA = uA * uVis * smoothstep(0.0, 0.25, k);
  vGl = pow(max(0.0, cos(th * 1.6 - y * 2.0 + uTime * 0.35 + aR.x * 0.5)), 160.0) * 0.6 * k + step(0.9985, fract(aR.z * 37.0 + uTime * 0.07)) * 0.6 * k;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform sampler2D uTex;
varying vec2 vUv, vCell; varying vec4 vT; varying float vA, vGl, vFace; varying vec3 vN, vV;
void main() {
  vec3 n = normalize(vN), v = normalize(vV), L = normalize(vec3(-0.45, 0.6, 0.65));
  float df = max(dot(n, L), 0.0), fr = pow(1.0 - abs(dot(n, v)), 3.0), sp = pow(max(dot(reflect(-L, n), v), 0.0), 40.0);
  vec3 glass = vec3(0.55, 0.72, 0.86);
  // (from afar, where a slide is a few pixels across, its rim and edges would be all that shows, as grey dashes: there
  // it fades to its stained tissue on the glass, so the wall reads as rows of slides in the tissues' own colours)
  float far = smoothstep(0.1, 0.34, fwidth(vUv.x));
  // the glass's edges: green-blue glass, bright where the light catches it
  if (vFace > 0.5) { gl_FragColor = vec4(glass * (0.3 + 0.5 * df) + vec3(sp * 0.6), (0.18 + 0.35 * fr + 0.4 * sp) * vA * (1.0 - 0.8 * far)); return; }
  vec2 tc = vec2((vCell.x + vUv.x) / 4.0, 1.0 - (vCell.y + 1.0 - vUv.y) / 2.0);
  vec4 tx = texture2D(uTex, tc);
  // the tissue lies on the glass as a thin slab: lit, with its shadow on the glass beside it
  float shd = texture2D(uTex, tc + vec2(-0.006, 0.006)).r;
  float tis = tx.r, nuc = tx.g * tis * 1.7, lab = tx.b;
  vec3 col = mix(vT.rgb, vec3(0.30, 0.24, 0.58), clamp(nuc * (0.25 + vT.a * 1.4), 0.0, 0.92));
  vec2 e = min(vUv, 1.0 - vUv); float rim = 1.0 - smoothstep(0.0, 0.07, min(e.x, e.y * 0.4));
  float ts = smoothstep(0.0, 0.45, tis);
  float a = max(0.06 + 0.24 * rim + 0.18 * shd * (1.0 - ts), ts * 0.97);
  col = mix(glass * (1.0 - 0.45 * shd), col * (0.72 + 0.4 * df), ts);
  col = mix(col, vec3(0.86, 0.9, 0.96), lab * 0.45 * (1.0 - ts)); a = max(a, lab * 0.32);
  // (afar: the slide's mean look, its tissue's colour over a little glass, lit)
  float cov = clamp(tis * 2.6, 0.0, 1.0);
  col = mix(col, mix(glass * 0.45, mix(vT.rgb, vec3(0.30, 0.24, 0.58), 0.25 * vT.a) * (0.72 + 0.42 * df), 0.35 + 0.65 * cov), far);
  a = mix(a, 0.42 + 0.5 * cov, far); rim *= 1.0 - far;
  col += glass * (vGl * (0.45 + rim) + 0.12 * fr) + vec3(sp * 0.35);
  gl_FragColor = vec4(col, min(1.0, a + vGl * 0.3 + sp * 0.25) * vA);
}`,
  });
  set.mats.push(wallMat);
  const wall = new THREE.Mesh(wallGeo, wallMat); wall.frustumCulled = false; wall.renderOrder = 1; set.group.add(wall);

  // the rack the slides stand in: a dark back panel, a shelf at every decade of age and a post between tissues, lit, so
  // the wall reads as a curved cabinet in depth (from afar too, where single slides are a few pixels); it stands first
  // as the library opens, and fades with the wall
  const rackGeo = new THREE.BufferGeometry();
  {
    const P = [], N = [], E = [], I = [], th0 = uTh(-GAP / 2), th1 = uTh(U + GAP / 2), SEG = 120;
    const r0 = WR - 0.02, r1 = WR + 0.016, yB = shelfY(0), yT = shelfY(5);
    const at = (r, th, y) => [r * Math.sin(th), y, WC - r * Math.cos(th)], inw = th => [-Math.sin(th), 0, Math.cos(th)];
    // a quad from four corners (a, b along one way, then c, d back), its normal and the edge glow's coordinate per corner
    const quad = (a, b, c, d, n, e) => { const v = P.length / 3; for (const q of [a, b, c, d]) P.push(...q); for (let k = 0; k < 4; k++) N.push(...(Array.isArray(n[0]) ? n[k] : n)); E.push(...e); I.push(v, v + 1, v + 2, v, v + 2, v + 3); };
    // the shelves (the top one and the bottom one a little deeper): top, front lip, underside
    for (let k = 0; k <= 5; k++) {
      const y = shelfY(k), h = k % 5 ? 0.0034 : 0.006, rf = r0 - (k % 5 ? 0 : 0.006);
      for (let sg = 0; sg < SEG; sg++) {
        const a = lerp(th0, th1, sg / SEG), b = lerp(th0, th1, (sg + 1) / SEG), na = inw(a), nb = inw(b);
        quad(at(rf, a, y + h), at(rf, b, y + h), at(r1, b, y + h), at(r1, a, y + h), [0, 1, 0], [1, 1, 0, 0]);
        quad(at(rf, a, y - h), at(rf, b, y - h), at(rf, b, y + h), at(rf, a, y + h), [na, nb, nb, na], [0.8, 0.8, 1, 1]);
        quad(at(r1, a, y - h), at(r1, b, y - h), at(rf, b, y - h), at(rf, a, y - h), [0, -1, 0], [0, 0, 0, 0]);
      }
    }
    // the posts between tissues (and at both ends): front and both sides
    const posts = [th0, th1];
    for (let i = 1; i < NT; i++) posts.push(uTh(WST[i] - GAP / 2));
    for (const th of posts) {
      const w = 0.0016 / WR, a = th - w, b = th + w, na = inw(a), sa = [Math.cos(th), 0, Math.sin(th)], sb = sa.map(v => -v);
      quad(at(r0, a, yB), at(r0, b, yB), at(r0, b, yT), at(r0, a, yT), [na, na, na, na], [-0.2, -0.2, -0.2, -0.2]);
      quad(at(r1, a, yB), at(r0, a, yB), at(r0, a, yT), at(r1, a, yT), sb, [-0.4, -0.4, -0.4, -0.4]);
      quad(at(r0, b, yB), at(r1, b, yB), at(r1, b, yT), at(r0, b, yT), sa, [-0.4, -0.4, -0.4, -0.4]);
    }
    // the back panel
    for (let sg = 0; sg < SEG; sg++) {
      const a = lerp(th0, th1, sg / SEG), b = lerp(th0, th1, (sg + 1) / SEG), na = inw(a), nb = inw(b);
      quad(at(r1, a, yB), at(r1, b, yB), at(r1, b, yT), at(r1, a, yT), [na, nb, nb, na], [-1, -1, -1, -1]);
    }
    rackGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    rackGeo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    rackGeo.setAttribute('aE', new THREE.Float32BufferAttribute(E, 1));
    rackGeo.setIndex(I);
  }
  const rackMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uK: { value: 1 } },
    transparent: true, depthWrite: true, side: THREE.DoubleSide,
    vertexShader: `
attribute float aE;
varying vec3 vN, vV, vW; varying float vE;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz; vE = aE; vW = position;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `
uniform float uA, uK;
varying vec3 vN, vV, vW; varying float vE;
void main() {
  float a = uA * uK;
  if (a < 0.004) discard;
  vec3 n = normalize(vN), v = normalize(vV), L = normalize(vec3(-0.45, 0.6, 0.65));
  if (dot(n, v) < 0.0) n = -n;
  float df = max(dot(n, L), 0.0), fr = pow(1.0 - max(dot(n, v), 0.0), 3.0), sp = pow(max(dot(reflect(-L, n), v), 0.0), 30.0);
  // the back panel: deep blue, a soft light pooled in its middle; shelves and posts: blue-grey metal with a bright lip
  if (vE < -0.5) {
    float pool = exp(-pow(vW.x / 1.1, 2.0) - pow(vW.y / 0.7, 2.0));
    gl_FragColor = vec4(vec3(0.02, 0.045, 0.085) * (0.6 + 0.6 * df) + vec3(0.03, 0.06, 0.1) * pool, a);
    return;
  }
  // (vE: 1 at a shelf's lip, 0 at its back; below 0 a post: a little darker, no lip)
  float lip = smoothstep(0.75, 1.0, vE), post = step(vE, -0.1);
  vec3 base = vec3(0.16, 0.22, 0.32) * (1.0 - 0.35 * post);
  vec3 col = base * (0.25 + 0.95 * df) + vec3(0.55, 0.7, 0.9) * (fr * 0.25 + sp * 0.5 + lip * (0.18 + 0.3 * df));
  gl_FragColor = vec4(col, a);
}`,
  });
  set.mats.push(rackMat);
  const rack = new THREE.Mesh(rackGeo, rackMat); rack.frustumCulled = false; rack.renderOrder = 0; rack.raycast = () => {}; set.group.add(rack);

  // ---------------------------------------------------------------- the sections' tiles = the cloud's points
  const NTILE = SEC.reduce((s, q) => s + q.N, 0), exSet0 = new Set(exT.filter(i => i >= 0));
  const tileGeo = boxGeo(new THREE.InstancedBufferGeometry());
  // each domain stands at its own height on the section (in tile sizes, by its kind of tissue), so a section is a slab
  // in relief: linings and glands high, muscle middling, connective tissue and fat low, spaces lowest (illustrative)
  const RELIEF = { 'lining epithelium': 1.0, 'glandular tissue': 0.9, 'lymphoid structure': 0.85, 'skeletal muscle': 0.72, 'cardiac muscle': 0.72, 'smooth muscle': 0.66,
    'neuronal tissue': 0.6, 'vascular tissue': 0.56, 'connective tissue': 0.42, 'adipose tissue': 0.3, other: 0.34 };
  const reliefOf = nm => (/space|cyst|lumen/.test(nm) ? 0.16 : RELIEF[typeOf(nm)] || 0.4);
  const aT = new Float32Array(NTILE * 4), aU = new Float32Array(NTILE * 3), aCA = new Float32Array(NTILE * 3), aCB = new Float32Array(NTILE * 3),
    aH = new Float32Array(NTILE * 3), aM = new Float32Array(NTILE * 4), aRH = new Float32Array(NTILE * 2);
  { const r = rng(77); let o = 0;
    SEC.forEach((s, ti) => { const doms = REC[ti];
      for (let j = 0; j < s.N; j++, o++) {
        const dA = doms[s.d0[j]], dB = doms[s.d1[j]];
        aT.set([s.x[j], s.y[j], ti, s.cell], o * 4);
        aRH.set([reliefOf(dA.name), reliefOf(dB.name)], o * 2);
        aCA.set(K.rgb(domainColour(dA.name)), o * 3); aCB.set(K.rgb(domainColour(dB.name)), o * 3);
        const he = heOf(dA.name), base = K.rgb(he[0]), nu = clamp(he[1] * (0.3 + 1.1 * r()) + (r() < he[1] * 0.35 ? 0.4 : 0), 0, 0.9), lum = 0.92 + 0.12 * r();
        aH.set(K.v3.mul(K.v3.lerp(base, HAE, nu), lum), o * 3);
        // the cloud: a shared domain's tiles stretch from its cluster towards their own tissue (bridges)
        const ts = DT[dA.name], c = DC[dA.name];
        let p;
        if (ts.length > 1) { const b = 0.75 * Math.pow(r(), 2.2), sg = Math.min(0.075, 0.03 + 0.01 * Math.sqrt(ts.length)); p = K.v3.add(K.v3.lerp(c, HOME[ti], b), [gauss(r) * sg, gauss(r) * sg, gauss(r) * sg]); }
        else { const sg = 0.045; p = K.v3.add(c, [gauss(r) * sg * 1.2, gauss(r) * sg * 0.8, gauss(r) * sg]); }
        aU.set(p, o * 3);
        const exw = !exSet0.has(ti) ? 0 : dA.ex !== undefined || dB.ex !== undefined ? 1 : 0.5;   // in an example's section: its domain or the rest
        aM.set([s.flip[j], r(), 0.15 * Math.hypot(GRID[ti].p[0], GRID[ti].p[1]) + 0.45 * r(), exw], o * 4);
      } });
    tileGeo.setAttribute('aT', new THREE.InstancedBufferAttribute(aT, 4)); tileGeo.setAttribute('aU', new THREE.InstancedBufferAttribute(aU, 3));
    tileGeo.setAttribute('aCA', new THREE.InstancedBufferAttribute(aCA, 3)); tileGeo.setAttribute('aCB', new THREE.InstancedBufferAttribute(aCB, 3));
    tileGeo.setAttribute('aH', new THREE.InstancedBufferAttribute(aH, 3)); tileGeo.setAttribute('aM', new THREE.InstancedBufferAttribute(aM, 4));
    tileGeo.setAttribute('aRH', new THREE.InstancedBufferAttribute(aRH, 2));
    tileGeo.instanceCount = NTILE; tileGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 3);
  }
  // per section: uP = centre and size, uQ = yaw, alpha, domain colours (0 H&E, 1 domains), focus
  const uP = TT.map(() => new THREE.Vector4(0, 0, 0, S0)), uQ = TT.map(() => new THREE.Vector4(0, 0, 0, 0));
  const SECU = { uP: { value: uP }, uQ: { value: uQ } };
  const tileMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA, uUm: { value: 0 }, uAge: { value: 0 }, uCA: { value: 1 }, uCR: { value: 0 }, uFoc: { value: 0 }, uHero: { value: -1 },
      uPt: { value: 0.015 }, uCC: { value: new THREE.Vector3(0, 0.05, 0.08) }, uCS: { value: 1 } }, SECU),
    transparent: true, depthWrite: true, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: BOXGL + `
attribute vec4 aT, aM; attribute vec3 aU, aCA, aCB, aH; attribute vec2 aRH;
uniform vec4 uP[${NT}], uQ[${NT}];
uniform float uA, uUm, uAge, uCA, uCR, uFoc, uPt, uCS, uHero; uniform vec3 uCC;
varying vec3 vC, vN, vV; varying float vA, vK, vTop; varying vec2 vQ;
void main() {
  int ti = int(aT.z + 0.5);
  vec4 P = uP[ti], Q = uQ[ti];
  float c = cos(Q.x), s = sin(Q.x);
  vec3 sp = P.xyz + vec3(aT.x * c, aT.y, -aT.x * s) * P.w;
  float k = clamp((uUm * 1.7 - aM.z) / 0.6, 0.0, 1.0); k = k * k * (3.0 - 2.0 * k);
  float cr = cos(uCR), sr = sin(uCR);
  vec3 up = uCC + vec3(aU.x * cr + aU.z * sr, aU.y, -aU.x * sr + aU.z * cr) * uCS;
  float f = smoothstep(aM.x - 0.035, aM.x + 0.035, uAge);
  // a tile on its section: a box standing on the plate, as tall as its domain's relief; in the cloud, a small cube
  // (a focused section stands in deeper relief: a terrain of its domains)
  float cs = aT.w * P.w * 0.94, hs = mix(aRH.x, aRH.y, f) * cs * (0.85 + 0.3 * aM.y) * (1.0 + 2.4 * Q.w * (1.0 - k)), cc = uPt * (0.75 + 0.5 * aM.y);
  vec3 Xs = vec3(c, 0.0, -s) * cs, Ys = vec3(0.0, cs, 0.0), Zs = vec3(s, 0.0, c) * hs;
  vec3 X = mix(Xs, vec3(cc, 0.0, 0.0), k), Y = mix(Ys, vec3(0.0, cc, 0.0), k), Z = mix(Zs, vec3(0.0, 0.0, cc), k);
  vec3 p = mix(sp + Zs * 0.5, up, k);
  p.y += sin(k * 3.14159) * (0.1 + 0.25 * aM.y);
  vec3 nrm; vec2 fuv;
  vec4 mv = modelViewMatrix * vec4(p + boxAt(position, p, X, Y, Z, nrm, fuv), 1.0);
  gl_Position = projectionMatrix * mv;
  vN = normalize(normalMatrix * nrm); vV = -mv.xyz; vTop = 1.0 - step(0.5, position.z);
  float gl = aM.x < 1.5 ? clamp(1.0 - abs(uAge - aM.x) * 14.0, 0.0, 1.0) * 0.8 : 0.0;
  float ex = aM.w > 0.25 && aM.w < 0.75 ? 1.0 - 0.5 * Q.w * (1.0 - k) : 1.0 + 0.15 * step(0.75, aM.w) * Q.w;   // a focused example: its domain stands out
  vC = (mix(aH, mix(aCA, aCB, f), max(Q.z, k)) * (1.0 + 0.1 * Q.w) + gl * vec3(0.7)) * ex;
  vA = uA * mix(Q.y, 0.88 * uCA * (1.0 - 0.85 * uFoc * (1.0 - Q.w)), k);
  vK = k; vQ = fuv * 2.0 - 1.0;
#ifdef HERO
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
#else
  if (vA < 0.004 || abs(aT.z - uHero) < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
#endif
}`,
    fragmentShader: `
varying vec3 vC, vN, vV; varying float vA, vK, vTop; varying vec2 vQ;
void main() {
  float a = vA;
  if (a < 0.003) discard;
  vec3 n = normalize(vN), v = normalize(vV), L = normalize(vec3(-0.45, 0.6, 0.65));
  if (dot(n, v) < 0.0) n = -n;
  float df = max(dot(n, L), 0.0), fr = pow(1.0 - max(dot(n, v), 0.0), 2.5);
  // lit faces; the tops bright and bevelled at their edges, the sides darker and darker still towards their foot (where
  // a step of the relief meets the lower tiles), so the relief reads; in the cloud a soft glow of their own
  float e = 1.0 - smoothstep(0.7, 1.0, max(abs(vQ.x), abs(vQ.y)));
  float side = mix(0.42 + 0.26 * (vQ.y * 0.5 + 0.5), 0.8, vK);
  vec3 col = vC * (0.42 + 0.7 * df) * mix(side, 1.06, vTop) * mix(1.0, mix(0.8, 1.0, e), vTop) + vC * fr * 0.35 + vC * vK * 0.35;
  gl_FragColor = vec4(col * a, a);
}`,
  });
  set.mats.push(tileMat);
  const tiles = new THREE.Mesh(tileGeo, tileMat); tiles.frustumCulled = false; tiles.renderOrder = 3; set.group.add(tiles);
  // the focused section drawn again on its own, writing depth, so its relief is right from every side (the main draw
  // writes none while a section is focused or a plot shows: the dimmed sections must not hide what is in front of them,
  // and leaves the focused one out). A small geometry of views into the main arrays (a section's tiles are contiguous),
  // made again when another section is focused (the old one freed)
  const heroMat = new THREE.ShaderMaterial({ uniforms: tileMat.uniforms, vertexShader: tileMat.vertexShader, fragmentShader: tileMat.fragmentShader,
    defines: { HERO: 1 }, transparent: true, depthWrite: true, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  set.mats.push(heroMat);
  const T0 = []; { let o = 0; SEC.forEach(q => { T0.push(o); o += q.N; }); }
  const heroGeo = ti => {
    const g = boxGeo(new THREE.InstancedBufferGeometry()), o = T0[ti], n = SEC[ti].N;
    for (const k of ['aT', 'aU', 'aCA', 'aCB', 'aH', 'aM', 'aRH']) { const at = tileGeo.attributes[k], w = at.itemSize; g.setAttribute(k, new THREE.InstancedBufferAttribute(at.array.subarray(o * w, (o + n) * w), w)); }
    g.instanceCount = n; g.boundingSphere = tileGeo.boundingSphere;
    return g;
  };
  let heroI = 0;
  const hero = new THREE.Mesh(heroGeo(0), heroMat); hero.frustumCulled = false; hero.renderOrder = 3; hero.visible = false; set.group.add(hero);

  // plates behind the sections and their captions (one instanced draw: 40 plates, 40 captions)
  // (each plate a slab of dark glass with a lit edge, a box as three faces; a caption is only a face)
  const capGeo = boxGeo(new THREE.InstancedBufferGeometry());
  { const aI = new Float32Array(NT * 2 * 4);
    for (let i = 0; i < NT; i++) { aI.set([i, 0, 0, 0], i * 4); aI.set([i, 1, (i % 2) * 0.5, 1 - (Math.floor(i / 2) + 1) * 48 / 1024], (NT + i) * 4); }
    capGeo.setAttribute('aI', new THREE.InstancedBufferAttribute(aI, 4)); capGeo.instanceCount = NT * 2; capGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3); }
  const capMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA, uTex: { value: captionTexture() }, uUm: { value: 0 } }, SECU),
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: BOXGL + `
attribute vec4 aI; uniform vec4 uP[${NT}], uQ[${NT}]; uniform float uA, uUm;
varying vec2 vUv, vL; varying float vA, vKind, vF, vSide; varying vec3 vN, vV;
void main() {
  vec4 P = uP[int(aI.x + 0.5)], Q = uQ[int(aI.x + 0.5)];
  float c = cos(Q.x), s = sin(Q.x), cap = step(0.5, aI.y), th = 0.075 * (1.0 - cap);
  vec2 sz = cap > 0.5 ? vec2(2.1, 0.39) : vec2(2.3, 2.62);
  vec3 l = vec3(0.0, cap > 0.5 ? -1.2 : -0.13, cap > 0.5 ? 0.01 : -0.02 - 0.5 * th);
  vec3 C = P.xyz + vec3(l.x * c + l.z * s, l.y, -l.x * s + l.z * c) * P.w;
  vec3 X = vec3(c, 0.0, -s) * sz.x * P.w, Y = vec3(0.0, sz.y * P.w, 0.0), Z = vec3(s, 0.0, c) * max(th, 1e-4) * P.w, nrm; vec2 fuv;
  vec4 mv = modelViewMatrix * vec4(C + boxAt(position, C, X, Y, Z, nrm, fuv), 1.0);
  gl_Position = projectionMatrix * mv;
  vN = normalize(normalMatrix * nrm); vV = -mv.xyz; vSide = step(0.5, position.z);
  vUv = aI.zw + fuv * vec2(0.5, 48.0 / 1024.0); vL = (fuv - 0.5) * sz; vKind = aI.y; vF = Q.w;
  vA = uA * Q.y * (1.0 - uUm);
  // (a caption is not drawn from behind: it would read mirrored)
  float back = step(dot(cameraPosition - (modelMatrix * vec4(C, 1.0)).xyz, mat3(modelMatrix) * vec3(s, 0.0, c)), 0.0);
  if (vA < 0.004 || (cap > 0.5 && (vSide > 0.5 || back > 0.5))) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform sampler2D uTex; varying vec2 vUv, vL; varying float vA, vKind, vF, vSide; varying vec3 vN, vV;
void main() {
  if (vKind > 0.5) { vec4 t = texture2D(uTex, vUv); gl_FragColor = vec4(t.rgb, t.a * vA * 0.95); return; }
  vec3 n = normalize(vN), v = normalize(vV), L = normalize(vec3(-0.45, 0.6, 0.65));
  if (dot(n, v) < 0.0) n = -n;
  float df = max(dot(n, L), 0.0), fr = pow(1.0 - max(dot(n, v), 0.0), 2.5);
  vec3 rimC = mix(vec3(0.35, 0.45, 0.6), vec3(1.0, 0.62, 0.8), vF);
  // the slab's edges: dark glass lit from the side, its rim colour catching the light
  if (vSide > 0.5) { gl_FragColor = vec4(vec3(0.03, 0.06, 0.11) * (0.6 + 0.9 * df) + rimC * (0.25 + 0.45 * df + 0.3 * fr), min(1.0, 0.75 + 0.2 * vF) * vA); return; }
  vec2 h = vec2(1.15, 1.31), q = abs(vL) - h + 0.05; float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.05;
  if (d > 0.0) discard;
  float rim = smoothstep(-0.035, 0.0, d);
  // its face: dark, a little sheen across it from the light
  float sheen = 0.5 + 0.5 * dot(vL / max(length(vL), 1e-3), vec2(-0.6, 0.8));
  vec3 col = mix(vec3(0.025, 0.05, 0.09) * (0.8 + 0.5 * sheen), rimC, rim);
  gl_FragColor = vec4(col, min(1.0, 0.6 + 0.33 * vF + 0.35 * rim) * vA);
}`,
  });
  set.mats.push(capMat);
  const caps = new THREE.Mesh(capGeo, capMat); caps.frustumCulled = false; caps.renderOrder = 2; set.group.add(caps);

  // ---------------------------------------------------------------- each section's organ: a small 3D model (ORGAN3D)
  // floating at its plate's top left corner, turning slowly; the models build between frames (the network set does it
  // while hidden, or a slice a frame here); until they are ready the plates have none
  const O3 = typeof ORGAN3D !== 'undefined' ? ORGAN3D : null;
  const mP = TT.map(() => new THREE.Vector4()), mQ = TT.map(() => new THREE.Vector4());
  let orgMesh = null;
  function buildOrgans() {
    if (orgMesh || !O3 || !O3.ready()) return;
    const M = O3.merged(ORGAN.map(o => O3.idOf(o) || 'stomach'), { lite: true }), g = new THREE.BufferGeometry();   // (small on screen: the lighter copies)
    g.setAttribute('position', new THREE.BufferAttribute(M.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(M.nrm, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(M.col, 3)); g.setAttribute('aSlot', new THREE.BufferAttribute(M.slot, 1)); g.setIndex(new THREE.BufferAttribute(M.idx, 1));
    const sh = O3.shader(NT);
    const m = new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uP: { value: mP }, uQ: { value: mQ }, uTint: { value: new THREE.Color(1, 1, 1) } },
      vertexShader: sh.vertex, fragmentShader: sh.fragment, transparent: true });
    set.mats.push(m);
    orgMesh = new THREE.Mesh(g, m); orgMesh.frustumCulled = false; orgMesh.renderOrder = 4; orgMesh.raycast = () => {};
    set.group.add(orgMesh);
  }

  // ---------------------------------------------------------------- the volcano
  const VS = { x: 0.24, y0: -0.52, y: 0.05 };
  const vg = new THREE.Group(); set.group.add(vg);
  let VOL = [], volFromFig = false;
  { const r = rng(515);
    if (VP.length) { volFromFig = true;
      VP.forEach(p => VOL.push({ name: canon(p.domain), tissue: p.tissue || '', x: +p.x, y: +p.y, sig: p.significant !== false }));
      const us = FIG.volcano.unlabelledSignificant; if (us && Array.isArray(us.points)) us.points.forEach(p => VOL.push({ name: '', tissue: '', x: +p.x, y: +p.y, sig: true }));
    }
    // the examples (the preprint's): where the figure has them, as drawn; else at their slope and a typical height
    EX.forEach((e, k) => { const nm = canon(e.domain); let p = VOL.find(q => q.name === nm && (exT[k] < 0 || tissueIx(q.tissue) === exT[k]));
      if (!p) { p = { name: nm, tissue: exT[k] >= 0 ? NAMES[exT[k]] : '', x: +e.perDecade, y: [16, 14.5, 6.6][k] || 8, sig: true }; VOL.push(p); }
      p.ex = k; });
    // the rest of the 128 domain-tissue pairs: dim, unlabelled, illustrative (the talk draws them small and overlapping)
    const total = (F.agePairs && F.agePairs[1]) || 128, big = [[2.51, 0.77], [1.76, 1.13], [1.54, 0.3], [-1.18, 1.02], [1.07, 1.55], [-0.74, 0.78], [-0.56, 2.95]];
    for (const b of big) if (VOL.length < total) VOL.push({ name: '', x: b[0], y: b[1], sig: false });
    while (VOL.length < total) VOL.push({ name: '', x: clamp(0.15 + gauss(r) * 0.55, -1.6, 2.4), y: Math.min(2.8, Math.abs(gauss(r)) * 0.9), sig: false });
    VOL.forEach(p => { p.z = (r() - 0.5) * 0.3; p.pos = [p.x * VS.x, VS.y0 + p.y * VS.y, p.z]; p.rad = 0.011 + 0.0075 * Math.min(3.5, Math.max(0.6, Math.abs(p.x))); p.delay = 0.15 + 0.5 * r(); });
  }
  const NV = VOL.length;
  const volGeo = new THREE.IcosahedronGeometry(1, 2);
  { const col = new Float32Array(NV * 3), av = new Float32Array(NV * 4);
    const warm = [[0, K.rgb('#ffc8b0')], [1, K.rgb('#ff9a6a')], [2, K.rgb('#ff6a4b')], [3.5, K.rgb('#ff3b3b')]], cool = [[0, K.rgb('#c4d8ff')], [1, K.rgb('#7fb0ff')], [2, K.rgb('#4f86ff')]];
    VOL.forEach((p, i) => { p.col = K.ramp(p.x >= 0 ? warm : cool, Math.abs(p.x)); col.set(p.col, i * 3); av.set([p.delay, p.sig ? 1 : 0, p.ex !== undefined ? 1 : 0, 0], i * 4); });
    volGeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(col, 3)); volGeo.setAttribute('aV', new THREE.InstancedBufferAttribute(av, 4)); }
  const volMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uRev: { value: 0 }, uSig: { value: 0 } },
    transparent: true, depthWrite: false,
    vertexShader: `
attribute vec3 aCol; attribute vec4 aV; uniform float uA, uRev, uSig;
varying vec3 vN, vV, vC; varying float vAl;
void main() {
  float g = clamp((uRev - aV.x) / 0.14, 0.0, 1.0); g = g * g * (3.0 - 2.0 * g);
  vec4 p = instanceMatrix * vec4(position * g * (1.0 + 0.35 * aV.z), 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  vec4 mv = modelViewMatrix * p; vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
  float on = aV.y * uSig;
  vC = mix(vec3(0.36, 0.42, 0.5), aCol, on);
  vAl = uA * mix(0.4, 1.0, on) * step(0.001, g);
}`,
    fragmentShader: `
varying vec3 vN, vV, vC; varying float vAl;
void main() {
  vec3 n = normalize(vN), v = normalize(vV), L = normalize(vec3(-0.4, 0.6, 0.7));
  float l = max(dot(n, L), 0.0), rim = pow(1.0 - max(dot(n, v), 0.0), 2.0), sp = pow(max(dot(reflect(-L, n), v), 0.0), 24.0);
  gl_FragColor = vec4(vC * (0.4 + 0.7 * l) + vC * rim * 0.7 + vec3(sp * 0.35), vAl);
}`,
  });
  set.mats.push(volMat);
  const vol = new THREE.InstancedMesh(volGeo, volMat, NV);
  { const m = new THREE.Matrix4(); VOL.forEach((p, i) => { m.makeScale(p.rad, p.rad, p.rad); m.setPosition(p.pos[0], p.pos[1], p.pos[2]); vol.setMatrixAt(i, m); }); }
  vol.frustumCulled = false; vol.renderOrder = 5; vg.add(vol);
  // axes, grid and the significance plane
  const XM = 3.8 * VS.x, YT = VS.y0 + 21 * VS.y, ZB = -0.2, ZF = 0.2;
  { const segs = [], add = (a, b, c, al, t) => segs.push([a, b, c, al, t]);
    const ink = K.rgb('#9fb0c6'), dim = K.rgb('#5a6b82'), amb = K.rgb('#ffb43b');
    add([-XM, VS.y0, ZF], [XM, VS.y0, ZF], ink, 0.8, 0); add([-XM, VS.y0, ZB], [XM, VS.y0, ZB], dim, 0.5, 0);
    add([-XM, VS.y0, ZB], [-XM, YT, ZB], ink, 0.6, 0.1);
    for (let x = -3; x <= 3; x++) { const X = x * VS.x; add([X, VS.y0, ZF], [X, VS.y0 - 0.02, ZF + 0.02], ink, 0.8, 0.1); add([X, VS.y0, ZB], [X, YT, ZB], dim, x ? 0.18 : 0, 0.2); add([X, VS.y0, ZB], [X, VS.y0, ZF], dim, 0.18, 0.2); }
    for (let y = 0; y <= 20; y += 5) { const Y = VS.y0 + y * VS.y; add([-XM, Y, ZB], [XM, Y, ZB], dim, y ? 0.16 : 0, 0.3); add([-XM, Y, ZB], [-XM - 0.02, Y, ZB], ink, 0.8, 0.3); }
    for (let y = 0; y < 21; y += 0.6) add([0, VS.y0 + y * VS.y, ZB], [0, VS.y0 + (y + 0.3) * VS.y, ZB], ink, 0.45, 0.4);   // the zero line, dashed
    const Ys = VS.y0 + 3 * VS.y;
    add([-XM, Ys, ZF], [XM, Ys, ZF], amb, 0.9, 0.6); add([-XM, Ys, ZB], [XM, Ys, ZB], amb, 0.6, 0.6); add([-XM, Ys, ZB], [-XM, Ys, ZF], amb, 0.6, 0.6); add([XM, Ys, ZB], [XM, Ys, ZF], amb, 0.6, 0.6);
    const g = K.linesGeo(segs.length), P = g.attributes.position.array, C = g.attributes.aCol.array, A = g.attributes.aA.array, T = g.attributes.aT.array;
    segs.forEach((s, i) => { P.set(s[0], i * 6); P.set(s[1], i * 6 + 3); C.set(s[2], i * 6); C.set(s[2], i * 6 + 3); A[i * 2] = A[i * 2 + 1] = s[3]; T[i * 2] = T[i * 2 + 1] = s[4]; });
    const L = new THREE.LineSegments(g, K.lines(set)); L.renderOrder = 4; vg.add(L); vg.userData.lines = L;
    const pm = K.fade(set, new THREE.MeshBasicMaterial({ color: 0xffb43b, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }), 0.07);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2 * XM, ZF - ZB), pm); pl.rotation.x = -PI / 2; pl.position.set(0, Ys, 0); pl.renderOrder = 4; vg.add(pl); vg.userData.plane = pl;
  }
  // the plot as an object in space: a dark glass floor under the bubbles, the two axes as lit rods, each bubble's soft
  // shadow on the floor, a thin line down to it from each significant one, and a halo round those
  {
    const floorM = K.fade(set, new THREE.MeshStandardMaterial({ color: 0x0b1626, roughness: 0.3, metalness: 0.25, transparent: true }), 0.85);
    const fl = new THREE.Mesh(new THREE.BoxGeometry(2 * XM + 0.1, 0.014, ZF - ZB + 0.1), floorM);
    fl.position.set(0, VS.y0 - 0.009, 0); fl.renderOrder = 3; vg.add(fl);
    const rodM = K.fade(set, new THREE.MeshStandardMaterial({ color: 0xa9b8cc, roughness: 0.35, metalness: 0.4, emissive: 0x16202c, transparent: true }), 1);
    const rods = K.merge([K.tube([[-XM - 0.02, VS.y0, ZF], [XM + 0.02, VS.y0, ZF]], 0.0055, 2, 10), K.tube([[-XM, VS.y0, ZB], [-XM, YT, ZB]], 0.0055, 2, 10)]);
    const rm = new THREE.Mesh(rods, rodM); rm.renderOrder = 4; vg.add(rm);
    // shadows and halos: one quad per bubble, popping in with it (the bubbles' own reveal, shared uniforms)
    const hgeo = new THREE.InstancedBufferGeometry();
    hgeo.setIndex([0, 1, 2, 0, 2, 3]);
    hgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    const hp = new Float32Array(NV * 4), hv = new Float32Array(NV * 4), hc = new Float32Array(NV * 3);
    VOL.forEach((p, i) => { hp.set([...p.pos, p.rad], 4 * i); hv.set([p.delay, p.sig ? 1 : 0, p.ex !== undefined ? 1 : 0, 0], 4 * i); hc.set(p.col, 3 * i); });
    hgeo.setAttribute('aP', new THREE.InstancedBufferAttribute(hp, 4)); hgeo.setAttribute('aV', new THREE.InstancedBufferAttribute(hv, 4)); hgeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(hc, 3));
    hgeo.instanceCount = NV; hgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    const U2 = volMat.uniforms;
    const qv = (kind) => `
attribute vec4 aP, aV; attribute vec3 aCol; uniform float uA, uRev, uSig;
varying vec2 vQ; varying vec3 vC; varying float vAl;
void main() {
  float g = clamp((uRev - aV.x) / 0.14, 0.0, 1.0); g = g * g * (3.0 - 2.0 * g);
  float on = aV.y * uSig, r = aP.w * (1.0 + 0.35 * aV.z) * g;
  vQ = position.xy; vC = aCol;
  ${kind ? `vec4 mv = modelViewMatrix * vec4(aP.xyz, 1.0); mv.xy += position.xy * r * 3.0 * length(modelViewMatrix[0].xyz);
  vAl = uA * on;` : `float hgt = aP.y - ${VS.y0.toFixed(3)};
  vec4 mv = modelViewMatrix * vec4(aP.x + position.x * r * 1.7, ${(VS.y0 + 0.0005).toFixed(4)}, aP.z + position.y * r * 1.7, 1.0);
  vAl = uA * mix(0.25, 0.6, on) / (1.0 + 5.0 * hgt);`}
  gl_Position = projectionMatrix * mv;
  if (vAl < 0.004 || g < 0.001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
    const shadowM = new THREE.ShaderMaterial({ uniforms: U2, transparent: true, depthWrite: false, vertexShader: qv(0),
      fragmentShader: 'varying vec2 vQ; varying float vAl; void main() { float d = dot(vQ, vQ); if (d > 1.0) discard; gl_FragColor = vec4(0.0, 0.0, 0.0, vAl * (1.0 - d) * (1.0 - d)); }' });
    const haloM = new THREE.ShaderMaterial({ uniforms: U2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: qv(1),
      fragmentShader: 'varying vec2 vQ; varying vec3 vC; varying float vAl; void main() { float d = length(vQ); if (d > 1.0) discard; float g = exp(-max(d * 3.0 - 0.95, 0.0) * 1.7) * smoothstep(1.0, 0.6, d); gl_FragColor = vec4(mix(vC, vec3(1.0), 0.2) * g * 0.55, g * vAl); }' });
    set.mats.push(shadowM, haloM);
    const sh = new THREE.Mesh(hgeo, shadowM); sh.frustumCulled = false; sh.renderOrder = 4; vg.add(sh);
    const ha = new THREE.Mesh(hgeo, haloM); ha.frustumCulled = false; ha.renderOrder = 6; vg.add(ha);
    // (the drop lines: from each significant bubble to the floor)
    const sig = VOL.filter(p => p.sig), dg = K.linesGeo(sig.length), DP = dg.attributes.position.array, DC = dg.attributes.aCol.array, DA = dg.attributes.aA.array;
    sig.forEach((p, i) => { DP.set(p.pos, 6 * i); DP.set([p.pos[0], VS.y0, p.pos[2]], 6 * i + 3); DC.set(p.col, 6 * i); DC.set(p.col, 6 * i + 3); DA[2 * i] = 0.5; DA[2 * i + 1] = 0.1; });
    const dl = new THREE.LineSegments(dg, K.lines(set)); dl.frustumCulled = false; dl.renderOrder = 4; vg.add(dl); vg.userData.drops = dl;
  }

  // ---------------------------------------------------------------- trajectories over age (a staircase of lanes)
  const TRJ = Array.isArray(FIG.trajectories) ? FIG.trajectories : [];
  const trj = re => { const t = TRJ.find(q => re.test(q.title || '') || re.test(q.domain || '')); if (!t) return null;
    const pts = [].concat(t.points || [], t.pointsMid || []).filter(p => p && p[1] !== null && isFinite(p[1])).sort((a, b) => a[0] - b[0]); return pts.length > 2 ? pts : null; };
  const exName = k => (EX[k] ? cap(canon(EX[k].domain)) : '');
  const exWhere = k => { const t = String((EX[k] || {}).tissue || '').toLowerCase(); return /gastro|intestin|gut/.test(t) ? 'gut' : t; };
  const LANES = [
    { name: 'Calcified plaques', rest: ' arteries', col: '#ff5a4b',
      pts: trj(/calcified/) || [[20, 0.8], [30, 0.6], [40, 0.75], [50, 1.8], [60, 2.9], [70, 4.1]] },
    { name: 'Infarct tissue', rest: ' heart', col: '#ff5ad9',
      pts: trj(/infarct/) || [[20, 0.02], [30, 0], [40, 0.02], [50, 0.03], [60, 0.11], [70, 0.3]] },
  ];
  EX.forEach((e, k) => LANES.push({ name: exName(k), rest: ` ${f1(e.from)} → ${f1(e.to)} %`, col: domainColour(e.domain), pts: [[AGES[0], +e.from], [AGES[1], +e.to]], ex: k }));
  const NL = LANES.length, LX = 0.85, LH = 0.27;
  const laneY = j => -0.5 + j * 0.19, laneZ = j => 0.3 - j * 0.15, ageX = a => -LX + (a - AGES[0]) / (AGES[1] - AGES[0]) * 2 * LX;
  // each lane fills its own height; an example lane that only falls a little (a share of 83 % to 68 %) stands on its own
  // floor (its fall takes 30 % of the lane's height, against 18 to 20 % from zero), so it reads as a fall, not a bar; its
  // label gives the numbers
  LANES.forEach(l => { const vs = l.pts.map(p => p[1]), mx = Math.max(...vs) || 1, mn = Math.min(...vs);
    const lo = l.ex !== undefined ? Math.max(0, mn - 2.3 * (mx - mn)) : 0, nv = v => Math.max(0, (v - lo) / ((mx - lo) || 1));
    l.at = a => { const P = l.pts; if (a <= P[0][0]) return nv(P[0][1]); for (let i = 1; i < P.length; i++) if (a <= P[i][0]) {
      const p0 = P[Math.max(0, i - 2)], p1 = P[i - 1], p2 = P[i], p3 = P[Math.min(P.length - 1, i + 1)], t = (a - p1[0]) / (p2[0] - p1[0]), t2 = t * t, t3 = t2 * t;
      const v = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      return nv(Math.max(0, v)); } return nv(P[P.length - 1][1]); }; });
  const cg = new THREE.Group(); set.group.add(cg);
  { const SEG = 60, pos = [], nor = [], col = [], at = [], ak = [];
    const push = (p, n, c, t, k) => { pos.push(...p); nor.push(...n); col.push(...c); at.push(t); ak.push(...k); };
    LANES.forEach((l, j) => { const c = K.rgb(l.col), y0 = laneY(j), z = laneZ(j), Y = a => y0 + LH * l.at(a);
      for (let s = 0; s < SEG; s++) { const a0 = AGES[0] + (AGES[1] - AGES[0]) * s / SEG, a1 = AGES[0] + (AGES[1] - AGES[0]) * (s + 1) / SEG, t0 = s / SEG, t1 = (s + 1) / SEG;
        const x0 = ageX(a0), x1 = ageX(a1), q = [[x0, y0, z, t0, 0], [x1, y0, z, t1, 0], [x1, Y(a1), z, t1, 1], [x0, Y(a0), z, t0, 1]];
        for (const v of [0, 1, 2, 0, 2, 3]) push(q[v].slice(0, 3), [0, 0, 1], c, q[v][3], [j, q[v][4], 0]); }
      // (a lit ribbon along the curve's top, a band 0.034 deep, so each trajectory reads as a solid edge in depth)
      for (let s = 0; s < SEG; s++) { const a0 = AGES[0] + (AGES[1] - AGES[0]) * s / SEG, a1 = AGES[0] + (AGES[1] - AGES[0]) * (s + 1) / SEG, t0 = s / SEG, t1 = (s + 1) / SEG;
        const x0 = ageX(a0), x1 = ageX(a1), y0r = Y(a0), y1r = Y(a1), nl = Math.hypot(y1r - y0r, x1 - x0) || 1, nn = [-(y1r - y0r) / nl, (x1 - x0) / nl, 0];
        const q = [[x0, y0r, z - 0.017, t0], [x1, y1r, z - 0.017, t1], [x1, y1r, z + 0.017, t1], [x0, y0r, z + 0.017, t0]];
        for (const v of [0, 1, 2, 0, 2, 3]) push(q[v].slice(0, 3), nn, c.map(x => x * 0.85), q[v][3], [j, 1, 1]); }
      const tg = K.tube(Array.from({ length: SEG + 1 }, (_, s) => { const a = AGES[0] + (AGES[1] - AGES[0]) * s / SEG; return [ageX(a), Y(a), z + 0.018]; }), 0.0075, SEG * 2, 8).toNonIndexed();
      const P = tg.attributes.position.array, N = tg.attributes.normal.array;
      for (let v = 0; v < P.length / 3; v++) push([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]], c, c01((P[v * 3] + LX) / (2 * LX)), [j, 1, 1]); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(at, 1)); g.setAttribute('aK', new THREE.Float32BufferAttribute(ak, 3));
    const m = new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uRev: { value: new Array(NL).fill(0) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `
attribute vec3 aCol, aK; attribute float aT; uniform float uA, uRev[${NL}];
varying vec3 vC, vN, vV; varying float vA, vY, vKind;
void main() {
  float rv = uRev[int(aK.x + 0.5)];
  vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
  vC = aCol; vY = aK.y; vKind = aK.z; vA = uA * smoothstep(rv + 0.004, rv - 0.004, aT);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragmentShader: `
varying vec3 vC, vN, vV; varying float vA, vY, vKind;
void main() {
  if (vKind > 0.5) { vec3 n = normalize(vN), v = normalize(vV); float l = 0.55 + 0.45 * max(dot(n, normalize(vec3(-0.3, 0.7, 0.6))), 0.0);
    gl_FragColor = vec4(mix(vC, vec3(1.0), 0.25) * l * 1.1, vA); return; }
  gl_FragColor = vec4(vC * (0.02 + 0.3 * pow(vY, 3.0)), vA);
}` });
    set.mats.push(m); const cm = new THREE.Mesh(g, m); cm.frustumCulled = false; cm.renderOrder = 5; cg.add(cm); cg.userData.mat = m;
    // each lane stands on a strip of dark glass
    const laneM = K.fade(set, new THREE.MeshStandardMaterial({ color: 0x0d1a2b, roughness: 0.3, metalness: 0.25, transparent: true }), 0.85);
    const lanes = K.merge(LANES.map((l, j) => { const b = new THREE.BoxGeometry(2 * LX + 0.06, 0.008, 0.07); b.translate(0, laneY(j) - 0.0045, laneZ(j)); return b; }));
    const lm = new THREE.Mesh(lanes, laneM); lm.renderOrder = 4; cg.add(lm);
    // baselines, decade marks, the 40 and 60 guides
    const segs = [], ink = K.rgb('#9fb0c6'), dim = K.rgb('#56677e');
    LANES.forEach((l, j) => { const y0 = laneY(j), z = laneZ(j); segs.push([[-LX, y0, z], [LX, y0, z], dim, 0.55, 0]);
      for (let a = AGES[0]; a <= AGES[1]; a += 10) segs.push([[ageX(a), y0, z], [ageX(a), y0 + (j ? 0.015 : -0.03), z], ink, j ? 0.35 : 0.8, 0]); });
    for (const a of [40, 60]) for (let j = 0; j < NL - 1; j++) segs.push([[ageX(a), laneY(j), laneZ(j)], [ageX(a), laneY(j + 1), laneZ(j + 1)], K.rgb('#ffb43b'), 0.35, 0]);
    for (const a of [40, 60]) for (let j = 0; j < NL; j++) for (let y = 0; y < LH; y += 0.03) segs.push([[ageX(a), laneY(j) + y, laneZ(j)], [ageX(a), laneY(j) + y + 0.015, laneZ(j)], K.rgb('#ffb43b'), 0.25, 0]);
    const lg = K.linesGeo(segs.length), P = lg.attributes.position.array, C = lg.attributes.aCol.array, A = lg.attributes.aA.array;
    segs.forEach((s, i) => { P.set(s[0], i * 6); P.set(s[1], i * 6 + 3); C.set(s[2], i * 6); C.set(s[2], i * 6 + 3); A[i * 2] = A[i * 2 + 1] = s[3]; });
    cg.add(new THREE.LineSegments(lg, K.lines(set)));
    // a bright head where each lane is drawing
    const hg = K.pointsGeo(NL); LANES.forEach((l, j) => { hg.attributes.aCol.array.set(K.v3.lerp(K.rgb(l.col), [1, 1, 1], 0.35), j * 3); hg.attributes.aSize.array[j] = 0.045; });
    const hp = new THREE.Points(hg, K.points(set)); hp.frustumCulled = false; cg.add(hp); cg.userData.head = hp;
  }

  // ---------------------------------------------------------------- the age gauge under a focused section
  const GY = 1.1;   // the gauge runs along the top of the focused section's plate
  const gaugeG = K.linesGeo(8), gaugeL = new THREE.LineSegments(gaugeG, K.lines(set)); gaugeL.frustumCulled = false; set.group.add(gaugeL);
  const markG = K.pointsGeo(1), mark = new THREE.Points(markG, K.points(set)); mark.frustumCulled = false; set.group.add(mark);
  markG.attributes.aCol.array.set(K.rgb('#ffb43b')); markG.attributes.aSize.array[0] = 0.05;
  for (let i = 0; i < 8; i++) { const c = K.rgb(i === 7 ? '#ffb43b' : '#9fb0c6'); gaugeG.attributes.aCol.array.set(c, i * 6); gaugeG.attributes.aCol.array.set(c, i * 6 + 3); }

  // ---------------------------------------------------------------- per-frame state
  const cur = { fw: new Float32Array(NT), P: TT.map(() => [0, 0, 0]), s: new Float32Array(NT), yaw: new Float32Array(NT), al: new Float32Array(NT),
    first: true, t: 0, fmax: 0, fi: -1, lib: 1, map: 0, um: 0, vc: 0, volc: 0, curv: 0, age: 0, vOff: [0, 0, 0], vS: 1, gauge: 0, rev: new Array(NL).fill(0) };
  const exSet = new Set(exT.filter(i => i >= 0));
  const secW = (i, l) => { const p = cur.P[i], s = cur.s[i], c = Math.cos(cur.yaw[i]), sn = Math.sin(cur.yaw[i]); return [p[0] + l[0] * c * s + (l[2] || 0) * sn * s, p[1] + l[1] * s, p[2] - l[0] * sn * s + (l[2] || 0) * c * s]; };
  const inG = (g, p) => [g.position.x + p[0] * g.scale.x, g.position.y + p[1] * g.scale.y, g.position.z + p[2] * g.scale.z];
  const focusW = (S, i) => { const fp = clamp(S.atlas_focus || 0, 0, NT); return fp < 0.5 ? 0 : c01(1 - Math.abs(fp - (i + 1))); };

  function update(S, t, dt) {
    const lib = c01(S.atlas_lib), map = c01(S.atlas_map), um = c01(S.atlas_umap), age = c01(S.atlas_age), volc = c01(S.atlas_volcano), curv = c01(S.atlas_curves);
    // (snaps on the first frame, without a dt, after a long frame or when t jumps: a seek, story to explore)
    const vc = Math.max(volc, curv), snap = cur.first || !(dt >= 0) || dt > 0.3 || Math.abs(t - cur.t - dt) > 0.3, ke = snap ? 1 : 1 - Math.exp(-5 * dt);
    cur.first = false; cur.t = t;
    Object.assign(cur, { lib, map, um, age, volc, curv, vc });
    // focus: eased (the engine steps it), passing through fractional values
    let fmax = 0, fi = -1;
    for (let i = 0; i < NT; i++) { cur.fw[i] += (focusW(S, i) - cur.fw[i]) * ke; if (cur.fw[i] < 1e-3) cur.fw[i] = 0; if (cur.fw[i] > fmax) { fmax = cur.fw[i]; fi = i; } }
    cur.fmax = fmax; cur.fi = fi;
    // the library
    const dimW = (1 - 0.72 * map) * (1 - 0.85 * Math.max(um, vc)) * (1 - 0.6 * fmax), libV = lib * dimW;
    wallMat.uniforms.uLib.value = lib; wallMat.uniforms.uVis.value = libV; wall.visible = libV > 0.04 && lib > 0.002;
    rackMat.uniforms.uK.value = sm(c01(lib / 0.12)) * dimW; rack.visible = rackMat.uniforms.uK.value > 0.01;   // (the rack stands first)
    wallGeo.setDrawRange(0, map > 0.2 || um > 0.2 || vc > 0.2 ? 6 : 18);   // (a dimmed wall behind the sections: the slides' faces only)
    // the sections: from their tissue's column on the wall to the grid, one of them forward when focused
    const wc = vc > 0 ? curv / (volc + curv) : 0, F0 = [0, 0.02, 0.72], FV = [lerp(0.74, 0.84, wc), 0.04, 0.5], Fp = K.v3.lerp(F0, FV, vc), sF = lerp(0.42, 0.33, vc);
    let anySec = 0;
    for (let i = 0; i < NT; i++) {
      const g = GRID[i], d = 0.5 * ((i % COLS) / (COLS - 1) * 0.6 + Math.floor(i / COLS) / 3 * 0.4), km = sm((map * 1.5 - d) / 0.5), fw = cur.fw[i];
      let p = K.v3.lerp(WALLMID[i], g.p, km); p[2] += 0.25 * Math.sin(PI * km);
      let s = lerp(0.012, S0, km), yaw = g.yaw * km + (1 - km) * -uTh(WST[i] + WCOLS[i] / 2);
      p[2] -= 0.3 * fmax * (1 - fw);
      p = K.v3.lerp(p, Fp, fw); s = lerp(s, sF, fw); yaw = lerp(yaw, 0, fw);
      let al = Math.max(Math.min(1, km * 3) * map, fw);
      al *= (1 - 0.82 * fmax * (1 - fw)) * (1 - 0.9 * vc * (1 - fw));
      cur.P[i] = p; cur.s[i] = s; cur.yaw[i] = yaw; cur.al[i] = al; anySec = Math.max(anySec, al);
      uP[i].set(p[0], p[1], p[2], s); uQ[i].set(yaw, al, Math.max(prog(map, 0.55, 0.95) * km, fw), fw);
    }
    // the cloud
    tileMat.uniforms.uUm.value = um; tileMat.uniforms.uAge.value = age; tileMat.uniforms.uFoc.value = fmax;
    tileMat.uniforms.uCA.value = 1 - 0.88 * vc; tileMat.uniforms.uCR.value = 0.5 + 0.035 * t;
    tiles.visible = anySec > 0.003 || um > 0.002;
    const hi = fmax > 0.02 && fi >= 0 ? fi : -1;
    tileMat.uniforms.uHero.value = hi; hero.visible = hi >= 0 && tiles.visible;
    if (hi >= 0 && hi !== heroI) { hero.geometry.dispose(); hero.geometry = heroGeo(hi); heroI = hi; }
    // the sections' organs (gone as the tiles fly to the cloud)
    if (!orgMesh && O3) { if (!O3.driven) O3.step(3); buildOrgans(); }   // (the engine steps them itself)
    if (orgMesh) {
      const show = 1 - sm(um * 2.5);
      orgMesh.visible = anySec > 0.003 && show > 0.01 && vc < 0.5;   // (not beside a plot: the sections there are dim)
      if (orgMesh.visible) for (let i = 0; i < NT; i++) { const p = secW(i, [-0.86, 0.9, 0.34]); mP[i].set(p[0], p[1], p[2], Math.min(cur.s[i] * 0.3, 0.075)); mQ[i].set(cur.al[i] * show, 0.25 * cur.fw[i], t * 0.4 + i, 0); }
    }
    tileMat.depthWrite = vc < 0.02 && fmax < 0.02;   // (dimmed sections behind a plot or a focused section must not hide what is in front of them)
    caps.visible = anySec > 0.003 && um < 0.998; capMat.uniforms.uUm.value = sm(um * 1.6);
    // the volcano (left of a focused section)
    const vS = 1 - 0.2 * fmax; vg.position.set(-0.5 * fmax, 0.02, 0.1); vg.scale.setScalar(vS); vg.visible = volc > 0.003;
    volMat.uniforms.uRev.value = volc * 1.05; volMat.uniforms.uSig.value = prog(volc, 0.68, 0.95);
    vg.userData.lines.material.uniforms.uReveal.value = prog(volc, 0, 0.35) * 1.0;
    vg.userData.drops.material.uniforms.uReveal.value = prog(volc, 0.7, 0.95) > 0 ? 1 : -1;
    vg.userData.plane.material.opacity = 0.07 * set.uA.value * prog(volc, 0.5, 0.8);   // from its base, never compounding
    // the trajectories
    cg.position.set(-0.69 * fmax, 0, 0.1); cg.scale.setScalar(1 - 0.34 * fmax); cg.visible = curv > 0.003;   // (beside a section: smaller, short names)
    const hd = cg.userData.head.geometry.attributes;
    LANES.forEach((l, j) => { const rv = c01((curv - 0.15 - 0.05 * j) / 0.6); cur.rev[j] = rv; cg.userData.mat.uniforms.uRev.value[j] = rv;
      const a = lerp(AGES[0], AGES[1], rv); hd.position.array.set([ageX(a), laneY(j) + LH * l.at(a), laneZ(j)], j * 3); hd.aA.array[j] = rv > 0.002 && rv < 0.998 ? 1 : 0; });
    hd.position.needsUpdate = true; hd.aA.needsUpdate = true;
    // the age gauge under the focused section
    const gA = fi >= 0 ? fmax * (exSet.has(fi) ? 1 : prog(age, 0, 0.05)) : 0;
    cur.gauge = gA; gaugeL.visible = mark.visible = gA > 0.003;
    if (gA > 0.003) { const GP = gaugeG.attributes.position.array, GA = gaugeG.attributes.aA.array, gy = GY;
      GP.set(secW(fi, [-0.8, gy, 0.02]), 0); GP.set(secW(fi, [0.8, gy, 0.02]), 3); GA[0] = GA[1] = gA * 0.9;
      for (let k = 0; k <= 5; k++) { const x = -0.8 + 1.6 * k / 5; GP.set(secW(fi, [x, gy, 0.02]), 6 + k * 6); GP.set(secW(fi, [x, gy + 0.05, 0.02]), 9 + k * 6); GA[2 + k * 2] = GA[3 + k * 2] = gA * 0.7; }
      GP.set(secW(fi, [-0.8, gy, 0.02]), 42); GP.set(secW(fi, [-0.8 + 1.6 * age, gy, 0.02]), 45); GA[14] = GA[15] = gA;
      gaugeG.attributes.position.needsUpdate = true; gaugeG.attributes.aA.needsUpdate = true;
      markG.attributes.position.array.set(secW(fi, [-0.8 + 1.6 * age, gy, 0.03]), 0); markG.attributes.aA.array[0] = gA;
      markG.attributes.position.needsUpdate = true; markG.attributes.aA.needsUpdate = true; }
  }

  // ---------------------------------------------------------------- anchors, labels, views, controls
  const gaugeAt = x => () => (cur.fi >= 0 ? secW(cur.fi, [x, GY, 0.03]) : [0, 0, 0]);
  const anchors = {
    library: [0, 0, WC - WR], libTop: [0, WH / 2 + 0.07, WC - WR], libBase: [0, -WH / 2 - 0.08, WC - WR],
    libAge: wallAt(-TH, -0.12), libAge20: wallAt(-TH, -WH / 2 + 0.04), libAge70: wallAt(-TH, WH / 2 - 0.02), atlas: [0, 0, 0.12], atlasTop: [0, 0.72, 0.15],
    umap: () => [0, 0.05, 0.08], umapTop: () => [0, 0.7, 0.08],
    focus: () => (cur.fi >= 0 && cur.fmax > 0.3 ? cur.P[cur.fi].slice() : [0, 0, 0.12]),
    focusTop: () => (cur.fi >= 0 ? secW(cur.fi, [0, 1.08, 0]) : [0, 0.6, 0.12]),
    age20: gaugeAt(-0.8), age70: gaugeAt(0.8), ageMark: () => (cur.fi >= 0 ? secW(cur.fi, [-0.8 + 1.6 * cur.age, GY, 0.03]) : [0, 0, 0]),
    volcano: () => inG(vg, [0, 0, 0]), volcanoTop: () => inG(vg, [0, YT + 0.08, 0]), vLeft: () => inG(vg, [-0.6, VS.y0 - 0.06, ZF]), vRight: () => inG(vg, [0.6, VS.y0 - 0.06, ZF]),
    curves: () => inG(cg, [0, 0, 0]), curveAxis: () => inG(cg, [0, laneY(0) - 0.07, laneZ(0)]),
  };
  anchors.age = anchors.ageMark;   // the age readout's marker
  EX.forEach((e, k) => { const v = VOL.find(p => p.ex === k); anchors['ex' + k] = () => inG(vg, v ? v.pos : [0, 0, 0]);
    anchors['exDom' + k] = () => { const ti = exT[k]; if (ti < 0) return [0, 0, 0]; const s = SEC[ti], dk = REC[ti].findIndex(d => d.ex === k); return secW(ti, [...(s.exAt[dk] || [0, 0]), 0.03]); }; });
  for (let i = 0; i < NT; i++) { anchors['sec' + i] = () => cur.P[i].slice(); anchors['secTop' + i] = () => secW(i, [0, 1.1, 0]); }
  LANES.forEach((l, j) => { anchors['curve' + j] = () => inG(cg, [ageX(lerp(AGES[0], AGES[1], cur.rev[j])), laneY(j) + LH * l.at(lerp(AGES[0], AGES[1], cur.rev[j])), laneZ(j)]);
    anchors['curveTag' + j] = () => inG(cg, [LX + 0.02, laneY(j) + 0.8 * LH, laneZ(j)]); });   // (each lane's end, evenly spaced: the short names)

  const libLab = S => prog(S.atlas_lib, 0.75, 1) * (1 - prog(S.atlas_map, 0, 0.3)) * (1 - prog(Math.max(S.atlas_umap, S.atlas_volcano, S.atlas_curves), 0, 0.3)) * (S.atlas_focus >= 0.5 ? 0 : 1);
  const vcS = S => Math.max(S.atlas_volcano || 0, S.atlas_curves || 0), anyF = S => (S.atlas_focus >= 0.5 ? 1 : 0);
  const exTitle = exName;
  const labels = [
    { text: [fmt(TOTAL), ' slides'], at: 'libTop', cls: 'mag', alpha: libLab },
    { text: [`${F.tissues || NT} tissues`, ` of ${F.organs || 29} organs`], at: 'libBase', cls: '', alpha: libLab },
    { text: [`${fmt(F.donors || 983)} people`, `, aged ${AGES[0]} to ${AGES[1]}`], at: 'libAge', cls: 'amb', alpha: libLab },
    // the wall's rows run by the donor's age: say which way
    { text: [`${AGES[1]}`, ' years'], at: 'libAge70', cls: '', minor: true, alpha: libLab },
    { text: [`${AGES[0]}`, ' years'], at: 'libAge20', cls: '', minor: true, alpha: libLab },
    { text: [`${F.domains || 218} domains`, ` in ${F.types || 74} types`], at: 'atlasTop', cls: 'cyn',
      alpha: S => prog(S.atlas_map, 0.7, 1) * (1 - prog(S.atlas_umap, 0, 0.3)) * (1 - prog(vcS(S), 0, 0.3)) * (1 - anyF(S)) },
    { text: [`${Math.round((F.tiles || 162e6) / 1e6)} million tiles`, `, ${F.domains || 218} domains`], at: 'umapTop', cls: 'cyn',
      alpha: S => prog(S.atlas_umap, 0.6, 0.95) * (1 - prog(vcS(S), 0, 0.3)) * (1 - anyF(S)) },
    { text: [`${F.ageChange || 28} %`, ' of domains change with age'], at: 'volcanoTop', cls: 'amb', alpha: S => prog(S.atlas_volcano, 0.7, 1) },
    { text: ['Falls', ' with age'], at: 'vLeft', cls: 'cyn', alpha: S => prog(S.atlas_volcano, 0.75, 1) * (1 - anyF(S)) },
    { text: ['Rises', ' with age'], at: 'vRight', cls: 'mag', alpha: S => prog(S.atlas_volcano, 0.75, 1) * (1 - anyF(S)) },
    { text: ['Age', ` ${AGES[0]} to ${AGES[1]}`], at: 'curveAxis', cls: '', alpha: S => prog(S.atlas_curves, 0.1, 0.3) },
  ];
  EX.forEach((e, k) => {
    labels.push({ text: [exTitle(k), ` ${exWhere(k)}`], at: 'ex' + k, cls: e.perDecade >= 0 ? 'mag' : 'cyn', alpha: S => prog(S.atlas_volcano, 0.8, 1) * (1 - (exT[k] >= 0 ? focusW(S, exT[k]) : 0)) });
    // (beside a plot the section sits at the right: the shorter wording there)
    const exA = S => (exT[k] >= 0 ? focusW(S, exT[k]) : 0) * (1 - prog(S.atlas_umap, 0, 0.3)), pl = S => sm(vcS(S) * 4);
    labels.push({ text: [exTitle(k), ` ${f1(e.from)} % → ${f1(e.to)} %`], at: 'exDom' + k, cls: 'amb', alpha: S => exA(S) * (1 - pl(S)) });
    labels.push({ text: [exTitle(k), ` ${f1(e.from)} → ${f1(e.to)} %`], at: 'exDom' + k, cls: 'amb', alpha: S => exA(S) * pl(S) * (1 - sm(c01(S.atlas_curves * 4))) });   // (the curves' lane says it there)
  });
  LANES.forEach((l, j) => { const la = S => prog(S.atlas_curves, 0.55 + 0.05 * j, 0.85 + 0.03 * j), cls = l.ex === undefined ? 'mag' : '';
    labels.push({ text: [l.name, l.rest], at: 'curve' + j, cls, alpha: S => la(S) * (1 - cur.fmax) });
    labels.push({ text: [l.name, ''], at: 'curveTag' + j, cls, alpha: S => la(S) * cur.fmax }); });   // (beside a section: the name alone, a row apart)
  labels.push({ text: [String(AGES[0]), ' years'], at: 'age20', cls: '', alpha: S => (cur.fi >= 0 ? cur.gauge : 0) * (1 - vcS(S)) });
  labels.push({ text: [String(AGES[1]), ' years'], at: 'age70', cls: '', alpha: S => (cur.fi >= 0 ? cur.gauge : 0) * (1 - vcS(S)) });

  const cam = {
    default: [0, 10, 3.4, 0, 0, -0.12], library: [0, 10, 3.4, 0, 0, -0.12],   // (a little from above: the rack's shelves show)
    atlas: [0, 3, 3.2, 0, 0, 0.14],
    umap: [24, 14, 3.3, 0, 0.05, 0.08], focus: [-26, 16, 1.95, 0, 0.0, 0.72],   // (the focused section from a little left and above: its relief shows)
    volcano: [-6, 9, 3.1, 0.24, 0.02, 0.1],
    curves: [-20, 14, 3.4, 0.33, -0.04, 0.08], age: [0, 6, 3.4, 0.2, 0.02, 0.3],
    slides: [-8, 6, 0.75, -0.1, 0.22, -0.49],   // close to the wall: single slides (the library's own view is the whole wall)
    shelf: [-32, 10, 0.3, -0.12, 0.1, -0.47],   // a slant along the wall, up close: the slides as glass with their tissue
  };
  const controls = [
    { key: 'view', label: 'View', options: [['library', 'Library'], ['atlas', 'Atlas'], ['tiles', 'Tiles'], ['age', 'Age'], ['pathology', 'Pathology']] },
    { key: 'age', label: 'Age', options: [['20', `${AGES[0]} years`], ['70', `${AGES[1]} years`]] },
  ];
  function explore(c) {
    const v = c.view || 'library';
    return { atlas_lib: 1, atlas_map: v === 'library' ? 0 : 1, atlas_umap: v === 'tiles' ? 1 : 0, atlas_volcano: v === 'age' ? 1 : 0,
      atlas_curves: v === 'pathology' ? 1 : 0, atlas_age: c.age === '70' ? 1 : 0 };
  }

  // what a ray points at: a section (the atlas or a focused one) or a tissue's column of slides
  const _inv = new THREE.Matrix4(), _ray = new THREE.Ray();
  function pick(raycaster) {
    set.group.updateMatrixWorld();
    _ray.copy(raycaster.ray).applyMatrix4(_inv.copy(set.group.matrixWorld).invert());
    const o = _ray.origin, d = _ray.direction;
    let best = -1, bt = Infinity;
    if (cur.um < 0.5) for (let i = 0; i < NT; i++) {
      if (cur.al[i] < 0.25) continue;
      const p = cur.P[i], n = [Math.sin(cur.yaw[i]), 0, Math.cos(cur.yaw[i])], dn = d.x * n[0] + d.z * n[2];
      if (Math.abs(dn) < 1e-4) continue;
      const tt = ((p[0] - o.x) * n[0] + (p[2] - o.z) * n[2]) / dn; if (tt <= 0 || tt >= bt) continue;
      const hx = o.x + d.x * tt - p[0], hy = o.y + d.y * tt - p[1], hz = o.z + d.z * tt - p[2];
      if (Math.hypot(hx, hy, hz) < cur.s[i] * 1.12) { bt = tt; best = i; }
    }
    if (best < 0 && cur.lib > 0.5 && cur.map < 0.3 && cur.vc < 0.3) {
      const a = d.x * d.x + d.z * d.z, b = 2 * (o.x * d.x + (o.z - WC) * d.z), cc = o.x * o.x + (o.z - WC) ** 2 - WR * WR, disc = b * b - 4 * a * cc;
      if (disc > 0 && a > 1e-6) for (const tt of [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)]) {
        if (tt <= 0) continue; const x = o.x + d.x * tt, y = o.y + d.y * tt, z = o.z + d.z * tt, th = Math.atan2(x, WC - z);
        if (Math.abs(th) > TH || Math.abs(y) > WH / 2) continue;
        const u = (th / TH / 2 + 0.5) * U; for (let i = 0; i < NT; i++) if (u >= WST[i] - GAP / 2 && u <= WST[i] + WCOLS[i] + GAP / 2) { best = i; break; }
        break;
      }
    }
    return best;
  }
  const API = {
    tissues: NAMES, short: SHORT, organs: ORGAN, examples: exT, pick, domainColour,
    domains: i => (REC[i] || []).map((d, k) => { const a = shares(REC[i], 0), b = shares(REC[i], 1); return { name: d.name, at20: +a[k].toFixed(1), at70: +b[k].toFixed(1), colour: domainColour(d.name) }; }),
    tissuesOf: organ => ORGAN.map((o, i) => (o.toLowerCase() === String(organ).toLowerCase() ? i : -1)).filter(i => i >= 0),
    volcanoFromFigure: volFromFig, slides: NSL.slice(), tiles: NTILE,
  };

  return Object.assign(set, {
    params: { atlas_a: 1, atlas_lib: 1, atlas_map: 0, atlas_umap: 0, atlas_focus: 0, atlas_age: 0, atlas_volcano: 0, atlas_curves: 0 },
    update, anchors, labels, cam, controls, explore, api() { return API; },
    // (the organ models: built at once by the harness and the sweeps)
    finish() { if (O3) O3.step(Infinity); buildOrgans(); },
  });
};
