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
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl[X.scene] || {}), X.group, X.gene, JSON.stringify(X.pick), [...X.off].join(','),
    X.walk ? X.walk.from + ':' + X.walk.top.join(',') : '', X.walkFrom, X.mine.join(','), X.walkers, X.showZ, X.colour, X.grid, X.room, X.egroup, X.err,
    XR.kbd.open, XR.kbd.q].join('|');
}
const XR_HERE = 'nmd';
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
  fitTitle(ctx, 'Muscle and heart', 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, HOST.room && HOST.room.inRoom() ? HOST.room.gripHint : HOST.anchor.on ? 'Trigger (or pinch): use buttons. Anchored: to move things, use Place again in the menu.' : XR.free ? 'Trigger (or pinch): use buttons. Grip: hold the scene or this panel to move and turn it; both grips on the scene resize it.' : 'Trigger (or pinch): use buttons. Grip: move the scene or this panel; both grips on the scene resize it.', 44, P.h - 74, P.w - 88, 22, 30, VC.faint);
  } else drawExplorePane(ctx, P, 40, 120, P.w - 80);
}

//#use STY storyOpacity FADEB drawStoryPane drawStoryEl~2
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
  ({ groups: drawGroupsPane, genes: drawGenePane, walk: drawWalkPane, layers: drawLayersPane, endo: drawEndoPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
//#use searchField
// buttons that wrap like the HTML chips: items -> { id, label, on, col, fn }
function flow(ctx, P, items, x, y, W, maxY, o = {}) {
  const px = o.px || 22, h = o.h || 44, gap = 8;
  let cx = x, cy = y;
  ctx.font = vfont(px);
  for (const it of items) {
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
// a labelled bar, for z-scores, walk visits and link counts
function bar(ctx, x, y, W, label, v, max, col) {
  ctx.font = vfont(22); ctx.fillStyle = VC.ink;
  ctx.fillText(fitText(ctx, label, W * 0.52), x, y);
  rr(ctx, x + W * 0.55, y + 6, Math.max(4, W * 0.45 * Math.max(0, v) / (max || 1)), 14, 3); ctx.fillStyle = col; ctx.fill();
  return 34;
}
//#use head~2
const groupItems = (cur, fn, idp) => ND.groups.map((G, k) => ({ id: idp + k, label: G.short, on: cur === k, col: G.col, fn: () => fn(k) }));
const endoItems = (g, idp) => ND.groups[g].endo.map(e => ({ id: idp + g + ':' + e.c, label: `${e.c}${e.name ? ' · ' + e.name : ''}`, col: endoCss(e.c),
  on: X.pick.some(([a, b]) => a === g && b === e.c), fn: () => togglePick(g, e.c) }));
function drawGroupsPane(ctx, P, x, y, W, bottom) {
  y += flow(ctx, P, [{ id: 'g:-1', label: 'All groups', on: X.group < 0, fn: () => selectGroup(-1) }, ...groupItems(X.group, selectGroup, 'g:')], x, y, W, bottom) + 18;
  const g = X.group, G = ND.groups[g];
  if (!G) { textBlock(ctx, 'Pick a group to light up its module: its known genes (the seeds), the genes the walk added, and its endotypes.', x, y, W, 26, 38, VC.muted); return; }
  y += textBlock(ctx, G.name, x, y, W, 34, 42, VC.ink, 700, 2) + 4;
  y += textBlock(ctx, `${G.seeds} known genes, ${G.added} added by the walk${G.added >= 200 ? ' (stopped at 200)' : ''}, ${G.endo.length} endotypes.`, x, y, W, 23, 32, VC.muted, 400, 2) + 12;
  y += flow(ctx, P, [{ id: 'col:endo', label: 'Endotype colours', on: X.colour === 'endo', fn: () => { X.colour = X.colour === 'endo' ? 'group' : 'endo'; renderGroups(); } },
    { id: 'grid', label: 'Grid by endotype', on: X.grid, fn: () => { X.grid = !X.grid; renderGroups(); } },
    { id: 'zs', label: 'Layer scores', on: X.showZ, fn: () => { X.showZ = !X.showZ; renderGroups(); } }], x, y, W, bottom, { px: 23, h: 52 }) + 16;
  y += head(ctx, x, y, 'Endotypes (press to pick)');
  y += flow(ctx, P, endoItems(g, 'pe:'), x, y, W, bottom - 150, { px: 21, h: 40 }) + 16;
  if (y + 80 > bottom) return;
  y += head(ctx, x, y, 'Where its known genes cluster most (z-score)');
  const zs = ND.D.ppi.map((l, p) => [G.z[p], l]).sort((a, b) => b[0] - a[0]), zmax = Math.max(1.645, zs[0][0]);
  for (const [z, l] of zs) { if (y + 34 > bottom) break; y += bar(ctx, x, y, W, `${ND.layers[l].name} ${z.toFixed(1)}`, z, zmax, z >= 1.645 ? G.col : VC.line); }
}
function drawGenePane(ctx, P, x, y, W, bottom) {
  searchField(ctx, P, x, y, W, 'Search a gene');
  y += 90;
  const i = X.gene;
  if (i < 0) {
    y += textBlock(ctx, `Point at a gene in the tower and pull the trigger (or pinch). The ${fmt(ND.N)} genes are those of the ${ND.groups.length} disease modules.`, x, y, W, 26, 38, VC.muted) + 20;
    flow(ctx, P, QUICK.map(findGene).filter(k => k >= 0).map(k => ({ id: 'qk:' + k, label: ND.genes[k].sym, fn: () => selectGene(k) })), x, y, W, bottom, { px: 24, h: 52 });
    return;
  }
  const G = ND.genes[i], gs = groupsOf(i), cnt = new Map();
  for (const [, s] of ND.nb[i]) for (const j of s) cnt.set(j, (cnt.get(j) || 0) + 1);
  y += textBlock(ctx, G.sym, x, y, W, 42, 48, VC.ink, 700, 1) + 2;
  y += textBlock(ctx, G.go.slice(0, 2).join(', ') || 'No GO process listed', x, y, W, 23, 32, VC.muted, 400, 2) + 14;
  for (const g of gs) {
    if (y + 52 > bottom - 200) break;
    swatch(ctx, x, y + 14, 18, ND.groups[g].col);
    ctx.font = vfont(24); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, `${ND.groups[g].short} · ${isSeed(i, g) ? 'known' : 'added'}`, W * 0.46), x + 30, y + 10);
    const bw = W * 0.5;
    vButton(ctx, P, 'gp:' + g, x + W - bw, y, bw, 46, '', () => togglePick(g, G.endo[g]), { r: 6, on: X.pick.some(([a, b]) => a === g && b === G.endo[g]) });
    ctx.font = vfont(21); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, endoLabel(g, G.endo[g]), bw - 24), x + W - bw + 12, y + 12);
    y += 54;
  }
  y += 6 + textBlock(ctx, `Linked in ${ND.nb[i].size} layers to ${cnt.size} module genes.`, x, y, W, 24, 34, VC.muted, 400, 2);
  vButton(ctx, P, 'mine', x, y + 8, 280, 56, 'Walk from here', () => { addMine(i); showTab('walk'); }, { px: 23 });
  y += 84;
  y += head(ctx, x, y, 'Partners (most layers first)');
  flow(ctx, P, [...cnt].sort((a, b) => b[1] - a[1]).map(([j]) => ({ id: 'nb:' + j, label: ND.genes[j].sym, fn: () => selectGene(j) })), x, y, W, bottom, { px: 22, h: 42 });
}
function drawWalkPane(ctx, P, x, y, W, bottom) {
  y += textBlock(ctx, 'The walker jumps back to its start genes seven times in ten, follows links otherwise, and changes layer half the time where it can.', x, y, W, 23, 32, VC.muted, 400, 3) + 12;
  y += head(ctx, x, y, 'Start from');
  y += flow(ctx, P, [...groupItems(X.walkFrom, k => { X.walkFrom = k; renderWalk(); }, 'wf:'),
    { id: 'wf:mine', label: `Your genes (${X.mine.length})`, on: X.walkFrom === 'mine', fn: () => { X.walkFrom = 'mine'; renderWalk(); } }], x, y, W, bottom, { px: 21, h: 40 }) + 12;
  if (X.walkFrom === 'mine') y += flow(ctx, P, X.mine.map(i => ({ id: 'um:' + i, label: ND.genes[i].sym + ' ×', fn: () => { X.mine = X.mine.filter(k => k !== i); renderWalk(); } })), x, y, W, bottom, { px: 22, h: 42 }) + 10;
  vButton(ctx, P, 'run', x, y, 300, 60, 'Run the walk', () => runWalk(X.walkFrom), { primary: true, px: 25 });
  if (X.walk) vButton(ctx, P, 'wclear', x + 312, y, 150, 60, 'Clear', clearWalk, { px: 24 });
  vButton(ctx, P, 'walkers', x + W - 260, y, 260, 60, 'Show walkers', () => { X.walkers = !X.walkers; pushState(); renderWalk(); }, { on: X.walkers, px: 24 });
  y += 76;
  y += textBlock(ctx, X.err || (X.off.size ? `${X.off.size} layers knocked out: the walk avoids them.` : 'All layers on.'), x, y, W, 23, 32, X.err ? VC.amber : VC.faint, 400, 2) + 12;
  const R = X.walk;
  if (!R) return;
  y += head(ctx, x, y, 'Most visited genes');
  const mx = R.top.length ? R.heat[R.top[0]] : 1;
  for (const i of R.top) {
    if (y + 40 > bottom) break;
    vButton(ctx, P, 'wt:' + i, x - 6, y - 4, W + 12, 38, '', () => selectGene(i), { r: 6 });
    y += bar(ctx, x, y, W, `${ND.genes[i].sym}  ${groupsOf(i).map(g => ND.groups[g].short).slice(0, 1).join('')}`, R.heat[i], mx, VC.cyan) + 4;
  }
}
function drawLayersPane(ctx, P, x, y, W, bottom) {
  y += flow(ctx, P, [['all', 'All on', () => true], ['ppi', 'Proteins only', L => L.cat === 'ppi'], ['cores', 'Only the cores', L => /_core$/.test(L.key) || !/^(ppi|coex)_/.test(L.key)]]
    .map(([k, n, fn]) => ({ id: 'ls:' + k, label: n, fn: () => setLayers(fn) })).concat([{ id: 'ko', label: 'Knock out 10', fn: () => knockRandom(10) }]), x, y, W, bottom, { px: 23, h: 52 }) + 12;
  y += textBlock(ctx, `${ND.L - X.off.size} of ${ND.L} layers on. Lit buttons are on; press one to knock it out.`, x, y, W, 22, 30, VC.muted, 400, 2) + 8;
  for (const c of CAT_ORDER) {
    const ls = ND.layers.map((L, l) => [L, l]).filter(([L]) => L.cat === c);
    if (y + 70 > bottom) break;
    swatch(ctx, x, y + 6, 16, CAT[c][1]); ctx.font = vfont(21, 700); ctx.fillStyle = VC.muted; ctx.fillText(`${CAT[c][0]} · ${ls.length}`, x + 26, y + 2);
    y += 30;
    y += flow(ctx, P, ls.map(([L, l]) => ({ id: 'ly:' + l, label: L.name.replace(/ \((IID|GTEx|HPO|MPO|Reactome|NeDRex|CRISPR screens)\)$/, ''), on: !X.off.has(l), fn: () => setLayer(l, X.off.has(l)) })), x, y, W, bottom, { px: 16, h: 30 }) + 8;
  }
}
function drawEndoPane(ctx, P, x, y, W, bottom) {
  y += flow(ctx, P, groupItems(X.egroup, k => { X.egroup = k; renderEndo(); }, 'eg:'), x, y, W, bottom, { px: 21, h: 40 }) + 14;
  y += flow(ctx, P, endoItems(X.egroup, 'ep:'), x, y, W, bottom - 220, { px: 21, h: 42 }) + 16;
  if (!X.pick.length) { textBlock(ctx, 'Pick endotypes, from one group or several, to see their genes through every layer and where they link.', x, y, W, 24, 34, VC.muted); return; }
  y += head(ctx, x, y, `Picked (${X.pick.length})`);
  y += flow(ctx, P, X.pick.map(([g, c]) => ({ id: 'pk:' + g + ':' + c, label: `${ND.groups[g].short} ${c}`, col: endoCss(c), on: true, fn: () => togglePick(g, c) }))
    .concat([{ id: 'pclear', label: 'Clear', fn: clearPick }]), x, y, W, bottom, { px: 21, h: 40 }) + 14;
  const st = endoStats();
  if (!st.rows.length) { textBlock(ctx, `No links ${X.pick.length > 1 ? 'between them' : 'inside it'} in the layers that are on.`, x, y, W, 24, 34, VC.muted); return; }
  y += head(ctx, x, y, X.pick.length > 1 ? 'Links between them, by layer' : 'Links inside it, by layer');
  const mx = st.rows[0].n;
  for (const r of st.rows) { if (y + 34 > bottom) break; y += bar(ctx, x, y, W, `${ND.layers[r.l].name} ${r.n}`, r.n, mx, X.pick.length > 1 ? VC.amber : endoCss(X.pick[0][1])); }
}
// the three scenes, and the chosen scene's own controls
function drawScenesPane(ctx, P, x, y, W, bottom) {
  const cw = (W - 24) / 3;
  SCENES.forEach(([k, n], j) => vButton(ctx, P, 'scene:' + k, x + j * (cw + 12), y, cw, 56, n, () => openScene(k), { on: X.scene === k, px: 22 }));
  y += 76;
  const sc = SCENES.find(s => s[0] === X.scene), s = GL.sets[X.scene];
  y += textBlock(ctx, sc[2], x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  if (X.scene === 'tower') y += textBlock(ctx, 'The tower answers to the other tabs: Diseases, Genes, Walk, Layers and Endotypes.', x, y, W, 23, 32, VC.faint, 400, 2) + 14;
  for (const c of (s.controls || []).filter(c => X.scene !== 'tower' || c.key !== 'colour')) {
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => setCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
  if (X.scene === 'tower' && y + 70 < bottom) vButton(ctx, P, 'room', x, y, 360, 60, 'Stand inside the tower', () => setRoom(!X.room), { on: X.room, px: 24 });
}
//#use KROWS
function drawKeyboard(ctx, P, x, y, W) {
  const kb = XR.kbd;
  ctx.font = vfont(22); ctx.fillStyle = VC.muted;
  ctx.fillText('Search a gene by its symbol, or a process like SARCOMERE', x, y);
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
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(ND.genes[i].sym, x + 16, yy + 14);
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, ND.genes[i].go[0] || '', W - 420), x + 170, yy + 15);
    ctx.fillStyle = VC.faint; ctx.textAlign = 'right'; ctx.fillText(fitText(ctx, groupsOf(i).map(g => ND.groups[g].short).slice(0, 1).join(''), 220), x + W - 16, yy + 15); ctx.textAlign = 'left';
  });
  const kw = 84, kh = 70, g = 9, ky0 = P.h - 34 - 4 * kh - 3 * g;
  KROWS.forEach((row, r) => {
    const rw = row.length * kw + (row.length - 1) * g, rx = x + (W - rw) / 2 - (r === 2 ? 50 : 0);
    [...row].forEach((ch, k) => vButton(ctx, P, 'key:' + ch, rx + k * (kw + g), ky0 + r * (kh + g), kw, kh, ch,
      () => { kb.q = (kb.q + ch).slice(0, 24); }, { px: 28 }));
    if (r === 2) vButton(ctx, P, 'key:back', rx + rw + g, ky0 + r * (kh + g), 2 * kw, kh, '⌫ Delete', () => { kb.q = kb.q.slice(0, -1); }, { px: 24 });
  });
  // gene symbols have digits (MYH7, TNNT2): a row of them above the letters
  const rw0 = 10 * kw + 9 * g, rx0 = x + (W - rw0) / 2;
  [...'1234567890'].forEach((ch, k) => vButton(ctx, P, 'key:' + ch, rx0 + k * (kw + g), ky0 - kh - g, kw, kh, ch, () => { kb.q = (kb.q + ch).slice(0, 24); }, { px: 28 }));
  const by = ky0 + 3 * (kh + g);
  vButton(ctx, P, 'key:dash', x + 40, by, 380, kh, '- (dash)', () => { kb.q = (kb.q + '-').slice(0, 24); }, { px: 24 });
  vButton(ctx, P, 'key:clear', x + 432, by, 170, kh, 'Clear', () => { kb.q = ''; }, { px: 24 });
  vButton(ctx, P, 'key:done', x + 614, by, 290, kh, sug.length ? 'Choose ' + ND.genes[sug[0]].sym : 'Close', () => {
    if (sug.length) xrPickSuggestion(sug[0]); else kb.open = false;
  }, { px: 24, primary: !!sug.length });
}

//#use sigFoot drawFoot