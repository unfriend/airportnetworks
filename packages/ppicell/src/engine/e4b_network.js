// ================================================================ NETWORK ==
// The Network tab (SPEC.md, "Your own network"): the method's limits, live, and a network of one's own chosen on the
// page. The limits (X.lim) are the station's, shared in a room (collabState's lim) and in the address (&links=,
// &support=, &rel=, &places=, &group=off); a network chosen here (OWNN) is this device's alone: read in the page, never
// sent anywhere, kept only when asked (IndexedDB, this browser).
// The limits at their defaults: the picture and the counts are the story's (the generator's communities and layout).
// top: links drawn at most; sup: the least support (a step of the network's own: PNET.steps); rel: the Atlas's
// reliability levels counted (bits 1 Uncertain, 2 Approved, 3 Supported, 4 Enhanced; bit 0, none given, always);
// pls: the places counted (13 bits, the Pick tab's order); grp: communities (1) or the dots spread evenly (0)
const LIM0 = { top: 2000, sup: 0, rel: 31, pls: 8191, grp: 1 };
const limDefault = (l = X.lim) => Object.keys(LIM0).every(k => l[k] === LIM0[k]);
const REL_LEVELS = [[4, 'Enhanced'], [3, 'Supported'], [2, 'Approved'], [1, 'Uncertain']];
// a limit set by hand (ui: with a sound): checked, so a bad value never reaches the cell
function setLim(k, v, ui) {
  const ok = { top: x => api('cell').tops.includes(x), sup: x => Number.isInteger(x) && x >= 0 && x < api('cell').steps(X.own).length, rel: x => Number.isInteger(x) && (x & 30) !== 0 && x >= 0 && x <= 31,
    pls: x => Number.isInteger(x) && x > 0 && x <= 8191, grp: x => x === 0 || x === 1 }[k];
  if (!ok || !ok(v) || X.lim[k] === v) return;
  X.lim[k] = v;
  if (ui) sfxAct('step', 'cell', null);
  pushState(); renderAll();
}
// (a level or a place switched; the last one on stays on: nothing counted would leave the cell empty)
const toggleRel = b => setLim('rel', (X.lim.rel ^ 1 << b) | 1, true);
const togglePlace = k => setLim('pls', X.lim.pls ^ 1 << k, true);
function resetLim(ui) {
  if (limDefault()) return;
  X.lim = Object.assign({}, LIM0);
  if (ui) sfxAct('step', 'cell', null);
  pushState(); renderAll();
}
// what is being worked out (the cell's job), in words: '' when nothing is
function jobLine() {
  const j = GL.sets.cell && GL.sets.cell.job && GL.sets.cell.job();
  if (!j) return '';
  const w = { limits: 'applying the limits', grouping: `finding the communities (${Math.round(100 * j.frac)} %)`, arranging: 'arranging the proteins', drawing: 'judging and drawing the links' }[j.stage] || 'working';
  return `Working: ${w}. The cell changes when it is ready.`;
}
// the network on show and its limits, in words (both panes)
function netLine() {
  const s = GL.sets.cell && GL.sets.cell.stats();
  if (!s || !s.P) return '';
  const own = !!(s.opt && s.opt.own && OWNN.model), P = s.P, base = own ? OWNN.model.P : PDATA, placed = (() => { let n = 0; for (let p = 0; p < P.N; p++) if (P.pl[p]) n++; return n; })();
  const who = own ? `Your network${OWNN.name ? `: ${OWNN.name}` : ''}` : 'The built-in interactome (Menche and colleagues, 2015)';
  const lim = s.opt && s.opt.lim ? s.opt.lim : LIM0;
  const parts = [];
  if (P.E < base.E) parts.push(`${fmt(P.E)} of its ${fmt(base.E)} links have the least support asked for`);
  if ((lim.rel | 1) !== 31) parts.push(`places taken only from the Atlas's ${REL_LEVELS.filter(([b]) => lim.rel >> b & 1).map(([, n]) => n.toLowerCase()).join(', ')} locations`);
  if (lim.pls !== 8191) parts.push(`${fmt(popc(lim.pls))} of the 13 places count`);
  const where = own ? 'in your network' : 'in this map';
  return `${who}: ${fmt(P.N)} proteins, ${fmt(placed)} with a place ${where}, ${fmt(P.E)} links.${parts.length ? ` Limits: ${parts.join('; ')}.` : ' Every limit at its default.'}${s.opt && !s.opt.grp ? ' Communities off: the dots spread evenly through their places.' : ''}`;
}
const popc = x => { let c = 0; for (; x; x &= x - 1) c++; return c; };
// the limits' words, under them (both panes)
const LIM_TEXT = 'Links drawn: how many of the most important are drawn (the counts take every link). Least support: links with less are left out of the network. Reliability: proteins whose Atlas locations are less reliable count as having no place. Places: a protein in none of those counted has no place.';

