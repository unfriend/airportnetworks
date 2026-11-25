// ============================================================ STORY: WORLD ==
// Builder C's part of the timeline (src/SPEC.md, "Who owns what"): the sets cell, ppi and globe in chapters reach,
// centre, disease and europe, and their way out at the start of end (until C.end.a + 8). T holds buildStory's helpers:
// C (the chapters), F (storyFacts), show, start, jump, key, ramp, cam, label, sfxCue. Every time below is a line's
// data-at in e3_story.js (C.<key>.a + s).
function trackWorld(T) {
  const { C, show, start, ramp, jump, key, cam, label, sfxCue } = T;
  const E = XDATA.ex, PATS = E.patterns || [];
  const casp3 = XDATA.ppi.find('CASP3'), asthma = XDATA.dis.find('Asthma'), italy = XDATA.countries.findIndex(c => c.name === 'Italy');
  start({ cell_shell: 0, cell_dots: 0, cell_sp: 0, cell_sub: E.bap, cell_thr: 0, cell_many: 0, cell_gene: -1, cell_rev: 0, cell_two: 0, cell_note: 0,
    ppi_links: 0, ppi_sort: 0, ppi_pat: -1, ppi_sub: -1, ppi_hl: 0, ppi_haz: 0, ppi_dis: -1, ppi_dhl: 0, ppi_gat: 0, ppi_paths: 0, ppi_pairs: 0,
    ppi_ripple: 0, ppi_rip: 0, ppi_shrink: 0, ppi_tags: 0,
    globe_turn: 0, globe_marks: 0, globe_subs: 0, globe_country: -1, globe_sub: -1, globe_threads: 0, globe_cols: 0, globe_close: 0 });
  let a, b;

  // ------------------------------------------------------------ reach: benzo(a)pyrene's threads into the cell, CASP3's out
  a = C.reach.a; b = C.reach.b;
  show('cell', a + 1, a + 2.5, b - 1.5, b);
  ramp('cell_sp', a + 1.5, a + 6, 0, 1);                                  // 1.5 the substance comes forward
  ramp('cell_shell', a + 10.5, a + 14, 0, 1); ramp('cell_dots', a + 12, a + 16, 0, 1);   // 11 the cell, its rooms, its proteins
  ramp('cell_note', a + 15.5, a + 17, 0, 1); ramp('cell_note', a + 23, a + 24.5, 1, 0);
  ramp('cell_thr', a + 19, a + 26, 0, 0.3); ramp('cell_thr', a + 26, a + 33, 0.3, 1);     // 19 the threads in waves; 26 all of them
  ramp('cell_many', a + 36, a + 43, 0, 1);                                // 36 the collection: many substances at once
  ramp('cell_many', a + 46.5, a + 48.5, 1, 0); ramp('cell_thr', a + 46.5, a + 48.5, 1, 0); ramp('cell_sp', a + 46.5, a + 48.5, 1, 0);
  jump('cell_gene', a + 48, -1, casp3);                                    // 49 CASP3, and its substances
  ramp('cell_rev', a + 49.5, a + 57, 0, 1);
  ramp('cell_two', a + 59, a + 61, 0, 1);                                  // 59 two substances, the same genes?
  cam(a + 1, 'cell', 'come');
  cam(a + 9, 'cell', 'come', 6);
  cam(a + 14, 'cell', 'default', 0);
  cam(a + 24, 'cell', 'close', 12);
  cam(a + 34, 'cell', 'close', 20, 'spin');
  cam(a + 41, 'cell', 'wide', 30);
  cam(a + 47, 'cell', 'wide', 38, 'spin');
  cam(a + 53, 'cell', 'rev', 50);
  cam(b - 0.4, 'cell', 'rev', 70, 'spin');
  sfxCue(a + 19, 'whoosh', 'cell', 'substance', { dur: 1.2, pitch: 0.9 });
  sfxCue(a + 49, 'step', 'cell', 'casp3');

  // ------------------------------------------------------------ centre: the interactome out of the cell, sorted; the four patterns; hazard
  a = C.centre.a; b = C.centre.b;
  jump('cell_gene', a, casp3, -1); key('cell_rev', a, 0); key('cell_two', a, 0); key('cell_sp', a, 0); key('cell_thr', a, 0); key('cell_dots', a, 0); key('cell_shell', a, 1);
  show('cell', a, a + 1.2, a + 13, a + 17);                               // 1.5 back in the cell (its rooms)
  show('ppi', a + 0.3, a + 1.5);                                          // its proteins, and their contacts
  ramp('ppi_links', a + 3, a + 9, 0, 1);
  ramp('ppi_sort', a + 13, a + 21, 0, 1);                                 // 13 out of the cell, sorted
  ramp('ppi_tags', a + 17, a + 19, 0, 1); ramp('ppi_tags', a + 22, a + 23, 1, 0);
  ramp('ppi_links', a + 21, a + 23, 1, 0.45);
  // 23, 31, 37, 43: the four patterns, an example each
  const PT = [23, 31, 37, 43];
  PT.forEach((s, k) => {
    const t = a + s, ex = PATS[k] ? PATS[k].sub : -1;
    jump('ppi_pat', t, k - 1, k); jump('ppi_sub', t, k ? (PATS[k - 1] || {}).sub : -1, ex);
    jump('ppi_hl', t, k ? 1 : 0, 0); ramp('ppi_hl', t, t + 1.6, 0, 1);
    sfxCue(t, 'step', 'ppi', 'sub');
  });
  ramp('ppi_hl', a + 51.5, a + 53, 1, 0);
  jump('ppi_pat', a + 53, 3, -1); jump('ppi_sub', a + 53, (PATS[3] || {}).sub, -1);
  ramp('ppi_haz', a + 53, a + 58, 0, 1); ramp('ppi_links', a + 53, a + 56, 0.45, 0.25);   // 53 the hazard flares
  label('ppi', 'core', '<b>Brightest in the middle</b> · the most harmful, on average', a + 62.5, a + 70, 'amb');
  ramp('ppi_haz', a + 70, a + 71.5, 1, 0.3);                                 // 71 a pull at the edge, then in the middle
  jump('ppi_rip', a + 71, 0, 1); ramp('ppi_ripple', a + 71.5, a + 75, 0, 1);
  jump('ppi_rip', a + 75.2, 1, 0); jump('ppi_ripple', a + 75.2, 1, 0); ramp('ppi_ripple', a + 75.4, a + 80, 0, 1);
  cam(a + 0.2, 'cell', 'default', 0);
  cam(a + 0.6, 'ppi', 'cell', 0);
  cam(a + 12, 'ppi', 'cell', 10, 'spin');
  cam(a + 21, 'ppi', 'default', 25);
  cam(a + 52, 'ppi', 'default', 70, 'spin');
  cam(a + 61, 'ppi', 'core', 85);
  cam(a + 69, 'ppi', 'core', 100, 'spin');
  cam(a + 72, 'ppi', 'default', 110);
  cam(b, 'ppi', 'default', 125, 'spin');
  sfxCue(a + 13, 'whoosh', 'ppi', 'centre', { dur: 1.4 });
  sfxCue(a + 75.4, 'whoosh', 'ppi', 'centre', { dur: 0.9, pitch: 1.3 });

  // ------------------------------------------------------------ disease: asthma's neighbourhood, ozone, the steps; many pairs
  a = C.disease.a; b = C.disease.b;
  ramp('ppi_haz', a, a + 1.5, 0.3, 0); key('ppi_ripple', a, 1); ramp('ppi_links', a, a + 2, 0.25, 0.2);
  jump('ppi_dis', a + 1.5, -1, asthma); ramp('ppi_dhl', a + 1.5, a + 3.5, 0, 1); ramp('ppi_gat', a + 2.5, a + 7, 0, 1);   // 1.5 asthma's genes, a neighbourhood
  jump('ppi_sub', a + 9, -1, E.ozone); key('ppi_hl', a + 9, 0); ramp('ppi_hl', a + 9, a + 11, 0, 0.45);                  // 9 the steps from a substance's targets
  ramp('ppi_paths', a + 9.5, a + 16, 0, 1);
  ramp('ppi_hl', a + 17, a + 18.5, 0.45, 1);                                                                             // 17 ozone, named
  const pa = GL.sets.ppi.anchors, ga = GL.sets.globe.anchors;
  label('ppi', () => { const p = pa.sub(), q = pa.knot(); return [0.65 * p[0] + 0.35 * q[0], 0.65 * p[1] + 0.35 * q[1] + 0.06, 0.65 * p[2] + 0.35 * q[2]]; }, `<b>z = ${f2(E.ozoneAsthma.z)}</b> · far closer than chance`, a + 18, a + 30, 'amb');
  ramp('ppi_hl', a + 30, a + 32, 1, 0); ramp('ppi_dhl', a + 30, a + 32, 1, 0); ramp('ppi_paths', a + 30, a + 32, 1, 0);
  jump('ppi_sub', a + 32.5, E.ozone, -1); jump('ppi_dis', a + 32.5, asthma, -1);
  ramp('ppi_pairs', a + 31, a + 35, 0, 1);                                                                               // 31 sixty million pairs
  cam(a + 1, 'ppi', 'default', 125);
  cam(a + 5, 'ppi', 'asthma');
  cam(a + 16, 'ppi', 'asthma', 10, 'spin');
  cam(a + 29, 'ppi', 'asthma', 18, 'spin');
  cam(a + 34, 'ppi', 'default', 30);
  cam(b, 'ppi', 'default', 70, 'spin');
  sfxCue(a + 1.5, 'step', 'ppi', 'knot');
  sfxCue(a + 17, 'step', 'ppi', 'sub');

  // ------------------------------------------------------------ europe: the globe turned to Europe, the countries, Italy and endrin, the columns
  a = C.europe.a; b = C.europe.b;
  ramp('ppi_pairs', a, a + 2, 1, 0); ramp('ppi_shrink', a + 0.5, a + 3.6, 0, 1); ramp('ppi_a', a + 2.8, a + 3.8, 1, 0);   // 1.5 the interactome shrinks to a point
  show('globe', a + 2.6, a + 5);
  ramp('globe_turn', a + 3, a + 9.5, 0, 1);
  ramp('globe_marks', a + 9, a + 11, 0, 1); ramp('globe_subs', a + 10, a + 17, 0, 1);                                    // 9 the countries, their substances
  jump('globe_country', a + 18, -1, italy);                                                                               // 18 Italy
  jump('globe_sub', a + 21, -1, E.endrin);                                                                                // endrin
  ramp('globe_threads', a + 26, a + 33, 0, 1);                                                                            // 26 threads down to its close diseases
  const gb = E.endrinItaly.gbd['Colon and rectum cancer'];
  label('globe', () => { const p = ga.italy(); return [p[0] - 0.03, p[1] + 0.09, p[2]]; }, `<b>Colon and rectum cancer</b> ${f2(gb[0])}× the world's rate, ${f2(gb[1])}× western Europe's`, a + 35, a + 48, 'amb');
  ramp('globe_threads', a + 48, a + 50, 1, 0);
  jump('globe_sub', a + 50, E.endrin, -1); jump('globe_country', a + 50, italy, -1);
  ramp('globe_close', a + 57, a + 61, 0, 1);                                                                              // 58 close against distant
  ramp('globe_close', a + 73.5, a + 75.5, 1, 0); ramp('globe_subs', a + 73, a + 76, 1, 0); ramp('globe_cols', a + 75, a + 81, 0, 1);   // 75 the scores
  cam(a, 'ppi', 'default', 70);
  cam(a + 2.6, 'globe', 'far', -30);
  cam(a + 9.5, 'globe', 'default', 0);
  cam(a + 16.5, 'globe', 'default', 6, 'spin');
  cam(a + 21.5, 'globe', 'italy');
  cam(a + 47, 'globe', 'italy', 6, 'spin');
  cam(a + 52, 'globe', 'wide', 0);
  cam(a + 74, 'globe', 'wide', 8, 'spin');
  cam(a + 79, 'globe', 'cols', 0);
  cam(b - 0.3, 'globe', 'cols', 10, 'spin');
  sfxCue(a + 1, 'whoosh', 'globe', 'centre', { dur: 2.2, pitch: 0.8 });
  sfxCue(a + 18, 'step', 'globe', 'italy');
  sfxCue(a + 26, 'whoosh', 'globe', 'italy', { dur: 0.9, pitch: 1.2 });

  // ------------------------------------------------------------ end: out through the scales (the globe goes, the interactome passes by small)
  a = C.end.a;
  ramp('globe_a', a + 0.5, a + 4.5, 1, 0);
  key('ppi_shrink', a + 2.5, 0.55); ramp('ppi_shrink', a + 2.5, a + 7.5, 0.55, 0.3); key('ppi_sort', a + 2.5, 1); key('ppi_links', a + 2.5, 0.5);
  show('ppi', a + 2.5, a + 3.6, a + 6.2, a + 8);
  cam(a + 0.5, 'globe', 'cols', 10);
  cam(a + 4, 'globe', 'far', 20);
  cam(a + 4.6, 'ppi', 'default', 40);
  cam(a + 7.8, 'ppi', 'default', 60, 'spin');
  sfxCue(a + 1, 'whoosh', 'globe', 'centre', { dur: 2, pitch: 0.7 });
}
