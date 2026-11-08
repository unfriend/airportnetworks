// Makes the studio's test scene, tools/studio/test/scenes/test/ (committed with what it writes, under 200 KB together):
//   box.glb     a 0.5 m box with a small texture inside and two clips (Spin, Bob): glTF, metres, Y up
//   figure.fbx  an ASCII FBX 7.4: a 40 x 30 x 170 cm block standing along Z (Z up, centimetres: both guesses show), its
//               material's colour texture named by an author's path (C:\Users\...\figure.png, found by its base name)
//               and a specular texture that is not there (figure_spec.png: its card says so), a take that turns it, and
//               its material's Opacity 0 (as 3ds Max writes it: the studio draws it solid and says so)
//   figure.png  the figure's texture
//   tone.wav    a short tone (0.6 s, 440 Hz)
//   sounds/long.wav  a 25 s chord (8 kHz, 8-bit mono: small), longer than 20 s, so the studio streams it
//   originals/crate.obj, crate.mtl, crate.png  an OBJ in centimetres (80 units across: no units in the file, so taken
//               as centimetres, 0.8 m) with its MTL naming its texture: an original to place, and to drop on the Upload
//               pane in the smoke test (with figure.fbx and figure.png, tone.wav and sounds/long.wav)
//   layout.json one object of each model, a cube showing the figure and the sound and hiding the box, and the sound
// and the second test scene, tools/studio/test/scenes/textures/ (no layout: the tests place what they need), for the
// textures a model names and the scene lacks or holds in a kind the browser cannot show (tools/studio/SPEC.md, "Textures:
// found, added, converted"; the pictures from tools/studio/test/pictures.mjs, which tools/studio/test-images.mjs reads back):
//   crate.obj + crate.mtl   its colour tex/wood.tif (a TIFF, LZW: the ladder's 'path'), its bump crate_height.png (made a
//               normal map when converted)
//   panel.fbx   an ASCII FBX naming C:\art\Panel_Albedo.PSD (panel_albedo.psd: 'name'; a PSD, which three.js's loader
//               never asks for: renamed in its bytes) and panel_nrm.dds (BC5, a normal map: 'path')
//   brick.obj + brick.mtl   brick.tga, not there: brick.tif ('ext'; PackBits, with alpha)
//   stone.obj + stone.mtl   stone_diffuse.jpg, not there: Stone-BaseColor.dds ('similar'; DXT1)
//   rust.obj + rust.mtl     rust_old.png, not there and nothing like it (the card's Use and Choose; the Upload pane's
//               'only' with paint.png)
//   broken.obj + broken.mtl broken.tif, a TIFF compressed with JPEG (refused, with a sentence)
//   plain.obj   texture coordinates and no material (Add a texture)
//   tex/rough.tif (16-bit grey, Deflate), tex/glass.dds (DXT5, see-through), paint.png: pictures to pick
// and the third, tools/studio/test/scenes/rig/, for sounds that follow a model or a bone (tools/studio/SPEC.md, "Sounds
// that follow a model"):
//   dancer.glb  a small skinned figure (1.87 m, two materials, about 13 KB), its bones named in mixed conventions so the
//               lenient match is used (Mixamo's mixamorig:Hips, mixamorig:Spine2, mixamorig:Neck and mixamorig:Head,
//               3ds Max's Bip01 L Hand and Bip01 R Hand, Unreal's foot_l and foot_r: three.js's loader tidies them to
//               mixamorigHead, Bip01_L_Hand), and a 2 s clip, Dance, that sways her hips, bends her spine, turns her head
//               and lifts her hands (the head moves through about 0.7 m)
//   box.glb, figure.fbx, figure.png  as in the test scene (a moving part, Bob's box; a Z-up model in centimetres, whose
//               GLB has a turn baked in)
//   voice.wav   a short sung vowel (0.8 s, 8 kHz, 8-bit)
//   layout.json the dancer, the box, a cube (Curtain) that hides the dancer, and Voice at her mouth, following her head
//               by the name an FBX would give it (mixamorig:Head)
// and the fourth, tools/studio/test/scenes/cuts/, for cut-outs (tools/studio/SPEC.md, "Cut-outs"):
//   wall.obj + wall.mtl  a wall 3 m wide, 2.4 m high and 20 cm thick (an OBJ in metres, lit, a warm grey)
//   dancer.glb, box.glb, figure.fbx, figure.png  as in the rig scene (a skinned figure; one file placed twice; a Z-up
//               model in centimetres, whose GLB has a turn and a scale baked in)
//   layout.json the wall with Door, a cut-out a cube (Doorway) in front of it shows (the wall opens as you walk up),
//               two boxes of one file, the first with a Hole in a corner, the dancer and the figure
// and the fifth, tools/studio/test/scenes/puppet/, for the trackers' solver (tools/studio/engine/ik.js, checked by
// tools/studio/test-ik.mjs; tools/trackers/SPEC.md, "The solver (ik.js)"):
//   rig.glb     our own humanoid with Mixamo's bone names (mixamorig:Hips ... mixamorig:RightToe_End: 25 bones in a T-pose,
//               facing +z, its hips 1 m up), each bone's frame as Mixamo's (y along the bone), under an Armature scaled
//               0.01 (the bones in centimetres, as Mixamo's files are); an eight- or twelve-sided tube per bone skinned to
//               it, blended half and half at each joint (about 1,600 triangles, two materials), and a walk in place,
//               Walk (1.1 s, 12 keys: the hips sway, bob and turn, the spine counter-turns, the head stays level, the
//               legs and arms swing, the elbows bend only about their hinge, forward, and the knees only about theirs,
//               back). Never Mixamo's own files
//   layout.json the rig, walking
// and then index.json and files.json, by tools/studio/scan.mjs (node tools/studio/scan.mjs tools/studio/test/scenes --check
// says whether they are current).
// usage (from the repository root): node tools/studio/test/make.mjs
//        node tools/studio/test/make.mjs --index <folder>   only index.json and files.json (scan.mjs), for any folder of scenes
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execFileSync } from 'child_process';
import { layoutText } from '../../../relay/scenes.mjs';
import { scenePictures } from './pictures.mjs';
const here = path.dirname(new URL(import.meta.url).pathname);

// ---- index.json and files.json: what tools/studio/scan.mjs writes (the relay's own listing rules), run after the files
const scan = folder => execFileSync(process.execPath, [path.join(here, '../scan.mjs'), folder], { stdio: 'inherit' });
const ai = process.argv.indexOf('--index');
if (ai > 0) { scan(path.resolve(process.argv[ai + 1] || '.')); process.exit(0); }

const out = path.join(here, 'scenes/test');
fs.mkdirSync(out, { recursive: true });

// ---- a PNG (RGBA, from a function of x and y)
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 4 + 1) + 1 + x * 4); }
  const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4, 'ascii'); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- box.glb
