// ================================================================== STORY ==
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Until a narration is recorded, the table sets the
// pace: node tools/pace.mjs writes it from the words on the panel (each stretch
// between two cues lasts long enough to read what appeared at its start; run
// it again after the text changes). A recording replaces it with its own times.
// (This story is in two languages: pace.mjs gives each line the reading time of the longer of the two, LANGS.)
const NARRATION_SYNC = [
  [0, 0], [29.7, 27], [36.1, 32],                     // The school
  [44.9, 40], [45.6, 40.6], [46.7, 41.2], [47.4, 41.8], [58, 46], [65.2, 52], [79.5, 65], [88.9, 73],  // Who watches whom
  [113.1, 95], [113.7, 95.6], [114.9, 96.2],          // Other links
  [163, 140], [164.3, 141.18], [166, 141.2], [173.4, 148], [178.3, 151], [186, 158], [196.6, 164],
  [229.6, 194], [236.4, 199], [237, 199.6], [252.2, 204],  // The sky
  [258.8, 210], [260.1, 211.18], [261, 211.2], [267.4, 216], [275.3, 220], [283.6, 225],
  [292.6, 230], [293.3, 230.6], [299.4, 233], [320.3, 252], [328.2, 258], [333.1, 262],  // The cell
  [346.3, 270], [347, 270.6], [347.7, 271.2], [353.7, 274], [356, 276], [359, 278], [363.4, 282],
  [371.3, 288], [377.4, 291], [378, 291.6], [385.7, 293], [388.5, 295.6], [413.8, 305],  // Medicine
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
// (a chapter's name is in the language on show)
const CH = [
  { key: 'fish', a: 0, b: 40 },
  { key: 'watch', a: 40, b: 95 },
  { key: 'links', a: 95, b: 140 },
  { key: 'sky', a: 140, b: 210 },
  { key: 'cell', a: 210, b: 270 },
  { key: 'med', a: 270, b: 305 },
];
CH.forEach(c => { Object.defineProperty(c, 'name', { get: () => T('ch.' + c.key), enumerable: true }); c.na = narrT(c.a); c.nb = narrT(c.b); });
const C = Object.fromEntries(CH.map(c => [c.key, c]));

// every param of every set, at rest; the sets themselves start hidden. lens: the camera's lens (1 among the fish, a
// wide one; 0 for the globe and the cell, the long one of their stories)
const DEF = {};
function buildDefaults() {
  for (const k of SET_ORDER) Object.assign(DEF, GL.sets[k].params);
  for (const k of SET_ORDER) DEF[k + '_a'] = 0;
  DEF.lens = 0;
}
const TR = {};
const key = (n, t, v) => { (TR[n] = TR[n] || []).push([t, v]); };
const ramp = (n, t0, t1, v0, v1) => { key(n, t0, v0); key(n, t1, v1); };
// tracks that run at an even pace (the outbreak's days; a protein travelling its way): no easing in and out
const LIN = new Set(['globe_day', 'cell_cue', 'cell_nfkb', 'cell_cf']);
function evalTrack(n, t) {
  const ks = TR[n];
  if (!ks) return DEF[n];
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const [t0, v0] = ks[i - 1], [t1, v1] = ks[i], x = (t - t0) / (t1 - t0);
      return t1 <= t0 ? v1 : v0 + (v1 - v0) * (LIN.has(n) ? x : smooth(x));
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
// (with the story's own framing on top: FIT)
const view = (k, name) => {
  const c = GL.sets[k].cam, v = (c[name] || c.default).slice(), f = c[name] && FIT[k] && FIT[k][name];
  if (f) for (let i = 0; i < f.length; i++) v[i] += f[i];
  return v;
};
// the part of a view's FIT that moves its target clear of the side panel: on a screen without one (a phone, a narrow
// window) applyCamera takes it back, so the view stays centred there
const fitShift = (k, name) => { const f = GL.sets[k].cam[name] && FIT[k] && FIT[k][name]; return f ? [f[3] || 0, f[4] || 0, f[5] || 0] : [0, 0, 0]; };
// views whose parts reach under the side panel on a landscape screen: a little further back (added to the set's own
// view, in story and explore mode alike; the fish are all round you and need none)
const FIT = { globe: { default: [0, 0, 0.3], start: [0, 0, 0.2], europe: [0, 0, 0.2], atlantic: [0, 0, 0.3], asia: [0, 0, 0.3] },
  cell: { default: [0, 0, 0.3], nfkb: [0, 0, 0.2], cf: [0, 0, 0.2], als: [0, 0, 0.2], signal: [0, 0, 0.2] } };
// how much further back a view stands on a phone held upright (see narrowK): the whole globe and the whole cell
const NARROW = { globe: { default: 1.15, world: 1.1, start: 1.1 }, cell: { default: 1.15, nfkb: 1.1, cf: 1.1 } };
const narrowOf = (k, name) => (NARROW[k] && NARROW[k][name]) || 1;
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

// ------------------------------------------------------------------ facts --
// The numbers the story quotes, from the sets: the airports and routes (the airports story's data), the story's
// outbreak (from Vienna, as the globe's model computes it) and the cell map's proteins and places
const STORY_OUT = { start: 'VIE', inc: 5, inf: 7, spread: 'medium', kept: 1 };
const outSetup = o => GL.sets.globe.api.setup({ start: GL.sets.globe.api.find(o.start), inc: o.inc, inf: o.inf, spread: o.spread, kept: o.kept });
let FACTS = null;
function facts() {
  const g = GL.sets.globe.api, c = GL.sets.cell.api.counts();
  outSetup(STORY_OUT);
  const reachedBy = d => { const n = g.count(d); return n.E + n.I + n.R; };
  return { airports: g.n(), routes: g.routes(), start: g.find(STORY_OUT.start), week: reachedBy(7), d10: reachedBy(10), d20: reachedBy(20), d30: reachedBy(30),
    proteins: c.proteins, places: c.places };
}
// colours as text on the HTML panel, which is light in the light theme: a colour mixed with the panel's ink (darker on a
// light panel, lighter on a dark one). The headset's panel is dark: its canvas twin takes the colour itself (data-col).
const inkCol = c => `color-mix(in srgb, ${c} 55%, var(--ink))`;
const swCol = c => c;   // a swatch or a bar in the same colour
const AMBER = '#ffb43b', RED = '#ff5a4b', GREY = '#8e98ab', CYAN = '#46d9ff', TEAL = '#38e6c7';

// the panel's words, in the language on show (made again when it changes: setLang)
function storyHTML() {
  const F = FACTS, city = GL.sets.globe.api.info(F.start).city;
  const step = (at, col, b, text) => `<li data-at="${at}" data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${esc(text)}</li>`;
  // parts of a chapter that take turns in one place, each fading out (data-out) as the next comes: the headset's
  // panel cannot scroll, so no chapter shows more than fits at once
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const p = (at, k, cls, out, ...a) => `<p data-at="${at}"${out ? ` data-out="${out}"` : ''}${cls ? ` class="${cls}"` : ''}>${esc(T(k, ...a))}</p>`;
  const fact = (at, out, b, s, col) => `<div data-at="${at}" data-out="${out}"><b${col ? ` data-col="${col}" style="color:${inkCol(col)}"` : ''}>${b}</b><small>${esc(s)}</small></div>`;
  return {
    fish: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">${esc(T('title'))}</h1>
      <p class="lede" data-at="2.4">${esc(T('lede'))}</p>
      ${p(5, 'fish.1')}${p(13, 'fish.2')}${p(20, 'fish.3', 'amber')}${p(27, 'fish.note', 'note')}
      <p class="credits" data-at="32">${esc(T('fish.credit'))}</p>`,
    watch: `<h2 data-at="0.6">${esc(T('watch.h'))}</h2>
      ${turns(`${p(1.2, 'watch.1', '', 19.5)}${p(6, 'watch.2', '', 19.5)}${p(12, 'watch.3', 'amber', 19.5)}`,
      `${p(20, 'watch.4')}${p(25, 'watch.5')}${p(33, 'watch.6', 'amber')}<p data-at="40"><b>${esc(T('watch.7'))}</b></p>${p(45, 'watch.note', 'note')}`)}`,
    links: `<h2 data-at="0.6">${esc(T('links.h'))}</h2>
      ${turns(`${p(1.2, 'links.1', '', 23.5)}${p(6, 'links.2', '', 23.5)}${p(13, 'links.3', 'amber', 23.5)}`,
      `${p(24, 'links.4')}<p data-at="33" class="amber"><b>${esc(T('links.5'))}</b></p>`)}`,
    sky: `<h2 data-at="0.6">${esc(T('sky.h'))}</h2>
      ${turns(`${p(1.2, 'sky.1', '', 17.5)}${p(8, 'sky.2', '', 17.5)}
        <div class="facts">${fact(11, 17.5, num(F.airports), T('sky.f1'))}${fact(12.5, 17.5, num(F.routes), T('sky.f2'))}</div>`,
      `${p(18, 'sky.3', '', 45.5, city)}${p(24, 'sky.4', 'amber', 45.5, num(F.week))}
        <div class="facts">${[[28, 10, F.d10], [36, 20, F.d20], [44, 30, F.d30]].map(([at, d, n]) => fact(at, 45.5, num(n), `${T('sky.cities')}, ${T('sky.day', d)}`, RED)).join('')}</div>`,
      `${p(46, 'sky.5')}${p(54, 'sky.6', 'amber')}${p(59, 'sky.note', 'note', 0, STORY_OUT.inc, STORY_OUT.inf)}
        <p class="credits" data-at="64">${esc(T('sky.credit'))}</p>`)}`,
    cell: `<h2 data-at="0.6">${esc(T('cell.h'))}</h2>
      ${turns(`${p(1.2, 'cell.1', '', 19.5)}${p(6, 'cell.2', '', 19.5)}${p(10, 'cell.3', '', 19.5, num(F.proteins))}${p(15, 'cell.4', 'amber', 19.5)}`,
      `${p(20, 'cell.5', '', 36.5)}${p(23, 'cell.6', '', 36.5)}${p(29, 'cell.7', 'amber', 36.5)}`,
      `${p(37, 'cell.8')}${p(42, 'cell.9')}${p(48, 'cell.10', 'amber')}${p(52, 'cell.note', 'note', 0, num(F.proteins), num(F.places))}`)}`,
    med: `<h2 data-at="0.6">${esc(T('med.h'))}</h2>
      ${turns(`${p(1.2, 'med.1', '', 17.5)}
        <ul class="steps">${step(4, CYAN, T('med.s1'), T('med.s1t'))}${step(6, RED, T('med.s2'), T('med.s2t'))}${step(8, TEAL, T('med.s3'), T('med.s3t'))}</ul>
        ${p(12, 'med.2', 'amber', 17.5)}`,
      `${p(18, 'med.3')}${p(21, 'med.4')}
        <p data-at="23"><button class="btn primary" id="btnGoExplore" type="button">${esc(T('med.go'))}</button></p>
        <p class="credits" data-at="25">${esc(T('med.credit'))}</p>`)}`,
  };
}
// the panel: the language switch, then a section per chapter (its items fade in as the story goes)
function buildStoryDOM() {
  const html = storyHTML(), story = $('#story');
  story.lang = LANG;
  story.innerHTML = langSwitch() + CH.map(c => `<section class="ch" data-ch="${c.key}">${html[c.key]}</section>`).join('');
  ST.items = [];
  CH.forEach(c => {
    const sec = story.querySelector(`[data-ch="${c.key}"]`);
    ST.items.push({ sec, ch: c, els: Array.from(sec.querySelectorAll('[data-at]')).map(el => ({
      el, at: c.a + parseFloat(el.dataset.at), out: el.dataset.out ? c.a + parseFloat(el.dataset.out) : c === CH[CH.length - 1] ? Infinity : c.b - 0.05, o: -1 })),
      grow: [] });
  });
  curCh = null; XR.elInfo = null;
}
// the switch between the two languages (on the story panel and above the explore tabs)
const langSwitch = () => `<div class="seg" data-lang role="group" aria-label="Language / Sprache" style="float:right;margin:2px 0 6px 10px">${LANGS.map(l =>
  `<button type="button" data-lang="${l}" lang="${l}" aria-pressed="${l === LANG}">${l.toUpperCase()}</button>`).join('')}</div>`;

function buildStory() {
  FACTS = facts();
  buildStoryDOM();
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  const hide = (k, t0, t1) => ramp(k + '_a', t0, t1, 1, 0);
  // jump a count (neighbours, a shark) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };

  // ------------------------------------------------------------ timeline keys
  const wp = [];
  // a camera waypoint at time t: a set's named view, turned by spin degrees, optionally nudged
  const cam = (t, k, name, spin, ease, nudge) => {
    const v = view(k, name);
    v[0] += spin || 0;
    if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0;
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name)]);
  };
  start({ fish_n: 300, fish_k: 7, fish_links: 0, fish_water: 1, fish_shark: 0, fish_hunt: 0, fish_scale: 1,
    globe_reveal: 0, globe_routes: 1, globe_hubs: 0, globe_pillars: 0, globe_dim: 0, globe_out: 0, globe_day: 0,
    cell_org: 0, cell_shell: 1, cell_names: 0, cell_reveal: 1, cell_links: 1, cell_ids: 1, cell_multi: 0, cell_focus: 0, cell_ex: 0,
    cell_path: 0, cell_path_a: 1, cell_cue: 0, cell_cue_a: 1, cell_nfkb: 0, cell_apop: 0, cell_tfeb: 0, cell_glut4: 0, cell_nrf2: 0, cell_als: 0, cell_cf: 0 });
  key('lens', 0, 1);
  let a, b;
  // A school of fish: all round you (on a screen the camera turns to keep the school in view: followView)
  a = C.fish.a; b = C.fish.b;
  key('fish_a', 0, 1);
  cam(a, 'fish', 'default');
  cam(b - 1, 'fish', 'default', 0, 'spin');
  label('fish', 'school', () => `<b>${esc(T('lbl.school'))}</b>${sfxSpan(T('lbl.school.r'))}`, a + 6, a + 26, 'cyn');
  // Who watches whom: the links light up; from afar, a shark, and the warning racing through the school
  a = C.watch.a; b = C.watch.b;
  ramp('fish_links', a + 4, a + 7, 0, 1);
  cam(a + 8, 'fish', 'default');
  cam(a + 14, 'fish', 'afar');
  cam(b, 'fish', 'afar', 40, 'spin');
  jump('fish_hunt', a + 20, 0, 1);
  // Change the links: one neighbour each, the school falls apart; seven again, it comes together
  a = C.links.a; b = C.links.b;
  jump('fish_k', a + 5, 7, 1);
  jump('fish_k', a + 24, 1, 7);
  cam(b, 'fish', 'afar', 80, 'spin');
  // From the sea to the sky: the camera rises out of the water while the sea shrinks to a dot (in a headset it only
  // fades: the viewer never moves), the globe comes in, and the outbreak starts in Vienna; then the hubs
  a = C.sky.a; b = C.sky.b;
  ramp('fish_links', a + 2, a + 5, 1, 0);
  ramp('fish_scale', a + 2, a + 9, 1, 0.002);
  hide('fish', a + 7, a + 10);
  ramp('lens', a + 7, a + 12, 1, 0);
  cam(a + 1, 'fish', 'afar', 80);
  cam(a + 7, 'fish', 'above', 80, null, [0, 0, 0, 0, -1.6, 4]);   // (looking down at the shrinking sea's middle)
  show('globe', a + 7, a + 11);
  ramp('globe_reveal', a + 8, a + 14, 0, 1);
  cam(a + 12, 'globe', 'world');
  cam(a + 17, 'globe', 'start');
  ramp('globe_out', a + 18, a + 20, 0, 1); ramp('globe_dim', a + 18, a + 20, 0, 1);
  key('globe_day', a + 20, 0); key('globe_day', a + 52, 40);   // (1.25 days a second, evenly: LIN)
  cam(a + 30, 'globe', 'start', 6, 'spin');
  cam(a + 42, 'globe', 'default');
  ramp('globe_pillars', a + 44, a + 47, 0, 1); ramp('globe_pillars', a + 58, a + 61, 1, 0);
  cam(b, 'globe', 'default', 25, 'spin');
  // Into the cell: its organelles one by one, two proteins meeting, the relay to NF-kB, and CFTR stuck on its way
  a = C.cell.a; b = C.cell.b;
  hide('globe', a, a + 4);
  show('cell', a + 2, a + 6);
  ramp('cell_org', a + 3, a + 15, 0, 10);
  ramp('cell_names', a + 3, a + 4, 0, 1); ramp('cell_names', a + 18, a + 19, 1, 0);
  ramp('cell_ex', a + 15, a + 18, 0, 1); ramp('cell_ex', a + 20, a + 22, 1, 0);
  cam(a + 2, 'cell', 'default');
  cam(a + 15, 'cell', 'default', 25, 'spin');
  cam(a + 21, 'cell', 'nfkb');
  ramp('cell_cue', a + 23, a + 29, 0, 1);
  ramp('cell_nfkb', a + 29, a + 33, 0, 1);
  cam(a + 35, 'cell', 'nfkb', 8, 'spin');
  ramp('cell_cue_a', a + 36, a + 38, 1, 0);
  cam(a + 39, 'cell', 'cf');
  ramp('cell_cf', a + 42, a + 46, 0, 1);
  cam(b, 'cell', 'cf', 10, 'spin');
  // Network medicine: the cell's network stands out, CFTR's links lost; slowly round
  a = C.med.a; b = C.med.b;
  ramp('cell_shell', a, a + 3, 1, 0.35);
  cam(a + 3, 'cell', 'default');
  cam(b, 'cell', 'default', 40, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);
}
// camera waypoints: [t, az, el, dist, tx, ty, tz, ease, set, narrow factor, FIT's target shift]; 'spin' segments turn at
// a steady pace.
// When the story hands over from one set to another, the new set is turned about its
// vertical axis so that its first view starts where the camera already is: a crossfade
// never swings the camera round. The set keeps that turn while it is on show (setYaw).
function buildCamera(wp) {
  wp.sort((x, y) => x[0] - y[0]);
  const turn = (w, deg) => {
    const r = deg * D2R, x = w[4], z = w[6], f = w[10], fx = f[0], fz = f[2];
    w[1] += deg; w[4] = x * Math.cos(r) + z * Math.sin(r); w[6] = -x * Math.sin(r) + z * Math.cos(r);
    f[0] = fx * Math.cos(r) + fz * Math.sin(r); f[2] = -fx * Math.sin(r) + fz * Math.cos(r);   // (the shift turns with it)
  };
  ST.yaw = [];
  let cur = null, prevAz = null;
  for (const w of wp) {
    if (!cur || w[8] !== cur.k) {
      const d = prevAz === null ? 0 : ((prevAz - w[1]) % 360 + 540) % 360 - 180;
      cur = { k: w[8], t0: w[0], c: Math.abs(d) > 40 ? d : 0 };
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
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7], w[9] || 1, w[10]];
  });
}
// the turn a set has at story time t: that of its latest stay on show (it starts fading in a little before its first view)
function setYaw(k, t) {
  let c = 0;
  const f = frameOf(k);
  for (const y of ST.yaw) if (y.k === f && y.t0 - 6 <= t) c = y.c;
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
// the story's view at time t: [az, el, dist, tx, ty, tz, narrow factor, and FIT's target shift x, y, z]
function storyCam(t) {
  const wp = ST.wp, end = w => [w[1], w[2], w[3], w[4], w[5], w[6], w[8], ...w[9]];
  if (t <= wp[0][0]) return end(wp[0]);
  for (let i = 1; i < wp.length; i++) {
    if (t <= wp[i][0]) {
      const p = wp[i - 1], q = wp[i], x = q[0] > p[0] ? (q[7] === 'spin' ? spinEase : smoothSeg)(t - p[0], q[0] - p[0]) : 1, f = p[9], g = q[9];
      return [p[1] + (q[1] - p[1]) * x, p[2] + (q[2] - p[2]) * x, Math.exp(Math.log(p[3]) + (Math.log(q[3]) - Math.log(p[3])) * x),
        p[4] + (q[4] - p[4]) * x, p[5] + (q[5] - p[5]) * x, p[6] + (q[6] - p[6]) * x, p[8] + (q[8] - p[8]) * x,
        f[0] + (g[0] - f[0]) * x, f[1] + (g[1] - f[1]) * x, f[2] + (g[2] - f[2]) * x];
    }
  }
  return end(wp[wp.length - 1]);
}

// ---------------------------------------------------------------- labels --
// Story labels are pinned to a set's anchor for a stretch of story time; each
// set also brings its own labels, shown whenever its params call for them.
// (a story label's text is a function, read again when the language changes: relabel)
const LBL = { story: ST.labels, sets: [], extra: [] };
function labelEl(html, cls) {
  const el = document.createElement('div');
  el.className = 'lbl ' + (cls || '');
  el.innerHTML = html;
  el.style.opacity = 0;
  $('#labels').appendChild(el);
  return el;
}
function label(set, at, fn, tIn, tOut, cls) {
  if (typeof at === 'string' && (GL.sets[set].labels || []).some(L => L.at === at)) return; // the set labels this point itself
  ST.labels.push({ kind: 'story', el: labelEl(fn(), cls), fn: null, html: fn, set, at, tIn, tOut, o: -1 });
}
// a label's rest after its bold part; a long one (more than a mark such as ' · hub' or ' · 1.2×') gives way on narrow
// screens (placeLabels)
const sfxSpan = r => (!r ? '' : String(r).length > 8 ? `<span class="sx">${esc(r)}</span>` : esc(r));
function buildSetLabels() {
  for (const k of SET_ORDER) for (const L of GL.sets[k].labels || []) {
    // (a label's text may be a function: it follows what the set shows and its language, see labelText)
    const fn = typeof L.text === 'function' ? L.text : null, [b, r] = fn ? fn() : L.text;
    LBL.sets.push({ kind: 'set', el: labelEl(`<b>${esc(b)}</b>${sfxSpan(r)}`, L.cls), set: k, at: L.at, alpha: L.alpha, minor: !!L.minor, o: -1,
      fn, tx: fn ? b + '|' + r : '', none: !b && !r, cls: L.cls });
  }
}
// a label whose text is a function (the day, the start city, the selected protein ...) is read again while it
// shows and redrawn when it changes: the HTML label, and the headset's sprite (dropped, so it is made again)
function labelText(L) {
  if (!L.fn) return;
  const [b, r] = L.fn(), s = b + '|' + r;
  if (s === L.tx) return;
  L.tx = s; L.none = !b && !r;
  L.el.innerHTML = `<b>${esc(b)}</b>${sfxSpan(r)}`;
  L.w = 0; L.nar = undefined; dropSprite(L);
}
// the story's own labels in the language on show (the sets' follow by themselves: labelText)
function relabel() {
  for (const L of ST.labels) { L.el.innerHTML = L.html(); L.w = 0; L.nar = undefined; dropSprite(L); }
}
// a set label shows as far as its set is in and its own rule allows
// (labels a set marks as minor give way on narrow screens)
const setLabelAlpha = (L, S) => {
  const a = S[L.set + '_a'] || 0;
  if (a < 0.5 || (L.minor && !GL.wide && !XR.on)) return 0;
  if (L.set === 'fish' && (S.fish_scale === undefined ? 1 : S.fish_scale) < 0.95) return 0;   // (none while the sea shrinks away)
  const v = (2 * a - 1) * clamp(L.alpha ? L.alpha(S) : 1, 0, 1);
  if (v > 0) labelText(L);
  return L.none ? 0 : v;
};
// where a label points, in the world's own coordinates (the fish through their holder, GL.life)
const _v = new THREE.Vector3();
function labelPos(L, out) {
  const p = anchorOf(L.set, L.at), g = GL.sets[L.set].group;
  out.set(p[0], p[1], p[2]).applyMatrix4(g.matrix);
  return g.parent === GL.life ? out.applyMatrix4(GL.life.matrix) : out;
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
      // (on a narrow screen a label's long rest is left out: the panel says it, and the scene there is small)
      if (L.nar !== !GL.wide) { L.nar = !GL.wide; const sx = L.el.querySelector('.sx'); if (sx) sx.style.display = L.nar ? 'none' : ''; L.w = 0; }
      if (!L.w) { L.w = L.el.offsetWidth || 120; L.h = L.el.offsetHeight || 22; }
      const sx = (_v.x * 0.5 + 0.5) * W;
      x = sx + 9; y = (-_v.y * 0.5 + 0.5) * H - 11;
      if (pr.width && y + L.h > pr.top && y < pr.bottom && x < pr.right + 6) {
        // a point just beside the panel keeps its label next to the panel; one behind it shows none
        if (GL.wide && sx > pr.right - 40) x = pr.right + 6; else o = 0;
      }
      if (y + L.h > barTop - 4 || y < 50) o = 0;
      x = Math.max(6, Math.min(x, W - L.w - 6));
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
    const p = $('#panel'), pr = p.getBoundingClientRect(), over = fresh.getBoundingClientRect().bottom - (pr.bottom - parseFloat(getComputedStyle(p).paddingBottom));
    if (over > 0) {
      // (a chapter's heading is shown whole or scrolled out of sight, never cut in half)
      const h = it.sec.querySelector('h1, h2'), hr = h && h.getBoundingClientRect(), edge = pr.top + p.clientTop + over;
      p.scrollTo({ top: p.scrollTop + over + (hr && hr.top < edge && hr.bottom > edge ? hr.bottom - edge + 4 : 0), behavior: 'smooth' });
    }
  }
  if (c.key === 'fish') {
    const arc = $('#titleArc');
    if (arc) { arc.setAttribute('stroke-dashoffset', (1 - smooth((t - 0.5) / 2.2)).toFixed(3)); $('#titleDot').setAttribute('opacity', smooth((t - 2.5) / 0.4)); }
  }
}

// ------------------------------------------------------------- timeline UI --
// (the chapters' names in the language on show: made again when it changes)
function trackHTML() {
  const tr = $('#track');
  tr.innerHTML = '<div class="rail"></div><div class="done"></div>' + CH.slice(1).map(c =>
    `<div class="tick" data-k="${c.key}" style="left:${(100 * c.na / T_END).toFixed(2)}%"></div><div class="name" data-k="${c.key}" style="left:${(100 * c.na / T_END).toFixed(2)}%">${esc(c.name)}</div>`).join('') + '<div class="knob"></div>';
  tr.setAttribute('aria-valuemax', Math.round(T_END));
  lastTick = -1;
}
function buildTimeline() {
  const tr = $('#track');
  trackHTML();
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
