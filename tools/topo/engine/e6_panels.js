//#use head VC vfont cssColor rr wrapLines textBlock fitText fitTitle vButton swatch makePanel panelDepth panelTick
//#use panelPaint FADE FADECV panelFade panelSend panelPatch
//#use sigMain
const sigMainS = () => '';
// explore mode in the main panel's signature (sigMain)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.r, X.mr, X.slide, X.from, X.to, X.cell, TDATA.localReady, XR.on].join('|');
}
const XR_HERE = 'topo';
const XR_TITLE = 'The shape of tissue';
// the story's points (ul.steps) on the headset's panel (drawStoryEl): lines at most, and the colour of one without
// its own
const XR_STEP_LINES = 4, XR_STEP_COL = 'var(--amber)';
const FLOW_BOLD = true;
//#use XR_STORIES XR_LAND xrLandingSetup xrLandingCards xrLandingClose drawLandHead drawLandCard drawStoriesPane
//#use xrHint drawMain

//#use STY storyOpacity FADEB drawStoryPane drawStoryEl
//#use drawExplorePane
// explore mode's pane for each tab (drawExplorePane)
function drawTabPane(ctx, P, x, y, W, bottom) {
  ({ patch: drawPatchPane, cohort: drawCohortPane, scales: drawScalesPane, cells: drawCellsPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
//#use flow head~2 vSlider stats~2 numRow footNote
const dimChips = () => DIMS.map(([o, n]) => ({ id: 'dim:' + o, label: n, col: o === '1' ? ORANGE : AMBER, on: ctlValue('cohort', ctlOf('cohort', 'dim')) === o, fn: () => sceneCtl('cohort', 'dim', o) }));
function drawPatchPane(ctx, P, x, y, W, bottom) {
  const on = X.scene === 'tower', v = towerView(), lit = ctlValue('tower', ctlOf('tower', 'lit'));
  y += textBlock(ctx, `The poster's patch: ${FACTS.patch} real cells of a healthy liver. Grow the balls; raise the tower to see every radius at once.`, x, y, W, 23, 32, VC.muted, 400, 2) + 10;
  y += numRow(ctx, P, 'r', x, y, W);
  y += flow(ctx, P, SNAP_CHIPS().map(([r, n]) => ({ id: 'r:' + r, label: n, on: Math.abs(X.r - r) < 0.006, fn: () => setR(r) })), x, y, W, bottom, { px: 22, h: 50 }) + 14;
  y += stats(ctx, x, y, W, patchInfo()) + 12;
  y += head(ctx, x, y, 'Show');
  y += flow(ctx, P, ctlOf('tower', 'view').options.map(([o, n]) => ({ id: 'v:' + o, label: n, on: on && v === o, fn: () => showView('tower', o) })), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  y += head(ctx, x, y, 'Lit');
  y += flow(ctx, P, ctlOf('tower', 'lit').options.map(([o, n]) => ({ id: 'lit:' + o, label: n, col: o === 'pieces' ? AMBER : o === 'loops' ? ORANGE : null, on: lit === o, fn: () => sceneCtl('tower', 'lit', o) })), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  // (in a headset the view from below would tip the tower over: stand at it instead)
  y += head(ctx, x, y, 'Look');
  y += flow(ctx, P, LOOKS.filter(([c]) => !(XR.on && c === 'up')).map(([c, n]) => ({ id: 'cam:' + c, label: n, fn: () => { if (X.scene !== 'tower') openScene('tower'); flyTo(view('tower', c)); } })), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  footNote(ctx, NOTE.patch, x, y, W, bottom);
}
function drawCohortPane(ctx, P, x, y, W, bottom) {
  const on = X.scene === 'cohort', v = cohortView(), I = cohortInfo();
  y += textBlock(ctx, `The ${FACTS.slides} slides, ${FACTS.healthy} healthy and ${FACTS.cirrhosis} with cirrhosis: as curves, as points by their scores, by their held-out result. Point at a slide and pull the trigger to pick it.`, x, y, W, 23, 32, VC.muted, 400, 3) + 10;
  y += head(ctx, x, y, 'Curves of');
  y += flow(ctx, P, dimChips(), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  y += head(ctx, x, y, 'Show');
  y += flow(ctx, P, COHORT_VIEWS().map(([o, n]) => ({ id: 'v:' + o, label: n, on: on && v === o, fn: () => showView('cohort', o) })), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  y += stats(ctx, x, y, W, I.rows) + 8;
  y += head(ctx, x, y, 'Slide');
  y += flow(ctx, P, [{ id: 'sl:-1', label: '‹ Previous', fn: () => stepSlide(-1) }, { id: 'sl:1', label: 'Next ›', fn: () => stepSlide(1) }, { id: 'sl:none', label: 'None', on: X.slide < 0, fn: () => selectSlide(-1) }], x, y, W, bottom, { px: 22, h: 50 }) + 12;
  if (I.pick) { y += textBlock(ctx, I.pick.head, x, y, W, 27, 36, VC.ink, 700, 1) + 4; y += stats(ctx, x, y, W, I.pick.rows) + 10; }
  footNote(ctx, NOTE.cohort, x, y, W, bottom);
}
function drawScalesPane(ctx, P, x, y, W, bottom) {
  const I = scalesInfo();
  y += textBlock(ctx, 'The classifier read back as a weight for every radius (red speaks for cirrhosis), and what each stretch of radii adds to the gap between the two groups. Choose a window of radii.', x, y, W, 23, 32, VC.muted, 400, 3) + 10;
  y += head(ctx, x, y, 'Curves of');
  y += flow(ctx, P, dimChips(), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  y += numRow(ctx, P, 'from', x, y, W);
  y += numRow(ctx, P, 'to', x, y, W);
  y += stats(ctx, x, y, W, I.rows) + 10;
  y += head(ctx, x, y, 'What each stretch adds');
  y += stats(ctx, x, y, W, I.ws, 260) + 10;
  footNote(ctx, NOTE.scales, x, y, W, bottom);
}
function drawCellsPane(ctx, P, x, y, W, bottom) {
  const on = X.scene === 'map', s = mapShow(), d = ctlValue('map', ctlOf('map', 'delta')), I = cellsInfo();
  y += textBlock(ctx, `The new slide: a window of ${fmt(FACTS.window)} real cells, each scored by a classifier fitted on the other ${FACTS.train} slides. Point at a cell and pull the trigger.`, x, y, W, 23, 32, VC.muted, 400, 3) + 10;
  y += head(ctx, x, y, 'Show');
  y += flow(ctx, P, ctlOf('map', 'show').options.map(([o, n]) => ({ id: 'v:' + o, label: n, on: on && s === o, fn: () => showView('map', o) })), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  y += head(ctx, x, y, 'Map at');
  y += flow(ctx, P, ctlOf('map', 'delta').options.map(([o, n]) => ({ id: 'd:' + o, label: n, on: d === o, fn: () => sceneCtl('map', 'delta', o) })), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  if (s === 'cell') {
    y += numRow(ctx, P, 'mr', x, y, W);
    y += flow(ctx, P, [{ id: 'cellv', label: 'Cell v', on: X.cell < 0, fn: () => selectCell(-1) }], x, y, W, bottom, { px: 22, h: 50 }) + 12;
    y += textBlock(ctx, I.head, x, y, W, 27, 36, VC.ink, 700, 1) + 4;
    y += stats(ctx, x, y, W, I.rows) + 10;
  } else {
    y += textBlock(ctx, `${fmt(I.sizes[1])} cirrhosis-like and ${fmt(I.sizes[0])} healthy-like cells, at ${mapDelta()} µm.`, x, y, W, 24, 32, VC.ink, 400, 2) + 8;
    y += head(ctx, x, y, 'Cell types (the classifier\'s labels): cirrhosis-like · healthy-like');
    y += stats(ctx, x, y, W, I.piles.map(r => r.slice(0, 2)), 260) + 10;
  }
  footNote(ctx, NOTE.cells(s), x, y, W, bottom);
}
//#use drawScenesPane sigFoot drawFoot drawFootX