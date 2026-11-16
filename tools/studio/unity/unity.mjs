// Reading a Unity project's scene files (text YAML, "Force Text" serialization) for the importer (import.mjs).
// Node's own modules only. Not a YAML parser: Unity writes one object per document (`--- !u!<class> &<fileID>`), two
// spaces per level, in a fixed shape, and only the fields the importer needs are read, by pattern.
import fs from 'node:fs';
import path from 'node:path';

// every asset's guid -> its path in the project (from the .meta files beside them), Assets/ and Packages/
export function guidMap(project) {
  const map = new Map();
  const walk = dir => {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'Library' && !e.name.startsWith('.')) walk(p); continue; }
      if (!e.name.endsWith('.meta')) continue;
      const fd = fs.openSync(p, 'r'), b = Buffer.alloc(200);
      const n = fs.readSync(fd, b, 0, 200, 0); fs.closeSync(fd);
      const m = /^guid: ([0-9a-f]{32})/m.exec(b.toString('utf8', 0, n));
      if (m) map.set(m[1], p.slice(0, -5));
    }
  };
  for (const d of ['Assets', 'Packages']) walk(path.join(project, d));
  return map;
}

// a scene or prefab file: fileID -> { cls, type, stripped, body }
export function parseDocs(text) {
  const docs = new Map();
  const re = /^--- !u!(\d+) &(-?\d+)( stripped)?\r?\n/gm;
  let m, last = null;
  while ((m = re.exec(text))) {
    if (last) last.body = text.slice(last.start, m.index);
    last = { id: m[2], cls: +m[1], stripped: !!m[3], start: re.lastIndex };
    docs.set(m[2], last);
  }
  if (last) last.body = text.slice(last.start);
  for (const d of docs.values()) { d.type = d.body.slice(0, d.body.indexOf(':')).trim(); delete d.start; }
  return docs;
}

// a top-level field of a document (two spaces in), as written
export const field = (body, name) => { const m = new RegExp(`^  ${name}: (.*)$`, 'm').exec(body); return m ? m[1].trim() : null; };
// {fileID: 1, guid: ..., type: 3} -> { fileID, guid }
export const ref = s => { const m = /\{fileID: (-?\d+)(?:, guid: ([0-9a-f]{32}))?/.exec(s || ''); return m ? { fileID: m[1], guid: m[2] || null } : null; };
// {x: 1, y: 2, z: 3} -> { x, y, z }
export const vec = s => { const o = {}; for (const m of String(s || '').matchAll(/(\w+): (-?[\d.]+(?:e[-+]?\d+)?)/gi)) o[m[1]] = +m[2]; return o; };
// the block under a top-level field: its lines, two more spaces in
export function block(body, name) {
  const m = new RegExp(`^  ${name}:\\r?\\n((?:    .*\\r?\\n|  - .*\\r?\\n)*)`, 'm').exec(body);
  return m ? m[1] : '';
}
// every {fileID: ...} in a list block (m_Children, m_Component)
export const refs = s => [...String(s).matchAll(/\{fileID: (-?\d+)(?:, guid: ([0-9a-f]{32}))?/g)].map(m => ({ fileID: m[1], guid: m[2] || null }));

// a PrefabInstance's m_Modifications: [{ target: { fileID, guid }, path, value, ref }]
export function modifications(body) {
  const out = [];
  const re = /- target: (\{[^}]*\})\r?\n\s+propertyPath: (.*)\r?\n\s+value: ?(.*)\r?\n\s+objectReference: (\{[^}]*\})/g;
  let m;
  while ((m = re.exec(body))) out.push({ target: ref(m[1]), path: m[2].trim(), value: m[3].trim(), ref: ref(m[4]) });
  return out;
}

// a material (.mat): its shader and its main texture
export function readMaterial(file, guids) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const shader = ref(field(text, 'm_Shader'));
  const tex = /- _MainTex:\r?\n\s+m_Texture: (\{[^}]*\})/.exec(text) || /- _BaseMap:\r?\n\s+m_Texture: (\{[^}]*\})/.exec(text);
  const t = tex && ref(tex[1]);
  const col = /- _Color: (\{[^}]*\})/.exec(text) || /- _BaseColor: (\{[^}]*\})/.exec(text);
  const name = field(text, 'm_Name');
  let shaderName = null;
  if (shader && shader.guid && shader.guid !== '0000000000000000f000000000000000' && guids.get(shader.guid)) {
    try { shaderName = (/^Shader "([^"]+)"/m.exec(fs.readFileSync(guids.get(shader.guid), 'utf8')) || [])[1] || null; } catch {}
  }
  return { file, name, shader, shaderName, texture: t && t.guid ? guids.get(t.guid) || null : null, color: col ? vec(col[1]) : null };
}

