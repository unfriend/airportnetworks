//#use head
// ================================================================== STORY ==
// The design room tells no story: its "story" is one short intro line (the table seen from the door, then the walk
// up to it) for a new wearer or a Replay, and it opens straight into explore mode. The engine's clock, chapters and
// slideshow stay as every story has them, so the shell and the shared rooms treat it like the others.
const NARRATION_SYNC = [[0, 0], [6, 6]];
// (no recording: recording time and story time are the same)
//#use storyT narrT T_END
const CH = [{ key: 'table', name: 'The props table', a: 0, b: 6 }];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); });
//#use C DEF
// the engine's own params beside the sets' (DEF): none here; none keyed at an even pace or on a log scale (evalTrack)
const DEF_MORE = {}, LIN = new Set(), LOG = new Set();
// no view moved or set back for the side panel (view, FIT)
const FIT = {};
//#use buildDefaults TR key ramp evalTrack storyState fadeVal ST view anchorOf
function buildStory() {
  const html = {
    table: `<h1 data-at="0.3">The props table</h1>
      <p class="lede" data-at="0.9">Every prop of the stories, small, on one table.</p>
      <p data-at="1.6">${CARD_KEYS.length} models of the 3D sets the ${STORIES.length} stories are made of, a plate for each story. Point at one to see its name; put it on the stage to see what it is made of.</p>
      <p data-at="2.4"><button class="btn primary" type="button" id="btnGoExplore">To the table</button></p>`,
  };
  const story = $('#story');
  story.innerHTML = CH.map(c => `<section class="ch" data-ch="${c.key}">${html[c.key]}</section>`).join('');
  CH.forEach(c => {
    const sec = story.querySelector(`[data-ch="${c.key}"]`);
    ST.items.push({ sec, ch: c, els: Array.from(sec.querySelectorAll('[data-at]')).map(el => ({
      el, at: c.a + parseFloat(el.dataset.at), out: el.dataset.out ? c.a + parseFloat(el.dataset.out) : c === CH[CH.length - 1] ? Infinity : c.b - 0.05, o: -1 })),
      grow: [] });
  });
  // the table fades in; the camera comes up to it from across the room
  ramp('table_a', 0, 0.8, 0, 1);
  // sound effects (sfxCue: story time, a sound, where it comes from, its options); the rest is explore's (e4_explore.js)
  sfxCue(0.2, 'rise', 'table', 'centre', { dur: 2, gain: 0.4 });   // the table fades in
  const wp = [];
  const cam = (t, name, nudge) => { const v = view('table', name); if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0; wp.push([t, ...v, '', 'table']); };
  cam(0, 'default', [-30, -16, 2.4, 0, 0.2, 0]);
  cam(5.5, 'default');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);
}
// camera waypoints: [t, az, el, dist, tx, ty, tz, ease, set], turning the short way round
function buildCamera(wp) {
  wp.sort((x, y) => x[0] - y[0]);
  let prev = null;
  ST.wp = wp.map(w => {
    let az = w[1];
    if (prev !== null) az += 360 * Math.round((prev - az) / 360);
    prev = az;
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7]];
  });
}
function storyCam(t) {
  const wp = ST.wp;
  if (t <= wp[0][0]) return wp[0].slice(1, 7);
  for (let i = 1; i < wp.length; i++) {
    if (t <= wp[i][0]) {
      const p = wp[i - 1], q = wp[i], x = q[0] > p[0] ? smooth((t - p[0]) / (q[0] - p[0])) : 1;
      return [p[1] + (q[1] - p[1]) * x, p[2] + (q[2] - p[2]) * x, Math.exp(Math.log(p[3]) + (Math.log(q[3]) - Math.log(p[3])) * x),
        p[4] + (q[4] - p[4]) * x, p[5] + (q[5] - p[5]) * x, p[6] + (q[6] - p[6]) * x];
    }
  }
  return wp[wp.length - 1].slice(1, 7);
}

//#use LBL labelEl
// (the design room's two labels are the engine's own: the name of the miniature you point at, over it, and the name of
// the prop on the stage, over the stage. Their text follows (labelSet); on a screen they are HTML, in a headset sprites
// or signs.)
function buildSetLabels() {
  for (const at of ['hover', 'stage']) LBL.extra.push({ kind: 'extra', el: labelEl('', at === 'hover' ? 'cyn' : ''), set: 'table', at, txt: null, o: -1, show: 0 });
}
// a label's words: [bold, rest]; the headset's picture is drawn again when they change
function labelSet(L, txt) {
  const s = txt ? txt.join('|') : '';
  if (s === (L.txt ? L.txt.join('|') : '')) return;
  L.txt = txt ? [txt[0], txt[1], L.el.classList.contains('cyn') ? 'cyn' : ''] : null;
  L.el.innerHTML = txt ? `<b>${esc(txt[0])}</b> ${esc(txt[1])}` : '';
  L.w = 0;
  dropSprite(L);
}
//#use setLabelAlpha _v labelPos _placed placeLabels~2
//#use curCh
function updateStoryDOM(t) {
  const c = CH.find(c => t >= c.a && t < c.b) || CH[CH.length - 1];
  if (c !== curCh) {
    ST.items.forEach(it => it.sec.classList.toggle('on', it.ch === c));
    curCh = c;
    $('#panel').scrollTop = 0;
  }
  const it = ST.items.find(x => x.ch === c);
  for (const e of it.els) {
    const o = Math.round(fadeVal(t, e.at, e.out, 0.6) * 100) / 100;
    if (o !== e.o) { e.el.style.opacity = o; e.o = o; e.el.style.visibility = o > 0 ? 'visible' : 'hidden'; }
  }
}

//#use trackHTML buildTimeline ICON_PLAY ICON_PAUSE lastTick updateTimeline
