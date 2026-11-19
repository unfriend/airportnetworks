//#use head VC vfont cssColor rr wrapLines textBlock fitText fitTitle vButton swatch makePanel panelDepth panelTick
//#use panelPaint FADE FADECV panelFade panelSend panelPatch
// ------------------------------------------------------------ main panel --
function sigMain() {
  if (XR.stories) return 'stories' + audioLabel();
  if (APP.mode !== 'story') return ['x', LANG, audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.n, X.shark, GL.sets.fish.sharks(), GL.sets.fish.refused(), !!GL.lifeOn, JSON.stringify(X.out), Math.floor(X.out.day), X.city, X.prot].join('|');
  {
    const it = ST.items.find(x => x.ch === curCh);
    let s = 's' + LANG + audioLabel() + xrSig() + (GL.lifeOn ? 'f' : '') + (HOST.room && HOST.room.inRoom() ? 'r' + HOST.room.gripHint : '') + (curCh ? curCh.key : '');
    if (it) {
      for (const g of it.grow) s += Math.round(Math.max(0, g.s) * 6);
      if (curCh.key === 'fish') s += $('#titleArc').getAttribute('stroke-dashoffset').slice(0, 3) + $('#titleDot').getAttribute('opacity').slice(0, 3);
      s += '\u0001';   // what follows is the text fades alone: panelFade draws only the bands that moved
      for (const e of it.els) s += Math.round(Math.max(0, e.o) * 3);
    }
    return s;
  }
}
const XR_HERE = 'pass';
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
  fitTitle(ctx, T('title'), 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, HOST.room && HOST.room.inRoom() ? (GL.lifeOn && !HOST.anchor.locked('sea') ? T('xr.hint.fish.room') : HOST.room.gripHint) : HOST.anchor.on ? T('xr.hint.anchor') : GL.lifeOn ? T(XR.free ? 'xr.hint.fish.free' : 'xr.hint.fish') : T(XR.free ? 'xr.hint.free' : 'xr.hint'), 44, P.h - 80, P.w - 88 - 320, 21, 28, VC.faint, 400, 3);
  } else { drawExplorePane(ctx, P, 40, 120, P.w - 80); ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2); }
  if (!XR.stories) drawLang(ctx, P, P.w - 44, P.h - 82);
}

