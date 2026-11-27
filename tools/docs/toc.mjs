// A table of contents at the top of a big doc, so an agent reads the index and then one section's line range.
// usage (from anywhere): node tools/docs/toc.mjs [--check] [file.md ...]
//   default files: docs/agents/shared-rooms.md, shell.md, studio.md, stories.md, packages.md, testing.md
//   writes between <!-- toc (tools/docs/toc.mjs) --> and <!-- /toc --> one line per heading (## and deeper; the file's
//   # title is left out): its line number, the heading, the section's size in KB (to the next heading of the same or a
//   higher level, so a section counts its subsections). The markers go after the # title and its blank line when the
//   file has none yet. The line numbers are those of the file as written, table included.
//   --check: writes nothing; exits 1 when a file's table is missing or not current.
// Headings inside ``` fences are not headings. Nothing outside the markers is changed.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2), check = args.includes('--check');
const DEF = ['shared-rooms', 'shell', 'studio', 'stories', 'packages', 'testing'].map(k => `docs/agents/${k}.md`);
const files = args.filter(a => !a.startsWith('--'));
const OPEN = '<!-- toc (tools/docs/toc.mjs) -->', CLOSE = '<!-- /toc -->';
const kb = s => (Buffer.byteLength(s, 'utf8') / 1024).toFixed(1);

// the file without its table (and the blank line after it), and where the table goes
function strip(lines) {
  const a = lines.indexOf(OPEN), b = lines.indexOf(CLOSE);
  if (a >= 0 && b > a) { const rest = lines.slice(0, a).concat(lines.slice(b + 1 + (lines[b + 1] === '' ? 1 : 0))); return { lines: rest, at: a }; }
  let at = 0;
  if (/^# /.test(lines[0] || '')) { at = 1; if (lines[1] === '') at = 2; }
  return { lines, at };
}
// the headings of the file without its table: { i (0-based), level, text }
function headings(lines) {
  const out = []; let fence = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) { fence = !fence; return; }
    const m = !fence && /^(#{2,6})\s+(.*?)\s*#*\s*$/.exec(l);
    if (m) out.push({ i, level: m[1].length, text: m[2] });
  });
  return out;
}
function toc(text) {
  const nl = text.endsWith('\n'), { lines, at } = strip(text.replace(/\n$/, '').split('\n')), hs = headings(lines);
  const size = hs.length + 3;   // (the two markers, a line a heading and the blank line after)
  const body = hs.map((h, k) => {
    const end = (hs.slice(k + 1).find(o => o.level <= h.level) || { i: lines.length }).i;
    const sec = lines.slice(h.i, end).join('\n') + '\n';
    const line = h.i + 1 + (h.i >= at ? size : 0);
    return `${'  '.repeat(h.level - 2)}- ${line}: ${h.text} (${kb(sec)} KB)`;
  });
  const block = [OPEN, ...body, CLOSE, ''];
  return lines.slice(0, at).concat(block, lines.slice(at)).join('\n') + (nl ? '\n' : '');
}

let stale = 0;
for (const f of files.length ? files : DEF) {
  const p = path.resolve(files.length ? process.cwd() : root, f);
  if (!fs.existsSync(p)) { console.log(`${f}: not there`); stale++; continue; }
  const text = fs.readFileSync(p, 'utf8'), out = toc(text), n = (out.split('\n').indexOf(CLOSE)) - out.split('\n').indexOf(OPEN) - 1;
  if (out === text) { console.log(`${f}: current (${n} headings)`); continue; }
  if (check) { console.log(`${f}: out of date: run node tools/docs/toc.mjs ${f}`); stale++; continue; }
  fs.writeFileSync(p, out); console.log(`${f}: wrote its table (${n} headings)`);
}
if (check && stale) process.exit(1);
