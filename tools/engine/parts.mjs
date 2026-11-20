// The engine parts the built stories share (step 1 of the packages plan, docs/agents/stories.md, "Shared engine
// parts"). A story's engine file (tools/<key>/engine/e5_xr.js ...) keeps its own code and, where a stretch of it is the
// same as in other stories, a line `//#use name name ...` that the build replaces by those parts of
// tools/engine/<the same file name>.js, in that order, joined by newlines. A parts file is a header comment, then each
// part as a line `//#part name` followed by its text. A part is a declaration with the comment block above it; a name
// with more than one shared version has the others as name~2, name~3 ...
// usage, from a build:  import { expand } from '../engine/parts.mjs';  out += expand(read('engine/e5_xr.js'), 'e5_xr');
//        report:        node tools/engine/parts.mjs   (which stories use each part; parts no story uses)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const cache = new Map();
export function parts(area) {
  if (cache.has(area)) return cache.get(area);
  const f = path.join(here, area + '.js'), P = new Map();
  if (fs.existsSync(f)) {
    const bits = fs.readFileSync(f, 'utf8').split(/^\/\/#part (\S+)\n/m);
    for (let i = 1; i < bits.length; i += 2) {
      if (P.has(bits[i])) throw new Error(`tools/engine/${area}.js names the part ${bits[i]} twice`);
      P.set(bits[i], bits[i + 1].slice(0, -1));   // each part's text ends with one newline of its own
    }
  }
  cache.set(area, P);
  return P;
}
export function expand(text, area) {
  const P = parts(area);
  return text.replace(/^\/\/#use (.+)$/gm, (_, names) => names.trim().split(/\s+/).map(n => {
    if (!P.has(n)) throw new Error(`tools/engine/${area}.js has no part ${n}`);
    return P.get(n);
  }).join('\n'));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const tools = path.join(here, '..'), used = new Map();
  for (const k of fs.readdirSync(tools).sort()) {
    const d = path.join(tools, k, 'engine');
    if (k === 'engine' || k === 'studio' || !fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter(f => /^e\d.*\.js$/.test(f))) {
      const area = f.slice(0, -3);
      for (const m of fs.readFileSync(path.join(d, f), 'utf8').matchAll(/^\/\/#use (.+)$/gm))
        for (const n of m[1].trim().split(/\s+/)) {
          const key = area + ' ' + n;
          if (!used.has(key)) used.set(key, []);
          used.get(key).push(k);
        }
    }
  }
  let unused = 0;
  for (const f of fs.readdirSync(here).filter(f => /^e\d.*\.js$/.test(f)).sort()) {
    const area = f.slice(0, -3);
    console.log(`${f}:`);
    for (const n of parts(area).keys()) {
      const who = used.get(area + ' ' + n) || [];
      if (!who.length) unused++;
      console.log(`  ${n.padEnd(24)} ${who.length ? who.join(' ') : '(no story uses it)'}`);
    }
  }
  if (unused) console.log(`${unused} parts no story uses`);
}