function glb() {
  const tex = png(16, 16, (x, y) => ((x >> 2) + (y >> 2)) & 1 ? [255, 180, 59, 255] : [70, 217, 255, 255]);
  const h = 0.25, P = [], N = [], U = [], I = [];
  // six faces, each four corners with its normal and the texture across it
  const faces = [[[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
  for (const [n, u, v] of faces) {
    const b = P.length / 3;
    for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      P.push(...[0, 1, 2].map(i => (n[i] + u[i] * a + v[i] * c) * h)); N.push(...n); U.push((a + 1) / 2, 1 - (c + 1) / 2);
    }
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const ts = [0, 2 / 3, 4 / 3, 2], rot = ts.flatMap((t, i) => { const a = i * Math.PI * 2 / 3 / 2; return [0, Math.sin(a), 0, Math.cos(a)]; });
  const tb = [0, 0.5, 1], tr = [0, 0, 0, 0, 0.3, 0, 0, 0, 0];
  const parts = [], views = [], acc = [];
  let off = 0;
  const add = (buf, target) => { const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; } views.push(Object.assign({ buffer: 0, byteOffset: off, byteLength: buf.length }, target ? { target } : {})); parts.push(buf); off += buf.length; return views.length - 1; };
  const f32 = a => Buffer.from(new Float32Array(a).buffer), u16 = a => Buffer.from(new Uint16Array(a).buffer);
  const mm = (a, n) => [0, 1, 2, 3].slice(0, n).map(i => a.filter((_, k) => k % n === i)).map(c => [Math.min(...c), Math.max(...c)]);
  const accessor = (a, type, n, target, extra) => { const v = add(f32(a), target), m = mm(a, n); acc.push(Object.assign({ bufferView: v, componentType: 5126, count: a.length / n, type, min: m.map(x => x[0]), max: m.map(x => x[1]) }, extra || {})); return acc.length - 1; };
  const aP = accessor(P, 'VEC3', 3, 34962), aN = accessor(N, 'VEC3', 3, 34962), aU = accessor(U, 'VEC2', 2, 34962);
  acc.push({ bufferView: add(u16(I), 34963), componentType: 5123, count: I.length, type: 'SCALAR' }); const aI = acc.length - 1;
  const aT1 = accessor(ts, 'SCALAR', 1), aR = accessor(rot, 'VEC4', 4), aT2 = accessor(tb, 'SCALAR', 1), aTr = accessor(tr, 'VEC3', 3);
  const vImg = add(tex);
  const bin = Buffer.concat(parts), json = {
    asset: { version: '2.0', generator: 'tools/studio/test/make.mjs' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ name: 'box', mesh: 0 }],
    meshes: [{ name: 'box', primitives: [{ attributes: { POSITION: aP, NORMAL: aN, TEXCOORD_0: aU }, indices: aI, material: 0 }] }],
    materials: [{ name: 'crate', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0.1, roughnessFactor: 0.6 } }],
    textures: [{ source: 0, sampler: 0 }], samplers: [{ magFilter: 9728, minFilter: 9728 }], images: [{ bufferView: vImg, mimeType: 'image/png', name: 'crate' }],
    accessors: acc, bufferViews: views, buffers: [{ byteLength: bin.length + ((4 - (bin.length % 4)) % 4) }],
    animations: [
      { name: 'Spin', channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }], samplers: [{ input: aT1, output: aR, interpolation: 'LINEAR' }] },
      { name: 'Bob', channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }], samplers: [{ input: aT2, output: aTr, interpolation: 'LINEAR' }] },
    ],
  };
  let js = Buffer.from(JSON.stringify(json));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const bb = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const head = Buffer.alloc(12); head.write('glTF', 0, 'ascii'); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bb.length, 8);
  const ch = (t, d) => { const b = Buffer.alloc(8); b.writeUInt32LE(d.length, 0); b.write(t, 4, 'ascii'); return Buffer.concat([b, d]); };
  return Buffer.concat([head, ch('JSON', js), ch('BIN\0', bb)]);
}

// ---- dancer.glb: a skinned figure, each part a box bound wholly to one bone, its bones named in mixed conventions
function dancerGlb() {
  // bones: [name, parent (an index here), translation from the parent at rest]
  const B = [['mixamorig:Hips', -1, [0, 1, 0]], ['mixamorig:Spine2', 0, [0, 0.3, 0]], ['mixamorig:Neck', 1, [0, 0.25, 0]], ['mixamorig:Head', 2, [0, 0.1, 0]],
    ['Bip01 L Hand', 1, [0.45, 0.15, 0]], ['Bip01 R Hand', 1, [-0.45, 0.15, 0]], ['foot_l', 0, [0.12, -0.9, 0]], ['foot_r', 0, [-0.12, -0.9, 0]]];
  const W = []; B.forEach(([, par, t], i) => { W[i] = par < 0 ? t.slice() : W[par].map((v, k) => v + t[k]); });   // (at rest, where each stands)
  // the parts: [bone, middle, half sizes, primitive (0 the body, 1 the head)]
  const P = [[0, [0, 1.1, 0], [0.16, 0.12, 0.1], 0], [1, [0, 1.4, 0], [0.19, 0.15, 0.11], 0], [2, [0, 1.6, 0], [0.05, 0.05, 0.05], 0], [3, [0, 1.76, 0], [0.1, 0.12, 0.11], 1],
    [3, [0, 1.75, 0.12], [0.02, 0.025, 0.03], 1], [4, [0.27, 1.45, 0], [0.2, 0.04, 0.04], 0], [5, [-0.27, 1.45, 0], [0.2, 0.04, 0.04], 0], [6, [0.12, 0.55, 0], [0.06, 0.45, 0.06], 0], [7, [-0.12, 0.55, 0], [0.06, 0.45, 0.06], 0]];
  const faces = [[[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
  const prims = [0, 1].map(() => ({ P: [], N: [], J: [], Wt: [], I: [] }));
  for (const [j, c, h, pi] of P) {
    const g = prims[pi];
    for (const [n, u, v] of faces) {
      const b = g.P.length / 3;
      for (const [a, cc] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.P.push(...[0, 1, 2].map(i => c[i] + (n[i] + u[i] * a + v[i] * cc) * h[i])); g.N.push(...n); g.J.push(j, 0, 0, 0); g.Wt.push(1, 0, 0, 0); }
      g.I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  const parts = [], views = [], acc = [];
  let off = 0;
  const add = (buf, target) => { const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; } views.push(Object.assign({ buffer: 0, byteOffset: off, byteLength: buf.length }, target ? { target } : {})); parts.push(buf); off += buf.length; return views.length - 1; };
  const f32 = a => Buffer.from(new Float32Array(a).buffer), u16 = a => Buffer.from(new Uint16Array(a).buffer), u8 = a => Buffer.from(new Uint8Array(a).buffer);
  const mm = (a, n) => [0, 1, 2, 3].slice(0, n).map(i => a.filter((_, k) => k % n === i)).map(c => [Math.min(...c), Math.max(...c)]);
  const accessor = (a, type, n, target, bounds) => { const v = add(f32(a), target); acc.push(Object.assign({ bufferView: v, componentType: 5126, count: a.length / n, type }, bounds ? { min: mm(a, n).map(x => x[0]), max: mm(a, n).map(x => x[1]) } : {})); return acc.length - 1; };
  const primitives = prims.map((g, k) => {
    const aP = accessor(g.P, 'VEC3', 3, 34962, true), aN = accessor(g.N, 'VEC3', 3, 34962), aW = accessor(g.Wt, 'VEC4', 4, 34962);
    acc.push({ bufferView: add(u8(g.J), 34962), componentType: 5121, count: g.J.length / 4, type: 'VEC4' }); const aJ = acc.length - 1;
    acc.push({ bufferView: add(u16(g.I), 34963), componentType: 5123, count: g.I.length, type: 'SCALAR' }); const aI = acc.length - 1;
    return { attributes: { POSITION: aP, NORMAL: aN, JOINTS_0: aJ, WEIGHTS_0: aW }, indices: aI, material: k };
  });
  // each bone's inverse bind matrix (at rest the bones are not turned: a translation back from where it stands)
  const aIBM = accessor(W.flatMap(w => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -w[0], -w[1], -w[2], 1]), 'MAT4', 16);
  // Dance (2 s): the hips sway and rise, the spine bends about z, the head turns about y, the hands rise in turn
  const T = [0, 0.5, 1, 1.5, 2], aT = accessor(T, 'SCALAR', 1, null, true);
  const qz = a => [0, 0, Math.sin(a / 2), Math.cos(a / 2)], qy = a => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
  const tracks = [
    [0, 'translation', [[0, 1, 0], [0.45, 1, 0.2], [0, 1.06, 0], [-0.45, 1, -0.2], [0, 1, 0]]],
    [1, 'rotation', [0, 0.5, 0, -0.5, 0].map(qz)],
    [3, 'rotation', [0, 0.9, 0, -0.9, 0].map(qy)],
    [4, 'translation', [[0.45, 0.15, 0], [0.4, 0.45, 0.15], [0.45, 0.15, 0], [0.4, 0.45, 0.15], [0.45, 0.15, 0]]],
    [5, 'translation', [[-0.45, 0.15, 0], [-0.4, 0.15, 0], [-0.4, 0.45, 0.15], [-0.4, 0.15, 0], [-0.45, 0.15, 0]]],
  ];
  const samplers = [], channels = [];
  for (const [b, path, vals] of tracks) {
    samplers.push({ input: aT, output: accessor(vals.flat(), path === 'rotation' ? 'VEC4' : 'VEC3', path === 'rotation' ? 4 : 3), interpolation: 'LINEAR' });
    channels.push({ sampler: samplers.length - 1, target: { node: 2 + b, path } });
  }
  const bin = Buffer.concat(parts), json = {
    asset: { version: '2.0', generator: 'tools/studio/test/make.mjs' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ name: 'dancer', children: [1, 2] }, { name: 'body', mesh: 0, skin: 0 }, ...B.map(([name, par, t], i) => Object.assign({ name, translation: t }, B.some(x => x[1] === i) ? { children: B.map((x, k) => (x[1] === i ? 2 + k : -1)).filter(k => k >= 0) } : {}))],
    meshes: [{ name: 'body', primitives }],
    skins: [{ joints: B.map((_, i) => 2 + i), inverseBindMatrices: aIBM, skeleton: 2 }],
    materials: [{ name: 'dress', pbrMetallicRoughness: { baseColorFactor: [0.86, 0.45, 0.7, 1], metallicFactor: 0, roughnessFactor: 0.7 } }, { name: 'face', pbrMetallicRoughness: { baseColorFactor: [0.95, 0.78, 0.62, 1], metallicFactor: 0, roughnessFactor: 0.6 } }],
    accessors: acc, bufferViews: views, buffers: [{ byteLength: bin.length + ((4 - (bin.length % 4)) % 4) }],
    animations: [{ name: 'Dance', channels, samplers }],
  };
  let js = Buffer.from(JSON.stringify(json));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const bb = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const head = Buffer.alloc(12); head.write('glTF', 0, 'ascii'); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bb.length, 8);
  const ch = (t, d) => { const b = Buffer.alloc(8); b.writeUInt32LE(d.length, 0); b.write(t, 4, 'ascii'); return Buffer.concat([b, d]); };
  return Buffer.concat([head, ch('JSON', js), ch('BIN\0', bb)]);
}
// ---- voice.wav (8-bit unsigned mono, 8,000 Hz, 0.8 s: a sung "ah", its pitch rising a little)
function voiceWav() {
  const rate = 8000, n = Math.round(rate * 0.8), b = Buffer.alloc(44 + n);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(36 + n, 4); b.write('WAVE', 8, 'ascii'); b.write('fmt ', 12, 'ascii');
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34);
  b.write('data', 36, 'ascii'); b.writeUInt32LE(n, 40);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate, env = Math.min(1, i / 400, (n - i) / 600);
    ph += 2 * Math.PI * (220 + 40 * t) / rate;
    // (harmonics weighted towards an "ah": strong near 700 and 1,200 Hz)
    let v = 0;
    for (let k = 1; k <= 12; k++) { const f = k * (220 + 40 * t); v += Math.sin(k * ph) * (Math.exp(-(((f - 700) / 250) ** 2)) + 0.6 * Math.exp(-(((f - 1200) / 300) ** 2)) + 0.15 / k); }
    b[44 + i] = 128 + Math.round(Math.max(-1, Math.min(1, v / 2.2)) * env * 0.6 * 127);
  }
  return b;
}

