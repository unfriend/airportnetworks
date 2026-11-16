// node tools/studio/unity/import.mjs <unity project> <scene.unity> <object path> <out folder>
//        [--max-texture 2048] [--texture-of <words>=<px> ...] [--tris 150000] [--tris-of <words>=<n> ...] [--skip <name> ...]
//        [--small-under 1] [--small-keep 0.3] [--light auto|lit|scan] [--mirror x|z] [--merge-copies] [--dry] [--force]
//        (Playwright as for tools/studio/convert.mjs: PLAYWRIGHT_MODULE; ffmpeg on the PATH for sounds and pictures)
// One part of a Unity scene made a studio scene (tools/studio/unity/README.md): everything under <object path> (the
// names of GameObjects from the scene's top, joined by /, e.g. Environment/Enviroment/Atelier) that is active, or that a
// trigger or a timeline shows. Models (FBX) become GLBs by the studio's own converter (tools/studio/convert.mjs: textures
// drawn down to --max-texture, a model over --tris triangles made lighter to that many), placed where Unity has them;
// ObjectsToTrigger boxes become trigger cubes (copies of one door in each world one cube); Timelines become recorded paths
// and sequences; AudioSources become sounds (mono MP3 by ffmpeg); built-in cubes, spheres, cylinders and planes become
// shapes. What is not ported (lights, particles, other scripts) is listed at the end.
// The out folder is a scene folder: models/, sounds/, pictures/, recordings/, layout.json, and .import.json (what was
// made from what, so a run again converts only what changed and keeps every item's id; files a run no longer uses are
// removed). Never inside the repository (the owner's own files): tools/studio/test/local/ is git-ignored for this.
// --dry lists what would be made and converts nothing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { guidMap, parseDocs, field, ref, vec, block, refs, modifications, readMaterial, isUnlit, readModelMeta, M } from './unity.mjs';
import { readDirectors, directorTime, trackPose, activeAt, takeRuns, actRuns, controllerRoot, controllerPose } from './timeline.mjs';
import { addFirstFrame, plainColour, clipLength, cropAnimations, fbxFrameRate, readGlb, writeGlb } from './glb.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../../..');
const argv = process.argv.slice(2), flag = n => argv.includes('--' + n);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const OPTS = new Set(['max-texture', 'tris', 'light', 'mirror', 'texture-of', 'tris-of', 'skip', 'small-under', 'small-keep']);
// --skip <name>, as often as needed: a part of the scene left out by its GameObject's name, with all it holds
const SKIP = new Set(argv.map((a, i) => (a === '--skip' ? argv[i + 1] : null)).filter(Boolean));
const pos = argv.filter((a, i) => !a.startsWith('--') && !OPTS.has((argv[i - 1] || '').slice(2)));
// --texture-of <words in the model's path>=<px>, as often as needed: those models' textures drawn down further (the
// first that matches; the bat scans, small and high up: --texture-of Fledermaus_01=1024)
const TEX_OF = argv.map((a, i) => (a === '--texture-of' ? argv[i + 1] : null)).filter(Boolean).map(s => {
  const m = /^(.+)=(\d+)$/.exec(s);
  if (!m || +m[2] < 256) { console.log(`--texture-of ${s}: give <words in the model's path>=<px, at least 256>`); process.exit(1); }
  return { words: m[1].toLowerCase().replace(/\\/g, '/'), px: +m[2] };
});
// --tris-of <words in the model's path>=<triangles>, as often as needed: those models made lighter to that many (the first
// that matches; the miniature worlds' ladders, placed 22 times: --tris-of leiter=2000)
const TRIS_OF = argv.map((a, i) => (a === '--tris-of' ? argv[i + 1] : null)).filter(Boolean).map(s => {
  const m = /^(.+)=(\d+)$/.exec(s);
  if (!m || +m[2] < 100) { console.log(`--tris-of ${s}: give <words in the model's path>=<triangles, at least 100>`); process.exit(1); }
  return { words: m[1].toLowerCase().replace(/\\/g, '/'), n: +m[2] };
});
// (matched within the project's Assets/, so a word of the project's own folder matches nothing by itself)
const texFor = src => (TEX_OF.find(r => rel(src).toLowerCase().includes(r.words)) || { px: null }).px;
const trisFor = src => (TRIS_OF.find(r => rel(src).toLowerCase().includes(r.words)) || { n: null }).n;
const USAGE = 'usage: node tools/studio/unity/import.mjs <unity project> <scene.unity> <object path> <out folder>\n' +
  '       [--max-texture 2048] [--texture-of <words>=<px> ...] [--tris 150000] [--tris-of <words>=<n> ...] [--skip <name> ...]\n' +
  '       [--small-under 1] [--small-keep 0.3] [--light auto|lit|scan] [--mirror x|z] [--merge-copies] [--dry] [--force]';
if (pos.length !== 4) { console.log(USAGE); process.exit(1); }
const [PROJECT, SCENE, ROOT_PATH, OUT] = [path.resolve(pos[0]), path.resolve(pos[1]), pos[2], path.resolve(pos[3])];
const MAX_TEX = +opt('max-texture', 2048), TRIS = +opt('tris', 150000), LIGHT = opt('light', 'auto'), MIRROR = opt('mirror', 'x');
const DRY = flag('dry'), FORCE = flag('force'), MERGE = flag('merge-copies');
// small copies (placed under --small-under metres, of a model over 2,000 triangles) get a lighter GLB of their own:
// --small-keep of its triangles, pictures at most 512 px (0 turns it off)
const SMALL_UNDER = +opt('small-under', 1), SMALL_KEEP = +opt('small-keep', 0.3);
if (!['auto', 'lit', 'scan'].includes(LIGHT) || !['x', 'z'].includes(MIRROR) || !(MAX_TEX >= 256) || !(TRIS >= 1000) || !(SMALL_UNDER >= 0) || !(SMALL_KEEP >= 0.02 && SMALL_KEEP < 1)) { console.log(USAGE); process.exit(1); }
const outRel = path.relative(REPO, OUT);
if (!path.isAbsolute(outRel) && outRel.split(path.sep)[0] !== '..' && !outRel.startsWith(path.join('tools', 'studio', 'test', 'local'))) {
  console.log('The out folder is inside the repository: the owner\'s scenes stay out of it (tools/studio/test/local/ is git-ignored for them).');
  process.exit(1);
}

const notes = [];   // what was left out or approximated, said at the end
const note = s => { if (!notes.includes(s)) notes.push(s); };
const rel = p => path.relative(path.join(PROJECT, 'Assets'), p).split(path.sep).join('/');

console.log(`reading ${path.basename(SCENE)} and the project's asset ids...`);
const guids = guidMap(PROJECT);
const docs = parseDocs(fs.readFileSync(SCENE, 'utf8'));

// ---- the scene's objects, indexed
const GO = new Map(), TR = new Map(), PI = new Map(), compsOf = new Map();
for (const d of docs.values()) {
  if (d.type === 'GameObject') GO.set(d.id, d);
  else if (d.type === 'Transform' || d.type === 'RectTransform') TR.set(d.id, d);
  else if (d.type === 'PrefabInstance') PI.set(d.id, d);
  const g = d.type !== 'GameObject' && ref(field(d.body, 'm_GameObject'));
  if (g && g.fileID !== '0') { if (!compsOf.has(g.fileID)) compsOf.set(g.fileID, []); compsOf.get(g.fileID).push(d); }
}
const trOf = go => (compsOf.get(go) || []).find(d => d.type === 'Transform' || d.type === 'RectTransform');
const goOfTr = tr => ref(field(TR.get(tr).body, 'm_GameObject')).fileID;
const strippedOf = new Map();   // prefab instance -> its stripped transforms and game objects in this scene
for (const d of docs.values()) if (d.stripped) {
  const p = ref(field(d.body, 'm_PrefabInstance'));
  if (p) { if (!strippedOf.has(p.fileID)) strippedOf.set(p.fileID, []); strippedOf.get(p.fileID).push(d); }
}
const piOfStripped = new Map();
for (const [pi, list] of strippedOf) for (const d of list) piOfStripped.set(d.id, pi);
const piByParent = new Map();   // a transform -> the prefab instances placed under it
for (const d of PI.values()) {
  const p = ref((/m_TransformParent: (\{[^}]*\})/.exec(d.body) || [])[1]);
  if (p) { if (!piByParent.has(p.fileID)) piByParent.set(p.fileID, []); piByParent.get(p.fileID).push(d.id); }
}
const goByFather = new Map();   // a (stripped) transform -> scene objects placed under it
for (const t of TR.values()) if (!t.stripped) {
  const f = ref(field(t.body, 'm_Father'));
  if (f && f.fileID !== '0') { if (!goByFather.has(f.fileID)) goByFather.set(f.fileID, []); goByFather.get(f.fileID).push(goOfTr(t.id)); }
}
const scriptOf = d => { const s = ref(field(d.body, 'm_Script')); return s && s.guid ? path.basename(guids.get(s.guid) || s.guid, '.cs') : ''; };
const localTRS = body => {
  const p = vec(field(body, 'm_LocalPosition')), q = vec(field(body, 'm_LocalRotation')), s = vec(field(body, 'm_LocalScale'));
  return M.compose([p.x, p.y, p.z], [q.x, q.y, q.z, q.w], [s.x, s.y, s.z]);
};

// ---- find the root object by its path
let rootGo = null;
{
  const names = ROOT_PATH.split('/');
  let candidates = [...GO.values()].filter(g => !g.stripped && ref(field(TR.get(trOf(g.id)?.id)?.body || '', 'm_Father'))?.fileID === '0');
  for (let i = 0; i < names.length; i++) {
    const hit = candidates.filter(g => field(g.body, 'm_Name') === names[i]);
    if (hit.length !== 1) { console.log(`${names.slice(0, i + 1).join('/')}: ${hit.length ? 'more than one object' : 'no object'} of that name`); process.exit(1); }
    if (i === names.length - 1) { rootGo = hit[0]; break; }
    const kids = refs(block(trOf(hit[0].id).body, 'm_Children')).map(c => TR.get(c.fileID)).filter(t => t && !t.stripped);
    candidates = kids.map(t => GO.get(goOfTr(t.id)));
  }
}

