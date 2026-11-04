// node tools/studio/convert.mjs <model> [out.glb] [--max-texture 4096] [--no-weld] [--shots <dir>]
// A model made lighter for a headset (tools/studio/SPEC.md, "GLB first, and converting"), in headless Chromium with the
// studio's own converter (tools/studio/engine/convert.js, the same module the studio's Convert to GLB and Upload pane
// use) and three.js r128's own loaders and exporter (tools/studio/vendor/, and three.min.js from the repository's root).
// It reads FBX, glTF (with its .bin and textures), GLB, OBJ (with its MTL and textures), PLY (vertex colours kept) and
// STL; gives the model the studio's guess of its units and up axis (an FBX's GlobalSettings, read from the file's bytes,
// since the loader ignores them; OBJ, PLY and STL say none: metres, centimetres or millimetres, whichever makes it 5 cm
// to 60 m); draws its textures down to --max-texture px on their longer side (4,096 by default); welds its triangles'
// shared corners into an index (an FBX's loader repeats every corner: three times the vertices; --no-weld keeps them);
// draws an FBX material of opacity 0 (3ds Max's habit) solid; and writes one binary glTF with GLTFExporter (animations
// and skins kept, opaque textures as JPEG, the rest as PNG). The guess goes into the file (its root node's scale and
// turn), so the GLB is in metres and Y up, as glTF is, and asset.extras.studio records it ({ from: the original's file
// name, s, q, at, scan: true when it has no normals, to be shown as scanned }). Then the GLB is loaded back and compared
// with the original: triangles, size, textures, animations, bones, and where the bones and a sample of skinned corners
// are at a few moments of every animation, and both drawn from three sides (lit evenly, so the textures show as they
// are) and the pictures compared (--shots <dir> keeps them). When something did not come through (an animation dropped,
// a skin that moves differently, a texture that looks different), nothing is written and it says why (exit 1). Files
// the model names but does not hold are looked for beside it (by file name, in any case, up to 4 folders down), as the
// studio does.
// Needs Playwright with a Chromium build (as tools/smoke.mjs; PLAYWRIGHT_MODULE and CHROMIUM_PATH as there).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sceneFiles } from '../../relay/scenes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const EXTS = ['.fbx', '.glb', '.gltf', '.obj', '.ply', '.stl'];
const USAGE = 'usage: node tools/studio/convert.mjs <in.fbx|.glb|.gltf|.obj|.ply|.stl> [out.glb] [--max-texture 4096] [--no-weld] [--shots <dir>]';
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
if (!EXTS.includes(ext) || !fs.existsSync(input)) { console.log(`${input}: not there, or not ${EXTS.join(', ')}\n${USAGE}`); process.exit(1); }
const base = path.basename(input, path.extname(input));
const output = path.resolve(pos[1] || path.join(path.dirname(input), ext === '.glb' ? `${base}-${maxTex}.glb` : `${base}.glb`));
if (output === input) { console.log('the output would overwrite the input: give another name'); process.exit(1); }
if (path.extname(output).toLowerCase() !== '.glb') { console.log('the output is a binary glTF: name it .glb'); process.exit(1); }

