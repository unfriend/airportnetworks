//#use head
// ================================================================== STORY ==
// The chapters, on story time (seconds): a key, the name on the timeline, and where each begins and ends.
const CH = [
  { key: 'title', name: 'Stress test', a: 0, b: 16 },
];
// Narration timing: [time in the recording, story time] pairs; the story is stretched or squeezed between them so
// each cue lands on its sentence. Without a recording (the default: captions only) the story keeps its own clock.
// With one (audio/narration.mp3 in the package: e7_app.js, narrationFile) put the pairs here, and where each chapter's
// words end in it as NARRATION_ENDS = { title: 19.5, ... } (the slideshow lets the voice finish there).
const NARRATION_SYNC = [[0, 0], [CH[CH.length - 1].b, CH[CH.length - 1].b]];
//#use storyT narrT T_END
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
// the engine's own params beside the sets' (DEF): none here; none keyed at an even pace or on a log scale (evalTrack)
const DEF_MORE = {}, LIN = new Set(), LOG = new Set();
//#use C DEF buildDefaults TR key ramp evalTrack storyState fadeVal ST view fitShift
// each set's views nudged so they fit beside the side panel on a wide screen: { set: { view: [daz, del, ddist, dtx,
// dty, dtz] } } (added to the set's own view, in story and explore mode alike); none here
const FIT = {};
// how much further back a view stands on a phone held upright: { set: { view: factor } }
const NARROW = { cell: { default: 1.15 } };
//#use narrowOf anchorOf
//#use f2 word listOf
//#use inkCol swCol
const CYAN = '#46d9ff', AMBER = '#ffb43b', MAGENTA = '#ff5ad9';

function buildStory() {
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const step = (at, out, col, b, text) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  // ------------------------------------------------------------ panel copy
  // Each chapter's text: data-at is when a line appears (seconds into the chapter), data-out when it goes. The headset's
  // panel cannot scroll, so no chapter shows more than fits at once: parts that take turns in one place (turns), each
  // fading out as the next comes.
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const html = {
    title: `<h1 data-at="0.6">${esc(XR_TITLE)}</h1>
      <p class="lede" data-at="1.6">How many proteins and links can the cell hold?</p>
      <p data-at="3">The cell map's model cell, drawn exactly as there, with made-up proteins and links in place of the real ones.</p>
      <ul class="steps">${step(6, 0, CYAN, 'Explore mode', 'sets how many proteins, links and curve pieces')}
        ${step(8, 0, AMBER, 'Frame rate', 'in a headset: press B or Y twice')}</ul>
      <p data-at="10"><button class="btn primary" id="btnGoExplore" type="button">Explore</button></p>`,
  };

  const story = $('#story');
  story.innerHTML = CH.map(c => `<section class="ch" data-ch="${c.key}">${html[c.key]}</section>`).join('');
  CH.forEach(c => {
    const sec = story.querySelector(`[data-ch="${c.key}"]`);
    ST.items.push({ sec, ch: c, els: Array.from(sec.querySelectorAll('[data-at]')).map(el => ({
      el, at: c.a + parseFloat(el.dataset.at), out: el.dataset.out ? c.a + parseFloat(el.dataset.out) : c === CH[CH.length - 1] ? Infinity : c.b - 0.05, o: -1 })),
      grow: [] });
  });

  // ------------------------------------------------------------ timeline keys
  const wp = [];
  // a camera waypoint at time t: a set's named view, turned by spin degrees, optionally nudged
  const cam = (t, k, name, spin, ease, nudge) => {
    const v = view(k, name);
    v[0] += spin || 0;
    if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0;
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name)]);
  };
  start({ cell_n: 250, cell_e: 375, cell_seg: 14, cell_shell: 1 });
  const a = C.title.a, b = C.title.b;
  show('cell', 0.2, 2);
  cam(a, 'cell', 'default', -20);
  cam(b, 'cell', 'default', 20, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  label('cell', 'nucleus', '<b>Nucleus</b> · as in the cell map', C.title.a + 4, C.title.b - 1, 'cyn');
}
// no set turns into another at a hand-over (buildCamera's MORPH)
const MORPH = {};
//#use buildCamera setYaw smoothSeg spinEase storyCam LBL labelEl label sfxSpan buildSetLabels labelText
//#use setLabelAlpha~2 _v labelPos _placed placeLabels curCh updateStoryDOM trackHTML buildTimeline ICON_PLAY ICON_PAUSE
//#use lastTick updateTimeline
