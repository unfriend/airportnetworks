// Narrates a story with a synthetic voice (Kokoro-82M through kokoro-onnx, see README.md) and fits the story to it.
// The story's words are read from the running story as tools/narration.mjs reads them (each data-at cue's text in each
// chapter, with its story time), made ready for speech (say.json), spoken line by line (kokoro.py, cached by text, so a
// re-run only speaks what changed) and laid out on a timeline built from the audio:
//   - a stretch of the story between two spoken lines (or a chapter's start or end) lasts in the recording the longer
//     of 1.1 times its story time (as tools/pace.mjs paces a story, so the animation is never rushed) and its line's
//     audio plus a pause (LEAD before it, as its text fades in; PAUSE after it, TITLE_PAUSE after a heading);
//   - a stretch slowed down a lot runs its first 0.6 s at the light pace, so its text is there at once (as pace.mjs);
//   - a chapter's last words end at least STOP_GAP before its slideshow stop (narrT(b - 0.7)), so a stop never cuts them.
// It writes NARRATION_SYNC (recording time -> story time) and NARRATION_ENDS (where each chapter's words end in the
// recording) into the story's source (tools/<key>/engine/e3_story.js, then rebuilds; or stories/<key>.js) and the
// recording to audio/narration-<key>.mp3 (mono, 44.1 kHz, 64 kbps, loudness -16 LUFS).
// Usage: serve the folder, then node tools/voice/narrate.mjs <key> [base-url] [options]
//   --lines        print what is read (and what is left out) and stop; --phonemes adds what espeak-ng makes of it
//   --dry          speak and lay out, print the table, write nothing into the app (the MP3 goes to --out only)
//   --out FILE     also copy the MP3 there
//   --voice af_heart --speed 1 --lang en-us     the voice (Kokoro's names; the cache keeps each voice apart)
//   --skip SEL     what is small print, never read (CSS selector, default .credits)
// Environment: VOICE_PYTHON (a Python with kokoro-onnx and soundfile; default python3), KOKORO_DIR (or KOKORO_MODEL and
// KOKORO_VOICES) and VOICE_CACHE as kokoro.py reads them; PLAYWRIGHT_MODULE and CHROMIUM_PATH as in tools/smoke.mjs.
// Afterwards: len in stories/list.js, audio/PUT-narration.mp3-HERE.txt, VERSION in sw.js, then the smoke and audio
// tests and node tools/narration.mjs (docs/narration.md).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const flag = n => args.includes('--' + n);
const valued = new Set(['voice', 'speed', 'lang', 'out', 'skip']);
const pos = args.filter((a, i) => !a.startsWith('--') && !(i && valued.has(args[i - 1].slice(2))));
const key = pos.find(a => !/^https?:/.test(a)), base = pos.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8123/';
if (!key) { console.error('usage: node tools/voice/narrate.mjs <story key> [base-url] [--lines] [--phonemes] [--dry] [--out FILE] [--voice af_heart] [--speed 1]'); process.exit(1); }
const VOICE = opt('voice', 'af_heart'), SPEED = +opt('speed', 1), LANG = opt('lang', 'en-us'), SKIP = opt('skip', '.credits');
const PY = process.env.VOICE_PYTHON || 'python3', KPY = path.join(HERE, 'kokoro.py');
// seconds: the least a stretch slows down (pace.mjs's), a line's fade-in in story time, the voice after its cue, the
// pause after a line and after a heading, the voice's end before a slideshow stop, and the stop before a chapter's end
const SLOW = 1.1, FADE = 0.6, LEAD = 0.3, PAUSE = 0.5, TITLE_PAUSE = 1.0, STOP_GAP = 0.25, STOP = 0.7;
const fileOf = k => k === 'airports' ? 'audio/narration.mp3' : `audio/narration-${k}.mp3`;
const srcOf = k => fs.existsSync(path.join(ROOT, `tools/${k}/engine/e3_story.js`)) ? `tools/${k}/engine/e3_story.js` : `stories/${k}.js`;
const r2 = x => Math.round(x * 100) / 100;
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
if (key === 'airports' && !flag('dry') && !flag('lines')) { console.error('The airports story has a human recording (audio/narration.mp3): use --dry --out FILE to try a voice on it.'); process.exit(1); }

