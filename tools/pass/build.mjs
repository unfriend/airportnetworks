// Assembles stories/pass.js from the tour's kit (tools/lbi/kit.js), the airports story's globe and the cell map story's
// cell (taken from stories/airports.js and stories/spatial.js as they are, see ORIGINALS), the sets and the engine parts
// in this folder.
// usage (from the repository root): node tools/pass/build.mjs        -> writes stories/pass.js (and gen/, for the harness)
//                                   node tools/pass/build.mjs --check -> exits 1 if stories/pass.js is out of date
// Rebuild after any change to stories/airports.js or stories/spatial.js too: the globe and the cell come from there.
import fs from 'fs';
import path from 'path';
const here = path.dirname(new URL(import.meta.url).pathname), root = path.join(here, '../..');
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
const SET_FILES = ['fish', 'globe', 'cell'];
const ENGINE = ['e2_scene', 'e2_text', 'e3_story', 'e4_explore', 'e5_xr', 'e6_panels', 'e7_app'];

// ---------------------------------------------------------------- the originals
// Each original story is cut into whole sections (from a line that starts with `from` up to the line that starts with
// `to`, not included) and whole top-level declarations by name (`function name` or `const name`), pasted in its own
// order inside a function of their own, so their names (GL, NET, buildScene ...) never meet the engine's or each
// other's. Nothing in them is changed: the sets wrap them (see sets/globe.js and sets/cell.js). `glue` is the little
// the cut-out code still needs from the parts left out, and `out` what the function returns.
const ORIGINALS = [
  { name: 'PASS_AIRPORTS', file: 'stories/airports.js', what: "the airports story's globe: its data, airports, pillars, routes, shaders and scene",
    sections: [
      ['const NET_B64=', '// Narration timing'],                     // the routes, the land and the lakes; D2R, LIFT
      ['const COMM_NAMES', '// ------------------------------------------------------------------ camera --'],   // network, maths, geometry, shaders, scene
    ],
    names: ['matches', 'findAirport'],
    glue: '',
    out: 'NET, A, GL, buildScene, matches, findAirport, setHighlight, setPathAttribute, arcPoints, tubeGeometry, mulberry, bfs, bestPath, connectivity, km, LIFT, D2R, STATS, HOP_DIST, COMM_NAMES, COMM_COLORS, INTER_COLOR, PATH_COL, PATH_A' },
  { name: 'PASS_SPATIAL', file: 'stories/spatial.js', what: "the cell map story's cell: its places, proteins, links, moves, layout, shaders and scene",
    sections: [
      ['// Spatial interactome data', '// ------------------------------------------------------------------ camera --'],   // data, network, cell, layout, curves, shaders, scene
    ],
    names: ['present', 'proteinReach', 'placeStats', 'TRV', 'travelPoint', '_tp', 'setActors', 'bestPath', 'reachInfo', 'partnersByPlace',
      'placeName', 'placeShort', 'matches', 'findProtein', 'wherePlaces'],
    // (the explore section's isThere reads how far each move has gone from its own state: here SCEN, set by the cell set)
    glue: 'const SCEN = new Array(8).fill(0);\nconst isThere = c => present(c, SCEN);\n',
    out: 'PLACES, CONTACTS, MOVES, NET, A, CP, CELL, LAYOUT, POS, cpos, latLonOf, PLACE_COL, placeCss, travelCurve, linkCurve, GL, ORGS, ORG_OF_PLACE, buildScene, setHighlight, setFocus, SIG, SIG_A, SIG_DOT, TRV, travelPoint, setActors, present, proteinReach, placeStats, bestPath, reachInfo, partnersByPlace, placeName, placeShort, matches, findProtein, wherePlaces, SCEN, isThere, mulberry, v3' },
];

