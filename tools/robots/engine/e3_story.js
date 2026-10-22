
// ================================================================== STORY ==
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Until a narration is recorded, the table sets the
// pace: node tools/pace.mjs writes it from the words on the panel (each stretch
// between two cues lasts long enough to read what appeared at its start; run
// it again after the text changes). A recording replaces it with its own times.
const NARRATION_SYNC = [
  [0, 0], [5.3, 4.6], [18.7, 9],                      // Robot gang
  [25.5, 14], [26.2, 14.6], [27.6, 15.2], [38.9, 21], [46.7, 27],  // Bump and turn
  [54.7, 34], [55.4, 34.6], [56.3, 35.2], [64.5, 41],  // Follow me
  [79.4, 54], [80.1, 54.6], [81.9, 55.2], [89.7, 61], [96.6, 67],  // Follow the one ahead
  [110.7, 74], [111.4, 74.6], [112.3, 75.2], [116.4, 77], [129.1, 84],  // Your gang
];
// recording time -> original story time
function storyT(t) {
  const W = NARRATION_SYNC;
  if (t <= 0) return 0;
  for (let i = 1; i < W.length; i++) {
    if (t <= W[i][0]) { const [n0, o0] = W[i - 1], [n1, o1] = W[i]; return o0 + (o1 - o0) * (t - n0) / (n1 - n0); }
  }
  return W[W.length - 1][1] + (t - W[W.length - 1][0]);
}
// original story time -> recording time
function narrT(o) {
  const W = NARRATION_SYNC;
  for (let i = 1; i < W.length; i++) {
    if (o <= W[i][1]) { const [n0, o0] = W[i - 1], [n1, o1] = W[i]; return n0 + (n1 - n0) * (o - o0) / (o1 - o0); }
  }
  return W[W.length - 1][0] + (o - W[W.length - 1][1]);
}
let T_END = NARRATION_SYNC[NARRATION_SYNC.length - 1][0];
const CH = [
  { key: 'title', name: 'Robot gang', a: 0, b: 14 },
  { key: 'bump', name: 'Bump and turn', a: 14, b: 34 },
  { key: 'follow', name: 'Follow me', a: 34, b: 54 },
  { key: 'chain', name: 'Follow the one ahead', a: 54, b: 74 },
  { key: 'gang', name: 'Your gang', a: 74, b: 84 },
];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
const C = Object.fromEntries(CH.map(c => [c.key, c]));

// every param of every set, at rest; the sets themselves start hidden
const DEF = {};
function buildDefaults() {
  for (const k of SET_ORDER) Object.assign(DEF, GL.sets[k].params);
  for (const k of SET_ORDER) DEF[k + '_a'] = 0;
}
const TR = {};
const key = (n, t, v) => { (TR[n] = TR[n] || []).push([t, v]); };
const ramp = (n, t0, t1, v0, v1) => { key(n, t0, v0); key(n, t1, v1); };
function evalTrack(n, t) {
  const ks = TR[n];
  if (!ks) return DEF[n];
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const [t0, v0] = ks[i - 1], [t1, v1] = ks[i];
      return t1 <= t0 ? v1 : v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
    }
  }
  return ks[ks.length - 1][1];
}
function storyState(t) {
  const s = {};
  for (const n in DEF) s[n] = evalTrack(n, t);
  return s;
}
const fadeVal = (t, a, b, d) => (t <= a || t >= b ? 0 : Math.min(smooth((t - a) / d), smooth((b - t) / d)));

