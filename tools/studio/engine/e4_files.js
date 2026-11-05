
// ================================================================ SOURCES ==
// Where scenes come from. A relay started with --scenes <folder> (the owner's way): it lists the scenes, serves their
// files, saves layouts and tells the page when a file changes (/api/scenes/watch). Else a plain folder that
// tools/studio/scan.mjs described (index.json, and files.json in each scene), read only: &scenes=<folder> in the link, or
// a folder named scenes next to the app. With the relay's password every call carries it: JSON and sounds as a header,
// the loaders' files as ?token= (their only way); a refused one goes to the shell (HOST.collab.relaySaw), which asks for
// the password where it always does (the Shared dialog, the menu's Circles tab).
const HP0 = new URLSearchParams(location.hash.slice(1));
// a link's folder of scenes: a relative path only (no //, no .., no scheme), else none
const okFolder = s => { s = String(s || '').trim().replace(/\/+$/, ''); return s && s.length < 200 && !/^\//.test(s) && !/\/\//.test(s) && !/(^|\/)\.\.(\/|$)/.test(s) && !/[:\\?#%]/.test(s) ? s : ''; };
const OPT = {
  visit: HP0.has('visit'), edit: HP0.has('edit'), scene: HP0.get('scene') || '', scenes: okFolder(HP0.get('scenes')),
  maxtex: clamp(Math.round(+HP0.get('maxtex') || 4096), 512, 8192),
};
const okScene = s => typeof s === 'string' && /^[A-Za-z0-9_][A-Za-z0-9 _.-]{0,63}$/.test(s);
const okFile = s => typeof s === 'string' && s.length > 0 && s.length <= 200 && !/(^|\/)\.\.(\/|$)/.test(s) && !/^\//.test(s) && !/[\\\0]/.test(s);
const extOf = p => (/\.([^./\\]+)$/.exec(String(p)) || ['', ''])[1].toLowerCase();
const baseName = p => String(p).split(/[\\/]/).pop();
const stem = p => baseName(p).replace(/\.[^.]*$/, '');
const KINDS_EXT = { model: ['glb', 'gltf', 'fbx', 'obj', 'ply', 'stl'], audio: ['mp3', 'ogg', 'oga', 'wav', 'm4a', 'aac', 'flac', 'opus', 'webm'], image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'tga', 'bmp', 'tif', 'tiff', 'psd', 'psb', 'dds', 'avif'], data: ['bin'] };
const kindOf = p => { const e = extOf(p); for (const k in KINDS_EXT) if (KINDS_EXT[k].includes(e)) return k; return 'other'; };
// timers that die with the studio (dispose clears them: a late one must not write into the next story's panes)
const TIMERS = new Set();
const later = (fn, ms) => { const t = setTimeout(() => { TIMERS.delete(t); if (!GL.gone) fn(); }, ms); TIMERS.add(t); return t; };
const unlater = t => { if (t) { clearTimeout(t); TIMERS.delete(t); } };
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } } };

