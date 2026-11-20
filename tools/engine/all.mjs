// Rebuilds every built story whose build uses the shared engine parts (tools/engine/parts.mjs), after a part changed.
// usage (from the repository root): node tools/engine/all.mjs          -> runs each tools/<key>/build.mjs
//                                   node tools/engine/all.mjs --check  -> exits 1 if any built story is out of date
// (Not named build.mjs: the relay's --build takes every tools/<dir>/build.mjs for a story's.)
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), tools = path.join(here, '..'), root = path.join(tools, '..');
const check = process.argv.includes('--check');
const keys = fs.readdirSync(tools).sort().filter(k => {
  const f = path.join(tools, k, 'build.mjs');
  return fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes("'../engine/parts.mjs'");
});
let bad = 0;
for (const k of keys) {
  try { execFileSync(process.execPath, [path.join(tools, k, 'build.mjs'), ...(check ? ['--check'] : [])], { cwd: root, stdio: 'inherit' }); }
  catch (e) { bad++; }
}
console.log(`${keys.length} stories ${check ? 'checked' : 'built'}${bad ? `, ${bad} ${check ? 'out of date' : 'failed'}` : ''}`);
process.exit(bad ? 1 : 0);
