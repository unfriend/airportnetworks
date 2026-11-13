// ------------------------------------------------------------- narration --
// The studio has no narration: AUD stays null, and the lines that would play it do nothing. The sound engine is
// the shell's (HOST.audio), unlocked by the first tap or click and kept across stories and headset sessions.
let AUD = null;
function audioInit() { /* nothing to narrate */ }
function audioSync() { if (AUD) AUD.sync(...slideSound()); }
function audioFollow() { if (AUD && !SLIDE.tail) APP.t = AUD.follow(APP.t); }
function audioLabel() { return AUD ? AUD.label() : ''; }
function audioToggle() { HOST.audio.toggle(); }

// ------------------------------------------------------------- slideshow --
// Slideshow (HOST.slides: on for this story, or for all): the story waits at the end of each chapter, all its text
// shown, until Next (or Play) goes on. The stop is a pause and a seek, Next a play, so in a shared room they reach
// the station's clock like a pause and a play by hand, at the same t on every device.
const SLIDE = { at: -1, go: -1, last: 0, lt: 0, lp: false, tail: null, from: 0 };
const slidesOn = () => !!(HOST.slides && HOST.slides.on(XR_HERE));
// where chapter i waits: just before its text starts to fade out (0.65 s before its end in story time), on the
// recording's clock; the same on every device
const slideStop = i => narrT(CH[i].b - 0.7);
// a chapter's last words can run on past that point (the airports' by up to 2.4 s): a story with a recording says
// where each chapter's voice ends in it (NARRATION_ENDS, seconds by chapter key), and the voice finishes there while
// the story waits (slideSound); a story without one pauses the narration with the clock
const slideVoice = i => (typeof NARRATION_ENDS === 'object' && +NARRATION_ENDS[CH[i].key]) || 0;
// every frame, once the clock has moved on from t0: crossing a stop while playing stops there, and a story paused just
// now, while playing up to 0.25 s before a stop (a room's pause lands that close), waits at it too (SLIDE.at, which
// shows Next); a clock put near a stop while paused (a scrub) stays where it was put, unless right on it. In a shared
// room the station's clock also moves a playing story on between frames (catching up): a step since the last frame
// no longer than the time that passed (and the room's 0.25 s drift) counts as playing on too; a jump does not
function slideStep(t0) {
  const was = SLIDE.at, now = performance.now(), st = HOST.collab && HOST.collab.live && HOST.collab.live();
  const from = st && st.story === XR_HERE && SLIDE.lp && APP.t >= SLIDE.last && APP.t - SLIDE.last < (now - SLIDE.lt) / 1000 + 0.35 ? SLIDE.last : t0;
  SLIDE.from = from;   // (the sound effects' cues cross by the same rule: sfxStep)
  SLIDE.at = -1;
  if (slidesOn() && APP.mode === 'story') {
    for (let i = 0; i < CH.length; i++) {
      const s = slideStop(i);
      if (APP.playing && i !== SLIDE.go && from < s && APP.t >= s) { slideTail(i, APP.t); APP.playing = false; APP.seek(s); }
      else if (!APP.playing && SLIDE.lp && APP.t >= s - 0.25 && APP.t < s) slideTail(i, APP.t);
      else if (APP.playing || Math.abs(APP.t - s) > 0.002) continue;
      APP.t = s; SLIDE.at = i; break;
    }
    // gone on from a stop: it stays passed while the clock is near it (the narration may pull the clock back a hair)
    if (was >= 0 && APP.playing) SLIDE.go = was;
    else if (SLIDE.go >= 0 && Math.abs(APP.t - slideStop(SLIDE.go)) > 1) SLIDE.go = -1;
  } else SLIDE.go = -1;
  // a voice finishing its chapter: done once the story is back where the voice ended, or elsewhere
  const T = SLIDE.tail;
  if (T && (APP.mode !== 'story' || HOST.picking || APP.t < T.s - 0.01 || APP.t >= T.v)) SLIDE.tail = null;
  SLIDE.last = APP.t; SLIDE.lt = now; SLIDE.lp = APP.mode === 'story' && APP.playing;
}
// at the stop of chapter i the voice plays on from where the sound is (the story's clock, t, can lag it) to where the
// chapter's words end; a sound already past them stops there, and keeps quiet until the story is back there
function slideTail(i, t) {
  const p = AUD && AUD.pos ? AUD.pos() : null, e = slideVoice(i);
  // (only a sound that is with the story: right after a jump it still says where it was before)
  const near = p !== null && Math.abs(p - t) < 1.5;
  if (near) t = p;
  SLIDE.tail = e > t || near ? { s: slideStop(i), v: Math.max(e, t), t, at: performance.now() } : null;
}
// what the narration plays (audioSync): the story's clock while it plays; while a voice finishes its chapter, its own
// clock up to the chapter's voice end, then nothing until the story, gone on from the stop, is back there. So nothing
// is cut or said twice, and the story does not follow the voice meanwhile (audioFollow)
function slideSound() {
  const T = SLIDE.tail, v = T ? T.t + (performance.now() - T.at) / 1000 : 0;
  return T ? [APP.mode === 'story' && v < T.v, Math.min(v, T.v)] : [APP.mode === 'story' && APP.playing, APP.t];
}
function slideNext() { if (SLIDE.at >= 0) APP.togglePlay(); }
function slideToggle() { if (HOST.slides) HOST.slides.set(XR_HERE, !slidesOn()); }
const slideSig = () => (HOST.slides ? HOST.slides.sig() : '') + SLIDE.at;
// the page: Next while the story waits (index.html's row at the foot of the panel, brought into sight as far as the
// chapter's top allows; on a phone, beside Play in the bar instead) and the switch
function slideDOM() {
  const row = $('#slides');
  if (!row || !HOST.slides) return;
  const on = slidesOn(), s = SLIDE.at + '' + on, nb = $('#btnNext'), bar = $('#btnNextBar');
  if (row.dataset.s === s) return;
  row.dataset.s = s; row.hidden = false;
  nb.hidden = SLIDE.at < 0;
  if (bar) bar.hidden = SLIDE.at < 0;
  const b = $('#btnSlides');
  b.textContent = 'Slideshow: ' + (on ? 'on' : 'off'); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (SLIDE.at < 0 || !nb.offsetParent) return;
  const p = $('#panel'), r = p.getBoundingClientRect(), cs = getComputedStyle(p), sec = $('#story .ch.on');
  const over = Math.min(row.getBoundingClientRect().bottom - (r.bottom - parseFloat(cs.paddingBottom)), sec ? sec.getBoundingClientRect().top - r.top - parseFloat(cs.paddingTop) : 0);
  if (over > 0) p.scrollTo({ top: p.scrollTop + over, behavior: 'smooth' });
}

