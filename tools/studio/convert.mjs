// node tools/studio/convert.mjs <in.fbx|in.glb|in.gltf> [out.glb] [--max-texture 4096] [--no-weld] [--shots <dir>]
// A model made lighter for a headset (tools/studio/SPEC.md, "Models"): loaded in headless Chromium with three.js r128's
// own loaders (tools/studio/vendor/, and three.min.js from the repository's root), given the studio's guess of its units
// and up axis (an FBX's GlobalSettings, read from the file's bytes here, since the loader ignores them), its textures
// drawn down to --max-texture px on their longer side (4,096 by default), its triangles' shared corners welded into an
// index (an FBX's loader repeats every corner: three times the vertices; --no-weld keeps them), and written as one binary
// glTF with GLTFExporter (animations and skins kept, opaque textures as JPEG, the rest as PNG). The guess goes into the
// file (its root node's scale and turn), so the GLB is in metres and Y up, as glTF is. Then the GLB is loaded back and
// compared with the original: triangles, size, textures, animations, bones, and where the bones and a sample of skinned
// corners are at a few moments of every animation, and both drawn from three sides (lit evenly, so the textures show as
// they are) and the pictures compared (--shots <dir> keeps them). When something did not come through (an animation
// dropped, a skin that moves differently, a texture that looks different), nothing is written and it says why (exit 1). Textures the file names but does not hold are
// looked for beside it (by file name, in any case, up to 4 folders down), as the studio does.
// Needs Playwright with a Chromium build (as tools/smoke.mjs; PLAYWRIGHT_MODULE and CHROMIUM_PATH as there).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sceneFiles } from '../../relay/scenes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const USAGE = 'usage: node tools/studio/convert.mjs <in.fbx|in.glb|in.gltf> [out.glb] [--max-texture 4096] [--no-weld] [--shots <dir>]';
const args = process.argv.slice(2), pos = [];
let maxTex = 4096, weld = true, shots = '';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--max-texture') { maxTex = Number(args[++i]); continue; }
  if (args[i] === '--shots') { shots = args[++i] || ''; if (!shots) { console.log(USAGE); process.exit(1); } continue; }
  if (args[i] === '--no-weld') { weld = false; continue; }
  if (args[i].startsWith('--') || pos.length >= 2) { console.log(USAGE); process.exit(1); }
  pos.push(args[i]);
}
if (!pos.length || !(maxTex >= 256 && maxTex <= 16384)) { console.log(USAGE + '\n  --max-texture: 256 to 16384'); process.exit(1); }
const input = path.resolve(pos[0]), ext = path.extname(input).toLowerCase();
if (!['.fbx', '.glb', '.gltf'].includes(ext) || !fs.existsSync(input)) { console.log(`${input}: not there, or not .fbx, .glb or .gltf\n${USAGE}`); process.exit(1); }
const base = path.basename(input, path.extname(input));
const output = path.resolve(pos[1] || path.join(path.dirname(input), ext === '.glb' ? `${base}-${maxTex}.glb` : `${base}.glb`));
if (output === input) { console.log('the output would overwrite the input: give another name'); process.exit(1); }
if (path.extname(output).toLowerCase() !== '.glb') { console.log('the output is a binary glTF: name it .glb'); process.exit(1); }

