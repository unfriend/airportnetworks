// Narration scripts: writes docs/narration.md, the words on each story's panel chapter by chapter, with the second
// each line appears, to record a narration from (docs/narration-timings.txt says where the files go).
// The text is read from the running stories, so their numbers are the ones the data gives today.
// Usage: serve the folder, then node tools/narration.mjs http://127.0.0.1:8123/ [docs/narration.md]
// PLAYWRIGHT_MODULE and CHROMIUM_PATH as in smoke.mjs.
import fs from 'node:fs';
import { stories } from './stories.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [base = 'http://127.0.0.1:8123/', out = 'docs/narration.md'] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
await page.goto(base + 'index.html');
await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.list && (!HOST.packages || HOST.packages.state().read), null, { timeout: 30000 });
// (the app's own stories on either set of cards: HOST.stories, the Experiments set's too, v188; other people's packages not)
const list = await page.evaluate(() => (HOST.stories ? HOST.stories().filter(s => !s.pkg || s.app) : HOST.list).map(s => ({ key: s.key, kick: s.kick, title: s.title, len: s.len })));
const mmss = s => { const n = Math.floor(Math.round(s * 100) / 100); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
const docs = [];
for (const s of list) {
  await page.evaluate(k => HOST.start(k), s.key);
  await page.waitForFunction(k => HOST.curKey === k && HOST.cur && !HOST.busy && document.querySelector('section.ch'), s.key, { timeout: 60000 });
  const read = () => page.evaluate(() => {
    const CH = HOST.cur.peek('CH').map(c => ({ key: c.key, name: c.name, a: c.a, b: c.b }));
    let sync = null;
    try { sync = HOST.cur.peek('NARRATION_SYNC'); } catch (e) { /* none */ }
    let file = '';
    try { file = HOST.cur.peek('AUD && AUD.url') || ''; } catch (e) { /* not kept */ }
    const lines = {};
    for (const sec of document.querySelectorAll('section.ch')) {
      // each run of text under the same nearest data-at element is one line, timed from the chapter's start
      const L = [], walk = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
      let last = null;
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const p = n.parentElement;
        if (!p || p.closest('svg, script, style, button, .bars')) continue;   // (a chart's values and labels are no line to read)
        const txt = n.textContent.replace(/\s+/g, ' ');
        if (!txt.trim()) { if (last) last.text += ' '; continue; }
        const at = p.closest('[data-at]'), cue = at && sec.contains(at) ? at : sec;
        // a line's own spoken words (data-say on its cue element; empty: not read), as the voice and the subtitles take it
        if (cue !== sec && cue.hasAttribute('data-say')) {
          if (!(last && last.cue === cue)) { last = { cue, at: +cue.dataset.at || 0, text: cue.dataset.say || ' ' }; L.push(last); }
          last.p = p; continue;
        }
        // a bold name run straight into its text ('<b>Mucosa</b>the lining') gets a colon between (a bold that starts
        // with a number, '<b>23</b>chromosomes', not a numbered step's '1 · Copy': a space); a number straight into
        // its small caption a space; the items of one list a comma
        if (last && last.cue === cue) {
          const b = last.p !== p && /^(B|STRONG)$/.test(last.p.tagName) && /^[\p{L}\p{N}(]/u.test(txt) && /[\p{L}\p{N})%]$/u.test(last.text);
          const li = !b && last.p !== p && !!p.closest('li') && !!last.p.closest('li') && p.closest('li') !== last.p.closest('li') && !/[,.;:!?]\s*$/.test(last.text);
          const cap = !b && !li && last.p !== p && p.tagName === 'SMALL' && /^[\p{L}\p{N}(]/u.test(txt) && /[\p{L}\p{N})%]$/u.test(last.text);
          last.text += (b ? (/^\s*\d/.test(last.p.textContent) && !/·/.test(last.p.textContent) ? ' ' : ': ') : li ? ', ' : cap ? ' ' : '') + txt;
        } else { last = { cue, at: cue === sec ? 0 : +cue.dataset.at || 0, text: txt }; L.push(last); }
        last.p = p;
      }
      lines[sec.dataset.ch] = L.map(l => ({ at: l.at, text: l.text.replace(/\s+/g, ' ').trim() })).filter(l => l.text);
    }
    return { CH, sync, file, lines };
  });
  // a story in two languages (LANGS, setLang): its words in each, the first as the script, the others beside it
  const langs = await page.evaluate(() => HOST.cur.peek('typeof LANGS !== "undefined" ? LANGS : null'));
  const d = await read();
  if (langs) {
    const was = await page.evaluate(() => HOST.cur.peek('LANG'));
    d.other = {};
    for (const l of langs) {
      await page.evaluate(l => HOST.cur.peek(`setLang('${l}', false)`), l);
      const dl = await read();
      if (l === langs[0]) Object.assign(d, { CH: dl.CH, lines: dl.lines }); else d.other[l] = dl;
    }
    await page.evaluate(l => HOST.cur.peek(`setLang('${l}', false)`), was);
    d.langs = langs;
  }
  docs.push(Object.assign(s, d));
  console.log('read', s.key, d.CH.length, 'chapters');
}
await browser.close();