const SRC = { kind: '', base: '', token: '', folder: '', dflt: false, state: 'looking', note: '', scenes: [], save: false, upload: false, ffmpeg: false, maxUpload: 0, es: null, gen: 0, retry: 0, noScenes: false, held: false, seen: null };
// kind: 'relay' or 'folder'; state: 'looking', 'ok', 'auth' (the relay wants its password), 'none' (no relay and no
// folder of scenes), 'error'. held: the relay refused the password this page has (or none): nothing more is asked of it
// until the shell holds another one (every wrong one counts on the relay: 20 in a minute shut this address out)
const srcKey = () => (SRC.kind === 'relay' ? SRC.base : SRC.kind === 'folder' ? 'folder:' + SRC.folder : '');
const encPath = p => String(p).split('/').map(encodeURIComponent).join('/');
const sceneUrl = name => (SRC.kind === 'relay' ? `${SRC.base}/scenes/${encodeURIComponent(name)}/` : `${SRC.folder}/${encodeURIComponent(name)}/`);
// a file of the open scene: its address with its version (its time: a changed file is a new address, so no cache
// keeps the old one), and for the loaders the relay's password
function fileUrl(p, loader) {
  const f = STU.fileMap.get(p), q = [];
  if (loader && SRC.kind === 'relay' && SRC.token) q.push('token=' + encodeURIComponent(SRC.token));
  if (f && f.at) q.push('v=' + f.at);
  return sceneUrl(STU.scene) + encPath(p) + (q.length ? '?' + q.join('&') : '');
}
const AUTH_NOTE = 'This relay needs its password: enter it under Shared (or in the menu\'s Circles tab).';
// tell the shell what the relay answered (a 401 brings up its password prompts; an answer with the password accepted
// keeps it): the password the call carried ('' none) and its JSON, when it had any
const saw = (status, sent, j) => { try { if (SRC.kind === 'relay' && HOST.collab && HOST.collab.relaySaw) HOST.collab.relaySaw(SRC.base, status, sent || '', j || null); } catch (e) { /* an older shell */ } };
// a call: the relay's password as a header (never in the address), the error's status kept. Once the relay has refused
// the password (or its lack), no call goes to it until the shell holds another (authHold, authStep): the first 401 goes
// to the shell, which asks for it where it always does
const AUTH_ERR = () => Object.assign(new Error(AUTH_NOTE), { status: 401 });
async function call(url, o = {}) {
  const relay = SRC.kind === 'relay' && url.startsWith(SRC.base), headers = Object.assign({}, o.headers || {});
  if (relay && SRC.held) throw AUTH_ERR();
  if (relay && SRC.token) headers.Authorization = 'Bearer ' + SRC.token;
  let r;
  try { r = await fetch(url, { method: o.method || 'GET', headers, body: o.body, cache: o.cache || 'no-store' }); } catch (e) { throw Object.assign(new Error('could not be reached'), { status: 0 }); }
  if (!r.ok) {
    let j = null;
    try { j = await r.json(); } catch (e) { /* not JSON */ }
    if (relay && r.status === 401) { if (!SRC.held) { saw(401, SRC.token, j); authHold(); } throw AUTH_ERR(); }
    if (relay) saw(r.status, SRC.token, j);
    throw Object.assign(new Error((j && j.error) || 'HTTP ' + r.status), { status: r.status });
  }
  if (relay) saw(r.status, SRC.token);
  return r;
}
// the relay refused this page's password: held (every call refused here, the panes say so) until the shell holds
// another one for it, looked at every 2 s (the same one twice in a row: one the shell is still checking is not taken,
// so a wrong one typed is not sent twice); then the scenes are listed again and what the refusal stopped is fetched again
function authHold() {
  if (SRC.held) return;
  SRC.held = true; SRC.state = 'auth'; SRC.note = AUTH_NOTE; SRC.seen = null;
  if (STU.scene && STU.listing !== 'ok') { STU.listing = 'auth'; STU.note = AUTH_NOTE; }
  unlater(SRC.retry); SRC.retry = later(authStep, 2000);
  dirty(true);
}
async function authStep() {
  SRC.retry = 0;
  if (!SRC.held || GL.gone) return;
  let r = null;
  try { r = HOST.collab && HOST.collab.relayFind ? await HOST.collab.relayFind() : null; } catch (e) { r = null; }
  if (!SRC.held || GL.gone) return;
  const t = r && r.base ? r.token || '' : null;
  if (t !== null && t !== SRC.token && t === SRC.seen) { SRC.held = false; findSource(); return; }
  SRC.seen = t;
  SRC.retry = later(authStep, 2000);
}
// once the relay takes the password: the models and sounds a refusal stopped are fetched again
function authAgain() {
  for (const E of LIB.values()) if (E.auth && E.users.size) { E.auth = false; libLoad(E); }
  for (const F of SND.values()) if (F.auth) { F.auth = false; sndFetch(F); }
}
const getJSON = async (url, o) => (await call(url, o)).json();
// the bytes of a file, with its progress (n bytes so far)
async function getBytes(url, onN) {
  const r = await call(url, { cache: 'no-cache' });
  if (!r.body || !r.body.getReader) return r.arrayBuffer();
  const rd = r.body.getReader(), parts = [];
  let n = 0;
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    parts.push(value); n += value.length;
    if (onN) onN(n);
    if (GL.gone) { try { rd.cancel(); } catch (e) { /* gone */ } throw new Error('gone'); }
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out.buffer;
}

