// The export for wwiznet (src/sets/pwiz.js, src/export-wwiznet.mjs; SPEC.md, "Export for wwiznet"): its files follow
// wwiznet's docs/for_agents/data-folder-setup.md (headers, column-kind suffixes, ids matching between nodes and edges,
// numbers finite, layout triples, config.json's keys and preset fields among the guide's, every column the config and
// the guide window name present), on a made-up network of a dozen proteins and on the built-in map; the built-in export
// is the same twice and its counts are pnet.js's; the ZIP made in the page reads back.
// usage: node packages/ppicell/src/data/test-wiz.mjs
import { loadCell, exportWith } from '../export-wwiznet.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FIXTURE } from './wiz-fixture.mjs';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };


// the guide's keys (data-folder-setup.md 4.2 and 4.8) and preset fields (4.3)
const KEYS = new Set(['version', 'exportType', 'schemaVersion', 'dataset', 'nodeLayout', 'customLayoutColumns', 'presets', 'lastUsedPreset', 'subsetListLibrary', 'subsetBuilderLibrary',
  'openWindows', 'tooltips', 'tooltipFetchIdAttribute', 'window_molecular', 'edgeHighlightSettings', 'sliderRanges', 'presentationMode', 'ar', 'xrTooltipMaxDistanceMeters',
  'xrToggleMaxDistanceMeters', 'metadataCache', 'agentBackendUrl', 'localStorage']);
const FIELDS = new Set(['schemaVersion', 'nodeColorAttribute', 'nodeColorScalingMethod', 'nodeSizeAttribute', 'nodeSizeScalingMethod', 'nodeSizeScaling', 'nodeMinSize', 'edgeColorAttribute',
  'edgeColorScalingMethod', 'edgeWidthAttribute', 'edgeWidthScalingMethod', 'edgeWidthScaling', 'edgeMinWidth', 'edgeOpacity', 'edgeBlending', 'edgeAlphaAttribute', 'edgeAlphaMin',
  'edgeAlphaMax', 'edgeFadeDistance', 'edgeCutoffAttribute', 'edgeCutoff', 'highlightNodesEnabled', 'highlightNodeSizeScale', 'highlightEdgesEnabled', 'highlightEdgeWidthScale',
  'highlightEdgeOpacity', 'fadeOtherEdgesEnabled', 'fadeOtherEdgesOpacity', 'subsetEdgesOnly', 'edgeSubsetMode', 'bloomMode', 'bloomStrength', 'bloomRadius', 'bloomThreshold',
  'enabled', 'distance', 'resolutionScale', 'enableDynamicResolution', 'targetFPS', 'cameraPosition', 'cameraRotation']);
const SUFFIX = /(_n|_norm|_c|_a|_kv|_c_kv)$/, PLAIN = new Set(['id', 'name', 'x', 'y', 'z', 'color']), NUMERIC = /(_n|_norm)$/;
const readTsv = t => { const L = t.replace(/\n$/, '').split('\n').map(l => l.split('\t')); return { head: L[0], rows: L.slice(1) }; };

