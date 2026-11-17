// The output page's own test (tools/output/SPEC.md, Tests: PAGE): output.js and its hooks in shared.js, in headless
// Chromium, with Web MIDI stubbed (exactly what Wire 5 names) and the studio's HOST.cur.out stubbed by a fake API with two
// items, so it needs neither the relay's OSC nor the studio's sends.
//   node tools/output/test-page.mjs [--shots <dir>]
// It serves the folder itself (any free port) and starts a plain relay (relay/server.mjs, no OSC flags) for the part that
// needs a room on a relay (the Shared dialog's button, the presence the others see, HOST.collab.osc). Needs Playwright
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

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// every page: the tests' room defaults (AGENTS.md), Web MIDI stubbed (two outputs, one input; what is sent kept in
// window.__midiSent)
async function open(hash, name, size) {
  const ctx = await browser.newContext({ viewport: size || { width: 1024, height: 640 }, acceptDownloads: true });
  await ctx.addInitScript(n => {
    try { for (const [k, v] of [['collabAutoAll', 'off'], ['collabAutoWelcome', 'off'], ['collabAskDefault', 'walk'], ['collabName', n]]) localStorage.setItem(k, v); } catch (e) { /* storage blocked */ }
    window.__midiSent = [];
    const port = (id, name, type) => ({ id, name, type, state: 'connected', onmidimessage: null, send(b) { window.__midiSent.push({ port: name, b: Array.from(b) }); } });
    const outputs = new Map([['o1', port('o1', 'Virtual A', 'output')], ['o2', port('o2', 'Virtual B', 'output')]]), inputs = new Map([['i1', port('i1', 'Keys', 'input')]]);
    const access = { outputs, inputs, onstatechange: null, sysexEnabled: false };
    window.__midi = { access, asked: [] };
    navigator.requestMIDIAccess = o => { window.__midi.asked.push(o); return o && o.sysex ? Promise.reject(new DOMException('no sysex', 'SecurityError')) : Promise.resolve(access); };
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
  const out = { v: 1, ready: () => true, scene: () => 'Fake', list: () => items, pose: id => (poses[id] ? JSON.parse(JSON.stringify(poses[id])) : null),
    listen(fn) { L.push(fn); return () => { const i = L.indexOf(fn); if (i >= 0) L.splice(i, 1); }; },
    act(a) { acts.push(JSON.parse(JSON.stringify(a))); return a.id === 'nothing' ? { ok: false, why: 'no such item' } : { ok: true }; },
    beat: () => null, sends: () => ({ out: 0, dropped: 0 }) };
  window.__fake = { out, L, acts, poses, emit: ev => L.slice().forEach(f => f(ev)) };
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
    const pid = await P.evaluate(() => HOST.collab.id);
    check('the others hear its presence as the output page (out, no head)', await until(B, id => { const Q = HOST.collab.people().get(id); return !!Q && Q.out === true && !Q.head; }, pid, 6000));
    await B.evaluate(() => HOST.collab.dialog(true));
    check('their people list says output page', await until(B, () => /output page/.test((document.querySelector('.sh-people') || {}).textContent || ''), null, 5000));
    check('it is never one of the people in a headset', await B.evaluate(() => HOST.collab.persons().length === 0));
    await shot(P, 'output-page-relay');
    // a reload while it runs: it starts again by itself
    await P.reload();
    await P.waitForFunction(() => typeof HOST !== 'undefined' && HOST.collab, null, { timeout: 60000 });
    check('a reload while it ran starts it again by itself', await until(P, () => HOST.out && HOST.out.on(), null, 20000));
    await P.evaluate(() => HOST.out.stop());
    check('stopped: the others no longer hear it as the output page', await until(B, id => { const Q = HOST.collab.people().get(id); return !Q || !Q.out; }, pid, 8000));
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
