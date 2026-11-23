//#use AUD audioInit
// Optional voice-over, one recording per language on one timeline (NARRATION_SYNC): packages/pass/audio/narration.mp3 in
// English and packages/pass/audio/narration-de.mp3 in German (node tools/voice/narrate.mjs pass makes both, a synthetic voice
// each, and lays out the story for the longer of the two lines at every cue). The language on show plays its own
// (AUDIO, audioLang: switched in place, the clock, playing and the slideshow kept), so in a shared room every device
// plays its own language on the station's clock.
const AUDIO = { en: HOST.pkgUrl('pass', 'audio/narration.mp3'), de: HOST.pkgUrl('pass', 'audio/narration-de.mp3') };
const narrationFile = () => AUDIO[LANG] || AUDIO.en;
// the language switched (setLang): the other language's recording, from where the story is now. The shell keeps one
// file at a time, so it is fetched again (the service worker's copy) and decoded; meanwhile the <audio> element plays
// it, or the story runs on its own clock until it can (a missing file: silent, as before)
function audioLang() {
  const url = arrVoice();   // (an arrangement's recording stays: it has one language)
  if (!AUD || AUD.url === url) return;
  AUD = HOST.audio.narration(url, AUD_HOOKS);
  AUD.seeked(); audioSync();
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
    let best = 'fish', ba = 0;
    for (const k of SET_ORDER) { const a = Math.max(S[k + '_a'], 0.9 * S2[k + '_a']); if (a > ba + 0.01) { ba = a; best = k; } }
    // the story's view, taken back into the set's own frame (explore shows sets unturned)
    const v = storyCam(ts).slice(0, 6), r = -setYaw(best, ts) * D2R, x = v[3], z = v[5];
    v[0] += r / D2R; v[3] = x * Math.cos(r) + z * Math.sin(r); v[5] = -x * Math.sin(r) + z * Math.cos(r);
    orbit.cur = best === 'fish' ? followView(v, 0, true).slice(0, 6) : v; orbit.to = null;
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
        for (const n in tg) if (n in S && !n.endsWith('_a') && n !== 'globe_day') d += (tg[n] - S[n]) ** 2;
        if (d < bd) { bd = d; bo = v; }
      }
      X.ctl[best][ct.key] = bo;
    }
    // the story's school carries over as it is (its neighbours, its size), and the story's outbreak (on, at its day)
    setFishK(Math.round(S.fish_k), false); X.n = clamp(Math.round(S.fish_n / 50) * 50, 100, 600);
    if (best === 'fish') X.ctl.fish.view = 'default';
    if (best === 'globe' && S.globe_out > 0.5) { X.ctl.globe.out = 'on'; X.out.day = Math.min(S.globe_day, 1e9); X.out.playing = false; }
    X.tab = best === 'globe' ? 'outbreak' : best;
    outApply();
    // from the last chapter (the story's end, or its Explore button): the cell, in the Cell tab, CFTR picked
    if (ts >= C.med.a) openStart();
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    exploreHTML(); pushState();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    // the story shows its own outbreak and picks none (explore's come back with explore)
    NEXT.length = 0; pushState();
    if (GL.sets) { outSetup(STORY_OUT); api('globe').select(-1); api('cell').select(-1); api('cell').isolate(null); GL.sets.fish.steer(null); }
    $('#tip').style.opacity = 0;
    this.t = t || 0; this.playing = true; curCh = null;
  },
};

// explore mode's start from the story's end: the cell, in the Cell tab, with CFTR (the story's wrong place) picked
function openStart() {
  openScene('cell', false);
  X.ctl.cell = Object.assign(X.ctl.cell || {}, { view: 'default', move: 'cf' });
  X.tab = 'cell';
  selectProtein('CFTR', undefined, false);
  orbit.cur = view('cell', viewCam('cell') || 'default'); orbit.to = null;
}