// every rule a dataset's files must keep; tag names the case in the messages
function checkFiles(res, tag) {
  const F = res.files, N = readTsv(F['nodes.tsv']), E = readTsv(F['edges.tsv']), cfg = JSON.parse(F['config.json']);
  ok(N.head[0] === 'id' && E.head[0] === 'source' && E.head[1] === 'target', `${tag}: id first in nodes.tsv, source and target first in edges.tsv`);
  const kinds = (h, extra) => h.every(c => PLAIN.has(c) || extra.has(c) || SUFFIX.test(c) || /^[xyz]_[a-z0-9]+$/.test(c));
  ok(kinds(N.head, new Set()) && kinds(E.head, new Set(['source', 'target'])), `${tag}: every column named by its kind's suffix (or one of the guide's plain ones)`);
  const lays = N.head.filter(c => /^x_[a-z0-9]+$/.test(c)).map(c => c.slice(2));
  ok(lays.length >= 1 && lays.every(l => N.head.includes('y_' + l) && N.head.includes('z_' + l)) && ['x', 'y', 'z'].every(c => N.head.includes(c)), `${tag}: layouts in complete triples (default, ${lays.join(', ')})`);
  const ids = new Set(N.rows.map(r => r[0]));
  ok(ids.size === N.rows.length && [...ids].every(i => /^[A-Za-z0-9._@-]+$/.test(i)), `${tag}: ${N.rows.length} unique node ids, no spaces or commas`);
  ok(E.rows.every(r => ids.has(r[0]) && ids.has(r[1])), `${tag}: every edge's ends among the node ids (${E.rows.length} edges)`);
  ok([N, E].every(T => T.rows.every(r => r.length === T.head.length)), `${tag}: every row as long as its header, no tab or newline inside a cell`);
  const fin = T => T.head.every((c, j) => !(NUMERIC.test(c) || ['x', 'y', 'z'].includes(c) || /^[xyz]_/.test(c)) || T.rows.every(r => r[j] === '' || Number.isFinite(+r[j])));
  ok(fin(N) && fin(E), `${tag}: every number finite`);
  ok([N, E].every(T => T.head.every((c, j) => c !== 'color' || T.rows.every(r => /^#[0-9a-f]{6}$/.test(r[j])))), `${tag}: colours as #rrggbb`);
  ok(cfg.version === 1 && cfg.exportType === 'asdf10k-local-storage' && Object.keys(cfg).every(k => KEYS.has(k)), `${tag}: config.json version 1, its exportType, only the guide's keys`);
  const cols = new Set(N.head.concat(E.head, ['original', 'uniform', 'none']));
  const pr = Object.values(cfg.presets);
  ok(cfg.presets[cfg.lastUsedPreset] && pr.every(p => Object.keys(p).every(k => FIELDS.has(k))), `${tag}: ${pr.length} presets, only the guide's fields, lastUsedPreset among them`);
  ok(pr.every(p => ['nodeColorAttribute', 'nodeSizeAttribute', 'edgeColorAttribute', 'edgeWidthAttribute', 'edgeAlphaAttribute', 'edgeCutoffAttribute'].every(k => p[k] === undefined || cols.has(p[k]))), `${tag}: every column a preset names exists`);
  ok(cfg.nodeLayout === 'default' || lays.includes(cfg.nodeLayout), `${tag}: the layout at start exists`);
  ok(cfg.subsetListLibrary.every(s => s.namesText.split(' ').every(i => ids.has(i))), `${tag}: the node lists name existing ids`);
  ok(cfg.subsetBuilderLibrary.every(s => (s.formula.match(/[a-z_]+_(n|c|a)\b/g) || []).every(c => cols.has(c))), `${tag}: the formulas name existing columns`);
  const md = F['custom_windows/cell/window.md'], named = [...md.matchAll(/"value":"([^"]+)"/g)].map(m => m[1]).filter(v => /_(n|c|a)$/.test(v));
  ok(JSON.parse(F['custom_windows/index.json'])[0] === 'cell' && named.every(c => cols.has(c)) && [...md.matchAll(/nodeLayout&value=([a-z0-9]+)/g)].every(m => m[1] === 'default' || lays.includes(m[1])),
    `${tag}: the guide window's buttons name existing columns and layouts`);
  ok([...md.matchAll(/```asdf10k\n(.*)\n```/g)].every(m => { try { JSON.parse(m[1]); return true; } catch (e) { return false; } }), `${tag}: the guide window's cards are JSON`);
  return { N, E };
}

// ---- the made-up network
const C = loadCell(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ppicell-wiz-')), fx = path.join(dir, 'fixture.tsv');
fs.writeFileSync(fx, FIXTURE);
const own = exportWith(C, { net: fx });
const { N: fN, E: fE } = checkFiles(own, 'made-up network');
ok(fE.head.includes('score_n') && fN.head.includes('in_map_c') && own.counts.links === 12, `made-up network: its 12 links, a score column and in_map_c`);
const ownMain = exportWith(C, { net: fx, copies: 'main' });
checkFiles(ownMain, 'made-up network, a node per protein');
ok(readTsv(ownMain.files['nodes.tsv']).rows.every(r => r[0] === r[1]), 'a node per protein: the ids are the symbols (what enrichr.py reads)');
// ---- the built-in map: the same twice (a fresh cell each time), its counts pnet.js's
const t0 = performance.now(), A = exportWith(loadCell(), {}), t1 = performance.now(), B = exportWith(loadCell(), {});
checkFiles(A, 'the map');
ok(Object.keys(A.files).every(f => A.files[f] === B.files[f]), `the map: the same files twice (${((t1 - t0) / 1000).toFixed(1)} s)`);
const P = C.PDATA, S = loadCell(), J = [0, 0, 0];
{ const PS = (await import('module')).createRequire(import.meta.url)('../sets/psides.js'); for (let i = 0; i < P.E; i++) { const j = PS.judge(i, false, true); if (j >= 0) J[j]++; } }
const c = A.counts;
ok(c.possible === J[0] && c.gate === J[1] && c.impossible === J[2], `the map: ${c.possible} possible, ${c.gate} through a gate, ${c.impossible} impossible, as PSIDES.judge (strict, carried)`);
const ver = readTsv(A.files['edges.tsv']).rows.reduce((m, r) => { m[r[3]] = (m[r[3]] || 0) + 1; return m; }, {});
ok(ver.possible === J[0] && ver['through a gate'] === J[1] && ver.impossible === J[2] && ver['the same protein'] === P.L - [...Array(P.N).keys()].filter(p => P.pl[p]).length, 'the map: edges.tsv\'s verdicts the same, and a tie for each copy beyond a protein\'s first');
const all = exportWith(S, { edges: 'all' });
ok(all.counts.links === P.E && all.counts.notContact + all.counts.unplaced + all.counts.possible + all.counts.gate + all.counts.impossible === P.E, `--edges all: every one of the map's ${P.E} links`);
// ---- the ZIP made in the page: its entries and their CRCs read back
const z = C.PWIZ.zip({ 'a/b.txt': 'hello', 'a/c.tsv': 'x\ty\n' }), dv = new DataView(z.buffer), end = z.length - 22;
const n = dv.getUint16(end + 10, true), cd = dv.getUint32(end + 16, true);
let at = cd, names = [];
for (let i = 0; i < n; i++) { const ln = dv.getUint16(at + 28, true); names.push(Buffer.from(z.subarray(at + 46, at + 46 + ln)).toString()); const off = dv.getUint32(at + 42, true), crc = dv.getUint32(at + 16, true), sz = dv.getUint32(at + 20, true), nl = dv.getUint16(off + 26, true);
  ok(C.PWIZ.crc32(z.subarray(off + 30 + nl, off + 30 + nl + sz)) === crc, `the ZIP: ${names[i]}'s CRC`); at += 46 + ln; }
ok(dv.getUint32(end, true) === 0x06054b50 && names.join() === 'a/b.txt,a/c.tsv' && C.PWIZ.crc32(new TextEncoder().encode('123456789')) === 0xCBF43926, 'the ZIP: its directory, and CRC-32 of 123456789 = CBF43926');
console.log(bad ? `${bad} failed` : 'all ok');
process.exit(bad ? 1 : 0);