// ---- the tree under it (matrices later, once the models' own transforms are known); --skip leaves out a part by its
// name, with all it holds (a trigger naming something in it then names something outside)
const skipped = [];
const keepNode = n => { if (SKIP.has(n.name)) { skipped.push(n.name); return false; } return true; };
function walkGo(goId, parent) {
  const g = GO.get(goId), tr = trOf(goId);
  const node = { kind: 'go', key: goId, name: field(g.body, 'm_Name'), self: field(g.body, 'm_IsActive') === '1', local: localTRS(tr.body),
    comps: compsOf.get(goId) || [], parent, children: [] };
  for (const c of refs(block(tr.body, 'm_Children'))) {
    const t = TR.get(c.fileID);
    if (t && !t.stripped) { const k = walkGo(goOfTr(t.id), node); if (keepNode(k)) node.children.push(k); }
  }
  for (const pi of piByParent.get(tr.id) || []) { const k = walkPi(pi, node); if (keepNode(k)) node.children.push(k); }
  return node;
}
// a .prefab (not a model) placed in the scene: its root's mesh, materials and transform, and whether people may carry it
// (a grab script on it: Unity's OVRGrabbable and its Photon twin)
const prefabCache = new Map();
function readPrefab(file) {
  if (prefabCache.has(file)) return prefabCache.get(file);
  let out = null;
  try {
    const pd = parseDocs(fs.readFileSync(file, 'utf8'));
    const t = [...pd.values()].find(d => d.type === 'Transform' && /m_Father: \{fileID: 0\}/.test(d.body));
    const go = t && ref(field(t.body, 'm_GameObject')).fileID;
    const comps = [...pd.values()].filter(d => ref(field(d.body, 'm_GameObject'))?.fileID === go);
    const mf = comps.find(d => d.type === 'MeshFilter'), mr = comps.find(d => d.type === 'MeshRenderer');
    const mesh = mf && ref(field(mf.body, 'm_Mesh'));
    const p = vec(field(t.body, 'm_LocalPosition')), q = vec(field(t.body, 'm_LocalRotation')), s = vec(field(t.body, 'm_LocalScale'));
    out = { mesh: mesh && mesh.guid && mesh.guid !== '0000000000000000e000000000000000' ? guids.get(mesh.guid) || null : null, builtin: !!(mesh && mesh.guid === '0000000000000000e000000000000000'),
      mats: mr ? refs(block(mr.body, 'm_Materials')).map((r, i) => ({ i, mat: r.guid ? guids.get(r.guid) || null : null })) : [],
      def: { p: [p.x, p.y, p.z], q: [q.x, q.y, q.z, q.w], s: [s.x, s.y, s.z] },
      meshId: mesh && mesh.fileID, grab: comps.some(d => d.type === 'MonoBehaviour' && /grabbable/i.test(path.basename(guids.get(ref(field(d.body, 'm_Script'))?.guid || '') || ''))) };
  } catch {}
  prefabCache.set(file, out);
  return out;
}
function walkPi(piId, parent) {
  const d = PI.get(piId), mods = modifications(d.body);
  const srcRef = ref((/m_SourcePrefab: (\{[^}]*\})/.exec(d.body) || [])[1]);
  const src = srcRef && guids.get(srcRef.guid);
  const rootT = mods.find(m => m.path === 'm_RootOrder')?.target.fileID, rootG = mods.find(m => m.path === 'm_Name')?.target.fileID;
  const get = (t, p) => { const m = mods.find(x => x.target.fileID === t && x.path === p); return m ? m.value : undefined; };
  const num = (t, p) => { const v = get(t, p); return v === undefined || v === '' ? undefined : +v; };
  const added = [], kids = [];
  for (const s of strippedOf.get(piId) || []) {
    if (s.type === 'GameObject') added.push(...(compsOf.get(s.id) || []));
    if (s.type === 'Transform') { for (const g of goByFather.get(s.id) || []) kids.push(['go', g]); for (const p of piByParent.get(s.id) || []) kids.push(['pi', p]); }
  }
  // (a transform below the root the scene overrides: the model's own node, when Unity keeps it under a root of its own)
  const TRS_PATH = /^m_Local(Position|Rotation|Scale)\.[xyzw]$/;
  const childTs = [...new Set(mods.filter(m => TRS_PATH.test(m.path) && m.target.fileID !== rootT).map(m => m.target.fileID))];
  const trsOver = t => ({ p: ['x', 'y', 'z'].map(a => num(t, `m_LocalPosition.${a}`)), q: ['x', 'y', 'z', 'w'].map(a => num(t, `m_LocalRotation.${a}`)), s: ['x', 'y', 'z'].map(a => num(t, `m_LocalScale.${a}`)) });
  const node = { kind: 'pi', key: piId, name: get(rootG, 'm_Name') || (src ? path.basename(src, path.extname(src)) : '?'), src,
    self: get(rootG, 'm_IsActive') !== '0', parent, comps: added, children: [],
    over: trsOver(rootT), childOver: childTs.length === 1 ? trsOver(childTs[0]) : null, childOvers: childTs.length,
    mats: mods.filter(m => /^m_Materials\.Array\.data\[\d+\]$/.test(m.path)).map(m => ({ i: +/\[(\d+)\]/.exec(m.path)[1], mat: m.ref && m.ref.guid ? guids.get(m.ref.guid) : null })) };
  if (src && /\.prefab$/i.test(src)) {
    const pf = readPrefab(src);
    if (pf && pf.mesh) {
      node.prefab = pf; node.model = pf.mesh;   // (pf.meshId: which of the file's meshes; a file with several is said below)
      // the prefab's own materials, under what the scene gives this placement
      node.mats = pf.mats.filter(m => m.mat).map(m => node.mats.find(o => o.i === m.i) || m).concat(node.mats.filter(o => !pf.mats.some(m => m.i === o.i)));
    }
  }
  for (const [k, id] of kids) { const c = k === 'go' ? walkGo(id, node) : walkPi(id, node); if (keepNode(c)) node.children.push(c); }
  return node;
}
const tree = walkGo(rootGo.id, null);
// the root's own parents: their matrices count, but not their being active (the part is ported on its own)
let W0 = M.identity();
for (let t = ref(field(trOf(rootGo.id).body, 'm_Father')).fileID; t && t !== '0'; t = ref(field(TR.get(t).body, 'm_Father')).fileID) W0 = M.mul(localTRS(TR.get(t).body), W0);

const all = [];
(function flat(n) { all.push(n); n.children.forEach(flat); })(tree);
const nodeOfGo = new Map();   // a scene or stripped game object -> its node (triggers name them)
for (const n of all) {
  if (n.kind === 'go') nodeOfGo.set(n.key, n);
  else for (const s of strippedOf.get(n.key) || []) if (s.type === 'GameObject') nodeOfGo.set(s.id, n);
}

// ---- triggers: which objects they show and hide
const TRIGGER_FIELDS = ['ObjectToActivate', 'ObjectToDeactivate', 'SoundToActivate', 'SoundToDeactivate', 'ObjectToActivateOnExit', 'ObjectToDeactivateOnExit'];
const triggers = [];
for (const n of all) for (const c of n.comps) if (c.type === 'MonoBehaviour' && scriptOf(c) === 'ObjectsToTrigger') {
  const t = Object.fromEntries(TRIGGER_FIELDS.map(f => [f, ref(field(c.body, f))?.fileID]).map(([f, id]) => [f, id && id !== '0' ? id : null]));
  triggers.push({ node: n, t });
}
const targeted = new Set();   // nodes a trigger that becomes a cube, or a timeline, turns on (they may start inactive)
// a node is ported when it and its parents are active, or a trigger shows it or one of its parents (and the parents
// between are active)
const live = n => { for (let x = n; x; x = x.parent) { if (targeted.has(x)) return true; if (!x.self) return false; } return true; };
// (a track binds a component, an Animator or an AudioSource, or a game object itself)
const compGo = id => { const a = docs.get(id), g = a && a.type !== 'GameObject' && ref(field(a.body, 'm_GameObject')); return g && g.fileID !== '0' ? g.fileID : id; };
const targetOf = tr => (tr.target ? nodeOfGo.get(compGo(tr.target)) : null);
// which triggers become cubes (below): ported, with a box, naming something in the part, and not a door whose only
// way on is outside it (what such a trigger names would otherwise be ported, and seen from the start, for nothing)
const inPart = id => (id ? nodeOfGo.get(id) : null);
const becomesCube = ({ node: n, t }) => live(n) && n.comps.some(c => c.type === 'BoxCollider') && TRIGGER_FIELDS.some(f => inPart(t[f])) &&
  !(['ObjectToActivate', 'SoundToActivate'].some(f => t[f] && !inPart(t[f])) && !['ObjectToActivate', 'SoundToActivate', 'ObjectToActivateOnExit'].some(f => inPart(t[f])));
// ---- the timelines playing here (timeline.mjs); what an activation track turns on is ported as a trigger's target is
// (both found together: a trigger or a timeline under something another turns on is live only then)
const allDirectors = readDirectors(docs, guids);
for (let changed = true; changed;) {
  changed = false;
  const add = n => { if (n && !targeted.has(n)) { targeted.add(n); changed = true; } };
  for (const tg of triggers) if (becomesCube(tg)) for (const f of ['ObjectToActivate', 'SoundToActivate', 'ObjectToActivateOnExit']) add(inPart(tg.t[f]));
  for (const d of allDirectors) if (nodeOfGo.get(d.go) && live(nodeOfGo.get(d.go))) for (const tr of d.tracks) if (tr.kind === 'act') add(targetOf(tr));
}
const directors = allDirectors.filter(d => nodeOfGo.get(d.go) && live(nodeOfGo.get(d.go)));
const actTargeted = new Set();   // what an activation track turns on and off (parked by its path, below; shown with its parent)
for (const dir of directors) for (const tr of dir.tracks) if (tr.kind === 'act' && targetOf(tr)) actTargeted.add(targetOf(tr));
const ownController = n => n.comps.some(c => c.type === 'Animator' && field(c.body, 'm_Enabled') !== '0' && ref(field(c.body, 'm_Controller'))?.guid);
// objects whose take a timeline plays and nothing else animates: they hold the take's first frame until it starts, as in
// Unity (a clip of that frame is added to their GLB: glb.mjs)
const holdsFirst = new Set();
for (const dir of directors) for (const tr of dir.tracks) {
  const n = targetOf(tr);
  if (n && tr.kind === 'anim' && n.kind === 'pi' && takeRuns(tr).length && !ownController(n)) holdsFirst.add(n);
}

// ---- the previous run's record (ids and conversions kept)
const RECORD = path.join(OUT, '.import.json');
let record = { ids: {}, conversions: {}, sounds: {} };
try { record = { ...record, ...JSON.parse(fs.readFileSync(RECORD, 'utf8')) }; } catch {}
const used = new Set(Object.values(record.ids));
const idOf = key => {
  if (record.ids[key]) return record.ids[key];
  let h = crypto.createHash('sha1').update(key).digest(), id;
  for (let i = 0; ; i++) { id = BigInt('0x' + h.toString('hex').slice(i, i + 12)).toString(36).padStart(6, '0').slice(-6); if (!used.has(id)) break; }
  used.add(id); record.ids[key] = id; return id;
};

// ---- the models: one GLB per model file and set of textures
const models = new Map();   // variant key -> { src, tex: [[name, picture]], out, info }
const textureOfMat = file => { const m = file && readMaterial(file, guids); return m && m.texture; };
function variantOf(n) {
  const src = n.model || n.src;   // (a prefab's mesh comes from a model file)
  const meta = readModelMeta(src, guids) || { materials: new Map(), globalScale: 1, useFileScale: 1, preserveHierarchy: 0 };
  const defaults = [...meta.materials.values()].map(f => readMaterial(f, guids)).filter(Boolean);
  const over = n.mats.filter(m => m.mat).map(m => ({ i: m.i, mat: readMaterial(m.mat, guids) })).filter(m => m.mat);
  const mats = over.length ? defaults.map((d, i) => over.find(o => o.i === i)?.mat || d).concat(over.filter(o => o.i >= defaults.length).map(o => o.mat)) : defaults;
  const pics = over.map(o => o.mat.texture).filter(Boolean);
  const base = path.basename(src, path.extname(src));
  const differ = pics.filter(p => !defaults.some(d => d.texture === p));
  // a Unity material without a picture given to this placement (Atelierwhite's white cut-out): one plain colour
  const plainMat = !differ.length && over.length && over.every(o => !o.mat.texture) ? over[0].mat : null;
  const plain = plainMat ? ['r', 'g', 'b'].map(k => Math.max(0, Math.min(1, plainMat.color?.[k] ?? 1))) : null;
  const hex = plain ? plain.map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('') : '';
  const key = src + (differ.length ? '|' + differ.join('|') : '') + (plain ? '|plain:' + hex : '');
  const out = `models/${base}${differ.length ? '--' + differ.map(p => path.basename(p, path.extname(p))).join('-') : ''}${plain ? '--plain-' + hex : ''}.glb`.replace(/[^\w ./-]/g, '_');
  // (the pictures Unity's own materials for the file use: the converter's find by the names in the file may differ)
  const unityPics = defaults.map(d => d.texture).filter(Boolean);
  // (by material name: the .meta remaps each of the file's materials to a Unity material, whose picture it wears)
  const unityByMat = new Map([...meta.materials.entries()].map(([nm, f]) => [nm, readMaterial(f, guids)?.texture]).filter(([, t]) => t));
  if (!models.has(key)) models.set(key, { src, pictures: differ, unityPics, unityByMat, plain, out, meta });
  const light = LIGHT !== 'auto' ? LIGHT : mats.length && mats.every(isUnlit) ? 'scan' : 'lit';
  return { key, light };
}
const MODEL_EXT = new Set(['.fbx', '.obj', '.dae', '.blend', '.3ds', '.max', '.ma', '.mb']);
for (const n of all) if (n.kind === 'pi' && live(n)) {
  if (!n.src) { note(`${n.name}: its prefab is not in the project`); continue; }
  const ext = path.extname(n.src).toLowerCase();
  if (ext === '.prefab' && !n.model) { note(`${n.name}: a prefab (${rel(n.src)}) with no model of its own (a built-in mesh, particles or nothing): not ported`); continue; }
  const mext = path.extname(n.model || n.src).toLowerCase();
  if (mext !== '.fbx' && mext !== '.obj') { note(`${n.name}: ${mext} models are not ported yet (${rel(n.model || n.src)})`); continue; }
  n.variant = variantOf(n);
}
// two different models whose names would meet in models/ get a few letters of their source's hash
{
  const byOut = new Map();
  for (const [key, v] of models) { if (!byOut.has(v.out)) byOut.set(v.out, []); byOut.get(v.out).push([key, v]); }
  for (const list of byOut.values()) if (list.length > 1) for (const [key, v] of list) v.out = v.out.replace(/\.glb$/, `-${crypto.createHash('sha1').update(key).digest('hex').slice(0, 6)}.glb`);
}
for (const n of holdsFirst) if (n.variant) models.get(n.variant.key).first = true;

