//#use head VC vfont cssColor rr wrapLines textBlock fitText fitTitle vButton swatch makePanel panelDepth panelTick
//#use panelPaint FADE FADECV panelFade panelSend panelPatch
//#use sigMain
// the story's own part of the main panel's signature (sigMain): '' (nothing beyond the chapter and its lines)
const sigMainS = () => '';
// explore mode in the main panel's signature: everything its panes show (drawn again only when this changes)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), statsLine(), readingLine(), X.pp, X.pc, X.ties, pickLine(), kindsLine()].join('|');
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
  ({ scenes: drawScenesPane, pick: drawPickPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
//#use flow head~2 vSlider stats
// the scenes, and the chosen scene's own controls (renderScenes' twin)
function drawScenesPane(ctx, P, x, y, W, bottom) {
  if (SCENES.length > 1) {
    const cw = (W - 12 * (SCENES.length - 1)) / SCENES.length;
    SCENES.forEach(([k, n], j) => vButton(ctx, P, 'scene:' + k, x + j * (cw + 12), y, cw, 56, SCENE_SHORT[k] || n, () => openScene(k), { on: X.scene === k, px: 22 }));
    y += 76;
  }
  const sc = SCENES.find(s => s[0] === X.scene);
  y += textBlock(ctx, sc[2], x, y, W, 25, 35, VC.muted, 400, 4) + 12;
  y += textBlock(ctx, statsLine(), x, y, W, 23, 32, VC.ink, 400, 4) + 8;
  y += textBlock(ctx, readingLine(), x, y, W, 23, 32, VC.muted, 400, 4) + 18;
  for (const c of ctlsOf(X.scene).filter(c => ctlShown(X.scene, c))) {
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => setCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
}

// the places to pick and what the pick shows (renderPick's twin)
function drawPickPane(ctx, P, x, y, W, bottom) {
  y += textBlock(ctx, 'Point at a dot and press to pick a protein and see all its links, or pick a place. The same again lets go.', x, y, W, 25, 35, VC.muted, 400, 3) + 16;
  const names = api('cell').places || [];
  y += flow(ctx, P, names.map((n, k) => ({ id: 'place:' + k, label: n, on: X.pc === k, fn: () => setPick(-1, k, true) })), x, y, W, bottom, { px: 23, h: 52 }) + 18;
  y += textBlock(ctx, pickLine(), x, y, W, 24, 33, VC.ink, 400, 7) + 12;
  if (kindsLine()) y += textBlock(ctx, kindsLine(), x, y, W, 22, 31, VC.muted, 400, 3) + 18;
  if ((X.pp >= 0 || X.pc >= 0) && y + 56 < bottom) { vButton(ctx, P, 'pick:clear', x, y, 180, 56, 'Clear', () => setPick(-1, -1, false), { px: 22 }); y += 76; }
  // the Copies switch (renderPick's twin)
  if (y + 110 > bottom) return;
  ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText('Copies', x, y);
  y += 36;
  y += flow(ctx, P, [[1, 'On'], [0, 'Off']].map(([v, n]) => ({ id: 'copies:' + v, label: n, on: X.ties === v, fn: () => setTies(v, true) })), x, y, W, bottom, { px: 24, h: 56 }) + 14;
  if (y + 60 < bottom) textBlock(ctx, COPIES_TEXT, x, y, W, 22, 31, VC.muted, 400, 2);
}
//#use sigFoot drawFoot drawFootX
