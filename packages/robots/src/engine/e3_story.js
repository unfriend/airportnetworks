//#use head
// ================================================================== STORY ==
// Narration timing: [time in the recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands on
// the matching sentence. The story is narrated by a synthetic voice
// (packages/robots/audio/narration.mp3, Kokoro's af_heart): node tools/voice/narrate.mjs
// robots writes this table and NARRATION_ENDS from the recording it makes (each
// stretch lasts the longer of 1.1 times its story time and its line's audio
// plus a pause); run it again after the text changes (see
// tools/voice/README.md).
const NARRATION_SYNC = [
  [0, 0], [1.32, 1.2], [4.5, 4], [14.04, 9],          // Robot gang
  [19.54, 14], [20.84, 15.18], [22.49, 15.2], [31.35, 21],  // Bump and turn
  [45.65, 34], [46.95, 35.18], [48.46, 35.2],         // Follow me
  [69.14, 54], [70.44, 55.18], [72.34, 55.2],         // Follow the one ahead
  [93.02, 74], [94.32, 75.18], [95.79, 75.2], [98.47, 77], [108.4, 83.3], [109.17, 84],  // Your gang
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { title: 18.3, bump: 43.25, follow: 61.15, chain: 83.2, gang: 108.2 };
//#use storyT narrT T_END
const CH = [
  { key: 'title', name: 'Robot gang', a: 0, b: 14 },
  { key: 'bump', name: 'Bump and turn', a: 14, b: 34 },
  { key: 'follow', name: 'Follow me', a: 34, b: 54 },
  { key: 'chain', name: 'Follow the one ahead', a: 54, b: 74 },
  { key: 'gang', name: 'Your gang', a: 74, b: 84 },
];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
// the engine's own params beside the sets' (DEF): none here; none keyed at an even pace or on a log scale (evalTrack)
const DEF_MORE = {}, LIN = new Set(), LOG = new Set();
// no view moved or set back for the side panel (view, FIT)
const FIT = {};
//#use C DEF buildDefaults TR key ramp evalTrack storyState fadeVal ST view
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}
const NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
// live numbers in the story text (data-live), filled every frame from the set
const LIVE = {
  cov: () => Math.round(GL.sets.robots.coverage() * 100) + ' %',
  n: () => String(GL.sets.robots.robots()),
};
let liveEls = [];

