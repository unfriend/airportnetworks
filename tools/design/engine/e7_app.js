// ------------------------------------------------------------- narration --
// The design room has no narration: AUD stays null, and the lines that would play it do nothing. The sound engine is
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
const SFXQ = { cues: [], spans: [], hi: -1, t: 0, n: 0, log: [] };
const sfxCue = (t, name, set, at, o) => { SFXQ.cues.push({ t, n: narrT(t), name, set, at, o: o || {} }); };
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
const sfxAct = (name, set, at, o) => (APP.mode === 'explore' && !sfxHidden() ? sfxPlay(name, set, at, o) : null);
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
    Object.assign(XS, DEF, { table_a: 1 });
    // from where the intro's camera is, to the table's view
    orbit.cur = storyCam(storyT(this.t)); orbit.to = null;
    showView(X.viewName);
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    renderPanes();
    updateExtraLabels();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'To the table';
    this.t = t || 0; this.playing = true; curCh = null;
  },
};

let lastNow = 0;
function frame(now, xrFrame) {
  const dt = lastNow ? Math.min(0.1, Math.max(0, (now - lastNow) / 1000)) : 0;
  lastNow = now;
  const xr = XR.on && GL.renderer.xr.isPresenting;
  if (xr) xrBegin(xrFrame, dt);
  let S, tSet;
  const t0 = APP.t;
  const was = APP.mode === 'story' && APP.playing;   // (sound effects: the story was playing as the frame began)
  if (APP.mode === 'story' && APP.playing) {
    APP.t += dt;
    audioFollow();
  }
  slideStep(t0);   // slideshow: the story waits at the end of each chapter
  sfxStep(was, dt);   // sound effects: the cues the clock crossed, the spans it is in, the live sounds
  // the end of the intro: the table (not Repeat: the design room is not one of the stories)
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
    if (xr) xrPlace(orbit.cur); else applyCamera(orbit.cur);
  }
  K.U.uTime.value = (performance.now() / 1000) % 3600;
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  if (XR.on && !XR.clear) S = Object.assign({}, S, { table_floor: 0 });   // passthrough: the table stands in your room
  updateSets(S, tSet, dt);
  builtStep();
  if (xr) xrUpdate(S);
  GL.renderer.render(GL.scene, GL.camera);
  if (!xr) {
    GL.world.updateMatrixWorld(true);
    if (APP.mode === 'story') placeLabels(LBL.storyAll, L => (L.kind === 'story' ? fadeVal(ts, L.tIn, L.tOut, 0.5) * (S[L.set + '_a'] > 0.5 ? 1 : 0) : setLabelAlpha(L, S)));
    else placeLabels(LBL.exploreAll(), L => (L.kind === 'set' ? setLabelAlpha(L, S) : L.txt ? L.show : 0));
  }
  window.__frames = (window.__frames || 0) + 1;
}
// the table fills in a few models a frame: the panes say how far it has got (four times a second at most)
let lastBuilt = -1, builtAt = 0;
function builtStep() {
  const n = GL.sets.table.built(), pn = performance.now();
  if (n === lastBuilt || (pn - builtAt < 250 && n < GL.sets.table.total())) return;
  lastBuilt = n; builtAt = pn;
  if (X.pick && !GL.sets.table.stageModel()) GL.sets.table.setPick(X.pick);
  renderPanes(); updateExtraLabels();
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
    ['Setting up explore mode', () => { buildExplore(); bindCanvas(); }],
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
  // straight into the table (#design&t=2: the intro at that second, paused); #design&pick=pet.scan puts a prop on the
  // stage, &tab=prop|all, &view=default|stage|above|group:<story>, &now without the camera's flight
  if (!hp.has('t')) APP.enterExplore();
  if (hp.get('tab')) X.tab = hp.get('tab') === 'prop' ? 'prop' : 'all';
  if (hp.get('pick')) pickProp(hp.get('pick'), !hp.get('tab'));
  if (hp.get('view') && APP.mode === 'explore') showView(hp.get('view'));
  if (hp.has('now')) { orbit.cur = orbit.to || orbit.cur; orbit.to = null; }
  renderPanes();
  // the miniatures: lowpoly.js, loaded once by the shell; the table fills in from it a few at a time
  (HOST.lowpoly ? HOST.lowpoly() : Promise.reject(new Error('this shell cannot load the miniatures'))).then(M => {
    if (GL.gone) return;
    X.minis = 'ready'; GL.sets.table.feed(M);
    if (X.pick) GL.sets.table.setPick(X.pick);
    renderPanes();
  }).catch(e => { if (GL.gone) return; X.minis = 'failed'; renderPanes(); console.warn('The miniatures did not load:', e && e.message); });
  GL.renderer.setAnimationLoop(frame); // also drives the headset's frame loop
  if (HOST.session && GL.renderer.xr.isPresenting) xrAdopt();
  LOAD.t = setTimeout(() => $('#loading').classList.add('gone'), 120);   // (dispose clears it: a story picked meanwhile keeps its loading screen)
}
LOAD.t = setTimeout(init, 40);

// what the app shell needs to change story
return {
  inputs: () => XR.ctrls.map(c => c.src),
  caption: xrCaption,
  xrPose: () => (XR.on ? { rp: GL.rig.position.clone(), rq: GL.rig.quaternion.clone(), off: XR.globeOff.clone(), s: XR.size, held: XR.ctrls.map(c => (c.grab ? c.grab.target : '')).join(' '),
    pp: XR.panelGroup.position.clone(), pr: yawOf(XR.panelGroup.quaternion, XR.panelGroup.rotation.y), rot: XR.rot.clone(), pq: XR.panelGroup.quaternion.clone() } : null),
  // shared rooms (shared.js): the clock is APP's, the shared state the prop on the stage and the miniatures moved by
  // hand (no effects)
  collab: {
    APP, scene: () => (LOAD.done ? GL.scene : null), state: collabState, apply: collabApply, view: collabView, setView: collabSetView,
    effect: designEffect,
    hover: i => { const c = XR.ctrls[i]; return c && c.hover ? c.ray.scale.z : 0; },
    panel(p, yaw, q) { xrPanelPose(p, yaw, q); },
    place(o, s, q) { XR.globeOff.fromArray(o); XR.size = s; xrSceneRot(q); },
  },
  // for tests and the browser console: HOST.cur.peek('NET.N')
  peek: src => eval(src),
  dispose() {
    // timers left running must not write into the next story's panes (they share ids) or build this one after all
    GL.gone = true;
    LOAD.gone = true; clearTimeout(LOAD.t); clearTimeout(xrMsg.t);
    if (GL.mo) GL.mo.disconnect();
    if (XR.session) XR.session.removeEventListener('visibilitychange', xrVisibility);
    if (GL.scene) GL.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose(); m.dispose(); });
    });
  },
};
});
