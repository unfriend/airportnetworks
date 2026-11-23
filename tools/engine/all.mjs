// Rebuilds every built story whose build uses the shared engine parts (tools/engine/parts.mjs), after a part changed.
// usage (from the repository root): node tools/engine/all.mjs          -> runs each tools/<key>/build.mjs
//                                   node tools/engine/all.mjs --check  -> exits 1 if any built story is out of date
// (Not named build.mjs: the relay's --build takes every tools/<dir>/build.mjs for a story's.)
// The app's own stories moved into packages (named in packages/order.json, tools/stories.mjs) too: packages/<key>/src/
// build.mjs, which finds the parts as path.join(root, 'tools', 'engine', 'parts.mjs'). Other people's packages (not
// named there) are theirs to build again: the engine reaches them only then (tools/packages/SPEC.md).
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { stories } from '../stories.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), tools = path.join(here, '..'), root = path.join(tools, '..');
const check = process.argv.includes('--check');
const uses = f => { const t = fs.readFileSync(f, 'utf8'); return t.includes("'../engine/parts.mjs'") || t.includes("'tools', 'engine', 'parts.mjs'"); };
const builds = fs.readdirSync(tools).sort().map(k => path.join(tools, k, 'build.mjs'))
  .concat(stories(root).list.filter(s => s.pkg && s.build).map(s => path.join(root, s.build)))
  .filter(f => fs.existsSync(f) && uses(f));
const keys = builds;
let bad = 0;
for (const f of builds) {
  try { execFileSync(process.execPath, [f, ...(check ? ['--check'] : [])], { cwd: root, stdio: 'inherit' }); }
  catch (e) { bad++; }
}
console.log(`${keys.length} stories ${check ? 'checked' : 'built'}${bad ? `, ${bad} ${check ? 'out of date' : 'failed'}` : ''}`);
process.exit(bad ? 1 : 0);
