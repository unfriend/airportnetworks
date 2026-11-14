// Performance measuring tool: what each scene costs per frame in a pretend headset (the goal is a steady 90 Hz on a Quest).
//   node tools/perf.mjs [url] [--only <words>] [--json <file>] [--md <file>] [--frames N] [--list]
//   node tools/perf.mjs --from a.json,b.json --md report.md        (no run: only merge JSON files into the report)
// Without a url it serves this folder itself on a free port (and the heavy synthetic studio scene it makes in a temporary
// folder, which needs that server: with a url the heavy scene is skipped). --only: scenes whose id contains one of the
// words (comma or space separated), e.g. --only studio,room or --only story:qubits.
// Needs Playwright (PLAYWRIGHT_MODULE, CHROMIUM_PATH as tools/smoke.mjs). It reuses smoke.mjs's pretend Quest (FPS_FAKE: three.js
// r128's own WebXR path, a layer with a framebuffer of its own, two controllers) and pretend AR headset (OCCL_FAKE: depth
// texture and room planes), read out of that file's text with the frame clock set to 90 Hz. Each frame is driven by the test.
// This machine draws WebGL in software, so GPU time is not measured: per frame it records script ms (the frame function and
// everything it calls less the time inside renderer.render, which is reported apart as render submit ms), draw calls and
// triangles (renderer.info, both eyes as three.js counts them), WebGL calls by wrapping the context (texture and buffer upload
// bytes, program links and compiles, mipmaps, readPixels), the see-through layers in the scene (transparent, depthWrite off or
// additive meshes; large: bounding sphere over 0.5 m) as a fill-rate proxy, scene objects and how many still have
// matrixAutoUpdate on, the JS heap allocated per frame and renderer.info.memory before and after. Exits 0 always (a measuring
// tool, not a test); scenes that cannot be set up are reported with why.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARGS = process.argv.slice(2);
const opt = (name, def = '') => { const i = ARGS.indexOf(name); return i >= 0 ? ARGS[i + 1] || '' : def; };
const flag = name => ARGS.includes(name);
const valueOf = new Set(['--only', '--json', '--md', '--frames', '--from']);
const POS = ARGS.filter((a, i) => !a.startsWith('--') && !(i && valueOf.has(ARGS[i - 1])));
const ONLY = opt('--only').split(/[\s,]+/).filter(Boolean);
const N = Math.max(10, parseInt(opt('--frames', '120'), 10) || 120);
const JSON_OUT = opt('--json'), MD_OUT = opt('--md'), FROM = opt('--from');

// ------------------------------------------------------------------------------------------------ the report --
const f1 = v => (v == null || Number.isNaN(v) ? '-' : (Math.round(v * 10) / 10).toString());
const f0 = v => (v == null || Number.isNaN(v) ? '-' : Math.round(v).toString());
const COLS = [['js mean', m => f1(m.js.mean)], ['js p95', m => f1(m.js.p95)], ['js max', m => f1(m.js.max)], ['>11ms', m => f0(m.js.long)],
  ['render', m => f1(m.render.mean)], ['draws', m => f0(m.calls.mean)], ['tris k', m => f0(m.tris.mean / 1000)], ['tex KB/f', m => f1(m.texBytes / 1024)],
  ['buf KB/f', m => f1(m.bufBytes / 1024)], ['links', m => f0(m.link)], ['mips', m => f0(m.mip)], ['see-thru', m => f0(m.scene.transp)],
  ['large', m => f0(m.scene.transpLarge)], ['objs', m => f0(m.scene.objects)], ['auto', m => f0(m.scene.autoUpdate)], ['heap KB/f', m => f0(m.heapPerFrame)]];
function table(rows) {
  const L = ['| scene | ' + COLS.map(c => c[0]).join(' | ') + ' |', '|---|' + COLS.map(() => '---:').join('|') + '|'];
  for (const r of rows) L.push('| ' + r.id + ' | ' + (r.m ? COLS.map(c => c[1](r.m)).join(' | ') : COLS.map(() => '').join(' | ').replace(/ \|/g, ' |')) + ' |' + (r.m ? '' : ' ' + (r.note || '')));
  return L.join('\n');
}
function report(results) {
  const ok = results.filter(r => r.m), bad = results.filter(r => !r.m && !r.lb && !r.hitch);
  const top = (key, label, unit, n = 15) => {
    const v = [...ok].filter(r => key(r) != null && !Number.isNaN(key(r))).sort((a, b) => key(b) - key(a)).slice(0, n);
    return `**${label}**\n` + v.map((r, i) => `${i + 1}. ${r.id}: ${f1(key(r))} ${unit}`).join('\n');
  };
  const out = [];
  out.push('## What stands out');
  out.push('(script ms excludes renderer.render; this machine draws in software, so GPU time is unknown. The target is 11.1 ms a frame at 90 Hz, of which the page\'s script should use well under half.)');
  out.push(top(r => r.m.js.mean, '15 worst scenes by script ms (mean)', 'ms'));
  out.push(top(r => r.m.js.max, '15 worst scenes by worst frame script ms', 'ms'));
  out.push(top(r => r.m.calls.mean, '15 worst scenes by draw calls a frame (both eyes)', 'draws'));
  out.push(top(r => (r.m.texBytes + r.m.bufBytes) / 1024, '15 worst scenes by uploads a frame (texture + buffer)', 'KB'));
  out.push(top(r => r.m.scene.transpLarge, '15 worst scenes by large see-through layers', 'layers'));
  out.push(top(r => r.m.scene.objects, '15 worst scenes by scene objects', 'objects'));
  const lb = results.filter(r => r.lb);
  if (lb.length) {
    out.push('**Left behind and unloading (everything found)**');
    for (const r of lb) out.push(`- ${r.id}: ${(r.lb.found || []).length ? '' : 'nothing found'}` + (r.lb.found || []).map(s => '\n  - ' + s).join(''));
  }
  const hi = results.filter(r => r.hitch);
  if (hi.length) {
    out.push('**Story change hitch**');
    for (const r of hi) out.push(`- ${r.id}: worst gap between frames ${f0(r.hitch.worstGap)} ms, longest long task ${f0(r.hitch.longTask)} ms, ${r.hitch.frames} frames; longest load steps ${JSON.stringify(r.hitch.steps)}`);
  }
  if (bad.length) { out.push('**Could not be measured**'); for (const r of bad) out.push(`- ${r.id}: ${r.note}`); }
  out.push('\n## All scenes\n');
  out.push(`Frames per scene: ${N} unless noted. Columns: script ms of the frame (mean, 95th percentile, worst), frames over 11.1 ms of script, render submit ms, draw calls and triangles (both eyes), texture and buffer upload KB per frame, program links in the run, mipmaps generated, visible see-through meshes and large ones (radius over 0.5 m), scene objects, objects with matrixAutoUpdate on, JS heap allocated per frame.\n`);
  out.push(table(ok));
  return out.join('\n\n');
}
if (FROM) {
  const all = FROM.split(',').flatMap(f => JSON.parse(fs.readFileSync(f, 'utf8')).results || []);
  const seen = new Map(); for (const r of all) seen.set(r.id, r);
  const res = [...seen.values()];
  if (MD_OUT) fs.writeFileSync(MD_OUT, report(res) + '\n');
  console.log(report(res));
  process.exit(0);
}