// an FBX's UnitScaleFactor (centimetres per unit; 1 when it says none), as Unity's Convert Units reads it
function unitScale(file) {
  const b = fs.readFileSync(file);
  const i = b.indexOf('UnitScaleFactor');
  if (i < 0) return 1;
  if (b.slice(0, 18).toString('latin1') === 'Kaydara FBX Binary') {
    let p = i + 15;
    for (let k = 0; k < 3; k++) { if (b[p] !== 0x53) return 1; p += 5 + b.readUInt32LE(p + 1); }
    return b[p] === 0x44 ? b.readDoubleLE(p + 1) : b[p] === 0x46 ? b.readFloatLE(p + 1) : 1;
  }
  const m = /UnitScaleFactor"\s*,\s*"[^"]*"\s*,\s*"[^"]*"\s*,\s*"[^"]*"\s*,\s*([-\d.eE+]+)/.exec(b.slice(i - 1, i + 200).toString('latin1'));
  return m ? +m[1] : 1;
}

// a GLB's JSON: its root (the converter's guess), the file's own top nodes, its animations and record
function glbInfo(file) {
  const b = fs.readFileSync(file), j = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  const mat = n => n.matrix ? n.matrix.slice() : M.compose(n.translation || [0, 0, 0], n.rotation || [0, 0, 0, 1], n.scale || [1, 1, 1]);
  const rootIdx = j.scenes[j.scene || 0].nodes[0], root = j.nodes[rootIdx];
  const groupIdx = root.children[0], group = j.nodes[groupIdx];
  // (each top node's own drawing: the extent of its mesh's corners in its own frame, for a flat model's axes)
  const ext = nd => { const ps = nd.mesh !== undefined ? j.meshes[nd.mesh].primitives.map(pr => j.accessors[pr.attributes.POSITION]).filter(a => a && a.min && a.max) : [];
    return ps.length ? [[0, 1, 2].map(k => Math.min(...ps.map(a => a.min[k]))), [0, 1, 2].map(k => Math.max(...ps.map(a => a.max[k])))] : null; };
  const tops = (group.children || []).map(i => { const b = ext(j.nodes[i]);
    return { idx: i, name: j.nodes[i].name || '', m: mat(j.nodes[i]), ext: b && b[1].map((x, k) => x - b[0][k]), ctr: b && b[1].map((x, k) => (x + b[0][k]) / 2) }; });
  // (the nodes an animation moves: a node reshaped for an uneven scale must not be one)
  const animated = new Set((j.animations || []).flatMap(a => a.channels.map(c => c.target && c.target.node)));
  return { B: M.mul(mat(root), mat(group)), groupIdx, tops, animated, clips: (j.animations || []).map(a => a.name || ''), rec: j.asset?.extras?.studio || {} };
}

// what a picture is for, guessed from its name as the studio's own picture reader guesses (engine/images.js: 'map',
// 'normalMap', ...), loaded as tools/studio/test-images.mjs loads it
let IMG = null;
const slotGuess = name => { try { if (!IMG) IMG = new Function(fs.readFileSync(path.join(REPO, 'tools/studio/engine/images.js'), 'utf8') + '\nreturn makeImages;')()({ unzlibSync: b => new Uint8Array(zlib.inflateSync(b)), inflateSync: b => new Uint8Array(zlib.inflateRawSync(b)) }); return IMG.slotOf(name || ''); } catch { return 'map'; } };
// a file's size and time, for what a conversion is kept by
const stamp = f => { try { const s = fs.statSync(f); return [rel(f), s.size, Math.floor(s.mtimeMs)]; } catch { return [rel(f), 0, 0]; } };
const CONVERTER = stamp(path.join(REPO, 'tools/studio/engine/convert.js')).slice(1).join('.');
// Unity's clip window on the file's take (the .meta's firstFrame..lastFrame at the file's frame rate): the converter keeps
// the whole take on the file's own clock, Unity plays only the window, from its start ([a, b] s, or null)
function cropOf(v) {
  if (!/\.fbx$/i.test(v.src) || !v.meta.clips || !v.meta.clips.length) return null;
  const c = v.meta.clips[0], fps = fbxFrameRate(v.src);
  if (v.meta.clips.length > 1) note(`${rel(v.src)}: ${v.meta.clips.length} clips cut from its takes in Unity: the first (${c.name}) ported`);
  return c.last > c.first ? [c.first / fps, c.last / fps] : null;
}
function finish(v, outFile) {   // what the importer does to a GLB after the converter (once each)
  if (v.plain) plainColour(outFile, v.plain);
  if (v.crop) {
    const n = glbInfo(outFile).clips.filter(c => c !== 'first frame').length;
    if (n === 1) { try { cropAnimations(outFile, v.crop[0], v.crop[1]); } catch (e) { note(`${v.out}: its take not cut to Unity's clip window (${e.message})`); } }
    else if (n > 1) note(`${v.out}: ${n} takes in the file: not cut to Unity's clip window`);
  }
  if (v.first) addFirstFrame(outFile);
  v.info = glbInfo(outFile);
}
// An OBJ with loose edges or points (`l` and `p` lines: Blender writes a model's loose edges so) is drawn as lines by
// three.js r128's OBJ loader, all of it (kiste_nofloor.obj: two loose edges at its end): the converter gets a copy
// without them in the scene folder's .cache/ (never in the Unity project), with its MTL and the pictures of its folder
// (4 folders down, where the converter looks beside a model), at their paths, so it finds for the copy what it finds for
// the original; a copy is refreshed when its source's size or time changes. -> { file to convert, mtl: the MTLs }
function cleanObj(v) {
  if (!/\.obj$/i.test(v.src)) return { file: v.src, mtl: [] };
  const text = fs.readFileSync(v.src, 'utf8'), from = path.dirname(v.src);
  const mtl = [...text.matchAll(/^mtllib (.+)$/gm)].map(m => path.resolve(from, m[1].trim())).filter(f => fs.existsSync(f));
  if (!/^[lp] /m.test(text)) return { file: v.src, mtl };
  const dir = path.join(OUT, '.cache', 'obj', crypto.createHash('sha1').update(v.src).digest('hex').slice(0, 8));
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, path.basename(v.src)), clean = text.split(/\r?\n/).filter(l => !/^[lp] /.test(l)).join('\n');
  if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== clean) fs.writeFileSync(out, clean);
  const copy = a => {
    const b = path.join(dir, path.relative(from, a)), sa = fs.statSync(a);
    if (fs.existsSync(b)) { const sb = fs.statSync(b); if (sb.size === sa.size && Math.floor(sb.mtimeMs) === Math.floor(sa.mtimeMs)) return; }
    fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); fs.utimesSync(b, sa.atime, sa.mtime);
  };
  const PICS = /\.(png|jpe?g|tga|bmp|tiff?|psd|dds|gif|webp|exr|hdr|mtl)$/i;
  const walk = (d, depth) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const f = path.join(d, e.name);
    if (e.isDirectory() && depth < 4) walk(f, depth + 1); else if (e.isFile() && PICS.test(e.name)) copy(f);
  } };
  walk(from, 0);
  for (const f of mtl) if (!f.startsWith(from + path.sep)) note(`${rel(v.src)}: its MTL is outside its folder: the cleaned copy may miss it`);
  note(`${rel(v.src)}: ${(text.match(/^[lp] /gm) || []).length} loose edge(s) or point(s) left out (three.js would draw the whole model as lines)`);
  return { file: out, mtl };
}
function convert(v) {
  const outFile = path.join(OUT, ...v.out.split('/'));
  const clean = cleanObj(v), input = clean.file;
  const st = fs.statSync(v.src);
  const maxTex = Math.min(MAX_TEX, texFor(v.src) || MAX_TEX, v.small ? 512 : Infinity);
  v.crop = cropOf(v);
  const tris = Math.min(TRIS, trisFor(v.src) || TRIS);
  // (pics: how pictures are given; 3 = by material name, also to a file whose own names find none or leave a material
  // Unity gives one bare, colour pictures told from the others by name: older GLBs converted again)
  const want = { pics: 3, src: rel(v.src), size: st.size, mtime: Math.floor(st.mtimeMs), maxTex, tris, pictures: v.pictures.map(stamp), unity: v.unityPics.map(stamp), ...(clean.mtl.length ? { mtl: clean.mtl.map(stamp) } : {}), plain: v.plain, first: !!v.first, ...(v.crop ? { crop: v.crop } : {}), small: v.small ? SMALL_KEEP : undefined, converter: CONVERTER };
  // (crop and small written only when set: a record from before them still matches)
  const had = record.conversions[v.out];
  // (kept while the source, its settings, the pictures given and the pictures the converter found beside it are the same)
  if (!FORCE && had && fs.existsSync(outFile) && JSON.stringify(had.want) === JSON.stringify(want) && JSON.stringify((had.used || []).map(u => stamp(path.join(PROJECT, 'Assets', u[0])))) === JSON.stringify(had.used || [])) { finish(v, outFile); return 'kept'; }
  let texArgs = [];
  const run = keep => {
    const args = [path.join(REPO, 'tools/studio/convert.mjs'), input, outFile, '--max-texture', String(maxTex)];
    if (keep < 1) args.push('--keep', keep.toFixed(3));
    for (const t of texArgs) args.push('--texture', t);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 64 << 20 });
    if (r.status !== 0) throw new Error((r.stdout + r.stderr).trim().split('\n').slice(-6).join('\n'));
    return r.stdout;
  };
  run(1);
  let info = glbInfo(outFile);
  // the pictures it should wear: a Unity material given to this placement (on every picture the file names, else on
  // every material); else Unity's own materials for the file, by material name, where the converter found a picture
  // Unity's materials do not use (the big atelier: textured_output.jpg, Unity's textured_output 2.jpg) or none at all
  // (the eva dancers name a picture in another folder; the black floor names none). Found pictures that are Unity's
  // are left as found: the file's own names pair them with their materials (raum's four).
  // (the colour pictures: a slot given, else the converter's own guess from the picture's name: a normal map is not one)
  const colour = (info.rec.tex || []).filter(t => (t.slot ? t.slot === 'map' : slotGuess(t.name) === 'map'));
  const foundAs = t => (t.from && !t.from.startsWith('~') ? path.resolve(path.dirname(v.src), ...t.from.split('/')) : '');
  if (v.pictures.length) {
    const names = [...new Set(colour.map(t => t.name))];
    texArgs = names.length ? names.map((nm, k) => `${nm}=${v.pictures[Math.min(k, v.pictures.length - 1)]}`) : [`*:map=${v.pictures[0]}`];
    if (names.length > 1) note(`${v.out}: ${names.length} pictures in the file, given this placement's material's in order: check it`);
  } else if (v.unityPics.length) {
    const unity = new Set(v.unityPics.map(p => path.resolve(p).toLowerCase()));
    const glbJ = readGlb(outFile).json.materials || [];
    // (a material Unity gives a picture, left without one: dominik001_new's TextureAtlas_1001)
    const bare = glbJ.some(m => v.unityByMat.has(m.name || '') && !(m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture));
    if (!colour.length || bare || colour.some(t => !unity.has(foundAs(t).toLowerCase()))) {
      const glbMats = glbJ.map(m => m.name || '');
      const byName = glbMats.filter(m => v.unityByMat.has(m));
      // (no material named as Unity's, and Unity's materials one picture: it in place of every picture the file names,
      // else on every material)
      const one = new Set(v.unityPics).size === 1 ? v.unityPics[0] : null, names = [...new Set(colour.map(t => t.name))];
      texArgs = byName.length ? byName.map(m => `${m}:map=${v.unityByMat.get(m)}`) : one ? (names.length ? names.map(nm => `${nm}=${one}`) : [`*:map=${one}`]) : [];
      if (!byName.length && one) note(`${v.out}: its materials not named as Unity's: Unity's one picture given to all of it`);
      if (!texArgs.length) note(`${v.out}: its materials not named as Unity's, and Unity's materials have several pictures: left as the converter found them, check it`);
    }
  }
  if (texArgs.length) { run(1); info = glbInfo(outFile); }
  if (v.small) { run(Math.max(0.02, SMALL_KEEP * Math.min(1, tris / info.rec.n))); info = glbInfo(outFile); }   // (a share of the capped model)
  else if (info.rec.n > tris) { run(Math.max(0.02, tris / info.rec.n)); info = glbInfo(outFile); }
  // the pictures the converter found beside the model (by its ladder): a change to one converts it again
  const used = (info.rec.tex || []).filter(t => t.from && !t.from.startsWith('~')).map(t => stamp(path.join(path.dirname(v.src), ...t.from.split('/'))));
  record.conversions[v.out] = { want, used, n: info.rec.tris ? info.rec.tris : info.rec.n };
  finish(v, outFile);
  return (info.rec.tris ? `made lighter: ${info.rec.tris.from} -> ${info.rec.tris.to} triangles` : `${info.rec.n} triangles`) + (v.plain ? ', one plain colour' : '') +
    (v.crop ? `, take cut to ${v.crop.map(x => x.toFixed(2)).join('..')} s` : '') + (v.first ? ', its first frame held' : '');
}

// Unity's world (left-handed, +z ahead) -> the studio's (right-handed, -z ahead): z mirrored. Unity's FBX import mirrors
// a model in x (XM); --mirror z takes the other guess, turning every model half round where it stands
const ZM = M.scale(1, 1, -1), XM = MIRROR === 'x' ? M.scale(-1, 1, 1) : M.scale(1, 1, -1);
const r3 = v => Math.round(v * 1000) / 1000, r4 = v => Math.round(v * 10000) / 10000;
const sig4 = v => +v.toPrecision(4);
const toStudio = Wu => M.mul(ZM, M.mul(Wu, ZM));   // a Unity matrix with no mesh of its own (a box, a point) in the studio's frame

