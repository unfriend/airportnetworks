// Makes the studio's test scene, tools/studio/test/scenes/test/ (committed with what it writes, under 200 KB together):
//   box.glb     a 0.5 m box with a small texture inside and two clips (Spin, Bob): glTF, metres, Y up
//   figure.fbx  an ASCII FBX 7.4: a 40 x 30 x 170 cm block standing along Z (Z up, centimetres: both guesses show), its
//               material's colour texture named by an author's path (C:\Users\...\figure.png, found by its base name)
//               and a specular texture that is not there (figure_spec.png: its card says so), a take that turns it, and
//               its material's Opacity 0 (as 3ds Max writes it: the studio draws it solid and says so)
//   figure.png  the figure's texture
//   tone.wav    a short tone (0.6 s, 440 Hz)
//   layout.json one object of each model, a cube showing the figure and the sound and hiding the box, and the sound
// and then index.json and files.json, by tools/studio/scan.mjs (node tools/studio/scan.mjs tools/studio/test/scenes --check
// says whether they are current).
// usage (from the repository root): node tools/studio/test/make.mjs
//        node tools/studio/test/make.mjs --index <folder>   only index.json and files.json (scan.mjs), for any folder of scenes
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execFileSync } from 'child_process';
import { layoutText } from '../../../relay/scenes.mjs';
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
  'layout.json': Buffer.from(layoutText(layout)),   // (as the relay writes a saved one)
};
let total = 0;
for (const [f, b] of Object.entries(files)) { fs.writeFileSync(path.join(out, f), b); total += b.length; }
scan(path.join(here, 'scenes'));
for (const f of ['index.json']) total += fs.statSync(path.join(here, 'scenes', f)).size;
total += fs.statSync(path.join(out, 'files.json')).size;
console.log(`wrote tools/studio/test/scenes/test/ (${Object.keys(files).join(', ')}): ${(total / 1024).toFixed(1)} KB with the listings`);