// ------------------------------------------------------------------------ the fakes, read out of smoke.mjs --
const SMOKE = fs.readFileSync(path.join(ROOT, 'tools/smoke.mjs'), 'utf8');
function fnText(name) {
  const at = SMOKE.indexOf('function ' + name + '() {');
  if (at < 0) throw new Error('smoke.mjs has no ' + name);
  const end = SMOKE.indexOf('\n}\n', at);
  return SMOKE.slice(at, end + 2);
}
const FPS_SRC = fnText('FPS_FAKE').replace('1000 / 72', '1000 / 90');
const OCC_SRC = fnText('OCCL_FAKE');

// ------------------------------------------------- the page's side: counters and the measuring (an init script) --
function PERF_LIB() {
  const P = window.__perf = { C: { texCalls: 0, texBytes: 0, bufCalls: 0, bufBytes: 0, link: 0, compile: 0, mip: 0, read: 0 },
    timers: { to: 0, raf: 0, iv: new Map() }, lis: { add: 0, rm: 0 }, media: new Set(), audio: { nodes: 0, by: {} }, es: new Set(), long: [] };
  // WebGL calls
  const dims = (name, a) => {
    let w = 0, h = 0;
    if (name === 'texImage2D') { if (a.length >= 8) { w = a[3]; h = a[4]; } else if (a[5]) { w = a[5].width || a[5].videoWidth || 0; h = a[5].height || a[5].videoHeight || 0; } }
    else if (name === 'texSubImage2D') { if (a.length >= 8) { w = a[4]; h = a[5]; } else if (a[6]) { w = a[6].width || a[6].videoWidth || 0; h = a[6].height || a[6].videoHeight || 0; } }
    else if (name === 'texImage3D') { w = a[3]; h = a[4] * (a[5] || 1); }
    else if (name === 'texSubImage3D') { w = a[5]; h = a[6] * (a[7] || 1); }
    return (w || 0) * (h || 0) * 4;
  };
  for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
    for (const name of ['texImage2D', 'texSubImage2D', 'texImage3D', 'texSubImage3D']) {
      const fn = proto[name]; if (!fn) continue;
      proto[name] = function (...a) { P.C.texCalls++; P.C.texBytes += dims(name, a); return fn.apply(this, a); };
    }
    for (const name of ['bufferData', 'bufferSubData']) {
      const fn = proto[name]; if (!fn) continue;
      proto[name] = function (...a) { P.C.bufCalls++; const d = name === 'bufferData' ? a[1] : a[2]; P.C.bufBytes += typeof d === 'number' ? d : (d && d.byteLength) || 0; return fn.apply(this, a); };
    }
    for (const [name, key] of [['linkProgram', 'link'], ['compileShader', 'compile'], ['generateMipmap', 'mip'], ['readPixels', 'read']]) {
      const fn = proto[name]; if (!fn) continue;
      proto[name] = function (...a) { P.C[key]++; return fn.apply(this, a); };
    }
  }
  // timers, animation frames, listeners
  const st = window.setTimeout, si = window.setInterval, ci = window.clearInterval, raf = window.requestAnimationFrame;
  const where = (k, n = 2) => { try { return new Error().stack.split('\n').slice(k, k + n).map(x => x.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '')).join(' < '); } catch (e) { return '?'; } };
  P.trace = null; P.st = st;
  window.setTimeout = function (...a) { P.timers.to++; if (P.trace) { const w = 'timeout ' + where(2); P.trace.set(w, (P.trace.get(w) || 0) + 1); } return st.apply(this, a); };
  window.setInterval = function (fn, ms, ...r) {
    const id = si.call(this, fn, ms, ...r);
    let where = ''; try { where = (new Error().stack.split('\n').slice(2, 5).map(s => s.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '')).join(' < ')); } catch (e) { /* no stack */ }
    P.timers.iv.set(id, { ms, fn: String(fn).slice(0, 70).replace(/\s+/g, ' '), where });
    return id;
  };
  window.clearInterval = function (id) { P.timers.iv.delete(id); return ci.call(this, id); };
  window.requestAnimationFrame = function (cb) { P.timers.raf++; if (P.trace) { const w = 'raf ' + where(2); P.trace.set(w, (P.trace.get(w) || 0) + 1); } return raf.call(this, cb); };
  const ael = EventTarget.prototype.addEventListener, rel = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (t, ...r) { P.lis.add++; return ael.call(this, t, ...r); };
  EventTarget.prototype.removeEventListener = function (t, ...r) { P.lis.rm++; return rel.call(this, t, ...r); };
  // audio nodes created, media elements played, event sources opened
  try {
    for (const k of Object.getOwnPropertyNames(BaseAudioContext.prototype)) {
      if (!/^create/.test(k) || k === 'createBuffer') continue;
      const fn = BaseAudioContext.prototype[k];
      BaseAudioContext.prototype[k] = function (...a) { P.audio.nodes++; P.audio.by[k] = (P.audio.by[k] || 0) + 1; if (P.trace) { const w = 'audio ' + k + ' ' + where(2).replace(/ < .*/, '') + ' < ' + where(3).split(' < ').pop(); P.trace.set(w, (P.trace.get(w) || 0) + 1); } return fn.apply(this, a); };
    }
  } catch (e) { /* no audio */ }
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) { P.media.add(this); return play.apply(this, a); };
  if (window.EventSource) {
    const ES = window.EventSource;
    window.EventSource = function (...a) { const e = new ES(...a); P.es.add(e); return e; };
    window.EventSource.prototype = ES.prototype;
  }
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.long.push(e.duration); }).observe({ entryTypes: ['longtask'] }); } catch (e) { /* unsupported */ }

  const stepOne = () => (window.__fp ? window.__fp.step(1) : window.__occl.step(1));
  const maxScale = m => { const e = m.elements; return Math.max(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])); };
  const seeThrough = m => { const L = Array.isArray(m) ? m : [m]; return L.some(x => x && (x.transparent || x.depthWrite === false || x.blending === THREE.AdditiveBlending || (x.blending === THREE.CustomBlending && x.blendDst === THREE.OneFactor))); };
  P.sceneStats = () => {
    const sc = HOST.cur && HOST.cur.collab && HOST.cur.collab.scene && HOST.cur.collab.scene();
    const S = { objects: 0, visible: 0, autoUpdate: 0, meshes: 0, transp: 0, transpLarge: 0, sprites: 0, points: 0, lines: 0, instances: 0 };
    if (!sc) return S;
    sc.updateMatrixWorld();
    sc.traverse(o => { S.objects++; });
    sc.traverseVisible(o => {
      S.visible++; if (o.matrixAutoUpdate) S.autoUpdate++;
      if (o.isPoints) { S.points++; if (seeThrough(o.material)) S.transp++; return; }
      if (o.isLine) { S.lines++; return; }
      if (o.isSprite) { S.sprites++; S.transp++; if (Math.max(o.scale.x, o.scale.y) * maxScale(o.matrixWorld) > 1) S.transpLarge++; return; }
      if (!o.isMesh) return;
      S.meshes++; if (o.isInstancedMesh) S.instances += o.count;
      if (!seeThrough(o.material)) return;
      S.transp++;
      const g = o.geometry; if (!g) return;
      if (!g.boundingSphere) g.computeBoundingSphere();
      if (g.boundingSphere && g.boundingSphere.radius * maxScale(o.matrixWorld) > 0.5) S.transpLarge++;
    });
    return S;
  };
  const stats = a => {
    if (!a.length) return { mean: 0, p95: 0, max: 0, long: 0 };
    const s = [...a].sort((x, y) => x - y);
    return { mean: a.reduce((x, y) => x + y, 0) / a.length, p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))], max: s[s.length - 1], long: a.filter(v => v > 11.1).length };
  };
  P.measure = async (n, o) => {
    o = o || {};
    const step = o.step || stepOne, r = HOST.renderer, I = r.info;
    if (window.gc) window.gc();
    const mem = () => ({ geo: I.memory.geometries, tex: I.memory.textures, prog: (I.programs || []).length });
    const heap = () => (performance.memory ? performance.memory.usedJSHeapSize : 0);
    const m0 = mem(), h0 = heap(), C0 = { ...P.C };
    const js = [], rn = [], calls = [], tris = [], tot = [];
    const orig = r.render; let rms = 0;
    r.render = function (a, b) { const t = performance.now(); try { return orig.call(this, a, b); } finally { rms += performance.now() - t; } };
    const ar = I.autoReset; I.autoReset = false;
    let h1 = h0, gc = false, lastH = h0, alloc = 0;
    try {
      for (let i = 0; i < n; i++) {
        I.reset(); rms = 0;
        const t0 = performance.now(); step(); const t1 = performance.now();
        tot.push(t1 - t0); rn.push(rms); js.push(t1 - t0 - rms); calls.push(I.render.calls); tris.push(I.render.triangles);
        const h = heap(); if (h < lastH) gc = true; else alloc += h - lastH; lastH = h; h1 = h;
        if (i % 8 === 7) await new Promise(res => P.st.call(window, res, 0));
      }
    } finally { r.render = orig; I.autoReset = ar; }
    const m1 = mem(), C1 = P.C, avg = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    return { frames: n, js: stats(js), render: stats(rn), total: stats(tot), calls: { mean: avg(calls), max: Math.max(...calls) }, tris: { mean: avg(tris), max: Math.max(...tris) },
      texBytes: (C1.texBytes - C0.texBytes) / n, bufBytes: (C1.bufBytes - C0.bufBytes) / n, texCalls: (C1.texCalls - C0.texCalls) / n, bufCalls: (C1.bufCalls - C0.bufCalls) / n,
      link: C1.link - C0.link, compile: C1.compile - C0.compile, mip: C1.mip - C0.mip, read: C1.read - C0.read,
      heapPerFrame: performance.memory ? alloc / n / 1024 : null, heapGc: gc, memBefore: m0, memAfter: m1, scene: P.sceneStats(),
      shell: { overlayCards: HOST.collab && HOST.collab.overlay && HOST.collab.overlay() && HOST.collab.overlay().cards ? HOST.collab.overlay().cards.size : 0 } };
  };
  // the state of what could be left behind
  P.snap = () => {
    const I = HOST.renderer ? HOST.renderer.info : null;
    return { geo: I ? I.memory.geometries : 0, tex: I ? I.memory.textures : 0, prog: I && I.programs ? I.programs.length : 0, listeners: P.lis.add - P.lis.rm,
      intervals: [...P.timers.iv.values()].map(v => v.ms + 'ms ' + v.fn + ' @ ' + v.where), mediaPlaying: [...P.media].filter(m => !m.paused && !m.ended).length, mediaEver: P.media.size,
      audioNodesMade: P.audio.nodes, eventSources: [...P.es].filter(e => e.readyState !== 2).length, drones: (HOST.sfx && HOST.sfx.state && HOST.sfx.state().drones || []).length };
  };
  // frames for some real time, then what ran meanwhile
  P.observe = async (ms, step, trace) => {
    step = step || stepOne;
    const t0 = performance.now(), to0 = P.timers.to, raf0 = P.timers.raf, an0 = P.audio.nodes, la0 = P.lis.add, fr = [];
    if (trace) P.trace = new Map();
    while (performance.now() - t0 < ms) { const a = performance.now(); step(); fr.push(performance.now() - a); await new Promise(r => P.st.call(window, r, 4)); }
    const s = (performance.now() - t0) / 1000, tr = P.trace; P.trace = null;
    // (the waiting loop above uses the page's own setTimeout, kept as P.st: not counted)
    return { frames: fr.length, jsMean: fr.reduce((a, b) => a + b, 0) / (fr.length || 1), timeoutsPerSec: (P.timers.to - to0) / s, windowRafPerSec: (P.timers.raf - raf0) / s, audioNodesPerSec: (P.audio.nodes - an0) / s, listenersAddedPerSec: (P.lis.add - la0) / s,
      top: tr ? [...tr].filter(([k]) => !/perf|evaluate/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => Math.round(n / s) + '/s ' + k) : undefined };
  };
}

