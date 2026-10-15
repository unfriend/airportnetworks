// Headless smoke test for the four stories.
//   node tools/smoke.mjs [base-url]     (default http://127.0.0.1:8123/)
// Serve the folder first (npx http-server -p 8123 -c-1 .). Needs Playwright;
// set PLAYWRIGHT_MODULE to its path if it is installed globally, and
// CHROMIUM_PATH to use a specific Chromium build. Exits 1 on any page error.
const base = process.argv[2] || 'http://127.0.0.1:8123/';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', e => errors.push(e.stack || e.message));
page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
const step = async (name, fn) => { const n = errors.length; await fn(); console.log((errors.length > n ? 'FAIL ' : 'ok   ') + name); };

await page.goto(base + 'index.html');
await page.waitForTimeout(4000);
await step('start screen is the landing page', async () => {
  if (!await page.evaluate(() => HOST.picking)) errors.push('start screen not shown on load');
});
for (const key of ['airports', 'proteins', 'spatial', 'lbi']) {
  await step(`load ${key}`, async () => {
    await page.click(`#picker [data-story="${key}"]`).catch(async () => { await page.click('#btnOther'); await page.click(`#picker [data-story="${key}"]`); });
    await page.waitForFunction(k => HOST.curKey === k && HOST.cur && HOST.cur.peek('typeof ST !== "undefined" && ST.items.length > 0'), key, { timeout: 30000 });
  });
  await step(`${key}: scrub through the story`, () => page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const T = HOST.cur.peek('T_END');
    for (let t = 0; t < T; t += 3) { HOST.cur.peek(`APP.seek(${t})`); await sleep(15); }
  }));
  await step(`${key}: explore mode and headset panels`, () => page.evaluate(() => HOST.cur.peek(`(() => {
    APP.enterExplore();
    document.querySelectorAll('.tabs button').forEach(b => b.click());
    XR.on = true;
    for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); }
    XR.stories = true;
    for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); }
    XR.stories = false; XR.on = false;
  })()`)));
  if (key === 'lbi') await step('lbi: every scene and control in explore mode', () => page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (const [k] of HOST.cur.peek('SCENES')) {
      HOST.cur.peek(`openScene('${k}')`);
      for (const c of HOST.cur.peek(`GL.sets['${k}'].controls || []`)) for (const [v] of c.options) {
        HOST.cur.peek(`setCtl('${k}', '${c.key}', '${v}')`);
        await sleep(60);
        HOST.cur.peek(`(() => { XR.on = true; for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } XR.on = false; })()`);
      }
    }
    HOST.cur.peek(`(() => { showTab('protein'); runQuery('TP53'); runQuery('TP53 to BRCA1'); XR.routing = true; XR.on = true;
      for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } XR.on = false; XR.routing = false; })()`);
    await sleep(200);
  }));
  await page.click('#btnOther');
}
// Repeat on the Stories screen: one story again and again, or all of them in turn (the last leads to the first)
await step('Repeat one and Repeat all', async () => {
  const ready = k => page.waitForFunction(k => HOST.curKey === k && !HOST.picking && HOST.cur && HOST.cur.peek('typeof ST !== "undefined" && ST.items.length > 0'), k, { timeout: 30000 });
  const toEnd = () => page.evaluate(() => HOST.cur.peek('(APP.seek(T_END - 0.5), APP.playing = true)'));
  const playsFromTop = (k, what) => page.waitForFunction(k => HOST.curKey === k && HOST.cur.peek('APP.mode === "story" && APP.playing && APP.t < 10'), k, { timeout: 30000 })
    .catch(() => errors.push(what));
  await page.click('#picker [data-repeat="one"]');
  await page.click('#picker [data-story="spatial"]');
  await ready('spatial'); await toEnd();
  await playsFromTop('spatial', 'Repeat one did not start the story again');
  await page.click('#btnOther');
  await page.click('#picker [data-repeat="all"]');
  if (await page.getAttribute('#picker [data-repeat="one"]', 'aria-pressed') !== 'false') errors.push('Repeat one still lit');
  await page.click('#picker [data-story="lbi"]');
  await ready('lbi'); await toEnd();
  await playsFromTop('airports', 'Repeat all did not go from the last story to the first');
  await page.click('#btnOther');
  await page.click('#picker [data-repeat="all"]');
  if (await page.evaluate(() => HOST.repeat) !== 'off') errors.push('pressing the lit Repeat button did not turn it off');
});
await step('old links forward to the app', async () => {
  await page.goto(base + 'spatial.html#t=20');
  await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'spatial', null, { timeout: 30000 });
});
await browser.close();
if (errors.length) { console.log('\n' + errors.join('\n\n')); process.exit(1); }
console.log('\nall good');
