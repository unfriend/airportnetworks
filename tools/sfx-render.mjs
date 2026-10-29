// Renders every sound effect and background of the shell (sfx.js) to files, for listening before they are approved:
// tools/sfx.html (the sound board) renders each through an OfflineAudioContext in headless Chromium (no tap needed, the
// same graph and recipes as the app), ffmpeg converts it to MP3 (44.1 kHz; mono for the interface and room sounds,
// stereo for the backgrounds and the demos), and each is measured from the render itself (sample peak, true peak,
// loudness: the loudest 400 ms (momentary) and, for the backgrounds, the whole). Writes, in the out folder:
//   sfx-<name>.mp3, bed-<kind>.mp3, demo-3d.mp3, demo-duck.mp3   one file each
//   sfx-all.mp3, sfx-all.txt   everything in one file, 1.5 s of silence between (no voice announcing them), and its index
//   levels.txt                 the measurements, with the narration's for comparison
// Levels are as the app plays them at full effects volume (its default, 75 %, is 5 dB lower): every file gets the same
// gain, so they stay matched to each other and to the voice as in the app.
// Usage: serve the folder, then node tools/sfx-render.mjs [http://127.0.0.1:8123/] [out folder]
// Needs ffmpeg (with libmp3lame) and Playwright's Chromium (PLAYWRIGHT_MODULE and CHROMIUM_PATH as in smoke.mjs).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] || 'http://127.0.0.1:8123/';
const OUT = path.resolve(process.argv[3] || path.join(os.tmpdir(), 'sfx-out'));
const WAV = path.join(OUT, 'wav');
fs.mkdirSync(WAV, { recursive: true });
const GAP = 1.5, SR = 44100;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(base + 'tools/sfx.html', { waitUntil: 'load' });
await page.waitForFunction(() => window.SFX_BOARD, null, { timeout: 20000 });
const items = await page.evaluate(() => window.SFX_BOARD.items());

// a 32-bit float WAV's channels
function readWav(buf) {
  const ch = buf.readUInt16LE(22), sr = buf.readUInt32LE(24), n = (buf.length - 44) / 4 / ch, d = [];
  for (let c = 0; c < ch; c++) d.push(new Float32Array(n));
  for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < ch; c++, o += 4) d[c][i] = buf.readFloatLE(o);
  return { ch, sr, n, d };
}
function writeWav(file, chans, sr) {
  const ch = chans.length, n = chans[0].length, b = Buffer.alloc(44 + n * ch * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * ch * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(3, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * ch * 4, 28); b.writeUInt16LE(ch * 4, 32); b.writeUInt16LE(32, 34); b.write('data', 36); b.writeUInt32LE(n * ch * 4, 40);
  for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < ch; c++, o += 4) b.writeFloatLE(chans[c][i], o);
  fs.writeFileSync(file, b);
}
const db = v => (v > 1e-9 ? 20 * Math.log10(v) : -Infinity);
const f1 = v => (isFinite(v) ? v.toFixed(1) : '-inf');
// EBU R128 (ffmpeg's ebur128): integrated loudness, true peak, the loudest momentary (400 ms) and short-term (3 s)
function loudness(file, mono) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, ...(mono ? ['-ac', '1'] : []), '-af', 'ebur128=peak=true:framelog=info', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const s = r.stderr || '';
  let M = -Infinity, S = -Infinity;
  for (const m of s.matchAll(/M:\s*(-?[\d.]+)\s+S:\s*(-?[\d.]+)/g)) { M = Math.max(M, +m[1]); S = Math.max(S, +m[2]); }
  const I = +((/I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold/.exec(s) || [])[1]), TP = +((/Peak:\s+(-?[\d.inf]+) dBFS/.exec(s) || [])[1]);
  return { I, M, S, TP };
}
const mmss = t => Math.floor(t / 60) + ':' + (t % 60).toFixed(1).padStart(4, '0');

