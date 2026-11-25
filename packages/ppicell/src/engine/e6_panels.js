//#use head VC vfont cssColor rr wrapLines textBlock fitText fitTitle vButton swatch makePanel panelDepth panelTick
//#use panelPaint FADE FADECV panelFade panelSend panelPatch
//#use sigMain
// the story's own part of the main panel's signature (sigMain): '' (nothing beyond the chapter and its lines)
const sigMainS = () => '';
// explore mode in the main panel's signature: everything its panes show (drawn again only when this changes)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), statsLine(), readingLine(), X.pp, X.pc, X.cx, X.ties, pickLine(), kindsLine(), SRCH.on, SRCH.q,
    JSON.stringify(X.lim), X.own, netLine(), jobLine(), OWNN.kept, OWNN.model ? OWNN.name : '', X.net, shareLines().join(), shareButtons().map(b => b.id).join(), listButtons().map(b => b.id + b.on).join()].join('|');
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
  ({ scenes: drawScenesPane, pick: drawPickPane, net: drawNetPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
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
  y += textBlock(ctx, sc[2], x, y, W, 25, 35, VC.muted, 400, 3) + 12;
  y += textBlock(ctx, statsLine(), x, y, W, 23, 32, VC.ink, 400, 3) + 8;
  y += textBlock(ctx, readingLine(), x, y, W, 23, 32, VC.muted, 400, 2) + 18;
  // (each control's name beside its buttons, so all seven fit: the panel cannot scroll)
  const LW = 200;
  for (const c of ctlsOf(X.scene).filter(c => ctlShown(X.scene, c))) {
    if (y + 60 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.textBaseline = 'middle'; ctx.fillText(c.label, x, y + 26); ctx.textBaseline = 'top';
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => setCtl(X.scene, c.key, v) })), x + LW, y, W - LW, bottom, { px: 23, h: 52 }) + 14;
    ctx.textBaseline = 'top';
  }
}

