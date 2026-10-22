// Narration test for the shell's sound system (HOST.audio). Headless Chromium plays any sound
// without a tap, so the strict rule of headset browsers is imitated: an AudioContext starts
// locked and only resume() within a few seconds of a real tap unlocks it, and an <audio>
// element plays only once it has been started inside a tap. Faults can be switched on per
// page (a file Web Audio cannot decode, a Web Audio engine that never starts, a clock that
// stops) to check that the <audio> element takes over. Checked here: sound after a click,
// after a story change with no tap (the headset's Stories menu), through pause, jumps, the
// Sound button and the Stories screen; a mute saved by older versions is ignored; Play sound
// never mutes; Esc is not a tap; the hum runs only in a headset session (hidden and visible
// again); each fault falls back to the <audio> element, which also plays while a slow decode
// runs; Sound check (beeps, engine choice).
// Whether sound really comes out of a headset can only be confirmed on the device.
// Usage: serve the folder, then node tools/audio.mjs [http://127.0.0.1:8123/]
// Needs audio/narration.mp3. PLAYWRIGHT_MODULE and CHROMIUM_PATH as in smoke.mjs.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:8123/';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const errors = [];
// page.evaluate counts as a gesture for Chromium, so the imitated rule looks at real input events
async function open(url, fault = '', seed = null) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(([fault, seed]) => {
    if (seed) for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    let tapAt = -1e9;
    for (const t of ['pointerdown', 'pointerup', 'click', 'keydown', 'touchend']) window.addEventListener(t, e => {
      if (e.isTrusted && !(e.type === 'keydown' && /^(Escape|Shift|Control|Alt|Meta|Tab)$/.test(e.key))) tapAt = performance.now();
    }, true);
    const tapped = () => performance.now() - tapAt < 5000;
    const AC = window.AudioContext;
    window.AudioContext = class extends AC {
      constructor(...a) { super(...a); this.locked = !tapped() || fault === 'nostart'; if (this.locked) super.suspend(); }
      resume() { if (fault === 'nostart' || (this.locked && !tapped())) return Promise.resolve(); this.locked = false; return super.resume(); }
      // 'clock': three seconds after a tap the engine's clock stops, although it still says 'running'
      get currentTime() { const t = super.currentTime; if (fault !== 'clock' || performance.now() - tapAt < 3000) return t; return this.frozen === undefined ? (this.frozen = t) : this.frozen; }
      decodeAudioData(...a) {
        // 'slowdecode': the decoded file arrives 12 s late
        if (fault === 'slowdecode') return new Promise(r => setTimeout(r, 12000)).then(() => super.decodeAudioData(a[0])).then(b => { if (typeof a[1] === 'function') a[1](b); return b; });
        if (fault !== 'decode') return super.decodeAudioData(...a);
        const e = new DOMException('Unable to decode audio data', 'EncodingError'); if (typeof a[2] === 'function') a[2](e); return Promise.reject(e);
      }
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!this.unlocked && !tapped()) return Promise.reject(new DOMException('play() needs a tap', 'NotAllowedError'));
      this.unlocked = true;
      return play.call(this);
    };
  }, [fault, seed]);
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  return page;
}
let page;
const wait = ms => new Promise(r => setTimeout(r, ms));
// the sound system's state, and where in the recording the sound is (null when silent)
const probe = () => page.evaluate(() => {
  const n = HOST.cur && HOST.cur.peek('AUD'), A = HOST.audio.state();
  return { story: HOST.curKey, ctx: A.ctx && A.ctx.state, state: n && n.state, decode: n && n.decode, label: n && n.label(),
    pos: n && n.pos(), eng: HOST.audio.engine(), hum: !!A.hum, bad: A.bad, t: HOST.cur.peek('APP.t') };
});
async function until(what, ok, ms = 30000) {
  const t0 = Date.now();
  let p;
  while (Date.now() - t0 < ms) { p = await probe(); if (ok(p)) return p; await wait(250); }
  throw new Error(`${what}: ${JSON.stringify(p)}`);
}
// sound plays (through the given engine) when the recording moves on between two looks
async function playing(what, eng = 'webaudio', ms = 30000) {
  const a = await until(what + ' (starts)', p => p.pos !== null && p.eng === eng && (eng !== 'webaudio' || p.ctx === 'running'), ms);
  await wait(1500);
  const b = await probe();
  if (!(b.pos !== null && b.pos > a.pos + 0.5 && b.eng === eng)) throw new Error(`${what} (moves on): ${JSON.stringify([a, b])}`);
  console.log(`ok   ${what}: ${eng === 'webaudio' ? 'Web Audio' : 'audio element'}, ${a.pos.toFixed(1)} s -> ${b.pos.toFixed(1)} s`);
}
const lines = () => page.evaluate(() => HOST.audio.report().join('\n'));
let failed = false;
async function step(what, fn) {
  try { await fn(); } catch (e) { failed = true; console.log('FAIL ' + what + ': ' + (e.message || e)); }
}
const ready = () => until('narration ready', p => p.story === 'airports' && p.state === 'ok' && p.decode === 'ok');

