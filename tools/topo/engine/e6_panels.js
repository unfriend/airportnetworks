//#use head VC vfont cssColor rr wrapLines textBlock fitText fitTitle vButton swatch makePanel panelDepth panelTick
//#use panelPaint FADE FADECV panelFade panelSend panelPatch
// ------------------------------------------------------------ main panel --
function sigMain() {
  if (XR.stories) return 'stories' + audioLabel();
  if (APP.mode === 'story') {
    const it = ST.items.find(x => x.ch === curCh);
    let s = 's' + audioLabel() + xrSig() + (HOST.room && HOST.room.inRoom() ? 'r' + HOST.room.gripHint : '') + (curCh ? curCh.key : '');
    if (it) {
      for (const g of it.grow) s += Math.round(Math.max(0, g.s) * 6);
      if (curCh.key === 'title') s += $('#titleArc').getAttribute('stroke-dashoffset').slice(0, 3) + $('#titleDot').getAttribute('opacity').slice(0, 3);
      s += '\u0001';   // what follows is the text fades alone: panelFade draws only the bands that moved
      for (const e of it.els) s += Math.round(Math.max(0, e.o) * 3);
    }
    return s;
  }
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.r, X.mr, X.slide, X.from, X.to, X.cell, TDATA.localReady, XR.on].join('|');
}
const XR_HERE = 'topo';
//#use XR_STORIES XR_LAND xrLandingSetup xrLandingCards xrLandingClose drawLandHead drawLandCard drawStoriesPane
function drawMain(ctx, P) {
  const story = APP.mode === 'story';
  let x = P.w - 36;
  const hb = (id, label, fn, w, o) => { x -= w; vButton(ctx, P, id, x, 26, w, 54, label, fn, o); x -= 12; };
  // (Exit is on the shell's Shared panel, at hand on the left controller)
  if (AUD && AUD.state !== 'none') hb('sound', audioLabel(), () => audioToggle(), 180, { on: AUD.on(), px: 23 });
  if (!HOST.anchor.on) hb('recenter', 'Recenter', xrRecenterAsk, 140); // anchored: nothing moves
  // in a shared room no Stories button: each station keeps its story, and another story is another station (walk into
  // its circle)
  if (!(HOST.room && HOST.room.placing()) && !xrRoomOnly()) hb('stories', 'Stories', () => { XR.stories = true; XR.kbd.open = false; APP.playing = false; }, 130);
  else if (xrAllHere() && !XR.stories) hb('stories', 'Stories', () => HOST.room.allBack(), 130);   // (an All stories circle: back to its cards, for everyone there)
  if (!XR.stories) hb('mode', story ? 'Explore now' : 'Replay story', () => (story ? APP.enterExplore() : APP.enterStory(0)), 186, { primary: story });
  // the story's name, smaller when the buttons leave it less room
  fitTitle(ctx, 'The shape of tissue', 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, HOST.room && HOST.room.inRoom() ? HOST.room.gripHint : HOST.anchor.on ? 'Trigger (or pinch): use buttons. Anchored: to move things, use Place again in the menu.' : XR.free ? 'Trigger (or pinch): use buttons. Grip: hold the scene or this panel to move and turn it; both grips on the scene resize it.' : 'Trigger (or pinch): use buttons. Grip: move the scene or this panel; both grips on the scene resize it.', 44, P.h - 74, P.w - 88, 22, 30, VC.faint);
  } else drawExplorePane(ctx, P, 40, 120, P.w - 80);
}

//#use STY storyOpacity FADEB drawStoryPane drawStoryEl
// explore: tabs and panes mirroring the HTML ones
function drawExplorePane(ctx, P, x, y, W) {
  const tw = W / TABS.length;
  TABS.forEach(([k, n], j) => {
    const on = X.tab === k, tx = x + j * tw, hov = P.hover === 'tab:' + k;
    if (hov && !on) { rr(ctx, tx + 4, y, tw - 8, 62, 8); ctx.fillStyle = VC.chip; ctx.fill(); }
    ctx.font = vfont(24, on ? 700 : 400); ctx.fillStyle = on ? VC.ink : VC.muted;
    ctx.textAlign = 'center'; ctx.fillText(n, tx + tw / 2, y + 18); ctx.textAlign = 'left';
    if (on) { ctx.fillStyle = VC.cyan; ctx.fillRect(tx + 10, y + 58, tw - 20, 4); }
    P.regions.push({ id: 'tab:' + k, x: tx, y, w: tw, h: 64, fn: () => pickTab(k) });
  });
  ctx.fillStyle = VC.line; ctx.fillRect(x, y + 62, W, 2);
  y += 88;
  const bottom = P.h - 34;
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
//#use drawScenesPane sigFoot drawFoot