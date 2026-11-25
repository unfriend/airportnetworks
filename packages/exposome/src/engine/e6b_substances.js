// ============================================== HEADSET PANES: SUBSTANCES ==
// Builder B's panes on the headset's panel: the twins of renderSubstances and renderGroups (e4b_substances.js), kept in
// step (both read subInfo and groupInfo). No typing in a headset: the Substances pane starts from the same well-known
// substances as the page's chips, and walks the network by a picked substance's threads and groups (or a point picked
// in the cloud with the ray).
function drawSubstancesPane(ctx, P, x, y, W, bottom) {
  const I = subInfo(XB.sub);
  if (!I) y += textBlock(ctx, 'Find a substance and follow its threads: its genes, its group, the diseases close to it. Point at one in the cloud, or start with one of these.', x, y, W, 24, 33, VC.muted, 400, 3) + 14;
  y += head(ctx, x, y, 'Start with');
  y += flow(ctx, P, B_QUICK().map(i => ({ id: 'bq:' + i, label: XDATA.label[i], on: XB.sub === i, fn: () => selectSub(XB.sub === i ? -1 : i) })), x, y, W, Math.min(bottom, y + (I ? 104 : 220)), { px: 21, h: 44 }) + 18;
  if (!I) { footNoteB(ctx, B_NOTE.sub, x, y, W, bottom); return; }
  const end = bottom;
  bottom -= 96;   // (room for the note, as the page shows it under every card)
  y += fitTitle(ctx, I.name, x, y, W - 150, 34, 42, LOOK.substance, 700, 24) + 4;
  vButton(ctx, P, 'bsub:none', x + W - 130, y - 46, 130, 42, 'None', () => selectSub(-1), { px: 21 });
  const sub = [I.full, I.fams.length ? `Chemical famil${I.fams.length > 1 ? 'ies' : 'y'}: ${listOf(I.fams.map(bFam))}` : ''].filter(Boolean).join(' · ');
  if (sub) y += textBlock(ctx, sub, x, y, W, 21, 28, VC.muted, 400, 2) + 10;
  y += stats(ctx, x, y, W, I.rows) + 8;
  if (I.net && y + 90 < bottom) {
    y += head(ctx, x, y, 'Its groups, from large to fine');
    y += flow(ctx, P, I.groups.map((k, lv) => ({ id: 'bg:' + k, label: `${bWords(k)} · ${fmt(XDATA.comm.size[k])}`, col: XDATA.comm.col[I.groups[0]], fn: () => { selectGroup(k); pickTab('groups'); } })), x, y, W, bottom, { px: 21, h: 44 }) + 14;
  }
  if (y + 70 < bottom) {
    y += head(ctx, x, y, 'Its genes' + (I.genes ? ', most studied first' : ''));
    y += textBlock(ctx, I.genes ? I.genes.join(', ') + (XDATA.ngenes[I.i] > I.genes.length ? ` and ${fmt(XDATA.ngenes[I.i] - I.genes.length)} more` : '') : I.loading.genes ? '…' : 'not available offline', x, y, W, 22, 29, VC.ink, 400, 2) + 12;
  }
  if (y + 70 < bottom) {
    y += head(ctx, x, y, 'Diseases closest to it in this map');
    y += textBlock(ctx, I.dis ? (I.dis.length ? I.dis.map(([d, z]) => `${d} (z ${f2(z)})`).join('; ') : `none of the closest pairs (z below ${Z_CUT()})`) : I.loading.dis ? '…' : 'not available offline', x, y, W, 22, 29, VC.ink, 400, 3) + 12;
  }
  if (I.nb.length && y + 90 < bottom) {
    y += head(ctx, x, y, `Its strongest threads here (${fmt(I.nbAll)} drawn)`);
    y += flow(ctx, P, I.nb.map(j => ({ id: 'bn:' + j, label: XDATA.label[j], fn: () => selectSub(j) })), x, y, W, bottom - 60, { px: 21, h: 44 }) + 12;
  }
  const sc = SCENES.filter(([k]) => k === 'cell' || k === 'ppi');
  if (sc.length && y + 50 < bottom) y += flow(ctx, P, sc.map(([k, nm]) => ({ id: 'bs:' + k, label: `Its genes: ${nm}`, fn: () => openScene(k) })), x, y, W, bottom, { px: 21, h: 44 }) + 10;
  footNoteB(ctx, B_NOTE.sub, x, Math.max(y, bottom - 10), W, end);
}
function drawGroupsPane(ctx, P, x, y, W, bottom) {
  const I = groupInfo(XB.comm), C = XDATA.comm, big = B_BIG();
  if (!I) {
    y += textBlock(ctx, `The network falls into groups where its threads are dense, at three levels: ${fmt(C.counts[0])} large ones, ${fmt(C.counts[1])} smaller and ${fmt(C.counts[2])} fine.`, x, y, W, 24, 33, VC.muted, 400, 3) + 14;
    y += head(ctx, x, y, `The ${big.length} large groups (${fmt(XDATA.meta.levels.bigMin)} substances or more), and ${fmt(C.counts[0] - big.length)} small ones`);
    y += flow(ctx, P, big.map(k => ({ id: 'bg:' + k, label: `${bWords(k)} · ${fmt(C.size[k])}`, col: C.col[k], fn: () => selectGroup(k) })), x, y, W, bottom - 40, { px: 20, h: 42 }) + 14;
    footNoteB(ctx, B_NOTE.grp, x, y, W, bottom);
    return;
  }
  y += flow(ctx, P, I.path.map(q => ({ id: 'bp:' + q, label: bWords(q), on: q === I.k, col: C.col[I.path[0]], fn: () => selectGroup(q) })), x, y, W - 150, y + 100, { px: 21, h: 44 }) + 16;
  vButton(ctx, P, 'bgroup:none', x + W - 130, y - 60, 130, 44, 'All groups', () => selectGroup(-1), { px: 20 });
  y += fitTitle(ctx, I.name, x, y, W, 34, 42, VC.ink, 700, 24) + 4;
  y += textBlock(ctx, `A ${B_LEVEL[I.lv]} of ${fmt(I.size)} substances (the authors' ${I.id}).`, x, y, W, 22, 29, VC.muted, 400, 2) + 12;
  if (I.terms.length) {
    y += head(ctx, x, y, I.plain ? 'Its words come from these processes' : 'Its top terms');
    y += textBlock(ctx, I.terms.join('; '), x, y, W, 21, 28, VC.ink, 400, 3) + 12;
  }
  if (I.kids.length && y + 90 < bottom) {
    y += head(ctx, x, y, `Inside it: ${I.kids.length} ${B_LEVEL[I.lv + 1]}s`);
    y += flow(ctx, P, I.kids.map(q => ({ id: 'bg:' + q, label: `${bWords(q)} · ${fmt(C.size[q])}`, fn: () => selectGroup(q) })), x, y, W, Math.min(bottom, y + 150), { px: 20, h: 42 }) + 12;
  }
  if (y + 90 < bottom - 96) {
    y += head(ctx, x, y, I.memAll > I.mem.length ? `Members: the ${I.mem.length} best studied of ${fmt(I.memAll)}` : 'Members');
    y += flow(ctx, P, I.mem.map(i => ({ id: 'bm:' + i, label: XDATA.label[i], fn: () => { selectSub(i); pickTab('substances'); } })), x, y, W, bottom - 96, { px: 20, h: 42 }) + 10;
  }
  footNoteB(ctx, B_NOTE.grp, x, Math.max(y, bottom - 106), W, bottom);   // (the note, as the page shows it under every card)
}
// a closing note in the room left, if any
const footNoteB = (ctx, text, x, y, W, bottom) => { if (y + 60 < bottom) textBlock(ctx, text, x, y, W, 21, 29, VC.faint, 400, Math.max(1, Math.min(4, Math.floor((bottom - y) / 29)))); };