// ------------------------------------------------------------------ read the story's words, as tools/narration.mjs does
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
await page.goto(base + 'index.html');
await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.list, null, { timeout: 30000 });
await page.evaluate(k => HOST.start(k), key);
await page.waitForFunction(k => HOST.curKey === k && HOST.cur && !HOST.busy && document.querySelector('section.ch'), key, { timeout: 90000 });
const story = await page.evaluate(skip => {
  const CH = HOST.cur.peek('CH').map(c => ({ key: c.key, name: c.name, a: c.a, b: c.b }));
  const lines = [], cues = [];
  for (const sec of document.querySelectorAll('section.ch')) {
    const c = CH.find(c => c.key === sec.dataset.ch);
    if (!c) continue;
    for (const el of sec.querySelectorAll('[data-at]')) cues.push(c.a + (+el.dataset.at || 0)); // every cue, words or not
    const walk = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
    let last = null;
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const p = n.parentElement;
      if (!p || p.closest('svg, script, style, button')) continue;
      const txt = n.textContent.replace(/\s+/g, ' ');
      if (!txt.trim()) { if (last) last.text += ' '; continue; }
      const at = p.closest('[data-at]'), cue = at && sec.contains(at) ? at : sec;
      if (last && last.cue === cue) {
        // a bold run straight into its text: a figure and its caption ('<b>23</b>chromosomes') read on, a name and its
        // text ('<b>Shape</b>A city's layout') with a colon between
        const b = last.p !== p && /^(B|STRONG)$/.test(last.p.tagName) && /^[\p{L}\p{N}(]/u.test(txt) && /[\p{L}\p{N})%]$/u.test(last.text);
        last.text += b ? (/^\s*\d/.test(last.p.textContent) ? ' ' : ': ') + txt : txt;
      } else {
        last = { cue, ch: c.key, at: cue === sec ? 0 : +cue.dataset.at || 0, text: txt,
          title: !!p.closest('h1, h2, h3'), small: !!(skip && p.closest(skip)) };
        lines.push(last);
      }
      last.p = p;
    }
  }
  let sync = null, ends = null;
  try { sync = HOST.cur.peek('NARRATION_SYNC'); } catch (e) { /* none */ }
  try { ends = HOST.cur.peek('typeof NARRATION_ENDS === "object" ? NARRATION_ENDS : null'); } catch (e) { /* none */ }
  return { CH, cues, sync, ends, lines: lines.map(l => ({ ch: l.ch, at: l.at, text: l.text.replace(/\s+/g, ' ').trim(), title: l.title, small: l.small })).filter(l => l.text) };
}, SKIP);
await browser.close();
const { CH } = story, END = CH[CH.length - 1].b;

