//#use head
// ================================================================== STORY ==
// The chapters, on story time (seconds): a key, the name on the timeline, and where each begins and ends.
const CH = [
  { key: 'ring', name: 'Ring', a: 0, b: 24 },
  { key: 'far', name: 'Far', a: 24, b: 46 },
  { key: 'short', name: 'Shortcuts', a: 46, b: 72 },
  { key: 'small', name: 'Small world', a: 72, b: 94 },
];
// Narration timing: [time in the recording, story time] pairs. No recording (captions only): the story's own clock.
const NARRATION_SYNC = [[0, 0], [CH[CH.length - 1].b, CH[CH.length - 1].b]];
//#use storyT narrT T_END
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
// the engine's own params beside the sets' (DEF): none here; none keyed at an even pace or on a log scale (evalTrack)
const DEF_MORE = {}, LIN = new Set(), LOG = new Set();
//#use C DEF buildDefaults TR key ramp evalTrack storyState fadeVal ST view fitShift
// each set's views nudged so they fit beside the side panel on a wide screen: none here
const FIT = {};
// how much further back a view stands on a phone held upright: the ring is wide
const NARROW = { ring: { default: 1.25, top: 1.25, low: 1.2 } };
//#use narrowOf anchorOf
//#use word
//#use inkCol swCol
const CYAN = '#46d9ff', AMBER = '#ffb43b', MAGENTA = '#ff5ad9';
// ------------------------------------------------------------------ facts --
// The numbers the story quotes, computed from the example's network (HELLO) at the rewiring the story shows: none,
// a few shortcuts (P1) and all links (1); the two people across the ring are A = 1 and B = 31.
const P1 = 0.05, A0 = 0, B0 = 30;
const f1 = x => (Math.round(x * 10) / 10).toFixed(1);
const pct = x => `${Math.round(100 * x)}%`;
const FACTS = (() => {
  const H = HELLO, at = p => Object.assign({ hops: (H.path(p, A0, B0) || []).length - 1 }, H.stats(p));
  return { n: H.N, k: H.K, links: H.links.length, none: at(0), few: at(P1), all: at(1) };
})();

