// Unity AnimationClips read from text YAML (a .anim file, or a clip embedded in a .playable) and evaluated, for the
// importer's Timelines (timeline.mjs). Only transform curves: m_PositionCurves, m_RotationCurves (quaternions),
// m_EulerCurves (degrees), m_ScaleCurves, and the float curves of m_EditorCurves / m_FloatCurves that name a transform
// attribute (m_LocalPosition.x, localEulerAnglesRaw.y, m_LocalRotation.w, m_LocalScale.z ...), each by its path ('' the
// animated object itself). Keys are evaluated as Unity does: cubic Hermite with each key's slopes, a slope of Infinity
// holding the value (stepped), weighted tangents as a cubic Bezier in time and value.

// one keyframe list -> [{ t, v: number[], i: number[], o: number[], wi: number[], wo: number[], wm }]
function keysOf(text, dims) {
  const keys = [];
  const re = /- serializedVersion: \d+\r?\n\s+time: ([^\r\n]+)\r?\n\s+value: ([^\r\n]+)\r?\n\s+inSlope: ([^\r\n]+)\r?\n\s+outSlope: ([^\r\n]+)\r?\n\s+tangentMode: ([^\r\n]+)\r?\n\s+weightedMode: ([^\r\n]+)\r?\n\s+inWeight: ([^\r\n]+)\r?\n\s+outWeight: ([^\r\n]+)/g;
  const num = s => (/^-?infinity$/i.test(s.trim()) ? (s.trim()[0] === '-' ? -Infinity : Infinity) : +s);
  const vals = s => {
    s = s.trim();
    if (s.startsWith('{')) { const o = {}; for (const m of s.matchAll(/(\w+): (-?[\w.+-]+)/g)) o[m[1]] = num(m[2]); return dims === 4 ? [o.x, o.y, o.z, o.w] : [o.x, o.y, o.z]; }
    return [num(s)];
  };
  let m;
  while ((m = re.exec(text))) keys.push({ t: +m[1], v: vals(m[2]), i: vals(m[3]), o: vals(m[4]), wm: +m[6], wi: vals(m[7]), wo: vals(m[8]) });
  return keys;
}

// a curve's value at time t, component k (Unity: clamped outside its keys; timeline.mjs handles the clip's own looping)
function evalKeys(keys, t, k) {
  if (!keys.length) return 0;
  if (t <= keys[0].t) return keys[0].v[k];
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.v[k];
  let a = 0, b = keys.length - 1;
  while (b - a > 1) { const c = (a + b) >> 1; if (keys[c].t <= t) a = c; else b = c; }
  const k0 = keys[a], k1 = keys[b], dt = k1.t - k0.t;
  const out = k0.o[k], inn = k1.i[k];
  if (!isFinite(out) || !isFinite(inn) || dt <= 0) return k0.v[k];
  const weighted = (k0.wm & 2) || (k1.wm & 1);
  if (!weighted) {
    const s = (t - k0.t) / dt, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * k0.v[k] + (s3 - 2 * s2 + s) * dt * out + (-2 * s3 + 3 * s2) * k1.v[k] + (s3 - s2) * dt * inn;
  }
  // weighted: a Bezier through (t0, v0), (t0 + w0 dt, v0 + w0 dt out), (t1 - w1 dt, v1 - w1 dt in), (t1, v1); find u where its time is t
  const w0 = k0.wm & 2 ? k0.wo[k] : 1 / 3, w1 = k1.wm & 1 ? k1.wi[k] : 1 / 3;
  const T = [k0.t, k0.t + w0 * dt, k1.t - w1 * dt, k1.t], V = [k0.v[k], k0.v[k] + w0 * dt * out, k1.v[k] - w1 * dt * inn, k1.v[k]];
  const bez = (P, u) => { const r = 1 - u; return r * r * r * P[0] + 3 * r * r * u * P[1] + 3 * r * u * u * P[2] + u * u * u * P[3]; };
  let lo = 0, hi = 1, u = 0.5;
  for (let i = 0; i < 40; i++) { u = (lo + hi) / 2; if (bez(T, u) < t) lo = u; else hi = u; }
  return bez(V, u);
}