// the language: every word of the story, its labels and panes, at once (the sets' too); kept on this device
function setLang(l, keep = true) {
  if (!LANGS.includes(l)) return;
  LANG = l;
  if (keep) { try { localStorage.setItem('passLang', l); } catch (e) { /* private mode */ } }
  for (const k of SET_ORDER) if (GL.sets[k].setLang) GL.sets[k].setLang(l);
  // (an arrangement is laid again over the other language's panel and labels: they are made again from the chapters'
  // own times, and its words for the language it was not made in are dropped, as their was no longer matches; the
  // snapshot of the story's own words is taken again whenever there is one, the editor's model, even with none applied)
  const A = ARR.A, o = ARR.o;
  if (o && A) CH.forEach((c, i) => { c.a = o.ch[i][0]; c.b = o.ch[i][1]; });
  buildStoryDOM(); relabel(); trackHTML();
  if (o) { arrSnapItems(o); o.labels.forEach((L, i) => { L.T = Object.assign(arrText(ST.labels[i].el), { L: ST.labels[i] }); }); ARR.tx = []; if (A) arrApply(A); }
  for (const L of LBL.sets) { L.tx = ''; labelText(L); }
  if (XR.tip) { dropSprite(XR.tip); XR.tip = null; XR.tipI = -1; }
  exploreHTML();
  if (APP.mode === 'story') updateStoryDOM(storyT(APP.t));
  audioLang();   // (the narration in this language)
}