function buildStory() {
  const F = FACTS, Z = F.none, S1 = F.few, R = F.all, H = HELLO;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const step = (at, out, col, b, text) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  // ------------------------------------------------------------ panel copy
  // (the headset's panel cannot scroll: parts that take turns in one place, each fading out as the next comes)
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const html = {
    ring: `<h1 data-at="0.6">${esc(XR_TITLE)}</h1>
      <p class="lede" data-at="1.6">How a few shortcuts make a big world small</p>
      ${turns(`<p data-at="3" data-out="14.5">${cap(word(F.n))} people stand in a ring. Each one knows the ${word(F.k / 2)} people on either side: ${word(F.k)} friends each.</p>
        <p data-at="9" data-out="14.5">Friends of friends mostly know each other too, as in a village: ${pct(Z.clust)} of the pairs of anyone's friends are friends.</p>`,
      `<p data-at="15">How many handshakes link two people, on average? Count them along the friendships.</p>
        <p data-at="18" class="amber">Here: ${f1(Z.avg)}, the stack in the middle.</p>`)}`,
    far: `<h2 data-at="0.6">A long way round</h2>
      ${turns(`<p data-at="1.2" data-out="13.5">Take two people on opposite sides of the ring, A and B.</p>
        <p data-at="4" data-out="13.5">A message passed from friend to friend needs ${Z.hops} handshakes to get from A to B.</p>`,
      `<p data-at="14" class="amber">In a ring, the way across grows with its size: twice the people, twice the handshakes.</p>`)}`,
    short: `<h2 data-at="0.6">A few shortcuts</h2>
      ${turns(`<p data-at="1.2" data-out="15.5">Now a few people swap one friend for someone anywhere on the ring, picked at random.</p>
        <ul class="steps">${step(5, 15.5, AMBER, `${cap(word(S1.rewired))} of ${F.links} friendships`, 'move: each one a shortcut, arching over the ring')}</ul>`,
      `<p data-at="16" class="amber">The way from A to B drops to ${S1.hops} handshakes, and the average to ${f1(S1.avg)}.</p>
        <p data-at="19">Yet the ring still looks local: ${pct(S1.clust)} of friends' friends still know each other, against ${pct(Z.clust)} before.</p>`)}`,
    small: `<h2 data-at="0.6">Small worlds</h2>
      ${turns(`<p data-at="1.2" data-out="11.5">Rewire every link and the ring becomes a random tangle: ${f1(R.avg)} handshakes on average, but only ${pct(R.clust)} of friends' friends know each other.</p>`,
      `<p data-at="12">A few shortcuts are enough: close like a random network, local like a village. Duncan Watts and Steven Strogatz called this a small world.</p>
        <p data-at="16" class="amber">It helps explain why strangers are often only a few handshakes apart.</p>
        <p data-at="18.5"><button class="btn primary" id="btnGoExplore" type="button">Rewire it yourself</button></p>
        <p class="credits" data-at="19">An example network of ${F.n} people, made and measured here. After D. J. Watts and S. H. Strogatz, Collective dynamics of 'small-world' networks, Nature 393, 440 to 442 (1998).</p>`)}`,
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
  // (the shortcuts' level: every link with a smaller draw has moved)
  const L1 = H.levelOf(P1);
  start({ ring_people: 0, ring_links: 0, ring_rw: 0, ring_count: 0, path_from: A0, path_to: B0, path_show: 0 });
  let a, b;
  // Sixty people in a ring, their links drawn round it, then the counter
  a = C.ring.a; b = C.ring.b;
  show('ring', 0.2, 1.5);
  ramp('ring_people', a + 2.5, a + 6.5, 0, 1);
  ramp('ring_links', a + 6, a + 10, 0, 1);
  ramp('ring_count', a + 15.5, a + 18, 0, 1);
  cam(a, 'ring', 'low', -30);
  cam(a + 9, 'ring', 'default', -12);
  cam(b - 0.5, 'ring', 'default', 6, 'spin');
  // A long way round: the chain from A to B, hop by hop
  a = C.far.a; b = C.far.b;
  show('path', a + 1, a + 2);
  ramp('path_show', a + 4, a + 12, 0, 1);
  cam(a + 3, 'ring', 'top', -4);
  cam(b - 0.5, 'ring', 'top', 6, 'spin');
  // A few shortcuts: the level rises to P1, each link moving at its own; the chain and the counter follow
  a = C.short.a; b = C.short.b;
  ramp('ring_rw', a + 5, a + 14, 0, L1);
  cam(a + 3, 'ring', 'low', -10);
  cam(a + 15, 'ring', 'default', 0);
  cam(b - 0.5, 'ring', 'default', 10, 'spin');
  // Small worlds: every link rewired, then back to a few
  a = C.small.a; b = C.small.b;
  ramp('ring_rw', a + 1, a + 7, L1, 1);
  ramp('ring_rw', a + 11, a + 15, 1, L1);
  cam(a + 2, 'ring', 'default', 4);
  cam(b, 'ring', 'default', 22, 'spin');
  // ---- sound effects (sfxCue: story time, a sound, where it comes from (set, anchor), its options)
  sfxCue(C.ring.a + 2.5, 'patter', 'ring', 'front', { dur: 4, gain: 0.3 });             // the people appear
  sfxCue(C.ring.a + 6, 'grow', 'ring', 'centre', { dur: 4, gain: 0.35 });               // their links
  sfxCue(C.ring.a + 15.5, 'rise', 'ring', 'top', { dur: 2.5, gain: 0.5 });              // the counter
  for (let h = 0; h < Z.hops; h += 3) sfxCue(C.far.a + 4 + 8 * h / Z.hops, 'pulse', 'path', 'a', { pitch: Math.pow(2, h / 24), gain: 0.4, seq: true });   // the chain, hop by hop
  // each shortcut as it moves (the level crossing its link's own)
  const rampAt = (t0, t1, v0, v1, v) => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (v0 + (v1 - v0) * smooth(m) < v) lo = m; else hi = m; } return t0 + (t1 - t0) * lo; };
  H.links.filter(l => l.lv < L1).forEach((l, i) => sfxCue(rampAt(C.short.a + 5, C.short.a + 14, 0, L1, l.lv), 'snap', 'ring', 'centre', { pitch: Math.pow(2, i / 12), gain: 0.45 }));
  sfxCue(C.small.a + 1, 'whoosh', 'ring', 'centre', { dur: 6, pitch: 0.8 });              // every link rewired
  sfxCue(C.small.a + 11, 'whoosh', 'ring', 'centre', { dur: 4, pitch: 1.1 });             // and back to a few
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  label('ring', 'side', '<b>Four friends</b> · each', C.ring.a + 8, C.ring.a + 14.5, 'cyn');
}
// no set turns into another at a hand-over (buildCamera's MORPH)
const MORPH = {};
//#use buildCamera setYaw smoothSeg spinEase storyCam LBL labelEl label sfxSpan buildSetLabels labelText
//#use setLabelAlpha~2 _v labelPos _placed placeLabels curCh updateStoryDOM trackHTML buildTimeline ICON_PLAY ICON_PAUSE
//#use lastTick updateTimeline