// ---- the run
fs.mkdirSync(OUT, { recursive: true });
const objects = [], cubes = [], sounds = [], shapes = [];
const counts = { inactive: 0 };
const resets = [];   // CLEANER and activator scripts: what they turn off and on each time their object is turned on (below)
if (!DRY) {
  let i = 0;
  for (const v of models.values()) {
    i++;
    const t0 = Date.now();
    process.stdout.write(`  ${i}/${models.size} ${v.out} `);
    // (a GLB a merge left unused last time waits in .cache/: back into models/, where the conversion is kept)
    const cached = path.join(OUT, '.cache', ...v.out.split('/')), live_ = path.join(OUT, ...v.out.split('/'));
    if (!fs.existsSync(live_) && fs.existsSync(cached)) { fs.mkdirSync(path.dirname(live_), { recursive: true }); fs.renameSync(cached, live_); }
    try { console.log(`${convert(v)} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); } catch (e) { console.log('FAILED'); note(`${v.out}: not converted: ${e.message}`); }
  }
}

// world matrices, Unity's frame
function worldOf(n) {
  if (n.W) return n.W;
  const Wp = n.parent ? worldOf(n.parent) : W0;
  if (n.kind === 'go') return (n.W = M.mul(Wp, n.local));
  // a prefab root: what the scene overrides, else the model's own top node as Unity imports it
  const v = n.variant && models.get(n.variant.key), info = v && v.info;
  // one top node in the file: an FBX's becomes the prefab's root (collapsed); an OBJ's stays a child under a root of its
  // own; a prefab places the mesh alone, under the prefab's own root
  const isObj = !!v && /\.obj$/i.test(v.src), oneTop = !!info && info.tops.length === 1;
  const collapsed = oneTop && !v.meta.preserveHierarchy && !isObj && !n.prefab;
  const top = oneTop ? M.decompose(info.tops[0].m) : { p: [0, 0, 0], q: [0, 0, 0, 1], s: [1, 1, 1] };
  // (units: an FBX's UnitScaleFactor when Unity converts units; an OBJ has none, 1 unit is 1 m)
  const su = v ? (v.meta.useFileScale && !isObj ? unitScale(v.src) / 100 : 1) * v.meta.globalScale : 1;
  const asUnity = { p: [-top.p[0] * su, top.p[1] * su, top.p[2] * su], q: [top.q[0], -top.q[1], -top.q[2], top.q[3]], s: top.s };   // (mirrored in x, as Unity imports)
  const ident = { p: [0, 0, 0], q: [0, 0, 0, 1], s: [1, 1, 1] };
  const def = n.prefab ? n.prefab.def : collapsed ? asUnity : ident;
  const o = n.over, pick = (a, d) => a.map((x, k) => (x === undefined ? d[k] : x));
  n.su = su; n.single = oneTop;
  if (n.prefab && info && info.tops.length > 1) note(`${n.name}: its prefab draws one mesh of ${path.basename(v.src)}, which holds ${info.tops.length} parts: the whole file placed, check it`);
  n.trs = { p: pick(o.p, def.p), q: pick(o.q, def.q), s: pick(o.s, def.s) };
  n.local = M.compose(n.trs.p, n.trs.q, n.trs.s);
  // the model's node under its own root: as the scene overrides it, else as Unity imported it
  n.childLocal = null;
  if (oneTop && !collapsed && !n.prefab) {
    const c = n.childOver;
    n.childLocal = c ? M.compose(pick(c.p, asUnity.p), pick(c.q, asUnity.q), pick(c.s, asUnity.s)) : M.compose(asUnity.p, asUnity.q, asUnity.s);
  } else if (n.childOvers && v && !n.prefab && !(info && info.clips.length)) note(`${n.name}: a part inside its model was moved in the scene: not ported (the model stands as in its file)`);
  // (a model with animations: such overrides are bone poses Unity saved into the scene, which its clip drives anyway)
  return (n.W = M.mul(Wp, n.local));
}
// a scene object's own local values (position, turn, scale), for what a clip leaves alone
const trsOf = n => {
  if (n.trs) return n.trs;
  if (n.kind === 'pi') { worldOf(n); return n.trs; }
  const d = M.decompose(n.local);
  return (n.trs = { p: d.p, q: d.q, s: d.s });
};
// Where the studio puts a model Unity draws at world matrix Wu (Unity's frame): its GLB (the converter's root B, and its
// top node N when it has one) under p, q and an even s, drawn as Unity draws the model, G = Z · Wu · childLocal · X ·
// S_unity on the model's own drawing. Exact when G · N^-1 · B^-1 scales evenly (an uneven scale in Unity gets a GLB of
// its own whose node carries that shape: below); else evened in G's frame (over a flat model's long axes: an axis under
// a fifth of the longest is its thickness), the drawing's middle kept where Unity has it. -> { p, q, s, uneven?, flat? }
const gOf = (n, Wu) => M.mul(ZM, M.mul(Wu, M.mul(n.childLocal || M.identity(), M.mul(XM, M.scale(n.su)))));
const evenly = m => {   // its three axes the same length and square to each other
  const c = [0, 1, 2].map(k => [m[4 * k], m[4 * k + 1], m[4 * k + 2]]), l = c.map(x => Math.hypot(...x));
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.max(...l) / Math.min(...l) < 1.001 && [[0, 1], [0, 2], [1, 2]].every(([i, k]) => Math.abs(dot(c[i], c[k])) / (l[i] * l[k]) < 1e-3);
};
const cbrt3 = sc => Math.cbrt(sc[0] * sc[1] * sc[2]);
function placeAt(n, info, Wu) {
  const G = gOf(n, Wu), tail = M.mul(n.single ? M.invert(info.tops[0].m) : M.identity(), M.invert(info.B)), Mt = M.mul(G, tail);
  if (evenly(Mt)) { const d = M.decompose(Mt); return { p: d.p, q: d.q, s: cbrt3(d.s) }; }
  const dg = M.decompose(G), top = n.single ? info.tops[0] : null, ext = top && top.ext;
  const axes = ext ? [0, 1, 2].filter(k => ext[k] >= 0.2 * Math.max(...ext)) : [0, 1, 2];
  const sg = Math.exp(axes.reduce((t, k) => t + Math.log(dg.s[k]), 0) / axes.length);
  const c = (top && top.ctr) || [0, 0, 0], want = M.apply(G, c), got = M.apply(M.compose(dg.p, dg.q, [sg, sg, sg]), c);
  const d = M.decompose(M.mul(M.compose(dg.p.map((x, k) => x + want[k] - got[k]), dg.q, [sg, sg, sg]), tail));
  return { p: d.p, q: d.q, s: cbrt3(d.s), uneven: dg.s, flat: axes.length < 3 };
}
// the world matrix at t seconds after the part was shown, with what moves it (a timeline's root clip, a controller's)
const moving = new Map();   // node -> [{ pose(t) -> { p, q } | null }]
function worldAt(n, t) {
  const Wp = n.parent ? worldAt(n.parent, t) : W0;
  worldOf(n);
  let local = n.local;
  for (const m of moving.get(n) || []) { if (!m.pose) continue; const ps = m.pose(t); if (ps) { local = M.compose(ps.p, ps.q, trsOf(n).s); break; } }
  return M.mul(Wp, local);
}

const itemOf = new Map();   // node -> the ids of the items made from it
const objNode = new Map();  // an object's id -> its node
for (const n of all) {
  if (!live(n)) { counts.inactive++; continue; }
  const ids = [];
  if (n.kind === 'pi' && n.variant && (models.get(n.variant.key).info || DRY)) {   // (a model that failed to convert: its sounds and shapes still come)
    const v = models.get(n.variant.key);
    const id = idOf('pi:' + n.key);
    let s = 1, p = [0, 0, 0], q = [0, 0, 0, 1];
    if (v.info) {
      const Wu = worldOf(n);
      if (!n.single && v.info.rec.q && Math.abs(v.info.rec.q[3]) < 0.9999) note(`${path.basename(v.src)}: Z up with more than one top node: its turn is a guess`);
      const G = gOf(n, Wu);
      const det = G[0] * (G[5] * G[10] - G[6] * G[9]) - G[4] * (G[1] * G[10] - G[2] * G[9]) + G[8] * (G[1] * G[6] - G[2] * G[5]);
      if (det < 0) note(`${n.name}: mirrored in Unity (a negative scale): placed unmirrored, check it`);
      n.G = G;
      ({ p, q, s } = placeAt(n, v.info, Wu));
    }
    // its own clip: a controller's take loops; one a timeline plays waits on its first frame (a sequence plays the take)
    const animated = ownController(n) || [n, n.parent].some(x => x && x.comps.some(c => c.type === 'PlayableDirector'));
    const clip = !(v.info && v.info.clips.length && animated) ? '' : holdsFirst.has(n) && v.info.clips.includes('first frame') ? 'first frame' : v.info.clips[0];
    objects.push({ id, name: n.name.slice(0, 60), file: v.out, p: p.map(r3), q: q.map(r4), s: sig4(s), light: n.variant.light,
      clip, anim: 'loop', start: 'always', ...(n.prefab && n.prefab.grab ? { grab: true } : {}) });
    objNode.set(id, n);
    ids.push(id);
  }
  for (const c of n.comps) {
    if (c.type === 'AudioSource' && field(c.body, 'm_Enabled') === '1') {
      const clipRef = ref(field(c.body, 'm_audioClip')), src = clipRef && guids.get(clipRef.guid);
      if (!src) continue;
      const id = idOf('audio:' + c.id), Wu = worldOf(n), P = M.apply(toStudio(Wu), [0, 0, 0]);
      const spatial = +((/panLevelCustomCurve:[\s\S]*?value: ([-\d.]+)/.exec(c.body) || [])[1] || 0);
      const file = `sounds/${path.basename(src, path.extname(src)).replace(/[^\w .-]/g, '_')}.mp3`;
      const vol = +field(c.body, 'm_Volume'), loop = field(c.body, 'Loop') === '1';
      if (field(c.body, 'm_PlayOnAwake') === '0') { note(`${n.name}: a sound that does not play by itself in Unity (a script would start it): left out`); continue; }
      let shownFromStart = true;
      for (let x = n; x; x = x.parent) if (!x.self) shownFromStart = false;
      // (a loop shown from the start keeps the room's time; one played once, as Unity plays on awake, plays each time it
      // is shown: the start room's chime, again when the room comes back)
      sounds.push({ id, name: n.name.slice(0, 60), file, p: P.map(r3), vol: Number.isFinite(vol) ? Math.round(Math.min(2, Math.max(0, vol)) * 100) / 100 : 1,
        r: spatial > 0 ? Math.max(0.1, Math.min(20, +field(c.body, 'MinDistance') || 1)) : 20, loop,
        start: shownFromStart && loop ? 'always' : 'shown', src });
      if (!spatial) note(`${n.name}: a 2D sound in Unity (heard the same everywhere): a sound at full volume within 20 m here`);
      if (n.kind === 'pi' && ids.length && objNode.has(ids[0])) sounds[sounds.length - 1].on = ids[0];   // (its offset: once the objects stand, below)
      ids.push(id);
    } else if (c.type === 'Light') counts.lights = (counts.lights || 0) + 1;
    else if (c.type === 'ParticleSystem') counts.particles = (counts.particles || 0) + 1;
    else if (c.type === 'PlayableDirector') counts.timelines = (counts.timelines || 0) + 1;
    else if (c.type === 'Camera') counts.cameras = (counts.cameras || 0) + 1;
    else if (c.type === 'MonoBehaviour' && ['CLEANER', 'activator'].includes(scriptOf(c))) resets.push({ node: n, c, off: scriptOf(c) === 'CLEANER' });
    else if (c.type === 'MonoBehaviour' && scriptOf(c) === 'StartAnimatorRandom') counts.randomPhase = (counts.randomPhase || 0) + 1;
    else if (c.type === 'MonoBehaviour' && !['ObjectsToTrigger', 'OVRGrabbable', 'PhotonView', 'PhotonTransformView'].includes(scriptOf(c)) && !(n.prefab && n.prefab.grab && /grab|photon/i.test(scriptOf(c)))) note(`script ${scriptOf(c) || '?'} on ${n.name}: not ported`);
  }
  // a built-in cube, sphere, cylinder or plane that is drawn (not a trigger's box)
  const mf = n.comps.find(c => c.type === 'MeshFilter'), mr = n.comps.find(c => c.type === 'MeshRenderer');
  const mesh = mf && ref(field(mf.body, 'm_Mesh'));
  const isTrigger = n.comps.some(c => c.type === 'MonoBehaviour' && scriptOf(c) === 'ObjectsToTrigger');
  const SHAPES = { 10202: 'cube', 10207: 'sphere', 10206: 'cylinder', 10209: 'plane', 10210: 'plane' };
  if (mesh && mesh.guid === '0000000000000000e000000000000000' && SHAPES[mesh.fileID] && mr && field(mr.body, 'm_Enabled') === '1' && !isTrigger) {
    // (Unity's Plane lies flat, 10 m square; its Quad stands, 1 m; the studio's plane stands, as the Quad: turned up)
    const flat = mesh.fileID === '10209';
    const Wt = M.mul(toStudio(worldOf(n)), flat ? M.compose([0, 0, 0], [-Math.SQRT1_2, 0, 0, Math.SQRT1_2], [1, 1, 1]) : M.identity());
    const d = M.decompose(Wt), base = flat ? 10 : 1;
    const matRef = refs(block(mr.body, 'm_Materials'))[0], mat = matRef && matRef.guid && readMaterial(guids.get(matRef.guid) || '', guids);
    const col = mat && mat.color ? '#' + ['r', 'g', 'b'].map(k => Math.round(Math.max(0, Math.min(1, mat.color[k] ?? 1)) * 255).toString(16).padStart(2, '0')).join('') : '#cccccc';
    const id = idOf('shape:' + n.key);
    shapes.push({ id, name: n.name.slice(0, 60), shape: SHAPES[mesh.fileID], p: d.p.map(r3), q: d.q.map(r4),
      size: SHAPES[mesh.fileID] === 'plane' ? [d.s[0] * base, d.s[1] * base, 0.01].map(x => Math.max(0.01, r3(x)))
        : [d.s[0], d.s[1] * (SHAPES[mesh.fileID] === 'cylinder' ? 2 : 1), d.s[2]].map(x => Math.max(0.01, r3(x))), colour: col, look: 'colour' });
    if (mat && mat.texture) note(`${n.name}: a ${SHAPES[mesh.fileID]} with a picture in Unity: a plain colour here`);
    ids.push(id);
  }
  itemOf.set(n, ids);
}
// ---- small copies (the miniature worlds' dancers, 15 to 40 cm tall: scaled to under half their model's size, and
// under --small-under): one lighter GLB per model and set of pictures, shared by all its small copies (--small-keep of
// its triangles, pictures at most 512 px); a copy whose lighter GLB fails, comes out placed otherwise (its root or top
// nodes not the full one's) or saves less than a fifth of the triangles, keeps the full one
if (SMALL_UNDER > 0) {
  const wants = new Map();   // the full variant's key -> its small objects
  for (const o of objects) {
    const v = models.get(objNode.get(o.id).variant.key);
    if (!v.info || !v.info.rec.size || (v.info.rec.n || 0) < 2000) continue;
    if (o.s > 0.5 || o.s * Math.max(...v.info.rec.size) >= SMALL_UNDER) continue;   // (scaled down to under half its model, a miniature)
    if (!wants.has(v)) wants.set(v, []);
    wants.get(v).push(o);
  }
  const near = (a, b) => a.length === b.length && a.every((x, k) => Math.abs(x - b[k]) < 1e-5);
  for (const [v, list] of wants) {
    const sv = { ...v, out: v.out.replace(/\.glb$/, '--small.glb'), small: true, info: null };
    models.set([...models.entries()].find(([, x]) => x === v)[0] + '|small', sv);
    if (DRY) { note(`${v.out}: ${list.length} small copies would get a lighter GLB (${sv.out})`); continue; }
    const t0 = Date.now();
    // (a small GLB left unused last time waits in .cache/: back into models/, where its conversion is kept)
    { const c = path.join(OUT, '.cache', ...sv.out.split('/')), l = path.join(OUT, ...sv.out.split('/')); if (!fs.existsSync(l) && fs.existsSync(c)) { fs.mkdirSync(path.dirname(l), { recursive: true }); fs.renameSync(c, l); } }
    process.stdout.write(`  small: ${sv.out} `);
    try { console.log(`${convert(sv)} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); } catch (e) { console.log('FAILED'); note(`${sv.out}: not converted, its small copies keep the full model: ${e.message}`); continue; }
    const a = v.info, b = sv.info;
    if (!b || !near(a.B, b.B) || a.tops.length !== b.tops.length || a.tops.some((t, k) => !near(t.m, b.tops[k].m)) || a.clips.join() !== b.clips.join()) { note(`${sv.out}: placed otherwise than ${v.out}: its small copies keep the full model`); continue; }
    const tri = i => (i.rec.tris ? i.rec.tris.to : i.rec.n) || 0;
    if (tri(b) > 0.8 * tri(a)) { note(`${v.out}: barely lighter made smaller (${tri(a)} -> ${tri(b)} triangles): its small copies keep the full model`); continue; }
    for (const o of list) o.file = sv.out;
  }
}
// ---- uneven scales (the miniature boxes, 2:1:1 in Unity on a cube whose node is 127 x 234 x 100; the small room's
// black floor, 75 x 86 x 52): the studio scales an object evenly, so such a model gets a GLB of its own whose node just
// above the drawing (its top node, else the converter's group) carries the shape Unity gives the drawing (that node's
// place and turn kept), shared by every copy of the same shape: G · N'^-1 · B'^-1 then scales evenly and the object
// stands as in Unity. No conversion: the GLB's JSON is changed (<file>--s<shape>.glb). Not for a node the clip it plays moves.
const fileInfo = new Map();   // a GLB of the layout -> what glbInfo reads from it
for (const v of models.values()) if (v.info) fileInfo.set(v.out, v.info);
if (!DRY) {
  const made = new Map();
  for (const o of objects) {
    const n = objNode.get(o.id), info = fileInfo.get(o.file);
    if (!info || !n.G) continue;
    if (evenly(M.mul(n.G, M.mul(n.single ? M.invert(info.tops[0].m) : M.identity(), M.invert(info.B))))) continue;
    const idx = n.single ? info.tops[0].idx : info.groupIdx;
    if ((o.clip || holdsFirst.has(n)) && info.animated.has(idx)) continue;   // (a node a clip it plays moves: said below, placed at its mean scale)
    const dg = M.decompose(n.G), { json, bin } = readGlb(path.join(OUT, ...o.file.split('/')));
    const nd = json.nodes[idx], cur = nd.matrix ? M.decompose(nd.matrix) : { p: nd.translation || [0, 0, 0], q: nd.rotation || [0, 0, 0, 1], s: nd.scale || [1, 1, 1] };
    const k = cbrt3(cur.s) / cbrt3(dg.s), shape = dg.s.map(x => +(x * k).toPrecision(6));
    const tag = crypto.createHash('sha1').update(shape.map(x => (x / Math.max(...shape)).toFixed(4)).join(',')).digest('hex').slice(0, 6);
    const out = o.file.replace(/\.glb$/, `--s${tag}.glb`), file = path.join(OUT, ...out.split('/'));
    if (!made.has(out)) {
      delete nd.matrix; nd.translation = cur.p; nd.rotation = cur.q; nd.scale = shape;
      const before = fs.existsSync(file) ? fs.readFileSync(file) : null;
      writeGlb(file + '.new', json, bin);
      const now = fs.readFileSync(file + '.new');
      if (before && before.equals(now)) fs.rmSync(file + '.new'); else fs.renameSync(file + '.new', file);
      made.set(out, glbInfo(file));
      fileInfo.set(out, made.get(out));
    }
    const pl = placeAt(n, made.get(out), worldOf(n));
    if (pl.uneven) continue;   // (said below)
    o.file = out; o.p = pl.p.map(r3); o.q = pl.q.map(r4); o.s = sig4(pl.s);
    note(`${o.name}: scaled unevenly in Unity (${dg.s.map(x => x.toFixed(3)).join(' x ')} on its drawing): a GLB of its own with that shape, ${out}`);
  }
}
// what is still evened (a node an animation moves, or a shear from a parent's uneven scale): said once each
for (const o of objects) {
  const n = objNode.get(o.id), info = fileInfo.get(o.file);
  if (!info || !n.G) continue;
  const pl = placeAt(n, info, worldOf(n));
  if (pl.uneven) note(`${o.name}: scaled unevenly in Unity (${pl.uneven.map(x => x.toFixed(3)).join(' x ')} on its drawing): placed at its mean scale${pl.flat ? ' over its flat axes' : ''}`);
}
// ---- Timelines and controllers that move things (timeline.mjs; README "Timelines")
const rootCurves = c => !!(c && c.clip && c.clip.curves.has(''));
for (const dir of directors) for (const tr of dir.tracks) {
  const n = targetOf(tr);
  if (!n || tr.kind !== 'anim' || !(dir.D > 0)) continue;
  if (!(rootCurves(tr.infinite) || tr.clips.some(rootCurves))) continue;   // (takes on bones: a clip schedule, below)
  if (!moving.has(n)) moving.set(n, []);
  moving.get(n).unshift({ dir, track: tr, pose: t => { const dt = directorTime(dir, t); return dt === null ? null : trackPose(tr, dt, trsOf(n)); } });
}
for (const n of all) if (live(n)) for (const c of n.comps) {
  if (c.type !== 'Animator' || field(c.body, 'm_Enabled') === '0') continue;
  const cr = ref(field(c.body, 'm_Controller')), file = cr && cr.guid && guids.get(cr.guid);
  const ctl = file && controllerRoot(file, guids);
  if (!ctl || !(ctl.clip.length / (ctl.speed || 1) > 0)) continue;
  if (!moving.has(n)) moving.set(n, []);
  moving.get(n).push({ ctl, pose: t => controllerPose(ctl, t, trsOf(n)) });   // (a timeline on the same object wins: first)
}
// an activation track turning an object (or one of its parents) off: it is parked far under the floor by its path
// while off, rather than hidden by a sequence (a sequence's show, once stopped, can win over the doors in the studio and
// show it in another world)
const AWAY = 300;
for (const dir of directors) for (const tr of dir.tracks) {
  const n = targetOf(tr);
  if (!n || tr.kind !== 'act' || !(dir.D > 0)) continue;
  if (!moving.has(n)) moving.set(n, []);
  moving.get(n).push({ dir, act: tr, away: t => !activeAt(dir, tr, t, n.self) });
}
const movers = n => { const out = []; for (let x = n; x; x = x.parent) for (const m of moving.get(x) || []) out.push(m); return out; };
const scheduled = new Set();   // objects whose path a sequence starts (its own start then no longer applies)
const recordings = new Map();  // recordings/<file> -> its JSON
const seqOf = new Map();       // a director -> what its sequence names
// which directors need a sequence: those with takes on an object's bones or an activation track (its path)
for (const dir of directors) {
  const ev = [], items = new Set();
  let hold = false, needSeq = false;
  for (const tr of dir.tracks) {
    const n = targetOf(tr), id = n && (itemOf.get(n) || []).find(i => objNode.has(i));
    if (tr.kind === 'audio') {
      // an audio track (a dancer's foley): a sound at what it is bound to (following its model), else at the director's
      // object, played by the sequence where its clips start; 2D (the track's spatial blend 0, as Unity plays a track's
      // clips) within 20 m
      const at = n || nodeOfGo.get(dir.go);
      if (!at || !live(at)) continue;
      const files = [...new Set(tr.clips.map(c => c.audio))];
      for (const f of files) {
        const sid = idOf(`tlaudio:${dir.id}:${tr.id}:${rel(f)}`), P = M.apply(toStudio(worldOf(at)), [0, 0, 0]);
        const src0 = tr.target && docs.get(tr.target), minD = src0 && src0.type === 'AudioSource' ? +field(src0.body, 'MinDistance') || 1 : 1;
        const c0 = tr.clips.find(c => c.audio === f), vol = Math.round(Math.min(2, Math.max(0, (tr.vol ?? 1) * (c0.vol ?? 1))) * 100) / 100;
        sounds.push({ id: sid, name: `${(at.name || 'timeline').slice(0, 40)} · ${path.basename(f, path.extname(f))}`.slice(0, 60),
          file: `sounds/${path.basename(f, path.extname(f)).replace(/[^\w .-]/g, '_')}.mp3`, p: P.map(r3), vol,
          r: tr.spatial > 0 ? Math.max(0.1, Math.min(20, minD)) : 20, loop: false, start: 'shown', src: f, ...(id ? { on: id } : {}) });
        itemOf.set(at, [...(itemOf.get(at) || []), sid]);
        items.add(sid);
        // (a stop where each clip ends, at the latest the Timeline's end, as Unity cuts a clip there; none where another
        // clip of the same file starts inside it, whose start replaces the run)
        for (const c of tr.clips.filter(c => c.audio === f)) {
          ev.push({ t: c.start, on: sid, what: 'sound', how: c.loop ? 'loop' : 'once' });
          const end = c.start + c.dur;
          const cutAt = Math.min(end, dir.D);
          if ((end <= dir.D + 1e-6 || dir.wrap !== 0) && !tr.clips.some(o => o !== c && o.audio === f && o.start > c.start && o.start < cutAt)) ev.push({ t: cutAt, on: sid, what: 'sound', how: 'stop' });
          if (c.clipIn > 0.005 || Math.abs((c.scale || 1) - 1) > 1e-3) note(`${path.basename(dir.file)}: an audio clip trimmed or sped up in its Timeline: played from its start at normal speed here`);
        }
      }
      if (!(tr.spatial > 0)) note(`${dir.file.split(/[\\/]/).pop()}: its audio track plays 2D in Unity (heard the same everywhere): a sound at full volume within 20 m here`);
      continue;
    }
    // (an activation track on a group with no model of its own: what it holds is parked by its path, scheduled here)
    if (!id && tr.kind === 'act' && n && live(n)) { needSeq = true; continue; }
    if (!id) { if (tr.kind === 'act' || takeRuns(tr).length) note(`${path.basename(dir.file)}: a track for something not ported here: left out`); continue; }
    if (tr.kind === 'act') { items.add(id); continue; }
    const o = objects.find(x => x.id === id), runs = takeRuns(tr);
    if (!runs.length || !o) continue;
    const clips = models.get(objNode.get(id).variant.key)?.info?.clips || [], clip = clips.find(c => c !== 'first frame');
    if (!clip) { note(`${o.name}: its timeline plays a take, but its GLB has no animation`); continue; }
    const T = clipLength(path.join(OUT, ...o.file.split('/')), clip);
    items.add(id);
    // (whether the take loops in Unity: the Timeline clip's own Loop, else the take's Loop Time in its .meta)
    // (a take its .meta never cut has Loop Time off, Unity's default)
    const takeLoops = (() => { const m = models.get(objNode.get(id).variant.key)?.meta; return !!m && (m.clips && m.clips.length ? m.clips[0].loop : m.loopTime === 1); })();
    for (const r of runs) {
      // once: it plays once (then back to its first frame); loop: a looping take longer than once; hold: an .anim that
      // holds its last pose, or a take that does not loop, held on its last frame until the clip ends (then back to the
      // first frame, as Unity's hold of a looping clip shows)
      const loops = r.loopMode === 1 || (r.loopMode !== 2 && takeLoops);
      const how = r.anim ? 'hold' : r.end - r.start <= T + 0.05 ? 'once' : loops ? 'loop' : 'hold';
      if (how === 'hold') hold = true;
      ev.push({ t: r.start, on: id, what: 'clip', clip, how });
      if (how !== 'once' && r.end < dir.D - 0.005) ev.push({ t: r.end, on: id, what: 'clip', how: 'stop' });
    }
    if (hold && dir.wrap === 1) ev.unshift({ t: 0, on: id, what: 'clip', how: 'stop' });   // (a hold over the loop's end ends at its start)
  }
  if (ev.length || items.size || needSeq) seqOf.set(dir, { ev, items });
}
// a director on an object that another director's activation track turns on starts as Unity starts it, each time its
// object comes on (play on awake): by that director's sequence (a seq event where the activation starts, a stop where it
// ends), not by the doors; a door that hides it stops it (a sequence stopped does not stop what it started). Activation
// clips that follow on each other are one (Unity's activation mixer keeps the object on across them); one that spans
// a looping director's loop keeps it on while that director plays, so it starts with it (from the doors, or as the scene
// opens with it), and so do runs that meet across that loop's seam (from its start to a stop, then on from a later
// start through the seam: no start at 0 after the first time).
const startedBy = new Map();   // a director -> [{ p: the director turning it on, tr: that track, runs: its activations, seam }]
const keptOn = new Map();      // a director -> the objects a looping director keeps on all along (it starts with it)
for (const dir of seqOf.keys()) {
  const at = nodeOfGo.get(dir.go);
  for (const p of seqOf.keys()) if (p !== dir) for (const tr of p.tracks) {
    const tn = tr.kind === 'act' && targetOf(tr);
    if (!tn) continue;
    let x = at;
    while (x && x !== tn) x = x.parent;
    if (!x) continue;
    const all = actRuns(tr), runs = all.filter(r => !(p.wrap === 1 && r.start <= 1e-3 && r.end >= p.D - 1e-3));
    if (!runs.length) { if (all.length) { if (!keptOn.has(dir)) keptOn.set(dir, []); keptOn.get(dir).push({ p, tn }); } continue; }
    const seam = p.wrap === 1 && runs.length > 1 && runs[0].start <= 1e-3 && runs[runs.length - 1].end >= p.D - 1e-3;
    if (!startedBy.has(dir)) startedBy.set(dir, []);
    startedBy.get(dir).push({ p, tr, runs, seam });
  }
}
// started by the doors and the scene's opening, with the director that keeps it on (not by that director's events)
const isChild = dir => startedBy.has(dir) && !startedBy.get(dir).every(e => e.seam);
// recorded paths: each object something moves (or turns on and off), sampled from Unity, kept where it matters (the
// studio recorder's rule)
for (const o of objects) {
  const n = objNode.get(o.id), ms = movers(n);
  if (!ms.length || !n.G) continue;
  const seqDir = ms.map(m => m.dir).find(d => d && seqOf.has(d));
  if (seqDir && startedBy.has(seqDir) && ms.some(m => m.act && m.dir !== seqDir)) note(`${o.name}: moved by a Timeline that another Timeline turns on, and turned off by that one: its path keeps the first's clock for both, check it`);
  // how long it runs before it repeats: the directors' lengths and the controllers' clip lengths
  const per = m => (m.dir ? m.dir.D : m.ctl.clip.length / (m.ctl.speed || 1));
  const periods = ms.map(per), once = ms.some(m => m.dir && m.dir.wrap !== 1);
  let H = Math.max(...periods), exact = true;
  if (!once && periods.some(p => Math.abs(p - H) > 1e-3)) {
    H = 0;
    for (let k = 1; k * periods[0] <= 600 + 1e-6 && !H; k++) { const c = k * periods[0]; if (periods.every(p => Math.abs(c / p - Math.round(c / p)) * p < 1e-3)) H = c; }
    if (!H) { H = 600; exact = false; }
  }
  if (seqDir) H = seqDir.D;
  if (H > 600) { note(`${o.name}: moves for more than 10 minutes in Unity: its path keeps the first 10`); H = 600; }
  // the moments it may jump: where a clip starts or ends, where a loop comes round
  const marks = new Set();
  for (const m of ms) {
    const P = per(m);
    for (let k = 1; k * P < H; k++) marks.add(k * P);
    const cs = m.track ? m.track.clips : m.act ? m.act.clips : [];
    for (let k = 0; k * P < H; k++) for (const c of cs) { marks.add(k * P + c.start); marks.add(k * P + c.start + c.dur); }
  }
  const times = new Set();
  for (let t = 0; t < H; t += 1 / 30) times.add(Math.round(t * 1000) / 1000);
  times.add(Math.round(H * 1000) / 1000);
  if (H > 0.002) times.add(Math.round((H - 0.001) * 1000) / 1000);   // (a switch at the end a jump, not a slide)
  for (const b of marks) if (b > 0.002 && b < H) { times.add(Math.round((b - 0.001) * 1000) / 1000); times.add(Math.round(b * 1000) / 1000); }
  const Hr = Math.round(H * 1000) / 1000;
  const ts = [...times].filter(t => t >= 0 && t <= Hr + 1e-9).sort((a, b) => a - b);
  const isAway = t => ms.some(m => m.act && m.away(t));
  // (the last key with the director's state after its end: one that stops leaves its targets as its activation track's
  // post-playback state says)
  const awayAt = ts.map((t, i) => isAway(i === ts.length - 1 ? H : Math.min(t, H - 1e-6)));
  const info = fileInfo.get(o.file);
  const poses = ts.map((t, i) => { const pl = placeAt(n, info, worldAt(n, Math.min(t, H - 1e-6))), d = { p: pl.p, q: pl.q, s: [pl.s, pl.s, pl.s] }; if (awayAt[i]) d.p[1] -= AWAY; return d; });
  if (poses.every(p => Math.hypot(p.p[0] - poses[0].p[0], p.p[1] - poses[0].p[1], p.p[2] - poses[0].p[2]) < 1e-4 && Math.abs(p.q.reduce((s, x, k) => s + x * poses[0].q[k], 0)) > 1 - 1e-9)) continue;
  const s0 = poses[0].s, sp = poses.map(p => Math.cbrt(p.s[0] * p.s[1] * p.s[2]));
  if (sp.some(s => Math.abs(s / Math.cbrt(s0[0] * s0[1] * s0[2]) - 1) > 0.01)) note(`${o.name}: its scale changes as it moves in Unity: a path keeps the first`);
  // keys relative to the record's p and q (the studio draws p + q d and q qk): q its turn at t = 0, p the middle of
  // where it goes (a key may be at most 1 km off p: the birds' route is longer than that from its start)
  const lo = [0, 1, 2].map(k => Math.min(...poses.map(ps => ps.p[k]))), hi = [0, 1, 2].map(k => Math.max(...poses.map(ps => ps.p[k])));
  const moveSpan = Math.max(...[0, 1, 2].map(k => hi[k] - lo[k]));
  const home = Math.max(0, awayAt.indexOf(false));   // (its place where it is on: one parked at the start stands there in the editor)
  const p0 = moveSpan > 900 ? lo.map((v, k) => (v + hi[k]) / 2) : poses[home].p, q0 = poses[home].q, qi = [-q0[0], -q0[1], -q0[2], q0[3]];
  const qMulL = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const rot = (q, v) => { const r = qMulL(qMulL(q, [v[0], v[1], v[2], 0]), [-q[0], -q[1], -q[2], q[3]]); return [r[0], r[1], r[2]]; };
  let prevQ = null;
  const keys = poses.map((ps, i) => {
    let q = qMulL(qi, ps.q);
    if (prevQ && q.reduce((s, x, k) => s + x * prevQ[k], 0) < 0) q = q.map(x => -x);
    prevQ = q;
    return [ts[i], ...rot(qi, ps.p.map((v, k) => v - p0[k])), ...q];
  });
  // fewer keys: drop each one the straight line (and turn) between its neighbours kept puts within 4 mm and 0.9 degrees
  const lerpKey = (a, b, t) => { const u = (t - a[0]) / (b[0] - a[0]); let d = a[4] * b[4] + a[5] * b[5] + a[6] * b[6] + a[7] * b[7], bq = b.slice(4); if (d < 0) { bq = bq.map(x => -x); d = -d; }
    const q = a.slice(4).map((x, k) => x + (bq[k] - x) * u), nq = Math.hypot(...q); return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u, ...q.map(x => x / nq)]; };
  const close = (k, l) => Math.hypot(k[1] - l[0], k[2] - l[1], k[3] - l[2]) <= 0.004 && 2 * Math.acos(Math.min(1, Math.abs(k[4] * l[3] + k[5] * l[4] + k[6] * l[5] + k[7] * l[6]))) <= 0.9 * Math.PI / 180;
  const kept = [keys[0]];
  let i = 0;
  while (i < keys.length - 1) {
    let j = i + 1;
    while (j + 1 < keys.length) {
      let ok = true;
      for (let m = i + 1; m <= j; m++) if (!close(keys[m], lerpKey(keys[i], keys[j + 1], keys[m][0]))) { ok = false; break; }
      if (!ok) break;
      j++;
    }
    kept.push(keys[j]); i = j;
  }
  const out = kept.map(k => [Math.round(k[0] * 1000) / 1000, ...k.slice(1, 4).map(v => Math.round(v * 1000) / 1000 || 0), ...k.slice(4).map(v => Math.round(v * 10000) / 10000 || 0)]);
  for (let a = 1; a < out.length; a++) if (out[a][0] <= out[a - 1][0]) out[a][0] = Math.round((out[a - 1][0] + 0.001) * 1000) / 1000;
  if (out.some(k => k.slice(1, 4).some(v => Math.abs(v) > 1000))) { note(`${o.name}: its path goes more than 1 km from where it starts: left out`); continue; }
  o.p = p0.map(r3); o.q = q0.map(r4);
  const len = out[out.length - 1][0], play = once ? 'once' : 'loop';
  if (out.length > 600 || len > 120) {
    const file = `recordings/${o.name.replace(/[^\w .-]/g, '_')}-${o.id}.json`;
    recordings.set(file, { studio: 1, recording: 1, item: o.name, len, n: out.length, k: out });
    o.path = { src: file, len, n: out.length, play, start: 'shown', speed: 1 };
  } else o.path = { k: out, play, start: 'shown', speed: 1 };
  if (seqDir) { scheduled.add(o.id); seqOf.get(seqDir).ev.unshift({ t: 0, on: o.id, what: 'path', how: 'once' }); seqOf.get(seqDir).items.add(o.id); }
  if (!exact) note(`${o.name}: its movements repeat together only after more than 10 minutes in Unity: its path is the first 10 minutes, then starts again`);
  if (awayAt.some(Boolean)) note(`${o.name}: turned off and on by a timeline: parked ${AWAY} m under the floor by its path while off`);
  o.moves = `${out.length} keys over ${len.toFixed(1)} s`;
}
// a sound that follows an object keeps its place on it (o: in the object's frame, turned but not scaled)
for (const s of sounds) if (s.on) {
  const o = objects.find(x => x.id === s.on);
  if (!o) { delete s.on; continue; }
  const qi = [-o.q[0], -o.q[1], -o.q[2], o.q[3]], d = s.p.map((v, k) => v - o.p[k]);
  const qm = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const r = qm(qm(qi, [...d, 0]), o.q);
  const off = r.slice(0, 3).map(v => Math.round(v * 1000) / 1000 || 0);
  if (off.some(v => Math.abs(v) > 1000)) { delete s.on; continue; }
  if (off.some(v => v !== 0)) s.o = off;
}

