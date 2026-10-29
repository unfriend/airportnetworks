// Headless smoke test for the fifteen stories and the design room.
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
for (const key of ['airports', 'proteins', 'spatial', 'lbi', 'nmd', 'endo', 'pet', 'micro', 'ovary', 'qubits', 'mutation', 'topo', 'pass', 'flock', 'robots']) {
  await step(`load ${key}`, async () => {
    await page.click(`#picker [data-story="${key}"]`).catch(async () => { await page.click('#btnOther'); await page.click(`#picker [data-story="${key}"]`); });
    await page.waitForFunction(k => HOST.curKey === k && HOST.cur && HOST.cur.collab.scene() && HOST.cur.peek('typeof ST !== "undefined" && ST.items.length > 0'), key, { timeout: 30000 });
  });
  await step(`${key}: scrub through the story`, () => page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const T = HOST.cur.peek('T_END');
    for (let t = 0; t < T; t += 3) { HOST.cur.peek(`APP.seek(${t})`); await sleep(15); }
  }));
  // Slideshow: the story waits at the end of a chapter (exactly at its stop, Next shown on the page and the
  // headset panel), Next goes on; the last chapter waits too before the end opens explore mode
  await step(`${key}: slideshow stops at the end of a chapter, Next goes on`, async () => {
    const bad = await page.evaluate(async k => {
      const sleep = ms => new Promise(r => setTimeout(r, ms)), peek = src => HOST.cur.peek(src), out = [];
      const until = async (f, ms) => { for (let n = 0; n < ms / 50 && !f(); n++) await sleep(50); return f(); };
      const foot = () => peek(`(() => { XR.on = true; for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } XR.on = false; return XR.foot.regions.map(r => r.id); })()`);
      const back = peek('APP.t');   // where the story was: the steps after this one start from there, as before
      HOST.slides.set(k, true);
      if (!HOST.slides.on(k) || HOST.slides.on(k === 'airports' ? 'proteins' : 'airports')) out.push('the story\'s own switch is not its own');
      const last = peek('CH.length - 1'), frames = n => until(((f0) => () => window.__frames >= f0 + n)(window.__frames), 30000);
      // (headless frames can be slow: the clock is put a frame before each stop, and the checks wait for frames)
      for (const i of [Math.min(1, last), last]) {
        const s = peek(`slideStop(${i})`), v = peek(`slideVoice(${i})`);
        // a scrub while paused, just before the stop, stays where it was put (no stop, no Next)
        peek(`(APP.mode === 'story' || APP.enterStory(0), APP.playing = false)`); await frames(2);
        peek(`APP.seek(${s} - 0.2)`); await frames(2);
        if (Math.abs(peek('APP.t') - (s - 0.2)) > 1e-6 || peek('SLIDE.at') >= 0) out.push(`chapter ${i + 1}: a paused scrub 0.2 s before the stop was moved to it (t ${peek('APP.t')}, stop ${s})`);
        peek(`(APP.seek(${s} - 0.05), APP.playing = true)`);
        if (!await until(() => !peek('APP.playing'), 30000) || peek('APP.t') !== s || peek('APP.mode') !== 'story') { out.push(`did not wait at the end of chapter ${i + 1} (t ${peek('APP.t')}, stop ${s}, ${peek('APP.mode')})`); continue; }
        // a story with a recording: the voice finishes the chapter while the story waits, then the narration is quiet
        // (from where the sound is: a slow page's clock can lag it, even past the words' end)
        const tail = v > s, T = peek('SLIDE.tail');
        if (tail && !(T && T.v === Math.max(v, T.t) && (T.t > v - 0.1 || peek('slideSound()[0]')))) out.push(`chapter ${i + 1}: the voice does not finish its chapter at the stop (${JSON.stringify(T)}, ${peek('slideSound()')})`);
        if (!tail && !peek('AUD.pos()') && (T || peek('slideSound()[0]'))) out.push(`chapter ${i + 1}: the narration plays on at a stop with no voice to finish`);
        await frames(2);
        const nb = document.getElementById('btnNext'), bar = document.getElementById('btnNextBar');
        if (!nb || nb.hidden || !nb.offsetParent) out.push(`chapter ${i + 1}: no Next on the page`);
        if (!bar || bar.hidden) out.push(`chapter ${i + 1}: no Next in the bar (shown there on a phone)`);
        if (!foot().includes('slideNext') || !foot().includes('prev') || !foot().includes('next')) out.push(`chapter ${i + 1}: no Next, or no chapter arrows, on the headset panel at the stop (${foot()})`);
        if (tail) {
          await until(() => !peek('slideSound()[0]'), 30000);
          if (peek('slideSound()[0]') || peek('APP.playing') || peek('APP.t') !== s) out.push(`chapter ${i + 1}: the voice did not stop at the chapter's end while the story waits (${peek('slideSound()')}, t ${peek('APP.t')})`);
        }
        nb.click();
        if (!await until(() => peek('APP.playing') && peek('APP.t') > s, 30000)) out.push(`Next did not go on (playing ${peek('APP.playing')}, t ${peek('APP.t')})`);
        if (tail && peek('APP.t') < T.v - 0.2 && peek('slideSound()[0]')) out.push(`chapter ${i + 1}: after Next the narration says the chapter's end again (t ${peek('APP.t')}, voice ended ${T.v})`);
        if (tail && !await until(() => !peek('SLIDE.tail') && peek('APP.t') >= T.v, 30000)) out.push(`chapter ${i + 1}: the narration does not follow the story again past the voice's end (t ${peek('APP.t')})`);
        if (bar && !bar.hidden && peek('APP.mode') === 'story') out.push('Next still in the bar once playing');
        if (foot().includes('slideNext')) out.push('Next still on the headset panel once playing');
        // past the last stop the story ends as before (explore mode, Repeat being off)
        if (i === last) { peek('APP.seek(T_END - 0.05)'); if (!await until(() => peek('APP.mode') === 'explore', 30000)) out.push('the story did not end after the last stop'); }
      }
      peek('(APP.enterStory(0), APP.playing = false)');
      document.getElementById('btnSlides').click();   // the page's switch: off again for this story
      if (HOST.slides.on(k) || !await until(() => document.getElementById('btnSlides').textContent === 'Slideshow: off', 30000)) out.push('the Slideshow switch did not turn it off');
      HOST.slides.setGlobal(false);
      peek(`APP.enterStory(${back})`);
      return out;
    }, key);
    if (bad.length) errors.push(...bad.map(b => `${key}: ${b}`));
  });
  await step(`${key}: explore mode and headset panels`, () => page.evaluate(() => HOST.cur.peek(`(() => {
    APP.enterExplore();
    document.querySelectorAll('.tabs button').forEach(b => b.click());
    XR.on = true;
    for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); }
    if (XR.main.regions.some(r => r.id === 'exit')) throw new Error('Exit is on the story panel (it belongs in the menu on the left wrist)');
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
  if (key === 'flock') await step('flock: every control, a falcon from the page and from a headset trigger', () => page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms)), peek = src => HOST.cur.peek(src);
    for (const c of peek('GL.sets.flock.controls')) for (const [v] of c.options) {
      peek(`setCtl('flock', '${c.key}', '${v}')`); await sleep(150);
      peek(`(() => { XR.on = true; for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } XR.on = false; })()`);
    }
    // (the count follows on the next frames: a busy machine draws slowly, so wait up to 3 s)
    for (let k = 0; k < 30 && peek('GL.sets.flock.birds()') !== 400; k++) await sleep(100);
    if (peek('GL.sets.flock.birds()') !== 400) throw new Error('the bird count did not follow its control');
    peek('sendFalcon([0, 0.3, -1])'); await sleep(100);
    if (!peek('GL.sets.flock.falconOn()')) throw new Error('a click on the sky sent no falcon');
    // a headset trigger on the sky sends one too (once the first has gone)
    peek(`(() => { GL.sets.flock.state().falcon.on = false; const c = XR.ctrls[0]; c.hover = { kind: 'sky', point: new THREE.Vector3() }; c.d.set(0, 0.3, -1).normalize(); xrPress(c); c.hover = null; c.press = null; })()`);
    if (!peek('GL.sets.flock.falconOn()')) throw new Error('the trigger on the sky sent no falcon');
    await sleep(400);
    if (!peek('(() => { const st = GL.sets.flock.state(); for (let i = 0; i < st.N * 3; i++) if (!isFinite(st.P[i])) return false; return true; })()')) throw new Error('a bird flew off to NaN');
  }));
  if (key === 'robots') await step('robots: every control and rule, a click to walk, crumbs, the gang stays on the floor', async () => {
    const bad = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms)), peek = src => HOST.cur.peek(src);
      for (const c of peek('GL.sets.robots.controls')) for (const [v] of c.options) {
        peek(`setCtl('robots', '${c.key}', '${v}')`); await sleep(120);
        peek(`(() => { XR.on = true; for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } XR.on = false; })()`);
      }
      return peek(`(() => {
        const F = GL.sets.robots, out = [];
        simExplore(0.1);
        if (F.robots() !== 24) out.push('the robot count did not follow its control');
        setCtl('robots', 'view', 'default'); setCtl('robots', 'robots', '12'); setCtl('robots', 'trails', 'off'); setCtl('robots', 'links', 'off');
        const inPoly = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
        const edge = (P, x, z) => { let m = Infinity; for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
          const [ax, az] = P[j], dx = P[i][0] - ax, dz = P[i][1] - az, u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
          m = Math.min(m, Math.hypot(x - ax - u * dx, z - az - u * dz)); } return m; };
        // every robot on the floor (its centre at least its radius from the edge), none in furniture, none overlapping, no NaN
        const check = (what, n) => {
          const rs = F.state().robots, room = F.room();
          if (rs.length !== n) out.push(\`\${what}: \${rs.length} robots instead of \${n}\`);
          for (const r of rs) {
            if (![r.x, r.z, r.h, r.v].every(isFinite)) { out.push(what + ': a robot went to NaN'); return; }
            if (!inPoly(room.floor, r.x, r.z) || edge(room.floor, r.x, r.z) < 0.15) out.push(\`\${what}: robot \${r.i} left the floor (\${r.x.toFixed(2)}, \${r.z.toFixed(2)})\`);
            for (const b of room.blocks) if (!(b.under > 0.12) && inPoly(b.poly, r.x, r.z)) out.push(\`\${what}: robot \${r.i} drove into the \${b.label}\`);
          }
          for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
            const d = Math.hypot(rs[i].x - rs[j].x, rs[i].z - rs[j].z);
            if (d < 0.32) out.push(\`\${what}: robots \${rs[i].i} and \${rs[j].i} overlap (\${d.toFixed(2)} m apart)\`);
          }
        };
        const R = { follow: 2, chain: 3, flee: 4, bounce: 1 };
        for (const rule in R) {
          setCtl('robots', 'rule', rule); simExplore(20);
          if (F.state().rule !== R[rule]) out.push(rule + ': the rule control did not change the rule');
          check(rule, 12);
        }
        const c0 = F.coverage(); dustAgain(); simExplore(0.2);
        // the robots' own footprints count as cleaned at once (about 5 % with 12 robots)
        if (!(c0 > 0.2 && F.coverage() < Math.min(0.15, c0 / 3))) out.push(\`Dust again did not make the floor dusty (\${c0.toFixed(2)} to \${F.coverage().toFixed(2)})\`);
        // a big open floor (paths on a coarser grid once hung here) and a floor with no area: the gang carries on
        for (const fl of [[[-8, -7.5], [8, -7.5], [8, 7.5], [-8, 7.5]], [[0, 0], [1, 0], [2, 0]]]) {
          F.setRoom({ kind: 'real', floor: fl }); setCtl('robots', 'rule', 'follow'); F.walkTo(1.5, 1.2); simExplore(3);
          if (F.state().robots.some(r => !isFinite(r.x + r.z + r.h + r.v)) || !inPoly(F.room().floor, F.state().robots[0].x, F.state().robots[0].z)) out.push(\`a room with the floor \${JSON.stringify(fl)} lost its robots\`);
        }
        F.setRoom(F.modelRoom());
        // 20 s of the story's first chapter: six robots go to their places at the dock and rest there
        simStory(0, 10); simStory(0, 10); check('dock', 6);
        const st = F.state();
        if (st.rule !== 0 || st.robots.some(r => !st.slots[r.slot] || Math.hypot(r.x - st.slots[r.slot][0], r.z - st.slots[r.slot][1]) > 0.1 || Math.abs(r.v) > 0.02)) out.push('the robots did not rest at the dock');
        // crumbs: a pile from the button lands on the floor, and the robots eat it
        setCtl('robots', 'rule', 'bounce'); setCtl('robots', 'robots', '6'); simExplore(1);
        if (F.crumbs(50, 50) !== false) out.push('crumbs spilled off the floor');
        const n0 = F.state().piles.length; spillCrumbs(); simExplore(0.2);
        const ps = F.state().piles, pile = ps[ps.length - 1];
        if (ps.length !== n0 + 1 || !inPoly(F.room().floor, pile.x, pile.z)) out.push('Spill crumbs spilled no pile on the floor');
        else {
          let s = 0;
          for (; s < 30; s++) { simExplore(1); if (!F.state().piles.some(p => p.t === pile.t && !p.done && p.left > 0)) break; }
          if (s === 30) out.push('no robot reached the crumbs in 30 s');
          check('crumbs', 6);
        }
        // ready for the clicks: from above, still, no robots underfoot
        orbit.to = null; orbit.cur = view('robots', 'default'); setTurn('off'); simExplore(3);
        return out;
      })()`);
    });
    // a click on the floor walks you there; a drag turns the view and walks nowhere (with a small gang in the way)
    await page.waitForTimeout(300);
    const peek = s => page.evaluate(s => HOST.cur.peek(s), s);
    await peek(`(setCtl('robots', 'robots', '6'), simExplore(2))`);
    const spot = far => peek(`(() => {
      const p = GL.sets.robots.state().player;
      GL.scene.updateMatrixWorld(true); GL.camera.updateMatrixWorld();
      for (const [x, z] of [[1.6, 1.3], [1.8, -1.0], [0.3, -1.8], [-1.2, 1.6], [1.0, -1.6], [-0.2, -1.4], [-1.8, 0.4], [0.4, 1.5]]) {
        const v = GL.sets.robots.group.localToWorld(new THREE.Vector3(x, 0, z)).project(GL.camera), sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight;
        if (Math.hypot(x - p.x, z - p.z) > ${far} && document.elementFromPoint(sx, sy) === GL.canvas && floorAt(sx, sy)) return [sx, sy, x, z];
      }
      return null; })()`);
    const pl = () => peek('GL.sets.robots.state().player');
    const a = await spot(1.5);
    if (!a) bad.push('no open floor in view to click on');
    else {
      const p0 = await pl();
      await page.mouse.click(a[0], a[1]);
      await page.waitForTimeout(100);
      const p1 = await pl();
      if (!p1.target || Math.hypot(p1.target[0] - a[2], p1.target[1] - a[3]) > 0.3) bad.push(`a click on the floor at (${a[2]}, ${a[3]}) set no walk there (${JSON.stringify(p1.target)})`);
      await peek('simExplore(5)');   // it turns first and gives way to robots, so allow it time
      const p2 = await pl(), d0 = Math.hypot(p0.x - a[2], p0.z - a[3]), d2 = Math.hypot(p2.x - a[2], p2.z - a[3]);
      if (!(d2 < 0.3 || d2 < d0 * 0.5)) bad.push(`after a click on the floor the avatar did not walk there (${d0.toFixed(2)} m to go, then ${d2.toFixed(2)})`);
      const b = await spot(1.5);
      if (b) {
        const az0 = await peek('orbit.cur[0]');
        await page.mouse.move(b[0], b[1]); await page.mouse.down();
        await page.mouse.move(b[0] + 30, b[1], { steps: 3 }); await page.mouse.move(b[0] + 90, b[1] + 10, { steps: 3 }); await page.mouse.up();
        await page.waitForTimeout(100);
        const p3 = await pl(), az1 = await peek('orbit.cur[0]'), ends = [[b[2], b[3]], await peek(`floorAt(${b[0] + 90}, ${b[1] + 10})`)];
        if (p3.target && ends.some(e => e && Math.hypot(p3.target[0] - e[0], p3.target[1] - e[1]) < 0.5)) bad.push('a drag across the floor sent the avatar walking');
        if (!(Math.abs(az1 - az0) > 3)) bad.push('a drag did not turn the view');
      } else bad.push('no open floor in view to drag across');
    }
    await peek('setTurn("on")');
    if (bad.length) errors.push(...bad.map(b => `robots: ${b}`));
  });
  if (key === 'robots') await step('robots: a pretend headset room (floor, walls, a couch) for the gang', async () => {
    const bad = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms)), out = [], peek = s => HOST.cur.peek(s);
      const V = (x, y, z) => new THREE.Vector3(x, y, z), FY = -1.55;   // the floor, 1.55 m below the reference space's origin
      // a detected plane: its pose (+y turned to its normal) and its polygon in plane space
      const plane = (label, ori, centre, normal, pts) => {
        const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), normal), inv = new THREE.Matrix4().compose(centre, q, V(1, 1, 1)).invert();
        return { semanticLabel: label, orientation: ori, lastChangedTime: 1, planeSpace: { c: centre, q },
          polygon: pts.map(p => { const v = p.clone().applyMatrix4(inv); return { x: v.x, y: v.y, z: v.z, w: 1 }; }) };
      };
      const wall = (ax, az, bx, bz, nx, nz) => plane('wall', 'vertical', V((ax + bx) / 2, FY + 1.25, (az + bz) / 2), V(nx, 0, nz),
        [V(ax, FY, az), V(bx, FY, bz), V(bx, FY + 2.5, bz), V(ax, FY + 2.5, az)]);
      const rect = (x0, x1, z0, z1, y) => [V(x0, y, z0), V(x1, y, z0), V(x1, y, z1), V(x0, y, z1)];
      const planes = new Set([plane('floor', 'horizontal', V(0, FY, 0), V(0, 1, 0), rect(-2, 2, -2.5, 2.5, FY)),
        wall(-2, -2.5, 2, -2.5, 0, 1), wall(2, -2.5, 2, 2.5, -1, 0), wall(2, 2.5, -2, 2.5, 0, -1), wall(-2, 2.5, -2, -2.5, 1, 0),
        plane('couch', 'horizontal', V(1.45, FY + 0.45, 0), V(0, 1, 0), rect(1.0, 1.9, -1, 1, FY + 0.45))]);
      const pose = (p, q) => ({ transform: { position: { x: p.x, y: p.y, z: p.z }, orientation: { x: q.x, y: q.y, z: q.z, w: q.w } } });
      window.__frame = { getViewerPose: () => pose(V(0.3, FY + 1.6, 0.2), new THREE.Quaternion()), getPose: s => pose(s.c, s.q), get detectedPlanes() { return planes; } };
      const s = { visibilityState: 'visible', renderState: {}, enabledFeatures: ['local', 'plane-detection'], environmentBlendMode: 'opaque', addEventListener() {}, removeEventListener() {} };
      const xr = HOST.renderer.xr, getRef = xr.getReferenceSpace, anchorWas = HOST.anchor.on;
      xr.getReferenceSpace = () => ({}); HOST.anchor.set(false);
      const frames = async n => { for (let i = 0; i < n; i++) { peek('(xrBegin(window.__frame, 0.016), xrUpdate(exploreStep(0.016, performance.now())))'); await sleep(20); } };
      const run = sec => peek(`for (let k = 0; k < ${sec * 10}; k++) { tellRobots(true); updateSets(exploreStep(0.1, performance.now()), 0, 0.1, false); }`);
      try {
        window.__s = s; HOST.session = s; peek('(XR.session = window.__s, XR.mode = "immersive-vr", xrEnterScene())');
        await frames(3);
        const room = peek('GL.sets.robots.room()');
        if (room.kind !== 'real' || room.walls.length !== 4 || room.blocks.length !== 1) out.push(`the set got a ${room.kind} room with ${room.walls.length} walls and ${room.blocks.length} blocks`);
        // the set's floor is the floor plane: x and z as in the reference space, y up from the floor
        const w = peek('(GL.scene.updateMatrixWorld(true), GL.sets.robots.group.localToWorld(new THREE.Vector3(1, 0, 1)).toArray())');
        if (Math.abs(w[0] - 1) + Math.abs(w[1] - FY) + Math.abs(w[2] - 1) > 1e-4) out.push(`the room's floor is at (${w.map(v => v.toFixed(3))}), not (1, ${FY}, 1)`);
        peek('setCtl("robots", "rule", "bounce"); setCtl("robots", "robots", "12")'); run(20);
        const st = peek('GL.sets.robots.state()');
        if (Math.hypot(st.player.x - 0.3, st.player.z - 0.2) > 1e-3) out.push('the player is not where the head is');
        const off = st.robots.filter(r => !(Math.abs(r.x) < 1.85 && Math.abs(r.z) < 2.35)).length, couch = st.robots.filter(r => r.x > 1 && r.x < 1.9 && Math.abs(r.z) < 1).length;
        if (st.robots.length !== 12 || off || couch) out.push(`${st.robots.length} robots, ${off} off the floor, ${couch} in the couch`);
        // the trigger aimed at the floor spills crumbs there (the dot lies on the floor)
        const n0 = st.piles.length;
        peek(`(() => { const c = XR.ctrls[0], eye = new THREE.Vector3(0.2, ${FY} + 1.2, -0.1); c.src = { targetRayMode: 'tracked-pointer', gamepad: null }; c.g.visible = true;
          c.g.matrix.lookAt(eye, new THREE.Vector3(0.5, ${FY}, -1.2), new THREE.Vector3(0, 1, 0)).setPosition(eye); c.g.matrixWorld.copy(c.g.matrix); })()`);
        await frames(1);
        const h = peek('XR.ctrls[0].hover && [XR.ctrls[0].hover.kind, XR.ctrls[0].dot.position.y]');
        if (!h || h[0] !== 'floor' || Math.abs(h[1] - FY - 0.005) > 1e-3) out.push('the ray at the floor does not put the dot on the floor');
        peek('XR.ctrls[0].wantPress = true'); await frames(1);
        const ps = peek('GL.sets.robots.state().piles'), p = ps[ps.length - 1];
        if (ps.length !== n0 + 1 || Math.hypot(p.x - 0.5, p.z + 1.2) > 0.05) out.push('the trigger on the floor spilled no crumbs where it pointed');
        peek('(XR.ctrls[0].src = null, XR.ctrls[0].g.visible = false, XR.ctrls[0].hover = null)');
        peek('xrEnded()'); HOST.session = null;
        if (peek('GL.sets.robots.room().kind') !== 'model' || !peek('GL.sets.robots.avatar().shown')) out.push('leaving the headset did not bring back the model room and the avatar');
      } finally {
        if (HOST.session) { peek('xrEnded()'); HOST.session = null; }
        xr.getReferenceSpace = getRef; HOST.anchor.set(anchorWas);
        delete window.__frame; delete window.__s;
      }
      return out;
    });
    if (bad.length) errors.push(...bad.map(b => `robots: ${b}`));
  });
  if (key === 'nmd') await step('nmd: every explore tool, on the page and in the headset', () => page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const bad = HOST.cur.peek(`(() => {
      const out = [], T = GL.sets.tower;
      for (const g of [0, 5, 11]) { selectGroup(g); X.showZ = true; X.colour = 'endo'; X.grid = true; }
      runQuery('TTN'); if (X.gene !== findGene('TTN')) out.push('gene search did not select TTN');
      togglePick(5, 13); togglePick(11, 7); if (!endoStats().rows.length) out.push('no links between two picked endotypes');
      runWalk(5); if (!X.walk || !X.walk.top.length) out.push('the walk found nothing');
      const top = X.walk ? X.walk.top[0] : -1;
      setLayers(L => L.cat === 'ppi'); knockRandom(10); runWalk(5); if (!X.walk) out.push('the walk failed with layers knocked out');
      addMine(findGene('DES')); addMine(findGene('MYH7')); runWalk('mine'); if (!X.walk) out.push('a walk from your own genes failed');
      if (T.pick && typeof T.pick(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1)) !== 'number') out.push('pick returned no number');
      setRoom(true); setRoom(false);
      for (const s of ['motor', 'hpc', 'tower']) { openScene(s); for (const c of GL.sets[s].controls || []) for (const [v] of c.options) setCtl(s, c.key, v); }
      XR.on = true;
      for (const [k] of TABS) { showTab(k); for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } }
      XR.kbd.open = true; showTab('genes'); XR.kbd.q = 'MYH'; for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); }
      XR.kbd.open = false; XR.on = false;
      clearWalk(); clearPick(); setLayers(() => true); selectGene(-1); selectGroup(-1);
      return out;
    })()`);
    await sleep(300);
    if (bad.length) throw new Error(bad.join('; '));
  }));
  if (key === 'endo') await step('endo: every explore tool, on the page and in the headset', () => page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const bad = HOST.cur.peek(`(() => {
      const out = [], N = GL.sets.net.api();
      for (const e of [0, 2, 7, 11]) { selectEndo(e); if (X.endo !== e) out.push('endotype ' + e + ' not selected'); }
      runQuery('COLQ'); if (X.gene !== N.geneIndex('COLQ')) out.push('gene search did not select COLQ');
      showHood(); showInTree(X.gene);
      for (let i = 0; i < 5; i++) showStep(i);
      for (let j = 0; j < 13; j++) setK(j);
      replayTests(); setGap(true); setGap(false);
      for (const s of ['syn', 'net', 'tree', 'motor']) { openScene(s); for (const c of GL.sets[s].controls || []) for (const [v] of c.options) setCtl(s, c.key, v); }
      const rc = new THREE.Raycaster(new THREE.Vector3(0, 0, 8), new THREE.Vector3(0, 0, -1));
      for (const s of ['net', 'tree']) { const r = GL.sets[s].api().pick(rc); if (r === undefined) out.push(s + ' pick returned nothing'); }
      XR.on = true;
      for (const [k] of TABS) { showTab(k); for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } }
      XR.kbd.open = true; showTab('genes'); XR.kbd.q = 'SNA'; for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); }
      XR.kbd.open = false; XR.on = false;
      selectGene(-1); selectEndo(-1); showTab('endo');
      return out;
    })()`);
    await sleep(300);
    if (bad.length) throw new Error(bad.join('; '));
  }));
  if (key === 'pet') await step('pet: every explore tool, on the page and in the headset', () => page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const bad = HOST.cur.peek(`(() => {
      const out = [];
      for (const id of NET_ALL) { showNet(id); if (curNet() !== id) out.push('network ' + id + ' not shown'); }
      for (let i = 0; i < PET_DATA.table2.length; i++) { selectCmp(i); if (X.cmp !== i) out.push('comparison ' + i + ' not selected'); }
      for (const o of PET_DATA.organs) { selectOrgan(o.id); if (X.organ !== o.id) out.push('organ ' + o.id + ' not selected'); }
      setLife(true); setLife(false);
      for (const s of ['scan', 'body', 'organs', 'liver']) { openScene(s); for (const c of GL.sets[s].controls || []) for (const [v] of c.options) setCtl(s, c.key, v); }
      const st = JSON.stringify(collabState()); collabApply(JSON.parse(st));
      if (JSON.stringify(collabState()) !== st) out.push('apply(state()) changed the state');
      const rc = new THREE.Raycaster(new THREE.Vector3(0, 0.2, 6), new THREE.Vector3(0, 0, -1));
      try { GL.sets.organs.api().pick(rc); } catch (e) { out.push('organs pick threw: ' + e.message); }
      XR.on = true;
      for (const [k] of TABS) { showTab(k); for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } }
      XR.on = false;
      selectOrgan(null); showNet('full'); showTab('networks');
      return out;
    })()`);
    await sleep(300);
    if (bad.length) throw new Error(bad.join('; '));
  }));
  if (key === 'micro') await step('micro: every explore tool, on the page and in the headset', () => page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const bad = HOST.cur.peek(`(() => {
      const out = [];
      for (const o of MICRO_DATA.organs) { selectOrgan(o.name); if (X.organ !== o.name) out.push('organ ' + o.name + ' not selected'); }
      for (const d of ['submucosa', 'corpus albicans', 'adenohypophysis', 'connective tissue']) selectDomain(d);
      for (let i = 0; i < MICRO_DATA.examples.length; i++) showExample(i);
      for (const a of [20, 45, 70]) { setAge(a); if (X.age !== a) out.push('age ' + a + ' not set'); }
      for (let s = 1; s <= 4; s++) { setStep(s); if (X.step !== s) out.push('step ' + s + ' not set'); }
      for (const s of ['body', 'slide', 'atlas', 'hier']) { openScene(s); for (const c of ctlsOf(s)) for (const [v] of c.options) setCtl(s, c.key, v); }
      const rc = new THREE.Raycaster(new THREE.Vector3(0, 0.2, 6), new THREE.Vector3(0, 0, -1));
      try { pickWith(rc); } catch (e) { out.push('pick threw: ' + e.message); }
      XR.on = true;
      for (const [k] of TABS) { showTab(k); for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } }
      XR.on = false;
      selectOrgan(null); setAge(20); setStep(1); showTab('organs');
      return out;
    })()`);
    await sleep(300);
    if (bad.length) throw new Error(bad.join('; '));
  }));
  if (key === 'ovary') await step('ovary: every explore tool, on the page and in the headset', () => page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const bad = HOST.cur.peek(`(() => {
      const out = [];
      for (const k of KINDS) { selectKind(k); if (X.kind !== k) out.push('kind ' + k + ' not picked'); }
      for (const a of [20, 45, 70]) { setAge(a); if (X.age !== a) out.push('age ' + a + ' not set'); }
      for (const m of ['rf', 'seg']) { setMethod(m); if (X.method !== m) out.push('method ' + m + ' not set'); }
      for (const s of ['organ', 'section']) { openScene(s); for (const c of ctlsOf(s)) for (const [v] of c.options) setCtl(s, c.key, v); }
      const st = JSON.stringify(collabState()); collabApply(JSON.parse(st));
      if (JSON.stringify(collabState()) !== st) out.push('apply(state()) changed the state');
      openScene('section'); setCtl('section', 'view', 'section'); Object.assign(XS, exploreTargets());
      const rc = new THREE.Raycaster(new THREE.Vector3(0, 0.2, 6), new THREE.Vector3(0, 0, -1));
      try { pickWith(rc); } catch (e) { out.push('pick threw: ' + e.message); }
      XR.on = true;
      for (const [k] of TABS) { pickTab(k); for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } }
      XR.on = false;
      selectKind(null); setAge(30); showTab('objects');
      return out;
    })()`);
    await sleep(300);
    if (bad.length) throw new Error(bad.join('; '));
  }));
  if (key === 'qubits') await step('qubits: every explore tool, on the page and in the headset', () => page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const bad = HOST.cur.peek(`(() => {
      const out = [];
      for (let i = 0; i < Q.NETS.length; i++) for (const c of ['0', '1']) for (const b of ['1', '2', '3']) {
        sceneCtl('cube', 'net', String(i)); setCtl('cube', 'cut', c); setCtl('cube', 'bits', b);
        if (cubeNet() !== i || cubeBits() !== +b) out.push('network ' + i + ', cut ' + c + ', bits ' + b + ' not shown');
      }
      sceneCtl('cube', 'net', String(NETI)); setCtl('cube', 'cut', '0'); setCtl('cube', 'bits', '3');
      for (const nm of kindsAt(3).concat(largestAt(curAn()))) { selectBrick(nm); if (X.brick !== nm) out.push('brick ' + nm + ' not picked'); }
      for (let n = 0; n <= NB(); n++) { setSum(n); if (X.sum !== n) out.push('sum ' + n + ' not set'); }
      setGal('kinds'); setGal('largest');
      for (const a of ['0', '1']) setCtl('cube', 'alg', a);
      for (const s of ['pairs', 'cube', 'chart']) { openScene(s); for (const c of ctlsOf(s)) for (const [v] of c.options) setCtl(s, c.key, v); }
      const st = JSON.stringify(collabState()); collabApply(JSON.parse(st));
      if (JSON.stringify(collabState()) !== st) out.push('apply(state()) changed the state');
      openScene('cube'); showView('cube', 'bricks');
      const rc = new THREE.Raycaster(new THREE.Vector3(0, 0.2, 6), new THREE.Vector3(0, 0, -1));
      try { pickWith(rc); } catch (e) { out.push('pick threw: ' + e.message); }
      XR.on = true;
      for (const [k] of TABS) { pickTab(k); for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } }
      XR.on = false;
      selectBrick(null); setSum(0); showTab('network');
      return out;
    })()`);
    await sleep(300);
    if (bad.length) throw new Error(bad.join('; '));
  }));
  if (key === 'mutation') await step('mutation: every explore tool, on the page and in the headset', async () => {
    const bad = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms)), peek = src => HOST.cur.peek(src);
      const until = async (f, ms) => { for (let n = 0; n < ms / 50 && !f(); n++) await sleep(50); return f(); };
      const out = peek(`(() => {
        const out = [], txt = k => document.getElementById('pane-' + k).textContent;
        // Letters: every letter and mix in the two qubits, read out, cleared, read again
        pickTab('letters');
        for (const [v] of MIXES()) { setMix(v); if (letMix() !== v || X.scene !== 'letters' || !viewIs('letters', 'qubits')) out.push('the mix ' + v + ' not shown'); }
        setMix('G'); readOut(100);
        if (X.reads !== 100 || readCounts()[2] !== 100 || !txt('letters').includes('G is ')) out.push('G read out 100 times gave ' + readCounts() + ' (' + txt('letters').slice(0, 80) + ')');
        readOut(0); if (X.reads) out.push('Clear left read-outs');
        setMix('even'); readOut(100); if (readCounts().some(n => n < 10)) out.push('an even mix read out lopsided: ' + readCounts());
        const r0 = X.rseed; readAgain(); if (X.rseed === r0 || X.reads) out.push('Read again kept the seed or the piles');
        setMix('rule'); setTime(0.45); if (X.time !== 0.45 || !txt('letters').includes('0.45 swaps per letter')) out.push('the rule\\'s mix does not follow the branch length');
        // Rule: every rule, view, start and parent letter, the branch length from 0 to 2
        pickTab('rule');
        for (const m of M.MODELS) { sceneCtl('rule', 'model', m.key); if (M.MODELS[ruleModel()] !== m || !txt('rule').includes(m.note)) out.push('the rule ' + m.key + ' not shown'); }
        for (const [v] of ctlOf('rule', 'view').options) { showView('rule', v); if (ruleView() !== v || !ruleInfo().rows.length) out.push('the rule\\'s view ' + v + ' not shown'); }
        showView('rule', 'path'); for (const l of LET) { sceneCtl('rule', 'start', l); if (LET[letterOf('start')] !== l) out.push('start ' + l + ' not set'); }
        showView('rule', 'steps'); for (const l of LET) { sceneCtl('rule', 'parent', l); if (LET[letterOf('parent')] !== l) out.push('parent ' + l + ' not set'); }
        for (const t of [0, 0.8, 2]) setTime(t);
        if (X.time !== 2 || !txt('rule').includes('after 2.00') || !txt('rule').includes('Simple steps')) out.push('the Rule pane does not follow the branch length or the steps');
        // Tree: every tree and speed (fourteen branches each), every branch picked, a new tree, every view, the machines
        pickTab('tree');
        for (const s of ['1', '2', '3', '4', '5']) for (const sp of ['0', '1', '2', '3']) {
          sceneCtl('tree', 'seed', s); sceneCtl('tree', 'speed', sp);
          if (treeNow().branches.length !== 14) out.push('tree ' + s + ' at speed ' + sp + ' has ' + treeNow().branches.length + ' branches');
        }
        sceneCtl('tree', 'seed', '3'); sceneCtl('tree', 'speed', '1');
        for (let b = 0; b < 14; b++) { selectBranch(b); if (X.branch !== b || !txt('tree').includes('Branch ' + (b + 1) + ' · ')) out.push('branch ' + (b + 1) + ' not shown'); }
        nextTree(); if (X.branch !== -1 || ctlValue('tree', ctlOf('tree', 'seed')) !== '4') out.push('New tree did not bring the next tree');
        for (const [v] of ctlOf('tree', 'view').options) { showView('tree', v); for (const [r] of ctlOf('tree', 'run').options) sceneCtl('tree', 'run', r); }
        for (const c of ['default', 'stand', 'up', 'crown']) if (!GL.sets.tree.cam[c]) out.push('no tree view ' + c);
        // Stem: both sources and every method, the authors' shares, the pair favour, rebuilt again
        pickTab('stem');
        for (const [s] of ctlOf('stem', 'src').options) for (const [m] of ctlOf('stem', 'method').options) {
          sceneCtl('stem', 'src', s); sceneCtl('stem', 'method', m);
          if (stemInfo().rows.some(r => r[1] === '–') || stemInfo().ex.length !== 3) out.push('no shares or examples for ' + s + ', ' + m);
        }
        sceneCtl('stem', 'src', 'test'); sceneCtl('stem', 'method', 'all');
        const share = m => stemInfo().rows.find(r => r[3] === m)[1];
        if (share('indep') !== '10 % intact' || share('coupled') !== '43 % intact' || share('exact') !== '20 % intact') out.push('the authors\\' shares are not shown: ' + stemInfo().rows.map(r => r[1]));
        for (const w of [1, 8, 20, 30]) { setW(w); if (X.w !== w || !stemLive() || !txt('stem').includes('matching pairs ' + w + ' × as likely')) out.push('the pair favour ' + w + ' not shown live'); }
        setW(8);
        const R = api('stem').results(1, 8, X.sseed);
        if (!(R.indep.share < R.exact.share && R.exact.share < R.coupled.share)) out.push('the live example does not go the poster\\'s way (letter by letter < exact < coupled)');
        const s0 = X.sseed; rebuildAgain(); if (X.sseed === s0) out.push('Rebuild again kept its seed');
        for (const [v] of ctlOf('stem', 'view').options) showView('stem', v);
        // Scenes: every scene's every control; the shared state round trip
        for (const [k] of SCENES) { openScene(k); for (const c of ctlsOf(k)) for (const [v] of c.options) setCtl(k, c.key, v); }
        const st = JSON.stringify(collabState()); collabApply(JSON.parse(st));
        if (JSON.stringify(collabState()) !== st) out.push('apply(state()) changed the state');
        // the headset's panels, every tab
        XR.on = true;
        for (const [k] of TABS) { pickTab(k); for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } }
        XR.on = false;
        // ready to pick: the family tree grown, and the rebuilt fields
        sceneCtl('tree', 'seed', '1'); sceneCtl('tree', 'speed', '1'); showView('tree', 'tree'); selectBranch(-1);
        orbit.cur = view('tree', 'default'); orbit.to = null; Object.assign(XS, exploreTargets());
        return out;
      })()`);
      // picks with the pointer, once the sets have drawn the tree: a branch, then a field of rebuilt stems
      const f0 = window.__frames; await until(() => window.__frames >= f0 + 3, 30000);
      // (the first point on a grid over the scene, beside the side panel, that picks a thing of that kind)
      const pickOn = kind => peek(`(() => { applyCamera(orbit.cur); GL.camera.updateMatrixWorld(); GL.world.updateMatrixWorld(true);
        for (let y = 0.15; y < 0.9; y += 0.03) for (let x = 0.3; x < 0.95; x += 0.03) { const p = pickAt(innerWidth * x, innerHeight * y); if (p && p.${kind} !== undefined) return p; }
        return null; })()`);
      const pb = pickOn('branch');
      if (!pb || pb.branch === undefined) out.push('no branch picked on the family tree (' + JSON.stringify(pb) + ')');
      else { peek(`(pickText(${JSON.stringify(pb)}), choosePick(${JSON.stringify(pb)}))`); if (peek('X.branch') !== pb.branch) out.push('a branch clicked was not picked'); }
      peek(`(selectBranch(-1), showView('stem', 'rebuild'), sceneCtl('stem', 'method', 'all'), orbit.cur = view('stem', viewCam('stem')), orbit.to = null, Object.assign(XS, exploreTargets()))`);
      const f1 = window.__frames; await until(() => window.__frames >= f1 + 3, 30000);
      const pf = pickOn('field');
      if (!pf || !pf.field) out.push('no field picked among the rebuilt stems (' + JSON.stringify(pf) + ')');
      else { peek(`(pickText(${JSON.stringify(pf)}), choosePick(${JSON.stringify(pf)}))`); if (peek('stemMethod()') !== pf.field) out.push('a field clicked did not light its method'); }
      peek(`(sceneCtl('stem', 'method', 'all'), sceneCtl('stem', 'src', 'test'), pickTab('rule'))`);
      return out;
    });
    if (bad.length) errors.push(...bad.map(b => 'mutation: ' + b));
  });
  if (key === 'mutation') await step('mutation: its links open explore mode on what they say', async () => {
    // (a page of its own: a link differing only in its hash would not load the story again)
    const lp = await browser.newPage({ viewport: { width: 1280, height: 760 } });
    lp.on('pageerror', e => errors.push('mutation link: ' + (e.stack || e.message)));
    lp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('mutation link: ' + m.text()); });
    const LINKS = [
      ['tab=letters&mix=G', "X.tab === 'letters' && X.scene === 'letters' && viewIs('letters', 'qubits') && letMix() === 'G' && txt('letters').includes('G is ')"],
      ['tab=rule&model=even&start=C&time=0.8', "X.tab === 'rule' && ruleView() === 'path' && M.MODELS[ruleModel()].key === 'even' && LET[letterOf('start')] === 'C' && X.time === 0.8 && txt('rule').includes('after 0.80')"],
      ['tab=tree&seed=3&speed=2&branch=5', "X.tab === 'tree' && X.scene === 'tree' && treeSeed() === 3 && ctlValue('tree', ctlOf('tree', 'speed')) === '2' && X.branch === 4 && txt('tree').includes('Branch 5 · ')"],
      ['tab=stem&src=live&w=20', "X.tab === 'stem' && X.scene === 'stem' && stemLive() && X.w === 20 && txt('stem').includes('matching pairs 20 × as likely')"],
      ['scene=tree&view=up', "X.tab === 'scenes' && X.scene === 'tree' && orbit.cur[1] === view('tree', 'up')[1] && orbit.cur[2] === view('tree', 'up')[2]"],
    ];
    try {
      for (const [h, ok] of LINKS) {
        await lp.goto('about:blank');
        await lp.goto(base + 'index.html#mutation&explore&' + h);
        await lp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'mutation' && HOST.cur && HOST.cur.peek('APP.mode') === 'explore', null, { timeout: 30000 });
        const shown = await lp.evaluate(ok => HOST.cur.peek(`(() => { const txt = k => document.getElementById('pane-' + k).textContent; return ${ok}; })()`), ok);
        if (!shown) errors.push(`mutation: the link #mutation&explore&${h} does not show what it says (${await lp.evaluate(() => JSON.stringify(HOST.cur.collab.state()))})`);
      }
    } finally { await lp.close(); }
  });
  if (key === 'topo') await step('topo: every explore tool, on the page and in the headset', async () => {
    const bad = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms)), peek = src => HOST.cur.peek(src);
      const until = async (f, ms) => { for (let n = 0; n < ms / 50 && !f(); n++) await sleep(50); return f(); };
      // (the cells' own bars are inflated a frame or two after load)
      if (!await until(() => peek('TDATA.localReady'), 30000)) return ['the cells\' own bars were never unpacked'];
      const out = peek(`(() => {
        const out = [], txt = k => document.getElementById('pane-' + k).textContent;
        // the value of a row of a pane, read from the page (a sign as the panes print it: − or +)
        const dd = (k, name) => { const t = [...document.querySelectorAll('#pane-' + k + ' dt')].find(d => d.textContent === name), v = t && t.nextElementSibling.firstChild;
          return v ? parseFloat(v.textContent.replace('−', '-')) : NaN; };
        // Patch: the poster's four snapshots give its counts; every view and what is lit
        pickTab('patch'); if (X.scene !== 'tower') out.push('the Patch tab did not bring up the patch');
        for (const s of FACTS.snaps) {
          setR(s.r);
          if (X.r !== Math.round(s.r * 100) / 100 || dd('patch', 'Pieces') !== s.pieces || dd('patch', 'Loops') !== s.loops) out.push('at ' + s.r + ' µm the pane shows ' + dd('patch', 'Pieces') + ' pieces and ' + dd('patch', 'Loops') + ' loops, not ' + s.pieces + ' and ' + s.loops);
        }
        for (const r of [1.5, 60]) { setR(r); if (X.r !== r) out.push('the radius ' + r + ' not set'); }
        for (const [v] of ctlOf('tower', 'view').options) { showView('tower', v); if (towerView() !== v) out.push('the patch\\'s view ' + v + ' not shown'); }
        for (const [v] of ctlOf('tower', 'lit').options) sceneCtl('tower', 'lit', v);
        // Cohort: both kinds of curve and every view, every slide picked; the held-out test as the poster's
        pickTab('cohort'); if (X.scene !== 'cohort') out.push('the Cohort tab did not bring up the cohort');
        for (const [d] of ctlOf('cohort', 'dim').options) for (const [v] of COHORT_VIEWS()) {
          sceneCtl('cohort', 'dim', d); showView('cohort', v);
          if (cohortDim() !== +d || cohortView() !== v) out.push('the cohort\\'s ' + v + ' of dimension ' + d + ' not shown');
        }
        sceneCtl('cohort', 'dim', '1');
        const P = TOPO_DATA.poster, cf = P.confusion, N = TOPO_DATA.labels.length;
        if (!txt('cohort').includes((cf[0] + cf[3]) + ' of ' + N + ' right') || !txt('cohort').includes(cf[0] + ' of ' + (cf[0] + cf[1]) + ' right') || !txt('cohort').includes(cf[3] + ' of ' + (cf[2] + cf[3]) + ' right') || !txt('cohort').includes(P.accuracy.toFixed(3)))
          out.push('the Cohort pane does not show the poster\\'s held-out test ' + cf + ', ' + P.accuracy);
        for (let i = 0; i < N; i++) { selectSlide(i); if (X.slide !== i || !txt('cohort').includes('Slide ' + (i + 1) + ' · ')) { out.push('slide ' + (i + 1) + ' not shown'); break; } }
        stepSlide(1); if (X.slide !== 0) out.push('Next after the last slide did not go round to the first');
        selectSlide(-1);
        // Scales: a window of radii of your own, read from the pane, is the sum of the stored shares; the poster's windows
        pickTab('scales'); if (X.scene !== 'cohort' || cohortView() !== 'scales') out.push('the Scales tab did not bring up the column of radii');
        for (const [d] of ctlOf('cohort', 'dim').options) {
          sceneCtl('cohort', 'dim', d);
          for (const [a, b] of [[5, 15], [0, 5], [15, 100.5]]) {
            setFrom(a); setTo(b);
            const want = TDATA.share(+d, a, b > 100 ? Infinity : b);
            if (X.from !== a || X.to !== b || Math.abs(dd('scales', 'Adds') - want) > 0.006) out.push('the window ' + a + '-' + b + ' µm of dimension ' + d + ' reads ' + dd('scales', 'Adds') + ', not ' + want.toFixed(3));
          }
        }
        sceneCtl('cohort', 'dim', '1'); setFrom(5); setTo(15);
        for (const [a, b, s] of P.windows) if (Math.abs(TDATA.share(1, a, b) - s) > 0.005 || !txt('scales').includes(f2s(s))) out.push('the poster\\'s window ' + a + '-' + b + ' µm (' + s + ') is not shown');
        if (Math.abs(TOPO_DATA.h1.shares.gap - P.gap) > 0.005 || dd('scales', 'The gap') !== +P.gap.toFixed(2)) out.push('the gap ' + dd('scales', 'The gap') + ' is not the poster\\'s ' + P.gap);
        // Cells: every way to show the map, both radii, a cell picked and its network's radius; cell v's score as the data's
        pickTab('cells'); if (X.scene !== 'map') out.push('the Cells tab did not bring up the map');
        for (const [d] of ctlOf('map', 'delta').options) for (const [s] of ctlOf('map', 'show').options) {
          sceneCtl('map', 'delta', d); showView('map', s);
          if (mapDelta() !== +d || mapShow() !== s) out.push('the map\\'s ' + s + ' at ' + d + ' µm not shown');
          if (s === 'split') { const z = TOPO_DATA.slide['comp' + d].sizes; if (!txt('cells').includes(fmt(z[1]) + ' cirrhosis-like and ' + fmt(z[0]) + ' healthy-like')) out.push('the groups at ' + d + ' µm are not ' + z); }
        }
        sceneCtl('map', 'delta', '50'); showView('map', 'cell');
        selectCell(-1); if (!txt('cells').includes('Cell v') || dd('cells', 'Score') !== +TOPO_DATA.slide.e.logOdds.toFixed(2)) out.push('cell v\\'s score reads ' + dd('cells', 'Score') + ', not the data\\'s ' + TOPO_DATA.slide.e.logOdds);
        selectCell(1233); setMR(4.8);
        const lo = TDATA.slide.lo50[1233];
        if (X.cell !== 1233 || X.mr !== 4.8 || !txt('cells').includes('Cell 1,234') || (Number.isFinite(lo) ? Math.abs(dd('cells', 'Score') - lo) > 0.006 : !txt('cells').includes('none'))) out.push('cell 1,234 at 4.8 µm not shown (' + txt('cells').slice(0, 120) + ')');
        if (cellsInfo().rows.some(r => r[1] === '…' || r[1] === 'unpacking…')) out.push('cell 1,234\\'s own bars are not shown');
        // Scenes: every scene's every control; the shared state round trip
        for (const [k] of SCENES) { openScene(k); for (const c of ctlsOf(k)) for (const [v] of c.options) setCtl(k, c.key, v); }
        const st = JSON.stringify(collabState()); collabApply(JSON.parse(st));
        if (JSON.stringify(collabState()) !== st) out.push('apply(state()) changed the state');
        // the headset's panels, every tab
        XR.on = true;
        for (const [k] of TABS) { pickTab(k); for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } }
        XR.on = false;
        // ready to pick: the slides in the space of their scores
        selectCell(-1); selectSlide(-1); pickTab('cohort'); showView('cohort', 'space');
        orbit.cur = view('cohort', viewCam('cohort')); orbit.to = null; Object.assign(XS, exploreTargets());
        return out;
      })()`);
      // picks with the pointer, once the sets have drawn: a slide of the cohort, then a cell of the new slide
      const f0 = window.__frames; await until(() => window.__frames >= f0 + 3, 30000);
      // (the first point on a grid over the scene, beside the side panel, that picks a thing of that kind)
      const pickOn = kind => peek(`(() => { applyCamera(orbit.cur); GL.camera.updateMatrixWorld(); GL.world.updateMatrixWorld(true);
        for (let y = 0.15; y < 0.9; y += 0.03) for (let x = 0.3; x < 0.95; x += 0.03) { const p = pickAt(innerWidth * x, innerHeight * y); if (p && p.${kind} !== undefined) return p; }
        return null; })()`);
      const ps = pickOn('slide');
      if (!ps) out.push('no slide picked in the space of scores');
      else { peek(`(pickText(${JSON.stringify(ps)}), choosePick(${JSON.stringify(ps)}))`); if (peek('X.slide') !== ps.slide) out.push('a slide clicked was not picked'); }
      peek(`(selectSlide(-1), pickTab('cells'), showView('map', 'map'), orbit.cur = view('map', viewCam('map')), orbit.to = null, Object.assign(XS, exploreTargets()))`);
      const f1 = window.__frames; await until(() => window.__frames >= f1 + 3, 30000);
      const pc = pickOn('cell');
      if (!pc) out.push('no cell picked on the map');
      else { peek(`(pickText(${JSON.stringify(pc)}), choosePick(${JSON.stringify(pc)}))`); if (peek('X.cell') !== (pc.cell === peek("api('map').e") ? -1 : pc.cell)) out.push('a cell clicked was not picked'); }
      peek(`(selectCell(-1), sceneCtl('map', 'delta', '50'), pickTab('patch'))`);
      return out;
    });
    if (bad.length) errors.push(...bad.map(b => 'topo: ' + b));
  });
  if (key === 'topo') await step('topo: its links open explore mode on what they say', async () => {
    // (a page of its own: a link differing only in its hash would not load the story again)
    const lp = await browser.newPage({ viewport: { width: 1280, height: 760 } });
    lp.on('pageerror', e => errors.push('topo link: ' + (e.stack || e.message)));
    lp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('topo link: ' + m.text()); });
    // (dd: a row's value read from a pane, as the mutation story's txt reads its text)
    const LINKS = [
      ['tab=patch&r=13.5&tower=on', "X.tab === 'patch' && X.scene === 'tower' && X.r === 13.5 && towerView() === 'tower' && txt('patch').includes('13.50 µm') && dd('patch', 'Pieces') === api('tower').counts(13.5).pieces"],
      ['tab=cohort&dim=1&view=space&slide=17', "X.tab === 'cohort' && X.scene === 'cohort' && cohortView() === 'space' && cohortDim() === 1 && X.slide === 16 && txt('cohort').includes('Slide 17 · ')"],
      ['tab=scales&dim=1&from=5&to=15', "X.tab === 'scales' && cohortView() === 'scales' && cohortDim() === 1 && X.from === 5 && X.to === 15 && Math.abs(dd('scales', 'Adds') - TDATA.share(1, 5, 15)) < 0.006"],
      ['tab=cells&cell=1234&r=4.8&delta=50', "X.tab === 'cells' && X.scene === 'map' && mapShow() === 'cell' && mapDelta() === 50 && X.cell === 1233 && X.mr === 4.8 && txt('cells').includes('Cell 1,234')"],
      ['scene=slide&mode=points', "X.tab === 'scenes' && X.scene === 'slide' && ctlValue('slide', ctlOf('slide', 'look')) === 'points'"],
      ['scene=body&liver=slice', "X.tab === 'scenes' && X.scene === 'body' && ctlValue('body', ctlOf('body', 'liver')) === 'slice'"],
      ['scene=tower&view=up', "X.tab === 'scenes' && X.scene === 'tower' && orbit.cur[1] === view('tower', 'up')[1] && orbit.cur[2] === view('tower', 'up')[2]"],
    ];
    try {
      for (const [h, ok] of LINKS) {
        await lp.goto('about:blank');
        await lp.goto(base + 'index.html#topo&explore&' + h);
        await lp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'topo' && HOST.cur && HOST.cur.peek('APP.mode') === 'explore', null, { timeout: 30000 });
        const shown = await lp.evaluate(ok => HOST.cur.peek(`(() => { const txt = k => document.getElementById('pane-' + k).textContent;
          const dd = (k, name) => { const t = [...document.querySelectorAll('#pane-' + k + ' dt')].find(d => d.textContent === name), v = t && t.nextElementSibling.firstChild;
            return v ? parseFloat(v.textContent.replace('−', '-')) : NaN; };
          return ${ok}; })()`), ok);
        if (!shown) errors.push(`topo: the link #topo&explore&${h} does not show what it says (${await lp.evaluate(() => JSON.stringify(HOST.cur.collab.state()))})`);
      }
    } finally { await lp.close(); }
  });
  if (key === 'pass') await step('pass: both languages and their switch, every explore tool, on the page and in the headset', () => page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms)), peek = src => HOST.cur.peek(src), out = [];
    const panels = () => peek(`(() => { XR.on = true; for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } XR.on = false; return XR.main.regions.map(r => r.id); })()`);
    // every string of the story in both languages
    out.push(...peek(`Object.entries(STR).filter(([k, v]) => !Array.isArray(v) || v.length !== 2 || !v[0] || !v[1]).map(([k]) => 'the string ' + k + ' lacks a language')`));
    // the switch on the story panel (page and headset), and its words everywhere
    peek('(APP.enterStory(narrT(20)), APP.playing = false)'); await sleep(200);
    for (const l of ['de', 'en']) {
      const b = document.querySelector(`#story button[data-lang="${l}"]`);
      if (!b) { out.push('no language switch on the story panel'); break; }
      b.click(); await sleep(100);
      const h1 = document.querySelector('#story h1').textContent, ch = document.querySelector('#track .name').textContent;
      if (peek('LANG') !== l || h1 !== (l === 'de' ? 'Weitersagen!' : 'Pass it on')) out.push(`the switch did not show ${l} (${h1})`);
      if (ch !== peek('CH[1].name') || localStorage.getItem('passLang') !== l) out.push(`the timeline or the remembered language did not follow ${l}`);
      if (!panels().includes('lang:' + (l === 'de' ? 'en' : 'de'))) out.push('no language switch on the headset panel');
    }
    // explore mode: every tool, in both languages, on the page and the headset's panels
    for (const l of ['de', 'en']) out.push(...peek(`(() => {
      const out = [];
      setLang('${l}');
      APP.enterExplore();
      if (!document.querySelector('#explore button[data-lang="${l}"][aria-pressed="true"]')) out.push('no language switch above the explore tabs');
      pickTab('fish');
      for (const k of [1, 2, 3, 7, 12]) { setFishK(k); if (fishK() !== k) out.push('neighbours ' + k + ' not set'); }
      setFishN(600); setFishN(100); setFishN(300);
      setShark(true); GL.sets.fish.steer([0, 1.6, -4]); if (!GL.sets.fish.sharkOn()) out.push('being the shark brought no shark'); setShark(false);
      for (const c of ctlsOf('fish')) for (const [v] of c.options) setCtl('fish', c.key, v);
      setCtl('fish', 'view', 'default'); setFishK(7);
      pickTab('outbreak');
      for (const c of QUICK_START) { setStart(c); if (X.out.start !== c) out.push('start ' + c + ' not set'); }
      setStart('VIE');
      for (const [k, v] of [['inc', 1], ['inc', 21], ['inf', 2], ['inf', 30], ['spread', 'low'], ['spread', 'high'], ['cut', 90], ['cut', 0], ['inc', 5], ['inf', 7], ['spread', 'medium']]) setOut(k, v);
      X.out.click = 'look'; selectCity('SYD'); setDay(20); playOut(true); playOut(false);
      if (api('globe').arrivalDay(outIndex('SYD')) === null) out.push('the outbreak from Vienna never reached Sydney');
      searchList('out', '${l === 'de' ? 'Wien' : 'Vienna'}');
      if (!document.querySelector('[data-res="out"] [data-v="VIE"]')) out.push('the airport search did not find Vienna');
      pickTab('cell');
      for (const s of QUICK_PROT) selectProtein(s);
      for (const m of ['none'].concat(MOVE_KEYS())) { setMove(m); if (ctlVal('cell', 'move') !== m) out.push('move ' + m + ' not set'); }
      searchList('cell', 'CFTR');
      for (const [k] of SCENES) { openScene(k); for (const c of ctlsOf(k)) for (const [v] of c.options) setCtl(k, c.key, v); }
      // picks with a ray: an airport, a protein
      for (const k of ['globe', 'cell']) { openScene(k, false); orbit.cur = view(k, 'default'); orbit.to = null; applyCamera(orbit.cur); GL.camera.updateMatrixWorld(); GL.world.updateMatrixWorld(true);
        let p = null; for (let y = 0.3; y < 0.7 && !p; y += 0.05) p = pickAt(innerWidth * 0.62, innerHeight * y);
        if (!p) out.push('no pick on the ' + k); else { pickText(p); choosePick(p); } }
      const st = JSON.stringify(collabState()); collabApply(JSON.parse(st));
      if (JSON.stringify(collabState()) !== st) out.push('apply(state()) changed the state');
      if ('lang' in collabState() || /"(de|en)"/.test(st)) out.push('the language is in the shared state');
      // the school's place at a station (sea): taken to the centimetre within reach (2 m up or down, 6 m to the side),
      // a bad one ignored, and the same state back when applied again
      for (const [v, want] of [[[0.5, -0.25, 1.2], '[0.5,-0.25,1.2]'], [[1, 2], '[0.5,-0.25,1.2]'], [[0, 'x', 0], '[0.5,-0.25,1.2]'], [[0.004, 5, -8], '[0,2,-6]'], [[0, 0, 0], '[0,0,0]']]) {
        collabApply(Object.assign(JSON.parse(st), { sea: v }));
        const s2 = JSON.stringify(collabState()); collabApply(JSON.parse(s2));
        if (JSON.stringify(collabState().sea) !== want || JSON.stringify(collabState()) !== s2) out.push('the sea ' + JSON.stringify(v) + ' gave ' + JSON.stringify(collabState().sea));
      }
      XR.on = true;
      for (const [k] of TABS) { pickTab(k); for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } }
      XR.on = false;
      selectProtein(-1); selectCity(''); setMove('none'); pickTab('fish');
      return out.map(o => '${l}: ' + o);
    })()`));
    await sleep(300);
    if (out.length) throw new Error(out.join('; '));
  }));
  await page.click('#btnOther');
}
// Each story builds in steps (its LOAD queue, HOST.progress): the reports rise from 0 to the total, the page shows its
// bar and the step under the loading line and hides them once the story is built, no task of the load runs longer than
// LOAD_LIMIT (generous: the machine is slow and SwiftShader compiles each shader in software, one at a time; a quiet
// run's longest was about 0.5 s, a loaded one's 2.9 s), and the shared-room hooks see the scene only once all of it is
// built. A story picked while another builds stops that one's steps and keeps the headset's controllers and place
const LOAD_LIMIT = 4000;
for (const key of ['airports', 'proteins', 'spatial', 'lbi', 'nmd', 'endo', 'pet', 'micro', 'ovary', 'qubits', 'mutation', 'topo', 'pass', 'flock', 'robots', 'design']) await step(`${key}: loads in steps, the page's bar shows and goes`, async () => {
  const built = k => page.waitForFunction(k => HOST.curKey === k && HOST.cur && HOST.cur.collab.scene(), k, { timeout: 60000 });
  if (await page.evaluate(k => HOST.curKey === k, key)) { const o = key === 'flock' ? 'robots' : 'flock'; await page.evaluate(o => HOST.start(o), o); await built(o); }
  const bad = await page.evaluate(async ([k, limit]) => {
    const out = [], rep = [], seen = { bar: false, step: false, early: false }, tasks = [], el = id => document.getElementById(id);
    const po = new PerformanceObserver(l => { for (const e of l.getEntries()) tasks.push(Math.round(e.duration)); });
    try { po.observe({ entryTypes: ['longtask'] }); } catch (e) { /* no long tasks reported here */ }
    const p = HOST.progress, t0 = performance.now();
    HOST.progress = (d, n, l) => {
      p(d, n, l);
      rep.push([d, n]);
      if (getComputedStyle(el('ldBar')).visibility === 'visible' && !el('loading').classList.contains('gone')) seen.bar = true;
      if (el('ldStep').textContent) seen.step = true;
      if (d < n && HOST.curKey === k && HOST.cur && HOST.cur.collab.scene()) seen.early = true;
    };
    try {
      HOST.start(k);
      while (!(HOST.curKey === k && HOST.cur && HOST.cur.collab.scene()) && performance.now() - t0 < 60000) await new Promise(r => setTimeout(r, 30));
      await new Promise(r => setTimeout(r, 900));   // (the loading screen goes 120 ms after the first frame)
    } finally { HOST.progress = p; po.disconnect(); }
    const n = rep.length ? rep[0][1] : 0, ms = HOST.cur.peek('LOAD.ms').map(x => x[1]);
    if (rep.length < 5 || rep[0][0] !== 0) out.push(`${rep.length} progress reports, the first ${JSON.stringify(rep[0])}`);
    if (rep.some((r, i) => r[1] !== n || (i && r[0] < rep[i - 1][0]))) out.push('the reports do not rise steadily to one total: ' + JSON.stringify(rep));
    if (rep.length && rep[rep.length - 1][0] !== n) out.push(`the last report is ${JSON.stringify(rep[rep.length - 1])}, not the total`);
    if (rep.length !== ms.length + 1) out.push(`${rep.length} reports for ${ms.length} steps`);
    if (!seen.bar || !seen.step) out.push(`the page's bar ${seen.bar ? 'showed' : 'never showed'}, its step ${seen.step ? 'showed' : 'never showed'}`);
    if (!el('loading').classList.contains('gone')) out.push('the loading screen did not go');
    if (seen.early) out.push('the shared-room hooks saw the scene before it was all built');
    if (Math.max(0, ...tasks) > limit || Math.max(...ms) > limit) out.push(`a task of ${Math.max(0, ...tasks)} ms (steps up to ${Math.max(...ms)} ms) while it loaded`);
    return out;
  }, [key, LOAD_LIMIT]);
  if (bad.length) errors.push(...bad.map(b => `${key} load: ${b}`));
});
await step('a story picked while another builds: its steps stop, the headset\'s controllers and place stay', async () => {
  const bad = await page.evaluate(async () => {
    const out = [], sleep = ms => new Promise(r => setTimeout(r, ms)), keep = [HOST.inputs, HOST.xrPose], mark = { mark: 1 }, src = { src: 1 };
    try {
      HOST.start('nmd');
      for (let n = 0; n < 600 && !(HOST.curKey === 'nmd' && HOST.cur && HOST.cur.peek('LOAD.i') >= 2); n++) await sleep(10);
      const half = HOST.cur;
      if (!half || HOST.curKey !== 'nmd' || half.collab.scene()) { out.push('could not catch the muscle story half built'); return out; }
      HOST.inputs = [src]; HOST.xrPose = mark;   // (the story before's, as a headset session would have left them)
      HOST.start('flock');
      for (let n = 0; n < 600 && !(HOST.curKey === 'flock' && HOST.cur && HOST.cur.collab.scene()); n++) await sleep(25);
      const i = half.peek('LOAD.i');
      await sleep(300);
      if (!half.peek('LOAD.gone') || half.peek('LOAD.i') !== i || half.peek('LOAD.done')) out.push('the half-built story went on building');
      if (HOST.inputs[0] !== src || HOST.xrPose !== mark) out.push('a half-built story took the controllers or the place with it');
    } finally { [HOST.inputs, HOST.xrPose] = keep; }
    return out;
  });
  if (bad.length) errors.push(...bad.map(b => 'switch while loading: ' + b));
});
// The headset's loading scene with a pretend headset (its frames driven by the test, the renderer's drawing recorded): a
// story that takes a while to build shows a card with its name and a bar 1.2 m in front of you and a little below your
// eyes, and a ring on the left wrist, from 0.4 s on, drawn in a scene of its own (never in the story's, its listeners
// the shell's); it fades out over the story's first frames; in AR the room still shows through (the clear colour stays
// see-through)
{
  const hp = await browser.newPage({ viewport: { width: 640, height: 400 } });
  hp.on('pageerror', e => errors.push('loading scene: ' + (e.stack || e.message)));
  hp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('loading scene: ' + m.text()); });
  await step('headset: the loading scene in front of you and at the wrist, gone as the story starts (VR and AR)', async () => {
    await hp.goto(base + 'index.html#flock');
    await hp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'flock' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    for (const [mode, key] of [['immersive-vr', 'lbi'], ['immersive-ar', 'lbi']]) {
      const bad = await hp.evaluate(async ([mode, key]) => {
        const out = [], sleep = ms => new Promise(r => setTimeout(r, ms)), L = HOST.loading, r = HOST.renderer, xr = r.xr;
        const keep = { render: r.render, sal: xr.setAnimationLoop, ref: xr.getReferenceSpace, mode: HOST.mode }, drawn = [];
        let cb = null;
        r.render = s => { drawn.push(s); };
        xr.setAnimationLoop = f => { cb = f; };   // (the loop three would run on the session's frames)
        xr.getReferenceSpace = () => ({});
        xr.isPresenting = true; HOST.mode = mode;
        r.setClearColor(0x000000, mode === 'immersive-ar' ? 0 : 1);   // (as the story before left it)
        const grip = new THREE.Matrix4().makeTranslation(-0.2, 1.1, -0.3);
        const frame = { session: { inputSources: [{ handedness: 'left', gripSpace: { grip: 1 } }] },
          getViewerPose: () => ({ transform: { position: { x: 0, y: 1.6, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } }),
          getPose: s => (s && s.grip ? { transform: { matrix: grip.elements }, emulatedPosition: false } : null) };
        const near = (a, b, what) => { if (!a || a.some((v, i) => Math.abs(v - b[i]) > 0.01)) out.push(`${what} at ${JSON.stringify(a && a.map(v => +v.toFixed(3)))}, not ${JSON.stringify(b)}`); };
        const t0 = performance.now();
        let early = false, shown = null, alpha = 1, inStory = 0;
        try {
          HOST.start(key);
          while (performance.now() - t0 < 60000 && !(HOST.curKey === key && HOST.cur && HOST.cur.collab.scene())) {
            if (cb) cb(performance.now(), frame);
            const S = L.state();
            if (S.on && S.since < 350 && (S.card || S.ring)) early = true;
            if (S.on && S.since > 700 && S.card && !shown) { shown = S; alpha = r.getClearAlpha(); }
            await sleep(25);
          }
          if (early) out.push('the loading scene showed before 0.4 s');
          if (!shown) out.push('no card while the story built');
          else {
            near(shown.cardAt, [0, 1.45, -1.2], 'the card');
            if (!shown.ring) out.push('no ring at the wrist'); else near(shown.ringAt, [-0.2, 1.15, -0.25], 'the ring');
            if (!drawn.includes(L.parts().scene)) out.push('the loading scene was not drawn');
            if (alpha !== (mode === 'immersive-ar' ? 0 : 1)) out.push(`the clear colour's alpha was ${alpha} while it loaded`);
            HOST.cur.peek('GL.scene').traverse(o => { if (o === L.parts().card || o === L.parts().ring) inStory++; });
            if (inStory) out.push('the loading scene is in the story\'s scene');
            if (HOST_REC.some(([t]) => t === L.parts().card || t === L.parts().card.material || t === L.parts().card.material.map)) out.push('a listener of the loading scene is the story\'s');
            // the story's first frames: the card fades out over them, drawn after them
            if (!L.state().fade) out.push('the card did not fade over the story\'s first frames');
            const d0 = drawn.length;
            for (let i = 0; i < 60 && L.state().fade; i++) { cb(performance.now(), frame); await sleep(25); }
            if (L.state().fade || L.state().card) out.push('the card did not go once the story started');
            if (!drawn.slice(d0).includes(L.parts().scene) || !drawn.slice(d0).includes(HOST.cur.peek('GL.scene'))) out.push('the story and the fading card were not both drawn');
          }
        } finally { r.render = keep.render; xr.setAnimationLoop = keep.sal; xr.getReferenceSpace = keep.ref; xr.isPresenting = false; HOST.mode = keep.mode; }
        return out;
      }, [mode, key]);
      if (bad.length) errors.push(...bad.map(b => `loading scene (${mode}): ${b}`));
      await hp.evaluate(() => HOST.start('flock'));
      await hp.waitForFunction(() => HOST.curKey === 'flock' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    }
  });
  await hp.close();
}
// The design room (#design, not one of the stories: not on the Stories screen): every miniature built on the table, a
// click putting one on the stage with its card as tools/design/props.json has it, the shared state (a miniature moved
// by a pretend headset's grip, both grips sizing it, apply(state()) giving the same state back, Tidy), the headset panels
await step('design: not on the Stories screen; #design opens the table and all 45 miniatures are built', async () => {
  if (await page.$('#picker [data-story="design"]')) errors.push('design: the design room has a card on the Stories screen');
  if (await page.evaluate(() => HOST.list.some(s => s.key === 'design') || HOST.count() !== 'fifteen')) errors.push('design: the design room is in the list of stories');
  await page.evaluate(() => HOST.start('design'));
  await page.waitForFunction(() => HOST.curKey === 'design' && HOST.cur && HOST.cur.peek('typeof GL !== "undefined" && !!XR.panelGroup && GL.sets.table.built() === GL.sets.table.total()'), null, { timeout: 60000 });
  const n = await page.evaluate(() => [HOST.cur.peek('GL.sets.table.total()'), HOST.cur.peek('APP.mode'), location.hash, document.title]);
  if (n[0] !== 45 || n[1] !== 'explore' || n[2] !== '#design' || !/design room/i.test(n[3])) errors.push('design: ' + JSON.stringify(n) + ' (not 45 miniatures in explore mode at #design)');
});
await step('design: a click on a miniature puts it on the stage, its card matching props.json', async () => {
  const fs = await import('fs');
  const props = JSON.parse(fs.readFileSync(new URL('./design/props.json', import.meta.url), 'utf8'));
  await page.evaluate(() => HOST.cur.peek('(showView("default"), orbit.cur = orbit.to, orbit.to = null, 0)'));
  await page.waitForTimeout(400);
  // a miniature the mouse can reach (clear of the side panel), found by the same ray as the click
  const at = await page.evaluate(() => HOST.cur.peek(`(() => { const pr = $('#panel').getBoundingClientRect();
    for (const k of GL.sets.table.keys()) { const m = GL.sets.table.mini(k), v = m.holder.getWorldPosition(new THREE.Vector3()); v.y += 0.05; v.project(GL.camera);
      const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
      if (x > pr.right + 30 && x < innerWidth - 30 && y > 80 && y < innerHeight - 80 && miniAt(x, y) === k && GL.sets.table.plateOf(DESIGN_CARDS[k].story)) return [k, x, y]; }
    return null; })()`));
  if (!at) { errors.push('design: no miniature to click in view'); return; }
  await page.mouse.move(at[1], at[2]); await page.waitForTimeout(150);
  if (await page.evaluate(() => HOST.cur.peek('GL.sets.table.hovered()')) !== at[0]) errors.push('design: the mouse over ' + at[0] + ' did not light it');
  await page.mouse.click(at[1], at[2]); await page.waitForTimeout(300);
  const got = await page.evaluate(() => { const c = document.querySelector('#pane-prop .dz-card'); return { pick: HOST.cur.peek('X.pick'), tab: HOST.cur.peek('X.tab'), stage: HOST.cur.peek('!!GL.sets.table.stageModel()'),
    card: c && { key: c.dataset.key, params: +c.dataset.params, views: +c.dataset.views, text: c.textContent, rows: c.querySelectorAll('.dz-params tr').length, li: c.querySelectorAll('.dz-views li').length } }; });
  if (got.pick !== at[0] || got.tab !== 'prop' || !got.stage || !got.card || got.card.key !== at[0]) errors.push('design: the click did not put ' + at[0] + ' on the stage with its card: ' + JSON.stringify(got).slice(0, 300));
  // every card against the catalogue: params, views and the source file (the hand-written stories: none, their file)
  const bad = await page.evaluate(() => HOST.cur.peek(`(() => { const out = []; for (const k of CARD_KEYS) { pickProp(k); const c = document.querySelector('#pane-prop .dz-card');
    out.push([k, +c.dataset.params, +c.dataset.views, c.querySelectorAll('.dz-params tr').length, c.querySelectorAll('.dz-views li').length, c.textContent.includes(DESIGN_CARDS[k].file)]); } return out; })()`));
  for (const [k, np, nv, rows, li, file] of bad) {
    const [st, key] = k.split('.'), e = props.sets.find(x => x.story === st && x.key === key), hw = props.handwrittenStories.find(x => x.story === st);
    const want = e ? [e.params.length, e.views.length, e.file] : hw ? [0, 0, hw.file] : null;
    if (!want || np !== want[0] || nv !== want[1] || rows !== np || li !== nv || !file) errors.push(`design: ${k}'s card has ${np} params (${rows} rows), ${nv} views (${li}), file shown ${file}; props.json: ${JSON.stringify(want)}`);
  }
  await page.evaluate(k => HOST.cur.peek(`pickProp('${k}')`), at[0]);
});
await step('design: a pretend headset picks a miniature up, both grips size it; shared state, apply and Tidy', async () => {
  const bad = await page.evaluate(() => HOST.cur.peek(`(() => {
    const out = [], T = GL.sets.table, k = 'pet.scan', m = T.mini(k), same = () => { const a = JSON.stringify(collabState()); collabApply(JSON.parse(a)); return JSON.stringify(collabState()) === a; };
    T.tidy(); for (let i = 0; i < 200; i++) T.update(XS, 0, 0.05);
    if (Object.keys(collabState()).join() !== 'pick' || !same()) out.push('at rest the state is not just the pick, or apply changed it: ' + JSON.stringify(collabState()));
    XR.on = true; GL.world.updateMatrixWorld(true);
    const ctl = (c, p) => { c.src = { targetRayMode: 'tracked-pointer', gamepad: null }; c.g.visible = true; c.g.matrix.compose(new THREE.Vector3(...p), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); c.o.setFromMatrixPosition(c.g.matrix); };
    const [a, b] = XR.ctrls, w0 = m.holder.getWorldPosition(new THREE.Vector3());
    ctl(a, [w0.x, w0.y + 0.2, w0.z + 0.3]); a.hover = { kind: 'mini', key: k }; xrGrab(a, true);
    if (!a.grab || a.grab.key !== k) out.push('the grip did not take the miniature');
    ctl(a, [w0.x + 0.3, w0.y + 0.4, w0.z + 0.3]); carry(a, 0.016);
    const w1 = m.holder.getWorldPosition(new THREE.Vector3());
    if (Math.abs(w1.x - w0.x - 0.3) > 1e-3 || Math.abs(w1.y - w0.y - 0.2) > 1e-3) out.push('the miniature did not follow the hand: moved ' + w1.clone().sub(w0).toArray().map(v => v.toFixed(3)));
    const s1 = collabState()[k];
    if (!s1 || !same()) out.push('a miniature in the hand is not in the state, or apply changed it: ' + JSON.stringify(s1));
    // the other hand takes it too: both size it with the distance between them
    ctl(b, [w1.x + 0.1, w1.y, w1.z]); b.hover = { kind: 'mini', key: k }; xrGrab(b, true);
    ctl(a, [w1.x - 0.1, w1.y, w1.z]); carry(a, 0.016); carry(b, 0.016);
    ctl(b, [w1.x + 0.2, w1.y, w1.z]); ctl(a, [w1.x - 0.2, w1.y, w1.z]); carry(a, 0.016); carry(b, 0.016);
    if (Math.abs(m.s - 2) > 0.01) out.push('both grips did not size it twice as big: ' + m.s);
    xrGrab(b, false); xrGrab(a, false);
    const r = m.rec;
    if (!r || Math.abs(r[7] - 2) > 0.01 || m.carry) out.push('let go, it did not stay where it was put: ' + JSON.stringify(r));
    for (let i = 0; i < 30; i++) T.update(XS, 0, 0.05);
    if (!same() || JSON.stringify(collabState()[k]) !== JSON.stringify(r)) out.push('the moved miniature: its state does not come back the same');
    // from the room: another miniature moved, and back home
    const st = collabState(); st['flock.flock'] = [0.5, 1.2, 0.4, 0, 0, 0, 1, 1.5]; collabApply(st);
    if (JSON.stringify(collabState()['flock.flock']) !== '[0.5,1.2,0.4,0,0,0,1,1.5]' || !same()) out.push('a miniature moved in the room was not taken');
    collabApply({ pick: 'lbi.atp' });
    if (collabState().pick !== 'lbi.atp' || 'flock.flock' in collabState() || k in collabState()) out.push('a state from the room without the moved miniatures did not send them home: ' + JSON.stringify(collabState()));
    collabApply(st); tidyTable();
    if (Object.keys(collabState()).join() !== 'pick') out.push('Tidy left moved miniatures in the state');
    // bad values are ignored
    const was = JSON.stringify(collabState());
    collabApply({ pick: 'nope.nope', 'pet.scan': [1, 2, 3], 'lbi.int': [0, 0, 0, 0, 0, 0, 0, 9] });
    if (JSON.stringify(collabState()) !== was) out.push('bad values were taken: ' + JSON.stringify(collabState()));
    for (const c of XR.ctrls) { c.src = null; c.g.visible = false; c.hover = null; c.grab = null; }
    XR.on = false; setHover(null);
    return out;
  })()`));
  if (bad.length) errors.push(...bad.map(b => 'design: ' + b));
});
await step('design: explore mode and headset panels', () => page.evaluate(() => HOST.cur.peek(`(() => {
  APP.enterExplore();
  document.querySelectorAll('.tabs button').forEach(b => b.click());
  XR.on = true;
  for (const tab of ['prop', 'all']) { pickTab(tab); for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } }
  if (XR.main.regions.some(r => r.id === 'exit')) throw new Error('Exit is on the story panel (it belongs in the menu on the left wrist)');
  if (!XR.main.regions.some(r => r.id === 'pick:lbi.int') && !XR.main.regions.some(r => r.id.startsWith('pick:'))) throw new Error('no props to pick on the headset panel');
  XR.stories = true;
  for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); }
  XR.soundCheck = true; xrUpdate(storyState(0));
  for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); }
  if (!XR.snd.mesh.visible || XR.land[1].mesh.visible) throw new Error('Sound check panel not shown in place of the cards');
  XR.soundCheck = false; XR.stories = false; XR.on = false;
  APP.enterStory(0); APP.seek(T_END - 0.1); APP.playing = true;
})()`)));
await step('design: the intro ends at the table', async () => {
  await page.waitForFunction(() => HOST.cur.peek('APP.mode') === 'explore', null, { timeout: 20000 }).catch(() => errors.push('design: the intro did not end in explore mode'));
  await page.evaluate(() => HOST.openPicker());
});
// Repeat on the Stories screen: one story again and again, or all of them in turn (the last leads to the first)
await step('Repeat one and Repeat all', async () => {
  const ready = k => page.waitForFunction(k => HOST.curKey === k && !HOST.picking && HOST.cur && HOST.cur.collab.scene() && HOST.cur.peek('typeof ST !== "undefined" && ST.items.length > 0'), k, { timeout: 30000 });
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
  await page.click('#picker [data-story="robots"]');
  await ready('robots'); await toEnd();
  await playsFromTop('airports', 'Repeat all did not go from the last story to the first');
  await page.click('#btnOther');
  await page.click('#picker [data-repeat="all"]');
  if (await page.evaluate(() => HOST.repeat) !== 'off') errors.push('pressing the lit Repeat button did not turn it off');
});
// Anchored mode with a pretend headset: a room whose tracking origin can jump (recentring) and
// anchors that keep their place in it, saved under a handle (Quest's persistent anchors)
for (const key of ['airports', 'proteins', 'spatial', 'lbi', 'nmd', 'endo', 'pet', 'micro', 'ovary', 'qubits', 'mutation', 'topo', 'pass', 'flock', 'robots']) await step(`${key}: anchored placement`, async () => {
  await page.evaluate(k => HOST.start(k), key);
  await page.waitForFunction(k => HOST.curKey === k && HOST.cur && HOST.cur.collab.scene() && HOST.cur.peek('typeof ST !== "undefined" && ST.items.length > 0'), key, { timeout: 30000 });
  const bad = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms)), out = [];
    const grip = ['flock', 'robots'].includes(HOST.curKey) ? 'panel' : 'globe';   // in the flock and the robot gang the grip moves only the panel
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
      peek(`(XR.stories = false, XR.ctrls[0].hover = { kind: "${grip}", i: -1 }, xrGrab(XR.ctrls[0], true))`);
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
      peek(`(XR.stories = false, XR.ctrls[0].hover = { kind: "${grip}", i: -1 }, xrGrab(XR.ctrls[0], true))`);
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
// The headset's two settings (the shell's menu, for every story; in a shared room the room's): labels on top
// (sprites and the story panels over everything), in 3D (upright signs in the scene, depth-tested, turned to you, and
// the story panels in the scene as they are) or hidden (none, and no story panel at all, in story and explore mode),
// and free moving (the grip holds the scene and the panel like a real object, what
// you hold staying in your hand). Everything in 3D by default, kept across a reload, set by a link. In a page of its
// own (its own storage, as a new device), with a pretend headset whose frames the test drives: a scene story
// (qubits), a life-size one (flock) and a hand-written one (airports)
{
  const sp = await browser.newPage({ viewport: { width: 640, height: 400 } });
  sp.on('pageerror', e => errors.push('settings: ' + (e.stack || e.message)));
  sp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('settings: ' + m.text()); });
  const sx = s => sp.evaluate(s => HOST.cur.peek(s), s);
  const tick = n => sp.evaluate(n => window.__tick(n), n || 1);
  const qa = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]))) * 180 / Math.PI;   // degrees between two turns
  const setLook = (l, f) => sp.evaluate(([l, f]) => { if (l) HOST.xr.setLabels(l); if (f !== undefined) HOST.xr.setFree(f); }, [l, f]);
  const head = (p, yaw) => sp.evaluate(([p, yaw]) => { window.__head = { p, q: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)] }; }, [p, yaw || 0]);
  // a story with the pretend headset: its own frame loop stopped; one headset frame as its frame() runs it while
  // presenting, then the shell's own frame callback (where the menu is drawn)
  const openXR = async (key, hash) => {
    await sp.goto('about:blank');
    await sp.goto(base + 'index.html#' + key + (hash || ''));
    await sp.waitForFunction(k => typeof HOST !== 'undefined' && HOST.curKey === k && HOST.cur && HOST.cur.peek('typeof ST !== "undefined" && ST.items.length > 0 && !!XR.panelGroup'), key, { timeout: 30000 });
    await sp.evaluate(() => {
      window.__head = { p: [0, 1.6, 0], q: [0, 0, 0, 1] };
      const pose = () => { const h = window.__head; return { transform: { position: { x: h.p[0], y: h.p[1], z: h.p[2] }, orientation: { x: h.q[0], y: h.q[1], z: h.q[2], w: h.q[3] } } }; };
      window.__frame = { getViewerPose: pose };
      window.__raf = [];
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
            const hand = typeof xrPlaceGlobe === 'function', pn = performance.now();   // (the hand-written stories place their scene so)
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
  };
  // the scene's labels as the headset shows them: sprites on top, signs in 3D (depth-tested, upright, turned to you)
  const LABELS = `(() => {
    const look = P => { const m = P.mesh.material; return { vis: P.mesh.visible, dt: m.depthTest, dw: m.depthWrite, at: m.alphaTest, ro: P.mesh.renderOrder, v: m.version }; };
    const all = [...ST.labels, ...(LBL.sets || []), ...LBL.extra], q = new THREE.Quaternion(), up = new THREE.Vector3();
    const sp = all.filter(L => L.sprite && L.sprite.visible), sg = all.filter(L => L.sign && L.sign.visible);
    const face = L => { const c = L.sign.getWorldPosition(new THREE.Vector3()), n = new THREE.Vector3(0, 0, 1).applyQuaternion(L.sign.getWorldQuaternion(q)), h = XR.head.clone().sub(c);
      n.y = 0; h.y = 0; return h.length() < 0.01 ? 0 : n.angleTo(h) * 180 / Math.PI; };
    return { sprites: sp.length, signs: sg.length, onTop: sp.every(L => !L.sprite.material.depthTest), inDepth: sg.every(L => L.sign.material.depthTest),
      q: sg.map(L => L.sign.getWorldQuaternion(q).toArray()), up: Math.min(1, ...sg.map(L => up.set(0, 1, 0).applyQuaternion(L.sign.getWorldQuaternion(q)).y)),
      face: Math.max(0, ...sg.map(face)), main: XR.main.mesh.visible, foot: XR.foot.mesh.visible, panels: [XR.main, XR.foot].map(look), land: XR.land.concat(XR.snd).map(look) };
  })()`;
  const labels = () => sx(LABELS);
  // the story panels (text, foot) in each label mode: on top as before (drawn over everything), in 3D in the scene as
  // the labels' signs are (depth-tested, writing depth, drawn first of the see-through things, the clear corners cut
  // away), hidden not drawn at all; the Stories screen's panels stay on top in every mode
  const PANEL = { face: p => p.vis && !p.dt && !p.dw && !p.at && p.ro === 50, fixed: p => p.vis && p.dt && p.dw && p.at > 0 && p.ro === -1, hidden: p => !p.vis };
  const landOnTop = L => L.land.every(p => !p.dt && !p.dw && !p.at && p.ro === 50);
  // what a controller 0.6 m in front of a story panel, pointed at its middle, hovers ('panel:main', 'panel:foot', or
  // whatever else it reaches)
  const pointAt = async which => {
    await sx(`(() => { const P = XR.${which}, c = XR.ctrls[0]; GL.scene.updateMatrixWorld(true);
      const p = P.mesh.getWorldPosition(new THREE.Vector3()), n = new THREE.Vector3(0, 0, 1).applyQuaternion(P.mesh.getWorldQuaternion(new THREE.Quaternion()));
      c.src = { targetRayMode: 'tracked-pointer', gamepad: null }; c.g.visible = true;
      c.g.matrix.compose(p.clone().addScaledVector(n, 0.6), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), n.clone().negate()), new THREE.Vector3(1, 1, 1));
      c.g.matrixWorld.copy(c.g.matrix); return 0; })()`);
    await tick(1);
    const h = await sx(`(h => h ? h.kind + (h.kind === 'panel' ? (h.P === XR.main ? ':main' : h.P === XR.foot ? ':foot' : ':other') : '') : 'none')(XR.ctrls[0].hover)`);
    await sx('(XR.ctrls[0].src = null, XR.ctrls[0].g.visible = false, XR.ctrls[0].hover = null, 0)'); await tick(1);
    return h;
  };
  const pointBoth = async () => [await pointAt('main'), await pointAt('foot')];
  // the controller i at p (in the room; the rig stands at the head, facing -z), turned yaw and pitched, in degrees
  const ctrl = (i, p, yaw, pitch) => sx(`(() => { const c = XR.ctrls[${i}]; c.src = { targetRayMode: 'tracked-pointer', gamepad: null }; c.g.visible = true;
    c.g.matrix.compose(new THREE.Vector3(${p.join(',')}), new THREE.Quaternion().setFromEuler(new THREE.Euler(${(pitch || 0) * Math.PI / 180}, ${(yaw || 0) * Math.PI / 180}, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
    c.g.matrixWorld.copy(c.g.matrix); })()`);
  const grab = (i, kind, on) => sx(`(c => { c.hover = ${kind === 'panel' ? '{ kind: "panel", P: XR.main }' : `{ kind: "${kind}", i: -1 }`}; xrGrab(c, ${on}); return !!c.grab; })(XR.ctrls[${i}])`);
  const POSE = `(() => { GL.scene.updateMatrixWorld(true); return { wq: GL.world.getWorldQuaternion(new THREE.Quaternion()).toArray(), rot: XR.rot.toArray(),
    pq: XR.panelGroup.quaternion.toArray(), up: new THREE.Vector3(0, 1, 0).applyQuaternion(XR.panelGroup.quaternion).y }; })()`;

  // each label mode, at the moment with the most labels (the flock: explore mode with a falcon)
  const labelModes = async key => {
    const bad = [];
    if (key === 'flock') {   // (the falcon's label shows once it is on its way)
      await setLook('face'); await sx('(APP.enterExplore(), sendFalcon([0.2, 0.1, -1]), 0)');
      for (let k = 0; k < 100 && !(await labels()).sprites; k++) await tick(1);
    }
    else {
      await setLook('face'); await tick(1);
      const t = await sp.evaluate(() => { let bt = 0, bn = -1;
        for (let t = 5; t < HOST.cur.peek('T_END'); t += 5) {
          HOST.cur.peek(`(APP.seek(${t}), APP.playing = false)`); window.__tick(1);
          const n = HOST.cur.peek('[...ST.labels, ...(LBL.sets || [])].filter(L => L.sprite && L.sprite.visible).length');
          if (n > bn) { bn = n; bt = t; }
        }
        return bt; });
      await sx(`(APP.seek(${t}), APP.playing = false)`);
    }
    const story = await sx('APP.mode') === 'story', where = story ? 'story' : 'explore';
    await setLook('face'); await tick(3);
    const F = await labels();
    if (!(F.sprites > 0 && !F.signs && F.onTop)) bad.push(`on top: ${F.sprites} sprites (over everything: ${F.onTop}), ${F.signs} signs`);
    if (!F.panels.every(PANEL.face)) bad.push(`on top (${where}): the story panels are not drawn over everything as before: ${JSON.stringify(F.panels)}`);
    await setLook('fixed'); await tick(3);
    const D1 = await labels();
    if (!(D1.signs === F.sprites && !D1.sprites && D1.inDepth && D1.up > 1 - 1e-6 && D1.face < 1)) bad.push(`in 3D: ${D1.signs} signs for ${F.sprites} labels, ${D1.sprites} sprites, depth-tested ${D1.inDepth}, upright ${D1.up}, turned to you within ${D1.face} deg`);
    if (!D1.panels.every(PANEL.fixed)) bad.push(`in 3D (${where}): the story panels are not in the scene: ${JSON.stringify(D1.panels)}`);
    if (!landOnTop(D1)) bad.push('in 3D: the Stories screen\'s panels are not on top: ' + JSON.stringify(D1.land));
    // the head moves 0.67 m sideways and turns: each sign turns to it again, upright
    await head([0.6, 1.6, 0.3], 0.5); await tick(3);
    const D2 = await labels();
    if (!(D2.signs === D1.signs && D2.inDepth && D2.up > 1 - 1e-6 && D2.face < 1)) bad.push(`in 3D, the head moved sideways: ${D2.signs} signs, turned to you within ${D2.face} deg (turned ${Math.max(0, ...D2.q.map((q, i) => qa(q, D1.q[i] || q))).toFixed(2)} deg), upright ${D2.up}`);
    // (the panels' materials are built again only when the mode changes, not every frame)
    if (!D2.panels.every((p, i) => p.v === D1.panels[i].v)) bad.push(`in 3D: the story panels' materials were built again with no change of mode (${D1.panels.map(p => p.v)} -> ${D2.panels.map(p => p.v)})`);
    await head([0, 1.6, 0]); await tick(1);
    // the pointer reaches each panel in 3D (the ray order is as on top)
    const hitD = await pointBoth();
    if (hitD.join() !== 'panel:main,panel:foot') bad.push(`in 3D (${where}): a ray at each story panel's middle hovers ${hitD}`);
    await setLook('hidden'); await tick(3);
    const H = await labels(), hitH = await pointBoth();
    if (!(!H.sprites && !H.signs && !H.main && !H.foot)) bad.push(`hidden (${where}): ${H.sprites + H.signs} labels, text panel shown ${H.main}, foot ${H.foot}`);
    if (hitH.some(h => h.startsWith('panel'))) bad.push(`hidden (${where}): a ray at a hidden story panel hovers ${hitH}`);
    if (story) {
      // A or X still plays and pauses with no panel
      const btn = on => sx(`(() => { const c = XR.ctrls[0]; c.src = { targetRayMode: 'tracked-pointer', gamepad: { axes: [0, 0, 0, 0], buttons: [0, 1, 2, 3, 4].map(i => ({ pressed: i === 4 && ${on}, touched: false, value: 0 })) } }; c.g.visible = true; return 0; })()`);
      const was = await sx('APP.playing');
      await btn(true); await tick(1); await btn(false); await tick(1);
      const now = await sx('APP.playing');
      await sx('(APP.playing = false, XR.ctrls[0].src = null, XR.ctrls[0].g.visible = false, XR.ctrls[0].hover = null, 0)'); await tick(1);
      if (!(was === false && now === true)) bad.push(`hidden: A or X does not play with the panels gone (${was} -> ${now})`);
      await sx('APP.enterExplore()'); await tick(3);
      const HX = await labels(), hitX = await pointBoth();
      if (!(!HX.sprites && !HX.signs && !HX.main && !HX.foot)) bad.push(`hidden in explore mode: ${HX.sprites + HX.signs} labels, its panels ${HX.main} ${HX.foot}`);
      if (hitX.some(h => h.startsWith('panel'))) bad.push(`hidden in explore mode: a ray at a hidden panel hovers ${hitX}`);
    }
    // back from hidden (now in explore mode): the panels show again, in the scene in 3D and over everything on top
    await setLook('fixed'); await tick(3);
    const B1 = await labels();
    if (!B1.panels.every(PANEL.fixed)) bad.push(`in 3D again (explore): the story panels are not back in the scene: ${JSON.stringify(B1.panels)}`);
    await setLook('face'); await tick(3);
    const B2 = await labels(), hitB = await pointBoth();
    if (!B2.panels.every(PANEL.face) || !landOnTop(B2)) bad.push(`on top again (explore): the story panels are not drawn over everything: ${JSON.stringify(B2.panels)}`);
    if (hitB.join() !== 'panel:main,panel:foot') bad.push(`on top again (explore): a ray at each story panel's middle hovers ${hitB}`);
    // the pointer's tip stays a sprite on top in every mode
    const tip = await sx(`(() => { const L = { set: typeof SET_ORDER !== 'undefined' ? SET_ORDER[0] : '', at: [0, 0, 0], i: 0, txt: ['Tip', 'here', 'tip'] }, was = XR.tip, out = [];
      XR.tip = L; for (const m of ['fixed', 'hidden', 'face']) { XR.lm = m; placeLabelXR(L, 1, XS); out.push(!!(L.sprite && L.sprite.visible) && !L.sign); }
      dropSprite(L); XR.tip = was; XR.lm = xrLabelMode(); return out; })()`);
    if (!tip.every(Boolean)) bad.push(`the pointer's tip is not a sprite in every mode (${tip})`);
    return bad;
  };
  // free moving with the grip: a scene story's scene turns with the hand (what you hold stays in it), stays when let
  // go, and faces you again with free moving off; the panel tilts with the hand. A life-size story moves only its panel
  const freeMoving = async key => {
    const bad = [], life = key === 'flock';
    await setLook('fixed', true);
    await sx(`(APP.enterExplore(), orbit.to = null, typeof setTurn === 'function' && setTurn('off'), xrRecenter(), 0)`); await tick(3);
    if (life) {
      await ctrl(0, [0.25, 1.4, -0.9]); await tick(1);
      if (await grab(0, 'sky', true)) bad.push('the grip took the sky');
      const w0 = await sx(POSE);
      if (qa(w0.wq, [0, 0, 0, 1]) > 1e-6) bad.push('the flock\'s world is turned');
    } else {
      await ctrl(0, [0.25, 1.4, -0.9]); await tick(1);
      const g = await grab(0, 'globe', true), p0 = await sx(POSE);
      await sx('(GL.scene.updateMatrixWorld(true), window.__held = GL.world.worldToLocal(XR.ctrls[0].o.clone()), 0)');
      // the hand turns 90 degrees about the vertical as it moves
      for (let k = 1; k <= 6; k++) { await ctrl(0, [0.25 + 0.05 * k, 1.4 + 0.02 * k, -0.9 + 0.03 * k], 15 * k); await tick(1); }
      const p1 = await sx(POSE), d = await sx('(GL.scene.updateMatrixWorld(true), GL.world.localToWorld(window.__held.clone()).distanceTo(XR.ctrls[0].o))');
      const want = await sx(`new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2).multiply(new THREE.Quaternion().fromArray(${JSON.stringify(p0.wq)})).toArray()`);
      if (!g || Math.abs(qa(p0.wq, p1.wq) - 90) > 0.05 || qa(p1.wq, want) > 0.05 || d > 0.01)
        bad.push(`the hand turned 90 degrees: the scene turned ${qa(p0.wq, p1.wq).toFixed(3)} deg (${qa(p1.wq, want).toFixed(3)} from 90 about the vertical), the point held ${(d * 100).toFixed(2)} cm from the hand`);
      // let go, it stays
      await grab(0, 'globe', false); await ctrl(0, [0, 1.2, -0.3], -40); await tick(4);
      const p2 = await sx(POSE);
      if (qa(p2.wq, p1.wq) > 0.01) bad.push(`let go, the scene turned on by ${qa(p2.wq, p1.wq).toFixed(3)} deg`);
      const pr = await sx('HOST.cur.xrPose().rot.toArray()');
      if (qa(pr, p2.rot) > 1e-6) bad.push('xrPose().rot is not the scene\'s turn');
      // free moving off: no turn of its own, and it faces you again (from where it is, as before free moving)
      await setLook(null, false); await tick(2);
      const p3 = await sx(`(() => { const g = XR.globeBase.clone().add(XR.globeOff).negate().normalize(), f = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), g);
        return { rot: XR.rot.toArray(), w: GL.world.quaternion.toArray(), old: f.multiply(_xq).toArray() }; })()`);
      if (qa(p3.rot, [0, 0, 0, 1]) > 1e-6 || qa(p3.w, p3.old) > 1e-3) bad.push(`free moving off: a turn of ${qa(p3.rot, [0, 0, 0, 1]).toFixed(3)} deg left, ${qa(p3.w, p3.old).toFixed(4)} deg from facing you`);
      // ...and with it off a grab turns nothing
      await ctrl(0, [0.25, 1.4, -0.9]); await tick(1); await grab(0, 'globe', true);
      for (let k = 1; k <= 3; k++) { await ctrl(0, [0.25 + 0.05 * k, 1.4, -0.9], 30 * k); await tick(1); }
      if (qa(await sx('XR.rot.toArray()'), [0, 0, 0, 1]) > 1e-6) bad.push('free moving off, the grip turned the scene');
      await grab(0, 'globe', false);
      await setLook(null, true); await tick(1);
    }
    // the panel held and turned (20 degrees, pitched 30) tilts with the hand and stays so; free moving off, upright again
    await ctrl(0, [-0.4, 1.5, -0.7]); await tick(1); await grab(0, 'panel', true);
    await ctrl(0, [-0.35, 1.55, -0.7], 20, 30); await tick(2);
    await grab(0, 'panel', false); await tick(3);
    const pn = await sx(POSE), tilt = Math.acos(Math.min(1, pn.up)) * 180 / Math.PI, pq = await sx('HOST.cur.xrPose().pq.toArray()');
    if (!(tilt > 25 && tilt < 35) || qa(pq, pn.pq) > 1e-6) bad.push(`the panel held and turned tilts ${tilt.toFixed(2)} deg (xrPose().pq ${qa(pq, pn.pq).toFixed(4)} deg from it)`);
    if (life && qa((await sx(POSE)).wq, [0, 0, 0, 1]) > 1e-6) bad.push('the flock\'s world turned with the panel');
    await setLook(null, false); await tick(2);
    if (Math.abs((await sx(POSE)).up - 1) > 1e-6) bad.push('free moving off, the panel does not stand upright again');
    await setLook(null, true);
    await sx('(XR.ctrls[0].src = null, XR.ctrls[0].g.visible = false, XR.ctrls[0].hover = null, 0)');
    return bad;
  };

  // a new device: everything in 3D; the menu's two buttons go round (Labels: in 3D, hidden, on top; Moving: free,
  // facing you), the story follows, and the choice is kept across a reload; a link sets them
  await step('headset settings: everything in 3D by default; the menu\'s two buttons go round, kept across a reload, set by a link', async () => {
    const bad = [];
    await openXR('qubits');
    const d0 = await sp.evaluate(() => [HOST.xr.labels(), HOST.xr.free(), HOST.cur.peek('XR.lm'), HOST.cur.peek('XR.free'), localStorage.getItem('xrLabels')]);
    if (!(d0[0] === 'fixed' && d0[1] === true && d0[2] === 'fixed' && d0[3] === true && d0[4] === null)) bad.push('the defaults are not labels in 3D and free moving: ' + JSON.stringify(d0));
    await sp.evaluate(() => HOST.collab.panelOpen(true)); await tick(2);
    const press = async id => { await tick(2); const ok = await sp.evaluate(id => { const r = HOST.collab.overlay().panel.regions.find(x => x.id === id); if (r && r.fn) r.fn(); return !!(r && r.fn); }, id); await tick(2); return ok; };
    const seen = [];
    for (let k = 0; k < 3; k++) { if (!await press('labels')) { bad.push('no Labels button in the menu'); break; } seen.push(await sp.evaluate(() => HOST.xr.labels() + '/' + HOST.cur.peek('XR.lm'))); }
    if (seen.join() !== 'hidden/hidden,face/face,fixed/fixed') bad.push('Labels went ' + seen.join(', ') + ' (not hidden, on top, in 3D, with the story following)');
    if (!await press('free') || await sp.evaluate(() => HOST.xr.free() || HOST.cur.peek('XR.free'))) bad.push('Moving did not turn free moving off');
    await press('labels');
    await sp.reload(); await sp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.xr && HOST.curKey === 'qubits', null, { timeout: 30000 });
    const kept = await sp.evaluate(() => [HOST.xr.labels(), HOST.xr.free()]);
    if (kept[0] !== 'hidden' || kept[1] !== false) bad.push('not kept across a reload: ' + kept);
    await sp.goto('about:blank'); await sp.goto(base + 'index.html#qubits&labels=face&free=on');
    await sp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.xr && HOST.curKey === 'qubits', null, { timeout: 30000 });
    const link = await sp.evaluate(() => [HOST.xr.labels(), HOST.xr.free(), HOST.xr.sig()]);
    if (link.join() !== 'face,true,face+') bad.push('#labels=face&free=on gave ' + link);
    await setLook('fixed', true);
    if (bad.length) errors.push(...bad.map(b => 'settings: ' + b));
  });
  for (const key of ['qubits', 'flock', 'airports']) await step(`${key}: labels and story panels on top, in 3D and hidden in the headset; free moving with the grip`, async () => {
    await openXR(key);
    const bad = (await labelModes(key)).concat(await freeMoving(key));
    if (bad.length) errors.push(...bad.map(b => `${key}: ${b}`));
  });
  // subtitles, the third setting: off by default (nothing drawn); on through the menu's row, kept across a reload, set by
  // a link; the strip shows the words of the line on show, changes as the clock moves on (within a line too), holds while
  // paused and shows nothing in explore mode; it stays for a small turn of the head and follows a larger one with lag;
  // the pass story's in German. Every story gives its line (the caption hook)
  await step('subtitles in the headset: off by default; on through the menu, kept, set by a link; the line on show in step with the clock; following the head with lag; German', async () => {
    const bad = [];
    const SUB = () => sp.evaluate(() => { const S = HOST.collab.overlay().sub, U = HOST.collab.subtitles.state(), m = S.mesh.material;
      return { vis: S.mesh.visible, text: S.text, want: S.want, id: S.wantId, op: m.opacity, top: !m.depthTest && S.mesh.renderOrder > 50, dir: U.dir.toArray() }; });
    const settle = async (n = 8) => { for (let k = 0; k < n; k++) { await sp.waitForTimeout(50); await tick(1); } };
    const at = async (t, n) => { await sx(`(APP.seek(${t}), APP.playing = false)`); await settle(n); return SUB(); };
    // the chapter on show's words, as its panel shows them (every word of a caption is there)
    const inPanel = async s => { const all = await sx(`(() => { const s = storyT(APP.t), c = CH.find(x => s >= x.a && s < x.b) || CH[CH.length - 1]; return ST.items.find(x => x.ch === c).sec.textContent.replace(/\\s+/g, ' '); })()`);
      return !!s && s.split(' ').every(w => all.includes(w.replace(/:$/, ''))); };
    const press = async id => { await tick(2); const ok = await sp.evaluate(id => { const r = HOST.collab.overlay().panel.regions.find(x => x.id === id); if (r && r.fn) r.fn(); return !!(r && r.fn); }, id); await tick(2); return ok; };
    const deg = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180 / Math.PI;
    const ahead = yaw => { const d = 16 * Math.PI / 180; return [-Math.sin(yaw) * Math.cos(d), -Math.sin(d), -Math.cos(yaw) * Math.cos(d)]; };
    await openXR('qubits');
    // off by default: nothing drawn at a line
    const s0 = await at(60);
    if (await sp.evaluate(() => HOST.xr.subs()) || s0.vis || s0.want) bad.push('subtitles are not off by default: ' + JSON.stringify(s0));
    // on through the menu's row (the story goes on drawing nothing of its own for it)
    await sp.evaluate(() => HOST.collab.panelOpen(true));
    if (!await press('subs') || !await sp.evaluate(() => HOST.xr.subs())) bad.push('the menu\'s Subtitles row did not turn them on');
    await sp.evaluate(() => HOST.collab.panelOpen(false));
    const s1 = await at(60);
    if (!(s1.vis && s1.op > 0.99 && s1.top && s1.text && s1.text === s1.want && await inPanel(s1.text))) bad.push('on, no caption of the line on show at 60 s: ' + JSON.stringify(s1));
    // the clock moving on: captions change, each from the line on show, a line in several captions one after the other
    const seen = [];
    for (let t = 1; t < 200; t += 1) { await sx(`(APP.seek(${t}), APP.playing = false)`); await tick(1); const u = await SUB(); if (u.want && (!seen.length || seen[seen.length - 1].want !== u.want)) seen.push(Object.assign(u, { t, ok: await inPanel(u.want) })); }
    const within = seen.some((u, i) => i && u.id.split(':')[0] === seen[i - 1].id.split(':')[0]);
    if (seen.length < 12 || !seen.every(u => u.ok) || !within) bad.push(`over 200 s: ${seen.length} captions, all from the panel's words ${seen.every(u => u.ok)}, a line cut in several ${within}: ` + JSON.stringify(seen.filter(u => !u.ok).slice(0, 3)));
    if (seen.some(u => u.want.length > 90 && u.want.includes(' '))) bad.push('a caption longer than two lines: ' + seen.find(u => u.want.length > 90).want);
    // paused, it holds
    const h0 = await at(60), t0 = await sx('APP.t');
    await settle(20);
    const h1 = await SUB();
    if (!(h1.text === h0.text && h1.vis && h1.op > 0.99 && await sx('APP.t') === t0)) bad.push('paused, the caption did not hold: ' + JSON.stringify([h0.text, h1.text, h1.op]));
    // a small turn of the head leaves it where it is; a larger one is followed, with lag
    await head([0, 1.6, 0], 0); await settle(30);
    const f0 = await SUB();
    await head([0, 1.6, 0], 10 * Math.PI / 180); await settle(10);
    const f1 = await SUB();
    if (deg(f1.dir, f0.dir) > 0.01) bad.push(`a 10 degree turn of the head moved the caption ${deg(f1.dir, f0.dir).toFixed(3)} deg`);
    await head([0, 1.6, 0], 40 * Math.PI / 180); await settle(1);
    const f2 = await SUB();
    await settle(40);
    const f3 = await SUB();
    if (!(deg(f2.dir, f0.dir) > 0.01 && deg(f2.dir, ahead(40 * Math.PI / 180)) > 10 && deg(f3.dir, ahead(40 * Math.PI / 180)) < 2)) bad.push(`a 40 degree turn: after a moment ${deg(f2.dir, ahead(0.698)).toFixed(1)} deg off the new view (it should lag), after 2 s ${deg(f3.dir, ahead(0.698)).toFixed(2)} deg`);
    await head([0, 1.6, 0], 0); await settle(40);
    // explore mode, the Stories screen: nothing
    await sx('APP.enterExplore()'); await settle(10);
    const x1 = await SUB();
    if (x1.vis || x1.want) bad.push('a caption in explore mode: ' + JSON.stringify(x1));
    if (await sx('(() => { APP.enterStory(0); APP.playing = false; const w = XR.stories; XR.stories = true; const c = xrCaption(); XR.stories = w; return c; })()') !== null) bad.push('the caption hook gives a line on the Stories screen');
    // kept across a reload, and a link sets it
    await sp.reload(); await sp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.xr && HOST.curKey === 'qubits', null, { timeout: 30000 });
    if (!await sp.evaluate(() => HOST.xr.subs() && HOST.xr.sig().endsWith('s'))) bad.push('subtitles on were not kept across a reload');
    await sp.evaluate(() => HOST.xr.setSubs(false));
    await sp.goto('about:blank'); await sp.goto(base + 'index.html#qubits&subs=on');
    await sp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.xr && HOST.curKey === 'qubits', null, { timeout: 30000 });
    if (!await sp.evaluate(() => HOST.xr.subs())) bad.push('#subs=on did not turn them on');
    // the pass story's captions in the device's language (its panel is), English after the switch
    await openXR('pass', '&lang=de');
    const d1 = await at(20), de = await sx('LANG');
    await sx('setLang("en", false)'); await settle(10);
    const e1 = await SUB();
    if (!(de === 'de' && d1.vis && await sx('(setLang("de", false), 0)') === 0 && d1.text && e1.text && d1.text !== e1.text)) bad.push(`the pass story: German ${JSON.stringify(d1.text)}, English ${JSON.stringify(e1.text)}`);
    await sx('setLang("de", false)'); await settle(2);
    if (!await inPanel(d1.text)) bad.push('the pass story\'s German caption is not its panel\'s words: ' + d1.text);
    // a hand-written story too, and the hook in all fifteen
    await openXR('airports');
    const a1 = await at(140);
    if (!(a1.vis && await inPanel(a1.text))) bad.push('the airports at 140 s: no caption of its line: ' + JSON.stringify(a1));
    const miss = await sp.evaluate(async keys => (await Promise.all(keys.map(async k => (await (await fetch('stories/' + k + '.js')).text()).includes('caption: xrCaption') ? '' : k))).filter(Boolean),
      ['airports', 'proteins', 'spatial', 'lbi', 'nmd', 'endo', 'pet', 'micro', 'ovary', 'qubits', 'mutation', 'topo', 'pass', 'flock', 'robots']);
    if (miss.length) bad.push('no caption hook in ' + miss.join(', '));
    await sp.evaluate(() => HOST.xr.setSubs(false));
    if (bad.length) errors.push(...bad.map(b => 'subtitles: ' + b));
  });
  await sp.close();
}
await step('old links forward to the app', async () => {
  await page.goto(base + 'spatial.html#t=20');
  await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'spatial', null, { timeout: 30000 });
});
await browser.close();
if (errors.length) { console.log('\n' + errors.join('\n\n')); process.exit(1); }
console.log('\nall good');
