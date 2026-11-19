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
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.endo, X.gene, X.k, X.step, X.gap, XR.kbd.open, XR.kbd.q].join('|');
}
const XR_HERE = 'endo';
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
  fitTitle(ctx, 'Endotypes', 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, HOST.room && HOST.room.inRoom() ? HOST.room.gripHint : HOST.anchor.on ? 'Trigger (or pinch): use buttons. Anchored: to move things, use Place again in the menu.' : XR.free ? 'Trigger (or pinch): use buttons. Grip: hold the scene or this panel to move and turn it; both grips on the scene resize it.' : 'Trigger (or pinch): use buttons. Grip: move the scene or this panel; both grips on the scene resize it.', 44, P.h - 74, P.w - 88, 22, 30, VC.faint);
  } else drawExplorePane(ctx, P, 40, 120, P.w - 80);
}

//#use STY storyOpacity FADEB drawStoryPane
function drawStoryEl(ctx, P, el, x, y, W, pa) {
  const a = pa * storyOpacity(el), tag = el.tagName.toUpperCase(), cl = el.classList;
  ctx.globalAlpha = a;
  let h = 0;
  if (tag === 'SVG') {
    // the title's route arc, drawn as it grows
    const k = 1.5, arc = el.querySelector('#titleArc'), dot = el.querySelector('#titleDot');
    const prog = arc ? clamp(1 - parseFloat(arc.getAttribute('stroke-dashoffset') || '1'), 0, 1) : 1;
    const dA = dot ? parseFloat(dot.getAttribute('opacity') || '0') : 1;
    const p0 = [x + 8 * k, y + 36 * k], c1 = [x + 180 * k, y - 16 * k], p1 = [x + 352 * k, y + 36 * k];
    const bz = (s, j) => (1 - s) * (1 - s) * p0[j] + 2 * (1 - s) * s * c1[j] + s * s * p1[j];
    ctx.strokeStyle = VC.amber; ctx.lineWidth = 3.3; ctx.lineCap = 'round';
    if (prog > 0.002) {
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]);
      for (let n = 1; n <= 48; n++) { const s = prog * n / 48; ctx.lineTo(bz(s, 0), bz(s, 1)); }
      ctx.stroke();
    }
    ctx.fillStyle = VC.amber;
    ctx.beginPath(); ctx.arc(p0[0], p0[1], 4.5 * k, 0, 7); ctx.fill();
    ctx.globalAlpha = a * Math.round(dA * 4) / 4;
    ctx.beginPath(); ctx.arc(p1[0], p1[1], 4.5 * k, 0, 7); ctx.fill();
    h = 44 * k + 8;
  } else if (tag === 'H1' || tag === 'H2') {
    const s = STY[tag];
    h = textBlock(ctx, el.textContent, x, y, W, s.px, s.lh, VC.ink, s.w) + s.mb;
  } else if (tag === 'P') {
    const btn = el.querySelector('button');
    if (btn) {
      if (a > 0.3) vButton(ctx, P, 'goExplore', x, y, 380, 68, btn.textContent, () => APP.enterExplore(), { primary: true, px: 27 });
      h = 68 + 22;
    } else {
      const s = cl.contains('lede') ? STY.lede : cl.contains('note') ? STY.note : cl.contains('caption') ? STY.caption
        : cl.contains('credits') ? STY.credits : cl.contains('step') ? STY.step : STY.p;
      const col = ['amber', 'magenta', 'green', 'red', 'cyan'].find(c => cl.contains(c));
      h = textBlock(ctx, el.textContent, x, y, W, s.px, s.lh, col ? VC[col] : VC[s.c], s.w) + s.mb;
    }
  } else if (cl.contains('big')) {
    const col = ['magenta', 'cyan', 'green', 'amber', 'red'].find(c => cl.contains(c));
    const small = el.querySelector('small'), all = el.textContent;
    const main = (small ? all.slice(0, all.length - small.textContent.length) : all).trim();
    ctx.font = vfont(96, 700); ctx.fillStyle = col ? VC[col] : VC.ink;
    ctx.fillText(main, x, y + 2);
    if (small) { const w = ctx.measureText(main).width; ctx.font = vfont(32); ctx.fillStyle = VC.muted; ctx.fillText(small.textContent, x + w + 16, y + 52); }
    h = 112;
  } else if (cl.contains('bars')) {
    const bars = [...el.children], n = bars.length, gap = 8, bw = (W - gap * (n - 1)) / n, top = y + 28, bh = 150;
    bars.forEach((b, k) => {
      const v = b.querySelector('.v'), f = b.querySelector('.fill'), kk = b.querySelector('.k');
      const hp = parseFloat(f.style.height) || 0, m = /scaleY\(([\d.]+)\)/.exec(f.style.transform || '');
      const s = m ? Math.round(parseFloat(m[1]) * 6) / 6 : 1, full = bh * hp / 100, bx = x + k * (bw + gap);
      ctx.fillStyle = cssColor(f.style.background || f.style.backgroundColor);
      if (s > 0) ctx.fillRect(bx, top + bh - full * s, bw, full * s);
      ctx.font = vfont(21); ctx.textAlign = 'center';
      ctx.fillStyle = VC.ink;
      if (v && v.textContent) ctx.fillText(v.textContent, bx + bw / 2, top + bh - full - 24);
      ctx.fillStyle = b.classList.contains('hl') ? VC.ink : VC.muted;
      if (kk) ctx.fillText(kk.textContent, bx + bw / 2, top + bh + 8);
      ctx.textAlign = 'left';
    });
    h = 28 + bh + 44;
  } else if (tag === 'UL' && cl.contains('legend')) {
    let yy = y;
    for (const li of el.children) {
      ctx.globalAlpha = a * storyOpacity(li);
      const sw = li.querySelector('.sw');
      swatch(ctx, x, yy + 10, 24, sw ? cssColor(sw.style.background) : VC.ink);
      ctx.font = vfont(30); ctx.fillStyle = VC.ink;
      ctx.fillText(li.textContent.trim(), x + 40, yy + 5);
      yy += 46;
    }
    h = yy - y + 12;
  } else if (cl.contains('facts')) {
    // a row of big numbers, each fading in on its own
    const cells = [...el.children], cw = W / cells.length;
    cells.forEach((c, k) => {
      ctx.globalAlpha = a * storyOpacity(c);
      const b = c.querySelector('b'), sm = c.querySelector('small');
      ctx.font = vfont(50, 700); ctx.fillStyle = VC.amber; ctx.fillText(fitText(ctx, b ? b.textContent : '', cw - 16), x + k * cw, y);
      if (sm) textBlock(ctx, sm.textContent, x + k * cw, y + 68, cw - 16, 25, 32, VC.muted, 400, 2);
    });
    h = 68 + 64 + 18;
  } else if (tag === 'UL' && cl.contains('steps')) {
    // points with a bold name over a line of text, each fading in on its own
    let yy = y;
    for (const li of el.children) {
      ctx.globalAlpha = a * storyOpacity(li);
      const b = li.querySelector('b'), bold = b ? b.textContent : '', rest = li.textContent.slice(bold.length).trim();
      const col = li.style.borderLeftColor || VC.amber;   // an endotype's point in its own colour
      const hh = 36 + textBlock(ctx, rest, x + 22, yy + 40, W - 22, 28, 38, VC.ink, 400, 4);
      ctx.fillStyle = col; ctx.fillRect(x, yy + 4, 5, hh);
      ctx.font = vfont(30, 700); ctx.fillStyle = col; ctx.fillText(bold, x + 22, yy);
      yy += hh + 16;
    }
    h = yy - y + 8;
  } else if (tag === 'UL' && cl.contains('concepts')) {
    let cx = x, cy = y;
    ctx.font = vfont(27);
    for (const li of el.children) {
      const t = li.textContent, w = ctx.measureText(t).width + 28;
      if (cx + w > x + W) { cx = x; cy += 54; }
      rr(ctx, cx, cy, w, 46, 6); ctx.fillStyle = VC.chip; ctx.fill();
      ctx.fillStyle = VC.ink; ctx.fillText(t, cx + 14, cy + 9);
      cx += w + 9;
    }
    h = cy - y + 46 + 26;
  } else if (tag === 'DIV') {
    // a grid of overlapping paragraphs (one fades out as the next fades in)
    let mh = 0;
    for (const c of el.children) mh = Math.max(mh, drawStoryEl(ctx, P, c, x, y, W, a) - y);
    h = mh;
  } else if (el.textContent.trim()) {
    h = textBlock(ctx, el.textContent, x, y, W, 26, 38, VC.ink) + 14;
  }
  ctx.globalAlpha = 1;
  return y + h;
}


