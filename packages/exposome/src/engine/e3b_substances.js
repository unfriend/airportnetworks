// ======================================================== STORY: SUBSTANCES ==
// Builder B's part of the timeline (src/SPEC.md, "Who owns what"): the sets cloud, pair and clot in chapters cloud,
// threads, sort and end (from C.end.a + 6). T holds buildStory's helpers: C (the chapters), F (storyFacts), show, start,
// jump, key, ramp, cam, label, sfxCue. Times are a chapter's start plus the second of the line they go with (data-at in
// e3_story.js). Step params (focus, level, pick) only ever jump, and are put back while the cloud is hidden, so explore
// mode entered anywhere finds them whole.
// In a headset the first chapter and the last stand you inside the cloud (ST.stand, by story time: xrPlace in
// e5_xr.js): its middle at your eyes, the points round you (none within 0.35 m: the set's keep-clear fade).
// how far a headset stands you inside the cloud at story time t (0..1: ST.stand's spans, [t0, t1, t2, t3], in over
// t0..t1, out over t2..t3; the engine's standW, which this story's e3_story.js does not take)
const standB = t => ST.stand.reduce((w, [t0, t1, t2, t3]) => Math.max(w, Math.min(smooth((t - t0) / (t1 - t0)), smooth((t3 - t) / (t3 - t2)))), 0);
function trackSubstances(T) {
  const { C, show, start, ramp, jump, key, cam } = T;
  const CM = XDATA.comm, top11 = CM.find(0, '11'), mid112 = CM.find(1, '11_2'), fine = CM.find(2, XDATA.ex.clot.id);
  start({ cloud_come: 0, cloud_shelf: 0, cloud_net: 0, cloud_turn: 0, cloud_drift: 1, cloud_links: 0, cloud_alive: 0, cloud_mono: 1,
    cloud_col: 0, cloud_level: 0, cloud_small: 1, cloud_split: 0, cloud_names: 0, cloud_famTags: 0, cloud_focus: -1, cloud_pick: -1,
    cloud_dim: 0, cloud_pair: 0, cloud_hideClot: 0,
    pair_genes: 0, pair_share: 0, pair_tie: 0, clot_in: 0, clot_four: 0, clot_gene: 0, clot_label: 0, clot_pulse: 0 });
  // the story's framing of B's views (FIT: the target moved clear of the side panel on a wide screen; on a narrow one it
  // goes back): the pair's left substance otherwise stands behind the panel, the clotting group's four at its edge
  const cl = [0.035, 0, -0.01];   // (a little to the left of the clotting group as the camera sees it: clot.js's view)
  Object.assign(FIT, { pair: { default: [0, 0, 0, -0.3, 0, 0] }, clot: { default: [0, 0, 0, ...cl], back: [0, 0, 0, ...cl] } });
  FIT.cloud = Object.assign(FIT.cloud || {}, { g1121: [0, 0, 0, ...cl], default: [0, 0, 0, 0, -0.1, 0], near: [0, 0, 0, 0, -0.08, 0] });
  let a, b;

  // ---------------------------------------------------------------- 1. cloud: ten thousand substances round you
  a = C.cloud.a; b = C.cloud.b;
  show('cloud', a + 0.2, a + 2.5, C.reach.a + 1, C.reach.a + 4);
  ramp('cloud_come', a + 0.3, a + 11, 0, 1);              // from far away, as the voice names air, food, the pill
  ramp('cloud_mono', a + 31, a + 34, 1, 0);               // 31 "each colour one chemical family"
  ramp('cloud_shelf', a + 32.5, a + 40, 0, 1);            // ... and onto the chemist's shelves
  ramp('cloud_drift', a + 32, a + 39, 1, 0.12);
  ramp('cloud_famTags', a + 38.5, a + 40.5, 0, 1);        // the five largest families, their counts
  ramp('cloud_turn', a + 42, a + 54, 0, 0.7);             // 42 "it is tidy, but": the shelves turn slowly round you
  ST.stand.push([a, a + 0.01, b - 1, b + 3]);             // (a headset: inside the cloud until it gives way to the cell)
  cam(a, 'cloud', 'inside', -25);
  cam(a + 22, 'cloud', 'inside', 5, 'spin');
  cam(a + 32, 'cloud', 'inside', 20, 'spin');
  cam(a + 40, 'cloud', 'rings', 35);                      // out a little: the rings stacked round the middle
  cam(b, 'cloud', 'rings', 55, 'spin');
  T.sfxCue(a + 32.6, 'whoosh', 'cloud', 'centre', { dur: 7, gain: 0.6 });

  // ---------------------------------------------------------------- 3. threads: two substances tied, then all of them
  a = C.threads.a; b = C.threads.b;
  // the pair (diethylstilbestrol and zearalenone: pair.js): their genes, the shared ones, one thread
  show('pair', a + 0.5, a + 2.5, a + 13.5, a + 16);
  ramp('pair_genes', a + 2, a + 8, 0, 1);                 // 1.5 "compare the genes they disturb"
  ramp('pair_share', a + 7.5, a + 10, 0, 1);              // "if they share many more than chance would give"
  ramp('pair_tie', a + 10, a + 13, 0, 1);                 // "we tie a thread between them"
  cam(a + 0.5, 'pair', 'default', -14);
  cam(a + 13, 'pair', 'default', 6, 'spin');
  // the cloud comes back on its shelves: first the two, lit with their thread, then every drawn thread
  for (const [n, v] of [['cloud_shelf', 1], ['cloud_net', 0], ['cloud_mono', 0], ['cloud_col', 0], ['cloud_come', 1], ['cloud_drift', 0.08], ['cloud_famTags', 0], ['cloud_turn', 0], ['cloud_links', 0], ['cloud_alive', 0.35]]) key(n, a + 12, v);
  show('cloud', a + 13, a + 16);
  ramp('cloud_pair', a + 13.5, a + 15.5, 0, 1);
  ramp('cloud_links', a + 16, a + 22, 0, 1);              // 13 "we keep only the strongest threads"
  ramp('cloud_pair', a + 22, a + 25, 1, 0);
  ramp('cloud_net', a + 26.5, a + 37, 0, 1);              // 25 "let the threads pull": the shelves fall apart
  ramp('cloud_drift', a + 36, a + 40, 0.08, 0.2);
  cam(a + 16, 'cloud', 'rings', 30);
  cam(a + 25, 'cloud', 'default', 55, 'spin');
  cam(a + 37, 'cloud', 'default', 85, 'spin');
  cam(b, 'cloud', 'default', 115, 'spin');
  T.sfxCue(a + 10.5, 'link', 'pair', 'tie', { gain: 0.6 });
  T.sfxCue(a + 26.8, 'whoosh', 'cloud', 'centre', { dur: 9, gain: 0.6 });

  // ---------------------------------------------------------------- 4. sort: by what they do
  a = C.sort.a; b = C.sort.b;
  ramp('cloud_col', a + 1.5, a + 5, 0, 1);                // 1.5 the colours become the groups'
  ramp('cloud_split', a + 6, a + 11, 0, 1);               // the large groups a little apart
  // 12 the three examples named one by one as the voice says them (SORT_EXAMPLES), about four seconds apart
  ramp('cloud_names', a + 11.6, a + 12.6, 0, 0.25); ramp('cloud_names', a + 15.6, a + 16.6, 0.25, 0.5); ramp('cloud_names', a + 19.4, a + 20.4, 0.5, 0.75);
  ramp('cloud_names', a + 22, a + 23, 0.75, 0);
  // 22 "smaller groups, and smaller ones again": down into top group 11, its middle group 11_2, the fine group 11_2_1
  jump('cloud_focus', a + 22.5, -1, top11);
  ramp('cloud_dim', a + 22.5, a + 24.5, 0, 1);
  ramp('cloud_split', a + 22.5, a + 27, 1, 0.35);
  jump('cloud_level', a + 25, 0, 1);
  jump('cloud_focus', a + 26.3, top11, mid112);
  jump('cloud_level', a + 27.8, 1, 2);
  jump('cloud_focus', a + 28.8, mid112, fine);
  cam(a, 'cloud', 'default', 125);
  cam(a + 22, 'cloud', 'default', 165, 'spin');
  cam(a + 27.5, 'cloud', 'g11', 0);
  cam(a + 31, 'cloud', 'g1121', 0);
  // 30 the clotting group: its 21 gather; the four come forward as the voice names them
  show('clot', a + 29.2, a + 30.5, b - 3, b - 0.5);
  ramp('cloud_hideClot', a + 29.2, a + 29.8, 0, 1);
  ramp('clot_in', a + 29.5, a + 34, 0, 1);
  ramp('clot_four', a + 31.2, a + 32.4, 0, 0.25);         // heparin
  ramp('clot_four', a + 33.8, a + 35, 0.25, 0.5);         // the pill
  ramp('clot_four', a + 36.6, a + 37.8, 0.5, 0.75);       // the dye
  ramp('clot_four', a + 39.2, a + 40.4, 0.75, 1);         // the sedative
  ramp('clot_gene', a + 43, a + 50, 0, 1);                // 42 "they all pull on the same few genes"
  ramp('clot_label', a + 49.5, a + 52, 0, 1);             // "and those genes control how our blood clots"
  ramp('clot_pulse', a + 54, a + 56, 0, 1);               // 54 "not what it is: what it disturbs"
  ramp('clot_pulse', a + 71, a + 74, 1, 0);
  cam(a + 31.5, 'clot', 'default', 0);
  cam(a + 53, 'clot', 'default', -8, 'spin');
  cam(a + 72, 'clot', 'default', 6, 'spin');
  ramp('clot_tags', a + 72.5, a + 74.5, 1, 0);
  cam(a + 78, 'clot', 'back', 14);                        // 73 "which are dangerous?": pull back
  ramp('cloud_a', b - 2.5, b - 0.5, 1, 0);
  T.sfxCue(a + 6.2, 'whoosh', 'cloud', 'centre', { dur: 5, gain: 0.5 });
  T.sfxCue(a + 27.8, 'whoosh', 'cloud', 'focus', { dur: 4, gain: 0.5 });
  [32, 34.6, 37.4, 40].forEach((s, i) => T.sfxCue(a + s, 'step', 'clot', 'four' + i, { pitch: Math.pow(2, i / 12), gain: 0.5 }));
  T.sfxCue(a + 45.5, 'link', 'clot', 'gene', { gain: 0.6 });
  // (put back while hidden: no step left on a pick for explore or the end)
  jump('cloud_focus', b + 1, fine, -1); jump('cloud_level', b + 1, 2, 0); jump('cloud_hideClot', b + 1, 1, 0);

  // ---------------------------------------------------------------- 8. end: back among the whole network, all round you
  a = C.end.a; b = C.end.b;
  for (const [n, v] of [['cloud_shelf', 1], ['cloud_net', 1], ['cloud_col', 1], ['cloud_small', 0.6], ['cloud_split', 0], ['cloud_names', 0], ['cloud_dim', 0],
    ['cloud_links', 0.8], ['cloud_alive', 1], ['cloud_drift', 0.35], ['cloud_come', 1], ['cloud_pair', 0], ['cloud_famTags', 0], ['cloud_turn', 0]]) key(n, a + 5, v);
  show('cloud', a + 6, a + 10);
  ST.stand.push([a + 6, a + 10, b + 60, b + 61]);         // (a headset: inside the network to the end)
  cam(a + 8, 'cloud', 'near', -10);
  cam(b, 'cloud', 'near', 40, 'spin');
  T.sfxCue(a + 6.5, 'whoosh', 'cloud', 'centre', { dur: 5, gain: 0.5 });
}