// the end of a top-level declaration that starts at i: its closing ';' (const) or the brace that closes its body
// (function), skipping strings, template literals (with ${} inside), comments and regular expressions
function declEnd(src, i) {
  const isFn = src.startsWith('function', i);
  let depth = 0, body = false, prev = '';
  const tpl = [];   // template nesting: the brace depth at each ${
  while (i < src.length) {
    const ch = src[i], nx = src[i + 1];
    if (ch === '/' && nx === '/') { i = src.indexOf('\n', i); continue; }
    if (ch === '/' && nx === '*') { i = src.indexOf('*/', i) + 2; continue; }
    if (ch === "'" || ch === '"') { i++; while (src[i] !== ch) i += src[i] === '\\' ? 2 : 1; i++; prev = 'a'; continue; }
    if (ch === '`' || (ch === '}' && tpl.length && tpl[tpl.length - 1] === depth)) {
      if (ch === '}') tpl.pop();
      i++;
      while (src[i] !== '`') { if (src[i] === '\\') { i += 2; continue; } if (src[i] === '$' && src[i + 1] === '{') { tpl.push(depth); i += 2; break; } i++; }
      if (src[i] === '`') { i++; prev = 'a'; }
      continue;
    }
    if (ch === '/' && /[(,=:[!&|?{};+\-*%<>~^]/.test(prev || ';')) {   // a regular expression
      i++; let cls = false;
      while (cls || src[i] !== '/') { if (src[i] === '\\') i++; else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; i++; }
      i++; while (/[a-z]/.test(src[i])) i++; prev = 'a'; continue;
    }
    if ('([{'.includes(ch)) { if (ch === '{' && depth === 0) body = true; depth++; }
    else if (')]}'.includes(ch)) { depth--; if (isFn && body && depth === 0) return i + 1; }
    else if (ch === ';' && depth === 0 && !isFn) return i + 1;
    if (!/\s/.test(ch)) prev = ch;
    i++;
  }
  throw new Error('unterminated declaration');
}
const lineStart = (src, s, file) => {
  const at = [];
  for (let i = src.indexOf(s); i >= 0; i = src.indexOf(s, i + 1)) if (i === 0 || src[i - 1] === '\n') at.push(i);
  if (at.length !== 1) throw new Error(`${file}: "${s}" starts ${at.length} lines (expected one): update ORIGINALS in tools/pass/build.mjs`);
  return at[0];
};
function original(o) {
  const src = fs.readFileSync(path.join(root, o.file), 'utf8');
  const parts = o.sections.map(([a, b]) => {
    const i = lineStart(src, a, o.file), j = lineStart(src, b, o.file);
    if (j <= i) throw new Error(`${o.file}: "${b}" comes before "${a}"`);
    return src.slice(i, j).trimEnd() + '\n';
  });
  for (const n of o.names) {
    const i = (() => { try { return lineStart(src, `function ${n}(`, o.file); } catch (e) { return lineStart(src, `const ${n} =`, o.file); } })();
    parts.push(src.slice(i, declEnd(src, i)) + '\n');
  }
  return `// Generated by tools/pass/build.mjs from ${o.file} (${o.what}), unchanged: never edit this, edit the original and
// rebuild. Sections: ${o.sections.map(s => `"${s[0]}" to "${s[1]}"`).join('; ')}${o.names.length ? `; and ${o.names.join(', ')}` : ''}.
const ${o.name} = function (HOST) {
'use strict';
${parts.join('')}
// ---- glue (tools/pass/build.mjs)
${o.glue}return { ${o.out} };
};
`;
}
const gen = ORIGINALS.map(original);

// ---------------------------------------------------------------- the story
let kit = read('../lbi/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
const sets = gen.join('\n') + '\n' + SET_FILES.map(f => read(`sets/${f}.js`).trimEnd() + '\n\n').join('');
let out = read('engine/e1_head.js').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += read(`engine/${f}.js`);
const target = path.join(root, 'stories/pass.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'stories/pass.js is up to date' : 'stories/pass.js is out of date: run node tools/pass/build.mjs');
  process.exit(same ? 0 : 1);
}
// (the harness loads the cut-out originals from gen/, which is not committed: run this before using the harness)
fs.mkdirSync(path.join(here, 'gen'), { recursive: true });
ORIGINALS.forEach((o, k) => fs.writeFileSync(path.join(here, `gen/${o.name.toLowerCase().replace('pass_', '')}.js`), gen[k]));
fs.writeFileSync(target, out);
console.log(`wrote stories/pass.js (${(out.length / 1024).toFixed(0)} KB) and tools/pass/gen/`);