// the page's own server, when it is a relay that serves scenes (a shell without HOST.collab.relayFind)
async function ownRelay() {
  if (!/^https?:$/.test(location.protocol)) return null;
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null, t = later(() => ac && ac.abort(), 3000);
  try {
    const r = await fetch(location.origin + '/api/ping', { cache: 'no-store', signal: ac ? ac.signal : undefined });
    const j = r.ok ? await r.json() : null;
    return j && j.scenes ? { base: location.origin, token: '' } : null;
  } catch (e) { return null; } finally { unlater(t); }
}
// find where scenes come from, then list them (and again: a password given meanwhile, Look again)
async function findSource() {
  const gen = ++SRC.gen;
  unlater(SRC.retry); SRC.retry = 0;
  SRC.state = 'looking'; SRC.note = ''; SRC.noScenes = false; SRC.held = false;
  dirty();
  let r = null;
  if (!OPT.scenes) {
    try { r = HOST.collab && HOST.collab.relayFind ? await HOST.collab.relayFind() : await ownRelay(); } catch (e) { r = null; }
  }
  if (gen !== SRC.gen || GL.gone) return;
  const was = srcKey();
  if (r && r.base) Object.assign(SRC, { kind: 'relay', base: String(r.base).replace(/\/+$/, ''), token: r.token || '', folder: '', dflt: false });
  else Object.assign(SRC, { kind: 'folder', base: '', token: '', folder: OPT.scenes || 'scenes', dflt: !OPT.scenes });
  if (srcKey() !== was) watchStop();
  await listScenes(gen);
}
async function listScenes(gen) {
  try {
    const j = await getJSON(SRC.kind === 'relay' ? SRC.base + '/api/scenes' : SRC.folder + '/index.json');
    if (gen !== SRC.gen || GL.gone) return;
    SRC.scenes = (j && Array.isArray(j.scenes) ? j.scenes : []).filter(s => s && okScene(s.name))
      .map(s => ({ name: s.name, files: +s.files || 0, bytes: +s.bytes || 0, at: +s.at || 0, layout: !!s.layout }));
    SRC.save = SRC.kind === 'relay' && !!(j && j.save);
    // (uploads: this caller may upload, the relay has ffmpeg for long sounds, one file's limit in bytes)
    SRC.upload = SRC.kind === 'relay' && !!(j && j.upload); SRC.ffmpeg = SRC.upload && !!(j && j.ffmpeg); SRC.maxUpload = +(j && j.maxUpload) || 0;
    SRC.state = 'ok'; SRC.note = '';
    if (SRC.kind === 'relay') watchStart();
  } catch (e) {
    if (gen !== SRC.gen || GL.gone) return;
    SRC.scenes = [];
    // a relay that serves no scenes: a folder next to the app may still have some
    if (SRC.kind === 'relay' && e.status === 404) { SRC.noScenes = true; Object.assign(SRC, { kind: 'folder', base: '', token: '', folder: 'scenes', dflt: true }); return listScenes(gen); }
    // (a relay that wants its password: held until the shell has another one, authHold)
    SRC.state = e.status === 401 ? 'auth' : SRC.kind === 'folder' && SRC.dflt && (e.status === 404 || e.status === 0) ? 'none' : 'error';
    SRC.note = SRC.state === 'auth' ? AUTH_NOTE : e.message;
  }
  if (SRC.state === 'ok') authAgain();
  if (STU.scene && STU.listing !== 'ok' && SRC.state === 'ok') loadScene();
  chooseScene();
  dirty();
}
// the scene opened by itself: at a shared room's station only when the listing has exactly one (else Pick a scene: the
// station's scene is for everyone there); outside a room the link's, else the last used here, else the only one
const lastKey = () => 'studioLast.' + srcKey();
function chooseScene() {
  if (STU.scene || SRC.state !== 'ok') return;
  const names = SRC.scenes.map(s => s.name), last = store.get(lastKey());
  let pick = '';
  if (atStation()) { if (names.length === 1) pick = names[0]; }
  else pick = (names.includes(OPT.scene) ? OPT.scene : '') || (names.includes(last) ? last : '') || (names.length === 1 ? names[0] : '');
  if (pick) openScene(pick, 'auto');
}
// at a shared room's station of the studio (a headset at its circle, a page following it): the scene and what is
// placed are the station's, for everyone there
function atStation() {
  try { const st = HOST.collab && HOST.collab.live && HOST.collab.live(); return !!(st && st.story === XR_HERE); } catch (e) { return false; }
}