// ---- figure.fbx (ASCII, as three.js's FBXLoader reads it: tabs by depth, arrays on their own lines)
function fbx() {
  const W = 40, D = 30, H = 170, V = [], PI = [], NR = [], UV = [], UI = [];
  const c = [[-W / 2, -D / 2, 0], [W / 2, -D / 2, 0], [W / 2, D / 2, 0], [-W / 2, D / 2, 0], [-W / 2, -D / 2, H], [W / 2, -D / 2, H], [W / 2, D / 2, H], [-W / 2, D / 2, H]];
  for (const p of c) V.push(...p);
  // quads (Z up: 0-3 the foot, 4-7 the top), each with its normal
  const quads = [[[0, 3, 2, 1], [0, 0, -1]], [[4, 5, 6, 7], [0, 0, 1]], [[0, 1, 5, 4], [0, -1, 0]], [[1, 2, 6, 5], [1, 0, 0]], [[2, 3, 7, 6], [0, 1, 0]], [[3, 0, 4, 7], [-1, 0, 0]]];
  UV.push(0, 0, 1, 0, 1, 1, 0, 1);
  for (const [q, n] of quads) { q.forEach((v, k) => { PI.push(k === 3 ? -v - 1 : v); NR.push(...n); UI.push(k); }); }
  const T = 46186158000, arr = (name, a, ind) => `${ind}${name}: *${a.length} {\n${ind}\ta: ${a.join(',')}\n${ind}}`;
  const t = '\t', tt = '\t\t', ttt = '\t\t\t';
  return `; FBX 7.4.0 project file
; The studio's test figure: Z up, in centimetres
FBXHeaderExtension:  {
${t}FBXHeaderVersion: 1003
${t}FBXVersion: 7400
${t}Creator: "tools/studio/test/make.mjs"
}
GlobalSettings:  {
${t}Version: 1000
${t}Properties70:  {
${tt}P: "UpAxis", "int", "Integer", "",2
${tt}P: "UpAxisSign", "int", "Integer", "",1
${tt}P: "FrontAxis", "int", "Integer", "",1
${tt}P: "FrontAxisSign", "int", "Integer", "",-1
${tt}P: "CoordAxis", "int", "Integer", "",0
${tt}P: "CoordAxisSign", "int", "Integer", "",1
${tt}P: "OriginalUnitScaleFactor", "double", "Number", "",1
${tt}P: "UnitScaleFactor", "double", "Number", "",1
${t}}
}
Objects:  {
${t}Geometry: 1001, "Geometry::figure", "Mesh" {
${arr('Vertices', V, tt)}
${arr('PolygonVertexIndex', PI, tt)}
${tt}GeometryVersion: 124
${tt}LayerElementNormal: 0 {
${ttt}Version: 101
${ttt}Name: ""
${ttt}MappingInformationType: "ByPolygonVertex"
${ttt}ReferenceInformationType: "Direct"
${arr('Normals', NR, ttt)}
${tt}}
${tt}LayerElementUV: 0 {
${ttt}Version: 101
${ttt}Name: "map1"
${ttt}MappingInformationType: "ByPolygonVertex"
${ttt}ReferenceInformationType: "IndexToDirect"
${arr('UV', UV, ttt)}
${arr('UVIndex', UI, ttt)}
${tt}}
${tt}LayerElementMaterial: 0 {
${ttt}Version: 101
${ttt}Name: ""
${ttt}MappingInformationType: "AllSame"
${ttt}ReferenceInformationType: "IndexToDirect"
${arr('Materials', [0], ttt)}
${tt}}
${tt}Layer: 0 {
${ttt}Version: 100
${ttt}LayerElement:  {
${ttt}${t}Type: "LayerElementNormal"
${ttt}${t}TypedIndex: 0
${ttt}}
${ttt}LayerElement:  {
${ttt}${t}Type: "LayerElementMaterial"
${ttt}${t}TypedIndex: 0
${ttt}}
${ttt}LayerElement:  {
${ttt}${t}Type: "LayerElementUV"
${ttt}${t}TypedIndex: 0
${ttt}}
${tt}}
${t}}
${t}Model: 2001, "Model::figure", "Mesh" {
${tt}Version: 232
${tt}Properties70:  {
${ttt}P: "Lcl Translation", "Lcl Translation", "", "A",0,0,0
${ttt}P: "Lcl Rotation", "Lcl Rotation", "", "A",0,0,0
${ttt}P: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1
${tt}}
${tt}Shading: T
${tt}Culling: "CullingOff"
${t}}
${t}Material: 3001, "Material::figure", "" {
${tt}Version: 102
${tt}ShadingModel: "phong"
${tt}MultiLayer: 0
${tt}Properties70:  {
${ttt}P: "DiffuseColor", "Color", "", "A",0.8,0.8,0.8
${ttt}P: "SpecularColor", "Color", "", "A",0.2,0.2,0.2
${ttt}P: "Shininess", "double", "Number", "",20
${ttt}P: "Opacity", "double", "Number", "",0
${tt}}
${t}}
${t}Texture: 4001, "Texture::figure", "" {
${tt}Type: "TextureVideoClip"
${tt}Version: 202
${tt}TextureName: "Texture::figure"
${tt}FileName: "C:\\Users\\artist\\Desktop\\figure.png"
${tt}RelativeFilename: "C:\\Users\\artist\\Desktop\\figure.png"
${t}}
${t}Texture: 4002, "Texture::figure_spec", "" {
${tt}Type: "TextureVideoClip"
${tt}Version: 202
${tt}TextureName: "Texture::figure_spec"
${tt}FileName: "textures/figure_spec.png"
${tt}RelativeFilename: "textures/figure_spec.png"
${t}}
${t}Video: 5001, "Video::figure", "Clip" {
${tt}Type: "Clip"
${tt}FileName: "C:\\Users\\artist\\Desktop\\figure.png"
${tt}RelativeFilename: "C:\\Users\\artist\\Desktop\\figure.png"
${t}}
${t}Video: 5002, "Video::figure_spec", "Clip" {
${tt}Type: "Clip"
${tt}FileName: "textures/figure_spec.png"
${tt}RelativeFilename: "textures/figure_spec.png"
${t}}
${t}AnimationStack: 8001, "AnimStack::Take 001", "" {
${tt}Properties70:  {
${ttt}P: "LocalStop", "KTime", "Time", "",${2 * T}
${ttt}P: "ReferenceStop", "KTime", "Time", "",${2 * T}
${tt}}
${t}}
${t}AnimationLayer: 7001, "AnimLayer::BaseLayer", "" {
${t}}
${t}AnimationCurveNode: 6001, "AnimCurveNode::R", "" {
${tt}Properties70:  {
${ttt}P: "d|X", "Number", "", "A",0
${ttt}P: "d|Y", "Number", "", "A",0
${ttt}P: "d|Z", "Number", "", "A",0
${tt}}
${t}}
${t}AnimationCurve: 6101, "AnimCurve::", "" {
${tt}Default: 0
${tt}KeyVer: 4009
${arr('KeyTime', [0, T, 2 * T], tt)}
${arr('KeyValueFloat', [0, 180, 360], tt)}
${t}}
}
Connections:  {
${t}C: "OO",2001,0
${t}C: "OO",1001,2001
${t}C: "OO",3001,2001
${t}C: "OP",4001,3001, "DiffuseColor"
${t}C: "OP",4002,3001, "SpecularColor"
${t}C: "OO",5001,4001
${t}C: "OO",5002,4002
${t}C: "OO",7001,8001
${t}C: "OO",6001,7001
${t}C: "OP",6001,2001, "Lcl Rotation"
${t}C: "OP",6101,6001, "d|Z"
}
`;
}

