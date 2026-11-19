//#use head VC vfont cssColor rr wrapLines textBlock fitText fitTitle vButton swatch makePanel panelDepth panelTick
//#use panelPaint FADE FADECV panelFade panelSend panelPatch
//#use sigMain
const sigMainS = () => '';
// explore mode in the main panel's signature (sigMain)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.organ, X.domain, X.age, X.step, X.kind, X.tab === 'organs' ? GL.orgV || 0 : 0].join('|');
}
const XR_HERE = 'micro';
const XR_TITLE = 'Tissue and time';
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
  ({ organs: drawOrgansPane, domains: drawDomainsPane, age: drawAgePane, method: drawMethodPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
//#use flow
// a chip's organ model (flow): its picture, or a soft dot while it is drawn
function flowIcon(ctx, it, cx, cy, h) {
  const c = ORGAN3D.pic(it.icon), q = h - 8;
  if (c) ctx.drawImage(c, cx + 7, cy + 4, q, q);
  else { ctx.beginPath(); ctx.arc(cx + 7 + q / 2, cy + 4 + q / 2, q * 0.16, 0, 7); ctx.fillStyle = 'rgba(255,158,196,0.6)'; ctx.fill(); }
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
//#use drawScenesPane~2

//#use sigFoot drawFoot drawFootX