// ------------------------------------------------------------- the scene --
// Open a scene: what was placed goes, its listing and saved layout are read. how: 'pick' (by hand) or 'auto' (by
// itself) write the saved layout as the items; 'room' (the station's scene, from the room) does not: the room's state
// carries the items, and only the device that changed the scene writes them
function openScene(name, how) {
  name = okScene(name) ? name : '';
  if (name === STU.scene && how !== 'again') return;
  draftNow();
  clearItems();
  libClear();
  Object.assign(STU, { scene: name, listing: name ? 'loading' : 'none', files: [], fileMap: new Map(), saved: '', savedAt: 0, savedBy: '', layoutAt: 0,
    bad: 0, note: '', saveNote: '', saving: false, draft: null, sel: '', hover: '', pick: null, write: how !== 'room', t0: performance.now(), loadAsk: 0, upNote: '' });
  STU.seen.clear(); UNDO.length = 0;
  if (name && how !== 'room' && !atStation()) store.set(lastKey(), name);
  if (name) loadScene();
  dirty(true);
}
async function loadScene() {
  const gen = ++STU.gen, name = STU.scene;
  if (!name) return;
  if (SRC.state !== 'ok') { STU.listing = 'waiting'; return; }   // (listScenes loads it once the source answers)
  STU.listing = 'loading';
  try {
    let j, layout = null;
    if (SRC.kind === 'relay') { j = await getJSON(`${SRC.base}/api/scenes/${encodeURIComponent(name)}`); layout = j.layout || null; if (j.save !== undefined) SRC.save = !!j.save; }
    else {
      j = await getJSON(`${SRC.folder}/${encodeURIComponent(name)}/files.json`);
      // (scan.mjs gives the layout's time apart from the files, as the relay does; an older listing names it a file)
      if (+(j && j.layoutAt) > 0 || (Array.isArray(j && j.files) && j.files.some(f => f && f.path === 'layout.json'))) { try { layout = await getJSON(`${SRC.folder}/${encodeURIComponent(name)}/layout.json`); } catch (e) { layout = null; } }
    }
    if (gen !== STU.gen || GL.gone) return;
    setFiles(j && j.files);
    STU.layoutAt = +(j && j.layoutAt) || 0;
    STU.listing = 'ok';
    const L = readLayout(layout);
    STU.saved = keyOf(L.items); STU.savedAt = L.at || STU.layoutAt; STU.savedBy = L.by; STU.bad = L.bad;
    if (STU.write) { STU.write = false; for (const x of L.items) putItem(x.id, x.kind, x.rec); }
    if (!atStation()) offerDraft();
    for (const it of STU.items.values()) itemFile(it);   // (items the room placed before the listing came)
  } catch (e) {
    if (gen !== STU.gen || GL.gone) return;
    STU.listing = e.status === 404 ? 'missing' : e.status === 401 ? 'auth' : 'error';
    STU.note = e.status === 404 ? `This device cannot find the scene ${name}: its items keep their places as grey boxes.` : e.status === 401 ? AUTH_NOTE : 'The scene could not be read: ' + e.message;
  }
  dirty(true);
}
// the scene's listing: [{ path, bytes, at, kind }], at most 2,000, only paths a layout may name
function setFiles(list) {
  const out = [];
  for (const f of Array.isArray(list) ? list : []) {
    if (!f || !okFile(f.path) || out.length >= 2000) continue;
    // (an OBJ, PLY or STL is a model here, though the relay lists only GLB, glTF and FBX as models)
    out.push({ path: f.path, bytes: +f.bytes || 0, at: +f.at || 0, kind: kindOf(f.path) === 'model' ? 'model' : ['model', 'audio', 'image', 'data', 'other'].includes(f.kind) ? f.kind : kindOf(f.path) });
  }
  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  STU.files = out; STU.fileMap = new Map(out.map(f => [f.path, f]));
}
// the listing again (a file added, changed or gone: the watch), then what uses a changed file loaded again
async function refreshFiles(changed) {
  const gen = STU.gen, name = STU.scene;
  if (!name || SRC.state !== 'ok') return;
  try {
    const j = SRC.kind === 'relay' ? await getJSON(`${SRC.base}/api/scenes/${encodeURIComponent(name)}`) : await getJSON(`${SRC.folder}/${encodeURIComponent(name)}/files.json`);
    if (gen !== STU.gen || GL.gone) return;
    const old = STU.fileMap;
    setFiles(j && j.files);
    if (STU.listing !== 'ok') { STU.listing = 'ok'; STU.note = ''; }
    for (const f of STU.files) { const o = old.get(f.path); if (!o || o.at !== f.at || o.bytes !== f.bytes) changed.add(f.path); }
    for (const p of old.keys()) if (!STU.fileMap.has(p)) changed.add(p);
    for (const p of changed) fileChanged(p);
    for (const it of STU.items.values()) itemFile(it);
  } catch (e) { /* the next event tries again */ }
  dirty();
}

