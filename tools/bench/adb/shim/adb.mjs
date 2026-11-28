#!/usr/bin/env node
// A stand-in for adb, for tools/bench/adb/test.mjs only: no headset, no Android. It answers the commands the helper
// sends, as a Quest 3 answers them as far as known, and writes each command line to $SHIM_DIR/adb.log.
//   SHIM_DIR       folder for adb.log (required)
//   SHIM_DEVICES   one (default) | none | two | unauth | other
//   SHIM_DEVTOOLS  the local Chromium's remote-debugging port (stands in for Quest Browser's DevTools socket)
//   SHIM_LOG_SEC   how many seconds `logcat` streams before it ends (default 120)
//   SHIM_SKEW_MS   the headset's clock less the computer's, in ms (default 0): logcat's times are the headset's
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const dir = process.env.SHIM_DIR || '';
if (dir) { try { fs.appendFileSync(path.join(dir, 'adb.log'), JSON.stringify(argv) + '\n'); } catch {} }
let a = argv.slice();
if (a[0] === '-s') a = a.slice(2);
const out = (s) => process.stdout.write(s);
const say = (s, code = 0) => { out(s); process.exitCode = code; };
const SERIAL = '2G0YC1ZF8B0123';
const DEVTOOLS = +process.env.SHIM_DEVTOOLS || 0;

async function navigate(url) {
  // the browser's first page goes to the address, as Quest Browser opens it in its current tab
  const list = await (await fetch('http://127.0.0.1:' + DEVTOOLS + '/json/list')).json();
  const t = list.find((x) => x.type === 'page');
  if (!t) return;
  await new Promise((ok) => {
    const ws = new WebSocket('ws://127.0.0.1:' + DEVTOOLS + '/devtools/page/' + t.id);
    ws.addEventListener('open', () => ws.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url } })));
    ws.addEventListener('message', () => { ws.close(); ok(); });
    ws.addEventListener('error', () => ok());
    setTimeout(ok, 3000);
  });
}

// three shapes of VrApi line seen across system versions, and lines the helper must not choke on
const SHAPES = [
  (n) => 'FPS=72/72,Prd=45ms,Tear=0,Early=0,Stale=' + (n % 3 === 0 ? 1 : 0) + ',Stale2/5/10/max=0/0/0/0,VSnc=1,Lat=-1,Fov=0,CPU4/GPU=4/' + (n % 2 ? 4 : 3) + ',2419/525MHz,OC=FF,TA=0/0/0,SP=N/N/N,Mem=2092MHz,Free=1520MB,PLS=0,Temp=36.' + (n % 10) + 'C/0.0C,TW=2.97ms,App=6.56ms,GD=0.00ms,CPU&GPU=8.93ms,LCnt=1(DR72,LM0),GPU%=0.88,CPU%=0.41(W0.45),DSF=1.00,CFL=15.94/23.27,ICFLp95=21.31',
  (n) => 'FPS=' + (60 + (n % 5)) + ',Prd=38ms,Tear=0,Early=0,Stale=2,VSnc=0,Lat=1,Fov=0,CPU/GPU=3/3,1478/490MHz,OC=FF,TA=0/0/0,SP=N/F/N,Mem=1804MHz,Free=2088MB,PSM=0,PLS=0,Temp=34.0C/0.0C,TW=3.10ms,App=12.10ms,GD=0.00ms',
  (n) => 'FPS=90/90,Prd=30ms,Tear=0,Early=0,Stale=0,CPU4/GPU=2/2,1708/415MHz,Free=1800MB,Temp=33.5C,GPU%=62,LCnt=2(DR90,LM0),NewField=7',
];
const BAD = [
  'VrApi   : FPS=72/72,garbled line without a time',
  'FPS=???,Stale=x',
  'IntentionallyNotAStatsLine',
];
const pad = (n) => String(n).padStart(5, ' ');
const line = (t, body, tag = 'VrApi') => (t / 1000).toFixed(3).padStart(15, ' ') + pad(1234) + pad(1290) + ' I ' + tag.padEnd(8, ' ') + ': ' + body + '\n';

