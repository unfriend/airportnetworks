//#use head
// ================================================================== STORY ==
// Narration timing: [time in the recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands on
// the matching sentence. The story is narrated by a synthetic voice
// (audio/narration-flock.mp3, Kokoro's af_heart): node tools/voice/narrate.mjs
// flock writes this table and NARRATION_ENDS from the recording it makes (each
// stretch lasts the longer of 1.1 times its story time and its line's audio
// plus a pause); run it again after the text changes (see
// tools/voice/README.md).
const NARRATION_SYNC = [
  [0, 0], [4.4, 4], [14.35, 10],                      // Intro
  [23.15, 18], [24.45, 19.18], [26.16, 19.2], [35.23, 25], [44.38, 32],  // Seven
  [53.18, 40], [54.47, 41.18], [55.95, 41.2], [66.13, 49], [72.07, 54],  // Wave
  [80.87, 62], [82.17, 63.18], [83.86, 63.2], [87.01, 65], [95.7, 71.3], [96.47, 72],  // Around you
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { title: 19.15, seven: 48.35, wave: 78.15, around: 95.5 };
//#use storyT narrT T_END
const CH = [
  { key: 'title', name: 'Intro', a: 0, b: 18 },
  { key: 'seven', name: 'Seven', a: 18, b: 40 },
  { key: 'wave', name: 'Wave', a: 40, b: 62 },
  { key: 'around', name: 'Around you', a: 62, b: 72 },
];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
//#use C DEF buildDefaults TR key ramp evalTrack storyState fadeVal ST view~2 anchorOf
function buildStory() {
  const F = GL.sets.flock;
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // ------------------------------------------------------------ panel copy
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--cyan)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--cyan)"/><circle cx="352" cy="36" r="4.5" fill="var(--cyan)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">A flock</h1>
      <p class="lede" data-at="2.4">of starlings at dusk</p>
      <p data-at="4">Before they settle for the night, starlings gather in flocks of hundreds or thousands and sweep across the sky together. These ${fmt(F.birds())} fly all around you.</p>
      <p class="note" data-at="10">In a headset, look around: they never leave. On a screen the view follows them.</p>`,
    seven: `<h2 data-at="0.6">Seven neighbours</h2>
      <p data-at="1.2">No bird leads. Each one keeps track of about seven of its nearest neighbours, however near or far they are, and matches their heading and speed.</p>
      <p data-at="7" class="amber">Draw each bird's link to the seven it follows, and the flock is a network: every bird is a node, and every link is one bird watching another.</p>
      <p data-at="14">The links change from moment to moment, as birds change places.</p>
      <p class="credits" data-at="16">Ballerini et al., PNAS 2008: starlings follow a set number of neighbours, not all birds within a set distance.</p>`,
    wave: `<h2 data-at="0.6">A wave</h2>
      <p data-at="1.2">A falcon dives in. The birds nearest it turn away, their neighbours follow them, and theirs follow in turn, so a wave of turning runs through the whole flock.</p>
      <p data-at="9">The dark bands you see are birds banking together, with their wings edge on or full on to you.</p>
      <p data-at="14">Because every bird is linked to its neighbours, a turn can spread across the whole flock, however big it is.</p>
      <p class="credits" data-at="16">Cavagna et al., PNAS 2010; Procaccini et al., Animal Behaviour 2011. The flock here is a simulation. Narration: a synthetic voice (Kokoro).</p>`,
    around: `<h2 data-at="0.6">All around you</h2>
      <p data-at="1.2">The flock flies on for as long as you stay.</p>
      <p data-at="3">Change the number of birds, show who follows whom, or send a falcon by clicking the sky, or by pointing and pulling the trigger in a headset.</p>`,
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
  const cam = (t, k, name, spin, ease, nudge) => {
    const v = view(k, name);
    v[0] += spin || 0;
    if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0;
    wp.push([t, ...v, ease, k]);
  };
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  show('flock', 0, 1.5);
  key('flock_falcon', 0, 0);                        // in the story the falcon comes when the story says
  ramp('flock_links', C.seven.a + 7, C.seven.a + 9, 0, 1);
  ramp('flock_links', C.wave.a - 2, C.wave.a, 1, 0);
  jump('flock_hunt', C.wave.a + 1, 0, 1);
  // sound effects (sfxCue: story time, a sound, where it comes from, its options); the falcon's dive and the flock bursting
  // away, and the flock passing near you, are live (sfxLive in e4_explore.js), so the story's falcon is not cued
  sfxCue(C.seven.a + 6.8, 'grow', 'flock', 'flock', { dur: 2, pitch: 1.2, gain: 0.35 });   // each bird's seven links
  sfxCue(C.around.a + 0.3, 'rise', 'flock', 'flock', { gain: 0.4 });                        // all around you
  // standing among them (the camera turns to the flock); from afar while the wave runs; back among them
  cam(0, 'flock', 'default');
  cam(C.wave.a + 3, 'flock', 'default');
  cam(C.wave.a + 7, 'flock', 'afar');
  cam(C.wave.b - 4, 'flock', 'afar', 20, 'spin');
  cam(C.around.a + 2, 'flock', 'default');
  cam(C.around.b, 'flock', 'default');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);
}
//#use buildCamera~3 setYaw smoothSeg spinEase storyCam~2 LBL labelEl label buildSetLabels~2 setLabelAlpha _v labelPos
//#use _placed placeLabels~2 curCh updateStoryDOM~2 buildTimeline ICON_PLAY ICON_PAUSE lastTick updateTimeline