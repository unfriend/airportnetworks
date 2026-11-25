// ============================================================ STORY: WORLD ==
// Builder C's part of the timeline (src/SPEC.md, "Who owns what"): the sets cell, ppi and globe in chapters reach,
// centre, disease and europe, and their way out at the start of end (until C.end.a + 8). T holds buildStory's helpers:
// C (the chapters), F (storyFacts), show, start, jump, key, ramp, cam, label, sfxCue. STUB (builder A): fades and one
// camera a chapter, so the story plays.
function trackWorld(T) {
  const { C, show, start, ramp, jump, cam } = T;
  start({ cell_shell: 1, cell_sub: XDATA.ex.bap, cell_thr: 0, cell_gene: -1, cell_rev: 0,
    ppi_links: 0, ppi_sort: 0, ppi_pat: -1, ppi_sub: -1, ppi_haz: 0, ppi_dis: -1, ppi_paths: 0, ppi_pairs: 0,
    globe_turn: 0, globe_marks: 0, globe_subs: 0, globe_country: -1, globe_sub: -1, globe_threads: 0, globe_cols: 0 });
  let a, b;
  // reach: benzo(a)pyrene's threads into the cell; CASP3 and its substances
  a = C.reach.a; b = C.reach.b;
  show('cell', a + 3, a + 8, b - 2, b);
  ramp('cell_thr', a + 19, a + 26, 0, 1);
  cam(a + 4, 'cell', 'default', -20);
  cam(b - 1, 'cell', 'default', 20, 'spin');
  // centre: the interactome out of the cell, sorted; the four patterns; hazard
  a = C.centre.a; b = C.centre.b;
  show('ppi', a + 0.5, a + 3);
  ramp('ppi_links', a + 3, a + 8, 0, 1);
  ramp('ppi_sort', a + 13, a + 21, 0, 1);
  ramp('ppi_haz', a + 55, a + 60, 0, 1);
  cam(a, 'ppi', 'default', -20);
  cam(b, 'ppi', 'default', 20, 'spin');
  // disease: asthma's neighbourhood, ozone, the distance; many pairs
  a = C.disease.a; b = C.disease.b;
  key('ppi_haz', a, 0);
  ramp('ppi_pairs', a + 31, a + 36, 0, 1);
  cam(b, 'ppi', 'default', 50, 'spin');
  // europe: the globe turned to Europe, the countries, Italy and endrin, the columns
  a = C.europe.a; b = C.europe.b;
  ramp('ppi_a', a + 0.5, a + 3, 1, 0);
  show('globe', a + 2, a + 5);
  ramp('globe_turn', a + 3, a + 9, 0, 1); ramp('globe_marks', a + 9, a + 12, 0, 1); ramp('globe_cols', a + 75, a + 80, 0, 1);
  cam(a + 3, 'globe', 'default', -10);
  cam(b, 'globe', 'default', 10, 'spin');
  // end: out through the scales (the globe goes; builder B's cloud comes from C.end.a + 6)
  a = C.end.a;
  ramp('globe_a', a + 1, a + 6, 1, 0);
  cam(a + 4, 'globe', 'default', 15);
}
