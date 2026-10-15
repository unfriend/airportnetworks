// ------------------------------------------------------------- narration --
// Optional voice-over: put an MP3 at audio/narration-lbi.mp3 (next to this page).
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently, exactly as before.
// Narration through Web Audio. The file is loaded and decoded once; the audio
// engine is unlocked by the first tap or click (e.g. Enter VR) and from then on
// can start, stop and jump at any moment, also inside a headset where
// controller clicks may not count as taps for the browser.
const AUD = { ctx: null, gain: null, buf: null, src: null, startAt: 0, offset: 0, ok: false, muted: false,
  state: 'loading', needSeek: true, audible: false, duration: 0 };
function audioInit() {
  try { AUD.muted = localStorage.getItem('narrationMuted') === '1'; } catch (e) { /* storage blocked */ }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { AUD.state = 'none'; audioButton(); return; }
  AUD.ctx = new AC();
  AUD.gain = AUD.ctx.createGain();
  AUD.gain.connect(AUD.ctx.destination);
  AUD.ctx.addEventListener('statechange', () => { audioSync(); audioButton(); });
  fetch('audio/narration-lbi.mp3').then(r => {
    if (!r.ok) throw new Error('missing');
    return r.arrayBuffer();
  }).then(data => new Promise((res, rej) => AUD.ctx.decodeAudioData(data, res, rej))).then(buf => {
    AUD.buf = buf; AUD.duration = buf.duration; AUD.ok = true; AUD.state = 'ok';
    if (AUD.duration + 1 > T_END) {
      T_END = AUD.duration + 1;
      document.querySelectorAll('#track .tick, #track .name').forEach(el => {
        const c = C[el.dataset.k]; if (c) el.style.left = (100 * c.na / T_END).toFixed(2) + '%';
      });
      $('#track').setAttribute('aria-valuemax', Math.round(T_END)); lastTick = -1;
    }
    audioSync(); audioButton();
  }).catch(err => {
    AUD.state = err && err.message === 'missing' ? 'none' : 'error';
    if (AUD.state === 'error') { console.warn('Narration could not be decoded:', err); xrMsg('The narration file could not be played. Export it as a standard MP3 and upload it again.'); }
    audioButton();
  });
  ['pointerdown', 'keydown', 'touchend', 'click'].forEach(t => document.addEventListener(t, audioGesture, true));
  $('#btnSound').addEventListener('click', () => audioToggle());
  // react at once to play/pause, seeks, chapter jumps and mode changes
  for (const name of ['seek', 'togglePlay', 'enterExplore', 'enterStory']) {
    const f = APP[name];
    APP[name] = function (...args) { const r = f.apply(APP, args); AUD.needSeek = true; audioSync(); return r; };
  }
}
// called from every user gesture (page clicks and taps, and controller clicks in VR)
function audioGesture() {
  const ctx = AUD.ctx;
  if (!ctx) return;
  if (ctx.state !== 'running' && ctx.state !== 'closed') {
    const r = ctx.resume();
    if (r && r.then) r.then(() => { audioSync(); audioButton(); }, () => {});
  }
  audioSync(); audioButton();
}
function audioPos() { return AUD.src ? AUD.offset + (AUD.ctx.currentTime - AUD.startAt) : AUD.offset; }
function audioStart(at) {
  audioStop();
  const src = AUD.ctx.createBufferSource();
  src.buffer = AUD.buf; src.connect(AUD.gain);
  src.start(0, Math.max(0, at));
  AUD.src = src; AUD.offset = at; AUD.startAt = AUD.ctx.currentTime; AUD.audible = true;
}
function audioStop() {
  if (AUD.src) { try { AUD.src.stop(); } catch (e) { /* already stopped */ } AUD.src.disconnect(); AUD.src = null; }
  AUD.audible = false;
}
function audioWanted() {
  return AUD.ok && !AUD.muted && APP.mode === 'story' && APP.playing &&
    !(document.hidden && !XR.on) && !(XR.on && XR.session && XR.session.visibilityState === 'hidden') &&
    APP.t < AUD.duration - 0.05;
}
// start, stop or re-seek the narration to match the story
function audioSync() {
  const ctx = AUD.ctx;
  if (!ctx || !AUD.ok) return;
  const want = audioWanted() && ctx.state === 'running';
  if (!want) { if (AUD.src) audioStop(); return; }
  if (!AUD.src || (AUD.needSeek && Math.abs(audioPos() - APP.t) > 0.15)) audioStart(APP.t);
  AUD.needSeek = false;
}
// while it plays, the narration is the clock: gently pull the story toward it
function audioFollow() {
  if (!AUD.src || !AUD.audible || AUD.ctx.state !== 'running') return;
  const d = audioPos() - APP.t;
  APP.t = Math.abs(d) < 0.6 ? APP.t + d * 0.2 : audioPos();
}
function audioToggle() {
  AUD.muted = !AUD.muted;
  try { localStorage.setItem('narrationMuted', AUD.muted ? '1' : '0'); } catch (e) { /* storage blocked */ }
  audioGesture();
}
function audioLabel() {
  if (AUD.state === 'loading') return 'Sound loading';
  if (AUD.state === 'error') return 'Sound unavailable';
  if (AUD.muted) return 'Sound off';
  return AUD.ctx && AUD.ctx.state === 'running' ? 'Sound on' : 'Play sound';
}
function audioButton() {
  const b = $('#btnSound');
  b.hidden = AUD.state === 'none';
  b.textContent = audioLabel();
  b.setAttribute('aria-pressed', AUD.ok && !AUD.muted ? 'true' : 'false');
  b.title = AUD.muted ? 'Turn the narration on' : 'Turn the narration off';
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && AUD.ctx && AUD.ctx.state !== 'running') AUD.ctx.resume().catch(() => {}); audioSync(); });

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
    let best = 'int', ba = 0;
    for (const k of SET_ORDER) if (S[k + '_a'] > ba + 0.01) { ba = S[k + '_a']; best = k; }
    // the story's view, taken back into the set's own frame (explore shows sets unturned)
    const v = storyCam(ts).slice(), r = -setYaw(best, ts) * D2R, x = v[3], z = v[5];
    v[0] += r / D2R; v[3] = x * Math.cos(r) + z * Math.sin(r); v[5] = -x * Math.sin(r) + z * Math.cos(r);
    orbit.cur = v; orbit.to = null;
    X.scene = best; X.t0 = performance.now();
    // and pick the scene's controls that come closest to what the story was showing
    const s = GL.sets[best];
    X.ctl[best] = {};
    for (const ct of s.controls || []) {
      let bo = ct.options[0][0], bd = Infinity;
      for (const [v] of ct.options) {
        const c = { t: 1e3 };
        for (const c2 of s.controls) c[c2.key] = c2 === ct ? v : ctlValue(best, c2);
        const tg = s.explore ? s.explore(c) : {};
        let d = 0;
        for (const n in tg) if (n in S && !n.endsWith('_a')) d += (tg[n] - S[n]) ** 2;
        if (d < bd) { bd = d; bo = v; }
      }
      X.ctl[best][ct.key] = bo;
    }
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    renderScenes();
    updateExtraLabels();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    if (X.sel >= 0) selectProtein(-1, false);
    clearRoute();
    LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); }); LBL.extra = [];
    $('#tip').style.opacity = 0;
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
  if (APP.mode === 'story' && APP.playing) {
    APP.t += dt;
    audioFollow();
    if (APP.t >= T_END) { APP.t = T_END; APP.enterExplore(); }
  }
  audioSync();
  const ts = storyT(APP.t); // original story time for this point in the narration
  if (APP.mode === 'story') {
    S = storyState(ts); tSet = ts;
    if (xr) xrPlace(storyCam(ts)); else applyCamera(storyCam(ts));
    updateStoryDOM(ts);
    updateTimeline(APP.t, APP.playing);
  } else {
    const pn = performance.now();
    S = exploreStep(dt, pn); tSet = pn / 1000;
    orbitStep(xr ? pn : now);
    if (xr) xrPlace(orbit.cur); else applyCamera(orbit.cur);
  }
  K.U.uTime.value = tSet;
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  updateSets(S, tSet, dt, APP.mode === 'story');
  if (xr) xrUpdate(S);
  GL.renderer.render(GL.scene, GL.camera);
  if (!xr) {
    GL.world.updateMatrixWorld(true);
    if (APP.mode === 'story') placeLabels(LBL.storyAll, L => (L.kind === 'story' ? fadeVal(ts, L.tIn, L.tOut, 0.5) * (S[L.set + '_a'] > 0.5 ? 1 : 0) : setLabelAlpha(L, S)));
    else placeLabels(LBL.exploreAll(), L => (L.kind === 'set' ? setLabelAlpha(L, S) : 1));
  }
  window.__frames = (window.__frames || 0) + 1;
}
function applyTheme() {
  if (!GL.renderer) return;
  if (XR.on && !XR.clear) GL.renderer.setClearColor(0x000000, 0); // passthrough AR shows the room
  else GL.renderer.setClearColor(new THREE.Color(css('--scene') || '#040912'), 1);
}
function init() {
  try {
    buildScene($('#gl'));
  } catch (err) {
    console.error(err);
    $('#nogl').style.display = 'grid';
    $('#loading').classList.add('gone');
    return;
  }
  resize();
  window.addEventListener('resize', resize);
  buildDefaults(); Object.assign(XS, DEF);
  // compile every set's shaders now, so a scene's first appearance does not stall the story
  try {
    for (const k of SET_ORDER) GL.sets[k].group.visible = true;
    GL.renderer.compile(GL.scene, GL.camera);
  } catch (e) { /* compiled on first use instead */ }
  for (const k of SET_ORDER) GL.sets[k].setAlpha(0);
  buildStory(); buildSetLabels(); buildTimeline(); buildExplore(); bindCanvas(); xrSetup(); audioInit();
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
    if (ev.key === '/' && APP.mode === 'explore') { showTab('protein'); $('#q').focus(); ev.preventDefault(); }
  });
  APP.playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the start screen pauses the story; picking this story again starts it from the top
  if (HOST.picking) APP.playing = false;
  window.addEventListener('storypause', () => { APP.playing = false; });
  window.addEventListener('storyrestart', () => { APP.enterStory(0); APP.playing = true; audioGesture(); });
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.has('t')) { APP.t = clamp(parseFloat(hp.get('t')) || 0, 0, T_END - 0.01); APP.playing = false; }
  if (hp.has('explore')) {
    APP.enterExplore();
    // #lbi&explore&scene=atp&view=complex (any control of the scene by its key), or &q=TP53, &route=TP53,BRCA1
    if (hp.get('scene')) openScene(hp.get('scene'), false);
    orbit.cur = view(X.scene, 'default'); orbit.to = null;
    // controls after the default view, so a control's own view wins
    const s = GL.sets[X.scene];
    for (const c of s.controls || []) if (hp.get(c.key)) setCtl(X.scene, c.key, hp.get(c.key));
    if (hp.get('tab')) showTab(hp.get('tab'));
    if (hp.get('q')) { $('#q').value = hp.get('q'); runQuery(hp.get('q')); }
    if (hp.get('route')) {
      const [a = '', b = ''] = hp.get('route').split(',').map(x => x.trim()), s = findProtein(a), t = findProtein(b);
      showTab('protein');
      $('#pf').value = s >= 0 ? INT().core[s].sym : a; $('#pt').value = t >= 0 ? INT().core[t].sym : b;
      runRoute(s, t);
    }
    if (hp.has('now')) { Object.assign(XS, exploreTargets()); orbit.cur = orbit.to || orbit.cur; orbit.to = null; }
  }
  GL.renderer.setAnimationLoop(frame); // also drives the headset's frame loop
  if (HOST.session && GL.renderer.xr.isPresenting) xrAdopt();
  setTimeout(() => $('#loading').classList.add('gone'), 120);
}
setTimeout(init, 40);

// what the app shell needs to change story
return {
  inputs: () => XR.ctrls.map(c => c.src),
  xrPose: () => (XR.on ? { rp: GL.rig.position.clone(), rq: GL.rig.quaternion.clone(), off: XR.globeOff.clone(),
    pp: XR.panelGroup.position.clone(), pr: XR.panelGroup.rotation.y } : null),
  // for tests and the browser console: HOST.cur.peek('NET.N')
  peek: src => eval(src),
  dispose() {
    try { audioStop(); if (AUD.ctx) AUD.ctx.close(); } catch (e) { /* already closed */ }
    if (GL.mo) GL.mo.disconnect();
    if (XR.session) XR.session.removeEventListener('visibilitychange', xrVisibility);
    if (GL.scene) GL.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose(); m.dispose(); });
    });
  },
};
});