// ---------------------------------------------------------- sound effects --
// Sounds inside the story (the shell's HOST.sfx, sfx.js; phase 2). Cues are set beside the keys in buildStory, in story
// time (sfxCue), and play as the clock crosses them while the story plays, by the slideshow's crossing rule
// (SLIDE.from): the same cues at the same moment on every device at a station, none on a jump, a scrub, a slideshow
// stop's seek or a late joiner's start. A span (sfxHold) keeps a continuous sound while the clock is inside it and
// playing. Explore and headset actions call sfxAct (explore mode only) or sfxPlay where the story already handles them.
// A sound comes from a place (a set's anchor, sfxPos): in a headset through an HRTF panner, on a screen panned by where
// it shows. An older shell (no HOST.sfx, or a sound it does not know) plays nothing. Never in collab.state(): each
// device plays its own. SFXQ.log keeps what was asked for (also when nothing can play: before a tap), for the tests
const SFXQ = { cues: [], spans: [], hi: -1, t: 0, n: 0, log: [], quiet: 0 };   // quiet: a room's state being applied (silent)
const sfxCue = (t, name, set, at, o) => { SFXQ.cues.push({ t, n: Math.max(0.05, narrT(t)), name, set, at, o: o || {} }); };
const sfxHold = (t0, t1, name, set, at, o) => { SFXQ.spans.push({ id: XR_HERE + '.' + SFXQ.spans.length, t0, t1, n0: narrT(t0), n1: narrT(t1), name, set, at, o: o || {} }); };
const sfxN = () => SFXQ.n + (HOST.sfx && HOST.sfx.count ? HOST.sfx.count() : 0);
const _sfv = new THREE.Vector3();
// where a sound comes from: [x, y, z] in the scene's (the reference space's) coordinates and, on a screen, a pan
function sfxWhere(set, at) {
  if (set === 'world') { if (!at) return {}; if (Array.isArray(at)) _sfv.fromArray(at); else _sfv.copy(at); }   // a point already in the scene's coordinates (a ray's hit)
  else if (!sfxPos(set, at, _sfv)) return {};
  const o = { at: [_sfv.x, _sfv.y, _sfv.z] };
  if (!(XR.on && GL.renderer.xr.isPresenting)) { _sfv.project(GL.camera); o.pan = clamp(_sfv.x, -1, 1) * 0.6 * (_sfv.z > 1 ? -1 : 1); }
  return o;
}
function sfxPlay(name, set, at, o) {
  SFXQ.n++;
  if (name !== 'hover') { SFXQ.log.push([name, Math.round(APP.t * 100) / 100, APP.mode]); if (SFXQ.log.length > 64) SFXQ.log.shift(); }
  if (!HOST.sfx || !HOST.sfx.play) return null;
  try { return HOST.sfx.play(name, Object.assign(sfxWhere(set, at), o)); } catch (e) { return null; }
}
// nothing of the story sounds while it is hidden: behind a Stories screen (page or headset), or a headset away from its station
const sfxHidden = () => !!(HOST.picking || XR.stories || xrAway());
// an explore action's sound (a pick, a result, a knockout): only in explore mode (a room's state applied while the story
// plays is silent)
const sfxAct = (name, set, at, o) => (APP.mode === 'explore' && !SFXQ.quiet && !sfxHidden() ? sfxPlay(name, set, at, o) : null);
// every frame, right after slideStep (`was`: the story was playing as the frame began): the cues crossed since the
// slideshow's `from` (at most 1.5 s back: the narration's clock can leap ahead as it starts after a jump, and its cues
// then play a moment late, not a burst of old ones; never twice: the narration or a room's clock may pull the clock back
// a hair, SFXQ.hi, forgotten once the clock is put back further), the spans the clock is in, and the live parts
// (sfxLive, where a story has them)
function sfxStep(was, dt) {
  const t = APP.t, from = SLIDE.from, quiet = APP.mode !== 'story' || sfxHidden();
  if (from < SFXQ.t - 0.5 || t < SFXQ.hi - 0.5) SFXQ.hi = -1;   // back to earlier: Replay, Repeat, a jump back
  if (was && !quiet && t > from) {
    const hi = SFXQ.hi;
    for (const c of SFXQ.cues) if (c.n > from && c.n <= t && c.n > hi && t - c.n < 1.5) { SFXQ.hi = Math.max(SFXQ.hi, c.n); sfxPlay(c.name, c.set, c.at, c.o); }
  }
  if (APP.playing && !quiet && HOST.sfx && HOST.sfx.drone) {
    for (const s of SFXQ.spans) if (t >= s.n0 && t < s.n1) { try { HOST.sfx.drone(s.id, s.name, Object.assign(sfxWhere(s.set, s.at), s.o)); } catch (e) { /* an older shell */ } }
  }
  if (typeof sfxLive === 'function' && !sfxHidden()) sfxLive(dt);
  SFXQ.t = t;
}
// a sound's place (sound effects): a set's anchor (a name, a function, or [x, y, z] in its frame) in the scene's
// coordinates; no set: GL.world's origin. Sets may hang under a life-size holder: each group's own world matrix
function sfxPos(set, at, out) {
  const s = set && GL.sets[set];
  if (!s) out.set(0, 0, 0).applyMatrix4(GL.world.matrixWorld);
  else { const p = anchorOf(set, at); out.set(p[0], p[1], p[2]).applyMatrix4(s.group.matrixWorld); }
  return isFinite(out.x + out.y + out.z);
}

