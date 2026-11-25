// Builder C's cutter (src/SPEC.md, "Reuse"): two other stories' parts taken at build time, read-only and unchanged, each
// pasted inside a function of its own so their names never meet this story's (as packages/pass/src/build.mjs does):
//  - EXPO_CELL: Back into the cell's model cell (packages/ppicell/src/sets/cell.js, the section from "the cell (the cell
//    map's CELL ..." up to "places, spaces and faces": CELL, shellMaterial, mergeCopies and the skins' group `shells`),
//    called by sets/cell.js with what that section reads (K, THREE, clamp, v3, set, mul, perp);
//  - EXPO_GLOBE: the airports story's globe (packages/airports/main.js): the land and lakes (LAND_B64, LAKES_B64), their
//    decoders (bytes, decodeRings) and the globe's two shaders (globeMaterial, atmosphereMaterial); not its routes.
// A marker that is missing or no longer unique fails the build loudly. Rebuild this story after either source changes.
import fs from 'fs';
import path from 'path';

// the end of a top-level declaration that starts at i: its closing ';' (const) or the brace that closes its body
// (function), skipping strings, template literals (with ${} inside), comments and regular expressions (packages/pass's)
function declEnd(src, i) {
  const isFn = src.startsWith('function', i);
  let depth = 0, body = false, prev = '';
  const tpl = [];
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
    if (ch === '/' && /[(,=:[!&|?{};+\-*%<>~^]/.test(prev || ';')) {
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
// the one line that starts with s (a marker must be unique)
function lineStart(src, s, file) {
  const at = [];
  for (let i = src.indexOf(s); i >= 0; i = src.indexOf(s, i + 1)) if (i === 0 || src[i - 1] === '\n') at.push(i);
  if (at.length !== 1) throw new Error(`${file}: "${s.trim()}" starts ${at.length} lines (expected one): update packages/exposome/src/c-cut.mjs`);
  return at[0];
}
const CELL_FROM = "  // ------------------------------------------------------------ the cell (the cell map's CELL, its numbers kept)";
const CELL_TO = '  // ------------------------------------------------------------ places, spaces and faces';
const GLOBE_NAMES = ['const LAND_B64=', 'const LAKES_B64=', 'function bytes(', 'function decodeRings(', 'function globeMaterial(', 'function atmosphereMaterial('];

export function cuts(root) {
  const cf = 'packages/ppicell/src/sets/cell.js', cs = fs.readFileSync(path.join(root, cf), 'utf8');
  const i = lineStart(cs, CELL_FROM, cf), j = lineStart(cs, CELL_TO, cf);
  if (j <= i) throw new Error(`${cf}: the cell's section ends before it starts`);
  const gf = 'packages/airports/main.js', gs = fs.readFileSync(path.join(root, gf), 'utf8');
  const parts = GLOBE_NAMES.map(n => { const k = lineStart(gs, n, gf); return gs.slice(k, declEnd(gs, k)) + '\n'; });
  return `// Generated at build time by src/c-cut.mjs from ${cf} (the model cell's skins), unchanged: never edit it here.
const EXPO_CELL = function (K, THREE, clamp, v3, set, mul, perp) {
${cs.slice(i, j).trimEnd()}
  return { CELL, shells, shellMats, shellMaterial, mergeCopies };
};
// Generated at build time by src/c-cut.mjs from ${gf} (the globe's land, lakes and shaders), unchanged: never edit it here.
const EXPO_GLOBE = function () {
${parts.join('')}return { LAND_B64, LAKES_B64, bytes, decodeRings, globeMaterial, atmosphereMaterial };
};

`;
}
