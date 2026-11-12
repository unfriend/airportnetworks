// ========================================================= EXAMPLE SCENES ==
// Scenes that ship with the app (v137; tools/studio/SPEC.md, "Example scenes"): a folder examples/ at the app's root holding
// scene folders and their listings exactly as tools/studio/scan.mjs writes them (examples/index.json and
// examples/<name>/files.json; &examples=<a relative folder> picks another, as the tests do). The first is bliss-xp, the XP
// room (tools/studio/xp/make.mjs). The Scene pane lists them, page and headset:
// - Open: the scene from that folder, read only, as &scenes=examples&scene=<name> opens it (editing works on this device;
//   Download layout.json keeps what was changed); Back to your scenes returns to where scenes came from before;
// - at a shared room's circle (v137b; the owner, 12 November 2026, at a studio circle on the test place: "bliss is greyed
//   out, why"): the scene there is the room's, so the example's button opens it from the relay for everyone at the circle:
//   the relay's copy of it (a scene of its name there), else it is copied there first under its name (exAt). Greyed only
//   while the story is locked or the room has no relay that takes uploads (a sentence says which). A device that had an
//   example open as it came to a circle goes back to the relay first (exLeave): the example's folder is this device's;
// - Copy to the relay (with a relay that takes uploads, page and headset since v137b): a free scene name (the example's,
//   else numbered), POST /api/scenes, every listed file fetched from the example and uploaded to the same path through the
//   studio's own upload path (upSend: straight into R2 where it can), its pictures too, then its layout.json saved through
//   the layout endpoint, the progress on the pane; then the copy opened from the relay (with editing on, away from a
//   circle; at a circle for everyone there, as the circle it was pressed at is still this device's).
// Nothing of it in the layout or the room (no FORMAT change).
const EX = { list: null, got: false, note: '', noteC: 'muted', busy: '', done: 0, of: 0, p: 0, path: '', prev: null };
const exBase = () => OPT.examples;
// the source is the examples' folder now (an example open)
const exHere = () => SRC.kind === 'folder' && SRC.folder === OPT.examples;
// the examples' listing, read once (none: no examples next to this copy of the app)
async function exLoad() {
  if (EX.got) return;
  EX.got = true;
  try {
    const j = await getJSON(exBase() + '/index.json');
    EX.list = (j && Array.isArray(j.scenes) ? j.scenes : []).filter(s => s && okScene(s.name)).map(s => ({ name: s.name, files: +s.files || 0, bytes: +s.bytes || 0 }));
  } catch (e) { EX.list = []; }
  dirty(true);
}
// Open: the scenes from the examples' folder, this one opened (read only); where they came from kept for Back
function exOpen(name) {
  if (atStation()) return exAt(name);
  if (!EX.list || !EX.list.some(s => s.name === name) || (exHere() && STU.scene === name)) return;
  if (!EX.prev) EX.prev = { scenes: OPT.scenes, scene: STU.scene };
  OPT.scenes = OPT.examples; OPT.scene = name;
  openScene('', 'pick');
  findSource();
  sfxAct('whoosh', 'stage', 'centre', { dur: 0.8 });
}
// Back to your scenes: the source as it was before the first example was opened
function exBack() {
  if (!EX.prev) return;
  OPT.scenes = EX.prev.scenes; OPT.scene = EX.prev.scene || ''; EX.prev = null;
  openScene('', 'pick');
  findSource();
}
// a scene name the relay has not got: the example's, else numbered ("bliss-xp 2")
function exFree(name) {
  const taken = new Set(SRC.scenes.map(s => s.name.toLowerCase()));
  let to = name, k = 2;
  while (taken.has(to.toLowerCase()) || !okScene(to)) to = `${name.slice(0, 58)} ${k++}`;
  return to;
}
const exCan = () => !OPT.visit && canWrite() && !exHere();
// the relay's copy of an example: a scene of its name there (at a circle that is the one opened)
const exOnRelay = name => SRC.kind === 'relay' && SRC.state === 'ok' && SRC.scenes.some(s => s.name === name);
// why an example cannot be put on the relay here, in words ('' it can)
function exWhy() {
  if (OPT.visit) return 'this is a visitor\'s page';
  if (SRC.kind !== 'relay') return 'this room has no relay with scenes (it runs peer to peer, or on this device)';
  if (SRC.state === 'auth' || SRC.held) return 'the relay wants its password';
  if (SRC.state !== 'ok') return 'the relay\'s scenes are not listed yet';
  if (!SRC.upload || !SRC.save) return 'this relay takes no uploads';
  return '';
}
// at a circle: the example opened for everyone there from the relay (its copy there, else copied there first)
function exAt(name) {
  if (!atStation() || editLocked() || EX.busy || !EX.list || !EX.list.some(s => s.name === name)) return;
  if (exOnRelay(name)) {
    if (STU.scene !== name) { openScene(name, 'pick'); sfxAct('whoosh', 'stage', 'centre', { dur: 0.8 }); }
    Object.assign(EX, { note: `Opened ${name} for everyone at this circle: the relay's copy of the example.`, noteC: 'green' });
    dirty(true);
    return;
  }
  exCopy(name);
}
// an example open (its folder this device's) as this device comes to a circle: back to the relay, the scene left to the
// room's (collabApply opens it). From collabApply before it applies the room's state, and every frame (a circle whose
// state is still empty: what goes out to it is then no scene, never the example's)
function exLeave() {
  if (!exHere() || !atStation()) return;
  OPT.scenes = EX.prev ? EX.prev.scenes : ''; OPT.scene = ''; EX.prev = null;
  openScene('', 'room');
  findSource();
}
// Copy to the relay: made there file by file, its layout last, then opened from the relay (with editing on away from a
// circle; at the circle it was pressed at, for everyone there)
async function exCopy(name) {
  if (!exCan() || EX.busy || !EX.list || !EX.list.some(s => s.name === name)) return;
  if (atStation() && editLocked()) return;
  const to = exFree(name), from = `${exBase()}/${encodeURIComponent(name)}/`, sid = stationId();
  Object.assign(EX, { busy: name, note: `Copying ${name} to the relay as ${to}...`, noteC: 'muted', done: 0, of: 0, p: 0, path: '' });
  dirty(true);
  const failed = [];
  try {
    const j = await getJSON(from + 'files.json');
    const files = (j && Array.isArray(j.files) ? j.files : []).filter(f => f && okFile(f.path)).map(f => f.path);
    let layout = null;
    if (+(j && j.layoutAt) > 0) { try { layout = await getJSON(from + 'layout.json'); } catch (e) { layout = null; } }
    EX.of = files.length + (layout ? 1 : 0);
    await getJSON(`${SRC.base}/api/scenes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: to }) });
    for (const p of files) {
      if (GL.gone) return;
      EX.path = p; EX.p = 0; dirty(true);
      try {
        const bytes = await getBytes(from + encPath(p));
        await upSend(fileApi(to, p), bytes, f => { EX.p = f; dirty(); });
      } catch (e) {
        if (e.status === 401) throw e;
        failed.push(`${p} (${e.message})`);
      }
      EX.done++;
    }
    if (layout) {
      EX.path = 'layout.json'; dirty(true);
      layout.scene = to;
      await getJSON(`${SRC.base}/api/scenes/${encodeURIComponent(to)}/layout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(layout) });
      EX.done++;
    }
    await listScenes(SRC.gen);
    if (GL.gone) return;
    // (opened where it was pressed: away from a circle with editing on; at the same circle for everyone there; a device that
    // walked into or out of a circle meanwhile opens nothing, the scene there being the room's)
    const at = !!sid, open = !editLocked() && stationId() === sid;
    if (open) { openScene(to, 'pick'); if (!at && !STU.edit) setEdit(true); }
    EX.note = `Copied ${name} to the relay as ${to}` + (open && at ? ' and opened it for everyone at this circle' : '') + (failed.length ? `, but ${failed.length} file${failed.length > 1 ? 's' : ''} could not be: ${failed.slice(0, 3).join('; ')}${failed.length > 3 ? '...' : ''}` : at ? '.' : ': it is yours to change and save.');
    EX.noteC = failed.length ? 'amber' : 'green';
    sfxAct('ping', 'stage', 'centre', { gain: 0.6 });
  } catch (e) {
    EX.note = e.status === 401 ? AUTH_NOTE : e.status === 409 ? `The relay has a scene called ${to} already: pick it above.` : e.status === 403 ? 'This relay takes no uploads (it runs with --scenes-readonly).' : `${name} could not be copied: ${e.message}`;
    EX.noteC = 'red';
  } finally { EX.busy = ''; EX.path = ''; dirty(true); }
}
// the Scene pane's Examples (page and headset)
function exBlocks(B) {
  if (!EX.list || !EX.list.length) return;
  const here = exHere(), st = atStation(), can = exCan(), lock = st && editLocked(), why = exWhy();
  B.push({ label: 'Examples (they come with the app)', p: st ? 'At a circle the scene is for everyone here: an example opens from the relay, its copy there' + (can ? ' (the first press copies it there).' : '.')
    : here ? 'An example is open, read only: what you change stays on this device (Download layout.json keeps it).' : 'Scenes to try. Open one as it is, read only' + (can ? ', or copy it to the relay to make it yours.' : '.'), c: 'faint' });
  for (const s of EX.list) {
    const rel = st && exOnRelay(s.name), open = (here || rel) && STU.scene === s.name;
    B.push({ row: [{ id: 'exopen:' + s.name, label: EX.busy === s.name && st && !rel ? 'Copying...' : (open ? '✓ ' : '') + s.name, act: 'exopen', v: s.name, on: open, dis: !!EX.busy || (st && (lock || open || (!rel && !can))) },
      { id: 'excopy:' + s.name, label: EX.busy === s.name ? 'Copying...' : 'Copy to the relay', act: 'excopy', v: s.name, dis: !can || !!EX.busy || lock, primary: can && here && open }] });
  }
  if (st && lock) B.push({ p: 'This circle\'s story is locked: unlock it (Lock this story) to change its scene.', c: 'amber' });
  else if (st && !can && !EX.list.some(s => exOnRelay(s.name))) B.push({ p: `An example cannot open at this circle: it has to be on the relay first, and ${why}.`, c: 'amber' });
  if (here && EX.prev) B.push({ row: [{ id: 'exback', label: 'Back to your scenes', act: 'exback', dis: !!EX.busy }] });
  if (EX.busy) B.push({ p: `Copying ${EX.busy}: ${EX.done} of ${EX.of} files` + (EX.path ? ` (${EX.path}${EX.p > 0 && EX.p < 1 ? ', ' + Math.round(EX.p * 100) + ' %' : ''})` : '') + '.', c: 'muted' });
  else if (EX.note) B.push({ p: EX.note, c: EX.noteC });
}
const exSig = () => [EX.list ? EX.list.length : -1, EX.busy, EX.done, EX.of, EX.path, Math.round(EX.p * 20), EX.note, !!EX.prev, exHere(), exCan(), atStation(), exWhy(), EX.list ? EX.list.map(s => +exOnRelay(s.name)).join('') : ''].join(',');
// for tests (STUDIO.examples): the list, what is open, and a copy under way or its note
const exState = () => ({ list: EX.list ? EX.list.map(s => s.name) : null, here: exHere(), folder: OPT.examples, busy: EX.busy, done: EX.done, of: EX.of, note: EX.note, prev: !!EX.prev, can: exCan(), at: atStation(), why: exWhy(), relay: EX.list ? EX.list.filter(s => exOnRelay(s.name)).map(s => s.name) : [] });
