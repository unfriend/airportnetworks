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
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.organ, X.domain, X.age, X.step, X.kind, X.tab === 'organs' ? GL.orgV || 0 : 0].join('|');
}
const XR_HERE = 'micro';
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
  fitTitle(ctx, 'Tissue and time', 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
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
  ({ organs: drawOrgansPane, domains: drawDomainsPane, age: drawAgePane, method: drawMethodPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
// buttons that wrap like the HTML chips: items -> { id, label, on, col, icon (an organ's model: ORGAN3D id), fn }
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
    if (it.icon) {   // (its picture, or a soft dot while it is drawn)
      const c = ORGAN3D.pic(it.icon), q = h - 8;
      if (c) ctx.drawImage(c, cx + 7, cy + 4, q, q);
      else { ctx.beginPath(); ctx.arc(cx + 7 + q / 2, cy + 4 + q / 2, q * 0.16, 0, 7); ctx.fillStyle = 'rgba(255,158,196,0.6)'; ctx.fill(); }
    }
    else if (it.col) swatch(ctx, cx + 12, cy + h / 2 - 7, 14, it.col);
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
  vSlider(ctx, P, 'age', x + 80, y, W - 160, X.age, AGE0, AGE1, VC.amber, v => setAge(v, true));
  return 60;
}
function drawOrgansPane(ctx, P, x, y, W, bottom) {
  const O = organOf(X.organ);
  y += flow(ctx, P, MD.organs.map(o => ({ id: 'org:' + o.name, label: o.name, icon: orgPic(o), on: O === o, fn: () => selectOrgan(O === o ? null : o.name) })), x, y, W, bottom, { px: 20, h: 42 }) + 18;
  if (!O) { textBlock(ctx, `The ${FACTS.organs} organs whose tissue GTEx collected. Pick one, or point at an organ's light in the body, a section in the atlas or a node of the network and pull the trigger (or pinch).`, x, y, W, 26, 38, VC.muted); return; }
  const oi = orgPic(O), oc = oi && ORGAN3D.pic(oi);
  if (oc) ctx.drawImage(oc, x - 4, y - 6, 58, 58);
  y += textBlock(ctx, O.name, x + (oc ? 60 : 0), y + 2, W - 60, 38, 46, VC.ink, 700, 1) + 10;
  const tis = O.tissues.length ? O.tissues : [O.name];
  y += head(ctx, x, y, tis.length > 1 ? `Its ${word(tis.length)} tissues in GTEx: pick one to see its section` : 'One tissue in GTEx');
  y += flow(ctx, P, tis.map(t => ({ id: 'tis:' + t, label: tisShort(t, O.name), col: LEVEL_COL[1], on: X.organ === t || (tis.length > 1 && X.organ === O.name && t === tis[0]), fn: () => selectOrgan(t) })), x, y, W, bottom, { px: 21, h: 44 }) + 14;
  y += head(ctx, x, y, 'Its tissue types in the network (domains on each)');
  y += flow(ctx, P, O.types.map(t => ({ id: 'kind:' + t, label: `${cap(nodeName(t))} · ${MD.typeDomains(t).length}`, col: LEVEL_COL[2], fn: () => { pickKind(nodeName(t)); showTab('domains'); } })), x, y, W, bottom, { px: 21, h: 44 }) + 14;
  if (y + 100 > bottom) return;
  y += head(ctx, x, y, 'Show it');
  flow(ctx, P, [{ id: 'sh:map', label: 'Its section', on: X.scene === 'atlas' && viewIs('atlas', VIEW.map), fn: () => showView('atlas', VIEW.map) },
    { id: 'sh:net', label: 'In the network', on: X.scene === 'hier' && viewIs('hier', VIEW.net), fn: () => showView('hier', VIEW.net) },
    { id: 'sh:body', label: 'In the body', on: X.scene === 'body', fn: () => openScene('body') }], x, y, W, bottom, { px: 22, h: 50 });
}
function drawDomainsPane(ctx, P, x, y, W, bottom) {
  const d = X.domain ? MD.domain(X.domain) : -1, td = d >= 0 ? MD.typeOfDomain(d) : -1;
  // the tissue type listed: the one picked here, else the domain's
  const kinds = MD.types.filter(t => MD.typeDomains(t).length), kt = X.kind && MD.type(X.kind) >= 0 ? MD.type(X.kind) : td >= 0 ? td : kinds[0];
  y += head(ctx, x, y, 'Tissue types: pick one, then a domain');
  y += flow(ctx, P, kinds.map(t => ({ id: 'kind:' + t, label: cap(nodeName(t)), col: LEVEL_COL[2], on: t === kt, fn: () => pickKind(nodeName(t)) })), x, y, W, bottom, { px: 20, h: 42 }) + 16;
  y += head(ctx, x, y, `${cap(nodeName(kt))}: its ${MD.typeDomains(kt).length} domains in this map`);
  y += flow(ctx, P, MD.typeDomains(kt).map(j => ({ id: 'dom:' + j, label: cap(nodeName(j)), col: domCol(nodeName(j)), on: j === d, fn: () => selectDomain(j === d ? null : nodeName(j)) })), x, y, W, bottom - 220, { px: 20, h: 42 }) + 18;
  if (d < 0) { textBlock(ctx, 'Or point at a domain on the section or a node of the network and pull the trigger (or pinch).', x, y, W, 24, 34, VC.muted, 400, 2); return; }
  ctx.fillStyle = VC.line; ctx.fillRect(x, y, W, 2); y += 14;
  swatch(ctx, x, y + 10, 26, domCol(X.domain));
  y += textBlock(ctx, cap(X.domain), x + 40, y + 2, W - 40, 34, 42, VC.ink, 700, 1) + 6;
  const org = td >= 0 ? MD.typeOrgans(td) : [];
  y += textBlock(ctx, td >= 0 ? `Tissue type: ${nodeName(td)}. ${org.length} organs have ${nodeName(td)}; the network does not say which of them have this domain: ${listOf(org.map(o => o.name))}.` : 'Tissue type: –.', x, y, W, 22, 30, VC.muted, 400, clamp(Math.floor((bottom - y - 70) / 30), 3, 5)) + 10;   // (the organs' list as far as there is room)
  const si = slideIdx(X.domain);
  flow(ctx, P, [{ id: 'sh:net', label: 'In the network', on: X.scene === 'hier', fn: () => showView('hier', VIEW.net) }].concat(si ? [{ id: 'sh:slide', label: 'On the section', on: X.scene === 'slide', fn: () => showView('slide', VIEW.sAge) }] : []), x, y, W, bottom, { px: 22, h: 50 });
}
function drawAgePane(ctx, P, x, y, W, bottom) {
  const F = FACTS, e = exOn(), exCol = ['#ff9ec4', '#ffd166', '#c77dff'];
  y += textBlock(ctx, `Age is the strongest of ${F.donorVars} things known about the donors. ${pct(F.ageChange)} of domains change with it, mostly by less than ${pct(F.mostUnder)} per decade.`, x, y, W, 24, 33, VC.muted, 400, 3) + 12;
  y += head(ctx, x, y, 'Worked examples');
  y += flow(ctx, P, F.ex.map((q, i) => ({ id: 'ex:' + i, label: exName(q), col: exCol[i], on: e === i, fn: () => showExample(i) })), x, y, W, bottom, { px: 22, h: 50 }) + 10;
  if (e >= 0) y += textBlock(ctx, cap(exText(F.ex[e])) + '.', x, y, W, 23, 32, VC.ink, 400, 3) + 10;
  y += drawAge(ctx, P, x, y, W) + 14;
  y += head(ctx, x, y, 'Across the body');
  y += flow(ctx, P, [{ id: 'v:volcano', label: 'What changes', on: X.scene === 'atlas' && viewIs('atlas', VIEW.volcano), fn: () => showView('atlas', VIEW.volcano) },
    { id: 'v:curves', label: 'Pathology', on: X.scene === 'atlas' && viewIs('atlas', VIEW.curves), fn: () => showView('atlas', VIEW.curves) },
    { id: 'v:contacts', label: 'Contacts', on: X.scene === 'hier' && viewIs('hier', VIEW.contacts), fn: () => showView('hier', VIEW.contacts) }], x, y, W, bottom, { px: 22, h: 50 }) + 16;
  if (y + 70 < bottom) textBlock(ctx, `${F.connective} ${F.most}`, x, y, W, 21, 29, VC.faint, 400, 3);
}
function drawMethodPane(ctx, P, x, y, W, bottom) {
  const F = FACTS, s = STEPS[X.step - 1];
  y += textBlock(ctx, `How ${F.method} finds domains in ${fmt(F.slides)} slides without being told what to look for, in four steps.`, x, y, W, 24, 33, VC.muted, 400, 2) + 14;
  const sw = (W - 3 * 12) / 4;
  STEPS.forEach(([n], i) => vButton(ctx, P, 'step:' + i, x + i * (sw + 12), y, sw, 60, `${i + 1} · ${n}`, () => setStep(i + 1), { on: X.step === i + 1 && X.scene === 'slide', px: 22 }));
  y += 84;
  y += textBlock(ctx, `${X.step} · ${s[0]}`, x, y, W, 38, 46, VC.ink, 700, 1) + 6;
  y += textBlock(ctx, s[2](), x, y, W, 27, 38, VC.ink, 400, 4) + 18;
  if (X.step > 1) vButton(ctx, P, 'step:back', x, y, 160, 56, 'Back', () => setStep(X.step - 1), { px: 23 });
  if (X.step < STEPS.length) vButton(ctx, P, 'step:next', x + 172, y, 160, 56, 'Next', () => setStep(X.step + 1), { px: 23 });
  y += 80;
  y += head(ctx, x, y, 'Then');
  y += flow(ctx, P, [{ id: 'v:umap', label: 'The tiles in one map', on: X.scene === 'atlas' && viewIs('atlas', VIEW.umap), fn: () => showView('atlas', VIEW.umap) },
    { id: 'v:map', label: 'The atlas', on: X.scene === 'atlas' && viewIs('atlas', VIEW.map), fn: () => showView('atlas', VIEW.map) }], x, y, W, bottom, { px: 22, h: 50 }) + 18;
  if (y + 70 < bottom) textBlock(ctx, `It agrees with pathologists' notes: salivary gland r = ${F.bench.salivary.r}, stomach mucosa r = ${F.bench.stomach.r} (1 would be perfect). The result: ${F.domains} domains of ${F.types} types.`, x, y, W, 21, 29, VC.faint, 400, 3);
}
// the four scenes, and the chosen scene's own controls (and the age, where the scene shows it)
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