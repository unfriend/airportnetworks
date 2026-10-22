// Headless smoke test for the ten stories.
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
for (const key of ['airports', 'proteins', 'spatial', 'lbi', 'nmd', 'endo', 'pet', 'micro', 'flock', 'robots']) {
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
    if (XR.main.regions.some(r => r.id === 'exit')) throw new Error('Exit is on the story panel (it belongs on the Shared panel)');
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
      for (const p of ['healthy', 'cancer', 'both', 'dys']) { selectProfile(p); if (curProfile() !== p) out.push('profile ' + p + ' not chosen'); }
      setU(1, 2); if (!X.u || X.u[1] !== 2) out.push('uptake slider did not set a custom value');
      setUs(null); setTheta(2.5); setTheta(2);
      for (let g = 0; g <= 4; g++) { selectGroup(g); if (X.group !== g) out.push('group ' + g + ' not picked'); }
      setLife(true); setLife(false);
      for (const s of ['scan', 'body', 'organs', 'people', 'liver']) { openScene(s); for (const c of GL.sets[s].controls || []) for (const [v] of c.options) setCtl(s, c.key, v); }
      const rc = new THREE.Raycaster(new THREE.Vector3(0, 0.2, 6), new THREE.Vector3(0, 0, -1));
      for (const s of ['organs', 'people']) { try { GL.sets[s].api().pick(rc); } catch (e) { out.push(s + ' pick threw: ' + e.message); } }
      XR.on = true;
      for (const [k] of TABS) { showTab(k); for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } }
      XR.on = false;
      selectOrgan(null); selectGroup(0); showNet('full'); showTab('networks');
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
  await page.click('#picker [data-story="robots"]');
  await ready('robots'); await toEnd();
  await playsFromTop('airports', 'Repeat all did not go from the last story to the first');
  await page.click('#btnOther');
  await page.click('#picker [data-repeat="all"]');
  if (await page.evaluate(() => HOST.repeat) !== 'off') errors.push('pressing the lit Repeat button did not turn it off');
});
// Anchored mode with a pretend headset: a room whose tracking origin can jump (recentring) and
// anchors that keep their place in it, saved under a handle (Quest's persistent anchors)
for (const key of ['airports', 'proteins', 'spatial', 'lbi', 'nmd', 'endo', 'pet', 'micro', 'flock', 'robots']) await step(`${key}: anchored placement`, async () => {
  await page.evaluate(k => HOST.start(k), key);
  await page.waitForFunction(k => HOST.curKey === k && HOST.cur && HOST.cur.peek('typeof ST !== "undefined" && ST.items.length > 0'), key, { timeout: 30000 });
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
await step('old links forward to the app', async () => {
  await page.goto(base + 'spatial.html#t=20');
  await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'spatial', null, { timeout: 30000 });
});
await browser.close();
if (errors.length) { console.log('\n' + errors.join('\n\n')); process.exit(1); }
console.log('\nall good');
