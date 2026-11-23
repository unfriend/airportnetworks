//#use AUD audioInit
const narrationFile = () => HOST.pkgUrl('cdk5', 'audio/narration.mp3');
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
    // the story's view, taken back into the net's own frame (explore shows the sets unturned)
    const v = storyCam(ts).slice(0, 6), r = -setYaw('net', ts) * D2R, x = v[3], z = v[5];
    v[0] += r / D2R; v[3] = x * Math.cos(r) + z * Math.sin(r); v[5] = -x * Math.sin(r) + z * Math.cos(r);
    orbit.cur = v; orbit.to = null;
    // the scene the story shows (or is about to: past the middle of a move, the next), and what it lights carries over
    X.scene = SCN[clamp(Math.round(S.net_scene), 0, SCN.length - 1)]; X.t0 = performance.now();
    X.prot = -1; X.term = -1; X.path = -1; X.inside = false;
    if (X.scene === 'bioproc' && S.net_family > 0.5) (X.ctl.bioproc = X.ctl.bioproc || {}).cousins = 'on';
    if (X.scene === 'disease' && S.net_near > 0.5) (X.ctl.disease = X.ctl.disease || {}).near = 'on';
    if (S.net_partners > 0.5) X.prot = CD.cdk5;   // (CDK5's partners lit: CDK5 picked)
    X.tab = X.prot >= 0 ? 'proteins' : 'scenes';
    // from the last chapter (the story's end, or its Explore button): the landscape, in the Scenes tab
    if (ts >= C.learn.a) openStart();
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    showTab(X.tab); pushState(); renderAll();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    // the story shows its scenes as it tells them: nothing picked in explore
    X.prot = -1; X.term = -1; X.path = -1; X.inside = false; NEXT.length = 0; pushState();
    $('#tip').style.opacity = 0;
    this.t = t || 0; this.playing = true; curCh = null;
  },
};

// explore mode's start: the disease landscape, where the story ends, nothing picked, in the Scenes tab
function openStart() {
  X.inside = false;
  openScene('disease', false);
  X.prot = -1; X.term = -1; X.path = -1;
  X.tab = 'scenes'; showTab('scenes');
  orbit.cur = view('net', sceneCam()); orbit.to = null;
  renderAll();
}

//#use lastNow EXV~2
// a frame of the story or of explore mode (the engine's, with the story's own lines: explore's views are the net's,
// sceneCam, and in a headset the map may stand round you, XR.inW)
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
    const v = storyCam(ts);
    GL.nf = v[6];
    // (in a headset the first chapter stands you inside the map: standW, by story time; facing the net's inside view)
    XR.scene = S.net_scene; XR.inW = standW(ts);
    if (XR.inW > 0) { const vi = view('net', 'inside'); vi[0] += setYaw('net', ts); XR.inV = vi; }
    if (xr) xrPlace(v); else { applyCamera(v); keepCamera(S, ts); }
    updateStoryDOM(ts);
    updateTimeline(APP.t, APP.playing);
  } else {
    const pn = performance.now();
    S = exploreStep(dt, pn); tSet = pn / 1000;
    // (a wide view stands further back on a phone held upright, and its target's shift clear of the side panel, FIT,
    // goes back where there is none: both eased as the views change)
    // (the scenes are the net's views: sceneCam)
    const vn = sceneCam(), fs = fitShift('net', vn), ke = 1 - Math.exp(-dt * 3);
    GL.nf += (narrowOf('net', vn) - GL.nf) * ke;
    for (let i = 0; i < 3; i++) EXV[7 + i] += (fs[i] - EXV[7 + i]) * ke;
    const lo = lowOf('net', vn); EXV[10] += (lo[0] - EXV[10]) * ke; EXV[11] += (lo[1] - EXV[11]) * ke;
    orbitStep(xr ? pn : now);
    for (let i = 0; i < 6; i++) EXV[i] = orbit.cur[i];
    // (Stand inside: in a headset the map eases round you, turned as the view is turned)
    XR.scene = S.net_scene; XR.inW += ((X.inside ? 1 : 0) - XR.inW) * (1 - Math.exp(-dt * 2.5)); XR.inV = orbit.cur;
    if (XR.inW < 0.002 && !X.inside) XR.inW = 0;
    if (xr) xrPlace(orbit.cur); else { applyCamera(EXV); keepCamera(S, null); }
  }
  K.U.uTime.value = tSet;
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  updateSets(S, tSet, dt, APP.mode === 'story');
  arrPlace();   // (an arrangement's places, on top of what the story does with its sets)
  // what explore mode asked to do once the sets show its pick
  if (NEXT.length) { const fs = NEXT.splice(0); if (APP.mode === 'explore') for (const f of fs) f(); }
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
    // #cdk5&explore&scene=disease (a scene: bioproc, subunits, ntrk2, calpain, alzheimer, disease, or its number 0 to 5),
    // &tab=scenes|proteins|diseases|about, &links=on|off, &shell=shown|faint, &cousins=on|off, &near=on|off (every scene
    // that has the switch), &view=<a camera of the net set>, &q=CDK5R1 (a protein by its gene symbol: picked, in the
    // Proteins tab), &term=lissencephaly (a Disease Ontology term by its name or id, in the Diseases tab),
    // &path=ntrk2|alzheimer (a pathway lit), &inside (Stand inside), &now=1 (no glide)
    const sc = hp.get('scene'), tb = hp.get('tab'), tabOK = TABS.some(t => t[0] === tb);
    const si = SCN.includes(sc) ? sc : /^[0-5]$/.test(sc || '') ? SCN[+sc] : null;
    if (si) openScene(si, false);
    else if (!hp.has('t')) openStart();   // straight in: the landscape
    if (hp.has('inside')) { if (!INSIDE_OK(X.scene)) openScene('bioproc', false); X.inside = true; }   // (standing inside: the map of processes)
    orbit.cur = view('net', sceneCam()); orbit.to = null;
    for (const k of SCN) for (const c of ctlsOf(k)) {
      const q = String(hp.get(c.key) || '').toLowerCase(), o = q && c.options.find(([v, n]) => v === q || String(n).toLowerCase() === q);
      if (o) (X.ctl[k] = X.ctl[k] || {})[c.key] = o[0];
    }
    const vq = String(hp.get('view') || '').toLowerCase();
    if (vq && (GL.sets.net.cam || {})[vq]) { orbit.cur = view('net', vq); orbit.to = null; }   // a camera of its own
    if (hp.get('q')) { const i = CD.find(hp.get('q')), r = i >= 0 ? i : (searchOf(hp.get('q'))[0] ?? -1); if (r >= 0) { selectProt(r, false); showTab('proteins'); } }
    if (hp.get('term')) {
      const q = hp.get('term').trim().toLowerCase(), j = CD.terms.findIndex(t => t.name.toLowerCase() === q || t.id.toLowerCase() === q);
      const jj = j >= 0 ? j : CD.terms.findIndex(t => t.name.toLowerCase().startsWith(q));
      if (jj >= 0) { selectTerm(jj); showTab('diseases'); }
    }
    if (hp.get('path')) setPath({ ntrk2: 0, '0': 0, alzheimer: 1, '1': 1 }[hp.get('path').toLowerCase()] ?? -1, false);
    if (tabOK) showTab(tb);
    if (hp.has('now')) { Object.assign(XS, exploreTargets()); orbit.cur = orbit.to || orbit.cur; orbit.to = null; if (X.inside) XR.inW = 1; }
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