// explore: tabs and panes mirroring the HTML ones
function drawExplorePane(ctx, P, x, y, W) {
  const tw = W / TABS.length;
  TABS.forEach(([k, n], j) => {
    const on = X.tab === k, tx = x + j * tw, hov = P.hover === 'tab:' + k;
    if (hov && !on) { rr(ctx, tx + 4, y, tw - 8, 62, 8); ctx.fillStyle = VC.chip; ctx.fill(); }
    ctx.font = vfont(24, on ? 700 : 400); ctx.fillStyle = on ? VC.ink : VC.muted;
    ctx.textAlign = 'center'; ctx.fillText(n, tx + tw / 2, y + 18); ctx.textAlign = 'left';
    if (on) { ctx.fillStyle = VC.cyan; ctx.fillRect(tx + 10, y + 58, tw - 20, 4); }
    P.regions.push({ id: 'tab:' + k, x: tx, y, w: tw, h: 64, fn: () => { XR.kbd.open = false; showTab(k); } });
  });
  ctx.fillStyle = VC.line; ctx.fillRect(x, y + 62, W, 2);
  y += 88;
  const bottom = P.h - 34;
  if (XR.kbd.open && X.tab === 'genes') return drawKeyboard(ctx, P, x, y, W);
  ({ endo: drawEndoPane, genes: drawGenePane, method: drawMethodPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
//#use searchField
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
    ctx.font = vfont(px, it.on ? 700 : 400); ctx.fillStyle = VC.ink; ctx.textBaseline = 'middle';
    ctx.fillText(fitText(ctx, it.label, w - 26 - sw), cx + 13 + sw, cy + h / 2 + 1); ctx.textBaseline = 'top';
    cx += w + gap;
  }
  return cy + h - y;
}
//#use head~2
function drawEndoPane(ctx, P, x, y, W, bottom) {
  y += flow(ctx, P, ED.endo.map(e => ({ id: 'en:' + e.id, label: `${e.id} · ${e.name}`, col: e.col, on: X.endo === e.id, fn: () => selectEndo(X.endo === e.id ? -1 : e.id) })), x, y, W, bottom, { px: 21, h: 44 }) + 18;
  const id = X.endo, E = ED.endo[id];
  if (!E) { textBlock(ctx, `Pick one of the ${ED.endo.length} endotypes the authors found among the ${ED.M} genes of the CMS module, to see its genes and where it works.`, x, y, W, 26, 38, VC.muted); return; }
  const mem = ED.members[id], seeds = mem.filter(i => ED.genes[i].seed >= 0), L = linksIn(id);
  swatch(ctx, x, y + 9, 26, E.col);
  y += textBlock(ctx, endoName(id), x + 40, y, W - 40, 36, 44, VC.ink, 700, 1) + 6;
  y += textBlock(ctx, `${mem.length} genes, ${seeds.length ? `${seeds.length} of them ${seeds.length === 1 ? 'a seed' : 'seeds'}` : 'no seed'}. ${L ? `${L} links among them.` : 'No links among them: a loose cloud.'}`, x, y, W, 24, 34, VC.muted, 400, 2) + 4;
  y += textBlock(ctx, `Strongest term: ${E.term} (${STRONG[E.strong]}, adjusted p ${fmtP(E.p)}; clear means p under 0.01).`, x, y, W, 24, 34, VC.muted, 400, 2) + 4;
  y += textBlock(ctx, `Drawn at: ${E.place ? PLACE[E.place] || E.place : 'no shared place'}.`, x, y, W, 24, 34, VC.muted, 400, 2) + 14;
  y += flow(ctx, P, SHOW_IN.map(([k, n]) => ({ id: 'show:' + k, label: n, on: X.scene === k, fn: () => showEndoIn(k) })), x, y, W, bottom, { px: 23, h: 52 }) + 16;
  y += head(ctx, x, y, 'Its genes (seeds marked ●)');
  flow(ctx, P, seeds.concat(mem.filter(i => ED.genes[i].seed < 0)).map(i => ({ id: 'eg:' + i, label: (ED.genes[i].seed >= 0 ? '● ' : '') + ED.genes[i].sym, fn: () => { showTab('genes'); selectGene(i); } })), x, y, W, bottom, { px: 20, h: 38 });
}
function drawGenePane(ctx, P, x, y, W, bottom) {
  searchField(ctx, P, x, y, W, 'Search a gene of the module');
  y += 90;
  const i = X.gene;
  if (i < 0) {
    y += textBlock(ctx, `Point at a gene in the network or the tree and pull the trigger (or pinch). The ${ED.M} genes are those of the CMS module: ${FACTS.seeds} seeds and ${FACTS.found} the walk found.`, x, y, W, 26, 38, VC.muted) + 20;
    flow(ctx, P, QUICK.map(geneIdx).filter(k => k >= 0).map(k => ({ id: 'qk:' + k, label: ED.genes[k].sym, col: endoCol(ED.genes[k].endo), fn: () => selectGene(k) })), x, y, W, bottom, { px: 24, h: 52 });
    return;
  }
  const G = ED.genes[i], S = G.seed >= 0 ? ED.seeds[G.seed] : null, hood = ED.hoodOf(i), inMod = hood.filter(j => j < ED.M).length;
  y += textBlock(ctx, G.sym, x, y, W, 42, 48, VC.ink, 700, 1) + 2;
  y += textBlock(ctx, S ? `${S[1]}. A seed: Gene Table item ${S[2]}.` : 'Found by the walk: not one of the ' + FACTS.seeds + ' Gene Table seeds, but close to them.', x, y, W, 23, 32, VC.muted, 400, 2) + 12;
  y += flow(ctx, P, [{ id: 'gen:' + G.endo, label: 'Endotype ' + endoName(G.endo), col: endoCol(G.endo), on: X.endo === G.endo, fn: () => selectEndo(X.endo === G.endo ? -1 : G.endo) }], x, y, W, bottom, { px: 23, h: 50 }) + 12;
  y += textBlock(ctx, `${G.terms.length} cell parts in its row of the matrix; ${G.nb.length} links to genes of the module; ${hood.length} neighbours, ${inMod} of them in the module.`, x, y, W, 24, 34, VC.muted, 400, 3) + 10;
  vButton(ctx, P, 'ghood', x, y, 380, 56, 'Show its neighbourhood', showHood, { px: 23, on: X.scene === 'net' });
  vButton(ctx, P, 'gtree', x + 396, y, 320, 56, 'Show it in the tree', () => showInTree(i), { px: 23, on: X.scene === 'tree' });
  y += 76;
  if (G.terms.length) { y += head(ctx, x, y, 'Cell parts in its row'); y += textBlock(ctx, G.terms.map(t => ED.terms[t]).join(', '), x, y, W, 22, 30, VC.ink, 400, 4) + 12; }
  if (G.nb.length && y + 80 < bottom) {
    y += head(ctx, x, y, 'Linked genes in the module');
    flow(ctx, P, G.nb.map(j => ({ id: 'nb:' + j, label: ED.genes[j].sym, col: endoCol(ED.genes[j].endo), fn: () => selectGene(j) })), x, y, W, bottom, { px: 21, h: 40 });
  }
}
// the method's steps, one at a time, each with its control
function drawMethodPane(ctx, P, x, y, W, bottom) {
  y += flow(ctx, P, METHOD.map(([k, n], j) => ({ id: 'st:' + j, label: `${j + 1} · ${n}`, on: X.step === j, fn: () => showStep(j) })), x, y, W, bottom, { px: 23, h: 52 }) + 18;
  const st = METHOD[X.step][0];
  y += textBlock(ctx, methodText(st), x, y, W, 26, 37, VC.ink, 400, 5) + 18;
  const ctlRow = (k, key) => {
    const c = ctlOf(k, key);
    if (!c) return;
    y += head(ctx, x, y, c.label);
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'mc:' + k + ':' + key + ':' + v, label: n, on: ctlValue(k, c) === v, fn: () => setCtl(k, key, v) })), x, y, W, bottom, { px: 23, h: 52 }) + 14;
  };
  if (st === 'groups') {
    y += head(ctx, x, y, 'Neighbourhood size k · groups');
    y += flow(ctx, P, ED.groups.map((g, j) => ({ id: 'k:' + j, label: `k = ${g.k} · ${g.n}`, on: X.k === j, fn: () => setK(j) })), x, y, W, bottom, { px: 21, h: 46 }) + 14;
  }
  if (st === 'walk') { ctlRow('net', 'walkers'); ctlRow('net', 'view'); }
  if (st === 'hood') {
    const cur = X.gene >= 0 ? X.gene : STORY_IDX(), list = [...new Set([cur, ...HOOD_GENES()])].filter(i => i >= 0);
    y += head(ctx, x, y, 'A gene (or search any in Genes)');
    y += flow(ctx, P, list.map(i => ({ id: 'hg:' + i, label: ED.genes[i].sym, col: endoCol(ED.genes[i].endo), on: i === cur, fn: () => { selectGene(i, false); showStep(2); } })), x, y, W, bottom, { px: 22, h: 46 }) + 14;
  }
  if (st === 'tree') { ctlRow('tree', 'view'); vButton(ctx, P, 'replay', x, y, 340, 60, 'Replay the tests', replayTests, { primary: true, px: 24 }); y += 80; }
  if (st === 'endo') y += flow(ctx, P, SHOW_IN.slice(0, 2).map(([k, n]) => ({ id: 'ms:' + k, label: n, on: X.scene === k, fn: () => showEndoIn(k) })), x, y, W, bottom, { px: 23, h: 52 }) + 14;
  // the illustrative note, at the foot of the pane
  const nh = 4 * 30;
  if (y + 10 < bottom - nh) textBlock(ctx, NOTE, x, bottom - nh, W, 21, 30, VC.faint, 400, 4);
}
// the four scenes, and the chosen scene's own controls
function drawScenesPane(ctx, P, x, y, W, bottom) {
  const cw = (W - 12 * (SCENES.length - 1)) / SCENES.length;
  SCENES.forEach(([k, n], j) => vButton(ctx, P, 'scene:' + k, x + j * (cw + 12), y, cw, 56, n, () => openScene(k), { on: X.scene === k, px: 22 }));
  y += 76;
  const sc = SCENES.find(s => s[0] === X.scene), s = GL.sets[X.scene];
  y += textBlock(ctx, sc[2], x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  for (const c of s.controls || []) {
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => setCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
  if (X.scene === 'syn' && y + 70 < bottom) vButton(ctx, P, 'gap', x, y, 360, 60, 'Stand in the gap', () => setGap(!X.gap), { on: X.gap, px: 24 });
}
//#use KROWS
function drawKeyboard(ctx, P, x, y, W) {
  const kb = XR.kbd;
  ctx.font = vfont(22); ctx.fillStyle = VC.muted;
  ctx.fillText('Search a gene of the module by its symbol, or a cell part like SYNAPSE', x, y);
  y += 36;
  rr(ctx, x, y, W, 70, 10); ctx.fillStyle = 'rgba(149,166,189,0.10)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = VC.cyan; ctx.stroke();
  ctx.font = vfont(32); ctx.fillStyle = kb.q ? VC.ink : VC.faint;
  ctx.fillText(kb.q || 'Type with the keys below', x + 20, y + 18);
  if (kb.q) { const w = ctx.measureText(kb.q).width; ctx.fillStyle = VC.cyan; ctx.fillRect(x + 24 + w, y + 16, 3, 38); }
  y += 88;
  const sug = matches(kb.q, 5);
  if (kb.q && !sug.length) textBlock(ctx, `No gene matches “${kb.q}”.`, x, y, W, 25, 36, VC.muted);
  sug.forEach((i, k) => {
    const yy = y + k * 60;
    vButton(ctx, P, 'sug:' + i, x, yy, W, 54, '', () => xrPickSuggestion(i), { r: 8 });
    const g = ED.genes[i];
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(g.sym, x + 16, yy + 14);
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, g.seed >= 0 ? ED.seeds[g.seed][1] : 'found by the walk', W - 470), x + 170, yy + 15);
    ctx.fillStyle = endoCol(g.endo); ctx.textAlign = 'right'; ctx.fillText(fitText(ctx, endoName(g.endo), 270), x + W - 16, yy + 15); ctx.textAlign = 'left';
  });
  const kw = 84, kh = 70, g = 9, ky0 = P.h - 34 - 4 * kh - 3 * g;
  KROWS.forEach((row, r) => {
    const rw = row.length * kw + (row.length - 1) * g, rx = x + (W - rw) / 2 - (r === 2 ? 50 : 0);
    [...row].forEach((ch, k) => vButton(ctx, P, 'key:' + ch, rx + k * (kw + g), ky0 + r * (kh + g), kw, kh, ch,
      () => { kb.q = (kb.q + ch).slice(0, 24); }, { px: 28 }));
    if (r === 2) vButton(ctx, P, 'key:back', rx + rw + g, ky0 + r * (kh + g), 2 * kw, kh, '⌫ Delete', () => { kb.q = kb.q.slice(0, -1); }, { px: 24 });
  });
  // gene symbols have digits (SNAP25, LAMA5): a row of them above the letters
  const rw0 = 10 * kw + 9 * g, rx0 = x + (W - rw0) / 2;
  [...'1234567890'].forEach((ch, k) => vButton(ctx, P, 'key:' + ch, rx0 + k * (kw + g), ky0 - kh - g, kw, kh, ch, () => { kb.q = (kb.q + ch).slice(0, 24); }, { px: 28 }));
  const by = ky0 + 3 * (kh + g);
  vButton(ctx, P, 'key:dash', x + 40, by, 380, kh, '- (dash)', () => { kb.q = (kb.q + '-').slice(0, 24); }, { px: 24 });
  vButton(ctx, P, 'key:clear', x + 432, by, 170, kh, 'Clear', () => { kb.q = ''; }, { px: 24 });
  vButton(ctx, P, 'key:done', x + 614, by, 290, kh, sug.length ? 'Choose ' + ED.genes[sug[0]].sym : 'Close', () => {
    if (sug.length) xrPickSuggestion(sug[0]); else kb.open = false;
  }, { px: 24, primary: !!sug.length });
}

//#use sigFoot drawFoot