// ---- an FBX's GlobalSettings, from its bytes: UnitScaleFactor (cm per unit), UpAxis and UpAxisSign
function fbxSettings(buf) {
  const want = new Set(['UnitScaleFactor', 'OriginalUnitScaleFactor', 'UpAxis', 'UpAxisSign']), out = {};
  if (buf.subarray(0, 18).toString('latin1') === 'Kaydara FBX Binary') {
    const version = buf.readUInt32LE(23), big = version >= 7500, W = big ? 8 : 4;
    const num = at => (big ? Number(buf.readBigUInt64LE(at)) : buf.readUInt32LE(at));
    const node = at => {   // one node record's header: where it ends, its name, its properties and children
      if (at + 3 * W + 1 > buf.length) return null;
      const end = num(at), n = num(at + W), plen = num(at + 2 * W), nl = buf[at + 3 * W], name = buf.toString('latin1', at + 3 * W + 1, at + 3 * W + 1 + nl);
      return { end, n, name, props: at + 3 * W + 1 + nl, kids: at + 3 * W + 1 + nl + plen };
    };
    const props = (at, n) => {   // a node's properties (only what a P record of GlobalSettings needs; arrays skipped)
      const vals = [];
      for (let i = 0; i < n; i++) {
        const t = String.fromCharCode(buf[at++]);
        if (t === 'S' || t === 'R') { const l = buf.readUInt32LE(at); vals.push(buf.toString('utf8', at + 4, at + 4 + l)); at += 4 + l; }
        else if (t === 'Y') { vals.push(buf.readInt16LE(at)); at += 2; }
        else if (t === 'C') { vals.push(buf[at]); at += 1; }
        else if (t === 'I') { vals.push(buf.readInt32LE(at)); at += 4; }
        else if (t === 'F') { vals.push(buf.readFloatLE(at)); at += 4; }
        else if (t === 'D') { vals.push(buf.readDoubleLE(at)); at += 8; }
        else if (t === 'L') { vals.push(Number(buf.readBigInt64LE(at))); at += 8; }
        else if ('fdlib'.includes(t)) { const cl = buf.readUInt32LE(at + 8); vals.push(null); at += 12 + cl; }
        else return vals;
      }
      return vals;
    };
    const kids = (nd, fn) => { for (let at = nd.kids; at < nd.end;) { const k = node(at); if (!k || !k.end) break; fn(k); at = k.end; } };
    for (let at = 27; at < buf.length;) {   // the top-level records; GlobalSettings is near the start
      const nd = node(at);
      if (!nd || !nd.end || nd.end <= at) break;
      if (nd.name === 'GlobalSettings') {
        kids(nd, p70 => { if (p70.name === 'Properties70') kids(p70, p => { if (p.name !== 'P') return; const v = props(p.props, p.n); if (want.has(v[0])) out[v[0]] = v[4]; }); });
        break;
      }
      at = nd.end;
    }
    out.format = `binary FBX ${version}`;
  } else {
    const text = buf.toString('utf8', 0, Math.min(buf.length, 4 << 20));
    for (const k of want) {
      const m = new RegExp(`P:\\s*"${k}"\\s*,\\s*"[^"]*"\\s*,\\s*"[^"]*"\\s*,\\s*"[^"]*"\\s*,\\s*([-+\\d.eE]+)`).exec(text);
      if (m) out[k] = Number(m[1]);
    }
    const v = /FBXVersion:\s*(\d+)/.exec(text);
    out.format = `ASCII FBX ${v ? v[1] : ''}`.trim();
  }
  return out;
}

const bytes = fs.readFileSync(input);
const meta = ext === '.fbx' ? fbxSettings(bytes) : { format: ext === '.glb' ? 'binary glTF' : 'glTF' };
// the files beside it (a texture it names but does not hold; a .gltf's .bin), by the studio's listing rules
const listing = (await sceneFiles(path.dirname(input))).files.map(f => f.path);

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
// (WebGL in software, as the smoke test has it: only to draw both for the comparison)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--js-flags=--max-old-space-size=8192', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let out = null;
try {
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => { const t = m.text(); if (m.type() === 'warning' || m.type() === 'error') logs.push(t); });
  page.on('pageerror', e => logs.push('page error: ' + e.message));
  const LIBS = ['fflate.min.js', 'NURBSUtils.js', 'NURBSCurve.js', 'TGALoader.js', 'FBXLoader.js', 'GLTFLoader.js', 'GLTFExporter.js', 'SkeletonUtils.js'];
  let glb = null;
  await page.route('http://convert.local/**', async route => {
    const u = new URL(route.request().url()), p = decodeURIComponent(u.pathname);
    if (p === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>convert</title>' +
      ['three.min.js', ...LIBS].map(f => `<script src="/lib/${f}"></script>`).join('') });
    if (p === '/lib/three.min.js') return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(REPO, 'three.min.js')) });
    if (p.startsWith('/lib/') && LIBS.includes(p.slice(5))) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(HERE, 'vendor', p.slice(5))) });
    if (p.startsWith('/in/') && listing.includes(p.slice(4))) return route.fulfill({ body: fs.readFileSync(path.join(path.dirname(input), ...p.slice(4).split('/'))) });
    if (p === '/out' && route.request().method() === 'POST') { glb = route.request().postDataBuffer(); return route.fulfill({ body: 'ok' }); }
    return route.fulfill({ status: 404, body: 'not found' });
  });
  await page.goto('http://convert.local/');
  out = await page.evaluate(convertInPage, { file: path.basename(input), ext, meta, listing, maxTex, weld });
  out.logs = logs;
  out.glbBytes = glb ? glb.length : 0;
  out.images = glb ? glbImages(glb) : [];
  if (shots && out.sheet) {
    fs.mkdirSync(shots, { recursive: true });
    out.sheetFile = path.join(path.resolve(shots), `${base}-compare.png`);
    fs.writeFileSync(out.sheetFile, Buffer.from(out.sheet.split(',')[1], 'base64'));
  }
  if (out.ok && glb) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, glb);
  }
} finally { await browser.close(); }

