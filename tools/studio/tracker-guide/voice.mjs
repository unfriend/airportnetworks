// node tools/studio/tracker-guide/voice.mjs [--check]
// The tracker guide's spoken lines (script.json), spoken by Kokoro-82M with the voice af_heart through tools/voice/kokoro.py
// (set up as tools/voice/README.md says: VOICE_PYTHON, KOKORO_DIR, VOICE_CACHE), each made a mono MP3 by ffmpeg (64 kb/s,
// 24 kHz, its loudness evened to -16 LUFS) in voice/NN.mp3 here; then run make.mjs, which puts them in the scene as
// sounds/voice-NN.mp3 with a pad and a cube at each stand. Lines whose words have not changed come from the cache.
//   --check   says which lines have no MP3 yet, or an MP3 older than script.json (renders nothing)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../../..');
const S = JSON.parse(fs.readFileSync(path.join(HERE, 'script.json'), 'utf8')), OUT = path.join(HERE, 'voice');
const mp3 = l => path.join(OUT, String(l.n).padStart(2, '0') + '.mp3');
if (process.argv.includes('--check')) {
  const at = fs.statSync(path.join(HERE, 'script.json')).mtimeMs;
  const stale = S.lines.filter(l => !fs.existsSync(mp3(l)) || fs.statSync(mp3(l)).mtimeMs < at);
  console.log(stale.length ? `not rendered or older than script.json: ${stale.map(l => l.n).join(', ')}` : 'every line rendered');
  process.exit(stale.length ? 1 : 0);
}
const PY = process.env.VOICE_PYTHON || 'python3';
const r = spawnSync(PY, [path.join(REPO, 'tools/voice/kokoro.py'), 'render', '--voice', S.voice || 'af_heart'], { input: JSON.stringify(S.lines.map(l => l.text)), maxBuffer: 1 << 26, stdio: ['pipe', 'pipe', 'inherit'] });
if (r.status !== 0) { console.error('kokoro.py render failed (tools/voice/README.md: its setup)'); process.exit(1); }
const got = JSON.parse(r.stdout.toString());
fs.mkdirSync(OUT, { recursive: true });
S.lines.forEach((l, i) => {
  const f = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', got[i].file, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '1', '-ar', '24000', '-b:a', '64k', '-map_metadata', '-1', '-fflags', '+bitexact', mp3(l)], { stdio: 'inherit' });
  if (f.status !== 0) { console.error(`ffmpeg failed on line ${l.n}`); process.exit(1); }
  console.log(`${path.relative(REPO, mp3(l))}  ${got[i].dur.toFixed(1)} s  ${l.title}`);
});
console.log('now run: node tools/studio/tracker-guide/make.mjs');