// ================================================================== APP ==
const APP = {
  mode: 'story', t: 0, playing: true,
  seek(t) { this.t = clamp(t, 0, T_END - 0.01); if (this.mode !== 'story') this.enterStory(this.t); },
  togglePlay() { if (this.mode !== 'story') return; if (this.t >= T_END - 0.05) this.t = 0; this.playing = !this.playing; },
  enterExplore() {
    if (this.mode === 'explore') return;
    this.mode = 'explore';
    document.body.classList.add('exploring');
    $('#btnMode').textContent = 'Intro';
    Object.assign(XS, DEF, { stage_a: 1 });
    // from where the intro's camera is, to the scene's view
    orbit.cur = storyCam(storyT(this.t)); orbit.to = null;
    if (STU.items.size) frameScene(true);
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    renderPanes();
    updateExtraLabels();
    tcAttach();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'To the scene';
    this.t = t || 0; this.playing = true; curCh = null;
    tcAttach();
  },
};

let lastNow = 0;
function frame(now, xrFrame) {
  const dt = lastNow ? Math.min(0.1, Math.max(0, (now - lastNow) / 1000)) : 0;
  lastNow = now;
  if (PV.jobs.length) pvJobs();   // (a model's picture asked for in a headset session: drawn here, inside its frame; e7e_pics.js)
  const xr = XR.on && GL.renderer.xr.isPresenting;
  if (xr) xrBegin(xrFrame, dt);
  if (xrIdle(xr, dt)) return;   // (away from every station a second: only the rays, the quiet narration and the render)
  let S, tSet;
  const t0 = APP.t;
  const was = APP.mode === 'story' && APP.playing;   // (sound effects: the story was playing as the frame began)
  if (APP.mode === 'story' && APP.playing) {
    APP.t += dt;
    audioFollow();
  }
  slideStep(t0);   // slideshow: the story waits at the end of each chapter
  sfxStep(was, dt);   // sound effects: the cues the clock crossed, the spans it is in, the live sounds
  // the end of the intro: the scene (not Repeat: the studio is not one of the stories)
  if (APP.mode === 'story' && APP.playing && APP.t >= T_END) { APP.t = T_END; APP.enterExplore(); }
  audioSync();
  const ts = storyT(APP.t); // original story time for this point in the narration
  if (APP.mode === 'story') {
    S = storyState(ts); tSet = ts;
    if (xr) xrPlace(storyCam(ts)); else applyCamera(storyCam(ts));
    updateStoryDOM(ts);
    updateTimeline(APP.t, APP.playing);
  } else {
    const pn = performance.now();
    S = exploreStep(dt); tSet = pn / 1000;
    orbitStep(xr ? pn : now);
    if (xr) xrPlace(orbit.cur); else if (X.view === 'walk') walkStep(dt); else applyCamera(orbit.cur);
  }
  K.U.uTime.value = (performance.now() / 1000) % 3600;
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  if (XR.on && !XR.clear) S = Object.assign({}, S, { stage_floor: 0 });   // passthrough: the scene stands in your room
  updateSets(S, tSet, dt);
  GL.world.updateMatrixWorld(true);
  behaveStep(dt, performance.now());   // (behaviours: who each reacts to, what this device drives; e6g_behave.js)
  itemsStep(dt, performance.now());
  settingsStep();   // (the scene's settings told to the shell: the other circles, the real world hiding it; e6d_shapes.js)
  exStep();   // (an example open here at a circle: back to the relay, the scene the room's; the examples' scenes on the relay seen; e7g_examples.js)
  if (!STU.framed && APP.mode === 'explore' && !xr && STU.listing === 'ok' && [...STU.items.values()].every(it => it.kind !== 'o' || it.model || (it.E && it.E.state === 'failed'))) { STU.framed = true; if (STU.items.size && X.view === 'orbit') frameScene(true); }
  updateExtraLabels();
  paneStep(performance.now());
  if (xr) xrUpdate(S);
  if (VW.open && !xr) vwDraw(dt);   // (the viewer over the whole window: its scene in place of the studio's, e7f_viewer.js)
  else { if (VW.open) vwClose(); GL.renderer.render(GL.scene, GL.camera); }   // (a headset session: the viewer is a page's)
  if (!xr && !VW.open) {
    GL.world.updateMatrixWorld(true);
    if (APP.mode === 'story') placeLabels(LBL.storyAll, L => (L.kind === 'story' ? fadeVal(ts, L.tIn, L.tOut, 0.5) * (S[L.set + '_a'] > 0.5 ? 1 : 0) : setLabelAlpha(L, S)));
    else placeLabels(LBL.exploreAll(), L => (L.kind === 'set' ? setLabelAlpha(L, S) : L.txt ? L.show : 0));
  }
  window.__frames = (window.__frames || 0) + 1;
}
function applyTheme() {
  if (!GL.renderer) return;
  if (XR.on && !XR.clear) GL.renderer.setClearColor(0x000000, 0); // passthrough AR shows the room
  else GL.renderer.setClearColor(new THREE.Color(css('--scene') || '#040912'), 1);
}
// The story builds in steps, each a task of its own (LOAD): the scene, then each set (built, then its shaders compiled
// a slice at a time: warm), what joins the sets, the story, explore mode and the panels. Between the steps the page
// shows how far it is and a headset draws the shell's loading scene (HOST.progress); the next step runs from a timer,
// not an animation frame (the window's frames stop in a headset). A step that returns true runs again. The shared-room
// hooks see the scene only once all of it is built (collab.scene). A failure while the scene is built says that WebGL
// is missing, as before.
const LOAD = { steps: [], i: 0, t: 0, gone: false, done: false, warm: null, seen: new Set(), ms: [] };
function init() {
  const S = LOAD.steps, n = SET_ORDER.length;
  S.push(['Setting up the scene', () => buildScene($('#gl')), true]);
  SET_ORDER.forEach((k, i) => { const l = `Building the scenes: ${i + 1} of ${n}`; S.push([l, () => buildSet(k), true], [l, () => warm(GL.sets[k].group)]); });
  S.push(['Putting the scenes together', sceneJoin, true], ['Putting the scenes together', () => warm(GL.scene)],
    ['Writing the story', () => {
      resize();
      window.addEventListener('resize', resize);
      buildDefaults(); Object.assign(XS, DEF);
      for (const k of SET_ORDER) GL.sets[k].setAlpha(0);
      buildStory(); buildSetLabels(); buildTimeline();
    }],
    ['Setting up explore mode', () => { buildExplore(); tcSetup(); bindCanvas(); editLooks(); }],
    ['Making the headset panels', () => { audioInit(); xrSetup(); LOAD.done = true; initEnd(); }]);
  if (HOST.progress) HOST.progress(0, S.length, S[0][0]);
  loadStep();
}
// (short steps run on in one task, as each yield costs a frame; a step left half done, or 40 ms gone, yields)
function loadStep() {
  LOAD.t = 0;
  const t0 = performance.now();
  while (!LOAD.gone && LOAD.i < LOAD.steps.length) {
    const [label, fn, scene] = LOAD.steps[LOAD.i], t1 = performance.now();
    let more = false;
    try { more = fn() === true; } catch (err) {
      if (!scene) throw err;
      console.error(err);
      $('#nogl').style.display = 'grid';
      $('#loading').classList.add('gone');
      return;
    }
    LOAD.ms.push([label, Math.round(performance.now() - t1)]);
    if (!more) LOAD.i++;
    const n = LOAD.steps.length, next = LOAD.steps[LOAD.i];
    if (HOST.progress) HOST.progress(LOAD.i + (LOAD.warm ? LOAD.warm.i / LOAD.warm.list.length : 0), n, next ? next[0] : '');
    if (more || performance.now() - t0 > 40) break;
  }
  if (!LOAD.gone && LOAD.i < LOAD.steps.length) LOAD.t = setTimeout(loadStep, 0);
}
// shaders compiled now, so a set's first appearance does not stall the story: each material once (LOAD.seen), with
// the scene's lights as when it is drawn (renderer.compile on a stand-in scene that holds the lights and one object,
// not its children), until a slice has taken 50 ms; true while some are left
function warm(root) {
  const t0 = performance.now();
  if (!LOAD.warm) {
    const list = [];
    root.traverse(o => {
      const id = o.material && [].concat(o.material).map(m => m.uuid).join() + (o.isInstancedMesh ? 'i' : '') + (o.isSkinnedMesh ? 's' : '');
      if (id && !LOAD.seen.has(id)) { LOAD.seen.add(id); list.push(o); }
    });
    LOAD.warm = { list, i: 0, sc: new THREE.Scene() };
  }
  const W = LOAD.warm, lights = GL.scene.children.filter(o => o.isLight);
  try {
    while (W.i < W.list.length && performance.now() - t0 < 50) {
      const o = W.list[W.i++];
      W.sc.children = lights.concat({ traverse: f => f(o), traverseVisible() {} });
      GL.renderer.compile(W.sc, GL.camera);
    }
  } catch (e) { W.i = W.list.length; /* compiled on first use instead */ }
  W.sc.children = [];
  if (W.i < W.list.length) return true;
  LOAD.warm = null;
  return false;
}
// the rest of the start, the load's last step: the story's listeners, a link's place, the frame loop
function initEnd() {
  LBL.storyAll = ST.labels.concat(LBL.sets);
  LBL.exploreAll = () => LBL.sets.concat(LBL.extra);
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  (GL.mo = new MutationObserver(applyTheme)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  $('#btnMode').addEventListener('click', () => (APP.mode === 'story' ? APP.enterExplore() : APP.enterStory(0)));
  document.addEventListener('click', ev => { if (ev.target.id === 'btnGoExplore') APP.enterExplore(); });
  document.addEventListener('keydown', ev => {
    if (ev.target.closest('input, textarea')) return;
    if (ev.key === ' ' && APP.mode === 'story' && !ev.target.closest('button')) { APP.togglePlay(); ev.preventDefault(); }
  });
  APP.playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the start screen pauses the story; picking this story again starts it from the top
  if (HOST.picking) APP.playing = false;
  window.addEventListener('storypause', () => { APP.playing = false; });
  window.addEventListener('storyrestart', () => { APP.enterStory(0); APP.playing = true; });
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.has('t')) { APP.t = clamp(parseFloat(hp.get('t')) || 0, 0, T_END - 0.01); APP.playing = false; }
  // straight into the scene (#studio&t=2: the intro at that second, paused); &tab=scene|add|item|items, &view=walk;
  // &scene=<name>, &edit, &visit, &scenes=<folder>, &maxtex= (OPT, e4_files.js)
  if (!hp.has('t')) APP.enterExplore();
  // editing: this device's own (studioEdit), &edit turns it on, &visit offers none at all
  STU.edit = !OPT.visit && (OPT.edit || store.get('studioEdit') === '1');
  if (TABS.some(t => t[0] === hp.get('tab'))) X.tab = hp.get('tab');
  if (hp.has('upload')) X.tab = 'upload';   // (#studio&upload: the Upload pane, where the relay's /upload sends people)
  if (X.tab === 'upload' && OPT.visit) X.tab = 'scene';   // (a visitor's kiosk takes no uploads)
  if (hp.get('view') === 'walk') X.view = 'walk';
  renderPanes();
  // where the scenes come from (a relay with --scenes, else a folder), then the scene
  findSource();
  GL.renderer.setAnimationLoop(frame); // also drives the headset's frame loop
  if (HOST.session && GL.renderer.xr.isPresenting) xrAdopt();
  LOAD.t = setTimeout(() => $('#loading').classList.add('gone'), 120);   // (dispose clears it: a story picked meanwhile keeps its loading screen)
}
// for tests and the browser console (HOST.cur.peek('STUDIO.state()')): where things stand, the items, what is shown for
// a pretend head, the last download
const STUDIO = {
  download: '',
  scan: () => ({ ar: SCAN.ar, seen: SCAN.seen, src: SCAN.src, keep: SCAN.keep, busy: SCAN.busy, note: SCAN.note, noteC: SCAN.noteC, last: SCAN.last, bake: SCAN.bake || null, words: scanWords() }),   // (the room scan: e6p_scan.js)
  state: () => ({
    src: SRC.kind, srcState: SRC.state, base: SRC.base, folder: SRC.folder, save: SRC.save, scenes: SRC.scenes.map(s => s.name), scene: STU.scene, listing: STU.listing,
    files: STU.files.length, items: STU.items.size, edit: editOn(), sel: STU.sel, pick: STU.pick, unsaved: unsaved(), savedAt: STU.savedAt, savedBy: STU.savedBy, bad: STU.bad, note: STU.note, saveNote: STU.saveNote, undo: UNDO.length,
    models: Object.fromEntries([...LIB.values()].map(E => [E.path, { state: E.state, err: E.err, ms: E.ms, info: E.info, guess: E.guess, missing: [...E.missing], users: E.users.size, record: E.record || null, found: Object.fromEntries(E.found || []), why: E.why || {}, decoded: E.decoded || [], mats: E.mats || [] }])),
    sounds: Object.fromEntries([...SND.values()].map(F => [F.path, { state: F.state, err: F.err, size: F.size, dur: F.dur, stream: !!F.stream, buf: !!F.buf, bytes: F.bytes ? F.bytes.byteLength : 0 }])),
    upload: { tab: X.tab, scene: UP.scene, rows: UP.rows.map(r => ({ kind: r.kind, title: r.title, src: r.src.map(e => e.path), out: r.out.slice(), notes: r.notes.slice(), state: r.state, msg: r.msg, dl: r.dl.map(d => d.name), pic: !!r.pic, tex: (r.names || []).map(x => [x.name, x.entry ? x.entry.path : '', x.how]), adds: (r.adds || []).map(x => [x.entry.path, x.slot]), keep: r.keep, tris: r.tris, pv: r.pv ? { keep: r.pv.keep, busy: !!r.pv.busy, img: !!r.pv.img, words: r.pv.words || '', note: r.pv.note || '' } : null })), busy: UP.busy, note: UP.note, left: UP.left.slice() },
    convert: { busy: CV.busy, note: CV.note, done: CV.done.slice() },
    pics: pvState(),   // (the Add pane's pictures: e7e_pics.js)
    lite: liteState(),   // (Fewer triangles and Change texture: e7d_lite.js)
    badTex: STU.badTex, txp: STU.txp,   // (the cubes' texture changes a layout lost; a cube's texture pick: e6i_tex.js)
    badPlay: STU.badPlay, plp: STU.plp,   // (the cubes' starts a layout lost; a cube's pick of what it starts: e6n_plays.js)
    settings: STU.settings, hooks: Object.assign({}, HOOK), lobbyAt: STU.lobbyAt,   // (the scene's settings and what the shell was told: e6d_shapes.js)
  }),
  // how many triangles an object's model draws now (Fewer triangles' preview gives it fewer)
  tris: id => trisOf(id),
  // an object's, a shape's or an empty's behaviour here (e6g_behave.js): who it reacts to, driven here or drawn from whose
  // samples, its move and turn
  behave: id => behaveInfo(id),
  items: () => [...STU.items.values()].map(it => ({ id: it.id, kind: it.kind, rec: it.rec, shown: it.shown, heard: !!it.heard, a: it.a, sa: it.sa, fa: it.fa, act: !!it.act, inside: !!it.inside, built: !!it.model, src: !!it.src, visible: it.holder.visible, stream: !!it.st, playing: !!(it.st && !it.st.el.paused), at: it.holder.position.toArray(), cutting: !!it.cutting })),
  // a cut-out: the object it cuts here (null: none), whether it cuts now, its box's corners in the scene's frame, and what
  // its object's materials are handed (the boxes cutting now, by id; the count the shader takes)
  cut: id => {
    const x = STU.items.get(id);
    if (!x || x.kind !== 'x') return null;
    const ob = cutObj(x), U = ob && ob.cutU;
    return { on: ob ? ob.id : null, cutting: !!x.cutting, corners: cutCorners(x), list: U ? U.list.map(c => c.id) : [], n: U ? U.cutN.value : 0, patched: !!(ob && ob.model && ob.model.cut) };
  },
  // a sound that follows a model: the node it follows here (its name; '' the whole model), where that puts it now, where
  // it is, and how far apart (m); null: it follows nothing here
  follow: id => {
    const it = STU.items.get(id), nd = it && followNode(it);
    if (!nd) return null;
    const p = followAt(it, nd, new THREE.Vector3());
    return { node: nd === followOf(it).holder ? '' : nd.name, want: p.toArray(), at: it.holder.position.toArray(), d: p.distanceTo(it.holder.position) };
  },
  // an object's, a shape's or an empty's pose: drawn (its holder's matrix: its motion), placed (its holder's place, turn and
  // scale: its record), whether it moves now and whether it rests (e6e_motion.js)
  pose: id => {
    const it = STU.items.get(id);
    if (!it) return null;
    const H = it.holder;
    return { drawn: H.matrixAutoUpdate ? null : H.matrix.toArray(), placed: new THREE.Matrix4().compose(H.position, H.quaternion, H.scale).toArray(), moving: !H.matrixAutoUpdate, rests: motionRests(it) };
  },
  // an item's ghost where it is placed (shown, lit, its pose, its parts), or null (e6h_ghost.js)
  ghost: id => ghostOf(id),
  // a sound that plays with a recorded path (e6j_voice.js): its start, where its voice and its path are now; and a recording
  // kept as a file: its keys here (k: how many; own: made here; state)
  voice: id => voiceState(id),
  pf: src => { const f = PF.get(src); return f ? { n: f.k ? f.k.length : 0, own: !!f.own, state: f.state, at: f.at, err: f.err } : null; },
  // the viewer (e7f_viewer.js): open or not, what it shows, how, its camera
  viewer: () => vwState(),
  // the trackers here, and with an item's id its tracker and its pose on it (e6k_trk.js); a character worn with trackers:
  // its rig, record, whether it is lined up and solved, why not, its lining up and take under way (e6l_puppet.js)
  trk: id => trkState(id),
  puppet: id => pupState(id),
  // the pictures trigger cubes put on objects (e6i_tex.js): those read, and with an object's id what it shows now (its
  // entries on, and every material's pictures by slot, lit and as scanned)
  tex: id => texState(id),
  // what the trigger cubes start (e6n_plays.js): the last starts and ends, the items with a run, and with an item's id what
  // runs on it now (per kind: its cube, clip, how, when, at, off, try), its clip layers ([clip, weight, time, fading]), where a
  // path it waits is, a sound's gain factor and how it last started
  plays: id => playState(id),
  // every object's model in (or failed) and every sound fetched: the scene is ready
  ready: () => STU.listing === 'ok' && [...STU.items.values()].every(it => (it.kind !== 'o' || it.model || (it.E && it.E.state === 'failed')) && (it.kind !== 's' || (it.F && !['idle', 'probing', 'loading'].includes(it.F.state)))),
  // a trigger cube here (v137): who is inside (anyone, for one that works for everyone), active, when it was entered last
  // (its since: the room's time for an everyone cube), and when it went in and out on the clock of what cubes start
  cube: id => { const c = STU.items.get(id); return c && c.kind === 'c' ? { all: !!c.rec.all, inside: !!c.inside, act: !!c.act, since: c.since || 0, inT: c.inT, outT: c.outT, who: c.allIn ? [...c.allIn.keys()] : [] } : null; },
  // the scenes that ship with the app (e7g_examples.js): their list, whether one is open, a copy under way
  examples: () => exState(),
  // the walls here for things on walls (v137, e6o_walls.js): with a list ([{ a: [x, z], b: [x, z], y0, y1 }] in the scene's
  // frame) pretend walls, null the headset's own again; without one, as they are
  walls: list => (list !== undefined ? wallsFake(list) : wallsInfo()),
  // the session this device pretends to be in for what shows only in AR or only in VR (v137): 'ar', 'vr' or '' (as it is)
  sess: k => { if (k !== undefined) STU.sess = k === 'ar' || k === 'vr' ? k : ''; return sessKind(); },
  shownFor, find: name => { const it = [...STU.items.values()].find(x => x.rec.name === name); return it ? it.id : ''; },
};
LOAD.t = setTimeout(init, 40);

