// ================================================================ NETWORK ==
// The Network tab (SPEC.md, "Your own network"): the method's limits, live, and a network of one's own chosen on the
// page. The limits (X.lim) are the station's, shared in a room (collabState's lim) and in the address (&links=,
// &support=, &rel=, &places=, &group=off); a network chosen here (OWNN) is this device's alone: read in the page, never
// sent anywhere unless its owner presses Share with this room or Put on the relay (SNET, below: stage 3), kept only when
// asked (IndexedDB, this browser).
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
  const M = ownModel(), own = !!(s.opt && s.opt.own && M), P = s.P, base = own ? M.P : PDATA, placed = (() => { let n = 0; for (let p = 0; p < P.N; p++) if (P.pl[p]) n++; return n; })();
  const who = own ? ownTitle() : 'The built-in interactome (Menche and colleagues, 2015)';
  const lim = s.opt && s.opt.lim ? s.opt.lim : LIM0;
  const parts = [];
  if (P.E < base.E) parts.push(`${fmt(P.E)} of its ${fmt(base.E)} links have the least support asked for`);
  if ((lim.rel | 1) !== 31) parts.push(`places taken only from the Atlas's ${REL_LEVELS.filter(([b]) => lim.rel >> b & 1).map(([, n]) => n.toLowerCase()).join(', ')} locations`);
  if (lim.pls !== 8191) parts.push(`${fmt(popc(lim.pls))} of the 13 places count`);
  const where = own ? (X.own === 2 ? 'in this shared network' : 'in your network') : 'in this map';
  return `${who}: ${fmt(P.N)} proteins, ${fmt(placed)} with a place ${where}, ${fmt(P.E)} links.${parts.length ? ` Limits: ${parts.join('; ')}.` : ' Every limit at its default.'}${s.opt && !s.opt.grp ? ' Communities off: the dots spread evenly through their places.' : ''}`;
}
const popc = x => { let c = 0; for (; x; x &= x - 1) c++; return c; };
// the limits' words, under them (both panes)
const LIM_TEXT = 'Links drawn: how many of the most important are drawn (the counts take every link). Least support: links with less are left out of the network. Reliability: proteins whose Atlas locations are less reliable count as having no place. Places: a protein in none of those counted has no place.';

