// ------------------------------------------------------------- narration --
// The design room has no narration: AUD stays null, and the lines that would play it do nothing. The sound engine is
// the shell's (HOST.audio), unlocked by the first tap or click and kept across stories and headset sessions.
let AUD = null;
function audioInit() { /* nothing to narrate */ }
//#use audioSync audioFollow
//#use audioLabel audioToggle SLIDE slidesOn slideStop slideVoice slideStep slideTail slideSound slideNext slideToggle
//#use slideSig slideDOM SFXQ sfxCue sfxHold sfxN _sfv sfxWhere sfxPlay sfxHidden sfxAct sfxStep sfxPos
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

//#use lastNow
function frame(now, xrFrame) {
  const dt = lastNow ? Math.min(0.1, Math.max(0, (now - lastNow) / 1000)) : 0;
  lastNow = now;
  const xr = XR.on && GL.renderer.xr.isPresenting;
  if (xr) xrBegin(xrFrame, dt);
  if (xrIdle(xr, dt)) return;   // (away from every station a second: only the rays, the quiet narration and the render)
  let S, tSet;
  const t0 = APP.t;
  const was = APP.mode === 'story' && APP.playing;   // (sound effects: the story was playing as the frame began)
  if (APP.mode === 'story' && APP.playing) {
    APP.t += dt;
    audioFollow();
    arrSkip();   // (an arrangement's skipped chapters: playing jumps over them)
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
  arrPlace();   // (an arrangement's places, on top of what the story does with its sets)
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
//#use applyTheme LOAD init loadStep warm
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

//#use ARR

// what the app shell needs to change story
return {
  inputs: () => XR.ctrls.map(c => c.src),
  caption: xrCaption,
  recenter: xrRecenterAsk,
  panels: () => (XR.main && XR.foot ? { main: XR.main, foot: XR.foot } : null),   // (for the shell's menu, its Story tab)
  xrPose: () => (XR.on ? { rp: GL.rig.position.clone(), rq: GL.rig.quaternion.clone(), off: XR.globeOff.clone(), s: XR.size, held: XR.ctrls.map(c => (c.grab ? c.grab.target : '')).join(' '),
    pp: XR.panelGroup.position.clone(), pr: yawOf(XR.panelGroup.quaternion, XR.panelGroup.rotation.y), rot: XR.rot.clone(), pq: XR.panelGroup.quaternion.clone() } : null),
  // shared rooms (shared.js): the clock is APP's, the shared state the prop on the stage and the miniatures moved by
  // hand (no effects)
  collab: {
    APP, scene: () => (LOAD.done ? GL.scene : null), state: collabState, apply: v => { SFXQ.quiet++; try { return collabApply(v); } finally { SFXQ.quiet--; } }, view: collabView, setView: collabSetView,
    effect: designEffect,
    hover: i => { const c = XR.ctrls[i]; return c && c.hover ? c.ray.scale.z : 0; },
    panel(p, yaw, q) { xrPanelPose(p, yaw, q); },
    place(o, s, q) { XR.globeOff.fromArray(o); XR.size = s; xrSceneRot(q); },
  },
  // arrangements (tools/engine/SPEC.md): the story's own timeline as data, an arrangement laid over it, the one laid
  arrange: ARR_API,
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