// ------------------------------------------------------------- the layout --
// layout.json (also what Download gives and Upload takes): { studio: 1, scene, saved, objects, cubes, sounds, cuts, groups },
// each item with its id and its record. Read: every item checked (bad ones dropped and counted, the limits kept), a cube's
// lists naming only this scene's items, and a group's members only this layout's objects, sounds and cubes (one left with
// fewer than 2 dropped and counted). A sound's on, bone and o (optional fields, so still studio: 1) are kept even when
// the layout lacks its object, as a state from the room keeps them: it stands at its p until that object is back, and a
// save never loses what it followed; so is a cut-out's on (it cuts nothing until its object is back). A layout without
// cuts (v112's) or without groups (v113's) reads as before
const LIMITS = { o: 300, c: 100, s: 60, x: 100, g: 50 };
function readLayout(j) {
  const out = { items: [], bad: 0, at: 0, by: '' };
  if (!j || typeof j !== 'object') return out;
  if (j.studio !== 1) { out.bad = 1; return out; }
  out.at = Date.parse(j.saved) || 0;
  out.by = typeof j.by === 'string' ? j.by.slice(0, 40) : '';
  const ids = new Set();
  for (const [kind, list] of [['o', j.objects], ['c', j.cubes], ['s', j.sounds], ['x', j.cuts], ['g', j.groups]]) {
    if (list === undefined) continue;
    if (!Array.isArray(list)) { out.bad++; continue; }
    let n = 0;
    for (const x of list) {
      const id = x && okId(x.id) && !ids.has(x.id) ? x.id : '', rec = id && n < LIMITS[kind] ? norm(kind, x) : null;
      if (!rec) { out.bad++; continue; }
      ids.add(id); n++;
      out.items.push({ id, kind, rec });
    }
  }
  for (const x of out.items) if (x.kind === 'c') { x.rec.show = x.rec.show.filter(i => ids.has(i)); x.rec.hide = x.rec.hide.filter(i => ids.has(i)); }
  const kinds = new Map(out.items.map(x => [x.id, x.kind]));
  out.items = out.items.filter(x => {
    if (x.kind !== 'g') return true;
    x.rec.items = x.rec.items.filter(i => GROUP_KINDS.includes(kinds.get(i)));
    if (x.rec.items.length >= 2) return true;
    out.bad++;
    return false;
  });
  return out;
}
// what is placed now as a layout keeps it: a group naming fewer than 2 of these objects, sounds and cubes (one picking
// its members, a group made just now) left out, as readLayout would drop it (so a saved layout reads back as it was saved)
function placedItems() {
  const all = [...STU.items.values()], kinds = new Map(all.map(it => [it.id, it.kind]));
  return all.filter(it => it.kind !== 'g' || it.rec.items.filter(i => GROUP_KINDS.includes(kinds.get(i))).length >= 2);
}
// what is placed now, as layout.json
function layoutOut() {
  const L = { studio: 1, scene: STU.scene, saved: new Date().toISOString() };
  const by = HOST.collab && HOST.collab.joined && HOST.collab.name;
  if (by) L.by = String(by).slice(0, 40);
  const P = placedItems(), list = k => P.filter(it => it.kind === k).map(it => Object.assign({ id: it.id }, it.rec));
  L.objects = list('o'); L.cubes = list('c'); L.sounds = list('s'); L.cuts = list('x'); L.groups = list('g');
  return L;
}
// a list of items (or what is placed) as one string, to tell whether two are the same
function keyOf(items) {
  const L = (items || placedItems()).map(x => [x.id, x.kind, x.rec]);
  L.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return JSON.stringify(L);
}
const unsaved = () => STU.listing === 'ok' && keyOf() !== STU.saved;
// the items of a layout in place of what is placed (Load saved, Upload, Restore), as one change Undo takes back
function putLayout(items) {
  change(() => {
    const keep = new Set(items.map(x => x.id));
    for (const id of [...STU.items.keys()]) if (!keep.has(id)) removeItem(id);
    for (const x of items) putItem(x.id, x.kind, x.rec);
  });
}

