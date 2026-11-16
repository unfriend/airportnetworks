// Unity Timelines (PlayableDirector + .playable) and Animator controllers that move objects, read for the importer
// (import.mjs) and evaluated as Unity plays them (the rules in tools/studio/unity/README.md, "Timelines"). Only what the
// Annette scene's eight timelines use: animation tracks with clips or an infinite clip, transform offsets (mode 0),
// hold extrapolation, activation tracks, wrap modes hold / loop / none; root-position clips on the bound object and
// skeletal takes (bones only) told apart.
import fs from 'node:fs';
import path from 'node:path';
import { parseDocs, field, ref, vec, block, refs } from './unity.mjs';
import { readClip, sampleClip, eulerToQuat } from './anim.mjs';

const qMul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qRot = (q, v) => { const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; };
const v3 = s => { const o = vec(s); return [o.x || 0, o.y || 0, o.z || 0]; };
const num = (body, n, d = 0) => { const v = field(body, n); if (v === null) return d; return /^-?infinity$/i.test(v) ? (v[0] === '-' ? -Infinity : Infinity) : +v; };

// an AnimationClip by reference: embedded in the same file (fileID only), or a .anim by guid; an FBX take is a take
function clipOf(r, docs, guids, cache) {
  if (!r || r.fileID === '0') return null;
  if (!r.guid) { const d = docs.get(r.fileID); return d && d.type === 'AnimationClip' ? { clip: readClip(d.body), src: 'embedded' } : null; }
  const file = guids.get(r.guid);
  if (!file) return null;
  if (/\.anim$/i.test(file)) {
    if (!cache.has(file)) { const d = [...parseDocs(fs.readFileSync(file, 'utf8')).values()].find(x => x.type === 'AnimationClip'); cache.set(file, d ? readClip(d.body) : null); }
    return cache.get(file) ? { clip: cache.get(file), src: file } : null;
  }
  return { take: true, src: file };   // (an FBX's take: bones only here; its length from the converted GLB)
}
const hasRoot = c => !!(c && c.clip && c.clip.curves.has('') && (c.clip.curves.get('').pos || c.clip.curves.get('').rot || c.clip.curves.get('').euler || c.clip.curves.get('').float.size));