// ------------------------------------------------------------- your own network --
// OWNN: the network chosen on this page (this device's alone). text: what was read (kept only in memory, and in this
// browser if Keep is pressed); report: what reading it found; model: its { P, S } (PNET.fromRows); kept: the name of the
// one kept in this browser (null none, undefined not looked yet); busy: what is being done, in words
const OWNN = { name: '', text: null, report: null, model: null, kept: undefined, busy: '', err: '', lookup: undefined, gen: 0 };
const OWN_FORMAT = 'One pair a line: two identifiers (gene symbols such as TP53, UniProt accessions such as P04637, NCBI gene numbers or Ensembl gene ids), then if you like a score (a number) and a kind (a word). Tabs, commas or spaces between them; a first line of column names is skipped; lines starting with # are comments. Human proteins only.';
const OWN_PRIVATE = 'Only the pairs, scores and kinds are read: no other data, and never patient or variant data. Your network stays in this browser: it is not sent anywhere unless you press Share with this room or Put on the relay, and it is kept only if you press Keep.';
const OWN_ROOM = 'In a shared room your network is this device\'s alone until you share it: the others keep seeing the room\'s network, and what you change here is not shared until you go back to it.';
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
// (gen: a file chosen while another is still being read wins; the older one's late result is dropped)
async function chooseText(text, name) {
  if (LOAD.gone) return;
  const g = ++OWNN.gen;
  OWNN.busy = 'Reading…'; OWNN.err = ''; renderAll();
  await new Promise(r => setTimeout(r, 30));   // (the words above shown before the work)
  if (g !== OWNN.gen || LOAD.gone) return;
  const R = PNET.parse(text);
  if (R.error) { OWNN.busy = ''; OWNN.err = R.error; renderAll(); return; }
  OWNN.busy = 'Mapping the proteins…'; renderAll();
  const LK = await ownLookup();
  if (g !== OWNN.gen || LOAD.gone) return;
  const { model, report } = PNET.fromRows(R, LK, name);
  OWNN.busy = ''; OWNN.report = report;
  if (!model) { OWNN.err = 'None of these pairs has both its proteins in the map or the lookup.'; renderAll(); return; }
  OWNN.name = name; OWNN.text = text; OWNN.model = model;
  // (another network while one's own is on show: its picks and limits start afresh)
  if (X.own === 1) { api('cell').own(model); X.pp = X.pc = X.cx = -1; X.lim = Object.assign({}, LIM0); X.ctl.cell.kind = '-1'; kindOptions(); SRCH.byDeg = null; }
  setOwn(1, true);
}
// your network on show (1) or the room's (0: the built-in one, or the station's shared one). The room's state (picks,
// limits, switches, a shared network) is kept while yours is on show (X.bi: collabState gives it, collabApply keeps the
// room's there) and comes back with it
function setOwn(on, ui) {
  on = on && OWNN.model ? 1 : 0;
  if (on === (X.own === 1 ? 1 : 0)) { renderAll(); return; }
  if (on) {
    X.bi = collabState();
    // (a shared network on show or on its way: dropped here, and back with the room's state)
    SNET.gen++; SNET.pend = null; X.net = '';
    api('cell').own(OWNN.model);
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
// the network on show other than the built-in one: yours (X.own 1) or the station's shared one (X.own 2), or null
const ownModel = () => (X.own === 2 ? SNET.model : X.own === 1 ? OWNN.model : null);
const ownTitle = () => (X.own === 2 ? `The shared network${SNET.name ? `: ${SNET.name}` : ''}` : `Your network${OWNN.name ? `: ${OWNN.name}` : ''}`);
// the Evidence switch's options: the map's kinds, or your network's words
function kindOptions() {
  const c = ctlOf('cell', 'kind');
  if (!c) return;
  const M = ownModel(), names = M ? M.P.kindNames : ['Regulatory', 'Binary', 'Literature', 'Metabolic', 'Complexes', 'Kinase', 'Signalling'];
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

// ------------------------------------------------------------- shared through the relay (stage 3) --
// A network of one's own goes to the relay only when its owner presses Share with this room (in a room) or Put on the
// relay (outside one): its pairs, scores and kinds as read and mapped (PNET.toDoc: the proteins' symbols, the links, the
// kinds' words, the file's name), kept there under an id made from them (relay/nets.mjs). The station's state then names
// it (net: the id), every device there fetches it, builds it between frames and shows it; picks, limits and switches work
// on it across devices as on the built-in one. A device that cannot have it says why and shows the built-in network,
// keeping the room's state as it came (SNET.pend: collabState gives it, so nothing it does is sent back).
// X.net: the id the station shows ('' the built-in network); SNET: that network (model, name), the work under way (busy,
// gen: a newer wish drops an older one), why it could not be had (err), the room's state kept meanwhile (pend), and the
// relay as this device sees it (relay: base, token, nets: whether it keeps them, why not) and its list of networks
const NET_ID = /^[a-z2-7]{12}$/;
const SNET = { id: '', name: '', model: null, busy: '', err: '', pend: null, gen: 0, put: '', putErr: '', link: '', ask: '', retry: null,
  relay: { at: -1e9, busy: null, base: '', token: '', nets: false, why: '', max: 12 << 20 }, list: null, listAt: -1e9, listBusy: null };
const NET_SAY = {
  room: 'Sharing a network needs a relay: this room runs peer to peer or on this device alone.',
  none: 'Sharing a network needs a relay: this page has none (GitHub Pages alone keeps nothing).',
  off: 'Sharing a network needs a relay that keeps them: this one does not (it keeps no scenes, was started with --no-nets, or is older than v208).',
  auth: 'This relay needs its password (under Shared) before a network can go on it or come from it.',
  away: 'The relay did not answer: sharing a network has to wait.',
};
// (the same, said of a network this device could not fetch)
const NET_GET = { room: 'this room runs peer to peer or on this device alone', none: 'no relay is known here', off: 'this relay keeps no shared networks',
  auth: 'the relay wants its password, under Shared', away: 'the relay did not answer' };
// the size a shared network may have, in words (measured: SPEC.md, "Stage 3")
const NET_SIZE = 'Up to 250,000 links (12 MB as sent) can be shared. Each device fetches and builds it: the built-in map\'s size (141,296 links, 1.9 MB) takes a few seconds on a laptop.';
// a fetch that gives up after ms (an AbortController and a timer: a relay that takes the call and never answers must not
// leave the panes busy for ever); the timer runs until the body is read (body: true) and dispose() clears every one
const NET_TIMERS = new Set(), NET_SLOW = 'the relay did not answer';
async function netFetch(url, opts, ms, body) {
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  let t = 0;
  const gone = new Promise((ok, no) => { t = setTimeout(() => { NET_TIMERS.delete(t); try { if (ac) ac.abort(); } catch (e) { /* none */ } no(new Error(NET_SLOW)); }, ms); NET_TIMERS.add(t); });
  gone.catch(() => {});
  try {
    const r = await Promise.race([fetch(url, Object.assign({}, opts, ac ? { signal: ac.signal } : {})), gone]);
    if (!body) return { r };
    let j = null;
    try { j = await Promise.race([r.json(), gone]); } catch (e) { if (e && e.message === NET_SLOW) throw e; }
    return { r, j };
  } catch (e) { throw new Error(e && e.message === NET_SLOW || (e && e.name === 'AbortError') ? NET_SLOW : 'the relay could not be reached'); }
  finally { clearTimeout(t); NET_TIMERS.delete(t); }
}
// p, or null after ms (the shell's relayFind may ask a relay itself)
function netWithin(p, ms) {
  let t = 0;
  return Promise.race([p, new Promise(ok => { t = setTimeout(() => { NET_TIMERS.delete(t); ok(null); }, ms); NET_TIMERS.add(t); })]).finally(() => { clearTimeout(t); NET_TIMERS.delete(t); });
}
function netStop() { for (const t of NET_TIMERS) clearTimeout(t); NET_TIMERS.clear(); }
// the networks this browser put on a relay (per relay origin, in localStorage, guarded; an id is not private): only they
// get *Remove from the relay* here
const NET_MINE = 'ppicellNetsPut';
function netMine(base, id, add) {
  let all = {};
  try { all = JSON.parse(localStorage.getItem(NET_MINE) || '{}') || {}; } catch (e) { all = {}; }
  let o = ''; try { o = new URL(base).origin; } catch (e) { return false; }
  const ids = Array.isArray(all[o]) ? all[o].filter(x => NET_ID.test(x)) : [];
  if (add === undefined) return ids.includes(id);
  all[o] = (add ? ids.filter(x => x !== id).concat(id) : ids.filter(x => x !== id)).slice(-100);
  try { localStorage.setItem(NET_MINE, JSON.stringify(all)); } catch (e) { /* a private window */ }
  return add;
}
const relayHost = () => { try { return new URL(SNET.relay.base).host; } catch (e) { return 'the relay'; } };
// the relay this device would share through (HOST.collab.relayFind: the one it knows or is served by, with its password
// as a header, never in an address), and whether it keeps shared networks (/api/ping's nets); asked every 30 s at most
function netRelay(again) {
  const R = SNET.relay;
  if (R.busy) return R.busy;
  if (!again && performance.now() - R.at < 30000) return Promise.resolve(R.nets ? R : null);
  R.busy = (async () => {
    if (inRoom() && HOST.collab.via !== 'relay') { Object.assign(R, { base: '', nets: false, why: 'room' }); return null; }
    let f = null;
    try { f = HOST.collab && HOST.collab.relayFind ? await netWithin(HOST.collab.relayFind(), 15000) : null; } catch (e) { f = null; }
    if (!f || !f.base) { Object.assign(R, { base: '', nets: false, why: 'none' }); return null; }
    Object.assign(R, { base: String(f.base).replace(/\/+$/, ''), token: f.token || '' });
    try {
      const { r, j } = await netFetch(R.base + '/api/ping', { cache: 'no-store', headers: R.token ? { Authorization: 'Bearer ' + R.token } : {} }, 10000, true);
      Object.assign(R, { nets: !!(r.ok && j && j.nets), why: r.status === 401 ? 'auth' : r.ok && j && j.nets ? '' : r.ok ? 'off' : 'away' });
    } catch (e) { Object.assign(R, { nets: false, why: 'away' }); }
    return R.nets ? R : null;
  })().finally(() => { R.at = performance.now(); R.busy = null; if (!LOAD.gone) renderAll(); });
  return R.busy;
}
// a call to that relay: the password as a header, what it answered told to the shell (a 401 brings up its prompts); given
// up after 20 s, longer for a large body (a second for every 100 kB more, sending or fetching: o.big), at most 3 minutes
async function netCall(path, o = {}) {
  const R = SNET.relay, headers = Object.assign({}, o.headers || {});
  if (R.token) headers.Authorization = 'Bearer ' + R.token;
  const ms = Math.min(180000, 20000 + Math.max(o.body ? o.body.length : 0, o.big || 0) / 100);
  const { r, j } = await netFetch(R.base + path, { method: o.method || 'GET', headers, body: o.body, cache: 'no-store' }, ms, true);
  try { if (HOST.collab && HOST.collab.relaySaw) HOST.collab.relaySaw(R.base, r.status, R.token, r.ok ? null : j); } catch (e) { /* an older shell */ }
  if (!r.ok) throw Object.assign(new Error(r.status === 401 ? 'the relay wants its password (under Shared)' : r.status === 404 && j && /keeps no shared/.test(j.error || '') ? 'this relay keeps no shared networks' : r.status === 404 ? 'it is not on the relay (removed?)' : (j && j.error) || 'HTTP ' + r.status), { status: r.status });
  return j;
}
// the relay's networks (GET /api/nets: name, proteins, links; newest first), asked when a pane shows them, every 30 s
function netList(again) {
  if (SNET.listBusy) return SNET.listBusy;
  if (!again && performance.now() - SNET.listAt < 30000) return Promise.resolve(SNET.list);
  SNET.listBusy = (async () => {
    if (!(await netRelay())) { SNET.list = null; return null; }
    try { const j = await netCall('/api/nets'); SNET.list = Array.isArray(j.nets) ? j.nets.slice(0, 12) : []; if (j.max && j.max.bytes) SNET.relay.max = j.max.bytes; } catch (e) { SNET.list = null; }
    return SNET.list;
  })().finally(() => { SNET.listAt = performance.now(); SNET.listBusy = null; if (!LOAD.gone) renderAll(); });
  return SNET.listBusy;
}
// the state as this page has it now (collabState without what stands for the room's)
function stateNow() {
  const ctl = {};
  for (const [k] of SCENES) ctl[k] = Object.fromEntries(ctlsOf(k).map(c => [c.key, ctlValue(k, c)]));
  const v = { v: COLLAB_V, tab: X.tab, scene: X.scene, ctl, p: X.pp, place: X.pc, cx: X.cx, copies: X.ties, lim: Object.assign({}, X.lim) };
  if (X.net) v.net = X.net;
  return v;
}
// the station shows shared network id: fetched (unless doc is given), built between frames, then shown with state v (the
// room's, or this page's) applied; the picture on show stays until then. A device that cannot have it says why in words
// and shows the built-in network, keeping v as the room's
function netLoad(id, v, doc) {
  const g = ++SNET.gen;
  X.net = id; SNET.pend = v; SNET.err = ''; SNET.listAt = -1e9;
  if (SNET.model && SNET.id === id) { netShow(); return; }
  SNET.id = id; SNET.model = null; SNET.name = '';
  SNET.busy = 'Fetching the shared network from the relay…'; renderAll();
  (async () => {
    let d = doc;
    if (!d) { if (!(await netRelay(true))) throw new Error(NET_GET[SNET.relay.why] || NET_GET.none); d = await netCall('/api/nets/' + id, { big: SNET.relay.max }); }
    if (g !== SNET.gen || LOAD.gone) return;
    const bad = PNET.docError(d);
    if (bad) throw new Error('what the relay gave is not a network (' + bad + ')');
    let LK = null;
    if (PNET.docNeedsLookup(d)) {
      SNET.busy = 'Fetching the lookup (its proteins outside the map)…'; renderAll();
      LK = await ownLookup();
      if (!LK) throw new Error('it names proteins outside the map, and the lookup (data/lookup.json) could not be fetched');
    }
    if (g !== SNET.gen || LOAD.gone) return;
    // built 4 ms at a time between frames (a headset keeps its frame rate; PNET.fromDoc yields when its slice is spent)
    const gen = PNET.fromDoc(d, LK);
    const R = await new Promise((done, fail) => {
      const tick = () => {
        if (g !== SNET.gen || LOAD.gone) return done(null);
        const was = PNET.T.until;
        PNET.T.until = performance.now() + 4;
        try { const r = gen.next(); if (r.done) return done(r.value); SNET.busy = `Building it (${Math.round(100 * (r.value || 0))} %)…`; } catch (e) { return fail(e); } finally { PNET.T.until = was; }
        setTimeout(tick, 0);
      };
      tick();
    });
    if (!R || g !== SNET.gen || LOAD.gone) return;
    if (!R.model) throw new Error('none of its proteins could be found');
    SNET.model = R.model; SNET.name = d.name; SNET.report = R.report;
    netShow();
  })().catch(e => {
    if (g !== SNET.gen || LOAD.gone) return;
    SNET.busy = ''; SNET.err = String(e && e.message || e);
    // (the built-in network on show; the room's state kept in SNET.pend for when it can be had, or another comes)
    if (X.own === 2) { X.own = 0; X.pp = X.pc = X.cx = -1; X.lim = Object.assign({}, LIM0); kindOptions(); SRCH.byDeg = null; }
    renderAll();
  });
}
// the shared network built: shown, and the state kept meanwhile applied to it
function netShow() {
  SNET.busy = ''; SNET.err = '';
  api('cell').own(SNET.model);
  X.own = 2; X.pp = X.pc = X.cx = -1; X.lim = Object.assign({}, LIM0); X.ctl.cell.kind = '-1';
  kindOptions(); SRCH.byDeg = null;
  const v = SNET.pend;
  SNET.pend = null;
  if (v) collabApply(v);
  pushState(); renderAll();
}
// back to the built-in network (any device with the right to change the station: it is the station's state)
function netBack(ui) {
  SNET.gen++; SNET.pend = null; SNET.busy = ''; SNET.err = '';
  X.net = '';
  if (X.own === 2) { X.own = 0; X.pp = X.pc = X.cx = -1; X.lim = Object.assign({}, LIM0); kindOptions(); SRCH.byDeg = null; }
  if (ui) sfxAct('clink', 'cell', 'centre');
  pushState(); renderAll();
}
// a network on the relay opened here (the list, the address's &net=): the station's, with the limits and picks afresh
function netOpen(id, ui) {
  if (!NET_ID.test(id)) return;
  // (from your own network: it is left, the station's state taken over by this one)
  if (X.bi) { X.bi = null; X.own = 0; X.pp = X.pc = X.cx = -1; X.lim = Object.assign({}, LIM0); kindOptions(); SRCH.byDeg = null; }
  if (ui) sfxAct('clink', 'cell', 'centre');
  netLoad(id, Object.assign(stateNow(), { net: id, p: -1, place: -1, cx: -1, lim: Object.assign({}, LIM0) }));
  pushState();
}
// your network put on the relay (in a room: shown at the station for everyone there; outside one: a link to it). Only on
// this press: the pairs, scores and kinds as read, nothing else
async function netShare() {
  if (!OWNN.model || X.own !== 1 || SNET.put) return;
  SNET.put = 'Putting it on the relay…'; SNET.putErr = ''; SNET.retry = null; SNET.ask = ''; renderAll();
  try {
    if (!(await netRelay(true))) throw new Error(NET_SAY[SNET.relay.why] || NET_SAY.none);
    const doc = PNET.toDoc(OWNN.model, OWNN.name), body = JSON.stringify(doc);
    if (body.length > SNET.relay.max) throw new Error(`it is ${(body.length / 1e6).toFixed(1)} MB as shared, and this relay takes at most ${(SNET.relay.max / (1 << 20)).toFixed(0)} MB`);
    const j = await netCall('/api/nets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (!j || !NET_ID.test(j.id)) throw new Error('the relay gave no id');
    if (LOAD.gone) return;
    if (!j.again) netMine(SNET.relay.base, j.id, true);   // (the same network put by someone else stays theirs to remove)
    SNET.link = location.href.split('#')[0] + `#${KEY}&explore&tab=net&net=${j.id}`;
    // (the station now shows it, built again from what the relay keeps, with the limits, picks and switches as they are here)
    const v = Object.assign(stateNow(), { net: j.id });
    X.bi = null;
    netLoad(j.id, v, doc);
    SNET.listAt = -1e9;
    sfxAct('clink', 'cell', 'centre');
  } catch (e) { SNET.putErr = 'Not shared: ' + String(e && e.message || e) + '.'; SNET.retry = () => netShare(); }
  SNET.put = ''; pushState(); renderAll();
}
// the shared network on show removed from the relay (and the station back to the built-in network): offered only on the
// device that put it there, and asked once first (sure: the second press), since it goes for everyone who uses it
async function netRemove(sure) {
  const id = X.net;
  if (!id || SNET.put) return;
  if (!sure) { SNET.ask = id; SNET.putErr = ''; renderAll(); return; }
  SNET.ask = ''; SNET.retry = null;
  SNET.put = 'Removing it from the relay…'; SNET.putErr = ''; renderAll();
  try {
    await netCall(`/api/nets/${id}/delete`, { method: 'POST' });
    netMine(SNET.relay.base, id, false);
    if (!LOAD.gone && X.net === id) { SNET.link = ''; netBack(true); }
  } catch (e) {
    if (e && e.status === 404) netMine(SNET.relay.base, id, false);
    SNET.putErr = 'Not removed: ' + String(e && e.message || e) + '.'; if (!(e && e.status === 404)) SNET.retry = () => netRemove(true);
  }
  SNET.put = ''; SNET.listAt = -1e9; renderAll();
}
// the shared part's words: what is on show or on its way, what went wrong, and what sharing would do (both panes)
function shareLines() {
  const out = [], R = SNET.relay;
  if (X.net && SNET.busy) out.push(SNET.busy + ' The cell changes when it is ready.');
  if (X.net && SNET.err) out.push(`${inRoom() ? 'This room shows' : 'This address names'} a shared network this device could not have (${SNET.err}): you see the built-in network${inRoom() ? ', and what you change here is not shared' : ''}.`);
  if (X.own === 2) out.push(`Shared on ${relayHost()}${SNET.model ? `: ${fmt(SNET.model.P.N)} proteins, ${fmt(SNET.model.P.E)} links` : ''}. ${inRoom() ? 'Everyone at this station sees it; anyone who can open this relay\'s rooms can read it' : 'Anyone who can open this relay\'s rooms, or has the link, can read it'} until it is removed.`);
  if (SNET.put) out.push(SNET.put);
  if (SNET.putErr) out.push(SNET.putErr);
  if (SNET.ask && SNET.ask === X.net && !SNET.put) out.push(`Remove ${SNET.name || 'this network'} from ${relayHost()}? It goes for everyone who uses it: this station and any other room or link that shows it, including rooms that shared the same list. It cannot be undone here.`);
  if (X.net && !SNET.relay.nets && SNET.relay.why === 'away' && !SNET.err) out.push(NET_SAY.away);
  if (X.own === 1 && OWNN.model) {
    if (R.nets) out.push(inRoom() ? `Share with this room puts the pairs, scores and kinds of ${OWNN.name || 'your network'} (nothing else) on this room's relay, ${relayHost()}, and shows it at this station: everyone there sees it, and anyone who can open this relay's rooms can read it until it is removed.`
      : `Put on the relay puts the pairs, scores and kinds of ${OWNN.name || 'your network'} (nothing else) on ${relayHost()}: anyone who can open this relay's rooms, or who has the link, can read it until it is removed.`);
    if (R.nets) out.push(NET_SIZE);
    else if (R.why) out.push(NET_SAY[R.why] || NET_SAY.none);
  }
  return out;
}
// the buttons (both panes): [{ id, label, on, fn }] (the way back is the networks' own row)
function shareButtons() {
  const b = [];
  if (X.own === 1 && OWNN.model && SNET.relay.nets && !SNET.put) b.push({ id: 'net:share', label: inRoom() ? 'Share with this room' : 'Put on the relay', on: false, fn: () => netShare() });
  const mine = X.net && !SNET.put && SNET.relay.nets && netMine(SNET.relay.base, X.net);
  if (mine && SNET.ask === X.net) b.push({ id: 'net:remove:yes', label: 'Yes, remove it for everyone', on: false, fn: () => netRemove(true) }, { id: 'net:remove:no', label: 'Keep it', on: false, fn: () => { SNET.ask = ''; renderAll(); } });
  else if (mine) b.push({ id: 'net:remove', label: 'Remove from the relay', on: false, fn: () => netRemove() });
  if (X.net && SNET.err) b.push({ id: 'net:retry', label: 'Try again', on: false, fn: () => netLoad(X.net, SNET.pend) });
  else if (SNET.putErr && SNET.retry && !SNET.put) b.push({ id: 'net:again', label: 'Try again', on: false, fn: () => { const f = SNET.retry; SNET.retry = null; SNET.putErr = ''; f(); } });
  else if (!SNET.relay.nets && SNET.relay.why === 'away' && !SNET.relay.busy && (X.net || (X.own === 1 && OWNN.model))) b.push({ id: 'net:ping', label: 'Try again', on: false, fn: () => { netRelay(true); netList(true); } });
  return b;
}
// the relay's networks to open (both panes): newest first, by name and size; the one on show marked
function listButtons() {
  return (SNET.list || []).map(n => ({ id: 'net:open:' + n.id, label: `${String(n.name).slice(0, 40)} (${fmt(n.n)} proteins, ${fmt(n.e)} links)`, on: X.net === n.id, fn: () => (X.net === n.id ? null : netOpen(n.id, true)) }));
}

// ------------------------------------------------------------- the panes --
// the label of the way back from a network not the built-in one
const backLabel = () => (X.own === 1 && X.bi && X.bi.net ? 'Back to the room\'s shared network' : X.own ? 'Back to the built-in network' : 'The built-in network');
// the shared part of the page's tab (the twin of drawNetPane's): its words, its buttons, the relay's networks
const SHARE_FN = new Map();
function shareHtml() {
  SHARE_FN.clear();
  const btn = o => { SHARE_FN.set(o.id, o.fn); return chip(`data-act="netb" data-v="${esc(o.id)}"`, esc(o.label), o.on); };
  const lines = shareLines(), bs = shareButtons(), ls = listButtons();
  return `${lines.map(t => `<p class="sub"${/could not|^Not /.test(t) ? ' style="color:var(--amber)"' : ''}>${esc(t)}</p>`).join('')}
    ${bs.length ? `<div class="chips">${bs.map(btn).join('')}</div>` : ''}
    ${SNET.link && X.own === 2 && !inRoom() ? `<p class="sub">The link: <a href="${esc(SNET.link)}">${esc(SNET.link)}</a></p>` : ''}
    ${ls.length ? `<p class="grp-h">Networks on ${esc(relayHost())}</p><div class="chips">${ls.map(btn).join('')}</div>` : ''}`;
}
function renderNet() {
  const pane = $('#pane-net');
  if (!pane) return;
  ownKeptName();
  if (X.tab === 'net') { netRelay(); netList(); }
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
    <div class="chips">${chip('data-act="limreset" data-v="1"', 'Reset limits', false)}</div>
    <div id="netShare">${shareHtml()}</div>`;
  const r = OWNN.report, lines = reportLines();
  $('#ownBody').innerHTML = `${OWNN.busy ? `<p class="sub" style="color:var(--amber)">${esc(OWNN.busy)}</p>` : ''}${OWNN.err ? `<p class="sub" style="color:var(--amber)">${esc(OWNN.err)}</p>` : ''}
    ${lines.map(t => `<p class="sub">${esc(t)}</p>`).join('')}
    ${r && r.missing.length ? `<p class="sub">Not found: ${esc(r.missing.slice(0, 30).join(', '))}${r.missing.length > 30 ? ` and ${fmt(r.missing.length - 30)} more` : ''}.</p><div class="chips"><button type="button" data-act="ownmiss" data-v="1">Download the list (not-found.txt)</button></div>` : ''}
    <div class="chips">${OWNN.model ? chip('data-act="own" data-v="1"', `Your network${OWNN.name ? ': ' + esc(OWNN.name) : ''}`, X.own === 1) : ''}${chip('data-act="own" data-v="0"', backLabel(), X.own === 0)}</div>
    <div class="chips">${OWNN.model && OWNN.kept !== OWNN.name ? '<button type="button" data-act="ownkeep" data-v="1">Keep on this device</button>' : ''}${OWNN.kept ? `${OWNN.kept !== OWNN.name || !OWNN.model ? `<button type="button" data-act="ownkept" data-v="1">Open the kept one: ${esc(OWNN.kept)}</button>` : ''}<button type="button" data-act="ownforget" data-v="1">Forget it</button>` : ''}</div>
    ${OWNN.kept ? `<p class="sub">Kept in this browser: ${esc(OWNN.kept)}.</p>` : ''}
    ${X.own && inRoom() ? `<p class="sub">${esc(OWN_ROOM)}</p>` : ''}`;
}
// the Network tab's buttons (buildExplore's click handler: data-act)
function netAct(b) {
  const v = b.dataset.v;
  ({
    lim: () => setLim(b.dataset.k, +v, true), rel: () => toggleRel(+v), pls: () => togglePlace(+v), limreset: () => resetLim(true),
    own: () => (+v === 0 && (X.own === 2 || X.net) && !X.bi ? netBack(true) : setOwn(+v, true)), netb: () => { const f = SHARE_FN.get(v); if (f) f(); }, ownpaste: () => { const t = $('#ownText').value; if (t.trim()) chooseText(t, 'pasted text'); },
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
  if (X.tab === 'net') { netRelay(); netList(); }
  if (y + 40 < bottom) y += textBlock(ctx, 'Choose a network of your own on a laptop: a headset cannot sensibly pick a file. Or open one put on the relay:', x, y, W, 21, 29, VC.muted, 400, 2) + 8;
  const own = v => () => (v === 0 && (X.own === 2 || X.net) && !X.bi ? netBack(true) : setOwn(v, true));
  const nets = [{ id: 'own:0', label: backLabel(), on: X.own === 0 && !X.net, fn: own(0) }];
  if (OWNN.model) nets.push({ id: 'own:1', label: `Your network${OWNN.name ? ': ' + OWNN.name : ''}`, on: X.own === 1, fn: own(1) });
  else if (OWNN.kept) nets.push({ id: 'own:kept', label: `Kept here: ${OWNN.kept}`, on: false, fn: () => ownLoadKept() });
  const more = listButtons().filter(b => !nets.some(n => n.id === b.id));
  if (y + 46 < bottom) y += flow(ctx, P, nets.concat(more), x, y, W, bottom, { px: 20, h: 44 }) + 8;
  for (const t of shareLines()) if (y + 34 < bottom) y += textBlock(ctx, t, x, y, W, 20, 28, /could not|^Not /.test(t) ? VC.amber || VC.ink : VC.muted, 400, 3) + 6;
  const bs = shareButtons();
  if (bs.length && y + 46 < bottom) y += flow(ctx, P, bs, x, y, W, bottom, { px: 20, h: 44 }) + 8;
  if (X.own === 1 && inRoom() && y + 34 < bottom) textBlock(ctx, OWN_ROOM, x, y, W, 20, 28, VC.muted, 400, 2);
}
