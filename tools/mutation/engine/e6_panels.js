//#use head VC vfont cssColor rr wrapLines textBlock fitText fitTitle vButton swatch makePanel panelDepth panelTick
//#use panelPaint FADE FADECV panelFade panelSend panelPatch
//#use sigMain
const sigMainS = () => '';
// explore mode in the main panel's signature (sigMain)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.time, X.reads, X.rseed, X.branch, X.w, X.sseed, XR.on].join('|');
}
const XR_HERE = 'mutation';
const XR_TITLE = 'The mutation machine';
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
  ({ letters: drawLettersPane, rule: drawRulePane, tree: drawTreePane, stem: drawStemPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
//#use flow head~2 vSlider
// rows of a name (muted) and its value (ink), as the HTML's dl.stats
// (kw: the names' column, wider where they are long, as the rebuild's methods)
function stats(ctx, x, y, W, rows, kw = 220) {
  let yy = y;
  for (const [k, v, more] of rows) {
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, k, kw - 10), x, yy + 3);
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(v, x + kw, yy);
    if (more) { const w = ctx.measureText(v).width; ctx.font = vfont(21); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, more, W - kw - 20 - w), x + kw + 16 + w, yy + 4); }
    yy += 38;
  }
  return yy - y;
}
// a slider the panes hold (the branch length or the pair favour): its name, its value and the slider under them
function numRow(ctx, P, key, x, y, W) {
  const o = NUM[key], v = numOf(key);
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(o.label, x, y + 2);
  ctx.font = vfont(24, 700); ctx.fillStyle = VC.ink; ctx.textAlign = 'right'; ctx.fillText(o.text(v), x + W, y); ctx.textAlign = 'left';
  vSlider(ctx, P, 'num:' + key, x + 14, y + 28, W - 28, v, o.min, o.max, o.col, val => (key === 'w' ? setW(val, true) : setTime(val, true)));
  return 28 + 48 + 12;
}
//#use footNote
function drawLettersPane(ctx, P, x, y, W, bottom) {
  const I = lettersInfo(), mix = letMix(), on = X.scene === 'letters' && viewIs('letters', 'qubits');
  y += textBlock(ctx, 'A quantum computer holds each letter in two qubits, arrows on spheres: up is 0, down is 1. Pick a letter or a mix, then read it out.', x, y, W, 23, 32, VC.muted, 400, 2) + 10;
  y += head(ctx, x, y, 'Letter or mix');
  y += flow(ctx, P, MIXES().map(([v, n]) => ({ id: 'mix:' + v, label: n, on: on && mix === v, col: mixCol(v), fn: () => setMix(v) })), x, y, W, bottom, { px: 22, h: 50 }) + 14;
  if (mix === 'rule') y += numRow(ctx, P, 'time', x, y, W);
  y += textBlock(ctx, I.what, x, y, W, 24, 32, VC.ink, 400, 2) + 10;
  y += stats(ctx, x, y, W, [['Chances', I.chances], ['Arrows', I.arrows], ['Read out', I.reads]]) + 12;
  y += head(ctx, x, y, 'Read out');
  y += flow(ctx, P, [['1', '1 more'], ['100', '100 more'], ['0', 'Clear']].map(([v, n]) => ({ id: 'read:' + v, label: n, fn: () => readOut(+v) }))
    .concat([{ id: 'again', label: 'Read again', fn: readAgain }]), x, y, W, bottom, { px: 22, h: 50 }) + 14;
  y += head(ctx, x, y, 'Show');
  y += flow(ctx, P, [['helix', 'The helix'], ['copies', 'The copies'], ['qubits', 'The qubits']].map(([v, n]) => ({ id: 'v:' + v, label: n, on: X.scene === 'letters' && viewIs('letters', v), fn: () => showView('letters', v) })), x, y, W, bottom, { px: 22, h: 50 }) + 14;
  footNote(ctx, 'Each read-out lands on one letter, by its chance: the piles grow roughly as tall as the chances. |01⟩ means first 0, then 1.', x, y, W, bottom);
}
function drawRulePane(ctx, P, x, y, W, bottom) {
  const mi = ruleModel(), v = ruleView(), on = X.scene === 'rule', I = ruleInfo();
  const letters = key => LETTER_CHIPS.map(([l, n, col]) => ({ id: key + ':' + l, label: n, col, on: LET[letterOf(key)] === l, fn: () => sceneCtl('rule', key, l) }));
  y += textBlock(ctx, 'A rule of change: how readily each letter swaps for another, and how common each is in the long run. Example rates, computed as you choose.', x, y, W, 23, 32, VC.muted, 400, 2) + 10;
  y += head(ctx, x, y, 'Rule');
  y += flow(ctx, P, M.MODELS.map((m, i) => ({ id: 'model:' + m.key, label: m.name, on: i === mi, fn: () => sceneCtl('rule', 'model', m.key) })), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  y += head(ctx, x, y, 'Show');
  y += flow(ctx, P, ctlOf('rule', 'view').options.map(([o, n]) => ({ id: 'v:' + o, label: n, on: on && v === o, fn: () => showView('rule', o) })), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  if (v === 'path') { y += head(ctx, x, y, 'Start'); y += flow(ctx, P, letters('start'), x, y, W, bottom, { px: 22, h: 50 }) + 12; }
  if (machineOn()) { y += head(ctx, x, y, 'Parent\'s letter'); y += flow(ctx, P, letters('parent'), x, y, W, bottom, { px: 22, h: 50 }) + 12; }
  if (v !== 'rule') y += numRow(ctx, P, 'time', x, y, W);
  y += stats(ctx, x, y, W, I.rows) + 12;
  footNote(ctx, machineOn() ? 'The copy is two CNOT gates; the turn is rotations of single qubits plus steps that link two qubits, so it depends on the parent\'s letter. The angles depend only on the branch length.'
    : cap(I.note), x, y, W, bottom);
}
function drawTreePane(ctx, P, x, y, W, bottom) {
  const v = treeView(), on = X.scene === 'tree', tr = treeNow(), I = X.branch >= 0 && v !== 'species' ? branchInfo(X.branch) : null;
  const opts = key => ctlOf('tree', key).options.map(([o, n]) => ({ id: key + ':' + o, label: n, on: ctlValue('tree', ctlOf('tree', key)) === o, fn: () => sceneCtl('tree', key, o) }));
  y += textBlock(ctx, `A family tree from one ancestor, ${tr.nodes[tr.root].seq}, every swap simulated with the story's example rule. Heights are change: each branch rises by its length.`, x, y, W, 23, 32, VC.muted, 400, 2) + 10;
  y += head(ctx, x, y, 'Show');
  y += flow(ctx, P, ctlOf('tree', 'view').options.map(([o, n]) => ({ id: 'v:' + o, label: n, on: on && v === o, fn: () => showView('tree', o) })), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  y += head(ctx, x, y, 'Tree');
  y += flow(ctx, P, opts('seed').concat([{ id: 'newtree', label: 'New tree', fn: nextTree }]), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  y += head(ctx, x, y, 'Letters change');
  y += flow(ctx, P, opts('speed'), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  if (v !== 'tree') { y += head(ctx, x, y, 'Machines'); y += flow(ctx, P, opts('run'), x, y, W, bottom, { px: 22, h: 50 }) + 12; }
  // (in a headset the view from below would tip the tree over: stand in it instead)
  y += head(ctx, x, y, 'Look');
  y += flow(ctx, P, [['default', 'The whole tree'], ['stand', 'Stand in it']].concat(XR.on ? [] : [['up', 'Up from the root']])
    .map(([c, n]) => ({ id: 'cam:' + c, label: n, fn: () => { if (X.scene !== 'tree') openScene('tree'); flyTo(view('tree', c)); } })), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  if (v === 'species') { textBlock(ctx, 'The species tree of the authors\' test, ((1, 2), 3), with example branch lengths, and their stems at its tips; a coupling gear on each branch. See the Stem tab.', x, y, W, 23, 32, VC.ink, 400, 3); return; }
  y += head(ctx, x, y, 'Branch (or point at one and pull the trigger)');
  y += flow(ctx, P, tr.branches.map((B, i) => ({ id: 'br:' + i, label: String(i + 1), on: X.branch === i, ink: B.muts.length ? VC.ink : VC.muted, fn: () => selectBranch(X.branch === i ? -1 : i) })), x, y, W, bottom, { px: 21, h: 46 }) + 12;
  if (I) {
    y += textBlock(ctx, I.head, x, y, W, 27, 36, VC.ink, 700, 1) + 4;
    y += textBlock(ctx, `${cap(I.muts)}. ${I.seqs}; ${I.turn}.`, x, y, W, 23, 31, VC.ink, 400, 3) + 10;
  }
  footNote(ctx, 'One machine per branch: the same steps on every branch, only how far they turn changes with its length.', x, y, W, bottom);
}
function drawStemPane(ctx, P, x, y, W, bottom) {
  const v = stemView(), on = X.scene === 'stem', live = stemLive(), me = stemMethod(), I = stemInfo();
  y += textBlock(ctx, `Three species carry one RNA stem of ${word(TD.pairs)} pairs. Rebuild their ancestor ${fmt(TD.n)} times with each method; count those whose ${word(TD.pairs)} pairs all hold.`, x, y, W, 23, 32, VC.muted, 400, 2) + 10;
  y += head(ctx, x, y, 'Show');
  y += flow(ctx, P, ctlOf('stem', 'view').options.map(([o, n]) => ({ id: 'v:' + o, label: n, on: on && v === o, fn: () => showView('stem', o) })), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  y += head(ctx, x, y, 'Numbers');
  y += flow(ctx, P, ctlOf('stem', 'src').options.map(([o, n]) => ({ id: 'src:' + o, label: n, on: ctlValue('stem', ctlOf('stem', 'src')) === o, fn: () => sceneCtl('stem', 'src', o) }))
    .concat(live ? [{ id: 'rebuild', label: 'Rebuild again', fn: rebuildAgain }] : []), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  if (live) y += numRow(ctx, P, 'w', x, y, W);
  y += head(ctx, x, y, 'Method');
  y += flow(ctx, P, ctlOf('stem', 'method').options.map(([o, n]) => ({ id: 'm:' + o, label: n, col: METHOD_COL[o], on: me === o, fn: () => sceneCtl('stem', 'method', o) })), x, y, W, bottom, { px: 22, h: 50 }) + 14;
  // (the methods named as on the page's pane)
  y += stats(ctx, x, y, W, I.rows.map(r => r.slice(0, 3)), 280) + 8;
  y += head(ctx, x, y, 'The true ancestor and one rebuilt each');
  y += stats(ctx, x, y, W, [['True', I.truth, I.truthB]].concat(I.ex.map(r => r.slice(0, 3))), 280) + 10;
  footNote(ctx, `The coupled circuit favours matching pairs too strongly: believable ancestors, but its percentages are not true chances. Only ${TD.allSixPrior} of ancestors have all ${word(TD.pairs)} pairs matched.${live ? ' The coupling here is our stand-in for the authors\' circuit.' : ''}`, x, y, W, bottom);
}
// the four scenes, and the chosen scene's own controls (its sliders too)
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
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => sceneCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
  for (const key of Object.keys(NUM).filter(k => numShown(X.scene, k))) if (y + 90 < bottom) y += numRow(ctx, P, key, x, y, W);
}

//#use sigFoot drawFoot drawFootX