// what a GLB holds its pictures as (from its JSON chunk)
function glbImages(buf) {
  try {
    if (buf.toString('latin1', 0, 4) !== 'glTF' || buf.toString('latin1', 16, 20) !== 'JSON') return [];
    const j = JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12)));
    return (j.images || []).map(i => (i.mimeType || '?').replace('image/', '').toUpperCase());
  } catch { return []; }
}

// ---- the report: the original beside the GLB
const mb = n => (n >= 1 << 20 ? (n / (1 << 20)).toFixed(1) + ' MB' : (n / 1024).toFixed(0) + ' KB');
const int = n => Number(n).toLocaleString('en-GB');
const tex = t => (t.length ? t.map(x => `${x.w}x${x.h}${x.kind ? ' ' + x.kind : ''}`).join(', ') : 'none');
const clips = c => (c.length ? c.map(x => `${JSON.stringify(x.name)} ${x.duration.toFixed(2)} s (${x.tracks} tracks)`).join(', ') : 'none');
const dims = d => d.map(x => x.toFixed(2)).join(' x ') + ' m';
const s = (v, w = 34) => String(v).padEnd(w);
const A = out.before, B = out.after || {};
console.log(`${path.basename(input)} (${meta.format})`);
for (const line of out.notes) console.log('  ' + line);
if (A) {
  console.log(`\n  ${s('', 22)}${s('original')}${out.ok ? 'GLB' : 'GLB (not written)'}`);
  const row = (k, a, b) => console.log(`  ${s(k, 22)}${s(a)}${b === undefined ? '' : b}`);
  row('file', mb(bytes.length), out.glbBytes ? mb(out.glbBytes) : '');
  row('triangles', int(A.tris), B.tris !== undefined ? int(B.tris) : undefined);
  row('vertices', int(A.verts), B.verts !== undefined ? int(B.verts) : undefined);
  row('meshes (skinned)', `${A.meshes} (${A.skinned})`, B.meshes !== undefined ? `${B.meshes} (${B.skinned})` : undefined);
  row('bones', A.bones, B.bones);
  row('size as placed', dims(A.size), B.size ? dims(B.size) : undefined);
  row('memory on the GPU', '~' + mb(A.gpu), B.gpu !== undefined ? '~' + mb(B.gpu) : undefined);
  row('textures', tex(A.textures), B.textures ? tex(B.textures) + (out.images.length ? ` (${out.images.join(', ')})` : '') : undefined);
  row('animations', clips(A.clips), B.clips ? clips(B.clips) : undefined);
  row('parse', `${(A.parse / 1000).toFixed(2)} s`, B.parse !== undefined ? `${(B.parse / 1000).toFixed(2)} s (textures included)` : undefined);
  row('with its textures', `${(A.ready / 1000).toFixed(2)} s`, B.parse !== undefined ? `${(B.parse / 1000).toFixed(2)} s` : undefined);
  if (out.check) console.log(`\n  checked: ${out.check}`);
  if (out.look) console.log(`  looks: ${out.look}${out.sheetFile ? ` (the pictures: ${out.sheetFile}; the original above, the GLB below)` : ''}`);
}
// (the missing textures' 404s are said above, as missing textures)
const warns = [...new Set(out.logs.filter(t => !/Use MeshStandardMaterial|Creating normalized normal|bigger than maxTextureSize|Failed to load resource: .*404/.test(t)))].slice(0, 12);
if (warns.length) console.log('\n  the loaders said:\n' + warns.map(t => '    ' + t.slice(0, 200)).join('\n'));
if (!out.ok) { console.log(`\nNOT WRITTEN: ${out.why}`); process.exit(1); }
console.log(`\nwrote ${output} (${mb(out.glbBytes)})`);
console.log('(times in headless Chromium on this machine, without a GPU: a headset is slower, but in the same proportion)');