// ------------------------------------------------------------------ what is read, and how it is said
const SAY = JSON.parse(fs.readFileSync(path.join(HERE, 'say.json'), 'utf8'));
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// the table's rules, the story's own first, the longest first: units after a number, words as whole words, symbols anywhere
const rules = [];
for (const t of [(SAY.stories || {})[key] || {}, SAY.global || {}]) {
  const add = (kind, o, re) => Object.keys(o || {}).sort((a, b) => b.length - a.length).forEach(k => rules.push({ kind, k, re: re(k), to: o[k] }));
  add('units', t.units, k => new RegExp(`(\\d)\\s*${esc(k)}(?![\\p{L}\\p{N}])`, 'gu'));
  add('words', t.words, k => new RegExp(`${/^[\p{L}\p{N}]/u.test(k) ? '(?<![\\p{L}\\p{N}])' : ''}${esc(k)}${/[\p{L}\p{N}]$/u.test(k) ? '(?![\\p{L}\\p{N}])' : ''}`, 'gu'));
  add('symbols', t.symbols, k => new RegExp(esc(k), 'gu'));
  for (const k of Object.keys(t.patterns || {})) rules.push({ kind: 'patterns', k, re: new RegExp(k, 'gu'), to: t.patterns[k] });
}
const said = new Map();
function sayIt(text) {
  let s = text;
  for (const r of rules) {
    if (r.kind === 'patterns') { if (r.re.test(s)) said.set(r.k, r.to); r.re.lastIndex = 0; s = s.replace(r.re, r.to); continue; }
    s = s.replace(r.re, (...m) => { said.set(r.k, r.to); return r.kind === 'units' ? `${m[1]} ${r.to}` : r.to; });
  }
  return s.replace(/\s+/g, ' ').replace(/\s+([,.;:!?)])/g, '$1').replace(/\(\s+/g, '(').trim();
}
const FUNC = /\b(to|of|for|and|or|the|a|an|with|from|by|in|on|at|as|than|is|are|was|were|holds)$/i;
const read = [], left = [];
for (const c of CH) {
  const ls = story.lines.filter(l => l.ch === c.key).map(l => Object.assign({}, l, { s: c.a + l.at })).sort((a, b) => a.s - b.s);
  const out = [];
  for (const l of ls) {
    if (l.small) { left.push(l); continue; }
    if (l.s >= c.b - 0.05) { console.warn(`${key}: "${l.text.slice(0, 40)}" at ${r2(l.s)} is after its chapter's end; not read`); left.push(l); continue; }
    const p = out[out.length - 1];
    // a line that carries on the one before ('A glimpse into the future' / 'of network medicine') is read with it
    if (p && /^\p{Ll}/u.test(l.text) && !/[.!?]$/.test(p.text)) { p.text += ' ' + l.text; p.joined = (p.joined || 0) + 1; continue; }
    out.push(Object.assign({}, l));
  }
  out.forEach((l, i) => {
    // a line without an end: a heading ends there; one that runs on (into a figure, or ending on 'to') gets a comma
    if (/[.!?:;,…]$/.test(l.text)) return;
    const n = out[i + 1];
    l.text += !l.title && ((n && /^\d/.test(n.text)) || FUNC.test(l.text)) ? ',' : '.';
  });
  for (const l of out) read.push(Object.assign(l, { say: sayIt(l.text) }));
}
console.log(`\n${key}: ${read.length} lines read, ${left.length} left out (${SKIP}), ${read.reduce((n, l) => n + l.say.split(/\s+/).length, 0)} words`);
const pr = (l, w) => console.log(`  ${mmss(l.s)} ${String(r2(l.s)).padStart(6)}${l.title ? ' [title]' : '        '} ${w}`);
if (flag('lines') || flag('phonemes')) {
  let ph = [];
  if (flag('phonemes')) ph = JSON.parse(execFileSync(PY, [KPY, 'phonemes', '--lang', LANG], { input: JSON.stringify(read.map(l => l.say)), maxBuffer: 1 << 26 }).toString());
  for (const c of CH) {
    console.log(`\n${c.name} (${c.key}, story ${c.a} to ${c.b})`);
    read.filter(l => l.ch === c.key).forEach(l => { pr(l, l.say); if (l.say !== l.text) console.log(`${' '.repeat(16)}(text: ${l.text})`); const i = read.indexOf(l); if (ph[i]) console.log(`${' '.repeat(16)}/${ph[i]}/`); });
  }
  console.log('\nLeft out (small print):'); left.forEach(l => pr(l, l.text));
  console.log('\nPronunciations used:', [...said].map(([k, v]) => `${k} -> ${v}`).join('; ') || 'none');
  process.exit(0);
}

// ------------------------------------------------------------------ speak
console.log(`speaking with ${VOICE} (speed ${SPEED}, ${LANG})...`);
const r = spawnSync(PY, [KPY, 'render', '--voice', VOICE, '--speed', String(SPEED), '--lang', LANG], { input: JSON.stringify(read.map(l => l.say)), maxBuffer: 1 << 26, stdio: ['pipe', 'pipe', 'inherit'] });
if (r.status !== 0) { console.error('kokoro.py render failed'); process.exit(1); }
const spoken = JSON.parse(r.stdout.toString());
read.forEach((l, i) => { l.file = spoken[i].file; l.dur = spoken[i].dur; });
console.log(`${spoken.filter(x => !x.cached).length} lines spoken, ${spoken.filter(x => x.cached).length} from the cache`);