// a clip document's body (the text after "AnimationClip:") -> { name, length, loop, curves: Map(path -> { pos, rot, euler, scale, float: Map(attr -> keys) }) }
export function readClip(body) {
  const name = (/^\s+m_Name: (.*)$/m.exec(body) || [])[1]?.trim() || '';
  const curves = new Map();
  const at = p => { if (!curves.has(p)) curves.set(p, { float: new Map() }); return curves.get(p); };
  const section = n => { const m = new RegExp(`^  ${n}:\\r?\\n((?:  - .*\\r?\\n|    .*\\r?\\n)*)`, 'm').exec(body); return m ? m[1] : ''; };
  const items = s => s.split(/^  - (?=curve:)/m).filter(x => x.trim());
  for (const [sec, kind, dims] of [['m_PositionCurves', 'pos', 3], ['m_RotationCurves', 'rot', 4], ['m_EulerCurves', 'euler', 3], ['m_ScaleCurves', 'scale', 3]]) {
    for (const it of items(section(sec))) {
      const path = (/^\s+path: ?(.*)$/m.exec(it) || [])[1]?.trim() || '';
      const order = +((/m_RotationOrder: (\d+)/.exec(it) || [])[1] ?? 4);
      at(path)[kind] = { keys: keysOf(it, dims), order };
    }
  }
  for (const sec of ['m_EditorCurves', 'm_FloatCurves']) {
    for (const it of items(section(sec))) {
      const attr = (/^\s+attribute: (.*)$/m.exec(it) || [])[1]?.trim(), path = (/^\s+path: ?(.*)$/m.exec(it) || [])[1]?.trim() || '';
      const cls = +((/^\s+classID: (\d+)/m.exec(it) || [])[1] || 0);
      if (attr && (cls === 4 || cls === 0) && !at(path).float.has(attr)) at(path).float.set(attr, keysOf(it, 1));
    }
  }
  const settings = /m_AnimationClipSettings:([\s\S]*?)\r?\n  m_\w+:/.exec(body);
  const sval = n => +((settings && new RegExp(`${n}: (-?[\\d.e+-]+)`).exec(settings[1])) || [0, 0])[1];
  const start = sval('m_StartTime'), stop = sval('m_StopTime');
  let length = stop - start;
  if (!(length > 0)) {   // (no settings: the last key's time)
    length = 0;
    for (const c of curves.values()) for (const v of [c.pos, c.rot, c.euler, c.scale]) if (v && v.keys.length) length = Math.max(length, v.keys[v.keys.length - 1].t);
    for (const c of curves.values()) for (const k of c.float.values()) if (k.length) length = Math.max(length, k[k.length - 1].t);
  }
  return { name, length, start: start || 0, loop: sval('m_LoopTime') === 1, curves };
}

// Unity's Euler angles (degrees) in a rotation order -> a quaternion (Unity's default order 4, ZXY: z first, then x, then y)
const qMul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
export function eulerToQuat([x, y, z], order = 4) {
  const r = Math.PI / 360;
  const qx = [Math.sin(x * r), 0, 0, Math.cos(x * r)], qy = [0, Math.sin(y * r), 0, Math.cos(y * r)], qz = [0, 0, Math.sin(z * r), Math.cos(z * r)];
  // (the order names the axes applied first to last: XYZ = 0, XZY, YZX, YXZ, ZXY = 4, ZYX)
  const seq = [[qx, qy, qz], [qx, qz, qy], [qy, qz, qx], [qy, qx, qz], [qz, qx, qy], [qz, qy, qx]][order] || [qz, qx, qy];
  return qMul(seq[2], qMul(seq[1], seq[0]));
}

// what a clip sets on the object at `path` at clip time t: { p?, q?, s? } (only what it animates; a float curve for one
// axis fills in that axis over `base`, the object's own local values)
export function sampleClip(clip, path, t, base) {
  const c = clip.curves.get(path);
  if (!c) return {};
  const out = {};
  const f = a => c.float.get(a);
  if (c.pos) out.p = [0, 1, 2].map(k => evalKeys(c.pos.keys, t, k));
  else if (['x', 'y', 'z'].some(a => f('m_LocalPosition.' + a))) out.p = ['x', 'y', 'z'].map((a, k) => (f('m_LocalPosition.' + a) ? evalKeys(f('m_LocalPosition.' + a), t, 0) : base.p[k]));
  if (c.rot) { const q = [0, 1, 2, 3].map(k => evalKeys(c.rot.keys, t, k)), n = Math.hypot(...q) || 1; out.q = q.map(v => v / n); }
  else if (c.euler) out.q = eulerToQuat([0, 1, 2].map(k => evalKeys(c.euler.keys, t, k)), c.euler.order);
  else if (['x', 'y', 'z', 'w'].some(a => f('m_LocalRotation.' + a))) {
    const q = ['x', 'y', 'z', 'w'].map((a, k) => (f('m_LocalRotation.' + a) ? evalKeys(f('m_LocalRotation.' + a), t, 0) : base.q[k])), n = Math.hypot(...q) || 1;
    out.q = q.map(v => v / n);
  } else {
    const e = ['x', 'y', 'z'].map(a => f('localEulerAnglesRaw.' + a) || f('localEulerAngles.' + a) || f('localEulerAnglesBaked.' + a));
    if (e.some(Boolean)) out.q = eulerToQuat(e.map((k, i) => (k ? evalKeys(k, t, 0) : base.euler ? base.euler[i] : 0)), 4);
  }
  if (c.scale) out.s = [0, 1, 2].map(k => evalKeys(c.scale.keys, t, k));
  else if (['x', 'y', 'z'].some(a => f('m_LocalScale.' + a))) out.s = ['x', 'y', 'z'].map((a, k) => (f('m_LocalScale.' + a) ? evalKeys(f('m_LocalScale.' + a), t, 0) : base.s[k]));
  return out;
}

export const _test = { keysOf, evalKeys, qMul };