// the places to pick and what the pick shows (renderPick's twin). The headset has no box to type in, so the Search
// button opens a keyboard and the proteins whose symbols start with what is typed, as buttons (the best connected
// first; before anything is typed the biggest hubs): pressing one picks it. The places give way to them meanwhile, as
// the panel cannot scroll.
function drawPickPane(ctx, P, x, y, W, bottom) {
  vButton(ctx, P, 'pick:search', x, y, 170, 56, 'Search', () => { SRCH.on = !SRCH.on; }, { on: SRCH.on, px: 22 });
  if (SRCH.on) {
    // what is typed, in a field beside the button
    rr(ctx, x + 186, y, W - 186, 56, 8); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = VC.line; ctx.stroke();
    ctx.textBaseline = 'middle';
    if (SRCH.q) { ctx.font = vfont(26, 700); ctx.fillStyle = VC.ink; ctx.fillText(SRCH.q + '_', x + 204, y + 29); }
    else { ctx.font = vfont(22); ctx.fillStyle = VC.faint; ctx.fillText('Type the start of a symbol, such as TP53', x + 204, y + 29); }
    ctx.textBaseline = 'top';
    y += 72;
    for (const k of keyRects(x, y, W)) vButton(ctx, P, 'key:' + k.k, k.x, k.y, k.w, k.h, k.label, () => searchKey(k.k), { px: k.k.length > 1 ? 21 : 24, r: 8 });
    y += KEYS_H + 16;
    const hits = searchHits(SRCH.q, 10);
    if (hits.length) y += flow(ctx, P, hits.map(p => ({ id: 'hit:' + p, label: api('cell').sym(p), on: X.pp === p, fn: () => setPick(p, -1, true) })), x, y, W, y + 2 * 52 + 8, { px: 23, h: 52 }) + 18;
    else y += textBlock(ctx, `No protein in this interactome starts with ${SRCH.q}.`, x, y, W, 23, 32, VC.muted, 400, 1) + 18;
    y += textBlock(ctx, pickLine(), x, y, W, 24, 33, VC.ink, 400, 5) + 12;
    if (kindsLine()) y += textBlock(ctx, kindsLine(), x, y, W, 22, 31, VC.muted, 400, 2) + 18;
    if ((X.pp >= 0 || X.pc >= 0 || X.cx >= 0) && y + 56 < bottom) vButton(ctx, P, 'pick:clear', x, y, 180, 56, 'Clear', () => setPick(-1, -1, false), { px: 22 });
    return;
  }
  y += Math.max(56, textBlock(ctx, 'Point at a dot and press to pick a protein and see all its links, or pick a place. The same again lets go.', x + 190, y, W - 190, 23, 31, VC.muted, 400, 3)) + 16;
  const names = api('cell').places || [];
  y += flow(ctx, P, names.map((n, k) => ({ id: 'place:' + k, label: n, on: X.pc === k, fn: () => setPick(-1, k, true) })), x, y, W, bottom, { px: 23, h: 52 }) + 18;
  y += textBlock(ctx, pickLine(), x, y, W, 24, 33, VC.ink, 400, 6) + 12;
  // a protein's complexes, or a complex's members, as buttons (renderPick's chips; two rows at most, before the kinds of
  // evidence: the panel cannot scroll)
  const pl = pickList();
  if (pl && y + 100 < bottom) {
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(pl.head, x, y);
    y += 36;
    y += flow(ctx, P, pl.items.map(([a, v, n]) => ({ id: a + ':' + v, label: n.length > 34 ? n.slice(0, 33) + '…' : n, on: false, fn: () => (a === 'pickcx' ? setPick(-1, -1, true, v) : setPick(v, -1, true)) })), x, y, W, Math.min(bottom, y + 2 * 52 + 8), { px: 22, h: 52 }) + 18;
  }
  if (kindsLine() && y + 70 < bottom) y += textBlock(ctx, kindsLine(), x, y, W, 22, 31, VC.muted, 400, 2) + 18;
  if ((X.pp >= 0 || X.pc >= 0 || X.cx >= 0) && y + 56 < bottom) { vButton(ctx, P, 'pick:clear', x, y, 180, 56, 'Clear', () => setPick(-1, -1, false), { px: 22 }); y += 76; }
  // the Copies switch (renderPick's twin)
  if (y + 110 > bottom) return;
  ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText('Copies', x, y);
  y += 36;
  y += flow(ctx, P, [[1, 'On'], [0, 'Off']].map(([v, n]) => ({ id: 'copies:' + v, label: n, on: X.ties === v, fn: () => setTies(v, true) })), x, y, W, bottom, { px: 24, h: 56 }) + 14;
  if (y + 60 < bottom) textBlock(ctx, COPIES_TEXT, x, y, W, 22, 31, VC.muted, 400, 2);
}
// the search's keyboard: ten keys a row, the last row's Delete and Erase all keys a key and a half each; KEYS_H its height
const KEY_ROWS = ['ABCDEFGHIJ', 'KLMNOPQRST', 'UVWXYZ0123', '456789-'], KEY_H = 54, KEY_GAP = 8, KEYS_H = 4 * KEY_H + 3 * KEY_GAP;
function keyRects(x, y, W) {
  const kw = (W - 9 * KEY_GAP) / 10, out = [];
  KEY_ROWS.forEach((row, r) => {
    const ky = y + r * (KEY_H + KEY_GAP);
    [...row].forEach((k, c) => out.push({ k, label: k, x: x + c * (kw + KEY_GAP), y: ky, w: kw, h: KEY_H }));
    if (r === 3) {
      const x0 = x + 7 * (kw + KEY_GAP), w2 = (x + W - x0 - KEY_GAP) / 2;
      out.push({ k: 'del', label: 'Delete', x: x0, y: ky, w: w2, h: KEY_H }, { k: 'clear', label: 'Erase all', x: x0 + w2 + KEY_GAP, y: ky, w: w2, h: KEY_H });
    }
  });
  return out;
}
//#use sigFoot drawFoot drawFootX
