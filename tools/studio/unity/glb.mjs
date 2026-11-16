// Small edits to a converted GLB for the importer (import.mjs), Node's own modules only: a clip of a take's first frame
// (what Unity shows before a Timeline starts the take: it holds the first frame), and materials made one plain colour
// (a Unity material given to one placement that has no picture).
import fs from 'node:fs';

export function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`);
  const jl = b.readUInt32LE(12), json = JSON.parse(b.slice(20, 20 + jl).toString('utf8'));
  let bin = Buffer.alloc(0);
  if (b.length > 20 + jl + 8 && b.readUInt32LE(20 + jl + 4) === 0x004e4942) bin = b.slice(28 + jl, 28 + jl + b.readUInt32LE(20 + jl));
  return { json, bin };
}

export function writeGlb(file, json, bin) {
  const pad = (buf, ch) => (buf.length % 4 ? Buffer.concat([buf, Buffer.alloc(4 - (buf.length % 4), ch)]) : buf);
  if (json.buffers && json.buffers[0]) json.buffers[0].byteLength = bin.length;
  const j = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20), bb = pad(bin, 0);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + j.length + (bb.length ? 8 + bb.length : 0), 8);
  const ch = (len, type) => { const c = Buffer.alloc(8); c.writeUInt32LE(len, 0); c.writeUInt32LE(type, 4); return c; };
  fs.writeFileSync(file, Buffer.concat([head, ch(j.length, 0x4e4f534a), j, ...(bb.length ? [ch(bb.length, 0x004e4942), bb] : [])]));
}

const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
// the first element of a float accessor (an animation's output)
function first(json, bin, ai) {
  const a = json.accessors[ai], v = json.bufferViews[a.bufferView], n = SIZE[a.type];
  if (a.componentType !== 5126 || a.sparse) return null;
  const off = (v.byteOffset || 0) + (a.byteOffset || 0);
  return Array.from({ length: n }, (_, k) => bin.readFloatLE(off + 4 * k));
}

// adds, once, an animation `name` holding the first frame of animation 0 (two keys 1/30 s apart, so it has a length and
// loops in place); true when the file changed
export function addFirstFrame(file, name = 'first frame') {
  const { json, bin } = readGlb(file);
  const src = (json.animations || [])[0];
  if (!src || json.animations.some(a => a.name === name)) return false;
  const parts = [bin], views = json.bufferViews, accs = json.accessors;
  let len = bin.length;
  const add = floats => {
    const pad = len % 4 ? 4 - (len % 4) : 0;
    if (pad) { parts.push(Buffer.alloc(pad)); len += pad; }
    const b = Buffer.alloc(floats.length * 4); floats.forEach((f, i) => b.writeFloatLE(f, i * 4));
    views.push({ buffer: 0, byteOffset: len, byteLength: b.length });
    parts.push(b); len += b.length;
    return views.length - 1;
  };
  const tIn = add([0, 1 / 30]);
  accs.push({ bufferView: tIn, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1 / 30] });
  const inAcc = accs.length - 1;
  const samplers = [], channels = [];
  src.channels.forEach(c => {
    const s = src.samplers[c.sampler], v = first(json, bin, s.output);
    if (!v) return;
    const out = add([...v, ...v]);
    accs.push({ bufferView: out, componentType: 5126, count: 2, type: json.accessors[s.output].type });
    samplers.push({ input: inAcc, output: accs.length - 1, interpolation: 'LINEAR' });
    channels.push({ sampler: samplers.length - 1, target: { ...c.target } });
  });
  if (!channels.length) return false;
  json.animations.push({ name, samplers, channels });
  writeGlb(file, json, Buffer.concat(parts));
  return true;
}

// every animation cut to [a, b] seconds of the file's own time and started at 0: Unity's clip window on an FBX take
// (its .meta's firstFrame..lastFrame), where the converter keeps the whole take on the file's own clock. Each channel
// gets a key at both ends (between its keys, or its nearest held), so every channel lasts b - a and the clip loops as
// Unity's does. The old keys leave the file (its buffer packed again). Once: the animation is marked (extras.crop);
// the importer's own 'first frame' (addFirstFrame, after the cut) is never cut. Times are compared as the file keeps
// them (32-bit floats), so no kept key lands on an end key's time (glTF wants them strictly increasing).
// -> true when the file changed; throws on what it cannot cut (cubic spline keys, keys not floats, shape-key weights)
export function cropAnimations(file, a, b) {
  const { json, bin } = readGlb(file);
  const anims = (json.animations || []).filter(x => !(x.extras && x.extras.crop) && x.name !== 'first frame');
  if (!anims.length || !(b > a)) return false;
  const accs = json.accessors;
  const rows = ai => {
    const acc = accs[ai], v = json.bufferViews[acc.bufferView], n = SIZE[acc.type];
    if (acc.componentType !== 5126 || acc.sparse || !n) throw new Error('animation keys that are not plain floats');
    const stride = v.byteStride || 4 * n, off = (v.byteOffset || 0) + (acc.byteOffset || 0);
    return Array.from({ length: acc.count }, (_, i) => Array.from({ length: n }, (_, k) => bin.readFloatLE(off + i * stride + 4 * k)));
  };
  // the value of a channel at t: a key's own at its time, else between its neighbours (STEP: the one before), held
  // beyond its ends; turns (VEC4 rotations) the shorter way, normalised
  const valueAt = (times, vals, how, rot, t) => {
    if (t <= times[0]) return vals[0];
    const last = times.length - 1;
    if (t >= times[last]) return vals[last];
    let lo = 0, hi = last;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (times[m] <= t) lo = m; else hi = m; }
    if (times[lo] === t || how === 'STEP') return vals[lo];
    const u = (t - times[lo]) / (times[hi] - times[lo]), x = vals[lo];
    let y = vals[hi];
    if (rot && x.reduce((s, v, k) => s + v * y[k], 0) < 0) y = y.map(v => -v);
    const r = x.map((v, k) => v + (y[k] - v) * u);
    if (!rot) return r;
    const l = Math.hypot(...r) || 1;
    return r.map(v => v / l);
  };
  const parts = [], added = [];
  let len = bin.length;
  const put = (floats, type) => {
    const pad = len % 4 ? 4 - (len % 4) : 0;
    if (pad) { parts.push(Buffer.alloc(pad)); len += pad; }
    const buf = Buffer.alloc(floats.length * 4);
    floats.forEach((f, i) => buf.writeFloatLE(f, i * 4));
    json.bufferViews.push({ buffer: 0, byteOffset: len, byteLength: buf.length });
    parts.push(buf); len += buf.length;
    return json.bufferViews.length - 1;
  };
  // (samplers may share their times: each input is cut once, from its original keys)
  const newTimes = new Map(), oldTimes = new Map();
  const F = Math.fround, end = F(b - a);
  for (const an of anims) an.samplers.forEach((s, si) => {
    if ((s.interpolation || 'LINEAR') === 'CUBICSPLINE') throw new Error('cubic spline animation keys');
    // (a weights channel holds keys x shape keys in one list: not cut here)
    if (an.channels.some(c => c.sampler === si && c.target && c.target.path === 'weights')) throw new Error('shape-key (weights) animation keys');
    if (!oldTimes.has(s.input)) {
      const t = rows(s.input).map(r => r[0]);
      oldTimes.set(s.input, t);
      newTimes.set(s.input, [a, ...t.filter(x => F(x - a) > 0 && F(x - a) < end), b]);
    }
  });
  const outs = [];
  for (const an of anims) an.samplers.forEach((s, si) => {
    const rot = an.channels.some(c => c.sampler === si && c.target && c.target.path === 'rotation');
    const vals = rows(s.output), times = oldTimes.get(s.input);
    outs.push([s.output, newTimes.get(s.input).map(t => valueAt(times, vals, s.interpolation || 'LINEAR', rot, t)), accs[s.output].type]);
  });
  // the new keys in place of the old (same accessors, new views)
  for (const [ai, t] of newTimes) {
    const z = t.map(x => x - a);
    Object.assign(accs[ai], { bufferView: put(z, 'SCALAR'), byteOffset: 0, count: z.length, min: [0], max: [z[z.length - 1]] });
    added.push(ai);
  }
  for (const [ai, vals, type] of outs) {
    Object.assign(accs[ai], { bufferView: put(vals.flat(), type), byteOffset: 0, count: vals.length });
    delete accs[ai].min; delete accs[ai].max;
  }
  for (const an of anims) an.extras = { ...(an.extras || {}), crop: [Math.round(a * 1e4) / 1e4, Math.round(b * 1e4) / 1e4] };
  // the buffer packed again: only the views something still names (every "bufferView" in the JSON), in their order
  const all = Buffer.concat([bin, ...parts]);
  const named = new Set();
  const walk = (o, fn) => { if (Array.isArray(o)) o.forEach(x => walk(x, fn)); else if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (k === 'bufferView' && Number.isInteger(o[k])) fn(o, k); else walk(o[k], fn); } };
  walk({ ...json, bufferViews: undefined }, (o, k) => named.add(o[k]));
  const keep = json.bufferViews.map((_, i) => i).filter(i => named.has(i)), remap = new Map(keep.map((i, j) => [i, j]));
  const chunks = [];
  let off = 0;
  const views = keep.map(i => {
    const v = json.bufferViews[i], pad = off % 4 ? 4 - (off % 4) : 0;
    if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; }
    chunks.push(all.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength));
    const nv = { ...v, byteOffset: off };
    off += v.byteLength;
    return nv;
  });
  walk({ ...json, bufferViews: undefined }, (o, k) => { o[k] = remap.get(o[k]); });
  json.bufferViews = views;
  writeGlb(file, json, Buffer.concat(chunks));
  return true;
}

// an FBX's frame rate (its GlobalSettings TimeMode, as Unity reads frames of a take), 30 when it says none
export function fbxFrameRate(file) {
  const RATES = { 1: 120, 2: 100, 3: 60, 4: 50, 5: 48, 6: 30, 7: 30, 8: 29.97, 9: 29.97, 10: 25, 11: 24, 12: 1000, 13: 23.976, 15: 96, 16: 72, 17: 59.94, 18: 119.88 };
  const b = fs.readFileSync(file);
  const prop = name => {
    const i = b.indexOf(name);
    if (i < 0) return null;
    if (b.slice(0, 18).toString('latin1') !== 'Kaydara FBX Binary') {
      const m = new RegExp(`${name}"\\s*,\\s*"[^"]*"\\s*,\\s*"[^"]*"\\s*,\\s*"[^"]*"\\s*,\\s*([-\\d.eE+]+)`).exec(b.slice(i - 1, i + 200).toString('latin1'));
      return m ? +m[1] : null;
    }
    let p = i + name.length;
    for (let k = 0; k < 3; k++) { if (b[p] !== 0x53) return null; p += 5 + b.readUInt32LE(p + 1); }
    return b[p] === 0x49 ? b.readInt32LE(p + 1) : b[p] === 0x44 ? b.readDoubleLE(p + 1) : b[p] === 0x46 ? b.readFloatLE(p + 1) : null;
  };
  const mode = prop('TimeMode');
  if (mode === 14) { const c = prop('CustomFrameRate'); return c > 0 ? c : 30; }
  return RATES[mode] || 30;
}

// every material one plain colour (no colour picture), [r, g, b] 0..1; true when the file changed
export function plainColour(file, rgb) {
  const { json, bin } = readGlb(file);
  let changed = false;
  for (const m of json.materials || []) {
    const p = m.pbrMetallicRoughness || (m.pbrMetallicRoughness = {});
    const want = [...rgb, (p.baseColorFactor || [1, 1, 1, 1])[3]];
    if (p.baseColorTexture || JSON.stringify(p.baseColorFactor || [1, 1, 1, 1]) !== JSON.stringify(want)) { delete p.baseColorTexture; p.baseColorFactor = want; changed = true; }
  }
  if (changed) writeGlb(file, json, bin);
  return changed;
}

// the length (s) of a GLB's animation by name (else its first)
export function clipLength(file, name) {
  const { json } = readGlb(file);
  const a = (json.animations || []).find(x => x.name === name) || (json.animations || [])[0];
  return a ? Math.max(...a.samplers.map(s => (json.accessors[s.input].max || [0])[0])) : 0;
}