// ---- tone.wav (16-bit mono, 22,050 Hz, 0.6 s of 440 Hz with short fades)
function wav() {
  const rate = 22050, n = Math.round(rate * 0.6), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8, 'ascii'); b.write('fmt ', 12, 'ascii');
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii'); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) { const env = Math.min(1, i / 400, (n - i) / 400); b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / rate) * 0.4 * env * 32767), 44 + i * 2); }
  return b;
}

// ---- sounds/long.wav (8-bit unsigned mono, 8,000 Hz, 25 s: a soft chord that swells and fades every 5 s)
function longWav() {
  const rate = 8000, n = rate * 25, b = Buffer.alloc(44 + n);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(36 + n, 4); b.write('WAVE', 8, 'ascii'); b.write('fmt ', 12, 'ascii');
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34);
  b.write('data', 36, 'ascii'); b.writeUInt32LE(n, 40);
  for (let i = 0; i < n; i++) {
    const t = i / rate, env = Math.min(1, i / 800, (n - i) / 800) * (0.55 + 0.45 * Math.sin(2 * Math.PI * t / 5));
    const v = (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 277.2 * t) * 0.7 + Math.sin(2 * Math.PI * 329.6 * t) * 0.5) / 2.2;
    b[44 + i] = 128 + Math.round(v * env * 0.5 * 127);
  }
  return b;
}
// ---- originals/crate.obj, crate.mtl (an 80 cm crate: OBJ gives no units), crate.png
function crateObj() {
  const h = 40, c = [[-h, 0, -h], [h, 0, -h], [h, 2 * h, -h], [-h, 2 * h, -h], [-h, 0, h], [h, 0, h], [h, 2 * h, h], [-h, 2 * h, h]];
  const faces = [[[4, 5, 6, 7], 1], [[1, 0, 3, 2], 2], [[5, 1, 2, 6], 3], [[0, 4, 7, 3], 4], [[7, 6, 2, 3], 5], [[0, 1, 5, 4], 6]];
  const vn = ['0 0 1', '0 0 -1', '1 0 0', '-1 0 0', '0 1 0', '0 -1 0'];
  return ['# The studio\'s test crate: 80 units across, in centimetres (an OBJ says nothing of its units)', 'mtllib crate.mtl', 'o crate',
    ...c.map(p => 'v ' + p.join(' ')), 'vt 0 0', 'vt 1 0', 'vt 1 1', 'vt 0 1', ...vn.map(n => 'vn ' + n), 'usemtl crate',
    ...faces.map(([q, n]) => 'f ' + q.map((v, k) => `${v + 1}/${k + 1}/${n}`).join(' ')), ''].join('\n');
}
const crateMtl = () => ['# The test crate\'s material', 'newmtl crate', 'Kd 1 1 1', 'Ka 0 0 0', 'map_Kd crate.png', ''].join('\n');

// ---- layout.json
const layout = {
  studio: 1, scene: 'test', saved: '2026-11-03T22:40:00.000Z',
  objects: [
    { id: 'box001', name: 'Box', file: 'box.glb', p: [-1, 0.25, -2], q: [0, 0, 0, 1], s: 1, light: 'lit', clip: 'Spin', anim: 'loop', start: 'always' },
    { id: 'fig001', name: 'Figure', file: 'figure.fbx', p: [1, 0, -2], q: [-0.7071, 0, 0, 0.7071], s: 0.01, light: 'lit', clip: 'Take 001', anim: 'loop', start: 'shown' },
  ],
  cubes: [{ id: 'cube01', name: 'Doorway', p: [0, 1, 0], yaw: 0, size: [1.2, 2, 1.2], mode: 'while', show: ['fig001', 'snd001'], hide: ['box001'] }],
  sounds: [{ id: 'snd001', name: 'Tone', file: 'tone.wav', p: [1, 1.2, -2], vol: 0.8, r: 1.5, loop: true, start: 'shown' }],
};

// three.js's FBXLoader takes a text for binary when certain characters stand at certain places (isFbxFormatASCII):
// the figure's text must pass its check
const fbxText = fbx(), K = 'Kaydara\\FBX\\Binary\\\\';
for (let i = 0, pos = 0; i < K.length; pos += ++i) if (fbxText[pos] === K[i]) throw new Error(`figure.fbx would read as binary (character ${pos}): change its comment lines`);
const files = {
  'box.glb': glb(),
  'figure.fbx': Buffer.from(fbxText),
  'figure.png': png(64, 64, (x, y) => { const s = (Math.sin(x / 5) + Math.sin(y / 4)) * 0.25 + 0.5; return [Math.round(200 * s + 40), Math.round(120 * s + 60), Math.round(90 + 60 * (1 - s)), 255]; }),
  'tone.wav': wav(),
  'sounds/long.wav': longWav(),
  'originals/crate.obj': Buffer.from(crateObj()),
  'originals/crate.mtl': Buffer.from(crateMtl()),
  'originals/crate.png': png(8, 8, (x, y) => ((x >> 1) + (y >> 1)) & 1 ? [205, 140, 70, 255] : [120, 80, 40, 255]),
  'layout.json': Buffer.from(layoutText(layout)),   // (as the relay writes a saved one)
};
let total = 0;
for (const [f, b] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true }); fs.writeFileSync(path.join(out, f), b); total += b.length; }

