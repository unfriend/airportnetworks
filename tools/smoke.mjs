// Headless smoke test for the sixteen stories, the design room and the studio.
//   node tools/smoke.mjs [base-url] [--only <words>]     (default http://127.0.0.1:8123/)
// Serve the folder first (npx http-server -p 8123 -c-1 .). Needs Playwright;
// set PLAYWRIGHT_MODULE to its path if it is installed globally, and
// CHROMIUM_PATH to use a specific Chromium build. Exits 1 on any page error.
// --only <words>: only the steps whose names start with the words, and the blocks that hold them (--only studio: the
// studio's pages, about a quarter of the run; --only 'studio texture swaps': the trigger cubes that change pictures;
// --only 'phone ar': a phone's AR session, its menu button and sheet; --only trackers: the PC's trackers in the shell)
const ARGS = process.argv.slice(2), ONLY_AT = ARGS.indexOf('--only'), ONLY = ONLY_AT >= 0 ? ARGS[ONLY_AT + 1] || '' : '';
const base = ARGS.filter((a, i) => !a.startsWith('--') && (ONLY_AT < 0 || i !== ONLY_AT + 1))[0] || 'http://127.0.0.1:8123/';
// (a block of steps runs when --only names it, a step of it or nothing)
const runs = tag => !ONLY || tag.startsWith(ONLY) || ONLY.startsWith(tag);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
// every page here starts with the headsets' welcome off (v124, Getting around: once a session, in front of a pretend
// headset's view, which the steps that read pixels or panels back do not expect); browser.newPage makes its context
// through browser.newContext, so this covers both
const newContext = browser.newContext.bind(browser);
browser.newContext = async (o = {}) => {
  const ctx = await newContext(o);
  await ctx.addInitScript(() => { try { localStorage.setItem('collabAutoWelcome', 'off'); } catch (e) { /* storage blocked */ } });
  return ctx;
};
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', e => errors.push(e.stack || e.message));
page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
const step = async (name, fn) => { if (ONLY && !name.startsWith(ONLY)) return; const n = errors.length; await fn(); console.log((errors.length > n ? 'FAIL ' : 'ok   ') + name); };
const smokeStep = step;

await page.goto(base + 'index.html');
await page.waitForTimeout(4000);
// the sixteen stories, and the pages that are not stories (stories/list.js's STORY_EXTRA: the design room, the studio),
// which keep the same hook lines as every story: each check of those lines covers both
const STORY_KEYS = ['airports', 'proteins', 'spatial', 'lbi', 'nmd', 'endo', 'pet', 'micro', 'ovary', 'qubits', 'mutation', 'topo', 'soil', 'pass', 'flock', 'robots'];
const EXTRA = await page.evaluate(() => (self.STORY_EXTRA || []).map(s => s.key));
await step('start screen is the landing page', async () => {
  if (!await page.evaluate(() => HOST.picking)) errors.push('start screen not shown on load');
});
// sound effects (phase 2): one explore action per story and the sound it asks for (code run inside the story, the name);
// a built story with more than one scene and no entry here is checked with another scene opened (a whoosh), and every
// story with a scene in its state with that scene applied as from the room (silent)
const SFX_PICK = {
  airports: ['selectAirport(A("SYD"))', 'pick'],
  flock: ['setCtl("flock", "birds", ctlValue("flock", GL.sets.flock.controls[1]) === "400" ? "100" : "400")', 'flutter'],
};
// The headset Stories screen (run inside a story, XR.on, the Stories screen open and its panels drawn): its header only
// the title, the hint and Back to the story (the rest is the shell's menu's); one card per story in two rows on one arc,
// the first half of the list (rounded up) in the upper row, each row centred, left to right in the list's order, the
// rows apart and under the header, all within about 0.65 m of the eyes up and down
const LAND_CHECK = `{
  const ids = XR.land[0].regions.map(r => r.id).join();
  if (ids !== 'back') throw new Error('the Stories screen\\'s header has [' + ids + '] (only Back to the story)');
  const n = HOST.list.length, per = Math.ceil(n / 2), cards = XR.land.slice(1), ch = P => P.mesh.geometry.parameters.height;
  if (cards.length !== n || !XR.land.every(P => P.mesh.visible)) throw new Error('the Stories screen shows ' + cards.length + ' cards of ' + n);
  const wrong = cards.findIndex((P, k) => !P.sig().endsWith(HOST.list[k].key));
  if (wrong >= 0) throw new Error('the Stories screen\\'s card ' + wrong + ' is not ' + HOST.list[wrong].key);
  const rows = [cards.slice(0, per), cards.slice(per)], y = R => R.map(P => P.mesh.position.y), x = R => R.map(P => P.mesh.position.x);
  for (const R of rows) {
    if (R.length && Math.max(...y(R)) - Math.min(...y(R)) > 1e-6) throw new Error('a row of the Stories screen is not level: ' + y(R));
    if (R.length && Math.abs(x(R).reduce((a, b) => a + b, 0)) > 1e-6) throw new Error('a row of the Stories screen is not centred: ' + x(R));
    if (x(R).some((v, k) => k && v <= x(R)[k - 1])) throw new Error('a row of the Stories screen is not in the list\\'s order');
  }
  const head = XR.land[0].mesh, top = head.position.y + ch(XR.land[0]) / 2, up = rows[0][0].mesh.position.y;
  if (head.position.y - ch(XR.land[0]) / 2 < up + ch(rows[0][0]) / 2) throw new Error('the Stories screen\\'s header overlaps its upper row');
  if (rows[1].length && up - rows[1][0].mesh.position.y < ch(rows[0][0]) + 0.02) throw new Error('the Stories screen\\'s rows overlap');
  const low = (rows[1].length ? rows[1][0] : rows[0][0]).mesh.position.y - ch(rows[0][0]) / 2;
  if (top > 0.65 || low < -0.65) throw new Error('the Stories screen reaches from ' + top.toFixed(2) + ' to ' + low.toFixed(2) + ' m of the eyes');
}`;
for (const key of STORY_KEYS.filter(k => runs(k) || runs('load ' + k))) {
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
        // sound effects: no cue past the stop while the story waits there (SFXQ.hi: the latest cue played)
        if (peek('typeof SFXQ !== "undefined"') && peek('SFXQ.hi') > s + 0.001) out.push(`chapter ${i + 1}: a sound cue past the stop played while the story waits (${peek('SFXQ.hi')}, stop ${s})`);
        const nextCue = peek(`typeof SFXQ !== "undefined" ? SFXQ.cues.map(c => c.n).filter(n => n > ${s}).sort((a, b) => a - b)[0] : undefined`);
        nb.click();
        if (!await until(() => peek('APP.playing') && peek('APP.t') > s, 30000)) out.push(`Next did not go on (playing ${peek('APP.playing')}, t ${peek('APP.t')})`);
        // after Next, the next cue as the clock passes it (when it comes soon; a heavy scene draws about a frame a second
        // headlessly and each frame moves the clock at most 0.1 s, so 3 s of story can take 30 s)
        if (nextCue !== undefined && nextCue < s + 3 && i !== last && (!await until(() => peek('APP.t') > nextCue + 0.2 || !peek('APP.playing'), 60000) || peek('SFXQ.hi') < nextCue - 0.001)) out.push(`chapter ${i + 1}: after Next the next cue (${nextCue.toFixed(2)} s) did not play (latest ${peek('SFXQ.hi')}, t ${peek('APP.t')})`);
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
  // Sound effects (phase 2): the story's cue table (names the shell knows, places that resolve, times within the story;
  // a background only for the flock and the pass story),
  // none over a scrub, exactly the cues the clock crosses while it plays, an explore action's sound (SFX_PICK) and a
  // pretend headset's press on a story panel button clicking (the log of what was asked for: SFXQ.log)
  await step(`${key}: sound effects: its cues, a scrub, a stretch played, a pick, a panel press`, async () => {
    const bad = await page.evaluate(async ([k, pick]) => {
      const sleep = ms => new Promise(r => setTimeout(r, ms)), peek = src => HOST.cur.peek(src), out = [];
      const until = async (f, ms) => { for (let n = 0; n < ms / 50 && !f(); n++) await sleep(50); return f(); };
      const frames = n => until(((f0) => () => window.__frames >= f0 + n)(window.__frames), 30000);
      if (!peek('typeof SFXQ !== "undefined"')) return ['no sound effects block (SFXQ, sfxStep) in this story'];
      const T = peek('T_END'), cues = peek('SFXQ.cues.map(c => [c.name, c.n, c.o]).sort((a, b) => a[1] - b[1])');
      const where = peek('SFXQ.cues.map(c => { const v = new THREE.Vector3(); return sfxPos(c.set, c.at, v) && [v.x, v.y, v.z].every(Number.isFinite); })');
      cues.forEach(c => { if (!window.SFX_LIB.SOUNDS[c[0]]) out.push(`unknown sound ${c[0]} at ${c[1]}`); if (!(c[1] >= 0 && c[1] <= T)) out.push(`a cue outside the story: ${c[0]} at ${c[1]}`); });
      if (where.some(w => !w)) out.push(`${where.filter(w => !w).length} cues without a place`);
      if (peek('SFXQ.spans.some(s => !SFX_LIB.DRONES[s.name])')) out.push('a span of an unknown continuous sound');
      // a background only for the flock and the pass story (the owner, 30 October 2026: the others went)
      if (!!window.SFX_LIB.bedOf(k) !== (k === 'flock' || k === 'pass')) out.push(`a background where none belongs, or none for the flock or pass: '${window.SFX_LIB.bedOf(k)}'`);
      if (!cues.length) return out.concat(['no cues']);
      const back = peek('APP.t'), n0 = () => peek('SFXQ.n');
      // a scrub across cues while paused adds none
      peek('(APP.mode === "story" || APP.enterStory(0), APP.playing = false)'); await frames(2);
      let k0 = n0();
      for (const c of cues.slice(0, 6)) { peek(`APP.seek(${c[1]} + 0.05)`); await frames(1); }
      const live = peek('typeof sfxLive === "function"');
      if (!live && n0() !== k0) out.push(`a scrub played ${n0() - k0} sounds: ${JSON.stringify(peek('SFXQ.log.slice(-3)'))}`);
      // a stretch played: exactly the cues it crosses (a live story's own sounds aside)
      const c = cues.find(c => c[1] >= 1.5) || cues[0], a = Math.max(0, c[1] - 0.5);
      peek(`(APP.seek(${a}), APP.playing = true)`);
      k0 = n0();
      if (!await until(() => peek('APP.t') >= c[1] + 0.4 || !peek('APP.playing'), 30000)) out.push('the story did not play on');
      peek('APP.playing = false');
      const t1 = peek('APP.t'), got = peek(`SFXQ.log.slice(-${Math.min(64, Math.max(1, n0() - k0))})`).filter(e => e[2] === 'story');
      const want = cues.filter(q => q[1] > a && q[1] <= t1 + 1e-6), match = (e, q) => e[0] === q[0] && e[1] >= q[1] - 0.006 && e[1] - q[1] < 1.6;   // (the log keeps APP.t to the hundredth)
      const cueLike = got.filter(e => cues.some(q => match(e, q)));
      if (n0() === k0 || cueLike.length !== want.length || want.some(q => !cueLike.some(e => match(e, q)))) out.push(`played ${a.toFixed(2)} to ${t1.toFixed(2)} s: logged ${JSON.stringify(cueLike)}, expected ${JSON.stringify(want.map(q => [q[0], q[1]]))}`);
      // an explore action's sound (the table's, else another scene), and a room's state applied in silence
      if (!pick && peek('typeof openScene === "function" && typeof GL !== "undefined" && !!GL.sets && Object.keys(GL.sets).length > 1')) pick = ['openScene((typeof SCENES !== "undefined" ? SCENES.map(s => s[0]) : Object.keys(GL.sets)).find(k => GL.sets[k] && k !== X.scene))', 'whoosh'];
      if (pick) {
        peek('APP.enterExplore()'); await frames(2);
        const k1 = n0();
        peek(pick[0]); await frames(2);
        const l = peek(`SFXQ.log.slice(-${Math.min(64, Math.max(1, n0() - k1))})`);
        if (n0() === k1 || !l.some(e => e[0] === pick[1] && e[2] === 'explore')) out.push(`explore: ${pick[0]} did not ask for ${pick[1]} (${JSON.stringify(l)})`);
        const quiet = peek(`(() => {
          const C = HOST.cur.collab, s = JSON.parse(JSON.stringify(C.state()));
          const k = s && 'scene' in s && typeof GL !== 'undefined' && GL.sets ? (typeof SCENES !== 'undefined' ? SCENES.map(s => s[0]) : Object.keys(GL.sets)).find(k => GL.sets[k] && k !== s.scene) : null;
          if (!k) return -1;
          s.scene = k; const n = SFXQ.n; C.apply(s); return SFXQ.n - n;
        })()`);
        if (quiet > 0) out.push(`a room's state applied in explore mode asked for ${quiet} sound(s): ${JSON.stringify(peek('SFXQ.log.slice(-' + quiet + ')'))}`);
        peek('APP.enterStory(0)'); peek('APP.playing = false'); await frames(1);
      }
      // a pretend headset's press on a story panel button: a click (its own sound aside)
      const r = peek(`(() => {
        XR.on = true; for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); }
        const P = XR.foot, r = P.regions.find(x => x.id === 'next' && x.fn) || P.regions.find(x => x.fn && !x.drag), c = XR.ctrls[0];
        if (!r) { XR.on = false; return 'no button'; }
        const n = SFXQ.n;
        c.hover = { kind: 'panel', P, x: r.x + r.w / 2, y: r.y + r.h / 2, point: new THREE.Vector3(0, 1.4, -0.8) };
        xrPress(c); xrRelease(c); c.hover = null; c.press = null; XR.on = false;
        return SFXQ.n > n ? SFXQ.log[SFXQ.log.length - 1][0] : 'nothing';
      })()`);
      if (r !== 'click') out.push(`a press on the story panel's button: ${r}`);
      peek(`(APP.enterStory(${back}), APP.playing = false)`);
      return out;
    }, [key, SFX_PICK[key]]);
    if (bad.length) errors.push(...bad.map(b => `${key}: sound effects: ${b}`));
  });
  await step(`${key}: explore mode and headset panels`, () => page.evaluate(L => HOST.cur.peek(`(() => {
    APP.enterExplore();
    document.querySelectorAll('.tabs button').forEach(b => b.click());
    XR.on = true;
    for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); }
    if (XR.main.regions.some(r => r.id === 'exit')) throw new Error('Exit is on the story panel (it belongs in the menu on the left wrist)');
    const was = XR.inStory; XR.stories = true; XR.inStory = true; xrUpdate(storyState(0));
    for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); }
    ${L}
    XR.inStory = was; XR.stories = false; XR.on = false;
  })()`), LAND_CHECK));
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
        // the story's first chapter: six robots go to their places at the dock and rest there (20 s, up to 40: from where
        // the steps above left them one sometimes takes longer to get out of a jam, also in v103)
        const docked = s => s.rule === 0 && !s.robots.some(r => !s.slots[r.slot] || Math.hypot(r.x - s.slots[r.slot][0], r.z - s.slots[r.slot][1]) > 0.1 || Math.abs(r.v) > 0.02);
        simStory(0, 10); simStory(0, 10);
        for (let k = 0; k < 2 && !docked(F.state()); k++) simStory(0, 10);
        check('dock', 6);
        const st = F.state();
        if (!docked(st)) out.push('the robots did not rest at the dock ' + JSON.stringify(st.robots.filter(r => !st.slots[r.slot] || Math.hypot(r.x - st.slots[r.slot][0], r.z - st.slots[r.slot][1]) > 0.1 || Math.abs(r.v) > 0.02).map(r => [r.slot, +r.x.toFixed(2), +r.z.toFixed(2), +r.v.toFixed(2)])));
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
  // the story's hand-over between the scanner and the body, played by explore's Scenes (on synthetic time: the targets
  // at given seconds of it), backwards to the scanner; a pick of an organ from the scanner showing it at once; and a
  // turn back halfway starting where the patient is
  if (key === 'pet') await step('pet: explore plays the scanner-to-body hand-over and back, only for a scene picked', () => page.evaluate(async () => {
    const bad = HOST.cur.peek(`(() => {
      const out = [], r2 = x => Math.round(x * 100) / 100;
      const settle = () => { X.hand = null; Object.assign(XS, exploreTargets()); };
      const at = u => { const T = exploreTargets(X.hand.t0 + u * 1000); return { rise: r2(T.scan_rise), scan: r2(T.scan_a), body: r2(T.body_a), pet: r2(T.body_pet), org: r2(T.organs_a) }; };
      selectCmp(-1, false);   // (no comparison left from the step before: its network would dim the organs)
      openScene('scan', false); settle();
      openScene('body', true, true);
      if (!X.hand || X.hand.dir !== 'fwd') out.push('Scanner to Body: no hand-over (' + JSON.stringify(X.hand) + ')');
      else {
        const a0 = at(0), a3 = at(3), a7 = at(7), a15 = at(15);
        if (a0.rise !== 0 || a0.scan !== 1 || a0.pet !== 0) out.push('at 0 s ' + JSON.stringify(a0));
        if (!(a3.rise > 0.25 && a3.rise < 0.75) || a3.body !== 0) out.push('at 3 s the patient not standing up: ' + JSON.stringify(a3));
        if (a7.rise !== 1 || a7.body !== 1 || a7.pet > 0.1) out.push('at 7 s ' + JSON.stringify(a7));
        if (a15.pet !== 1) out.push('at 15 s the tracer not arrived: ' + JSON.stringify(a15));
        handStep(X.hand.t0 + 15100);
        if (X.hand) out.push('the hand-over did not end at 15 s');
      }
      settle();
      openScene('scan', true, true);
      if (!X.hand || X.hand.dir !== 'back') out.push('Body to Scanner: no hand-over back');
      else {
        const b0 = at(0), b1 = at(1), b4 = at(4);
        if (b0.pet !== 1 || b0.rise !== 1) out.push('back at 0 s not where the body was: ' + JSON.stringify(b0));
        if (!(b1.pet < 1) || b1.rise !== 1) out.push('back at 1 s the tracer not draining: ' + JSON.stringify(b1));
        if (!(b4.rise > 0.25 && b4.rise < 0.75)) out.push('back at 4 s the patient not lying down: ' + JSON.stringify(b4));
        handStep(X.hand.t0 + 6100);
        if (X.hand || exploreTargets().scan_rise !== 0) out.push('back: not ended with the room there at 6 s');
      }
      settle();
      const o = PET_DATA.organs[0].id;
      selectOrgan(o);
      const oa = exploreTargets().organs_a;   // (a hand-over holds the organs at 0 until its end)
      if (X.hand || X.scene !== 'organs' || !(oa > 0)) out.push('an organ picked from the scanner waited for a hand-over (' + JSON.stringify({ hand: X.hand, scene: X.scene, oa }) + ')');
      selectOrgan(null); openScene('scan', false); settle();
      openScene('body', true, true);
      const mid = exploreTargets(X.hand.t0 + 3000);
      Object.assign(XS, mid);
      openScene('scan', true, true);
      const u = (performance.now() - X.hand.t0) / 1000, back = exploreTargets(X.hand.t0 + u * 1000);
      if (X.hand.dir !== 'back' || Math.abs(back.scan_rise - mid.scan_rise) > 0.05) out.push('turned back halfway it jumps: rise ' + r2(mid.scan_rise) + ' to ' + r2(back.scan_rise) + ' (from ' + r2(u) + ' s)');
      settle(); openScene('organs', false); settle();
      return out;
    })()`);
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
  if (key === 'soil') await step('soil: every explore tool, on the page and in the headset', async () => {
    const bad = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms)), peek = src => HOST.cur.peek(src);
      const until = async (f, ms) => { for (let n = 0; n < ms / 50 && !f(); n++) await sleep(50); return f(); };
      const out = peek(`(() => {
        const out = [], txt = k => document.getElementById('pane-' + k).textContent, f1 = v => num(v, 1);
        // Field: every date with every measure, both wheats and every regime, every view; each group of plots picked
        pickTab('field'); if (X.scene !== 'field') out.push('the Field tab did not bring up the field');
        for (const [d] of DATE_OPTS()) for (const s of SHOWS) {
          sceneCtl('field', 'date', d); pickShow(s);
          if (fieldDate() !== +d || fieldShow() !== s || !txt('field').includes(MEASURE[s][0] + ' · Day ' + FACTS.days[+d])) out.push('the field on day ' + FACTS.days[+d] + ' with ' + s + ' not shown');
        }
        for (const c of ['line', 'fert']) for (const [v] of ctlOf('field', c).options) sceneCtl('field', c, v);
        for (const [v] of ctlOf('field', 'view').options) { showView('field', v); if (!viewIs('field', v)) out.push('the field\\'s view ' + v + ' not shown'); }
        for (let g = 0; g < 6; g++) { selectPlot(g); if (X.plot !== g || !txt('field').includes(LINE_NAME[Math.floor(g / 3)] + ', ' + FERT_NAME[g % 3].toLowerCase())) out.push('the group of plots ' + g + ' not picked'); }
        selectPlot(-1); showView('field', 'default');
        // the data's numbers in the pane: nitrate on day 24 in fertilised soil (BNI · control); day 70's chlorophyll read
        // off the slides; the jars' N2O peaks
        sceneCtl('field', 'date', '2'); pickShow('no3');
        if (!txt('field').includes(f1(SD.meta('no3', 0, 1, 2).mean) + ' · ' + f1(SD.meta('no3', 1, 1, 2).mean))) out.push('nitrate on day 24 is not the data\\'s ' + f1(SD.meta('no3', 0, 1, 2).mean) + ' · ' + f1(SD.meta('no3', 1, 1, 2).mean));
        sceneCtl('field', 'date', '4'); pickShow('chl');
        if (!txt('field').includes(f1(SD.chl70(0, 0).v) + ' · ' + f1(SD.chl70(0, 1).v)) || !txt('field').includes('read off the slides')) out.push('day 70\\'s chlorophyll is not the slides\\' reading');
        sceneCtl('field', 'date', '0'); pickShow('n2o');
        if (!viewIs('field', 'jars') || !txt('field').includes('ppm') || !txt('field').includes('unit not given')) out.push('N2O did not bring the jars and both measurements');
        sceneCtl('field', 'date', '4'); pickShow('chl'); showView('field', 'default');
        // Nitrogen: every switch of the sketch, said to be a sketch
        pickTab('nitrogen'); if (X.scene !== 'soil') out.push('the Nitrogen tab did not bring up the soil block');
        for (const c of ctlsOf('soil')) for (const [v] of c.options) { sceneCtl('soil', c.key, v); if (ctlv('soil', c.key) !== v) out.push('the sketch\\'s ' + c.key + ' ' + v + ' not set'); }
        if (!txt('nitrogen').includes('A sketch, not data')) out.push('the Nitrogen pane does not say it is a sketch');
        // Microbes: the cloud by phylum and the nitrifiers, their shares; a kind by its number
        pickTab('microbes'); if (X.scene !== 'net' || netView() !== 'cloud') out.push('the Microbes tab did not bring up the cloud');
        for (const v of ['guild', 'phylum']) sceneCtl('net', 'colour', v);
        for (const k of D.guilds.keys) if (!txt('microbes').includes(D.guilds[k].name)) out.push('the guild ' + k + ' is not in the Microbes pane');
        const k215 = kindOfRank(215); selectKind(k215);
        if (X.kind !== k215 || !txt('microbes').includes('Kind 215')) out.push('kind 215 not picked');
        selectKind(-1);
        // Network: every big module, the threshold's ends and its counts, the shuffle, the split three ways
        pickTab('network'); if (X.scene !== 'net' || netView() !== 'net') out.push('the Network tab did not bring up the network');
        for (const m of BIG) { selectModule(m); if (X.mod !== m || !txt('network').includes('Module ' + (m + 1) + ' · ' + fmt(D.net.mods[m].n) + ' kinds')) out.push('module ' + (m + 1) + ' not shown'); }
        stepModule(1); stepModule(-1); selectModule(-1);
        for (const r of [0.6, 0.7, 0.8]) {
          setRho(r); const want = (D.net.thresholds.find(x => Math.abs(x.rho - r) < 1e-9) || {}).links;
          if (X.rho !== r || SD.net.cut(r) !== want || !txt('network').includes(fmt(want))) out.push('at ρ ' + r + ' the network has ' + SD.net.cut(r) + ' links, the data ' + want);
        }
        setRho(0.6);
        setShuffle(true); if (!X.shuf || !txt('network').includes(fmt(D.net.null.links) + ' (shuffled)')) out.push('the shuffle does not leave the data\\'s ' + D.net.null.links + ' links'); setShuffle(false);
        for (const [by] of SPLIT_OPTS) { setSplit(by); if (splitNow() !== by) out.push('the split ' + by + ' not shown'); }
        setSplit('line');
        const sp = D.net.splits;
        if (!txt('network').includes(fmt(sp.line[0].links)) || !txt('network').includes(fmt(sp.line[1].links)) || !txt('network').includes(fmt(sp.lineDiff))) out.push('the split by wheat line does not show the data\\'s networks');
        setSplit('off');
        // Scenes: every scene's every control; the shared state round trip
        for (const [k] of SCENES) { openScene(k); for (const c of ctlsOf(k)) for (const [v] of c.options) setCtl(k, c.key, v); }
        const st = JSON.stringify(collabState()); collabApply(JSON.parse(st));
        if (JSON.stringify(collabState()) !== st) out.push('apply(state()) changed the state');
        // the headset's panels, every tab
        XR.on = true;
        for (const [k] of TABS) { pickTab(k); for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } }
        XR.on = false;
        // ready to pick: the field from above
        pickTab('field'); showView('field', 'plots'); orbit.cur = view('field', viewCam('field')); orbit.to = null; Object.assign(XS, exploreTargets());
        return out;
      })()`);
      // picks with the pointer, once the sets have drawn: a plot of the field, then a kind of the network
      const f0 = window.__frames; await until(() => window.__frames >= f0 + 3, 30000);
      // (the first point on a grid over the scene, beside the side panel, that picks a thing of that kind)
      const pickOn = kind => peek(`(() => { applyCamera(orbit.cur); GL.camera.updateMatrixWorld(); GL.world.updateMatrixWorld(true);
        for (let y = 0.15; y < 0.9; y += 0.03) for (let x = 0.3; x < 0.95; x += 0.03) { const p = pickAt(innerWidth * x, innerHeight * y); if (p && p.${kind} !== undefined) return p; }
        return null; })()`);
      const pp = pickOn('plot');
      if (!pp) out.push('no plot picked on the field');
      else { peek(`(pickText(${JSON.stringify(pp)}), choosePick(${JSON.stringify(pp)}))`); const o = peek(`SD.ofPlot(${pp.plot})`); if (peek('X.plot') !== o.line * 3 + o.fert) out.push('a plot clicked did not pick its group'); }
      peek(`(selectPlot(-1), pickTab('network'), showView('net', 'net'), orbit.cur = view('net', viewCam('net')), orbit.to = null, Object.assign(XS, exploreTargets()))`);
      const f1 = window.__frames; await until(() => window.__frames >= f1 + 3, 30000);
      const pk = pickOn('kind');
      if (!pk) out.push('no kind picked in the network');
      else { peek(`(pickText(${JSON.stringify(pk)}), choosePick(${JSON.stringify(pk)}))`); if (peek('X.kind') !== pk.kind) out.push('a kind clicked was not picked'); }
      peek(`(selectKind(-1), pickTab('field'))`);
      return out;
    });
    if (bad.length) errors.push(...bad.map(b => 'soil: ' + b));
  });
  if (key === 'soil') await step('soil: its links open explore mode on what they say', async () => {
    // (a page of its own: a link differing only in its hash would not load the story again)
    const lp = await browser.newPage({ viewport: { width: 1280, height: 760 } });
    lp.on('pageerror', e => errors.push('soil link: ' + (e.stack || e.message)));
    lp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('soil link: ' + m.text()); });
    const LINKS = [
      ['tab=field&date=4&show=chl', "X.tab === 'field' && X.scene === 'field' && fieldDate() === 4 && fieldShow() === 'chl' && txt('field').includes('Chlorophyll · Day ' + FACTS.days[4])"],
      ['tab=field&plot=1', "X.tab === 'field' && X.plot === 1 && txt('field').includes(LINE_NAME[0] + ', ' + FERT_NAME[1].toLowerCase())"],
      ['tab=nitrogen&wheat=bni&dcd=on', "X.tab === 'nitrogen' && X.scene === 'soil' && ctlv('soil', 'wheat') === 'bni' && ctlv('soil', 'dcd') === 'on'"],
      ['tab=microbes&colour=guild&kind=215', "X.tab === 'microbes' && X.scene === 'net' && ctlv('net', 'colour') === 'guild' && X.kind === kindOfRank(215) && txt('microbes').includes('Kind 215')"],
      ['tab=network&mod=3&rho=0.7', "X.tab === 'network' && X.mod === 2 && X.rho === 0.7 && txt('network').includes('Module 3 · ')"],
      ['tab=network&split=line', "X.tab === 'network' && netView() === 'split' && ctlv('net', 'by') === 'line' && txt('network').includes(fmt(D.net.splits.lineDiff))"],
      ['tab=network&shuffle', "X.tab === 'network' && X.shuf === 1 && txt('network').includes('(shuffled)')"],
      ['scene=web', "X.tab === 'scenes' && X.scene === 'web'"],
    ];
    try {
      for (const [h, ok] of LINKS) {
        await lp.goto('about:blank');
        await lp.goto(base + 'index.html#soil&explore&' + h);
        await lp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'soil' && HOST.cur && HOST.cur.peek('APP.mode') === 'explore', null, { timeout: 60000 });
        const shown = await lp.evaluate(ok => HOST.cur.peek(`(() => { const txt = k => document.getElementById('pane-' + k).textContent; return ${ok}; })()`), ok);
        if (!shown) errors.push(`soil: the link #soil&explore&${h} does not show what it says (${await lp.evaluate(() => JSON.stringify(HOST.cur.collab.state()))})`);
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
for (const key of [...STORY_KEYS, ...EXTRA]) await step(`${key}: loads in steps, the page's bar shows and goes`, async () => {
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
// eyes (nothing at the wrist: the watch went in v103), from 0.4 s on, drawn in a scene of its own (never in the story's, its listeners
// the shell's); it fades out over the story's first frames; in AR the room still shows through (the clear colour stays
// see-through)
if (runs('headset')) {
  // the main page parked meanwhile (the Stories screen, its story paused and its frame loop stopped): a story left
  // running there shares the GPU process with this page and slowed its frames so much that the card's fade timed out
  await page.evaluate(() => { HOST.openPicker(); HOST.cur.peek('GL.renderer.setAnimationLoop(null)'); });
  const hp = await browser.newPage({ viewport: { width: 640, height: 400 } });
  hp.on('pageerror', e => errors.push('loading scene: ' + (e.stack || e.message)));
  hp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('loading scene: ' + m.text()); });
  await step('headset: the loading scene in front of you, gone as the story starts (VR and AR)', async () => {
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
            if (S.on && S.since < 350 && S.card) early = true;
            if (S.on && S.since > 700 && S.card && !shown) { shown = S; alpha = r.getClearAlpha(); }
            await sleep(25);
          }
          if (early) out.push('the loading scene showed before 0.4 s');
          if (!shown) out.push('no card while the story built');
          else {
            near(shown.cardAt, [0, 1.45, -1.2], 'the card');
            if (!drawn.includes(L.parts().scene)) out.push('the loading scene was not drawn');
            if (alpha !== (mode === 'immersive-ar' ? 0 : 1)) out.push(`the clear colour's alpha was ${alpha} while it loaded`);
            HOST.cur.peek('GL.scene').traverse(o => { if (o === L.parts().card) inStory++; });
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
  await page.evaluate(() => { HOST.cur.peek('GL.renderer.setAnimationLoop(frame)'); HOST.closePicker(); });
}
// The design room (#design, not one of the stories: not on the Stories screen): every miniature built on the table, a
// click putting one on the stage with its card as tools/design/props.json has it, the shared state (a miniature moved
// by a pretend headset's grip, both grips sizing it, apply(state()) giving the same state back, Tidy), the headset panels
await step('design: not on the Stories screen; #design opens the table and all 48 miniatures are built', async () => {
  if (await page.$('#picker [data-story="design"]')) errors.push('design: the design room has a card on the Stories screen');
  if (await page.evaluate(() => HOST.list.some(s => s.key === 'design') || HOST.count() !== 'sixteen')) errors.push('design: the design room is in the list of stories');
  await page.evaluate(() => HOST.start('design'));
  await page.waitForFunction(() => HOST.curKey === 'design' && HOST.cur && HOST.cur.peek('typeof GL !== "undefined" && !!XR.panelGroup && GL.sets.table.built() === GL.sets.table.total()'), null, { timeout: 60000 });
  const n = await page.evaluate(() => [HOST.cur.peek('GL.sets.table.total()'), HOST.cur.peek('APP.mode'), location.hash, document.title]);
  if (n[0] !== 48 || n[1] !== 'explore' || n[2] !== '#design' || !/design room/i.test(n[3])) errors.push('design: ' + JSON.stringify(n) + ' (not 48 miniatures in explore mode at #design)');
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
await step('design: explore mode and headset panels', () => page.evaluate(L => HOST.cur.peek(`(() => {
  APP.enterExplore();
  document.querySelectorAll('.tabs button').forEach(b => b.click());
  XR.on = true;
  for (const tab of ['prop', 'all']) { pickTab(tab); for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } }
  if (XR.main.regions.some(r => r.id === 'exit')) throw new Error('Exit is on the story panel (it belongs in the menu on the left wrist)');
  if (!XR.main.regions.some(r => r.id === 'pick:lbi.int') && !XR.main.regions.some(r => r.id.startsWith('pick:'))) throw new Error('no props to pick on the headset panel');
  const was = XR.inStory; XR.stories = true; XR.inStory = true; xrUpdate(storyState(0));
  for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); }
  ${L}
  XR.inStory = was; XR.stories = false; XR.on = false;
  APP.enterStory(0); APP.seek(T_END - 0.1); APP.playing = true;
})()`), LAND_CHECK));
await step('design: the intro ends at the table', async () => {
  await page.waitForFunction(() => HOST.cur.peek('APP.mode') === 'explore', null, { timeout: 20000 }).catch(() => errors.push('design: the intro did not end in explore mode'));
  await page.evaluate(() => HOST.openPicker());
});
// The studio (#studio, not one of the stories: STORY_EXTRA), on a page of its own: the test scene
// tools/studio/test/scenes/test (made by tools/studio/test/make.mjs) read from its folder (&scenes=): every file loaded with
// its sizes and the two guesses in the card's words (and one the studio refuses, and sized to fit), the clips, the missing
// texture and the FBX's opacity-0 material said and drawn solid, a scan's mesh without normals as scanned and flat when
// lit; a pretend head walking into the cube showing the figure and the sound and hiding the box (fading over 0.4 s,
// stepped frame by frame), the figure's take from when it was shown, out again the reverse, a cube that stays, editing's
// faint hidden box; editing (a click selecting, the page's arrows moving, a cube stretched, a link added from the Items
// pane, Add and Delete, Undo); the shared state and back, the room's taken, bad values ignored; a pretend headset's grips
// (carry, size, a corner) and the VR stick walk; inside a model's unseen box, pointing at nothing, that model (a headset's
// controller, a page's camera in Walk view, whose floor still walks; an item in front wins), Hold it on a headset's card
// (the next grip on nothing carries it, one Undo step), a stick scrolling the pane its ray is on (held at the ends, the walk
// paused there); New scene (a page's field, a headset's keypad, the name rules) and From another scene offered only with a
// relay that takes uploads (stubbed), a circle made for one scene opened to write its saved layout; the relay's watch (a scene added, a layout removed) and its password (one
// refusal told to the shell once, nothing more asked until another password); the sound's panner at its place, silent when
// muted; a sound longer than 20 s streamed (an element, no decoded buffer), a short one decoded; GLB first (the Add list's
// folders and Originals, a GLB standing for its original, an OBJ from originals/ in centimetres, Convert to GLB in the page
// with no relay: downloaded, a GLB whose record names the original, loading back with its triangles and take; a placed
// figure switched to it keeping its corners within 1 mm, one Undo step); the Upload pane with no relay (the test scene's
// originals dropped: the plan's rows, grouping and names, converting offered as downloads, #studio&upload opening it);
// Fewer triangles and Change texture on a dense ball made in the page (the preview in place, Save with tris, the switch,
// the headset's card, a picture shown, cancelled and saved; the Upload pane's share and its Preview, the viewer); the gaps between a
// picture's pieces filled (an atlas ball made in the page: far fewer black pixels at 10 %, in the preview and the GLB);
// the headset panels' panes and its Stories screen (no Upload tab); Download
if (runs('studio')) {
  const stp = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  stp.on('pageerror', e => errors.push('studio: ' + (e.stack || e.message)));
  stp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('studio: ' + m.text()); });
  const ss = s => stp.evaluate(s => HOST.cur.peek(s), s);
  const frames = async n => { const f0 = await stp.evaluate(() => window.__frames || 0); await stp.waitForFunction(f => window.__frames >= f, f0 + (n || 1), { timeout: 30000 }).catch(() => errors.push('studio: the page drew no frames')); };
  const until = (src, ms) => stp.waitForFunction(src => HOST.cur.peek(src), src, { timeout: ms || 20000 }).then(() => true, () => false);
  await step('studio: not on the Stories screen; the test scene loads with its sizes, the guesses in the card\'s words, the clips and what its files lack', async () => {
    await stp.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&scene=test&edit');
    await stp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    if (await stp.$('#picker [data-story="studio"]')) errors.push('studio: it has a card on the Stories screen');
    if (await stp.evaluate(() => HOST.list.some(s => s.key === 'studio') || !HOST.meta('studio') || HOST.count() !== 'sixteen' || !(self.STORY_EXTRA || []).some(s => s.key === 'studio'))) errors.push('studio: it is in the list of stories, or not in STORY_EXTRA');
    if (!await until('STUDIO.ready()', 120000)) { errors.push('studio: the test scene did not load: ' + JSON.stringify(await ss('STUDIO.state()')).slice(0, 600)); return; }
    const s = await ss('STUDIO.state()'), M = s.models, B = M['box.glb'], F = M['figure.fbx'];
    const bad = [];
    if (s.src !== 'folder' || s.scene !== 'test' || s.items !== 4 || s.bad || s.unsaved || s.files !== 8) bad.push(`the scene (its layout read from the folder): ${JSON.stringify([s.src, s.scene, s.items, s.files, s.bad, s.unsaved])}`);
    if (!B || B.state !== 'ready' || B.guess.s !== 1 || B.guess.q.join() !== '0,0,0,1' || Math.abs(B.info.own[0] - 0.5) > 1e-3 || B.info.clips.map(c => c[0]).join() !== 'Spin,Bob' || B.info.textures.length !== 1 || B.info.solid) bad.push('box.glb: ' + JSON.stringify(B && { s: B.state, g: B.guess, own: B.info && B.info.own, clips: B.info && B.info.clips }));
    if (!F || F.state !== 'ready' || F.guess.s !== 0.01 || F.guess.how !== 'unit' || F.guess.q.join() !== '-0.7071,0,0,0.7071' || !F.guess.read || F.guess.up !== 2 || F.info.clips.map(c => c[0]).join() !== 'Take 001' || F.missing.join() !== 'figure_spec.png' || F.info.textures.length !== 1 || F.info.textures[0].w !== 64 || F.info.solid !== 1 || !F.info.normals || F.info.scan)
      bad.push('figure.fbx: ' + JSON.stringify(F && { s: F.state, g: F.guess, clips: F.info && F.info.clips, missing: F.missing, tex: F.info && F.info.textures, solid: F.info && F.info.solid }));
    // as placed: the box 0.5 m, the figure standing 1.7 m tall on the floor, its opacity-0 material drawn solid
    const sz = await ss(`['box001', 'fig001'].map(id => { const b = objBox(STU.items.get(id)); return [b.getSize(new THREE.Vector3()).toArray().map(v => +v.toFixed(3)), +b.min.y.toFixed(3)]; })`);
    if (sz[0][0].join() !== '0.5,0.5,0.5' || sz[1][0][1] !== 1.7 || sz[1][1] !== 0) bad.push('sizes as placed: ' + JSON.stringify(sz));
    const solid = await ss(`(() => { const m = [].concat(LIB.get('figure.fbx').root.getObjectByProperty('isMesh', true).material)[0]; return [m.opacity, m.transparent]; })()`);
    if (solid.join() !== '1,false') bad.push('the figure\'s opacity-0 material is not drawn solid: ' + solid);
    // the cards: what is missing, the opacity, the take, the size, and the scale's reasons
    const card = async id => { await ss(`(select('${id}'), X.tab = 'item', renderPanes(), 0)`); return stp.evaluate(() => document.querySelector('#pane-item').textContent.replace(/\s+/g, ' ')); };
    const fc = await card('fig001'), bc = await card('box001');
    if (!/Missing texture figure_spec\.png: put it in the scene's folder/.test(fc) || !/Take 001/.test(fc) || !/1\.7 m/.test(fc) || !/drawn solid/.test(fc) || !/Scale ?0\.01 \(the file says centimetres; stood up from Z up\)/.test(fc)) bad.push('the figure\'s card: ' + fc.slice(0, 400));
    if (!/Scale ?1 \(glTF is in metres\)/.test(bc) || /drawn solid|no normals/.test(bc)) bad.push('the box\'s card: ' + bc.slice(0, 300));
    await ss(`(setRec('fig001', { s: 0.02 }), renderPanes(), 0)`);
    if (!/Scale ?0\.02 \(placed first at 0\.01: the file says centimetres/.test(await card('fig001'))) bad.push('a figure sized since does not say what it was placed at: ' + (await card('fig001')).slice(0, 300));
    await ss(`(setRec('fig001', { s: 0.01 }), select(''), 0)`);
    // a file's own units refused (the owner's figure: centimetres, as its file says, would make it 1.7 cm), and neither
    const gw = await ss(`[guessFor({ unit: 1, up: 2, sign: 1, read: true }, new THREE.Vector3(0.45, 0.3, 1.66)), guessFor({ unit: 1, up: 1, sign: 1, read: true }, new THREE.Vector3(1e5, 10, 10))].map(g => [g.s, g.how, guessWords(g)])`);
    if (JSON.stringify(gw) !== JSON.stringify([[1, 'metres', 'the file says centimetres; that would make it 1.7 cm, so taken as metres; stood up from Z up'], [0.00001, 'fit', 'the file says centimetres; that would make it 1 km, so sized to 1 m']])) bad.push('the guesses refused: ' + JSON.stringify(gw));
    // a scan's mesh without normals: as scanned by default; lit, flat (Phong: from its own slopes) or given normals (Lambert)
    const nn = await ss(`(() => { const out = [];
      for (const Mat of [THREE.MeshPhongMaterial, THREE.MeshLambertMaterial]) {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0], 3));
        const m = new Mat({ map: new THREE.DataTexture(new Uint8Array(4), 1, 1) }), root = new THREE.Group(); root.add(new THREE.Mesh(g, m));
        const E = { path: 'scan.fbx', missing: new Set() }; finishModel(E, { root, clips: [], guess: { unit: 1, up: 1, sign: 1, read: true } });
        out.push([E.info.normals, E.info.scan, !!m.flatShading, !!g.attributes.normal]); g.dispose(); m.dispose(); }
      return out; })()`);
    if (JSON.stringify(nn) !== '[[false,true,true,false],[false,true,false,true]]') bad.push('a mesh without normals: ' + JSON.stringify(nn));
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  await step('studio: a pretend head in the cube shows the figure and the sound and hides the box, fading over 0.4 s; out the reverse; a cube that stays', async () => {
    // (the frame loop paused: each step below is one frame of 0.1 s, the same on every machine)
    const bad = await ss(`(() => {
      const out = [], A = () => Object.fromEntries(STUDIO.items().filter(i => i.kind !== 'c').map(i => [i.id, [i.shown, +i.a.toFixed(2), i.visible]]));
      GL.renderer.setAnimationLoop(null);
      let t = performance.now();
      const step = n => { for (let i = 0; i < (n || 1); i++) itemsStep(0.1, t += 100); return A(); };
      try {
        setEdit(false); shownFor([3, 1.6, 3]); step(12);
        let s = A();
        if (!(s.box001.join() === 'true,1,true' && s.fig001.join() === 'false,0,false' && !s.snd001[0])) out.push('outside the cube: ' + JSON.stringify(s));
        shownFor([0, 1.6, 0]);
        const t0 = t; s = step();
        if (!(s.fig001.join() === 'true,0.25,true' && s.box001.join() === 'false,0.75,true' && s.snd001[0])) out.push('a frame into the cube (fading): ' + JSON.stringify(s));
        s = step(3);
        if (!(s.fig001.join() === 'true,1,true' && s.box001[1] === 0)) out.push('0.4 s into the cube: ' + JSON.stringify(s));
        s = step();
        if (s.box001[2]) out.push('the box faded out is still drawn');
        // the figure's take (When shown) runs from when the cube showed it: 1.5 s on, 1.5 s into its 2 s take
        const fg = STU.items.get('fig001'); itemsStep(0.1, fg.shownAt + 1500);
        if (!fg.action || Math.abs(fg.action.time - 1.5) > 1e-3 || Math.abs(fg.dur - 2) > 1e-3) out.push('the figure\\'s take did not run from when it was shown: ' + JSON.stringify([fg.action && fg.action.time, fg.dur]));
        t = fg.shownAt + 1500;
        shownFor([3, 1.6, 3]); s = step(5);
        if (!(s.box001.join() === 'true,1,true' && s.fig001.join() === 'false,0,false')) out.push('out of the cube again: ' + JSON.stringify(s));
        // a cube that stays once entered, until Reset what I have seen
        STU.edit = true; setRec('cube01', { mode: 'stay' }); shownFor([0, 1.6, 0]); s = step(); shownFor([3, 1.6, 3]); s = step(5);
        if (!(s.fig001[0] && !s.box001[0] && s.fig001[1] === 1)) out.push('a staying cube left: ' + JSON.stringify(s));
        resetSeen(); shownFor([3, 1.6, 3]); s = step(5);
        if (!(!s.fig001[0] && s.box001[0])) out.push('Reset what I have seen: ' + JSON.stringify(s));
        setRec('cube01', { mode: 'while' });
        // two cubes, overlapping: one shows the figure and the other hides it; the one entered last decides, and leaving
        // it hands back to the other (whichever was entered first)
        putItem('cube02', 'c', norm('c', { name: 'Hall', p: [0.5, 1, 0], yaw: 0, size: [1.2, 2, 1.2], mode: 'while', show: [], hide: ['fig001'] }));
        const F = (p, n) => { shownFor(p); return step(n || 3).fig001[0]; };
        F([3, 1.6, 3]);
        const two = [F([-0.4, 1.6, 0]), F([0.3, 1.6, 0]), F([-0.4, 1.6, 0]), F([3, 1.6, 3]), F([0.9, 1.6, 0]), F([0.3, 1.6, 0]), F([0.9, 1.6, 0])];
        if (two.join() !== 'true,false,true,false,false,true,false') out.push('two cubes (first, both, first; out; second, both, second): ' + two.join());
        // both staying once entered (the owner's pair, 5 November 2026: one shows the figure, the other hides it): walking
        // into the one that shows it again shows it again, every time (the one entered last decides)
        setRec('cube01', { mode: 'stay' }); putItem('cube02', 'c', norm('c', { name: 'Hall', p: [0.5, 1, 0], yaw: 0, size: [1.2, 2, 1.2], mode: 'stay', show: [], hide: ['fig001'] })); resetSeen();
        const stay = [F([3, 1.6, 3]), F([-0.4, 1.6, 0]), F([0.9, 1.6, 0]), F([3, 1.6, 3]), F([-0.4, 1.6, 0]), F([3, 1.6, 3]), F([0.9, 1.6, 0]), F([-0.4, 1.6, 0])];
        if (stay.join() !== 'false,true,false,false,true,true,false,true') out.push('two staying cubes (out; shows; hides; out; shows again; out; hides again; shows again): ' + stay.join());
        setRec('cube01', { mode: 'while' }); resetSeen();
        removeItem('cube02'); F([3, 1.6, 3]);
        // editing: what a cube hides is drawn faint (0.3), so it can still be picked
        setEdit(true); shownFor([0, 1.6, 0]); s = step(5);
        if (!(s.box001.join() === 'false,0.3,true')) out.push('editing, the box the cube hides is not faint: ' + JSON.stringify(s));
        shownFor(null); step(5);
        while (UNDO.length) undo();
      } finally { GL.renderer.setAnimationLoop(frame); }
      return out;
    })()`);
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  await step('studio: editing on the page: a click selects, the arrows move it, a cube grows, Shows under a card links, Add and Delete, Undo', async () => {
    const bad = [];
    await ss(`(setEdit(true), setView('orbit'), orbit.cur = [10, 18, 3.2, -1, 0.3, -2], orbit.to = null, select(''), 0)`);
    await frames(3);
    const at = await ss(`(() => { const v = STU.items.get('box001').proxy.getWorldPosition(new THREE.Vector3()).project(GL.camera); return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight]; })()`);
    await stp.mouse.move(at[0], at[1]);
    if (await ss('STU.hover') !== 'box001') bad.push('the mouse over the box did not light it: ' + await ss('STU.hover'));
    await stp.mouse.click(at[0], at[1]);
    await until(`STU.sel === 'box001'`, 5000);
    if (await ss('STU.sel') !== 'box001' || await ss('X.tab') !== 'item' || await ss('GL.tc && GL.tc.object === STU.items.get("box001").holder') !== true) bad.push('the click did not select the box (its card, the arrows): ' + JSON.stringify([await ss('STU.sel'), await ss('X.tab')]));
    // the page's arrows (TransformControls): a drag is one change, the record follows
    const u0 = await ss('UNDO.length');
    await ss(`(GL.tc.dispatchEvent({ type: 'dragging-changed', value: true }), STU.items.get('box001').holder.position.x += 0.5, GL.tc.dispatchEvent({ type: 'objectChange' }), GL.tc.dispatchEvent({ type: 'dragging-changed', value: false }), 0)`);
    const p = await ss(`STU.items.get('box001').rec.p`);
    if (p[0] !== -0.5 || await ss('UNDO.length') !== u0 + 1) bad.push('the arrows did not move the box as one change: ' + JSON.stringify([p, await ss('UNDO.length')]));
    // a cube's size steps (10 cm), its foot staying on the floor
    await ss(`(select('cube01'), itemAct('grow', '1:0.1'), 0)`);
    const c = await ss(`STU.items.get('cube01').rec`);
    if (c.size.join() !== '1.2,2.1,1.2' || c.p[1] !== 1.05) bad.push('a cube\'s height step: ' + JSON.stringify(c));
    // the Items pane's Shows under the box's card: the box on the cube's Shows list (and off its Hides list), then Undo
    await ss(`(X.tab = 'items', renderPanes(), 0)`);
    await stp.click('#pane-items .stu-ic[data-card="box001"] button[data-act="tick"][data-v="show:box001"]');
    const c2 = await ss(`STU.items.get('cube01').rec`);
    if (!c2.show.includes('box001') || c2.hide.includes('box001')) bad.push('Shows under the box\'s card did not put it on the cube\'s Shows list: ' + JSON.stringify(c2));
    await ss('undo()');
    const c3 = await ss(`STU.items.get('cube01').rec`);
    if (c3.show.includes('box001') || !c3.hide.includes('box001')) bad.push('Undo did not take the link back: ' + JSON.stringify(c3));
    await ss('(undo(), undo(), 0)');
    if (JSON.stringify(await ss(`STU.items.get('box001').rec.p`)) !== '[-1,0.25,-2]' || await ss(`STU.items.get('cube01').rec.size.join()`) !== '1.2,2,1.2' || await ss('unsaved()')) bad.push('Undo did not bring the layout back: ' + JSON.stringify(await ss('collabState()')));
    // a cube's card (v117): what it shows and hides as buttons; one flashes the item in the scene (red: hidden by it),
    // Its card opens that item's card, ✕ takes it off the list (one change, Undo)
    await ss(`(select('cube01'), X.tab = 'item', renderPanes(), 0)`);
    const cardB = await ss(`[...document.querySelectorAll('#pane-item button[data-act^="i:"]')].map(b => b.dataset.act + '=' + b.dataset.v).filter(t => /flash|open|unlist/.test(t)).join()`);
    if (cardB !== 'i:flash=fig001,i:open=fig001,i:unlist=show:fig001,i:flash=snd001,i:open=snd001,i:unlist=show:snd001,i:flash=box001,i:open=box001,i:unlist=hide:box001') bad.push('the cube\'s card lists: ' + cardB);
    await stp.click('#pane-item button[data-act="i:flash"][data-v="box001"]');
    const fl = await ss(`(editStep(true), [STU.flash && STU.flash.id, GL.flashBox.visible, GL.flashBox.material.color.getHex()])`);
    if (!(fl[0] === 'box001' && fl[1] && fl[2] === 0xff5a4b)) bad.push('a press on the box in the cube\'s list did not flash it (red): ' + JSON.stringify(fl));
    await ss(`(STU.flash.at -= 2000, editStep(true), 0)`);
    if (await ss('GL.flashBox.visible')) bad.push('the flash did not end after 1.6 s');
    await stp.click('#pane-item button[data-act="i:open"][data-v="snd001"]');
    if (await ss('STU.sel') !== 'snd001' || await ss('X.tab') !== 'item') bad.push('Its card did not open the sound\'s card: ' + await ss('STU.sel'));
    await ss(`(select('cube01'), X.tab = 'item', renderPanes(), 0)`);
    const u1 = await ss('UNDO.length');
    await stp.click('#pane-item button[data-act="i:unlist"][data-v="hide:box001"]');
    const c5 = await ss(`STU.items.get('cube01').rec`);
    if (c5.hide.includes('box001') || await ss('UNDO.length') !== u1 + 1) bad.push('✕ did not take the box off the cube\'s Hides as one change: ' + JSON.stringify(c5));
    await ss('undo()');
    if (!(await ss(`STU.items.get('cube01').rec.hide`)).includes('box001')) bad.push('Undo did not put the box back on the cube\'s Hides');
    await ss(`(select(''), 0)`);
    // added and deleted: a cube, a sound and an object, each selected; Delete takes it off every cube's lists
    const ids = await ss(`[addCube(), addSound('tone.wav'), addModel('box.glb')]`);
    if (ids.some(i => !i) || await ss('STU.items.size') !== 7) bad.push('Add did not place a cube, a sound and a box: ' + JSON.stringify(ids));
    const placed = await ss(`(() => { const b = objBox(STU.items.get('${ids[2]}')); return b && [+b.min.y.toFixed(3), STU.items.get('${ids[2]}').rec.name, STU.items.get('${ids[2]}').rec.clip]; })()`);
    if (!placed || placed[0] !== 0 || placed[1] !== 'box 2' && placed[1] !== 'box' || placed[2] !== 'Spin') bad.push('a box added: not on the floor, named and with its first take: ' + JSON.stringify(placed));
    await ss(`(toggleLink('${ids[0]}', 'show', '${ids[2]}'), deleteItem('${ids[2]}'), 0)`);
    if (await ss(`STU.items.get('${ids[0]}').rec.show.length`) !== 0) bad.push('a deleted object stayed on its cube\'s list');
    await ss(`(deleteItem('${ids[0]}'), deleteItem('${ids[1]}'), select(''), 0)`);
    if (await ss('STU.items.size') !== 4) bad.push('Delete left items: ' + await ss('STU.items.size'));
    while (await ss('UNDO.length')) await ss('undo()');
    if (await ss('STU.items.size') !== 4 || await ss('unsaved()')) bad.push('Undo all the way did not bring the layout back');
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  await step('studio: the shared state and back, a state from the room taken, bad values ignored', async () => {
    const bad = await ss(`(() => {
      const out = [], same = () => { const a = JSON.stringify(collabState()); collabApply(JSON.parse(a)); return JSON.stringify(collabState()) === a; };
      const s0 = collabState();
      if (s0.scene !== 'test' || Object.keys(s0).sort().join() !== 'c.cube01,o.box001,o.fig001,s.snd001,scene,settings' || !same()) out.push('the state is not the scene and its four items, or apply changed it: ' + JSON.stringify(s0).slice(0, 300));
      // from the room: the box moved (it glides there), the sound gone, a new cube
      const st = JSON.parse(JSON.stringify(s0));
      st['o.box001'].p = [0.5, 0.25, -1]; delete st['s.snd001']; st['c.zz9876'] = { name: 'Corner', p: [2, 1, 2], size: [1, 2, 1], show: ['box001'] };
      collabApply(st);
      const s1 = collabState();
      if (JSON.stringify(s1['o.box001'].p) !== '[0.5,0.25,-1]' || 's.snd001' in s1 || !s1['c.zz9876'] || s1['c.zz9876'].mode !== 'while' || !same()) out.push('the room\\'s state was not taken: ' + JSON.stringify(s1).slice(0, 400));
      if (!STU.items.get('box001').gl) out.push('the moved box does not glide');
      // bad values: ignored (the items kept as they are, nothing made)
      const was = JSON.stringify(collabState()), b = JSON.parse(was);
      Object.assign(b, { 'o.box001': { file: '../x.glb', p: [0, 0, 0] }, 'c.zz9876': { p: [1, 2] }, 's.abcdef': { file: 'tone.wav', p: [0, 1, 0], vol: 'loud' }, 'q.abcdef': 1, 'o.TOOLONG1': { file: 'box.glb', p: [0, 0, 0] } });
      collabApply(b);
      if (JSON.stringify(collabState()) !== was) out.push('bad values were taken: ' + JSON.stringify(collabState()).slice(0, 400));
      collabApply(s0);
      if (JSON.stringify(collabState()) !== JSON.stringify(s0)) out.push('the first state did not come back');
      return out;
    })()`);
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  await step('studio: a pretend headset carries an object, both grips size it, a corner stretches a cube, the sticks walk and turn', async () => {
    await until(`[...STU.items.values()].every(it => !it.gl)`, 5000);   // (the glides from the room's state done)
    const bad = await ss(`(() => {
      const out = [], it = STU.items.get('box001'), cube = STU.items.get('cube01');
      setEdit(true); XR.on = true; XR.clear = true; GL.world.updateMatrixWorld(true);
      const ctl = (c, p, hand, axes) => { c.src = { targetRayMode: 'tracked-pointer', handedness: hand || 'right', gamepad: axes ? { axes, buttons: [] } : null }; c.g.visible = true; c.g.matrix.compose(new THREE.Vector3(...p), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); c.o.setFromMatrixPosition(c.g.matrix); };
      const [a, b] = XR.ctrls, w0 = it.holder.getWorldPosition(new THREE.Vector3()), u0 = UNDO.length;
      ctl(a, [w0.x, w0.y + 0.2, w0.z + 0.3]); a.hover = { kind: 'item', id: 'box001' }; xrGrab(a, true);
      if (!a.grab || a.grab.id !== 'box001' || !it.carry) out.push('the grip did not take the box');
      ctl(a, [w0.x + 0.3, w0.y + 0.4, w0.z + 0.3]); carry(a, 0.016);
      const w1 = it.holder.getWorldPosition(new THREE.Vector3());
      if (Math.abs(w1.x - w0.x - 0.3) > 1e-3 || Math.abs(w1.y - w0.y - 0.2) > 1e-3) out.push('the box did not follow the hand: moved ' + w1.clone().sub(w0).toArray().map(v => v.toFixed(3)));
      // the other hand takes it too: both size it with the distance between them
      ctl(b, [w1.x + 0.1, w1.y, w1.z]); b.hover = { kind: 'item', id: 'box001' }; xrGrab(b, true);
      ctl(a, [w1.x - 0.1, w1.y, w1.z]); carry(a, 0.016); carry(b, 0.016);
      ctl(b, [w1.x + 0.2, w1.y, w1.z]); ctl(a, [w1.x - 0.2, w1.y, w1.z]); carry(a, 0.016); carry(b, 0.016);
      xrGrab(b, false); xrGrab(a, false);
      if (Math.abs(it.rec.s - 2) > 0.01 || it.carry) out.push('both grips did not size it twice as big: ' + it.rec.s);
      if (UNDO.length !== u0 + 1) out.push('the carry was not one change for Undo');
      // a selected cube's corner: the grip stretches it, the opposite corner staying
      select('cube01'); GL.world.updateMatrixWorld(true);
      const r0 = cube.rec, k = 7, c0 = new THREE.Vector3(r0.size[0] / 2, r0.size[1] / 2, r0.size[2] / 2).add(new THREE.Vector3(...r0.p)), opp = new THREE.Vector3(...r0.p).sub(new THREE.Vector3(r0.size[0] / 2, r0.size[1] / 2, r0.size[2] / 2));
      const wc = GL.world.localToWorld(c0.clone());
      ctl(a, wc.toArray()); a.hover = { kind: 'item', id: 'cube01', corner: k }; xrGrab(a, true);
      if (!a.grab || a.grab.target !== 'corner') out.push('the grip on a corner did not take it');
      ctl(a, wc.clone().add(new THREE.Vector3(0.4, 0, 0)).toArray()); carry(a, 0.016); xrGrab(a, false);
      const r1 = cube.rec, opp1 = new THREE.Vector3(...r1.p).sub(new THREE.Vector3(r1.size[0] / 2, r1.size[1] / 2, r1.size[2] / 2));
      if (Math.abs(r1.size[0] - r0.size[0] - 0.4) > 0.002 || opp1.distanceTo(opp) > 0.002) out.push('the corner did not stretch the cube: ' + JSON.stringify([r0, r1]));
      // the sticks (VR, nothing carried): the left walks (the scene moves, not the rig), the right turns 30 degrees a flick
      XR.walk.x = XR.walk.z = XR.walk.yaw = 0; XR.head.set(0, 0, 0); XR.headQ.identity(); GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
      ctl(a, [0.2, -0.3, -0.3], 'left', [0, 0, 0, -1]); stickWalk(a, a.src.gamepad, 0.5);
      if (Math.abs(XR.walk.z - 0.75) > 1e-6 || Math.abs(XR.walk.x) > 1e-6) out.push('the left stick did not walk: ' + JSON.stringify(XR.walk));
      ctl(b, [0.2, -0.3, -0.3], 'right', [0, 0, 1, 0]); stickWalk(b, b.src.gamepad, 0.016); stickWalk(b, b.src.gamepad, 0.016);
      if (Math.abs(XR.walk.yaw - Math.PI / 6) > 1e-6) out.push('the right stick did not turn 30 degrees once a flick: ' + XR.walk.yaw);
      xrPlace(); if (Math.abs(GL.world.position.z - XR.walk.z) > 1e-9 || GL.rig.position.length() > 0) out.push('the walk moved the rig, not the scene');
      // passthrough: no stick walk (you walk for real)
      XR.clear = false; const wz = XR.walk.z; stickWalk(a, a.src.gamepad, 0.5); XR.clear = true;
      if (XR.walk.z !== wz) out.push('the stick walked in passthrough');
      // the trigger pointing at nothing clears the selection
      a.hover = null; xrPress(a);
      if (STU.sel) out.push('the trigger on nothing kept the selection');
      xrRecenter();
      if (XR.walk.x || XR.walk.z || XR.walk.yaw) out.push('Recenter did not reset the walk');
      for (const c of XR.ctrls) { c.src = null; c.g.visible = false; c.hover = null; c.grab = null; }
      XR.on = false; STU.hover = ''; GL.rig.position.set(0, 0, 0); GL.world.position.set(0, 0, 0); GL.world.quaternion.identity();
      while (UNDO.length) undo();
      return out;
    })()`);
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  await step('studio: the sticks while something is carried: the left stick up sizes it (twice in 1.5 s, about its middle), left or right turns it; the right stick up pushes it away, left or right turns it; a group about its pivot, a sound\'s reach; a locked item refused; one Undo step each', async () => {
    await until(`[...STU.items.values()].every(it => !it.gl)`, 5000);
    const bad = await ss(`(() => {
      const out = [], it = STU.items.get('box001'), near = (a, b, e) => Math.abs(a - b) <= (e || 1e-4), V = (...a) => new THREE.Vector3(...a);
      setEdit(true); XR.on = true; XR.clear = true; XR.free = false; GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity(); GL.world.position.set(0, 0, 0); GL.world.quaternion.identity(); GL.world.updateMatrixWorld(true);
      const ctl = (c, p, hand, axes) => { c.src = { targetRayMode: 'tracked-pointer', handedness: hand, gamepad: { axes: axes || [0, 0, 0, 0], buttons: [] } }; c.g.visible = true; c.g.matrix.compose(V(...p), new THREE.Quaternion(), V(1, 1, 1)); c.o.setFromMatrixPosition(c.g.matrix); };
      const [a, b] = XR.ctrls, mid = x => itemTopInto(x, V(), true), u0 = UNDO.length, rec0 = JSON.stringify(it.rec), s0 = it.rec.s, q0 = new THREE.Quaternion(...it.rec.q).normalize();
      const w0 = it.holder.getWorldPosition(V()), h0 = [w0.x, w0.y + 0.2, w0.z + 0.6], m0 = mid(it);
      ctl(a, h0, 'right'); ctl(b, [w0.x - 0.4, w0.y, w0.z + 0.5], 'left');
      a.hover = { kind: 'item', id: 'box001' }; xrGrab(a, true);
      if (!a.grab || a.grab.id !== 'box001') out.push('the grip did not take the box');
      // the left stick (the other hand's: it carries nothing) up, held 1.5 s: twice the size, its middle where it was
      ctl(b, [w0.x - 0.4, w0.y, w0.z + 0.5], 'left', [0, 0, 0, -1]); carry(a, 1.5);
      if (!near(it.holder.scale.x, 2 * s0, 1e-6) || mid(it).distanceTo(m0) > 1e-4) out.push('the left stick up did not size it twice about its middle: ' + it.holder.scale.x + ' ' + mid(it).distanceTo(m0));
      // walking does nothing meanwhile
      const wz = XR.walk.z; stickWalk(b, b.src.gamepad, 0.5);
      if (XR.walk.z !== wz) out.push('the left stick walked while something was carried');
      // the left stick right, 1 s: a quarter turn about the vertical (its near side to the right), its middle kept
      ctl(b, [w0.x - 0.4, w0.y, w0.z + 0.5], 'left', [0, 0, 1, 0]); carry(a, 1);
      const want = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2).multiply(q0);
      if (it.holder.quaternion.angleTo(want) > 1e-4 || mid(it).distanceTo(m0) > 1e-4) out.push('the left stick right did not turn it a quarter about its middle: ' + it.holder.quaternion.toArray().map(v => v.toFixed(4)) + ' ' + mid(it).distanceTo(m0));
      // the right stick up, 0.5 s: pushed away along the hand's line to it (its reach e^0.75 times), the rest kept
      ctl(b, [w0.x - 0.4, w0.y, w0.z + 0.5], 'left'); ctl(a, h0, 'right', [0, 0, 0, -1]); carry(a, 0.5);
      const push = w0.clone().sub(V(...h0)).multiplyScalar(Math.exp(0.75) - 1), m1 = mid(it);
      if (m1.distanceTo(m0.clone().add(push)) > 1e-4 || !(m1.distanceTo(V(...h0)) > m0.distanceTo(V(...h0)) + 0.1)) out.push('the right stick up did not push it away: ' + m1.toArray().map(v => v.toFixed(3)));
      // the right stick left, 1 s: back a quarter turn
      ctl(a, h0, 'right', [0, 0, -1, 0]); carry(a, 1);
      if (it.holder.quaternion.angleTo(q0) > 1e-4) out.push('the right stick left did not turn it back');
      ctl(a, h0, 'right'); xrGrab(a, false);
      if (!near(it.rec.s, 2 * s0) || it.carry) out.push('the size was not written: ' + it.rec.s);
      if (UNDO.length !== u0 + 1) out.push('the carry with the sticks was not one Undo step: ' + (UNDO.length - u0));
      undo();
      if (JSON.stringify(it.rec) !== rec0) out.push('Undo did not put it back');
      // a group (the box and the cube) about its pivot: twice the size and a quarter turn
      const gid = 'grp0v1'; change(() => putItem(gid, 'g', norm('g', { name: 'Pair', items: ['box001', 'cube01'] })));
      const g = STU.items.get(gid), cube = STU.items.get('cube01'), bp = V(...it.rec.p), cp = V(...cube.rec.p), cy = cube.rec.yaw, cs = cube.rec.size.slice(), u1 = UNDO.length;
      select(''); a.hover = { kind: 'item', id: 'box001' }; ctl(b, [w0.x - 0.4, w0.y, w0.z + 0.5], 'left'); xrGrab(a, true);
      if (!a.grab || a.grab.target !== 'group') out.push('the grip on a member did not take its group');
      const P = g.base ? g.base.P.clone() : V();
      ctl(b, [w0.x - 0.4, w0.y, w0.z + 0.5], 'left', [0, 0, 0, -1]); carry(a, 1.5);
      ctl(b, [w0.x - 0.4, w0.y, w0.z + 0.5], 'left', [0, 0, 1, 0]); carry(a, 1);
      ctl(b, [w0.x - 0.4, w0.y, w0.z + 0.5], 'left'); xrGrab(a, false);
      const at = p => p.clone().sub(P).multiplyScalar(2).applyAxisAngle(V(0, 1, 0), Math.PI / 2).add(P);
      if (V(...it.rec.p).distanceTo(at(bp)) > 2e-3 || !near(it.rec.s, 2 * s0) || new THREE.Quaternion(...it.rec.q).normalize().angleTo(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2).multiply(q0)) > 1e-3) out.push('the group did not size and turn the box about its pivot: ' + JSON.stringify(it.rec));
      if (V(...cube.rec.p).distanceTo(at(cp)) > 2e-3 || !near(cube.rec.yaw, cy + Math.PI / 2, 1e-3) || cube.rec.size.some((v, i) => !near(v, 2 * cs[i], 2e-3))) out.push('the group did not size and turn the cube about its pivot: ' + JSON.stringify(cube.rec));
      if (UNDO.length !== u1 + 1) out.push('the group\\'s carry was not one Undo step');
      undo(); undo();
      if (STU.items.has(gid) || JSON.stringify(it.rec) !== rec0) out.push('Undo did not take the group back');
      // a sound: the left stick sizes its reach
      const snd = STU.items.get('snd001'), r0 = snd.rec.r, u2 = UNDO.length;
      a.hover = { kind: 'item', id: 'snd001' }; xrGrab(a, true);
      ctl(b, [w0.x - 0.4, w0.y, w0.z + 0.5], 'left', [0, 0, 0, -1]); carry(a, 1.5);
      ctl(b, [w0.x - 0.4, w0.y, w0.z + 0.5], 'left'); xrGrab(a, false);
      if (!near(snd.rec.r, Math.min(20, 2 * r0), 0.011) || UNDO.length !== u2 + 1) out.push('the left stick did not size the sound\\'s reach: ' + snd.rec.r);
      undo();
      // locked in place: the grip refused, so the sticks do nothing
      change(() => setRec('box001', { locked: true }));
      const rl = JSON.stringify(it.rec), u3 = UNDO.length;
      a.hover = { kind: 'item', id: 'box001' }; xrGrab(a, true);
      if (a.grab) { out.push('the grip took a locked box'); ctl(b, [w0.x - 0.4, w0.y, w0.z + 0.5], 'left', [0, 0, 0, -1]); carry(a, 1.5); xrGrab(a, false); }
      if (JSON.stringify(it.rec) !== rl || UNDO.length !== u3) out.push('a locked box was changed by the sticks');
      undo();
      for (const c of XR.ctrls) { c.src = null; c.g.visible = false; c.hover = null; c.grab = null; }
      XR.on = false; STU.hover = ''; select('');
      while (UNDO.length) undo();
      return out;
    })()`);
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  await step('studio: in a headset, inside a model and pointing at nothing it is pointed at (another item in front wins; outside, nothing); in Walk view the same, the floor still walking; Hold it carries it with a grip on nothing (one Undo step)', async () => {
    await until(`[...STU.items.values()].every(it => !it.gl) && STUDIO.ready()`, 10000);
    await frames(4);
    const bad = await ss(`(() => {
      const out = [], fig = STU.items.get('fig001'), [a, b] = XR.ctrls;
      setEdit(true); select(''); XR.on = true; XR.clear = true; XR.hold = '';
      GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity(); GL.world.position.set(0, 0, 0); GL.world.quaternion.identity(); GL.world.scale.setScalar(1); GL.world.updateMatrixWorld(true);
      const ctl = (c, p, q, hand, axes) => { c.src = { targetRayMode: 'tracked-pointer', handedness: hand || 'right', gamepad: axes ? { axes, buttons: [] } : null }; c.g.visible = true; c.g.matrix.compose(new THREE.Vector3(...p), q || new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); c.o.setFromMatrixPosition(c.g.matrix); };
      const aim = (from, to) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), to.clone().sub(from).normalize());
      const draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } };
      // the controller inside the figure's unseen box, high in it (clear of its sound), pointing up and back at nothing
      const fb = new THREE.Box3().setFromObject(fig.proxy), c0 = fb.getCenter(new THREE.Vector3()), pin = new THREE.Vector3(c0.x, fb.max.y - 0.12, c0.z);
      const away = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 1).normalize());
      ctl(a, pin.toArray(), away); xrPoint(a, 0.016);
      const h1 = a.hover && { kind: a.hover.kind, id: a.hover.id, inside: !!a.hover.inside, d: a.hover.point && fb.distanceToPoint(a.hover.point) };
      if (!h1 || h1.kind !== 'item' || h1.id !== 'fig001' || !h1.inside || h1.d > 1e-3) out.push('pointing at nothing from inside the figure\\'s box: not the figure, its dot on its box: ' + JSON.stringify(h1));
      xrPress(a);
      if (STU.sel !== 'fig001') out.push('the trigger there did not select the figure: ' + STU.sel);
      // from there at the box: the box (something hit wins over the box you stand in)
      const bw = STU.items.get('box001').holder.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.05, 0));
      ctl(a, pin.toArray(), aim(pin, bw)); xrPoint(a, 0.016);
      if (!a.hover || a.hover.id !== 'box001' || a.hover.inside) out.push('pointing at the box from inside the figure\\'s box: not the box: ' + JSON.stringify(a.hover && [a.hover.kind, a.hover.id, a.hover.inside]));
      // outside every box, pointing at nothing: nothing (and the trigger clears the selection, as before)
      ctl(a, [0, 2.6, 3], away); xrPoint(a, 0.016);
      if (a.hover && a.hover.kind === 'item') out.push('outside every box, pointing at nothing: an item: ' + a.hover.id);
      xrPress(a);
      if (STU.sel) out.push('the trigger at nothing outside every box kept the selection');
      // editing off: nothing pointed at, inside or not
      setEdit(false); ctl(a, pin.toArray(), away); xrPoint(a, 0.016);
      if (a.hover && a.hover.kind === 'item') out.push('editing off, inside the figure: it was pointed at');
      setEdit(true);
      // Hold it on the figure's headset card: the next grip of the other hand, on nothing, carries it from where it stands
      select('fig001'); X.tab = 'item'; X.scroll = {}; draw();
      let hr = null;
      for (let off = 0; off < 4000 && !hr; off += 150) { X.scroll.item = off; draw(); hr = XR.main.regions.find(q => q.id === 'hold'); }
      if (!hr) out.push('the figure\\'s headset card has no Hold it');
      else hr.fn();
      if (XR.hold !== 'fig001') out.push('Hold it did not arm: ' + XR.hold);
      if (paneBlocks('item').filter(b => !b.xr).some(x => (x.row || []).some(r => r.id === 'hold'))) out.push('Hold it is on the page\\'s card too');
      const u0 = UNDO.length, w0 = fig.holder.getWorldPosition(new THREE.Vector3()), p0 = JSON.stringify(fig.rec.p);
      ctl(b, [3, 1, 3], away); b.hover = null; xrGrab(b, true);
      if (!b.grab || b.grab.id !== 'fig001' || b.grab.target !== 'item' || XR.hold) out.push('a grip on nothing after Hold it did not take the figure: ' + JSON.stringify(b.grab && [b.grab.target, b.grab.id]) + ' ' + XR.hold);
      ctl(b, [3.4, 1.2, 3], away); carry(b, 0.016);
      const w1 = fig.holder.getWorldPosition(new THREE.Vector3());
      if (Math.abs(w1.x - w0.x - 0.4) > 1e-3 || Math.abs(w1.y - w0.y - 0.2) > 1e-3 || Math.abs(w1.z - w0.z) > 1e-3) out.push('the figure did not follow the hand from where it stood: moved ' + w1.clone().sub(w0).toArray().map(v => v.toFixed(3)));
      xrGrab(b, false);
      if (UNDO.length !== u0 + 1 || JSON.stringify(fig.rec.p) === p0) out.push('the carry was not one change for Undo: ' + (UNDO.length - u0));
      undo();
      if (JSON.stringify(fig.rec.p) !== p0) out.push('Undo did not put the figure back');
      // without it, a grip on nothing takes nothing; armed, another selection or editing off disarms it
      b.hover = null; xrGrab(b, true);
      if (b.grab) out.push('a grip on nothing took something without Hold it');
      xrGrab(b, false);
      select('fig001'); itemAct('hold'); select('box001'); holdStep();
      if (XR.hold) out.push('another selection did not disarm Hold it');
      select('fig001'); itemAct('hold'); itemAct('hold');
      if (XR.hold) out.push('Hold it pressed again did not disarm it');
      for (const c of XR.ctrls) { c.src = null; c.g.visible = false; c.hover = null; c.grab = null; }
      XR.on = false; STU.hover = ''; select(''); X.tab = 'scene'; X.scroll = {};
      // Walk view on a page: the camera inside the figure's box, looking up: a click selects it; down at the floor it walks
      setView('walk'); WALK.pos.set(c0.x, 1.6, c0.z); WALK.yaw = 0; WALK.pitch = 1.1; WALK.to = null; walkStep(0); GL.camera.updateMatrixWorld(true);
      const inFig = fb.containsPoint(GL.camera.position);
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2, hv = rayPick(pointerRay(cx, cy), { inside: walkInside(pointerRay(cx, cy)) });
      clickAt(cx, cy);
      if (!inFig || !hv || hv.id !== 'fig001' || STU.sel !== 'fig001' || WALK.to) out.push('Walk view inside the figure\\'s box, a click on nothing: ' + JSON.stringify({ inFig, hv: hv && hv.id, sel: STU.sel, to: !!WALK.to }));
      WALK.pitch = -1.1; walkStep(0); GL.camera.updateMatrixWorld(true); clickAt(cx, cy);
      if (!WALK.to || STU.sel !== 'fig001') out.push('Walk view inside the figure\\'s box, a click on the floor did not walk there: ' + JSON.stringify({ to: !!WALK.to, sel: STU.sel }));
      WALK.to = null;
      setView('orbit'); select('');
      while (UNDO.length) undo();
      return out;
    })()`);
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  await step('studio: a headset\'s stick scrolls the pane its ray is on (up and down, held at the ends; not while it carries something), and walks again pointing away', async () => {
    const bad = await ss(`(() => {
      const out = [], [a] = XR.ctrls;
      setEdit(true); XR.on = true; XR.clear = true; select('fig001'); X.tab = 'item'; X.scroll = {};
      const draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } };
      const ctl = (c, p, q, hand, axes) => { c.src = { targetRayMode: 'tracked-pointer', handedness: hand || 'left', gamepad: axes ? { axes, buttons: [] } : null }; c.g.visible = true; c.g.matrix.compose(new THREE.Vector3(...p), q || new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); c.o.setFromMatrixPosition(c.g.matrix); };
      draw();
      const max = X.scrollMax.item || 0;
      if (!(max > 0)) out.push('the figure\\'s headset card does not overflow the panel: ' + max);
      // the ray on the panel (its mesh shown, the controller 0.6 m in front of it), the left stick pushed down: it scrolls
      XR.main.mesh.visible = true; GL.rig.updateMatrixWorld(true);
      const m = XR.main.mesh, pw = m.getWorldPosition(new THREE.Vector3()), pn = new THREE.Vector3(0, 0, 1).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion()));
      const from = pw.clone().addScaledVector(pn, 0.6), face = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), pn.clone().negate());
      XR.walk.x = XR.walk.z = XR.walk.yaw = 0; XR.head.set(0, 1.6, 0); XR.headQ.identity();
      ctl(a, from.toArray(), face, 'left', [0, 0, 0, 0.9]);
      xrPoint(a, 0.1);
      if (!a.hover || a.hover.kind !== 'panel' || a.hover.P !== XR.main) out.push('the ray in front of the panel is not on it: ' + (a.hover && a.hover.kind));
      const s1 = X.scroll.item || 0;
      for (let k = 0; k < 6; k++) xrPoint(a, 0.1);
      const s2 = X.scroll.item || 0;
      if (!(s1 > 0 && s2 > s1)) out.push('the stick pushed down did not scroll the pane: ' + [s1, s2]);
      if (XR.walk.x || XR.walk.z) out.push('the left stick walked while its ray was on the panel: ' + JSON.stringify(XR.walk));
      for (let k = 0; k < 80; k++) xrPoint(a, 0.1);
      if (X.scroll.item !== max) out.push('held down, it did not stop at the pane\\'s end: ' + X.scroll.item + ' of ' + max);
      // in the dead zone nothing; pushed up it scrolls back to the top and stops there
      a.src.gamepad.axes[3] = 0.12; const s3 = X.scroll.item; xrPoint(a, 0.1);
      if (X.scroll.item !== s3) out.push('a stick within its dead zone scrolled');
      a.src.gamepad.axes[3] = -1; for (let k = 0; k < 80; k++) xrPoint(a, 0.1);
      if (X.scroll.item !== 0) out.push('pushed up it did not scroll back to the top: ' + X.scroll.item);
      // a ramp: held longer, faster (from a third of the speed)
      a.src.gamepad.axes[3] = 0; xrPoint(a, 0.05);
      a.src.gamepad.axes[3] = 0.6; xrPoint(a, 0.05); const v1 = X.scroll.item; for (let k = 0; k < 12; k++) xrPoint(a, 0.05); const t0 = X.scroll.item; xrPoint(a, 0.05); const v2 = X.scroll.item - t0;
      if (!(v2 > v1 * 1.5)) out.push('held, the scroll did not speed up: ' + [v1, v2]);
      // the right stick on the panel neither turns nor scrolls sideways; carrying something, no scroll
      const yaw0 = XR.walk.yaw; ctl(XR.ctrls[1], from.toArray(), face, 'right', [0, 0, 1, 0]); xrPoint(XR.ctrls[1], 0.1); xrPoint(XR.ctrls[1], 0.1);
      if (XR.walk.yaw !== yaw0) out.push('the right stick turned while its ray was on the panel');
      XR.ctrls[1].src = null; XR.ctrls[1].g.visible = false; XR.ctrls[1].hover = null;
      a.grab = { target: 'panel', q0: new THREE.Quaternion(), o0: a.o.clone(), p0: a.o.clone(), reach: 1, r0: new THREE.Quaternion() };
      const s4 = X.scroll.item; a.src.gamepad.axes[3] = 1; stickScroll(a, a.src.gamepad, 0.5);
      if (X.scroll.item !== s4) out.push('a hand carrying something scrolled');
      a.grab = null;
      // pointing away from the panel: the left stick walks again, and nothing scrolls
      const up = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0));
      ctl(a, [0, 1.2, 0], up, 'left', [0, 0, 0, -1]); const s5 = X.scroll.item;
      xrPoint(a, 0.5);
      if (!(XR.walk.z > 0.5) || X.scroll.item !== s5) out.push('pointing away, the left stick did not walk (or still scrolled): ' + JSON.stringify([XR.walk, X.scroll.item, s5]));
      xrRecenter(); XR.turnArm = true;
      XR.main.mesh.visible = false;
      for (const c of XR.ctrls) { c.src = null; c.g.visible = false; c.hover = null; c.grab = null; }
      XR.on = false; STU.hover = ''; select(''); X.tab = 'scene'; X.scroll = {}; GL.rig.position.set(0, 0, 0); GL.world.position.set(0, 0, 0); GL.world.quaternion.identity();
      return out;
    })()`);
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  await step('studio: New scene (the page\'s field, a headset\'s keypad, its rules) and From another scene only with a relay that takes uploads; a circle made for one scene writes its saved layout', async () => {
    const bad = await ss(`(async () => {
      const out = [], keep = { fetch: window.fetch, src: Object.assign({}, SRC), kp: HOST.collab.keypad, ls: listScenes, os: openScene, el: editLocked, live: HOST.collab.live, edit: STU.edit, ri: removeItem, pi: putItem };
      const opened = [], posts = [], asked = [], has = (tab, id) => paneBlocks(tab).some(b => (b.row || []).some(x => x.id === id) || (b.list || []).some(x => x.id === id));
      const wait = async (f, ms) => { for (const end = performance.now() + (ms || 3000); performance.now() < end; await new Promise(r => setTimeout(r, 30))) if (f()) return true; return false; };
      try {
        setEdit(true);
        // the folder of scenes (read only): neither
        if (has('scene', 'newscene')) out.push('New scene offered with a folder of scenes');
        if (has('add', 'from')) out.push('From another scene offered with a folder of scenes');
        // a relay that takes uploads (stubbed): New scene on the page, through its field
        Object.assign(SRC, { kind: 'relay', base: 'http://relay.test', token: '', state: 'ok', save: true, upload: true, held: false, scenes: [{ name: 'test' }, { name: 'other' }] });
        HOST.collab.keypad = undefined;
        listScenes = async () => {};
        openScene = (n, how) => { opened.push([n, how]); };
        window.fetch = async (u, o) => {
          u = String(u);
          if (o && o.method === 'POST' && u === 'http://relay.test/api/scenes') {
            const n = JSON.parse(o.body).name; posts.push(n);
            return n === 'taken' ? new Response('{"error":"there is a scene (or a file) by that name"}', { status: 409 }) : new Response(JSON.stringify({ ok: true, name: n }), { status: 201 });
          }
          return new Response('{"error":"not here"}', { status: 404 });
        };
        if (!has('scene', 'newscene') || !has('add', 'from')) out.push('a relay that takes uploads: New scene or From another scene not offered: ' + [has('scene', 'newscene'), has('add', 'from')]);
        X.tab = 'scene'; act('newscene'); renderPanes();
        const inp = document.querySelector('#stuSceneName');
        if (!inp) out.push('New scene on the page did not open its field');
        else {
          inp.value = 'Made here'; inp.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('#pane-scene [data-act="scenemake"]').click();
          if (!await wait(() => opened.length)) out.push('Make it did not make and open the scene');
          if (JSON.stringify(posts) !== '["Made here"]' || JSON.stringify(opened) !== '[["Made here","pick"]]' || NS.open || NS.note) out.push('Make it: ' + JSON.stringify({ posts, opened, open: NS.open, note: NS.note }));
        }
        // its rules: a bad name refused here (nothing sent), a name taken said
        posts.length = 0; opened.length = 0;
        await sceneMake('-dash'); const n1 = NS.note; await sceneMake('nul'); const n2 = NS.note; await sceneMake('taken');
        if (posts.join() !== 'taken' || opened.length || !/A scene's name/.test(n1) || !/A scene's name/.test(n2) || !/There is a scene called taken already/.test(NS.note)) out.push('the name rules: ' + JSON.stringify({ posts, opened, n1, n2, note: NS.note }));
        NS.note = '';
        // a headset: only with the shell's keypad; its name from the keypad (cancelled: nothing)
        XR.on = true;
        if (has('scene', 'newscene')) out.push('a headset without the shell\\'s keypad offers New scene');
        let give = null;
        HOST.collab.keypad = async o => { asked.push(o); return give; };
        if (!has('scene', 'newscene')) out.push('a headset with the shell\\'s keypad does not offer New scene');
        posts.length = 0; opened.length = 0;
        await sceneAsk();
        give = 'from headset'; await sceneAsk();
        if (asked.length !== 2 || asked[0].title !== 'New scene' || asked[0].max !== 64 || JSON.stringify(posts) !== '["from headset"]' || JSON.stringify(opened) !== '[["from headset","pick"]]') out.push('the headset\\'s keypad: ' + JSON.stringify({ asked, posts, opened }));
        if (paneBlocks('scene').some(b => b.input)) out.push('the headset\\'s pane has the page\\'s field');
        XR.on = false;
        // a visitor, a locked scene, a read-only relay: neither
        OPT.visit = true; const v1 = has('scene', 'newscene') || has('add', 'from'); OPT.visit = false;
        editLocked = () => true; const v2 = has('scene', 'newscene') || has('add', 'from'); editLocked = keep.el;
        SRC.upload = false; const v3 = has('scene', 'newscene') || has('add', 'from'); SRC.upload = true;
        if (v1 || v2 || v3) out.push('offered to a visitor, while locked or on a read-only relay: ' + [v1, v2, v3]);
        // a circle made for one scene (its state names the scene, no item): opened to write its saved layout; with items, the room's
        opened.length = 0;
        HOST.collab.live = () => ({ id: 'stnew1', story: 'studio' });
        removeItem = () => {}; putItem = () => null;   // (the test scene's items stay as they are)
        collabApply({ scene: 'other' });
        collabApply({ scene: 'third', 'o.abcdef': { name: 'A', file: 'box.glb', p: [0, 0, 0] } });
        HOST.collab.live = () => ({ id: 'stnew2', story: 'studio' });
        collabApply({ scene: STU.scene });
        if (JSON.stringify(opened) !== JSON.stringify([['other', 'fresh'], ['third', 'room'], [STU.scene, 'fresh']])) out.push('a circle made for one scene: ' + JSON.stringify(opened));
      } finally {
        window.fetch = keep.fetch; HOST.collab.keypad = keep.kp; listScenes = keep.ls; openScene = keep.os; editLocked = keep.el; HOST.collab.live = keep.live; removeItem = keep.ri; putItem = keep.pi; OPT.visit = false; XR.on = false;
        Object.assign(SRC, keep.src); Object.assign(NS, { open: false, name: '', note: '', making: false, asking: false }); STU.stId = ''; setEdit(keep.edit); X.tab = 'scene'; renderPanes();
      }
      return out;
    })()`);
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  await step('studio: the relay\'s watch (a scene added, a layout removed) and its password (one refusal told once, nothing more asked until another)', async () => {
    const bad = await ss(`(async () => {
      const out = [], keep = { fetch: window.fetch, saw: HOST.collab.relaySaw, find: HOST.collab.relayFind, fs: findSource, src: Object.assign({}, SRC), stu: [STU.saved, STU.savedAt, STU.savedBy, STU.mine] };
      let fetched = 0, sawn = [], found = 0, tok = 'old';
      try {
        // the watch: a scene folder added (the picker follows), the scene's layout.json removed (no saved layout, the items kept)
        SRC.kind = 'relay';
        onScenesEvent({ scenes: [{ name: 'test', files: 4 }, { name: 'atelier', files: 5 }, { name: '../no' }] });
        if (SRC.scenes.map(s => s.name).join() !== 'test,atelier') out.push('a scene added: the picker has ' + SRC.scenes.map(s => s.name));
        onLayoutEvent({ name: 'test', at: null, gone: true });
        if (STU.savedAt !== 0 || !unsaved() || STU.items.size !== 4 || !/^Unsaved changes/.test(savedLine())) out.push('the layout removed: ' + JSON.stringify([STU.savedAt, unsaved(), STU.items.size, savedLine()]));
        [STU.saved, STU.savedAt, STU.savedBy, STU.mine] = keep.stu;
        // the password: the first refusal goes to the shell (its prompts), and nothing more goes to the relay until the shell
        // holds another password, the same one seen twice (one being checked is not taken)
        window.fetch = async () => { fetched++; return new Response('{"error":"missing or wrong token"}', { status: 401, headers: { 'Content-Type': 'application/json' } }); };
        HOST.collab.relaySaw = (b, st, sent) => { sawn.push([st, sent]); };
        HOST.collab.relayFind = async () => ({ base: 'http://relay.test', token: tok });
        findSource = () => { found++; };
        Object.assign(SRC, { base: 'http://relay.test', token: 'old', held: false, state: 'ok' });
        for (const p of ['scenes/test/box.glb', 'scenes/test/figure.fbx', 'api/scenes']) { try { await call('http://relay.test/' + p); out.push('a refused call did not throw'); } catch (e) { if (e.status !== 401) out.push('a refused call threw ' + e.status); } }
        if (fetched !== 1 || JSON.stringify(sawn) !== '[[401,"old"]]' || !SRC.held || SRC.state !== 'auth') out.push('after the first refusal: ' + JSON.stringify({ fetched, sawn, held: SRC.held, state: SRC.state }));
        if (!/This relay needs its password/.test(paneBlocks('scene').map(b => b.p || '').join(' '))) out.push('the Scene pane does not say the relay needs its password');
        await authStep(); await authStep();
        tok = 'new'; await authStep();
        if (found) out.push('a password seen once (perhaps still being checked) was taken');
        await authStep();
        if (found !== 1 || SRC.held || fetched !== 1) out.push('another password held twice did not list the scenes again: ' + JSON.stringify({ found, held: SRC.held, fetched }));
      } finally {
        unlater(SRC.retry); window.fetch = keep.fetch; HOST.collab.relaySaw = keep.saw; HOST.collab.relayFind = keep.find; findSource = keep.fs;
        Object.assign(SRC, keep.src, { held: false, retry: 0 }); dirty(true);
      }
      return out;
    })()`);
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  await step('studio: the sound plays from its place through an HRTF panner once shown, silent while muted', async () => {
    const bad = [];
    await stp.evaluate(() => HOST.audio.mute(false));
    await stp.click('#explore .tabs button[data-tab="scene"]');   // (a tap: the sound may start)
    await ss(`(X.tab = 'scene', renderPanes(), shownFor([0, 1.6, 0]), 0)`);
    if (!await until(`!!(STU.items.get('snd001').src && STU.items.get('snd001').gt > 0.1)`, 15000)) bad.push('the shown sound did not start: ' + JSON.stringify(await ss(`[!!HOST.audio.fx(), HOST.audio.muted, STUDIO.state().sounds, STU.items.get('snd001').shown]`)));
    else {
      const p = await ss(`(() => { const it = STU.items.get('snd001'), n = it.pan, w = it.holder.getWorldPosition(new THREE.Vector3()); return [n.panningModel, n.distanceModel, n.refDistance, n.maxDistance, n.rolloffFactor, n.positionX ? [n.positionX.value, n.positionY.value, n.positionZ.value].map(v => +v.toFixed(3)) : null, w.toArray().map(v => +v.toFixed(3))]; })()`);
      if (p[0] !== 'HRTF' || p[1] !== 'inverse' || p[2] !== 1.5 || p[3] !== 50 || p[4] !== 1 || JSON.stringify(p[5]) !== JSON.stringify(p[6])) bad.push('its panner: ' + JSON.stringify(p));
      await stp.evaluate(() => HOST.audio.mute(true));
      if (!await until(`!STU.items.get('snd001').src`, 8000)) bad.push('muted, the sound went on');
    }
    await ss(`(shownFor(null), 0)`);
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  await step('studio: a sound longer than 20 s is streamed through an element (no decoded buffer), a short one decoded; paused while muted', async () => {
    const bad = [];
    await stp.evaluate(() => HOST.audio.mute(false));
    await stp.click('#explore .tabs button[data-tab="scene"]');   // (a tap)
    const id = await ss(`(setEdit(true), addSound('sounds/long.wav'))`);
    if (!id) { errors.push('studio: the long sound was not placed'); return; }
    await until(`(() => { const it = STU.items.get('${id}'); return !!(it && it.st && !it.st.el.paused && it.gt > 0); })()`, 15000);
    const r = await ss(`(() => { const it = STU.items.get('${id}'), F = SND.get('sounds/long.wav'), T = SND.get('tone.wav');
      return { F: [F.state, F.stream, Math.round(F.dur), !!F.buf, F.size, !!F.bytes], T: [T.state, T.stream, !!T.buf], st: !!it.st, playing: !!(it.st && !it.st.el.paused), cross: it.st && it.st.el.crossOrigin,
        pan: it.pan && [it.pan.panningModel, it.pan.refDistance], src: !!(it.st && it.st.el.src.includes('sounds/long.wav')), node: !!(it.st && it.st.node && it.st.node.mediaElement === it.st.el) }; })()`);
    if (JSON.stringify(r.F) !== '["stream",true,25,false,0,false]') bad.push('the 25 s sound is not streamed (no fetch, no decoded buffer): ' + JSON.stringify(r.F));
    if (JSON.stringify(r.T) !== '["ready",false,true]') bad.push('the short tone is not decoded: ' + JSON.stringify(r.T));
    if (!r.st || !r.playing || r.cross !== 'anonymous' || !r.node || !r.src || !r.pan || r.pan[0] !== 'HRTF' || r.pan[1] !== 1.5) bad.push('the streamed sound\'s element and panner: ' + JSON.stringify(r));
    await stp.evaluate(() => HOST.audio.mute(true));
    if (!await until(`(() => { const it = STU.items.get('${id}'); return !!(it.st && it.st.el.paused && !it.src); })()`, 8000)) bad.push('muted, the streamed sound went on (or its element was torn down)');
    await ss(`(deleteItem('${id}'), 0)`);
    if (await ss(`!!STU.items.get('${id}')`)) bad.push('the long sound was not deleted');
    while (await ss('UNDO.length')) await ss('undo()');
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  await step('studio: GLB first: the Add list\'s folders, an OBJ from originals/, Convert to GLB in the page (downloaded), the switch keeping a placed figure where it stands', async () => {
    const bad = [];
    await ss(`(setEdit(true), X.tab = 'add', X.orig = false, renderPanes(), 0)`);
    // the Add list: models/ and sounds/ and the scene's top (the originals folded), the long sound streamed
    let L = await ss(`(() => { const L = sceneLists(); return { m: L.models.map(f => f.path), s: L.sounds.map(f => f.path), o: L.orig.map(f => f.path) }; })()`);
    if (L.m.join() !== 'box.glb,figure.fbx' || L.s.join() !== 'sounds/long.wav,tone.wav' || L.o.join() !== 'originals/crate.mtl,originals/crate.obj,originals/crate.png') bad.push('the Add list: ' + JSON.stringify(L));
    const ap = await stp.evaluate(() => document.querySelector('#pane-add').textContent.replace(/\s+/g, ' '));
    if (!/Originals \(3\) ▸/.test(ap) || /crate\.obj/.test(ap) || !/Convert every model to GLB \(1\)/.test(ap)) bad.push('the Add pane (Originals folded, Convert every model): ' + ap.slice(0, 400));
    await stp.click('#pane-add [data-act="orig"]');
    if (!/crate\.obj/.test(await stp.evaluate(() => document.querySelector('#pane-add').textContent))) bad.push('Originals did not unfold');
    // an OBJ (with its MTL and texture) from originals/: no units, so centimetres (80 units: 0.8 m)
    const cid = await ss(`addModel('originals/crate.obj')`);
    await until(`(() => { const E = LIB.get('originals/crate.obj'); return E && (E.state === 'ready' || E.state === 'failed'); })()`, 20000);
    const cr = await ss(`(() => { const E = LIB.get('originals/crate.obj'), b = objBox(STU.items.get('${cid}')); return E.info ? [E.state, E.guess.how, E.guess.s, E.info.tris, E.info.textures.map(t => t.name + ' ' + t.w).join(), [...E.missing].join(), guessWords(E.guess), b && +b.getSize(new THREE.Vector3()).x.toFixed(3)] : [E.state, E.err]; })()`);
    if (JSON.stringify(cr) !== JSON.stringify(['ready', 'cm', 0.01, 12, 'crate.png 8', '', 'the file gives no units: taken as centimetres', 0.8])) bad.push('the crate (an OBJ in centimetres): ' + JSON.stringify(cr));
    await ss(`(deleteItem('${cid}'), 0)`);
    // a GLB standing for its original: by its record's from, or (no record) by its base name; placing the original places it
    const fake = await ss(`(() => {
      const keep = STU.files.slice(), out = [];
      setFiles(keep.concat({ path: 'models/figure.glb', bytes: 5000, at: 1, kind: 'model' }, { path: 'models/crate.glb', bytes: 3000, at: 1, kind: 'model' }));
      GLBREC.set('models/figure.glb', { at: 1, rec: { from: 'figure.fbx', s: 0.01, q: [-0.707107, 0, 0, 0.707107], at: 1, scan: false }, p: null });
      GLBREC.set('models/crate.glb', { at: 1, rec: null, p: null });
      const L = sceneLists();
      out.push(L.models.map(f => f.path).join(), L.orig.map(f => f.path).join(), JSON.stringify([...L.stands]));
      X.tab = 'item'; select('fig001'); renderPanes(); out.push(document.querySelector('#pane-item').textContent.replace(/\\s+/g, ' ').includes('A converted GLB is in the scene (models/figure.glb): switch to it'));
      select(''); setFiles(keep); GLBREC.delete('models/figure.glb'); GLBREC.delete('models/crate.glb');
      return out;
    })()`);
    if (fake[0] !== 'box.glb,models/crate.glb,models/figure.glb' || fake[1] !== 'figure.fbx,originals/crate.mtl,originals/crate.obj,originals/crate.png' || fake[2] !== '[["figure.fbx","models/figure.glb"],["originals/crate.obj","models/crate.glb"]]' || fake[3] !== true)
      bad.push('a GLB standing for its original (by its record, by its name): ' + JSON.stringify(fake));
    // Convert to GLB on the figure's card: no relay, so downloaded; the GLB's record names the original; it loads back with
    // its triangles and its take
    await ss(`(X.tab = 'item', select('fig001'), renderPanes(), 0)`);
    const card = await stp.evaluate(() => document.querySelector('#pane-item').textContent.replace(/\s+/g, ' '));
    if (!/Convert to GLB/.test(card) || !/It is downloaded/.test(card)) bad.push('the figure\'s card has no Convert to GLB (downloaded without a relay): ' + card.slice(0, 300));
    const dl = stp.waitForEvent('download', { timeout: 60000 }).catch(() => null);
    await stp.click('#pane-item [data-act="convert"]');
    const d = await dl;
    if (!d || d.suggestedFilename() !== 'figure.glb') bad.push('Convert to GLB offered no figure.glb download: ' + (d && d.suggestedFilename()));
    await until(`!CV.busy && !!STUDIO.lastGLB`, 60000);
    const g = await ss(`(async () => {
      const L = STUDIO.lastGLB, j = CONV.glbJSON(L.glb), back = await new Promise((res, rej) => new THREE.GLTFLoader().parse(L.glb.slice(0), '', res, rej));
      let tris = 0; back.scene.traverse(o => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
      return { ok: L.ok, why: L.why, from: j.asset.extras.studio.from, s: j.asset.extras.studio.s, q: j.asset.extras.studio.q, tris, clips: back.animations.map(c => c.name + ' ' + c.duration.toFixed(1)), images: (j.images || []).map(i => i.mimeType), note: CV.note, items: STU.items.size, file: STU.items.get('fig001').rec.file };
    })()`);
    if (!g.ok || g.from !== 'figure.fbx' || g.s !== 0.01 || JSON.stringify(g.q) !== '[-0.707107,0,0,0.707107]' || g.tris !== 12 || g.clips.join() !== 'Take 001 2.0' || g.images.join() !== 'image/jpeg' || g.file !== 'figure.fbx' || !/downloaded as figure\.glb/.test(g.note)) bad.push('the converted figure: ' + JSON.stringify(g));
    // the switch: the GLB served as models/figure.glb, the placed figure switched to it, its corners where they were (1 mm)
    const bytes = Buffer.from(await ss(`(() => { const u = new Uint8Array(STUDIO.lastGLB.glb); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); })()`), 'base64');
    await stp.route('**/scenes/test/models/figure.glb*', route => route.fulfill({ body: bytes, contentType: 'model/gltf-binary' }));
    const corners = `(() => { const it = STU.items.get('fig001'), E = it.E, b = E.info.box, M = new THREE.Matrix4().compose(new THREE.Vector3().fromArray(it.rec.p), new THREE.Quaternion().fromArray(it.rec.q), new THREE.Vector3().setScalar(it.rec.s)), out = [];
      for (let k = 0; k < 8; k++) out.push(new THREE.Vector3(k & 1 ? b[1][0] : b[0][0], k & 2 ? b[1][1] : b[0][1], k & 4 ? b[1][2] : b[0][2]).applyMatrix4(M).toArray()); return out; })()`;
    const c0 = await ss(corners), u0 = await ss('UNDO.length');
    await ss(`(setFiles(STU.files.concat({ path: 'models/figure.glb', bytes: ${bytes.length}, at: 7, kind: 'model' })), GLBREC.set('models/figure.glb', { at: 7, rec: STUDIO.lastGLB.record, p: null }), 0)`);
    const n = await ss(`switchToGLB('figure.fbx', 'models/figure.glb', STUDIO.lastGLB.record)`);
    if (!await until(`(() => { const it = STU.items.get('fig001'); return it.rec.file === 'models/figure.glb' && it.E && it.E.state === 'ready' && !!it.model; })()`, 30000)) bad.push('the figure did not switch to the GLB: ' + JSON.stringify(await ss(`[STU.items.get('fig001').rec, STU.items.get('fig001').E && STU.items.get('fig001').E.state]`)));
    else {
      const c1 = await ss(corners), worst = Math.max(...c0.map(p => Math.min(...c1.map(q => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])))));
      const r = await ss(`[STU.items.get('fig001').rec, UNDO.length, LIB.get('models/figure.glb').record && LIB.get('models/figure.glb').record.from]`);
      if (n !== 1 || worst > 0.001 || r[0].s !== 1 || JSON.stringify(r[0].q) !== '[0,0,0,1]' || r[1] !== u0 + 1 || r[2] !== 'figure.fbx') bad.push('the switch: ' + JSON.stringify({ n, worst, rec: r[0], undo: [u0, r[1]], from: r[2] }));
    }
    await ss('undo()');
    if (await ss(`STU.items.get('fig001').rec.file`) !== 'figure.fbx') bad.push('Undo did not take the switch back');
    await ss(`(setFiles(STU.files.filter(f => f.path !== 'models/figure.glb')), GLBREC.delete('models/figure.glb'), select(''), X.orig = false, X.tab = 'scene', renderPanes(), 0)`);
    await stp.unroute('**/scenes/test/models/figure.glb*');
    while (await ss('UNDO.length')) await ss('undo()');
    if (await ss('STU.items.size') !== 4 || await ss('unsaved()')) bad.push('the layout did not come back after the GLB checks');
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  // the Add pane as a grid with pictures (tools/studio/SPEC.md, "Pictures in the Add pane"): no relay here, so every
  // picture is made for this page only (PV.mem); the relay's side is relay/test.mjs's and collab.mjs --studio's
  await step('studio: the Add pane as a grid with pictures: a card per model (a plain tile with its kind where it has none), sounds a list; Convert to GLB makes one, shown on the page and the headset\'s canvas; Make pictures with no relay makes the rest for this page, and stops; previews/ never a texture', async () => {
    const bad = [];
    await ss(`(pvClear(), select(''), setEdit(true), X.tab = 'add', X.orig = true, renderPanes(), 0)`);
    const cards = () => stp.evaluate(() => [...document.querySelectorAll('#pane-add .stu-grid .stu-card')].map(b => ({ id: b.dataset.id, img: !!b.querySelector('.pic img'), tile: (b.querySelector('.pic b') || {}).textContent || '', text: b.textContent.replace(/\s+/g, ' ').trim() })));
    let c = await cards();
    if (c.map(x => x.id).join() !== 'add:box.glb,add:figure.fbx,add:originals/crate.obj' || c.some(x => x.img) || c.map(x => x.tile).join() !== 'GLB,FBX,OBJ') bad.push('the grid without pictures (plain tiles with their kinds): ' + JSON.stringify(c));
    if (!/^GLBbox\.glb ?0\.5 m · 12 triangles$/.test(c[0] && c[0].text) || !/^FBXfigure\.fbx.*1\.7 m · 12 triangles$/.test(c[1] && c[1].text)) bad.push('the cards\' words (name, size, triangles): ' + JSON.stringify(c.map(x => x.text)));
    const page = await stp.evaluate(() => ({ sounds: document.querySelectorAll('#pane-add .stu-list li[data-act="adds"]').length, make: (document.querySelector('#pane-add [data-act="pics"]') || {}).textContent || '', cols: getComputedStyle(document.querySelector('#pane-add .stu-grid')).gridTemplateColumns.split(' ').length }));
    if (page.sounds !== 2 || page.make !== 'Make pictures (3)' || page.cols < 3 || page.cols > 5) bad.push('the pane: sounds a list, Make pictures, 3 to 5 cards a row: ' + JSON.stringify(page));
    // Convert to GLB (no relay: downloaded) makes the GLB's picture, kept for this page on the card of the model it was
    // made from; its record says its size and triangles
    const dl = stp.waitForEvent('download', { timeout: 60000 }).catch(() => null);
    await ss(`(convertFile('figure.fbx'), 0)`);
    await dl;
    if (!await until(`!CV.busy && (PV.mem.get('figure.fbx') || {}).state === 'ready'`, 60000)) bad.push('Convert to GLB made no picture: ' + JSON.stringify(await ss('[CV.note, pvState()]')));
    const rec = await ss(`[STUDIO.lastGLB.picture, STUDIO.lastGLB.record.size, STUDIO.lastGLB.record.n, CONV.glbRecord({ asset: { extras: { studio: STUDIO.lastGLB.record } } }).size]`);
    if (rec[0] !== true || JSON.stringify(rec[1]) !== '[0.4,1.7,0.3]' || rec[2] !== 12 || JSON.stringify(rec[3]) !== '[0.4,1.7,0.3]') bad.push('the GLB\'s picture and its record\'s size and triangles: ' + JSON.stringify(rec));
    // the picture: 256 x 256, the figure (bright) in the middle, the dark background at the corners
    const look = `(k => { const e = (PV.mem.get(k) || {}).img; if (!e) return null; const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.drawImage(e, 0, 0);
      const mean = (x0, y0, w, h) => { const d = x.getImageData(x0, y0, w, h).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3; return s / (d.length / 4); };
      return { w: e.naturalWidth, h: e.naturalHeight, mid: Math.round(mean(118, 98, 20, 60)), corner: Math.round(mean(0, 0, 24, 24)) }; })`;
    const fig = await ss(look + `('figure.fbx')`);
    if (!fig || fig.w !== 256 || fig.h !== 256 || !(fig.mid > fig.corner + 60) || fig.corner > 40) bad.push('the figure\'s picture (256 px, the model in the middle, dark corners): ' + JSON.stringify(fig));
    await ss('(renderPanes(), 0)');
    c = await cards();
    if (c.map(x => +x.img).join() !== '0,1,0' || c[1].tile) bad.push('the figure\'s card shows its picture (the others plain tiles): ' + JSON.stringify(c));
    const make1 = await stp.evaluate(() => (document.querySelector('#pane-add [data-act="pics"]') || {}).textContent || '');
    if (make1 !== 'Make pictures (2)') bad.push('Make pictures counts the two without one: ' + make1);
    // Make pictures (no relay: for this page only): the box (loaded from the scene, it is placed) and the crate (fetched and
    // loaded as the converter loads it, freed after)
    await stp.click('#pane-add [data-act="pics"]');
    if (!await until(`!PV.make && (PV.mem.get('box.glb') || {}).state === 'ready' && (PV.mem.get('originals/crate.obj') || {}).state === 'ready'`, 60000)) bad.push('Make pictures did not make both: ' + JSON.stringify(await ss('pvState()')));
    const after = await ss(`(renderPanes(), [PV.note, !!document.querySelector('#pane-add [data-act="pics"]'), pvMissing().length, PV.info.get('originals/crate.obj')])`);
    if (after[0] !== '2 of 2 pictures made, for this page only.' || after[1] || after[2] || JSON.stringify(after[3]) !== '{"size":[0.8,0.8,0.8],"n":12}') bad.push('after Make pictures (its note, no button, none missing, what it learnt of the crate): ' + JSON.stringify(after));
    c = await cards();
    const box = await ss(look + `('box.glb')`);
    if (c.some(x => !x.img) || !box || !(box.mid > box.corner + 60)) bad.push('every card with its picture, the box\'s a box: ' + JSON.stringify({ c, box }));
    if (!/crate\.obj0\.8 m · 12 triangles/.test(c[2] && c[2].text)) bad.push('the crate\'s size learnt by making its picture: ' + JSON.stringify(c[2]));
    // the headset's canvas: the same cards, three a row, their pictures drawn (bright where the model is); without a
    // picture a plain tile (dark), and no Make pictures (a page's)
    const xr = `(() => { XR.on = true; X.tab = 'add'; X.scroll = {}; const P = XR.main; P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); XR.on = false;
      const r = P.regions.find(q => q.id === 'add:box.glb'), f = P.regions.find(q => q.id === 'add:figure.fbx'), ph = r ? r.w - 16 : 0;
      const mean = (x0, y0, w, h) => { const d = P.ctx.getImageData(x0, y0, w, h).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3; return s / (d.length / 4); };
      return { ids: P.regions.map(q => q.id).filter(i => /^(add|adds|pics)/.test(i)), row: r && f ? [f.y === r.y, f.x - r.x] : null, w: r ? r.w : 0, mid: r ? Math.round(mean(r.x + 8 + ph * 0.3, r.y + 8 + ph * 0.3, ph * 0.4, ph * 0.4)) : -1 }; })()`;
    const x1 = await ss(xr);
    await ss(`(pvClear(), 0)`);
    const x2 = await ss(xr);
    if (!x1.ids.includes('add:box.glb') || !x1.ids.includes('add:figure.fbx') || x1.ids.includes('pics') || !x1.row || !x1.row[0] || x1.w < 250 || x1.w > 330 || !(x1.mid > x2.mid + 40))
      bad.push('the headset\'s cards (three a row, the picture drawn, a plain tile without): ' + JSON.stringify({ x1, x2 }));
    // Stop: Make pictures stops after the model it is making
    await ss(`(renderPanes(), PV_ACT.pics(), PV_ACT.picstop(), 0)`);
    if (!await until(`!PV.make`, 60000) || !/^Stopped: [01] of 3 pictures made/.test(await ss('PV.note'))) bad.push('Stop: ' + JSON.stringify(await ss('pvState()')));
    // a picture made for an opening of the scene that is over (another scene opened meanwhile, or this one again) is kept
    // nowhere: a model of the same path in the scene open now must never show it
    const stale = await ss(`(async () => { const c = document.createElement('canvas'); c.width = c.height = 8; const r = await pvKeep('stale.glb', c, { size: [1, 1, 1], n: 2 }, STU.gen - 1); return [r, PV.mem.has('stale.glb'), PV.info.has('stale.glb')]; })()`);
    if (JSON.stringify(stale) !== '["",false,false]') bad.push('a picture for a scene opened since kept: ' + JSON.stringify(stale));
    // previews/ in a listing: its pictures said apart (kind preview, also from an older relay's image), never a file the
    // scene's lists or texture ladder see; anything else in previews/ neither
    const pv = await ss(`(() => { const keep = STU.files.slice();
      setFiles(keep.concat({ path: 'previews/box.glb.jpg', bytes: 900, at: 3, kind: 'preview' }, { path: 'previews/x.glb.jpg', bytes: 9, at: 3, kind: 'image' }, { path: 'previews/odd.png', bytes: 20, at: 3, kind: 'image' }));
      const out = { files: STU.files.filter(f => f.path.startsWith('previews/')).length, pics: scenePictures().filter(p => p.startsWith('previews/')).length, listed: [...PV.files.keys()].join(), lists: JSON.stringify(sceneLists()).includes('previews/'), has: pvHas('box.glb') };
      setFiles(keep); out.after = PV.files.size; out.fits = [pvFits(pvPath('models/eva.glb')), pvFits(pvPath('a/b/c/d/eva.glb')), pvFits(pvPath('x'.repeat(190) + '.glb'))].join(); return out; })()`);
    if (JSON.stringify(pv) !== '{"files":0,"pics":0,"listed":"previews/box.glb.jpg,previews/x.glb.jpg","lists":false,"has":true,"after":0,"fits":"true,false,false"}') bad.push('previews/ in a listing: ' + JSON.stringify(pv));
    await ss(`(pvClear(), X.orig = false, X.tab = 'scene', renderPanes(), 0)`);
    while (await ss('UNDO.length')) await ss('undo()');
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  await step('studio: the Items pane as cards (v122): a picture or a tile per item (the box\'s picture, the figure\'s plain tile, shapes, an empty, a sound and a cube drawn), a group\'s heading with its members under it, a cut-out\'s tag selecting it, a press selecting and the selected card lit, the lock and moves marks (what moves it in words); a cube selected, Shows and Hides changing its lists (one Undo step each); a pick mode adding by a press, a cut-out\'s tag marked green; the headset\'s canvas (three a row, paging, a picture and a tile drawn, the selected card\'s border, a cut-out\'s tag the card\'s width with its toggles under it and green when picked, a toggle and a card pressed by a pretend ray)', async () => {
    const bad = [];
    // put in for it: a group of a ball (it moves) and an empty, a cut-out on the box, three shapes (one locked, hiding things)
    if (!await until(`!!STU.items.get('box001').model && !!STU.items.get('fig001').model`, 60000)) bad.push('the box and the figure did not load');
    const lists0 = await ss(`JSON.stringify([STU.items.get('cube01').rec.show, STU.items.get('cube01').rec.hide])`), u0 = await ss('UNDO.length');
    await ss(`(pvClear(), setEdit(true), select(''),
      putItem('icx001', 'x', norm('x', { name: 'Notch', on: 'box001', p: [0, 0.2, 0], size: [0.2, 0.2, 0.2] })),
      putItem('icb001', 'p', norm('p', { name: 'Ball', shape: 'sphere', p: [1.5, 0.25, -1], size: [0.5, 0.5, 0.5], colour: '#46d9ff', motion: { kind: 'spin' } })),
      putItem('ice001', 'e', norm('e', { name: 'Point', p: [1.5, 1.2, -1] })),
      putItem('icg001', 'g', norm('g', { name: 'Pair', items: ['icb001', 'ice001'] })),
      putItem('icw001', 'p', norm('p', { name: 'Screen', shape: 'cube', p: [2.5, 0.25, -1], size: [0.5, 0.5, 0.5], colour: '#ffb43b', look: 'hide', locked: true })),
      putItem('icp001', 'p', norm('p', { name: 'Post', shape: 'cylinder', p: [3, 0.5, -1], size: [0.5, 1, 0.5], colour: '#3ee08f' })),
      putItem('icn001', 'p', norm('p', { name: 'Sign', shape: 'plane', p: [3.5, 0.5, -1], size: [1, 1, 0.01], colour: '#ff5ad9' })), 0)`);
    // the box's picture, made as Make pictures makes it (no relay: for this page); the figure has none
    await ss(`pvMakeOne('box.glb', STU.gen)`);
    if (!await until(`(PV.mem.get('box.glb') || {}).state === 'ready'`, 60000)) bad.push('the box\'s picture was not made: ' + JSON.stringify(await ss('pvState()')));
    const fext = await ss(`extOf(STU.items.get('fig001').rec.file).toUpperCase()`);
    const pane = () => stp.evaluate(() => ({
      order: [...document.querySelectorAll('#pane-items .stu-gh, #pane-items .stu-ic .cm, #pane-items .stu-ic .tag')].map(e => (e.classList.contains('stu-gh') ? 'h:' : e.classList.contains('tag') ? 't:' : '') + e.dataset.v),
      head: [...document.querySelectorAll('#pane-items .stu-gh')].map(h => [h.dataset.v, h.textContent.replace(/\s+/g, ' ').trim(), h.classList.contains('sel')]),
      cards: Object.fromEntries([...document.querySelectorAll('#pane-items .stu-ic')].map(c => { const im = c.querySelector('.pic img'); return [c.dataset.card, {
        pic: im ? im.dataset.tile || (/^blob:/.test(im.src) ? 'picture' : 'other') : 'tile:' + ((c.querySelector('.pic b') || {}).textContent || ''), sel: c.classList.contains('sel'), pk: (/\bpk-(\w+)/.exec(c.className) || [])[1] || '',
        marks: [...c.querySelectorAll('.mk')].map(m => m.textContent).join(','), name: c.querySelector('.nm').textContent, lines: [...c.querySelectorAll('.cm small')].map(x => x.textContent),
        tags: [...c.querySelectorAll('.tag')].map(t => t.dataset.v + '=' + t.textContent + (t.getAttribute('aria-pressed') === 'true' ? '+' : '') + (m => (m ? '/' + m[1] : ''))(/\bpk-(\w+)/.exec(t.className))), ticks: [...c.querySelectorAll('.tk')].map(t => t.dataset.v + (t.getAttribute('aria-pressed') === 'true' ? '+' : '-')).join() }]; })),
      sub: (document.querySelector('#pane-items .stu-k') || {}).textContent || '', cols: getComputedStyle(document.querySelector('#pane-items .stu-grid')).gridTemplateColumns.split(' ').length }));
    await ss(`(X.tab = 'items', renderPanes(), 0)`);
    let P = await pane();
    // the order: the group's heading, its members, then what is in no group by kind (objects, shapes, cubes, sounds); the
    // box's cut-out a tag on its card, after its face
    const o = P.order, objs = o.slice(3, 6);
    if (o.slice(0, 3).join() !== 'h:icg001,icb001,ice001' || objs.filter(v => v === 'fig001' || v === 'box001').length !== 2 || o[o.indexOf('box001') + 1] !== 't:icx001' || o.slice(6).join() !== 'icw001,icp001,icn001,cube01,snd001')
      bad.push('the Items pane\'s order: ' + o.join(' '));
    if (JSON.stringify(P.head) !== '[["icg001","▣ Pair2 items",false]]' || !/^\d+ objects · 1 cubes · 1 sounds · 1 cut-outs · 4 shapes · 1 empties · 1 groups/i.test(P.sub) || P.cols < 3 || P.cols > 5) bad.push('the group\'s heading, the counts, 3 to 5 cards a row: ' + JSON.stringify([P.head, P.sub, P.cols]));
    const want = { box001: ['picture', '0.5 m · 12 triangles'], fig001: ['tile:' + fext, '1.7 m · 12 triangles'], icb001: ['sphere', 'Sphere'], ice001: ['empty', 'Empty'], icw001: ['cube', 'Cube · hides things'], icp001: ['cylinder', 'Cylinder'], icn001: ['plane', 'Plane'], cube01: ['trigger', 'Cube · shows 2, hides 1'], snd001: ['sound', 'Sound · 80 %'] };
    for (const [id, [pic, line]] of Object.entries(want)) { const c = P.cards[id]; if (!c || c.pic !== pic || c.lines[0] !== line) bad.push(`${id}'s card (its picture or tile, its line): ` + JSON.stringify(c)); }
    const C = P.cards;
    if (!C.box001 || C.box001.tags.join() !== 'icx001=✂ Notch' || C.icb001.marks !== 'moves' || !/\bspins\b/.test(C.icb001.lines[1] || '') || C.icw001.marks !== '🔒' || C.box001.marks || C.box001.ticks || Object.values(C).some(c => c.sel || c.pk)) bad.push('the tag, the marks (what moves it said in words), nothing selected nor any Shows and Hides: ' + JSON.stringify(C));
    // the tiles really drawn: the ball's middle in its colour, the speaker's cone in the sound's, the trigger cube see-through
    const tiles = await ss(`(() => { const px = (t, x, y) => [...tileFor(t).getContext('2d').getImageData(x, y, 1, 1).data].slice(0, 3); const s = STU.items.get('snd001'); return { ball: px({ k: 'sphere', col: '#46d9ff' }, 128, 132), cone: px({ k: 'sound', col: s.look.col }, 120, 130), col: new THREE.Color(s.look.col).toArray().map(v => Math.round(v * 255)), cube: px({ k: 'trigger', col: '#ff5a4b' }, 128, 60), url: /^data:image\\/png/.test(tileUrl({ k: 'empty', col: '#ffffff' })) }; })()`);
    if (!(tiles.ball[1] > 150 && tiles.ball[2] > 180 && tiles.ball[0] < 140) || Math.max(...tiles.cone.map((v, k) => Math.abs(v - Math.min(255, tiles.col[k] * 0.85 + 38)))) > 40 || !tiles.url) bad.push('the tiles drawn: ' + JSON.stringify(tiles));
    // a press on a card selects it (its card under Item); back under Items its card lit; the cut-out's tag selects the
    // cut-out, the group's heading the group
    await stp.click('#pane-items .stu-ic[data-card="icw001"] .cm');
    const s1 = await ss('[STU.sel, X.tab]');
    await ss(`(X.tab = 'items', renderPanes(), 0)`);
    P = await pane();
    if (s1.join() !== 'icw001,item' || !P.cards.icw001.sel || Object.entries(P.cards).some(([k, c]) => k !== 'icw001' && c.sel)) bad.push('a press on the screen\'s card (selected, its card shown; lit under Items): ' + JSON.stringify([s1, P.cards.icw001]));
    await stp.click('#pane-items .stu-ic[data-card="box001"] .tag[data-v="icx001"]');
    const s2 = await ss('STU.sel');
    await ss(`(X.tab = 'items', renderPanes(), 0)`);
    P = await pane();
    await stp.click('#pane-items .stu-gh[data-v="icg001"]');
    const s3 = await ss('STU.sel');
    await ss(`(X.tab = 'items', renderPanes(), 0)`);
    const P3 = await pane();
    if (s2 !== 'icx001' || P.cards.box001.tags[0] !== 'icx001=✂ Notch+' || P.cards.box001.sel || s3 !== 'icg001' || !P3.head[0][2]) bad.push('the tag selects the cut-out, the heading the group: ' + JSON.stringify([s2, P.cards.box001, s3, P3.head]));
    // a cube selected: Shows and Hides under every card but its own (the cut-out's tag too); each press one Undo step
    await ss(`(select('cube01'), X.tab = 'items', renderPanes(), 0)`);
    P = await pane();
    const tk = P.cards;
    if (tk.fig001.ticks !== 'show:fig001+,hide:fig001-' || tk.box001.ticks !== 'show:icx001-,hide:icx001-,show:box001-,hide:box001+' || tk.icb001.ticks !== 'show:icb001-,hide:icb001-' || tk.cube01.ticks || !tk.cube01.sel) bad.push('Shows and Hides with the cube selected: ' + JSON.stringify(tk));
    const u1 = await ss('UNDO.length'), L = () => ss(`JSON.stringify([STU.items.get('cube01').rec.show, STU.items.get('cube01').rec.hide])`);
    await stp.click('#pane-items button[data-act="tick"][data-v="show:icb001"]');
    const l1 = await L();
    await stp.click('#pane-items button[data-act="tick"][data-v="hide:icb001"]');
    const l2 = await L();
    await stp.click('#pane-items button[data-act="tick"][data-v="show:icx001"]');
    const l3 = await L(), u2 = await ss('UNDO.length'), on = await stp.evaluate(() => document.querySelector('#pane-items button[data-act="tick"][data-v="hide:icb001"]').getAttribute('aria-pressed'));
    if (l1 !== '[["fig001","snd001","icb001"],["box001"]]' || l2 !== '[["fig001","snd001"],["box001","icb001"]]' || l3 !== '[["fig001","snd001","icx001"],["box001","icb001"]]' || u2 - u1 !== 3 || on !== 'true') bad.push('Shows and Hides pressed (one Undo step each): ' + JSON.stringify([l1, l2, l3, u2 - u1, on]));
    await ss('(undo(), undo(), undo(), 0)');
    if (await L() !== lists0) bad.push('Undo did not take them back: ' + await L());
    // a pick mode (Pick what it shows): a press on a card puts it on the list, marked (green, a tick)
    await ss(`(select('cube01'), itemAct('pickFor', 'show'), X.tab = 'items', renderPanes(), 0)`);
    await stp.click('#pane-items .stu-ic[data-card="icp001"] .cm');
    const l4 = await L(), sel4 = await ss('[STU.sel, !!STU.pick]');
    await ss(`(X.tab = 'items', renderPanes(), 0)`);
    P = await pane();
    if (l4 !== '[["fig001","snd001","icp001"],["box001"]]' || sel4.join() !== 'cube01,true' || P.cards.icp001.pk !== 'show' || !/^✓ Post$/.test(P.cards.icp001.name) || P.cards.box001.pk !== 'hide') bad.push('picking by a press: ' + JSON.stringify([l4, sel4, P.cards.icp001, P.cards.box001.pk]));
    // the cut-out's tag likewise: on the list, marked green as a card is (its object's card stays red: it hides the box)
    await stp.click('#pane-items .stu-ic[data-card="box001"] .tag[data-v="icx001"]');
    const l5 = await L();
    await ss(`(X.tab = 'items', renderPanes(), 0)`);
    P = await pane();
    if (l5 !== '[["fig001","snd001","icp001","icx001"],["box001"]]' || P.cards.box001.tags[0] !== 'icx001=✓ ✂ Notch+/show' || P.cards.box001.pk !== 'hide') bad.push('picking the cut-out\'s tag by a press (on the list, green): ' + JSON.stringify([l5, P.cards.box001]));
    await ss(`(STU.pick = null, undo(), undo(), 0)`);
    // the headset's canvas: three a row (the shapes), paged (Up and More), the box's picture and the ball's tile drawn (bright)
    // where the figure's plain tile is dark, the selected card's border in the accent colour, a toggle and a card pressed by
    // a pretend ray (the controller's hover on the panel: xrPress and xrRelease)
    const xr = await ss(`(() => {
      const out = {}, P = XR.main, draw = () => { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); };
      const reg = id => P.regions.find(q => q.id === id), find = id => { for (let off = 0; off < 6000; off += 120) { X.scroll.items = off; draw(); if (reg(id)) return reg(id); } return null; };
      const mean = (x0, y0, w, h) => { const d = P.ctx.getImageData(Math.round(x0), Math.round(y0), Math.round(w), Math.round(h)).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3; return Math.round(s / (d.length / 4)); };
      const picMean = r => mean(r.x + 8 + (r.w - 16) * 0.3, r.y + 8 + (r.w - 16) * 0.3, (r.w - 16) * 0.4, (r.w - 16) * 0.4);
      XR.on = true; select('box001'); X.tab = 'items'; X.scroll = {}; draw();
      out.more = !!reg('scroll:down'); out.first = !!reg('sel:snd001');
      const a = find('sel:icw001'), b = reg('sel:icp001'), c = reg('sel:icn001');
      out.row = a && b && c ? [a.y === b.y && b.y === c.y, b.x - a.x, c.x - b.x, a.w] : null;
      const bx = find('sel:box001'); out.box = bx ? picMean(bx) : -1;
      const pix = bx ? [...P.ctx.getImageData(bx.x + 2, bx.y + 120, 1, 1).data].slice(0, 3) : null; out.border = pix;
      const fg = find('sel:fig001'); out.fig = fg ? picMean(fg) : -1;
      const fpix = fg ? [...P.ctx.getImageData(fg.x + 2, fg.y + 120, 1, 1).data].slice(0, 3) : null; out.border2 = fpix;
      const bl = find('sel:icb001'); out.ball = bl ? picMean(bl) : -1;
      X.scroll = {}; draw(); const d0 = reg('scroll:down'); if (d0) d0.fn(); out.paged = X.scroll.items > 0;
      // the cube selected: its toggles, one pressed by the ray
      select('cube01'); X.tab = 'items'; X.scroll = {};
      const t = find('tick:show:icb001'), ctl = XR.ctrls[0], u = UNDO.length;
      if (t) { ctl.hover = { kind: 'panel', P, x: t.x + t.w / 2, y: t.y + t.h / 2, point: new THREE.Vector3() }; xrPress(ctl); xrRelease(ctl); }
      out.tick = [!!t, STU.items.get('cube01').rec.show.includes('icb001'), UNDO.length - u];
      if (UNDO.length > u) undo();
      const tg = find('tick:hide:icx001'); out.tagTick = !!tg;
      // the cut-out's tag the card's whole width, its Shows and Hides on a row under it
      const tr = reg('sel:icx001'), ts = reg('tick:show:icx001');
      out.tagRow = tr && ts && tg && out.row ? [tr.w === out.row[3] - 16, ts.y >= tr.y + tr.h, ts.y === tg.y, ts.x === tr.x, Math.abs(tg.x + tg.w - (tr.x + tr.w)) <= 1] : null;
      // picking for the cube: the tag on its Shows list, its edge green
      const u3 = UNDO.length; itemAct('pickFor', 'show'); act('link', 'icx001'); X.tab = 'items'; X.scroll = {};
      const tp = find('sel:icx001'); out.tagPk = tp ? [...P.ctx.getImageData(tp.x, tp.y + Math.round(tp.h / 2), 1, 1).data].slice(0, 3) : null;
      STU.pick = null; while (UNDO.length > u3) undo(); X.scroll = {};
      // a card's face pressed by the ray: selected
      const f = find('sel:icn001');
      if (f) { ctl.hover = { kind: 'panel', P, x: f.x + f.w / 2, y: f.y + 40, point: new THREE.Vector3() }; xrPress(ctl); xrRelease(ctl); }
      out.press = STU.sel;
      ctl.hover = null; ctl.press = null; XR.on = false; X.scroll = {}; select(''); X.tab = 'scene';
      return out;
    })()`);
    const lit = p => p && p[2] > 200 && p[1] > 150 && p[0] < 140;
    const green = p => p && p[1] > 180 && p[0] < 120 && p[2] < 190;
    if (!xr.more || xr.first || !xr.row || !xr.row[0] || xr.row[1] !== xr.row[2] || xr.row[1] < xr.row[3] || !(xr.box > xr.fig + 40) || !(xr.ball > xr.fig + 40) || !lit(xr.border) || lit(xr.border2) || !xr.paged || xr.tick.join() !== 'true,true,1' || !xr.tagTick
      || !xr.tagRow || xr.tagRow.some(v => !v) || !green(xr.tagPk) || xr.press !== 'icn001')
      bad.push('the headset\'s Items cards: ' + JSON.stringify(xr));
    // as it was: the items put in taken out, no picture kept, no Undo step left
    await ss(`(['icg001', 'icx001', 'icb001', 'ice001', 'icw001', 'icp001', 'icn001'].forEach(removeItem), pvClear(), select(''), X.tab = 'scene', renderPanes(), 0)`);
    while (await ss('UNDO.length') > u0) await ss('undo()');
    if (await L() !== lists0) bad.push('the cube\'s lists not as they were: ' + await L());
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  await step('studio: the Upload pane with no relay: the test originals dropped, the plan (rows, grouping, names), converting offered as downloads', async () => {
    const bad = [];
    await ss(`(X.tab = 'upload', renderPanes(), 0)`);
    const pane0 = await stp.evaluate(() => document.querySelector('#pane-upload').textContent.replace(/\s+/g, ' '));
    if (!/No relay that takes uploads/.test(pane0) || !/node relay\/server\.mjs --lan --scenes <folder>/.test(pane0) || !/Drop files or folders here/.test(pane0) || !/For Quest: on/.test(pane0)) bad.push('the Upload pane without a relay: ' + pane0.slice(0, 400));
    // a drop of files onto the pane (the event, flat: as files are dropped from a desktop)
    await stp.evaluate(async () => {
      const get = async (p, name) => new File([await (await fetch('tools/studio/test/scenes/test/' + p)).arrayBuffer()], name || p.split('/').pop());
      const dt = new DataTransfer();
      for (const f of [await get('figure.fbx'), await get('figure.png'), await get('tone.wav'), new File(['hello'], 'notes.txt')]) dt.items.add(f);
      document.querySelector('#pane-upload .stu-drop').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    if (!await until(`!UP.planning && UP.rows.length === 3 && UP.rows.every(r => r.how !== 'measuring')`, 20000)) bad.push('a drop of four files did not make a plan of three rows: ' + JSON.stringify(await ss('STUDIO.state().upload')).slice(0, 400));
    // the test scene's originals as folders (their paths kept): models with what they name, sounds, the rest kept
    await ss(`(async () => {
      const get = async p => new File([await (await fetch('tools/studio/test/scenes/test/' + p)).arrayBuffer()], p.split('/').pop());
      upTake([{ path: 'drop/figure.fbx', file: await get('figure.fbx') }, { path: 'drop/tex/figure.png', file: await get('figure.png') }, { path: 'drop/crate/crate.obj', file: await get('originals/crate.obj') },
        { path: 'drop/crate/crate.mtl', file: await get('originals/crate.mtl') }, { path: 'drop/crate/crate.png', file: await get('originals/crate.png') }, { path: 'drop/tone.wav', file: await get('tone.wav') },
        { path: 'drop/long.wav', file: await get('sounds/long.wav') }, { path: 'drop/notes.txt', file: new File(['hello'], 'notes.txt') }, { path: 'drop/.DS_Store', file: new File(['x'], '.DS_Store') }]);
      return 0; })()`);
    if (!await until(`!UP.planning && UP.rows.length === 5 && UP.rows.every(r => r.how !== 'measuring')`, 20000)) bad.push('the folders made no plan: ' + JSON.stringify(await ss('STUDIO.state().upload')).slice(0, 400));
    const up = await ss('STUDIO.state().upload'), rows = up.rows.map(r => [r.kind, r.src.join('+'), r.out.join('+')]);
    const want = [
      ['model', 'drop/figure.fbx+drop/tex/figure.png', 'models/figure.glb+originals/drop/figure.fbx+originals/drop/tex/figure.png'],
      ['model', 'drop/crate/crate.obj+drop/crate/crate.mtl+drop/crate/crate.png', 'models/crate.glb+originals/drop/crate/crate.obj+originals/drop/crate/crate.mtl+originals/drop/crate/crate.png'],
      ['sound', 'drop/tone.wav', 'sounds/tone.wav+originals/drop/tone.wav'],
      ['sound', 'drop/long.wav', 'sounds/long.wav+originals/drop/long.wav'],
      ['keep', 'drop/notes.txt', 'originals/drop/notes.txt'],
    ];
    if (JSON.stringify(rows) !== JSON.stringify(want) || up.left.join() !== '.DS_Store') bad.push('the plan: ' + JSON.stringify({ rows, left: up.left }));
    if (!/figure_spec\.png/.test(up.rows[0].notes.join())) bad.push('the figure\'s row does not say what it names and was not dropped: ' + JSON.stringify(up.rows[0].notes));
    await ss('(renderPanes(), 0)');   // (the pane as it is now: a slow machine draws it a moment later)
    const plan = await stp.evaluate(() => document.querySelector('#pane-upload .stu-plan').textContent.replace(/\s+/g, ' '));
    if (!/A short sound \(0\.6 s\): sounds\/tone\.wav, mono, 16-bit, 22\.05 kHz/.test(plan) || !/A long sound \(25 s\): sounds\/long\.wav, mono WAV at 8 kHz/.test(plan) || !/Kept as it is/.test(plan) || !/textures at most 2048 px|textures at most 2,048 px/.test(plan)) bad.push('the plan\'s words: ' + plan.slice(0, 600));
    // numbered names against each other: the same name twice
    const twice = await ss(`(() => { const r = UP.rows.slice(0, 1).map(x => Object.assign({}, x, { src: x.src.slice(), out: [] })); const keep = UP.rows; UP.rows = keep.concat(r.map(x => Object.assign(x, { main: Object.assign({}, x.main, { path: 'other/figure.fbx' }), src: [Object.assign({}, x.main, { path: 'other/figure.fbx' })] }))); upNames(); const o = UP.rows[UP.rows.length - 1].out[0]; UP.rows = keep; upNames(); return o; })()`);
    if (twice !== 'models/figure 2.glb') bad.push('a second figure.fbx is not numbered: ' + twice);
    // Convert (no relay): each GLB and WAV offered as a download, nothing uploaded
    await stp.click('#pane-upload [data-act="up:run"]');
    if (!await until(`!UP.busy && UP.ran`, 90000)) bad.push('converting did not finish');
    const ran = await ss(`STUDIO.state().upload.rows.map(r => [r.kind, r.state, r.dl.join()])`);
    if (JSON.stringify(ran) !== JSON.stringify([['model', 'done', 'figure.glb'], ['model', 'done', 'crate.glb'], ['sound', 'done', 'tone.wav'], ['sound', 'done', 'long.wav'], ['keep', 'done', '']])) bad.push('converted: ' + JSON.stringify(ran));
    // (each model row with a picture of its GLB, as the Add pane's: e7e_pics.js)
    const rp = await ss(`(renderPanes(), [STUDIO.state().upload.rows.map(r => r.pic).join(), document.querySelectorAll('#pane-upload .stu-plan img.stu-pv.sm').length])`);
    if (rp[0] !== 'true,true,false,false,false' || rp[1] !== 2) bad.push('the model rows\' pictures of their GLBs: ' + JSON.stringify(rp));
    const out = await ss(`(async () => {
      renderPanes();
      const a = [...document.querySelectorAll('#pane-upload .stu-plan a[download]')].map(x => [x.getAttribute('download'), x.href]), get = async n => (await fetch(a.find(x => x[0] === n)[1])).arrayBuffer();
      const fig = CONV.glbJSON(await get('figure.glb')), wav = new DataView(await get('tone.wav')), lw = new DataView(await get('long.wav'));
      return { links: a.map(x => x[0]), from: fig && fig.asset.extras.studio.from, tone: [wav.getUint16(22, true), wav.getUint32(24, true), wav.getUint16(34, true)], long: [lw.getUint16(22, true), lw.getUint32(24, true), Math.round(lw.getUint32(40, true) / 2 / lw.getUint32(24, true))], note: UP.note };
    })()`);
    if (out.links.join() !== 'figure.glb,crate.glb,tone.wav,long.wav' || out.from !== 'originals/drop/figure.fbx' || out.tone.join() !== '1,22050,16' || out.long.join() !== '1,8000,25' || !/nothing was uploaded/.test(out.note)) bad.push('what was made: ' + JSON.stringify(out));
    await ss(`(upClear(), X.tab = 'scene', renderPanes(), 0)`);
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  // v128 (the owner, 9 November 2026, after v127's timeline: "please add timeline and play pause also for recorded items",
  // "keep it where it is in animation but move the locked toggle all the way to the top"): a recorded path's timeline, the
  // headset card's bar (for a clip and for a path), a synced voice following a held path, the Lock row at every card's top
  await step('studio v128: a recorded path\'s timeline (its rows and slider; Pause holding it over 0.7 s of scene clock, the slider moving it to the path\'s pose there, Play going on, −1 s and +1 s round a Loop, Back and forth twice its length, deselected on its clock again, shown through Pause), a model\'s clip and path held apart, a synced voice silent while held paused, the headset card\'s bar for both (a drag scrubs; its strip drawn on its own and sent to the texture), the Lock row first under every card\'s heading (page and headset) and still locking', async () => {
    const bad = [];
    const seek = (id, v) => stp.evaluate(([id, v]) => { const r = document.querySelector('#' + id); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
    await stp.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&scene=test&edit');
    await stp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    if (!await until(`STUDIO.ready() && !!STU.items.get('box001').model && !!STU.items.get('box001').action`, 120000)) { errors.push('studio v128: the test scene did not load'); return; }
    // (in the page: the path's keys (2 s, a loop); where an item is drawn at a scene clock T; where the path puts it at its
    // moment s; how far apart they are; how far it is drawn from where it is placed)
    await ss(`(window.__v8 = {
      K: [[0, 0, 0, 0, 0, 0, 0, 1], [1, 1, 0, 0, 0, 0, 0, 1], [2, 1, 1, 0, 0, 0.7071, 0, 0.7071]],
      at: (id, T) => { const sc = sceneClock; sceneClock = () => T; try { itemsStep(0, performance.now()); } finally { sceneClock = sc; } const H = STU.items.get(id).holder; return new THREE.Vector3().setFromMatrixPosition(H.matrixAutoUpdate ? new THREE.Matrix4().compose(H.position, H.quaternion, H.scale) : H.matrix); },
      want: (id, s) => { const r = STU.items.get(id).rec, d = new THREE.Vector3(), q = new THREE.Quaternion(); pathAt(normPath({ k: window.__v8.K }), s, d, q); return new THREE.Vector3(...r.p).add(d.applyQuaternion(new THREE.Quaternion(...(r.q || [0, 0, 0, 1])).normalize())); },
      far: (id, T, s) => +window.__v8.at(id, T).distanceTo(window.__v8.want(id, s)).toFixed(5),
      placed: id => +window.__v8.at(id, 0.37).distanceTo(new THREE.Vector3(...STU.items.get(id).rec.p)).toFixed(5),
    }, putItem('pth128', 'p', norm('p', { name: 'Runner', shape: 'cube', p: [2, 0.5, -1], q: [0, 0.3827, 0, 0.9239], size: [0.3, 0.3, 0.3], path: { k: window.__v8.K } })),
      putItem('vox128', 's', norm('s', { name: 'Vox', file: 'tone.wav', p: [2, 1.5, -1], sync: 'pth128', loop: false })),
      setEdit(true), select('pth128'), X.tab = 'item', renderPanes(), 0)`);
    await frames(2);
    // ---- its rows: Timeline, the buttons, the slider in tenths (2.0 s: 20 steps), under the Recorded path rows
    const rows = await ss(`(() => { const pane = document.querySelector('#pane-item'), s = document.querySelector('#stuRangePath'), t = pane.textContent;
      return [!!s && s.max, /Timeline: [\\d.]+ s of 2\\.0 s/.test(t), ['ap:play', 'ap:start', 'ap:step', 'ap:free'].every(a => !!pane.querySelector('[data-act="' + a + '"]')), t.indexOf('Timeline: ') > t.indexOf('Recorded path'), !document.querySelector('#stuRangeAnim')]; })()`);
    if (JSON.stringify(rows) !== '["20",true,true,true,true]') bad.push('the path\'s timeline rows: ' + JSON.stringify(rows));
    // (a short one, 1.3 s, as the owner's clip: its slider in tenths, 13 steps, and its label)
    await ss(`(setRec('pth128', { path: { k: [[0, 0, 0, 0, 0, 0, 0, 1], [1.3, 1, 0, 0, 0, 0, 0, 1]] } }), renderPanes(), 0)`);
    const short = await ss(`[document.querySelector('#stuRangePath').max, document.querySelector('#stuRangePath').step, /Timeline: [\\d.]+ s of 1\\.3 s/.test(document.querySelector('#pane-item').textContent)]`);
    await seek('stuRangePath', 7);
    const s7 = await ss(`[+ANIM.mineP.t.toFixed(3), document.querySelector('#stuRangePath').parentNode.querySelector('[data-range-out]').textContent]`);
    if (JSON.stringify(short) !== '["13","1",true]' || JSON.stringify(s7) !== '[0.7,"0.7 s"]') bad.push('a 1.3 s path\'s slider: ' + JSON.stringify({ short, s7 }));
    await ss(`(animFree('test', 'path'), setRec('pth128', { path: { k: window.__v8.K } }), renderPanes(), 0)`);
    // ---- Pause: held where it is, the same pose at two scene clocks 0.7 s apart
    await stp.click('#pane-item [data-act="ap:play"]');
    const ps = await ss(`(() => { const a = window.__v8.at('pth128', 3.1), b = window.__v8.at('pth128', 3.8); return [+a.distanceTo(b).toFixed(6), !!ANIM.mineP && !ANIM.mineP.p, ANIM.mine, document.querySelector('#pane-item [data-act="ap:play"]').textContent, STUDIO.pose('pth128').moving]; })()`);
    if (!(ps[0] < 1e-6) || !ps[1] || ps[2] !== null || ps[3] !== 'Play' || !ps[4]) bad.push('Pause did not hold the path: ' + JSON.stringify(ps));
    // ---- the slider at 1.5 s: the path's pose there (within 5 mm), at any scene clock
    await seek('stuRangePath', 15);
    const sk = await ss(`[ANIM.mineP && ANIM.mineP.t, ANIM.mineP && ANIM.mineP.p, window.__v8.far('pth128', 0.2, 1.5), window.__v8.far('pth128', 7.9, 1.5)]`);
    if (Math.abs(sk[0] - 1.5) > 1e-6 || sk[1] !== false || !(sk[2] <= 0.005) || !(sk[3] <= 0.005)) bad.push('the slider at 1.5 s: ' + JSON.stringify(sk));
    // ---- Play: on from there (its own time moving, drawn where it says)
    await stp.click('#pane-item [data-act="ap:play"]');
    await stp.waitForTimeout(350);
    const pl = await ss(`(() => { const it = STU.items.get('pth128'), P = it.rec.path, t0 = animTime(it, 'path'), p = window.__v8.at('pth128', 0.2), t1 = animTime(it, 'path');
      const d0 = p.distanceTo(window.__v8.want('pth128', pathTime(P, t0))), d1 = p.distanceTo(window.__v8.want('pth128', pathTime(P, t1)));
      return [!!ANIM.mineP && ANIM.mineP.p, +t0.toFixed(3), +Math.min(d0, d1).toFixed(4), Math.abs(t0 - 1.5) > 0.1]; })()`);
    if (!pl[0] || !(pl[2] <= 0.02) || !pl[3]) bad.push('Play did not go on from 1.5 s: ' + JSON.stringify(pl));
    // ---- −1 s and +1 s, paused at 1.5 s: +1 s is 0.5 s (round the loop), −1 s back to 1.5 s, again 0.5 s
    await stp.click('#pane-item [data-act="ap:play"]');
    await seek('stuRangePath', 15);
    const steps = [];
    for (const a of ['ap:on', 'ap:back', 'ap:back']) { await stp.click(`#pane-item [data-id="${a}"]`); steps.push(await ss(`[+ANIM.mineP.t.toFixed(3), ANIM.mineP.p]`)); }
    if (JSON.stringify(steps) !== '[[0.5,false],[1.5,false],[0.5,false]]') bad.push('−1 s and +1 s round the loop from 1.5 s: ' + JSON.stringify(steps));
    // ---- Back and forth: the hold let go (its play changed), the slider's range twice the length; at 3.0 s it is on its way
    // back, where the path is at 1.0 s
    await ss(`(setRec('pth128', { path: Object.assign({}, STU.items.get('pth128').rec.path, { play: 'bounce' }) }), 0)`);
    await frames(2);
    const bo = await ss(`(renderPanes(), [ANIM.mineP, document.querySelector('#stuRangePath').max, /Timeline: [\\d.]+ s of 4\\.0 s/.test(document.querySelector('#pane-item').textContent)])`);
    await seek('stuRangePath', 30);
    const b3 = await ss(`[ANIM.mineP && ANIM.mineP.t, window.__v8.far('pth128', 0.4, 1)]`);
    if (bo[0] !== null || bo[1] !== '40' || !bo[2] || Math.abs(b3[0] - 3) > 1e-6 || !(b3[1] <= 0.005)) bad.push('Back and forth: ' + JSON.stringify({ bo, b3 }));
    // ---- deselected: let go, on its clock again (back and forth: at 2.5 s where the path is at 1.5 s)
    await ss(`(select(''), 0)`);
    await frames(2);
    const fr = await ss(`[ANIM.mineP, window.__v8.far('pth128', 2.5, 1.5), window.__v8.far('pth128', 0.5, 0.5)]`);
    if (fr[0] !== null || !(fr[1] <= 0.005) || !(fr[2] <= 0.005)) bad.push('deselected, the path did not go back to its clock: ' + JSON.stringify(fr));
    // ---- through Pause: everything at its placed pose, but the path's hold shows (at 1.5 s); The scene's clock lets go, and
    // it rests again
    await ss(`(setRec('pth128', { path: { k: window.__v8.K } }), select('pth128'), pauseSet(true), renderPanes(), 0)`);
    await frames(2);
    const pz0 = await ss(`window.__v8.placed('pth128')`);
    await seek('stuRangePath', 15);
    const pz1 = await ss(`[MPAUSE.on, window.__v8.far('pth128', 0.9, 1.5), STUDIO.pose('pth128').moving]`);
    await ss(`(renderPanes(), 0)`);
    await stp.click('#pane-item [data-act="ap:free"]');
    const pz2 = await ss(`[ANIM.mineP, window.__v8.placed('pth128'), STUDIO.pose('pth128').moving]`);
    await ss(`(pauseSet(false), 0)`);
    if (!(pz0 < 1e-6) || !pz1[0] || !(pz1[1] <= 0.005) || !pz1[2] || pz2[0] !== null || !(pz2[1] < 1e-6) || pz2[2]) bad.push('through Pause: ' + JSON.stringify({ pz0, pz1, pz2 }));
    // ---- a synced voice: silent while its path is held paused, from the held moment while it plays held (a pass of the
    // hold's own), on the path's clock again once let go
    await ss(`(renderPanes(), 0)`);
    await seek('stuRangePath', 5);
    const vz = await ss(`(() => { const v = STU.items.get('vox128'), o = []; o.push(!!syncOf(v), syncAt(v, performance.now(), 10));
      ANIM_ACT['ap:play'](); const s = syncAt(v, performance.now(), 10), t = animTime(STU.items.get('pth128'), 'path'); o.push(s && typeof s.pass, !!s && Math.abs(s.e - t) < 0.05);
      animFree('test', 'path'); const s2 = syncAt(v, performance.now(), 10); o.push(s2 ? typeof s2.pass : 'silent'); return o; })()`);
    if (JSON.stringify(vz.slice(0, 4)) !== '[true,null,"string",true]' || !['number', 'silent'].includes(vz[4])) bad.push('a synced voice with its path held: ' + JSON.stringify(vz));
    // ---- a model with a clip and a path: two timelines, held apart (the clip paused, the path then held at 0.5 s; the
    // path let go, the clip still held)
    await ss(`(setRec('box001', { path: { k: window.__v8.K } }), select('box001'), renderPanes(), 0)`);
    await frames(2);
    const two = await ss(`[!!document.querySelector('#stuRangeAnim'), !!document.querySelector('#stuRangePath'), (document.querySelector('#pane-item').textContent.match(/Timeline: /g) || []).length]`);
    if (two.join() !== 'true,true,2') bad.push('the box with a clip and a path: ' + JSON.stringify(two));
    await stp.click('#pane-item [data-act="an:play"]');
    await seek('stuRangePath', 5);
    const ap = await ss(`(() => { const it = STU.items.get('box001'), a = window.__v8.far('box001', 1.7, 0.5), c1 = it.action.time; window.__v8.at('box001', 1.3); const c2 = it.action.time;
      return [!!ANIM.mine && !ANIM.mine.p, !!ANIM.mineP && !ANIM.mineP.p && ANIM.mineP.t, a, Math.abs(c1 - c2) < 1e-6]; })()`);
    await ss(`(renderPanes(), 0)`);
    await stp.click('#pane-item [data-act="ap:free"]');
    const ap2 = await ss(`(() => { const it = STU.items.get('box001'), c0 = ANIM.mine && ANIM.mine.t; window.__v8.at('box001', 1.7); return [ANIM.mineP, !!ANIM.mine && !ANIM.mine.p, window.__v8.far('box001', 1.7, 1.7), Math.abs(it.action.time - c0) < 1e-3]; })()`);
    if (JSON.stringify(ap.slice(0, 2)) !== '[true,0.5]' || !(ap[2] <= 0.005) || !ap[3] || ap2[0] !== null || !ap2[1] || !(ap2[2] <= 0.005) || !ap2[3]) bad.push('the clip and the path held apart: ' + JSON.stringify({ ap, ap2 }));
    await ss(`(renderPanes(), 0)`);
    await stp.click('#pane-item [data-act="an:free"]');
    // ---- the headset's card: a bar for the clip and one for the path (under each Timeline row); a drag at a quarter of
    // the path's bar holds it at 0.5 s, paused; at three quarters of the clip's at 1.5 s. The card drawn with the path held
    // at 0.5 s and its texture on the GPU, the bar dragged to 1.5 s: the card's signature the same, its strip drawn again on
    // its own and sent to the texture (no whole upload), the texture there as the canvas, and as the whole card drawn again
    const hx = await ss(`(() => {
      const o = {}, P = XR.main;
      XR.on = true;
      const draw = () => { for (const Q of XR.panels) { Q.last = ''; Q.t = -1e9; panelTick(Q, performance.now() + 1e6); } };
      const find = id => { for (let off = 0; off < 8000; off += 120) { X.scroll.item = off; draw(); const r = P.regions.find(z => z.id === id); if (r) return r; } return null; };
      select('box001'); X.tab = 'item'; X.scroll = {}; draw();
      const ra = find('anbar'), rp = find('apbar');
      o.regions = [!!ra, !!rp];
      if (!ra || !rp) { XR.on = false; return o; }
      rp.drag(rp.x + 24 + (rp.w - 48) * 0.25); o.path = [+ANIM.mineP.t.toFixed(3), ANIM.mineP.p];
      const ra2 = find('anbar'); ra2.drag(ra2.x + 24 + (ra2.w - 48) * 0.75); o.clip = [+ANIM.mine.t.toFixed(3), ANIM.mine.p];
      // (the path's bar in view, the card drawn: its bar listed with the strip it is drawn on)
      find('apbar');
      const b = (P.bars || []).find(z => z.id === 'apbar'), R = GL.renderer, gl = R.getContext();
      o.bars = (P.bars || []).map(z => z.id).sort().join();
      if (!b) { XR.on = false; return o; }
      R.initTexture(P.tex);
      const rx = Math.floor(b.x - 6), ry = Math.floor(b.y - 2), rw = Math.ceil(b.w + 12), rh = BAR.h + 4;
      const back = () => { const fb = gl.createFramebuffer(), px = new Uint8Array(rw * rh * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, R.properties.get(P.tex).__webglTexture, 0); gl.readPixels(rx, P.h - ry - rh, rw, rh, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); return px; };
      const canvas = () => P.ctx.getImageData(rx, ry, rw, rh).data;
      const vs = (px, cv) => { let m = 0; for (let y = 0; y < rh; y++) for (let x = 0; x < rw * 4; x++) m = Math.max(m, Math.abs(px[(rh - 1 - y) * rw * 4 + x] - cv[y * rw * 4 + x])); return m; };
      const t0 = back(), v0 = P.tex.version, n0 = P.patched || 0, s0 = P.last;
      P.regions.find(z => z.id === 'apbar').drag(b.x + BAR.pad + (b.w - 2 * BAR.pad) * 0.75);
      panelTick(P, performance.now() + 2e6);
      const t1 = back(), c1 = canvas();
      o.patch = [(P.patched || 0) - n0, P.tex.version === v0, P.last === s0, +ANIM.mineP.t.toFixed(3), vs(t0, c1) > 20, vs(t1, c1)];
      P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 3e6);
      // (the same but for a few levels where text and edges are smoothed: a canvas may draw a strip a hair differently)
      const c2 = canvas(); let m = 0; for (let i = 0; i < c1.length; i++) m = Math.max(m, Math.abs(c1[i] - c2[i]));
      o.whole = m;
      XR.on = false; X.scroll = {};
      return o;
    })()`);
    if (JSON.stringify(hx.regions) !== '[true,true]' || JSON.stringify(hx.path) !== '[0.5,false]' || JSON.stringify(hx.clip) !== '[1.5,false]' || !/apbar/.test(hx.bars || '') ||
      !hx.patch || hx.patch[0] !== 1 || !hx.patch[1] || !hx.patch[2] || hx.patch[3] !== 1.5 || !hx.patch[4] || hx.patch[5] > 2 || !(hx.whole <= 6)) bad.push('the headset card\'s bars: ' + JSON.stringify(hx));
    await ss(`(animFree('test', 'path'), animFree('test', 'clip'), setRec('box001', { path: undefined }), renderPanes(), 0)`);
    // ---- the Lock row first under the heading (what holds it, above it, when something does), on an object (one in a
    // group: its In group line after it), a shape (locked: the amber line above it), a sound, a cube, a cut-out and a group;
    // page and headset; pressed, it locks (one Undo step) and unlocks
    await ss(`(putItem('cut128', 'x', norm('x', { name: 'Notch', on: 'box001', p: [0.1, 0.1, 0.25], size: [0.2, 0.2, 0.2] })), putItem('grp128', 'g', norm('g', { name: 'Pair', items: ['fig001', 'cube01'] })), setRec('pth128', { locked: true }), 0)`);
    const ids = ['box001', 'fig001', 'pth128', 'snd001', 'cube01', 'cut128', 'grp128'];
    const pg = await ss(`${JSON.stringify(ids)}.map(id => { select(id); X.tab = 'item'; renderPanes();
      const pane = document.querySelector('#pane-item'), h = pane.querySelector('h3'); let e = h && h.nextElementSibling, top = '';
      if (e && e.matches('p.amber, p.red')) { top = e.textContent.slice(0, 20); e = e.nextElementSibling; }
      const first = pane.querySelector('.actions [data-id]');
      return [id, !!e && e.matches('p.stu-l') && e.textContent === 'Lock' && !!e.nextElementSibling.querySelector('[data-id="lock"]'), first && first.dataset.id, top]; })`);
    const pgBad = pg.filter(r => !r[1] || r[2] !== 'lock' || (r[0] === 'pth128') !== !!r[3]);
    if (pgBad.length) bad.push('the page\'s Lock row first under the heading: ' + JSON.stringify(pgBad));
    const fg = await ss(`(select('fig001'), renderPanes(), (() => { const t = document.querySelector('#pane-item').textContent; return t.indexOf('Lock in place') >= 0 && t.indexOf('In group Pair') > t.indexOf('Lock in place'); })())`);
    if (!fg) bad.push('the figure\'s In group line is not after its Lock row');
    await ss(`(select('snd001'), renderPanes(), 0)`);
    const u0 = await ss('UNDO.length');
    await stp.click('#pane-item [data-id="lock"]');
    const lk = await ss(`[STU.items.get('snd001').rec.locked, UNDO.length - ${u0}, (renderPanes(), document.querySelector('#pane-item [data-id="lock"]').textContent)]`);
    await stp.click('#pane-item [data-id="lock"]');
    const ul = await ss(`['locked' in STU.items.get('snd001').rec, UNDO.length - ${u0}]`);
    if (JSON.stringify(lk) !== '[true,1,"🔒 Unlock"]' || JSON.stringify(ul) !== '[false,2]') bad.push('the page\'s Lock row pressed: ' + JSON.stringify({ lk, ul }));
    const hl = await ss(`(() => { XR.on = true; const P = XR.main, out = [];
      const draw = () => { for (const Q of XR.panels) { Q.last = ''; Q.t = -1e9; panelTick(Q, performance.now() + 1e6); } };
      for (const id of ${JSON.stringify(ids)}) { select(id); X.tab = 'item'; X.scroll = {}; draw();
        const r = P.regions.filter(q => q.y >= 190 && !/^scroll:/.test(q.id)).sort((a, b) => a.y - b.y || a.x - b.x); out.push([id, r.length ? r[0].id : '']); }
      select('cube01'); X.scroll = {}; draw(); const u = UNDO.length, q = P.regions.find(z => z.id === 'lock'); if (q) q.fn();
      const lk = [STU.items.get('cube01').rec.locked, UNDO.length - u]; itemAct('lock');
      XR.on = false; X.tab = 'scene'; renderPanes(); return { out, lk }; })()`);
    if (hl.out.some(r => r[1] !== 'lock') || JSON.stringify(hl.lk) !== '[true,1]') bad.push('the headset card\'s Lock row first under the heading: ' + JSON.stringify(hl));
    await ss(`(removeItem('grp128'), removeItem('cut128'), removeItem('vox128'), removeItem('pth128'), select(''), X.tab = 'scene', renderPanes(), 0)`);
    if (bad.length) errors.push(...bad.map(b => 'studio v128: ' + b));
  });
  // v127 (the owner, 9 November 2026): Walk view's mouse (a drag looks the way the mouse goes, a click grabs it, a crosshair,
  // a click at the crosshair, the hint only in Walk view, Esc deselecting nothing as the grab ends); the Upload pane's × (a
  // model's files go with it) and one slider for every model; a selected model's timeline (held, slid, let go as it is
  // deselected); Follow behind and at a side (the record, where it goes and how it faces, the card), and (v128) Faces: Them
  // or Where they look (the record, its default by side, where each side faces with it, the card's row). A page of its own
  await step('studio v127: Walk view\'s grabbed mouse, the Upload pane\'s × and one slider for every model, a model\'s timeline, Follow behind and at a side', async () => {
    const bad = [];
    await stp.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&scene=test&edit');
    await stp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    if (!await until('STUDIO.ready()', 120000)) { errors.push('studio v127: the test scene did not load'); return; }
    // ---- Walk view: a drag right looks right, up looks up; the hint shows only there
    const tip = () => stp.evaluate(() => { const t = document.getElementById('stuWalkTip'); return !!t && getComputedStyle(t).display !== 'none'; });
    await frames(2);
    if (await tip()) bad.push('the Walk hint shows in Orbit view');
    await ss(`(setView('walk'), WALK.yaw = 0, WALK.pitch = 0, WALK.to = null, 0)`);
    await frames(2);
    if (!await tip()) bad.push('the Walk hint does not show in Walk view');
    await stp.mouse.move(640, 400); await stp.mouse.down(); await stp.mouse.move(700, 360, { steps: 6 }); await stp.mouse.up();
    const yp = await ss('[WALK.yaw, WALK.pitch]');
    if (!(yp[0] < -0.1 && yp[1] > 0.05)) bad.push('a drag right and up in Walk view did not look right and up: ' + JSON.stringify(yp));
    // a click grabs the mouse (headless Chromium grants the lock): the crosshair, the hint gone; a click then acts at the
    // crosshair (pointed down at the floor: it walks there); let go, Esc at once deselects nothing
    await ss(`(WALK.pos.set(5, 1.6, 5), WALK.yaw = 0, WALK.pitch = -0.9, walkStep(0), 0)`);   // (looking down at open floor)
    await stp.mouse.click(640, 400);
    const grabbed = await until('GRAB.on && document.pointerLockElement === GL.canvas', 5000);
    if (!grabbed) bad.push('a click in Walk view did not grab the mouse: ' + JSON.stringify(await ss('[GRAB.on, GRAB.no]')));
    else {
      await frames(2);
      if (await tip()) bad.push('the Walk hint shows while the mouse is grabbed');
      if (!await stp.evaluate(() => { const e = document.getElementById('stuGrab'); return !!e && e.style.display !== 'none' && /Esc lets go/.test(e.textContent); })) bad.push('no crosshair while the mouse is grabbed');
      // a click with the mouse grabbed acts at the crosshair, the middle of the page, wherever the mouse is (clickAt watched:
      // where headless Chromium's grabbed mouse is, and how it turns the view on the way, are its own)
      await ss('(window.__clickAt = clickAt, clickAt = (x, y) => { window.__clicked = [x, y]; }, 0)');
      await stp.mouse.click(900, 300);
      const ck = await stp.evaluate(() => window.__clicked || null);
      await ss('(clickAt = window.__clickAt, delete window.__clicked, 0)');
      if (!ck || ck[0] !== 640 || ck[1] !== 380) bad.push('a click with the mouse grabbed did not act at the crosshair (the middle of the page, 640, 380): ' + JSON.stringify(ck));
      // a grabbed mouse's move (sent as the browser sends one: movementX and Y) turns the way it goes and never stops a walk to
      // a clicked spot (a drag does)
      const mv = await ss(`(() => { WALK.yaw = 0; WALK.pitch = 0; WALK.to = new THREE.Vector3(5, 0, 2);
        GL.canvas.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'mouse', movementX: 10, movementY: -4, bubbles: true }));
        const r = [+WALK.yaw.toFixed(4), +WALK.pitch.toFixed(4), !!WALK.to]; WALK.to = null; return r; })()`);
      if (mv.join() !== '-0.025,0.01,true') bad.push('a grabbed mouse moved right and up (10, -4 px): ' + JSON.stringify(mv) + ' (want it turned right and up by 0.0025 a pixel, the walk kept)');
      await ss(`(WALK.to = null, select('box001'), 0)`);
      if (await ss('STU.sel') !== 'box001') bad.push('the box could not be selected (editing on again) before Esc');
      // Esc while grabbed (a real browser's Esc ends the grab itself, which headless Chromium's does not): the studio's own Esc
      // deselects nothing; then the grab ended
      await stp.keyboard.press('Escape');
      if (await ss('STU.sel') !== 'box001') bad.push('Esc while the mouse was grabbed deselected the box: ' + JSON.stringify(await ss('[GRAB.on, performance.now() - GRAB.gone]')));
      await stp.evaluate(() => document.exitPointerLock());
      await until('!GRAB.on', 5000);
      if (await stp.evaluate(() => { const e = document.getElementById('stuGrab'); return !!e && e.style.display !== 'none'; })) bad.push('the crosshair stays after the grab ended');
      // a refused grab (as Chrome refuses one within a second of Esc): a click acts as before for 1.5 s, then grabs again
      const rf = await ss(`(document.dispatchEvent(new Event('pointerlockerror')), grabCan())`);
      const rf2 = await stp.waitForFunction(() => HOST.cur.peek('grabCan()'), null, { timeout: 5000 }).then(() => true, () => false);
      if (rf || !rf2) bad.push('a refused grab: ' + JSON.stringify({ atOnce: rf, after: rf2 }) + ' (want no grab at once, a grab again after 1.5 s)');
    }
    await ss(`(select(''), WALK.to = null, 0)`);
    await stp.mouse.click(640, 400);   // (grabbed again, then Orbit view: it lets go)
    if (await until('GRAB.on', 5000)) { await ss(`(setView('orbit'), 0)`); if (!await until('!GRAB.on && document.pointerLockElement !== GL.canvas', 5000)) bad.push('leaving Walk view did not let go of the mouse'); }
    else await ss(`(setView('orbit'), 0)`);
    // ---- the Upload pane: four rows, a × on each; the crate's row taken out with its MTL and texture; the all-models slider
    await ss(`(async () => { const get = async p => new File([await (await fetch('tools/studio/test/scenes/test/' + p)).arrayBuffer()], p.split('/').pop());
      upTake([{ path: 'drop/figure.fbx', file: await get('figure.fbx') }, { path: 'drop/tex/figure.png', file: await get('figure.png') }, { path: 'drop/crate/crate.obj', file: await get('originals/crate.obj') },
        { path: 'drop/crate/crate.mtl', file: await get('originals/crate.mtl') }, { path: 'drop/crate/crate.png', file: await get('originals/crate.png') }, { path: 'drop/tone.wav', file: await get('tone.wav') },
        { path: 'drop/notes.txt', file: new File(['hello'], 'notes.txt') }]); return 0; })()`);
    if (!await until(`!UP.planning && UP.rows.length === 4`, 20000)) bad.push('the drop made no plan of four rows: ' + JSON.stringify(await ss('STUDIO.state().upload')).slice(0, 300));
    else {
      await ss('(renderPanes(), 0)');
      const nx = await stp.evaluate(() => document.querySelectorAll('#pane-upload .stu-plan .stu-x').length);
      await stp.click('#pane-upload .stu-plan li:nth-child(2) .stu-x');
      const ax = await ss(`[UP.rows.map(r => r.kind + ':' + r.main.path).join(), UP.entries.map(e => e.path).join()]`);
      if (nx !== 4 || ax[0] !== 'model:drop/figure.fbx,sound:drop/tone.wav,keep:drop/notes.txt' || ax[1] !== 'drop/figure.fbx,drop/tex/figure.png,drop/tone.wav,drop/notes.txt') bad.push('the × on the crate\'s row: ' + JSON.stringify({ nx, ax }));
      await stp.evaluate(() => { const r = document.querySelector('#stuRangeUpAll'); r.value = 45; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
      const ka = await ss(`(renderPanes(), [UP.keepAll, UP.rows.filter(r => r.kind === 'model').map(r => r.keep).join(), document.querySelector('#stuRangeUp0').value])`);
      if (ka[0] !== 0.45 || ka[1] !== '0.45' || ka[2] !== '45') bad.push('the all-models slider at 45 %: ' + JSON.stringify(ka));
      await stp.click('#pane-upload .stu-plan li:nth-child(1) .stu-x');
      await stp.click('#pane-upload .stu-plan li:nth-child(1) .stu-x');
      await stp.click('#pane-upload .stu-plan li:nth-child(1) .stu-x');
      if (await ss('UP.rows.length + UP.entries.length') !== 0) bad.push('every row taken out leaves something: ' + JSON.stringify(await ss('[UP.rows.length, UP.entries.length]')));
      await ss(`(UP.keepAll = null, upClear(), 0)`);
    }
    // ---- the timeline: the box's Spin (2 s, loop), selected while editing: Pause holds it, the slider moves it, Play goes
    // on from there, deselected it follows the scene's clock again
    await ss(`(select('box001'), X.tab = 'item', renderPanes(), 0)`);
    const tl = await ss(`[!!document.querySelector('#stuRangeAnim'), /Timeline: [\\d.]+ s of 2\\.0 s/.test(document.querySelector('#pane-item').textContent), !!document.querySelector('#pane-item [data-act="an:play"]')]`);
    if (tl.join() !== 'true,true,true') bad.push('the box\'s card has no timeline: ' + JSON.stringify(tl));
    await stp.click('#pane-item [data-act="an:play"]');   // (Pause)
    await frames(1);
    const p0 = await ss(`STU.items.get('box001').action.time`);
    await frames(3);
    const p1 = await ss(`[STU.items.get('box001').action.time, !!ANIM.mine && !ANIM.mine.p, document.querySelector('#pane-item [data-act="an:play"]').textContent]`);
    if (Math.abs(p1[0] - p0) > 1e-6 || !p1[1] || p1[2] !== 'Play') bad.push('Pause did not hold the box: ' + JSON.stringify([p0, p1]));
    await stp.evaluate(() => { const r = document.querySelector('#stuRangeAnim'); r.value = 5; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
    await frames(2);
    const sk = await ss(`[+STU.items.get('box001').action.time.toFixed(3), ANIM.mine && ANIM.mine.p]`);
    if (sk[0] !== 0.5 || sk[1] !== false) bad.push('the slider at 0.5 s: ' + JSON.stringify(sk));
    await stp.click('#pane-item [data-act="an:play"]');   // (Play: on from 0.5 s)
    await frames(2);
    const pa = await ss(`STU.items.get('box001').action.time`);
    await stp.waitForTimeout(300); await frames(2);
    const pl = await ss(`[STU.items.get('box001').action.time, !!ANIM.mine && ANIM.mine.p]`);
    if (!(pa >= 0.5) || Math.abs(pl[0] - pa) < 1e-3 || !pl[1]) bad.push('Play did not go on from where the slider held it: ' + JSON.stringify([pa, pl]));   // (Spin loops every 2 s: a slow page may wrap round between the two)
    await ss(`(select(''), 0)`);
    await frames(2);
    const fr = await ss(`[ANIM.mine, Math.abs(STU.items.get('box001').action.time - (((sceneClock(performance.now()) % 2) + 2) % 2))]`);
    if (fr[0] !== null || !(fr[1] < 0.3)) bad.push('deselected, the box did not go back to the scene\'s clock: ' + JSON.stringify(fr));
    // ---- Follow behind and at a side: the record (in front is no side), where each puts it and how it faces, the card
    const nb = await ss(`JSON.stringify([normBehaviour({ kind: 'follow', side: 'behind' }), normBehaviour({ kind: 'follow', side: 'front' }), normBehaviour({ kind: 'follow', side: 'up' }), normBehaviour({ kind: 'avoid', side: 'left' })])`);
    if (nb !== JSON.stringify([{ kind: 'follow', who: 'nearest', range: 3, dist: 1, speed: 0.6, side: 'behind' }, { kind: 'follow', who: 'nearest', range: 3, dist: 1, speed: 0.6 }, null, { kind: 'avoid', who: 'nearest', range: 3, dist: 1.5, speed: 0.6, area: 2 }])) bad.push('Follow\'s side in its record: ' + nb);
    const wt = await ss(`(() => { const it = STU.items.get('box001'), h = { p: new THREE.Vector3(0, 1.6, 0), f: [0, -1] }, y0 = behYaw0(it);
      return ['front', 'behind', 'left', 'right'].map(sd => { const w = behWant(it, { kind: 'follow', dist: 1, side: sd === 'front' ? undefined : sd }, { tx: 0, tz: 0, d: 0 }, h, new THREE.Vector3(0, 0.25, 0)); return [+w.tx.toFixed(2), +w.tz.toFixed(2), +Math.abs(wrapA(w.d + y0)).toFixed(2)]; }); })()`);
    if (JSON.stringify(wt) !== '[[0,-1,0],[0,1,3.14],[-1,0,3.14],[1,0,3.14]]') bad.push('Follow in front, behind, left and right of a person looking along -z (move and facing): ' + JSON.stringify(wt));
    // Faces (v128): in the record (kept as given, a bad one refused, not look's or avoid's), its default by side, and where
    // each side faces with it set: 'them' its front to the head, 'along' the way the head looks (-z), standing at its spot
    const nf = await ss(`JSON.stringify([normBehaviour({ kind: 'follow', side: 'left', face: 'them' }), normBehaviour({ kind: 'follow', face: 'along' }), normBehaviour({ kind: 'follow', face: 'sideways' }), normBehaviour({ kind: 'item', target: 'abc123', face: null }),
      normBehaviour({ kind: 'look', face: 'them' }), normBehaviour({ kind: 'avoid', face: 'along' }), normBehaviour({ kind: 'item', target: 'abc123', face: 'them' }),
      [behFaceOf({ kind: 'follow' }), behFaceOf({ kind: 'follow', side: 'left' }), behFaceOf({ kind: 'item', target: 'abc123' }), behFaceOf({ kind: 'follow', side: 'behind', face: 'them' }), behFaceOf({ kind: 'follow', face: 'along' })]])`);
    if (nf !== JSON.stringify([{ kind: 'follow', who: 'nearest', range: 3, dist: 1, speed: 0.6, side: 'left', face: 'them' }, { kind: 'follow', who: 'nearest', range: 3, dist: 1, speed: 0.6, face: 'along' }, null, null,
      { kind: 'look', who: 'nearest', range: 3 }, { kind: 'avoid', who: 'nearest', range: 3, dist: 1.5, speed: 0.6, area: 2 }, { kind: 'item', target: 'abc123', speed: 0.6, face: 'them' }, ['them', 'along', 'along', 'them', 'along']])) bad.push('Faces in its record and by default: ' + nf);
    const wf = await ss(`(() => { const it = STU.items.get('box001'), h = { p: new THREE.Vector3(0, 1.6, 0), f: [0, -1] }, y0 = behYaw0(it), M0 = new THREE.Vector3(0, 0.25, 0), at = { front: [0, -1], behind: [0, 1], left: [-1, 0], right: [1, 0] }, out = [];
      for (const sd of ['front', 'behind', 'left', 'right']) for (const fc of ['them', 'along']) {
        const [x, z] = at[sd], w = behWant(it, { kind: 'follow', dist: 1, side: sd === 'front' ? undefined : sd, face: fc }, { tx: x, tz: z, d: 0 }, h, M0), want = fc === 'them' ? Math.atan2(-x, -z) : Math.PI;
        out.push([sd, fc, +w.tx.toFixed(2), +w.tz.toFixed(2), +Math.abs(wrapA(w.d + y0 - want)).toFixed(3)]);
      }
      return out; })()`);
    const at = { front: [0, -1], behind: [0, 1], left: [-1, 0], right: [1, 0] };
    if (wf.length !== 8 || wf.some(([sd, , x, z, e]) => x !== at[sd][0] || z !== at[sd][1] || e > 0.01)) bad.push('Follow with Faces: Them (its front to the head) and Where they look (along -z), for each side (move and how far off its facing): ' + JSON.stringify(wf));
    await ss(`(select('box001'), setRec('box001', { behaviour: { kind: 'follow', dist: 1, speed: 1, range: 3, who: 'nearest' } }), X.tab = 'item', renderPanes(), 0)`);
    await stp.click('#pane-item [data-act="i:bside"][data-v="left"]');
    const sc = await ss(`(renderPanes(), [STU.items.get('box001').rec.behaviour.side, /Stays at their left at/.test(document.querySelector('#pane-item').textContent)])`);
    // Faces (v128): at their left by default Where they look (its line), Them pressed (one Undo step, its line), kept as the
    // side changes to in front and behind, Where they look pressed in front (one Undo step)
    const fcard = () => ss(`(renderPanes(), (() => { const q = v => document.querySelector('#pane-item [data-act="i:bface"][data-v="' + v + '"]'), t = document.querySelector('#pane-item').textContent;
      return [STU.items.get('box001').rec.behaviour.face || '', !!q('them') && q('them').getAttribute('aria-pressed') === 'true', !!q('along') && q('along').getAttribute('aria-pressed') === 'true', /It turns to look at them/.test(t), /It faces the way they look/.test(t), UNDO.length]; })())`);
    const fc0 = await fcard();
    await stp.click('#pane-item [data-act="i:bface"][data-v="them"]');
    const fc1 = await fcard();
    await stp.click('#pane-item [data-act="i:bside"][data-v="front"]');
    const sf = await ss(`'side' in STU.items.get('box001').rec.behaviour`);
    const fc2 = await fcard();
    await stp.click('#pane-item [data-act="i:bside"][data-v="behind"]');
    const fc3 = await fcard();
    await stp.click('#pane-item [data-act="i:bside"][data-v="front"]');
    await stp.click('#pane-item [data-act="i:bface"][data-v="along"]');
    const fc4 = await fcard();
    if (sc.join() !== 'left,true' || sf) bad.push('the card\'s Where row: ' + JSON.stringify({ sc, sf }));
    if (fc0.slice(0, 5).join() !== ',false,true,false,true' || fc1.slice(0, 5).join() !== 'them,true,false,true,false' || fc1[5] !== fc0[5] + 1 || fc2.slice(0, 5).join() !== 'them,true,false,true,false' ||
      fc3.slice(0, 5).join() !== 'them,true,false,true,false' || fc4.slice(0, 5).join() !== 'along,false,true,false,true' || fc4[5] !== fc3[5] + 2) bad.push('the card\'s Faces row (Them, kept as the side changes, Where they look; one Undo step each): ' + JSON.stringify({ fc0, fc1, fc2, fc3, fc4 }));
    await ss(`(setRec('box001', { behaviour: undefined }), select(''), X.tab = 'scene', renderPanes(), 0)`);
    if (bad.length) errors.push(...bad.map(b => 'studio v127: ' + b));
  });
  // Fewer triangles and Change texture (tools/studio/SPEC.md): a dense, bumpy ball with a red and green checker made in the
  // page (24,320 triangles; nothing committed), served as ball.glb and placed twice
  await step('studio: Fewer triangles (a ball made in the page: previewed in place at 20 % within a few percent, its texture where it was, Save a GLB with tris in its record, switched where it stands, the headset\'s card), Change texture (shown, cancelled, saved) and the Upload pane\'s share and Preview (the viewer)', async () => {
    const bad = [];
    const b64 = await ss(`(async () => {
      exporterLoad();
      const T = THREE, g = new T.SphereGeometry(0.5, 128, 96), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.04 * Math.sin(20 * x) * Math.sin(20 * y) * Math.sin(20 * z); p.setXYZ(i, x * k, y * k, z * k); }
      g.computeVertexNormals();
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#e02020' : '#20c020'; x.fillRect(i * 8, j * 8, 8, 8); }
      const root = new T.Group(); root.add(new T.Mesh(g, new T.MeshStandardMaterial({ name: 'skin', map: new T.CanvasTexture(cv), roughness: 1, metalness: 0 })));
      const glb = await new Promise(res => new T.GLTFExporter().parse(root, res, { binary: true }));
      const u = new Uint8Array(glb); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s);
    })()`);
    const ball = Buffer.from(b64, 'base64');
    await stp.route('**/scenes/test/ball.glb*', r => r.fulfill({ body: ball, contentType: 'model/gltf-binary' }));
    const u0 = await ss('UNDO.length');
    const id = await ss(`(setEdit(true), setFiles(STU.files.concat({ path: 'ball.glb', bytes: ${ball.length}, at: 5, kind: 'model' })), addModel('ball.glb'))`), id2 = await ss(`addModel('ball.glb')`);
    if (!await until(`(() => { const a = STU.items.get('${id}'), b = STU.items.get('${id2}'); return a.model && b.model && a.a > 0.99 && b.a > 0.99; })()`, 30000)) { errors.push('studio: the ball made in the page was not placed'); return; }
    // the ball's colour where it shows (its own pixels, not the background's): red and green, the checker's (the mean red,
    // green, how far apart red and green are pixel by pixel: large for the checker, small for a picture without it)
    const mean = `(() => { const c = thumbOf(STU.items.get('${id}').holder, 96, 96, false), d = c.getContext('2d').getImageData(0, 0, 96, 96).data; let r = 0, g = 0, x = 0, n = 0; for (let i = 0; i < d.length; i += 4) { if (Math.abs(d[i] - 16) < 10 && Math.abs(d[i + 1] - 26) < 10 && Math.abs(d[i + 2] - 42) < 10) continue; r += d[i]; g += d[i + 1]; x += Math.abs(d[i] - d[i + 1]); n++; } return [Math.round(r / n), Math.round(g / n), Math.round(x / n), n]; })()`;
    const m0 = await ss(mean), n0 = await ss(`LIB.get('ball.glb').info.tris`);
    await ss(`(select('${id}'), X.tab = 'item', renderPanes(), 0)`);
    const acts = await stp.evaluate(() => [...document.querySelectorAll('#pane-item [data-act^="ft:"], #pane-item [data-act^="ct:"]')].map(b => b.dataset.act).join());
    if (acts !== 'ft:open,ct:open') bad.push('the ball\'s card: ' + acts);
    await stp.click('#pane-item [data-act="ft:open"]');
    if (!await until(`!!FT.pv && !FT.busy`, 30000)) bad.push('Fewer triangles made no preview: ' + JSON.stringify(await ss('STUDIO.state().lite.ft')));
    let t = await ss(`[STUDIO.tris('${id}'), STUDIO.tris('${id2}'), document.querySelector('#stuRangeFT') && document.querySelector('#stuRangeFT').value]`);
    if (n0 !== 24320 || Math.abs(t[0] / n0 - 0.2) > 0.01 || t[1] !== n0 || t[2] !== '20') bad.push('the preview at 20 % (this object only; the slider at 20): ' + JSON.stringify([n0, t]));
    // its texture where it was: every corner of the lighter one is a corner of the ball's own, with its texture coordinates;
    // and its colours as before
    const uvs = await ss(`(() => { const it = STU.items.get('${id}'), g0 = FT.pv.sw[0][1], g1 = it.model.meshes[0].geometry, key = (g, i) => [g.attributes.position.getX(i), g.attributes.position.getY(i), g.attributes.position.getZ(i), g.attributes.uv.getX(i), g.attributes.uv.getY(i)].map(v => v.toFixed(5)).join();
      const have = new Set(); for (let i = 0; i < g0.attributes.position.count; i++) have.add(key(g0, i)); let miss = 0; for (let i = 0; i < g1.attributes.position.count; i++) if (!have.has(key(g1, i))) miss++; return [g1 !== g0, miss, g1.attributes.position.count]; })()`);
    const m1 = await ss(mean);
    if (!uvs[0] || uvs[1] || Math.abs(m1[0] - m0[0]) > m0[0] * 0.06 || Math.abs(m1[1] - m0[1]) > m0[1] * 0.06 || Math.abs(m1[2] - m0[2]) > m0[2] * 0.1 || m0[0] < 40 || m0[1] < 40) bad.push('the preview\'s texture: ' + JSON.stringify({ uvs, m0, m1 }));
    // the slider let go at 50 %
    await stp.evaluate(() => { const r = document.querySelector('#stuRangeFT'); r.value = 50; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
    if (!await until(`!!FT.pv && FT.pv.keep === 0.5 && !FT.busy`, 30000) || Math.abs(await ss(`STUDIO.tris('${id}')`) / n0 - 0.5) > 0.02) bad.push('the slider at 50 %: ' + JSON.stringify(await ss('STUDIO.state().lite.ft')));
    const card = await stp.evaluate(() => document.querySelector('#pane-item').textContent.replace(/\s+/g, ' '));
    if (!/Fewer triangles: the share kept/.test(card) || !/It has 24,320 triangles: about 12,160 kept\./.test(card) || !/on this device only/.test(card) || !/Save downloads ball\.glb with about 12,160 triangles/.test(card)) bad.push('the card with Fewer triangles open: ' + card.slice(0, 500));
    // the pretend headset's card: steps and quick picks (no slider), Save only with a relay that takes uploads
    const xr = await ss(`(() => {
      const draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } }, out = {};
      // (every button the card draws, scrolled through)
      const ids = () => { const seen = []; for (let off = 0; off < 4000; off += 150) { X.scroll.item = off; draw(); for (const r of XR.main.regions) if (!seen.includes(r.id)) seen.push(r.id); } X.scroll = {}; draw(); return seen; };
      XR.on = true; X.scroll = {}; draw();
      out.ids = ids().filter(i => /^(ft|ct):/.test(i)).join(); out.txt = paneBlocks('item').filter(b => !b.page).map(b => (b.label || '') + ' ' + (b.p || '')).join(' | ');
      const was = { kind: SRC.kind, upload: SRC.upload, save: SRC.save, held: SRC.held };
      Object.assign(SRC, { kind: 'relay', upload: true, save: true, held: false }); out.save = ids().includes('ft:save'); Object.assign(SRC, was); draw();
      // (10 % pressed where the card shows it, scrolled to)
      for (let off = 0; off < 4000; off += 150) { X.scroll.item = off; draw(); const r = XR.main.regions.find(q => q.id === 'ft:10'); if (r) { r.fn(); break; } }
      X.scroll = {};
      out.keep = FT.keep; draw();
      XR.on = false; return out;
    })()`);
    if (xr.ids !== 'ft:-,ft:+,ft:10,ft:20,ft:50,ft:cancel,ct:open' || !/Fewer triangles: 50 % kept/.test(xr.txt) || !/Saving from a headset needs a relay that takes uploads/.test(xr.txt) || !xr.save || xr.keep !== 0.1) bad.push('the headset\'s card: ' + JSON.stringify(xr).slice(0, 700));
    if (!await until(`!!FT.pv && FT.pv.keep === 0.1 && !FT.busy`, 30000) || Math.abs(await ss(`STUDIO.tris('${id}')`) / n0 - 0.1) > 0.01) bad.push('the headset\'s 10 %: ' + JSON.stringify(await ss('STUDIO.state().lite.ft')));
    // Save at 20 % (no relay: downloaded): a GLB with tris in its record, its triangles as previewed; the preview put back
    await ss(`(ftSet(0.2, true), 0)`);
    await until(`!!FT.pv && FT.pv.keep === 0.2 && !FT.busy`, 30000);
    const want = await ss(`FT.pv.to`);
    const dl = stp.waitForEvent('download', { timeout: 60000 }).catch(() => null);
    await ss(`(renderPanes(), 0)`);
    await stp.click('#pane-item [data-act="ft:save"]');
    const d = await dl;
    await until(`!CV.busy && !FT.saving`, 60000);
    const g = await ss(`(async () => { const L = STUDIO.lastGLB, back = await new Promise((res, rej) => new THREE.GLTFLoader().parse(L.glb.slice(0), '', res, rej)); let tris = 0; back.scene.traverse(o => { if (o.isMesh) tris += o.geometry.index.count / 3; }); return { ok: L.ok, rec: L.record, tris, ft: FT.id, now: STUDIO.tris('${id}'), note: CV.note, maps: (() => { let n = 0; back.scene.traverse(o => { if (o.isMesh && o.material.map) n++; }); return n; })() }; })()`);
    if (!d || d.suggestedFilename() !== 'ball.glb' || !g.ok || !g.rec.tris || g.rec.tris.from !== n0 || g.rec.tris.to !== want || g.rec.tris.keep !== 0.2 || g.tris !== want || g.maps !== 1 || g.ft || g.now !== n0 || !/[\d,]+ of 24,320 triangles\) and downloaded as ball\.glb/.test(g.note)) bad.push('Save (downloaded): ' + JSON.stringify(Object.assign({ name: d && d.suggestedFilename(), want }, g)).slice(0, 600));
    // that GLB served as models/ball.glb, the balls switched to it where they stand (one Undo step), and its card now
    // counts from the original (20 % of its triangles; 50 % more than the GLB has: shown as it is, made again from it)
    const lite = Buffer.from(await ss(`(() => { const u = new Uint8Array(STUDIO.lastGLB.glb); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); })()`), 'base64');
    await stp.route('**/scenes/test/models/ball.glb*', r => r.fulfill({ body: lite, contentType: 'model/gltf-binary' }));
    const u1 = await ss('UNDO.length');
    await ss(`(setFiles(STU.files.concat({ path: 'models/ball.glb', bytes: ${lite.length}, at: 6, kind: 'model' })), GLBREC.set('models/ball.glb', { at: 6, rec: CONV.glbRecord({ asset: { extras: { studio: STUDIO.lastGLB.record } } }), p: null }), switchToGLB('ball.glb', 'models/ball.glb', CONV.glbRecord({ asset: { extras: { studio: STUDIO.lastGLB.record } } })))`);
    if (!await until(`(() => { const a = STU.items.get('${id}'); return a.rec.file === 'models/ball.glb' && !!a.model && a.E.state === 'ready'; })()`, 30000)) bad.push('the balls did not switch to models/ball.glb');
    else {
      const sw = await ss(`[STUDIO.tris('${id}'), STUDIO.tris('${id2}'), STU.items.get('${id}').rec.s, JSON.stringify(STU.items.get('${id}').rec.q), UNDO.length, (select('${id}'), X.tab = 'item', renderPanes(), document.querySelector('#pane-item').textContent.replace(/\\s+/g, ' ').match(/[\\d,]+ triangles \\([^)]*\\)/) + '')]`);
      if (sw[0] !== want || sw[1] !== want || sw[2] !== 1 || sw[3] !== '[0,0,0,1]' || sw[4] !== u1 + 1 || sw[5] !== `${want.toLocaleString('en-GB')} triangles (20 % of the 24,320 in ball.glb)`) bad.push('the switch to the lighter GLB: ' + JSON.stringify(sw));
      await stp.click('#pane-item [data-act="ft:open"]');
      await until(`!!FT.pv && !FT.busy`, 30000);
      await ss(`(ftSet(0.5, true), 0)`);
      await until(`!!FT.pv && FT.pv.keep === 0.5 && !FT.busy`, 30000);
      const c2 = await stp.evaluate(() => document.querySelector('#pane-item').textContent.replace(/\s+/g, ' '));
      if (!/ball\.glb has 24,320 triangles: about 12,160 kept\./.test(c2) || !/The model here has only [\d,]+, so the preview shows it as it is: Save makes it again from ball\.glb/.test(c2) || await ss(`STUDIO.tris('${id}')`) !== want) bad.push('the lighter GLB\'s card at 50 %: ' + c2.slice(0, 500));
      await stp.click('#pane-item [data-act="ft:cancel"]');
      await ss('undo()');
      await until(`STU.items.get('${id}').rec.file === 'ball.glb' && !!STU.items.get('${id}').model && STU.items.get('${id}').E.path === 'ball.glb'`, 30000);
    }
    await ss(`(setFiles(STU.files.filter(f => f.path !== 'models/ball.glb')), GLBREC.delete('models/ball.glb'), 0)`);
    await stp.unroute('**/scenes/test/models/ball.glb*');
    // Change texture: its material and slots, the scene's pictures; figure.png shown on this ball only, Cancel puts its own
    // back, then Save bakes it in (downloaded: the record's tex)
    await ss(`(select('${id}'), X.tab = 'item', renderPanes(), 0)`);
    const own = await ss(`STU.items.get('${id}').model.meshes[0].material.map.uuid`);
    await stp.click('#pane-item [data-act="ct:open"]');
    const ct0 = await stp.evaluate(() => document.querySelector('#pane-item').textContent.replace(/\s+/g, ' '));
    if (!/Change texture: its material skin Colour: inside the file/.test(ct0) || !/The scene's pictures \(2\) figure\.png/.test(ct0) || !/crate\.png originals\//.test(ct0) || !/Choose a picture\.\.\./.test(ct0)) bad.push('Change texture\'s card: ' + ct0.slice(0, 500));
    await stp.click('#pane-item [data-act="ct:pic"][data-v="figure.png"]');
    await until(`!!(CT.saved && CT.saved.length) && !CT.busy`, 20000);
    const m2 = await ss(mean), ct1 = await ss(`[STU.items.get('${id}').model.meshes[0].material.map === CT.tex, STU.items.get('${id2}').model.meshes[0].material.map.uuid === '${own}' || STU.items.get('${id2}').model.meshes[0].material.map !== CT.tex, CT.tex.image.width]`);
    if (!ct1[0] || !ct1[1] || ct1[2] !== 64 || m0[2] < 60 || m2[2] > m0[2] / 2) bad.push('figure.png shown on the ball: ' + JSON.stringify({ ct1, m0, m2 }));
    await stp.click('#pane-item [data-act="ct:cancel"]');
    const ct2 = await ss(`[STU.items.get('${id}').model.meshes[0].material.map.uuid === '${own}', CT.id]`), m3 = await ss(mean);
    if (!ct2[0] || ct2[1] || Math.abs(m3[0] - m0[0]) > 4 || Math.abs(m3[1] - m0[1]) > 4) bad.push('Cancel did not put its own picture back: ' + JSON.stringify({ ct2, m0, m3 }));
    await stp.click('#pane-item [data-act="ct:open"]');
    await stp.click('#pane-item [data-act="ct:pic"][data-v="figure.png"]');
    await until(`!!(CT.saved && CT.saved.length) && !CT.busy`, 20000);
    const dl2 = stp.waitForEvent('download', { timeout: 60000 }).catch(() => null);
    await stp.click('#pane-item [data-act="ct:save"]');
    const d2 = await dl2;
    await until(`!CV.busy && !CT.saving`, 60000);
    const g2 = await ss(`(async () => { const L = STUDIO.lastGLB, back = await new Promise((res, rej) => new THREE.GLTFLoader().parse(L.glb.slice(0), '', res, rej)); let w = 0; back.scene.traverse(o => { if (o.isMesh && o.material.map) w = o.material.map.image.width; }); return { ok: L.ok, tex: L.record.tex, w, ct: CT.id, map: STU.items.get('${id}').model.meshes[0].material.map.uuid === '${own}' }; })()`);
    if (!d2 || d2.suggestedFilename() !== 'ball.glb' || !g2.ok || JSON.stringify(g2.tex) !== '[{"name":"","mat":"skin","slot":"map","from":"figure.png","how":"chosen"}]' || g2.w !== 64 || g2.ct || !g2.map) bad.push('Change texture\'s Save (downloaded): ' + JSON.stringify(g2));
    // the pretend headset: Change texture by the ray, figure.png shown, Cancel
    const cx = await ss(`(() => {
      const draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } }, hit = id => { const r = XR.main.regions.find(q => q.id === id); if (r) r.fn(); return !!r; }, out = {};
      XR.on = true; X.scroll = {}; draw();
      for (let off = 0; off < 4000 && !out.open; off += 150) { X.scroll.item = off; draw(); out.open = hit('ct:open'); } X.scroll = {}; draw();
      const seen = new Set(); for (let off = 0; off < 4000; off += 150) { X.scroll.item = off; draw(); for (const r of XR.main.regions) seen.add(r.id); } X.scroll = {}; draw();
      out.ids = [...seen].filter(i => /^ct:/.test(i)).join();
      XR.on = false; return out;
    })()`);
    if (!cx.open || !/ct:mat:0/.test(cx.ids) || !/ct:slot:normalMap/.test(cx.ids) || !/ct:pic:figure\.png/.test(cx.ids) || /ct:file/.test(cx.ids) || !/ct:cancel/.test(cx.ids)) bad.push('Change texture in the headset: ' + JSON.stringify(cx));
    await ss(`(XR.on = true, (() => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } })(), act('ct:pic', 'figure.png'), XR.on = false, 0)`);
    if (!await until(`!!(CT.saved && CT.saved.length) && !CT.busy && STU.items.get('${id}').model.meshes[0].material.map === CT.tex`, 20000)) bad.push('the headset did not show figure.png on the ball');
    await ss(`(XR.on = true, act('ct:cancel'), XR.on = false, 0)`);
    if (await ss(`STU.items.get('${id}').model.meshes[0].material.map.uuid !== '${own}' || !!CT.id`)) bad.push('the headset\'s Cancel did not put its picture back');
    // nothing of either for a visitor
    const vis = await ss(`(() => { OPT.visit = true; renderPanes(); const n = document.querySelectorAll('#pane-item [data-act^="ft:"], #pane-item [data-act^="ct:"]').length; act('ft:open', '${id}'); const r = [n, FT.id]; OPT.visit = false; renderPanes(); return r; })()`);
    if (vis[0] || vis[1]) bad.push('a visitor has Fewer triangles or Change texture: ' + JSON.stringify(vis));
    // the Upload pane: the ball dropped, 20 % to start with its triangles counted from its bytes, 30 % on its slider, its
    // picture, then converted (downloaded) with that share
    await ss(`(select(''), X.tab = 'upload', renderPanes(), 0)`);
    await stp.evaluate(b64 => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); HOST.cur.peek('upTake')([{ path: 'ball.glb', file: new File([u], 'ball.glb') }]); }, b64);
    await until(`!UP.planning && UP.rows.length === 1`, 20000);
    let up = await ss(`(renderPanes(), [UP.rows[0].keep, UP.rows[0].tris, document.querySelector('#stuRangeUp0') && document.querySelector('#stuRangeUp0').value, document.querySelector('#pane-upload .stu-plan').textContent.replace(/\\s+/g, ' ')])`);
    if (up[0] !== 0.2 || up[1] !== n0 || up[2] !== '20' || !/About 4,864 of its 24,320 triangles\./.test(up[3])) bad.push('the Upload row\'s share: ' + JSON.stringify(up).slice(0, 500));
    await stp.evaluate(() => { const r = document.querySelector('#stuRangeUp0'); r.value = 30; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
    // (Preview opens the viewer over the whole window, v125: its own steps are 'studio viewer'; closed, what it saw is on the row)
    await stp.click('#pane-upload [data-act="up:pv"]');
    await until(`VW.open && !VW.busy && !!VW.root && VW.n1 < VW.cur`, 60000);
    await ss('(vwClose(), 0)');
    up = await ss(`(renderPanes(), [UP.rows[0].keep, UP.rows[0].pv, /Seen in the viewer/.test(document.querySelector('#pane-upload .stu-plan').textContent)])`);
    if (up[0] !== 0.3 || !up[1] || !/^Seen in the viewer: 24,320 triangles became 7,[23]\d\d\.$/.test(up[1].words) || !up[2]) bad.push('the Upload row\'s Preview (the viewer): ' + JSON.stringify(up).slice(0, 300));
    await stp.click('#pane-upload [data-act="up:run"]');
    await until(`!UP.busy && UP.rows[0].state === 'done'`, 60000);
    const ug = await ss(`(async () => { const a = document.querySelector('#pane-upload .stu-plan a[download]'), j = a ? CONV.glbJSON(await (await fetch(a.href)).arrayBuffer()) : null; return [UP.rows[0].msg, j && j.asset.extras.studio.tris]; })()`);
    if (!/^Converted \([\d.]+ KB, 7,[23]\d\d of 24,320 triangles\)\.$/.test(ug[0]) || !ug[1] || ug[1].keep !== 0.3 || ug[1].from !== n0) bad.push('the Upload row converted: ' + JSON.stringify(ug));
    // back as it was
    // (the two balls placed are the only steps since: taken back)
    while (await ss('UNDO.length') > u0) await ss('undo()');
    await ss(`(upClear(), setFiles(STU.files.filter(f => f.path !== 'ball.glb')), X.tab = 'scene', renderPanes(), 0)`);
    await stp.unroute('**/scenes/test/ball.glb*');
    if (await ss('STU.items.size') !== 4 || await ss('unsaved()')) bad.push('the layout did not come back after Fewer triangles and Change texture');
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  // the gaps filled (tools/studio/SPEC.md, "Fewer triangles": the fill): a dense ball whose picture is an atlas of 128
  // wavy pieces on black, as a scan's is (made in the page; nothing committed), placed as scanned. At 10 % its seams
  // straighten and sample the black between the pieces; filled (the preview, and the GLB Save makes), far fewer black
  // pixels; the GLB's record says so, its card too, and it is not filled again; a picture that tiles is left alone
  await step('studio: the gaps between a picture\'s pieces filled (an atlas ball made in the page: the 10 % preview and the saved GLB with far fewer black pixels than without, filled once and cached, its record and card, not filled again, a tiling picture left alone; a picture drawn down without a dark rim, a see-through one with clear gaps left alone)', async () => {
    const bad = [];
    const b64 = await ss(`(async () => {
      exporterLoad();
      const T = THREE, g = new T.SphereGeometry(0.5, 128, 96).toNonIndexed(), p = g.attributes.position, uv = g.attributes.uv, n = p.count, S = 512;
      // each triangle's piece: 16 x 8 by where it is on the sphere; within its piece the coordinates bent into waves, so
      // its outline in the picture is wavy (as a scan's pieces are), 6 px of black round each piece
      const cell = (u, v) => [Math.min(15, Math.floor(u * 16)), Math.min(7, Math.floor(v * 8))];
      const map = (u, v, cu, cv) => { const a = u * 16 - cu, b = v * 8 - cv, x = a + 0.12 * Math.sin(3 * Math.PI * b), y = b + 0.12 * Math.sin(3 * Math.PI * a); return [(cu * 32 + 6 + (x + 0.12) / 1.24 * 20) / S, (cv * 64 + 6 + (y + 0.12) / 1.24 * 52) / S]; };
      const out = new Float32Array(n * 2), tile = [];
      for (let t = 0; t < n; t += 3) {
        const cu = cell((uv.getX(t) + uv.getX(t + 1) + uv.getX(t + 2)) / 3, 0)[0], cv = cell(0, (uv.getY(t) + uv.getY(t + 1) + uv.getY(t + 2)) / 3)[1];
        tile.push(cu + cv * 16);
        for (let k = 0; k < 3; k++) { const m = map(uv.getX(t + k), uv.getY(t + k), cu, cv); out[(t + k) * 2] = m[0]; out[(t + k) * 2 + 1] = m[1]; }
      }
      g.setAttribute('uv', new T.BufferAttribute(out, 2));
      const cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
      // each piece painted by its own triangles (the picture's v up, as three.js reads it), in a light colour of its own
      for (let t = 0; t < n; t += 3) {
        x.fillStyle = x.strokeStyle = 'hsl(' + (tile[t / 3] * 47 % 360) + ',70%,62%)'; x.lineWidth = 0.6; x.beginPath();
        for (let k = 0; k < 3; k++) x[k ? 'lineTo' : 'moveTo'](out[(t + k) * 2] * S, (1 - out[(t + k) * 2 + 1]) * S);
        x.closePath(); x.fill(); x.stroke();
      }
      g.deleteAttribute('normal');
      const root = new T.Group(); root.add(new T.Mesh(g, new T.MeshBasicMaterial({ name: 'scan', map: new T.CanvasTexture(cv) })));
      const glb = await new Promise(res => new T.GLTFExporter().parse(root, res, { binary: true }));
      const u = new Uint8Array(glb); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s);
    })()`);
    const atlas = Buffer.from(b64, 'base64');
    await stp.route('**/scenes/test/atlas.glb*', r => r.fulfill({ body: atlas, contentType: 'model/gltf-binary' }));
    const u0 = await ss('UNDO.length');
    const id = await ss(`(setEdit(true), setFiles(STU.files.concat({ path: 'atlas.glb', bytes: ${atlas.length}, at: 7, kind: 'model' })), addModel('atlas.glb'))`);
    if (!await until(`(() => { const a = STU.items.get('${id}'); return a.model && a.a > 0.99; })()`, 30000)) { errors.push('studio: the atlas ball made in the page was not placed'); return; }
    await ss(`(select('${id}'), act('i:light', 'scan'), X.tab = 'item', renderPanes(), 0)`);
    // its black pixels as drawn (as scanned: the picture's own colours; four sides, the background left out)
    const black = obj => `(() => { const h = ${obj}, q0 = h.quaternion.clone(); let k = 0, all = 0; for (let i = 0; i < 4; i++) { h.quaternion.copy(q0).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * Math.PI / 2)); const d = thumbOf(h, 160, 160, false).getContext('2d').getImageData(0, 0, 160, 160).data; for (let j = 0; j < d.length; j += 4) { if (Math.abs(d[j] - 16) < 6 && Math.abs(d[j + 1] - 26) < 6 && Math.abs(d[j + 2] - 42) < 6) continue; all++; if (Math.max(d[j], d[j + 1], d[j + 2]) < 24) k++; } } h.quaternion.copy(q0); h.updateMatrixWorld(true); return [k, all]; })()`;
    const b0 = await ss(black(`STU.items.get('${id}').holder`));
    const own = await ss(`STU.items.get('${id}').model.meshes[0].material.map.uuid`);
    await stp.click('#pane-item [data-act="ft:open"]');
    await ss(`(ftSet(0.1, true), 0)`);
    if (!await until(`!!FT.pv && FT.pv.keep === 0.1 && !FT.busy && !!FT.fill`, 60000)) { bad.push('no preview at 10 %: ' + JSON.stringify(await ss('STUDIO.state().lite.ft'))); }
    const f1 = await ss('STUDIO.state().lite.ft.fill'), bF = await ss(black(`STU.items.get('${id}').holder`));
    // the same preview without the fill: its picture as it is
    await ss(`(window.__fill = FT.fill, ftFillHide(), 0)`);
    const bN = await ss(black(`STU.items.get('${id}').holder`)), mapNo = await ss(`STU.items.get('${id}').model.meshes[0].material.map.uuid`);
    await ss(`(ftFillShow(STU.items.get('${id}')), 0)`);
    const card = await stp.evaluate(() => document.querySelector('#pane-item').textContent.replace(/\s+/g, ' '));
    if (!f1 || f1.n !== 1 || f1.again || !f1.shown || f1.err || mapNo !== own) bad.push('the preview\'s fill: ' + JSON.stringify({ f1, own: mapNo === own }));
    if (b0[0] > b0[1] * 0.002 || bN[0] < 40 || bF[0] * 4 > bN[0] || bF[0] > b0[0] + bN[0] / 10) bad.push('black pixels (all its triangles, 10 % without the fill, 10 % filled): ' + JSON.stringify({ b0, bN, bF }));
    if (!/Its picture is shown with the gaps between its pieces filled with the colours round them, as Save fills it: no black seams\./.test(card)) bad.push('the card with the fill shown: ' + card.slice(0, 600));
    // another share: the fill worked out once (the same), shown again
    await ss(`(ftSet(0.2, true), 0)`);
    await until(`!!FT.pv && FT.pv.keep === 0.2 && !FT.busy`, 60000);
    if (!await ss(`FT.fill === window.__fill && FT.fsw.length > 0 && STU.items.get('${id}').model.meshes[0].material.map !== null && STU.items.get('${id}').model.meshes[0].material.map.uuid !== '${own}'`)) bad.push('the fill was not kept for another share: ' + JSON.stringify(await ss('STUDIO.state().lite.ft')));
    // Save at 10 % (no relay: downloaded): the GLB's record says it is filled; drawn, far fewer black pixels than the
    // converter's own GLB at 10 % made without the fill
    await ss(`(ftSet(0.1, true), 0)`);
    await until(`!!FT.pv && FT.pv.keep === 0.1 && !FT.busy`, 60000);
    const dl = stp.waitForEvent('download', { timeout: 60000 }).catch(() => null);
    await ss(`(renderPanes(), 0)`);
    await stp.click('#pane-item [data-act="ft:save"]');
    const d = await dl;
    await until(`!CV.busy && !FT.saving`, 60000);
    const g = await ss(`(async () => {
      const L = STUDIO.lastGLB, out = { ok: L.ok, rec: L.record, notes: L.notes, ft: FT.id, fill: !!FT.fill, map: STU.items.get('${id}').model.meshes[0].material.map.uuid === '${own}' };
      const draw = async glb => { const back = await new Promise((res, rej) => new THREE.GLTFLoader().parse(glb.slice(0), '', res, rej)), h = new THREE.Group(); back.scene.traverse(o => { if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ map: o.material.map }); }); h.add(back.scene); window.__h = h; const r = ${black('window.__h')}; CONV.disposeTree(back.scene); return r; };
      out.b = await draw(L.glb);
      // (the converter's GLB at 10 % without the fill, from the same file)
      const m = await CONV.load({ ext: 'glb', data: await (await fetch(fileUrl('atlas.glb'))).arrayBuffer(), base: '', name: 'atlas', maxTex: 4096, url: u => u });
      const r = await CONV.toGLB(m, { name: 'atlas', keep: 0.1, fill: false });
      CONV.disposeTree(m.root);
      out.bNo = await draw(r.glb); out.recNo = r.record;
      return out;
    })()`);
    if (!d || d.suggestedFilename() !== 'atlas.glb' || !g.ok || g.rec.fill !== 1 || !g.rec.tris || g.rec.tris.keep !== 0.1 || g.recNo.fill || g.ft || g.fill || !g.map || !g.notes.some(n => /^texture gaps filled: its picture \(\d+ % of it used by its triangles\)/.test(n))) bad.push('Save (downloaded): ' + JSON.stringify(Object.assign({ name: d && d.suggestedFilename() }, g)).slice(0, 700));
    if (g.bNo[0] < 40 || g.b[0] * 4 > g.bNo[0]) bad.push('black pixels in the saved GLB (filled, and without the fill): ' + JSON.stringify({ b: g.b, bNo: g.bNo }));
    // that GLB placed: its card says so; Fewer triangles on it fills nothing again (its picture is filled)
    const lite = Buffer.from(await ss(`(() => { const u = new Uint8Array(STUDIO.lastGLB.glb); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); })()`), 'base64');
    await stp.route('**/scenes/test/models/atlas.glb*', r => r.fulfill({ body: lite, contentType: 'model/gltf-binary' }));
    const id2 = await ss(`(setFiles(STU.files.concat({ path: 'models/atlas.glb', bytes: ${lite.length}, at: 8, kind: 'model' })), addModel('models/atlas.glb'))`);
    if (!await until(`(() => { const a = STU.items.get('${id2}'); return !!a.model && a.E.state === 'ready'; })()`, 30000)) bad.push('the filled GLB was not placed');
    else {
      await ss(`(select('${id2}'), X.tab = 'item', renderPanes(), 0)`);
      const c2 = await stp.evaluate(() => document.querySelector('#pane-item').textContent.replace(/\s+/g, ' '));
      if (!/Textures: the gaps between the pieces of its picture are filled with the colours round them \(in this GLB\), so it shows no black seams when made lighter\./.test(c2)) bad.push('the filled GLB\'s card: ' + c2.slice(0, 600));
      await stp.click('#pane-item [data-act="ft:open"]');
      await until(`!!FT.pv && !FT.busy && !!FT.fill`, 60000);
      const f2 = await ss('STUDIO.state().lite.ft.fill');
      if (!f2 || f2.n !== 0 || f2.again !== 1 || f2.shown) bad.push('the filled GLB filled again: ' + JSON.stringify(f2));
      await stp.click('#pane-item [data-act="ft:cancel"]');
    }
    // a picture that tiles (texture coordinates 0 to 4, repeating) is left alone, as is one the model nearly all uses
    const tl = await ss(`(async () => {
      const T = THREE, cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#e0c040'; x.fillRect(8, 8, 24, 24);
      const g = new T.PlaneGeometry(1, 1, 8, 8), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 4);
      const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping;
      const root = new T.Group(); root.add(new T.Mesh(g, new T.MeshBasicMaterial({ map: t })));
      const r = await CONV.fillModel(root), px = x.getImageData(48, 48, 1, 1).data;
      const t2 = new T.CanvasTexture(cv), root2 = new T.Group(); root2.add(new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: t2 })));
      const r2 = await CONV.fillModel(root2);
      return { n: r.list.length, why: r.why, px: [...px], n2: r2.list.length, why2: r2.why, same: root.children[0].material.map.image === cv };
    })()`);
    if (tl.n || !tl.why.includes('a picture repeats across the model (tiles)') || tl.px.slice(0, 3).join() !== '0,0,0' || !tl.same || tl.n2 || !tl.why2.includes('a picture is nearly all used')) bad.push('a picture that tiles, or one nearly all used: ' + JSON.stringify(tl));
    // a picture drawn down (by the converter's own reading, 4 times here: CONV.picture with a max) has the rims of its
    // pieces taken back and filled too: beside the piece nothing darker than a tenth below its colour; drawn down the
    // same way by hand (the converter not told), the dark rim copied outwards. A see-through picture whose gaps are clear
    // is left as it is and said (a canvas keeps no colour there); one whose gaps are opaque black is filled, its alpha kept
    const dn = await ss(`(async () => {
      const T = THREE, out = {}, S = 256, big = document.createElement('canvas'); big.width = big.height = S; const bx = big.getContext('2d');
      bx.fillStyle = '#000'; bx.fillRect(0, 0, S, S); bx.fillStyle = 'rgb(200,160,60)'; bx.fillRect(66, 66, 124, 124);
      const url = await new Promise(res => big.toBlob(b => res(URL.createObjectURL(b)), 'image/png'));
      const plane = img => { const g = new T.PlaneGeometry(1, 1), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (66 + uv.getX(i) * 124) / S, (66 + uv.getY(i) * 124) / S); const r = new T.Group(); r.add(new T.Mesh(g, new T.MeshBasicMaterial({ map: new T.CanvasTexture(img) }))); return r; };
      const darkest = async img => {
        const root = plane(img), r = await CONV.fillModel(root), d = root.children[0].material.map.image.getContext('2d').getImageData(0, 0, 64, 64).data;
        let m = 1;
        for (const y of [24, 32, 40]) for (const x of [12, 13, 14, 15, 16, 17, 18, 45, 46, 47, 48, 49, 50, 51]) for (const [i, j] of [[x, y], [y, x]]) { const p = (j * 64 + i) * 4; m = Math.min(m, d[p] / 200, d[p + 1] / 160, d[p + 2] / 60); }
        return { m: Math.round(m * 100) / 100, n: r.list.length, rim: r.list[0] && r.list[0].rim };
      };
      const said = await CONV.picture(url, { max: 64, ext: 'png' }), hand = document.createElement('canvas'); hand.width = hand.height = 64;
      const hx = hand.getContext('2d'); hx.imageSmoothingQuality = 'high'; hx.drawImage(big, 0, 0, 64, 64);
      out.said = await darkest(said); out.hand = await darkest(hand);
      URL.revokeObjectURL(url);
      const seeThrough = async clear => {
        const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
        if (!clear) { x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64); }
        x.fillStyle = 'rgba(40,170,220,0.8)'; x.fillRect(16, 16, 32, 32);
        const g = new T.PlaneGeometry(1, 1), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.25 + uv.getX(i) * 0.5, 0.25 + uv.getY(i) * 0.5);
        const root = new T.Group(); root.add(new T.Mesh(g, new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true })));
        const r = await CONV.fillModel(root), d = root.children[0].material.map.image.getContext('2d').getImageData(10, 32, 1, 1).data;
        return { n: r.list.length, why: r.why, px: [...d] };
      };
      out.clear = await seeThrough(true); out.opaque = await seeThrough(false);
      return out;
    })()`);
    if (dn.said.n !== 1 || !(dn.said.rim > 0) || dn.said.m < 0.9 || dn.hand.n !== 1 || dn.hand.rim || dn.hand.m > 0.75) bad.push('a picture drawn down 4 times (by the converter, by hand): ' + JSON.stringify({ said: dn.said, hand: dn.hand }));
    if (dn.clear.n || !dn.clear.why.includes('a see-through picture whose gaps are clear (no colour can be kept where nothing shows)') || dn.opaque.n !== 1 || dn.opaque.px[3] !== 255 || Math.max(...dn.opaque.px.slice(0, 3)) < 100) bad.push('a see-through picture (gaps clear, gaps opaque): ' + JSON.stringify({ clear: dn.clear, opaque: dn.opaque }));
    // back as it was
    while (await ss('UNDO.length') > u0) await ss('undo()');
    await ss(`(setFiles(STU.files.filter(f => f.path !== 'atlas.glb' && f.path !== 'models/atlas.glb')), select(''), X.tab = 'scene', renderPanes(), 0)`);
    await stp.unroute('**/scenes/test/atlas.glb*');
    await stp.unroute('**/scenes/test/models/atlas.glb*');
    if (await ss('STU.items.size') !== 4 || await ss('unsaved()')) bad.push('the layout did not come back after the fill');
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
  });
  await step('studio: the headset panels\' panes, its Stories screen, and Download', async () => {
    const bad = await ss(`(() => {
      const out = [], want = { scene: ['edit', 'scene:test', 'load'], add: ['add:box.glb', 'add:figure.fbx', 'adds:tone.wav', 'cube'], item: ['light:scan', 'anim:once', 'turn', 'stand', 'del'], items: ['sel:box001', 'sel:cube01', 'sel:snd001'] };
      const draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } };
      setEdit(true); select('box001'); XR.on = true;
      for (const tab of Object.keys(want)) {
        // (every button the pane draws, scrolled through: an object's card is taller than the panel since it lists its
        // cut-outs)
        X.tab = tab; X.scroll = {}; draw();
        const seen = new Set();
        for (let off = 0; off < 4000; off += 150) { X.scroll[tab] = off; draw(); for (const r of XR.main.regions) seen.add(r.id); }
        X.scroll = {}; draw();
        const ids = [...seen], miss = want[tab].filter(i => !ids.includes(i));
        if (miss.length) out.push('the headset\\'s ' + tab + ' pane lacks ' + miss.join(', ') + ' (' + ids.join(' ') + ')');
        if (ids.some(i => i === 'download' || i === 'upload' || i.startsWith('tc:'))) out.push('the headset\\'s ' + tab + ' pane has the page\\'s own buttons');
        if (ids.includes('exit')) out.push('Exit is on the panel (it belongs in the menu)');
        if (ids.includes('tab:upload') || ids.some(i => i === 'convert' || i === 'convertAll')) out.push('the headset\\'s ' + tab + ' pane has the Upload tab or Convert (the page\\'s own)');
      }
      // a button on the headset's pane works as the page's
      X.tab = 'item'; draw();
      const r = XR.main.regions.find(q => q.id === 'light:scan'); if (r) r.fn();
      if (STU.items.get('box001').rec.light !== 'scan') out.push('the headset\\'s As scanned did not set the box\\'s light');
      undo(); select('');
      // the headset's Stories screen, as every story's
      const was = XR.inStory; XR.stories = true; XR.inStory = true; xrUpdate(storyState(0)); draw();
      try { ${LAND_CHECK} } catch (e) { out.push(e.message); }
      XR.inStory = was; XR.stories = false; XR.on = false; XR.landShown = false; HOST.setUrl(false); GL.world.visible = true; for (const P of XR.panels) P.mesh.visible = false; X.tab = 'scene'; renderPanes();
      return out;
    })()`);
    if (bad.length) errors.push(...bad.map(b => 'studio: ' + b));
    await stp.click('#pane-scene [data-act="download"]');
    const d = JSON.parse(await ss('STUDIO.download') || 'null');
    if (!d || d.studio !== 1 || d.scene !== 'test' || d.objects.length !== 2 || d.cubes.length !== 1 || d.sounds.length !== 1 || d.cubes[0].show.join() !== 'fig001,snd001') errors.push('studio: Download did not give the layout: ' + JSON.stringify(d).slice(0, 300));
    // #studio&upload (where the relay's /upload sends people) opens the Upload pane
    await stp.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&upload');
    await stp.reload();
    await stp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    if (!await until(`X.tab === 'upload' && !!document.querySelector('#pane-upload.on .stu-drop')`, 10000)) errors.push('studio: #studio&upload did not open the Upload pane: ' + await ss('X.tab'));
    await stp.close();
  });
}
// The studio's textures (tools/studio/SPEC.md, "Textures: found, added, converted"), on a page of its own: the second test
// scene, tools/studio/test/scenes/textures (made by tools/studio/test/make.mjs), every model placed: the ladder's rungs
// (a TIFF by its path, a PSD in an FBX by its name, a TGA named and a TIFF there, a DDS of a similar name), TIFF, PSD and
// DDS read in the page with the pixels they were made from (tools/studio/test/pictures.mjs), a refused picture's
// sentence, the card's lines; the card's Use and Choose (a stubbed chooser) converting at once to a GLB whose record has
// tex and that loads back textured, the object switched to it where it stands; Add a texture on an untextured model
// with UVs; roughness and metalness packed into one; a bump made a normal map; the Upload pane's plan ('only', 'ext',
// 'similar', a picture dropped onto a row, Not this and Use) and its GLBs (no relay: downloads); the headset's lines
if (runs('studio textures')) {
  const { PX } = await import('./studio/test/pictures.mjs');
  const txp = await browser.newPage({ viewport: { width: 1280, height: 760 }, acceptDownloads: true });
  txp.on('pageerror', e => errors.push('studio textures: ' + (e.stack || e.message)));
  txp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('studio textures: ' + m.text()); });
  const ss = s => txp.evaluate(s => HOST.cur.peek(s), s);
  const until = (src, ms) => txp.waitForFunction(src => HOST.cur.peek(src), src, { timeout: ms || 20000 }).then(() => true, () => false);
  const T_DIR = 'tools/studio/test/scenes/textures/';
  const MODELS = ['crate.obj', 'panel.fbx', 'brick.obj', 'stone.obj', 'rust.obj', 'broken.obj', 'plain.obj'];
  const idOf = f => ss(`([...STU.items.values()].find(it => it.rec.file === ${JSON.stringify(f)}) || {}).id || ''`);
  const card = async f => { await ss(`(select(${JSON.stringify(await idOf(f))}), X.tab = 'item', renderPanes(), 0)`); return txp.evaluate(() => document.querySelector('#pane-item').textContent.replace(/\s+/g, ' ')); };
  // the GLB made last (STUDIO.lastGLB): its record, its materials' pictures, and loaded back
  const lastGLB = () => ss(`(async () => {
    const L = STUDIO.lastGLB; if (!L) return null;
    const j = CONV.glbJSON(L.glb), back = await new Promise((res, rej) => new THREE.GLTFLoader().parse(L.glb.slice(0), '', res, rej)), mats = [];
    back.scene.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) mats.push({ map: !!m.map, normal: !!m.normalMap, rm: !!m.roughnessMap && m.roughnessMap === m.metalnessMap, ao: !!m.aoMap }); });
    return { ok: L.ok, why: L.why, notes: L.notes, rec: j.asset.extras.studio, mats, mdefs: j.materials };
  })()`);
  const waitConv = () => until(`!CV.busy && !!STUDIO.lastGLB`, 60000);
  await step('studio textures: the ladder (path, name, another kind, similar words), TIFF, PSD in an FBX and DDS read in the page with their pixels, a refusal\'s sentence, the card\'s lines', async () => {
    await txp.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&scene=textures&edit');
    await txp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    if (!await until(`STU.scene === 'textures' && STU.listing === 'ok'`, 30000)) { errors.push('studio textures: the textures scene did not open: ' + JSON.stringify(await ss('STUDIO.state()')).slice(0, 300)); return; }
    await ss(`(${JSON.stringify(MODELS)}.forEach(f => addModel(f)), 0)`);
    if (!await until(`LIB.size === 7 && [...LIB.values()].every(E => E.state === 'ready' || E.state === 'failed')`, 60000)) { errors.push('studio textures: the models did not load'); return; }
    const M = await ss('STUDIO.state().models'), bad = [];
    const want = {
      'crate.obj': { found: { 'wood.tif': ['tex/wood.tif', 'path'], 'crate_height.png': ['crate_height.png', 'path'] }, decoded: ['wood.tif TIFF'], missing: [] },
      'panel.fbx': { found: { 'Panel_Albedo.PSD': ['panel_albedo.psd', 'name'], 'panel_nrm.dds': ['panel_nrm.dds', 'path'] }, decoded: ['Panel_Albedo.PSD PSD (Photoshop)', 'panel_nrm.dds DDS (DirectX)'], missing: [] },
      'brick.obj': { found: { 'brick.tga': ['brick.tif', 'ext'] }, decoded: ['brick.tga TIFF'], missing: [] },
      'stone.obj': { found: { 'stone_diffuse.jpg': ['Stone-BaseColor.dds', 'similar'] }, decoded: ['stone_diffuse.jpg DDS (DirectX)'], missing: [] },
      'rust.obj': { found: {}, decoded: [], missing: ['rust_old.png'] },
      'broken.obj': { found: { 'broken.tif': ['broken.tif', 'path'] }, decoded: [], missing: ['broken.tif'], why: { 'broken.tif': 'a TIFF compressed with JPEG: save it as PNG' } },
      'plain.obj': { found: {}, decoded: [], missing: [] },
    };
    for (const [f, w] of Object.entries(want)) {
      const m = M[f], got = m && { found: Object.fromEntries(Object.entries(m.found).map(([k, v]) => [k, [v.path, v.how]])), decoded: m.decoded.map(d => d.name + ' ' + d.fmt), missing: m.missing };
      if (!m || m.state !== 'ready' || JSON.stringify(got) !== JSON.stringify({ found: w.found, decoded: w.decoded, missing: w.missing }) || (w.why && JSON.stringify(m.why) !== JSON.stringify(w.why))) bad.push(`${f}: ${JSON.stringify(m && Object.assign(got, { state: m.state, why: m.why }))}`);
    }
    if (!M['panel.fbx'] || JSON.stringify(M['panel.fbx'].mats) !== '[{"key":"panel","name":"panel","uv":true,"slots":["map","normalMap"],"meshes":["panel"]}]' || JSON.stringify(M['plain.obj'].mats) !== '[{"key":0,"name":"","uv":true,"slots":[],"meshes":["plain"]}]') bad.push('the materials: ' + JSON.stringify([M['panel.fbx'] && M['panel.fbx'].mats, M['plain.obj'] && M['plain.obj'].mats]));
    // the pictures as the page shows them: sampled from each texture's picture against the pixels it was made from
    const pts = [[1, 2], [9, 14], [17, 5], [23, 22], [30, 30]];
    const sample = (f, key) => ss(`(() => { const E = LIB.get(${JSON.stringify(f)}); let t = null; E.root.traverse(o => { for (const m of [].concat(o.material || [])) if (m[${JSON.stringify(key)}]) t = m[${JSON.stringify(key)}]; });
      if (!t || !t.image) return null; const i = t.image, c = document.createElement('canvas'); c.width = i.naturalWidth || i.width; c.height = i.naturalHeight || i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0);
      return { w: c.width, pts: ${JSON.stringify(pts)}.filter(p => p[0] < c.width && p[1] < c.height).map(p => [p, [...x.getImageData(p[0], p[1], 1, 1).data]]) }; })()`);
    for (const [f, key, px, tol, name] of [['crate.obj', 'map', PX.wood, 3, 'the TIFF (LZW)'], ['brick.obj', 'map', PX.brick, 4, 'the TIFF (PackBits, alpha) for a TGA name'], ['panel.fbx', 'map', PX.panel, 6, 'the PSD in the FBX'], ['stone.obj', 'map', PX.stone, 24, 'the DDS (DXT1)'], ['panel.fbx', 'normalMap', PX.bumps, 6, 'the DDS (BC5) normal map']]) {
      const s = await sample(f, key);
      if (!s || !s.pts.length) { bad.push(`${name}: no picture on ${f}'s ${key}`); continue; }
      const worst = Math.max(...s.pts.map(([p, v]) => Math.max(...px(p[0], p[1]).map((c, k) => Math.abs(c - v[k])))));
      if (worst > tol) bad.push(`${name}: its pixels are up to ${worst} off (${JSON.stringify(s.pts.map(([p, v]) => [p, v, px(p[0], p[1])]))})`);
    }
    // the cards
    const cs = {};
    for (const f of MODELS) cs[f] = await card(f);
    const expect = [
      ['brick.obj', /Texture brick\.tga: using brick\.tif, the same name as a TIFF\./], ['stone.obj', /Texture stone_diffuse\.jpg: using Stone-BaseColor\.dds, a picture of a similar name\./],
      ['panel.fbx', /Texture Panel_Albedo\.PSD: read from its PSD \(Photoshop\) file in the page/], ['crate.obj', /Texture wood\.tif: read from its TIFF file/],
      ['broken.obj', /Missing texture broken\.tif: a TIFF compressed with JPEG: save it as PNG\./], ['rust.obj', /Missing texture rust_old\.png: put it in the scene's folder, or pick a picture for it here\.Use paint\.png.*Choose a picture\.\.\./],
      ['plain.obj', /TexturesAdd a texture\.\.\./],
    ];
    for (const [f, re] of expect) if (!re.test(cs[f])) bad.push(`${f}'s card: ${cs[f].slice(0, 500)}`);
    if (/Texture .*: using|read from its/.test(cs['rust.obj'])) bad.push('the rust\'s card says it found what it did not: ' + cs['rust.obj'].slice(0, 300));
    if (bad.length) errors.push(...bad.map(b => 'studio textures: ' + b));
  });
  await step('studio textures: the card\'s Use and Choose convert at once (a GLB with tex in its record, loading back textured, switched where it stands), Add a texture, roughness and metalness packed, a bump made a normal map', async () => {
    const bad = [];
    // Use: the rust's missing picture from the scene (no relay: the GLB downloaded)
    await card('rust.obj');
    let dl = txp.waitForEvent('download', { timeout: 60000 }).catch(() => null);
    await ss('(STUDIO.lastGLB = null, 0)');
    await txp.click('#pane-item [data-act="tex:use"][data-v*="paint.png"]');
    let d = await dl;
    await waitConv();
    let g = await lastGLB();
    if (!d || d.suggestedFilename() !== 'rust.glb' || !g || !g.ok || JSON.stringify(g.rec.tex) !== '[{"name":"rust_old.png","mat":"","slot":"","from":"paint.png","how":"chosen"}]' || !g.mats.length || !g.mats.every(m => m.map) || g.rec.from !== 'rust.obj')
      bad.push('Use paint.png for rust_old.png: ' + JSON.stringify({ dl: d && d.suggestedFilename(), g: g && { ok: g.ok, why: g.why, rec: g.rec, mats: g.mats } }));
    if (!/rust\.obj converted .* downloaded as rust\.glb/.test(await ss('CV.note'))) bad.push('the note after Use: ' + await ss('CV.note'));
    // the GLB served as models/rust.glb, the placed rust switched to it, its corners where they were (1 mm)
    const bytes = Buffer.from(await ss(`(() => { const u = new Uint8Array(STUDIO.lastGLB.glb); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); })()`), 'base64');
    await txp.route('**/scenes/textures/models/rust.glb*', route => route.fulfill({ body: bytes, contentType: 'model/gltf-binary' }));
    const rid = await idOf('rust.obj');
    const corners = `(() => { const it = STU.items.get('${rid}'), b = it.E.info.box, M = new THREE.Matrix4().compose(new THREE.Vector3().fromArray(it.rec.p), new THREE.Quaternion().fromArray(it.rec.q), new THREE.Vector3().setScalar(it.rec.s)), out = [];
      for (let k = 0; k < 8; k++) out.push(new THREE.Vector3(k & 1 ? b[1][0] : b[0][0], k & 2 ? b[1][1] : b[0][1], k & 4 ? b[1][2] : b[0][2]).applyMatrix4(M).toArray()); return out; })()`;
    const c0 = await ss(corners);
    await ss(`(setFiles(STU.files.concat({ path: 'models/rust.glb', bytes: ${bytes.length}, at: 9, kind: 'model' })), GLBREC.set('models/rust.glb', { at: 9, rec: CONV.glbRecord({ asset: { extras: { studio: STUDIO.lastGLB.record } } }), p: null }), switchToGLB('rust.obj', 'models/rust.glb', STUDIO.lastGLB.record))`);
    if (!await until(`(() => { const it = STU.items.get('${rid}'); return it.rec.file === 'models/rust.glb' && it.E && it.E.state === 'ready' && !!it.model; })()`, 30000)) bad.push('the rust did not switch to its GLB');
    else {
      const c1 = await ss(corners), worst = Math.max(...c0.map(p => Math.min(...c1.map(q => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])))));
      const rc = await card('models/rust.glb');
      if (worst > 0.001 || !/Texture rust_old\.png: paint\.png, chosen by hand \(in this GLB\)\./.test(rc) || /Missing texture/.test(rc)) bad.push('switched: ' + JSON.stringify({ worst, card: rc.slice(0, 400) }));
      const tx = await ss(`(() => { let n = 0; STU.items.get('${rid}').E.root.traverse(o => { if (o.isMesh && [].concat(o.material).some(m => m.map)) n++; }); return n; })()`);
      if (!tx) bad.push('the switched rust shows no picture');
    }
    await ss('undo()');
    await ss(`(setFiles(STU.files.filter(f => f.path !== 'models/rust.glb')), GLBREC.delete('models/rust.glb'), 0)`);
    await txp.unroute('**/scenes/textures/models/rust.glb*');
    // Choose a picture... (the chooser stubbed with a file from this computer): used from memory, recorded as originals/
    await card('rust.obj');
    await ss('(STUDIO.lastGLB = null, 0)');
    dl = txp.waitForEvent('download', { timeout: 60000 }).catch(() => null);
    txp.once('filechooser', () => {});
    await ss(`(act('tex:choose', JSON.stringify(['${rid}', 'rust_old.png'])), 0)`);
    await txp.setInputFiles('#stuTex', T_DIR + 'tex/glass.dds');
    d = await dl;
    await waitConv();
    g = await lastGLB();
    if (!d || !g || !g.ok || JSON.stringify(g.rec.tex) !== '[{"name":"rust_old.png","mat":"","slot":"","from":"originals/glass.dds","how":"chosen"}]' || !g.mats.every(m => m.map)) bad.push('Choose a picture (glass.dds): ' + JSON.stringify(g && { ok: g.ok, why: g.why, rec: g.rec, mats: g.mats }));
    // Add a texture on the plain box (texture coordinates, no material): a picture of the scene, its slot by its name
    await card('plain.obj');
    await txp.click('#pane-item [data-act="tex:add"]');
    await txp.click('#pane-item [data-act="tex:pick"][data-v="tex/rough.tif"]');
    await until(`X.texAdd && X.texAdd.slot === 'roughnessMap'`, 5000);
    const pend = await txp.evaluate(() => document.querySelector('#pane-item').textContent.replace(/\s+/g, ' '));
    if (!/Adding rough\.tifOnmaterial 1AsColourNormalRoughnessMetalnessOcclusionGlowOpacityPacked \(ORM\)Add and convertCancel/.test(pend)) bad.push('the pending block: ' + pend.slice(0, 500));
    if (await ss(`document.querySelector('#pane-item [data-act="tex:slot"][data-v="roughnessMap"]').getAttribute('aria-pressed')`) !== 'true') bad.push('Roughness is not preselected for rough.tif');
    await txp.click('#pane-item [data-act="tex:slot"][data-v="map"]');
    await ss('(STUDIO.lastGLB = null, 0)');
    await txp.click('#pane-item [data-act="tex:go"]');
    await waitConv();
    g = await lastGLB();
    if (!g || !g.ok || JSON.stringify(g.rec.tex) !== '[{"name":"","mat":0,"slot":"map","from":"tex/rough.tif","how":"chosen"}]' || !g.mats.every(m => m.map)) bad.push('Add a texture (Colour): ' + JSON.stringify(g && { ok: g.ok, why: g.why, rec: g.rec, mats: g.mats }));
    // a picture on a model without texture coordinates is refused with its sentence (the converter's own words)
    const nouv = await ss(`(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)); const root = new THREE.Group(); root.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ name: 'bare' }))); return CONV.addTextures(root, [{ mat: 'bare', slot: 'map', image: document.createElement('canvas') }], {}).why.join(); })()`);
    if (nouv !== 'bare: it has no texture coordinates (UVs), so a picture cannot be laid on it') bad.push('no UVs: ' + nouv);
    // roughness and metalness, two pictures, packed into one (green and blue), as glTF keeps them
    const rm = await ss(`(async () => {
      const root = new THREE.Group(), mt = new THREE.MeshPhongMaterial({ name: 'rm' }); root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mt));
      const pic = p => CONV.picture(fileUrl(p, true), { ext: extOf(p) });
      const d = CONV.addTextures(root, [{ mat: 'rm', slot: 'roughnessMap', image: await pic('tex/rough.tif') }, { mat: 'rm', slot: 'metalnessMap', image: await pic('tex/glass.dds') }], {});
      const r = await CONV.toGLB({ root, clips: [], guess: { unit: 100, up: 1, sign: 1, read: true, gltf: true }, ext: 'glb', missing: [] }, { name: 'rm', from: 'rm.glb', maxTex: 512 });
      const j = CONV.glbJSON(r.glb), back = await new Promise((res, rej) => new THREE.GLTFLoader().parse(r.glb.slice(0), '', res, rej));
      let m = null; back.scene.traverse(o => { if (o.isMesh) m = o.material; });
      const i = m && m.roughnessMap && m.roughnessMap.image, c = document.createElement('canvas'); c.width = 16; c.height = 16; const x = c.getContext('2d'); if (i) x.drawImage(i, 0, 0, 16, 16);
      return { done: d.done, ok: r.ok, notes: r.notes.filter(n => /packed/.test(n)), def: j.materials[0].pbrMetallicRoughness, same: !!m && m.roughnessMap === m.metalnessMap, px: i ? [...x.getImageData(5, 3, 1, 1).data] : null };
    })()`);
    // (the GLB keeps the picture upside down, as glTF does for a model whose pictures three.js turns over: at (5, 3) is
    // rough.tif's (5, 12); glass.dds's blue is 220 throughout)
    if (!rm || rm.done !== 2 || !rm.ok || !rm.same || !rm.def.metallicRoughnessTexture || rm.def.metallicFactor !== 1 || rm.def.roughnessFactor !== 1 || !rm.notes.length || Math.abs(rm.px[1] - (PX.rough(5, 12)[0] >> 8)) > 12 || Math.abs(rm.px[2] - 220) > 14)
      bad.push('roughness and metalness packed: ' + JSON.stringify(rm));
    // the crate converted: its bump (MTL bump -bm 2) made a normal map
    await card('crate.obj');
    await ss('(STUDIO.lastGLB = null, 0)');
    await txp.click('#pane-item [data-act="convert"]');
    await waitConv();
    g = await lastGLB();
    if (!g || !g.ok || !g.mats.every(m => m.map && m.normal) || !g.notes.some(n => /bump map made a normal map/.test(n)) || !g.mdefs[0].normalTexture) bad.push('a bump made a normal map: ' + JSON.stringify(g && { ok: g.ok, why: g.why, notes: g.notes, mats: g.mats }));
    await ss(`(select(''), X.texAdd = null, 0)`);
    if (bad.length) errors.push(...bad.map(b => 'studio textures: ' + b));
  });
  await step('studio textures: the Upload pane\'s plan (the only picture left over, another kind of picture, similar words, a picture dropped onto a row, Not this and Use) and its GLBs', async () => {
    const bad = [];
    await ss(`(X.tab = 'upload', renderPanes(), 0)`);
    await ss(`(async () => { const get = async q => new File([await (await fetch(${JSON.stringify(T_DIR)} + q)).arrayBuffer()], q.split('/').pop());
      upTake(await Promise.all(['rust.obj', 'rust.mtl', 'paint.png', 'brick.obj', 'brick.mtl', 'brick.tif', 'plain.obj', 'stone.obj', 'stone.mtl', 'Stone-BaseColor.dds'].map(async q => ({ path: 'drop/' + q, file: await get(q) })))); return 0; })()`);
    if (!await until(`!UP.planning && UP.rows.length === 4`, 20000)) { errors.push('studio textures: no plan: ' + JSON.stringify(await ss('STUDIO.state().upload')).slice(0, 400)); return; }
    let rows = await ss(`STUDIO.state().upload.rows.map(r => [r.title, r.src.join('+'), JSON.stringify(r.tex)])`);
    const want = [['drop/rust.obj', 'drop/rust.obj+drop/rust.mtl+drop/paint.png', '[["rust_old.png","drop/paint.png","only"]]'], ['drop/brick.obj', 'drop/brick.obj+drop/brick.mtl+drop/brick.tif', '[["brick.tga","drop/brick.tif","ext"]]'],
      ['drop/plain.obj', 'drop/plain.obj', '[]'], ['drop/stone.obj', 'drop/stone.obj+drop/stone.mtl+drop/Stone-BaseColor.dds', '[["stone_diffuse.jpg","drop/Stone-BaseColor.dds","similar"]]']];
    if (JSON.stringify(rows) !== JSON.stringify(want)) bad.push('the plan: ' + JSON.stringify(rows));
    await ss('(renderPanes(), 0)');
    const plan = await txp.evaluate(() => document.querySelector('#pane-upload .stu-plan').textContent.replace(/\s+/g, ' '));
    if (!/Texture rust_old\.png: drop\/paint\.png \(the only picture left over\)/.test(plan) || !/Texture brick\.tga: drop\/brick\.tif \(the same name as another kind of picture\)/.test(plan) || !/Texture stone_diffuse\.jpg: drop\/Stone-BaseColor\.dds \(a picture of a similar name\)/.test(plan)) bad.push('the plan\'s words: ' + plan.slice(0, 700));
    // Not this: the rust's picture left over again (a row of its own), then Use it (by hand)
    await txp.click('#pane-upload [data-act="up:unuse"]');
    await until(`UP.rows.length === 5 && UP.rows[4].kind === 'keep'`, 5000);
    await ss('(renderPanes(), 0)');
    if (!/Texture rust_old\.png: not among the filesUse paint\.pngChoose a file\.\.\./.test(await txp.evaluate(() => document.querySelector('#pane-upload .stu-plan').textContent.replace(/\s+/g, ' ')))) bad.push('Not this: ' + JSON.stringify(await ss(`STUDIO.state().upload.rows.map(r => [r.kind, r.title, JSON.stringify(r.tex)])`)));
    await txp.click('#pane-upload [data-act="up:use"]');
    await until(`UP.rows.length === 4`, 5000);
    // a picture dropped onto the plain box's row: laid on as its colour (by its name)
    const ri = await ss(`UP.rows.findIndex(r => r.main.name === 'plain.obj')`);
    await txp.evaluate(async ([ri, dir]) => { const f = new File([await (await fetch(dir + 'tex/wood.tif')).arrayBuffer()], 'wood.tif'); const dt = new DataTransfer(); dt.items.add(f); document.querySelector(`#pane-upload .stu-plan li[data-row="${ri}"]`).dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, [ri, T_DIR]);
    await until(`UP.rows[${ri}].adds.length === 1`, 5000);
    rows = await ss(`STUDIO.state().upload.rows.map(r => [r.title, r.src.join('+'), JSON.stringify(r.tex), JSON.stringify(r.adds), r.out.join('+')])`);
    if (rows.length !== 4 || rows[0][2] !== '[["rust_old.png","drop/paint.png","chosen"]]' || rows[2][1] !== 'drop/plain.obj+wood.tif' || rows[2][3] !== '[["wood.tif","map"]]' || rows[2][4] !== 'models/plain.glb+originals/drop/plain.obj+originals/wood.tif') bad.push('Use, and a picture dropped onto a row: ' + JSON.stringify(rows));
    // Convert (no relay): four GLBs, each with its pictures and its record
    await txp.click('#pane-upload [data-act="up:run"]');
    if (!await until(`!UP.busy && UP.ran`, 90000)) bad.push('converting did not finish');
    const out = await ss(`(async () => { renderPanes(); const out = {}; for (const a of document.querySelectorAll('#pane-upload .stu-plan a[download]')) { const n = a.getAttribute('download'), b = await (await fetch(a.href)).arrayBuffer(), j = CONV.glbJSON(b); out[n] = [JSON.stringify(j.asset.extras.studio.tex), j.materials.every(m => m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture)]; } return out; })()`);
    const wantOut = {
      'rust.glb': ['[{"name":"rust_old.png","mat":"","slot":"","from":"originals/drop/paint.png","how":"chosen"}]', true], 'brick.glb': ['[{"name":"brick.tga","mat":"","slot":"","from":"originals/drop/brick.tif","how":"ext"}]', true],
      'plain.glb': ['[{"name":"","mat":"*","slot":"map","from":"originals/wood.tif","how":"chosen"}]', true], 'stone.glb': ['[{"name":"stone_diffuse.jpg","mat":"","slot":"","from":"originals/drop/Stone-BaseColor.dds","how":"similar"}]', true],
    };
    if (JSON.stringify(out) !== JSON.stringify(wantOut)) bad.push('the GLBs made: ' + JSON.stringify(out));
    await ss(`(upClear(), X.tab = 'scene', renderPanes(), 0)`);
    if (bad.length) errors.push(...bad.map(b => 'studio textures: ' + b));
  });
  await step('studio textures: no texture buttons and nothing converted for a visitor or with editing off', async () => {
    const bad = [];
    for (const how of ['visit', 'edit off']) {
      const r = await ss(`(() => {
        const was = OPT.visit;
        if (${JSON.stringify(how)} === 'visit') OPT.visit = true; else setEdit(false);
        const it = [...STU.items.values()].find(it => it.rec.file === 'rust.obj');
        select(it.id); X.tab = 'item'; renderPanes();
        const btns = document.querySelectorAll('#pane-item [data-act^="tex:"]').length;
        STUDIO.lastGLB = null;
        act('tex:use', JSON.stringify([it.id, 'rust_old.png', 'paint.png']));
        act('tex:add', it.id);
        const r = { btns, busy: CV.busy, adding: !!X.texAdd };
        OPT.visit = was; setEdit(true); X.texAdd = null; renderPanes();
        return r;
      })()`);
      if (r.btns || r.busy || r.adding) bad.push(how + ': ' + JSON.stringify(r));
    }
    if (bad.length) errors.push(...bad.map(b => 'studio textures: ' + b));
  });
  await step('studio textures: the headset\'s card says what is missing and to add a texture on a laptop, with no buttons of the page\'s', async () => {
    const bad = await ss(`(() => {
      const out = [], draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } };
      setEdit(true); XR.on = true;
      for (const f of ['rust.obj', 'plain.obj', 'stone.obj']) {
        select([...STU.items.values()].find(it => it.rec.file === f).id); X.tab = 'item'; X.scroll = {}; draw();
        const ids = XR.main.regions.map(r => r.id), txt = paneBlocks('item').filter(b => !b.page).map(b => b.p || '').join(' ');
        if (ids.some(i => /^tex/.test(i) || i === 'convert')) out.push(f + ': the headset\\'s card has the page\\'s buttons: ' + ids.join(' '));
        if (f !== 'stone.obj' && !/Add a texture on a laptop/.test(txt)) out.push(f + ': the headset\\'s card does not say to add a texture on a laptop: ' + txt.slice(0, 300));
        if (f === 'rust.obj' && !/Missing texture rust_old\\.png: put it in the scene's folder\\./.test(txt)) out.push('the headset\\'s rust card: ' + txt.slice(0, 300));
        if (f === 'stone.obj' && !/Texture stone_diffuse\\.jpg: using Stone-BaseColor\\.dds/.test(txt)) out.push('the headset\\'s stone card: ' + txt.slice(0, 300));
      }
      XR.on = false; select(''); X.tab = 'scene'; renderPanes();
      return out;
    })()`);
    if (bad.length) errors.push(...bad.map(b => 'studio textures: ' + b));
    await txp.close();
  });
}
// The studio's sounds that follow a model or a bone (tools/studio/SPEC.md, "Sounds that follow a model"), on a page of its
// own: the third test scene, tools/studio/test/scenes/rig (made by tools/studio/test/make.mjs: a skinned dancer whose bones
// are named in mixed conventions, Bob's box, the Z-up figure, a short voice, and Voice following her head by an FBX's
// name for it): the head bone plus its offset every frame of her clip and at three moments, the short list of bones, the
// lenient match, Bob's moving part and the whole model; attaching, Move onto it, another bone and Stop following each
// keeping it where it is (through the page's card too); carried by a pretend headset's grip; her size steps, both grips
// and the arrows' size scaling its offset; the switch to a GLB (the figure, a turn baked in, its whole model; the dancer,
// a bone) keeping it within 1 mm; her deletion (it stays, following nothing; Undo); a cube hiding her silencing it and
// showing her again starting it from its beginning; the shared state with the new fields, bad values; the headset's card
if (runs('studio follow')) {
  const fop = await browser.newPage({ viewport: { width: 900, height: 560 } });
  fop.on('pageerror', e => errors.push('studio follow: ' + (e.stack || e.message)));
  fop.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('studio follow: ' + m.text()); });
  const ss = s => fop.evaluate(s => HOST.cur.peek(s), s);
  const until = (src, ms) => fop.waitForFunction(src => HOST.cur.peek(src), src, { timeout: ms || 20000 }).then(() => true, () => false);
  const frames = async n => { const f0 = await fop.evaluate(() => window.__frames || 0); await fop.waitForFunction(f => window.__frames >= f, f0 + (n || 1), { timeout: 30000 }).catch(() => errors.push('studio follow: the page drew no frames')); };
  const bad = (name, list) => { if (list.length) errors.push(...list.map(b => 'studio follow: ' + b)); };
  // (in the page: where a node is in the scene's frame, and where a sound on it with offset o should be, worked out on
  // their own from the node's matrix; the scene's clock held at a moment, or let go)
  const HELP = `window.__fh = window.__fh || {
    sc: sceneClock,
    at: (nd, o) => { nd.updateWorldMatrix(true, false); const m = GL.items.matrixWorld.clone().invert().multiply(nd.matrixWorld), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); return new THREE.Vector3().fromArray(o || [0, 0, 0]).applyQuaternion(q).add(p); },
    head: () => STU.items.get('dan001').model.o.getObjectByName('mixamorigHead'),
    pos: id => STU.items.get(id).holder.getWorldPosition(new THREE.Vector3()),
  }`;
  const hold = t => ss(`(${HELP}, sceneClock = ${t === null ? 'window.__fh.sc' : `() => ${t}`}, 0)`);

  await step('studio follow: the rig scene loads; Voice, following the dancer\'s mixamorig:Head (mixamorigHead once loaded), sits at the head bone plus its offset every frame of her clip and at three moments; the short list of bones', async () => {
    await fop.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&scene=rig&edit');
    await fop.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    if (!await until(`STUDIO.ready() && !!STU.items.get('dan001').model && !!STU.items.get('box001').model`, 120000)) { errors.push('studio follow: the rig scene did not load: ' + JSON.stringify(await ss('STUDIO.state()')).slice(0, 500)); return; }
    await ss(`(${HELP}, 0)`);
    const out = [];
    const r0 = await ss(`(() => { const d = STU.items.get('dan001'), B = bonesOf(d.E); return { rigged: d.E.info.rigged, kind: B.kind, slots: B.slots, n: B.list.length, rec: STU.items.get('voi001').rec, f: STUDIO.follow('voi001') }; })()`);
    if (!r0.rigged || r0.kind !== 'bone' || r0.n !== 8 || JSON.stringify(r0.slots) !== JSON.stringify([['Head', 'mixamorigHead'], ['Neck', 'mixamorigNeck'], ['Chest', 'mixamorigSpine2'], ['Hips', 'mixamorigHips'], ['Left hand', 'Bip01_L_Hand'], ['Right hand', 'Bip01_R_Hand'], ['Left foot', 'foot_l'], ['Right foot', 'foot_r']]))
      out.push('her bones and the short list: ' + JSON.stringify(r0));
    if (JSON.stringify(r0.rec) !== '{"name":"Voice","file":"voice.wav","p":[0,1.73,-1.86],"vol":1,"r":1,"loop":true,"start":"shown","on":"dan001","bone":"mixamorig:Head","o":[0,-0.03,0.14]}' || !r0.f || r0.f.node !== 'mixamorigHead') out.push('Voice as read from layout.json, and the head found by the lenient match: ' + JSON.stringify(r0));
    // every frame the page draws for 2.5 s (her clip is 2 s; software drawing is slow), and every step of 1/30 s through
    // her clip (the scene's clock held at each): the sound where her head bone and its offset put it, worked out on its own
    await ss(`(() => { const F = window.__fh; F.log = []; F.keep = itemsStep; itemsStep = (dt, now) => { F.keep(dt, now); const w = F.at(F.head(), STU.items.get('voi001').rec.o); F.log.push([w.distanceTo(F.pos('voi001')), w.toArray()]); }; return 0; })()`);
    // (and until the page has drawn one at least: a machine busy drawing in software may give it none in 2.5 s)
    await fop.waitForTimeout(2500);
    await until(`window.__fh.log.length > 0`, 15000);
    const ev = await ss(`(() => {
      const F = window.__fh, real = F.log.length, sc = sceneClock;
      for (let k = 0; k <= 60; k++) { sceneClock = () => k / 30; itemsStep(1 / 30, performance.now()); }
      sceneClock = sc; itemsStep = F.keep;
      const L = F.log; let far = 0;
      for (const a of L) for (const b of L) far = Math.max(far, Math.hypot(a[1][0] - b[1][0], a[1][1] - b[1][1], a[1][2] - b[1][2]));
      return { real, n: L.length, worst: Math.max(...L.map(x => x[0])), far };
    })()`);
    if (ev.real < 1 || ev.n < 62 || ev.worst > 0.001 || ev.far < 0.5) out.push('every frame of her clip, the sound at her head bone plus its offset (within 1 mm; her head through 0.5 m or more): ' + JSON.stringify(ev));
    // at three moments of her clip (the scene's clock held there): there, and her head through more than 0.5 m
    const at3 = [];
    for (const t of [0.5, 1, 1.5]) { await hold(t); await frames(2); at3.push(await ss(`(() => { const F = window.__fh, w = F.at(F.head(), STU.items.get('voi001').rec.o); return [w.distanceTo(F.pos('voi001')), F.at(F.head()).toArray()]; })()`)); }
    await hold(null);
    const span = Math.hypot(...at3[0][1].map((v, i) => v - at3[2][1][i]));
    if (at3.some(x => x[0] > 0.001) || span < 0.5) out.push('at three moments of her clip (within 1 mm; her head through 0.5 m or more): ' + JSON.stringify({ at3, span }));
    // the lenient match: an FBX's name, the loader's tidied one, other spellings; one she lacks is not found
    const lm = await ss(`(() => { const d = STU.items.get('dan001'), h = F => nodeOf(d, F); return [h('mixamorig:Head') === h('mixamorigHead'), !!h('mixamorigHead') && h('mixamorigHead').name, h('MIXAMORIG_HEAD') === h('mixamorigHead'), h('Bip01 L Hand') && h('Bip01 L Hand').name, h('Bip01_L_Hand') === h('Bip01 L Hand'), h('mixamorig:Tail')]; })()`);
    if (JSON.stringify(lm) !== '[true,"mixamorigHead",true,"Bip01_L_Hand",true,null]') out.push('the lenient match: ' + JSON.stringify(lm));
    bad('', out);
  });

  await step('studio follow: Bob\'s box (no bones: the part its clip moves) and the whole model; attaching, Move onto it, another bone and Stop following each keep the sound where it is (the page\'s card too), each one Undo step', async () => {
    await hold(0.7); await frames(2);
    const out = [];
    // a part of Bob's box, and the dancer's whole model
    const bx = await ss(`(() => {
      const F = window.__fh, sid = addSound('voice.wav'); setRec(sid, { p: [1.5, 0.9, -2] });
      itemAct('follow', 'box001', sid); itemAct('bone', 'box', sid);
      const B = bonesOf(STU.items.get('box001').E), r = STU.items.get(sid).rec;
      return { sid, kind: B.kind, list: B.list, on: r.on, bone: r.bone, f: STUDIO.follow(sid) && STUDIO.follow(sid).node };
    })()`);
    if (bx.kind !== 'part' || bx.list.join() !== 'box' || bx.on !== 'box001' || bx.bone !== 'box' || bx.f !== 'box') out.push('Bob\'s box: its moving part offered and followed: ' + JSON.stringify(bx));
    const yb = [];
    for (const t of [0, 0.5]) { await hold(t); await frames(2); yb.push(await ss(`window.__fh.pos('${bx.sid}').y`)); }
    if (Math.abs(yb[1] - yb[0] - 0.3) > 0.002) out.push('the sound on Bob\'s box did not rise with it (0.3 m): ' + JSON.stringify(yb));
    await hold(0.7); await frames(2);
    // attach (whole model), another bone, onto it, stop: each keeps its place (or, onto it, goes there), one Undo step each
    const k = await ss(`(() => {
      const F = window.__fh, sid = addSound('voice.wav'), it = STU.items.get(sid), out = {};
      setRec(sid, { p: [0.3, 1.5, -1.7] }); itemsStep(0, performance.now());
      const u0 = UNDO.length, w = () => F.pos(sid).toArray(), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), step = () => itemsStep(0, performance.now());
      let a = w(); itemAct('follow', 'dan001', sid); step();
      out.attach = [d(a, w()), it.rec.on, it.rec.bone || '', STUDIO.follow(sid).node];
      a = w(); itemAct('bone', 'Bip01_L_Hand', sid); step();
      out.bone = [d(a, w()), it.rec.bone, STUDIO.follow(sid).node];
      itemAct('onto', null, sid); step();
      out.onto = [d(w(), F.at(STU.items.get('dan001').model.o.getObjectByName('Bip01_L_Hand')).toArray()), it.rec.o || null, d(it.rec.p, w())];
      a = w(); itemAct('unfollow', null, sid); step();
      out.stop = [d(a, w()), JSON.stringify(it.rec), d(it.rec.p, w())];
      out.undo = UNDO.length - u0;
      undo(); step(); out.back = [it.rec.on, it.rec.bone];
      out.sid = sid;
      return out;
    })()`).catch(e => ({ err: e.message }));
    if (k.err || k.attach[0] > 0.001 || k.attach[1] !== 'dan001' || k.attach[2] !== '' || k.attach[3] !== '' || k.bone[0] > 0.001 || k.bone[1] !== 'Bip01_L_Hand' || k.bone[2] !== 'Bip01_L_Hand' ||
      k.onto[0] > 1e-6 || k.onto[1] !== null || k.onto[2] > 0.001 || k.stop[0] > 0.001 || /"on"|"bone"|"o"/.test(k.stop[1]) || k.stop[2] > 0.001 || k.undo !== 4 || k.back[0] !== 'dan001' || k.back[1] !== 'Bip01_L_Hand')
      out.push('attach, another bone, onto it, stop (each where it was, within 1 mm; one Undo step each): ' + JSON.stringify(k));
    // the page's card: Follow an object..., her name in its list, then Head from the short list and More bones...
    const sid = k.sid;
    await ss(`(itemAct('unfollow', null, '${sid}'), select('${sid}'), X.tab = 'item', renderPanes(), 0)`);
    const card0 = await fop.evaluate(() => document.querySelector('#pane-item').textContent.replace(/\s+/g, ' '));
    await fop.click('#pane-item [data-act="i:followPick"]');
    const picking = await ss(`[STU.follow, (renderPanes(), !!document.querySelector('#pane-item li[data-act="i:follow"][data-v="dan001"]'))]`);
    await fop.click('#pane-item li[data-act="i:follow"][data-v="dan001"]');
    await ss('(renderPanes(), 0)');
    const row = await fop.evaluate(() => [...document.querySelectorAll('#pane-item [data-act="i:bone"]')].map(b => b.textContent + '=' + b.dataset.v));
    await fop.click('#pane-item button[data-act="i:bone"][data-v="mixamorigHead"]');
    await fop.click('#pane-item [data-act="i:bones"]');
    await ss('(renderPanes(), 0)');
    const all = await fop.evaluate(() => [...document.querySelectorAll('#pane-item li[data-act="i:bone"]')].map(b => b.dataset.v));
    const card1 = await fop.evaluate(() => document.querySelector('#pane-item').textContent.replace(/\s+/g, ' '));
    const lab = await ss(`(updateExtraLabels(), LBL.extra[1].txt && LBL.extra[1].txt.slice(0, 2).join(' '))`);
    const rec = await ss(`STU.items.get('${sid}').rec`);
    if (!/Follows ?nothing/.test(card0) || !/Follow an object\.\.\./.test(card0) || picking[0] !== sid || !picking[1] ||
      row.join() !== 'Whole model=,Head=mixamorigHead,Neck=mixamorigNeck,Chest=mixamorigSpine2,Hips=mixamorigHips,Left hand=Bip01_L_Hand,Right hand=Bip01_R_Hand,Left foot=foot_l,Right foot=foot_r' ||
      rec.on !== 'dan001' || rec.bone !== 'mixamorigHead' || all.length !== 8 || !/Follows ?Dancer · Head, \d+ cm from it/.test(card1) || !/Move onto it/.test(card1) || !/Stop following/.test(card1) || lab !== rec.name + ' → Dancer · Head · selected')
      out.push('the page\'s card: ' + JSON.stringify({ card0: card0.slice(0, 200), picking, row, rec, all, card1: card1.slice(0, 400), lab }));
    // the line from the speaker to her head, while editing
    await frames(2);
    const ln = await ss(`STU.items.get('${sid}').look.link.visible`);
    if (!ln) out.push('no line from the sound to her head while editing');
    await ss(`(select(''), STU.bones = '', 0)`);
    while (await ss('UNDO.length')) await ss('undo()');
    await hold(null);
    if (await ss('STU.items.size') !== 4 || await ss('unsaved()')) out.push('the layout did not come back after these checks');
    bad('', out);
  });

  await step('studio follow: carried by a pretend headset\'s grip it follows nothing until let go, then follows from where it was put; sizing her (the size steps, both grips, the page\'s arrows) keeps it at the same point on her, one Undo step each', async () => {
    await hold(0.7); await frames(2);
    const r = await ss(`(() => {
      const F = window.__fh, out = {}, it = STU.items.get('voi001'), d = STU.items.get('dan001'), step = () => itemsStep(0, performance.now());
      setEdit(true); step();
      XR.on = true; XR.clear = true; GL.world.updateMatrixWorld(true);
      const [a, b] = XR.ctrls, ctl = (c, p) => { c.src = { targetRayMode: 'tracked-pointer', handedness: c === a ? 'right' : 'left', gamepad: null }; c.g.visible = true; c.g.matrix.compose(new THREE.Vector3(...p), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); c.o.setFromMatrixPosition(c.g.matrix); };
      // the grip: carried 0.3 m to the side (not following meanwhile); let go, it follows her head from there
      const w0 = F.pos('voi001'), o0 = it.rec.o.slice(), u0 = UNDO.length;
      ctl(a, [w0.x, w0.y + 0.2, w0.z + 0.3]); a.hover = { kind: 'item', id: 'voi001' }; xrGrab(a, true);
      ctl(a, [w0.x + 0.3, w0.y + 0.2, w0.z + 0.3]); carry(a, 0.016); step();
      const w1 = F.pos('voi001');
      out.carried = [!!it.carry, +(w1.x - w0.x).toFixed(4), +(w1.y - w0.y).toFixed(4)];
      xrGrab(a, false); step();
      const w2 = F.pos('voi001');
      out.let = [!it.carry, +w2.distanceTo(w1).toFixed(4), it.rec.on, it.rec.bone, JSON.stringify(it.rec.o) !== JSON.stringify(o0), +F.at(F.head(), it.rec.o).distanceTo(w2).toFixed(6), UNDO.length - u0];
      undo(); step();
      // where it is on her: in her head bone's own frame (in metres at her size now)
      const on = () => { const h = F.head(); h.updateWorldMatrix(true, false); return F.pos('voi001').applyMatrix4(h.matrixWorld.clone().invert()); };
      const size = (how, fn) => { const l0 = on(), s0 = d.rec.s, oo = it.rec.o.slice(), n0 = UNDO.length; fn(); step(); const l1 = on(), k = d.rec.s / s0;
        out[how] = [k, JSON.stringify(it.rec.o) === JSON.stringify(oo.map(v => nz(r3(v * k)))) && JSON.stringify(it.rec.o) !== JSON.stringify(oo), +(l1.distanceTo(l0) * d.rec.s).toFixed(5), UNDO.length - n0];
        undo(); step(); out[how].push(d.rec.s === s0 && JSON.stringify(it.rec.o) === JSON.stringify(oo)); };
      size('steps', () => itemAct('size', 2, 'dan001'));
      size('grips', () => {
        const c = d.holder.getWorldPosition(new THREE.Vector3());
        ctl(a, [c.x - 0.1, c.y + 1, c.z]); a.hover = { kind: 'item', id: 'dan001' }; xrGrab(a, true);
        ctl(b, [c.x + 0.1, c.y + 1, c.z]); b.hover = { kind: 'item', id: 'dan001' }; xrGrab(b, true);
        const m0 = on();
        carry(a, 0.016); carry(b, 0.016);
        ctl(a, [c.x - 0.2, c.y + 1, c.z]); ctl(b, [c.x + 0.2, c.y + 1, c.z]); carry(a, 0.016); carry(b, 0.016);
        // (between the grips' writes, ten a second: her size shown ahead of her record's, the sound still on her)
        step(); out.gripsMid = [+(on().distanceTo(m0) * d.holder.scale.x).toFixed(5), +(d.holder.scale.x / d.rec.s).toFixed(3)];
        xrGrab(b, false); xrGrab(a, false);
      });
      for (const c of XR.ctrls) { c.src = null; c.g.visible = false; c.hover = null; c.grab = null; }
      XR.on = false;
      size('arrows', () => {
        select('dan001'); tcSetMode('scale');
        GL.tc.dispatchEvent({ type: 'dragging-changed', value: true }); d.holder.scale.setScalar(1.5);
        GL.tc.dispatchEvent({ type: 'objectChange' }); GL.tc.dispatchEvent({ type: 'dragging-changed', value: false });
      });
      select(''); tcSetMode('translate');
      // her model not here yet (still loading): a move of Voice, on her head, writes its place only (its offset would be
      // measured against her feet and read against her head everywhere else); on her whole model, its offset as ever
      const m = d.model, pv = new THREE.Vector3(0.5, 1.2, -1.5); d.model = null;
      const wa = soundAt(it, pv), oldBone = it.rec.bone; it.rec.bone = undefined; const wb = soundAt(it, pv); it.rec.bone = oldBone; d.model = m;
      out.loading = [JSON.stringify(wa), !!wb.o];
      return out;
    })()`).catch(e => ({ err: e.message }));
    const out = [];
    if (r.err || !r.loading || r.loading[0] !== '{"p":[0.5,1.2,-1.5]}' || !r.loading[1]) out.push('moved while her model is not here (its place only on a bone, its offset on the whole model): ' + JSON.stringify(r.loading || r));
    if (!r.err && (!r.gripsMid || r.gripsMid[0] > 0.001)) out.push('sized by both grips, between their writes: the sound off the point on her (m, her size shown over her record\'s): ' + JSON.stringify(r.gripsMid));
    if (r.err || !r.carried[0] || Math.abs(r.carried[1] - 0.3) > 0.002 || Math.abs(r.carried[2]) > 0.002) out.push('carried by the grip (not following meanwhile): ' + JSON.stringify(r));
    else if (!r.let[0] || r.let[1] > 0.001 || r.let[2] !== 'dan001' || r.let[3] !== 'mixamorig:Head' || !r.let[4] || r.let[5] > 1e-6 || r.let[6] !== 1) out.push('let go, it follows her head from where it was put (its offset changed, one Undo step): ' + JSON.stringify(r));
    for (const [how, k] of [['steps', 2], ['grips', 2], ['arrows', 1.5]]) {
      const x = r[how];
      if (!x || Math.abs(x[0] - k) > 0.01 || !x[1] || x[2] > 0.001 || x[3] !== 1 || !x[4]) out.push(`sized by ${how}: the offset scaled with her (×${k}), the sound at the same point on her (within 1 mm), one Undo step that takes both back: ` + JSON.stringify(x));
    }
    await hold(null);
    bad('', out);
  });

  await step('studio follow: switched to its GLB, a sound on the figure\'s whole model (a turn baked in), one naming a bone the figure lacks (so on its whole model too) and Voice on the dancer\'s head stay where they were (within 1 mm)', async () => {
    const out = [];
    await hold(0.7);
    const fid = await ss(`addModel('figure.fbx')`);
    if (!fid || !await until(`!!(STU.items.get('${fid}') && STU.items.get('${fid}').model)`, 30000)) { errors.push('studio follow: the figure was not placed'); return; }
    const sF = await ss(`(() => { const sid = addSound('voice.wav'), f = STU.items.get('${fid}'); setRec(sid, { p: [f.rec.p[0] + 0.1, 1.2, f.rec.p[2] + 0.2] }); itemsStep(0, performance.now()); itemAct('follow', '${fid}', sid); return sid; })()`);
    // (and one naming a bone the figure lacks: it follows the whole model too, so its offset turns as well)
    const sG = await ss(`(() => { const sid = addSound('voice.wav'), f = STU.items.get('${fid}'); setRec(sid, { p: [f.rec.p[0] - 0.1, 1.4, f.rec.p[2] + 0.1] }); itemsStep(0, performance.now()); itemAct('follow', '${fid}', sid); setRec(sid, { bone: 'NoSuchBone' }); return sid; })()`);
    await frames(2);
    const pos = `[window.__fh.pos('${sF}').toArray(), window.__fh.pos('voi001').toArray(), STU.items.get('${sF}').rec.o, STU.items.get('voi001').rec.o, window.__fh.pos('${sG}').toArray(), STU.items.get('${sG}').rec.o]`;
    const w0 = await ss(pos), u0 = await ss('UNDO.length');
    const routes = [];
    for (const [file, gl] of [['figure.fbx', 'models/figure.glb'], ['dancer.glb', 'models/dancer.glb']]) {
      await ss(`(STUDIO.lastGLB = null, convertFile('${file}'), 0)`);
      if (!await until(`!CV.busy && !!STUDIO.lastGLB`, 90000)) { out.push(file + ' was not converted: ' + await ss('CV.note')); continue; }
      const ok = await ss('[STUDIO.lastGLB.ok, STUDIO.lastGLB.why || ""]');
      if (!ok[0]) { out.push(file + ' was not converted: ' + ok[1]); continue; }
      const bytes = Buffer.from(await ss(`(() => { const u = new Uint8Array(STUDIO.lastGLB.glb); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); })()`), 'base64');
      const pat = '**/scenes/rig/' + gl + '*';
      await fop.route(pat, route => route.fulfill({ body: bytes, contentType: 'model/gltf-binary' })); routes.push(pat);
      await ss(`(setFiles(STU.files.concat({ path: '${gl}', bytes: ${bytes.length}, at: 7, kind: 'model' })), GLBREC.set('${gl}', { at: 7, rec: STUDIO.lastGLB.record, p: null }), switchToGLB('${file}', '${gl}', STUDIO.lastGLB.record))`);
      if (!await until(`[...STU.items.values()].some(it => it.rec.file === '${gl}' && it.model && it.E && it.built === it.E.gen)`, 30000)) out.push(file + ': its objects did not switch to ' + gl);
    }
    await frames(2);
    const w1 = await ss(pos), dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
    const recs = await ss(`[STU.items.get('${fid}').rec.file, STU.items.get('dan001').rec.file, STUDIO.follow('voi001') && STUDIO.follow('voi001').node, UNDO.length]`);
    if (dist(w0[0], w1[0]) > 0.001 || dist(w0[1], w1[1]) > 0.001 || JSON.stringify(w0[2]) === JSON.stringify(w1[2]) || JSON.stringify(w0[3]) !== JSON.stringify(w1[3]) ||
      dist(w0[4], w1[4]) > 0.001 || JSON.stringify(w0[5]) === JSON.stringify(w1[5]) ||
      recs[0] !== 'models/figure.glb' || recs[1] !== 'models/dancer.glb' || recs[2] !== 'mixamorigHead' || recs[3] !== u0 + 2)
      out.push('switched to their GLBs: ' + JSON.stringify({ figure: [dist(w0[0], w1[0]), w0[2], w1[2]], noBone: [dist(w0[4], w1[4]), w0[5], w1[5]], voice: [dist(w0[1], w1[1]), w0[3], w1[3]], recs, u0 }));
    while (await ss('UNDO.length')) await ss('undo()');
    await ss(`(setFiles(STU.files.filter(f => !/^models\\//.test(f.path))), GLBREC.delete('models/figure.glb'), GLBREC.delete('models/dancer.glb'), 0)`);
    for (const pat of routes) await fop.unroute(pat);
    await until(`!!STU.items.get('dan001').model && STU.items.get('dan001').rec.file === 'dancer.glb' && STU.items.get('dan001').built === STU.items.get('dan001').E.gen`, 30000);
    await hold(null);
    if (await ss('STU.items.size') !== 4 || await ss('unsaved()')) out.push('the layout did not come back after the GLB checks');
    bad('', out);
  });

  await step('studio follow: her deletion leaves Voice where it is, following nothing (Undo brings both back, following again); a copy of Voice follows her too', async () => {
    const r = await ss(`(() => {
      const F = window.__fh, it = STU.items.get('voi001'), step = () => itemsStep(0, performance.now()), out = {};
      setEdit(true); step();
      const w = F.pos('voi001').toArray(), u0 = UNDO.length, rec0 = JSON.stringify(it.rec);
      deleteItem('dan001'); step();
      out.after = [STU.items.has('dan001'), 'on' in it.rec || 'bone' in it.rec || 'o' in it.rec, +Math.hypot(...it.rec.p.map((v, i) => v - w[i])).toFixed(5), +F.pos('voi001').distanceTo(new THREE.Vector3(...w)).toFixed(5), UNDO.length - u0];
      undo();
      out.back = [STU.items.has('dan001'), JSON.stringify(STU.items.get('voi001').rec) === rec0];
      const nid = duplicateItem('voi001'), c = STU.items.get(nid).rec;
      out.copy = [c.on, c.bone, JSON.stringify(c.o)];
      undo();
      return out;
    })()`);
    const back = await until(`(() => { const f = STUDIO.follow('voi001'); return !!STU.items.get('dan001').model && !!f && f.node === 'mixamorigHead' && f.d < 1e-6; })()`, 20000);
    if (r.after[0] || r.after[1] || r.after[2] > 0.001 || r.after[3] > 0.001 || r.after[4] !== 1 || !r.back[0] || !r.back[1] || !back || JSON.stringify(r.copy) !== '["dan001","mixamorig:Head","[0.5,-0.03,0.14]"]')
      errors.push('studio follow: deleting her, Undo, a copy: ' + JSON.stringify({ r, back }));
  });

  await step('studio follow: a cube hiding her silences Voice (heard no more, its gain going to 0, though the sound itself is shown), and showing her again starts it from its beginning', async () => {
    const out = [];
    await fop.evaluate(() => HOST.audio.mute(false));
    await fop.click('#explore .tabs button[data-tab="scene"]');   // (a tap: the sound may start)
    await ss('(shownFor([0, 1.6, 0]), 0)');
    if (!await until(`(() => { const it = STU.items.get('voi001'); return !!(it.src && it.gt > 0.1 && it.heard); })()`, 15000)) out.push('Voice did not start: ' + JSON.stringify(await ss(`[!!HOST.audio.fx(), HOST.audio.muted, STUDIO.state().sounds, STU.items.get('voi001').heard]`)));
    else {
      await ss(`(window.__fh.src = STU.items.get('voi001').src, shownFor([0, 1.6, 2]), 0)`);
      const hid = await until(`(() => { const it = STU.items.get('voi001'), d = STU.items.get('dan001'); return !d.shown && it.shown && !it.heard && it.gt === 0; })()`, 8000);
      const gone = await until(`!STU.items.get('voi001').src`, 8000);
      if (!hid || !gone) out.push('a cube hiding her did not silence Voice: ' + JSON.stringify(await ss(`(() => { const it = STU.items.get('voi001'); return [STU.items.get('dan001').shown, it.shown, it.heard, it.gt, it.fa, !!it.src]; })()`)));
      const t1 = await ss('performance.now()');
      await ss('(shownFor([0, 1.6, 0]), 0)');
      if (!await until(`(() => { const it = STU.items.get('voi001'); return !!(it.src && it.src !== window.__fh.src && it.gt > 0.1 && it.heard && it.shownAt >= ${t1}); })()`, 8000))
        out.push('showing her again did not start Voice from its beginning: ' + JSON.stringify(await ss(`(() => { const it = STU.items.get('voi001'); return [it.heard, it.gt, !!it.src, it.src === window.__fh.src, it.shownAt - ${t1}]; })()`)));
    }
    await ss('(shownFor(null), 0)');
    await fop.evaluate(() => HOST.audio.mute(true));
    bad('', out);
  });

  await step('studio follow: the shared state carries what a sound follows and gives it back; bad values refused or dropped; a state without her leaves Voice at its own place; layout.json\'s rules', async () => {
    const out = await ss(`(() => {
      const out = [], same = () => { const a = JSON.stringify(collabState()); collabApply(JSON.parse(a)); return JSON.stringify(collabState()) === a; };
      const s0 = collabState(), v = s0['s.voi001'];
      if (!v || v.on !== 'dan001' || v.bone !== 'mixamorig:Head' || JSON.stringify(v.o) !== '[0,-0.03,0.14]' || !same()) out.push('the state with the new fields: ' + JSON.stringify(v));
      // a record's checks: bad ones refused, the rest dropped or rounded, and each given back the same
      const N = x => norm('s', Object.assign({ file: 'voice.wav', p: [0, 1, 0] }, x)), J = x => JSON.stringify(x);
      const cases = [
        ['on not an id', N({ on: 'Dancer' }), null], ['bone not a string', N({ on: 'dan001', bone: 7 }), null], ['o not 3 numbers', N({ on: 'dan001', o: [1, 2] }), null],
        ['o with a word', N({ on: 'dan001', o: [0, 'up', 0] }), null], ['o too far', N({ on: 'dan001', o: [0, 2000, 0] }), null],
        ['o without on, dropped', J(N({ o: [0.1, 0, 0] })), J(N({}))], ['bone without on, dropped', J(N({ bone: 'mixamorigHead' })), J(N({}))],
        ['a bone not a string without on, dropped', J(N({ bone: 7 })), J(N({}))], ['an o not 3 numbers without on, dropped', J(N({ o: 'up' })), J(N({}))],
        ['[0, 0, 0] and an empty bone, dropped', J(N({ on: 'dan001', o: [0, 0, 0], bone: '' })), J(Object.assign(N({}), { on: 'dan001' }))],
        ['the offset to the mm', J(N({ on: 'dan001', bone: 'mixamorigHead', o: [0.12345, -0.0004, 1] }).o), '[0.123,0,1]'],
      ];
      for (const [n, got, want] of cases) if (got !== want) out.push(n + ': ' + J(got));
      const once = N({ on: 'dan001', bone: 'x', o: [0.1234, 0, 0] });
      if (J(norm('s', once)) !== J(once)) out.push('a checked record not given back the same');
      // from the room: a bad sound record ignored; a state without her: Voice keeps her id and stands at its own place
      const was = J(collabState()), b = JSON.parse(was);
      b['s.voi001'] = Object.assign({}, b['s.voi001'], { on: 'NOPE!!' }); collabApply(b);
      if (J(collabState()) !== was) out.push('a bad record from the room was taken');
      const nd = JSON.parse(was); delete nd['o.dan001']; collabApply(nd); itemsStep(0, performance.now());
      const it = STU.items.get('voi001');
      if (it.rec.on !== 'dan001' || STUDIO.follow('voi001') !== null || it.holder.position.distanceTo(new THREE.Vector3(...it.rec.p)) > 1e-6 || !it.heard) out.push('without her (a state from the room): ' + J([it.rec, it.holder.position.toArray(), it.heard]));
      collabApply(JSON.parse(was));
      if (J(collabState()) !== was) out.push('the state did not come back');
      // layout.json: a sound following an object the layout lacks keeps what it follows (it stands at its place until the
      // object is back, as with a state from the room, and a save never loses it); a bad on drops the item
      const L = readLayout({ studio: 1, objects: [], sounds: [{ id: 'aaaaaa', file: 'voice.wav', p: [0, 1, 0], on: 'dan001', bone: 'x', o: [0, 1, 0] }, { id: 'bbbbbb', file: 'voice.wav', p: [0, 1, 0], on: 'Dancer' }] });
      if (L.items.length !== 1 || L.bad !== 1 || L.items[0].rec.on !== 'dan001' || L.items[0].rec.bone !== 'x' || J(L.items[0].rec.o) !== '[0,1,0]') out.push('readLayout: ' + J(L));
      // Rigify's DEF- spine in the short list (hips .000, chest .003, neck .004, head .006, as GLTFLoader names them), and
      // another rig's spine006 never taken for a head
      const rig = names => { const R = new THREE.Group(); let par = R; for (const n of names) { const b = new THREE.Bone(); b.name = n; par.add(b); par = b; } return bonesOf({ root: R, clips: [] }).slots.map(x => x.join('=')).join(); };
      const rf = rig(['DEF-spine', 'DEF-spine001', 'DEF-spine002', 'DEF-spine003', 'DEF-spine004', 'DEF-spine005', 'DEF-spine006', 'DEF-handL', 'DEF-footR']), ro = rig(['Spine', 'Spine003', 'Spine006']);
      if (rf !== 'Head=DEF-spine006,Neck=DEF-spine004,Chest=DEF-spine003,Hips=DEF-spine,Left hand=DEF-handL,Right foot=DEF-footR' || ro !== 'Chest=Spine003') out.push('the short list for Rigify: ' + J([rf, ro]));
      // following the object it follows already: nothing changes (its bone kept, no Undo step)
      const vr = J(STU.items.get('voi001').rec), un = UNDO.length;
      itemAct('follow', 'dan001', 'voi001');
      if (J(STU.items.get('voi001').rec) !== vr || UNDO.length !== un || STU.follow) out.push('the object it follows picked again: ' + J([STU.items.get('voi001').rec, UNDO.length - un]));
      const lo = layoutOut().sounds.find(x => x.id === 'voi001');
      if (!lo || lo.on !== 'dan001' || lo.bone !== 'mixamorig:Head' || J(lo.o) !== '[0,-0.03,0.14]') out.push('Download layout.json: ' + J(lo));
      return out;
    })()`);
    if (!await until(`!!STU.items.get('dan001').model && !!STUDIO.follow('voi001')`, 20000)) out.push('she did not come back from the room\'s state');
    bad('', out);
  });

  await step('studio follow: the headset\'s card has the same rows (Follows, the short list, More bones a page at a time), its buttons work, and the trigger on an object picks what a sound follows', async () => {
    const out = await ss(`(() => {
      const out = [], draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } };
      // (every button the pane draws, scrolled through; a press scrolls to it first)
      const ids = () => { const seen = new Set(); for (let off = 0; off < 4000; off += 150) { X.scroll.item = off; draw(); for (const r of XR.main.regions) seen.add(r.id); } X.scroll = {}; draw(); return seen; };
      const press = id => { for (let off = 0; off < 4000; off += 150) { X.scroll.item = off; draw(); const r = XR.main.regions.find(q => q.id === id); if (r && r.fn) { r.fn(); X.scroll = {}; draw(); return true; } } X.scroll = {}; return false; };
      setEdit(true); select('voi001'); X.tab = 'item'; X.scroll = {}; XR.on = true; draw();
      const it = STU.items.get('voi001'), u0 = UNDO.length;
      let I = ids();
      const want = ['follow', 'onto', 'unfollow', 'bone:', 'bone:Head', 'bone:Neck', 'bone:Chest', 'bone:Hips', 'bone:Left hand', 'bone:Right hand', 'bone:Left foot', 'bone:Right foot', 'bones'];
      const miss = want.filter(i => !I.has(i));
      if (miss.length) out.push('the card in the headset lacks ' + miss.join(', ') + ' (' + [...I].join(' ') + ')');
      if (!press('bone:Neck') || it.rec.bone !== 'mixamorigNeck') out.push('Neck on the headset: ' + JSON.stringify(it.rec));
      // More bones: a page of 8 at a time (here 18: hers and ten made up for the test), Next and Previous; a bone she lacks refused
      const B = bonesOf(STU.items.get('dan001').E), keep = B.list;
      B.list = keep.concat(Array.from({ length: 10 }, (_, i) => 'extra' + i));
      press('bones'); I = ids();
      const p1 = [...I].filter(i => i.startsWith('bonen:'));
      if (p1.length !== 8 || !I.has('bonepg:+') || I.has('bonepg:-')) out.push('More bones, its first page: ' + [...I].join(' '));
      press('bonepg:+'); I = ids();
      const p2 = [...I].filter(i => i.startsWith('bonen:'));
      if (p2.join() !== Array.from({ length: 8 }, (_, i) => 'bonen:extra' + i).join() || !I.has('bonepg:-') || !I.has('bonepg:+')) out.push('More bones, its second page: ' + [...I].join(' '));
      const was = JSON.stringify(it.rec); press('bonen:extra3');
      if (JSON.stringify(it.rec) !== was) out.push('a bone she lacks was taken');
      B.list = keep; STU.bones = '';
      // Follow another object...: a list of the objects (the box picked), then the trigger on her picks her back
      press('follow');
      I = ids();
      if (STU.follow !== 'voi001' || !I.has('followon:dan001') || !I.has('followon:box001')) out.push('Follow another object...: ' + JSON.stringify([STU.follow, [...I]]));
      press('followon:box001');
      if (it.rec.on !== 'box001' || STU.follow) out.push('picked from the list in the headset: ' + JSON.stringify(it.rec));
      press('follow');
      const a = XR.ctrls[0]; a.src = { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: null }; a.g.visible = true; a.hover = { kind: 'item', id: 'dan001' }; xrPress(a);
      if (it.rec.on !== 'dan001' || STU.follow || STU.sel !== 'voi001') out.push('the trigger on her while picking: ' + JSON.stringify([it.rec, STU.follow, STU.sel]));
      a.src = null; a.g.visible = false; a.hover = null;
      if (UNDO.length - u0 !== 3) out.push('the changes in the headset were not one Undo step each: ' + (UNDO.length - u0));
      while (UNDO.length > u0) undo();
      XR.on = false; select(''); X.tab = 'scene'; renderPanes();
      return out;
    })()`);
    if (await ss('unsaved()')) out.push('the layout did not come back after the headset\'s checks');
    bad('', out);
    await fop.close();
  });
}
// The studio's cut-outs (tools/studio/SPEC.md, "Cut-outs"), on a page of its own: the fourth test scene,
// tools/studio/test/scenes/cuts (made by tools/studio/test/make.mjs: a wall whose Door the cube Doorway shows, Box A with a
// Hole and Box B of the same file, the dancer, the figure). Pixels read back from a render of the scene prove each cut (the
// same frame drawn with the cut and without it: inside the box where the model was, something else; outside, the same):
// the hole in Box A and none in Box B; the door shut for a head outside Doorway, open inside it, shut again outside; the
// wall moved, turned and sized with the door on the same part of it; the dancer's posed head; Convert to GLB of the figure
// keeping its box where it was; the shared state, bad records, a state without the wall, 16 on one model; layout.json; the
// page's card, the Add pane, the Items pane and the arrows; a pretend headset's grips and a corner; the headset's card
if (runs('studio cuts')) {
  const cxp = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  cxp.on('pageerror', e => errors.push('studio cuts: ' + (e.stack || e.message)));
  cxp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('studio cuts: ' + m.text()); });
  const ss = s => cxp.evaluate(s => HOST.cur.peek(s), s);
  const until = (src, ms) => cxp.waitForFunction(src => HOST.cur.peek(src), src, { timeout: ms || 20000 }).then(() => true, () => false);
  const frames = async n => { const f0 = await cxp.evaluate(() => window.__frames || 0); await cxp.waitForFunction(f => window.__frames >= f, f0 + (n || 1), { timeout: 30000 }).catch(() => errors.push('studio cuts: the page drew no frames')); };
  const bad = list => { if (list.length) errors.push(...list.map(b => 'studio cuts: ' + b)); };
  // (in the page: the scene drawn from a camera of its own (eye and target in the scene's frame) into a picture read back
  // where scene points land, twice in one go: as it is, then with the cut-outs named cutting nothing (their fade at 0 for
  // that drawing, so nothing else changes); a cut-out's corners in its object's own frame, its scale included)
  const HELP = `window.__cx = window.__cx || {
    two: (eye, tgt, pts, ids) => {
      const W = 400, H = 250, r = GL.renderer, rt = new THREE.WebGLRenderTarget(W, H), cam = new THREE.PerspectiveCamera(40, W / H, 0.05, 200);
      GL.world.updateMatrixWorld(true);
      cam.position.copy(GL.items.localToWorld(new THREE.Vector3(...eye))); cam.lookAt(GL.items.localToWorld(new THREE.Vector3(...tgt))); cam.updateMatrixWorld();
      const at = () => pts.map(p => { const v = GL.items.localToWorld(new THREE.Vector3(...p)).project(cam), b = new Uint8Array(4); r.readRenderTargetPixels(rt, Math.round((v.x + 1) / 2 * W), Math.round((v.y + 1) / 2 * H), 1, 1, b); return [b[0], b[1], b[2]]; });
      // (what editing draws hidden for the picture: cubes, cut-outs' boxes, outlines, the arrows; only the models)
      const looks = [...STU.items.values()].filter(i => i.kind === 'c' || i.kind === 'x').map(i => i.holder).concat([GL.edit, GL.selBox, GL.hoverBox, GL.tc].filter(Boolean));
      const draw = () => { const keep = looks.map(o => o.visible); looks.forEach(o => { o.visible = false; }); r.setRenderTarget(rt); r.render(GL.scene, cam); const px = at(); r.setRenderTarget(null); looks.forEach((o, i) => { o.visible = keep[i]; }); return px; };
      const now = performance.now(), keep = ids.map(id => STU.items.get(id).sa);
      itemsStep(0, now); const on = draw();
      ids.forEach(id => { STU.items.get(id).sa = 0; }); itemsStep(0, now); const off = draw();
      ids.forEach((id, i) => { STU.items.get(id).sa = keep[i]; }); itemsStep(0, now);
      rt.dispose();
      return { on, off, cut: ids.map(id => !!STU.items.get(id).cutting) };
    },
    local: id => { const x = STU.items.get(id), ob = cutObj(x); x.holder.updateWorldMatrix(true, false); ob.holder.updateWorldMatrix(true, false); const m = ob.holder.matrixWorld.clone().invert().multiply(x.holder.matrixWorld); return [0, 1, 2, 3, 4, 5, 6, 7].map(k => new THREE.Vector3(k & 1 ? 0.5 : -0.5, k & 2 ? 0.5 : -0.5, k & 4 ? 0.5 : -0.5).applyMatrix4(m).toArray()); },
    far: (a, b) => Math.max(...a.map((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1], p[2] - b[i][2]))),
    sc: sceneClock,
  }`;
  const dpx = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  // the pixels: the first point cut (another colour with the cut than without), the rest not (the same)
  const proves = r => !!r && dpx(r.on[0], r.off[0]) > 40 && r.on.slice(1).every((p, i) => dpx(p, r.off[i + 1]) <= 6);

  await step('studio cuts: the cuts scene loads with its cut-outs; the hole in Box A and none in Box B of the same file (pixels), only Box A\'s materials patched; nothing of a box drawn when not editing', async () => {
    await cxp.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&scene=cuts&edit');
    await cxp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    if (!await until(`STUDIO.ready() && ['wal001', 'boxa01', 'boxb01', 'dan001', 'fig001'].every(id => STU.items.get(id) && STU.items.get(id).model)`, 120000)) { errors.push('studio cuts: the cuts scene did not load: ' + JSON.stringify(await ss('STUDIO.state()')).slice(0, 500)); return; }
    await ss(`(${HELP}, 0)`);
    const out = [];
    const r0 = await ss(`(() => { const L = STUDIO.items(); return { n: ['o', 'c', 's', 'x'].map(k => L.filter(i => i.kind === k).length), dor: JSON.stringify(STU.items.get('dor001').rec), hol: JSON.stringify(STU.items.get('hol001').rec), bad: STU.bad, unsaved: unsaved() }; })()`);
    if (r0.n.join() !== '5,1,0,2' || r0.dor !== '{"name":"Door","on":"wal001","p":[0.6,1,0],"q":[0,0,0,1],"size":[0.8,2,0.4]}' || r0.hol !== '{"name":"Hole","on":"boxa01","p":[0.2,0.2,0.2],"q":[0,0,0,1],"size":[0.3,0.3,0.3]}' || r0.bad || r0.unsaved) out.push('the layout read: ' + JSON.stringify(r0));
    if (!await until(`STUDIO.cut('hol001').cutting && !STUDIO.cut('dor001').cutting`, 5000)) out.push('the hole does not cut, or the door (which its cube shows) cuts with nobody in the cube: ' + JSON.stringify(await ss(`[STUDIO.cut('hol001'), STUDIO.cut('dor001')]`)).slice(0, 300));
    const pt = await ss(`[!!STU.items.get('boxa01').model.cut, !!STU.items.get('boxb01').model.cut, !!STU.items.get('dan001').model.cut, STUDIO.cut('hol001').n, STUDIO.cut('hol001').list.join()]`);
    if (pt.join() !== 'true,false,false,1,hol001') out.push('patched: only Box A\'s model, its one box handed over: ' + JSON.stringify(pt));
    // editing off: no box drawn (nor its corners or name), only the hole
    await ss('(setEdit(false), 0)');
    if (!await until(`['dor001', 'hol001'].every(id => !STU.items.get(id).holder.visible && !STU.items.get(id).look.deco.visible) && STUDIO.cut('hol001').cutting`, 5000)) out.push('editing off: a box still drawn, or the hole gone: ' + JSON.stringify(await ss(`STUDIO.items().filter(i => i.kind === 'x').map(i => [i.id, i.visible, i.cutting, i.a])`)));
    // the top of each box, in its corner the hole is in (Box A) and the same place on Box B, and a place outside it
    const px = await ss(`window.__cx.two([-2.8, 1.3, -1.2], [-2.8, 0.4, -2.6], [[-2.25, 0.5, -2.45], [-3.05, 0.5, -2.45], [-2.55, 0.5, -2.75], [-3.35, 0.5, -2.75]], ['hol001'])`);
    if (!proves({ on: px.on.slice(0, 2), off: px.off.slice(0, 2) }) || !proves({ on: [px.on[0], ...px.on.slice(2)], off: [px.off[0], ...px.off.slice(2)] }) || !px.cut[0]) out.push('the hole in Box A and none in Box B (pixels with the cut and without: A\'s corner, B\'s, then outside the hole on each): ' + JSON.stringify(px));
    // as scanned (its unlit materials, made now): cut as the lit ones were
    const sc = await ss(`(setRec('boxa01', { light: 'scan' }), window.__cx.two([-2.8, 1.3, -1.2], [-2.8, 0.4, -2.6], [[-2.25, 0.5, -2.45], [-2.55, 0.5, -2.75]], ['hol001']))`);
    await ss(`(setRec('boxa01', { light: 'lit' }), 0)`);
    if (!proves(sc)) out.push('as scanned, Box A not cut (pixels): ' + JSON.stringify(sc));
    await ss('(setEdit(true), 0)');
    bad(out);
  });

  await step('studio cuts: the door a cube shows: the wall whole for a head outside Doorway, opened once its fade passes one half inside it, whole again outside (pixels)', async () => {
    const out = [];
    await ss('(setEdit(false), shownFor(null), 0)');
    await until(`!STU.items.get('dor001').holder.visible && STU.items.get('dor001').sa < 0.01`, 5000);
    const eye = [0.3, 1.3, 1.5], tgt = [0.3, 1.1, -3], pts = [[0.6, 1, -2.9], [-0.8, 1, -2.9]];
    const shot = () => ss(`(() => { const r = window.__cx.two(${JSON.stringify(eye)}, ${JSON.stringify(tgt)}, ${JSON.stringify(pts)}, []); return r.on; })()`);
    const a = await shot();
    const now0 = await ss(`(shownFor([0.6, 1.6, -1.9]), [STU.items.get('dor001').shown, STUDIO.cut('dor001').cutting])`);
    const opened = await until(`STUDIO.cut('dor001').cutting`, 5000);
    const b = await shot();
    await ss('(shownFor([0.6, 1.6, 1.5]), 0)');
    const shut = await until(`!STUDIO.cut('dor001').cutting && STU.items.get('dor001').sa < 0.01`, 5000);
    const c = await shot();
    if (!now0[0] || now0[1] || !opened || !shut || dpx(a[0], b[0]) <= 40 || dpx(a[1], b[1]) > 10 || dpx(a[0], c[0]) > 10)
      out.push('the door: shown at once but cutting only past half its fade, open inside the cube, shut outside (the door\'s middle on the wall, then the wall beside it): ' + JSON.stringify({ now0, opened, shut, a, b, c }));
    await ss('(STU.head = null, setEdit(true), 0)');
    bad(out);
  });

  await step('studio cuts: the wall moved, turned and sized keeps the door on the same part of it (its corners in the wall\'s own frame), its record scaled with the size, one Undo step each; the hole still where the door is (pixels)', async () => {
    const out = [];
    await ss(`(shownFor([0.6, 1.6, -1.9]), 0)`);
    await until(`STUDIO.cut('dor001').cutting`, 5000);
    const r = await ss(`(() => {
      const F = window.__cx, w = STU.items.get('wal001'), d = STU.items.get('dor001'), step = () => itemsStep(0, performance.now()), out = {}, l0 = F.local('dor001'), u0 = UNDO.length;
      change(() => setObj('wal001', { p: [0.5, 0, -3.2] })); step(); out.move = [+F.far(F.local('dor001'), l0).toFixed(5), UNDO.length - u0];
      itemAct('size', 2, 'wal001'); step(); out.size = [+F.far(F.local('dor001'), l0).toFixed(5), JSON.stringify(d.rec), w.rec.s, UNDO.length - u0];
      // (the door's middle, inside the wall, and the wall 1.2 m to its side: a camera in front of them)
      const c = d.holder.position.clone(), eye = [c.x, c.y + 0.2, c.z + 6], pts = [c.toArray(), [c.x - 2.4, c.y, c.z]];
      out.px = F.two(eye, c.toArray(), pts, ['dor001']);
      itemAct('turn', null, 'wal001'); step(); out.turn = [+F.far(F.local('dor001'), l0).toFixed(5), JSON.stringify(d.rec.q), UNDO.length - u0];
      itemAct('stand', null, 'wal001'); step(); out.stand = [+F.far(F.local('dor001'), l0).toFixed(5), UNDO.length - u0];
      for (let k = 0; k < 4; k++) undo();
      step(); out.back = [JSON.stringify(d.rec), JSON.stringify(w.rec.p), w.rec.s, +F.far(F.local('dor001'), l0).toFixed(5)];
      return out;
    })()`).catch(e => ({ err: e.message }));
    if (r.err || r.move[0] > 0.001 || r.move[1] !== 1 || r.size[0] > 0.001 || r.size[1] !== '{"name":"Door","on":"wal001","p":[1.2,2,0],"q":[0,0,0,1],"size":[1.6,4,0.8]}' || r.size[2] !== 2 || r.size[3] !== 2 ||
      r.turn[0] > 0.001 || r.turn[1] !== '[0,0,0,1]' || r.turn[2] !== 3 || r.stand[0] > 0.001 || r.stand[1] !== 4 || r.back[0] !== '{"name":"Door","on":"wal001","p":[0.6,1,0],"q":[0,0,0,1],"size":[0.8,2,0.4]}' || r.back[1] !== '[0,0,-3]' || r.back[2] !== 1 || r.back[3] > 0.001)
      out.push('moved, sized, turned, stood up and undone (the door\'s corners in the wall\'s own frame within 1 mm): ' + JSON.stringify(r).slice(0, 600));
    if (!r.err && !proves(r.px)) out.push('sized and moved: the hole where the door is now, the wall beside it whole (pixels): ' + JSON.stringify(r.px));
    await ss('(STU.head = null, 0)');
    bad(out);
  });

  await step('studio cuts: the dancer cut at her posed head (her clip held where her head is far from her rest pose): the hole is where she is drawn, not where her rest pose would be (pixels)', async () => {
    const r = await ss(`(() => {
      const F = window.__cx, d = STU.items.get('dan001');
      sceneClock = () => 0.5; itemsStep(0, performance.now());
      const head = d.model.o.getObjectByName('mixamorigHead'); head.updateWorldMatrix(true, false);
      const posed = GL.items.worldToLocal(head.localToWorld(new THREE.Vector3(0, 0.11, 0))), rest = new THREE.Vector3(2.3, 1.76, -2.6);
      const hips = d.model.o.getObjectByName('mixamorigHips'); hips.updateWorldMatrix(true, false);
      const body = GL.items.worldToLocal(hips.localToWorld(new THREE.Vector3(0, 0.1, 0.1)));
      // (Cut out a part from a ray at her posed head: the box goes where the ray meets her as she is drawn, cutAt)
      const eyeW = GL.items.localToWorld(posed.clone().add(new THREE.Vector3(0, 0.05, 1.8))), dirW = GL.items.localToWorld(posed.clone()).sub(eyeW).normalize();
      cutRay('dan001', new THREE.Ray(eyeW, dirW));
      const at = +cutAt(d).p.distanceTo(posed).toFixed(3);
      STU.ray = null;
      const id = newId();
      change(() => putItem(id, 'x', norm('x', Object.assign({ name: 'Head', on: 'dan001' }, cutRecFrom(d, posed, new THREE.Quaternion(), new THREE.Vector3(0.36, 0.36, 0.36))))));
      return { id, far: +posed.distanceTo(rest).toFixed(3), posed: posed.toArray(), body: body.toArray(), at };
    })()`);
    const out = [];
    if (!await until(`STUDIO.cut('${r.id}').cutting && !!STU.items.get('dan001').model.cut`, 5000)) out.push('the cut on her head does not cut');
    const p = r.posed, eye = [p[0], p[1] + 0.05, p[2] + 1.8];
    const px = await ss(`window.__cx.two(${JSON.stringify(eye)}, ${JSON.stringify(p)}, ${JSON.stringify([p, r.body])}, ['${r.id}'])`);
    if (r.far < 0.3 || !proves(px)) out.push('her posed head cut, her body not (pixels; her head ' + r.far + ' m from her rest pose): ' + JSON.stringify({ r, px }));
    if (!(r.at < 0.2)) out.push('Cut out a part from a ray at her posed head: the box where the ray met her as drawn (within 0.2 m of her head\'s middle), not her rest pose or her middle: ' + r.at);
    await ss(`(sceneClock = window.__cx.sc, undo(), 0)`);
    if (await ss(`STU.items.has('${r.id}')`)) out.push('Undo did not take the cut-out away');
    bad(out);
  });

  await step('studio cuts: Convert to GLB of the figure (a turn and a scale baked in) switches it with its cut-out where it was (corners within 1 mm), still cutting', async () => {
    const out = [];
    const id = await ss(`(() => {
      const f = STU.items.get('fig001'), b = objBox(f), id = newId();
      change(() => putItem(id, 'x', norm('x', Object.assign({ name: 'Slice', on: 'fig001' }, cutRecFrom(f, b.getCenter(new THREE.Vector3()), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 1, 0).normalize(), 0.4), new THREE.Vector3(0.5, 0.3, 0.5))))));
      return id;
    })()`);
    await until(`STUDIO.cut('${id}').cutting`, 5000);
    const c0 = await ss(`[STUDIO.cut('${id}').corners, JSON.stringify(STU.items.get('${id}').rec), UNDO.length]`);
    await ss(`(STUDIO.lastGLB = null, convertFile('figure.fbx'), 0)`);
    if (!await until(`!CV.busy && !!STUDIO.lastGLB`, 90000) || !await ss('STUDIO.lastGLB.ok')) { out.push('figure.fbx was not converted: ' + await ss('CV.note')); bad(out); return; }
    const bytes = Buffer.from(await ss(`(() => { const u = new Uint8Array(STUDIO.lastGLB.glb); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); })()`), 'base64');
    const pat = '**/scenes/cuts/models/figure.glb*';
    await cxp.route(pat, route => route.fulfill({ body: bytes, contentType: 'model/gltf-binary' }));
    await ss(`(setFiles(STU.files.concat({ path: 'models/figure.glb', bytes: ${bytes.length}, at: 7, kind: 'model' })), GLBREC.set('models/figure.glb', { at: 7, rec: STUDIO.lastGLB.record, p: null }), switchToGLB('figure.fbx', 'models/figure.glb', STUDIO.lastGLB.record))`);
    const sw = await until(`(() => { const f = STU.items.get('fig001'); return f.rec.file === 'models/figure.glb' && !!f.model && f.built === f.E.gen && STUDIO.cut('${id}').cutting && STUDIO.cut('${id}').patched; })()`, 30000);
    await frames(2);
    const c1 = await ss(`[STUDIO.cut('${id}').corners, JSON.stringify(STU.items.get('${id}').rec), UNDO.length, STUDIO.lastGLB.record]`);
    const far = Math.max(...c0[0].map((p, i) => Math.hypot(...p.map((v, k) => v - c1[0][i][k]))));
    if (!sw || far > 0.001 || c0[1] === c1[1] || c1[2] !== c0[2] + 1) out.push('switched to its GLB, the cut-out where it was (within 1 mm; its record turned, one Undo step): ' + JSON.stringify({ sw, far, before: c0[1], after: c1[1], undo: [c0[2], c1[2]], rec: c1[3] }));
    while (await ss('UNDO.length')) await ss('undo()');
    await ss(`(setFiles(STU.files.filter(f => !/^models\\//.test(f.path))), GLBREC.delete('models/figure.glb'), 0)`);
    await cxp.unroute(pat);
    await until(`STU.items.get('fig001').rec.file === 'figure.fbx' && !!STU.items.get('fig001').model && STU.items.get('fig001').built === STU.items.get('fig001').E.gen`, 30000);
    if (await ss('STU.items.size') !== 8 || await ss('unsaved()')) out.push('the layout did not come back after the GLB checks: ' + await ss('STU.items.size'));
    bad(out);
  });

  await step('studio cuts: the shared state with x.<id> and back; bad records refused, unknown fields ignored; a state without the wall keeps its door, cutting nothing; 16 on one model and no more; layout.json with and without cuts', async () => {
    const out = await ss(`(() => {
      const out = [], J = x => JSON.stringify(x), same = () => { const a = J(collabState()); collabApply(JSON.parse(a)); return J(collabState()) === a; };
      const s0 = collabState();
      if (J(s0['x.dor001']) !== J(STU.items.get('dor001').rec) || !s0['x.hol001'] || !same()) out.push('the state with its cut-outs: ' + J(s0['x.dor001']));
      const N = x => norm('x', Object.assign({ on: 'wal001', p: [0, 1, 0] }, x));
      const cases = [
        ['no object', norm('x', { p: [0, 1, 0] }), null], ['on not an id', N({ on: 'Wall!' }), null], ['p not three numbers', N({ p: [0, 1] }), null],
        ['q of no length', N({ q: [0, 0, 0, 0] }), null], ['q not four numbers', N({ q: [0, 0, 1] }), null], ['size not three numbers', N({ size: [1, 2] }), null], ['size with a word', N({ size: [1, 'two', 1] }), null],
        ['the defaults', J(N({})), '{"name":"Cut-out","on":"wal001","p":[0,1,0],"q":[0,0,0,1],"size":[0.8,2,0.4]}'],
        ['clamped, rounded, normalised, unknown fields ignored', J(N({ name: '  Door  ', p: [0.12345, 1, -0.0004], q: [0, 2, 0, 0], size: [0.001, 120, 0.1234], colour: 'red', id: 'abcdef' })), '{"name":"Door","on":"wal001","p":[0.123,1,0],"q":[0,1,0,0],"size":[0.01,50,0.123]}'],
      ];
      for (const [n, got, want] of cases) if (got !== want) out.push(n + ': ' + J(got));
      const once = N({ q: [0.1, 0.2, 0.3, 0.9], size: [0.5, 0.25, 3] });
      if (J(norm('x', once)) !== J(once)) out.push('a checked record not given back the same');
      // from the room: a bad cut-out record ignored (the item kept); a state without the wall: the door kept, cutting nothing
      const was = J(collabState()), b = JSON.parse(was);
      b['x.dor001'] = Object.assign({}, b['x.dor001'], { size: 'big' }); collabApply(b);
      if (J(collabState()) !== was) out.push('a bad record from the room was taken');
      const nw = JSON.parse(was); delete nw['o.wal001']; collabApply(nw); itemsStep(0, performance.now());
      const c = STUDIO.cut('dor001');
      if (!c || c.on !== null || c.cutting || STU.items.get('dor001').rec.on !== 'wal001') out.push('without the wall (a state from the room): ' + J(c));
      X.tab = 'items'; renderPanes();
      if (!/Cut-outs cutting nothing/.test(document.querySelector('#pane-items').textContent)) out.push('the Items pane does not list the door as cutting nothing');
      collabApply(JSON.parse(was));
      // (the same fields and records; the wall, put back, now comes last)
      const K = v => J(Object.keys(v).sort().map(k => [k, v[k]]));
      if (K(collabState()) !== K(JSON.parse(was))) out.push('the state did not come back');
      // at most 16 on one model: the 17th refused, and said so on its card
      const u0 = UNDO.length, made = [];
      for (let k = 0; k < 20; k++) { const id = addCut('boxb01'); if (id) made.push(id); }
      select('boxb01'); X.tab = 'item'; renderPanes();
      const card = document.querySelector('#pane-item').textContent, dis = document.querySelector('#pane-item [data-act="i:cut"]').disabled;
      if (made.length !== 16 || cutsOn('boxb01').length !== 16 || canCut(STU.items.get('boxb01')) || !/16 cut-outs on Box B: the most one model takes/.test(card) || !dis || UNDO.length - u0 !== 16) out.push('16 on one model: ' + J([made.length, cutsOn('boxb01').length, dis, UNDO.length - u0]));
      while (UNDO.length > u0) undo();
      select(''); X.tab = 'scene';
      // layout.json: its cuts written, read back; a v112 layout (no cuts) read as before; a cut-out whose object the
      // layout lacks kept; a bad one dropped and counted
      const L = layoutOut();
      if (!Array.isArray(L.cuts) || L.cuts.length !== 2 || J(L.cuts.find(x => x.id === 'dor001')) !== J(Object.assign({ id: 'dor001' }, STU.items.get('dor001').rec))) out.push('layout.json written: ' + J(L.cuts));
      const back = readLayout(JSON.parse(J(L)));
      if (back.bad || back.items.filter(x => x.kind === 'x').length !== 2) out.push('layout.json read back: ' + J(back).slice(0, 200));
      const old = readLayout({ studio: 1, objects: L.objects, cubes: L.cubes, sounds: [] });
      if (old.bad || old.items.length !== 6 || old.items.some(x => x.kind === 'x')) out.push('a layout without cuts: ' + J([old.bad, old.items.length]));
      const odd = readLayout({ studio: 1, objects: [], cuts: [{ id: 'aaaaaa', on: 'nobody', p: [0, 1, 0] }, { id: 'bbbbbb', on: 'Wall!', p: [0, 1, 0] }, { id: 'cccccc', on: 'wal001', p: [0, 1, 0], size: 'big' }] });
      if (odd.items.length !== 1 || odd.bad !== 2 || odd.items[0].rec.on !== 'nobody') out.push('readLayout: ' + J(odd));
      return out;
    })()`);
    if (!await until(`!!STU.items.get('wal001').model && STUDIO.cut('dor001').on === 'wal001'`, 20000)) out.push('the wall did not come back from the room\'s state');
    bad(out);
  });

  await step('studio cuts: the page\'s card: Cut out a part where the pointer met the wall, the size steps, Preview whole and cut, Delete and Undo; the Add pane; the Items pane; the arrows; deleting the wall takes its cut-outs, duplicating it copies them; Move onto another object keeps its place', async () => {
    const out = [];
    // the camera in front of the wall; the pointer over it, 1.4 m left of its middle, then a click selects it
    await ss(`(setEdit(true), setView('orbit'), orbit.cur = [0, 8, 6, 0, 1.2, -3], orbit.to = null, select(''), 0)`);
    await frames(3);
    const sp = await ss(`(() => { GL.camera.updateMatrixWorld(); const v = GL.items.localToWorld(new THREE.Vector3(-1, 1.3, -2.9)).project(GL.camera); return [Math.round((v.x + 1) / 2 * innerWidth), Math.round((1 - v.y) / 2 * innerHeight)]; })()`);
    await cxp.mouse.move(sp[0] - 20, sp[1]); await cxp.mouse.move(sp[0], sp[1]);
    await cxp.mouse.click(sp[0], sp[1]);
    const sel = await until(`STU.sel === 'wal001' && STU.ray && STU.ray.id === 'wal001'`, 5000);
    await ss(`(X.tab = 'item', renderPanes(), 0)`);
    const u0 = await ss('UNDO.length');
    await cxp.click('#pane-item [data-act="i:cut"]');
    const nc = await ss(`(() => { const x = STU.items.get(STU.sel); if (!x || x.kind !== 'x') return null; const c = x.holder.position; return { id: x.id, on: x.rec.on, size: x.rec.size, at: [c.x, c.y, c.z].map(v => +v.toFixed(3)), q: x.rec.q, undo: UNDO.length }; })()`);
    if (!sel || !nc || nc.on !== 'wal001' || nc.size.join() !== '0.6,0.6,0.4' || Math.hypot(nc.at[0] + 1, nc.at[1] - 1.3, nc.at[2] + 2.9) > 0.05 || Math.abs(nc.q[1]) > 0.15 || nc.undo !== u0 + 1)
      out.push('Cut out a part: where the pointer met the wall, a fifth of its 3 m, facing the camera, selected, one Undo step: ' + JSON.stringify({ sel, nc }));
    if (nc) {
      await until(`STUDIO.cut('${nc.id}').cutting`, 5000);
      await ss('(renderPanes(), 0)');
      await cxp.click('#pane-item [data-act="i:cgrow"][data-v="0:0.05"]');
      await cxp.click('#pane-item [data-act="i:csize"][data-v="2"]');
      const sz = await ss(`[STU.items.get('${nc.id}').rec.size.join(), UNDO.length]`);
      if (sz[0] !== '1.3,1.2,0.8' || sz[1] !== u0 + 3) out.push('the size steps (x + 5 cm, then every side ×2), one Undo step each: ' + JSON.stringify(sz));
      await cxp.click('#pane-item [data-act="i:preview"][data-v="whole"]');
      await frames(2);
      const pw = await ss(`[STU.whole.has('${nc.id}'), STUDIO.cut('${nc.id}').cutting, UNDO.length]`);
      await ss('(renderPanes(), 0)');
      await cxp.click('#pane-item [data-act="i:preview"][data-v="cut"]');
      await frames(2);
      const pc = await ss(`[STU.whole.has('${nc.id}'), STUDIO.cut('${nc.id}').cutting, UNDO.length]`);
      await ss('(renderPanes(), 0)');
      await cxp.click('#pane-item [data-act="i:preview"][data-v="seen"]');
      await frames(2);
      const pa = await ss(`[STU.whole.has('${nc.id}') || STU.cutF.has('${nc.id}'), STUDIO.cut('${nc.id}').cutting, UNDO.length]`);
      if (!pw[0] || pw[1] || pw[2] !== u0 + 3 || pc[0] || !pc[1] || pc[2] !== u0 + 3 || pa[0] || !pa[1] || pa[2] !== u0 + 3) out.push('Preview: whole (this device, no Undo step), then cut, then as seen: ' + JSON.stringify({ pw, pc, pa }));
      // the Items pane: each object's cut-outs as tags on its card (no cards of their own)
      await ss(`(X.tab = 'items', renderPanes(), 0)`);
      const tags = await cxp.evaluate(() => [...document.querySelectorAll('#pane-items .stu-ic[data-card="wal001"] .tag')].map(t => t.dataset.v)), own = await cxp.evaluate(() => [...document.querySelectorAll('#pane-items .stu-ic')].map(c => c.dataset.card));
      if (tags.length !== 2 || !tags.includes('dor001') || !tags.includes(nc.id) || own.includes('dor001') || own.includes(nc.id)) out.push('the Items pane: the wall\'s cut-outs as tags on its card: ' + JSON.stringify({ tags, own }));
      // the arrows: sized per side and turned, in the wall's frame (the wall is not turned)
      const tc = await ss(`(() => {
        const x = STU.items.get('${nc.id}'), u = UNDO.length; select('${nc.id}'); tcSetMode('scale');
        GL.tc.dispatchEvent({ type: 'dragging-changed', value: true }); x.holder.scale.set(1, 0.5, 0.2); GL.tc.dispatchEvent({ type: 'objectChange' }); GL.tc.dispatchEvent({ type: 'dragging-changed', value: false });
        const a = x.rec.size.join();
        tcSetMode('rotate');
        GL.tc.dispatchEvent({ type: 'dragging-changed', value: true }); x.holder.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5); GL.tc.dispatchEvent({ type: 'objectChange' }); GL.tc.dispatchEvent({ type: 'dragging-changed', value: false });
        const q = x.rec.q.map(v => +v.toFixed(3)).join(), sp = GL.tc.space;
        tcSetMode('translate');
        return [a, q, sp, UNDO.length - u];
      })()`);
      if (tc[0] !== '1,0.5,0.2' || tc[1] !== '0.247,0,0,0.969' || tc[2] !== 'local' || tc[3] !== 2) out.push('the arrows: sized per side, turned in its own frame, one Undo step each: ' + JSON.stringify(tc));
      // onto another object: where it stands kept
      const mv = await ss(`(() => { const c0 = STUDIO.cut('${nc.id}').corners, u = UNDO.length; itemAct('cutPick', null, '${nc.id}'); const picking = STU.cutTo; pressItem('boxb01'); itemsStep(0, performance.now()); const c1 = STUDIO.cut('${nc.id}').corners;
        return [picking, STU.items.get('${nc.id}').rec.on, +window.__cx.far(c0, c1).toFixed(5), UNDO.length - u, STU.cutTo]; })()`);
      if (mv[0] !== nc.id || mv[1] !== 'boxb01' || mv[2] > 0.001 || mv[3] !== 1 || mv[4] !== '') out.push('Move onto another object (the click on Box B), where it stands kept: ' + JSON.stringify(mv));
      await ss('undo()');
      // Delete on its card, then Undo
      await ss(`(select('${nc.id}'), X.tab = 'item', renderPanes(), 0)`);
      const r0 = await ss(`JSON.stringify(STU.items.get('${nc.id}').rec)`);
      await cxp.click('#pane-item [data-act="i:del"]');
      const gone = await ss(`!STU.items.has('${nc.id}')`);
      await ss('undo()');
      const back = await ss(`STU.items.has('${nc.id}') && JSON.stringify(STU.items.get('${nc.id}').rec) === ${JSON.stringify(r0)}`);
      if (!gone || !back) out.push('Delete on its card, then Undo: ' + JSON.stringify({ gone, back }));
      // the wall deleted takes its cut-outs (and the cube's list loses its door), one Undo step brings all back; the wall
      // duplicated copies them onto the copy
      const dw = await ss(`(() => {
        const u = UNDO.length; deleteItem('wal001');
        const after = [STU.items.has('wal001'), STU.items.has('dor001'), STU.items.has('${nc.id}'), STU.items.get('cub001').rec.show.join(), UNDO.length - u];
        undo();
        const undone = [STU.items.has('wal001'), STU.items.has('dor001'), STU.items.has('${nc.id}'), STU.items.get('cub001').rec.show.join()];
        const nid = duplicateItem('wal001'), copies = cutsOn(nid).map(x => [x.rec.name, JSON.stringify(x.rec.p), JSON.stringify(x.rec.size)]).sort();
        const mine = cutsOn('wal001').map(x => [x.rec.name.replace(/ \\d+$/, ''), JSON.stringify(x.rec.p), JSON.stringify(x.rec.size)]).sort();
        undo();
        return { after, undone, copies: copies.map(c => c[1] + c[2]).join(), mine: mine.map(c => c[1] + c[2]).join(), n: copies.length, left: STU.items.size };
      })()`);
      if (dw.after.join() !== 'false,false,false,,1' || dw.undone.join() !== 'true,true,true,dor001' || dw.n !== 2 || dw.copies !== dw.mine) out.push('the wall deleted with its cut-outs (Undo), duplicated with them: ' + JSON.stringify(dw));
      await ss(`(deleteItem('${nc.id}'), 0)`);
    }
    // the Add pane: nothing selected, the button says to select a model; the wall selected, a cut-out on it
    const add = await ss(`(() => {
      select(''); X.tab = 'add'; renderPanes();
      const b0 = document.querySelector('#pane-add [data-act="cutbox"]'), a = [b0 && b0.textContent, b0 && b0.disabled];
      select('wal001'); X.tab = 'add'; renderPanes();
      const b1 = document.querySelector('#pane-add [data-act="cutbox"]'), n0 = cutsOn('wal001').length;
      b1.click();
      const r = [a[0], a[1], b1.textContent, b1.disabled, cutsOn('wal001').length - n0, STU.items.get(STU.sel).kind];
      undo(); select('');
      return r;
    })()`);
    if (add.join() !== 'Cut-out box: select a model first,true,Cut-out box on Wall,false,1,x') out.push('the Add pane\'s Cut-out box: ' + JSON.stringify(add));
    if (await ss('unsaved()')) out.push('the layout did not come back after the card\'s checks: ' + JSON.stringify(await ss('keyOf()')).slice(0, 400));
    bad(out);
  });

  await step('studio cuts: the pointer finds a nearer object before a cut-out, a cut-out before its own object, and passes cut-outs in a pick; Preview Cut opens the door its cube hides; a new cut-out cuts at its first frame; 17 on one model: the 16 lowest ids; copies join their cubes; sizing held at the limits, said', async () => {
    await ss(`(setEdit(true), STU.head = null, select(''), 0)`);
    // (the wall and its door seen while editing: put back by the card's Undo just now, they fade in over 0.4 s)
    await until(`STU.items.get('dor001').sa < 0.01 && !STUDIO.cut('dor001').cutting && STU.items.get('wal001').a > 0.99 && STU.items.get('dor001').a > 0.99 && !!STU.items.get('wal001').model`, 5000);
    const r = await ss(`(() => {
      const out = {}, V = (a, b, c) => new THREE.Vector3(a, b, c), step = () => itemsStep(0, performance.now()), u0 = UNDO.length;
      step();
      GL.world.updateMatrixWorld(true);
      const pick = (o, d) => { const rc = new THREE.Raycaster(GL.items.localToWorld(V(...o)), V(...d).transformDirection(GL.items.matrixWorld)); const h = rayPick(rc); return h ? h.id : ''; };
      // a thin box inside the wall (its faces behind the wall's): the ray meets the wall's unseen box first, then it
      const tid = newId();
      change(() => putItem(tid, 'x', norm('x', { name: 'Thin', on: 'wal001', p: [-0.8, 1, 0], size: [0.5, 0.5, 0.1] })));
      STU.items.get(tid).a = 1; step();
      out.tid = tid; out.own = pick([-0.8, 1, 1], [0, 0, -1]);
      STU.cutTo = 'dor001'; out.pickMode = pick([-0.8, 1, 1], [0, 0, -1]); STU.cutTo = '';
      // Box B moved in front of the door: found first; then the door through its own wall
      const b = STU.items.get('boxb01'), bb = objBox(b).getCenter(V());
      change(() => setObj('boxb01', { p: [b.rec.p[0] + 0.6 - bb.x, b.rec.p[1] + 1 - bb.y, b.rec.p[2] - 1.5 - bb.z] })); step();
      out.front = pick([0.6, 1, 1], [0, 0, -1]);
      undo(); step();
      out.door = pick([0.6, 1, 1], [0, 0, -1]);
      // Preview Cut: the door its cube hides from nobody's head cuts here while editing; As seen, it does not; editing
      // off forgets it
      out.hidden = [STU.items.get('dor001').shown, STUDIO.cut('dor001').cutting];
      itemAct('preview', 'cut', 'dor001'); step(); out.forced = STUDIO.cut('dor001').cutting;
      itemAct('preview', 'seen', 'dor001'); step(); out.seen = STUDIO.cut('dor001').cutting;
      itemAct('preview', 'cut', 'dor001'); setEdit(false); step(); out.off = [STU.cutF.size, STUDIO.cut('dor001').cutting]; setEdit(true);
      // a new cut-out cuts at its first frame (no half fade to wait for), and one put back by Undo too
      const nid = addCut('boxb01'); step(); out.fresh = STUDIO.cut(nid).cutting;
      deleteItem(nid); undo(); step(); out.back = STUDIO.cut(nid).cutting;
      undo(); undo(); step();
      // 17 on one model (as a room may bring), made in the reverse order of their ids: the 16 lowest cut, the 17th not
      const ids = Array.from({ length: 17 }, (_, k) => 'qq' + String(16 - k).padStart(4, '0'));
      change(() => { for (const id of ids) putItem(id, 'x', norm('x', { name: 'Many', on: 'boxb01', p: [0, 0.1, 0], size: [0.05, 0.05, 0.05] })); });
      step();
      const c = STUDIO.cut('qq0000'), top = STUDIO.cut('qq0016');
      out.many = [c.list.length, c.list.join() === ids.slice().reverse().slice(0, 16).join(), top.cutting, !!STU.items.get('qq0016').over, cutWords(STU.items.get('qq0016'), STU.items.get('boxb01'))];
      undo(); step();
      // a cut-out's copy, and the wall's copy's door, in the cube's list as their originals are
      const dc = duplicateCut(STU.items.get('dor001')); out.dup = STU.items.get('cub001').rec.show.includes(dc); undo();
      const wc = duplicateItem('wal001'), wd = cutsOn(wc).find(x => /^Door/.test(x.rec.name));
      out.dupWall = !!wd && STU.items.get('cub001').rec.show.includes(wd.id); undo(); step();
      // sizing a model held at the limits: a cut-out of 30 m sides on Box B, Box B twice the size: 50 m, said on its card
      const big = newId();
      change(() => putItem(big, 'x', norm('x', { name: 'Big', on: 'boxb01', p: [0, 0.1, 0], size: [30, 30, 30] })));
      itemAct('size', 2, 'boxb01'); step();
      select('boxb01'); X.tab = 'item'; renderPanes();
      out.held = [STU.items.get(big).rec.size.join(), /Big is held at the limit/.test(document.querySelector('#pane-item').textContent)];
      undo(); undo(); select(''); X.tab = 'scene'; step();
      out.left = [UNDO.length - u0, STU.cutF.size, STU.whole.size];
      return out;
    })()`).catch(e => ({ err: e.message }));
    const out = [];
    if (r.err) out.push(r.err);
    else {
      if (r.own !== r.tid || r.pickMode !== 'wal001' || r.front !== 'boxb01' || r.door !== 'dor001') out.push('the pointer: a cut-out before its own wall, the wall in a pick, Box B in front of the door first, the door through its wall: ' + JSON.stringify([r.own, r.pickMode, r.front, r.door]));
      if (r.hidden.join() !== 'false,false' || !r.forced || r.seen || r.off.join() !== '0,false') out.push('Preview Cut on the door its cube hides: ' + JSON.stringify([r.hidden, r.forced, r.seen, r.off]));
      if (!r.fresh || !r.back) out.push('a new cut-out (and one put back by Undo) cuts at its first frame: ' + JSON.stringify([r.fresh, r.back]));
      if (r.many[0] !== 16 || !r.many[1] || r.many[2] || !r.many[3] || !/16 at most/.test(r.many[4])) out.push('17 on one model: the 16 lowest ids cut, the 17th drawn as cutting nothing: ' + JSON.stringify(r.many));
      if (!r.dup || !r.dupWall) out.push('a cut-out\'s copy (and the wall\'s copy\'s door) in the cube\'s list: ' + JSON.stringify([r.dup, r.dupWall]));
      if (r.held[0] !== '50,50,50' || !r.held[1]) out.push('sizing held at the limit (50 m), said on the card: ' + JSON.stringify(r.held));
      if (r.left[0] !== 0 || r.left[1] || r.left[2]) out.push('left behind: ' + JSON.stringify(r.left));
    }
    if (await ss('unsaved()')) out.push('the layout did not come back after these checks');
    bad(out);
  });

  await step('studio cuts: a pretend headset\'s grip carries a cut-out (turning with the hand, moving freely), both grips size it, a corner stretches it (the opposite corner kept); the headset\'s card has its rows', async () => {
    const r = await ss(`(() => {
      const out = {}, x = STU.items.get('dor001'), step = () => itemsStep(0, performance.now()), V = (a, b, c) => new THREE.Vector3(a, b, c);
      setEdit(true); select('dor001'); step();
      const free = XR.free; XR.on = true; XR.clear = true; XR.free = true; GL.world.updateMatrixWorld(true);
      const [a, b] = XR.ctrls, ctl = (c, p, q) => { c.src = { targetRayMode: 'tracked-pointer', handedness: c === a ? 'right' : 'left', gamepad: null }; c.g.visible = true; c.g.matrix.compose(V(...p), q || new THREE.Quaternion(), V(1, 1, 1)); c.o.setFromMatrixPosition(c.g.matrix); };
      const pos = () => x.holder.getWorldPosition(V()), u0 = UNDO.length;
      // held at its middle: carried 0.3 m to the side, then turned a quarter about the upright with the hand
      const w0 = pos(); ctl(a, [w0.x, w0.y, w0.z]); a.hover = { kind: 'item', id: 'dor001' }; xrGrab(a, true);
      ctl(a, [w0.x + 0.3, w0.y, w0.z]); carry(a, 0.016);
      ctl(a, [w0.x + 0.3, w0.y, w0.z], new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2)); carry(a, 0.016);
      xrGrab(a, false); step();
      const yaw = 2 * Math.atan2(x.rec.q[1], x.rec.q[3]);
      out.carry = [+(pos().x - w0.x).toFixed(3), +(pos().z - w0.z).toFixed(3), +yaw.toFixed(3), x.rec.size.join(), UNDO.length - u0];
      undo(); step();
      // both grips, 0.2 m apart, then 0.4: every side twice the size
      const c = pos();
      ctl(a, [c.x - 0.1, c.y, c.z + 0.5]); a.hover = { kind: 'item', id: 'dor001' }; xrGrab(a, true);
      ctl(b, [c.x + 0.1, c.y, c.z + 0.5]); b.hover = { kind: 'item', id: 'dor001' }; xrGrab(b, true);
      carry(a, 0.016); carry(b, 0.016);
      ctl(a, [c.x - 0.2, c.y, c.z + 0.5]); ctl(b, [c.x + 0.2, c.y, c.z + 0.5]); carry(a, 0.016); carry(b, 0.016);
      xrGrab(b, false); xrGrab(a, false); step();
      out.two = [x.rec.size.join(), UNDO.length - u0];
      undo(); step();
      // a corner (its +x, +y, +z one): pulled 0.2 m out in x; the opposite corner stays
      select('dor001'); step();
      const C = () => STUDIO.cut('dor001').corners, opp0 = C()[0], k0 = C()[7], kw = GL.items.localToWorld(V(...k0));
      ctl(a, [kw.x, kw.y, kw.z]); a.hover = { kind: 'item', id: 'dor001', corner: 7 }; xrGrab(a, true);
      ctl(a, [kw.x + 0.2, kw.y, kw.z]); carry(a, 0.016); xrGrab(a, false); step();
      const opp1 = C()[0];
      out.corner = [x.rec.size.join(), +Math.hypot(...opp0.map((v, i) => v - opp1[i])).toFixed(5), UNDO.length - u0];
      undo(); step();
      // the headset's card: its rows, and Preview: whole pressed there
      const draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } };
      const ids = () => { const seen = new Set(); for (let off = 0; off < 4000; off += 150) { X.scroll.item = off; draw(); for (const r of XR.main.regions) seen.add(r.id); } X.scroll = {}; draw(); return seen; };
      const press = id => { for (let off = 0; off < 4000; off += 150) { X.scroll.item = off; draw(); const r = XR.main.regions.find(q => q.id === id); if (r && r.fn) { r.fn(); X.scroll = {}; draw(); return true; } } X.scroll = {}; return false; };
      select('dor001'); X.tab = 'item'; X.scroll = {}; draw();
      const I = ids(), want = ['cutto', 'cgrow:0:-', 'cgrow:2:+', 'csize:2', 'turn', 'preview:seen', 'preview:cut', 'preview:whole', 'dup', 'del'];
      out.miss = want.filter(i => !I.has(i));
      out.whole = [press('preview:whole'), STU.whole.has('dor001')];
      press('preview:seen');
      for (const c of XR.ctrls) { c.src = null; c.g.visible = false; c.hover = null; c.grab = null; }
      XR.on = false; XR.free = free; select(''); X.tab = 'scene'; renderPanes();
      return out;
    })()`).catch(e => ({ err: e.message }));
    const out = [];
    if (r.err || r.carry[0] !== 0.3 || Math.abs(r.carry[1]) > 0.002 || Math.abs(Math.abs(r.carry[2]) - Math.PI / 2) > 0.01 || r.carry[3] !== '0.8,2,0.4' || r.carry[4] !== 1) out.push('carried by the grip, turning with the hand: ' + JSON.stringify(r.carry || r));
    else if (r.two[0] !== '1.6,4,0.8' || r.two[1] !== 1) out.push('both grips: every side twice: ' + JSON.stringify(r.two));
    else if (r.corner[0] !== '1,2,0.4' || r.corner[1] > 0.001 || r.corner[2] !== 1) out.push('a corner stretched (x 0.2 m longer), the opposite corner kept: ' + JSON.stringify(r.corner));
    if (!r.err && (r.miss.length || !r.whole[0] || !r.whole[1])) out.push('the headset\'s card: ' + JSON.stringify({ miss: r.miss, whole: r.whole }));
    if (await ss('unsaved()')) out.push('the layout did not come back after the headset\'s checks');
    bad(out);
  });
  await step('studio cuts: no see-through fill while editing (v125, the frame rate): a cut-out draws only its dashed edges, its ticks, its name and (selected) its corners, its box unseen; pointed at or selected its edges light up (lighter, denser dashes, ticks a third of each edge long); a pixel inside the box the same with its box drawn as without, plain, pointed at and selected (pixels)', async () => {
    const r = await ss(`(() => {
      const o = [], J = JSON.stringify, step = () => itemsStep(0.1, performance.now()), settle = () => { for (let i = 0; i < 12; i++) step(); };
      setEdit(true); select(''); STU.hover = ''; STU.cutF.add('dor001'); settle();   // (previewed cut: the door cuts its hole, drawn at full strength)
      const x = STU.items.get('dor001'), L = x.look, pos = L.ticks.geometry.attributes.position;
      // what it draws: no mesh with a material that shows (its unseen box only), no fill at all
      const shown = []; x.holder.traverse(n => { if (n.isMesh && n.material.visible !== false) shown.push(n.uuid); });
      if (shown.length || 'fill' in L || !x.holder.visible || !L.line.visible || !L.ticks.visible || !pickables().includes(L.hit)) o.push('drawn: ' + J({ meshes: shown.length, fill: 'fill' in L, vis: [x.holder.visible, L.line.visible, L.ticks.visible] }));
      const tick = () => { const P = L.ticks.geometry.attributes.position; return Math.round(Math.hypot(P.getX(1) - P.getX(0), P.getY(1) - P.getY(0), P.getZ(1) - P.getZ(0)) * 1000) / 1000; };
      const lookNow = () => ({ col: L.line.material.color.getHexString(), dash: L.line.material.dashSize, gap: L.line.material.gapSize, tick: tick(), op: Math.round(L.line.material.opacity * 100) / 100, corners: L.corners.filter(c => c.visible).length });
      const plain = lookNow();
      if (plain.col !== 'ff5a36' || plain.dash !== 0.07 || plain.gap !== 0.05 || plain.tick !== 0.2 || plain.op !== 0.75 || plain.corners) o.push('plain: ' + J(plain));
      STU.hover = 'dor001'; step();
      const hot = lookNow();
      if (hot.col === 'ff5a36' || hot.dash !== 0.06 || hot.gap !== 0.02 || hot.tick !== 0.333 || hot.op !== 1 || hot.corners) o.push('pointed at: ' + J(hot));
      STU.hover = ''; select('dor001'); step();
      const sel = lookNow();
      if (sel.col !== hot.col || sel.dash !== 0.06 || sel.tick !== 0.333 || sel.op !== 1 || sel.corners !== 8) o.push('selected: ' + J(sel));
      select(''); step();
      if (J(lookNow()) !== J(plain)) o.push('plain again: ' + J(lookNow()));
      // the pixel at the box's middle (the hole: what is behind the wall), drawn with its box and without, in each look
      const W = 400, H = 250, rd = GL.renderer, rt = new THREE.WebGLRenderTarget(W, H), cam = new THREE.PerspectiveCamera(40, W / H, 0.05, 200);
      GL.world.updateMatrixWorld(true);
      cam.position.copy(GL.items.localToWorld(new THREE.Vector3(0.6, 1.15, -0.4))); cam.lookAt(GL.items.localToWorld(new THREE.Vector3(0.6, 1, -3))); cam.updateMatrixWorld();
      const c = x.holder.getWorldPosition(new THREE.Vector3()).project(cam), px = () => { const b = new Uint8Array(4); rd.setRenderTarget(rt); rd.render(GL.scene, cam); rd.readRenderTargetPixels(rt, Math.round((c.x + 1) / 2 * W), Math.round((c.y + 1) / 2 * H), 1, 1, b); rd.setRenderTarget(null); return [b[0], b[1], b[2]]; };
      const pair = () => { const a = px(); x.holder.visible = L.deco.visible = false; const b = px(); x.holder.visible = L.deco.visible = true; return [a, b]; };
      const d = ([a, b]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
      const seen = { plain: pair() };
      STU.hover = 'dor001'; step(); seen.hot = pair();
      STU.hover = ''; select('dor001'); step(); seen.sel = pair();
      select(''); STU.cutF.delete('dor001'); settle(); rt.dispose();
      for (const [k, v] of Object.entries(seen)) if (d(v) > 3) o.push('the box\\'s middle ' + k + ', with its box and without: ' + J(v));
      return o;
    })()`).catch(e => [e.message]);
    bad(r);
  });

  await step('studio cuts: an object\'s cut-outs locked (v124): its card\'s switch (one Undo step); the door cutting as before, its box hidden and never pointed at; sizing it, deleting it, deleting the wall and a new cut-out on it refused; the card and the Items pane say so; the state and layout.json carry cutsLocked, a bad one refused; a copy\'s not locked; unlocked, its box back', async () => {
    const r = await ss(`(() => {
      const o = [], J = JSON.stringify, step = () => itemsStep(0.1, performance.now()), settle = () => { for (let i = 0; i < 12; i++) step(); };   // (0.1 s a step: the boxes' 0.4 s fade done)
      const w = STU.items.get('wal001'), x = STU.items.get('dor001'), hit = () => pickables().includes(x.look.hit);
      setEdit(true); select('wal001'); settle();
      if (!x.holder.visible || !hit()) o.push('unlocked: the door\\'s box not drawn or not pointable');
      const u0 = UNDO.length, s0 = x.rec.size.join(), c0 = !!x.cutting, n0 = STU.items.size;
      itemAct('cutslock', null, 'wal001'); settle();
      if (w.rec.cutsLocked !== true || UNDO.length !== u0 + 1) o.push('locking: ' + J([w.rec.cutsLocked, UNDO.length - u0]));
      if (x.holder.visible || hit()) o.push('locked: the door\\'s box still drawn or pointable');
      if (!!x.cutting !== c0) o.push('locked: the door stopped or started cutting');
      itemAct('csize', 2, 'dor001'); itemAct('del', null, 'dor001'); itemAct('del', null, 'wal001'); itemAct('cut', null, 'wal001');
      if (x.rec.size.join() !== s0 || STU.items.size !== n0 || !STU.items.get('wal001') || !STU.items.get('dor001') || UNDO.length !== u0 + 1) o.push('locked: sized, deleted or cut: ' + J([x.rec.size, STU.items.size - n0, UNDO.length - u0]));
      select('wal001'); X.tab = 'item'; renderPanes();
      const card = document.querySelector('#pane-item').textContent;
      if (!/Cut-outs locked/.test(card) || card.includes('✂ ' + x.rec.name) || !/cut-outs are locked/.test(card)) o.push('the wall\\'s card while locked: ' + card.slice(0, 300));
      X.tab = 'items'; renderPanes();
      const items = document.querySelector('#pane-items');
      if (!/1 cut-out locked/.test(items.textContent) || items.querySelector('[data-v="dor001"]')) o.push('the Items pane while locked: ' + items.textContent.slice(0, 300));
      const st = collabState(), lay = layoutOut(), lw = (lay.objects || []).find(q => q.id === 'wal001');
      if (!st['o.wal001'] || st['o.wal001'].cutsLocked !== true || !lw || lw.cutsLocked !== true) o.push('state or layout without cutsLocked: ' + J([st['o.wal001'] && st['o.wal001'].cutsLocked, lw && lw.cutsLocked]));
      if (norm('o', Object.assign({}, w.rec, { cutsLocked: 'yes' })) !== null || 'cutsLocked' in norm('o', Object.assign({}, w.rec, { cutsLocked: false }))) o.push('norm: a bad cutsLocked taken, or false kept');
      itemAct('dup', null, 'wal001'); settle();
      const nid = STU.sel, nw = STU.items.get(nid), nx = nw ? cutsOn(nid) : [];
      if (!nw || nw.rec.cutsLocked || !nx.length || !nx.every(c => c.holder.visible)) o.push('a copy: ' + J([nid, nw && nw.rec.cutsLocked, nx.length]));
      undo(); settle();
      itemAct('cutslock', null, 'wal001'); settle();
      if (w.rec.cutsLocked || !x.holder.visible || !hit() || UNDO.length !== u0 + 2) o.push('unlocked: ' + J([w.rec.cutsLocked, x.holder.visible, hit(), UNDO.length - u0]));
      undo(); undo(); select(''); X.tab = 'scene'; renderPanes(); settle();
      if (w.rec.cutsLocked || !x.holder.visible) o.push('undone: still locked');
      return o;
    })()`).catch(e => [e.message]);
    if (await ss('unsaved()')) r.push('the layout did not come back after the cut-out lock\'s checks');
    bad(r);
    await cxp.close();
  });
}
// The studio's groups (tools/studio/SPEC.md, "Groups"), on a page of its own: the rig test scene (tools/studio/test/scenes/rig:
// the dancer, the box, Voice following her head, the cube Curtain) with, put in for these steps, the figure, a sound Free
// (following nothing), a sound Out following the figure, a cut-out Hole on the box and a cube Lamp showing the box and its
// hole. Make a group... and its pick mode (clicks in the scene, Ctrl and Shift too, names under Items); a click on a member
// selects the group, again the member alone; hover names the group; the Items pane; the arrows' move, turn (about the
// vertical only) and size moving every member exactly (places, turns, sizes, a cube's size, the sounds' reach, the hole on
// the box and the sounds on what they follow, within 1 mm), one Undo step each; the card's Turn 90°, size steps, On the
// floor and a size past the limits; Duplicate, Ungroup, Delete and Undo; an item moving into another group, a group left
// with one member going; a cube's pick toggling a whole group; the state and layout.json; a pretend headset's trigger and
// grips, and the headset's cards
if (runs('studio groups')) {
  const gp = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  gp.on('pageerror', e => errors.push('studio groups: ' + (e.stack || e.message)));
  gp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('studio groups: ' + m.text()); });
  const ss = s => gp.evaluate(s => HOST.cur.peek(s), s);
  const until = (src, ms) => gp.waitForFunction(src => HOST.cur.peek(src), src, { timeout: ms || 20000 }).then(() => true, () => false);
  const bad = list => { if (list.length) errors.push(...list.map(b => 'studio groups: ' + b)); };
  // (in the page: every item's record and where it is shown, in the scene's frame; what a move about a pivot should give
  // each member and what it did; a point on the canvas where the pointer finds an item)
  const HELP = `window.__gr = window.__gr || {
    gid: () => { const g = [...STU.items.values()].find(i => i.kind === 'g' && i.rec.name === 'Group'); return g ? g.id : ''; },
    at: () => { itemsStep(0, performance.now()); const o = {}; for (const it of STU.items.values()) o[it.id] = { kind: it.kind, rec: JSON.parse(JSON.stringify(it.rec)), pos: it.holder.position.toArray(), q: it.holder.quaternion.toArray(), corners: it.kind === 'x' ? cutCorners(it) : null, d: it.kind === 's' && STUDIO.follow(it.id) ? STUDIO.follow(it.id).d : 0 }; return o; },
    tf: (x, P, t, th, k) => new THREE.Vector3(...x).sub(new THREE.Vector3(...P)).multiplyScalar(k).applyAxisAngle(new THREE.Vector3(0, 1, 0), th).add(new THREE.Vector3(...P)).add(new THREE.Vector3(...t)).toArray(),
    far: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
    // each member (and the hole on the box) where the move says, the others where they were: what is wrong ([] none)
    check: (a0, a1, P, t, th, k) => {
      const G = window.__gr, out = [], ids = ['box001', 'dan001', 'fre001', 'voi001', 'out001', 'cube01'], mm = 0.0011;
      const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), th);
      for (const id of Object.keys(a0)) {
        const b = a0[id], c = a1[id];
        if (!c) { out.push(id + ' gone'); continue; }
        if (b.kind === 'g') continue;
        if (!ids.includes(id) && id !== 'hol001') { if (G.far(b.pos, c.pos) > 1e-6 || JSON.stringify(b.rec) !== JSON.stringify(c.rec)) out.push(id + ' (not a member) moved'); continue; }
        const want = G.tf(b.pos, P, t, th, k);
        if (b.kind === 'x') { const far = Math.max(...b.corners.map((p, i) => G.far(G.tf(p, P, t, th, k), c.corners[i]))); if (far > mm) out.push(id + "'s corners " + far.toFixed(4) + ' m out'); continue; }
        if (G.far(want, c.pos) > mm) out.push(id + ' at ' + c.pos.map(v => v.toFixed(3)) + ', not ' + want.map(v => v.toFixed(3)));
        if (b.kind === 'o') {
          const q = qy.clone().multiply(new THREE.Quaternion(...b.rec.q).normalize()), ang = q.angleTo(new THREE.Quaternion(...c.rec.q).normalize());
          if (ang > 2e-3) out.push(id + ' turned ' + ang.toFixed(4) + ' rad off');
          if (Math.abs(c.rec.s - b.rec.s * k) > b.rec.s * k * 1e-3) out.push(id + ' sized ' + c.rec.s + ', not ' + b.rec.s * k);
        } else if (b.kind === 'c') {
          const dy = Math.atan2(Math.sin(c.rec.yaw - b.rec.yaw - th), Math.cos(c.rec.yaw - b.rec.yaw - th));
          if (Math.abs(dy) > 2e-4) out.push(id + ' yaw ' + c.rec.yaw);
          if (c.rec.size.some((v, i) => Math.abs(v - b.rec.size[i] * k) > mm)) out.push(id + ' size ' + c.rec.size);
        } else {
          if (Math.abs(c.rec.r - Math.round(b.rec.r * k * 100) / 100) > 0.0051) out.push(id + ' reach ' + c.rec.r + ', not ' + b.rec.r * k);
          if (c.rec.on && c.d > 1e-6) out.push(id + ' not where what it follows puts it (' + c.d + ')');
          if (id === 'voi001' && (c.rec.on !== 'dan001' || c.rec.bone !== b.rec.bone)) out.push('Voice no longer follows her head');
          if (id === 'voi001' && b.rec.o && c.rec.o.some((v, i) => Math.abs(v - b.rec.o[i] * k) > mm)) out.push('Voice offset ' + c.rec.o);
          if (id === 'out001' && c.rec.on !== 'fig001') out.push('Out no longer follows the figure');
        }
      }
      return out;
    },
    // a point on the canvas where the pointer finds the item (its middle, or a little above or below it), null: none
    screen: id => {
      const it = STU.items.get(id), m = itemTopInto(it, new THREE.Vector3(), true);
      GL.world.updateMatrixWorld(true); GL.camera.updateMatrixWorld();
      for (const dy of [0, 0.15, -0.15, 0.3, -0.3, 0.45]) for (const dx of [0, 0.1, -0.1]) {
        const v = GL.items.localToWorld(m.clone().add(new THREE.Vector3(dx, dy, 0))).project(GL.camera), x = Math.round((v.x + 1) / 2 * innerWidth), y = Math.round((1 - v.y) / 2 * innerHeight);
        if (x < 5 || y < 5 || x > innerWidth - 5 || y > innerHeight - 5 || document.elementFromPoint(x, y) !== GL.canvas) continue;
        const h = rayPick(pointerRay(x, y));
        if (h && h.id === id) return [x, y];
      }
      return null;
    },
  }`;

  await step('studio groups: Make a group... on the box\'s card and its pick mode (clicks in the scene, Ctrl and Shift too, names under Items); a click on a member selects the group, again the member alone (In group, Select the group); hover names the group; its box while selected; the Items pane', async () => {
    await gp.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&scene=rig&edit');
    await gp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    if (!await until(`STUDIO.ready() && ['dan001', 'box001'].every(id => STU.items.get(id).model)`, 120000)) { errors.push('studio groups: the rig scene did not load: ' + JSON.stringify(await ss('STUDIO.state()')).slice(0, 400)); return; }
    // (the scene as these steps need it, not as changes: still models, the figure, two more sounds, a hole in the box and a
    // cube outside the group showing the box and its hole)
    await ss(`(${HELP}, setRec('box001', { anim: 'off' }), setRec('dan001', { anim: 'off' }),
      putItem('fig001', 'o', norm('o', { name: 'Figure', file: 'figure.fbx', p: [3, 0, -2], q: [-0.7071, 0, 0, 0.7071], s: 0.01, clip: 'Take 001', anim: 'off' })),
      putItem('fre001', 's', norm('s', { name: 'Free', file: 'voice.wav', p: [0.8, 1.5, -2.6], r: 2 })),
      putItem('out001', 's', norm('s', { name: 'Out', file: 'voice.wav', p: [3, 1.2, -1.7], r: 1.5, on: 'fig001', o: [0, 0.3, 0.2] })),
      putItem('hol001', 'x', norm('x', { name: 'Hole', on: 'box001', p: [0.15, 0.15, 0.15], size: [0.2, 0.2, 0.2] })),
      putItem('lmp001', 'c', norm('c', { name: 'Lamp', p: [-2.5, 1, 0], show: ['box001', 'hol001'] })), X.view = 'orbit', frameScene(false), 0)`);
    if (!await until(`STUDIO.ready() && !!STU.items.get('fig001').model`, 60000)) { errors.push('studio groups: the figure did not load'); return; }
    const out = [], u0 = await ss('UNDO.length');
    // Make a group... on the box's card: a group of the box, picking
    await ss(`(select('box001'), X.tab = 'item', renderPanes(), 0)`);
    await gp.click('#pane-item [data-act="i:mkgroup"]');
    const g0 = await ss(`[!!STU.gpick, STU.gpick && STU.items.get(STU.gpick.id).rec.items.join(), STU.sel === (STU.gpick && STU.gpick.id), window.__gr.gid()]`);
    if (!g0[0] || g0[1] !== 'box001' || !g0[2] || !g0[3]) out.push('Make a group... made no group of the box, picking: ' + JSON.stringify(g0));
    // the dancer (Ctrl-click) and Free (Shift-click) in the scene
    await gp.waitForTimeout(300);
    for (const [id, key] of [['dan001', 'Control'], ['fre001', 'Shift']]) {
      const xy = await ss(`window.__gr.screen('${id}')`);
      if (!xy) { out.push(`no point on the canvas finds ${id}`); continue; }
      await gp.keyboard.down(key); await gp.mouse.click(xy[0], xy[1]); await gp.keyboard.up(key);
    }
    // Voice, Out and Curtain by their names under Items, then Done
    await ss(`(X.tab = 'items', renderPanes(), 0)`);
    for (const id of ['voi001', 'out001', 'cube01']) await gp.click(`#pane-items .stu-ic .cm[data-act="gtog"][data-v="${id}"]`);
    await gp.click('#pane-items [data-act="gpickdone"]');
    const g1 = await ss(`(() => { const g = STU.items.get(window.__gr.gid()); return [JSON.stringify(g.rec), STU.gpick, STU.sel === g.id, UNDO.length]; })()`);
    if (g1[0] !== '{"name":"Group","items":["box001","dan001","fre001","voi001","out001","cube01"]}' || g1[1] || !g1[2] || g1[3] - u0 !== 6) out.push('the group picked (one Undo step each): ' + JSON.stringify(g1));
    // a click on a member: the group; again: that member alone, its card saying so; Select the group
    await ss(`(select(''), X.tab = 'scene', renderPanes(), 0)`);
    const xy = await ss(`window.__gr.screen('dan001')`);
    if (xy) {
      await gp.mouse.click(xy[0], xy[1]);
      const s1 = await ss('STU.sel');
      await gp.waitForTimeout(250);
      await gp.mouse.click(xy[0], xy[1]);
      const s2 = await ss('STU.sel');
      await ss(`(X.tab = 'item', renderPanes(), 0)`);
      const card = await gp.textContent('#pane-item');
      await gp.click('#pane-item [data-act="sel"][data-v="' + await ss('window.__gr.gid()') + '"]');
      const s3 = await ss('STU.sel'), gid = await ss('window.__gr.gid()');
      if (s1 !== gid || s2 !== 'dan001' || !/In group Group/.test(card) || !/Select the group/.test(card) || !/Make a new group/.test(card) || s3 !== gid) out.push('a click on a member, then again, then Select the group: ' + JSON.stringify([s1, s2, s3, gid, card.slice(0, 160)]));
      // hover (nothing selected, so no arrows in the way): the group's name and the member's
      await ss(`(select(''), 0)`);
      await gp.mouse.move(xy[0] + 1, xy[1] + 1);
      if (!await until(`STU.hover === 'dan001' && /Group · Dancer/.test(LBL.extra[0].el.textContent)`, 5000)) out.push('hovering the dancer does not name her group: ' + await ss('[STU.hover, LBL.extra[0].el.textContent]'));
    } else out.push('no point on the canvas finds the dancer');
    // its box while selected and editing; nothing of it with editing off
    const box = await ss(`(() => { const g = STU.items.get(window.__gr.gid()); select(g.id); itemsStep(0, performance.now()); const on = g.look.deco.visible, s = g.look.box.scale.toArray(); setEdit(false); itemsStep(0, performance.now()); const off = g.look.deco.visible; setEdit(true); select(g.id); itemsStep(0, performance.now()); return [on, off, s.every(v => v > 0.3)]; })()`);
    if (!box[0] || box[1] || !box[2]) out.push('its box: shown selected, not with editing off: ' + JSON.stringify(box));
    // the Items pane: the group's heading, its members' cards under it, the box's hole a tag on the box's card
    const rows = await ss(`(X.tab = 'items', renderPanes(), [...document.querySelectorAll('#pane-items .stu-gh, #pane-items .stu-ic .cm, #pane-items .stu-ic .tag')].map(e => (e.classList.contains('stu-gh') ? 'h:' : e.classList.contains('tag') ? 't:' : '') + e.dataset.v).join(' '))`);
    const gid = await ss('window.__gr.gid()');
    if (!rows.startsWith(`h:${gid} box001 t:hol001 dan001 fre001 voi001 out001 cube01 `) || / dan001 .* dan001 /.test(rows + ' ')) out.push('the Items pane: ' + rows);
    if (!/Groups/.test(await gp.textContent('#pane-items'))) out.push('the Items pane has no Groups heading');
    // Make a group... then Done with only that item: as if never pressed (its step taken back)
    const one = await ss(`(() => { const u = UNDO.length; select('fig001'); itemAct('mkgroup'); const made = !!STU.gpick; gpickEnd(); return [made, UNDO.length - u, [...STU.items.values()].filter(i => i.kind === 'g').length]; })()`);
    if (!one[0] || one[1] !== 0 || one[2] !== 1) out.push('Make a group... and Done with one item: ' + JSON.stringify(one));
    // a group picking its one member is left out of layout.json and of Unsaved changes (a saved layout reads back as it was
    // saved); Undo of the pick that gave it its second member, after Done or while picking, leaves it picking again (made
    // just now: Done then takes it back as if never made), never a lone group left behind
    const und = await ss(`(() => {
      const u = UNDO.length, gs = () => [...STU.items.values()].filter(i => i.kind === 'g'), k0 = keyOf(), out = {};
      select('fig001'); itemAct('mkgroup'); const g2 = STU.gpick.id;
      const Lo = layoutOut(); out.lone = [Lo.groups.length, keyOf() === k0, readLayout(JSON.parse(JSON.stringify(Lo))).bad];
      groupToggle(g2, 'lmp001'); gpickEnd();
      out.done = [members(STU.items.get(g2)).length, !!STU.gpick];
      undo(); const G = STU.gpick;
      out.after = [STU.items.has(g2), members(STU.items.get(g2) || {}).length, !!G && G.id === g2 && G.made && G.step === UNDO[UNDO.length - 1], STU.sel === g2];
      gpickEnd(); out.gone = [STU.items.has(g2), gs().length, UNDO.length - u];
      select('fig001'); itemAct('mkgroup'); const g3 = STU.gpick.id; groupToggle(g3, 'lmp001'); undo();
      out.picking = [!!STU.gpick && STU.gpick.id === g3, members(STU.items.get(g3) || {}).length];
      gpickEnd(); out.gone2 = [STU.items.has(g3), gs().length, UNDO.length - u, keyOf() === k0];
      return out;
    })()`);
    if (JSON.stringify(und.lone) !== '[1,true,0]' || JSON.stringify(und.done) !== '[2,false]' || JSON.stringify(und.after) !== '[true,1,true,true]' || JSON.stringify(und.gone) !== '[false,1,0]' || JSON.stringify(und.picking) !== '[true,1]' || JSON.stringify(und.gone2) !== '[false,1,0,true]') out.push('a lone group in the layout, and Undo of a pick: ' + JSON.stringify(und));
    await ss(`(select(''), X.tab = 'scene', renderPanes(), 0)`);
    bad(out);
  });

  await step('studio groups: the arrows move, turn (about the vertical only) and size the group about its pivot: every member exactly (places, turns, sizes, the cube, the sounds\' reach; the hole on the box, Voice on her head, Out on the figure outside the group), one Undo step each; Turn 90°, ×2 and On the floor on its card; a size past the limits said', async () => {
    const r = await ss(`(() => {
      const G = window.__gr, gid = G.gid(), g = STU.items.get(gid), out = {};
      select(gid); tcSetMode('translate');
      const P = groupBase(g).P.toArray();
      const drag = f => { const u = UNDO.length; GL.tc.dispatchEvent({ type: 'dragging-changed', value: true }); f(g.holder); GL.tc.dispatchEvent({ type: 'objectChange' }); GL.tc.dispatchEvent({ type: 'dragging-changed', value: false }); return UNDO.length - u; };
      out.attached = GL.tc.object === g.holder;
      const a0 = G.at(), s0 = JSON.stringify(collabState());
      out.move = [drag(h => h.position.add(new THREE.Vector3(0.5, 0.2, -0.3))), G.check(a0, G.at(), P, [0.5, 0.2, -0.3], 0, 1)];
      undo(); out.back1 = JSON.stringify(collabState()) === s0;
      tcSetMode('rotate'); out.yOnly = [GL.tc.showX, GL.tc.showY, GL.tc.showZ];
      out.turn = [drag(h => h.quaternion.setFromEuler(new THREE.Euler(0.3, 0.6, 0.2, 'YXZ'))), G.check(a0, G.at(), P, [0, 0, 0], 0.6, 1)];
      // (the pivot stays where it was turned about: the next turn or size goes about the same point)
      out.piv = [groupBase(g).P.distanceTo(new THREE.Vector3(...P))];
      itemAct('turn'); out.piv.push(groupBase(g).P.distanceTo(new THREE.Vector3(...P))); undo();
      undo(); out.back2 = JSON.stringify(collabState()) === s0;
      tcSetMode('scale');
      out.size = [drag(h => h.scale.set(1.5, 1, 1)), G.check(a0, G.at(), P, [0, 0, 0], 0, 1.5)];
      out.piv.push(groupBase(g).P.distanceTo(new THREE.Vector3(...P)));
      undo(); out.back3 = JSON.stringify(collabState()) === s0;
      tcSetMode('translate');
      // the card: Turn 90°, ×2, then On the floor (lifted first)
      X.tab = 'item'; renderPanes();
      document.querySelector('#pane-item [data-act="i:turn"]').click(); out.c90 = G.check(a0, G.at(), P, [0, 0, 0], Math.PI / 2, 1); undo();
      document.querySelector('#pane-item [data-act="i:size"][data-v="2"]').click(); out.c2 = G.check(a0, G.at(), P, [0, 0, 0], 0, 2); undo();
      // (Curtain centred on the floor first: On the floor goes by the group's objects, not a cube's volume)
      change(() => setRec('cube01', { p: [0, 0, 2] })); const m0 = groupBox(g, new THREE.Box3(), true).min.y;
      drag(h => h.position.y += 0.4); const lo = groupBox(g, new THREE.Box3(), true).min.y; renderPanes();
      document.querySelector('#pane-item [data-act="i:floor"]').click(); out.floor = [+(lo - m0).toFixed(3), +groupBox(g, new THREE.Box3(), true).min.y.toFixed(4), +(STU.items.get('cube01').rec.p[1] + m0).toFixed(4)]; undo(); undo(); undo();
      out.back4 = JSON.stringify(collabState()) === s0;
      // past the limits: ×20 holds Free's and Out's reach at 20 m, and the card says so
      itemAct('size', 20); out.lim = [STU.items.get('fre001').rec.r, STU.items.get('out001').rec.r, STU.items.get('voi001').rec.r, g.note]; renderPanes(); out.limCard = /held at the limit/.test(document.querySelector('#pane-item').textContent); undo();
      out.back5 = JSON.stringify(collabState()) === s0 && !g.note;
      // ×400: a place past 1 km is held there (Curtain), so every member is written (none left behind), and said
      itemAct('size', 20); itemAct('size', 20);
      const R = id => STU.items.get(id).rec;
      out.far = [R('dan001').s, R('box001').s, R('cube01').size[0], Math.max(...['box001', 'dan001', 'fre001', 'out001', 'cube01'].map(id => Math.max(...R(id).p.map(Math.abs)))), /1 km/.test(g.note) && /Curtain/.test(g.note)];
      undo(); undo(); out.back6 = JSON.stringify(collabState()) === s0;
      return out;
    })()`).catch(e => ({ err: e.message }));
    const out = [];
    if (r.err) { bad(['the arrows: ' + r.err]); return; }
    if (!r.attached) out.push('the arrows are not on the group\'s pivot');
    for (const k of ['move', 'turn', 'size']) if (r[k][0] !== 1 || r[k][1].length) out.push(`${k} with the arrows (one Undo step, every member exactly): ` + JSON.stringify(r[k]));
    if (JSON.stringify(r.yOnly) !== '[false,true,false]') out.push('turning shows the vertical ring only: ' + JSON.stringify(r.yOnly));
    if (r.c90.length || r.c2.length) out.push('the card\'s Turn 90° and ×2: ' + JSON.stringify([r.c90, r.c2]));
    if (Math.abs(r.floor[0] - 0.4) > 0.002 || Math.abs(r.floor[1]) > 0.001 || Math.abs(r.floor[2]) > 0.002) out.push('On the floor (lifted 0.4 m first, Curtain centred on the floor): ' + JSON.stringify(r.floor));
    if (r.piv.length !== 3 || r.piv.some(d => d > 0.002)) out.push('the pivot after a turn of 0.6 rad, a quarter turn more and a size (kept where it was turned about): ' + JSON.stringify(r.piv));
    if (r.far[0] !== 400 || r.far[1] !== 400 || r.far[2] !== 100 || r.far[3] !== 1000 || !r.far[4] || !r.back6) out.push('×400: every member written, a place held at 1 km and said: ' + JSON.stringify([r.far, r.back6]));
    if (r.lim[0] !== 20 || r.lim[1] !== 20 || r.lim[2] !== 20 || !/Free/.test(r.lim[3]) || !/Out/.test(r.lim[3]) || /Voice/.test(r.lim[3]) || !r.limCard) out.push('×20: the reach held at 20 m and said: ' + JSON.stringify(r.lim));
    if (!r.back1 || !r.back2 || !r.back3 || !r.back4 || !r.back5) out.push('Undo did not bring the scene back: ' + JSON.stringify([r.back1, r.back2, r.back3, r.back4, r.back5]));
    bad(out);
  });

  await step('studio groups: Duplicate (copies beside it, Voice\'s copy on the dancer\'s copy, Out\'s still on the figure, Curtain\'s copy hiding the dancer\'s copy, the copies in Lamp\'s list, the hole\'s copy on the box\'s copy), Ungroup, Delete and Undo; one moving into another group; a group left with one member going', async () => {
    const r = await ss(`(() => {
      const G = window.__gr, gid = G.gid(), g = STU.items.get(gid), out = {}, s0 = JSON.stringify(collabState()), K = v => JSON.stringify(Object.keys(v).sort().map(k => [k, v[k]]));
      const k0 = K(collabState()), n0 = STU.items.size, a0 = G.at(), b = groupBox(g, new THREE.Box3()), dx = r3(b.max.x - b.min.x + 0.5), u0 = UNDO.length;
      select(gid); X.tab = 'item'; renderPanes();
      document.querySelector('#pane-item [data-act="i:dup"]').click();
      const nid = STU.sel, ng = STU.items.get(nid), ms = members(ng), by = n => ms.find(m => m.rec.name === n);
      const bx = by('Box 2'), dn = by('Dancer 2'), vo = by('Voice 2'), ou = by('Out 2'), cu = by('Curtain 2'), fr = by('Free 2');
      out.dup = [ng && ng.kind, ng && ng.rec.name, ms.length, STU.items.size - n0, UNDO.length - u0];
      if (bx && dn && vo && ou && cu && fr) {
        const hc = cutsOn(bx.id)[0];
        itemsStep(0, performance.now());
        out.copies = [
          G.far(bx.rec.p, [a0.box001.rec.p[0] + dx, a0.box001.rec.p[1], a0.box001.rec.p[2]]) < 1e-6, !!hc && hc.rec.on === bx.id && JSON.stringify(hc.rec.size) === JSON.stringify(a0.hol001.rec.size),
          vo.rec.on === dn.id && vo.rec.bone === a0.voi001.rec.bone && JSON.stringify(vo.rec.o) === JSON.stringify(a0.voi001.rec.o),
          ou.rec.on === 'fig001' && G.far(ou.holder.position.toArray(), [a0.out001.pos[0] + dx, a0.out001.pos[1], a0.out001.pos[2]]) < 0.0011,
          JSON.stringify(cu.rec.hide) === JSON.stringify([dn.id]), G.far(fr.rec.p, [a0.fre001.rec.p[0] + dx, a0.fre001.rec.p[1], a0.fre001.rec.p[2]]) < 1e-6,
          STU.items.get('lmp001').rec.show.includes(bx.id) && !!hc && STU.items.get('lmp001').rec.show.includes(hc.id), STU.items.get('cube01').rec.hide.join() === 'dan001',
        ];
      }
      undo(); out.back1 = K(collabState()) === k0;
      // Ungroup: the group goes, its members stay; Undo brings it back
      select(gid); renderPanes(); document.querySelector('#pane-item [data-act="i:ungroup"]').click();
      out.ungroup = [STU.items.has(gid), STU.items.size, n0];
      undo(); out.back2 = K(collabState()) === k0;
      // Delete: every member (and the hole) with it; Lamp lets them go; Undo brings all back
      select(gid); renderPanes(); document.querySelector('#pane-item [data-act="i:del"]').click();
      out.del = [STU.items.size, ['box001', 'dan001', 'fre001', 'voi001', 'out001', 'cube01', 'hol001', gid].filter(id => STU.items.has(id)).length, STU.items.get('lmp001').rec.show.join()];
      undo(); out.back3 = K(collabState()) === k0;
      // the figure in a group of its own, Free moved into it from the first; the figure deleted: that group, left with one,
      // goes in the same step (Out, which followed her, stays where it is); Undo brings all back
      const u1 = UNDO.length;
      select('fig001'); itemAct('mkgroup'); const g2 = STU.gpick.id; groupToggle(g2, 'fre001'); gpickEnd();
      out.moved = [members(STU.items.get(g2)).map(m => m.id).join(), members(STU.items.get(gid)).map(m => m.id).join(), UNDO.length - u1];
      deleteItem('fig001');
      out.gone = [STU.items.has(g2), STU.items.has('fre001'), !!groupOf('fre001'), STU.items.get('out001').rec.on || '', UNDO.length - u1];
      undo(); out.back4 = [STU.items.has(g2), members(STU.items.get(g2)).length, STU.items.get('out001').rec.on];
      undo(); undo(); out.back5 = K(collabState()) === k0;
      return out;
    })()`).catch(e => ({ err: e.message }));
    const out = [];
    if (r.err) { bad(['duplicate etc.: ' + r.err]); return; }
    if (JSON.stringify(r.dup) !== '["g","Group 2",6,8,1]') out.push('Duplicate: a new group of 6 copies and the hole\'s copy, one step: ' + JSON.stringify(r.dup));
    if (!r.copies || r.copies.some(x => !x)) out.push('the copies (box beside it, hole on its copy, Voice on the dancer\'s copy, Out on the figure beside, Curtain\'s copy hiding the dancer\'s copy, Free beside, in Lamp\'s list, Curtain unchanged): ' + JSON.stringify(r.copies));
    if (r.ungroup[0] || r.ungroup[1] !== r.ungroup[2] - 1) out.push('Ungroup: ' + JSON.stringify(r.ungroup));
    if (r.del[1] || r.del[2] !== '') out.push('Delete (every member, the hole, Lamp\'s list): ' + JSON.stringify(r.del));
    if (r.moved[0] !== 'fig001,fre001' || r.moved[1] !== 'box001,dan001,voi001,out001,cube01' || r.moved[2] !== 2) out.push('Free moved into the figure\'s group (one step each): ' + JSON.stringify(r.moved));
    if (r.gone[0] || !r.gone[1] || r.gone[2] || r.gone[3] || r.gone[4] !== 3) out.push('the figure deleted: its group, left with one, goes in the same step: ' + JSON.stringify(r.gone));
    if (!r.back4[0] || r.back4[1] !== 2 || r.back4[2] !== 'fig001') out.push('Undo brought the figure\'s group back: ' + JSON.stringify(r.back4));
    if (!r.back1 || !r.back2 || !r.back3 || !r.back5) out.push('Undo did not bring the scene back: ' + JSON.stringify([r.back1, r.back2, r.back3, r.back5]));
    bad(out);
  });

  await step('studio groups: a cube\'s pick toggles a whole group (a member pointed at, a cube in the group too, the group\'s name under Items); the state with g.<id> and back, bad records refused, an id two groups name staying in the lower id\'s; layout.json with and without groups', async () => {
    const r = await ss(`(() => {
      const G = window.__gr, gid = G.gid(), out = {}, J = x => JSON.stringify(x), K = v => J(Object.keys(v).sort().map(k => [k, v[k]])), k0 = K(collabState()), L = () => STU.items.get('lmp001').rec.show.slice().sort().join();
      select('lmp001'); itemAct('pickFor', 'show');
      const u = UNDO.length;
      pressItem('dan001'); out.add = L();
      pressItem('box001'); out.rem = L();
      pressItem('cube01'); out.cube = [L(), STU.sel];
      X.tab = 'items'; renderPanes(); document.querySelector('#pane-items .stu-gh[data-act="linkg"][data-v="' + gid + '"]').click(); out.row = L();
      out.steps = UNDO.length - u;
      STU.pick = null; while (UNDO.length > u) undo(); select(''); X.tab = 'scene';
      // a cube in a group of cubes alone (nothing a cube can list): pointed at while picking, its group is selected (as a
      // click on any member selects its group), which ends the pick, as pointing at an ungrouped cube does
      putItem('pad001', 'c', norm('c', { name: 'Pad', p: [-4, 1, 0] })); putItem('pad002', 'c', norm('c', { name: 'Pad 2', p: [-4, 1, 2] }));
      putItem('pads01', 'g', norm('g', { name: 'Pads', items: ['pad001', 'pad002'] }));
      select('lmp001'); itemAct('pickFor', 'show'); const sh0 = L(); pressItem('pad001');
      out.pads = [STU.sel, !!STU.pick, L() === sh0];
      for (const id of ['pads01', 'pad001', 'pad002']) removeItem(id);
      select('');
      // the state
      const s0 = collabState(), same = () => { const a = J(collabState()); collabApply(JSON.parse(a)); return J(collabState()) === a; };
      out.state = [J(s0['g.' + gid]), same()];
      const N = x => norm('g', x);
      out.norm = [N({}), N({ items: 'box001' }), N({ items: [], name: ' ' }), J(N({ items: ['box001', 'Bad!', 'box001', 7, 'dan001'] })), J(N({ name: '  Lamps   and   things  '.repeat(5), items: ['dan001'], colour: 'red', id: 'zzz' }))];
      const was = J(collabState()), b = JSON.parse(was);
      b['g.' + gid] = { name: 'Group', items: 'everything' }; collabApply(b); out.badRoom = J(collabState()) === was;
      // two more groups from the room naming the box and the dancer: the box stays in this group (a lower id than zzzzzz,
      // which keeps Lamp), the dancer goes to 000000 (a lower id than this group's); in any order of the keys
      const two = Object.assign(JSON.parse(was), { 'g.zzzzzz': { name: 'Z', items: ['box001', 'lmp001'] }, 'g.000000': { name: 'A', items: ['dan001', 'fig001'] } });
      collabApply(two); const w1 = [groupOf('box001').id === gid, groupOf('dan001').id, members(STU.items.get('zzzzzz')).map(m => m.id).join(), members(STU.items.get('000000')).map(m => m.id).join()];
      collabApply(JSON.parse(was));
      const rev = {}; for (const k of Object.keys(two).reverse()) rev[k] = two[k];
      collabApply(rev); const w2 = [groupOf('box001').id === gid, groupOf('dan001').id, members(STU.items.get('zzzzzz')).map(m => m.id).join(), members(STU.items.get('000000')).map(m => m.id).join()];
      out.two = [w1, w2];
      collabApply(JSON.parse(was)); out.back = K(collabState()) === k0;
      // layout.json: groups written and read back; v113's (no groups) as before; a group naming items the layout lacks
      // keeps those it has, one left with fewer than 2 dropped and counted
      const Lo = layoutOut(), back = readLayout(JSON.parse(J(Lo)));
      out.lay = [Array.isArray(Lo.groups) && Lo.groups.length === 1 && J(Lo.groups[0]) === J(Object.assign({ id: gid }, STU.items.get(gid).rec)), back.bad, back.items.filter(x => x.kind === 'g').length];
      const old = readLayout({ studio: 1, objects: Lo.objects, cubes: Lo.cubes, sounds: Lo.sounds, cuts: Lo.cuts });
      out.old = [old.bad, old.items.length, old.items.some(x => x.kind === 'g')];
      const odd = readLayout({ studio: 1, objects: Lo.objects, groups: [{ id: 'aaaaaa', items: ['box001', 'nobody', 'dan001', 'hol001'] }, { id: 'bbbbbb', items: ['box001', 'gone01'] }, { id: 'cccccc', items: 'box001' }] });
      out.odd = [odd.bad, odd.items.filter(x => x.kind === 'g').map(x => x.id + ':' + x.rec.items.join('+')).join()];
      return out;
    })()`).catch(e => ({ err: e.message }));
    const out = [];
    if (r.err) { bad(['cube pick and state: ' + r.err]); return; }
    if (r.add !== 'box001,dan001,fre001,hol001,out001,voi001' || r.rem !== 'hol001' || r.cube[0] !== r.add || r.cube[1] !== 'lmp001' || r.row !== 'hol001' || r.steps !== 4) out.push('a cube\'s pick toggling the group\'s members: ' + JSON.stringify(r));
    if (JSON.stringify(r.pads) !== '["pads01",false,true]') out.push('a cube in a group of cubes alone, pointed at while picking: its group selected, the pick ended: ' + JSON.stringify(r.pads));
    if (!r.state[1] || !/"items":\["box001","dan001","fre001","voi001","out001","cube01"\]/.test(r.state[0])) out.push('the state with the group: ' + JSON.stringify(r.state));
    if (r.norm[0] !== null || r.norm[1] !== null || r.norm[2] !== null || r.norm[3] !== '{"name":"Group","items":["box001","dan001"]}' || !/^\{"name":"Lamps and things Lamps and things[^"]*","items":\["dan001"\]\}$/.test(r.norm[4]) || JSON.parse(r.norm[4]).name.length > 60) out.push('norm: ' + JSON.stringify(r.norm));
    if (!r.badRoom) out.push('a bad group record from the room was taken');
    if (JSON.stringify(r.two[0]) !== JSON.stringify([true, '000000', 'lmp001', 'dan001,fig001']) || JSON.stringify(r.two[1]) !== JSON.stringify(r.two[0])) out.push('an id two groups name: ' + JSON.stringify(r.two));
    if (!r.back) out.push('the state did not come back');
    if (!r.lay[0] || r.lay[1] || r.lay[2] !== 1) out.push('layout.json written and read: ' + JSON.stringify(r.lay));
    if (r.old[0] || r.old[2]) out.push('a layout without groups: ' + JSON.stringify(r.old));
    if (r.odd[0] !== 2 || r.odd[1] !== 'aaaaaa:box001+dan001') out.push('a layout\'s groups naming items it lacks: ' + JSON.stringify(r.odd));
    bad(out);
  });

  await step('studio groups: a pretend headset: the trigger on a member selects the group, again the member; the grip carries the group (turning with the hand only while moving freely), both grips size it about its pivot, one Undo step each; a member selected alone moves alone; the headset\'s cards', async () => {
    const r = await ss(`(() => {
      const G = window.__gr, gid = G.gid(), g = STU.items.get(gid), out = {}, V = (a, b, c) => new THREE.Vector3(a, b, c), K = v => JSON.stringify(Object.keys(v).sort().map(k => [k, v[k]])), k0 = K(collabState());
      const free = XR.free; XR.on = true; XR.clear = true; XR.free = true; GL.world.updateMatrixWorld(true);
      const [a, b] = XR.ctrls, ctl = (c, p, q) => { c.src = { targetRayMode: 'tracked-pointer', handedness: c === a ? 'right' : 'left', gamepad: null }; c.g.visible = true; c.g.matrix.compose(V(...p), q || new THREE.Quaternion(), V(1, 1, 1)); c.o.setFromMatrixPosition(c.g.matrix); };
      select('');
      // the trigger: the group, then the dancer alone
      ctl(a, [0, 1.6, 0]); a.hover = { kind: 'item', id: 'dan001' }; xrPress(a); const s1 = STU.sel; xrPress(a); out.sel = [s1 === gid, STU.sel];
      // the grip on the box (the group selected): the whole group, carried 0.3 m along x
      select(gid);
      // (the pivot once every model is built: G.at() steps the items, and the dancer, put back by the last step's Undo, is
      // built only then; until it is, her middle is her place)
      const a0 = G.at(), P = groupBase(g).P.toArray(), pw = GL.items.localToWorld(V(...P)), u = UNDO.length;
      ctl(a, [pw.x, pw.y, pw.z]); a.hover = { kind: 'item', id: 'box001' }; xrGrab(a, true); out.target = a.grab && a.grab.target;
      ctl(a, [pw.x + 0.3, pw.y, pw.z]); carry(a, 0.016); xrGrab(a, false);
      out.carry = [G.check(a0, G.at(), P, [0.3, 0, 0], 0, 1), UNDO.length - u];
      undo();
      // held at the pivot and turned a quarter about the upright with the hand: moving freely it turns, else not
      const quarter = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2);
      ctl(a, [pw.x, pw.y, pw.z]); a.hover = { kind: 'item', id: 'box001' }; xrGrab(a, true); ctl(a, [pw.x, pw.y, pw.z], quarter); carry(a, 0.016); xrGrab(a, false);
      out.turnFree = G.check(a0, G.at(), P, [0, 0, 0], Math.PI / 2, 1); undo();
      XR.free = false;
      ctl(a, [pw.x, pw.y, pw.z]); a.hover = { kind: 'item', id: 'box001' }; xrGrab(a, true); ctl(a, [pw.x, pw.y, pw.z], quarter); carry(a, 0.016); xrGrab(a, false);
      out.turnFixed = G.check(a0, G.at(), P, [0, 0, 0], 0, 1); undo();
      XR.free = true;
      // both grips, 0.2 m apart about the pivot, then 0.4: twice the size about it
      ctl(a, [pw.x - 0.1, pw.y, pw.z]); a.hover = { kind: 'item', id: 'box001' }; xrGrab(a, true);
      ctl(b, [pw.x + 0.1, pw.y, pw.z]); b.hover = { kind: 'item', id: 'dan001' }; xrGrab(b, true);
      carry(a, 0.016); carry(b, 0.016);
      ctl(a, [pw.x - 0.2, pw.y, pw.z]); ctl(b, [pw.x + 0.2, pw.y, pw.z]); carry(a, 0.016); carry(b, 0.016);
      xrGrab(b, false); xrGrab(a, false);
      out.two = [G.check(a0, G.at(), P, [0, 0, 0], 0, 2), UNDO.length - u];
      undo();
      // the box selected on its own: the grip carries the box alone
      select('box001');
      const bw = STU.items.get('box001').holder.getWorldPosition(V());
      ctl(a, [bw.x, bw.y, bw.z]); a.hover = { kind: 'item', id: 'box001' }; xrGrab(a, true); out.alone = a.grab && a.grab.target;
      ctl(a, [bw.x + 0.3, bw.y, bw.z]); carry(a, 0.016); xrGrab(a, false);
      out.aloneMoved = [+(STU.items.get('box001').rec.p[0] - a0.box001.rec.p[0]).toFixed(3), +(STU.items.get('dan001').rec.p[0] - a0.dan001.rec.p[0]).toFixed(3)];
      undo();
      // the box carried alone by one hand, the other's grip on the dancer: the dancer alone too (never the group round the
      // box in the first hand), each where its hand puts it, one Undo step
      const u2 = UNDO.length;
      ctl(a, [bw.x, bw.y, bw.z]); a.hover = { kind: 'item', id: 'box001' }; xrGrab(a, true);
      const dw = STU.items.get('dan001').holder.getWorldPosition(V());
      ctl(b, [dw.x, dw.y, dw.z]); b.hover = { kind: 'item', id: 'dan001' }; xrGrab(b, true);
      out.solo = [a.grab && a.grab.target, b.grab && b.grab.target];
      ctl(b, [dw.x, dw.y, dw.z + 0.2]); carry(a, 0.016); carry(b, 0.016); xrGrab(b, false); xrGrab(a, false);
      const R2 = id => STU.items.get(id).rec;
      out.soloMoved = [+(R2('dan001').p[2] - a0.dan001.rec.p[2]).toFixed(3), +(R2('box001').p[0] - a0.box001.rec.p[0]).toFixed(3), JSON.stringify(R2('fre001')) === JSON.stringify(a0.fre001.rec), UNDO.length - u2];
      undo();
      // the group held, then gone from the room: its change ends in the next frame (Undo works at once), nothing held
      select(gid);
      ctl(a, [pw.x, pw.y, pw.z]); a.hover = { kind: 'item', id: 'box001' }; xrGrab(a, true);
      ctl(a, [pw.x + 0.2, pw.y, pw.z]); carry(a, 0.016);
      const st = JSON.parse(JSON.stringify(collabState())); delete st['g.' + gid]; collabApply(st);
      const open = SNAP !== null; xrLost();
      out.lost = [open, a.grab, SNAP, STU.items.has(gid), STU.items.get('box001').carry];
      xrGrab(a, false); undo(); out.lostBack = [STU.items.has(gid), K(collabState()) === k0];
      // the headset's cards: the group's (its rows, Add or remove items... pressed and pressed again) and a member's
      const draw = () => { for (const P2 of XR.panels) { P2.last = ''; P2.t = -1e9; panelTick(P2, performance.now() + 1e6); } };
      const ids = () => { const seen = new Set(); for (let off = 0; off < 4000; off += 150) { X.scroll.item = off; draw(); for (const q of XR.main.regions) seen.add(q.id); } X.scroll = {}; draw(); return seen; };
      const press = id => { for (let off = 0; off < 4000; off += 150) { X.scroll.item = off; draw(); const q = XR.main.regions.find(z => z.id === id); if (q && q.fn) { q.fn(); X.scroll = {}; draw(); return true; } } X.scroll = {}; return false; };
      select(gid); X.tab = 'item'; X.scroll = {}; draw();
      const I = ids();
      out.gmiss = ['gpick', 'sel:box001', 'sel:cube01', 'turn', 'floor', 'size:0.5', 'size:2', 'dup', 'ungroup', 'del'].filter(i => !I.has(i));
      out.gpick = [press('gpick'), !!STU.gpick, press('gpick'), !!STU.gpick];
      select('dan001'); X.tab = 'item'; draw();
      const M = ids();
      out.mmiss = ['selgroup', 'mkgroup', 'faces:file', 'faces:both', 'faces:inside'].filter(i => !M.has(i));
      out.selg = [press('selgroup'), STU.sel === gid];
      for (const c of XR.ctrls) { c.src = null; c.g.visible = false; c.hover = null; c.grab = null; }
      XR.on = false; XR.free = free; select(''); X.tab = 'scene'; renderPanes();
      out.back = K(collabState()) === k0;
      return out;
    })()`).catch(e => ({ err: e.message }));
    const out = [];
    if (r.err) { bad(['the headset: ' + r.err]); return; }
    if (!r.sel[0] || r.sel[1] !== 'dan001') out.push('the trigger on a member: the group, then the member: ' + JSON.stringify(r.sel));
    if (r.target !== 'group' || r.carry[0].length || r.carry[1] !== 1) out.push('the grip carries the group (one step): ' + JSON.stringify([r.target, r.carry]));
    if (r.turnFree.length) out.push('turned with the hand, moving freely: ' + JSON.stringify(r.turnFree));
    if (r.turnFixed.length) out.push('the hand\'s turn with free moving off (the group only moves): ' + JSON.stringify(r.turnFixed));
    if (r.two[0].length || r.two[1] !== 1) out.push('both grips: twice the size about the pivot: ' + JSON.stringify(r.two));
    if (r.alone !== 'item' || r.aloneMoved[0] !== 0.3 || r.aloneMoved[1] !== 0) out.push('a member selected alone moves alone: ' + JSON.stringify([r.alone, r.aloneMoved]));
    if (JSON.stringify(r.solo) !== '["item","item"]' || r.soloMoved[0] !== 0.2 || r.soloMoved[1] !== 0 || !r.soloMoved[2] || r.soloMoved[3] !== 1) out.push('the box carried alone, the other grip on the dancer: the dancer alone: ' + JSON.stringify([r.solo, r.soloMoved]));
    if (JSON.stringify(r.lost) !== '[true,null,null,false,false]' || JSON.stringify(r.lostBack) !== '[true,true]') out.push('the group gone from the room while held: its change ends, Undo works: ' + JSON.stringify([r.lost, r.lostBack]));
    if (r.gmiss.length || JSON.stringify(r.gpick) !== '[true,true,true,false]') out.push('the headset\'s group card: ' + JSON.stringify({ miss: r.gmiss, gpick: r.gpick }));
    if (r.mmiss.length || !r.selg[0] || !r.selg[1]) out.push('the headset\'s member card: ' + JSON.stringify({ miss: r.mmiss, selg: r.selg }));
    if (!r.back) out.push('the scene did not come back after the headset\'s checks');
    bad(out);
    await gp.close();
  });
}
// The studio's faces (tools/studio/SPEC.md, "Faces"), on a page of its own: the rig test scene's box (a closed 0.5 m box,
// single sided as its file has it) and Twin, a copy of the same file elsewhere. Pixels read back from a render of the scene
// prove each setting (the same view drawn with an object and without it): seen from inside, As in the file shows nothing of
// a box, Inside out and Both sides show it, and the two copies take their own settings; from outside As in the file and
// Both sides show its near side, Inside out its far inner side (gone when a cut-out takes the far half away, which leaves
// the near side As in the file); Both sides through a cut-out in its near side shows its far inner side, As in the file
// nothing (lit and as scanned); kept through a rebuild of its file and the figure's switch to its GLB; the state and
// layout.json; the cards' rows (page and headset)
if (runs('studio faces')) {
  const fp = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  fp.on('pageerror', e => errors.push('studio faces: ' + (e.stack || e.message)));
  fp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('studio faces: ' + m.text()); });
  const ss = s => fp.evaluate(s => HOST.cur.peek(s), s);
  const until = (src, ms) => fp.waitForFunction(src => HOST.cur.peek(src), src, { timeout: ms || 20000 }).then(() => true, () => false);
  const bad = list => { if (list.length) errors.push(...list.map(b => 'studio faces: ' + b)); };
  // (in the page: the scene drawn from a camera of its own (eye and target in the scene's frame) and read back where scene
  // points land, with the objects named hidden for that drawing and nothing of editing drawn; each material's side)
  const HELP = `window.__fc = window.__fc || {
    shot: (eye, tgt, pts, hide) => {
      const W = 320, H = 200, r = GL.renderer, rt = new THREE.WebGLRenderTarget(W, H), cam = new THREE.PerspectiveCamera(60, W / H, 0.02, 200);
      itemsStep(0, performance.now()); GL.world.updateMatrixWorld(true);
      cam.position.copy(GL.items.localToWorld(new THREE.Vector3(...eye))); cam.lookAt(GL.items.localToWorld(new THREE.Vector3(...tgt))); cam.updateMatrixWorld();
      const hid = [GL.edit, GL.selBox, GL.hoverBox, GL.tc].filter(Boolean).concat([...STU.items.values()].filter(i => i.kind !== 'o' || (hide || []).includes(i.id)).map(i => i.holder));
      const keep = hid.map(o => o.visible);
      hid.forEach(o => { o.visible = false; });
      r.setRenderTarget(rt); r.render(GL.scene, cam);
      const px = pts.map(p => { const v = GL.items.localToWorld(new THREE.Vector3(...p)).project(cam), b = new Uint8Array(4); r.readRenderTargetPixels(rt, Math.round((v.x + 1) / 2 * W), Math.round((v.y + 1) / 2 * H), 1, 1, b); return [b[0], b[1], b[2]]; });
      r.setRenderTarget(null); hid.forEach((o, i) => { o.visible = keep[i]; }); rt.dispose();
      return px;
    },
    sides: id => { const it = STU.items.get(id), out = []; for (const m of it.model.meshes) for (const k of ['lit', 'scan']) for (const mat of [].concat(m.userData[k] || [])) out.push(k + ':' + mat.side); return out.join(); },
  }`;
  const dpx = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const shot = (set, eye, tgt, pts, hide) => ss(`(${set}, window.__fc.shot(${JSON.stringify(eye)}, ${JSON.stringify(tgt)}, ${JSON.stringify(pts)}, ${JSON.stringify(hide)}))`);
  const faces = (id, f) => `setRec('${id}', { faces: ${f ? `'${f}'` : 'undefined'} })`;
  // (from outside, the box's near side's middle)
  const oEye = [1.5, 0.3, -0.6], oTgt = [1.5, 0.25, -2], oPt = [[1.5, 0.25, -1.75]];

  await step('studio faces: pixels: from inside a box As in the file shows nothing of it, Inside out and Both sides show it, two copies of one file each as set; from outside As in the file and Both sides show its near side, Inside out its far inner side (gone with its far half cut away)', async () => {
    await fp.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&scene=rig&edit');
    await fp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    if (!await until(`STUDIO.ready() && !!STU.items.get('box001').model`, 120000)) { errors.push('studio faces: the rig scene did not load'); return; }
    // (the box still; Twin, a copy of its file 2.5 m behind it; editing off: nothing of editing drawn)
    await ss(`(${HELP}, setRec('box001', { anim: 'off' }), putItem('twn001', 'o', norm('o', { name: 'Twin', file: 'box.glb', p: [1.5, 0.25, -4.5], clip: 'Bob', anim: 'off' })), setEdit(false), 0)`);
    if (!await until(`!!STU.items.get('twn001').model && STU.items.get('twn001').a > 0.99`, 30000)) { errors.push('studio faces: Twin did not load'); return; }
    const out = [];
    // from inside each box (the eye in its middle, looking at its far side), drawn and not: the box in each setting, Twin
    // Inside out throughout; then Twin As in the file with the box Inside out
    const inside = (c, id) => ({ eye: [c[0], 0.3, c[2] + 0.05], tgt: [c[0], 0.3, c[2] - 1], pts: [[c[0], 0.3, c[2] - 0.25], [c[0] + 0.05, 0.35, c[2] - 0.25]], id });
    const B = inside([1.5, 0, -2], 'box001'), T = inside([1.5, 0, -4.5], 'twn001');
    const seen = async (set, V) => { const a = await shot(set, V.eye, V.tgt, V.pts, []), b = await shot(set, V.eye, V.tgt, V.pts, [V.id]); return a.some((p, i) => dpx(p, b[i]) > 40) ? 'seen' : a.every((p, i) => dpx(p, b[i]) <= 6) ? 'nothing' : 'unclear ' + JSON.stringify([a, b]); };
    const got = [];
    for (const f of ['', 'inside', 'both']) { const set = `(${faces('box001', f)}, ${faces('twn001', 'inside')})`; got.push([f || 'file', await seen(set, B), await seen(set, T)]); }
    const set2 = `(${faces('box001', 'inside')}, ${faces('twn001', '')})`;
    got.push(['inside, Twin file', await seen(set2, B), await seen(set2, T)]);
    if (JSON.stringify(got) !== JSON.stringify([['file', 'nothing', 'seen'], ['inside', 'seen', 'seen'], ['both', 'seen', 'seen'], ['inside, Twin file', 'seen', 'nothing']])) out.push('from inside (each box drawn and not): ' + JSON.stringify(got));
    const sides = await ss(`[window.__fc.sides('box001'), window.__fc.sides('twn001')]`);
    if (!/^lit:1(,|$)/.test(sides[0]) || /lit:[02]/.test(sides[0]) || !/^lit:0(,|$)/.test(sides[1]) || /lit:[12]/.test(sides[1])) out.push('two copies of one file set differently (BackSide 1, FrontSide 0): ' + JSON.stringify(sides));
    // from outside at the near side's middle: the box drawn, not drawn, and drawn with a cut-out taking its far half away
    const cut = `putItem('bck001', 'x', norm('x', { name: 'Back', on: 'box001', p: [0, 0, -0.15], size: [0.6, 0.6, 0.3] }))`;
    const o = {};
    for (const f of ['', 'inside', 'both']) {
      const set = `(${faces('box001', f)}, removeItem('bck001'))`;
      o[f || 'file'] = [(await shot(set, oEye, oTgt, oPt, []))[0], (await shot(set, oEye, oTgt, oPt, ['box001']))[0], (await shot(`(${faces('box001', f)}, ${cut})`, oEye, oTgt, oPt, []))[0]];
    }
    await ss(`(removeItem('bck001'), ${faces('box001', '')}, 0)`);
    if (dpx(o.file[0], o.file[1]) <= 40 || dpx(o.file[0], o.file[2]) > 6) out.push('from outside, As in the file: its near side (kept with the far half cut away): ' + JSON.stringify(o.file));
    if (dpx(o.both[0], o.both[1]) <= 40) out.push('from outside, Both sides: its near side: ' + JSON.stringify(o.both));
    if (dpx(o.inside[0], o.inside[1]) <= 40 || dpx(o.inside[2], o.inside[1]) > 6) out.push('from outside, Inside out: its far inner side (gone with the far half cut away): ' + JSON.stringify(o.inside));
    bad(out);
  });

  await step('studio faces: with a cut-out in its near side Both sides shows its far inner side through the hole, As in the file nothing (lit and as scanned); kept through a rebuild of its file and the figure\'s switch to its GLB; the state and layout.json; the cards\' rows (page and headset), one Undo step', async () => {
    const out = [];
    await ss(`(putItem('win001', 'x', norm('x', { name: 'Window', on: 'box001', p: [0, 0, 0.25], size: [0.2, 0.2, 0.2] })), 0)`);
    for (const light of ['lit', 'scan']) {
      const set = f => `setRec('box001', { faces: ${f ? `'${f}'` : 'undefined'}, light: '${light}' })`;
      const f0 = (await shot(set(''), oEye, oTgt, oPt, []))[0], f1 = (await shot(set(''), oEye, oTgt, oPt, ['box001']))[0], b0 = (await shot(set('both'), oEye, oTgt, oPt, []))[0], b1 = (await shot(set('both'), oEye, oTgt, oPt, ['box001']))[0];
      if (dpx(f0, f1) > 6 || dpx(b0, b1) <= 40) out.push(`${light}: through the hole As in the file shows nothing, Both sides its far inner side: ` + JSON.stringify({ f0, f1, b0, b1 }));
    }
    const pt = await ss(`[STUDIO.cut('win001').cutting, STUDIO.cut('win001').patched, window.__fc.sides('box001')]`);
    if (!pt[0] || !pt[1] || !/^lit:2,scan:2/.test(pt[2])) out.push('the cut-out\'s addition and Both sides on lit and as scanned: ' + JSON.stringify(pt));
    await ss(`(setRec('box001', { light: 'lit' }), removeItem('win001'), 0)`);
    // a rebuild of its file (as when the relay says it changed): the setting kept
    await ss(`(setRec('box001', { faces: 'inside' }), STUDIO.gen0 = STU.items.get('box001').built, fileChanged('box.glb'), 0)`);
    if (!await until(`STU.items.get('box001').built !== STUDIO.gen0 && !!STU.items.get('box001').model && STU.items.get('box001').built === STU.items.get('box001').E.gen`, 30000) || !/^lit:1/.test(await ss(`window.__fc.sides('box001')`))) out.push('a rebuild of its file did not keep Inside out: ' + await ss(`window.__fc.sides('box001')`));
    // the figure, Both sides, converted to a GLB and switched to it: kept (the record and the new model's materials)
    await ss(`(putItem('fig001', 'o', norm('o', { name: 'Figure', file: 'figure.fbx', p: [3, 0, -2], q: [-0.7071, 0, 0, 0.7071], s: 0.01, clip: 'Take 001', anim: 'off', faces: 'both' })), setEdit(true), 0)`);
    if (!await until(`!!STU.items.get('fig001').model`, 60000)) { out.push('the figure did not load'); bad(out); return; }
    const fs0 = await ss(`window.__fc.sides('fig001')`);
    await ss(`(STUDIO.lastGLB = null, convertFile('figure.fbx'), 0)`);
    if (!await until(`!CV.busy && !!STUDIO.lastGLB`, 90000) || !await ss('STUDIO.lastGLB.ok')) { out.push('figure.fbx was not converted: ' + await ss('CV.note')); bad(out); return; }
    const bytes = Buffer.from(await ss(`(() => { const u = new Uint8Array(STUDIO.lastGLB.glb); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); })()`), 'base64');
    const pat = '**/scenes/rig/models/figure.glb*';
    await fp.route(pat, route => route.fulfill({ body: bytes, contentType: 'model/gltf-binary' }));
    await ss(`(setFiles(STU.files.concat({ path: 'models/figure.glb', bytes: ${bytes.length}, at: 7, kind: 'model' })), GLBREC.set('models/figure.glb', { at: 7, rec: STUDIO.lastGLB.record, p: null }), switchToGLB('figure.fbx', 'models/figure.glb', STUDIO.lastGLB.record))`);
    const sw = await until(`(() => { const f = STU.items.get('fig001'); return f.rec.file === 'models/figure.glb' && !!f.model && f.built === f.E.gen; })()`, 30000);
    const fs1 = await ss(`[STU.items.get('fig001').rec.faces, window.__fc.sides('fig001')]`);
    if (!/^lit:2/.test(fs0) || !sw || fs1[0] !== 'both' || !/^lit:2/.test(fs1[1]) || /lit:[01]/.test(fs1[1])) out.push('the figure switched to its GLB keeps Both sides: ' + JSON.stringify({ fs0, sw, fs1 }));
    await ss(`(undo(), setFiles(STU.files.filter(f => !/^models\\//.test(f.path))), GLBREC.delete('models/figure.glb'), 0)`);
    await fp.unroute(pat);
    // the state and layout.json: faces kept only when set, given back as given; other values refused
    const st = await ss(`(() => {
      const J = x => JSON.stringify(x), s = collabState(), a = J(s); collabApply(JSON.parse(a));
      const N = x => norm('o', Object.assign({ file: 'box.glb', p: [0, 0, 0] }, x));
      const L = layoutOut(), back = readLayout(JSON.parse(J(L)));
      return [s['o.box001'].faces, J(collabState()) === a, N({}).faces === undefined, N({ faces: 'both' }).faces, N({ faces: 'outside' }), N({ faces: '' }), N({ faces: 1 }),
        L.objects.find(o => o.id === 'box001').faces, back.items.find(x => x.id === 'box001').rec.faces, back.bad, 'faces' in L.objects.find(o => o.id === 'dan001'), !!N({ faces: null }) && !('faces' in N({ faces: null }))];
    })()`);
    if (JSON.stringify(st) !== '["inside",true,true,"both",null,null,null,"inside","inside",0,false,true]') out.push('the state and layout.json with faces: ' + JSON.stringify(st));
    // the cards: the page's Faces row (one Undo step each), the headset's row pressed
    await ss(`(select('box001'), X.tab = 'item', renderPanes(), 0)`);
    const u0 = await ss('UNDO.length');
    await fp.click('#pane-item [data-act="i:faces"][data-v="both"]');
    const pg = await ss(`[STU.items.get('box001').rec.faces, UNDO.length, renderPanes() || document.querySelector('#pane-item [data-act="i:faces"][data-v="both"]').getAttribute('aria-pressed'), /see a room from inside/.test(document.querySelector('#pane-item').textContent), window.__fc.sides('box001').startsWith('lit:2')]`);
    await fp.click('#pane-item [data-act="i:faces"][data-v="file"]');
    const pg2 = await ss(`['faces' in STU.items.get('box001').rec, UNDO.length, window.__fc.sides('box001').startsWith('lit:0')]`);
    if (pg[0] !== 'both' || pg[1] !== u0 + 1 || pg[2] !== 'true' || !pg[3] || !pg[4] || pg2[0] || pg2[1] !== u0 + 2 || !pg2[2]) out.push('the page\'s Faces row: ' + JSON.stringify([pg, pg2]));
    const xr = await ss(`(() => {
      XR.on = true;
      const draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } };
      const press = id => { for (let off = 0; off < 4000; off += 150) { X.scroll.item = off; draw(); const q = XR.main.regions.find(z => z.id === id); if (q && q.fn) { q.fn(); X.scroll = {}; draw(); return true; } } X.scroll = {}; return false; };
      select('box001'); X.tab = 'item'; X.scroll = {}; draw();
      const r = [press('faces:inside'), STU.items.get('box001').rec.faces, window.__fc.sides('box001').startsWith('lit:1')];
      XR.on = false; select(''); X.tab = 'scene'; renderPanes();
      return r;
    })()`);
    if (!xr[0] || xr[1] !== 'inside' || !xr[2]) out.push('the headset\'s Faces row: ' + JSON.stringify(xr));
    bad(out);
    await fp.close();
  });
}
// The studio's tint and brightness (v125; tools/studio/SPEC.md, "Tint and brightness"), on a page of its own at the rig
// test scene: its box and Twin, a copy of the same file beside it. Pixels read back from renders (each one's near side): a
// red tint makes the box redder, brightness 2 brighter and 0.5 darker, Twin unchanged, lit and as scanned; kept through a
// rebuild of its file and the figure's switch to its GLB; the state and layout.json, norm's rules; the page's rows
// (swatches, any colour, Darker, Brighter, Reset; one Undo step each, not refused by a lock), a group's rows setting every
// object of it at once, and the headset's rows
if (runs('studio tint')) {
  const tp = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  tp.on('pageerror', e => errors.push('studio tint: ' + (e.stack || e.message)));
  tp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('studio tint: ' + m.text()); });
  const ss = s => tp.evaluate(s => HOST.cur.peek(s), s);
  const until = (src, ms) => tp.waitForFunction(src => HOST.cur.peek(src), src, { timeout: ms || 20000 }).then(() => true, () => false);
  const bad = list => { if (list.length) errors.push(...list.map(b => 'studio tint: ' + b)); };
  // (in the page: the scene drawn from a camera of its own and read back where scene points land, nothing but objects
  // drawn; how far an object's materials are from their colours as loaded times its record's tint and brightness)
  const HELP = `window.__tn = window.__tn || {
    shot: (eye, tgt, pts) => {
      const W = 320, H = 200, r = GL.renderer, rt = new THREE.WebGLRenderTarget(W, H), cam = new THREE.PerspectiveCamera(60, W / H, 0.02, 200);
      itemsStep(0, performance.now()); GL.world.updateMatrixWorld(true);
      cam.position.copy(GL.items.localToWorld(new THREE.Vector3(...eye))); cam.lookAt(GL.items.localToWorld(new THREE.Vector3(...tgt))); cam.updateMatrixWorld();
      const hid = [GL.edit, GL.selBox, GL.hoverBox, GL.tc].filter(Boolean).concat([...STU.items.values()].filter(i => i.kind !== 'o').map(i => i.holder));
      const keep = hid.map(o => o.visible);
      hid.forEach(o => { o.visible = false; });
      r.setRenderTarget(rt); r.render(GL.scene, cam);
      const px = pts.map(p => { const v = GL.items.localToWorld(new THREE.Vector3(...p)).project(cam), b = new Uint8Array(4); r.readRenderTargetPixels(rt, Math.round((v.x + 1) / 2 * W), Math.round((v.y + 1) / 2 * H), 1, 1, b); return [b[0], b[1], b[2]]; });
      r.setRenderTarget(null); hid.forEach((o, i) => { o.visible = keep[i]; }); rt.dispose();
      return px;
    },
    mats: id => { const it = STU.items.get(id), T = new THREE.Color(it.rec.tint || '#ffffff'), k = it.rec.bright || 1; let worst = 0, n = 0, c = null;
      for (const m of it.model.meshes) for (const key of ['lit', 'scan']) for (const mat of [].concat(m.userData[key] || [])) { const w = new THREE.Color().fromArray(mat.userData.col0).multiply(T).multiplyScalar(k); worst = Math.max(worst, Math.abs(w.r - mat.color.r), Math.abs(w.g - mat.color.g), Math.abs(w.b - mat.color.b)); n++; if (!c && key === 'lit') c = mat.color.toArray().map(v => +v.toFixed(3)); }
      return { n, worst, c }; },
  }`;
  const sum = p => p[0] + p[1] + p[2], red = p => p[0] / Math.max(1, sum(p)), dpx = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const eye = [2.05, 0.35, -0.3], tgt = [2.05, 0.25, -2], pts = [[1.5, 0.25, -1.75], [2.6, 0.25, -1.75]];
  const shot = set => ss(`(${set}, window.__tn.shot(${JSON.stringify(eye)}, ${JSON.stringify(tgt)}, ${JSON.stringify(pts)}))`);

  await step('studio tint: pixels: a red tint makes the box redder, brightness 2 brighter and 0.5 darker, Twin (the same file) unchanged, lit and as scanned', async () => {
    await tp.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&scene=rig&edit');
    await tp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    if (!await until(`STUDIO.ready() && !!STU.items.get('box001').model`, 120000)) { errors.push('studio tint: the rig scene did not load'); return; }
    // (the box still; Twin, a copy of its file, beside it; editing off: nothing of editing drawn)
    await ss(`(${HELP}, setRec('box001', { anim: 'off' }), putItem('twn001', 'o', norm('o', { name: 'Twin', file: 'box.glb', p: [2.6, 0.25, -2], clip: 'Bob', anim: 'off' })), setEdit(false), 0)`);
    if (!await until(`!!STU.items.get('twn001').model && STU.items.get('twn001').a > 0.99`, 30000)) { errors.push('studio tint: Twin did not load'); return; }
    const out = [];
    for (const light of ['lit', 'scan']) {
      const b0 = await shot(`setRec('box001', { light: '${light}', tint: undefined, bright: undefined })`), rd = await shot(`setRec('box001', { tint: '#ff5a4b' })`);
      const b2 = await shot(`setRec('box001', { tint: undefined, bright: 2 })`), b5 = await shot(`setRec('box001', { bright: 0.5 })`);
      if (!(red(rd[0]) > red(b0[0]) + 0.1 && rd[0][1] < b0[0][1] - 40)) out.push(`${light}: a red tint did not make it redder: ` + JSON.stringify({ b0: b0[0], red: rd[0] }));
      if (!(sum(b2[0]) > sum(b0[0]) + 60)) out.push(`${light}: brightness 2 did not make it brighter: ` + JSON.stringify({ b0: b0[0], b2: b2[0] }));
      if (!(sum(b5[0]) < sum(b0[0]) * 0.7)) out.push(`${light}: brightness 0.5 did not make it darker: ` + JSON.stringify({ b0: b0[0], b5: b5[0] }));
      const tw = [rd, b2, b5].map(x => dpx(x[1], b0[1]));
      if (tw.some(d => d > 6)) out.push(`${light}: Twin (the same file) changed with the box: ` + JSON.stringify({ b0: b0[1], tw }));
    }
    await ss(`setRec('box001', { light: 'lit', tint: '#ff5a4b', bright: 1.5 })`);
    const m = await ss(`[window.__tn.mats('box001'), window.__tn.mats('twn001'), STU.items.get('box001').model.meshes[0].material !== STU.items.get('twn001').model.meshes[0].material]`);
    if (m[0].worst > 1e-6 || JSON.stringify(m[0].c) !== '[1.5,0.529,0.441]' || m[1].c.join() !== '1,1,1' || !m[2]) out.push('the materials\' colours (the box\'s its colour as loaded times the tint times 1.5, Twin\'s as loaded, each its own): ' + JSON.stringify(m));
    bad(out);
  });

  await step('studio tint: kept through a rebuild of its file and the figure\'s switch to its GLB; the state and layout.json carry tint and bright and give them back; norm\'s rules', async () => {
    const out = [];
    // a rebuild of its file (as when the relay says it changed): the tint and brightness on its new materials
    await ss(`(STUDIO.gen0 = STU.items.get('box001').built, fileChanged('box.glb'), 0)`);
    const rb = await until(`STU.items.get('box001').built !== STUDIO.gen0 && !!STU.items.get('box001').model && STU.items.get('box001').built === STU.items.get('box001').E.gen`, 30000);
    const m1 = await ss(`window.__tn.mats('box001')`);
    if (!rb || m1.worst > 1e-6 || JSON.stringify(m1.c) !== '[1.5,0.529,0.441]') out.push('a rebuild of its file did not keep the tint and brightness: ' + JSON.stringify([rb, m1]));
    // the figure, tinted and darker, converted to a GLB and switched to it: kept (the record and the new model's materials)
    await ss(`(putItem('fig001', 'o', norm('o', { name: 'Figure', file: 'figure.fbx', p: [3, 0, -2], q: [-0.7071, 0, 0, 0.7071], s: 0.01, clip: 'Take 001', anim: 'off', tint: '#46d9ff', bright: 0.8 })), setEdit(true), 0)`);
    if (!await until(`!!STU.items.get('fig001').model`, 60000)) { out.push('the figure did not load'); bad(out); return; }
    await ss(`(STUDIO.lastGLB = null, convertFile('figure.fbx'), 0)`);
    if (!await until(`!CV.busy && !!STUDIO.lastGLB`, 90000) || !await ss('STUDIO.lastGLB.ok')) { out.push('figure.fbx was not converted: ' + await ss('CV.note')); bad(out); return; }
    const bytes = Buffer.from(await ss(`(() => { const u = new Uint8Array(STUDIO.lastGLB.glb); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); })()`), 'base64');
    const pat = '**/scenes/rig/models/figure.glb*';
    await tp.route(pat, route => route.fulfill({ body: bytes, contentType: 'model/gltf-binary' }));
    await ss(`(setFiles(STU.files.concat({ path: 'models/figure.glb', bytes: ${bytes.length}, at: 7, kind: 'model' })), GLBREC.set('models/figure.glb', { at: 7, rec: STUDIO.lastGLB.record, p: null }), switchToGLB('figure.fbx', 'models/figure.glb', STUDIO.lastGLB.record))`);
    const sw = await until(`(() => { const f = STU.items.get('fig001'); return f.rec.file === 'models/figure.glb' && !!f.model && f.built === f.E.gen; })()`, 30000);
    const f1 = await ss(`[STU.items.get('fig001').rec.tint, STU.items.get('fig001').rec.bright, window.__tn.mats('fig001')]`);
    if (!sw || f1[0] !== '#46d9ff' || f1[1] !== 0.8 || !f1[2].n || f1[2].worst > 1e-6) out.push('the figure switched to its GLB keeps its tint and brightness: ' + JSON.stringify({ sw, f1 }));
    await ss(`(undo(), removeItem('fig001'), setFiles(STU.files.filter(f => !/^models\\//.test(f.path))), GLBREC.delete('models/figure.glb'), 0)`);
    await tp.unroute(pat);
    // the state and layout.json: kept only when set, given back as given; norm's rules
    const st = await ss(`(() => {
      const J = x => JSON.stringify(x), s = collabState(), a = J(s); collabApply(JSON.parse(a));
      const N = x => norm('o', Object.assign({ file: 'box.glb', p: [0, 0, 0] }, x));
      const L = layoutOut(), back = readLayout(JSON.parse(J(L)));
      return [s['o.box001'].tint, s['o.box001'].bright, J(collabState()) === a, N({}).tint === undefined && N({}).bright === undefined,
        N({ tint: '#FF5A4B' }).tint, N({ tint: 'red' }), N({ tint: '#ff5a4' }), N({ tint: 7 }), !!N({ tint: null }) && !('tint' in N({ tint: null })),
        N({ bright: 5 }).bright, N({ bright: 0.1 }).bright, 'bright' in N({ bright: 1 }), N({ bright: 1.234 }).bright, N({ bright: '2' }), N({ bright: 0 }), N({ bright: -1 }), !!N({ bright: null }) && !('bright' in N({ bright: null })),
        L.objects.find(o => o.id === 'box001').tint, back.items.find(x => x.id === 'box001').rec.bright, back.bad, 'tint' in L.objects.find(o => o.id === 'dan001'), 'bright' in L.objects.find(o => o.id === 'dan001')];
    })()`);
    if (JSON.stringify(st) !== '["#ff5a4b",1.5,true,true,"#ff5a4b",null,null,null,true,4,0.25,false,1.23,null,null,null,true,"#ff5a4b",1.5,0,false,false]') out.push('the state and layout.json with tint and bright, norm\'s rules: ' + JSON.stringify(st));
    await ss(`setRec('box001', { tint: undefined, bright: undefined })`);
    bad(out);
  });

  await step('studio tint: the page\'s rows (a swatch, any colour, Darker, Brighter, Reset, None; one Undo step each, not refused by a lock in place), a group\'s rows setting every object of it in one step, and the headset\'s rows', async () => {
    const out = [];
    await ss(`(setEdit(true), select('box001'), X.tab = 'item', renderPanes(), 0)`);
    const u0 = await ss('UNDO.length'), rec = () => ss(`[STU.items.get('box001').rec.tint || '', STU.items.get('box001').rec.bright || 1, UNDO.length]`);
    // (a button pressed by its selector, found again as it is clicked: the pane is drawn again now and then)
    const press = async sel => { const st = await tp.evaluate(sel => { HOST.cur.peek('renderPanes()'); const b = document.querySelector(sel); return !b ? 'none' : b.disabled ? 'disabled' : 'ok'; }, sel); if (st !== 'ok') return st === 'none' ? false : st; await tp.click(sel); return true; };
    const got = [];
    got.push([await press('#pane-item [data-act="i:tint"][data-v="#ff5a4b"]'), ...await rec()]);
    const on = await tp.evaluate(() => (HOST.cur.peek('renderPanes()'), document.querySelector('#pane-item [data-act="i:tint"][data-v="#ff5a4b"]').getAttribute('aria-pressed')));
    // any colour (the page's colour field: taken once chosen)
    await tp.evaluate(() => { const i = document.querySelector('#stuTint'); i.value = '#3366CC'; i.dispatchEvent(new Event('change', { bubbles: true })); });
    got.push(['colour', ...await rec()]);
    got.push([await press('#pane-item [data-act="i:bright"][data-v="0.8"]'), ...await rec()]);
    got.push([await press('#pane-item [data-act="i:bright"][data-v="1.25"]'), ...await rec()]);
    got.push([await press('#pane-item [data-act="i:bright"][data-v="1.25"]'), ...await rec()]);
    const words = await tp.evaluate(() => (HOST.cur.peek('renderPanes()'), /Brightness: 125 %/.test(document.querySelector('#pane-item').textContent)));
    got.push([await press('#pane-item [data-act="i:bright"][data-v="reset"]'), ...await rec()]);
    got.push([await press('#pane-item [data-act="i:bright"][data-v="reset"]'), ...await rec()]);
    got.push([await press('#pane-item [data-act="i:tint"][data-v=""]'), ...await rec()]);
    const want = [[true, '#ff5a4b', 1, u0 + 1], ['colour', '#3366cc', 1, u0 + 2], [true, '#3366cc', 0.8, u0 + 3], [true, '#3366cc', 1, u0 + 4], [true, '#3366cc', 1.25, u0 + 5], [true, '#3366cc', 1, u0 + 6], ['disabled', '#3366cc', 1, u0 + 6], [true, '', 1, u0 + 7]];
    if (JSON.stringify(got) !== JSON.stringify(want) || on !== 'true' || !words) out.push('the page\'s rows (each press and its record, one Undo step each): ' + JSON.stringify({ got, want, on, words }));
    // held at 25 %: seven presses of Darker, then greyed
    for (let i = 0; i < 7; i++) await press('#pane-item [data-act="i:bright"][data-v="0.8"]');
    const low = [...await rec(), await press('#pane-item [data-act="i:bright"][data-v="0.8"]')];
    if (low[1] !== 0.25 || low[3] !== 'disabled') out.push('Darker held at 25 % and greyed there: ' + JSON.stringify(low));
    await press('#pane-item [data-act="i:bright"][data-v="reset"]');
    // locked in place: a tint and a brightness still change it (they move nothing), nothing refused
    await ss(`(setRec('box001', { locked: true }), STU.lockSaid = null, 0)`);
    const lk = [await press('#pane-item [data-act="i:tint"][data-v="#3ee08f"]'), await press('#pane-item [data-act="i:bright"][data-v="1.25"]'), ...await rec(), await ss('!!STU.lockSaid')];
    await ss(`setRec('box001', { locked: undefined, tint: undefined, bright: undefined })`);
    if (lk[0] !== true || lk[1] !== true || lk[2] !== '#3ee08f' || lk[3] !== 1.25 || lk[5]) out.push('locked in place, the tint and the brightness still change: ' + JSON.stringify(lk));
    // a group of the box and Twin: its rows set both in one step; their brightness each its own, said when they differ
    await ss(`(putItem('grp001', 'g', norm('g', { name: 'Pair', items: ['box001', 'twn001'] })), select('grp001'), renderPanes(), 0)`);
    const g0 = await ss('UNDO.length'), both = () => ss(`[STU.items.get('box001').rec.tint || '', STU.items.get('twn001').rec.tint || '', STU.items.get('box001').rec.bright || 1, STU.items.get('twn001').rec.bright || 1, UNDO.length]`);
    const gg = [];
    gg.push([await press('#pane-item [data-act="i:tint"][data-v="#46d9ff"]'), ...await both()]);
    gg.push([await press('#pane-item [data-act="i:bright"][data-v="0.8"]'), ...await both()]);
    await ss(`setRec('box001', { bright: 2 })`);
    const differ = await tp.evaluate(() => (HOST.cur.peek('renderPanes()'), /Brightness: they differ/.test(document.querySelector('#pane-item').textContent)));
    gg.push([await press('#pane-item [data-act="i:bright"][data-v="1.25"]'), ...await both()]);
    const gwant = [[true, '#46d9ff', '#46d9ff', 1, 1, g0 + 1], [true, '#46d9ff', '#46d9ff', 0.8, 0.8, g0 + 2], [true, '#46d9ff', '#46d9ff', 2.5, 1, g0 + 3]];
    if (JSON.stringify(gg) !== JSON.stringify(gwant) || !differ) out.push('a group\'s rows (both objects in one step; Brighter each by its own): ' + JSON.stringify({ gg, gwant, differ }));
    while (await ss('UNDO.length') > u0) await ss('undo()');
    await ss(`(removeItem('grp001'), setRec('box001', { tint: undefined, bright: undefined }), setRec('twn001', { tint: undefined, bright: undefined }), 0)`);
    // the headset's rows: a swatch and Brighter pressed on its panel (no colour field there: a page's)
    const xr = await ss(`(() => {
      XR.on = true;
      const draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } };
      const ids = new Set(), press = id => { for (let off = 0; off < 6000; off += 150) { X.scroll.item = off; draw(); XR.main.regions.forEach(z => ids.add(z.id)); const q = XR.main.regions.find(z => z.id === id); if (q && q.fn) { q.fn(); X.scroll = {}; draw(); return true; } } X.scroll = {}; return false; };
      select('box001'); X.tab = 'item'; X.scroll = {}; draw();
      const r = [press('tint:#3ee08f'), press('bright:+'), STU.items.get('box001').rec.tint, STU.items.get('box001').rec.bright, ['tint:none', 'tint:#ff5a4b', 'bright:-'].every(i => ids.has(i)), [...ids].some(i => /stuTint/.test(i))];
      XR.on = false; select(''); X.tab = 'scene'; renderPanes();
      return r;
    })()`);
    if (JSON.stringify(xr) !== '[true,true,"#3ee08f",1.25,true,false]') out.push('the headset\'s rows: ' + JSON.stringify(xr));
    await ss(`setRec('box001', { tint: undefined, bright: undefined })`);
    bad(out);
    await tp.close();
  });
}
// The studio's viewer (v125; tools/studio/SPEC.md, "The viewer"), on a page of its own at the test scene: a model over the
// whole window from an Add card's Look, an Upload row's Preview (the test originals dropped, then a dense ball made in the
// page) and Fewer triangles' Look closer on a placed model. Pixels read from the canvas as the viewer draws it (in the same
// task, before the browser shows the frame): the model in the middle, two side by side; a drag turning the camera, the
// wheel zooming, a double click framing it again; the slider making the lighter one again (its count); Wireframe,
// Textures, As scanned; Close and Esc back as it was (the scene drawn again, nothing written, Undo unchanged), the share
// back on the row or the card
if (runs('studio viewer')) {
  const vp = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  vp.on('pageerror', e => errors.push('studio viewer: ' + (e.stack || e.message)));
  vp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('studio viewer: ' + m.text()); });
  const ss = s => vp.evaluate(s => HOST.cur.peek(s), s);
  const until = (src, ms) => vp.waitForFunction(src => HOST.cur.peek(src), src, { timeout: ms || 20000 }).then(() => true, () => false);
  const bad = list => { if (list.length) errors.push(...list.map(b => 'studio viewer: ' + b)); };
  // (the viewer drawn now and read back at points given as shares of the window, and the mean of a patch round each; its
  // background is 10, 17, 29)
  const PX = `(pts => { vwDraw(0); const R = GL.renderer, gl = R.getContext(), s = R.getDrawingBufferSize(new THREE.Vector2()), n = 15, b = new Uint8Array(n * n * 4);
    return pts.map(([fx, fy]) => { gl.readPixels(Math.round(fx * s.x) - 7, Math.round((1 - fy) * s.y) - 7, n, n, gl.RGBA, gl.UNSIGNED_BYTE, b); let r = 0, g = 0, bl = 0; for (let i = 0; i < b.length; i += 4) { r += b[i]; g += b[i + 1]; bl += b[i + 2]; } const k = n * n; return [Math.round(r / k), Math.round(g / k), Math.round(bl / k)]; }); })`;
  const px = pts => ss(`${PX}(${JSON.stringify(pts)})`);
  // (how many pixels the wireframe changes: drawn without it and with it, the whole window read back; in all, its left half
  // and its right half)
  const WIRE = `(() => { const R = GL.renderer, gl = R.getContext(), s = R.getDrawingBufferSize(new THREE.Vector2()), n = s.x * s.y * 4, a = new Uint8Array(n), b = new Uint8Array(n), w = VW.wire;
    VW.wire = false; vwDraw(0); gl.readPixels(0, 0, s.x, s.y, gl.RGBA, gl.UNSIGNED_BYTE, a); VW.wire = true; vwDraw(0); gl.readPixels(0, 0, s.x, s.y, gl.RGBA, gl.UNSIGNED_BYTE, b); VW.wire = w;
    const d = [0, 0, 0]; for (let i = 0; i < n; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) { d[0]++; d[(i / 4) % s.x < s.x / 2 ? 1 : 2]++; } return d; })()`;
  const sum3 = p => p[0] + p[1] + p[2], BG = [10, 17, 29], off = p => Math.abs(p[0] - BG[0]) + Math.abs(p[1] - BG[1]) + Math.abs(p[2] - BG[2]), dpx = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const before = () => ss(`[UNDO.length, JSON.stringify(collabState()), unsaved(), STU.items.size]`);
  // the dense ball (24,320 triangles, a red and green checker), made in the page as the Fewer triangles step makes it
  const ballB64 = () => ss(`(async () => {
    exporterLoad();
    const T = THREE, g = new T.SphereGeometry(0.5, 128, 96), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.04 * Math.sin(20 * x) * Math.sin(20 * y) * Math.sin(20 * z); p.setXYZ(i, x * k, y * k, z * k); }
    g.computeVertexNormals();
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#e02020' : '#20c020'; x.fillRect(i * 8, j * 8, 8, 8); }
    const root = new T.Group(); root.add(new T.Mesh(g, new T.MeshStandardMaterial({ name: 'skin', map: new T.CanvasTexture(cv), roughness: 1, metalness: 0 })));
    const glb = await new Promise(res => new T.GLTFExporter().parse(root, res, { binary: true }));
    const u = new Uint8Array(glb); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s);
  })()`);

  await step('studio viewer: an Add card\'s Look: over the whole window (the canvas raised, the overlay over it), the model in the middle (pixels), a drag turning the camera, the wheel zooming, a right drag panning, a double click framing it again, Wireframe, Textures and As scanned; the studio\'s keys kept from the scene; Esc back as it was (the scene drawn again, nothing written, Undo unchanged); none in a headset', async () => {
    await vp.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&scene=test&edit');
    await vp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    if (!await until(`STUDIO.ready()`, 120000)) { errors.push('studio viewer: the test scene did not load'); return; }
    const out = [];
    await ss(`(setEdit(true), select('box001'), X.tab = 'add', renderPanes(), 0)`);
    const b0 = await before(), looks = await vp.evaluate(() => [...document.querySelectorAll('#pane-add .stu-cw .stu-look')].map(b => b.dataset.v).join());
    if (looks !== 'box.glb,figure.fbx') out.push('a Look on each model card of the Add pane: ' + looks);
    // none in a headset (a page's only)
    if (await ss(`(XR.on = true, act('look', 'box.glb'), XR.on = false, VW.open)`)) out.push('the viewer opened in a headset');
    await vp.click('#pane-add .stu-look[data-v="box.glb"]');
    if (!await until(`VW.open && !VW.busy && !!VW.root`, 30000)) { out.push('the viewer did not open: ' + JSON.stringify(await ss('vwState()'))); bad(out); return; }
    const lay = await vp.evaluate(() => { const o = document.getElementById('stuViewer'), c = document.getElementById('gl'), r = o.getBoundingClientRect(); return [getComputedStyle(o).zIndex, c.style.zIndex, r.width, r.height, !!o.querySelector('[data-lite]').hidden, document.activeElement && document.activeElement.dataset.vw]; });
    if (JSON.stringify(lay) !== '["14","13",1280,800,true,"close"]') out.push('over the whole window (the overlay at 14, the canvas raised to 13, no lighter row for an Add card, Close focused): ' + JSON.stringify(lay));
    const st = await ss('vwState()');
    if (st.kind !== 'add' || st.title !== 'box.glb' || st.lite || st.cur !== 12 || JSON.stringify(st.size) !== '[0.5,0.5,0.5]' || !st.spin || st.grid !== 0.05) out.push('what it shows (the box, 12 triangles, 0.5 m, grid squares of 5 cm, turning by itself): ' + JSON.stringify(st));
    const p0 = await px([[0.5, 0.5], [0.04, 0.5], [0.96, 0.5]]);
    if (off(p0[0]) < 90 || off(p0[1]) > 12 || off(p0[2]) > 12) out.push('the model in the middle of the window, the background at its sides: ' + JSON.stringify(p0));
    // a click stops it turning; a drag turns the camera (0.4 degrees a pixel round, 0.3 up), the wheel zooms, a right
    // drag pans, a double click frames it again
    await vp.mouse.click(640, 400);
    const a0 = await ss('[VW.az, VW.el, VW.dist, VW.tgt.toArray(), VW.spin]');
    await vp.mouse.move(640, 400); await vp.mouse.down(); await vp.mouse.move(740, 420, { steps: 5 }); await vp.mouse.up();
    const a1 = await ss('[VW.az, VW.el]');
    const da = ((a1[0] - a0[0]) % 360 + 540) % 360 - 180;
    if (a0[4] || Math.abs(da + 40) > 0.5 || Math.abs(a1[1] - a0[1] - 6) > 0.5) out.push('a drag of 100 by 20 px turned the camera 40 degrees round and 6 up: ' + JSON.stringify({ a0, a1, da }));
    if (off((await px([[0.5, 0.5]]))[0]) < 90) out.push('the model left the middle when turned');
    await vp.mouse.wheel(0, 200);
    await until(`Math.abs(VW.dist / ${a0[2]} - Math.exp(0.24)) < 0.01`, 3000);
    const z = await ss('VW.dist');
    if (Math.abs(z / a0[2] - Math.exp(0.24)) > 0.01) out.push('the wheel did not zoom out by e^0.24: ' + JSON.stringify([a0[2], z]));
    await vp.mouse.move(640, 400); await vp.mouse.down({ button: 'right' }); await vp.mouse.move(600, 400, { steps: 4 }); await vp.mouse.up({ button: 'right' });
    const t1 = await ss('VW.tgt.toArray()');
    if (Math.hypot(t1[0] - a0[3][0], t1[1] - a0[3][1], t1[2] - a0[3][2]) < 0.01) out.push('a right drag did not pan: ' + JSON.stringify([a0[3], t1]));
    await vp.mouse.dblclick(640, 400);
    const f = await ss('[VW.dist, VW.tgt.toArray()]');
    if (Math.abs(f[0] - a0[2]) > 1e-6 || Math.hypot(f[1][0] - a0[3][0], f[1][1] - a0[3][1], f[1][2] - a0[3][2]) > 1e-6) out.push('a double click framed it again (its distance and target as at first): ' + JSON.stringify([a0, f]));
    // Wireframe: its triangles' edges over it (the middle changes); Textures off: no pictures on its materials; As scanned
    const w0 = await px([[0.5, 0.5]]);
    await vp.click('#stuViewer [data-vw="wire"]');
    const w1 = await ss(`[VW.wire, ${WIRE}]`), wl = await vp.evaluate(() => document.querySelector('#stuViewer [data-vw="wire"]').textContent);
    await vp.click('#stuViewer [data-vw="wire"]');
    await vp.click('#stuViewer [data-vw="tex"]');
    const tx = await ss(`(vwDraw(0), [VW.tex, VW.mats.every(x => Object.keys(x.maps).every(k => x.mat[k] === null)), VW.mats.some(x => Object.keys(x.maps).length)])`), t0 = await px([[0.5, 0.5]]);
    await vp.click('#stuViewer [data-vw="tex"]');
    const tb = await ss(`(vwDraw(0), VW.mats.every(x => Object.keys(x.maps).every(k => x.mat[k] === x.maps[k])))`);
    await vp.click('#stuViewer [data-vw="light"][data-v="scan"]');
    const sc = await ss(`(vwDraw(0), [VW.light, VW.meshes.every(e => [].concat(e.m.material).every(m => m.isMeshBasicMaterial))])`);
    await vp.click('#stuViewer [data-vw="light"][data-v="lit"]');
    if (!w1[0] || w1[1][0] < 1000 || wl !== 'Wireframe: on' || await ss('VW.wire')) out.push('Wireframe: its edges over it (pixels changed), and off again: ' + JSON.stringify({ w1, wl }));
    if (JSON.stringify(tx) !== '[false,true,true]' || !tb || dpx(t0[0], w0[0]) < 20) out.push('Textures off and on again: ' + JSON.stringify({ tx, tb, t0, w0 }));
    if (JSON.stringify(sc) !== '["scan",true]') out.push('As scanned: ' + JSON.stringify(sc));
    // the studio's keys never reach the scene behind it: Delete and Ctrl+Z with the box selected change nothing
    await vp.keyboard.press('Delete'); await vp.keyboard.press('Control+z'); await vp.keyboard.press('p');
    const k = await ss(`[STU.items.has('box001'), STU.sel, UNDO.length, MPAUSE.on]`);
    if (JSON.stringify(k) !== JSON.stringify([true, 'box001', b0[0], false])) out.push('a key pressed while it is open reached the scene: ' + JSON.stringify(k));
    // Esc: back as it was
    const d0 = await ss('VW.drew'), f0 = await vp.evaluate(() => window.__frames);
    await vp.keyboard.press('Escape');
    const gone = await ss(`[VW.open, !!document.getElementById('stuViewer'), GL.canvas.style.zIndex, VW.root, VW.meshes.length]`);
    await vp.waitForFunction(f0 => window.__frames > f0 + 2, f0, { timeout: 20000 }).catch(() => {});
    const after = await before(), d1 = await ss('VW.drew');
    if (JSON.stringify(gone) !== '[false,false,"",null,0]' || JSON.stringify(after) !== JSON.stringify(b0) || d1 > d0 + 1) out.push('Esc: back as it was (the overlay gone, the canvas under the page again, nothing written, Undo unchanged, the studio drawing): ' + JSON.stringify({ gone, b0, after, drew: [d0, d1] }));
    await ss(`(select(''), X.tab = 'scene', renderPanes(), 0)`);
    bad(out);
  });

  await step('studio viewer: an Upload row\'s Preview (the test originals dropped: the figure; then a dense ball): All triangles, Lighter and Side by side (two drawn), the slider making the lighter one again (its count), Close back to the pane with the share and what was seen on the row', async () => {
    const out = [];
    await ss(`(X.tab = 'upload', renderPanes(), 0)`);
    await ss(`(async () => {
      const get = async p => new File([await (await fetch('tools/studio/test/scenes/test/' + p)).arrayBuffer()], p.split('/').pop());
      upTake([{ path: 'drop/figure.fbx', file: await get('figure.fbx') }, { path: 'drop/tex/figure.png', file: await get('figure.png') }, { path: 'drop/crate/crate.obj', file: await get('originals/crate.obj') },
        { path: 'drop/crate/crate.mtl', file: await get('originals/crate.mtl') }, { path: 'drop/crate/crate.png', file: await get('originals/crate.png') }]);
      return 0; })()`);
    if (!await until(`!UP.planning && UP.rows.length === 2 && UP.rows.every(r => r.how !== 'measuring')`, 20000)) { out.push('the test originals made no plan: ' + JSON.stringify(await ss('STUDIO.state().upload')).slice(0, 300)); bad(out); return; }
    const b0 = await before();
    await ss('(renderPanes(), 0)');
    await vp.click('#pane-upload [data-act="up:pv"][data-v="0"]');
    if (!await until(`VW.open && !VW.busy && !!VW.root`, 30000)) { out.push('the figure\'s Preview did not open the viewer: ' + JSON.stringify(await ss('vwState()'))); bad(out); return; }
    const fs = await ss('vwState()'), fp = await px([[0.5, 0.5], [0.04, 0.5]]), fl = await vp.evaluate(() => !document.querySelector('#stuViewer [data-lite]').hidden);
    if (fs.kind !== 'up' || !fs.lite || fs.cur !== 12 || JSON.stringify(fs.size) !== '[0.4,1.7,0.3]' || !fl || off(fp[0]) < 40 || off(fp[1]) > 12) out.push('the figure from its row (stood up, 1.7 m, its 12 triangles, the lighter row shown; drawn in the middle): ' + JSON.stringify({ fs, fp, fl }));
    await vp.click('#stuViewer [data-vw="close"]');
    if (await ss('VW.open') || !await ss(`!!UP.rows[0].pv && /^Seen in the viewer: 12 triangles/.test(UP.rows[0].pv.words)`)) out.push('Close from the figure\'s row: ' + JSON.stringify(await ss('[VW.open, UP.rows[0].pv]')));
    await ss('upClear()');
    // the ball: 24,320 triangles, 20 % to start
    const b64 = await ballB64();
    await vp.evaluate(b64 => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); HOST.cur.peek('upTake')([{ path: 'ball.glb', file: new File([u], 'ball.glb') }]); }, b64);
    if (!await until(`!UP.planning && UP.rows.length === 1`, 20000)) { out.push('the ball made no plan'); bad(out); return; }
    await ss('(renderPanes(), 0)');
    await vp.click('#pane-upload [data-act="up:pv"][data-v="0"]');
    if (!await until(`VW.open && !VW.busy && !!VW.root && VW.n1 < VW.cur`, 60000)) { out.push('the ball\'s Preview did not make it lighter: ' + JSON.stringify(await ss('vwState()'))); bad(out); return; }
    let s = await ss('vwState()');
    if (s.cur !== 24320 || s.keep !== 0.2 || s.mode !== 'all' || Math.abs(s.n1 / 24320 - 0.2) > 0.01) out.push('the ball at 20 % (all its triangles shown first): ' + JSON.stringify(s));
    const counts = await vp.evaluate(() => document.querySelector('#stuViewer .vw-counts').textContent);
    if (!/^All: 24,320 · Lighter: 4,8\d\d$/.test(counts)) out.push('the counts: ' + counts);
    // all its triangles, the lighter one and side by side: the wireframe's edges the more, the more triangles drawn
    const eAll = await ss(WIRE);
    await vp.click('#stuViewer [data-vw="mode"][data-v="lite"]');
    const eLite = await ss(WIRE), geo = await ss(`(vwDraw(0), VW.meshes.every(e => e.m.geometry === VW.geos.get(e.g0)))`);
    await vp.click('#stuViewer [data-vw="mode"][data-v="both"]');
    const pBoth = await px([[0.25, 0.5], [0.75, 0.5], [0.02, 0.5], [0.98, 0.5]]), eBoth = await ss(WIRE), sides = await vp.evaluate(() => [...document.querySelectorAll('#stuViewer .vw-side')].map(e => (e.hidden ? '' : e.textContent)));
    if (!geo || !(eAll[0] > eLite[0] * 1.2)) out.push('Lighter draws the lighter geometry (fewer edges under the wireframe than all its triangles): ' + JSON.stringify({ eAll, eLite, geo }));
    if (off(pBoth[0]) < 40 || off(pBoth[1]) < 40 || off(pBoth[2]) > 12 || off(pBoth[3]) > 12 || !(eBoth[1] > eBoth[2] * 1.2) || !/^All triangles: 24,320$/.test(sides[0]) || !/^Lighter, 20 %: 4,8\d\d$/.test(sides[1])) out.push('Side by side: two drawn, all on the left (more edges), the lighter on the right, each said: ' + JSON.stringify({ pBoth, eBoth, sides }));
    // the slider at 50 % (let go): the lighter one made again
    await vp.evaluate(() => { const r = document.querySelector('#stuViewer [data-vw-keep]'); r.value = 50; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
    if (!await until(`!VW.busy && VW.keep === 0.5`, 60000)) out.push('the slider at 50 % made nothing');
    s = await ss('vwState()');
    if (Math.abs(s.n1 / 24320 - 0.5) > 0.02 || s.mode !== 'both') out.push('the lighter one at 50 %: ' + JSON.stringify(s));
    // Close: the share and what was seen back on the row; nothing written
    await vp.click('#stuViewer [data-vw="close"]');
    const row = await ss(`(renderPanes(), [VW.open, UP.rows[0].keep, UP.rows[0].pv && UP.rows[0].pv.words, document.querySelector('#stuRangeUp0').value, /Seen in the viewer: 24,320 triangles became 1[12],\\d\\d\\d\\./.test(document.querySelector('#pane-upload .stu-plan').textContent)])`);
    if (row[0] || row[1] !== 0.5 || !/^Seen in the viewer: 24,320 triangles became 1[12],\d\d\d\.$/.test(row[2]) || row[3] !== '50' || !row[4]) out.push('Close: the share and what was seen on the row: ' + JSON.stringify(row));
    const after = await before();
    if (JSON.stringify(after) !== JSON.stringify(b0)) out.push('the Preview wrote something: ' + JSON.stringify({ b0, after }));
    await ss(`(upClear(), X.tab = 'scene', renderPanes(), 0)`);
    bad(out);
  });

  await step('studio viewer: Fewer triangles\' Look closer on a placed model (the ball): the object\'s own tint, all its triangles and the share as on its card; the share chosen there back on the card as it closes (Esc)', async () => {
    const out = [];
    const ball = Buffer.from(await ballB64(), 'base64');
    await vp.route('**/scenes/test/ball.glb*', r => r.fulfill({ body: ball, contentType: 'model/gltf-binary' }));
    const u0 = await ss('UNDO.length');
    const id = await ss(`(setEdit(true), setFiles(STU.files.concat({ path: 'ball.glb', bytes: ${ball.length}, at: 5, kind: 'model' })), addModel('ball.glb'))`);
    if (!await until(`(() => { const a = STU.items.get('${id}'); return a && a.model && a.a > 0.99; })()`, 30000)) { out.push('the ball was not placed'); bad(out); return; }
    await ss(`(setRec('${id}', { tint: '#ff5a4b' }), select('${id}'), X.tab = 'item', renderPanes(), 0)`);
    await vp.click('#pane-item [data-act="ft:open"]');
    if (!await until(`!!FT.pv && !FT.busy`, 30000)) { out.push('Fewer triangles made no preview'); bad(out); return; }
    await ss('(renderPanes(), 0)');
    const b0 = await before();
    await vp.click('#pane-item [data-act="ft:look"]');
    if (!await until(`VW.open && !VW.busy && !!VW.root && VW.n1 < VW.cur`, 60000)) { out.push('Look closer did not open the viewer: ' + JSON.stringify(await ss('vwState()'))); bad(out); return; }
    const s = await ss('vwState()'), col = await ss(`VW.mats.filter(x => !x.mat.isMeshBasicMaterial).map(x => x.mat.color.toArray().map(v => +v.toFixed(3)).join()).join(';')`);
    if (s.kind !== 'ft' || s.cur !== 24320 || s.keep !== 0.2 || Math.abs(s.n1 / 24320 - 0.2) > 0.01 || col !== '1,0.353,0.294') out.push('Look closer: the ball as placed (its tint), its triangles and the card\'s share: ' + JSON.stringify({ s, col }));
    const p = await px([[0.5, 0.5]]);
    if (!(p[0][0] > p[0][1] + 30)) out.push('the ball drawn red (its tint) in the middle: ' + JSON.stringify(p));
    await vp.evaluate(() => { const r = document.querySelector('#stuViewer [data-vw-keep]'); r.value = 30; r.dispatchEvent(new Event('change', { bubbles: true })); });
    if (!await until(`!VW.busy && VW.keep === 0.3 && VW.mode === 'both'`, 60000)) out.push('the slider at 30 %: ' + JSON.stringify(await ss('vwState()')));
    await vp.keyboard.press('Escape');
    if (!await until(`!VW.open && FT.keep === 0.3 && !!FT.pv && FT.pv.keep === 0.3 && !FT.busy`, 60000)) out.push('Esc: the card\'s share at 30 % (its preview made again): ' + JSON.stringify(await ss('[VW.open, STUDIO.state().lite.ft]')));
    const after = await before();
    if (JSON.stringify(after) !== JSON.stringify(b0)) out.push('Look closer wrote something: ' + JSON.stringify({ b0, after }));
    await ss(`(ftClose(), select(''), X.tab = 'scene', renderPanes(), 0)`);
    while (await ss('UNDO.length') > u0) await ss('undo()');
    await ss(`(setFiles(STU.files.filter(f => f.path !== 'ball.glb')), 0)`);
    await vp.unroute('**/scenes/test/ball.glb*');
    bad(out);
    await vp.close();
  });
}
// The studio's shapes, empties, locks, the scene's settings and the lobby hook (tools/studio/SPEC.md, "Shapes and
// empties", "Locked in place", "The scene's settings"), on a page of its own at the test scene: the Add pane's four shapes
// and an empty, a shape's card (its kind, look, colour, size; page and headset); pixels read back from renders: a shape that
// hides things hides an object behind it (the stage behind shows there) and one in its colour draws it; a sound following
// an empty (as it moves, the cards on both sides, a cube hiding the empty silencing it); Lock in place refusing every way
// (the card's buttons, the Delete key, the page's arrows, a pretend headset's grip, both grips, a corner, Hold it, a group
// with a locked member saying which, an object with a locked cut-out not deleted) and Unlock, one Undo step each; the
// scene's settings rows (page and headset) and the shell's hooks told (stubbed) at a pretend station, away, for another
// scene and when the studio goes; the lobby hook forgetting what was seen; the state and layout.json with all of it
if (runs('studio shapes')) {
  const sp = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  sp.on('pageerror', e => errors.push('studio shapes: ' + (e.stack || e.message)));
  sp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('studio shapes: ' + m.text()); });
  const ss = s => sp.evaluate(s => HOST.cur.peek(s), s);
  const until = (src, ms) => sp.waitForFunction(src => HOST.cur.peek(src), src, { timeout: ms || 20000 }).then(() => true, () => false);
  const bad = list => { if (list.length) errors.push(...list.map(b => 'studio shapes: ' + b)); };
  // (in the page: the scene drawn from a camera of its own and read back where scene points land, the items named hidden
  // for that drawing and nothing of editing drawn; the hooks the shell would be told, recorded)
  const HELP = `window.__sh = window.__sh || {
    shot: (eye, tgt, pts, hide) => {
      const W = 320, H = 200, r = GL.renderer, rt = new THREE.WebGLRenderTarget(W, H), cam = new THREE.PerspectiveCamera(60, W / H, 0.02, 200);
      itemsStep(0, performance.now()); GL.world.updateMatrixWorld(true);
      cam.position.copy(GL.items.localToWorld(new THREE.Vector3(...eye))); cam.lookAt(GL.items.localToWorld(new THREE.Vector3(...tgt))); cam.updateMatrixWorld();
      const hid = [GL.edit, GL.selBox, GL.hoverBox, GL.tc].filter(Boolean).concat([...STU.items.values()].filter(i => (i.kind !== 'o' && i.kind !== 'p') || (hide || []).includes(i.id)).map(i => i.holder));
      const keep = hid.map(o => o.visible);
      hid.forEach(o => { o.visible = false; });
      r.setRenderTarget(rt); r.render(GL.scene, cam);
      const px = pts.map(p => { const v = GL.items.localToWorld(new THREE.Vector3(...p)).project(cam), b = new Uint8Array(4); r.readRenderTargetPixels(rt, Math.round((v.x + 1) / 2 * W), Math.round((v.y + 1) / 2 * H), 1, 1, b); return [b[0], b[1], b[2]]; });
      r.setRenderTarget(null); hid.forEach((o, i) => { o.visible = keep[i]; }); rt.dispose();
      return px;
    },
  }`;
  const dpx = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  // (the shell's two hooks, recorded instead: only those methods replaced, whatever else the shell keeps on them)
  const hooks = `(window.__hk = [], HOST.collab.hideOthers = v => window.__hk.push(['hide', v]), HOST.occlusion = HOST.occlusion || {}, HOST.occlusion.scene = v => window.__hk.push(['occ', v]), 0)`;
  const hk = n => sp.waitForFunction(n => window.__hk.length >= n, n, { timeout: 15000 }).then(() => true, () => false);
  await step('studio shapes: the Add pane\'s shapes and empty, a shape\'s card (kind, look, colour, size, page and headset), the arrows sizing it per axis, the Items pane, one Undo step each', async () => {
    await sp.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&scene=test&edit');
    await sp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    if (!await until(`STUDIO.ready() && !!STU.items.get('box001').model`, 120000)) { errors.push('studio shapes: the test scene did not load'); return; }
    await ss(`(${HELP}, ${hooks}, X.tab = 'add', renderPanes(), 0)`);
    const out = [];
    // (each placed is selected, its card shown: the Add pane again for the next)
    for (const k of ['shape:cube', 'shape:sphere', 'shape:cylinder', 'shape:plane', 'empty']) { await ss(`(X.tab = 'add', renderPanes(), 0)`); await sp.click(`#pane-add [data-id="${k}"]`); }
    const r = await ss(`(() => {
      const ps = [...STU.items.values()].filter(i => i.kind === 'p'), es = [...STU.items.values()].filter(i => i.kind === 'e');
      STUDIO.ids = { box: ps[0].id, ball: ps[1].id, cyl: ps[2].id, plane: ps[3].id, emp: es[0].id };
      return { n: [ps.length, es.length, UNDO.length], recs: ps.map(i => [i.rec.name, i.rec.shape, i.rec.size.join(), i.rec.colour, i.rec.look, i.rec.p[1], i.look.mesh.geometry.type]),
        e: es.map(i => [i.rec.name, i.rec.p[1], JSON.stringify(i.rec.q), i.holder.visible]), sel: STU.sel === es[0].id };
    })()`);
    if (JSON.stringify(r.n) !== '[4,1,5]' || !r.sel) out.push('the Add pane\'s shapes and empty: ' + JSON.stringify(r));
    if (JSON.stringify(r.recs) !== JSON.stringify([['Box 2', 'cube', '0.5,0.5,0.5', '#c9d1dc', 'colour', 0.25, 'BoxGeometry'], ['Ball', 'sphere', '0.5,0.5,0.5', '#c9d1dc', 'colour', 0.25, 'SphereGeometry'], ['Cylinder', 'cylinder', '0.5,1,0.5', '#c9d1dc', 'colour', 0.5, 'CylinderGeometry'], ['Plane', 'plane', '1,1,0.01', '#c9d1dc', 'colour', 0.5, 'PlaneGeometry']]))
      out.push('the shapes placed: ' + JSON.stringify(r.recs));
    if (JSON.stringify(r.e) !== JSON.stringify([['Empty', 1.2, '[0,0,0,1]', true]])) out.push('the empty placed: ' + JSON.stringify(r.e));
    // the shape's card on the page: its colour (a swatch), its look, its kind, its size per side and every side
    await ss(`(select(STUDIO.ids.box), X.tab = 'item', renderPanes(), 0)`);
    const u0 = await ss('UNDO.length');
    const card = (await sp.textContent('#pane-item')).replace(/\s+/g, ' ');
    if (!/Shape.*Cube.*Sphere.*Cylinder.*Plane/.test(card) || !/Hides things/.test(card) || !/Light grey/.test(card) || !/Lock in place/.test(card) || !(await sp.$('#pane-item [data-id="colour:#ff5a4b"] .stu-sw'))) out.push('the shape\'s card: ' + card.slice(0, 500));
    await sp.click('#pane-item [data-id="colour:#ff5a4b"]');
    await sp.click('#pane-item [data-id="look:hide"]');
    await sp.click('#pane-item [data-id="pgrow:1:+"]');
    await sp.click('#pane-item [data-id="psize:2"]');
    const c = await ss(`(() => { const i = STU.items.get(STUDIO.ids.box); return [i.rec.colour, i.rec.look, i.rec.size.join(), UNDO.length, i.look.mesh.material.colorWrite, i.look.mesh.renderOrder, '#' + i.look.fill.material.color.getHexString()]; })()`);
    if (JSON.stringify(c) !== JSON.stringify(['#ff5a4b', 'hide', '1,1.2,1', u0 + 4, false, -1, '#ff5a4b'])) out.push('the card\'s colour, look and size: ' + JSON.stringify(c));
    await sp.click('#pane-item [data-id="pshape:cylinder"]');
    const k = await ss(`(() => { const i = STU.items.get(STUDIO.ids.box); return [i.rec.shape, i.look.mesh.geometry.type, i.rec.size.join()]; })()`);
    if (JSON.stringify(k) !== '["cylinder","CylinderGeometry","1,1.2,1"]') out.push('another kind of shape: ' + JSON.stringify(k));
    await ss('(undo(), undo(), undo(), undo(), undo(), 0)');
    const back = await ss(`(() => { const i = STU.items.get(STUDIO.ids.box); return JSON.stringify([i.rec.shape, i.rec.colour, i.rec.look, i.rec.size]); })()`);
    if (back !== '["cube","#c9d1dc","colour",[0.5,0.5,0.5]]') out.push('Undo did not take the card\'s changes back one at a time: ' + back);
    // the page's arrows size a shape per axis (in its own frame)
    const tc = await ss(`(() => {
      const i = STU.items.get(STUDIO.ids.box), u = UNDO.length;
      select(i.id); tcSetMode('scale'); const on = GL.tc.object === i.holder, space = GL.tc.space;
      GL.tc.dispatchEvent({ type: 'dragging-changed', value: true }); i.holder.scale.set(1, 0.5, 2); GL.tc.dispatchEvent({ type: 'objectChange' }); GL.tc.dispatchEvent({ type: 'dragging-changed', value: false });
      tcSetMode('translate');
      return [on, space, i.rec.size.join(), UNDO.length - u];
    })()`);
    if (JSON.stringify(tc) !== '[true,"local","1,0.5,2",1]') out.push('the page\'s arrows sizing a shape: ' + JSON.stringify(tc));
    // the Items pane lists shapes and empties
    await ss(`(X.tab = 'items', renderPanes(), 0)`);
    const items = (await sp.textContent('#pane-items')).replace(/\s+/g, ' ');
    if (!/Shapes.*Box 2.*Ball.*Cylinder.*Plane.*Empties.*Empty/.test(items) || !/4 shapes · 1 empties/.test(items)) out.push('the Items pane: ' + items.slice(0, 500));
    // the headset's card: the same rows, a colour pressed by its button
    const xr = await ss(`(() => {
      XR.on = true;
      const draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } };
      const ids = new Set(), press = id => { for (let off = 0; off < 5000; off += 150) { X.scroll.item = off; draw(); const q = XR.main.regions.find(z => z.id === id); if (q && q.fn) { q.fn(); X.scroll = {}; draw(); return true; } } X.scroll = {}; return false; };
      select(STUDIO.ids.ball); X.tab = 'item';
      for (let off = 0; off < 5000; off += 150) { X.scroll.item = off; draw(); for (const q of XR.main.regions) ids.add(q.id); }
      X.scroll = {};
      const miss = ['lock', 'pshape:cube', 'pshape:plane', 'look:colour', 'look:hide', 'colour:#46d9ff', 'pgrow:0:+', 'psize:2', 'turn', 'floor', 'mkgroup', 'hold', 'dup', 'del'].filter(i => !ids.has(i));
      const pr = press('colour:#46d9ff'), col = STU.items.get(STUDIO.ids.ball).rec.colour;
      XR.on = false; X.tab = 'scene'; renderPanes();
      return { miss, pr, col };
    })()`);
    if (xr.miss.length || !xr.pr || xr.col !== '#46d9ff') out.push('the headset\'s shape card: ' + JSON.stringify(xr));
    bad(out);
  });
  await step('studio shapes: pixels: a shape that hides things hides an object behind it (the stage behind it shows there), one in its colour draws it, and with editing on the first is a see-through fill', async () => {
    const out = [];
    // the box (box001, 0.5 m at [-1, 0.25, -2]) seen from in front; a hiding box 0.6 m across put between, 1 m in front of it
    const id = await ss(`(() => { const id = addShape('cube'); setRec(id, { p: [-1, 0.3, -1], size: [0.6, 0.6, 0.6], look: 'hide' }); setRec('box001', { anim: 'off' }); setEdit(false); return id; })()`);
    if (!await until(`STU.items.get('${id}').a > 0.99 && STU.items.get('box001').a > 0.99`, 10000)) out.push('the shapes did not fade in');
    // (seen a little upwards: the sky behind the box, not the floor's grid)
    const eye = [-1, 0.2, 1.5], tgt = [-1, 0.4, -1.75], pt = [[-1, 0.4, -1.75]];
    const others = await ss(`[...STU.items.values()].filter(i => (i.kind === 'o' || i.kind === 'p') && i.id !== 'box001' && i.id !== '${id}').map(i => i.id)`);
    const [box] = await ss(`window.__sh.shot(${JSON.stringify(eye)}, ${JSON.stringify(tgt)}, ${JSON.stringify(pt)}, ${JSON.stringify(others.concat(id))})`);
    const [none] = await ss(`window.__sh.shot(${JSON.stringify(eye)}, ${JSON.stringify(tgt)}, ${JSON.stringify(pt)}, ${JSON.stringify(others.concat(id, 'box001'))})`);
    const [hid] = await ss(`window.__sh.shot(${JSON.stringify(eye)}, ${JSON.stringify(tgt)}, ${JSON.stringify(pt)}, ${JSON.stringify(others)})`);
    if (dpx(box, none) < 40) out.push('the box does not show in the view: ' + JSON.stringify([box, none]));
    if (dpx(hid, none) > 12) out.push('a shape that hides things did not hide the box behind it (the stage should show): ' + JSON.stringify({ box, none, hid }));
    await ss(`(setRec('${id}', { look: 'colour', colour: '#ff5a4b' }), 0)`);
    const [col] = await ss(`window.__sh.shot(${JSON.stringify(eye)}, ${JSON.stringify(tgt)}, ${JSON.stringify(pt)}, ${JSON.stringify(others)})`);
    if (!(col[0] > col[1] + 40 && col[0] > col[2] + 40)) out.push('a shape in red did not draw red: ' + JSON.stringify(col));
    const ed = await ss(`(setRec('${id}', { look: 'hide' }), setEdit(true), itemsStep(0, performance.now()), [STU.items.get('${id}').look.fill.visible, STU.items.get('${id}').look.line.visible, STU.items.get('${id}').look.mesh.visible])`);
    if (JSON.stringify(ed) !== '[true,true,true]') out.push('a shape that hides things is not drawn see-through while editing (it still hides): ' + JSON.stringify(ed));
    await ss(`(deleteItem('${id}'), 0)`);
    bad(out);
  });
  await step('studio shapes: a sound follows an empty (as it moves; the cards on both sides; picked by pointing), a cube hiding the empty silences it, an empty is drawn only while editing', async () => {
    const r = await ss(`(() => {
      const out = [], e = STUDIO.ids.emp, snd = addSound('tone.wav');
      select(snd); itemAct('followPick');
      pressItem(e);   // (the pointer on the empty, picking what the sound follows)
      const sr = STU.items.get(snd).rec;
      if (sr.on !== e || STUDIO.follow(snd).d > 0.001) out.push('the sound did not follow the empty: ' + JSON.stringify([sr, STUDIO.follow(snd)]));
      setRec(e, { p: [2, 1.5, -1], q: [0, 0.7071, 0, 0.7071] }); itemsStep(0, performance.now());
      const f = STUDIO.follow(snd);
      if (!f || f.d > 0.001) out.push('the sound did not follow the empty as it moved: ' + JSON.stringify(f));
      select(snd); X.tab = 'item'; renderPanes();
      const sc = document.querySelector('#pane-item').textContent.replace(/\\s+/g, ' ');
      if (!/Follows.*Empty/.test(sc) || /Bone/.test(sc)) out.push('the sound\\'s card: ' + sc.slice(0, 400));
      select(e); renderPanes();
      const ec = document.querySelector('#pane-item').textContent.replace(/\\s+/g, ' ');
      if (!/Followed by.*tone/i.test(ec)) out.push('the empty\\'s card: ' + ec.slice(0, 400));
      // a cube hiding the empty: the sound shown but not heard (its object hidden)
      const cb = addCube(); setRec(cb, { p: [5, 1, 5], hide: [e] });
      const sh = shownFor([5, 1.6, 5]);
      if (sh[e] || !sh[snd] || STU.items.get(snd).heard) out.push('a cube hiding the empty did not silence its sound: ' + JSON.stringify([sh[e], sh[snd], STU.items.get(snd).heard]));
      shownFor(null);
      // not editing: the empty is not drawn
      setEdit(false); itemsStep(0.5, performance.now()); itemsStep(0.5, performance.now());
      const vis = STU.items.get(e).holder.visible;
      setEdit(true); itemsStep(0.5, performance.now());
      if (vis || !STU.items.get(e).holder.visible) out.push('an empty is not drawn only while editing');
      deleteItem(cb); STUDIO.snd = snd;
      return out;
    })()`);
    bad(r);
  });
  await step('studio shapes: Lock in place refuses moving, turning, sizing and deleting every way (the card, the Delete key, the arrows, a pretend headset\'s grip, both grips, a corner, Hold it, a group with a locked member, an object with a locked cut-out) and Unlock gives them back, one Undo step each', async () => {
    const out = [];
    // the card's Lock button (one Undo step), the lock mark in the labels and the Items pane
    // (Undo keeps 30 steps: emptied first, so each count here is this step's own)
    await ss(`(UNDO.length = 0, select(STUDIO.ids.box), X.tab = 'item', renderPanes(), STUDIO.u0 = UNDO.length, 0)`);
    await sp.click('#pane-item [data-id="lock"]');
    const st = await ss(`(() => {
      const i = STU.items.get(STUDIO.ids.box); renderPanes(); updateExtraLabels();
      const dis = id => { const b = document.querySelector('#pane-item [data-id="' + id + '"]'); return !!b && b.disabled; };
      return { locked: i.rec.locked, undo: UNDO.length - STUDIO.u0, dis: ['turn', 'floor', 'psize:2', 'pgrow:0:+', 'del', 'tc:translate'].map(dis), colour: dis('colour:#ff5a4b'), un: document.querySelector('#pane-item [data-id="lock"]').textContent,
        line: /Locked in place: it does not move, turn, size or go/.test(document.querySelector('#pane-item').textContent), label: LBL.extra[1].txt, tc: !!GL.tc.object };
    })()`);
    if (st.locked !== true || st.undo !== 1 || st.dis.some(d => !d) || st.colour || !/Unlock/.test(st.un) || !st.line || st.tc) out.push('locking from the card: ' + JSON.stringify(st));
    if (!/🔒 Box 2/.test(JSON.stringify(st.label))) out.push('the selection\'s label has no lock mark: ' + JSON.stringify(st.label));
    // every way of moving or deleting it refused, the record untouched
    await sp.keyboard.press('Delete');
    const r = await ss(`(() => {
      const out = [], i = STU.items.get(STUDIO.ids.box), rec0 = JSON.stringify(i.rec), u = UNDO.length;
      for (const a of ['turn', 'floor', 'del']) itemAct(a);
      itemAct('psize', 2); itemAct('pgrow', '0:0.1'); deleteItem(i.id); itemAct('hold');
      if (!STU.items.has(i.id) || JSON.stringify(i.rec) !== rec0 || UNDO.length !== u || XR.hold) out.push('the card\\'s actions or Delete moved, sized or deleted it: ' + JSON.stringify([STU.items.has(i.id), i.rec, UNDO.length - u]));
      if (!STU.lockSaid || STU.lockSaid.id !== i.id) out.push('the refusal was not said');
      tcAttach(); if (GL.tc.object) out.push('the arrows are on a locked shape');
      // a pretend headset: the grip, a corner and Hold it refused (a buzz), nothing carried
      XR.on = true; XR.clear = true; GL.world.updateMatrixWorld(true);
      const ctl = (c, p) => { c.src = { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: null }; c.g.visible = true; c.g.matrix.compose(new THREE.Vector3(...p), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); c.o.setFromMatrixPosition(c.g.matrix); };
      const [a, b] = XR.ctrls, w = i.holder.getWorldPosition(new THREE.Vector3());
      ctl(a, [w.x, w.y, w.z + 0.4]); a.hover = { kind: 'item', id: i.id }; xrGrab(a, true);
      ctl(b, [w.x + 0.3, w.y, w.z + 0.4]); b.hover = { kind: 'item', id: i.id }; xrGrab(b, true);
      if (a.grab || b.grab || i.carry) out.push('the grips took a locked shape');
      xrGrab(a, false); xrGrab(b, false);
      a.hover = { kind: 'item', id: i.id, corner: 7 }; xrGrab(a, true);
      if (a.grab) out.push('a corner took a locked shape');
      xrGrab(a, false);
      XR.hold = i.id; a.hover = null; xrGrab(a, true);
      if (a.grab) out.push('Hold it carried a locked shape');
      xrGrab(a, false); XR.on = false; XR.hold = '';
      if (JSON.stringify(i.rec) !== rec0 || UNDO.length !== u) out.push('the headset moved it: ' + JSON.stringify(i.rec));
      // a group with a locked member: it does not move, and says which; an unlocked one moves
      const e = STUDIO.ids.emp; select(e); itemAct('mkgroup'); groupToggle(STU.gpick.id, i.id); const g = STU.gpick.id; gpickEnd();
      const gp0 = JSON.stringify(STU.items.get(e).rec.p);
      select(g); itemAct('turn'); itemAct('size', 2); deleteItem(g);
      if (!STU.items.has(g) || JSON.stringify(STU.items.get(e).rec.p) !== gp0) out.push('a group with a locked member moved or went');
      if (!/^Box 2 is locked in place: the group does not move/.test(lockLine(STU.items.get(g)))) out.push('the group\\'s card does not say which member is locked: ' + lockLine(STU.items.get(g)));
      XR.on = true; ctl(a, [w.x, w.y, w.z + 0.4]); a.hover = { kind: 'item', id: e }; select(''); xrGrab(a, true);
      if (a.grab) out.push('the grip took a group with a locked member');
      xrGrab(a, false); XR.on = false;
      // the group's own lock holds its members, even selected alone
      select(i.id); itemAct('lock'); select(g); itemAct('lock');
      const eq = JSON.stringify(STU.items.get(e).rec.q);
      select(e); itemAct('turn');
      if (JSON.stringify(STU.items.get(e).rec.q) !== eq) out.push('a member of a locked group turned');
      if (!/^Its group .* is locked in place/.test(lockLine(STU.items.get(e)))) out.push('a member\\'s card does not say its group is locked: ' + lockLine(STU.items.get(e)));
      select(g); itemAct('ungroup');
      if (!STU.items.has(g)) out.push('a locked group was ungrouped');
      itemAct('lock'); itemAct('turn');
      if (JSON.stringify(STU.items.get(e).rec.p) === gp0) out.push('the group unlocked did not turn');
      itemAct('ungroup');
      // an object with a locked cut-out is not deleted (the cut-out moves with it)
      select('box001'); itemAct('cut'); const x = STU.sel; itemAct('lock');
      select('box001'); deleteItem('box001');
      if (!STU.items.has('box001') || !/is locked in place: it cannot be deleted/.test(lockLine(STU.items.get('box001')))) out.push('an object with a locked cut-out was deleted, or it is not said: ' + lockLine(STU.items.get('box001')));
      select(x); itemAct('lock'); deleteItem(x);
      select(i.id); itemAct('lock');   // (the shape locked again, for its card's Unlock below)
      return out;
    })()`);
    // unlocked again from the card: it turns, one Undo step
    await ss(`(UNDO.length = 0, select(STUDIO.ids.box), X.tab = 'item', renderPanes(), STUDIO.u1 = UNDO.length, 0)`);
    await sp.click('#pane-item [data-id="lock"]');
    await sp.click('#pane-item [data-id="turn"]');
    const un = await ss(`(() => { const i = STU.items.get(STUDIO.ids.box); return ['locked' in i.rec, UNDO.length - STUDIO.u1, JSON.stringify(i.rec.q) !== '[0,0,0,1]']; })()`);
    if (JSON.stringify(un) !== '[false,2,true]') out.push('Unlock from the card: ' + JSON.stringify(un));
    // the headset's card: Lock pressed there, the turn and Delete then not offered
    const xr = await ss(`(() => {
      XR.on = true;
      const draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } };
      const ids = () => { const s = new Set(); for (let off = 0; off < 5000; off += 150) { X.scroll.item = off; draw(); for (const q of XR.main.regions) s.add(q.id); } X.scroll = {}; return s; };
      select(STUDIO.ids.ball); X.tab = 'item'; X.scroll = {}; draw();
      let q = null;
      for (let off = 0; off < 5000 && !q; off += 150) { X.scroll.item = off; draw(); q = XR.main.regions.find(z => z.id === 'lock'); }
      if (q) q.fn();
      X.scroll = {};
      const s = ids(), r = [!!q, STU.items.get(STUDIO.ids.ball).rec.locked, s.has('turn'), s.has('del'), s.has('lock'), s.has('dup')];
      itemAct('lock'); XR.on = false; X.tab = 'scene'; renderPanes();
      return r;
    })()`);
    if (JSON.stringify(xr) !== '[true,true,false,false,true,true]') out.push('the headset\'s Lock: ' + JSON.stringify(xr));
    bad(out.concat(r));
  });
  await step('studio shapes: the scene\'s settings (page and headset rows, one Undo step each) tell the shell to hide the other circles at this studio\'s circle and how the real world hides the scene, and stop when away, for another scene and when the studio goes', async () => {
    const out = [];
    await ss(`(${hooks}, UNDO.length = 0, X.tab = 'scene', renderPanes(), STUDIO.u2 = UNDO.length, 0)`);
    const txt = (await sp.textContent('#pane-scene')).replace(/\s+/g, ' ');
    if (!/Other circles.*Shown.*Hidden/.test(txt) || !/Real world hides the scene.*As each headset has it.*Always.*Never/.test(txt)) out.push('the Scene pane\'s settings rows: ' + txt.slice(0, 500));
    await sp.click('#pane-scene [data-id="set:others:hidden"]');
    await sp.click('#pane-scene [data-id="set:real:always"]');
    await hk(1);
    const s1 = await ss(`[JSON.stringify(STU.settings), UNDO.length - STUDIO.u2 + (UNDO.every(l => l.length === 1 && l[0].kind === 'set') ? 0 : 10), JSON.stringify(window.__hk), unsaved()]`);
    // (outside a room: no circles to hide; the real world: always)
    if (s1[0] !== '{"others":"hidden","real":"always"}' || s1[1] !== 2 || s1[2] !== '[["occ","both"]]' || !s1[3]) out.push('the settings set outside a room: ' + JSON.stringify(s1));
    // at a pretend station of the studio: the other circles hidden; away: both back; Never; the device's own
    await ss(`(STUDIO.live = HOST.collab.live, HOST.collab.live = () => ({ id: 'st9', story: 'studio' }), 0)`);
    await hk(2);
    await ss(`(HOST.room = HOST.room || {}, STUDIO.away = HOST.room.away, HOST.room.away = () => true, 0)`);
    await hk(4);
    await ss(`(HOST.room.away = STUDIO.away, setSetting('real:never'), 0)`);
    await hk(6);
    await ss(`(setSetting('real:device'), setSetting('others:shown'), 0)`);
    await hk(8);
    const s2 = await ss(`JSON.stringify(window.__hk)`);
    if (s2 !== '[["occ","both"],["hide",true],["hide",false],["occ",null],["hide",true],["occ","off"],["hide",false],["occ",null]]') out.push('the hooks at a station, away and back: ' + s2);
    // Undo takes the settings back (one step each)
    await ss(`(undo(), 0)`); await hk(9);
    const s3 = await ss(`[JSON.stringify(STU.settings), JSON.stringify(window.__hk.slice(8))]`);
    if (s3[0] !== '{"others":"hidden","real":"device"}' || s3[1] !== '[["hide",true]]') out.push('Undo of a setting: ' + JSON.stringify(s3));
    // the headset's Scene pane: the same rows, one pressed
    const xr = await ss(`(() => {
      XR.on = true;
      const draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } };
      X.tab = 'scene'; let q = null;
      for (let off = 0; off < 5000 && !q; off += 150) { X.scroll.scene = off; draw(); q = XR.main.regions.find(z => z.id === 'set:real:never'); }
      const all = q ? ['set:others:shown', 'set:others:hidden', 'set:real:device', 'set:real:always'].every(id => XR.main.regions.some(z => z.id === id)) : false;
      if (q) q.fn();
      X.scroll = {}; XR.on = false; renderPanes();
      return [!!q, all, STU.settings.real];
    })()`);
    if (JSON.stringify(xr) !== '[true,true,"never"]') out.push('the headset\'s settings rows: ' + JSON.stringify(xr));
    // not editing: no rows
    const ne = await ss(`(setEdit(false), renderPanes(), [/Other circles/.test(document.querySelector('#pane-scene').textContent), setEdit(true)][0])`);
    if (ne) out.push('the settings rows show while not editing');
    await ss(`(HOST.collab.live = STUDIO.live, 0)`);
    if (!await hk(11)) out.push('the hooks after leaving the pretend station: ' + await ss('JSON.stringify(window.__hk)'));
    bad(out);
  });
  await step('studio shapes: the lobby hook forgets what this device has seen (a cube that stays, an animation started when shown starts again) and writes nothing to the room', async () => {
    const r = await ss(`(() => {
      const out = [], b = STU.items.get('box001'), cb = addCube();
      setRec(cb, { p: [6, 1, 6], mode: 'stay', show: ['box001'] }); setRec('box001', { start: 'shown', anim: 'loop' });
      shownFor([6, 1.6, 6]); const t1 = b.shownAt; shownFor([0, 1.6, 9]);
      if (!STU.seen.has(cb) || !b.shown) out.push('the stay cube did not hold');
      const s0 = JSON.stringify(collabState());
      HOST.cur.lobby();
      const s1 = JSON.stringify(collabState());
      if (STU.seen.size || !(STU.lobbyAt > 0) || s0 !== s1) out.push('the lobby did not forget, or wrote to the state: ' + JSON.stringify([STU.seen.size, STU.lobbyAt, s0 === s1]));
      const sh = shownFor([0, 1.6, 9]);
      if (sh.box001) out.push('after the lobby the box waits for its cube again: ' + JSON.stringify(sh));
      const t0 = performance.now(); shownFor([6, 1.6, 6]);
      if (!(b.shownAt >= t0)) out.push('the box\\'s animation did not start again from its beginning: ' + JSON.stringify([t1, b.shownAt, t0]));
      shownFor(null); deleteItem(cb); setRec('box001', { start: 'always' });
      return out;
    })()`);
    bad(r);
  });
  await step('studio shapes: the state and layout.json carry shapes, empties, locks and the settings, and give them back; bad records ignored, limits kept, an older layout read as before', async () => {
    const r = await ss(`(() => {
      const out = [], J = JSON.stringify, same = () => { const a = J(collabState()); collabApply(JSON.parse(a)); return J(collabState()) === a; };
      const ball = STUDIO.ids.ball, e = STUDIO.ids.emp;
      select(ball); itemAct('lock'); setSetting('others:hidden');
      const s0 = collabState();
      if (!s0['p.' + ball] || !s0['e.' + e] || s0['p.' + ball].locked !== true || J(s0.settings) !== '{"others":"hidden","real":"never"}' || !same()) out.push('the state: ' + J(s0).slice(0, 500));
      // the room's: a new shape and empty taken; bad ones ignored (the items kept); settings bad (kept) or absent (a new scene's)
      const st = JSON.parse(J(s0));
      st['p.zz0001'] = { name: 'Wall', shape: 'plane', p: [0, 1, -3], size: [3, 2, 0.01], colour: '#FFFFFF', look: 'hide', locked: false };
      st['e.zz0002'] = { name: 'Here', p: [1, 1.7, -1], locked: true };
      collabApply(st);
      const w = STU.items.get('zz0001'), h = STU.items.get('zz0002');
      if (!w || w.rec.colour !== '#ffffff' || 'locked' in w.rec || !h || h.rec.locked !== true || !same()) out.push('the room\\'s shape and empty: ' + J([w && w.rec, h && h.rec]));
      const was = J(collabState()), b2 = JSON.parse(was);
      Object.assign(b2, { 'p.zz0001': { shape: 'cone', p: [0, 0, 0] }, 'p.zz0003': { p: [0, 0, 0], colour: 'red' }, 'e.zz0002': { p: [0, 0, 0], locked: 'yes' }, 'p.zz0004': { p: [0, 0, 0], size: 2 }, settings: { others: 'gone' } });
      collabApply(b2);
      if (J(collabState()) !== was) out.push('bad records or settings were taken: ' + J(collabState()).slice(0, 500));
      const b3 = JSON.parse(was); delete b3.settings; collabApply(b3);
      if (J(STU.settings) !== '{"others":"shown","real":"device"}') out.push('a state without settings did not give a new scene\\'s: ' + J(STU.settings));
      collabApply(JSON.parse(was));
      // limits: 200 shapes from the room at most
      const many = JSON.parse(was); for (let k = 0; k < 230; k++) many['p.m' + String(k).padStart(5, '0')] = { p: [k * 0.01, 0, 0] };
      collabApply(many);
      if (countOf('p') !== 200) out.push('the room\\'s shapes past 200 were taken: ' + countOf('p'));
      collabApply(JSON.parse(was));
      // layout.json: written and read back the same (Unsaved changes follows); a v118 layout reads as before; bad settings counted
      const L = layoutOut(), back = readLayout(JSON.parse(J(L)));
      if (!L.shapes.length || !L.empties.length || J(L.settings) !== '{"others":"hidden","real":"never"}' || back.bad || keyOf(back.items, back.settings) !== keyOf()) out.push('layout.json with shapes, empties and settings: ' + J([L.shapes.length, L.empties.length, L.settings, back.bad]));
      const old = readLayout({ studio: 1, objects: [{ id: 'aaa111', file: 'box.glb', p: [0, 0, 0] }] });
      if (old.bad || J(old.settings) !== '{"others":"shown","real":"device"}' || old.items.length !== 1) out.push('an older layout: ' + J(old));
      const bs = readLayout({ studio: 1, settings: { real: 'sometimes' }, shapes: [{ id: 'bbb222', p: [0, 0, 0], shape: 'cube' }, { id: 'bbb333', p: [0, 0, 0], look: 'glass' }], empties: [{ id: 'ccc444', p: [0, 1, 0] }], groups: [{ id: 'ggg555', items: ['bbb222', 'ccc444'] }] });
      if (bs.bad !== 2 || bs.items.length !== 3 || J(bs.settings) !== '{"others":"shown","real":"device"}') out.push('bad settings and a bad shape in a layout, a group of a shape and an empty: ' + J(bs));
      select(ball); itemAct('lock');
      return out;
    })()`);
    bad(r);
  });
  await step('studio shapes: the studio\'s hooks told off for another scene (a new scene\'s settings) and when the studio goes (the other circles shown, the real world as each headset has it)', async () => {
    await ss(`(${hooks}, setSetting('real:always'), 0)`);
    await hk(1);
    await ss(`(openScene('textures', 'pick'), 0)`);
    await hk(2);
    const sc = await ss(`[JSON.stringify(STU.settings), JSON.stringify(window.__hk)]`);
    if (sc[0] !== '{"others":"shown","real":"device"}' || sc[1] !== '[["occ","both"],["occ",null]]') bad(['another scene\'s settings and the hooks: ' + JSON.stringify(sc)]);
    await until(`STU.listing === 'ok'`, 30000);
    await ss(`(setSetting('real:never'), 0)`);
    await hk(3);
    await sp.evaluate(() => HOST.go('design'));
    await sp.waitForFunction(() => HOST.curKey === 'design', null, { timeout: 60000 }).catch(() => {});
    const got = await sp.evaluate(() => JSON.stringify(window.__hk));
    if (!/\["hide",false\],\["occ",null\]\]$/.test(got)) bad(['the hooks when the studio went: ' + got]);
    await sp.close();
  });
}
// The studio's behaviours (tools/studio/SPEC.md, "Behaviours"), on a page of its own at the test scene, with a turned shape
// that looks, a ball that follows, an empty that keeps away and a cube that follows the ball put in for these steps, and a
// pretend head moved about (STU.head, and pretend others: BEH.fake), the clock held (behNow): each kind's pose against the
// head (its front to them, dist in front of them at its own height, at least dist away within its area, an item at its
// offset, not following its target's spin), never faster than its speed, home with nobody in range, the record never
// changed; nearest and first with several heads (another nearer by more than 0.3 m, kept until range + 0.5 m, ties by id,
// pages never counting); going on while selected (editing), resting while carried or paused and starting again from its place; a driver's samples
// drawn 120 ms behind them (on one page, by a pretend other device's effect); the cards' rows (page and headset, Follow an
// item... by pointing and by the list), one Undo step each; the state and layout.json, bad values refused, a group's copy
if (runs('studio behaviours')) {
  const bp = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  bp.on('pageerror', e => errors.push('studio behaviours: ' + (e.stack || e.message)));
  bp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('studio behaviours: ' + m.text()); });
  const ss = s => bp.evaluate(s => HOST.cur.peek(s), s);
  const until = (src, ms) => bp.waitForFunction(src => HOST.cur.peek(src), src, { timeout: ms || 20000 }).then(() => true, () => false);
  const bad = list => { if (list.length) errors.push(...list.map(b => 'studio behaviours: ' + b)); };
  // (in the page: the items these steps need, and frames run with the clock held: n frames of dt s, the pretend head moved
  // first; drawn: an item's drawn matrix; mid: its middle as drawn; front: which way its front faces (atan2 of x, z))
  const PUT = `(putItem('bhl001', 'p', norm('p', { name: 'Looker', shape: 'cube', p: [2, 0.5, -1], q: [0, 0.3827, 0, 0.9239], size: [0.4, 0.6, 0.2], behaviour: { kind: 'look' } })),
    putItem('bhf001', 'p', norm('p', { name: 'Ball', shape: 'sphere', p: [0, 0.5, -2], behaviour: { kind: 'follow', dist: 1 } })),
    putItem('bha001', 'e', norm('e', { name: 'Shy', p: [-2, 1.2, -2], behaviour: { kind: 'avoid', dist: 1.5, area: 2, speed: 1 } })),
    putItem('bhi001', 'p', norm('p', { name: 'Tail', shape: 'cube', p: [0.8, 0.25, -2], behaviour: { kind: 'item', target: 'bhf001', speed: 2 } })), select(''), 0)`;
  const HELP = `window.__bh = window.__bh || {
    T: 0, V: (...a) => new THREE.Vector3(...a),
    // (exact: the time others' samples are drawn at put right on the clock's 120 ms ago every frame, not eased to it)
    run: (n, dt, head, exact) => { const B = window.__bh, keep = behNow, sc = sceneClock; if (!B.T) B.T = performance.now(); if (head !== undefined) STU.head = head; behNow = () => B.T; sceneClock = () => B.T / 1000;
      const mids = {};
      try { for (let k = 0; k < n; k++) { B.T += dt * 1000; if (exact) BEH.rt.at = 0; behaveStep(dt, performance.now()); itemsStep(dt, performance.now()); for (const id of ['bhl001', 'bhf001', 'bha001', 'bhi001']) if (STU.items.has(id)) (mids[id] = mids[id] || []).push(B.mid(id)); } } finally { behNow = keep; sceneClock = sc; }
      return mids; },
    drawn: id => { const H = STU.items.get(id).holder; return H.matrixAutoUpdate ? new THREE.Matrix4().compose(H.position, H.quaternion, H.scale) : H.matrix.clone(); },
    placed: id => { const H = STU.items.get(id).holder; return new THREE.Matrix4().compose(H.position, H.quaternion, H.scale); },
    mid: id => { const it = STU.items.get(id); return (it.kind === 'o' && it.model ? it.proxy.position.clone() : new THREE.Vector3()).applyMatrix4(window.__bh.drawn(id)); },
    front: id => { const d = new THREE.Vector3(0, 0, 1).transformDirection(window.__bh.drawn(id)); return Math.atan2(d.x, d.z); },
    // the fastest a list of middles moved in a frame, along the floor
    fastest: L => Math.max(0, ...L.slice(1).map((p, k) => Math.hypot(p.x - L[k].x, p.z - L[k].z))),
    far: (a, b) => Math.max(...a.elements.map((v, i) => Math.abs(v - b.elements[i]))),
    ang: (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))),
  }`;
  await step('studio behaviours: each kind against a pretend head moved about (look, follow, keep away, follow an item, not its spin), never faster than its speed, home with nobody in range, the record unchanged', async () => {
    await bp.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&scene=test&edit');
    await bp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    if (!await until(`STUDIO.ready() && !!STU.items.get('box001').model`, 120000)) { bad(['the test scene did not load']); return; }
    await ss(`(${HELP}, ${PUT}, 0)`);
    const r = await ss(`(() => {
      const B = window.__bh, o = [], recsOf = () => JSON.stringify(Object.fromEntries([...STU.items.values()].filter(it => it.id !== 'box001').map(it => [it.id, it.rec]))), recs = recsOf();
      // far away: nothing reacts, everything where it is placed (the pipeline on: a behaviour is in the scene)
      B.run(10, 1 / 30, [20, 1.6, 20, 0]);
      if (!STUDIO.behave('bhf001').base || ['bhl001', 'bhf001', 'bha001', 'bhi001'].some(id => STUDIO.behave(id).on || B.far(B.drawn(id), B.placed(id)) > 1e-9)) o.push('far away, something moved: ' + JSON.stringify(STUDIO.behave('bhf001')));
      // look: its front turns to the head (2.5 m to its right, along x), its middle where it is
      const m0 = B.mid('bhl001');
      B.run(120, 1 / 30, [4.5, 1.6, -1, 0]);
      const lk = STUDIO.behave('bhl001');
      if (lk.who !== 'me' || !lk.drive || Math.abs(B.front('bhl001') - Math.PI / 2) > 0.01 || B.mid('bhl001').distanceTo(m0) > 1e-6) o.push('look: ' + JSON.stringify([lk, B.front('bhl001'), B.mid('bhl001')]));
      // follow: comes to 1 m in front of the head (looking along -x), at its own height, turned to them, never faster than 0.6 m/s
      const fm = B.run(300, 1 / 30, [0.5, 1.6, -0.5, Math.PI / 2]).bhf001, fw = B.mid('bhf001');
      if (fw.distanceTo(B.V(-0.5, 0.5, -0.5)) > 0.01 || Math.abs(B.front('bhf001') - Math.PI / 2) > 0.01 || B.fastest(fm) > 0.6 / 30 + 1e-6) o.push('follow: ' + JSON.stringify([fw, B.front('bhf001'), B.fastest(fm)]));
      // an item following it: at its offset as they are placed, on the ball as drawn (before its motion); then the ball spins:
      // the tail stays put
      const want = B.drawn('bhf001').multiply(B.placed('bhf001').invert()).multiply(B.placed('bhi001')), got = B.drawn('bhi001');
      if (B.far(want, got) > 0.01) o.push('the item following the ball: ' + B.far(want, got));
      setRec('bhf001', { motion: { kind: 'spin', speed: 30 } });
      B.run(1, 1 / 30);
      const t0 = B.drawn('bhi001'), f0 = B.front('bhf001');
      B.run(15, 1 / 30);   // (half a second: a quarter turn)
      if (B.far(B.drawn('bhi001'), t0) > 1e-3 || Math.abs(B.ang(B.front('bhf001'), f0) - Math.PI / 2) > 0.01) o.push('the ball spinning: its tail moved, or the ball did not spin: ' + [B.far(B.drawn('bhi001'), t0), B.front('bhf001'), f0]);
      setRec('bhf001', { motion: undefined });
      // Faces: The item (v128): settled, the tail's middle where its offset on the ball puts it (as before) and its front to
      // the ball's middle, within a degree; As placed again, it turns back with the ball
      setRec('bhi001', { behaviour: { kind: 'item', target: 'bhf001', speed: 2, face: 'them' } });
      B.run(90, 1 / 30);
      const tw = B.drawn('bhf001').multiply(B.placed('bhf001').invert()).multiply(B.placed('bhi001')), tm = new THREE.Vector3().setFromMatrixPosition(tw), tg = B.mid('bhi001'), bb = B.mid('bhf001');
      if (tg.distanceTo(tm) > 1e-3 || B.ang(B.front('bhi001'), Math.atan2(bb.x - tg.x, bb.z - tg.z)) > Math.PI / 180) o.push('the tail facing the ball: ' + JSON.stringify([tg.distanceTo(tm), B.front('bhi001'), Math.atan2(bb.x - tg.x, bb.z - tg.z)]));
      setRec('bhi001', { behaviour: { kind: 'item', target: 'bhf001', speed: 2 } });
      B.run(90, 1 / 30);
      if (B.far(B.drawn('bhi001'), B.drawn('bhf001').multiply(B.placed('bhf001').invert()).multiply(B.placed('bhi001'))) > 0.01) o.push('the tail as placed again: ' + B.far(B.drawn('bhi001'), B.drawn('bhf001').multiply(B.placed('bhf001').invert()).multiply(B.placed('bhi001'))));
      // keep away: the head 0.36 m from its place: it goes to 1.5 m from the head, never more than 2 m from its place
      const am = B.run(240, 1 / 30, [-2.3, 1.6, -2.2, 0]).bha001, aw = B.mid('bha001'), h = B.V(-2.3, aw.y, -2.2), home = B.V(-2, aw.y, -2);
      if (aw.distanceTo(h) < 1.49 || aw.distanceTo(home) > 2 + 1e-6 || Math.abs(aw.y - 1.2) > 1e-9 || B.fastest(am) > 1 / 30 + 1e-6) o.push('keep away: ' + JSON.stringify([aw, aw.distanceTo(h), aw.distanceTo(home), B.fastest(am)]));
      // cornered: the head between its place and it, where pushing it on would take it past its area: the far side instead
      const hc = B.V(-2, 0, -2).lerp(B.V(aw.x, 0, aw.z), 0.5).setY(1.6);
      B.run(240, 1 / 30, hc.toArray());
      const ac = B.mid('bha001'), hd = Math.hypot(ac.x - hc.x, ac.z - hc.z);
      if (hd < 1.49 || ac.distanceTo(B.V(-2, ac.y, -2)) > 2 + 1e-6 || (ac.x - hc.x) * (aw.x - hc.x) + (ac.z - hc.z) * (aw.z - hc.z) > 0) o.push('keep away, cornered: ' + JSON.stringify([ac, hd]));
      // home once home is clear of the head (1.8 m from it, still within range)
      B.run(240, 1 / 30, [-2, 1.6, -0.2, 0]);
      if (STUDIO.behave('bha001').who !== 'me' || STUDIO.behave('bha001').on) o.push('keep away, home clear of them: ' + JSON.stringify(STUDIO.behave('bha001')));
      // nobody in range: home, the ball never faster than 0.6 m/s on the way
      const hm = B.run(300, 1 / 30, [20, 1.6, 20, 0]).bhf001;
      if (['bhl001', 'bhf001', 'bha001', 'bhi001'].some(id => STUDIO.behave(id).on || STUDIO.behave(id).who || B.far(B.drawn(id), B.placed(id)) > 1e-9) || B.fastest(hm) > 0.6 / 30 + 1e-6) o.push('home again: ' + JSON.stringify([STUDIO.behave('bhf001'), B.fastest(hm)]));
      // an object (its middle its model's): looks too
      setRec('box001', { behaviour: { kind: 'look', range: 5 } });
      const bm = B.mid('box001');
      B.run(120, 1 / 30, [-1, 1.6, 1, 0]);
      const bf = B.front('box001'), bw = Math.atan2(-1 - bm.x, 1 - bm.z);
      if (B.ang(bf, bw) > 0.01 || B.mid('box001').distanceTo(bm) > 1e-6) o.push('an object looking: ' + [bf, bw, B.mid('box001').distanceTo(bm)]);
      setRec('box001', { behaviour: undefined });
      B.run(200, 1 / 30, [20, 1.6, 20, 0]);
      if (recsOf() !== recs) o.push('a record changed');
      return o;
    })()`);
    bad(r);
  });
  await step('studio behaviours: who it reacts to with several heads: nearest (another nearer by more than 0.3 m takes over, kept until range + 0.5 m, ties by id), first (until they leave), this device driving only when it is the one; pages never count', async () => {
    const r = await ss(`(() => {
      const B = window.__bh, o = [], who = () => STUDIO.behave('bhl001').who;
      // (heads at a distance along +x from the looker's middle (2, -1); this device's own far away)
      const at = (d, z) => [2 + d, 1.6, z === undefined ? -1 : z];
      const fake = (list) => { BEH.fake = list.map(([id, d, ts]) => ({ id, p: at(d), yaw: 0, ts })); B.run(3, 1 / 30, [20, 1.6, 20, 0]); return who(); };
      const seq = [[[['a', 2, 1], ['b', 2.5, 1]], 'a'], [[['a', 2, 1], ['b', 1.8, 1]], 'a'], [[['a', 2, 1], ['b', 1.6, 1]], 'b'], [[['a', 5, 1], ['b', 3.3, 1]], 'b'], [[['a', 5, 1], ['b', 3.6, 1]], ''],
        [[['b', 2, 1], ['a', 2, 1]], 'a']];
      const got = seq.map(([l]) => fake(l));
      if (got.join() !== seq.map(s => s[1]).join()) o.push('nearest: ' + got.join());
      setRec('bhl001', { behaviour: { kind: 'look', who: 'first' } });
      const seqF = [[[], ''], [[['b', 2.5, 100]], 'b'], [[['b', 2.5, 100], ['a', 1, 200]], 'b'], [[['b', 3.4, 100], ['a', 1, 200]], 'b'], [[['b', 3.6, 100], ['a', 1, 200]], 'a'],
        [[['b', 2, 300], ['a', 1, 200]], 'a'], [[['b', 2, 300], ['a', 3.6, 200]], 'b'], [[], ''], [[['b', 2, 400], ['a', 2.5, 400]], 'a']];
      const gotF = seqF.map(([l]) => fake(l));
      if (gotF.join() !== seqF.map(s => s[1]).join()) o.push('first: ' + gotF.join());
      // this device's own head with another: driven here only while it is the one (nearest)
      setRec('bhl001', { behaviour: { kind: 'look' } });
      BEH.fake = [{ id: 'a', p: at(2), yaw: 0, ts: 1 }]; B.run(3, 1 / 30, at(1));
      const mine = STUDIO.behave('bhl001');
      BEH.fake = [{ id: 'a', p: at(0.5), yaw: 0, ts: 1 }]; B.run(3, 1 / 30, at(1));
      const theirs = STUDIO.behave('bhl001');
      if (mine.who !== 'me' || !mine.drive || mine.src !== 'me' || theirs.who !== 'a' || theirs.drive || theirs.src !== 'home') o.push('this device driving: ' + JSON.stringify([mine, theirs]));
      // a page with no head (Orbit view, no pretend head): nobody
      BEH.fake = null; STU.head = null; X.view = 'orbit';
      B.run(3, 1 / 30);
      if (['bhl001', 'bhf001', 'bha001'].some(id => STUDIO.behave(id).who)) o.push('a page with no head counted');
      B.run(200, 1 / 30, [20, 1.6, 20, 0]);
      return o;
    })()`);
    bad(r);
  });
  await step('studio behaviours: going on while selected (editing; its ghost where it is placed), resting while carried and while paused, starting again from its place; a driver\'s samples (a pretend other device\'s effect) drawn 120 ms behind them, home once they end', async () => {
    const r = await ss(`(() => {
      const B = window.__bh, o = [];
      setEdit(true); select('');
      B.run(150, 1 / 30, [0.5, 1.6, -0.5, Math.PI / 2]);
      if (!STUDIO.behave('bhf001').on) o.push('not following at first');
      select('bhf001'); B.run(2, 1 / 30);
      const s = STUDIO.behave('bhf001'), g = STUDIO.ghost('bhf001');
      if (!s.on || !s.drive || B.far(B.drawn('bhf001'), B.placed('bhf001')) < 0.05 || STUDIO.pose('bhf001').rests) o.push('selected, it did not go on: ' + JSON.stringify(s));
      if (!g || !g.shown || g.at.some((v, i) => Math.abs(v - B.placed('bhf001').elements[i]) > 1e-9)) o.push('selected and away from its place, no ghost there: ' + JSON.stringify(g));
      STU.items.get('bhf001').carry = {}; B.run(2, 1 / 30);
      if (STUDIO.behave('bhf001').on || STUDIO.behave('bhf001').drive || B.far(B.drawn('bhf001'), B.placed('bhf001')) > 1e-9) o.push('carried, it did not rest at its place');
      delete STU.items.get('bhf001').carry;
      { const L = B.run(1, 1 / 30).bhf001; if (Math.hypot(L[0].x, L[0].z + 2) > 0.6 / 30 + 1e-6 || !STUDIO.behave('bhf001').on) o.push('let go, it did not start from its place: ' + JSON.stringify(L[0])); }
      B.run(30, 1 / 30); pauseSet(true); B.run(2, 1 / 30);
      if (STUDIO.behave('bhf001').on || STUDIO.behave('bhf001').drive || B.far(B.drawn('bhf001'), B.placed('bhf001')) > 1e-9) o.push('paused, it did not rest at its place');
      pauseSet(false);
      { const L = B.run(1, 1 / 30).bhf001; if (Math.hypot(L[0].x, L[0].z + 2) > 0.6 / 30 + 1e-6 || !STUDIO.behave('bhf001').on) o.push('played again, it did not start from its place: ' + JSON.stringify(L[0])); }
      select('');
      // a driver elsewhere (member zz, in range as a pretend head): its samples drawn 120 ms behind, between them; ended: home
      B.run(200, 1 / 30, [20, 1.6, 20, 0]);
      BEH.fake = [{ id: 'zz', p: [0, 1.6, -0.5], yaw: 0, ts: 1 }];
      const T0 = window.__bh.T;
      const send = (t, tx, end) => studioEffect('beh', { at: Math.round(t), b: [['bhf001', tx, 0, 0, 5].concat(end ? [1] : [])] }, 'zz');
      for (let k = 0; k <= 15; k++) send(T0 + k * 100, k * 0.1);   // (the last 8 are kept)
      B.T = T0 + 1000; B.run(15, 1 / 30, undefined, true);   // (half a second: blended in, then on its samples)
      const v = STUDIO.behave('bhf001'), wantTx = (B.T - 120 - T0) / 1000;
      if (v.src !== 'by:zz' || v.drive || v.who !== 'zz' || Math.abs(v.t[0] - wantTx) > 0.002 || Math.abs(B.mid('bhf001').x - wantTx) > 0.002) o.push('a driver\\'s samples: ' + JSON.stringify([v, wantTx]));
      send(T0 + 1600, 1.6, true);
      B.run(2, 1 / 30);
      if (STUDIO.behave('bhf001').src !== 'home') o.push('its samples ended: not going home: ' + JSON.stringify(STUDIO.behave('bhf001')));
      BEH.fake = null; B.run(200, 1 / 30, [20, 1.6, 20, 0]);
      return o;
    })()`);
    bad(r);
  });
  await step('studio behaviours: the cards\' rows (page and headset), Follow an item... by pointing and by the list, one Undo step each', async () => {
    const out = [];
    await ss(`(setEdit(true), setRec('bhf001', { behaviour: undefined }), select('bhf001'), X.tab = 'item', renderPanes(), 0)`);
    const u0 = await ss('UNDO.length'), seq = [['beh:follow', '{"kind":"follow","who":"nearest","range":3,"dist":1,"speed":0.6}'], ['bwho:first', '"who":"first"'], ['brange:+', '"range":4'],
      ['bdist:-', '"dist":0.75'], ['bspeed:+', '"speed":0.8'], ['beh:avoid', '{"kind":"avoid","who":"first","range":4,"dist":1.5,"speed":0.8,"area":2}'], ['barea:-', '"area":1.5'], ['beh:look', '{"kind":"look","who":"first","range":4}']];
    for (const [id, want] of seq) {
      await ss('renderPanes()');
      await bp.click(`#pane-item [data-id="${id}"]`);
      const got = await ss(`JSON.stringify(STU.items.get('bhf001').rec.behaviour)`);
      if (!got || !got.includes(want)) out.push('the page\'s card ' + id + ': ' + got);
    }
    await ss('renderPanes()');
    const said = await ss(`/the same for everyone at a circle/.test(document.querySelector('#pane-item').textContent)`);
    // Follow an item...: the pick, then the scene's pointer (pressItem) on the tail
    await bp.click('#pane-item [data-id="beh:item"]');
    const pk = await ss(`[STU.follow, UNDO.length]`);
    await ss(`(pressItem('bhi001'), renderPanes(), 0)`);
    const it1 = await ss(`[JSON.stringify(STU.items.get('bhf001').rec.behaviour), STU.follow, UNDO.length]`);
    // and by the card's list
    await ss('renderPanes()');
    await bp.click('#pane-item [data-id="beh:item"]');
    await ss('renderPanes()');
    await bp.click('#pane-item [data-id="btarget:bhl001"]');
    const it2 = await ss(`[JSON.stringify(STU.items.get('bhf001').rec.behaviour), STU.follow, UNDO.length]`);
    // Faces (v128): As placed lit by default, The item pressed (one Undo step), kept when it follows another item
    await ss('renderPanes()');
    const if0 = await ss(`[document.querySelector('#pane-item [data-id="bface:along"]').getAttribute('aria-pressed'), /turning with it as the two are placed/.test(document.querySelector('#pane-item').textContent)]`);
    await bp.click('#pane-item [data-id="bface:them"]');
    const it3 = await ss(`(renderPanes(), [JSON.stringify(STU.items.get('bhf001').rec.behaviour), UNDO.length, document.querySelector('#pane-item [data-id="bface:them"]').getAttribute('aria-pressed'), /turned to look at it/.test(document.querySelector('#pane-item').textContent)])`);
    await ss(`(itemAct('btarget', 'bhi001', 'bhf001'), renderPanes(), 0)`);
    const it4 = await ss(`[JSON.stringify(STU.items.get('bhf001').rec.behaviour), UNDO.length]`);
    await ss('renderPanes()');
    await bp.click('#pane-item [data-id="beh:none"]');
    const end = await ss(`['behaviour' in STU.items.get('bhf001').rec, UNDO.length]`);
    const n = seq.length;
    if (!said || pk[0] !== 'bhf001' || pk[1] !== u0 + n || it1[0] !== '{"kind":"item","target":"bhi001","speed":0.6}' || it1[1] || it1[2] !== u0 + n + 1 ||
      it2[0] !== '{"kind":"item","target":"bhl001","speed":0.6}' || it2[1] || it2[2] !== u0 + n + 2 || if0.join() !== 'true,true' ||
      it3.join() !== '{"kind":"item","target":"bhl001","speed":0.6,"face":"them"},' + (u0 + n + 3) + ',true,true' || it4.join() !== '{"kind":"item","target":"bhi001","speed":0.6,"face":"them"},' + (u0 + n + 4) ||
      end[0] || end[1] !== u0 + n + 5) out.push('the page\'s Behaviour rows (one Undo step each): ' + JSON.stringify({ said, pk, it1, it2, if0, it3, it4, end, u0 }));
    // the headset's card: its rows pressed
    const xr = await ss(`(() => {
      XR.on = true;
      const draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } };
      const press = id => { for (let off = 0; off < 6000; off += 150) { X.scroll.item = off; draw(); const q = XR.main.regions.find(z => z.id === id); if (q && q.fn) { q.fn(); X.scroll = {}; draw(); return true; } } X.scroll = {}; return false; };
      select('bha001'); X.tab = 'item'; X.scroll = {}; draw();
      const r = [press('beh:follow'), JSON.stringify(STU.items.get('bha001').rec.behaviour), press('bspeed:-'), press('bwho:first'), JSON.stringify(STU.items.get('bha001').rec.behaviour),
        press('beh:item'), STU.follow, press('btarget:bhl001'), JSON.stringify(STU.items.get('bha001').rec.behaviour), press('beh:avoid'), JSON.stringify(STU.items.get('bha001').rec.behaviour)];
      // Faces (v128): Follow at their right, Them pressed (one Undo step), then Look at drops it
      const u = UNDO.length;
      r.push(press('beh:follow'), press('bside:right'), press('bface:them'), JSON.stringify(STU.items.get('bha001').rec.behaviour), UNDO.length - u, press('beh:look'), JSON.stringify(STU.items.get('bha001').rec.behaviour));
      XR.on = false; select(''); X.tab = 'scene'; renderPanes();
      return r;
    })()`);
    if (!xr[0] || xr[1] !== '{"kind":"follow","who":"nearest","range":3,"dist":1,"speed":1}' || !xr[2] || !xr[3] || xr[4] !== '{"kind":"follow","who":"first","range":3,"dist":1,"speed":0.8}' ||
      !xr[5] || xr[6] !== 'bha001' || !xr[7] || xr[8] !== '{"kind":"item","target":"bhl001","speed":0.8}' || !xr[9] || xr[10] !== '{"kind":"avoid","who":"nearest","range":3,"dist":1.5,"speed":0.8,"area":2}' ||
      !xr[11] || !xr[12] || !xr[13] || xr[14] !== '{"kind":"follow","who":"nearest","range":3,"dist":1,"speed":0.8,"side":"right","face":"them"}' || xr[15] !== 3 || !xr[16] || xr[17] !== '{"kind":"look","who":"nearest","range":3}') out.push('the headset\'s Behaviour rows: ' + JSON.stringify(xr));
    bad(out);
  });
  await step('studio behaviours: the state and layout.json carry a behaviour and give it back; bad values refused, out of range held, fields of another kind dropped; a group\'s copy follows its own', async () => {
    const r = await ss(`(() => {
      const J = x => JSON.stringify(x), out = [];
      setRec('bhf001', { behaviour: { kind: 'avoid', who: 'first', range: 2.5, dist: 0.8, speed: 1.2, area: 3 } }); setRec('bhi001', { behaviour: { kind: 'item', target: 'bhf001', speed: 2, face: 'them' } }); setRec('box001', { behaviour: { kind: 'look' } });
      setRec('bha001', { behaviour: { kind: 'follow', side: 'behind', face: 'them' } });   // (Faces, v128: in the state and layout.json as given)
      const s = collabState(), a = J(s); collabApply(JSON.parse(a));
      if (J(collabState()) !== a || J(s['p.bhf001'].behaviour) !== '{"kind":"avoid","who":"first","range":2.5,"dist":0.8,"speed":1.2,"area":3}' || J(s['o.box001'].behaviour) !== '{"kind":"look","who":"nearest","range":3}' ||
        J(s['p.bhi001'].behaviour) !== '{"kind":"item","target":"bhf001","speed":2,"face":"them"}' || J(s['e.bha001'].behaviour) !== '{"kind":"follow","who":"nearest","range":3,"dist":1,"speed":0.6,"side":"behind","face":"them"}') out.push('the state: ' + J([s['p.bhf001'], s['o.box001'], s['p.bhi001'], s['e.bha001']]));
      const L = layoutOut(), back = readLayout(JSON.parse(J(L)));
      const got = id => J(back.items.find(x => x.id === id).rec.behaviour);
      if (back.bad || got('bhf001') !== J(s['p.bhf001'].behaviour) || got('bhi001') !== '{"kind":"item","target":"bhf001","speed":2,"face":"them"}' || got('bha001') !== J(s['e.bha001'].behaviour) || 'behaviour' in L.objects.find(o => o.id === 'fig001')) out.push('layout.json: ' + J([back.bad, got('bhf001'), got('bhi001'), got('bha001')]));
      const N = (k, b) => norm(k, Object.assign(k === 'o' ? { file: 'box.glb' } : {}, { p: [0, 0, 0], behaviour: b }));
      const res = [N('o', null) && !('behaviour' in N('o', null)), N('p', { kind: 'dance' }), N('e', { kind: 'look', who: 'last' }), N('o', { kind: 'follow', range: 'far' }), N('p', { kind: 'item' }), N('e', { kind: 'item', target: 'Bad id' }), N('o', 'follow'),
        J(N('o', { kind: 'follow', range: 100, dist: 0.01, speed: 9 }).behaviour), J(N('p', { kind: 'look', dist: 5, area: 2, target: 'abc123' }).behaviour), J(N('e', { kind: 'avoid', range: 1.234 }).behaviour), J(N('p', { kind: 'item', target: 'abc123', who: 'first' }).behaviour),
        norm('c', { p: [0, 0, 0], behaviour: { kind: 'look' } }).behaviour, norm('s', { file: 'tone.wav', p: [0, 0, 0], behaviour: { kind: 'look' } }).behaviour,
        J(N('o', { kind: 'follow', face: 'along' }).behaviour), N('p', { kind: 'item', target: 'abc123', face: 'up' }), J(N('e', { kind: 'avoid', face: 'them' }).behaviour)];
      const want = [true, null, null, null, null, null, null, '{"kind":"follow","who":"nearest","range":20,"dist":0.2,"speed":5}', '{"kind":"look","who":"nearest","range":3}', '{"kind":"avoid","who":"nearest","range":1.23,"dist":1.5,"speed":0.6,"area":2}',
        '{"kind":"item","target":"abc123","speed":0.6}', undefined, undefined, '{"kind":"follow","who":"nearest","range":3,"dist":1,"speed":0.6,"face":"along"}', null, '{"kind":"avoid","who":"nearest","range":3,"dist":1.5,"speed":0.6,"area":2}'];
      if (J(res) !== J(want)) out.push('norm\\'s rules: ' + J(res));
      const bl = readLayout({ studio: 1, empties: [{ id: 'bbb222', p: [0, 0, 0], behaviour: { kind: 'look' } }, { id: 'bbb333', p: [0, 0, 0], behaviour: { kind: 'hide' } }] });
      if (bl.bad !== 1 || bl.items.length !== 1) out.push('a bad behaviour in a layout: ' + J(bl));
      // a group of the ball and its tail duplicated: the tail's copy follows the ball's copy
      setEdit(true);
      change(() => putItem('grpbh1', 'g', norm('g', { name: 'Pair', items: ['bhf001', 'bhi001'] })));
      const g2 = duplicateGroup(STU.items.get('grpbh1')), ms = members(STU.items.get(g2)), ball = ms.find(m => m.rec.name.startsWith('Ball')), tail = ms.find(m => m.rec.name.startsWith('Tail'));
      if (!ball || !tail || tail.rec.behaviour.target !== ball.id) out.push('the group\\'s copy: ' + J(ms.map(m => [m.id, m.rec.name, m.rec.behaviour])));
      return out;
    })()`);
    bad(r);
    await bp.close();
  });
}
// The studio's motions (tools/studio/SPEC.md, "Motions"), on pages of their own at the test scene, with a shape (turned and
// sized per axis), an empty, a sound following the empty and a cut-out on the box put in for these steps: each kind's
// drawn pose at two moments its formula (about its middle, in the scene's axes) over its placed pose, which stays as its
// record puts it; 'always' the same on two pages at one room time, 'shown' from its showing; the sound following the
// empty, the box's cut-out and a sound on the pulsing box coming along; going on while selected (or its group), resting while a sound or a
// cut-out on it is selected (their arrows on them where they are drawn, a drag of them not jumping) and while carried; selected and
// moving, a ghost where it is placed, the page's arrows on it, Pause (the Scene pane, a card, P), Start again;
// the cards' rows (page and headset), one Undo step each; the state and layout.json, bad values refused
if (runs('studio motions')) {
  const mp = await browser.newPage({ viewport: { width: 1280, height: 800 } }), mp2 = await browser.newPage({ viewport: { width: 640, height: 400 } });
  for (const p of [mp, mp2]) {
    p.on('pageerror', e => errors.push('studio motions: ' + (e.stack || e.message)));
    p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('studio motions: ' + m.text()); });
  }
  const ss = (s, p) => (p || mp).evaluate(s => HOST.cur.peek(s), s);
  const until = (src, ms, p) => (p || mp).waitForFunction(src => HOST.cur.peek(src), src, { timeout: ms || 20000 }).then(() => true, () => false);
  const bad = list => { if (list.length) errors.push(...list.map(b => 'studio motions: ' + b)); };
  // (in the page: the items these steps need; an item drawn at a scene clock T (and now); what each kind's formula says
  // its drawn middle, turn and scale are, from its record and its own middle, worked out here on its own)
  const PUT = `(putItem('mot001', 'p', norm('p', { name: 'Turned', shape: 'cube', p: [2, 0.5, -1], q: [0, 0.3827, 0, 0.9239], size: [0.4, 0.6, 0.2] })),
    putItem('emp001', 'e', norm('e', { name: 'Point', p: [0, 1.2, -1] })),
    putItem('sfl001', 's', norm('s', { name: 'Hum', file: 'tone.wav', p: [0, 1.4, -1], on: 'emp001', o: [0, 0.2, 0] })),
    putItem('cut001', 'x', norm('x', { name: 'Notch', on: 'box001', p: [0.1, 0.1, 0.25], size: [0.2, 0.2, 0.2] })), 0)`;
  const HELP = `window.__mo = window.__mo || {
    V: (...a) => new THREE.Vector3(...a),
    at: (id, T, now) => { const sc = sceneClock; sceneClock = () => T; try { itemsStep(0, now === undefined ? performance.now() : now); } finally { sceneClock = sc; } const H = STU.items.get(id).holder; H.updateWorldMatrix(true, false); return H; },
    // [drawn middle, turn, scale] and [placed (from its record)] for its own middle m (its holder's local frame)
    pose: (it, mat) => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); mat.decompose(p, q, s); return { mid: window.__mo.m(it).applyMatrix4(mat), q, s }; },
    m: it => (it.kind === 'o' && it.model ? it.proxy.position.clone() : new THREE.Vector3()),
    placed: it => { const r = it.rec, q = new THREE.Quaternion(...r.q), s = it.kind === 'o' ? new THREE.Vector3(r.s, r.s, r.s) : it.kind === 'p' ? new THREE.Vector3(...r.size) : new THREE.Vector3(1, 1, 1); return new THREE.Matrix4().compose(new THREE.Vector3(...r.p), q, s); },
    // what the formula says at T
    want: (it, T) => {
      const M = window.__mo, mo = it.rec.motion, A = M.V(...{ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[mo.axis]), u = M.V(...{ x: [0, 1, 0], y: [0, 0, 1], z: [1, 0, 0] }[mo.axis]);
      const ph = 2 * Math.PI * mo.speed / 60 * T, sn = Math.sin(ph), P = M.pose(it, M.placed(it)), R = (ax, a) => new THREE.Quaternion().setFromAxisAngle(ax, a);
      const w = { mid: P.mid.clone(), q: P.q.clone(), s: P.s.clone() }, deg = Math.PI / 180;
      if (mo.kind === 'spin') w.q.premultiply(R(A, ph));
      if (mo.kind === 'sway') w.q.premultiply(R(A, mo.amount * deg * sn));
      if (mo.kind === 'wobble') w.q.premultiply(R(u.clone().applyQuaternion(R(A, ph)), mo.amount * deg));
      if (mo.kind === 'bob') w.mid.addScaledVector(A, mo.amount * sn);
      if (mo.kind === 'pulse') w.s.multiplyScalar(1 + mo.amount * sn);
      if (mo.kind === 'orbit') w.mid.add(u.clone().applyQuaternion(R(A, ph)).multiplyScalar(mo.amount));
      return w;
    },
    // how far the drawn pose is from the formula's: [m, rad, scale]
    off: (it, T) => { const M = window.__mo, H = M.at(it.id, T), d = M.pose(it, H.matrixAutoUpdate ? M.placed(it) : H.matrix), w = M.want(it, T); return [d.mid.distanceTo(w.mid), d.q.angleTo(w.q), d.s.distanceTo(w.s)]; },
  }`;
  await step('studio motions: each kind\'s drawn pose at two moments is its formula (about its middle, in the scene\'s axes) over its placed pose, which stays as its record puts it; the empty\'s sound and the box\'s cut-out come along', async () => {
    for (const p of [mp, mp2]) {
      await p.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&scene=test&edit');
      await p.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    }
    for (const p of [mp, mp2]) if (!await until(`STUDIO.ready() && !!STU.items.get('box001').model`, 120000, p)) { bad(['the test scene did not load']); return; }
    await ss(`(${HELP}, ${PUT}, select(''), 0)`);
    const r = await ss(`(() => {
      const M = window.__mo, out = [], T = [1.25, 7.3];
      const cases = [['mot001', { kind: 'spin', speed: 6 }], ['mot001', { kind: 'wobble', speed: 20, amount: 10, axis: 'x' }], ['mot001', { kind: 'bob', speed: 15, amount: 0.3, axis: 'z' }],
        ['mot001', { kind: 'pulse', speed: 30, amount: 0.2 }], ['mot001', { kind: 'orbit', speed: -4, amount: 0.5 }], ['mot001', { kind: 'sway', speed: 15, amount: 20, axis: 'z' }],
        ['box001', { kind: 'spin', speed: 12 }], ['box001', { kind: 'orbit', speed: 3, amount: 1, axis: 'x' }], ['emp001', { kind: 'bob', speed: 15, amount: 0.3 }], ['emp001', { kind: 'sway', speed: 9, amount: 30, axis: 'x' }]];
      for (const [id, mo] of cases) {
        const it = STU.items.get(id), rec0 = JSON.stringify(Object.assign({}, it.rec, { motion: undefined }));
        setRec(id, { motion: mo });
        for (const t of T) {
          const o = M.off(it, t);
          if (o[0] > 1e-5 || o[1] > 1e-4 || o[2] > 1e-5) out.push(id + ' ' + mo.kind + ' at ' + t + ' s: ' + o.map(v => v.toExponential(2)));
          // (its placed pose: its holder's place, turn and scale stay what its record puts)
          if (M.V().copy(it.holder.position).distanceTo(M.V(...it.rec.p)) > 1e-6) out.push(id + ' ' + mo.kind + ': its holder moved');
        }
        if (it.holder.matrixAutoUpdate) out.push(id + ' ' + mo.kind + ' is not drawn moving');
        if (JSON.stringify(Object.assign({}, it.rec, { motion: undefined })) !== rec0) out.push(id + ' ' + mo.kind + ': its record changed');
      }
      // the empty bobbing: the sound following it goes with it (where its offset puts it on the drawn empty)
      setRec('emp001', { motion: { kind: 'bob', speed: 15, amount: 0.3 } });
      M.at('emp001', 1);
      const want = 1.2 + 0.3 * Math.sin(2 * Math.PI * 15 / 60 * 1) + 0.2, f = STUDIO.follow('sfl001');
      if (!f || f.d > 1e-6 || Math.abs(STU.items.get('sfl001').holder.position.y - want) > 1e-5) out.push('the sound on the empty did not go with it: ' + JSON.stringify(f) + ' ' + want);
      // the box spinning: its cut-out comes along (its corners where the box's change puts its placed ones)
      setRec('box001', { motion: { kind: 'spin', speed: 12 } });
      const B = M.at('box001', 2), x = STU.items.get('cut001'), D = B.matrix.clone().multiply(M.placed(STU.items.get('box001')).invert());
      const pl = new THREE.Matrix4().compose(x.holder.position, x.holder.quaternion, x.holder.scale), cs = STUDIO.cut('cut001').corners;
      const far = Math.max(...cs.map((c, k) => M.V(k & 1 ? 0.5 : -0.5, k & 2 ? 0.5 : -0.5, k & 4 ? 0.5 : -0.5).applyMatrix4(pl).applyMatrix4(D).distanceTo(M.V(...c))));
      if (!(far < 1e-5) || x.holder.matrixAutoUpdate) out.push('the cut-out did not come along with the box: ' + far);
      // the box pulsing: a sound on its whole model goes where the box's change puts it at rest (its offset grown with it)
      const sb = addSound('tone.wav'); setRec(sb, { p: [0.4, 1.1, -1.6] }); setRec('box001', { motion: undefined }); M.at('box001', 2); itemAct('follow', 'box001', sb); select('');   // (a sound on it selected: it would rest)
      const r0 = STU.items.get(sb).holder.position.clone();
      setRec('box001', { motion: { kind: 'pulse', speed: 30, amount: 0.4 } });
      const P2 = M.at('box001', 0.5), D2 = P2.matrix.clone().multiply(M.placed(STU.items.get('box001')).invert()), dp = STU.items.get(sb).holder.position.distanceTo(r0.clone().applyMatrix4(D2));
      if (!(dp < 1e-5) || !(Math.abs(Math.cbrt(D2.determinant()) - 1.4) < 1e-6)) out.push('the sound on the pulsing box did not go with it: ' + dp);
      deleteItem(sb);
      // none: at rest, drawn where its record puts it
      setRec('box001', { motion: undefined }); M.at('box001', 2);
      if (!STU.items.get('box001').holder.matrixAutoUpdate || !STU.items.get('cut001').holder.matrixAutoUpdate) out.push('with no motion the box (or its cut-out) was still drawn moving');
      return out;
    })()`);
    bad(r);
  });
  await step('studio motions: \'always\' the same on two pages at one room time, \'shown\' from its showing (again from its beginning when shown again)', async () => {
    const out = [];
    await ss(`(${HELP}, ${PUT}, 0)`, mp2);
    const T = 1700000123.456, now = `(() => {
      const it = STU.items.get('mot001'), a = atStation, n = HOST.collab.now;
      setRec('mot001', { motion: { kind: 'wobble', speed: 17, amount: 25, axis: 'z' } });
      atStation = () => true; HOST.collab.now = () => ${T * 1000};
      try { itemsStep(0, performance.now()); return [it.holder.matrix.toArray(), window.__mo.off(it, sceneClock(performance.now()))[1]]; } finally { atStation = a; HOST.collab.now = n; }
    })()`;
    const [a, b] = [await ss(now), await ss(now, mp2)];
    const d = Math.max(...a[0].map((v, i) => Math.abs(v - b[0][i])));
    if (!(d < 1e-9) || !(a[1] < 1e-4)) out.push('always at one room time: the two pages differ by ' + d + ', the formula by ' + a[1]);
    const sh = await ss(`(() => {
      const M = window.__mo, it = STU.items.get('mot001'), c = STU.items.get('cube01'), o = [];
      setRec('cube01', { show: c.rec.show.concat('mot001') });
      setRec('mot001', { motion: { kind: 'spin', speed: 6, start: 'shown' } });
      shownFor(null);
      if (it.shown) o.push('not hidden before its cube');
      shownFor([0, 1, 0]);
      const t0 = it.shownAt, yaw = now => { M.at('mot001', 999, now); const q = new THREE.Quaternion(); it.holder.matrix.decompose(M.V(), q, M.V()); return new THREE.Euler().setFromQuaternion(q, 'YXZ').y; };
      const y0 = yaw(t0), y1 = yaw(t0 + 2500), base = Math.PI / 4;
      if (Math.abs(y0 - base) > 1e-3 || Math.abs(y1 - (base + Math.PI / 2)) > 1e-3) o.push('shown: not from its showing ' + [y0, y1]);
      it.shownAt = t0 - 5000;   // (as if shown five seconds before)
      shownFor(null); shownFor([0, 1, 0]);
      const t1 = it.shownAt, y2 = yaw(t1 + 1250);
      if (!(t1 >= t0) || Math.abs(y2 - (base + Math.PI / 4)) > 1e-3) o.push('shown again: not from its beginning ' + [t0, t1, y2]);
      shownFor(null); STU.head = null;
      return o;
    })()`);
    bad(out.concat(sh));
  });
  await step('studio motions: going on while selected (editing) and its group selected, resting while a sound on it is selected and while carried; moving again after; the cards\' rows (page and headset), one Undo step each', async () => {
    const out = await ss(`(() => {
      const M = window.__mo, o = [], mv = id => !STU.items.get(id).holder.matrixAutoUpdate, step = () => M.at('mot001', 3.3);
      setEdit(true); setRec('mot001', { motion: { kind: 'bob', speed: 15, amount: 0.3 } }); setRec('emp001', { motion: { kind: 'orbit', speed: 8, amount: 0.4 } }); select(''); step();
      if (!mv('mot001') || !mv('emp001')) o.push('not moving at first');
      select('mot001'); step();
      if (!mv('mot001') || !mv('emp001') || STUDIO.pose('mot001').rests) o.push('selected, it rested (or the empty did)');
      // (a sound on it selected: it rests, so the sound's arrows stand on it where it is placed)
      select('sfl001'); step();
      if (mv('emp001') || !mv('mot001')) o.push('a sound on the empty selected: the empty did not rest (or the shape did)');
      // (a sound on it carried: it rests, so the sound's place is measured where it is placed)
      STU.items.get('sfl001').carry = true; step();
      if (mv('emp001')) o.push('a sound on the empty carried: the empty did not rest');
      STU.items.get('sfl001').carry = false;
      change(() => putItem('grpmo1', 'g', norm('g', { name: 'Two', items: ['mot001', 'emp001'] }))); select('grpmo1'); step();
      if (!mv('mot001') || !mv('emp001')) o.push('their group selected: they rested');
      const gm = [STUDIO.ghost('mot001'), STUDIO.ghost('emp001')];
      if (!gm.every(g => g && g.shown)) o.push('their group selected: no ghosts for its moving members: ' + JSON.stringify(gm));
      // (the group's pivot where they are placed, not where they are drawn: it does not move as they do)
      { const g = STU.items.get('grpmo1'), P1 = g.holder.position.clone(); M.at('mot001', 4.1); if (g.holder.position.distanceTo(P1) > 1e-9) o.push('the group\\'s pivot moved with its members\\' motions'); }
      undo(); select(''); step();
      setEdit(false); select('mot001'); step();
      if (!mv('mot001')) o.push('editing off, it rested');
      setEdit(true); select('');
      // carried by a pretend headset's grip: rests while held, moves again let go (once not selected)
      XR.on = true; GL.world.updateMatrixWorld(true);
      const c = XR.ctrls[0], w = STU.items.get('mot001').holder.getWorldPosition(M.V());
      c.src = { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: { axes: [0, 0, 0, 0], buttons: [] } }; c.g.visible = true; c.g.matrix.makeTranslation(w.x, w.y + 0.2, w.z + 0.4); c.o.setFromMatrixPosition(c.g.matrix);
      c.hover = { kind: 'item', id: 'mot001' }; xrGrab(c, true); select('emp001'); step();
      if (mv('mot001') || !STU.items.get('mot001').carry) o.push('carried, it did not rest');
      xrGrab(c, false); select(''); step();
      if (!mv('mot001')) o.push('let go, it did not move again');
      c.src = null; c.g.visible = false; c.hover = null; XR.on = false;
      return o;
    })()`);
    // the page's card: a shape with no motion given one, its speed, how far, its axis and when it starts, then none
    await ss(`(setRec('mot001', { motion: undefined }), select('mot001'), X.tab = 'item', renderPanes(), 0)`);
    const u0 = await ss('UNDO.length'), seq = [['motion:wobble', '{"kind":"wobble","speed":20,"amount":10,"axis":"y","start":"always"}'], ['mspeed:+', '"speed":30'], ['mamount:-', '"amount":5'],
      ['maxis:x', '"axis":"x"'], ['mstart:shown', '"start":"shown"'], ['motion:spin', '{"kind":"spin","speed":6,"amount":0,"axis":"x","start":"shown"}'], ['mrev', '"speed":-6']];
    for (const [id, want] of seq) {
      await ss('renderPanes()');
      await mp.click(`#pane-item [data-id="${id}"]`);
      const got = await ss(`JSON.stringify(STU.items.get('mot001').rec.motion)`);
      if (!got || !got.includes(want)) out.push('the page\'s card ' + id + ': ' + got);
    }
    await ss('renderPanes()');
    const said = await ss(`[/a ghost where it is placed/.test(document.querySelector('#pane-item').textContent), itemSub(STU.items.get('mot001'))]`);
    await mp.click('#pane-item [data-id="motion:none"]');
    const pg = await ss(`['motion' in STU.items.get('mot001').rec, UNDO.length]`).then(a => a.concat(said));
    if (pg[0] || pg[1] !== u0 + seq.length + 1 || !pg[2] || !/spins/.test(pg[3])) out.push('the page\'s Motion rows (one Undo step each, the rest said): ' + JSON.stringify([pg, u0]));
    // the headset's card: its rows pressed
    const xr = await ss(`(() => {
      XR.on = true;
      const draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } };
      const press = id => { for (let off = 0; off < 6000; off += 150) { X.scroll.item = off; draw(); const q = XR.main.regions.find(z => z.id === id); if (q && q.fn) { q.fn(); X.scroll = {}; draw(); return true; } } X.scroll = {}; return false; };
      select('emp001'); X.tab = 'item'; X.scroll = {}; draw();
      const r = [press('motion:pulse'), JSON.stringify(STU.items.get('emp001').rec.motion), press('mamount:+'), JSON.stringify(STU.items.get('emp001').rec.motion), press('motion:none'), 'motion' in STU.items.get('emp001').rec];
      XR.on = false; select(''); X.tab = 'scene'; renderPanes();
      return r;
    })()`);
    if (!xr[0] || !/"kind":"pulse","speed":30,"amount":0.1/.test(xr[1]) || !xr[2] || !/"amount":0.15/.test(xr[3]) || !xr[4] || xr[5]) out.push('the headset\'s Motion rows: ' + JSON.stringify(xr));
    bad(out);
  });
  await step('studio motions: moving while editing, a ghost where it is placed, selected or not (v124; a big model only its box), none with editing off or once it rests; the page\'s arrows on the ghost (a drag moves its record, the item drawn there while dragged, moving again after); a pretend headset\'s grip on the ghost carrying it; Pause (the Scene pane, a card, P): everything at its placed pose, a clip held, nothing written to the room, editing off playing again; Start again; a cut-out on a spinning model and a sound on an orbiting empty selected: what they are on rests, their arrows on them, a drag not jumping; a cut-out made where a click met a moving model', async () => {
    const out = await ss(`(() => {
      const M = window.__mo, o = [], V = M.V, it = STU.items.get('mot001'), H = it.holder, placed = () => new THREE.Matrix4().compose(H.position, H.quaternion, H.scale);
      const same = (a, b, e) => a.every((v, i) => Math.abs(v - b[i]) <= (e || 1e-9));
      setEdit(true); select(''); setRec('emp001', { motion: undefined }); setRec('mot001', { motion: { kind: 'bob', speed: 15, amount: 1 } });
      M.at('mot001', 1);   // (a quarter of a bob: drawn 1 m above where it is placed)
      // (v124: while editing every item that moves has its ghost, selected or not; with editing off none)
      let g = STUDIO.ghost('mot001');
      if (!g || !g.shown || !same(g.at, placed().toArray())) o.push('editing, moving and not selected: no ghost at its placed pose: ' + JSON.stringify(g));
      setEdit(false); M.at('mot001', 1);
      if (STUDIO.ghost('mot001') || GH.size) o.push('editing off: a ghost stayed');
      setEdit(true); M.at('mot001', 1);
      select('mot001'); M.at('mot001', 1);
      g = STUDIO.ghost('mot001');
      if (!g || !g.shown || g.parts !== 1 || g.hits !== 1 || !same(g.at, placed().toArray()) || !STUDIO.pose('mot001').moving) o.push('selected and moving: no ghost at its placed pose: ' + JSON.stringify(g));
      // the page's arrows: on the ghost's stand-in; a drag goes into its placed pose (one Undo step), the item resting there meanwhile
      tcSetMode('translate');
      if (GL.tc.object !== TCP || TCP.position.distanceTo(H.position) > 1e-9) o.push('the arrows are not on the ghost');
      const u0 = UNDO.length, p0 = it.rec.p.slice();
      GL.tc.dispatchEvent({ type: 'dragging-changed', value: true }); TCP.position.x += 0.5; GL.tc.dispatchEvent({ type: 'objectChange' });
      M.at('mot001', 1.5);
      if (Math.abs(it.rec.p[0] - p0[0] - 0.5) > 1e-6 || !STUDIO.pose('mot001').rests || STUDIO.pose('mot001').moving || H.position.distanceTo(TCP.position) > 1e-9) o.push('dragged: its record or where it is drawn: ' + JSON.stringify([it.rec.p, STUDIO.pose('mot001')]));
      GL.tc.dispatchEvent({ type: 'dragging-changed', value: false }); M.at('mot001', 1);
      const dr = new THREE.Vector3().setFromMatrixPosition(H.matrix);
      if (UNDO.length !== u0 + 1 || !STUDIO.pose('mot001').moving || Math.abs(dr.x - p0[0] - 0.5) > 1e-6 || Math.abs(dr.y - p0[1] - 1) > 1e-6 || GL.tc.object !== TCP || TCP.position.distanceTo(H.position) > 1e-9) o.push('let go, it did not move on from its new place: ' + JSON.stringify([UNDO.length - u0, dr]));
      undo(); M.at('mot001', 1);
      // a pretend headset's grip on the ghost (a ray at where it is placed, under where it is drawn): the item, carried from there
      XR.on = true; GL.world.updateMatrixWorld(true);
      const c = XR.ctrls[0], wp = GL.items.localToWorld(H.position.clone()), from = wp.clone().add(V(0, 0, 2));
      const rc = new THREE.Raycaster(from, V(0, 0, -1)), h = rayPick(rc);
      if (!h || h.id !== 'mot001' || !h.ghost) o.push('the ray on the ghost did not find the item: ' + JSON.stringify(h && [h.id, h.ghost]));
      c.src = { targetRayMode: 'tracked-pointer', handedness: 'right', gamepad: { axes: [0, 0, 0, 0], buttons: [] } }; c.g.visible = true; c.g.matrix.makeTranslation(from.x, from.y, from.z); c.o.setFromMatrixPosition(c.g.matrix);
      c.hover = h ? { kind: 'item', id: h.id, point: h.point, ray: h.ray } : null; xrGrab(c, true);
      M.at('mot001', 1.2);
      if (!c.grab || c.grab.p0.distanceTo(wp) > 1e-6 || STUDIO.pose('mot001').moving) o.push('the grip on the ghost did not carry it from where it is placed');
      c.g.matrix.makeTranslation(from.x + 0.3, from.y, from.z); c.o.setFromMatrixPosition(c.g.matrix); carry(c, 1 / 30); xrGrab(c, false);
      M.at('mot001', 1);
      if (Math.abs(it.rec.p[0] - p0[0] - 0.3) > 1e-3 || !STUDIO.pose('mot001').moving) o.push('carried by its ghost and let go: ' + JSON.stringify(it.rec.p));
      undo(); c.src = null; c.g.visible = false; c.hover = null; XR.on = false; GL.world.updateMatrixWorld(true);
      // an object's ghost: a copy of its model; a big one only its outline box; an empty's cross; a sound's speaker (its own path)
      setRec('box001', { motion: { kind: 'orbit', speed: 15, amount: 0.5 } }); select('box001'); M.at('box001', 1);
      const nm = (() => { let n = 0; STU.items.get('box001').model.o.traverse(x => { if (x.isMesh && x.visible) n++; }); return n; })();
      g = STUDIO.ghost('box001');
      if (!g || !g.shown || g.outline || g.parts !== nm) o.push('an object\\'s ghost (its model\\'s ' + nm + ' meshes): ' + JSON.stringify(g));
      GHOST.tris = 1; ghostDrop('box001'); M.at('box001', 1); g = STUDIO.ghost('box001'); GHOST.tris = 100000; ghostDrop('box001'); M.at('box001', 1);
      if (!g || !g.outline) o.push('a big model\\'s ghost is not its outline box: ' + JSON.stringify(g));
      setRec('emp001', { motion: { kind: 'orbit', speed: 15, amount: 0.5 } }); select('emp001'); M.at('emp001', 1); g = STUDIO.ghost('emp001');
      if (!g || !g.shown || g.parts !== 2 || !(STUDIO.ghost('box001') || {}).shown) o.push('an empty\\'s ghost (its cross and dot), the box\\'s kept while it moves: ' + JSON.stringify([g, STUDIO.ghost('box001')]));
      putItem('sgh001', 's', norm('s', { name: 'Walker', file: 'tone.wav', p: [1, 1.2, -1], path: { k: [[0, 0, 0, 0, 0, 0, 0, 1], [2, 1, 0, 0, 0, 0, 0, 1]] } })); select('sgh001'); M.at('sgh001', 1); g = STUDIO.ghost('sgh001');
      if (!g || !g.shown || g.parts !== 2) o.push('a sound\\'s ghost (its speaker): ' + JSON.stringify(g));
      removeItem('sgh001'); setRec('emp001', { motion: undefined });
      select(''); M.at('box001', 1);
      if (!(STUDIO.ghost('box001') || {}).shown) o.push('deselected while editing, the moving box lost its ghost');
      const bx0 = { anim: STU.items.get('box001').rec.anim, clip: STU.items.get('box001').rec.clip };
      setRec('box001', { motion: undefined, anim: 'off' }); M.at('box001', 1);
      if (STUDIO.ghost('box001')) o.push('its motion gone and its clip off (at rest), its ghost stayed');
      // (v125: a model its own clip moves has its ghost while editing, where it is placed, though its place stays)
      { const E = STU.items.get('box001').E, cl = E && E.clips[0] ? E.clips[0].name : '';
        if (cl) { setRec('box001', { anim: 'loop', clip: cl }); M.at('box001', 1); M.at('box001', 1.3);
          const gc = STUDIO.ghost('box001');
          if (!gc || !gc.shown || !same(gc.at, STU.items.get('box001').holder.matrix.toArray(), 1e-6)) o.push('its clip playing while editing: no ghost where it is placed: ' + JSON.stringify(gc));
          // selected, it keeps it (its holder stays at its placed pose, so it is never far): the page's arrows on its holder,
          // where the ghost stands (tcTarget), and still after a moment of its clip
          select('box001'); M.at('box001', 1.6); M.at('box001', 1.9);
          const bh = STU.items.get('box001').holder, gs = STUDIO.ghost('box001');
          if (!gs || !gs.shown || !same(gs.at, bh.matrix.toArray(), 1e-6)) o.push('selected with its clip playing, its ghost went: ' + JSON.stringify(gs));
          if (GL.tc && (GL.tc.object !== bh || tcTarget(STU.items.get('box001')) !== bh)) o.push('selected with its clip playing, the arrows are not on its holder (its ghost)');
          select(''); M.at('box001', 1);
          }
        else o.push('the box has no clip to check its ghost with'); }
      setRec('box001', { anim: 'off' }); M.at('box001', 1);
      setEdit(false); M.at('mot001', 1);
      if (GH.size) o.push('editing off, a ghost stayed: ' + [...GH.keys()]);
      setEdit(true); setRec('box001', bx0); M.at('box001', 1);
      return o;
    })()`);
    // Pause: the Scene pane's switch, a card's and P; everything at its placed pose, the box's clip held, nothing written
    await ss(`(setRec('box001', { motion: { kind: 'spin', speed: 30 } }), setRec('mot001', { motion: { kind: 'bob', speed: 15, amount: 1 } }), select(''), X.tab = 'scene', renderPanes(), window.__mo.at('box001', 1), window.__ps0 = JSON.stringify(collabState()), 0)`);
    await mp.click('#pane-scene [data-id="pause"]');
    const pz = await ss(`(() => {
      const M = window.__mo, o = [], b = STU.items.get('box001'), t1 = (M.at('box001', 2), b.action.time), t2 = (M.at('box001', 2.7), b.action.time);
      if (!MPAUSE.on || STUDIO.pose('box001').moving || STUDIO.pose('mot001').moving || !STUDIO.pose('box001').rests) o.push('paused, something moved');
      if (Math.abs(t1 - t2) > 1e-9) o.push('paused, the box\\'s clip went on: ' + [t1, t2]);
      if (!/Motions: paused/.test(document.querySelector('#pane-scene').textContent)) o.push('the Scene pane does not say paused');
      if (JSON.stringify(collabState()) !== window.__ps0) o.push('Pause wrote to the room');
      return o;
    })()`);
    await ss(`(select('mot001'), X.tab = 'item', renderPanes(), 0)`);
    await mp.click('#pane-item [data-id="mpause"]');
    const pz2 = await ss(`[MPAUSE.on, (window.__mo.at('mot001', 1), STUDIO.pose('mot001').moving), GL.tc.object === TCP]`);
    if (pz2[0] || !pz2[1] || !pz2[2]) pz.push('the card\'s switch did not play them again: ' + JSON.stringify(pz2));
    await mp.keyboard.press('p');
    const pz3 = await ss(`[MPAUSE.on, (window.__mo.at('mot001', 1), STUDIO.pose('mot001').moving), GL.tc.object === STU.items.get('mot001').holder]`);
    if (!pz3[0] || pz3[1] || !pz3[2]) pz.push('P did not pause them (the arrows back on the item): ' + JSON.stringify(pz3));
    const pz4 = await ss(`(setEdit(false), window.__mo.at('mot001', 1), setEdit(true), [MPAUSE.on, STUDIO.pose('mot001').moving, JSON.stringify(collabState()).length > 0])`);
    if (pz4[0] || !pz4[1]) pz.push('editing off did not play them again: ' + JSON.stringify(pz4));
    out.push(...pz);
    // Start again (a motion that starts when shown): its 'shown' clock from now; nothing recorded
    const sa = await ss(`(() => {
      setRec('mot001', { motion: { kind: 'bob', speed: 15, amount: 1, start: 'shown' } }); select('mot001'); X.tab = 'item'; renderPanes();
      const it = STU.items.get('mot001'), u = UNDO.length; it.shownAt = performance.now() - 9000;
      const b = document.querySelector('#pane-item [data-id="restart"]'); if (b) b.click();
      return [!!b, performance.now() - it.shownAt < 1500, UNDO.length === u];
    })()`);
    if (!sa.every(Boolean)) out.push('Start again on a motion that starts when shown: ' + JSON.stringify(sa));
    // a cut-out on the spinning box and a sound following the orbiting empty, selected: what they are on rests (they have no
    // ghost of their own), so their arrows are on them where they are drawn, and a drag moves them from there without a jump
    const ar = await ss(`(() => {
      const M = window.__mo, V = M.V, o = [], J = a => JSON.stringify(a), at = H => { H.updateWorldMatrix(true, false); return V().setFromMatrixPosition(H.matrixWorld); };
      setRec('mot001', { motion: undefined }); setRec('box001', { anim: 'off', motion: { kind: 'spin', speed: 15 } }); setRec('emp001', { motion: { kind: 'orbit', speed: 15, amount: 0.5 } });
      select(''); M.at('box001', 1);
      if (!STUDIO.pose('box001').moving || !STUDIO.pose('emp001').moving) o.push('not moving before the cut-out or the sound was selected');
      tcSetMode('translate');
      for (const [id, on] of [['cut001', 'box001'], ['sfl001', 'emp001']]) {
        const it = STU.items.get(id);
        select(id); M.at(on, 1); M.at(on, 1.7);
        const P = STUDIO.pose(on), a0 = at(it.holder);
        if (P.moving || !P.rests) o.push(id + ' selected: what it is on did not rest: ' + J(P));
        if (GL.tc.object !== it.holder || !it.holder.matrixAutoUpdate || STUDIO.ghost(id) || STUDIO.ghost(on)) o.push(id + ' selected: its arrows not on it where it is drawn: ' + J([GL.tc.object && GL.tc.object.userData.id, GL.tc.object === TCP, it.holder.matrixAutoUpdate, STUDIO.ghost(id), STUDIO.ghost(on)]));
        const u0 = UNDO.length;
        GL.tc.dispatchEvent({ type: 'dragging-changed', value: true }); M.at(on, 2.2);
        const a1 = at(it.holder);
        it.holder.position.x += 0.1; GL.tc.dispatchEvent({ type: 'objectChange' }); M.at(on, 2.6);
        const a2 = at(it.holder);
        GL.tc.dispatchEvent({ type: 'dragging-changed', value: false }); M.at(on, 3);
        const a3 = at(it.holder);
        // (let go, at most the record's rounding to the mm away)
        if (a1.distanceTo(a0) > 1e-6 || a2.distanceTo(a0.clone().add(V(0.1, 0, 0))) > 1e-6 || a3.distanceTo(a2) > 0.0015 || UNDO.length !== u0 + 1) o.push(id + ' dragged, it jumped: ' + J([a0, a1, a2, a3, UNDO.length - u0]));
        if (UNDO.length > u0) undo();
      }
      select(''); M.at('box001', 1);
      if (!STUDIO.pose('box001').moving || !STUDIO.pose('emp001').moving) o.push('deselected, they did not move again');
      setRec('emp001', { motion: undefined }); setRec('box001', { anim: 'loop', motion: undefined }); select('');
      return o;
    })()`);
    out.push(...ar);
    // a cut-out where a click met the box as it was drawn then (spinning), in its own frame, whatever it does since
    const cu = await ss(`(() => {
      const M = window.__mo, V = M.V, o = [], b = STU.items.get('box001');
      setRec('box001', { anim: 'off', motion: { kind: 'spin', speed: 15 } }); select(''); M.at('box001', 1);   // (a quarter turn about its middle)
      GL.world.updateMatrixWorld(true);
      const mid = M.m(b).applyMatrix4(b.holder.matrixWorld), from = mid.clone().add(V(0.06, 0.03, 3)), rc = new THREE.Raycaster(from, V(0, 0, -1));
      const hs = modelHits(b.model.o, rc).filter(x => x.object.isMesh && x.object.visible);
      if (!hs.length) return ['the ray missed the drawn box'];
      const L = b.holder.worldToLocal(hs[0].point.clone()).multiplyScalar(b.rec.s);   // (in its own frame, turned but not scaled)
      pressItem('box001', rc.ray);
      M.at('box001', 1.6);   // (it spins on before Cut out a part is pressed)
      const n0 = [...STU.items.values()].filter(x => x.kind === 'x').length;
      itemAct('cut', null, 'box001');
      const x = [...STU.items.values()].filter(y => y.kind === 'x' && y.rec.on === 'box001').pop();
      if (!x || [...STU.items.values()].filter(y => y.kind === 'x').length !== n0 + 1) return ['no cut-out made'];
      const d = V(...x.rec.p).distanceTo(L);
      if (d > 0.001) o.push('the cut-out is not where the click met the moving box: ' + (d * 1000).toFixed(1) + ' mm off');
      undo(); setRec('box001', { anim: 'loop', motion: undefined }); setRec('mot001', { motion: undefined }); select('');
      return o;
    })()`);
    out.push(...cu);
    bad(out);
  });
  await step('studio motions: the state and layout.json carry a motion and give it back; a record without one as before; bad values refused, out of range held', async () => {
    const r = await ss(`(() => {
      const J = x => JSON.stringify(x), out = [];
      setRec('mot001', { motion: { kind: 'orbit', speed: -4.5, amount: 0.75, axis: 'z', start: 'shown' } }); setRec('box001', { motion: { kind: 'spin' } }); setRec('emp001', { motion: { kind: 'bob', amount: 0.05 } });
      const s = collabState(), a = J(s); collabApply(JSON.parse(a));
      if (J(collabState()) !== a || J(s['p.mot001'].motion) !== '{"kind":"orbit","speed":-4.5,"amount":0.75,"axis":"z","start":"shown"}' || J(s['o.box001'].motion) !== '{"kind":"spin","speed":6,"amount":0,"axis":"y","start":"always"}') out.push('the state: ' + J([s['p.mot001'], s['o.box001']]));
      const L = layoutOut(), back = readLayout(JSON.parse(J(L)));
      const got = id => J(back.items.find(x => x.id === id).rec.motion);
      if (back.bad || got('mot001') !== J(s['p.mot001'].motion) || got('emp001') !== '{"kind":"bob","speed":15,"amount":0.05,"axis":"y","start":"always"}' || 'motion' in L.objects.find(o => o.id === 'fig001')) out.push('layout.json: ' + J([back.bad, got('mot001'), got('emp001')]));
      const N = (k, m) => norm(k, Object.assign(k === 'o' ? { file: 'box.glb' } : {}, { p: [0, 0, 0], motion: m }));
      const res = [N('o', null) && !('motion' in N('o', null)), N('p', { kind: 'twirl' }), N('e', { kind: 'bob', speed: 'fast' }), N('o', { kind: 'bob', axis: 'w' }), N('p', { kind: 'spin', start: 'later' }), N('e', 'spin'),
        J(N('o', { kind: 'bob', amount: 99, speed: 0 }).motion), J(N('p', { kind: 'pulse', amount: -1, speed: -700 }).motion), J(N('e', { kind: 'wobble', amount: 12.345, speed: 7.777 }).motion), J(N('o', { kind: 'spin', amount: 5 }).motion), norm('c', { p: [0, 0, 0], motion: { kind: 'spin' } }).motion];
      const want = [true, null, null, null, null, null, '{"kind":"bob","speed":0.1,"amount":10,"axis":"y","start":"always"}', '{"kind":"pulse","speed":-600,"amount":0,"axis":"y","start":"always"}', '{"kind":"wobble","speed":7.78,"amount":12.3,"axis":"y","start":"always"}', '{"kind":"spin","speed":6,"amount":0,"axis":"y","start":"always"}', undefined];
      if (J(res) !== J(want)) out.push('norm\\'s rules: ' + J(res));
      const bl = readLayout({ studio: 1, shapes: [{ id: 'bbb222', p: [0, 0, 0], motion: { kind: 'spin' } }, { id: 'bbb333', p: [0, 0, 0], motion: { kind: 'jump' } }] });
      if (bl.bad !== 1 || bl.items.length !== 1) out.push('a bad motion in a layout: ' + J(bl));
      return out;
    })()`);
    bad(r);
    await mp.close(); await mp2.close();
  });
}
// The studio's recorded paths (tools/studio/SPEC.md, "Recorded paths"), on a page of its own at the test scene, with a
// shape, an empty and two sounds put in for these steps: a recording made by a pretend headset's grip (Record its movement
// armed, a grip on nothing; the hand moving and turning, the sticks turning and pushing; the recorder's clock the test's):
// its keys simplified, the pose at every sample's time within 5 mm and 1 degree of what was recorded, one Undo step, its
// place kept, playing at once; loop, once and back and forth at chosen times, its speed, When shown, a motion on top,
// moving or turning the item moving or turning its path, what follows it coming along; the refusals (too short, still,
// more than 600 keys, the scene's 6,000, the shared state's 224 KB, 120 s kept, a lock, a following sound, a group); a page's
// recording through the arrows and its card's buttons (one Undo step), the cards' rows on page and headset; the state and
// layout.json round trip, norm's rules, the scene's 6,000 in a layout and from the room, a GLB switch turning its keys
if (runs('studio paths')) {
  const rp = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  rp.on('pageerror', e => errors.push('studio paths: ' + (e.stack || e.message)));
  rp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('studio paths: ' + m.text()); });
  const ss = s => rp.evaluate(s => HOST.cur.peek(s), s);
  const until = (src, ms) => rp.waitForFunction(src => HOST.cur.peek(src), src, { timeout: ms || 20000 }).then(() => true, () => false);
  const bad = list => { if (list.length) errors.push(...list.map(b => 'studio paths: ' + b)); };
  // (in the page: the items these steps need; a pretend right hand and left hand; an item drawn at a scene clock T (and
  // now); a pose's middle (an object's model's box's middle); the recorder's clock, the test's own)
  const PUT = `(putItem('pth001', 'p', norm('p', { name: 'Runner', shape: 'cube', p: [2, 0.5, -1], q: [0, 0.3827, 0, 0.9239], size: [0.4, 0.6, 0.2] })),
    putItem('pemp01', 'e', norm('e', { name: 'Spot', p: [0, 1.2, -1] })),
    putItem('psnd01', 's', norm('s', { name: 'Hum', file: 'tone.wav', p: [0, 1.4, -1], on: 'pth001', o: [0, 0.5, 0] })),
    putItem('psnd02', 's', norm('s', { name: 'Buzz', file: 'tone.wav', p: [-1, 1.4, -1] })), 0)`;
  const HELP = `window.__pa = window.__pa || {
    V: (...a) => new THREE.Vector3(...a), Q: (...a) => new THREE.Quaternion(...a),
    at: (id, T, now) => { const sc = sceneClock; sceneClock = () => T; try { itemsStep(0, now === undefined ? performance.now() : now); } finally { sceneClock = sc; } const H = STU.items.get(id).holder; return H.matrixAutoUpdate ? new THREE.Matrix4().compose(H.position, H.quaternion, H.scale) : H.matrix.clone(); },
    dec: m => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); return { p, q, s }; },
    mid: (it, p, q, s) => (it.kind === 'o' && it.model ? it.proxy.position.clone().multiply(s).applyQuaternion(q).add(p) : p.clone()),
    hands: () => {
      XR.on = true; XR.clear = true; XR.free = true; GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity(); GL.world.position.set(0, 0, 0); GL.world.quaternion.identity(); GL.world.updateMatrixWorld(true);
      const [a, b] = XR.ctrls, put = (c, p, q, hand, axes) => { c.src = { targetRayMode: 'tracked-pointer', handedness: hand, gamepad: { axes: axes || [0, 0, 0, 0], buttons: [] } }; c.g.visible = true; c.g.matrix.compose(p, q || new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); c.o.setFromMatrixPosition(c.g.matrix); };
      return { a, b, put };
    },
    off: () => { for (const c of XR.ctrls) { c.src = null; c.g.visible = false; c.hover = null; c.grab = null; } XR.on = false; XR.rec = ''; },
    T: 1000, clock: () => { recClock = () => window.__pa.T; },
    // a recording by the pretend right hand: armed, a grip on nothing (the hand 0.7 m from it), n frames of 1/30 s (move(i, H,
    // w) sets the hands and sticks, w where the item stood), let go
    record: (id, n, move) => {
      const P = window.__pa, H = P.hands(); P.clock();
      select(id); itemAct('recArm');
      const armed = XR.rec === id, w = STU.items.get(id).holder.getWorldPosition(P.V());
      H.a.hover = null; H.put(H.a, w.clone().add(P.V(0.3, 0.2, 0.6)), null, 'right'); H.put(H.b, w.clone().add(P.V(-0.4, 0, 0.5)), null, 'left');
      xrGrab(H.a, true);
      const began = !!(REC && REC.id === id && REC.by === 'xr');
      for (let i = 1; i <= n && H.a.grab; i++) { P.T += 1000 / 30; move(i, H, w); carry(H.a, 1 / 30); }
      const held = !!H.a.grab;
      xrGrab(H.a, false);
      return { armed, began, held };
    },
  }`;
  await step('studio paths: a recording by a pretend headset\'s grip (Record its movement armed, a grip on nothing; the hand moving and turning, the left stick turning and the right pushing): simplified keys, the pose at every sample\'s time (between keys too) within 5 mm and 1 degree, one Undo step, its place kept, playing at once and on while selected', async () => {
    await rp.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&scene=test&edit');
    await rp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    if (!await until(`STUDIO.ready() && !!STU.items.get('box001').model`, 120000)) { bad(['the test scene did not load']); return; }
    await ss(`(${HELP}, ${PUT}, setEdit(true), select(''), 0)`);
    const r = await ss(`(() => {
      const P = window.__pa, out = [], it = STU.items.get('box001'), rec0 = JSON.stringify(it.rec), u0 = UNDO.length;
      const res = P.record('box001', 90, (i, H, w) => {
        const s = i / 30, q = P.Q().setFromEuler(new THREE.Euler(0.3 * Math.sin(2 * s), 0.5 * s, 0));
        H.put(H.a, w.clone().add(P.V(0.3 + 0.4 * Math.sin(1.7 * s), 0.2 + 0.2 * s, 0.6 - 0.3 * s)), q, 'right', i > 30 && i <= 50 ? [0, 0, 0, -0.8] : [0, 0, 0, 0]);
        H.put(H.b, w.clone().add(P.V(-0.4, 0, 0.5)), null, 'left', i > 55 && i <= 75 ? [0, 0, 0.7, 0] : [0, 0, 0, 0]);
      });
      if (!res.armed || !res.began || !res.held) out.push('the recording did not run: ' + JSON.stringify(res));
      const Pth = it.rec.path, S = RECLAST && RECLAST.S;
      if (!Pth || !S) return out.concat('no path written: ' + JSON.stringify(REC_NOTE));
      if (!(S.length >= 88 && Pth.k.length >= 3 && Pth.k.length < S.length / 2)) out.push('not simplified: ' + Pth.k.length + ' keys from ' + S.length + ' samples');
      if (Pth.k[0][0] !== 0 || Math.abs(Pth.k[Pth.k.length - 1][0] - 3) > 0.002 || Pth.play !== 'loop' || Pth.start !== 'always' || Pth.speed !== 1) out.push('the path: ' + JSON.stringify([Pth.k[0], Pth.k[Pth.k.length - 1], Pth.play, Pth.start, Pth.speed]));
      if (JSON.stringify(Object.assign({}, it.rec, { path: undefined })) !== rec0) out.push('its place changed: ' + JSON.stringify(it.rec.p));
      if (UNDO.length !== u0 + 1) out.push('not one Undo step: ' + (UNDO.length - u0));
      // every sample: where the path puts it (its placed pose, then the key between) against where it was
      const p0 = P.V(...it.rec.p), q0 = P.Q(...it.rec.q), s0 = P.V(it.rec.s, it.rec.s, it.rec.s), d = P.V(), q = P.Q();
      let far = 0, turn = 0, between = 0;
      for (const sm of S) {
        pathAt(Pth, sm[0], d, q);
        const pp = d.clone().applyQuaternion(q0).add(p0), pq = q0.clone().multiply(q), wp = P.V(sm[1], sm[2], sm[3]), wq = P.Q(sm[4], sm[5], sm[6], sm[7]);
        far = Math.max(far, P.mid(it, pp, pq, s0).distanceTo(P.mid(it, wp, wq, s0))); turn = Math.max(turn, pq.angleTo(wq));
        if (!Pth.k.some(k => Math.abs(k[0] - sm[0]) < 0.0006)) between++;
      }
      if (!(far <= 0.005) || !(turn <= Math.PI / 180) || between < 20) out.push('the path strays from the samples: ' + [far, turn * 180 / Math.PI, between]);
      // it moved: the hand's turn, the right stick's push and the left stick's turn are in it (its last key far from its first)
      const L = Pth.k[Pth.k.length - 1], lq = P.Q(L[4], L[5], L[6], L[7]);
      if (!(Math.hypot(L[1], L[2], L[3]) > 0.3) || !(lq.angleTo(P.Q()) > 1)) out.push('the movement is not in it: ' + JSON.stringify(L));
      // playing at once, though selected: drawn at a scene time between keys as the sample there
      const i = Math.floor(S.length * 0.6), sm = S[i], M = P.dec(P.at('box001', sm[0]));
      if (STU.sel !== 'box001' || !STUDIO.pose('box001').moving || STUDIO.pose('box001').rests) out.push('not playing at once: ' + JSON.stringify([STU.sel, STUDIO.pose('box001')]));
      const dm = P.mid(it, M.p, M.q, M.s).distanceTo(P.mid(it, P.V(sm[1], sm[2], sm[3]), P.Q(sm[4], sm[5], sm[6], sm[7]), s0));
      if (!(dm <= 0.005)) out.push('drawn at ' + sm[0] + ' s ' + (dm * 1000).toFixed(2) + ' mm from what was recorded');
      if (!/^Recorded 3\\.0 s in \\d+ keys/.test(REC_NOTE.text)) out.push('its note: ' + REC_NOTE.text);
      // selected again: it plays on
      select(''); select('box001'); P.at('box001', 1);
      if (!STUDIO.pose('box001').moving) out.push('selected again, it rested');
      undo();
      if ('path' in it.rec || JSON.stringify(it.rec) !== rec0) out.push('Undo did not take the recording back');
      P.off(); select('');
      return out;
    })()`);
    bad(r);
  });
  await step('studio paths: loop, once and back and forth at chosen times, its speed, When shown; a motion on top; moving or turning the item moves or turns its whole path; a sound following it, the box\'s cut-out and a sound\'s own path come along; a following sound\'s own path waits', async () => {
    const r = await ss(`(() => {
      const P = window.__pa, out = [], V = P.V, it = STU.items.get('pth001'), near = (a, b, e) => a.distanceTo(b) <= (e || 2e-4);   // (0.2 mm: a record's turn is a hair off unit length)
      const K = [[0, 0, 0, 0, 0, 0, 0, 1], [1, 1, 0, 0, 0, 0, 0, 1], [2, 1, 1, 0, 0, 0.7071, 0, 0.7071]];
      const want = (s, it2) => { const r = (it2 || it).rec, d = V(), q = P.Q(); pathAt(normPath({ k: K }), s, d, q); const Q0 = P.Q(...r.q).normalize(); return { p: d.applyQuaternion(Q0).add(V(...r.p)), q: Q0.multiply(q) }; };
      const check = (what, T, s, now) => { const M = P.dec(P.at('pth001', T, now)), w = want(s); if (!near(M.p, w.p) || M.q.angleTo(w.q) > 3e-4) out.push(what + ': at ' + T + ' s drawn ' + M.p.toArray().map(v => v.toFixed(4)) + ', wanted ' + w.p.toArray().map(v => v.toFixed(4))); };
      setRec('pth001', { path: { k: K } });
      check('loop', 0.5, 0.5); check('loop', 2.5, 0.5); check('loop', 3.25, 1.25);
      setRec('pth001', { path: { k: K, play: 'once' } }); check('once', 1.5, 1.5); check('once', 2.5, 2); check('once', 7, 2);
      setRec('pth001', { path: { k: K, play: 'bounce' } }); check('back and forth', 2.5, 1.5); check('back and forth', 4.5, 0.5); check('back and forth', 3.75, 0.25);
      setRec('pth001', { path: { k: K, speed: 2 } }); check('loop at ×2', 0.75, 1.5); check('loop at ×2', 1.25, 0.5);
      // when shown: from its showing (a cube shows it)
      const c = STU.items.get('cube01');
      setRec('cube01', { show: c.rec.show.concat('pth001') }); setRec('pth001', { path: { k: K, start: 'shown' } });
      shownFor(null); shownFor([0, 1, 0]);
      const t0 = it.shownAt;
      check('when shown', 999, 1.5, t0 + 1500); check('when shown', 999, 0.25, t0 + 2250);
      shownFor(null); STU.head = null; setRec('cube01', { show: c.rec.show.filter(x => x !== 'pth001') });
      // a motion on top: a bob of 0.3 m about y over the path
      setRec('pth001', { path: { k: K }, motion: { kind: 'bob', speed: 15, amount: 0.3 } });
      { const M = P.dec(P.at('pth001', 0.5)), w = want(0.5).p.add(V(0, 0.3 * Math.sin(2 * Math.PI * 15 / 60 * 0.5), 0)); if (!near(M.p, w)) out.push('a motion on top: ' + M.p.toArray() + ' ' + w.toArray()); }
      setRec('pth001', { motion: undefined });
      // moved: its whole path moves; turned (Turn 90°, one Undo step): its whole path turns
      const w0 = P.dec(P.at('pth001', 1.5)).p;
      setRec('pth001', { p: [2.5, 0.5, -1.2] });
      { const M = P.dec(P.at('pth001', 1.5)); if (!near(M.p, w0.clone().add(V(0.5, 0, -0.2)))) out.push('moved, its path did not move with it'); }
      const u0 = UNDO.length; itemAct('turn', null, 'pth001');
      { const M = P.dec(P.at('pth001', 1.5)), w = want(1.5); if (UNDO.length !== u0 + 1 || !near(M.p, w.p) || M.q.angleTo(w.q) > 3e-4 || near(M.p, w0.clone().add(V(0.5, 0, -0.2)), 0.1)) out.push('turned, its path did not turn with it: ' + M.p.toArray() + ' wanted ' + w.p.toArray()); }
      undo(); setRec('pth001', { p: [2, 0.5, -1] });
      // a sound following it goes with it (its offset on the drawn shape)
      { P.at('pth001', 1.5); const f = STUDIO.follow('psnd01'); if (!f || f.d > 1e-5 || !near(STU.items.get('psnd01').holder.position, P.dec(STU.items.get('pth001').holder.matrix).p.add(V(0, 0.5, 0).applyQuaternion(P.dec(STU.items.get('pth001').holder.matrix).q)), 1e-5)) out.push('the following sound did not go with it: ' + JSON.stringify(f)); }
      // a sound's own path (it only moves; its turn unused), and its emitter's place with it
      setRec('psnd02', { path: { k: [[0, 0, 0, 0, 0, 0, 0, 1], [2, 0, 0, -2, 0, 0.7071, 0, 0.7071]] } });
      { const M = P.at('psnd02', 1), w = STU.items.get('psnd02').holder.getWorldPosition(V()), g = GL.items.localToWorld(V(-1, 1.4, -2)); if (!near(P.dec(M).p, V(-1, 1.4, -2)) || P.dec(M).q.angleTo(P.Q()) > 1e-6 || !near(w, g, 1e-5)) out.push('a sound\\'s own path: ' + P.dec(M).p.toArray()); }
      // a following sound's own path waits (it follows the shape)
      setRec('psnd01', { path: { k: K } });
      { P.at('pth001', 1.5); const f = STUDIO.follow('psnd01'); if (!f || f.d > 1e-5 || pathOf(STU.items.get('psnd01'))) out.push('a following sound played its own path'); }
      setRec('psnd01', { path: undefined }); setRec('psnd02', { path: undefined });
      // the box with a path: its cut-out comes along (the box's change on its own placed pose)
      putItem('pcut01', 'x', norm('x', { name: 'Notch', on: 'box001', p: [0.1, 0.1, 0.25], size: [0.2, 0.2, 0.2] }));
      setRec('box001', { path: { k: K } });
      { const B = P.at('box001', 1.5), b = STU.items.get('box001').holder, D = B.clone().multiply(new THREE.Matrix4().compose(b.position, b.quaternion, b.scale).invert()), x = STU.items.get('pcut01').holder;
        const want2 = new THREE.Matrix4().compose(x.position, x.quaternion, x.scale).premultiply(D);
        if (x.matrixAutoUpdate || x.matrix.elements.some((v, i) => Math.abs(v - want2.elements[i]) > 1e-6)) out.push('the cut-out did not come along with the box'); }
      setRec('box001', { path: undefined }); removeItem('pcut01'); setRec('pth001', { path: undefined });
      P.at('pth001', 0);
      if (!it.holder.matrixAutoUpdate) out.push('with no path it was still drawn moving');
      return out;
    })()`);
    bad(r);
  });
  await step('studio paths: refused in words (too short, not moved, more than 600 keys, the scene\'s 6,000, a shared state past 224 KB, a locked item, a sound that follows something, a group); 120 s stops it and keeps it', async () => {
    const r = await ss(`(() => {
      const P = window.__pa, out = [], it = STU.items.get('pth001'), rec0 = JSON.stringify(it.rec), u0 = UNDO.length, V = P.V;
      const run = (n, move) => { REC_NOTE.text = ''; const res = P.record('pth001', n, move || (() => {})); return { res, path: 'path' in it.rec, note: REC_NOTE.text }; };
      let x = run(0);
      if (x.path || !/Too short/.test(x.note)) out.push('too short: ' + JSON.stringify(x));
      x = run(20);
      if (x.path || !/did not move/.test(x.note)) out.push('still: ' + JSON.stringify(x));
      // a jittery movement: more than 600 keys once simplified
      x = run(700, (i, H, w) => H.put(H.a, w.clone().add(V(0.3 + (i % 2 ? 0.02 : -0.02), 0.2 + i * 0.0005, 0.6)), null, 'right'));
      if (x.path || !/needs \\d[\\d,]* keys: a path holds 600 at most/.test(x.note)) out.push('more than 600 keys: ' + JSON.stringify(x));
      // the scene's 6,000: ten empties of 599 keys each
      const big = Array.from({ length: 599 }, (_, i) => [i * 0.1, 0, 0, i * 0.001, 0, 0, 0, 1]);
      for (let j = 0; j < 10; j++) putItem('pfull' + j, 'e', norm('e', { name: 'Full ' + j, p: [j, 2, 3], path: { k: big } }));
      const glide = (i, H, w) => H.put(H.a, w.clone().add(V(0.3 + i * 0.01, 0.2 + 0.2 * Math.sin(i / 5), 0.6)), null, 'right');
      x = run(60, glide);
      if (x.path || !/would hold [\\d,]+ keys: 6,000 at most/.test(x.note)) out.push('the scene\\'s 6,000: ' + JSON.stringify(x));
      // (nor is a copy of a path made past them: Duplicate refused, said; a group's Duplicate too)
      const nd = duplicateItem('pfull0'), nn = REC_NOTE.text;
      putItem('pgrp02', 'g', norm('g', { name: 'Two full', items: ['pfull1', 'pfull2'] }));
      if (nd || !/No room for the copy's recorded path/.test(nn) || !/No room for the copy's recorded path/.test(groupDupWhy(STU.items.get('pgrp02'))) || duplicateGroup(STU.items.get('pgrp02'))) out.push('a copy past the scene\\'s 6,000: ' + JSON.stringify([nd, nn]));
      removeItem('pgrp02');
      for (let j = 0; j < 10; j++) removeItem('pfull' + j);
      // a shared state past 224 KB (its limit lowered for the test)
      const was = PATH_MAX.state; PATH_MAX.state = JSON.stringify(collabState()).length + 100;
      x = run(60, glide);
      PATH_MAX.state = was;
      if (x.path || !/KB to share in a room/.test(x.note)) out.push('the shared state: ' + JSON.stringify(x));
      if (JSON.stringify(it.rec) !== rec0 || UNDO.length !== u0) out.push('a refused recording changed something: ' + (UNDO.length - u0));
      // 120 s: it stops by itself and is kept (its hand let go)
      x = run(3700, (i, H, w) => H.put(H.a, w.clone().add(V(0.32 + i * 0.0003, 0.2 + 0.2 * Math.sin(i / 300), 0.6)), null, 'right'));   // (2 cm off at once: no still start to cut)
      // (its slow drift's last centimetre, within 1 cm of where it ended, is cut as a still end: it loops)
      if (!x.path || x.res.held || !(it.rec.path.k[it.rec.path.k.length - 1][0] <= 120) || !(it.rec.path.k[it.rec.path.k.length - 1][0] > 119.4) || !/stopped at 120 s/.test(x.note)) out.push('120 s: ' + JSON.stringify([x.path, x.res, x.note, it.rec.path && it.rec.path.k.slice(-1)]));
      undo();
      // locked in place: Record its movement refused (and a page's Record); a sound that follows something; a group
      setRec('pth001', { locked: true }); select('pth001'); XR.on = true; itemAct('recArm'); XR.on = false;
      const lk = XR.rec; itemAct('rec');
      if (lk || REC || !STU.lockSaid || STU.lockSaid.id !== 'pth001') out.push('a locked item was armed or recorded');
      setRec('pth001', { locked: undefined });
      XR.on = true; select('psnd01'); itemAct('recArm'); XR.on = false;
      if (XR.rec || !/Stop following to record/.test(REC_NOTE.text)) out.push('a following sound: ' + REC_NOTE.text);
      putItem('pgrp01', 'g', norm('g', { name: 'Pair', items: ['pth001', 'pemp01'] }));
      if (!/A group has no recorded path/.test(recWhy(STU.items.get('pgrp01')))) out.push('a group: ' + recWhy(STU.items.get('pgrp01')));
      select('pgrp01'); X.tab = 'item'; renderPanes();
      if (!/A group has no recorded path/.test(document.querySelector('#pane-item').textContent)) out.push('the group\\'s card does not say it has none');
      removeItem('pgrp01'); select(''); P.off();
      while (UNDO.length > u0) undo();
      return out;
    })()`);
    bad(r);
  });
  await step('studio paths: a page\'s recording through the arrows (Record on the card, the Move arrows dragged, Turn 90° on its card, Stop), with its real timing, its still end cut, one Undo step, its place as it was, no sizing meanwhile, playing at once with its arrows on its ghost; the cards\' rows (page and headset), one Undo step each, Start again', async () => {
    const out = [];
    await ss(`(window.__pa.clock(), window.__pa.T = 5000, select('pth001'), X.tab = 'item', tcSetMode('translate'), renderPanes(), 0)`);
    const u0 = await ss('UNDO.length'), rec0 = await ss(`JSON.stringify(STU.items.get('pth001').rec)`);
    await rp.click('#pane-item [data-id="rec"]');
    const pg = await ss(`(() => {
      const P = window.__pa, it = STU.items.get('pth001'), H = it.holder, o = [], tc = GL.tc, s0 = it.rec.size.slice();
      if (!REC || REC.by !== 'page' || tc.object !== H) o.push('Record did not start with the arrows on it');
      // the Move arrows dragged 0.6 m along x over a second, then still for half a second, then Turn 90° on its card
      tc.dispatchEvent({ type: 'dragging-changed', value: true });
      for (let i = 1; i <= 30; i++) { P.T += 1000 / 30; H.position.x += 0.02; tc.dispatchEvent({ type: 'objectChange' }); recStep(); }
      tc.dispatchEvent({ type: 'dragging-changed', value: false });
      if (!REC) o.push('the end of the drag ended the recording');
      for (let i = 1; i <= 15; i++) { P.T += 1000 / 30; recStep(); }
      itemAct('psize', 2); itemAct('pgrow', '0:0.1');
      if (JSON.stringify(it.rec.size) !== JSON.stringify(s0)) o.push('sized while recording');
      tcSetMode('scale'); if (tc.mode !== 'translate') o.push('the Size arrows while recording'); tcSetMode('translate');
      itemAct('turn');
      for (let i = 1; i <= 15; i++) { P.T += 1000 / 30; recStep(); }
      X.tab = 'item'; renderPanes();
      return [o, !!document.querySelector('#pane-item [data-id="recstop"]'), /● Recording 2\\.0 s/.test(document.querySelector('#pane-item').textContent)];
    })()`);
    out.push(...pg[0]);
    if (!pg[1] || !pg[2]) out.push('the card while recording: ' + JSON.stringify(pg.slice(1)));
    await rp.click('#pane-item [data-id="recstop"]');
    const st = await ss(`(() => {
      const P = window.__pa, it = STU.items.get('pth001'), Pth = it.rec.path, o = [], V = P.V;
      if (REC || !Pth) return ['Stop did not keep it: ' + REC_NOTE.text];
      if (JSON.stringify(Object.assign({}, it.rec, { path: undefined })) !== ${JSON.stringify(rec0)}) o.push('its place is not as it was: ' + JSON.stringify(it.rec.p));
      // its real timing: 0.6 m along x by 1 s, held to 1.5 s, the quarter turn at 1.5 s, then still to 2 s: cut, as it loops
      // (it ends at the first sample after the turn, 1.533 s)
      const d = V(), q = P.Q(), Q0 = P.Q(...it.rec.q), p0 = V(...it.rec.p), atS = s => { pathAt(Pth, s, d, q); return [d.clone().applyQuaternion(Q0).add(p0), q.clone()]; };
      const [a1, b1] = atS(1), [a2, b2] = atS(1.49), [a3, b3] = atS(1.6), [a4] = atS(0.5), D = pathLen(Pth);
      if (a1.distanceTo(p0.clone().add(V(0.6, 0, 0))) > 0.005 || a2.distanceTo(a1) > 0.005 || b1.angleTo(P.Q()) > 0.02 || b2.angleTo(P.Q()) > 0.02 || Math.abs(b3.angleTo(P.Q()) - Math.PI / 2) > 0.02 || a4.distanceTo(p0.clone().add(V(0.3, 0, 0))) > 0.005 || Math.abs(D - 1.533) > 0.002)
        o.push('the path\\'s timing: ' + JSON.stringify([a1, a2, a4].map(v => v.toArray().map(x => x.toFixed(3))).concat([b2.angleTo(P.Q()), b3.angleTo(P.Q()), D])));
      // (its end far from its start: not joined, and the card says so)
      if (!REC_NOTE.join || !/^Its end is 60 cm and 90° from its start, so it jumps back each loop: record again and end at the ghost to close it\\. \\(0\\.5 s of stillness cut\\.\\)$/.test(REC_NOTE.join.text) || !REC_NOTE.join.keep) o.push('its join note: ' + JSON.stringify(REC_NOTE.join));
      itemsStep(0, performance.now());
      if (!STUDIO.pose('pth001').moving || GL.tc.object !== TCP || TCP.position.distanceTo(it.holder.position) > 1e-9) o.push('not playing at once, or its arrows not on its ghost');
      return o;
    })()`);
    out.push(...st);
    if (await ss('UNDO.length') !== u0 + 1) out.push('the page\'s recording was not one Undo step: ' + ((await ss('UNDO.length')) - u0));
    // the page's rows: Once, Back and forth, When shown, Faster, Slower, Start again, Delete recording
    const seq = [['pplay:once', '"play":"once"'], ['pplay:bounce', '"play":"bounce"'], ['pstart:shown', '"start":"shown"'], ['pspeed:+', '"speed":1.5'], ['pspeed:-', '"speed":1}'], ['pplay:loop', '"play":"loop"']];
    const u1 = await ss('UNDO.length');
    for (const [id, w] of seq) {
      await ss('renderPanes()');
      await rp.click(`#pane-item [data-id="${id}"]`);
      const got = await ss(`JSON.stringify(Object.assign({}, STU.items.get('pth001').rec.path, { k: undefined }))`);
      if (!got.includes(w)) out.push('the page\'s card ' + id + ': ' + got);
    }
    // Start again (it starts when shown): its 'shown' clock from now, drawn at its path's start then; nothing recorded
    await ss(`(STU.items.get('pth001').shownAt = performance.now() - 5000, renderPanes(), 0)`);
    const u2 = await ss('UNDO.length');
    await rp.click('#pane-item [data-id="restart"]');
    const sa = await ss(`(() => { const it = STU.items.get('pth001'), t = performance.now(), M = window.__pa.dec(window.__pa.at('pth001', 99, t)), d = new THREE.Vector3(), q = new THREE.Quaternion(); pathAt(it.rec.path, pathTime(it.rec.path, (t - it.shownAt) / 1000), d, q);
      const w = d.applyQuaternion(new THREE.Quaternion(...it.rec.q).normalize()).add(new THREE.Vector3(...it.rec.p)); return [t - it.shownAt, M.p.distanceTo(w), UNDO.length]; })()`);
    if (!(sa[0] >= 0 && sa[0] < 1500) || sa[1] > 1e-4 || sa[2] !== u2) out.push('Start again: ' + JSON.stringify([sa, u2]));
    await ss('renderPanes()'); await rp.click('#pane-item [data-id="recdel"]');
    const del = await ss(`['path' in STU.items.get('pth001').rec, UNDO.length]`);
    if (del[0] || del[1] !== u1 + seq.length + 1) out.push('Delete recording (one Undo step each): ' + JSON.stringify([del, u1]));
    await ss('undo()');
    // the headset's card: Record its movement armed and disarmed, Back and forth, Faster, Delete recording
    const xr = await ss(`(() => {
      XR.on = true;
      const draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } };
      const find = id => { for (let off = 0; off < 6000; off += 150) { X.scroll.item = off; draw(); const q = XR.main.regions.find(z => z.id === id); if (q) return q; } return null; };
      const press = id => { const q = find(id); if (q && q.fn) { q.fn(); X.scroll = {}; draw(); return true; } X.scroll = {}; return false; };
      select('pth001'); X.tab = 'item'; X.scroll = {}; draw();
      const r = [!find('rec'), press('recxr'), XR.rec, press('recxr'), XR.rec, press('pplay:bounce'), STU.items.get('pth001').rec.path.play, press('pspeed:+'), STU.items.get('pth001').rec.path.speed, press('recdel'), 'path' in STU.items.get('pth001').rec];
      XR.on = false; XR.rec = ''; select(''); X.tab = 'scene'; renderPanes();
      return r;
    })()`);
    if (JSON.stringify(xr) !== JSON.stringify([true, true, 'pth001', true, '', true, 'bounce', true, 1.5, true, false])) out.push('the headset\'s rows: ' + JSON.stringify(xr));
    bad(out);
  });
  await step('studio paths: the recording\'s ghost and the loop join: a pretend headset\'s recording going 0.5 m away and back to 4 cm of its start (its ghost at the start pose all along, lit near the end with a tick and a pulse; its end snapped on, the still start and end cut, the seam smooth, the card\'s line, Keep it as recorded); one ending 40 cm away not joined; a back-and-forth one not cut or bent; a page\'s recording through the arrows ending at the ghost joined too', async () => {
    const r = await ss(`(() => {
      const P = window.__pa, out = [], V = P.V, it = STU.items.get('box001'), u0 = UNDO.length;
      const mid = (s, d, q) => (it.model ? it.proxy.position.clone().multiply(V(it.rec.s, it.rec.s, it.rec.s)) : V()).applyQuaternion(q).add(d);   // (its middle, in its placed frame)
      const at = s => { const d = V(), q = P.Q(); pathAt(it.rec.path, s, d, q); return mid(s, d, q); };
      // a recording by the pretend right hand (its haptics and the tick logged): the hand where where(i) puts it, frame by frame
      const pulses = [], ticks = [], keep = HOST.sfx && HOST.sfx.play;
      const run = (n, where, ghosts) => {
        const H = P.hands(); P.clock();
        select('box001'); itemAct('recArm');
        const w = it.holder.getWorldPosition(V()), g0 = w.clone().add(V(0.3, 0.2, 0.6));
        let i = 0;
        const put = p => { H.put(H.a, p, null, 'right'); H.a.src.gamepad.hapticActuators = [{ pulse: (s, ms) => pulses.push([s, ms, i]) }]; };
        if (HOST.sfx) HOST.sfx.play = (nm, o) => { ticks.push([nm, !!(o && o.force), i]); return null; };
        try {
          put(g0); H.b.src = null; H.b.g.visible = false; H.a.hover = null; xrGrab(H.a, true);
          for (i = 1; i <= n && H.a.grab; i++) { P.T += 1000 / 30; put(g0.clone().add(where(i))); carry(H.a, 1 / 30); itemsStep(0, performance.now()); if (ghosts) ghosts.push(STUDIO.ghost('box001')); }
          xrGrab(H.a, false);
        } finally { if (keep) HOST.sfx.play = keep; P.off(); }
      };
      // (12 frames still, a circle 0.5 m across at 2.5 s a turn, stopping 4.2 cm short of where it began, 12 frames still)
      const circ = (i, m) => { const k = Math.min(Math.max(i - 12, 0), m), th = 2 * Math.PI / 2.5 * k / 30; return V(0.25 - 0.25 * Math.cos(th), 0, -0.25 * Math.sin(th)); };
      const p0 = it.rec.p.slice(), q0 = it.rec.q.slice(), placed = new THREE.Matrix4().compose(V(...p0), P.Q(...q0), V(it.rec.s, it.rec.s, it.rec.s)).toArray(), ghosts = [];
      run(97, i => circ(i, 73), ghosts);
      const Pth = it.rec.path, S = RECLAST && RECLAST.S;
      if (!Pth || !S) return out.concat('no path: ' + REC_NOTE.text);
      // its ghost: at its start pose the whole recording, lit from where it came back within 5 cm (frame 85)
      const gOk = ghosts.length === 97 && ghosts.every(g => g && g.shown && g.at.every((v, j) => Math.abs(v - placed[j]) < 1e-9)), litAt = ghosts.findIndex(g => g && g.lit) + 1;
      if (!gOk || litAt !== 85 || !ghosts.slice(84).every(g => g.lit)) out.push('its ghost while recording: ' + JSON.stringify([ghosts.length, gOk, litAt]));
      if (!pulses.some(p => p[0] === 0.1 && p[2] === 85) || !ticks.some(t => t[0] === 'hover' && t[1] && t[2] === 85)) out.push('no pulse or tick as it lit: ' + JSON.stringify([pulses, ticks]));
      // the still start and end cut: 0.4 s each; it moves within 0.1 s and ends where it last moved (73 frames: 2.433 s)
      const D = pathLen(Pth), K = Pth.k, k0 = K[0], kL = K[K.length - 1], kq = e => P.Q(e[4], e[5], e[6], e[7]);
      if (Math.abs(D - 73 / 30) > 0.002 || at(0.1).distanceTo(at(0)) < 0.03) out.push('the still moments not cut: ' + JSON.stringify([D, at(0.1).distanceTo(at(0))]));
      // its last key is its first's pose; the seam: drawn just before its end and just after its start within 5 mm, its velocity over the last and first 0.05 s alike
      if (Math.hypot(kL[1] - k0[1], kL[2] - k0[2], kL[3] - k0[3]) > 1e-9 || kq(kL).angleTo(kq(k0)) > 1e-4) out.push('its last key is not its first\\'s pose: ' + JSON.stringify([k0, kL]));
      const seam = at(D - 0.002).distanceTo(at(0.002)), vb = at(D).sub(at(D - 0.05)).divideScalar(0.05), va = at(0.05).sub(at(0)).divideScalar(0.05);
      if (seam > 0.005 || vb.distanceTo(va) > 0.3 * Math.min(vb.length(), va.length()) || va.length() < 0.4) out.push('the seam: ' + JSON.stringify([seam, vb.toArray(), va.toArray()]));
      if (JSON.stringify(it.rec.p) !== JSON.stringify(p0) || UNDO.length !== u0 + 1) out.push('its place changed, or not one Undo step');
      const J = REC_NOTE.join;
      if (!J || !/^Loop closed: its end met its start \\(4 cm, 0° apart; 0\\.8 s of stillness cut\\)\\.$/.test(J.text) || !J.keep) out.push('its join note: ' + JSON.stringify(J));
      X.tab = 'item'; renderPanes();
      if (!document.querySelector('#pane-item [data-id="reckeep"]') || !/Loop closed/.test(document.querySelector('#pane-item').textContent)) out.push('the card does not say it, or offer Keep it as recorded');
      // Keep it as recorded: the raw recording, one Undo step (its first key where it began, still; its last 4.2 cm from it)
      document.querySelector('#pane-item [data-id="reckeep"]').click();
      { const K2 = it.rec.path.k, e = K2[K2.length - 1]; if (UNDO.length !== u0 + 2 || Math.abs(pathLen(it.rec.path) - 97 / 30) > 0.002 || Math.hypot(K2[0][1], K2[0][2], K2[0][3]) > 1e-9 || Math.abs(Math.hypot(e[1], e[2], e[3]) - 0.042) > 0.002) out.push('Keep it as recorded: ' + JSON.stringify([UNDO.length - u0, pathLen(it.rec.path), K2[0], e])); }
      undo(); undo();
      // one ending 40 cm away: not joined, and the card says so (no still part: nothing cut, nothing offered)
      run(30, i => V(Math.min(i, 25) * 0.02 - Math.max(0, i - 25) * 0.02, 0, 0));
      { const J2 = REC_NOTE.join, K2 = it.rec.path.k, e = K2[K2.length - 1]; if (!J2 || J2.text !== 'Its end is 40 cm from its start, so it jumps back each loop: record again and end at the ghost to close it.' || J2.keep || Math.abs(Math.hypot(e[1], e[2], e[3]) - 0.4) > 0.003 || Math.abs(pathLen(it.rec.path) - 1) > 0.002) out.push('one ending 40 cm away: ' + JSON.stringify([J2, e, pathLen(it.rec.path)])); }
      // a back-and-forth one recorded again (still at both ends, ending 40 cm away): kept as it was recorded, no line
      setRec('box001', { path: Object.assign({}, it.rec.path, { play: 'bounce' }) });
      run(60, i => V(Math.min(Math.max(i - 8, 0), 25) * 0.02 - Math.min(Math.max(i - 33, 0), 20) * 0.005, 0, 0));
      { const P2 = it.rec.path, K2 = P2.k, e = K2[K2.length - 1]; if (P2.play !== 'bounce' || REC_NOTE.join || Math.abs(pathLen(P2) - 2) > 0.002 || Math.hypot(K2[0][1], K2[0][2], K2[0][3]) > 1e-9 || Math.abs(Math.hypot(e[1], e[2], e[3]) - 0.4) > 0.003) out.push('a back-and-forth one cut or bent: ' + JSON.stringify([P2.play, REC_NOTE.join, pathLen(P2), K2[0], e])); }
      while (UNDO.length > u0) undo();
      return out;
    })()`);
    // a page's recording through the arrows: 0.3 m out and back to 2 cm, still 10 frames, Stop: joined
    const pg = await ss(`(() => {
      const P = window.__pa, it = STU.items.get('pth001'), H = it.holder, o = [], tc = GL.tc, u0 = UNDO.length;
      P.clock(); select('pth001'); X.tab = 'item'; tcSetMode('translate'); itemAct('rec');
      if (!REC || REC.by !== 'page' || tc.object !== H) return ['Record did not start with the arrows on it'];
      tc.dispatchEvent({ type: 'dragging-changed', value: true });
      for (let i = 1; i <= 29; i++) { P.T += 1000 / 30; H.position.x += i <= 15 ? 0.02 : -0.02; tc.dispatchEvent({ type: 'objectChange' }); recStep(); itemsStep(0, performance.now()); }
      tc.dispatchEvent({ type: 'dragging-changed', value: false });
      for (let i = 1; i <= 10; i++) { P.T += 1000 / 30; recStep(); itemsStep(0, performance.now()); }
      const g = STUDIO.ghost('pth001');
      if (!g || !g.shown || !g.lit) o.push('its ghost not lit at the end: ' + JSON.stringify(g));
      itemAct('recStop');
      const K = it.rec.path && it.rec.path.k, J = REC_NOTE.join;
      if (!K) return o.concat('Stop kept nothing: ' + REC_NOTE.text);
      const a = K[0], b = K[K.length - 1];
      if (Math.hypot(b[1] - a[1], b[2] - a[2], b[3] - a[3]) > 1e-9 || Math.abs(pathLen(it.rec.path) - 29 / 30) > 0.002 || !J || !/^Loop closed: its end met its start \\(2 cm, 0° apart; 0\\.3 s of stillness cut\\)\\.$/.test(J.text) || UNDO.length !== u0 + 1)
        o.push('the page\\'s recording not joined: ' + JSON.stringify([a, b, pathLen(it.rec.path), J, UNDO.length - u0]));
      while (UNDO.length > u0) undo();
      select('');
      return o;
    })()`);
    bad(r.concat(pg));
  });
  await step('studio paths: the state and layout.json carry a path and give it back; norm\'s rules (2 to 600 keys, the first at 0, strictly later, at most 120 s, 8 numbers a key; play, start, speed); the scene\'s 6,000 in a layout and from the room; a GLB switch turns its keys so it moves as before', async () => {
    const r = await ss(`(() => {
      const P = window.__pa, J = x => JSON.stringify(x), out = [], V = P.V;
      const K = [[0, 0, 0, 0, 0, 0, 0, 1], [1.5, 0.25, 0.125, -0.5, 0, 0.3827, 0, 0.9239]];
      setRec('pth001', { path: { k: K, play: 'bounce', start: 'shown', speed: 0.75 } }); setRec('pemp01', { path: { k: K } }); setRec('psnd02', { path: { k: K, speed: 3 } });
      const s = collabState(), a = J(s); collabApply(JSON.parse(a));
      if (J(collabState()) !== a || J(s['p.pth001'].path) !== J({ k: K, play: 'bounce', start: 'shown', speed: 0.75 }) || J(s['s.psnd02'].path) !== J({ k: K, play: 'loop', start: 'always', speed: 3 })) out.push('the state: ' + J(s['p.pth001']));
      const L = layoutOut(), back = readLayout(JSON.parse(J(L)));
      const got = id => J(back.items.find(x => x.id === id).rec.path);
      if (back.bad || got('pth001') !== J(s['p.pth001'].path) || got('pemp01') !== J(s['e.pemp01'].path) || got('psnd02') !== J(s['s.psnd02'].path) || 'path' in L.objects.find(o => o.id === 'fig001')) out.push('layout.json: ' + J([back.bad, got('pth001')]));
      const N = (k, path) => norm(k, Object.assign(k === 'o' || k === 's' ? { file: k === 'o' ? 'box.glb' : 'tone.wav' } : {}, { p: [0, 0, 0], path }));
      const long = n => Array.from({ length: n }, (_, i) => [i * 0.1, 0, 0, 0, 0, 0, 0, 1]);
      const res = [!('path' in N('o', null)), N('p', { k: K.slice(0, 1) }), N('e', { k: long(601) }), J(N('e', { k: long(600) }).path.k.length), N('o', { k: [[0.5, 0, 0, 0, 0, 0, 0, 1], [1, 0, 0, 0, 0, 0, 0, 1]] }), N('s', { k: [[0, 0, 0, 0, 0, 0, 0, 1], [0, 1, 0, 0, 0, 0, 0, 1]] }),
        N('p', { k: [[0, 0, 0, 0, 0, 0, 0, 1], [120.001, 1, 0, 0, 0, 0, 0, 1]] }), N('e', { k: [[0, 0, 0, 0, 0, 0, 1], [1, 0, 0, 0, 0, 0, 0, 1]] }), N('o', { k: [[0, 0, 0, NaN, 0, 0, 0, 1], [1, 0, 0, 0, 0, 0, 0, 1]] }), N('o', { k: [[0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 1]] }),
        N('p', { k: K, play: 'twice' }), N('e', { k: K, start: 'later' }), N('s', { k: K, speed: 'fast' }), N('o', 'path'),
        J(N('p', { k: [[0.0002, 0.12345, 0, 0, 0, 0, 0, 2], [1.0004, 0, 0, 0, 0.7071, 0, 0, 0.7071]], speed: 9 }).path), J(N('e', { k: K, speed: 0.1 }).path.speed), norm('c', { p: [0, 0, 0], path: { k: K } }).path, norm('x', { on: 'box001', p: [0, 0, 0], path: { k: K } }).path,
        J(N('s', { k: K }).path.play), !!pathOf({ kind: 's', rec: Object.assign(N('s', { k: K }), { on: 'pth001' }) })];
      const want = [true, null, null, '600', null, null, null, null, null, null, null, null, null, null, J({ k: [[0, 0.123, 0, 0, 0, 0, 0, 1], [1, 0, 0, 0, 0.7071, 0, 0, 0.7071]], play: 'loop', start: 'always', speed: 4 }), '0.25', undefined, undefined, '"loop"', false];
      if (J(res) !== J(want)) out.push('norm\\'s rules: ' + J(res));
      // the scene's 6,000: a layout whose paths pass them (the item past them bad), and a state from the room likewise
      const big = long(599), lay = { studio: 1, empties: Array.from({ length: 11 }, (_, j) => ({ id: 'qfull' + j, p: [j, 2, 3], path: { k: big } })) };
      const bl = readLayout(lay);
      if (bl.bad !== 1 || bl.items.length !== 10) out.push('a layout past 6,000 keys: ' + J([bl.bad, bl.items.length]));
      setRec('pth001', { path: undefined }); setRec('pemp01', { path: undefined }); setRec('psnd02', { path: undefined });
      const st = Object.assign(collabState(), Object.fromEntries(lay.empties.map(e => ['e.' + e.id, Object.assign({}, e, { id: undefined })])));
      collabApply(JSON.parse(J(st)));
      const nIn = [...STU.items.keys()].filter(id => /^qfull/.test(id)).length;
      if (nIn !== 10 || pathKeys('') !== 5990) out.push('a state past 6,000 keys: ' + J([nIn, pathKeys('')]));
      for (const id of [...STU.items.keys()]) if (/^qfull/.test(id)) removeItem(id);
      // a GLB switch: the figure (turned up from Z up) with a path, switched to a GLB holding it turned by r: it is drawn
      // where it was (its holder turned by r^-1 over the model turned by r), its keys turned
      setRec('fig001', { path: { k: K } });
      const before = P.dec(P.at('fig001', 1.2)), g = { s: 0.01, q: [-0.7071, 0, 0, 0.7071] }, u0 = UNDO.length;
      const n = switchToGLB('figure.fbx', 'models/figure-x.glb', g);
      const after = P.dec(P.at('fig001', 1.2)), r = P.Q(...g.q).normalize();
      if (n !== 1 || STU.items.get('fig001').rec.file !== 'models/figure-x.glb' || after.p.distanceTo(before.p) > 0.0015 || after.q.clone().multiply(r).angleTo(before.q) > 3e-4 || UNDO.length !== u0 + 1) out.push('a GLB switch: ' + J([n, after.p.distanceTo(before.p), after.q.clone().multiply(r).angleTo(before.q)]));
      undo(); setRec('fig001', { path: undefined });
      return out;
    })()`);
    bad(r);
    await until('STUDIO.ready()', 60000);
    await rp.close();
  });
}
// The studio's recorder (v125, tools/studio/SPEC.md, "Recorded paths": "Ten minutes, as a file" and "A voice with the
// movement"), on a page of its own served by a relay of its own (--static . --scenes on a temporary copy of the test scene:
// uploads land there and are read back from the disk), in a browser of its own with Chromium's fake microphone: a ten-minute
// page recording (the recorder's clock the test's) kept as recordings/Box-1.json, its record's src, len and n, the box drawn
// along it at three moments within 5 mm of the samples and looping, the file read back as another device reads it; a short
// one still in the record; the refusals without a relay that takes uploads; norm's rules for src, the state and layout.json;
// a GLB switch writing a turned file; then With my voice: a page recording with the fake microphone, its sound uploaded as a
// mono WAV and placed following the box with sync, skip and len, its start against the path's clock within 50 ms (and again
// at the next pass), cut with the loop join, Record again replacing its file, one Undo step, the state and layout round trip,
// norm's rules, and the recording deleted leaving it no longer synced
if (runs('studio recorder')) {
  const { spawn } = await import('node:child_process');
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const SC = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-rec-'));
  fs.cpSync(path.join(ROOT, 'tools', 'studio', 'test', 'scenes', 'test'), path.join(SC, 'test'), { recursive: true });
  let RL = null;
  for (let p = 8930; p < 8960 && !RL; p++) {
    const R = { proc: null, port: 0, out: '' };
    const ok = await new Promise(res => {
      R.proc = spawn(process.execPath, ['relay/server.mjs', '--port', String(p), '--host', '127.0.0.1', '--static', '.', '--scenes', SC, '--quiet'],
        { cwd: ROOT, env: { ...process.env, RELAY_ARGS: '', COLLAB_TOKEN: '', COLLAB_SCENES: '' } });
      const t = setTimeout(() => res(false), 15000);
      R.proc.stdout.on('data', d => { R.out += d; if (!R.port && /listening on http:\/\/[^:]+:\d+/.test(R.out)) { R.port = p; clearTimeout(t); res(true); } });
      R.proc.stderr.on('data', d => { R.out += d; });
      R.proc.on('exit', () => { clearTimeout(t); res(false); });
    });
    if (ok) RL = R; else if (R.proc.exitCode === null) R.proc.kill();
  }
  const rb = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const rctx = await rb.newContext({ viewport: { width: 1280, height: 800 } });
  await rctx.addInitScript(() => { try { localStorage.setItem('collabAutoWelcome', 'off'); } catch (e) { /* storage blocked */ } });
  const rp = await rctx.newPage();
  rp.on('pageerror', e => errors.push('studio recorder: ' + (e.stack || e.message)));
  rp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('studio recorder: ' + m.text()); });
  const ss = s => rp.evaluate(s => HOST.cur.peek(s), s);
  const until = (src, ms) => rp.waitForFunction(src => HOST.cur.peek(src), src, { timeout: ms || 20000 }).then(() => true, () => false);
  const bad = list => { if (list.length) errors.push(...list.map(b => 'studio recorder: ' + b)); };
  const onDisk = rel => path.join(SC, 'test', ...rel.split('/'));
  // (in the page: an item drawn at a scene clock T, a pose's parts and middle; a page recording of the box n frames of 1/30 s
  // on the test's clock, move(i, H, p0) placing it)
  const HELP = `window.__rc = window.__rc || {
    V: (...a) => new THREE.Vector3(...a), Q: (...a) => new THREE.Quaternion(...a), T: 1000,
    at: (id, T) => { const sc = sceneClock; sceneClock = () => T; try { itemsStep(0, performance.now()); } finally { sceneClock = sc; } const H = STU.items.get(id).holder; return H.matrixAutoUpdate ? new THREE.Matrix4().compose(H.position, H.quaternion, H.scale) : H.matrix.clone(); },
    dec: m => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); return { p, q, s }; },
    mid: (it, p, q, s) => (it.kind === 'o' && it.model ? it.proxy.position.clone().multiply(s).applyQuaternion(q).add(p) : p.clone()),
    record: (id, n, move, stop) => {
      const P = window.__rc, it = STU.items.get(id), H = it.holder, p0 = H.position.clone();
      recClock = () => P.T;
      select(id); itemAct('rec');
      if (!REC || REC.by !== 'page') return { began: false, note: REC_NOTE.text };
      const cap = REC.cap;
      for (let i = 1; i <= n && REC; i++) { P.T += 1000 / 30; move(i, H, p0); recStep(); }
      const left = !!REC;
      if (REC && stop !== false) itemAct(stop === 'cancel' ? 'recCancel' : 'recStop');
      return { began: true, cap, left };
    },
  }`;
  // (a circle 2 m across every 20 s, a slow rise and fall, a slow turn: a long movement that is never still)
  const CIRCLE = `(i, H, p0) => { const s = i / 30, a = 2 * Math.PI * s / 20; H.position.set(p0.x + Math.sin(a), p0.y + 0.2 * Math.sin(a / 3), p0.z + 1 - Math.cos(a)); H.quaternion.setFromEuler(new THREE.Euler(0, a / 2, 0)); }`;
  const ready = async () => {
    await rp.goto(`http://127.0.0.1:${RL.port}/index.html#studio&scene=test&edit`);
    await rp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    return until(`STUDIO.ready() && !!STU.items.get('box001').model && canUpload()`, 120000);
  };
  try {
    await step('studio recorder: a ten-minute page recording (the recorder\'s clock the test\'s) simplified a slice at a time (the longest slice under 100 ms) and kept as the file recordings/Box-1.json through the relay, its record\'s src, len and n, one Undo step, its place kept, drawn along it at three moments within 5 mm and 1 degree of the samples and looping; the file read back as another device reads it', async () => {
      if (!RL) { bad(['no relay of its own started']); return; }
      if (!await ready()) { bad(['the test scene did not load from the relay: ' + JSON.stringify(await ss('[SRC.kind, SRC.upload, SRC.save, STU.listing]').catch(e => e.message))]); return; }
      await ss(`(${HELP}, setEdit(true), select(''), 0)`);
      const r0 = await ss(`(() => {
        const P = window.__rc, it = STU.items.get('box001'), rec0 = JSON.stringify(it.rec);
        window.__rc.u0 = UNDO.length; window.__rc.rec0 = rec0;
        const res = P.record('box001', 18100, ${CIRCLE});
        return { res, rec: REC ? 'running' : 'ended', capped: !!(RECLAST && RECLAST.capped), S: RECLAST && RECLAST.S.length, keep: KEEP.has('box001'), note: REC_NOTE.text, cap: res.cap };
      })()`);
      const out = [];
      if (!r0.res.began || r0.cap !== 600 || r0.res.left || !r0.capped || !(r0.S >= 18000)) out.push('the recording did not run to 10 minutes: ' + JSON.stringify(r0));
      if (!await until(`!KEEP.has('box001') && !!(STU.items.get('box001').rec.path && STU.items.get('box001').rec.path.src)`, 60000)) { bad(out.concat('not kept as a file: ' + JSON.stringify(await ss('[REC_NOTE.text, KEEP.size]')))); return; }
      const r = await ss(`(() => {
        const P = window.__rc, out = [], it = STU.items.get('box001'), Pth = it.rec.path, R = RECLAST, S = R.S;
        if (Pth.src !== 'recordings/Box-1.json' || 'k' in Pth || Pth.play !== 'loop' || Pth.start !== 'always' || Pth.speed !== 1 || !(Pth.n > 600) || !(Pth.len > 599 && Pth.len <= 600)) out.push('its record: ' + JSON.stringify(Pth));
        if (JSON.stringify(Object.assign({}, it.rec, { path: undefined })) !== P.rec0) out.push('its place changed: ' + JSON.stringify(it.rec.p));
        if (UNDO.length !== P.u0 + 1) out.push('not one Undo step: ' + (UNDO.length - P.u0));
        // (simplified a slice at a time between frames: e6f_path.js, simplifySoon)
        const L = SIMP.last;
        if (!L || !(L.n >= 18000) || !(L.slices >= 2) || !(L.longest <= 100) || L.keys !== Pth.n) out.push('not simplified a slice at a time: ' + JSON.stringify(L));
        P.simp = L;
        const f = STUDIO.pf(Pth.src);
        if (!f || !f.own || f.n !== Pth.n || f.state !== 'ok') out.push('its keys not held here: ' + JSON.stringify(f));
        if (!/^Recorded 10:00 in [\\d,]+ keys \\(from [\\d,]+ samples\\), kept as the file recordings\\/Box-1\\.json, stopped at 10 minutes/.test(REC_NOTE.text)) out.push('its note: ' + REC_NOTE.text);
        // drawn at three moments (10 %, 50 % and 90 % in) where the samples were, and a loop later the same
        const p0 = P.V(...it.rec.p), q0 = P.Q(...it.rec.q), s0 = P.V(it.rec.s, it.rec.s, it.rec.s), c0 = R.c0 || 0;
        P.worst = [0, 0]; P.info = [Pth.n, Pth.len, S.length];
        select('');
        for (const fr of [0.1, 0.5, 0.9]) {
          const sm = S[Math.floor(S.length * fr)], t = sm[0] - c0;
          for (const T of [t, t + Pth.len]) {
            const M = P.dec(P.at('box001', T)), w = P.mid(it, P.V(sm[1], sm[2], sm[3]), P.Q(sm[4], sm[5], sm[6], sm[7]), s0), d = P.mid(it, M.p, M.q, M.s).distanceTo(w), a = M.q.angleTo(P.Q(sm[4], sm[5], sm[6], sm[7]));
            P.worst = [Math.max(P.worst[0], d), Math.max(P.worst[1], a * 180 / Math.PI)];
            if (!(d <= 0.005) || !(a <= Math.PI / 180)) out.push('drawn at ' + T.toFixed(3) + ' s ' + (d * 1000).toFixed(2) + ' mm and ' + (a * 180 / Math.PI).toFixed(2) + '° from the sample');
          }
        }
        // (as another device reads it: its keys not held here, fetched from the scene once it is listed)
        window.__rc.src = Pth.src;
        PF.delete(Pth.src);
        P.at('box001', 1);
        return out;
      })()`);
      out.push(...r);
      const file = onDisk('recordings/Box-1.json');
      let j = null;
      try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { out.push('no file on the relay\'s disk: ' + e.message); }
      const rec = await ss(`STU.items.get('box001').rec.path`);
      if (j && (j.studio !== 1 || j.recording !== 1 || j.item !== 'Box' || j.n !== rec.n || j.k.length !== rec.n || j.len !== rec.len || j.k[0][0] !== 0 || j.k[j.k.length - 1][0] !== rec.len || fs.statSync(file).size > 4 << 20)) out.push('its file: ' + JSON.stringify([j.studio, j.recording, j.item, j.n, j.k.length, j.len, rec]));
      if (!await until(`(() => { const f = STUDIO.pf(window.__rc.src); return !!(f && f.state === 'ok' && !f.own); })()`, 20000)) out.push('not read back from the scene: ' + JSON.stringify(await ss('STUDIO.pf(window.__rc.src)')));
      else {
        const r2 = await ss(`(() => {
          const P = window.__rc, it = STU.items.get('box001'), Pth = it.rec.path, S = RECLAST.S, sm = S[Math.floor(S.length * 0.7)], s0 = P.V(it.rec.s, it.rec.s, it.rec.s);
          const M = P.dec(P.at('box001', sm[0] - (RECLAST.c0 || 0))), d = P.mid(it, M.p, M.q, M.s).distanceTo(P.mid(it, P.V(sm[1], sm[2], sm[3]), P.Q(sm[4], sm[5], sm[6], sm[7]), s0));
          return [STUDIO.pf(Pth.src).n === Pth.n, d];
        })()`);
        if (!r2[0] || !(r2[1] <= 0.005)) out.push('read back: ' + JSON.stringify(r2));
      }
      const info = await ss('[window.__rc.info, window.__rc.worst, window.__rc.simp]').catch(() => null);
      if (info && info[0]) console.log(`     (${info[0][2]} samples kept as ${info[0][0]} keys, ${info[0][1]} s, ${(fs.statSync(file).size / 1024).toFixed(0)} KB; drawn within ${(info[1][0] * 1000).toFixed(2)} mm and ${info[1][1].toFixed(3)}° of the samples; simplified in ${info[2] ? `${info[2].ms.toFixed(0)} ms, ${info[2].work.toFixed(0)} ms of work in ${info[2].slices} slices, the longest ${info[2].longest.toFixed(1)} ms` : '?'})`);
      bad(out);
    });
    await step('studio recorder: 18,000 jittery samples (ten minutes of a shaky hand) simplified a slice at a time: the same keys as at once and as the simplifier before slices; its time in all and its longest slice', async () => {
      const r = await rp.evaluate(() => HOST.cur.peek(`(async () => {
        let sd = 7, x = 0, y = 0, z = 0, a = 0;
        const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647, rel = [];
        for (let i = 0; i < 18000; i++) { x += (rnd() - 0.5) * 0.02; y += (rnd() - 0.5) * 0.02; z += (rnd() - 0.5) * 0.02; a += (rnd() - 0.5) * 0.05; rel.push({ t: i / 30, d: new THREE.Vector3(x, y, z), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)) }); }
        const mid = new THREE.Vector3(0, 0.25, 0);
        // (the simplifier as it was before slices, v125's first: the reference)
        const before = (rel, mid) => {
          const n = rel.length, keep = new Uint8Array(n), todo = [[0, n - 1]], pm = new THREE.Vector3(), qm = new THREE.Quaternion(), wa = new THREE.Vector3(), wb = new THREE.Vector3(), tm = 0.004, ta = 0.9 * Math.PI / 180;
          keep[0] = keep[n - 1] = 1;
          while (todo.length) {
            const [a, b] = todo.pop(), A = rel[a], B = rel[b];
            if (b - a < 2) continue;
            let worst = 1, wi = -1;
            for (let i = a + 1; i < b; i++) { const f = (rel[i].t - A.t) / (B.t - A.t), r = rel[i]; pm.copy(A.d).lerp(B.d, f); qm.copy(A.q).slerp(B.q, f); const e = Math.max(wa.copy(mid).applyQuaternion(qm).add(pm).distanceTo(wb.copy(mid).applyQuaternion(r.q).add(r.d)) / tm, qm.angleTo(r.q) / ta); if (e > worst) { worst = e; wi = i; } }
            if (wi >= 0) { keep[wi] = 1; todo.push([a, wi], [wi, b]); }
          }
          const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(i); return out;
        };
        const t0 = performance.now(), A = pathSimplify(rel, mid), t1 = performance.now(), O = before(rel, mid), t2 = performance.now(), B = await simplifySoon(rel, mid, STU.gen);
        return { n: rel.length, keys: A.length, once: A.join() === O.join(), soon: !!B && B.join() === A.join(), msOnce: t1 - t0, msBefore: t2 - t1, L: SIMP.last };
      })()`));
      const out = [];
      if (!r.once || !r.soon || r.n !== 18000 || !(r.keys > 1000) || !r.L || !(r.L.slices >= 2) || !(r.L.longest <= 100)) out.push(JSON.stringify(r));
      if (r.L) console.log(`     (${r.n} jittery samples kept as ${r.keys} keys: at once ${r.msOnce.toFixed(0)} ms (as before slices ${r.msBefore.toFixed(0)} ms); a slice at a time ${r.L.ms.toFixed(0)} ms in all, ${r.L.work.toFixed(0)} ms of work in ${r.L.slices} slices, the longest ${r.L.longest.toFixed(1)} ms)`);
      bad(out);
    });
    await step('studio recorder: a short one still in the record (no file); the refusals without a relay that takes uploads (its longest 120 s, a recording past 2 minutes, more than 600 keys); norm\'s rules for src; the state and layout.json give a file\'s path back; a GLB switch writes its keys turned into a new file, and one that cannot (no relay that takes uploads, its file not in the scene) leaves the object on its original and says why on its card; Move the scene to this circle turns a sound\'s file into a new one, or is refused in words', async () => {
      const r = await ss(`(() => {
        const P = window.__rc, out = [], J = x => JSON.stringify(x), it = STU.items.get('pth501') || putItem('pth501', 'e', norm('e', { name: 'Walker', p: [0, 1, -1] })), u0 = UNDO.length;
        const files0 = STU.files.filter(f => f.path.startsWith('recordings/')).length;
        let x = P.record('pth501', 90, ${CIRCLE});
        const p1 = it.rec.path;
        if (!x.began || !p1 || !p1.k || 'src' in p1 || UNDO.length !== u0 + 1 || KEEP.has('pth501')) out.push('a short one: ' + J([x, p1 && Object.keys(p1), UNDO.length - u0]));
        undo();
        // without a relay that takes uploads (its uploads off): 120 s at most; past 2 minutes, or more than 600 keys, refused
        SRC.upload = false;
        x = P.record('pth501', 10, ${CIRCLE}, 'cancel');
        if (x.cap !== 120) out.push('its longest without uploads: ' + x.cap);
        SRC.upload = true;
        x = P.record('pth501', 3900, ${CIRCLE}, false);
        SRC.upload = false;
        itemAct('recStop');
        SRC.upload = true;
        if (x.cap !== 600 || 'path' in it.rec || !/A recording longer than 2 minutes needs a relay that takes uploads/.test(REC_NOTE.text)) out.push('past 2 minutes: ' + J([x, REC_NOTE.text]));
        SRC.upload = false;
        x = P.record('pth501', 700, (i, H, p0) => H.position.set(p0.x + 0.3 + (i % 2 ? 0.02 : -0.02), p0.y + i * 0.0005, p0.z));
        SRC.upload = true;
        if ('path' in it.rec || !/needs [\\d,]+ keys: a path holds 600 at most in the layout, and a longer one is kept as a file of the scene, which needs a relay that takes uploads/.test(REC_NOTE.text)) out.push('more than 600 keys: ' + REC_NOTE.text);
        if (UNDO.length !== u0 || STU.files.filter(f => f.path.startsWith('recordings/')).length !== files0) out.push('a refusal changed something');
        // norm's rules
        const N = pth => { const r = norm('e', { p: [0, 0, 0], path: pth }); return r ? r.path : null; };
        const res = [J(N({ src: 'recordings/a b-1.json', len: 300.0004, n: 9000, speed: 2 })), J(N({ src: 'recordings/x/y.json', len: 0.001, n: 2 }))].concat([
          { src: 'a.json', len: 5, n: 9 }, { src: 'recordings/a.txt', len: 5, n: 9 }, { src: 'recordings/../a.json', len: 5, n: 9 }, { src: 'recordings/.a.json', len: 5, n: 9 }, { src: 'recordings/a/b/c/d/e.json', len: 5, n: 9 },
          { src: 'recordings/a.json~', len: 5, n: 9 }, { src: 'recordings/a.json', len: 0, n: 9 }, { src: 'recordings/a.json', len: 600.5, n: 9 }, { src: 'recordings/a.json', len: 'x', n: 9 }, { src: 'recordings/a.json', n: 9 },
          { src: 'recordings/a.json', len: 5, n: 1 }, { src: 'recordings/a.json', len: 5, n: 40001 }, { src: 'recordings/a.json', len: 5, n: 2.5 }, { src: 'recordings/a.json', len: 5, n: 9, k: [[0, 0, 0, 0, 0, 0, 0, 1], [1, 0, 0, 0, 0, 0, 0, 1]] }, { src: 7, len: 5, n: 9 },
        ].map(N));
        const want = [J({ src: 'recordings/a b-1.json', len: 300, n: 9000, play: 'loop', start: 'always', speed: 2 }), J({ src: 'recordings/x/y.json', len: 0.001, n: 2, play: 'loop', start: 'always', speed: 1 })].concat(Array(15).fill(null));
        if (J(res) !== J(want)) out.push('norm\\'s rules: ' + J(res));
        // the state and layout.json: the file's path given back (and a scene's 6,000 not counting it)
        const s = collabState(), a = J(s); collabApply(JSON.parse(a));
        const L = layoutOut(), back = readLayout(JSON.parse(J(L))), bp = back.items.find(q => q.id === 'box001').rec.path;
        if (J(collabState()) !== a || J(bp) !== J(STU.items.get('box001').rec.path) || back.bad || pathKeys('') !== 0) out.push('the state and layout: ' + J([bp, back.bad, pathKeys('')]));
        removeItem('pth501');
        return out;
      })()`);
      // a GLB switch: the figure (stood up from Z up) given the long path's file, switched to a GLB holding it turned: a new
      // file with its keys turned, drawn where it was
      const g = await rp.evaluate(async () => {
        const peek = s => HOST.cur.peek(s);
        peek(`setRec('fig001', { path: Object.assign({}, STU.items.get('box001').rec.path) }), window.__rc.before = window.__rc.dec(window.__rc.at('fig001', 33.3)), 0`);
        await peek(`(async () => { const g = { s: 0.01, q: [-0.7071, 0, 0, 0.7071] }, u0 = UNDO.length; const pm = await pathFilesTurned('figure.fbx', g); window.__rc.n = switchToGLB('figure.fbx', 'models/figure-x.glb', g, null, pm); window.__rc.du = UNDO.length - u0; })()`);
        return peek(`(() => { const P = window.__rc, it = STU.items.get('fig001'), after = P.dec(P.at('fig001', 33.3)), r = P.Q(-0.7071, 0, 0, 0.7071).normalize(), src = it.rec.path.src;
          return { n: P.n, du: P.du, src, own: (STUDIO.pf(src) || {}).own, d: after.p.distanceTo(P.before.p), a: after.q.clone().multiply(r).angleTo(P.before.q) }; })()`);
      });
      if (g.n !== 1 || g.du !== 1 || g.src !== 'recordings/Figure-1.json' || !g.own || !(g.d <= 0.0015) || !(g.a <= 3e-4) || !fs.existsSync(onDisk('recordings/Figure-1.json'))) r.push('a GLB switch: ' + JSON.stringify(g));
      await ss(`(undo(), setRec('fig001', { path: undefined }), 0)`);
      // a switch that cannot turn its file (no relay that takes uploads; its file not in the scene): not switched, said
      const h = await rp.evaluate(async () => {
        const peek = s => HOST.cur.peek(s);
        return peek(`(async () => {
          const g = { s: 0.01, q: [-0.7071, 0, 0, 0.7071] }, out = [], it = STU.items.get('fig001'), u0 = UNDO.length, src = STU.items.get('box001').rec.path.src;
          setRec('fig001', { path: Object.assign({}, STU.items.get('box001').rec.path) });
          SRC.upload = false;
          let pm = await pathFilesTurned('figure.fbx', g), n = switchToGLB('figure.fbx', 'models/figure-x.glb', g, null, pm);
          SRC.upload = true;
          const w1 = heldWords(pm, 'figure.fbx', 'models/figure-x.glb');
          select('fig001'); X.tab = 'item'; renderPanes();
          const card = document.querySelector('#pane-item').textContent;
          out.push({ n, file: it.rec.file, src: it.rec.path.src === src, du: UNDO.length - u0, note: it.swNote, w1, card: card.includes(it.swNote) && !!it.swNote });
          setRec('fig001', { path: { src: 'recordings/none-1.json', len: 5, n: 9, play: 'loop', start: 'always', speed: 1 } });
          const t0 = performance.now();
          pm = await pathFilesTurned('figure.fbx', g); n = switchToGLB('figure.fbx', 'models/figure-x.glb', g, null, pm);
          out.push({ n, file: it.rec.file, ms: performance.now() - t0, note: it.swNote, du: UNDO.length - u0 });
          setRec('fig001', { path: undefined }); it.swNote = ''; select('');
          return out;
        })()`);
      });
      if (h[0].n !== 0 || h[0].file !== 'figure.fbx' || !h[0].src || h[0].du !== 0 || !/^Not switched to models\/figure-x\.glb: its recorded path is kept as the file recordings\/Box-1\.json, and turning it needs a relay that takes uploads\. It stays on figure\.fbx/.test(h[0].note || '') || !h[0].card ||
        !/^Figure was not switched from figure\.fbx to models\/figure-x\.glb: its recorded path is kept as the file recordings\/Box-1\.json, and turning it needs a relay that takes uploads\. It stays as it was \(Switch to the GLB on its card tries again\)\.$/.test(h[0].w1)) r.push('a switch with no relay that takes uploads: ' + JSON.stringify(h[0]));
      if (h[1].n !== 0 || h[1].file !== 'figure.fbx' || h[1].du !== 0 || !(h[1].ms < 3000) || !/its recorded path's file recordings\/none-1\.json could not be read/.test(h[1].note || '')) r.push('a switch whose file is not in the scene: ' + JSON.stringify(h[1]));
      // Move the scene to this circle (a pretend station's circle, its spot 2 m off and turned a quarter): a sound's own recorded
      // path kept as a file turned into a new file, drawn where it was turned with the scene; refused with no relay that takes
      // uploads, nothing moved
      const c = await rp.evaluate(async () => {
        const peek = s => HOST.cur.peek(s);
        return peek(`(async () => {
          const P = window.__rc, out = [], src = STU.items.get('box001').rec.path;
          putItem('snd501', 's', norm('s', { name: 'Walking', file: 'tone.wav', p: [0.5, 1, -1], vol: 1, r: 1.5, loop: true, start: 'always', path: Object.assign({}, src) }));
          const T = 33.3, before = P.dec(P.at('snd501', T)).p, recs0 = JSON.stringify([...STU.items.values()].map(x => x.rec));
          const as = atStation, cs = circleSpot, S = { x: 2, z: -1, yaw: Math.PI / 2 };
          const wait = async re => { for (let i = 0; i < 100 && !re.test(CIRC.note); i++) await new Promise(r => setTimeout(r, 100)); return CIRC.note; };
          try {
            atStation = () => true; circleSpot = () => S;
            SRC.upload = false;
            CIRC.note = ''; sceneToCircle();
            const n1 = await wait(/^Refused|^Moved/);
            out.push({ note: n1, same: JSON.stringify([...STU.items.values()].map(x => x.rec)) === recs0 });
            SRC.upload = true;
            const u0 = UNDO.length;
            CIRC.note = ''; sceneToCircle();
            const n2 = await wait(/^Refused|^Moved/), sr = STU.items.get('snd501').rec;
            const after = P.dec(P.at('snd501', T)).p, want = new THREE.Vector3(S.x + before.z, before.y, S.z - before.x);
            out.push({ note: n2, src: sr.path.src, own: (STUDIO.pf(sr.path.src) || {}).own, d: after.distanceTo(want), du: UNDO.length - u0 });
            undo();
            out.push({ back: STU.items.get('snd501').rec.path.src === src.src && P.dec(P.at('snd501', T)).p.distanceTo(before) < 1e-6 });
          } finally { atStation = as; circleSpot = cs; SRC.upload = true; removeItem('snd501'); CIRC.note = ''; }
          return out;
        })()`);
      });
      if (!/^Refused \(nothing moved\): Walking's recorded path is kept as the file recordings\/Box-1\.json, and turning it needs a relay that takes uploads\.$/.test(c[0].note) || !c[0].same) r.push('the move to the circle with no relay that takes uploads: ' + JSON.stringify(c[0]));
      if (!/^Moved: \d+ items now stand round this circle \(Undo takes it back\)\. A sound's recorded path kept as a file was turned into a new file\.$/.test(c[1].note) || c[1].src !== 'recordings/Walking-1.json' || !c[1].own || !(c[1].d <= 0.0015) || c[1].du !== 1 || !fs.existsSync(onDisk('recordings/Walking-1.json')) || !c[2].back) r.push('the move to the circle: ' + JSON.stringify(c));
      bad(r);
    });
    await step('studio recorder: With my voice (the fake microphone): a page recording with it, its sound uploaded as a mono WAV and placed following the box (sync, skip, len), the path and the sound one Undo step, cut with the loop join; heard from the path\'s start within 50 ms (and at its next pass); Record again with the microphone 1.5 s late writing a new file (the old one kept) and the sound pointed at it, its skip below 0 and its len to the path\'s end, heard within 50 ms and still synced 0.3 s before its end; the state and layout round trip; norm\'s rules; the recording deleted leaving it no longer synced; Undo giving the first file back', async () => {
      const out = [];
      await ss(`(setRec('box001', { path: undefined }), select('box001'), X.tab = 'item', HOST.audio.mute(false), recClock = () => performance.now(), 0)`);
      await ss(`(itemAct('recVoice'), 0)`);
      if (!await until('VOICE.on && !VOICE.asking', 15000)) { bad(['With my voice did not turn on: ' + JSON.stringify(await ss('VOICE'))]); return; }
      await ss(`(renderPanes(), 0)`);
      const sw = await rp.evaluate(() => (document.querySelector('#pane-item [data-id="recvoice"]') || {}).textContent || '');
      if (!/With my voice: on/.test(sw)) out.push('the switch on the card: ' + sw);
      // a recording of 4 s, real time: 0.6 s still, then round, while the microphone records
      const u0 = await ss('UNDO.length');
      // (late: the movement begins as the recording does, before the microphone is on)
      const rec = async late => {
        await ss(`(select('box001'), itemAct('rec'), window.__rc.p0 = STU.items.get('box001').holder.position.clone(), window.__rc.r0 = performance.now(), 0)`);
        const move = `(window.__rc.iv = setInterval(() => { if (!REC) return; const s = Math.max(0, (performance.now() - window.__rc.r0) / 1000 - 0.6), a = 2 * Math.PI * s / 3, H = STU.items.get('box001').holder, p0 = window.__rc.p0; H.position.set(p0.x + 0.5 * Math.sin(a), p0.y, p0.z + 0.5 - 0.5 * Math.cos(a)); recStep(); }, 20), 0)`;
        if (late) await ss(move);
        if (!await until(`!!(REC && REC.v && REC.v.state === 'on')`, 10000)) return 'the microphone did not start: ' + JSON.stringify(await ss('REC && REC.v && [REC.v.state, REC.v.err]'));
        if (!late) await ss(move);
        await rp.waitForTimeout(4000);
        const lvl = await ss('REC && REC.v ? [REC.v.lvl, !!REC.v.an] : null');
        await ss(`(clearInterval(window.__rc.iv), itemAct('recStop'), 0)`);
        if (!await until(`!KEEP.has('box001') && !!voiceOf('box001')`, 30000)) return 'no voice placed: ' + JSON.stringify(await ss('[REC_NOTE.text, KEEP.size]'));
        return lvl;
      };
      const l1 = await rec();
      if (typeof l1 === 'string') { bad(out.concat(l1)); return; }
      const v = await ss(`(() => { const s = voiceOf('box001'), R = RECLAST; return { id: s.id, rec: s.rec, path: STU.items.get('box001').rec.path, plen: STU.items.get('box001').rec.path ? pathLen(STU.items.get('box001').rec.path) : 0, c0: R.c0, lead: (R.v.t0 - R.real0) / 1000, dur: R.v.kept && R.v.kept.dur, undo: UNDO.length, note: REC_NOTE.text }; })()`);
      if (v.undo !== u0 + 1) out.push('the path and its voice not one Undo step: ' + (v.undo - u0));
      if (v.rec.file !== 'sounds/Box-voice-1.wav' || v.rec.on !== 'box001' || v.rec.sync !== 'box001' || v.rec.loop !== false || v.rec.name !== 'Box voice' || !v.path || !v.path.k) out.push('its record: ' + JSON.stringify(v));
      if (!(v.c0 > 0.3) || Math.abs((v.rec.skip || 0) - (v.c0 - v.lead)) > 0.002 || !(Math.abs(v.lead) < 1) || !(Math.abs(v.rec.len - Math.min(v.plen, v.dur - (v.rec.skip || 0))) <= 0.002)) out.push('cut with the loop join: ' + JSON.stringify([v.c0, v.lead, v.rec.skip, v.rec.len, v.dur]));
      if (!/Your voice is Box voice \(mono WAV, 48000 Hz/.test(v.note)) out.push('its note: ' + v.note);
      const wav = fs.existsSync(onDisk('sounds/Box-voice-1.wav')) ? fs.readFileSync(onDisk('sounds/Box-voice-1.wav')) : null;
      if (!wav || wav.toString('latin1', 0, 4) !== 'RIFF' || wav.readUInt16LE(22) !== 1 || wav.readUInt16LE(34) !== 16 || wav.readUInt32LE(24) !== 48000 || !(wav.length > 48000 * 2 * 3)) out.push('its file: ' + (wav ? JSON.stringify([wav.toString('latin1', 0, 4), wav.readUInt16LE(22), wav.readUInt16LE(34), wav.readUInt32LE(24), wav.length]) : 'none'));
      // heard from the path's start: its voice where the path's clock says, now and at its next pass
      await ss(`(select(''), 0)`);
      const vid = v.id;
      if (!await until(`!!STUDIO.voice('${vid}').playing`, 20000)) out.push('the voice did not play: ' + JSON.stringify(await ss(`[STUDIO.voice('${vid}'), STU.items.get('${vid}').F && STU.items.get('${vid}').F.state, !!HOST.audio.fx()]`)));
      else {
        const off = async () => ss(`(() => { const s = STUDIO.voice('${vid}'); return s.now && s.log && s.voiceNow != null ? { d: s.voiceNow - ((s.log.skip || 0) + s.now.e), pass: s.log.pass, e: s.now.e } : null; })()`);
        const a = await off();
        if (!a || !(Math.abs(a.d) <= 0.05)) out.push('its start against the path\'s clock: ' + JSON.stringify(a));
        if (a) console.log(`     (the voice ${(a.d * 1000).toFixed(1)} ms from the path's clock as it plays; skip ${v.rec.skip} s, len ${v.rec.len} s, the microphone ${(v.lead * 1000).toFixed(0)} ms late, the level meter ${JSON.stringify(l1)})`);
        const p0 = a ? a.pass : -1;
        if (!await until(`(() => { const s = STUDIO.voice('${vid}'); return !!(s.log && s.log.pass > ${p0} && s.playing); })()`, 15000)) out.push('not started again at the next pass: ' + JSON.stringify(await ss(`STUDIO.voice('${vid}')`)));
        else { await rp.waitForTimeout(300); const b = await off(); if (!b || !(Math.abs(b.d) <= 0.05)) out.push('at its next pass: ' + JSON.stringify(b)); else console.log(`     (at its next pass ${(b.d * 1000).toFixed(1)} ms)`); }
      }
      // Record again, the microphone 1.5 s late: a new file (the old one kept as it was), the same sound pointed at it; its skip
      // below 0 (it starts that much after the path) and its len to the path's end (its file's end, dur - skip), heard where
      // the path's clock says and still synced 0.3 s before its end
      const st0 = fs.statSync(onDisk('sounds/Box-voice-1.wav'));
      await rp.evaluate(() => { const md = navigator.mediaDevices, g = md.getUserMedia.bind(md); window.__gum = g; md.getUserMedia = c => new Promise(r => setTimeout(r, 1500)).then(() => g(c)); });
      const l2 = await rec(true);
      await rp.evaluate(() => { navigator.mediaDevices.getUserMedia = window.__gum; });
      if (typeof l2 === 'string') out.push('again: ' + l2);
      else {
        const w = await ss(`(() => { const s = voiceOf('box001'), R = RECLAST, P = STU.items.get('box001').rec.path, D = pathLen(P), sc = sceneClock;
          let end = null, past = null;
          try { sceneClock = () => 10 * D + (s.rec.len - 0.3); end = syncAt(s, performance.now(), R.v.kept.dur); } finally { sceneClock = sc; }
          return { id: s.id, file: s.rec.file, n: [...STU.items.values()].filter(x => x.kind === 's' && x.rec.sync === 'box001').length, skip: s.rec.skip, len: s.rec.len, plen: D, dur: R.v.kept.dur, lead: (R.v.t0 - R.real0) / 1000, c0: R.c0, end }; })()`), st1 = fs.statSync(onDisk('sounds/Box-voice-1.wav'));
        if (w.id !== vid || w.file !== 'sounds/Box-voice-2.wav' || w.n !== 1 || st1.mtimeMs !== st0.mtimeMs || !fs.existsSync(onDisk('sounds/Box-voice-2.wav'))) out.push('Record again: ' + JSON.stringify([w, st0.mtimeMs, st1.mtimeMs]));
        if (!(w.lead > 1.3) || !(w.skip < -0.5) || Math.abs(w.skip - (w.c0 - w.lead)) > 0.002 || !(Math.abs(w.len - Math.min(w.plen, w.dur - w.skip)) <= 0.002) || !(w.len > w.dur + 0.5) ||
          !w.end || !(Math.abs(w.end.at - (w.skip + w.len - 0.3)) <= 0.002) || !(w.end.at < w.dur)) out.push('the microphone 1.5 s late: ' + JSON.stringify(w));
        else console.log(`     (the microphone ${(w.lead * 1000).toFixed(0)} ms late: skip ${w.skip} s, len ${w.len} s of a ${w.plen} s path, its file ${w.dur.toFixed(2)} s; 0.3 s before its end it plays from ${w.end.at.toFixed(2)} s into its file)`);
        if (!await until(`(() => { const s = STUDIO.voice('${vid}'); return !!(s.playing && s.log && s.log.skip < 0); })()`, 20000)) out.push('the late voice did not play: ' + JSON.stringify(await ss(`STUDIO.voice('${vid}')`)));
        else {
          const c = await ss(`(() => { const s = STUDIO.voice('${vid}'); return s.now && s.log && s.voiceNow != null ? { d: s.voiceNow - ((s.log.skip || 0) + s.now.e), e: s.now.e } : null; })()`);
          if (!c || !(Math.abs(c.d) <= 0.05)) out.push('the late voice against the path\'s clock: ' + JSON.stringify(c));
          else console.log(`     (the late voice ${(c.d * 1000).toFixed(1)} ms from the path's clock)`);
        }
      }
      // the state and layout round trip; norm's rules for sync, skip and len
      const r = await ss(`(() => {
        const out = [], J = x => JSON.stringify(x), s = collabState(), a = J(s); collabApply(JSON.parse(a));
        const L = layoutOut(), back = readLayout(JSON.parse(J(L))), br = back.items.find(q => q.id === '${vid}').rec;
        if (J(collabState()) !== a || J(br) !== J(STU.items.get('${vid}').rec) || !('sync' in s['s.${vid}'])) out.push('the state and layout: ' + J(br));
        const N = x => norm('s', Object.assign({ file: 'tone.wav', p: [0, 0, 0] }, x));
        const res = [N({ sync: 'box001', skip: 0.4567, len: 3.21 }), N({ sync: 'box001', skip: -11, len: 700 }), N({ sync: 'box001', skip: 0 }), N({ skip: 1, len: 2 }), N({ sync: 'bad' }), N({ sync: 'box001', skip: 'x' }), N({ sync: 'box001', len: 0 })]
          .map(r => (r ? [r.sync, r.skip, r.len] : null));
        if (J(res) !== J([['box001', 0.457, 3.21], ['box001', -10, 600], ['box001', null, null], [null, null, null], null, null, null])) out.push('norm\\'s rules: ' + J(res));
        // deleted, the recording leaves its voice, no longer synced (its card says so)
        const u0 = UNDO.length;
        select('box001'); itemAct('recDel'); select('${vid}'); X.tab = 'item'; renderPanes();
        const txt = document.querySelector('#pane-item').textContent;
        if (!STU.items.has('${vid}') || syncOf(STU.items.get('${vid}')) || !/no longer synced/.test(txt) || UNDO.length !== u0 + 1) out.push('the recording deleted: ' + J([STU.items.has('${vid}'), UNDO.length - u0, /no longer synced/.test(txt)]));
        undo(); select('');
        if (!syncOf(STU.items.get('${vid}'))) out.push('Undo did not sync it again');
        return out;
      })()`);
      out.push(...r);
      // one Undo step takes the voice and the path back (the voice its first file again, which was never written over)
      const u = await ss(`(() => { undo(); return [!!voiceOf('box001'), 'path' in STU.items.get('box001').rec, voiceOf('box001') && voiceOf('box001').rec.file]; })()`);
      if (u[0] !== true || u[1] !== true || u[2] !== 'sounds/Box-voice-1.wav') out.push('Undo of Record again: ' + JSON.stringify(u));
      const u2 = await ss(`(() => { undo(); return [!!voiceOf('box001'), 'path' in STU.items.get('box001').rec, STU.items.has('${vid}')]; })()`);
      if (u2[0] !== false || u2[1] !== false || u2[2] !== false) out.push('Undo of the first: ' + JSON.stringify(u2));
      await ss(`(HOST.audio.mute(true), 0)`);
      bad(out);
    });
    await step('studio recorder: a streamed voice (the 25 s sounds/long.wav, longer than 20 s) with a 40 s path: started where the path is and at its level at once, kept within 80 ms of the path\'s clock as it plays, set again within 3 s when its element is put 0.5 s off (and started again the same way)', async () => {
      const out = [];
      await rp.click('#explore .tabs button[data-tab="scene"]');   // (a tap)
      await ss(`(HOST.audio.mute(false), select(''), setRec('box001', { path: { k: [[0, 0, 0, 0, 0, 0, 0, 1], [40, 0.5, 0, 0, 0, 0, 0, 1]], play: 'loop', start: 'shown', speed: 1 } }), STU.items.get('box001').shownAt = performance.now(),
        putItem('vst501', 's', norm('s', { name: 'Long voice', file: 'sounds/long.wav', p: [0, 1, 0], on: 'box001', o: [0, 0.5, 0], vol: 1, r: 1.5, start: 'always', loop: false, sync: 'box001' })), 0)`);
      const go = await until(`(() => { const s = STUDIO.voice('vst501'); return !!(s && s.stream && !s.stream.paused && s.now && s.stream.t > 0.3); })()`, 20000);
      if (!go) { bad(['the streamed voice did not play: ' + JSON.stringify(await ss(`[STUDIO.voice('vst501'), STU.items.get('vst501').F && STU.items.get('vst501').F.state]`))]); await ss(`(removeItem('vst501'), setRec('box001', { path: undefined }), HOST.audio.mute(true), 0)`); return; }
      // (sampled over 3 s: the path's moment in its file against the element's)
      const sample = async (ms, every) => { const d = []; for (let t = 0; t < ms; t += every) { const s = await ss(`(() => { const s = STUDIO.voice('vst501'); return s.now && s.stream && !s.stream.paused ? s.now.at - s.stream.t : null; })()`); if (s != null) d.push(s); await rp.waitForTimeout(every); } return d; };
      const stat = d => { const a = d.map(Math.abs).sort((x, y) => x - y); return { n: a.length, med: a[Math.floor(a.length / 2)], max: a[a.length - 1] }; };
      await rp.waitForTimeout(1000);
      const s1 = stat(await sample(3000, 200));
      if (!(s1.n >= 8) || !(s1.med <= 0.06) || !(s1.max <= 0.12)) out.push('as it plays: ' + JSON.stringify(s1));
      // put 0.5 s off: set again
      const f0 = await ss(`(() => { const S = STU.items.get('vst501').st; const f = S.fixes || 0; S.el.currentTime += 0.5; return f; })()`);
      const fixed = await until(`(() => { const s = STUDIO.voice('vst501'); return !!(s.stream && s.stream.fixes > ${f0} && s.now && !s.stream.paused && Math.abs(s.now.at - s.stream.t) <= 0.08); })()`, 3000);
      const s2 = stat(await sample(1500, 250));
      if (!fixed || !(s2.med <= 0.08)) out.push('put 0.5 s off: ' + JSON.stringify([fixed, s2, await ss(`STUDIO.voice('vst501').stream`)]));
      // started again (as at a new pass): where its path is, at its level at once
      const g = await ss(`(() => { const it = STU.items.get('vst501'); emitStop(it); emitStep(performance.now()); return { gt: it.gt, want: it.fa * it.rec.vol, src: !!it.src, log: it.syncLog }; })()`);
      if (!g.src || !(g.want > 0.5) || g.gt !== g.want) out.push('started again: ' + JSON.stringify(g));
      await rp.waitForTimeout(1500);
      const s3 = stat(await sample(1500, 250));
      if (!(s3.med <= 0.08)) out.push('started again, as it plays: ' + JSON.stringify(s3));
      const st = await ss(`STUDIO.voice('vst501').stream`);
      console.log(`     (the streamed voice from the path's clock: median ${(s1.med * 1000).toFixed(0)} ms, at most ${(s1.max * 1000).toFixed(0)} ms over ${s1.n} samples; put 0.5 s off, back within 80 ms (median ${(s2.med * 1000).toFixed(0)} ms after); started again, median ${(s3.med * 1000).toFixed(0)} ms; set again ${st && st.fixes} times, its lead ${st && (st.lag * 1000).toFixed(0)} ms)`);
      await ss(`(removeItem('vst501'), setRec('box001', { path: undefined }), HOST.audio.mute(true), 0)`);
      bad(out);
    });
  } finally {
    await rb.close();
    if (RL && RL.proc.exitCode === null) RL.proc.kill();
    try { fs.rmSync(SC, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}
// The studio's trigger cubes that change pictures on objects (tools/studio/SPEC.md, "Trigger cubes that change textures"),
// on a page of its own at the test scene, with two solid pictures made in the page and served as the scene's own
// (tex/magenta.png, tex/lime.png), Twin (a second object of box.glb) and three cubes put in for these steps: pixels read
// back from renders show the box's front in a cube's picture with a pretend head in the cube and its own outside (Twin
// unchanged); two cubes on one slot, the one entered last wins; a cube that stays holds until Reset what I have seen and
// the lobby; Change texture's preview on the box wins while open; as scanned a colour change shows and a normal-map entry
// is left out (lit takes it), a material as scanned made while a picture is on taking its own; the state and layout.json
// round trip, norm's rules, entries a layout lacks; the page's card (Change a texture... through to the entry, a press
// flashing the box, ✕, Undo; nothing with editing off or for a visitor) and the headset's; the Items card's line;
// deleting and duplicating the box (a cube, a group too), the figure switched to its GLB keeping its entry
if (runs('studio texture swaps')) {
  const tp = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  tp.on('pageerror', e => errors.push('studio texture swaps: ' + (e.stack || e.message)));
  tp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('studio texture swaps: ' + m.text()); });
  const ss = s => tp.evaluate(s => HOST.cur.peek(s), s);
  const until = (src, ms) => tp.waitForFunction(src => HOST.cur.peek(src), src, { timeout: ms || 20000 }).then(() => true, () => false);
  const bad = list => { if (list.length) errors.push(...list.map(b => 'studio texture swaps: ' + b)); };
  // (in the page: the scene drawn from a camera of its own and read back where scene points land, only objects drawn; a
  // pretend head (null: nobody) and a frame's steps)
  const HELP = `window.__tx = window.__tx || {
    shot: (eye, tgt, pts) => {
      const W = 320, H = 200, r = GL.renderer, rt = new THREE.WebGLRenderTarget(W, H), cam = new THREE.PerspectiveCamera(60, W / H, 0.02, 200);
      GL.world.updateMatrixWorld(true);
      cam.position.copy(GL.items.localToWorld(new THREE.Vector3(...eye))); cam.lookAt(GL.items.localToWorld(new THREE.Vector3(...tgt))); cam.updateMatrixWorld();
      const hid = [GL.edit, GL.selBox, GL.hoverBox, GL.flashBox, GL.tc].filter(Boolean).concat([...STU.items.values()].filter(i => i.kind !== 'o').map(i => i.holder));
      const keep = hid.map(o => o.visible);
      hid.forEach(o => { o.visible = false; });
      r.setRenderTarget(rt); r.render(GL.scene, cam);
      const px = pts.map(p => { const v = GL.items.localToWorld(new THREE.Vector3(...p)).project(cam), b = new Uint8Array(4); r.readRenderTargetPixels(rt, Math.round((v.x + 1) / 2 * W), Math.round((v.y + 1) / 2 * H), 1, 1, b); return [b[0], b[1], b[2]]; });
      r.setRenderTarget(null); hid.forEach((o, i) => { o.visible = keep[i]; }); rt.dispose();
      return px;
    },
    at: p => { shownFor(p); itemsStep(0, performance.now()); return 0; },
  }`;
  // (the box's and Twin's front faces, seen from in front of both; a pixel's colour in words)
  const cls = p => (p[0] - p[1] > 50 && p[2] - p[1] > 50 ? 'magenta' : p[1] - p[0] > 50 && p[1] - p[2] > 50 ? 'lime' : 'own');
  const look = async head => (await ss(`(window.__tx.at(${JSON.stringify(head)}), window.__tx.shot([-0.3, 0.35, 0.4], [-0.3, 0.25, -1.75], [[-1, 0.25, -1.75], [0.4, 0.25, -1.75]]))`)).map(cls);
  const OUT = [3, 1, 6], A = [2.7, 1, 2], AB = [3.3, 1, 2], B = [3.9, 1, 2], C = [7, 1, 2];
  const E = o => Object.assign({ on: 'box001', mat: 0, slot: 'map', file: 'tex/magenta.png' }, o);

  await step('studio texture swaps: pixels: the box in a cube\'s picture with a pretend head in it and its own outside, Twin (the same file) unchanged; two cubes on one slot, the one entered last wins; a cube that stays holds until Reset what I have seen and the lobby; Change texture\'s preview wins while open', async () => {
    await tp.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&scene=test&edit');
    await tp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    if (!await until(`STUDIO.ready() && !!STU.items.get('box001').model`, 120000)) { errors.push('studio texture swaps: the test scene did not load'); return; }
    // two solid pictures made in the page, served as the scene's own
    const pics = await tp.evaluate(() => Object.fromEntries([['magenta', '#ff00ff'], ['lime', '#3cff28']].map(([n, c]) => { const cv = document.createElement('canvas'); cv.width = cv.height = 8; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 8, 8); return [n, cv.toDataURL('image/png').split(',')[1]]; })));
    await tp.route('**/scenes/test/tex/*.png*', route => { const n = /tex\/(\w+)\.png/.exec(route.request().url()); route.fulfill({ body: Buffer.from(pics[n && pics[n[1]] ? n[1] : 'magenta'], 'base64'), contentType: 'image/png' }); });
    await ss(`(${HELP}, setFiles(STU.files.concat([{ path: 'tex/magenta.png', bytes: 90, at: 7, kind: 'image' }, { path: 'tex/lime.png', bytes: 90, at: 7, kind: 'image' }])), setRec('box001', { anim: 'off' }),
      putItem('twn001', 'o', norm('o', { name: 'Twin', file: 'box.glb', p: [0.4, 0.25, -2], anim: 'off' })),
      putItem('txa001', 'c', norm('c', { name: 'Magenta', p: [3, 1, 2], size: [1, 2, 1], tex: [${JSON.stringify(E())}] })),
      putItem('txb001', 'c', norm('c', { name: 'Lime', p: [3.6, 1, 2], size: [1, 2, 1], tex: [${JSON.stringify(E({ file: 'tex/lime.png' }))}] })),
      putItem('txc001', 'c', norm('c', { name: 'Stays', p: [7, 1, 2], size: [1, 2, 1], mode: 'stay', tex: [${JSON.stringify(E({ file: 'tex/lime.png' }))}] })), 0)`);
    const out = [];
    if (!await until(`!!STU.items.get('twn001').model && ['tex/magenta.png', 'tex/lime.png'].every(p => (STUDIO.tex().pics[p] || {}).state === 'ready')`, 30000)) { out.push('the pictures were not read: ' + JSON.stringify(await ss('STUDIO.tex()'))); bad(out); return; }
    const pv = await ss(`STUDIO.tex().pics`);
    if (!pv['tex/magenta.png'].t[0] || pv['tex/magenta.png'].t[1] || pv['tex/magenta.png'].w !== 8) out.push('a picture for a GLB: read once, one texture without flipping, made ahead: ' + JSON.stringify(pv));
    const seq = [['outside', OUT, 'own'], ['in Magenta', A, 'magenta'], ['in both, Lime entered last', AB, 'lime'], ['in Lime only', B, 'lime'], ['in both, Magenta entered last', AB, 'magenta'], ['outside', OUT, 'own'],
      ['in Stays', C, 'lime'], ['out of Stays', OUT, 'lime'], ['in Magenta after Stays', A, 'magenta'], ['out of Magenta, Stays still on', OUT, 'lime']];
    for (const [w, h, want] of seq) { const got = await look(h); if (got[0] !== want || got[1] !== 'own') out.push(`${w}: the box ${got[0]} (not ${want}), Twin ${got[1]}`); }
    const on = await ss(`(window.__tx.at(${JSON.stringify(A)}), JSON.stringify(STUDIO.tex('box001').on) + JSON.stringify(STUDIO.tex('twn001').on))`);
    if (on !== '[["map","lit","magenta.png"]][]') out.push('the box\'s materials in Magenta (Twin\'s none): ' + on);
    await ss(`(resetSeen(), 0)`);
    if ((await look(OUT))[0] !== 'own') out.push('Reset what I have seen did not give its own picture back');
    await look(C); await look(OUT);
    await ss(`(studioLobby(), 0)`);
    if ((await look(OUT))[0] !== 'own') out.push('the lobby hook did not give its own picture back');
    // Change texture's preview on the box wins while it is open (its own back), the cube's again once it closes
    await look(A);
    await ss(`(select('box001'), ctOpen('box001'), 0)`);
    const held = [await ss(`CT.id`), (await look(A))[0], await ss(`STUDIO.tex('box001').sig`)];
    await ss(`(ctClose(), select(''), 0)`);
    const after = (await look(A))[0];
    if (held[0] !== 'box001' || held[1] !== 'own' || held[2] !== 'held' || after !== 'magenta') out.push('Change texture\'s preview on it (open, then closed): ' + JSON.stringify([held, after]));
    await look(OUT);
    bad(out);
  });

  await step('studio texture swaps: as scanned a colour change shows and a normal-map entry is left out, lit takes it; a material as scanned made while a picture is on takes its own', async () => {
    const out = [];
    await ss(`(setRec('txa001', { tex: [${JSON.stringify(E())}, ${JSON.stringify(E({ slot: 'normalMap', file: 'tex/lime.png' }))}] }), window.__tx.at(${JSON.stringify(OUT)}))`);
    const own = await ss(`JSON.stringify(STUDIO.tex('box001').mats)`);
    // in Magenta lit (nothing as scanned made yet), then as scanned there: made from its own pictures, the cube's on it
    await look(A);
    const lit = await ss(`[JSON.stringify(STUDIO.tex('box001').on), !!STU.items.get('box001').model.meshes[0].userData.scan]`);
    await ss(`(setRec('box001', { light: 'scan' }), 0)`);
    const sc = [(await look(A))[0], await ss(`JSON.stringify(STUDIO.tex('box001').on.slice().sort())`), await ss(`JSON.stringify(STUDIO.tex('box001').mats)`)];
    await look(OUT);
    const scOut = await ss(`STUDIO.tex('box001').mats`);
    if (lit[0] !== '[["map","lit","magenta.png"],["normalMap","lit","lime.png"]]' || lit[1]) out.push('lit in Magenta: its colour and normal map: ' + JSON.stringify(lit));
    if (sc[0] !== 'magenta' || sc[1] !== '[["map","lit","magenta.png"],["map","scan","magenta.png"],["normalMap","lit","lime.png"]]' || /"scan",\{[^}]*normalMap/.test(sc[2])) out.push('as scanned in Magenta: the colour shown, no normal map on the scanned material: ' + JSON.stringify(sc));
    const litOwn = JSON.parse(own)[0][0][1], scanOwn = scOut[0].find(x => x[0] === 'scan');
    if (!scanOwn || scanOwn[1].map !== litOwn.map || scOut[0].find(x => x[0] === 'lit')[1].map !== litOwn.map || ('normalMap' in scOut[0].find(x => x[0] === 'lit')[1]) !== ('normalMap' in litOwn)) out.push('out of the cube, lit and as scanned their own pictures (the scanned one made while the cube\'s was on): ' + JSON.stringify([own, scOut]));
    await ss(`(setRec('box001', { light: 'lit' }), setRec('txa001', { tex: [${JSON.stringify(E())}] }), 0)`);
    bad(out);
  });

  await step('studio texture swaps: the state and layout.json carry a cube\'s entries and give them back; norm\'s rules (bad entries dropped, one per object, material and slot, 16 at most, not a list: a bad record); a layout\'s bad entries counted and those for objects it lacks dropped', async () => {
    const st = await ss(`(() => {
      const J = x => JSON.stringify(x), E = o => Object.assign(${JSON.stringify(E())}, o), s = collabState(), a = J(s); collabApply(JSON.parse(a));
      const N = x => norm('c', Object.assign({ p: [0, 1, 0] }, x)), many = Array.from({ length: 17 }, (_, i) => E({ mat: i }));
      const L = layoutOut(), back = readLayout(JSON.parse(J(L)));
      const lay = readLayout({ studio: 1, objects: [{ id: 'box001', file: 'box.glb', p: [0, 0, 0] }], cubes: [{ id: 'cub001', p: [0, 1, 0], tex: [E(), E({ on: 'gon001' }), E({ slot: 'bumpMap' }), E({ mat: -1 }), 'x', E({ file: '../x.png' })] }, { id: 'cub002', p: [0, 1, 0], tex: 'nope' }] });
      STU.badTex = 3; const said = paneBlocks('scene').some(b => /3 of the trigger cubes' texture changes in layout.json could not be read/.test(b.p || '')); STU.badTex = 0;
      return [J(s['c.txa001'].tex), J(collabState()) === a, J(N({ tex: [E()] }).tex), 'tex' in N({ tex: [] }), 'tex' in N({ tex: null }), N({ tex: 'x' }), N({ tex: {} }),
        'tex' in N({ tex: [E({ on: 'BOX' }), E({ mat: -1 }), E({ mat: 1.5 }), E({ mat: 256 }), E({ slot: 'bumpMap' }), E({ file: '../a.png' }), E({ file: 'box.glb' }), {}, null, [E()]] }),
        J(N({ tex: [E(), E({ file: 'tex/lime.png' })] }).tex), N({ tex: many }).tex.length, J(N(N({ tex: many }))) === J(N({ tex: many })), J(N({ tex: [E({ extra: 1 })] }).tex[0]),
        J(L.cubes.find(c => c.id === 'txa001').tex) === J(s['c.txa001'].tex), J(back.items.find(x => x.id === 'txa001').rec) === J(STU.items.get('txa001').rec), back.texBad, 'tex' in L.cubes.find(c => c.id === 'cube01'),
        J(lay.items.find(x => x.id === 'cub001').rec.tex), lay.texBad, lay.bad, said];
    })()`);
    const want = [JSON.stringify([E()]), true, JSON.stringify([E()]), false, false, null, null, false, JSON.stringify([E()]), 16, true, JSON.stringify(E()), true, true, 0, false, JSON.stringify([E()]), 4, 1, true];
    if (JSON.stringify(st) !== JSON.stringify(want)) bad(['the state, norm and layout.json: ' + JSON.stringify(st) + ' (wanted ' + JSON.stringify(want) + ')']);
  });

  await step('studio texture swaps: the page\'s card: Change a texture... (the object from the list or by a click in the scene, a slot, a picture) adds an entry, one Undo step; its row flashes the object in amber; ✕ takes it off, one Undo step; the Items card says so; nothing with editing off or for a visitor', async () => {
    const out = [];
    await ss(`(select('txa001'), X.tab = 'item', renderPanes(), 0)`);
    // (one pick at a time: Pick what it shows ends a texture pick, and the other way round)
    const one = await ss(`[(itemAct('pickFor', 'show', 'txa001'), itemAct('txPick', null, 'txa001'), [STU.pick, !!STU.txp]), (itemAct('pickFor', 'show', 'txa001'), [!!STU.pick, STU.txp]), (STU.pick = null, renderPanes(), 0)]`);
    if (JSON.stringify(one) !== '[[null,true],[true,null],0]') out.push('one pick at a time: ' + JSON.stringify(one));
    const u0 = await ss('UNDO.length');
    await tp.click('#pane-item [data-act="i:txPick"]');
    const p1 = await ss(`[STU.txp && STU.txp.step, !!document.querySelector('#pane-item [data-act="i:txOn"][data-v="twn001"]'), UNDO.length]`);
    await tp.click('#pane-item [data-act="i:txOn"][data-v="box001"]');
    const p2 = await ss(`[STU.txp && STU.txp.step, STU.txp && STU.txp.on, STU.txp && STU.txp.slot, !!document.querySelector('#pane-item [data-act="i:txPic"][data-v="tex/lime.png"]')]`);
    await tp.click('#pane-item [data-act="i:txBack"]');
    await ss(`(pressItem('twn001'), renderPanes(), 0)`);   // (a click on Twin in the scene, as clickAt hands it on)
    const p3 = await ss(`[STU.txp && STU.txp.step, STU.txp && STU.txp.on, STU.sel]`);
    await tp.click('#pane-item [data-act="i:txSlot"][data-v="emissiveMap"]');
    await tp.click('#pane-item [data-act="i:txPic"][data-v="tex/lime.png"]');
    const p4 = await ss(`[JSON.stringify(STU.items.get('txa001').rec.tex), UNDO.length, STU.txp, renderPanes() || document.querySelectorAll('#pane-item [data-act="i:untex"]').length, document.querySelector('#pane-item').textContent.includes('Twin · Glow → lime.png')]`);
    if (p1[0] !== 'obj' || !p1[1] || p1[2] !== u0 || p2[0] !== 'pic' || p2[1] !== 'box001' || p2[2] !== 'map' || !p2[3] || p3[0] !== 'pic' || p3[1] !== 'twn001' || p3[2] !== 'txa001') out.push('the pick: ' + JSON.stringify([p1, p2, p3]));
    if (p4[0] !== JSON.stringify([E(), E({ on: 'twn001', slot: 'emissiveMap', file: 'tex/lime.png' })]) || p4[1] !== u0 + 1 || p4[2] !== null || p4[3] !== 2 || !p4[4]) out.push('the entry added, one Undo step: ' + JSON.stringify(p4));
    // Twin in it: lime glows on Twin, the box magenta (lit and on its material as scanned, made above), for a head in the
    // cube (Twin's material its own clone)
    const tw = await ss(`(window.__tx.at(${JSON.stringify(A)}), [JSON.stringify(STUDIO.tex('twn001').on), JSON.stringify(STUDIO.tex('box001').on), (window.__tx.at(${JSON.stringify(OUT)}), JSON.stringify(STUDIO.tex('twn001').on))])`);
    if (tw[0] !== '[["emissiveMap","lit","lime.png"]]' || tw[1] !== '[["map","lit","magenta.png"],["map","scan","magenta.png"]]' || tw[2] !== '[]') out.push('Twin\'s glow and the box\'s colour in the cube, none outside: ' + JSON.stringify(tw));
    // its row flashes the box in amber; ✕ takes the second entry off (one Undo step), Undo puts it back
    await ss(`(select('txa001'), renderPanes(), 0)`);
    await tp.click('#pane-item [data-act="i:txFlash"][data-v="box001"]');
    const fl = await ss(`(editStep(true), [STU.flash && STU.flash.id, STU.flash && STU.flash.tex, GL.flashBox.visible, GL.flashBox.material.color.getHex() === 0xffc24a, UNDO.length])`);
    if (fl[0] !== 'box001' || !fl[1] || !fl[2] || !fl[3] || fl[4] !== u0 + 1) out.push('its row flashes the box in amber (no Undo step): ' + JSON.stringify(fl));
    await tp.click('#pane-item [data-act="i:untex"][data-v="1"]');
    const un = await ss(`[JSON.stringify(STU.items.get('txa001').rec.tex), UNDO.length, (undo(), JSON.stringify(STU.items.get('txa001').rec.tex))]`);
    if (un[0] !== JSON.stringify([E()]) || un[1] !== u0 + 2 || un[2] !== p4[0]) out.push('✕ and Undo: ' + JSON.stringify(un));
    // the Items card's line
    const card = await ss(`(() => { const c = paneBlocks('items').flatMap(b => b.grid || []).find(x => x.v === 'txa001'); return c && c.sub; })()`);
    if (card !== 'Cube · shows 0, hides 0, textures 2') out.push('the Items card\'s line: ' + card);
    // editing off, and a visitor: no pick and no change
    const off = await ss(`(() => {
      const r0 = JSON.stringify(STU.items.get('txa001').rec);
      setEdit(false); itemAct('txPick', null, 'txa001'); itemAct('untex', 0, 'txa001'); const a = [STU.txp, JSON.stringify(STU.items.get('txa001').rec) === r0];
      setEdit(true); OPT.visit = true; select('txa001'); itemAct('txPick', null, 'txa001'); itemAct('untex', 0, 'txa001');
      const pick = paneBlocks('item').flatMap(b => b.row || []).find(x => x.id === 'txpick');
      const b = [STU.txp, JSON.stringify(STU.items.get('txa001').rec) === r0, !!(pick && pick.dis)];
      OPT.visit = false; return a.concat(b);
    })()`);
    if (JSON.stringify(off) !== '[null,true,null,true,true]') out.push('editing off and a visitor: ' + JSON.stringify(off));
    bad(out);
  });

  await step('studio texture swaps: the headset\'s card: its rows, Change a texture... by the trigger on the box, a slot and a picture pressed on the panel, ✕', async () => {
    const xr = await ss(`(() => {
      XR.on = true;
      const draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } };
      const ids = () => { const out = []; for (let off = 0; off < 6000; off += 150) { X.scroll.item = off; draw(); out.push(...XR.main.regions.map(z => z.id)); } X.scroll = {}; return [...new Set(out)]; };
      const press = id => { for (let off = 0; off < 6000; off += 150) { X.scroll.item = off; draw(); const q = XR.main.regions.find(z => z.id === id); if (q && q.fn) { q.fn(); X.scroll = {}; draw(); return true; } } X.scroll = {}; return false; };
      select('txa001'); X.tab = 'item'; X.scroll = {}; draw();
      const u0 = UNDO.length, rows = ids(), r = [rows.includes('txflash:0') && rows.includes('untex:1') && rows.includes('txpick')];
      r.push(press('txpick'), STU.txp && STU.txp.step);
      pressItem('box001');   // (the trigger on the box, as xrPress hands it on)
      r.push(STU.txp && STU.txp.on, ids().includes('txpic:tex/magenta.png'));
      r.push(press('txslot:aoMap'), STU.txp && STU.txp.slot, press('txpic:tex/magenta.png'), JSON.stringify(STU.items.get('txa001').rec.tex.slice(-1)[0]), UNDO.length - u0);
      r.push(press('untex:2'), STU.items.get('txa001').rec.tex.length, UNDO.length - u0);
      XR.on = false; select(''); X.tab = 'scene'; renderPanes();
      return r;
    })()`);
    const want = [true, true, 'obj', 'box001', true, true, 'aoMap', true, JSON.stringify(E({ slot: 'aoMap' })), 1, true, 2, 2];
    if (JSON.stringify(xr) !== JSON.stringify(want)) bad(['the headset\'s card: ' + JSON.stringify(xr) + ' (wanted ' + JSON.stringify(want) + ')']);
  });

  await step('studio texture swaps: deleting the box takes its entries out of every cube (one Undo step brings them back); duplicating it adds entries for the copy beside its own; a cube\'s copy keeps its entries; a group\'s copy; the figure switched to its GLB keeps its entry, its materials found again', async () => {
    const out = [];
    await ss(`(setRec('txa001', { tex: [${JSON.stringify(E())}] }), 0)`);
    const d = await ss(`(() => {
      const J = x => JSON.stringify(x), T = id => J((STU.items.get(id).rec.tex || []).map(e => e.on)), u0 = UNDO.length, r = [];
      deleteItem('box001');
      r.push(T('txa001'), 'tex' in STU.items.get('txb001').rec, 'tex' in STU.items.get('txc001').rec, UNDO.length - u0);
      undo();
      r.push(T('txa001'), T('txb001'), T('txc001'));
      const nid = duplicateItem('box001');
      r.push(J(STU.items.get('txa001').rec.tex.map(e => e.on === nid ? 'copy' : e.on)), J(STU.items.get('txc001').rec.tex.map(e => e.on === nid ? 'copy' : e.on)), UNDO.length - u0);
      undo();
      const cid = duplicateItem('txa001');
      r.push(J(STU.items.get(cid).rec.tex) === J(STU.items.get('txa001').rec.tex));
      undo();
      putItem('grp001', 'g', norm('g', { name: 'Pair', items: ['box001', 'txb001'] }));
      const before = new Set(STU.items.keys()), gid = duplicateGroup(STU.items.get('grp001')), made = [...STU.items.keys()].filter(k => !before.has(k));
      const bc = made.find(k => STU.items.get(k).kind === 'o'), cc = made.find(k => STU.items.get(k).kind === 'c');
      r.push(!!gid, J(STU.items.get(cc).rec.tex.map(e => e.on === bc ? 'copy' : e.on)), J(STU.items.get('txa001').rec.tex.map(e => e.on === bc ? 'copy' : e.on)));
      undo(); removeItem('grp001');
      return r;
    })()`);
    const want = ['[]', false, false, 1, '["box001"]', '["box001"]', '["box001"]', '["box001","copy"]', '["box001","copy"]', 1, true, true, '["copy"]', '["box001","copy"]'];
    if (JSON.stringify(d) !== JSON.stringify(want)) out.push('delete, duplicate, a cube\'s copy, a group\'s copy: ' + JSON.stringify(d) + ' (wanted ' + JSON.stringify(want) + ')');
    // the materials found again: by meshes and names, by names, and none when not known; an entry's material changed in a switch's change
    const rm = await ss(`(() => {
      const J = x => JSON.stringify(x), a = { name: 'a', meshes: ['m1'] }, b = { name: 'b', meshes: ['m2'] }, n = x => Object.assign({}, x, { meshes: [] });
      const r = [J(texRemap([a, b], [b, a])), J(texRemap([n(a), n(b)], [n(b), n(a)])), J(texRemap([{ name: '', meshes: [] }], [{ name: '', meshes: [] }, { name: '', meshes: [] }])), texRemap(null, [a])];
      change(() => texSwitched(new Set(['box001']), [3]));
      r.push(STU.items.get('txa001').rec.tex[0].mat);
      undo();
      r.push(STU.items.get('txa001').rec.tex[0].mat);
      return r;
    })()`);
    if (JSON.stringify(rm) !== '["[1,0]","[1,0]","[-1]",null,3,0]') out.push('texRemap and texSwitched: ' + JSON.stringify(rm));
    // the figure with an entry, converted to a GLB and switched to it: its entry kept (the same object), on the material
    // found again, put on its GLB's model for a head in the cube
    await ss(`(setRec('txa001', { tex: [${JSON.stringify(E())}, ${JSON.stringify(E({ on: 'fig001' }))}] }), STUDIO.lastGLB = null, convertFile('figure.fbx'), 0)`);
    if (!await until(`!CV.busy && !!STUDIO.lastGLB`, 90000) || !await ss('STUDIO.lastGLB.ok')) { out.push('figure.fbx was not converted: ' + await ss('CV.note')); bad(out); return; }
    const bytes = Buffer.from(await ss(`(() => { const u = new Uint8Array(STUDIO.lastGLB.glb); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); })()`), 'base64');
    const pat = '**/scenes/test/models/figure.glb*';
    await tp.route(pat, route => route.fulfill({ body: bytes, contentType: 'model/gltf-binary' }));
    const mats = await ss(`[JSON.stringify(STUDIO.lastGLB.mats0), JSON.stringify(STUDIO.lastGLB.mats), JSON.stringify(texRemap(STUDIO.lastGLB.mats0, STUDIO.lastGLB.mats))]`);
    await ss(`(setFiles(STU.files.concat({ path: 'models/figure.glb', bytes: ${bytes.length}, at: 7, kind: 'model' })), GLBREC.set('models/figure.glb', { at: 7, rec: STUDIO.lastGLB.record, p: null }), switchToGLB('figure.fbx', 'models/figure.glb', STUDIO.lastGLB.record, texRemap(STUDIO.lastGLB.mats0, STUDIO.lastGLB.mats)))`);
    const sw = await until(`(() => { const f = STU.items.get('fig001'); return f.rec.file === 'models/figure.glb' && !!f.model && f.built === f.E.gen; })()`, 30000);
    const g = await ss(`[JSON.stringify(STU.items.get('txa001').rec.tex[1]), (window.__tx.at(${JSON.stringify(A)}), JSON.stringify(STUDIO.tex('fig001').on)), (window.__tx.at(${JSON.stringify(OUT)}), JSON.stringify(STUDIO.tex('fig001').on))]`);
    if (!sw || mats[2] !== '[0]' || g[0] !== JSON.stringify(E({ on: 'fig001' })) || g[1] !== '[["map","lit","magenta.png"]]' || g[2] !== '[]') out.push('the figure switched to its GLB keeps its entry: ' + JSON.stringify({ sw, mats, g }));
    await ss(`(undo(), setFiles(STU.files.filter(f => !/^models\\//.test(f.path))), GLBREC.delete('models/figure.glb'), 0)`);
    await tp.unroute(pat);
    bad(out);
    await tp.close();
  });
}
// The studio's trackers (v126, tools/trackers/SPEC.md: e6k_trk.js and e6l_puppet.js), on pages of their own. The PC's
// trackers come from the shell (HOST.collab.trackers(): the relay's @trk stream, interpolated); these steps give the studio
// a pretend studio station and the trackers themselves (HOST.collab.live and HOST.collab.trackers, tracker and body stubbed
// in the page, so each frame's poses are exact), and, where the shell has its test hook HOST.collab.trkIn, one step feeds a
// tracker through it as the relay would. The stream itself, the lining up of SteamVR's space with the room and @trk are the
// relay's and the shell's (relay/test.mjs, tools/collab.mjs --trackers)
// (in the page: the studio's own functions and state, for the steps' code)
const STU_ENGINE = `(window.__E = { putItem, norm, setRec, itemAct, behaveStep, itemsStep, STU, TRK, PUP, IK, GL, UNDO, undo, collabState, collabApply, readLayout, layoutOut, duplicateItem,
  duplicateGroup, paneBlocks, select, switchedRec, MPAUSE, STUDIO, openScene, lockStops, CV, trkPose, pupRig, XR, X, panelTick, renderPanes,
  // (the headset's card drawn, and a button of it pressed, scrolling down to it: true if it was there)
  press: id => { XR.on = true; const draw = () => { for (const P of XR.panels) { P.last = ''; P.t = -1e9; panelTick(P, performance.now() + 1e6); } }; X.tab = 'item';
    try { for (let off = 0; off < 8000; off += 150) { X.scroll.item = off; draw(); const q = XR.main.regions.find(z => z.id === id); if (q && q.fn) { q.fn(); return true; } } return false; } finally { X.scroll = {}; draw(); XR.on = false; } } }, 0)`;
if (runs('studio trackers')) {
  const kp = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  kp.on('pageerror', e => errors.push('studio trackers: ' + (e.stack || e.message)));
  kp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('studio trackers: ' + m.text()); });
  const until = (src, ms) => kp.waitForFunction(src => HOST.cur.peek(src), src, { timeout: ms || 20000 }).then(() => true, () => false);
  const bad = list => { if (list.length) errors.push(...list.map(b => 'studio trackers: ' + b)); };
  const said = async pg => { for (const l of await pg.evaluate(() => { const l = window.__log || []; window.__log = []; return l; })) console.log(l); };
  // (in the page: a pretend studio station and its trackers, frames run, an item's drawn pose, matrices compared)
  const HELP = () => {
    const E = window.__E;
    window.__tk = {
      list: [], live: HOST.collab.live, trackers: HOST.collab.trackers,
      V: (...a) => new THREE.Vector3(...a), Q: (ax, deg) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...ax).normalize(), deg * Math.PI / 180),
      one: (id, p, q, o) => Object.assign({ id, name: '', k: 't', p: p.toArray(), q: q.toArray(), ok: true }, o || {}),
      run: n => { for (let k = 0; k < (n || 2); k++) { E.GL.world.updateMatrixWorld(true); E.behaveStep(1 / 30, performance.now()); E.itemsStep(1 / 30, performance.now()); } },
      drawn: id => { const H = E.STU.items.get(id).holder; return H.matrixAutoUpdate ? new THREE.Matrix4().compose(H.position, H.quaternion, H.scale) : H.matrix.clone(); },
      placed: id => { const H = E.STU.items.get(id).holder; return new THREE.Matrix4().compose(H.position, H.quaternion, H.scale); },
      far: (a, b) => Math.max(...a.elements.map((v, i) => Math.abs(v - b.elements[i]))),
      at: m => new THREE.Vector3().setFromMatrixPosition(m),
    };
    HOST.collab.live = () => ({ id: 'sttrk1', story: 'studio' });
    HOST.collab.trackers = () => window.__tk.list.map(x => Object.assign({}, x));
    return 0;
  };
  await step('studio trackers: a shape follows a tracker (its offset kept as it is chosen, within 5 mm as the tracker moves and turns), Snap onto it, a tracker not seen held, one never seen here its placed pose, resting while carried or paused, a sound following it, None, the card, one Undo step each', async () => {
    await kp.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&scene=test&edit');
    await kp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    if (!await until(`STUDIO.ready() && !!STU.items.get('box001').model`, 120000)) { bad(['the test scene did not load']); return; }
    await kp.evaluate(s => HOST.cur.peek(s), STU_ENGINE);
    await kp.evaluate(HELP);
    const r = await kp.evaluate(() => {
      const E = window.__E, K = window.__tk, o = [], A = 'LHR-TRKA0001', B = 'LHR-TRKB0002';
      E.putItem('trs001', 'p', E.norm('p', { name: 'Prop', shape: 'cube', p: [1, 0.5, -2], q: K.Q([0, 1, 0], 20).toArray(), size: [0.3, 0.2, 0.4] }));
      E.putItem('trsnd1', 's', E.norm('s', { name: 'Hum', file: 'tone.wav', p: [1, 0.8, -2], on: 'trs001', o: [0, 0.3, 0] }));
      E.select('');
      const P0 = K.V(0.5, 1, -1.5), Q0 = K.Q([0, 1, 0], 30);
      K.list = [K.one(A, P0, Q0, { name: 'Cup' }), K.one(B, K.V(-1, 0.9, -1), K.Q([1, 0, 0], 10))];
      K.run();
      if (E.TRK.st !== 'sttrk1' || E.TRK.at.size !== 2) o.push('the trackers here: ' + JSON.stringify(E.STUDIO.trk()));
      // the card: Follows a tracker, its list by name (or serial)
      E.select('trs001');
      let blocks = E.paneBlocks('item'), row = blocks.find(b => b.row && b.row.some(t => t.id === 'trk:none'));
      if (!row || !row.row.some(t => t.id === 'trklist')) o.push('no Follows a tracker row on the shape\'s card');
      E.itemAct('trkpick', '', 'trs001');
      blocks = E.paneBlocks('item');
      const lst = blocks.find(b => b.list && b.list.some(t => t.id === 'trkto:' + A));
      if (!lst || lst.list.find(t => t.id === 'trkto:' + A).label !== 'Cup' || lst.list.find(t => t.id === 'trkto:' + B).label !== B) o.push('the list of trackers: ' + JSON.stringify(lst && lst.list.map(t => [t.id, t.label])));
      // the headset's card: the same row and list (pressed there: the list closed again, then opened)
      if (!E.press('trklist') || E.STU.trkList || !E.press('trklist') || E.STU.trkList !== 'trs001') o.push('the headset\'s Follows a tracker: ' + E.STU.trkList);
      // chosen: one Undo step, the shape where it stands (its offset from the tracker now)
      const u0 = E.UNDO.length, placed0 = K.placed('trs001');
      E.itemAct('trk', A, 'trs001');
      K.run();
      const t = E.STU.items.get('trs001').rec.trk;
      if (!t || t.id !== A || E.UNDO.length !== u0 + 1 || E.STU.trkList) o.push('chosen: ' + JSON.stringify([t, E.UNDO.length - u0, E.STU.trkList]));
      if (K.far(K.drawn('trs001'), placed0) > 2e-3) o.push('chosen, it moved: ' + K.far(K.drawn('trs001'), placed0));
      // the tracker moves and turns: the shape with it, its pose on the tracker kept
      const P1 = K.V(2, 1.3, -0.5), Q1 = K.Q([1, 1, 0], 50);
      K.list[0] = K.one(A, P1, Q1, { name: 'Cup' });
      K.run();
      const rel0 = new THREE.Matrix4().compose(P0, Q0, K.V(1, 1, 1)).invert().multiply(placed0), rel1 = new THREE.Matrix4().compose(P1, Q1, K.V(1, 1, 1)).invert().multiply(K.drawn('trs001'));
      const mid1 = K.at(K.drawn('trs001')), want1 = K.at(new THREE.Matrix4().compose(P1, Q1, K.V(1, 1, 1)).multiply(rel0));
      if (mid1.distanceTo(want1) > 0.005 || K.far(rel0, rel1) > 2e-3) o.push('moved with the tracker: ' + [mid1.distanceTo(want1), K.far(rel0, rel1)]);
      if (!E.STUDIO.trk('trs001').item.on || !E.STUDIO.trk('trs001').base) o.push('drawn through the base stage: ' + JSON.stringify(E.STUDIO.trk('trs001')));
      // a sound following it moves with it (the tracker moved along x only)
      const s0 = E.STU.items.get('trsnd1').holder.position.clone();
      K.list[0] = K.one(A, P1.clone().add(K.V(0.4, 0, 0)), Q1, { name: 'Cup' });
      K.run();
      const s1 = E.STU.items.get('trsnd1').holder.position.clone();
      if (Math.abs(s1.x - s0.x - 0.4) > 1e-3 || Math.abs(s1.y - s0.y) > 1e-3 || Math.abs(s1.z - s0.z) > 1e-3) o.push('the sound following it: ' + [s0.toArray(), s1.toArray()]);
      // not seen: held where it was last seen (gone from the list, and seen not ok)
      const held = K.drawn('trs001');
      K.list = [K.one(B, K.V(-1, 0.9, -1), K.Q([1, 0, 0], 10))];
      K.run();
      if (K.far(K.drawn('trs001'), held) > 1e-9) o.push('not seen: not held');
      K.list = [K.one(A, K.V(9, 9, 9), Q1, { ok: false, name: 'Cup' })];
      K.run();
      if (K.at(K.drawn('trs001')).distanceTo(K.V(9, 9, 9)) > 1) o.push('seen but not ok: not at the pose the shell keeps');
      // carried here or paused: at its placed pose; then on the tracker again
      const it = E.STU.items.get('trs001');
      it.carry = true; K.run();
      const carried = K.far(K.drawn('trs001'), K.placed('trs001'));
      it.carry = false; E.MPAUSE.on = true; K.run();
      const paused = K.far(K.drawn('trs001'), K.placed('trs001'));
      E.MPAUSE.on = false; K.run();
      if (carried > 1e-9 || paused > 1e-9 || K.far(K.drawn('trs001'), K.placed('trs001')) < 0.1) o.push('resting while carried or paused: ' + [carried, paused]);
      // Snap onto it: right on the tracker (its place and turn), one Undo step
      K.list = [K.one(A, P1, Q1, { name: 'Cup' })];
      const u1 = E.UNDO.length;
      E.itemAct('trksnap', '', 'trs001'); K.run();
      const sn = K.drawn('trs001'), sp = new THREE.Vector3(), sq = new THREE.Quaternion();
      sn.decompose(sp, sq, new THREE.Vector3());
      if (E.UNDO.length !== u1 + 1 || sp.distanceTo(P1) > 1e-3 || sq.angleTo(Q1) > 1e-3) o.push('Snap onto it: ' + [sp.distanceTo(P1), sq.angleTo(Q1), E.UNDO.length - u1]);
      E.undo(); K.run();
      if (K.at(K.drawn('trs001')).distanceTo(want1) > 0.005) o.push('Undo of Snap: not back where it stood on the tracker');
      // never seen here (another station: none held): at its placed pose
      HOST.collab.live = () => ({ id: 'sttrk2', story: 'studio' });
      K.list = []; K.run();
      if (E.TRK.last.size || K.far(K.drawn('trs001'), K.placed('trs001')) > 1e-9) o.push('never seen here: not at its placed pose');
      HOST.collab.live = () => ({ id: 'sttrk1', story: 'studio' });
      // None: it stays where the tracker had it (its record's place and turn), one Undo step
      K.list = [K.one(A, P1, Q1, { name: 'Cup' })]; K.run();
      const before = K.drawn('trs001'), u2 = E.UNDO.length;
      E.itemAct('trk', 'none', 'trs001'); K.run();
      if (E.STU.items.get('trs001').rec.trk || E.UNDO.length !== u2 + 1 || K.far(K.drawn('trs001'), before) > 2e-3 || K.far(K.placed('trs001'), K.drawn('trs001')) > 1e-9) o.push('None: ' + K.far(K.drawn('trs001'), before));
      E.undo(); K.run();
      if (!E.STU.items.get('trs001').rec.trk) o.push('Undo of None: not on the tracker again');
      // locked in place: it follows no new tracker
      E.setRec('trs001', { locked: true });
      E.itemAct('trk', B, 'trs001');
      if (E.STU.items.get('trs001').rec.trk.id !== A) o.push('locked, it took another tracker');
      E.setRec('trs001', { locked: undefined });
      // an empty and an object follow trackers too
      E.putItem('tre001', 'e', E.norm('e', { name: 'Spot', p: [0, 1, -1] }));
      K.list = [K.one(A, P1, Q1, { name: 'Cup' }), K.one(B, K.V(-1, 0.9, -1), K.Q([1, 0, 0], 10))]; K.run();
      // (the empty's tracker chosen by the headset's card: the list opened, the tracker pressed)
      E.select('tre001');
      if (!E.press('trklist') || !E.press('trkto:' + B)) o.push('the headset\'s list of trackers: not pressed');
      E.itemAct('trk', B, 'box001'); K.run();
      if (!E.STU.items.get('tre001').rec.trk || !E.STU.items.get('box001').rec.trk || K.far(K.drawn('tre001'), K.placed('tre001')) > 2e-3) o.push('an empty and an object on a tracker: ' + JSON.stringify([E.STU.items.get('tre001').rec.trk, E.STU.items.get('box001').rec.trk]));
      return o;
    });
    bad(r);
  });
  await step('studio trackers: the record\'s trk (norm\'s rules), the state and layout.json both ways, a copy and a group\'s copy follow no tracker, a GLB switch turns its offset', async () => {
    const r = await kp.evaluate(() => {
      const E = window.__E, K = window.__tk, o = [], base = { name: 'P', shape: 'cube', p: [0, 0.5, 0] };
      const N = t => { const x = E.norm('p', Object.assign({}, base, { trk: t })); return x ? JSON.stringify(x.trk) : 'bad'; };
      const cases = [
        [{ id: 'LHR-1' }, '{"id":"LHR-1","o":[0,0,0],"q":[0,0,0,1]}'], [{ id: 'LHR-1', o: [0.12345, -0, 2], q: [0, 0, 0, 2] }, '{"id":"LHR-1","o":[0.123,0,2],"q":[0,0,0,1]}'],
        [{ id: 5 }, 'bad'], [{ id: '' }, 'bad'], [{ id: 'has space' }, 'bad'], [{ id: 'LHR-1', o: [1, 2] }, 'bad'], [{ id: 'LHR-1', o: [0, 0, 2000] }, 'bad'],
        [{ id: 'LHR-1', q: [0, 0, 0, 0] }, 'bad'], ['LHR-1', 'bad'], [[], 'bad'], [{ id: 'x'.repeat(41) }, 'bad'],
      ];
      for (const [t, want] of cases) if (N(t) !== want) o.push('norm ' + JSON.stringify(t) + ': ' + N(t));
      if (E.norm('p', Object.assign({}, base, { trk: null })).trk !== undefined) o.push('trk: null kept');
      const c = E.norm('c', { name: 'C', p: [0, 1, 0], trk: { id: 'LHR-1' } }), s = E.norm('s', { name: 'S', file: 'tone.wav', p: [0, 1, 0], trk: { id: 'LHR-1' } });
      if (!c || c.trk || !s || s.trk) o.push('a cube or a sound took a trk');
      const ob = E.norm('o', { file: 'box.glb', p: [0, 0, 0], trk: { id: 'LHR-2', o: [0, 0.1, 0] } }), em = E.norm('e', { p: [0, 0, 0], trk: { id: 'LHR-3' } });
      if (!ob || !ob.trk || !em || !em.trk) o.push('an object or an empty refused its trk');
      // the state both ways: apply(state()) gives the same state; a bad trk from the room ignored (the item kept as it is)
      const st = E.collabState(), j0 = JSON.stringify(st);
      if (!st['p.trs001'] || !st['p.trs001'].trk) o.push('the state has no trk');
      E.collabApply(JSON.parse(j0));
      if (JSON.stringify(E.collabState()) !== j0) o.push('apply(state()) changed the state');
      const v = JSON.parse(j0); v['p.trs001'].trk = { id: 'bad id' };
      E.collabApply(v);
      if (JSON.stringify(E.STU.items.get('trs001').rec.trk) !== JSON.stringify(st['p.trs001'].trk)) o.push('a bad trk from the room was taken');
      E.collabApply(JSON.parse(j0));
      // layout.json both ways
      const L = E.readLayout(JSON.parse(JSON.stringify(E.layoutOut()))), lr = L.items.find(x => x.id === 'trs001');
      if (!lr || JSON.stringify(lr.rec) !== JSON.stringify(E.STU.items.get('trs001').rec) || L.bad) o.push('layout.json: ' + JSON.stringify([lr && lr.rec, L.bad]));
      // a copy follows no tracker; nor do a group's copies
      const nid = E.duplicateItem('trs001');
      if (!nid || E.STU.items.get(nid).rec.trk) o.push('a copy follows a tracker');
      E.putItem('trg001', 'g', E.norm('g', { name: 'Pair', items: ['trs001', 'tre001'] }));
      const gid = E.duplicateGroup(E.STU.items.get('trg001')), ms = gid ? E.STU.items.get(gid).rec.items.map(i => E.STU.items.get(i)) : [];
      if (ms.length !== 2 || ms.some(m => m.rec.trk)) o.push('a group\'s copies follow a tracker: ' + JSON.stringify(ms.map(m => m.rec.trk)));
      // a GLB switch (a turn r and a scale b baked in): its offset's turn takes r, so the model stays where it was on the tracker
      const rec = E.STU.items.get('box001').rec, g = { s: 0.01, q: K.Q([1, 0, 0], -90).toArray() }, sw = E.switchedRec(rec, 'models/box.glb', g);
      const T = new THREE.Matrix4().compose(K.V(1, 1, 1), K.Q([0, 1, 1], 40), K.V(1, 1, 1)), M = (t, s) => T.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3().fromArray(t.o), new THREE.Quaternion().fromArray(t.q), K.V(s, s, s)));
      const was = M(rec.trk, rec.s), now = M(sw.trk, sw.s).multiply(new THREE.Matrix4().compose(K.V(0, 0, 0), new THREE.Quaternion().fromArray(g.q), K.V(g.s, g.s, g.s)));
      if (K.far(was, now) > 1e-3) o.push('a GLB switch moved it on its tracker: ' + K.far(was, now));
      return o;
    });
    bad(r);
  });
  // the shell's own test hook, where this shell has it: a tracker fed as the relay sends it (@trk), read back through the
  // shell's stream, and a shape following it there
  await step('studio trackers: fed through the shell\'s HOST.collab.trkIn (where the shell has it), a shape following it within 5 mm', async () => {
    const r = await kp.evaluate(async () => {
      const E = window.__E, K = window.__tk, o = [];
      if (!HOST.collab.trkIn) { (window.__log = window.__log || []).push('studio trackers: this shell has no HOST.collab.trkIn: skipped'); return o; }
      HOST.collab.trackers = K.trackers;
      const P = K.V(0.2, 1.1, -1.4), Q = K.Q([0, 1, 0], 45), sleep = ms => new Promise(res => setTimeout(res, ms));
      E.putItem('trsin1', 'p', E.norm('p', { name: 'Fed', shape: 'sphere', p: [0, 0.5, 0], trk: { id: 'LHR-FED00001', o: [0, 0.1, 0] } }));
      for (let k = 0; k < 30; k++) {
        try { HOST.collab.trkIn({ at: Math.round(HOST.collab.now()), l: 'hand', t: [['LHR-FED00001', P.x, P.y, P.z, Q.x, Q.y, Q.z, Q.w, 0, 0, 0, 1, 't']] }); } catch (e) { o.push('trkIn threw: ' + e.message); break; }
        await sleep(50);
        K.run(1);
      }
      const want = K.V(0, 0.1, 0).applyQuaternion(Q).add(P), at = K.at(K.drawn('trsin1'));
      if (at.distanceTo(want) > 0.005) o.push('fed through trkIn: ' + JSON.stringify([at.toArray(), want.toArray(), E.STUDIO.trk('trsin1')]));
      HOST.collab.trackers = () => window.__tk.list.map(x => Object.assign({}, x));
      return o;
    });
    bad(r); await said(kp);
  });
  // others told why not: a rigged model that is not Mixamo's (the rig scene's dancer), and a model with no bones offers nothing
  await step('studio trackers: wearing it offered only for a Mixamo rig (the dancer refused in words, a box offers nothing)', async () => {
    const r = await kp.evaluate(async () => {
      const E = window.__E, o = [];
      HOST.collab.live = window.__tk.live; HOST.collab.trackers = window.__tk.trackers;   // (no station now: the rig scene opened as by hand)
      E.select('box001');
      if (E.paneBlocks('item').some(b => b.row && b.row.some(t => /^pwear/.test(t.id)))) o.push('the box (no bones) offers to be worn');
      E.openScene('rig', 'pick');
      for (let k = 0; k < 400 && !(E.STU.scene === 'rig' && E.STU.items.get('dan001') && E.STU.items.get('dan001').model); k++) await new Promise(res => setTimeout(res, 50));
      E.select('dan001');
      const B = E.paneBlocks('item'), row = B.find(b => b.row && b.row.some(t => t.id === 'pwear:full')), why = B.find(b => b.p && /^Not a Mixamo rig: no bone named mixamorig:Spine/.test(b.p));
      if (!row || !row.row.find(t => t.id === 'pwear:full').dis || !why) o.push('the dancer: ' + JSON.stringify([row, why, E.STUDIO.puppet('dan001')]));
      E.itemAct('pwear', 'full', 'dan001');
      if (E.STU.items.get('dan001').rec.puppet) o.push('the dancer was worn');
      return o;
    });
    bad(r);
    await kp.close();
  });
}
if (runs('studio puppet')) {
  const pages = [], open = async () => {
    const pg = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    pg.on('pageerror', e => errors.push('studio puppet: ' + (e.stack || e.message)));
    pg.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('studio puppet: ' + m.text()); });
    await pg.goto(base + 'index.html#studio&scenes=tools/studio/test/scenes&scene=puppet&edit');
    await pg.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'studio' && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    const ok = await pg.waitForFunction(() => HOST.cur.peek(`STUDIO.ready() && !!STU.items.get('pup001') && !!STU.items.get('pup001').model`), null, { timeout: 120000 }).then(() => true, () => false);
    if (!ok) return null;
    await pg.evaluate(s => HOST.cur.peek(s), STU_ENGINE);
    await pg.evaluate(s => HOST.cur.peek(s), `(pupClock = () => window.__pp.T, 0)`);   // (the take's clock: the steps')
    await pg.evaluate(PP);
    pages.push(pg);
    return pg;
  };
  const bad = list => { if (list.length) errors.push(...list.map(b => 'studio puppet: ' + b)); };
  const said = async pg => { for (const l of await pg.evaluate(() => { const l = window.__log || []; window.__log = []; return l; })) console.log(l); };
  // (in the page: the performer, a second copy of the puppet test scene's rig loaded by three.js's own GLTFLoader, its Walk
  // its truth; what it wears fixed to its bones with seeded random offsets as tools/studio/test-ik.mjs has them, the mean
  // of their offsets along the floor made zero by the hips' (whole body) or the headset's (feet), so lining up puts the
  // character right where the performer stands; their poses given as the shell's trackers (kinds 't', and 'h', 'l', 'r'
  // for the Index), or as a performer's own headset (HOST.collab.body); frames run at a held time; parts compared)
  const PP = async () => {
    const E = window.__E;
    const truth = await new Promise((res, rej) => new THREE.GLTFLoader().load('tools/studio/test/scenes/puppet/rig.glb', res, undefined, rej));
    const TR = E.IK.rigOf(truth.scene), mixer = new THREE.AnimationMixer(truth.scene), walk = mixer.clipAction(truth.animations.find(a => a.name === 'Walk'));
    let seed = 20261109;
    const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd(), V = (...a) => new THREE.Vector3(...a);
    const randQ = () => { const u = rnd(), v = rnd() * 2 * Math.PI, w = rnd() * 2 * Math.PI, a = Math.sqrt(1 - u), b = Math.sqrt(u); return new THREE.Quaternion(a * Math.sin(v), a * Math.cos(v), b * Math.sin(w), b * Math.cos(w)); };
    const tiltQ = d => new THREE.Quaternion().setFromAxisAngle(V(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize(), rr(0, d) * Math.PI / 180);
    const world = b => { const p = V(), q = new THREE.Quaternion(), s = V(); b.matrixWorld.decompose(p, q, s); return { p, q }; };
    const AT = { x: 0.6, z: -1.2 };   // (where the performer stands, facing the character's way)
    const truthAt = (t, walking) => {
      const r = truth.scene;
      r.position.set(AT.x, 0, AT.z); r.quaternion.identity(); r.scale.setScalar(1);
      if (walking) { if (!walk.isRunning()) walk.play(); mixer.setTime(t); } else { walk.stop(); TR.toRest(); }
      r.updateMatrixWorld(true);
    };
    truthAt(0, false);
    const restQ = part => world(TR.bones[part]).q;
    const wear = (part, at, turn) => ({ part, o: at.clone().applyQuaternion(restQ(part).invert()), q: restQ(part).invert().multiply(turn) });
    const eye = E.IK.restPose(TR, 'eye'), headAt = world(TR.bones.head).p;
    const W = {
      hips: wear('hips', V(rr(-0.08, 0.08), 0, rr(-0.15, -0.1)), randQ()),
      head: wear('head', V(rr(-0.04, 0.04), rr(0.1, 0.14), rr(-0.04, 0.04)), randQ()),
      lhand: wear('lhand', V(rr(-0.06, -0.03), rr(-0.02, 0.04), rr(-0.03, 0.03)), randQ()),
      rhand: wear('rhand', V(rr(0.03, 0.06), rr(-0.02, 0.04), rr(-0.03, 0.03)), randQ()),
      lfoot: wear('lfoot', V(rr(-0.02, 0.02), rr(0.03, 0.06), rr(0.02, 0.08)), randQ()),
      rfoot: wear('rfoot', V(rr(-0.02, 0.02), rr(0.03, 0.06), rr(0.02, 0.08)), randQ()),
      hmd: wear('head', eye.p.clone().sub(headAt).add(V(rr(-0.01, 0.01), 0, rr(-0.01, 0.01))), tiltQ(8)),
      lctl: wear('lhand', V(rr(0.04, 0.08), rr(-0.03, 0), rr(0.02, 0.06)), randQ()),
      rctl: wear('rhand', V(rr(-0.08, -0.04), rr(-0.03, 0), rr(0.02, 0.06)), randQ()),
    };
    const ID = { hips: 'LHR-HIPS0001', head: 'LHR-HEAD0002', lhand: 'LHR-LHND0003', rhand: 'LHR-RHND0004', lfoot: 'LHR-LFOT0005', rfoot: 'LHR-RFOT0006', hmd: 'LHR-INDX0007', lctl: 'LHR-INDL0008', rctl: 'LHR-INDR0009' };
    const KIND = { hmd: 'h', lctl: 'l', rctl: 'r' };
    const poseOf = k => { const w = W[k], b = world(TR.bones[w.part]); return { p: w.o.clone().applyQuaternion(b.q).add(b.p), q: b.q.clone().multiply(w.q) }; };
    // (the mean of the worn offsets along the floor, at rest, against the bones the lining up lines them up with, made zero
    // by moving one of them: the hips' for the whole body, the headset's for the feet)
    const zero = (names, fix, bone) => {
      truthAt(0, false);
      const m = V();
      for (const k of names) { const t = poseOf(k).p, b = k === 'hmd' ? eye.p : world(TR.bones[W[k].part]).p; m.x += t.x - b.x; m.z += t.z - b.z; }
      m.multiplyScalar(1 / names.length);
      const bq = world(TR.bones[W[fix].part]).q;
      W[fix].o.sub(V(m.x * names.length, 0, m.z * names.length).applyQuaternion(bq.clone().invert()));
    };
    zero(['hips', 'head', 'lhand', 'rhand', 'lfoot', 'rfoot'], 'hips');
    zero(['hmd', 'lctl', 'rctl', 'lfoot', 'rfoot'], 'hmd');
    window.__pp = {
      T: 0, names: [], truth, TR, ID, KIND, world, V,
      // the trackers now (or for a performer's own headset, HOST.collab.body), from the truth at time t
      set: (t, walking) => {
        const P = window.__pp;
        truthAt(t, walking); P.T = t;
        P.list = P.names.filter(k => !P.body || !KIND[k]).map(k => { const x = poseOf(k); return { id: ID[k], name: '', k: KIND[k] || 't', p: x.p.toArray(), q: x.q.toArray(), ok: true }; });
        if (P.body) { const g = k => { const x = poseOf(k); return { p: x.p.toArray(), q: x.q.toArray() }; }; P.bodyNow = { head: g('hmd'), l: g('lctl'), r: g('rctl') }; }
      },
      frame: (t, walking, dt) => { const P = window.__pp; P.set(t, walking); E.GL.world.updateMatrixWorld(true); E.behaveStep(dt === undefined ? 1 / 30 : dt, performance.now()); E.itemsStep(dt === undefined ? 1 / 30 : dt, performance.now()); },
      // the character's and the truth's parts in the scene's frame (the truth stands in the scene's frame as its own world)
      err: parts => { const it = E.STU.items.get('pup001'), R = E.pupRig(it); E.GL.items.updateMatrixWorld(true); return Math.max(...parts.map(p => E.GL.items.worldToLocal(world(R.bones[p]).p).distanceTo(world(TR.bones[p]).p))); },
      bones: () => { const R = E.pupRig(E.STU.items.get('pup001')); return R.parts.map(p => R.bones[p].quaternion.toArray().concat(world(R.bones[p]).p.toArray())); },
    };
    window.__pp.list = [];
    HOST.collab.live = () => ({ id: 'stpup1', story: 'studio' });
    HOST.collab.trackers = () => (window.__pp.list || []).map(x => Object.assign({}, x));
    HOST.collab.body = id => (id === 'perf01' && window.__pp.bodyNow) || null;
    return 0;
  };
  const SIX = ['hips', 'head', 'lhand', 'rhand', 'lfoot', 'rfoot'], FEET = ['lfoot', 'rfoot', 'hmd', 'lctl', 'rctl'];
  const A = await open();
  if (!A) bad(['the puppet test scene did not load']);
  else {
    await step('studio puppet: worn with 6 trackers (the whole body), lined up from a T-pose after its countdown (the parts found, the character moved to where the performer stands, sized to them, one Undo step); its hands and feet within 5 mm of the truth over 3.3 s of its walk, its own clip off; Pause holds it, Off gives its clip back', async () => {
      const r = await A.evaluate(() => {
        const E = window.__E, P = window.__pp, o = [], it = E.STU.items.get('pup001');
        P.names = ['hips', 'head', 'lhand', 'rhand', 'lfoot', 'rfoot'];
        P.frame(0, false);
        if (E.STUDIO.puppet('pup001').rig !== 'ok') o.push('the rig: ' + E.STUDIO.puppet('pup001').rig);
        E.select('pup001');
        let B = E.paneBlocks('item');
        if (!B.some(b => b.row && b.row.some(t => t.id === 'pwear:full' && !t.dis)) || !B.some(b => b.row && b.row.some(t => t.id === 'pwear:feet'))) o.push('the card offers no Wear it: ' + JSON.stringify(B.filter(b => b.row).map(b => b.row.map(t => t.id))));
        const u0 = E.UNDO.length;
        E.itemAct('pwear', 'full', 'pup001');
        if (JSON.stringify(it.rec.puppet) !== '{"on":false,"rig":"full"}' || E.UNDO.length !== u0 + 1) o.push('Wear it: ' + JSON.stringify(it.rec.puppet));
        // the headset's card: Line up pressed there starts the countdown, Cancel stops it
        E.select('pup001');
        if (!E.press('pupline') || !E.PUP.line || !E.press('pupcancel') || E.PUP.line) o.push('the headset\'s Line up and Cancel: ' + JSON.stringify(E.PUP.line));
        // the countdown, then the lining up
        E.itemAct('pupline', '', 'pup001');
        B = E.paneBlocks('item');
        const cd = B.find(b => b.p && /T-pose .*lining up in [45] s/.test(b.p));
        if (!E.PUP.line || !cd) o.push('the countdown: ' + JSON.stringify([E.PUP.line, B.filter(b => b.p).map(b => b.p)]));
        const p0 = it.rec.p.slice(), u1 = E.UNDO.length;
        E.PUP.line.at = 0;
        P.frame(0, false);
        const pr = it.rec.puppet;
        if (E.PUP.line || !pr || !pr.on || E.UNDO.length !== u1 + 1) o.push('lined up: ' + JSON.stringify([E.STUDIO.puppet('pup001'), E.UNDO.length - u1]));
        else {
          const want = { hips: P.ID.hips, head: P.ID.head, lhand: P.ID.lhand, rhand: P.ID.rhand, lfoot: P.ID.lfoot, rfoot: P.ID.rfoot };
          if (JSON.stringify(pr.map) !== JSON.stringify(Object.fromEntries(Object.keys(pr.map).map(k => [k, want[k]]))) || Object.keys(pr.map).length !== 6 || Object.keys(pr.cal).length !== 6) o.push('the parts found: ' + JSON.stringify(pr.map));
          if (Math.hypot(it.rec.p[0] - 0.6, it.rec.p[2] + 1.2) > 0.003 || it.rec.p[1] !== p0[1] || Math.abs(it.rec.s - 1) > 1e-3 || pr.s !== it.rec.s) o.push('moved to the performer and sized: ' + JSON.stringify([it.rec.p, it.rec.s, pr.s]));
          if (!E.paneBlocks('item').some(b => b.list && b.list.some(t => t.id === 'pslot:lhand'))) o.push('the card lists no parts');
        }
        // Undo takes the lining up back (its place too); lined up again
        E.undo();
        if (it.rec.puppet.on || it.rec.puppet.cal || JSON.stringify(it.rec.p) !== JSON.stringify(p0)) o.push('Undo of the lining up: ' + JSON.stringify([it.rec.p, it.rec.puppet]));
        E.itemAct('pupline', '', 'pup001'); E.PUP.line.at = 0; P.frame(0, false);
        // its walk: the hands and feet within 5 mm of the truth, its clip off
        let worst = 0, n = 0;
        for (let k = 0; k <= 99; k++) { P.frame(k / 30, true); worst = Math.max(worst, P.err(['lhand', 'rhand', 'lfoot', 'rfoot'])); n++; }
        const st = E.STUDIO.puppet('pup001');
        (window.__log = window.__log || []).push(`studio puppet: whole body, ${n} frames: hands and feet within ${(worst * 1000).toFixed(2)} mm of the truth (hips ${(P.err(['hips']) * 1000).toFixed(2)} mm at the last)`);
        if (worst > 0.005 || !st.on || st.clip || st.why) o.push('walking: ' + JSON.stringify([worst, st]));
        // Pause holds the pose it shows; played again, it follows
        const held = P.bones();
        E.MPAUSE.on = true; P.frame(1.7, true);
        if (JSON.stringify(P.bones()) !== JSON.stringify(held)) o.push('paused, it moved');
        E.MPAUSE.on = false; P.frame(1.7, true);
        if (P.err(['lhand', 'rfoot']) > 0.005) o.push('played again, it does not follow');
        // Off (pressed on the headset's card): its own clip again; On again
        E.select('pup001');
        if (!E.press('pupon:off')) o.push('no Off on the headset\'s card');
        P.frame(1.7, true);
        if (!E.STUDIO.puppet('pup001').clip || E.STUDIO.puppet('pup001').on) o.push('Off: its clip not back: ' + JSON.stringify(E.STUDIO.puppet('pup001')));
        E.itemAct('pupon', 'on', 'pup001'); P.frame(1.7, true);
        if (P.err(['lhand', 'rfoot']) > 0.005) o.push('On again, it does not follow');
        return o;
      });
      bad(r); await said(A);
    });
    await step('studio puppet: a sound follows its head bone as it is worn; the record\'s puppet (norm\'s rules), the state and layout.json both ways, a copy worn by nobody; locked in place it is not lined up', async () => {
      const r = await A.evaluate(() => {
        const E = window.__E, P = window.__pp, o = [], it = E.STU.items.get('pup001');
        E.putItem('pvoice', 's', E.norm('s', { name: 'Voice', file: 'voice.wav', p: [0, 1.7, -2], on: 'pup001', bone: 'mixamorigHead', o: [0, 0.1, 0] }));
        P.frame(0.5, true);
        const f0 = E.STUDIO.follow('pvoice');
        P.frame(1.5, true);
        const f1 = E.STUDIO.follow('pvoice'), head = P.world(P.TR.bones.head).p;
        if (!f1 || f1.node !== 'mixamorigHead' || f1.d > 1e-3 || new THREE.Vector3().fromArray(f1.want).distanceTo(head) > 0.12 || new THREE.Vector3().fromArray(f0.want).distanceTo(new THREE.Vector3().fromArray(f1.want)) < 0.005) o.push('a sound on its head: ' + JSON.stringify([f0, f1, head.toArray()]));
        E.itemAct('del', '', 'pvoice');
        // norm's rules
        const N = x => { const r = E.norm('o', { file: 'rig.glb', p: [0, 0, 0], puppet: x }); return r ? JSON.stringify(r.puppet) : 'bad'; };
        const cal7 = [0.123456, 0, 0, 0, 0, 0, 1];
        const cases = [
          [{}, '{"on":false,"rig":"full"}'], [{ on: true, rig: 'feet', by: 'index' }, '{"on":true,"rig":"feet","by":"index"}'], [{ by: '' }, '{"on":false,"rig":"full"}'],
          [{ map: { head: 'LHR-1', lhand: '@l', nose: 'LHR-2' }, cal: { head: cal7, lfoot: cal7 }, s: 1.23456, floor: -0.00001 }, '{"on":false,"rig":"full","map":{"head":"LHR-1","lhand":"@l"},"cal":{"head":[0.1235,0,0,0,0,0,1]},"s":1.235,"floor":0}'],
          [{ on: 1 }, 'bad'], [{ rig: 'head' }, 'bad'], [{ by: 'a b' }, 'bad'], [{ map: { head: 'x y' } }, 'bad'], [{ map: { head: '@nose' } }, 'bad'], [{ map: [] }, 'bad'],
          [{ map: { head: 'LHR-1' }, cal: { head: [0, 0, 0, 0, 0, 0, 0] } }, 'bad'], [{ map: { head: 'LHR-1' }, cal: { head: [1, 2, 3] } }, 'bad'], [{ s: 0 }, 'bad'], [{ floor: 'x' }, 'bad'], ['full', 'bad'],
        ];
        for (const [x, want] of cases) if (N(x) !== want) o.push('norm ' + JSON.stringify(x) + ': ' + N(x));
        if (E.norm('p', { shape: 'cube', p: [0, 0, 0], puppet: {} }).puppet !== undefined) o.push('a shape took a puppet');
        // the state and layout.json both ways
        const j0 = JSON.stringify(E.collabState());
        E.collabApply(JSON.parse(j0));
        if (JSON.stringify(E.collabState()) !== j0 || !JSON.parse(j0)['o.pup001'].puppet.cal) o.push('apply(state()) changed the state, or it has no puppet');
        const L = E.readLayout(JSON.parse(JSON.stringify(E.layoutOut()))), lr = L.items.find(x => x.id === 'pup001');
        if (!lr || JSON.stringify(lr.rec) !== JSON.stringify(it.rec)) o.push('layout.json lost its puppet');
        // a copy is worn by nobody (and follows no tracker)
        const nid = E.duplicateItem('pup001');
        if (!nid || E.STU.items.get(nid).rec.puppet) o.push('a copy is worn');
        E.select('pup001');
        // locked in place: not lined up
        E.setRec('pup001', { locked: true });
        E.itemAct('pupline', '', 'pup001');
        if (E.PUP.line) o.push('locked, it counted down to line up');
        E.setRec('pup001', { locked: undefined });
        if (nid) E.itemAct('del', '', nid);
        return o;
      });
      bad(r);
    });
    // (a second page, the same scene and stubs: the first page's record taken as from the room, both at one held moment)
    const Bp = await open();
    await step('studio puppet: two pages solve the same bones from the same trackers at one held moment (every bone within 1 degree and 1 mm)', async () => {
      if (!Bp) { bad(['the second page did not load']); return; }
      const rec = await A.evaluate(() => window.__E.STU.items.get('pup001').rec);
      await Bp.evaluate(rec => { const E = window.__E; window.__pp.names = ['hips', 'head', 'lhand', 'rhand', 'lfoot', 'rfoot']; E.putItem('pup001', 'o', E.norm('o', rec)); return 0; }, rec);
      const t = 2.345, get = pg => pg.evaluate(t => { window.__pp.frame(t, true); window.__pp.frame(t, true); return window.__pp.bones(); }, t);
      const a = await get(A), b = await get(Bp);
      let deg = 0, mm = 0;
      a.forEach((x, i) => {
        const y = b[i], d = Math.abs(x[0] * y[0] + x[1] * y[1] + x[2] * y[2] + x[3] * y[3]) / (Math.hypot(x[0], x[1], x[2], x[3]) * Math.hypot(y[0], y[1], y[2], y[3]));   // (as turns: a quaternion a hair off length 1 is the same turn)
        deg = Math.max(deg, 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI); mm = Math.max(mm, Math.hypot(x[4] - y[4], x[5] - y[5], x[6] - y[6]) * 1000);
      });
      console.log(`studio puppet: two pages, ${a.length} bones at ${t} s: within ${deg.toFixed(4)} degrees and ${mm.toFixed(4)} mm`);
      if (a.length !== b.length || a.length < 20 || deg > 1 || mm > 1) bad(['two pages: ' + JSON.stringify({ n: [a.length, b.length], deg, mm })]);
      await Bp.close();
    });
    await step('studio puppet: a 3 s take (its countdown, 30 keys a second, Stop) made into the GLB with its Walk and Take 1 (downloaded: no relay here), and Take 1 plays the solved pose', async () => {
      const r = await A.evaluate(async () => {
        const E = window.__E, P = window.__pp, o = [], it = E.STU.items.get('pup001');
        P.frame(0, true);
        E.select('pup001');
        if (!E.paneBlocks('item').some(b => b.row && b.row.some(t => t.id === 'take' && !t.dis))) o.push('no Record a take on its card');
        E.itemAct('take', '', 'pup001');
        if (!E.PUP.take || E.PUP.take.phase !== 'count') { o.push('the take\'s countdown: ' + JSON.stringify(E.STUDIO.puppet('pup001'))); return o; }
        E.PUP.take.at = 0;
        P.frame(0, true);   // (the countdown done: it records from here, on the steps' clock)
        const keep = [];
        for (let k = 0; k <= 90; k++) { P.frame(k / 30, true); if (k === 45) keep.push(P.bones()); }
        const n = E.PUP.take.samples.length;
        E.itemAct('takestop', '', 'pup001');
        for (let k = 0; k < 600 && E.PUP.take; k++) await new Promise(res => setTimeout(res, 100));
        const L = E.STUDIO.lastGLB, st = E.STUDIO.puppet('pup001');
        if (n !== 91 || E.PUP.take || !L || !L.ok || !/Take 1/.test(st.note)) { o.push('the take: ' + JSON.stringify({ n, st, ok: L && L.ok, why: L && L.why, cv: E.CV.note })); return o; }
        // the GLB read back: its clips, Take 1 played at 1.5 s against the bones solved then
        const g = await new Promise((res, rej) => new THREE.GLTFLoader().parse(L.glb.slice(0), '', res, rej));
        const names = g.animations.map(a => a.name).sort().join(), take = g.animations.find(a => a.name === 'Take 1'), R = E.IK.rigOf(g.scene);
        if (names !== 'Take 1,Walk' || !take || Math.abs(take.duration - 3) > 1e-3 || take.tracks.length !== R.parts.length + 1) o.push('its clips: ' + JSON.stringify([names, take && take.duration, take && take.tracks.length, R.parts && R.parts.length]));
        else {
          const m = new THREE.AnimationMixer(g.scene), a = m.clipAction(take);
          a.play(); m.setTime(1.5); g.scene.updateMatrixWorld(true);
          const want = keep[0], rig = E.pupRig(it);
          let worst = 0, moved = 0;
          R.parts.forEach(p => {
            const k = rig.parts.indexOf(p), q = R.bones[p].quaternion, w = want[k];
            worst = Math.max(worst, 2 * Math.acos(Math.min(1, Math.abs(q.x * w[0] + q.y * w[1] + q.z * w[2] + q.w * w[3]) / (q.length() * Math.hypot(w[0], w[1], w[2], w[3])))) * 180 / Math.PI);
            moved = Math.max(moved, 2 * Math.acos(Math.min(1, Math.abs(q.dot(R.rest[p].q)) / (q.length() * R.rest[p].q.length()))) * 180 / Math.PI);
          });
          (window.__log = window.__log || []).push(`studio puppet: a take of ${n} keys, ${take.duration.toFixed(2)} s: Take 1 at 1.5 s within ${worst.toFixed(4)} degrees of the bones solved then (its bones up to ${moved.toFixed(1)} degrees from rest)`);
          if (worst > 0.1 || moved < 5) o.push('Take 1 played: ' + [worst, moved]);
        }
        return o;
      });
      bad(r); await said(A);
    });
    await step('studio puppet: worn with a tracker on each foot and the PC\'s Index (its headset and controllers), lined up, the feet within 5 mm and the hands within 1 cm over its walk; then the head and hands from a performer\'s own headset (HOST.collab.body)', async () => {
      const r = await A.evaluate(() => {
        const E = window.__E, P = window.__pp, o = [], it = E.STU.items.get('pup001');
        P.names = ['lfoot', 'rfoot', 'hmd', 'lctl', 'rctl']; P.body = false;
        P.frame(0, false);
        E.itemAct('pwear', 'feet', 'pup001');
        if (JSON.stringify(it.rec.puppet) !== '{"on":false,"rig":"feet","by":"index"}') o.push('Wear it, feet: ' + JSON.stringify(it.rec.puppet));
        E.itemAct('pupline', '', 'pup001'); E.PUP.line.at = 0; P.frame(0, false);
        const pr = it.rec.puppet;
        if (!pr.on || pr.map.head !== P.ID.hmd || pr.map.lhand !== P.ID.lctl || pr.map.rhand !== P.ID.rctl || pr.map.lfoot !== P.ID.lfoot || pr.map.rfoot !== P.ID.rfoot || Math.abs(it.rec.s - 1) > 2e-3) o.push('lined up, feet: ' + JSON.stringify([pr, it.rec.s, E.PUP.note]));
        const run = what => {
          let feet = 0, hands = 0;
          for (let k = 0; k <= 60; k++) { P.frame(k / 30, true); feet = Math.max(feet, P.err(['lfoot', 'rfoot'])); hands = Math.max(hands, P.err(['lhand', 'rhand'])); }
          (window.__log = window.__log || []).push(`studio puppet: feet and ${what}: the feet within ${(feet * 1000).toFixed(2)} mm, the hands ${(hands * 1000).toFixed(2)} mm`);
          if (feet > 0.005 || hands > 0.01 || E.STUDIO.puppet('pup001').why) o.push(what + ': ' + JSON.stringify([feet, hands, E.STUDIO.puppet('pup001').why]));
        };
        run('the Index');
        // a performer's own headset: the head and hands from HOST.collab.body (their presence)
        E.itemAct('pupby', 'perf01', 'pup001');
        if (it.rec.puppet.by !== 'perf01' || it.rec.puppet.on || it.rec.puppet.cal) o.push('Head and hands from another headset: ' + JSON.stringify(it.rec.puppet));
        P.body = true; P.frame(0, false);
        E.itemAct('pupline', '', 'pup001'); E.PUP.line.at = 0; P.frame(0, false);
        const pm = it.rec.puppet;
        if (!pm.on || pm.map.head !== '@head' || pm.map.lhand !== '@l' || pm.map.rhand !== '@r') o.push('lined up from a headset: ' + JSON.stringify([pm, E.PUP.note]));
        run('a performer\'s own headset');
        // a part given another tracker (swapped with the part that had it): not lined up until it is again
        E.itemAct('pupset', 'lfoot:' + P.ID.rfoot, 'pup001');
        const ps = it.rec.puppet;
        if (ps.map.lfoot !== P.ID.rfoot || ps.map.rfoot !== P.ID.lfoot || ps.on || ps.cal) o.push('a part swapped: ' + JSON.stringify(ps));
        P.body = false;
        return o;
      });
      bad(r); await said(A);
    });
  }
  for (const pg of pages) await pg.close().catch(() => {});
}
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
for (const key of STORY_KEYS) await step(`${key}: anchored placement`, async () => {
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
// The headset's settings (the shell's menu, for every story; in a shared room the room's), two of them independent of
// each other: the scenes' small labels on top (sprites over everything; the default), in 3D (upright signs in the
// scene, depth-tested, turned to you) or hidden; the cards (the story panels here) in 3D (in the scene as the labels'
// signs are; the default), on top (over everything, as before) or hidden (no story panel at all, in story and explore
// mode; A or X does nothing since v125, the menu's Story tab plays); and free moving (the grip holds the scene and the
// panel like a real object, what you hold staying in your hand). Kept across a reload (a device's old labels choice, under the old key, left behind), set by a
// link. In a page of its own (its own storage, as a new device), with a pretend headset whose frames the test drives: a
// scene story (qubits), a life-size one (flock) and a hand-written one (airports)
if (!ONLY) {
  const sp = await browser.newPage({ viewport: { width: 640, height: 400 } });
  sp.on('pageerror', e => errors.push('settings: ' + (e.stack || e.message)));
  sp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('settings: ' + m.text()); });
  const sx = s => sp.evaluate(s => HOST.cur.peek(s), s);
  const tick = n => sp.evaluate(n => window.__tick(n), n || 1);
  const qa = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]))) * 180 / Math.PI;   // degrees between two turns
  const setLook = (l, f, c) => sp.evaluate(([l, f, c]) => { if (l) HOST.xr.setLabels(l); if (c) HOST.xr.setCards(c); if (f !== undefined && f !== null) HOST.xr.setFree(f); }, [l, f, c]);
  const setCards = c => setLook(null, null, c);
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
      face: Math.max(0, ...sg.map(face)), main: XR.main.mesh.visible, foot: XR.foot.mesh.visible, panels: [XR.main, XR.foot].map(look), land: XR.land.map(look) };
  })()`;
  const labels = () => sx(LABELS);
  // the story panels (text, foot) in each cards mode: on top as before (drawn over everything), in 3D in the scene as
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
  // A or X (xr-standard button 4) pressed and let go on a controller: nothing since v125 (the owner, 8 November 2026:
  // "Dont use a and x on controllers for play pause in stories"); gives whether the story plays afterwards
  const aOrX = async () => {
    const btn = on => sx(`(() => { const c = XR.ctrls[0]; c.src = { targetRayMode: 'tracked-pointer', gamepad: { axes: [0, 0, 0, 0], buttons: [0, 1, 2, 3, 4].map(i => ({ pressed: i === 4 && ${on}, touched: false, value: 0 })) } }; c.g.visible = true; return 0; })()`);
    await btn(true); await tick(1); await btn(false); await tick(1);
    const now = await sx('APP.playing');
    await sx('(XR.ctrls[0].src = null, XR.ctrls[0].g.visible = false, XR.ctrls[0].hover = null, 0)'); await tick(1);
    return now;
  };
  // play and pause through the menu's Story tab: its copy of the story's foot panel, the play button there pointed at by
  // a controller's ray and pressed (the story's own button, through the copy); gives [pointed at it, playing after]
  const tabPlay = async () => {
    await sp.evaluate(() => { HOST.collab.panelOpen(true); HOST.collab.menuTab('story'); });
    await tick(3);
    const aim = `(() => { const O = HOST.collab.overlay(), F = XR.foot, r = F.regions.find(x => x.id === 'play' && x.fn);
      if (!r || !O.mirror.foot.visible) return 'no ' + (!r ? 'play button on the foot bar (' + F.regions.map(x => x.id).join(' ') + ')' : 'copy of the foot bar shown (menu ' + HOST.collab.menu + ', tab ' + HOST.collab.menuTab() + ')');
      GL.scene.updateMatrixWorld(true);
      const at = O.mirror.foot.localToWorld(new THREE.Vector3((r.x + r.w / 2) / F.w - 0.5, 0.5 - (r.y + r.h / 2) / F.h, 0)), n = new THREE.Vector3(0, 0, 1).applyQuaternion(O.mirror.foot.getWorldQuaternion(new THREE.Quaternion()));
      const c = XR.ctrls[0]; c.src = { targetRayMode: 'tracked-pointer', gamepad: null }; c.g.visible = true;
      c.g.matrix.compose(at.clone().addScaledVector(n, 0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), n.clone().negate()), new THREE.Vector3(1, 1, 1));
      c.g.matrixWorld.copy(c.g.matrix); return true; })()`;
    let ok = await sx(aim);
    await tick(2); if (ok === true) ok = await sx(aim); await tick(1);   // (aimed again where the menu has settled)
    const hov = await sx(`(h => !!h && h.kind === 'panel' && h.P === XR.foot && !!h.menu && (XR.foot.at(h.x, h.y) || {}).id === 'play' ? true :
      'the ray on ' + (h ? h.kind + (h.P === XR.foot ? ' foot' : h.P === XR.main ? ' main' : '') + (h.menu ? ' (the menu\\'s copy)' : '') : 'nothing'))(XR.ctrls[0].hover)`);
    await sx('(XR.ctrls[0].wantPress = true, 0)'); await tick(1);
    await sx(`(XR.ctrls[0].g.dispatchEvent({ type: 'selectend' }), 0)`); await tick(1);
    const now = await sx('APP.playing');
    await sx('(XR.ctrls[0].src = null, XR.ctrls[0].g.visible = false, XR.ctrls[0].hover = null, 0)');
    await sp.evaluate(() => HOST.collab.panelOpen(false)); await tick(1);
    return [ok === true ? hov : ok, now];
  };
  // the controller i at p (in the room; the rig stands at the head, facing -z), turned yaw and pitched, in degrees
  const ctrl = (i, p, yaw, pitch) => sx(`(() => { const c = XR.ctrls[${i}]; c.src = { targetRayMode: 'tracked-pointer', gamepad: null }; c.g.visible = true;
    c.g.matrix.compose(new THREE.Vector3(${p.join(',')}), new THREE.Quaternion().setFromEuler(new THREE.Euler(${(pitch || 0) * Math.PI / 180}, ${(yaw || 0) * Math.PI / 180}, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
    c.g.matrixWorld.copy(c.g.matrix); })()`);
  const grab = (i, kind, on) => sx(`(c => { c.hover = ${kind === 'panel' ? '{ kind: "panel", P: XR.main }' : `{ kind: "${kind}", i: -1 }`}; xrGrab(c, ${on}); return !!c.grab; })(XR.ctrls[${i}])`);
  const POSE = `(() => { GL.scene.updateMatrixWorld(true); return { wq: GL.world.getWorldQuaternion(new THREE.Quaternion()).toArray(), rot: XR.rot.toArray(),
    pq: XR.panelGroup.quaternion.toArray(), up: new THREE.Vector3(0, 1, 0).applyQuaternion(XR.panelGroup.quaternion).y }; })()`;

  // each mode of each setting, at the moment with the most labels (the flock: explore mode with a falcon): the labels
  // follow Labels only, the story panels Cards only
  const labelModes = async key => {
    const bad = [];
    if (key === 'flock') {   // (the falcon's label shows once it is on its way)
      await setLook('face', null, 'fixed'); await sx('(APP.enterExplore(), sendFalcon([0.2, 0.1, -1]), 0)');
      for (let k = 0; k < 100 && !(await labels()).sprites; k++) await tick(1);
    }
    else {
      await setLook('face', null, 'fixed'); await tick(1);
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
    // the defaults: labels on top, the story panels in 3D
    await setLook('face', null, 'fixed'); await tick(3);
    const F = await labels();
    if (!(F.sprites > 0 && !F.signs && F.onTop)) bad.push(`labels on top: ${F.sprites} sprites (over everything: ${F.onTop}), ${F.signs} signs`);
    if (!F.panels.every(PANEL.fixed)) bad.push(`labels on top, cards in 3D (${where}): the story panels are not in the scene: ${JSON.stringify(F.panels)}`);
    // cards hidden, labels on top: the labels stay; neither panel drawn or pointable; A or X does nothing (v125), the
    // menu's Story tab plays
    await setCards('hidden'); await tick(3);
    const CH = await labels(), hitCH = await pointBoth();
    if (!(CH.sprites === F.sprites && CH.onTop && !CH.signs)) bad.push(`cards hidden: the labels went (${CH.sprites} sprites for ${F.sprites}, ${CH.signs} signs)`);
    if (CH.main || CH.foot || hitCH.some(h => h.startsWith('panel'))) bad.push(`cards hidden (${where}): text panel shown ${CH.main}, foot ${CH.foot}, a ray at each hovers ${hitCH}`);
    if (!landOnTop(CH)) bad.push('cards hidden: the Stories screen\'s panels are not on top: ' + JSON.stringify(CH.land));
    if (story) {
      const was = await sx('APP.playing'), ax = await aOrX(), [tab, now] = await tabPlay();
      await sx('(APP.playing = false, 0)'); await tick(1);
      if (!(was === false && ax === false)) bad.push(`cards hidden: A or X played or paused the story (${was} -> ${ax})`);
      if (!(tab === true && now === true)) bad.push(`cards hidden: the menu's Story tab did not play it (its play button pointed at through the copy: ${tab}, playing ${now})`);
    }
    // cards on top, labels on top: the panels over everything as before
    await setCards('face'); await tick(3);
    const CF = await labels(), hitCF = await pointBoth();
    if (!CF.panels.every(PANEL.face) || !landOnTop(CF)) bad.push(`cards on top (${where}): the story panels are not drawn over everything as before: ${JSON.stringify(CF.panels)}`);
    if (hitCF.join() !== 'panel:main,panel:foot') bad.push(`cards on top (${where}): a ray at each story panel's middle hovers ${hitCF}`);
    // labels in 3D, cards still on top: signs for the labels, the panels as they were
    await setLook('fixed'); await tick(3);
    const D0 = await labels();
    if (!(D0.signs === CF.sprites && !D0.sprites && D0.inDepth && D0.up > 1 - 1e-6 && D0.face < 1)) bad.push(`labels in 3D: ${D0.signs} signs for ${CF.sprites} labels, ${D0.sprites} sprites, depth-tested ${D0.inDepth}, upright ${D0.up}, turned to you within ${D0.face} deg`);
    if (!D0.panels.every(PANEL.face)) bad.push(`labels in 3D, cards on top (${where}): the story panels changed with the labels: ${JSON.stringify(D0.panels)}`);
    // cards in 3D too
    await setCards('fixed'); await tick(3);
    const D1 = await labels();
    if (!(D1.signs === D0.signs && D1.inDepth)) bad.push(`cards in 3D: the labels' signs changed with the cards (${D0.signs} -> ${D1.signs})`);
    if (!D1.panels.every(PANEL.fixed)) bad.push(`cards in 3D (${where}): the story panels are not in the scene: ${JSON.stringify(D1.panels)}`);
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
    if (hitD.join() !== 'panel:main,panel:foot') bad.push(`cards in 3D (${where}): a ray at each story panel's middle hovers ${hitD}`);
    // labels hidden, cards in 3D: no labels; both panels drawn and pointable
    await setLook('hidden'); await tick(3);
    const H = await labels(), hitH = await pointBoth();
    if (H.sprites || H.signs) bad.push(`labels hidden (${where}): ${H.sprites + H.signs} labels`);
    if (!H.panels.every(PANEL.fixed) || hitH.join() !== 'panel:main,panel:foot') bad.push(`labels hidden (${where}): the story panels went with them (${JSON.stringify(H.panels)}, a ray at each hovers ${hitH})`);
    // in explore mode: cards hidden there too (no panel, nothing to point at), and back again in 3D and on top
    if (story) { await sx('APP.enterExplore()'); await tick(3); }
    await setLook('face', null, 'hidden'); await tick(3);
    const HX = await labels(), hitX = await pointBoth();
    if (HX.main || HX.foot || hitX.some(h => h.startsWith('panel'))) bad.push(`cards hidden in explore mode: its panels ${HX.main} ${HX.foot}, a ray at a hidden panel hovers ${hitX}`);
    await setCards('fixed'); await tick(3);
    const B1 = await labels();
    if (!B1.panels.every(PANEL.fixed)) bad.push(`cards in 3D again (explore): the story panels are not back in the scene: ${JSON.stringify(B1.panels)}`);
    await setCards('face'); await tick(3);
    const B2 = await labels(), hitB = await pointBoth();
    if (!B2.panels.every(PANEL.face) || !landOnTop(B2)) bad.push(`cards on top again (explore): the story panels are not drawn over everything: ${JSON.stringify(B2.panels)}`);
    if (hitB.join() !== 'panel:main,panel:foot') bad.push(`cards on top again (explore): a ray at each story panel's middle hovers ${hitB}`);
    await setCards('fixed');
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

  // a new device (also one that chose its labels under the old key): labels on top and cards in 3D; the menu's buttons
  // go round (Labels: in 3D, hidden, on top; Cards: on top, hidden, in 3D; Moving: free, facing you), the story
  // following, and the choice is kept across a reload; a link sets them
  await step('headset settings: labels on top and cards in 3D by default; the menu\'s buttons go round, kept across a reload, set by a link', async () => {
    const bad = [];
    await openXR('qubits');
    await sp.evaluate(() => localStorage.setItem('xrLabels', 'hidden'));   // (an older version's choice: left behind)
    await openXR('qubits');
    const d0 = await sp.evaluate(() => [HOST.xr.labels(), HOST.xr.cards(), HOST.xr.free(), HOST.cur.peek('XR.lm'), HOST.cur.peek('XR.cm'), HOST.cur.peek('XR.free'), localStorage.getItem('xrLabels2'), localStorage.getItem('xrCards')]);
    if (d0.join() !== 'face,fixed,true,face,fixed,true,,') bad.push('the defaults are not labels on top, cards in 3D and free moving: ' + JSON.stringify(d0));
    await sp.evaluate(() => HOST.collab.panelOpen(true)); await tick(2);
    const press = async id => { await tick(2); const ok = await sp.evaluate(id => { const r = HOST.collab.menuFind(id); if (r && r.fn) r.fn(); return !!(r && r.fn); }, id); await tick(2); return ok; };
    const seen = [], seenC = [];
    for (let k = 0; k < 3; k++) { if (!await press('labels')) { bad.push('no Labels button in the menu'); break; } seen.push(await sp.evaluate(() => HOST.xr.labels() + '/' + HOST.cur.peek('XR.lm') + '/' + HOST.xr.cards())); }
    if (seen.join() !== 'fixed/fixed/fixed,hidden/hidden/fixed,face/face/fixed') bad.push('Labels went ' + seen.join(', ') + ' (not in 3D, hidden, on top, with the story following and the cards staying)');
    for (let k = 0; k < 3; k++) { if (!await press('cards')) { bad.push('no Cards button in the menu'); break; } seenC.push(await sp.evaluate(() => HOST.xr.cards() + '/' + HOST.cur.peek('XR.cm') + '/' + HOST.xr.labels())); }
    if (seenC.join() !== 'face/face/face,hidden/hidden/face,fixed/fixed/face') bad.push('Cards went ' + seenC.join(', ') + ' (not on top, hidden, in 3D, with the story following and the labels staying)');
    if (!await press('free') || await sp.evaluate(() => HOST.xr.free() || HOST.cur.peek('XR.free'))) bad.push('Moving did not turn free moving off');
    await press('labels'); await press('labels'); await press('cards');   // (labels hidden, cards on top)
    await sp.reload(); await sp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.xr && HOST.curKey === 'qubits', null, { timeout: 30000 });
    const kept = await sp.evaluate(() => [HOST.xr.labels(), HOST.xr.cards(), HOST.xr.free()]);
    if (kept.join() !== 'hidden,face,false') bad.push('not kept across a reload: ' + kept);
    await sp.goto('about:blank'); await sp.goto(base + 'index.html#qubits&labels=fixed&cards=hidden&free=on');
    await sp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.xr && HOST.curKey === 'qubits', null, { timeout: 30000 });
    const link = await sp.evaluate(() => [HOST.xr.labels(), HOST.xr.cards(), HOST.xr.free(), HOST.xr.sig()]);
    if (link.join() !== 'fixed,hidden,true,fixed/hidden+') bad.push('#labels=fixed&cards=hidden&free=on gave ' + link);
    await setLook('face', true, 'fixed');
    if (bad.length) errors.push(...bad.map(b => 'settings: ' + b));
  });
  for (const key of ['qubits', 'flock', 'airports']) await step(`${key}: labels and the story panels (cards) each on top, in 3D and hidden in the headset, independently; free moving with the grip`, async () => {
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
    const press = async id => { await tick(2); const ok = await sp.evaluate(id => { const r = HOST.collab.menuFind(id); if (r && r.fn) r.fn(); return !!(r && r.fn); }, id); await tick(2); return ok; };
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
    // a hand-written story too, and the hook in all sixteen
    await openXR('airports');
    const a1 = await at(140);
    if (!(a1.vis && await inPanel(a1.text))) bad.push('the airports at 140 s: no caption of its line: ' + JSON.stringify(a1));
    const miss = await sp.evaluate(async keys => (await Promise.all(keys.map(async k => (await (await fetch('stories/' + k + '.js')).text()).includes('caption: xrCaption') ? '' : k))).filter(Boolean),
      STORY_KEYS);
    if (miss.length) bad.push('no caption hook in ' + miss.join(', '));
    await sp.evaluate(() => HOST.xr.setSubs(false));
    if (bad.length) errors.push(...bad.map(b => 'subtitles: ' + b));
  });
  // the All stories circle's hook lines (v104): the same in all sixteen stories and the design room (its cards as the
  // Stories screen, a card picking for the circle, the story panel's Stories button back to its cards)
  await step('every story keeps the All stories hook lines', async () => {
    const lines = ['const xrCards = () => !!(HOST.room && HOST.room.cards && HOST.room.cards());', 'const xrAllHere = () => !!(HOST.room && HOST.room.allHere && HOST.room.allHere());',
      'if (xrCards() && !XR.stories) { XR.stories = true; XR.inStory = false; XR.kbd.open = false; APP.playing = false; }',
      'if (XR.stories && !xrCards() && (roomOnly || (HOST.collab.mine() && HOST.room.placing()))) xrLandingClose();',
      "else if (xrAllHere() && !XR.stories) hb('stories', 'Stories', () => HOST.room.allBack(), 130);", 'fn: () => (here && !xrCards() ? xrLandingClose() : HOST.go(s.key)) });',
      'if (xrAway() || xrCards()) { APP.playing = false; SLIDE.tail = null; }', "() => { if (here && !xrCards()) XR.stories = false; else HOST.go(k); }",
      "if (!xrCards()) vButton(ctx, P, 'story:close', ", "if (XR.inStory && !xrCards()) vButton(ctx, P, 'back', "];
    const miss = await sp.evaluate(async ([keys, lines]) => (await Promise.all(keys.map(async k => { const t = await (await fetch('stories/' + k + '.js')).text(); const m = lines.filter(l => !t.includes(l)); return m.length ? k + ': ' + m.length : ''; }))).filter(Boolean),
      [[...STORY_KEYS, ...EXTRA], lines]);
    if (miss.length) errors.push('the All stories hook lines are missing in ' + miss.join(', '));
  });
  // focus mode's framing line (v106): every story frames its scene for the whole page while HOST.focus() is true
  await step('every story keeps the focus mode framing lines', async () => {
    const lines = ['GL.bare = !!(HOST.focus && HOST.focus());', 'if (GL.bare) camera.setViewOffset(w, h, 0, 0.05 * h, w, h);'];
    const miss = await sp.evaluate(async ([keys, lines]) => (await Promise.all(keys.map(async k => { const t = await (await fetch('stories/' + k + '.js')).text(); const m = lines.filter(l => !t.includes(l)); return m.length ? k + ': ' + m.length : ''; }))).filter(Boolean),
      [[...STORY_KEYS, ...EXTRA], lines]);
    if (miss.length) errors.push('the focus mode framing lines are missing in ' + miss.join(', '));
  });
  // panels per story, the menu's row for the story on show: shown (as ever), controls only (the foot bar alone: the text
  // and explore panel neither drawn nor pointable) or hidden (neither; A or X does nothing, the menu's Story tab plays), in story and explore mode;
  // each story its own (the design room too), kept across a reload, set by a link for the story it opens; cards hidden
  // still hides both, labels hidden neither; no row on the Stories screen, whose panels stay
  await step('panels per story in the headset: shown, controls only, hidden through the menu; each story its own, kept, set by a link; cards hidden hides both', async () => {
    const bad = [];
    const press = async id => { await tick(2); const ok = await sp.evaluate(id => { const r = HOST.collab.menuFind(id); if (r && r.fn) r.fn(); return !!(r && r.fn); }, id); await tick(2); return ok; };
    const row = () => sp.evaluate(() => { const r = HOST.collab.menuFind('panels'); return !!(r && r.fn); });
    const vis = async () => { await tick(2); return sx('(XR.main.mesh.visible ? "main" : "-") + "," + (XR.foot.mesh.visible ? "foot" : "-")'); };
    const want = { shown: 'main,foot', controls: '-,foot', hidden: '-,-' }, hits = { shown: 'panel:main,panel:foot', controls: 'x,panel:foot', hidden: 'x,x' };
    const pointed = async () => (await pointBoth()).map(h => (h.startsWith('panel') ? h : 'x')).join();
    const free = () => sx('(XR.ctrls[0].src = null, XR.ctrls[0].g.visible = false, XR.ctrls[0].hover = null, 0)');
    const ready = k => sp.waitForFunction(k => typeof HOST !== 'undefined' && HOST.panels && HOST.curKey === k, k, { timeout: 30000 });
    await openXR('qubits');
    if (!(await sp.evaluate(() => HOST.panels.get('qubits')) === 'shown' && await vis() === want.shown)) bad.push('not shown by default: ' + await vis());
    // the menu's row goes round, the story following at once
    await sp.evaluate(() => HOST.collab.panelOpen(true));
    for (let k = 0; k < 40 && !await row(); k++) { await sp.waitForTimeout(50); await tick(1); }   // (a busy machine: the menu drawn with its row)
    const seen = [];
    for (let k = 0; k < 3; k++) { if (!await press('panels')) { bad.push('no Panels row in the menu: ' + JSON.stringify(await sp.evaluate(() => [!!HOST.session, HOST.curKey, HOST.busy, HOST.onStories, HOST.room.away(), HOST.collab.code, HOST.collab.menuIds().slice(0, 12)]))); break; } seen.push(await sp.evaluate(() => HOST.panels.get('qubits')) + '/' + await vis()); }
    if (seen.join(' ') !== 'controls/-,foot hidden/-,- shown/main,foot') bad.push('the menu\'s Panels row went ' + seen.join(' ') + ' (not controls only, hidden, shown, with the panels following)');
    // on the Stories screen: no row (no story on show), and its panels stay whatever this story's are
    await sp.evaluate(() => HOST.panels.set('qubits', 'hidden'));
    await sx('(XR.stories = true, 0)'); await tick(3);
    const land = await sx('XR.land.every(P => P.mesh.visible)');
    if (await row() || !land) bad.push(`on the Stories screen: a Panels row ${await row()}, its panels shown ${land}`);
    await sx('(XR.stories = false, APP.enterStory(0), APP.playing = false, 0)'); await tick(3);
    await sp.evaluate(() => HOST.collab.panelOpen(false)); await tick(2);
    // each value in story and explore mode: what shows and what the pointer reaches; while hidden A or X does nothing and
    // the menu's Story tab plays
    for (const m of ['shown', 'controls', 'hidden']) {
      await sp.evaluate(m => HOST.panels.set('qubits', m), m);
      await sx('(APP.mode === "story" || APP.enterStory(0), APP.playing = false, 0)');
      const v = await vis(), h = await pointed();
      if (v !== want[m] || h !== hits[m]) bad.push(`${m} (story): ${v}, the pointer at each panel ${h}`);
      if (m === 'hidden') {
        const was = await sx('APP.playing'), ax = await aOrX(), [tab, now] = await tabPlay();
        await sx('(APP.playing = false, 0)'); await free(); await tick(1);
        if (!(was === false && ax === false)) bad.push(`hidden: A or X played or paused the story (${was} -> ${ax})`);
        if (!(tab === true && now === true)) bad.push(`hidden: the menu's Story tab did not play it (its play button pointed at through the copy: ${tab}, playing ${now})`);
      }
      await sx('APP.enterExplore()'); await tick(3);
      const vx = await vis(), hx = await pointed();
      if (vx !== want[m] || hx !== hits[m]) bad.push(`${m} (explore): ${vx}, the pointer at each panel ${hx}`);
    }
    // cards hidden still hides both, whatever the panels; back again with cards in 3D; labels hidden hides neither
    await sp.evaluate(() => HOST.panels.set('qubits', 'controls'));
    await setCards('hidden');
    const ch = await vis();
    await setCards('fixed');
    const cf = await vis();
    await setLook('hidden');
    const lh = await vis();
    await setLook('face');
    if (ch !== '-,-' || cf !== '-,foot' || lh !== '-,foot') bad.push(`cards hidden with controls only: ${ch}; cards in 3D again: ${cf}; labels hidden: ${lh}`);
    // each story its own: the flock and the airports shown, the flock then hidden; the qubits' stays
    await openXR('flock');
    const fl = await vis();
    await sp.evaluate(() => HOST.collab.panelOpen(true));
    await press('panels'); await press('panels');
    await sp.evaluate(() => HOST.collab.panelOpen(false));
    const fl2 = [await sp.evaluate(() => [HOST.panels.get('flock'), HOST.panels.get('qubits'), HOST.panels.get('airports')].join()), await vis()];
    if (fl !== want.shown || fl2.join(' ') !== 'hidden,controls,shown -,-') bad.push(`each story its own: the flock at first ${fl}, after two presses ${fl2.join(' ')} (flock, qubits, airports)`);
    // kept across a reload, per story
    await sp.reload(); await ready('flock');
    const kept = await sp.evaluate(() => ['qubits', 'flock', 'airports', 'design'].map(k => HOST.panels.get(k)).join());
    if (kept !== 'controls,hidden,shown,shown') bad.push('not kept per story across a reload: ' + kept);
    // a link sets it for the story it opens (a hand-written story and the design room read it as the others do)
    await openXR('airports', '&panels=controls');
    const al = [await sp.evaluate(() => ['airports', 'qubits', 'flock'].map(k => HOST.panels.get(k)).join()), await vis()];
    if (al.join(' ') !== 'controls,controls,hidden -,foot') bad.push('#airports&panels=controls gave ' + al.join(' '));
    await openXR('design', '&panels=hidden');
    const dl = [await sp.evaluate(() => ['design', 'airports'].map(k => HOST.panels.get(k)).join()), await vis()];
    if (dl.join(' ') !== 'hidden,controls -,-') bad.push('#design&panels=hidden gave ' + dl.join(' '));
    await sp.evaluate(() => HOST.panels.set('design', 'shown'));
    if (await vis() !== want.shown) bad.push('the design room shown again: ' + await vis());
    // the same lines in all sixteen stories and the design room
    const miss = await sp.evaluate(async keys => (await Promise.all(keys.map(async k => { const s = await (await fetch('stories/' + k + '.js')).text();
      return s.includes("const pm = xrPanels(), pv = !land && !away && XR.cm !== 'hidden';") && s.includes('HOST.panels.sig(XR_HERE)') &&
        s.includes("const xrCardMode = () => (HOST.xr && HOST.xr.cards ? HOST.xr.cards() : xrLabelMode());") && s.includes("XR.lm = xrLabelMode(); XR.cm = xrCardMode();") &&
        s.includes("panelDepth(XR.main, XR.cm === 'fixed'); panelDepth(XR.foot, XR.cm === 'fixed');") ? '' : k; }))).filter(Boolean),
    [...STORY_KEYS, ...EXTRA]);
    if (miss.length) bad.push('no panels or cards lines in ' + miss.join(', '));
    await sp.evaluate(() => { try { localStorage.removeItem('xrPanels'); } catch (e) { /* storage blocked */ } });
    if (bad.length) errors.push(...bad.map(b => 'panels: ' + b));
  });
  // the menu's Design room button outside a shared room opens the design room (the props table) in the headset: the menu
  // closes, the table opens in explore mode, and the button greys while you are there (nothing to press)
  // the frame-rate read-out (HOST.xr.fps, this headset's own): off by default; on through the menu's Settings row, kept
  // across a reload, set by a link; while on, drawn low in the view and a little to the left (fixed to the head, over the
  // story), with the frame rate and, from the story's frames drawn through the shell's measure (HOST.perf), its triangles
  // and draw calls; nothing drawn when off
  await step('the frame-rate read-out in the headset: off by default; on through the menu, kept, set by a link; the story\'s triangles and draw calls, low in the view', async () => {
    const bad = [];
    const FP = () => sp.evaluate(() => { const S = HOST.collab.overlay().fps, m = S.mesh.material, p = S.mesh.position, h = window.__head.p, d = [p.x - h[0], p.y - h[1], p.z - h[2]], l = Math.hypot(...d);
      return { vis: S.mesh.visible, text: S.text, top: !m.depthTest && S.mesh.renderOrder === 52, down: Math.asin(-d[1] / l) * 180 / Math.PI, left: Math.atan2(-d[0], -d[2]) * 180 / Math.PI, dist: l }; });
    const press = async id => { await tick(2); const ok = await sp.evaluate(id => { const r = HOST.collab.menuFind(id); if (r && r.fn) r.fn(); return !!(r && r.fn); }, id); await tick(2); return ok; };
    await openXR('qubits');
    const f0 = await FP();
    if (await sp.evaluate(() => HOST.xr.fps()) || f0.vis) bad.push('not off by default: ' + JSON.stringify(f0));
    await sp.evaluate(() => HOST.collab.panelOpen(true));
    if (!await press('fps') || !await sp.evaluate(() => HOST.xr.fps())) bad.push('the menu\'s Frame rate row did not turn it on');
    await sp.evaluate(() => HOST.collab.panelOpen(false));
    // (the pretend session's own loop is stopped: its frames drawn here through the shell's measure, as the renderer's loop
    // does, from the pretend head at a moment with a scene on show, until a second's numbers are in)
    await sx('(APP.seek(60), APP.playing = false)');
    await sp.evaluate(async () => {
      const cam = new THREE.PerspectiveCamera(90, 1.6, 0.05, 200), h = window.__head;
      cam.position.set(...h.p); cam.quaternion.set(...h.q);
      const f = HOST.perf.wrap(() => HOST.renderer.render(HOST.cur.peek('GL.scene'), cam)), t0 = performance.now();
      while (performance.now() - t0 < 30000 && !(HOST.perf.stats() && HOST.perf.stats().n > 1)) { window.__tick(1); f(performance.now()); await new Promise(r => setTimeout(r, 25)); }
      window.__tick(1);
    });
    const st = await sp.evaluate(() => HOST.perf.stats()), f1 = await FP();
    const tri = f1.text && /([\d,]+) triangles · (\d+) draw calls · code ([\d.]+) ms/.exec(f1.text), fp = f1.text && /^(\d+) fps · ([\d.]+) ms a frame, worst ([\d.]+) ms/.exec(f1.text);
    if (!(st && st.tri > 50 && st.calls > 2 && st.js > 0 && st.n > 1)) bad.push('the story\'s frames were not measured: ' + JSON.stringify(st));
    if (!(f1.vis && f1.top && tri && +tri[1].replace(/,/g, '') > 50 && +tri[2] > 2 && fp && +fp[1] > 0 && +fp[3] >= +fp[2])) bad.push('the read-out does not show plausible numbers: ' + JSON.stringify(f1));
    if (!(Math.abs(f1.down - 22) < 1 && Math.abs(f1.left - 14) < 1 && Math.abs(f1.dist - 1) < 0.01)) bad.push('the read-out is not about 22 degrees down and 14 to the left, 1 m away: ' + JSON.stringify(f1));
    // turned with the head: still in the same place in the view
    await head([0, 1.6, 0], 0.7); await tick(2);
    const f2 = await sp.evaluate(() => { const S = HOST.collab.overlay().fps, p = S.mesh.position, h = window.__head, q = new THREE.Quaternion(...h.q).invert(), d = new THREE.Vector3(p.x - h.p[0], p.y - h.p[1], p.z - h.p[2]).applyQuaternion(q).normalize(); return [Math.asin(-d.y) * 180 / Math.PI, Math.atan2(-d.x, -d.z) * 180 / Math.PI]; });
    if (Math.abs(f2[0] - 22) > 1 || Math.abs(f2[1] - 14) > 1) bad.push('it does not stay put in the view as the head turns: ' + JSON.stringify(f2));
    await head([0, 1.6, 0], 0);
    // kept across a reload, a link turns it off, and off nothing is drawn
    await sp.reload(); await sp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.xr && HOST.curKey === 'qubits', null, { timeout: 30000 });
    if (!await sp.evaluate(() => HOST.xr.fps() && localStorage.getItem('xrFps') === 'on')) bad.push('the read-out on was not kept across a reload');
    await openXR('qubits', '&fps=off');
    const f3 = await FP();
    if (await sp.evaluate(() => HOST.xr.fps()) || f3.vis) bad.push('#fps=off did not turn it off: ' + JSON.stringify(f3));
    await openXR('qubits', '&fps=on'); await tick(2);
    const f4 = await FP();
    await sp.evaluate(() => HOST.xr.setFps(false)); await tick(2);
    const f5 = await FP();
    if (!f4.vis || f5.vis) bad.push('#fps=on, then off: ' + JSON.stringify([f4.vis, f5.vis]));
    if (bad.length) errors.push(...bad.map(b => 'frame rate: ' + b));
  });
  // the frame-rate read-out on a double press of B or Y (v119: button 5 of either controller, two presses within 0.4 s;
  // no story uses it): B twice turns it on (a notice says so), Y twice off again; one press, or two 0.6 s apart, nothing;
  // a button held as its controller appears counts nothing
  await step('the frame-rate read-out: a double press of B or Y turns it on and off; one press, two slow ones or a held button nothing', async () => {
    const bad = [];
    if (!await sp.evaluate(() => HOST.curKey === 'qubits' && !!window.__tick && !!HOST.session)) await openXR('qubits');
    await sp.evaluate(() => HOST.xr.setFps(false));
    // a pretend controller (index i of the session's input sources) with button 5 (B on the right, Y on the left); seq: its
    // states, one headset frame each, in one go (two presses within 0.4 s however slowly the page draws)
    const ctl = (i, hand, held) => sp.evaluate(([i, hand, held]) => { window.__s.inputSources[i] = { handedness: hand, targetRayMode: 'tracked-pointer', gamepad: { axes: [0, 0, 0, 0], buttons: [0, 1, 2, 3, 4, 5].map(k => ({ pressed: k === 5 && held, touched: false, value: 0 })) } }; window.__tick(1); }, [i, hand, held]);
    const seq = (i, states) => sp.evaluate(([i, states]) => { const b = window.__s.inputSources[i].gamepad.buttons[5]; for (const v of states) { b.pressed = v; window.__tick(1); } }, [i, states]);
    const st = () => sp.evaluate(() => ({ on: HOST.xr.fps(), note: (HOST.collab.notes().slice(-1)[0] || {}).title || '' }));
    await ctl(0, 'right', false); await ctl(1, 'left', false);
    await seq(0, [true, false]); await tick(2);
    const s1 = await st();
    if (s1.on) bad.push('one press of B turned it on');
    await sp.waitForTimeout(500);
    await seq(0, [true, false]); await sp.waitForTimeout(600); await seq(0, [true, false]); await tick(1);
    const s2 = await st();
    if (s2.on) bad.push('two presses of B 0.6 s apart turned it on');
    await sp.waitForTimeout(500);
    await seq(0, [true, false, true, false]); await tick(2);
    const s3 = await st(), f3 = await sp.evaluate(() => HOST.collab.overlay().fps.mesh.visible);
    if (!(s3.on && s3.note === 'Frame rate: on' && f3)) bad.push('a double press of B did not turn it on (with its notice, the read-out drawn): ' + JSON.stringify([s3, f3]));
    await sp.waitForTimeout(500);
    await seq(1, [true, false, true, false]); await tick(2);
    const s4 = await st();
    if (s4.on || s4.note !== 'Frame rate: off') bad.push('a double press of Y did not turn it off: ' + JSON.stringify(s4));
    // held as its controller appears: let go, pressed once, nothing (that first one was no press)
    await sp.waitForTimeout(500);
    await sp.evaluate(() => { window.__s.inputSources.length = 0; HOST.xr.setFps(false); window.__tick(1); });
    await ctl(0, 'right', true);
    await seq(0, [true, false, true, false]); await tick(1);
    const s5 = await st();
    if (s5.on) bad.push('a B held as its controller appeared counted as a press');
    await sp.evaluate(() => { window.__s.inputSources.length = 0; HOST.xr.setFps(false); window.__tick(1); });
    if (bad.length) errors.push(...bad.map(b => 'frame rate by B or Y: ' + b));
  });
  // a keypad for a word in the headset's menu (HOST.collab.keypad; the studio names scenes with it): a word typed, Delete
  // and OK give it (the menu it opened closing again); OK greyed while empty; Back gives null, and so does another tab;
  // without a headset session there is no keypad (null at once)
  await step('the headset keypad: typed, Delete and OK give the word; Back and another tab give null; none without a headset', async () => {
    const bad = [];
    const kp = o => sp.evaluate(o => { window.__kpv = undefined; HOST.collab.keypad(o).then(v => { window.__kpv = v; }); }, o);
    const press = async id => { await tick(1); const ok = await sp.evaluate(id => { const r = HOST.collab.menuFind(id); if (r && r.fn) r.fn(); return !!(r && r.fn); }, id); return ok; };
    const got = () => sp.evaluate(() => [window.__kpv, HOST.collab.menu]);
    if (!await sp.evaluate(() => HOST.curKey === 'qubits' && !!window.__tick && !!HOST.session)) await openXR('qubits');   // (the step before left it so)
    await kp({ title: 'Name the scene', hint: 'Lower-case letters, digits, space and _ . -', value: '', max: 40 });
    await tick(2);
    const ids = await sp.evaluate(() => HOST.collab.menuIds().filter(i => i.startsWith('kp:')));
    const want = [...'abcdefghijklmnopqrstuvwxyz0123456789'].map(c => 'kp:' + c).concat('kp:space', 'kp:_', 'kp:.', 'kp:-', 'kp:back');
    if (want.some(i => !ids.includes(i)) || ids.includes('kp:ok') || ids.includes('kp:del')) bad.push('the keypad\'s keys (OK and Delete greyed while empty): ' + ids.join(' '));
    if (!(await got())[1]) bad.push('the menu did not open for the keypad');
    for (const k of ['a', 't', 'e', 'l', 'i', 'e', 'r', 'space', '2', '2']) if (!await press('kp:' + k)) { bad.push('no key ' + k); break; }
    await press('kp:del');
    await press('kp:ok'); await tick(1);
    const v1 = await got();
    if (v1[0] !== 'atelier 2' || v1[1]) bad.push('typing "atelier 22", Delete and OK gave ' + JSON.stringify(v1) + ' (the menu should close again)');
    await kp({ title: 'Another' }); await tick(2);
    await press('kp:x'); await press('kp:back'); await tick(1);
    const v2 = await got();
    if (v2[0] !== null || v2[1]) bad.push('Back did not give null and close the menu: ' + JSON.stringify(v2));
    await kp({ title: 'A third' }); await tick(2);
    await press('kp:y'); await press('tab:settings'); await tick(1);
    const v3 = await got();
    if (v3[0] !== null) bad.push('another tab did not give null: ' + JSON.stringify(v3));
    await sp.evaluate(() => HOST.collab.panelOpen(false));
    const v4 = await page.evaluate(() => HOST.collab.keypad({ title: 'x' }));
    if (v4 !== null) bad.push('without a headset session it gave ' + JSON.stringify(v4));
    if (bad.length) errors.push(...bad.map(b => 'keypad: ' + b));
  });
  await step('the headset menu\'s Design room button opens the design room outside a room', async () => {
    const bad = [];
    const btn = () => sp.evaluate(() => { const r = HOST.collab.menuFind('design'); return r && r.fn ? 'on' : 'off'; });   // (a greyed button has no region)
    await openXR('qubits');
    await sp.evaluate(() => HOST.collab.panelOpen(true));
    for (let k = 0; k < 40 && await btn() !== 'on'; k++) { await sp.waitForTimeout(50); await tick(1); }
    const was = await btn();
    // (the story all built first: a story asked for while one still builds is dropped outside a room, HOST.start's busy,
    // and on a slow machine openXR can return while its last steps still run)
    await sp.waitForFunction(() => !HOST.busy, null, { timeout: 60000 }).catch(() => {});
    await sp.evaluate(() => { const r = HOST.collab.menuFind('design'); if (r && r.fn) r.fn(); });
    const opened = await sp.waitForFunction(() => HOST.curKey === 'design' && HOST.cur && HOST.cur.peek('typeof GL !== "undefined" && !!XR.panelGroup && typeof ST !== "undefined" && ST.items.length > 0'), null, { timeout: 60000 })
      .then(() => true, () => false);
    if (opened) { await sp.evaluate(() => HOST.cur.peek('xrAdopt()')); await tick(3); }   // (as a story adopts a real session: the pretend one is not presenting)
    const after = opened && await sp.evaluate(() => ({ menu: HOST.collab.menu, mode: HOST.cur.peek('APP.mode'), stories: HOST.cur.peek('XR.stories'), world: HOST.cur.peek('GL.world.visible'), hash: location.hash }));
    await sp.evaluate(() => HOST.collab.panelOpen(true)); await tick(3);
    const there = await btn();
    await sp.evaluate(() => HOST.collab.panelOpen(false));
    if (was !== 'on' || !opened || !after || after.menu || after.stories || !after.world || after.hash !== '#design' || there !== 'off')
      bad.push(JSON.stringify({ was, opened, after, there }));
    if (bad.length) errors.push(...bad.map(b => 'design button: ' + b));
  });
  await sp.close();
}
// Moving with the sticks in VR (v125: HOST.xr.walk, walking and walkWhy in index.html; a stick clicked twice, shared.js's
// sticks; the owner, 8 November 2026: "Add Movement in vr mode, maybe with sticks, switchable by double pressing a
// stick?"). In a page of its own with a pretend VR headset whose frames go first through the session's own
// requestAnimationFrame (the shell's hook, then its own callback) and then the story's frame with the same frame object,
// as three.js's would: a reference space that makes offset spaces, a new frame object each tick answering for the head,
// two controllers with gamepads and an anchor from where they really are. The frames' clock is the test's (60 a second);
// the clicks' is the page's (0.4 s for a double click)
if (runs('stick moving')) {
  const wp = await browser.newPage({ viewport: { width: 640, height: 400 } });
  wp.on('pageerror', e => errors.push('stick moving: ' + (e.stack || e.message)));
  wp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('stick moving: ' + m.text()); });
  const sx = s => wp.evaluate(s => HOST.cur.peek(s), s);
  const tick = (n, ms) => wp.evaluate(([n, ms]) => window.__wtick(n, ms), [n || 1, ms || 1000 / 60]);
  // (ready: what else to wait for inside the story before the pretend headset takes over, such as the studio's scene)
  const openW = async (key, hash, ready) => {
    await wp.goto('about:blank');
    await wp.goto(base + 'index.html#' + key + (hash || ''));
    await wp.waitForFunction(([k, r]) => typeof HOST !== 'undefined' && HOST.curKey === k && HOST.cur && HOST.cur.peek('typeof ST !== "undefined" && ST.items.length > 0 && !!XR.panelGroup' + (r ? ' && (' + r + ')' : '')), [key, ready || ''], { timeout: 60000 });
    await wp.evaluate(() => {
      const V3 = THREE.Vector3, M4 = THREE.Matrix4, Q = THREE.Quaternion;
      const W = window.__w = { head: { p: [0, 1.6, 0], yaw: 0 }, t: 5000, raf: [], last: null };
      const sp = name => ({ name, addEventListener() {}, removeEventListener() {} });
      const REF = W.ref = sp('local');
      REF.getOffsetReferenceSpace = T => Object.assign(sp('moved'), { base: REF, T });
      // a pose in a space: the reference space's own, or one offset from it (the inverse of its offset times the pose)
      const into = (s, m) => (s === REF ? m.clone() : s && s.base === REF ? new M4().fromArray(s.T.matrix).invert().multiply(m) : null);
      const pose = m => { if (!m) return null; const p = new V3(), q = new Q(); m.decompose(p, q, new V3()); return { transform: { position: { x: p.x, y: p.y, z: p.z, w: 1 }, orientation: { x: q.x, y: q.y, z: q.z, w: q.w }, matrix: Float32Array.from(m.elements) }, views: [], emulatedPosition: false }; };
      const at = (x, y, z, yaw) => new M4().compose(new V3(x, y, z), new Q().setFromAxisAngle(new V3(0, 1, 0), yaw || 0), new V3(1, 1, 1));
      const pad = () => ({ axes: [0, 0, 0, 0], buttons: [0, 1, 2, 3, 4, 5].map(() => ({ pressed: false, touched: false, value: 0 })), hapticActuators: [] });
      const L = W.L = { handedness: 'left', targetRayMode: 'tracked-pointer', targetRaySpace: sp('Lray'), gripSpace: sp('Lgrip'), gamepad: pad() };
      const R = W.R = { handedness: 'right', targetRayMode: 'tracked-pointer', targetRaySpace: sp('Rray'), gripSpace: sp('Rgrip'), gamepad: pad() };
      W.anchor = sp('anchor');
      const real = W.real = new Map([[L.targetRaySpace, at(-0.2, 1.1, -0.3)], [L.gripSpace, at(-0.2, 1.1, -0.3)], [R.targetRaySpace, at(0.2, 1.1, -0.3)], [R.gripSpace, at(0.2, 1.1, -0.3)], [W.anchor, at(0, 1, -2)]]);
      W.frame = () => ({ getViewerPose: s => pose(into(s, at(...W.head.p, W.head.yaw))), getPose: (s, b) => (real.has(s) ? pose(into(b, real.get(s))) : null), getJointPose: () => null });
      const ls = {};
      W.s = { visibilityState: 'visible', renderState: {}, environmentBlendMode: 'opaque', enabledFeatures: [], inputSources: [L, R],
        addEventListener(type, fn) { (ls[type] = ls[type] || []).push(fn); }, removeEventListener() {}, requestAnimationFrame: cb => W.raf.push(cb),
        fire(type, e) { for (const fn of ls[type] || []) fn(e); } };
      HOST.renderer.xr.getReferenceSpace = () => REF;
      HOST.renderer.setAnimationLoop(null);
      HOST.session = W.s; HOST.mode = 'immersive-vr';
      HOST.cur.peek('(XR.session = window.__w.s, XR.mode = "immersive-vr", xrEnterScene(), XR.stories = false, XR.inStory = true, APP.playing = false)');
      window.__wtick = (n = 1, ms = 1000 / 60) => {
        for (let i = 0; i < n; i++) {
          W.t += ms;
          const f = W.last = W.frame();
          for (const cb of W.raf.splice(0)) cb(W.t, f);
          if (W.pre) W.pre(f);   // (what three.js would do with the frame before the story's: the studio's controllers placed)
          HOST.cur.peek(`(() => {
            xrBegin(window.__w.last, ${ms / 1000});
            const hand = typeof xrPlaceGlobe === 'function', pn = performance.now();
            let S;
            if (APP.mode === 'story') { const ts = storyT(APP.t); S = storyState(ts); if (hand) xrPlaceGlobe(storyCam(ts)); else { xrPlace(storyCam(ts)); K.U.uTime.value = ts; updateSets(S, ts, 0.016, true); } }
            else { S = hand ? exploreStep(0.016) : exploreStep(0.016, pn); orbitStep(pn); if (hand) xrPlaceGlobe(orbit.cur); else { xrPlace(orbit.cur); updateSets(S, pn / 1000, 0.016, false); } }
            if (hand) applyUniforms(S, APP.mode === 'explore');
            GL.scene.updateMatrixWorld(true); xrUpdate(S); GL.scene.updateMatrixWorld(true);
          })()`);
        }
      };
      window.__wtick(3);
    });
  };
  // the head, a controller's ray and the anchor as three.js would see them now, in its reference space: positions and the
  // head's yaw (degrees, 0 facing -z, turning left positive)
  const SEEN = `(() => { const W = window.__w, f = W.last, p = x => x ? [x.transform.position.x, x.transform.position.y, x.transform.position.z] : null;
    const v = f.getViewerPose(W.ref), o = v.transform.orientation, fw = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(o.x, o.y, o.z, o.w));
    return { head: p(v), yaw: Math.atan2(-fw.x, -fw.z) * 180 / Math.PI, ray: p(f.getPose(W.L.targetRaySpace, W.ref)), grip: p(f.getPose(W.R.gripSpace, W.ref)), anchor: p(f.getPose(W.anchor, W.ref)),
      story: HOST.cur.peek('XR.head.toArray()'), travel: HOST.xr.travel(), walking: HOST.xr.walking(), why: HOST.xr.walkWhy() }; })()`;
  const seen = () => wp.evaluate(s => eval(s), SEEN);
  const stick = (hand, x, y) => wp.evaluate(([hand, x, y]) => { const a = window.__w[hand].gamepad.axes; a[2] = x; a[3] = y; }, [hand, x, y]);
  // a stick's click (button 3) pressed and let go, once or twice in a row, one headset frame each (well within 0.4 s)
  const click = (hand, times) => wp.evaluate(([hand, times]) => { const b = window.__w[hand].gamepad.buttons[3];
    for (let k = 0; k < times; k++) { b.pressed = true; window.__wtick(1); b.pressed = false; window.__wtick(1); } }, [hand, times || 1]);
  const note = () => wp.evaluate(() => { const n = HOST.collab.notes().slice(-1)[0] || {}; return [n.title || '', n.text || ''].join(': '); });
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const noMove = t => !t.space && !t.x && !t.z && !t.yaw;   // (no travel: three.js's space is the real one)

  await step('stick moving: off by default; a stick clicked twice turns it on and off (a notice, kept across a reload); one click opens the menu only after 0.4 s, two never', async () => {
    const bad = [];
    await openW('qubits');
    if (await wp.evaluate(() => HOST.xr.walk() || localStorage.getItem('xrWalk') !== null)) bad.push('not off by default');
    // one click: no menu at once, the menu 0.4 s later
    await click('L', 1);
    const m0 = await wp.evaluate(() => HOST.collab.menu);
    await wp.waitForTimeout(500); await tick(1);
    const m1 = await wp.evaluate(() => HOST.collab.menu);
    if (m0 || !m1) bad.push(`one click of the left stick: the menu open at once ${m0}, after 0.5 s ${m1}`);
    await wp.evaluate(() => HOST.collab.panelOpen(false)); await wp.waitForTimeout(500); await tick(1);
    // twice: on, its notice, and no menu, then or later
    await click('L', 2);
    const on = await wp.evaluate(() => [HOST.xr.walk(), localStorage.getItem('xrWalk'), HOST.collab.menu]), n1 = await note();
    await wp.waitForTimeout(500); await tick(1);
    const m2 = await wp.evaluate(() => HOST.collab.menu);
    if (!(on[0] && on[1] === 'on' && !on[2] && !m2)) bad.push('the left stick clicked twice: ' + JSON.stringify({ on, menuLater: m2 }));
    if (!n1.startsWith('Moving with the sticks: on: Left stick: move. Right stick: turn.')) bad.push('its notice: ' + n1);
    // both sticks at once: one click, the menu once (open, not open and shut)
    await wp.evaluate(() => { const l = window.__w.L.gamepad.buttons[3], r = window.__w.R.gamepad.buttons[3]; l.pressed = r.pressed = true; window.__wtick(1); l.pressed = r.pressed = false; window.__wtick(1); });
    await wp.waitForTimeout(500); await tick(2);
    const both = await wp.evaluate(() => [HOST.collab.menu, HOST.xr.walk()]);
    if (!(both[0] && both[1])) bad.push('both sticks clicked at once: the menu open ' + both[0] + ', still moving ' + both[1]);
    await wp.evaluate(() => HOST.collab.panelOpen(false)); await wp.waitForTimeout(500); await tick(1);
    // kept across a reload; the right stick clicked twice turns it off
    await wp.reload(); await wp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.xr && HOST.curKey === 'qubits', null, { timeout: 60000 });
    if (!await wp.evaluate(() => HOST.xr.walk())) bad.push('not kept across a reload');
    await openW('qubits');
    await click('R', 2);
    const off = await wp.evaluate(() => [HOST.xr.walk(), localStorage.getItem('xrWalk')]), n2 = await note();
    if (off[0] || off[1] !== 'off' || !n2.startsWith('Moving with the sticks: off')) bad.push('the right stick clicked twice: ' + JSON.stringify(off) + ' ' + n2);
    // two clicks 0.6 s apart: the menu twice (open, shut), never moving
    await wp.waitForTimeout(500);
    await click('L', 1); await wp.waitForTimeout(600); await tick(1);
    const a = await wp.evaluate(() => HOST.collab.menu);
    await click('L', 1); await wp.waitForTimeout(500); await tick(1);
    const b = await wp.evaluate(() => [HOST.collab.menu, HOST.xr.walk()]);
    if (!(a && !b[0] && !b[1])) bad.push('two clicks 0.6 s apart: ' + JSON.stringify({ first: a, second: b }));
    if (bad.length) errors.push(...bad.map(b => 'stick moving: ' + b));
  });

  await step('stick moving: the left stick moves you 1.5 m in a second where your head faces, the controllers with you, an anchor not; a flick of the right stick turns 30 degrees about your head', async () => {
    const bad = [];
    if (!await wp.evaluate(() => HOST.curKey === 'qubits' && !!window.__wtick)) await openW('qubits');
    await wp.evaluate(() => { HOST.xr.setWalk(true); HOST.xr.walkReset(); window.__w.head = { p: [0.3, 1.6, 0.2], yaw: 0.4 }; });
    await tick(2);
    const s0 = await seen();
    // forward, full push, 60 frames of 1/60 s
    await stick('L', 0, -1); await tick(60); await stick('L', 0, 0); await tick(1);
    const s1 = await seen(), want = [0.3 - 1.5 * Math.sin(0.4), 1.6, 0.2 - 1.5 * Math.cos(0.4)];
    if (!(s0.walking && dist(s1.head, want) < 0.05)) bad.push(`forward for a second: the head at ${s1.head.map(v => v.toFixed(3))}, not ${want.map(v => v.toFixed(3))} (walking ${s0.walking}, why '${s0.why}')`);
    if (dist(s1.story, s1.head) > 1e-3) bad.push('the story\'s head is not where three.js sees it: ' + JSON.stringify([s1.story, s1.head]));
    const moved = s1.head.map((v, k) => v - s0.head[k]);
    if (dist(s1.ray, s0.ray.map((v, k) => v + moved[k])) > 1e-3) bad.push('the left controller\'s ray did not come along: ' + JSON.stringify([s0.ray, s1.ray]));
    if (dist(s1.anchor, s0.anchor) > 1e-6) bad.push('the anchor moved: ' + JSON.stringify([s0.anchor, s1.anchor]));
    // half a push to the right: a quarter of the speed (the rate the push's square past the dead zone), to the right
    await stick('L', 0.6, 0); await tick(60); await stick('L', 0, 0); await tick(1);
    const s2 = await seen(), k = ((0.6 - 0.2) / 0.8) ** 2 * 1.5, right = [Math.cos(0.4), 0, -Math.sin(0.4)];
    if (dist(s2.head, s1.head.map((v, i) => v + right[i] * k)) > 0.03) bad.push(`a push of 0.6 to the right: ${dist(s2.head, s1.head).toFixed(3)} m, not ${k.toFixed(3)} m to the right`);
    // within the dead zone: nothing
    await stick('L', 0.15, -0.1); await tick(30); await stick('L', 0, 0); await tick(1);
    const s3 = await seen();
    if (dist(s3.head, s2.head) > 1e-6) bad.push('the dead zone moved you ' + dist(s3.head, s2.head));
    // the right stick: a flick right turns 30 degrees right about the head, held it turns no more; left turns back
    await stick('R', 0.9, 0); await tick(10);
    const s4 = await seen();
    await stick('R', 0, 0); await tick(1); await stick('R', -0.9, 0); await tick(1); await stick('R', 0, 0); await tick(1);
    const s5 = await seen(), d = (a, b) => ((a - b + 540) % 360) - 180;
    if (Math.abs(d(s4.yaw, s3.yaw) + 30) > 0.5 || dist(s4.head, s3.head) > 1e-3) bad.push(`a flick right: the head turned ${d(s4.yaw, s3.yaw).toFixed(2)} degrees and moved ${dist(s4.head, s3.head).toFixed(4)} m (not -30 about itself)`);
    if (Math.abs(d(s5.yaw, s3.yaw)) > 0.5 || dist(s5.head, s3.head) > 1e-3) bad.push(`and a flick left: ${d(s5.yaw, s3.yaw).toFixed(2)} degrees from before`);
    // turned, forward is the new facing: forward 0.5 s after a flick right
    await stick('R', 0.9, 0); await tick(1); await stick('R', 0, 0); await tick(1);
    const s6 = await seen();
    await stick('L', 0, -1); await tick(30); await stick('L', 0, 0); await tick(1);
    const s7 = await seen(), y6 = s6.yaw * Math.PI / 180, fw = [-Math.sin(y6), 0, -Math.cos(y6)];
    if (dist(s7.head, s6.head.map((v, i) => v + fw[i] * 0.75)) > 0.03) bad.push('forward after a turn is not where the head now faces: ' + JSON.stringify([s6, s7]));
    // the setting off: the sticks move nothing, and you stay where you moved to
    await wp.evaluate(() => HOST.xr.setWalk(false));
    await stick('L', 0, -1); await tick(20); await stick('L', 0, 0); await stick('R', 0.9, 0); await tick(2); await stick('R', 0, 0); await tick(1);
    const s8 = await seen();
    if (dist(s8.head, s7.head) > 1e-6 || Math.abs(d(s8.yaw, s7.yaw)) > 1e-3 || !s8.travel.space) bad.push('with the setting off: ' + JSON.stringify([s7.head, s8.head, s8.travel]));
    if (bad.length) errors.push(...bad.map(b => 'stick moving: ' + b));
  });

  await step('stick moving: the airports\' explore spin and zoom wait while it applies, and work again once it is off; a carried globe\'s reach still follows its stick, with no moving then', async () => {
    const bad = [];
    await openW('airports');
    await sx('(APP.enterExplore(), 0)'); await tick(3); await sx('(orbit.to = null, 0)');
    await wp.evaluate(() => { HOST.xr.setWalk(true); HOST.xr.walkReset(); });
    // the story's left controller is the session's left source, pointing down at the floor (at nothing)
    await sx(`(() => { const c = XR.ctrls[0]; c.src = window.__w.L; c.g.visible = true;
      c.g.matrix.compose(new THREE.Vector3(-0.2, 1.1, -0.3), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0)), new THREE.Vector3(1, 1, 1));
      c.g.matrixWorld.copy(c.g.matrix); return 0; })()`);
    const o0 = await sx('orbit.cur.slice()'), t0 = await seen();
    await stick('L', 0.8, 0.5); await tick(20); await stick('L', 0, 0); await tick(1);
    const o1 = await sx('orbit.cur.slice()'), t1 = await seen();
    if (JSON.stringify(o1) !== JSON.stringify(o0) || dist(t1.head, t0.head) < 0.1) bad.push('walking: the explore view moved ' + JSON.stringify([o0, o1]) + ', you moved ' + dist(t1.head, t0.head).toFixed(3) + ' m');
    await wp.evaluate(() => HOST.xr.setWalk(false));
    await stick('L', 0.8, 0.5); await tick(20); await stick('L', 0, 0); await tick(1);
    const o2 = await sx('orbit.cur.slice()'), t2 = await seen();
    if (Math.abs(o2[1] - o1[1]) < 1 || Math.abs(o2[2] - o1[2]) < 1e-3 || dist(t2.head, t1.head) > 1e-6) bad.push('not walking: the explore view did not spin and zoom, or you moved: ' + JSON.stringify([o1, o2, dist(t2.head, t1.head)]));
    // the grip on the globe held: its stick pushes and pulls the globe (its reach); you do not move
    await wp.evaluate(() => HOST.xr.setWalk(true));
    await sx('(XR.ctrls[0].hover = { kind: "globe", i: -1 }, xrGrab(XR.ctrls[0], true), 0)');
    await wp.evaluate(() => { window.__w.L.gamepad.buttons[1].pressed = true; window.__w.s.fire('squeezestart', { inputSource: window.__w.L }); });
    const r0 = await sx('XR.ctrls[0].grab ? XR.ctrls[0].grab.reach : null'), t3 = await seen();
    await stick('L', 0, -1); await tick(20); await stick('L', 0, 0); await tick(1);
    const r1 = await sx('XR.ctrls[0].grab ? XR.ctrls[0].grab.reach : null'), t4 = await seen();
    if (!(r0 === 1 && r1 !== null && r1 < 0.9) || dist(t4.head, t3.head) > 1e-6) bad.push(`the grip held: the reach ${r0} -> ${r1}, you moved ${dist(t4.head, t3.head).toFixed(4)} m`);
    // let go (squeezeend; the button still reads pressed for a moment), the stick moves you again
    await sx('(xrGrab(XR.ctrls[0], false), 0)');
    await wp.evaluate(() => { window.__w.L.gamepad.buttons[1].pressed = false; window.__w.s.fire('squeezeend', { inputSource: window.__w.L }); });
    await stick('L', 0, -1); await tick(20); await stick('L', 0, 0); await tick(1);
    const t5 = await seen();
    if (dist(t5.head, t4.head) < 0.2) bad.push('let go, the stick did not move you again: ' + dist(t5.head, t4.head).toFixed(3));
    await sx('(XR.ctrls[0].src = null, XR.ctrls[0].g.visible = false, XR.ctrls[0].hover = null, 0)');
    if (bad.length) errors.push(...bad.map(b => 'stick moving: ' + b));
  });

  await step('stick moving: in a shared room elsewhere it moves you (moved and turned, the travel gone as the room is joined, and again as another is; the row pressable), in the room with the others nothing (back where you stand); nothing in AR or where the story moves you itself (ownSticks); the menu\'s row, greyed there; #walk=on and off', async () => {
    const bad = [];
    await openW('qubits');
    await wp.evaluate(() => { HOST.xr.setWalk(true); HOST.xr.walkReset(); });
    await stick('L', 0, -1); await tick(20); await stick('L', 0, 0); await tick(1);
    const s0 = await seen();
    if (!(s0.walking && s0.travel.space && Math.abs(s0.travel.z) + Math.abs(s0.travel.x) > 0.3)) bad.push('it did not move you first: ' + JSON.stringify(s0.travel));
    // the menu's row (Settings): on, pressable
    await wp.evaluate(() => { HOST.collab.panelOpen(true); HOST.collab.menuTab('settings'); }); await tick(2);
    const row = () => wp.evaluate(() => { const r = HOST.collab.menuFind('walk'); return r ? (r.fn ? 'on' : 'greyed') : 'none'; });
    const r1 = await row();
    await wp.evaluate(() => { const r = HOST.collab.menuFind('walk'); if (r && r.fn) r.fn(); }); await tick(2);
    const w1 = await wp.evaluate(() => HOST.xr.walk());
    await wp.evaluate(() => { const r = HOST.collab.menuFind('walk'); if (r && r.fn) r.fn(); }); await tick(2);
    const w2 = await wp.evaluate(() => HOST.xr.walk());
    if (r1 !== 'on' || w1 || !w2) bad.push(`the menu's row: ${r1}, pressed ${w1}, again ${w2}`);
    // a shared room (v128; the owner, 9 November 2026: "should also work in shared rooms everywhere when the user is in vr
    // and not in the same room"), this headset elsewhere (HOST.collab.here() false: VR answered "Somewhere else", or not
    // yet): the travel goes as the room is joined (its frame is made from where you really stand), then the left stick
    // moves you 1.5 m where you face, a flick turns you 30 degrees, the row pressable; in the room with the others
    // (here() true: "In this room"): back where you stand and nothing moves, the row greyed
    // moved and turned just before the room is joined (a flick right too), so the join's reset has travel to take back
    await stick('R', 0.9, 0); await tick(3); await stick('R', 0, 0); await tick(1);
    const p0 = await seen(), dg = (a, b) => ((a - b + 540) % 360) - 180;
    if (noMove(p0.travel) || dist(p0.head, [0, 1.6, 0]) < 0.3 || Math.abs(dg(p0.yaw, 0) + 30) > 0.5) bad.push('not moved and turned before the room is joined: ' + JSON.stringify({ travel: p0.travel, head: p0.head, yaw: p0.yaw }));
    await wp.waitForTimeout(500);
    await wp.evaluate(() => { const C = HOST.collab; window.__room = { joined: Object.getOwnPropertyDescriptor(C, 'joined'), code: Object.getOwnPropertyDescriptor(C, 'code'), here: C.here };
      window.__code = 'WLK'; Object.defineProperty(C, 'joined', { get: () => true, configurable: true }); Object.defineProperty(C, 'code', { get: () => window.__code, configurable: true });
      window.__here = false; C.here = () => window.__here === true; });
    try {
      await tick(2);
      const e0 = await seen();
      if (e0.why !== '' || !e0.walking || !noMove(e0.travel) || dist(e0.head, [0, 1.6, 0]) > 1e-6 || Math.abs(e0.yaw) > 1e-3) bad.push('a shared room joined, elsewhere: ' + JSON.stringify({ why: e0.why, walking: e0.walking, travel: e0.travel, head: e0.head, yaw: e0.yaw }) + ' (want it applying, the travel gone: back where you stand)');
      await stick('L', 0, -1); await tick(60); await stick('L', 0, 0); await tick(1);
      const e1 = await seen();
      if (dist(e1.head, [0, 1.6, -1.5]) > 0.05) bad.push('elsewhere in a room, forward for a second: the head at ' + e1.head.map(v => v.toFixed(3)) + ', not 0, 1.6, -1.5');
      await stick('R', 0.9, 0); await tick(3); await stick('R', 0, 0); await tick(1);
      const e2 = await seen();
      if (Math.abs(dg(e2.yaw, e1.yaw) + 30) > 0.5 || dist(e2.head, e1.head) > 1e-3) bad.push(`elsewhere in a room, a flick right: turned ${dg(e2.yaw, e1.yaw).toFixed(2)} degrees, moved ${dist(e2.head, e1.head).toFixed(4)} m`);
      const er = await row();
      if (er !== 'on') bad.push('elsewhere in a room, the menu\'s row is ' + er + ', not pressable');
      // another room joined while moved (WLK to WLB, still elsewhere): the travel gone again, back where you stand; then
      // moved and turned once more, so answering "In this room" below has travel to take back
      await wp.evaluate(() => { window.__code = 'WLB'; }); await tick(2);
      const b0 = await seen();
      if (b0.why !== '' || !b0.walking || !noMove(b0.travel) || dist(b0.head, [0, 1.6, 0]) > 1e-6 || Math.abs(b0.yaw) > 1e-3) bad.push('another room joined while moved: ' + JSON.stringify({ why: b0.why, walking: b0.walking, travel: b0.travel, head: b0.head, yaw: b0.yaw }) + ' (want the travel gone)');
      await stick('L', 0, -1); await tick(20); await stick('L', 0, 0); await stick('R', 0.9, 0); await tick(3); await stick('R', 0, 0); await tick(1);
      const b1 = await seen();
      if (noMove(b1.travel) || dist(b1.head, [0, 1.6, 0]) < 0.3 || Math.abs(dg(b1.yaw, 0) + 30) > 0.5) bad.push('in the other room, the sticks did not move and turn you: ' + JSON.stringify({ travel: b1.travel, head: b1.head, yaw: b1.yaw }));
      // answered "In this room": back where you stand, the sticks move nothing, two clicks say why, the row greyed
      await wp.waitForTimeout(500);
      await wp.evaluate(() => { window.__here = true; }); await tick(2);
      const h0 = await seen();
      await stick('L', 0, -1); await tick(20); await stick('L', 0, 0); await stick('R', 0.9, 0); await tick(2); await stick('R', 0, 0); await tick(1);
      const h1 = await seen();
      await click('L', 2);
      const hn = await note(), hr = await row(), hw = await wp.evaluate(() => HOST.xr.walk());
      if (h0.why !== 'room' || h0.walking || !noMove(h0.travel) || dist(h0.head, [0, 1.6, 0]) > 1e-6 || Math.abs(h0.yaw) > 1e-3) bad.push('in the room with the others: not back where you stand: ' + JSON.stringify({ why: h0.why, travel: h0.travel, head: h0.head, yaw: h0.yaw }));
      if (dist(h1.head, h0.head) > 1e-6 || Math.abs(h1.yaw - h0.yaw) > 1e-3 || !noMove(h1.travel)) bad.push('in the room with the others, the sticks moved you: ' + JSON.stringify([h0.head, h1.head, h1.travel]));
      if (hn !== 'Moving with the sticks: Not while you are in the room with the others: there you walk for real.' || !hw) bad.push(`in the room with the others, two clicks said '${hn}' and left it ${hw ? 'on' : 'off'}`);
      if (hr !== 'none') bad.push('in the room with the others, the menu\'s row is ' + hr + ', not greyed');
      // elsewhere again: it applies again, from where you really stand
      await wp.evaluate(() => { window.__here = false; }); await tick(1);
      await stick('L', 0, -1); await tick(20); await stick('L', 0, 0); await tick(1);
      const e3 = await seen();
      if (e3.why !== '' || dist(e3.head, h1.head) < 0.3) bad.push('elsewhere again, the stick did not move you: ' + JSON.stringify({ why: e3.why, head: [h1.head, e3.head] }));
    } finally {
      await wp.evaluate(() => { const C = HOST.collab, S = window.__room; Object.defineProperty(C, 'joined', S.joined); Object.defineProperty(C, 'code', S.code); C.here = S.here; });
    }
    await tick(1);
    // each place where it does not apply: the sticks move nothing, two clicks say why, the row greyed (none: no region)
    const cases = [
      ['AR', () => { window.__w.s.environmentBlendMode = 'alpha-blend'; HOST.mode = 'immersive-ar'; }, () => { window.__w.s.environmentBlendMode = 'opaque'; HOST.mode = 'immersive-vr'; }, 'ar', 'Not in AR'],
      ['a page with its own sticks', () => { HOST.cur.ownSticks = true; }, () => { delete HOST.cur.ownSticks; }, 'own', 'Not here'],
      // (a shared room's with an older shared.js, which says nothing of here(): any room, as before v128)
      ['a shared room, an older shared.js', () => { window.__joined = Object.getOwnPropertyDescriptor(HOST.collab, 'joined'); window.__hereFn = HOST.collab.here; delete HOST.collab.here; Object.defineProperty(HOST.collab, 'joined', { get: () => true, configurable: true }); },
        () => { Object.defineProperty(HOST.collab, 'joined', window.__joined); HOST.collab.here = window.__hereFn; }, 'room', 'Not while you are in the room with the others'],
    ];
    for (const [where, on, off, why, says] of cases) {
      await wp.waitForTimeout(500);
      const a = await seen();
      await wp.evaluate(on); await tick(1);
      await stick('L', 0, -1); await tick(20); await stick('L', 0, 0); await stick('R', 0.9, 0); await tick(2); await stick('R', 0, 0); await tick(1);
      const b = await seen();
      await click('L', 2);
      const n = await note(), r = await row(), w = await wp.evaluate(() => HOST.xr.walk());
      await wp.evaluate(off); await tick(1);
      const room = where.startsWith('a shared room');
      if (b.why !== why || b.walking) bad.push(`${where}: walkWhy '${b.why}', walking ${b.walking}`);
      if (room ? (b.travel.space || b.travel.x || b.travel.z || b.travel.yaw || dist(b.head, [0.0, 1.6, 0]) > 1e-6) : dist(b.head, a.head) > 1e-6 || Math.abs(b.yaw - a.yaw) > 1e-3)
        bad.push(`${where}: ${room ? 'not back where you stand' : 'the sticks moved you'}: ` + JSON.stringify([a.head, b.head, b.travel]));
      if (!n.startsWith('Moving with the sticks: ' + says) || !w) bad.push(`${where}: two clicks said '${n}' and left it ${w ? 'on' : 'off'}`);
      if (r !== 'none') bad.push(`${where}: the menu's row is ${r}, not greyed`);
    }
    await wp.evaluate(() => HOST.collab.panelOpen(false));
    // the studio switches its sticks with the setting (its returned object's sticks, in its own words), never ownSticks
    if (!await wp.evaluate(async () => { const t = await (await fetch('stories/studio.js')).text(); return /\n {2}sticks: \{\n {4}say: on => /.test(t) && /\n {4}note: '/.test(t) && !/\n {2}ownSticks: /.test(t); })) bad.push('the studio does not say sticks: { say, note } (or still says ownSticks)');
    // a link
    await openW('qubits', '&walk=off');
    const l1 = await wp.evaluate(() => HOST.xr.walk());
    await openW('qubits', '&walk=on');
    const l2 = await wp.evaluate(() => [HOST.xr.walk(), HOST.xr.walking()]);
    if (l1 || !l2[0] || !l2[1]) bad.push('#walk=off then on: ' + JSON.stringify([l1, l2]));
    await wp.evaluate(() => { try { localStorage.removeItem('xrWalk'); } catch (e) { /* storage blocked */ } });
    if (bad.length) errors.push(...bad.map(b => 'stick moving: ' + b));
  });

  // the studio (v125; the owner, 8 November 2026: "i want stick movement in studio mode too, just make it switchable with
  // the double stick click"): a stick clicked twice (the same setting, HOST.xr.walk) switches its sticks between its own
  // (walk, turn, steer what you carry) and moving you, also while something is carried, which comes along in the hand. The
  // studio moves you itself (its scene, XR.walk, as its own walk does), in a shared room too, so the shell's travel stays
  // as it is. The test scene, editing on; the pretend controllers pointing down at the floor in front, placed each frame
  // where the frame puts them, as three.js would
  const STU_HASH = '&scenes=tools/studio/test/scenes&scene=test&edit';
  const stuOpen = async () => {
    await openW('studio', STU_HASH, 'typeof STUDIO !== "undefined" && STUDIO.ready() && STU.items.has("box001") && !!STU.items.get("box001").model');
    await sx(`(() => { APP.enterExplore(); setEdit(true);
      const W = window.__w, V = THREE.Vector3, Q = THREE.Quaternion, M = THREE.Matrix4, down = new Q().setFromAxisAngle(new V(1, 0, 0), -Math.PI / 2);
      W.real.set(W.L.targetRaySpace, new M().compose(new V(-0.2, 1.1, -0.3), down, new V(1, 1, 1)));
      W.real.set(W.R.targetRaySpace, new M().compose(new V(0.2, 1.1, -0.3), down, new V(1, 1, 1)));
      XR.ctrls[0].src = W.L; XR.ctrls[1].src = W.R; XR.ctrls[0].g.visible = XR.ctrls[1].g.visible = true;
      W.pre = f => { for (const c of XR.ctrls.slice(0, 2)) { const p = c.src && f.getPose(c.src.targetRaySpace, W.ref); if (p) { c.g.matrix.fromArray(p.transform.matrix); c.g.matrixWorld.copy(c.g.matrix); } } };
      return 0; })()`);
    await tick(3);
  };
  // XR.walk, the head in the scene's frame (where you are in it) and its yaw there (degrees, turning left positive), the
  // box's place in three.js's space and in the scene and its yaw there, the right hand's place, the carry's reach, size
  // and turn, the sticks' mode (stickMode) and the card's line under Carry it
  const stuSeen = () => sx(`(() => { const it = STU.items.get('box001'), c = XR.ctrls[1], g = c.grab, B = [], V = THREE.Vector3; holdBlocks(it, B, false);
    GL.scene.updateMatrixWorld(true);
    const wq = GL.world.getWorldQuaternion(new THREE.Quaternion()).invert(), fw = new V(0, 0, -1).applyQuaternion(XR.headQ).applyQuaternion(wq);
    const bq = it.holder.getWorldQuaternion(new THREE.Quaternion()).premultiply(wq), bf = new V(0, 0, -1).applyQuaternion(bq);
    return { walk: [XR.walk.x, XR.walk.z, XR.walk.yaw], hs: GL.world.worldToLocal(XR.head.clone()).toArray(), hy: Math.atan2(-fw.x, -fw.z) * 180 / Math.PI,
      box: it.holder.getWorldPosition(new V()).toArray(), boxP: GL.world.worldToLocal(it.holder.getWorldPosition(new V())).toArray(), by: Math.atan2(-bf.x, -bf.z) * 180 / Math.PI,
      hand: new V().setFromMatrixPosition(c.g.matrix).toArray(), grab: g ? [g.target, g.id, g.reach, g.kz, g.sth] : null, mode: stickMode(),
      card: B.map(b => b.p || '').join(' | ') }; })()`);
  const grabBox = on => sx(on ? `(XR.ctrls[1].hover = { kind: 'item', id: 'box001' }, xrGrab(XR.ctrls[1], true), window.__w.R.gamepad.buttons[1].pressed = true, window.__w.s.fire('squeezestart', { inputSource: window.__w.R }), XR.ctrls[1].grab ? XR.ctrls[1].grab.id : '')`
    : `(xrGrab(XR.ctrls[1], false), window.__w.R.gamepad.buttons[1].pressed = false, window.__w.s.fire('squeezeend', { inputSource: window.__w.R }), 0)`);
  // the menu's Moving with the sticks row (Settings): pressable, greyed or none
  const rowOK = async () => {
    await wp.evaluate(() => { HOST.collab.panelOpen(true); HOST.collab.menuTab('settings'); });
    await tick(2);
    return wp.evaluate(() => { const r = HOST.collab.menuFind('walk'); HOST.collab.panelOpen(false); return r ? (r.fn ? 'on' : 'greyed') : 'none'; });
  };
  const rel = u => u.box.map((v, k) => v - u.hand[k]), dg = (x, y) => ((x - y + 540) % 360) - 180, flat = a => [a[0], 0, a[2]];
  const noTravel = t => !t.space && !t.x && !t.z && !t.yaw;
  // the studio's sticks, one way and the other, at the pretend headset as it stands (outside a room, or at a pretend
  // station): its own walk, two clicks to moving you (its words; nothing jumps), the left stick 1.5 m through the scene,
  // a flick right 30 degrees about the head, a carried box not steered but coming along in the hand (also through a
  // turn), two clicks back (nothing jumps), the box steered again; the shell's travel never moving; bad gathers what failed
  const stuBothWays = async (bad, where) => {
    await wp.evaluate(() => { HOST.xr.setWalk(false); });
    await tick(2);
    const w0 = await wp.evaluate(() => [HOST.xr.walk(), HOST.xr.walkWhy(), HOST.xr.walking(), HOST.xr.walkSelf(), typeof (HOST.cur.sticks && HOST.cur.sticks.say)]);
    if (w0[0] || w0[1] !== '' || w0[2] || w0[3] || w0[4] !== 'function') bad.push(where + ': the studio\'s sticks to start with: ' + JSON.stringify(w0) + ' (want off, why \'\', not walking, its sticks said)');
    const row0 = await rowOK();
    if (row0 !== 'on') bad.push(where + ': the menu\'s row in the studio is ' + row0 + ', not pressable');
    // its own: the left stick walks you through the scene (XR.walk), the shell moves nothing
    const a0 = await seen(), u0 = await stuSeen();
    await stick('L', 0, -1); await tick(60); await stick('L', 0, 0); await tick(1);
    const a1 = await seen(), u1 = await stuSeen();
    if (u1.mode !== 'own' || Math.abs(dist(flat(u1.hs), flat(u0.hs)) - 1.5) > 0.03 || dist(a1.head, a0.head) > 1e-6 || !noTravel(a1.travel)) bad.push(where + ': the studio\'s own walk: ' + JSON.stringify({ mode: u1.mode, hs: [u0.hs, u1.hs], head: [a0.head, a1.head], travel: a1.travel }));
    if (!/^Sticks: the studio's\. Carried, the sticks steer it: .*Click a stick twice to move with them instead\.$/.test(u1.card.split(' | ').pop())) bad.push(where + ': the card under Carry it, the studio\'s: ' + u1.card);
    // clicked twice: moving you, its words; nothing jumps
    await click('L', 2);
    const n1 = await note(), a2 = await seen(), u2 = await stuSeen();
    if (!(await wp.evaluate(() => HOST.xr.walk() && HOST.xr.walkSelf())) || n1 !== 'Sticks: moving you: Left stick: move. Right stick: turn. Click a stick twice for the studio\'s.') bad.push(where + ': clicked twice: ' + n1);
    if (u2.mode !== 'move' || !a2.walking || dist(a2.head, a1.head) > 1e-6 || dist(u2.walk, u1.walk) > 1e-9) bad.push(where + ': switching to moving moved something: ' + JSON.stringify({ mode: u2.mode, head: [a1.head, a2.head], walk: [u1.walk, u2.walk] }));
    if (!/^Sticks: moving you\. Carried, it comes along/.test(u2.card.split(' | ').pop())) bad.push(where + ': the card under Carry it, moving: ' + u2.card);
    if (await rowOK() !== 'on') bad.push(where + ': the menu\'s row, moving: greyed');
    // moving: the left stick 1.5 m through the scene in a second where the head faces, the right a 30 degree flick about
    // the head; three.js's head and the shell's travel as they were (the studio moves its scene)
    await stick('L', 0, -1); await tick(60); await stick('L', 0, 0); await tick(1);
    const a3 = await seen(), u3 = await stuSeen(), y2 = u2.hy * Math.PI / 180, fw = [-Math.sin(y2) * 1.5, 0, -Math.cos(y2) * 1.5];
    if (dist(flat(u3.hs), flat(u2.hs).map((v, k) => v + fw[k])) > 0.05 || dist(a3.head, a2.head) > 1e-6 || !noTravel(a3.travel)) bad.push(where + ': moving, the left stick: ' + JSON.stringify({ hs: [u2.hs, u3.hs], hy: u2.hy, head: [a2.head, a3.head], travel: a3.travel }));
    await stick('R', 0.9, 0); await tick(3); await stick('R', 0, 0); await tick(1);
    const u4 = await stuSeen();
    if (Math.abs(dg(u4.hy, u3.hy) + 30) > 0.5 || dist(flat(u4.hs), flat(u3.hs)) > 1e-3) bad.push(`${where}: moving, a flick right: turned ${dg(u4.hy, u3.hy).toFixed(2)} degrees in the scene and moved ${dist(flat(u4.hs), flat(u3.hs)).toFixed(4)} m (not -30 about the head)`);
    // the box carried (the grip held, as the shell hears it): the left stick moves you all the same, the right stick up
    // pushes nothing; the box stays in the hand, so it comes along through the scene; a flick turns it with you
    const g0 = await grabBox(true); await tick(2);
    const u5 = await stuSeen();
    await stick('L', 0, -1); await stick('R', 0, -1); await tick(60); await stick('L', 0, 0); await stick('R', 0, 0); await tick(2);
    const u6 = await stuSeen();
    if (g0 !== 'box001') bad.push(where + ': the grip did not take the box');
    if (Math.abs(dist(flat(u6.hs), flat(u5.hs)) - 1.5) > 0.05) bad.push(where + ': carrying, the left stick did not move you 1.5 m through the scene: ' + dist(flat(u6.hs), flat(u5.hs)).toFixed(3));
    if (!u6.grab || u6.grab[2] !== 1 || u6.grab[3] !== 1 || u6.grab[4] !== 0) bad.push(where + ': moving, the sticks steered the box: ' + JSON.stringify(u6.grab));
    if (dist(rel(u6), rel(u5)) > 1e-3 || Math.abs(dist(u6.boxP, u5.boxP) - 1.5) > 0.05) bad.push(where + ': the box did not come along in the hand: ' + JSON.stringify({ rel: [rel(u5), rel(u6)], scene: [u5.boxP, u6.boxP] }));
    await stick('R', 0.9, 0); await tick(3); await stick('R', 0, 0); await tick(2);
    const u7 = await stuSeen();
    if (dist(rel(u7), rel(u6)) > 1e-3 || Math.abs(dg(u7.by, u6.by) + 30) > 0.5) bad.push(`${where}: carrying, a flick right: the box ${dist(rel(u7), rel(u6)).toFixed(4)} m from where the hand holds it, turned ${dg(u7.by, u6.by).toFixed(2)} degrees in the scene (not -30 with you)`);
    // clicked twice again (still carrying): the studio's, its words; nothing jumps; the right stick up pushes the box away
    await click('L', 2);
    const n2 = await note(), a8 = await seen(), u8 = await stuSeen();
    if (await wp.evaluate(() => HOST.xr.walk()) || n2 !== 'Sticks: the studio\'s: Walk, turn, steer what you carry. Click a stick twice to move with them.') bad.push(where + ': clicked twice again: ' + n2);
    if (u8.mode !== 'own' || dist(u8.walk, u7.walk) > 1e-9 || dist(u8.box, u7.box) > 1e-6 || !noTravel(a8.travel)) bad.push(where + ': switching back moved something: ' + JSON.stringify({ walk: [u7.walk, u8.walk], box: [u7.box, u8.box], travel: a8.travel }));
    await stick('R', 0, -1); await tick(30); await stick('R', 0, 0); await tick(1);
    const u9 = await stuSeen();
    if (!u9.grab || !(u9.grab[2] > 2) || dist(u9.walk, u8.walk) > 1e-9) bad.push(where + ': the studio\'s sticks again: the reach ' + (u9.grab && u9.grab[2]) + ', XR.walk ' + JSON.stringify([u8.walk, u9.walk]));
    await grabBox(false); await tick(1);
    await sx('(() => { while (UNDO.length) undo(); return 0; })()');
  };

  await step('stick moving: in the studio a stick clicked twice switches its sticks (its words, the row pressable): its own walk, then moving you through the scene (the left stick 1.5 m, the right a 30 degree flick, the shell\'s travel still); a carried box not steered but coming along in the hand; switched back, steering again; no jump either way; Recenter back where you stand', async () => {
    const bad = [];
    await stuOpen();
    await wp.evaluate(() => HOST.xr.walkReset());
    await stuBothWays(bad, 'outside a room');
    // Recenter: back where you stand in the scene (XR.walk none)
    await sx('(xrRecenterAsk(), 0)'); await tick(2);
    const r = await stuSeen();
    if (r.walk.some(v => Math.abs(v) > 1e-9)) bad.push('Recenter did not take the walk back: ' + JSON.stringify(r.walk));
    if (bad.length) errors.push(...bad.map(b => 'stick moving: ' + b));
  });

  await step('stick moving: the studio at a pretend station in a shared room: the same both ways (moving applies there, the row pressable, the shell\'s travel still, the others seeing you where you really stand), the scene on the room\'s frame; Recenter there takes the walk back; in AR two clicks say why', async () => {
    const bad = [];
    if (!await wp.evaluate(() => HOST.curKey === 'studio' && !!window.__wtick)) await stuOpen();
    // a pretend station: joined, at the studio's circle (its spot 1 m to the right and 2 m ahead, turned 0.5 rad), the
    // room's frame the renderer's space, grips free, the station's Recenter answered
    await wp.evaluate(() => {
      const R = HOST.room, S = window.__stub = { joined: Object.getOwnPropertyDescriptor(HOST.collab, 'joined'), live: HOST.collab.live, frame: HOST.anchor.frame, room: { inRoom: R.inRoom, away: R.away, placing: R.placing, gripLocked: R.gripLocked, matrix: R.matrix, recenter: R.recenter } };
      Object.defineProperty(HOST.collab, 'joined', { get: () => true, configurable: true });
      HOST.collab.live = () => ({ id: 'st9', story: 'studio' });
      HOST.anchor.frame = () => ({ p: [1, 1.6, -2], yaw: 0.5, room: true });
      Object.assign(HOST.room, { inRoom: () => true, away: () => false, placing: () => true, gripLocked: () => false, matrix: () => new THREE.Matrix4(), recenter: () => { window.__recentered = (window.__recentered || 0) + 1; return true; } });
      HOST.xr.walkReset();
    });
    try {
      await tick(3);
      const st = await sx('[XR.atSt, XR.inRoom, xrAway(), GL.rig.position.toArray()]'), w = await wp.evaluate(() => [HOST.xr.walkWhy(), HOST.xr.travel()]);
      if (!st[0] || !st[1] || st[2] || dist(st[3], [1, 1.6, -2]) > 1e-6) bad.push('the pretend station: ' + JSON.stringify(st));
      if (w[0] !== '' || !noTravel(w[1])) bad.push('in a room: ' + JSON.stringify(w) + ' (want why \'\', no travel)');
      await stuBothWays(bad, 'at a station');
      // Recenter there: the station's (for everyone at its circle), and this headset's walk back
      await wp.evaluate(() => HOST.xr.setWalk(true));
      await stick('L', 0, -1); await tick(20); await stick('L', 0, 0); await tick(1);
      const r0 = await stuSeen();
      await sx('(xrRecenterAsk(), 0)'); await tick(2);
      const r1 = await stuSeen(), rc = await wp.evaluate(() => window.__recentered || 0);
      if (!r0.walk.some(v => Math.abs(v) > 0.1) || r1.walk.some(v => Math.abs(v) > 1e-9) || rc !== 1) bad.push('Recenter at the station: ' + JSON.stringify({ before: r0.walk, after: r1.walk, station: rc }));
      // in AR: two clicks say why, and nothing changes
      await wp.waitForTimeout(500);
      await wp.evaluate(() => { HOST.xr.setWalk(false); window.__w.s.environmentBlendMode = 'alpha-blend'; HOST.mode = 'immersive-ar'; });
      await click('L', 2);
      const n2 = await note(), w2 = await wp.evaluate(() => [HOST.xr.walk(), HOST.xr.walkWhy()]);
      await wp.evaluate(() => { window.__w.s.environmentBlendMode = 'opaque'; HOST.mode = 'immersive-vr'; });
      if (!n2.startsWith('Moving with the sticks: Not in AR') || w2[0] || w2[1] !== 'ar') bad.push('in AR: ' + JSON.stringify([n2, w2]));
    } finally {
      await wp.evaluate(() => { const S = window.__stub; Object.defineProperty(HOST.collab, 'joined', S.joined); HOST.collab.live = S.live; HOST.anchor.frame = S.frame; Object.assign(HOST.room, S.room); HOST.xr.setWalk(false); });
      await sx('(() => { while (UNDO.length) undo(); return 0; })()');
    }
    if (bad.length) errors.push(...bad.map(b => 'stick moving: ' + b));
  });

  // the same lines in every story and every page in STORY_EXTRA: the helper beside xrSig, the explore stick waiting on it,
  // and no story playing or pausing on A or X (button 4)
  await step('stick moving: every story keeps the xrWalking line; none plays or pauses on A or X', async () => {
    const miss = await wp.evaluate(async keys => (await Promise.all(keys.map(async k => {
      const t = await (await fetch('stories/' + k + '.js')).text(), why = [];
      if (!t.includes('const xrWalking = () => !!(HOST.xr && HOST.xr.walking && HOST.xr.walking());')) why.push('no xrWalking line');
      if (/APP\.mode === 'explore' && !c\.press && !c\.grab(?! && !xrWalking\(\))/.test(t)) why.push('an explore stick not waiting on it');
      if (t.includes('buttons[4]')) why.push('button 4 still read');
      return why.length ? k + ': ' + why.join(', ') : '';
    }))).filter(Boolean), [...STORY_KEYS, ...EXTRA]);
    if (miss.length) errors.push('stick moving: ' + miss.join('; '));
  });
  await wp.close();
}
// Real-world occlusion in AR (HOST.occlusion, occlusion.js) with a pretend AR headset (its frames driven by the test
// through three.js r128's own WebXR path), its depth a real WebGL2 texture array made in the page, a new one each frame
// (window depth with no far plane, 1 - 0.1 / metres, as a Quest 3 gives it; near on the left half of each eye, far on
// the right), and a pretend room scan (a wall 0.6 m ahead on the left). A magenta test plane 0.8 m ahead in the story's
// scene, read back from the layer's own framebuffer: hidden where the real world is nearer, drawn where it is farther,
// in both eyes; the room's wall hiding what stands behind it; the menu never hidden; the setting's default 'both', the
// menu's row going round, #occl=off, a story's own (cleared with the story), a story change in the session; the
// session's request (depth sensing asked for in AR, the ladder: a TypeError naming 'unsigned-short' asked again without
// it, another refusal without depth) and VR as ever; the new session line in every story
function OCCL_FAKE() {
  const ident = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const tr = (x, y, z) => { const m = ident(); m[12] = x; m[13] = y; m[14] = z; return m; };
  const rotX = (a, x, y, z) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, x, y, z, 1]); };
  const persp = (fov, asp, n, f) => { const t = 1 / Math.tan(fov * Math.PI / 360); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); };
  const DW = 64, DH = 64, WN = 0.1;
  const F = window.__occl = { o: { refuseUS: false, failDepth: false, cpu: false }, session: null, time: 0, tex: null, texFrame: -1, frameNo: 0, made: 0, near: 0.5, far: 4, drop: null, inits: [], pauses: 0, resumes: 0 };
  const toWin = m => 1 - WN / m;   // (a depth buffer's value with no far plane)
  const pose = m => ({ transform: { matrix: m, position: { x: m[12], y: m[13], z: m[14], w: 1 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } });
  // a wall 0.6 m ahead, from 3 m to the left to the middle, from the floor (1.6 m down) to 1 m above the eyes
  const planes = new Set([{ planeSpace: { matrix: rotX(Math.PI / 2, 0, -1.6, -0.6) }, polygon: [{ x: -3, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -2.6 }, { x: -3, y: 0, z: -2.6 }], orientation: 'vertical', semanticLabel: 'wall', lastChangedTime: 1 }]);
  const space = o => Object.assign({ addEventListener() {}, removeEventListener() {} }, o);
  class Session extends EventTarget {
    constructor(mode, feats) {
      super(); this.mode = mode; this.renderState = { depthNear: 0.1, depthFar: 1000, baseLayer: null }; this.inputSources = []; this.visibilityState = 'visible';
      this.environmentBlendMode = mode === 'immersive-ar' ? 'alpha-blend' : 'opaque'; this.enabledFeatures = feats; this.cbs = new Map(); this.n = 0;
      if (feats.includes('depth-sensing')) { this.depthUsage = F.o.cpu ? 'cpu-optimized' : 'gpu-optimized'; this.depthDataFormat = 'float32'; }
    }
    updateRenderState(s) { Object.assign(this.renderState, s); }
    async requestReferenceSpace(type) { return space({ type, floor: type === 'local-floor' }); }
    requestAnimationFrame(cb) { const id = ++this.n; this.cbs.set(id, cb); return id; }
    cancelAnimationFrame(id) { this.cbs.delete(id); }
    pauseDepthSensing() { F.pauses++; }
    resumeDepthSensing() { F.resumes++; }
    async end() { if (this.ended) return; this.ended = true; this.dispatchEvent(new Event('end')); }
  }
  // (taken for a headset's session, whose listeners outlive a story, as three.js's own do on a real one)
  window.XRSession = Session;
  WebGL2RenderingContext.prototype.makeXRCompatible = function () { return Promise.resolve(); };
  window.XRWebGLLayer = class { constructor(s, gl) {
    // a framebuffer of its own, as a headset's layer has (colour and depth)
    const W = this.framebufferWidth = gl.drawingBufferWidth, H = this.framebufferHeight = gl.drawingBufferHeight;
    const pf = gl.getParameter(gl.FRAMEBUFFER_BINDING), pr = gl.getParameter(gl.RENDERBUFFER_BINDING), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    for (const [fmt, att] of [[gl.RGBA8, gl.COLOR_ATTACHMENT0], [gl.DEPTH24_STENCIL8, gl.DEPTH_STENCIL_ATTACHMENT]]) {
      const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, fmt, W, H);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, att, gl.RENDERBUFFER, rb);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, pf); gl.bindRenderbuffer(gl.RENDERBUFFER, pr);
    this.framebuffer = fb; this.antialias = true; }
    getViewport(v) { const w = this.framebufferWidth / 2; return { x: v.eye === 'left' ? 0 : w, y: 0, width: w, height: this.framebufferHeight }; } };
  window.XRWebGLBinding = class {
    constructor(s, gl) { this.s = s; this.gl = gl; }
    getDepthInformation(view) {
      if (!this.s.depthUsage) throw new DOMException('Depth sensing is not enabled for this session', 'InvalidStateError');
      if (F.drop === view.eye) return null;
      if (F.texFrame !== F.frameNo) {   // a new real texture array each frame (window depth), the last one taken back
        const gl = this.gl, prev = gl.getParameter(gl.TEXTURE_BINDING_2D_ARRAY), fy = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL), pm = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
        const t = gl.createTexture(), d = new Float32Array(DW * DH * 2);
        for (let l = 0; l < 2; l++) for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) d[l * DW * DH + y * DW + x] = toWin(x < DW / 2 ? F.near : F.far);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R32F, DW, DH, 2, 0, gl.RED, gl.FLOAT, d);   // (its filter left as made: the shell sets nearest)
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, prev); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, fy); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, pm);
        if (F.tex) gl.deleteTexture(F.tex);
        F.tex = t; F.texFrame = F.frameNo; F.made++;
      }
      return { texture: F.tex, textureType: 'texture-array', imageIndex: view.eye === 'left' ? 0 : 1, width: DW, height: DH, rawValueToMeters: 1,
        normDepthBufferFromNormView: { matrix: ident() }, depthNear: WN, depthFar: Infinity };
    }
  };
  const views = [-0.032, 0.032].map((x, i) => ({ eye: i ? 'right' : 'left', projectionMatrix: persp(90, 1, 0.05, 100), transform: { matrix: tr(x, 0, 0), position: { x, y: 0, z: 0, w: 1 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } }));
  F.frame = () => ({
    session: F.session,
    getViewerPose: () => Object.assign(pose(ident()), { views }),
    getPose: s => (s && s.floor ? pose(tr(0, -1.6, 0)) : s && s.matrix ? pose(s.matrix) : null),
    detectedPlanes: planes, detectedMeshes: new Set(),
    // CPU depth (a phone's): metres in an array of its own, rows from the top
    getDepthInformation: v => {
      if (F.session.depthUsage !== 'cpu-optimized') throw new DOMException('Depth sensing is not enabled for the CPU', 'InvalidStateError');
      if (F.drop === v.eye) return null;
      const d = new Float32Array(DW * DH); for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) d[y * DW + x] = x < DW / 2 ? F.near : F.far;
      return { data: d.buffer, width: DW, height: DH, rawValueToMeters: 1, normDepthBufferFromNormView: { matrix: ident() } };
    },
  });
  F.step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      F.time += 1000 / 72; F.frameNo++;
      const cbs = [...F.session.cbs.values()]; F.session.cbs.clear();
      const fr = F.frame();
      for (const cb of cbs) cb(F.time, fr);
    }
  };
  // pixels of the layer's own framebuffer right after a frame: [eye, x, y], fractions of that eye's viewport from its
  // bottom left
  F.look = (pts, frames = 2) => {
    F.step(frames);
    const gl = HOST.renderer.getContext(), L = F.session.renderState.baseLayer, W = L.framebufferWidth, H = L.framebufferHeight, out = new Uint8Array(4), prev = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    gl.bindFramebuffer(gl.FRAMEBUFFER, L.framebuffer);
    const px = pts.map(([eye, x, y]) => { gl.readPixels(Math.floor((eye * 0.5 + x * 0.5) * W), Math.floor(y * H), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out); return Array.from(out); });
    gl.bindFramebuffer(gl.FRAMEBUFFER, prev);
    return px;
  };
  Object.defineProperty(navigator, 'xr', { configurable: true, value: {
    isSessionSupported: async () => true, addEventListener() {}, removeEventListener() {},
    requestSession: async (mode, init) => {
      const ds = init.depthSensing;
      F.inits.push(JSON.parse(JSON.stringify({ mode, init })));
      if (F.o.refuseUS && ds && ds.dataFormatPreference.includes('unsigned-short')) throw new TypeError(`Failed to read the 'dataFormatPreference' property from 'XRDepthStateInit': The provided value 'unsigned-short' is not a valid enum value of type XRDepthDataFormat.`);
      if (F.o.failDepth && ds) throw new DOMException('The requested session configuration is not supported', 'NotSupportedError');
      let feats = (init.optionalFeatures || []).slice();
      if (!ds) feats = feats.filter(f => f !== 'depth-sensing');
      const s = new Session(mode, ['viewer', 'local', ...feats]);
      if (!F.session || F.session.ended) F.session = s;
      return s;
    } } });
}
if (runs('occlusion')) {
  const step = (name, fn) => smokeStep(name, async () => { try { await fn(); } catch (e) { errors.push(name + ': ' + (e.stack || e.message)); } });
  const ctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
  const op = await ctx.newPage();
  op.on('pageerror', e => errors.push('occlusion: ' + (e.stack || e.message)));
  op.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('occlusion: ' + m.text()); });
  await op.addInitScript(OCCL_FAKE);
  const ready = k => op.waitForFunction(k => HOST.curKey === k && HOST.cur && HOST.cur.collab.scene(), k, { timeout: 30000 });
  // the magenta test plane, 1.2 m by 0.8 m, 0.8 m ahead in the story's scene (its root is the headset's space)
  const plane = () => op.evaluate(() => { const sc = HOST.cur.collab.scene(), m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshBasicMaterial({ color: 0xff00ff, toneMapped: false, fog: false }));
    m.position.set(0, 0, -0.8); m.name = 'occlusion test'; sc.add(m); return 0; });
  // the plane on the left and the right of each eye's middle, above the eyes (clear of the notice and the menu)
  const PTS = [[0, 0.3, 0.62], [0, 0.7, 0.62], [1, 0.3, 0.62], [1, 0.7, 0.62]];
  const mag = px => px[0] > 200 && px[1] < 70 && px[2] > 200 && px[3] > 200;
  const shows = async (what, want, frames) => {
    const px = await op.evaluate(([pts, n]) => window.__occl.look(pts, n), [PTS, frames || 3]), got = px.map(mag).map(b => (b ? 1 : 0)).join('');
    if (got !== want) errors.push(`occlusion: ${what}: the plane shows ${got} (left and right of each eye), not ${want}: ` + JSON.stringify(px));
  };
  const st = () => op.evaluate(() => HOST.occlusion.state());
  await step('occlusion: on by default (room and people)', async () => {
    await op.goto(base + 'index.html#airports&labels=hidden&cards=hidden');
    await ready('airports');
    const s0 = await op.evaluate(() => [HOST.occlusion.own(), HOST.occlusion.mode(), HOST.occlusion.over(), localStorage.getItem('xrOccl')]);
    if (s0.join() !== 'both,both,,') errors.push('occlusion: the default is ' + JSON.stringify(s0));
  });
  await step('occlusion: AR asks for depth sensing (GPU first, unsigned-short first, the depth seen from the eye)', async () => {
    await op.evaluate(() => HOST.cur.peek('xrStart("immersive-ar")'));
    await op.waitForFunction(() => window.__occl.session && window.__occl.session.cbs.size && HOST.session === window.__occl.session, null, { timeout: 20000 });
    await op.evaluate(() => window.__occl.step(4));
    const r = await op.evaluate(() => window.__occl.inits);
    const ds = r[0] && r[0].init.depthSensing, f = r[0] && r[0].init.optionalFeatures;
    if (r.length !== 1 || !ds || ds.usagePreference.join() !== 'gpu-optimized,cpu-optimized' || ds.dataFormatPreference.join() !== 'unsigned-short,luminance-alpha,float32' || ds.matchDepthView !== true)
      errors.push('occlusion: the AR request: ' + JSON.stringify(r));
    const want = await op.evaluate(() => HOST.xr.features('immersive-ar').concat('depth-sensing').join());   // (a desktop's page: no phone's overlay)
    if (!f || f.join() !== want) errors.push('occlusion: the AR features: ' + f + ' (want ' + want + ')');
  });
  await step('occlusion: people (depth): the plane hidden where the real world is nearer, drawn where it is farther, both eyes; read as a depth buffer\'s', async () => {
    await plane();
    await op.evaluate(() => HOST.occlusion.set('depth'));
    await shows('depth, near on the left', '0101');
    const s = await st();
    if (!s.quad || s.roomShown || !s.inScene || s.paused || !s.depth || !s.depth.enabled || s.depth.used !== 'window' || !s.depth.decided || s.depth.eyes.join() !== 'true,true' || !(s.depth.probe && s.depth.probe.buf))
      errors.push('occlusion: depth state ' + JSON.stringify(s));
    await op.evaluate(() => { window.__occl.near = 4; window.__occl.far = 0.5; });
    await shows('depth, near on the right', '1010');
    // an eye without depth this frame: nothing hidden in it
    await op.evaluate(() => { window.__occl.near = 0.5; window.__occl.far = 4; window.__occl.drop = 'right'; });
    await shows('the right eye without depth', '0111');
    await op.evaluate(() => { window.__occl.drop = null; });
    // nearer than the plane but by less than the bias: not hidden (a thing standing on a real surface)
    await op.evaluate(() => { window.__occl.near = 0.78; });
    await shows('the real world 2 cm nearer than the plane', '1111');
    await op.evaluate(() => { window.__occl.near = 0.5; });
  });
  await step('occlusion: room: the scan\'s wall hides what stands behind it, depth never paused (v124); off: nothing hidden; both: both', async () => {
    const p0 = await op.evaluate(() => window.__occl.pauses);
    await op.evaluate(() => { HOST.occlusion.set('room'); window.__occl.near = window.__occl.far = 4; });
    await shows('room, the wall on the left', '0101');
    const s = await st(), p1 = await op.evaluate(() => window.__occl.pauses);
    if (s.quad || !s.roomShown || s.paused || !s.room || s.room.planes !== 1 || s.room.built < 1 || p1 !== p0) errors.push('occlusion: room state ' + JSON.stringify(s) + ' pauses ' + p0 + ' -> ' + p1);
    await op.evaluate(() => { HOST.occlusion.set('off'); window.__occl.near = window.__occl.far = 0.5; });
    await shows('off, the real world near everywhere', '1111');
    if ((await st()).root) errors.push('occlusion: off still draws its objects');
    await op.evaluate(() => { HOST.occlusion.set('both'); window.__occl.near = 4; window.__occl.far = 0.5; });
    await shows('both: the wall on the left, people on the right', '0000');
    const r = await op.evaluate(() => [window.__occl.pauses, window.__occl.resumes]);
    if (r[0] || r[1]) errors.push('occlusion: depth sensing paused or resumed (it runs for the whole session since v124): ' + r);
  });
  await step('occlusion: the menu is never hidden (the real world nearer everywhere)', async () => {
    await op.evaluate(() => { window.__occl.near = window.__occl.far = 0.3; HOST.collab.panelOpen(true); HOST.collab.menuTab('settings'); });
    await op.evaluate(() => window.__occl.step(4));
    const at = await op.evaluate(() => {   // the menu's middle in the left eye (90 degree views, the eye 3.2 cm to the left)
      const m = HOST.collab.overlay().panel.mesh, p = m.getWorldPosition(new THREE.Vector3());
      return [0, 0.5 + (p.x + 0.032) / -p.z / 2, 0.5 + p.y / -p.z / 2, m.material.depthTest];
    });
    const px = await op.evaluate(pts => window.__occl.look(pts, 2), [at.slice(0, 3), [0, 0.7, 0.62]]);
    if (!(px[0][3] > 200) || mag(px[0]) || at[3] !== false) errors.push('occlusion: the menu at ' + JSON.stringify(at) + ' drawn as ' + JSON.stringify(px[0]));
    if (mag(px[1])) errors.push('occlusion: the plane drawn with the real world nearer everywhere');
    // its row: room and people -> room -> people -> nothing -> room and people, kept on the headset
    const seq = await op.evaluate(() => { const out = [HOST.occlusion.own()]; for (let k = 0; k < 4; k++) { const r = HOST.collab.menuFind('occl'); if (r && r.fn) r.fn(); window.__occl.step(1); out.push(HOST.occlusion.own() + ':' + localStorage.getItem('xrOccl')); } return out; });
    if (seq.join() !== 'both,room:room,depth:depth,off:off,both:both') errors.push('occlusion: the menu row went ' + seq.join());
    await op.evaluate(() => HOST.collab.panelOpen(false));
  });
  await step('occlusion: a story\'s own (a scene that says never), cleared when the story changes; hung in the next story\'s scene', async () => {
    await op.evaluate(() => { HOST.occlusion.scene('off'); window.__occl.near = 0.5; window.__occl.far = 4; });
    const s = await st();
    if (s.mode !== 'off' || s.over !== 'off' || s.own !== 'both') errors.push('occlusion: a story\'s own: ' + JSON.stringify(s));
    await shows('a story\'s own: off', '1111');
    await op.evaluate(() => HOST.go('design'));
    for (let k = 0; k < 400 && !(await op.evaluate(() => HOST.curKey === 'design' && HOST.cur && !!HOST.cur.collab.scene() && HOST.loading.ran)); k++) await op.evaluate(() => window.__occl.step(1));
    await op.evaluate(() => window.__occl.step(4));
    await plane();
    const s2 = await st();
    if (s2.over !== null || s2.mode !== 'both' || !s2.inScene) errors.push('occlusion: after a story change ' + JSON.stringify(s2));
    await shows('the design room: the wall and people on the left', '0101');
    await op.evaluate(() => HOST.occlusion.scene(true));
    if ((await st()).mode !== 'both') errors.push('occlusion: scene(true) is not room and people');
    await op.evaluate(() => HOST.occlusion.scene(null));
  });
  await step('occlusion: the session ends: nothing of it drawn on the page', async () => {
    await op.evaluate(() => window.__occl.session.end());
    await op.waitForTimeout(300);
    const s = await st();
    if (s.session || s.root || s.quad) errors.push('occlusion: after the session ' + JSON.stringify(s));
  });
  await step('occlusion: CPU depth (as a phone gives it, in metres): the plane hidden where the real world is nearer', async () => {
    await op.evaluate(() => { const F = window.__occl; F.o.cpu = true; F.near = 0.5; F.far = 4; HOST.occlusion.set('depth'); });
    await op.evaluate(() => HOST.cur.peek('xrStart("immersive-ar")'));
    await op.waitForFunction(() => window.__occl.session && !window.__occl.session.ended && window.__occl.session.cbs.size && HOST.session === window.__occl.session, null, { timeout: 20000 });
    await op.evaluate(() => window.__occl.step(4));
    await plane();
    await shows('CPU depth, near on the left', '0101');
    const s = await st();
    if (!s.quad || s.depth.usage !== 'cpu-optimized' || s.depth.used !== 'metres') errors.push('occlusion: CPU depth state ' + JSON.stringify(s));
    await op.evaluate(() => { window.__occl.o.cpu = false; HOST.occlusion.set('both'); return window.__occl.session.end(); });
  });
  // a link sets it; the session's ladder (a page of its own, no story's session)
  await step('occlusion: #occl=off; the request\'s ladder (a TypeError naming unsigned-short, another refusal), VR as ever', async () => {
    await op.goto('about:blank');
    await op.goto(base + 'index.html#stories&occl=off');
    await op.waitForFunction(() => typeof HOST !== 'undefined' && HOST.occlusion, null, { timeout: 20000 });
    const o = await op.evaluate(() => [HOST.occlusion.own(), localStorage.getItem('xrOccl')]);
    if (o.join() !== 'off,off') errors.push('occlusion: #occl=off gave ' + o);
    const r = await op.evaluate(async () => {
      const F = window.__occl, out = {};
      F.o.refuseUS = true;
      let s = await HOST.xr.request('immersive-ar'); out.us = F.inits.map(i => i.init.depthSensing && i.init.depthSensing.dataFormatPreference.join('|')); out.usOK = !!s; await s.end();
      F.inits = []; F.o.refuseUS = false; F.o.failDepth = true;
      s = await HOST.xr.request('immersive-ar'); out.fail = F.inits.map(i => [!!i.init.depthSensing, i.init.optionalFeatures.includes('depth-sensing')].join('|')); out.failOK = !!s; await s.end();
      F.inits = []; F.o.failDepth = false;
      s = await HOST.xr.request('immersive-vr'); out.vr = F.inits.map(i => JSON.stringify(i.init)); out.vrWant = JSON.stringify({ optionalFeatures: HOST.xr.features('immersive-vr') }); await s.end();
      return out;
    });
    if (r.us.join() !== 'unsigned-short|luminance-alpha|float32,luminance-alpha|float32' || !r.usOK) errors.push('occlusion: a TypeError for unsigned-short: ' + JSON.stringify(r.us));
    if (r.fail.join() !== 'true|true,false|false' || !r.failOK) errors.push('occlusion: another refusal: ' + JSON.stringify(r.fail));
    if (r.vr.length !== 1 || r.vr[0] !== r.vrWant) errors.push('occlusion: VR asked ' + JSON.stringify(r.vr) + ', not ' + r.vrWant);
    await op.evaluate(() => { HOST.occlusion.set('both'); });
  });
  await step('every story asks for its session through HOST.xr.request', async () => {
    const line = 'session = await (HOST.xr.request ? HOST.xr.request(mode) : navigator.xr.requestSession(mode, { optionalFeatures: HOST.xr.features(mode) }));';
    const miss = await op.evaluate(async ([keys, line]) => (await Promise.all(keys.map(async k => ((await (await fetch('stories/' + k + '.js')).text()).includes(line) ? '' : k)))).filter(Boolean), [[...STORY_KEYS, ...EXTRA], line]);
    if (miss.length) errors.push('the session line is missing in ' + miss.join(', '));
  });
  await ctx.close();
}
// A phone's AR session (v125, --only 'phone ar'): a pretend Android phone (Chrome's user agent, touch, a pretend
// navigator.xr offering immersive-ar that records what it is asked for; the story's own xrStart through three.js r128's
// WebXR path, frames driven here; screen taps as Chrome makes them: a transient 'screen' input source, selectstart, a
// frame, select and selectend). The request asks for dom-overlay with #xrPhone as its root; the round menu button only in
// the session, inside the window's top right; beforexrselect cancelled on the button and the sheet and not elsewhere; the
// sheet's rows acting as the headset menu's and showing their state; The full menu opening the 3D menu; Close; Exit AR
// ending the session; the welcome's words for a phone; a headset's user agent asking for nothing new; without the overlay,
// two quick screen taps at nothing opening and closing the 3D menu, two slow ones and two at the menu not
function PHONE_FAKE() {
  try { localStorage.setItem('arInvite', 'shown'); } catch (e) { /* storage blocked */ }
  const ident = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const tr = (x, y, z) => { const m = ident(); m[12] = x; m[13] = y; m[14] = z; return m; };
  const persp = (fov, asp, n, f) => { const t = 1 / Math.tan(fov * Math.PI / 360); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); };
  const F = window.__phone = { o: { overlay: true }, session: null, time: 0, inits: [], ends: 0 };
  const pose = (m, q) => ({ transform: { matrix: m, position: { x: m[12], y: m[13], z: m[14], w: 1 }, orientation: q || { x: 0, y: 0, z: 0, w: 1 } } });
  const space = o => Object.assign({ addEventListener() {}, removeEventListener() {} }, o);
  class Session extends EventTarget {
    constructor(mode, feats, overlay) {
      super(); this.mode = mode; this.renderState = { depthNear: 0.1, depthFar: 1000, baseLayer: null }; this.inputSources = []; this.visibilityState = 'visible';
      this.environmentBlendMode = mode === 'immersive-ar' ? 'alpha-blend' : 'opaque'; this.enabledFeatures = feats; this.cbs = new Map(); this.n = 0;
      if (overlay) this.domOverlayState = { type: 'screen' };
    }
    updateRenderState(s) { Object.assign(this.renderState, s); }
    async requestReferenceSpace(type) { return space({ type, floor: type === 'local-floor' }); }
    requestAnimationFrame(cb) { const id = ++this.n; this.cbs.set(id, cb); return id; }
    cancelAnimationFrame(id) { this.cbs.delete(id); }
    async end() { if (this.ended) return; this.ended = true; F.ends++; this.dispatchEvent(new Event('end')); }
  }
  window.XRSession = Session;
  WebGL2RenderingContext.prototype.makeXRCompatible = function () { return Promise.resolve(); };
  window.XRWebGLLayer = class { constructor(s, gl) { this.framebufferWidth = gl.drawingBufferWidth; this.framebufferHeight = gl.drawingBufferHeight; this.framebuffer = null; this.antialias = true; }
    getViewport(v) { const w = this.framebufferWidth / 2; return { x: v.eye === 'left' ? 0 : w, y: 0, width: w, height: this.framebufferHeight }; } };
  const views = [-0.032, 0.032].map((x, i) => ({ eye: i ? 'right' : 'left', projectionMatrix: persp(70, 0.5, 0.05, 100), transform: { matrix: tr(x, 0, 0), position: { x, y: 0, z: 0, w: 1 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } }));
  F.frame = () => ({
    session: F.session,
    getViewerPose: () => Object.assign(pose(ident()), { views }),
    getPose: s => (s && s.ray ? pose(s.ray, s.q) : s && s.floor ? pose(tr(0, -1.6, 0)) : null),
  });
  F.step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      F.time += 1000 / 60;
      const cbs = [...F.session.cbs.values()]; F.session.cbs.clear();
      const fr = F.frame();
      for (const cb of cbs) cb(F.time, fr);
    }
  };
  // a tap on the screen as Chrome makes one: a transient 'screen' input source whose ray goes from the phone along dir (the
  // phone's view), selectstart, a frame (the story points its ray), select and selectend, the source gone, a frame
  F.tap = dir => {
    const s = F.session, d = new THREE.Vector3().fromArray(dir).normalize(), m = new THREE.Matrix4().lookAt(new THREE.Vector3(), d, Math.abs(d.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
    const q = new THREE.Quaternion().setFromRotationMatrix(m), src = { targetRayMode: 'screen', handedness: 'none', profiles: ['generic-touchscreen'], gamepad: null,
      targetRaySpace: space({ ray: Float32Array.from(m.elements), q: { x: q.x, y: q.y, z: q.z, w: q.w } }) };
    const ev = (type, o) => { const e = new Event(type); Object.assign(e, o); s.dispatchEvent(e); };
    s.inputSources = [src];
    ev('inputsourceschange', { session: s, added: [src], removed: [] });
    ev('selectstart', { inputSource: src, frame: F.frame() });
    F.step(1);
    ev('select', { inputSource: src, frame: F.frame() });
    ev('selectend', { inputSource: src, frame: F.frame() });
    s.inputSources = [];
    ev('inputsourceschange', { session: s, added: [], removed: [src] });
    return performance.now();
  };
  Object.defineProperty(navigator, 'xr', { configurable: true, value: {
    isSessionSupported: async m => m === 'immersive-ar' || m === 'immersive-vr', addEventListener() {}, removeEventListener() {},
    requestSession: async (mode, init) => {
      const r = init.domOverlay && init.domOverlay.root;
      F.inits.push({ mode, feats: (init.optionalFeatures || []).slice(), root: r ? r.id || '?' : '', depth: !!init.depthSensing });
      // (refusals asked for by a step, in turn: { name, msg, overlay: only a request with the overlay })
      const no = (F.o.fails || [])[0];
      if (no && (!no.overlay || r)) { F.o.fails.shift(); throw new DOMException(no.msg || 'Refused', no.name); }
      const feats = (init.optionalFeatures || []).filter(f => f !== 'depth-sensing' && (f !== 'dom-overlay' || (F.o.overlay && r)));
      const s = new Session(mode, ['viewer', 'local', ...feats], feats.includes('dom-overlay'));
      F.session = s;
      return s;
    } } });
}
if (runs('phone ar')) {
  const step = (name, fn) => smokeStep(name, async () => { try { await fn(); } catch (e) { errors.push(name + ': ' + (e.stack || e.message)); } });
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
  const QUEST = 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/40.2.0.4.30 SamsungBrowser/4.0 Chrome/130.0.0.0 VR Safari/537.36';
  const device = async ua => {
    const phone = ua === ANDROID, ctx = await browser.newContext({ viewport: phone ? { width: 412, height: 860 } : { width: 800, height: 600 }, userAgent: ua, isMobile: phone, hasTouch: phone });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('phone ar: ' + (e.stack || e.message)));
    p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('phone ar: ' + m.text()); });
    await p.addInitScript(PHONE_FAKE);
    await p.goto(base + 'index.html#airports');
    await p.waitForFunction(() => HOST.curKey === 'airports' && HOST.cur && HOST.cur.collab.scene() && HOST.collab && HOST.collab.phone, null, { timeout: 40000 });
    return { ctx, p };
  };
  const start = p => p.evaluate(() => { const F = window.__phone; F.inits.length = 0; return HOST.cur.peek('xrStart("immersive-ar")'); })
    .then(() => p.waitForFunction(() => window.__phone.session && !window.__phone.session.ended && HOST.session === window.__phone.session && HOST.mode === 'immersive-ar', null, { timeout: 20000 }))
    .then(() => p.evaluate(() => window.__phone.step(4)));
  // frames for a while (real time passes: the welcome waits 2.5 s into the session)
  const frames = async (p, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { await p.evaluate(() => window.__phone.step(1)); await p.waitForTimeout(40); } };
  const ph = p => p.evaluate(() => HOST.collab.phone());
  const press = (p, id) => p.click(`#xrPhone [data-xp="${id}"]`);
  const BEHIND = [0, 0.3, 1];   // (a tap on the screen whose ray goes nowhere: nothing of the story or the shell there)
  const { ctx, p } = await device(ANDROID);
  await step('phone ar: no menu button on the page; the AR request asks for dom-overlay with #xrPhone as its root (depth sensing still); the round button in the session, in the top right corner', async () => {
    const s0 = await ph(p);
    if (s0.button || s0.root || s0.ar) errors.push('phone ar: before the session ' + JSON.stringify(s0));
    await start(p);
    const r = await p.evaluate(() => window.__phone.inits), s = await ph(p);
    const ask = r[0] || {};
    if (r.length !== 1 || ask.mode !== 'immersive-ar' || ask.root !== 'xrPhone' || ask.feats.filter(f => f === 'dom-overlay').length !== 1 || !ask.feats.includes('depth-sensing') || !ask.depth)
      errors.push('phone ar: the request ' + JSON.stringify(r));
    const [x, y, w, h] = s.rect || [];
    if (!s.ar || !s.shown || !s.overlaid || !s.button || s.open || s.sheet || !(w >= 44 && w <= 60 && h === w && x + w <= 412 - 6 && x + w >= 412 - 30 && y >= 6 && y <= 30))
      errors.push('phone ar: in the session ' + JSON.stringify(s));
    const look = await p.evaluate(() => { const b = document.querySelector('#xrPhone .xp-btn'), r = document.getElementById('xrPhone'), cs = getComputedStyle(b);
      return { root: getComputedStyle(r).pointerEvents, btn: cs.pointerEvents, radius: cs.borderRadius, icon: !!b.querySelector('svg path'), label: b.getAttribute('aria-label'), at: document.elementFromPoint(206, 430) === r || r.contains(document.elementFromPoint(206, 430)) }; });
    if (look.root !== 'none' || look.btn !== 'auto' || look.radius !== '50%' || !look.icon || look.label !== 'Menu' || look.at) errors.push('phone ar: the overlay ' + JSON.stringify(look));
  });
  await step('phone ar: beforexrselect cancelled on the button and the sheet, not on the root or the page', async () => {
    await press(p, 'menu');
    const r = await p.evaluate(() => {
      const fire = n => { const e = new Event('beforexrselect', { bubbles: true, cancelable: true }); n.dispatchEvent(e); return e.defaultPrevented; };
      const q = s => document.querySelector(s);
      return { btn: fire(q('#xrPhone .xp-btn')), sheet: fire(q('#xrPhone .xp-sheet')), row: fire(q('#xrPhone .xp-rows [data-xp="subs"]')), head: fire(q('#xrPhone .xp-head h2')),
        root: fire(q('#xrPhone')), body: fire(document.body), canvas: fire(q('canvas')) };
    });
    if (!r.btn || !r.sheet || !r.row || !r.head || r.root || r.body || r.canvas) errors.push('phone ar: beforexrselect cancelled ' + JSON.stringify(r));
  });
  await step('phone ar: the sheet\'s rows act as the headset menu\'s and show their state (Sound, Narration, Sound effects, Subtitles, Slideshow, Frame rate, Labels, Cards, Panels, Real world hides, Recenter)', async () => {
    const s = await ph(p);
    const ids = s.rows.map(r => r.id).join();
    if (!s.open || !s.sheet || ids !== 'exit,recenter,sound,voice,sfx,subs,slides,fps,labels,cards,panels,occl,full') errors.push('phone ar: the sheet ' + JSON.stringify(s));
    const big = await p.evaluate(() => [...document.querySelectorAll('#xrPhone .xp-sheet button')].filter(b => b.getBoundingClientRect().height < 44).map(b => b.textContent));
    if (big.length) errors.push('phone ar: buttons under 44 px tall: ' + big);
    // what HOST says, and what the row says (its text and aria-pressed)
    const HOSTSAYS = {
      sound: () => !HOST.audio.muted, voice: () => HOST.xr.voice(), sfx: () => HOST.sfx.on(), subs: () => HOST.xr.subs(), slides: () => !!HOST.slides.global(), fps: () => HOST.xr.fps(),
      labels: () => HOST.xr.labels(), cards: () => HOST.xr.cards(), panels: () => HOST.panels.get('airports'), occl: () => HOST.occlusion.own() };
    const read = id => p.evaluate(([id, f]) => { const v = (0, eval)('(' + f + ')')(); const r = HOST.collab.phone().rows.find(x => x.id === id); return { v, r }; }, [id, HOSTSAYS[id].toString()]);
    const SAY = { fixed: 'in 3D', hidden: 'hidden', face: 'on top' }, PS = { shown: 'shown', controls: 'controls only', hidden: 'hidden' };
    const words = { sound: v => 'Sound: ' + (v ? 'on' : 'off'), voice: v => 'Narration: ' + (v ? 'on' : 'off'), sfx: v => 'Sound effects: ' + (v ? 'on' : 'off'), subs: v => 'Subtitles: ' + (v ? 'on' : 'off'),
      slides: v => 'Slideshow: ' + (v ? 'on' : 'off'), fps: v => 'Frame rate: ' + (v ? 'on' : 'off'), labels: v => 'Labels: ' + SAY[v], cards: v => 'Cards: ' + SAY[v], panels: v => 'Panels: ' + PS[v] };
    const lit = { labels: v => v !== 'hidden', cards: v => v !== 'hidden', panels: v => v === 'shown', occl: v => v !== 'off' };
    const NEXT = { labels: { face: 'fixed', fixed: 'hidden', hidden: 'face' }, cards: { fixed: 'face', face: 'hidden', hidden: 'fixed' }, panels: { shown: 'controls', controls: 'hidden', hidden: 'shown' }, occl: { both: 'room', room: 'depth', depth: 'off', off: 'both' } };
    for (const id of ['sound', 'voice', 'sfx', 'subs', 'slides', 'fps', 'labels', 'cards', 'panels', 'occl']) {
      const a = await read(id);
      await press(p, id);
      const b = await read(id), want = NEXT[id] ? NEXT[id][a.v] : !a.v;
      const text = id === 'occl' ? 'Real world hides: ' + await p.evaluate(v => HOST.occlusion.say(v), b.v) : words[id](b.v);
      const on = String(lit[id] ? lit[id](b.v) : !!b.v);
      if (b.v !== want || !b.r || b.r.text !== text || b.r.on !== on) errors.push(`phone ar: the ${id} row: ${JSON.stringify(a)} -> ${JSON.stringify(b)} (want ${JSON.stringify(want)}, "${text}", ${on})`);
    }
    const rc = await p.evaluate(() => { HOST.cur.peek('XR.needRecenter = false'); return 0; }).then(() => press(p, 'recenter')).then(() => p.evaluate(() => HOST.cur.peek('XR.needRecenter')));
    if (rc !== true) errors.push('phone ar: Recenter did not recentre (XR.needRecenter ' + rc + ')');
    // the headset menu's own rows say the same (the menu's Settings tab drawn with them)
    const m = await p.evaluate(() => { HOST.collab.panelOpen(true); HOST.collab.menuTab('settings'); const ids = HOST.collab.menuIds(); HOST.collab.panelOpen(false); return ids; });
    for (const id of ['exit', 'recenter', 'set:sound', 'voice', 'sfx', 'subs', 'slides', 'fps', 'labels', 'cards', 'panels', 'occl']) if (!m.includes(id)) errors.push('phone ar: the headset menu has no ' + id + ' row');
  });
  await step('phone ar: The full menu opens the 3D menu (the sheet closes), its row then says so and closes it; Close and the button close the sheet', async () => {
    const s0 = await ph(p);
    if (!s0.open) await press(p, 'menu');
    await press(p, 'full');
    await p.evaluate(() => window.__phone.step(2));
    const s1 = await ph(p);
    if (!s1.menu || s1.open || s1.sheet || !s1.button) errors.push('phone ar: The full menu ' + JSON.stringify(s1));
    const by = await p.evaluate(() => (window.__collabLog || []).filter(l => l.ev === 'menu').slice(-1)[0]);
    if (!by || by.by !== 'phone' || by.open !== true) errors.push('phone ar: the menu opened by ' + JSON.stringify(by));
    await press(p, 'menu');
    const s2 = await ph(p), fr = s2.rows.find(r => r.id === 'full');
    if (!fr || fr.text !== 'Close the full menu' || fr.on !== 'true') errors.push('phone ar: the full menu\'s row while it is open ' + JSON.stringify(fr));
    await press(p, 'full');
    const s3 = await ph(p);
    if (s3.menu) errors.push('phone ar: Close the full menu left it open');
    await press(p, 'close');
    const s4 = await ph(p);
    await press(p, 'menu'); const s5 = await ph(p);
    await press(p, 'menu'); const s6 = await ph(p);
    if (s4.open || s4.sheet || !s5.open || !s5.sheet || s6.open || s6.sheet || !s6.button) errors.push('phone ar: Close and the button ' + JSON.stringify([s4, s5, s6].map(s => [s.open, s.sheet, s.button])));
    const ex = await p.evaluate(() => document.querySelector('#xrPhone .xp-btn').getAttribute('aria-expanded'));
    if (ex !== 'false') errors.push('phone ar: the button\'s aria-expanded ' + ex);
  });
  await step('phone ar: the welcome says how a phone points and opens the menu (no controller drawn); the notice too', async () => {
    // (the session began with the welcome off, as in every test: the notice The menu said it, 2.5 s in)
    const n = await p.evaluate(() => HOST.collab.notes().filter(x => x.title === 'The menu').map(x => x.text));
    if (n.slice(-1)[0] !== 'Tap the round button at the top right for the menu.') errors.push('phone ar: the notice The menu said ' + JSON.stringify(n));
    const w = await p.evaluate(() => { HOST.collab.autoWelcome(true); return HOST.collab.welcome(); });
    await frames(p, 2900);
    const w1 = await p.evaluate(() => HOST.collab.welcome());
    if (!w1.shown || !w1.phone || !/Tap: point at a thing and press it\./.test(w1.text) || !/The round button, top right: the menu\./.test(w1.text) || /Trigger|stick/.test(w1.text))
      errors.push('phone ar: the welcome ' + JSON.stringify({ w, w1 }));
    await p.evaluate(() => HOST.collab.autoWelcome(false));
  });
  await step('phone ar: Exit AR ends the session; the button gone', async () => {
    await press(p, 'menu');
    await press(p, 'exit');
    await p.waitForFunction(() => !HOST.session, null, { timeout: 10000 });
    const s = await ph(p), e = await p.evaluate(() => window.__phone.ends);
    if (s.button || s.root || s.sheet || s.ar || e !== 1) errors.push('phone ar: after Exit ' + JSON.stringify({ s, ends: e }));
  });
  await step('phone ar: without the overlay, two quick taps on the screen at nothing open and close the 3D menu; two slow ones, and two at the menu, do not', async () => {
    await p.evaluate(() => { window.__phone.o.overlay = false; });
    await start(p);
    const s = await ph(p), ask = await p.evaluate(() => window.__phone.inits[0]);
    if (s.overlaid || s.button || s.shown || !s.ar || !ask || ask.root !== 'xrPhone') errors.push('phone ar: without the overlay ' + JSON.stringify({ s, ask }));
    const two = (gap, dir) => p.evaluate(async ([gap, dir]) => { const F = window.__phone, a = F.tap(dir); if (gap) await new Promise(r => setTimeout(r, gap)); const b = F.tap(dir); F.step(1); return [Math.round(b - a), HOST.collab.menu]; }, [gap, dir || BEHIND]);
    const r1 = await two(0), r2 = await two(0);
    if (r1[0] >= 400 || r2[0] >= 400) errors.push('phone ar: two taps took ' + r1[0] + ' and ' + r2[0] + ' ms (too slow a machine to judge)');
    else if (!r1[1] || r2[1]) errors.push('phone ar: two quick taps: the menu ' + r1[1] + ', again ' + r2[1]);
    const by = await p.evaluate(() => (window.__collabLog || []).filter(l => l.ev === 'menu').slice(-2).map(l => l.open + ':' + l.by).join());
    if (by !== 'true:tap,false:tap') errors.push('phone ar: the menu by the taps: ' + by);
    await p.waitForTimeout(500);
    const r3 = await two(600);
    if (r3[1]) errors.push('phone ar: two slow taps (' + r3[0] + ' ms apart) opened the menu');
    // the menu open: two quick taps at it (its left margin, no button there) leave it open
    await p.waitForTimeout(500);
    await p.evaluate(() => { HOST.collab.panelOpen(true); window.__phone.step(3); });
    const at = await p.evaluate(() => { const m = HOST.collab.overlay().panel.mesh, w = m.geometry.parameters.width; return m.localToWorld(new THREE.Vector3(-w * 0.49, 0, 0)).toArray(); });
    const r4 = await p.evaluate(at => { const F = window.__phone, a = F.tap(at), hv = HOST.collab.internals().hov.get(0), b = F.tap(at); F.step(1); return [Math.round(b - a), HOST.collab.menu, hv && hv.target && hv.target.kind]; }, at);
    if (!r4[1] || r4[2] !== 'panel') errors.push('phone ar: two quick taps at the menu (' + at.map(v => v.toFixed(2)) + ', ' + r4[0] + ' ms apart, pointing at ' + r4[2] + ') closed it');
    await p.evaluate(() => HOST.collab.panelOpen(false));
    await p.evaluate(() => window.__phone.session.end());
    await p.waitForFunction(() => !HOST.session, null, { timeout: 10000 });
    await p.evaluate(() => { window.__phone.o.overlay = true; });
  });
  await step('phone ar: the overlay refused once (not the person\'s or the browser\'s own): asked again at once without it, depth kept; AR starts without the button and two quick taps open the menu; refused again without it, the page says to tap Enter AR again', async () => {
    await p.evaluate(() => { window.__phone.o.fails = [{ overlay: true, name: 'NotSupportedError', msg: 'No overlay here' }]; });
    await start(p);
    const r = await p.evaluate(() => window.__phone.inits), s = await ph(p);
    const lg = await p.evaluate(() => (window.__collabLog || []).filter(l => l.ev === 'phone AR asks again without the overlay').map(l => l.e));
    if (r.length !== 2 || r[0].root !== 'xrPhone' || !r[0].feats.includes('dom-overlay') || !r[0].depth || r[1].root || r[1].feats.includes('dom-overlay') || !r[1].depth || !r[1].feats.includes('depth-sensing'))
      errors.push('phone ar: the overlay refused, the requests ' + JSON.stringify(r));
    if (!s.ar || s.overlaid || s.button || s.shown || s.root || s.asking || lg.slice(-1)[0] !== 'No overlay here') errors.push('phone ar: the overlay refused, in the session ' + JSON.stringify({ s, lg }));
    const two = () => p.evaluate(async dir => { const F = window.__phone, a = F.tap(dir), b = F.tap(dir); F.step(1); return [Math.round(b - a), HOST.collab.menu]; }, BEHIND);
    await p.waitForTimeout(500);
    const t1 = await two(), t2 = await two();
    if (t1[0] >= 400 || t2[0] >= 400) errors.push('phone ar: two taps took ' + t1[0] + ' and ' + t2[0] + ' ms (too slow a machine to judge)');
    else if (!t1[1] || t2[1]) errors.push('phone ar: the overlay refused, two quick taps: the menu ' + t1[1] + ', again ' + t2[1]);
    await p.evaluate(() => window.__phone.session.end());
    await p.waitForFunction(() => !HOST.session, null, { timeout: 10000 });
    // refused again without it (as when the tap's activation has gone): no session, nothing of the button, the note on the page
    const f = await p.evaluate(async () => {
      const F = window.__phone; F.inits.length = 0;
      F.o.fails = [{ overlay: true, name: 'NotSupportedError', msg: 'No overlay here' }, { name: 'SecurityError', msg: 'The requested session requires user activation.' }];
      await HOST.cur.peek('xrStart("immersive-ar")');
      const m = document.getElementById('xrmsg');
      return { n: F.inits.length, left: F.o.fails.length, session: !!HOST.session, text: m.textContent, shown: m.style.display, ph: HOST.collab.phone() };
    });
    if (f.n !== 2 || f.left || f.session || f.shown !== 'block' || !/^Could not start AR: it was refused with the menu button \(No overlay here\) and again without it \(The requested session requires user activation\.\)\. Tap Enter AR again\.$/.test(f.text) ||
      f.ph.root || f.ph.button || f.ph.asking)
      errors.push('phone ar: refused again without the overlay ' + JSON.stringify(f));
    // the person's own refusal at the first ask: not asked again, the browser's words as they were
    const g = await p.evaluate(async () => {
      const F = window.__phone; F.inits.length = 0;
      F.o.fails = [{ overlay: true, name: 'NotAllowedError', msg: 'The user denied it.' }];
      await HOST.cur.peek('xrStart("immersive-ar")');
      return { n: F.inits.length, session: !!HOST.session, text: document.getElementById('xrmsg').textContent };
    });
    if (g.n !== 1 || g.session || g.text !== 'Could not start AR: The user denied it.') errors.push('phone ar: the person\'s own refusal ' + JSON.stringify(g));
    await p.evaluate(() => { window.__phone.o.fails = []; window.__phone.inits.length = 0; });
  });
  await ctx.close();
  await step('phone ar: a headset\'s browser asks for nothing new (no dom-overlay, no root) and shows no menu button', async () => {
    const { ctx: c2, p: q } = await device(QUEST);
    await start(q);
    const r = await q.evaluate(() => window.__phone.inits), s = await ph(q);
    if (r.length !== 1 || r[0].feats.includes('dom-overlay') || r[0].root || s.button || s.root || s.ar) errors.push('phone ar: in a headset ' + JSON.stringify({ r, s }));
    await c2.close();
  });
}
// Focus mode (HOST.focus): on by default on a phone and an iPad (touch), the 3D on its own between two slim bars (nothing
// overlapping, also on a 360 px phone), the subtitles the shell's own captions changing with the clock, a chapter's title
// as it starts, the chapter arrows, Next at a slideshow stop, Text opening the panel (HOST.focus() false, a resize sent)
// and closing it, explore's drawer closed by default then open and closed, nothing on the Stories screen; #focus=off
// giving the layout as ever, and a desktop page off and unchanged. (With --only: 'focus mode', 'phones', 'tablets' or
// 'iPhone' runs these two blocks, each step by its name)
if (['focus mode', 'phones', 'tablets', 'iPhone'].some(runs)) {
  const ready = () => HOST.cur && HOST.cur.collab.scene() && document.getElementById('loading').classList.contains('gone');
  const watch = p => {
    p.on('pageerror', e => errors.push(e.stack || e.message));
    p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  };
  // the bars' parts on show: none overlapping another, all inside the page
  const bars = p => p.evaluate(() => {
    const out = [], vw = innerWidth;
    for (const id of ['top', 'bar']) {
      const rs = [...document.getElementById(id).children].filter(e => e.id !== 'track' && e.id !== 'fcMenu' && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0)
        .map(e => [e.id || e.className, e.getBoundingClientRect()]);
      for (const [n, r] of rs) if (r.left < -0.5 || r.right > vw + 0.5) out.push(`${n} outside the page (${Math.round(r.left)} to ${Math.round(r.right)} of ${vw})`);
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
        const [a, A] = rs[i], [b, B] = rs[j];
        if (A.left < B.right - 0.5 && B.left < A.right - 0.5 && A.top < B.bottom - 0.5 && B.top < A.bottom - 0.5) out.push(`${a} overlaps ${b}`);
      }
    }
    return out;
  });
  for (const [dev, opts] of [['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }], ['iPad', { viewport: { width: 1180, height: 820 }, hasTouch: true }]]) {
    const ctx = await browser.newContext(opts), fp = await ctx.newPage();
    watch(fp);
    const ev = (f, a) => fp.evaluate(f, a);
    await step(`focus mode on a ${dev}: on by default, the panel hidden, two slim bars, nothing overlapping`, async () => {
      await fp.goto(base + 'index.html#airports&t=1');
      await fp.waitForFunction(ready, null, { timeout: 60000 });
      const r = await ev(() => {
        const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; };
        return { focus: HOST.focus(), on: HOST.focus.on(), body: document.body.classList.contains('focus'), panel: vis('panel'),
          top: document.getElementById('top').getBoundingClientRect().height, bar: document.getElementById('bar').getBoundingClientRect().height,
          shown: ['play', 'fcPrev', 'fcNext', 'fcName', 'fcText', 'track', 'btnOther', 'btnShared', 'fcMore'].filter(vis),
          gone: ['fcCtl', 'btnSound', 'btnVR', 'btnAR', 'btnInstall'].filter(vis) };
      });
      if (!r.focus || !r.on || !r.body || r.panel) errors.push(`${dev}: focus mode not on by default (${JSON.stringify(r)})`);
      if (Math.abs(r.top - 48) > 1 || Math.abs(r.bar - 56) > 1) errors.push(`${dev}: the bars are ${r.top} and ${r.bar} px high, not 48 and 56`);
      if (r.shown.length !== 9 || r.gone.length) errors.push(`${dev}: the bars show ${r.shown.join(', ')}; and ${r.gone.join(', ') || 'nothing'} that should not show`);
      for (const b of await bars(fp)) errors.push(`${dev}: ${b}`);
      if (dev === 'phone') {
        await fp.setViewportSize({ width: 360, height: 740 }); await fp.waitForTimeout(300);
        for (const b of await bars(fp)) errors.push(`a 360 px phone: ${b}`);
        await ev(() => document.getElementById('fcMore').click()); await fp.waitForTimeout(200);
        const m = await ev(() => [...document.querySelectorAll('#fcMenu button')].map(b => b.textContent));
        if (!m.includes('Explore now') || !m.includes('Focus view: on')) errors.push(`a 360 px phone: More holds ${m.join(', ')}`);
        await ev(() => document.getElementById('fcMore').click());
        await fp.setViewportSize(opts.viewport); await fp.waitForTimeout(300);
      }
    });
    await step(`focus mode on a ${dev}: the subtitles are the shell's captions and change with the clock; a chapter's title as it starts`, async () => {
      // the line on show in the strip, once faded in (a frame or two in software)
      const strip = () => fp.waitForFunction(() => {
        const s = document.querySelector('#subs > div'), c = HOST.collab.caption().text;
        return c && s.textContent === c && +getComputedStyle(document.getElementById('subs')).opacity > 0.9;
      }, null, { timeout: 20000 }).then(() => true, () => false);
      const at = await ev(() => {
        const A = HOST.cur.collab.APP, h = HOST.cur.peek('CH').find(c => c.key === 'hubs');
        A.playing = false; A.seek(h.na + 2.5);
        const first = HOST.collab.caption().text;
        for (let d = 3; d < 20; d += 0.5) { A.seek(h.na + d); const c = HOST.collab.caption().text; if (c && c !== first) { A.seek(h.na + 2.5); return { first, second: c, t2: h.na + d }; } }
        return { first, second: '', t2: 0 };
      });
      if (!at.first || !at.second) errors.push(`${dev}: no two captions in the Hubs chapter (${JSON.stringify(at)})`);
      // (the title shows for about 3 s: looked for first, as frames come slowly in software)
      await fp.waitForFunction(() => HOST.focus.state().title === document.querySelector('#story .ch[data-ch="hubs"] h2').textContent, null, { timeout: 10000 }).catch(() => {});
      const t = await ev(() => ({ title: HOST.focus.state().title, h2: document.querySelector('#story .ch[data-ch="hubs"] h2').textContent, o: +getComputedStyle(document.getElementById('chtitle')).opacity }));
      if (!t.title || t.title !== t.h2) errors.push(`${dev}: no chapter title as Hubs starts (${JSON.stringify(t)})`);
      if (!await strip()) errors.push(`${dev}: the strip does not show the caption (${await ev(() => document.querySelector('#subs > div').textContent)} / ${JSON.stringify(await ev(() => HOST.collab.caption()))})`);
      const lines = await ev(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('#subs > div')); return new Set([...r.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top))).size; });
      if (lines > 2) errors.push(`${dev}: the caption takes ${lines} lines`);
      await ev(t2 => HOST.cur.collab.APP.seek(t2), at.t2);
      if (!await strip() || await ev(() => document.querySelector('#subs > div').textContent) !== at.second) errors.push(`${dev}: the strip did not change with the clock (${await ev(() => document.querySelector('#subs > div').textContent)})`);
      // playing: still the caption on show
      await ev(() => { HOST.cur.collab.APP.playing = true; });
      await fp.waitForTimeout(2500);
      if (!await strip()) errors.push(`${dev}: while playing the strip is not the caption on show`);
      await ev(() => { HOST.cur.collab.APP.playing = false; });
      // the chapter arrows (as the headset's): on to the next chapter's start, back to this one's, then the one before
      const arrows = await ev(() => {
        const A = HOST.cur.collab.APP, ch = HOST.cur.peek('CH'), i = ch.findIndex(c => c.key === 'hubs');
        A.seek(ch[i].na + 5); document.getElementById('fcPrev').click(); const back = A.t === ch[i].na;
        document.getElementById('fcPrev').click(); const before = A.t === ch[i - 1].na;
        document.getElementById('fcNext').click(); document.getElementById('fcNext').click(); const on = A.t === ch[i + 1].na;
        return { back, before, on, name: document.getElementById('fcName').textContent };
      });
      const want = await ev(() => { const ch = HOST.cur.peek('CH'); return ch[ch.findIndex(c => c.key === 'hubs') + 1].name; });
      await fp.waitForFunction(w => document.getElementById('fcName').textContent === w, want, { timeout: 10000 }).catch(() => {});
      const name = await ev(() => document.getElementById('fcName').textContent);
      if (!arrows.back || !arrows.before || !arrows.on || name !== want) errors.push(`${dev}: the chapter arrows (${JSON.stringify(arrows)}, the bar says ${name}, not ${want})`);
    });
    await step(`focus mode on a ${dev}: Next in the bar at a slideshow stop`, async () => {
      await ev(() => { HOST.slides.set('airports', true); const A = HOST.cur.collab.APP; A.seek(HOST.cur.peek('slideStop(2)') - 0.05); A.playing = true; });
      const stopped = await fp.waitForFunction(() => !HOST.cur.peek('APP.playing') && HOST.cur.peek('SLIDE.at') >= 0, null, { timeout: 30000 }).then(() => true, () => false);
      await fp.waitForTimeout(300);
      const r = await ev(() => ({ next: !!document.getElementById('btnNextBar').offsetParent, name: getComputedStyle(document.getElementById('fcName')).display }));
      if (!stopped || !r.next || r.name !== 'none') errors.push(`${dev}: at a slideshow stop (${stopped}) Next is not in the bar in the chapter name's place (${JSON.stringify(r)})`);
      await ev(() => document.getElementById('btnNextBar').click());
      if (!await fp.waitForFunction(() => HOST.cur.peek('APP.playing'), null, { timeout: 10000 }).then(() => true, () => false)) errors.push(`${dev}: Next in the bar did not go on`);
      await ev(() => { HOST.cur.collab.APP.playing = false; HOST.slides.set('airports', false); });
    });
    await step(`focus mode on a ${dev}: Text opens the story's panel (a resize sent) and closes it`, async () => {
      await ev(() => { window.__fcResize = 0; addEventListener('resize', () => window.__fcResize++); });
      await fp.click('#fcText');
      await fp.waitForFunction(() => !HOST.focus() && window.__fcResize >= 1, null, { timeout: 8000 }).catch(() => {});   // (what it measures, not a fixed time: a slow page)
      const o = await ev(() => {
        const p = document.getElementById('panel'), r = p.getBoundingClientRect();
        return { focus: HOST.focus(), resize: window.__fcResize, pressed: document.getElementById('fcText').getAttribute('aria-pressed'), shown: getComputedStyle(p).display !== 'none' && r.height > 100,
          left: r.left, w: r.width, bottom: r.bottom, barTop: document.getElementById('bar').getBoundingClientRect().top, subs: getComputedStyle(document.getElementById('subs')).display, title: getComputedStyle(document.getElementById('chtitle')).display };
      });
      if (o.focus || o.resize < 1 || o.pressed !== 'true' || !o.shown || o.subs !== 'none' || o.title !== 'none') errors.push(`${dev}: Text did not open the panel alone (${JSON.stringify(o)})`);
      if (dev === 'iPad' && !(o.left < 40 && o.w < 0.5 * 1180)) errors.push(`${dev}: the panel is not the side panel (${JSON.stringify(o)})`);
      if (dev === 'phone' && !(o.w > 380 && o.bottom <= o.barTop + 1)) errors.push(`${dev}: the panel is not the bottom sheet over the bar (${JSON.stringify(o)})`);
      await fp.click('#fcText');
      await fp.waitForFunction(() => HOST.focus() && window.__fcResize >= 2, null, { timeout: 8000 }).catch(() => {});
      const c = await ev(() => ({ focus: HOST.focus(), resize: window.__fcResize, panel: getComputedStyle(document.getElementById('panel')).display }));
      if (!c.focus || c.resize < 2 || c.panel !== 'none') errors.push(`${dev}: Text did not close the panel (${JSON.stringify(c)})`);
    });
    await step(`focus mode on a ${dev}: explore's drawer closed by default, opened and closed; no subtitles there`, async () => {
      await ev(() => HOST.cur.collab.APP.enterExplore());
      await fp.waitForFunction(() => !!document.getElementById('fcCtl').offsetParent && HOST.focus(), null, { timeout: 8000 }).catch(() => {});
      const s = await ev(() => ({ focus: HOST.focus(), drawer: HOST.focus.drawer(), panel: getComputedStyle(document.getElementById('panel')).display, subs: getComputedStyle(document.getElementById('subs')).display, sub: HOST.focus.state().sub,
        ctl: !!document.getElementById('fcCtl').offsetParent, text: !!document.getElementById('fcText').offsetParent, play: !!document.getElementById('play').offsetParent }));
      if (!s.focus || s.drawer || s.panel !== 'none' || s.subs !== 'none' || s.sub || !s.ctl || s.text || s.play) errors.push(`${dev}: explore mode does not start with the drawer closed and the 3D on its own (${JSON.stringify(s)})`);
      const n = await ev(() => window.__fcResize);
      await fp.click('#fcCtl');
      await fp.waitForFunction(n => HOST.focus.drawer() && !HOST.focus() && window.__fcResize > n, n, { timeout: 8000 }).catch(() => {});
      await fp.waitForTimeout(300);   // (the drawer's slide up)
      const o = await ev(() => { const p = document.getElementById('panel'), r = p.getBoundingClientRect(); return { focus: HOST.focus(), drawer: HOST.focus.drawer(), resize: window.__fcResize, h: r.height, bottom: r.bottom, barTop: document.getElementById('bar').getBoundingClientRect().top, H: innerHeight, tabs: !!p.querySelector('#explore .tabs, #explore [role="tablist"], #explore button') }; });
      if (o.focus || !o.drawer || o.resize <= n || !(o.h > 80 && o.h <= 0.6 * o.H + 1) || o.bottom > o.barTop + 1 || !o.tabs) errors.push(`${dev}: Controls did not pull the drawer up (${JSON.stringify(o)})`);
      await fp.click('#fcHandle');
      await fp.waitForFunction(() => HOST.focus() && !HOST.focus.drawer(), null, { timeout: 8000 }).catch(() => {});
      const c = await ev(() => ({ focus: HOST.focus(), drawer: HOST.focus.drawer(), panel: getComputedStyle(document.getElementById('panel')).display }));
      if (!c.focus || c.drawer || c.panel !== 'none') errors.push(`${dev}: the handle did not close the drawer (${JSON.stringify(c)})`);
      // opened again, then explore mode left and begun again: closed again
      await fp.click('#fcCtl');
      await ev(() => { HOST.cur.collab.APP.enterStory(0); HOST.cur.collab.APP.enterExplore(); });
      await fp.waitForFunction(() => HOST.focus() && !HOST.focus.drawer(), null, { timeout: 8000 }).catch(() => {});
      if (await ev(() => HOST.focus.drawer() || !HOST.focus())) errors.push(`${dev}: explore mode begun again with the drawer open`);
      await ev(() => HOST.cur.collab.APP.enterStory(0));
    });
    await step(`focus mode on a ${dev}: nothing of it on the Stories screen`, async () => {
      await ev(() => HOST.openPicker());
      await fp.waitForFunction(() => !HOST.focus(), null, { timeout: 8000 }).catch(() => {});
      await fp.waitForTimeout(200);
      const s = await ev(() => ({ focus: HOST.focus(), subs: getComputedStyle(document.getElementById('subs')).display, title: getComputedStyle(document.getElementById('chtitle')).display, more: getComputedStyle(document.getElementById('fcMore')).display, top: document.getElementById('top').getBoundingClientRect().height, btn: document.getElementById('btnFocus').getAttribute('aria-pressed') }));
      // (a phone's narrow top bar keeps its More there: HOST.handheld)
      if (s.focus || s.subs !== 'none' || s.title !== 'none' || s.more !== (dev === 'phone' ? 'grid' : 'none') || Math.abs(s.top - 58) > 1 || s.btn !== 'true') errors.push(`${dev}: the Stories screen is not as ever (${JSON.stringify(s)})`);
      await ev(() => HOST.closePicker());
    });
    if (dev === 'phone') await step('focus mode: #focus=off gives the layout as ever, and Focus view on the Stories screen brings it back', async () => {
      await fp.goto(base + 'index.html#airports&t=20&focus=off');
      await fp.waitForFunction(ready, null, { timeout: 60000 });
      await fp.waitForTimeout(300);
      const s = await ev(() => ({ on: HOST.focus.on(), focus: HOST.focus(), body: document.body.classList.contains('focus'), panel: getComputedStyle(document.getElementById('panel')).display,
        h: document.getElementById('panel').getBoundingClientRect().height, fc: [...document.querySelectorAll('.fc:not(#fcMore), #subs, #chtitle')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.id), kept: localStorage.getItem('pageFocus') }));   // (More: the narrow top bar's)
      if (s.on || s.focus || s.body || s.panel === 'none' || s.h < 100 || s.fc.length || s.kept !== 'off') errors.push(`#focus=off: ${JSON.stringify(s)}`);
      await ev(() => HOST.openPicker()); await fp.click('#btnFocus'); await ev(() => HOST.closePicker());
      await fp.waitForFunction(() => HOST.focus(), null, { timeout: 8000 }).catch(() => {});
      if (!await ev(() => HOST.focus() && localStorage.getItem('pageFocus') === 'on')) errors.push('Focus view on the Stories screen did not turn focus mode on');
    });
    await ctx.close();
  }
  // Phones and tablets (HOST.handheld, HOST.hist): the top bar fits at 320, 360, 390 and 430 px and on an iPad either way
  // round (no overflow, no button's text clipped, nothing overlapping) on the Stories screen, in a story with focus mode
  // on and off and in explore mode; AR in focus mode's top bar where the phone has it and not where it has none; the AR
  // invitation once per device (not again after a reload); the back button (a story opened from the Stories screen is an
  // entry of its own; back closes Text first; forward goes back in); full screen asked for within the tap that opens a
  // story (a stub counts it), never with a pretend headset session, its toggle in More only where the browser has full
  // screen; the iPhone's Home Screen tip once (an iPhone without full screen) and never when opened from the Home Screen;
  // the timeline's touch strip at least 20 px from the screen's edges
  {
    const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
    const fakeXR = (ar, vr) => `Object.defineProperty(navigator, 'xr', { configurable: true, value: { isSessionSupported: m => Promise.resolve(m === 'immersive-ar' ? ${ar} : m === 'immersive-vr' ? ${vr} : false), requestSession: () => Promise.reject(new DOMException('a pretend phone', 'NotSupportedError')), addEventListener() {}, removeEventListener() {} } });`;
    const fsStub = 'Element.prototype.requestFullscreen = function () { window.__fs = (window.__fs || 0) + 1; return Promise.resolve(); };';
    const noFs = "Object.defineProperty(Document.prototype, 'fullscreenEnabled', { configurable: true, get: () => false }); delete Element.prototype.requestFullscreen; delete Element.prototype.webkitRequestFullscreen;";
    const open = async (opts, init, hash) => {
      const ctx = await browser.newContext(opts);
      for (const s of init) await ctx.addInitScript(s);
      const p = await ctx.newPage();
      watch(p);
      await p.goto(base + 'index.html' + hash);
      await p.waitForFunction(() => typeof HOST !== 'undefined' && HOST.handheld && HOST.cur, null, { timeout: 60000 });
      return { ctx, p };
    };
    const frames = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const topBad = p => p.evaluate(() => {
      const t = document.getElementById('top'), out = [], vw = innerWidth;
      if (t.scrollWidth > t.clientWidth + 0.5) out.push(`the bar is ${t.scrollWidth} px wide in ${t.clientWidth}`);
      for (const e of t.children) {
        if (e.id === 'fcMenu' || getComputedStyle(e).display === 'none') continue;
        const r = e.getBoundingClientRect();
        if (!r.width) continue;
        if (r.left < -0.5 || r.right > vw + 0.5) out.push(`${e.id || e.className} outside the page`);
        if (e.tagName === 'BUTTON' && e.scrollWidth > e.clientWidth + 0.5) out.push(`${e.id}'s text clipped ("${e.textContent}")`);
      }
      const b = t.querySelector('.brand');
      if (b.clientWidth + 0.5 < Math.min(b.scrollWidth, 60)) out.push(`the title squeezed to ${b.clientWidth} px`);
      return out;
    });
    const shown = (p, id) => p.evaluate(id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, id);
    const modes = [['the Stories screen', () => { HOST.openPicker(); }], ['a story, focus mode on', () => { HOST.closePicker(); HOST.focus.set(true); HOST.cur.collab.APP.enterStory(20); }],
      ['a story, focus mode off', () => { HOST.focus.set(false); }], ['explore mode, focus mode off', () => { HOST.cur.collab.APP.enterExplore(); }],
      ['explore mode, focus mode on', () => { HOST.focus.set(true); }]];
    await step('phones: the top bar fits at 320, 360, 390 and 430 px (AR and VR, Install, the sound), AR always in it', async () => {
      const { ctx, p } = await open(phone, [fakeXR(true, true)], '#stories');
      await p.waitForFunction(() => HOST.picking && HOST.handheld.state().ar && !document.getElementById('btnVR').hidden, null, { timeout: 30000 }).catch(() => {});
      await p.evaluate(() => { document.getElementById('btnInstall').hidden = false; });   // (as when the browser offers to install)
      for (const [name, f] of modes) {
        await p.evaluate(f);
        for (const w of [320, 360, 390, 430]) {
          await p.setViewportSize({ width: w, height: 800 }); await frames(p);
          for (const b of await topBad(p)) errors.push(`${w} px, ${name}: ${b}`);
          if (!await shown(p, 'btnAR')) errors.push(`${w} px, ${name}: AR is not in the top bar`);
          if (/focus mode on/.test(name)) for (const b of await bars(p)) errors.push(`${w} px, ${name}: ${b}`);
        }
      }
      // More: what has no room, and Focus view in a story; on the Stories screen it opens there
      await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => { HOST.focus.set(false); HOST.cur.collab.APP.enterStory(20); }); await frames(p);
      await p.click('#fcMore');
      const m = await p.evaluate(() => [...document.querySelectorAll('#fcMenu button')].map(b => b.textContent));
      for (const want of ['Explore now', 'Install', 'Focus view: off']) if (!m.includes(want)) errors.push(`More holds ${m.join(', ')}: no ${want}`);
      await p.click('#fcMore');
      await p.evaluate(() => HOST.openPicker()); await frames(p);
      await p.click('#fcMore');
      const pk = await p.evaluate(() => ({ picking: HOST.picking, open: !document.getElementById('fcMenu').hidden, items: [...document.querySelectorAll('#fcMenu button')].map(b => b.textContent) }));
      if (!pk.picking || !pk.open || !pk.items.includes('Explore now') || pk.items.includes('Focus view: off')) errors.push(`More on the Stories screen: ${JSON.stringify(pk)}`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);   // (back there leaves the page: nothing of ours is under it)
      if (await p.evaluate(() => !document.getElementById('fcMenu').hidden || !HOST.picking)) errors.push('Escape on the Stories screen did not close More first');
      await ctx.close();
    });
    await step('tablets: the top bar fits on an iPad (1180 x 820 and 820 x 1180)', async () => {
      const { ctx, p } = await open({ viewport: { width: 1180, height: 820 }, hasTouch: true }, [], '#stories');
      await p.waitForFunction(() => HOST.picking, null, { timeout: 30000 });
      for (const [name, f] of modes) {
        await p.evaluate(f);
        for (const [w, h] of [[1180, 820], [820, 1180]]) {
          await p.setViewportSize({ width: w, height: h }); await frames(p);
          for (const b of await topBad(p)) errors.push(`iPad ${w} x ${h}, ${name}: ${b}`);
        }
      }
      await ctx.close();
    });
    await step('phones: AR in focus mode\'s top bar only where the phone has it; the invitation once', async () => {
      const { ctx, p } = await open(phone, [fakeXR(true, false)], '#airports&t=1');
      await p.waitForFunction(ready, null, { timeout: 60000 });
      await p.waitForFunction(() => HOST.handheld.state().ar, null, { timeout: 10000 }).catch(() => {});
      const a = await p.evaluate(() => ({ focus: HOST.focus(), text: document.getElementById('btnAR').innerText.trim() }));
      if (!a.focus || !await shown(p, 'btnAR') || a.text !== 'AR') errors.push(`AR is not in focus mode's top bar (${JSON.stringify(a)})`);
      const card = () => p.waitForFunction(() => !document.getElementById('hhCard').hidden, null, { timeout: 15000 }).then(() => true, () => false);
      if (!await card()) errors.push('no AR invitation as the story opened');
      else {
        const c = await p.evaluate(() => ({ title: document.getElementById('hhTitle').textContent, go: document.getElementById('hhGo').textContent, kept: localStorage.getItem('arInvite') }));
        if (c.title !== 'See it in your room' || c.go !== 'Enter AR' || !c.kept) errors.push(`the invitation: ${JSON.stringify(c)}`);
        await p.click('#hhNo');
        if (!await p.evaluate(() => document.getElementById('hhCard').hidden)) errors.push('Not now did not close the invitation');
      }
      await p.reload();
      await p.waitForFunction(ready, null, { timeout: 60000 });
      await p.waitForTimeout(5000);
      if (!await p.evaluate(() => document.getElementById('hhCard').hidden)) errors.push('the invitation came again after a reload');
      await ctx.close();
      const n = await open(phone, [fakeXR(false, false)], '#airports&t=1');
      await n.p.waitForFunction(ready, null, { timeout: 60000 });
      await n.p.waitForTimeout(5000);
      if (await shown(n.p, 'btnAR') || !await n.p.evaluate(() => document.getElementById('hhCard').hidden)) errors.push('a phone without AR shows AR or the invitation');
      await n.ctx.close();
    });
    await step('phones: back returns to the Stories screen and closes Text first; full screen asked for within the tap, not in a headset session', async () => {
      const { ctx, p } = await open(phone, [fsStub, fakeXR(false, false)], '#stories');   // (Enter VR below asks a pretend WebXR)
      await p.waitForFunction(() => HOST.picking, null, { timeout: 30000 });
      const st = () => p.evaluate(() => ({ picking: HOST.picking, key: HOST.curKey, hash: location.hash, up: !!(history.state && history.state.nwUp), text: HOST.focus.text(), fs: window.__fs || 0 }));
      await p.click('#picker [data-story="proteins"]');
      await p.waitForFunction(() => HOST.curKey === 'proteins' && !HOST.picking && HOST.cur.collab.scene(), null, { timeout: 60000 });
      let s = await st();
      if (!s.up || s.hash !== '#proteins' || s.fs !== 1) errors.push(`a story from the Stories screen: ${JSON.stringify(s)} (an entry of its own, full screen asked for once)`);
      await p.evaluate(() => history.back());
      await p.waitForFunction(() => HOST.picking, null, { timeout: 5000 }).catch(() => {});
      s = await st();
      if (!s.picking || s.hash !== '#stories' || s.up) errors.push(`back did not return to the Stories screen (${JSON.stringify(s)})`);
      await p.evaluate(() => history.forward());
      await p.waitForFunction(() => !HOST.picking, null, { timeout: 5000 }).catch(() => {});
      s = await st();
      if (s.picking || s.key !== 'proteins' || s.hash !== '#proteins' || s.fs !== 1) errors.push(`forward did not go back into the story (${JSON.stringify(s)})`);
      await p.click('#fcText');
      await p.evaluate(() => history.back()); await p.waitForTimeout(600);
      s = await st();
      if (s.picking || s.text || !s.up || s.hash !== '#proteins') errors.push(`back with Text open: ${JSON.stringify(s)} (Text closed, still in the story)`);
      // the Stories button goes back to the Stories screen's entry: no entries pile up
      const len = await p.evaluate(() => history.length);
      for (const k of ['airports', 'proteins']) {
        await p.click('#btnOther');
        await p.click(`#picker [data-story="${k}"]`);
        await p.waitForFunction(k => HOST.curKey === k && !HOST.picking && !HOST.busy && HOST.cur.collab.scene(), k, { timeout: 60000 });
      }
      await p.waitForTimeout(600);
      s = await st();
      if (await p.evaluate(() => history.length) !== len || !s.up) errors.push(`the history grew with Stories and a card (${len} entries, then ${await p.evaluate(() => history.length)}; ${JSON.stringify(s)})`);
      // a pretend headset session, and Enter VR just pressed (a session being asked for): no full screen asked for
      await p.evaluate(() => { HOST.session = { visibilityState: 'visible', renderState: {}, addEventListener() {}, removeEventListener() {} }; HOST.openPicker(); });
      await p.click('#picker [data-story="proteins"]');
      await p.evaluate(() => { HOST.session = null; HOST.openPicker(); document.getElementById('btnVR').click(); });
      await p.click('#picker [data-story="proteins"]');
      await p.waitForFunction(() => !HOST.picking, null, { timeout: 10000 }).catch(() => {});
      const fs = await p.evaluate(() => window.__fs);
      if (fs !== 3) errors.push(`full screen asked for ${fs} times (3 taps on a card outside a headset session, then 2 with one or with Enter VR just pressed)`);
      // its toggle in More
      await p.click('#fcMore');
      if (!await p.evaluate(() => [...document.querySelectorAll('#fcMenu button')].some(b => b.textContent === 'Full screen'))) errors.push('no Full screen in More');
      await p.click('#fcMore');
      // the timeline's touch strip clear of the edges, focus mode on and off
      for (const on of [true, false]) {
        await p.evaluate(on => HOST.focus.set(on), on); await frames(p);
        const r = await p.evaluate(() => { const r = document.getElementById('track').getBoundingClientRect(); return { l: r.left, r: innerWidth - r.right, h: r.height }; });
        if (r.l < 20 || r.r < 20 || r.h < 24) errors.push(`the timeline (focus mode ${on ? 'on' : 'off'}) is ${Math.round(r.l)} and ${Math.round(r.r)} px from the edges, ${Math.round(r.h)} px tall`);
      }
      await ctx.close();
      const n = await open(phone, [noFs], '#airports&t=1');
      await n.p.waitForFunction(ready, null, { timeout: 60000 });
      await n.p.click('#fcMore');
      if (await n.p.evaluate(() => [...document.querySelectorAll('#fcMenu button')].some(b => /full screen/i.test(b.textContent)))) errors.push('Full screen in More where the browser has none');
      await n.ctx.close();
    });
    await step('iPhone: the Home Screen tip once, not again, never when opened from the Home Screen', async () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
      const noXR = "Object.defineProperty(navigator, 'xr', { configurable: true, value: undefined });";
      const { ctx, p } = await open({ ...phone, userAgent: ua }, [noFs, noXR], '#airports&t=1');
      await p.waitForFunction(ready, null, { timeout: 60000 });
      const tip = await p.waitForFunction(() => !document.getElementById('hhCard').hidden, null, { timeout: 15000 }).then(() => true, () => false);
      const t = await p.evaluate(() => ({ text: document.getElementById('hhText').textContent, go: document.getElementById('hhGo').hidden, kept: localStorage.getItem('homeTip'), ar: getComputedStyle(document.getElementById('btnAR')).display }));
      if (!tip || !/Share, then Add to Home Screen/.test(t.text) || !t.go || !t.kept || t.ar !== 'none') errors.push(`the iPhone tip: ${tip} ${JSON.stringify(t)}`);
      await p.evaluate(() => HOST.handheld.close());
      await p.reload();
      await p.waitForFunction(ready, null, { timeout: 60000 });
      await p.waitForTimeout(5000);
      if (!await p.evaluate(() => document.getElementById('hhCard').hidden)) errors.push('the iPhone tip came again after a reload');
      await ctx.close();
      const s = await open({ ...phone, userAgent: ua }, [noFs, noXR, "Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });"], '#airports&t=1');
      await s.p.waitForFunction(ready, null, { timeout: 60000 });
      await s.p.waitForTimeout(5000);
      if (!await s.p.evaluate(() => document.getElementById('hhCard').hidden)) errors.push('the iPhone tip shows on the Home Screen app');
      await s.ctx.close();
    });
  }
  await step('focus mode: a desktop page is off and as ever', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } }), dp = await ctx.newPage();
    watch(dp);
    await dp.goto(base + 'index.html#airports&t=20');
    await dp.waitForFunction(ready, null, { timeout: 60000 });
    await dp.waitForTimeout(300);
    const s = await dp.evaluate(() => {
      const r = id => document.getElementById(id).getBoundingClientRect();
      return { on: HOST.focus.on(), focus: HOST.focus(), body: document.body.classList.contains('focus'), top: r('top').height, panel: [r('panel').left, r('panel').top, r('panel').width > 300],
        fc: [...document.querySelectorAll('.fc, #subs, #chtitle')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.id), names: [...document.querySelectorAll('#track .name')].filter(e => getComputedStyle(e).display !== 'none').length };
    });
    if (s.on || s.focus || s.body || Math.abs(s.top - 58) > 1 || s.panel[0] !== 22 || s.panel[1] !== 66 || !s.panel[2] || s.fc.length || s.names < 5) errors.push(`a desktop page: ${JSON.stringify(s)}`);
    await ctx.close();
  });
}
// Developer mode (v125, HOST.dev in index.html; NEWS in shared.js): this device's own, off by default. While on, what is
// new in this release (whatsnew.json, served by the test server; a stand-in served instead where a step says so) shows as
// a card over the Stories screen or the story a link opened, once a page load until Got it for that version (devSeen);
// Later until the next page load. In a headset session the menu opens by itself at its page (the Debug tab's) after the
// welcome, Got it or Later closing it again; Got it for that version: not again; off: never. The menu's Settings row and
// the Debug tab's What is new. In a page of its own (its own storage, as a new device)
if (runs('developer mode')) {
  const step = (name, fn) => smokeStep(name, async () => { try { await fn(); } catch (e) { errors.push(name + ': ' + (e.stack || e.message)); } });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  const dp = await ctx.newPage();
  dp.on('pageerror', e => errors.push('developer mode: ' + (e.stack || e.message)));
  dp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('developer mode: ' + m.text()); });
  const open = async (hash, key) => {
    await dp.goto('about:blank');
    await dp.goto(base + 'index.html' + (hash || ''));
    await dp.waitForFunction(k => typeof HOST !== 'undefined' && HOST.dev && HOST.cur && HOST.curKey === (k || HOST.list[0].key) && HOST.cur.collab.scene(), key || '', { timeout: 60000 });
  };
  // the card as it shows: open, its title, date, the headings and items under each, the note
  const card = () => dp.evaluate(() => {
    const c = document.getElementById('devCard'), lists = {};
    for (const h of c.querySelectorAll('#devBody h3')) lists[h.className] = [...h.nextElementSibling.querySelectorAll('li')].map(li => li.textContent);
    return { open: !c.hidden && getComputedStyle(c).display !== 'none', title: document.getElementById('devTitle').textContent, date: document.getElementById('devDate').textContent,
      lists, msg: (c.querySelector('#devBody .msg') || {}).textContent || '', picking: HOST.picking, key: HOST.curKey, on: HOST.dev.on(),
      got: getComputedStyle(document.getElementById('devGot')).display !== 'none', later: getComputedStyle(document.getElementById('devLater')).display !== 'none', focus: (document.activeElement || {}).id || '' };
  });
  const cardOpen = ms => dp.waitForFunction(() => !document.getElementById('devCard').hidden && !HOST.dev.busy(), null, { timeout: ms || 30000 }).then(() => true, () => false);
  const ls = k => dp.evaluate(k => localStorage.getItem(k), k);
  let file = null;
  // a stand-in for whatsnew.json (or a status: the file not there)
  const serve = async (o, ms) => { await dp.unroute('**/whatsnew.json*'); if (o) await dp.route('**/whatsnew.json*', async r => { if (ms) await new Promise(x => setTimeout(x, ms)); await (typeof o === 'number' ? r.fulfill({ status: o, body: 'no' }) : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) })); }); };
  await step('developer mode: off by default, nothing shown; the switch and What is new at the Stories screen\'s foot', async () => {
    await open('');
    file = await dp.evaluate(() => fetch('whatsnew.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json()));
    if (!file || !/^networks-v\d+$/.test(file.version) || !['new', 'test', 'untested'].every(k => Array.isArray(file[k]) && file[k].length)) errors.push('developer mode: whatsnew.json is not a release\'s lists: ' + JSON.stringify(file));
    await dp.waitForTimeout(2500);
    const c = await card(), b = await dp.evaluate(() => ['btnDev', 'btnNews'].map(id => { const e = document.getElementById(id); return e && getComputedStyle(e).display !== 'none' ? e.textContent + '/' + (e.getAttribute('aria-pressed') || '') : ''; }));
    if (c.on || c.open || await ls('devMode') !== null || !c.picking) errors.push('developer mode: not off by default with nothing shown on the Stories screen: ' + JSON.stringify(c));
    if (b.join() !== 'Developer mode: off/false,What is new/') errors.push('developer mode: the Stories screen\'s foot has ' + JSON.stringify(b));
  });
  await step('developer mode: #dev=on shows the card over the Stories screen with the file\'s lists; Got it keeps it away for that version; another version shows it again; Later and Escape until the next load', async () => {
    const short = v => v.replace(/^networks-/, '');
    await open('#dev=on');
    const shown = await cardOpen(), c1 = await card();
    if (!shown || !c1.on || !c1.picking || c1.title !== 'What is new in ' + short(file.version) || c1.date !== file.date || JSON.stringify(c1.lists) !== JSON.stringify({ new: file.new, test: file.test, untested: file.untested }) || await ls('devMode') !== 'on')
      errors.push('developer mode: #dev=on did not show the file\'s card over the Stories screen: ' + JSON.stringify(c1));
    await dp.click('#devGot');
    const c2 = await card();
    if (c2.open || await ls('devSeen') !== file.version) errors.push('developer mode: Got it did not close the card and keep its version: ' + JSON.stringify([c2.open, await ls('devSeen')]));
    await dp.reload(); await dp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.dev && HOST.cur && HOST.cur.collab.scene(), null, { timeout: 60000 });
    await dp.waitForTimeout(2500);
    if ((await card()).open) errors.push('developer mode: the card came again after Got it for the same version');
    // another release's file: shown again (no Untested heading when its list is empty)
    await serve({ version: 'networks-v999', date: '1 January 2027', new: ['A new thing.'], test: ['Test the new thing.', 'And this.'], untested: [] });
    await dp.reload();
    const again = await cardOpen(60000), c3 = await card();
    if (!again || c3.title !== 'What is new in v999' || JSON.stringify(c3.lists) !== JSON.stringify({ new: ['A new thing.'], test: ['Test the new thing.', 'And this.'] })) errors.push('developer mode: another version\'s file did not show again: ' + JSON.stringify(c3));
    await dp.click('#devLater');
    const c4 = await card();
    if (c4.open || await ls('devSeen') !== file.version) errors.push('developer mode: Later did not close the card, or it kept the new version: ' + JSON.stringify([c4.open, await ls('devSeen')]));
    await dp.reload();
    const back = await cardOpen(60000);
    await dp.keyboard.press('Escape');
    const c5 = await card();
    if (!back || c5.open || !c5.picking) errors.push('developer mode: after Later the next load did not show it again, or Escape did not close it (leaving the Stories screen): ' + JSON.stringify([back, c5]));
  });
  await step('developer mode: a link into a story shows the card over the story; What is new by hand; a file that cannot be fetched said in one line; #dev=off', async () => {
    await open('#airports', 'airports');
    const shown = await cardOpen(), c1 = await card();
    if (!shown || c1.picking || c1.key !== 'airports' || c1.title !== 'What is new in v999') errors.push('developer mode: a link into a story did not show the card over it: ' + JSON.stringify(c1));
    await dp.click('#devGot');
    // by hand (seen already): beside the switch on the Stories screen
    await dp.evaluate(() => HOST.openPicker());
    await dp.click('#btnNews');
    const hand = await cardOpen(), c2 = await card();
    if (!hand || c2.title !== 'What is new in v999') errors.push('developer mode: What is new did not open it by hand: ' + JSON.stringify(c2));
    await dp.click('#devLater');
    // the file not there: one line
    await serve(404);
    await dp.evaluate(() => localStorage.removeItem('devSeen'));
    await dp.reload();
    const bad = await cardOpen(60000);
    await dp.waitForTimeout(400);
    const c3 = await card();
    if (!bad || c3.msg !== 'Could not fetch what is new (whatsnew.json): the server answered 404.' || Object.keys(c3.lists).length || c3.title !== 'What is new') errors.push('developer mode: a file that cannot be fetched: ' + JSON.stringify(c3));
    if (c3.got || !c3.later || c3.focus !== 'devLater') errors.push('developer mode: a file that cannot be fetched: not Later alone (focused): ' + JSON.stringify([c3.got, c3.later, c3.focus]));
    await dp.click('#devLater');
    // while the file is fetched (a slow server): Later alone, then Got it once it has come
    await serve({ version: 'networks-v999', date: '1 January 2027', new: ['A new thing.'], test: ['Test it.'], untested: [] }, 1500);
    await dp.evaluate(() => HOST.dev.card(true, 'hand'));
    const f1 = await card(), came = await cardOpen(10000), f2 = await card();
    if (!f1.open || f1.msg !== 'Fetching what is new...' || f1.got || !f1.later || !came || !f2.got || !f2.later || f2.title !== 'What is new in v999')
      errors.push('developer mode: while the file is fetched, Later alone, then Got it: ' + JSON.stringify([f1, f2].map(c => [c.open, c.msg, c.got, c.later, c.title])));
    await dp.click('#devLater');
    await serve(null);
    // the switch at the Stories screen's foot, and #dev=off
    await dp.click('#btnDev');
    const off = await dp.evaluate(() => [HOST.dev.on(), localStorage.getItem('devMode'), document.getElementById('btnDev').textContent]);
    await dp.click('#btnDev');
    await open('#dev=off');
    await dp.waitForTimeout(2000);
    const c4 = await card();
    if (off.join() !== 'false,off,Developer mode: off' || c4.on || c4.open || await ls('devMode') !== 'off') errors.push('developer mode: the switch or #dev=off: ' + JSON.stringify([off, c4]));
  });
  await step('developer mode: More has Developer mode and What is new where it shows', async () => {
    await dp.setViewportSize({ width: 600, height: 760 });
    await open('#airports&t=10', 'airports');
    await dp.waitForTimeout(500);
    if (!await dp.evaluate(() => getComputedStyle(document.getElementById('fcMore')).display !== 'none')) { errors.push('developer mode: no More at 600 px'); return; }
    await dp.click('#fcMore');
    const m = await dp.evaluate(() => [...document.querySelectorAll('#fcMenu button')].map(b => b.textContent + '/' + (b.getAttribute('aria-pressed') || '')));
    if (!m.includes('Developer mode: off/false') || !m.includes('What is new/')) errors.push('developer mode: More holds ' + m.join(', '));
    await dp.click('#fcMenu button[data-dev="on"]');
    const on = await dp.evaluate(() => HOST.dev.on());
    await dp.click('#fcMore');
    await dp.click('#fcMenu button[data-news]');
    const shown = await cardOpen(), c = await card();
    if (!on || !shown || c.picking) errors.push('developer mode: More\'s items did not turn it on or open the card over the story: ' + JSON.stringify([on, c]));
    await dp.click('#devLater');
    await dp.setViewportSize({ width: 1280, height: 760 });
  });
  // a pretend headset session (as the headset settings' steps make one: the story's frame loop stopped, its frames and
  // the shell's driven here), with the welcome on and shorter (1.5 s), so what is new comes after it
  const sx = s => dp.evaluate(s => HOST.cur.peek(s), s);
  const xr = async (key, welcome) => {
    await open('#' + key, key);
    await dp.evaluate(w => {
      HOST.collab.autoWelcome(w); HOST.collab.welcomeMs(1500);
      const dc = () => !document.getElementById('devCard').hidden;
      HOST.dev.card(true, 'hand'); window.__devCard = [dc()];   // (open as the session starts: it closes, as Later)
      window.__head = { p: [0, 1.6, 0], q: [0, 0, 0, 1] };
      const pose = () => { const h = window.__head; return { transform: { position: { x: h.p[0], y: h.p[1], z: h.p[2] }, orientation: { x: h.q[0], y: h.q[1], z: h.q[2], w: h.q[3] } } }; };
      window.__frame = { getViewerPose: pose };
      window.__raf = [];
      HOST.renderer.xr.getReferenceSpace = () => ({});
      HOST.renderer.setAnimationLoop(null);
      window.__s = { visibilityState: 'visible', renderState: {}, environmentBlendMode: 'opaque', enabledFeatures: [], inputSources: [],
        addEventListener() {}, removeEventListener() {}, requestAnimationFrame: cb => window.__raf.push(cb) };
      HOST.session = window.__s;
      window.__devCard.push(dc(), HOST.dev.state().later);
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
    }, !!welcome);
  };
  // frames for up to ms (10 a second), until what is new shows: [ms, welcome shown, what is new shown] each
  const run = ms => dp.evaluate(async ms => {
    const out = [], t0 = performance.now();
    while (performance.now() - t0 < ms) {
      window.__tick(1);
      const w = HOST.collab.welcome(), n = HOST.collab.whatsNew();
      out.push([Math.round(performance.now() - t0), w.shown ? 1 : 0, n.shown ? 1 : 0]);
      if (n.shown) break;
      await new Promise(r => setTimeout(r, 100));
    }
    return out;
  }, ms);
  const press = id => dp.evaluate(id => { window.__tick(1); const r = HOST.collab.menuFind(id); if (r && r.fn) r.fn(); window.__tick(1); return !!(r && r.fn); }, id);
  const st = () => dp.evaluate(() => ({ ...HOST.collab.whatsNew(), open: HOST.collab.menu, tab: HOST.collab.overlay().panel.regions.map(r => r.id).filter(i => /^news:/.test(i)), seen: localStorage.getItem('devSeen') }));
  await step('developer mode in a headset: after the welcome the menu opens at what is new; Later closes it (again next session); Got it closes it and not again; off, never', async () => {
    const bad = [];
    await serve(null);
    await dp.evaluate(() => { localStorage.setItem('devMode', 'on'); localStorage.removeItem('devSeen'); });
    // with developer mode on: the welcome first, then (once it has gone) the menu at what is new
    await xr('qubits', true);
    const dc = await dp.evaluate(() => window.__devCard);
    if (dc.join() !== 'true,false,true') bad.push('the page\'s card did not close as the session started (open before, after, Later): ' + JSON.stringify(dc));
    const r1 = await run(15000), s1 = await st();
    const wFirst = r1.findIndex(x => x[1]), wLast = r1.map(x => x[1]).lastIndexOf(1), nAt = r1.findIndex(x => x[2]);
    if (wFirst < 0 || nAt < 0 || nAt <= wLast || r1.some(x => x[1] && x[2])) bad.push('not after the welcome: ' + JSON.stringify(r1.filter((x, i) => !i || x[1] !== r1[i - 1][1] || x[2] !== r1[i - 1][2])));
    if (!(s1.shown && s1.fl === 1 && s1.menu && s1.open && s1.tab.join() === 'news:got,news:later')) bad.push('the menu did not open at what is new (its Got it and Later): ' + JSON.stringify(s1));
    await press('news:later');
    const s2 = await st();
    if (s2.shown || s2.open || s2.fl !== 3 || s2.seen !== null) bad.push('Later did not close it and the menu (nothing kept): ' + JSON.stringify(s2));
    // the next session: again, and Got it
    await xr('qubits', true);
    const r3 = await run(15000), s3 = await st();
    if (!r3.some(x => x[2]) || !s3.shown || s3.fl !== 1) bad.push('after Later it did not show again the next session: ' + JSON.stringify(s3));
    await press('news:got');
    const s4 = await st();
    if (s4.shown || s4.open || s4.fl !== 2 || s4.seen !== file.version) bad.push('Got it did not close it and the menu, keeping its version: ' + JSON.stringify(s4));
    // the next session: not again (seen); with the welcome off as in the other tests, the same
    await xr('qubits', false);
    const r5 = await run(6000), s5 = await st();
    if (r5.some(x => x[2]) || s5.fl !== 2 || s5.open) bad.push('after Got it it showed again the next session: ' + JSON.stringify(s5));
    // with the welcome off it still comes, a moment into the session
    await dp.evaluate(() => localStorage.removeItem('devSeen'));
    await xr('qubits', false);
    const r6 = await run(10000), s6 = await st();
    if (!r6.some(x => x[2]) || r6.find(x => x[2])[0] < 2000 || !s6.shown) bad.push('with the welcome off it did not come a moment into the session: ' + JSON.stringify([r6.slice(-1), s6]));
    await press('news:later');
    // developer mode off: never
    await dp.evaluate(() => { localStorage.setItem('devMode', 'off'); localStorage.removeItem('devSeen'); });
    await xr('qubits', true);
    const r7 = await run(9000), s7 = await st();
    if (r7.some(x => x[2]) || s7.fl !== 0 || s7.open || !r7.some(x => x[1])) bad.push('developer mode off: it showed (or the welcome did not): ' + JSON.stringify([s7, r7.some(x => x[1])]));
    if (bad.length) errors.push(...bad.map(b => 'developer mode in a headset: ' + b));
  });
  await step('developer mode in a headset: the menu\'s Settings row turns it on and off; the Debug tab\'s What is new opens its page by hand, Back to the tab', async () => {
    const bad = [];
    await dp.evaluate(() => { HOST.collab.panelOpen(true); window.__tick(2); });
    const t1 = await press('devmode'), on = await dp.evaluate(() => [HOST.dev.on(), localStorage.getItem('devMode')]);
    const t2 = await press('devmode'), off = await dp.evaluate(() => HOST.dev.on());
    if (!t1 || !t2 || on.join() !== 'true,on' || off) bad.push('the Settings row: ' + JSON.stringify([t1, on, t2, off]));
    const t3 = await press('whatsnew');
    await dp.waitForFunction(() => !HOST.dev.busy(), null, { timeout: 10000 });
    await dp.evaluate(() => window.__tick(2));
    const s1 = await st();
    if (!t3 || !s1.shown || s1.fl !== 0 || !s1.open || s1.tab.join() !== 'news:got,news:later') bad.push('the Debug tab\'s What is new: ' + JSON.stringify([t3, s1]));
    await press('news:later');
    const s2 = await st(), ids = await dp.evaluate(() => HOST.collab.overlay().panel.regions.map(r => r.id));
    if (s2.shown || !s2.open || !ids.includes('whatsnew')) bad.push('Back did not go back to the Debug tab (the menu open): ' + JSON.stringify([s2, ids.slice(0, 12)]));
    await dp.evaluate(() => { HOST.collab.panelOpen(false); window.__tick(1); });
    // the file not there (a new page, so nothing fetched before it): Back alone (no Got it), then Back to the tab
    await serve(404);
    await xr('qubits', false);
    await dp.evaluate(() => { HOST.collab.panelOpen(true); window.__tick(2); });
    await press('whatsnew');
    await dp.waitForFunction(() => !HOST.dev.busy(), null, { timeout: 10000 });
    await dp.evaluate(() => window.__tick(2));
    const s3 = await st();
    if (!s3.shown || s3.tab.join() !== 'news:later' || await dp.evaluate(() => !!HOST.dev.data())) bad.push('the file not there: not Back alone: ' + JSON.stringify(s3));
    await press('news:later');
    await serve(null);
    await dp.evaluate(() => { HOST.collab.panelOpen(false); window.__tick(1); });
    if (bad.length) errors.push(...bad.map(b => 'developer mode in a headset: ' + b));
  });
  await ctx.close();
}
// The PC's trackers (v126, "the PC's trackers" in shared.js; tools/trackers/SPEC.md), in a page of its own, in a room on
// this device (no relay: the relay's side is relay/test.mjs's, and the whole chain the merged collab --trackers round's).
// @trk fed as the relay sends it (HOST.collab.trkIn, through the shell's own intake), at times held for the test
// (HOST.collab.trkTime): smoothing, carrying on, ok false after 0.5 s, nothing passed to the story or taken from a member;
// the Shared dialog's Trackers section with the relay's answers stubbed (/api/ping, /api/trackers, /api/trackers/still):
// the room's switch, lining up by hand (spots taken, refused, written into trk.m), names, a row lit while its tracker moves,
// the room map's dots; a pretend VR headset (not a Quest's browser) in the room: the trackers' frame source from a pretend
// Index head ('h') against its own head in local-floor, turned and moved (within 1 cm and 0.5 degrees), followed when
// SteamVR's space shifts, a head turning fast with the two clocks 30 ms apart adding nothing, lineUp's words, the menu's
// question answered for it; the pucks (Trackers: shown on the Debug tab, kept); a person's head and hands (body) and
// presence's grips in the order left, right
if (runs('trackers')) {
  const step = (name, fn) => smokeStep(name, async () => { try { await fn(); } catch (e) { errors.push(name + ': ' + (e.stack || e.message)); } });
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 760 } });
  const tp = await ctx.newPage();
  tp.on('pageerror', e => errors.push('trackers: ' + (e.stack || e.message)));
  tp.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('trackers: ' + m.text()); });
  await tp.goto(base + 'index.html#airports&peer=off');
  await tp.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'airports' && HOST.cur && HOST.cur.peek('typeof ST !== "undefined" && ST.items.length > 0 && !!XR.panelGroup'), null, { timeout: 60000 });
  await tp.evaluate(() => { HOST.collab.autoAll(false); HOST.collab.autoGuide(false); HOST.collab.create(); });
  await tp.waitForFunction(() => HOST.collab.code && HOST.collab.local && HOST.collab.internals().welcomed && HOST.collab.internals().ready, null, { timeout: 20000 });
  // the story's effect hook watched: @trk must never reach it. Its own frames stopped (the globe drawn in software would
  // starve the page's timers, which the dialog's polls and the pump run on; the headset's frames are driven below)
  await tp.evaluate(() => { const h = HOST.cur.collab, e = h.effect; window.__eff = 0; h.effect = function () { window.__eff++; return e.apply(this, arguments); }; HOST.renderer.setAnimationLoop(null); });

  await step('trackers: @trk is the shell\'s own (never the story\'s, never a member\'s), drawn 40 ms behind between its samples, carried on 100 ms at most, ok false after 0.5 s', async () => {
    const bad = await tp.evaluate(() => {
      const bad = [], C = HOST.collab, yq = a => [0, Math.sin(a / 2), 0, Math.cos(a / 2)], T0 = 100000, dt = 1000 / 60;
      const near = (a, b, e) => a.length === b.length && a.every((x, k) => Math.abs(x - b[k]) <= e);
      C.setTrk({ on: true, names: { 'LHR-A': 'Lamp' } });
      // LHR-A goes along x at 1 m/s turning about y at 90 degrees a second; LHR-B lies still, not seen well
      const row = at => ['LHR-A', 1 + (at - T0) / 1000, 0.5, 2, ...yq((at - T0) / 1000 * Math.PI / 2), 1, 0, 0, 1, 't'];
      for (let k = 0; k <= 8; k++) { const at = T0 + k * dt; C.trkIn({ at, l: 'hand', t: [row(at), ['LHR-B', -1, 0, 0, 0, 0, 0, 1, 0.5, 0, 0, 0, 't']] }); }
      const last = T0 + 8 * dt, x = at => 1 + (at - T0) / 1000;
      // between two samples: where it was 40 ms before the time held
      C.trkTime(T0 + 4 * dt + 45);
      let A = C.tracker('LHR-A');
      if (!A || !near(A.p, [x(T0 + 4 * dt + 5), 0.5, 2], 1e-6) || !near(A.q, yq((4 * dt + 5) / 1000 * Math.PI / 2), 1e-4) || !A.ok || A.kind !== 't' || A.name !== 'Lamp') bad.push('between its samples: ' + JSON.stringify(A));
      // past the last: carried on by its velocity, for at most 100 ms; still seen within 0.5 s
      C.trkTime(last + 40 + 60); A = C.tracker('LHR-A');
      if (!near(A.p, [x(last) + 0.06, 0.5, 2], 1e-6) || !A.ok) bad.push('60 ms past its last sample: ' + JSON.stringify(A));
      C.trkTime(last + 40 + 300); A = C.tracker('LHR-A');
      if (!near(A.p, [x(last) + 0.1, 0.5, 2], 1e-6) || !A.ok || A.age !== 340) bad.push('300 ms past its last sample (carried 100 ms at most, seen): ' + JSON.stringify(A));
      C.trkTime(last + 600); A = C.tracker('LHR-A');
      if (!near(A.p, [x(last) + 0.1, 0.5, 2], 1e-6) || A.ok || A.age !== 600) bad.push('not heard of for 600 ms (ok false, its last pose kept): ' + JSON.stringify(A));
      const B = C.tracker('LHR-B');
      if (!B || B.ok || !near(B.p, [-1, 0, 0], 1e-9)) bad.push('one its row says is not seen well (held, not carried): ' + JSON.stringify(B));
      // bad rows, a late sample and a member's @trk are ignored
      C.trkIn({ at: last + 10, l: 'hand', t: [['', 1, 1, 1, 0, 0, 0, 1], ['LHR-C', NaN, 0, 0, 0, 0, 0, 1], ['X'.repeat(70), 0, 0, 0, 0, 0, 0, 1], ['LHR-D', 1e9, 0, 0, 0, 0, 0, 1], 'nope', ['LHR-A', 9, 9, 9, 0, 0, 0, 1, 0, 0, 0, 1, 't']] });
      C.trkIn({ at: T0, l: 'hand', t: [['LHR-A', 7, 7, 7, 0, 0, 0, 1, 0, 0, 0, 1, 't']] });
      C.trkIn({ at: last + 20, l: 'hand', t: [['LHR-Z', 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 't']] }, 'someone');
      const ids = C.trackers().map(T => T.id).sort().join();
      if (ids !== 'LHR-A,LHR-B') bad.push('bad rows or a member\'s message taken: ' + ids);
      C.trkTime(last + 40 + 10 + 10); A = C.tracker('LHR-A');
      if (!near(A.p, [9, 9, 9], 1e-9)) bad.push('the good row of a message with bad ones: ' + JSON.stringify(A));
      // out filled in; one never seen; the room's key and what the shell says of it
      const o = {};
      if (C.tracker('LHR-A', o) !== o || o.id !== 'LHR-A' || C.tracker('LHR-Q') !== null) bad.push('tracker(id, out)');
      const s = C.trk();
      if (!s.on || s.l !== 'hand' || s.names['LHR-A'] !== 'Lamp' || s.key.by !== C.id || !s.index || !s.used) bad.push('trk(): ' + JSON.stringify(s));
      // a write keeps what it does not change; names cut at 24 characters; '' takes one out
      C.setTrk({ on: false }); C.trkName('LHR-B', '  A very long name for the belt tracker '); C.setTrk({ on: true });
      const k2 = C.trk();
      if (!k2.on || k2.names['LHR-A'] !== 'Lamp' || k2.names['LHR-B'] !== 'A very long name for the' || k2.m !== null) bad.push('a write that keeps the rest: ' + JSON.stringify(k2));
      C.trkName('LHR-B', '');
      if ('LHR-B' in C.trk().names) bad.push('a name taken out');
      // not lined up: the relay's message once a second with no trackers
      C.trkIn({ at: last + 1000, l: '', t: [] });
      if (C.trk().l !== '' || C.trk().used) bad.push('not lined up: ' + JSON.stringify(C.trk()));
      if (window.__eff) bad.push('the story heard ' + window.__eff + ' effects');
      C.trkTime(null);
      // the room's frame from two floor spots as the headsets make it (the reference for the relay's frame from trk.m):
      // origin the floor under A, x towards B, y up, z to the right of the way from A to B
      const fr = HOST.room.fromSpots([1, 0.031, 1], [2.84, 0.033, 1], 0), of = p => HOST.room.roomOf(fr, p);
      if (!near(of([2.84, 0.033, 1]), [1.84, 0.002, 0], 1e-9) || !near(of([1, 0.031, 2]), [0, 0, 1], 1e-9) || !near(of([1, 1.031, 1]), [0, 1, 0], 1e-9)) bad.push('the frame from two spots: ' + JSON.stringify([fr, of([2.84, 0.033, 1]), of([1, 0.031, 2])]));
      const f2 = HOST.room.fromSpots([0, 0.05, 0], [0, 0.05, -2], 0.02);
      if (!near(HOST.room.roomOf(f2, [0, 0.03, -2]), [2, 0, 0], 1e-9) || !near(HOST.room.roomOf(f2, [1, 0.03, 0]), [0, 0, 1], 1e-9)) bad.push('the frame from two spots, B straight ahead: ' + JSON.stringify([f2, HOST.room.roomOf(f2, [1, 0.03, 0])]));
      return bad;
    });
    if (bad.length) errors.push(...bad.map(b => 'trackers: ' + b));
  });

  // the relay's answers, stubbed: its ping (it has trackers), its raw list, a tracker still on a spot
  await tp.evaluate(() => {
    const T = window.__trk = { asked: [], list: [
      { id: 'LHR-A', k: 'trk', ok: true, b: 0.8, p: [1, 0.031, 1], q: [0, 0, 0, 1], age: 3 },
      { id: 'LHR-B', k: 'trk', ok: true, b: 0.55, p: [0, 0.03, 2], q: [0, 0, 0, 1], age: 4 },
      { id: 'LHR-HMD', k: 'hmd', ok: true, b: null, p: [0, 1.6, 0], q: [0, 0, 0, 1], age: 2 },
      { id: 'LHB-1', k: 'base', ok: true, b: null, p: [2, 2.2, 2], q: [0, 0, 0, 1], age: 9 }],
      still: { ok: true, p: [1, 0.031, 1], spread: 1.2, n: 90 } };
    const f0 = window.fetch;
    window.fetch = (u, o) => {
      const s = String(u);
      if (!/\/api\/(ping|trackers)/.test(s)) return f0(u, o);
      T.asked.push(s);
      const j = /still/.test(s) ? T.still : /trackers/.test(s) ? { ok: true, trackers: T.list } : { proto: 1, trackers: true, trackersSeen: 3 };
      return new Promise(r => setTimeout(() => r(new Response(JSON.stringify(j), { status: 200, headers: { 'Content-Type': 'application/json' } })), /still/.test(s) ? 50 : 5));
    };
  });

  await step('trackers: the Shared dialog\'s section (the relay stubbed): the room\'s switch, lining up by hand (taken, refused, written), names, a row lit while its tracker moves, its status, the room map\'s dots', async () => {
    const bad = [], $ = s => tp.$(s);
    await tp.evaluate(() => { HOST.collab.setTrk({ on: false }); HOST.collab.dialog(true); return HOST.collab.trkPing(); });
    if (!await tp.waitForFunction(() => !document.querySelector('#shared .sh-trk').hidden && document.querySelectorAll('#shared .sh-trks li[data-trk]').length === 3, null, { timeout: 10000, polling: 100 }).then(() => true, () => false)) {
      errors.push('trackers: the dialog\'s section did not show the relay\'s three trackers: ' + await tp.evaluate(() => document.querySelector('#shared .sh-trks').outerHTML.slice(0, 900)));
      return;
    }
    const sec = () => tp.evaluate(() => { const q = s => document.querySelector('#shared ' + s); return { on: q('[data-sh="trkon"]').textContent, pressed: q('[data-sh="trkon"]').getAttribute('aria-pressed'), st: q('.sh-trkst').textContent, cls: q('.sh-trkst').className,
      note: q('.sh-trknote').textContent, warn: q('.sh-trknote').classList.contains('warn'), pick: [...q('#shTrkPick').options].map(o => o.value), rows: [...document.querySelectorAll('#shared .sh-trks li')].map(l => l.textContent.trim() + (l.classList.contains('moving') ? ' [lit]' : '')), m: HOST.collab.trk().m }; });
    let s = await sec();
    if (s.on !== 'Use the PC\'s trackers in this room: off' || s.pressed !== 'false' || s.cls !== 'sh-trkst off' || s.pick.join() !== 'LHR-A,LHR-B' || !s.rows.some(r => /1 base station/.test(r)) || !s.rows.some(r => /^LHR-HMD.*the Index/.test(r))) bad.push('as it opened: ' + JSON.stringify(s));
    await (await $('#shared [data-sh="trkon"]')).click();
    s = await sec();
    if (s.on !== 'Use the PC\'s trackers in this room: on' || s.pressed !== 'true' || !(await tp.evaluate(() => HOST.collab.trk().on)) || !/^Not lined up yet/.test(s.st)) bad.push('turned on: ' + JSON.stringify(s));
    // a name typed for LHR-B goes into the room's trk.names
    await tp.fill('#shared input[data-trkname="LHR-B"]', 'Belt'); await tp.dispatchEvent('#shared input[data-trkname="LHR-B"]', 'change');
    if ((await tp.evaluate(() => HOST.collab.trk().names['LHR-B'])) !== 'Belt') bad.push('a name typed: ' + JSON.stringify(await tp.evaluate(() => HOST.collab.trk().names)));
    // LHR-B picked up and moved: its row lights, LHR-A's not
    await tp.evaluate(() => { window.__trk.list[1].p = [0.05, 0.1, 2]; });
    const lit = await tp.waitForFunction(() => { const li = n => document.querySelector(`#shared .sh-trks li[data-trk="${n}"]`); return li('LHR-B').classList.contains('moving') && !li('LHR-A').classList.contains('moving') && /moving/.test(li('LHR-B').textContent); }, null, { timeout: 10000, polling: 100 }).then(() => true, () => false);
    if (!lit) bad.push('a tracker moved did not light its row: ' + JSON.stringify((await sec()).rows));
    // spot A from LHR-A, then spot B: too near, too high, an error, then right
    await tp.selectOption('#shTrkPick', 'LHR-A');
    const spot = async (w, still) => {
      await tp.evaluate(st => { window.__trk.still = st; }, still);
      await (await $(`#shared [data-sh="trkspot:${w}"]`)).click();
      await tp.waitForFunction(() => !/^Reading spot/.test(document.querySelector('#shared .sh-trknote').textContent), null, { timeout: 10000, polling: 100 });
      return sec();
    };
    s = await spot('a', { ok: true, p: [1, 0.031, 1], spread: 1.2, n: 90 });
    if (!/^Spot A taken \(still to 1\.2 mm\)/.test(s.note) || s.warn || s.m) bad.push('spot A: ' + JSON.stringify(s));
    if (!(await tp.evaluate(() => window.__trk.asked.some(u => /\/api\/trackers\/still\?id=LHR-A&ms=1000$/.test(u))))) bad.push('spot A asked ' + JSON.stringify(await tp.evaluate(() => window.__trk.asked.filter(u => /still/.test(u)))));
    s = await spot('b', { ok: true, p: [1.2, 0.031, 1], spread: 1, n: 90 });
    if (!/^Spot B is only 20 cm from spot A/.test(s.note) || !s.warn || s.m) bad.push('spot B 20 cm away: ' + JSON.stringify(s));
    s = await spot('b', { ok: true, p: [2.5, 0.091, 1], spread: 1, n: 90 });
    if (!/^Spot B is 6 cm higher than spot A/.test(s.note) || !s.warn || s.m) bad.push('spot B 6 cm higher: ' + JSON.stringify(s));
    s = await spot('b', { ok: false, error: 'LHR-A moved 12 mm while it was read' });
    if (!/^Spot B not taken: LHR-A moved 12 mm while it was read\. Try again\./.test(s.note) || !s.warn || s.m) bad.push('spot B moved: ' + JSON.stringify(s));
    s = await spot('b', { ok: true, p: [2.84, 0.033, 1], spread: 0.8, n: 90 });
    if (!/^Lined up by hand: the spots are 1\.84 m apart \(still to 1\.2 mm and 0\.8 mm\)/.test(s.note) || s.warn || JSON.stringify(s.m) !== JSON.stringify({ a: [1, 0.031, 1], b: [2.84, 0.033, 1] })) bad.push('spot B right: ' + JSON.stringify(s));
    s = await spot('b', { ok: true, p: [2.84, 0.033, 1] });
    if (!/^Set spot A first/.test(s.note)) bad.push('spot B again without A: ' + s.note);
    // lined up by hand and heard from: its status, and the room map's dots
    const st = await tp.evaluate(async () => {
      const C = HOST.collab, put = () => C.trkIn({ at: C.now(), l: 'hand', t: [['LHR-A', 0.5, 0, -1.5, 0, 0, 0, 1, 0, 0, 0, 1, 't'], ['LHR-B', -1, 0.9, 0.5, 0, 0, 0, 1, 0, 0, 0, 1, 't']] });
      for (let k = 0; k < 8; k++) { put(); await new Promise(r => setTimeout(r, 120)); }
      put(); C.dialog(true);   // (drawn again now: a page drawing in software may have starved the pump's timer for longer than 0.5 s)
      const cv = document.getElementById('shMap'), X = C.mapView(), d = cv.getContext('2d').getImageData(Math.round(X.X(0.5)), Math.round(X.Y(-1.5)), 1, 1).data;
      return { st: document.querySelector('#shared .sh-trkst').textContent, cls: document.querySelector('#shared .sh-trkst').className, dots: C.mapTrackers(), px: [...d] };
    });
    if (st.st !== 'Lined up by hand (the spots 1.84 m apart): 2 trackers in the room.' || st.cls !== 'sh-trkst ok') bad.push('its status once lined up: ' + JSON.stringify(st));
    if (st.dots !== 2 || st.px[0] < 180 || st.px[1] < 180 || st.px[2] < 180) bad.push('the room map\'s dots: ' + JSON.stringify(st));
    await tp.evaluate(() => HOST.collab.dialog(false));
    if (bad.length) errors.push(...bad.map(b => 'trackers dialog: ' + b));
  });

  // a pretend VR headset in this room (WebXR in software, as tools/collab.mjs's installXR, trimmed): local and
  // local-floor spaces whose poses come from a pretend real room, two controllers' grips, its frames driven here. The
  // room's frame in that real room is ROOM (where the trackers' room stands: 5 cm above this headset's own floor, as a
  // Guardian floor that is off), and every frame the relay's @trk is fed with the Index's head ('h') where it really is in
  // that room, and LHR-A where it lies, at the relay's time held (HOST.collab.trkTime: 60 frames a second)
  await tp.evaluate(() => {
    const V = (x, y, z) => new THREE.Vector3(x, y, z), Y = V(0, 1, 0);
    const M = (a, pitch) => new THREE.Matrix4().compose(V(a[0], a[1], a[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch || 0, a[3], 0, 'YXZ')), V(1, 1, 1));
    const X = window.__x = { M, ROOM: [2, 0.05, 1, 0.3], FLOOR: [0.4, 0, -0.7, -0.5], LOCAL: [0.9, 1.6, 0.2, 0.8], head: [1, 1.65, -0.5, 0.4], pitch: -0.3, t: Math.round(HOST.collab.now()) + 5000, raf: [], lag: 0, past: [], A: [0.6, 0, -0.4, 0.7] };
    X.W = { local: M(X.LOCAL), 'local-floor': M(X.FLOOR), Lgrip: M([0.7, 1.2, -0.7, 0.2], 0.4), Rgrip: M([1.3, 1.25, -0.6, 0.5], -0.2) };
    X.W.Lray = X.W.Lgrip; X.W.Rray = X.W.Rgrip;
    const sp = name => ({ name, addEventListener() {}, removeEventListener() {} });
    X.spaces = { local: sp('local'), 'local-floor': sp('local-floor') };
    const world = s => (s.name === 'head' ? M(X.head, X.pitch) : X.W[s.name]);
    const pose = m => { const p = V(), q = new THREE.Quaternion(), sc = V(); m.decompose(p, q, sc); return { transform: { position: { x: p.x, y: p.y, z: p.z, w: 1 }, orientation: { x: q.x, y: q.y, z: q.z, w: q.w }, matrix: Float32Array.from(m.elements) } }; };
    X.frame = { getPose: (s, b) => (world(s) ? pose(world(b).clone().invert().multiply(world(s))) : null), getViewerPose: b => pose(world(b).clone().invert().multiply(M(X.head, X.pitch))), getJointPose: () => null };
    const src = (h, k) => ({ handedness: h, targetRayMode: 'tracked-pointer', gamepad: null, gripSpace: sp(k + 'grip'), targetRaySpace: sp(k + 'ray') });
    X.session = { mode: 'immersive-vr', enabledFeatures: ['local-floor'], visibilityState: 'visible', renderState: {}, inputSources: [src('right', 'R'), src('left', 'L')],
      addEventListener() {}, removeEventListener() {}, requestReferenceSpace: t => (X.spaces[t] ? Promise.resolve(X.spaces[t]) : Promise.reject(new Error(t + ' not supported'))),
      requestAnimationFrame(cb) { X.raf.push(cb); return X.raf.length; } };
    HOST.renderer.xr.getReferenceSpace = () => X.spaces.local;
    HOST.renderer.setAnimationLoop(null);
    HOST.mode = 'immersive-vr'; HOST.session = X.session;
    HOST.cur.peek('(XR.session = HOST.session, XR.mode = HOST.mode, xrEnterScene())');
    // a pose in the trackers' room: inverse(ROOM) times its world matrix, as [x, y, z, qx, qy, qz, qw]
    X.inRoom = (m, R) => { const p = V(), q = new THREE.Quaternion(), sc = V(); M(R || X.ROOM).invert().multiply(m).decompose(p, q, sc); return [p.x, p.y, p.z, q.x, q.y, q.z, q.w]; };
    // frames: the relay's @trk first (the Index's head where it is now, or lag ms ago as kept in X.past), then the story's
    // headset loop and the shell's own callback
    X.tick = (n = 1) => {
      for (let k = 0; k < n; k++) {
        X.t += 1000 / 60;
        HOST.collab.trkTime(X.t);
        const hm = M(X.head, X.pitch);
        X.past.push([X.t, hm]); while (X.past.length > 30) X.past.shift();
        const then = X.lag ? (X.past.find(e => e[0] >= X.t - X.lag) || X.past[0])[1] : hm, h = X.inRoom(then), a = X.inRoom(M(X.A));
        HOST.collab.trkIn({ at: X.t, l: 'hand', t: [['LHR-HMD', ...h, 0, 0, 0, 1, 'h'], ['LHR-A', ...a, 0, 0, 0, 1, 't']] });
        if (HOST.cur && HOST.cur.peek('typeof XR !== "undefined" && XR.on')) HOST.cur.peek('xrBegin')(X.frame, 0.016);
        for (const cb of X.raf.splice(0)) cb(X.t, X.frame);
      }
    };
    // the room's frame as it should be, in local-floor (its origin and x axis), and how far the headset's is from it
    X.want = R => { const F = M(X.FLOOR).invert().multiply(M(R || X.ROOM)), o = V().setFromMatrixPosition(F), x = V(1, 0, 0).transformDirection(F); return { o: [o.x, o.y, o.z], x: [x.x, x.y, x.z] }; };
    X.off = R => { const f = HOST.room.frame, w = X.want(R); if (!f) return null; const a = Math.atan2(-f.x[2], f.x[0]) - Math.atan2(-w.x[2], w.x[0]);
      return { cm: Math.hypot(f.o[0] - w.o[0], f.o[1] - w.o[1], f.o[2] - w.o[2]) * 100, deg: Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) * 180 / Math.PI, src: HOST.room.src }; };
  });
  await tp.waitForTimeout(100);
  const tick = n => tp.evaluate(n => window.__x.tick(n), n);

  await step('trackers: the Index lines up from its head as the trackers see it (not a Quest\'s browser): within 1 cm and 0.5 degrees, turned and moved, followed when SteamVR\'s space shifts, a fast turn with the clocks apart adding nothing', async () => {
    const bad = [];
    await tick(3); await tp.waitForTimeout(50); await tick(60);
    let o = await tp.evaluate(() => window.__x.off());
    const n0 = await tp.evaluate(() => HOST.collab.notes().map(n => n.title));
    if (!o || o.src !== 'trackers' || o.cm > 1 || o.deg > 0.5) bad.push('after a second of the head held still: ' + JSON.stringify(o));
    if (!n0.includes('Lined up by the PC\'s trackers')) bad.push('no notice: ' + JSON.stringify(n0));
    // turned and moved (and looking up a little): still where it should be
    await tp.evaluate(() => { const X = window.__x; X.head = [2.2, 1.6, 0.3, -1.1]; X.pitch = 0.2; });
    await tick(60);
    o = await tp.evaluate(() => window.__x.off());
    if (!o || o.src !== 'trackers' || o.cm > 1 || o.deg > 0.5) bad.push('turned and moved: ' + JSON.stringify(o));
    // SteamVR's space shifts against this headset's local-floor by 4 cm and 1.5 degrees: followed
    const R2 = [2.03, 0.05, 0.972, 0.3 + 1.5 * Math.PI / 180];
    await tp.evaluate(R2 => { window.__x.ROOM = R2; }, R2);
    await tick(90);
    o = await tp.evaluate(R2 => window.__x.off(R2), R2);
    const before = await tp.evaluate(() => window.__x.off([2, 0.05, 1, 0.3]));
    if (!o || o.src !== 'trackers' || o.cm > 1 || o.deg > 0.5 || before.cm < 2) bad.push('SteamVR\'s space shifted: ' + JSON.stringify({ now: o, fromBefore: before }));
    // the head turning fast (3 rad/s) while the trackers' samples are 30 ms behind this page's: none of it is taken (it
    // would turn the room by about 5 degrees)
    await tp.evaluate(() => { window.__x.lag = 30; });
    for (let k = 0; k < 45; k++) await tp.evaluate(() => { const X = window.__x; X.head[3] += 3 / 60; X.tick(1); });
    await tp.evaluate(() => { window.__x.lag = 0; });
    o = await tp.evaluate(R2 => window.__x.off(R2), R2);
    if (!o || o.cm > 1 || o.deg > 0.5) bad.push('a fast turn with the clocks 30 ms apart moved the room: ' + JSON.stringify(o));
    // lineUp's words in a room on the relay (this one is on this device: taken as one on a relay for the moment)
    const lu = await tp.evaluate(() => { const C = HOST.collab.internals(), h0 = C.hereSet; C.local = false; C.hereSet = true; try { return HOST.collab.guide().status; } finally { C.local = true; C.hereSet = h0; } });
    if (lu.k !== 'ok' || lu.h !== 'trackers' || lu.text !== 'Lined up by the PC\'s trackers') bad.push('lineUp: ' + JSON.stringify(lu));
    // the menu's question (in this room, or elsewhere?) answered for it: the trackers see it
    const here = await tp.evaluate(() => {
      const C = HOST.collab.internals(); C.local = false; C.hereSet = null;
      try { window.__x.tick(1); return { here: C.hereSet, notes: HOST.collab.notes().map(n => n.title) }; } finally { C.local = true; }
    });
    await tick(3);
    o = await tp.evaluate(R2 => window.__x.off(R2), R2);
    if (here.here !== true || !here.notes.includes('In the room') || !o || o.src !== 'trackers' || o.cm > 1) bad.push('the question answered for it: ' + JSON.stringify({ here, o }));
    if (bad.length) errors.push(...bad.map(b => 'trackers frame: ' + b));
  });

  await step('trackers: the pucks (Trackers: shown on the Debug tab, kept): each where it lies in the room, depth-tested, named; hidden again', async () => {
    const bad = [];
    await tp.evaluate(() => HOST.collab.panelOpen(true));
    await tick(2);
    const r0 = await tp.evaluate(() => { const r = HOST.collab.menuFind('trackers'); if (r) r.fn(); return { found: !!r, shown: HOST.collab.trackersShown(), kept: localStorage.getItem('xrTrackers') }; });
    if (!r0.found || !r0.shown || r0.kept !== 'shown') bad.push('the Debug tab\'s Trackers row: ' + JSON.stringify(r0));
    await tp.evaluate(() => HOST.collab.panelOpen(false));
    await tick(2);
    const pk = await tp.evaluate(() => {
      const X = window.__x, P = HOST.collab.pucks(), a = X.inRoom(X.M(X.A)), want = X.M(X.LOCAL).invert().multiply(X.M(X.A));
      const o = HOST.collab.overlay().room, g = P[0] && o.children.find(c => c.name === 'trackers'), w = new THREE.Vector3();
      if (g) { o.updateMatrixWorld(true); g.children[0].getWorldPosition(w); }
      return { P, a, local: [want.elements[12], want.elements[13], want.elements[14]], world: w.toArray() };
    });
    // (LHR-A fed every frame; LHR-B last heard of in the dialog's step, seconds ago: dim, where it was)
    const p = pk.P.find(x => x.id === 'LHR-A'), b = pk.P.find(x => x.id === 'LHR-B');
    if (pk.P.length !== 2 || !p || p.name !== 'Lamp' || !p.shown || !p.depth || !p.ok || Math.hypot(p.p[0] - pk.a[0], p.p[1] - pk.a[1], p.p[2] - pk.a[2]) > 1e-3) bad.push('the puck: ' + JSON.stringify(pk));
    if (!b || b.ok !== false || b.name !== 'Belt' || Math.hypot(b.p[0] + 1, b.p[1] - 0.9, b.p[2] - 0.5) > 1e-6) bad.push('a puck not heard of for seconds: ' + JSON.stringify(b));
    if (Math.hypot(pk.world[0] - pk.local[0], pk.world[1] - pk.local[1], pk.world[2] - pk.local[2]) > 0.01) bad.push('the puck is not where the tracker is in the story\'s space: ' + JSON.stringify(pk));
    await tp.evaluate(() => HOST.collab.trackersShown(false));
    await tick(1);
    const off = await tp.evaluate(() => [HOST.collab.pucks().every(P => !P.shown), localStorage.getItem('xrTrackers')]);
    if (!off[0] || off[1] !== null) bad.push('hidden again: ' + JSON.stringify(off));
    if (bad.length) errors.push(...bad.map(b => 'trackers pucks: ' + b));
  });

  await step('trackers: a person\'s head and hands (HOST.collab.body): this headset\'s own, presence\'s grips and rays left first, another\'s smoothed from presence; nobody else', async () => {
    const bad = [];
    const r = await tp.evaluate(async () => {
      const X = window.__x, C = HOST.collab, I = C.internals(), sent = [], send = I.ws.send.bind(I.ws);
      I.ws.send = s => { try { const m = JSON.parse(s); if (m.t === 'fx' && m.k === 'p.' + C.id) sent.push(m.v); } catch (e) { /* not ours */ } return send(s); };
      // the story's rays: controller 0 is the right (the session's source 0), 1 the left
      const ray = (i, k) => C.ray(i, new THREE.Vector3().setFromMatrixPosition(X.M(X.LOCAL).invert().multiply(X.W[k])), new THREE.Vector3(0, 0, -1), 2);
      for (let k = 0; k < 4; k++) { ray(0, 'Rgrip'); ray(1, 'Lgrip'); X.tick(1); await new Promise(r => setTimeout(r, 80)); }
      I.ws.send = send;
      const own = C.body(C.id), R = X.ROOM;
      return { own, head: X.inRoom(X.M(X.head, X.pitch), R), L: X.inRoom(X.W.Lgrip, R), Rg: X.inRoom(X.W.Rgrip, R), sent: sent.slice(-1)[0] || null, lRay: new THREE.Vector3().setFromMatrixPosition(X.W.Lgrip) };
    });
    const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), dq = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[3] * b[3] + a[4] * b[4] + a[5] * b[5] + a[6] * b[6]))) * 180 / Math.PI;
    if (!r.own || d3(r.own.head, r.head) > 0.01 || dq(r.own.head, r.head) > 0.5) bad.push('this headset\'s head: ' + JSON.stringify([r.own && r.own.head, r.head]));
    if (!r.own || !r.own.hands[0] || !r.own.hands[1] || d3(r.own.hands[0], r.L) > 0.01 || dq(r.own.hands[0], r.L) > 0.5 || d3(r.own.hands[1], r.Rg) > 0.01) bad.push('its hands (left, right): ' + JSON.stringify([r.own && r.own.hands, r.L, r.Rg]));
    const v = r.sent;
    if (!v || !Array.isArray(v.g) || !v.g[0] || !v.g[1] || d3(v.g[0], r.L) > 0.01 || d3(v.g[1], r.Rg) > 0.01) bad.push('presence\'s grips are not [left, right]: ' + JSON.stringify(v && v.g));
    // (the room's x and z of the left controller's ray origin: the first of presence's rays)
    if (!v || v.hands.length !== 2 || d3(v.hands[0], r.L) > 0.01) bad.push('presence\'s rays do not start with the left: ' + JSON.stringify(v && v.hands));
    // another person in a headset: their presence (two samples 200 ms apart, the first older than the drawing delay), and an
    // older app's (no grips)
    const o = await tp.evaluate(() => {
      const C = HOST.collab, I = C.internals(), t = Math.round(C.now()), q = [0, 0, 0, 1], g = [[0.1, 1, 0, 0, 0, 0, 1], null];
      const pres = (id, v) => I.ws.onmessage({ data: JSON.stringify({ t: 'fx', k: 'p.' + id, v, by: id }) });
      pres('zz', { st: '', head: [0, 1.6, 0, ...q], hands: [], g, ts: t - 400 });
      pres('zz', { st: '', head: [0.4, 1.6, 0, ...q], hands: [], g: [[0.5, 1, 0, 0, 0, 0, 1], [0.9, 1.1, 0, 0, 0, 0, 1]], ts: t - 40 });
      pres('old', { st: '', head: [3, 1.7, 3, ...q], hands: [[3, 1.2, 3, 0, 0, -1, 1]], ts: t });
      return new Promise(r => setTimeout(() => { window.__x.tick(1); r({ zz: C.body('zz'), old: C.body('old'), none: C.body('nobody'), page: (C.internals().pres.set('pg', { id: 'pg', at: performance.now(), head: null }), C.body('pg')) }); }, 30));
    });
    const z = o.zz;
    if (!z || !(z.head[0] > 0.05 && z.head[0] < 0.39) || !z.hands[0] || !(z.hands[0][0] > 0.15 && z.hands[0][0] < 0.49) || !z.hands[1] || z.hands[1][0] !== 0.9 || !Number.isFinite(z.at)) bad.push('another person, smoothed between their samples (the right hand new, as it is): ' + JSON.stringify(z));
    if (!o.old || o.old.hands[0] !== null || o.old.hands[1] !== null || o.old.head[0] !== 3) bad.push('an older app\'s presence: ' + JSON.stringify(o.old));
    if (o.none !== null || o.page !== null) bad.push('nobody, or a page: ' + JSON.stringify([o.none, o.page]));
    if (await tp.evaluate(() => window.__eff)) bad.push('the story heard effects');
    if (bad.length) errors.push(...bad.map(b => 'trackers body: ' + b));
  });
  await tp.evaluate(() => { try { HOST.session = null; } catch (e) { /* gone */ } });
  await ctx.close();
}
await step('old links forward to the app', async () => {
  await page.goto(base + 'spatial.html#t=20');
  await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.curKey === 'spatial', null, { timeout: 30000 });
});
await browser.close();
if (errors.length) { console.log('\n' + errors.join('\n\n')); process.exit(1); }
console.log('\nall good');
