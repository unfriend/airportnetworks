// The headset bench's test (tools/bench/SPEC.md 11): node tools/bench/test.mjs [--shots <dir>]
// Starts its own relay (relay/server.mjs on a free port, loopback only, --static . --bench --token <random> --notes <a
// temporary folder>), opens the app in headless Chromium as the smoke test's pretend Quest (tools/smoke.mjs's XR_SEAT
// and FPS_FAKE, read out of it as tools/perf.mjs does; its frames driven by a timer) at #dev=on&bench=on, and drives it
// only through tools/bench/bench.mjs, as the cloud would: status, a report, two stories opened, explore mode measured
// with pretend moving rays (the pick's cost a frame), a setting borrowed and put back (after a reload in the middle of a
// job too), the left eye's picture, a probe, a short plan, a cancel; then the refusals: no password, a shared room, the
// main site (its host mapped to this machine), a relay without --bench. console.error must stay clean. Needs Playwright
// (PLAYWRIGHT_MODULE, CHROMIUM_PATH as tools/smoke.mjs). Exits 1 on a failure. Pictures (640 wide) go to --shots.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..', '..');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ''; };
const SHOTS = arg('--shots') || fs.mkdtempSync(path.join(os.tmpdir(), 'bench-shots-'));
fs.mkdirSync(SHOTS, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0, failed = 0;
const ok = (c, what) => { if (c) { passed++; console.log('  ok  ', what); } else { failed++; console.log('  FAIL', what); } };
const T0 = Date.now(), el = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';

// ---- relays (each ends by itself as this test ends: killed in the finally, as relay/test.mjs does)
const procs = [];
async function relay(args, env = {}) {
  const p = spawn(process.execPath, [path.join(ROOT, 'relay', 'server.mjs'), '--port', '0', '--host', '127.0.0.1', '--static', ROOT, ...args],
    { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, RELAY_ARGS: '', COLLAB_SCENES: '', COLLAB_TOKEN: '', RELAY_LOG_TOKEN: '', ...env } });
  procs.push(p);
  p.out = '';
  p.stderr.on('data', d => { p.out += d; });
  p.port = await new Promise((res, rej) => {
    p.stdout.on('data', d => { p.out += d; const m = /listening on https?:\/\/[^\s]+:(\d+)/.exec(p.out); if (m) res(+m[1]); });
    p.on('exit', c => rej(new Error('relay exited with ' + c + ': ' + p.out.slice(-300))));
    setTimeout(() => rej(new Error('relay did not start')), 8000);
  });
  return p;
}
// the cloud's tool, as the cloud runs it
function bench(args, o = {}) {
  const r = spawnSync(process.execPath, [path.join(HERE, 'bench.mjs'), ...args], { encoding: 'utf8', timeout: (o.timeout || 300) * 1000,
    env: { ...process.env, NOTES_RELAY: o.relay || BASE, NOTES_TOKEN: o.token === undefined ? PASS : o.token } });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}
const jobOf = r => JSON.parse(r.out);

const PASS = 'benchpass' + crypto.randomBytes(6).toString('hex');
const NOTES = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-notes-'));
const R = await relay(['--bench', '--token', PASS, '--notes', NOTES]);
const BASE = `http://127.0.0.1:${R.port}`;
console.log('relay with --bench on ' + BASE);

