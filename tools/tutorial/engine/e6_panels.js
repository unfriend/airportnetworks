//#use head VC vfont cssColor rr wrapLines textBlock fitText fitTitle vButton swatch makePanel panelDepth panelTick
//#use panelPaint FADE FADECV panelFade panelSend panelPatch
//#use sigMain
const sigMainS = () => (HOLD.on ? 'hold' : '');
// explore mode in the main panel's signature (sigMain)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), JSON.stringify(X.ctl.guide || {}), PR.done.map(Number).join(''), TASKS.map((T, i) => taskWhy(i)).join(','), PR.run, PR.mk,
    HOST.room && HOST.room.inRoom && HOST.room.inRoom() ? 'r' : ''].join('|');
}
const XR_HERE = 'tutorial';
const XR_TITLE = 'Tutorial';
// the story's points (ul.steps) on the headset's panel (drawStoryEl): lines at most, and the colour of one without
// its own
const XR_STEP_LINES = 3, XR_STEP_COL = 'var(--amber)';
//#use XR_STORIES XR_LAND xrLandingSetup xrLandingCards xrLandingClose drawLandHead drawLandCard drawStoriesPane
//#use drawMain
const xrHint = () => (HOST.anchor.on ? 'Trigger (or pinch): use buttons. Anchored: to move things, use Place again in the menu.' : 'Trigger (or pinch): use buttons, or point at a node of the guide’s network. Grip: ' + (XR.free ? 'move and turn' : 'move') + ' this panel.');

//#use STY storyOpacity FADEB drawStoryPane drawStoryEl
// explore: practice's pane, mirroring the HTML one (renderScenes)
function drawExplorePane(ctx, P, x, y, W) {
  const sc = SCENES[0], s = GL.sets.guide, [d, n] = taskCount();
  ctx.font = vfont(30, 700); ctx.fillStyle = VC.ink; ctx.fillText(sc[1], x, y);
  y += 46;
  y += textBlock(ctx, `${sc[2]} ${d} of ${n} done.`, x, y, W, 24, 32, VC.muted, 400, 2) + 14;
  for (let i = 0; i < TASKS.length; i++) {
    const why = taskWhy(i), done = PR.done[i] && !why;
    ctx.globalAlpha = why ? 0.45 : 1;
    rr(ctx, x, y + 2, 30, 30, 7);
    if (done) { ctx.fillStyle = VC.cyan; ctx.fill(); ctx.fillStyle = '#04131c'; ctx.font = vfont(24, 700); ctx.fillText('✓', x + 6, y + 4); }
    else { ctx.lineWidth = 3; ctx.strokeStyle = VC.muted; ctx.stroke(); }
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, `${i + 1}. ${taskName(i)}`, W - 50), x + 46, y);
    ctx.font = vfont(21); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, why ? why[0].toUpperCase() + why.slice(1) : taskHint(i), W - 50), x + 46, y + 33);
    ctx.globalAlpha = 1;
    y += 76;
  }
  y += 6;
  for (const c of s.controls || []) {
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y + 16);
    let bx = x + 150;
    for (const [v, nm] of c.options) {
      vButton(ctx, P, 'ctl:' + c.key + ':' + v, bx, y, 150, 54, nm, () => setCtl(X.scene, c.key, v), { on: ctlValue(X.scene, c) === v, px: 24 });
      bx += 160;
    }
    y += 70;
  }
  vButton(ctx, P, 'signal', x, y, 380, 58, 'Send a signal from the hub', () => sendSignal(0), { primary: true, px: 24 });
  vButton(ctx, P, 'again', x + 392, y, 210, 58, 'Start again', practiceReset, { px: 24 });
  if (!(HOST.room && HOST.room.inRoom && HOST.room.inRoom())) vButton(ctx, P, 'airports', x, y + 70, 380, 58, 'Start the airports story', () => HOST.go('airports'), { px: 24 });
}
// ----------------------------------------------------------- footer panel --
// (explore mode: practice's own bar, so what it shows is in the signature)
function sigFoot() {
  return APP.mode === 'story' ? 's' + Math.floor(APP.t) + APP.playing + (curCh ? curCh.key : '') + slideSig() : 'x' + PR.run + PR.mk;
}
//#use drawFoot
// explore mode's footer: practice's bar, as a story's: the round Play and Pause, the arrows (the marker the guide
// walks to), where it stands
function drawFootX(ctx, P) {
  const bx = 28, by = 40;
  vButton(ctx, P, 'play', bx, by, 96, 96, '', practiceToggle, { r: 48 });
  ctx.fillStyle = VC.ink;
  if (PR.run) { ctx.fillRect(bx + 34, by + 30, 10, 36); ctx.fillRect(bx + 52, by + 30, 10, 36); }
  else { ctx.beginPath(); ctx.moveTo(bx + 38, by + 26); ctx.lineTo(bx + 38, by + 70); ctx.lineTo(bx + 72, by + 48); ctx.closePath(); ctx.fill(); }
  const tri = (cx, cy, dir) => { ctx.beginPath(); ctx.moveTo(cx - 9 * dir, cy - 13); ctx.lineTo(cx - 9 * dir, cy + 13); ctx.lineTo(cx + 9 * dir, cy); ctx.closePath(); ctx.fill(); };
  vButton(ctx, P, 'prev', 140, 52, 78, 72, '', () => practiceStepBy(-1));
  ctx.fillStyle = VC.ink; tri(171, 88, -1); ctx.fillRect(184, 75, 5, 26);
  vButton(ctx, P, 'next', 228, 52, 78, 72, '', () => practiceStepBy(1));
  ctx.fillStyle = VC.ink; tri(262, 88, 1); ctx.fillRect(271, 75, 5, 26);
  ctx.font = vfont(27, 700); ctx.fillStyle = VC.ink; ctx.fillText(markWords(), 344, 58);
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(PR.run ? 'Practice runs. Pause it, or send the guide along the markers.' : 'Paused.', 344, 100);
}


// ------------------------------------------------------------- narration --
