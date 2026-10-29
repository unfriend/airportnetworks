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
// runs; Sound check (beeps, engine choice). The sound effects (HOST.sfx, sfx.js): off by default and silent then;
// turned on in Sound check (its volume kept, Try them) or by #sfx=on (and off by #sfx=off); nothing before a tap; a sound
// really going through the narration's one context; a page button's click; the story's background; ducked under the
// narration and back; at most 16 voices; none with the audio element engine or when Web Audio never starts; the headset
// menu's row and its volume steps, the listener following a pretend headset's head and a sound from a place panned (HRTF).
// Whether sound really comes out of a headset can only be confirmed on the device (and how the effects sound, by ear).
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
// 6. sound effects (HOST.sfx, sfx.js): off by default; turned on (Sound check, a link), nothing before a tap, then through
// HOST.audio's one context, ducked under the narration, at most 16 voices, silent with the audio element engine; a
// background for the story on show; the headset menu's row and the listener following the head
const fxs = () => page.evaluate(() => HOST.sfx.state());
const fxUntil = async (what, ok, ms = 5000) => { const t0 = Date.now(); let s; while (Date.now() - t0 < ms) { s = await fxs(); if (ok(s)) return s; await wait(150); } throw new Error(`${what}: ${JSON.stringify(s)}`); };
// the output's loudest sample over the next second (a sound really went through the context)
const heard = () => page.evaluate(async () => { let m = 0; for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 50)); m = Math.max(m, HOST.sfx.level()); } return m; });
page = await open(base);
await step('sound effects: off by default', async () => {
  const d = await page.evaluate(() => [HOST.sfx.on(), localStorage.getItem('sfxOn'), HOST.sfx.volume()]);
  if (d[0] !== false || d[1] !== null || d[2] !== 0.75) throw new Error('defaults: ' + JSON.stringify(d));
  await page.click('#picker .card[data-story="airports"]');
  await playing('sound effects off: the narration as ever');
  const v = await page.evaluate(() => HOST.sfx.play('notice', { force: true }));
  const s = await fxs();
  if (v !== null || s.played !== 0 || s.bed) throw new Error('a sound while off: ' + JSON.stringify(s));
  console.log('ok   sound effects off by default: nothing plays, no background');
});
await step('sound effects: turned on in Sound check, with a volume', async () => {
  await page.click('#btnOther');
  await page.click('#btnSndCheck');
  if (await page.textContent('[data-snd="sfx"]') !== 'Sound effects: off') throw new Error('no Sound effects button in Sound check');
  await page.click('[data-snd="sfx"]');
  const s = await fxUntil('on, with the switch\'s own sound', s => s.on && s.played >= 1 && s.last === 'toggleOn');
  const b = await page.evaluate(() => [document.querySelector('[data-snd="sfx"]').getAttribute('aria-pressed'), document.querySelector('[data-snd="sfx"]').textContent, localStorage.getItem('sfxOn')]);
  if (b.join() !== 'true,Sound effects: on,on') throw new Error('the button and the setting: ' + b);
  await page.fill('#sfxVol', '50');
  const vol = await page.evaluate(() => [HOST.sfx.volume(), localStorage.getItem('sfxVolume')]);
  if (vol[0] !== 0.5 || vol[1] !== '0.5') throw new Error('volume: ' + vol);
  await page.click('[data-snd="sfx:try"]');
  await fxUntil('Try them plays them in turn', s => s.voices >= 1 && s.played >= 3, 4000);
  if (!/^Sound effects: on, volume 50 %/m.test(await lines())) throw new Error('Sound check\'s line:\n' + await lines());
  console.log(`ok   Sound check turns them on (a switch sound: ${s.last}), the volume is kept, Try them plays them, its line says so`);
});
await step('sound effects: through HOST.audio\'s one context', async () => {
  const same = await page.evaluate(() => HOST.sfx.context() === HOST.audio.ctx && HOST.audio.ctx.state === 'running');
  await page.evaluate(() => HOST.sfx.play('notice', { force: true }));
  const m = await heard();
  if (!same || !(m > 0.001)) throw new Error(`same context ${same}, output peak ${m}`);
  console.log(`ok   a sound plays through the narration's context (output peak ${(20 * Math.log10(m)).toFixed(1)} dBFS at 50 %)`);
});
await step('sound effects: a page button\'s click, the story\'s background, ducked under the narration', async () => {
  const n0 = (await fxs()).played;
  await page.click('#picker .card[data-story="airports"]');
  await fxUntil('a click for the card', s => s.played > n0);
  await playing('the narration with sound effects on');
  const d = await fxUntil('ducked while the voice plays', s => s.speak && s.duck < 0.4 && s.bed === 'airports' && s.bedKind === 'calm', 4000);
  await page.evaluate(() => HOST.cur.peek('APP.togglePlay()'));
  const u = await fxUntil('back up once the voice stops', s => !s.speak && s.duck > 0.9, 5000);
  await page.evaluate(() => HOST.cur.peek('APP.togglePlay()'));
  console.log(`ok   a card's click sounds; the calm background plays for the airports; ducked to ${(20 * Math.log10(d.duck)).toFixed(1)} dB under the voice, back to ${(20 * Math.log10(u.duck)).toFixed(1)} dB after`);
});
await step('sound effects: at most 16 voices', async () => {
  const s = await page.evaluate(() => { const c0 = HOST.sfx.state().cut; for (let i = 0; i < 40; i++) HOST.sfx.play(['click', 'hover', 'place', 'join'][i % 4], { force: true }); const s = HOST.sfx.state(); s.cut -= c0; return s; });
  if (s.voices > 16 || s.cut < 24) throw new Error(JSON.stringify(s));
  console.log(`ok   40 at once: ${s.voices} playing, ${s.cut} made room`);
});
await step('sound effects: silent with the audio element engine, back with Web Audio', async () => {
  await page.click('#btnOther');
  await page.click('#btnSndCheck');
  await fxUntil('no background on the Stories screen', s => !s.bed, 3000);
  await page.click('[data-snd="media"]');
  const v = await page.evaluate(() => [HOST.sfx.play('notice', { force: true }), HOST.audio.fx()]);
  if (v[0] !== null || v[1] !== null) throw new Error('a sound with the audio element chosen');
  await page.click('[data-snd="auto"]');
  const w = await page.evaluate(() => !!HOST.sfx.play('notice', { force: true }));
  if (!w) throw new Error('no sound back with Web Audio');
  console.log('ok   none with the audio element engine (and no background on the Stories screen); back with Web Audio');
});
await page.close();
// a link turns them on (or off); nothing before a tap
page = await open(base + '#airports&sfx=on');
await step('sound effects: #sfx=on in a link, nothing before a tap', async () => {
  await until('waiting for a tap', p => p.state === 'ok' && p.decode === 'ok' && p.ctx === 'suspended');
  const a = await page.evaluate(() => [HOST.sfx.on(), HOST.sfx.play('notice', { force: true }), HOST.sfx.state().played, HOST.sfx.state().bed]);
  if (a[0] !== true || a[1] !== null || a[2] !== 0 || a[3]) throw new Error('before a tap: ' + JSON.stringify(a));
  await page.click('#btnSound');
  await playing('Play sound');
  await fxUntil('the background once tapped', s => s.bed === 'airports');
  if (!await page.evaluate(() => !!HOST.sfx.play('notice', { force: true }))) throw new Error('no sound after the tap');
  console.log('ok   #sfx=on turns them on; silent until a tap, then the background and sounds');
});
// a pretend headset (as the smoke test's): the menu's row, and the listener following the head for sounds from places
await step('sound effects: the headset menu\'s row, sounds from places', async () => {
  await page.evaluate(() => {
    window.__head = { p: [0, 1.6, 0], q: [0, 0, 0, 1] };
    const pose = () => { const h = window.__head; return { transform: { position: { x: h.p[0], y: h.p[1], z: h.p[2] }, orientation: { x: h.q[0], y: h.q[1], z: h.q[2], w: h.q[3] } } }; };
    window.__frame = { getViewerPose: pose }; window.__raf = [];
    HOST.renderer.xr.getReferenceSpace = () => ({});
    HOST.renderer.setAnimationLoop(null);
    window.__s = { visibilityState: 'visible', renderState: {}, environmentBlendMode: 'opaque', enabledFeatures: [], inputSources: [],
      addEventListener() {}, removeEventListener() {}, requestAnimationFrame: cb => window.__raf.push(cb) };
    HOST.session = window.__s;
    HOST.cur.peek('(XR.session = window.__s, XR.mode = "immersive-vr", xrEnterScene(), XR.stories = false, XR.inStory = true, APP.playing = false)');
    window.__tick = (n = 1) => {
      for (let i = 0; i < n; i++) {
        HOST.cur.peek(`(() => {
          xrBegin(window.__frame, 0.016);
          const hand = typeof xrPlaceGlobe === 'function', pn = performance.now();
          let S;
          if (APP.mode === 'story') { const ts = storyT(APP.t); S = storyState(ts); if (hand) xrPlaceGlobe(storyCam(ts)); else { xrPlace(storyCam(ts)); K.U.uTime.value = ts; updateSets(S, ts, 0.016, true); } }
          else { S = hand ? exploreStep(0.016) : exploreStep(0.016, pn); orbitStep(pn); if (hand) xrPlaceGlobe(orbit.cur); else { xrPlace(orbit.cur); updateSets(S, pn / 1000, 0.016, false); } }
          if (hand) applyUniforms(S, APP.mode === 'explore');
          GL.scene.updateMatrixWorld(true); xrUpdate(S); GL.scene.updateMatrixWorld(true);
        })()`);
        for (const cb of window.__raf.splice(0)) cb(performance.now(), window.__frame);
      }
    };
    window.__tick(3);
  });
  const r = await page.evaluate(() => {
    const ids = () => HOST.collab.overlay().panel.regions.map(x => x.id), tap = id => { const x = HOST.collab.overlay().panel.regions.find(y => y.id === id); if (x && x.fn) x.fn(); window.__tick(2); return !!(x && x.fn); };
    HOST.collab.panelOpen(true); window.__tick(3);
    const out = { row: ids().includes('sfx') && ids().includes('sfxvol'), v0: HOST.sfx.volume() };
    out.vol = tap('sfxvol') && HOST.sfx.volume(); out.off = tap('sfx') && HOST.sfx.on(); out.on = tap('sfx') && HOST.sfx.on();
    HOST.collab.panelOpen(false);
    window.__head.p = [0.5, 1.7, -0.2]; window.__tick(2);
    const L = HOST.audio.ctx.listener;
    out.listener = [L.positionX.value, L.positionY.value, L.positionZ.value].map(v => +v.toFixed(3));
    const v = HOST.sfx.play('notice', { at: [1.5, 1.7, -0.2], force: true });
    out.spatial = !!v && HOST.sfx.state().spatial && v.p && v.p.panningModel;
    HOST.session = null; window.__s = null;
    out.flat = !!HOST.sfx.play('click', { at: [1.5, 1.7, -0.2], force: true }) && HOST.sfx.state().spatial;
    return out;
  });
  if (!r.row || r.v0 !== 0.75 || r.vol !== 1 || r.off !== false || r.on !== true || r.listener.join() !== '0.5,1.7,-0.2' || r.spatial !== 'HRTF' || r.flat !== false) throw new Error(JSON.stringify(r));
  console.log(`ok   the headset menu has Sound effects and its volume (0.75 -> ${r.vol}); the listener follows the head (${r.listener}); a sound from a place goes through an ${r.spatial} panner, none on a screen`);
});
await page.close();
page = await open(base + '#airports&sfx=off', '', { sfxOn: 'on' });
await step('sound effects: #sfx=off in a link', async () => {
  if (await page.evaluate(() => HOST.sfx.on() || localStorage.getItem('sfxOn') !== 'off')) throw new Error('still on');
  console.log('ok   #sfx=off turns them off');
});
await page.close();
// a Web Audio engine that never starts: the audio element plays the narration, and the sound effects stay silent
page = await open(base + '#sfx=on', 'nostart');
await step('sound effects: silent when Web Audio never starts', async () => {
  // decoded first: while Web Audio decodes, the element plays anyway, and a decode ending between the two looks
  // handed the narration to the stuck Web Audio for the watchdog's 3 s, so the element seen was not yet the fallback
  await ready();
  await page.click('#picker .card[data-story="airports"]');
  await playing('Web Audio never starts -> fallback', 'media', 30000);
  const s = await page.evaluate(() => [HOST.sfx.play('notice', { force: true }), HOST.sfx.state()]);
  if (s[0] !== null || s[1].played !== 0 || s[1].bed) throw new Error(JSON.stringify(s[1]));
  console.log('ok   only the audio element runs: no sound effects and no background');
});
await page.close();
if (errors.length) { failed = true; console.log('page errors:\n  ' + errors.join('\n  ')); }
await browser.close();
console.log(failed ? 'audio test FAILED' : 'audio test: all good');
process.exit(failed ? 1 : 0);
