// ================================================== HEADSET PANES: WORLD ==
// Builder C's panes on the headset's panel: the twins of renderDiseases and renderCountries (e4c_world.js), kept in
// step. STUB (builder A).
function drawDiseasesPane(ctx, P, x, y, W, bottom) {
  textBlock(ctx, 'Find a disease: its neighbourhood in the interactome and the substances close to it.', x, y, W, 25, 35, VC.muted, 400, 4);
}
function drawCountriesPane(ctx, P, x, y, W, bottom) {
  textBlock(ctx, 'A country\'s elevated releases and the diseases close to them.', x, y, W, 25, 35, VC.muted, 400, 4);
}