// Unity's built-in shaders by fileID (guid 0000000000000000f000000000000000): which ones are unlit
const UNLIT = new Set(['10750', '10751', '10752', '10753', '10755', '10760', '10770', '200', '201', '202', '203', '10703']);
export const isUnlit = mat => !!mat && ((mat.shader && mat.shader.guid === '0000000000000000f000000000000000' && UNLIT.has(mat.shader.fileID)) ||
  /unlit|particles\//i.test(mat.shaderName || ''));

// a model's .meta: its importer settings and the materials it is remapped to (externalObjects: material name -> .mat)
export function readModelMeta(file, guids) {
  let text = '';
  try { text = fs.readFileSync(file + '.meta', 'utf8'); } catch { return null; }
  const num = n => { const m = new RegExp(`^\\s+${n}: (.*)$`, 'm').exec(text); return m ? +m[1] : null; };
  const remap = new Map();
  for (const m of text.matchAll(/- first:\r?\n\s+type: UnityEngine:Material\r?\n\s+assembly: \S+\r?\n\s+name: (.*)\r?\n\s+second: (\{[^}]*\})/g)) {
    const r = ref(m[2]);
    if (r && r.guid && guids.get(r.guid)) remap.set(m[1].trim(), guids.get(r.guid));
  }
  // the clips Unity cuts from the file's takes (clipAnimations: name, take, firstFrame..lastFrame in the file's frames)
  const clips = [];
  const ca = /^    clipAnimations:(?: \[\])?\r?\n((?:    [- ] .*\r?\n|      .*\r?\n)*)/m.exec(text);
  if (ca) for (const c of ca[1].split(/^    - serializedVersion:.*$/m).slice(1)) {
    const g = n => { const m = new RegExp(`^      ${n}: (.*)$`, 'm').exec(c); return m ? m[1].trim() : null; };
    clips.push({ name: g('name') || '', take: g('takeName') || '', first: +g('firstFrame'), last: +g('lastFrame'), loop: g('loopTime') === '1' });
  }
  return {
    globalScale: num('globalScale') ?? 1, useFileScale: num('useFileScale') ?? 1, preserveHierarchy: num('preserveHierarchy') ?? 0,
    bakeAxisConversion: num('bakeAxisConversion') ?? 0, materials: remap, loopTime: num('loopTime'), clips,
  };
}

// The matrices: 4x4, column-major (as three.js and glTF), in plain arrays.
export const M = {
  identity: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  mul(a, b) {
    const o = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
    return o;
  },
  compose(p, q, s) {
    const [x, y, z, w] = q, [sx, sy, sz] = s;
    const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
    return [(1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0,
      2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0,
      2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0,
      p[0], p[1], p[2], 1];
  },
  scale: (x, y = x, z = x) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1],
  invert(m) {
    const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    const d = 1 / det;
    return [(a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d, (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
      (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d, (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
      (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d, (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
      (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d, (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d];
  },
  // -> { p, q, s: [sx, sy, sz] } (positive scales; a mirrored matrix is not expected here)
  decompose(m) {
    const len = (a, b, c) => Math.hypot(a, b, c);
    const sx = len(m[0], m[1], m[2]), sy = len(m[4], m[5], m[6]), sz = len(m[8], m[9], m[10]);
    const r = [m[0] / sx, m[1] / sx, m[2] / sx, m[4] / sy, m[5] / sy, m[6] / sy, m[8] / sz, m[9] / sz, m[10] / sz];
    const [m11, m21, m31, m12, m22, m32, m13, m23, m33] = r, tr = m11 + m22 + m33;
    let q;
    if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); q = [(m32 - m23) * s, (m13 - m31) * s, (m21 - m12) * s, 0.25 / s]; }
    else if (m11 > m22 && m11 > m33) { const s = 2 * Math.sqrt(1 + m11 - m22 - m33); q = [0.25 * s, (m12 + m21) / s, (m13 + m31) / s, (m32 - m23) / s]; }
    else if (m22 > m33) { const s = 2 * Math.sqrt(1 + m22 - m11 - m33); q = [(m12 + m21) / s, 0.25 * s, (m23 + m32) / s, (m13 - m31) / s]; }
    else { const s = 2 * Math.sqrt(1 + m33 - m11 - m22); q = [(m13 + m31) / s, (m23 + m32) / s, 0.25 * s, (m21 - m12) / s]; }
    const n = Math.hypot(...q);
    q = q.map(v => v / n);
    if (q[3] < 0) q = q.map(v => -v);
    return { p: [m[12], m[13], m[14]], q, s: [sx, sy, sz] };
  },
  apply(m, v) { return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]]; },
};
