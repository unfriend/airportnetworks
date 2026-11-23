//#use head VC vfont cssColor rr wrapLines textBlock fitText fitTitle vButton swatch makePanel panelDepth panelTick
//#use panelPaint FADE FADECV panelFade panelSend panelPatch
//#use sigMain
const sigMainS = () => '';
// explore mode in the main panel's signature (sigMain)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.endo, X.gene, X.k, X.step, X.gap, XR.kbd.open, XR.kbd.q].join('|');
}
const XR_HERE = 'endo';
const XR_TITLE = 'Endotypes';
// the story's points (ul.steps) on the headset's panel (drawStoryEl): lines at most, and the colour of one without
// its own
const XR_STEP_LINES = 4, XR_STEP_COL = 'var(--amber)';
const FLOW_BOLD = true;
//#use XR_STORIES XR_LAND xrLandingSetup xrLandingCards xrLandingClose drawLandHead drawLandCard drawStoriesPane
//#use xrHint drawMain

//#use STY storyOpacity FADEB drawStoryPane drawStoryEl


//#use drawExplorePane
// a tab picked in a headset (drawExplorePane): the keyboard closes
function pickTab(k) { XR.kbd.open = false; showTab(k); }
// explore mode's pane for each tab (drawExplorePane)
function drawTabPane(ctx, P, x, y, W, bottom) {
  if (XR.kbd.open && X.tab === 'genes') return drawKeyboard(ctx, P, x, y, W);
  ({ endo: drawEndoPane, genes: drawGenePane, method: drawMethodPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
//#use searchField
//#use flow
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

//#use sigFoot drawFoot drawFootX