#!/usr/bin/env node
// The headset bench's tool for the cloud (tools/bench/SPEC.md, section 8): see which headsets listen, send a job (one step,
// or a plan file) and wait for its result, list and read results, fetch pictures, cancel, delete. Node 22, no packages.
// NOTES_RELAY (default the test place) and NOTES_TOKEN (the relay's password; never printed, written or put in an
// address), as tools/notes/notes.mjs takes them.
// Exits: 0 done, 1 a job failed or a usage error, 2 the relay refused (401, or 404: this relay has no bench), 3 no headset
// is listening (checked before sending, and again when a wait ends with the job still queued).
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RELAY = (process.env.NOTES_RELAY || 'https://stories.lab.lbi-netmed.com').replace(/\/+$/, '');
const TOKEN = process.env.NOTES_TOKEN || '';
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '..', '..');
const NOBODY = 'No headset is listening: put bench mode on at the headset (developer mode, Debug tab).';
const die = (m, code = 1) => { console.error(m); process.exit(code); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(path, body, o = {}) {
  let r;
  const headers = { ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) };
  const go = () => fetch(RELAY + path, { method: body !== undefined ? 'POST' : 'GET', headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  try { try { r = await go(); } catch (e) { await sleep(1000); r = await go(); } } catch (e) { die('Could not reach ' + RELAY + ': ' + e.message); }
  if (r.status === 401) die('The relay wants its password: set NOTES_TOKEN.', 2);
  if (r.status === 404 && /^\/api\/bench(\/next|\/hello)?$/.test(path.split('?')[0])) die('This relay has no bench (it was not started with --bench): ' + RELAY, 2);
  if (o.raw) { if (!r.ok) die('The relay answered ' + r.status + ' for ' + path.split('?')[0]); return Buffer.from(await r.arrayBuffer()); }
  let j = null;
  try { j = await r.json(); } catch (e) { /* not JSON */ }
  if (r.status === 404 && j && j.error === 'this relay has no bench') die('This relay has no bench (it was not started with --bench): ' + RELAY, 2);
  if (!r.ok && !o.soft) die('The relay answered ' + r.status + (j && j.error ? ': ' + j.error : '') + ' (' + path.split('?')[0] + ')');
  return o.soft ? { status: r.status, j } : j;
}

// ---- small formatting
const cell = v => (v === null || v === undefined || v === '' ? '-' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const ago = s => (s < 90 ? s + ' s' : s < 5400 ? Math.round(s / 60) + ' min' : Math.round(s / 3600) + ' h');
const secs = (a, b) => (a && b ? ((b - a) / 1000).toFixed(1) : '-');
const table = (head, rows) => ['| ' + head.join(' | ') + ' |', '|' + head.map((h, i) => (i ? '---:' : '---')).join('|') + '|', ...rows.map(r => '| ' + r.map(cell).join(' | ').replace(/\n/g, ' ') + ' |')].join('\n');

// ---- the headsets
async function heads() { return call('/api/bench'); }
function statusMd(s) {
  const L = [];
  const rows = s.headsets.map(h => { const R = h.report || {}; return [h.hs, ago(h.ago), h.phase, h.why, h.xr || 'page', R.story, R.mode, R.release, R.battery, h.job, h.adb ? ago(h.adb.ago) : '-']; });
  L.push(rows.length ? table(['headset', 'seen', 'phase', 'why', 'session', 'story', 'mode', 'release', 'battery', 'job', 'adb helper'], rows) : 'No headset seen in the last ten minutes.');
  if (s.adb && s.adb.length) L.push('', 'The adb helper: ' + s.adb.map(a => (a.hs === 'adb' ? 'not yet beside a page' : 'beside ' + a.hs) + ', ' + ago(a.ago) + ' ago').join('; ') + '.');
  L.push('', `Jobs: ${s.queued} queued, ${s.running} running.`);
  return L.join('\n');
}
// a headset that asked within the last minute (the one named, or any)
const listening = (s, hs) => s.headsets.filter(h => h.ago <= 60 && (!hs || h.hs === hs));
// the adb helper asked within the last minute (it asks every 20 s while it watches)
const helping = (s, hs) => (s.adb || []).filter(a => a.ago <= 60 && (!hs || a.hs === hs));
const NOHELPER = 'The adb helper is not listening: on the owner\'s computer, node tools/bench/adb/adb.mjs --watch (tools/bench/adb/README.md).';

// ---- a job's record as Markdown
const SEGCOLS = ['step', 'story', 's', 'frames', 'mean', 'p50', 'p95', 'p99', 'worst', 'missed', 'stall', 'calls', 'tris k', 'js', 'lines', 'pts', 'tex', 'geo', 'prog', 'heap', 'q', 'errs'];
const segRow = (label, g) => [label, g.story, g.dur, g.n, g.mean, g.p50, g.p95, g.p99, g.max, g.miss, g.stall, g.calls, g.tri != null ? Math.round(g.tri / 1000) : null, g.js, g.lines, g.pts, g.tex, g.geo, g.prog, g.heap, g.q, g.errs];
function figures(s) {
  const o = s.out || {};
  switch (s.cmd) {
    case 'report': return `${o.release || ''} ${o.xr ? o.xr.toUpperCase() : 'page'} ${o.hz ? o.hz + ' Hz' : ''} ${o.story || ''} ${o.mode || ''} battery ${cell(o.battery)}`.replace(/\s+/g, ' ').trim();
    case 'open': return `${o.key || ''}${o.scene ? ' ' + o.scene : ''}: load ${cell(o.load)} ms, build ${cell(o.build)} ms${o.was ? ' (already open)' : ''}`;
    case 'seek': return `${o.mode} chapter ${cell(o.chapter)} t ${cell(o.t)}${o.playing ? ' playing' : ''}`;
    case 'play': case 'pause': return `t ${cell(o.t)}${o.playing ? ' playing' : ' paused'}`;
    case 'explore': return `tab ${cell(o.tab)} of ${(o.tabs || []).join(', ') || 'none'}`;
    case 'set': return `${o.name}: ${cell(o.was)} -> ${cell(o.now)}`;
    case 'measure': return `${o.n} frames, mean ${o.mean} ms, p95 ${o.p95} ms, ${cell(o.miss)} missed`;
    case 'rays': return `${o.frames} frames, ${cell(o.hovers)} hovering, ${o.pressed || 0} presses` + (o.seg ? `; mean ${o.seg.mean} ms, js ${o.seg.js} ms` : '');
    case 'pic': return `picture ${o.n}: ${o.w} x ${o.h}, ${Math.round((o.bytes || 0) / 1024)} KB`;
    case 'probe': return JSON.stringify(o).slice(0, 160);
    case 'wait': return `${o.waited} s`;
    default: return s.out ? JSON.stringify(s.out).slice(0, 120) : '';
  }
}
function showMd(r) {
  const L = [`# Bench job ${r.id}: ${r.label}`, ''];
  const R = (r.result && r.result.report) || {};
  L.push(`- State: **${r.state}**${r.why ? ' (' + r.why + ')' : ''}; ${r.steps.length} steps; asked ${new Date(r.at).toISOString().slice(0, 19).replace('T', ' ')} UTC` + (r.taken ? `, taken ${secs(r.at, r.taken)} s later by ${r.hs}` : '') + (r.ended ? `, ended after ${secs(r.taken || r.at, r.ended)} s` : '') + (r.asked ? `; why: ${r.asked}` : ''));
  if (R.release) L.push(`- ${[R.device, R.model, R.browser].filter(Boolean).join(', ')}; release ${R.release} (served ${cell(R.served)}); ${R.xr ? R.xr.toUpperCase() : 'a page'} at ${cell(R.hz)} Hz${R.eyeW ? `, eye ${R.eyeW} x ${R.eyeH}` : ''}; battery ${cell(R.battery)} %`);
  if (R.settings) L.push(`- Settings: ${Object.entries(R.settings).map(([k, v]) => k + ' ' + cell(v)).join(', ')}`);
  if (r.progress && r.state === 'running') L.push(`- Now: step ${r.progress.step + 1} of ${r.progress.of} (${r.progress.note})`);
  const steps = (r.result && r.result.steps) || [];
  if (steps.length) {
    L.push('', table(['#', 'cmd', 'ok', 's', 'figures', 'error'], steps.map(s => [s.i + 1, s.cmd + (s.label ? ' (' + s.label + ')' : ''), s.ok ? 'yes' : 'NO', secs(s.t0, s.t1), figures(s), s.err || ''])));
    const segs = [];
    for (const s of steps) {
      if (s.cmd === 'measure' && s.out && s.out.n !== undefined) segs.push([`${s.i + 1} measure${s.out.key ? ' ' + s.out.key : ''}`, s.out]);
      if (s.cmd === 'rays' && s.out && s.out.seg) segs.push([`${s.i + 1} rays`, s.out.seg]);
      if (s.cmd === 'probe' && s.out && s.out.frame && s.out.pick) segs.push([`${s.i + 1} probe picks`, Object.assign({ story: s.out.story }, s.out.frame)]);
    }
    if (segs.length) L.push('', '## Measured', '', table(SEGCOLS, segs.map(([l, g]) => segRow(l, g))));
    const picks = steps.filter(s => s.cmd === 'probe' && s.out && s.out.pick);
    if (picks.length) L.push('', '## Picking', '', table(['step', 'story', 'frames', 'pick ms a frame', 'picks a frame', 'slowest pick ms'], picks.map(s => [s.i + 1, s.out.story, s.out.frames, s.out.pick.msFrame, s.out.pick.perFrame, s.out.pick.worst])));
    const errs = [];
    for (const s of steps) for (const e of ((s.out && (s.out.errlist || (s.out.seg && s.out.seg.errlist))) || [])) errs.push(`- step ${s.i + 1}: ${e.lvl} x${e.n}: ${e.msg}`);
    if (errs.length) L.push('', '## Errors and warnings', '', ...errs);
  }
  if (r.pics && r.pics.length) L.push('', `Pictures: ${r.pics.map(p => p.n + ' (' + Math.round(p.bytes / 1024) + ' KB)').join(', ')}: node tools/bench/bench.mjs pic ${r.id}`);
  if (r.adb) {
    const V = r.adb.vrapi;
    L.push('', '## The headset\'s own frame statistics (adb, VrApi)', '');
    if (!V) L.push(r.adb.notes || 'none');
    else {
      const A = V.all || {};
      L.push(table(['', 'fps', 'fps min', 'stale', 'cpu level', 'gpu level', 'cpu %', 'gpu %', 'temp C'], [['all', A.fps, A.fpsMin, A.stale, A.cpuLvl, A.gpuLvl, A.cpuPct != null ? Math.round(A.cpuPct * 100) : null, A.gpuPct != null ? Math.round(A.gpuPct * 100) : null, A.tempC],
        ...(V.per || []).map(p => ['step ' + (p.i + 1), p.fps, p.fpsMin, p.stale, p.cpuLvl, p.gpuLvl, p.cpuPct != null ? Math.round(p.cpuPct * 100) : null, p.gpuPct != null ? Math.round(p.gpuPct * 100) : null, p.tempC])]));
      if (r.adb.notes) L.push('', r.adb.notes);
    }
  }
  if (r.devshots && r.devshots.length) L.push('', `Device screenshots: ${r.devshots.map(p => p.n).join(', ')}: node tools/bench/bench.mjs devshot ${r.id}`);
  L.push('', '(ms between frames; missed: refreshes with no new frame; calls, tris k, lines, pts: the story\'s frame a frame, both eyes; tex, geo, prog: textures, geometries and shader programs alive at the end; js: script ms a frame.)');
  return L.join('\n') + '\n';
}

// ---- sending and waiting
const ENDED = ['done', 'failed', 'cancelled', 'expired'];
async function waitFor(id, sec, hs) {
  const t0 = Date.now();
  let last = '';
  for (;;) {
    const r = await call('/api/bench/jobs/' + id);
    if (ENDED.includes(r.state)) return r;
    const p = r.progress ? `step ${r.progress.step + 1} of ${r.progress.of} (${r.progress.note})` : r.state;
    if (p !== last) { console.error(`  ${id}: ${p}`); last = p; }
    if (Date.now() - t0 > sec * 1000) {
      if (r.state === 'queued' && r.to === 'adb' && !helping(await heads()).length) die(NOHELPER + ` (job ${id} is still queued)`, 3);
      if (r.state === 'queued' && r.to !== 'adb' && !listening(await heads(), hs).length) die(NOBODY + ` (job ${id} is still queued)`, 3);
      die(`Job ${id} is still ${r.state} after ${sec} s: node tools/bench/bench.mjs show ${id}`, 1);
    }
    await sleep(2000);
  }
}
async function postJob(job, o) {
  const s = await heads();
  if (job.to === 'adb') { if (!helping(s).length) die(NOHELPER, 3); }
  else if (!listening(s, o.hs).length) die(NOBODY + (o.hs ? ` (none with the id ${o.hs})` : ''), 3);
  const a = await call('/api/bench/jobs', job, { soft: true });
  if (a.status !== 201) die('The job was refused: ' + ((a.j && a.j.error) || a.status));
  return a.j.id;
}
const parseVal = v => { try { return JSON.parse(v); } catch (e) { return v; } };
function finish(r, o) {
  if (o.md) { writeFileSync(o.md, showMd(r)); console.error('Written ' + o.md); }
  if (o.json) console.log(JSON.stringify(r, null, 1)); else console.log(showMd(r));
  return r.state === 'done' ? 0 : 1;
}

// ---- the command line
const argv = process.argv.slice(2), cmd = argv[0];
const flags = new Set(['--no-wait', '--json']), withVal = new Set(['--need', '--with', '--hs', '--wait', '--md', '--out', '--state', '--label', '--limit', '--to']);
const O = {}, pos = [];
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (flags.has(a)) O[a.slice(2)] = true;
  else if (withVal.has(a)) { if (argv[i + 1] === undefined) die('Usage: ' + a + ' takes a value'); O[a.slice(2)] = argv[++i]; }
  else if (a.startsWith('--')) die('Not an option: ' + a);
  else pos.push(a);
}
const WAIT = O.wait ? +O.wait : 600;
const USAGE = `Usage: node tools/bench/bench.mjs <command>
  status                                    the headsets listening and the adb helper (exit 3: none)
  send <cmd> [key=value ...] [--need xr|ar|vr|page|any] [--with occl=off,auto=false] [--hs id] [--label text] [--limit s] [--wait s] [--no-wait] [--md out.md] [--json]
                                            one step as a job (report, open story=cdk5, seek chapter=1 play=true, explore tab=0,
                                            set name=occl value=off, measure sec=10, rays preset=sweep sec=10 measure=true, pic,
                                            probe name=picks args={"sec":10}, wait sec=5)
  send <cmd> [key=value ...] --to adb       one step for the adb helper (devshot n=1, enter, open,
                                            vrapi from=<ms> to=<ms> job=<id>: the headset's statistics onto that job)
  run <plan name|file.json> [--hs id] [--wait s] [--no-wait] [--md out.md]   a plan (bench/plans/<name>.json)
  jobs [--state queued,running,...]        the jobs, newest first
  show <id> [--md out.md] [--json]          a job's steps and figures
  pic <id> [n] [--out dir]                  its pictures, saved (default: the system's temporary folder)
  devshot <id> [n] [--out dir]              the adb helper's device screenshots
  cancel <id>
  delete <id> [<id> ...] | delete --state done,failed,cancelled,expired   jobs and their pictures, gone for good (the relay
                                            also deletes ended jobs after a fortnight, and the oldest ended when it is full)
NOTES_RELAY (now ${RELAY}) and NOTES_TOKEN (the relay's password) as tools/notes/notes.mjs.`;

if (cmd === 'status') {
  const s = await heads();
  console.log(statusMd(s));
  if (!listening(s).length) die('\n' + NOBODY, 3);
} else if (cmd === 'send' && pos[0]) {
  const step = { cmd: pos[0] };
  for (const kv of pos.slice(1)) { const i = kv.indexOf('='); if (i < 1) die('Usage: key=value, not ' + kv); step[kv.slice(0, i)] = parseVal(kv.slice(i + 1)); }
  const job = { v: 1, steps: [step] };
  if (O.to) { if (O.to !== 'adb' && O.to !== 'page') die('Usage: --to adb (or page)'); job.to = O.to; }
  if (O.need) job.need = O.need;
  if (O.hs) job.hs = O.hs;
  if (O.label) job.label = O.label;
  if (O.limit) job.limit = +O.limit;
  if (O.with) { job.with = {}; for (const kv of O.with.split(',')) { const i = kv.indexOf('='); if (i < 1) die('Usage: --with name=value,name=value'); job.with[kv.slice(0, i)] = parseVal(kv.slice(i + 1)); } }
  const id = await postJob(job, O);
  console.error('Job ' + id + ' queued.');
  if (O['no-wait']) { console.log(id); process.exit(0); }
  process.exit(finish(await waitFor(id, WAIT, O.hs), O));
} else if (cmd === 'run' && pos[0]) {
  const f = existsSync(pos[0]) ? pos[0] : join(ROOT, 'bench', 'plans', pos[0].replace(/\.json$/, '') + '.json');
  if (!existsSync(f)) die('No such plan: ' + pos[0] + ' (bench/plans/ has the shipped ones)');
  let plan;
  try { plan = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { die(f + ' is not JSON: ' + e.message); }
  const page = plan.page;
  delete plan.page;
  if (O.hs) plan.hs = O.hs;
  const ids = [];
  if (Array.isArray(page) && page.length) ids.push(await postJob(Object.assign({}, plan, { label: (plan.label || 'plan').slice(0, 68) + ' (page part)', need: 'page', steps: page }), O));
  ids.push(await postJob(plan, O));
  console.error('Queued: ' + ids.join(', '));
  if (O['no-wait']) { console.log(ids.join('\n')); process.exit(0); }
  let code = 0;
  for (const id of ids) { const r = await waitFor(id, WAIT, O.hs); code = Math.max(code, finish(r, ids.length > 1 && O.md ? Object.assign({}, O, { md: O.md.replace(/(\.md)?$/, '-' + id + '.md') }) : O)); }
  process.exit(code);
} else if (cmd === 'jobs') {
  const j = await call('/api/bench/jobs' + (O.state ? '?state=' + encodeURIComponent(O.state) : '') + (O.state ? '&' : '?') + 'limit=100');
  console.log(j.jobs.length ? table(['id', 'label', 'state', 'why', 'steps', 'headset', 'ok', 'from'], j.jobs.map(r => [r.id, r.label, r.state, r.why, r.steps, r.hs, r.ok, r.from])) : 'No jobs.');
} else if (cmd === 'show' && pos[0]) {
  process.exit(finish(await call('/api/bench/jobs/' + encodeURIComponent(pos[0])), O) && 0);
} else if ((cmd === 'pic' || cmd === 'devshot') && pos[0]) {
  const r = await call('/api/bench/jobs/' + encodeURIComponent(pos[0])), list = cmd === 'pic' ? r.pics : r.devshots;
  const want = pos[1] ? list.filter(p => p.n === +pos[1]) : list;
  if (!want.length) die('No ' + (cmd === 'pic' ? 'pictures' : 'device screenshots') + (pos[1] ? ' numbered ' + pos[1] : '') + ' in job ' + r.id + '.');
  const out = O.out || join(tmpdir(), 'bench');
  mkdirSync(out, { recursive: true });
  for (const p of want) {
    const buf = await call(`/api/bench/jobs/${r.id}/${cmd}/${p.n}`, undefined, { raw: true });
    const f = join(out, `bench-${r.id}-${cmd}-${p.n}.${p.type === 'image/png' ? 'png' : 'jpg'}`);
    writeFileSync(f, buf);
    console.log(f);
  }
} else if (cmd === 'cancel' && pos[0]) {
  const a = await call('/api/bench/jobs/' + encodeURIComponent(pos[0]) + '/cancel', {});
  console.log(`Job ${pos[0]}: ${a.state}${a.cancel ? ' (cancelled as the headset next asks)' : ''}`);
} else if (cmd === 'delete' && (pos.length || O.state)) {
  let ids = pos;
  if (O.state) {
    const want = O.state.split(',').filter(Boolean);
    if (want.some(x => !ENDED.includes(x) && x !== 'ended')) die('delete --state takes only ended states: ' + ENDED.join(', ') + ' (cancel a queued or running job first)');
    ids = (await call('/api/bench/jobs?state=' + encodeURIComponent(want.join(',')) + '&limit=1000')).jobs.map(r => r.id);
  }
  for (const id of ids) { await call('/api/bench/jobs/' + encodeURIComponent(id) + '/delete', {}); console.log(`Job ${id}: deleted`); }
  if (!ids.length) console.log('No jobs to delete.');
} else die(USAGE);
