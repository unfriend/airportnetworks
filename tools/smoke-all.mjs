// The whole smoke test, block by block: each block of tools/smoke.mjs (its ids: node tools/smoke.mjs --blocks) run as
// `node tools/smoke.mjs <url> --block <id>`, k at a time against one server, each under its own timeout, then one table.
// One run of the whole test in one process takes about 1.5 h; this splits it so a machine's cores share it, and a block
// that hangs or crashes costs only itself.
//   node tools/smoke-all.mjs [url] [-j 2] [--shard i/n] [--blocks a,b,...] [--from id] [--timeout 900] [--logs dir]
//                            [--skip-missing]
// url: a plain server of this folder (python3 -m http.server 8123); without one it serves the folder itself on a free port.
// -j k: blocks at once (default 2: each is a headless Chromium drawing in software; a machine with few cores gets timing
//   failures beyond that). --shard i/n: only the blocks whose place in the list is i modulo n (0-based), for several
//   machines or sessions. --blocks: only these ids (comma-separated). --from: the list from this id on. --timeout: seconds
//   a block may take (default 900; a few long blocks have more, LONG below). --logs: where each block's output goes
//   (default a new folder in the system's temporary folder). --list: the ids and their timeouts, nothing run. --help: this.
// Exit 1 when any block failed or timed out. Timing checks fail under load: run a failed block again alone
// (`node tools/smoke.mjs <url> --block <id>`) before calling it real.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SMOKE = path.join(ROOT, 'tools', 'smoke.mjs');
const A = process.argv.slice(2);
const val = (f, d) => { const i = A.indexOf(f); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d; };
if (A.includes('--help') || A.includes('-h')) {
  const text = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n');
  console.log(text.slice(0, text.findIndex(l => !l.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}
const FLAGS = new Set(['-j', '--shard', '--blocks', '--from', '--timeout', '--logs']);
const url = A.find((a, i) => !a.startsWith('-') && !FLAGS.has(A[i - 1]));
const J = Math.max(1, +val('-j', 2) || 2), TIMEOUT = +val('--timeout', 900) || 900;
// blocks known to take longer than the default on this kind of machine (seconds)
const LONG = { 'studio': 1500, 'frame rate': 1200, 'studio examples': 1200, 'studio screens': 1200, 'take all': 1200, 'headset settings': 1500, 'spaceship': 1200 };

let ids = execFileSync(process.execPath, [SMOKE, '--blocks'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const only = val('--blocks', null);
if (only) {
  const want = only.split(',').map(s => s.trim()).filter(Boolean), unknown = want.filter(w => !ids.includes(w));
  if (unknown.length) { console.log('no such block: ' + unknown.join(', ') + '\nthe blocks:\n  ' + ids.join('\n  ')); process.exit(2); }
  ids = ids.filter(id => want.includes(id));
}
const from = val('--from', null);
if (from) { const k = ids.indexOf(from); if (k < 0) { console.log('no such block: ' + from); process.exit(2); } ids = ids.slice(k); }
const shard = val('--shard', null);
if (shard) {
  const m = /^(\d+)\/(\d+)$/.exec(shard);
  if (!m || +m[1] >= +m[2]) { console.log('--shard i/n, 0 <= i < n'); process.exit(2); }
  ids = ids.filter((id, k) => k % +m[2] === +m[1]);
}
const limit = id => Math.max(TIMEOUT, LONG[id] || 0);
if (A.includes('--list')) { for (const id of ids) console.log(`${id}\t${limit(id)} s`); process.exit(0); }

const logs = val('--logs', null) || fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-all-'));
fs.mkdirSync(logs, { recursive: true });
const srv = url ? null : await serve(ROOT);
const base = url || srv.url;
const pass = A.includes('--skip-missing') ? ['--skip-missing'] : [];
console.log(`smoke-all: ${ids.length} blocks, ${J} at a time, against ${base}; logs in ${logs}`);

const results = new Map();
const runOne = id => new Promise(done => {
  const file = path.join(logs, id.replace(/[^a-z0-9]+/gi, '-') + '.log'), out = fs.createWriteStream(file), t0 = Date.now();
  const ch = spawn(process.execPath, [SMOKE, base, '--block', id, ...pass], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, SMOKE_SHOW: '1' } });
  let text = '', timedOut = false;
  const take = d => { text += d; out.write(d); };
  ch.stdout.on('data', take); ch.stderr.on('data', take);
  // (a block past its time is stopped: SIGTERM, which Playwright answers by closing its browser; SIGKILL 15 s later)
  const timer = setTimeout(() => { timedOut = true; ch.kill('SIGTERM'); setTimeout(() => ch.kill('SIGKILL'), 15000).unref(); }, limit(id) * 1000);
  ch.on('close', code => {
    clearTimeout(timer); out.end();
    const fails = text.split('\n').filter(l => l.startsWith('FAIL ')).map(l => l.slice(5)), oks = text.split('\n').filter(l => l.startsWith('ok   ')).length;
    const r = { id, status: timedOut ? 'TIMEOUT' : code === 0 ? 'ok' : 'FAILED', code, s: Math.round((Date.now() - t0) / 1000), oks, fails, log: file };
    results.set(id, r);
    console.log(`${r.status.padEnd(7)} ${id} (${r.s} s, ${oks} ok, ${fails.length} failed)${fails.length ? '\n        ' + fails.map(f => f.slice(0, 160)).join('\n        ') : ''}`);
    done(r);
  });
});
const queue = ids.slice();
await Promise.all(Array.from({ length: Math.min(J, queue.length) }, async () => { while (queue.length) await runOne(queue.shift()); }));
if (srv) await srv.close();

const rows = ids.map(id => results.get(id));
const w = Math.max(5, ...ids.map(i => i.length));
console.log('\n' + 'block'.padEnd(w) + '  result   time  steps ok  failed');
for (const r of rows) console.log(`${r.id.padEnd(w)}  ${r.status.padEnd(7)} ${String(r.s).padStart(5)} s ${String(r.oks).padStart(8)}  ${r.fails.length}`);
const bad = rows.filter(r => r.status !== 'ok');
console.log(`\n${rows.length - bad.length} of ${rows.length} blocks ok; ${rows.reduce((a, r) => a + r.s, 0)} s of block time.` + (bad.length ? ' Not ok: ' + bad.map(r => r.id).join(', ') : ''));
fs.writeFileSync(path.join(logs, 'results.json'), JSON.stringify(rows, null, 1));
process.exit(bad.length ? 1 : 0);
