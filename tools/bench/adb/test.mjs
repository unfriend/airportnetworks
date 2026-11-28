#!/usr/bin/env node
// The adb helper's test (tools/bench/SPEC.md, section 9.7): no headset. A stand-in adb (shim/adb.mjs, behind an
// executable `adb` the test writes into its temporary folder), a local headless Chromium with a remote-debugging port
// standing in for Quest Browser's DevTools, and a stand-in relay on a free port that also serves a stand-in bench page
// (HOST.bench.state() and #benchEnter, recording whether the press was trusted).
//   node tools/bench/adb/test.mjs [--tmp <folder>]     (PLAYWRIGHT_MODULE where Playwright is not found by name)
// Every real-device behaviour stays untested here.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseLine, splitFields, summarise, vrapiFor, parseDevices, parseSockets } from './adb.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HELPER = path.join(HERE, 'adb.mjs');
const SHIM = path.join(HERE, 'shim', 'adb.mjs');
const ti = process.argv.indexOf('--tmp');
const TMP = ti > 0 ? path.resolve(process.argv[ti + 1]) : fs.mkdtempSync(path.join(os.tmpdir(), 'bench-adb-'));
fs.mkdirSync(TMP, { recursive: true });
const RUN = fs.mkdtempSync(path.join(TMP, 'run-'));
const TOKEN = 'pw-' + crypto.randomBytes(12).toString('hex');
const HS = 'k3v9q2ma';

