//#use head VC vfont cssColor rr wrapLines textBlock fitText fitTitle vButton swatch makePanel panelDepth panelTick
//#use panelPaint FADE FADECV panelFade panelSend panelPatch
//#use sigMain
const sigMainS = () => '';
// explore mode in the main panel's signature (sigMain)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.prot, X.term, X.path, X.inside, X.q, X.tpage, XS.net_hyper > 0.5, XR.on].join('|');
}
const XR_HERE = 'cdk5';
const XR_TITLE = 'The switch that sticks';
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
  ({ scenes: drawScenesPane, proteins: drawProteinsPane, diseases: drawDiseasesPane, about: drawAboutPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
//#use flow head~2 vSlider stats~2 numRow footNote
// the explore panes' canvas twins (Scenes, Proteins, Diseases, About): the same choices and numbers as the HTML panes
// (renderScenes and the others in e4_explore.js); keep both twins in step
// the six scenes, the chosen one's switches, a pathway lit and Stand inside
function drawScenesPane(ctx, P, x, y, W, bottom) {
  const cw = (W - 24) / 3, i = sIdx(X.scene), sc = SCENES[i];
  SCENES.forEach(([k, n], j) => vButton(ctx, P, 'scene:' + k, x + (j % 3) * (cw + 12), y + Math.floor(j / 3) * 60, cw, 52, SCENE_SHORT[k] || n, () => openScene(k), { on: X.scene === k, px: 22 }));
  y += Math.ceil(SCENES.length / 3) * 60 + 14;
  y += textBlock(ctx, sc[1], x, y, W, 30, 38, VC.ink, 700, 1) + 6;
  y += textBlock(ctx, sc[2], x, y, W, 22, 30, VC.muted, 400, 4) + 12;
  for (const c of ctlsOf(X.scene)) {
    if (y + 100 > bottom) break;
    y += head(ctx, x, y, c.label);
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => sceneCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 23, h: 52 }) + 14;
  }
  y += head(ctx, x, y, 'Light a pathway');
  y += flow(ctx, P, PATHS.map(([v, n]) => ({ id: 'path:' + v, label: n, on: X.path === v, col: pathCol(v), fn: () => setPath(v) })), x, y, W, bottom, { px: 23, h: 52 }) + 16;
  if (INSIDE_OK(X.scene)) y += flow(ctx, P, [{ id: 'inside', label: 'Stand inside', on: X.inside, fn: () => setInside(!X.inside) }], x, y, W, bottom, { px: 23, h: 52 }) + 18;
  footNote(ctx, `The authors' scene: ${AUTHOR_SC[i]}.${hasCore(X.scene) ? ' The balls, tubes and names at the centre are our clearer drawing of its proteins, at the authors\' places, scaled up.' : ''}${X.inside ? ' Standing inside: the map round you; the thumbstick turns it.' : ''}`, x, y, W, bottom);
}
// a protein: quick picks, the search on the shell's keypad and its matches, the picked one's partners, diseases and pathways
function drawProteinsPane(ctx, P, x, y, W, bottom) {
  const I = protInfo(X.prot), o = { px: 22, h: 46 };
  y += textBlock(ctx, 'Pick a protein, search one by its gene symbol, or point at one on the map and pull the trigger.', x, y, W, 23, 32, VC.muted, 400, 2) + 8;
  const cdkCol = XS.net_hyper > 0.5 ? CC.hyper : CC.cdk5;
  const items = QUICK.map(i => ({ id: 'q:' + i, label: ALIAS[i] || CD.sym[i], on: X.prot === i, col: i === CD.cdk5 ? cdkCol : null, fn: () => selectProt(i) }));
  if (HOST.collab && HOST.collab.keypad) items.push({ id: 'search', label: X.q ? `Search: ${X.q}` : 'Search…', fn: xrSearch });
  y += flow(ctx, P, items, x, y, W, bottom, o) + 8;
  if (X.q) {
    const r = searchOf(X.q).slice(0, 8);
    y += head(ctx, x, y, r.length ? `Matches for ${X.q}` : `Nothing starts with or holds ${X.q}`);
    if (r.length) y += flow(ctx, P, r.map(i => ({ id: 'm:' + i, label: CD.sym[i], on: X.prot === i, fn: () => selectProt(i) })), x, y, W, bottom, o) + 8;
  }
  if (!I) { y += textBlock(ctx, 'No protein picked.', x, y, W, 22, 30, VC.muted, 400, 1) + 10; footNote(ctx, NOTE.proteins, x, y, W, bottom); return; }
  y += textBlock(ctx, I.head, x, y, W, 30, 38, CC.pick, 700, 1) + 4;
  y += stats(ctx, x, y, W, I.rows) + 4;
  y += head(ctx, x, y, I.more ? `Partners: the first ${I.partners.length}, and ${fmt(I.more)} more` : 'Partners');
  y += flow(ctx, P, I.partners.map(j => ({ id: 'n:' + j, label: CD.sym[j], fn: () => selectProt(j) })), x, y, W, Math.min(bottom, y + 3 * 54), { px: 21, h: 44 }) + 8;
  if (I.terms.length && y + 140 < bottom) {
    y += head(ctx, x, y, 'Diseases among the terms');
    y += flow(ctx, P, I.terms.map(j => ({ id: 't:' + j, label: CD.terms[j].name, on: X.term === j, col: CC.term, fn: () => { selectTerm(j); } })), x, y, W, Math.min(bottom, y + 2 * 54), { px: 21, h: 44 }) + 8;
  }
  const btns = [];
  if (X.scene !== 'disease') btns.push({ id: 'land', label: 'Show it on the landscape', fn: () => protOnLand(I.i) });
  if (I.i !== CD.cdk5) btns.push({ id: 'back', label: 'Back to CDK5', fn: () => selectProt(CD.cdk5) });
  btns.push({ id: 'none', label: 'None', fn: () => selectProt(-1) });
  y += flow(ctx, P, btns, x, y, W, bottom, o) + 10;
  footNote(ctx, NOTE.proteins, x, y, W, bottom);
}
// the terms, a page at a time (CDK5's own first), and the one picked with its counts
function drawDiseasesPane(ctx, P, x, y, W, bottom) {
  const n = TERM_ORDER.length, pages = Math.ceil(n / TPAGE), pg = clamp(X.tpage, 0, pages - 1), I = X.term >= 0 ? termInfo(X.term) : null;
  y += textBlock(ctx, `${n} Disease Ontology terms, CDK5's own first. Pick one to light its proteins; the landscape shows them best.`, x, y, W, 23, 32, VC.muted, 400, 2) + 10;
  const cw = (W - 12) / 2, cdkCol = XS.net_hyper > 0.5 ? CC.hyper : CC.cdk5;
  TERM_ORDER.slice(pg * TPAGE, pg * TPAGE + TPAGE).forEach((j, k) => {
    const bx = x + (k % 2) * (cw + 12), by = y + Math.floor(k / 2) * 52, t = CD.terms[j];
    vButton(ctx, P, 'term:' + j, bx, by, cw, 44, '', () => selectTerm(X.term === j ? -1 : j, false), { on: X.term === j, r: 6 });
    if (t.cdk5) swatch(ctx, bx + 12, by + 15, 14, cdkCol);
    ctx.font = vfont(20, X.term === j ? 700 : 400); ctx.fillStyle = VC.ink; ctx.textBaseline = 'middle';
    ctx.fillText(fitText(ctx, t.name, cw - 48), bx + 36, by + 23); ctx.textBaseline = 'top';
  });
  y += Math.ceil(TPAGE / 2) * 52 + 6;
  vButton(ctx, P, 'tpage:-', x, y, 120, 48, '‹', () => { X.tpage = (pg + pages - 1) % pages; }, { px: 28 });
  vButton(ctx, P, 'tpage:+', x + 132, y, 120, 48, '›', () => { X.tpage = (pg + 1) % pages; }, { px: 28 });
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(`Page ${pg + 1} of ${pages}`, x + 274, y + 12);
  y += 66;
  if (I) {
    y += textBlock(ctx, I.head, x, y, W - 140, 27, 35, CC.term, 700, 1) + 4;
    vButton(ctx, P, 'term:none', x + W - 120, y - 46, 120, 40, 'None', () => selectTerm(-1), { px: 20, r: 6 });
    y += stats(ctx, x, y, W, I.rows) + 6;
    if (X.scene !== 'disease') y += flow(ctx, P, [{ id: 'tland', label: 'Show on the landscape', fn: () => { if (X.inside) setInside(false, false); openScene('disease'); } }], x, y, W, bottom, { px: 22, h: 46 }) + 10;
  } else y += textBlock(ctx, 'No term picked. Terms with a CDK5 swatch are its own.', x, y, W, 22, 30, VC.muted, 400, 1) + 10;
  footNote(ctx, NOTE.diseases, x, y, W, bottom);
}
// what is whose, the authors' nine scenes and the structures
function drawAboutPane(ctx, P, x, y, W, bottom) {
  y += textBlock(ctx, ABOUT, x, y, W, 21, 29, VC.muted, 400, 9) + 12;
  y += head(ctx, x, y, 'The authors\' nine scenes');
  SCENES.forEach(([k, n], i) => {
    if (y + 34 > bottom) return;
    swatch(ctx, x, y + 4, 18, SCENE_COL[k]);
    ctx.font = vfont(19); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, `${AUTHOR_SC[i]}: ${n}`, W - 32), x + 30, y + 2);
    y += 30;
  });
  y += 6;
  y += head(ctx, x, y, 'The structures (close-ups not to scale)');
  for (const st of STRUCTS) { if (y + 30 > bottom) break; y += textBlock(ctx, `${st[0]}: ${st[1]}`, x, y, W, 18, 24, VC.ink, 400, 2) + 4; }
  footNote(ctx, ABOUT_NOTE, x, y + 8, W, bottom);
}
// ----------------------------------------------------------- footer panel --
function sigFoot() {
  return APP.mode === 'story' ? 's' + Math.floor(APP.t) + APP.playing + (curCh ? curCh.key : '') + slideSig() : 'x' + X.turn + X.inside;
}
//#use drawFoot
// explore mode's footer: turn, zoom and the whole scene (leaving Stand inside: the scene's own view)
function drawFootX(ctx, P) {
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText('Turn', 28, 58);
  vButton(ctx, P, 'turn:on', 100, 40, 90, 56, 'On', () => setTurn('on'), { on: X.turn === 'on', px: 22 });
  vButton(ctx, P, 'turn:off', 198, 40, 90, 56, 'Off', () => setTurn('off'), { on: X.turn === 'off', px: 22 });
  ctx.fillText('Zoom', 330, 58);
  vButton(ctx, P, 'z-', 404, 40, 56, 56, '−', () => xrZoom(1.3), { px: 28 });
  vButton(ctx, P, 'z+', 466, 40, 56, 56, '+', () => xrZoom(1 / 1.3), { px: 28 });
  vButton(ctx, P, 'home', 560, 40, 230, 56, 'Whole scene', () => { if (X.inside) setInside(false, false); flyTo(view('net', sceneCam())); }, { px: 22 });
}
