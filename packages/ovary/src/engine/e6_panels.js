//#use head VC vfont cssColor rr wrapLines textBlock fitText fitTitle vButton swatch makePanel panelDepth panelTick
//#use panelPaint FADE FADECV panelFade panelSend panelPatch
//#use sigMain
const sigMainS = () => '';
// explore mode in the main panel's signature (sigMain)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.kind, X.age, X.method].join('|');
}
const XR_HERE = 'ovary';
const XR_TITLE = 'The aging ovary';
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
  ({ objects: drawObjectsPane, age: drawAgePane, methods: drawMethodsPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
//#use flow
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
//#use drawScenesPane~2

//#use sigFoot drawFoot drawFootX