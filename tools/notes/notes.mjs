#!/usr/bin/env node
// The developer notebook's tool: list, pull, transcribe and finish notes on the relay, read run logs (perf) and the
// performance run's results (perfrun: one as Markdown, or two compared)
// (tools/notes/SPEC.md).
// NOTES_RELAY (default the test place) and NOTES_TOKEN (the relay's password; never printed or written).
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RELAY = (process.env.NOTES_RELAY || 'https://stories.lab.lbi-netmed.com').replace(/\/+$/, '');
const TOKEN = process.env.NOTES_TOKEN || '';
const HERE = dirname(fileURLToPath(import.meta.url));
const die = (m) => { console.error(m); process.exit(1); };

async function call(path, body, raw, soft) {
  let r;
  const go = () => fetch(RELAY + path, { method: body ? 'POST' : 'GET', headers: { ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  // a connection kept idle through a long transcription may have been closed: try once more
  try { try { r = await go(); } catch (e) { r = await go(); } }
  catch (e) { die('Could not reach ' + RELAY + ': ' + e.message); }
  if (r.status === 401) die('The relay wants its password: set NOTES_TOKEN.');
  if (r.status === 404) { if (soft) return null; die('Not found (or this relay keeps no notes): ' + path); }
  if (!r.ok) die('The relay answered ' + r.status + ' for ' + path);
  return raw ? Buffer.from(await r.arrayBuffer()) : r.json();
}

const mmss = (s) => { s = Math.max(0, Math.round(+s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
// a pin's t is seconds from the recording's start; the audio began off seconds later (a slow microphone), so its place in the audio is t - off
const aoff = (d) => (d.audio && typeof d.audio.off === 'number' ? d.audio.off : 0);
const at = (p, off) => Math.max(0, (+p.t || 0) - off);
function pinText(p, off = 0) {
  const h = p.hit || {}, e = p.el; let w = '';
  if (h.kind === 'shell') w = 'the ' + (h.what || 'shell') + (h.id ? ', ' + h.id : '');
  else if (h.kind === 'panel') w = "the story's " + (h.panel || '') + ' panel';
  else if (h.kind === 'scene') w = 'the scene: ' + (h.path || []).join(' > ');
  else if (h.kind === 'none') w = 'nothing';
  else if (e) w = (e.tag || 'element') + (e.id ? '#' + e.id : '') + (e.text ? ' "' + e.text + '"' : '');
  return 'Pin ' + p.n + ' at ' + mmss(at(p, off)) + ': ' + (w || 'unknown') + (p.x != null ? ' at ' + Math.round(p.x) + ', ' + Math.round(p.y) : '');
}
function markdown(d) {
  const c = d.context || {}, L = [];
  const where = [c.story, c.room && c.room.station && (c.room.station.title || c.room.station.story)].filter(Boolean).join(', ');
  L.push('# Note ' + d.id, '', '- When: ' + new Date(d.at || d.got || 0).toLocaleString(), '- Device: ' + [...new Set([d.kind === 'page' ? '' : d.kind, c.device, c.xr])].filter(Boolean).join(', '), '- Where: ' + (where || 'n/a') + (c.mode ? ' (' + c.mode + ', t ' + c.t + ')' : ''), '- Length: ' + mmss(d.dur) + ', release ' + (c.release || ''), '', '## Transcript', '');
  const off = aoff(d), pins = (d.pins || []).slice().sort((a, b) => a.t - b.t), tr = d.transcript; let pi = 0;
  if (tr && tr.text) {
    const segs = tr.segments && tr.segments.length ? tr.segments : [{ start: 0, text: tr.text }];
    for (const s of segs) { L.push('[' + mmss(s.start) + '] ' + (s.text || '').trim()); while (pi < pins.length && at(pins[pi], off) < (s.end != null ? s.end : s.start + 1e9)) L.push('> ' + pinText(pins[pi++], off)); }
    while (pi < pins.length) L.push('> ' + pinText(pins[pi++], off));
  } else L.push(tr ? '(nothing was heard)' : '(not transcribed yet)');
  if (!d.audio && d.audioErr) L.push('', 'No audio: ' + d.audioErr + '.');
  if (pins.length) { L.push('', '## Pins', ''); for (const p of pins) L.push('- ' + pinText(p, off) + (p.hit && p.hit.ud ? ' ' + JSON.stringify(p.hit.ud) : '')); }
  L.push('', '## Context', '');
  for (const k of ['url', 'ua', 'screen', 'story', 'mode', 'chapter', 'room', 'settings', 'perf']) if (c[k] != null) L.push('- ' + k + ': ' + (typeof c[k] === 'object' ? JSON.stringify(c[k]) : c[k]));
  if (c.state) L.push('- state: ' + (typeof c.state === 'string' ? c.state : JSON.stringify(c.state)).slice(0, 2000));
  if (c.log) L.push('', '## Log (last lines)', '', '```', String(c.log), '```');
  return L.join('\n') + '\n';
}

async function ids(which, all) {
  if (which !== 'new' && which !== 'all') return [which];
  const j = await call('/api/notes');
  return j.notes.filter((n) => which === 'all' || all || n.status !== 'done').map((n) => n.id);
}
// the relay's own id pattern (relay/notes.mjs NOTE_ID): nothing else goes into a path
const NOTE_ID = /^\d{8}-\d{6}-[a-z0-9]{4}$/;
async function pull(id, out) {
  if (!NOTE_ID.test(String(id))) die('Not a note id: ' + JSON.stringify(String(id).slice(0, 60)));
  const d = await call('/api/notes/' + encodeURIComponent(id), null, false, true);
  if (!d) return pullLog(id, out);   // (not a note: a run log, perhaps)
  const dir = join(out, id); mkdirSync(dir, { recursive: true });
  let audio = '';
  if (d.audio !== null && d.audio !== undefined && (d.audio.type || d.audio === true)) {
    const ext = /webm/.test(d.audio.type || '') ? 'webm' : /ogg/.test(d.audio.type) ? 'ogg' : /mp4|m4a/.test(d.audio.type) ? 'm4a' : /mpeg|mp3/.test(d.audio.type) ? 'mp3' : 'webm';
    audio = join(dir, 'audio.' + ext);
    writeFileSync(audio, await call('/api/notes/' + id + '/audio', null, true));
  }
  for (let i = 0; i < (d.shots || []).length; i++) if (d.shots[i] && !d.shots[i].err) writeFileSync(join(dir, 'shot-' + (i + 1) + '.jpg'), await call('/api/notes/' + id + '/shot/' + (i + 1), null, true));
  writeFileSync(join(dir, 'note.json'), JSON.stringify(d, null, 2));
  writeFileSync(join(dir, 'note.md'), markdown(d));
  return { dir, audio, d };
}


// ---- run logs (tools/notes/SPEC.md, "Run logs"): a row a second as a list in the log's cols order, events as { w, ev, ... }
async function getLog(id) {
  if (!NOTE_ID.test(String(id))) die('Not a run id: ' + JSON.stringify(String(id).slice(0, 60)));
  const g = await call('/api/logs/' + encodeURIComponent(id), null, false, true);
  if (!g) die('No such note or run log: ' + id);
  return g;
}
async function pullLog(id, out) {
  const g = await getLog(id), dir = join(out, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'log.json'), JSON.stringify(g));
  writeFileSync(join(dir, 'perf.txt'), perf(g));
  return { dir, audio: '', d: g, log: true };
}
const pad = (v, n, left) => { v = String(v == null ? '' : v); return left ? v.padEnd(n) : v.padStart(n); };
function perf(g) {
  const c = g.cols || [], ix = Object.fromEntries(c.map((k, i) => [k, i])), rows = (g.rows || []).filter(Array.isArray), evs = (g.rows || []).filter(r => !Array.isArray(r));
  const v = (r, k) => (ix[k] === undefined ? null : r[ix[k]]);
  const ctx = g.context || {}, t0 = g.first || (rows[0] ? v(rows[0], 'w') : g.at), L = [];
  const rel = w => mmss(((w || t0) - t0) / 1000);
  L.push('Run ' + g.id + ': ' + new Date(g.at || g.got || 0).toLocaleString() + ', ' + [ctx.device, ctx.browser && 'Quest Browser ' + ctx.browser, ctx.release].filter(Boolean).join(', '),
    mmss(g.first && g.last ? (g.last - g.first) / 1000 : 0) + ', ' + rows.length + ' seconds, ' + evs.length + ' events' + (g.ended ? '' : ' (not ended: still running, or the end was lost)') + (g.missing ? ', parts missing: ' + g.missing.join(' ') : ''), '');
  // per story and chapter, in the order they came
  const groups = new Map();
  for (const r of rows) {
    const k = (v(r, 'story') || '-') + ' ' + (v(r, 'mode') === 'explore' ? 'explore' : v(r, 'ch') == null ? '-' : 'ch ' + v(r, 'ch')) + (v(r, 'xr') ? ' ' + v(r, 'xr') : '');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const chName = (story, ch) => { const e = evs.find(x => x.ev === 'chapter' && x.ch === ch && (!x.story || x.story === story)); return e && e.key ? e.key : ''; };
  L.push(pad('story / chapter', 34, true) + pad('secs', 6) + pad('mean', 7) + pad('p95', 7) + pad('worst', 8) + pad('over%', 7) + pad('js', 6) + pad('maxTri', 10) + pad('maxCalls', 9) + pad('hz', 5) + '  q');
  for (const [k, rs] of groups) {
    let n = 0, sum = 0, over = 0, worst = 0, js = 0, jn = 0, tri = 0, calls = 0;
    const p95s = [], hz = new Set(), q = new Set();
    for (const r of rs) {
      const fn = +v(r, 'n') || 0; n += fn; sum += (+v(r, 'avg') || 0) * fn; over += +v(r, 'over') || 0; worst = Math.max(worst, +v(r, 'max') || 0); p95s.push(+v(r, 'p95') || 0);
      if (v(r, 'js') != null) { js += +v(r, 'js'); jn++; }
      tri = Math.max(tri, +v(r, 'tri') || 0); calls = Math.max(calls, +v(r, 'calls') || 0);
      if (v(r, 'hz')) hz.add(v(r, 'hz')); if (v(r, 'q') !== '' && v(r, 'q') != null) q.add(v(r, 'q'));
    }
    p95s.sort((a, b) => a - b);
    const p95 = p95s[Math.min(p95s.length - 1, Math.ceil(p95s.length * 0.95) - 1)];
    const ch = / ch (\d+)/.exec(k), label = k + (ch ? ' ' + chName(k.split(' ')[0], +ch[1]) : '');
    L.push(pad(label.slice(0, 33), 34, true) + pad(rs.length, 6) + pad(n ? (sum / n).toFixed(1) : '-', 7) + pad(p95.toFixed(1), 7) + pad(worst.toFixed(1), 8) + pad(n ? (100 * over / n).toFixed(1) : '-', 7) +
      pad(jn ? (js / jn).toFixed(1) : '-', 6) + pad(tri, 10) + pad(calls, 9) + pad([...hz].join('/'), 5) + '  ' + [...q].join(','));
  }
  L.push('', 'The 10 worst seconds (by p95; ms):', pad('at', 6) + '  ' + pad('story', 14, true) + pad('t', 8) + pad('ch', 4) + pad('mean', 7) + pad('p95', 7) + pad('worst', 8) + pad('over', 9) + pad('js', 6) + pad('tri', 9) + pad('calls', 6) + '  q  sets');
  for (const r of rows.slice().sort((a, b) => (+v(b, 'p95') || 0) - (+v(a, 'p95') || 0) || (+v(b, 'max') || 0) - (+v(a, 'max') || 0)).slice(0, 10))
    L.push(pad(rel(v(r, 'w')), 6) + '  ' + pad(String(v(r, 'story') || '-').slice(0, 13) + (v(r, 'mode') === 'explore' ? '*' : ''), 14, true) + pad(v(r, 't') == null ? '-' : (+v(r, 't')).toFixed(1), 8) + pad(v(r, 'ch') == null ? '-' : v(r, 'ch'), 4) +
      pad(v(r, 'avg'), 7) + pad(v(r, 'p95'), 7) + pad(v(r, 'max'), 8) + pad(v(r, 'over') + '/' + v(r, 'n'), 9) + pad(v(r, 'js') == null ? '-' : v(r, 'js'), 6) + pad(v(r, 'tri') == null ? '-' : v(r, 'tri'), 9) + pad(v(r, 'calls') == null ? '-' : v(r, 'calls'), 6) + '  ' + (v(r, 'q') || '-') + '  ' + (v(r, 'sets') || ''));
  const shown = evs.filter(e => e.ev !== 'gap' || e.ms > 2000);
  if (shown.length) {
    L.push('', 'Events' + (shown.length > 40 ? ' (the first 40 of ' + shown.length + ')' : '') + ':');
    for (const e of shown.slice(0, 40)) { const o = Object.assign({}, e); delete o.w; delete o.ev; L.push(pad(rel(e.w), 6) + '  ' + e.ev + (Object.keys(o).length ? ' ' + JSON.stringify(o) : '')); }
  }
  L.push('', '(* explore mode. over: frames longer than 1.5 periods of the display\'s rate (hz) of the frames that second. q: automatic quality\'s level, r = the refresh rate stepped down.)');
  return L.join('\n') + '\n';
}

// ---- the performance run (perfrun.js, v228; docs/agents/shell.md "The performance run"): a result is either the JSON a page
// offers (Download JSON: { kind: 'perfrun', info, segs, totals, ... }), or a run log on the relay (or its pulled log.json)
// whose events carry it ('perfrun' once, a 'seg' for each segment, 'perfend'). perfrun <a> prints one as Markdown;
// perfrun <a> <b> compares two (two runs, two headsets), segment by segment
async function perfRunOf(src) {
  let g;
  if (existsSync(src)) { try { g = JSON.parse(readFileSync(src, 'utf8')); } catch (e) { die(src + ': not JSON'); } }
  else g = await getLog(src);
  if (g && g.kind === 'perfrun' && Array.isArray(g.segs)) return Object.assign({ name: g.id || src }, g);
  const evs = (g.rows || []).filter(r => r && !Array.isArray(r)), I = evs.find(e => e.ev === 'perfrun');
  if (!I) die(src + ': no performance run in it (a run log without perfrun events)');
  const segs = evs.filter(e => e.ev === 'seg').map(e => { const o = Object.assign({}, e); delete o.ev; return o; }), end = evs.find(e => e.ev === 'perfend') || {};
  const c = g.context || {};
  return { name: g.id || src, kind: 'perfrun', part: I.part, id: I.id, at: g.at, release: I.release || c.release, dur: end.dur, stopped: end.stopped, batt0: I.batt0, batt1: end.batt1,
    info: Object.assign({}, I, { settings: { fps: I.fps, auto: I.auto, sharp: I.sharp, occl: I.occl, bodies: I.bodies } }), segs, log: g.id };
}
const CUT = 'the headset view ended', NOTFAIL = ['skipped', 'only in AR', 'stopped', CUT];
const segName = g => (g.story || '-') + ' ' + (g.kind === 'chapter' ? 'ch ' + g.key : g.kind === 'load' ? 'load' + (g.story === 'studio' ? ' ' + g.key : '') : g.kind === 'explore' ? 'explore ' + g.key : g.kind === 'hand' ? 'step ' + g.key : g.key);
const cell = v => (v === null || v === undefined || v === '' ? '-' : String(v));
const missPct = g => (g.n ? (100 * (g.miss || 0) / (g.n + (g.miss || 0))).toFixed(1) : '-');
function perfRunFacts(r) {
  const I = r.info || {}, S = I.settings || {};
  return [`- ${r.part === 'hands' ? 'Hands-on test' : 'Run-through'} ${r.id || ''}, ${new Date(r.at || 0).toISOString().slice(0, 16).replace('T', ' ')}, release ${r.release || '?'}, ${r.dur != null ? mmss(r.dur) : '?'}` + (r.stopped ? `, stopped: ${r.stopped}` : '') + (r.log ? `, run log ${r.log}` : ''),
    `- ${[I.device, I.model, I.browser].filter(Boolean).join(', ')}; ${I.xr ? I.xr.toUpperCase() : 'a page'} at ${cell(I.hz)} Hz` + (I.hzHow && I.hzHow !== 'session' ? ` (${I.hzHow})` : '') + (I.hzList ? ` (offers ${I.hzList})` : '') + (I.eyeW ? `, eye ${I.eyeW} x ${I.eyeH}` : '') + (I.fbScale != null ? `, framebuffer ${I.fbScale}` : '') + (I.fov != null ? `, foveation ${I.fov}` : ''),
    `- Settings: automatic quality ${cell(S.auto)}, frame rate read-out ${cell(S.fps)}, sharp text ${cell(S.sharp)}, occlusion ${cell(S.occl)}, bodies ${cell(S.bodies)}; battery ${cell(r.batt0)} % to ${cell(r.batt1)} %`];
}
function perfRunMd(r) {
  const L = ['# Performance run ' + (r.id || r.name), '', ...perfRunFacts(r), ''];
  L.push('| segment | s | frames | mean | p50 | p95 | p99 | worst | missed | miss % | stall | calls | tris k | js | heap MB | q | errs | note |', '|---|' + '---:|'.repeat(16) + '---|');
  for (const g of r.segs) L.push('| ' + [segName(g), cell(g.dur), cell(g.n), cell(g.mean), cell(g.p50), cell(g.p95), cell(g.p99), cell(g.max), cell(g.miss), missPct(g), cell(g.stall), cell(g.calls), g.tri != null ? Math.round(g.tri / 1000) : '-', cell(g.js), cell(g.heap), cell(g.q) + (g.qch ? ' (' + g.qch + ' changes)' : ''), cell(g.errs), [g.why, g.long ? g.long + ' over 1 s' : '', g.load != null ? 'load ' + g.load + ' ms' : '', g.build ? 'build ' + g.build + ' ms' : ''].filter(Boolean).join(', ')].join(' | ') + ' |');
  const ok = r.segs.filter(g => g.n), fr = ok.reduce((a, g) => a + g.n, 0), ms = ok.reduce((a, g) => a + (g.miss || 0), 0), mean = fr ? ok.reduce((a, g) => a + g.mean * g.n, 0) / fr : 0;
  const bad = r.segs.filter(g => g.why && !NOTFAIL.includes(g.why));
  L.push('', `Totals: ${r.segs.length} segments, ${bad.length} failed; ${fr} frames, mean ${mean.toFixed(2)} ms; ${ms} refreshes missed (${fr ? (100 * ms / (fr + ms)).toFixed(1) : '-'} % of them).`);
  const worst = ok.slice().sort((a, b) => (b.miss || 0) / b.n - (a.miss || 0) / a.n || (b.p95 || 0) - (a.p95 || 0)).slice(0, 5);
  if (worst.length) L.push('', 'The five worst (by refreshes missed, then p95): ' + worst.map(g => `${segName(g)} (${missPct(g)} %, p95 ${g.p95} ms)`).join('; ') + '.');
  if (bad.length) L.push('', 'Failed: ' + bad.map(g => `${segName(g)}: ${g.why}`).join('; ') + '.');
  L.push('', '(ms between frames. missed: refreshes of the display with no new frame; miss %: of all refreshes. stall: the longest run of late frames, over 1.5 periods. calls, tris: the story\'s frame, both eyes. q: automatic quality\'s level, r = the refresh rate stepped down.)');
  return L.join('\n') + '\n';
}
// (v229) what makes two runs not comparable, said first; rows matched by kind, story and key, a key that comes twice by
// its turn; a segment cut short by the headset view ending left out of the match (the item went on after it)
const runOpts = r => { const o = r.info && r.info.opts; return typeof o === 'string' ? o : o ? JSON.stringify({ ch: o.ch, full: o.full, ex: o.ex, aq: o.aq, scenes: o.scenes, stories: o.stories }) : ''; };
function perfRunCompare(a, b) {
  const L = ['# Performance runs compared', '', '**A**', ...perfRunFacts(a), '', '**B**', ...perfRunFacts(b), ''];
  const IA = a.info || {}, IB = b.info || {}, SA = IA.settings || {}, SB = IB.settings || {}, warn = [];
  const diff = (what, x, y) => { if (cell(x) !== cell(y)) warn.push(`- **Not alike:** ${what}: A ${cell(x)}, B ${cell(y)}.`); };
  diff('release', a.release, b.release); diff('VR, AR or a page', IA.xr || 'page', IB.xr || 'page'); diff('display rate (Hz)', IA.hz, IB.hz);
  diff('automatic quality', SA.auto, SB.auto); diff('options', runOpts(a), runOpts(b));
  if (warn.length) L.push(...warn, '');
  L.push('| segment | A mean | B mean | A p95 | B p95 | p95 B-A | A miss % | B miss % | A calls | B calls | note |', '|---|' + '---:|'.repeat(9) + '---|');
  const kept = r => r.segs.filter(g => g.why !== CUT), turn = list => { const c = new Map(); return list.map(g => { const k = g.kind + '|' + g.story + '|' + g.key, n = c.get(k) || 0; c.set(k, n + 1); return [k + '#' + n, g]; }); };
  const A = turn(kept(a)), B = new Map(turn(kept(b))), seen = new Set();
  const row = (x, y) => { const d = x && y && x.p95 != null && y.p95 != null ? (y.p95 - x.p95).toFixed(1) : '-'; L.push('| ' + [segName(x || y), cell(x && x.mean), cell(y && y.mean), cell(x && x.p95), cell(y && y.p95), d, x ? missPct(x) : '-', y ? missPct(y) : '-', cell(x && x.calls), cell(y && y.calls), [x && x.why ? 'A: ' + x.why : '', y && y.why ? 'B: ' + y.why : '', !x ? 'only in B' : !y ? 'only in A' : '', x && y && x.hz != null && y.hz != null && x.hz !== y.hz ? `rate A ${x.hz} Hz, B ${y.hz} Hz` : ''].filter(Boolean).join('; ')].join(' | ') + ' |'); };
  for (const [k, g] of A) { seen.add(k); row(g, B.get(k)); }
  for (const [k, g] of B) if (!seen.has(k)) row(null, g);
  const cut = a.segs.length + b.segs.length - kept(a).length - kept(b).length;
  if (cut) L.push('', `(${cut} segments cut short by the headset view ending are left out: their item went on after them.)`);
  return L.join('\n') + '\n';
}

const argv = process.argv.slice(2), cmd = argv[0];
const opt = (n, def) => { const i = argv.indexOf(n); return i > 0 && argv[i + 1] ? argv[i + 1] : def; };
const target = argv[1] && !argv[1].startsWith('--') ? argv[1] : '';
const out = opt('--out', join(tmpdir(), 'notes'));

if (cmd === 'list') {
  const j = await call('/api/notes'), all = argv.includes('--all');
  const rows = j.notes.filter((n) => all || n.status !== 'done');
  if (!rows.length) console.log(all ? 'No notes.' : 'No new notes.');
  for (const n of rows) console.log([n.id, n.status, mmss(n.dur), (n.pins || 0) + ' pins', n.device || n.kind, n.story || '', n.transcript ? '"' + n.transcript.replace(/\s+/g, ' ').slice(0, 80) + '"' : '(not transcribed)'].join('  '));
  // the run logs (a relay older than them answers 404: none)
  const lg = await call('/api/logs', null, false, true);
  for (const g of (lg && lg.logs) || []) console.log([g.id, 'log', mmss(g.dur), g.rows + ' s', g.device || '', (g.stories || []).join(',') || '-', g.ended ? '' : '(not ended)'].join('  '));
} else if (cmd === 'perfrun' && target) {
  const srcs = argv.slice(1).filter((x, i, A) => !x.startsWith('--') && A[i - 1] !== '--md');
  if (srcs.length > 2) die('perfrun takes one result, or two to compare');
  const rs = [];
  for (const s of srcs) rs.push(await perfRunOf(s));
  const md = rs.length === 2 ? perfRunCompare(rs[0], rs[1]) : perfRunMd(rs[0]);
  const to = opt('--md', '');
  if (to) { writeFileSync(to, md); console.log(to); } else process.stdout.write(md);
} else if (cmd === 'perf' && target) {
  process.stdout.write(perf(await getLog(target)));
} else if (cmd === 'pull' && target) {
  for (const id of await ids(target)) { const r = await pull(id, out); console.log(join(r.dir, r.log ? 'perf.txt' : 'note.md')); }
} else if (cmd === 'transcribe' && target) {
  const model = opt('--model', 'small');
  for (const id of await ids(target)) {
    const r = await pull(id, out);
    if (r.log) { console.error(id + ': a run log, nothing to transcribe'); continue; }
    if (!r.audio) { console.error(id + ': no audio, nothing to transcribe'); console.log(join(r.dir, 'note.md')); continue; }
    const py = join(HERE, 'transcribe.py');
    const uv = spawnSync('uv', ['--version'], { stdio: 'ignore' }).status === 0;
    const p = uv ? spawnSync('uv', ['run', py, r.audio, '--model', model], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'inherit'] })
      : spawnSync('python3', ['-I', py, r.audio, '--model', model], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'inherit'] });
    if (p.status !== 0) die(id + ': transcribing failed (is faster-whisper installed? pip install faster-whisper, or use uv).');
    let t; try { t = JSON.parse(p.stdout); } catch (e) { die(id + ': transcribe.py gave no JSON'); }
    const posted = await call('/api/notes/' + encodeURIComponent(id), { transcript: { text: t.text, lang: t.lang, segments: t.segments, by: 'whisper-' + model } });
    writeFileSync(join(r.dir, 'note.json'), JSON.stringify(posted, null, 2));
    writeFileSync(join(r.dir, 'note.md'), markdown(posted));
    console.log(join(r.dir, 'note.md'));
  }
} else if (cmd === 'done' && target) {
  await call('/api/notes/' + encodeURIComponent(target), { status: 'done' });
  console.log(target + ' marked done');
} else {
  die('Usage: node tools/notes/notes.mjs list [--all] | pull <id|new> [--out dir] | transcribe <id|new> [--model small] | done <id> | perf <run id> | perfrun <run id|result.json> [<run id|result.json>] [--md out.md]\nEnvironment: NOTES_RELAY, NOTES_TOKEN');
}
