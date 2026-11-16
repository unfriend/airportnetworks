// node tools/studio/unity/check.mjs <scene folder>
// Where each object of a scene's layout.json stands, from its GLB's own bounds (the accessors' min and max, through its
// nodes) and its place: size, lowest and highest point, middle. A quick look at an import without drawing anything:
// a floor should come out near y = 0, scans of one room should overlap, and nothing should be kilometres off.
import fs from 'node:fs';
import path from 'node:path';
import { M } from './unity.mjs';

const dir = path.resolve(process.argv[2] || '');
const layout = JSON.parse(fs.readFileSync(path.join(dir, 'layout.json'), 'utf8'));
const glbCache = new Map();
function boundsOf(file) {
  if (glbCache.has(file)) return glbCache.get(file);
  const b = fs.readFileSync(path.join(dir, ...file.split('/'))), j = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  const mat = n => n.matrix ? n.matrix : M.compose(n.translation || [0, 0, 0], n.rotation || [0, 0, 0, 1], n.scale || [1, 1, 1]);
  const pts = [];
  const walk = (i, W) => {
    const n = j.nodes[i], Wn = M.mul(W, mat(n));
    if (n.mesh !== undefined) for (const p of j.meshes[n.mesh].primitives) {
      const a = j.accessors[p.attributes.POSITION];
      if (!a.min) continue;
      for (const x of [a.min[0], a.max[0]]) for (const y of [a.min[1], a.max[1]]) for (const z of [a.min[2], a.max[2]]) pts.push(M.apply(Wn, [x, y, z]));
    }
    (n.children || []).forEach(c => walk(c, Wn));
  };
  j.scenes[j.scene || 0].nodes.forEach(i => walk(i, M.identity()));
  glbCache.set(file, pts);
  return pts;
}
const f = v => v.toFixed(2).padStart(7);
console.log('object'.padEnd(44), '     size x/y/z (m)          low y   high y   middle x/z');
for (const o of layout.objects) {
  const Mi = M.compose(o.p, o.q, [o.s, o.s, o.s]);
  const pts = boundsOf(o.file).map(p => M.apply(Mi, p));
  if (!pts.length) { console.log(o.name.padEnd(44), '(no bounds)'); continue; }
  const lo = [0, 1, 2].map(k => Math.min(...pts.map(p => p[k]))), hi = [0, 1, 2].map(k => Math.max(...pts.map(p => p[k])));
  console.log(o.name.slice(0, 44).padEnd(44), [0, 1, 2].map(k => f(hi[k] - lo[k])).join(''), f(lo[1]), f(hi[1]), f((lo[0] + hi[0]) / 2), f((lo[2] + hi[2]) / 2));
}
for (const c of layout.cubes || []) console.log(`cube ${c.name.padEnd(39)}`, c.size.map(f).join(''), f(c.p[1] - c.size[1] / 2), f(c.p[1] + c.size[1] / 2), f(c.p[0]), f(c.p[2]));
for (const s of layout.sounds || []) console.log(`sound ${s.name.padEnd(38)} at`, s.p.map(f).join(''), 'r', s.r);
