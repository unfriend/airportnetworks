#!/usr/bin/env node
// The developer notebook's tool: list, pull, transcribe and finish notes on the relay (tools/notes/SPEC.md).
// NOTES_RELAY (default the test place) and NOTES_TOKEN (the relay's password; never printed or written).
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RELAY = (process.env.NOTES_RELAY || 'https://stories.lab.lbi-netmed.com').replace(/\/+$/, '');
const TOKEN = process.env.NOTES_TOKEN || '';
const HERE = dirname(fileURLToPath(import.meta.url));
const die = (m) => { console.error(m); process.exit(1); };

async function call(path, body, raw) {
  let r;
  const go = () => fetch(RELAY + path, { method: body ? 'POST' : 'GET', headers: { ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  // a connection kept idle through a long transcription may have been closed: try once more
  try { try { r = await go(); } catch (e) { r = await go(); } }
  catch (e) { die('Could not reach ' + RELAY + ': ' + e.message); }
  if (r.status === 401) die('The relay wants its password: set NOTES_TOKEN.');
  if (r.status === 404) die('Not found (or this relay keeps no notes): ' + path);
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
  const d = await call('/api/notes/' + encodeURIComponent(id));
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

const argv = process.argv.slice(2), cmd = argv[0];
const opt = (n, def) => { const i = argv.indexOf(n); return i > 0 && argv[i + 1] ? argv[i + 1] : def; };
const target = argv[1] && !argv[1].startsWith('--') ? argv[1] : '';
const out = opt('--out', join(tmpdir(), 'notes'));

if (cmd === 'list') {
  const j = await call('/api/notes'), all = argv.includes('--all');
  const rows = j.notes.filter((n) => all || n.status !== 'done');
  if (!rows.length) console.log(all ? 'No notes.' : 'No new notes.');
  for (const n of rows) console.log([n.id, n.status, mmss(n.dur), (n.pins || 0) + ' pins', n.device || n.kind, n.story || '', n.transcript ? '"' + n.transcript.replace(/\s+/g, ' ').slice(0, 80) + '"' : '(not transcribed)'].join('  '));
} else if (cmd === 'pull' && target) {
  for (const id of await ids(target)) { const r = await pull(id, out); console.log(join(r.dir, 'note.md')); }
} else if (cmd === 'transcribe' && target) {
  const model = opt('--model', 'small');
  for (const id of await ids(target)) {
    const r = await pull(id, out);
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
  die('Usage: node tools/notes/notes.mjs list [--all] | pull <id|new> [--out dir] | transcribe <id|new> [--model small] | done <id>\nEnvironment: NOTES_RELAY, NOTES_TOKEN');
}