// what the app shell needs to change story
return {
  inputs: () => XR.ctrls.map(c => c.src),
  caption: xrCaption,
  recenter: xrRecenterAsk,
  panels: () => (XR.main && XR.foot ? { main: XR.main, foot: XR.foot } : null),   // (for the shell's menu, its Story tab)
  // walking into the room's Back to the lobby circle (the shell asks, where the headsets charge): this device forgets what
  // it has seen, so the scene starts afresh next time (e6d_shapes.js); nothing is written to the room
  lobby: () => studioLobby(),
  // the sticks (e8_xr.js): the studio's own (walk, turn, steer what you carry, scroll) while the shell's moving with the
  // sticks is off, moving you while it is on (the left stick clicked twice switches them, VR only): the studio moves you itself
  // (stickMove: its scene, as its own walk does), in a shared room too and while a grip is held (what is carried comes
  // along in the hand); the shell gives the notice and the menu's line in these words
  sticks: {
    say: on => (on ? ['Sticks: moving you', 'Left stick: move. Right stick: turn. Click the left stick twice for the studio\'s.']
      : ['Sticks: the studio\'s', 'Walk, turn, steer what you carry. Click the left stick twice to move with them.']),
    note: 'Here, on: the sticks move you (in a shared room too), also while you carry something, which comes along. Off: the studio\'s own (walk, turn, steer what you carry). Or click the left stick twice. This headset\'s own.',
  },
  xrPose: () => (XR.on ? { rp: GL.rig.position.clone(), rq: GL.rig.quaternion.clone(), off: XR.globeOff.clone(), s: XR.size, held: XR.ctrls.map(c => (c.grab ? c.grab.target : '')).join(' '),
    pp: XR.panelGroup.position.clone(), pr: yawOf(XR.panelGroup.quaternion, XR.panelGroup.rotation.y), rot: XR.rot.clone(), pq: XR.panelGroup.quaternion.clone() } : null),
  // shared rooms (shared.js): the clock is APP's, the shared state the scene's name and its items, one field each; one
  // effect, a behaviour's driver's samples (studioEffect, e6g_behave.js)
  collab: {
    APP, scene: () => (LOAD.done ? GL.scene : null), state: collabState, apply: v => { SFXQ.quiet++; try { return collabApply(v); } finally { SFXQ.quiet--; } }, view: collabView, setView: collabSetView,
    effect: studioEffect,
    hover: i => { const c = XR.ctrls[i]; return c && c.hover ? c.ray.scale.z : 0; },
    panel(p, yaw, q) { xrPanelPose(p, yaw, q); },
    place(o, s, q) { XR.globeOff.fromArray(o); XR.size = s; xrSceneRot(q); },
  },
  // for tests and the browser console: HOST.cur.peek('NET.N')
  peek: src => eval(src),
  dispose() {
    try { draftNow(); } catch (e) { /* storage blocked */ }   // (the last second's changes, before its timer goes below)
    // timers left running must not write into the next story's panes (they share ids) or build this one after all
    try { vwClose(); } catch (e) { /* not open */ }   // (the viewer's overlay and what it made: e7f_viewer.js)
    try { grabEnd(); } catch (e) { /* not grabbed */ }   // (Walk view's grabbed mouse let go, its crosshair taken away: e7_explore.js)
    try { if (REC) { voiceEnd(REC); voiceDrop(REC); } } catch (e) { /* none */ }   // (a microphone recording with a movement let go: e6j_voice.js)
    GL.gone = true;
    LOAD.gone = true; clearTimeout(LOAD.t); clearTimeout(xrMsg.t);
    for (const t of TIMERS) clearTimeout(t);
    TIMERS.clear();
    watchStop();
    pvClear();   // (the pictures' object URLs given back)
    for (const p of [...TXS.pics.keys()]) texFree(p);   // (the pictures trigger cubes put on objects: e6i_tex.js)
    try { hooksOff(); } catch (e) { /* an older shell */ }   // (the other circles shown again, the real world as each headset has it)
    // the scene's sounds stop, and the listener goes back to the origin (where the shell's effects expect it)
    try { emitAll(true); if (EM.ctx && EM.lis) listen(EM.ctx, new THREE.Vector3(), new THREE.Quaternion()); } catch (e) { /* closed */ }
    if (GL.tc) { try { GL.tc.detach(); GL.tc.dispose(); } catch (e) { /* gone */ } }
    for (const it of STU.items.values()) if (it.kind === 'o') dropModel(it);
    for (const E of LIB.values()) if (E.root) disposeTree(E.root, true);
    LIB.clear(); SND.clear();
    if (GL.env) GL.env.dispose();
    for (const id of [...GH.keys()]) ghostDrop(id);
    if (GHOST.edges) GHOST.edges.dispose();
    BOX1.dispose(); HIDDEN.dispose(); LOOKS.dispose();
    if (GL.mo) GL.mo.disconnect();
    if (XR.session) XR.session.removeEventListener('visibilitychange', xrVisibility);
    if (GL.scene) GL.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose(); m.dispose(); });
    });
  },
};
});