// ------------------------------------------------------------- your own network --
// OWNN: the network chosen on this page (this device's alone). text: what was read (kept only in memory, and in this
// browser if Keep is pressed); report: what reading it found; model: its { P, S } (PNET.fromRows); kept: the name of the
// one kept in this browser (null none, undefined not looked yet); busy: what is being done, in words
const OWNN = { name: '', text: null, report: null, model: null, kept: undefined, busy: '', err: '', lookup: undefined };
const OWN_FORMAT = 'One pair a line: two identifiers (gene symbols such as TP53, UniProt accessions such as P04637, NCBI gene numbers or Ensembl gene ids), then if you like a score (a number) and a kind (a word). Tabs, commas or spaces between them; a first line of column names is skipped; lines starting with # are comments. Human proteins only.';
const OWN_PRIVATE = 'Only the pairs, scores and kinds are read: no other data, and never patient or variant data. Your network stays in this browser: it is not sent anywhere, and it is kept only if you press Keep.';
const OWN_ROOM = 'In a shared room your network is this device\'s alone: the others keep seeing the built-in network, and what you change here is not shared until you go back to it.';
const inRoom = () => { try { return !!(HOST.collab && HOST.collab.code); } catch (e) { return false; } };
// the lookup (data/lookup.json): fetched once, only when a network is chosen; null when it could not be had
async function ownLookup() {
  if (OWNN.lookup !== undefined) return OWNN.lookup;
  try {
    const r = await fetch(pkgUrl('data/lookup.json'));
    if (!r.ok) throw new Error(r.status);
    OWNN.lookup = PNET.decodeLookup(await r.json());
  } catch (e) { OWNN.lookup = null; }
  return OWNN.lookup;
}
// a network's text read, mapped and shown (name: its file's name)
async function chooseText(text, name) {
  if (LOAD.gone) return;
  OWNN.busy = 'Reading…'; OWNN.err = ''; renderAll();
  await new Promise(r => setTimeout(r, 30));   // (the words above shown before the work)
  const R = PNET.parse(text);
  if (R.error) { OWNN.busy = ''; OWNN.err = R.error; renderAll(); return; }
  OWNN.busy = 'Mapping the proteins…'; renderAll();
  const LK = await ownLookup();
  if (LOAD.gone) return;
  const { model, report } = PNET.fromRows(R, LK, name);
  OWNN.busy = ''; OWNN.report = report;
  if (!model) { OWNN.err = 'None of these pairs has both its proteins in the map or the lookup.'; renderAll(); return; }
  OWNN.name = name; OWNN.text = text; OWNN.model = model;
  api('cell').own(model);
  // (another network while one's own is on show: its picks and limits start afresh)
  if (X.own) { X.pp = X.pc = X.cx = -1; X.lim = Object.assign({}, LIM0); X.ctl.cell.kind = '-1'; kindOptions(); SRCH.byDeg = null; }
  setOwn(1, true);
}
// your network on show (1) or the built-in one (0). The built-in one's state (picks, limits, switches) is kept as the
// room's while yours is on show (X.bi: collabState gives it, collabApply keeps the room's there) and comes back with it
function setOwn(on, ui) {
  on = on && OWNN.model ? 1 : 0;
  if (on === X.own) { renderAll(); return; }
  if (on) {
    X.bi = collabState();
    X.own = 1; X.pp = X.pc = X.cx = -1; X.lim = Object.assign({}, LIM0);
    const kc = ctlOf('cell', 'kind');
    if (kc) X.ctl.cell.kind = '-1';
  } else {
    const s = X.bi;
    X.bi = null; X.own = 0; X.pp = X.pc = X.cx = -1; X.lim = Object.assign({}, LIM0);
    kindOptions();
    if (s) collabApply(s);
  }
  kindOptions();
  SRCH.byDeg = null;
  if (ui) sfxAct('clink', 'cell', 'centre');
  pushState(); renderAll();
}
// the Evidence switch's options: the map's kinds, or your network's words
function kindOptions() {
  const c = ctlOf('cell', 'kind');
  if (!c) return;
  const names = X.own && OWNN.model ? OWNN.model.P.kindNames : ['Regulatory', 'Binary', 'Literature', 'Metabolic', 'Complexes', 'Kinase', 'Signalling'];
  c.options = [['-1', 'All'], ...names.map((n, k) => [String(k), n])];
}
// kept in this browser (IndexedDB, guarded: a private window may refuse it); never sent anywhere
const IDB = { db: null };
function idb() {
  if (IDB.db) return IDB.db;
  IDB.db = new Promise((ok, no) => {
    try {
      const r = indexedDB.open('ppicell-own', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('net');
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
    } catch (e) { no(e); }
  });
  return IDB.db;
}
async function idbDo(mode, f) {
  const db = await idb();
  return new Promise((ok, no) => { const t = db.transaction('net', mode), q = f(t.objectStore('net')); t.oncomplete = () => ok(q && q.result); t.onerror = () => no(t.error); });
}
async function ownKeep() {
  if (!OWNN.model || OWNN.text === null) return;
  try { await idbDo('readwrite', st => st.put({ name: OWNN.name, text: OWNN.text, at: Date.now() }, 'kept')); OWNN.kept = OWNN.name; }
  catch (e) { OWNN.err = 'This browser would not keep it (a private window?).'; }
  renderAll();
}
async function ownForget() {
  try { await idbDo('readwrite', st => st.delete('kept')); } catch (e) { /* nothing kept */ }
  OWNN.kept = null; renderAll();
}
async function ownKeptName() {
  if (OWNN.kept !== undefined) return;
  OWNN.kept = null;
  try { const v = await idbDo('readonly', st => st.get('kept')); OWNN.kept = v && typeof v.name === 'string' ? v.name : null; } catch (e) { OWNN.kept = null; }
  if (!LOAD.gone) renderAll();
}
async function ownLoadKept() {
  try { const v = await idbDo('readonly', st => st.get('kept')); if (v && typeof v.text === 'string') return chooseText(v.text, v.name); } catch (e) { /* none */ }
  OWNN.err = 'Nothing kept in this browser.'; renderAll();
}
async function ownExample() {
  try { const r = await fetch(pkgUrl('data/example.txt')); if (!r.ok) throw new Error(r.status); return chooseText(await r.text(), 'example.txt (GRB2 and its partners)'); }
  catch (e) { OWNN.err = 'The example could not be fetched.'; renderAll(); }
}
// the identifiers not found, as a text file made in the page
function ownMissing() {
  const r = OWNN.report;
  if (!r || !r.missing.length) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([r.missing.join('\n') + '\n'], { type: 'text/plain' }));
  a.download = 'not-found.txt';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
// what reading found, in words (both panes)
function reportLines() {
  const r = OWNN.report;
  if (!r) return [];
  const ids = r.idKinds.map((k, i) => `column ${i + 1} ${PNET.ID_NAME[k]}`).join(', ');
  const out = [`${r.name}: ${fmt(r.read)} lines read${r.comments ? ` (and ${fmt(r.comments)} comments)` : ''}${r.header ? `, line ${r.header} taken as column names` : ''}; ${ids}${r.hasScore ? ', a score' : ''}${r.hasKind ? `, kinds (${r.kinds.join(', ')})` : ''}.`,
    `${fmt(r.pairs)} pairs kept (${fmt(r.dropped)} with a protein not found; pairs given twice joined). ${fmt(r.found)} proteins found (${fmt(r.inMap)} in the map), ${fmt(r.missing.length)} not found; ${fmt(r.placed)} with a place; ${fmt(r.judged)} links can be judged; ${fmt(r.complexes || 0)} of the Complex Portal's complexes have two members or more in it.`];
  if (!r.lookup) out.push('The lookup could not be loaded: only the map\'s own symbols and UniProt accessions were tried.');
  if (r.errors.length) out.push(`${fmt(r.errors.length)} ${r.errors.length === 1 ? 'line' : 'lines'} with a problem: ${r.errors.slice(0, 3).map(([n, w]) => `line ${n}, ${w}`).join('; ')}${r.errors.length > 3 ? '…' : ''}.`);
  return out;
}

// ------------------------------------------------------------- the panes --
function renderNet() {
  const pane = $('#pane-net');
  if (!pane) return;
  ownKeptName();
  if (!$('#netBody')) {
    pane.innerHTML = `<div id="netBody"></div>
      <div id="ownBox"><p class="grp-h">Your own network</p><p class="sub">${esc(OWN_FORMAT)}</p><p class="sub">${esc(OWN_PRIVATE)}</p>
      <label id="ownDrop" style="display:block;border:2px dashed var(--line, #567);border-radius:8px;padding:12px;margin:8px 0;cursor:pointer">Drop a file here (.tsv, .csv, .txt) or <input id="ownFile" type="file" accept=".tsv,.csv,.txt,text/plain,text/tab-separated-values,text/csv"></label>
      <textarea id="ownText" rows="4" style="width:100%;box-sizing:border-box" placeholder="or paste pairs here, one a line: TP53 MDM2" spellcheck="false"></textarea>
      <div class="chips"><button type="button" data-act="ownpaste" data-v="1">Use the text</button><button type="button" data-act="ownex" data-v="1">Try an example</button></div>
      <div id="ownBody"></div></div>`;
    const drop = $('#ownDrop'), file = f => { if (!f) return; if (f.size > PNET.MAX_BYTES) { OWNN.err = `The file is ${(f.size / 1e6).toFixed(1)} MB: this page takes at most ${PNET.MAX_BYTES / 1e6} MB.`; renderAll(); return; } f.text().then(t => chooseText(t, f.name)); };
    $('#ownFile').addEventListener('change', ev => file(ev.target.files[0]));
    drop.addEventListener('dragover', ev => { ev.preventDefault(); drop.style.borderColor = 'var(--cyan)'; });
    drop.addEventListener('dragleave', () => { drop.style.borderColor = ''; });
    drop.addEventListener('drop', ev => { ev.preventDefault(); drop.style.borderColor = ''; file(ev.dataTransfer.files[0]); });
  }
  const st = api('cell').steps(X.own), tops = api('cell').tops, L = X.lim;
  $('#netBody').innerHTML = `<p class="sub">${esc(netLine())}</p>
    <p class="grp-h">Links drawn</p><div class="chips">${tops.map(v => chip(`data-act="lim" data-k="top" data-v="${v}"`, fmt(v), L.top === v)).join('')}</div>
    <p class="grp-h">Least support</p><div class="chips">${st.map((o, i) => chip(`data-act="lim" data-k="sup" data-v="${i}"`, esc(o.label), L.sup === i)).join('')}</div>
    <p class="grp-h">The Atlas's reliability</p><div class="chips">${REL_LEVELS.map(([b, n]) => chip(`data-act="rel" data-v="${b}"`, n, (L.rel >> b & 1) === 1)).join('')}</div>
    <p class="grp-h">Places that count</p><div class="chips">${(api('cell').places || []).map((n, k) => chip(`data-act="pls" data-v="${k}"`, esc(n), (L.pls >> k & 1) === 1)).join('')}${chip('data-act="lim" data-k="pls" data-v="8191"', 'All', L.pls === 8191)}</div>
    <p class="grp-h">Grouping</p><div class="chips">${[[1, 'Communities'], [0, 'Off']].map(([v, n]) => chip(`data-act="lim" data-k="grp" data-v="${v}"`, n, L.grp === v)).join('')}</div>
    <p class="sub">${esc(LIM_TEXT)}</p>
    ${jobLine() ? `<p class="sub" style="color:var(--amber)">${esc(jobLine())}</p>` : ''}
    <div class="chips">${chip('data-act="limreset" data-v="1"', 'Reset limits', false)}</div>`;
  const r = OWNN.report, lines = reportLines();
  $('#ownBody').innerHTML = `${OWNN.busy ? `<p class="sub" style="color:var(--amber)">${esc(OWNN.busy)}</p>` : ''}${OWNN.err ? `<p class="sub" style="color:var(--amber)">${esc(OWNN.err)}</p>` : ''}
    ${lines.map(t => `<p class="sub">${esc(t)}</p>`).join('')}
    ${r && r.missing.length ? `<p class="sub">Not found: ${esc(r.missing.slice(0, 30).join(', '))}${r.missing.length > 30 ? ` and ${fmt(r.missing.length - 30)} more` : ''}.</p><div class="chips"><button type="button" data-act="ownmiss" data-v="1">Download the list (not-found.txt)</button></div>` : ''}
    <div class="chips">${OWNN.model ? chip('data-act="own" data-v="1"', `Your network${OWNN.name ? ': ' + esc(OWNN.name) : ''}`, X.own === 1) : ''}${chip('data-act="own" data-v="0"', X.own ? 'Back to the built-in network' : 'The built-in network', X.own === 0)}</div>
    <div class="chips">${OWNN.model && OWNN.kept !== OWNN.name ? '<button type="button" data-act="ownkeep" data-v="1">Keep on this device</button>' : ''}${OWNN.kept ? `${OWNN.kept !== OWNN.name || !OWNN.model ? `<button type="button" data-act="ownkept" data-v="1">Open the kept one: ${esc(OWNN.kept)}</button>` : ''}<button type="button" data-act="ownforget" data-v="1">Forget it</button>` : ''}</div>
    ${OWNN.kept ? `<p class="sub">Kept in this browser: ${esc(OWNN.kept)}.</p>` : ''}
    ${X.own && inRoom() ? `<p class="sub">${esc(OWN_ROOM)}</p>` : ''}`;
}
// the Network tab's buttons (buildExplore's click handler: data-act)
function netAct(b) {
  const v = b.dataset.v;
  ({
    lim: () => setLim(b.dataset.k, +v, true), rel: () => toggleRel(+v), pls: () => togglePlace(+v), limreset: () => resetLim(true),
    own: () => setOwn(+v, true), ownpaste: () => { const t = $('#ownText').value; if (t.trim()) chooseText(t, 'pasted text'); },
    ownex: () => ownExample(), ownkeep: () => ownKeep(), ownforget: () => ownForget(), ownkept: () => ownLoadKept(), ownmiss: () => ownMissing(),
  }[b.dataset.act] || (() => {}))();
}
// the headset's twin (drawTabPane): the limits as buttons, what they do, and the network: chosen on a laptop only
const PLACE_SHORT = ['Cytosol', 'Nucleoplasm', 'Nucleolus', 'ER', 'Golgi', 'Mitochondria', 'Lysosomes', 'Endosomes', 'Peroxisomes', 'Plasma membrane', 'Nuclear envelope', 'Cytoskeleton', 'Vesicles'];
function drawNetPane(ctx, P, x, y, W, bottom) {
  ownKeptName();
  y += textBlock(ctx, netLine(), x, y, W, 22, 30, VC.ink, 400, 3) + 10;
  const LW = 190, L = X.lim, row = (label, items, o = {}) => {
    if (y + 50 > bottom) return;
    ctx.font = vfont(21); ctx.fillStyle = VC.muted; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y + 23); ctx.textBaseline = 'top';
    y += flow(ctx, P, items, x + LW, y, W - LW, bottom, Object.assign({ px: 21, h: 46 }, o)) + 10;
  };
  row('Links drawn', api('cell').tops.map(v => ({ id: 'lim:top:' + v, label: fmt(v), on: L.top === v, fn: () => setLim('top', v, true) })));
  row('Least support', api('cell').steps(X.own).map((o, i) => ({ id: 'lim:sup:' + i, label: o.label, on: L.sup === i, fn: () => setLim('sup', i, true) })));
  row('Reliability', REL_LEVELS.map(([b, n]) => ({ id: 'rel:' + b, label: n, on: (L.rel >> b & 1) === 1, fn: () => toggleRel(b) })));
  row('Places', PLACE_SHORT.map((n, k) => ({ id: 'pls:' + k, label: n, on: (L.pls >> k & 1) === 1, fn: () => togglePlace(k) })).concat([{ id: 'pls:all', label: 'All', on: L.pls === 8191, fn: () => setLim('pls', 8191, true) }]));
  row('Grouping', [[1, 'Communities'], [0, 'Off']].map(([v, n]) => ({ id: 'lim:grp:' + v, label: n, on: L.grp === v, fn: () => setLim('grp', v, true) })).concat([{ id: 'lim:reset', label: 'Reset limits', on: false, fn: () => resetLim(true) }]));
  if (jobLine() && y + 34 < bottom) y += textBlock(ctx, jobLine(), x, y, W, 21, 29, VC.amber || VC.ink, 400, 1) + 8;
  if (y + 40 < bottom) y += textBlock(ctx, 'Choose a network of your own on a laptop: a headset cannot sensibly pick a file.', x, y, W, 21, 29, VC.muted, 400, 2) + 8;
  const nets = [{ id: 'own:0', label: X.own ? 'Back to the built-in network' : 'The built-in network', on: X.own === 0, fn: () => setOwn(0, true) }];
  if (OWNN.model) nets.push({ id: 'own:1', label: `Your network${OWNN.name ? ': ' + OWNN.name : ''}`, on: X.own === 1, fn: () => setOwn(1, true) });
  else if (OWNN.kept) nets.push({ id: 'own:kept', label: `Kept here: ${OWNN.kept}`, on: false, fn: () => ownLoadKept() });
  if (y + 46 < bottom) y += flow(ctx, P, nets, x, y, W, bottom, { px: 21, h: 46 }) + 8;
  if (X.own && inRoom() && y + 34 < bottom) textBlock(ctx, OWN_ROOM, x, y, W, 20, 28, VC.muted, 400, 2);
}