// ------------------------------------------------------------------------------------ the heavy synthetic studio scene --
function crcTable() { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; }
const CRC = crcTable();
const crc = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png(w, h) {
  // a smooth, bright pattern: compresses to a few MB
  const row = w * 3 + 1, raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) {
    raw[y * row] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * row + 1 + x * 3, v = (Math.sin(x / 97) + Math.cos(y / 61) + 2) * 0.25;
      raw[o] = 80 + 150 * v; raw[o + 1] = 60 + 140 * ((x ^ y) & 64 ? v : 1 - v); raw[o + 2] = 120 + 100 * (y / h);
    }
  }
  const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4, 'latin1'); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 1 })), chunk('IEND', Buffer.alloc(0))]);
}
function heavyGlb(quads, texPng) {
  const nv = (quads + 1) * (quads + 1), nt = quads * quads * 2;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(nt * 3);
  const size = 3;   // metres across
  for (let j = 0; j <= quads; j++) for (let i = 0; i <= quads; i++) {
    const v = j * (quads + 1) + i, x = (i / quads - 0.5) * size, z = (j / quads - 0.5) * size, y = 0.25 * Math.sin(x * 5) * Math.cos(z * 4) + 0.5;
    pos.set([x, y, z], v * 3); nor.set([0, 1, 0], v * 3); uv.set([i / quads, 1 - j / quads], v * 2);
  }
  let k = 0;
  for (let j = 0; j < quads; j++) for (let i = 0; i < quads; i++) { const a = j * (quads + 1) + i, b = a + 1, c = a + quads + 1, d = c + 1; idx.set([a, c, b, b, c, d], k); k += 6; }
  const pad = n => (4 - (n % 4)) % 4;
  const parts = [Buffer.from(pos.buffer), Buffer.from(nor.buffer), Buffer.from(uv.buffer), Buffer.from(idx.buffer), texPng];
  const views = []; let off = 0; const bins = [];
  for (const [i, b] of parts.entries()) { views.push({ buffer: 0, byteOffset: off, byteLength: b.length }); bins.push(b, Buffer.alloc(pad(b.length))); off += b.length + pad(b.length); }
  let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9]; for (let i = 0; i < nv; i++) for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], pos[i * 3 + c]); max[c] = Math.max(max[c], pos[i * 3 + c]); }
  const json = { asset: { version: '2.0', generator: 'tools/perf.mjs' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'heavy' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.8 } }], textures: [{ source: 0, sampler: 0 }], samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    images: [{ bufferView: 4, mimeType: 'image/png' }],
    accessors: [{ bufferView: 0, componentType: 5126, count: nv, type: 'VEC3', min, max }, { bufferView: 1, componentType: 5126, count: nv, type: 'VEC3' }, { bufferView: 2, componentType: 5126, count: nv, type: 'VEC2' }, { bufferView: 3, componentType: 5125, count: nt * 3, type: 'SCALAR' }],
    bufferViews: views, buffers: [{ byteLength: off }] };
  const jb = Buffer.from(JSON.stringify(json)), jp = Buffer.concat([jb, Buffer.alloc(pad(jb.length), 0x20)]), bin = Buffer.concat(bins);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jp.length + 8 + bin.length, 8);
  const ch = (t, d) => { const b = Buffer.alloc(8); b.writeUInt32LE(d.length, 0); b.writeUInt32LE(t, 4); return Buffer.concat([b, d]); };
  return Buffer.concat([head, ch(0x4e4f534a, jp), ch(0x004e4942, bin)]);
}
function makeHeavy(dir) {
  const d = path.join(dir, 'scenes', 'heavy'); fs.mkdirSync(d, { recursive: true });
  const src = path.join(ROOT, 'tools/studio/test/scenes/test');
  for (const f of ['box.glb', 'tone.wav', 'figure.fbx', 'figure.png']) fs.copyFileSync(path.join(src, f), path.join(d, f));
  fs.writeFileSync(path.join(d, 'heavy.glb'), heavyGlb(447, png(4096, 4096)));   // 447 x 447 x 2 = 399,618 triangles
  const L = { studio: 1, scene: 'heavy', saved: new Date().toISOString(), objects: [], cubes: [], sounds: [], shapes: [], empties: [], screens: [], paintings: [], settings: {} };
  let n = 0; const id = () => 'p' + String(++n).padStart(5, '0');
  L.objects.push({ id: id(), name: 'Heavy', file: 'heavy.glb', p: [0, 0, -3], q: [0, 0, 0, 1], s: 1, light: 'lit', clip: '', anim: 'off', start: 'always' });
  const boxes = [];
  for (let i = 0; i < 15; i++) { const b = { id: id(), name: 'Box ' + i, file: 'box.glb', p: [-3 + (i % 5) * 1.5, 0.25, -1 - Math.floor(i / 5) * 1.2], q: [0, 0, 0, 1], s: 1, light: 'lit', clip: 'Spin', anim: 'loop', start: 'always' }; if (i % 4 === 0) b.motion = { kind: 'spin', speed: 20 }; boxes.push(b); L.objects.push(b); }
  L.objects.push({ id: id(), name: 'Figure', file: 'figure.fbx', p: [1, 0, -2], q: [-0.7071, 0, 0, 0.7071], s: 0.01, light: 'lit', clip: 'Take 001', anim: 'loop', start: 'always' });
  for (let i = 0; i < 6; i++) L.cubes.push({ id: id(), name: 'Cube ' + i, p: [-3 + i * 1.2, 1, 1.5], yaw: 0, size: [1, 2, 1], mode: i % 2 ? 'stay' : 'while', show: [boxes[i].id], hide: [boxes[i + 6].id] });
  const sh = ['cube', 'sphere', 'cylinder', 'plane'];
  for (let i = 0; i < 8; i++) L.shapes.push({ id: id(), name: 'Shape ' + i, shape: sh[i % 4], p: [-2 + i * 0.6, 0.5, 2.5], q: [0, 0, 0, 1], size: [0.4, 0.4, 0.4], colour: '#7aa2ff', look: i === 7 ? 'hide' : 'colour' });
  for (let i = 0; i < 4; i++) L.sounds.push({ id: id(), name: 'Tone ' + i, file: 'tone.wav', p: [-1 + i, 1.2, -1], vol: 0.5, r: 1.5, loop: true, start: 'always' });
  for (let i = 0; i < 3; i++) L.empties.push({ id: id(), name: 'Empty ' + i, p: [i, 1.2, 0], q: [0, 0, 0, 1] });
  L.screens.push({ id: id(), name: 'Player', p: [2, 1.2, -1], q: [0, 0, 0, 1], w: 1, look: 'audio', list: ['tone.wav'], loop: 'all', vol: 0.5, r: 3 });
  const strokes = [];
  for (let s = 0; s < 3; s++) { const k = []; for (let i = 0; i < 1000; i++) { const t = i / 1000 * 6.28; k.push([+(Math.cos(t * 3 + s) * 0.4).toFixed(3), +(0.8 + Math.sin(t) * 0.3 + s * 0.15).toFixed(3), +(Math.sin(t * 3 + s) * 0.4).toFixed(3), 0.8]); } strokes.push({ b: 'tube', c: '#ff7a59', w: 0.01, k, sd: 1 }); }
  L.paintings.push({ id: id(), name: 'Painting', p: [-2, 0, -1], q: [0, 0, 0, 1], s: 1, strokes });
  fs.writeFileSync(path.join(d, 'layout.json'), JSON.stringify(L));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/studio/scan.mjs'), path.join(dir, 'scenes')], { encoding: 'utf8' });
  if (r.status) throw new Error('scan.mjs: ' + (r.stderr || r.stdout));
  return { items: n, tris: 399618 };
}

