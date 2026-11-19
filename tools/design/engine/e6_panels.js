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
  const T = GL.sets.table;
  return ['x', audioLabel(), xrSig(), X.tab, X.pick, X.story, X.minis, T.built(), T.moved().length].join('|');
}
const XR_HERE = 'design';
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
  if (!XR.stories) hb('mode', story ? 'To the table' : 'Intro', () => (story ? APP.enterExplore() : APP.enterStory(0)), story ? 186 : 110, { primary: story });
  // the story's name, smaller when the buttons leave it less room
  fitTitle(ctx, 'The props table', 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, HOST.room && HOST.room.inRoom() ? HOST.room.gripHint : HOST.anchor.on ? 'Trigger (or pinch): use buttons. Anchored: to move things, use Place again in the menu.' : 'Trigger (or pinch): use buttons. Grip: ' + (XR.free ? 'move and turn' : 'move') + ' this panel.', 44, P.h - 74, P.w - 88, 22, 30, VC.faint);
  } else drawExplorePane(ctx, P, 40, 120, P.w - 80);
}

//#use STY storyOpacity FADEB drawStoryPane drawStoryEl~2
// explore: the Prop and All props tabs, mirroring the HTML ones (the card shorter: the headset's panel holds less, and
// the stories' props are picked story by story)
function drawExplorePane(ctx, P, x, y, W) {
  const T = GL.sets.table, moved = T.moved().length, bottom = P.h - 30;
  let bx = x;
  for (const [k, n] of TABS) { vButton(ctx, P, 'tab:' + k, bx, y, 200, 56, n, () => pickTab(k), { on: X.tab === k, px: 24 }); bx += 212; }
  vButton(ctx, P, 'tidy', x + W - 280, y, 280, 56, moved ? `Tidy the table (${moved})` : 'Tidy the table', moved ? () => tidyTable() : null, { px: 22, color: moved ? VC.ink : VC.faint });
  y += 78;
  if (X.minis === 'failed') textBlock(ctx, 'The models could not be loaded: the cards still work.', x, bottom - 30, W, 21, 28, VC.amber, 400, 1);
  else if (T.built() < T.total()) textBlock(ctx, `Laying the table: ${T.built()} of ${T.total()} models.`, x, bottom - 30, W, 21, 28, VC.faint, 400, 1);
  const foot = X.minis === 'failed' || T.built() < T.total() ? 40 : 0;   // (room for the line above)
  if (X.tab === 'prop') drawCardPane(ctx, P, x, y, W, bottom - foot); else drawAllPane(ctx, P, x, y, W, bottom - foot);
}
function drawCardPane(ctx, P, x, y, W, bottom) {
  const k = X.pick;
  if (!k) { textBlock(ctx, 'Nothing on the stage yet. Point at a model on the table and pull the trigger (or pinch), or pick one under All props: it stands on the stage, and its card shows here.', x, y, W, 27, 38, VC.muted, 400, 5); return; }
  const c = DESIGN_CARDS[k], s = storyOf(k);
  ctx.font = vfont(21, 700); ctx.fillStyle = s.col; ctx.fillText(fitText(ctx, (s.kick + ' · ' + s.title).toUpperCase(), W - 230), x, y + 4);
  vButton(ctx, P, 'clear', x + W - 210, y - 6, 210, 44, 'Clear the stage', () => pickProp(''), { px: 19 });
  y += 46;
  y += fitTitle(ctx, c.name, x, y, W, 46, 54, VC.ink, 700, 32) + 4;
  y += textBlock(ctx, c.shows, x, y, W, 22, 31, VC.muted, 400, 4) + 12;
  const kv = (t, v) => { if (!v || y > bottom - 40) return; ctx.font = vfont(19); ctx.fillStyle = VC.faint; ctx.fillText(t, x, y + 2); y += textBlock(ctx, v, x + 140, y, W - 140, 20, 28, VC.ink, 400, 2) + 6; };
  kv('Size', c.size); kv('Frame', c.frame); kv('Source', c.file); kv('Reused by', c.reusedBy.join(', ') || 'no other set');
  if (c.reuses.length) kv('Reuses', c.reuses.join('; '));
  if (c.note && y < bottom - 60) y += textBlock(ctx, c.note, x, y, W, 19, 27, VC.muted, 400, 2) + 8;
  if (c.params.length && y < bottom - 90) {
    ctx.fillStyle = VC.line; ctx.fillRect(x, y, W, 2); y += 12;
    ctx.font = vfont(22, 700); ctx.fillStyle = VC.ink; ctx.fillText(`Params (${c.params.length})`, x, y);
    ctx.font = vfont(18); ctx.fillStyle = VC.faint; ctx.fillText('amber: a step, never eased', x + 190, y + 4);
    y += 36;
    const vh = c.views.length ? 72 : 0, room = Math.max(1, Math.floor((bottom - y - vh) / 29)), show = c.params.length > room ? room - 1 : c.params.length;
    for (const [n, r, m, st] of c.params.slice(0, show)) {
      ctx.font = vfont(18, 700); ctx.fillStyle = st ? VC.amber : VC.cyan; ctx.fillText(fitText(ctx, n, 220), x, y);
      ctx.font = vfont(18); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, r, 140), x + 228, y);
      ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, m, W - 380), x + 380, y);
      y += 29;
    }
    if (show < c.params.length) { ctx.font = vfont(18); ctx.fillStyle = VC.faint; ctx.fillText(`and ${c.params.length - show} more (the page's card lists every one)`, x, y); y += 29; }
  }
  if (c.views.length && y < bottom - 50) {
    y += 8; ctx.font = vfont(22, 700); ctx.fillStyle = VC.ink; ctx.fillText(`Views (${c.views.length})`, x, y); y += 32;
    textBlock(ctx, c.views.map(v => v[0]).join(', '), x, y, W, 19, 27, VC.muted, 400, Math.max(1, Math.floor((bottom - y) / 27)));
  }
}
function drawAllPane(ctx, P, x, y, W, bottom) {
  y += textBlock(ctx, `${CARD_KEYS.length} models of ${STORIES.length} stories. Pick a story, then a prop, or point at the table.`, x, y, W, 23, 32, VC.muted, 400, 2) + 14;
  const cw = (W - 24) / 3;
  STORIES.forEach((s, i) => {
    const bx = x + (i % 3) * (cw + 12), by = y + Math.floor(i / 3) * 62;
    vButton(ctx, P, 'grp:' + s.key, bx, by, cw, 52, '', () => { X.story = s.key; }, { on: X.story === s.key });
    swatch(ctx, bx + 14, by + 18, 16, s.col);
    ctx.font = vfont(21, X.story === s.key ? 700 : 400); ctx.fillStyle = VC.ink; ctx.textBaseline = 'middle'; ctx.fillText(fitText(ctx, s.title, cw - 52), bx + 40, by + 27); ctx.textBaseline = 'top';
  });
  y += Math.ceil(STORIES.length / 3) * 62 + 12;
  const s = STORIES.find(q => q.key === X.story) || STORIES[0];
  if (!s) return;
  ctx.font = vfont(21, 700); ctx.fillStyle = s.col; ctx.fillText(fitText(ctx, `${s.kick} · ${s.title}`.toUpperCase(), W), x, y); y += 36;
  const pw = (W - 12) / 2;
  s.keys.forEach((k, i) => {
    const bx = x + (i % 2) * (pw + 12), by = y + Math.floor(i / 2) * 62;
    if (by + 52 <= bottom) vButton(ctx, P, 'pick:' + k, bx, by, pw, 52, DESIGN_CARDS[k].name, () => pickProp(k), { on: X.pick === k, px: 21 });
  });
}
function sigFoot() {
  return APP.mode === 'story' ? 's' + Math.floor(APP.t) + APP.playing + (curCh ? curCh.key : '') + slideSig() : 'x' + footHint();
}
// explore: what the hands do here (in a shared room the room's word on the grip; anchored, nothing moves)
const footHint = () => (HOST.room && HOST.room.inRoom() ? HOST.room.gripHint : HOST.anchor.on ? 'Anchored: the models stay put (Place again in the menu to move things). Trigger or pinch on a model: on the stage.'
  : 'Point at a model: its name. Trigger or pinch: on the stage. Grip: pick it up' + (XR.free ? ', turn it' : '') + '; both grips size it.');
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
  textBlock(ctx, footHint(), 28, 40, P.w - 56, 23, 32, VC.muted, 400, 3);
}


// ------------------------------------------------------------- narration --
