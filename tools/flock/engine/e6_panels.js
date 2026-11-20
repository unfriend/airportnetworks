//#use head VC vfont cssColor rr wrapLines textBlock fitText fitTitle vButton swatch makePanel panelDepth panelTick
//#use panelPaint FADE FADECV panelFade panelSend panelPatch
//#use sigMain
const sigMainS = () => '';
// explore mode in the main panel's signature (sigMain)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), X.scene, JSON.stringify(X.ctl[X.scene] || {}), GL.sets.flock.falcons()].join('|');
}
const XR_HERE = 'flock';
const XR_TITLE = 'Flock';
// the story's points (ul.steps) on the headset's panel (drawStoryEl): lines at most, and the colour of one without
// its own
const XR_STEP_LINES = 3, XR_STEP_COL = 'var(--amber)';
//#use XR_STORIES XR_LAND xrLandingSetup xrLandingCards xrLandingClose drawLandHead drawLandCard drawStoriesPane
//#use drawMain
const xrHint = () => (HOST.anchor.on ? 'Trigger (or pinch): use buttons. Anchored: to move things, use Place again in the menu.' : 'Trigger (or pinch): use buttons, or point at the sky to send a falcon. Grip: ' + (XR.free ? 'move and turn' : 'move') + ' this panel.');

//#use STY storyOpacity FADEB drawStoryPane drawStoryEl
// explore: the flock's pane, mirroring the HTML one
function drawExplorePane(ctx, P, x, y, W) {
  const sc = SCENES[0], s = GL.sets.flock, busy = s.full();
  ctx.font = vfont(30, 700); ctx.fillStyle = VC.ink; ctx.fillText(sc[1], x, y);
  y += 50;
  y += textBlock(ctx, 'Starlings at dusk, all around you. Each bird follows the seven nearest to it. Point at the sky and pull the trigger to send a falcon.', x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  const bottom = P.h - 34;
  for (const c of s.controls || []) {
    if (c.key === 'view') continue;   // in a headset you look around yourself
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    let bx = x, by = y;
    ctx.font = vfont(24);
    for (const [v, n] of c.options) {
      const w = Math.max(110, ctx.measureText(n).width + 40);
      if (bx + w > x + W) { bx = x; by += 66; }
      vButton(ctx, P, 'ctl:' + c.key + ':' + v, bx, by, w, 56, n, () => setCtl(X.scene, c.key, v), { on: ctlValue(X.scene, c) === v, px: 24 });
      bx += w + 10;
    }
    y = by + 80;
  }
  if (y + 60 < bottom) vButton(ctx, P, 'falcon', x, y, 300, 60, busy ? 'Four falcons already' : 'Send a falcon', () => sendFalcon(null), { px: 24, on: busy });
}
//#use sigFoot~2
//#use drawFoot
// explore mode's footer (drawFoot)
function drawFootX(ctx, P) {
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText('The flock flies on for as long as you stay.', 28, 58);
}


// ------------------------------------------------------------- narration --
