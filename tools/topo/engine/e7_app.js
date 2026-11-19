// ------------------------------------------------------------- narration --
// Optional voice-over: put an MP3 at audio/narration-topo.mp3.
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently. The sound engine is the shell's
// (HOST.audio): one engine for the whole app, unlocked by the first tap or click
// and kept running across stories and headset sessions.
let AUD = null;
function audioInit() {
  AUD = HOST.audio.narration('audio/narration-topo.mp3', {
    // a recording longer than the story stretches the timeline
    ready(d) {
      if (d + 1 <= T_END) return;
      T_END = d + 1;
      document.querySelectorAll('#track .tick, #track .name').forEach(el => {
        const c = C[el.dataset.k]; if (c) el.style.left = (100 * c.na / T_END).toFixed(2) + '%';
      });
      $('#track').setAttribute('aria-valuemax', Math.round(T_END)); lastTick = -1;
    },
    error() { xrMsg('The narration file could not be played. Export it as a standard MP3 and upload it again.'); },
  });
  // react at once to play/pause, seeks, chapter jumps and mode changes
  for (const name of ['seek', 'togglePlay', 'enterExplore', 'enterStory']) {
    const f = APP[name];
    APP[name] = function (...args) { const r = f.apply(APP, args); AUD.seeked(); audioSync(); return r; };
  }
}
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
    // carry on from what the story shows: its look, its camera, its scene
    const ts = storyT(this.t), S = storyState(ts);
    for (const n in DEF) XS[n] = S[n];
    // (the set on show, or the one about to come: a short fade between two of the same set's views shows none)
    const S2 = storyState(Math.min(ts + 1.5, T_END));
    let best = 'tower', ba = 0;
    for (const k of SET_ORDER) { const a = Math.max(S[k + '_a'], 0.9 * S2[k + '_a']); if (a > ba + 0.01) { ba = a; best = k; } }
    if (best === 'slide' && S.map_a > 0.5) best = 'map';   // (the map lies on the slide's window)
    if (best === 'body' && S.slide_a > 0.3) best = 'slide';   // (the liver's slice has become the tile)
    // the story's view, taken back into the set's own frame (explore shows sets unturned)
    const v = storyCam(ts).slice(0, 6), r = -setYaw(best, ts) * D2R, x = v[3], z = v[5];
    v[0] += r / D2R; v[3] = x * Math.cos(r) + z * Math.sin(r); v[5] = -x * Math.sin(r) + z * Math.cos(r);
    orbit.cur = v; orbit.to = null;
    // (in a headset the tall tower's axis stood a little further off than the view's target, see standView: explore
    // turns a scene round its target, so the target glides back onto the axis)
    const sb = XR.on && best === 'tower' ? standW(ts) * STAND_BACK : 0;
    if (sb > 0) { const A = v[0] * D2R; flyTo([v[0], v[1], v[2], v[3] - sb * Math.sin(A), v[4], v[5] - sb * Math.cos(A)]); }
    X.scene = best; X.t0 = performance.now();
    // the story's numbers carry over to the panes first (the radii), so the controls are matched with them
    if (best === 'tower') X.r = clamp(Math.round(S.tower_r * 100) / 100, 1.5, 60);
    if (best === 'map') X.mr = clamp(Math.round(S.map_r * 100) / 100, 1.5, 60);
    X.slide = -1; X.cell = -1;
    // and pick the scene's controls that come closest to what the story was showing
    const s = GL.sets[best];
    X.ctl[best] = {};
    for (const ct of ctlsOf(best)) {
      let bo = ct.options[0][0], bd = Infinity;
      for (const [v] of ct.options) {
        const c = ctlArgs(best, 0);
        c.t = 1e3; c[ct.key] = v;
        const tg = s.explore ? s.explore(c) : {};
        let d = 0;
        for (const n in tg) if (n in S && !n.endsWith('_a') && !/_pick$/.test(n)) d += (tg[n] - S[n]) ** 2;
        if (d < bd) { bd = d; bo = v; }
      }
      X.ctl[best][ct.key] = bo;
    }
    X.tab = { tower: 'patch', cohort: S.cohort_gamma > 0.5 ? 'scales' : 'cohort', map: 'cells' }[best] || 'scenes';
    if (X.tab === 'scales') X.ctl.cohort.view = 'scales';
    // from the last chapter (the story's end, or its Explore button): the patch, in the Patch tab
    if (ts >= C.next.a) openStart();
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    showTab(X.tab); pushState(); renderAll();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    // the story shows its scenes as it tells them: no slide or cell picked in explore
    X.slide = -1; X.cell = -1; NEXT.length = 0; pushState();
    $('#tip').style.opacity = 0;
    this.t = t || 0; this.playing = true; curCh = null;
  },
};