// ---- the pretend headset: smoke.mjs's own fakes
const SMOKE = fs.readFileSync(path.join(ROOT, 'tools', 'smoke.mjs'), 'utf8');
const fnText = name => { const at = SMOKE.indexOf('function ' + name + '('); if (at < 0) throw new Error('smoke.mjs has no ' + name); return SMOKE.slice(at, SMOKE.indexOf('\n}\n', at) + 2); };
const SEAT = fnText('XR_SEAT'), FAKE = fnText('FPS_FAKE');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--host-resolver-rules=MAP stories.lbi-netmed.com 127.0.0.1'] });
const errors = [];
async function page(url, o = {}) {
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 1280, height: 800 }, serviceWorkers: 'block' });
  await ctx.addInitScript(([origin, pass]) => {
    try {
      for (const k of ['collabAutoAll', 'collabAutoWelcome', 'tutorialHold']) localStorage.setItem(k, 'off');
      localStorage.setItem('collabAskDefault', 'walk'); localStorage.setItem('collabMenus', 'full'); localStorage.setItem('devSeen', 'networks-v999');
      localStorage.setItem('relayTokens', JSON.stringify({ [origin]: pass }));
    } catch (e) { /* storage blocked */ }
  }, [new URL(url).origin, PASS]);
  if (o.xr !== false) {
    await ctx.addInitScript(`(${SEAT})(${JSON.stringify([1.8, 1.8, 37])});`);
    await ctx.addInitScript(`(${FAKE})();`);
    // (the pretend headset's frames: a timer steps its session, as the headset's own display would, on the page's clock as
    // a real session's frame times are)
    await ctx.addInitScript(() => { setInterval(() => { const F = window.__fp; if (F && F.session && !F.session.ended && F.session.cbs.size) { F.time = performance.now() - 1000 / 72; F.step(1); } }, 15); });
  }
  const p = await ctx.newPage();
  p.setDefaultTimeout(120000);
  const tag = o.tag || 'page';
  p.on('pageerror', e => errors.push(tag + ': page error: ' + (e.stack || e.message).slice(0, 300)));
  p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(tag + ': console.error: ' + m.text().slice(0, 300)); });
  await p.goto(url);
  return { ctx, p };
}
const state = p => p.evaluate(() => (typeof HOST !== 'undefined' && HOST.bench ? HOST.bench.state() : null));
const waitPhase = (p, ph, ms = 60000) => p.waitForFunction(ph => typeof HOST !== 'undefined' && HOST.bench && HOST.bench.state().phase === ph, ph, { timeout: ms });

