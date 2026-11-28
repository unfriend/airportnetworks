#!/usr/bin/env node
// The headset bench's adb helper (tools/bench/SPEC.md, section 9), for the owner's computer: Windows, macOS or Linux,
// Node 22, no packages. It finds the Quest over adb, keeps it awake (and puts that back on exit), opens the test site's
// bench address in Quest Browser, presses the page's Enter AR with a real input event after every page load (DevTools
// over adb's port forward), runs the relay's `to: 'adb'` jobs, and attaches the headset's own frame statistics (the
// VrApi log lines) to each bench job's result. Bench mode works without it; this is an extra.
//   node tools/bench/adb/adb.mjs [check|wake|open|enter|stats|shot|watch] [--site url] [--relay url] [--serial s] ...
// NOTES_RELAY and NOTES_TOKEN as tools/notes/notes.mjs takes them: the password is never printed, logged or written.
import { execFile, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const USAGE = `Usage: node tools/bench/adb/adb.mjs [command] [options]
Commands:
  check   find the headset, the browser's DevTools and the bench page, and say what each is doing (the default)
  wake    keep the headset awake until Ctrl+C, then put that back
  open    open the bench address in Quest Browser
  enter   press the page's Enter AR (or VR) once and say what happened
  stats   read the headset's VrApi frame statistics for --sec seconds (default 30) and print them
  shot    take a device screenshot (--out <file>; default the system's temporary folder)
  watch   all of it until Ctrl+C: awake, open, Enter after every page load, the relay's adb jobs, frame statistics
          onto each bench job (also: --watch)
Options:
  --site <url>       the test site (default https://stories.lab.lbi-netmed.com/)
  --relay <url>      the relay (default NOTES_RELAY, else the site's origin)
  --serial <s>       which device, when adb sees more than one
  --adb <path>       adb itself (default: adb on the PATH); a .mjs or .js file is run with Node (a stand-in)
  --xr ar|vr         what the page's Enter button asks for (default ar)
  --no-awake         leave the headset's sleep alone
  --once             watch: one round, then stop
  --sec <n>          stats: how long to read (default 30)
  --out <file>       shot: where to save
  --press-gap <s>    at most one press in this many seconds on one page load (default 15)
Environment: NOTES_TOKEN (the relay's password; never printed), NOTES_RELAY.
Exit: 0 fine, 1 an error or usage, 2 the relay refused, 3 no headset (none, several, or not allowed), 4 not entered.`;

// ---------- options ----------

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMMANDS = ['check', 'wake', 'open', 'enter', 'stats', 'shot', 'watch'];
const O = { cmd: 'check', site: 'https://stories.lab.lbi-netmed.com/', relay: '', serial: '', adb: 'adb', xr: 'ar',
  awake: true, once: false, sec: 30, out: '', gap: 15 };
const TOKEN = process.env.NOTES_TOKEN || '';

class Fail extends Error { constructor(msg, code = 1) { super(msg); this.code = code; } }

function parseArgs(argv) {
  const a = argv.slice();
  const val = (f) => { const v = a.shift(); if (v == null || v.startsWith('--')) throw new Fail(f + ' needs a value.\n\n' + USAGE); return v; };
  let named = false;
  while (a.length) {
    const x = a.shift();
    if (x === '--help' || x === '-h') { console.log(USAGE); process.exit(0); }
    else if (x === '--watch') O.cmd = 'watch';
    else if (x === '--site') O.site = val(x);
    else if (x === '--relay') O.relay = val(x);
    else if (x === '--serial') O.serial = val(x);
    else if (x === '--adb') O.adb = val(x);
    else if (x === '--xr') { O.xr = val(x); if (!/^(ar|vr)$/.test(O.xr)) throw new Fail('--xr is ar or vr.'); }
    else if (x === '--no-awake') O.awake = false;
    else if (x === '--once') O.once = true;
    else if (x === '--sec') { O.sec = +val(x); if (!(O.sec > 0 && O.sec <= 3600)) throw new Fail('--sec is 1 to 3600.'); }
    else if (x === '--out') O.out = val(x);
    else if (x === '--press-gap') { O.gap = +val(x); if (!(O.gap >= 0)) throw new Fail('--press-gap is a number of seconds.'); }
    else if (!x.startsWith('-') && !named && COMMANDS.includes(x)) { O.cmd = x; named = true; }
    else throw new Fail('Not understood: ' + x + '\n\n' + USAGE);
  }
  let site;
  try { site = new URL(O.site); } catch { throw new Fail('--site is not an address: ' + O.site); }
  if (!/^https?:$/.test(site.protocol)) throw new Fail('--site must be http or https.');
  site.hash = ''; site.search = '';
  O.site = site.href;
  if (/['"\s\\`$]/.test(O.site)) throw new Fail('--site may not contain quotes, spaces, backslashes, backticks or $.');
  O.relay = (O.relay || process.env.NOTES_RELAY || site.origin).replace(/\/+$/, '');
  if (/\.(cmd|bat)$/i.test(O.adb)) throw new Fail('--adb: give adb itself (adb.exe) or a .mjs stand-in, not a .cmd or .bat file.');
}

// ---------- saying things (the password never) ----------

const scrub = (s) => { s = String(s); return TOKEN && TOKEN.length >= 4 ? s.split(TOKEN).join('***') : s; };
const stamp = () => new Date().toTimeString().slice(0, 8);
const say = (m) => console.log(scrub('[' + stamp() + '] ' + m));
const warn = (m) => console.error(scrub('[' + stamp() + '] ' + m));
const said = new Map();
// a message said once until it changes (a watch loop repeats itself every two seconds)
function sayOnce(key, m, err) { if (said.get(key) === m) return; said.set(key, m); (err ? warn : say)(m); }
const forget = (key) => said.delete(key);

// ---------- adb ----------

const isScript = () => /\.(mjs|cjs|js)$/i.test(O.adb);
const adbCmd = (args) => isScript() ? [process.execPath, [O.adb].concat(args)] : [O.adb, args];
const serialArgs = () => (O.serial ? ['-s', O.serial] : []);

function adbRaw(args, { binary = false, timeout = 20000 } = {}) {
  const [cmd, full] = adbCmd(args);
  return new Promise((res) => {
    execFile(cmd, full, { encoding: binary ? 'buffer' : 'utf8', timeout, maxBuffer: 64 << 20, windowsHide: true }, (err, out, errOut) => {
      if (err && err.code === 'ENOENT') return res({ ok: false, missing: true, out: binary ? Buffer.alloc(0) : '', err: 'adb was not found' });
      res({ ok: !err, out: out == null ? '' : out, err: String(errOut || '') + (err && !errOut ? String(err.message || err) : '') });
    });
  });
}
const adb = (args, o) => adbRaw(serialArgs().concat(args), o);
function noAdb() {
  return new Fail('adb was not found. Install Android platform tools (https://developer.android.com/tools/releases/platform-tools), ' +
    'put adb on the PATH, or give --adb <path to adb>.', 3);
}

// `adb devices -l`: the headset is the one device whose model names a Quest
export function parseDevices(text) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim() || /^List of devices/.test(line) || line.startsWith('*')) continue;
    const m = line.match(/^(\S+)\s+(\S+)(.*)$/);
    if (!m) continue;
    const d = { serial: m[1], state: m[2] };
    for (const kv of m[3].trim().split(/\s+/)) { const i = kv.indexOf(':'); if (i > 0) d[kv.slice(0, i)] = kv.slice(i + 1); }
    out.push(d);
  }
  return out;
}