// explore mode's start: the poster's patch with its tower standing, at the radius where the big loop has just closed,
// in the Patch tab
function openStart() {
  openScene('tower', false);
  X.ctl.tower = Object.assign(X.ctl.tower || {}, { view: 'tower' });
  X.r = Math.round(FACTS.snaps[1].r * 100) / 100; X.slide = -1; X.cell = -1;
  X.tab = 'patch'; showTab('patch');
  orbit.cur = view('tower', viewCam('tower') || 'default'); orbit.to = null;
  renderAll();
}

//#use lastNow EXV~2 frame applyTheme LOAD init loadStep warm
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
    // #topo&explore&scene=slide&look=points (a scene; view: an option by its key or name, or a camera of the scene by
    // name; mode= for look=), &tab=patch|cohort|scales|cells|scenes (picked by hand: its scene comes up), any control by
    // its key (lit=loops, dim=0, show=map, delta=100, piece=window, scale=radius, liver=slice; by option or name),
    // &tower=on|off (the patch's tower or its balls), &r=13.5 (the patch's radius, or in the Cells tab a cell's network's),
    // &slide=17 (1 to 123), &from=5&to=15 (a window of radii; to=above), &cell=1234 (1 to 6,716)
    const sc = hp.get('scene'), tb = hp.get('tab'), tabOK = TABS.some(t => t[0] === tb);
    if (hp.has('mode') && !hp.has('look')) hp.set('look', hp.get('mode'));
    if (sc && GL.sets[sc] && SCENES.some(s => s[0] === sc)) { openScene(sc, false); showTab(tabOK ? tb : 'scenes'); }
    else if (tabOK) pickTab(tb);
    else if (!hp.has('t')) openStart();   // straight in: the patch
    orbit.cur = view(X.scene, viewCam(X.scene) || 'default'); orbit.to = null;
    // every scene's controls but the views by their keys (no two scenes share one), then the view of the scene on show
    const opt = (k, c, q) => c.options.find(([v, n]) => v.toLowerCase() === q || String(n).toLowerCase() === q || camFor(k, v) === q || (CAM_ALIAS[k] || {})[v] === q);
    for (const [k] of SCENES) for (const c of ctlsOf(k)) {
      const q = String(hp.get(c.key) || '').toLowerCase(), o = q && c.key !== 'view' && c.key !== viewKey(k) && opt(k, c, q);
      if (o) { if (k === X.scene) setCtl(k, c.key, o[0]); else (X.ctl[k] = X.ctl[k] || {})[c.key] = o[0]; }
    }
    if (hp.has('tower') && X.scene === 'tower' && !hp.get('view')) setCtl('tower', 'view', hp.get('tower') === 'off' ? 'balls' : 'tower');
    const vk = viewKey(X.scene), vq = String(hp.get('view') || hp.get(vk) || '').toLowerCase(), vc = ctlOf(X.scene, vk), vo = vq && vc && opt(X.scene, vc, vq);
    if (vo) setCtl(X.scene, vk, vo[0]);
    else if (vq && (GL.sets[X.scene].cam || {})[vq]) { orbit.cur = view(X.scene, vq); orbit.to = null; }   // a camera of its own (the tower's up, stand)
    const num = k => (hp.get(k) !== null && hp.get(k) !== '' && Number.isFinite(+hp.get(k)) ? +hp.get(k) : null);
    if (num('r') !== null) { if (X.scene === 'map') setMR(num('r'), false); else setR(num('r'), false); }
    if (num('slide') !== null) selectSlide(Math.round(num('slide')) - 1, false);
    if (num('from') !== null) setFrom(num('from'));
    if (num('to') !== null || /^(above|inf)/i.test(hp.get('to') || '')) setTo(num('to') !== null ? num('to') : 100.5);
    if (num('cell') !== null) {
      selectCell(Math.round(num('cell')) - 1, false);
      // (the cell's own view, round the cell picked)
      if (X.scene === 'map' && X.cell >= 0) { const p = api('map').pos(X.cell), v = view('map', 'cell'); orbit.cur = [v[0], v[1], v[2], p[0], v[4], p[2]]; orbit.to = null; }
    }
    if (hp.has('now')) { Object.assign(XS, exploreTargets()); orbit.cur = orbit.to || orbit.cur; orbit.to = null; }
    renderAll();
  }
  GL.renderer.setAnimationLoop(frame); // also drives the headset's frame loop
  if (HOST.session && GL.renderer.xr.isPresenting) xrAdopt();
  LOAD.t = setTimeout(() => $('#loading').classList.add('gone'), 120);   // (dispose clears it: a story picked meanwhile keeps its loading screen)
}
LOAD.t = setTimeout(init, 40);

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
