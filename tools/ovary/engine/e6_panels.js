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
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.kind, X.age, X.method].join('|');
}
const XR_HERE = 'ovary';
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
  fitTitle(ctx, 'The aging ovary', 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
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
  ({ objects: drawObjectsPane, age: drawAgePane, methods: drawMethodsPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
// buttons that wrap like the HTML chips: items -> { id, label, on, col, fn }
function flow(ctx, P, items, x, y, W, maxY, o = {}) {
  const px = o.px || 22, h = o.h || 44, gap = 8;
  let cx = x, cy = y;
  ctx.font = vfont(px);
  for (const it of items) {
    ctx.font = vfont(px, it.on ? 700 : 400);   // (a lit chip's bold label is wider)
    const sw = it.col ? 22 : 0, w = Math.min(W, ctx.measureText(it.label).width + 26 + sw);
    if (cx + w > x + W) { cx = x; cy += h + gap; }
    if (cy + h > maxY) break;
    vButton(ctx, P, it.id, cx, cy, w, h, '', it.fn, { r: 6, on: it.on });
    if (it.col) swatch(ctx, cx + 12, cy + h / 2 - 7, 14, it.col);
    ctx.font = vfont(px, it.on ? 700 : 400); ctx.fillStyle = it.ink || VC.ink; ctx.textBaseline = 'middle';
    ctx.fillText(fitText(ctx, it.label, w - 26 - sw), cx + 13 + sw, cy + h / 2 + 1); ctx.textBaseline = 'top';
    cx += w + gap;
  }
  return cy + h - y;
}
//#use head~2 vSlider
// the age slider with its readout (20 to 70)
function drawAge(ctx, P, x, y, W) {
  ctx.font = vfont(23); ctx.fillStyle = VC.ink; ctx.textBaseline = 'middle'; ctx.fillText('Age', x, y + 25);
  ctx.font = vfont(26, 700); ctx.textAlign = 'right'; ctx.fillText(String(X.age), x + W, y + 25); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  vSlider(ctx, P, 'age', x + 80, y, W - 160, X.age, AGE0, AGE1, VC.amber, v => setAge(v));
  return 60;
}
// rows of a kind's swatch, its name, a value and a note (the HTML panes' stats)
function rows(ctx, list, x, y, W, bottom) {
  let yy = y;
  for (const [col, name, v, note] of list) {
    if (yy + 40 > bottom) break;
    if (col) swatch(ctx, x, yy + 6, 20, col);
    ctx.font = vfont(24); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, name, 260), x + (col ? 32 : 0), yy + 2);
    ctx.font = vfont(26, 700); ctx.fillStyle = VC.ink; ctx.fillText(v, x + 300, yy);
    if (note) { const w = ctx.measureText(v).width; ctx.font = vfont(21); ctx.fillStyle = VC.faint; ctx.fillText(fitText(ctx, note, W - 300 - w - 16), x + 300 + w + 14, yy + 4); }
    yy += 42;
  }
  return yy - y;
}
function drawObjectsPane(ctx, P, x, y, W, bottom) {
  const k = X.kind;
  y += textBlock(ctx, 'The four kinds of object the poster counts, and cysts, which only the segmentation looks for.', x, y, W, 24, 33, VC.muted, 400, 2) + 12;
  y += flow(ctx, P, KINDS.map(q => ({ id: 'kind:' + q, label: Plural(q), col: KCOL[q], on: k === q, fn: () => selectKind(k === q ? null : q) })), x, y, W, bottom, { px: 22, h: 48 }) + 18;
  if (!k) { textBlock(ctx, `${fmt(FACTS.annotated)} objects of the four kinds were marked by hand to train the methods. Pick one, or point at one on the section and pull the trigger (or pinch).`, x, y, W, 26, 38, VC.muted); return; }
  swatch(ctx, x, y + 10, 26, KCOL[k]);
  y += textBlock(ctx, Plural(k), x + 40, y + 2, W - 40, 36, 44, VC.ink, 700, 1) + 6;
  y += textBlock(ctx, KIND_TEXT[k], x, y, W, 24, 32, VC.muted, 400, 2) + 12;
  const st = kindStats(k);
  y += rows(ctx, st.rows.map(([t, v, s]) => [null, t, v, s]), x, y, W, bottom) + 6;
  if (st.note && y + 60 < bottom) y += textBlock(ctx, st.note, x, y, W, 21, 29, VC.faint, 400, 2) + 10;
  if (y + 60 > bottom) return;
  flow(ctx, P, [{ id: 'sh:sec', label: 'On the section', on: X.scene === 'section' && viewIs('section', /^section$/), fn: () => showView('section', 'section') }]
    .concat(hasOpt('organ', 'show', k) ? [{ id: 'sh:organ', label: 'In the ovary', on: X.scene === 'organ', fn: () => showView('organ', 'cut') }] : []), x, y, W, bottom, { px: 22, h: 50 });
}
function drawAgePane(ctx, P, x, y, W, bottom) {
  y += textBlock(ctx, 'Move the age: the ovary and the section follow the poster\'s trend lines (different donors at each age, not one ovary followed over time).', x, y, W, 24, 33, VC.muted, 400, 2) + 14;
  y += drawAge(ctx, P, x, y, W) + 14;
  y += head(ctx, x, y, `On the poster's trend line at ${X.age} (objects per section): random forest · segmentation`);
  y += rows(ctx, ageRows().map(([q, r, s]) => [KCOL[q], Plural(q), `${fmt(r)} · ${fmt(s)}`, '']), x, y, W, bottom) + 14;
  y += head(ctx, x, y, 'Show it on');
  y += flow(ctx, P, [{ id: 'a:organ', label: 'The ovary', on: X.scene === 'organ', fn: () => openScene('organ') },
    { id: 'a:sec', label: 'The section', on: X.scene === 'section', fn: () => openScene('section') }], x, y, W, bottom, { px: 22, h: 50 }) + 16;
  if (y + 70 < bottom) textBlock(ctx, 'The two methods count differently; the lines are the poster\'s. The ovary and the section are drawn to follow them, not to scale.', x, y, W, 21, 29, VC.faint, 400, 3);
}
function drawMethodsPane(ctx, P, x, y, W, bottom) {
  const rf = X.method === 'rf', m = METHOD[X.method], bw = (W - 12) / 2;
  vButton(ctx, P, 'm:rf', x, y, bw, 58, '1 · Tiles and a forest', () => setMethod('rf'), { on: rf, px: 22 });
  vButton(ctx, P, 'm:seg', x + bw + 12, y, bw, 58, '2 · SegFormer\'s masks', () => setMethod('seg'), { on: !rf, px: 22 });
  y += 78;
  y += textBlock(ctx, m.title, x, y, W, 34, 42, VC.ink, 700, 1) + 6;
  y += textBlock(ctx, m.steps.join(' → ') + '.', x, y, W, 24, 33, VC.muted, 400, 4) + 12;
  y += flow(ctx, P, (rf ? [{ id: 'v:tiles', label: 'Tiles and features', on: X.scene === 'section' && viewIs('section', /tiles/), fn: () => showView('section', 'tiles') },
    { id: 'v:forest', label: 'The vote', on: X.scene === 'section' && viewIs('section', /forest/), fn: () => setMethod('rf') }]
    : [{ id: 'v:masks', label: 'The masks', on: X.scene === 'section' && viewIs('section', /masks/), fn: () => setMethod('seg') }]), x, y, W, bottom, { px: 22, h: 50 }) + 16;
  y += rows(ctx, (rf ? KINDS4 : KINDS).map(q => [KCOL[q], Plural(q), rf ? `F1 ${sc2(KD[q].rf.f1)}` : `IoU ${sc2(KD[q].iou)}`, rf ? `precision ${sc2(KD[q].rf.precision)} · recall ${sc2(KD[q].rf.recall)}` : '']), x, y, W, bottom) + 10;
  if (y + 70 < bottom) textBlock(ctx, rf ? 'Precision: of the tiles called follicle, how many are one. Recall: of the follicles, how many were found. F1: the two in one number. 1 is perfect.'
    : `IoU: how far a predicted mask and the true one overlap (1 is perfect). Cysts, found only by the segmentation: just ${sc2(KD.cyst.iou)}.`, x, y, W, 21, 29, VC.faint, 400, 3);
}
// the scenes, and the chosen scene's own controls (and the age, where the scene shows it)
function drawScenesPane(ctx, P, x, y, W, bottom) {
  const cw = (W - 12 * (SCENES.length - 1)) / SCENES.length;
  SCENES.forEach(([k, n], j) => vButton(ctx, P, 'scene:' + k, x + j * (cw + 12), y, cw, 56, SCENE_SHORT[k] || n, () => openScene(k), { on: X.scene === k, px: 22 }));
  y += 76;
  const sc = SCENES.find(s => s[0] === X.scene);
  y += textBlock(ctx, sc[2], x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  for (const c of ctlsOf(X.scene).filter(c => ctlShown(X.scene, c))) {
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => setCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
  if (ageHere() && y + 70 < bottom) drawAge(ctx, P, x, y, W);
}

//#use sigFoot drawFoot