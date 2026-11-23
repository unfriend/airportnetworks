//#use AUD audioInit
const narrationFile = () => HOST.pkgUrl('robots', 'audio/narration.mp3');
//#use audioSync audioFollow audioLabel audioToggle SLIDE slidesOn slideStop slideVoice slideStep slideTail slideSound
//#use slideNext slideToggle slideSig slideDOM SFXQ sfxCue sfxHold sfxN _sfv sfxWhere sfxPlay sfxHidden sfxAct sfxStep
//#use sfxPos
// ================================================================== APP ==
const APP = {
  mode: 'story', t: 0, playing: true,
  seek(t) { this.t = clamp(t, 0, T_END - 0.01); if (this.mode !== 'story') this.enterStory(this.t); },
  togglePlay() { if (this.mode !== 'story') return; if (this.t >= T_END - 0.05) this.t = 0; this.playing = !this.playing; },
  enterExplore() {
    if (this.mode === 'explore') return;
    this.mode = 'explore';
    document.body.classList.add('exploring');
    $('#btnMode').textContent = 'Replay story';
    // carry on from what the story shows (its look, the robots where they are), then the explore defaults:
    // follow me, six robots, no cleaned floor, no links, the view from above
    const ts = storyT(this.t), S = storyState(ts);
    for (const n in DEF) XS[n] = S[n];
    const v = storyCam(ts);
    orbit.cur = v.slice(0, 6); orbit.to = null; X.g = v[6];
    X.scene = 'robots'; X.t0 = performance.now();
    X.ctl.robots = { view: 'default', rule: 'follow', robots: '6', trails: 'off', links: 'off' };
    flyTo(view('robots', 'default'));
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    renderScenes();
    updateExtraLabels();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    this.t = t || 0; this.playing = true; curCh = null;
  },
};

// for tests and screenshots (sweep.mjs): run the gang through the story from t0 to t1, or on in explore mode for a
// number of seconds, in steps of a tenth of a second without drawing (the robots' past is what makes the picture)
function simStory(t0, t1) {
  for (let t = t0; t < t1 - 1e-6; t += 0.1) {
    const v = storyCam(t);
    applyView(v, v[6], false, 0.1); tellRobots(false); updateSets(storyState(t), t, Math.min(0.1, t1 - t), true);
  }
}
function simExplore(sec) {
  for (let k = 0; k < sec * 10; k++) {
    const S = exploreStep(0.1, performance.now());
    orbitStep(performance.now()); applyView(orbit.cur, X.g, viewNow() === 'eyes', 0.1); tellRobots(false); updateSets(S, 0, 0.1, false);
  }
}

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
  // the end: Repeat (shell) starts this story or the next one again, else explore mode opens
  if (APP.mode === 'story' && APP.playing && APP.t >= T_END) { APP.t = T_END; if (HOST.ended()) APP.playing = false; else APP.enterExplore(); }
  audioSync();
  const ts = storyT(APP.t); // original story time for this point in the narration
  if (APP.mode === 'story') {
    S = storyState(ts); tSet = ts;
    if (!xr) { const v = storyCam(ts); applyView(v, v[6], false, dt); }
    updateStoryDOM(ts);
    updateTimeline(APP.t, APP.playing);
  } else {
    const pn = performance.now();
    S = exploreStep(dt, pn); tSet = pn / 1000;
    orbitStep(xr ? pn : now);
    if (!xr) applyView(orbit.cur, X.g, viewNow() === 'eyes', dt);
  }
  K.U.uTime.value = (performance.now() / 1000) % 3600;   // the robots live on while the story is paused
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  if (XR.on && !XR.clear) S = Object.assign({}, S, { robots_room: 0 });   // passthrough: your own room, overlays only
  tellRobots(xr);
  updateSets(S, tSet, dt, APP.mode === 'story');
  arrPlace();   // (an arrangement's places, on top of what the story does with its sets)
  updateLive();
  if (xr) xrUpdate(S);
  GL.renderer.render(GL.scene, GL.camera);
  if (!xr) {
    GL.world.updateMatrixWorld(true);
    if (APP.mode === 'story') placeLabels(LBL.storyAll, L => (L.kind === 'story' ? fadeVal(ts, L.tIn, L.tOut, 0.5) * (S[L.set + '_a'] > 0.5 ? 1 : 0) : setLabelAlpha(L, S)));
    else placeLabels(LBL.exploreAll(), L => (L.kind === 'set' ? setLabelAlpha(L, S) : 1));
  }
  window.__frames = (window.__frames || 0) + 1;
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
  if (hp.has('explore')) {
    APP.enterExplore();
    // #robots&explore&rule=chain&robots=12&trails=on&links=on&view=low (any control by its key);
    // &crumbs spills a pile near you, &walk=x,z walks you there
    orbit.cur = view(X.scene, 'default'); orbit.to = null;
    // controls after the default view, so a control's own view wins
    const s = GL.sets[X.scene];
    // (the story's own key comes first in the hash and is also a control here: robots=12)
    for (const c of s.controls || []) { const v = hp.getAll(c.key).filter(Boolean).pop(); if (v) setCtl(X.scene, c.key, v); }
    if (hp.get('walk')) { const w = hp.get('walk').split(',').map(Number); if (w.length === 2 && w.every(isFinite)) s.walkTo(w[0], w[1]); }
    if (hp.has('crumbs')) spillCrumbs();
    if (hp.has('now')) { Object.assign(XS, exploreTargets()); orbit.cur = orbit.to || orbit.cur; orbit.to = null; X.g = viewNow() === 'low' ? 1 : 0; if (viewNow() === 'eyes') CAMV.e = 1; }
  }
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
  // shared rooms (shared.js): the clock is APP's, the shared state the gang's controls, crumbs and dust effects (the
  // robots themselves run on each device)
  collab: {
    APP, scene: () => (LOAD.done ? GL.scene : null), state: collabState, apply: v => { SFXQ.quiet++; try { return collabApply(v); } finally { SFXQ.quiet--; } }, view: collabView, setView: collabSetView,
    effect(type, d) { if (type === 'crumbs') crumbsIn(d); else if (type === 'dust') dustNow(); },
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