// ------------------------------------------------------------------ the timeline
// segments: from each spoken line (or a chapter's start) to the next spoken line (or the chapter's end); cues without
// words inside a segment are stretched with it
const P = []; // [story time, recording time]
let rec = 0;
for (const c of CH) {
  const ls = read.filter(l => l.ch === c.key);
  const bounds = [c.a, ...ls.map(l => l.s).filter(s => s > c.a + 1e-6), c.b];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const s0 = bounds[i], s1 = bounds[i + 1], ds = s1 - s0, l = ls.find(l => Math.abs(l.s - s0) < 1e-6), last = s1 === c.b;
    // the line's audio and its pause; a chapter's last line also leaves room for its slideshow stop after it
    const need = l ? LEAD + l.dur + (last ? Math.max(l.title ? TITLE_PAUSE : PAUSE, STOP_GAP + SLOW * STOP) : l.title ? TITLE_PAUSE : PAUSE) : 0;
    const D = Math.max(SLOW * ds, need), f = Math.min(FADE, ds - 0.02);
    P.push([s0, rec]);
    const stopAt = last ? c.b - STOP : Infinity;
    if (l && D > 2 * SLOW * ds && f > 0.05 && s0 + f < stopAt - 0.05) P.push([s0 + f, rec + SLOW * f]);
    // the chapter's stop comes after its voice: the last STOP seconds of story time run at the light pace
    if (last && l && stopAt > P[P.length - 1][0] + 0.01) P.push([stopAt, rec + D - SLOW * STOP]);
    if (l) l.seg = [s0, s1, rec, D];
    rec += D;
  }
}
P.push([END, rec]);
// knots: every chapter's start and end and every point where the pace changes; recording times to 0.01 s, rising
const starts = new Set(CH.flatMap(c => [c.a, c.b])), knots = [];
const sl = i => (P[i + 1][1] - P[i][1]) / (P[i + 1][0] - P[i][0]);
P.forEach(([s, t], i) => {
  if (i && i < P.length - 1 && !starts.has(s) && Math.abs(sl(i - 1) - sl(i)) < 1e-9) return;
  if (knots.length && Math.abs(knots[knots.length - 1][1] - r2(s)) < 1e-9) return;
  knots.push([Math.max(r2(t), knots.length ? r2(knots[knots.length - 1][0] + 0.01) : 0), r2(s)]);
});
const narrT = o => { for (let i = 1; i < knots.length; i++) if (o <= knots[i][1]) { const [n0, o0] = knots[i - 1], [n1, o1] = knots[i]; return n0 + (n1 - n0) * (o - o0) / (o1 - o0); } return knots[knots.length - 1][0] + (o - knots[knots.length - 1][1]); };
const T_END = knots[knots.length - 1][0];
for (const l of read) { l.at = Math.round((narrT(l.s) + LEAD) * 1000) / 1000; l.end = l.at + l.dur; }
// where each chapter's words end, and its slideshow stop
const ends = {}, report = [];
for (const c of CH) {
  const ls = read.filter(l => l.ch === c.key), stop = narrT(c.b - STOP);
  if (ls.length) ends[c.key] = Math.ceil(Math.max(...ls.map(l => l.end)) * 20) / 20;
  report.push({ c, start: narrT(c.a), end: ends[c.key], stop });
  if (ends[c.key] > stop + 0.01) { console.error(`${c.key}: its words end at ${ends[c.key]}, after its slideshow stop at ${r2(stop)}`); process.exit(1); }
  // no line runs into the next one
  ls.forEach((l, i) => { const n = ls[i + 1]; if (n && l.end > n.at - 0.2) { console.error(`${c.key}: "${l.say.slice(0, 30)}" runs into the next line`); process.exit(1); } });
}
const rows = [];
for (const c of CH) {
  const ks = knots.filter(k => k[1] >= c.a && (k[1] < c.b || (c === CH[CH.length - 1] && k[1] <= c.b))).map(k => `[${k[0]}, ${k[1]}]`);
  let line = '  ';
  ks.forEach(k => { if (line.length + k.length > 100) { rows.push(line.trimEnd()); line = '  '; } line += k + ', '; });
  rows.push(line.trimEnd().padEnd(52) + `  // ${c.name}`);
}
const table = `const NARRATION_SYNC = [\n${rows.join('\n')}\n];`;
const endsLine = `const NARRATION_ENDS = { ${Object.entries(ends).map(([k, v]) => `${/^[a-z_$][\w$]*$/i.test(k) ? k : JSON.stringify(k)}: ${v}`).join(', ')} };`;
console.log(`\n${table}\n${endsLine}\n`);
console.log('| Chapter | Starts | Words end | Slideshow stop | Words |\n| --- | --- | --- | --- | --- |');
for (const x of report) console.log(`| ${x.c.name} | ${mmss(x.start)} (${r2(x.start)}) | ${x.end === undefined ? '-' : x.end} | ${r2(x.stop)} | ${read.filter(l => l.ch === x.c.key).length} lines |`);
console.log(`ends at ${mmss(T_END)} (${T_END} s); the old table ended at ${story.sync ? story.sync[story.sync.length - 1][0] : '?'} s`);