//#use STY storyOpacity FADEB drawStoryPane drawStoryEl
// explore: the language, tabs and panes mirroring the HTML ones
function drawExplorePane(ctx, P, x, y, W) {
  const tw = W / TABS.length;
  TABS.forEach(([k, n], j) => {
    const on = X.tab === k, tx = x + j * tw, hov = P.hover === 'tab:' + k;
    if (hov && !on) { rr(ctx, tx + 4, y, tw - 8, 62, 8); ctx.fillStyle = VC.chip; ctx.fill(); }
    ctx.font = vfont(24, on ? 700 : 400); ctx.fillStyle = on ? VC.ink : VC.muted;
    ctx.textAlign = 'center'; ctx.fillText(T(n), tx + tw / 2, y + 18); ctx.textAlign = 'left';
    if (on) { ctx.fillStyle = VC.cyan; ctx.fillRect(tx + 10, y + 58, tw - 20, 4); }
    P.regions.push({ id: 'tab:' + k, x: tx, y, w: tw, h: 64, fn: () => pickTab(k) });
  });
  ctx.fillStyle = VC.line; ctx.fillRect(x, y + 62, W, 2);
  y += 88;
  const bottom = P.h - 108;   // (the language switch below)
  ({ fish: drawFishPane, outbreak: drawOutbreakPane, cell: drawCellPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
// the language switch at the foot of the main panel (story and explore alike)
function drawLang(ctx, P, x1, y) {
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(T('lang'), x1 - 2 * 86 - 14, y + 28); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  LANGS.forEach((l, i) => vButton(ctx, P, 'lang:' + l, x1 - (2 - i) * 86, y, 78, 56, l.toUpperCase(), () => setLang(l), { on: LANG === l, px: 24 }));
}
//#use flow head~2 vSlider stats
// a name and its value on one line (the value bold, at the right)
function headVal(ctx, x, y, w, k, v) {
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, k, w - 120), x, y);
  if (v !== undefined) { ctx.font = vfont(24, 700); ctx.fillStyle = VC.ink; ctx.textAlign = 'right'; ctx.fillText(String(v), x + w, y - 2); ctx.textAlign = 'left'; }
  return 34;
}
// the fish: be the shark, neighbours watched, the network, the school's size, the view
function drawFishPane(ctx, P, x, y, W, bottom) {
  const busy = GL.sets.fish.full(), k = fishK(), vc = ctlOf('fish', 'view'), lc = ctlOf('fish', 'links');
  y += textBlock(ctx, T('f.sub'), x, y, W, 24, 33, VC.muted, 400, 2) + 14;
  y += head(ctx, x, y, T('f.shark'));
  y += flow(ctx, P, [['off', T('off')], ['on', T('on')]].map(([v, n]) => ({ id: 'shark:' + v, label: n, on: X.shark === (v === 'on'), fn: () => setShark(v === 'on') }))
    .concat([{ id: 'send', label: busy ? T('f.busy') : T('f.send'), on: busy, fn: busy ? null : () => sendShark(null) }]), x, y, W, bottom, { px: 23, h: 54 }) + 10;
  if (X.shark && GL.sets.fish.refused()) y += textBlock(ctx, T('f.full'), x, y, W, 22, 30, VC.amber, 400, 3) + 10;   // (four sharks swim: yours refused)
  else if (X.shark) y += textBlock(ctx, T('f.shark.how'), x, y, W, 22, 30, VC.faint, 400, 3) + 10;
  y += headVal(ctx, x, y, W, T('f.k'), k);
  vSlider(ctx, P, 'fk', x + 16, y, W - 32, k, 1, 12, VC.cyan, v => setFishK(v));
  y += 54;
  y += textBlock(ctx, kText(k), x, y, W, 23, 31, k === 1 ? VC.amber : VC.ink, 400, 2) + 14;
  y += head(ctx, x, y, T('f.links'));
  y += flow(ctx, P, lc.options.map(([v, n]) => ({ id: 'links:' + v, label: n, on: ctlValue('fish', lc) === v, fn: () => sceneCtl('fish', 'links', v) })), x, y, W, bottom, { px: 23, h: 54 }) + 14;
  y += headVal(ctx, x, y, W, T('f.n'), X.n);
  vSlider(ctx, P, 'fn', x + 16, y, W - 32, X.n, 100, 600, VC.cyan, v => setFishN(v));
  y += 58;
  y += head(ctx, x, y, vc.label);
  y += flow(ctx, P, vc.options.map(([v, n]) => ({ id: 'fv:' + v, label: n, on: ctlValue('fish', vc) === v, fn: () => sceneCtl('fish', 'view', v) })), x, y, W, bottom, { px: 23, h: 54 }) + 14;
  if (y + 60 < bottom) textBlock(ctx, T('f.note'), x, y, W, 21, 29, VC.faint, 400, Math.max(1, Math.min(4, Math.floor((bottom - y) / 29))));
}
// the outbreak's chart, as the HTML one: cities in each state by day, stacked, and the day on show
function drawChart(ctx, x, y, w, h, n) {
  ctx.fillStyle = 'rgba(160,178,202,0.35)'; ctx.fillRect(x, y + h, w, 2);
  for (const [k, pts] of chartPaths(n, w, h)) {
    ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + px, y + py) : ctx.moveTo(x + px, y + py))); ctx.closePath();
    ctx.globalAlpha = 0.85; ctx.fillStyle = OUT_COL[k]; ctx.fill(); ctx.globalAlpha = 1;
  }
  const dx = x + (n.d / Math.max(1, n.end)) * w;
  ctx.fillStyle = VC.ink; ctx.fillRect(dx - 1.5, y - 6, 3, h + 6);
  ctx.font = vfont(19); ctx.fillStyle = VC.muted; ctx.fillText(num(n.total), x, y - 28);
  ctx.textAlign = 'right'; ctx.fillText(T('o.day', n.end), x + w, y + h + 8); ctx.textAlign = 'left'; ctx.fillText(T('o.day', 0), x, y + h + 8);
  // the legend, at the top right
  let lx = x + w;
  ctx.textAlign = 'right';
  for (const k of ['R', 'I', 'E']) { const t = T('o.' + k); ctx.fillText(t, lx, y - 28); lx -= ctx.measureText(t).width + 8; swatch(ctx, lx - 16, y - 26, 16, OUT_COL[k]); lx -= 34; }
  ctx.textAlign = 'left';
}
// the outbreak: where it starts, what a click does, play, the day, the chart, how far it has come, the city looked
// up, and the settings, two by two
function drawOutbreakPane(ctx, P, x, y, W, bottom) {
  const O = X.out, n = outNow(), st = outIndex(O.start), sf = st >= 0 ? api('globe').info(st) : null, hw = (W - 32) / 2;
  y += textBlock(ctx, T('o.sub'), x, y, W, 25, 32, VC.amber, 700, 1) + 10;
  y += headVal(ctx, x, y, W, T('o.start'), sf ? `${sf.city} (${sf.code})` : O.start);
  y += flow(ctx, P, QUICK_START.filter(c => outIndex(c) >= 0).map(c => ({ id: 'st:' + c, label: cityOf(c), on: c === O.start, fn: () => setStart(c) })), x, y, W, y + 50, { px: 22, h: 48 }) + 12;
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; const cw = ctx.measureText(T('o.click')).width + 18; ctx.fillText(T('o.click'), x, y + 15);
  y += flow(ctx, P, [['start', T('o.click.start')], ['look', T('o.click.look')]].map(([v, l]) => ({ id: 'ck:' + v, label: l, on: O.click === v, fn: () => { X.out.click = v; renderOutbreak(); } })), x + cw, y, W - cw, bottom, { px: 22, h: 48 }) + 12;
  vButton(ctx, P, 'oplay', x, y, 200, 56, O.playing ? T('o.pause') : T('o.play'), () => playOut(!X.out.playing), { primary: true, px: 25 });
  vButton(ctx, P, 'oagain', x + 214, y, 200, 56, T('o.again'), () => { X.out.day = 0; playOut(true); }, { px: 23 });
  ctx.font = vfont(30, 700); ctx.fillStyle = VC.ink; ctx.textAlign = 'right'; ctx.fillText(T('o.day', n.d), x + W, y + 12); ctx.textAlign = 'left';
  y += 66;
  vSlider(ctx, P, 'oday', x + 16, y, W - 32, n.d, 0, Math.max(1, n.end), VC.ink, v => setDay(Math.round(v)));
  y += 84;
  drawChart(ctx, x, y, W, 130, n);
  y += 130 + 42;
  // (rows of a name and its value, the values lined up after the longest name)
  ctx.font = vfont(22);
  const rows = [[T('o.reached'), T('o.reachedv', num(n.reached), num(FACTS.airports))], [T('o.peak'), T('o.peakv', num(n.peak), n.peakDay)], [T('o.over'), T('o.overv', n.end)]];
  const lw = Math.max(...rows.map(r => ctx.measureText(r[0]).width)) + 18;
  rows.slice(0, 2).forEach(([k, v], i) => {
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(k, x, y + 3);
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(v, x + lw, y);
    if (i === 1) { ctx.font = vfont(21); ctx.fillStyle = VC.muted; ctx.textAlign = 'right'; ctx.fillText(`${rows[2][0]} ${rows[2][1]}`, x + W, y + 4); ctx.textAlign = 'left'; }
    y += 38;
  });
  y += 4;
  const [ca, cb] = cityText();
  if (ca) { y += textBlock(ctx, ca, x, y, W, 23, 30, VC.cyan, 700, 1); if (cb) y += textBlock(ctx, cb, x, y, W, 21, 28, VC.muted, 400, 1); y += 10; }
  // the settings, two by two
  const pair = (l, r) => { l(x, y); r(x + hw + 32, y); y += 92; };
  pair((cx, cy) => { headVal(ctx, cx, cy, hw, T('o.inc'), T('o.days', O.inc)); vSlider(ctx, P, 'oinc', cx + 14, cy + 34, hw - 28, O.inc, 1, 21, VC.amber, v => setOut('inc', v)); },
    (cx, cy) => { headVal(ctx, cx, cy, hw, T('o.inf'), T('o.days', O.inf)); vSlider(ctx, P, 'oinf', cx + 14, cy + 34, hw - 28, O.inf, 2, 30, VC.red, v => setOut('inf', v)); });
  if (y + 90 > bottom + 40) return;
  pair((cx, cy) => { head(ctx, cx, cy, T('o.spread')); flow(ctx, P, ['low', 'medium', 'high'].map(v => ({ id: 'sp:' + v, label: T('o.' + v), on: O.spread === v, fn: () => setOut('spread', v) })), cx, cy + 34, hw, cy + 34 + 52, { px: 21, h: 48 }); },
    (cx, cy) => { headVal(ctx, cx, cy, hw, T('o.cut'), `${O.cut} %`); vSlider(ctx, P, 'ocut', cx + 14, cy + 34, hw - 28, O.cut, 0, 90, VC.cyan, v => setOut('cut', v)); });
}
// the cell: a protein picked, its places and partners there, and the moves
function drawCellPane(ctx, P, x, y, W, bottom) {
  const A = api('cell'), f = protInfo(), mv = ctlVal('cell', 'move'), m = mv !== 'none' ? A.move(mv) : null;
  y += textBlock(ctx, T('c.sub'), x, y, W, 23, 31, VC.muted, 400, 3) + 12;
  const quick = QUICK_PROT.filter(sy => { const p = A.protein(sy); return Number.isInteger(p) && p >= 0; }).map(sy => A.info(A.protein(sy)).sym);
  y += flow(ctx, P, quick.map(sy => ({ id: 'pr:' + sy, label: sy, on: X.prot === sy, fn: () => selectProtein(X.prot === sy ? -1 : sy) })), x, y, W, bottom, { px: 22, h: 48 }) + 14;
  if (f) {
    y += textBlock(ctx, f.sym, x, y, W, 34, 42, VC.cyan, 700, 1);
    y += textBlock(ctx, (f.name !== f.sym ? f.name + ' · ' : '') + (f.role || ''), x, y, W, 22, 29, VC.muted, 400, 2) + 8;
    y += flow(ctx, P, f.places.map(pl => ({ id: 'pl:' + pl.k, label: pl.name, col: placeCol(pl.k) })), x, y, W, bottom, { px: 21, h: 44 }) + 10;
    for (const pp of f.partners.slice(0, 4)) {
      const t = pp.list.length ? pp.list.slice(0, 7).map(q => q.sym).join(', ') + (pp.list.length > 7 ? ' ' + T('c.more', pp.list.length - 7) : '') : T('c.alone');
      ctx.font = vfont(22, 700); ctx.fillStyle = placeCol(pp.place); const nm = pp.name + ': ', nw = Math.min(ctx.measureText(nm).width, W * 0.45);
      ctx.fillText(fitText(ctx, nm, W * 0.45), x, y);
      ctx.font = vfont(22); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, t, W - nw - 4), x + nw + 4, y);
      y += 31;
    }
    y += 8;
  } else y += textBlock(ctx, T('c.none'), x, y, W, 23, 31, VC.faint, 400, 1) + 10;
  y += head(ctx, x, y, T('c.moves'));
  y += flow(ctx, P, [{ id: 'mv:none', label: T('c.nomove'), on: mv === 'none', fn: () => setMove('none') }]
    .concat(A.moves().map(q => ({ id: 'mv:' + q.key, label: q.name, col: q.disease ? VC.red : TEAL, on: mv === q.key, fn: () => setMove(mv === q.key ? 'none' : q.key) }))), x, y, W, bottom, { px: 21, h: 46 }) + 12;
  if (m && y + 80 < bottom) {
    y += textBlock(ctx, m.title, x, y, W, 26, 34, VC.ink, 700, 1) + 2;
    y += textBlock(ctx, m.text, x, y, W, 21, 28, VC.muted, 400, Math.max(1, Math.min(3, Math.floor((bottom - y - 60) / 28)))) + 8;
    for (const d of A.moveDelta(mv).filter(q => q.lost.length || q.gained.length).slice(0, 3)) {
      if (y + 30 > bottom) break;
      const syms = l => l.slice(0, 4).map(p => A.info(p).sym).join(', ');
      ctx.font = vfont(22, 700); ctx.fillStyle = d.lost.length ? VC.red : TEAL; ctx.fillText(d.sym, x, y); const sw2 = ctx.measureText(d.sym + '  ').width;
      ctx.font = vfont(21); ctx.fillStyle = VC.ink;
      ctx.fillText(fitText(ctx, [d.lost.length ? T('c.lost', syms(d.lost)) : '', d.gained.length ? T('c.gained', syms(d.gained)) : ''].filter(Boolean).join('; '), W - sw2), x + sw2, y + 1);
      y += 30;
    }
  }
}
// the three scenes, and the chosen scene's own controls
function drawScenesPane(ctx, P, x, y, W, bottom) {
  const cw = (W - 12 * (SCENES.length - 1)) / SCENES.length;
  SCENES.forEach(([k], j) => vButton(ctx, P, 'scene:' + k, x + j * (cw + 12), y, cw, 56, sceneName(k), () => openScene(k), { on: X.scene === k, px: 22 }));
  y += 76;
  y += textBlock(ctx, sceneDesc(X.scene), x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  for (const c of ctlsOf(X.scene).filter(c => ctlShown(X.scene, c))) {
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => setCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
}

// ----------------------------------------------------------- footer panel --
function sigFoot() {
  return APP.mode === 'story' ? 's' + LANG + Math.floor(APP.t) + APP.playing + (curCh ? curCh.key : '') + slideSig() : 'x' + LANG + X.turn + X.scene;
}
function drawFoot(ctx, P) {
  if (APP.mode === 'story') {
    const playing = APP.playing, bx = 28, by = 40;
    vButton(ctx, P, 'play', bx, by, 96, 96, '', () => APP.togglePlay(), { r: 48 });
    ctx.fillStyle = VC.ink;
    if (playing) { ctx.fillRect(bx + 34, by + 30, 10, 36); ctx.fillRect(bx + 52, by + 30, 10, 36); }
    else { ctx.beginPath(); ctx.moveTo(bx + 38, by + 26); ctx.lineTo(bx + 38, by + 70); ctx.lineTo(bx + 72, by + 48); ctx.closePath(); ctx.fill(); }
    const t = APP.t, ci = Math.max(0, CH.findIndex(c => t >= c.na && t < c.nb));
    const tri = (cx, cy, dir) => { ctx.beginPath(); ctx.moveTo(cx - 9 * dir, cy - 13); ctx.lineTo(cx - 9 * dir, cy + 13); ctx.lineTo(cx + 9 * dir, cy); ctx.closePath(); ctx.fill(); };
    vButton(ctx, P, 'prev', 140, 52, 78, 72, '', () => APP.seek(t > CH[ci].na + 2 || ci === 0 ? CH[ci].na : CH[ci - 1].na));
    ctx.fillStyle = VC.ink; tri(171, 88, -1); ctx.fillRect(184, 75, 5, 26);
    vButton(ctx, P, 'next', 228, 52, 78, 72, '', () => APP.seek(ci < CH.length - 1 ? CH[ci + 1].na : T_END - 0.01));
    ctx.fillStyle = VC.ink; tri(262, 88, 1); ctx.fillRect(271, 75, 5, 26);
    const x0 = 344, x1 = P.w - 40, ty = 100;
    const m = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.textAlign = 'right'; ctx.fillText(m(t) + ' / ' + m(T_END), x1, 44); ctx.textAlign = 'left';
    // this story's Slideshow switch, left of the clock (placed for the longest clock, so it never shifts)
    const sx = x1 - ctx.measureText(m(T_END) + ' / ' + m(T_END)).width - 220;
    if (HOST.slides) vButton(ctx, P, 'slides', sx, 26, 198, 42, 'Slideshow: ' + (slidesOn() ? 'on' : 'off'), slideToggle, { on: slidesOn(), px: 20 });
    // slideshow: waiting at the end of a chapter, Next in the place of the chapter's name (the panel above has it)
    if (SLIDE.at >= 0) vButton(ctx, P, 'slideNext', x0, 16, 180, 48, 'Next', slideNext, { primary: true, px: 28 });
    else { ctx.font = vfont(27, 700); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, CH[ci].name, (HOST.slides ? sx : x1 - 160) - 16 - x0), x0, 40); }
    rr(ctx, x0, ty, x1 - x0, 6, 3); ctx.fillStyle = 'rgba(160,178,202,0.28)'; ctx.fill();
    rr(ctx, x0, ty, (x1 - x0) * t / T_END, 6, 3); ctx.fillStyle = VC.cyan; ctx.fill();
    ctx.fillStyle = 'rgba(160,178,202,0.6)';
    for (const c of CH.slice(1)) ctx.fillRect(x0 + (x1 - x0) * c.na / T_END - 1, ty - 8, 2, 22);
    ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * t / T_END, ty + 3, P.hover === 'track' ? 16 : 13, 0, 7); ctx.fillStyle = VC.cyan; ctx.fill();
    P.regions.push({ id: 'track', x: x0 - 10, y: 66, w: x1 - x0 + 20, h: 80, drag: px => APP.seek(clamp((px - x0) / (x1 - x0), 0, 1) * T_END) });
    return;
  }
  // (the fish are life size round you: nothing to turn or zoom)
  if (X.scene === 'fish') return;
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(T('turn'), 28, 58);
  vButton(ctx, P, 'turn:on', 116, 40, 90, 56, T('on'), () => setTurn('on'), { on: X.turn === 'on', px: 22 });
  vButton(ctx, P, 'turn:off', 214, 40, 90, 56, T('off'), () => setTurn('off'), { on: X.turn === 'off', px: 22 });
  ctx.fillText(T('xr.zoom'), 340, 58);
  vButton(ctx, P, 'z-', 414, 40, 56, 56, '−', () => xrZoom(1.3), { px: 28 });
  vButton(ctx, P, 'z+', 476, 40, 56, 56, '+', () => xrZoom(1 / 1.3), { px: 28 });
  vButton(ctx, P, 'home', 570, 40, 260, 56, T('xr.whole'), () => flyTo(view(X.scene, 'default')), { px: 22 });
}


// ------------------------------------------------------------- narration --