async function main() {
  const c = a.join(' ');
  if (a[0] === 'devices') {
    const m = process.env.SHIM_DEVICES || 'one';
    let s = 'List of devices attached\n';
    const q = (sr, st) => sr + '\t' + st + ' usb:1-1 product:eureka model:Quest_3 device:eureka transport_id:3\n';
    if (m === 'one') s += q(SERIAL, 'device');
    if (m === 'two') s += q(SERIAL, 'device') + q('2G0YC1ZF8B9999', 'device');
    if (m === 'unauth') s += SERIAL + '\tunauthorized usb:1-1 transport_id:3\n';
    if (m === 'other') s += 'emulator-5554\tdevice product:sdk_gphone64 model:sdk_gphone64_x86_64 device:emu64x transport_id:1\n';
    return say(s + '\n');
  }
  if (c === 'shell cat /proc/net/unix') {
    return say('Num       RefCount Protocol Flags    Type St Inode Path\n' +
      '0000000000000000: 00000002 00000000 00010000 0001 01 51234 @webview_devtools_remote_4321\n' +
      '0000000000000000: 00000002 00000000 00010000 0001 01 51235 @chrome_devtools_remote\n' +
      '0000000000000000: 00000003 00000000 00000000 0001 03 51236 /dev/socket/logdw\n');
  }
  if (a[0] === 'forward') {
    if (a[1] === '--remove' || a[1] === '--remove-all') return say('');
    if (a[2] === 'localabstract:chrome_devtools_remote') return say(DEVTOOLS + '\n');
    return say('error: cannot bind listener: cannot connect to the socket\n', 1);
  }
  if (a[0] === 'shell' && a[1] === 'am' && a[2] === 'start') {
    const i = a.indexOf('-d');
    const url = String(a[i + 1] || '').replace(/^'|'$/g, '');
    await navigate(url);
    return say('Starting: Intent { act=android.intent.action.VIEW dat=' + url.split('#')[0] + '... pkg=com.oculus.browser }\n');
  }
  if (a[0] === 'shell' && a[1] === 'am' && a[2] === 'broadcast') return say('Broadcasting: Intent { act=' + a[4] + ' flg=0x400000 }\nBroadcast completed: result=0\n');
  if (a[0] === 'shell' && a[1] === 'am' && a[2] === 'startservice') return say('Error: Not found; no service started.\n');
  if (a[0] === 'shell' && a[1] === 'ls') { process.stderr.write('ls: ' + a[a.length - 1] + ': No such file or directory\n'); process.exitCode = 1; return; }
  if (a[0] === 'shell' && a[1] === 'dumpsys' && a[2] === 'battery') return say('Current Battery Service state:\n  AC powered: false\n  USB powered: true\n  level: 87\n');
  if (a[0] === 'exec-out' && a[1] === 'screencap') {
    // a 1x1 PNG
    process.stdout.write(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
    return;
  }
  if (a[0] === 'logcat') {
    // the buffer first (the five seconds before), then one line a second, with odd lines among them
    const sec = +process.env.SHIM_LOG_SEC || 120;
    let n = 0;
    const skew = +process.env.SHIM_SKEW_MS || 0;
    const now = Date.now() + skew;
    for (let k = 5; k >= 1; k--) out(line(now - k * 1000, SHAPES[n % 3](n++)));
    out('--------- beginning of main\n');
    const t0 = Date.now();
    await new Promise((done) => {
      const iv = setInterval(() => {
        const t = Date.now() + skew;
        out(line(t, SHAPES[n % 3](n)));
        if (n % 4 === 0) out(BAD[(n / 4) % BAD.length] + '\n');
        if (n % 5 === 0) out(line(t, 'FPS=abc,Stale=nope'));          // a stats line with no number: unreadable
        if (n % 6 === 0) out(line(t, 'Some other VrApi message: layer 3 submitted'));
        if (n % 7 === 0) out(line(t, 'FPS=72/72', 'OtherTag'));       // another tag: not ours
        n++;
        if (t - skew - t0 > sec * 1000) { clearInterval(iv); done(); }
      }, 1000);
    });
    return;
  }
  if (a[0] === 'shell' && a[1] === 'input') return say('');
  say('shim adb: not understood: ' + c + '\n', 1);
}
main().catch((e) => { process.stderr.write('shim adb: ' + e.message + '\n'); process.exitCode = 1; });
