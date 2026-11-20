//#use AUD audioInit
const narrationFile = () => 'audio/narration-pet.mp3';
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
    X.hand = null; X.synced = false;   // (no hand-over carried over; a room's next scene is its state, not a change)
    document.body.classList.add('exploring');
    $('#btnMode').textContent = 'Replay story';
    // carry on from what the story shows: its look, its camera, its scene
    const ts = storyT(this.t), S = storyState(ts);
    for (const n in DEF) XS[n] = S[n];
    let best = 'organs', ba = 0;
    for (const k of SET_ORDER) if (S[k + '_a'] > ba + 0.01) { ba = S[k + '_a']; best = k; }
    if (best === 'body' && S.organs_a > 0.3) best = 'organs';   // (the organs lie in the body)
    // the story's view, taken back into the set's own frame (explore shows sets unturned)
    const v = storyCam(ts).slice(0, 6), r = -setYaw(best, ts) * D2R, x = v[3], z = v[5];
    v[0] += r / D2R; v[3] = x * Math.cos(r) + z * Math.sin(r); v[5] = -x * Math.sin(r) + z * Math.cos(r);
    orbit.cur = v; orbit.to = null;
    X.scene = best; X.t0 = performance.now();
    // and pick the scene's controls that come closest to what the story was showing
    const s = GL.sets[best];
    X.ctl[best] = {};
    for (const ct of ctlsOf(best)) {
      let bo = ct.options[0][0], bd = Infinity;
      for (const [v] of ct.options) {
        const c = { t: 1e3 };
        for (const c2 of s.controls || []) c[c2.key] = c2 === ct ? v : ctlValue(best, c2);
        const tg = s.explore ? s.explore(c) : {};
        let d = 0;
        for (const n in tg) if (n in S && !n.endsWith('_a')) d += (tg[n] - S[n]) ** 2;
        if (d < bd) { bd = d; bo = v; }
      }
      X.ctl[best][ct.key] = bo;
    }
    // (the search tried every option on the set: a set that remembers what it showed last, as the organs do for their
    // network's crossfade, is told the chosen ones, long settled, twice)
    if (s.explore) { const c = { t: 1e3 }; for (const c2 of s.controls || []) c[c2.key] = ctlValue(best, c2); s.explore(c); s.explore(c); }
    // the story's network and organ carry over to the panels (the controls hold the network: the closest one was picked
    // above)
    X.organ = null; X.cmp = -1; X.netX = null;
    if (best === 'organs' && S.organs_focus > 0.5) X.organ = PD.ids[Math.round(S.organs_focus) - 1] || null;
    if (best === 'organs' && S.organs_net > 0.5) { const w = NET_ALL[Math.round(S.organs_which)]; if (w) { if (NET_EXTRA.includes(w)) X.netX = w; X.cmp = cmpOfNet(w); } }
    X.tab = best === 'organs' ? (S.organs_net > 0.5 ? 'networks' : 'organs') : 'scenes';
    // from the closing credits (the story's end, or its Explore button): the networks of the paper
    if (ts >= C.health.a + 47.5) openNetworks();
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    showTab(X.tab); pushState(); renderAll();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    X.hand = null;
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    // the story shows its scenes as it tells them: no picked organ or group, the scanner not life size
    if (X.life) setLife(false);
    X.organ = null; NEXT.length = 0; pushState();
    LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); }); LBL.extra = [];
    $('#tip').style.opacity = 0;
    this.t = t || 0; this.playing = true; curCh = null;
  },
};

// explore mode's start: the network of all scans, in the Networks tab
function openNetworks() {
  openScene('organs', false);
  const v = optKey('organs', 'view', /net/i);
  if (v) (X.ctl.organs = X.ctl.organs || {}).view = v;
  setNet('full'); X.tab = 'networks'; showTab('networks');
  orbit.cur = view('organs', viewCam('organs') || 'default'); orbit.to = null;
}

//#use lastNow EXV
// (frame: the scanner life size stands neither further back nor shifted; in passthrough the room's own floor, not the
// scanner's)
const frameLife = () => X.life && X.scene === 'scan', frameLow = () => {};
const frameFloor = S => { if (XR.on && !XR.clear && 'scan_floor' in S) S.scan_floor = 0; };
//#use frame
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
    // #pet&explore&scene=scan&view=ring (any control of a scene by its key), &tab=networks|organs|scenes,
    // &cmp=7 (a row of Table 2), &net=C_high (or vena, dose_ultralow ...), &organ=muscle, &life (the scanner life size)
    const sc = hp.get('scene');
    if (sc && GL.sets[sc]) { openScene(sc, false); showTab('scenes'); }
    else if (!hp.has('t')) openNetworks();   // straight in: the network of all scans
    orbit.cur = view(X.scene, viewCam(X.scene) || 'default'); orbit.to = null;
    // controls after the default view, so a control's own view wins
    for (const c of ctlsOf(X.scene)) if (hp.get(c.key) && c.options.some(o => o[0] === hp.get(c.key))) setCtl(X.scene, c.key, hp.get(c.key));
    if (hp.get('cmp') !== null && hp.get('cmp') !== '') { const i = parseInt(hp.get('cmp'), 10); if (i >= 0 && i < PD.D.table2.length) { showTab('networks'); selectCmp(i); } }
    if (NET_ALL.includes(hp.get('net'))) { showTab('networks'); pickNet(hp.get('net')); }
    if (PD.byId[hp.get('organ')]) { showTab('organs'); selectOrgan(hp.get('organ')); }
    if (hp.has('life')) setLife(true);   // (it opens the Scenes tab: a tab asked for comes after)
    if (hp.get('tab') && TABS.some(t => t[0] === hp.get('tab'))) showTab(hp.get('tab'));
    if (hp.has('now')) { Object.assign(XS, exploreTargets()); orbit.cur = orbit.to || orbit.cur; orbit.to = null; }
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
  // shared rooms (shared.js): the clock is APP's, the shared state the explore panes, and there are no effects
  collab: {
    APP, scene: () => (LOAD.done ? GL.scene : null), state: collabState, apply: v => { SFXQ.quiet++; try { return collabApply(v); } finally { SFXQ.quiet--; } }, view: collabView, setView: collabSetView,
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
