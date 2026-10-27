// ------------------------------------------------------------- narration --
// Optional voice-over: put an MP3 at audio/narration-lbi.mp3.
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently. The sound engine is the shell's
// (HOST.audio): one engine for the whole app, unlocked by the first tap or click
// and kept running across stories and headset sessions.
let AUD = null;
function audioInit() {
  AUD = HOST.audio.narration('audio/narration-lbi.mp3', {
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
// the narration plays while the story plays (at a slideshow stop, a voice may finish its chapter: slideSound)
function audioSync() { if (AUD) AUD.sync(...slideSound()); }
// while it plays, the narration is the clock: the story follows it
function audioFollow() { if (AUD && !SLIDE.tail) APP.t = AUD.follow(APP.t); }
function audioLabel() { return AUD ? AUD.label() : ''; }
function audioToggle() { HOST.audio.toggle(); }

// ------------------------------------------------------------- slideshow --
// Slideshow (HOST.slides: on for this story, or for all): the story waits at the end of each chapter, all its text
// shown, until Next (or Play) goes on. The stop is a pause and a seek, Next a play, so in a shared room they reach
// the station's clock like a pause and a play by hand, at the same t on every device.
const SLIDE = { at: -1, go: -1, last: 0, lt: 0, lp: false, tail: null };
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
  const t0 = APP.t;
  if (APP.mode === 'story' && APP.playing) {
    APP.t += dt;
    audioFollow();
  }
  slideStep(t0);   // slideshow: the story waits at the end of each chapter
  // the end: Repeat (shell) starts this story or the next one again, else explore mode opens
  if (APP.mode === 'story' && APP.playing && APP.t >= T_END) { APP.t = T_END; if (HOST.ended()) APP.playing = false; else APP.enterExplore(); }
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
  buildStory(); buildSetLabels(); buildTimeline(); buildExplore(); bindCanvas(); audioInit(); xrSetup();
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
  window.addEventListener('storyrestart', () => { APP.enterStory(0); APP.playing = true; });
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
const initT = setTimeout(init, 40);

// what the app shell needs to change story
return {
  inputs: () => XR.ctrls.map(c => c.src),
  xrPose: () => (XR.on ? { rp: GL.rig.position.clone(), rq: GL.rig.quaternion.clone(), off: XR.globeOff.clone(), s: XR.size, held: XR.ctrls.map(c => (c.grab ? c.grab.target : '')).join(' '),
    pp: XR.panelGroup.position.clone(), pr: yawOf(XR.panelGroup.quaternion, XR.panelGroup.rotation.y), rot: XR.rot.clone(), pq: XR.panelGroup.quaternion.clone() } : null),
  // shared rooms (shared.js): the clock is APP's, the shared state the scene, its controls and the proteins (no one-shot effects)
  collab: {
    APP, scene: () => GL.scene, state: collabState, apply: collabApply, view: collabView, setView: collabSetView,
    hover: i => { const c = XR.ctrls[i]; return c && c.hover ? c.ray.scale.z : 0; },
    panel(p, yaw, q) { xrPanelPose(p, yaw, q); },
    place(o, s, q) { XR.globeOff.fromArray(o); XR.size = s; xrSceneRot(q); },
  },
  // for tests and the browser console: HOST.cur.peek('NET.N')
  peek: src => eval(src),
  dispose() {
    // timers left running must not write into the next story's panes (they share ids) or build this one after all
    clearTimeout(initT); clearTimeout(xrMsg.t);
    if (GL.mo) GL.mo.disconnect();
    if (XR.session) XR.session.removeEventListener('visibilitychange', xrVisibility);
    if (GL.scene) GL.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose(); m.dispose(); });
    });
  },
};
});