async function findDevice() {
  const r = await adbRaw(['devices', '-l']);
  if (r.missing) throw noAdb();
  if (!r.ok) throw new Fail('adb could not list devices: ' + r.err.trim(), 3);
  const all = parseDevices(r.out);
  const desc = (d) => d.serial + ' (' + (d.model || d.product || 'unknown model') + ', ' + d.state + ')';
  if (O.serial) {
    const d = all.find((x) => x.serial === O.serial);
    if (!d) throw new Fail('adb does not see the device ' + O.serial + '. It sees: ' + (all.map(desc).join('; ') || 'nothing') + '.', 3);
    if (d.state === 'unauthorized') throw unauth();
    if (d.state !== 'device') throw new Fail('The device ' + O.serial + ' is ' + d.state + ': unplug it and plug it in again.', 3);
    if (!/quest|eureka|hollywood|seacliff|panther/i.test((d.model || '') + ' ' + (d.product || ''))) say('Note: ' + desc(d) + ' does not say it is a Quest; using it as asked.');
    return d;
  }
  const ready = all.filter((d) => d.state === 'device');
  const quests = ready.filter((d) => /quest/i.test(d.model || '') || /eureka|hollywood|seacliff|panther/i.test(d.product || ''));
  if (quests.length === 1) { O.serial = quests[0].serial; return quests[0]; }
  if (quests.length > 1 || (!quests.length && ready.length > 1)) {
    throw new Fail('adb sees more than one device: ' + (quests.length ? quests : ready).map(desc).join('; ') + '. Say which with --serial <serial>.', 3);
  }
  if (all.some((d) => d.state === 'unauthorized')) throw unauth();
  if (ready.length === 1) throw new Fail('adb sees one device, but it does not say it is a Quest: ' + desc(ready[0]) + '. If it is the headset, give --serial ' + ready[0].serial + '.', 3);
  if (all.length) throw new Fail('adb sees ' + all.map(desc).join('; ') + ', but none is ready: unplug the headset and plug it in again.', 3);
  throw new Fail('No headset found by adb. Plug the Quest in with a data cable, switch developer mode on for it in the Meta Horizon app ' +
    "(Devices, Headset settings, Developer mode), put it on and allow USB debugging (tick Always allow). Then 'adb devices' lists it.", 3);
}
const unauth = () => new Fail('The headset is connected but has not allowed this computer yet. Put it on, allow USB debugging ' +
  '(tick Always allow from this computer), then run this again.', 3);

// Keeping the headset awake. The commands differ between headset software versions; each entry says where it comes
// from. None of them changes a stored setting. A command that is refused is said once, and the rest carry on.
const AWAKE = {
  on: [
    // Meta's power manager (com.oculus.vrpowermanager): behave as if the proximity sensor were covered, so the headset
    // neither sleeps nor dims while unworn. Meta's own advice for automated testing (Quest system software since about
    // v30; the owner's headset also has its sensor covered and its sleep set to four hours, so this is belt and braces).
    { what: 'proximity sensor held as covered', args: ['shell', 'am', 'broadcast', '-a', 'com.oculus.vrpowermanager.prox_close'] },
  ],
  every: 5 * 60 * 1000, // the power manager forgets it after a while and on a reboot: sent again every five minutes
  off: [
    // The same power manager: hand the proximity sensor back to the hardware (ends the "automation" state prox_close
    // began). Older system software used com.oculus.vrpowermanager.prox_open for this; automation_disable is the one
    // Meta documents now.
    { what: 'proximity sensor given back', args: ['shell', 'am', 'broadcast', '-a', 'com.oculus.vrpowermanager.automation_disable'] },
  ],
};
let awakeOn = false, awakeTimer = null;
async function awakeRun(list) {
  for (const c of list) {
    const r = await adb(c.args, { timeout: 10000 });
    const text = (r.out + ' ' + r.err).trim();
    if (!r.ok || /Exception|Error|Security|not allowed/i.test(text)) sayOnce('awake:' + c.what, 'The headset refused "' + c.what + '" (' + (text.split('\n')[0] || 'no answer') + '); carrying on.', true);
  }
}
async function awakeStart() {
  if (!O.awake) return;
  awakeOn = true;
  await awakeRun(AWAKE.on);
  say('Keeping the headset awake (put back on exit).');
  awakeTimer = setInterval(() => { awakeRun(AWAKE.on).catch(() => {}); }, AWAKE.every);
}
async function awakeStop() {
  if (awakeTimer) clearInterval(awakeTimer);
  awakeTimer = null;
  if (!awakeOn) return;
  awakeOn = false;
  await awakeRun(AWAKE.off);
  say('The headset may sleep again as it is set to.');
}

// ---------- DevTools over adb's forward ----------