let pass = 0, failed = 0;
const ok = (c, name, info) => { if (c) { pass++; console.log('  ok   ' + name); } else { failed++; console.log('  FAIL ' + name + (info ? '\n       ' + String(info).slice(0, 1500).replace(/\n/g, '\n       ') : '')); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the stand-in adb ----------
let ADB = SHIM;
if (process.platform !== 'win32') {
  ADB = path.join(RUN, 'bin', 'adb');
  fs.mkdirSync(path.dirname(ADB), { recursive: true });
  fs.writeFileSync(ADB, '#!/bin/sh\nexec "' + process.execPath + '" "' + SHIM + '" "$@"\n', { mode: 0o755 });
}
const ADBLOG = path.join(RUN, 'adb.log');
const adbLog = () => (fs.existsSync(ADBLOG) ? fs.readFileSync(ADBLOG, 'utf8') : '');

// ---------- the stand-in bench page ----------
const PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>bench stand-in</title>
<body style="margin:0;background:#123">
<button id="benchEnter" style="position:fixed;left:140px;top:160px;width:220px;height:90px">Enter AR</button>
<script>
const mode = location.pathname.split('/')[1];
const press = { n: 0, trusted: false, at: 0, err: '' };
let xr = '';
window.HOST = { bench: { state: () => ({ on: true, phase: mode === 'pw' ? 'held' : xr ? 'idle' : 'enter', why: mode === 'pw' ? 'the relay wants its password' : '',
  hs: '${HS}', xr, want: 'ar', job: null, press: Object.assign({}, press), rel: 'networks-v232', url: location.href }) } };
document.querySelector('#benchEnter').addEventListener('click', (e) => {
  press.n++; press.trusted = e.isTrusted; press.at = Date.now(); press.err = '';
  if (mode === 'ok') { if (e.isTrusted) xr = 'ar'; else press.err = 'not a user gesture'; }
  else if (mode === 'err') (navigator.xr ? navigator.xr.requestSession('immersive-ar') : Promise.reject(new Error('WebXR is not available here')))
    .then(() => { xr = 'ar'; }, (er) => { press.err = String(er && er.message || er); });
  else if (mode === 'dialog') setTimeout(() => alert('Allow this site to use AR?'), 0);
  // 'ask': nothing more happens: a question the page cannot see never resolves
});
</script>`;

// ---------- the stand-in relay (SPEC section 4.2, the parts the helper uses) ----------
const jobs = new Map();
const reqs = [];
let seq = 0;
const newId = () => '20261128-1422' + String(10 + (seq++)).padStart(2, '0') + '-t' + crypto.randomBytes(2).toString('hex').slice(0, 3);
const summary = (j) => ({ id: j.id, label: j.label, state: j.state, why: j.why || '', at: j.at, ended: j.ended || 0, hs: j.hs || '', steps: j.steps.length, ok: j.result ? j.result.ok : null });
const body = (req) => new Promise((res) => { const b = []; req.on('data', (c) => b.push(c)); req.on('end', () => res(Buffer.concat(b))); });
const relay = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
  if (!u.pathname.startsWith('/api/')) {
    if (/^\/(ok|ask|err|dialog|pw)\/$/.test(u.pathname)) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(PAGE); return; }
    res.writeHead(404); res.end(); return;
  }
  reqs.push(req.method + ' ' + req.url + ' ' + JSON.stringify(Object.keys(req.headers)));
  if (req.headers.authorization !== 'Bearer ' + TOKEN) return send(401, { error: 'password' });
  const raw = await body(req);
  const json = () => { try { return JSON.parse(raw.toString() || '{}'); } catch { return {}; } };
  const p = u.pathname;
  if (p === '/api/bench' && req.method === 'GET') return send(200, { now: Date.now(), headsets: [{ hs: HS, seen: Date.now(), ago: 1 }], queued: [...jobs.values()].filter((j) => j.state === 'queued').length, running: 0 });
  if (p === '/api/bench/next') {
    const adb = u.searchParams.get('role') === 'adb';
    const end = Date.now() + Math.min(+u.searchParams.get('wait') || 0, 1) * 1000;
    for (;;) {
      const j = [...jobs.values()].find((x) => x.state === 'queued' && (x.to === 'adb') === adb);
      if (j) { j.state = 'running'; j.hs = j.hs || u.searchParams.get('hs') || ''; j.taken = Date.now(); return send(200, { job: j }); }
      if (Date.now() >= end) return send(204);
      await sleep(100);
    }
  }
  if (p === '/api/bench/jobs' && req.method === 'POST') { const j = json(); j.id = newId(); j.state = 'queued'; j.at = Date.now(); j.to = j.to || 'page'; j.steps = j.steps || []; jobs.set(j.id, j); return send(201, { id: j.id }); }
  if (p === '/api/bench/jobs' && req.method === 'GET') {
    const st = u.searchParams.get('state');
    return send(200, { jobs: [...jobs.values()].filter((j) => !st || j.state === st).reverse().map(summary) });
  }
  const m = p.match(/^\/api\/bench\/jobs\/([\w-]+)(?:\/(progress|result|adb|devshot|pic|cancel))?$/);
  const j = m && jobs.get(m[1]);
  if (!j) return send(404, { error: 'no such job' });
  if (!m[2] && req.method === 'GET') return send(200, j);
  if (m[2] === 'progress') { j.progress = Object.assign(json(), { at: Date.now() }); return send(200, { ok: true, cancel: j.state === 'cancelled' }); }
  if (m[2] === 'result') { if (j.state !== 'running') return send(409, { error: 'not running' }); j.result = json(); j.state = j.result.ok ? 'done' : 'failed'; j.why = j.result.why || ''; j.ended = Date.now(); return send(200, { ok: true }); }
  if (m[2] === 'adb') { j.adb = json(); return send(200, { ok: true }); }
  if (m[2] === 'devshot') { j.devshots = j.devshots || []; j.devshots.push({ n: +u.searchParams.get('n'), bytes: raw.length, type: req.headers['content-type'], png: raw[0] === 0x89 && raw[1] === 0x50 }); return send(200, { ok: true, n: +u.searchParams.get('n') }); }
  return send(404, { error: 'not here' });
});
await new Promise((r) => relay.listen(0, '127.0.0.1', r));
const RPORT = relay.address().port;
const BASE = 'http://127.0.0.1:' + RPORT;
const api = async (p, json) => {
  const r = await fetch(BASE + p, { method: json ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: json ? JSON.stringify(json) : undefined });
  return r.status === 204 ? null : r.json();
};

// ---------- the stand-in browser ----------
const freePort = () => new Promise((res) => { const s = http.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });
let pw;
try { pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright'); }
catch { pw = await import(pathToFileURL('/opt/node-tools/node_modules/playwright/index.mjs').href); }
const DT = await freePort();
const browser = await pw.chromium.launch({ headless: true, args: ['--remote-debugging-port=' + DT] });
const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
const page = await ctx.newPage();
await page.goto('about:blank');

// ---------- running the helper ----------
const outputs = [];
function helper(args, env = {}, ms = 60000) {
  const ch = spawn(process.execPath, [HELPER, '--adb', ADB, '--relay', BASE].concat(args), {
    env: Object.assign({}, process.env, { NOTES_TOKEN: TOKEN, SHIM_DIR: RUN, SHIM_DEVTOOLS: String(DT), SHIM_DEVICES: 'one', SHIM_LOG_SEC: '120' }, env),
    stdio: ['ignore', 'pipe', 'pipe'] });
  const run = { ch, out: '', code: null };
  ch.stdout.on('data', (d) => { run.out += d; });
  ch.stderr.on('data', (d) => { run.out += d; });
  const timer = setTimeout(() => { try { ch.kill('SIGINT'); } catch {} }, ms);
  run.done = new Promise((r) => ch.on('exit', (code) => { clearTimeout(timer); run.code = code; outputs.push(run.out); r(run); }));
  return run;
}
const until = async (fn, ms, step = 200) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(step); } return false; };
const pressOf = () => page.evaluate(() => window.HOST && window.HOST.bench.state().press).catch(() => null);
const site = (m) => BASE + '/' + m + '/';

try {
  console.log('Parsing (no device)');
  {
    const a = parseLine('  1795850001.250  1234  1290 I VrApi   : FPS=72/72,Prd=45ms,Stale=1,CPU4/GPU=4/3,2419/525MHz,Free=1520MB,Temp=36.5C/0.0C,LCnt=1(DR72,LM0),GPU%=0.88,CPU%=0.41(W0.45)');
    ok(a && a.t === 1795850001250 && a.fps === 72 && a.stale === 1 && a.cpuLvl === 4 && a.gpuLvl === 3 && a.cpuPct === 0.41 && a.gpuPct === 0.88 && a.tempC === 36.5 && a.freeMB === 1520, 'a recent VrApi line is read', JSON.stringify(a));
    const b = parseLine('1795850002.000  10  11 I VrApi   : FPS=60,Prd=38ms,Stale=2,CPU/GPU=3/2,1478/490MHz,Temp=34.0C/0.0C');
    ok(b && b.fps === 60 && b.cpuLvl === 3 && b.gpuLvl === 2 && b.cpuPct === null, 'an older VrApi line (no loads) is read', JSON.stringify(b));
    const c = parseLine('1795850003.000 10 11 I VrApi: FPS=90/90,Stale=0,CPU4/GPU=2/2,Temp=33.5C,GPU%=62,NewField=7');
    ok(c && c.gpuPct === 0.62 && c.f.NewField === '7', 'a line with a percentage and an unknown field keeps the field', JSON.stringify(c));
    ok(splitFields('a=1,b=2(x,y),c=3,loose').b === '2(x,y)' && splitFields('a=1,b=2(x,y),c=3,loose').c === '3,loose', 'fields split around brackets');
    let threw = false, bad = 0;
    const junk = ['', 'VrApi : FPS=', '1795850003.000 10 11 I VrApi : FPS=abc', 'VrApi FPS=72 garbled', '\u0000￿', '1795850003 x y I VrApi : FPS=72', '9'.repeat(5000) + ' VrApi FPS=', null, undefined, 42, '1795850003.000 10 11 I VrApi : Some other message'];
    for (let i = 0; i < 300; i++) junk.push(crypto.randomBytes(1 + (i % 90)).toString(i % 2 ? 'latin1' : 'base64') + (i % 3 ? ' VrApi : FPS=' : ''));
    for (const j of junk) { try { const r = parseLine(j); if (r && r.bad) bad++; } catch { threw = true; } }
    ok(!threw && bad >= 3, 'malformed lines never throw and are counted as unreadable (' + bad + ')');
    ok(parseLine('1795850003.000 10 11 I OtherTag: FPS=72') === null && parseLine('1795850003.000 10 11 I VrApi : layer submitted') === null, 'other tags and other VrApi messages are not statistics');
    const rows = [a, b, c].filter(Boolean);
    const s = summarise(rows);
    ok(s.n === 3 && s.fpsMin === 60 && s.stale === 3 && s.cpuLvl === 4 && s.tempC === 36.5, 'a stretch is summed up', JSON.stringify(s));
    const v = vrapiFor(rows, [1795850002500], 1795850001000, 1795850002600, [{ i: 0, t0: 1795850001000, t1: 1795850001500 }, { i: 1, t0: 0, t1: 0 }]);
    ok(v.vrapi && v.vrapi.n === 2 && v.vrapi.per.length === 1 && v.vrapi.per[0].n === 1 && /1 unreadable/.test(v.notes) && v.vrapi.cols.length === v.vrapi.rows[0].length, "the job's seconds and one entry a step", JSON.stringify(v));
    ok(vrapiFor(rows, [], 1, 2, []).vrapi === null, 'no lines in the window: vrapi null and a note');
    ok(parseDevices('List of devices attached\nABC\tunauthorized usb:1 transport_id:2\n').map((d) => d.state).join() === 'unauthorized', 'adb devices -l is read');
    ok(parseSockets('0: 1 @webview_devtools_remote_12\n0: 1 @chrome_devtools_remote\n0: 1 /dev/x').join() === 'chrome_devtools_remote,webview_devtools_remote_12', "the browser's DevTools socket comes first");
  }

  console.log('Finding the headset');
  {
    let r = await helper(['check'], { SHIM_DEVICES: 'none' }).done;
    ok(r.code === 3 && /No headset found by adb/.test(r.out) && /allow USB debugging/.test(r.out), 'no device: exit 3 and what to do', r.out);
    r = await helper(['check'], { SHIM_DEVICES: 'two' }).done;
    ok(r.code === 3 && /more than one device/.test(r.out) && /--serial/.test(r.out), 'two devices: exit 3, asks for --serial', r.out);
    r = await helper(['check', '--serial', '2G0YC1ZF8B9999'], { SHIM_DEVICES: 'two' }).done;
    ok(r.code === 0 && /Headset: 2G0YC1ZF8B9999/.test(r.out), 'two devices and --serial: that one', r.out);
    r = await helper(['check'], { SHIM_DEVICES: 'unauth' }).done;
    ok(r.code === 3 && /has not allowed this computer/.test(r.out), 'unauthorised: exit 3 and what to do', r.out);
    r = await helper(['check'], { SHIM_DEVICES: 'other' }).done;
    ok(r.code === 3 && /does not say it is a Quest/.test(r.out), 'a device that is not a Quest is not taken unasked', r.out);
    r = await helper(['check', '--adb', path.join(RUN, 'no-such-adb')]).done;
    ok(r.code === 3 && /adb was not found/.test(r.out), 'no adb: exit 3 and where to get it', r.out);
    r = await helper(['check']).done;
    ok(r.code === 0 && /Headset: 2G0YC1ZF8B0123 \(Quest_3\)/.test(r.out) && /Battery: 87%, charging/.test(r.out) && /No bench page yet/.test(r.out) && /1 headset listening/.test(r.out), 'one Quest: found, its battery, no page yet, the relay', r.out);
  }

  console.log('Opening and pressing Enter');
  {
    let r = await helper(['open', '--site', site('ok')]).done;
    await until(async () => page.url().includes('/ok/'), 5000);
    ok(r.code === 0 && page.url() === site('ok') + '#dev=on&bench=on&benchxr=ar', 'open: Quest Browser (the stand-in) shows the bench address', page.url() + '\n' + r.out);
    ok(/am start -a android\.intent\.action\.VIEW -d '[^']+#dev=on&bench=on&benchxr=ar' com\.oculus\.browser/.test(adbLog().split('\n').map((l) => { try { return JSON.parse(l).join(' '); } catch { return ''; } }).join('\n')), 'the address goes to the remote shell in single quotes');
    r = await helper(['check', '--site', site('ok')]).done;
    ok(r.code === 0 && new RegExp('Bench ' + HS + ' is enter \\(no session\\)').test(r.out), 'check: the page waits for Enter', r.out);
    r = await helper(['enter', '--site', site('ok')]).done;
    const p = await pressOf();
    ok(r.code === 0 && /the page is in AR \(a trusted press\)/.test(r.out) && p && p.n === 1 && p.trusted === true, 'enter: a trusted press at the button, the session (stand-in) starts', r.out + '\n' + JSON.stringify(p));

    await page.goto(site('err') + '#dev=on&bench=on&benchxr=ar');
    r = await helper(['enter', '--site', site('err')]).done;
    const q = await pressOf();
    ok(r.code === 4 && /a trusted press\), but the page could not start the session: /.test(r.out) && q.trusted, 'enter with no WebXR (headless): the press is trusted, the error is said', r.out);

    await page.goto(site('ask') + '#dev=on&bench=on&benchxr=ar');
    r = await helper(['enter', '--site', site('ask')]).done;
    ok(r.code === 4 && /may be asking a question on the headset \(to allow AR for this site\)\. Put it on and allow it once/.test(r.out), 'a permission question that never resolves: said plainly', r.out);

    await page.goto(site('pw') + '#dev=on&bench=on&benchxr=ar');
    r = await helper(['check', '--site', site('pw')]).done;
    ok(r.code === 0 && /is held: the relay wants its password/.test(r.out) && /enter the relay's password in the menu/.test(r.out), "a page waiting for the relay's password: said plainly", r.out);

    await page.goto(site('dialog') + '#dev=on&bench=on&benchxr=ar');
    let dlg = null;
    page.on('dialog', (d) => { dlg = d; });   // a listener keeps Playwright from answering it: the page stays blocked
    r = await helper(['enter', '--site', site('dialog')]).done;
    ok(r.code === 4 && /dialog box/.test(r.out) && /never answers it/.test(r.out), 'a dialog box on the page: reported, not answered', r.out);
    ok(dlg !== null, 'the dialog was still open after the helper left');
    if (dlg) await dlg.dismiss().catch(() => {});
    page.removeAllListeners('dialog');
  }

  console.log('Watching (awake, Enter after each load, jobs, statistics, Ctrl+C)');
  {
    await page.goto('about:blank');
    const before = adbLog().length;
    const w = helper(['watch', '--site', site('ok'), '--press-gap', '2'], {}, 120000);
    const entered = (k) => until(async () => (w.out.match(/the page is in AR/g) || []).length >= k, 25000);
    ok(await entered(1), 'watch: opens the address and presses Enter', w.out);
    await page.reload();
    ok(await entered(2) && (await pressOf()).trusted === true, 're-entry after a reload: pressed again, trusted', w.out);

    // a page job, as the page posts it: taken, a result with its seconds
    const now = Date.now();
    const pj = await api('/api/bench/jobs', { v: 1, label: 'stand-in page job', to: 'page', need: 'any', steps: [{ cmd: 'measure', sec: 2 }, { cmd: 'wait', sec: 1 }] });
    const taken = await api('/api/bench/next?hs=' + HS + '&xr=ar&wait=1');
    ok(taken && taken.job && taken.job.id === pj.id, 'the page job is taken by the stand-in page');
    await api('/api/bench/jobs/' + pj.id + '/result', { hs: HS, ok: true, why: '', t0: now - 6000, t1: now - 500, report: {},
      steps: [{ i: 0, cmd: 'measure', ok: true, t0: now - 6000, t1: now - 3000, out: {} }, { i: 1, cmd: 'wait', ok: true, t0: now - 3000, t1: now - 500, out: {} }] });
    const skip = await api('/api/bench/jobs', { v: 1, label: 'no statistics wanted', adb: false, steps: [{ cmd: 'report' }] });
    await api('/api/bench/next?hs=' + HS + '&xr=ar&wait=1');
    await api('/api/bench/jobs/' + skip.id + '/result', { hs: HS, ok: true, why: '', t0: now - 4000, t1: now - 1000, steps: [] });
    // the helper's own job
    const aj = await api('/api/bench/jobs', { v: 1, label: 'devshot', to: 'adb', steps: [{ cmd: 'devshot', n: 2 }, { cmd: 'vrapi', from: now - 4000, to: now }, { cmd: 'nonsense', soft: true }] });

    ok(await until(() => jobs.get(pj.id).adb, 20000), 'frame statistics attached to the page job', w.out);
    const A = jobs.get(pj.id).adb || {};
    ok(A.vrapi && A.vrapi.n >= 3 && A.vrapi.per.length === 2 && A.vrapi.all.fps > 50 && A.vrapi.rows.length === A.vrapi.n && /[1-9]\d* unreadable/.test(A.notes) && A.vrapi.fields.includes('NewField'),
      'the statistics: lines of the three shapes in the job\'s seconds, one entry a step, unreadable lines counted, unknown fields named', JSON.stringify(A).slice(0, 800));
    ok(await until(() => jobs.get(aj.id).state !== 'running' && jobs.get(aj.id).state !== 'queued', 20000), 'the helper\'s own job ends', w.out);
    const J = jobs.get(aj.id);
    const ds = (J.devshots || [])[0];
    ok(J.state === 'done' && ds && ds.png && ds.n === 2 && J.result.steps[0].out.how === 'screencap', 'devshot: the capture service refused, the screencap posted as a PNG', JSON.stringify(J.result));
    ok(J.result.steps[1].ok && J.adb && J.adb.vrapi && J.result.steps[2].ok === false && /not a helper command/.test(J.result.steps[2].err), 'vrapi step posted; an unknown command fails softly', JSON.stringify(J.result.steps));
    await sleep(6000);
    ok(jobs.get(skip.id).adb === false, 'a job with adb: false gets no statistics');

    w.ch.kill('SIGINT');
    const r = await w.done;
    const log = adbLog().slice(before).split('\n').filter(Boolean).map((l) => JSON.parse(l).join(' '));
    const iOn = log.findIndex((l) => /prox_close/.test(l)), iOff = log.findIndex((l) => /automation_disable/.test(l));
    ok(r.code === 130 && iOn >= 0 && iOff > iOn && /The headset may sleep again/.test(r.out), 'Ctrl+C: the awake setting is put back', 'code ' + r.code + '\n' + log.join('\n'));
    ok(log.some((l) => /forward --remove tcp:\d+/.test(l)), 'Ctrl+C: the port forward is removed');
  }

  console.log('The password');
  {
    const all = outputs.join('\n') + adbLog() + reqs.join('\n');
    ok(!all.includes(TOKEN) && !reqs.some((x) => /token|password/i.test(x.split(' ')[1])), 'the password is in no output, no adb command and no address');
    const r = await helper(['check'], { NOTES_TOKEN: 'wrong-password-123' }).done;
    ok(/The relay wants its password: set NOTES_TOKEN/.test(r.out) && !r.out.includes('wrong-password-123'), 'a wrong password: said, never printed', r.out);
  }
} catch (e) {
  failed++;
  console.log('  FAIL the test itself threw: ' + (e && e.stack || e));
} finally {
  await browser.close().catch(() => {});
  relay.closeAllConnections();
  await new Promise((r) => relay.close(r));
}
console.log('\n' + pass + ' passed, ' + failed + ' failed. (Temporary files: ' + RUN + ')');
process.exit(failed ? 1 : 0);
