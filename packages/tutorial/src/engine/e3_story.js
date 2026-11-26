//#use head
// ================================================================== STORY ==
// Narration timing: [time in the recording, original story cue]. The story's animation is stretched or squeezed between
// these points so each cue lands on the matching sentence. Written with NARRATION_ENDS by node tools/voice/narrate.mjs
// tutorial from the guide's synthetic voice it records (Kokoro's af_heart); run it again after the words change.
const NARRATION_SYNC = [
  [0, 0],                                             // Hello
  [27.5, 25], [28.82, 26.2], [30.25, 26.4], [43.45, 38.4], [46.72, 41.2], [48.14, 42.2],  // Pointing
  [54.52, 48], [55.84, 49.2], [57.57, 49.4],          // Playing a story
  [83.53, 73], [84.85, 74.2], [86.43, 74.4],          // Exploring
  [112.39, 98], [113.71, 99.2], [115.16, 99.4],       // The menu
  [142.22, 124], [143.54, 125.2], [145.14, 125.4],    // Recenter
  [161.2, 140], [162.52, 141.2], [163.93, 141.4], [187.91, 163.2], [190.48, 165.3],  // Together
  [191.25, 166], [192.57, 167.2], [194.09, 167.4], [215.65, 187],  // Your turn
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { hello: 26, point: 52.05, play: 76.75, explore: 109.95, menu: 139.3, recenter: 159.85, together: 190.25, end: 208.25 };
//#use storyT narrT T_END
// the chapters (story seconds), from the guide's script (sets/script.js), which keys its moves in them
const CH = GUIDE.CH.map(c => Object.assign({}, c));
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
// the engine's own params beside the sets' (DEF): none here; the guide's clock runs at an even pace (evalTrack)
const DEF_MORE = {}, LIN = new Set(['guide_clock']), LOG = new Set();
// no view moved or set back for the side panel (view, FIT)
const FIT = {};
//#use C DEF buildDefaults TR key ramp evalTrack storyState fadeVal ST view anchorOf
function buildStory() {
  const F = GL.sets.guide;
  F.chapters(CH);
  // ------------------------------------------------------------ panel copy (the words the guide says; .credits and
  // data-say=" " are shown, not spoken; data-xr is a line's wording in a headset)
  const html = {
    hello: `<h1 data-at="1.2">Meet your guide</h1>
      <p class="lede" data-at="2.2">a robot that shows you round</p>
      <p data-at="8">Calibrating.</p>
      <p data-at="11">Done.</p>
      <p data-at="12.4">Hello. I am your guide, and I am a robot. In a few minutes, I will show you how this app works in a headset.</p>
      <p data-at="20.4">Give me a little room: I keep about two metres in front of you.</p>
      <p class="note" data-at="20.4" data-say=" " data-xr="Look at me, or at this panel: both show the way.">On a screen you watch through a window. This tutorial is made for a headset: put one on, and the guide stands in your room.</p>`,
    point: `<h2 data-at="0.6">Pointing</h2>
      <p data-at="1.4">Each hand sends out a ray, like this one.</p>
      <p data-at="5.6">Point it at a button and pull the trigger, under your index finger. With bare hands, pinch your thumb and finger instead.</p>
      <p data-at="13.4">Missed by four centimetres. Correcting.</p>
      <p data-at="16.2">There.</p>
      <p data-at="17.2">Now point at the target yourself. My visor follows your ray.</p>`,
    play: `<h2 data-at="0.6">Playing a story</h2>
      <p data-at="1.4">A story plays like a film, in chapters. Here are five of them, from my back.</p>
      <p data-at="7">Under the panel is a bar. The round button plays and pauses. The arrows jump a chapter.</p>
      <p data-at="13.4">Try it now: press Pause. I stop mid-step, and my scan stops too. Press Play, and I go on.</p>`,
    explore: `<h2 data-at="0.6">Exploring</h2>
      <p data-at="1.4">After each story comes explore mode, where you try things for yourself.</p>
      <p data-at="7">This is the badge from my chest: a hub, three nodes and six links. A small network.</p>
      <p data-at="13">Point at the hub, in the middle. It has the most links.</p>
      <p data-at="17.2">Pull the trigger on any node, and a signal spreads from it, one link at a time. You can try it soon.</p>`,
    menu: `<h2 data-at="0.6">The menu</h2>
      <p data-at="1.4">To open the menu, click a thumbstick: press it in. With bare hands, pinch twice with your left hand.</p>
      <p data-at="8.2">Its Settings tab has Narration, Subtitles, Sound and Labels.</p>
      <p data-at="12.6">Watch: I hide my own labels. And back again.</p>
      <p data-at="16.4">In VR, Moving with the sticks, also in Settings, moves you through a scene: the left stick moves you, the right one turns you.</p>`,
    recenter: `<h2 data-at="0.6">Recenter</h2>
      <p data-at="1.4">If you turn away and lose the panel, press Recenter. Everything comes back in front of you.</p>
      <p data-at="10.2">Facing you. Squared up. Recenter is on the panel, and in the menu's settings too.</p>`,
    together: `<h2 data-at="0.6">Together</h2>
      <p data-at="1.4">People can share one room, each in their own headset. Start one, or join with a three-letter code, in the menu's Circles tab.</p>
      <p data-at="10.8">Copy created. In a room, other people appear as bodies like this one, with their name above.</p>
      <p data-at="17.2">Each story stands in its own circle, and everyone in it sees the same moment.</p>
      <p data-at="23.2">Copy removed. It did not mind.</p>`,
    end: `<h2 data-at="0.6">Your turn</h2>
      <p data-at="1.4">That is all. To pick a story, press Stories on the panel. The airports are a good first one.</p>
      <p data-at="8.6">Or stay, and practise: I have a few small tasks for you.</p>
      <p data-at="13">Powering down.</p>
      <p class="credits" data-at="15">Your guide's moves and words were written by Claude, an AI model made by Anthropic. Its body is the app's armour figure, posed by code. Narration: a synthetic voice (Kokoro).</p>`,
  };
  const story = $('#story');
  story.innerHTML = CH.map(c => `<section class="ch" data-ch="${c.key}">${html[c.key]}</section>`).join('');
  CH.forEach(c => {
    const sec = story.querySelector(`[data-ch="${c.key}"]`);
    ST.items.push({ sec, ch: c, els: Array.from(sec.querySelectorAll('[data-at]')).map(el => ({
      el, at: c.a + parseFloat(el.dataset.at), out: el.dataset.out ? c.a + parseFloat(el.dataset.out) : c === CH[CH.length - 1] ? Infinity : c.b - 0.05, o: -1 })),
      grow: [] });
  });
  // ------------------------------------------------------------ keyframes and camera
  const wp = [];
  const cam = (t, k, name, ease) => wp.push([t, ...view(k, name), ease, k]);
  ramp('guide_a', 0, 0.3, 0, 1);
  ramp('guide_clock', 0, T_END_STORY, 0, T_END_STORY);   // (the guide's whole script runs on this clock: LIN)
  key('guide_mode', 0, 0);
  // sound effects (sfxCue: story time, a sound, where it comes from, its options), from the guide's anchors; seq marks a
  // run of steps or places that belongs together
  const q = (ch, t, name, at, o) => sfxCue(C[ch].a + t, name, 'guide', at, o);
  q('hello', 2.9, 'ratchet', 'boots', { n: 7, rise: true, dur: 1.5 });
  q('hello', 5.8, 'rise', 'head', { gain: 0.4 });
  q('hello', 8.0, 'step', 'head', { pitch: 0.8 });
  q('hello', 9.0, 'ratchet', 'head', { n: 4, gain: 0.3 });
  q('hello', 10.7, 'ping', 'head');
  q('hello', 12.5, 'pick', 'fist');
  q('point', 1.0, 'whoosh', 'fist', { dur: 0.5, pitch: 1.3 });
  q('point', 5.1, 'pick', 'target', { gain: 0.35 });
  q('point', 13.2, 'step', 'head', { pitch: 2.0 });
  q('point', 16.0, 'ping', 'target');
  q('play', 0.8, 'ratchet', 'head', { n: 4 });
  [3.6, 3.9, 4.2, 4.5, 4.8].forEach((t, i) => q('play', t, 'place', 'marker' + i, { gain: 0.4, seq: true }));
  [14.1, 16.5, 18.9, 21.3].forEach((t, i) => q('play', t, 'step', 'marker' + (i + 1), { pitch: [1.0, 1.12, 1.26, 1.41][i], seq: true }));
  q('explore', 3.6, 'click', 'chest');
  q('explore', 4.0, 'whoosh', 'chest', { pitch: 1.2 });
  q('explore', 5.6, 'grow', 'net', { dur: 3, gain: 0.4 });
  [6.0, 7.0, 8.0].forEach(t => q('explore', t, 'link', 'net', { gain: 0.35, seq: true }));
  q('explore', 8.8, 'ping', 'net');
  q('explore', 9.4, 'grow', 'net', { dur: 2.5, gain: 0.3 });
  q('explore', 15.0, 'pulse', 'node0');
  q('explore', 19.8, 'pulse', 'node4', { gain: 0.35 });
  q('menu', 2.6, 'click', 'fist');
  q('menu', 2.8, 'open', 'menu', { gain: 0.4 });
  q('menu', 12.0, 'close', 'menu', { gain: 0.35 });
  q('menu', 12.8, 'toggleOff', 'fist');
  q('menu', 14.8, 'toggleOn', 'fist');
  q('menu', 18.4, 'whoosh', 'boots', { dur: 0.8 });
  q('menu', 20.5, 'ratchet', 'head', { n: 2, gain: 0.35 });
  q('menu', 21.3, 'ratchet', 'head', { n: 2, gain: 0.35 });
  q('menu', 22.2, 'whoosh', 'boots', { pitch: 0.8 });
  q('recenter', 7.0, 'ratchet', 'head', { n: 3 });
  q('recenter', 9.7, 'ping', 'head');
  q('together', 10.2, 'join', 'copy');
  q('together', 19.3, 'pick', 'head', { gain: 0.35 });
  q('together', 21.6, 'leave', 'copy');
  q('end', 2.6, 'notice', 'fist', { gain: 0.35 });
  q('end', 14.4, 'close', 'head', { gain: 0.4 });
  q('end', 18.2, 'toggleOff', 'head');
  // a page's camera: where you stand; from the right at the markers; at the network; wide for both robots; back
  cam(0, 'guide', 'default');
  cam(C.play.a + 2, 'guide', 'default');
  cam(C.play.a + 6, 'guide', 'side');
  cam(C.play.b - 1, 'guide', 'side');
  cam(C.explore.a + 4, 'guide', 'net');
  cam(C.explore.b - 1, 'guide', 'net');
  cam(C.menu.a + 3, 'guide', 'default');
  cam(C.together.a + 8, 'guide', 'default');
  cam(C.together.a + 11, 'guide', 'wide');
  cam(C.together.b - 1, 'guide', 'wide');
  cam(C.end.a + 2, 'guide', 'default');
  cam(C.end.b, 'guide', 'default');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);
}
// the story's own length in story seconds (T_END is the recording's)
const T_END_STORY = GUIDE.T_END;
//#use buildCamera~3 setYaw smoothSeg spinEase storyCam~2 LBL labelEl label sfxSpan buildSetLabels setLabelAlpha~2 labelText _v labelPos
//#use _placed placeLabels~2 curCh updateStoryDOM~2 trackHTML buildTimeline ICON_PLAY ICON_PAUSE lastTick updateTimeline
// ------------------------------------------------------------- the narration hold --
// In a headset narration is off until turned on: once a session, at 7.8 s, the story waits for the voice (the guide
// points at the panel's Sound button, Narration off, and a sign says so) when there is a recording, narration is off
// and this device's sound is on, in a real session, outside a shared room, the switch tutorialHold is not 'off' (every
// test page sets it), and the story played into 7.8 s (never after a seek past it). Turning narration on, or Play,
// goes on.
const HOLD = { done: false, on: false, at: 7.8 };
function holdCan() {
  let sw = '';
  try { sw = localStorage.getItem('tutorialHold') || ''; } catch (e) { /* storage blocked */ }
  return !!(AUD && AUD.state !== 'none' && HOST.xr && HOST.xr.voice && !HOST.xr.voice() && !(HOST.audio && HOST.audio.muted)
    && HOST.session && !(HOST.room && HOST.room.inRoom && HOST.room.inRoom()) && sw !== 'off');
}
// every frame of the story: the clock crossed 7.8 s while playing (t0 before the frame, t after)
function holdStep(t0, t) {
  if (APP.mode !== 'story') { HOLD.on = false; return; }
  if (HOLD.on && (APP.playing || (HOST.xr && HOST.xr.voice && HOST.xr.voice()))) { HOLD.on = false; HOLD.done = true; if (!APP.playing) APP.playing = true; return; }
  const at = narrT(HOLD.at);
  if (!HOLD.done && APP.playing && t0 < at && t >= at && t - t0 < 0.5 && holdCan()) { HOLD.on = true; HOLD.done = true; APP.t = at; APP.playing = false; }
}