// the items under a node (a trigger's target is a whole object, with all it holds): all of them for hiding; for showing,
// not what is off in Unity under it at the start (a child its own trigger turns on: Unity, turning the parent on, leaves
// it off until that trigger has fired once; after that it comes back with its parent, unless something turns it off
// itself, as the CLEANERs do music parts 4 to 6 — no fixed list is right on both rounds, and this one is right on the
// first, which a visitor sees first), but what an activation track turns on and off (its path parks it while off)
const under = n => { const out = [...(itemOf.get(n) || [])]; n.children.forEach(c => out.push(...under(c))); return out; };
const shownUnder = n => { const out = [...(itemOf.get(n) || [])]; n.children.forEach(c => { if (c.self || actTargeted.has(c)) out.push(...shownUnder(c)); }); return out; };
// CLEANER and activator (scripts of the owner's): each time their object is turned on (it or a parent), they turn up to
// five objects off, or on, in order (stopping at an empty field, as the script throws there). Folded into the stay cubes
// that turn on a part holding them (on the way down from it to the script nothing off): those cubes also hide and show
// what the scripts name. Unity runs them only when the part was off; a cube does it each time it is entered.
const resetFields = r => [0, 1, 2, 3, 4].map(i => ref(field(r.c.body, (r.off ? 'ObjectToDeactivate' : 'ObjectToActivate') + i))?.fileID).map(id => (id && id !== '0' ? id : null));
const resetsTurnedOnBy = T => resets.filter(r => {
  if (field(r.c.body, 'm_Enabled') === '0' || !live(r.node)) return false;
  for (let x = r.node; x; x = x.parent) { if (x === T) return true; if (!x.self) return false; }
  return false;
});
const foldResets = (targets, show, hide, who) => {
  for (const T of targets) for (const r of resetsTurnedOnBy(T)) {
    const f = resetFields(r), upto = f.indexOf(null) < 0 ? 5 : f.indexOf(null);
    for (const id of f.slice(0, upto)) {
      const x = nodeOfGo.get(id);
      if (!x) continue;
      (r.off ? hide : show).push(...(r.off ? under(x) : shownUnder(x)));
    }
    const named = f.slice(0, upto).filter(id => nodeOfGo.get(id)).map(id => nodeOfGo.get(id).name);
    if (named.length) note(`${who}: also does what ${r.off ? 'CLEANER' : 'activator'} on ${r.node.name} does as its part comes on (turns ${named.join(', ')} ${r.off ? 'off' : 'on'})`);
  }
};
for (const { node: n, t } of triggers) {
  if (!live(n)) continue;
  const box = n.comps.find(c => c.type === 'BoxCollider');
  if (!box) { note(`${n.name}: a trigger without a box collider: left out`); continue; }
  const nodes = fs_ => fs_.map(f => t[f] && nodeOfGo.get(t[f])).filter(Boolean);
  const outside = TRIGGER_FIELDS.filter(f => t[f] && !nodeOfGo.get(t[f]));
  const onEnter = nodes(['ObjectToActivate', 'SoundToActivate']), onExit = nodes(['ObjectToActivateOnExit']);
  const show = onEnter.flatMap(shownUnder), hide = nodes(['ObjectToDeactivate', 'SoundToDeactivate']).flatMap(under);
  const exitShow = onExit.flatMap(shownUnder), exitHide = nodes(['ObjectToDeactivateOnExit']).flatMap(under);
  // (while: what it does as you leave undoes what it did, object for object)
  const gos = fs_ => fs_.map(f => t[f]).filter(Boolean).sort().join();
  const symmetric = !!(t.ObjectToActivateOnExit || t.ObjectToDeactivateOnExit) && gos(['ObjectToActivateOnExit']) === gos(['ObjectToDeactivate', 'SoundToDeactivate']) &&
    gos(['ObjectToDeactivateOnExit']) === gos(['ObjectToActivate', 'SoundToActivate']);
  const outName = id => (GO.get(id) && !GO.get(id).stripped ? field(GO.get(id).body, 'm_Name') : id);
  // (a door to a part not imported: left out when all it shows is outside; else what is outside is dropped from it)
  const leads = ['ObjectToActivate', 'SoundToActivate'].filter(f => outside.includes(f)).map(f => outName(t[f]));
  if (leads.length && !onEnter.length && !onExit.length) { note(`${n.name}: leads to ${leads.join(', ')}, outside ${ROOT_PATH} or left out: left out (import that part too to have it)`); continue; }
  if (outside.length) note(`${n.name}: its trigger names objects outside ${ROOT_PATH} or left out (${outside.map(f => outName(t[f])).join(', ')}): those left out`);
  if (!symmetric) { foldResets(onEnter, show, hide, n.name); foldResets(onExit, exitShow, exitHide, `${n.name} (on leaving)`); }
  else if ([...onEnter, ...onExit].some(T => resetsTurnedOnBy(T).length)) note(`${n.name}: turns on a part whose CLEANER or activator scripts reset things as it comes on: not ported for a cube that undoes itself as you leave`);
  if (!show.length && !hide.length && !exitShow.length && !exitHide.length) { note(`${n.name}: a trigger with nothing here to show or hide: left out`); continue; }
  if (!symmetric && exitShow.length + exitHide.length) note(`${n.name}: what it does as you leave is not what it undoes: a cube that stays, and a sequence for what it does as you leave`);
  const c = vec(field(box.body, 'm_Center')), sz = vec(field(box.body, 'm_Size'));
  const Wt = toStudio(worldOf(n)), d = M.decompose(Wt), P = M.apply(Wt, [c.x, c.y, c.z]);
  const xAxis = M.apply(Wt, [1, 0, 0]).map((v, k) => v - Wt[12 + k]);
  const generic = /^(activate_\w*|\w*trigger\w*)$/i.test(n.name) && n.parent;   // (a box named for what it is: named after its parent)
  cubes.push({ keys: [n.key], name: (generic ? `${n.parent.name}/${n.name}` : n.name).slice(0, 60), p: P.map(r3), yaw: r4(Math.atan2(-xAxis[2], xAxis[0])),
    size: [sz.x * d.s[0], sz.y * d.s[1], sz.z * d.s[2]].map(x => Math.max(0.01, r3(Math.abs(x)))), mode: symmetric ? 'while' : 'stay',
    show: [...new Set(show)], hide: [...new Set(hide)], exitShow: symmetric ? [] : [...new Set(exitShow)], exitHide: symmetric ? [] : [...new Set(exitHide)] });
}
// Copies of one box (the same place, size and turn), as each world keeps its own door to the others, are one cube: Unity
// has only the copy of the world you are in active, and walking into the place does what all of them together say (show
// that world, hide the others). Something both shown and hidden by the copies is shown.
{
  const same = (a, b) => a.mode === b.mode && Math.abs(a.yaw - b.yaw) < 1e-3 && [0, 1, 2].every(k => Math.abs(a.p[k] - b.p[k]) < 0.01 && Math.abs(a.size[k] - b.size[k]) < 0.01);
  const merged = [];
  for (const c of cubes) {
    const m = merged.find(x => same(x, c));
    if (!m) { merged.push(c); continue; }
    m.keys.push(...c.keys); m.show = [...new Set([...m.show, ...c.show])]; m.hide = [...new Set([...m.hide, ...c.hide])];
    m.exitShow = [...new Set([...m.exitShow, ...c.exitShow])]; m.exitHide = [...new Set([...m.exitHide, ...c.exitHide])];
  }
  // what a while cube shows (the hut's small cut-out) is shown by it alone: a world shown again by a stay cube shows its
  // other items, as Unity, activating the world, leaves such a part as its own trigger last set it (off, once left)
  const whileShown = new Set(merged.filter(c => c.mode === 'while').flatMap(c => c.show));
  for (const m of merged) {
    if (m.mode === 'stay') m.show = m.show.filter(id => !whileShown.has(id));
    m.hide = m.hide.filter(id => !m.show.includes(id));
    if (m.keys.length > 1) m.name = m.name.split('/')[0];
    m.id = idOf('cube:' + m.keys.slice().sort().join('+'));
  }
  cubes.length = 0;
  for (const m of merged) { const { keys, id, ...rest } = m; cubes.push({ id, ...rest }); }
}
// One model file placed in the same place by several worlds, with other pictures (the small cut-out in Atelierwhite,
// outdoor and the hut; the 100 m box in atelier_blaetter and Atelierwhite) is one object: each cube that showed one of
// the copies shows it and puts that copy's picture on it (a cube's tex entry: of the active cubes, the one entered last
// wins; with none active the object's own picture is back). Its own file is the copy's shown from the start, else one
// with a picture. A copy without a picture gets one of its material's colour.
// Only with --merge-copies: the owner saw some pictures come out wrong in the headset (16 November 2026) and chose each
// world's own copy, with its own GLB, as Unity has it.
const pictures = new Map();   // pictures/<name> -> { src, px } or { colour }
if (!DRY && MERGE) {
  const same = (a, b) => a.file.split('--')[0].replace(/\.glb$/, '') === b.file.split('--')[0].replace(/\.glb$/, '') && a.clip === b.clip &&
    [0, 1, 2].every(k => Math.abs(a.p[k] - b.p[k]) < 0.01) && Math.abs(Math.abs(a.q.reduce((t, x, k) => t + x * b.q[k], 0)) - 1) < 1e-4 && Math.abs(a.s / b.s - 1) < 1e-3;
  const glbMat = file => {
    const b = fs.readFileSync(path.join(OUT, ...file.split('/'))), j = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8'));
    const m = (j.materials || [])[0] || {}, pbr = m.pbrMetallicRoughness || {};
    return { count: (j.materials || []).length, colour: pbr.baseColorFactor || [1, 1, 1, 1], textured: !!pbr.baseColorTexture };
  };
  const visibleFromStart = n => { for (let x = n; x; x = x.parent) if (!x.self) return false; return true; };
  // (not what moves, what a timeline schedules, nor what a while cube swaps: those stay the copy of their own world)
  const ownWorld = new Set([...cubes.filter(c => c.mode === 'while').flatMap(c => [...c.show, ...c.hide]), ...[...seqOf.values()].flatMap(s => [...s.items])]);
  const groups = [];
  for (const o of objects) { if (o.path || ownWorld.has(o.id)) continue; const g = groups.find(g => same(g[0], o)); if (g) g.push(o); else groups.push([o]); }
  const remap = new Map();
  for (const g of groups) {
    if (g.length < 2 || new Set(g.map(o => o.file)).size < 2) continue;   // (one file everywhere: the copies already share it, the studio loads it once)
    const mats = g.map(o => glbMat(o.file));
    if (mats.some(m => m.count !== 1)) { note(`${g[0].name}: one file in one place in several worlds, but with several materials: kept as copies`); continue; }
    const keep = g.find(o => visibleFromStart(objNode.get(o.id))) || g.find((o, i) => mats[i].textured) || g[0];
    const km = mats[g.indexOf(keep)];
    // each copy's picture: the Unity material's texture given to that placement, else the file's own (its default material's)
    const pictureOf = (o, m) => {
      const v = models.get(objNode.get(o.id).variant.key);
      if (!m.textured) {
        const c = [0, 1, 2].map(k => Math.min(1, m.colour[k] / Math.max(1e-3, km.colour[k])));
        const name = `pictures/colour-${c.map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}.png`;
        pictures.set(name, { colour: c });
        return name;
      }
      // (else the picture the file names, found beside it as the converter found it)
      const named = (v.info?.rec.tex || []).find(t => !t.slot || t.slot === 'map');
      const besideIt = named && named.from && !named.from.startsWith('~') ? path.join(path.dirname(v.src), ...named.from.split('/')) : null;
      const src = v.pictures[0] || [...v.meta.materials.values()].map(f => textureOfMat(f)).find(Boolean) || (besideIt && fs.existsSync(besideIt) ? besideIt : null);
      if (!src) return null;
      const name = `pictures/${path.basename(path.dirname(src))}-${path.basename(src, path.extname(src))}${/\.png$/i.test(src) ? '.png' : '.jpg'}`.replace(/[^\w ./-]/g, '_');
      pictures.set(name, { src, px: Math.min(MAX_TEX, texFor(v.src) || MAX_TEX) });
      return name;
    };
    const pics = g.map((o, i) => pictureOf(o, mats[i]));
    if (pics.some(p => !p)) { note(`${g[0].name}: a copy's picture was not found: kept as copies`); continue; }
    for (const o of g) if (o !== keep) remap.set(o.id, keep.id);
    for (const c of cubes) {
      const shows = g.map((o, i) => (c.show.includes(o.id) ? i : -1)).filter(i => i >= 0);
      if (!shows.length) continue;
      c.tex = (c.tex || []).filter(e => e.on !== keep.id);
      c.tex.push({ on: keep.id, mat: 0, slot: 'map', file: pics[shows[0]] });
    }
    note(`${keep.name}: one object for ${g.length} copies in one place (${g.map(o => o.file.replace('models/', '')).join(', ')}); its cubes switch its picture`);
  }
  if (remap.size) {
    const map = id => remap.get(id) || id;
    for (const c of cubes) { c.show = [...new Set(c.show.map(map))]; c.hide = [...new Set(c.hide.map(map))].filter(id => !c.show.includes(id)); c.exitShow = [...new Set(c.exitShow.map(map))]; c.exitHide = [...new Set(c.exitHide.map(map))]; }
    for (const [n, ids] of itemOf) itemOf.set(n, [...new Set(ids.map(map))]);
    for (const s of sounds) if (s.on) s.on = map(s.on);
    for (const s of seqOf.values()) { s.items = new Set([...s.items].map(map)); for (const e of s.ev) e.on = map(e.on); }
    for (let i = objects.length - 1; i >= 0; i--) if (remap.has(objects[i].id)) objects.splice(i, 1);
  }
}