function buildStory() {
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  const n = Math.round(DEF.robots_n), many = cap(NUMW[n] || String(n));
  // ------------------------------------------------------------ panel copy
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--cyan)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--cyan)"/><circle cx="352" cy="36" r="4.5" fill="var(--cyan)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">Robot gang</h1>
      <p class="lede" data-at="2.4">vacuums in your room</p>
      <p data-at="4">${many} robot vacuums share a room with you. In a headset it is your own room: the headset knows your floor and walls from its room setup, and so do they.</p>
      <p class="note" data-at="9" data-xr="Walk about: the robots know where you are. Point at the floor and pull the trigger to spill crumbs.">On a screen you stand in a model living room. Click the floor to walk.</p>`,
    bump: `<h2 data-at="0.6">Bump and turn</h2>
      <p data-at="1.2">Early robot vacuums had no map of the room. Much of the time they simply drove until they bumped into something, turned, and drove on.</p>
      <p data-at="7" data-say="Nobody plans a route, yet the floor gets clean.">Nobody plans a route, yet the floor gets clean: so far the gang has cleaned <b data-live="cov">0 %</b> of it.</p>
      <p data-at="13">Bouncing at random reaches every corner in the end, but the last patches take longest.</p>`,
    follow: `<h2 data-at="0.6">Follow me</h2>
      <p data-at="1.2">Now give each robot one rule: follow you, keep a little distance, and keep clear of the others.</p>
      <p data-at="7" class="amber">Draw who follows whom and you get a network, with you in the middle and a link to every robot: a star.</p>`,
    chain: `<h2 data-at="0.6">Follow the one ahead</h2>
      <p data-at="1.2">Rewire the network. Each robot follows the one in front of it; only the first follows you.</p>
      <p data-at="7">Same robots, same rule, a different network: the gang becomes a line.</p>
      <p class="credits" data-at="13">Swarms of robots are often steered like this: each watches a few others, and the network of who follows whom shapes the group (Olfati-Saber, Fax and Murray, Proceedings of the IEEE 2007). Narration: a synthetic voice (Kokoro).</p>`,
    gang: `<h2 data-at="0.6">Your gang</h2>
      <p data-at="1.2">The gang stays for as long as you do.</p>
      <p data-at="3" data-xr="Change the rule, add robots, show the cleaned floor, or spill crumbs: point at the floor and pull the trigger. Walk about and the gang follows.">Change the rule, add robots, show the cleaned floor, or spill crumbs. Click the floor to walk; in a headset, point at the floor and pull the trigger to spill them.</p>`,
  };
  const story = $('#story');
  story.innerHTML = CH.map(c => `<section class="ch" data-ch="${c.key}">${html[c.key]}</section>`).join('');
  liveEls = Array.from(story.querySelectorAll('[data-live]')).map(el => ({ el, f: LIVE[el.dataset.live], v: '' }));
  CH.forEach(c => {
    const sec = story.querySelector(`[data-ch="${c.key}"]`);
    ST.items.push({ sec, ch: c, els: Array.from(sec.querySelectorAll('[data-at]')).map(el => ({
      el, at: c.a + parseFloat(el.dataset.at), out: el.dataset.out ? c.a + parseFloat(el.dataset.out) : c === CH[CH.length - 1] ? Infinity : c.b - 0.05, o: -1 })),
      grow: [] });
  });
  // ------------------------------------------------------------ keyframes and camera
  const wp = [];
  // a waypoint: a view of the set (the low view keeps its target on the gang), turned by spin degrees
  const cam = (t, k, name, spin, ease) => {
    const v = view(k, name);
    v[0] += spin || 0;
    wp.push([t, ...v, name === 'low' ? 1 : 0, ease, k]);
  };
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  show('robots', 0, 1);
  // the room is found; the gang sleeps at the dock
  key('robots_n', 0, n);
  key('robots_rule', 0, 0);
  ramp('robots_scan', 2, 11, 0, 1);
  // bump and turn on a dusty floor; the cleaned floor shows as a map
  jump('robots_rule', C.bump.a, 0, 1);
  jump('robots_dust', C.bump.a, 0, 1);
  ramp('robots_trails', C.bump.a + 1, C.bump.a + 3, 0, 1);
  // follow you as you stroll: a star
  jump('robots_rule', C.follow.a, 1, 2);
  jump('robots_walk', C.follow.a, 0, 1);
  ramp('robots_trails', C.follow.a, C.follow.a + 2, 1, 0);
  ramp('robots_links', C.follow.a + 6, C.follow.a + 8, 0, 1);
  // follow the one ahead: a chain; crumbs on the floor
  jump('robots_rule', C.chain.a, 2, 3);
  jump('robots_crumbs', C.chain.a + 12, 0, 1);
  // the gang gathers round you again; you stand still
  jump('robots_rule', C.gang.a, 3, 2);
  jump('robots_walk', C.gang.a, 1, 0);
  ramp('robots_links', C.gang.a, C.gang.a + 2, 1, 0);
  // sound effects (sfxCue: story time, a sound, where it comes from, its options); the vacuums, the bumps and the crumbs
  // (the story's pile at chain + 12 among them) are live (sfxLive in e4_explore.js), so the story's pile is not cued
  sfxCue(2, 'grow', 'robots', 'floor', { dur: 9, pitch: 0.8, gain: 0.3 });               // the room is found
  sfxCue(10.4, 'ping', 'robots', 'dock', { gain: 0.4 });                                 // the dock
  sfxCue(C.bump.a + 0.3, 'rise', 'robots', 'dock', { dur: 1.5, pitch: 1.2 });            // the gang wakes
  sfxCue(C.follow.a + 0.3, 'ping', 'robots', 'you', { pitch: 1.2, gain: 0.35 });         // follow you
  sfxCue(C.follow.a + 6, 'grow', 'robots', 'gang', { dur: 2 });                          // the links: a star
  sfxCue(C.chain.a + 0.3, 'ping', 'robots', 'gang', { pitch: 0.9, gain: 0.35 });         // follow the one ahead
  sfxCue(C.gang.a + 0.3, 'ping', 'robots', 'you', { gain: 0.35 });                       // your gang
  label('robots', 'dock', '<b>Dock</b>', 10.4, C.bump.a + 0.5, 'grn');
  label('robots', 'crumbs', '<b>Crumbs</b>', C.chain.a + 12.3, C.chain.a + 17, 'amb');
  // the doll's house from above, drifting slowly; down among the robots for a while as they bounce about
  cam(0, 'robots', 'default', -12);
  cam(C.bump.a, 'robots', 'default', 0, 'spin');
  cam(C.bump.a + 3.5, 'robots', 'default', 4, 'spin');
  cam(C.bump.a + 6.5, 'robots', 'low', 0);
  cam(C.bump.a + 12.5, 'robots', 'low', 25, 'spin');
  cam(C.bump.a + 16, 'robots', 'default', 8);
  cam(C.follow.a, 'robots', 'default', 12, 'spin');
  cam(C.chain.a, 'robots', 'default', 24, 'spin');
  cam(C.gang.a, 'robots', 'default', 10, 'spin');
  cam(C.gang.b, 'robots', 'default', 0, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);
}
// camera waypoints: [t, az, el, dist, tx, ty, tz, g, ease, set]; 'spin' segments turn at a steady pace.
// When the story hands over from one set to another, the new set is turned about its
// vertical axis so that its first view starts where the camera already is: a crossfade
// never swings the camera round. The set keeps that turn while it is on show (setYaw).
function buildCamera(wp) {
  wp.sort((x, y) => x[0] - y[0]);
  const turn = (w, deg) => {
    const r = deg * D2R, x = w[4], z = w[6];
    w[1] += deg; w[4] = x * Math.cos(r) + z * Math.sin(r); w[6] = -x * Math.sin(r) + z * Math.cos(r);
  };
  ST.yaw = [];
  let cur = null, prevAz = null;
  for (const w of wp) {
    if (!cur || w[9] !== cur.k) {
      const d = prevAz === null ? 0 : ((prevAz - w[1]) % 360 + 540) % 360 - 180;
      cur = { k: w[9], t0: w[0], c: Math.abs(d) > 40 ? d : 0 };
      ST.yaw.push(cur);
    }
    turn(w, cur.c);
    prevAz = w[1];
  }
  // keep turning the short way round between views
  let prev = null;
  ST.wp = wp.map(w => {
    let az = w[1];
    if (prev !== null) az += 360 * Math.round((prev - az) / 360);
    prev = az;
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7], w[8]];
  });
}
//#use setYaw smoothSeg spinEase
// the story's camera at t: [az, el, dist, tx, ty, tz, g] (g: how far the target is on the gang)
function storyCam(t) {
  const wp = ST.wp;
  if (t <= wp[0][0]) return wp[0].slice(1, 8);
  for (let i = 1; i < wp.length; i++) {
    if (t <= wp[i][0]) {
      const p = wp[i - 1], q = wp[i], x = q[0] > p[0] ? (q[8] === 'spin' ? spinEase : smoothSeg)(t - p[0], q[0] - p[0]) : 1;
      return [p[1] + (q[1] - p[1]) * x, p[2] + (q[2] - p[2]) * x, Math.exp(Math.log(p[3]) + (Math.log(q[3]) - Math.log(p[3])) * x),
        p[4] + (q[4] - p[4]) * x, p[5] + (q[5] - p[5]) * x, p[6] + (q[6] - p[6]) * x, p[7] + (q[7] - p[7]) * x];
    }
  }
  return wp[wp.length - 1].slice(1, 8);
}

//#use LBL labelEl label buildSetLabels~2 setLabelAlpha _v labelPos _placed placeLabels~2 curCh
// the live numbers: written only when they change (the headset panel redraws on that too, see sigMain)
function updateLive() {
  let s = '';
  for (const L of liveEls) {
    const v = L.f();
    if (v !== L.v) { L.v = v; L.el.textContent = v; }
    s += v + ';';
  }
  return s;
}
//#use updateStoryDOM~2 trackHTML buildTimeline ICON_PLAY ICON_PAUSE lastTick updateTimeline