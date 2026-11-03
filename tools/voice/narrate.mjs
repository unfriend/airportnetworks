// Narrates a story with a synthetic voice (Kokoro-82M through kokoro-onnx; for German, Piper; see README.md) and fits
// the story to it. The story's words are read from the running story as tools/narration.mjs reads them (each data-at
// cue's text in each chapter, with its story time), made ready for speech (say.json), spoken line by line (kokoro.py or
// piper.py, cached by text, so a re-run only speaks what changed) and laid out on a timeline built from the audio:
//   - a stretch of the story between two spoken lines (or a chapter's start or end) lasts in the recording the longer
//     of 1.1 times its story time (as tools/pace.mjs paces a story, so the animation is never rushed) and its line's
//     audio plus a pause (LEAD before it, as its text fades in; PAUSE after it, TITLE_PAUSE after a heading);
//   - a stretch slowed down a lot runs its first 0.6 s at the light pace, so its text is there at once (as pace.mjs);
//   - a chapter's last words end at least STOP_GAP before its slideshow stop (narrT(b - 0.7)), so a stop never cuts them.
// A story in two languages (LANGS and setLang, the pass story) is read and spoken in each, English by Kokoro and German
// by Piper, and laid out on one timeline: each stretch lasts the longest of 1.1 times its story time and each
// language's line plus its pause (a line one language reads as one and the other as two spans both stretches). Each
// language gets its own recording on that timeline (the first audio/narration-<key>.mp3, the others
// audio/narration-<key>-<lang>.mp3, all of one length), so a device plays its own language on a shared clock.
// It writes NARRATION_SYNC (recording time -> story time) and NARRATION_ENDS (where each chapter's words end in the
// recording; in two languages the later of the two) into the story's source (tools/<key>/engine/e3_story.js, then
// rebuilds; or stories/<key>.js) and the recordings (mono, 44.1 kHz, 64 kbps, loudness -16 LUFS).
// Usage: serve the folder, then node tools/voice/narrate.mjs <key> [base-url] [options]
//   --lines        print what is read (and what is left out) and stop; --phonemes adds what espeak-ng makes of it
//   --only de      with --lines or --phonemes: one language of a story in two
//   --dry          speak and lay out, print the table, write nothing into the app (the MP3s go to --out only)
//   --out FILE     also copy the MP3 there (another language's beside it: FILE-de.mp3)
//   --voice af_heart --speed 1 --lang en-us     the (first) language's voice (Kokoro's names; the cache keeps each apart)
//   --de-voice de_DE-thorsten-high --de-engine piper --de-speed 1   another language's voice (a Piper model's name or
//                  path, or a Kokoro voice with --de-engine kokoro --de-lang ...); --en-voice and so on as --voice
//   --skip SEL     what is small print, never read (CSS selector, default .credits)
// Environment: VOICE_PYTHON (a Python with kokoro-onnx, piper-tts and soundfile; default python3), KOKORO_DIR (or
// KOKORO_MODEL and KOKORO_VOICES), PIPER_DIR (or PIPER_MODEL) and VOICE_CACHE as kokoro.py and piper.py read them;
// PLAYWRIGHT_MODULE and CHROMIUM_PATH as in tools/smoke.mjs.
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
const valued = n => /^(voice|speed|lang|out|skip|only|[a-z]{2}-(voice|engine|speed|lang))$/.test(n);
const pos = args.filter((a, i) => !a.startsWith('--') && !(i && args[i - 1].startsWith('--') && valued(args[i - 1].slice(2))));
const key = pos.find(a => !/^https?:/.test(a)), base = pos.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8123/';
if (!key) { console.error('usage: node tools/voice/narrate.mjs <story key> [base-url] [--lines] [--phonemes] [--only de] [--dry] [--out FILE] [--voice af_heart] [--speed 1] [--de-voice de_DE-thorsten-high]'); process.exit(1); }
const SKIP = opt('skip', '.credits');
const PY = process.env.VOICE_PYTHON || 'python3';
// the engines (each speaks lines into WAV files and shows their phonemes), and each language's voice: English with
// Kokoro's af_heart (every story's), German with Piper's Thorsten (the owner's choice, 29 October 2026)
const ENGINE = { kokoro: path.join(HERE, 'kokoro.py'), piper: path.join(HERE, 'piper.py') };
const VOICES = { en: { engine: 'kokoro', voice: 'af_heart', lang: 'en-us' }, de: { engine: 'piper', voice: 'de_DE-thorsten-high', lang: 'de' } };
// seconds: the least a stretch slows down (pace.mjs's), a line's fade-in in story time, the voice after its cue, the
// pause after a line and after a heading, the voice's end before a slideshow stop, and the stop before a chapter's end
const SLOW = 1.1, FADE = 0.6, LEAD = 0.3, PAUSE = 0.5, TITLE_PAUSE = 1.0, STOP_GAP = 0.25, STOP = 0.7;
const srcOf = k => fs.existsSync(path.join(ROOT, `tools/${k}/engine/e3_story.js`)) ? `tools/${k}/engine/e3_story.js` : `stories/${k}.js`;
const r2 = x => Math.round(x * 100) / 100;
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
if (key === 'airports' && !flag('dry') && !flag('lines') && !flag('phonemes')) { console.error('The airports story has a human recording (audio/narration.mp3): use --dry --out FILE to try a voice on it.'); process.exit(1); }

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
const readStory = () => page.evaluate(skip => {
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
      // a line's own words for the voice (data-say on its cue element: a live number would be read as it stands at the
      // start, '0 steps'; empty, the line is not read)
      if (cue !== sec && cue.hasAttribute('data-say')) {
        if (!(last && last.cue === cue)) {
          last = { cue, ch: c.key, at: +cue.dataset.at || 0, text: cue.dataset.say || ' ', title: !!cue.closest('h1, h2, h3'), small: !!(skip && cue.closest(skip)) };
          lines.push(last);
        }
        last.p = p;
        continue;
      }
      if (last && last.cue === cue) {
        // a bold run straight into its text: a figure and its caption ('<b>23</b>chromosomes', a bold that starts with a
        // number, not a numbered step's '1 · Copy') read on, a name and its text ('<b>Shape</b>A city's layout') with a
        // colon between; a number straight into its small caption ('12<small>of 16</small>') with a space; the items of
        // one list ('<li>Proteins</li><li>Hubs</li>') with a comma
        const b = last.p !== p && /^(B|STRONG)$/.test(last.p.tagName) && /^[\p{L}\p{N}(]/u.test(txt) && /[\p{L}\p{N})%]$/u.test(last.text);
        const li = !b && last.p !== p && !!p.closest('li') && !!last.p.closest('li') && p.closest('li') !== last.p.closest('li') && !/[,.;:!?]\s*$/.test(last.text);
        const cap = !b && !li && last.p !== p && p.tagName === 'SMALL' && /^[\p{L}\p{N}(]/u.test(txt) && /[\p{L}\p{N})%]$/u.test(last.text);
        last.text += b ? (/^\s*\d/.test(last.p.textContent) && !/·/.test(last.p.textContent) ? ' ' : ': ') + txt : li ? ', ' + txt : cap ? ' ' + txt : txt;
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
// a story in two languages (LANGS, setLang): its words in each, then put back as it was; the first is the main one
const LANGS = await page.evaluate(() => HOST.cur.peek('typeof LANGS !== "undefined" ? LANGS : null'));
const langs = LANGS || ['en'], stories = {};
if (!LANGS) stories.en = await readStory();
else {
  const was = await page.evaluate(() => HOST.cur.peek('LANG'));
  for (const l of LANGS) { await page.evaluate(l => HOST.cur.peek(`setLang('${l}', false)`), l); stories[l] = await readStory(); }
  await page.evaluate(l => HOST.cur.peek(`setLang('${l}', false)`), was);
}
await browser.close();
const story = stories[langs[0]], { CH } = story, END = CH[CH.length - 1].b, multi = langs.length > 1;
for (const l of langs) if (stories[l].CH.some((c, i) => c.key !== CH[i].key || c.a !== CH[i].a || c.b !== CH[i].b)) throw new Error(`${key}: the chapters differ in ${l}`);
const names = Object.fromEntries(langs.map(l => [l, Object.fromEntries(stories[l].CH.map(c => [c.key, c.name]))]));
// each language's voice: its engine, voice, speed and (Kokoro) espeak-ng language; --voice and so on for the first
const V = Object.fromEntries(langs.map((l, i) => {
  const d = VOICES[l] || {}, o = n => opt(`${l}-${n}`, i ? undefined : opt(n, undefined));
  const v = { l, engine: o('engine') || d.engine, voice: o('voice') || d.voice, speed: +(o('speed') || 1), lang: o('lang') || d.lang };
  if (!ENGINE[v.engine] || !v.voice) { console.error(`${key}: no voice for ${l}: give --${l}-engine (kokoro or piper) and --${l}-voice`); process.exit(1); }
  // the engine's options: render and phonemes
  v.args = v.engine === 'kokoro' ? ['--voice', v.voice, '--speed', String(v.speed), '--lang', v.lang] : ['--voice', v.voice, '--speed', String(v.speed)];
  v.ph = v.engine === 'kokoro' ? ['--lang', v.lang] : ['--voice', v.voice];
  v.name = v.engine === 'kokoro' ? `${v.voice} (speed ${v.speed}, ${v.lang})` : `Piper's ${v.voice} (speed ${v.speed})`;
  return [l, v];
}));
// the recordings: the first language's is the story's narration file, another language's has its code after the key
const fileOf = (k, l) => k === 'airports' ? 'audio/narration.mp3' : `audio/narration-${k}${l && l !== langs[0] ? '-' + l : ''}.mp3`;
const outOf = (f, l) => (l === langs[0] ? f : f.replace(/(\.mp3)?$/i, `-${l}$1`));

// ------------------------------------------------------------------ what is read, and how it is said
const SAY = JSON.parse(fs.readFileSync(path.join(HERE, 'say.json'), 'utf8'));
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// say.json's English rules are at its top (global, then stories.<key>), another language's in its own section (de:
// { global, stories }), so one language's rules never touch another's text
const tableOf = l => (l === 'en' ? SAY : SAY[l] || {});
// the table's rules, the story's own first, the longest first: units after a number, words as whole words, symbols anywhere
function rulesOf(l) {
  const rules = [], T = tableOf(l);
  for (const t of [(T.stories || {})[key] || {}, T.global || {}]) {
    const add = (kind, o, re) => Object.keys(o || {}).sort((a, b) => b.length - a.length).forEach(k => rules.push({ kind, k, re: re(k), to: o[k] }));
    add('units', t.units, k => new RegExp(`(\\d)\\s*${esc(k)}(?![\\p{L}\\p{N}])`, 'gu'));
    add('words', t.words, k => new RegExp(`${/^[\p{L}\p{N}]/u.test(k) ? '(?<![\\p{L}\\p{N}])' : ''}${esc(k)}${/[\p{L}\p{N}]$/u.test(k) ? '(?![\\p{L}\\p{N}])' : ''}`, 'gu'));
    add('symbols', t.symbols, k => new RegExp(esc(k), 'gu'));
    for (const k of Object.keys(t.patterns || {})) rules.push({ kind: 'patterns', k, re: new RegExp(k, 'gu'), to: t.patterns[k] });
  }
  return rules;
}
const said = Object.fromEntries(langs.map(l => [l, new Map()]));
function sayIt(text, rules, said) {
  let s = text;
  for (const r of rules) {
    if (r.kind === 'patterns') { if (r.re.test(s)) said.set(r.k, r.to); r.re.lastIndex = 0; s = s.replace(r.re, r.to); continue; }
    s = s.replace(r.re, (...m) => { said.set(r.k, r.to); return r.kind === 'units' ? `${m[1]} ${r.to}` : r.to; });
  }
  return s.replace(/\s+/g, ' ').replace(/\s+([,.;:!?)])/g, '$1').replace(/\(\s+/g, '(').trim();
}
// a line ending on one of these runs on into the next (it gets a comma, not a full stop)
const FUNC = {
  en: /\b(to|of|for|and|or|the|a|an|with|from|by|in|on|at|as|than|is|are|was|were|holds)$/i,
  de: /(?<!\p{L})(zu|von|für|und|oder|der|die|das|den|dem|des|ein|eine|einen|einem|einer|mit|aus|bei|in|im|an|am|auf|als|um|bis|nach|über|durch|ist|sind|war|hat|wie)$/iu,
};
const read = {}, left = {};
for (const lg of langs) {
  const rules = rulesOf(lg), func = FUNC[lg] || /$^/;
  read[lg] = []; left[lg] = [];
  for (const c of CH) {
    const ls = stories[lg].lines.filter(l => l.ch === c.key).map(l => Object.assign({}, l, { s: c.a + l.at })).sort((a, b) => a.s - b.s);
    const out = [];
    for (const l of ls) {
      if (l.small) { left[lg].push(l); continue; }
      if (l.s >= c.b - 0.05) { console.warn(`${key}${multi ? ` (${lg})` : ''}: "${l.text.slice(0, 40)}" at ${r2(l.s)} is after its chapter's end; not read`); left[lg].push(l); continue; }
      const p = out[out.length - 1];
      // a line that carries on the one before ('A glimpse into the future' / 'of network medicine') is read with it
      if (p && /^\p{Ll}/u.test(l.text) && !/[.!?]$/.test(p.text)) { p.text += ' ' + l.text; p.joined = (p.joined || 0) + 1; continue; }
      out.push(Object.assign({}, l));
    }
    out.forEach((l, i) => {
      // a line without an end: a heading ends there; one that runs on (into a figure, or ending on 'to') gets a comma
      if (/[.!?:;,…]$/.test(l.text)) return;
      const n = out[i + 1];
      l.text += !l.title && ((n && /^\d/.test(n.text)) || func.test(l.text)) ? ',' : '.';
    });
    for (const l of out) read[lg].push(Object.assign(l, { say: sayIt(l.text, rules, said[lg]), lg }));
  }
}
const words = ls => ls.reduce((n, l) => n + l.say.split(/\s+/).length, 0);
for (const l of langs) console.log(`\n${key}${multi ? ` (${l})` : ''}: ${read[l].length} lines read, ${left[l].length} left out (${SKIP}), ${words(read[l])} words`);
const pr = (l, w) => console.log(`  ${mmss(l.s)} ${String(r2(l.s)).padStart(6)}${l.title ? ' [title]' : '        '} ${w}`);
if (flag('lines') || flag('phonemes')) {
  const shown = langs.filter(l => !opt('only') || l === opt('only')), ph = {};
  if (flag('phonemes')) for (const l of shown) ph[l] = JSON.parse(execFileSync(PY, [ENGINE[V[l].engine], 'phonemes', ...V[l].ph], { input: JSON.stringify(read[l].map(x => x.say)), maxBuffer: 1 << 26 }).toString());
  for (const c of CH) {
    console.log(`\n${c.name} (${c.key}, story ${c.a} to ${c.b})`);
    for (const lg of shown) {
      if (multi) console.log(`  ${lg}: ${names[lg][c.key]}`);
      read[lg].filter(l => l.ch === c.key).forEach(l => { pr(l, l.say); if (l.say !== l.text) console.log(`${' '.repeat(16)}(text: ${l.text})`); const i = read[lg].indexOf(l); if (ph[lg] && ph[lg][i]) console.log(`${' '.repeat(16)}/${ph[lg][i]}/`); });
    }
  }
  for (const lg of shown) {
    console.log(`\nLeft out (small print)${multi ? `, ${lg}` : ''}:`); left[lg].forEach(l => pr(l, l.text));
    console.log(`\nPronunciations used${multi ? `, ${lg}` : ''}:`, [...said[lg]].map(([k, v]) => `${k} -> ${v}`).join('; ') || 'none');
  }
  process.exit(0);
}

// ------------------------------------------------------------------ speak
for (const lg of langs) {
  const v = V[lg];
  console.log(`speaking${multi ? ` ${lg}` : ''} with ${v.name}...`);
  const r = spawnSync(PY, [ENGINE[v.engine], 'render', ...v.args], { input: JSON.stringify(read[lg].map(l => l.say)), maxBuffer: 1 << 26, stdio: ['pipe', 'pipe', 'inherit'] });
  if (r.status !== 0) { console.error(`${path.basename(ENGINE[v.engine])} render failed`); process.exit(1); }
  const spoken = JSON.parse(r.stdout.toString());
  read[lg].forEach((l, i) => { l.file = spoken[i].file; l.dur = spoken[i].dur; });
  console.log(`${spoken.filter(x => !x.cached).length} lines spoken, ${spoken.filter(x => x.cached).length} from the cache`);
}

// ------------------------------------------------------------------ the timeline
// segments: from each spoken line (or a chapter's start) to the next spoken line (or the chapter's end), in any
// language; cues without words inside a segment are stretched with it. A line lasts until its language's next line
// (or the chapter's end): over one segment, or over several where another language starts a line in between
const P = []; // [story time, recording time]
let rec = 0;
const at = (ls, s) => ls.find(l => Math.abs(l.s - s) < 1e-6);
for (const c of CH) {
  const per = langs.map(lg => read[lg].filter(l => l.ch === c.key));
  const bounds = [c.a, ...[...new Set(per.flat().map(l => l.s))].filter(s => s > c.a + 1e-6).sort((a, b) => a - b), c.b];
  const open = per.map(() => null); // each language's line being spoken, and where in the recording its segment began
  for (let i = 0; i + 1 < bounds.length; i++) {
    const s0 = bounds[i], s1 = bounds[i + 1], ds = s1 - s0, last = s1 === c.b;
    per.forEach((ls, k) => { const l = at(ls, s0); if (l) open[k] = { l, r0: rec }; });
    const fresh = per.some(ls => at(ls, s0)), speaking = open.some(o => o);
    // each language's line that ends here needs its audio and its pause (less what its earlier segments gave it); a
    // chapter's last line also leaves room for its slideshow stop after it
    let need = 0;
    per.forEach((ls, k) => {
      const o = open[k];
      if (!o || !(last || at(ls, s1))) return;
      const l = o.l;
      need = Math.max(need, LEAD + l.dur + (last ? Math.max(l.title ? TITLE_PAUSE : PAUSE, STOP_GAP + SLOW * STOP) : l.title ? TITLE_PAUSE : PAUSE) - (rec - o.r0));
    });
    const D = Math.max(SLOW * ds, need), f = Math.min(FADE, ds - 0.02);
    P.push([s0, rec]);
    const stopAt = last ? c.b - STOP : Infinity;
    if (fresh && D > 2 * SLOW * ds && f > 0.05 && s0 + f < stopAt - 0.05) P.push([s0 + f, rec + SLOW * f]);
    // the chapter's stop comes after its voice: the last STOP seconds of story time run at the light pace
    if (last && speaking && stopAt > P[P.length - 1][0] + 0.01) P.push([stopAt, rec + D - SLOW * STOP]);
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
for (const lg of langs) for (const l of read[lg]) { l.at = Math.round((narrT(l.s) + LEAD) * 1000) / 1000; l.end = l.at + l.dur; }
// where each chapter's words end (in each language, and the later of them), and its slideshow stop
const ends = {}, endsBy = Object.fromEntries(langs.map(l => [l, {}])), report = [];
const up = x => Math.ceil(x * 20) / 20;
for (const c of CH) {
  const stop = narrT(c.b - STOP);
  for (const lg of langs) {
    const ls = read[lg].filter(l => l.ch === c.key);
    if (ls.length) endsBy[lg][c.key] = up(Math.max(...ls.map(l => l.end)));
    if (endsBy[lg][c.key] > stop + 0.01) { console.error(`${c.key}${multi ? ` (${lg})` : ''}: its words end at ${endsBy[lg][c.key]}, after its slideshow stop at ${r2(stop)}`); process.exit(1); }
    // no line runs into the next one
    ls.forEach((l, i) => { const n = ls[i + 1]; if (n && l.end > n.at - 0.2) { console.error(`${c.key}${multi ? ` (${lg})` : ''}: "${l.say.slice(0, 30)}" runs into the next line`); process.exit(1); } });
  }
  const e = langs.map(lg => endsBy[lg][c.key]).filter(x => x !== undefined);
  if (e.length) ends[c.key] = Math.max(...e);
  report.push({ c, start: narrT(c.a), end: ends[c.key], stop });
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
console.log(`| Chapter | Starts | Words end${multi ? ` (${langs.join(', ')})` : ''} | Slideshow stop | Words |\n| --- | --- | --- | --- | --- |`);
for (const x of report) {
  const e = x.end === undefined ? '-' : multi ? langs.map(lg => endsBy[lg][x.c.key] === undefined ? '-' : endsBy[lg][x.c.key]).join(', ') : x.end;
  console.log(`| ${x.c.name} | ${mmss(x.start)} (${r2(x.start)}) | ${e} | ${r2(x.stop)} | ${langs.map(lg => read[lg].filter(l => l.ch === x.c.key).length).join(', ')} lines |`);
}
console.log(`ends at ${mmss(T_END)} (${T_END} s); the old table ended at ${story.sync ? story.sync[story.sync.length - 1][0] : '?'} s`);

// ------------------------------------------------------------------ the recordings
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'narrate-'));
// each recording ends with the story's last words and a pause, at most 1.1 s before the story does: a recording longer
// than the story less a second would stretch its timeline (audioInit's ready). In two languages both are as long as
// the later of the two needs, so they keep one timeline
const LEN = Math.max(T_END - 1.1, Math.max(...langs.flatMap(lg => read[lg].map(l => l.end))) + 0.5);
const made = {};
for (const lg of langs) {
  const wav = path.join(tmp, `mix-${lg}.wav`), mp3 = path.join(tmp, `narration-${lg}.mp3`), tag = multi ? ` (${lg})` : '';
  // (kokoro.py's mix places any WAV files, Piper's too, at their times; the file is at their own rate)
  const m = spawnSync(PY, [ENGINE.kokoro, 'mix', '--out', wav, '--length', String(LEN)], { input: JSON.stringify(read[lg].map(l => ({ file: l.file, at: l.at }))), stdio: ['pipe', 'pipe', 'inherit'] });
  if (m.status !== 0) { console.error('kokoro.py mix failed'); process.exit(1); }
  // loudness to -16 LUFS in two passes (measure, then apply), true peaks under -2.5 dB, 44.1 kHz mono MP3 at 64 kbps
  const ln = 'loudnorm=I=-16:TP=-2.5:LRA=11';
  const meas = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', ln + ':print_format=json', '-f', 'null', '-']).stderr.toString();
  const J = JSON.parse(meas.slice(meas.lastIndexOf('{'), meas.lastIndexOf('}') + 1));
  const af = `${ln}:measured_I=${J.input_i}:measured_TP=${J.input_tp}:measured_LRA=${J.input_lra}:measured_thresh=${J.input_thresh}:offset=${J.target_offset}:linear=true`;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-af', af, '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', mp3]);
  const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString().trim();
  // check the words' ends against the recording itself: the last sound before each chapter's stop
  const sd = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', mp3, '-af', 'silencedetect=noise=-45dB:d=0.3', '-f', 'null', '-']).stderr.toString();
  const quiet = [...sd.matchAll(/silence_start: ([\d.]+)/g)].map(x => +x[1]);
  const mine = report.filter(x => endsBy[lg][x.c.key] !== undefined);
  const heard = Object.fromEntries(mine.map(x => [x.c.key, r2(Math.max(...quiet.filter(q => q <= x.stop + 0.05), 0))]));
  const off = mine.filter(x => Math.abs(heard[x.c.key] - endsBy[lg][x.c.key]) > 0.3);
  console.log(`\nrecording${tag} ${mmss(dur)} (${r2(dur)} s), ${(fs.statSync(mp3).size / 1048576).toFixed(2)} MB, ${J.input_i} LUFS before levelling`);
  console.log('words end by the layout / heard (silencedetect):', mine.map(x => `${x.c.key} ${endsBy[lg][x.c.key]}/${heard[x.c.key]}`).join(', '));
  if (off.length) console.warn('  check by ear: ' + off.map(x => x.c.key).join(', '));
  if (opt('out')) { const o = path.resolve(outOf(opt('out'), lg)); fs.mkdirSync(path.dirname(o), { recursive: true }); fs.copyFileSync(mp3, o); console.log('copied to', outOf(opt('out'), lg)); }
  made[lg] = mp3;
}
if (flag('dry')) { fs.rmSync(tmp, { recursive: true, force: true }); process.exit(0); }

// ------------------------------------------------------------------ into the app
for (const lg of langs) { fs.copyFileSync(made[lg], path.join(ROOT, fileOf(key, lg))); console.log('wrote', fileOf(key, lg)); }
const f = path.join(ROOT, srcOf(key));
let src = fs.readFileSync(f, 'utf8');
const re = /const NARRATION_SYNC = \[\n[\s\S]*?\n\];/;
if (!re.test(src)) throw new Error(`${srcOf(key)}: no NARRATION_SYNC table found`);
src = src.replace(re, table);
if (/const NARRATION_ENDS = \{[^\n]*\};/.test(src)) src = src.replace(/const NARRATION_ENDS = \{[^\n]*\};/, endsLine);
else src = src.replace(table, `${table}\n// where each chapter's words end in the recording${multi ? 's' : ''} (seconds by chapter key${multi ? '; the later of its languages' : ''}): the slideshow lets the voice finish there\n${endsLine}`);
fs.writeFileSync(f, src);
console.log('wrote', srcOf(key));
if (srcOf(key).startsWith('tools/')) execFileSync(process.execPath, [path.join(ROOT, `tools/${key}/build.mjs`)], { stdio: 'inherit', cwd: ROOT });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nNow: len in stories/list.js (Story ${mmss(T_END)}), the chapter times in audio/PUT-narration.mp3-HERE.txt, VERSION in sw.js,
then node tools/smoke.mjs and node tools/audio.mjs, node tools/voice/check.mjs ${key}${multi ? langs.slice(1).map(l => ` (and --lang ${l})`).join('') : ''}, and node tools/narration.mjs (docs/narration.md).`);