// The world shown when the scene opens: the studio hides an item some cube lists in show until a cube shows it ("it
// waits for its cube"), so what Unity shows from the start, and a stay cube shows again later, is shown by a sequence
// that starts as the scene opens (start 'open', shared): its show events are a source in the cubes' rule from that
// moment, so any door walked into later decides over it, and nothing stamps it again (a cube with a key would be
// stamped again when a headset comes back to its station in a room, and show the first world over the one it was in).
// It shows about 1.5 s after the scene's items are in.
const empties = [];
const firstWorld = [];
function shownAtStart(n) { for (let x = n; x; x = x.parent) if (!x.self) return false; return true; }
{
  const visibleFromStart = n => { for (let x = n; x; x = x.parent) if (!x.self) return false; return true; };
  const stayShown = new Set([...cubes.filter(c => c.mode === 'stay').flatMap(c => c.show), ...cubes.flatMap(c => c.exitShow || [])]);
  for (const n of all) if (live(n) && visibleFromStart(n)) for (const id of itemOf.get(n) || []) if (stayShown.has(id) && !firstWorld.includes(id)) firstWorld.push(id);
}

// ---- sequences: a timeline that turns things on and off or plays takes at given moments becomes a sequence (each
// person's own, as Unity's triggers were), started by the doors that show its world and stopped by those that hide it;
// the first world's start as the scene opens
const sequences = [];
if (firstWorld.length) sequences.push({ id: idOf('start:sequence'), name: 'Start: the first world', len: 0.1,
  ev: firstWorld.slice(0, 200).map(on => ({ t: 0, on, what: 'show', fade: 'cut' })), start: 'open' });