// ---- the textures scene
const tout = path.join(here, 'scenes/textures');
fs.rmSync(tout, { recursive: true, force: true });
// a 1 m box (an OBJ gives no units: metres), its faces' texture coordinates whole
function boxObj(mtl) {
  const c = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]].map(p => [p[0] - 0.5, p[1], p[2] - 0.5]);
  const faces = [[[4, 5, 6, 7], 1], [[1, 0, 3, 2], 2], [[5, 1, 2, 6], 3], [[0, 4, 7, 3], 4], [[7, 6, 2, 3], 5], [[0, 1, 5, 4], 6]];
  const vn = ['0 0 1', '0 0 -1', '1 0 0', '-1 0 0', '0 1 0', '0 -1 0'];
  return ['# The studio\'s texture test: a 1 m box', ...(mtl ? ['mtllib ' + mtl + '.mtl'] : []), 'o ' + (mtl || 'plain'), ...c.map(p => 'v ' + p.join(' ')), 'vt 0 0', 'vt 1 0', 'vt 1 1', 'vt 0 1', ...vn.map(n => 'vn ' + n),
    ...(mtl ? ['usemtl ' + mtl] : []), ...faces.map(([q, n]) => 'f ' + q.map((v, k) => `${v + 1}/${k + 1}/${n}`).join(' ')), ''].join('\n');
}
const mtlText = (name, lines) => ['# a texture test material', 'newmtl ' + name, 'Kd 1 1 1', 'Ka 0 0 0', ...lines, ''].join('\n');
// panel.fbx: a 1 m x 1 m panel 4 cm thick (centimetres, Y up), its colour named by an author's path to a PSD and its
// normal map a DDS beside it
function panelFbx() {
  const W = 100, H = 100, D = 4, V = [], PI = [], NR = [], UV = [0, 0, 1, 0, 1, 1, 0, 1], UI = [];
  for (const p of [[-W / 2, 0, -D / 2], [W / 2, 0, -D / 2], [W / 2, H, -D / 2], [-W / 2, H, -D / 2], [-W / 2, 0, D / 2], [W / 2, 0, D / 2], [W / 2, H, D / 2], [-W / 2, H, D / 2]]) V.push(...p);
  const quads = [[[4, 5, 6, 7], [0, 0, 1]], [[1, 0, 3, 2], [0, 0, -1]], [[5, 1, 2, 6], [1, 0, 0]], [[0, 4, 7, 3], [-1, 0, 0]], [[7, 6, 2, 3], [0, 1, 0]], [[0, 1, 5, 4], [0, -1, 0]]];
  for (const [q, n] of quads) q.forEach((v, k) => { PI.push(k === 3 ? -v - 1 : v); NR.push(...n); UI.push(k); });
  const arr = (name, a, ind) => `${ind}${name}: *${a.length} {\n${ind}\ta: ${a.join(',')}\n${ind}}`, t = '\t', tt = '\t\t', ttt = '\t\t\t';
  const tex = (id, name, file) => `${t}Texture: ${id}, "Texture::${name}", "" {\n${tt}Type: "TextureVideoClip"\n${tt}Version: 202\n${tt}TextureName: "Texture::${name}"\n${tt}FileName: "${file}"\n${tt}RelativeFilename: "${file}"\n${t}}\n` +
    `${t}Video: ${id + 1000}, "Video::${name}", "Clip" {\n${tt}Type: "Clip"\n${tt}FileName: "${file}"\n${tt}RelativeFilename: "${file}"\n${t}}`;
  return `; FBX 7.4.0 project file
; The studio's texture test panel: Y up, in centimetres
FBXHeaderExtension:  {
${t}FBXHeaderVersion: 1003
${t}FBXVersion: 7400
${t}Creator: "tools/studio/test/make.mjs"
}
GlobalSettings:  {
${t}Version: 1000
${t}Properties70:  {
${tt}P: "UpAxis", "int", "Integer", "",1
${tt}P: "UpAxisSign", "int", "Integer", "",1
${tt}P: "UnitScaleFactor", "double", "Number", "",1
${t}}
}
Objects:  {
${t}Geometry: 1001, "Geometry::panel", "Mesh" {
${arr('Vertices', V, tt)}
${arr('PolygonVertexIndex', PI, tt)}
${tt}GeometryVersion: 124
${tt}LayerElementNormal: 0 {
${ttt}Version: 101
${ttt}Name: ""
${ttt}MappingInformationType: "ByPolygonVertex"
${ttt}ReferenceInformationType: "Direct"
${arr('Normals', NR, ttt)}
${tt}}
${tt}LayerElementUV: 0 {
${ttt}Version: 101
${ttt}Name: "map1"
${ttt}MappingInformationType: "ByPolygonVertex"
${ttt}ReferenceInformationType: "IndexToDirect"
${arr('UV', UV, ttt)}
${arr('UVIndex', UI, ttt)}
${tt}}
${tt}LayerElementMaterial: 0 {
${ttt}Version: 101
${ttt}Name: ""
${ttt}MappingInformationType: "AllSame"
${ttt}ReferenceInformationType: "IndexToDirect"
${arr('Materials', [0], ttt)}
${tt}}
${tt}Layer: 0 {
${ttt}Version: 100
${ttt}LayerElement:  {
${ttt}${t}Type: "LayerElementNormal"
${ttt}${t}TypedIndex: 0
${ttt}}
${ttt}LayerElement:  {
${ttt}${t}Type: "LayerElementMaterial"
${ttt}${t}TypedIndex: 0
${ttt}}
${ttt}LayerElement:  {
${ttt}${t}Type: "LayerElementUV"
${ttt}${t}TypedIndex: 0
${ttt}}
${tt}}
${t}}
${t}Model: 2001, "Model::panel", "Mesh" {
${tt}Version: 232
${tt}Properties70:  {
${ttt}P: "Lcl Translation", "Lcl Translation", "", "A",0,0,0
${ttt}P: "Lcl Rotation", "Lcl Rotation", "", "A",0,0,0
${ttt}P: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1
${tt}}
${tt}Shading: T
${tt}Culling: "CullingOff"
${t}}
${t}Material: 3001, "Material::panel", "" {
${tt}Version: 102
${tt}ShadingModel: "phong"
${tt}MultiLayer: 0
${tt}Properties70:  {
${ttt}P: "DiffuseColor", "Color", "", "A",1,1,1
${ttt}P: "Shininess", "double", "Number", "",20
${tt}}
${t}}
${tex(4001, 'panel', 'C:\\art\\Panel_Albedo.PSD')}
${tex(4002, 'panel_nrm', 'panel_nrm.dds')}
}
Connections:  {
${t}C: "OO",2001,0
${t}C: "OO",1001,2001
${t}C: "OO",3001,2001
${t}C: "OP",4001,3001, "DiffuseColor"
${t}C: "OP",4002,3001, "NormalMap"
${t}C: "OO",5001,4001
${t}C: "OO",5002,4002
}
`;
}
const panel = panelFbx();
for (let i = 0, pos = 0; i < K.length; pos += ++i) if (panel[pos] === K[i]) throw new Error(`panel.fbx would read as binary (character ${pos})`);
const tfiles = {
  'crate.obj': boxObj('crate'), 'crate.mtl': mtlText('crate', ['map_Kd tex/wood.tif', 'bump -bm 2 crate_height.png']),
  'panel.fbx': panel,
  'brick.obj': boxObj('brick'), 'brick.mtl': mtlText('brick', ['map_Kd brick.tga']),
  'stone.obj': boxObj('stone'), 'stone.mtl': mtlText('stone', ['map_Kd stone_diffuse.jpg']),
  'rust.obj': boxObj('rust'), 'rust.mtl': mtlText('rust', ['map_Kd rust_old.png']),
  'broken.obj': boxObj('broken'), 'broken.mtl': mtlText('broken', ['map_Kd broken.tif']),
  'plain.obj': boxObj(''),
};
for (const [f, p] of Object.entries(scenePictures())) tfiles[f] = p.bytes;
let ttotal = 0;
for (const [f, b] of Object.entries(tfiles)) { fs.mkdirSync(path.dirname(path.join(tout, f)), { recursive: true }); fs.writeFileSync(path.join(tout, f), b); ttotal += Buffer.byteLength(b); }

