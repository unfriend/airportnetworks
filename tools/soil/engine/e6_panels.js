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
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.mod, X.rho, X.shuf, X.kind, X.plot, XR.on].join('|');
}
const XR_HERE = 'soil';
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
  fitTitle(ctx, 'Holding on to nitrogen', 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
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
  ({ field: drawFieldPane, nitrogen: drawNitrogenPane, microbes: drawMicrobesPane, network: drawNetworkPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
//#use flow head~2 vSlider stats~2 numRow footNote
// the explore panes' canvas twins (Field, Nitrogen, Microbes, Network, Scenes): the same choices and numbers as the HTML
// panes (renderField and the others in e4_explore.js); keep both twins in step
// (the chips of a control of a scene; cols(o) a swatch's colour)
const ctlChips = (k, key, cols, onIf) => ctlOf(k, key).options.map(([o, n]) => ({ id: k + ':' + key + ':' + o, label: n, col: cols ? cols(o) : null,
  on: (onIf ? onIf() : true) && ctlValue(k, ctlOf(k, key)) === o, fn: () => sceneCtl(k, key, o) }));
function drawFieldPane(ctx, P, x, y, W, bottom) {
  const on = X.scene === 'field', I = fieldInfo(), o = { px: 21, h: 44 };
  y += textBlock(ctx, `The trial's ${FACTS.plots} plots: two wheats, three regimes, ${word(FACTS.reps)} plots of each. Point at a plot and pull the trigger to pick its group.`, x, y, W, 23, 32, VC.muted, 400, 2) + 8;
  y += head(ctx, x, y, 'Date');
  y += flow(ctx, P, ctlChips('field', 'date'), x, y, W, bottom, o) + 8;
  y += head(ctx, x, y, 'Show');
  y += flow(ctx, P, ctlChips('field', 'show').map(c => Object.assign(c, { fn: () => pickShow(c.id.split(':')[2]) })), x, y, W, bottom, o) + 8;
  y += head(ctx, x, y, 'Wheat and regime');
  y += flow(ctx, P, ctlChips('field', 'line', v => (v === '0' ? LINE_COL[0] : v === '1' ? LINE_COL[1] : null)).concat(
    ctlChips('field', 'fert', v => (v === 'all' ? null : FERT_COL[+v]))), x, y, W, bottom, o) + 8;
  y += head(ctx, x, y, 'View');
  y += flow(ctx, P, ctlChips('field', 'view', null, () => on).map(c => Object.assign(c, { fn: () => showView('field', c.id.split(':')[2]) })), x, y, W, bottom, o) + 12;
  y += textBlock(ctx, I.head, x, y, W, 26, 34, VC.ink, 700, 1) + 2;
  y += textBlock(ctx, I.sub, x, y, W, 21, 28, VC.muted, 400, 1) + 6;
  y += stats(ctx, x, y, W, I.rows) + 6;
  if (I.jars) { y += head(ctx, x, y, 'The jars\' peaks (read off the slides): BNI · control'); y += stats(ctx, x, y, W, I.jars) + 6; }
  if (I.pick && y + 140 < bottom) {
    y += textBlock(ctx, I.pick.head, x, y, W - 140, 25, 34, I.pick.col, 700, 1) + 4;
    vButton(ctx, P, 'plot:none', x + W - 120, y - 44, 120, 40, 'None', () => selectPlot(-1), { px: 20, r: 6 });
    y += stats(ctx, x, y, W, I.pick.rows) + 6;
  }
  footNote(ctx, NOTE.field(fieldShow()), x, y, W, bottom);
}
function drawNitrogenPane(ctx, P, x, y, W, bottom) {
  const on = X.scene === 'soil';
  y += textBlock(ctx, 'A sketch, not data: the soil block with fertiliser, the BNI wheat\'s roots and the synthetic inhibitor. Switch them, and watch where the nitrogen goes.', x, y, W, 24, 34, VC.muted, 400, 3) + 14;
  for (const c of ctlsOf('soil')) {
    y += head(ctx, x, y, c.label);
    y += flow(ctx, P, ctlChips('soil', c.key, null, () => c.key !== 'view' || on), x, y, W, bottom, { px: 23, h: 54 }) + 14;
  }
  y += flow(ctx, P, [{ id: 'replay', label: 'Replay the flows', fn: () => { X.t0 = performance.now(); } }], x, y, W, bottom, { px: 23, h: 54 }) + 18;
  footNote(ctx, NOTE.nitrogen, x, y, W, bottom);
}
function drawMicrobesPane(ctx, P, x, y, W, bottom) {
  const col = ctlv('net', 'colour'), K2 = kindInfo();
  y += textBlock(ctx, `About ${thousands(FACTS.kinds)} kinds of microbe as a cloud: the ${fmt(FACTS.common)} common ones (${pct(FACTS.readShare)} of the reads) in its core. Point at a kind and pull the trigger to pick it.`, x, y, W, 23, 32, VC.muted, 400, 3) + 10;
  y += head(ctx, x, y, 'Colour');
  y += flow(ctx, P, [['phylum', 'Phylum'], ['guild', 'Nitrifiers']].map(([o, n]) => ({ id: 'col:' + o, label: n, on: col === o, fn: () => sceneCtl('net', 'colour', o) }))
    .concat([{ id: 'crowd', label: 'The crowd', on: X.scene === 'net' && netView() === 'cloud', fn: () => showView('net', 'cloud') }]), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  y += head(ctx, x, y, 'The nitrifiers\' share of reads: not fertilised · fertilised · + DCD');
  ctx.font = vfont(21);
  for (const [n, v, more] of guildRows()) {
    if (y + 60 > bottom) break;
    ctx.font = vfont(22, 700); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, n, W * 0.48), x, y);
    ctx.font = vfont(22); ctx.fillText(v, x + W * 0.5, y);
    ctx.font = vfont(19); ctx.fillStyle = VC.muted; ctx.fillText(more, x + W * 0.5, y + 27);
    y += 58;
  }
  y += 8;
  if (K2) {
    y += textBlock(ctx, K2.head, x, y, W - 140, 26, 34, VC.cyan, 700, 1) + 4;
    vButton(ctx, P, 'kind:none', x + W - 120, y - 44, 120, 40, 'None', () => selectKind(-1), { px: 20, r: 6 });
    y += stats(ctx, x, y, W, K2.rows) + 8;
  } else y += textBlock(ctx, 'No kind picked.', x, y, W, 22, 30, VC.muted, 400, 1) + 8;
  footNote(ctx, NOTE.microbes, x, y, W, bottom);
}
function drawNetworkPane(ctx, P, x, y, W, bottom) {
  const col = ctlv('net', 'colour'), M = X.mod >= 0 ? moduleInfo(X.mod) : null, o = { px: 22, h: 48 };
  y += textBlock(ctx, `The ${fmt(FACTS.nodes)} kinds that rise and fall together across the ${FACTS.samples} samples. Pick a module to light the plots where it thrives.`, x, y, W, 23, 32, VC.muted, 400, 2) + 8;
  y += head(ctx, x, y, 'Colour');
  y += flow(ctx, P, [['module', 'Module'], ['phylum', 'Phylum'], ['guild', 'Nitrifiers']].map(([v, n]) => ({ id: 'col:' + v, label: n, on: col === v, fn: () => sceneCtl('net', 'colour', v) })), x, y, W, bottom, o) + 8;
  y += head(ctx, x, y, 'Module');
  y += flow(ctx, P, BIG.map(m => ({ id: 'mod:' + m, label: `${m + 1}`, col: SLOOK.module(m), on: X.mod === m, fn: () => selectModule(m) }))
    .concat([{ id: 'mod:prev', label: '‹', fn: () => stepModule(-1) }, { id: 'mod:next', label: '›', fn: () => stepModule(1) }, { id: 'mod:none', label: 'None', on: X.mod < 0, fn: () => selectModule(-1) }]), x, y, W, bottom, o) + 8;
  if (M) { y += textBlock(ctx, M.head, x, y, W, 25, 33, M.col, 700, 1) + 2; y += stats(ctx, x, y, W, M.rows, 170) + 4; }
  y += numRow(ctx, P, 'rho', x, y, W);
  y += flow(ctx, P, [{ id: 'shuf', label: X.shuf ? 'Unshuffle' : 'Shuffle the samples', on: !!X.shuf, fn: () => setShuffle(!X.shuf) }], x, y, W, bottom, o) + 8;
  y += head(ctx, x, y, 'Split by');
  y += flow(ctx, P, SPLIT_OPTS.map(([v, n]) => ({ id: 'split:' + v, label: n, on: splitNow() === v, fn: () => setSplit(v) })), x, y, W, bottom, o) + 8;
  y += stats(ctx, x, y, W, netInfo().rows, 200) + 6;
  footNote(ctx, NOTE.network, x, y, W, bottom);
}
//#use drawScenesPane sigFoot drawFoot