if (firstWorld.length > 200) note(`the first world has more than 200 items: the start shows the first 200`);
// what a trigger does as you leave it, when that is not undoing what it did (the box's crouching woman, shown as you
// straighten up and leave it): a short sequence of shows and hides its cube starts as you leave (when: 'leave')
const exitSeqs = [];
for (const c of cubes) {
  const ex = { show: c.exitShow || [], hide: (c.exitHide || []).filter(id => !(c.exitShow || []).includes(id)) };
  delete c.exitShow; delete c.exitHide;
  if (!ex.show.length && !ex.hide.length) continue;
  const ev = [...ex.show.map(on => ({ t: 0, on, what: 'show' })), ...ex.hide.map(on => ({ t: 0, on, what: 'hide' }))];
  if (ev.length > 190) note(`${c.name}: does more than 190 things as you leave: the first 190 kept`);
  const q = { id: idOf('leave:' + c.id), name: `On leaving ${c.name}`.slice(0, 60), len: 0.1, sync: 'own', ev: ev.slice(0, 190), shows: ex.show };
  exitSeqs.push(q);
  c.plays = [...(c.plays || []), { on: q.id, what: 'seq', how: 'once', when: 'leave' }];
}
// (the directors turned on by another's activation track: started by its sequence where an activation starts, stopped
// where it ends; a director that stops (wrap none) and leaves its target on afterwards turns it on again at its end)
for (const [dir, list] of startedBy) for (const { p, tr, runs, seam } of list) {
  const sid = idOf('seq:' + dir.id), pev = seqOf.get(p).ev;
  const offAfter = p.wrap === 2 && !activeAt(p, tr, p.D + 1, targetOf(tr).self);   // (a director that stops and turns it off then)
  runs.forEach((r, i) => {
    if (!(seam && i === 0)) pev.push({ t: r.start, on: sid, what: 'seq', how: 'once' });
    if (r.end < p.D - 0.005 || offAfter) pev.push({ t: Math.min(r.end, p.D), on: sid, what: 'seq', how: 'stop' });
  });
  if (p.wrap === 2 && tr.post === 0 && runs[runs.length - 1].end < p.D - 0.005) pev.push({ t: p.D, on: sid, what: 'seq', how: 'once' });
}
for (const [dir, { ev, items }] of seqOf) {
  const goName = nodeOfGo.get(dir.go)?.name || 'timeline';
  const id = idOf('seq:' + dir.id), len = Math.round(dir.D * 100) / 100;
  // (an event past a Timeline of fixed length never fires in Unity: left out; the rest to 0.01 s, in order)
  const evs = ev.filter(e => e.t <= dir.D + 1e-6).map(e => ({ ...e, t: Math.min(len, Math.round(e.t * 100) / 100) })).sort((a, b) => a.t - b.t);
  if (evs.length > 200) { note(`${goName}: its timeline makes more than 200 events: the first 200 kept`); evs.length = 200; }
  // (it starts as the scene opens when its own object is on from the start, as Unity plays it on awake; else a door
  // that shows it starts it)
  // (or when a looping director on from the start keeps the off object above it on all along)
  const kept = new Set((keptOn.get(dir) || []).filter(e => !isChild(e.p) && shownAtStart(nodeOfGo.get(e.p.go))).map(e => e.tn));
  const onAtStart = n => { for (let x = n; x; x = x.parent) if (!x.self && !kept.has(x)) return false; return true; };
  const child = isChild(dir), first = !child && onAtStart(nodeOfGo.get(dir.go));
  sequences.push({ id, name: `Timeline ${goName}`.slice(0, 60), len, ...(dir.wrap === 1 ? { loop: 'loop' } : {}), ...(first ? { start: 'open' } : {}), sync: 'own', ev: evs });
  // the doors: a stay cube that shows its items starts it (unless another Timeline does), one that hides them stops it;
  // a while cube does that as you go in and the opposite as you leave (the ladder hides every room while you are up:
  // their Timelines stop, and start from the beginning as the rooms come back, as Unity plays them on awake)
  for (const c of cubes) {
    const shows = [...items].some(i => c.show.includes(i)), hides = !shows && [...items].some(i => c.hide.includes(i));
    if (!shows && !hides) continue;
    const want = c.mode === 'stay' ? (shows ? (child ? [] : [{ how: 'once' }]) : [{ how: 'stop' }])
      : shows ? [...(child ? [] : [{ how: 'once' }]), { how: 'stop', when: 'leave' }] : [{ how: 'stop' }, ...(child ? [] : [{ how: 'once', when: 'leave' }])];
    if (!want.length) continue;
    c.plays = (c.plays || []).filter(p => p.on !== id);
    if (c.plays.length + want.length > 16) { note(`${c.name}: more than 16 things to start: ${goName}'s sequence left off it`); continue; }
    for (const w of want) c.plays.push({ on: id, what: 'seq', ...w });
  }
  if (!child) for (const q of exitSeqs) if ([...items].some(i => q.shows.includes(i)) && q.ev.length < 200) q.ev.push({ t: 0, on: id, what: 'seq', how: 'once' });
}
for (const q of exitSeqs) { delete q.shows; sequences.push(q); }

