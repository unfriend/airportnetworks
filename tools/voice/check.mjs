// Checks a story narrated with narrate.mjs in headless Chromium, from the recording the page itself decodes:
//   - every spoken line starts 0.3 s after its cue (the words found in the decoded audio against NARRATION_SYNC and the
//     panel's data-at cues), and nothing else is spoken; each chapter starts with its heading's words and its words end
//     where NARRATION_ENDS says, before its slideshow stop;
//   - the story's clock follows the sound while it plays;
//   - a jump to a line lands the sound there, in step with the clock;
//   - the slideshow stops at each chapter's end with the voice finished, and Next goes on with the sound.
// Whether it sounds right can only be heard.
// Usage: serve the folder, then node tools/voice/check.mjs <key> [base-url] [--quick] (--quick: three chapters'
// slideshow stops instead of all). PLAYWRIGHT_MODULE and CHROMIUM_PATH as in tools/smoke.mjs.
const args = process.argv.slice(2);
const key = args.find(a => !a.startsWith('--') && !/^https?:/.test(a)), base = args.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8123/';
if (!key) { console.error('usage: node tools/voice/check.mjs <story key> [base-url] [--quick]'); process.exit(1); }
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const ok = (good, what) => { console.log((good ? 'ok   ' : 'FAIL ') + what); if (!good) failed++; };
const probe = () => page.evaluate(() => { const n = HOST.cur && HOST.cur.peek('AUD'); return { t: HOST.cur.peek('APP.t'), playing: HOST.cur.peek('APP.playing'), pos: n && n.pos(), label: n && n.label(), at: HOST.cur.peek('SLIDE.at') }; });
async function until(what, test, ms = 30000) {
  const t0 = Date.now();
  let p;
  while (Date.now() - t0 < ms) { p = await probe(); if (test(p)) return p; await wait(100); }
  throw new Error(`${what}: ${JSON.stringify(p)}`);
}

await page.goto(base + 'index.html');
await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.list && document.querySelector('#picker .card'), null, { timeout: 30000 });
await page.click(`#picker .card[data-story="${key}"]`); // a real tap: it unlocks the sound and starts the story
await page.waitForFunction(k => HOST.curKey === k && HOST.cur && !HOST.busy && HOST.cur.peek('AUD && AUD.buf'), key, { timeout: 120000 });
await until('the narration playing', p => p.label === 'Sound on' && p.pos !== null, 30000);
// the longest time between two frames since the last reset (a loaded machine draws software WebGL slowly)
await page.evaluate(() => { let last = performance.now(); window.__gap = 0; const f = () => { const n = performance.now(); window.__gap = Math.max(window.__gap, (n - last) / 1000); last = n; requestAnimationFrame(f); }; requestAnimationFrame(f); });

// ------------------------------------------------------------------ the recording against the story's cues
const R = await page.evaluate(() => {
  const P = HOST.cur.peek, CH = P('CH').map((c, i) => ({ key: c.key, name: c.name, a: c.a, b: c.b, na: P(`narrT(${c.a})`), stop: P(`slideStop(${i})`) }));
  const ends = P('typeof NARRATION_ENDS === "object" ? NARRATION_ENDS : {}');
  // the cues with words to say: not small print, not a button, not a line carrying on the one before (lower case)
  const cues = [];
  for (const sec of document.querySelectorAll('section.ch')) {
    const c = CH.find(c => c.key === sec.dataset.ch);
    for (const el of sec.querySelectorAll('[data-at]')) {
      if (el.closest('.credits')) continue;
      const x = el.cloneNode(true); x.querySelectorAll('button, svg').forEach(b => b.remove());
      const txt = x.textContent.replace(/\s+/g, ' ').trim();
      if (!txt || /^\p{Ll}/u.test(txt)) continue;
      const s = c.a + (+el.dataset.at || 0);
      cues.push({ ch: c.key, s, rec: P(`narrT(${s})`), text: txt.slice(0, 40) });
    }
  }
  // the sound: loud 20 ms windows, joined across gaps under 0.55 s (a sentence's own pauses)
  const b = P('AUD.buf'), d = b.getChannelData(0), sr = b.sampleRate, w = Math.round(sr * 0.02), on = [];
  for (let i = 0; i + w <= d.length; i += w) { let e = 0; for (let j = i; j < i + w; j++) e += d[j] * d[j]; on.push(Math.sqrt(e / w) > 0.01); }
  const spans = [];
  on.forEach((v, i) => { if (!v) return; const t = i * 0.02, l = spans[spans.length - 1]; if (l && t - l[1] < 0.55) l[1] = t + 0.02; else spans.push([t, t + 0.02]); });
  return { CH, ends, cues, spans, dur: b.duration, end: P('T_END') };
});
const near = (x, y, e) => Math.abs(x - y) <= e;
const on = R.cues.map(c => c.rec + 0.3); // where each line's words should start
// a cue's words start there; nothing is heard in the 0.4 s before (the line before has ended); and words that start
// after a longer silence (0.8 s, the least between two lines) start at a cue: a pause inside a line is shorter
const missing = R.cues.filter(c => !R.spans.some(([a]) => near(a, c.rec + 0.3, 0.15)));
const early = R.cues.filter(c => R.spans.some(([a, b]) => a < c.rec - 0.1 && b > c.rec - 0.1));
const stray = R.spans.filter(([a], i) => i && a - R.spans[i - 1][1] >= 0.8 && !on.some(o => near(a, o, 0.15)));
const inner = R.spans.filter(([a], i) => !on.some(o => near(a, o, 0.15))).length;
ok(!missing.length && !early.length && !stray.length, `${R.cues.length} lines, each starting 0.3 s after its cue in the decoded recording (${R.dur.toFixed(1)} s, the story ${R.end.toFixed(1)} s), quiet before each; ${inner} pauses inside lines` +
  (missing.length ? `; no words at ${missing.map(c => `${c.ch} ${c.rec.toFixed(2)} "${c.text}"`).join(', ')}` : '') +
  (early.length ? `; words still going at ${early.map(c => `${c.ch} ${c.rec.toFixed(2)} "${c.text}"`).join(', ')}` : '') +
  (stray.length ? `; words without a cue at ${stray.map(s => s[0].toFixed(2)).join(', ')}` : ''));