// every PlayableDirector of the scene: { id, go, wrap, D, tracks: [{ kind: 'anim' | 'act', target (scene fileID), clips, ... }] }
export function readDirectors(sceneDocs, guids) {
  const out = [], cache = new Map();
  for (const d of sceneDocs.values()) {
    if (d.type !== 'PlayableDirector' || field(d.body, 'm_Enabled') !== '1') continue;
    const asset = ref(field(d.body, 'm_PlayableAsset')), file = asset && guids.get(asset.guid);
    if (!file || !/\.playable$/i.test(file)) continue;
    const docs = parseDocs(fs.readFileSync(file, 'utf8'));
    const tl = [...docs.values()].find(x => x.type === 'MonoBehaviour' && /^  m_Tracks:/m.test(x.body));
    if (!tl) continue;
    const bind = new Map();
    for (const m of d.body.matchAll(/- key: (\{[^}]*\})\r?\n\s+value: (\{[^}]*\})/g)) bind.set(ref(m[1]).fileID, ref(m[2]).fileID);
    const tracks = [];
    const walkTracks = ids => { for (const r of ids) {
      const t = docs.get(r.fileID);
      if (!t) continue;
      if (field(t.body, 'm_Muted') === '1') continue;
      walkTracks(refs(block(t.body, 'm_Children')));
      const target = bind.get(t.id);
      const isAct = /^  m_PostPlaybackState:/m.test(t.body), isAnim = /^  m_InfiniteClip:/m.test(t.body);
      // (an audio track: its clips' assets are AudioPlayableAssets, with clip properties)
      const isAudio = !isAct && !isAnim && /^  m_TrackProperties:/m.test(t.body);
      if (!isAct && !isAnim && !isAudio) continue;
      const clips = [];
      for (const c of block(t.body, 'm_Clips').split(/^  - m_Version:/m).slice(1)) {
        const g = n => { const m = new RegExp(`^    ${n}: (.*)$`, 'm').exec(c); return m ? m[1].trim() : null; };
        const nn = n => { const v = g(n); return v === null ? 0 : /^-?infinity$/i.test(v) ? Infinity : +v; };
        const a = docs.get(ref(g('m_Asset'))?.fileID);
        const clip = { start: nn('m_Start'), dur: nn('m_Duration'), clipIn: nn('m_ClipIn'), scale: nn('m_TimeScale') || 1, pre: nn('m_PreExtrapolationMode'), post: nn('m_PostExtrapolationMode'), name: g('m_DisplayName') || '' };
        if (a && isAnim) {
          Object.assign(clip, clipOf(ref(field(a.body, 'm_Clip')), docs, guids, cache) || {});
          clip.pos = v3(field(a.body, 'm_Position')); clip.euler = v3(field(a.body, 'm_EulerAngles')); clip.rso = field(a.body, 'm_RemoveStartOffset') === '1';
          clip.loopMode = num(a.body, 'm_Loop', 0);   // (0 as the clip's own Loop Time says, 1 loops, 2 does not)
        }
        if (a && isAudio) {
          const r = ref(field(a.body, 'm_Clip'));
          clip.audio = (r && r.guid && guids.get(r.guid)) || null; clip.loop = field(a.body, 'm_Loop') === '1';
          clip.vol = +((/^    volume: (.*)$/m.exec(a.body) || [])[1] ?? 1);
        }
        clips.push(clip);
      }
      const track = { id: t.id, kind: isAct ? 'act' : isAudio ? 'audio' : 'anim', name: field(t.body, 'm_Name'), target, clips: clips.sort((a, b) => a.start - b.start),
        offsetMode: num(t.body, 'm_TrackOffset'), pos: v3(field(t.body, 'm_Position')), euler: v3(field(t.body, 'm_EulerAngles')) };
      if (isAct) track.post = num(t.body, 'm_PostPlaybackState', 3);   // (0 active, 1 inactive, 2 revert, 3 leave as is: after the director ends)
      if (isAudio) {   // (its own level and how 3D it is; an unbound one plays 2D)
        const tp = block(t.body, 'm_TrackProperties');
        track.vol = +((/volume: (.*)/.exec(tp) || [])[1] ?? 1); track.spatial = +((/spatialBlend: (.*)/.exec(tp) || [])[1] ?? 0);
        track.clips = track.clips.filter(c => c.audio);
        if (track.clips.length) tracks.push(track);
        continue;
      }
      if (isAnim && !clips.length) {
        const inf = clipOf(ref(field(t.body, 'm_InfiniteClip')), docs, guids, cache);
        if (inf) Object.assign(track, { infinite: inf, infPos: v3(field(t.body, 'm_InfiniteClipOffsetPosition')), infEuler: v3(field(t.body, 'm_InfiniteClipOffsetEulerAngles')),
          infRso: field(t.body, 'm_InfiniteClipRemoveOffset') === '1' });
      }
      if (target && (track.clips.length || track.infinite)) tracks.push(track);
    } };
    walkTracks(refs(block(tl.body, 'm_Tracks')));
    // its length: the clips' last end (an infinite clip counts with its own length)
    let D = 0;
    for (const t of tracks) { for (const c of t.clips) D = Math.max(D, c.start + c.dur); if (t.infinite && t.infinite.clip) D = Math.max(D, t.infinite.clip.length); }
    if (num(tl.body, 'm_DurationMode') === 1) D = num(tl.body, 'm_FixedDuration', D);
    out.push({ id: d.id, go: ref(field(d.body, 'm_GameObject')).fileID, file, wrap: num(d.body, 'm_WrapMode', 1), D, tracks });
  }
  return out;
}

// the director's own time at t seconds after it started (null: it has stopped, wrap none past its end)
export const directorTime = (dir, t) => (dir.wrap === 1 ? (dir.D > 0 ? t % dir.D : 0) : dir.wrap === 2 ? (t < dir.D ? t : null) : Math.min(t, dir.D));

// which clip of a track drives it at director time t, and its local time (null: none: extrapolation None there)
function clipAt(track, t) {
  const cs = track.clips;
  for (const c of cs) if (t >= c.start && t < c.start + c.dur) return { c, local: t - c.start };
  if (cs.length && t < cs[0].start) return cs[0].pre === 1 ? { c: cs[0], local: 0 } : null;
  let last = null;
  for (const c of cs) if (c.start + c.dur <= t) last = c;
  return last && last.post === 1 ? { c: last, local: last.dur } : null;
}
const clipTime = (clip, c, local) => {
  let tc = (c.clipIn || 0) + local * (c.scale || 1);
  const L = clip.length;
  return clip.loop && L > 0 ? tc % L : Math.max(0, Math.min(L, tc));
};

