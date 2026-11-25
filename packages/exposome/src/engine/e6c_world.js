// ================================================== HEADSET PANES: WORLD ==
// Builder C's panes on the headset's panel: the twins of renderDiseases and renderCountries (e4c_world.js), kept in
// step (the same picks, words and notes; the search on the shell's keypad).
// a note at the foot of a pane, as far as there is room
function noteC(ctx, text, x, y, W, bottom) { if (y + 60 < bottom) textBlock(ctx, text, x, y, W, 19, 26, VC.muted, 400, Math.max(1, Math.floor((bottom - y) / 26))); }
function drawDiseasesPane(ctx, P, x, y, W, bottom) {
  y += textBlock(ctx, 'Find a disease: its proteins drawn together in the interactome, and the substances close to it in this map.', x, y, W, 22, 30, VC.muted, 400, 2) + 8;
  if (!XDATA.ready('diseases')) { textBlock(ctx, '…', x, y, W, 24, 32, VC.muted, 400, 1); XDATA.load('diseases', pkgUrl).then(renderAll, () => {}); return; }
  const o = { px: 21, h: 44 }, list = XC.q ? XDATA.dis.search(XC.q, 8) : QUICK_DIS.map(n => XDATA.dis.find(n)).filter(d => d >= 0);
  const items = list.map(d => ({ id: 'cd:' + d, label: disName(d), on: XC.dis === d, col: LOOK.disease, fn: () => selectDis(XC.dis === d ? -1 : d) }));
  if (HOST.collab && HOST.collab.keypad) items.push({ id: 'cdsearch', label: XC.q ? `Search: ${XC.q}` : 'Search…', fn: xrSearchC });
  if (XC.q) y += head(ctx, x, y, list.length ? `Matches for ${XC.q}` : `No disease holds ${XC.q}`);
  y += flow(ctx, P, items, x, y, W, Math.min(bottom, y + 3 * 52), o) + 10;
  const I = disInfo(XC.dis);
  if (!I) { y += textBlock(ctx, 'No disease picked.', x, y, W, 22, 30, VC.muted, 400, 1) + 10; noteC(ctx, NOTE_DIS, x, y, W, bottom); return; }
  y += textBlock(ctx, I.head, x, y, W - 130, 28, 36, LOOK.disease, 700, 1) + 4;
  vButton(ctx, P, 'cd:none', x + W - 120, y - 44, 120, 40, 'None', () => selectDis(-1), { px: 20, r: 6 });
  y += stats(ctx, x, y, W, I.rows) + 4;
  y += head(ctx, x, y, I.close.length ? 'Closest substances' : 'Closest substances: none below z −5');
  y += flow(ctx, P, I.close.map(e => ({ id: 'cs:' + e.s, label: `${subName(e.s)} · z ${f2(e.z)}`, on: XC.sub === e.s, col: LOOK.substance, fn: () => selectSubC(XC.sub === e.s ? -1 : e.s) })), x, y, W, Math.min(bottom, y + 3 * 52), o) + 8;
  if (I.pair && y + 70 < bottom) y += textBlock(ctx, I.pair, x, y, W, 21, 28, VC.ink, 400, 3) + 8;
  if (X.scene !== 'ppi' && y + 60 < bottom) y += flow(ctx, P, [{ id: 'cd:show', label: 'Show in the interactome', fn: () => { openScene('ppi'); setCtl('ppi', 'show', 'pick'); } }], x, y, W, bottom, o) + 8;
  noteC(ctx, NOTE_DIS, x, y, W, bottom);
}
function drawCountriesPane(ctx, P, x, y, W, bottom) {
  const C = XDATA.countries, order = C.map((c, i) => i).sort((a, b) => C[a].name.localeCompare(C[b].name)), I = XC.country >= 0 ? ctyInfo(XC.country) : null;
  y += textBlock(ctx, 'Pick a country on the globe or here: its releases far above Europe\'s level, and the diseases close to them in this map.', x, y, W, 21, 28, VC.muted, 400, 2) + 6;
  // the countries: their short names in a grid (four across), the picked one lit
  const cols = 4, cw = (W - 8 * (cols - 1)) / cols, bh = 36;
  order.forEach((i, k) => vButton(ctx, P, 'cc:' + i, x + (k % cols) * (cw + 8), y + Math.floor(k / cols) * (bh + 6), cw, bh, C[i].name, () => selectCountry(XC.country === i ? -1 : i), { on: XC.country === i, px: 18, r: 6 }));
  y += Math.ceil(order.length / cols) * (bh + 6) + 10;
  if (!I) { y += textBlock(ctx, 'No country picked.', x, y, W, 22, 30, VC.muted, 400, 1) + 10; noteC(ctx, NOTE_CTY, x, y, W, bottom); return; }
  y += textBlock(ctx, I.head, x, y, W, 28, 36, VC.ink, 700, 1) + 4;
  y += stats(ctx, x, y, W, I.rows) + 2;
  const o = { px: 19, h: 40 }, chipsOf = (L, col) => L.map(s => ({ id: 'cs:' + s, label: subName(s), on: XC.sub === s, col, fn: () => selectSubC(XC.sub === s ? -1 : s) }));
  if (I.air.length && y + 80 < bottom) { y += head(ctx, x, y, 'To air'); y += flow(ctx, P, chipsOf(I.air, '#aee9ff'), x, y, W, Math.min(bottom, y + 2 * 48), o) + 6; }
  if (I.water.length && y + 80 < bottom) { y += head(ctx, x, y, 'To water'); y += flow(ctx, P, chipsOf(I.water, '#3f86ff'), x, y, W, Math.min(bottom, y + 2 * 48), o) + 6; }
  if (I.inC && y + 80 < bottom) {
    y += head(ctx, x, y, `${subName(XC.sub)}: the diseases closest to it`);
    y += flow(ctx, P, I.near.map(e => ({ id: 'cd:' + e.d, label: `${disName(e.d)} · z ${f2(e.z)}`, on: XC.dis === e.d, col: LOOK.disease, fn: () => selectDis(XC.dis === e.d ? -1 : e.d, false) })), x, y, W, Math.min(bottom, y + 2 * 48), o) + 6;
  }
  noteC(ctx, NOTE_CTY, x, y, W, bottom);
}