// ---- the rig scene: sounds that follow a model or a bone
const rout = path.join(here, 'scenes/rig');
fs.rmSync(rout, { recursive: true, force: true });
const rigLayout = {
  studio: 1, scene: 'rig', saved: '2026-11-04T12:00:00.000Z',
  objects: [
    { id: 'dan001', name: 'Dancer', file: 'dancer.glb', p: [0, 0, -2], q: [0, 0, 0, 1], s: 1, light: 'lit', clip: 'Dance', anim: 'loop', start: 'always' },
    { id: 'box001', name: 'Box', file: 'box.glb', p: [1.5, 0.25, -2], q: [0, 0, 0, 1], s: 1, light: 'lit', clip: 'Bob', anim: 'loop', start: 'always' },
  ],
  cubes: [{ id: 'cube01', name: 'Curtain', p: [0, 1, 2], yaw: 0, size: [1.2, 2, 1.2], mode: 'while', show: [], hide: ['dan001'] }],
  sounds: [{ id: 'voi001', name: 'Voice', file: 'voice.wav', p: [0, 1.73, -1.86], vol: 1, r: 1, loop: true, start: 'shown', on: 'dan001', bone: 'mixamorig:Head', o: [0, -0.03, 0.14] }],
};
const rfiles = { 'dancer.glb': dancerGlb(), 'box.glb': files['box.glb'], 'figure.fbx': files['figure.fbx'], 'figure.png': files['figure.png'], 'voice.wav': voiceWav(), 'layout.json': Buffer.from(layoutText(rigLayout)) };
let rtotal = 0;
fs.mkdirSync(rout, { recursive: true });
for (const [f, b] of Object.entries(rfiles)) { fs.writeFileSync(path.join(rout, f), b); rtotal += b.length; }

// ---- the cuts scene: cut-outs (a door a cube opens in a wall, a hole in one of two boxes of one file)
const cout = path.join(here, 'scenes/cuts');
fs.rmSync(cout, { recursive: true, force: true });
// a wall 3 m wide (x), 2.4 m high and 20 cm thick, its foot's middle at its origin
function wallObj() {
  const c = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]].map(p => [(p[0] - 0.5) * 3, p[1] * 2.4, (p[2] - 0.5) * 0.2]);
  const faces = [[[4, 5, 6, 7], 1], [[1, 0, 3, 2], 2], [[5, 1, 2, 6], 3], [[0, 4, 7, 3], 4], [[7, 6, 2, 3], 5], [[0, 1, 5, 4], 6]];
  const vn = ['0 0 1', '0 0 -1', '1 0 0', '-1 0 0', '0 1 0', '0 -1 0'];
  return ['# The studio\'s cut-out test: a wall 3 m wide, 2.4 m high, 20 cm thick', 'mtllib wall.mtl', 'o wall', ...c.map(p => 'v ' + p.map(v => +v.toFixed(4)).join(' ')), ...vn.map(n => 'vn ' + n),
    'usemtl wall', ...faces.map(([q, n]) => 'f ' + q.map(v => `${v + 1}//${n}`).join(' ')), ''].join('\n');
}
const cutsLayout = {
  studio: 1, scene: 'cuts', saved: '2026-11-04T18:00:00.000Z',
  objects: [
    { id: 'wal001', name: 'Wall', file: 'wall.obj', p: [0, 0, -3], q: [0, 0, 0, 1], s: 1, light: 'lit', clip: '', anim: 'loop', start: 'always' },
    { id: 'boxa01', name: 'Box A', file: 'box.glb', p: [-2.4, 0.25, -2.6], q: [0, 0, 0, 1], s: 1, light: 'lit', clip: 'Spin', anim: 'off', start: 'always' },
    { id: 'boxb01', name: 'Box B', file: 'box.glb', p: [-3.2, 0.25, -2.6], q: [0, 0, 0, 1], s: 1, light: 'lit', clip: 'Spin', anim: 'off', start: 'always' },
    { id: 'dan001', name: 'Dancer', file: 'dancer.glb', p: [2.3, 0, -2.6], q: [0, 0, 0, 1], s: 1, light: 'lit', clip: 'Dance', anim: 'loop', start: 'always' },
    { id: 'fig001', name: 'Figure', file: 'figure.fbx', p: [3.6, 0, -2.6], q: [-0.7071, 0, 0, 0.7071], s: 0.01, light: 'lit', clip: 'Take 001', anim: 'off', start: 'always' },
  ],
  cubes: [{ id: 'cub001', name: 'Doorway', p: [0.6, 1, -1.9], yaw: 0, size: [1.6, 2, 1.6], mode: 'while', show: ['dor001'], hide: [] }],
  sounds: [],
  cuts: [
    { id: 'dor001', name: 'Door', on: 'wal001', p: [0.6, 1, 0], q: [0, 0, 0, 1], size: [0.8, 2, 0.4] },
    { id: 'hol001', name: 'Hole', on: 'boxa01', p: [0.2, 0.2, 0.2], q: [0, 0, 0, 1], size: [0.3, 0.3, 0.3] },
  ],
};
const cfiles = { 'wall.obj': Buffer.from(wallObj()), 'wall.mtl': Buffer.from(['# The test wall\'s material', 'newmtl wall', 'Kd 0.82 0.76 0.68', 'Ka 0 0 0', ''].join('\n')),
  'dancer.glb': rfiles['dancer.glb'], 'box.glb': files['box.glb'], 'figure.fbx': files['figure.fbx'], 'figure.png': files['figure.png'], 'layout.json': Buffer.from(layoutText(cutsLayout)) };
let ctotal = 0;
fs.mkdirSync(cout, { recursive: true });
for (const [f, b] of Object.entries(cfiles)) { fs.writeFileSync(path.join(cout, f), b); ctotal += b.length; }

// ---- the puppet scene: a humanoid with Mixamo's bone names, for the trackers' solver (tools/studio/engine/ik.js)
// (quaternions as [x, y, z, w], three.js's order: qm(a, b) is a then b applied first, qv turns a vector)
const qm = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qc = a => [-a[0], -a[1], -a[2], a[3]];
const qa = (ax, ang) => { const n = Math.hypot(...ax), s = Math.sin(ang / 2) / n; return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)]; };
const vx = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vd = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], vs = (a, b) => a.map((v, i) => v - b[i]), vk = (a, k) => a.map(v => v * k);
const vn = a => vk(a, 1 / Math.hypot(...a));
const qv = (q, v) => { const u = q.slice(0, 3), t = vk(vx(u, v), 2), w = vx(u, t); return [0, 1, 2].map(i => v[i] + q[3] * t[i] + w[i]); };
// (a rotation from its matrix's columns, as three.js's Quaternion.setFromRotationMatrix)
function qFromCols(X, Y, Z) {
  const [m11, m21, m31] = X, [m12, m22, m32] = Y, [m13, m23, m33] = Z, tr = m11 + m22 + m33;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); return [(m32 - m23) * s, (m13 - m31) * s, (m21 - m12) * s, 0.25 / s]; }
  if (m11 > m22 && m11 > m33) { const s = 2 * Math.sqrt(1 + m11 - m22 - m33); return [0.25 * s, (m12 + m21) / s, (m13 + m31) / s, (m32 - m23) / s]; }
  if (m22 > m33) { const s = 2 * Math.sqrt(1 + m22 - m11 - m33); return [(m12 + m21) / s, 0.25 * s, (m23 + m32) / s, (m13 - m31) / s]; }
  const s = 2 * Math.sqrt(1 + m33 - m11 - m22); return [(m13 + m31) / s, (m23 + m32) / s, 0.25 * s, (m21 - m12) / s];
}
// the skeleton in a T-pose (metres, facing +z, its left at +x): [Mixamo's name without its prefix, parent, where it stands]
const PUPPET_BONES = [['Hips', '', [0, 1, 0]], ['Spine', 'Hips', [0, 1.1, 0.005]], ['Spine1', 'Spine', [0, 1.22, 0]], ['Spine2', 'Spine1', [0, 1.35, -0.01]],
  ['Neck', 'Spine2', [0, 1.5, 0]], ['Head', 'Neck', [0, 1.6, 0.02]], ['HeadTop_End', 'Head', [0, 1.78, 0.02]],
  ...[['Left', 1], ['Right', -1]].flatMap(([S, x]) => [[S + 'Shoulder', 'Spine2', [0.06 * x, 1.45, -0.01]], [S + 'Arm', S + 'Shoulder', [0.19 * x, 1.45, -0.02]],
    [S + 'ForeArm', S + 'Arm', [0.46 * x, 1.45, -0.02]], [S + 'Hand', S + 'ForeArm', [0.71 * x, 1.45, -0.02]]]),
  ...[['Left', 1], ['Right', -1]].flatMap(([S, x]) => [[S + 'UpLeg', 'Hips', [0.1 * x, 0.94, 0]], [S + 'Leg', S + 'UpLeg', [0.1 * x, 0.52, 0.01]],
    [S + 'Foot', S + 'Leg', [0.1 * x, 0.09, -0.01]], [S + 'ToeBase', S + 'Foot', [0.1 * x, 0.02, 0.12]], [S + 'Toe_End', S + 'ToeBase', [0.1 * x, 0.02, 0.2]]])];