const bytes = fs.readFileSync(input);
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
  const LIBS = ['fflate.min.js', 'NURBSUtils.js', 'NURBSCurve.js', 'TGALoader.js', 'FBXLoader.js', 'GLTFLoader.js', 'OBJLoader.js', 'MTLLoader.js', 'PLYLoader.js', 'STLLoader.js', 'GLTFExporter.js', 'SkeletonUtils.js'];
  let glb = null;
  await page.route('http://convert.local/**', async route => {
    const u = new URL(route.request().url()), p = decodeURIComponent(u.pathname);
    if (p === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>convert</title>' +
      ['three.min.js', ...LIBS, 'convert.js'].map(f => `<script src="/lib/${f}"></script>`).join('') });
    if (p === '/lib/three.min.js') return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(REPO, 'three.min.js')) });
    if (p.startsWith('/lib/') && LIBS.includes(p.slice(5))) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(HERE, 'vendor', p.slice(5))) });
    if (p === '/lib/convert.js') return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(HERE, 'engine', 'convert.js')) });
    if (p === '/in/' + path.basename(input)) return route.fulfill({ body: bytes });
    if (p.startsWith('/in/') && listing.includes(p.slice(4))) return route.fulfill({ body: fs.readFileSync(path.join(path.dirname(input), ...p.slice(4).split('/'))) });
    if (p === '/out' && route.request().method() === 'POST') { glb = route.request().postDataBuffer(); return route.fulfill({ body: 'ok' }); }
    return route.fulfill({ status: 404, body: 'not found' });
  });
  await page.goto('http://convert.local/');
  try { out = await page.evaluate(convertInPage, { file: path.basename(input), ext, listing, maxTex, weld }); } catch (err) {
    console.log(`${path.basename(input)}: could not be read or written (${String(err.message).split('\n')[0].replace(/^page\.evaluate: /, '')})`);
    if (logs.length) console.log(logs.slice(0, 8).map(t => '  ' + t.slice(0, 200)).join('\n'));
    process.exitCode = 1;
  }
  if (!out) throw new Error('not converted');
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
} catch (err) {
  if (out) throw err;
  if (err.message !== 'not converted') console.log('could not convert: ' + String(err.message).split('\n')[0]);
} finally { await browser.close(); }
if (!out) process.exit(1);

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
console.log(`${path.basename(input)} (${out.format})`);
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
  if (out.record) row('its record', '', `asset.extras.studio: ${JSON.stringify(out.record)}`);
  row('with its textures', `${(A.ready / 1000).toFixed(2)} s`, B.parse !== undefined ? `${(B.parse / 1000).toFixed(2)} s` : undefined);
  if (out.check) console.log(`\n  checked: ${out.check}`);
  if (out.look) console.log(`  looks: ${out.look}${out.sheetFile ? ` (the pictures: ${out.sheetFile}; the original above, the GLB below)` : ''}`);
}
// (the missing textures' 404s are said above, as missing textures)
const warns = [...new Set(out.logs.filter(t => !/Use MeshStandardMaterial|Creating normalized normal|bigger than maxTextureSize|Failed to load resource: .*404/.test(t)))].slice(0, 12);
if (warns.length) console.log('\n  the loaders said:\n' + warns.map(t => '    ' + t.slice(0, 200)).join('\n'));
if (!out.ok) { console.log(`\nNOT WRITTEN: ${out.why}`); process.exit(1); }
console.log(`\nwrote ${output} (${mb(out.glbBytes)})`);
console.log('(times in headless Chromium on this machine, drawing in software: a headset\'s own are untested)');


// ---- in the page: the studio's converter (engine/convert.js) loads it, gives it the guess, lightens and exports it, loads
// it back and compares; the file names it gives are found beside it (by its path, else by name, case aside)
async function convertInPage({ file, ext, listing, maxTex, weld }) {
  const T = THREE, have = new Set(listing), lower = new Map(listing.map(p => [p.slice(p.lastIndexOf('/') + 1).toLowerCase(), p]));
  const enc = p => '/in/' + p.split('/').map(encodeURIComponent).join('/');
  const url = u => {
    let p = '';
    try { p = decodeURIComponent(new URL(u, location.href).pathname); } catch (e) { p = u; }
    if (p.startsWith('/in/') && have.has(p.slice(4))) return u;
    let n = u.split(/[?#]/)[0].split(/[\\/]/).pop();
    try { n = decodeURIComponent(n); } catch (e) { /* as it is */ }
    const hit = lower.get(n.toLowerCase());
    return hit ? enc(hit) : null;
  };
  const C = makeConverter(T, { renderer: (w, h) => { const r = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(w, h, false); return r; } });
  const data = await (await fetch(enc(file))).arrayBuffer();
  const t0 = performance.now();
  const m = await C.load({ ext: ext.slice(1), data, base: '/in/', url, name: file.replace(/\.[^.]+$/, '') });
  const ready = performance.now() - t0;
  const r = await C.toGLB(m, { name: file.replace(/\.[^.]+$/, ''), maxTex, weld, from: file, look: true });
  r.before.parse = r.before.ready = ready;
  const out = { ok: r.ok, why: r.why, notes: r.notes, before: r.before, after: r.after, check: r.check, look: r.look, sheet: r.sheet, record: r.record, format: m.guess.format || ext };
  if (r.ok) await fetch('/out', { method: 'POST', body: r.glb });
  return out;
}