const forwards = new Set();
const fwdPorts = new Map(); // socket name -> local port
// the browser's DevTools sockets in /proc/net/unix: @chrome_devtools_remote, or a name ending _devtools_remote(_pid)
export function parseSockets(text) {
  const names = new Set();
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.trim().match(/@(\S*_devtools_remote(?:_\d+)?)$/);
    if (m) names.add(m[1]);
  }
  const rank = (n) => (/oculus\.browser|^chrome_devtools_remote$/.test(n) ? 0 : /webview/.test(n) ? 2 : 1);
  return [...names].sort((a, b) => rank(a) - rank(b));
}
async function forward(sock) {
  if (fwdPorts.has(sock)) return fwdPorts.get(sock);
  // tcp:0: adb picks a free port and prints it (adb 1.0.36 and later), so no race over a port
  const r = await adb(['forward', 'tcp:0', 'localabstract:' + sock]);
  const port = parseInt(String(r.out).trim(), 10);
  if (!r.ok || !(port > 0)) throw new Fail('adb could not forward the DevTools socket ' + sock + ': ' + (r.err || r.out).trim());
  forwards.add(port); fwdPorts.set(sock, port);
  return port;
}
async function unforwardAll() {
  for (const p of forwards) await adb(['forward', '--remove', 'tcp:' + p], { timeout: 5000 });
  forwards.clear(); fwdPorts.clear();
}
async function getJson(url, ms = 4000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const sameSite = (u) => typeof u === 'string' && u.startsWith(O.site);
// the page of the site, through each DevTools socket the browser offers
async function findPage() {
  const r = await adb(['shell', 'cat', '/proc/net/unix']);
  const socks = parseSockets(r.out);
  if (!socks.length) return { why: 'Quest Browser offers no DevTools socket: is it open on the headset?' };
  const seen = [];
  for (const s of socks) {
    let port, list;
    try { port = await forward(s); list = await getJson('http://127.0.0.1:' + port + '/json/list'); }
    catch (e) { fwdPorts.delete(s); continue; }
    const pages = (Array.isArray(list) ? list : []).filter((t) => t.type === 'page');
    seen.push(...pages.map((t) => t.url));
    const mine = pages.filter((t) => sameSite(t.url));
    const t = mine.find((x) => /bench=on/.test(x.url)) || mine[0];
    if (t) return { port, target: t, sock: s };
  }
  return { why: seen.length ? 'no page of ' + O.site + ' is open (the browser shows ' + seen.length + ' other page' + (seen.length > 1 ? 's' : '') + ')' : 'the browser has no page open' };
}

class Cdp {
  constructor(ws) {
    this.ws = ws; this.n = 0; this.wait = new Map(); this.subs = new Map(); this.closed = false;
    ws.addEventListener('message', (ev) => {
      let m; try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch { return; }
      if (m.id && this.wait.has(m.id)) { const w = this.wait.get(m.id); this.wait.delete(m.id); clearTimeout(w.t); m.error ? w.no(new Error(m.error.message)) : w.ok(m.result || {}); }
      else if (m.method) for (const f of this.subs.get(m.method) || []) { try { f(m.params || {}); } catch {} }
    });
    ws.addEventListener('close', () => {
      this.closed = true;
      for (const w of this.wait.values()) { clearTimeout(w.t); w.no(new Error('the DevTools connection closed')); }
      this.wait.clear();
    });
  }
  static open(url, ms = 6000) {
    return new Promise((ok, no) => {
      let ws;
      try { ws = new WebSocket(url); } catch (e) { return no(e); }
      const t = setTimeout(() => { try { ws.close(); } catch {} no(new Error('DevTools did not answer')); }, ms);
      ws.addEventListener('open', () => { clearTimeout(t); ok(new Cdp(ws)); });
      ws.addEventListener('error', () => { clearTimeout(t); no(new Error('DevTools refused the connection')); });
    });
  }
  send(method, params = {}, ms = 6000) {
    if (this.closed) return Promise.reject(new Error('the DevTools connection closed'));
    const id = ++this.n;
    return new Promise((ok, no) => {
      const t = setTimeout(() => { this.wait.delete(id); no(new Error(method + ' timed out')); }, ms);
      this.wait.set(id, { ok, no, t });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, f) { if (!this.subs.has(method)) this.subs.set(method, []); this.subs.get(method).push(f); }
  close() { try { this.ws.close(); } catch {} this.closed = true; }
}

// The only two things ever evaluated in the page (SPEC section 9.1). The rectangle comes with the window's size and the
// pinch zoom (visualViewport), so a press is never sent beside the button or out of view.
const EXPR_STATE = 'HOST.bench && HOST.bench.state()';
const EXPR_RECT = "(() => { const b = document.querySelector('#benchEnter'); if (!b) return null; const r = b.getBoundingClientRect(), v = window.visualViewport; " +
  "return JSON.stringify({ left: r.left, top: r.top, width: r.width, height: r.height, vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio, " +
  "scale: v ? v.scale : 1, ox: v ? v.offsetLeft : 0, oy: v ? v.offsetTop : 0, w: v ? v.width : innerWidth, h: v ? v.height : innerHeight }); })()";
// Where to press, in the CSS pixels DevTools' input takes, or why not: never out of the visible part of the page. Pinch-
// zoomed, desktop Chromium takes the layout's own pixels (tried in the test); whether Quest Browser does is unknown, so
// `alt` is the same place in the visual viewport's pixels (less the zoom's offset, times its scale), tried every other
// press. Exported for the test.
export function pressPoint(rect) {
  if (!rect || !(rect.width >= 1 && rect.height >= 1)) return { why: 'The Enter button is hidden.' };
  const scale = rect.scale > 0 ? rect.scale : 1, ox = rect.ox || 0, oy = rect.oy || 0;
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  const w = rect.w > 0 ? rect.w : rect.vw, h = rect.h > 0 ? rect.h : rect.vh;
  const zoom = Math.abs(scale - 1) > 0.01 ? ' (the page is zoomed in ' + Math.round(scale * 100) + ' %: pinch it back on the headset)' : '';
  if (!(cx >= ox && cx < ox + w && cy >= oy && cy < oy + h)) return { why: 'The Enter button is out of view' + (zoom || ' (the window is ' + Math.round(rect.vw) + ' x ' + Math.round(rect.vh) + ' and the button is at ' + Math.round(cx) + ', ' + Math.round(cy) + ')') + '.' };
  return { x: cx, y: cy, zoom, alt: zoom ? { x: (cx - ox) * scale, y: (cy - oy) * scale } : null };
}

let P = null;          // the page: { cdp, port, id, url }
let dialog = null;     // an open JavaScript dialog on it (reported, never answered)
let lastPress = 0;     // when we last pressed, on this page load
let zoomTries = 0;     // presses on a zoomed page (the two ways of placing them taken in turn)
async function connectPage() {
  if (P && !P.cdp.closed) return P;
  P = null;
  const f = await findPage();
  if (!f.target) return { why: f.why };
  // the address DevTools gives may name another host; through the forward it is always 127.0.0.1:<port>
  const cdp = await Cdp.open('ws://127.0.0.1:' + f.port + '/devtools/page/' + f.target.id);
  dialog = null;
  cdp.on('Page.javascriptDialogOpening', (p) => { dialog = p; say('The page opened a ' + (p.type || 'dialog') + ' box: "' + String(p.message || '').slice(0, 120) + '". This helper never answers it: put the headset on and answer it there.'); });
  cdp.on('Page.javascriptDialogClosed', () => { dialog = null; });
  cdp.on('Page.loadEventFired', () => { lastPress = 0; forget('phase'); say('The page loaded.'); });
  cdp.on('Page.frameNavigated', (p) => { if (p.frame && !p.frame.parentId) { lastPress = 0; if (P) P.url = p.frame.url; } });
  try { await cdp.send('Page.enable'); } catch {}
  P = { cdp, port: f.port, id: f.target.id, url: f.target.url };
  return P;
}
async function evalValue(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true }, 5000);
  if (r.exceptionDetails) return { err: (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text || 'an error').split('\n')[0] };
  return { v: r.result ? r.result.value : undefined };
}
// The headset's clock less this computer's (ms), from the page's Date.now() over a quick round trip; else from the VrApi
// lines as they come (an underestimate by the log's delay); else 0. Logcat's times and every job's t0 and t1 are the
// headset's: the helper compares them only with hNow(), never with its own clock (SPEC 9.5).
let SKEW = null;
const hNow = () => Date.now() + (SKEW != null ? SKEW : LOG.skew != null ? LOG.skew : 0);
async function readState(cdp) {
  if (dialog) return { err: 'a dialog box is open on the page' };
  const a = Date.now(), r = await evalValue(cdp, EXPR_STATE), b = Date.now();
  if (!r.err && r.v && typeof r.v.now === 'number' && b - a < 1000) SKEW = Math.round(r.v.now - (a + b) / 2);
  if (r.err) return { err: /HOST is not defined/.test(r.err) ? 'this page is not the app' : r.err };
  if (!r.v) return { err: 'bench mode is off on the page' };
  return { s: r.v };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Press #benchEnter with a real mouse event at its centre (a script click is no user gesture), then read what the
// page says happened (SPEC section 9.3). Returns { ok, msg }.
async function pressEnter(cdp) {
  const b = await readState(cdp);
  if (b.err) return { ok: false, msg: 'Cannot press Enter: ' + b.err + '.' };
  const before = b.s.press || { n: 0 };
  const r = await evalValue(cdp, EXPR_RECT);
  if (r.err || !r.v) return { ok: false, msg: 'The page shows no Enter button (#benchEnter)' + (r.err ? ': ' + r.err : '') + '.' };
  let rect; try { rect = JSON.parse(r.v); } catch { return { ok: false, msg: 'The Enter button has no place on the page.' }; }
  const pt = pressPoint(rect);
  if (pt.why) { lastPress = Date.now(); return { ok: false, msg: pt.why }; }
  // (zoomed: every other press at the visual viewport's place)
  const useAlt = !!(pt.alt && (zoomTries++ % 2));
  const { x, y } = useAlt ? pt.alt : pt;
  lastPress = Date.now();
  try {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  } catch (e) {
    if (dialog) return { ok: false, msg: 'A dialog box is open on the page; put the headset on and answer it.' };
    return { ok: false, msg: 'The press could not be sent: ' + e.message + '.' };
  }
  const want = (b.s.want || O.xr).toUpperCase();
  const end = Date.now() + 10000;
  let s = null;
  while (Date.now() < end) {
    await sleep(400);
    if (dialog) return { ok: false, msg: 'A dialog box opened on the page; put the headset on and answer it (this helper never does).' };
    const q = await readState(cdp).catch((e) => ({ err: e.message }));
    if (q.err) continue;
    s = q.s;
    const p = s.press || { n: 0 };
    if (p.n > before.n && s.xr) return { ok: true, msg: 'Pressed Enter ' + want + ': the page is in ' + String(s.xr).toUpperCase() + (p.trusted ? ' (a trusted press).' : '.') };
    if (p.n > before.n && p.err) return { ok: false, msg: 'Pressed Enter ' + want + (p.trusted ? ' (a trusted press)' : ' (the page saw an untrusted press)') + ', but the page could not start the session: ' + p.err };
  }
  const p = (s && s.press) || before;
  if (p.n > before.n) return { ok: false, msg: 'Pressed Enter ' + want + ' (' + (p.trusted ? 'a trusted press' : 'the page saw an untrusted press') + '), but no session started in 10 s. The browser may be asking a question on the headset (to allow ' + want + ' for this site). Put it on and allow it once.' };
  return { ok: false, msg: 'Pressed Enter ' + want + ', but the press did not reach the page' + (pt.zoom ? pt.zoom + (useAlt ? ', placed for the zoom' : ', placed as unzoomed') : '') + '. The button may be covered, or the browser zoomed (Quest Browser\'s own page zoom: set it back to 100 %); a press is tried again in ' + O.gap + ' s.' };
}

// ---------- the headset's frame statistics (VrApi lines) ----------

export const COLS = ['t', 'fps', 'stale', 'cpuLvl', 'gpuLvl', 'cpuPct', 'gpuPct', 'tempC'];
const LINE = /^\s*(\d{9,11}(?:\.\d+)?)\s+\d+\s+\d+\s+[VDIWEFS]\s+([^:]*?)\s*:\s?(.*)$/;
const num = (v) => { const m = String(v == null ? '' : v).match(/-?\d+(?:\.\d+)?/); return m ? +m[0] : null; };
// "a=1,b=2/3,c=4(x5,y6),loose" -> { a: '1', b: '2/3', c: '4(x5,y6)' } (a piece without '=' joins the key before it)
export function splitFields(body) {
  const out = {}; let depth = 0, cur = '', last = null;
  const put = (part) => {
    const i = part.indexOf('=');
    if (i > 0) { last = part.slice(0, i).trim(); out[last] = part.slice(i + 1).trim(); }
    else if (last && part.trim()) out[last] += ',' + part.trim();
  };
  for (const ch of String(body)) {
    if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && !depth) { put(cur); cur = ''; } else cur += ch;
  }
  put(cur);
  return out;
}
// One logcat line (-v epoch). null: not a frame-statistics line (other tags, other VrApi messages). { bad: true }: a
// VrApi statistics line that could not be read. Never throws. The fields vary between system versions: every field is
// kept in `f`; the ones the bench reports are read where they are found.
export function parseLine(line) {
  try {
    const s = String(line);
    const m = s.match(LINE);
    if (!m) return /VrApi/.test(s) && /FPS=/.test(s) ? { bad: true } : null;
    if (!/^VrApi$/i.test(m[2].trim())) return null;
    if (!/FPS=/.test(m[3])) return null;
    const t = Math.round(parseFloat(m[1]) * 1000);
    const f = splitFields(m[3]);
    const fps = num(f.FPS);
    if (fps == null || !(t > 0)) return { bad: true };
    const lk = Object.keys(f).find((k) => /^CPU\d*\/GPU$/i.test(k));
    const lv = lk ? String(f[lk]).split(',')[0].split('/') : [];
    let cpuPct = num(f['CPU%']), gpuPct = num(f['GPU%']);
    if (cpuPct != null && cpuPct > 1.5) cpuPct /= 100;
    if (gpuPct != null && gpuPct > 1.5) gpuPct /= 100;
    return { t, fps, stale: num(f.Stale), cpuLvl: lv.length > 1 ? num(lv[0]) : null, gpuLvl: lv.length > 1 ? num(lv[1]) : null,
      cpuPct, gpuPct, tempC: num(f.Temp), freeMB: num(f.Free), f };
  } catch { return { bad: true }; }
}
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const vals = (rows, k) => rows.map((r) => r[k]).filter((v) => typeof v === 'number' && isFinite(v));
// a stretch of lines in one: fps the mean, fpsMin the lowest, stale the sum (each line counts its second), the levels
// the highest, the loads the mean, the temperature the highest, free memory the lowest
export function summarise(rows) {
  if (!rows.length) return null;
  const mx = (k) => { const v = vals(rows, k); return v.length ? Math.max(...v) : null; };
  const mn = (k) => { const v = vals(rows, k); return v.length ? Math.min(...v) : null; };
  const st = vals(rows, 'stale');
  return { n: rows.length, fps: r1(mean(vals(rows, 'fps'))), fpsMin: mn('fps'), stale: st.length ? st.reduce((a, b) => a + b, 0) : null,
    cpuLvl: mx('cpuLvl'), gpuLvl: mx('gpuLvl'), cpuPct: r2(mean(vals(rows, 'cpuPct'))), gpuPct: r2(mean(vals(rows, 'gpuPct'))),
    tempC: mx('tempC'), freeMB: mn('freeMB') };
}
// The device statistics for a job's seconds (SPEC section 9.5): from the kept lines between t0 and t1, one entry for
// each step with its own t0 and t1.
export function vrapiFor(lines, bad, from, to, steps) {
  const rows = lines.filter((r) => r.t >= from && r.t <= to);
  const unread = bad.filter((t) => t >= from && t <= to).length;
  if (!rows.length) return { vrapi: null, notes: "no VrApi lines in the job's seconds" + (unread ? '; ' + unread + ' unreadable' : '') };
  const all = summarise(rows);
  const per = [];
  for (const s of steps || []) {
    if (!(s && s.t0 > 0 && s.t1 >= s.t0)) continue;
    const x = summarise(rows.filter((r) => r.t >= s.t0 && r.t <= s.t1));
    const e = { i: s.i, t0: s.t0, t1: s.t1 };
    if (x) { delete x.freeMB; Object.assign(e, x); } else e.n = 0;
    per.push(e);
  }
  let pick = rows;
  if (pick.length > 3600) { const k = pick.length / 3600; pick = Array.from({ length: 3600 }, (_, i) => rows[Math.floor(i * k)]); }
  const keys = new Set(); for (const r of rows) for (const k of Object.keys(r.f || {})) keys.add(k);
  return { vrapi: { from, to, n: rows.length, per, all, rows: pick.map((r) => COLS.map((c) => (r[c] == null ? null : r[c]))), cols: COLS, fields: [...keys] },
    notes: 'parsed ' + rows.length + ' VrApi lines; ' + unread + ' unreadable' };
}

const LOG = { lines: [], bad: [], child: null, keep: 30 * 60 * 1000, got: 0, est: [], skew: null };
let quitting = false;
function logcatStart() {
  if (LOG.child || quitting) return;
  // -s VrApi: only that tag (VrApi:V *:S); -v epoch: seconds since 1970 on the headset's clock (the page's Date.now())
  const [cmd, full] = adbCmd(serialArgs().concat(['logcat', '-v', 'epoch', '-s', 'VrApi']));
  let ch;
  try { ch = spawn(cmd, full, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { sayOnce('logcat', 'Could not read the headset\'s log: ' + e.message, true); return; }
  LOG.child = ch;
  ch.on('error', (e) => sayOnce('logcat', 'Could not read the headset\'s log: ' + e.message, true));
  createInterface({ input: ch.stdout }).on('line', (line) => {
    const r = parseLine(line);
    if (!r) return;
    if (!r.bad) { LOG.est.push(r.t - Date.now()); if (LOG.est.length > 30) LOG.est.shift(); LOG.skew = Math.max(...LOG.est); }
    // (an unreadable line has no time of its own: stamped on the headset's clock as it comes)
    const now = hNow();
    if (r.bad) { LOG.bad.push(now); while (LOG.bad.length && LOG.bad[0] < now - LOG.keep) LOG.bad.shift(); return; }
    LOG.got++;
    LOG.lines.push(r);
    const cut = r.t - LOG.keep;
    while (LOG.lines.length && LOG.lines[0].t < cut) LOG.lines.shift();
  });
  ch.stderr.on('data', () => {});
  ch.on('exit', () => {
    LOG.child = null;
    if (quitting) return;
    sayOnce('logcat', "The headset's log stopped (unplugged?); reading it again in 5 s.", true);
    setTimeout(logcatStart, 5000);
  });
}
function logcatStop() { if (LOG.child) { try { LOG.child.kill(); } catch {} LOG.child = null; } }

// ---------- device screenshot ----------

const SHOTS = '/sdcard/Oculus/Screenshots';
const isPng = (b) => b && b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const isJpg = (b) => b && b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
async function newestShot() {
  const r = await adb(['shell', 'ls', '-t', SHOTS], { timeout: 8000 });
  if (!r.ok) return '';
  const f = String(r.out).split(/\r?\n/).map((x) => x.trim()).find((x) => /^[\w.\-]+\.(png|jpe?g)$/i.test(x));
  return f || '';
}
// the headset's own capture service first (it sees the compositor's view), else the plain screencap
export async function devshot() {
  const before = await newestShot();
  const r = await adb(['shell', 'am', 'startservice', '-n', 'com.oculus.metacam/.capture.CaptureService', '-a', 'TAKE_SCREENSHOT'], { timeout: 10000 });
  if (r.ok && !/Error|not found|Exception/i.test(r.out + r.err)) {
    for (let i = 0; i < 12; i++) {
      await sleep(500);
      const f = await newestShot();
      if (f && f !== before) {
        await sleep(400); // let it finish writing
        const g = await adb(['exec-out', 'cat', SHOTS + '/' + f], { binary: true, timeout: 20000 });
        if (g.ok && (isPng(g.out) || isJpg(g.out))) return { how: 'metacam', type: isPng(g.out) ? 'image/png' : 'image/jpeg', buf: g.out };
        break;
      }
    }
  }
  const s = await adb(['exec-out', 'screencap', '-p'], { binary: true, timeout: 20000 });
  if (s.ok && isPng(s.out)) return { how: 'screencap', type: 'image/png', buf: s.out };
  throw new Error('no device screenshot: ' + (String(s.err || '').trim() || 'the headset sent no picture'));
}

// ---------- the relay ----------

let relayDown = 0;
async function api(p, { method = 'GET', json, body, type, ms = 15000 } = {}) {
  const headers = {};
  if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  else if (type) headers['Content-Type'] = type;
  const r = await fetch(O.relay + p, { method, headers, body, signal: AbortSignal.timeout(ms) });
  let data = null;
  if (r.status !== 204) { const t = await r.text(); try { data = JSON.parse(t); } catch { data = null; } }
  return { status: r.status, data };
}
// says once why the relay will not do (and true when it will)
function relayOk(r) {
  if (r.status === 401) { sayOnce('relay', 'The relay wants its password: set NOTES_TOKEN (it is never printed).', true); return false; }
  if (r.status === 404 && r.data && /no bench/.test(r.data.error || '')) { sayOnce('relay', 'The relay ' + O.relay + ' has no bench (it is started with --bench on the test place only).', true); return false; }
  if (r.status >= 400) { sayOnce('relay', 'The relay answered ' + r.status + (r.data && r.data.error ? ': ' + r.data.error : '') + '.', true); return false; }
  if (said.has('relay')) { forget('relay'); say('The relay answers again.'); }
  return true;
}
function relayCut(e) { relayDown++; sayOnce('relay', 'The relay ' + O.relay + ' does not answer (' + (e.name === 'TimeoutError' ? 'timed out' : e.message) + '); trying again.', true); }

// ---------- the helper's own jobs (to: 'adb', SPEC section 9.4) ----------

let HS = '';
const ADB_CMDS = {
  async devshot(st, job) {
    const n = Number.isInteger(st.n) && st.n >= 1 && st.n <= 5 ? st.n : 1;
    const shot = await devshot();
    const r = await api('/api/bench/jobs/' + job.id + '/devshot?n=' + n, { method: 'POST', body: shot.buf, type: shot.type, ms: 60000 });
    if (r.status >= 300) throw new Error('the relay refused the screenshot (' + r.status + ')');
    return { how: shot.how, n, bytes: shot.buf.length };
  },
  async enter() {
    const p = await connectPage();
    if (!p.cdp) throw new Error('no bench page to press on: ' + p.why);
    const r = await pressEnter(p.cdp);
    if (!r.ok) throw new Error(r.msg);
    return { msg: r.msg };
  },
  async open() { return { url: await openAddress() }; },
  // (onto the job named by `job`, else this adb job's own record; the summary is the step's out either way)
  async vrapi(st, job) {
    const from = +st.from, to = +st.to, onto = typeof st.job === 'string' && /^\d{8}-\d{6}-[a-z0-9]{4}$/.test(st.job) ? st.job : job.id;
    if (!(from > 0 && to >= from)) throw new Error('vrapi needs from and to (ms on the headset\'s clock)');
    const v = vrapiFor(LOG.lines, LOG.bad, from, to, []);
    const r = await api('/api/bench/jobs/' + onto + '/adb', { method: 'POST', json: v });
    if (r.status >= 300) throw new Error('the relay refused the statistics for job ' + onto + ' (' + r.status + ')');
    return { onto, n: v.vrapi ? v.vrapi.n : 0, all: v.vrapi ? v.vrapi.all : null, notes: v.notes };
  },
};
async function runAdbJob(job) {
  const steps = Array.isArray(job.steps) ? job.steps : [];
  const hs = job.hs || HS || 'adb';
  const res = { hs, ok: true, why: '', t0: Date.now(), t1: 0, steps: [], report: null };
  say('Job ' + job.id + ' (' + steps.length + ' step' + (steps.length === 1 ? '' : 's') + ') taken.');
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i] || {};
    try {
      const pr = await api('/api/bench/jobs/' + job.id + '/progress', { method: 'POST', json: { hs, step: i, of: steps.length, note: String(st.cmd || '') } });
      if (pr.data && pr.data.cancel) { res.ok = false; res.why = 'cancelled'; break; }
    } catch {}
    const e = { i, cmd: String(st.cmd || ''), ok: true, t0: Date.now(), t1: 0 };
    try {
      const f = Object.prototype.hasOwnProperty.call(ADB_CMDS, st.cmd) ? ADB_CMDS[st.cmd] : null;
      if (!f) throw new Error('not a helper command: ' + e.cmd);
      e.out = await f(st, job);
    } catch (err) { e.ok = false; e.err = String(err.message || err); }
    e.t1 = Date.now();
    res.steps.push(e);
    if (!e.ok && !st.soft) { res.ok = false; res.why = e.err; break; }
  }
  res.t1 = Date.now();
  try { const r = await api('/api/bench/jobs/' + job.id + '/result', { method: 'POST', json: res }); if (r.status >= 300) warn('The relay refused job ' + job.id + "'s result (" + r.status + ').'); }
  catch (e) { relayCut(e); }
  say('Job ' + job.id + (res.ok ? ' done.' : ' failed: ' + res.why));
}
async function adbJobRound(wait) {
  let r;
  // (until the page's id is known the helper asks as 'adb': it then takes the jobs for no headset in particular, an open
  // for a headset with no page of the site among them)
  try { r = await api('/api/bench/next?role=adb&hs=' + encodeURIComponent(HS || 'adb') + '&wait=' + wait, { ms: (wait + 10) * 1000 }); }
  catch (e) { relayCut(e); return 'cut'; }
  if (!relayOk(r)) return r.status === 401 || r.status === 404 ? 'no' : 'bad';
  if (r.status === 200 && r.data && r.data.job) await runAdbJob(r.data.job);
  return 'ok';
}

// ---------- frame statistics onto each bench job (SPEC section 9.5) ----------

const handled = new Set();
async function attachRound() {
  for (const state of ['done', 'failed']) {
    let r;
    try { r = await api('/api/bench/jobs?state=' + state + '&limit=50'); } catch (e) { relayCut(e); return; }
    if (!relayOk(r)) return;
    for (const sm of (r.data && r.data.jobs) || []) {
      if (!sm || typeof sm.id !== 'string' || handled.has(sm.id)) continue;
      if (HS && sm.hs && sm.hs !== HS) { handled.add(sm.id); continue; }
      let rec;
      try { const g = await api('/api/bench/jobs/' + encodeURIComponent(sm.id)); if (g.status !== 200) continue; rec = g.data; } catch { continue; }
      // the job's adb field: false asks for nothing; an object is the statistics already attached
      if (!rec || rec.adb === false || (rec.adb && typeof rec.adb === 'object') || rec.to === 'adb') { handled.add(sm.id); continue; }
      if (HS && rec.hs && rec.hs !== HS) { handled.add(sm.id); continue; }
      const res = rec.result;
      if (!res || !(res.t0 > 0)) { handled.add(sm.id); continue; }
      const t1 = res.t1 > res.t0 ? res.t1 : res.t0;
      const hn = hNow();                                                    // (the headset's clock: t1 is the page's)
      if (hn - t1 > LOG.keep) { handled.add(sm.id); continue; }             // older than the lines kept
      if (hn - t1 < 3000) continue;                                         // the log's last lines may still be coming
      const v = vrapiFor(LOG.lines, LOG.bad, res.t0, t1, res.steps);
      if (!LOG.got && !v.vrapi) v.notes = 'the helper has read no VrApi lines from the headset at all (the browser may log none on this system version)';
      try {
        const p = await api('/api/bench/jobs/' + encodeURIComponent(sm.id) + '/adb', { method: 'POST', json: v });
        if (p.status < 300) { handled.add(sm.id); say('Frame statistics attached to job ' + sm.id + ': ' + v.notes + (v.vrapi ? ', ' + v.vrapi.all.fps + ' fps.' : '.')); }
        else if (p.status !== 409) handled.add(sm.id);
      } catch (e) { relayCut(e); return; }
    }
  }
}

// ---------- the commands ----------

const benchAddress = () => O.site + '#dev=on&bench=on&benchxr=' + O.xr;
let opened = 0;
async function openAddress() {
  const url = benchAddress();
  // the remote shell parses the line: the address goes in single quotes (it has &); parseArgs refused quotes in it
  const r = await adb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', "'" + url + "'", 'com.oculus.browser']);
  if (!r.ok || /Error|Exception/.test(r.out + r.err)) throw new Fail('Quest Browser did not open the address: ' + (r.err || r.out).trim().split('\n')[0]);
  opened = Date.now();
  say('Opened ' + url + ' in Quest Browser.');
  return url;
}

const HELD = {
  'the relay wants its password': "The page waits for the relay's password: put the headset on once and enter the relay's password in the menu (this helper never gives the page a password).",
  'developer mode is off': 'The page waits: developer mode is off there.',
  'in a shared room': 'The page waits: it is in a shared room (bench mode never runs in one).',
  'main site': 'The page waits: bench mode is refused on the main site; use the test site.',
};
function phaseLine(s) {
  const j = s.job ? ', job ' + s.job.id + ' step ' + (s.job.step + 1) + ' of ' + s.job.of : '';
  const why = s.why ? ': ' + s.why : '';
  return 'Bench ' + (s.hs || '?') + ' is ' + s.phase + why + (s.xr ? ' (in ' + String(s.xr).toUpperCase() + ')' : ' (no session)') + j + (s.rel ? ', ' + s.rel : '') + '.';
}

// one look at the page: print a change, press Enter when it waits for one. Returns the state or null.
async function pageRound(press) {
  let p;
  try { p = await connectPage(); } catch (e) { sayOnce('page', 'Could not reach the browser\'s DevTools: ' + e.message, true); P = null; return null; }
  if (!p.cdp) { sayOnce('page', 'No bench page yet: ' + p.why + '.'); return null; }
  forget('page');
  let q;
  try { q = await readState(p.cdp); } catch (e) { sayOnce('state', 'The page did not answer: ' + e.message, true); if (p.cdp.closed) P = null; return null; }
  if (q.err) { sayOnce('state', 'The page: ' + q.err + '.'); return null; }
  forget('state');
  const s = q.s;
  if (s.hs && /^[a-z0-9]{8}$/.test(s.hs)) HS = s.hs;
  sayOnce('phase', phaseLine(s));
  if (s.phase === 'held' && HELD[s.why]) sayOnce('held', HELD[s.why]); else forget('held');
  if (press && s.phase === 'enter' && Date.now() - lastPress >= O.gap * 1000) {
    const r = await pressEnter(p.cdp);
    sayOnce('press', r.msg, !r.ok);
    if (r.ok) forget('press');
  }
  return s;
}

async function cmdCheck() {
  const d = await findDevice();
  say('Headset: ' + d.serial + ' (' + (d.model || d.product || 'model unknown') + ').');
  const bat = await adb(['shell', 'dumpsys', 'battery'], { timeout: 8000 });
  const lvl = String(bat.out).match(/level:\s*(\d+)/);
  if (lvl) say('Battery: ' + lvl[1] + '%' + (/(AC|USB) powered:\s*true/.test(bat.out) ? ', charging.' : '.'));
  const s = await pageRound(false);
  if (!s && !P) say("Open it with: node tools/bench/adb/adb.mjs open" + (O.site !== 'https://stories.lab.lbi-netmed.com/' ? ' --site ' + O.site : ''));
  try {
    const r = await api('/api/bench', { ms: 8000 });
    if (relayOk(r)) {
      const hs = (r.data && r.data.headsets) || [];
      say('Relay ' + O.relay + ': ' + hs.length + ' headset' + (hs.length === 1 ? '' : 's') + ' listening, ' + (r.data.queued || 0) + ' queued, ' + (r.data.running || 0) + ' running.');
    } else if (r.status === 401) return 2;
  } catch (e) { relayCut(e); }
  return 0;
}

async function cmdStats() {
  await findDevice();
  logcatStart();
  say('Reading the headset\'s VrApi lines for ' + O.sec + ' s ...');
  await sleep(1500);   // (the first lines give the headset's clock)
  const t0 = hNow();
  await sleep(O.sec * 1000);
  const v = vrapiFor(LOG.lines, LOG.bad, t0 - 2000, hNow(), []);
  console.log(statsTable(v));
  return v.vrapi ? 0 : 1;
}
export function statsTable(v) {
  if (!v.vrapi) return '\n' + v.notes + "\nIs an immersive page running? Quest Browser may also log no VrApi lines on this system version.\n";
  const a = v.vrapi.all, f = (x) => (x == null ? '' : x);
  return ['', '| lines | fps | lowest | stale | CPU level | GPU level | CPU load | GPU load | temperature | free MB |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    '| ' + [a.n, a.fps, a.fpsMin, a.stale, a.cpuLvl, a.gpuLvl, a.cpuPct, a.gpuPct, a.tempC == null ? '' : a.tempC + ' C', a.freeMB].map(f).join(' | ') + ' |',
    '', v.notes, ''].join('\n');
}

async function cmdShot() {
  await findDevice();
  const s = await devshot();
  const out = O.out || path.join(os.tmpdir(), 'quest-' + new Date().toISOString().replace(/[:.]/g, '-') + (s.type === 'image/png' ? '.png' : '.jpg'));
  fs.writeFileSync(out, s.buf);
  say('Saved ' + out + ' (' + s.buf.length + ' bytes, ' + s.how + ').');
  return 0;
}

async function cmdEnter() {
  await findDevice();
  const p = await connectPage();
  if (!p.cdp) throw new Fail('No bench page to press on: ' + p.why + '. Run: node tools/bench/adb/adb.mjs open', 4);
  const r = await pressEnter(p.cdp);
  (r.ok ? say : warn)(r.msg);
  return r.ok ? 0 : 4;
}

async function cmdWake() {
  await findDevice();
  await awakeStart();
  say('Press Ctrl+C to stop.');
  await new Promise(() => {});
}

async function cmdWatch() {
  const d = await findDevice();
  say('Watching ' + d.serial + ' (' + (d.model || 'Quest') + '); the relay is ' + O.relay + (TOKEN ? ' (password set).' : ' (no NOTES_TOKEN: jobs and statistics need it).'));
  await awakeStart();
  logcatStart();
  const first = await findPage().catch(() => ({}));
  if (!first.target) await openAddress();
  let pageBusy = false, attachBusy = false, noPageSince = 0;
  const pageTick = async () => {
    if (pageBusy || quitting) return; pageBusy = true;
    try {
      const s = await pageRound(true);
      if (!s && !P) { noPageSince = noPageSince || Date.now(); if (Date.now() - noPageSince > 120000 && Date.now() - opened > 300000) await openAddress().catch((e) => warn(e.message)); }
      else noPageSince = 0;
    } catch (e) { sayOnce('page', e.message, true); }
    pageBusy = false;
  };
  const attachTick = async () => { if (attachBusy || quitting) return; attachBusy = true; try { await attachRound(); } catch (e) { sayOnce('attach', e.message, true); } attachBusy = false; };
  if (O.once) {
    await sleep(2500);
    await pageTick();
    await adbJobRound(1);
    await attachTick();
    return 0;
  }
  setInterval(pageTick, 2000); pageTick();
  setInterval(attachTick, 5000);
  for (;;) {
    if (quitting) break;
    const r = await adbJobRound(20);
    // (a cut or another refusal: 10 to 30 s; the relay wanting its password or having no bench: a minute)
    if (r === 'cut') await sleep(30000); else if (r === 'no') await sleep(60000); else if (r === 'bad') await sleep(10000);
  }
  return 0;
}

// ---------- start and stop ----------

let stopping = null;
function quit(code) {
  if (stopping) return stopping;
  quitting = true;
  stopping = (async () => {
    logcatStop();
    try { await Promise.race([(async () => { await awakeStop(); await unforwardAll(); })(), sleep(10000)]); } catch {}
    if (P) P.cdp.close();
    process.exit(code);
  })();
  return stopping;
}

async function main() {
  try { parseArgs(process.argv.slice(2)); } catch (e) { console.error(scrub(e.message)); process.exit(e.code || 1); }
  process.on('SIGINT', () => { say('Stopping.'); quit(130); });
  process.on('SIGTERM', () => quit(143));
  if (process.platform === 'win32') process.on('SIGBREAK', () => quit(130));
  process.on('uncaughtException', (e) => { warn('Error: ' + (e && e.message || e)); quit(1); });
  process.on('unhandledRejection', (e) => { warn('Error: ' + (e && e.message || e)); quit(1); });
  let code = 0;
  try {
    code = await ({ check: cmdCheck, wake: cmdWake, open: async () => { await findDevice(); await openAddress(); return 0; },
      enter: cmdEnter, stats: cmdStats, shot: cmdShot, watch: cmdWatch })[O.cmd]();
  } catch (e) {
    warn(e instanceof Fail ? e.message : 'Error: ' + (e && e.message || e));
    code = e instanceof Fail ? e.code : 1;
  }
  await quit(code);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