const WALK_T = 1.1;
// the walk in place at time t: each bone's turn as a rotation in the rig's axes at rest (applied in its parent's frame at
// rest), and the hips' move. The elbows bend only about their hinge (the arm's line x forward: forward) and the knees only
// about theirs (x: back), as the solver's two-bone chains assume
function walkPose(t) {
  const ph = 2 * Math.PI * t / WALK_T, s = Math.sin(ph), c = Math.cos(ph), X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const knee = x => 0.14 + 0.6 * Math.max(0, x) ** 2;   // (bent most as the leg swings through)
  return {
    hip: [0.03 * s, -0.015 + 0.015 * Math.cos(2 * ph), 0],
    D: {
      Hips: qm(qa(Y, -0.1 * s), qa(Z, 0.04 * s)),
      Spine: qm(qa(Y, 0.04 * s), qa(X, 0.015)), Spine1: qm(qa(Y, 0.04 * s), qa(X, 0.015)), Spine2: qm(qa(Y, 0.05 * s), qa(X, 0.01)),
      Neck: qm(qa(Y, -0.015 * s), qa(X, -0.02)), Head: qm(qa(Y, -0.015 * s), qa(X, -0.02)),
      LeftUpLeg: qa(X, -0.42 * s), RightUpLeg: qa(X, 0.42 * s), LeftLeg: qa(X, knee(c)), RightLeg: qa(X, knee(-c)),
      LeftFoot: qa(X, 0.42 * s - 0.8 * knee(c)), RightFoot: qa(X, -0.42 * s - 0.8 * knee(-c)),
      LeftArm: qm(qa(X, 0.35 * s), qa(Z, -1.25)), RightArm: qm(qa(X, -0.35 * s), qa(Z, 1.25)),
      LeftForeArm: qa([0, -1, 0], 0.5 + 0.35 * Math.max(0, -s)), RightForeArm: qa(Y, 0.5 + 0.35 * Math.max(0, s)),
      LeftHand: qa(X, 0.12 * s), RightHand: qa(X, -0.12 * s),
    },
  };
}
function puppetGlb() {
  const B = PUPPET_BONES, idx = Object.fromEntries(B.map(([n], i) => [n, i])), pos = B.map(b => b[2]);
  const kids = B.map(([n]) => B.map(([, p], k) => (p === n ? k : -1)).filter(k => k >= 0));
  // each bone's frame at rest, as Mixamo's: y along the bone to its first child (the hand: on from its forearm; an end bone:
  // its parent's), z forward where it can be (else up), x = y x z
  const RW = [];
  B.forEach(([n, par], i) => {
    const pi = par ? idx[par] : -1, to = kids[i].length ? pos[kids[i][0]] : null;
    if (!to && /_End$/.test(n)) { RW[i] = RW[pi]; return; }
    const Yd = vn(to ? vs(to, pos[i]) : vs(pos[i], pos[pi])), ref = Math.abs(Yd[2]) > 0.7 ? [0, 1, 0] : [0, 0, 1];
    const Zd = vn(vs(ref, vk(Yd, vd(ref, Yd)))), Xd = vx(Yd, Zd);
    RW[i] = qFromCols(Xd, Yd, Zd);
  });
  const RL = B.map(([, par], i) => (par ? qm(qc(RW[idx[par]]), RW[i]) : RW[i]));
  const TL = B.map(([, par], i) => vk(par ? qv(qc(RW[idx[par]]), vs(pos[i], pos[idx[par]])) : pos[i], 100));   // (centimetres, in the parent's frame)
  // the body: a tube per bone [bone, from, to, radius across x, radius across z, sides, material (0 the suit, 1 skin), end
  // blended with its first child]
  const seg = [['Hips', [0, 0.86, 0], pos[idx.Spine], 0.15, 0.1, 12, 0, true], ['Spine', pos[idx.Spine], pos[idx.Spine1], 0.14, 0.1, 12, 0, true],
    ['Spine1', pos[idx.Spine1], pos[idx.Spine2], 0.15, 0.1, 12, 0, true], ['Spine2', pos[idx.Spine2], pos[idx.Neck], 0.17, 0.11, 12, 0, true],
    ['Neck', pos[idx.Neck], pos[idx.Head], 0.05, 0.05, 8, 1, true], ['Head', pos[idx.Head], pos[idx.HeadTop_End], 0.09, 0.1, 12, 1, false]];
  for (const S of ['Left', 'Right']) {
    const at = n => pos[idx[S + n]], hand = at('Hand'), dir = vn(vs(hand, at('ForeArm')));
    seg.push([S + 'Shoulder', at('Shoulder'), at('Arm'), 0.05, 0.05, 8, 0, true], [S + 'Arm', at('Arm'), at('ForeArm'), 0.045, 0.045, 8, 0, true],
      [S + 'ForeArm', at('ForeArm'), hand, 0.04, 0.04, 8, 0, true], [S + 'Hand', hand, hand.map((v, k) => v + dir[k] * 0.17), 0.02, 0.045, 8, 1, false],
      [S + 'UpLeg', at('UpLeg'), at('Leg'), 0.07, 0.07, 8, 0, true], [S + 'Leg', at('Leg'), at('Foot'), 0.05, 0.05, 8, 0, true],
      [S + 'Foot', at('Foot'), at('ToeBase'), 0.04, 0.045, 8, 0, true], [S + 'ToeBase', at('ToeBase'), at('Toe_End'), 0.035, 0.045, 8, 0, false]);
  }
  const prims = [0, 1].map(() => ({ P: [], N: [], J: [], Wt: [], I: [] }));
  for (const [name, A, Bp, rx, rz, n, mat, endBlend] of seg) {
    const g = prims[mat], j = idx[name], par = B[j][1] ? idx[B[j][1]] : -1, kid = endBlend ? kids[j][0] : -1;
    const d = vn(vs(Bp, A)), bx = qv(RW[j], [1, 0, 0]), X = vn(vs(bx, vk(d, vd(bx, d)))), Zc = vx(X, d);
    const wAt = f => (f === 0 && par >= 0 && name !== 'Hips' ? [[j, par], [0.5, 0.5]] : f === 1 && kid >= 0 ? [[j, kid], [0.5, 0.5]] : [[j, 0], [1, 0]]);
    const vert = (p, nrm, f) => { const [jj, ww] = wAt(f); g.P.push(...p); g.N.push(...nrm); g.J.push(jj[0], jj[1], 0, 0); g.Wt.push(ww[0], ww[1], 0, 0); };
    const F = [0, 0.22, 0.78, 1], b0 = g.P.length / 3;
    for (const f of F) {
      const c = A.map((v, k) => v + (Bp[k] - v) * f);
      for (let k = 0; k < n; k++) {
        const th = 2 * Math.PI * k / n, cs = Math.cos(th), sn = Math.sin(th);
        vert(c.map((v, i) => v + X[i] * cs * rx + Zc[i] * sn * rz), vn(X.map((v, i) => v * cs / rx + Zc[i] * sn / rz)), f);
      }
    }
    const ca = g.P.length / 3; vert(A, vk(d, -1), 0); vert(Bp, d, 1);
    for (let r = 0; r < F.length - 1; r++) for (let k = 0; k < n; k++) {
      const a = b0 + r * n + k, b = b0 + r * n + (k + 1) % n, cc = b0 + (r + 1) * n + (k + 1) % n, dd = b0 + (r + 1) * n + k;
      g.I.push(a, dd, cc, a, cc, b);
    }
    const last = b0 + (F.length - 1) * n;
    for (let k = 0; k < n; k++) { g.I.push(ca, b0 + k, b0 + (k + 1) % n); g.I.push(ca + 1, last + (k + 1) % n, last + k); }
  }
  const parts = [], views = [], acc = [];
  let off = 0;
  const add = (buf, target) => { const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; } views.push(Object.assign({ buffer: 0, byteOffset: off, byteLength: buf.length }, target ? { target } : {})); parts.push(buf); off += buf.length; return views.length - 1; };
  const f32 = a => Buffer.from(new Float32Array(a).buffer), u16 = a => Buffer.from(new Uint16Array(a).buffer), u8 = a => Buffer.from(new Uint8Array(a).buffer);
  const mm = (a, n) => [0, 1, 2, 3].slice(0, n).map(i => a.filter((_, k) => k % n === i)).map(c => [Math.min(...c), Math.max(...c)]);
  const accessor = (a, type, n, target, bounds) => { const v = add(f32(a), target); acc.push(Object.assign({ bufferView: v, componentType: 5126, count: a.length / n, type }, bounds ? { min: mm(a, n).map(x => x[0]), max: mm(a, n).map(x => x[1]) } : {})); return acc.length - 1; };
  const primitives = prims.map((g, k) => {
    const aP = accessor(g.P, 'VEC3', 3, 34962, true), aN = accessor(g.N, 'VEC3', 3, 34962), aW = accessor(g.Wt, 'VEC4', 4, 34962);
    acc.push({ bufferView: add(u8(g.J), 34962), componentType: 5121, count: g.J.length / 4, type: 'VEC4' }); const aJ = acc.length - 1;
    acc.push({ bufferView: add(u16(g.I), 34963), componentType: 5123, count: g.I.length, type: 'SCALAR' }); const aI = acc.length - 1;
    return { attributes: { POSITION: aP, NORMAL: aN, JOINTS_0: aJ, WEIGHTS_0: aW }, indices: aI, material: k };
  });
  // each bone's inverse bind matrix: the inverse of where it stands with its frame and the Armature's 0.01 (column-major)
  const ax = q => [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(e => qv(q, e));
  const aIBM = accessor(B.flatMap((_, i) => { const A3 = ax(RW[i]); return [0, 1, 2].flatMap(c => [0, 1, 2].map(r => 100 * A3[r][c])).flatMap((v, k) => (k % 3 === 2 ? [v, 0] : [v])).concat(A3.map(a => -100 * vd(a, pos[i])), 1); }), 'MAT4', 16);
  // Walk: 12 keys and the first again, each animated bone's local turn (its turn in the rig's axes carried into its parent's
  // frame at rest, then its own rest turn) and the hips' place (centimetres)
  // (the times and every track's values in one buffer view: a smaller JSON chunk)
  const K = 12, times = Array.from({ length: K + 1 }, (_, k) => +(k * WALK_T / K).toFixed(5)), anim = [...times], outs = [];
  const animated = Object.keys(walkPose(0).D), samplers = [], channels = [];
  const track = (node, path, vals) => { outs.push([anim.length, path === 'rotation' ? 'VEC4' : 'VEC3']); anim.push(...vals.flat()); samplers.push({ input: -1, output: -1, interpolation: 'LINEAR' }); channels.push({ sampler: samplers.length - 1, target: { node, path } }); };
  const nodeOf = i => 2 + i;
  track(nodeOf(0), 'translation', times.map(t => vk(pos[0].map((v, k) => v + walkPose(t).hip[k]), 100).map(v => +v.toFixed(4))));
  for (const n of animated) {
    const i = idx[n], par = B[i][1] ? idx[B[i][1]] : -1, pw = par >= 0 ? RW[par] : [0, 0, 0, 1];
    let prev = null;
    track(nodeOf(i), 'rotation', times.map(t => {
      let q = qm(qm(qc(pw), qm(walkPose(t).D[n], pw)), RL[i]);
      if (prev && vd(q, prev) + q[3] * prev[3] < 0) q = q.map(v => -v);
      prev = q; return q.map(v => +v.toFixed(6));
    }));
  }
  const vAnim = add(f32(anim));
  acc.push({ bufferView: vAnim, componentType: 5126, count: times.length, type: 'SCALAR', min: [0], max: [times[K]] }); const aT = acc.length - 1;
  outs.forEach(([at, type], k) => { acc.push({ bufferView: vAnim, byteOffset: at * 4, componentType: 5126, count: times.length, type }); Object.assign(samplers[k], { input: aT, output: acc.length - 1 }); });
  const r6 = a => a.map(v => +v.toFixed(6));
  const bin = Buffer.concat(parts), json = {
    asset: { version: '2.0', generator: 'tools/studio/test/make.mjs' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ name: 'puppet', children: [1, 2 + B.length] }, { name: 'Armature', scale: [0.01, 0.01, 0.01], children: [2] },
      ...B.map(([name], i) => Object.assign({ name: 'mixamorig:' + name, translation: r6(TL[i]), rotation: r6(RL[i]) }, kids[i].length ? { children: kids[i].map(nodeOf) } : {})),
      { name: 'body', mesh: 0, skin: 0 }],
    meshes: [{ name: 'body', primitives }],
    skins: [{ joints: B.map((_, i) => nodeOf(i)), inverseBindMatrices: aIBM, skeleton: nodeOf(0) }],
    materials: [{ name: 'suit', pbrMetallicRoughness: { baseColorFactor: [0.32, 0.45, 0.62, 1], metallicFactor: 0, roughnessFactor: 0.75 } }, { name: 'skin', pbrMetallicRoughness: { baseColorFactor: [0.93, 0.76, 0.62, 1], metallicFactor: 0, roughnessFactor: 0.6 } }],
    accessors: acc, bufferViews: views, buffers: [{ byteLength: bin.length + ((4 - (bin.length % 4)) % 4) }],
    animations: [{ name: 'Walk', channels, samplers }],
  };
  let js = Buffer.from(JSON.stringify(json));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const bb = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const head = Buffer.alloc(12); head.write('glTF', 0, 'ascii'); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bb.length, 8);
  const ch = (t, d) => { const b = Buffer.alloc(8); b.writeUInt32LE(d.length, 0); b.write(t, 4, 'ascii'); return Buffer.concat([b, d]); };
  return { glb: Buffer.concat([head, ch('JSON', js), ch('BIN\0', bb)]), tris: prims.reduce((n, g) => n + g.I.length / 3, 0) };
}
const pout = path.join(here, 'scenes/puppet');
fs.rmSync(pout, { recursive: true, force: true });
const puppet = puppetGlb();
const puppetLayout = {
  studio: 1, scene: 'puppet', saved: '2026-11-08T12:00:00.000Z',
  objects: [{ id: 'pup001', name: 'Puppet', file: 'rig.glb', p: [0, 0, -2], q: [0, 0, 0, 1], s: 1, light: 'lit', clip: 'Walk', anim: 'loop', start: 'always' }],
  cubes: [], sounds: [],
};
const pfiles = { 'rig.glb': puppet.glb, 'layout.json': Buffer.from(layoutText(puppetLayout)) };
let ptotal = 0;
fs.mkdirSync(pout, { recursive: true });
for (const [f, b] of Object.entries(pfiles)) { fs.writeFileSync(path.join(pout, f), b); ptotal += b.length; }

