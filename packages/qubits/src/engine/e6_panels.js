//#use head VC vfont cssColor rr wrapLines textBlock fitText fitTitle vButton swatch makePanel panelDepth panelTick
//#use panelPaint FADE FADECV panelFade panelSend panelPatch
//#use sigMain
const sigMainS = () => '';
// explore mode in the main panel's signature (sigMain)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.brick, X.sum, X.gal].join('|');
}
const XR_HERE = 'qubits';
const XR_TITLE = 'Three qubits';
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
  ({ network: drawNetworkPane, bricks: drawBricksPane, depth: drawDepthPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
//#use flow head~2 vSlider stats
function drawNetworkPane(ctx, P, x, y, W, bottom) {
  const ni = cubeNet(), N = Q.NETS[ni], L = cubeBits(), A = curAn(), p3 = anOf(ni, cubeCut(), 3).purity, hw = (W - 24) / 2;
  y += head(ctx, x, y, 'Example network (made up for this story)');
  y += flow(ctx, P, Q.NETS.map((n, i) => ({ id: 'net:' + i, label: n.name, on: i === ni, fn: () => sceneCtl('cube', 'net', String(i)) })), x, y, W, bottom, { px: 22, h: 50 }) + 8;
  y += textBlock(ctx, cap(N.note) + '.', x, y, W, 21, 29, VC.muted, 400, 2) + 14;
  head(ctx, x, y, 'Cut'); head(ctx, x + hw + 24, y, 'Bits (cuts)');
  y += 34;
  flow(ctx, P, [['0', 'Found'], ['1', 'Random halvings']].map(([v, n]) => ({ id: 'cut:' + v, label: n, on: (v === '1') === (cubeCut() === 'random'), fn: () => sceneCtl('cube', 'cut', v) })), x, y, hw, bottom, { px: 22, h: 50 });
  y += flow(ctx, P, ['1', '2', '3'].map(v => ({ id: 'bits:' + v, label: v, on: +v === L, fn: () => sceneCtl('cube', 'bits', v) })), x + hw + 24, y, hw, bottom, { px: 22, h: 50 }) + 14;
  y += head(ctx, x, y, 'Show');
  y += flow(ctx, P, [['genes', 'Genes'], ['cut', 'The cuts'], ['cube', 'The cube (A_c)']].map(([v, n]) => ({ id: 'v:' + v, label: n, on: X.scene === 'cube' && viewIs('cube', v), fn: () => showView('cube', v) })), x, y, W, bottom, { px: 22, h: 50 }) + 16;
  y += stats(ctx, x, y, W, [['Cells', cellsText(A)], ['Hidden groups', p3 === null ? 'none' : pct(p3), p3 === null ? 'no groups in it' : 'of genes with their group, at 3 bits'],
    ['Links cut', pct(A.cutShare), 'of links run between cells'], ['On cube edges', pct(A.cubeShare), 'of the traffic between cells'],
    ['Residual', `${f2(A.fits.odd.residual)} ${algLabel('odd', L)} · ${f2(A.fits.tfim.residual)} ${algLabel('tfim', L)}`]]) + 10;
  y += flow(ctx, P, A.sizes.map((s, c) => ({ id: 'cell:' + c, label: `${codeStr(c, L)} · ${s}`, col: cellCol(c, L) })), x, y, W, bottom, { px: 21, h: 44 }) + 16;
  if (y + 60 < bottom) textBlock(ctx, 'The residual is the share of A_c the toolbox drops: 0 nothing lost, 1 everything; at 1 bit always 0. The cut stands in for the authors\' beam search. After the method and figures of Joel Hancock.', x, y, W, 21, 29, VC.faint, 400, Math.max(1, Math.min(3, Math.floor((bottom - y) / 29))));
}
function drawBricksPane(ctx, P, x, y, W, bottom) {
  const L = cubeBits(), A = curAn(), alg = cubeAlg(), k = brickK(X.brick, L);
  const one = (nm, gal, w) => { const kk = Q.parse(nm, L), out = kk > 0 && !inAlg(kk, L, alg);
    return { id: `b:${gal}:${nm}`, label: sub(nm) + (w !== undefined ? ' ' + f2(w) : ''), col: kk === 0 ? null : out ? GRAY : PURPLE, ink: out ? VC.muted : VC.ink,
      on: X.brick === nm, fn: () => selectBrick(X.brick === nm ? null : nm, gal) }; };
  y += textBlock(ctx, 'Pauli strings, the building blocks of any traffic table between cells. Pick one to see it on the cube, or add the largest up.', x, y, W, 23, 32, VC.muted, 400, 2) + 10;
  y += head(ctx, x, y, 'The kinds of brick (the reference figure)');
  y += flow(ctx, P, kindsAt(L).map(nm => one(nm, 'kinds')), x, y, W, bottom, { px: 22, h: 46 }) + 10;
  y += head(ctx, x, y, `This network's ${word(NB())} largest, with their weights`);
  y += flow(ctx, P, largestAt(A).map(nm => one(nm, 'largest', A.c.re[Q.parse(nm, L)])), x, y, W, bottom, { px: 21, h: 46 }) + 12;
  if (k >= 0) {
    y += textBlock(ctx, `${sub(X.brick)} · ${f2(A.c.re[k])}`, x, y, W, 32, 40, VC.ink, 700, 1) + 4;
    y += textBlock(ctx, `${cap(brickWhat(k, L))}. ${k === 0 ? 'The trace part: kept.' : inAlg(k, L, alg) ? `Inside ${algLabel(alg, L)}: kept.` : `Outside ${algLabel(alg, L)}: dropped.`}`, x, y, W, 23, 31, VC.ink, 400, 2) + 12;
  } else if (X.brick) y += textBlock(ctx, `${sub(X.brick)} needs more bits than the ${L} shown.`, x, y, W, 23, 31, VC.muted, 400, 1) + 12;
  ctx.font = vfont(23); ctx.fillStyle = VC.ink; ctx.textBaseline = 'middle'; ctx.fillText('Add up', x, y + 25);
  ctx.font = vfont(26, 700); ctx.textAlign = 'right'; ctx.fillText(String(X.sum), x + W, y + 25); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  vSlider(ctx, P, 'sum', x + 110, y, W - 170, X.sum, 0, NB(), PURPLE, v => setSum(v, true));
  y += 54;
  y += textBlock(ctx, errText(A), x, y, W, 22, 30, VC.muted, 400, 1) + 14;
  y += head(ctx, x, y, 'The toolbox (a Lie algebra)');
  y += flow(ctx, P, [['1', 'odd'], ['0', 'tfim']].map(([v, a]) => ({ id: 'alg:' + v, label: `${algLabel(a, L)} · ${Q.algebra(a, L).dim} strings`, on: alg === a, fn: () => sceneCtl('cube', 'alg', v) }))
    .concat([['bricks', 'Every brick'], ['toolbox', 'Only the toolbox']].map(([v, n]) => ({ id: 'v:' + v, label: n, on: X.scene === 'cube' && viewIs('cube', v), fn: () => showView('cube', v) }))), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  if (y + 60 < bottom) y += textBlock(ctx, `Residual: ${f2(A.fits[alg].residual)} of the table falls outside ${algLabel(alg, L)} and is dropped.`, x, y, W, 23, 31, VC.ink, 400, 2) + 10;
  if (y + 60 < bottom) textBlock(ctx, `Purple: inside the toolbox; gray: outside. Solid +, dashed −. ${algLabel('tfim', L)}: X on each qubit, ZZ on neighbors; ${algLabel('odd', L)} adds Z on q${L - 1}.`, x, y, W, 21, 29, VC.faint, 400, Math.max(1, Math.min(3, Math.floor((bottom - y) / 29))));
}
function drawDepthPane(ctx, P, x, y, W, bottom) {
  const R = FACTS.real.R, ex = FACTS.ex.res, circ = viewIs('chart', 'circuit'), src = chartSrc(), G = (api('chart').gates || [])[src] || [];
  y += textBlock(ctx, 'In the real network: how much of A_c the best toolbox drops at each depth, our cuts against random ones. 0 means nothing lost.', x, y, W, 23, 32, VC.muted, 400, 2) + 12;
  // the table: bits across, our cuts, random cuts and the example network's
  const cw = (W - 150) / R.bits.length, rowT = (name, vals, col, bold) => {
    ctx.font = vfont(22); ctx.fillStyle = col; ctx.fillText(name, x, y + 4);
    ctx.font = vfont(22, bold ? 700 : 400); ctx.fillStyle = bold ? VC.ink : VC.ink; ctx.textAlign = 'right';
    vals.forEach((v, i) => { if (v !== null) ctx.fillText(typeof v === 'number' && !bold ? f2(v) : String(v), x + 150 + (i + 1) * cw - 6, y + 4); });
    ctx.textAlign = 'left'; y += 36;
  };
  rowT('Bits', R.bits, VC.muted, true); rowT('Our cuts', R.ours, VC.cyan); rowT('Random', R.random, GRAY); rowT('Example', R.bits.map((b, i) => (i < ex.length ? ex[i] : null)), VC.amber);
  y += 8;
  y += textBlock(ctx, `Good at 2 to 4 bits, worse with every bit: at 8 bits ours lose ${f2(FACTS.real.ours(8))} (the best variant ${f2(R.best8)}), random cuts ${f2(FACTS.real.rand(8))}.`, x, y, W, 23, 31, VC.ink, 400, 2) + 14;
  y += head(ctx, x, y, 'Show');
  y += flow(ctx, P, [['chart', 'The chart'], ['circuit', 'The circuit']].map(([v, n]) => ({ id: 'v:' + v, label: n, on: X.scene === 'chart' && viewIs('chart', v), fn: () => showView('chart', v) }))
    .concat(circ ? [['real', 'Real angles'], ['ex', 'Example angles']].map(([v, n]) => ({ id: 'src:' + v, label: n, on: (v === 'ex') === !!src, fn: () => sceneCtl('chart', 'src', v) }))
      : [['off', 'Example: off'], ['on', 'Example: on']].map(([v, n]) => ({ id: 'ex:' + v, label: n, on: ctlValue('chart', ctlOf('chart', 'ex')) === v, fn: () => sceneCtl('chart', 'ex', v) }))), x, y, W, bottom, { px: 22, h: 50 }) + 14;
  y += head(ctx, x, y, `One Trotter step at 3 bits in ${FACTS.alg.odd.label} (${src ? 'example network' : 'real network'})`);
  // the gates in two columns, red for X-type and blue for Z-type
  const gw = (W - 20) / 2;
  G.forEach((g, i) => {
    const gx = x + (i % 2) * (gw + 20), gy = y + Math.floor(i / 2) * 40, col = GATE_COL[g.type];
    ctx.fillStyle = col; ctx.fillRect(gx, gy + 2, 5, 30);
    ctx.font = vfont(23, 700); ctx.fillStyle = col; ctx.fillText(`${g.type} ${g.qubits.map(q => 'q' + q).join(' ')}`, gx + 16, gy + 4);
    ctx.font = vfont(23); ctx.fillStyle = VC.ink; ctx.fillText(`θ ${f3s(g.theta)}`, gx + 16 + 170, gy + 4);
  });
  y += Math.ceil(G.length / 2) * 40 + 14;
  if (y + 60 < bottom) textBlock(ctx, `θ = −2ct, c = tr(P A_c)/8, R_P(θ) = exp(−iθP/2), t = 1. Real network, 3 bits: ${FACTS.alg.odd.label}'s generators carry ${FACTS.real.so7.gens}% of A_c's traceless weight, the whole algebra ${FACTS.real.so7.whole}% (the authors' run, Joel Hancock).`, x, y, W, 21, 29, VC.faint, 400, Math.max(1, Math.min(4, Math.floor((bottom - y) / 29))));
}
// the three scenes, and the chosen scene's own controls
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
}

//#use sigFoot drawFoot drawFootX