const rows = [], all = [[], []], index = [];
let at = 0;
for (const it of items) {
  const r = await page.evaluate(id => window.SFX_BOARD.render(id), it.id);
  const wav = path.join(WAV, it.file + '.wav');
  fs.writeFileSync(wav, Buffer.from(r.b64, 'base64'));
  let w = readWav(fs.readFileSync(wav));
  // mono files for the interface and room sounds (their reverb folded in), stereo for the rest
  if (it.ch === 1 && w.ch === 2) {
    const m = new Float32Array(w.n);
    for (let i = 0; i < w.n; i++) m[i] = (w.d[0][i] + w.d[1][i]) / 2;
    writeWav(wav, [m], w.sr); w = { ch: 1, sr: w.sr, n: w.n, d: [m] };
  }
  let peak = 0;
  for (const c of w.d) for (const v of c) peak = Math.max(peak, Math.abs(v));
  const L = loudness(wav, false);
  execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', wav, '-ar', String(SR), '-ac', String(w.ch), '-c:a', 'libmp3lame', '-b:a', w.ch === 1 ? '128k' : '192k', path.join(OUT, it.file + '.mp3')]);
  rows.push({ it, secs: w.n / w.sr, peak: db(peak), clip: peak >= 1, ...L });
  // the compilation: stereo, the sound, then silence
  index.push(`${mmss(at).padStart(7)}  ${it.name.padEnd(28)} ${it.file}.mp3  ${it.desc}`);
  for (let c = 0; c < 2; c++) all[c].push(w.d[Math.min(c, w.ch - 1)], new Float32Array(Math.round(GAP * SR)));
  at += w.n / w.sr + GAP;
  console.log(`${it.file.padEnd(22)} ${(w.n / w.sr).toFixed(2).padStart(6)} s  peak ${f1(db(peak)).padStart(6)} dBFS  true peak ${f1(L.TP).padStart(6)}  M max ${f1(L.M).padStart(6)} LUFS  ${it.kind === 'bed' || it.kind === 'demo' ? 'I ' + f1(L.I) + ' LUFS' : ''}`);
}
const join = parts => { const n = parts.reduce((a, p) => a + p.length, 0), o = new Float32Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; };
const allWav = path.join(WAV, 'sfx-all.wav');
writeWav(allWav, [join(all[0]), join(all[1])], SR);
execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', allWav, '-ar', String(SR), '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '192k', path.join(OUT, 'sfx-all.mp3')]);
fs.writeFileSync(path.join(OUT, 'sfx-all.txt'), [
  'sfx-all.mp3: every sound effect and background of the shell (sfx.js), one after another with 1.5 s of silence between.',
  'Levels as the app plays them at full effects volume (the default, 75 %, is 5 dB lower), the same gain for all.',
  'Start (m:ss)  name                         file  what it is', '', ...index, ''].join('\n'));
// the narration, for comparison (its first two minutes)
const voice = [];
for (const f of ['audio/narration.mp3', 'audio/narration-lbi.mp3']) if (fs.existsSync(path.join(REPO, f))) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-t', '120', '-i', path.join(REPO, f), '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const I = (/I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold/.exec(r.stderr) || [])[1], P = (/Peak:\s+(-?[\d.]+) dBFS/.exec(r.stderr) || [])[1];
  voice.push(`  ${f}: integrated ${I} LUFS, true peak ${P} dBFS (first 2 minutes)`);
}
const table = rows.map(r => `${r.it.file.padEnd(22)} ${r.it.kind.padEnd(5)} ${r.secs.toFixed(2).padStart(6)} s  ${f1(r.peak).padStart(6)}  ${f1(r.TP).padStart(6)}  ${f1(r.M).padStart(6)}  ${f1(r.S).padStart(6)}  ${r.it.kind === 'bed' || r.it.kind === 'demo' ? f1(r.I).padStart(6) : '     -'}${r.clip ? '  CLIPS' : ''}`);
fs.writeFileSync(path.join(OUT, 'levels.txt'), [
  'Sound effects (sfx.js) at full effects volume (the default, 75 %, plays them 5 dB lower; under the narration everything is 9 dB lower still).',
  'Peak: sample peak (dBFS). TP: true peak (dBTP). M max: the loudest 400 ms (LUFS). S max: the loudest 3 s. I: integrated (backgrounds and demos).',
  'The narration for comparison:', ...voice, '',
  'file                   kind     length   peak      TP   M max   S max       I', ...table, ''].join('\n'));
await browser.close();
if (errors.length) { console.log('page errors:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log(`\n${rows.length} files, sfx-all.mp3 (${mmss(at)}), sfx-all.txt and levels.txt in ${OUT}`);
if (rows.some(r => r.clip)) { console.log('CLIPPING in: ' + rows.filter(r => r.clip).map(r => r.it.file).join(', ')); process.exit(1); }