scan(path.join(here, 'scenes'));
for (const f of ['index.json']) total += fs.statSync(path.join(here, 'scenes', f)).size;
rtotal += fs.statSync(path.join(rout, 'files.json')).size;
ctotal += fs.statSync(path.join(cout, 'files.json')).size;
ptotal += fs.statSync(path.join(pout, 'files.json')).size;
total += fs.statSync(path.join(out, 'files.json')).size;
ttotal += fs.statSync(path.join(tout, 'files.json')).size;
console.log(`wrote tools/studio/test/scenes/test/ (${Object.keys(files).join(', ')}): ${(total / 1024).toFixed(1)} KB with the listings`);
console.log(`wrote tools/studio/test/scenes/textures/ (${Object.keys(tfiles).length} files): ${(ttotal / 1024).toFixed(1)} KB with its listing`);
console.log(`wrote tools/studio/test/scenes/rig/ (${Object.keys(rfiles).join(', ')}): ${(rtotal / 1024).toFixed(1)} KB with its listing`);
console.log(`wrote tools/studio/test/scenes/cuts/ (${Object.keys(cfiles).join(', ')}): ${(ctotal / 1024).toFixed(1)} KB with its listing`);
console.log(`wrote tools/studio/test/scenes/puppet/ (rig.glb: ${PUPPET_BONES.length} bones, ${puppet.tris} triangles, ${(puppet.glb.length / 1024).toFixed(1)} KB; layout.json): ${(ptotal / 1024).toFixed(1)} KB with its listing`);
