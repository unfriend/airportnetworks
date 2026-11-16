// node tools/studio/unity/corners.mjs <unity project> <scene.unity> <scene folder> <object id>
// One imported object measured against Unity, independently of the importer's placing: the corners of its drawing as
// Unity draws them (Z · W_parents · L · X · S_unity on the mesh's own box, L the placement's transform as the scene
// overrides it), and as the studio draws them (the layout's p, q, s, then the GLB's nodes down to the mesh). For a model
// whose single node Unity makes the prefab's root (an FBX with one top node, preserveHierarchy off): the case where the
// scene's transform replaces the node's own. Prints both boxes in the studio's frame (x, y, z ranges in metres).
//   node tools/studio/unity/corners.mjs C:/Users/john/Documents/dancequest/testquestpt2 \
//     C:/Users/john/Documents/dancequest/testquestpt2/Assets/offline_dominik_mitvideo.unity tools/studio/test/local/dancequest2 xg57p6
import fs from 'node:fs';
import path from 'node:path';
import { guidMap, parseDocs, field, ref, vec, modifications, readModelMeta, M } from './unity.mjs';

const [project, sceneFile, dir, objId] = process.argv.slice(2);
if (!objId) { console.log('usage: node tools/studio/unity/corners.mjs <unity project> <scene.unity> <scene folder> <object id>'); process.exit(1); }
const layout = JSON.parse(fs.readFileSync(path.join(dir, 'layout.json'), 'utf8')), record = JSON.parse(fs.readFileSync(path.join(dir, '.import.json'), 'utf8'));
const o = layout.objects.find(x => x.id === objId);
const key = Object.keys(record.ids).find(k => record.ids[k] === objId);
if (!o || !key || !key.startsWith('pi:')) { console.log(`${objId}: not a placed model of this import`); process.exit(1); }
const docs = parseDocs(fs.readFileSync(sceneFile, 'utf8')), guids = guidMap(path.resolve(project));
const pi = docs.get(key.slice(3)), mods = modifications(pi.body);
const TRS = b => { const p = vec(field(b, 'm_LocalPosition')), q = vec(field(b, 'm_LocalRotation')), s = vec(field(b, 'm_LocalScale')); return M.compose([p.x, p.y, p.z], [q.x, q.y, q.z, q.w], [s.x, s.y, s.z]); };
let W = M.identity();
for (let t = ref((/m_TransformParent: (\{[^}]*\})/.exec(pi.body))[1]).fileID; t && t !== '0'; t = ref(field(docs.get(t).body, 'm_Father')).fileID) W = M.mul(TRS(docs.get(t).body), W);
// the model file and Unity's import of it: units (an FBX's UnitScaleFactor / 100 when it converts units) and scale
const src = guids.get((/m_SourcePrefab: \{[^}]*guid: (\w+)/.exec(pi.body) || [])[1]);
const meta = readModelMeta(src, guids) || { useFileScale: 1, globalScale: 1 };
const unitScale = file => {
  const b = fs.readFileSync(file), i = b.indexOf('UnitScaleFactor');
  if (i < 0) return 1;
  if (b.slice(0, 18).toString('latin1') === 'Kaydara FBX Binary') {
    let p = i + 15;
    for (let k = 0; k < 3; k++) { if (b[p] !== 0x53) return 1; p += 5 + b.readUInt32LE(p + 1); }
    return b[p] === 0x44 ? b.readDoubleLE(p + 1) : b[p] === 0x46 ? b.readFloatLE(p + 1) : 1;
  }
  const m = /UnitScaleFactor"\s*,\s*"[^"]*"\s*,\s*"[^"]*"\s*,\s*"[^"]*"\s*,\s*([-\d.eE+]+)/.exec(b.slice(i - 1, i + 200).toString('latin1'));
  return m ? +m[1] : 1;
};
const su = (meta.useFileScale && /\.fbx$/i.test(src) ? unitScale(src) / 100 : 1) * meta.globalScale;
// the GLB: its mesh node, the mesh's own box, the node chain down to it
const b = fs.readFileSync(path.join(dir, ...o.file.split('/'))), j = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8'));
const mi = j.nodes.findIndex(n => n.mesh !== undefined), acc = j.meshes[j.nodes[mi].mesh].primitives.map(p => j.accessors[p.attributes.POSITION]);
const lo = [0, 1, 2].map(k => Math.min(...acc.map(a => a.min[k]))), hi = [0, 1, 2].map(k => Math.max(...acc.map(a => a.max[k])));
const corners = [];
for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) corners.push([x, y, z]);
const mat = n => (n.matrix ? n.matrix.slice() : M.compose(n.translation || [0, 0, 0], n.rotation || [0, 0, 0, 1], n.scale || [1, 1, 1]));
const parentOf = i => j.nodes.findIndex(n => (n.children || []).includes(i));
let chain = M.identity();
for (let i = mi; i >= 0; i = parentOf(i)) chain = M.mul(mat(j.nodes[i]), chain);
// the placement's transform: the scene's overrides of the prefab's root (a value it does not override: the node's own,
// as the GLB holds it, Unity's x mirror applied)
const rootT = mods.find(m => m.path === 'm_RootOrder')?.target.fileID;
const ov = (p, d) => { const m = mods.find(x => x.target.fileID === rootT && x.path === p); return m ? +m.value : d; };
const nd = M.decompose(mat(j.nodes[mi]));
const L = M.compose(['x', 'y', 'z'].map((a, k) => ov('m_LocalPosition.' + a, (k === 0 ? -1 : 1) * nd.p[k] * su)), ['x', 'y', 'z', 'w'].map((a, k) => ov('m_LocalRotation.' + a, (k === 1 || k === 2 ? -1 : 1) * nd.q[k])), ['x', 'y', 'z'].map((a, k) => ov('m_LocalScale.' + a, nd.s[k])));
const box = pts => [0, 1, 2].map(k => [Math.min(...pts.map(p => p[k])), Math.max(...pts.map(p => p[k]))].map(v => v.toFixed(3)).join(' … ')).join('   ');
const unity = M.mul(M.scale(1, 1, -1), M.mul(W, M.mul(L, M.mul(M.scale(-1, 1, 1), M.scale(su)))));
const studio = M.mul(M.compose(o.p, o.q, [o.s, o.s, o.s]), chain);
console.log(`${o.name} (${o.file}), its mesh ${j.nodes[mi].name || mi}`);
console.log('  Unity   ', box(corners.map(c => M.apply(unity, c))));
console.log('  studio  ', box(corners.map(c => M.apply(studio, c))));