try {
  // ------------------------------------------------------------ refused at start without a password off loopback
  {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'relay', 'server.mjs'), '--port', '0', '--host', '0.0.0.0', '--static', ROOT, '--bench'], { encoding: 'utf8', timeout: 10000, env: { ...process.env, RELAY_ARGS: '', COLLAB_TOKEN: '' } });
    ok(r.status === 1 && /--bench needs the relay's password/.test(r.stdout), 'a relay with --bench, no password and not on loopback refuses to start');
  }

  // ------------------------------------------------------------ the headset: bench mode on, listening
  const H = await page(`${BASE}/index.html#dev=on&bench=on&benchplan=none`, { tag: 'headset' });
  await waitPhase(H.p, 'enter');
  const s0 = await state(H.p);
  ok(s0.on && /^[a-z0-9]{8}$/.test(s0.hs) && s0.want === 'ar', 'bench mode on from the address: phase enter, an id, Enter AR wanted (' + JSON.stringify(s0) + ')');
  const bar = await H.p.evaluate(() => ({ bar: !document.getElementById('benchBar').hidden, text: document.querySelector('#benchBar span').textContent, off: !!document.getElementById('benchOff'), card: !document.getElementById('benchCard').hidden, btn: document.getElementById('benchEnter').textContent }));
  ok(bar.bar && bar.off && bar.card && bar.btn === 'Enter AR' && bar.text.includes(s0.hs), 'the page shows the bar with Switch off and the card with Enter AR (' + JSON.stringify(bar) + ')');
  const st = bench(['status']);
  ok(st.code === 0 && st.out.includes(s0.hs) && st.out.includes('enter'), 'bench.mjs status: the headset listens (' + st.code + ')');
  ok(!st.out.includes(PASS) && !st.err.includes(PASS), 'the password is never printed');
  const HS = s0.hs;

  // a report and a story opened on the page (no session yet)
  let r = bench(['send', 'report', '--need', 'page', '--json']);
  let j = r.code === 0 ? jobOf(r) : {};
  const rep = j.result && j.result.steps[0] && j.result.steps[0].out;
  ok(r.code === 0 && rep && /^networks-v\d+$/.test(rep.release) && rep.shell && rep.packages && rep.packages.cdk5 && rep.settings && 'auto' in rep.settings && 'labels' in rep.settings && rep.hs === HS, 'send report: release, shell, packages, settings (' + r.code + ' ' + (r.err || '').slice(-200) + ')');
  r = bench(['send', 'open', 'story=airports', '--need', 'page', '--json']);
  j = r.code === 0 ? jobOf(r) : {};
  ok(r.code === 0 && j.result.steps[0].out.key === 'airports' && j.result.steps[0].out.load > 0, 'send open story=airports on the page: loaded (' + (j.result ? JSON.stringify(j.result.steps[0].out) : r.err.slice(-200)) + ')');
  r = bench(['send', 'measure', 'sec=2', '--need', 'page', '--json']);
  j = r.code === 0 ? jobOf(r) : {};
  const m0 = j.result && j.result.steps[0].out;
  ok(r.code === 0 && m0 && m0.kind === 'bench' && m0.n > 0 && m0.calls > 0 && m0.tex > 0 && m0.geo > 0 && m0.prog > 0 && 'lines' in m0 && 'pts' in m0 && Array.isArray(m0.errlist), 'measure on a page: a perfrun segment with lines, pts, tex, geo, prog and errlist (' + JSON.stringify(m0 || r.err.slice(-200)).slice(0, 400) + ')');

  // a job that needs a session waits; the page says Enter AR; a trusted press enters
  const qd = bench(['send', 'report', '--need', 'xr', '--no-wait']);
  const qid = qd.out.trim();
  await sleep(1500);
  await H.p.click('#benchEnter');
  await H.p.waitForFunction(() => !!HOST.session && HOST.bench.state().xr === 'ar', null, { timeout: 30000 });
  const s1 = await state(H.p);
  ok(s1.press.n === 1 && s1.press.trusted === true && !s1.press.err, 'the #benchEnter press is counted, trusted, and the session begins (' + JSON.stringify(s1.press) + ')');
  r = bench(['show', qid, '--json']);
  for (let i = 0; i < 20 && r.code === 0 && jobOf(r).state !== 'done'; i++) { await sleep(1000); r = bench(['show', qid, '--json']); }
  ok(r.code === 0 && jobOf(r).state === 'done' && jobOf(r).result.report.xr === 'ar', 'the job that needed a session ran once AR began');

  // ------------------------------------------------------------ two stories in the session
  r = bench(['send', 'open', 'story=cdk5', '--json'], { timeout: 200 });
  j = r.code === 0 ? jobOf(r) : {};
  ok(r.code === 0 && j.result.steps[0].out.key === 'cdk5', 'send open story=cdk5 in the session (' + el() + ')');
  r = bench(['send', 'explore', 'tab=0', '--json']);
  j = r.code === 0 ? jobOf(r) : {};
  ok(r.code === 0 && j.result.steps[0].out.tabs.length > 0 && j.result.steps[0].out.tab === j.result.steps[0].out.tabs[0], 'send explore tab=0: explore mode, its first tab (' + JSON.stringify(j.result ? j.result.steps[0].out : r.err.slice(-200)) + ')');
  // pretend moving rays, measured; then the pick's own cost a frame (the picks probe)
  const srcs = () => H.p.evaluate(() => HOST.cur.peek('[XR.ctrls[0].src && XR.ctrls[0].src.profiles[0], XR.ctrls[1].src && XR.ctrls[1].src.profiles[0]]'));
  const before = await srcs();
  r = bench(['send', 'rays', 'preset=sweep', 'sec=6', 'measure=true', '--json'], { timeout: 200 });
  j = r.code === 0 ? jobOf(r) : {};
  const ry = j.result && j.result.steps[0].out;
  ok(r.code === 0 && ry && ry.frames > 10 && ry.hovers > 0 && ry.seg && ry.seg.n > 0 && ry.seg.js > 0, 'send rays sweep 6 s measured: frames, hovers counted, a segment (' + JSON.stringify(ry && { frames: ry.frames, hovers: ry.hovers, js: ry.seg && ry.seg.js, mean: ry.seg && ry.seg.mean }) + ')');
  const back = await srcs();
  // (the pretend headset never says inputsourceschange, so a story that adopted the session may not have its sources:
  // after the rays the real source at the hand's index is connected, the other hand left as it was)
  ok(back[1] === 'oculus-touch-v3' && back[0] === before[0], 'after the rays the real controller at that index is connected again, the other hand untouched (' + JSON.stringify({ before, back }) + ')');
  r = bench(['send', 'probe', 'name=picks', 'args={"sec":5}', '--json'], { timeout: 200 });
  j = r.code === 0 ? jobOf(r) : {};
  const pk = j.result && j.result.steps[0].out;
  ok(r.code === 0 && pk && pk.pick && pk.pick.msFrame > 0 && pk.pick.n > 0 && pk.mode === 'explore', 'probe picks in cdk5\'s explore mode: a non-zero pick cost a frame (' + JSON.stringify(pk && pk.pick) + ')');
  ok(await H.p.evaluate(() => HOST.cur.peek('typeof window.__benchPick === "undefined"')), 'the probe put the story\'s pick back');
  console.log(bench(['show', j.id || '']).out.split('\n').filter(l => /Picking|^\| \d/.test(l)).join('\n'));
  r = bench(['send', 'probe', 'name=scene', '--json']);
  j = r.code === 0 ? jobOf(r) : {};
  ok(r.code === 0 && j.result.steps[0].out.sets && Object.keys(j.result.steps[0].out.sets).length > 0, 'probe scene: counts by set (' + (j.result ? Object.keys(j.result.steps[0].out.sets).join(',') : r.err.slice(-200)) + ')');
  r = bench(['send', 'probe', 'name=nosuch', '--json']);
  ok(r.code === 1 && /no such probe/.test(r.out), 'a probe that is not in the repository: no such probe');

  // ------------------------------------------------------------ a setting borrowed and put back
  const raw0 = await H.p.evaluate(() => ({ auto: localStorage.getItem('xrAuto'), occl: localStorage.getItem('xrOccl'), now: HOST.xr.auto() }));
  r = bench(['send', 'set', 'name=auto', 'value=false', '--with', 'occl=off', '--json']);
  j = r.code === 0 ? jobOf(r) : {};
  const raw1 = await H.p.evaluate(() => ({ auto: localStorage.getItem('xrAuto'), occl: localStorage.getItem('xrOccl'), now: HOST.xr.auto(), b: localStorage.getItem('benchBorrow') }));
  ok(r.code === 0 && j.result.steps[0].out.was === raw0.now && j.result.steps[0].out.now === false && raw1.auto === raw0.auto && raw1.occl === raw0.occl && raw1.now === raw0.now && !raw1.b,
    'set auto=false with occl=off: borrowed for the job, the raw values and the setter put back after (' + JSON.stringify({ raw0, raw1 }) + ')');
  r = bench(['send', 'set', 'name=nosuch', 'value=1', '--json']);
  ok(r.code === 1 && /not a setting the bench may borrow: nosuch/.test(r.out), 'a setting not in the table is refused');
  // a reload in the middle of a job: the settings put back at the boot, the job failed with why
  const midPlan = path.join(SHOTS, 'test-mid.json');
  fs.writeFileSync(midPlan, JSON.stringify({ v: 1, label: 'reload mid-job', need: 'any', steps: [{ cmd: 'set', name: 'auto', value: false }, { cmd: 'wait', sec: 60 }] }));
  const midId = bench(['run', midPlan, '--no-wait']).out.trim();
  await H.p.waitForFunction(() => { const s = HOST.bench.state(); return s.job && s.job.step === 1 && !!localStorage.getItem('benchBorrow'); }, null, { timeout: 30000 });
  ok(await H.p.evaluate(() => HOST.xr.auto() === false), 'mid-job: automatic quality borrowed off');
  await H.p.reload();
  await H.p.waitForFunction(() => typeof HOST !== 'undefined' && HOST.bench && HOST.bench.on(), null, { timeout: 60000 });
  const raw2 = await H.p.evaluate(() => ({ auto: localStorage.getItem('xrAuto'), b: localStorage.getItem('benchBorrow'), now: HOST.xr.auto() }));
  let mj = {};
  for (let i = 0; i < 20 && mj.state !== 'failed'; i++) { await sleep(1000); r = bench(['show', midId, '--json']); mj = r.code === 0 ? jobOf(r) : {}; }
  ok(raw2.auto === raw0.auto && raw2.now === raw0.now && !raw2.b && mj.state === 'failed' && /the page reloaded during step 2/.test(mj.why) && /put back/.test(mj.why), 'after a reload mid-job the borrowed setting is back and the job failed saying so (' + JSON.stringify(raw2) + ', job ' + mj.state + ': ' + mj.why + ')');
  // (the session ended with the reload: Enter AR again)
  await waitPhase(H.p, 'enter');
  await H.p.click('#benchEnter');
  await H.p.waitForFunction(() => !!HOST.session, null, { timeout: 30000 });

  // ------------------------------------------------------------ the eye's picture
  r = bench(['send', 'open', 'story=exposome', '--json'], { timeout: 200 });
  ok(r.code === 0, 'send open story=exposome (the second story in the session) (' + el() + ')');
  r = bench(['send', 'pic', 'w=640', '--json']);
  j = r.code === 0 ? jobOf(r) : {};
  const po = j.result && j.result.steps[0].out;
  ok(r.code === 0 && po && po.n === 1 && po.w === 640 && po.bytes > 1000 && po.xr === 'ar', 'send pic w=640: the left eye\'s picture posted (' + JSON.stringify(po) + ')');
  const pf = bench(['pic', j.id, '--out', SHOTS]);
  const eyeFile = pf.out.trim().split('\n')[0];
  ok(pf.code === 0 && fs.existsSync(eyeFile) && fs.statSync(eyeFile).size === po.bytes, 'bench.mjs pic saves it: ' + eyeFile);

  // ------------------------------------------------------------ a short plan (a page part and a session part)
  const plan = path.join(SHOTS, 'test-plan.json');
  fs.writeFileSync(plan, JSON.stringify({ v: 1, label: 'test plan', need: 'xr', limit: 300, steps: [{ cmd: 'open', story: 'airports' }, { cmd: 'seek', chapter: 1, play: true }, { cmd: 'measure', sec: 2, name: 'chapter 2' }, { cmd: 'probe', name: 'loads' }, { cmd: 'wait', until: 'quiet' }], page: [{ cmd: 'report' }] }));
  r = bench(['run', plan, '--md', path.join(SHOTS, 'plan.md')], { timeout: 300 });
  ok(r.code === 0 && /Bench job .*test plan \(page part\)/.test(r.out) && /\| 3 \| measure/.test(r.out) && /## Measured/.test(r.out), 'run a plan: its page part and its main part, both done, Markdown with the measured table (' + r.code + ' ' + r.err.slice(-300) + ')');

  // ------------------------------------------------------------ cancels
  r = bench(['send', 'report', '--need', 'vr', '--no-wait']);
  const vq = r.out.trim();
  r = bench(['cancel', vq]);
  ok(r.code === 0 && /cancelled/.test(r.out), 'a queued job cancelled at once (' + r.out.trim() + ')');
  r = bench(['send', 'wait', 'sec=60', '--no-wait']);
  const wq = r.out.trim();
  await H.p.waitForFunction(id => { const s = HOST.bench.state(); return s.job && s.job.id === id; }, wq, { timeout: 30000 });
  bench(['cancel', wq]);
  r = bench(['send', 'report', '--wait', '60', '--json']);   // (the next job runs once the cancelled one has ended)
  const cr = bench(['show', wq, '--json']);
  ok(cr.code === 0 && jobOf(cr).state === 'cancelled' && r.code === 0, 'a running job cancelled: it ends at its next word with the relay (' + (cr.code === 0 ? jobOf(cr).state + ' ' + jobOf(cr).why : cr.err) + ')');

  // ------------------------------------------------------------ the list, the Markdown
  r = bench(['jobs']);
  ok(r.code === 0 && /\| id \| label/.test(r.out) && r.out.includes('cancelled'), 'bench.mjs jobs lists them');
  const relayLog = R.out;
  ok(!relayLog.includes(PASS) && !/"cmd"|"steps"|release/.test(relayLog) && /bench job \S+ queued \d+ steps/.test(relayLog) && /bench job \S+ taken by [a-z0-9]{8}/.test(relayLog), 'the relay\'s log says ids, states and counts, never a step, a result or the password');

  // (the pretend headset's page, its session stepped every 15 ms, would hold up the shared software GPU: closed first)
  await H.p.screenshot({ path: path.join(SHOTS, 'bench-headset-page.png') });
  await H.p.evaluate(() => HOST.session && HOST.session.end()).catch(() => {});
  ok(errors.length === 0, 'console.error clean on the headset\'s page' + (errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''));
  await H.ctx.close();

  // ------------------------------------------------------------ refusals
  r = bench(['status'], { token: '' });
  ok(r.code === 2 && /wants its password/.test(r.err), 'without the password: exit 2, the relay wants its password');
  const R2 = await relay(['--token', PASS]);
  r = bench(['status'], { relay: `http://127.0.0.1:${R2.port}` });
  ok(r.code === 2 && /has no bench/.test(r.err), 'a relay without --bench: exit 2, this relay has no bench');
  // a shared room: held, the room told nothing
  const room = await fetch(BASE + '/api/rooms', { method: 'POST', headers: { Authorization: 'Bearer ' + PASS, 'Content-Type': 'application/json' }, body: JSON.stringify({ app: 'networks', version: 'v1' }) }).then(x => x.json()).catch(() => ({}));
  const RM = await page(`${BASE}/index.html#s=${room.code}&dev=on&bench=on&benchplan=none`, { tag: 'room', viewport: { width: 640, height: 400 }, xr: false });
  await RM.p.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab && HOST.collab.code && HOST.bench && HOST.bench.state().phase === 'held', null, { timeout: 60000 }).catch(() => {});
  const rs = await state(RM.p);
  ok(rs && rs.phase === 'held' && rs.why === 'in a shared room', 'in a shared room bench mode stays held (' + JSON.stringify(rs && { phase: rs.phase, why: rs.why }) + ')');
  await RM.p.screenshot({ path: path.join(SHOTS, 'bench-room-held.png') });
  await RM.ctx.close();
  // the main site (its host mapped to this machine): held, no ask
  const MS = await page(`http://stories.lbi-netmed.com:${R.port}/index.html#dev=on&bench=on&benchplan=none`, { tag: 'main', viewport: { width: 640, height: 400 }, xr: false });
  await MS.p.waitForFunction(() => typeof HOST !== 'undefined' && HOST.bench && HOST.bench.state().phase === 'held', null, { timeout: 60000 }).catch(() => {});
  const ms = await state(MS.p);
  ok(ms && ms.phase === 'held' && ms.why === 'main site', 'on the main site\'s host bench mode is held (' + JSON.stringify(ms && { phase: ms.phase, why: ms.why }) + ')');
  ok(!/bench \S+ listening/.test(R.out.split('\n').filter(l => l.includes(ms ? ms.hs : '-')).join('\n')), 'the main site\'s page never asked the relay');
  await MS.ctx.close();
  // a page with bench mode waiting for the headset view, as a person sees it
  const PG = await page(`${BASE}/index.html#airports&dev=on&bench=on&benchplan=none`, { tag: 'small', viewport: { width: 640, height: 400 } });
  await waitPhase(PG.p, 'enter');
  await sleep(2000);
  await PG.p.screenshot({ path: path.join(SHOTS, 'bench-page-enter.png') });
  // switched off from the bar
  await PG.p.click('#benchOff');
  const off = await PG.p.evaluate(() => ({ s: HOST.bench.state(), bar: document.getElementById('benchBar').hidden, kept: localStorage.getItem('benchOn') }));
  ok(!off.s.on && off.s.phase === 'off' && off.bar && !off.kept, 'Switch off on the bar: off, the bar gone, nothing kept');

  ok(errors.length === 0, 'console.error clean' + (errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''));
  console.log('pictures: ' + [eyeFile, path.join(SHOTS, 'bench-page-enter.png'), path.join(SHOTS, 'bench-room-held.png'), path.join(SHOTS, 'bench-headset-page.png')].join(', '));
} catch (e) {
  failed++;
  console.log('  FAIL (threw)', e && e.stack || e);
} finally {
  await browser.close().catch(() => {});
  for (const p of procs) if (p.exitCode === null) p.kill();
  fs.rmSync(NOTES, { recursive: true, force: true });
}
console.log(`\n${passed} checks passed, ${failed} failed (${el()})`);
process.exit(failed ? 1 : 0);
