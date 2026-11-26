// The output page's own test (tools/output/SPEC.md, Tests: PAGE): output.js and its hooks in shared.js, in headless
// Chromium, with Web MIDI stubbed (exactly what Wire 5 names) and the studio's HOST.cur.out stubbed by a fake API with two
// items, so it needs neither the relay's OSC nor the studio's sends.
//   node tools/output/test-page.mjs [--shots <dir>]
// It serves the folder itself (any free port) and starts a plain relay (relay/server.mjs, no OSC flags) for the part that
// needs a room on a relay (the Shared dialog's button, the presence the others see, HOST.collab.osc, live sound: v162, with
// getUserMedia stubbed by the test's own oscillator and a listener of its own on the relay). Needs Playwright
// (PLAYWRIGHT_MODULE: its path when installed elsewhere; CHROMIUM_PATH: a Chromium of its own). Exits 1 on a failure.
// Afterwards, as the spec says: node tools/smoke.mjs http://127.0.0.1:8123/ --only 'developer mode'.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARGS = process.argv.slice(2), SHOTS = ARGS.includes('--shots') ? ARGS[ARGS.indexOf('--shots') + 1] : '';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fails = [], errors = [];
const check = (name, ok, detail) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (!ok && detail !== undefined ? ': ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 600) : '')); if (!ok) fails.push(name); };

// ---- the folder, served as any static host does
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.txt': 'text/plain' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); s.end('not found'); return; }
  s.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(s);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}/`;

// ---- a plain relay (sockets only: the pages come from the folder above)
let relay = null, rport = 0;
try {
  relay = spawn(process.execPath, ['relay/server.mjs', '--port', '0', '--host', '127.0.0.1', '--no-peer', '--no-notes'], { cwd: root });
  let out = '';
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('the relay did not start: ' + out.slice(-400))), 10000);
    relay.stdout.on('data', d => { out += d; const m = /listening on http:\/\/[^:]+:(\d+)/.exec(out); if (m && !rport) { rport = +m[1]; clearTimeout(t); res(); } });
    relay.stderr.on('data', d => { out += d; });
    relay.on('exit', c => { if (!rport) { clearTimeout(t); rej(new Error('the relay stopped (' + c + '): ' + out.slice(-400))); } });
  });
} catch (e) { console.log('note the relay part is skipped: ' + e.message); relay = null; rport = 0; }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// every page: the tests' room defaults (AGENTS.md), Web MIDI stubbed (two outputs, one input; what is sent kept in
// window.__midiSent)
async function open(hash, name, size) {
  const ctx = await browser.newContext({ viewport: size || { width: 1024, height: 640 }, acceptDownloads: true });
  await ctx.addInitScript(n => {
    try { for (const [k, v] of [['collabAutoAll', 'off'], ['collabAutoWelcome', 'off'], ['collabMenus', 'full'], ['collabAskDefault', 'walk'], ['tutorialHold', 'off'], ['collabName', n]]) localStorage.setItem(k, v); } catch (e) { /* storage blocked */ }
    window.__midiSent = [];
    const port = (id, name, type) => ({ id, name, type, state: 'connected', onmidimessage: null, send(b, ts) { window.__midiSent.push({ port: name, b: Array.from(b), ts: ts === undefined ? null : ts, perf: performance.now(), room: typeof HOST !== 'undefined' && HOST.collab ? HOST.collab.now() : 0 }); } });
    const outputs = new Map([['o1', port('o1', 'Virtual A', 'output')], ['o2', port('o2', 'Virtual B', 'output')]]), inputs = new Map([['i1', port('i1', 'Keys', 'input')]]);
    const access = { outputs, inputs, onstatechange: null, sysexEnabled: false };
    window.__midi = { access, asked: [] };
    navigator.requestMIDIAccess = o => { window.__midi.asked.push(o); return o && o.sysex ? Promise.reject(new DOMException('no sysex', 'SecurityError')) : Promise.resolve(access); };
    // live sound (v162): the input is the TEST's own oscillator (test code may make an AudioContext; app code may not:
    // AudioContext is then wrapped to count the ones anybody else makes); two inputs, named once one was given
    const RealAC = window.AudioContext;
    window.__snd = { asked: [], acNew: 0, ac: null };
    if (navigator.mediaDevices && RealAC) {
      navigator.mediaDevices.getUserMedia = async c => {
        window.__snd.asked.push(JSON.parse(JSON.stringify(c || {})));
        const ac = window.__snd.ac || (window.__snd.ac = new RealAC({ sampleRate: 48000 }));
        const o = ac.createOscillator(), g = ac.createGain(), d = ac.createMediaStreamDestination();
        o.frequency.value = 440; g.gain.value = 0.5; d.channelCount = 2;
        o.connect(g); g.connect(d); o.start();
        await ac.resume();
        window.__snd.streams = (window.__snd.streams || []).concat([d.stream]);
        return d.stream;
      };
      navigator.mediaDevices.enumerateDevices = async () => {
        const n = window.__snd.asked.length > 0;
        return [{ kind: 'audioinput', deviceId: 'bh2', groupId: 'g1', label: n ? 'BlackHole 2ch' : '' }, { kind: 'audioinput', deviceId: 'mic1', groupId: 'g2', label: n ? 'Built-in Microphone' : '' },
          { kind: 'audiooutput', deviceId: 'spk1', groupId: 'g2', label: n ? 'Speakers' : '' }];
      };
      window.AudioContext = class extends RealAC { constructor(...a) { super(...a); window.__snd.acNew++; } };
    }
  }, name);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(name + ': ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource|ERR_CONNECTION_REFUSED|WebSocket/.test(m.text())) errors.push(name + ': ' + m.text()); });
  await page.goto(base + 'index.html' + hash, { timeout: 90000 });
  await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 90000, polling: 100 });
  return page;
}
const until = (page, fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms || 5000, polling: 30 }).then(() => true, () => false);
const shot = async (page, n) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, n + '.png') }); console.log('     shot ' + path.join(SHOTS, n + '.png')); };

// the fake studio API (Wire 2's shape): a cube and a lamp; what act() was asked kept in __fake.acts
const FAKE = () => {
  const L = [], acts = [], items = [
    { id: 'cube01', k: 'c', name: 'Door', send: [{ on: 'enter', note: 36, hold: true }, { on: 'leave' }], press: '', all: false, key: '' },
    { id: 'lamp01', k: 'o', name: 'Lamp', send: [], press: 'all', all: false, key: '' }];
  const poses = { cube01: { p: [1, 0.5, 0], q: [0, 0, 0, 1], shown: true }, lamp01: { p: [-1, 1, 2], q: [0, 0, 0, 1], shown: true } };
  // (a pose moves by move[id]: { v: m/s, spin: degrees a second about y, t0 }, on the frame's own time, as the studio draws)
  const pose = id => {
    const P = poses[id];
    if (!P) return null;
    const R = JSON.parse(JSON.stringify(P)), M = window.__fake.move[id];
    if (M) {
      const t = (document.timeline.currentTime - M.t0) / 1000;
      for (let i = 0; i < 3; i++) R.p[i] += M.v[i] * t;
      if (M.spin) { const a = M.spin * t * Math.PI / 360; R.q = [0, Math.sin(a), 0, Math.cos(a)]; }
    }
    return R;
  };
  const out = { v: 1, ready: () => true, scene: () => 'Fake', list: () => items, pose, rev: () => window.__fake.rev,
    value: (id, v) => { const V = window.__fake.vals[id]; return V && V[v] !== undefined ? V[v] : null; },
    listen(fn) { L.push(fn); return () => { const i = L.indexOf(fn); if (i >= 0) L.splice(i, 1); }; },
    act(a) {
      acts.push(JSON.parse(JSON.stringify(a)));
      if (a.do === 'beat') window.__fake.bt = a.bpm ? { bpm: a.bpm, at: a.at, bar: a.bar || 4, by: HOST.collab.id } : null;
      return a.id === 'nothing' ? { ok: false, why: 'no such item' } : { ok: true };
    },
    beat: () => (window.__fake.bt ? Object.assign({}, window.__fake.bt) : null), sends: () => ({ out: 0, dropped: 0 }) };
  window.__fake = { out, L, acts, poses, items, move: {}, vals: {}, rev: 0, bt: null, emit: ev => L.slice().forEach(f => f(ev)) };
  HOST.cur.out = out;
};
const sent = page => page.evaluate(() => window.__midiSent.map(x => x.b.join(',')));
const hasBytes = (list, b) => list.includes(b.join(','));

try {
  // ======================== a room on this device, the link's &output ========================
  const A = await open('#s=OUA&peer=off&output', 'Tess');
  check('the link starts the output page in a room on this device', await until(A, () => HOST.out && HOST.out.on() && HOST.collab.outOn() && !!document.getElementById('out') && document.body.classList.contains('outp'), null, 15000),
    await A.evaluate(() => ({ code: HOST.collab.code, via: HOST.collab.via, out: !!HOST.out, on: HOST.collab.outOn(), log: (window.__collabLog || []).slice(-8).map(e => JSON.stringify(e).slice(0, 160)) })));
  check('output.js was loaded on demand', await A.evaluate(() => [...document.scripts].some(s => /output\.js$/.test(s.src))));
  check('no OSC off a relay: HOST.collab.osc is false', await A.evaluate(() => HOST.collab.osc([['/x', '']]) === false && HOST.collab.via === 'local'));
  check('the overlay says why there is no OSC', await A.evaluate(() => /No OSC here/.test(document.querySelector('#out [data-sec="osc"]').textContent)));
  check('live sound off a relay: the switch greyed, saying rooms on a relay only', await A.evaluate(() => { const b = document.querySelector('#out [data-sec="live"]'), x = b && b.querySelector('[data-o="snd"]'); return !!x && x.disabled && /needs a room on a relay/.test(b.textContent) && HOST.collab.sndCan() === false; }),
    await A.evaluate(() => (document.querySelector('#out [data-sec="live"]') || {}).textContent));
  // a story for the fake studio API to hang on (the flock: small), then the API
  await A.evaluate(() => HOST.start('flock'));
  await until(A, () => HOST.curKey === 'flock' && !!HOST.cur && !HOST.busy, null, 40000);
  await A.evaluate(FAKE);
  check('the output page listens to the studio API', await until(A, () => window.__fake.L.length === 1 && HOST.out.state().studio, null, 3000));

  // ---- MIDI: ports picked by name, a note entry's note on and its held note off at the pair
  const bad = await A.evaluate(() => HOST.out.map({ out: 1, opt: { midi: true, midiOut: 'Virtual B', osc: true } }));
  check('a mapping set: no problems', Array.isArray(bad) && !bad.length, bad);
  check('MIDI on: the ports picked (output by name, input the first)', await until(A, () => { const M = HOST.out.state().midi; return M.ok && M.out === 'Virtual B' && M.in === 'Keys'; }, null, 3000), await A.evaluate(() => HOST.out.state().midi));
  check('MIDI asked without sysex', await A.evaluate(() => window.__midi.asked.length >= 1 && window.__midi.asked.every(o => o && o.sysex === false)));
  const me = await A.evaluate(() => HOST.collab.id);
  // a pretend person in a headset (a member and their presence), for "who" and the slots
  const pres = y => A.evaluate(y => {
    const C = HOST.collab.internals();
    if (!C.members.some(m => m.id === 'h1abcd')) C.members.push({ id: 'h1abcd', name: 'Ann', color: '#ff5ad9', kind: 'ar', here: true, version: HOST.collab.format });
    HOST.collab.presIn('h1abcd', { st: '', head: [0.5, y, -1, 0, 0, 0, 1], hands: [], g: [[0.3, 1, -0.8, 0, 0, 0, 1], null], ts: Math.round(HOST.collab.now()) });
  }, y);
  await pres(1.7);
  await A.evaluate(() => HOST.out.step());
  check('a person in a headset gets slot 1', await A.evaluate(() => HOST.out.slots().h1abcd === 1 && HOST.out.state().people[0].name === 'Ann'), await A.evaluate(() => HOST.out.state().people));
  await A.evaluate(() => { window.__midiSent.length = 0; window.__fake.emit({ ev: 'enter', id: 'cube01', k: 'c', name: 'Door', who: 'h1abcd', at: HOST.collab.now(), send: [{ on: 'enter', note: 36, hold: true }] }); });
  let s = await sent(A);
  check('a cube walked into: note on 36 (channel 1, velocity 100) on the picked port', hasBytes(s, [0x90, 36, 100]) && (await A.evaluate(() => window.__midiSent[0].port)) === 'Virtual B', s);
  await sleep(250);
  check('a held note stays on until its pair', !hasBytes(await sent(A), [0x80, 36, 0]));
  const lg = await A.evaluate(() => HOST.out.log().filter(e => e.via === 'osc' && e.dir === 'out').map(e => e.m));
  const om = lg.find(m => m[0] === '/studio/cube/cube01/enter');
  check('the same event as OSC on its default address, saying who (name, colour, id), the cube and 1', !!om && om[1] === 'ssssi' && om[2] === 'Ann' && om[3] === '#ff5ad9' && om[4] === 'h1abcd' && om[5] === 'Door' && om[6] === 1, lg);
  await A.evaluate(() => window.__fake.emit({ ev: 'leave', id: 'cube01', k: 'c', name: 'Door', who: 'h1abcd', at: HOST.collab.now(), send: [{ on: 'leave' }] }));
  check('walking out: its note off', hasBytes(await sent(A), [0x80, 36, 0]), await sent(A));
  // a note without hold: on, then off after the note length; channel by person (ch 0: the person's slot); a CC
  await A.evaluate(() => { window.__midiSent.length = 0; window.__fake.emit({ ev: 'press', id: 'lamp01', k: 'o', name: 'Lamp', who: 'h1abcd', at: HOST.collab.now(), send: [{ on: 'press', note: 40, ch: 0, val: 90 }, { on: 'press', cc: 20, ch: 3, osc: '/lamp/go' }] }); });
  s = await sent(A);
  check('a press: note 40 on channel by person (slot 1) at 90, and CC 20 on channel 3 at 127', hasBytes(s, [0x90, 40, 90]) && hasBytes(s, [0xB2, 20, 127]), s);
  check('and its own OSC address', await A.evaluate(() => HOST.out.log().some(e => e.via === 'osc' && e.m && e.m[0] === '/lamp/go' && e.m[2] === 'Ann')));
  await sleep(300);
  check('its note off after the note length', hasBytes(await sent(A), [0x80, 40, 0]), await sent(A));
  // what this page caused: not sent unless asked; an event without entries: only with Every press and sequence
  await A.evaluate(me => { window.__midiSent.length = 0; window.__fake.emit({ ev: 'press', id: 'lamp01', k: 'o', name: 'Lamp', who: me, at: HOST.collab.now(), send: [{ on: 'press', note: 41 }] }); }, me);
  check('an event this page caused is not sent (Also what this page caused: off)', !(await sent(A)).length);
  const n0 = await A.evaluate(() => HOST.out.log().filter(e => e.via === 'osc' && e.dir === 'out').length);
  await A.evaluate(() => window.__fake.emit({ ev: 'press', id: 'lamp01', k: 'o', name: 'Lamp', who: 'h1abcd', at: HOST.collab.now(), send: [] }));
  const n1 = await A.evaluate(() => HOST.out.log().filter(e => e.via === 'osc' && e.dir === 'out').length);
  await A.evaluate(() => { const m = HOST.out.map(); m.opt.all = true; HOST.out.map(m); window.__fake.emit({ ev: 'press', id: 'lamp01', k: 'o', name: 'Lamp', who: 'h1abcd', at: HOST.collab.now(), send: [] }); });
  const n2 = await A.evaluate(() => HOST.out.log().filter(e => e.via === 'osc' && e.dir === 'out' && e.m && e.m[0] === '/studio/item/lamp01/press').length);
  check('a press without entries goes out only with Every press and sequence', n1 === n0 && n2 >= 1, { n0, n1, n2 });

  // ---- a stream: the person's head height to CC 7 (only when the 0..127 value changes)
  await A.evaluate(() => { const m = HOST.out.map(); m.streams = [{ id: 'str001', on: true, name: 'height', src: { k: 'head', who: 'any' }, v: 'y', min: 0, max: 2, curve: 'lin', smooth: 0, hz: 30, midi: { ch: 1, cc: 7 }, osc: '/height' }]; HOST.out.map(m); window.__midiSent.length = 0; });
  const feed = async (y, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { await pres(y); await sleep(100); } };
  await feed(1.7, 900);
  s = await sent(A);
  check('a stream: head height 1.7 m of 0 to 2 m gives CC 7 = 108', hasBytes(s, [0xB0, 7, 108]), s);
  check('sent only when its value changes', s.filter(x => x === [0xB0, 7, 108].join(',')).length === 1, s);
  await feed(1.0, 1400);
  check('and follows it down (1.0 m: 64)', hasBytes(await sent(A), [0xB0, 7, 64]), await sent(A));
  check('the stream as OSC too (off a relay: counted as not sent)', await A.evaluate(() => HOST.out.state().osc.dropped > 0));
  await shot(A, 'output-page-local');

  // ---- incoming: a note, a CC with hold, OSC mapped and the built-in addresses; MIDI clock to the beat
  await A.evaluate(() => {
    const m = HOST.out.map();
    m.incoming = [
      { id: 'in0001', on: true, name: 'pad', from: { midi: 'note', ch: 0, n: 60 }, act: { do: 'press', id: 'Lamp' } },
      { id: 'in0002', on: true, name: 'fader', from: { midi: 'cc', ch: 1, n: 1, min: 64 }, act: { do: 'show', id: 'cube01', hold: true } },
      { id: 'in0003', on: true, name: 'osc go', from: { osc: '/go', arg: 0, min: 0.5 }, act: { do: 'toggle', id: 'seq001' } }];
    m.opt.clock = true;
    HOST.out.map(m);
    window.__fake.acts.length = 0;
    HOST.out.midiIn([0x90, 60, 100]); HOST.out.midiIn([0x80, 60, 0]); HOST.out.midiIn([0x91, 61, 100]);
    HOST.out.midiIn([0xB0, 1, 100]); HOST.out.midiIn([0xB0, 1, 110]); HOST.out.midiIn([0xB0, 1, 10]);
    HOST.out.oscIn(['/go', 'f', 1]); HOST.out.oscIn(['/go', 'f', 0]);
    HOST.out.oscIn(['/studio/press', 's', 'Door']); HOST.out.oscIn(['/studio/hide', 's', 'lamp01']); HOST.out.oscIn(['/studio/beat', 'f', 128]); HOST.out.oscIn(['/nobody/listens', 'i', 3]);
  });
  const acts = await A.evaluate(() => window.__fake.acts.slice());
  const want = [{ do: 'press', id: 'lamp01' }, { do: 'show', id: 'cube01' }, { do: 'hide', id: 'cube01' }, { do: 'toggle', id: 'seq001' }, { do: 'press', id: 'cube01' }, { do: 'hide', id: 'lamp01' }];
  check('incoming MIDI and OSC call act() as mapped (by id or name; a CC crossing up, and down with hold)', JSON.stringify(acts.filter(a => a.do !== 'beat')) === JSON.stringify(want), acts);
  check('/studio/beat: a beat at 128 bpm', acts.some(a => a.do === 'beat' && a.bpm === 128 && Number.isFinite(a.at)), acts);
  check('an address nobody takes: in the log, ignored', await A.evaluate(() => HOST.out.log().some(e => e.dir === 'in' && /\/nobody\/listens.*ignored/.test(e.text))));
  await A.evaluate(() => { window.__fake.acts.length = 0; const t0 = HOST.collab.now(); HOST.out.midiIn([0xFA], t0); for (let i = 0; i < 48; i++) HOST.out.midiIn([0xF8], t0 + i * 60000 / (120 * 24) + (i % 2 ? 0.3 : -0.3)); });
  const beats = await A.evaluate(() => window.__fake.acts.filter(a => a.do === 'beat'));
  check('48 ticks of MIDI clock at 120 bpm: act({ do: beat, bpm: ~120 })', beats.length >= 1 && Math.abs(beats[0].bpm - 120) < 0.5, beats);
  await A.evaluate(() => { window.__fake.acts.length = 0; HOST.out.midiIn([0xFC]); });
  check('MIDI stop: the beat removed (bpm 0)', (await A.evaluate(() => window.__fake.acts)).some(a => a.do === 'beat' && a.bpm === 0));
  // Learn: the next message fills a row's from
  await A.evaluate(() => { HOST.out.learn('in0001'); HOST.out.midiIn([0xB5, 22, 90]); });
  check('Learn: the next MIDI message fills the row', await A.evaluate(() => { const r = HOST.out.state().incoming.find(x => x.id === 'in0001'); return r.from.midi === 'cc' && r.from.n === 22 && r.from.ch === 6 && !HOST.out.state().learn; }));

  // ---- v158: clock in with Start, song position and Beats a bar; OSC /studio/bar; the Tempo part; clock out; the scene's streams
  const TK = 60000 / (120 * 24);
  const clk = await A.evaluate(TK => {
    const m = HOST.out.map(); m.opt.bar = 3; m.opt.clock = true; HOST.out.map(m);
    window.__fake.acts.length = 0;
    const t0 = Math.round(HOST.collab.now()) + 3000;
    HOST.out.midiIn([0xFA], t0);
    for (let i = 0; i < 48; i++) HOST.out.midiIn([0xF8], t0 + i * TK);
    const a1 = window.__fake.acts.filter(a => a.do === 'beat');
    window.__fake.acts.length = 0;
    HOST.out.midiIn([0xFC]);
    const stop = window.__fake.acts.filter(a => a.do === 'beat');
    window.__fake.acts.length = 0;
    const t1 = t0 + 5000;
    HOST.out.midiIn([0xF2, 4, 0]); HOST.out.midiIn([0xFB]);   // (one beat in: a sixteenth is 6 ticks)
    for (let i = 0; i < 30; i++) HOST.out.midiIn([0xF8], t1 + i * TK);
    const a2 = window.__fake.acts.filter(a => a.do === 'beat');
    window.__fake.acts.length = 0;
    HOST.out.midiIn([0xFC]);
    for (let i = 0; i < 48; i++) HOST.out.midiIn([0xF8], t1 + 3000 + i * TK);   // (ticks after Stop: nothing written)
    const a3 = window.__fake.acts.filter(a => a.do === 'beat' && a.bpm);
    return { t0, t1, a1, stop, a2, a3 };
  }, TK);
  check('clock in: Start is a downbeat (at = the tick after Start, bar 3, ~120 bpm)', clk.a1.length >= 1 && clk.a1[0].at === clk.t0 && clk.a1[0].bar === 3 && Math.abs(clk.a1[0].bpm - 120) < 0.5, clk);
  check('clock in: Stop takes the beat away', clk.stop.some(a => a.bpm === 0), clk.stop);
  check('clock in: a song position (a beat in) and Continue: at names the downbeat a beat earlier', clk.a2.length >= 1 && Math.abs(clk.a2[0].at - (clk.t1 - 24 * TK)) <= 1 && clk.a2[0].bar === 3, clk.a2);
  check('clock in: ticks after Stop write nothing', clk.a3.length === 0, clk.a3);
  const ob = await A.evaluate(() => { window.__fake.acts.length = 0; window.__fake.bt = null; HOST.out.oscIn(['/studio/bar', 'fi', 100, 5]); const a = window.__fake.acts.slice(); HOST.out.oscIn(['/studio/beat', 'f', 100]); return { a, b: window.__fake.acts.slice(1), now: HOST.collab.now() }; });
  check('OSC /studio/bar: a downbeat now, with its bar', ob.a.length === 1 && ob.a[0].bpm === 100 && ob.a[0].bar === 5 && Math.abs(ob.a[0].at - ob.now) < 200, ob);
  check('OSC /studio/beat: a beat, its bar\'s downbeat kept (at a whole beat before now)', ob.b.length === 1 && ob.b[0].bpm === 100 && ((ob.b[0].at - ob.a[0].at) / 600) % 1 < 0.05, ob);
  // the Tempo part: disabled while clock in leads, Tap, Start (a downbeat at the next 10 ms), Stop
  await A.evaluate(TK => { const t = HOST.collab.now(); for (let i = 0; i < 30; i++) HOST.out.midiIn([0xF8], t + i * TK); HOST.out.changed(); HOST.out.step(); }, TK);
  check('Tempo is disabled while MIDI clock in leads, saying so', await until(A, () => { const b = document.querySelector('#out [data-o="tstart"]'); return !!b && b.disabled && /MIDI clock in leads/.test(document.querySelector('#out [data-sec="tempo"]').textContent); }, null, 3000));
  await A.evaluate(() => { const m = HOST.out.map(); m.opt.clock = false; HOST.out.map(m); });
  check('and enabled with clock in off', await until(A, () => { const b = document.querySelector('#out [data-o="tstart"]'); return !!b && !b.disabled; }, null, 3000));
  const tap = await A.evaluate(() => [HOST.out.tap(1000), HOST.out.tap(1500), HOST.out.tap(2001), HOST.out.tap(2500), HOST.out.tap(3000)]);
  check('Tap: 4 taps or more, the median interval (500 ms: 120 bpm)', tap[0] === 0 && tap[2] === 0 && Math.abs(tap[3] - 120) < 0.5 && Math.abs(tap[4] - 120) < 0.5 && Math.abs((await A.evaluate(() => HOST.out.state().clock.tempo)) - 120) < 0.5, tap);
  await A.evaluate(() => { window.__fake.acts.length = 0; document.querySelector('#out [data-o="tstart"]').click(); });
  const ts1 = await A.evaluate(() => window.__fake.acts.slice());
  check('Tempo Start: the beat with its downbeat at the next 10 ms', ts1.length === 1 && ts1[0].do === 'beat' && Math.abs(ts1[0].bpm - 120) < 0.5 && ts1[0].bar === 3 && ts1[0].at % 10 === 0, ts1);
  await A.evaluate(() => { window.__fake.acts.length = 0; document.querySelector('#out [data-o="tstop"]').click(); });
  check('Tempo Stop: the beat taken away', (await A.evaluate(() => window.__fake.acts)).some(a => a.do === 'beat' && a.bpm === 0));
  // clock out: 24 a beat with their timestamps, Start at a downbeat, again when the downbeat moves, on at a new tempo, Stop
  await A.evaluate(() => { const m = HOST.out.map(); m.opt.clockOut = true; m.opt.bar = 4; HOST.out.map(m); window.__midiSent.length = 0; window.__fake.bt = { bpm: 120, at: Math.round(HOST.collab.now()) - 3700, bar: 4, by: 'xx' }; });
  await sleep(1600);
  const co = await A.evaluate(() => ({ bt: window.__fake.bt, s: window.__midiSent.filter(x => x.port === 'Virtual B' && x.b[0] >= 0xF2).map(x => ({ b: x.b, r: x.ts - x.perf + x.room })) }));
  const coCheck = (S, bt, from) => {
    const tk = 60000 / bt.bpm / 24, bar = 60000 / bt.bpm * bt.bar, st = S.filter(x => x.b[0] === 0xFA && x.r >= from), F = S.filter(x => x.b[0] === 0xF8 && x.r >= (st[0] ? st[0].r - 0.5 : Infinity));
    const ph = st[0] ? ((st[0].r - bt.at) % bar + bar) % bar : NaN, gaps = F.slice(1).map((x, i) => x.r - F[i].r);
    return { start: st.length, ph: Math.min(ph, bar - ph), ticks: F.length, gap: gaps.length ? [Math.min(...gaps), Math.max(...gaps)] : null, beat: F.filter(x => x.r < F[0].r + 60000 / bt.bpm - 1).length, tk };
  };
  let cc = coCheck(co.s, co.bt, -Infinity);
  check('clock out: Song Position then Start at a downbeat (within 2 ms)', co.s.some(x => x.b[0] === 0xF2) && cc.start === 1 && cc.ph <= 2, { cc, first: co.s.slice(0, 4) });
  check('clock out: 24 ticks a beat, each within 2 ms of its place', cc.ticks >= 30 && cc.beat === 24 && cc.gap && Math.abs(cc.gap[0] - cc.tk) <= 2 && Math.abs(cc.gap[1] - cc.tk) <= 2, cc);
  check('clock out: one log line a second, not one a tick', await A.evaluate(() => HOST.out.log().filter(e => /^clock out \d/.test(e.text)).length <= 3 && !HOST.out.log().some(e => e.m && e.m[0] === 0xF8)));
  await A.evaluate(() => { window.__midiSent.length = 0; window.__fake.bt = Object.assign({}, window.__fake.bt, { at: window.__fake.bt.at + 300 }); });
  await sleep(2600);
  const co2 = await A.evaluate(() => ({ bt: window.__fake.bt, s: window.__midiSent.filter(x => x.port === 'Virtual B' && x.b[0] >= 0xF2).map(x => ({ b: x.b, r: x.ts - x.perf + x.room })) }));
  cc = coCheck(co2.s, co2.bt, -Infinity);
  check('clock out: another writer moves the downbeat: Stop, Song Position, Start at the new downbeat', co2.s.some(x => x.b[0] === 0xFC) && co2.s.some(x => x.b[0] === 0xF2) && cc.start === 1 && cc.ph <= 2, { cc, first: co2.s.slice(0, 6).map(x => x.b) });
  // a tempo change from the latest downbeat (as clock in and Tempo write it): no Start, on at the new rate
  await A.evaluate(() => { const b = window.__fake.bt, B = 60000 / b.bpm * b.bar, now = HOST.collab.now(); window.__midiSent.length = 0; window.__fake.bt = { bpm: 125, at: Math.round(b.at + Math.floor((now - b.at) / B) * B), bar: 4, by: 'xx' }; });
  await sleep(900);
  const co3 = await A.evaluate(() => window.__midiSent.filter(x => x.port === 'Virtual B' && x.b[0] >= 0xF2).map(x => ({ b: x.b, r: x.ts - x.perf + x.room })));
  const g3 = co3.filter(x => x.b[0] === 0xF8).slice(8).map((x, i, a) => (i ? x.r - a[i - 1].r : null)).filter(x => x !== null);
  check('clock out: a tempo change goes on at the new rate (no Start, ticks 20 ms apart)', !co3.some(x => x.b[0] === 0xFA || x.b[0] === 0xFC) && g3.length > 10 && g3.every(x => Math.abs(x - 20) <= 2), { first: co3.slice(0, 4), g3: g3.slice(0, 6) });
  await A.evaluate(() => { window.__midiSent.length = 0; window.__fake.bt = null; });
  await sleep(200);
  check('clock out: the beat gone, Stop', await A.evaluate(() => window.__midiSent.some(x => x.b[0] === 0xFC) && !HOST.out.state().clock.out.run));
  await A.evaluate(() => { const m = HOST.out.map(); m.opt.clockOut = false; HOST.out.map(m); });
  // the scene's streams: read from list(), checked again, measured from pose() every frame and from value()
  await A.evaluate(() => {
    const F = window.__fake, t0 = document.timeline.currentTime;
    F.vals = { lamp01: { shown: 0 }, cube01: { count: 2 } };
    F.move = { lamp01: { v: [0.5, 0, 0], spin: 90, t0 } };
    F.items[1].stream = [{ v: 'vx', cc: 21 }, { v: 'speed' }, { v: 'spin', cc: 22, ch: 2 }, { v: 'shown', note: 36, vel: 'speed' }, { v: 'count', cc: 23 }, { v: 'x', cc: 40, wide: true }, { v: 'x', cc: 3, note: 4 }];
    F.items[0].stream = [{ v: 'y', min: 0, max: 1, cc: 1, wide: true }, { v: 'count', cc: 5 }, { v: 'y', min: 0, max: 1, cc: 1, wide: true }];
    F.rev++; window.__midiSent.length = 0;
  });
  await sleep(1000);
  const sc = await A.evaluate(() => HOST.out.state());
  const scOf = v => sc.scene.find(x => x.v === v) || {};
  check('scene streams read from list(): bad ones dropped and counted, a duplicate dropped', sc.scene.length === 6 && sc.sceneBad === 3, { n: sc.scene.length, bad: sc.sceneBad });
  check('scene stream: a moving item\'s velocity within 5 % (vx 0.5 m/s)', Math.abs(scOf('vx').x - 0.5) <= 0.025, scOf('vx'));
  check('scene stream: its speed within 5 %, its turning speed within 5 % (90 degrees a second)', Math.abs(scOf('speed').x - 0.5) <= 0.025 && Math.abs(scOf('spin').x - 90) <= 4.5, [scOf('speed'), scOf('spin')]);
  s = await sent(A);
  check('scene stream: 14-bit CC (y 0.5 of 0 to 1: CC 1 = 64, CC 33 = 0)', hasBytes(s, [0xB0, 1, 64]) && hasBytes(s, [0xB0, 33, 0]), s.filter(x => x.startsWith('176,1,') || x.startsWith('176,33')));
  check('scene stream: a state value from value() (2 people of 0 to 4: CC 5 = 64)', hasBytes(s, [0xB0, 5, 64]), s.filter(x => x.startsWith('176,5,')));
  await A.evaluate(() => { window.__midiSent.length = 0; window.__fake.vals.lamp01.shown = 1; });
  await sleep(300);
  check('scene stream: a threshold note on, its velocity from the speed (0.5 m/s: 22)', hasBytes(await sent(A), [0x90, 36, 22]), await sent(A));
  await A.evaluate(() => { window.__fake.vals.lamp01.shown = 0; });
  await sleep(300);
  check('and off as it falls below', hasBytes(await sent(A), [0x80, 36, 0]), await sent(A));
  await A.evaluate(() => { window.__midiSent.length = 0; window.__fake.emit({ ev: 'stream', id: 'lamp01', k: 'o', name: 'Lamp', who: 'h1abcd', at: HOST.collab.now(), v: 'vx', try: 1, send: [] }); });
  await sleep(1300);
  s = await sent(A);
  check('a card\'s Try: a sweep 0 to 1 to 0 on that stream (CC 21 reaches 127 and 0)', hasBytes(s, [0xB0, 21, 127]) && hasBytes(s, [0xB0, 21, 0]), s.filter(x => x.startsWith('176,21,')));
  check('the scene\'s streams shown on the page with their live values', await until(A, () => /Streams from the scene/.test(document.querySelector('#out [data-sec="streams"]').textContent) && [...document.querySelectorAll('#out [data-live^="sc"]')].some(x => /→/.test(x.textContent)), null, 3000));
  // the page's own table: the new values, a 14-bit CC and a threshold note (validated; older rows read as before)
  const own = await A.evaluate(() => {
    const m = HOST.out.map();
    m.streams = [{ id: 'str101', on: true, name: 'lamp vx', src: { k: 'item', id: 'lamp01' }, v: 'vx', min: -1, max: 1, hz: 30, midi: { ch: 2, cc: 9, wide: true }, osc: '' },
      { id: 'str102', on: true, name: 'lamp roll', src: { k: 'item', id: 'lamp01' }, v: 'roll', min: -180, max: 180, midi: { ch: 2, note: 50, at: 0.6, vel: 'speed' }, osc: '/r' },
      { id: 'str103', src: { k: 'item', id: 'lamp01' }, v: 'x', midi: { ch: 1, cc: 40, wide: true } }, { id: 'str104', src: { k: 'item', id: 'lamp01' }, v: 'x', midi: { ch: 1, cc: 3, note: 4 } },
      { id: 'str105', src: { k: 'item', id: 'lamp01' }, v: 'acc', midi: { ch: 1, note: 3, at: 1.5 } }];
    window.__midiSent.length = 0;
    return HOST.out.map(m);
  });
  check('own streams: vx and roll and a note taken, a bad 14-bit, a CC with a note and a threshold of 1.5 dropped', own.length === 3 && await A.evaluate(() => HOST.out.state().streams.map(r => r.id).join() === 'str101,str102'), own);
  await sleep(800);
  const lv = await A.evaluate(() => HOST.out.state().live.str101);
  s = await sent(A);
  check('own stream: an item\'s vx (within 20 %) as a 14-bit CC pair on channel 2', lv && Math.abs(lv.x - 0.5) < 0.1 && s.some(x => x.startsWith('177,9,')) && s.some(x => x.startsWith('177,41,')), { lv, s: s.slice(0, 6) });
  await A.evaluate(() => { window.__fake.move = {}; const m = HOST.out.map(); m.streams = []; HOST.out.map(m); window.__fake.items.forEach(x => { delete x.stream; }); window.__fake.rev++; });

  // ---- the mapping: validation, Export and Import round trip
  const probs = await A.evaluate(() => HOST.out.map({ out: 1, opt: { midi: true, midiOut: 'Virtual B', osc: true, noteLen: 80 }, streams: [{ id: 'bad', src: { k: 'head' } }, { id: 'str002', src: { k: 'dist', a: { k: 'head', who: 1 }, b: { k: 'item', id: 'lamp01' }, flat: true }, v: 'd', min: 0, max: 4, hz: 20, midi: { ch: 2, cc: 9 }, osc: '' }],
    incoming: [{ id: 'in0009', from: { midi: 'note', n: 200 }, act: { do: 'press', id: 'x' } }, { id: 'in0010', from: { osc: '/a b' }, act: { do: 'press', id: 'x' } }, { id: 'in0011', from: { midi: 'start' }, act: { do: 'start', id: 'seq001', hold: true } }] }));
  check('a bad row is dropped and said', probs.length === 3 && await A.evaluate(() => { const S = HOST.out.state(); return S.streams.length === 1 && S.incoming.length === 1 && S.opt.noteLen === 80; }), probs);
  const before = await A.evaluate(() => JSON.stringify(HOST.out.map()));
  await A.evaluate(() => document.querySelector('#out [data-o="export"]').scrollIntoView());
  const [dl] = await Promise.all([A.waitForEvent('download', { timeout: 5000 }), A.click('#out [data-o="export"]')]);
  const file = await dl.path().then(p => fs.readFileSync(p, 'utf8'));
  check('Export downloads output-mapping.json', dl.suggestedFilename() === 'output-mapping.json' && JSON.parse(file).out === 1);
  await A.evaluate(() => HOST.out.map({ out: 1 }));
  await A.fill('#out [data-oc="importText"]', file);
  await A.click('#out [data-o="import"]');
  check('Import puts it back as it was', await A.evaluate(b => JSON.stringify(HOST.out.map()) === b, before), await A.evaluate(() => HOST.out.map()));
  check('kept in localStorage outMap', await A.evaluate(b => localStorage.getItem('outMap') === JSON.stringify(JSON.parse(b)), before));
  // the edit form: a stream added by hand
  await A.click('#out [data-o="sadd"]');
  await A.fill('#out form[data-form="stream"] [data-f="name"]', 'by hand');
  await A.fill('#out form[data-form="stream"] [data-f="osc"]', '/by/hand');
  await A.click('#out form[data-form="stream"] [data-o="save:stream"]');
  check('a stream added on the page (the form)', await A.evaluate(() => HOST.out.state().streams.some(r => r.name === 'by hand' && r.osc === '/by/hand' && r.src.k === 'head')));
  await A.click('#out [data-o="iadd"]');
  await A.selectOption('#out form[data-form="in"] [data-f="fk"]', 'osc');
  await A.fill('#out form[data-form="in"] [data-f="osc"]', '/hit');
  await A.fill('#out form[data-form="in"] [data-f="id"]', 'Door');
  await A.click('#out form[data-form="in"] [data-o="save:in"]');
  check('an incoming row added on the page (the form, its kind changed to OSC)', await A.evaluate(() => HOST.out.state().incoming.some(r => r.from.osc === '/hit' && r.act.id === 'Door')), await A.evaluate(() => HOST.out.state().incoming));
  await shot(A, 'output-page-forms');
  // Stop: held notes off, the overlay gone, the shell told
  await A.evaluate(() => window.__fake.emit({ ev: 'enter', id: 'cube01', k: 'c', name: 'Door', who: 'h1abcd', at: HOST.collab.now(), send: [{ on: 'enter', note: 50, hold: true }] }));
  await A.evaluate(() => { window.__midiSent.length = 0; HOST.out.stop(); });
  check('Stop: every held note off, the overlay gone, the shell told', hasBytes(await sent(A), [0x80, 50, 0]) && await A.evaluate(() => !HOST.out.on() && !HOST.collab.outOn() && !document.getElementById('out') && !document.body.classList.contains('outp') && window.__fake.L.length === 0));
  await A.context().close();

  // ======================== a room on a relay: the Shared dialog's button ========================
  if (rport) {
    const R = `&relay=ws://127.0.0.1:${rport}`;
    const B = await open('#' + R.slice(1), 'Bea', { width: 1024, height: 640 });
    await until(B, () => !!HOST.collab.relay, null, 10000);
    await B.evaluate(() => HOST.collab.create());
    await until(B, () => HOST.collab.status === 'open' && !!HOST.collab.code, null, 15000);
    const code = await B.evaluate(() => HOST.collab.code);
    const P = await open('#s=' + code + R, 'Pat', { width: 1024, height: 640 });
    await until(P, () => HOST.collab.status === 'open', null, 15000);
    await P.evaluate(() => HOST.collab.dialog(true));
    check('the Shared dialog offers the output page on a computer in a room on a relay', await until(P, () => !!document.querySelector('[data-sh="output"]'), null, 5000),
      await P.evaluate(() => ({ via: HOST.collab.via, status: HOST.collab.status, code: HOST.collab.code, offered: HOST.collab.outOffered(), log: (window.__collabLog || []).slice(-6).map(e => JSON.stringify(e).slice(0, 200)) })));
    await P.click('[data-sh="output"]');
    check('its button starts it', await until(P, () => HOST.out && HOST.out.on() && HOST.collab.outOn(), null, 10000));
    check('HOST.collab.osc goes to the relay while it runs', await P.evaluate(() => HOST.collab.osc([['/test/hello', 'i', 1]]) === true));
    // ---- live sound (v162): a listener of the test's own on the relay (subscribed), the output page streaming the
    // stubbed input as Opus; what the relay forwards counted there
    {
      const L = { q: [], bins: [] }, ws = new WebSocket(`ws://127.0.0.1:${rport}/api/ws?room=${code}&id=listen1`);
      ws.binaryType = 'arraybuffer';
      ws.onmessage = e => { if (typeof e.data === 'string') L.q.push(JSON.parse(e.data)); else L.bins.push(Buffer.from(e.data)); };
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
      ws.send(JSON.stringify({ t: 'hello', name: 'Listener', kind: 'desktop' }));
      ws.send(JSON.stringify({ t: 'snd-sub', on: true }));
      const sndOf = on => L.q.find(m => m.t === 'fx' && m.k === '@snd' && m.by === '' && m.v && m.v.on === on);
      const lv = () => P.evaluate(() => HOST.out.state().snd);
      check('live sound: the section is there, off, with the input picker and the help', await P.evaluate(() => { const b = document.querySelector('#out [data-sec="live"]'); return !!b && /Stream sound to the room: Off/.test(b.textContent) && !!b.querySelector('[data-oc="sndDev"]') && /BlackHole 2ch/.test(b.textContent) && /Names show once/.test(b.textContent); }),
        await P.evaluate(() => (document.querySelector('#out [data-sec="live"]') || {}).textContent));
      check('live sound: the relay and the page can (sndCan, no why)', await P.evaluate(() => HOST.collab.sndCan() && HOST.collab.sndWhy() === ''), await P.evaluate(() => HOST.collab.sndWhy()));
      await P.evaluate(() => { window.__snd.starts = []; const f = HOST.collab.sndStart; HOST.collab.sndStart = (cfg, k) => { window.__snd.starts.push({ cfg, k }); return f(cfg, k); }; window.__snd.ac0 = window.__snd.acNew; });
      const r = await P.evaluate(() => HOST.out.snd(true, 'bh2'));
      check('live sound: snd(true): asking, then live', r && (r.phase === 'live' || r.phase === 'asking'), r);
      check('live sound: getUserMedia asked for the picked input, nothing done to the sound, stereo, 48 kHz', await P.evaluate(() => { const a = window.__snd.asked[0] && window.__snd.asked[0].audio; return !!a && a.deviceId && a.deviceId.exact === 'bh2' && a.echoCancellation === false && a.noiseSuppression === false && a.autoGainControl === false && a.channelCount === 2 && a.sampleRate === 48000; }),
        await P.evaluate(() => window.__snd.asked));
      check('live sound: frames go out', await until(P, () => HOST.out.state().snd.frames > 20, null, 8000), await lv());
      // (whether the stream's pace can be judged here: the input is read and encoded on the page's main thread
      // (MediaStreamTrackProcessor, AudioEncoder), which a page drawing its 3D in software headlessly (SwiftShader, a frame
      // every few hundred ms) leaves too little time, so the reader falls behind and the track drops pieces; alone, the same
      // pipe gives 50 frames a second here. With the page's frames that slow, or the test's own audio clock off real time,
      // the pace, the kbit/s and the count of frames are said to be unchecked, not failed: the owner checks them on a
      // real device)
      await P.evaluate(() => { const F = window.__sndF = []; const tick = t => { F.push(t); if (F.length < 400 && window.__sndF === F) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      const c0 = await P.evaluate(() => window.__snd.ac.currentTime), f0 = (await lv()).frames, t0 = Date.now();
      await sleep(2000);
      const c1 = await P.evaluate(() => window.__snd.ac.currentTime), f1 = (await lv()).frames, wall = (Date.now() - t0) / 1000, rate = (f1 - f0) / wall, clock = (c1 - c0) / wall;
      const frameMs = await P.evaluate(() => { const F = window.__sndF; window.__sndF = null; const d = F.slice(1).map((t, i) => t - F[i]).sort((a, b) => a - b); return d.length ? d[d.length >> 1] : 1e9; });
      const paced = clock > 0.8 && clock < 1.2 && frameMs < 50;
      const pacedCheck = (name, ok, detail) => (paced ? check(name, ok, detail) : console.log(`note ${name}: cannot be checked here (the page's frames ${Math.round(frameMs)} ms apart, the audio clock at ${clock.toFixed(2)} of real time: headless, drawn in software); check it on a real device`));
      pacedCheck('live sound: about 50 frames a second (20 ms)', rate > 40 && rate < 60, rate);
      const starts = await P.evaluate(() => window.__snd.starts);
      check('live sound: sndStart called once, with an Opus cfg', starts.length === 1 && starts[0].cfg.codec === 'opus' && starts[0].cfg.sampleRate === 48000 && [1, 2].includes(starts[0].cfg.numberOfChannels) && starts[0].k === 128, starts);
      const S = await lv();
      check('live sound: the level is above 0, live', S.level > 0.05 && S.phase === 'live' && S.on, S);
      pacedCheck('live sound: kbit/s measured (20 to 400)', S.kbps > 20 && S.kbps < 400, S);
      check('live sound: the inputs named once one was given', S.devs.includes('BlackHole 2ch') && S.devs.includes('Built-in Microphone') && !S.devs.includes('Speakers'), S.devs);
      const on = sndOf(true);
      check('live sound: the listener got @snd on with the cfg', !!on && on.v.cfg.codec === 'opus' && on.v.by === (await P.evaluate(() => HOST.collab.id)) && on.v.kbps === 128, L.q.filter(m => m.k === '@snd'));
      const b = L.bins[L.bins.length - 1];
      pacedCheck('live sound: more than 50 frames reached the listener', L.bins.length > 50, { n: L.bins.length });
      check('live sound: and the frames, with the stream\'s sid and an Opus packet', !!b && b[0] === 1 && b.readUInt16BE(2) === on.v.sid && b.length > 16 && b.length < 2000 && Math.abs(b.readDoubleBE(8) - Date.now()) < 5000,
        { n: L.bins.length, head: b && [...b.subarray(0, 16)] });
      const seqs = L.bins.map(x => x.readUInt32BE(4));
      check('live sound: in order, from 0', seqs[0] === 0 && seqs.every((x, i) => !i || x === seqs[i - 1] + 1), seqs.slice(0, 8));
      check('live sound: the meter moves', await until(P, () => +(document.querySelector('#out [data-snd-meter]') || { getAttribute: () => 0 }).getAttribute('aria-valuenow') > 0, null, 2000));
      check('live sound: no AudioContext made by the app for it', await P.evaluate(() => window.__snd.acNew === window.__snd.ac0), await P.evaluate(() => [window.__snd.ac0, window.__snd.acNew]));
      // the relay's word: the listeners (st, as shared.js's @snd hands it on), then taken by another output page
      await P.evaluate(() => HOST.out.sndFx({ on: true, mine: true, sid: 3, subs: 1, frames: 10, bytes: 3000, dropped: 0, bad: 0, why: '' }));
      check('live sound: Listeners: 1 from st', await until(P, () => /Listeners: 1/.test(document.querySelector('#out [data-snd-live]').textContent), null, 2000));
      if (SHOTS) await P.evaluate(() => document.querySelector('#out [data-sec="live"]').scrollIntoView());
      await shot(P, 'output-live-sound');
      await P.evaluate(() => HOST.out.sndFx({ on: true, mine: false, sid: 4, subs: 1, frames: 0, bytes: 0, dropped: 0, bad: 0, why: 'taken' }));
      const tk = await lv();
      check('live sound: taken by another output page: off, saying so, the input let go', tk.phase === 'off' && !tk.on && /Another output page/.test(tk.note), tk);
      L.q = []; L.bins = [];
      await P.evaluate(() => HOST.out.snd(true));
      check('live sound: on again', await until(P, () => HOST.out.state().snd.frames > 10, null, 8000), await lv());
      check('live sound: the listener gets the new stream', !!sndOf(true) && L.bins.length > 0, L.q.filter(m => m.k === '@snd'));
      await P.evaluate(() => HOST.out.snd(false));
      await sleep(300);
      const off = sndOf(false), n0 = L.bins.length;
      check('live sound: Off sends snd-stop (the listener told: stopped)', !!off && off.v.why === 'stopped', L.q.filter(m => m.k === '@snd'));
      await sleep(400);
      check('live sound: no more frames after Off', L.bins.length === n0 && (await lv()).phase === 'off', L.bins.length - n0);
      check('live sound: the switch kept off (outSnd)', await P.evaluate(() => { const j = JSON.parse(localStorage.getItem('outSnd')); return j.on === false && j.dev === 'bh2' && j.kbps === 128; }), await P.evaluate(() => localStorage.getItem('outSnd')));
      // stopping the output page while streaming stops the stream first
      L.q = [];
      await P.evaluate(() => HOST.out.snd(true));
      await until(P, () => HOST.out.state().snd.frames > 5, null, 8000);
      await P.evaluate(() => HOST.out.stop());
      await sleep(300);
      check('live sound: the output page stopped while streaming: every input track stopped, the listener told, the switch kept on for the next start', await P.evaluate(() => window.__snd.streams.every(s => s.getTracks().every(t => t.readyState === 'ended')) && JSON.parse(localStorage.getItem('outSnd')).on === true) && !!sndOf(false),
        await P.evaluate(() => ({ kept: localStorage.getItem('outSnd'), ended: window.__snd.streams.map(s => s.getTracks().map(t => t.readyState)) })));
      ws.close();
      await P.evaluate(() => HOST.collab.dialog(true));
      await P.click('[data-sh="output"]');
      await until(P, () => HOST.out && HOST.out.on(), null, 10000);
      check('live sound: a plain page cannot stream (sndWhy says why)', await B.evaluate(() => HOST.collab.sndCan() === false && /Only the output page/.test(HOST.collab.sndWhy()) && HOST.collab.sndSend(0, 0, 2, new Uint8Array(10)) === false));
    }
    const pid = await P.evaluate(() => HOST.collab.id);
    check('the others hear its presence as the output page (out, no head)', await until(B, id => { const Q = HOST.collab.people().get(id); return !!Q && Q.out === true && !Q.head; }, pid, 6000));
    await B.evaluate(() => HOST.collab.dialog(true));
    check('their people list says output page', await until(B, () => /output page/.test((document.querySelector('.sh-people') || {}).textContent || ''), null, 5000));
    check('it is never one of the people in a headset', await B.evaluate(() => HOST.collab.persons().length === 0));
    await shot(P, 'output-page-relay');
    check('its address says so: &output (v161, the output page\'s own address)', await until(P, () => /[#&]output(&|$)/.test(location.hash), null, 3000), await P.evaluate(() => location.hash));
    // a reload while it runs: it starts again by itself (its address has &output)
    await P.reload();
    await P.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 60000 });
    check('a reload while it ran starts it again by itself', await until(P, () => HOST.out && HOST.out.on(), null, 20000));
    await P.evaluate(() => HOST.out.stop());
    check('stopped: the others no longer hear it as the output page', await until(B, id => { const Q = HOST.collab.people().get(id); return !Q || !Q.out; }, pid, 8000));
    check('stopped: its address is the room\'s plain one again', await until(P, () => /^#s=[A-Z]{3}/.test(location.hash) && !/[#&](output|camera)(&|$)/.test(location.hash), null, 3000), await P.evaluate(() => location.hash));
    // a plain room address reloads as a plain page (v161: the tab's memory no longer restarts it)
    await P.reload();
    await P.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 60000 });
    await until(P, () => HOST.collab.status === 'open', null, 15000);
    await new Promise(r => setTimeout(r, 2500));
    check('a reload of the plain address stays a plain page', await P.evaluate(() => !(HOST.out && HOST.out.on()) && !HOST.collab.cameraMode() && !HOST.collab.outOn()));
    await B.context().close(); await P.context().close();
  }
  // a phone's link: &output ignored
  const ph = await browser.newContext({ viewport: { width: 400, height: 760 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
  const PH = await ph.newPage();
  await PH.goto(base + 'index.html#s=OUC&peer=off&output');
  await PH.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 60000 });
  await sleep(2500);
  check('a phone ignores &output', await PH.evaluate(() => !HOST.collab.outOn() && !document.getElementById('out')));
  await ph.close();
} catch (e) { check('the test ran to its end', false, e.stack || e.message); }

check('no page errors', !errors.length, errors.slice(0, 5).join('\n'));
await browser.close();
if (relay) relay.kill('SIGTERM');
srv.close();
console.log(fails.length ? `${fails.length} failed` : 'all passed');
process.exit(fails.length ? 1 : 0);