// ---- in the page: load, guess, lighten, export, load back and compare
async function convertInPage({ file, ext, meta, listing, maxTex, weld }) {
  const T = THREE, notes = [], missing = new Set();
  const lower = new Map(listing.map(p => [p.slice(p.lastIndexOf('/') + 1).toLowerCase(), p]));
  const have = new Set(listing);
  const manager = new T.LoadingManager();
  manager.setURLModifier(url => {
    if (/^(blob|data):/.test(url)) return url;
    let p = '';
    try { p = decodeURIComponent(new URL(url, location.href).pathname); } catch { p = url; }
    if (p.startsWith('/in/') && have.has(p.slice(4))) return url;
    const name = url.split(/[?#]/)[0].split(/[\\/]/).pop();
    let n = name;
    try { n = decodeURIComponent(name); } catch { /* as it is */ }
    const hit = lower.get(n.toLowerCase());
    if (hit) return '/in/' + hit.split('/').map(encodeURIComponent).join('/');
    if (n && n !== 'undefined') missing.add(n);   // (the FBX loader asks for 'undefined' when a texture names no image)
    return '/missing/' + encodeURIComponent(n);
  });
  // when every texture has loaded (or failed): the manager's items counted here, since its own counters are private
  let pend = 0, settle;
  const ready = new Promise(r => { settle = r; });
  const iStart = manager.itemStart.bind(manager), iEnd = manager.itemEnd.bind(manager);
  manager.itemStart = u => { pend++; iStart(u); };
  manager.itemEnd = u => { iEnd(u); if (--pend === 0) settle(); };
  if (T.TGALoader) manager.addHandler(/\.tga$/i, new T.TGALoader(manager));

  const data = await (await fetch('/in/' + file.split('/').map(encodeURIComponent).join('/'))).arrayBuffer();
  const t0 = performance.now();
  let model, clips = [];
  if (ext === '.fbx') {
    model = new T.FBXLoader(manager).parse(data, '/in/');
    clips = model.animations || [];
  } else {
    const g = await new Promise((res, rej) => new T.GLTFLoader(manager).parse(data, '/in/', res, rej));
    model = g.scene || g.scenes[0]; clips = g.animations || [];
  }
  const parse = performance.now() - t0;
  if (pend === 0) settle();
  await Promise.race([ready, new Promise(r => setTimeout(r, 60000))]);
  // (an image element may be loaded but not yet decoded, where glTF's loader hands over decoded pictures: decoded here
  // and counted, so both times include the pictures)
  const images = new Set();
  model.traverse(o => { for (const m of [].concat(o.material || [])) for (const k in m) if (m[k] && m[k].isTexture && m[k].image) images.add(m[k].image); });
  for (const im of images) if (im.decode) await im.decode().catch(() => {});
  const readyMs = performance.now() - t0;

  // ---- the studio's guess (SPEC.md "Models"): FBX units and up axis; glTF is metres and Y up
  const wrap = new T.Object3D();
  wrap.name = file.replace(/\.[^.]+$/, '');
  wrap.add(model);
  const box0 = new T.Box3().setFromObject(model), side = Math.max(...box0.getSize(new T.Vector3()).toArray());
  if (ext === '.fbx') {
    const f = Number(meta.UnitScaleFactor) || 1, fit = s => side * s >= 0.05 && side * s <= 60;
    const scale = fit(f / 100) ? f / 100 : fit(1) ? 1 : 1 / (side || 1);
    wrap.scale.setScalar(scale);
    const up = meta.UpAxis === undefined ? 1 : Number(meta.UpAxis), sign = Number(meta.UpAxisSign) < 0 ? -1 : 1;
    if (up === 2) wrap.rotation.x = -sign * Math.PI / 2;      // Z up: a quarter turn about x stands it up
    else if (up === 0) wrap.rotation.z = sign * Math.PI / 2;  // X up
    else if (sign < 0) wrap.rotation.x = Math.PI;              // Y down
    notes.push(`units: UnitScaleFactor ${meta.UnitScaleFactor ?? '(none: 1)'} (cm a unit), largest side ${+side.toPrecision(4)} units: scale ${+scale.toPrecision(4)}` +
      (scale === f / 100 ? '' : scale === 1 ? ' (1 unit = 1 m: the file\'s own factor would make it ' + +(side * f / 100).toPrecision(3) + ' m)' : ' (sized to 1 m)'));
    notes.push(`up: ${['X', 'Y', 'Z'][up] || '?'}${sign < 0 ? ' (down)' : ''}${up === 2 ? ': stood up (a quarter turn about x)' : up === 0 ? ': turned about z' : sign < 0 ? ': turned over' : ''}`);
  }
  wrap.updateMatrixWorld(true);

  const stats = (root, cl) => {
    let tris = 0, verts = 0, meshes = 0, skinned = 0;
    const bones = new Set(), tex = new Map(), bufs = new Set();   // (bones: the skeletons' joints; a loader makes other bones plain nodes)
    root.traverse(o => {
      if (!o.isMesh) return;
      meshes++;
      if (o.isSkinnedMesh) { skinned++; for (const b of o.skeleton.bones) bones.add(b); }
      const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count;
      tris += n / 3; verts += g.attributes.position.count;
      for (const a of [g.index, ...Object.values(g.attributes), ...Object.values(g.morphAttributes || {}).flat()]) if (a && a.array) bufs.add(a.array);
      for (const m of [].concat(o.material || [])) for (const k of ['map', 'normalMap', 'emissiveMap', 'aoMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'specularMap', 'bumpMap', 'lightMap']) {
        const t = m[k];
        if (t && t.isTexture && !tex.has(t.image || t)) tex.set(t.image || t, { w: (t.image && (t.image.naturalWidth || t.image.width)) || 0, h: (t.image && (t.image.naturalHeight || t.image.height)) || 0, kind: t.format === T.RGBFormat ? 'JPEG' : (t.userData || {}).mimeType === 'image/jpeg' ? 'JPEG' : '' });
      }
    });
    // (geometry shared by several meshes counts once per mesh: as drawn)
    const size = new T.Box3().setFromObject(root).getSize(new T.Vector3()).toArray();
    const textures = [...tex.values()].filter(t => t.w);
    // the headset's memory for it, about: its vertex buffers, and every texture as RGBA with its mipmaps (4/3)
    const gpu = [...bufs].reduce((n, a) => n + a.byteLength, 0) + textures.reduce((n, t) => n + (t.w * t.h * 4 * 4) / 3, 0);
    return { tris: Math.round(tris), verts, meshes, skinned, bones: bones.size, size, textures, gpu, clips: cl.map(c => ({ name: c.name, duration: c.duration, tracks: c.tracks.length })) };
  };
  const before = { ...stats(wrap, clips), parse, ready: readyMs };
  // (the texture sizes as loaded: the stats above, before they are drawn down)
  if (missing.size) notes.push(`missing texture${missing.size > 1 ? 's' : ''} ${[...missing].join(', ')}: put ${missing.size > 1 ? 'them' : 'it'} beside the file (it is written untextured there)`);

  // ---- materials as glTF's: Phong and Lambert (the FBX loader's) become standard ones of the same look
  const toStd = m => {
    if (m.isMeshStandardMaterial || m.isMeshBasicMaterial || !m.isMaterial) return m;
    const spec = m.specular ? (m.specular.r + m.specular.g + m.specular.b) / 3 : 0;
    const rough = m.isMeshLambertMaterial || spec < 0.05 ? 1 : Math.min(1, Math.max(0.25, Math.sqrt(2 / ((m.shininess || 30) + 2))));
    const s = new T.MeshStandardMaterial({ name: m.name, color: m.color, map: m.map, normalMap: m.normalMap || null, emissive: m.emissive, emissiveMap: m.emissiveMap || null,
      emissiveIntensity: m.emissiveIntensity ?? 1, aoMap: m.aoMap || null, alphaMap: m.alphaMap || null, opacity: m.opacity, transparent: m.transparent, alphaTest: m.alphaTest,
      side: m.side, vertexColors: m.vertexColors, skinning: m.skinning, morphTargets: m.morphTargets, morphNormals: m.morphNormals, flatShading: m.flatShading, metalness: 0, roughness: rough });
    if (m.normalScale) s.normalScale.copy(m.normalScale);
    if (m.bumpMap || m.specularMap) notes.push(`${m.name || 'a material'}: its ${[m.bumpMap && 'bump', m.specularMap && 'specular'].filter(Boolean).join(' and ')} map is left out (glTF has none)`);
    return s;
  };
  const textures = new Map();   // texture -> its image as drawn down
  const canvasOf = (img, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h); return c; };
  const opaque = img => {   // any pixel that is not opaque (on a small copy: enough to tell)
    const k = Math.min(1, 512 / Math.max(img.width, img.height)), c = canvasOf(img, Math.max(1, Math.round(img.width * k)), Math.max(1, Math.round(img.height * k)));
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return false;
    return true;
  };
  let drawn = 0;
  wrap.traverse(o => {
    if (!o.isMesh) return;
    const ms = [].concat(o.material).map(toStd);
    o.material = Array.isArray(o.material) ? ms : ms[0];
    for (const m of ms) for (const k of ['map', 'normalMap', 'emissiveMap', 'aoMap', 'alphaMap', 'roughnessMap', 'metalnessMap']) {
      const t = m[k];
      if (!t || !t.isTexture) continue;
      const img = t.image, w = img && (img.naturalWidth || img.width), h = img && (img.naturalHeight || img.height);
      if (!w || !h) { m[k] = null; continue; }   // a texture that never loaded (missing): left out
      if (!textures.has(t)) {
        const k2 = Math.min(1, maxTex / Math.max(w, h));
        if (k2 < 1) drawn++;
        t.image = canvasOf(img, Math.max(1, Math.round(w * k2)), Math.max(1, Math.round(h * k2)));
        t.format = opaque(t.image) ? T.RGBFormat : T.RGBAFormat;   // (the exporter writes RGB as JPEG, RGBA as PNG)
        textures.set(t, true);
      }
    }
  });
  if (drawn) notes.push(`${drawn} texture${drawn > 1 ? 's' : ''} drawn down to ${maxTex} px on the longer side`);

  // ---- corners welded: a vertex for every distinct corner (all its attributes the same), and an index
  if (weld) {
    let was = 0, now = 0;
    const done = new Set();
    wrap.traverse(o => {
      if (!o.isMesh || done.has(o.geometry)) return;
      done.add(o.geometry);
      const g = o.geometry;
      if (g.index) return;
      const attrs = Object.entries(g.attributes), morphs = Object.entries(g.morphAttributes || {}).flatMap(([n, list]) => list.map((a, i) => [n, i, a]));
      if ([...attrs.map(a => a[1]), ...morphs.map(m => m[2])].some(a => a.isInterleavedBufferAttribute)) return;
      const n = g.attributes.position.count, cols = [...attrs.map(a => a[1]), ...morphs.map(m => m[2])];
      const views = cols.map(a => (a.array instanceof Float32Array ? new Uint32Array(a.array.buffer, a.array.byteOffset, a.array.length) : a.array));
      const sizes = cols.map(a => a.itemSize);
      let cap = 1; while (cap < n * 2) cap <<= 1;
      const table = new Int32Array(cap).fill(-1), remap = new Uint32Array(n), first = [];
      for (let v = 0; v < n; v++) {
        let h = 2166136261;
        for (let c = 0; c < views.length; c++) { const a = views[c], s = sizes[c]; for (let j = v * s, e = j + s; j < e; j++) h = Math.imul(h ^ a[j], 16777619); }
        let slot = (h >>> 0) & (cap - 1);
        for (;;) {
          const u = table[slot];
          if (u < 0) { table[slot] = first.length; remap[v] = first.length; first.push(v); break; }
          const w = first[u];
          let same = true;
          for (let c = 0; c < views.length && same; c++) { const a = views[c], s = sizes[c]; for (let j = 0; j < s; j++) if (a[v * s + j] !== a[w * s + j]) { same = false; break; } }
          if (same) { remap[v] = u; break; }
          slot = (slot + 1) & (cap - 1);
        }
      }
      if (first.length === n) return;
      const pick = a => { const s = a.itemSize, arr = new a.array.constructor(first.length * s); for (let i = 0; i < first.length; i++) for (let j = 0; j < s; j++) arr[i * s + j] = a.array[first[i] * s + j]; return new T.BufferAttribute(arr, s, a.normalized); };
      for (const [name, a] of attrs) g.setAttribute(name, pick(a));
      for (const [name, i, a] of morphs) g.morphAttributes[name][i] = pick(a);
      g.setIndex(new T.BufferAttribute(first.length < 65536 ? new Uint16Array(remap) : remap, 1));   // (groups keep their ranges: the index is in the old order)
      g.boundingBox = null; g.boundingSphere = null;
      was += n; now += first.length;
    });
    if (was) notes.push(`corners welded: ${was.toLocaleString('en-GB')} vertices became ${now.toLocaleString('en-GB')}`);
  }

  // ---- animation tracks for things the file does not export (the exporter would drop the whole animation): left out
  const PATHS = { position: 1, quaternion: 1, scale: 1, morphTargetInfluences: 1 };
  const outClips = clips.map(c => {
    const keep = c.tracks.filter(tr => { const b = T.PropertyBinding.parseTrackName(tr.name); return PATHS[b.propertyName] && T.PropertyBinding.findNode(wrap, b.nodeName); });
    if (keep.length < c.tracks.length) notes.push(`${JSON.stringify(c.name)}: ${c.tracks.length - keep.length} of its ${c.tracks.length} tracks name nothing in the model (left out)`);
    return new T.AnimationClip(c.name, c.duration, keep, c.blendMode);
  });

  // where things are at a moment of an animation: every bone, and a sample of each skinned mesh's corners after skinning
  const poseOf = (root, clip, t) => {
    const saved = [];
    root.traverse(o => saved.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
    const mixer = new T.AnimationMixer(root);
    if (clip) { mixer.clipAction(clip).play(); mixer.setTime(t); }
    root.updateMatrixWorld(true);
    const bones = new Map(), skins = [];
    // (every named node: a bone the loader made a plain node, as glTF's loader does for one that is no skin's joint, too)
    root.traverse(o => {
      if (o.name && o !== root && !o.isMesh && !bones.has(o.name)) bones.set(o.name, new T.Vector3().setFromMatrixPosition(o.matrixWorld));
      if (o.isSkinnedMesh) {
        o.skeleton.update();
        const n = o.geometry.attributes.position.count, step = Math.max(1, Math.floor(n / 150)), pts = [];
        for (let i = 0; i < n; i += step) pts.push(o.boneTransform(i, new T.Vector3()).applyMatrix4(o.matrixWorld));
        skins.push({ n, name: o.name, pts });
      }
    });
    mixer.stopAllAction(); mixer.uncacheRoot(root);
    for (const [o, p, q, s] of saved) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); }   // (back at rest)
    root.updateMatrixWorld(true);
    return { bones, skins };
  };
  const restOf = root => poseOf(root, null, 0);
  const sampleTimes = c => [0, c.duration / 3, (2 * c.duration) / 3, c.duration * 0.999];
  // the original's poses, before the export (and the original back at rest after)
  const want = outClips.map(c => sampleTimes(c).map(t => poseOf(wrap, c, t)));
  const rest = restOf(wrap);

  // ---- export
  const glb = await new Promise((res, rej) => {
    try { new T.GLTFExporter().parse(wrap, res, { binary: true, animations: outClips, onlyVisible: false, truncateDrawRange: true, embedImages: true, maxTextureSize: maxTex }); } catch (err) { rej(err); }
  });

  // ---- load it back, timed as the original was, and compare
  const t1 = performance.now();
  const g = await new Promise((res, rej) => new T.GLTFLoader().parse(glb.slice(0), '', res, rej));
  const glbParse = performance.now() - t1;
  const back = g.scene;
  const after = { ...stats(back, g.animations), parse: glbParse };
  after.textures = after.textures.map(t => ({ ...t, kind: '' }));   // (what it holds them as: the GLB's own list, in the report)
  const tol = Math.max(0.002, 0.005 * Math.max(...before.size)), why = [];
  if (after.tris !== before.tris) why.push(`triangles ${before.tris} became ${after.tris}`);
  if (after.skinned !== before.skinned) why.push(`skinned meshes ${before.skinned} became ${after.skinned}`);
  if (after.bones < before.bones) why.push(`bones ${before.bones} became ${after.bones}`);
  if (before.size.some((v, i) => Math.abs(v - after.size[i]) > tol)) why.push(`size ${before.size.map(v => v.toFixed(3))} became ${after.size.map(v => v.toFixed(3))}`);
  for (const c of outClips) {
    const b = g.animations.find(x => x.name === c.name);
    if (!b) { why.push(`the animation ${JSON.stringify(c.name)} did not come through`); continue; }
    if (Math.abs(b.duration - c.duration) > 0.01) why.push(`${JSON.stringify(c.name)} lasts ${b.duration.toFixed(2)} s, not ${c.duration.toFixed(2)} s`);
  }
  // poses: the bones by name, each original skinned mesh against the one loaded back with as many corners
  let worst = 0, compared = 0, moved = 0;   // (moved: how far the animations take things from rest, so a match means something)
  const comparePose = (a, b, label) => {
    for (const [name, p] of a.bones) { const q = b.bones.get(name); if (q) { worst = Math.max(worst, p.distanceTo(q)); compared++; } }
    const used = new Set();
    for (const s of a.skins) {
      const m = b.skins.find((x, i) => !used.has(i) && x.n === s.n && (x.name === s.name || !s.name)) || b.skins.find((x, i) => !used.has(i) && x.n === s.n);
      if (!m) { why.push(`${label}: no skinned mesh like ${s.name || 'one'} came back`); continue; }
      used.add(b.skins.indexOf(m));
      s.pts.forEach((p, i) => { worst = Math.max(worst, p.distanceTo(m.pts[i])); compared++; });
    }
  };
  comparePose(rest, restOf(back), 'at rest');
  outClips.forEach((c, ci) => {
    const b = g.animations.find(x => x.name === c.name);
    for (const w of want[ci]) for (const [name, p] of w.bones) { const r = rest.bones.get(name); if (r) moved = Math.max(moved, p.distanceTo(r)); }
    if (b) sampleTimes(c).forEach((t, ti) => comparePose(want[ci][ti], poseOf(back, b, t), `${c.name} at ${t.toFixed(2)} s`));
  });
  if (worst > tol) why.push(`bones or skinned corners move differently: up to ${(worst * 100).toFixed(1)} cm apart (more than ${(tol * 100).toFixed(1)} cm)`);
  const check = !compared ? 'no bones or animations to compare: triangles and size' : `${compared.toLocaleString('en-GB')} bone and skinned-corner positions at rest and at ${outClips.length * 4} moments of ${outClips.length} animation${outClips.length === 1 ? '' : 's'}: at most ${(worst * 1000).toFixed(2)} mm apart` +
    (outClips.length ? ` (the animations move them up to ${(moved * 100).toFixed(0)} cm from rest)` : '');
  // how it looks: the original (with the materials it is exported with) and the GLB drawn from the same three places,
  // lit evenly (an ambient light alone shows a texture's own colours), colour textures as sRGB on both sides (glTF's rule;
  // the FBX loader leaves them linear), and the pictures compared, channel by channel
  let look = '', sheet = '';
  try {
    const W = 320, H = 200, r = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(W, H, false); r.outputEncoding = T.sRGBEncoding;
    wrap.traverse(o => { for (const m of [].concat(o.material || [])) for (const k of ['map', 'emissiveMap']) if (m[k]) { m[k].encoding = T.sRGBEncoding; m.needsUpdate = true; } });
    const box = new T.Box3().setFromObject(wrap), c = box.getCenter(new T.Vector3()), R = Math.max(1e-3, box.getSize(new T.Vector3()).length() / 2);
    const cam = new T.PerspectiveCamera(50, W / H, R / 200, R * 20), dirs = [[1, 0.7, 1.2], [-1.2, 0.5, -0.8], [0.15, 1.6, 0.25]];
    const draw = obj => dirs.map(d => {
      const sc = new T.Scene(), parent = obj.parent;
      sc.add(new T.AmbientLight(0xffffff, 1)); sc.add(obj);
      cam.position.copy(c).add(new T.Vector3(...d).normalize().multiplyScalar(R * 1.9)); cam.lookAt(c); cam.updateProjectionMatrix();
      r.render(sc, cam);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d').drawImage(r.domElement, 0, 0);
      sc.remove(obj); if (parent) parent.add(obj);
      return cv;
    });
    const A = draw(wrap), B = draw(back);
    let d = 0, n = 0, lit = 0;
    A.forEach((a, i) => {
      const x = a.getContext('2d').getImageData(0, 0, W, H).data, y = B[i].getContext('2d').getImageData(0, 0, W, H).data;
      for (let k = 0; k < x.length; k += 4) { for (let j = 0; j < 3; j++) d += Math.abs(x[k + j] - y[k + j]); n += 3; if (x[k] + x[k + 1] + x[k + 2] > 0) lit++; }
    });
    const mean = d / n, cover = lit / (n / 3);
    const S = document.createElement('canvas'); S.width = W * 3; S.height = H * 2;
    const sx = S.getContext('2d');
    A.forEach((a, i) => sx.drawImage(a, i * W, 0)); B.forEach((b, i) => sx.drawImage(b, i * W, H));
    sheet = S.toDataURL('image/png');
    look = `drawn from three sides, the GLB differs from the original by ${mean.toFixed(2)} of 255 on average (it covers ${(cover * 100).toFixed(0)} % of the pictures)`;
    if (mean > 12) why.push(`it looks different: ${mean.toFixed(1)} of 255 on average from the original`);
    if (cover < 0.005) why.push('nothing shows when it is drawn');
    r.dispose();
  } catch (err) { look = 'not drawn (' + err.message + ')'; }
  if (why.length) return { ok: false, why: why.join('; '), notes, before, after, check, look, sheet };
  await fetch('/out', { method: 'POST', body: glb });
  return { ok: true, notes, before, after, check, look, sheet };
}