// what an animation track sets on its target's local transform at director time t: { p, q } (Unity's frame), or null
export function trackPose(track, t, base) {
  if (track.kind !== 'anim') return null;
  let c, local, clip, pos, euler, rso;
  if (track.infinite) { if (!hasRoot(track.infinite)) return null; clip = track.infinite.clip; local = t; pos = track.infPos; euler = track.infEuler; rso = track.infRso; c = { clipIn: 0, scale: 1 }; }
  else {
    const at = clipAt(track, t);
    if (!at || !hasRoot(at.c)) return null;
    ({ c, local } = at); clip = c.clip; pos = c.pos; euler = c.euler; rso = c.rso;
  }
  const tau = clipTime(clip, c, local);
  const s = sampleClip(clip, '', tau, base), s0 = rso ? sampleClip(clip, '', clipTime(clip, c, 0), base) : null;
  // remove start offset: the clip's movement taken from its first frame (its place and, when it turns, its turn)
  const q0i = s0 && s0.q ? [-s0.q[0], -s0.q[1], -s0.q[2], s0.q[3]] : [0, 0, 0, 1];
  const pRaw = s.p || base.p, pc = s0 && s0.p ? qRot(q0i, pRaw.map((v, k) => v - s0.p[k])) : pRaw;
  const Rt = eulerToQuat(track.euler, 4), Rc = eulerToQuat(euler, 4);
  const inner = qRot(Rc, pc).map((v, k) => v + pos[k]);
  const p = qRot(Rt, inner).map((v, k) => v + track.pos[k]);
  const qClip = s.q ? qMul(q0i, s.q) : [0, 0, 0, 1];
  return { p, q: qMul(qMul(Rt, Rc), qClip) };
}

// an activation track's clips merged where they follow on each other (Unity's activation mixer keeps its target on
// across them: no OnDisable, no OnEnable): [{ start, end }]
export function actRuns(track) {
  const runs = [];
  for (const c of track.clips) {
    const prev = runs[runs.length - 1];
    if (prev && c.start <= prev.end + 1e-3) prev.end = Math.max(prev.end, c.start + c.dur);
    else runs.push({ start: c.start, end: c.start + c.dur });
  }
  return runs;
}

// whether an activation track has its target active at director time t
export function trackActive(track, t) { return track.clips.some(c => t >= c.start && t < c.start + c.dur); }
// ... at t seconds after the director started, as Unity has it: a held director (wrap hold) holds its last moment (a clip
// ending at the director's end stays on); one that stops (wrap none) leaves its targets as the track's post-playback
// state says (active, inactive, as before it started, or as at its end); a looping one comes round
export function activeAt(dir, track, t, before = true) {
  const dt = directorTime(dir, t);
  if (dt === null) { const p = track.post ?? 3; return p === 0 ? true : p === 1 ? false : p === 2 ? before : trackActive(track, dir.D - 1e-6); }
  return trackActive(track, Math.min(dt, dir.D - 1e-6));
}

// the skeletal takes a track plays on its target (bones only), merged where they follow on each other:
// [{ start, end, take (its source file), src, anim, loopMode (the first clip's) }]
export function takeRuns(track) {
  const runs = [];
  for (const c of track.clips) {
    if (!(c.take || (c.clip && !hasRoot(c)))) continue;
    const prev = runs[runs.length - 1];
    if (prev && prev.src === c.src && Math.abs(prev.end - c.start) < 1e-3) prev.end = c.start + c.dur;
    else runs.push({ start: c.start, end: c.start + c.dur, src: c.src, anim: !c.take, loopMode: c.loopMode || 0 });
  }
  return runs;
}

// an Animator controller's default state's clip, when it moves its object's root (an .anim with root curves):
// { clip, speed } or null (a take on bones, or nothing)
export function controllerRoot(file, guids) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const docs = parseDocs(text);
  const sm = [...docs.values()].find(d => d.type === 'AnimatorStateMachine');
  const st = sm && docs.get(ref(field(sm.body, 'm_DefaultState'))?.fileID);
  if (!st) return null;
  const m = ref(field(st.body, 'm_Motion')), f = m && m.guid && guids.get(m.guid);
  if (!f || !/\.anim$/i.test(f)) return null;
  const d = [...parseDocs(fs.readFileSync(f, 'utf8')).values()].find(x => x.type === 'AnimationClip');
  const clip = d && readClip(d.body);
  return clip && hasRoot({ clip }) ? { clip, speed: num(st.body, 'm_Speed', 1), src: f } : null;
}
// what such a controller sets at t seconds (generic: the clip's root values, absolute, looping as the clip says)
export function controllerPose(ctl, t, base) {
  const L = ctl.clip.length, tc = t * ctl.speed;
  const tau = ctl.clip.loop && L > 0 ? tc % L : Math.max(0, Math.min(L, tc));
  const s = sampleClip(ctl.clip, '', tau, base);
  return { p: s.p || base.p, q: s.q || base.q };
}

export const _test = { clipAt, clipTime, qRot, qMul };
export const baseName = f => path.basename(f, path.extname(f));