// story time -> time in the recording (NARRATION_SYNC pairs are [recording, story], rising)
const toRec = (sync, t) => {
  if (!Array.isArray(sync) || sync.length < 2) return t;
  for (let i = 1; i < sync.length; i++) {
    const [r0, s0] = sync[i - 1], [r1, s1] = sync[i];
    if (t <= s1 || i === sync.length - 1) return r0 + (s1 === s0 ? 0 : (t - s0) * (r1 - r0) / (s1 - s0));
  }
  return t;
};
// (each story's recording is in its package, packages/<key>/audio/narration[-<lang>].mp3, a second language's with its
// suffix: tools/stories.mjs)
const STORIES = stories(), storyAt = k => { const s = STORIES.get(k); if (!s) throw new Error('no story ' + k + ' in tools/stories.mjs'); return s; };
const fileOf = (k, l) => storyAt(k).narration(l);
// how a story is narrated: a recording, a synthetic voice (made by tools/voice/narrate.mjs, which the story's file names
// beside its NARRATION_SYNC), or nothing yet
const voiceOf = k => {
  if (!fs.existsSync(fileOf(k))) return '';
  let src = '';
  try { src = fs.readFileSync(storyAt(k).file, 'utf8'); } catch (e) { /* not found: a recording */ }
  return /tools\/voice\/narrate\.mjs/.test(src) ? 'synthetic voice' : 'recorded';
};
let md = `# Narration scripts

Generated by \`node tools/narration.mjs\` from the running stories: never edit by hand, run it again after a story's
text changes. For each story, the words on its panel chapter by chapter, with the time each line appears (minutes and
seconds on the recording's clock, from NARRATION_SYNC; for a story not recorded yet, that is the pace \`tools/pace.mjs\`
set from these words). A narration follows these words and times; it can say them more freely, but the numbers must
stay as they are (they come from the data).

How to record and fit a narration: see "Recording a narration" in \`docs/narration-timings.txt\`. In short, put the
MP3 at the file named under each story; if your chapters start at other times, change NARRATION_SYNC (pairs of
[time in the recording, story time]) in the story's source (\`packages/<key>/src/engine/e3_story.js\`, then rebuild; in
\`packages/<key>/main.js\` for the airports, proteins and spatial stories) and run the smoke test.

`;
md += '| Story | File | Narration | Length |\n| --- | --- | --- | --- |\n';
for (const d of docs) md += `| ${d.kick}: ${d.title} | \`${fileOf(d.key)}\` | ${voiceOf(d.key) || 'not yet'} | ${mmss(toRec(d.sync, d.CH[d.CH.length - 1].b))} |\n`;
for (const d of docs) {
  md += `\n## ${d.kick}: ${d.title} (\`#${d.key}\`)\n\nFile: \`${fileOf(d.key)}\`${voiceOf(d.key) ? ` (${voiceOf(d.key)})` : ' (not recorded yet)'}. ` +
    `Chapters: ${d.CH.map(c => `${mmss(toRec(d.sync, c.a))} ${c.name}`).join(', ')}; it ends at ${mmss(toRec(d.sync, d.CH[d.CH.length - 1].b))}.\n`;
  if (d.langs) md += d.langs.slice(1).every(l => fs.existsSync(fileOf(d.key, l)))
    ? `\nIn ${d.langs.length} languages (${d.langs.join(', ')}), each with its own recording on one timeline (${d.langs.map((l, i) => `\`${fileOf(d.key, i ? l : '')}\``).join(', ')}): every line has the time of the longer of its two recordings.\n`
    : `\nIn ${d.langs.length} languages (${d.langs.join(', ')}): the recording follows the first; the others are what readers see in theirs (the pace gives each line the time of its longer text).\n`;
  for (const c of d.CH) {
    md += `\n### ${mmss(toRec(d.sync, c.a))} ${c.name}\n\n`;
    for (const l of d.lines[c.key] || []) md += `- **${mmss(toRec(d.sync, c.a + l.at))}** ${l.text}\n`;
    for (const [l, o] of Object.entries(d.other || {})) {
      const oc = o.CH.find(x => x.key === c.key);
      md += `\n${l.toUpperCase()}: ${oc ? oc.name : ''}\n\n`;
      for (const x of o.lines[c.key] || []) md += `- **${mmss(toRec(d.sync, c.a + x.at))}** ${x.text}\n`;
    }
  }
}
fs.writeFileSync(out, md);
console.log('wrote', out, (md.length / 1024).toFixed(0), 'KB');
