// ============================================== HEADSET PANES: SUBSTANCES ==
// Builder B's panes on the headset's panel: the twins of renderSubstances and renderGroups (e4b_substances.js), kept in
// step. STUB (builder A).
function drawSubstancesPane(ctx, P, x, y, W, bottom) {
  textBlock(ctx, 'Find a substance and follow its threads: its genes, its group, the diseases close to it.', x, y, W, 25, 35, VC.muted, 400, 4);
}
function drawGroupsPane(ctx, P, x, y, W, bottom) {
  textBlock(ctx, 'The communities at three levels, each with what its genes do.', x, y, W, 25, 35, VC.muted, 400, 4);
}
