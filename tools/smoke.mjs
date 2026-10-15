// Headless smoke test for the three stories.
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
for (const key of ['airports', 'proteins', 'spatial']) {
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
  await page.click('#btnOther');
}
await step('old links forward to the app', async () => {
  await page.goto(base + 'spatial.html#t=20');
  await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'spatial', null, { timeout: 30000 });
});
await browser.close();
if (errors.length) { console.log('\n' + errors.join('\n\n')); process.exit(1); }
console.log('\nall good');