// ------------------------------------------------------------------ saving --
// The relay writes layout.json (the old one kept in .history/); what is placed now, for everyone at a station
const canSave = () => SRC.kind === 'relay' && SRC.save && STU.listing === 'ok' && !!STU.scene && !OPT.visit;
async function saveLayout() {
  if (!canSave() || STU.saving) return;
  const body = JSON.stringify(layoutOut()), key = keyOf(), name = STU.scene, gen = STU.gen;
  STU.saving = true; STU.saveNote = ''; dirty(true);
  try {
    const j = await getJSON(`${SRC.base}/api/scenes/${encodeURIComponent(name)}/layout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (gen !== STU.gen) return;
    STU.saved = key; STU.savedAt = +(j && j.at) || Date.now(); STU.savedBy = ''; STU.mine = STU.savedAt;
    draftDrop();
    sfxAct('ping', 'stage', 'centre', { gain: 0.6 });
  } catch (e) {
    if (gen !== STU.gen) return;
    STU.saveNote = e.status === 403 ? 'This relay does not save layouts (it runs with --scenes-readonly).' : e.status === 401 ? AUTH_NOTE
      : e.status === 413 ? 'Not saved: the layout is too big (2 MB at most).' : 'Not saved: ' + e.message;
  } finally { if (gen === STU.gen) STU.saving = false; dirty(true); }
}
// Load saved (two presses): the saved layout in place of what is placed
async function loadSaved() {
  const now = performance.now();
  if (now - STU.loadAsk > 4000) { STU.loadAsk = now; dirty(true); later(() => dirty(true), 4100); return; }
  STU.loadAsk = 0;
  const gen = STU.gen, name = STU.scene;
  try {
    const layout = SRC.kind === 'relay' ? (await getJSON(`${SRC.base}/api/scenes/${encodeURIComponent(name)}`)).layout : await getJSON(`${SRC.folder}/${encodeURIComponent(name)}/layout.json`);
    if (gen !== STU.gen) return;
    const L = readLayout(layout);
    putLayout(L.items);
    STU.saved = keyOf(L.items); STU.savedAt = L.at || STU.savedAt; STU.savedBy = L.by; STU.bad = L.bad;
  } catch (e) { STU.saveNote = e.status === 404 ? 'This scene has no saved layout yet.' : 'The saved layout could not be read: ' + e.message; }
  dirty(true);
}
// Download layout.json (page only): what is placed now, as a file (also kept for the tests: STUDIO.download)
function downloadLayout() {
  const text = JSON.stringify(layoutOut(), null, 2), url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  STUDIO.download = text;
  const a = document.createElement('a');
  a.href = url; a.download = 'layout.json';
  document.body.appendChild(a); a.click(); a.remove();
  later(() => URL.revokeObjectURL(url), 4000);
}
// Upload: a layout.json from this computer in place of what is placed (Save then writes it on the relay)
function uploadLayout(text) {
  let j = null;
  try { j = JSON.parse(text); } catch (e) { j = null; }
  if (!j || j.studio !== 1) { STU.upNote = 'That file is not a studio layout (layout.json with "studio": 1).'; dirty(true); return; }
  const L = readLayout(j);
  putLayout(L.items);
  STU.upNote = `Read ${L.items.length} item${L.items.length === 1 ? '' : 's'}` + (L.bad ? `; ${L.bad} could not be read.` : '.') + (j.scene && j.scene !== STU.scene ? ` (It was saved for the scene ${String(j.scene).slice(0, 64)}.)` : '');
  dirty(true);
}

// ------------------------------------------------------------------ drafts --
// Outside a room what is placed is kept on this device too, a second after each change; opening the scene again with a
// draft newer than the saved layout and different from it offers it back
const draftKey = () => 'studioDraft.' + srcKey() + '.' + STU.scene;
let draftT = 0;
function draftSoon() { if (!draftT) draftT = later(() => { draftT = 0; draftNow(); }, 1000); }
function draftNow() {
  unlater(draftT); draftT = 0;
  if (!STU.scene || STU.listing !== 'ok' || atStation() || OPT.visit) return;
  if (!unsaved()) { draftDrop(); return; }
  store.set(draftKey(), JSON.stringify({ at: Date.now(), items: placedItems().map(it => [it.id, it.kind, it.rec]) }));
}
function draftDrop() { if (STU.scene) store.set(draftKey(), null); }
function offerDraft() {
  let d = null;
  try { d = JSON.parse(store.get(draftKey()) || 'null'); } catch (e) { d = null; }
  if (!d || !Array.isArray(d.items) || !(d.at > STU.savedAt)) return;
  const items = d.items.filter(x => Array.isArray(x) && okId(x[0]) && LIMITS[x[1]]).map(x => ({ id: x[0], kind: x[1], rec: norm(x[1], x[2]) })).filter(x => x.rec);
  const k = keyOf(items);
  if (k === STU.saved || k === keyOf()) return;
  STU.draft = { at: d.at, items };
}
function draftRestore() { const d = STU.draft; STU.draft = null; if (d) putLayout(d.items); dirty(true); }
function draftDiscard() { STU.draft = null; draftDrop(); dirty(true); }

// ------------------------------------------------------------------- watch --
// The relay tells the page when a file of a scene is added, changed or removed, and when a layout is saved: the Add
// lists follow, a changed model or sound is fetched again and its items rebuilt in place, and another device's save
// moves what Unsaved changes compares with (it never replaces what is placed)
function watchStart() {
  if (SRC.es || SRC.kind !== 'relay' || SRC.held || typeof EventSource === 'undefined' || GL.gone) return;
  let es;
  try { es = new EventSource(`${SRC.base}/api/scenes/watch` + (SRC.token ? '?token=' + encodeURIComponent(SRC.token) : '')); } catch (e) { return; }
  SRC.es = es;
  const data = ev => { try { return JSON.parse(ev.data); } catch (e) { return null; } };
  es.addEventListener('scene', ev => { const d = data(ev); if (d) onFileEvent(d); });
  es.addEventListener('layout', ev => { const d = data(ev); if (d) onLayoutEvent(d); });
  es.addEventListener('scenes', ev => { const d = data(ev); if (d) onScenesEvent(d); });
  // closed (the relay gone, restarted, or refusing the password, which a stream cannot say): the scenes listed again
  // 10 s later, which starts it again, or holds on a refusal (authHold) rather than sending a wrong password every 10 s
  es.onerror = () => { if (es.readyState === 2 && SRC.es === es) { SRC.es = null; later(() => { if (!SRC.held && SRC.kind === 'relay') listScenes(SRC.gen); }, 10000); } };
}
function watchStop() { if (SRC.es) { try { SRC.es.close(); } catch (e) { /* closed */ } SRC.es = null; } }
let fileT = 0, scenesT = 0;
const fileQ = new Set();
function onFileEvent(d) {
  if (!d || !okScene(d.name)) return;
  // the list of scenes (a new scene, a count) a moment later
  if (!scenesT) scenesT = later(() => { scenesT = 0; listScenes(SRC.gen); }, 600);
  if (d.name !== STU.scene) return;
  if (okFile(d.path)) fileQ.add(d.path);
  if (!fileT) fileT = later(() => { fileT = 0; const s = new Set(fileQ); fileQ.clear(); refreshFiles(s); }, 300);
}
// a layout saved (here, or by another device, or put in the folder by hand) or removed: what Unsaved changes compares
// with; removed, there is no saved layout (what is placed stays)
async function onLayoutEvent(d) {
  if (!d || d.name !== STU.scene || !STU.scene) return;
  if (d.gone) { STU.saved = keyOf([]); STU.savedAt = 0; STU.savedBy = ''; STU.mine = 0; dirty(true); return; }
  if (STU.mine && Math.abs((+d.at || 0) - STU.mine) < 2) return;   // (our own save)
  const gen = STU.gen;
  try {
    const j = await getJSON(`${SRC.base}/api/scenes/${encodeURIComponent(STU.scene)}`);
    if (gen !== STU.gen) return;
    const L = readLayout(j.layout);
    STU.saved = keyOf(L.items); STU.savedAt = j.layout ? L.at || +d.at || +j.layoutAt || 0 : 0; STU.savedBy = L.by;
  } catch (e) { /* the next save says it again */ }
  dirty(true);
}
// a scene folder added or removed: the scene picker follows (the scene open stays open; gone, its listing says so the
// next time it is read)
function onScenesEvent(d) {
  if (!d || !Array.isArray(d.scenes) || SRC.kind !== 'relay') return;
  SRC.scenes = d.scenes.filter(s => s && okScene(s.name)).map(s => ({ name: s.name, files: +s.files || 0, bytes: +s.bytes || 0, at: +s.at || 0, layout: !!s.layout }));
  chooseScene();
  dirty(true);
}
