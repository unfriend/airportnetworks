//#use head VC vfont cssColor rr wrapLines textBlock fitText fitTitle vButton swatch makePanel panelDepth panelTick
//#use panelPaint FADE FADECV panelFade panelSend panelPatch
//#use sigMain
// the story's own part of the main panel's signature (sigMain): '' (nothing beyond the chapter and its lines)
const sigMainS = () => '';
// explore mode in the main panel's signature: everything its panes show (drawn again only when this changes)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), readLine(), whatLine(), cullLine(), !!(api('crowds').held && api('crowds').held())].join('|');
}
// the station's story (slideshow, sound effects, shared rooms) and the panel's title: story.json's
const XR_HERE = KEY;
const XR_TITLE = (pkgMeta() || {}).title || KEY;
// the story's points (ul.steps) on the headset's panel (drawStoryEl): lines at most, and the colour of one without
// its own
const XR_STEP_LINES = 4, XR_STEP_COL = 'var(--amber)';
const FLOW_BOLD = true;
//#use XR_STORIES XR_LAND xrLandingSetup xrLandingCards xrLandingClose drawLandHead drawLandCard drawStoriesPane
//#use xrHint drawMain

//#use STY storyOpacity FADEB drawStoryPane drawStoryEl
//#use drawExplorePane
// explore mode's pane for each tab (drawExplorePane): the headset's twin of each render* in e4_explore.js
function drawTabPane(ctx, P, x, y, W, bottom) {
  ({ scenes: drawScenesPane, cull: drawCullPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
//#use flow head~2 vSlider stats
// a tab's controls (ctlRows' twin): each a row, its name on the left and its options as chips beside it
function drawCtlRows(ctx, P, tab, x, y, W, bottom) {
  const L = 250;
  for (const c of ctlsOf(X.scene).filter(c => ctlShown(X.scene, c) && (c.tab === 'cull') === (tab === 'cull'))) {
    if (y + 52 > bottom) break;
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, c.label, L - 14), x, y + 14);
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => setCtl(X.scene, c.key, v) })), x + L, y, W - L, bottom, { px: 22, h: 50 }) + 12;
  }
  return y;
}
// the balls: the read-out, what is in the scene and the controls (renderScenes' twin)
function drawScenesPane(ctx, P, x, y, W, bottom) {
  y += textBlock(ctx, readLine(), x, y, W, 23, 31, VC.ink, 400, 4) + 8;
  y += textBlock(ctx, whatLine(), x, y, W, 21, 29, VC.muted, 400, 3) + 14;
  drawCtlRows(ctx, P, 'scenes', x, y, W, bottom);
}
// the culling: the read-out, what each switch leaves out, the switches and Hold (renderCull's twin)
function drawCullPane(ctx, P, x, y, W, bottom) {
  y += textBlock(ctx, readLine(), x, y, W, 23, 31, VC.ink, 400, 4) + 8;
  y += textBlock(ctx, cullLine(), x, y, W, 21, 29, VC.muted, 400, 4) + 14;
  y = drawCtlRows(ctx, P, 'cull', x, y, W, bottom);
  if (y + 52 > bottom) return;
  const held = !!(api('crowds').held && api('crowds').held());
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText('Hold the culling', x, y + 14);
  y += flow(ctx, P, [{ id: 'hold:1', label: 'Hold here', on: held, fn: () => setHold(true) }, { id: 'hold:0', label: 'Follow me', on: !held, fn: () => setHold(false) }], x + 250, y, W - 250, bottom, { px: 22, h: 50 }) + 12;
  if (y + 30 < bottom) textBlock(ctx, 'Held, the cells are judged from where you were: walk or turn away and see what is left out. Yours alone.', x, y, W, 21, 29, VC.muted, 400, 2);
}

//#use sigFoot drawFoot drawFootX
