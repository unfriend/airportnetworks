// PWIZ: the network on show as a dataset for wwiznet (asdf10k), the Menche lab's 3D network explorer (SPEC.md, "Export
// for wwiznet"). A plain module, no DOM: the Network tab's *Export for wwiznet* (e4b_network.js) and the command line
// (src/export-wwiznet.mjs) both give it what the cell drew (SETS.cell's api().wiz(): every location's own dot, each
// link's judgement, the links drawn) and take its files: nodes.tsv, edges.tsv and config.json in the form of wwiznet's
// docs/for_agents/data-folder-setup.md (columns named by their kind's suffix), a guide window (custom_windows/) and
// data_description.txt. Nothing here sends anything anywhere; the page saves the files as a ZIP made in the page (zip).
const PWIZ = (() => {
  const P0 = typeof PDATA !== 'undefined' ? PDATA : require('./pdata.js');
  const SD = typeof PPI_SIDES !== 'undefined' ? PPI_SIDES : require('./sides.js');
  // the places as short keys (node ids: no spaces or commas, which wwiznet's lists and buttons split on), 13 none
  const PLACE_KEY = ['cytosol', 'nucleoplasm', 'nucleolus', 'er', 'golgi', 'mitochondria', 'lysosomes', 'endosomes', 'peroxisomes', 'plasma_membrane',
    'nuclear_envelope', 'cytoskeleton', 'vesicles', 'none'];
  const REL = ['not given', 'Uncertain', 'Approved', 'Supported', 'Enhanced'];
  // a membrane side class (PSIDES: 0 to 7; 255 a place without a membrane) in a few words without commas
  const SIDE = ['not in UniProt', 'side not told', 'inside', "on the cytosol's side", 'on the far side', 'through once', 'through several times', 'secreted'];
  const LAYER = { o: 'outer membrane', g: 'the gap', i: 'inner membrane', m: 'matrix', p: 'the pore' };
  const EVID = { e: 'experimental', c: 'curated', p: 'predicted', r: 'our rule (no signal)' };
  const VERDICT = ['possible', 'through a gate', 'impossible'];
  // an edge's severity: 0 the same protein (a copy's tie), 1 not judged, 2 possible, 3 through a gate, 4 impossible;
  // wwiznet scales it 0 to 1 for the cut-off and the opacity (0, 0.25, 0.5, 0.75, 1)
  const SEV_TIE = 0, SEV_GREY = 1;
  // and its emphasis, for the opacity and width: the possible ones quiet, the amber and red ones never lost among them
  const EMPH = [0, 0.05, 0.15, 0.6, 1];
  const hex = c => '#' + c.map(x => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('');
  const mix = (a, b) => [0, 1, 2].map(j => (a[j] + b[j]) / 2);
  // numbers as text: at most three decimals, the same every time (no -0)
  const num = v => (Number.isFinite(v) ? String(+(+v).toFixed(3) || 0) : '');
  const cell = s => String(s === undefined || s === null ? '' : s).replace(/[\t\r\n]+/g, ' ');
  // a list cell (_a): items joined by commas, so an item keeps none of its own
  const list = a => a.map(s => cell(s).replace(/\s*,\s*/g, '; ')).join(',');
  const yes = b => (b ? 'yes' : 'no');
  const tsv = (head, rows) => [head.join('\t'), ...rows.map(r => r.map(cell).join('\t'))].join('\n') + '\n';
  const mul = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const unit = r => { const z = r() * 2 - 1, t = r() * Math.PI * 2, s = Math.sqrt(1 - z * z); return [s * Math.cos(t), z, s * Math.sin(t)]; };
  // node ids from symbols: readable, unique, no spaces or commas (the map's 'Gene 934' is Gene_934; HBD and TEC, given
  // twice, are HBD and HBD_2)
  function idsOf(sym) {
    const seen = new Set();
    return sym.map(s => {
      const b = String(s).replace(/[^A-Za-z0-9._-]/g, '_') || 'protein';
      let id = b;
      for (let n = 2; seen.has(id); n++) id = `${b}_${n}`;
      seen.add(id);
      return id;
    });
  }
  // the story's hairball (ball.js, chapter 1): one spot per protein on a ball, hubs near the middle, a few rounds of
  // pulling each protein towards its partners among the links drawn
  function hairball(N, degP, pairs) {
    const R0 = 0.95, home = new Float64Array(3 * N), rad = new Float64Array(N);
    let maxDeg = 1;
    for (let p = 0; p < N; p++) maxDeg = Math.max(maxDeg, degP[p]);
    const lmax = Math.log1p(maxDeg);
    for (let p = 0; p < N; p++) {
      const r = mul(p * 7 + 3), u = unit(r), x = Math.log1p(degP[p]) / lmax;
      rad[p] = R0 * (0.25 + 0.75 * Math.pow(1 - x, 0.8)) * (0.85 + 0.15 * r());
      home.set([u[0] * rad[p], u[1] * rad[p], u[2] * rad[p]], 3 * p);
    }
    const acc = new Float64Array(3 * N), cnt = new Float64Array(N);
    for (let it = 0; it < 4; it++) {
      acc.fill(0); cnt.fill(0);
      for (let j = 0; j < pairs.length; j += 2) {
        const a = pairs[j], b = pairs[j + 1];
        for (let k = 0; k < 3; k++) { acc[3 * a + k] += home[3 * b + k]; acc[3 * b + k] += home[3 * a + k]; }
        cnt[a]++; cnt[b]++;
      }
      for (let p = 0; p < N; p++) {
        if (!cnt[p]) continue;
        const w = Math.min(0.3, 0.2 * cnt[p] / (cnt[p] + 3));
        let x = home[3 * p], y = home[3 * p + 1], z = home[3 * p + 2];
        x += (acc[3 * p] / cnt[p] - x) * w; y += (acc[3 * p + 1] / cnt[p] - y) * w; z += (acc[3 * p + 2] / cnt[p] - z) * w;
        const l = Math.hypot(x, y, z) || 1;
        home[3 * p] = x / l * rad[p]; home[3 * p + 1] = y / l * rad[p]; home[3 * p + 2] = z / l * rad[p];
      }
    }
    return home;
  }
  const SCALE = 100;   // (the model cell is about 2 across: written in hundredths, about 200 across; wwiznet normalises)

  // the dataset: d from the cell (api().wiz()), o = { copies: 'all' (a node per protein and place, the default) or
  // 'main' (a node per protein, at its main place), edges: 'judged' (the default: every contact link judged), 'all'
  // (the grey ones too) or 'drawn' (the links the cell draws), key, label, name (a chosen network's) }
  function files(d, o = {}) {
    const P = d.P, S = d.S, L = d.L, copies = o.copies === 'main' ? 'main' : 'all', mode = ['all', 'drawn'].includes(o.edges) ? o.edges : 'judged';
    const key = o.key || (d.own ? 'ppicell_own' : 'ppicell'), label = o.label || (d.own ? `Back into the cell: ${o.name || 'your network'}` : 'Back into the cell: the interactome in a model cell');
    const N = P.N, E = P.E, NLOC = d.NLOC, lProt = d.lProt, lPlace = d.lPlace, pcol = d.placeCol;
    const l0 = p => (P.pl[p] ? P.lOf[p] : d.uLoc[p]), l1 = p => (P.pl[p] ? P.lOf[p + 1] : d.uLoc[p] + 1);
    // each protein's main location: its first in a main place (the Atlas's), else its first
    const mainLoc = new Int32Array(N);
    for (let p = 0; p < N; p++) { let m = l0(p); for (let l = l0(p); l < l1(p); l++) if (P.main[p] >> lPlace[l] & 1) { m = l; break; } mainLoc[p] = m; }
    // the links exported: their verdicts and the drawn ones
    const drawn = new Uint8Array(E);
    for (const i of d.drawn) drawn[i] = 1;
    const keep = i => (mode === 'all' ? true : mode === 'drawn' ? drawn[i] === 1 : L.why[i] === 0);
    const sev = i => (L.why[i] ? SEV_GREY : 2 + L.cls[i]);
    const vtext = i => (L.why[i] === 1 ? 'not a contact' : L.why[i] === 2 ? 'an end without a place' : VERDICT[L.cls[i]]);
    // per protein: its links by verdict (every link of the network, whatever is exported), as the panes count them
    const cnt = Array.from({ length: 4 }, () => new Uint32Array(N));
    for (let i = 0; i < E; i++) {
      const c = L.why[i] ? 3 : L.cls[i], a = P.la[i], b = P.lb[i];
      cnt[c][a]++; if (b !== a) cnt[c][b]++;
    }
    // complexes: each protein's (names and accessions) and whether one of them is listed apart (its members cannot meet)
    const apart = S.cx.map(c => S.cxPos(c, d.g === 1, d.sd === 2).kind === 3);
    const inCx = (a, b) => { const A = S.ofProt[a]; if (!A.length) return false; const B = new Set(S.ofProt[b]); return A.some(n => B.has(n)); };
    // the nodes: locations (copies all) or proteins (main); a node is in when it has a place or an exported link
    const pid = idsOf(Array.from(P.sym));
    const nodeOfLoc = l => (copies === 'all' ? l : lProt[l]);
    const used = new Uint8Array(copies === 'all' ? d.NALL : N);
    if (copies === 'all') for (let l = 0; l < NLOC; l++) used[l] = 1; else for (let p = 0; p < N; p++) if (P.pl[p]) used[p] = 1;
    const ex = [];
    for (let i = 0; i < E; i++) if (keep(i)) { ex.push(i); used[nodeOfLoc(L.a[i])] = 1; used[nodeOfLoc(L.b[i])] = 1; }
    const nid = n => (copies === 'all' ? `${pid[lProt[n]]}@${PLACE_KEY[lPlace[n]]}` : pid[n]);
    // the second layout: the hairball, from the links drawn
    const pairs = [];
    for (const i of d.drawn) if (P.la[i] !== P.lb[i]) pairs.push(P.la[i], P.lb[i]);
    const ball = hairball(N, d.degP, pairs);
    const kn = d.kindNames, placeName = k => (k >= 13 ? 'No place' : d.placeNames[k]);
    const placesOf = m => { const o2 = []; for (let k = 0; k < 13; k++) if (m >> k & 1) o2.push(d.placeNames[k]); return o2; };
    const inMap = d.own ? new Set(P0.sym) : null;
    // links at each node (exported ones)
    const here = new Uint32Array(used.length);
    for (const i of ex) { const a = nodeOfLoc(L.a[i]), b = nodeOfLoc(L.b[i]); here[a]++; if (b !== a) here[b]++; }
    const head = ['id', 'name', 'x', 'y', 'z', 'x_ball', 'y_ball', 'z_ball', 'color', 'type_simple_c', 'protein_id_c', 'place_c'].concat(copies === 'all' ? ['main_place_c'] : [],
      ['places_a', 'main_places_a', 'places_n', 'reliability_c', 'side_c', 'side_basis_c', 'side_evidence_c', 'membrane_layer_c', 'community_c', 'degree_n', 'links_here_n',
        'possible_n', 'gate_n', 'impossible_n', 'not_judged_n', 'impossible_share_n', 'complexes_a', 'complex_ids_a', 'complex_apart_c'], d.own ? ['in_map_c'] : []);
    const rows = [], idOf = new Map();
    for (let n = 0; n < used.length; n++) {
      if (!used[n]) continue;
      const l = copies === 'all' ? n : mainLoc[n], p = lProt[l], k = lPlace[l], placed = k < 13, id = nid(n);
      idOf.set(n, id);
      const c = placed ? S.cls[l] : -1, judged = cnt[0][p] + cnt[1][p] + cnt[2][p], cx = S.ofProt[p] || [];
      rows.push([id, P.sym[p], num(d.pos[3 * l] * SCALE), num(d.pos[3 * l + 1] * SCALE), num(d.pos[3 * l + 2] * SCALE),
        num(ball[3 * p] * SCALE), num(ball[3 * p + 1] * SCALE), num(ball[3 * p + 2] * SCALE), hex(pcol[k]), 'protein', S.acc[p] || '', placeName(k)]
        .concat(copies === 'all' ? [placed ? yes(P.main[p] >> k & 1) : ''] : [],
          [list(placesOf(P.pl[p])), list(placesOf(P.main[p])), String(P.pl[p] ? l1(p) - l0(p) : 0), P.pl[p] ? REL[P.rel[p]] || '' : '',
            !placed ? '' : c === 255 ? 'no membrane here' : SIDE[c] || '', placed && c !== 255 ? ({ u: 'named', t: 'carried' })[S.by[l]] || '' : '',
            placed && c !== 255 ? EVID[S.ev[l]] || '' : '', placed && (k === 5 || k === 10) ? LAYER[S.lay[l]] || '' : '',
            d.com && placed ? `${PLACE_KEY[k]}-${d.com[l] + 1}` : '', String(d.degP[p]), String(here[n]),
            String(cnt[0][p]), String(cnt[1][p]), String(cnt[2][p]), String(cnt[3][p]), judged ? num(cnt[2][p] / judged) : '',
            list(cx.map(m => S.cx[m].name)), list(cx.map(m => 'CPX-' + S.cx[m].ac)), cx.length ? yes(cx.some(m => apart[m])) : ''],
          d.own ? [inMap.has(P.sym[p]) ? 'yes' : 'from the lookup'] : []));
    }
    // the edges: the links exported, then (copies all) each protein's copies tied to its main one
    const ehead = ['source', 'target', 'color', 'verdict_c', 'severity_n', 'emphasis_n', 'evidence_a', 'kinds_n'].concat(d.score ? ['score_n'] : [], ['in_complex_c', 'drawn_c', 'drawn_n']);
    const erows = [], tally = [0, 0, 0, 0, 0];
    for (const i of ex) {
      const a = L.a[i], b = L.b[i], kinds = [];
      for (let k = 0; k < kn.length; k++) if (P.kind[i] >> k & 1) kinds.push(kn[k]);
      const col = L.why[i] ? d.clsCol[3] : L.cls[i] ? d.clsCol[L.cls[i]] : mix(pcol[lPlace[a]], pcol[lPlace[b]]);
      tally[L.why[i] ? 2 + L.why[i] : L.cls[i]]++;
      erows.push([idOf.get(nodeOfLoc(a)), idOf.get(nodeOfLoc(b)), hex(col), vtext(i), String(sev(i)), String(EMPH[sev(i)]), list(kinds), String(kinds.length)]
        .concat(d.score ? [num(P.sup[i])] : [], [yes(inCx(P.la[i], P.lb[i])), yes(drawn[i]), String(drawn[i])]));
    }
    let ties = 0;
    if (copies === 'all') for (let p = 0; p < N; p++) {
      if (!P.pl[p]) continue;
      for (let l = l0(p); l < l1(p); l++) if (l !== mainLoc[p]) {
        ties++;
        erows.push([idOf.get(mainLoc[p]), idOf.get(l), hex(d.tieCol), 'the same protein', String(SEV_TIE), String(EMPH[SEV_TIE]), '', ''].concat(d.score ? [''] : [], ['', 'no', '0']));
      }
    }
    const nodes = tsv(head, rows), edges = tsv(ehead, erows);
    const counts = { nodes: rows.length, edges: erows.length, links: ex.length, ties, possible: tally[0], gate: tally[1], impossible: tally[2], notContact: tally[3], unplaced: tally[4], drawn: d.drawn.length };
    const ids = n => [...new Set(n)].filter(x => x !== undefined);
    // nodes of a complex (its members' nodes: every copy, or the protein's)
    const cxNodes = m => ids(S.cx[m].members.flatMap(p => (copies === 'all' ? Array.from({ length: P.pl[p] ? l1(p) - l0(p) : 0 }, (_, j) => idOf.get(l0(p) + j)) : [idOf.get(p)])));
    const cfg = config(d, key, counts, cxNodes, copies);
    const win = guide(d, counts, cxNodes, label);
    const desc = description(d, o, counts, copies, mode, label);
    const out = { 'nodes.tsv': nodes, 'edges.tsv': edges, 'config.json': JSON.stringify(cfg, null, 2) + '\n', 'custom_windows/index.json': '["cell"]\n', 'custom_windows/cell/window.md': win, 'data_description.txt': desc };
    return { files: out, entry: { key, folder: key, label }, counts };
  }

  // ---------------------------------------------------------------- config.json (data-folder-setup.md, section 4)
  const BASE = {
    nodeColorAttribute: 'original', nodeColorScalingMethod: 'linear', nodeSizeAttribute: 'degree_n', nodeSizeScalingMethod: 'log', nodeSizeScaling: 1.2, nodeMinSize: 0.3,
    edgeColorAttribute: 'original', edgeWidthAttribute: 'emphasis_n', edgeWidthScalingMethod: 'linear', edgeWidthScaling: 2.5, edgeMinWidth: 6,
    edgeOpacity: 0.3, edgeBlending: 'additive', edgeAlphaAttribute: 'emphasis_n', edgeAlphaMin: 0.08, edgeAlphaMax: 1, edgeFadeDistance: 0.7,
    edgeCutoffAttribute: 'severity_n', edgeCutoff: 0.3,
    highlightNodesEnabled: true, highlightNodeSizeScale: 1.5, highlightEdgesEnabled: true, highlightEdgeWidthScale: 2, highlightEdgeOpacity: 3,
    fadeOtherEdgesEnabled: true, fadeOtherEdgesOpacity: 0.4, subsetEdgesOnly: false, edgeSubsetMode: 'incident', bloomMode: 'selection', enableDynamicResolution: true, targetFPS: 60,
  };
  const PRESETS = {
    'The cell': {},
    'Gates and impossible only': { edgeCutoff: 0.7, edgeOpacity: 0.6 },
    'Impossible only': { edgeCutoff: 0.9, edgeOpacity: 0.8 },
    'As the story draws it': { edgeCutoffAttribute: 'drawn_n', edgeCutoff: 0.5, edgeOpacity: 0.6 },
    'With the copies tied': { edgeCutoff: 0 },
    'Membrane sides': { nodeColorAttribute: 'side_c' },
    'Communities': { nodeColorAttribute: 'community_c' },
    'Share impossible': { nodeColorAttribute: 'impossible_share_n', nodeColorScalingMethod: 'quantile' },
  };
  function config(d, key, counts, cxNodes, copies) {
    const presets = {};
    for (const [n, p] of Object.entries(PRESETS)) presets[n] = Object.assign({ schemaVersion: 1 }, BASE, p);
    const q = s => (/^[A-Za-z]+$/.test(s) ? s : JSON.stringify(s));
    const S = d.S, ex = d.cxEx.filter(m => m >= 0 && S.cx[m]);
    return {
      version: 1, schemaVersion: 1, exportType: 'asdf10k-local-storage', dataset: key, nodeLayout: 'default',
      presets, lastUsedPreset: 'The cell',
      subsetBuilderLibrary: [
        { name: 'Proteins with an impossible link', formula: 'impossible_n>0' },
        { name: 'Proteins with a link through a gate', formula: 'gate_n>0' },
        { name: 'In a complex listed apart', formula: 'complex_apart_c=yes' },
        { name: 'Hubs (100 links or more)', formula: 'degree_n>=100' },
      ].concat(d.placeNames.map(n => ({ name: `${n}`, formula: `place_c=${q(n)}` })), [{ name: 'No place', formula: 'place_c="No place"' }].filter(() => counts.unplaced > 0 || copies === 'main')),
      subsetListLibrary: ex.map(m => ({ name: S.cx[m].name, namesText: cxNodes(m).join(' ') })),
      // (the guide window opened at start at the left, so the cell stays in view; in a headset to the right)
      openWindows: [{ type: 'custom', title: 'Back into the cell', config: { name: 'cell', bounds: { left: 10, top: 60, width: 440, height: 640 }, xr: { x: 0.95, y: -0.05, z: 0.55 } } }],
      tooltips: {
        typeColumn: 'type_simple_c',
        types: { protein: { extra1: { fetcher: 'uniprot', idColumns: ['protein_id_c', 'name'] }, extra2: { fetcher: 'genecards-expression', idColumns: ['name'] } } },
        default: { extra1: { fetcher: 'uniprot' }, extra2: null },
        show3dModels: true,
      },
      tooltipFetchIdAttribute: 'name',
      window_molecular: { fetchIdColumn: 'protein_id_c' },
      sliderRanges: { nodeSizeScaling: { min: 0.5, max: 6, step: 0.01 }, edgeMinWidth: { min: 0.5, max: 40, step: 0.01 } },
    };
  }

  // ---------------------------------------------------------------- the guide window (custom-windows-guide.md)
  function guide(d, counts, cxNodes, label) {
    const S = d.S, f = n => n.toLocaleString('en-GB'), ex = d.cxEx.filter(m => m >= 0 && S.cx[m]);
    const set = (lab, ch) => '```asdf10k\n' + JSON.stringify({ type: 'settings', label: lab, changes: ch }) + '\n```\n';
    const sub = m => '```asdf10k\n' + JSON.stringify({ type: 'subset', name: S.cx[m].name, description: `Complex Portal CPX-${S.cx[m].ac}`, ids: cxNodes(m) }) + '\n```\n';
    const reading = `${d.g ? 'generous' : 'strict'} reading, ${['no membrane sides', "UniProt's named sides", 'named and carried sides'][d.sd] || ''}`;
    return `---
title: Back into the cell
icon: 🧫
width: 440
height: 640
open: false
order: 1
---
## ${label}

Every protein sits where the Human Protein Atlas finds it in a model cell: one dot for each place it is listed in. A link is **possible** when its two proteins share a space, **through a gate** (amber) when one known crossing lies between them, and **impossible** (red) when nothing does. Here: ${f(counts.possible)} possible, ${f(counts.gate)} through a gate, ${f(counts.impossible)} impossible (${reading}).

## Layouts

[The cell](cmd:settings.set?id=layout.nodeLayout&value=default) · [The hairball](cmd:settings.set?id=layout.nodeLayout&value=ball)

## Colour the proteins

${set('By place (the cell\'s colours)', [{ id: 'nodes.colorAttribute', value: 'original' }])}
${set('By membrane side', [{ id: 'nodes.colorAttribute', value: 'side_c' }])}
${set('By community', [{ id: 'nodes.colorAttribute', value: 'community_c' }])}
${set('By share of impossible links', [{ id: 'nodes.colorAttribute', value: 'impossible_share_n' }, { id: 'nodes.colorMethod', value: 'quantile' }])}

## Links

${set('All verdicts', [{ id: 'edges.cutoff', value: 0.3 }])}
${set('Gates and impossible only', [{ id: 'edges.cutoff', value: 0.7 }])}
${set('Impossible only', [{ id: 'edges.cutoff', value: 0.9 }])}
${set('With the copies tied', [{ id: 'edges.cutoff', value: 0 }])}

[The places as a network](cmd:window.open?type=aggregated-network&column=place_c&useGlobal=true) · [Places in the selection](cmd:window.open?type=distribution&selectedColumn=place_c&useGlobal=false)

## Complexes

${ex.map(sub).join('\n')}
[Fly to the selection](cmd:nav.flyToSubset) · [Clear](cmd:subset.clear)

## Credits

The interactome: J. Menche et al., Uncovering disease-disease relationships through the incomplete interactome, Science 347, 1257601 (2015). The places: the Human Protein Atlas (proteinatlas.org). Membrane sides and accessions: UniProt (CC BY 4.0). Complexes: the EBI Complex Portal. The judgement is the story's own method (Back into the cell), not the sources'.
`;
  }

  // ---------------------------------------------------------------- data_description.txt (section 4b: for the agent)
  function description(d, o, counts, copies, mode, label) {
    const f = n => n.toLocaleString('en-GB'), lim = d.lim || {};
    return `${label}
Exported from the story "Back into the cell" (ppicell) of the network stories app (stories.lbi-netmed.com).

What it is: ${d.own ? `a protein network chosen by its user (${o.name || 'a file'}), mapped onto` : 'the human interactome of Menche et al. (2015) put back into'} a model cell. Each protein is placed where the Human Protein Atlas finds it, on 13 places (cytosol, nucleoplasm, nucleolus, endoplasmic reticulum, Golgi, mitochondria, lysosomes, endosomes, peroxisomes, plasma membrane, nuclear envelope, cytoskeleton, vesicles). ${copies === 'all' ? 'A node is a protein in one of its places (id SYMBOL@place); a protein listed in several places has one node for each, tied to its main one by edges with verdict_c "the same protein".' : 'A node is a protein (id its symbol), drawn at its main place.'} The default layout (x, y, z) is the story's cell; the layout "ball" is the story's hairball (one spot per protein, hubs in the middle).

How links are judged (the story's own method, not the sources'): the spaces are cytosol, nucleoplasm, ER lumen, Golgi lumen, mitochondrial matrix and intermembrane space, lysosome, endosome, peroxisome and outside the cell. Two proteins can bind only where they share one: "possible"; "through a gate" when one known crossing lies between them (nuclear pores; import into the ER, mitochondria and peroxisomes; vesicles); "impossible" otherwise. Membrane proteins are placed on a side of their membrane from UniProt where it is known. Settings of this export: ${d.g ? 'generous' : 'strict'} reading of unknown sides; sides ${['none', 'named by UniProt', 'named and carried'][d.sd]}; least support ${lim.sup === undefined ? 'any' : `step ${lim.sup + 1}`}; ${lim.pls === 8191 || lim.pls === undefined ? 'all places counted' : 'some places not counted'}; communities ${d.com ? 'on' : 'off'}; edges exported: ${mode}.
Counts: ${f(counts.nodes)} nodes, ${f(counts.links)} links (${f(counts.possible)} possible, ${f(counts.gate)} through a gate, ${f(counts.impossible)} impossible, ${f(counts.notContact)} not a contact, ${f(counts.unplaced)} with an end without a place), ${f(counts.ties)} ties between copies.

Columns: place_c the node's place; places_a and main_places_a all the protein's places and the Atlas's main ones; reliability_c the Atlas's reliability; side_c the membrane side at this place (UniProt; "side not told" and "not in UniProt" are unknown), side_basis_c named (UniProt names the place) or carried (only the protein's own topology says it), side_evidence_c, membrane_layer_c (mitochondria and nuclear envelope); community_c communities within each place (label propagation, the story's); degree_n all the protein's links; possible_n, gate_n, impossible_n, not_judged_n its links by verdict; impossible_share_n impossible of the judged; complexes_a and complex_ids_a the Complex Portal's complexes it is in, complex_apart_c whether one of them has members that cannot meet. Edges: verdict_c, severity_n (0 the same protein, 1 not judged, 2 possible, 3 through a gate, 4 impossible), emphasis_n the same as the opacity and width use (0, 0.05, 0.15, 0.6, 1), evidence_a the kinds of evidence, kinds_n how many, in_complex_c both ends in one complex, drawn_c and drawn_n whether the story draws it at these limits${d.score ? ', score_n the file\'s score' : ''}.

Sources and credit: the interactome: J. Menche, A. Sharma, M. Kitsak, S. D. Ghiassian, M. Vidal, J. Loscalzo, A.-L. Barabasi, Science 347, 1257601 (2015), used with Jorg Menche's permission. Places: the Human Protein Atlas's subcellular locations (proteinatlas.org; its licence, as far as we know CC BY-SA, is to confirm). Membrane sides and accessions: UniProtKB/Swiss-Prot (CC BY 4.0), The UniProt Consortium, Nucleic Acids Research 53, D609 (2025). Complexes: the EBI Complex Portal (Meldal et al., Nucleic Acids Research 50, D578 (2022); terms to confirm). Gene numbers: NCBI Gene. Never patient or variant data.
`;
  }

  // ---------------------------------------------------------------- a ZIP made in the page (stored, not compressed)
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ c >>> 1 : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ c >>> 8; return (c ^ -1) >>> 0; };
  // files { path: text or bytes } as one .zip (UTF-8 names, a fixed date: the same files make the same bytes)
  function zip(fs) {
    const enc = new TextEncoder(), parts = [], cen = [];
    const DATE = (2026 - 1980) << 9 | 1 << 5 | 1, TIME = 0;
    const h = (n, sig) => { const b = new DataView(new ArrayBuffer(n)); b.setUint32(0, sig, true); return b; };
    let off = 0;
    for (const [name, v] of Object.entries(fs)) {
      const nb = enc.encode(name), data = typeof v === 'string' ? enc.encode(v) : v, crc = crc32(data);
      const lo = h(30, 0x04034b50);
      [[4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, TIME, 2], [12, DATE, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, nb.length, 2], [28, 0, 2]]
        .forEach(([at, x, s]) => (s === 2 ? lo.setUint16(at, x, true) : lo.setUint32(at, x, true)));
      const ce = h(46, 0x02014b50);
      [[4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, TIME, 2], [14, DATE, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, nb.length, 2], [30, 0, 2], [32, 0, 2],
        [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, off, 4]].forEach(([at, x, s]) => (s === 2 ? ce.setUint16(at, x, true) : ce.setUint32(at, x, true)));
      parts.push(new Uint8Array(lo.buffer), nb, data); cen.push(new Uint8Array(ce.buffer), nb);
      off += 30 + nb.length + data.length;
    }
    const csize = cen.reduce((s, b) => s + b.length, 0), n = Object.keys(fs).length, end = h(22, 0x06054b50);
    end.setUint16(8, n, true); end.setUint16(10, n, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
    const all = parts.concat(cen, [new Uint8Array(end.buffer)]), out = new Uint8Array(all.reduce((s, b) => s + b.length, 0));
    let at = 0;
    for (const b of all) { out.set(b, at); at += b.length; }
    return out;
  }
  // what to do with the files, for the ZIP's own HOW-TO-OPEN.txt and the command line
  const howTo = entry => `This folder is a dataset for wwiznet (asdf10k), the Menche lab's 3D network explorer
(github.com/menchelab/wwiznet_dist), exported by the story "Back into the cell".

1. Put the folder ${entry.folder}/ into the data/ folder of a wwiznet deployment.
2. Add this line to the "datasets" list in data/index.json (or, if there is no data/index.json, write one:
   { "version": 2, "default": "${entry.key}", "datasets": [ ${JSON.stringify(entry)} ] }):
   ${JSON.stringify(entry)}
3. Serve the deployment (python3 server.py) and open /?dataset=${entry.key}
`;
  return { files, zip, crc32, howTo, idsOf, hairball, PLACE_KEY, SIDE, PRESETS, BASE, SCALE };
})();
if (typeof module !== 'undefined') module.exports = PWIZ;