const ST = { labels: [], items: [] };
// a set's camera view by name (falls back to its default view)
const view = (k, name) => { const c = GL.sets[k].cam; return (c[name] || c.default).slice(); };
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
      <p data-at="7">Nobody plans a route, yet the floor gets clean: so far the gang has cleaned <b data-live="cov">0 %</b> of it.</p>
      <p data-at="13">Bouncing at random reaches every corner in the end, but the last patches take longest.</p>`,
    follow: `<h2 data-at="0.6">Follow me</h2>
      <p data-at="1.2">Now give each robot one rule: follow you, keep a little distance, and keep clear of the others.</p>
      <p data-at="7" class="amber">Draw who follows whom and you get a network: you in the middle, a link to every robot. A star.</p>`,
    chain: `<h2 data-at="0.6">Follow the one ahead</h2>
      <p data-at="1.2">Rewire the network. Each robot follows the one in front of it; only the first follows you.</p>
      <p data-at="7">Same robots, same rule, a different network: the gang becomes a line.</p>
      <p class="credits" data-at="13">Swarms of robots are often steered like this: each watches a few others, and the network of who follows whom shapes the group (Olfati-Saber, Fax and Murray, Proceedings of the IEEE 2007).</p>`,
    gang: `<h2 data-at="0.6">Your gang</h2>
      <p data-at="1.2">The gang stays for as long as you do.</p>
      <p data-at="3" data-xr="Change the rule, add robots, show the cleaned floor, or spill crumbs: point at the floor and pull the trigger. Walk about and the gang follows.">Change the rule, add robots, show the cleaned floor, or spill crumbs: click the floor to walk; in a headset, point at the floor and pull the trigger.</p>`,
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
// the turn a set has at story time t: that of its latest stay on show (it starts fading in a little before its first view)
function setYaw(k, t) {
  let c = 0;
  for (const y of ST.yaw) if (y.k === k && y.t0 - 6 <= t) c = y.c;
  return c;
}
// 0..1 progress over a segment of length D: smoothstep, or for 'spin' segments a steady
// slow turn with short eased starts and stops (trapezoidal speed profile)
const smoothSeg = (t, D) => smooth(t / D);
function spinEase(t, D) {
  const r = Math.min(2.5, D / 3);
  if (t <= 0) return 0;
  if (t >= D) return 1;
  const v = 1 / (D - r); // cruise speed so the ramps plus cruise cover 0..1
  if (t < r) return v * t * t / (2 * r);
  if (t > D - r) return 1 - v * (D - t) * (D - t) / (2 * r);
  return v * (t - r / 2);
}
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

// ---------------------------------------------------------------- labels --
// Story labels are pinned to a set's anchor for a stretch of story time; each
// set also brings its own labels, shown whenever its params call for them.
const LBL = { story: ST.labels, sets: [], extra: [] };
function labelEl(html, cls) {
  const el = document.createElement('div');
  el.className = 'lbl ' + (cls || '');
  el.innerHTML = html;
  el.style.opacity = 0;
  $('#labels').appendChild(el);
  return el;
}
function label(set, at, html, tIn, tOut, cls) {
  if (typeof at === 'string' && (GL.sets[set].labels || []).some(L => L.at === at)) return; // the set labels this point itself
  ST.labels.push({ kind: 'story', el: labelEl(html, cls), set, at, tIn, tOut, o: -1 });
}
function buildSetLabels() {
  for (const k of SET_ORDER) for (const L of GL.sets[k].labels || []) {
    const [b, r] = L.text;
    LBL.sets.push({ kind: 'set', el: labelEl(`<b>${esc(b)}</b>${esc(r || '')}`, L.cls), set: k, at: L.at, alpha: L.alpha, minor: !!L.minor, o: -1 });
  }
}
// a set label shows as far as its set is in and its own rule allows
// (labels a set marks as minor give way on narrow screens)
const setLabelAlpha = (L, S) => {
  const a = S[L.set + '_a'] || 0;
  if (a < 0.5 || (L.minor && !GL.wide && !XR.on)) return 0;
  return (2 * a - 1) * clamp(L.alpha ? L.alpha(S) : 1, 0, 1);
};
// where a label points, in the world's own coordinates
const _v = new THREE.Vector3();
function labelPos(L, out) {
  const p = anchorOf(L.set, L.at);
  return out.set(p[0], p[1], p[2]).applyMatrix4(GL.sets[L.set].group.matrix);
}
// labels on screen: pinned next to their point, nudged down where they would overlap, and
// kept clear of the side panel, the timeline and the edge of the screen
const _placed = [];
function placeLabels(list, alphaOf) {
  _placed.length = 0;
  const vis = [], W = window.innerWidth, H = window.innerHeight;
  const pr = $('#panel').getBoundingClientRect(), barTop = $('#bar').getBoundingClientRect().top || H;
  for (const L of list) {
    let o = Math.round(alphaOf(L) * 100) / 100, x = 0, y = 0;
    if (o > 0) {
      labelPos(L, _v).applyMatrix4(GL.world.matrixWorld).project(GL.camera);
      if (_v.z > 1 || Math.abs(_v.x) > 1.2 || Math.abs(_v.y) > 1.2) o = 0;
    }
    if (o > 0) {
      if (!L.w) { L.w = L.el.offsetWidth || 120; L.h = L.el.offsetHeight || 22; }
      const sx = (_v.x * 0.5 + 0.5) * W;
      x = sx + 9; y = (-_v.y * 0.5 + 0.5) * H - 11;
      if (pr.width && y + L.h > pr.top && y < pr.bottom && x < pr.right + 6) {
        // a point just beside the panel keeps its label next to the panel; one behind it shows none
        if (GL.wide && sx > pr.right - 40) x = pr.right + 6; else o = 0;
      }
      if (y + L.h > barTop - 4 || y < 50) o = 0;
      x = Math.min(x, W - L.w - 6);
    }
    if (o !== L.o) { L.el.style.opacity = o; L.o = o; }
    if (o <= 0) continue;
    vis.push([L, x, y]);
  }
  vis.sort((p, q) => p[2] - q[2]);
  for (const [L, x, y0] of vis) {
    let y = y0;
    for (let pass = 0; pass < 6; pass++) {
      const hit = _placed.find(r => x < r[0] + r[2] && r[0] < x + L.w && y < r[1] + r[3] && r[1] < y + L.h);
      if (!hit) break;
      y = hit[1] + hit[3] + 2;
    }
    _placed.push([x, y, L.w, L.h]);
    L.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
}

// ------------------------------------------------------------ panel update --
let curCh = null;
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
function updateStoryDOM(t) {
  const c = CH.find(c => t >= c.a && t < c.b) || CH[CH.length - 1];
  if (c !== curCh) {
    ST.items.forEach(it => it.sec.classList.toggle('on', it.ch === c));
    curCh = c;
    $('#panel').scrollTop = 0;
  }
  const it = ST.items.find(x => x.ch === c);
  let fresh = null;
  for (const e of it.els) {
    const o = Math.round(fadeVal(t, e.at, e.out, 0.6) * 100) / 100;
    if (o !== e.o) {
      if (e.o <= 0 && o > 0 && !e.el.classList.contains('credits')) fresh = e.el;
      e.el.style.opacity = o; e.o = o; e.el.style.visibility = o > 0 ? 'visible' : 'hidden';
    }
  }
  // on a short (phone) panel, scroll just far enough that a line that has just appeared is not below the fold
  if (fresh) {
    const p = $('#panel'), over = fresh.getBoundingClientRect().bottom - (p.getBoundingClientRect().bottom - parseFloat(getComputedStyle(p).paddingBottom));
    if (over > 0) p.scrollTo({ top: p.scrollTop + over, behavior: 'smooth' });
  }
  if (c.key === 'title') {
    const arc = $('#titleArc');
    if (arc) { arc.setAttribute('stroke-dashoffset', (1 - smooth((t - 0.5) / 2.2)).toFixed(3)); $('#titleDot').setAttribute('opacity', smooth((t - 2.5) / 0.4)); }
  }
}

// ------------------------------------------------------------- timeline UI --
function buildTimeline() {
  const tr = $('#track');
  tr.innerHTML = '<div class="rail"></div><div class="done"></div>' + CH.slice(1).map(c =>
    `<div class="tick" data-k="${c.key}" style="left:${(100 * c.na / T_END).toFixed(2)}%"></div><div class="name" data-k="${c.key}" style="left:${(100 * c.na / T_END).toFixed(2)}%">${c.name}</div>`).join('') + '<div class="knob"></div>';
  tr.setAttribute('aria-valuemax', Math.round(T_END));
  const seekAt = ev => {
    const r = tr.getBoundingClientRect();
    APP.seek(clamp((ev.clientX - r.left) / r.width, 0, 1) * T_END);
  };
  let drag = false;
  tr.addEventListener('pointerdown', ev => { drag = true; tr.setPointerCapture(ev.pointerId); seekAt(ev); });
  tr.addEventListener('pointermove', ev => { if (drag) seekAt(ev); });
  tr.addEventListener('pointerup', () => { drag = false; });
  tr.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowRight') { APP.seek(APP.t + 5); ev.preventDefault(); }
    if (ev.key === 'ArrowLeft') { APP.seek(APP.t - 5); ev.preventDefault(); }
  });
  $('#play').addEventListener('click', () => APP.togglePlay());
  // slideshow: Next and this story's switch, in the shell's row at the foot of the panel (an older shell has none)
  if ($('#slides')) { $('#btnNext').addEventListener('click', slideNext); $('#btnSlides').addEventListener('click', slideToggle); }
  if ($('#btnNextBar')) $('#btnNextBar').addEventListener('click', slideNext);   // Next beside Play (phones)
}
const ICON_PLAY = '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 16 16"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>';
let lastTick = -1;
function updateTimeline(t, playing) {
  const p = (100 * t / T_END).toFixed(2);
  if (p !== lastTick) {
    $('#track .done').style.width = p + '%';
    $('#track .knob').style.left = p + '%';
    $('#track').setAttribute('aria-valuenow', Math.round(t));
    const m = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    $('#clock').textContent = m(t) + ' / ' + m(T_END);
    const c = CH.find(c => t >= c.na && t < c.nb) || CH[CH.length - 1];
    document.querySelectorAll('#track .name').forEach(n => n.classList.toggle('cur', n.dataset.k === c.key));
    lastTick = p;
  }
  const want = playing ? 'pause' : 'play';
  const btn = $('#play');
  if (btn.dataset.s !== want) { btn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY; btn.dataset.s = want; btn.setAttribute('aria-label', playing ? 'Pause' : 'Play'); }
  slideDOM();
}