// 1. the usual way: Stories screen, a click, then everything a visitor does
page = await open(base, '', { narrationMuted: '1' });
await step('narration loads on the Stories screen', async () => {
  const p = await ready();
  if (p.ctx === 'running' || p.pos !== null || p.hum) throw new Error('sound before any tap: ' + JSON.stringify(p));
  console.log('ok   narration decoded, silent before a tap');
});
await page.click('#picker .card[data-story="airports"]');
await step('a click on the story card', async () => {
  await playing('a click on the story card');
  if ((await probe()).hum) throw new Error('a hum without a headset session');
  if (await page.evaluate(() => localStorage.getItem('narrationMuted')) !== null) throw new Error('old mute key still there');
  console.log('ok   a mute saved by an older version is ignored; no hum outside a headset');
});
// let the click's activation run out, then change story with no tap
await wait(6000);
await page.evaluate(() => HOST.go('proteins'));
await until('proteins story', p => p.story === 'proteins');
await step('the engine keeps running in a story without narration', async () => {
  await wait(1500);
  const p = await probe();
  if (p.ctx !== 'running') throw new Error(JSON.stringify(p));
  console.log('ok   engine running in a story without narration');
});
await page.evaluate(() => HOST.go('airports'));
await step('back to the airports with no tap', async () => { await ready(); await playing('back to the airports with no tap'); });
await step('pause stops the sound', async () => {
  await page.evaluate(() => HOST.cur.peek('APP.togglePlay()'));
  await until('silent when paused', p => p.pos === null, 3000);
  await page.evaluate(() => HOST.cur.peek('APP.togglePlay()'));
  await playing('play again');
});
await step('a jump moves the sound', async () => {
  await page.evaluate(() => HOST.cur.peek('APP.seek(100)'));
  const p = await until('sound at the new place', p => p.pos !== null && Math.abs(p.pos - 100) < 2, 5000);
  console.log(`ok   jump to 100 s: sound at ${p.pos.toFixed(1)} s`);
});
await step('the Sound button turns the narration off and on', async () => {
  await page.click('#btnSound');
  await until('off', p => p.pos === null && p.label === 'Sound off', 3000);
  if (await page.evaluate(() => localStorage.getItem('narrationMuted2')) !== '1') throw new Error('not saved');
  await page.click('#btnSound');
  await playing('on again');
});
// slideshow: at a stop the voice finishes its chapter's words (NARRATION_ENDS) while the story waits, and after
// Next the narration stays quiet until the story is back there: nothing cut, nothing said twice
await step('a slideshow stop lets the voice finish its chapter', async () => {
  await page.evaluate(() => HOST.slides.set('airports', true));
  const [s, v] = await page.evaluate(() => [HOST.cur.peek('slideStop(1)'), HOST.cur.peek('slideVoice(1)')]);
  if (!(v > s + 0.5)) throw new Error(`no voice to finish at the first stop (stop ${s}, voice ends ${v})`);
  // the voice stops at the first frame past the words' end, and headless frames can be far apart: a small window
  // draws faster, and the frames' spacing is allowed for
  await page.setViewportSize({ width: 480, height: 300 });
  const gap = await page.evaluate(async () => { const f0 = window.__frames; await new Promise(r => setTimeout(r, 1500)); return 1.5 / Math.max(1, window.__frames - f0); });
  await page.evaluate(s => HOST.cur.peek(`(APP.seek(${s} - 0.1), APP.playing || APP.togglePlay())`), s);
  // the words go on past the stop (unless a slow frame found the stop only after they ended) and end near v
  let last = -1;
  const b = await until('waiting at the stop, the voice done', p => { if (p.pos !== null && Math.abs(p.pos - s) < 5) last = Math.max(last, p.pos); return p.t === s && p.pos === null; }, 30000);
  // T.t: where the sound was when the stop came (a slow page's clock lags the sound, sometimes past the words' end)
  const T = await page.evaluate(() => HOST.cur.peek('SLIDE.tail'));
  if (!T || T.v !== Math.max(v, T.t)) throw new Error(`no voice finishing the chapter: ${JSON.stringify(T)}`);
  if ((T.t < v - 0.5 && last < v - 0.5) || last > T.v + 0.3 + gap) throw new Error(`voice to ${last} (words end ${v}, the sound at ${T.t} at the stop, frames ${gap.toFixed(2)} s apart), story at ${b.t} (stop ${s})`);
  await page.evaluate(() => document.getElementById('btnNext').click());
  const q = [], t0 = Date.now();
  while (Date.now() - t0 < 60000) { const p = await probe(); q.push([p.t, p.pos]); if (p.t > T.v + 0.5) break; await wait(100); }
  const twice = q.filter(([t, pos]) => t < T.v - 0.15 && pos !== null);
  if (twice.length) throw new Error(`after Next the chapter's last words again: ${JSON.stringify(twice)}`);
  const c = await until('the narration with the story again', p => p.pos !== null && p.t > T.v && Math.abs(p.pos - p.t) < 0.4 + gap, 30000);
  console.log(`ok   slideshow stop at ${s.toFixed(2)} s: the voice went on to ${last.toFixed(2)} s (words end ${v}; the sound at ${T.t.toFixed(2)} s at the stop, frames ${gap.toFixed(2)} s apart), then quiet; after Next quiet until the story passed it, then in step (${c.t.toFixed(1)} s, sound ${c.pos.toFixed(1)} s)`);
});
// slideshow off again, the story playing, the window as before, whatever happened above
await page.setViewportSize({ width: 1280, height: 800 });
await page.evaluate(() => { HOST.slides.setGlobal(false); HOST.cur.peek('APP.playing || APP.togglePlay()'); });
await step('a headset session: taken off and put on again', async () => {
  // a stand-in for an XRSession: the shell listens to its visibility and controller events
  await page.evaluate(() => { const s = new EventTarget(); s.visibilityState = 'visible'; window.fakeSession = s; HOST.session = s; });
  await until('hum in the headset', p => p.hum, 3000);
  await page.evaluate(() => { fakeSession.visibilityState = 'hidden'; fakeSession.dispatchEvent(new Event('visibilitychange')); });
  await until('silent with the headset off', p => p.pos === null && !p.hum, 3000);
  await page.evaluate(() => { fakeSession.visibilityState = 'visible'; fakeSession.dispatchEvent(new Event('visibilitychange')); fakeSession.dispatchEvent(new Event('select')); });
  await playing('headset on again');
  if (!(await probe()).hum) throw new Error('no hum with the headset on again');
  await page.evaluate(() => { HOST.session = null; fakeSession.dispatchEvent(new Event('end')); });
  await until('no hum after the session', p => !p.hum, 3000);
  console.log('ok   the hum runs only while the headset session is visible');
});
await step('Sound check: beeps and engine choice', async () => {
  await page.click('#btnOther');
  await until('silent on the Stories screen', p => p.pos === null, 3000);
  await page.click('#btnSndCheck');
  await page.click('[data-snd="beep:webaudio"]');
  await page.click('[data-snd="beep:media"]');
  await wait(800);
  const l = await lines();
  if (!/beep through Web Audio/.test(l) || !/beep through an audio element: playing/.test(l)) throw new Error('beeps:\n' + l);
  if (!/Narration plays through/.test(await page.textContent('#sndcheck pre'))) throw new Error('pane is empty');
  await page.click('[data-snd="media"]');
  await page.click('#picker .card[data-story="airports"]');
  await playing('chosen: audio element', 'media');
  await page.click('#btnOther');
  await page.click('#btnSndCheck'); // Sound check closes with the Stories screen
  await page.click('[data-snd="auto"]');
  await page.click('#picker .card[data-story="airports"]');
  await playing('chosen: automatic', 'webaudio');
  console.log('ok   Sound check: both beeps play, the engine choice works');
});
await page.close();