//#use lastNow EXV
let tsPrev = null;   // (frame: the story time a frame ago, so a jump past the shark sends none)
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
  // (among the fish, on a screen, the camera turns to keep the school in view, unless you look around yourself)
  const fol = (Sx, v) => ((Sx.fish_a || 0) >= 0.5 && following() ? followView(v, dt) : v);
  if (APP.mode === 'story') {
    S = storyState(ts); tSet = ts;
    // a jump well past the story's shark sends none (played through, or jumped to within 8 s of it, it comes): the school
    // as the chapter shows it
    if ((tsPrev === null || Math.abs(ts - tsPrev) > 1.5) && Math.floor(evalTrack('fish_hunt', ts - 8) + 1e-6) >= Math.floor(S.fish_hunt + 1e-6)) GL.sets.fish.hunted(S.fish_hunt);
    tsPrev = ts;
    const v = storyCam(ts);
    GL.nf = v[6];
    if (xr) xrPlace(v); else { applyCamera(fol(S, v)); keepCamera(S, ts); }
    updateStoryDOM(ts);
    updateTimeline(APP.t, APP.playing);
  } else {
    tsPrev = null;
    const pn = performance.now();
    S = exploreStep(dt, pn); tSet = pn / 1000;
    // (a wide view stands further back on a phone held upright, and its target's shift clear of the side panel, FIT,
    // goes back where there is none: both eased as the views change)
    const vn = viewCam(X.scene) || 'default', fs = fitShift(X.scene, vn), ke = 1 - Math.exp(-dt * 3);
    GL.nf += (narrowOf(X.scene, vn) - GL.nf) * ke;
    for (let i = 0; i < 3; i++) EXV[7 + i] += (fs[i] - EXV[7 + i]) * ke;
    orbitStep(xr ? pn : now);
    for (let i = 0; i < 6; i++) EXV[i] = orbit.cur[i];
    if (xr) xrPlace(orbit.cur); else { applyCamera(fol(S, EXV)); keepCamera(S, null); }
  }
  // the fish: life size round you in a headset (their holder), the sea hidden in passthrough (the school swims in your
  // room) and never shrunk there (in a headset the rise to the globe only fades: the viewer never moves)
  GL.lifeOn = (S.fish_a || 0) >= 0.5;
  placeLife(xr, dt);
  if (XR.on && (!XR.clear || xr)) S = Object.assign({}, S, XR.clear ? { fish_scale: 1 } : { fish_water: 0, fish_scale: 1 });
  if (!xr) setLens(S.lens);
  K.U.uTime.value = tSet;
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  GL.sets.fish.hold(sharking());   // (be the shark: a shark let go stays while it is on)
  tellFish(xr, fishSync());
  updateSets(S, tSet, dt, APP.mode === 'story');
  arrPlace();   // (an arrangement's places, on top of what the story does with its sets)
  fishSend();   // (shared rooms: after the school's step, so what goes out is where it is drawn now)
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
  // the language switch, on the story panel and above the explore tabs
  $('#panel').addEventListener('click', ev => { const b = ev.target.closest('button[data-lang]'); if (b && LANGS.includes(b.dataset.lang)) setLang(b.dataset.lang); });
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
    // #pass&explore&tab=fish|outbreak|cell|scenes; &scene=fish|globe|cell and any of its controls by key (&view=afar);
    // the fish: &k=1..12, &n=100..600, &links=on, &shark (be the shark), &hunt (send one); the outbreak: &start=LHR,
    // &inc=3, &inf=10, &spread=high, &cut=50, &day=20, &play, &city=SYD, &click=look; the cell: &protein=CFTR,
    // &move=nfkb; &lang=de (see the language); &now (no glide)
    const sc = hp.get('scene'), tab = hp.get('tab');
    if (sc && GL.sets[sc]) { openScene(sc, false); showTab('scenes'); }
    else if (TABS.some(t => t[0] === tab)) { showTab(tab); if (TAB_SCENE[tab]) openScene(TAB_SCENE[tab], false); }
    else if (!hp.has('t')) openStart();   // straight in: the cell, as at the story's end
    if (tab && TABS.some(t => t[0] === tab)) showTab(tab);
    orbit.cur = view(X.scene, viewCam(X.scene) || 'default'); orbit.to = null;
    // controls after the default view, so a control's own view wins
    for (const c of ctlsOf(X.scene)) {
      const q = String(hp.get(c.key) || '').toLowerCase(), o = q && c.options.find(([v, n]) => v.toLowerCase() === q || String(n).toLowerCase() === q);
      if (o) setCtl(X.scene, c.key, o[0], false);
    }
    if (hp.get('k')) setFishK(hp.get('k'), false);
    if (hp.get('n')) setFishN(hp.get('n'), false);
    if (hp.has('shark')) setShark(true);
    if (hp.has('hunt')) sendShark(null);
    for (const k of ['inc', 'inf', 'cut', 'spread']) if (hp.get(k)) setOut(k, hp.get(k), false);
    if (hp.get('start')) setStart(String(hp.get('start')).toUpperCase(), false);
    if (hp.get('city')) selectCity(String(hp.get('city')).toUpperCase(), false);
    if (hp.get('click') === 'look' || hp.get('click') === 'start') X.out.click = hp.get('click');
    if (hp.has('start') || hp.has('day') || hp.has('play') || tab === 'outbreak') { showOutbreak(); if (!tab) showTab('outbreak'); }
    if (hp.get('day')) setDay(hp.get('day'));
    if (hp.has('play')) playOut(true);
    if (hp.get('protein')) { selectProtein(hp.get('protein'), undefined, false); if (!sc && !tab) showTab('cell'); }
    if (hp.get('move')) setMove(hp.get('move'), false);
    if (hp.has('now')) { Object.assign(XS, exploreTargets()); for (const n of MOVE_P) XS[n] = exploreTargets()[n]; orbit.cur = orbit.to || orbit.cur; orbit.to = null; }
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
  // shared rooms (shared.js): the clock is APP's, the shared state the explore panes; the school's swim and the
  // sharks are effects (fishSync)
  collab: {
    APP, scene: () => (LOAD.done ? GL.scene : null), state: collabState, apply: v => { SFXQ.quiet++; try { return collabApply(v); } finally { SFXQ.quiet--; } }, view: collabView, setView: collabSetView,
    effect: fishEffect,
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
    // (the shell's panel speaks the next story's language)
    for (const el of [$('#story'), $('#explore')]) if (el) el.removeAttribute('lang');
    if (GL.scene) GL.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose(); m.dispose(); });
    });
  },
};
});