// ------------------------------------------------------------------------------------------------ a small server --
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.fbx': 'application/octet-stream', '.txt': 'text/plain' };
function serve(extra) {
  return new Promise(res => {
    const srv = http.createServer((q, s) => {
      let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const base = p.startsWith('/__perf/') ? extra : ROOT, rel = p.startsWith('/__perf/') ? p.slice(8) : p;
      const f = path.normalize(path.join(base, rel));
      if (!f.startsWith(base) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
      const st = fs.statSync(f), type = MIME[path.extname(f)] || 'application/octet-stream', rg = /bytes=(\d*)-(\d*)/.exec(q.headers.range || '');
      if (rg) { const a = rg[1] ? +rg[1] : 0, b = rg[2] ? Math.min(+rg[2], st.size - 1) : st.size - 1; s.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${a}-${b}/${st.size}`, 'content-length': b - a + 1, 'cache-control': 'no-store' }); fs.createReadStream(f, { start: a, end: b }).pipe(s); return; }
      s.writeHead(200, { 'content-type': type, 'content-length': st.size, 'accept-ranges': 'bytes', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(s);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

// ----------------------------------------------------------------------------------------------------- the scenes --
const PW = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chromium = PW.chromium || (PW.default && PW.default.chromium);
let base = POS[0] || '', srv = null, heavyDir = '', heavyInfo = null;
if (!base) {
  heavyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-'));
  try { heavyInfo = makeHeavy(heavyDir); } catch (e) { console.error('heavy scene not made: ' + e.message); }
  srv = await serve(heavyDir); base = `http://127.0.0.1:${srv.address().port}/`;
} else if (!base.endsWith('/')) base += '/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
const results = [], pageErrors = new Map();

async function open(fake) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 400 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('collabAutoWelcome', 'off'); localStorage.setItem('collabAutoAll', 'off'); } catch (e) { /* blocked */ } });
  await ctx.addInitScript(fake === 'occl' ? OCC_SRC.replace(/^function OCCL_FAKE\(\) \{/, '(function () {').replace(/\}\s*$/, '})();') : FPS_SRC.replace(/^function FPS_FAKE\(\) \{/, '(function () {').replace(/\}\s*$/, '})();'));
  await ctx.addInitScript(PERF_LIB);
  const page = await ctx.newPage(); page.setDefaultTimeout(180000);
  page.on('pageerror', e => { const k = String(e.message).slice(0, 160); pageErrors.set(k, (pageErrors.get(k) || 0) + 1); });
  return { page, ctx, close: () => ctx.close().catch(() => 0) };
}
const pk = (page, s) => page.evaluate(s => HOST.cur.peek(s), s);
async function gotoPage(page, hash, key) {
  await page.goto('about:blank'); await page.goto(base + 'index.html#' + hash);
  await page.waitForFunction(k => typeof HOST !== 'undefined' && HOST.curKey === k && HOST.cur && HOST.cur.collab.scene(), key, { timeout: 240000 });
}
async function session(page, mode = 'immersive-vr', warm = 30) {
  const fake = await page.evaluate(() => (window.__occl ? 'occl' : 'fp'));
  await page.evaluate(m => HOST.cur.peek('xrStart(' + JSON.stringify(m) + ')'), mode);
  await page.waitForFunction(() => { const F = window.__fp || window.__occl; return F.session && F.session.cbs.size && HOST.session === F.session; }, null, { timeout: 60000 });
  await page.evaluate(n => window.__perf.observe(n * 12), warm);
  return fake;
}
const meas = (page, n = N, o) => page.evaluate(([n, o]) => window.__perf.measure(n, o), [n, o || null]);
const warm = (page, ms = 400) => page.evaluate(ms => window.__perf.observe(ms), ms);
const wanted = id => !ONLY.length || ONLY.some(w => id.includes(w));
const add = (id, m, extra) => { results.push({ id, m, ...extra }); console.log('done ' + id + (m ? `  js ${f1(m.js.mean)}/${f1(m.js.max)} ms, ${f0(m.calls.mean)} draws, ${f0(m.tris.mean / 1000)}k tris` : '  (' + (extra && extra.note) + ')')); };
async function scene(id, fn) {
  if (!wanted(id)) return;
  try { await fn(); } catch (e) { add(id, null, { note: 'failed: ' + String(e.message).split('\n')[0].slice(0, 300) }); }
}
async function group(ids, fn) {   // a page shared by several scenes: runs when any of them is wanted
  if (!ids.some(wanted)) return;
  try { await fn(); } catch (e) { for (const id of ids) if (wanted(id) && !results.some(r => r.id === id)) add(id, null, { note: 'failed: ' + String(e.message).split('\n')[0].slice(0, 300) }); }
}

const keys = await (async () => { const { page, close } = await open('fp'); await page.goto(base + 'index.html'); await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.list && HOST.list.length, null, { timeout: 60000 }); const k = await page.evaluate(() => HOST.list.map(s => s.key)); await close(); return k; })();
if (flag('--list')) { console.log('stories: ' + keys.join(', ')); await browser.close(); if (srv) srv.close(); process.exit(0); }

// ---- every story: story mode at 25, 50 and 75 % (playing), explore mode
for (const key of keys) {
  const ids = ['story:' + key + ':25%', 'story:' + key + ':50%', 'story:' + key + ':75%', 'story:' + key + ':explore'];
  await group(ids, async () => {
    const { page, close } = await open('fp');
    try {
      await gotoPage(page, key + '&slides=off', key); await session(page);
      const T = await pk(page, 'typeof T_END === "number" ? T_END : 0');
      for (const f of [0.25, 0.5, 0.75]) {
        const id = 'story:' + key + ':' + Math.round(f * 100) + '%';
        await scene(id, async () => {
          await pk(page, `(APP.mode !== 'story' && APP.enterStory(0), APP.seek(${T * f}), APP.playing = true, 0)`); await warm(page, 500);
          const m = await meas(page); add(id, m, { story: key, t: T * f, len: T });
        });
      }
      await scene('story:' + key + ':explore', async () => {
        await pk(page, '(APP.enterExplore(), 0)'); await warm(page, 500);
        add('story:' + key + ':explore', await meas(page), { story: key });
      });
    } finally { await close(); }
  });
}

// ---- the design room and the studio
await group(['design:room'], async () => {
  const { page, close } = await open('fp');
  try { await gotoPage(page, 'design', 'design'); await session(page); await warm(page, 800); add('design:room', await meas(page)); } finally { await close(); }
});
async function studioScenes(prefix, hash, ready, label) {
  const ids = [prefix + ':viewing', prefix + ':editing'];
  await group(ids, async () => {
    const { page, close } = await open('fp');
    try {
      await gotoPage(page, hash, 'studio');
      await page.waitForFunction(() => HOST.cur.peek('STUDIO.ready()'), null, { timeout: 300000 });
      await session(page); await warm(page, 1000);
      await scene(prefix + ':viewing', async () => add(prefix + ':viewing', await meas(page), { note: label }));
      await scene(prefix + ':editing', async () => {
        await pk(page, `(setEdit(true), select(${JSON.stringify(ready)}), 0)`); await warm(page, 800);
        add(prefix + ':editing', await meas(page), { note: label });
      });
    } finally { await close(); }
  });
}
await studioScenes('studio:test', 'studio&scenes=tools/studio/test/scenes&scene=test', 'box001', 'the committed test scene');
if (heavyInfo) await studioScenes('studio:heavy', 'studio&scenes=__perf/scenes&scene=heavy', 'p00001', `a 399,618-triangle model with a 4,096 px texture and ${heavyInfo.items - 1} more items (boxes, figure, cubes, shapes, sounds, empties, an audio screen, a painting of 3,000 points)`);
else for (const id of ['studio:heavy:viewing', 'studio:heavy:editing']) if (wanted(id)) add(id, null, { note: 'needs the tool\'s own server (no url given)' });
await group(['studio:bliss-vr', 'studio:bliss-ar'], async () => {
  const { page, close } = await open('fp');
  try {
    await gotoPage(page, 'studio&scenes=examples&scene=bliss-xp', 'studio');
    await page.waitForFunction(() => HOST.cur.peek('STUDIO.ready()'), null, { timeout: 300000 });
    await session(page); await warm(page, 1500);
    await scene('studio:bliss-vr', async () => add('studio:bliss-vr', await meas(page), { note: 'example scene as placed (VR)' }));
    await scene('studio:bliss-ar', async () => {
      await pk(page, `(STUDIO.sess('ar'), STUDIO.walls([{ a: [-1.5, -1.75], b: [1.5, -1.75], y0: 0, y1: 2.5 }, { a: [1.5, -1.75], b: [1.5, 1.75], y0: 0, y1: 2.5 }, { a: [1.5, 1.75], b: [-1.5, 1.75], y0: 0, y1: 2.5 }, { a: [-1.5, 1.75], b: [-1.5, -1.75], y0: 0, y1: 2.5 }]), 0)`);
      await warm(page, 3000); add('studio:bliss-ar', await meas(page), { note: 'AR kind and pretend 3 x 3.5 m walls (the session itself is VR: no passthrough, no depth)' });
    });
  } finally { await close(); }
});

// ---- a room on this device with every story's station
await group(['room:lobby', 'room:station', 'room:station+6people'], async () => {
  const { page, close } = await open('fp');
  try {
    await gotoPage(page, 'airports&s=LCL&peer=off', 'airports');
    await page.waitForFunction(() => HOST.collab.code === 'LCL' && HOST.collab.local && HOST.collab.status === 'open', null, { timeout: 60000 });
    await page.evaluate(() => { const c = HOST.collab; c.arrange({ x: 0, z: 0, yaw: 0 }); c.add('design', { x: -3.2, z: 1.0, yaw: 0 }); c.add('studio', { x: 3.2, z: 1.0, yaw: 0 }); c.add('all', { x: -1.6, z: 2.2, yaw: Math.PI }); c.add('lobby', { x: 8, z: 8, yaw: 0 }); });
    await page.waitForFunction(() => HOST.collab.stations().length === HOST.list.length + 4 && !HOST.collab.internals().pending.size, null, { timeout: 30000 });
    await session(page);
    await page.waitForFunction(() => { window.__perf.observe(300); return HOST.room.aligned; }, null, { timeout: 60000, polling: 500 }).catch(() => 0);
    await page.evaluate(() => window.__perf.observe(2500));
    await scene('room:lobby', async () => add('room:lobby', await meas(page), { note: 'every station, no live station (airports loaded, away)', away: await page.evaluate(() => HOST.room.away()) }));
    await scene('room:station', async () => {
      // a station of the airports story where the head stands, circles walked into, not asked first
      const id = await page.evaluate(() => { HOST.collab.askDefault(false); HOST.collab.add('airports', { x: 0, z: 0, yaw: 0 }); return HOST.collab.stations().filter(x => x.story === 'airports').map(x => x.id).join(); });
      await page.evaluate(() => window.__perf.observe(3500));
      add('room:station', await meas(page), { note: 'at the airports station, the others as icons', live: await page.evaluate(() => HOST.collab.internals().live), stationIds: id });
    });
    await scene('room:station+6people', async () => {
      await page.evaluate(() => {
        const C = HOST.collab.internals(), F = window.__fp, st = C.live;
        for (let i = 0; i < 6; i++) { const id = 'zz-p' + i; if (!C.members.some(m => m.id === id)) C.members.push({ id, name: 'Person ' + i, color: '#' + ['ff8a65', '4dd0e1', 'aed581', 'ba68c8', 'ffd54f', '90a4ae'][i], kind: 'vr', here: true }); }
        F.onFrame = () => { for (let i = 0; i < 6; i++) { const a = performance.now() / 1000 + i; C.pres.set('zz-p' + i, { id: 'zz-p' + i, st, at: performance.now(), head: [Math.cos(a) * 1.5, 1.6, -2 + Math.sin(a), 0, Math.sin(a / 2), 0, Math.cos(a / 2)], hands: [[0.3 + Math.cos(a), 1.2, -1.8, 0, 0, 0, 1, 0.3 + Math.cos(a), 1.2, -3]] }); } };
      });
      await page.evaluate(() => window.__perf.observe(2000));
      add('room:station+6people', await meas(page), { note: 'six pretend people at the station, presence fed every frame', people: await page.evaluate(() => HOST.collab.internals().members.length) });
    });
  } finally { await close(); }
});

// ---- the shell: the menu on each tab, the frame-rate read-out, subtitles, a spaceship
await group(['shell:menu:story', 'shell:menu:settings', 'shell:menu:circles', 'shell:menu:debug', 'shell:fps-readout', 'shell:subtitles', 'shell:spaceship'], async () => {
  const { page, close } = await open('fp');
  try {
    await gotoPage(page, 'qubits&slides=off', 'qubits'); await session(page);
    const T = await pk(page, 'T_END');
    await pk(page, `(APP.seek(${T * 0.4}), APP.playing = true, 0)`); await warm(page, 500);
    for (const tab of ['story', 'settings', 'circles', 'debug']) await scene('shell:menu:' + tab, async () => {
      await page.evaluate(t => { HOST.collab.panelOpen(true); HOST.collab.menuIdle(1e9); HOST.collab.menuTab(t); }, tab); await warm(page, 800);
      add('shell:menu:' + tab, await meas(page), { note: 'qubits story playing, the menu open on ' + tab });
    });
    await page.evaluate(() => HOST.collab.panelOpen(false)); await warm(page, 300);
    await scene('shell:fps-readout', async () => { await page.evaluate(() => HOST.xr.setFps(true)); await warm(page, 1200); add('shell:fps-readout', await meas(page), { note: 'qubits playing, the frame-rate read-out on' }); await page.evaluate(() => HOST.xr.setFps(false)); });
    await scene('shell:subtitles', async () => { await page.evaluate(() => HOST.xr.setSubs(true)); await warm(page, 1200); add('shell:subtitles', await meas(page), { note: 'qubits playing, subtitles on' }); await page.evaluate(() => HOST.xr.setSubs(false)); });
    await scene('shell:spaceship', async () => {
      await page.evaluate(() => { HOST.ships.debug.place([0, 1.5, 0], 0, 0); HOST.ships.launch(true); }); await warm(page, 1500);
      const s = await page.evaluate(() => { const x = HOST.ships.state(); return { flying: x.flying, drones: (x.drones || []).length, targets: (x.targets || []).length }; });
      add('shell:spaceship', await meas(page), { note: 'qubits playing, a ship flying with drones and targets', ship: s });
      await page.evaluate(() => HOST.ships.launch(false));
    });
  } finally { await close(); }
});

// ---- real-world occlusion in AR (the pretend depth texture and room planes of smoke.mjs's occlusion steps)
await group(['shell:occlusion-both', 'shell:occlusion-off'], async () => {
  const { page, close } = await open('occl');
  try {
    await gotoPage(page, 'airports&labels=hidden&cards=hidden', 'airports'); await session(page, 'immersive-ar', 20);
    await page.evaluate(() => window.__occl.step(8));
    await scene('shell:occlusion-both', async () => add('shell:occlusion-both', await meas(page, N), { note: 'AR, depth (people) and the pretend room planes, airports story', occ: await page.evaluate(() => { const s = HOST.occlusion.state(); return { mode: s.mode, parts: s.parts || null }; }) }));
    await scene('shell:occlusion-off', async () => { await page.evaluate(() => HOST.occlusion.set('off')); await page.evaluate(() => window.__occl.step(8)); add('shell:occlusion-off', await meas(page, N), { note: 'AR, occlusion set to nothing (same story)' }); });
  } finally { await close(); }
});

// ---- left behind: what a story, the studio or a headset away from every station still does
const lbNote = [];
async function lb(id, fn) {
  if (!wanted(id)) return;
  try { const found = []; const data = await fn(found); results.push({ id, m: null, lb: { found, data } }); console.log('done ' + id + ' (' + found.length + ' findings)'); }
  catch (e) { add(id, null, { note: 'failed: ' + String(e.message).split('\n')[0].slice(0, 300) }); }
}
await lb('left-behind:story-hops', async found => {
  const { page, close } = await open('fp');
  try {
    // a baseline: airports alone
    await gotoPage(page, 'airports', 'airports'); await session(page, 'immersive-vr', 20);
    await page.evaluate(() => window.__perf.observe(1500));
    const base0 = await page.evaluate(() => window.__perf.snap()), obs0 = await page.evaluate(() => window.__perf.observe(2000, null, true));
    await page.evaluate(() => { window.__A = HOST.cur; });
    const hops = ['flock', 'pass', 'lbi', 'airports'], data = { baseline: { ...base0, obs: obs0 }, hops: [] };
    let prev = 'airports';
    for (const k of hops) {
      await page.evaluate(([k]) => { window.__prevStory = HOST.cur; window.__prevT = HOST.cur.peek('APP.t'); HOST.go(k); }, [k]);
      await page.waitForFunction(k => HOST.curKey === k && HOST.cur && HOST.cur.collab.scene(), k, { timeout: 240000 });
      await page.evaluate(() => window.__perf.observe(1500));
      const snap = await page.evaluate(() => window.__perf.snap());
      const left = await page.evaluate(() => { const A = window.__prevStory; try { return { appT: A.peek('APP.t'), appT0: window.__prevT, children: A.peek('GL.scene.children.length'), gone: A.peek('LOAD.gone') }; } catch (e) { return { err: String(e.message) }; } });
      const obs = await page.evaluate(() => window.__perf.observe(2000, null, true));
      const later = await page.evaluate(() => { const A = window.__prevStory; try { return { appT: A.peek('APP.t'), children: A.peek('GL.scene.children.length') }; } catch (e) { return null; } });
      data.hops.push({ from: prev, to: k, snap, left, later, obs }); prev = k;
      const hop = data.hops[data.hops.length - 1];
      if (left.appT0 !== undefined && later && later.appT !== left.appT0) found.push(`story ${hop.from}'s clock still moved after leaving it for ${k} (APP.t ${left.appT0} -> ${later.appT})`);
      if (obs.audioNodesPerSec > 20) found.push(`in ${k}, idle, ${f0(obs.audioNodesPerSec)} Web Audio nodes are created a second (${(obs.top || []).slice(0, 2).join(' ; ')}); check what makes them and that they are disconnected`);
    }
    // the studio, then back to airports
    const fin = await page.evaluate(() => window.__perf.snap()), obs = await page.evaluate(() => window.__perf.observe(2000, null, true));
    data.final = { ...fin, obs };
    for (const key of ['geo', 'tex', 'prog']) if (fin[key] > base0[key]) found.push(`after flock, pass, lbi and back to airports renderer.info.memory/programs ${key} = ${fin[key]} against ${base0[key]} for airports alone (+${fin[key] - base0[key]})`);
    if (fin.listeners - base0.listeners > 20) found.push(`net event listeners ${fin.listeners} against ${base0.listeners} for airports alone (+${fin.listeners - base0.listeners}) after four story changes`);
    if (fin.intervals.length > base0.intervals.length) found.push(`intervals still running: ${fin.intervals.length} against ${base0.intervals.length}: ` + fin.intervals.filter(x => !base0.intervals.includes(x)).join(' ; '));
    if (fin.mediaPlaying) found.push(fin.mediaPlaying + ' media elements still playing');
    if (obs.timeoutsPerSec > obs0.timeoutsPerSec * 1.5 + 5) found.push(`timeouts a second ${f0(obs.timeoutsPerSec)} against ${f0(obs0.timeoutsPerSec)} for airports alone`);
    if (obs0.timeoutsPerSec > 40) found.push(`airports alone in a headset session: ${f0(obs0.timeoutsPerSec)} setTimeouts a second: ${(obs0.top || []).filter(x => /timeout/.test(x)).slice(0, 3).join(' ; ')}`);
    return data;
  } finally { await close(); }
});
await lb('left-behind:studio-leave', async found => {
  const { page, close } = await open('fp');
  try {
    await gotoPage(page, 'studio&scenes=tools/studio/test/scenes&scene=test', 'studio');
    await page.waitForFunction(() => HOST.cur.peek('STUDIO.ready()'), null, { timeout: 240000 });
    await session(page, 'immersive-vr', 20); await page.evaluate(() => window.__perf.observe(2000));
    const inside = await page.evaluate(() => ({ ...window.__perf.snap(), items: HOST.cur.peek('STU.items.size') }));
    await page.evaluate(() => { window.__S = HOST.cur; HOST.go('airports'); });
    await page.waitForFunction(() => HOST.curKey === 'airports' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 240000 });
    await page.evaluate(() => window.__perf.observe(1500));
    const after = await page.evaluate(() => { const S = window.__S, o = { ...window.__perf.snap() }; try { o.items = S.peek('STU.items.size'); o.children = S.peek('GL.scene.children.length'); o.mixers = S.peek('[...STU.items.values()].filter(i => i.mixer || i.actions).length'); o.emitters = S.peek('[...STU.items.values()].filter(i => i.panner || i.src || i.gain).length'); } catch (e) { o.err = String(e.message); } return o; });
    const obs = await page.evaluate(() => window.__perf.observe(2000, null, true));
    if (after.mediaPlaying) found.push(after.mediaPlaying + ' media elements (sounds or screens) still playing after leaving the studio');
    if (after.eventSources) found.push(after.eventSources + ' EventSources still open after leaving the studio');
    if (after.geo > 13 || after.tex > 4 || after.prog > 11) found.push(`renderer.info after leaving the studio for airports: ${after.geo} geometries, ${after.tex} textures, ${after.prog} programs (airports alone: about 12, 4, 10)`);
    if (after.intervals.length > inside.intervals.length) found.push('intervals left by the studio: ' + after.intervals.filter(x => !inside.intervals.includes(x)).join(' ; '));
    if (obs.timeoutsPerSec > 60) found.push(`after leaving the studio: ${f0(obs.timeoutsPerSec)} timeouts a second (${(obs.top || []).slice(0, 3).join(' ; ')})`);
    return { inside, after, obs };
  } finally { await close(); }
});
for (const [key, label] of [['flock', 'a live simulation (flock)'], ['airports', 'airports'], ['studio', 'the studio test scene']]) {
  await lb('left-behind:away:' + key, async found => {
    const { page, close } = await open('fp');
    try {
      const hash = key === 'studio' ? 'studio&scenes=tools/studio/test/scenes&scene=test&s=LCL&peer=off' : key + '&s=LCL&peer=off';
      await gotoPage(page, hash, key);
      await page.waitForFunction(() => HOST.collab.code === 'LCL' && HOST.collab.local && HOST.collab.status === 'open', null, { timeout: 60000 });
      if (key === 'studio') await page.waitForFunction(() => HOST.cur.peek('STUDIO.ready()'), null, { timeout: 20000 }).catch(() => 0);   // (in a room the scene comes from the circle: none here)
      await page.evaluate(() => { const c = HOST.collab; c.arrange({ x: 0, z: 0, yaw: 0 }); });
      await session(page, 'immersive-vr', 20);
      await page.evaluate(() => window.__perf.observe(3000));
      const away = await page.evaluate(() => HOST.room.away());
      // count what still runs: the story's per-frame hook and every set's update
      await page.evaluate(() => {
        const W = window.__calls = { xrUpdate: 0, sets: 0, frames: 0 };
        try { HOST.cur.peek('(xrUpdate = (o => function (S) { window.__calls.xrUpdate++; return o.apply(this, arguments); })(xrUpdate), 0)'); } catch (e) { /* no xrUpdate */ }
        try { const S = HOST.cur.peek('typeof GL.sets === "object" ? GL.sets : null'); if (S) for (const k in S) { const u = S[k].update; if (u) S[k].update = function () { W.sets++; return u.apply(this, arguments); }; } } catch (e) { /* none */ }
      });
      const m = await meas(page, 90);
      const c = await page.evaluate(() => ({ ...window.__calls }));
      const obs = await page.evaluate(() => window.__perf.observe(2000, null, true));
      if (!away) found.push(`${label}: the headset was not away from every station in this test (HOST.room.away() false), so the numbers are those of a loaded story`);
      if (away && c.xrUpdate > 3) found.push(`${label}: away from every station for 3 s, xrUpdate still ran ${c.xrUpdate} times in 90 frames`);
      if (away && c.sets > 3) found.push(`${label}: away from every station, set updates still ran ${c.sets} times in 90 frames`);
      if (away && m.js.mean > 0.6) found.push(`${label}: away from every station each frame still costs ${f1(m.js.mean)} ms of script (${f0(m.calls.mean)} draws, ${f0(m.tris.mean)} triangles)`);
      if (away && obs.timeoutsPerSec > 60) found.push(`${label}: away, ${f0(obs.timeoutsPerSec)} timeouts a second (${(obs.top || []).slice(0, 3).join(' ; ')})`);
      if (away && m.scene.visible > 400) found.push(`${label}: away, ${m.scene.visible} visible scene objects are still walked/drawn`);
      return { away, calls: c, m: { js: m.js, render: m.render, calls: m.calls, tris: m.tris, scene: m.scene }, obs, intervals: await page.evaluate(() => window.__perf.snap().intervals) };
    } finally { await close(); }
  });
}