// 2. a story opened from a link plays silently until a tap; Play sound starts the sound, never mutes
page = await open(base + '#airports');
await step('Play sound on a story opened from a link', async () => {
  await until('waiting for a tap', p => p.state === 'ok' && p.decode === 'ok' && p.ctx === 'suspended');
  const before = await page.textContent('#btnSound');
  if (before !== 'Play sound') throw new Error('label before: ' + before);
  await page.click('#btnSound');
  await playing('Play sound');
  const after = await page.textContent('#btnSound');
  if (after !== 'Sound on') throw new Error('label after: ' + after);
});
await page.close();

// 3. Esc does not count as a tap, so Web Audio is not given up on; the next click starts it
page = await open(base + '#airports');
await step('Esc is not a tap', async () => {
  await until('waiting for a tap', p => p.state === 'ok' && p.decode === 'ok' && p.ctx === 'suspended');
  await wait(5500); // page.evaluate (the probes) counts as a tap for Chromium: let that run out first
  await page.keyboard.press('Escape');
  await wait(4500);
  const p = await probe();
  if (p.bad.webaudio || p.eng !== 'webaudio' || p.label !== 'Play sound') throw new Error(JSON.stringify(p));
  await page.click('#btnSound');
  await playing('Esc, then Play sound');
});
await page.close();

