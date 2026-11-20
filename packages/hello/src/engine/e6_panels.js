//#use head VC vfont cssColor rr wrapLines textBlock fitText fitTitle vButton swatch makePanel panelDepth panelTick
//#use panelPaint FADE FADECV panelFade panelSend panelPatch
//#use sigMain
// the story's own part of the main panel's signature (sigMain): '' (nothing beyond the chapter and its lines)
const sigMainS = () => '';
// explore mode in the main panel's signature: everything its panes show (drawn again only when this changes)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.a, X.b].join('|');
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
// explore mode's pane for each tab (drawExplorePane): the headset's twin of renderNetwork
function drawTabPane(ctx, P, x, y, W, bottom) { drawNetworkPane(ctx, P, x, y, W, bottom); }
//#use flow head~2 vSlider stats
function drawNetworkPane(ctx, P, x, y, W, bottom) {
  const ch = c => c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue('ring', c) === v, fn: () => sceneCtl('ring', c.key, v) }));
  y += textBlock(ctx, 'Rewire some of the friendships at random, and point at two people on the ring to see the shortest chain of handshakes between them.', x, y, W, 23, 32, VC.muted, 400, 3) + 12;
  y += head(ctx, x, y, 'Rewired links');
  y += flow(ctx, P, ch(ctlOf('ring', 'rw')), x, y, W, bottom, { px: 24, h: 56 }) + 14;
  y += head(ctx, x, y, 'Two people (press on them)');
  y += flow(ctx, P, [{ id: 'who:a', label: 'A: ' + who(X.a), col: CYAN }, { id: 'who:b', label: 'B: ' + who(X.b), col: AMBER },
    { id: 'across', label: 'Across the ring', on: X.a === A0 && X.b === B0, fn: () => setPair(A0, B0) }, { id: 'clear', label: 'Clear', fn: () => setPair(null, null) }], x, y, W, bottom, { px: 22, h: 50 }) + 16;
  y += stats(ctx, x, y, W, statRows()) + 10;
  y += head(ctx, x, y, 'View');
  y += flow(ctx, P, ch(ctlOf('ring', 'view')), x, y, W, bottom, { px: 22, h: 50 }) + 14;
  if (y + 40 < bottom) textBlock(ctx, NOTE, x, y, W, 21, 29, VC.faint, 400, Math.max(1, Math.min(2, Math.floor((bottom - y) / 29))));
}

//#use sigFoot drawFoot drawFootX
