// Narration test: imitates the strict sound rule of headset browsers (sound only
// starts inside a tap or click) and checks that the narration plays
// after a click on the page, and still plays after the story is changed with no
// tap at all, the way the Stories menu inside a headset changes it.
// Usage: serve the folder, then node tools/audio.mjs [http://127.0.0.1:8123/]
// Needs audio/narration.mp3. PLAYWRIGHT_MODULE and CHROMIUM_PATH as in smoke.mjs.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:8123/';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  ],
});
const errors = [];
// Headless Chromium lets any sound play, so the headset browser's rule is imitated:
// a new audio engine starts locked, and only resume() within a few seconds of a real
// tap or click unlocks it (page.evaluate counts as a gesture for Chromium, so the
// rule looks at real input events instead).
async function open(url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    let tapAt = -1e9;
    for (const t of ['pointerdown', 'pointerup', 'click', 'keydown', 'touchend']) window.addEventListener(t, e => { if (e.isTrusted) tapAt = performance.now(); }, true);
    const tapped = () => performance.now() - tapAt < 5000;
    const AC = window.AudioContext;
    window.AudioContext = class extends AC {
      constructor(...a) { super(...a); this.locked = !tapped(); if (this.locked) super.suspend(); }
      resume() { if (this.locked && !tapped()) return Promise.resolve(); this.locked = false; return super.resume(); }
    };
  });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  return page;
}
let page;
const wait = ms => new Promise(r => setTimeout(r, ms));
// the engine's state, and where in the recording it is (null when silent)
const probe = () => page.evaluate(() => {
  const n = HOST.cur && HOST.cur.peek('AUD');
  return { story: HOST.curKey, ctx: HOST.audio.ctx && HOST.audio.ctx.state, state: n && n.state, pos: n && n.pos(), t: HOST.cur.peek('APP.t') };
});
async function until(what, ok, ms = 30000) {
  const t0 = Date.now();
  let p;
  while (Date.now() - t0 < ms) { p = await probe(); if (ok(p)) return p; await wait(250); }
  throw new Error(`${what}: ${JSON.stringify(p)}`);
}
// sound plays when the recording moves on between two looks
async function playing(what) {
  const a = await until(what + ' (starts)', p => p.ctx === 'running' && p.pos !== null);
  await wait(1500);
  const b = await probe();
  if (!(b.pos !== null && b.pos > a.pos + 0.5)) throw new Error(`${what} (moves on): ${JSON.stringify([a, b])}`);
  console.log(`ok   ${what}: ${a.pos.toFixed(1)} s -> ${b.pos.toFixed(1)} s`);
}
let failed = false;
async function step(what, fn) {
  try { await fn(); } catch (e) { failed = true; console.log('FAIL ' + (e.message || e)); }
}

page = await open(base);
await step('narration loads on the Stories screen', async () => {
  const p = await until('narration loads', p => p.story === 'airports' && p.state === 'ok');
  if (p.ctx === 'running' || p.pos !== null) throw new Error('sound before any tap: ' + JSON.stringify(p));
  console.log('ok   narration decoded, silent before a tap');
});
await page.click('#picker .card[data-story="airports"]');
await step('a click on the story card', () => playing('a click on the story card'));
// let the click's activation run out (a few seconds), then change story with no tap
await wait(6000);
await page.evaluate(() => HOST.go('proteins'));
await until('proteins story', p => p.story === 'proteins');
await page.evaluate(() => HOST.go('airports'));
await step('back to the airports with no tap', async () => {
  await until('airports story', p => p.story === 'airports' && p.state === 'ok');
  await playing('back to the airports with no tap');
});
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
await step('the sound button mutes and unmutes', async () => {
  await page.click('#btnSound');
  await until('muted', p => p.pos === null, 3000);
  if (await page.textContent('#btnSound') !== 'Sound off') throw new Error('label: ' + await page.textContent('#btnSound'));
  await page.click('#btnSound');
  await playing('unmuted');
});
await step('the Stories screen pauses the sound', async () => {
  await page.click('#btnOther');
  await until('silent on the Stories screen', p => p.pos === null, 3000);
  console.log('ok   Stories screen: silent');
});
await page.close();
// a story opened from a link plays silently until a tap; its Play sound button starts the sound
page = await open(base + '#airports');
await step('Play sound on a story opened from a link', async () => {
  await until('waiting for a tap', p => p.state === 'ok' && p.ctx === 'suspended');
  const before = await page.textContent('#btnSound');
  if (before !== 'Play sound') throw new Error('label before: ' + before);
  await page.click('#btnSound');
  await playing('Play sound');
  const after = await page.textContent('#btnSound');
  if (after !== 'Sound on') throw new Error('label after: ' + after);
});
if (errors.length) { failed = true; console.log('page errors:\n  ' + errors.join('\n  ')); }
await browser.close();
console.log(failed ? 'audio test FAILED' : 'audio test: all good');
process.exit(failed ? 1 : 0);
