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
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.cmp, X.netX, X.organ, X.life].join('|');
}
const XR_HERE = 'pet';
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
  fitTitle(ctx, 'One scan, one system', 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
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
  ({ networks: drawNetsPane, organs: drawOrgansPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
// buttons that wrap like the HTML chips: items -> { id, label, on, col, icon (an organ id), fn }
function flow(ctx, P, items, x, y, W, maxY, o = {}) {
  const px = o.px || 22, h = o.h || 44, gap = 8;
  let cx = x, cy = y;
  ctx.font = vfont(px);
  for (const it of items) {
    ctx.font = vfont(px, it.on ? 700 : 400);   // (a lit chip's bold label is wider)
    const sw = it.icon ? h - 10 : it.col ? 22 : 0, w = Math.min(W, ctx.measureText(it.label).width + 26 + sw);
    if (cx + w > x + W) { cx = x; cy += h + gap; }
    if (cy + h > maxY) break;
    vButton(ctx, P, it.id, cx, cy, w, h, '', it.fn, { r: 6, on: it.on });
    if (it.icon) PET_ICONS.draw(ctx, it.icon, cx + 8 + (h - 16) / 2, cy + h / 2, h - 14, { color: it.col || VC.ink, width: 2 });
    else if (it.col) swatch(ctx, cx + 12, cy + h / 2 - 7, 14, it.col);
    ctx.font = vfont(px, it.on ? 700 : 400); ctx.fillStyle = it.ink || VC.ink; ctx.textBaseline = 'middle';
    ctx.fillText(fitText(ctx, it.label, w - 26 - sw), cx + 13 + sw, cy + h / 2 + 1); ctx.textBaseline = 'top';
    cx += w + gap;
  }
  return cy + h - y;
}
//#use head~2 vSlider
function drawNetsPane(ctx, P, x, y, W, bottom) {
  const T = PD.D.table2, r = T[X.cmp], id = curNet(), ni = netInfo(id);
  y += head(ctx, x, y, 'Table 2: groups of scans compared (amber: a significant difference)');
  for (const [part, name] of [['health', 'From health to disease'], ['test', 'Is it robust?']]) {
    ctx.font = vfont(20, 700); ctx.fillStyle = VC.ink; ctx.fillText(name, x, y); y += 30;
    y += flow(ctx, P, T.map((t, i) => [t, i]).filter(([t]) => t.part === part).map(([t, i]) => ({ id: 'cmp:' + i, label: rowName(t), col: t.sigD || t.sigO ? VC.amber : null, on: X.cmp === i, fn: () => selectCmp(X.cmp === i ? -1 : i) })), x, y, W, bottom - 430, { px: 18, h: 36 }) + 10;
  }
  y += 4;
  if (r) {
    const nets = rowNets(r);
    y += textBlock(ctx, `${r.what}: ${r.cohort}`, x, y, W, 25, 34, VC.ink, 700, 1) + 4;
    r.groups.forEach((g, i) => {
      const n = nets[i] && NET_ALL.includes(nets[i]) ? nets[i] : null, on = n === id && X.scene === 'organs';
      // a group the paper drew as a network: a button that shows it (as the HTML pane's link)
      if (n) vButton(ctx, P, 'gnet:' + n, x + W - 130, y - 4, 130, 36, on ? 'On show' : 'Show', () => showNet(n), { on, r: 6, px: 19 });
      y += textBlock(ctx, `${g.label}: density ${pct(g.density)}, disorder ${dis(g.disorder)}, ${g.n} scans`, x, y, n ? W - 140 : W, 22, 30, VC.muted, 400, 1) + (n ? 8 : 0);
    });
    y += textBlock(ctx, `Density ${r.pD}${r.sigD ? ', significant' : ''}. Disorder ${r.pO}${r.sigO ? ', significant' : ''}.`, x, y, W, 22, 30, r.sigD || r.sigO ? VC.amber : VC.muted, 400, 1) + 4;
    // (what was measured in plain words, the row's own note, and a comparison with no network of its own)
    const nb = [WHAT_GLOSS[r.what] ? `${r.what}: ${WHAT_GLOSS[r.what]}.` : '', r.note, noNet() ? NO_NET : ''].filter(Boolean).join(' ');
    y += (nb ? textBlock(ctx, nb, x, y, W, 20, 27, VC.faint, 400, 3) : 0) + 8;
  }
  y += head(ctx, x, y, 'Networks drawn in the paper (· not read off the figure yet)');
  y += flow(ctx, P, NET_IDS.map((n, i) => ({ id: 'net:' + n, label: NET_SHORT[i] + (hasNet(n) ? '' : ' ·'), on: n === id && X.scene === 'organs', fn: () => pickNet(n) })), x, y, W, bottom, { px: 20, h: 40 }) + 12;
  y += textBlock(ctx, `${netShort(id)}: ${netTitle(id)}.`, x, y, W, 22, 30, VC.ink, 400, 2);
  y += textBlock(ctx, `${ni.text} ${ni.hubText || ''}`, x, y, W, 22, 30, VC.muted, 400, 3) + 10;
  const st = strengths(id).slice(0, 3);   // (the strongest organs in words, as the HTML pane)
  if (ni.ok && st.length && y + 100 < bottom) y += textBlock(ctx, `Strongest: ${st.map(([o, v]) => `${organName(o)} ${v.toFixed(1)}`).join(', ')} (strength: the sum of an organ's links' weights).`, x, y, W, 22, 30, VC.muted, 400, 2) + 10;
  if (FACTS.hk2 && y + 64 < bottom) textBlock(ctx, `Gene-activity networks (Table 3): of ${FACTS.tested}, only hexokinase 2's network resembles FDG's (r = ${FACTS.hk2.r}): the HK2 and GLUT networks above.`, x, y, W, 21, 29, VC.faint, 400, 2);
}
function drawOrgansPane(ctx, P, x, y, W, bottom) {
  y += flow(ctx, P, PD.D.organs.map(o => ({ id: 'org:' + o.id, label: o.short, icon: o.id, col: o.col, on: X.organ === o.id, fn: () => selectOrgan(X.organ === o.id ? null : o.id) })), x, y, W, bottom, { px: 21, h: 48 }) + 18;
  const id = X.organ, O = PD.byId[id];
  if (!O) { textBlock(ctx, `The ${FACTS.organs} organs of the paper and the aorta, the reference every organ is divided by. Pick one, or point at an organ, a bar or a node and pull the trigger (or pinch).`, x, y, W, 26, 38, VC.muted); return; }
  PET_ICONS.draw(ctx, id, x + 22, y + 22, 44, { color: O.col, width: 3, glow: true });
  y += textBlock(ctx, O.name, x + 60, y + 2, W - 60, 38, 46, VC.ink, 700, 1) + 6;
  y += textBlock(ctx, `Measured: ${O.measure}.`, x, y, W, 24, 33, VC.muted, 400, 2) + 2;
  y += textBlock(ctx, id === 'aorta' ? 'The unit: every organ\'s uptake is divided by the aorta\'s.' : `Typical uptake: ${O.suv} times the aorta's (illustrative).`, x, y, W, 24, 33, VC.muted, 400, 2) + 2;
  const hubIn = NET_ALL.filter(n => hasNet(n) && hubsOf(n).includes(id));
  const sv = PD.D.f2.organs.includes(id) && strengths('full').find(q => q[0] === id);
  if (sv) y += textBlock(ctx, `Strength: ${sv[1].toFixed(2)} in the network of all ${fmt(FACTS.scans)} scans.`, x, y, W, 24, 33, VC.muted, 400, 1) + 2;
  y += textBlock(ctx, `Hub in: ${hubIn.length ? listOf(hubIn.map(netShort)) : 'none of the networks drawn'}.`, x, y, W, 24, 33, hubIn.length ? VC.amber : VC.muted, 400, 2) + 14;
  if (!PD.D.f2.organs.includes(id)) { textBlock(ctx, id === 'aorta' ? 'Not a node: the blood pool.' : `Not in the network of all scans (Figure 2A has ${FACTS.f2n} organs); it appears in some of Figure 3's networks.`, x, y, W, 24, 33, VC.muted, 400, 2); return; }
  const e = edgesOf('full').filter(q => q[0] === id || q[1] === id).sort((a, b) => Math.abs(b[2]) - Math.abs(a[2]));
  y += head(ctx, x, y, `Its links among all ${fmt(FACTS.scans)} scans (Figure 2A; blue together, red opposite)`);
  flow(ctx, P, e.map(q => { const o = q[0] === id ? q[1] : q[0]; return { id: 'ol:' + o, label: `${PD.byId[o].short} ${q[2] > 0 ? '+' : '−'}${Math.abs(q[2]).toFixed(2)}`, icon: o, col: q[2] > 0 ? '#4c7cff' : '#ff4d4d', fn: () => selectOrgan(o) }; }), x, y, W, bottom, { px: 21, h: 46 });
}
// the scenes, and the chosen scene's own controls
function drawScenesPane(ctx, P, x, y, W, bottom) {
  const cw = (W - 12 * (SCENES.length - 1)) / SCENES.length;
  SCENES.forEach(([k, n], j) => vButton(ctx, P, 'scene:' + k, x + j * (cw + 12), y, cw, 56, n, () => openScene(k, true, true), { on: X.scene === k, px: 22 }));
  y += 76;
  const sc = SCENES.find(s => s[0] === X.scene);
  y += textBlock(ctx, sc[2], x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  for (const c of ctlsOf(X.scene).filter(c => ctlShown(X.scene, c))) {
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlLit(X.scene, c, v), fn: () => setCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
  if (X.scene === 'scan' && y + 70 < bottom) vButton(ctx, P, 'life', x, y, 300, 60, 'Life size', () => setLife(!X.life), { on: X.life, px: 24 });
}

//#use sigFoot drawFoot