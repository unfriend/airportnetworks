//#use head VC vfont cssColor rr wrapLines textBlock fitText fitTitle vButton swatch makePanel panelDepth panelTick
//#use panelPaint FADE FADECV panelFade panelSend panelPatch
//#use sigMain
const sigMainS = () => '';
// explore mode in the main panel's signature (sigMain)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl[X.scene] || {}), X.sel, X.path ? routeNames(X.path).join(',') : '', X.pathErr || '',
    XR.kbd.open, XR.kbd.q, XR.pf, XR.pt, XR.pick, XR.routing].join('|');
}
const XR_HERE = 'lbi';
const XR_TITLE = 'LBI NetMed tour';
// the story's points (ul.steps) on the headset's panel (drawStoryEl): lines at most, and the colour of one without
// its own
const XR_STEP_LINES = 3, XR_STEP_COL = 'var(--amber)';
//#use XR_STORIES XR_LAND xrLandingSetup xrLandingCards xrLandingClose drawLandHead drawLandCard drawStoriesPane
//#use xrHint drawMain

//#use STY storyOpacity FADEB drawStoryPane drawStoryEl
// explore: tabs and panes mirroring the HTML ones
function drawExplorePane(ctx, P, x, y, W) {
  const tw = W / TABS.length;
  TABS.forEach(([k, n], j) => {
    const on = X.tab === k, tx = x + j * tw, hov = P.hover === 'tab:' + k;
    if (hov && !on) { rr(ctx, tx + 4, y, tw - 8, 62, 8); ctx.fillStyle = VC.chip; ctx.fill(); }
    ctx.font = vfont(26, on ? 700 : 400); ctx.fillStyle = on ? VC.ink : VC.muted;
    ctx.textAlign = 'center'; ctx.fillText(n, tx + tw / 2, y + 18); ctx.textAlign = 'left';
    if (on) { ctx.fillStyle = VC.cyan; ctx.fillRect(tx + 12, y + 58, tw - 24, 4); }
    P.regions.push({ id: 'tab:' + k, x: tx, y, w: tw, h: 64, fn: () => { XR.kbd.open = false; showTab(k); } });
  });
  ctx.fillStyle = VC.line; ctx.fillRect(x, y + 62, W, 2);
  y += 92;
  const bottom = P.h - 34;
  if (XR.kbd.open && X.tab === 'protein') return drawKeyboard(ctx, P, x, y, W);
  if (X.tab === 'scenes') drawScenesPane(ctx, P, x, y, W, bottom);
  else drawProteinPane(ctx, P, x, y, W, bottom);
}
//#use searchField
function chipFlow(ctx, P, items, x, y, W, maxY, label, fn, idp, colorOf) {
  let cx = x, cy = y, shown = 0;
  ctx.font = vfont(23);
  for (const it of items) {
    const t = label(it), col = colorOf ? colorOf(it) : null, sw = col ? 22 : 0, w = ctx.measureText(t).width + 26 + sw;
    if (cx + w > x + W) { cx = x; cy += 50; }
    if (cy + 42 > maxY) break;
    vButton(ctx, P, idp + it, cx, cy, w, 42, '', () => fn(it), { r: 6 });
    if (col) swatch(ctx, cx + 12, cy + 14, 14, col);
    ctx.font = vfont(23); ctx.fillStyle = VC.ink; ctx.textBaseline = 'middle';
    ctx.fillText(t, cx + 13 + sw, cy + 22); ctx.textBaseline = 'top';
    cx += w + 8; shown++;
  }
  return { h: cy - y + 42, shown };
}
// the scenes of the tour, and the chosen scene's own controls
function drawScenesPane(ctx, P, x, y, W, bottom) {
  const cw = (W - 12) / 2;
  SCENES.forEach(([k, n], j) => {
    const bx = x + (j % 2) * (cw + 12), by = y + Math.floor(j / 2) * 66;
    vButton(ctx, P, 'scene:' + k, bx, by, cw, 56, n, () => openScene(k), { on: X.scene === k, px: 25, left: true });
  });
  y += Math.ceil(SCENES.length / 2) * 66 + 14;
  const sc = SCENES.find(s => s[0] === X.scene), s = GL.sets[X.scene];
  y += textBlock(ctx, sc[2], x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  for (const c of s.controls || []) {
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    let bx = x, by = y;
    ctx.font = vfont(24);
    for (const [v, n] of c.options) {
      const w = Math.max(110, ctx.measureText(n).width + 40);
      if (bx + w > x + W) { bx = x; by += 66; }
      vButton(ctx, P, 'ctl:' + c.key + ':' + v, bx, by, w, 56, n, () => setCtl(X.scene, c.key, v), { on: ctlValue(X.scene, c) === v, px: 24 });
      bx += w + 10;
    }
    y = by + 80;
  }
}
// search the named proteins, show one, or trace a route between two
function drawProteinPane(ctx, P, x, y, W, bottom) {
  const C0 = INT().core, bw = (W - 12) / 2;
  vButton(ctx, P, 'pmode:info', x, y, bw, 54, 'One protein', () => { XR.routing = false; }, { on: !XR.routing, px: 24 });
  vButton(ctx, P, 'pmode:route', x + bw + 12, y, bw, 54, 'Route between two', () => { XR.routing = true; }, { on: !!XR.routing, px: 24 });
  y += 72;
  searchField(ctx, P, x, y, W, XR.routing ? `Search the ${XR.pick === 'from' ? 'From' : 'To'} protein` : 'Search a protein');
  y += 92;
  if (XR.routing) {
    [['from', 'From', XR.pf], ['to', 'To', XR.pt]].forEach(([k, lab, i], j) => {
      const bx = x + j * (bw + 12), on = XR.pick === k;
      vButton(ctx, P, 'end:' + k, bx, y, bw, 98, '', () => { XR.pick = k; }, { on });
      ctx.font = vfont(21); ctx.fillStyle = on ? VC.cyan : VC.muted; ctx.fillText(on ? lab + ' (point at one)' : lab, bx + 16, y + 14);
      ctx.font = vfont(28, 700); ctx.fillStyle = i >= 0 ? VC.ink : VC.faint;
      ctx.fillText(fitText(ctx, i >= 0 ? `${C0[i].sym}  ${C0[i].name}` : '—', bw - 32), bx + 16, y + 50);
    });
    y += 116;
    let bx = x;
    ROUTES.forEach(([s, t], k) => {
      const n = `${s} to ${t}`, w = Math.max(150, 15 * n.length + 30);
      vButton(ctx, P, 'pre' + k, bx, y, w, 58, n, () => xrPathPreset(findProtein(s), findProtein(t)), { px: 22 }); bx += w + 10;
    });
    vButton(ctx, P, 'pclear', bx, y, 120, 58, 'Clear', xrClearPath, { px: 22 });
    y += 84;
    if (X.pathErr) { textBlock(ctx, X.pathErr, x, y, W, 26, 38, VC.muted); return; }
    if (!X.path) { textBlock(ctx, 'Point at two named proteins in the network, or try one of the examples.', x, y, W, 26, 38, VC.muted); return; }
    const names = routeNames(X.path), L = names.length - 1, named = names.filter(n => n !== '·').length;
    ctx.font = vfont(64, 700); ctx.fillStyle = VC.magenta;
    ctx.fillText(`${L} ${L === 1 ? 'step' : 'steps'}`, x, y);
    y += 82;
    y += textBlock(ctx, `${named} named and ${names.length - named} unnamed proteins on the way.`, x, y, W, 24, 34, VC.muted) + 12;
    textBlock(ctx, names.map(n => (n === '·' ? '•' : n)).join('  →  '), x, y, W, 27, 40, VC.ink, 400, Math.max(1, Math.floor((bottom - y) / 40)));
    return;
  }
  const i = X.sel;
  if (i < 0) {
    y += textBlock(ctx, `Point at a named protein in the interactome and pull the trigger (or pinch). The ${fmt(C0.length)} named proteins come from the network-medicine story; the others suggest the rest of the map.`, x, y, W, 27, 40, VC.muted) + 22;
    chipFlow(ctx, P, QUICK.filter(s => findProtein(s) >= 0), x, y, W, bottom, c => `${c} ${C0[findProtein(c)].name}`, c => selectProtein(findProtein(c)), 'quick:');
    return;
  }
  const p = C0[i], part = INT().partners ? INT().partners(i) : [];
  y += textBlock(ctx, `${p.sym} ${p.name}`, x, y, W, 38, 46, VC.ink, 700, 2) + 4;
  y += textBlock(ctx, p.role || '', x, y, W, 25, 34, VC.muted, 400, 2) + 18;
  ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText('Group', x, y + 3);
  swatch(ctx, x + 190, y + 6, 22, modCss(i));
  ctx.font = vfont(27); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, modName(i), W - 230), x + 224, y);
  y += 44;
  ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText('Partners', x, y + 3);
  ctx.font = vfont(27); ctx.fillStyle = VC.ink; ctx.fillText(`${part.length} named`, x + 190, y);
  y += 44;
  ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText('Essential', x, y + 3);
  ctx.font = vfont(27); ctx.fillStyle = VC.ink; ctx.fillText(p.essential ? 'Yes, cells cannot live without it' : 'No', x + 190, y);
  y += 56;
  vButton(ctx, P, 'aroute', x, y, 330, 60, 'Find a route from here', () => {
    xrClearPath(); XR.routing = true;
    XR.pf = i; XR.pt = -1; XR.pick = 'to'; $('#pf').value = p.sym; $('#pt').value = '';
  }, { px: 23 });
  y += 80;
  chipFlow(ctx, P, part, x, y, W, bottom, j => C0[j].sym, j => selectProtein(j), 'nb:');
}
// on-panel keyboard for searching proteins
const KROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
function drawKeyboard(ctx, P, x, y, W) {
  const kb = XR.kbd, forPath = !!XR.routing, C0 = INT().core;
  ctx.font = vfont(22); ctx.fillStyle = VC.muted;
  ctx.fillText(forPath ? `Search the ${XR.pick === 'from' ? 'From' : 'To'} protein` : 'Search a named protein by gene symbol or name', x, y);
  y += 36;
  rr(ctx, x, y, W, 70, 10); ctx.fillStyle = 'rgba(149,166,189,0.10)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = VC.cyan; ctx.stroke();
  ctx.font = vfont(32); ctx.fillStyle = kb.q ? VC.ink : VC.faint;
  const shown = kb.q || 'Type with the keys below';
  ctx.fillText(shown, x + 20, y + 18);
  if (kb.q) { const w = ctx.measureText(kb.q).width; ctx.fillStyle = VC.cyan; ctx.fillRect(x + 24 + w, y + 16, 3, 38); }
  y += 88;
  const route = /\s(to|-|>)\s/i.test(kb.q.trim()), sug = route ? [] : matches(kb.q, 5);
  if (route) textBlock(ctx, 'Press Find route for the fewest steps between these two proteins.', x, y, W, 25, 36, VC.muted);
  else if (kb.q && !sug.length) textBlock(ctx, `No named protein matches “${kb.q}”.`, x, y, W, 25, 36, VC.muted);
  else if (!kb.q) textBlock(ctx, 'Tip: type two symbols with TO between them, like TP53 TO BRCA1, to find a route.', x, y, W, 24, 34, VC.faint);
  sug.forEach((i, k) => {
    const id = 'sug:' + i, yy = y + k * 60;
    vButton(ctx, P, id, x, yy, W, 54, '', () => xrPickSuggestion(i), { r: 8 });
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(C0[i].sym, x + 16, yy + 14);
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, C0[i].name, W - 400), x + 156, yy + 15);
    ctx.fillStyle = VC.faint; ctx.textAlign = 'right'; ctx.fillText(fitText(ctx, modName(i), 220), x + W - 16, yy + 15); ctx.textAlign = 'left';
  });
  const kw = 84, kh = 70, g = 9, ky0 = P.h - 34 - 4 * kh - 3 * g;
  KROWS.forEach((row, r) => {
    const rw = row.length * kw + (row.length - 1) * g, rx = x + (W - rw) / 2 - (r === 2 ? 50 : 0);
    [...row].forEach((ch, k) => vButton(ctx, P, 'key:' + ch, rx + k * (kw + g), ky0 + r * (kh + g), kw, kh, ch,
      () => { kb.q = (kb.q + ch).slice(0, 24); }, { px: 28 }));
    if (r === 2) vButton(ctx, P, 'key:back', rx + rw + g, ky0 + r * (kh + g), 2 * kw, kh, '⌫ Delete', () => { kb.q = kb.q.slice(0, -1); }, { px: 24 });
  });
  const by = ky0 + 3 * (kh + g);
  vButton(ctx, P, 'key:space', x + 40, by, 380, kh, 'Space', () => { if (kb.q && !kb.q.endsWith(' ')) kb.q += ' '; }, { px: 24 });
  vButton(ctx, P, 'key:clear', x + 432, by, 170, kh, 'Clear', () => { kb.q = ''; }, { px: 24 });
  vButton(ctx, P, 'key:done', x + 614, by, 290, kh, route ? 'Find route' : sug.length ? 'Choose ' + C0[sug[0]].sym : 'Close', () => {
    if (route) {
      kb.open = false; runQuery(kb.q.trim()); kb.q = '';
      if (X.pathEnds) { XR.pf = X.pathEnds[0]; XR.pt = X.pathEnds[1]; XR.pick = 'to'; XR.routing = true; }
    } else if (sug.length) xrPickSuggestion(sug[0]); else kb.open = false;
  }, { px: 24, primary: route || !!sug.length });
}

//#use sigFoot
//#use drawFoot
// explore mode's footer (drawFoot)
function drawFootX(ctx, P) {
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText('Turn', 28, 58);
  vButton(ctx, P, 'turn:on', 100, 40, 90, 56, 'On', () => setTurn('on'), { on: X.turn === 'on', px: 22 });
  vButton(ctx, P, 'turn:off', 198, 40, 90, 56, 'Off', () => setTurn('off'), { on: X.turn === 'off', px: 22 });
  ctx.fillText('Zoom', 330, 58);
  vButton(ctx, P, 'z-', 404, 40, 56, 56, '−', () => xrZoom(1.3), { px: 28 });
  vButton(ctx, P, 'z+', 466, 40, 56, 56, '+', () => xrZoom(1 / 1.3), { px: 28 });
  vButton(ctx, P, 'home', 560, 40, 230, 56, 'Whole scene', () => { X.side = null; flyTo(view(X.scene, 'default')); }, { px: 22 });
}


// ------------------------------------------------------------- narration --
