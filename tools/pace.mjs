// Pacing: writes each story's NARRATION_SYNC from the words on its panel, for the stories without a recorded narration.
// Without a recording, NARRATION_SYNC sets a story's pace: it maps the clock (APP.t, the timeline) to story time, the
// time the chapters, data-at cues, camera and animation are written in. This stretches every stretch of the story
// between two cues (each data-at element, each chapter's start and end) so that the words that appear at its start can
// be read: it lasts max(1.1 x its story time, words / rate) seconds (words with letters in them: numbers, and so a line
// of numbers alone, are read at a glance), with the rate chosen per story so that the whole story reads at the airports'
// pace, 2.1 such words a second as its recording runs. Story time stays as it is, so nothing else changes.
// A story with a recorded narration (its MP3 in audio/) is left alone: its table follows the recording instead.
// A story in more than one language (it lists them in LANGS and switches with setLang(l, false), as the pass story
// does) is read in each, and every stretch takes the reading time of its longer text.
// Usage: serve the folder, then node tools/pace.mjs http://127.0.0.1:8123/ [--write] [story keys]
//   prints the tables; --write puts them into the sources (tools/<story>/engine/e3_story.js, or stories/<story>.js for
//   the airports, proteins and spatial stories) and rebuilds the built stories. Run it again after a story's text
//   changes, then update the lengths (len in stories/list.js, the chapter times in
//   audio/PUT-narration.mp3-HERE.txt), bump VERSION in sw.js and regenerate docs/narration.md (tools/narration.mjs).
// PLAYWRIGHT_MODULE and CHROMIUM_PATH as in smoke.mjs.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const args = process.argv.slice(2), write = args.includes('--write');
const base = args.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8123/';
const only = args.filter(a => !a.startsWith('-') && !/^https?:/.test(a));
const PACE = 2.1, SLOW = 1.1, FADE = 0.6; // the airports' words a second; the least a stretch slows down; a line's fade-in
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
await page.goto(base + 'index.html');
await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.list, null, { timeout: 30000 });
const list = (await page.evaluate(() => HOST.list.map(s => s.key))).filter(k => !only.length || only.includes(k));
const fileOf = k => k === 'airports' ? 'audio/narration.mp3' : `audio/narration-${k}.mp3`;
const srcOf = k => fs.existsSync(`tools/${k}/engine/e3_story.js`) ? `tools/${k}/engine/e3_story.js` : `stories/${k}.js`;
const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100;
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; // as the timeline shows it
const out = [];
for (const key of list) {
  const recorded = fs.existsSync(fileOf(key));
  await page.evaluate(k => HOST.start(k), key);
  await page.waitForFunction(k => HOST.curKey === k && HOST.cur && !HOST.busy && document.querySelector('section.ch'), key, { timeout: 60000 });
  // the panel's words by cue, read as tools/narration.mjs reads them: each run of text under the same nearest data-at
  // element is one line, shown at the chapter's start plus its data-at
  const read = () => page.evaluate(() => {
    const CH = HOST.cur.peek('CH').map(c => ({ key: c.key, name: c.name, a: c.a, b: c.b }));
    const sync = HOST.cur.peek('NARRATION_SYNC'), lines = [], ats = [];
    for (const sec of document.querySelectorAll('section.ch')) {
      const c = CH.find(c => c.key === sec.dataset.ch), walk = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
      if (!c) continue;
      for (const el of sec.querySelectorAll('[data-at]')) ats.push({ ch: c.key, at: c.a + (+el.dataset.at || 0) }); // a cue, words or not
      let last = null;
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const p = n.parentElement;
        if (!p || p.closest('svg, script, style, button')) continue;
        const txt = n.textContent.replace(/\s+/g, ' ');
        if (!txt.trim()) { if (last) last.text += ' '; continue; }
        const at = p.closest('[data-at]'), cue = at && sec.contains(at) ? at : sec;
        if (last && last.cue === cue) last.text += txt;
        else { last = { cue, ch: c.key, at: c.a + (cue === sec ? 0 : +cue.dataset.at || 0), text: txt }; lines.push(last); }
      }
    }
    return { CH, sync, ats, lines: lines.map(l => ({ ch: l.ch, at: l.at, text: l.text.trim() })) };
  });
  // (a story in two languages: its panel read in each, then put back as it was)
  const langs = await page.evaluate(() => HOST.cur.peek('typeof LANGS !== "undefined" ? LANGS : null'));
  let d;
  if (!langs) d = await read();
  else {
    const was = await page.evaluate(() => HOST.cur.peek('LANG')), all = [];
    for (const l of langs) { await page.evaluate(l => HOST.cur.peek(`setLang('${l}', false)`), l); all.push(await read()); }
    await page.evaluate(l => HOST.cur.peek(`setLang('${l}', false)`), was);
    d = Object.assign(all[0], { langs: all });
  }
  const { CH } = d, end = CH[CH.length - 1].b;
  const words = new Map(), cues = new Set(CH.flatMap(c => [c.a, c.b]));
  let total = 0;
  for (const a of d.ats) { const c = CH.find(c => c.key === a.ch); if (r2(a.at) < c.b - 0.05) cues.add(r2(a.at)); }
  for (const dl of d.langs || [d]) {
    const wl = new Map();
    for (const l of dl.lines) {
      const c = CH.find(c => c.key === l.ch), at = r2(l.at);
      if (at >= c.b - 0.05) { console.warn(`${key}: "${l.text.slice(0, 40)}" at ${at} is after its chapter's end; not counted`); continue; }
      // words with letters in them, as the airports' 2.1 words a second were counted: a number (and so a line of numbers
      // alone, a big figure) is taken in at a glance
      const w = l.text.split(/\s+/).filter(s => /[A-Za-zÀ-ÿ]/.test(s)).length;
      wl.set(at, (wl.get(at) || 0) + w); cues.add(at);
    }
    // (in two languages each stretch reads as long as its longer text)
    for (const [at, w] of wl) words.set(at, Math.max(words.get(at) || 0, w));
  }
  for (const w of words.values()) total += w;
  const S = [...cues].sort((a, b) => a - b);
  // the table for a reading rate (words a second): P are points [story time, recording time], the knots the table's rows
  const tableFor = RATE => {
    const P = [];
    let r = 0;
    for (let i = 0; i + 1 < S.length; i++) {
      const ds = S[i + 1] - S[i], dr = Math.max(SLOW * ds, (words.get(S[i]) || 0) / RATE);
      P.push([S[i], r]);
      // a line fades in over 0.6 s of story time, so in a stretch slowed down for reading it would take seconds: there
      // it runs at the light pace (a further knot) and the rest of the stretch takes the extra time, so the text is
      // there to read at once (also a heading in a short stretch: the scene waits a moment for it)
      const f = Math.min(FADE, ds - 0.02);
      if (dr > 2 * SLOW * ds && f > 0.05) P.push([S[i] + f, r + SLOW * f]);
      r += dr;
    }
    P.push([end, r]);
    // knots: every chapter boundary, and every point where the pace changes; recording times to 0.1 s, strictly rising
    const starts = new Set(CH.map(c => c.a).concat(end)), knots = [];
    const sl = i => (P[i + 1][1] - P[i][1]) / (P[i + 1][0] - P[i][0]);
    P.forEach(([s, t], i) => {
      if (i && i < P.length - 1 && !starts.has(s) && Math.abs(sl(i - 1) - sl(i)) < 1e-9) return;
      knots.push([Math.max(r1(t), knots.length ? r1(knots[knots.length - 1][0] + 0.1) : 0), r2(s)]);
    });
    return knots;
  };
  // the reading rate that gives the whole story the airports' pace (PACE words a second, as its recording reads):
  // text-heavy stretches slow down most, light ones keep near their speed
  let lo = 1.5, hi = 5;
  for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2, kn = tableFor(m); if (total / kn[kn.length - 1][0] > PACE) hi = m; else lo = m; }
  const rate = (lo + hi) / 2, knots = tableFor(rate);
  // one line (or a few) per chapter, as in the airports' table
  const rows = [];
  for (const c of CH) {
    const ks = knots.filter(k => k[1] >= c.a && (k[1] < c.b || (c === CH[CH.length - 1] && k[1] <= c.b))).map(k => `[${k[0]}, ${k[1]}]`);
    let line = '  ';
    ks.forEach((k, j) => {
      if (line.length + k.length > 100) { rows.push(line.trimEnd()); line = '  '; }
      line += k + ', ';
    });
    rows.push(line.trimEnd().padEnd(52) + `  // ${c.name}`);
  }
  const table = `const NARRATION_SYNC = [\n${rows.join('\n')}\n];`;
  const oldEnd = d.sync[d.sync.length - 1][0], newEnd = recorded ? oldEnd : knots[knots.length - 1][0];
  const info = { key, words: total, old: oldEnd, new: newEnd, oldRate: total / oldEnd, newRate: total / newEnd, recorded };
  out.push(info);
  if (recorded) { console.log(`\n// ${key}: recorded (${fileOf(key)}), its table follows the recording: left alone (by the words it would last ${mmss(knots[knots.length - 1][0])})`); continue; }
  // how soon each line can be read: two thirds faded in (0.6 of its fade, smoothstep), on the clock
  const nT = o => { for (let i = 1; i < knots.length; i++) if (o <= knots[i][1]) { const [n0, o0] = knots[i - 1], [n1, o1] = knots[i]; return n0 + (n1 - n0) * (o - o0) / (o1 - o0); } return newEnd; };
  const fades = [...words].filter(([, w]) => w).map(([s]) => [nT(s + 0.6 * FADE) - nT(s), s]).sort((a, b) => a[0] - b[0]);
  const fm = fades[fades.length >> 1][0], fw = fades.slice(-3).reverse().map(([f, s]) => `${f.toFixed(1)} s at ${mmss(nT(s))}`).join(', ');
  console.log(`\n// ${key}: ${total} words, ${mmss(oldEnd)} -> ${mmss(newEnd)} (${info.oldRate.toFixed(2)} -> ${info.newRate.toFixed(2)} words a second; stretches read at ${rate.toFixed(2)})\n// lines readable after ${fm.toFixed(1)} s (median); slowest ${fw}\n${table}`);
  if (write) {
    const f = srcOf(key), src = fs.readFileSync(f, 'utf8'), re = /const NARRATION_SYNC = \[\n[\s\S]*?\n\];/;
    if (!re.test(src)) throw new Error(`${f}: no NARRATION_SYNC table found`);
    fs.writeFileSync(f, src.replace(re, table));
    if (f.startsWith('tools/')) execFileSync(process.execPath, [`tools/${key}/build.mjs`], { stdio: 'inherit' });
    console.log('wrote', f);
  }
}
await browser.close();
console.log('\n| Story | Words | Was | Now | Words a second |\n| --- | --- | --- | --- | --- |');
for (const o of out) console.log(`| ${o.key}${o.recorded ? ' (recorded)' : ''} | ${o.words} | ${mmss(o.old)} | ${mmss(o.new)} | ${o.oldRate.toFixed(2)} -> ${o.newRate.toFixed(2)} |`);
if (write && out.some(o => !o.recorded)) console.log('\nNow update the lengths (len in stories/list.js, audio/PUT-narration.mp3-HERE.txt), bump VERSION in sw.js and run tools/narration.mjs.');