// ------------------------------------------------------------------ the recording
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'narrate-')), wav = path.join(tmp, 'mix.wav'), mp3 = path.join(tmp, 'narration.mp3');
const m = spawnSync(PY, [KPY, 'mix', '--out', wav, '--length', String(T_END)], { input: JSON.stringify(read.map(l => ({ file: l.file, at: l.at }))), stdio: ['pipe', 'pipe', 'inherit'] });
if (m.status !== 0) { console.error('kokoro.py mix failed'); process.exit(1); }
// loudness to -16 LUFS in two passes (measure, then apply), true peaks under -2.5 dB, 44.1 kHz mono MP3 at 64 kbps
const ln = 'loudnorm=I=-16:TP=-2.5:LRA=11';
const meas = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', ln + ':print_format=json', '-f', 'null', '-']).stderr.toString();
const J = JSON.parse(meas.slice(meas.lastIndexOf('{'), meas.lastIndexOf('}') + 1));
const af = `${ln}:measured_I=${J.input_i}:measured_TP=${J.input_tp}:measured_LRA=${J.input_lra}:measured_thresh=${J.input_thresh}:offset=${J.target_offset}:linear=true`;
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-af', af, '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', mp3]);
const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString().trim();
// check NARRATION_ENDS against the recording itself: the last sound before each chapter's stop
const sd = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', mp3, '-af', 'silencedetect=noise=-45dB:d=0.3', '-f', 'null', '-']).stderr.toString();
const quiet = [...sd.matchAll(/silence_start: ([\d.]+)/g)].map(x => +x[1]);
const heard = Object.fromEntries(report.filter(x => x.end !== undefined).map(x => [x.c.key, r2(Math.max(...quiet.filter(q => q <= x.stop + 0.05), 0))]));
const off = report.filter(x => x.end !== undefined && Math.abs(heard[x.c.key] - x.end) > 0.3);
console.log(`\nrecording ${mmss(dur)} (${r2(dur)} s), ${(fs.statSync(mp3).size / 1048576).toFixed(2)} MB, ${J.input_i} LUFS before levelling`);
console.log('words end by the layout / heard (silencedetect):', report.filter(x => x.end !== undefined).map(x => `${x.c.key} ${x.end}/${heard[x.c.key]}`).join(', '));
if (off.length) console.warn('  check by ear: ' + off.map(x => x.c.key).join(', '));
if (opt('out')) { fs.mkdirSync(path.dirname(path.resolve(opt('out'))), { recursive: true }); fs.copyFileSync(mp3, path.resolve(opt('out'))); console.log('copied to', opt('out')); }
if (flag('dry')) { fs.rmSync(tmp, { recursive: true, force: true }); process.exit(0); }

// ------------------------------------------------------------------ into the app
fs.copyFileSync(mp3, path.join(ROOT, fileOf(key)));
console.log('wrote', fileOf(key));
const f = path.join(ROOT, srcOf(key));
let src = fs.readFileSync(f, 'utf8');
const re = /const NARRATION_SYNC = \[\n[\s\S]*?\n\];/;
if (!re.test(src)) throw new Error(`${srcOf(key)}: no NARRATION_SYNC table found`);
src = src.replace(re, table);
if (/const NARRATION_ENDS = \{[^\n]*\};/.test(src)) src = src.replace(/const NARRATION_ENDS = \{[^\n]*\};/, endsLine);
else src = src.replace(table, `${table}\n// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there\n${endsLine}`);
fs.writeFileSync(f, src);
console.log('wrote', srcOf(key));
if (srcOf(key).startsWith('tools/')) execFileSync(process.execPath, [path.join(ROOT, `tools/${key}/build.mjs`)], { stdio: 'inherit', cwd: ROOT });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nNow: len in stories/list.js (Story ${mmss(T_END)}), the chapter times in audio/PUT-narration.mp3-HERE.txt, VERSION in sw.js,
then node tools/smoke.mjs and node tools/audio.mjs, and node tools/narration.mjs (docs/narration.md).`);