// 4. a slow decode: the <audio> element plays meanwhile, then Web Audio takes over
page = await open(base, 'slowdecode');
await step('a slow decode', async () => {
  await until('file found', p => p.story === 'airports' && p.state === 'ok');
  await page.click('#picker .card[data-story="airports"]');
  await playing('while decoding', 'media', 10000);
  await playing('after decoding', 'webaudio', 30000);
});
await page.close();

// 5. faults: each time the <audio> element takes over
for (const [fault, what, ms] of [['decode', 'Web Audio cannot decode the file', 30000], ['nostart', 'Web Audio never starts', 30000],
  ['clock', 'the Web Audio clock stops', 40000]]) {
  page = await open(base, fault);
  await step(what, async () => {
    await until('file found', p => p.story === 'airports' && p.state === 'ok');
    await page.click('#picker .card[data-story="airports"]');
    await playing(what + ' -> fallback', 'media', ms);
    const p = await probe();
    console.log(`     reason: ${p.bad.webaudio || (p.decode === 'failed' ? 'decoding failed' : '-')}`);
  });
  await page.close();
}
if (errors.length) { failed = true; console.log('page errors:\n  ' + errors.join('\n  ')); }
await browser.close();
console.log(failed ? 'audio test FAILED' : 'audio test: all good');
process.exit(failed ? 1 : 0);
