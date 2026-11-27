//#use AUD audioInit
const narrationFile = () => HOST.pkgUrl('qubits', 'audio/narration.mp3');
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
    let best = 'cube', ba = 0;
    for (const k of SET_ORDER) { const a = Math.max(S[k + '_a'], 0.9 * S2[k + '_a']); if (a > ba + 0.01) { ba = a; best = k; } }
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
        for (const n in tg) if (n in S && !n.endsWith('_a') && !/_focus$|_code$/.test(n)) d += (tg[n] - S[n]) ** 2;
        if (d < bd) { bd = d; bo = v; }
      }
      X.ctl[best][ct.key] = bo;
    }
    // the story's picks carry over to the panes: the string on the big cube, the gallery, the strings added up
    X.brick = null; X.sum = 0; X.gal = 'largest';
    if (best === 'cube') {
      const L = clamp(Math.round(S.cube_bits), 1, 3), f = Math.round(S.cube_focus);
      if (f >= 0 && f < 1 << (2 * L)) X.brick = Q.name(f, L);
      if (S.cube_lesson > 0.5) X.gal = 'kinds';
      else if (S.cube_build > 0.5) X.sum = clamp(Math.round(S.cube_sum), 0, NB());
    }
    X.tab = best === 'chart' ? 'depth' : best === 'pairs' ? 'scenes' : viewIs('cube', 'bricks') || viewIs('cube', 'toolbox') ? 'bricks' : 'network';
    // from the last chapter (the story's end, or its Explore button): the cube, in the Network tab
    if (ts >= C.circuit.a) openStart();
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    showTab(X.tab); pushState(); renderAll();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    // the story shows its scenes as it tells them: no picked string
    X.brick = null; X.sum = 0; NEXT.length = 0; pushState();
    $('#tip').style.opacity = 0;
    this.t = t || 0; this.playing = true; curCh = null;
  },
};

// explore mode's start: the story's network on the cube, in the Network tab
function openStart() {
  openScene('cube', false);
  X.ctl.cube = Object.assign(X.ctl.cube || {}, { view: 'cube', net: String(NETI), cut: '0', bits: '3' });
  X.brick = null; X.sum = 0; X.gal = 'largest';
  X.tab = 'network'; showTab('network');
  orbit.cur = view('cube', viewCam('cube') || 'default'); orbit.to = null;
  renderAll();
}

//#use lastNow EXV
const frameLife = () => false, frameLow = () => {}, frameFloor = () => {};   // (frame: nothing life size, low or on a floor)
//#use pageIdle frame applyTheme LOAD init loadStep warm
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
    // #qubits&explore&scene=cube&view=bricks (any control of a scene by its key, or an option by its name or camera),
    // &tab=network|bricks|depth|scenes, &net=blurred (an example network by key or name, or its number), &cut=random,
    // &bits=2, &alg=so7 or so6 (or odd, tfim), &brick=X2X1, &sum=10 (strings added up), &gal=kinds, &ex=on, &src=ex
    const sc = hp.get('scene');
    if (sc && GL.sets[sc]) { openScene(sc, false); showTab('scenes'); }
    else if (!hp.has('t')) openStart();   // straight in: the cube
    orbit.cur = view(X.scene, viewCam(X.scene) || 'default'); orbit.to = null;
    // controls after the default view, so a control's own view wins
    for (const c of ctlsOf(X.scene)) {
      const q = String(hp.get(c.key) || '').toLowerCase(), o = q && c.options.find(([v, n]) => v.toLowerCase() === q || String(n).toLowerCase() === q || camFor(X.scene, v) === q || (CAM_ALIAS[X.scene] || {})[v] === q);
      if (o) setCtl(X.scene, c.key, o[0]);
    }
    // the cube's network, cut, bits and algebra from any tab
    const nq = String(hp.get('net') || '').toLowerCase(), ni = Q.NETS.findIndex((n, i) => n.key === nq || n.name.toLowerCase() === nq || String(i) === nq);
    if (ni >= 0) setCtl('cube', 'net', String(ni));
    if (hp.get('cut')) setCtl('cube', 'cut', /^(1|random)/i.test(hp.get('cut')) ? '1' : '0');
    if (hp.get('bits')) setCtl('cube', 'bits', String(clamp(parseInt(hp.get('bits'), 10) || 3, 1, 3)));
    if (hp.get('alg')) setCtl('cube', 'alg', /^(0|tfim|so6|so\(6\)|so\(2l\))$/i.test(hp.get('alg')) ? '0' : '1');
    if (hp.get('ex')) setCtl('chart', 'ex', /^(1|on)$/i.test(hp.get('ex')) ? 'on' : 'off');
    if (hp.get('src')) setCtl('chart', 'src', /^(1|ex)/i.test(hp.get('src')) ? 'ex' : 'real');
    if (hp.get('gal')) setGal(hp.get('gal') === 'kinds' ? 'kinds' : 'largest', false);
    if (isBrick(hp.get('brick'))) { showTab('bricks'); selectBrick(hp.get('brick'), hp.get('gal') === 'kinds' ? 'kinds' : null); }
    if (hp.get('sum') && Number.isFinite(+hp.get('sum'))) { showTab('bricks'); setSum(+hp.get('sum')); }
    if (hp.get('tab') && TABS.some(t => t[0] === hp.get('tab'))) {
      if (sc || hp.get('brick') || hp.get('sum')) showTab(hp.get('tab')); else pickTab(hp.get('tab'));
    }
    if (hp.has('now')) { Object.assign(XS, exploreTargets()); orbit.cur = orbit.to || orbit.cur; orbit.to = null; }
    renderAll();
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
