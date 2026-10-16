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
    XR.soundCheck = true; xrUpdate(storyState(0));
    for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); }
    if (!XR.snd.mesh.visible || XR.land[1].mesh.visible) throw new Error('Sound check panel not shown in place of the cards');
    XR.soundCheck = false; XR.stories = false; XR.on = false;
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
// Anchored mode with a pretend headset: a room whose tracking origin can jump (recentring) and
// anchors that keep their place in it, saved under a handle (Quest's persistent anchors)
for (const key of ['airports', 'proteins', 'spatial', 'lbi']) await step(`${key}: anchored placement`, async () => {
  await page.evaluate(k => HOST.start(k), key);
  await page.waitForFunction(k => HOST.curKey === k && HOST.cur && HOST.cur.peek('typeof ST !== "undefined" && ST.items.length > 0'), key, { timeout: 30000 });
  const bad = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms)), out = [];
    const R = { shift: 0, head: { x: 0, y: 1.6, z: 0 }, live: new Set(), handles: new Map(), n: 0, slow: 0, hidden: false };
    const later = v => (R.slow ? new Promise(r => setTimeout(() => r(v), R.slow)) : Promise.resolve(v));
    const mk = room => { const a = { room, anchorSpace: {}, delete() { R.live.delete(a); },
      requestPersistentHandle: () => { const u = 'h' + ++R.n; R.handles.set(u, a.room); return Promise.resolve(u); } };
      a.anchorSpace.a = a; R.live.add(a); return a; };
    const session = () => ({ visibilityState: 'visible', renderState: {}, addEventListener() {}, removeEventListener() {},
      restorePersistentAnchor: u => (R.handles.has(u) ? Promise.resolve(mk(R.handles.get(u))) : Promise.reject(new Error('unknown'))),
      deletePersistentAnchor: u => { R.handles.delete(u); return Promise.resolve(); } });
    // positions in the tracking space are room positions minus the origin's shift
    window.__frame = {
      getViewerPose: () => ({ transform: { position: { x: R.head.x - R.shift, y: R.head.y, z: R.head.z }, orientation: { x: 0, y: 0, z: 0, w: 1 } } }),
      createAnchor: t => later(mk({ x: t.position.x + R.shift, y: t.position.y, z: t.position.z, q: t.orientation })),
      getPose: s => { const r = s.a.room; return { transform: { position: { x: r.x - R.shift, y: r.y, z: r.z }, orientation: r.q } }; },
      get trackedAnchors() { return new Set(R.hidden ? [] : R.live); },
    };
    const peek = s => HOST.cur.peek(s);
    const frames = async n => { for (let i = 0; i < n; i++) { peek('xrBegin(window.__frame, 0.016)'); await sleep(5); } };
    const rigX = () => peek('GL.rig.position.x');
    const begin = s => { window.__s = s; HOST.session = s; peek('(XR.session = window.__s, XR.mode = "immersive-vr", xrEnterScene())'); };
    const end = () => { peek('xrEnded()'); };
    const near = (a, b, what) => { if (Math.abs(a - b) > 1e-6) out.push(`${what}: ${a.toFixed(3)} instead of ${b.toFixed(3)}`); };
    const N = HOST.anchor.state(), keep = { on: N.on, uuid: N.uuid, old: N.old.slice(), off: N.off, pp: N.pp, pr: N.pr, wait: N.wait };
    HOST.anchor.set(false); Object.assign(N, { uuid: '', old: [], off: null, pp: null, wait: 60 });
    const xr = HOST.renderer.xr, getRef = xr.getReferenceSpace;
    xr.getReferenceSpace = () => ({});
    try {
      HOST.anchor.set(true);
      begin(session()); await frames(4);
      if (!HOST.anchor.held() || R.live.size !== 1 || R.handles.size !== 1) out.push('the first placement was not anchored and saved');
      near(rigX(), 0, 'first placement');
      R.shift = 0.5; peek('XR.needRecenter = true'); await frames(2); // the headset recentres
      near(rigX(), -0.5, 'after recentring the place moved in the room');
      R.head.x = 2; peek('xrFreshStart()'); await frames(2); // taken off; the next wearer stands elsewhere
      near(rigX(), -0.5, 'after taking the headset off the place moved');
      if (!peek('XR.stories')) out.push('the next wearer did not land on the Stories screen');
      peek('(XR.stories = false, XR.ctrls[0].hover = { kind: "globe", i: -1 }, xrGrab(XR.ctrls[0], true))');
      if (peek('!!XR.ctrls[0].grab')) out.push('the grip still moves things while anchored');
      peek('XR.ctrls[0].hover = null');
      end(); HOST.session = null; R.live.clear();
      begin(session()); await frames(4); // a new headset session (or a reload): the saved place comes back
      near(rigX(), -0.5, 'the saved place was not restored');
      HOST.anchor.again(); peek('XR.needRecenter = true'); await frames(4);
      near(rigX(), 1.5, 'Place again did not move everything in front of you');
      if (R.handles.size !== 1 || !HOST.anchor.held()) out.push('Place again did not replace the saved place');
      // Place again pressed again while the anchor is still being made: only the newest place counts
      R.slow = 40; HOST.anchor.again(); peek('XR.needRecenter = true'); await frames(1);
      R.head.x = 3; HOST.anchor.again(); peek('XR.needRecenter = true'); await frames(2); await sleep(120); await frames(2);
      near(rigX(), 2.5, 'Place again during anchoring left the older place in charge');
      if (R.live.size !== 1 || R.handles.size !== 1) out.push(`Place again during anchoring left ${R.live.size} anchors and ${R.handles.size} saved places`);
      R.slow = 0;
      // the saved place is not in this room (or not found yet): hold things in front of you and keep it for next time
      const u = N.uuid; end(); HOST.session = null; R.live.clear();
      const missing = session(); missing.restorePersistentAnchor = () => Promise.reject(new Error('not here'));
      begin(missing); await frames(4);
      if (N.uuid !== u || !R.handles.has(u)) out.push('a saved place that was not found was forgotten');
      if (!HOST.anchor.held() || !/not found/.test(HOST.anchor.status())) out.push('a saved place that was not found is not reported');
      end(); HOST.session = null; R.live.clear();
      R.head.x = 0; R.hidden = true; begin(session()); await frames(2); // restored, but the headset cannot find it in the room
      if (!/Finding/.test(HOST.anchor.status())) out.push('no word while the saved place is being looked for');
      await sleep(100); await frames(2);
      if (!HOST.anchor.held() || !/not found/.test(HOST.anchor.status())) out.push('a saved place never found is not reported');
      R.hidden = false; await frames(2);
      near(rigX(), 2.5, 'the saved place found late was not taken');
      if (!/Anchored in the room/.test(HOST.anchor.status())) out.push('the status did not recover once the saved place was found');
      HOST.anchor.set(false); await frames(1);
      if (R.handles.size || HOST.anchor.held()) out.push('switching Anchor off did not forget the place');
      peek('(XR.stories = false, XR.ctrls[0].hover = { kind: "globe", i: -1 }, xrGrab(XR.ctrls[0], true))');
      if (!peek('!!XR.ctrls[0].grab')) out.push('the grip does not move things after Anchor is off');
      peek('(XR.ctrls[0].grab = null, XR.ctrls[0].hover = null)');
      end(); HOST.session = null;
      // a headset without anchors: the place still holds until the headset view ends
      const f = window.__frame; window.__frame = { getViewerPose: f.getViewerPose };
      HOST.anchor.set(true); begin(session()); await frames(3);
      const x0 = rigX();
      R.head.x = -1; peek('xrFreshStart()'); await frames(2);
      near(rigX(), x0, 'without anchors the place moved when the headset was taken off');
      if (!HOST.anchor.held() || !/no room anchors/.test(HOST.anchor.status())) out.push('without anchors the place is not held');
    } finally {
      end(); HOST.session = null; xr.getReferenceSpace = getRef;
      // put back the saved setting and place as they were before the test
      HOST.anchor.set(false); Object.assign(N, keep);
      try {
        localStorage.setItem('xrAnchor', keep.on ? '1' : '0');
        localStorage.setItem('xrPlace', JSON.stringify({ uuid: keep.uuid, old: keep.old, off: keep.off, pp: keep.pp, pr: keep.pr }));
      } catch (e) { /* storage blocked */ }
      delete window.__frame; delete window.__s;
    }
    return out;
  });
  if (bad.length) errors.push(...bad.map(b => `${key}: ${b}`));
  await page.evaluate(() => HOST.openPicker());
});
await step('old links forward to the app', async () => {
  await page.goto(base + 'spatial.html#t=20');
  await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'spatial', null, { timeout: 30000 });
});
await browser.close();
if (errors.length) { console.log('\n' + errors.join('\n\n')); process.exit(1); }
console.log('\nall good');