for (const [i, c] of R.CH.entries()) {
  const next = R.CH[i + 1] ? R.CH[i + 1].na : R.end, mine = R.spans.filter(([a]) => a >= c.na && a < next);
  const first = R.cues.filter(x => x.ch === c.key).sort((x, y) => x.s - y.s)[0], last = mine.length ? mine[mine.length - 1][1] : null;
  const e = R.ends[c.key];
  ok(mine.length && first && near(mine[0][0], first.rec + 0.3, 0.15) && e !== undefined && last <= e + 0.05 && last > e - 0.3 && e <= c.stop,
    `${c.name}: starts with "${first ? first.text : '?'}" at ${mine.length ? mine[0][0].toFixed(2) : '-'} s (chapter at ${c.na.toFixed(2)}); words end at ${last === null ? '-' : last.toFixed(2)} (NARRATION_ENDS ${e}), stop at ${c.stop.toFixed(2)}`);
}

// ------------------------------------------------------------------ the clock follows the sound
{
  // (after a moment: the clock eases onto the sound once it starts; software WebGL draws a frame every 0.1 s or so)
  // the clock moves once a frame, so it may lag the sound by the longest time between two frames (gap, measured)
  await wait(2000);
  await page.evaluate(() => { window.__gap = 0; });
  const q = [];
  for (let k = 0; k < 16; k++) { q.push(await probe()); await wait(250); }
  const gap = await page.evaluate(() => window.__gap);
  const d = q.filter(p => p.pos !== null).map(p => Math.abs(p.pos - p.t)).sort((a, b) => a - b);
  ok(d.length >= 14 && d[d.length - 1] < 0.3 + gap && q[q.length - 1].pos > q[0].pos + 3, `the clock follows the sound: ${q[0].t.toFixed(2)} -> ${q[q.length - 1].t.toFixed(2)} s, ${d[d.length >> 1].toFixed(2)} s apart (median), at most ${d[d.length - 1].toFixed(2)} (frames up to ${gap.toFixed(2)} s apart)`);
}

// ------------------------------------------------------------------ jumps
const pick = R.cues.filter((c, i) => i % Math.max(1, Math.floor(R.cues.length / 6)) === 3).slice(0, 6);
for (const c of pick) {
  await page.evaluate(t => HOST.cur.peek(`(APP.seek(${t}), APP.playing || APP.togglePlay())`), c.rec);
  try {
    const p = await until('sound at the line', p => p.pos !== null && p.pos > c.rec + 0.6 && Math.abs(p.pos - p.t) < 0.3, 8000);
    const span = R.spans.find(([a, b]) => a <= p.pos && p.pos <= b + 0.1);
    ok(span && near(span[0], c.rec + 0.3, 0.15), `a jump to "${c.text}" (${c.rec.toFixed(2)} s): the sound at ${p.pos.toFixed(2)}, the clock at ${p.t.toFixed(2)}, inside its words (from ${span ? span[0].toFixed(2) : '-'})`);
  } catch (e) { ok(false, `a jump to "${c.text}": ${e.message}`); }
}

// ------------------------------------------------------------------ the slideshow
await page.evaluate(k => HOST.slides.set(k, true), key);
const which = args.includes('--quick') ? [0, Math.floor(R.CH.length / 2), R.CH.length - 1] : R.CH.map((c, i) => i);
for (const i of which) {
  const c = R.CH[i], e = R.ends[c.key];
  await page.evaluate(t => HOST.cur.peek(`(APP.seek(${t}), APP.playing || APP.togglePlay())`), Math.max(c.na, c.stop - 2.5));
  let heard = -1;
  try {
    const p = await until(`stop ${i}`, p => { if (p.pos !== null && p.pos < c.stop + 1) heard = Math.max(heard, p.pos); return p.at === i && !p.playing; }, 20000);
    await wait(600);
    const q = await probe();
    ok(near(p.t, c.stop, 0.01) && heard >= Math.min(e, c.stop - 0.3) - 0.15 && q.pos === null,
      `${c.name}: the slideshow waits at ${p.t.toFixed(2)} (stop ${c.stop.toFixed(2)}); the voice heard to ${heard.toFixed(2)} (words end ${e}), then quiet`);
    await page.evaluate(() => document.getElementById('btnNext').click());
    if (i < R.CH.length - 1) {
      await until('Next', p => p.playing && p.pos !== null && p.t > c.stop + 0.3, 10000);
      await page.evaluate(() => { window.__gap = 0; });
      await wait(1000);
      const n = await probe(), gap = await page.evaluate(() => window.__gap);
      ok(n.playing && n.pos !== null && Math.abs(n.pos - n.t) < 0.3 + gap, `  Next: playing on, the sound at ${n.pos === null ? '-' : n.pos.toFixed(2)} with the clock at ${n.t.toFixed(2)} (frames up to ${gap.toFixed(2)} s apart)`);
    }
  } catch (err) { ok(false, `${c.name}: ${err.message}`); }
}
await page.evaluate(() => HOST.slides.set(HOST.curKey, false));
ok(!errors.length, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
