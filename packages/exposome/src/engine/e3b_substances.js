// ======================================================== STORY: SUBSTANCES ==
// Builder B's part of the timeline (src/SPEC.md, "Who owns what"): the sets cloud, pair and clot in chapters cloud,
// threads, sort and end (from C.end.a + 6). T holds buildStory's helpers: C (the chapters), F (storyFacts), show, start,
// jump, key, ramp, cam, label, sfxCue. STUB (builder A): fades and one camera a chapter, so the story plays.
function trackSubstances(T) {
  const { C, show, start, ramp, jump, cam } = T;
  start({ cloud_shelf: 0, cloud_net: 0, cloud_links: 0, cloud_col: 0, cloud_level: 0, cloud_split: 0, cloud_focus: -1, cloud_pick: -1, cloud_names: 0, cloud_drift: 1,
    pair_genes: 0, pair_share: 0, pair_tie: 0, clot_in: 0, clot_four: 0, clot_gene: 0, clot_label: 0 });
  let a, b;
  // cloud: the cloud round you, then the shelves
  a = C.cloud.a; b = C.cloud.b;
  show('cloud', a + 0.2, a + 3, C.reach.a + 1, C.reach.a + 4);
  ramp('cloud_shelf', a + 31, a + 38, 0, 1);
  cam(a, 'cloud', 'default', -20);
  cam(b, 'cloud', 'default', 10, 'spin');
  // threads: two substances tied, then every thread in the shelves, then the network's own arrangement
  a = C.threads.a; b = C.threads.b;
  show('pair', a + 0.5, a + 3, a + 23, a + 26);
  ramp('pair_genes', a + 2, a + 8, 0, 1); ramp('pair_share', a + 8, a + 12, 0, 1); ramp('pair_tie', a + 12, a + 16, 0, 1);
  cam(a, 'pair', 'default', -10);
  cam(a + 23, 'pair', 'default', 10, 'spin');
  show('cloud', a + 24, a + 27);
  key('cloud_shelf', a + 24, 1); key('cloud_net', a + 24, 0);
  ramp('cloud_links', a + 26, a + 30, 0, 1);
  ramp('cloud_net', a + 27, a + 37, 0, 1);
  cam(a + 25, 'cloud', 'default', -15);
  cam(b, 'cloud', 'default', 15, 'spin');
  // sort: colours by community, the groups apart and named, down into the clotting group
  a = C.sort.a; b = C.sort.b;
  ramp('cloud_col', a + 1, a + 5, 0, 1);
  ramp('cloud_split', a + 6, a + 12, 0, 1); ramp('cloud_names', a + 12, a + 14, 0, 1); ramp('cloud_names', a + 26, a + 28, 1, 0);
  jump('cloud_level', a + 23, 0, 2);
  ramp('cloud_a', a + 29, a + 32, 1, 0);
  show('clot', a + 29, a + 32, b - 1, b);
  ramp('clot_in', a + 30, a + 36, 0, 1); ramp('clot_four', a + 36, a + 42, 0, 1); ramp('clot_gene', a + 42, a + 47, 0, 1); ramp('clot_label', a + 47, a + 50, 0, 1);
  cam(a, 'cloud', 'default', 15);
  cam(a + 28, 'cloud', 'default', 35, 'spin');
  cam(a + 31, 'clot', 'default', -10);
  cam(b, 'clot', 'default', 20, 'spin');
  // end: the network of substances all around you again
  a = C.end.a; b = C.end.b;
  key('cloud_level', a, 0); key('cloud_col', a, 1); key('cloud_split', a, 0); key('cloud_shelf', a, 1); key('cloud_net', a, 1);
  show('cloud', a + 6, a + 10);
  cam(a + 8, 'cloud', 'default', -10);
  cam(b, 'cloud', 'default', 20, 'spin');
}