// ---- story change hitch
for (const key of ['lbi', 'nmd', 'soil']) {
  const id = 'hitch:' + key;
  if (!wanted(id)) continue;
  const { page, close } = await open('fp');
  try {
    await gotoPage(page, 'flock', 'flock'); await session(page, 'immersive-vr', 20);
    await page.evaluate(() => window.__perf.observe(1000));
    const r = await page.evaluate(async key => {
      const P = window.__perf, F = window.__fp; P.long.length = 0;
      HOST.go(key);
      const t0 = performance.now(); let last = t0, worst = 0, n = 0, longest = 0;
      while (performance.now() - t0 < 240000) {
        const a = performance.now(); F.step(1); const b = performance.now();
        worst = Math.max(worst, a - last); longest = Math.max(longest, b - a); last = b; n++;
        if (HOST.curKey === key && HOST.cur && HOST.cur.collab.scene()) break;
        await new Promise(r => setTimeout(r, 0));
      }
      let steps = []; try { steps = HOST.cur.peek('LOAD.ms').slice().sort((a, b) => b[1] - a[1]).slice(0, 4); } catch (e) { /* none */ }
      return { worstGap: worst, longStep: longest, longTask: Math.max(0, ...P.long), frames: n, steps, total: performance.now() - t0 };
    }, key);
    results.push({ id, m: null, hitch: r }); console.log('done ' + id + `  worst gap ${f0(r.worstGap)} ms`);
  } catch (e) { add(id, null, { note: 'failed: ' + String(e.message).split('\n')[0].slice(0, 300) }); } finally { await close(); }
}

await browser.close();
if (srv) srv.close();
if (heavyDir) fs.rmSync(heavyDir, { recursive: true, force: true });
const out = { at: new Date().toISOString(), frames: N, base: POS[0] ? 'given' : 'self-served', pageErrors: [...pageErrors].map(([k, n]) => k + ' x' + n), results };
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(out));
const md = report(results);
if (MD_OUT) fs.writeFileSync(MD_OUT, md + '\n');
console.log('\n' + md);
if (pageErrors.size) console.log('\npage errors (' + pageErrors.size + ' kinds):\n' + [...pageErrors].map(([k, n]) => '  ' + k + ' x' + n).join('\n'));
