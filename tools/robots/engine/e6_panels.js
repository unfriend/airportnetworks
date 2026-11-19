//#use head VC vfont cssColor rr wrapLines textBlock fitText fitTitle vButton swatch makePanel panelDepth panelTick
//#use panelPaint FADE FADECV panelFade panelSend panelPatch
//#use sigMain
const sigMainS = () => updateLive() + (canCapture() ? roomLine() : '');   // (the live gang, and the room line)
// explore mode in the main panel's signature (sigMain)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), X.scene, JSON.stringify(X.ctl[X.scene] || {}), liveLine(), roomLine(), canCapture()].join('|');
}
const XR_HERE = 'robots';
const XR_TITLE = 'Robot gang';
// the story's points (ul.steps) on the headset's panel (drawStoryEl): lines at most, and the colour of one without
// its own
const XR_STEP_LINES = 3, XR_STEP_COL = 'var(--amber)';
//#use XR_STORIES XR_LAND xrLandingSetup xrLandingCards xrLandingClose drawLandHead drawLandCard drawStoriesPane
//#use drawMain
const xrHint = () => (HOST.anchor.on ? 'Trigger (or pinch): use buttons, or point at the floor to spill crumbs. Anchored: to move the panel, use Place again in the menu.' : 'Trigger (or pinch): use buttons, or point at the floor to spill crumbs. Grip: ' + (XR.free ? 'move and turn' : 'move') + ' this panel.');

//#use STY storyOpacity FADEB
function drawStoryPane(ctx, P, x, y, W) {
  const it = ST.items.find(i => i.ch === curCh) || ST.items[0];
  P.fb = [];   // (each element's band of rows and the fades it follows: panelFade)
  for (const el of it.sec.children) { const b = FADEB = { y0: y, y1: y, d: [] }; y = drawStoryEl(ctx, P, el, x, y, W, 1); b.y1 = y; P.fb.push(b); }
  FADEB = null;
  ctx.globalAlpha = 1;
  // a virtual room stands in for yours: say so, and offer the headset's room setup (where there is space for it)
  if (canCapture() && y + 150 < P.h - 110) {
    y += 10 + textBlock(ctx, roomLine(), x, y + 10, W, 24, 33, VC.amber, 400, 2) + 10;
    vButton(ctx, P, 'room:setup', x, y, 320, 56, 'Set up your room', roomCapture, { px: 24 });
  }
}
//#use drawStoryEl


// explore: the gang's pane, mirroring the HTML one (no view control: in a headset you look about yourself),
// with what the headset found of your room
function drawExplorePane(ctx, P, x, y, W) {
  const sc = SCENES[0], s = GL.sets.robots;
  ctx.font = vfont(30, 700); ctx.fillStyle = VC.ink; ctx.fillText(sc[1], x, y);
  y += 50;
  y += textBlock(ctx, 'Robot vacuums on your floor. Point at the floor and pull the trigger to spill crumbs there.', x, y, W, 25, 35, VC.muted, 400, 3) + 14;
  const rl = roomLine();
  if (rl) y += textBlock(ctx, rl, x, y, W, 24, 33, XRR.kind === 'real' ? VC.green : VC.amber, 400, 2) + 10;
  if (canCapture()) { vButton(ctx, P, 'room:setup', x, y, 320, 56, 'Set up your room', roomCapture, { px: 24 }); y += 72; }
  y += 6;
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
  if (y + 60 < bottom) {
    vButton(ctx, P, 'crumbs', x, y, 280, 60, 'Spill crumbs', spillCrumbs, { px: 24, primary: true });
    vButton(ctx, P, 'dust', x + 296, y, 240, 60, 'Dust again', dustAgain, { px: 24 });
    y += 84;
  }
  if (y + 30 < bottom) textBlock(ctx, liveLine(), x, y, W, 24, 33, VC.ink, 400, 1);
}
//#use sigFoot~2
//#use drawFoot
// explore mode's footer (drawFoot)
function drawFootX(ctx, P) {
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText('The gang stays for as long as you do.', 28, 58);
}


// ------------------------------------------------------------- narration --