// ---- sounds: mono MP3s (as the relay's ffmpeg makes them)
if (!DRY) for (const s of sounds) {
  const out = path.join(OUT, ...s.file.split('/')), st = fs.statSync(s.src), want = `${rel(s.src)}|${st.size}|${Math.floor(st.mtimeMs)}`;
  if (!FORCE && record.sounds[s.file] === want && fs.existsSync(out)) continue;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', s.src, '-map', '0:a:0', '-vn', '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k', out], { encoding: 'utf8' });
  if (r.status !== 0) { note(`${s.file}: ffmpeg could not make it (${(r.stderr || r.error?.message || '').trim().split('\n').pop()})`); continue; }
  record.sounds[s.file] = want;
  console.log(`  ${s.file} made (${(fs.statSync(out).size / (1 << 20)).toFixed(1)} MB)`);
}
for (const s of sounds) delete s.src;

// ---- the pictures cubes put on objects: drawn down as the converter draws a model's (ffmpeg), or a plain colour
function solidPng(rgb) {   // an 8 x 8 PNG of one colour (Node's zlib)
  const crc = buf => { let c, crcs = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcs[n] = c >>> 0; }
    let x = 0xffffffff; for (const b of buf) x = crcs[(x ^ b) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4), t = Buffer.from(type), c = Buffer.alloc(4); len.writeUInt32BE(data.length); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(8, 0); ihdr.writeUInt32BE(8, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.from([0, ...Array(8).fill(rgb.map(v => Math.round(v * 255))).flat()]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(8).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
}
if (!DRY) for (const [name, pic] of pictures) {
  const out = path.join(OUT, ...name.split('/'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (pic.colour) { fs.writeFileSync(out, solidPng(pic.colour)); continue; }
  const st = fs.statSync(pic.src), want = `${rel(pic.src)}|${st.size}|${Math.floor(st.mtimeMs)}|${pic.px}`;
  record.pictures = record.pictures || {};
  if (!FORCE && record.pictures[name] === want && fs.existsSync(out)) continue;
  const r = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', pic.src, '-vf', `scale='min(${pic.px},iw)':'min(${pic.px},ih)':force_original_aspect_ratio=decrease`, ...(name.endsWith('.jpg') ? ['-q:v', '3'] : []), out], { encoding: 'utf8' });
  if (r.status !== 0) { note(`${name}: ffmpeg could not make it (${(r.stderr || r.error?.message || '').trim().split('\n').pop()})`); continue; }
  record.pictures[name] = want;
  console.log(`  ${name} made (${(fs.statSync(out).size / (1 << 20)).toFixed(1)} MB)`);
}

// ---- the layout
const layout = { studio: 1, scene: path.basename(OUT), saved: new Date().toISOString(), objects, cubes, sounds };
if (shapes.length) layout.shapes = shapes;
if (empties.length) layout.empties = empties;
if (sequences.length) layout.sequences = sequences;
if (counts.lights) note(`${counts.lights} light(s): the studio lights its scenes itself (lit models), not ported`);
if (counts.particles) note(`${counts.particles} particle system(s): not ported yet`);
if (counts.cameras) note(`${counts.cameras} camera(s): left out`);
if (counts.randomPhase) note(`StartAnimatorRandom on ${counts.randomPhase} dancer(s) (each starts its clip at a random moment in Unity): not ported yet, they move in step (a studio field for a clip's start is asked for)`);
console.log(`\n${ROOT_PATH}: ${objects.length} models (${models.size} files), ${cubes.length} trigger cubes, ${sounds.length} sounds, ${shapes.length} shapes; ${counts.inactive} objects inactive and never shown, left out`);
for (const o of objects) console.log(`  ${o.id} ${o.name.padEnd(42)} ${o.file.padEnd(48)} s ${o.s} ${o.light}${o.clip ? ' clip ' + o.clip : ''}${o.moves ? ' path ' + o.moves + (o.path.src ? ' (file)' : '') : ''}`);
for (const c of cubes) console.log(`  cube ${c.id} ${c.name}: ${c.mode}, shows ${c.show.length}, hides ${c.hide.length}${c.tex ? ', pictures ' + c.tex.length : ''}${c.plays ? ', starts ' + c.plays.filter(p => p.how !== 'stop').length + ', stops ' + c.plays.filter(p => p.how === 'stop').length : ''}`);
for (const q of sequences) console.log(`  sequence ${q.id} ${q.name}: ${q.len} s${q.loop ? ', loops' : ''}, ${q.ev.length} events`);
for (const o of objects) delete o.moves;
if (notes.length) { console.log('\nnot ported or approximated:'); for (const s of notes) console.log('  - ' + s); }
if (DRY) { console.log('\n--dry: nothing written'); process.exit(0); }
for (const [file, rec] of recordings) {
  fs.mkdirSync(path.join(OUT, 'recordings'), { recursive: true });
  fs.writeFileSync(path.join(OUT, ...file.split('/')), JSON.stringify(rec) + '\n');
}
fs.writeFileSync(path.join(OUT, 'layout.json'), JSON.stringify(layout, null, 1) + '\n');
// what this layout no longer names leaves the scene folder (the relay would list it): a GLB a merge left unused goes to
// .cache/ (a dot folder, never listed) so a run again keeps its conversion; old sounds, pictures and recordings go
{
  const named = new Set([...objects.map(o => o.file), ...sounds.map(s => s.file), ...recordings.keys(), ...cubes.flatMap(c => (c.tex || []).map(e => e.file))]);
  const gone = [];
  for (const dir of ['models', 'sounds', 'pictures', 'recordings']) {
    let list = [];
    try { list = fs.readdirSync(path.join(OUT, dir)); } catch {}
    for (const f of list) {
      const p = `${dir}/${f}`;
      if (named.has(p) || !/\.(glb|mp3|png|jpg|json)$/i.test(f)) continue;
      if (dir === 'models' && [...models.values()].some(v => v.out === p)) {
        fs.mkdirSync(path.join(OUT, '.cache', dir), { recursive: true });
        fs.renameSync(path.join(OUT, dir, f), path.join(OUT, '.cache', dir, f));
      } else { fs.rmSync(path.join(OUT, dir, f)); if (dir !== 'models') { delete record.sounds[p]; delete (record.pictures || {})[p]; } else delete record.conversions[p]; }
      gone.push(p);
    }
  }
  if (gone.length) console.log(`  ${gone.length} file(s) the layout no longer names taken out of the scene folder (models a merge left unused kept in .cache/)`);
}
record.unity = { scene: rel(SCENE), root: ROOT_PATH };
record.at = new Date().toISOString();
fs.writeFileSync(RECORD, JSON.stringify(record, null, 1) + '\n');
console.log(`\nwrote ${path.join(OUT, 'layout.json')}`);
