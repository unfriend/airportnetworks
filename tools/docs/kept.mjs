// A loss check for restructured docs: is every piece of the old text somewhere in the new files?
// usage (from the repository root): node tools/docs/kept.mjs <old file | git rev:path> <new file>... [--allow <file>]
//   [--history <file>]... [--exact]
//   e.g. node tools/docs/kept.mjs HEAD:docs/agents/shell.md docs/agents/shell.md docs/history.md
// The old text is cut into pieces: each paragraph, bullet, table cell and heading, then each of those into sentences
// (after . ! ? or ; and a space). Each piece is normalised (markdown marks `, *, leading #, -, >, 1. and | gone,
// [text](url) as text (url), HTML comments and the generated tables of contents between the toc markers gone,
// whitespace collapsed, a final . ; : or , dropped) and looked for in the new files, normalised the same way and run
// together. A piece found nowhere is listed with its old line number; exit 1 if any.
// --allow <file>: pieces that may go (one a line, written as the list prints them; # starts a comment line). The
// writer lists there what was dropped on purpose (a stale line, history moved out and summarised), so the check
// stays green and the file says what went. Pieces under 4 characters are not checked.
// --history <file> (repeatable): a new file that is history, not the live text: a piece found only there is counted and
// listed as history-only (it is kept, but a rule that only a history file holds is not live); the exit code is as before.
// --exact: a piece counts only when a whole piece of a new file equals it (a substring of a longer sentence does not).
// What it cannot see: a rule weakened by words added to it ('Always do X' kept inside 'Always do X unless tired'), several
// sentences joined with a comma, and the order of the text. It checks that text is present, not what it means. To see what
// was added or reworded, swap the arguments (the new live file as the old one: the pieces not found are the new ones).
import fs from 'fs';
import { execFileSync } from 'child_process';

const args = process.argv.slice(2), ai = args.indexOf('--allow');
const allowFile = ai >= 0 ? args[ai + 1] : '';
const hist = args.flatMap((a, i) => a === '--history' ? [args[i + 1]] : []), exact = args.includes('--exact');
const pos = args.filter((a, i) => !a.startsWith('--') && !(ai >= 0 && i === ai + 1) && args[i - 1] !== '--history');
if (pos.length < 2) { console.log('usage: node tools/docs/kept.mjs <old file | git rev:path> <new file>... [--allow <file>] [--history <file>]... [--exact]'); process.exit(2); }
const readOld = s => fs.existsSync(s) ? fs.readFileSync(s, 'utf8') : execFileSync('git', ['show', s], { encoding: 'utf8', maxBuffer: 1 << 28 });

// markdown marks out, whitespace collapsed (the same on both sides)
const norm = s => s.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1 ($2)').replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();
const lineMark = l => l.replace(/^\s*(#{1,6}\s+|[-+]\s+|\d+\.\s+|>\s?)+/, '');
// the text without HTML comments and generated tables (each comment kept as blank lines so line numbers hold)
const clean = t => t.replace(/\r/g, '').replace(/<!-- toc \(tools\/docs\/toc\.mjs\) -->[^]*?<!-- \/toc -->/g, m => m.replace(/[^\n]/g, ''))
  .replace(/<!--[^]*?-->/g, m => m.replace(/[^\n]/g, ''));

// blocks: { line, text }: a heading, a bullet (with its continuation lines), a paragraph, a table cell
function blocks(text) {
  const out = []; let cur = null;
  const flush = () => { if (cur) out.push(cur); cur = null; };
  text.split('\n').forEach((l, i) => {
    if (!l.trim() || /^\s*(```|~~~)/.test(l) || /^\s*\|?\s*:?-{3,}/.test(l)) { flush(); return; }
    if (/^\s*\|/.test(l)) { flush(); for (const c of l.split('|')) if (c.trim()) out.push({ line: i + 1, text: c }); return; }
    if (/^\s*(#{1,6}\s|[-+*]\s|\d+\.\s|>)/.test(l)) { flush(); cur = { line: i + 1, text: lineMark(l) }; if (/^\s*#/.test(l)) flush(); return; }
    if (cur) cur.text += ' ' + l; else cur = { line: i + 1, text: l };
  });
  flush();
  return out;
}
const pieces = text => {
  const out = [];
  for (const b of blocks(clean(text))) for (const s of norm(b.text).split(/(?<=[.!?;])\s+/)) {
    const p = s.replace(/[.;:,]+$/, '').trim();
    if (p.length >= 4) out.push({ line: b.line, p });
  }
  return out;
};

const old = pieces(readOld(pos[0]));
// the new files: one run of text (blocks joined by a space), and the set of their own pieces for a quick exact match
const newTexts = pos.slice(1).concat(hist).map(f => clean(fs.readFileSync(f, 'utf8')));
const hay = newTexts.map(t => blocks(t).map(b => norm(b.text)).join(' ')).join(' \u0000 ');
const quick = new Set(newTexts.flatMap(t => pieces(t).map(x => x.p)));
// the live files alone (pos minus the old file; --history files are among the new files above but not here)
const liveTexts = pos.slice(1).map(f => clean(fs.readFileSync(f, 'utf8')));
const liveHay = liveTexts.map(t => blocks(t).map(b => norm(b.text)).join(' ')).join(' \u0000 ');
const liveQuick = new Set(liveTexts.flatMap(t => pieces(t).map(x => x.p)));
const allow = new Set(allowFile ? fs.readFileSync(allowFile, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => l.replace(/^\d+:\s/, '')) : []);

let lost = 0, allowed = 0, histOnly = 0;
const found = (q, h, p) => q.has(p) || (!exact && h.includes(p));
for (const { line, p } of old) {
  if (found(quick, hay, p)) {
    if (hist.length && !found(liveQuick, liveHay, p)) { histOnly++; console.log(`${line}: [history only] ${p}`); }
    continue;
  }
  if (allow.has(p)) { allowed++; continue; }
  lost++; console.log(`${line}: ${p}`);
}
console.log(`${old.length} pieces of ${pos[0]}: ${old.length - lost - allowed} kept${hist.length ? ` (${old.length - lost - allowed - histOnly} in the live files, ${histOnly} only in history)` : ''}, ${allowed} allowed, ${lost} not found in ${pos.slice(1).concat(hist).join(', ')}`);
process.exit(lost ? 1 : 0);
