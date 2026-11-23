//#use AUD audioInit
const narrationFile = () => HOST.pkgUrl('soil', 'audio/narration.mp3');
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
    let best = 'field', ba = 0;
    for (const k of SET_ORDER) { const a = Math.max(S[k + '_a'], 0.9 * S2[k + '_a']); if (a > ba + 0.01) { ba = a; best = k; } }
    if (best === 'field' && S.net_a > 0.5) best = 'net';   // (the cloud and the network float over the field)
    // the story's view, taken back into the set's own frame (explore shows sets unturned)
    const v = storyCam(ts).slice(0, 6), r = -setYaw(best, ts) * D2R, x = v[3], z = v[5];
    v[0] += r / D2R; v[3] = x * Math.cos(r) + z * Math.sin(r); v[5] = -x * Math.sin(r) + z * Math.cos(r);
    orbit.cur = v; orbit.to = null;
    X.scene = best; X.t0 = performance.now();
    // the story's picks carry over: a module lit, a group of plots tagged
    X.mod = best === 'net' && S.net_focus >= 0 ? Math.round(S.net_focus) : -1;
    X.rho = 0.6; X.shuf = 0; X.kind = -1;
    X.plot = best === 'field' && S.field_pick >= 0 && S.field_tags > 0.5 ? Math.round(S.field_pick) : -1;
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
    // (the field's measure on show: the story's)
    if (best === 'field' && S.field_tags > 0.5) X.ctl.field.show = SHOWS[clamp(Math.round(S.field_show), 0, 4)];
    X.tab = { soil: 'nitrogen', field: 'field', net: S.net_pull > 0.5 ? 'network' : 'microbes' }[best] || 'scenes';
    // from the last chapter (the story's end, or its Explore button): the field, in the Field tab
    if (ts >= C.know.a) openStart();
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    showTab(X.tab); pushState(); renderAll();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    // the story shows its scenes as it tells them: nothing picked in explore
    X.mod = -1; X.kind = -1; X.plot = -1; X.shuf = 0; NEXT.length = 0; pushState();
    $('#tip').style.opacity = 0;
    this.t = t || 0; this.playing = true; curCh = null;
  },
};

// explore mode's start: the field at the end of the season (day 70), its leaves by their chlorophyll, both wheats and
// every regime, in the Field tab
function openStart() {
  openScene('field', false);
  X.ctl.field = Object.assign(X.ctl.field || {}, { view: 'default', date: '4', show: 'chl', line: 'both', fert: 'all' });
  X.mod = -1; X.kind = -1; X.plot = -1; X.shuf = 0;
  X.tab = 'field'; showTab('field');
  orbit.cur = view('field', viewCam('field') || 'default'); orbit.to = null;
  renderAll();
}

//#use lastNow EXV~2
const frameLife = () => false, frameFloor = () => {};   // (frame: nothing life size or on a floor)
//#use frameLow frame applyTheme LOAD init loadStep warm
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
    // #soil&explore&scene=net&view=split (a scene; view: an option by its key or name, or a camera of the scene by
    // name), &tab=field|nitrogen|microbes|network|scenes (picked by hand: its scene comes up), any control by its key
    // (date=0..4, show=chl|nh4|no3|n2o|ph, line=both|0|1, fert=all|0|1|2, wheat=bni|ctrl, dcd=on|off, colour=phylum|module|guild,
    // by=line|fert|random; by option or name), &split=line|fert|random|off, &mod=3 (a module, 1 to 17), &rho=0.7,
    // &shuffle, &kind=215 (a kind by its number), &plot=0..5 (a group of plots: line * 3 + regime)
    const sc = hp.get('scene'), tb = hp.get('tab'), tabOK = TABS.some(t => t[0] === tb);
    if (sc && GL.sets[sc] && SCENES.some(s => s[0] === sc)) { openScene(sc, false); showTab(tabOK ? tb : 'scenes'); }
    else if (tabOK) pickTab(tb);
    else if (!hp.has('t')) openStart();   // straight in: the field
    orbit.cur = view(X.scene, viewCam(X.scene) || 'default'); orbit.to = null;
    // every scene's controls but the views by their keys (the soil block's and the field's 'fert' share no option), then
    // the view of the scene on show
    const opt = (k, c, q) => c.options.find(([v, n]) => v.toLowerCase() === q || String(n).toLowerCase() === q || camFor(k, v) === q || (CAM_ALIAS[k] || {})[v] === q);
    for (const [k] of SCENES) for (const c of ctlsOf(k)) {
      const q = String(hp.get(c.key) || '').toLowerCase(), o = q && c.key !== 'view' && c.key !== viewKey(k) && opt(k, c, q);
      if (o) { if (k === X.scene) setCtl(k, c.key, o[0]); else (X.ctl[k] = X.ctl[k] || {})[c.key] = o[0]; }
    }
    const vk = viewKey(X.scene), vq = String(hp.get('view') || hp.get(vk) || '').toLowerCase(), vc = ctlOf(X.scene, vk), vo = vq && vc && opt(X.scene, vc, vq);
    if (vo) setCtl(X.scene, vk, vo[0]);
    else if (vq && (GL.sets[X.scene].cam || {})[vq]) { orbit.cur = view(X.scene, vq); orbit.to = null; }   // a camera of its own
    const hnum = k => (hp.get(k) !== null && hp.get(k) !== '' && Number.isFinite(+hp.get(k)) ? +hp.get(k) : null);
    if (hp.has('split')) setSplit(['line', 'fert', 'random'].includes(hp.get('split')) ? hp.get('split') : 'off');
    if (hnum('mod') !== null) selectModule(Math.round(hnum('mod')) - 1);
    if (hnum('rho') !== null) setRho(hnum('rho'));
    if (hp.has('shuffle')) setShuffle(true);
    if (hnum('kind') !== null) selectKind(kindOfRank(Math.round(hnum('kind'))), false);
    if (hnum('plot') !== null) selectPlot(Math.round(hnum('plot')), false);
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
